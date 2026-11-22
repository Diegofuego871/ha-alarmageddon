"""Prüfung von Werten aus dem Panel und aus einer Sicherung (dieselben Regeln an beiden Stellen)."""

from __future__ import annotations

import math
from typing import Any

import voluptuous as vol

from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_AWAY_ENABLED,
    CONF_CODE_ACK_REQUIRED,
    CONF_CODE_ARM_REQUIRED,
    CONF_CONFIRM_WINDOW,
    CONF_ALWAYS_ENABLED,
    CONF_HOME_ENABLED,
    CONF_MONITOR_ENABLED,
    CONF_ACCENT,
    ACCENTS,
    CONF_MONITOR_SENSORS,
    CONF_MONITORS,
    CONF_ROUTINES,
    CONF_SCHEDULES,
    MAX_MONITOR_STEPS,
    MAX_MONITORS,
    MONITOR_NUMERIC_DOMAINS,
    MAX_ROUTINES,
    MONITOR_COLORS,
    MONITOR_HOLD_MAX,
    MONITOR_REMIND_MAX,
    MAX_ROUTINE_TIMES,
    MAX_SCHEDULES,
    ROUTINE_ACTIONS,
    ROUTINE_HOLD_MAX,
    ROUTINE_STATES,
    SCHEDULE_ACTIONS,
    CONF_ENTRY_DELAY,
    CONF_ENTRY_SENSORS,
    CONF_SENSORS,
    CONF_EXIT_DELAY_PREFIX,
    CONF_NIGHT_ENABLED,
    CONF_OPEN_SENSORS,
    CONF_PER_MODE_SENSORS,
    CONF_PER_MODE_SETTINGS,
    CONF_SENSOR_MODES,
    CONF_SENSOR_OPTIONS,
    CONF_TRIGGER_TIME,
    AFTER_STEP_TYPES,
    ALL_SOUNDS,
    CUSTOM_SOUND_ID_RE,
    ARMED_STEP_TYPES,
    DISARMED_STEP_TYPES,
    ARMING_STEP_TYPES,
    CHIME_MAX_SECONDS,
    CONF_WORKFLOWS_ARMED,
    CONF_WORKFLOWS_DISARMED,
    CONF_WORKFLOWS_ARMING,
    CONF_WORKFLOWS_ENTRY,
    ENTRY_STEP_TYPES,
    GROUP_EXCLUDED,
    GROUP_MAX_ROUNDS,
    GROUP_MAX_STEPS,
    GROUP_MODES,
    GROUP_NAME_MAX,
    HEALTHCHECK_SUFFIX_MAX,
    CONF_WORKFLOW_END,
    CONF_EVENT_NOTIFY,
    CONF_WORKFLOWS_REPORT,
    EVENT_NOTIFY_ALWAYS,
    EVENT_NOTIFY_KINDS,
    CONF_WORKFLOWS_AFTER,
    CONF_WORKFLOWS,
    CONF_ZONE_PREFIX,
    MAX_CONFIRM_WINDOW,
    MAX_DELAY,
    UNDO_SERVICES,
    MAX_STEPS,
    MODES,
    OPT_ALWAYS_OFF,
    OPT_ENTRY_DELAY,
    OPEN_SENSOR_MODES,
    SCOPE_ALWAYS,
    SENSOR_OPTIONS,
    PREALARM_MAX_SECONDS,
    WORKFLOW_TRIGGERS,
)

SECONDS = vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_DELAY))
# Ein Ton: einer der mitgelieferten oder ein eigener (Kennung; ob die Datei da ist, zeigt sich beim Abspielen, dort gilt dann der Standardton)
SOUND_NAME = vol.Any(vol.In(list(ALL_SOUNDS)), vol.Match(CUSTOM_SOUND_ID_RE))
ENTITY_LIST = [cv.entity_id]
# Werte eines Sensors: die Schalter (SENSOR_OPTIONS) und die eigene Eingangsverzögerung in Sekunden
SENSOR_VALUES = vol.Schema({vol.Optional(vol.In(SENSOR_OPTIONS)): bool, vol.Optional(OPT_ALWAYS_OFF): bool, vol.Optional(OPT_ENTRY_DELAY): vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_DELAY))})
# Eigene Empfänger einer Meldung (statt der Alarm-Empfänger aus der Konfiguration): nur notify-Dienste, höchstens 20
NOTIFY_TARGETS = vol.All([vol.All(str, vol.Match(r"^notify\.[a-z0-9_]+$"))], vol.Length(max=20))
# Lautstärke je Medienplayer (1.16.0): eigene Werte für einzelne Lautsprecher; wer hier fehlt, bekommt "volume" des Schritts
PLAYER_VOLUMES = {vol.All(str, vol.Match(r"^media_player\.[a-z0-9_]+$")): vol.All(vol.Coerce(float), vol.Range(min=0, max=1))}

STEP_SCHEMAS = {
    # Eigener Titel und Text der Alarmmeldung (0.19.0); fehlt eine Angabe, gilt der Standardtext. Platzhalter: {name} {sensor} {type} {area} {time} {mode} {alarm}
    "notify": vol.Schema({
        vol.Required("type"): "notify",
        vol.Optional("title"): vol.All(str, vol.Length(max=100)),
        vol.Optional("message"): vol.All(str, vol.Length(max=300)),
        # Einstellungen der Alarmmeldung nur hier (0.20.0); fehlt eine Angabe, gilt der frühere globale Wert
        vol.Optional("critical"): bool,
        vol.Optional("volume"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
        vol.Optional("buttons"): {vol.Optional(vol.In(("open", "silence", "acknowledge", "disarm"))): bool},
        # Klickziel der Meldung (0.23.0): "log" (Standard, Protokoll mit dem laufenden Alarm), "overview" oder "custom" mit eigenem Pfad
        vol.Optional("click"): vol.In(("log", "overview", "custom")),
        vol.Optional("click_path"): vol.All(str, vol.Length(max=200), vol.Match(r"^/[^\s]*$")),
        # Eigene Empfänger nur für diesen Schritt (1.1.0); fehlt die Angabe oder ist sie leer, gelten die Alarm-Empfänger der Konfiguration
        vol.Optional("targets"): NOTIFY_TARGETS,
    }),
    # HealthCheck melden (1.77.0): ruft die URL eines eingerichteten Dienstes mit dem Zusatz auf (settings.apply_fail_suffix). Ob es den Dienst gibt, zeigt
    # sich erst beim Ausführen (der Selbsttest findet einen fehlenden); die URL selbst steht nie im Schritt, nur die Kennung des Dienstes
    "healthcheck": vol.Schema({
        vol.Required("type"): "healthcheck",
        vol.Required("check_id"): vol.All(str, vol.Match(r"^[a-z0-9]{1,16}$")),
        vol.Required("suffix"): vol.All(str, vol.Length(min=1, max=HEALTHCHECK_SUFFIX_MAX), vol.Match(r"^[/?&]\S*$")),
    }),
    # Alarm quittieren (1.1.0): beendet den Alarm, die Anlage bleibt scharf
    "acknowledge": vol.Schema({vol.Required("type"): "acknowledge"}),
    "wait": vol.Schema({vol.Required("type"): "wait", vol.Required("seconds"): vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_DELAY))}),
    "action": vol.Schema({
        vol.Required("type"): "action",
        vol.Required("action"): cv.service,
        # Standardwerte als Fabrik (default=list/dict): ein Wert wie {} würde sonst von allen geprüften Schritten geteilt
        vol.Optional("target", default=list): ENTITY_LIST,
        vol.Optional("data", default=dict): dict,
        vol.Optional("restore", default=False): bool,
        # Nach so vielen Sekunden rückgängig machen (1.37.0): der Gegendienst (ein/aus, auf/zu, ver-/entriegeln) läuft nach genau dieser Zeit
        vol.Optional("undo_after"): vol.All(vol.Coerce(int), vol.Range(min=1, max=MAX_DELAY)),
        # Auf das Ende warten (1.10.0): Schritte laufen standardmässig weiter, der nächste startet sofort; mit "wait" startet er
        # erst, wenn dieser fertig ist. "detach" ist die ältere Angabe (0.17.0, bis 1.9.0: ohne sie wurde gewartet); beide werden
        # gelesen (workflow.step_waits), das Panel schreibt nur noch "wait".
        vol.Optional("wait"): bool,
        vol.Optional("detach"): bool,
    }),
    "sound": vol.Schema({
        vol.Required("type"): "sound",
        vol.Required("players"): vol.All(ENTITY_LIST, vol.Length(min=1)),
        # Alarmtöne; Gong und Warnung (bis 1.14.0 hier wählbar, jetzt Töne des Voralarms) bleiben in gespeicherten Abläufen gültig
        vol.Required("sound"): SOUND_NAME,
        vol.Optional("volume"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=1))),
        vol.Optional("volumes"): PLAYER_VOLUMES,
        vol.Optional("repeat", default=1): vol.All(vol.Coerce(int), vol.Range(min=1, max=50)),
        # Dauer in Sekunden (0 = bis zum Deaktivieren); ohne Angabe gilt die ältere Form mit Wiederholungen (0.18.0)
        vol.Optional("duration"): vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_DELAY)),
        vol.Optional("restore", default=True): bool,
        vol.Optional("wait"): bool,
        vol.Optional("detach"): bool,
    }),
    # Aktivierungston (1.14.0): kurzer Ton auf Lautsprechern, mit Dauer in Sekunden (nie endlos), ohne Zurückstellen
    "chime": vol.Schema({
        vol.Required("type"): "chime",
        vol.Required("players"): vol.All(ENTITY_LIST, vol.Length(min=1)),
        # Eigene Töne (CHIMES, 1.15.0); ältere Wahl bleibt gültig (1.14.0 bot hier die Alarmtöne an). Das Panel bietet je Schritt nur
        # die eigenen Töne an; der Server prüft, dass es den Ton gibt.
        vol.Optional("sound", default="tone_pip"): SOUND_NAME,
        vol.Optional("volume"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=1))),
        vol.Optional("volumes"): PLAYER_VOLUMES,
        vol.Optional("duration", default=3): vol.All(vol.Coerce(int), vol.Range(min=1, max=CHIME_MAX_SECONDS)),
        # Lautsprecher nach dem Ton wieder so stellen, wie sie vorher waren (1.26.0, Standard an)
        vol.Optional("restore", default=True): bool,
        # So lange wie die laufende Verzögerung (1.18.0); nur in den Listen der Verzögerungen, sonst entfällt die Angabe (valid_step)
        vol.Optional("delay"): bool,
        vol.Optional("wait"): bool,
    }),
    # Deaktivierungston (1.27.0): wie der Aktivierungston ein kurzer Ton mit Dauer, aber mit eigenen, fallenden Klängen (DECHIMES);
    # nur in "Beim Deaktivieren". Er läuft ohne Angabe weiter (wie der Aktivierungston) und stellt den Lautsprecher danach zurück.
    "dechime": vol.Schema({
        vol.Required("type"): "dechime",
        vol.Required("players"): vol.All(ENTITY_LIST, vol.Length(min=1)),
        vol.Optional("sound", default="off_fall"): SOUND_NAME,
        vol.Optional("volume"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=1))),
        vol.Optional("volumes"): PLAYER_VOLUMES,
        vol.Optional("duration", default=3): vol.All(vol.Coerce(int), vol.Range(min=1, max=CHIME_MAX_SECONDS)),
        vol.Optional("restore", default=True): bool,
        vol.Optional("wait"): bool,
    }),
    # Voralarm (1.15.0): leiser Warnton vor der Sirene, mit Dauer; der Ablauf wartet standardmässig auf sein Ende
    "prealarm": vol.Schema({
        vol.Required("type"): "prealarm",
        vol.Required("players"): vol.All(ENTITY_LIST, vol.Length(min=1)),
        vol.Optional("sound", default="pre_beep"): SOUND_NAME,
        vol.Optional("volume"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=1))),
        vol.Optional("volumes"): PLAYER_VOLUMES,
        vol.Optional("duration", default=20): vol.All(vol.Coerce(int), vol.Range(min=1, max=PREALARM_MAX_SECONDS)),
        vol.Optional("restore", default=True): bool,
        vol.Optional("delay"): bool,
        vol.Optional("wait"): bool,
    }),
    # Aktions-Gruppe (1.59.0): wiederholt ihre Schritte in der Reihenfolge. Die Schritte selbst prüft die Liste, in der die Gruppe steht
    # (_valid_group: dort gelten dieselben Regeln wie für die Schritte der Liste). "wait" wie bei den anderen Schritten: ohne die Angabe
    # läuft die Gruppe nebenher, der nächste Schritt startet sofort; eine Gruppe "bis deaktiviert" wartet nie (sie endet nie von selbst).
    "group": vol.Schema({
        vol.Required("type"): "group",
        vol.Optional("name"): vol.All(str, vol.Length(max=GROUP_NAME_MAX)),
        vol.Required("mode"): vol.In(GROUP_MODES),
        vol.Optional("count", default=2): vol.All(vol.Coerce(int), vol.Range(min=1, max=GROUP_MAX_ROUNDS)),
        vol.Optional("seconds", default=60): vol.All(vol.Coerce(int), vol.Range(min=1, max=MAX_DELAY)),
        vol.Optional("steps", default=list): vol.All([dict], vol.Length(max=GROUP_MAX_STEPS)),
        vol.Optional("wait"): bool,
    }),
}


def _valid_group(value: Any, inner: Any, until: bool) -> dict[str, Any]:
    """
    Eine Aktions-Gruppe. `inner` prüft jeden Schritt darin (die Prüfung der Liste, in der die Gruppe steht); `until`: "bis deaktiviert"
    ist in dieser Liste möglich (nur im Ablauf des Alarms: in den anderen Listen deaktiviert danach niemand, die Gruppe liefe endlos).
    """
    group = STEP_SCHEMAS["group"](value)
    if group["mode"] == "until_disarmed":
        if not until:
            raise vol.Invalid("a group outside the alarm actions needs a number of rounds or a duration")
        group["wait"] = False  # endet nie von selbst: auf sie lässt sich nicht warten
    steps = []
    for raw in group["steps"]:
        if raw.get("type") in GROUP_EXCLUDED:
            raise vol.Invalid("this step is not possible in a group")
        step = inner(raw)
        step.pop("delay", None)  # "so lange wie die Verzögerung" gilt nur für einen Schritt der Liste selbst
        steps.append(step)
    group["steps"] = steps
    return group


def _is_group(value: Any) -> bool:
    return isinstance(value, dict) and value.get("type") == "group"


def _total_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Grenze je Liste: die Schritte einer Gruppe zählen mit (die Gruppe selbst auch)."""
    if len(steps) + sum(len(step.get("steps") or []) for step in steps if step.get("type") == "group") > MAX_STEPS:
        raise vol.Invalid(f"at most {MAX_STEPS} steps per list, the steps of groups included")
    return steps


def step_list(validator: Any) -> Any:
    """Eine Liste von Schritten mit der Prüfung `validator` je Schritt und der Grenze MAX_STEPS (Schritte in Gruppen mitgezählt)."""
    return vol.All([validator], _total_steps)


# Element "Alarm endet" (0.27.0): was Deaktivieren/Quittieren mit den Geräten macht und eine optionale eigene Meldung dazu
END_NOTIFY_SCHEMA = vol.Schema({
    vol.Optional("enabled", default=False): bool,
    vol.Optional("title"): vol.All(str, vol.Length(max=100)),
    vol.Optional("message"): vol.All(str, vol.Length(max=300)),
    vol.Optional("critical"): vol.Any(None, bool),
    vol.Optional("volume"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=1))),
    vol.Optional("click"): vol.In(("log", "overview", "custom")),
    vol.Optional("click_path"): vol.Any("", vol.All(str, vol.Length(max=200), vol.Match(r"^/[^\s]*$"))),
    vol.Optional("targets"): NOTIFY_TARGETS,
})
END_SCHEMA = vol.Schema({vol.Optional("notify"): END_NOTIFY_SCHEMA, vol.Optional("send"): bool}, extra=vol.REMOVE_EXTRA)


def valid_end(value: Any) -> dict[str, Any]:
    """Ein Wert für "Alarm endet": die eigene Meldung. Frühere Angaben zur Wahl beim Deaktivieren (undo, Kurzform) fallen weg."""
    if not isinstance(value, dict):
        return {}
    return END_SCHEMA(value)


# Feste Meldung im Reiter Aktionen (1.62.0): "Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung", "Stiller Alarm". Anders als bei
# "Alarm endet" stehen immer alle Werte da (kein "wie die Art"): die Meldung gehört ganz zur Anlage. Leerer Titel oder Text: der
# Standardtext. Leere Empfänger: die Standard-Empfänger von Alarmen.
EVENT_NOTICE_SCHEMA = vol.Schema({
    vol.Required("enabled"): bool,
    vol.Optional("title", default=""): vol.All(str, vol.Length(max=100)),
    vol.Optional("message", default=""): vol.All(str, vol.Length(max=300)),
    vol.Required("critical"): bool,
    vol.Optional("volume", default=0.8): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
    vol.Optional("persistent", default=False): bool,
    vol.Optional("click", default="overview"): vol.In(("log", "overview", "custom")),
    vol.Optional("click_path", default=""): vol.Any("", vol.All(str, vol.Length(max=200), vol.Match(r"^/[^\s]*$"))),
    vol.Optional("targets", default=list): NOTIFY_TARGETS,
})


def valid_event_notify(value: Any) -> dict[str, dict[str, Any]]:
    """
    Feste Meldungen je Auslöser: {auslöser: {art: Meldung}}. Unbekannter Auslöser, unbekannte Art oder eine Art, die es für den Auslöser
    nicht gibt ("Scharf geschaltet" für "Immer aktiv"), lehnt das Ganze ab (eigene Prüfung statt eines Wörterbuchs: siehe strict_map).
    """
    if not isinstance(value, dict):
        raise vol.Invalid("expected a dictionary")
    out: dict[str, dict[str, Any]] = {}
    for trigger, kinds in value.items():
        if trigger not in WORKFLOW_TRIGGERS:
            raise vol.Invalid("unknown trigger")
        if not isinstance(kinds, dict):
            raise vol.Invalid("expected a dictionary")
        allowed = EVENT_NOTIFY_KINDS if trigger in MODES else EVENT_NOTIFY_ALWAYS
        out[trigger] = {}
        for kind, notice in kinds.items():
            if kind not in allowed:
                raise vol.Invalid("this message does not exist for this trigger")
            out[trigger][kind] = EVENT_NOTICE_SCHEMA(notice)
    return out


def valid_step(value: Any, delay: bool = False) -> dict[str, Any]:
    """Ein Schritt. `delay`: Liste einer Verzögerung; nur dort bleibt die Angabe "so lange wie die Verzögerung" erhalten."""
    if not isinstance(value, dict) or value.get("type") not in STEP_SCHEMAS:
        raise vol.Invalid("unknown step type")
    if value["type"] == "group":
        return _valid_group(value, valid_step, until=True)
    step = STEP_SCHEMAS[value["type"]](value)
    if step.get("undo_after") is not None:
        # Nur wo es einen Gegendienst gibt: ein Dienst ohne ihn (Szene, eigener Dienst) bliebe ohne Wirkung, ohne dass es jemand merkt
        _domain, _, service = str(step.get("action", "")).partition(".")
        if UNDO_SERVICES.get(service) is None or _domain in ("scene", "script") or not step.get("target"):
            raise vol.Invalid("this action cannot be undone after a time")
    if not (delay and step.get("delay")):
        step.pop("delay", None)
    if "volumes" in step:
        # Nur für Lautsprecher dieses Schritts; ein leerer Eintrag entfällt
        step["volumes"] = {player: level for player, level in step["volumes"].items() if player in step.get("players", [])}
        if not step["volumes"]:
            del step["volumes"]
    return step


def valid_after_step(value: Any) -> dict[str, Any]:
    """
    Schritt der Aktionen nach dem Quittieren: nur Gerät, Ton und Warten. Ein Ton braucht dort eine Dauer (nach dem Alarm
    deaktiviert niemand mehr, ein Ton "bis zum Deaktivieren" liefe endlos), und "Rückgängig" gibt es nicht (danach folgt nichts).
    """
    if _is_group(value):
        return _valid_group(value, valid_after_step, until=False)
    step = valid_step(value)
    if step["type"] not in AFTER_STEP_TYPES:
        raise vol.Invalid("this step is not possible after the alarm")
    if step["type"] == "sound" and step.get("duration") in (0, None):
        raise vol.Invalid("a sound after the alarm needs a duration")
    if step["type"] == "action":
        step["restore"] = False
    return step


def valid_armed_step(value: Any) -> dict[str, Any]:
    """Schritt der Aktionen beim Scharfschalten: Gerät, Aktivierungston und Warten; "Rückgängig" gibt es dort nicht."""
    if _is_group(value):
        return _valid_group(value, valid_armed_step, until=False)
    step = valid_step(value)
    if step["type"] not in ARMED_STEP_TYPES:
        raise vol.Invalid("this step is not possible when arming")
    if step["type"] == "action":
        step["restore"] = False
    return step


def valid_report_step(value: Any) -> dict[str, Any]:
    """Schritt der Aktionen bei einem stillen Alarm (1.62.0): dieselben wie beim Scharfschalten; nie eine Sirene, nie "bis deaktiviert"."""
    return valid_armed_step(value)


def _valid_delay_step(value: Any, types: tuple[str, ...]) -> dict[str, Any]:
    if _is_group(value):
        return _valid_group(value, lambda inner: _valid_delay_step(inner, types), until=False)
    step = valid_step(value, delay=True)
    if step["type"] not in types:
        raise vol.Invalid("this step is not possible during a delay")
    if step["type"] == "action":
        step["restore"] = False
    return step


def valid_disarmed_step(value: Any) -> dict[str, Any]:
    """Schritt beim Deaktivieren: Gerät, Deaktivierungston und Warten; "Rückgängig" gibt es bei Geräten dort nicht."""
    if _is_group(value):
        return _valid_group(value, valid_disarmed_step, until=False)
    step = valid_step(value)
    if step["type"] not in DISARMED_STEP_TYPES:
        raise vol.Invalid("this step is not possible when disarming")
    if step["type"] == "action":
        step["restore"] = False
    return step


def valid_arming_step(value: Any) -> dict[str, Any]:
    """Schritt während der Ausgangsverzögerung: Gerät, Aktivierungston und Warten; "Rückgängig" gibt es dort nicht."""
    return _valid_delay_step(value, ARMING_STEP_TYPES)


def valid_entry_step(value: Any) -> dict[str, Any]:
    """Schritt während der Eingangsverzögerung: Gerät, Aktivierungston, Voralarm und Warten; "Rückgängig" gibt es dort nicht."""
    return _valid_delay_step(value, ENTRY_STEP_TYPES)


def _days(value: Any) -> list[int]:
    days = vol.Schema([vol.All(vol.Coerce(int), vol.Range(min=0, max=6))])(value)
    if not days:
        raise vol.Invalid("at least one day")
    return sorted(set(days))


SCHEDULE_SCHEMA = vol.Schema(
    {
        vol.Required("id"): vol.All(str, vol.Length(min=1, max=32)),
        vol.Optional("enabled", default=True): bool,
        vol.Required("action"): vol.In(SCHEDULE_ACTIONS),
        vol.Required("time"): vol.All(str, vol.Match(r"^([01]\d|2[0-3]):[0-5]\d$")),
        vol.Required("days"): _days,
    }
)
SCHEDULES = vol.All([SCHEDULE_SCHEMA], vol.Length(max=MAX_SCHEDULES))

# ----- Routinen (1.44.0): Aufbau; was sich nur mit Home Assistant prüfen lässt (Entitäten, Werte je Art), prüft routines.check_routines -----
CLOCK = vol.All(str, vol.Match(r"^([01]\d|2[0-3]):[0-5]\d$"))
_STATE_LEAF = vol.Schema({vol.Required("kind"): "state", vol.Required("entity_id"): cv.entity_id, vol.Required("state"): vol.All(str, vol.Length(min=1, max=20))})
_TIME_LEAF = vol.Schema({vol.Required("kind"): "time", vol.Required("from"): CLOCK, vol.Required("to"): CLOCK, vol.Optional("days", default=list): vol.All([vol.In(range(7))], vol.Length(max=7))})
# Taste oder anderes Ereignis (Entität "event", zum Beispiel ein Hue-Taster): gilt nur im Augenblick des Ereignisses
_EVENT_LEAF = vol.Schema({vol.Required("kind"): "event", vol.Required("entity_id"): cv.entity_id, vol.Required("event_type"): vol.All(str, vol.Length(min=1, max=40))})
ROUTINE_LEAF = vol.Any(_STATE_LEAF, _EVENT_LEAF, _TIME_LEAF)
_AND_OR = vol.In(("and", "or"))
ROUTINE_GROUP = vol.Schema({vol.Required("op"): _AND_OR, vol.Required("items"): vol.All([ROUTINE_LEAF], vol.Length(min=1, max=10))})
ROUTINE_TREE = vol.Schema({vol.Required("op"): _AND_OR, vol.Required("items"): vol.All([vol.Any(ROUTINE_LEAF, ROUTINE_GROUP)], vol.Length(min=1, max=13))})
_SCHEDULE_TRIGGER = vol.Schema(
    {vol.Required("type"): "schedule", vol.Required("times"): vol.All([vol.Schema({vol.Required("time"): CLOCK, vol.Required("days"): _days})], vol.Length(min=1, max=MAX_ROUTINE_TIMES))}
)
_DEVICE_TRIGGER = vol.Schema(
    {vol.Required("type"): "device", vol.Required("tree"): ROUTINE_TREE, vol.Optional("hold", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=ROUTINE_HOLD_MAX))}
)
ROUTINE_SCHEMA = vol.Schema(
    {
        vol.Required("id"): vol.All(str, vol.Length(min=1, max=32)),
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=45)),
        vol.Optional("enabled", default=True): bool,
        vol.Required("action"): vol.In(ROUTINE_ACTIONS),
        vol.Required("states"): vol.All([vol.In(ROUTINE_STATES)], vol.Length(min=1, max=len(ROUTINE_STATES))),
        vol.Required("trigger"): vol.Any(_SCHEDULE_TRIGGER, _DEVICE_TRIGGER),
        vol.Optional("unsafe", default=False): bool,
        # Nur bei "armed": in welchen Modi die Anlage scharf sein muss; leer = in jedem
        vol.Optional("armed_modes", default=list): vol.All([vol.In(("home", "away", "night"))], vol.Length(max=3)),
    }
)
ROUTINES = vol.All([ROUTINE_SCHEMA], vol.Length(max=MAX_ROUTINES))

# ----- Überwachung (1.48.0): Aufbau; was sich nur mit Home Assistant prüfen lässt (Entitäten, Zustände), prüft monitor.check_monitors -----


def _finite(value: Any) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise vol.Invalid("not a finite number")
    return number


NUMBER = vol.All(vol.Coerce(float), _finite, vol.Range(min=-100000, max=1000000))
# Messwert: über, unter oder ausserhalb von "limit" (bei "outside" von "limit" bis "upper")
_VALUE_LEAF = vol.Schema({
    vol.Required("kind"): "value", vol.Required("entity_id"): cv.entity_id, vol.Required("op"): vol.In(("above", "below", "outside")),
    vol.Required("limit"): NUMBER, vol.Optional("upper"): NUMBER,
})
# "Die Anlage ist scharf" (in den gewählten Modi, leer = in jedem)
_ARMED_LEAF = vol.Schema({vol.Required("kind"): "armed", vol.Optional("modes", default=list): vol.All([vol.In(("home", "away", "night"))], vol.Length(max=3))})
MONITOR_LEAF = vol.Any(_VALUE_LEAF, _STATE_LEAF, _ARMED_LEAF, _TIME_LEAF)
MONITOR_GROUP = vol.Schema({vol.Required("op"): _AND_OR, vol.Required("items"): vol.All([MONITOR_LEAF], vol.Length(min=1, max=10))})
MONITOR_TREE = vol.Schema({vol.Required("op"): _AND_OR, vol.Required("items"): vol.All([vol.Any(MONITOR_LEAF, MONITOR_GROUP)], vol.Length(min=1, max=13))})
# Schritte einer Regel: Push-Meldung, Gerät schalten, Warten. Eine Regel löst nie Sirene oder Alarm aus, darum gibt es keine anderen Schritte.
MONITOR_STEP = vol.Any(
    vol.Schema({
        vol.Required("type"): "notify",
        vol.Optional("title"): vol.All(str, vol.Length(max=100)),
        vol.Optional("message"): vol.All(str, vol.Length(max=300)),
        vol.Optional("critical", default=False): bool,
        vol.Optional("volume"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
        # Eigene Empfänger der Regel; leer: die Empfänger der Wartung
        vol.Optional("targets", default=list): NOTIFY_TARGETS,
    }),
    vol.Schema({
        vol.Required("type"): "action",
        vol.Required("action"): cv.service,
        vol.Optional("target", default=list): ENTITY_LIST,
        vol.Optional("data", default=dict): dict  # Fabrik: Schritte teilen sich nie dasselbe Wörterbuch
    }),
    vol.Schema({vol.Required("type"): "wait", vol.Required("seconds"): vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_DELAY))}),
)
MONITOR_STEPS = vol.All([MONITOR_STEP], vol.Length(max=MAX_MONITOR_STEPS))
MONITOR_SCHEMA = vol.Schema({
    vol.Required("id"): vol.All(str, vol.Length(min=1, max=32)),
    vol.Required("name"): vol.All(str, vol.Length(min=1, max=45)),
    vol.Optional("enabled", default=True): bool,
    # Darstellung im Panel: Farbe der Karte (fehlt = Standard)
    vol.Optional("color"): vol.In(MONITOR_COLORS),
    vol.Required("tree"): MONITOR_TREE,
    # Wie lange die Bedingung gelten muss, bevor der Ablauf läuft (Sekunden)
    vol.Optional("hold", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=MONITOR_HOLD_MAX)),
    # Rückkehr-Spanne: ein Messwert gilt erst als wieder in Ordnung, wenn er so weit innerhalb der Grenze liegt (verhindert Flattern)
    vol.Optional("margin", default=0): vol.All(NUMBER, vol.Range(min=0, max=100000)),
    # Erinnerung alle N Stunden, solange es anhält (0 = keine)
    vol.Optional("remind", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=MONITOR_REMIND_MAX)),
    vol.Optional("steps_out", default=list): MONITOR_STEPS,
    vol.Optional("steps_ok", default=list): MONITOR_STEPS,
})
MONITORS = vol.All([MONITOR_SCHEMA], vol.Length(max=MAX_MONITORS))


def _binary_sensors(value: Any) -> list[str]:
    ids = vol.Schema([cv.entity_id])(value)
    if any(not e.startswith("binary_sensor.") for e in ids):
        raise vol.Invalid("only binary sensors")
    return list(dict.fromkeys(ids))


def _measure_sensors(value: Any) -> list[str]:
    ids = vol.Schema([cv.entity_id])(value)
    if any(e.split(".")[0] not in MONITOR_NUMERIC_DOMAINS for e in ids):
        raise vol.Invalid("only measured values")
    return list(dict.fromkeys(ids))


def strict_map(key: Any, value: Any) -> Any:
    """
    Wörterbuch, in dem jeder Schlüssel und jeder Wert gültig sein muss: ein unbekannter Schlüssel lehnt das Ganze ab.

    Als eigene Prüfung statt `{vol.In(...): ...}`: In einem Schema mit REMOVE_EXTRA (Sicherungen, unbekannte Optionen anderer Versionen
    fallen dort weg) verwirft die Prüf-Bibliothek neuerer Versionen von Home Assistant (probatio statt voluptuous; gemessen an 2026.10.4)
    auch in den Wörterbüchern darunter einen unbekannten Schlüssel stillschweigend. Mit voluptuous wurde die Sicherung abgelehnt. Die Regel
    "eine Sicherung mit einem ungültigen Wert wird als Ganzes abgelehnt" darf nicht von der Bibliothek abhängen.
    """
    key_schema, value_schema = vol.Schema(key), vol.Schema(value)

    def check(data: Any) -> dict[Any, Any]:
        if not isinstance(data, dict):
            raise vol.Invalid("expected a dictionary")
        return {key_schema(k): value_schema(v) for k, v in data.items()}

    return check


# Optionen einer Anlage aus einer Sicherung. Codes gehören nie dazu (siehe backup.py). Wörterbücher darunter immer mit strict_map.
SYSTEM_OPTIONS_SCHEMA = vol.Schema(
    {
        **{vol.Optional(f"{CONF_ZONE_PREFIX}{m}"): _binary_sensors for m in MODES},
        **{vol.Optional(f"{CONF_EXIT_DELAY_PREFIX}{m}"): SECONDS for m in MODES},
        vol.Optional(CONF_ENTRY_SENSORS): _binary_sensors,
        vol.Optional(CONF_SENSORS): _binary_sensors,
        vol.Optional(CONF_ENTRY_DELAY): SECONDS,
        vol.Optional(CONF_TRIGGER_TIME): SECONDS,
        # Einstellungen je Modus (0.10.0)
        **{vol.Optional(f"{CONF_ENTRY_DELAY}_{m}"): SECONDS for m in MODES},
        **{vol.Optional(f"{CONF_TRIGGER_TIME}_{m}"): SECONDS for m in (*MODES, SCOPE_ALWAYS)},
        **{vol.Optional(f"{CONF_OPEN_SENSORS}_{m}"): vol.In(OPEN_SENSOR_MODES) for m in MODES},
        **{vol.Optional(f"{CONF_CONFIRM_WINDOW}_{m}"): vol.All(vol.Coerce(int), vol.Range(min=5, max=MAX_CONFIRM_WINDOW)) for m in MODES},
        vol.Optional(CONF_NIGHT_ENABLED): bool,
        vol.Optional(CONF_ALWAYS_ENABLED): bool,
        vol.Optional(CONF_HOME_ENABLED): bool,
        vol.Optional(CONF_AWAY_ENABLED): bool,
        vol.Optional(CONF_SCHEDULES): SCHEDULES,  # nur noch aus alten Sicherungen: wird beim Laden zu Routinen
        vol.Optional(CONF_ROUTINES): ROUTINES,
        vol.Optional(CONF_MONITORS): MONITORS,
        vol.Optional(CONF_MONITOR_ENABLED): bool,
        vol.Optional(CONF_ACCENT): vol.In(ACCENTS),
        vol.Optional(CONF_MONITOR_SENSORS): _measure_sensors,
        vol.Optional("disarm_ends_alarm"): bool,  # nur aus Backups von 1.78.0 (die Einstellung entfiel in 1.79.0): wird beim Einlesen verworfen
        vol.Optional("routines_disarm"): bool,  # nur aus Sicherungen von 1.44.0 (der Schalter entfiel in 1.45.0): wird beim Einlesen verworfen
        vol.Optional(CONF_OPEN_SENSORS): vol.In(OPEN_SENSOR_MODES),
        vol.Optional(CONF_CODE_ARM_REQUIRED): bool,
        vol.Optional(CONF_CODE_ACK_REQUIRED): bool,
        vol.Optional(CONF_CONFIRM_WINDOW): vol.All(vol.Coerce(int), vol.Range(min=5, max=MAX_CONFIRM_WINDOW)),
        vol.Optional(CONF_SENSOR_OPTIONS): strict_map(cv.entity_id, SENSOR_VALUES),
        vol.Optional(CONF_PER_MODE_SENSORS): bool,
        vol.Optional(CONF_PER_MODE_SETTINGS): bool,
        vol.Optional(CONF_SENSOR_MODES): strict_map(vol.In([*MODES, SCOPE_ALWAYS]), strict_map(cv.entity_id, SENSOR_VALUES)),
        vol.Optional(CONF_WORKFLOWS): strict_map(vol.In(WORKFLOW_TRIGGERS), step_list(valid_step)),
        vol.Optional(CONF_WORKFLOW_END): strict_map(vol.In(WORKFLOW_TRIGGERS), valid_end),
        vol.Optional(CONF_WORKFLOWS_AFTER): strict_map(vol.In(WORKFLOW_TRIGGERS), step_list(valid_after_step)),
        vol.Optional(CONF_WORKFLOWS_ARMED): strict_map(vol.In(MODES), step_list(valid_armed_step)),
        vol.Optional(CONF_WORKFLOWS_DISARMED): strict_map(vol.In(MODES), step_list(valid_disarmed_step)),
        vol.Optional(CONF_WORKFLOWS_ARMING): strict_map(vol.In(MODES), step_list(valid_arming_step)),
        vol.Optional(CONF_WORKFLOWS_ENTRY): strict_map(vol.In(MODES), step_list(valid_entry_step)),
        vol.Optional(CONF_WORKFLOWS_REPORT): strict_map(vol.In(WORKFLOW_TRIGGERS), step_list(valid_report_step)),
        vol.Optional(CONF_EVENT_NOTIFY): valid_event_notify,
    },
    extra=vol.REMOVE_EXTRA,
)
