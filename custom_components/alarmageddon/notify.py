"""
Benachrichtigungen einer Anlage über die Companion App (notify.mobile_app_* und
jeder andere notify-Dienst).

Kritische Meldungen: iOS mit "critical" und Lautstärke (push.sound), Android
über den Kanal "alarm_stream" mit hoher Priorität. Beide Teile stehen in jeder
Meldung; jede App nimmt sich, was sie kennt. Texte in der Sprache von HA
(Deutsch für de und de-*, sonst Englisch), nie fest im Code verstreut.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util, slugify

from .const import (
    ARM_BUTTONS_VALID,
    CODE_MAX_ATTEMPTS,
    CONF_EVENT_NOTIFY,
    DATA_ARM_FAILED,
    EVENT_NOTIFY_KINDS,
    MODES,
    ICON_URL_PATH,
    NOTIFY_MODE_KINDS,
    NOTIFY_TYPES,
    OFFLINE_NOTIFY_GAP,
    PUSH_ACTION_ACK,
    PUSH_ACTION_DISARM,
    PUSH_ACTION_FORCE,
    PUSH_ACTION_OPEN,
    PUSH_ACTION_RETRY,
    PUSH_ACTION_SILENCE,
    WORKFLOW_ALWAYS,
)
from .controller import AlarmController
from .devices import display_name, sensor_info

_LOGGER = logging.getLogger(__name__)

TEXTS: dict[str, dict[str, str]] = {
    "en": {
        "triggered_title": "🚨 Alarm: {name}",
        "triggered": "{sensor} at {time}.",
        "triggered_manual": "Alarm triggered manually at {time}.",
        "sensor_type_door": "Door",
        "sensor_type_window": "Window",
        "sensor_type_garage_door": "Garage door",
        "sensor_type_opening": "Opening",
        "sensor_type_motion": "Motion sensor",
        "sensor_type_occupancy": "Occupancy sensor",
        "sensor_type_presence": "Presence sensor",
        "sensor_type_smoke": "Smoke detector",
        "sensor_type_gas": "Gas sensor",
        "sensor_type_carbon_monoxide": "CO detector",
        "sensor_type_moisture": "Water sensor",
        "sensor_type_heat": "Heat detector",
        "sensor_type_vibration": "Vibration sensor",
        "sensor_type_tamper": "Tamper sensor",
        "sensor_type_glass_break": "Glass break sensor",
        "sensor_type_safety": "Safety sensor",
        "sensor_type_sound": "Sound sensor",
        "sensor_type_sensor": "Sensor",
        "alarm_fire": "Fire alarm",
        "alarm_heat": "Heat alarm",
        "alarm_water": "Water alarm",
        "alarm_gas": "Gas alarm",
        "alarm_intrusion": "Intrusion alarm",
        "alarm_alarm": "Alarm",
        "triggered_title_fire": "🔥 Fire alarm: {name}",
        "triggered_fire": "{sensor} detected smoke at {time}.",
        "triggered_title_heat": "🌡️ Heat alarm: {name}",
        "triggered_heat": "{sensor} detected heat at {time}.",
        "triggered_title_water": "💧 Water alarm: {name}",
        "triggered_water": "{sensor} detected water at {time}.",
        "triggered_title_gas": "⚠️ Gas alarm: {name}",
        "triggered_gas": "{sensor} detected gas at {time}.",
        "pending_title": "⏳ Entry delay: {name}",
        "pending": "{sensor} opened. Alarm in {seconds} unless disarmed.",
        "armed_title": "🔒 {name}: {mode} armed",
        "armed": "Armed by {by}.",
        "armed_noby": "The alarm system is armed.",
        "disarmed_title": "🔓 {name} disarmed",
        "disarmed": "Disarmed by {by}.",
        "disarmed_noby": "The alarm system is disarmed.",
        "ended_title": "✅ Alarm ended: {name}",
        "ended": "Disarmed by {by}.",
        "ended_ack": "Acknowledged by {by}. The alarm system stays armed.",
        "ended_ack_noby": "Acknowledged. The alarm system stays armed.",
        "ended_noby": "The alarm is over.",
        "arm_failed_title": "⛔ {name}: cannot arm {mode}",
        "arm_failed": "Open: {sensors}.",
        "arm_failed_unreachable": "Not reachable: {sensors}.",
        "offline_title": "📡 Sensor unreachable: {name}",
        "offline": "{sensor} no longer responds while the alarm system is armed.",
        "again_title": "🚨 Another sensor: {name}",
        "again": "{sensor} triggered at {time} while the alarm is still running.",
        "code_locked_title": "🔒 {name}: codes locked",
        "code_locked": "{count} wrong codes in a row. Codes are locked for {minutes} minutes.",
        "test_title": "🧪 Test: {name}",
        "test": "This is a test notification from Alarmageddon.",
        "group_alarm": "Alarm notifications", "group_maintenance": "Maintenance notifications",
        "action_disarm": "Disarm",
        "action_silence": "Silence alarm sound",
        "by_silence": "push notification",
        "action_open": "Open",
        "mode_home": "Home",
        "mode_away": "Away",
        "mode_night": "Night",
        "by_push": "push notification",
        "by_step": "alarm action",
        "action_ack": "Acknowledge",
        "action_retry": "Try again", "action_force": "Arm anyway",
        "report_title": "🔕 Silent alarm: {name}",
        "report": "{sensor} responded while armed. No alarm was triggered because this sensor is set to \"Silent alarm\".",
        "type_triggered": "Alarm", "type_pending": "Entry delay", "type_armed": "Armed", "type_disarmed": "Disarmed",
        "type_arm_failed": "Arming not possible", "type_sensor_offline": "Sensor unreachable while armed",
        "type_alarm_again": "Another sensor during an alarm", "type_code_locked": "Codes locked after wrong entries",
        "type_sensor_report": "Silent alarm", "type_battery_low": "Low battery",
        "type_sensor_unavailable": "Sensor unreachable",
        "by_schedule": "Schedule",
        "by_routine": "Routine",
        "maint_title_one": "⚠️ Maintenance: {name}",
        "maint_title": "⚠️ Maintenance: {count} sensors",
        "maint_battery": "{sensor}: battery {value} %",
        "maint_offline": "{sensor}: unreachable since {time}",
        "type_selftest": "Self-test",
        "type_healthcheck": "HealthCheck service not answering",
        "selftest_title_one": "⚠️ Self-test: 1 problem",
        "selftest_title": "⚠️ Self-test: {count} problems",
        "selftest_more": "… and {count} more. Details: Alarmageddon › Overview › Status.",
        "selftest_all": "All alarm systems",
        "st_entity_missing": "{system}: {name} is missing",
        "st_entity_unavailable": "{system}: {name} is unreachable",
        "st_service_missing": "{system}: action {service} does not exist",
        "st_recipient_missing": "{system}: recipient {service} does not exist",
        "st_no_recipients": "{system}: a push notification has no recipient",
        "st_sound_missing": "{system}: a custom sound is missing",
        "st_healthcheck_missing": "{system}: an action cannot report to its HealthCheck service",
        "st_no_url": "{system}: no Home Assistant address for the sounds",
        "st_rule_damaged": "{system}: {name} is damaged and does not run",
        "st_system_not_loaded": "{name} could not be loaded",
        "st_step_failed": "{system}: {service} failed",
        "st_step_timeout": "{system}: {service} did not respond",
        "st_step_hung": "{system}: the watchdog had to step in ({label})",
        "st_notify_failed": "{system}: notification via {service} failed",
        "st_start_failed": "{system}: a part could not start ({part})",
        "st_backup_failed": "{system}: the automatic backup failed",
        "st_ping_failed": "{system}: the health check \"{name}\" ({service}) failed",
        "time_format": "%m/%d %H:%M",
        # HealthCheck-Dienste (1.68.0): eigene Meldungen, nie mit der URL
        "hc_down_title": "⚠️ Health check \"{name}\" is not answering",
        "hc_down_message": "Calls to {host} have been failing since {since} ({reason}; failed attempts: {count}). The service may be down, or Home Assistant cannot reach the internet.",
        "hc_up_title": "✅ Health check \"{name}\" answers again",
        "hc_up_message": "{host} answers again (failing since {since}, failed attempts: {count}).",
        "hc_reason_timeout": "no answer",
        "hc_reason_error": "no connection",
        "hc_reason_http": "HTTP {code}",
        "monitor_out_title": "⚠️ {rule}",
        "monitor_out": "{sensor}: {value}{limit} since {since}.",
        "monitor_remind": "Still the case: {sensor}: {value}{limit} since {since}.",
        "monitor_ok_title": "✅ {rule}",
        "monitor_ok": "{sensor}: {value}. Back to normal.",
        "monitor_limit": " (limit {limit})",
    },
    "de": {
        "triggered_title": "🚨 Alarm: {name}",
        "triggered": "{sensor} um {time}.",
        "triggered_manual": "Alarm von Hand ausgelöst um {time}.",
        "sensor_type_door": "Tür",
        "sensor_type_window": "Fenster",
        "sensor_type_garage_door": "Garagentor",
        "sensor_type_opening": "Öffnung",
        "sensor_type_motion": "Bewegungsmelder",
        "sensor_type_occupancy": "Präsenzmelder",
        "sensor_type_presence": "Präsenzmelder",
        "sensor_type_smoke": "Rauchmelder",
        "sensor_type_gas": "Gassensor",
        "sensor_type_carbon_monoxide": "CO-Melder",
        "sensor_type_moisture": "Wassersensor",
        "sensor_type_heat": "Hitzemelder",
        "sensor_type_vibration": "Erschütterungssensor",
        "sensor_type_tamper": "Manipulationsmelder",
        "sensor_type_glass_break": "Glasbruchmelder",
        "sensor_type_safety": "Sicherheitssensor",
        "sensor_type_sound": "Geräuschsensor",
        "sensor_type_sensor": "Sensor",
        "alarm_fire": "Feueralarm",
        "alarm_heat": "Hitzealarm",
        "alarm_water": "Wasseralarm",
        "alarm_gas": "Gasalarm",
        "alarm_intrusion": "Einbruchalarm",
        "alarm_alarm": "Alarm",
        "triggered_title_fire": "🔥 Feueralarm: {name}",
        "triggered_fire": "{sensor} meldet Rauch um {time}.",
        "triggered_title_heat": "🌡️ Hitzealarm: {name}",
        "triggered_heat": "{sensor} meldet Hitze um {time}.",
        "triggered_title_water": "💧 Wasseralarm: {name}",
        "triggered_water": "{sensor} meldet Wasser um {time}.",
        "triggered_title_gas": "⚠️ Gasalarm: {name}",
        "triggered_gas": "{sensor} meldet Gas um {time}.",
        "pending_title": "⏳ Eingangsverzögerung: {name}",
        "pending": "{sensor} geöffnet. Alarm in {seconds}, wenn niemand deaktiviert.",
        "armed_title": "🔒 {name}: {mode} scharf",
        "armed": "Scharf geschaltet von {by}.",
        "armed_noby": "Die Anlage ist scharf.",
        "disarmed_title": "🔓 {name} deaktiviert",
        "disarmed": "Deaktiviert von {by}.",
        "disarmed_noby": "Die Anlage ist deaktiviert.",
        "ended_title": "✅ Alarm beendet: {name}",
        "ended": "Deaktiviert von {by}.",
        "ended_ack": "Quittiert von {by}. Die Anlage bleibt scharf.",
        "ended_ack_noby": "Quittiert. Die Anlage bleibt scharf.",
        "ended_noby": "Der Alarm ist vorbei.",
        "arm_failed_title": "⛔ {name}: {mode} nicht möglich",
        "arm_failed": "Offen: {sensors}.",
        "arm_failed_unreachable": "Nicht erreichbar: {sensors}.",
        "offline_title": "📡 Sensor nicht erreichbar: {name}",
        "offline": "{sensor} antwortet nicht mehr, während die Anlage scharf ist.",
        "again_title": "🚨 Weiterer Sensor: {name}",
        "again": "{sensor} hat um {time} ausgelöst, der Alarm läuft noch.",
        "code_locked_title": "🔒 {name}: Codes gesperrt",
        "code_locked": "{count} falsche Codes hintereinander. Codes sind für {minutes} Minuten gesperrt.",
        "test_title": "🧪 Test: {name}",
        "test": "Das ist eine Testmeldung von Alarmageddon.",
        "group_alarm": "Alarmmeldungen", "group_maintenance": "Wartungsmeldungen",
        "action_disarm": "Deaktivieren",
        "action_silence": "Alarmton stumm",
        "by_silence": "Push-Meldung",
        "action_open": "Öffnen",
        "mode_home": "Anwesend",
        "mode_away": "Abwesend",
        "mode_night": "Nacht",
        "by_push": "Push-Meldung",
        "by_step": "Alarmaktion",
        "action_ack": "Quittieren",
        "action_retry": "Erneut versuchen", "action_force": "Trotzdem scharf schalten",
        "report_title": "🔕 Stiller Alarm: {name}",
        "report": "{sensor} hat im scharfen Zustand angesprochen. Es wurde kein Alarm ausgelöst, weil dieser Sensor auf \"Stiller Alarm\" steht.",
        "type_triggered": "Alarm", "type_pending": "Eingangsverzögerung", "type_armed": "Scharf geschaltet", "type_disarmed": "Deaktiviert",
        "type_arm_failed": "Scharfschalten nicht möglich", "type_sensor_offline": "Sensor im scharfen Zustand nicht erreichbar",
        "type_alarm_again": "Weiterer Sensor während eines Alarms", "type_code_locked": "Codes nach Fehleingaben gesperrt",
        "type_sensor_report": "Stiller Alarm", "type_battery_low": "Batterie schwach",
        "type_sensor_unavailable": "Sensor nicht erreichbar",
        "by_schedule": "Zeitplan",
        "by_routine": "Routine",
        "maint_title_one": "⚠️ Wartung: {name}",
        "maint_title": "⚠️ Wartung: {count} Sensoren",
        "maint_battery": "{sensor}: Batterie {value} %",
        "maint_offline": "{sensor}: nicht erreichbar seit {time}",
        "type_selftest": "Selbsttest",
        "type_healthcheck": "HealthCheck-Dienst antwortet nicht",
        "selftest_title_one": "⚠️ Selbsttest: 1 Problem",
        "selftest_title": "⚠️ Selbsttest: {count} Probleme",
        "selftest_more": "… und {count} weitere. Einzelheiten: Alarmageddon › Übersicht › Status.",
        "selftest_all": "Alle Anlagen",
        "st_entity_missing": "{system}: {name} fehlt",
        "st_entity_unavailable": "{system}: {name} ist nicht erreichbar",
        "st_service_missing": "{system}: die Aktion {service} gibt es nicht",
        "st_recipient_missing": "{system}: den Empfänger {service} gibt es nicht",
        "st_no_recipients": "{system}: eine Push-Meldung hat keinen Empfänger",
        "st_sound_missing": "{system}: ein eigener Ton fehlt",
        "st_healthcheck_missing": "{system}: eine Aktion kann ihrem HealthCheck-Dienst nichts melden",
        "st_no_url": "{system}: keine Adresse von Home Assistant für die Töne",
        "st_rule_damaged": "{system}: {name} ist beschädigt und läuft nicht",
        "st_system_not_loaded": "{name} konnte nicht geladen werden",
        "st_step_failed": "{system}: {service} ist gescheitert",
        "st_step_timeout": "{system}: {service} hat nicht geantwortet",
        "st_step_hung": "{system}: der Wächter musste eingreifen ({label})",
        "st_notify_failed": "{system}: die Meldung über {service} ging nicht hinaus",
        "st_start_failed": "{system}: ein Teil konnte nicht starten ({part})",
        "st_backup_failed": "{system}: das automatische Backup ist gescheitert",
        "st_ping_failed": "{system}: das Lebenszeichen \"{name}\" ({service}) ging nicht hinaus",
        "time_format": "%d.%m. %H:%M",
        "hc_down_title": "⚠️ HealthCheck-Dienst \"{name}\" antwortet nicht",
        "hc_down_message": "Die Aufrufe an {host} scheitern seit {since} ({reason}; Fehlversuche: {count}). Der Dienst ist vielleicht gestört, oder Home Assistant erreicht das Internet nicht.",
        "hc_up_title": "✅ HealthCheck-Dienst \"{name}\" antwortet wieder",
        "hc_up_message": "{host} antwortet wieder (gestört seit {since}, Fehlversuche: {count}).",
        "hc_reason_timeout": "keine Antwort",
        "hc_reason_error": "keine Verbindung",
        "hc_reason_http": "HTTP {code}",
        "monitor_out_title": "⚠️ {rule}",
        "monitor_out": "{sensor}: {value}{limit} seit {since}.",
        "monitor_remind": "Weiterhin: {sensor}: {value}{limit} seit {since}.",
        "monitor_ok_title": "✅ {rule}",
        "monitor_ok": "{sensor}: {value}. Wieder in Ordnung.",
        "monitor_limit": " (Grenze {limit})",
    },
}


def language(hass: HomeAssistant) -> str:
    lang = (hass.config.language or "").lower()
    return "de" if lang == "de" or lang.startswith("de-") else "en"


# Alarmart je Geräteklasse des auslösenden Sensors: bestimmt {alarm} und die Standardtexte (Rauch, Wasser, Gas, Hitze);
# Tür, Fenster, Bewegung und Verwandte behalten den bisherigen Standardtext
ALARM_KINDS = {
    "smoke": "fire", "heat": "heat", "moisture": "water", "gas": "gas", "carbon_monoxide": "gas",
    "door": "intrusion", "window": "intrusion", "garage_door": "intrusion", "opening": "intrusion", "motion": "intrusion",
    "occupancy": "intrusion", "presence": "intrusion", "vibration": "intrusion", "glass_break": "intrusion",
}
# Arten mit eigenem Standardtext
SPECIAL_KINDS = ("fire", "heat", "water", "gas")


# Platzhalter eigener Texte (Schritt "Push-Meldung", "Alarm endet"); alles andere in geschweiften Klammern bleibt wie geschrieben
# {person} und {delay} (1.62.0) für die festen Meldungen im Reiter Aktionen: wer scharf geschaltet oder deaktiviert hat, und die Zeit der
# Eingangsverzögerung in Worten. Wo es sie nicht gibt (Alarmmeldung), bleiben sie leer.
PLACEHOLDER = re.compile(r"\{(?:name|sensor|type|area|time|mode|alarm|person|delay)\}")


def alarm_kind(device_class: str) -> str:
    return ALARM_KINDS.get(device_class, "alarm")


def format_duration(seconds: float) -> str:
    """Eine Zeit wie im Panel (`fmtDur`): unter 60 s in Sekunden, ab 60 s in Minuten und Sekunden, ab 1 h mit Stunden; Teile, die null sind, entfallen."""
    n = max(0, round(seconds))
    if n < 60:
        return f"{n} s"
    hours, minutes, secs = n // 3600, n % 3600 // 60, n % 60
    return " ".join(part for part in (hours and f"{hours} h", minutes and f"{minutes} min", secs and f"{secs} s") if part)


def text(hass: HomeAssistant, key: str, **values: Any) -> str:
    return TEXTS[language(hass)][key].format(**values)


# Companion App: Domäne der Config Entries und Schlüssel ihrer Daten (homeassistant/components/mobile_app/const.py)
MOBILE_APP = "mobile_app"
# hass.data-Schlüssel der alten notify-Plattformen (homeassistant/components/notify/legacy.py: NOTIFY_SERVICES); dort stehen notify-Gruppen
NOTIFY_SERVICES_KEY = "notify_services"


def recipient_users(hass: HomeAssistant, targets: list[str]) -> set[str]:
    """
    HA-Benutzer der Companion-Geräte hinter den Empfängern: `notify.mobile_app_<gerät>` direkt oder als Mitglied einer
    notify-Gruppe (Plattform "group", auch verschachtelt).

    Wozu: Ein Knopf der Alarmmeldung ("Deaktivieren", "Alarmton stumm") kommt als Ereignis `mobile_app_notification_action`
    zurück. Home Assistant (geprüft: 2026.2, mobile_app/webhook.py `webhook_fire_event`) übernimmt die Daten des Ereignisses
    ungeprüft von der App und beglaubigt nur den Absender: den Benutzer, der das Gerät registriert hat (Kontext des
    Ereignisses). Jedes registrierte Companion-Gerät kann das Ereignis also feuern; darum zählt nur, ob sein Benutzer zu
    einem konfigurierten Alarm-Empfänger gehört. Eine Gerätekennung gibt Home Assistant nicht mit: zwei Geräte desselben
    Benutzers lassen sich nicht unterscheiden.
    """
    by_service: dict[str, str] = {}
    for entry in hass.config_entries.async_entries(MOBILE_APP):
        name, user_id = entry.data.get("device_name"), entry.data.get("user_id")
        if name and user_id:
            # Derselbe Name wie der Dienst der Companion App (notify/legacy.py: slugify(f"{prefix}_{name}"))
            by_service[slugify(f"{MOBILE_APP}_{name}")] = user_id
    groups: dict[str, list[str]] = {}
    platforms = hass.data.get(NOTIFY_SERVICES_KEY)
    for services in platforms.values() if isinstance(platforms, dict) else ():
        for service in services if isinstance(services, list) else ():
            members = getattr(service, "entities", None)  # GroupNotifyPlatform: [{"action": "<dienst>"}]
            name = getattr(service, "_service_name", None)
            if isinstance(name, str) and isinstance(members, list):
                groups[name] = [m.get("action") or m.get("service") for m in members if isinstance(m, dict)]
    users: set[str] = set()
    seen: set[str] = set()
    stack = [t.partition(".")[2] for t in targets if isinstance(t, str) and t.startswith("notify.")]
    while stack:
        name = stack.pop()
        if not isinstance(name, str) or not name or name in seen:
            continue
        seen.add(name)
        if name in by_service:
            users.add(by_service[name])
        stack.extend(groups.get(name, ()))
    return users


@callback
def async_send(hass: HomeAssistant, targets: list[str], payload: dict[str, Any]) -> list[str]:
    """An jeden Empfänger einzeln und nicht blockierend; gibt die erreichbaren Dienste zurück."""
    sent = []
    for target in targets:
        domain, _, service = target.partition(".")
        if not hass.services.has_service(domain, service):
            _LOGGER.warning("Notification service %s not found", target)
            continue
        # Nicht blockierend: eine langsame oder fehlerhafte App darf den Alarm nie aufhalten
        hass.async_create_task(_async_call(hass, domain, service, payload))
        sent.append(target)
    return sent


@callback
def async_persist(hass: HomeAssistant, cfg: dict[str, Any], kind: str, title: str, message: str, notification_id: str, mode: str | None = None) -> None:
    """
    Zusätzlich als Benachrichtigung in Home Assistant (Glocke in der Seitenleiste), wenn die Art das eingeschaltet hat. Sie bleibt stehen,
    bis jemand sie wegklickt; dieselbe Kennung ersetzt den Inhalt (wie der tag auf dem Handy). Unabhängig von den Empfängern.
    """
    if effective_type(cfg, kind, mode).get("persistent"):
        persistent_notification.async_create(hass, message, title=title, notification_id=notification_id)


HC_URL = "/alarmageddon?view=healthcheck"  # ein Tipp auf die Meldung öffnet die Liste der Dienste


@callback
def async_send_healthcheck(hass: HomeAssistant, cfg: dict[str, Any], kind: str, values: dict[str, str], *, tag: str = "alarmageddon_healthcheck") -> list[str]:
    """
    Meldung eines HealthCheck-Dienstes: "hc_down" (antwortet nicht) oder "hc_up" (antwortet wieder). Seit 1.69.0 (Wunsch des Nutzers 2026-11-19,
    22:16/22:17) eine Wartungsmeldung wie der Selbsttest: an/aus, Empfänger (leer: die der Wartung), Kritisch, Lautstärke und "stehen lassen" aus der
    Art "healthcheck", der Text ist fest. "Antwortet wieder" nur mit "healthcheck_up", an dieselben Empfänger, **nie kritisch** (eine Entwarnung
    weckt niemanden); derselbe tag ersetzt "antwortet nicht" auf dem Handy und in Home Assistant. `values` nennt nie die URL (nur Name und Rechner).
    Gibt die Empfänger zurück.
    """
    setting = cfg["types"]["healthcheck"]
    if not setting.get("enabled") or (kind == "hc_up" and not cfg.get("healthcheck_up", True)):
        return []
    title = text(hass, f"{kind}_title", **values)
    message = text(hass, f"{kind}_message", **values)
    if setting.get("persistent"):
        try:
            persistent_notification.async_create(hass, message, title=title, notification_id=tag)
        except Exception:  # noqa: BLE001 - die Benachrichtigung in Home Assistant ist Zusatz: die Meldung aufs Handy geht trotzdem hinaus
            _LOGGER.exception("The persistent notification of the health check could not be created")
    payload = build_payload(cfg, "healthcheck", title, message, tag=tag, critical=kind == "hc_down" and bool(setting.get("critical")), url=HC_URL)
    return async_send(hass, list(setting.get("targets") or cfg["maintenance_targets"]), payload)


def effective_type(cfg: dict[str, Any], kind: str, mode: str | None) -> dict[str, Any]:
    """Einstellung einer Art: der eigene Wert des Modus (nur Arten im scharfen Zustand), sonst der gemeinsame."""
    own = ((cfg.get("modes") or {}).get(mode) or {}).get(kind) if cfg.get("per_mode") and mode and kind in NOTIFY_MODE_KINDS else None
    return {**cfg["types"][kind], **(own or {})}


def event_notice(options: Any, cfg: dict[str, Any], kind: str, trigger: str | None, armed_mode: str | None = None) -> dict[str, Any]:
    """
    Wirksame feste Meldung einer Anlage (1.62.0): "Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung", "Stiller Alarm" für einen Auslöser
    (Modus oder "always"). Hat die Anlage dafür im Reiter Aktionen etwas gespeichert, gilt das. Sonst gilt die bisherige gemeinsame Einstellung
    der Art (bis 1.61.0 im Reiter Benachrichtigungen, mit den eigenen Werten des Modus): so ändert das Update nichts, und eine Anlage aus
    einer älteren Sicherung meldet wie zuvor. Immer alle Felder. `armed_mode`: der Modus, in dem die Anlage gerade scharf ist; ohne eigenen
    Wert für "Immer aktiv" galt bis 1.61.0 für den stillen Alarm eines immer aktiven Sensors der Wert dieses Modus, und so bleibt es.
    """
    saved = (options or {}).get(CONF_EVENT_NOTIFY)
    per_trigger = saved.get(trigger or "") if isinstance(saved, dict) else None
    own = per_trigger.get(kind) if isinstance(per_trigger, dict) else None
    if isinstance(own, dict) and isinstance(own.get("enabled"), bool):
        return {"title": "", "message": "", "critical": False, "volume": 0.8, "persistent": False, "click": "overview", "click_path": "", **own, "targets": list(own.get("targets") or [])}
    legacy = effective_type(cfg, kind, trigger if trigger in MODES else armed_mode)
    return {"enabled": bool(legacy["enabled"]), "title": "", "message": "", "critical": bool(legacy["critical"]), "volume": float(legacy["volume"]),
            "persistent": bool(legacy.get("persistent")), "click": "overview", "click_path": "", "targets": list(legacy.get("targets") or [])}


def build_payload(cfg: dict[str, Any], kind: str, title: str, message: str, *, tag: str | None = None,
                  actions: list | None = None, critical: bool | None = None, volume: float | None = None,
                  url: str | None = None, mode: str | None = None) -> dict[str, Any]:
    """
    Inhalt einer Meldung der Art `kind`. Kritisch und Lautstärke kommen aus den Einstellungen der Art; `critical` überschreibt
    nur das "kritisch" (der Abschluss "Alarm beendet" ersetzt die kritische Meldung durch eine normale mit demselben tag).
    Kritisch: iOS mit "critical" und Lautstärke, Android über den Kanal "alarm_stream" mit hoher Priorität; beides steht in
    jeder kritischen Meldung, jede App nimmt sich, was sie kennt.
    """
    setting = effective_type(cfg, kind, mode)
    is_critical = setting["critical"] if critical is None else critical
    group = "alarmageddon" if NOTIFY_TYPES.get(kind) == "alarm" else "alarmageddon_monitor" if kind == "monitor" else "alarmageddon_maintenance"
    # icon_url: Symbol der Integration (Android); iOS zeigt immer das Symbol der App, das lässt sich nicht ersetzen
    data: dict[str, Any] = {"group": group, "url": url or "/alarmageddon", "clickAction": url or "/alarmageddon", "icon_url": ICON_URL_PATH}
    if tag:
        data["tag"] = tag
    if is_critical:
        data["push"] = {"sound": {"name": "default", "critical": 1, "volume": setting["volume"] if volume is None else volume}, "interruption-level": "critical"}
        data.update({"ttl": 0, "priority": "high", "channel": "alarm_stream"})
    if actions:
        data["actions"] = actions
    return {"title": title, "message": message, "data": data}


async def _async_call(hass: HomeAssistant, domain: str, service: str, payload: dict[str, Any]) -> None:
    # Selbsttest (1.65.0): eine Meldung, die nicht hinausging, hält er fest; geht sie über denselben Dienst wieder hinaus, ist der Befund
    # behoben. Hier importiert: der Selbsttest sendet seine eigene Meldung über dieses Modul.
    from .selftest import async_note, async_resolve  # noqa: PLC0415

    try:
        await asyncio.wait_for(hass.services.async_call(domain, service, payload, blocking=True), 15)
    except Exception as err:  # noqa: BLE001 - jede Meldung einzeln, ein Fehler stoppt die anderen nicht
        _LOGGER.exception("Notification via %s.%s failed", domain, service)
        async_note(hass, None, "notify_failed", f"{domain}.{service}", service=f"{domain}.{service}", reason="timeout" if isinstance(err, TimeoutError) else "error")
        return
    async_resolve(hass, None, "notify_failed", f"{domain}.{service}")


def _with_groups(steps: Any) -> list[dict[str, Any]]:
    """Schritte einer Liste samt den Schritten ihrer Aktions-Gruppen (1.59.0): eine Meldung in einer Gruppe ist eine Meldung des Ablaufs."""
    out: list[dict[str, Any]] = []
    for step in steps if isinstance(steps, list) else []:
        if not isinstance(step, dict):
            continue
        if step.get("type") == "group":
            out.extend(item for item in step.get("steps") or [] if isinstance(item, dict) and item.get("type") != "group")
        else:
            out.append(step)
    return out


class Notifier:
    """Hört auf die Zustände und Ereignisse einer Anlage und meldet nach den globalen Einstellungen."""

    def __init__(self, hass: HomeAssistant, entry: Any, controller: AlarmController, settings: Any) -> None:
        self.hass = hass
        self.entry = entry
        self._ctl = controller
        self._settings = settings
        self._last_state: str | None = None
        # Modus, solange die Anlage nicht deaktiviert ist: beim Deaktivieren ist er schon gelöscht, die Meldung "Deaktiviert" gehört aber
        # zum Modus, der scharf war (wie die Aktionen "Beim Deaktivieren")
        self._mode_seen: str | None = None
        # Auslöser (Modus) des laufenden Alarms: beim Deaktivieren ist der Modus der Anlage schon weg
        self._alarm_trigger: str | None = None
        # Sensor, der den laufenden Alarm ausgelöst hat: beim Deaktivieren und Quittieren löscht der Automat ihn schon,
        # "Alarm endet" braucht ihn für {sensor}, {type}, {area} und {alarm}
        self._alarm_sensor: str | None = None
        self._unsubs: list[Any] = []
        # Ablauf der Anlage: hat er für diesen Auslöser einen eigenen Push-Schritt, meldet der Alarm nicht doppelt
        self.workflow_has_notify = lambda _trigger: False
        # Knopf "Alarmton stumm": Ablauf stoppen (vom Ablauf der Anlage gesetzt)
        self.silence = None
        # Letzte Meldung "nicht erreichbar" je Sensor (1.87.0, Drosselung)
        self._offline_sent: dict[str, Any] = {}

    @property
    def cfg(self) -> dict[str, Any]:
        return self._settings.notify

    def _t(self, key: str, **values: Any) -> str:
        return text(self.hass, key, **values)

    def _name(self, entity_id: str | None) -> str:
        return display_name(self.hass, entity_id) if entity_id else ""

    def _mode(self, mode: str | None) -> str:
        return self._t(f"mode_{mode}") if mode in ("home", "away", "night") else ""

    @callback
    def async_start(self) -> None:
        self._last_state = str(self._ctl.state)
        self._mode_seen = self._ctl.mode
        # Neustart mitten im Alarm: der Auslöser für "Alarm endet" ist der Modus, in dem die Anlage noch steht
        if self._ctl.state == AlarmControlPanelState.TRIGGERED:
            self._alarm_trigger = self._ctl.alarm_plan()[0]
            self._alarm_sensor = self._ctl.triggered_by
        self._unsubs.append(self._ctl.add_listener(self._on_change))
        self._unsubs.append(self._ctl.add_event_listener(self._on_event))
        self._unsubs.append(self.hass.bus.async_listen("mobile_app_notification_action", self._on_action))

    @callback
    def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()

    # ----- Auslöser -----

    def _on(self, kind: str, mode: str | None = None) -> bool:
        # Die Alarmmeldung lässt sich nicht abschalten (Sicherheitsregel: im Zweifel alarmieren); ihre Einstellungen stehen im Push-Schritt
        if kind == "triggered":
            return True
        return bool(effective_type(self.cfg, kind, mode)["enabled"])

    @callback
    def _on_change(self) -> None:
        state = str(self._ctl.state)
        previous = self._last_state
        was_mode = self._mode_seen
        if state != AlarmControlPanelState.DISARMED:
            self._mode_seen = self._ctl.mode
        if state == previous:
            return
        self._last_state = state
        if state != AlarmControlPanelState.DISARMED:
            # Scharf geschaltet (gleich auf welchem Weg): die Knöpfe einer älteren Meldung "Scharfschalten nicht möglich" sind
            # verbraucht, sie schalten nach dem nächsten Deaktivieren nicht noch einmal scharf
            self._arm_attempts().pop(self.entry.entry_id, None)
        if state == AlarmControlPanelState.TRIGGERED:
            # Der Hauptablauf des Alarms bestimmt Alarmmeldung und "Alarm endet"; laufen zwei Abläufe (Modus und "Immer aktiv"),
            # entfällt die Standardmeldung, sobald einer von ihnen einen Push-Schritt hat
            plan = self._ctl.alarm_plan()
            self._alarm_trigger = plan[0]
            self._alarm_sensor = self._ctl.triggered_by
            if self._on("triggered") and not any(self.workflow_has_notify(flow) for flow in plan):
                self.send_alarm()
        elif state == AlarmControlPanelState.PENDING and self.notice("pending", self._ctl.mode)["enabled"]:
            # Die Zeit, die wirklich läuft: ein Sensor kann eine eigene Eingangsverzögerung haben (bis 1.57.0 stand hier immer die des Modus)
            left = self._ctl.delay_left()
            seconds = self._ctl.entry_delay if left is None else max(0, round(left))
            self.send_event("pending", self._ctl.mode, sensor=self._ctl.triggered_by, seconds=seconds)
        elif state in (AlarmControlPanelState.ARMED_HOME, AlarmControlPanelState.ARMED_AWAY, AlarmControlPanelState.ARMED_NIGHT):
            if previous == AlarmControlPanelState.TRIGGERED:
                # Alarm quittiert (die Anlage bleibt scharf): wie beim Deaktivieren ersetzt "Alarm beendet" die Alarmmeldung
                if self._on("triggered") and self._end_sends():
                    self.send_alarm_end(self._ctl.changed_by, acknowledged=True)
            elif self.notice("armed", self._ctl.mode)["enabled"]:
                self.send_event("armed", self._ctl.mode, person=self._ctl.changed_by)
        elif state == AlarmControlPanelState.DISARMED:
            by = self._ctl.changed_by
            if previous == AlarmControlPanelState.TRIGGERED and self._on("triggered"):
                # Nach einem Alarm nur die Abschlussmeldung; ist sie ausgeschaltet (1.63.0), geht nichts hinaus, auch nicht "Deaktiviert"
                if self._end_sends():
                    self.send_alarm_end(by)
            elif self.notice("disarmed", was_mode)["enabled"]:
                # Die Meldung des Modus, der scharf war (oder gerade scharf wurde)
                self.send_event("disarmed", was_mode, person=by)

    @callback
    def _on_event(self, kind: str, data: dict[str, Any]) -> None:
        name = self.entry.title
        if kind == "arm_failed" and self._on("arm_failed"):
            sensors = ", ".join(self._name(e) for e in data.get("sensors", []))
            actions = []
            if data.get("mode") in self._ctl.modes:
                # Der gescheiterte Versuch wird gemerkt: die Knöpfe schalten genau diesen Modus scharf, und nur eine Zeit lang
                self._arm_attempts()[self.entry.entry_id] = {"mode": data["mode"], "at": dt_util.utcnow()}
                actions = [{"action": f"{prefix}{self.entry.entry_id}", "title": self._t(f"action_{key}")}
                           for key, prefix in (("retry", PUSH_ACTION_RETRY), ("force", PUSH_ACTION_FORCE)) if self.cfg.get(f"arm_{key}_action")]
            # Nicht erreichbare Sensoren (1.87.0, "Muss beim Scharfschalten erreichbar sein") stehen in einem eigenen Satz
            parts = [self._t("arm_failed", sensors=sensors)] if data.get("sensors") else []
            if data.get("unreachable"):
                parts.append(self._t("arm_failed_unreachable", sensors=", ".join(self._name(e) for e in data["unreachable"])))
            self._send("arm_failed", self._t("arm_failed_title", name=name, mode=self._mode(data.get("mode"))),
                       " ".join(parts), actions=actions or None)
        elif kind == "sensor_offline" and self._on("sensor_offline", self._ctl.mode) and self._offline_due(data.get("sensor")):
            # Im scharfen Zustand ist ein ausgefallener Melder ein blinder Fleck (Standard: kritisch an die Alarm-Empfänger). Je Sensor höchstens
            # einmal in OFFLINE_NOTIFY_GAP (1.87.0, Code-Review M6): ein flatternder Sensor klingelte sonst bei jedem Abriss
            self._send("sensor_offline", self._t("offline_title", name=self._name(data.get("sensor"))),
                       self._t("offline", sensor=self._name(data.get("sensor"))))
        elif kind == "sensor_again" and self._on("alarm_again"):
            # Weiterer Sensor im Zustand "Alarm" (1.87.0, Code-Review H2): der Automat drosselt je Sensor (ALARM_AGAIN_THROTTLE)
            sensor = data.get("sensor")
            time = dt_util.as_local(dt_util.utcnow()).strftime("%H:%M")
            self._send("alarm_again", self._t("again_title", name=self._name(sensor)), self._t("again", sensor=self._name(sensor), time=time),
                       tag=f"alarmageddon_{self.entry.entry_id}_again_{sensor}")
        elif kind == "code_locked" and self._on("code_locked"):
            # Sperre nach falschen Codes (1.87.0, Code-Review M2): nie der Code, nur Anzahl und Dauer
            minutes = max(1, round(int(data.get("seconds") or 60) / 60))
            self._send("code_locked", self._t("code_locked_title", name=name), self._t("code_locked", count=CODE_MAX_ATTEMPTS, minutes=minutes))
        elif kind == "sensor_report":
            # Sensor auf "Stiller Alarm": keine Alarmauslösung, aber eine Meldung (Standard: kritisch), eigener tag je Sensor. Es gilt die
            # Meldung des Auslösers: der Modus, in dem die Anlage scharf ist, oder "Immer aktiv" (ein immer aktiver Sensor)
            scope = data.get("scope") or self._ctl.mode or WORKFLOW_ALWAYS
            if self.notice("sensor_report", scope)["enabled"]:
                self.send_event("sensor_report", scope, sensor=data.get("sensor"))

    def _offline_due(self, sensor: Any) -> bool:
        """Meldung "nicht erreichbar" für diesen Sensor fällig? Höchstens einmal je OFFLINE_NOTIFY_GAP."""
        now = dt_util.utcnow()
        last = self._offline_sent.get(str(sensor))
        if last is not None and (now - last).total_seconds() < OFFLINE_NOTIFY_GAP:
            return False
        self._offline_sent[str(sensor)] = now
        return True

    def _alarm_recipients(self) -> list[str]:
        """Alarm-Empfänger der Konfiguration und die eigenen Empfänger der Meldungen dieser Anlage (Schritt "Push-Meldung", "Alarm endet")."""
        out = list(self.cfg["alarm_targets"])
        options = self.entry.options
        flows = (options.get("workflows") or {}).values()
        ends = (options.get("workflow_end") or {}).values()
        for step in (s for flow in flows if isinstance(flow, list) for s in _with_groups(flow) if s.get("type") == "notify"):
            out += [t for t in step.get("targets") or [] if isinstance(t, str)]
        for end in ends:
            own = end.get("notify") if isinstance(end, dict) else None
            out += [t for t in (own or {}).get("targets") or [] if isinstance(t, str)]
        return list(dict.fromkeys(out))

    @callback
    def _on_action(self, event: Event) -> None:
        """
        Knöpfe der Meldung. "Deaktivieren" und "Alarmton stumm" nur, wenn ausdrücklich eingeschaltet (Sicherheitsregel).
        "Alarmton stumm" lässt die Anlage im Alarm und stoppt nur die Schritte (Geräte kehren zurück).
        Beide wirken nur, solange der Alarm läuft: eine alte Alarmmeldung, die auf dem Handy liegen blieb (das "Alarm beendet"
        kam nie an), darf eine inzwischen wieder scharfe Anlage nicht deaktivieren. Und nur von einem Gerät, dessen Benutzer
        zu den konfigurierten Alarm-Empfängern gehört.
        """
        action = event.data.get("action")
        arm = {f"{PUSH_ACTION_RETRY}{self.entry.entry_id}": "retry", f"{PUSH_ACTION_FORCE}{self.entry.entry_id}": "force"}.get(action)
        if arm is not None:
            self._on_arm_action(arm, event)
            return
        key = {f"{PUSH_ACTION_DISARM}{self.entry.entry_id}": "disarm", f"{PUSH_ACTION_SILENCE}{self.entry.entry_id}": "silence",
               f"{PUSH_ACTION_ACK}{self.entry.entry_id}": "acknowledge"}.get(action)
        if key is None or self._ctl.state != AlarmControlPanelState.TRIGGERED or not self._button_allowed(key):
            return
        # Nur ein konfigurierter Alarm-Empfänger darf antworten: das Ereignis kann jedes registrierte Companion-Gerät feuern
        # (siehe recipient_users). Ohne beglaubigten Absender (Automation, Entwicklerwerkzeuge ohne Benutzer) passiert nichts.
        user_id = event.context.user_id
        if not user_id or user_id not in recipient_users(self.hass, self._alarm_recipients()):
            _LOGGER.warning("%s: push action '%s' ignored, the sender is not a configured alarm recipient", self.entry.title, key)
            return
        if key == "disarm":
            self.hass.async_create_task(self._ctl.async_disarm(None, self._t("by_push"), skip_code=True))
        elif key == "acknowledge":
            self._ctl.acknowledge(self._t("by_push"))
        elif self.silence:
            self.hass.async_create_task(self._silence())

    def _arm_attempts(self) -> dict[str, dict[str, Any]]:
        """Gescheiterte Versuche scharf zu schalten, je Anlage der letzte. Ausserhalb der Anlage abgelegt: sie überstehen ihr Neuladen."""
        return self.hass.data.setdefault(DATA_ARM_FAILED, {})

    @callback
    def _on_arm_action(self, key: str, event: Event) -> None:
        """
        Knöpfe der Meldung "Scharfschalten nicht möglich" (1.18.0): "Erneut versuchen" und "Trotzdem scharf schalten".

        Ein Knopf auf dem Handy schaltet hier die Anlage, darum gilt jede dieser Bedingungen (je mit Test und Mutationszeile):
        der Knopf ist eingeschaltet; die Anlage ist deaktiviert; es gibt einen gescheiterten Versuch, er ist höchstens
        ARM_BUTTONS_VALID Sekunden alt (eine alte Meldung schaltet nicht Tage später scharf); der Absender ist ein
        Benutzer, der diese Meldung bekommt. Der Modus kommt aus dem gemerkten Versuch, nie
        aus dem Ereignis. Ein Code ist nicht nötig (Entscheid des Nutzers): Scharfschalten erhöht den Schutz.
        """
        if not self.cfg.get(f"arm_{key}_action"):
            return
        if self._ctl.state != AlarmControlPanelState.DISARMED:
            return
        attempt = self._arm_attempts().get(self.entry.entry_id)
        if not attempt or (dt_util.utcnow() - attempt["at"]).total_seconds() > ARM_BUTTONS_VALID:
            return
        mode = attempt["mode"]  # einen inzwischen abgeschalteten Modus lehnt der Automat ab (async_arm)
        user_id = event.context.user_id
        if not user_id or user_id not in recipient_users(self.hass, self._targets("arm_failed")):
            _LOGGER.warning("%s: push action '%s' ignored, the sender is not a recipient of this message", self.entry.title, key)
            return
        self.hass.async_create_task(self._arm_by_push(mode, force=key == "force"))

    async def _arm_by_push(self, mode: str, force: bool) -> None:
        try:
            await self._ctl.async_arm(mode, None, self._t("by_push"), skip_code=True, force=force)
        except HomeAssistantError:
            # "Erneut versuchen" bei immer noch offenem Sensor: der Automat hat es schon gemeldet (neue Meldung mit Knöpfen)
            _LOGGER.debug("%s: arming by push action was not possible", self.entry.title)

    def _alarm_steps(self) -> list[dict[str, Any]]:
        """Push-Schritte des Ablaufs für den laufenden Alarm (leer: es geht die Standardmeldung raus)."""
        flows = self.entry.options.get("workflows") or {}
        return [s for flow in self._ctl.alarm_plan() for s in _with_groups(flows.get(flow, [])) if s.get("type") == "notify"]

    def _buttons(self, step: dict[str, Any] | None) -> dict[str, bool]:
        """Welche Knöpfe eine Alarmmeldung hat: Wert aus dem Push-Schritt, sonst der frühere globale Wert."""
        own = (step or {}).get("buttons") or {}
        return {key: bool(own.get(key, self.cfg[f"{key}_action"])) for key in ("open", "silence", "acknowledge", "disarm")}

    def _button_allowed(self, key: str) -> bool:
        """
        Ein Knopf wirkt nur, wenn die Alarmmeldung ihn anbietet. Aus der Konfiguration abgeleitet (nicht aus dem Gedächtnis),
        damit er auch nach einem Neustart von Home Assistant noch wirkt: Meldungen auf dem Handy bleiben ja stehen.
        """
        steps = self._alarm_steps() or [None]
        return any(self._buttons(step)[key] for step in steps)

    async def _silence(self) -> None:
        if self._ctl.state == AlarmControlPanelState.TRIGGERED and await self.silence():
            self._ctl.emit("silenced", by=self._t("by_silence"))

    # ----- Senden -----

    def text(self, key: str) -> str:
        """Übersetzter Text für andere Teile der Integration (zum Beispiel "von wem" bei einer Quittierung)."""
        return self._t(key)

    def _tag(self) -> str:
        return f"alarmageddon_{self.entry.entry_id}"

    @staticmethod
    def _click_target(step: dict[str, Any] | None) -> str:
        """Wohin ein Tipp auf die Alarmmeldung führt: Standard das Protokoll mit dem laufenden Alarm (Zeitachse seit dem Auslösen)."""
        step = step or {}
        mode = step.get("click", "log")
        if mode == "custom" and step.get("click_path"):
            return step["click_path"]
        if mode == "overview":
            return "/alarmageddon"
        return "/alarmageddon?view=log"

    def _fill(self, template: str, sensor: str | None, time: str, mode: str | None = None, person: str = "", delay: str = "") -> str:
        """Platzhalter eines eigenen Texts füllen; nur die bekannten (PLACEHOLDER), alles andere bleibt wie geschrieben (kein str.format)."""
        device_class, area = sensor_info(self.hass, sensor)
        values = {
            "{person}": person,
            "{delay}": delay,
            "{name}": self.entry.title,
            "{sensor}": self._name(sensor) if sensor else "",
            "{time}": time,
            "{mode}": self._mode(mode or self._ctl.mode),
            "{type}": self._type(device_class),
            "{area}": area,
            "{alarm}": self._t(f"alarm_{alarm_kind(device_class)}"),
        }
        # In einem Durchgang: ein eingesetzter Wert (Name der Anlage, Name eines Sensors) wird nie selbst noch einmal ersetzt
        return PLACEHOLDER.sub(lambda match: values[match.group(0)], template).strip()

    def _type(self, device_class: str) -> str:
        """Sensorart in Worten (Rauchmelder, Fenster …); unbekannte Klassen leer, nicht erfunden."""
        key = f"sensor_type_{device_class}"
        return self._t(key) if key in TEXTS[language(self.hass)] else ""

    @callback
    def send_alarm(self, test: bool = False, step: dict[str, Any] | None = None) -> None:
        """Alarmmeldung mit Aktionen (auch als Schritt im Ablauf); kritisch und Lautstärke nach den Einstellungen der Art "Alarm"."""
        name = self.entry.title
        sensor = self._ctl.triggered_by
        time = dt_util.as_local(dt_util.utcnow()).strftime("%H:%M")
        kind = alarm_kind(sensor_info(self.hass, sensor)[0]) if sensor else "alarm"
        special = kind if kind in SPECIAL_KINDS else None
        default_title = self._t(f"triggered_title_{special}", name=name) if special else self._t("triggered_title", name=name)
        if special:
            default_message = self._t(f"triggered_{special}", sensor=self._name(sensor), time=time)
        else:
            default_message = self._t("triggered", sensor=self._name(sensor), time=time) if sensor else self._t("triggered_manual", time=time)
        step = step or {}
        title, message = step.get("title"), step.get("message")
        # Eigener Text aus dem Schritt der Alarmaktionen ersetzt den Standardtext
        if custom_title := (title or "").strip():
            title = self._fill(custom_title, sensor, time) or default_title
        else:
            title = default_title
        if custom_message := (message or "").strip():
            message = self._fill(custom_message, sensor, time) or default_message
        else:
            message = default_message
        if test:
            title = self._t("test_title", name=title)
        buttons = self._buttons(step)
        target = self._click_target(step)
        actions = []
        if buttons["open"]:
            actions.append({"action": PUSH_ACTION_OPEN, "title": self._t("action_open"), "uri": target})
        if buttons["silence"]:
            actions.insert(0, {"action": f"{PUSH_ACTION_SILENCE}{self.entry.entry_id}", "title": self._t("action_silence")})
        if buttons["acknowledge"]:
            actions.insert(0, {"action": f"{PUSH_ACTION_ACK}{self.entry.entry_id}", "title": self._t("action_ack")})
        if buttons["disarm"]:
            # iOS verlangt dafür Face ID/Code (authenticationRequired); Android kennt das nicht
            actions.insert(0, {"action": f"{PUSH_ACTION_DISARM}{self.entry.entry_id}", "title": self._t("action_disarm"),
                               "authenticationRequired": True, "destructive": True})
        self._send("triggered", title, message, tag=self._tag(), actions=actions, critical=step.get("critical"), volume=step.get("volume"), url=target, targets=step.get("targets"))

    def _end_value(self) -> dict[str, Any]:
        """Element "Alarm endet" des Auslösers, der den Alarm ausgelöst hat (Konfiguration › Aktionen)."""
        value = (self.entry.options.get("workflow_end") or {}).get(self._alarm_trigger or self._ctl.mode or "always")
        return value if isinstance(value, dict) else {}

    def _end_notify(self) -> dict[str, Any] | None:
        """Eigene Meldung aus dem Element "Alarm endet", wenn eingeschaltet."""
        own = self._end_value().get("notify")
        return own if isinstance(own, dict) and own.get("enabled") else None

    def _end_sends(self) -> bool:
        """Geht die Abschlussmeldung hinaus? Nur ein ausdrückliches "aus" (1.63.0) hält sie zurück; fehlt die Angabe, wie bis 1.62.x: ja."""
        return self._end_value().get("send") is not False

    @callback
    def send_alarm_end(self, by: str | None, test: bool = False, own: dict[str, Any] | None = None, acknowledged: bool = False) -> None:
        """
        "Alarm beendet": gleicher tag wie die Alarmmeldung, ersetzt also die kritische Meldung auf dem Handy. Ohne eigene Einstellung
        ein Standardtext und nie kritisch; mit eigener Meldung (Titel, Text, Kritisch, Lautstärke, Klickziel) gelten deren Werte.
        """
        name = self.entry.title
        own = own or self._end_notify()
        time = dt_util.as_local(dt_util.utcnow()).strftime("%H:%M")
        title = self._t("ended_title", name=name)
        if acknowledged:
            message = self._t("ended_ack", by=by) if by else self._t("ended_ack_noby")
        else:
            message = self._t("ended", by=by) if by else self._t("ended_noby")
        critical, volume, target = False, None, "/alarmageddon?view=log"
        if own:
            sensor = self._ctl.triggered_by or self._alarm_sensor
            mode = self._alarm_trigger if self._alarm_trigger in ("home", "away", "night") else None
            title = self._fill((own.get("title") or "").strip(), sensor, time, mode) or title
            message = self._fill((own.get("message") or "").strip(), sensor, time, mode) or message
            critical = bool(own.get("critical"))
            volume = own.get("volume")
            target = self._click_target(own)
        if test:
            title = self._t("test_title", name=title)
        self._send("triggered", title, message, tag=self._tag(), critical=critical, volume=volume, url=target, targets=(own or {}).get("targets"))

    # ----- Feste Meldungen im Reiter Aktionen (1.62.0) -----

    def notice(self, kind: str, trigger: str | None) -> dict[str, Any]:
        """Die wirksame feste Meldung dieser Anlage für einen Auslöser (siehe event_notice)."""
        return event_notice(self.entry.options, self.cfg, kind, trigger, self._ctl.mode if trigger == WORKFLOW_ALWAYS else None)

    @callback
    def send_event(self, kind: str, trigger: str | None, *, sensor: str | None = None, person: str | None = None, seconds: float | None = None,
                   notice: dict[str, Any] | None = None, test: bool = False) -> list[str]:
        """
        Feste Meldung senden: "Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung" oder "Stiller Alarm" mit den Werten der Anlage für
        den Auslöser (oder den übergebenen, auch ungespeicherten: Test aus dem Fenster). Eigener Titel und Text ersetzen den Standardtext;
        leer gilt der Standardtext. Ob die Meldung eingeschaltet ist, prüft der Aufrufer. Gibt die Empfänger zurück.
        """
        if kind not in EVENT_NOTIFY_KINDS:
            raise ValueError(kind)
        notice = notice or self.notice(kind, trigger)
        name = self.entry.title
        mode = trigger if trigger in MODES else None
        delay = format_duration(seconds) if seconds is not None else ""
        if kind == "pending":
            title, message = self._t("pending_title", name=name), self._t("pending", sensor=self._name(sensor), seconds=delay)
        elif kind == "armed":
            title = self._t("armed_title", name=name, mode=self._mode(mode))
            message = self._t("armed", by=person) if person else self._t("armed_noby")
        elif kind == "disarmed":
            title = self._t("disarmed_title", name=name)
            message = self._t("disarmed", by=person) if person else self._t("disarmed_noby")
        else:
            title, message = self._t("report_title", name=self._name(sensor)), self._t("report", sensor=self._name(sensor))
        time = dt_util.as_local(dt_util.utcnow()).strftime("%H:%M")
        if custom := str(notice.get("title") or "").strip():
            title = self._fill(custom, sensor, time, mode, person or "", delay) or title
        if custom := str(notice.get("message") or "").strip():
            message = self._fill(custom, sensor, time, mode, person or "", delay) or message
        if test:
            title = self._t("test_title", name=title)
        # Stiller Alarm: eigener tag je Sensor (mehrere Sensoren ersetzen einander nicht)
        tag = f"{self._tag()}_report_{sensor}" if kind == "sensor_report" and sensor and not test else None
        self._ctl.record("notified", type=kind)
        if notice.get("persistent"):
            try:
                persistent_notification.async_create(self.hass, message, title=title, notification_id=tag or f"alarmageddon_{self.entry.entry_id}_{kind}")
            except Exception:  # noqa: BLE001 - die Benachrichtigung in Home Assistant ist Zusatz: die Meldung aufs Handy geht trotzdem hinaus
                _LOGGER.exception("%s: persistent notification failed", self.entry.title)
        targets = [t for t in notice.get("targets") or [] if isinstance(t, str)] or list(self.cfg["alarm_targets"])
        url = self._click_target({"click": notice.get("click") or "overview", "click_path": notice.get("click_path")})
        async_send(self.hass, targets, build_payload(self.cfg, kind, title, message, tag=tag, critical=bool(notice.get("critical")),
                                                     volume=float(notice.get("volume", 0.8)), url=url))
        return targets

    @callback
    def send_event_test(self, kind: str, trigger: str, notice: dict[str, Any]) -> list[str]:
        """Testmeldung einer festen Meldung mit Beispielwerten: der erste Sensor des Auslösers, die Eingangsverzögerung des Modus."""
        mode = trigger if trigger in MODES else None
        sensors = self._ctl.zone(mode) if mode else sorted(self._ctl.always_sensors())
        seconds = (self._ctl.longest_entry_delay(mode) or self._ctl.entry_delay_for(mode)) if kind == "pending" and mode else None
        return self.send_event(kind, trigger, sensor=sensors[0] if sensors and kind in ("pending", "sensor_report") else None, seconds=seconds, notice=notice, test=True)

    @callback
    def send_test(self, kind: str, mode: str | None = None) -> list[str]:
        """Testmeldung einer Art an ihre Empfänger, mit ihrem Kritisch und ihrer Lautstärke (so hört man, wie sie klingt)."""
        title = self._t("test_title", name=self._t(f"type_{kind}"))
        self._send(kind, title, self._t("test"), mode=mode)
        return self._targets(kind, mode)

    def send_group_test(self, group: str) -> list[str]:
        """
        Testmeldung an die Standard-Empfänger einer Gruppe, "alarm" oder "maintenance" (Einrichtungsassistent, seit 1.71.0; Wunsch des Nutzers
        2026-11-20: die Empfänger von Alarmen und von Wartungsmeldungen können verschieden sein, beide sollen sich testen lassen). Nie an eigene
        Empfänger einer Art; klingt wie die Alarmmeldung bzw. wie "Batterie schwach". Ohne Standard-Empfänger geht nichts hinaus (sonst nähme
        `_send` die Empfänger der Art).
        """
        targets = list(self.cfg["alarm_targets" if group == "alarm" else "maintenance_targets"])
        if targets:
            self._send("triggered" if group == "alarm" else "battery_low", self._t("test_title", name=self._t(f"group_{group}")), self._t("test"), targets=targets)
        return targets

    def _targets(self, kind: str, mode: str | None = None) -> list[str]:
        """Empfänger einer Meldung: eigene Empfänger des Modus, dann der Art (1.5.0), sonst die Gruppe oben (Alarm oder Wartung)."""
        own = effective_type(self.cfg, kind, mode).get("targets")
        if own:
            return list(own)
        return self.cfg["alarm_targets" if NOTIFY_TYPES[kind] == "alarm" else "maintenance_targets"]

    @callback
    def _send(self, kind: str, title: str, message: str, *, tag: str | None = None, actions: list | None = None,
              critical: bool | None = None, volume: float | None = None, url: str | None = None, mode: str | None = None,
              targets: list[str] | None = None) -> None:
        self._ctl.record("notified", type=kind)
        # Eigene Werte je Modus gelten nur für Arten im scharfen Zustand; ohne Angabe der Modus der Anlage
        mode = mode or (self._ctl.mode if kind in NOTIFY_MODE_KINDS else None)
        try:
            async_persist(self.hass, self.cfg, kind, title, message, tag or f"alarmageddon_{self.entry.entry_id}_{kind}", mode)
        except Exception:  # noqa: BLE001 - die Benachrichtigung in Home Assistant ist Zusatz: die Meldung aufs Handy geht trotzdem hinaus
            _LOGGER.exception("%s: persistent notification failed", self.entry.title)
        async_send(self.hass, targets or self._targets(kind, mode), build_payload(self.cfg, kind, title, message, tag=tag, actions=actions, critical=critical, volume=volume, url=url, mode=mode))
