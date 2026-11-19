"""
HealthCheck (1.65.0, Wunsch und Entscheide des Nutzers 2026-11-18): Lebenszeichen an externe Dienste wie Healthchecks.io, Cronitor oder
Better Stack. Fällt Home Assistant, das Internet oder der Strom aus, bleibt das Lebenszeichen aus, und der Dienst alarmiert; das kann
Alarmageddon selbst nicht melden.

- Bis zu MAX_HEALTHCHECKS Einträge, für alle Anlagen (wie Backup und eigene Töne), je mit Namen (seit 1.66.0 Pflicht) und einem Abstand
  (1 Minute bis 24 Stunden). Kein eigener Abstand bei scharfer Anlage (Entscheid des Nutzers 2026-11-19): der Selbsttest prüft dann öfter, und
  sein Wechsel auf "Probleme" geht ohnehin sofort hinaus.
- Inhalt (Entscheid des Nutzers: "Lebenszeichen + Fehler"): im Abstand die URL des Eintrags ("in Ordnung"); hat der Selbsttest Probleme, statt
  dessen die URL mit dem Fehler-Zusatz des Eintrags (generisch, Entscheid des Nutzers 21:54: "/fail" für Healthchecks.io und Better Stack,
  "?state=fail" für Cronitor; ohne Zusatz nur das Lebenszeichen). Das Panel schlägt den Zusatz für bekannte Dienste vor, der Nutzer entscheidet.
- Testknöpfe im Panel: "Fehler senden" und "OK senden" je Eintrag (nach einem Fehlertest bleibt der Dienst sonst bis zum nächsten Lebenszeichen rot). Wechselt das Ergebnis des Selbsttests, geht sofort ein Lebenszeichen
  hinaus (höchstens alle HEALTHCHECK_MIN_GAP Sekunden je Eintrag). Ein gescheitertes Lebenszeichen selbst zählt dafür nicht: es lässt sich über
  denselben Weg ohnehin nicht melden.
- Scheitert ein Lebenszeichen (Fehler, keine Antwort in HEALTHCHECK_TIMEOUT Sekunden, Antwort ausserhalb 2xx), hält der Selbsttest das fest
  (`ping_failed`); das nächste, das klappt, hebt es auf.
- Protokoll je Dienst (1.68.0, healthcheck_log.py): jeder Aufruf mit Art, Ergebnis, Antwortzeit und Auslöser; Mitschreiben ist Zusatz und hält nie
  ein Lebenszeichen auf (im `try`).

Sicherheitsregeln: Ein Lebenszeichen ist ein GET ohne Daten aus der Anlage. Es läuft als eigene Aufgabe mit Zeitgrenze und hält nie etwas auf
(keinen Alarm, keinen Selbsttest, kein Speichern). Die URL ist ein Geheimnis des Dienstes (wer sie kennt, kann einen Ausfall verdecken): Panel
und Backup zeigen und enthalten sie (Entscheid des Nutzers 2026-11-18), in Logzeilen, Meldungen und Befunden steht nur der Rechnername.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from functools import partial
import logging
import time
from typing import Any
from urllib.parse import urlsplit

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    DATA_HEALTHCHECK,
    DATA_SELFTEST,
    HEALTHCHECK_MIN_GAP,
    HEALTHCHECK_START_DELAY,
    HEALTHCHECK_STORE_KEY,
    HEALTHCHECK_TICK,
    HEALTHCHECK_TIMEOUT,
    SIGNAL_SELFTEST,
)
from .healthcheck_log import HealthLog
from .selftest import async_note, async_resolve
from .settings import apply_fail_suffix

_LOGGER = logging.getLogger(__name__)

RESULTS = ("ok", "http", "timeout", "error")


def host_of(url: str) -> str:
    """Nur der Rechnername (für Log, Befund und Meldung); die ganze URL ist ein Geheimnis des Dienstes."""
    try:
        return urlsplit(url).hostname or "?"
    except ValueError:
        return "?"


def fail_url(item: dict[str, Any]) -> str | None:
    """Adresse für "Fehler": URL mit dem Fehler-Zusatz des Eintrags (settings.apply_fail_suffix); ohne Zusatz None."""
    try:
        return apply_fail_suffix(str(item.get("url") or ""), str(item.get("fail_suffix") or ""))
    except ValueError:
        return None


def _clean_status(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not isinstance(value.get("at"), str) or dt_util.parse_datetime(value["at"]) is None:
        return None
    if value.get("sent") not in ("ok", "fail") or value.get("result") not in RESULTS:
        return None
    code = value.get("code")
    return {"at": value["at"], "sent": value["sent"], "result": value["result"], "code": code if isinstance(code, int) and not isinstance(code, bool) else None,
            "test": value.get("test") is True}


class HealthCheck:
    """Eine Instanz für alle Anlagen (hass.data[DATA_HEALTHCHECK])."""

    def __init__(self, hass: HomeAssistant, settings: Any) -> None:
        self.hass = hass
        self._settings = settings
        self._store = Store(hass, 1, HEALTHCHECK_STORE_KEY)
        self.status: dict[str, dict[str, Any]] = {}  # je Eintrag das letzte Lebenszeichen: Zeit, "ok"/"fail" gesendet, Ergebnis, HTTP-Status
        self._config: dict[str, dict[str, Any]] = {}  # Stand der Einträge beim letzten Abgleich (geänderte senden sofort neu)
        self._later: dict[str, CALLBACK_TYPE] = {}
        self._hold_until = 0.0  # nach dem Start erst nach HEALTHCHECK_START_DELAY
        self._last_try: dict[str, float] = {}
        self._last_auto: dict[str, float] = {}  # letztes Lebenszeichen ohne Testknopf
        self._failing: bool | None = None
        self._unsubs: list[CALLBACK_TYPE] = []
        self._fresh: set[str] = set()  # Einträge ohne Lebenszeichen seit dem Start (Auslöser "start" im Protokoll)
        # Meldungen "antwortet nicht" und "antwortet wieder" (1.68.0): gescheiterte Aufrufe hintereinander (ohne Testknopf), seit wann, und für
        # welche Dienste "antwortet nicht" hinausging. Gespeichert: ein Neustart mitten im Ausfall meldet nicht noch einmal.
        self._fails: dict[str, int] = {}
        self._fail_since: dict[str, float] = {}
        self._down: set[str] = set()
        self.log = HealthLog(hass)
        self.started = False

    async def async_load(self) -> None:
        await self.log.async_load()
        stored = await self._store.async_load()
        for hid, value in (stored.get("status") or {}).items() if isinstance(stored, dict) and isinstance(stored.get("status"), dict) else ():
            if isinstance(hid, str) and (clean := _clean_status(value)) is not None:
                self.status[hid] = clean
        if isinstance(stored, dict):
            for hid, value in (stored.get("fails") or {}).items() if isinstance(stored.get("fails"), dict) else ():
                if isinstance(hid, str) and isinstance(value, int) and not isinstance(value, bool) and value > 0:
                    self._fails[hid] = value
            for hid, value in (stored.get("fail_since") or {}).items() if isinstance(stored.get("fail_since"), dict) else ():
                if isinstance(hid, str) and isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0:
                    self._fail_since[hid] = float(value)
            self._down = {hid for hid in stored.get("down") or [] if isinstance(hid, str)} if isinstance(stored.get("down"), list) else set()

    @callback
    def async_start(self) -> None:
        if self.started:
            return
        self.started = True
        self._failing = self.failing()
        self._fresh = {i["id"] for i in self.items()}
        self._hold_until = dt_util.utcnow().timestamp() + HEALTHCHECK_START_DELAY
        self._unsubs.append(async_dispatcher_connect(self.hass, SIGNAL_SELFTEST, self._on_selftest))
        self._unsubs.append(async_track_time_interval(self.hass, self._tick, timedelta(seconds=HEALTHCHECK_TICK)))
        self._unsubs.append(async_call_later(self.hass, HEALTHCHECK_START_DELAY, self._tick))
        self.async_reconfigure(first=True)

    async def async_stop(self) -> None:
        for unsub in [*self._unsubs, *self._later.values()]:
            unsub()
        self._unsubs.clear()
        self._later.clear()
        self._config.clear()
        self.started = False
        await self._store.async_save(self._stored())
        await self.log.async_save()

    def _stored(self) -> dict[str, Any]:
        return {"status": self.status, "fails": dict(self._fails), "fail_since": dict(self._fail_since), "down": sorted(self._down)}

    def items(self) -> list[dict[str, Any]]:
        return list(self._settings.healthchecks)

    def item(self, hid: str) -> dict[str, Any] | None:
        return next((i for i in self.items() if i["id"] == hid), None)

    def listing(self) -> list[dict[str, Any]]:
        """Einträge für das Panel: die gespeicherten Werte (mit der URL, Entscheid des Nutzers), das letzte Lebenszeichen und seit wann der Zustand gilt."""
        return [{**item, "status": self.status.get(item["id"]), "log": self.log.brief(item["id"])} for item in self.items()]

    def problem_count(self) -> int:
        """Zahl der Probleme des Selbsttests ohne gescheiterte Lebenszeichen (für das Protokoll: "Fehler gemeldet, 2 Probleme")."""
        selftest = self.hass.data.get(DATA_SELFTEST)
        try:
            return sum(1 for p in selftest.problems() if p.get("code") != "ping_failed") if selftest is not None else 0
        except Exception:  # noqa: BLE001 - nur eine Angabe im Protokoll
            return 0

    def failing(self) -> bool:
        """Hat der Selbsttest Probleme (ohne gescheiterte Lebenszeichen: die lassen sich auf demselben Weg nicht melden)?"""
        selftest = self.hass.data.get(DATA_SELFTEST)
        if selftest is None:
            return False
        try:
            return any(p.get("code") != "ping_failed" for p in selftest.problems())
        except Exception:  # noqa: BLE001 - im Zweifel ein Lebenszeichen "in Ordnung", nie keines
            _LOGGER.exception("The health check could not read the self-test")
            return False

    # -- Zeitgeber --

    @callback
    def async_reconfigure(self, first: bool = False) -> None:
        """Nach dem Speichern: neue und geänderte Einträge sind sofort fällig, entfernte vergessen (samt ihrem Befund)."""
        current = {i["id"]: i for i in self.items()}
        for hid in [h for h in self._config if h not in current or self._config[h] != current[h]]:
            if (later := self._later.pop(hid, None)) is not None:
                later()
            self._config.pop(hid, None)
            self._last_auto.pop(hid, None)  # geändert: gleich mit den neuen Werten
            if hid not in current:
                self.status.pop(hid, None)
                self._last_try.pop(hid, None)
                self._fresh.discard(hid)
                self._fails.pop(hid, None)
                self._fail_since.pop(hid, None)
                self._down.discard(hid)
                self.log.remove(hid)
                async_resolve(self.hass, None, "ping_failed", hid)
        fresh = [hid for hid in current if hid not in self._config]
        for hid in fresh:
            self._config[hid] = dict(current[hid])
        self._save()
        # Neue und geänderte senden gleich (nach dem Start erst nach HEALTHCHECK_START_DELAY, über den Takt)
        if not first:
            for hid in fresh:
                self.async_ping(hid, by="save")

    @callback
    def _tick(self, _now: Any = None) -> None:
        """Jeder Eintrag, dessen Abstand seit dem letzten Lebenszeichen (ohne Testknopf) vergangen ist, sendet jetzt."""
        now = dt_util.utcnow().timestamp()
        if not self.started or now < self._hold_until:
            return
        for item in self.items():
            if now - self._last_auto.get(item["id"], 0.0) >= int(item["interval"]):
                self.async_ping(item["id"], by="start" if item["id"] in self._fresh else "tick")

    @callback
    def _on_selftest(self) -> None:
        """Das Ergebnis des Selbsttests hat gewechselt: sofort melden, nicht erst im Abstand."""
        failing = self.failing()
        if failing == self._failing:
            return
        self._failing = failing
        for item in self.items():
            self.async_ping(item["id"], respect_gap=True, by="selftest")

    @callback
    def async_ping(self, hid: str, respect_gap: bool = False, test: str | None = None, by: str = "tick") -> asyncio.Task | None:
        """
        Ein Lebenszeichen als eigene Aufgabe (nie abwarten). `respect_gap`: höchstens alle HEALTHCHECK_MIN_GAP Sekunden, sonst danach. `test`: Knopf
        im Panel, "ok" oder "fail" sendet genau das (ohne den Selbsttest zu fragen); "fail" ohne Fehler-Zusatz gibt es nicht (None). `by`: der
        Auslöser für das Protokoll ("tick", "selftest", "start", "save"; mit `test` immer "test").
        """
        item = self.item(hid)
        if item is None or (test == "fail" and fail_url(item) is None):
            return None
        if test:
            self._last_try[hid] = dt_util.utcnow().timestamp()
            return self.hass.async_create_background_task(self._send(item, test, "test"), f"alarmageddon health check test {hid}")
        if respect_gap:
            wait = HEALTHCHECK_MIN_GAP - (dt_util.utcnow().timestamp() - self._last_try.get(hid, 0.0))
            if wait > 0:
                if (later := self._later.pop(hid, None)) is not None:
                    later()
                self._later[hid] = async_call_later(self.hass, wait, partial(self._ping_later, hid))
                return None
        self._last_try[hid] = self._last_auto[hid] = dt_util.utcnow().timestamp()
        if hid in self._fresh:
            self._fresh.discard(hid)
            by = "start" if by == "tick" else by
        # Ein aufgeschobenes Lebenszeichen (Wechsel des Selbsttests) entfällt: dieses zeigt schon den aktuellen Stand
        if (later := self._later.pop(hid, None)) is not None:
            later()
        return self.hass.async_create_background_task(self._send(item, None, by), f"alarmageddon health check {hid}")

    @callback
    def _ping_later(self, hid: str, _now: Any = None) -> None:
        self._later.pop(hid, None)
        self.async_ping(hid, by="selftest")

    async def _send(self, item: dict[str, Any], test: str | None = None, by: str = "tick") -> dict[str, Any]:
        hid = item["id"]
        failing = test == "fail" if test else self.failing()
        bad = fail_url(item) if failing else None
        url = bad or item["url"]
        code: int | None = None
        ms: int | None = None
        began = time.monotonic()
        try:
            async with asyncio.timeout(HEALTHCHECK_TIMEOUT):
                async with async_get_clientsession(self.hass).get(url, allow_redirects=True) as response:
                    code = response.status
            # Antwortzeit bis zur Antwort des Dienstes (1.68.0, Kachel "Antwortzeit" im Protokoll)
            ms = round((time.monotonic() - began) * 1000)
            result = "ok" if 200 <= code < 300 else "http"
        except TimeoutError:
            result = "timeout"
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - jeder Fehler der Verbindung; die Meldung des Fehlers enthielte oft die URL (Geheimnis), darum nicht ins Log
            result = "error"
        now = dt_util.utcnow()
        status = {"at": now.isoformat(), "sent": "fail" if bad else "ok", "result": result, "code": code, "test": bool(test)}
        if self.item(hid) is not None:  # inzwischen gelöscht: nichts mehr festhalten
            self.status[hid] = status
            if not test:
                try:
                    self._notify(item, result, code, now)
                except Exception:  # noqa: BLE001 - die Meldung ist Zusatz, ein Fehler darin hält kein Lebenszeichen auf
                    _LOGGER.exception("The health check could not send its notification")
            try:
                self.log.record(hid, at=now, sent=status["sent"], result=result, code=code, ms=ms, by="test" if test else by,
                                problems=self.problem_count() if bad and not test else None, interval=int(item["interval"]))
            except Exception:  # noqa: BLE001 - das Protokoll ist Zusatz, ein Fehler darin hält kein Lebenszeichen auf
                _LOGGER.exception("The health check log could not record a call")
            if result == "ok":
                async_resolve(self.hass, None, "ping_failed", hid)
            else:
                host = host_of(item["url"])
                _LOGGER.warning("Health check %s to %s failed: %s", item.get("name", ""), host, f"HTTP {code}" if code is not None else result)
                async_note(self.hass, None, "ping_failed", hid, place={"area": "healthcheck", "id": hid}, service=host, reason=result,
                           label=str(code) if code is not None else "", name=str(item.get("name") or host))
            self._save()
        return status

    @callback
    def _save(self) -> None:
        self._store.async_delay_save(self._stored, 5)

    # -- Meldungen "antwortet nicht" und "antwortet wieder" (1.68.0) --

    @callback
    def _notify(self, item: dict[str, Any], result: str, code: int | None, at: Any) -> None:
        """
        Nach jedem automatischen Aufruf (Takt, Start, Speichern, Wechsel des Selbsttests; nie beim Testknopf): nach `fails` gescheiterten hintereinander einmal "antwortet nicht", beim ersten, der danach
        klappt, "antwortet wieder" (nur, wenn "antwortet nicht" hinausging). Werte ohne URL: Name, Rechner, Grund, Anzahl, seit wann.
        """
        from .notify import async_send_healthcheck  # noqa: PLC0415 - notify zieht die Anlagen nach

        hid = item["id"]
        cfg = self._settings.notify
        if result == "ok":
            count = self._fails.pop(hid, 0)
            since = self._fail_since.pop(hid, None)
            if hid in self._down:
                self._down.discard(hid)
                async_send_healthcheck(self.hass, cfg, "hc_up", self._values(item, count, since, None, None), tag=f"alarmageddon_hc_{hid}")
            return
        self._fails[hid] = self._fails.get(hid, 0) + 1
        self._fail_since.setdefault(hid, at.timestamp())
        if self._fails[hid] >= int(cfg["healthcheck"]["fails"]) and hid not in self._down and cfg["healthcheck"]["hc_down"].get("enabled"):
            self._down.add(hid)
            async_send_healthcheck(self.hass, cfg, "hc_down", self._values(item, self._fails[hid], self._fail_since[hid], result, code), tag=f"alarmageddon_hc_{hid}")

    def _values(self, item: dict[str, Any], count: int, since: float | None, result: str | None, code: int | None) -> dict[str, str]:
        from .notify import text  # noqa: PLC0415

        reason = ""
        if result == "http":
            reason = text(self.hass, "hc_reason_http", code=code if code is not None else "?")
        elif result in ("timeout", "error"):
            reason = text(self.hass, f"hc_reason_{result}")
        when = dt_util.as_local(dt_util.utc_from_timestamp(since)).strftime(text(self.hass, "time_format")) if since else ""
        return {"name": str(item.get("name") or host_of(item["url"])), "host": host_of(item["url"]), "reason": reason, "count": str(count), "since": when}


async def async_get_healthcheck(hass: HomeAssistant, settings: Any) -> HealthCheck:
    """Die eine Instanz (beim Start laden alle Anlagen zugleich: mit Sperre, wie der Selbsttest)."""
    if (healthcheck := hass.data.get(DATA_HEALTHCHECK)) is not None:
        return healthcheck
    async with hass.data.setdefault(f"{DATA_HEALTHCHECK}_lock", asyncio.Lock()):
        if (healthcheck := hass.data.get(DATA_HEALTHCHECK)) is None:
            healthcheck = HealthCheck(hass, settings)
            await healthcheck.async_load()
            hass.data[DATA_HEALTHCHECK] = healthcheck
    return healthcheck


async def async_stop_healthcheck(hass: HomeAssistant) -> None:
    if (healthcheck := hass.data.pop(DATA_HEALTHCHECK, None)) is not None:
        await healthcheck.async_stop()
