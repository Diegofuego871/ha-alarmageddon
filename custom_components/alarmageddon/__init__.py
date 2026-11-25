"""Alarmageddon: Alarmanlage für Home Assistant. Ein Config Entry pro Anlage, ein Panel für alle."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import secrets
from collections.abc import Awaitable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import Platform
from homeassistant.core import CoreState, HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers import service
from homeassistant.components.alarm_control_panel import DOMAIN as ALARM_DOMAIN
import voluptuous as vol
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import STORAGE_DIR, Store
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from . import websocket_api
from .const import (
    CONF_CODE_HASH,
    CONF_CODE_SALT,
    CONF_CODES,
    CONF_ENTRY_SENSORS,
    CONF_MONITOR_SENSORS,
    CONF_PER_MODE_SENSORS,
    CONF_SENSOR_MODES,
    CONF_SENSOR_OPTIONS,
    CONF_SENSORS,
    CONF_ZONE_PREFIX,
    DATA_RECEPTION,
    DATA_SELFTEST,
    DATA_STATE_STORES,
    DOMAIN,
    HEALTHCHECK_STORE_KEY,
    HEALTHLOG_STORE_KEY,
    MAIN_CODE_NAME,
    MAINTENANCE_STORE_KEY,
    MODES,
    OPT_BYPASS,
    SELFTEST_STORE_KEY,
    STATE_STORE_KEY,
)
from .controller import AlarmController
from .events import EventLog, async_remove_events
from .recording import AlarmRecorder, async_remove_recordings
from .backup import async_start_auto_backup, async_stop_auto_backup
from .maintenance import async_start_maintenance, async_stop_maintenance
from .notify import Notifier
from .panel import async_register_panel, async_remove_panel
from .monitor import MonitorEngine, async_remove_monitor_store
from .routines import RoutineEngine, migrate_options
from .reception import STORE_KEY as RECEPTION_STORE_KEY
from .reception import async_get_reception
from .selftest import ISSUE_GLOBAL, async_get_selftest, async_note, async_resolve, async_stop_selftest
from .healthcheck import async_get_healthcheck, async_stop_healthcheck
from .sensor_history import DATA_STATS, STATS_STORE_KEY, async_get_stats
from .settings import async_get_settings
from .workflow import WorkflowRunner, async_remove_workflow_store

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.ALARM_CONTROL_PANEL, Platform.BINARY_SENSOR, Platform.SENSOR]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


@dataclass
class RuntimeData:
    controller: AlarmController
    events: EventLog
    version: str | None
    notifier: Notifier | None = None
    workflow: WorkflowRunner | None = None
    recorder: AlarmRecorder | None = None
    monitor: MonitorEngine | None = None
    routines: RoutineEngine | None = None


type AlarmageddonConfigEntry = ConfigEntry[RuntimeData]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    # Einmal pro HA, nicht pro Anlage: sonst meldet HA doppelte Befehle
    websocket_api.async_register(hass)
    # Quittieren für jeden Nutzer (Dashboard-Karte): ein Entitätsdienst, den HA nur für die Alarm-Entitäten von Alarmageddon annimmt. Das Panel
    # braucht Administratorrechte, dieser Dienst nicht; ob ein Code nötig ist, bestimmt der Administrator (Einstellung der Anlage). Seit 1.87.0
    # hier statt in der Plattform (Quality Scale "action-setup"): der Dienst gibt es, auch wenn eine Anlage gerade nicht geladen ist.
    service.async_register_platform_entity_service(
        hass, DOMAIN, "acknowledge", entity_domain=ALARM_DOMAIN, schema={vol.Optional("code"): cv.string}, func="async_acknowledge_alarm"
    )
    return True


def _migrate_open_sensors(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """
    Bis 0.31.0 gab es für die Anlage die Wahl "Offener Sensor beim Scharfschalten" (verhindern oder umgehen). Seit 0.32.0 ist "Umgehen"
    eine Option je Sensor (auch je Modus). Alte Werte werden einmal übertragen und gelöscht; das Verhalten bleibt dasselbe.
    """
    options = dict(entry.options)
    legacy = [k for k in options if k == "open_sensors" or k.startswith("open_sensors_")]
    if not legacy:
        return
    common = options.pop("open_sensors", "block")
    values = {mode: (options.pop(f"open_sensors_{mode}", None) or common) for mode in MODES}
    sensors = {e for mode in MODES for e in options.get(f"{CONF_ZONE_PREFIX}{mode}", [])} | set(options.get(CONF_SENSORS) or [])
    sensors |= set(options.get(CONF_SENSOR_OPTIONS) or {})
    # Beschädigte Einträge (kein Wörterbuch) ignorieren, statt die ganze Anlage nicht zu laden
    sensor_options = {e: dict(o) for e, o in (options.get(CONF_SENSOR_OPTIONS) or {}).items() if isinstance(o, dict)}
    if len(set(values.values())) == 1:
        if next(iter(values.values())) == "bypass":
            for entity in sensors:
                sensor_options.setdefault(entity, {}).setdefault(OPT_BYPASS, True)
    else:
        # Je Modus verschieden: Einstellungen je Modus einschalten, "Umgehen" nur in den Modi, die es hatten
        per_mode = {m: dict(v) for m, v in (options.get(CONF_SENSOR_MODES) or {}).items()}
        for mode, value in values.items():
            if value == "bypass":
                for entity in sensors:
                    per_mode.setdefault(mode, {}).setdefault(entity, {}).setdefault(OPT_BYPASS, True)
        options[CONF_PER_MODE_SENSORS] = True
        options[CONF_SENSOR_MODES] = per_mode
    options[CONF_SENSOR_OPTIONS] = {e: o for e, o in sensor_options.items() if o}
    hass.config_entries.async_update_entry(entry, options=options)


def _migrate_schedules(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Bis 1.43 gab es Zeitpläne; sie sind jetzt Routinen mit Auslöser Zeitplan (siehe routines.migrate_options)."""
    options = dict(entry.options)
    # Der Schalter "Deaktivieren per Routine erlauben" aus 1.44.0 entfiel in 1.45.0 (die Bestätigung in der Routine genügt)
    dropped = options.pop("routines_disarm", None) is not None
    # "Deaktivieren im Alarm" aus 1.78.0 entfiel in 1.79.0: Deaktivieren beendet den Alarm immer (wie Home Assistant)
    dropped = (options.pop("disarm_ends_alarm", None) is not None) or dropped
    migrated = migrate_options(options, hass.config.language)
    if migrated is not None or dropped:
        hass.config_entries.async_update_entry(entry, options=migrated if migrated is not None else options)


def _migrate_main_code(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """
    Bis 1.89.x hatte eine Anlage neben den Codes pro Person einen Hauptcode (`code_hash`, `code_salt`) ohne Person. Seit 1.90.0 (Frage des
    Nutzers "Wieso braucht es den Hauptcode überhaupt?", Entscheid "Abschaffen", 2026-11-25) gibt es nur noch Codes pro Person: ein Hauptcode wird
    einmal zu einem Code "Hauptcode" ("Main code") ohne Benutzer, mit demselben Hash und Salz. Wer ihn kennt, schaltet also unverändert weiter.
    Ein unvollständiger oder beschädigter Hauptcode (Hash ohne Salz, kein Hex) passte nie zu einem Code (bis 1.89.x übersprang ihn die Prüfung)
    und fällt weg, statt als nutzloser Eintrag in der Liste zu stehen. Die Höchstzahl der Codes
    (`MAX_CODES`) hält die Übertragung nicht auf: danach lässt sich erst wieder ein Code hinzufügen, wenn einer entfernt ist.
    """
    options = dict(entry.options)
    if CONF_CODE_HASH not in options and CONF_CODE_SALT not in options:
        return
    code_hash, salt = options.pop(CONF_CODE_HASH, None), options.pop(CONF_CODE_SALT, None)
    raw = options.get(CONF_CODES)
    codes = list(raw) if isinstance(raw, list) else []
    if _hex(code_hash) and _hex(salt):
        base = MAIN_CODE_NAME["de" if (hass.config.language or "").lower().startswith("de") else "en"]
        taken = {str(c.get("name", "")).casefold() for c in codes if isinstance(c, dict)}
        # Wie add_code: zwei Codes mit demselben Namen gibt es nie (sonst wäre "geändert von" nicht eindeutig)
        name, number = base, 1
        while name.casefold() in taken:
            number += 1
            name = f"{base} {number}"
        codes.append({"id": secrets.token_hex(6), "name": name, "user_id": None, "hash": code_hash, "salt": salt})
    options[CONF_CODES] = codes
    hass.config_entries.async_update_entry(entry, options=options)


def _hex(value: Any) -> bool:
    """Ein nicht leerer Hexwert, wie hash_code ihn schreibt (nur dann konnte der Hauptcode je passen)."""
    try:
        return isinstance(value, str) and bool(value) and bool(bytes.fromhex(value))
    except ValueError:
        return False


async def _isolated(entry: ConfigEntry, awaitable: Awaitable[Any], what: str, part: str | None = None, hass: HomeAssistant | None = None) -> Any:
    """
    Etwas Zusätzliches (Protokoll, Aufzeichnung, Statistik, Aktionen, Wartung) vorbereiten, ohne dass sein Scheitern die Anlage mitnimmt.
    Sicherheitsregel: im Zweifel alarmieren. Ein Lesefehler einer Ablage oder ein Fehler beim Start der Aktionen darf nie
    verhindern, dass die Anlage auf ihre Sensoren hört; es steht im Log, die Anlage läuft ohne dieses Teil weiter.
    Mit `part` (1.65.0) hält der Selbsttest fest, welches Teil nicht startete; startet es beim nächsten Laden, ist der Befund behoben.
    """
    try:
        result = await awaitable
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001 - nur dieses Teil fällt aus
        _LOGGER.exception("%s: %s failed; the alarm system runs without it", entry.title, what)
        if part and hass is not None:
            async_note(hass, entry.entry_id, "start_failed", part, part=part)
        return None
    if part and hass is not None:
        async_resolve(hass, entry.entry_id, "start_failed", part)
    return result


# Aufräumen der Reste gelöschter Anlagen (1.82.0, Wunsch des Nutzers 2026-11-22): Ablagen je Anlage, deren Anlage es nicht mehr gibt (auch wenn sie nicht über das Panel, sondern in Home Assistant
# entfernt oder die Ablage von Hand liegen gelassen wurde), und gemerkte letzte Änderungen von Sensoren, die keine Anlage mehr nennt. Es läuft CLEANUP_DELAY nach dem Start und danach täglich.
# Vorsichtig: als "es gibt sie" gilt jede Anlage in jedem Zustand (auch deaktiviert oder mit Ladefehler); Backups, Einstellungen und eigene Töne bleiben; ein Fehler steht im Log und
# hält nie eine Anlage auf.
CLEANUP_DELAY = 300  # Sekunden nach dem Start (alle Anlagen sind dann längst geladen)
CLEANUP_EVERY = timedelta(hours=24)
DATA_CLEANUP = f"{DOMAIN}_cleanup"
_PER_ENTRY_STORE = re.compile(r"^" + re.escape(DOMAIN) + r"\.(events|recordings|workflow|monitor|state)\.([A-Za-z0-9]+)$")


def _storage_names(path: str) -> list[str]:
    try:
        return sorted(os.listdir(path))
    except OSError:
        return []


async def _async_cleanup_leftovers(hass: HomeAssistant) -> None:
    try:
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            return  # ohne Anlage gibt es nichts zu vergleichen (und die Integration läuft dann nicht)
        removed: list[str] = []
        for name in await hass.async_add_executor_job(_storage_names, hass.config.path(STORAGE_DIR)):
            match = _PER_ENTRY_STORE.match(name)
            # Die Anlage kann inzwischen entstanden sein (Wiederherstellen aus einem Backup): vor dem Löschen noch einmal fragen
            if match and match.group(2) not in {e.entry_id for e in hass.config_entries.async_entries(DOMAIN)}:
                await Store(hass, 1, name).async_remove()
                removed.append(match.group(1))
        settings = await async_get_settings(hass)
        stale = set(settings.last_changes) - set().union(*(_entry_sensors(e) for e in hass.config_entries.async_entries(DOMAIN)))
        settings.forget_changes(stale)
        if removed or stale:
            _LOGGER.info("Cleaned up leftovers of deleted alarm systems: %d stores (%s), %d remembered sensor changes", len(removed), ", ".join(sorted(set(removed))) or "-", len(stale))
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001 - das Aufräumen ist Zusatz und hält nie eine Anlage auf
        _LOGGER.exception("Cleaning up leftovers of deleted alarm systems failed")


@callback
def _async_schedule_cleanup(hass: HomeAssistant) -> None:
    """Beim ersten geladenen Anlage: einmal nach CLEANUP_DELAY, dann täglich. Es endet mit der letzten Anlage (async_unload_entry)."""
    if DATA_CLEANUP in hass.data:
        return

    @callback
    def run(_now: Any = None) -> None:
        hass.async_create_background_task(_async_cleanup_leftovers(hass), "alarmageddon cleanup of leftovers")

    cancel_first = async_call_later(hass, CLEANUP_DELAY, run)
    cancel_daily = async_track_time_interval(hass, run, CLEANUP_EVERY)

    def cancel() -> None:
        cancel_first()
        cancel_daily()

    hass.data[DATA_CLEANUP] = cancel


async def async_setup_entry(hass: HomeAssistant, entry: AlarmageddonConfigEntry) -> bool:
    # Vor dem Controller und vor dem Update-Listener: die Änderung der Optionen löst so kein zusätzliches Neuladen aus
    _migrate_open_sensors(hass, entry)
    _migrate_schedules(hass, entry)
    _migrate_main_code(hass, entry)
    integration = await async_get_integration(hass, DOMAIN)
    settings = await async_get_settings(hass)
    # Selbsttest (1.65.0) zuerst: er hält fest, wenn ein Teil der Anlage nicht startet. Er ist Zusatz wie die Wartung.
    selftest = await _isolated(entry, async_get_selftest(hass, settings), "loading the self-test")
    controller = AlarmController(hass, entry, settings)
    controller.stats = await _isolated(entry, async_get_stats(hass), "loading the sensor statistics", "stats", hass)
    await _isolated(entry, async_get_reception(hass), "starting the reception log", "reception", hass)
    events = EventLog(hass, entry.entry_id, controller)
    await _isolated(entry, events.async_load(), "loading the event log", "events", hass)
    recorder = AlarmRecorder(hass, entry.entry_id, controller)
    await _isolated(entry, recorder.async_load(), "loading the alarm recordings", "recordings", hass)
    notifier = Notifier(hass, entry, controller, settings)
    workflow = WorkflowRunner(hass, entry, controller, notifier)
    notifier.workflow_has_notify = workflow.has_notify
    notifier.silence = workflow.async_silence
    entry.runtime_data = RuntimeData(controller, events, str(integration.version) if integration.version else None, notifier, workflow, recorder)
    _remove_unused_zones(hass, entry, controller)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    # Erst nach dem Wiederherstellen des Zustands (in der Entität) auf Sensoren hören und protokollieren. Jedes Teil wird sofort
    # zum Abmelden vorgemerkt: scheitert ein späteres, bleibt nichts hängen, das weiter auf Sensoren hört.
    controller.async_start()
    entry.async_on_unload(controller.async_stop)
    events.async_start()
    recorder.async_start()
    notifier.async_start()
    entry.async_on_unload(notifier.async_stop)
    # Die Aktionen sind Zusatz zur Anlage selbst: scheitert ihr Start (Ablage), hört die Anlage trotzdem auf ihre Sensoren und meldet
    await _isolated(entry, workflow.async_start(), "starting the alarm actions", "workflow", hass)
    # Erst jetzt hören Protokoll, Aufzeichnung, Meldungen und Aktionen zu: eine während des Neustarts abgelaufene Eingangsverzögerung
    # wird hier zum Alarm (vorher stand der Alarm nur im Zustand, ohne Sirene und ohne Meldung)
    controller.async_finish_restore()
    routines = RoutineEngine(hass, entry, controller)
    entry.runtime_data.routines = routines
    routines.async_start()
    entry.async_on_unload(routines.async_stop)
    # Die Überwachung ist Zusatz zur Anlage: scheitert ihr Start, läuft die Anlage trotzdem
    monitors = MonitorEngine(hass, entry, controller, notifier)
    entry.runtime_data.monitor = monitors
    entry.async_on_unload(monitors.async_stop)
    await _isolated(entry, monitors.async_start(), "starting the monitoring", "monitor", hass)
    # Zonen, Modi und Verzögerungen bestimmen, welche Entitäten es gibt und wem zugehört wird: neu laden.
    # Der Zustand (scharf, Verzögerung, Alarm) übersteht das über die Wiederherstellung der Entität.
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    # Neue Voreinstellungen ändern, welche Sensoren immer aktiv sind und wem zugehört wird: neu laden
    entry.async_on_unload(settings.add_listener(lambda: hass.async_create_task(hass.config_entries.async_reload(entry.entry_id)), entry.entry_id))
    # Das Panel ist Bequemlichkeit, die Alarmanlage nicht: scheitert die Anmeldung (zum Beispiel "frozen router", wenn der
    # Webserver schon steht), läuft die Anlage ohne Panel weiter, statt gar nicht zu laden (Sicherheitsregel: im Zweifel alarmieren)
    try:
        await async_register_panel(hass)
    except Exception:  # noqa: BLE001
        _LOGGER.exception("%s: the panel could not be registered; the alarm system runs without it", entry.title)
    await _isolated(entry, async_start_maintenance(hass, settings), "starting the maintenance check", "maintenance", hass)
    await _isolated(entry, async_start_auto_backup(hass), "starting the automatic backup", "auto_backup", hass)
    # Selbsttest: beim ersten Laden Takt und erste Prüfung; lädt eine Anlage neu (nach dem Speichern), prüft er kurz danach erneut
    if selftest is not None:
        try:
            selftest.async_start()
        except Exception:  # noqa: BLE001 - der Selbsttest ist Zusatz
            _LOGGER.exception("%s: starting the self-test failed; the alarm system runs without it", entry.title)
    # HealthCheck (1.65.0): Lebenszeichen an externe Dienste, für alle Anlagen einmal; Zusatz wie der Selbsttest
    healthcheck = await _isolated(entry, async_get_healthcheck(hass, settings), "loading the health check", "healthcheck", hass)
    if healthcheck is not None:
        try:
            healthcheck.async_start()
        except Exception:  # noqa: BLE001 - die Lebenszeichen sind Zusatz
            _LOGGER.exception("%s: starting the health check failed; the alarm system runs without it", entry.title)
    # Reste der früheren Update-Prüfung (bis 0.27.0): die Meldung unter "Reparaturen" verschwindet mit der Funktion
    ir.async_delete_issue(hass, DOMAIN, "update_available")
    # Erst nach gelungenem Start: scheitert das Laden, gibt es kein Entladen, das den Zeitgeber wieder abräumt
    _async_schedule_cleanup(hass)
    return True


def _remove_unused_zones(hass: HomeAssistant, entry: ConfigEntry, controller: AlarmController) -> None:
    """Wird "Nacht" ausgeschaltet, verschwindet die Zone ganz, statt als "nicht verfügbar" stehen zu bleiben."""
    registry = er.async_get(hass)
    for mode in MODES:
        if mode in controller.modes:
            continue
        for key in (f"zone_{mode}", f"ready_{mode}"):
            if entity_id := registry.async_get_entity_id(Platform.BINARY_SENSOR, DOMAIN, f"{entry.entry_id}_{key}"):
                registry.async_remove(entity_id)


async def _async_reload(hass: HomeAssistant, entry: AlarmageddonConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: AlarmageddonConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    # Ab hier sind die Entitäten weg: scheitert eines der folgenden Teile (Ablage nicht beschreibbar), muss das Entladen trotzdem
    # zu Ende gehen. Sonst bliebe die Anlage ohne Entität zurück und liesse sich nicht neu laden (Zustand "Entladen fehlgeschlagen").
    runtime = entry.runtime_data
    for what, stop in (
        ("saving the event log", runtime.events.async_stop),
        ("saving the alarm recordings", runtime.recorder.async_stop if runtime.recorder else None),
        ("stopping the alarm actions", runtime.workflow.async_unload if runtime.workflow else None),
    ):
        if stop is not None:
            await _isolated(entry, stop(), what)
    others = [
        e for e in hass.config_entries.async_entries(DOMAIN) if e.entry_id != entry.entry_id and e.state is ConfigEntryState.LOADED
    ]
    # Das Panel bleibt auch beim Neuladen einer Anlage stehen (Sensoren speichern lädt sie neu): würde es kurz entfernt, vergässe die
    # Oberfläche die Anlage und hinge. Es verschwindet erst, wenn die letzte Anlage entfernt wird (async_remove_entry).
    if not others:
        if (cancel_cleanup := hass.data.pop(DATA_CLEANUP, None)) is not None:
            cancel_cleanup()
        await _isolated(entry, async_stop_maintenance(hass), "stopping the maintenance check")
        await _isolated(entry, async_stop_healthcheck(hass), "stopping the health check")
        await _isolated(entry, async_stop_selftest(hass), "stopping the self-test")
        async_stop_auto_backup(hass)
    return True


def _entry_sensors(entry: ConfigEntry) -> set[str]:
    """Alle Sensoren, die eine Anlage in ihren Optionen nennt (Zonen, Eingang, Stiller Alarm, Messwerte der Überwachung, Einstellungen je Sensor)."""
    options = entry.options
    sensors: set[str] = set()
    for key in (CONF_ENTRY_SENSORS, CONF_SENSORS, CONF_MONITOR_SENSORS, *(f"{CONF_ZONE_PREFIX}{m}" for m in MODES)):
        value = options.get(key)
        if isinstance(value, list):
            sensors.update(v for v in value if isinstance(v, str))
    for key in (CONF_SENSOR_OPTIONS, CONF_SENSOR_MODES):
        value = options.get(key)
        if isinstance(value, dict):
            sensors.update(k for k in value if isinstance(k, str) and "." in k)
            for inner in value.values():
                if isinstance(inner, dict):
                    sensors.update(k for k in inner if isinstance(k, str) and "." in k)
    return sensors


async def async_remove_entry(hass: HomeAssistant, entry: AlarmageddonConfigEntry) -> None:
    await async_remove_events(hass, entry.entry_id)
    await async_remove_recordings(hass, entry.entry_id)
    await async_remove_workflow_store(hass, entry.entry_id)
    await async_remove_monitor_store(hass, entry.entry_id)
    # Dieselbe Ablage wie die der Anlage (1.87.0): ein ausstehender Schreibvorgang legte die Datei sonst nach dem Löschen wieder an
    await (hass.data.get(DATA_STATE_STORES, {}).pop(entry.entry_id, None) or Store(hass, 1, f"{STATE_STORE_KEY}.{entry.entry_id}")).async_remove()
    # Einrichtungsassistent (1.69.0): der Zustand der Anlage verschwindet mit ihr
    (await async_get_settings(hass)).forget_wizard(entry.entry_id)
    # Selbsttest: die Meldung der Anlage unter "Reparaturen" verschwindet mit ihr; die übrigen Anlagen prüft er kurz danach neu
    ir.async_delete_issue(hass, DOMAIN, f"selftest_{entry.entry_id}")
    others = [e for e in hass.config_entries.async_entries(DOMAIN) if e.entry_id != entry.entry_id]
    # Gemerkte letzte Änderungen der Sensoren dieser Anlage (1.82.0): nur die, die keine andere Anlage mehr nutzt; bei der letzten Anlage alle
    (await async_get_settings(hass)).forget_changes(None if not others else _entry_sensors(entry) - set().union(*(_entry_sensors(e) for e in others)))
    if not others:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_GLOBAL)
        await Store(hass, 1, SELFTEST_STORE_KEY).async_remove()
        await Store(hass, 1, HEALTHCHECK_STORE_KEY).async_remove()
        # Gemeinsame Verläufe und Wartungsstand (1.82.0, Wunsch des Nutzers): ohne Anlage braucht sie niemand. Die Instanzen im Speicher gehen zuerst, damit sie nichts mehr
        # schreiben (Empfang beim Beenden von Home Assistant). Backups, Einstellungen und eigene Töne bleiben, damit eine neue Anlage nichts verliert.
        if (log := hass.data.pop(DATA_RECEPTION, None)) is not None:
            log.async_discard()
        hass.data.pop(DATA_STATS, None)
        for key in (HEALTHLOG_STORE_KEY, MAINTENANCE_STORE_KEY, STATS_STORE_KEY, RECEPTION_STORE_KEY):
            await Store(hass, 1, key).async_remove()
        async_remove_panel(hass)
    elif (selftest := hass.data.get(DATA_SELFTEST)) is not None and hass.state is CoreState.running:
        selftest.async_schedule()
