"""
Überwachung (1.48.0): Regeln für Messwerte (Temperatur, Luftfeuchtigkeit, CO2 ...) und Ja/Nein-Sensoren (Kühlschranktür, Wasser im Keller ...),
unabhängig vom Alarm. Beispiel: "Kühlschrank über 8 °C seit 30 Minuten", dann Push; "wieder in Ordnung", dann zweite Push.

Eine Regel hat:
- eine **Bedingung** (Baum wie bei den Routinen: Und/Oder, eine Ebene Gruppen; Bedingungen "Messwert über/unter/ausserhalb", "Gerät ist X",
  "Uhrzeit von bis" und "Anlage ist scharf"),
- eine **Dauer** (so lange muss die Bedingung gelten, bevor der Ablauf läuft),
- eine **Rückkehr-Spanne** (ein Messwert gilt erst wieder als in Ordnung, wenn er so weit innerhalb der Grenze liegt),
- zwei **Abläufe**: "ausserhalb der Grenzen" und "wieder in Ordnung" (Push-Meldung, Gerät schalten, Warten),
- optional eine **Erinnerung** alle N Stunden, solange es anhält (wiederholt nur die Push-Schritte).

Sicherheitsregeln:
- Die Überwachung läuft immer, auch bei deaktivierter Anlage, und löst nie Sirene oder Alarm aus. Kritische Ereignisse (Feuer, Wasser) bleiben im
  Alarm ("Immer aktiv").
- Ein Sensor, der nicht antwortet ("nicht verfügbar", "unbekannt", keine Zahl), liefert nie einen Wert: weder löst er eine Regel aus noch beendet er
  sie. Ein Funkabriss meldet darum nie "wieder in Ordnung".
- Eine laufende Regel meldet sich nach einem Neustart oder Neuladen nicht noch einmal (der Zustand steht im Speicher); gilt die Bedingung nach dem
  Neustart nicht mehr, kommt "wieder in Ordnung".
- Kein Gerät hält etwas auf: jeder Aufruf wartet höchstens `SERVICE_TIMEOUT`, ein Fehler in einem Schritt bricht die übrigen nie ab, jede Regel
  läuft in ihrer eigenen Aufgabe.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from functools import partial
import logging
import re
from typing import Any

import voluptuous as vol
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    CONF_MONITORS,
    DATA_MONITOR,
    DOMAIN,
    MAX_ROUTINE_GROUPS,
    MAX_ROUTINE_LEAVES,
    MONITOR_NUMERIC_DOMAINS,
    MONITOR_STORE_KEY,
)
from .controller import AlarmController
from .devices import display_name
from .notify import TEXTS, async_send, build_payload, language, text
from .routines import INVALID, LEAF_STATES, combine, state_name, time_met, tree_leaves
from .workflow import SERVICE_TIMEOUT

_LOGGER = logging.getLogger(__name__)

PLACEHOLDER = re.compile(r"\{(?:name|rule|sensor|value|unit|limit|since)\}")
# Bedingungen, die ein Gerät betreffen (die anderen, Uhrzeit und "Anlage ist scharf", schränken nur ein)
DEVICE_KINDS = ("value", "state")


def _store(hass: HomeAssistant, entry_id: str) -> Store:
    return Store(hass, 1, f"{MONITOR_STORE_KEY}.{entry_id}")


async def async_remove_monitor_store(hass: HomeAssistant, entry_id: str) -> None:
    hass.data.get(DATA_MONITOR, {}).pop(entry_id, None)
    await _store(hass, entry_id).async_remove()


# ----- Prüfung -----


def check_monitors(hass: HomeAssistant, monitors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Was sich nur mit Home Assistant prüfen lässt; wirft vol.Invalid. Der Aufbau ist schon durch schemas.MONITORS geprüft.
    """
    registry = er.async_get(hass)
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    for monitor in monitors:
        if monitor["id"] in seen_ids or monitor["name"].strip().casefold() in seen_names:
            raise vol.Invalid("id and name of a rule must be unique")
        seen_ids.add(monitor["id"])
        seen_names.add(monitor["name"].strip().casefold())
        tree = monitor["tree"]
        groups = [i for i in tree["items"] if "items" in i]
        leaves = tree_leaves(tree)
        if len(groups) > MAX_ROUTINE_GROUPS or len(leaves) > MAX_ROUTINE_LEAVES:
            raise vol.Invalid("too many conditions")
        if any(x["kind"] == "time" and x["from"] == x["to"] for x in leaves):
            raise vol.Invalid("a time window needs two different times")
        device_leaves = [x for x in leaves if x["kind"] in DEVICE_KINDS]
        if not device_leaves:
            raise vol.Invalid("a rule needs at least one measured value or device condition")
        for leaf in device_leaves:
            domain = leaf["entity_id"].split(".")[0]
            if leaf["kind"] == "value":
                if domain not in MONITOR_NUMERIC_DOMAINS:
                    raise vol.Invalid("this sensor has no measured value")
                if leaf["op"] == "outside" and not ("upper" in leaf and leaf["upper"] > leaf["limit"]):
                    raise vol.Invalid("outside needs a lower and a higher limit")
                if leaf["op"] != "outside" and "upper" in leaf:
                    raise vol.Invalid("only outside has a second limit")
            elif domain not in LEAF_STATES or leaf["state"] not in LEAF_STATES[domain]:
                raise vol.Invalid("this device or state is not supported")
            entry = registry.async_get(leaf["entity_id"])
            if entry is not None and entry.platform == DOMAIN:
                raise vol.Invalid("a rule cannot watch Alarmageddon itself")
    return monitors


# ----- Auswertung -----


def number(state: Any) -> float | None:
    """Messwert eines Sensors; None, wenn er keinen liefert (nicht erreichbar, unbekannt, keine Zahl)."""
    if state is None or state.state in INVALID:
        return None
    try:
        value = float(state.state)
    except (TypeError, ValueError):
        return None
    return value if value == value and value not in (float("inf"), float("-inf")) else None


def value_met(leaf: dict[str, Any], value: float, active: bool, margin: float) -> bool:
    """
    Gilt die Grenze? Ist die Regel schon ausgelöst (`active`), gilt sie weiter, bis der Wert um `margin` innerhalb der Grenze liegt: ein Wert, der um
    die Grenze flattert, beendet die Regel nicht und löst sie nicht ständig neu aus.
    """
    shift = margin if active else 0.0
    limit = float(leaf["limit"])
    if leaf["op"] == "above":
        return value > limit - shift
    if leaf["op"] == "below":
        return value < limit + shift
    upper = float(leaf["upper"])
    return value < limit + shift or value > upper - shift


def eval_monitor(hass: HomeAssistant, ctl: AlarmController, tree: dict[str, Any], now: datetime, active: bool, margin: float) -> bool | None:
    """Wahr, falsch oder None (nicht beurteilbar: Sensor liefert keinen Wert). None zählt nie als erfüllt und nie als erledigt."""

    def leaf_value(leaf: dict[str, Any]) -> bool | None:
        kind = leaf["kind"]
        if kind == "time":
            return time_met(leaf, now)
        if kind == "armed":
            return state_name(ctl.state) == "armed" and (not leaf.get("modes") or ctl.mode in leaf["modes"])
        state = hass.states.get(leaf["entity_id"])
        if kind == "value":
            value = number(state)
            return None if value is None else value_met(leaf, value, active, margin)
        if state is None or state.state in INVALID:
            return None
        return state.state == leaf["state"]

    values = [combine(item["op"], [leaf_value(x) for x in item["items"]]) if "items" in item else leaf_value(item) for item in tree["items"]]
    return combine(tree["op"], values)


def _format(value: float) -> str:
    return f"{round(value, 2):g}"


class MonitorEngine:
    """Wertet die Regeln einer Anlage aus und führt ihre Abläufe aus; je Anlage eine."""

    def __init__(self, hass: HomeAssistant, entry: Any, controller: AlarmController, notifier: Any) -> None:
        self.hass = hass
        self.entry = entry
        self._ctl = controller
        self._notifier = notifier
        self._store = _store(hass, entry.entry_id)
        # Laufende Regeln: id -> {"since": ISO-Zeit, "last": ISO-Zeit der letzten Meldung, "entity": Sensor, der sie ausgelöst hat}. Der Speicher im
        # Arbeitsspeicher übersteht das Neuladen der Anlage (jede gespeicherte Änderung lädt sie neu), die Ablage den Neustart.
        self._active: dict[str, dict[str, Any]] = hass.data.setdefault(DATA_MONITOR, {}).setdefault(entry.entry_id, {})
        self._unsubs: list[CALLBACK_TYPE] = []
        self._holds: dict[str, CALLBACK_TYPE] = {}
        self._reminders: dict[str, CALLBACK_TYPE] = {}
        self._flows: dict[str, asyncio.Task] = {}
        self._started = False

    @property
    def rules(self) -> list[dict[str, Any]]:
        if not self._ctl.monitor_enabled:
            return []
        return [r for r in self.entry.options.get(CONF_MONITORS) or [] if isinstance(r, dict) and r.get("enabled", True)]

    def _rule(self, rid: str) -> dict[str, Any] | None:
        return next((r for r in self.rules if r.get("id") == rid), None)

    # -- Lebenszyklus --

    async def async_start(self) -> None:
        saved = await self._store.async_load()
        if isinstance(saved, dict) and not self._active:
            for rid, item in saved.items():
                if isinstance(item, dict) and isinstance(item.get("since"), str):
                    self._active[rid] = {"since": item["since"], "last": item.get("last") or item["since"], "entity": item.get("entity", "")}
        rules = self.rules
        ids = {r.get("id") for r in rules}
        if any(rid not in ids for rid in self._active):
            # Gelöschte oder ausgeschaltete Regeln sind erledigt: nichts mehr melden
            for rid in [rid for rid in self._active if rid not in ids]:
                del self._active[rid]
            self._save()
        for rule in rules:
            try:
                self._start_rule(rule)
            except (KeyError, ValueError, TypeError):
                _LOGGER.warning("%s: monitoring rule '%s' is damaged and does not run", self.entry.title, rule.get("name"))
        if any(x["kind"] == "armed" for rule in rules for x in self._leaves(rule)):
            self._unsubs.append(self._ctl.add_listener(self._on_alarm_change))
        self._started = True
        for rule in rules:
            if rule["id"] in self._active:
                self._schedule_reminder(rule)
            self._evaluate(rule)

    @staticmethod
    def _leaves(rule: dict[str, Any]) -> list[dict[str, Any]]:
        try:
            return tree_leaves(rule["tree"])
        except (KeyError, TypeError):
            return []

    def _start_rule(self, rule: dict[str, Any]) -> None:
        leaves = self._leaves(rule)
        entities = sorted({x["entity_id"] for x in leaves if x["kind"] in DEVICE_KINDS})
        if entities:
            self._unsubs.append(async_track_state_change_event(self.hass, entities, partial(self._on_state, rule["id"])))
        for edge in {t for x in leaves if x["kind"] == "time" for t in (x["from"], x["to"])}:
            hour, minute = (int(x) for x in edge.split(":"))
            self._unsubs.append(async_track_time_change(self.hass, partial(self._on_edge, rule["id"]), hour=hour, minute=minute, second=0))

    @callback
    def async_stop(self) -> None:
        for unsub in [*self._unsubs, *self._holds.values(), *self._reminders.values()]:
            unsub()
        for task in self._flows.values():
            task.cancel()
        self._unsubs.clear()
        self._holds.clear()
        self._reminders.clear()
        self._flows.clear()
        self._started = False

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {rid: dict(item) for rid, item in self._active.items()}, 1)

    # -- Auswertung --

    @callback
    def _on_state(self, rid: str, _event: Any) -> None:
        if (rule := self._rule(rid)) is not None:
            self._evaluate(rule)

    @callback
    def _on_edge(self, rid: str, _now: Any) -> None:
        if (rule := self._rule(rid)) is not None:
            self._evaluate(rule)

    @callback
    def _on_alarm_change(self) -> None:
        for rule in self.rules:
            if any(x["kind"] == "armed" for x in self._leaves(rule)):
                self._evaluate(rule)

    def _result(self, rule: dict[str, Any]) -> bool | None:
        return eval_monitor(self.hass, self._ctl, rule["tree"], dt_util.utcnow(), rule["id"] in self._active, float(rule.get("margin") or 0))

    @callback
    def _evaluate(self, rule: dict[str, Any]) -> None:
        rid = rule["id"]
        result = self._result(rule)
        if result is True:
            if rid in self._active or rid in self._holds:
                return
            seconds = int(rule.get("hold") or 0)
            if seconds > 0:
                self._holds[rid] = async_call_later(self.hass, seconds, partial(self._hold_over, rid))
            else:
                self._fire(rule)
            return
        # Falsch oder nicht beurteilbar: ein laufender Halt endet (ohne Wert gibt es keinen Beleg, dass es anhält)
        if (hold := self._holds.pop(rid, None)) is not None:
            hold()
        if result is False and rid in self._active:
            self._recover(rule)

    @callback
    def _hold_over(self, rid: str, _now: Any) -> None:
        self._holds.pop(rid, None)
        if (rule := self._rule(rid)) is not None and self._result(rule) is True and rid not in self._active:
            self._fire(rule)

    # -- Ablauf --

    def _context(self, rule: dict[str, Any], entity: str = "") -> dict[str, str]:
        """Werte für die Platzhalter: der Sensor, der die Regel auslöst (oder ausgelöst hat), sein Wert, seine Einheit und die Grenze."""
        leaves = [x for x in self._leaves(rule) if x["kind"] in DEVICE_KINDS]
        chosen = next((x for x in leaves if x["entity_id"] == entity), None)
        if chosen is None:
            margin = float(rule.get("margin") or 0)
            chosen = next((x for x in leaves if self._leaf_met(x, margin)), leaves[0] if leaves else None)
        values = {"name": self.entry.title, "rule": rule["name"], "sensor": "", "value": "", "unit": "", "limit": ""}
        if chosen is not None:
            state = self.hass.states.get(chosen["entity_id"])
            values["sensor"] = display_name(self.hass, chosen["entity_id"])
            values["unit"] = str(state.attributes.get("unit_of_measurement") or "") if state is not None else ""
            values["kind"] = chosen["kind"]
            if chosen["kind"] == "value":
                current = number(state)
                values["value"] = _format(current) if current is not None else ""
                limit = float(chosen["limit"])
                values["limit"] = f"{_format(limit)}–{_format(float(chosen['upper']))}" if chosen["op"] == "outside" else _format(limit)
            else:
                values["value"] = str(state.state) if state is not None and state.state not in INVALID else ""
                values["limit"] = chosen["state"]
            values["entity"] = chosen["entity_id"]
        return values

    def _leaf_met(self, leaf: dict[str, Any], margin: float) -> bool:
        state = self.hass.states.get(leaf["entity_id"])
        if leaf["kind"] == "value":
            value = number(state)
            return value is not None and value_met(leaf, value, False, margin)
        return state is not None and state.state == leaf["state"]

    def _since_text(self, since: str) -> str:
        when = dt_util.parse_datetime(since) or dt_util.utcnow()
        return dt_util.as_local(when).strftime(text(self.hass, "time_format"))

    @callback
    def _fire(self, rule: dict[str, Any]) -> None:
        rid = rule["id"]
        now = dt_util.utcnow().isoformat()
        values = self._context(rule)
        self._active[rid] = {"since": now, "last": now, "entity": values.get("entity", "")}
        self._save()
        self._ctl.emit("monitor_out", monitor=rule["name"], entity_id=values.get("entity", ""), value=values.get("value", ""), unit=values.get("unit", ""))
        self._schedule_reminder(rule)
        self._start_flow(rule, rule.get("steps_out") or [], "out", now)

    @callback
    def _recover(self, rule: dict[str, Any]) -> None:
        rid = rule["id"]
        active = self._active.pop(rid, None) or {}
        self._save()
        if (reminder := self._reminders.pop(rid, None)) is not None:
            reminder()
        back = self._context(rule, active.get("entity", ""))
        self._ctl.emit("monitor_ok", monitor=rule["name"], entity_id=active.get("entity", ""), value=back.get("value", ""), unit=back.get("unit", ""))
        # Der Ablauf "ausserhalb" endet mit der Rückkehr: seine übrigen Schritte (Warten, dann Push) wären überholt
        self._start_flow(rule, rule.get("steps_ok") or [], "ok", active.get("since") or dt_util.utcnow().isoformat(), active.get("entity", ""))

    def _schedule_reminder(self, rule: dict[str, Any]) -> None:
        rid = rule["id"]
        hours = int(rule.get("remind") or 0)
        if (old := self._reminders.pop(rid, None)) is not None:
            old()
        if hours <= 0 or rid not in self._active:
            return
        last = dt_util.parse_datetime(self._active[rid]["last"]) or dt_util.utcnow()
        wait = max(1.0, (last + timedelta(hours=hours) - dt_util.utcnow()).total_seconds())
        self._reminders[rid] = async_call_later(self.hass, wait, partial(self._remind, rid))

    @callback
    def _remind(self, rid: str, _now: Any) -> None:
        self._reminders.pop(rid, None)
        rule = self._rule(rid)
        if rule is None or rid not in self._active:
            return
        active = self._active[rid]
        active["last"] = dt_util.utcnow().isoformat()
        self._save()
        self._schedule_reminder(rule)
        # Nur die Push-Schritte wiederholen: ein zweites Mal "Gerät schalten" wäre keine Erinnerung
        steps = [s for s in rule.get("steps_out") or [] if s.get("type") == "notify"]
        self._start_flow(rule, steps, "remind", active["since"], active.get("entity", ""))

    def _start_flow(self, rule: dict[str, Any], steps: list[dict[str, Any]], kind: str, since: str, entity: str = "") -> None:
        rid = rule["id"]
        if kind != "remind" and (old := self._flows.pop(rid, None)) is not None:
            old.cancel()
        if not steps:
            return
        task = self.hass.async_create_background_task(self._run(rule, steps, kind, since, entity), f"alarmageddon monitor {self.entry.entry_id} {rid}")
        if kind != "remind":
            self._flows[rid] = task
        task.add_done_callback(lambda t, key=rid: (self._flows.get(key) is t and self._flows.pop(key, None), t.cancelled() or t.exception()))

    async def _run(self, rule: dict[str, Any], steps: list[dict[str, Any]], kind: str, since: str, entity: str) -> None:
        for step in steps:
            try:
                await self._step(rule, step, kind, since, entity)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - ein Fehler in einem Schritt hält die übrigen nie auf
                _LOGGER.exception("%s: step of monitoring rule '%s' failed", self.entry.title, rule["name"])

    def _fill(self, template: str, values: dict[str, str]) -> str:
        """Platzhalter eines eigenen Texts füllen; alles andere in geschweiften Klammern bleibt wie geschrieben (kein str.format)."""
        out = PLACEHOLDER.sub(lambda match: values[match.group(0)[1:-1]], template)
        return re.sub(r"[ \t]{2,}", " ", out).strip()

    def _default(self, kind: str, values: dict[str, str]) -> tuple[str, str]:
        lang = TEXTS[language(self.hass)]
        value = f"{values['value']} {values['unit']}".strip()
        # Die Grenze gibt es nur bei Messwerten (bei Ja/Nein-Sensoren steht dort der Zustand, den die Regel sucht)
        limit = lang["monitor_limit"].format(limit=f"{values['limit']} {values['unit']}".strip()) if values.get("kind") == "value" else ""
        if kind == "ok":
            title, message = lang["monitor_ok_title"], lang["monitor_ok"]
        else:
            title, message = lang["monitor_out_title"], lang["monitor_remind" if kind == "remind" else "monitor_out"]
        common = {"rule": values["rule"], "sensor": values["sensor"], "value": value, "limit": limit, "since": values["since"]}
        return title.format(**common), message.format(**common)

    async def _step(self, rule: dict[str, Any], step: dict[str, Any], kind: str, since: str, entity: str) -> None:
        stype = step.get("type")
        if stype == "wait":
            await self._sleep(max(0, int(step.get("seconds", 0) or 0)))
        elif stype == "notify":
            values = {**self._context(rule, entity), "since": self._since_text(since)}
            title, message = self._default(kind, values)
            title = self._fill(step["title"], values) if step.get("title") else title
            message = self._fill(step["message"], values) if step.get("message") else message
            targets = list(step.get("targets") or self._notifier.cfg["maintenance_targets"])
            cfg = {"types": {"monitor": {"critical": bool(step.get("critical")), "volume": float(step.get("volume", 1.0))}}}
            payload = build_payload(cfg, "monitor", title, message, tag=f"alarmageddon_{self.entry.entry_id}_monitor_{rule['id']}")
            async_send(self.hass, targets, payload)
        elif stype == "action":
            domain, _, service = str(step.get("action", "")).partition(".")
            data = dict(step.get("data") or {})
            if step.get("target"):
                data["entity_id"] = list(step["target"])
            await self._bounded(self.hass.services.async_call(domain, service, data, blocking=True), f"{domain}.{service}")

    async def _bounded(self, coro: Any, label: str) -> None:
        """Wartet höchstens SERVICE_TIMEOUT auf einen Aufruf; antwortet das Gerät nicht, geht es weiter (der Aufruf läuft als eigene Aufgabe weiter)."""
        task = self.hass.async_create_background_task(coro, f"alarmageddon monitor call {label}")
        try:
            done, _pending = await asyncio.wait({task}, timeout=SERVICE_TIMEOUT)
        except asyncio.CancelledError:
            task.cancel()
            raise
        task.add_done_callback(lambda t: t.cancelled() or t.exception())
        if not done:
            raise TimeoutError(f"{label} did not respond within {SERVICE_TIMEOUT} s")
        task.result()

    async def _sleep(self, seconds: float) -> None:
        if seconds <= 0:
            return
        done = asyncio.Event()
        cancel = async_call_later(self.hass, seconds, lambda _now: done.set())
        try:
            await done.wait()
        finally:
            cancel()
