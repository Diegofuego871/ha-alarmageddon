"""
Verlauf eines Sensors für die Sensoransicht (1.9.0): Stundenwerte, Ereignisse, Zustand der Anlage, Batterie und Empfang.

Woher die Daten kommen (Entscheid des Nutzers, 2026-11-10):
- **Stundenwerte** merkt sich die Integration selbst: je Sensor und Stunde die Anzahl Auslösungen (zu -> offen) und die
  Sekunden im Zustand "offen". 30 Tage, ältere werden verworfen. Daraus entstehen Grafik und Kennzahlen, immer 30 Tage weit,
  auch wenn Home Assistant den Verlauf nur 10 Tage aufbewahrt (Standard des Recorders).
- **Ereignisse** (die Liste) kommen aus dem Verlauf von Home Assistant, so weit er reicht.
- **Batterie und Empfang** kommen aus der Langzeitstatistik von Home Assistant (Zahlenwerte gibt es dort über Monate),
  sonst aus dem Verlauf.

Die Auswertung steht hier und nicht im Panel: so ist sie an einer Stelle und mit Tests gesichert.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from functools import partial
import logging
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .forecast import forecast_days
from .last_change import _item

_LOGGER = logging.getLogger(__name__)

DATA_STATS = f"{DOMAIN}_sensor_stats"
DATA_STATS_LOCK = f"{DOMAIN}_sensor_stats_lock"
STATS_STORE_KEY = f"{DOMAIN}.sensor_stats"
STATS_KEEP_HOURS = 30 * 24
EVENTS_MAX = 300  # Zeilen der Liste je Abfrage (neueste zuerst)
POINTS_MAX = 240  # Punkte einer Linie (Batterie, Empfang)
LIVE_POINT_GAP = 60  # Sekunden: ist der letzte Punkt älter, endet die Linie mit dem aktuellen Wert bei "jetzt"
BATTERY_JUMP = 20  # Sprung nach oben um so viele Prozentpunkte gilt als Batteriewechsel
# Prognose der Tabelle (1.66.0): wie die Sensoransicht bei "1 Jahr" aus der Langzeitstatistik. Bis 1.65.0 rechnete die Tabelle nur mit dem
# Verlauf (den der Recorder standardmässig 10 Tage aufbewahrt): eine Batterie, die seit Wochen gleich steht oder kurz wieder steigt, bekam
# dort keine Prognose, die Ansicht aber schon (Meldung des Nutzers 2026-11-19).
FORECAST_HOURS = 8760
GONE = ("unavailable", "unknown")
ARMED = {"armed_home": "home", "armed_away": "away", "armed_night": "night"}
# Zeiträume der Ansicht in Stunden: Verlauf und Empfang 3 Stunden bis 30 Tage, Batterie 30 Tage bis 1 Jahr
STATE_HOURS = (3, 12, 24, 168, 720)
BATTERY_HOURS = (720, 2160, 8760)
BACKFILLED = "__backfilled__"


def _hour(when: datetime) -> datetime:
    return when.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


def _split(start: datetime, end: datetime) -> list[tuple[datetime, int]]:
    """Dauer von start bis end auf die Stunden verteilen: [(Stunde, Sekunden)]."""
    out: list[tuple[datetime, int]] = []
    cursor = start
    while cursor < end:
        hour = _hour(cursor)
        stop = min(end, hour + timedelta(hours=1))
        out.append((hour, round((stop - cursor).total_seconds())))
        cursor = stop
    return out


def _row(value: Any) -> list[int] | None:
    """
    Eine gespeicherte Stunde [Anzahl, Sekunden]; None, wenn sie beschädigt ist. Code-Review 1.63.0: bis 1.62.0 liess ein einziger Wert, der keine Zahl
    ist, das ganze Laden scheitern: keine Anlage zählte mehr Auslösungen, und die Sensoransicht meldete bei jedem Sensor einen Fehler.
    """
    if not isinstance(value, list) or len(value) != 2:
        return None
    try:
        return [int(value[0]), int(value[1])]
    except (TypeError, ValueError, OverflowError):
        return None


class SensorStats:
    """Stundenwerte je Sensor: {entity_id: {Stunde (ISO, UTC): [Anzahl Auslösungen, Sekunden offen]}}, für alle Anlagen gemeinsam."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, 1, STATS_STORE_KEY)
        self.data: dict[str, dict[str, list[int]]] = {}
        self.backfilled: set[str] = set()
        # Seit wann ein Sensor offen ist (für die Sekunden) und sein letzter gemeldeter Wechsel (zwei Anlagen mit demselben Sensor
        # melden denselben Wechsel: er zählt einmal)
        self._since: dict[str, datetime] = {}
        self._last: dict[str, tuple[str, str]] = {}
        self._save_pending = False
        self._purged: datetime | None = None

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            self.backfilled = {e for e in stored.get(BACKFILLED, []) if isinstance(e, str)} if isinstance(stored.get(BACKFILLED), list) else set()
            for entity_id, hours in stored.items():
                if entity_id == BACKFILLED or not isinstance(hours, dict):
                    continue
                self.data[entity_id] = {h: row for h, v in hours.items() if (row := _row(v)) is not None}
        self.purge()

    def _bucket(self, entity_id: str, hour: datetime) -> list[int]:
        return self.data.setdefault(entity_id, {}).setdefault(hour.isoformat(), [0, 0])

    @callback
    def note(self, entity_id: str, old: str | None, new: str | None, when: datetime) -> None:
        """
        Zustandswechsel eines überwachten Sensors. Als Auslösung zählt nur zu -> offen (nicht die Rückkehr aus "nicht
        verfügbar", die nach jedem Neustart vorkommt); die Zeit "offen" läuft ab jedem Wechsel auf offen.
        """
        key = (when.isoformat(), str(new))
        if self._last.get(entity_id) == key:
            return
        self._last[entity_id] = key
        if new == STATE_ON and old != STATE_ON:
            if old == STATE_OFF:
                self._bucket(entity_id, _hour(when))[0] += 1
            self._since[entity_id] = when
        elif old == STATE_ON and new != STATE_ON:
            start = self._since.pop(entity_id, None)
            if start is None:
                return  # schon vor dem Start von Home Assistant offen: die Dauer davor ist nicht bekannt
            for hour, seconds in _split(start, when):
                self._bucket(entity_id, hour)[1] += seconds
        else:
            return
        self._save_soon()

    def _save_soon(self) -> None:
        """Verzögert schreiben, ohne den Termin hinauszuschieben (wie Settings._save_soon); dabei einmal je Stunde Altes verwerfen."""
        now = dt_util.utcnow()
        if self._purged is None or now - self._purged >= timedelta(hours=1):
            self.purge()
        if self._save_pending:
            return
        self._save_pending = True
        self._store.async_delay_save(self._data_for_save, 30)

    def _data_for_save(self) -> dict[str, Any]:
        self._save_pending = False
        return {**self.data, BACKFILLED: sorted(self.backfilled)}

    @callback
    def purge(self) -> None:
        """Stunden, die älter als 30 Tage sind, verwerfen; Sensoren ohne Werte ganz."""
        self._purged = dt_util.utcnow()
        limit = _hour(self._purged - timedelta(hours=STATS_KEEP_HOURS)).isoformat()
        for entity_id in list(self.data):
            self.data[entity_id] = {h: v for h, v in self.data[entity_id].items() if h >= limit}
            if not self.data[entity_id] and entity_id not in self._since:
                del self.data[entity_id]

    def buckets(self, entity_id: str, start: datetime, now: datetime) -> list[list[Any]]:
        """Stundenwerte ab `start` als [Stunde, Anzahl, Sekunden], aufsteigend; ein noch offener Sensor zählt bis `now` mit."""
        first = _hour(start).isoformat()
        hours = {h: list(v) for h, v in self.data.get(entity_id, {}).items() if h >= first}
        since = self._since.get(entity_id)
        if since is not None and since < now:
            for hour, seconds in _split(max(since, start), now):
                hours.setdefault(hour.isoformat(), [0, 0])[1] += seconds
        return [[h, v[0], v[1]] for h, v in sorted(hours.items())]

    @callback
    def backfill(self, entity_id: str, periods: list[dict[str, Any]], now: datetime) -> None:
        """
        Einmal je Sensor: Stunden vor dem ersten eigenen Wert aus dem Verlauf von Home Assistant füllen, damit die Grafik nach
        dem Update nicht leer beginnt. Stunden, für die es schon eigene Werte gibt, bleiben unberührt (nichts zählt doppelt).
        """
        if entity_id in self.backfilled:
            return
        self.backfilled.add(entity_id)
        own = self.data.get(entity_id, {})
        before = min(own) if own else _hour(now).isoformat()
        for period in periods:
            if period["kind"] != "on" or _hour(period["start"]).isoformat() >= before:
                continue
            if period.get("counted", True):
                self._bucket(entity_id, _hour(period["start"]))[0] += 1
            for hour, seconds in _split(period["start"], period["end"] or now):
                if hour.isoformat() < before:
                    self._bucket(entity_id, hour)[1] += seconds
        self.purge()
        self._save_soon()


async def async_get_stats(hass: HomeAssistant) -> SensorStats:
    """
    Eine Instanz für alle Anlagen (ein Sensor kann in mehreren stehen). Beim Start laden alle Anlagen zugleich: unter einer Sperre
    und erst nach dem Laden eingetragen (wie die Einstellungen), sonst sähe die zweite Anlage eine noch leere Instanz, und das Laden
    überschriebe, was sie inzwischen mitgeschrieben hat. Scheitert das Laden, bleibt nichts Halbfertiges eingetragen: der nächste Start versucht es neu.
    """
    if (stats := hass.data.get(DATA_STATS)) is not None:
        return stats
    lock = hass.data.setdefault(DATA_STATS_LOCK, asyncio.Lock())
    async with lock:
        if (stats := hass.data.get(DATA_STATS)) is None:
            stats = SensorStats(hass)
            await stats.async_load()
            hass.data[DATA_STATS] = stats
    return stats


# ---------- Ereignisse aus dem Verlauf ----------


async def async_states(hass: HomeAssistant, entity_id: str, start: datetime) -> list[tuple[datetime, str]]:
    """Zustände eines Sensors ab `start` aus dem Recorder, aufsteigend; ohne Recorder oder bei einem Fehler leer."""
    if "recorder" not in hass.config.components:
        return []
    from homeassistant.components.recorder import get_instance, history  # noqa: PLC0415 - nur mit Recorder

    try:
        states = await get_instance(hass).async_add_executor_job(
            partial(history.get_significant_states, hass, start, None, [entity_id],
                    significant_changes_only=False, minimal_response=True, no_attributes=True)
        )
    except Exception:  # noqa: BLE001 - die Ansicht darf wegen des Verlaufs nie ausfallen
        _LOGGER.exception("Sensor history could not be read")
        return []
    return sorted(p for item in states.get(entity_id, []) if (p := _item(item)))


def periods(items: list[tuple[datetime, str]], start: datetime) -> list[dict[str, Any]]:
    """
    Aus Zuständen Abschnitte machen: "on" (offen, Bewegung) und "gone" (nicht erreichbar), aufsteigend, das Ende offen (None),
    wenn der Abschnitt noch läuft. `counted` sagt, ob der Abschnitt mit einem echten Wechsel zu -> offen begann.
    """
    out: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    previous: str | None = None
    for when, state in items:
        when = max(when, start)
        kind = "on" if state == STATE_ON else "gone" if state in GONE else None
        if current is not None and current["kind"] != kind:
            current["end"] = when
            out.append(current)
            current = None
        if kind is not None and current is None:
            current = {"kind": kind, "start": when, "end": None, "counted": kind == "on" and previous == STATE_OFF}
        previous = state
    if current is not None:
        out.append(current)
    return out


def armed_intervals(events: list[dict[str, Any]], start: datetime, now: datetime) -> list[dict[str, Any]]:
    """Wann die Anlage scharf war (auch Eingangsverzögerung und Alarm), aus ihrem Ereignisprotokoll: [{from, to, mode}]."""
    changes = sorted(
        ((when, e) for e in events if not e.get("kind") and e.get("state") and (when := dt_util.parse_datetime(str(e.get("t") or ""))) is not None),
        key=lambda item: item[0],
    )
    out: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for when, event in changes:
        state = str(event["state"])
        mode = ARMED.get(state) or (event.get("mode") if state in ("pending", "triggered") else None)
        if current is not None and mode != current["mode"]:
            current["to"] = when
            out.append(current)
            current = None
        if mode and current is None:
            current = {"from": when, "to": None, "mode": mode}
    if current is not None:
        out.append(current)
    return [{"from": max(i["from"], start), "to": i["to"], "mode": i["mode"]} for i in out if (i["to"] or now) > start]


def mode_at(intervals: list[dict[str, Any]], when: datetime) -> str | None:
    return next((i["mode"] for i in intervals if i["from"] <= when and (i["to"] is None or when < i["to"])), None)


def _iso(when: datetime | None) -> str | None:
    return when.isoformat() if when is not None else None


async def async_state_history(hass: HomeAssistant, stats: SensorStats, entity_id: str, hours: int,
                              events: list[dict[str, Any]], recordings: list[dict[str, Any]]) -> dict[str, Any]:
    """Antwort der Sensoransicht für den Reiter "Verlauf": Stundenwerte, Ereignisse, Zustand der Anlage, Kennzahlen."""
    now = dt_util.utcnow()
    start = now - timedelta(hours=hours)
    # Für die Stundenwerte einmal 30 Tage Verlauf nachtragen (so weit Home Assistant ihn hat)
    if entity_id not in stats.backfilled:
        full = await async_states(hass, entity_id, now - timedelta(hours=STATS_KEEP_HOURS))
        stats.backfill(entity_id, periods(full, now - timedelta(hours=STATS_KEEP_HOURS)), now)
        items = [(when, state) for when, state in full if when >= start] if hours < STATS_KEEP_HOURS else full
        if hours < STATS_KEEP_HOURS and full:
            # Der Zustand am Anfang des Zeitraums ist der letzte davor
            earlier = [item for item in full if item[0] < start]
            items = ([earlier[-1]] if earlier else []) + items
    else:
        items = await async_states(hass, entity_id, start)
    found = periods(items, start)
    armed = armed_intervals(events, start, now)
    alarms = [(when, r["id"]) for r in recordings if r.get("sensor") == entity_id and (when := dt_util.parse_datetime(str(r.get("start") or ""))) is not None and when >= start]
    rows: list[dict[str, Any]] = []
    for period in found:
        end = period["end"]
        row = {"kind": period["kind"], "start": _iso(period["start"]), "end": _iso(end), "seconds": round(((end or now) - period["start"]).total_seconds()),
               "mode": mode_at(armed, period["start"]), "alarm": None}
        if period["kind"] == "on":
            # Der Alarm, den diese Auslösung begonnen hat: seine Aufzeichnung startet mit der Auslösung
            row["alarm"] = next((rid for when, rid in alarms if abs((when - period["start"]).total_seconds()) <= 5 or (period["start"] <= when < (end or now))), None)
        rows.append(row)
    buckets = stats.buckets(entity_id, start, now)
    on = [r for r in rows if r["kind"] == "on"]
    gone = [r for r in rows if r["kind"] == "gone"]
    by_hour: dict[int, int] = {}
    for hour, count, _seconds in buckets:
        local = dt_util.as_local(dt_util.parse_datetime(hour)).hour
        by_hour[local] = by_hour.get(local, 0) + count
    count = sum(b[1] for b in buckets) if hours >= 12 else sum(1 for r in on if dt_util.parse_datetime(r["start"]) > start)
    seconds = sum(b[2] for b in buckets) if hours >= 12 else sum(r["seconds"] for r in on)
    gone_seconds = sum(r["seconds"] for r in gone)
    return {
        "kind": "state", "hours": hours, "now": now.isoformat(), "start": start.isoformat(),
        "buckets": buckets,
        # Die Zahl der Ereignisse im gewählten Zeitraum, auch wenn die Liste nur die neuesten EVENTS_MAX zeigt (1.66.1, Vorgabe des Nutzers
        # 2026-11-19: die Zahl über der Liste entspricht immer dem Zeitraum, nie einer Obergrenze oder dem Total)
        "events": list(reversed(rows))[:EVENTS_MAX], "truncated": len(rows) > EVENTS_MAX, "events_total": len(rows),
        "events_from": _iso(items[0][0]) if items else None,
        "armed": [{"from": _iso(i["from"]), "to": _iso(i["to"]), "mode": i["mode"]} for i in armed],
        "summary": {
            "count": count, "seconds": seconds,
            "longest": max((r["seconds"] for r in on), default=0),
            "last": on[-1]["start"] if on else None,
            "busiest_hour": max(by_hour, key=by_hour.get) if any(by_hour.values()) else None,
            "per_day": round(count / (hours / 24), 1) if hours >= 24 else None,
            "gone_count": len(gone), "gone_seconds": gone_seconds,
            "available": round(100 * (1 - min(1.0, gone_seconds / (hours * 3600))), 1),
            "alarms": sum(1 for r in on if r["alarm"]),
        },
    }


# ---------- Batterie und Empfang ----------


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


async def _statistics(hass: HomeAssistant, entity_id: str, start: datetime, period: str) -> list[tuple[datetime, float]]:
    """Mittelwerte aus der Statistik von Home Assistant (5 Minuten, Stunde oder Tag)."""
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415 - nur mit Recorder
    from homeassistant.components.recorder.statistics import statistics_during_period  # noqa: PLC0415

    rows = await get_instance(hass).async_add_executor_job(partial(statistics_during_period, hass, start, None, {entity_id}, period, None, {"mean"}))
    out: list[tuple[datetime, float]] = []
    for row in rows.get(entity_id, []):
        when, value = row.get("start"), _number(row.get("mean"))
        when = datetime.fromtimestamp(when, UTC) if isinstance(when, (int, float)) else when
        if isinstance(when, datetime) and value is not None:
            out.append((when, value))
    return out


async def async_numeric(hass: HomeAssistant, entity_id: str, start: datetime, hours: int) -> list[tuple[datetime, float]]:
    """Werte eines Zahlensensors ab `start`: aus der Statistik, sonst aus dem Verlauf; höchstens POINTS_MAX Punkte (gemittelt)."""
    if "recorder" not in hass.config.components:
        return []
    points: list[tuple[datetime, float]] = []
    try:
        points = await _statistics(hass, entity_id, start, "5minute" if hours <= 24 else "hour" if hours <= 720 else "day")
    except Exception:  # noqa: BLE001 - ohne Statistik bleibt der Verlauf
        _LOGGER.debug("No statistics for %s", entity_id, exc_info=True)
    if len(points) < 2:
        # Ohne Statistik (oder mit nur einem Wert daraus) der Verlauf; die längere Reihe gilt
        changes = [(when, value) for when, state in await async_states(hass, entity_id, start) if (value := _number(state)) is not None]
        if len(changes) > len(points):
            points = changes
    limit = POINTS_MAX - 1  # ein Punkt bleibt frei für den aktuellen Wert am Ende der Linie
    if len(points) <= limit:
        return points
    size = -(-len(points) // limit)
    return [(chunk[len(chunk) // 2][0], sum(v for _w, v in chunk) / len(chunk)) for chunk in (points[i:i + size] for i in range(0, len(points), size))]


def battery_changes(points: list[tuple[datetime, float]]) -> list[datetime]:
    """Zeitpunkte, an denen die Batterie gewechselt wurde: ein Sprung nach oben um mindestens BATTERY_JUMP Prozentpunkte."""
    return [when for (_p, before), (when, value) in zip(points, points[1:], strict=False) if value - before >= BATTERY_JUMP]


async def async_numeric_history(hass: HomeAssistant, entity_id: str, kind: str, hours: int, threshold: float) -> dict[str, Any]:
    """Antwort der Sensoransicht für die Reiter "Batterie" und "Empfang"."""
    now = dt_util.utcnow()
    start = now - timedelta(hours=hours)
    points = await async_numeric(hass, entity_id, start, hours)
    state = hass.states.get(entity_id)
    current = _number(state.state) if state else None
    # Die Linie läuft bis jetzt (1.17.11): Der Verlauf kennt nur Wechsel. Ein Wert, der sich im Zeitraum nicht ändert, ergab
    # nur den Stand am Anfang, also einen einzigen Punkt, und statt der Grafik stand "noch keine Werte". Der aktuelle Wert
    # ist der letzte Punkt; er gilt auch, wenn der Verlauf dem Sensor hinterherhinkt.
    if current is not None and points and (now - points[-1][0]).total_seconds() >= LIVE_POINT_GAP:
        points = [*points, (now, current)]
    values = [v for _w, v in points]
    out: dict[str, Any] = {
        "kind": kind, "hours": hours, "now": now.isoformat(), "start": start.isoformat(), "entity_id": entity_id,
        "unit": state.attributes.get("unit_of_measurement") if state else None,
        "points": [[when.isoformat(), round(value, 1)] for when, value in points],
        "summary": {"current": current if current is not None else (values[-1] if values else None),
                    "mean": round(sum(values) / len(values), 1) if values else None, "min": min(values, default=None), "max": max(values, default=None)},
    }
    if kind == "battery":
        out["threshold"] = threshold
        battery = battery_summary(points, threshold)
        out["changes"] = battery.pop("changes")
        out["summary"].update(battery)
    return out


def battery_summary(points: list[tuple[datetime, float]], threshold: float) -> dict[str, Any]:
    """Batteriewechsel, Abfall je Tag und Tage bis zur Schwelle ab dem letzten Wechsel; für die Sensoransicht und die Tabelle gleich."""
    changes = battery_changes(points)
    since = [(w, v) for w, v in points if not changes or w >= changes[-1]]
    days = (since[-1][0] - since[0][0]).total_seconds() / 86400 if len(since) > 1 else 0
    return {
        "changes": [when.isoformat() for when in changes],
        "per_day": round((since[-1][1] - since[0][1]) / days, 2) if days >= 1 else None,
        "days_left": forecast_days([(w.timestamp(), v) for w, v in since], threshold),
        "last_change": changes[-1].isoformat() if changes else None,
    }


async def async_battery_points(hass: HomeAssistant, entity_id: str, hours: int) -> list[tuple[datetime, float]]:
    """Punkte der Batterie wie in der Sensoransicht: Statistik (sonst Verlauf), die Linie endet mit dem aktuellen Wert bei "jetzt"."""
    now = dt_util.utcnow()
    points = await async_numeric(hass, entity_id, now - timedelta(hours=hours), hours)
    state = hass.states.get(entity_id)
    current = _number(state.state) if state else None
    if current is not None and points and (now - points[-1][0]).total_seconds() >= LIVE_POINT_GAP:
        points = [*points, (now, current)]
    return points


async def async_battery_forecasts(hass: HomeAssistant, batteries: list[str], threshold: float) -> dict[str, float | None]:
    """
    Tage bis zur Schwelle je Batteriesensor für die Tabelle, gleich gerechnet wie die Sensoransicht bei "1 Jahr" (FORECAST_HOURS). Ohne Recorder
    ein leeres Ergebnis; ein Fehler bei einem Sensor lässt nur ihn ohne Prognose (eine Prognose darf das Panel nie stören).
    """
    if not batteries or "recorder" not in hass.config.components:
        return {}
    out: dict[str, float | None] = {}
    for entity_id in batteries:
        try:
            out[entity_id] = battery_summary(await async_battery_points(hass, entity_id, FORECAST_HOURS), threshold)["days_left"]
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Battery forecast failed for %s", entity_id)
            out[entity_id] = None
    return out


def monitor_events(entries: list[Any], entity_id: str, start: datetime) -> list[dict[str, Any]]:
    """
    Ereignisse der Überwachung zu einem Messwert-Sensor (Reiter "Verlauf" der Sensoransicht, 1.54.0): nur "ausserhalb der Grenzen" und "wieder in
    Ordnung", nie die Messwerte selbst (Entscheid des Nutzers, 2026-11-16: sonst unübersichtlich). Neueste zuerst, alle im Zeitraum (die Obergrenze der Liste setzt `async_measure_history`, die Zahl bleibt die des Zeitraums).
    """
    out: list[dict[str, Any]] = []
    for entry in entries:
        for event in entry.runtime_data.events.events:
            if event.get("kind") not in ("monitor_out", "monitor_ok") or event.get("entity_id") != entity_id:
                continue
            when = dt_util.parse_datetime(str(event.get("t")))
            if when is None or when < start:
                continue
            out.append({"t": event["t"], "kind": "out" if event["kind"] == "monitor_out" else "ok", "rule": event.get("monitor") or "", "system": entry.title,
                        "entry_id": entry.entry_id, "value": event.get("value") or "", "unit": event.get("unit") or ""})
    out.sort(key=lambda e: e["t"], reverse=True)
    return out


def monitor_limits(entries: list[Any], entity_id: str) -> list[dict[str, Any]]:
    """Grenzen der Regeln, die diesen Messwert beobachten (als gestrichelte Linien in der Grafik), je Regel und Grenze."""
    from .const import CONF_MONITORS
    from .routines import tree_leaves

    out: list[dict[str, Any]] = []
    for entry in entries:
        for rule in entry.options.get(CONF_MONITORS) or []:
            for leaf in tree_leaves(rule["tree"]):
                if leaf.get("kind") != "value" or leaf.get("entity_id") != entity_id:
                    continue
                limits = [float(leaf["limit"])] + ([float(leaf["upper"])] if leaf["op"] == "outside" else [])
                out.append({"rule": rule["name"], "op": leaf["op"], "limits": limits})
    return out


async def async_measure_history(hass: HomeAssistant, entries: list[Any], entity_id: str, hours: int) -> dict[str, Any]:
    """Antwort der Sensoransicht für einen Messwert-Sensor (Temperatur, Luftfeuchtigkeit, CO2): Werteverlauf, Kennzahlen, Ereignisse der Überwachung, Grenzen."""
    result = await async_numeric_history(hass, entity_id, "value", hours, 0.0)
    start = dt_util.parse_datetime(result["start"]) or dt_util.utcnow() - timedelta(hours=hours)
    events = monitor_events(entries, entity_id, start)
    result["events"], result["truncated"], result["events_total"] = events[:EVENTS_MAX], len(events) > EVENTS_MAX, len(events)
    result["limits"] = monitor_limits(entries, entity_id)
    return result
