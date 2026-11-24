"""
WebSocket-Befehle des Panels. Nur für Administratoren (das Panel selbst
ist es auch). Jede Anlage wird über ihre Config-Entry-ID angesprochen;
fremde IDs lehnt jeder Befehl ab (LEARNINGS).

Texte liefert der Server keine: Fehler kommen als Schlüssel
(translation_key), das Panel formuliert sie in der Sprache von HA.
"""

from __future__ import annotations

import asyncio
import re
import secrets
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.loader import async_get_integrations
from homeassistant.util import slugify

from . import backup, custom_sounds, last_change, reception
from .code import hash_code, match_code
from .systems import async_create_system, new_system_name
from .const import (
    CONF_REALARM_COUNT,
    CONF_REALARM_ENABLED,
    REALARM_COUNT_RANGE,
    realarm_count,
    BATTERY_CHECKS_RANGE,
    BATTERY_THRESHOLD_RANGE,
    AUTO_BACKUP_DAYS,
    AUTO_BACKUP_KEEP_MAX,
    MAX_BACKUPS,
    OFFLINE_MINUTES_RANGE,
    SELFTEST_HOURS_KEYS,
    SELFTEST_MINUTES_RANGE,
    CODE_PATTERN,
    CONF_CODE_ACK_REQUIRED,
    CONF_CODE_ARM_REQUIRED,
    CONF_CODE_HASH,
    CONF_CODE_SALT,
    CONF_CODES,
    MAX_CODES,
    CONF_CONFIRM_WINDOW,
    CONF_ENTRY_DELAY,
    MAX_CONFIRM_WINDOW,
    CONF_ENTRY_SENSORS,
    CONF_SENSORS,
    CONF_EXIT_DELAY_PREFIX,
    CONF_ALWAYS_ENABLED,
    CONF_NIGHT_ENABLED,
    CONF_MONITOR_ENABLED,
    CONF_ACCENT,
    ACCENTS,
    CONF_MONITOR_SENSORS,
    CONF_MONITORS,
    CONF_ROUTINES,
    MODE_ENABLED_DEFAULT,
    MODE_ENABLED_KEY,
    CONF_PER_MODE_SENSORS,
    CONF_PER_MODE_SETTINGS,
    CONF_SENSOR_MODES,
    CONF_SENSOR_OPTIONS,
    CONF_WORKFLOW_END,
    CONF_WORKFLOWS_AFTER,
    CHIMES,
    DATA_CUSTOM_SOUNDS,
    DATA_RECEPTION,
    DECHIMES,
    MAX_CUSTOM_SECONDS,
    MAX_CUSTOM_SOUNDS,
    MAX_CUSTOM_TOTAL_BYTES,
    MAX_UPLOAD_BYTES,
    CONF_WORKFLOWS_ARMED,
    CONF_WORKFLOWS_DISARMED,
    CONF_WORKFLOWS_REPORT,
    CONF_EVENT_NOTIFY,
    EVENT_NOTIFY_ALWAYS,
    EVENT_NOTIFY_KINDS,
    CONF_WORKFLOWS_ARMING,
    CONF_WORKFLOWS_ENTRY,
    CONF_WORKFLOWS,
    CONF_ZONE_PREFIX,
    NOTIFY_MODE_KINDS,
    NOTIFY_TYPES,
    PREALARMS,
    SOUNDS,
    SOUNDS_URL_PATH,
    WORKFLOW_TRIGGERS,
    DATA_MONITOR,
    DATA_HEALTHCHECK,
    DATA_SELFTEST,
    DOMAIN,
    HEALTHCHECK_INTERVAL_RANGE,
    HEALTHLOG_RANGES,
    HEALTHCHECK_NOTIFY_FAILS_RANGE,
    HEALTHCHECK_NAME_MAX,
    HEALTHCHECK_SUFFIX_MAX,
    HEALTHCHECK_URL_MAX,
    MAX_HEALTHCHECKS,
    MEASURE_CLASSES,
    MONITOR_NUMERIC_DOMAINS,
    MODES,
    OPEN_SENSOR_MODES,
    SENSOR_CLASSES,
    OPT_ALWAYS_OFF,
    OPT_ENTRY_DELAY,
    SENSOR_OPTIONS,
    SENSOR_TYPES,
    WIZARD_ACTIONS,
    WIZARD_STEPS,
)
from .devices import battery_of, device_field, device_sensors, display_name, free_entity_id, main_device, system_device
from .monitor import check_monitors, number
from .routines import LEAF_STATES, check_routines
from .schemas import step_list, END_NOTIFY_SCHEMA, EVENT_NOTICE_SCHEMA, valid_event_notify, valid_report_step, NOTIFY_TARGETS, MONITOR_STEP, MONITORS, ROUTINES, SENSOR_VALUES, SECONDS as _SECONDS, valid_after_step, valid_armed_step, valid_arming_step, valid_disarmed_step, valid_end, valid_entry_step, valid_step
from .sensor_history import BATTERY_HOURS, STATE_HOURS, async_battery_forecasts, async_get_stats, async_measure_history, async_numeric_history, async_state_history
from .healthcheck import async_get_healthcheck
from .selftest import async_get_selftest
from .settings import async_get_settings, sensor_type, valid_fail_suffix, valid_healthcheck_name, valid_healthcheck_url

# So lange wartet die Antwort von "data" höchstens auf den Verlauf für "Letzte Änderung" (Sekunden)
LAST_CHANGE_WAIT = 1.5

ALARM_SERVICES = {
    "off": "alarm_disarm",
    "home": "alarm_arm_home",
    "away": "alarm_arm_away",
    "night": "alarm_arm_night",
}


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_data)
    websocket_api.async_register_command(hass, ws_save_zones)
    websocket_api.async_register_command(hass, ws_arm)
    websocket_api.async_register_command(hass, ws_rename)
    websocket_api.async_register_command(hass, ws_create_system)
    websocket_api.async_register_command(hass, ws_preview_system)
    websocket_api.async_register_command(hass, ws_delete_system)
    websocket_api.async_register_command(hass, ws_save_presets)
    websocket_api.async_register_command(hass, ws_save_system)
    websocket_api.async_register_command(hass, ws_save_notify)
    websocket_api.async_register_command(hass, ws_save_display)
    websocket_api.async_register_command(hass, ws_save_auto_backup)
    websocket_api.async_register_command(hass, ws_test_notify)
    websocket_api.async_register_command(hass, ws_test_end_notify)
    websocket_api.async_register_command(hass, ws_save_workflows)
    websocket_api.async_register_command(hass, ws_test_workflow)
    websocket_api.async_register_command(hass, ws_stop_workflow)
    websocket_api.async_register_command(hass, ws_acknowledge)
    websocket_api.async_register_command(hass, ws_delete_recording)
    websocket_api.async_register_command(hass, ws_alarm_seen)
    websocket_api.async_register_command(hass, ws_routine_entities)
    websocket_api.async_register_command(hass, ws_monitor_entities)
    websocket_api.async_register_command(hass, ws_sensor_candidates)
    websocket_api.async_register_command(hass, ws_test_event_notify)
    websocket_api.async_register_command(hass, ws_save_monitors)
    websocket_api.async_register_command(hass, ws_test_monitor_step)
    websocket_api.async_register_command(hass, ws_battery_forecast)
    websocket_api.async_register_command(hass, ws_sensor_history)
    websocket_api.async_register_command(hass, ws_log)
    websocket_api.async_register_command(hass, ws_export)
    websocket_api.async_register_command(hass, ws_import)
    websocket_api.async_register_command(hass, ws_backups)
    websocket_api.async_register_command(hass, ws_backup_create)
    websocket_api.async_register_command(hass, ws_backup_get)
    websocket_api.async_register_command(hass, ws_backup_delete)
    websocket_api.async_register_command(hass, ws_add_code)
    websocket_api.async_register_command(hass, ws_update_code)
    websocket_api.async_register_command(hass, ws_remove_code)
    websocket_api.async_register_command(hass, ws_rename_sound)
    websocket_api.async_register_command(hass, ws_delete_sound)
    websocket_api.async_register_command(hass, ws_selftest_run)
    websocket_api.async_register_command(hass, ws_selftest_dismiss)
    websocket_api.async_register_command(hass, ws_selftest_checked)
    websocket_api.async_register_command(hass, ws_healthcheck_save)
    websocket_api.async_register_command(hass, ws_healthcheck_delete)
    websocket_api.async_register_command(hass, ws_healthcheck_ping)
    websocket_api.async_register_command(hass, ws_healthcheck_history)
    websocket_api.async_register_command(hass, ws_wizard)


def _entry(hass: HomeAssistant, connection, msg: dict[str, Any]) -> ConfigEntry | None:
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    if entry is None or entry.domain != DOMAIN or entry.state is not ConfigEntryState.LOADED:
        connection.send_error(msg["id"], "not_found", "Unknown alarm system")
        return None
    return entry


def _codes_lock(hass: HomeAssistant, entry_id: str) -> asyncio.Lock:
    """Sperre je Anlage für Hinzufügen, Bearbeiten und Entfernen persönlicher Codes (1.63.0, Code-Review)."""
    locks: dict[str, asyncio.Lock] = hass.data.setdefault(f"{DOMAIN}_code_locks", {})
    return locks.setdefault(entry_id, asyncio.Lock())


def _stored_codes(entry: ConfigEntry) -> list[dict[str, Any]]:
    """
    Persönliche Codes aus den gespeicherten Optionen, nur vollständige Einträge, wie AlarmController.codes. Ohne den Umweg über den
    Automaten: nach dem Warten auf die Sperre lädt die Anlage vielleicht gerade neu.
    """
    return [c for c in entry.options.get(CONF_CODES) or [] if isinstance(c, dict) and c.get("hash") and c.get("salt")]


def _alarm_entity(hass: HomeAssistant, entry: ConfigEntry) -> str | None:
    return er.async_get(hass).async_get_entity_id("alarm_control_panel", DOMAIN, f"{entry.entry_id}_alarm")


def _alarm_run(entry: ConfigEntry) -> dict[str, Any]:
    """Der laufende Alarm oder Test einer Anlage; die Aktionen nach dem Quittieren gelten nicht als laufender Ablauf."""
    run = (entry.runtime_data.workflow.running or {}) if entry.runtime_data.workflow else {}
    return {} if run.get("after") else run


async def _sensor_info(hass: HomeAssistant, extra: set[str], measures: bool = True, candidates: bool = True) -> dict[str, dict[str, Any]]:
    """
    Kandidaten für Zonen: binary_sensor mit passender Geräteklasse, dazu alle
    schon gewählten (auch wenn ihre Klasse nicht passt). Batterie über den
    Batteriesensor desselben Geräts, damit jede Integration funktioniert.

    `candidates`: ohne (1.60.0) nur die gewählten Sensoren (`extra`). Die Übersicht braucht nur sie; die Kandidaten des ganzen Hauses
    (jeder Tür-, Fenster- und Bewegungssensor, mit eingeschalteter Überwachung jede Temperatur und Luftfeuchtigkeit) holt das Panel
    erst für "Sensoren hinzufügen" (ws_sensor_candidates). Bis 1.59.0 gingen sie bei jedem Öffnen der Übersicht und danach alle 30
    Sekunden über die Leitung: in einem Haus mit 400 Geräten rund 475 kB statt rund 15 kB.

    `measures`: Messwerte (Temperatur, Luftfeuchtigkeit ...) als Kandidaten der Überwachung. Ohne eingeschaltete Überwachung bietet das
    Panel sie nirgends an; dann kommen nur die schon gewählten mit (1.58.0: ein Haus hat oft Hunderte davon, und die Antwort geht bei
    jedem Öffnen der Übersicht und danach alle 30 Sekunden über die Leitung).
    """
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    batteries, signals = device_sensors(hass)

    out: dict[str, dict[str, Any]] = {}
    # Empfang und Hardware je Gerät nur einmal: ein Gerät hat oft mehrere Sensoren (Temperatur, Luftfeuchtigkeit, Batterie ...)
    live: dict[str, dict[str, Any] | None] = {}
    hardware: dict[str, Any] = {}
    if candidates:
        states = [*hass.states.async_all("binary_sensor"), *hass.states.async_all("sensor")]
    else:
        states = [state for state in (hass.states.get(entity_id) for entity_id in sorted(extra)) if state is not None and state.domain in ("binary_sensor", "sensor")]
    for state in states:
        # Messwerte (Temperatur, Luftfeuchtigkeit, CO2 ...) für die Überwachung (1.48.0): nur Sensoren mit Zahl und Einheit. Zuerst die
        # billige Prüfung am Zustand: ein Haus hat oft Tausende "sensor"-Entitäten, die Liste wird bei jeder Abfrage des Panels gebaut.
        measure = state.entity_id.startswith("sensor.")
        if measure and not (measures and state.attributes.get("device_class") in MEASURE_CLASSES and state.attributes.get("unit_of_measurement") or state.entity_id in extra):
            continue
        reg = ent_reg.async_get(state.entity_id)
        if reg and reg.platform == DOMAIN:
            continue
        device_class = (reg.device_class or reg.original_device_class) if reg else None
        device_class = device_class or state.attributes.get("device_class")
        if not measure and device_class not in SENSOR_CLASSES and state.entity_id not in extra:
            continue
        device = dev_reg.async_get(reg.device_id) if reg and reg.device_id else None
        if device is not None and device.id not in live:
            live[device.id] = reception.live_signal(hass, device)
            hardware[device.id] = main_device(hass, device)
        made = hardware.get(device.id) if device is not None else None
        area_id = (reg.area_id if reg else None) or (device.area_id if device else None)
        area = area_reg.async_get_area(area_id) if area_id else None
        out[state.entity_id] = {
            "name": display_name(hass, state.entity_id),
            "device_name": (device.name_by_user or device.name) if device else None,
            "device_class": device_class,
            "type": "measure" if measure else sensor_type(hass, state.entity_id),
            "kind": "value" if measure else "state",
            "unit": state.attributes.get("unit_of_measurement") if measure else None,
            "area": area.name if area else None,
            "platform": reg.platform if reg else None,
            "battery": batteries.get(reg.device_id) if reg and reg.device_id else None,
            "signal": signals.get(reg.device_id) if reg and reg.device_id else None,
            # ZHA und Bluetooth (seit 1.41.0): der Wert kommt direkt aus der Integration, ohne Entität; sonst None
            "signal_live": live.get(device.id) if device is not None else None,
            "manufacturer": device_field(made, "manufacturer"),
            "model": device_field(made, "model"),
            "sw_version": device_field(made, "sw_version"),
            "device_id": device.id if device else None,
        }
    # Gewählte Sensoren, die es (gerade) nicht gibt, trotzdem zeigen: der Nutzer soll sie entfernen können
    for entity_id in extra - out.keys():
        out[entity_id] = {"name": entity_id, "device_class": None, "type": "measure" if entity_id.startswith("sensor.") else "other",
                          "kind": "value" if entity_id.startswith("sensor.") else "state", "unit": None, "area": None, "platform": None, "battery": None,
                          "signal": None, "signal_live": None, "manufacturer": None, "model": None, "sw_version": None, "device_id": None, "missing": True}
    return out


async def _with_integration(hass: HomeAssistant, sensors: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Den Anzeigenamen der Integration je Sensor ergänzen."""
    platforms = {s["platform"] for s in sensors.values() if s["platform"]}
    integrations = await async_get_integrations(hass, platforms)
    names = {p: (i.name if not isinstance(i, Exception) else p) for p, i in integrations.items()}
    for info in sensors.values():
        info["integration"] = names.get(info["platform"], info["platform"])
    return sensors


def _chosen_sensors(hass: HomeAssistant) -> tuple[set[str], bool]:
    """Die Sensoren aller geladenen Anlagen (Zonen, Liste, eigene Werte, Überwachung) und ob eine Anlage die Überwachung eingeschaltet hat."""
    chosen: set[str] = set()
    monitoring = False
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is not ConfigEntryState.LOADED:
            continue
        ctl = entry.runtime_data.controller
        chosen |= {e for mode in ctl.modes for e in ctl.zone(mode)} | set(ctl.sensor_overrides) | set(entry.options.get(CONF_SENSORS) or []) | set(entry.options.get(CONF_MONITOR_SENSORS) or [])
        monitoring = monitoring or ctl.monitor_enabled
    return chosen, monitoring


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/sensor_candidates", vol.Optional("measures", default=False): bool})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_sensor_candidates(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Alle Sensoren, die sich einer Anlage hinzufügen lassen (Fenster "Sensoren hinzufügen"), samt den schon gewählten; Messwerte nur,
    wenn eine Anlage die Überwachung eingeschaltet hat oder `measures` sie verlangt (Einrichtungsassistent, 1.69.0: der Schritt
    "Überwachung" erscheint nur, wenn es passende Messwerte gibt). Auf Abruf, nicht mit jeder Abfrage der Übersicht (1.60.0).
    """
    chosen, monitoring = _chosen_sensors(hass)
    connection.send_result(msg["id"], {"sensors": await _with_integration(hass, await _sensor_info(hass, chosen, measures=monitoring or msg["measures"]))})


async def _last_changes(hass: HomeAssistant, settings, entities: list[str]) -> dict[str, str]:
    """Letzte echte Änderung (offen <-> zu) je Sensor: gemerkt, sonst einmal aus dem Verlauf geholt (nicht bei jedem Abruf)."""
    tried: set[str] = hass.data.setdefault(f"{DOMAIN}_changes_tried", set())
    # Nur Binärsensoren: ein Messwert (Temperatur ...) wechselt nie zwischen "offen" und "zu", sein Verlauf über 90 Tage ist aber der grösste
    # (bis 1.57.0 wurde er nach jedem Neustart von Home Assistant einmal ganz gelesen, und die Übersicht wartete darauf)
    missing = [e for e in entities if e.startswith("binary_sensor.") and e not in settings.last_changes and e not in tried]
    if missing:
        tried.update(missing)

        async def seed() -> None:
            settings.seed_changes(await last_change.async_history_changes(hass, missing))

        # Die Übersicht wartet höchstens LAST_CHANGE_WAIT auf den Verlauf: dauert er länger (grosse Datenbank), kommt die Antwort ohne ihn,
        # und die Zeitpunkte stehen beim nächsten Abruf da (das Lesen läuft im Hintergrund zu Ende)
        task = hass.async_create_background_task(seed(), f"{DOMAIN} last changes")
        task.add_done_callback(lambda t: t.cancelled() or t.exception())
        await asyncio.wait({task}, timeout=LAST_CHANGE_WAIT)
    return {e: settings.last_changes[e] for e in entities if e in settings.last_changes}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/data"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_data(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Alle Anlagen mit Zonen und Ereignissen, dazu die Sensoren. Live-Zustände liest das Panel aus hass.states."""
    settings = await async_get_settings(hass)
    systems = []
    chosen: set[str] = set()
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is not ConfigEntryState.LOADED:
            continue
        ctl = entry.runtime_data.controller
        zones = {mode: ctl.zone(mode) for mode in ctl.modes}
        chosen |= {e for members in zones.values() for e in members} | set(ctl.sensor_overrides) | set(entry.options.get(CONF_SENSORS) or []) | set(entry.options.get(CONF_MONITOR_SENSORS) or [])
        systems.append(
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "entity_id": _alarm_entity(hass, entry),
                "instance": ctl.instance,
                "modes": list(ctl.modes),
                "zones": zones,
                "entry_sensors": sorted(ctl.entry_sensors),
                "sensors": list(entry.options.get(CONF_SENSORS) or []),
                # Messwert-Sensoren der Überwachung (1.48.0): eigene Liste, der Alarm sieht sie nie
                "monitor_sensors": list(entry.options.get(CONF_MONITOR_SENSORS) or []),
                # Einstellungen je Modus (0.10.0), für alle Modi, auch die abgeschalteten (1.17.12): sie behalten ihre Werte, und das
                # Panel speichert sie mit. Fehlten sie hier, hielte das Panel den gespeicherten Stand für geändert ("1 Änderung").
                "mode_settings": {
                    **{mode: {"exit_delay": ctl.exit_delay(mode), "entry_delay": ctl.entry_delay_for(mode),
                              "confirm_window": ctl.confirm_window_for(mode)} for mode in MODES},
                },
                # Längste Eingangsverzögerung je Modus (Sensoren mit eigenem Wert eingerechnet): 0 = dort läuft nie eine, das Panel
                # zeigt den Punkt "Eingangsverzögerung läuft" dann nicht (1.18.0)
                "entry_delay_max": {mode: ctl.longest_entry_delay(mode) for mode in ctl.modes},
                "night_enabled": ctl.night_enabled,
                "always_enabled": ctl.always_enabled,
                "routines": entry.options.get(CONF_ROUTINES) or [],
                "monitor_enabled": ctl.monitor_enabled,
                "realarm_enabled": bool(entry.options.get(CONF_REALARM_ENABLED, False)),
                "realarm_count": realarm_count(entry.options),
                "accent": entry.options.get(CONF_ACCENT, "ha"),
                "monitors": entry.options.get(CONF_MONITORS) or [],
                # Regeln, die gerade ausserhalb ihrer Grenzen sind: id -> seit wann und welcher Sensor
                "monitor_active": {rid: {"since": a.get("since"), "entity_id": a.get("entity")} for rid, a in hass.data.get(DATA_MONITOR, {}).get(entry.entry_id, {}).items()},
                "sensor_options": ctl.sensor_overrides,
                "per_mode_sensors": bool(entry.options.get(CONF_PER_MODE_SENSORS)),
                # Schalter "Einstellungen pro Modus" der Anlage; ohne gespeicherten Wert null (das Panel schaltet ein, wenn sich die Modi unterscheiden)
                "per_mode_settings": entry.options.get(CONF_PER_MODE_SETTINGS),
                "sensor_modes": entry.options.get(CONF_SENSOR_MODES) or {},
                "workflows": entry.options.get(CONF_WORKFLOWS) or {},
                "workflow_end": entry.options.get(CONF_WORKFLOW_END) or {},
                "workflows_after": entry.options.get(CONF_WORKFLOWS_AFTER) or {},
                "workflows_armed": entry.options.get(CONF_WORKFLOWS_ARMED) or {},
                "workflows_arming": entry.options.get(CONF_WORKFLOWS_ARMING) or {},
                "workflows_entry": entry.options.get(CONF_WORKFLOWS_ENTRY) or {},
                "workflows_disarmed": entry.options.get(CONF_WORKFLOWS_DISARMED) or {},
                # Aktionen bei einem stillen Alarm und die festen Meldungen des Reiters Aktionen (1.62.0). Die Meldungen immer als wirksamer
                # Stand je Auslöser: was die Anlage gespeichert hat, sonst die bisherige gemeinsame Einstellung (notify.event_notice)
                "workflows_report": entry.options.get(CONF_WORKFLOWS_REPORT) or {},
                "event_notify": {
                    trigger: {kind: entry.runtime_data.notifier.notice(kind, trigger) for kind in (EVENT_NOTIFY_KINDS if trigger in MODES else EVENT_NOTIFY_ALWAYS)}
                    for trigger in WORKFLOW_TRIGGERS
                } if entry.runtime_data.notifier else {},
                # Läuft gerade ein Alarm oder ein Test (die Aktionen nach dem Quittieren zählen nicht dazu)
                "workflow_running": _alarm_run(entry).get("trigger"),
                "workflow_test": bool((entry.runtime_data.workflow.running or {}).get("test")) if entry.runtime_data.workflow else False,
                "has_code": ctl.has_code,
                # Der neueste Alarm, den noch niemand gesehen hat (roter Kreis im Kopf des Panels, 1.82.0): nur Kennung und ob er noch läuft
                "alarm_unseen": ({"id": unseen["id"], "running": unseen.get("end") is None} if (unseen := entry.runtime_data.recorder.unseen if entry.runtime_data.recorder else None) else None),
                # Codes nie zum Panel: nur Name und verknüpfter Benutzer
                "codes": [{"id": c.get("id", ""), "name": c.get("name", ""), "user_id": c.get("user_id")} for c in ctl.codes],
                "main_code": bool(entry.options.get(CONF_CODE_HASH)),
                "code_arm_required": ctl.code_arm_required,
                "code_ack_required": ctl.code_ack_required,
                "events": entry.runtime_data.events.events[:20],
                # Einrichtungsassistent (1.69.0): Zustand, Schritt und ob er jetzt erscheint
                "wizard": settings.wizard_payload(entry.entry_id),
            }
        )
    systems.sort(key=lambda s: s["title"].lower())
    # Nur die gewählten Sensoren (1.60.0); die Kandidaten für "Sensoren hinzufügen" liefert ws_sensor_candidates
    sensors = await _with_integration(hass, await _sensor_info(hass, chosen, candidates=False))
    notify_services = sorted(f"notify.{name}" for name in hass.services.async_services().get("notify", {}) if name not in ("notify", "send_message", "persistent_notification"))
    loaded = [e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED]
    connection.send_result(msg["id"], {
        # Version der installierten Integration (Easter Egg im Panel, 1.20.0); kein Geheimnis
        "version": loaded[0].runtime_data.version if loaded else None,
        "systems": systems,
        "sensors": sensors,
        "presets": settings.presets,
        "last_changes": await _last_changes(hass, settings, sorted(chosen)),
        "notify": settings.notify,
        # Anzeige der Namen (für alle Geräte und die Meldungen): "Gerät - Sensor" oder nur der Name des Sensors
        "display": {"names_with_device": settings.names_with_device},
        # Automatische Sicherung (1.47.0): an/aus und Abstand
        "auto_backup": settings.auto_backup,
        # Selbsttest (1.65.0): letzte und nächste Prüfung, Befunde (nur Kennungen und Namen, nie Geheimnisse; die Texte formuliert das Panel)
        "selftest": (await async_get_selftest(hass, settings)).payload() if loaded else None,
        # HealthCheck (1.65.0): Lebenszeichen an externe Dienste mit ihrer URL (Entscheid des Nutzers: ganz im Panel) und dem letzten Ergebnis
        "healthchecks": (await async_get_healthcheck(hass, settings)).listing() if loaded else [],
        "healthcheck_max": MAX_HEALTHCHECKS,
        "notify_services": notify_services,
        "users": sorted(
            ({"id": u.id, "name": u.name} for u in await hass.auth.async_get_users() if not u.system_generated and u.is_active and u.name),
            key=lambda u: u["name"].lower(),
        ),
        "sounds": [{"id": key, "seconds": seconds, "url": f"{SOUNDS_URL_PATH}/{key}.wav"} for key, seconds in SOUNDS.items()],
        # Eigene Töne für "Aktivierungston" und "Voralarm" (1.15.0)
        "chimes": [{"id": key, "seconds": seconds, "url": f"{SOUNDS_URL_PATH}/{key}.wav"} for key, seconds in CHIMES.items()],
        "dechimes": [{"id": key, "seconds": seconds, "url": f"{SOUNDS_URL_PATH}/{key}.wav"} for key, seconds in DECHIMES.items()],
        "prealarms": [{"id": key, "seconds": seconds, "url": f"{SOUNDS_URL_PATH}/{key}.wav"} for key, seconds in PREALARMS.items()],
        # Eigene Töne des Nutzers (1.39.0): für alle Anlagen und alle Arten von Tönen wählbar
        "custom_sounds": _custom_listing(hass),
        "custom_sound_limits": {"max": MAX_CUSTOM_SOUNDS, "seconds": MAX_CUSTOM_SECONDS, "bytes": MAX_UPLOAD_BYTES, "total": MAX_CUSTOM_TOTAL_BYTES, "ffmpeg": custom_sounds.converter_available(hass)},
    })


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_zones",
        vol.Required("entry_id"): str,
        vol.Required("zones"): {vol.In(MODES): [str]},
        vol.Required("entry_sensors"): [str],
        # Sensoren, die in der Liste der Konfiguration stehen sollen (Auswahl über "+")
        vol.Optional("sensors"): [str],
        vol.Optional("monitor_sensors"): [str],
        # Eigene Werte der Optionen pro Sensor; fehlt ein Sensor, gilt die Voreinstellung seiner Art
        vol.Optional("sensor_options"): {str: SENSOR_VALUES},
        # Einstellungen je Modus: Schalter und eigene Werte je Modus (nur Abweichungen von den Werten für alle Modi)
        vol.Optional("per_mode_sensors"): bool,
        vol.Optional("sensor_modes"): {vol.In([*MODES, "always"]): {str: SENSOR_VALUES}},
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_zones(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Zonen und Eingangssensoren speichern. Dieselben Schlüssel wie der Optionsdialog."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    ctl = entry.runtime_data.controller
    # Ein Modus, der in der Anfrage fehlt, behält seine Zone (1.63.0, wie die Abläufe in save_workflows); bis 1.62.0 wurde sie geleert.
    # Das Panel sendet immer alle Modi.
    zones = {mode: list(dict.fromkeys(msg["zones"][mode] if mode in msg["zones"] else entry.options.get(f"{CONF_ZONE_PREFIX}{mode}") or [])) for mode in MODES}
    every = {e for members in zones.values() for e in members} | set(msg["entry_sensors"])
    if any(not e.startswith("binary_sensor.") for e in every):
        connection.send_error(msg["id"], "invalid_entity", "Only binary sensors can be in a zone")
        return
    active = {e for mode in ctl.modes for e in zones[mode]}
    if set(msg["entry_sensors"]) - active:
        connection.send_error(msg["id"], "entry_not_in_zone", "Every entry sensor must be in an active zone")
        return
    options = dict(entry.options)
    for mode in MODES:
        options[f"{CONF_ZONE_PREFIX}{mode}"] = zones[mode]
    options[CONF_ENTRY_SENSORS] = sorted(set(msg["entry_sensors"]))
    if "sensors" in msg:
        if any(not e.startswith("binary_sensor.") for e in msg["sensors"]):
            connection.send_error(msg["id"], "invalid_entity", "Only binary sensors can be listed")
            return
        options[CONF_SENSORS] = sorted(set(msg["sensors"]))
    if "monitor_sensors" in msg:
        if any(e.split(".")[0] not in MONITOR_NUMERIC_DOMAINS for e in msg["monitor_sensors"]):
            connection.send_error(msg["id"], "invalid_entity", "Only measured values can be listed here")
            return
        options[CONF_MONITOR_SENSORS] = sorted(set(msg["monitor_sensors"]))
    if "sensor_options" in msg:
        if any(not e.startswith("binary_sensor.") for e in msg["sensor_options"]):
            connection.send_error(msg["id"], "invalid_entity", "Only binary sensors can have sensor options")
            return
        options[CONF_SENSOR_OPTIONS] = {e: dict(o) for e, o in msg["sensor_options"].items() if o}
    if "per_mode_sensors" in msg:
        options[CONF_PER_MODE_SENSORS] = msg["per_mode_sensors"]
    if "sensor_modes" in msg:
        if any(not e.startswith("binary_sensor.") for per in msg["sensor_modes"].values() for e in per):
            connection.send_error(msg["id"], "invalid_entity", "Only binary sensors can have sensor options")
            return
        options[CONF_SENSOR_MODES] = {m: {e: dict(o) for e, o in per.items() if o} for m, per in msg["sensor_modes"].items() if any(per.values())}
    # Neuladen übernimmt der Update-Listener; der Zustand der Anlage übersteht es (RestoreEntity)
    changed = hass.config_entries.async_update_entry(entry, options=options)
    # "reload": lädt die Anlage neu? Home Assistant lädt nur neu, wenn sich die Optionen wirklich geändert haben. Ohne diese Angabe
    # wartete das Panel mit der Ladeanzeige 25 Sekunden auf eine neue Kennung, die nie kam.
    connection.send_result(msg["id"], {"ok": True, "reload": bool(changed)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/arm",
        vol.Required("entry_id"): str,
        vol.Required("mode"): vol.In(list(ALARM_SERVICES)),
        vol.Optional("code"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_arm(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Über den normalen Dienst, damit Code-Prüfung, Standardcode und "geändert von" gleich laufen wie überall."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    entity_id = _alarm_entity(hass, entry)
    if entity_id is None:
        connection.send_error(msg["id"], "not_found", "Alarm entity not found")
        return
    data: dict[str, Any] = {"entity_id": entity_id}
    if msg.get("code"):
        data["code"] = msg["code"]
    try:
        await hass.services.async_call(
            "alarm_control_panel", ALARM_SERVICES[msg["mode"]], data, blocking=True, context=connection.context(msg)
        )
    except ServiceValidationError as err:
        # Schlüssel wie invalid_code, open_sensors, code_locked, code_arm_required, service_not_supported
        connection.send_error(msg["id"], err.translation_key or "invalid", str(err))
        return
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "failed", str(err))
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/preview_system", vol.Required("name"): vol.All(str, vol.Length(max=60))})
@websocket_api.require_admin
@callback
def ws_preview_system(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Vorschau für den Dialog "Anlage hinzufügen": der Name und die Entitäts-ID, die Home Assistant der neuen Anlage geben würde.
    Rechnet hier und nicht im Panel, damit Umlaute und belegte IDs ("_2") stimmen. Erzeugt nichts und meldet Fehler als Wert,
    damit das Panel beim Tippen nichts als Fehler anzeigen muss.
    """
    name, error = new_system_name(hass, msg["name"])
    alarm_id = None
    if error is None and (slug := slugify(name)):
        alarm_id = free_entity_id(er.async_get(hass), "alarm_control_panel", slug)
    connection.send_result(msg["id"], {"name": name, "error": error, "alarm_entity_id": alarm_id})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/create_system", vol.Required("name"): vol.All(str, vol.Length(max=60)), vol.Optional("accent"): vol.In(ACCENTS)})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_create_system(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Legt eine neue Anlage an, über dieselbe Einrichtung wie in Home Assistant (Standardwerte: kein Code, Nacht aus, noch keine
    Sensoren). Alles Weitere stellt man danach in der Konfiguration ein; der Code wird nie hier eingegeben.
    """
    name, error = new_system_name(hass, msg["name"])
    if error:
        connection.send_error(msg["id"], error, "Name is empty" if error == "name_required" else "Name already used")
        return
    entry = await async_create_system(hass, name)
    if entry is None:
        connection.send_error(msg["id"], "create_failed", "The alarm system could not be created")
        return
    if "accent" in msg and msg["accent"] != "ha":
        # Farbe im selben Schritt wählbar (1.75.0): als Option der neuen Anlage
        hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_ACCENT: msg["accent"]})
    connection.send_result(msg["id"], {"entry_id": entry.entry_id})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/wizard",
        vol.Required("entry_id"): str,
        vol.Required("action"): vol.In(WIZARD_ACTIONS),
        vol.Optional("step"): vol.In(WIZARD_STEPS),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_wizard(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Einrichtungsassistent (1.69.0): Zustand einer Anlage setzen. "start" und "step" merken, wo es weitergeht (auch über Tage, Wunsch des
    Nutzers 2026-11-19, 21:05), "later" bis morgen, "hide" nur noch von Hand, "done" abgeschlossen. Ändert nichts an der Anlage selbst:
    die Schritte speichern über die Befehle der Reiter.
    """
    if (entry := _entry(hass, connection, msg)) is None:
        return
    if msg["action"] == "step" and "step" not in msg:
        connection.send_error(msg["id"], "invalid_format", "step is required")
        return
    settings = await async_get_settings(hass)
    connection.send_result(msg["id"], {"wizard": await settings.async_set_wizard(entry.entry_id, msg["action"], msg.get("step"))})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_system",
        vol.Required("entry_id"): str,
        vol.Required("name"): vol.All(str, vol.Length(max=60)),
        vol.Optional("backup_name", default=""): vol.All(str, vol.Length(max=60)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete_system(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Löscht eine Anlage samt Gerät, Entitäten, Protokoll und Aufzeichnungen (nicht rückgängig zu machen).

    Zwei Sperren, beide hier und nicht nur im Panel: Die Anlage muss deaktiviert sein (eine scharfe, eine in der Verzögerung und
    eine im Alarm verschwindet nie still), und der Name muss genau so mitkommen, wie der Nutzer ihn eingetippt hat. Mit `backup_name`
    legt der Server vor dem Löschen eine Sicherung an: sie erzeugt die Anlage nicht neu, bringt aber ihre Einstellungen zurück, wenn
    man eine Anlage gleichen Namens anlegt und die Sicherung wiederherstellt.
    """
    if (entry := _entry(hass, connection, msg)) is None:
        return
    if entry.runtime_data.controller.state != AlarmControlPanelState.DISARMED:
        connection.send_error(msg["id"], "not_disarmed", "Disarm the alarm system first")
        return
    if " ".join(msg["name"].split()) != " ".join(entry.title.split()):
        connection.send_error(msg["id"], "name_mismatch", "The name does not match")
        return
    if msg["backup_name"].strip():
        await backup.async_create_backup(hass, entry.runtime_data.version, " ".join(msg["backup_name"].split()))
        # Die Sicherung wartet auf die Ablage: wurde die Anlage inzwischen scharf geschaltet oder löste aus, bleibt sie bestehen
        if entry.runtime_data.controller.state != AlarmControlPanelState.DISARMED:
            connection.send_error(msg["id"], "not_disarmed", "Disarm the alarm system first")
            return
    # Das Entfernen wartet das Entladen der Anlage selbst ab. Kein hass.async_block_till_done() (bis 1.57.0): es wartet auf jede laufende
    # Aufgabe von Home Assistant (eine Automation mit langer Wartezeit), die Antwort käme dann nie und das Fenster im Panel bliebe stehen.
    await hass.config_entries.async_remove(entry.entry_id)
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rename",
        vol.Required("entry_id"): str,
        vol.Required("name"): vol.All(str, vol.Length(max=60)),
        vol.Optional("regenerate_ids", default=False): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rename(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Benennt die Anlage um: Eintrag, Gerät und damit der Name der Entitäten. Auf Wunsch
    folgen auch die Entitäts-IDs (nur die, die noch dem alten Namen folgen).
    """
    if (entry := _entry(hass, connection, msg)) is None:
        return
    name = " ".join(msg["name"].split())
    if not name:
        connection.send_error(msg["id"], "name_required", "Name is empty")
        return
    if any(e.entry_id != entry.entry_id and e.title.casefold() == name.casefold() for e in hass.config_entries.async_entries(DOMAIN)):
        connection.send_error(msg["id"], "name_taken", "Name already used")
        return
    registry = er.async_get(hass)
    # Die IDs folgen dem Namen von damals, nicht unbedingt dem jetzigen Titel: beide Vorsilben gelten
    prefixes = {slugify(entry.title)}
    if alarm_id := _alarm_entity(hass, entry):
        prefixes.add(alarm_id.partition(".")[2])
    renamed = 0
    if msg["regenerate_ids"] and (new_slug := slugify(name)):
        for ent in er.async_entries_for_config_entry(registry, entry.entry_id):
            domain, _, obj = ent.entity_id.partition(".")
            # Längste passende Vorsilbe zuerst; selbst benannte IDs bleiben unberührt
            old = next((p for p in sorted(prefixes, key=len, reverse=True) if obj == p or obj.startswith(p + "_")), None)
            if old is None:
                continue
            new_id = free_entity_id(registry, domain, new_slug + obj[len(old):], current_entity_id=ent.entity_id)
            if new_id != ent.entity_id:
                registry.async_update_entity(ent.entity_id, new_entity_id=new_id)
                renamed += 1
    # Gerät sofort umbenennen (ein eigener Name am Gerät würde sonst den neuen Namen verdecken)
    if device := system_device(hass, entry.entry_id):
        dr.async_get(hass).async_update_device(device.id, name=name, name_by_user=None)
    # Löst das Neuladen aus; der Zustand übersteht es über die Wiederherstellung der Entität
    hass.config_entries.async_update_entry(entry, title=name, data={**entry.data, CONF_NAME: name})
    connection.send_result(msg["id"], {"ok": True, "renamed_ids": renamed})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_presets",
        vol.Required("presets"): {vol.In(SENSOR_TYPES): [vol.In(SENSOR_OPTIONS)]},
        # Sensorarten, deren Sensoren die Voreinstellung übernehmen: eigene Werte je Sensor werden gelöscht
        vol.Optional("reset_sensors"): [vol.In(SENSOR_TYPES)],
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_presets(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Voreinstellungen je Sensorart, für alle Anlagen. Die Anlagen laden danach neu."""
    settings = await async_get_settings(hass)
    # Erst die Voreinstellungen (ohne Benachrichtigung), dann die Optionen: jede Anlage lädt genau einmal neu und sieht beides
    presets_changed = await settings.async_store_presets(msg["presets"])
    reset = 0
    reloading: set[str] = set()
    kinds = set(msg.get("reset_sensors") or [])
    if kinds:
        for entry in hass.config_entries.async_entries(DOMAIN):
            own = dict(entry.options.get(CONF_SENSOR_OPTIONS) or {})
            per_mode = {m: dict(v) for m, v in (entry.options.get(CONF_SENSOR_MODES) or {}).items() if isinstance(v, dict)}
            drop = [e for e in {*own, *(e for v in per_mode.values() for e in v)} if sensor_type(hass, e) in kinds]
            if drop:
                reset += len(drop)
                # Auch die eigenen Werte je Modus fallen weg: der Sensor folgt danach wieder der Voreinstellung
                # Eigene Eingangsverzögerung und "Immer aktiv ignorieren" gehören nicht zu den Voreinstellungen und bleiben stehen
                def keep(o: dict[str, Any]) -> dict[str, Any]:
                    return {k: v for k, v in o.items() if k in (OPT_ENTRY_DELAY, OPT_ALWAYS_OFF)} if isinstance(o, dict) else {}

                new_modes = {m: {e: (keep(o) if e in drop else o) for e, o in v.items() if e not in drop or keep(o)} for m, v in per_mode.items()}
                kept_own = {e: (keep(o) if e in drop else o) for e, o in own.items() if e not in drop or keep(o)}
                # Die Optionsänderung lädt die Anlage neu (Update-Listener); nur dann gilt sie als "lädt schon"
                if hass.config_entries.async_update_entry(entry, options={
                    **entry.options,
                    CONF_SENSOR_OPTIONS: kept_own,
                    CONF_SENSOR_MODES: {m: v for m, v in new_modes.items() if v},
                }):
                    reloading.add(entry.entry_id)
    if presets_changed:
        settings.async_notify_listeners(skip=reloading)
    connection.send_result(msg["id"], {"presets": settings.presets, "reset": reset})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_system",
        vol.Required("entry_id"): str,
        # Je Modus: fehlende Werte bleiben, wie sie sind. "trigger_time" (alte Alarmdauer) wird angenommen und ignoriert
        vol.Optional("mode_settings"): {vol.In([*MODES, "always"]): {
            vol.Optional("exit_delay"): _SECONDS,
            vol.Optional("entry_delay"): _SECONDS,
            vol.Optional("trigger_time"): _SECONDS,
            vol.Optional("open_sensors"): vol.In(OPEN_SENSOR_MODES),  # alt (bis 0.31.0), wird ignoriert
            vol.Optional("confirm_window"): vol.All(vol.Coerce(int), vol.Range(min=5, max=MAX_CONFIRM_WINDOW)),
        }},
        # Kurzform: gilt für alle Modi (und als gemeinsamer Wert für Modi, die es noch nicht gibt)
        vol.Optional("exit_delay"): {vol.In(MODES): _SECONDS},
        vol.Optional("entry_delay"): _SECONDS,
        vol.Optional("trigger_time"): _SECONDS,
        vol.Optional("per_mode_settings"): bool,
        vol.Optional("night_enabled"): bool,
        vol.Optional("always_enabled"): bool,
        vol.Optional("monitor_enabled"): bool,
        # Nachalarm (1.87.0, Entscheid des Nutzers 2026-11-24)
        vol.Optional("realarm_enabled"): bool,
        vol.Optional("realarm_count"): vol.All(vol.Coerce(int), vol.Range(min=REALARM_COUNT_RANGE[0], max=REALARM_COUNT_RANGE[1])),
        vol.Optional("accent"): vol.In(ACCENTS),
        vol.Optional("home_enabled"): bool,
        vol.Optional("away_enabled"): bool,
        vol.Optional("routines"): ROUTINES,
        vol.Optional("open_sensors"): vol.In(OPEN_SENSOR_MODES),
        vol.Optional("confirm_window"): vol.All(vol.Coerce(int), vol.Range(min=5, max=MAX_CONFIRM_WINDOW)),
        vol.Optional("code_ack_required"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_system(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Verzögerungen und Verhalten einer Anlage (dieselben Schlüssel wie der Optionsdialog). Code bleibt im Optionsdialog."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    options = dict(entry.options)
    for mode, seconds in msg.get("exit_delay", {}).items():
        options[f"{CONF_EXIT_DELAY_PREFIX}{mode}"] = seconds
    if "routines" in msg:
        try:
            options[CONF_ROUTINES] = check_routines(hass, msg["routines"], entry.options.get(CONF_ROUTINES))
        except vol.Invalid as err:
            connection.send_error(msg["id"], "invalid_routines", str(err))
            return
    for key, conf in (("entry_delay", CONF_ENTRY_DELAY), ("confirm_window", CONF_CONFIRM_WINDOW)):
        if key in msg:
            # Kurzform: für alle Modi (der gemeinsame Wert bleibt der Rückfall)
            options[conf] = msg[key]
            for scope in MODES:
                options[f"{conf}_{scope}"] = msg[key]
    if "per_mode_settings" in msg:
        options[CONF_PER_MODE_SETTINGS] = msg["per_mode_settings"]
    if "always_enabled" in msg:
        options[CONF_ALWAYS_ENABLED] = msg["always_enabled"]
    if "monitor_enabled" in msg:
        options[CONF_MONITOR_ENABLED] = msg["monitor_enabled"]
    if "realarm_enabled" in msg:
        options[CONF_REALARM_ENABLED] = msg["realarm_enabled"]
    if "realarm_count" in msg:
        options[CONF_REALARM_COUNT] = msg["realarm_count"]
    if "accent" in msg:
        options[CONF_ACCENT] = msg["accent"]
    if "code_ack_required" in msg:
        # Ohne Code gibt es nichts zu verlangen
        if msg["code_ack_required"] and not entry.runtime_data.controller.has_code:
            connection.send_error(msg["id"], "code_missing", "Add a code first")
            return
        options[CONF_CODE_ACK_REQUIRED] = msg["code_ack_required"]
    if "night_enabled" in msg:
        options[CONF_NIGHT_ENABLED] = msg["night_enabled"]
    for scope, values in msg.get("mode_settings", {}).items():
        for field, value in values.items():
            if field == "exit_delay":
                if scope in MODES:
                    options[f"{CONF_EXIT_DELAY_PREFIX}{scope}"] = value
            elif scope in MODES and field not in ("trigger_time", "open_sensors"):
                options[f"{field}_{scope}"] = value
    # Modi: mindestens einer, und nie den Modus abschalten, in dem die Anlage gerade scharf ist oder wird
    # (nach dem Neuladen fände der Zustand keinen Modus mehr und die Anlage wäre still deaktiviert)
    for mode, key in MODE_ENABLED_KEY.items():
        if f"{mode}_enabled" in msg:
            options[key] = msg[f"{mode}_enabled"]
    ctl = entry.runtime_data.controller
    enabled = [m for m, key in MODE_ENABLED_KEY.items() if options.get(key, MODE_ENABLED_DEFAULT[m])]
    if not enabled:
        connection.send_error(msg["id"], "no_mode", "At least one mode is needed")
        return
    if ctl.mode and ctl.mode not in enabled and ctl.state != AlarmControlPanelState.DISARMED:
        connection.send_error(msg["id"], "mode_active", "Disarm before switching off the active mode")
        return
    changed = hass.config_entries.async_update_entry(entry, options=options)
    # "reload": lädt die Anlage neu? Home Assistant lädt nur neu, wenn sich die Optionen wirklich geändert haben. Ohne diese Angabe
    # wartete das Panel mit der Ladeanzeige 25 Sekunden auf eine neue Kennung, die nie kam.
    connection.send_result(msg["id"], {"ok": True, "reload": bool(changed)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_notify",
        vol.Required("notify"): {
            vol.Optional("alarm_targets"): [str],
            vol.Optional("maintenance_targets"): [str],
            # Je Meldungsart: an/aus, kritisch, Lautstärke (iOS); fehlende Werte bleiben, wie sie sind
            vol.Optional("types"): {vol.In(list(NOTIFY_TYPES)): {
                vol.Optional("enabled"): bool,
                vol.Optional("critical"): bool,
                vol.Optional("persistent"): bool,
                vol.Optional("volume"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
                vol.Optional("targets"): NOTIFY_TARGETS,
            }},
            # Eigene Werte je Modus für Arten, die nur im scharfen Zustand vorkommen; ersetzt alle bisherigen eigenen Werte
            vol.Optional("per_mode"): bool,
            vol.Optional("modes"): {vol.In(MODES): {vol.In(NOTIFY_MODE_KINDS): {
                vol.Optional("enabled"): bool,
                vol.Optional("critical"): bool,
                vol.Optional("persistent"): bool,
                vol.Optional("volume"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
                vol.Optional("targets"): NOTIFY_TARGETS,
            }}},
            vol.Optional("disarm_action"): bool,
            vol.Optional("open_action"): bool,
            vol.Optional("silence_action"): bool,
            vol.Optional("acknowledge_action"): bool,
            vol.Optional("arm_retry_action"): bool,
            vol.Optional("arm_force_action"): bool,
            vol.Optional("battery_threshold"): vol.All(vol.Coerce(int), vol.Range(min=BATTERY_THRESHOLD_RANGE[0], max=BATTERY_THRESHOLD_RANGE[1])),
            vol.Optional("battery_checks"): vol.All(vol.Coerce(int), vol.Range(min=BATTERY_CHECKS_RANGE[0], max=BATTERY_CHECKS_RANGE[1])),
            vol.Optional("offline_minutes"): vol.All(vol.Coerce(int), vol.Range(min=OFFLINE_MINUTES_RANGE[0], max=OFFLINE_MINUTES_RANGE[1])),
            vol.Optional("selftest_minutes"): vol.All(vol.Coerce(int), vol.Range(min=SELFTEST_MINUTES_RANGE[0], max=SELFTEST_MINUTES_RANGE[1])),
            vol.Optional("selftest_minutes_armed"): vol.All(vol.Coerce(int), vol.Range(min=SELFTEST_MINUTES_RANGE[0], max=SELFTEST_MINUTES_RANGE[1])),
            # Bis 1.66.x in Stunden: ein Panel, das noch offen ist, sendet sie so (als Minuten übernommen)
            vol.Optional("selftest_hours"): vol.All(vol.Coerce(int), vol.Range(min=1, max=24)),
            vol.Optional("selftest_hours_armed"): vol.All(vol.Coerce(int), vol.Range(min=1, max=24)),
            # HealthCheck-Dienste (seit 1.69.0 die Wartungsmeldung "healthcheck" unter "types"): Zahl gescheiterter Aufrufe und "antwortet wieder"
            vol.Optional("healthcheck_fails"): vol.All(vol.Coerce(int), vol.Range(min=HEALTHCHECK_NOTIFY_FAILS_RANGE[0], max=HEALTHCHECK_NOTIFY_FAILS_RANGE[1])),
            vol.Optional("healthcheck_up"): bool,
        },
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_notify(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Benachrichtigungen, für alle Anlagen gleich."""
    settings = await async_get_settings(hass)
    incoming = dict(msg["notify"])
    for old, new in SELFTEST_HOURS_KEYS:
        if (hours := incoming.pop(old, None)) is not None and new not in incoming:
            incoming[new] = hours * 60
    merged = {**settings.notify, **incoming}
    # Arten einzeln zusammenführen: eine Meldung mit nur einer Art lässt die anderen unberührt
    merged["types"] = {kind: {**current, **incoming.get("types", {}).get(kind, {})} for kind, current in settings.notify["types"].items()}
    await settings.async_set_notify(merged)
    # Selbsttest (1.65.0): Empfänger geändert, kurz danach neu prüfen
    if loaded_selftest(hass) is not None:
        loaded_selftest(hass).async_schedule()
    connection.send_result(msg["id"], {"notify": settings.notify})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/test_notify", vol.Optional("kind"): vol.In(list(NOTIFY_TYPES)), vol.Optional("group"): vol.In(["alarm", "maintenance"]),
     vol.Optional("mode"): vol.In(MODES)}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_test_notify(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Testmeldung einer Art an ihre Empfänger, mit ihrem Kritisch und ihrer Lautstärke; oder (seit 1.71.0, `group`) an die Standard-Empfänger der
    Alarme oder der Wartung. Genau eins von beiden.
    """
    if ("kind" in msg) == ("group" in msg):
        connection.send_error(msg["id"], "invalid_format", "kind or group")
        return
    entries = [e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED]
    if not entries:
        connection.send_error(msg["id"], "not_found", "No alarm system")
        return
    notifier = entries[0].runtime_data.notifier
    targets = notifier.send_group_test(msg["group"]) if "group" in msg else notifier.send_test(msg["kind"], msg.get("mode"))
    connection.send_result(msg["id"], {"targets": targets})


def _clean_end(value: dict[str, Any]) -> dict[str, Any]:
    """
    Nur speichern, was vom Standard abweicht: die eigene Meldung beim Alarmende und (seit 1.63.0) "ausgeschaltet". Die eigenen Werte
    bleiben auch ausgeschaltet stehen: wer wieder einschaltet, findet seinen Text.
    """
    out: dict[str, Any] = {}
    if (value.get("notify") or {}).get("enabled"):
        out["notify"] = value["notify"]
    if value.get("send") is False:
        out["send"] = False
    return out


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/test_end_notify",
        vol.Required("entry_id"): str,
        vol.Required("notify"): vol.All(dict, END_NOTIFY_SCHEMA),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_test_end_notify(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Testmeldung "Alarm beendet" mit den (auch ungespeicherten) Einstellungen aus dem Element "Alarm endet"."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    entry.runtime_data.notifier.send_alarm_end(None, test=True, own={**msg["notify"], "enabled": True})
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/test_event_notify",
        vol.Required("entry_id"): str,
        vol.Required("kind"): vol.In(EVENT_NOTIFY_KINDS),
        vol.Required("trigger"): vol.In(WORKFLOW_TRIGGERS),
        vol.Required("notice"): vol.All(dict, EVENT_NOTICE_SCHEMA),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_test_event_notify(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Testmeldung einer festen Meldung des Reiters Aktionen mit den (auch ungespeicherten) Werten aus dem Fenster; an ihre Empfänger."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    if msg["trigger"] not in MODES and msg["kind"] not in EVENT_NOTIFY_ALWAYS:
        connection.send_error(msg["id"], "invalid_format", "This message does not exist for this trigger")
        return
    targets = entry.runtime_data.notifier.send_event_test(msg["kind"], msg["trigger"], msg["notice"])
    if not targets:
        connection.send_error(msg["id"], "no_targets", "No recipients configured")
        return
    connection.send_result(msg["id"], {"ok": True, "targets": targets})


def loaded_selftest(hass: HomeAssistant) -> Any:
    """Der laufende Selbsttest (1.65.0), solange eine Anlage geladen ist; sonst None."""
    selftest = hass.data.get(DATA_SELFTEST)
    return selftest if selftest is not None and selftest.started else None


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/selftest_run"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_selftest_run(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Knopf "Jetzt prüfen": alle Anlagen sofort prüfen (nur lesen, schaltet nichts) und die Befunde zurückgeben."""
    if (selftest := loaded_selftest(hass)) is None:
        connection.send_error(msg["id"], "not_found", "No alarm system")
        return
    connection.send_result(msg["id"], {"selftest": selftest.async_run()})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/selftest_checked"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_selftest_checked(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Liste "Geprüft" der letzten Prüfung (Wunsch des Nutzers 2026-11-19): jede geprüfte Entität, Aktion und jeder Empfänger mit Namen und Ergebnis.
    Auf Abruf, nicht in `data` (das läuft alle 30 Sekunden; eine lange Liste gehört nicht hinein).
    """
    if (selftest := loaded_selftest(hass)) is None:
        connection.send_error(msg["id"], "not_found", "No alarm system")
        return
    connection.send_result(msg["id"], selftest.checked_payload())


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/selftest_dismiss", vol.Required("key"): vol.All(str, vol.Length(min=1, max=400))})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_selftest_dismiss(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    "Erledigt" im Fenster des Selbsttests: nur Befunde der Laufzeit (ein Aufruf scheiterte). Ein Befund der Konfiguration verschwindet erst,
    wenn er behoben ist; ihn als erledigt zu markieren, lehnt der Server ab.
    """
    if (selftest := loaded_selftest(hass)) is None:
        connection.send_error(msg["id"], "not_found", "No alarm system")
        return
    if not selftest.dismiss(msg["key"]):
        connection.send_error(msg["id"], "not_found", "No such runtime problem")
        return
    connection.send_result(msg["id"], {"selftest": selftest.payload()})


def loaded_healthcheck(hass: HomeAssistant) -> Any:
    """Die laufenden Lebenszeichen (1.65.0), solange eine Anlage geladen ist; sonst None."""
    healthcheck = hass.data.get(DATA_HEALTHCHECK)
    return healthcheck if healthcheck is not None and healthcheck.started else None


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/healthcheck_save",
        vol.Optional("check_id"): vol.All(str, vol.Length(min=1, max=16)),
        vol.Required("name"): vol.All(str, vol.Length(max=HEALTHCHECK_NAME_MAX * 2)),
        vol.Required("url"): vol.All(str, vol.Length(max=HEALTHCHECK_URL_MAX)),
        vol.Optional("fail_suffix", default=""): vol.All(str, vol.Length(max=HEALTHCHECK_SUFFIX_MAX)),
        vol.Optional("page_url", default=""): vol.All(str, vol.Length(max=HEALTHCHECK_URL_MAX)),
        vol.Required("interval"): vol.All(int, vol.Range(min=HEALTHCHECK_INTERVAL_RANGE[0], max=HEALTHCHECK_INTERVAL_RANGE[1])),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_save(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    HealthCheck anlegen (ohne `check_id`) oder ändern: Name (Pflichtfeld seit 1.66.0, Wunsch des Nutzers 2026-11-19), URL (http oder https), Fehler-Zusatz (leer, "/…", "?…" oder "&…"; generisch, kein Anbieter),
    Abstand in Sekunden (1 Minute bis 24 Stunden; kein eigener bei scharfer Anlage, Entscheid des Nutzers 2026-11-19). Höchstens MAX_HEALTHCHECKS. Danach geht von diesem Eintrag sofort ein Lebenszeichen hinaus.
    Keine Sperre nötig (anders als bei den Codes): zwischen dem Lesen der Liste und `async_set_healthchecks`, das die Liste vor dem ersten `await`
    ersetzt, wartet nichts; zwei Aufrufe zugleich sehen also immer den Stand des anderen.
    """
    if (healthcheck := loaded_healthcheck(hass)) is None:
        connection.send_error(msg["id"], "not_found", "No alarm system")
        return
    name = valid_healthcheck_name(msg["name"])
    if name is None:
        connection.send_error(msg["id"], "invalid_name", "A name is required")
        return
    url = valid_healthcheck_url(msg["url"])
    if url is None:
        connection.send_error(msg["id"], "invalid_url", "The address must start with http:// or https://")
        return
    suffix = valid_fail_suffix(url, msg["fail_suffix"])
    if suffix is None:
        connection.send_error(msg["id"], "invalid_suffix", "The failure suffix must start with /, ? or &")
        return
    # Link zur Seite des Dienstes (1.76.0, freiwillig): leer erlaubt, sonst http oder https (er wird im Panel zum Link, nie "javascript:")
    page_url = ""
    if msg["page_url"].strip():
        page_url = valid_healthcheck_url(msg["page_url"]) or ""
        if not page_url:
            connection.send_error(msg["id"], "invalid_page_url", "The link must start with http:// or https://")
            return
    settings = await async_get_settings(hass)
    items = [dict(i) for i in settings.healthchecks]
    entry = {"name": name, "url": url, "fail_suffix": suffix, "interval": msg["interval"]}
    if page_url:
        entry["page_url"] = page_url
    if "check_id" in msg:
        index = next((n for n, i in enumerate(items) if i["id"] == msg["check_id"]), None)
        if index is None:
            connection.send_error(msg["id"], "not_found", "No such health check")
            return
        items[index] = {"id": msg["check_id"], **entry}
        hid = msg["check_id"]
    else:
        if len(items) >= MAX_HEALTHCHECKS:
            connection.send_error(msg["id"], "too_many", f"At most {MAX_HEALTHCHECKS} health checks")
            return
        hid = secrets.token_hex(6)
        items.append({"id": hid, **entry})
    await settings.async_set_healthchecks(items)
    healthcheck.async_reconfigure()
    connection.send_result(msg["id"], {"id": hid, "healthchecks": healthcheck.listing()})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/healthcheck_delete", vol.Required("check_id"): vol.All(str, vol.Length(min=1, max=16))})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    if (healthcheck := loaded_healthcheck(hass)) is None:
        connection.send_error(msg["id"], "not_found", "No alarm system")
        return
    settings = await async_get_settings(hass)
    items = [i for i in settings.healthchecks if i["id"] != msg["check_id"]]
    if len(items) == len(settings.healthchecks):
        connection.send_error(msg["id"], "not_found", "No such health check")
        return
    await settings.async_set_healthchecks(items)
    healthcheck.async_reconfigure()
    connection.send_result(msg["id"], {"healthchecks": healthcheck.listing()})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/healthcheck_ping", vol.Required("check_id"): vol.All(str, vol.Length(min=1, max=16)), vol.Required("kind"): vol.In(("ok", "fail"))}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_ping(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Testknöpfe "Lebenszeichen senden" und "Fehler senden": genau das sofort an den Dienst, wartet auf die Antwort (höchstens HEALTHCHECK_TIMEOUT).
    "Fehler" ohne Fehler-Zusatz gibt es nicht. Den Alarm testet man seit 1.77.0 an der Aktion "HealthCheck melden" (Play-Knopf des Schritts).
    """
    if (healthcheck := loaded_healthcheck(hass)) is None or (task := healthcheck.async_ping(msg["check_id"], test=msg["kind"])) is None:
        connection.send_error(msg["id"], "not_found", "No such health check")
        return
    status = await task
    connection.send_result(msg["id"], {"status": status, "healthchecks": healthcheck.listing()})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/healthcheck_history", vol.Required("check_id"): vol.All(str, vol.Length(min=1, max=16)), vol.Required("hours"): vol.In(HEALTHLOG_RANGES)}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_history(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Protokoll eines Dienstes im gewählten Zeitraum (1.68.0, Wunsch des Nutzers 2026-11-19): auf Abruf, nie in `data` (das alle 30 Sekunden
    läuft). Nur Administratoren, nur ein bestehender Dienst; die Antwort enthält nie die URL (die steht nur in der Liste der Dienste).
    """
    if (healthcheck := loaded_healthcheck(hass)) is None or (item := healthcheck.item(msg["check_id"])) is None:
        connection.send_error(msg["id"], "not_found", "No such health check")
        return
    connection.send_result(msg["id"], healthcheck.log.history(item["id"], msg["hours"], int(item["interval"])))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/save_auto_backup", vol.Required("enabled"): bool, vol.Required("every"): vol.In(list(AUTO_BACKUP_DAYS)), vol.Optional("keep"): vol.All(int, vol.Range(min=1, max=AUTO_BACKUP_KEEP_MAX))})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_auto_backup(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Automatische Sicherung: Schalter und Abstand (täglich, wöchentlich, monatlich); gilt für alle Anlagen."""
    settings = await async_get_settings(hass)
    await settings.async_set_auto_backup(msg["enabled"], msg["every"], msg.get("keep"))
    connection.send_result(msg["id"], {"auto_backup": settings.auto_backup})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/save_display", vol.Required("names_with_device"): bool})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_display(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Namen der Sensoren: "Gerät - Sensor" (an) oder nur der Name des Sensors (aus). Gilt für Panel, Protokoll und Meldungen."""
    settings = await async_get_settings(hass)
    await settings.async_set_names_with_device(msg["names_with_device"])
    connection.send_result(msg["id"], {"display": {"names_with_device": settings.names_with_device}})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_workflows",
        vol.Required("entry_id"): str,
        vol.Required("workflows"): {vol.In(WORKFLOW_TRIGGERS): step_list(valid_step)},
        # Element "Alarm endet": was Deaktivieren mit den Geräten macht, je Auslöser (fehlt: Standard)
        vol.Optional("workflow_end"): {vol.In(WORKFLOW_TRIGGERS): valid_end},
        vol.Optional("workflows_after"): {vol.In(WORKFLOW_TRIGGERS): step_list(valid_after_step)},
        vol.Optional("workflows_armed"): {vol.In(MODES): step_list(valid_armed_step)},
        # Aktionen während der Ausgangs- und der Eingangsverzögerung (1.18.0), je Modus
        vol.Optional("workflows_arming"): {vol.In(MODES): step_list(valid_arming_step)},
        vol.Optional("workflows_entry"): {vol.In(MODES): step_list(valid_entry_step)},
        # Aktionen beim Deaktivieren (1.27.0), je Modus, der gerade scharf war
        vol.Optional("workflows_disarmed"): {vol.In(MODES): step_list(valid_disarmed_step)},
        # Aktionen bei einem stillen Alarm und die festen Meldungen (1.62.0), je Auslöser
        vol.Optional("workflows_report"): {vol.In(WORKFLOW_TRIGGERS): step_list(valid_report_step)},
        vol.Optional("event_notify"): valid_event_notify,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_workflows(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Abläufe einer Anlage. Laden neu (wie alle Optionen); ein laufender Alarm geht weiter."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    options = dict(entry.options)
    # Auslöser, die in der Meldung fehlen (abgeschalteter Modus, abgeschaltetes "Immer aktiv"), behalten ihren gespeicherten Ablauf;
    # ein leerer Ablauf in der Meldung löscht ihn
    kept = {k: v for k, v in (options.get(CONF_WORKFLOWS) or {}).items() if k not in msg["workflows"]}
    options[CONF_WORKFLOWS] = {**kept, **{k: v for k, v in msg["workflows"].items() if v}}
    if "workflow_end" in msg:
        kept_end = {k: v for k, v in (options.get(CONF_WORKFLOW_END) or {}).items() if k not in msg["workflow_end"]}
        options[CONF_WORKFLOW_END] = {**kept_end, **{k: end for k, v in msg["workflow_end"].items() if (end := _clean_end(v))}}
    if "workflows_armed" in msg:
        kept_armed = {k: v for k, v in (options.get(CONF_WORKFLOWS_ARMED) or {}).items() if k not in msg["workflows_armed"]}
        options[CONF_WORKFLOWS_ARMED] = {**kept_armed, **{k: v for k, v in msg["workflows_armed"].items() if v}}
    if "event_notify" in msg:
        # Je Auslöser und Art ersetzen; was in der Meldung fehlt, bleibt, wie es ist (auch "noch nie gespeichert": dann gilt weiter die
        # bisherige gemeinsame Einstellung)
        notices = {trigger: dict(kinds) for trigger, kinds in (options.get(CONF_EVENT_NOTIFY) or {}).items() if isinstance(kinds, dict)}
        for trigger, kinds in msg["event_notify"].items():
            notices[trigger] = {**notices.get(trigger, {}), **kinds}
        options[CONF_EVENT_NOTIFY] = notices
    for key, conf in (("workflows_arming", CONF_WORKFLOWS_ARMING), ("workflows_entry", CONF_WORKFLOWS_ENTRY), ("workflows_disarmed", CONF_WORKFLOWS_DISARMED), ("workflows_report", CONF_WORKFLOWS_REPORT)):
        if key in msg:
            kept_delay = {k: v for k, v in (options.get(conf) or {}).items() if k not in msg[key]}
            options[conf] = {**kept_delay, **{k: v for k, v in msg[key].items() if v}}
    if "workflows_after" in msg:
        kept_after = {k: v for k, v in (options.get(CONF_WORKFLOWS_AFTER) or {}).items() if k not in msg["workflows_after"]}
        options[CONF_WORKFLOWS_AFTER] = {**kept_after, **{k: v for k, v in msg["workflows_after"].items() if v}}
    changed = hass.config_entries.async_update_entry(entry, options=options)
    # "reload": lädt die Anlage neu? Home Assistant lädt nur neu, wenn sich die Optionen wirklich geändert haben. Ohne diese Angabe
    # wartete das Panel mit der Ladeanzeige 25 Sekunden auf eine neue Kennung, die nie kam.
    connection.send_result(msg["id"], {"ok": True, "reload": bool(changed)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/test_workflow",
        vol.Required("entry_id"): str,
        vol.Required("trigger"): vol.In(WORKFLOW_TRIGGERS),
        # Nur diesen einen Schritt testen (auch ungespeichert); ohne: den gespeicherten Ablauf
        vol.Optional("step"): vol.All(dict, valid_step),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_test_workflow(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Gespeicherten Ablauf testen, ohne Alarm. Endet von selbst nach TEST_SECONDS oder mit stop_workflow."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    runner = entry.runtime_data.workflow
    if runner.running and runner.running.get("test"):
        # Ein neuer Test beendet den laufenden (die Geräte kehren zurück): es läuft immer nur einer, und ein Test, der längst fertig ist
        # und nur noch auf sein Zeitfenster wartet, sperrt keinen weiteren
        await runner.async_stop()
    if runner.running:
        connection.send_error(msg["id"], "busy", "Alarm actions are already running")
        return
    if not await runner.async_run(msg["trigger"], test=True, steps=[msg["step"]] if "step" in msg else None):
        connection.send_error(msg["id"], "empty", "No steps for this alarm")
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/acknowledge", vol.Required("entry_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_acknowledge(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Alarm quittieren (Knopf im Panel): nur bei laufendem Alarm; die Anlage bleibt scharf."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    if not entry.runtime_data.controller.acknowledge(connection.user.name if connection.user else None):
        connection.send_error(msg["id"], "not_triggered", "There is no running alarm")
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/delete_recording", vol.Required("entry_id"): str, vol.Required("recording"): vol.All(str, vol.Length(min=1, max=64))}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete_recording(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Einen aufgezeichneten Alarm aus dem Protokoll löschen (nach Rückfrage im Panel). Ein laufender Alarm lässt sich nicht löschen."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    recorder = entry.runtime_data.recorder
    result = recorder.async_delete(msg["recording"]) if recorder else "not_found"
    if result == "running":
        connection.send_error(msg["id"], "alarm_running", "A running alarm cannot be deleted")
    elif result != "ok":
        connection.send_error(msg["id"], "not_found", "No such alarm")
    else:
        connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/alarm_seen", vol.Required("entry_id"): str, vol.Required("recording"): vol.All(str, vol.Length(min=1, max=64)), vol.Optional("seen", default=True): bool}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_alarm_seen(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Einen Alarm als gesehen oder ungelesen markieren (roter Kreis im Kopf des Panels, 1.82.0): gilt für die ganze Anlage, nicht für ein Gerät."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    recorder = entry.runtime_data.recorder
    if (recorder.async_mark_seen(msg["recording"], msg["seen"]) if recorder else "not_found") != "ok":
        connection.send_error(msg["id"], "not_found", "No such alarm")
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/stop_workflow", vol.Required("entry_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_stop_workflow(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Test beenden. Ein echter Alarm stoppt nur mit Deaktivieren."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    runner = entry.runtime_data.workflow
    if runner.running and not runner.running.get("test"):
        connection.send_error(msg["id"], "alarm_running", "Disarm to stop a real alarm")
        return
    await runner.async_stop()
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/add_code",
        vol.Required("entry_id"): str,
        vol.Required("name"): vol.All(str, vol.Strip, vol.Length(min=1, max=40)),
        vol.Required("code"): str,
        vol.Optional("user_id"): vol.Any(None, str),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_add_code(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Persönlicher Code. Der Code kommt nur hier herein und wird sofort als
    Hash gespeichert; nie geloggt, nie zurückgegeben. Gleiche Codes für zwei
    Personen sind verboten, sonst wäre "geändert von" nicht eindeutig.
    """
    if (entry := _entry(hass, connection, msg)) is None:
        return
    code = msg["code"].strip()
    if not re.fullmatch(CODE_PATTERN, code):
        connection.send_error(msg["id"], "invalid_code_format", "4 to 8 digits")
        return
    # Prüfen und Schreiben unter der Sperre der Anlage (1.63.0, Code-Review): zwischen Prüfen und Schreiben liegen match_code und hash_code
    # im Executor. Ein Doppelklick auf "Speichern" legte so denselben Code zweimal an, beide Aufrufe hatten die Liste ohne ihn geprüft.
    async with _codes_lock(hass, entry.entry_id):
        codes = _stored_codes(entry)
        if len(codes) >= MAX_CODES:
            connection.send_error(msg["id"], "too_many", "Too many codes")
            return
        if any(str(c.get("name", "")).casefold() == msg["name"].casefold() for c in codes):
            connection.send_error(msg["id"], "name_taken", "Name already used")
            return
        user_id = msg.get("user_id") or None
        if user_id and (await hass.auth.async_get_user(user_id) is None or any(c.get("user_id") == user_id for c in codes)):
            connection.send_error(msg["id"], "user_taken", "User unknown or already linked")
            return
        existing = [(c["hash"], c["salt"]) for c in codes]
        if entry.options.get(CONF_CODE_HASH) and entry.options.get(CONF_CODE_SALT):
            existing.append((entry.options[CONF_CODE_HASH], entry.options[CONF_CODE_SALT]))
        if await hass.async_add_executor_job(match_code, code, existing) is not None:
            connection.send_error(msg["id"], "code_taken", "Code already used")
            return
        code_hash, salt = await hass.async_add_executor_job(hash_code, code)
        new = {"id": secrets.token_hex(6), "name": msg["name"], "user_id": user_id, "hash": code_hash, "salt": salt}
        options = dict(entry.options)
        options[CONF_CODES] = [*(entry.options.get(CONF_CODES) or []), new]
        hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"id": new["id"]})



@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_code",
        vol.Required("entry_id"): str,
        vol.Required("code_id"): str,
        vol.Required("name"): vol.All(str, vol.Strip, vol.Length(min=1, max=40)),
        vol.Optional("code"): vol.Any(None, str),
        vol.Optional("user_id"): vol.Any(None, str),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_update_code(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Persönlichen Code bearbeiten (1.63.0): Name, verknüpfter Benutzer und, wenn angegeben, ein neuer Code. Ohne Code bleibt der
    bisherige; gespeichert ist nur sein Hash, das Panel kennt ihn nie. Ein neuer Code kommt nur hier herein und wird sofort als Hash
    gespeichert; nie geloggt, nie zurückgegeben. Es gelten dieselben Regeln wie beim Anlegen, der bearbeitete Eintrag zählt dabei nicht mit.
    """
    if (entry := _entry(hass, connection, msg)) is None:
        return
    # Unter der Sperre der Anlage (1.63.0, Code-Review): die Liste wird vor dem Hashen gelesen und danach geschrieben; ein gleichzeitiges
    # Hinzufügen oder Entfernen ginge sonst verloren
    async with _codes_lock(hass, entry.entry_id):
        codes = list(entry.options.get(CONF_CODES) or [])
        index = next((i for i, c in enumerate(codes) if isinstance(c, dict) and c.get("id") == msg["code_id"]), None)
        if index is None:
            connection.send_error(msg["id"], "not_found", "Unknown code")
            return
        current = codes[index]
        others = [c for i, c in enumerate(codes) if i != index and isinstance(c, dict)]
        code = (msg.get("code") or "").strip()
        if code and not re.fullmatch(CODE_PATTERN, code):
            connection.send_error(msg["id"], "invalid_code_format", "4 to 8 digits")
            return
        if any(str(c.get("name", "")).casefold() == msg["name"].casefold() for c in others):
            connection.send_error(msg["id"], "name_taken", "Name already used")
            return
        user_id = msg.get("user_id") or None
        # Der bisher verknüpfte Benutzer darf bleiben, auch wenn es ihn in Home Assistant nicht mehr gibt; ein anderer muss existieren
        if user_id and (any(c.get("user_id") == user_id for c in others)
                        or (user_id != current.get("user_id") and await hass.auth.async_get_user(user_id) is None)):
            connection.send_error(msg["id"], "user_taken", "User unknown or already linked")
            return
        updated = {**current, "name": msg["name"], "user_id": user_id}
        if code:
            existing = [(c.get("hash"), c.get("salt")) for c in others if c.get("hash") and c.get("salt")]
            if entry.options.get(CONF_CODE_HASH) and entry.options.get(CONF_CODE_SALT):
                existing.append((entry.options[CONF_CODE_HASH], entry.options[CONF_CODE_SALT]))
            if await hass.async_add_executor_job(match_code, code, existing) is not None:
                connection.send_error(msg["id"], "code_taken", "Code already used")
                return
            updated["hash"], updated["salt"] = await hass.async_add_executor_job(hash_code, code)
        codes[index] = updated
        changed = hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_CODES: codes})
    # Wie beim Entfernen: "reload" sagt dem Panel, ob Home Assistant die Anlage neu lädt (unverändert: kein Neuladen)
    connection.send_result(msg["id"], {"ok": True, "reload": bool(changed)})

def _custom_listing(hass: HomeAssistant) -> list[dict[str, Any]]:
    registry = hass.data.get(DATA_CUSTOM_SOUNDS)
    return registry.listing() if registry is not None else []


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/rename_sound", vol.Required("sound_id"): str, vol.Required("name"): vol.All(str, vol.Length(max=200))})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rename_sound(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Einen eigenen Ton umbenennen. Die Schritte verweisen auf die Kennung: nichts muss angepasst werden."""
    registry = hass.data.get(DATA_CUSTOM_SOUNDS)
    if registry is None:
        connection.send_error(msg["id"], "not_found", "No custom sounds")
        return
    try:
        await registry.async_rename(msg["sound_id"], msg["name"])
    except custom_sounds.SoundError as err:
        connection.send_error(msg["id"], err.code, "Cannot rename the sound")
        return
    connection.send_result(msg["id"], {"sounds": registry.listing()})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/delete_sound", vol.Required("sound_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete_sound(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Einen eigenen Ton löschen (das Panel fragt vorher und nennt die Schritte, die ihn nutzen). Ein Schritt, der ihn noch nennt, spielt danach den
    Standardton seiner Art: ein Alarm klingt weiter.
    """
    registry = hass.data.get(DATA_CUSTOM_SOUNDS)
    if registry is None:
        connection.send_error(msg["id"], "not_found", "No custom sounds")
        return
    try:
        await registry.async_delete(msg["sound_id"])
    except custom_sounds.SoundError as err:
        connection.send_error(msg["id"], err.code, "Unknown sound")
        return
    connection.send_result(msg["id"], {"sounds": registry.listing()})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/remove_code", vol.Required("entry_id"): str, vol.Required("code_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_remove_code(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Persönlichen Code entfernen. Ist danach kein Code mehr da, entfällt auch "Code zum Scharfschalten"."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    # Wartet auf ein laufendes Hinzufügen oder Bearbeiten (1.63.0): sonst schriebe dieses die Liste mit dem entfernten Code zurück
    async with _codes_lock(hass, entry.entry_id):
        codes = entry.options.get(CONF_CODES) or []
        rest = [c for c in codes if c.get("id") != msg["code_id"]]
        if len(rest) == len(codes):
            connection.send_error(msg["id"], "not_found", "Unknown code")
            return
        options = dict(entry.options)
        options[CONF_CODES] = rest
        if not rest and not options.get(CONF_CODE_HASH):
            # Ohne Code kann "Code zum Scharfschalten" nicht gelten
            options[CONF_CODE_ARM_REQUIRED] = False
            options[CONF_CODE_ACK_REQUIRED] = False
        changed = hass.config_entries.async_update_entry(entry, options=options)
    # "reload": lädt die Anlage neu? Home Assistant lädt nur neu, wenn sich die Optionen wirklich geändert haben. Ohne diese Angabe
    # wartete das Panel mit der Ladeanzeige 25 Sekunden auf eine neue Kennung, die nie kam.
    connection.send_result(msg["id"], {"ok": True, "reload": bool(changed)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/save_monitors", vol.Required("entry_id"): str, vol.Required("monitors"): MONITORS})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_monitors(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Regeln der Überwachung einer Anlage (laden die Anlage neu wie alle Optionen; eine laufende Regel meldet sich danach nicht noch einmal)."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    try:
        monitors = check_monitors(hass, msg["monitors"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_monitors", str(err))
        return
    changed = hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_MONITORS: monitors})
    connection.send_result(msg["id"], {"ok": True, "reload": bool(changed)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/test_monitor_step",
        vol.Required("entry_id"): str,
        # "out": Regel ausgelöst, "ok": wieder in Ordnung (bestimmt den Standardtext der Meldung)
        vol.Required("kind"): vol.In(("out", "ok")),
        vol.Required("step"): MONITOR_STEP,
        vol.Optional("rule_id"): vol.All(str, vol.Length(max=64)),
        vol.Optional("rule_name"): vol.All(str, vol.Length(max=100)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_test_monitor_step(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Einen Schritt einer Regel der Überwachung einmal ausführen (auch ungespeichert); nie Alarm, nie Sirene."""
    if (entry := _entry(hass, connection, msg)) is None:
        return
    engine = entry.runtime_data.monitor
    if engine is None:
        connection.send_error(msg["id"], "not_found", "Monitoring is not running")
        return
    try:
        done = await engine.async_test_step(msg["step"], msg["kind"], msg.get("rule_id", ""), msg.get("rule_name", ""))
    except Exception as err:  # noqa: BLE001 - ein Fehler des Geräts ist die Antwort des Tests, kein Fehler der Integration
        connection.send_error(msg["id"], "failed", str(err) or type(err).__name__)
        return
    if not done:
        connection.send_error(msg["id"], "nothing_to_test", "This step has nothing to test")
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/monitor_entities"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_monitor_entities(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Was eine Regel der Überwachung beobachten kann: Messwerte (Temperatur, Luftfeuchtigkeit, CO2 ...: Sensoren mit Zahl) und Geräte mit Zuständen
    (Tür, Schalter ...). Mit Name, Bereich, Geräteklasse, Einheit und aktuellem Wert; nie Entitäten von Alarmageddon selbst.
    """
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    out: list[dict[str, Any]] = []
    for state in hass.states.async_all():
        domain = state.entity_id.split(".")[0]
        numeric = domain in MONITOR_NUMERIC_DOMAINS
        if not numeric and domain not in LEAF_STATES:
            continue
        unit = state.attributes.get("unit_of_measurement")
        if numeric and not unit and number(state) is None:
            continue  # Text, Zeitpunkt oder Ähnliches: kein Messwert
        reg = ent_reg.async_get(state.entity_id)
        if reg is not None and (reg.platform == DOMAIN or reg.disabled_by or reg.hidden_by):
            continue
        area_id = reg.area_id if reg else None
        if reg and not area_id and reg.device_id and (device := dev_reg.async_get(reg.device_id)):
            area_id = device.area_id
        area = area_reg.async_get_area(area_id) if area_id else None
        out.append({
            "entity_id": state.entity_id,
            "name": display_name(hass, state.entity_id),
            "kind": "value" if numeric else "state",
            "area": area.name if area else "",
            "device_class": str(state.attributes.get("device_class") or ""),
            "unit": str(unit or ""),
            "states": [] if numeric else list(LEAF_STATES[domain]),
            "state": state.state,
        })
    out.sort(key=lambda e: (e["name"].lower(), e["entity_id"]))
    connection.send_result(msg["id"], {"entities": out})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_entities"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_routine_entities(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Geräte, die eine Routine auslösen können (Schloss, Schalter, Tür, Person ...), mit Name, Bereich und ihren Zuständen. Nie Entitäten von
    Alarmageddon selbst: eine Routine löst keine andere aus. Das Panel zeigt den Namen des Geräts; die Entitäts-ID dient nur der Suche.
    """
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    out: list[dict[str, Any]] = []
    for state in hass.states.async_all():
        domain = state.entity_id.split(".")[0]
        if domain not in LEAF_STATES and domain != "event":
            continue
        reg = ent_reg.async_get(state.entity_id)
        if reg is not None and (reg.platform == DOMAIN or reg.disabled_by or reg.hidden_by):
            continue
        area_id = reg.area_id if reg else None
        if reg and not area_id and reg.device_id and (device := dev_reg.async_get(reg.device_id)):
            area_id = device.area_id
        area = area_reg.async_get_area(area_id) if area_id else None
        out.append({
            "entity_id": state.entity_id,
            "name": display_name(hass, state.entity_id),
            "domain": domain,
            "area": area.name if area else "",
            "device_class": str(state.attributes.get("device_class") or ""),
            "states": [str(t) for t in (state.attributes.get("event_types") or [])] if domain == "event" else list(LEAF_STATES[domain]),
            "state": "" if domain == "event" else state.state,
        })
    out.sort(key=lambda e: (e["name"].lower(), e["entity_id"]))
    connection.send_result(msg["id"], {"entities": out})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/battery_forecast"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_battery_forecast(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Tage bis "Batterie schwach" je Batteriesensor der gewählten Sensoren, seit 1.66.0 gleich gerechnet wie die Sensoransicht bei "1 Jahr"
    (Langzeitstatistik, `sensor_history.async_battery_forecasts`). Eigener Befehl, weil die Abfrage dauern kann: die Liste erscheint sofort,
    die Prognose kommt nach.
    """
    # Dieselben Sensoren wie die Liste (1.66.0): bis 1.65.0 nur die der Zonen und "immer aktiv", die Messwerte der Überwachung und Sensoren nur
    # in der Liste bekamen nie eine Prognose (Meldung des Nutzers 2026-11-19: "–" bei den Fühlern im Kühlschrank)
    sensors, _monitoring = _chosen_sensors(hass)
    batteries = sorted(set(battery_of(hass, sensors).values()))
    settings = await async_get_settings(hass)
    result = await async_battery_forecasts(hass, batteries, settings.notify["battery_threshold"])
    connection.send_result(msg["id"], {"forecast": result})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/export"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_export(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Sicherung aller Einstellungen ohne Codes; das Panel speichert sie als Datei."""
    entries = backup.loaded_entries(hass)
    version = entries[0].runtime_data.version if entries else None
    connection.send_result(msg["id"], await backup.async_export(hass, version))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/import",
        vol.Required("data"): dict,
        vol.Optional("dry_run", default=False): bool,
        # Ziel je Anlage der Sicherung (1.33.0): eine bestehende Anlage (ihre Kennung), "new" (neu anlegen, mit "name") oder "skip";
        # ohne Angabe gilt wie bisher der gleiche Name
        vol.Optional("mapping"): [{vol.Required("index"): int, vol.Required("target"): str, vol.Optional("name", default=""): vol.All(str, vol.Length(max=60))}],
        vol.Optional("restore_settings", default=True): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_import(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Sicherung einlesen. Mit dry_run nur prüfen und zeigen, welche Anlagen gefunden werden."""
    try:
        data = backup.validate(msg["data"], hass)
    except vol.Invalid as err:
        connection.send_error(msg["id"], str(err.msg), "Invalid backup")
        return
    if msg["dry_run"]:
        connection.send_result(msg["id"], backup.plan(hass, data))
        return
    try:
        result = await backup.async_restore(hass, data, msg.get("mapping"), msg["restore_settings"])
    except backup.RestoreError as err:
        connection.send_error(msg["id"], err.code, "Invalid choice of alarm systems")
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backups"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backups(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Die in der Integration abgelegten Sicherungen (ohne Inhalt), neueste zuerst."""
    connection.send_result(msg["id"], {"backups": await backup.async_list_backups(hass), "max": MAX_BACKUPS, "max_auto": (await async_get_settings(hass)).auto_backup["keep"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup_create", vol.Optional("name", default=""): vol.All(str, vol.Length(max=60))})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backup_create(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Legt die aktuelle Konfiguration (ohne Codes) in der Integration ab; es bleiben höchstens MAX_BACKUPS."""
    entries = backup.loaded_entries(hass)
    version = entries[0].runtime_data.version if entries else None
    created = await backup.async_create_backup(hass, version, msg["name"])
    connection.send_result(msg["id"], {"created": created, "backups": await backup.async_list_backups(hass), "max": MAX_BACKUPS, "max_auto": (await async_get_settings(hass)).auto_backup["keep"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup_get", vol.Required("backup_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backup_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Inhalt einer Sicherung: zum Herunterladen und (über "import") zum Wiederherstellen."""
    data = await backup.async_get_backup(hass, msg["backup_id"])
    if data is None:
        connection.send_error(msg["id"], "not_found", "Unknown backup")
        return
    connection.send_result(msg["id"], data)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup_delete", vol.Required("backup_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backup_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    if not await backup.async_delete_backup(hass, msg["backup_id"]):
        connection.send_error(msg["id"], "not_found", "Unknown backup")
        return
    connection.send_result(msg["id"], {"backups": await backup.async_list_backups(hass), "max": MAX_BACKUPS, "max_auto": (await async_get_settings(hass)).auto_backup["keep"]})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/sensor_history",
        vol.Required("entity_id"): vol.All(str, vol.Match(r"^(binary_)?sensor\.[a-z0-9_]+$")),
        vol.Optional("kind", default="state"): vol.In(("state", "battery", "signal", "value")),
        vol.Optional("hours", default=24): vol.In((*STATE_HOURS, *BATTERY_HOURS)),
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_sensor_history(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Sensoransicht (1.9.0): Verlauf eines überwachten Sensors. `kind` "state" liefert Stundenwerte, Ereignisse und den Zustand
    der Anlage, "battery" und "signal" die Werte des Batterie- bzw. Empfangssensors desselben Geräts.

    Nur Sensoren, die eine geladene Anlage überwacht: der Befehl ist kein allgemeiner Zugang zum Verlauf von Home Assistant.
    """
    entity_id = msg["entity_id"]
    kind, hours = msg["kind"], msg["hours"]
    measure = entity_id.startswith("sensor.")
    # Ein Binärsensor hat Verlauf ("state"), Batterie und Empfang; ein Messwert (1.54.0) Werteverlauf ("value"), Batterie und Empfang. Messwerte
    # nur, wenn eine geladene Anlage sie in der Überwachung führt (bei eingeschalteter Überwachung); nie ein beliebiger Sensor.
    # Batterie und Empfang gibt es für beide (bis 1.59.0 lehnte die Prüfung sie für jeden Messwert ab: die Reiter "Batterie" und "Empfang"
    # eines Temperatursensors zeigten nur "Der Verlauf konnte nicht geladen werden")
    if (kind == "value" and not measure) or (kind == "state" and measure):
        connection.send_error(msg["id"], "invalid_format", "Kind does not fit the sensor")
        return
    entries = [e for e in hass.config_entries.async_entries(DOMAIN)
               if e.state is ConfigEntryState.LOADED
               and entity_id in (e.runtime_data.controller.monitor_sensors() if measure else e.runtime_data.controller.all_sensors())]
    if not entries:
        connection.send_error(msg["id"], "not_found", "Sensor is not monitored")
        return
    if hours not in (BATTERY_HOURS if kind == "battery" else STATE_HOURS):
        connection.send_error(msg["id"], "invalid_format", "Period does not fit the kind")
        return
    if kind == "value":
        result = await async_measure_history(hass, entries, entity_id, hours)
    elif kind == "state":
        # Zustand der Anlage ("scharf in …") aus der gewählten Anlage, sonst aus der ersten, die den Sensor überwacht
        entry = next((e for e in entries if e.entry_id == msg.get("entry_id")), entries[0])
        rt = entry.runtime_data
        known = (await async_get_settings(hass)).last_changes.get(entity_id)
        result = await async_state_history(hass, await async_get_stats(hass), entity_id, hours, rt.events.events, list(rt.recorder.recordings) if rt.recorder else [],
                                           known)
        result["entry_id"] = entry.entry_id
    else:
        reg = er.async_get(hass).async_get(entity_id)
        batteries, signals = device_sensors(hass)
        numeric = (batteries if kind == "battery" else signals).get(reg.device_id) if reg and reg.device_id else None
        result = None
        if kind == "signal" and reg and reg.device_id:
            # ZHA und Bluetooth: die eigene Aufzeichnung (der Recorder kennt den Wert nicht). Hat sie noch nichts, gilt der Sensor des Geräts.
            device = dr.async_get(hass).async_get(reg.device_id)
            log = hass.data.get(DATA_RECEPTION)
            if log is not None and reception.live_signal(hass, device) is not None:
                result = reception.history_response(hass, log, reg.device_id, hours, numeric)
                if not result["points"] and numeric is not None:
                    result = None
        if result is None:
            if numeric is None:
                connection.send_error(msg["id"], "not_found", "No such sensor on this device")
                return
            settings = await async_get_settings(hass)
            result = await async_numeric_history(hass, numeric, kind, hours, settings.notify["battery_threshold"])
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/log", vol.Optional("rev"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_log(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """
    Protokoll: alle Ereignisse und die aufgezeichneten Alarme (Zeitachse) je Anlage, getrennt von "data".

    Das Panel fragt bei offenem Reiter alle 5 Sekunden. Mit `rev` (der Stand aus der letzten Antwort) kommt nur
    `{"unchanged": true}` zurück, solange nichts dazukam: sonst gingen jedes Mal alle Ereignisse und Alarme eines Jahres
    je Anlage über die Leitung.
    """
    loaded = [e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED]
    # Stand aller Anlagen: Kennung des Laufs (ändert sich beim Neuladen) und die Zähler von Ereignissen und Aufzeichnungen
    rev = "|".join(
        f"{e.entry_id}:{e.runtime_data.controller.instance}:{e.runtime_data.events.rev}:{e.runtime_data.recorder.rev if e.runtime_data.recorder else 0}:{e.title}"
        for e in sorted(loaded, key=lambda e: e.entry_id)
    )
    if msg.get("rev") == rev:
        connection.send_result(msg["id"], {"unchanged": True, "rev": rev})
        return
    systems = []
    for entry in loaded:
        rt = entry.runtime_data
        systems.append({
            "entry_id": entry.entry_id,
            "title": entry.title,
            "events": rt.events.events,
            "recordings": rt.recorder.recordings if rt.recorder else [],
            "recording": bool(rt.recorder and rt.recorder.current),
        })
    systems.sort(key=lambda s: s["title"].lower())
    connection.send_result(msg["id"], {"systems": systems, "rev": rev})

