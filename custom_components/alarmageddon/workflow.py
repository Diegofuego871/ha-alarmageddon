"""
Aktionen als Ablauf: pro Anlage und Auslöser (Alarm im Modus Anwesend,
Abwesend, Nacht oder durch einen "immer aktiven" Sensor) eine Liste von
Schritten: Push-Meldung, beliebige HA-Aktion, Warten, Alarmton auf Medienplayern.

Sicherheitsregeln (CLAUDE.md):
- Ein Fehler in einem Schritt bricht die übrigen nicht ab.
- Deaktivieren stoppt alle laufenden Schritte und stellt den Zustand vor dem
  Alarm wieder her (Lautstärke, Wiedergabe, Schalter), auch nach einem Neustart.
  Darum speichert der Ablauf vor dem ersten Schritt einen eigenen Schnappschuss
  in einer Ablage; die Szenen von HA überleben keinen Neustart.
"""

from __future__ import annotations

import asyncio
from contextvars import ContextVar
from datetime import timedelta
from functools import partial
import logging
import math
import re
from typing import Any

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.network import NoURLAvailableError, get_url
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    ALL_SOUNDS,
    CUSTOM_SOUND_ID_RE,
    DATA_CUSTOM_SOUNDS,
    DATA_HEALTHCHECK,
    DATA_HEALTHCHECK_HOLDS,
    GROUP_EXCLUDED,
    GROUP_MAX_ROUNDS,
    GROUP_MIN_ROUND,
    MAX_CUSTOM_SECONDS,
    CONF_WORKFLOWS,
    CONF_WORKFLOWS_AFTER,
    CONF_WORKFLOWS_ARMED,
    CONF_WORKFLOWS_DISARMED,
    CONF_WORKFLOWS_REPORT,
    CONF_REALARM_ENABLED,
    realarm_count,
    WORKFLOW_ALWAYS,
    CONF_WORKFLOWS_ARMING,
    CONF_WORKFLOWS_ENTRY,
    RESTORABLE_DOMAINS,
    TEST_SECONDS,
    UNDO_SERVICES,
    WORKFLOW_STORE_KEY,
)
from .controller import ARMED_STATE, AlarmController
from . import selftest
from .sound_loop import LOOP_MAX_SECONDS, loop_url

_LOGGER = logging.getLogger(__name__)

ARMED_STATES = frozenset(str(state) for state in ARMED_STATE.values())
# Läufe während einer Verzögerung (1.18.0): Phase des Laufs und die Liste der Schritte dazu, je Zustand der Anlage
DELAY_PHASES = {
    str(AlarmControlPanelState.ARMING): ("arming", CONF_WORKFLOWS_ARMING),
    str(AlarmControlPanelState.PENDING): ("pending", CONF_WORKFLOWS_ENTRY),
}
SIDE_PHASES = ("armed", "arming", "pending", "report")
# Töne, die nach einem Neustart mitten im Alarm weiterspielen, wenn sie nebenher liefen (1.87.0, Code-Review H3)
TONE_RESUME_TYPES = ("sound", "prealarm")  # Läufe neben dem Alarm, die mit dem Deaktivieren sofort enden
# Ein Gerät, das länger nicht antwortet, hält den Ablauf nie auf: nach dieser Zeit (Sekunden) läuft er mit dem nächsten Schritt weiter.
# Der hängende Aufruf wird nicht abgebrochen (ein Skript soll weiterlaufen dürfen), nur nicht mehr abgewartet; Deaktivieren beendet ihn.
SERVICE_TIMEOUT = 10
# Der Schnappschuss vor dem ersten Schritt darf den Alarm höchstens so lange verzögern
SNAPSHOT_TIMEOUT = 3
# Ein Schritt des Alarms wartet höchstens so lange, bis ein endender voriger Lauf (quittiert, sofort wieder ausgelöst) seine Geräte nicht mehr
# gerade schaltet (1.87.0, Code-Review K1): sonst käme dessen Zurückstellen nach dem Einschalten an
HANDOVER_TIMEOUT = 3
# Wächter: Zuschlag (Sekunden) auf die erwartete Dauer, bevor er eingreift. Die erwartete Dauer eines Schritts steht in
# step_budget, die der Vorbereitung in start_budget. Der Wächter ist die zweite Sicherung hinter den Grenzen oben: er
# greift auch, wenn etwas aus einem Grund hängt, den niemand vorhergesehen hat.
WATCHDOG_GRACE = 2
# Was vom Zustand eines Geräts für die Wiederherstellung zählt
KEEP_ATTRS = ("brightness", "color_temp_kelvin", "current_position", "volume_level", "is_volume_muted", "source")


def step_budget(step: dict[str, Any]) -> float:
    """
    So lange darf ein abgewarteter Schritt höchstens dauern, bevor der Wächter ihn verlässt und der nächste Schritt läuft.
    Jede Art von Schritt hat eine endliche Grenze (tests/test_action_hang.py prüft das für jeden Typ aus schemas.STEP_SCHEMAS).
    """
    kind = step.get("type")
    if kind == "group":
        # Eine abgewartete Gruppe: jeder Schritt darin steht selbst unter Aufsicht (seine eigene Grenze), dazu die Mindestdauer je Runde.
        # Anzahl: so viele Runden; Dauer: die eingestellte Zeit und eine angefangene Runde. "Bis deaktiviert" wird nie abgewartet.
        inner = sum(step_budget(item) for item in group_steps(step) if step_waits(item)) + 2 * GROUP_MIN_ROUND
        if step.get("mode") == "duration":
            return max(1, int(step.get("seconds", 0) or 0)) + inner + WATCHDOG_GRACE
        return group_rounds(step) * inner + WATCHDOG_GRACE
    if kind in ("notify", "healthcheck"):
        return WATCHDOG_GRACE  # Meldungen gehen ohne Abwarten hinaus (auch die an einen HealthCheck-Dienst: eigene Aufgabe)
    if kind == "acknowledge":
        return WATCHDOG_GRACE  # sofort, ohne Gerätezugriff
    if kind == "wait":
        return max(0, int(step.get("seconds", 0) or 0)) + WATCHDOG_GRACE
    if kind in ("sound", "chime", "dechime", "prealarm"):
        # Ein eigener Ton (unbekannt in der Tabelle) ist höchstens MAX_CUSTOM_SECONDS lang; eine Wiederholung zählt als angefangener Ton
        length = ALL_SOUNDS.get(step.get("sound"), MAX_CUSTOM_SECONDS if re.match(CUSTOM_SOUND_ID_RE, str(step.get("sound"))) else max(ALL_SOUNDS.values()))
        duration = step.get("duration")
        if duration is None:  # ältere Form: so oft wiederholen, jeder Aufruf höchstens SERVICE_TIMEOUT
            repeat = max(1, int(step.get("repeat", 1) or 1))
            return repeat * (length + SERVICE_TIMEOUT) + SERVICE_TIMEOUT + SNAPSHOT_TIMEOUT + 4 * SERVICE_TIMEOUT + HANDOVER_TIMEOUT + WATCHDOG_GRACE
        # Lautstärke, letzter Start und Stopp je höchstens SERVICE_TIMEOUT, dazu ein angefangener Ton. Dazu das Merken des Zustands
        # vorher (SNAPSHOT_TIMEOUT) und das Zurückstellen danach (Stopp, Wiedergabe oder Lautstärke, Stummschaltung, Ausschalten)
        return int(duration or 0) + length + 3 * SERVICE_TIMEOUT + SNAPSHOT_TIMEOUT + 4 * SERVICE_TIMEOUT + HANDOVER_TIMEOUT + WATCHDOG_GRACE
    return SERVICE_TIMEOUT + HANDOVER_TIMEOUT + WATCHDOG_GRACE  # Aktion (und jeder künftige Typ, bis er eine eigene Grenze bekommt)


def step_waits(step: dict[str, Any]) -> bool:
    """
    Wartet der Ablauf auf das Ende dieses Schritts, bevor der nächste startet?

    Seit 1.10.0 laufen Schritte, die etwas ausführen (Gerät, Ton), standardmässig weiter: der nächste startet sofort. Nur mit
    "wait" wartet der Ablauf. Ältere Abläufe (bis 1.9.0) kennen "wait" nicht: dort wurde gewartet, ausser mit "detach"; sie
    verhalten sich unverändert, bis sie im Panel neu gespeichert werden. Ein Ton "bis zum Deaktivieren" (Dauer 0) endet nie von
    selbst, auf ihn lässt sich nicht warten. Warten, Meldung und Quittieren gehören zum Ablauf selbst (kein Nebenher).
    """
    kind = step.get("type")
    if kind == "group":
        # Wie die anderen Schritte, die etwas ausführen: ohne "wait" läuft die Gruppe nebenher. "Bis deaktiviert" endet nie von selbst
        return bool(step.get("wait")) and step.get("mode") != "until_disarmed"
    if kind not in ("action", "sound", "chime", "dechime", "prealarm"):
        return True
    if kind == "sound" and step.get("duration") == 0:
        return False
    if step.get("delay") and kind in ("chime", "prealarm"):
        # Ein Ton, der der Verzögerung folgt (1.18.0), endet erst mit ihr: wartete der Ablauf, käme kein Schritt danach je zum Zug
        return False
    if "wait" in step:
        return bool(step["wait"])
    if kind in ("chime", "dechime"):
        return False  # neue Schrittart (1.14.0): kennt die ältere Regel nicht, läuft ohne Angabe weiter
    if kind == "prealarm":
        return True  # Voralarm (1.15.0): er steht vor der Sirene, ohne Angabe wartet der Ablauf auf sein Ende
    return not step.get("detach")


def group_steps(step: dict[str, Any]) -> list[dict[str, Any]]:
    """Die Schritte einer Gruppe, die laufen dürfen (nie eine Gruppe in der Gruppe, nie "Quittieren": auch wenn die Ablage so etwas enthielte)."""
    return [item for item in step.get("steps") or [] if isinstance(item, dict) and item.get("type") not in GROUP_EXCLUDED]


def group_rounds(step: dict[str, Any]) -> int:
    """Zahl der Durchläufe einer Gruppe mit "Anzahl" (immer innerhalb der Grenzen, auch bei einem beschädigten Wert)."""
    try:
        return min(GROUP_MAX_ROUNDS, max(1, int(step.get("count", 1) or 1)))
    except (TypeError, ValueError):
        return 1


def flat_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Alle Schritte einer Liste, die Schritte von Gruppen eingeschlossen (für Fragen wie "gibt es eine Meldung", "welche Lautsprecher")."""
    out: list[dict[str, Any]] = []
    for step in steps:
        out.extend(group_steps(step) if step.get("type") == "group" else [step])
    return out


def start_budget() -> float:
    """So lange darf es nach dem Auslösen höchstens dauern, bis der erste Schritt beginnt (Schnappschuss, Ablage, Zuschlag)."""
    return 2 * SNAPSHOT_TIMEOUT + WATCHDOG_GRACE


# Der Ablauf, in dem der laufende Code steht ("home", "away", "night" oder "always"). Zwei Abläufe können nebeneinander laufen
# (Modus und "Immer aktiv"); jeder läuft in seiner eigenen Aufgabe, darum trägt die Aufgabe ihren Ablauf mit.
_LANE: ContextVar[str | None] = ContextVar("alarmageddon_lane", default=None)
# Läuft der Code in einer Aktions-Gruppe? Dort gilt je Gerät nur ein vorgemerkter Gegendienst (siehe _plan_undo). Die Aufgabe der Gruppe
# setzt die Marke, die Aufgaben ihrer Schritte erben sie.
_IN_GROUP: ContextVar[bool] = ContextVar("alarmageddon_in_group", default=False)


def _retrieve(task: asyncio.Task) -> None:
    """Ausnahme einer nicht mehr abgewarteten Aufgabe als abgeholt markieren (sonst meldet asyncio sie beim Aufräumen)."""
    if not task.cancelled():
        task.exception()


def _store(hass: HomeAssistant, entry_id: str) -> Store:
    return Store(hass, 1, f"{WORKFLOW_STORE_KEY}.{entry_id}")


async def async_remove_workflow_store(hass: HomeAssistant, entry_id: str) -> None:
    await _store(hass, entry_id).async_remove()


def step_entities(step: dict[str, Any]) -> list[str]:
    """Geräte, die ein Schritt verändert und die beim Deaktivieren zurückgesetzt werden sollen (Einstellung "Rückgängig" des Schritts)."""
    if step.get("type") == "group":
        return sorted({entity for item in group_steps(step) for entity in step_entities(item)})
    if step.get("type") in ("sound", "prealarm") and step.get("restore", True):
        return list(step.get("players", []))
    if step.get("type") == "action" and step.get("restore", False):
        return [e for e in step.get("target", []) if e.split(".")[0] in RESTORABLE_DOMAINS]
    return []


class WorkflowRunner:
    def __init__(self, hass: HomeAssistant, entry: Any, controller: AlarmController, notifier: Any) -> None:
        self.hass = hass
        self.entry = entry
        self._ctl = controller
        self._notifier = notifier
        self._store = _store(hass, entry.entry_id)
        self._task: asyncio.Task | None = None
        self._side_tasks: set[asyncio.Task] = set()  # Schritte "nicht abwarten", laufen nebenher
        self._late: set[asyncio.Task] = set()  # Aufrufe, auf die nicht mehr gewartet wird (Zeit überschritten)
        self._run: dict[str, Any] | None = None  # laufender Ablauf: Auslöser, Schritt, Schnappschuss, Test
        self._last_state: str | None = None
        self._mode_seen: str | None = None  # Modus der Anlage, solange sie nicht deaktiviert ist (beim Deaktivieren ist er schon gelöscht)
        self._unsubs: list[Any] = []
        self._test_timer = None
        # Wächter: der Lauf, dessen Schritte schon gestartet sind (nie zweimal starten), der Schritt, an dem der Ablauf steht
        # (für das Weitermachen nach einem Abbruch), und die Aufsicht über den Start
        self._begun: dict[str, Any] | None = None
        self._plan: list[str] | None = None
        # Stand je Ablauf (Schlüssel: Auslöser). Neben dem Hauptablauf kann ein zweiter laufen ("Immer aktiv" zusätzlich zum Modus)
        self._positions: dict[str, int] = {}
        self._also_task: asyncio.Task | None = None
        self._guard: asyncio.Task | None = None
        # Gruppen "bis deaktiviert", die in diesem Prozess laufen: (Ablauf, Schritt). Nach einem Neustart ist die Menge leer, die
        # abgelegten Gruppen des Laufs starten dann wieder (_execute)
        self._endless: set[tuple[str, int]] = set()
        self._undo_tasks: dict[int, asyncio.Task] = {}  # Aufgabe je vorgemerktem Gegendienst (Schlüssel: der Eintrag), um ihn ersetzen zu können
        # Übergabe an einen neuen Alarm (1.87.0, Code-Review K1): Läufe, die gerade enden, während schon ein neuer Alarm beginnen kann (nach dem
        # Quittieren, Voralarm vor dem Alarm), und der Zustand vor dem alten Lauf für Geräte, die der neue Alarm übernommen hat. Bis 1.86.x stellte
        # der alte Lauf diese Geräte noch zurück, nachdem der neue Alarm sie geschaltet hatte (Sirene aus im Alarm, danach dauerhaft an).
        self._stopping: list[dict[str, Any]] = []
        self._handover: dict[str, Any] = {"snapshot": {}, "sonos": set()}
        self._busy: dict[int, set[str]] = {}
        # Nachalarme des laufenden Alarms (1.87.0, Entscheid des Nutzers 2026-11-24), höchstens realarm_count
        self._realarms = 0
        self._busy_event = asyncio.Event()

    # ----- Konfiguration -----

    def steps(self, trigger: str) -> list[dict[str, Any]]:
        return list((self.entry.options.get(CONF_WORKFLOWS) or {}).get(trigger, []))

    def has_notify(self, trigger: str) -> bool:
        return any(s.get("type") == "notify" for s in flat_steps(self.steps(trigger)))

    @property
    def running(self) -> dict[str, Any] | None:
        return self._run

    # ----- Lebenszyklus -----

    async def async_start(self) -> None:
        """
        Nach dem Wiederherstellen des Zustands: Lief beim Neustart ein Alarm,
        läuft der Ablauf ab dem gespeicherten Schritt weiter; ist der Alarm
        inzwischen vorbei (deaktiviert), wird der Zustand vor dem Alarm
        wiederhergestellt.
        """
        self._last_state = str(self._ctl.state)
        self._mode_seen = self._ctl.mode
        self._unsubs.append(self._ctl.add_listener(self._on_change))
        self._unsubs.append(self._ctl.add_event_listener(self._on_event))
        saved = await self._store.async_load()
        # "Alarmton stumm" hat den Ablauf dieses Alarms beendet (async_silence): er beginnt nach einem Neustart nicht von vorn
        silenced = isinstance(saved, dict) and bool(saved.get("silenced"))
        if isinstance(saved, dict) and saved.get("trigger"):
            self._run = saved
            # Fortgesetzt wird nur der Ablauf eines Alarms. Ein Lauf neben dem Alarm (Töne einer Verzögerung, Aktivierungston: "after")
            # ist kein Alarmablauf: bis 1.57.0 liefen nach einem Neustart im Alarm seine Schritte weiter statt der Alarmaktionen.
            if self._ctl.state == AlarmControlPanelState.TRIGGERED and not saved.get("test") and not saved.get("after"):
                self._begun = saved
                self._spawn(saved, int(saved.get("index", 0) or 0))
                also = saved.get("also")
                if isinstance(also, dict) and also.get("trigger"):
                    self._spawn(saved, int(also.get("index", 0) or 0), str(also["trigger"]))
                for entry in list(saved.get("undo") or []):
                    self._arm_undo(saved, entry)  # Restzeit; war die Zeit schon um, schaltet es sofort zurück
                if saved.get("hc"):
                    self._hc_apply(list(saved["hc"]), now=True)  # Wiederholen und Pausieren gehen nach dem Neustart weiter (1.80.0)
            else:
                await self.async_stop()
        if self._ctl.state == AlarmControlPanelState.TRIGGERED and self._run is None and not silenced:
            # Alarm ohne gespeicherten Ablauf (Home Assistant fiel aus, bevor der Stand geschrieben war, oder nur ein Lauf neben dem Alarm
            # war gespeichert): die Alarmaktionen beginnen jetzt, unter derselben Aufsicht wie beim Auslösen (im Zweifel alarmieren)
            try:
                self._plan = list(self._ctl.alarm_plan())
                trigger = self._plan[0]
                if self.steps(trigger):
                    self._watch_start(trigger)
                    self.hass.async_create_task(self._start(trigger))
            except Exception:  # noqa: BLE001 - der Start der Anlage geht in jedem Fall weiter
                _LOGGER.exception("%s: the alarm actions could not be started after the restart", self.entry.title)
        if str(self._ctl.state) in DELAY_PHASES and self._run is None:
            # Neuladen oder Neustart mitten in einer Verzögerung: ihre Töne laufen für die Restzeit weiter
            self.hass.async_create_task(self._start_delay(self._ctl.mode, resumed=True))

    async def async_unload(self) -> None:
        """Beim Entladen (Neustart, neue Optionen) nur anhalten, nichts zurücksetzen: der Alarm geht weiter."""
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._cancel_timers()
        self._cancel_guard()
        self._hc_release(False)  # ein Neuladen beendet den Alarm nicht: die Pause bleibt nicht hängen, nach dem Start gilt sie wieder
        await self._cancel_task()
        if self._run is not None and not self._run.get("test"):
            # Stand des laufenden Alarms sofort schreiben (nicht erst verzögert): nach dem Neuladen geht es beim richtigen Schritt
            # weiter, kein Schritt läuft doppelt. Unter Aufsicht: eine hängende Ablage hält das Neuladen nicht auf.
            try:
                await self._watched(self._store.async_save(self._run), SNAPSHOT_TIMEOUT, "store")
            except Exception:  # noqa: BLE001 - ohne gespeicherten Stand beginnt der Ablauf nach dem Neuladen beim letzten gespeicherten Schritt
                _LOGGER.exception("%s: saving the state of the alarm actions failed", self.entry.title)

    @callback
    def _cancel_timers(self) -> None:
        if self._test_timer:
            self._test_timer()
            self._test_timer = None

    @callback
    def _cancel_guard(self) -> None:
        """
        Den Startwächter abbrechen: nur beim Entladen und bei "Alarmton stumm". Nie beim Ende eines Laufs (1.87.0): der Stopp des vorigen
        Alarms oder eines Tests lief bis 1.86.x oft erst an, nachdem ein neuer Alarm seinen Wächter schon gestellt hatte, und brach ihn ab.
        Nach dem Deaktivieren oder Quittieren tut der Wächter ohnehin nichts (_check_started prüft den Zustand).
        """
        if self._guard is not None:
            self._guard.cancel()
            self._guard = None

    @callback
    def _on_change(self) -> None:
        state = str(self._ctl.state)
        previous = self._last_state
        self._last_state = state
        if state != AlarmControlPanelState.DISARMED:
            self._mode_seen = self._ctl.mode
        if state == previous:
            return
        if state == AlarmControlPanelState.TRIGGERED:
            self._realarms = 0
            # Hauptablauf des Alarms (Modus oder "Immer aktiv"); ein zweiter Ablauf kommt in async_run aus demselben Plan dazu
            self._plan = list(self._ctl.alarm_plan())  # für die Aktionen nach dem Quittieren: am Ende ist der Plan des Automaten schon geleert
            trigger = self._plan[0]
            # Zuerst die Aufsicht, dann der Start: scheitert oder hängt der Start, beginnt der Wächter die Schritte selbst
            self._watch_start(trigger)
            self.hass.async_create_task(self._start(trigger))
        elif previous == AlarmControlPanelState.TRIGGERED:
            # Quittiert oder deaktiviert: alles stoppen und zurückstellen, danach die Aktionen nach dem Quittieren
            run = self._run if self._run and not self._run.get("test") and not self._run.get("after") else None
            plan = self._plan or ([run["trigger"], *([run["also"]["trigger"]] if isinstance(run.get("also"), dict) else [])] if run else [])
            self._plan = None
            # Deaktiviert (nicht nur quittiert): danach auch die Aktionen "Beim Deaktivieren" des Modus, der scharf war (1.27.0)
            self.hass.async_create_task(self._end(plan, self._mode_seen if state == AlarmControlPanelState.DISARMED else None))
        elif state in DELAY_PHASES:
            # Eine Verzögerung beginnt (1.18.0): die Aktionen dazu, solange sie läuft. Sie enden mit ihr (scharf, Alarm) oder
            # beim Deaktivieren; der Alarm wartet nie auf sie (async_run beendet sie unter Aufsicht).
            self.hass.async_create_task(self._start_delay(self._ctl.mode))
        elif state in ARMED_STATES and previous not in (None, AlarmControlPanelState.PENDING):
            # Scharf geschaltet (auch Wechsel des Modus): die Aktionen beim Scharfschalten dieses Modus. Nicht beim Start von Home
            # Assistant (da war die Anlage schon scharf) und nicht nach einem quittierten Alarm (der Zweig darüber).
            self.hass.async_create_task(self.async_run_armed(self._ctl.mode))
        elif state == AlarmControlPanelState.DISARMED:
            # Deaktiviert: ein Ton der Verzögerung oder der Aktivierungston, der noch läuft, wird sofort still; danach laufen die
            # Aktionen "Beim Deaktivieren" des Modus, der scharf war (1.27.0)
            self.hass.async_create_task(self._on_disarmed(self._mode_seen))

    async def _end(self, plan: list[str], disarmed_mode: str | None = None) -> None:
        self._realarms = 0
        await self._end_alarm(plan, disarmed_mode)

    async def _end_alarm(self, plan: list[str], disarmed_mode: str | None = None) -> None:
        """
        Der Alarm ist zu Ende: Ablauf stoppen und Geräte zurückstellen; erst dann laufen die Aktionen nach dem Quittieren, bei
        einem Deaktivieren danach (im selben Lauf) die Aktionen "Beim Deaktivieren" des Modus, der scharf war.

        Beginnt währenddessen ein neuer Alarm (quittiert, sofort wieder ausgelöst), übergibt der Stopp ihm die Geräte, die er schaltet
        (`yield_to_alarm`, siehe _owned_by_alarm): er stellt sie nicht mehr zurück.
        """
        await self.async_stop(yield_to_alarm=True)
        try:
            await self.async_run_after(plan, disarmed_mode)
        except Exception:  # noqa: BLE001 - das Ende des Alarms selbst ist schon erledigt
            _LOGGER.exception("%s: the actions after the alarm could not be started", self.entry.title)

    async def _stop_side_run(self) -> None:
        """Einen Lauf beim Scharfschalten oder nach dem Quittieren vorzeitig beenden: Schritte abbrechen, laufende Töne stoppen."""
        run = self._run
        if run is None or not run.get("after"):
            return
        pending = list(run.get("undo") or [])
        await self._end_test()
        if self._run is not None:
            # Währenddessen hat ein neuer Lauf begonnen (der Alarm): ab hier gehören Lautsprecher und Ablage ihm. Ein Stopp
            # jetzt brächte seine Sirene zum Schweigen, das Löschen nähme ihm den Stand für den Neustart (1.18.0). Vorgemerkte
            # Gegendienste gehen mit ihrer Zeit an den Alarm.
            for entry in pending:
                self._run.setdefault("undo", []).append(entry)
                self._arm_undo(self._run, entry)
            return
        run["undo"] = pending
        await self._flush_undos(run)  # der Lauf endet vor der Zeit: die Geräte sofort zurück
        players = sorted({p for step in run.get("steps") or [] if step.get("type") in ("sound", "chime", "dechime", "prealarm") for p in step.get("players", [])})
        if players:
            await self._call("media_player", "media_stop", {"entity_id": players})
        if self._run is None:
            self.hass.async_create_task(self._store.async_remove())

    def steps_armed(self, mode: str | None) -> list[dict[str, Any]]:
        return list((self.entry.options.get(CONF_WORKFLOWS_ARMED) or {}).get(mode or "") or [])

    async def async_run_armed(self, mode: str | None) -> bool:
        """
        Aktionen beim Scharfschalten starten (1.14.0): die Schritte, die der Nutzer unter "Anlage scharf geschaltet" gelegt hat,
        für den Modus, der gerade scharf wurde (zum Beispiel ein Aktivierungston). Der Lauf verhält sich wie die Aktionen nach dem
        Quittieren: unter Aufsicht, endet von selbst, stellt nichts zurück. Ein Alarm hat Vorrang und bricht ihn ab, Deaktivieren
        ebenso; läuft noch ein solcher Lauf (rasch hintereinander scharf geschaltet), ersetzt ihn der neue.
        """
        if self._run is not None and self._run.get("phase") in ("arming", "disarmed"):
            # Die Ausgangsverzögerung ist um: ihre Aktionen enden hier, auch wenn danach nichts folgt. Ebenso der Ton beim
            # Deaktivieren, der noch läuft, wenn wieder scharf geschaltet wird (1.27.0)
            await self._stop_side_run()
        steps = self.steps_armed(mode)
        if not steps or self._ctl.state not in ARMED_STATES:
            return False
        if self._run is not None:
            if not self._run.get("after"):
                return False  # ein Alarm oder ein Test läuft
            await self._stop_side_run()
        run: dict[str, Any] = {"trigger": mode, "index": 0, "test": False, "after": True, "phase": "armed", "snapshot": {}, "sonos": [], "steps": steps}
        self._run = run
        self._begin(run)
        return True

    def steps_delay(self, state: str, mode: str | None) -> list[dict[str, Any]]:
        """Schritte, die während der Verzögerung dieses Zustands laufen (Ausgang: arming, Eingang: pending), für den Modus."""
        conf = DELAY_PHASES[state][1]
        return list((self.entry.options.get(conf) or {}).get(mode or "") or [])

    async def async_run_delay(self, mode: str | None, resumed: bool = False) -> bool:
        """
        Aktionen während einer Verzögerung starten (1.18.0): "Scharfschalten beginnt" (die Ausgangsverzögerung läuft) oder
        "Eingangsverzögerung läuft" (Zeit zum Deaktivieren). Der Lauf verhält sich wie die Aktionen beim Scharfschalten: unter
        Aufsicht, stellt nichts zurück, Deaktivieren beendet ihn sofort. Er endet mit der Verzögerung: scharf geschaltet
        (async_run_armed) oder Alarm (async_run, unter Aufsicht: der Alarm wartet nie auf ihn).

        `resumed`: nach einem Neuladen oder Neustart mitten in der Verzögerung laufen nur die Töne weiter, die der Verzögerung
        folgen ("delay"), für die Restzeit; ein Gerät wird nicht ein zweites Mal geschaltet.
        """
        state = str(self._ctl.state)
        if state not in DELAY_PHASES:
            return False
        phase = DELAY_PHASES[state][0]
        if self._run is not None and self._run.get("phase") == "disarmed":
            await self._stop_side_run()  # die Aktionen beim Deaktivieren enden, sobald wieder scharf geschaltet wird (oder ein Sensor auslöst)
        steps = self.steps_delay(state, mode)
        if resumed:
            steps = [step for step in steps if step.get("delay")]
        if not steps:
            return False
        if self._run is not None:
            if not self._run.get("after"):
                return False  # ein Alarm oder ein Test läuft
            await self._stop_side_run()
        if str(self._ctl.state) != state:
            return False  # währenddessen scharf, ausgelöst oder deaktiviert
        if self._run is not None:
            return False  # währenddessen hat der Alarm begonnen: er hat Vorrang
        run: dict[str, Any] = {"trigger": mode, "index": 0, "test": False, "after": True, "phase": phase, "snapshot": {}, "sonos": [], "steps": steps}
        self._run = run
        try:
            self._begin(run)
        except Exception:
            if self._run is run:
                self._run = None  # kein halber Lauf bleibt stehen (er gälte sonst als laufend)
            raise
        return True

    async def _start_delay(self, mode: str | None, resumed: bool = False) -> None:
        """Aktionen einer Verzögerung starten. Sie sind Zusatz: scheitert ihr Start, steht es im Log, Automat und Alarm laufen weiter."""
        try:
            await self.async_run_delay(mode, resumed)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - Sicherheitsregel: nichts aus den Verzögerungen darf den Alarm berühren
            _LOGGER.exception("%s: starting the actions of the delay failed; the alarm system goes on", self.entry.title)

    def _timed(self, step: dict[str, Any]) -> dict[str, Any] | None:
        """
        Schritt mit der Dauer, die jetzt gilt. Ein Ton "so lange wie die Verzögerung" (delay) bekommt die Restzeit der laufenden
        Verzögerung (Wert des Modus oder des Sensors, der sie ausgelöst hat): er endet zusammen mit ihr. Im Test eines Schritts läuft
        keine Verzögerung: dann gilt die eingestellte Zeit des Modus (Ausgangs- bzw. Eingangsverzögerung), höchstens so lange wie ein Test
        dauert (TEST_SECONDS); ist keine eingestellt, die Dauer des Schritts. None: nichts mehr zu spielen (die Verzögerung ist um).
        """
        if not step.get("delay") or step.get("type") not in ("chime", "prealarm"):
            return step
        run = self._run or {}
        left = self._ctl.delay_left() if run.get("phase") in ("arming", "pending") else None
        if left is None:
            plain = {key: value for key, value in step.items() if key != "delay"}
            configured = self._test_delay(step) if run.get("test") else 0
            return {**plain, "duration": min(configured, TEST_SECONDS)} if configured > 0 else plain
        if left < 1:
            return None
        return {**step, "duration": math.ceil(left)}

    def _test_delay(self, step: dict[str, Any]) -> int:
        """Die eingestellte Verzögerung des Modus, den der Test gerade prüft: Ausgang beim Aktivierungston, Eingang beim Voralarm."""
        mode = (self._run or {}).get("trigger")
        if mode not in self._ctl.modes:
            return 0
        if step.get("type") == "chime":
            return self._ctl.exit_delay(mode)
        return self._ctl.longest_entry_delay(mode) or self._ctl.entry_delay_for(mode)

    def steps_after(self, trigger: str) -> list[dict[str, Any]]:
        return list((self.entry.options.get(CONF_WORKFLOWS_AFTER) or {}).get(trigger) or [])

    async def async_run_after(self, plan: list[str], disarmed_mode: str | None = None) -> bool:
        """
        Aktionen nach dem Quittieren starten (1.10.0): die Schritte, die der Nutzer hinter "Alarm endet" gelegt hat, für jeden
        Ablauf des beendeten Alarms (Modus, "Immer aktiv"; derselbe Ablauf nur einmal). Sie laufen unter derselben Aufsicht wie
        die Alarmaktionen. Ein neuer Alarm hat Vorrang: läuft schon einer, starten sie nicht, und ein Alarm bricht sie ab.

        `disarmed_mode`: wurde deaktiviert, folgen im selben Lauf die Aktionen "Beim Deaktivieren" dieses Modus (1.27.0).
        """
        steps: list[dict[str, Any]] = []
        seen: list[list[dict[str, Any]]] = []
        for trigger in plan:
            own = self.steps_after(trigger)
            if own and own not in seen:
                seen.append(own)
                steps.extend(own)
        if disarmed_mode:
            steps.extend(self.steps_disarmed(disarmed_mode))
        if not steps or self._run is not None or self._ctl.state == AlarmControlPanelState.TRIGGERED:
            return False
        run: dict[str, Any] = {"trigger": plan[0] if plan else str(disarmed_mode), "index": 0, "test": False, "after": True, "snapshot": {}, "sonos": [], "steps": steps}
        self._run = run
        self._begin(run)
        return True

    # ----- Aktionen bei einem stillen Alarm (1.62.0) -----

    @callback
    def _on_event(self, kind: str, data: dict[str, Any]) -> None:
        if kind == "sensor_report":
            self.hass.async_create_task(self._start_report(data.get("scope")))
        elif kind == "sensor_again":
            self.hass.async_create_task(self._realarm())

    # ----- Nachalarm (1.87.0, Entscheid des Nutzers 2026-11-24, Code-Review H2) -----

    def _alarm_done(self) -> bool:
        """Sind die Aktionen des laufenden Alarms durchgelaufen (alle Schritte, Töne nebenher und vorgemerkte Gegendienste)?"""
        run = self._run
        if run is None:
            return True
        if run.get("test") or run.get("after") or self._begun is not run:
            return False
        tasks = [self._task, self._also_task, *self._side_tasks]
        return all(task is None or task.done() for task in tasks)

    async def _realarm(self) -> None:
        """
        Ein weiterer Sensor im Zustand "Alarm": ist der Nachalarm der Anlage eingeschaltet und sind die Alarmaktionen durchgelaufen, starten sie
        erneut, höchstens realarm_count-Mal je Alarm. Der Zustand vor dem ersten Alarm bleibt der Stand für das Deaktivieren. Laufen die Aktionen
        noch (Sirene, "bis deaktiviert"), geschieht nichts: der Alarm ist ja noch hörbar. Zusatz: ein Fehler hier steht nur im Log.
        """
        try:
            if not self.entry.options.get(CONF_REALARM_ENABLED) or self._ctl.state != AlarmControlPanelState.TRIGGERED:
                return
            if self._realarms >= realarm_count(self.entry.options) or not self._alarm_done():
                return
            plan = self._plan or list(self._ctl.alarm_plan())
            trigger = plan[0]
            if not self.steps(trigger):
                return
            self._realarms += 1
            self._ctl.emit("realarm", count=self._realarms)
            previous, self._run = self._run, None
            self._begun = None
            self._watch_start(trigger)
            await self._start(trigger, previous)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - der Nachalarm ist Zusatz
            _LOGGER.exception("%s: the alarm actions could not be started again", self.entry.title)

    def steps_report(self, scope: str | None) -> list[dict[str, Any]]:
        """Schritte "Stiller Alarm" für den Auslöser: den Modus, in dem die Anlage scharf ist, oder "always" (immer aktiver Sensor)."""
        return list((self.entry.options.get(CONF_WORKFLOWS_REPORT) or {}).get(scope or "") or [])

    async def _start_report(self, scope: str | None) -> None:
        """Aktionen eines stillen Alarms starten. Sie sind Zusatz: scheitert ihr Start, steht es im Log, Automat und Alarm laufen weiter."""
        try:
            await self.async_run_report(scope)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - Sicherheitsregel: die Aktionen eines stillen Alarms dürfen Anlage und Alarm nie berühren
            _LOGGER.exception("%s: starting the actions of the silent alarm failed; the alarm system goes on", self.entry.title)

    async def async_run_report(self, scope: str | None) -> bool:
        """
        Aktionen "Stiller Alarm" starten: ein Sensor auf "Stiller Alarm" hat angesprochen (der Automat meldet es je Sensor höchstens einmal
        in REPORT_THROTTLE Sekunden). Nie ein Alarm. Der Lauf verhält sich wie die Aktionen beim Scharfschalten: unter Aufsicht, endet von
        selbst, stellt nichts zurück. Vorrang haben ein Alarm, ein Test und eine laufende Verzögerung (ihre Töne zählen die Zeit zum Alarm
        oder zum Scharfschalten herunter): dann startet er nicht. Jeden anderen Lauf neben dem Alarm ersetzt er (Aktivierungston, Aktionen
        nach dem Quittieren, ein früherer stiller Alarm). Ein Alarm bricht ihn ab, Deaktivieren ebenso.
        """
        steps = self.steps_report(scope)
        if not steps or not self._report_possible(scope):
            return False
        if self._run is not None:
            if not self._run.get("after") or self._run.get("phase") in ("arming", "pending"):
                return False
            await self._stop_side_run()
        if self._run is not None or not self._report_possible(scope):
            return False  # währenddessen begann ein Alarm oder eine Verzögerung, oder die Anlage wurde deaktiviert
        run: dict[str, Any] = {"trigger": str(scope), "index": 0, "test": False, "after": True, "phase": "report", "snapshot": {}, "sonos": [], "steps": steps}
        self._run = run
        try:
            self._begin(run)
        except Exception:
            if self._run is run:
                self._run = None  # kein halber Lauf bleibt stehen (er gälte sonst als laufend)
            raise
        return True

    def _report_possible(self, scope: str | None) -> bool:
        """Gilt der stille Alarm noch? Nie im Alarm; die Aktionen eines Modus nur, solange die Anlage in diesem Modus scharf ist."""
        state = str(self._ctl.state)
        if state == AlarmControlPanelState.TRIGGERED:
            return False
        return scope == WORKFLOW_ALWAYS or (state in ARMED_STATES and self._ctl.mode == scope)

    def steps_disarmed(self, mode: str | None) -> list[dict[str, Any]]:
        """Schritte "Beim Deaktivieren" für den Modus, der scharf war (nicht für "Immer aktiv": dort wird nie scharf geschaltet)."""
        return list((self.entry.options.get(CONF_WORKFLOWS_DISARMED) or {}).get(mode or "") or [])

    async def _on_disarmed(self, mode: str | None) -> None:
        """
        Die Anlage wurde deaktiviert (nicht aus einem Alarm, den _end behandelt): ein Ton der Verzögerung oder der Aktivierungston,
        der noch läuft, wird still, danach laufen die Aktionen "Beim Deaktivieren". Sie sind Zusatz: scheitert etwas hier, steht
        es im Log, Automat und Alarm laufen weiter.
        """
        try:
            if self._run is not None and self._run.get("phase") in SIDE_PHASES:
                await self._stop_side_run()
            await self.async_run_disarmed(mode)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - Sicherheitsregel: nichts davon darf den Alarm oder das Scharfschalten berühren
            _LOGGER.exception("%s: starting the actions when disarming failed; the alarm system goes on", self.entry.title)

    async def async_run_disarmed(self, mode: str | None) -> bool:
        """
        Aktionen "Beim Deaktivieren" starten (1.27.0): die Schritte des Modus, der gerade scharf war (zum Beispiel ein
        Deaktivierungston). Sie laufen immer, wenn deaktiviert wird, auch mitten in der Verzögerung. Der Lauf verhält sich wie die
        Aktionen beim Scharfschalten: unter Aufsicht, endet von selbst, stellt nichts zurück. Scharfschalten oder ein Alarm beenden
        ihn sofort (sie ersetzen jeden Lauf neben dem Alarm).
        """
        steps = self.steps_disarmed(mode)
        if not steps or self._ctl.state != AlarmControlPanelState.DISARMED:
            return False
        if self._run is not None:
            if not self._run.get("after"):
                return False  # ein Test läuft
            await self._stop_side_run()
        if self._ctl.state != AlarmControlPanelState.DISARMED or self._run is not None:
            return False  # währenddessen wurde wieder scharf geschaltet oder ein Alarm begann
        run: dict[str, Any] = {"trigger": str(mode), "index": 0, "test": False, "after": True, "phase": "disarmed", "snapshot": {}, "sonos": [], "steps": steps}
        self._run = run
        try:
            self._begin(run)
        except Exception:
            if self._run is run:
                self._run = None  # kein halber Lauf bleibt stehen (er gälte sonst als laufend)
            raise
        return True

    @callback
    def _finish_after(self, run: dict[str, Any], *_: Any) -> None:
        """Die Aktionen nach dem Quittieren sind durch (auch die, die nebenher liefen): der Lauf endet von selbst, es gibt nichts zurückzustellen."""
        if self._run is not run:
            return
        pending = [task for task in self._side_tasks if not task.done()]
        if pending:
            for task in pending:
                task.add_done_callback(partial(self._finish_after, run))
            return
        self._run = None
        self._begun = None
        self._task = None
        self.hass.async_create_task(self._store.async_remove())

    async def _start(self, trigger: str, previous: dict[str, Any] | None = None) -> None:
        """Ablauf beim Alarm starten. Scheitert der Start selbst, beginnt der Wächter die Schritte sofort (nicht erst nach der Startgrenze)."""
        try:
            await self.async_run(trigger, previous=previous)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - Sicherheitsregel: die Schritte laufen in jedem Fall
            _LOGGER.exception("%s: starting the alarm actions failed; the watchdog starts them", self.entry.title)
            self._check_started(trigger)

    # ----- Ablauf -----

    async def async_run(self, trigger: str, test: bool = False, steps: list[dict[str, Any]] | None = None, previous: dict[str, Any] | None = None) -> bool:
        """
        Ablauf starten. Mit `steps` (nur im Test) läuft genau diese Liste statt des gespeicherten Ablaufs: so lässt sich ein
        einzelner Schritt testen, auch einer, der noch nicht gespeichert ist. Test und Stopp wie beim ganzen Ablauf.

        Jedes Warten hier steht unter Aufsicht des Wächters (`_watched`): nichts vor dem ersten Schritt kann ihn länger als
        seine Grenze aufhalten (tests/test_action_hang.py prüft das auch am Quelltext).
        """
        # Nachalarm: der durchgelaufene Lauf desselben Alarms gibt seinen Stand von vorher weiter (Deaktivieren stellt auf den Stand vor dem ersten
        # Alarm zurück); seine Aufgaben sind schon zu Ende
        inherited: dict[str, Any] | None = previous if not test else None
        if self._run is not None and not test and (self._run.get("test") or self._run.get("after")):
            # Echter Alarm während eines Tests: der Test endet sofort, der echte Ablauf startet. Sonst liefe im Testfenster
            # weder der Ablauf noch die Alarmmeldung (Sicherheitsregel: im Zweifel alarmieren)
            inherited = self._run
            # Seine Töne stellen die Lautsprecher nicht mehr zurück, die der Alarm übernimmt (Voralarm vor dem Alarmton auf demselben
            # Lautsprecher): ihr Zustand von vorher geht an den Alarm (1.87.0, Code-Review K1)
            inherited["yield"] = True
            try:
                await self._watched(self._end_test(), SNAPSHOT_TIMEOUT, "test")
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - das Ende des Tests darf den echten Alarm nie verhindern
                _LOGGER.exception("%s: ending the test of the alarm actions failed; the real alarm goes on", self.entry.title)
            self._run = None  # auch wenn das Ende des Tests hängt: ab hier zählt nur der echte Alarm
        if self._run is not None:
            return False  # läuft schon (kein doppelter Ablauf bei mehreren Auslösungen)
        override = steps if test and steps else None
        steps = override or self.steps(trigger)
        if not steps:
            return False
        run: dict[str, Any] = {"trigger": trigger, "index": 0, "test": test, "snapshot": {}, "sonos": [], "steps": override}
        also = None if test else self._also(trigger)
        if also:
            # Zweiter Ablauf neben dem Hauptablauf, mit eigenem Stand (Schritt, Ende einer Wartezeit) für den Neustart
            run["also"] = {"trigger": also, "index": 0}
            steps = [*steps, *self.steps(also)]  # der Schnappschuss der Geräte umfasst beide Abläufe
        self._run = run
        try:
            await self._watched(self._prepare(run, steps, inherited), start_budget() - WATCHDOG_GRACE, "prepare")
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - die Vorbereitung ist Zusatz: scheitert sie, starten die Schritte ohne sie
            _LOGGER.exception("%s: preparing the alarm actions failed; they start without the snapshot", self.entry.title)
        if self._run is not run:
            return False  # währenddessen deaktiviert: nichts mehr starten
        self._begin(run)
        if test:
            self._test_timer = async_call_later(self.hass, TEST_SECONDS, partial(self._test_over))
        return True

    async def _end_test(self) -> None:
        """
        Test beenden, weil ein echter Alarm kommt: Schritte abbrechen, nichts zurückstellen. Das Zurückstellen könnte hängen
        und dürfte ein Gerät nicht wieder ausschalten, das der echte Alarm gerade einschaltet; der echte Lauf übernimmt
        stattdessen den Schnappschuss des Tests (siehe _prepare).
        """
        self._cancel_timers()
        self._run = None
        await self._cancel_task()

    async def _prepare(self, run: dict[str, Any], steps: list[dict[str, Any]], inherited: dict[str, Any] | None = None) -> None:
        """
        Vor dem ersten Schritt: Zustand der Geräte merken (für die Wiederherstellung beim Deaktivieren) und den Lauf speichern
        (für den Neustart). Alles hier ist Zusatz: scheitert oder hängt es, starten die Schritte trotzdem (Wächter).
        """
        entities = sorted({e for s in steps for e in step_entities(s)})
        before = (inherited or {}).get("snapshot") or {}
        sonos_before = [e for e in (inherited or {}).get("sonos") or [] if isinstance(e, str)]
        # Geräte, die ein endender Lauf (voriger Alarm, Voralarm) noch zurückstellen wollte: es gilt ihr Zustand vor jenem Lauf, nicht der
        # jetzige (der ist noch der Alarmzustand). Ihr Schnappschuss bei Sonos ist schon gemacht: nicht mit dem Alarmzustand überschreiben.
        taken, taken_sonos = self._taken_over(entities)
        # Nach einem abgebrochenen Test gilt dessen Schnappschuss: er zeigt die Geräte vor dem Test, nicht mitten im Test
        run["snapshot"] = {**self._snapshot(entities), **before, **taken}
        known = {*sonos_before, *taken_sonos}
        run["sonos"] = sorted({*known, *await self._sonos_snapshot([e for e in entities if e not in known and e not in taken])})
        run["prepared"] = True
        # Was ein endender Lauf während des Merkens übergeben hat, gehört ebenfalls dazu (ab jetzt geht es direkt in diesen Lauf)
        late, late_sonos = self._taken_over([])
        run["snapshot"] = {**run["snapshot"], **late}
        run["sonos"] = sorted({*run["sonos"], *late_sonos})
        # Ein beendeter Test oder Lauf daneben hinterlässt vorgemerkte Gegendienste (Steckdose mit Sirene): der echte Alarm übernimmt sie
        # mit ihrer Zeit, sie gehen nie verloren und enden nie früher als eingestellt
        for entry in list((inherited or {}).get("undo") or []):
            run.setdefault("undo", []).append(entry)
            self._arm_undo(run, entry)
        if self._run is not run:
            return
        await self._save_run(run)

    async def _save_run(self, run: dict[str, Any]) -> None:
        """
        Stand vor dem ersten Schritt speichern (für die Wiederherstellung nach einem Neustart). Die Ablage darf den Alarm nie
        aufhalten: hängt sie, geht es nach SNAPSHOT_TIMEOUT ohne sie weiter (das Schreiben läuft weiter), scheitert sie, sofort.
        """
        task = self.hass.async_create_task(self._store.async_save(run), f"alarmageddon workflow store {self.entry.entry_id}")
        done, _pending = await asyncio.wait({task}, timeout=SNAPSHOT_TIMEOUT)
        if not done:
            task.add_done_callback(lambda t: t.cancelled() or t.exception())  # Ausnahme als abgeholt markieren
            _LOGGER.error("%s: saving the state of the alarm actions took too long; the actions start without it", self.entry.title)
            return
        if not task.cancelled() and task.exception() is not None:
            _LOGGER.error("%s: saving the state of the alarm actions failed (%s); the actions start without it", self.entry.title, task.exception())

    @staticmethod
    def _runs_alongside(step: dict[str, Any]) -> bool:
        """Schritt läuft nebenher, der nächste startet sofort (Standard für Gerät und Ton, siehe step_waits)."""
        return not step_waits(step)

    # ----- Wächter: Aufsicht über Start, Vorbereitung, jeden Schritt und den Ablauf als Ganzes -----

    async def _watched(self, coro: Any, budget: float, label: str) -> bool:
        """
        Etwas abwarten, aber höchstens `budget` Sekunden. Dauert es länger, geht der Ablauf ohne es weiter: die Aufgabe läuft
        im Hintergrund zu Ende (ein Skript soll fertig werden dürfen) und endet spätestens beim Deaktivieren; der Eingriff
        steht im Log und auf der Zeitachse des Alarms. Gibt zurück, ob es rechtzeitig fertig wurde; ein Fehler des
        Beaufsichtigten geht an den Aufrufer.
        """
        task = self._background(coro)
        try:
            done, _pending = await asyncio.wait({task}, timeout=budget)
        except asyncio.CancelledError:
            task.cancel()
            raise
        if not done:
            self._late.add(task)
            task.add_done_callback(self._late.discard)
            task.add_done_callback(_retrieve)
            _LOGGER.error("%s: watchdog: '%s' did not finish within %.1f s; the alarm actions go on without waiting", self.entry.title, label, budget)
            self._note(label)
            return False
        if task.cancelled():
            return False
        task.result()
        self._selftest_hung_ok(label)
        return True

    def _note(self, label: str) -> None:
        """Eingriff des Wächters auf der Zeitachse des Alarms und im Selbsttest festhalten (nie mit einem Fehler)."""
        try:
            self._ctl.record("step_failed", action=label, reason="watchdog")
            selftest.async_note(self.hass, self.entry.entry_id, "step_hung", label, place=self._selftest_place(), label=label)
        except Exception:  # noqa: BLE001 - der Wächter selbst darf nie scheitern
            _LOGGER.exception("%s: the watchdog could not record its intervention", self.entry.title)

    # ----- Selbsttest (1.65.0): Ergebnis jedes Aufrufs, synchron und nie mit einem Fehler (der Alarm geht immer vor) -----

    def _selftest_place(self) -> dict[str, Any]:
        """Wo der Aufruf lief: Liste (Alarm, nach dem Quittieren, beim Scharfschalten ...), Auslöser und ob es ein Test war."""
        run = self._run or {}
        return {"area": "run", "list": str(run.get("phase") or ("after" if run.get("after") else "alarm")),
                "trigger": str(_LANE.get() or run.get("trigger") or ""), "test": bool(run.get("test"))}

    def _selftest(self, ok: bool, label: str, targets: Any, reason: str = "") -> None:
        """
        Gescheitert oder ohne Antwort: der Selbsttest hält es fest. Geklappt: ein Befund desselben Aufrufs (Dienst und Geräte) ist behoben,
        ob im Alarm oder im Test (Entscheid des Nutzers, 2026-11-18).
        """
        try:
            subject = selftest.call_subject(label, targets)
            if ok:
                selftest.async_resolve(self.hass, self.entry.entry_id, "step_failed", subject)
            else:
                selftest.async_note(self.hass, self.entry.entry_id, "step_failed", subject, place=self._selftest_place(), service=label,
                                    targets=selftest.call_targets(targets), reason=reason)
        except Exception:  # noqa: BLE001 - der Selbsttest hält nie einen Schritt auf
            _LOGGER.exception("%s: the self-test could not record the result of %s", self.entry.title, label)

    def _selftest_hung_ok(self, label: str) -> None:
        try:
            selftest.async_resolve(self.hass, self.entry.entry_id, "step_hung", label)
        except Exception:  # noqa: BLE001
            _LOGGER.exception("%s: the self-test could not clear %s", self.entry.title, label)

    def _also(self, trigger: str) -> str | None:
        """Zweiter Ablauf des laufenden Alarms neben `trigger` (aus dem Plan des Automaten), wenn es einen gibt."""
        try:
            plan = self._ctl.alarm_plan()
        except Exception:  # noqa: BLE001 - der Hauptablauf läuft in jedem Fall
            _LOGGER.exception("%s: the second flow of the alarm actions cannot be determined", self.entry.title)
            return None
        return next((flow for flow in plan if flow != trigger and self.steps(flow)), None)

    @staticmethod
    def _state(run: dict[str, Any], lane: str | None) -> dict[str, Any]:
        """Gespeicherter Stand eines Ablaufs: der Lauf selbst für den Hauptablauf, `run["also"]` für den zweiten."""
        also = run.get("also")
        if lane is not None and isinstance(also, dict) and also.get("trigger") == lane and lane != run.get("trigger"):
            return also
        return run

    @callback
    def _begin(self, run: dict[str, Any]) -> bool:
        """Die Schritte eines Laufs starten, genau einmal: nach der Vorbereitung oder, wenn die ausbleibt, durch den Wächter."""
        if self._run is not run or self._begun is run:
            return False
        self._begun = run
        self._spawn(run, 0)
        also = run.get("also")
        if isinstance(also, dict) and also.get("trigger"):
            self._spawn(run, 0, str(also["trigger"]))
        return True

    @callback
    def _spawn(self, run: dict[str, Any], start: int, lane: str | None = None) -> None:
        """Einen Ablauf ab `start` starten: den Hauptablauf oder (mit `lane`) den zweiten. Beide stehen unter derselben Aufsicht."""
        main = lane is None or lane == run["trigger"]
        trigger = run["trigger"] if main else lane
        self._positions[trigger] = start
        task = self._background(self._execute(trigger, start))
        if main:
            self._task = task
        else:
            self._also_task = task
        task.add_done_callback(partial(self._on_flow_done, run, trigger))

    @callback
    def _on_flow_done(self, run: dict[str, Any], trigger: str, task: asyncio.Task) -> None:
        """
        Aufsicht über den Ablauf als Ganzes: Endet er mit einem Fehler (ein Fehler ausserhalb eines Schritts, den die Schleife
        nicht abfängt), geht es mit dem nächsten Schritt weiter. Jeder Abbruch rückt um mindestens einen Schritt vor: nach dem
        letzten Schritt ist Schluss, eine Endlosschleife ist ausgeschlossen. Gilt für jeden der beiden Abläufe für sich.
        """
        main = trigger == run["trigger"]
        if task.cancelled() or self._run is not run or (self._task if main else self._also_task) is not task:
            return
        error = task.exception()
        if error is None:
            if run.get("after"):
                self._finish_after(run)
            elif run.get("test") and self._sound_only(run):
                # Test von Tönen: ist alles gespielt, endet der Test (der Stopp-Knopf im Panel verschwindet), nicht erst nach dem Zeitfenster
                self._background(self._end_test_when_idle(run))
            return
        position = self._positions.get(trigger, 0)
        _LOGGER.error("%s: watchdog: the alarm actions (%s) stopped unexpectedly at step %s; continuing with the next step",
                      self.entry.title, trigger, position + 1, exc_info=error)
        self._note("flow")
        try:
            count = len((run.get("steps") if main else None) or self.steps(trigger))
        except Exception:  # noqa: BLE001 - ohne lesbare Schritte gibt es nichts fortzusetzen
            return
        if position + 1 < count:
            self._spawn(run, position + 1, trigger)

    @callback
    def _watch_start(self, trigger: str) -> None:
        """Aufsicht über den Start: läuft neben dem Start her und greift ein, wenn der erste Schritt ausbleibt."""
        if self._guard is not None:
            self._guard.cancel()
        self._guard = self._background(self._start_guard(trigger))

    async def _start_guard(self, trigger: str) -> None:
        # Echte Zeit, nicht die Zeitgeber von HA: der Wächter misst, wie lange der Start wirklich dauert
        await asyncio.sleep(start_budget())
        self._guard = None
        self._check_started(trigger)

    @callback
    def _check_started(self, trigger: str) -> None:
        """
        Letzte Sicherung: Ist der Alarm noch aktiv und hat kein Schritt begonnen, starten die Schritte jetzt ohne Vorbereitung
        (kein Schnappschuss: die Geräte kehren dann beim Deaktivieren nicht von selbst zurück, aber die Sirene läuft).
        """
        if self._ctl.state != AlarmControlPanelState.TRIGGERED:
            return
        run = self._run
        if run is not None and not run.get("test") and not run.get("after") and self._begun is run:
            return  # die Schritte laufen oder sind durchgelaufen
        try:
            steps = self.steps(trigger)
        except Exception:  # noqa: BLE001 - ohne lesbare Schritte gibt es nichts zu starten
            _LOGGER.exception("%s: watchdog: the alarm actions cannot be read", self.entry.title)
            return
        if not steps:
            return
        _LOGGER.error("%s: watchdog: the alarm actions did not start within %.1f s; starting them now without preparation",
                      self.entry.title, start_budget())
        if run is None or run.get("test") or run.get("after"):
            # Kein Lauf (der Start ist gescheitert) oder noch der Test (sein Ende hängt): ein neuer Lauf, die Aufgaben des alten enden
            if run is not None:
                run["yield"] = True  # seine Töne geben die Lautsprecher an den Alarm ab (1.87.0)
            for task in self._take_tasks():
                task.add_done_callback(_retrieve)
            inherited = run or {}
            taken, taken_sonos = self._taken_over([])
            run = {"trigger": trigger, "index": 0, "test": False, "snapshot": {**dict(inherited.get("snapshot") or {}), **taken},
                   "sonos": sorted({*(inherited.get("sonos") or []), *taken_sonos}), "steps": None, "prepared": True}
            also = self._also(trigger)
            if also:
                run["also"] = {"trigger": also, "index": 0}
            self._run = run
        self._note("start")
        self._begin(run)

    def _background(self, coro: Any) -> asyncio.Task:
        # Hintergrund-Task: Ein Ablauf kann minutenlang warten; HA soll beim Start oder in Tests nicht auf ihn warten
        return self.hass.async_create_background_task(coro, f"alarmageddon workflow {self.entry.entry_id}")

    async def _sleep(self, seconds: float) -> None:
        """Warten über die Zeitgeber von HA (Ziel ist eine @callback-Funktion, keine lambda, siehe LEARNINGS)."""
        if seconds <= 0:
            return  # nichts zu warten (auch: die Zeit eines Schritts war beim Wiederanlauf schon um)
        future = self.hass.loop.create_future()

        @callback
        def _done(_now: Any = None) -> None:
            if not future.done():
                future.set_result(None)

        unsub = async_call_later(self.hass, seconds, _done)
        try:
            await future
        finally:
            unsub()

    def _sound_only(self, run: dict[str, Any]) -> bool:
        """Besteht der Test nur aus Tönen (und Meldung, Warten)? Bei Geräteaktionen bleibt er bis zum Ende des Zeitfensters: der Nutzer soll die Wirkung sehen."""
        try:
            steps = run.get("steps") or self.steps(run["trigger"])
            return all(step.get("type") in ("sound", "chime", "dechime", "prealarm", "notify", "wait") for step in flat_steps(steps))
        except Exception:  # noqa: BLE001 - ohne lesbare Schritte bleibt es beim Zeitfenster
            return False

    async def _end_test_when_idle(self, run: dict[str, Any]) -> None:
        """Wartet, bis die Töne des Tests zu Ende gespielt sind (sie laufen nebenher), und beendet den Test dann. Nur ein Test, nie ein echter Ablauf."""
        pending = {task for task in self._side_tasks if not task.done()}
        if pending:
            await asyncio.wait(pending)
        if self._run is run and run.get("test"):
            self.hass.async_create_task(self.async_stop())

    @callback
    def _test_over(self, _now: Any = None) -> None:
        self._test_timer = None
        if self._run and self._run.get("test"):
            self.hass.async_create_task(self.async_stop())

    async def _execute(self, trigger: str, start: int) -> None:
        """
        Die Schritte der Reihe nach. Jeder abgewartete Schritt läuft unter Aufsicht des Wächters (`_watched` mit der Grenze aus
        step_budget): keiner hält den nächsten länger auf als seine eigene Grenze, gleich aus welchem Grund.
        """
        _LANE.set(trigger)  # gilt für diese Aufgabe und alle, die sie startet (Schritte unter Aufsicht)
        main = trigger == (self._run or {}).get("trigger")
        steps = ((self._run or {}).get("steps") if main else None) or self.steps(trigger)
        test = bool(self._run and self._run.get("test"))
        try:
            self._resume_endless(trigger, steps, start, test)
        except Exception:  # noqa: BLE001 - Sicherheitsregel: die Schritte laufen in jedem Fall
            _LOGGER.exception("%s: resuming the groups of the alarm actions failed", self.entry.title)
        try:
            self._resume_tones(trigger, steps, start, test)
        except Exception:  # noqa: BLE001 - Sicherheitsregel: die Schritte laufen in jedem Fall
            _LOGGER.exception("%s: resuming the tones of the alarm actions failed", self.entry.title)
        for index in range(start, len(steps)):
            if self._run is None:
                return
            self._positions[trigger] = index  # zuerst und ohne Fehlerquelle: hier macht der Wächter nach einem Abbruch weiter
            step = steps[index]
            try:
                # Ein Ton, der der Verzögerung folgt, bekommt hier seine Dauer (die Restzeit); ist sie um, entfällt der Schritt
                timed = self._timed(step)
            except Exception:  # noqa: BLE001 - Sicherheitsregel: ohne Restzeit gilt die Dauer des Schritts
                _LOGGER.exception("%s: the duration of step %s cannot be determined", self.entry.title, index + 1)
                timed = step
            if timed is None:
                continue
            step = timed
            try:
                # Mitschreiben (gespeicherter Stand für den Neustart, Zeitachse) ist Zusatz: ein Fehler darin hält keinen Schritt auf
                self._state(self._run, trigger)["index"] = index
                self._store.async_delay_save(lambda: self._run or {}, 0)
                self._record(step, test)
            except Exception:  # noqa: BLE001 - Sicherheitsregel: die Schritte laufen in jedem Fall
                _LOGGER.exception("%s: bookkeeping for step %s of the alarm actions failed", self.entry.title, index + 1)
            try:
                if self._runs_alongside(step):
                    # Nicht abwarten: läuft nebenher, der nächste Schritt startet sofort (langer Alarmton, träges Gerät)
                    if step.get("type") == "group" and step.get("mode") == "until_disarmed":
                        self._note_endless(trigger, index, test)
                    elif step.get("type") in TONE_RESUME_TYPES:
                        self._note_tone(trigger, index, step, test)
                    task = self._background(self._side(step, test, index))
                    self._side_tasks.add(task)
                    task.add_done_callback(self._side_tasks.discard)
                    continue
                await self._watched(self._step(step, test), step_budget(step), self._label(step))
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - Sicherheitsregel: ein fehlerhafter Schritt stoppt die anderen nicht
                _LOGGER.exception("%s: step %s of the alarm actions failed", self.entry.title, index + 1)

    @staticmethod
    def _label(step: dict[str, Any]) -> str:
        """Bezeichnung eines Schritts für Log und Zeitachse (ohne Daten des Schritts)."""
        kind = str(step.get("type") or "?")
        return str(step.get("action") or kind) if kind == "action" else kind

    async def _side(self, step: dict[str, Any], test: bool, index: int) -> None:
        """Schritt ohne Abwarten: Fehler werden nur protokolliert, sie halten nichts auf."""
        try:
            # Nicht fortsetzbar: ein Schritt nebenher läuft nach einem Neustart nicht weiter (nur die Schritte danach)
            await self._step(step, test, resumable=False)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - Sicherheitsregel: ein fehlerhafter Schritt stoppt die anderen nicht
            _LOGGER.exception("%s: step %s of the alarm actions (not awaited) failed", self.entry.title, index + 1)

    def _healthcheck(self, step: dict[str, Any], test: bool) -> None:
        """
        Aktion "HealthCheck melden" (1.77.0): der Aufruf läuft als eigene Aufgabe des HealthCheck (nie abwarten, höchstens HEALTHCHECK_TIMEOUT), ein Fehler
        hier hält keinen anderen Schritt auf. Es gibt den Dienst nicht mehr oder der Zusatz passt nicht zur Adresse: nichts geht hinaus, der Selbsttest
        findet es in den Aktionen (`healthcheck_missing`) und dieser Schritt vermerkt es als Befund der Laufzeit.
        """
        try:
            healthcheck = self.hass.data.get(DATA_HEALTHCHECK)
            if healthcheck is None or healthcheck.async_report(str(step.get("check_id") or ""), str(step.get("suffix") or ""), test=test) is None:
                _LOGGER.warning("%s: a health check step of the alarm actions found no service or its suffix does not fit", self.entry.title)
                self._selftest(False, "healthcheck.report", [], "no_service")
            else:
                self._selftest(True, "healthcheck.report", [])  # derselbe Aufruf klappt wieder: der Befund ist behoben
                if not test and (step.get("repeat") is True or step.get("pause") is True):
                    self._hc_hold({"hid": str(step.get("check_id") or ""), "suffix": str(step.get("suffix") or ""), "repeat": step.get("repeat") is True, "pause": step.get("pause") is True})
        except Exception:  # noqa: BLE001 - Sicherheitsregel: ein fehlerhafter Schritt stoppt die anderen nicht
            _LOGGER.exception("%s: a health check step of the alarm actions failed", self.entry.title)

    # Wiederholen und Pausieren bei "HealthCheck melden" (1.80.0): nur im Ablauf eines echten Alarms (nie im Test, nie in den Läufen neben dem Alarm). Der Eintrag
    # steht im gespeicherten Stand des Laufs (run["hc"]), damit er einen Neustart mitten im Alarm übersteht; er endet mit dem Alarm (async_stop). Nichts hier hält
    # einen Schritt oder den Alarm auf: alles läuft im HealthCheck als Zeitgeber und Hintergrundaufgabe, jeder Fehler steht nur im Log.
    def _hc_hold(self, entry: dict[str, Any], now: bool = False) -> None:
        run = self._run
        if run is None or run.get("test") or run.get("after") or run.get("phase"):
            return
        entries = run.setdefault("hc", [])
        if entry not in entries:
            entries.append(entry)
        self._hc_apply(entries, now)

    def _hc_apply(self, entries: list[dict[str, Any]], now: bool = False) -> None:
        self.hass.data.setdefault(DATA_HEALTHCHECK_HOLDS, {})[self.entry.entry_id] = [dict(e, now=now) for e in entries]
        if (healthcheck := self.hass.data.get(DATA_HEALTHCHECK)) is not None:
            healthcheck.async_sync_holds()

    def _hc_release(self, ended: bool) -> None:
        """`ended`: der Alarm ist vorbei (die Lebenszeichen laufen wieder an); sonst nur ein Neuladen (der Alarm geht weiter)."""
        try:
            if self.hass.data.setdefault(DATA_HEALTHCHECK_HOLDS, {}).pop(self.entry.entry_id, None) is not None and (healthcheck := self.hass.data.get(DATA_HEALTHCHECK)) is not None:
                healthcheck.async_sync_holds(ended=ended)
        except Exception:  # noqa: BLE001 - das Ende des Alarms geht in jedem Fall weiter
            _LOGGER.exception("%s: the health check holds of the alarm could not be released", self.entry.title)

    def _record(self, step: dict[str, Any], test: bool) -> None:
        """Zeitachse des Alarms: welcher Schritt wann gestartet ist (ohne Daten, nur Art, Aktion und Ziele)."""
        entry: dict[str, Any] = {"step": step.get("type"), "test": test}
        if step.get("type") == "action":
            entry["action"] = step.get("action")
            entry["targets"] = list(step.get("target") or [])
        elif step.get("type") in ("sound", "chime", "dechime", "prealarm"):
            entry["targets"] = list(step.get("players") or [])
            entry["sound"] = step.get("sound")
        elif step.get("type") == "wait":
            entry["seconds"] = step.get("seconds")
        elif step.get("type") == "group":
            entry["mode"] = step.get("mode")
            entry["count"] = group_rounds(step) if step.get("mode") == "count" else None
            entry["seconds"] = step.get("seconds") if step.get("mode") == "duration" else None
            entry["steps"] = len(group_steps(step))
        self._ctl.record("step", **entry)

    def _remaining(self, seconds: float) -> float:
        """
        Verbleibende Zeit eines abgewarteten Schritts mit eingestellter Dauer (Warten, Alarmton mit Dauer).

        Die Dauer bestimmt der Nutzer, und sie zählt ab dem ersten Start des Schritts: Beim ersten Start wird das Ende gemerkt
        (im gespeicherten Stand des Laufs); nach einem Neuladen (Einstellungen mitten im Alarm gespeichert) oder einem
        Neustart von Home Assistant läuft nur der Rest. So schaltet "Sirene ein, 3 Minuten warten, Sirene aus" auch dann
        nach 3 Minuten aus und nicht erst nach einer vollen Wartezeit obendrauf (rechtlich wichtig: die Sirene endet nach
        der vom Betreiber gewählten Zeit).
        """
        run = self._run
        if run is None:
            return float(seconds)
        now = dt_util.utcnow()
        lane = _LANE.get() or run.get("trigger")
        state = self._state(run, lane)  # jeder Ablauf merkt das Ende seines eigenen Schritts
        position = self._positions.get(lane, 0)
        saved = state.get("until")
        if isinstance(saved, dict) and saved.get("index") == position:
            end = dt_util.parse_datetime(str(saved.get("at") or ""))
            if end is not None:
                # Nie länger als eingestellt (auch nicht nach einem Sprung der Uhr), nie negativ
                return min(float(seconds), max(0.0, (end - now).total_seconds()))
        state["until"] = {"index": position, "at": (now + timedelta(seconds=seconds)).isoformat()}
        try:
            self._store.async_delay_save(lambda: self._run or {}, 0)
        except Exception:  # noqa: BLE001 - Mitschreiben hält den Schritt nie auf
            _LOGGER.exception("%s: saving the end of a timed step failed", self.entry.title)
        return float(seconds)

    async def _step(self, step: dict[str, Any], test: bool, resumable: bool = True) -> None:
        """Einen Schritt ausführen. `resumable`: abgewarteter Schritt (seine Dauer zählt über Neuladen und Neustart hinweg)."""
        kind = step.get("type")
        if kind == "group":
            await self._group(step, test, resumable)
        elif kind == "wait":
            seconds = max(0, int(step.get("seconds", 0) or 0))
            await self._sleep(self._remaining(seconds) if resumable else seconds)
        elif kind == "notify":
            self._notifier.send_alarm(test=test, step=step)
        elif kind == "healthcheck":
            self._healthcheck(step, test)
        elif kind == "action":
            domain, _, service = str(step.get("action", "")).partition(".")
            data = dict(step.get("data") or {})
            if step.get("target"):
                data["entity_id"] = list(step["target"])
            if not test:
                await self._await_free([t for t in data.get("entity_id") or [] if isinstance(t, str)])
            await self._bounded(self.hass.services.async_call(domain, service, data, blocking=True), f"{domain}.{service}", targets=data.get("entity_id"))
            self._plan_undo(step, domain, service, data)
        elif kind == "sound":
            await self._play(step, resumable)
        elif kind == "chime" and step.get("delay"):
            # Aktivierungston, solange die Verzögerung läuft: durchgehend bis zu ihrem Ende (kein Abzählen ganzer Wiederholungen)
            await self._play({**step, "sound": step.get("sound", "tone_pip"), "duration": int(step.get("duration") or 3)})
        elif kind in ("chime", "dechime"):
            await self._play_whole(step)
        elif kind == "prealarm":
            # Voralarm: derselbe Weg wie der Alarmton, als Schleife über seine Dauer (nie endlos)
            await self._play({**step, "sound": step.get("sound", "pre_beep"), "duration": int(step.get("duration") or 20)})
        elif kind == "acknowledge":
            # Alarm quittieren: im Test nie (ein Test darf den echten Zustand nicht ändern). Der Stopp des Ablaufs läuft als eigene
            # Aufgabe (_on_change), dieser Schritt kehrt vorher zurück und wird nicht selbst abgebrochen
            if not test:
                self._ctl.acknowledge(self._notifier.text("by_step"))

    # ----- Aktions-Gruppe (1.59.0) -----
    #
    # Eine Gruppe wiederholt ihre Schritte in der Reihenfolge. Für jeden Schritt darin gilt dasselbe wie im Ablauf: abgewartete Schritte
    # stehen unter Aufsicht des Wächters (ihre Grenze aus step_budget), die anderen laufen nebenher, ein Fehler bricht nie die übrigen ab.
    # Deaktivieren, Quittieren und "Alarmton stumm" beenden die Gruppe sofort (ihre Aufgabe endet mit dem Lauf). Geräte, die ein Schritt
    # mit "Rückgängig" schaltet, kehren dabei in ihren vorherigen Zustand zurück (Schnappschuss vor dem ersten Schritt, step_entities).
    # - Anzahl: so viele Runden. Eine abgewartete Gruppe merkt sich die fertigen Runden im Lauf: nach Neuladen oder Neustart läuft nur der Rest.
    # - Dauer: die Zeit bestimmt der Nutzer und zählt ab dem ersten Start, auch über Neuladen und Neustart (_remaining). Eine Runde beginnt nur,
    #   wenn sie nach der Dauer der vorigen noch ganz in die Zeit passt: die Gruppe endet nie mitten in einer Runde (das Licht bliebe an) und
    #   läuft nie länger als eingestellt. Die erste Runde läuft immer ganz. Die Gruppe selbst dauert genau die eingestellte Zeit.
    # - "Nach einer Zeit rückgängig machen" in einer Gruppe (1.60.0, Entscheid des Nutzers 2026-11-17): je Gerät gilt nur ein vorgemerkter
    #   Gegendienst, jede Runde ersetzt den der vorigen (_plan_undo). So wächst die Liste nie mit den Runden; ist die Runde kürzer als die
    #   Zeit, schaltet das Gerät erst nach der letzten Runde zurück (oder sofort beim Deaktivieren, Quittieren, "Alarmton stumm").
    # - Bis deaktiviert: nur im Ablauf des Alarms, läuft immer nebenher und beginnt nach einem Neustart mitten im Alarm wieder (_resume_endless).
    # Jede Runde dauert mindestens GROUP_MIN_ROUND Sekunden. Auf die Zeitachse des Alarms kommen die Schritte nur in der ersten Runde.

    async def _group(self, step: dict[str, Any], test: bool, resumable: bool = True) -> None:
        inner = group_steps(step)
        run = self._run
        if not inner or run is None:
            return
        _IN_GROUP.set(True)  # gilt für diese Aufgabe (die der Gruppe) und alle, die sie startet
        mode = step.get("mode")
        rounds = group_rounds(step) if mode == "count" else None
        done = self._group_done(run) if resumable and rounds is not None else 0
        # Zwei Uhren für die Dauer: die Uhr von Home Assistant (wie _remaining, zählt über Neuladen und Neustart) und die des Prozesses
        # (springt nie). Ist nach einer von beiden die Zeit um, beginnt keine Runde mehr: auch ein Sprung der Uhr verlängert die Gruppe nie.
        now = dt_util.utcnow
        mono = self.hass.loop.time
        end = mono_end = None
        if mode == "duration":
            seconds = max(1, int(step.get("seconds", 0) or 0))
            left = self._remaining(seconds) if resumable else float(seconds)
            if left <= 0:
                return  # die Zeit war beim Wiederanlauf schon um
            end = now() + timedelta(seconds=left)
            mono_end = mono() + left
        last = 0.0
        first = True
        while self._run is run:
            if rounds is not None and done >= rounds:
                return
            if end is not None and not first and (now() + timedelta(seconds=last) > end or mono() + last > mono_end):
                # Die nächste Runde passte nicht mehr ganz in die Zeit: den Rest abwarten, damit die Gruppe genau so lange dauert wie eingestellt
                await self._sleep(min((end - now()).total_seconds(), mono_end - mono()))
                return
            started = now()
            for item in inner:
                if self._run is not run:
                    return
                try:
                    if first:
                        self._record(item, test)
                except Exception:  # noqa: BLE001 - Mitschreiben hält keinen Schritt auf
                    _LOGGER.exception("%s: bookkeeping for a step of a group failed", self.entry.title)
                try:
                    if self._runs_alongside(item):
                        task = self._background(self._side(item, test, -1))
                        self._side_tasks.add(task)
                        task.add_done_callback(self._side_tasks.discard)
                    else:
                        # Nie fortsetzbar: jede Runde zählt ihre Zeiten neu (die Dauer der Gruppe zählt die Gruppe selbst)
                        await self._watched(self._step(item, test, resumable=False), step_budget(item), self._label(item))
                except asyncio.CancelledError:
                    raise
                except Exception:  # noqa: BLE001 - Sicherheitsregel: ein fehlerhafter Schritt stoppt die anderen nicht
                    _LOGGER.exception("%s: a step of a group of the alarm actions failed", self.entry.title)
            first = False
            done += 1
            if resumable and rounds is not None:
                self._group_done(run, done)
            if rounds is not None and done >= rounds:
                return
            elapsed = max(0.0, (now() - started).total_seconds())
            last = max(elapsed, float(GROUP_MIN_ROUND))
            if elapsed < GROUP_MIN_ROUND:
                await self._sleep(GROUP_MIN_ROUND - elapsed)

    def _group_done(self, run: dict[str, Any], done: int | None = None) -> int:
        """Fertige Runden der abgewarteten Gruppe, an der der Ablauf steht: lesen oder (mit `done`) merken. Nie ein Hindernis."""
        try:
            lane = _LANE.get() or run.get("trigger")
            state = self._state(run, lane)
            position = self._positions.get(lane, 0)
            if done is None:
                saved = state.get("group")
                return max(0, int(saved.get("round", 0) or 0)) if isinstance(saved, dict) and saved.get("index") == position else 0
            state["group"] = {"index": position, "round": done}
            self._store.async_delay_save(lambda: self._run or {}, 0)
            return done
        except Exception:  # noqa: BLE001 - Mitschreiben hält die Gruppe nie auf
            _LOGGER.exception("%s: saving the round of a group failed", self.entry.title)
            return done or 0

    def _note_endless(self, trigger: str, index: int, test: bool) -> None:
        """Eine Gruppe "bis deaktiviert" beginnt: im Lauf ablegen (für den Neustart) und in diesem Prozess merken (nie doppelt starten)."""
        self._endless.add((trigger, index))
        run = self._run
        if run is None or test:
            return
        state = self._state(run, trigger)
        state["endless"] = sorted({*[i for i in state.get("endless") or [] if isinstance(i, int)], index})
        self._store.async_delay_save(lambda: self._run or {}, 0)

    def _note_tone(self, trigger: str, index: int, step: dict[str, Any], test: bool) -> None:
        """
        Ein Ton im Alarm beginnt nebenher (1.87.0, Code-Review H3): im Lauf ablegen, bis wann er spielt ("bis zum Deaktivieren" ohne Ende), und in
        diesem Prozess merken. Nach einem Neustart mitten im Alarm spielt er den Rest (_resume_endless); bis 1.86.x blieb er still.
        """
        self._endless.add((trigger, index))
        run = self._run
        if run is None or test:
            return
        try:
            duration = step.get("duration")
            if duration is None:
                return  # ältere Form mit Wiederholungen: wenige Sekunden, wird nicht fortgesetzt
            entry: dict[str, Any] = {"index": index}
            if int(duration) > 0:
                entry["until"] = (dt_util.utcnow() + timedelta(seconds=int(duration))).isoformat()
            state = self._state(run, trigger)
            state["tones"] = [t for t in state.get("tones") or [] if isinstance(t, dict) and t.get("index") != index] + [entry]
            self._store.async_delay_save(lambda: self._run or {}, 0)
        except Exception:  # noqa: BLE001 - Mitschreiben hält den Ton nie auf
            _LOGGER.exception("%s: saving a running tone of the alarm failed", self.entry.title)

    def _resume_tones(self, trigger: str, steps: list[dict[str, Any]], start: int, test: bool) -> None:
        """Nach einem Neustart: Töne, die vor dem gespeicherten Schritt nebenher begonnen haben, spielen weiter (Rest der Dauer, nie länger)."""
        run = self._run
        if run is None or test:
            return
        now = dt_util.utcnow()
        state = self._state(run, trigger)
        if "tones" in state:
            items = state.get("tones") or []
        else:
            # Gespeichert von einer Version vor 1.87.0: ein Ton "bis zum Deaktivieren" vor dem gespeicherten Schritt lief sicher noch
            items = [{"index": i} for i, step in enumerate(steps[:start]) if step.get("type") in TONE_RESUME_TYPES and step.get("duration") == 0]
        for item in items:
            index = item.get("index") if isinstance(item, dict) else None
            if not isinstance(index, int) or not 0 <= index < min(start, len(steps)) or (trigger, index) in self._endless:
                continue
            step = steps[index]
            if step.get("type") not in TONE_RESUME_TYPES:
                continue
            if item.get("until") is None:
                if step.get("duration") != 0:
                    continue  # der Schritt wurde inzwischen geändert: nicht raten
                resumed = step
            else:
                end = dt_util.parse_datetime(str(item.get("until")))
                left = (end - now).total_seconds() if end is not None else 0
                if left < 1:
                    continue  # die Zeit war beim Wiederanlauf schon um
                resumed = {**step, "duration": min(int(step.get("duration") or 0), math.ceil(left))}
                if resumed["duration"] < 1:
                    continue
            self._endless.add((trigger, index))
            task = self._background(self._side(resumed, test, index))
            self._side_tasks.add(task)
            task.add_done_callback(self._side_tasks.discard)

    def _resume_endless(self, trigger: str, steps: list[dict[str, Any]], start: int, test: bool) -> None:
        """
        Nach einem Neustart von Home Assistant mitten im Alarm: Gruppen "bis deaktiviert", die vor dem gespeicherten Schritt begonnen
        haben, laufen wieder (im Zweifel alarmieren: ein Blinklicht oder eine getaktete Sirene hört nicht still auf). Läuft die Gruppe
        in diesem Prozess schon (der Wächter setzt einen abgebrochenen Ablauf fort), startet sie nicht noch einmal.
        """
        run = self._run
        if run is None or test:
            return
        for index in self._state(run, trigger).get("endless") or []:
            if not isinstance(index, int) or not 0 <= index < min(start, len(steps)) or (trigger, index) in self._endless:
                continue
            step = steps[index]
            if step.get("type") != "group" or step.get("mode") != "until_disarmed":
                continue
            self._endless.add((trigger, index))
            task = self._background(self._side(step, test, index))
            self._side_tasks.add(task)
            task.add_done_callback(self._side_tasks.discard)

    # ----- Rückgängig nach einer Zeit (1.37.0) -----
    #
    # "Gerät schalten" kann nach N Sekunden den Gegendienst aufrufen (Steckdose mit Sirene: ein, nach 120 s aus). Die Zeit bestimmt allein der
    # Nutzer und zählt ab dem Aufruf. Der Eintrag steht im gespeicherten Stand des Laufs (run["undo"]): ein Neuladen oder Neustart von Home
    # Assistant setzt ihn mit der Restzeit fort, Deaktivieren und Quittieren (und das Ende eines Tests) schalten sofort zurück. Der
    # Gegendienst ist Zusatz wie jeder Aufruf: höchstens SERVICE_TIMEOUT, ein Fehler hält nichts auf.

    def _plan_undo(self, step: dict[str, Any], domain: str, service: str, data: dict[str, Any]) -> None:
        """Nach dem Aufruf eines Schritts mit "undo_after" den Gegendienst vormerken. Nie ein Hindernis: ein Fehler hier steht nur im Log."""
        try:
            seconds = int(step.get("undo_after") or 0)
            inverse = UNDO_SERVICES.get(service)
            targets = data.get("entity_id")
            run = self._run
            if seconds <= 0 or inverse is None or run is None or not targets:
                return
            entry = {"domain": domain, "service": inverse, "target": list(targets) if isinstance(targets, (list, tuple)) else [targets],
                     "at": (dt_util.utcnow() + timedelta(seconds=seconds)).isoformat()}
            if _IN_GROUP.get():
                # In einer Gruppe käme sonst mit jeder Runde ein Eintrag dazu (bei "bis deaktiviert" ohne Grenze), und die Gegendienste
                # früherer Runden liefen mitten in spätere hinein: der neue Eintrag ersetzt den für dieselben Geräte
                for old in [e for e in run.get("undo") or [] if self._same_undo(e, entry)]:
                    run["undo"].remove(old)
                    task = self._undo_tasks.pop(id(old), None)
                    if task is not None:
                        task.cancel()
            run.setdefault("undo", []).append(entry)
            self._store.async_delay_save(lambda: self._run or {}, 0)
            self._arm_undo(run, entry)
        except Exception:  # noqa: BLE001 - der Schritt selbst ist erledigt, das Vormerken hält nichts auf
            _LOGGER.exception("%s: planning the undo of a step failed", self.entry.title)

    @staticmethod
    def _same_undo(one: Any, other: dict[str, Any]) -> bool:
        """Derselbe Gegendienst für dieselben Geräte (die Zeit zählt nicht)?"""
        return (isinstance(one, dict) and one.get("domain") == other.get("domain") and one.get("service") == other.get("service")
                and sorted(str(t) for t in one.get("target") or []) == sorted(str(t) for t in other.get("target") or []))

    def _arm_undo(self, run: dict[str, Any], entry: dict[str, Any]) -> None:
        """Den Gegendienst zur vorgemerkten Zeit ausführen (Aufgabe nebenher: sie endet mit dem Lauf)."""
        task = self._background(self._undo_task(run, entry))
        self._side_tasks.add(task)
        task.add_done_callback(self._side_tasks.discard)
        key = id(entry)
        self._undo_tasks[key] = task
        task.add_done_callback(lambda done, key=key: self._undo_tasks.pop(key, None) if self._undo_tasks.get(key) is done else None)

    async def _undo_task(self, run: dict[str, Any], entry: dict[str, Any]) -> None:
        try:
            end = dt_util.parse_datetime(str(entry.get("at") or ""))
            left = max(0.0, (end - dt_util.utcnow()).total_seconds()) if end is not None else 0.0  # ohne lesbare Zeit: sofort zurück
            await self._sleep(left)
            await self._undo_now(run, entry)
        except asyncio.CancelledError:
            raise  # der Eintrag bleibt im Lauf: Neuladen setzt ihn fort, Deaktivieren schaltet ihn zurück (_flush_undos)
        except Exception:  # noqa: BLE001 - ein Fehler hier hält nichts auf
            _LOGGER.exception("%s: the undo of a step failed", self.entry.title)

    async def _undo_now(self, run: dict[str, Any], entry: dict[str, Any]) -> None:
        """Einen Eintrag zurücknehmen und den Gegendienst aufrufen. Der Eintrag wird zuerst entnommen: nie zweimal."""
        entries = run.get("undo") or []
        if entry not in entries:
            return
        entries.remove(entry)
        if self._run is run:
            self._store.async_delay_save(lambda: self._run or {}, 0)
        # Geräte, die inzwischen ein neuer Alarm schaltet, schaltet der alte Lauf nicht mehr zurück (1.87.0, Code-Review K1)
        targets = [str(t) for t in entry.get("target") or [] if not self._owned_by_alarm(run, str(t))]
        if targets:
            self._mark_busy(run, targets)
            try:
                await self._call(str(entry.get("domain")), str(entry.get("service")), {"entity_id": targets})
            finally:
                self._mark_idle(run, targets)

    async def _flush_undos(self, run: dict[str, Any]) -> None:
        """Alle noch vorgemerkten Gegendienste sofort ausführen (Lauf zu Ende: Deaktivieren, Quittieren, Test beendet). Parallel, je höchstens SERVICE_TIMEOUT."""
        entries = list(run.get("undo") or [])
        if not entries:
            return
        await asyncio.gather(*(self._undo_now(run, entry) for entry in entries), return_exceptions=True)

    def _sound(self, name: Any, default: str) -> tuple[str, float] | None:
        """
        Name und Länge (eine Wiederholung) eines Tons. Ein eigener Ton, dessen Datei fehlt (gelöscht, nicht zurückgespielt), wird nie still
        übergangen: ein Alarm muss klingen. Dann gilt der Standardton der Schrittart (Warnung im Log). Unbekannte Namen: None.
        """
        if name in ALL_SOUNDS:
            return str(name), ALL_SOUNDS[name]
        if isinstance(name, str) and re.match(CUSTOM_SOUND_ID_RE, name):
            registry = self.hass.data.get(DATA_CUSTOM_SOUNDS)
            length = registry.length(name) if registry is not None else None
            if length:
                return name, length
            _LOGGER.warning("%s: the custom sound %s is missing; the default sound %s plays instead", self.entry.title, name, default)
            return default, ALL_SOUNDS[default]
        return None

    def _base_url(self, what: str) -> str | None:
        """
        Adresse, unter der die Lautsprecher die Tondatei holen: die interne von Home Assistant, sonst jede bekannte. Ohne Adresse None (steht im
        Log, der Ton entfällt). Für Alarmton und Aktivierungston gleich (bis 1.62.0 stand der Rückfall zweimal da).
        """
        try:
            return get_url(self.hass, allow_external=False, prefer_external=False)
        except NoURLAvailableError:
            try:
                return get_url(self.hass)
            except NoURLAvailableError:
                _LOGGER.error("%s: no Home Assistant URL for the %s; set it under Settings › System › Network", self.entry.title, what)
                return None

    async def _play(self, step: dict[str, Any], resumable: bool = False) -> None:
        owner = self._run  # der Lauf dieses Tons: löst ihn ein neuer Alarm ab, übernimmt der den Lautsprecher (siehe _owned_by_alarm)
        players = list(step.get("players", []))
        if owner is not None and not owner.get("test"):
            await self._await_free(players)
        found = self._sound(step.get("sound", "siren"), {"prealarm": "pre_beep", "chime": "tone_pip", "dechime": "off_fall"}.get(str(step.get("type")), "siren"))
        if not players or found is None:
            return
        sound, length = found
        if (base := self._base_url("alarm sound")) is None:
            return
        remembered = await self._remember(step, players)
        await self._set_volumes(step, players)
        duration = step.get("duration")
        if duration is None:  # ältere Form (Wiederholungen): so lang wie die Wiederholungen zusammen
            duration = max(1, int(step.get("repeat", 1))) * length
            resumable = False
        # Dauer in Sekunden, vom Nutzer eingestellt; 0 = so lange, bis deaktiviert wird: der Ablauf bricht den Schritt dann ab.
        # Ein abgewarteter Ton zählt seine Dauer ab dem ersten Start (nach Neuladen oder Neustart nur der Rest, siehe _remaining)
        left = self._remaining(duration) if resumable and duration else duration
        end = dt_util.utcnow() + timedelta(seconds=left)
        try:
            while True:
                # Eine Datei für die ganze Dauer (1.17.0, sound_loop.py): der Lautsprecher wird nur einmal gestartet, statt alle paar
                # Sekunden neu. Nur sehr lange Töne (und "bis zum Deaktivieren") bestehen aus mehreren Stücken von LOOP_MAX_SECONDS.
                rest = LOOP_MAX_SECONDS if duration == 0 else (end - dt_util.utcnow()).total_seconds()
                if rest <= 0:
                    break  # Zeit schon um (Wiederanlauf nach dem Ende): nichts mehr spielen, nur stoppen
                piece = min(LOOP_MAX_SECONDS, rest)
                await self._call("media_player", "play_media", {"entity_id": players, "media_content_id": loop_url(base, sound, piece), "media_content_type": "music"})
                await self._sleep(piece)
                if duration and dt_util.utcnow() >= end:
                    break
        finally:
            # Zeit um, deaktiviert oder "Alarmton stumm": der Ton darf nicht ausklingen oder weiterlaufen. Lautsprecher, die ein neuer Alarm
            # übernommen hat, stoppt und stellt der abgelöste Ton nicht mehr (1.87.0, Code-Review K1)
            await self._stop_players(players, owner)
            await self._put_back(remembered, owner)

    def _restores_itself(self, step: dict[str, Any]) -> bool:
        """
        Stellt dieser Ton die Lautsprecher nach seinem Ende selbst zurück (1.26.0)? Aktivierungston und Voralarm immer, wenn
        "restore" (Standard an) nicht ausgeschaltet ist; ein Alarmton in den Listen ausserhalb des Alarmablaufs ebenso (er endet
        dort von selbst). Im Alarmablauf stellt der Alarmton erst beim Deaktivieren zurück (Schnappschuss des Laufs).
        """
        if not step.get("restore", True):
            return False
        kind = step.get("type")
        if kind in ("chime", "dechime", "prealarm"):
            return True
        return kind == "sound" and bool((self._run or {}).get("after")) and bool(step.get("duration"))

    async def _remember(self, step: dict[str, Any], players: list[str]) -> dict[str, Any] | None:
        """
        Zustand der Lautsprecher vor dem Ton merken: ein oder aus, Lautstärke, Stummschaltung, Quelle, bei Sonos die ganze
        Wiedergabe. Nie ein Hindernis: scheitert oder hängt das Merken, spielt der Ton ohne (Grenze SNAPSHOT_TIMEOUT je Aufruf).
        """
        if not self._restores_itself(step):
            return None
        try:
            return {"snapshot": self._snapshot(players), "sonos": await self._sonos_snapshot(players)}
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - das Merken ist Zusatz: der Ton läuft in jedem Fall
            _LOGGER.exception("%s: remembering the state of the speakers failed; the tone plays without it", self.entry.title)
            return None

    async def _put_back(self, remembered: dict[str, Any] | None, owner: dict[str, Any] | None = None) -> None:
        """
        Lautsprecher nach dem Ton wieder so stellen, wie sie vorher waren (auch wieder ausschalten, wenn sie aus waren). Hat ein neuer Alarm
        einen Lautsprecher übernommen, geht sein Zustand von vorher an den Alarm (`owner`: der Lauf des Tons).
        """
        if remembered:
            await self._restore(remembered, owner if owner is not None else {})

    async def _stop_players(self, players: list[str], owner: dict[str, Any] | None) -> None:
        """Lautsprecher eines Tons stoppen, ausser denen, die ein neuer Alarm übernommen hat."""
        free = [p for p in players if not self._owned_by_alarm(owner, p)]
        if free:
            self._mark_busy(owner, free)
            try:
                await self._call("media_player", "media_stop", {"entity_id": free})
            finally:
                self._mark_idle(owner, free)

    async def _set_volumes(self, step: dict[str, Any], players: list[str]) -> None:
        """
        Lautstärke vor dem Ton setzen: je Medienplayer sein eigener Wert ("volumes", 1.16.0), sonst der gemeinsame ("volume").
        Lautsprecher mit demselben Wert gehen in einen Aufruf; ohne Angabe bleibt die Lautstärke, wie sie ist.
        """
        own = step.get("volumes") or {}
        groups: dict[float, list[str]] = {}
        for player in players:
            level = own.get(player, step.get("volume"))
            if level is not None:
                groups.setdefault(float(level), []).append(player)
        for level, group in groups.items():
            await self._call("media_player", "volume_set", {"entity_id": group, "volume_level": level})

    async def _play_whole(self, step: dict[str, Any]) -> None:
        """
        Aktivierungston: nur ganze Wiederholungen, mindestens eine. Ein melodischer Ton (Dreiklang, Glocke) wird so nie mitten in
        der Melodie abgeschnitten: bei 3 Sekunden spielt ein Ton von 1 Sekunde dreimal, einer von 2 Sekunden einmal.
        """
        owner = self._run
        players = list(step.get("players", []))
        if owner is not None and not owner.get("test"):
            await self._await_free(players)
        found = self._sound(step.get("sound", "off_fall" if step.get("type") == "dechime" else "tone_pip"), "off_fall" if step.get("type") == "dechime" else "tone_pip")
        if not players or found is None:
            return
        sound, length = found
        if (base := self._base_url("arming tone")) is None:
            return
        remembered = await self._remember(step, players)
        await self._set_volumes(step, players)
        # Ganze Wiederholungen in einer einzigen Datei (1.17.0): der Lautsprecher wird einmal gestartet
        total = max(1, int(int(step.get("duration") or 3) // length)) * length
        try:
            await self._call("media_player", "play_media", {"entity_id": players, "media_content_id": loop_url(base, sound, total), "media_content_type": "music"})
            await self._sleep(total)
        finally:
            await self._stop_players(players, owner)
            await self._put_back(remembered, owner)

    async def _bounded(self, coro: Any, label: str, timeout: float | None = None, targets: Any = None) -> None:
        """
        Wartet höchstens `timeout` (Standard SERVICE_TIMEOUT) auf einen Aufruf. Antwortet das Gerät nicht, geht es weiter: Der Aufruf
        läuft als eigener Task weiter (auch wenn er Abbrüche ignoriert, wir warten nicht auf ihn) und endet spätestens beim
        Deaktivieren. Zeitüberschreitung und Fehler stehen auf der Zeitachse des Alarms und im Selbsttest (`targets`: die Geräte).
        """
        limit = SERVICE_TIMEOUT if timeout is None else timeout
        # Eigener, von HA verfolgter Task (wie ein gewöhnlicher Dienstaufruf), damit "alles abgearbeitet" ihn mitzählt
        task = self.hass.async_create_task(coro, f"alarmageddon step call {self.entry.entry_id}")
        try:
            done, _pending = await asyncio.wait({task}, timeout=limit)
        except asyncio.CancelledError:
            task.cancel()
            raise
        if not done:
            self._late.add(task)
            task.add_done_callback(self._late.discard)
            task.add_done_callback(lambda t: t.cancelled() or t.exception())  # Ausnahme als abgeholt markieren
            self._ctl.record("step_failed", action=label, reason="timeout")
            self._selftest(False, label, targets, "timeout")
            raise TimeoutError(f"{label} did not respond within {limit} s")
        try:
            task.result()
        except asyncio.CancelledError:
            raise
        except Exception:
            self._ctl.record("step_failed", action=label, reason="error")
            self._selftest(False, label, targets, "error")
            raise
        self._selftest(True, label, targets)

    async def _call(self, domain: str, service: str, data: dict[str, Any], timeout: float | None = None) -> None:
        try:
            await self._bounded(self.hass.services.async_call(domain, service, data, blocking=True), f"{domain}.{service}", timeout, data.get("entity_id"))
        except Exception:  # noqa: BLE001 - ein Gerät, das nicht antwortet, hält den Ablauf nicht auf
            _LOGGER.exception("%s: %s.%s failed", self.entry.title, domain, service)

    @callback
    def _take_tasks(self) -> list[asyncio.Task]:
        """
        Alle Aufgaben des laufenden Ablaufs übernehmen und abbrechen. Synchron, in einem Zug: ein neuer Lauf, der danach
        startet (echter Alarm nach einem Test, Start durch den Wächter), gehört nicht mehr dazu und bleibt unberührt.
        """
        late, self._late = list(self._late), set()
        side, self._side_tasks = list(self._side_tasks), set()
        self._endless = set()  # mit den Aufgaben enden auch die Gruppen "bis deaktiviert" dieses Laufs
        self._undo_tasks = {}  # ihre Aufgaben sind unter den Aufgaben nebenher (die Einträge bleiben im Lauf: _flush_undos)
        task, self._task = self._task, None
        also, self._also_task = self._also_task, None
        for item in late:
            item.cancel()  # hängende Aufrufe enden mit dem Alarm; nicht abwarten
        waiting = [item for item in (*side, task, also) if item is not None and not item.done()]
        for item in waiting:
            item.cancel()
        return waiting

    async def _cancel_task(self) -> None:
        waiting = self._take_tasks()
        if waiting:
            for item in waiting:
                item.add_done_callback(_retrieve)
            # Das Ende abwarten (ein Ton stoppt beim Abbruch noch den Player), aber nie ohne Grenze: eine Aufgabe, die
            # Abbrüche ignoriert, darf das Deaktivieren nicht aufhalten
            await asyncio.wait(waiting, timeout=SERVICE_TIMEOUT)

    async def async_silence(self) -> bool:
        """
        Alarmton stumm (Knopf in der Meldung): alle Schritte stoppen und die Geräte zurückstellen, die Anlage bleibt im Alarm
        (Deaktivieren bleibt Sache des Nutzers). Nur bei einem echten, laufenden Ablauf; ein Test endet mit "Test stoppen".
        """
        if self._run and not self._run.get("test"):
            self._cancel_guard()  # der Wächter darf die gestoppten Schritte nicht wieder starten
            await self.async_stop()
            await self._mark_silenced()
            return True
        # Ablauf schon zu Ende (alle Schritte durch), der Ton klingt aber vielleicht noch: auf jeden Fall stoppen
        if self._run is None and self._ctl.state == AlarmControlPanelState.TRIGGERED:
            self._cancel_guard()
            players = sorted({p for flow in self._ctl.alarm_plan() for st in flat_steps(self.steps(flow)) if st.get("type") in ("sound", "prealarm", "chime", "dechime") for p in st.get("players", [])})
            if players:
                await self._call("media_player", "media_stop", {"entity_id": players})
                await self._mark_silenced()
                return True
        return False

    async def _mark_silenced(self) -> None:
        """
        Merken, dass der Ablauf dieses Alarms mit "Alarmton stumm" beendet wurde: nach einem Neustart von Home Assistant mitten im (stummen)
        Alarm beginnen die Alarmaktionen nicht von vorn (async_start). Die Marke verschwindet mit dem Alarm (async_stop löscht die Ablage,
        ein neuer Alarm überschreibt sie). Zusatz: ein Fehler hier steht nur im Log.
        """
        if self._run is not None or self._ctl.state != AlarmControlPanelState.TRIGGERED:
            return
        try:
            await self._watched(self._store.async_save({"silenced": True}), SNAPSHOT_TIMEOUT, "store")
        except Exception:  # noqa: BLE001
            _LOGGER.exception("%s: remembering the silenced alarm failed", self.entry.title)

    async def async_stop(self, *, yield_to_alarm: bool = False) -> None:
        """
        Alle Schritte abbrechen und den Zustand vor dem Alarm wiederherstellen. `yield_to_alarm` (Ende eines Alarms): beginnt währenddessen
        ein neuer Alarm, gehen ihm dessen Geräte samt Zustand von vorher über, statt zurückgestellt zu werden (siehe _owned_by_alarm).
        """
        self._cancel_timers()
        # Zuerst und ohne Warten: ab hier gehört ein neuer Lauf (echter Alarm, Start durch den Wächter) nicht mehr zu diesem Stopp
        run, self._run = self._run, None
        if run is not None and yield_to_alarm:
            run["yield"] = True  # vor dem Abbruch: die Töne des Laufs fragen es in ihrem `finally`
            self._stopping.append(run)
        try:
            await self._cancel_task()
            if run and run.get("hc"):
                self._hc_release(True)  # der Alarm ist vorbei: Wiederholen endet, die normalen Lebenszeichen laufen wieder
            if run:
                await self._flush_undos(run)
                await self._restore(run)
        finally:
            self._stopping = [old for old in self._stopping if old is not run]
        if self._run is None:
            await self._store.async_remove()
            if self._ctl.state != AlarmControlPanelState.TRIGGERED:
                await self._restore_handover()

    # ----- Schnappschuss und Wiederherstellung -----

    def _snapshot(self, entities: list[str]) -> dict[str, Any]:
        out = {}
        for entity_id in entities:
            if state := self.hass.states.get(entity_id):
                out[entity_id] = {"state": state.state, "attributes": {k: state.attributes[k] for k in KEEP_ATTRS if k in state.attributes}}
        return out

    async def _sonos_snapshot(self, entities: list[str]) -> list[str]:
        """Manche Player (derzeit die der Integration "sonos") können die ganze Wiedergabe (Quelle, Titel, Gruppe) sichern; andere nur Lautstärke und Zustand."""
        if not self.hass.services.has_service("sonos", "snapshot"):
            return []
        registry = er.async_get(self.hass)
        sonos = [e for e in entities if e.startswith("media_player.") and (r := registry.async_get(e)) and r.platform == "sonos"]
        if sonos:
            await self._call("sonos", "snapshot", {"entity_id": sonos, "with_group": True}, SNAPSHOT_TIMEOUT)
        return sonos

    # ----- Übergabe an einen neuen Alarm (1.87.0, Code-Review K1) -----
    #
    # Ein Lauf, der endet, während schon ein neuer Alarm läuft oder beginnt, stellt die Geräte dieses Alarms nicht zurück und stoppt seine
    # Lautsprecher nicht: Er gibt ihren Zustand von vorher an den Alarm weiter, der sie beim Deaktivieren dorthin zurückstellt. Betroffen sind
    # der vorige Alarm (quittiert, sofort neu ausgelöst: `_end`) und Läufe neben dem Alarm, die er ablöst (Voralarm der Eingangsverzögerung auf
    # demselben Lautsprecher wie der Alarmton, Test). Die übrigen Geräte stellt der alte Lauf wie gewohnt zurück.

    def _alarm_entities(self) -> set[str]:
        """Alle Geräte, die der laufende Alarm schaltet (Ziele von Aktionen, Lautsprecher von Tönen), auch ohne "Rückgängig"."""
        plan = self._plan or self._ctl.alarm_plan()
        out: set[str] = set()
        for flow in plan:
            for step in flat_steps(self.steps(flow)):
                if step.get("type") == "action":
                    out.update(t for t in step.get("target") or [] if isinstance(t, str))
                elif step.get("type") in ("sound", "chime", "dechime", "prealarm"):
                    out.update(p for p in step.get("players") or [] if isinstance(p, str))
        return out

    def _owned_by_alarm(self, owner: dict[str, Any] | None, entity_id: str) -> bool:
        """Gehört dieses Gerät eines endenden Laufs inzwischen dem neuen Alarm? Nie ein Fehler: im Zweifel stellt der alte Lauf zurück."""
        try:
            if not owner or not owner.get("yield") or self._ctl.state != AlarmControlPanelState.TRIGGERED:
                return False
            return entity_id in self._alarm_entities()
        except Exception:  # noqa: BLE001 - die Übergabe ist Zusatz
            _LOGGER.exception("%s: deciding whether the new alarm took over %s failed", self.entry.title, entity_id)
            return False

    def _taken_over(self, entities: list[str]) -> tuple[dict[str, Any], set[str]]:
        """
        Zustand vor dem alten Lauf für die Geräte des neuen Alarms: aus Läufen, die gerade enden (`entities`), und was ein endender Lauf schon
        übergeben hat. Der früheste Stand gewinnt. Leert die Übergabe.
        """
        snapshot: dict[str, Any] = {}
        sonos: set[str] = set()
        for old in self._stopping:
            saved = old.get("snapshot") or {}
            for entity_id in entities:
                if entity_id in saved and entity_id not in snapshot:
                    snapshot[entity_id] = saved[entity_id]
                    if entity_id in (old.get("sonos") or []):
                        sonos.add(entity_id)
        for entity_id, saved in self._handover["snapshot"].items():
            snapshot.setdefault(entity_id, saved)
        sonos |= self._handover["sonos"]
        self._handover = {"snapshot": {}, "sonos": set()}
        return snapshot, sonos

    def _hand_over(self, snapshot: dict[str, Any], sonos: list[str] | set[str]) -> None:
        """Zustand von vorher an den neuen Alarm geben: direkt in seinen Lauf, wenn er schon gemerkt hat, sonst bis zu seinem Merken aufbewahren."""
        if not snapshot and not sonos:
            return
        run = self._run
        if run is not None and not run.get("test") and not run.get("after") and run.get("prepared"):
            run["snapshot"] = {**(run.get("snapshot") or {}), **snapshot}  # der frühere Stand gewinnt
            run["sonos"] = sorted({*(run.get("sonos") or []), *sonos})
            self._store.async_delay_save(lambda: self._run or {}, 0)
            return
        for entity_id, saved in snapshot.items():
            self._handover["snapshot"].setdefault(entity_id, saved)
        self._handover["sonos"] |= set(sonos)

    async def _restore_handover(self) -> None:
        """Übergebener Zustand, den kein Alarm übernommen hat (er hatte keine Schritte): selbst zurückstellen, nie liegen lassen."""
        if not self._handover["snapshot"]:
            return
        pending, self._handover = self._handover, {"snapshot": {}, "sonos": set()}
        await self._restore({"snapshot": pending["snapshot"], "sonos": sorted(pending["sonos"])})

    async def _restore(self, run: dict[str, Any], owner: dict[str, Any] | None = None) -> None:
        """Geräte auf den gemerkten Stand zurück. `owner`: der Lauf, dem der Stand gehört (für die Übergabe an einen neuen Alarm)."""
        owner = run if owner is None else owner
        snapshot: dict[str, Any] = run.get("snapshot") or {}
        sonos = set(run.get("sonos") or [])
        for entity_id, saved in snapshot.items():
            if self._owned_by_alarm(owner, entity_id):
                # Vor jedem Gerät neu gefragt: der neue Alarm kann mitten im Zurückstellen beginnen
                self._hand_over({entity_id: saved}, [entity_id] if entity_id in sonos else [])
                continue
            self._mark_busy(owner, [entity_id])
            try:
                await self._restore_one(entity_id, saved, entity_id in sonos)
            finally:
                self._mark_idle(owner, [entity_id])

    async def _restore_one(self, entity_id: str, saved: dict[str, Any], sonos: bool) -> None:
        domain = entity_id.split(".")[0]
        state, attrs = saved.get("state"), saved.get("attributes", {})
        data = {"entity_id": entity_id}
        if domain == "media_player":
            await self._call("media_player", "media_stop", data)
            if sonos and self.hass.services.has_service("sonos", "restore"):
                await self._call("sonos", "restore", {**data, "with_group": True})
                return
            if "volume_level" in attrs:
                await self._call("media_player", "volume_set", {**data, "volume_level": attrs["volume_level"]})
            if "is_volume_muted" in attrs:
                await self._call("media_player", "volume_mute", {**data, "is_volume_muted": attrs["is_volume_muted"]})
            if state == "off":
                # Er war vorher aus (der Ton hat ihn eingeschaltet): wieder ausschalten
                await self._call("media_player", "turn_off", data)
        elif domain == "cover":
            if "current_position" in attrs:
                await self._call("cover", "set_cover_position", {**data, "position": attrs["current_position"]})
            elif state in ("open", "closed"):
                await self._call("cover", "open_cover" if state == "open" else "close_cover", data)
        elif domain == "light":
            if state == "on":
                extra = {k: attrs[k] for k in ("brightness", "color_temp_kelvin") if k in attrs}
                await self._call("light", "turn_on", {**data, **extra})
            elif state == "off":
                await self._call("light", "turn_off", data)
        elif state in ("on", "off"):
            await self._call(domain, f"turn_{state}", data)

    # Aufrufe, die ein endender Lauf gerade an ein Gerät richtet (je Lauf, Schlüssel id(Lauf)): ein neuer Alarm wartet kurz auf sie, bevor er
    # dieselben Geräte schaltet; sonst käme das Zurückstellen des alten Laufs nach seinem Einschalten an (Sirene aus mitten im Alarm)

    def _mark_busy(self, owner: dict[str, Any] | None, entities: list[str]) -> None:
        if owner is not None:
            self._busy.setdefault(id(owner), set()).update(entities)

    def _mark_idle(self, owner: dict[str, Any] | None, entities: list[str]) -> None:
        if owner is None:
            return
        busy = self._busy.get(id(owner))
        if busy is not None:
            busy.difference_update(entities)
            if not busy:
                self._busy.pop(id(owner), None)
        event, self._busy_event = self._busy_event, asyncio.Event()
        event.set()

    async def _await_free(self, entities: list[str]) -> None:
        """
        Bevor ein Schritt des Alarms Geräte schaltet: warten, bis ein endender Lauf keines davon mehr gerade schaltet (danach gibt er sie ab,
        _owned_by_alarm). Höchstens HANDOVER_TIMEOUT, nur dieser Schritt wartet, die übrigen laufen (step_budget rechnet die Zeit ein).
        """
        wanted = set(entities)
        if not wanted or not self._stopping:
            return
        deadline = self.hass.loop.time() + HANDOVER_TIMEOUT
        while any(self._busy.get(id(run), set()) & wanted for run in self._stopping):
            left = deadline - self.hass.loop.time()
            if left <= 0:
                _LOGGER.warning("%s: the end of the previous alarm still switches %s; the new alarm goes on", self.entry.title, ", ".join(sorted(wanted)))
                return
            try:
                await asyncio.wait_for(self._busy_event.wait(), left)
            except TimeoutError:
                return
