"""
Routinen (1.44.0, ersetzen die Zeitpläne): Eine Routine schaltet die Anlage zu einer Zeit oder wenn Geräte von Home Assistant etwas tun (zum Beispiel
ein Smart Lock beim Abschliessen), nur in den Zuständen, die der Nutzer wählt.

Auslöser:
- **Zeitplan:** eine oder mehrere Uhrzeiten mit Wochentagen.
- **Gerät:** ein Bedingungsbaum wie bei Magic Push im Device Panel: Und/Oder, eine Ebene Gruppen, Bedingungen "Gerät ist X" und "Uhrzeit von bis".
  Die Routine läuft, wenn der Baum **neu** zutrifft (nie im Dauerzustand), optional erst, wenn er N Sekunden gilt.

Sicherheitsregeln (Alarmageddon ist ein Sicherheitsprodukt):
- Nur ein **echter Wechsel** zählt: die Rückkehr aus "nicht verfügbar" oder "unbekannt" löst nie aus (sonst deaktivierte ein Funkabriss die Anlage).
  Nach einem Neustart wird nichts nachgeholt.
- Gilt der Zustand der Anlage beim Auslösen nicht für die Routine, wird sie übersprungen und das steht im Protokoll.
- **Deaktivieren** per Routine braucht die Bestätigung in der Routine ("unsafe", Entscheid des Nutzers: kein Schalter der Anlage zusätzlich).
  Scharfschalten gilt nie im Alarm oder in der Eingangsverzögerung.
- Eine Routine löst nie eine andere aus: Entitäten von Alarmageddon sind als Auslöser nicht erlaubt. Je Routine gibt es eine Sperre gegen Doppelauslösung.
- Scharfschalten scheitert wie von Hand an offenen Sensoren ("Scharfschalten nicht möglich" kommt wie gewohnt). Ein Code wird nicht verlangt: Routinen
  richtet ein Administrator ein.
"""

from __future__ import annotations

from datetime import datetime
from functools import partial
import logging
from typing import Any

import voluptuous as vol
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event, async_track_time_change
from homeassistant.util import dt as dt_util

from .const import (
    CONF_ROUTINES,
    CONF_SCHEDULES,
    DOMAIN,
    MAX_ROUTINE_GROUPS,
    MAX_ROUTINE_LEAVES,
    MAX_ROUTINES,
    ROUTINE_COOLDOWN,
    ROUTINE_EVENT_MAX_AGE,
)
from .controller import AlarmController
from .notify import text

_LOGGER = logging.getLogger(__name__)

# Geräte, die als Auslöser taugen, und ihre Zustände (Klartext zeigt das Panel)
LEAF_STATES: dict[str, tuple[str, ...]] = {
    "lock": ("locked", "unlocked", "jammed", "open"),
    "binary_sensor": ("on", "off"),
    "switch": ("on", "off"),
    "input_boolean": ("on", "off"),
    "light": ("on", "off"),
    "cover": ("open", "closed"),
    "person": ("home", "not_home"),
    "device_tracker": ("home", "not_home"),
}
INVALID = (STATE_UNAVAILABLE, STATE_UNKNOWN, None, "")


def state_name(state: AlarmControlPanelState | str) -> str:
    """Zustand der Anlage als Schlüssel der Routinen: arming, armed, pending, triggered, disarmed."""
    value = str(state.value if hasattr(state, "value") else state)
    if value.startswith("armed"):
        return "armed"
    return value


# ----- Prüfung -----


def tree_leaves(tree: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in tree["items"]:
        out.extend(item["items"] if "items" in item else [item])
    return out


def check_routines(hass: HomeAssistant, routines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Was sich nur mit Home Assistant prüfen lässt und die Sicherheit betrifft; wirft vol.Invalid. Der Aufbau ist schon durch schemas.ROUTINES geprüft.
    """
    registry = er.async_get(hass)
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    for routine in routines:
        if routine["id"] in seen_ids or routine["name"].strip().casefold() in seen_names:
            raise vol.Invalid("id and name of a routine must be unique")
        seen_ids.add(routine["id"])
        seen_names.add(routine["name"].strip().casefold())
        action, states = routine["action"], set(routine["states"])
        if action != "off" and states & {"pending", "triggered"}:
            raise vol.Invalid("arming never applies during an entry delay or an alarm")
        if (action == "off" or states & {"pending", "triggered"}) and not routine.get("unsafe"):
            raise vol.Invalid("disarming without a code needs the confirmation")
        trigger = routine["trigger"]
        if trigger["type"] != "device":
            continue
        tree = trigger["tree"]
        groups = [i for i in tree["items"] if "items" in i]
        leaves = tree_leaves(tree)
        if len(groups) > MAX_ROUTINE_GROUPS or len(leaves) > MAX_ROUTINE_LEAVES:
            raise vol.Invalid("too many conditions")
        if any(x["kind"] == "time" and x["from"] == x["to"] for x in leaves):
            raise vol.Invalid("a time window needs two different times")
        device_leaves = [x for x in leaves if x["kind"] in ("state", "event")]
        if not device_leaves:
            raise vol.Invalid("a routine by device needs at least one device condition")
        if trigger.get("hold") and any(x["kind"] == "event" for x in device_leaves):
            raise vol.Invalid("a button press cannot be required to hold")
        for leaf in device_leaves:
            domain = leaf["entity_id"].split(".")[0]
            if leaf["kind"] == "event":
                known = hass.states.get(leaf["entity_id"])
                types = known.attributes.get("event_types") if known is not None else None
                if domain != "event" or (isinstance(types, list) and leaf["event_type"] not in types):
                    raise vol.Invalid("this button or event is not supported")
            elif domain not in LEAF_STATES or leaf["state"] not in LEAF_STATES[domain]:
                raise vol.Invalid("this device or state is not supported")
            entry = registry.async_get(leaf["entity_id"])
            if entry is not None and entry.platform == DOMAIN:
                raise vol.Invalid("a routine cannot be triggered by Alarmageddon itself")
    return routines


# ----- Übernahme der Zeitpläne -----


def migrate_options(options: dict[str, Any], language: str) -> dict[str, Any] | None:
    """
    Bis 1.43 gab es Zeitpläne. Sie werden zu Routinen mit Auslöser Zeitplan, demselben Ziel und den Zuständen, in denen ein Zeitplan lief (nie in der
    Eingangsverzögerung und nie im Alarm): Ausgangsverzögerung, scharf, deaktiviert. Ein Zeitplan, der deaktivierte, trägt die Bestätigung
    ("unsafe"). None: nichts zu tun.
    """
    legacy = options.get(CONF_SCHEDULES)
    if CONF_SCHEDULES not in options:
        return None
    routines = [r for r in options.get(CONF_ROUTINES) or [] if isinstance(r, dict)]
    taken = {str(r.get("name", "")).casefold() for r in routines}
    label = "Zeitplan" if language.startswith("de") else "Schedule"
    for index, rule in enumerate(legacy or []):
        if not isinstance(rule, dict) or not rule.get("time") or not rule.get("days") or len(routines) >= MAX_ROUTINES:
            continue
        name = base = f"{label} {rule['time']}"
        count = 2
        while name.casefold() in taken:
            name = f"{base} ({count})"
            count += 1
        taken.add(name.casefold())
        action = rule.get("action", "off")
        routines.append(
            {
                "id": f"m{index}{str(rule.get('id', ''))}"[:32],
                "name": name,
                "enabled": rule.get("enabled", True),
                "action": action,
                "states": ["arming", "armed", "disarmed"],
                "trigger": {"type": "schedule", "times": [{"time": rule["time"], "days": list(rule["days"])}]},
                "unsafe": action == "off",
            }
        )
    out = {k: v for k, v in options.items() if k != CONF_SCHEDULES}
    out[CONF_ROUTINES] = routines
    return out


# ----- Auswertung -----


def _clock(value: str) -> int:
    return int(value[:2]) * 60 + int(value[3:5])


def time_met(leaf: dict[str, Any], now: datetime) -> bool:
    """Gilt das Zeitfenster jetzt? Über Mitternacht gehört zum Tag, an dem es beginnt; keine Tage: jeden Tag."""
    local = dt_util.as_local(now)
    minute = local.hour * 60 + local.minute
    start, end = _clock(leaf["from"]), _clock(leaf["to"])
    days = leaf.get("days") or []

    def on(day: int) -> bool:
        return not days or day in days

    today = local.weekday()
    if end > start:
        return on(today) and start <= minute < end
    return (on(today) and minute >= start) or (on((today - 1) % 7) and minute < end)


def eval_tree(hass: HomeAssistant, tree: dict[str, Any], now: datetime, pulse: tuple[str, str] | None = None) -> bool | None:
    """Wahr, falsch oder None (nicht beurteilbar: Gerät nicht erreichbar). None zählt nie als erfüllt."""

    def leaf_value(leaf: dict[str, Any]) -> bool | None:
        if leaf["kind"] == "time":
            return time_met(leaf, now)
        if leaf["kind"] == "event":
            # Ein Tastendruck gilt nur im Augenblick, in dem er geschieht (pulse), nie danach
            return pulse == (leaf["entity_id"], leaf["event_type"])
        state = hass.states.get(leaf["entity_id"])
        if state is None or state.state in INVALID:
            return None
        return state.state == leaf["state"]

    def combine(op: str, values: list[bool | None]) -> bool | None:
        if op == "and":
            if any(v is False for v in values):
                return False
            return None if any(v is None for v in values) else True
        if any(v is True for v in values):
            return True
        return None if any(v is None for v in values) else False

    values = [combine(item["op"], [leaf_value(x) for x in item["items"]]) if "items" in item else leaf_value(item) for item in tree["items"]]
    return combine(tree["op"], values)


class RoutineEngine:
    """Hört auf Uhrzeiten und Geräte und schaltet die Anlage; je Anlage eine."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, controller: AlarmController) -> None:
        self.hass = hass
        self.entry = entry
        self._ctl = controller
        self._unsubs: list[CALLBACK_TYPE] = []
        self._last: dict[str, bool] = {}  # zuletzt ausgewerteter Baum je Routine: nur ein Wechsel auf wahr löst aus
        self._holds: dict[str, CALLBACK_TYPE] = {}
        self._fired: dict[str, float] = {}

    @property
    def rules(self) -> list[dict[str, Any]]:
        return [r for r in self.entry.options.get(CONF_ROUTINES) or [] if isinstance(r, dict)]

    @callback
    def async_start(self) -> None:
        for rule in self.rules:
            if not rule.get("enabled", True):
                continue
            trigger = rule.get("trigger") or {}
            try:
                if trigger.get("type") == "schedule":
                    for item in trigger["times"]:
                        hour, minute = (int(x) for x in str(item["time"]).split(":"))
                        self._unsubs.append(async_track_time_change(self.hass, partial(self._on_time, rule, item), hour=hour, minute=minute, second=0))
                elif trigger.get("type") == "device":
                    self._start_device(rule, trigger)
            except (KeyError, ValueError, TypeError):
                _LOGGER.warning("%s: routine '%s' is damaged and does not run", self.entry.title, rule.get("name"))

    def _start_device(self, rule: dict[str, Any], trigger: dict[str, Any]) -> None:
        tree = trigger["tree"]
        leaves = tree_leaves(tree)
        self._last[rule["id"]] = eval_tree(self.hass, tree, dt_util.utcnow()) is True  # beim Start gilt nichts als neu
        entities = sorted({x["entity_id"] for x in leaves if x["kind"] in ("state", "event")})
        if entities:
            self._unsubs.append(async_track_state_change_event(self.hass, entities, partial(self._on_state, rule)))
        # Ein Zeitfenster ändert sich zu seinen Rändern: dort neu auswerten
        for edge in {t for x in leaves if x["kind"] == "time" for t in (x["from"], x["to"])}:
            hour, minute = (int(x) for x in edge.split(":"))
            self._unsubs.append(async_track_time_change(self.hass, partial(self._on_edge, rule), hour=hour, minute=minute, second=0))

    @callback
    def async_stop(self) -> None:
        for unsub in [*self._unsubs, *self._holds.values()]:
            unsub()
        self._unsubs.clear()
        self._holds.clear()

    # -- Zeitplan --

    @callback
    def _on_time(self, rule: dict[str, Any], item: dict[str, Any], now: Any) -> None:
        if dt_util.as_local(now).weekday() in item.get("days", []):
            self.hass.async_create_task(self.async_run(rule))

    # -- Gerät --

    @callback
    def _on_state(self, rule: dict[str, Any], event: Event[EventStateChangedData]) -> None:
        old, new = event.data["old_state"], event.data["new_state"]
        if event.data["entity_id"].startswith("event."):
            self._on_button(rule, old, new)
            return
        # Nur ein echter Wechsel zwischen zwei bekannten Zuständen zählt, nicht die Rückkehr aus "nicht verfügbar" oder "unbekannt"
        real = old is not None and new is not None and old.state not in INVALID and new.state not in INVALID
        self._evaluate(rule, fire=real)

    @callback
    def _on_button(self, rule: dict[str, Any], old: Any, new: Any) -> None:
        """
        Taste oder anderes Ereignis (Entität "event": der Zustand ist der Zeitpunkt des letzten Ereignisses). Es zählt nur ein frisches Ereignis: nach dem
        Neuladen einer Integration kommt der alte Zeitpunkt zurück und darf nie schalten.
        """
        if new is None or new.state in INVALID or (old is not None and old.state == new.state):
            return
        stamp = dt_util.parse_datetime(new.state)
        age = (dt_util.utcnow() - stamp).total_seconds() if stamp is not None else None
        if age is None or abs(age) > ROUTINE_EVENT_MAX_AGE:
            return
        pulse = (new.entity_id, str(new.attributes.get("event_type")))
        if eval_tree(self.hass, rule["trigger"]["tree"], dt_util.utcnow(), pulse) is True:
            self.hass.async_create_task(self.async_run(rule))

    @callback
    def _on_edge(self, rule: dict[str, Any], _now: Any) -> None:
        self._evaluate(rule, fire=True)

    @callback
    def _evaluate(self, rule: dict[str, Any], fire: bool) -> None:
        rid = rule["id"]
        value = eval_tree(self.hass, rule["trigger"]["tree"], dt_util.utcnow()) is True
        was = self._last.get(rid, False)
        self._last[rid] = value
        if not value:
            if (hold := self._holds.pop(rid, None)) is not None:
                hold()
            return
        if was or not fire or rid in self._holds:
            return
        seconds = int(rule["trigger"].get("hold") or 0)
        if seconds > 0:
            self._holds[rid] = async_call_later(self.hass, seconds, partial(self._hold_over, rule))
        else:
            self.hass.async_create_task(self.async_run(rule))

    @callback
    def _hold_over(self, rule: dict[str, Any], _now: Any) -> None:
        self._holds.pop(rule["id"], None)
        # Gilt der Baum noch (er hat sich zwischendurch nicht gelöst), läuft die Routine; sonst hat die Auswertung den Halt schon beendet
        if eval_tree(self.hass, rule["trigger"]["tree"], dt_util.utcnow()) is True:
            self.hass.async_create_task(self.async_run(rule))

    # -- Ausführen --

    async def async_run(self, rule: dict[str, Any]) -> None:
        ctl = self._ctl
        name, action = rule["name"], rule["action"]
        now = dt_util.utcnow().timestamp()
        if now - self._fired.get(rule["id"], 0.0) < ROUTINE_COOLDOWN:
            return  # Doppelauslösung
        current = state_name(ctl.state)
        if current not in rule.get("states", []):
            ctl.emit("routine_skipped", routine=name, action=action, reason="state", at=current)
            return
        if current == "armed" and rule.get("armed_modes") and ctl.mode not in rule["armed_modes"]:
            # "Anlage scharf" gilt nur in den gewählten Modi (zum Beispiel nur abwesend)
            ctl.emit("routine_skipped", routine=name, action=action, reason="armed_mode", at=current)
            return
        by = f"{text(self.hass, 'by_routine')}: {name}"
        self._fired[rule["id"]] = now
        if action == "off":
            if ctl.state != AlarmControlPanelState.DISARMED:
                await ctl.async_disarm(None, by, skip_code=True)
            return
        if action not in ctl.modes:
            ctl.emit("routine_skipped", routine=name, action=action, reason="mode", at=current)
            return
        if current in ("pending", "triggered"):
            ctl.emit("routine_skipped", routine=name, action=action, reason="alarm", at=current)
            return
        if ctl.mode == action and ctl.state != AlarmControlPanelState.DISARMED:
            return  # schon scharf oder auf dem Weg dorthin
        try:
            await ctl.async_arm(action, None, by, skip_code=True)
        except HomeAssistantError as err:
            # Offene Sensoren: arm_failed ist schon gemeldet und protokolliert
            _LOGGER.info("%s: routine '%s' could not arm %s: %s", self.entry.title, name, action, err)
