"""
Selbsttest (1.65.0, Wunsch des Nutzers 2026-11-18): prüft, ob alles, was die Anlagen brauchen, noch da ist und funktioniert.

Zwei Arten von Befunden:
- Konfiguration (bei jeder Prüfung neu ermittelt): Geräte, Aktionen (Dienste), Empfänger, Töne und Sensoren, die in den Aktionen, den Regeln
  der Überwachung, den Routinen und den Benachrichtigungen vorkommen, aber fehlen oder nicht erreichbar sind. Ein solcher Befund verschwindet
  von selbst, sobald die Ursache behoben ist (bei der nächsten Prüfung; nach dem Speichern prüft der Selbsttest kurz danach von selbst).
- Laufzeit (sofort festgehalten, über Neustarts hinweg): ein Aufruf, der scheiterte oder nicht antwortete, ein Eingriff des Wächters, eine
  Meldung, die nicht hinausging, ein Teil, der nicht startete, ein gescheitertes automatisches Backup. Er bleibt stehen, bis derselbe Aufruf
  wieder klappt (im Alarm oder im Test) oder der Nutzer ihn im Panel als erledigt markiert (Entscheid des Nutzers, 2026-11-18: "Beides").

Was als Problem zählt (Entscheid des Nutzers): ein Gerät, das ein Ablauf schaltet (Sirene, Schalter, Lautsprecher), zählt auch dann, wenn es
nur nicht erreichbar ist (seit SELFTEST_GRACE Sekunden), nicht erst, wenn es fehlt. Sensoren des Alarms und der Überwachung meldet schon die
Wartung als nicht erreichbar ("Sensor nicht erreichbar"); der Selbsttest meldet bei ihnen nur, wenn sie ganz fehlen (keine doppelte Meldung).

Wann: nach dem Start (SELFTEST_START_DELAY, die Geräte verbinden sich erst), kurz nach jedem Speichern (eine Anlage lädt neu, die
Benachrichtigungen), alle "selftest_minutes" Minuten, solange eine Anlage scharf ist alle "selftest_minutes_armed" Minuten (Kapitel HealthCheck unter
Konfiguration › Anlage) und auf Knopfdruck ("Jetzt prüfen").

Wohin: Panel (Statuskachel und Fenster mit Hilfe), Entität je Anlage (binary_sensor, Geräteklasse Problem), Statusentität der Anlage (zählt
mit), Reparaturen von Home Assistant (je Anlage eine Meldung, dazu eine für alle Anlagen) und die Wartungsmeldung "Selbsttest" (je Befund
einmal, wie Batterie und Ausfall; ein Befund, der verschwindet und wiederkommt, meldet sich neu).

Sicherheitsregeln: Der Selbsttest liest nur. Er schaltet nie ein Gerät, spielt keinen Ton und sendet keine Probemeldung. Ein Fehler im
Selbsttest hält nie die Anlage oder einen Alarm auf: jeder Einstieg von aussen (async_note, async_resolve) fängt alles ab und wartet auf nichts.
Geheimnisse (Code, Hash, Salz, Token) kommen nie in einen Befund: nur Kennungen von Entitäten und Diensten, Namen von Regeln und Routinen,
nie die Daten eines Aufrufs oder der Text einer Meldung.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from datetime import datetime, timedelta
import logging
import re
from typing import Any

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import CALLBACK_TYPE, CoreState, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.network import NoURLAvailableError, get_url
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    ALL_SOUNDS,
    CONF_EVENT_NOTIFY,
    CONF_MONITORS,
    CONF_ROUTINES,
    CONF_WORKFLOW_END,
    CONF_WORKFLOWS,
    CONF_WORKFLOWS_AFTER,
    CONF_WORKFLOWS_ARMED,
    CONF_WORKFLOWS_ARMING,
    CONF_WORKFLOWS_DISARMED,
    CONF_WORKFLOWS_ENTRY,
    CONF_WORKFLOWS_REPORT,
    CUSTOM_SOUND_ID_RE,
    DATA_CUSTOM_SOUNDS,
    DATA_SELFTEST,
    DATA_SELFTEST_LOCK,
    DOMAIN,
    GROUP_EXCLUDED,
    MODES,
    NOTIFY_TYPES,
    SELFTEST_GRACE,
    SELFTEST_MINUTES_RANGE,
    SELFTEST_MAX_INCIDENTS,
    SELFTEST_MAX_PLACES,
    SELFTEST_REPORT_DELAY,
    SELFTEST_SOON,
    SELFTEST_START_DELAY,
    SELFTEST_STORE_KEY,
    SELFTEST_TICK,
    SIGNAL_SELFTEST,
    WORKFLOW_ALWAYS,
)
from .devices import display_name

_LOGGER = logging.getLogger(__name__)

# Befunde der Konfiguration (bei jeder Prüfung neu) und der Laufzeit (festgehalten, bis behoben oder erledigt)
CONFIG_CODES = (
    "entity_missing", "entity_unavailable", "service_missing", "recipient_missing", "no_recipients", "sound_missing", "no_url",
    "rule_damaged", "system_not_loaded",
)
RUNTIME_CODES = ("step_failed", "step_hung", "notify_failed", "start_failed", "backup_failed", "ping_failed")
# Listen der Aktionen einer Anlage: Name im Befund und Schlüssel in den Optionen
LISTS = (
    ("alarm", CONF_WORKFLOWS), ("after", CONF_WORKFLOWS_AFTER), ("armed", CONF_WORKFLOWS_ARMED), ("arming", CONF_WORKFLOWS_ARMING),
    ("entry", CONF_WORKFLOWS_ENTRY), ("disarmed", CONF_WORKFLOWS_DISARMED), ("report", CONF_WORKFLOWS_REPORT),
)
SOUND_STEPS = ("sound", "chime", "dechime", "prealarm")
# Teile, deren Start scheitern kann, ohne dass die Anlage ausfällt (__init__._isolated)
PARTS = ("stats", "reception", "events", "recordings", "workflow", "monitor", "maintenance", "auto_backup", "healthcheck")
ENTITY_ID = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
NOT_LOADED = (ConfigEntryState.SETUP_ERROR, ConfigEntryState.SETUP_RETRY, ConfigEntryState.MIGRATION_ERROR, ConfigEntryState.FAILED_UNLOAD)
# Felder, die ein Befund tragen darf (alles andere fällt beim Lesen der Ablage weg); nur Kennungen, Namen und Zeiten
FIELDS = ("entity_id", "role", "reason", "since", "service", "sound", "name", "part", "label", "first", "last")
PLACE_FIELDS = ("area", "list", "trigger", "step", "sub", "id", "name", "flow", "kind", "group", "type", "mode", "test", "monitor")
MAX_TARGETS = 10
ISSUE_LINES = 10  # so viele Zeilen in einer Meldung unter "Reparaturen" und in der Push-Meldung, der Rest als "… und N weitere"
ISSUE_GLOBAL = "selftest_global"


def _issue_id(entry_id: str) -> str:
    return f"selftest_{entry_id}"


def _key(entry_id: str | None, code: str, subject: str) -> str:
    return f"{entry_id or '*'}|{code}|{subject}"


# ----- Prüfung der Konfiguration -----


# Was der Selbsttest geprüft hat (Wunsch des Nutzers 2026-11-19: "Liste aller geprüften Entitäten", damit man sieht, dass alles geprüft wird):
# Art, Kennung, Rolle, je Eintrag einmal, mit den Anlagen, die ihn verwenden. Arten: Entität, Aktion (Dienst), Empfänger.
CHECKED_TYPES = ("entity", "service", "recipient")
CHECKED_ROLES = ("sensor", "watch", "output", "player", "trigger", "")
CHECKED_MAX = 2000
# Befunde, die einen geprüften Eintrag betreffen (dann steht er nicht grün in der Liste)
CHECKED_PROBLEMS = {"entity": ("entity_missing", "entity_unavailable"), "service": ("service_missing",), "recipient": ("recipient_missing",)}


class _Collector:
    """Sammelt die Befunde einer Anlage (oder der gemeinsamen Einstellungen): ein Befund je Ursache, mit allen Fundstellen."""

    def __init__(self, hass: HomeAssistant, entry_id: str | None, now: datetime, checked: dict[str, dict[str, Any]] | None = None) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.now = now
        self.registry = er.async_get(hass)
        self.items: dict[str, dict[str, Any]] = {}
        self.sound_places: list[dict[str, Any]] = []
        self.checked = checked if checked is not None else {}

    def seen(self, kind: str, ident: str, role: str = "") -> None:
        """Geprüft (unabhängig vom Ergebnis): für die Liste "Geprüft" im Fenster des Selbsttests."""
        key = f"{kind}|{ident}"
        item = self.checked.get(key)
        if item is None:
            if len(self.checked) >= CHECKED_MAX:
                return
            item = self.checked[key] = {"type": kind, "id": ident, "role": role, "entries": []}
        if self.entry_id and self.entry_id not in item["entries"]:
            item["entries"].append(self.entry_id)

    def add(self, code: str, subject: str, place: dict[str, Any] | None, **fields: Any) -> None:
        key = _key(self.entry_id, code, subject)
        item = self.items.get(key)
        if item is None:
            item = self.items[key] = {"key": key, "kind": "config", "code": code, "entry_id": self.entry_id, "subject": subject, **fields, "places": []}
        if place is not None and place not in item["places"] and len(item["places"]) < SELFTEST_MAX_PLACES:
            item["places"].append(place)

    def entity(self, entity_id: Any, place: dict[str, Any], role: str, unavailable: bool = True) -> None:
        """Fehlt die Entität (gelöscht, umbenannt, deaktiviert) oder ist sie seit SELFTEST_GRACE nicht erreichbar?"""
        if not isinstance(entity_id, str) or not ENTITY_ID.match(entity_id):
            return
        self.seen("entity", entity_id, role)
        state = self.hass.states.get(entity_id)
        if state is None:
            reg = self.registry.async_get(entity_id)
            reason = "deleted" if reg is None else "disabled" if reg.disabled_by else "no_state"
            self.add("entity_missing", entity_id, place, entity_id=entity_id, role=role, reason=reason)
        elif unavailable and state.state == STATE_UNAVAILABLE and self.now - state.last_changed >= timedelta(seconds=SELFTEST_GRACE):
            self.add("entity_unavailable", entity_id, place, entity_id=entity_id, role=role, since=state.last_changed.isoformat())

    def service(self, service: Any, place: dict[str, Any]) -> None:
        name = str(service or "")
        if name:
            self.seen("service", name)
        domain, _, action = name.partition(".")
        if not domain or not action or not self.hass.services.has_service(domain, action):
            self.add("service_missing", name, place, service=name)

    def recipients(self, targets: Any, place: dict[str, Any], default: list[str] | None, persistent: bool = False) -> None:
        """
        Eigene Empfänger, die es nicht gibt; ohne eigene und ohne Standard-Empfänger (`default`) geht die Meldung nirgends hin. `default`
        None: nur die eigenen prüfen (die Standard-Empfänger prüft check_global).
        """
        own = [t for t in targets or [] if isinstance(t, str)] if isinstance(targets, list) else []
        for target in own:
            self.seen("recipient", target)
            if not _notify_exists(self.hass, target):
                self.add("recipient_missing", target, place, service=target)
        if not own and default is not None and not default and not persistent:
            self.add("no_recipients", "", place)


def _notify_exists(hass: HomeAssistant, target: str) -> bool:
    domain, _, service = target.partition(".")
    return bool(domain and service) and hass.services.has_service(domain, service)


def _sound_ok(hass: HomeAssistant, sound: Any) -> bool:
    if sound in ALL_SOUNDS:
        return True
    if isinstance(sound, str) and re.match(CUSTOM_SOUND_ID_RE, sound):
        registry = hass.data.get(DATA_CUSTOM_SOUNDS)
        return bool(registry is not None and registry.length(sound))
    return False


def _has_url(hass: HomeAssistant) -> bool:
    """Wie workflow._base_url: die interne Adresse, sonst jede bekannte."""
    for kwargs in ({"allow_external": False, "prefer_external": False}, {}):
        try:
            get_url(hass, **kwargs)
            return True
        except NoURLAvailableError:
            continue
    return False


def _step_targets(step: dict[str, Any]) -> list[str]:
    """Geräte, die ein Schritt "Gerät schalten" anspricht: das Ziel und eine Entität in den Daten (selbst eingetragen)."""
    out = [t for t in step.get("target") or [] if isinstance(t, str)]
    extra = (step.get("data") or {}).get("entity_id") if isinstance(step.get("data"), dict) else None
    for item in [extra] if isinstance(extra, str) else extra if isinstance(extra, list) else []:
        if isinstance(item, str) and item not in out:
            out.extend(x.strip() for x in item.split(",") if x.strip())
    return [t for t in out if ENTITY_ID.match(t)]


def _workflow_steps(options: Any, active: set[str]) -> Iterator[tuple[dict[str, Any], dict[str, Any]]]:
    """Alle Schritte aller Listen der Aktionen (die Schritte von Gruppen eingeschlossen), nur für Auslöser, die laufen können."""
    for name, key in LISTS:
        per = options.get(key)
        if not isinstance(per, dict):
            continue
        for trigger, steps in per.items():
            if trigger not in active or not isinstance(steps, list):
                continue
            for index, step in enumerate(steps, 1):
                if not isinstance(step, dict):
                    continue
                if step.get("type") != "group":
                    yield step, {"area": "workflow", "list": name, "trigger": trigger, "step": index}
                    continue
                for sub, inner in enumerate(step.get("steps") or [], 1):
                    if isinstance(inner, dict) and inner.get("type") not in GROUP_EXCLUDED:
                        yield inner, {"area": "workflow", "list": name, "trigger": trigger, "step": index, "sub": sub}


def _check_step(c: _Collector, step: dict[str, Any], place: dict[str, Any], default_targets: list[str]) -> None:
    kind = step.get("type")
    if kind == "action":
        c.service(step.get("action"), place)
        for entity_id in _step_targets(step):
            c.entity(entity_id, place, "output")
    elif kind in SOUND_STEPS:
        c.sound_places.append(place)
        for player in step.get("players") or []:
            c.entity(player, place, "player")
        sound = step.get("sound")
        if sound is not None and not _sound_ok(c.hass, sound):
            c.add("sound_missing", str(sound), place, sound=str(sound))
    elif kind == "notify":
        c.recipients(step.get("targets"), place, default_targets)


def _leaves(tree: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in (tree or {}).get("items") or [] if isinstance(tree, dict) else []:
        if isinstance(item, dict) and "items" in item:
            out.extend(_leaves(item))
        elif isinstance(item, dict):
            out.append(item)
    return out


def check_entry(hass: HomeAssistant, entry: ConfigEntry, cfg: dict[str, Any], now: datetime, checked: dict[str, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Befunde einer geladenen Anlage; `checked` sammelt, was geprüft wurde."""
    runtime = entry.runtime_data
    ctl = runtime.controller
    options = entry.options
    c = _Collector(hass, entry.entry_id, now, checked)
    alarm_sensors = ctl.all_sensors()
    # Was die Wartung schon als "nicht erreichbar" meldet: dort nur "fehlt"
    maintained = alarm_sensors | ctl.monitor_sensors()
    for sensor in sorted(alarm_sensors):
        c.entity(sensor, {"area": "sensors"}, "sensor", unavailable=False)
    for sensor in sorted(ctl.monitor_sensors()):
        c.entity(sensor, {"area": "sensors", "monitor": True}, "sensor", unavailable=False)

    active = set(ctl.modes) | ({WORKFLOW_ALWAYS} if ctl.always_enabled else set())
    alarm_targets = list(cfg.get("alarm_targets") or [])
    for step, place in _workflow_steps(options, active):
        _check_step(c, step, place, alarm_targets)
    # Eigene Meldung "Alarm endet" und die festen Meldungen des Reiters Aktionen: nur eigene Empfänger (ohne gilt die Gruppe oben)
    end = options.get(CONF_WORKFLOW_END)
    for trigger, value in (end.items() if isinstance(end, dict) else ()):
        own = value.get("notify") if isinstance(value, dict) else None
        if trigger in active and isinstance(own, dict) and own.get("enabled") and value.get("send", True) is not False:
            c.recipients(own.get("targets"), {"area": "end", "trigger": trigger}, None)
    notices = options.get(CONF_EVENT_NOTIFY)
    for trigger, kinds in (notices.items() if isinstance(notices, dict) else ()):
        if trigger not in active or not isinstance(kinds, dict):
            continue
        for kind, notice in kinds.items():
            if isinstance(notice, dict) and notice.get("enabled") is True:
                c.recipients(notice.get("targets"), {"area": "event", "trigger": trigger, "kind": kind}, alarm_targets, bool(notice.get("persistent")))

    maintenance_targets = list(cfg.get("maintenance_targets") or [])
    if ctl.monitor_enabled:
        damaged = set(getattr(runtime.monitor, "damaged", ()) or ())
        for rule in options.get(CONF_MONITORS) or []:
            if not isinstance(rule, dict) or not rule.get("enabled", True):
                continue
            base = {"area": "monitor", "id": str(rule.get("id", "")), "name": str(rule.get("name", ""))}
            if base["id"] in damaged:
                c.add("rule_damaged", f"monitor:{rule.get('id')}", base, name=base["name"])
            for leaf in _leaves(rule.get("tree")):
                if leaf.get("kind") in ("value", "state"):
                    c.entity(leaf.get("entity_id"), base, "watch", unavailable=leaf.get("entity_id") not in maintained)
            for flow in ("out", "ok"):
                for index, step in enumerate(rule.get(f"steps_{flow}") or [], 1):
                    if isinstance(step, dict):
                        _check_step(c, step, {**base, "flow": flow, "step": index}, maintenance_targets)

    damaged_routines = set(getattr(getattr(runtime, "routines", None), "damaged", ()) or ())
    for routine in options.get(CONF_ROUTINES) or []:
        if not isinstance(routine, dict) or not routine.get("enabled", True):
            continue
        place = {"area": "routine", "id": str(routine.get("id", "")), "name": str(routine.get("name", ""))}
        if place["id"] in damaged_routines:
            c.add("rule_damaged", f"routine:{routine.get('id')}", place, name=place["name"])
        trigger = routine.get("trigger")
        if isinstance(trigger, dict) and trigger.get("type") == "device":
            for leaf in _leaves(trigger.get("tree")):
                if leaf.get("kind") in ("state", "event"):
                    c.entity(leaf.get("entity_id"), place, "trigger", unavailable=leaf.get("entity_id") not in maintained)

    if c.sound_places and not _has_url(hass):
        for place in c.sound_places:
            c.add("no_url", "", place)
    return list(c.items.values())


def check_global(hass: HomeAssistant, cfg: dict[str, Any], now: datetime, checked: dict[str, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Befunde für alle Anlagen: Empfänger der Benachrichtigungen, Anlagen, die nicht geladen werden konnten."""
    c = _Collector(hass, None, now, checked)
    for group in ("alarm", "maintenance"):
        for target in cfg.get(f"{group}_targets") or []:
            if isinstance(target, str) and not _notify_exists(hass, target):
                c.add("recipient_missing", target, {"area": "notify", "group": group}, service=target)
    for kind, item in (cfg.get("types") or {}).items():
        if kind in NOTIFY_TYPES and isinstance(item, dict) and item.get("enabled"):
            for target in item.get("targets") or []:
                if isinstance(target, str) and not _notify_exists(hass, target):
                    c.add("recipient_missing", target, {"area": "notify", "type": kind}, service=target)
    if cfg.get("per_mode"):
        for mode, kinds in (cfg.get("modes") or {}).items():
            for kind, own in (kinds.items() if isinstance(kinds, dict) and mode in MODES else ()):
                for target in (own.get("targets") or []) if isinstance(own, dict) else []:
                    if isinstance(target, str) and not _notify_exists(hass, target):
                        c.add("recipient_missing", target, {"area": "notify", "type": kind, "mode": mode}, service=target)
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state in NOT_LOADED and not entry.disabled_by:
            c.add("system_not_loaded", entry.entry_id, None, name=entry.title)
    return list(c.items.values())


# ----- Ablage -----


def _clean_place(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    out = {k: v for k, v in value.items() if k in PLACE_FIELDS and isinstance(v, (str, int, bool)) and (not isinstance(v, str) or len(v) <= 100)}
    return out or None


def _clean_problem(key: Any, value: Any, kind: str) -> dict[str, Any] | None:
    """
    Ein abgelegter Befund, einzeln geprüft: ein beschädigter Eintrag fällt weg, nie die ganze Ablage. Laufzeitbefunde bleiben, bis sie behoben
    oder erledigt sind; die Befunde der Konfiguration gelten bis zur nächsten Prüfung (so zeigen Panel und Entität nach einem Neustart oder
    dem Neuladen einer Anlage nicht kurz "alles in Ordnung").
    """
    codes = RUNTIME_CODES if kind == "runtime" else CONFIG_CODES
    if not isinstance(key, str) or not isinstance(value, dict) or value.get("code") not in codes:
        return None
    entry_id = value.get("entry_id")
    subject = value.get("subject")
    if (entry_id is not None and not isinstance(entry_id, str)) or not isinstance(subject, str) or key != _key(entry_id, value["code"], subject):
        return None
    if kind == "runtime" and (not isinstance(value.get("first"), str) or dt_util.parse_datetime(value["first"]) is None):
        return None
    out: dict[str, Any] = {"key": key, "kind": kind, "code": value["code"], "entry_id": entry_id, "subject": subject}
    out.update({k: value[k] for k in FIELDS if isinstance(value.get(k), str) and len(value[k]) <= 300})
    if kind == "runtime":
        out["last"] = out.get("last") or out["first"]
        count = value.get("count")
        out["count"] = count if isinstance(count, int) and not isinstance(count, bool) and count > 0 else 1
    targets = value.get("targets")
    if isinstance(targets, list):
        out["targets"] = [t for t in targets if isinstance(t, str)][:MAX_TARGETS]
    places = value.get("places") if isinstance(value.get("places"), list) else []
    out["places"] = [p for p in map(_clean_place, places) if p][:SELFTEST_MAX_PLACES]
    return out


# ----- Der Selbsttest -----


class SelfTest:
    """Eine Instanz für alle Anlagen (hass.data[DATA_SELFTEST])."""

    def __init__(self, hass: HomeAssistant, settings: Any) -> None:
        self.hass = hass
        self._settings = settings
        self._store = Store(hass, 1, SELFTEST_STORE_KEY)
        self.last: str | None = None  # letzte Prüfung (UTC, ISO)
        self.config: dict[str, dict[str, Any]] = {}  # Befunde der Konfiguration aus der letzten Prüfung
        self.incidents: dict[str, dict[str, Any]] = {}  # Laufzeitbefunde, bis behoben oder erledigt
        self.reported: dict[str, str] = {}  # Befund -> Zeit der Meldung (je Befund einmal)
        self.checked: list[dict[str, Any]] = []  # was die letzte Prüfung geprüft hat (Liste "Geprüft" im Panel)
        self._unsubs: list[CALLBACK_TYPE] = []
        self._soon: CALLBACK_TYPE | None = None
        self._flush_timer: CALLBACK_TYPE | None = None
        self._report_timer: CALLBACK_TYPE | None = None
        self._issues: set[str] = set()
        self.started = False

    # -- Lebenszyklus --

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if not isinstance(stored, dict):
            return
        last = stored.get("last")
        if isinstance(last, str) and dt_util.parse_datetime(last) is not None:
            self.last = last
        for name, target, kind in (("incidents", self.incidents, "runtime"), ("config", self.config, "config")):
            items = stored.get(name)
            for key, value in (items.items() if isinstance(items, dict) else ()):
                if (item := _clean_problem(key, value, kind)) is not None:
                    target[key] = item
        reported = stored.get("reported")
        for key, value in (reported.items() if isinstance(reported, dict) else ()):
            if isinstance(key, str) and isinstance(value, str):
                self.reported[key] = value
        # Geprüftes der letzten Prüfung: jeder Eintrag einzeln geprüft, ein beschädigter fällt weg
        for value in (stored.get("checked") if isinstance(stored.get("checked"), list) else [])[:CHECKED_MAX]:
            if (not isinstance(value, dict) or value.get("type") not in CHECKED_TYPES or value.get("role", "") not in CHECKED_ROLES
                    or not isinstance(value.get("id"), str) or not 0 < len(value["id"]) <= 255 or not isinstance(value.get("ok"), bool)):
                continue
            entries = [e for e in value.get("entries") or [] if isinstance(e, str)][:20] if isinstance(value.get("entries"), list) else []
            self.checked.append({"type": value["type"], "id": value["id"], "role": value.get("role", ""), "entries": entries, "ok": value["ok"]})

    @callback
    def async_start(self) -> None:
        """Takt und erste Prüfung. Ein zweiter Aufruf (eine Anlage lädt nach dem Speichern neu) prüft kurz danach erneut."""
        if self.started:
            if self.hass.state is CoreState.running:
                self.async_schedule()
            return
        self.started = True
        self._unsubs.append(async_track_time_interval(self.hass, self._tick, timedelta(seconds=SELFTEST_TICK)))
        # Beim Start von Home Assistant verbinden sich die Geräte erst; läuft HA schon (neue Anlage, Neuladen), reicht ein kurzer Aufschub
        delay = SELFTEST_SOON if self.hass.state is CoreState.running else SELFTEST_START_DELAY
        self._unsubs.append(async_call_later(self.hass, delay, self._run_later))

    async def async_stop(self) -> None:
        for unsub in [*self._unsubs, *(t for t in (self._soon, self._flush_timer, self._report_timer) if t is not None)]:
            unsub()
        self._unsubs.clear()
        self._soon = self._flush_timer = self._report_timer = None
        self.started = False
        await self.async_save()

    async def async_save(self) -> None:
        await self._store.async_save(self._data())

    @callback
    def async_remove_issues(self) -> None:
        """Die letzte Anlage ist entfernt: auch ihre Meldungen unter "Reparaturen"."""
        for issue_id in {*self._issues, ISSUE_GLOBAL}:
            ir.async_delete_issue(self.hass, DOMAIN, issue_id)
        self._issues.clear()

    def _data(self) -> dict[str, Any]:
        return {"last": self.last, "config": self.config, "incidents": self.incidents, "reported": self.reported, "checked": self.checked}

    def checked_payload(self) -> dict[str, Any]:
        """Liste "Geprüft" der letzten Prüfung für das Panel (auf Abruf, nicht in jeder Antwort `data`): mit den Namen, wie HA sie zeigt."""
        known = {e.entry_id for e in self.hass.config_entries.async_entries(DOMAIN)}
        items = []
        for item in self.checked:
            entries = [e for e in item["entries"] if e in known]
            if item["entries"] and not entries:
                continue  # nur von einer entfernten Anlage verwendet
            name = display_name(self.hass, item["id"]) if item["type"] == "entity" else item["id"]
            items.append({**item, "entries": entries, "name": name})
        return {"last": self.last, "items": items}

    def _setting(self, key: str, default: int) -> int:
        value = (self._settings.notify or {}).get(key, default)
        return max(SELFTEST_MINUTES_RANGE[0], min(SELFTEST_MINUTES_RANGE[1], value)) if isinstance(value, int) and not isinstance(value, bool) else default

    def armed(self) -> bool:
        return any_armed(self.hass)

    @property
    def minutes(self) -> int:
        """
        Abstand in Minuten, der gerade gilt (Wunsch des Nutzers 2026-11-19): ist eine Anlage scharf, der für "scharf", sonst der für "nicht
        scharf". Seit 1.67.0 in Minuten (5 bis 1440), vorher in Stunden.
        """
        return self._setting("selftest_minutes_armed", 60) if self.armed() else self._setting("selftest_minutes", 360)

    def due(self, now: datetime | None = None) -> bool:
        last = dt_util.parse_datetime(self.last) if self.last else None
        return last is None or (now or dt_util.utcnow()) - last >= timedelta(minutes=self.minutes)

    @callback
    def _tick(self, now: Any = None) -> None:
        if self.due():
            self.async_run()

    @callback
    def _run_later(self, _now: Any = None) -> None:
        self._soon = None
        self.async_run()

    @callback
    def async_schedule(self, delay: float = SELFTEST_SOON) -> None:
        """Kurz nach dem Speichern prüfen; mehrere Speichervorgänge kurz hintereinander ergeben eine Prüfung."""
        if self._soon is not None:
            self._soon()
        self._soon = async_call_later(self.hass, delay, self._run_later)

    # -- Prüfung --

    @callback
    def async_run(self) -> dict[str, Any]:
        """Alle Anlagen prüfen (nur lesen, schnell, ohne Warten) und die Befunde überall nachführen."""
        now = dt_util.utcnow()
        cfg = self._settings.notify
        found: dict[str, dict[str, Any]] = {}
        checked: dict[str, dict[str, Any]] = {}
        entries = self.hass.config_entries.async_entries(DOMAIN)
        for entry in entries:
            if entry.state is not ConfigEntryState.LOADED:
                continue
            try:
                for item in check_entry(self.hass, entry, cfg, now, checked):
                    found[item["key"]] = item
            except Exception:  # noqa: BLE001 - eine Anlage, die sich nicht prüfen lässt, hält die Prüfung der anderen nie auf
                _LOGGER.exception("%s: the self-test could not check this alarm system", entry.title)
        try:
            for item in check_global(self.hass, cfg, now, checked):
                found[item["key"]] = item
        except Exception:  # noqa: BLE001
            _LOGGER.exception("The self-test could not check the notification settings")
        # Laufzeitbefunde entfernter Anlagen sind erledigt
        known = {e.entry_id for e in entries}
        for key in [k for k, v in self.incidents.items() if v.get("entry_id") and v["entry_id"] not in known]:
            del self.incidents[key]
        self.config = found
        bad = {(kind, p["subject"]) for kind, codes in CHECKED_PROBLEMS.items() for p in found.values() if p.get("code") in codes}
        self.checked = [{**item, "ok": (item["type"], item["id"]) not in bad} for item in checked.values()]
        self.last = now.isoformat()
        self._flush()
        self._report()
        return self.payload()

    # -- Laufzeit --

    @callback
    def note(self, entry_id: str | None, code: str, subject: str, place: dict[str, Any] | None, fields: dict[str, Any]) -> None:
        key = _key(entry_id, code, subject)
        now = dt_util.utcnow().isoformat()
        item = self.incidents.get(key)
        new = item is None
        if item is None:
            if len(self.incidents) >= SELFTEST_MAX_INCIDENTS:
                del self.incidents[min(self.incidents, key=lambda k: self.incidents[k].get("last") or "")]
            item = self.incidents[key] = {"key": key, "kind": "runtime", "code": code, "entry_id": entry_id, "subject": subject, "first": now, "count": 0, "places": []}
        item["count"] += 1
        item["last"] = now
        for name, value in fields.items():
            if name in FIELDS and isinstance(value, str):
                item[name] = value[:300]
            elif name == "targets" and isinstance(value, list):
                item["targets"] = [t for t in value if isinstance(t, str)][:MAX_TARGETS]
        clean = _clean_place(place)
        if clean is not None and clean not in item["places"]:
            item["places"] = [*item["places"], clean][-SELFTEST_MAX_PLACES:]
        self._changed()
        if new:
            # Neue Befunde gesammelt melden (mehrere Geräte scheitern oft zugleich)
            if self._report_timer is not None:
                self._report_timer()
            self._report_timer = async_call_later(self.hass, SELFTEST_REPORT_DELAY, self._report_later)

    @callback
    def resolve(self, entry_id: str | None, code: str, subject: str) -> None:
        if self.incidents.pop(_key(entry_id, code, subject), None) is not None:
            self._changed()

    @callback
    def dismiss(self, key: str) -> bool:
        """Im Panel als erledigt markiert; nur Laufzeitbefunde (ein Befund der Konfiguration verschwindet, wenn er behoben ist)."""
        if self.incidents.pop(key, None) is None:
            return False
        self.reported.pop(key, None)
        self._flush()
        return True

    @callback
    def _report_later(self, _now: Any = None) -> None:
        self._report_timer = None
        self._report()

    @callback
    def _changed(self) -> None:
        """Ablage, Entitäten und Reparaturen gesammelt nachführen (ein Alarm mit vielen Aufrufen schreibt nicht bei jedem)."""
        if self._flush_timer is None:
            self._flush_timer = async_call_later(self.hass, 1, self._flush_later)

    @callback
    def _flush_later(self, _now: Any = None) -> None:
        self._flush_timer = None
        self._flush()

    @callback
    def _flush(self) -> None:
        self._store.async_delay_save(self._data, 2)
        try:
            self._update_issues()
        except Exception:  # noqa: BLE001 - "Reparaturen" sind Zusatz
            _LOGGER.exception("The self-test could not update the repair issues")
        async_dispatcher_send(self.hass, SIGNAL_SELFTEST)

    # -- Ausgabe --

    def problems(self) -> list[dict[str, Any]]:
        """Alle Befunde: Konfiguration, dann Laufzeit; je Anlage zusammen, die gemeinsamen zuletzt."""
        titles = {e.entry_id: e.title.lower() for e in self.hass.config_entries.async_entries(DOMAIN)}
        # Eine entfernte Anlage hat keine Befunde mehr (auch nicht bis zur nächsten Prüfung)
        items = [p for p in (*self.config.values(), *self.incidents.values()) if p.get("entry_id") is None or p["entry_id"] in titles]
        return sorted(items, key=lambda p: (p.get("entry_id") is None, titles.get(p.get("entry_id") or "", ""), p["kind"] != "config", p["code"], p["subject"]))

    def for_entry(self, entry_id: str) -> list[dict[str, Any]]:
        """Befunde, die eine Anlage betreffen: ihre eigenen und die für alle Anlagen."""
        return [p for p in self.problems() if p.get("entry_id") in (entry_id, None)]

    def payload(self) -> dict[str, Any]:
        last = dt_util.parse_datetime(self.last) if self.last else None
        return {
            "last": self.last,
            "next": (last + timedelta(minutes=self.minutes)).isoformat() if last else None,
            "minutes": self.minutes,
            "minutes_disarmed": self._setting("selftest_minutes", 360),
            "minutes_armed": self._setting("selftest_minutes_armed", 60),
            "armed": self.armed(),
            # Anzahl geprüfter Einträge der letzten Prüfung (die Liste selbst auf Abruf: selftest_checked)
            "checked": len(self.checked),
            "problems": [{k: v for k, v in p.items()} for p in self.problems()],
        }

    def _system(self, entry_id: str | None) -> str:
        from .notify import text  # noqa: PLC0415 - notify meldet sich selbst beim Selbsttest (Kreis vermeiden)

        if entry_id is None:
            return text(self.hass, "selftest_all")
        entry = self.hass.config_entries.async_get_entry(entry_id)
        return entry.title if entry is not None else entry_id

    def line(self, problem: dict[str, Any]) -> str:
        """Eine Zeile für die Push-Meldung und die Reparaturen (Sprache von Home Assistant)."""
        from .notify import text  # noqa: PLC0415

        code = problem["code"]
        key = "step_timeout" if code == "step_failed" and problem.get("reason") == "timeout" else code
        entity = problem.get("entity_id")
        name = display_name(self.hass, entity) if entity else str(problem.get("name") or problem.get("subject") or "")
        return text(self.hass, f"st_{key}", system=self._system(problem.get("entry_id")), name=name, service=problem.get("service") or "",
                    label=problem.get("label") or "", part=problem.get("part") or "")

    def _lines(self, problems: list[dict[str, Any]]) -> str:
        from .notify import text  # noqa: PLC0415

        lines = [f"- {self.line(p)}" for p in problems[:ISSUE_LINES]]
        if len(problems) > ISSUE_LINES:
            lines.append(text(self.hass, "selftest_more", count=len(problems) - ISSUE_LINES))
        return "\n".join(lines)

    @callback
    def _update_issues(self) -> None:
        """Je Anlage eine Meldung unter "Reparaturen" (nur ihre eigenen Befunde), dazu eine für alle Anlagen."""
        problems = self.problems()
        wanted: dict[str, tuple[str, dict[str, str]]] = {}
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            own = [p for p in problems if p.get("entry_id") == entry.entry_id]
            if own and entry.state is ConfigEntryState.LOADED:
                wanted[_issue_id(entry.entry_id)] = ("selftest", {"name": entry.title, "count": str(len(own)), "problems": self._lines(own)})
        common = [p for p in problems if p.get("entry_id") is None]
        if common:
            wanted[ISSUE_GLOBAL] = ("selftest_global", {"count": str(len(common)), "problems": self._lines(common)})
        for issue_id, (translation_key, placeholders) in wanted.items():
            ir.async_create_issue(self.hass, DOMAIN, issue_id, is_fixable=False, is_persistent=False, severity=ir.IssueSeverity.WARNING,
                                  translation_key=translation_key, translation_placeholders=placeholders)
        # Erledigt: auch Meldungen aus der Zeit vor einem Neuladen (eine neue Instanz kennt sie nicht) und von entfernten Anlagen
        known = {_issue_id(e.entry_id) for e in self.hass.config_entries.async_entries(DOMAIN)}
        for issue_id in (self._issues | known | {ISSUE_GLOBAL}) - set(wanted):
            ir.async_delete_issue(self.hass, DOMAIN, issue_id)
        self._issues = set(wanted)

    @callback
    def _report(self) -> None:
        """Neue Befunde einmal an die Empfänger der Meldungsart "Selbsttest" (wie die Wartung: nur gemerkt, was wirklich hinausging)."""
        from .notify import async_persist, async_send, build_payload, text  # noqa: PLC0415

        problems = self.problems()
        keys = {p["key"] for p in problems}
        changed = False
        for key in [k for k in self.reported if k not in keys]:
            del self.reported[key]  # behoben: kommt er wieder, meldet er sich neu
            changed = True
        cfg = self._settings.notify
        setting = cfg["types"].get("selftest") or {}
        # Ein gescheitertes Lebenszeichen meldet seit 1.68.0 die eigene Meldung "HealthCheck-Dienst antwortet nicht" (nach der eingestellten Zahl
        # gescheiterter Aufrufe, mit "antwortet wieder"); hier nicht noch einmal. Im Selbsttest und in der Statuskachel bleibt es ein Problem.
        new = [p for p in problems if p["key"] not in self.reported and p.get("code") != "ping_failed"]
        if new and setting.get("enabled"):
            targets = list(setting.get("targets") or cfg["maintenance_targets"])
            if targets or setting.get("persistent"):
                title = text(self.hass, "selftest_title_one") if len(new) == 1 else text(self.hass, "selftest_title", count=len(new))
                message = self._lines(new).replace("- ", "", 1) if len(new) == 1 else self._lines(new)
                try:
                    async_persist(self.hass, cfg, "selftest", title, message, "alarmageddon_selftest")
                except Exception:  # noqa: BLE001 - die Benachrichtigung in Home Assistant ist Zusatz
                    _LOGGER.exception("The self-test could not create the persistent notification")
                payload = build_payload(cfg, "selftest", title, message, tag="alarmageddon_selftest")
                if async_send(self.hass, targets, payload) or setting.get("persistent"):
                    stamp = dt_util.utcnow().isoformat()
                    for problem in new:
                        self.reported[problem["key"]] = stamp
                    changed = True
        if changed:
            self._store.async_delay_save(self._data, 2)


# ----- Einstieg von aussen: nie ein Fehler, nie ein Warten -----


@callback
def async_note(hass: HomeAssistant, entry_id: str | None, code: str, subject: str, *, place: dict[str, Any] | None = None, **fields: Any) -> None:
    """
    Laufzeitbefund festhalten (Aufruf gescheitert, Wächter griff ein, Meldung ging nicht hinaus, Teil startete nicht). Läuft mitten im Alarm:
    synchron, ohne Warten, und ein Fehler bleibt hier (Sicherheitsregel: nichts, was mitläuft, hält die Alarmaktionen auf).
    """
    try:
        if (selftest := hass.data.get(DATA_SELFTEST)) is not None:
            selftest.note(entry_id, code, subject, place, fields)
    except Exception:  # noqa: BLE001 - der Selbsttest hält nie etwas auf
        _LOGGER.exception("The self-test could not record a problem")


@callback
def async_resolve(hass: HomeAssistant, entry_id: str | None, code: str, subject: str) -> None:
    """Derselbe Aufruf hat wieder geklappt: der Laufzeitbefund ist behoben. Günstig (ein Nachschlagen), nie ein Fehler."""
    try:
        if (selftest := hass.data.get(DATA_SELFTEST)) is not None and selftest.incidents:
            selftest.resolve(entry_id, code, subject)
    except Exception:  # noqa: BLE001
        _LOGGER.exception("The self-test could not clear a problem")


def any_armed(hass: HomeAssistant) -> bool:
    """
    Ist eine Anlage scharf? Jeder Zustand ausser "deaktiviert" zählt (Ausgangsverzögerung, scharf, Eingangsverzögerung, Alarm). Für den kürzeren
    Abstand des Selbsttests (1.66.0, Wunsch des Nutzers 2026-11-19; die Lebenszeichen behalten ein Intervall, Entscheid des Nutzers am selben Tag); nie
    ein Fehler (im Zweifel "nicht scharf", der längere Abstand gilt).
    """
    try:
        for entry in hass.config_entries.async_entries(DOMAIN):
            controller = getattr(getattr(entry, "runtime_data", None), "controller", None) if entry.state is ConfigEntryState.LOADED else None
            if controller is not None and controller.state != AlarmControlPanelState.DISARMED:
                return True
    except Exception:  # noqa: BLE001
        _LOGGER.exception("The self-test could not read the state of the alarm systems")
    return False


def call_subject(service: str, targets: Any) -> str:
    """Gleicher Schlüssel für denselben Aufruf (Dienst und Geräte), ob er scheitert oder klappt."""
    items = [targets] if isinstance(targets, str) else [t for t in targets or [] if isinstance(t, str)] if isinstance(targets, (list, tuple, set)) else []
    return f"{service}|{','.join(sorted(items))}" if items else service


def call_targets(targets: Any) -> list[str]:
    items = [targets] if isinstance(targets, str) else [t for t in targets or [] if isinstance(t, str)] if isinstance(targets, (list, tuple, set)) else []
    return sorted(items)[:MAX_TARGETS]


async def async_get_selftest(hass: HomeAssistant, settings: Any) -> SelfTest:
    """Die eine Instanz (beim Start laden alle Anlagen zugleich: mit Sperre, wie die Einstellungen)."""
    if (selftest := hass.data.get(DATA_SELFTEST)) is not None:
        return selftest
    lock = hass.data.setdefault(DATA_SELFTEST_LOCK, asyncio.Lock())
    async with lock:
        if (selftest := hass.data.get(DATA_SELFTEST)) is None:
            selftest = SelfTest(hass, settings)
            await selftest.async_load()
            hass.data[DATA_SELFTEST] = selftest
    return selftest


async def async_stop_selftest(hass: HomeAssistant, remove: bool = False) -> None:
    if (selftest := hass.data.pop(DATA_SELFTEST, None)) is not None:
        if remove:
            selftest.async_remove_issues()
        await selftest.async_stop()
