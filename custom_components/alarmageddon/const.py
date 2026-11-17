"""Konstanten von Alarmageddon."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "alarmageddon"

# Modi der Anlage. Seit 0.6.0 alle drei pro Anlage wählbar (Wunsch des Nutzers), mindestens einer; "night" standardmässig aus.
MODE_HOME: Final = "home"
MODE_AWAY: Final = "away"
MODE_NIGHT: Final = "night"
MODES: Final = (MODE_HOME, MODE_AWAY, MODE_NIGHT)

# Daten des Config Entry (beim Anlegen festgelegt)
CONF_NAME: Final = "name"

# Optionen (im Optionsdialog änderbar, später auch im Panel)
CONF_NIGHT_ENABLED: Final = "night_enabled"
CONF_HOME_ENABLED: Final = "home_enabled"
# "Immer aktiv" als Ganzes ein- oder ausschalten (1.6.0); Standard an. Aus: kein Sensor ist immer aktiv, Werte und Aktionen bleiben erhalten
CONF_ALWAYS_ENABLED: Final = "always_enabled"
# "Überwachung" (1.48.0) als Ganzes ein- oder ausschalten; Standard aus (Entscheid des Nutzers, 2026-11-16). Aus: keine Regel läuft, die Regeln bleiben gespeichert
CONF_MONITOR_ENABLED: Final = "monitor_enabled"
# Messwert-Sensoren der Anlage (Liste in der Konfiguration, ohne Zone, Modus oder Eingangsverzögerung); der Alarm sieht sie nie
CONF_MONITOR_SENSORS: Final = "monitor_sensors"
CONF_AWAY_ENABLED: Final = "away_enabled"
CONF_ZONE_PREFIX: Final = "zone_"  # zone_home, zone_away, zone_night: Liste von Entitäten
CONF_SENSORS: Final = "sensors"  # vom Nutzer für diese Anlage ausgewählte Sensoren (Liste im Panel); Zonen und eigene Werte zählen immer dazu
CONF_ENTRY_SENSORS: Final = "entry_sensors"  # Sensoren mit Eingangsverzögerung, alle anderen lösen sofort aus
CONF_EXIT_DELAY_PREFIX: Final = "exit_delay_"  # exit_delay_home usw., Sekunden
CONF_ENTRY_DELAY: Final = "entry_delay"
CONF_TRIGGER_TIME: Final = "trigger_time"  # Dauer des Alarms in Sekunden, 0 = bis zum Deaktivieren
CONF_OPEN_SENSORS: Final = "open_sensors"  # Verhalten bei offenem Sensor beim Scharfschalten
CONF_CODE_ARM_REQUIRED: Final = "code_arm_required"
# Quittieren verlangt den Code (1.34.0): nur wirksam mit einem Code; Standard aus (Quittieren schaltet nichts ab)
CONF_CODE_ACK_REQUIRED: Final = "code_ack_required"
CONF_CODE_HASH: Final = "code_hash"
CONF_CODE_SALT: Final = "code_salt"
# Weitere Codes, je einer Person zugeordnet (0.5.0): [{"id", "name", "user_id", "hash", "salt"}].
# Der Hauptcode (code_hash/code_salt aus dem Optionsdialog) gilt weiter, ohne Namen.
CONF_CODES: Final = "codes"
MAX_CODES: Final = 20

# Felder im Formular (nicht gespeichert, nur Eingabe)
FIELD_CODE: Final = "code"
FIELD_REMOVE_CODE: Final = "remove_code"

OPEN_BLOCK: Final = "block"
OPEN_BYPASS: Final = "bypass"
OPEN_SENSOR_MODES: Final = (OPEN_BLOCK, OPEN_BYPASS)

DEFAULT_EXIT_DELAY: Final = {MODE_HOME: 0, MODE_AWAY: 60, MODE_NIGHT: 0}
DEFAULT_ENTRY_DELAY: Final = 30
MAX_DELAY: Final = 3600

# Code: 4 bis 8 Ziffern wie bei üblichen Bedienteilen
CODE_PATTERN: Final = r"^\d{4,8}$"
CODE_HASH_ITERATIONS: Final = 120_000
# Schutz gegen Durchprobieren: nach so vielen falschen Codes ist die Eingabe gesperrt
CODE_MAX_ATTEMPTS: Final = 5
CODE_LOCKOUT_SECONDS: Final = 60

MANUFACTURER: Final = "Alarmageddon"

# Panel (eingebautes iframe-Panel, siehe LEARNINGS)
PANEL_VERSION: Final = 220  # Cache-Buster: bei jeder Änderung unter panel/ erhöhen
PANEL_URL_PATH: Final = "alarmageddon"
PANEL_STATIC_URL_PATH: Final = "/alarmageddon_panel"
PANEL_DIR: Final = "panel"
PANEL_HTML_FILE: Final = "panel.html"
PANEL_TITLE: Final = "Alarmageddon"
PANEL_ICON: Final = "mdi:shield-home"
DATA_CARDS: Final = f"{DOMAIN}_cards"
DATA_PANEL: Final = f"{DOMAIN}_panel_registered"
DATA_PANEL_LOCK: Final = "alarmageddon_panel_lock"
DATA_STATIC: Final = f"{DOMAIN}_static_registered"

# Ereignisprotokoll pro Anlage (Übersicht "Letzte Ereignisse")
EVENTS_STORE_KEY: Final = f"{DOMAIN}.events"
# Zustand der Anlage in eigener Ablage (1.58.0): sofort geschrieben, übersteht auch Absturz und Stromausfall (controller._save_state)
STATE_STORE_KEY: Final = f"{DOMAIN}.state"
# Aufbewahrung (1.13.0, Wunsch des Nutzers): Ereignisse und Alarme ein Jahr; ältere werden verworfen. Die Anzahl ist nur noch eine
# Obergrenze, damit die Ablage nicht unbegrenzt wächst (vorher 1000 Ereignisse und 30 Alarme je Anlage, ohne Blick auf das Alter).
KEEP_DAYS: Final = 365
EVENTS_KEEP: Final = 5000  # Obergrenze der Ereignisse je Anlage (Protokoll mit Zeitraum und Export)
RECORDINGS_STORE_KEY: Final = f"{DOMAIN}.recordings"
RECORDINGS_KEEP: Final = 200  # Obergrenze der Alarme je Anlage
RECORDINGS_ENTRIES_KEEP: Final = 300  # Einträge je Alarm

# Messwert-Sensoren, die das Panel für die Überwachung anbietet (Geräteklassen von sensor, 1.48.0)
MEASURE_CLASSES: Final = (
    "temperature", "humidity", "carbon_dioxide", "pressure", "illuminance", "pm25", "pm10", "aqi", "volatile_organic_compounds",
)

# Sensoren, die das Panel als Kandidaten für Zonen anbietet (Geräteklassen von binary_sensor)
SENSOR_CLASSES: Final = (
    "door", "window", "opening", "garage_door", "motion", "occupancy", "presence",
    "smoke", "gas", "moisture", "vibration", "tamper", "safety", "sound", "carbon_monoxide",
    "glass_break", "heat", "lock", "moving",  # glass_break neu seit HA 2026.10
)

# Optionen pro Sensor (0.3.0). Gespeichert nur als eigene Werte in den Optionen der Anlage (CONF_SENSOR_OPTIONS),
# sonst gilt die Voreinstellung der Sensorart (globale Einstellungen).
CONF_SENSOR_OPTIONS: Final = "sensor_options"
OPT_ALWAYS: Final = "always"  # löst auch unscharf aus (Rauch, Wasser, Gas)
OPT_OPEN_OK: Final = "open_ok"  # darf beim Scharfschalten offen sein
# Umgehen (0.32.0, ersetzt die globale Wahl "Offener Sensor beim Scharfschalten"): ist der Sensor beim Scharfschalten offen und darf nicht
# offen sein, wird er bis zum Deaktivieren übergangen, statt das Scharfschalten zu verhindern. Nie voreingestellt.
OPT_BYPASS: Final = "bypass"
# Einstellungen pro Sensor je Modus (0.32.0): Schalter CONF_PER_MODE_SENSORS; dann gelten CONF_SENSOR_MODES[modus][sensor][option] vor den
# Werten für alle Modi (CONF_SENSOR_OPTIONS) und der Voreinstellung der Sensorart.
# Zeiten und Verhalten der Anlage je Modus (0.34.0): Schalter nur für die Anzeige im Panel (aus: ein Satz Werte für alle Modi, ein: je Modus);
# die Engine liest die Werte je Modus wie bisher
CONF_PER_MODE_SETTINGS: Final = "per_mode_settings"
CONF_PER_MODE_SENSORS: Final = "per_mode_sensors"
CONF_SENSOR_MODES: Final = "sensor_modes"
OPT_ARM_ON_CLOSE: Final = "arm_on_close"  # Schliessen während der Ausgangsverzögerung schaltet sofort scharf
OPT_OFFLINE_ALARM: Final = "offline_alarm"  # nicht erreichbar im scharfen Zustand löst aus
# Löst im scharfen Zustand erst aus, wenn ein zweiter Sensor innerhalb des Zeitfensters anspricht (gegen Fehlalarm
# durch Haustiere, Sonnenlicht). Nie voreingestellt: im Zweifel alarmieren (0.5.0)
OPT_CONFIRM: Final = "confirm"
# Stiller Alarm (0.9.0, früher "Nur melden"): Spricht der Sensor an, gibt es eine Meldung (Art "Stiller Alarm", standardmässig kritisch), aber nie einen Alarm.
# Für Sensoren, die oft ohne Einbruch ansprechen (Haustier, Sonnenlicht, Batterie zur Neige). Nie voreingestellt.
OPT_REPORT_ONLY: Final = "report_only"
REPORT_THROTTLE: Final = 60  # höchstens eine Meldung pro Sensor und Minute
# Eigene Eingangsverzögerung eines Sensors in Sekunden (1.1.0): ein Wert, kein Schalter, darum nicht in SENSOR_OPTIONS.
# Fehlt er, gilt die Eingangsverzögerung der Anlage für den Modus.
OPT_ENTRY_DELAY: Final = "entry_delay"
# "Scharf in <Modus>: nur <Modus> zählt" (1.4.0 als "Immer aktiv ignorieren", Standard aus; seit 1.7.0 Standard an): ein Schalter,
# aber keine Voreinstellung der Sensorart, darum nicht in SENSOR_OPTIONS. Wirkt nur in Modi, in deren Zone ein immer aktiver Sensor
# steht. An: dort gelten allein Regel und Aktionen des Modus. Aus: "Immer aktiv" gilt zusätzlich (sofort Alarm, beide Abläufe).
OPT_ALWAYS_OFF: Final = "always_off"
SENSOR_OPTIONS: Final = (OPT_ALWAYS, OPT_OPEN_OK, OPT_BYPASS, OPT_ARM_ON_CLOSE, OPT_OFFLINE_ALARM, OPT_CONFIRM, OPT_REPORT_ONLY)
CONF_CONFIRM_WINDOW: Final = "confirm_window"
# Einstellungen je Modus (0.10.0): Schlüssel "<name>_<modus>" (entry_delay_away …), "always" für Alarme durch immer aktive Sensoren
# bei deaktivierter Anlage (nur Alarmdauer). Fehlt der Wert, gilt der alte gemeinsame Schlüssel ohne Modus, dann die Grundeinstellung.
SCOPE_ALWAYS: Final = "always"
DEFAULT_CONFIRM_WINDOW: Final = 60
MAX_CONFIRM_WINDOW: Final = 600
# Zeit nach dem Schliessen, bevor "scharf, sobald geschlossen" greift: eine zufallende Tür prellt (wie Alarmo: Kontakt-Prellen)
ARM_ON_CLOSE_SETTLE: Final = 3

# Sensorarten (aus der Geräteklasse) und ihre Voreinstellungen
TYPE_DOOR: Final = "door"
TYPE_WINDOW: Final = "window"
TYPE_MOTION: Final = "motion"
TYPE_ENVIRONMENT: Final = "environment"
TYPE_TAMPER: Final = "tamper"
TYPE_OTHER: Final = "other"
SENSOR_TYPES: Final = (TYPE_DOOR, TYPE_WINDOW, TYPE_MOTION, TYPE_ENVIRONMENT, TYPE_TAMPER, TYPE_OTHER)
DEVICE_CLASS_TYPE: Final = {
    "door": TYPE_DOOR, "garage_door": TYPE_DOOR, "opening": TYPE_DOOR, "lock": TYPE_DOOR,
    "window": TYPE_WINDOW,
    "motion": TYPE_MOTION, "occupancy": TYPE_MOTION, "presence": TYPE_MOTION, "moving": TYPE_MOTION,
    "smoke": TYPE_ENVIRONMENT, "gas": TYPE_ENVIRONMENT, "moisture": TYPE_ENVIRONMENT, "carbon_monoxide": TYPE_ENVIRONMENT,
    "heat": TYPE_ENVIRONMENT,
    "glass_break": TYPE_TAMPER, "vibration": TYPE_TAMPER, "tamper": TYPE_TAMPER, "sound": TYPE_TAMPER, "safety": TYPE_TAMPER,
}
# Vorschlag aus dem Mockup 0.3.0 (angelehnt an Alarmo; Eingangsverzögerung bewusst nie voreingestellt)
DEFAULT_PRESETS: Final = {
    TYPE_DOOR: [OPT_ARM_ON_CLOSE],
    TYPE_WINDOW: [],
    TYPE_MOTION: [OPT_OPEN_OK],
    TYPE_ENVIRONMENT: [OPT_ALWAYS],
    TYPE_TAMPER: [OPT_OFFLINE_ALARM],
    TYPE_OTHER: [],
}

# Globale Einstellungen (für alle Anlagen gleich)
SETTINGS_STORE_KEY: Final = f"{DOMAIN}.settings"
DATA_SETTINGS: Final = f"{DOMAIN}_settings"
DATA_SETTINGS_LOCK: Final = f"{DOMAIN}_settings_lock"

# Benachrichtigungen (global). Empfänger als Dienste "notify.<name>", getrennt für Alarm und Wartung. Seit 0.9.0 je Meldungsart:
# an/aus, kritisch ja/nein, Lautstärke (iOS). Die Art gehört zu einer Gruppe, deren Empfänger sie bekommt.
NOTIFY_TYPES: Final = {
    "triggered": "alarm", "pending": "alarm", "armed": "alarm", "disarmed": "alarm", "arm_failed": "alarm",
    "sensor_offline": "alarm", "sensor_report": "alarm",
    "battery_low": "maintenance", "sensor_unavailable": "maintenance",
}
# Standard je Art: (an, kritisch). Im Zweifel melden: Alarm und Ausfall eines Sensors im scharfen Zustand sind kritisch.
NOTIFY_TYPE_DEFAULTS: Final = {
    "triggered": (True, True), "pending": (False, False), "armed": (False, False), "disarmed": (False, False),
    "arm_failed": (True, False), "sensor_offline": (True, True), "sensor_report": (True, True),
    "battery_low": (True, False), "sensor_unavailable": (True, False),
}
# Meldungsarten, die nur im scharfen Zustand vorkommen und je Modus eigene Werte haben können (0.29.0): Stiller Alarm, Eingangsverzögerung,
# Scharf geschaltet, Sensorausfall im scharfen Zustand. notify["modes"][modus][art] = {enabled, critical, volume}, nur abweichende Werte.
NOTIFY_MODE_KINDS: Final = ("sensor_report", "pending", "armed", "sensor_offline")
DEFAULT_NOTIFY: Final = {
    # Schalter "Einstellungen pro Modus" (0.34.0): nur wenn er an ist, gelten die eigenen Werte je Modus
    "per_mode": False,
    "modes": {},
    "alarm_targets": [],
    "maintenance_targets": [],
    # "targets" je Art (1.5.0): eigene Empfänger statt der Gruppe oben (Alarm oder Wartung); leer = die Gruppe gilt
    "types": {key: {"enabled": on, "critical": critical, "volume": 0.8, "persistent": False, "targets": []} for key, (on, critical) in NOTIFY_TYPE_DEFAULTS.items()},
    # Aktion "Deaktivieren" in der Push-Meldung: standardmässig aus (Sicherheitsregel, wer das Handy hat, kann entschärfen)
    "disarm_action": False,
    # Weitere Knöpfe der Alarmmeldung (0.16.0): "Öffnen" (Panel) standardmässig an, "Alarmton stumm" aus
    "open_action": True,
    "silence_action": False,
    # "Alarm quittieren" (1.2.0): beendet den Alarm, die Anlage bleibt scharf. Standardmässig an: es schaltet nichts ab
    # (anders als "Deaktivieren"), ein neuer Auslöser alarmiert wieder
    "acknowledge_action": True,
    # Knöpfe der Meldung "Scharfschalten nicht möglich" (1.18.0), beide standardmässig an (Entscheid des Nutzers): "Erneut
    # versuchen" und "Trotzdem scharf schalten" (übergeht die offenen Sensoren bis zum Deaktivieren)
    "arm_retry_action": True,
    "arm_force_action": True,
    # Wartung (0.5.0): Batterie schwach unter dieser Schwelle (%), nicht erreichbar ab so vielen Minuten
    "battery_threshold": 20,
    "offline_minutes": 60,
}
BATTERY_THRESHOLD_RANGE: Final = (5, 50)
OFFLINE_MINUTES_RANGE: Final = (5, 1440)
# Wartung: Prüfung alle 15 Minuten, die erste 5 Minuten nach dem Start (Geräte verbinden sich erst)
MAINTENANCE_STORE_KEY: Final = f"{DOMAIN}.maintenance"
DATA_MAINTENANCE: Final = f"{DOMAIN}_maintenance"
MAINTENANCE_INTERVAL: Final = 15 * 60
MAINTENANCE_START_DELAY: Final = 5 * 60
# Erst wieder melden, wenn die Batterie so viele Prozentpunkte über der Schwelle war (gewechselt)
BATTERY_HYSTERESIS: Final = 5
PUSH_ACTION_DISARM: Final = "ALARMAGEDDON_DISARM_"  # + entry_id
PUSH_ACTION_OPEN: Final = "ALARMAGEDDON_OPEN"
PUSH_ACTION_SILENCE: Final = "ALARMAGEDDON_SILENCE_"  # + entry_id
PUSH_ACTION_ACK: Final = "ALARMAGEDDON_ACK_"  # + entry_id (Alarm quittieren, 1.1.0)
# Knöpfe der Meldung "Scharfschalten nicht möglich" (1.18.0): denselben Modus noch einmal versuchen oder trotz offener Sensoren
# scharf schalten (sie werden bis zum Deaktivieren übergangen). Der Modus kommt nie aus dem Ereignis des Handys, sondern aus dem
# gemerkten gescheiterten Versuch (DATA_ARM_FAILED[entry_id] = {"mode", "at"}); er gilt ARM_BUTTONS_VALID Sekunden.
PUSH_ACTION_RETRY: Final = "ALARMAGEDDON_RETRY_"  # + entry_id
PUSH_ACTION_FORCE: Final = "ALARMAGEDDON_FORCE_"  # + entry_id
ARM_BUTTONS_VALID: Final = 3600  # Entscheid des Nutzers (2026-11-12): eine Stunde
DATA_ARM_FAILED: Final = f"{DOMAIN}_arm_failed"

# Aktionen als Ablauf (0.4.0): pro Anlage und Auslöser eine Liste von Schritten (CONF_WORKFLOWS[auslöser])
CONF_WORKFLOWS: Final = "workflows"
# Element "Alarm endet" (0.27.0): optionale eigene Meldung beim Deaktivieren/Quittieren, je Auslöser: CONF_WORKFLOW_END[auslöser] = {"notify": {...}}
# Ob Geräte zurückgesetzt werden, entscheidet allein die Einstellung "Rückgängig" im jeweiligen Schritt.
CONF_WORKFLOW_END: Final = "workflow_end"
# Aktionen nach dem Quittieren (1.10.0): Schritte, die laufen, sobald der Alarm endet (quittiert oder deaktiviert), je Auslöser wie
# CONF_WORKFLOWS. Nur Schritte, die danach noch Sinn haben: Gerät, Ton, Warten (keine Alarmmeldung, kein Quittieren).
CONF_WORKFLOWS_AFTER: Final = "workflows_after"
AFTER_STEP_TYPES: Final = ("action", "sound", "chime", "wait")
# Aktionen beim Scharfschalten (1.14.0): Schritte, die laufen, sobald die Anlage scharf ist, je Modus. Der Aktivierungston ("chime")
# ist eine eigene Schrittart neben dem Alarmton ("sound"): ein kurzer Ton mit Dauer, der nie "bis zum Deaktivieren" läuft und nichts
# zurückstellt. So ist er von der Sirene zu unterscheiden (im Ablauf, im Protokoll und beim Stoppen).
CONF_WORKFLOWS_ARMED: Final = "workflows_armed"
ARMED_STEP_TYPES: Final = ("action", "chime", "wait")
CHIME_MAX_SECONDS: Final = 300
# Aktionen während der Verzögerungen (1.18.0), je Modus wie CONF_WORKFLOWS_ARMED:
# - CONF_WORKFLOWS_ARMING: Schritte, die laufen, solange die Ausgangsverzögerung läuft (ab dem Befehl zum Scharfschalten bis die
#   Anlage scharf ist). CONF_WORKFLOWS_ARMED läuft wie bisher danach.
# - CONF_WORKFLOWS_ENTRY: Schritte, die laufen, solange die Eingangsverzögerung läuft (Zeit zum Deaktivieren, vor dem Alarm).
# Ein Ton mit "delay": true dauert so lange wie die Verzögerung, die gerade läuft (Wert des Modus oder des Sensors); die Dauer
# steht damit nie fest im Schritt, sie folgt der Einstellung der Anlage. Der Alarm hat immer Vorrang und wartet nie auf sie.
CONF_WORKFLOWS_ARMING: Final = "workflows_arming"
ARMING_STEP_TYPES: Final = ("action", "chime", "wait")
CONF_WORKFLOWS_ENTRY: Final = "workflows_entry"
ENTRY_STEP_TYPES: Final = ("action", "chime", "prealarm", "wait")
# Aktionen beim Deaktivieren (1.27.0): Schritte, die immer laufen, wenn die Anlage deaktiviert wird (auch mitten in der
# Verzögerung oder im Alarm), je Modus, der gerade scharf war. Der Deaktivierungston ("dechime") ist das Gegenstück zum
# Aktivierungston: kurz, mit Dauer, nie endlos, mit eigenen Klängen (DECHIMES).
CONF_WORKFLOWS_DISARMED: Final = "workflows_disarmed"
DISARMED_STEP_TYPES: Final = ("action", "dechime", "wait")
# Aktions-Gruppe (1.59.0, Wunsch des Nutzers 2026-11-17): eine Gruppe von Schritten, die sich in ihrer Reihenfolge wiederholt: eine Anzahl
# Durchläufe ("count"), für eine Dauer ("duration") oder bis zum Deaktivieren ("until_disarmed", nur im Ablauf des Alarms: nur dort
# deaktiviert oder quittiert jemand). In allen Listen der Aktionen, mit den Schritten, die dort erlaubt sind; keine Gruppe in einer
# Gruppe und kein "Quittieren" (es beendet den Alarm) darin. "Rückgängig nach einer Zeit" gibt es seit 1.60.0 auch in einer Gruppe: je Gerät gilt
# dann nur ein vorgemerkter Gegendienst, jede Runde ersetzt den der vorigen (workflow._plan_undo).
# Jede Runde dauert mindestens GROUP_MIN_ROUND Sekunden: eine Gruppe ohne "Warten" liefe sonst als Schleife ohne Pause (Flut von
# Schaltbefehlen und Meldungen). Die Schritte der Gruppe zählen zur Grenze MAX_STEPS je Liste.
GROUP_MODES: Final = ("count", "duration", "until_disarmed")
GROUP_MAX_ROUNDS: Final = 100
GROUP_MAX_STEPS: Final = 10
GROUP_MIN_ROUND: Final = 1
GROUP_NAME_MAX: Final = 40
GROUP_EXCLUDED: Final = ("group", "acknowledge")  # Schritte, die es in einer Gruppe nie gibt
WORKFLOW_ALWAYS: Final = "always"  # Alarm durch einen "immer aktiven" Sensor bei deaktivierter Anlage
WORKFLOW_TRIGGERS: Final = ("home", "away", "night", WORKFLOW_ALWAYS)
WORKFLOW_STORE_KEY: Final = f"{DOMAIN}.workflow"
BACKUPS_STORE_KEY: Final = f"{DOMAIN}.backups"
MAX_BACKUPS: Final = 10  # Sicherungen in der Integration; die älteste fällt weg
# Automatische Sicherungen (1.47.0): zusätzlich zu den eigenen; es bleiben die letzten AUTO_BACKUP_KEEP
AUTO_BACKUP_KEEP: Final = 5
AUTO_BACKUP_DAYS: Final = {"daily": 1, "weekly": 7, "monthly": 30}
AUTO_BACKUP_DEFAULT: Final = {"enabled": True, "every": "weekly", "keep": AUTO_BACKUP_KEEP}
AUTO_BACKUP_KEEP_MAX: Final = 50  # so viele automatische Sicherungen darf der Nutzer höchstens behalten (Standard AUTO_BACKUP_KEEP)
AUTO_BACKUP_START_DELAY: Final = 300  # Sekunden nach dem Start: verpasste Sicherungen nachholen
DATA_AUTO_BACKUP: Final = f"{DOMAIN}_auto_backup"
# Rückgängig nach einer Zeit (1.37.0): der Gegendienst zu einem Dienst eines Schritts "Gerät schalten". Nur wo es einen eindeutigen gibt
# (ein, aus, auf, zu, ver- und entriegeln); "toggle" schaltet wieder um.
UNDO_SERVICES: Final = {
    "turn_on": "turn_off", "turn_off": "turn_on", "toggle": "toggle",
    "open_cover": "close_cover", "close_cover": "open_cover", "open_valve": "close_valve", "close_valve": "open_valve",
    "lock": "unlock", "unlock": "lock",
}
TEST_SECONDS: Final = 60  # ein Test endet spätestens nach so vielen Sekunden von selbst
MAX_STEPS: Final = 40
# Mitgelieferte Töne: Name und Länge in Sekunden (scripts/make_sounds.py)
# Drei Arten von Tönen, jede mit eigenen Klängen (1.15.0, Begriffe des Nutzers): Alarmton, Voralarm, Aktivierungston.
# Nur der Alarmton ist der Ton des Alarms, den der Knopf "Alarmton stumm" der Push-Meldung meint. Wert = Länge einer Wiederholung.
SOUNDS: Final = {"siren": 4.0, "beep": 3.0, "klaxon": 3.0, "hilo": 3.0, "yelp": 3.0}
# Voralarm: leise Warntöne für den Schritt "Voralarm", der vor dem Alarmton läuft. Gong und Warnung waren bis 1.14.0 Alarmtöne.
PREALARMS: Final = {"chime": 2.0, "warning": 2.0, "pre_beep": 1.0, "pre_pulse": 1.0, "pre_rising": 1.0}
# Aktivierungston: kurz, dezent oder freundlich
CHIMES: Final = {"tone_pip": 1.0, "tone_double": 1.0, "tone_soft": 1.5, "tone_bell": 2.0, "tone_rise": 2.0, "tone_confirm": 1.5, "tone_tick": 1.0}
# Deaktivierungston (1.27.0): das Gegenstück zum Aktivierungston für "Beim Deaktivieren", fallend statt steigend
DECHIMES: Final = {"off_fall": 2.0, "off_confirm": 1.5, "off_bell": 2.0, "off_soft": 1.5, "off_double": 1.0}
ALL_SOUNDS: Final = {**SOUNDS, **PREALARMS, **CHIMES, **DECHIMES}
# Eigene Töne (1.39.0): vom Nutzer hochgeladen, überall dort wählbar, wo es einen Ton gibt. Eine Kennung "custom_" und 12 Hexzeichen.
CUSTOM_SOUND_ID_RE: Final = r"^custom_[0-9a-f]{12}$"
CUSTOM_URL_PATH: Final = "/alarmageddon_custom"
CUSTOM_SOUNDS_STORE_KEY: Final = f"{DOMAIN}.custom_sounds"
DATA_CUSTOM_SOUNDS: Final = f"{DOMAIN}_custom_sounds"
DATA_RECEPTION: Final = f"{DOMAIN}_reception"  # Aufzeichnung des Empfangs (reception.py)
DATA_BLE_STAMPS: Final = f"{DOMAIN}_ble_stamps"  # Meldezeiten je Bluetooth-Empfänger, kurz gemerkt
DATA_BLE_BEST: Final = f"{DOMAIN}_ble_best"  # zuletzt gezählter Empfänger je Bluetooth-Adresse (kein Hin und Her)
MAX_CUSTOM_SOUNDS: Final = 20
MAX_UPLOAD_BYTES: Final = 8 * 1024 * 1024  # Datei beim Hochladen (vor dem Umwandeln)
MAX_CUSTOM_SECONDS: Final = 30  # Länge eines eigenen Tons; er wird für die gewählte Dauer wiederholt
MAX_CUSTOM_RATE: Final = 48000
MAX_CUSTOM_TOTAL_BYTES: Final = 12 * 1024 * 1024  # alle eigenen Töne zusammen
MAX_CUSTOM_NAME: Final = 40
PREALARM_MAX_SECONDS: Final = 600
SOUNDS_URL_PATH: Final = "/alarmageddon_sounds"
DATA_SOUNDS: Final = f"{DOMAIN}_sounds_registered"
# Symbol der Integration für Meldungen (Android zeigt es als Symbol der Meldung, iOS kennt das nicht); ohne Anmeldung abrufbar
ICON_URL_PATH: Final = "/alarmageddon_icon.png"
DATA_ICON: Final = f"{DOMAIN}_icon_registered"
# Domänen, deren Zustand vor dem Alarm gespeichert und beim Deaktivieren wiederhergestellt werden kann
RESTORABLE_DOMAINS: Final = ("switch", "light", "input_boolean", "fan", "siren", "cover", "media_player")

# Modus an/aus: Schlüssel in den Optionen und Grundeinstellung (fehlt der Schlüssel, gilt sie)
MODE_ENABLED_KEY: Final = {"home": CONF_HOME_ENABLED, "away": CONF_AWAY_ENABLED, "night": CONF_NIGHT_ENABLED}
MODE_ENABLED_DEFAULT: Final = {"home": True, "away": True, "night": False}

# Zeitplan (0.6.0): pro Anlage Regeln {"id", "enabled", "action", "time" "HH:MM", "days" [0 = Montag … 6]}
CONF_SCHEDULES: Final = "schedules"
SCHEDULE_OFF: Final = "off"
SCHEDULE_ACTIONS: Final = (SCHEDULE_OFF, "home", "away", "night")
MAX_SCHEDULES: Final = 20
# Routinen (seit 1.44.0, ersetzen die Zeitpläne): Auslöser Zeitplan oder Gerät, dann Anlage schalten, nur in gewählten Zuständen
CONF_ROUTINES: Final = "routines"
MAX_ROUTINES: Final = 20
MAX_ROUTINE_TIMES: Final = 8  # Uhrzeiten je Routine mit Auslöser Zeitplan
MAX_ROUTINE_LEAVES: Final = 10  # Bedingungen je Routine mit Auslöser Gerät
MAX_ROUTINE_GROUPS: Final = 3
ROUTINE_HOLD_MAX: Final = 3600  # "muss mindestens N Sekunden gelten"
ROUTINE_COOLDOWN: Final = 10  # Sekunden Sperre je Routine gegen Doppelauslösung
ROUTINE_EVENT_MAX_AGE: Final = 10  # Sekunden: ein älteres Ereignis (nach Neuladen wiederhergestellt) löst nie aus
ROUTINE_STATES: Final = ("arming", "armed", "pending", "triggered", "disarmed")
ROUTINE_ACTIONS: Final = ("home", "away", "night", "off")

# Überwachung (seit 1.48.0): Regeln für Messwerte (Temperatur, Luftfeuchtigkeit, CO2 ...) und Ja/Nein-Sensoren, unabhängig vom Alarm. Je Regel eine
# Bedingung, eine Dauer und zwei Abläufe ("ausserhalb", "wieder in Ordnung"); eine Regel löst nie Sirene oder Alarm aus.
CONF_MONITORS: Final = "monitors"
MAX_MONITORS: Final = 20
MAX_MONITOR_STEPS: Final = 10  # Schritte je Ablauf einer Regel
MONITOR_HOLD_MAX: Final = 7 * 24 * 3600  # "muss mindestens so lange gelten", Sekunden
MONITOR_REMIND_MAX: Final = 72  # Erinnerung alle N Stunden, 0 = keine
MONITOR_STORE_KEY: Final = f"{DOMAIN}.monitor"
DATA_MONITOR: Final = f"{DOMAIN}_monitor"
# Farben der Regelkarten im Panel (Darstellung, wählbar je Regel); die Karte färbt sich mit einem Verlauf ein
MONITOR_COLORS: Final = ("#ef5350", "#ff8a65", "#ffca28", "#9ccc65", "#26a69a", "#29b6f6", "#7986cb", "#ab47bc", "#ec407a", "#90a4ae")
MONITOR_NUMERIC_DOMAINS: Final = ("sensor", "number", "input_number")
