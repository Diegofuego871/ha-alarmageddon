"""
Sicherung und Wiederherstellung (0.5.0): alles, was der Nutzer eingestellt
hat, als JSON-Datei aus dem Panel.

Enthalten: pro Anlage Zonen, Verzögerungen, Verhalten, Optionen pro Sensor,
Abläufe; global Voreinstellungen und Benachrichtigungen. Nicht enthalten:
Codes. Ein Hash eines vier- bis achtstelligen Codes ist mit einer Datei in
der Hand schnell durchprobiert; eine Sicherung soll gefahrlos herumliegen
dürfen. Laufzeitdaten (Zustand, Ereignisse) gehören ebenfalls nicht dazu.

Wiederherstellen: Je Anlage der Sicherung wählt man das Ziel (1.33.0): eine
bestehende Anlage, eine neue oder keine. Die Einstellungen haben mit dem Namen
nichts zu tun. Ohne Wahl gilt wie bisher der gleiche Name. Die Codes der
Zielanlage bleiben unverändert.
"""

from __future__ import annotations

import copy
import hashlib
from datetime import timedelta
import logging
import uuid
from typing import Any

import voluptuous as vol

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import AUTO_BACKUP_DAYS, AUTO_BACKUP_START_DELAY, BACKUPS_STORE_KEY, DATA_AUTO_BACKUP, CONF_CODE_ACK_REQUIRED, CONF_MONITORS, CONF_ROUTINES, CONF_CODE_ARM_REQUIRED, DATA_CUSTOM_SOUNDS, DOMAIN, MAX_BACKUPS, MODE_ENABLED_DEFAULT, MODE_ENABLED_KEY
from .custom_sounds import valid_backup_sounds
from .monitor import check_monitors
from .routines import check_routines, migrate_options
from .schemas import SYSTEM_OPTIONS_SCHEMA
from .settings import async_get_settings, valid_notify, valid_presets
from .systems import async_create_system, new_system_name

_LOGGER = logging.getLogger(__name__)
FORMAT = "alarmageddon"
VERSION = 1
ALLOWED = {str(key.schema) for key in SYSTEM_OPTIONS_SCHEMA.schema}


def loaded_entries(hass: HomeAssistant) -> list[ConfigEntry]:
    return [e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED]


async def async_export(hass: HomeAssistant, integration_version: str | None) -> dict[str, Any]:
    settings = await async_get_settings(hass)
    systems = []
    for entry in sorted(loaded_entries(hass), key=lambda e: e.title.lower()):
        # Nur bekannte Schlüssel: so kommt nie ein Code-Hash in die Datei. Geprüft wird beim Einlesen.
        options = {k: v for k, v in entry.options.items() if k in ALLOWED}
        systems.append({"title": entry.title, "options": options})
    return {
        "format": FORMAT,
        "version": VERSION,
        "integration_version": integration_version,
        "created": dt_util.utcnow().isoformat(),
        # Eigene Töne (1.39.0): die Schritte verweisen nur auf die Kennung, die Datei steckt hier (Base64), damit ein Wiederherstellen nichts vermisst
        "settings": {"presets": settings.presets, "notify": settings.notify, "names_with_device": settings.names_with_device,
                     "custom_sounds": await registry.async_export() if (registry := hass.data.get(DATA_CUSTOM_SOUNDS)) is not None else []},
        "systems": systems,
    }


def validate(data: Any, hass: HomeAssistant) -> dict[str, Any]:
    """Prüft eine Sicherung; wirft vol.Invalid mit einem Schlüssel als Meldung."""
    if not isinstance(data, dict) or data.get("format") != FORMAT:
        raise vol.Invalid("not_a_backup")
    if not isinstance(data.get("version"), int) or data["version"] > VERSION:
        raise vol.Invalid("newer_version")
    systems = []
    for item in data.get("systems") or []:
        if not isinstance(item, dict) or not isinstance(item.get("title"), str):
            raise vol.Invalid("invalid_backup")
        try:
            options = SYSTEM_OPTIONS_SCHEMA(item.get("options") or {})
            # Sicherungen bis 1.43 enthalten Zeitpläne: sie kommen als Routinen zurück
            if (converted := migrate_options(dict(options), hass.config.language)) is not None:
                options = converted
            options.pop("routines_disarm", None)
            if CONF_ROUTINES in options:
                check_routines(hass, options[CONF_ROUTINES], options[CONF_ROUTINES])
            if CONF_MONITORS in options:
                check_monitors(hass, options[CONF_MONITORS])
        except vol.Invalid as err:
            raise vol.Invalid("invalid_backup") from err
        systems.append({"title": item["title"], "options": options})
    settings = data.get("settings") if isinstance(data.get("settings"), dict) else {}
    return {
        "systems": systems,
        "presets": valid_presets(settings["presets"]) if "presets" in settings else None,
        "notify": valid_notify(settings["notify"]) if "notify" in settings else None,
        # Anzeige der Namen (1.12.0); ältere Sicherungen kennen sie nicht, dann bleibt die Einstellung, wie sie ist
        "names_with_device": settings["names_with_device"] if isinstance(settings.get("names_with_device"), bool) else None,
        "custom_sounds": valid_backup_sounds(settings.get("custom_sounds")),
    }


class RestoreError(Exception):
    """Falsche Wahl beim Wiederherstellen; `code` ist der Fehlerschlüssel für das Panel."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def plan(hass: HomeAssistant, backup: dict[str, Any]) -> dict[str, Any]:
    """
    Was beim Wiederherstellen passiert und was man dabei wählen kann: `systems`/`missing` wie bisher (gleicher Name gefunden oder nicht),
    dazu `items` (die Anlagen der Sicherung mit dem Vorschlag, der gleiche Name) und `targets` (die bestehenden Anlagen).
    """
    entries = sorted(loaded_entries(hass), key=lambda e: e.title.lower())
    by_title = {e.title.casefold(): e for e in entries}
    found = [s["title"] for s in backup["systems"] if s["title"].casefold() in by_title]
    missing = [s["title"] for s in backup["systems"] if s["title"].casefold() not in by_title]
    items = [
        {"index": i, "title": s["title"], "default": by_title[s["title"].casefold()].entry_id if s["title"].casefold() in by_title else None}
        for i, s in enumerate(backup["systems"])
    ]
    targets = [{"entry_id": e.entry_id, "title": e.title} for e in entries]
    return {"systems": found, "missing": missing, "settings": any(backup.get(k) is not None for k in ("presets", "notify", "names_with_device")), "items": items, "targets": targets, "sounds": len(backup.get("custom_sounds") or [])}


def _resolve(hass: HomeAssistant, backup: dict[str, Any], mapping: list[dict[str, Any]] | None) -> list[tuple[dict[str, Any], ConfigEntry | str]]:
    """
    Ziel je Anlage der Sicherung, vollständig geprüft, bevor irgendetwas geändert wird: eine geladene Anlage dieser Integration,
    "new" mit freiem Namen oder nichts. Jede Anlage der Sicherung und jedes Ziel höchstens einmal.
    """
    loaded = {e.entry_id: e for e in loaded_entries(hass)}
    if mapping is None:
        by_title = {e.title.casefold(): e for e in loaded.values()}
        return [(item, by_title[item["title"].casefold()]) for item in backup["systems"] if item["title"].casefold() in by_title]
    seen_index: set[int] = set()
    seen_target: set[str] = set()
    new_names: set[str] = set()
    out: list[tuple[dict[str, Any], ConfigEntry | str]] = []
    for choice in mapping:
        index, target = choice["index"], choice["target"]
        if not 0 <= index < len(backup["systems"]) or index in seen_index:
            raise RestoreError("invalid_mapping")
        seen_index.add(index)
        item = backup["systems"][index]
        if target == "skip":
            continue
        if target == "new":
            name, error = new_system_name(hass, choice.get("name", ""), new_names)
            if error:
                raise RestoreError(error)
            new_names.add(name.casefold())
            out.append((item, name))
            continue
        if target not in loaded or target in seen_target:
            raise RestoreError("invalid_mapping")
        seen_target.add(target)
        out.append((item, loaded[target]))
    return out


def _check_active_modes(targets: list[tuple[dict[str, Any], ConfigEntry | str]]) -> None:
    """
    Vor jeder Änderung: Eine Sicherung darf nie den Modus abschalten, in dem die Zielanlage gerade scharf ist oder wird (auch nicht in der
    Verzögerung oder im Alarm). Nach dem Neuladen fände der Zustand keinen Modus mehr und die Anlage wäre still deaktiviert (dieselbe
    Sperre wie beim Speichern der Anlage im Panel, Fehler "mode_active").
    """
    for item, target in targets:
        if isinstance(target, str):
            continue
        ctl = target.runtime_data.controller
        if not ctl.mode or ctl.state == AlarmControlPanelState.DISARMED:
            continue
        merged = {**target.options, **item["options"]}
        if not merged.get(MODE_ENABLED_KEY[ctl.mode], MODE_ENABLED_DEFAULT[ctl.mode]):
            raise RestoreError("mode_active")


async def async_restore(hass: HomeAssistant, backup: dict[str, Any], mapping: list[dict[str, Any]] | None = None, restore_settings: bool = True) -> dict[str, Any]:
    result = plan(hass, backup)
    targets = _resolve(hass, backup, mapping)
    _check_active_modes(targets)
    settings = await async_get_settings(hass)
    # Eigene Töne zuerst: die Schritte der Anlagen verweisen auf sie (nur was fehlt wird zurückgeholt, Vorhandenes bleibt)
    registry = hass.data.get(DATA_CUSTOM_SOUNDS)
    if registry is not None and backup.get("custom_sounds"):
        await registry.async_import(backup["custom_sounds"])
    if restore_settings and backup["notify"] is not None:
        await settings.async_set_notify(backup["notify"])
    if restore_settings and backup.get("names_with_device") is not None:
        await settings.async_set_names_with_device(backup["names_with_device"])
    # Voreinstellungen zuerst und ohne Benachrichtigung: die Anlagen, deren Optionen sich gleich ändern, laden darüber neu
    # und sehen schon die neuen Voreinstellungen; die übrigen werden am Ende benachrichtigt. Jede Anlage lädt genau einmal.
    presets_changed = restore_settings and backup["presets"] is not None and await settings.async_store_presets(backup["presets"])
    reloading: set[str] = set()
    created: list[str] = []
    for item, target in targets:
        if isinstance(target, str):
            # Neue Anlage: über die Einrichtung von Home Assistant, dann gelten die gesicherten Einstellungen wie bei jeder anderen
            entry = await async_create_system(hass, target)
            if entry is None:
                continue
            created.append(entry.title)
        else:
            entry = target
        options = {**entry.options, **item["options"]}
        # Code zum Scharfschalten nur, wenn die Zielanlage überhaupt einen Code hat
        ctl = entry.runtime_data.controller
        if options.get(CONF_CODE_ARM_REQUIRED) and not ctl.has_code:
            options[CONF_CODE_ARM_REQUIRED] = False
        if options.get(CONF_CODE_ACK_REQUIRED) and not ctl.has_code:
            options[CONF_CODE_ACK_REQUIRED] = False
        if hass.config_entries.async_update_entry(entry, options=options):
            reloading.add(entry.entry_id)
    if presets_changed:
        settings.async_notify_listeners(skip=reloading)
    return {**result, "created": created}


# ----- Sicherungen in der Integration (0.38.0): bis zu MAX_BACKUPS, neueste zuerst -----


def _store(hass: HomeAssistant) -> Store:
    return Store(hass, 1, BACKUPS_STORE_KEY)


async def _load_store(hass: HomeAssistant) -> tuple[list[dict[str, Any]], dict[str, str]]:
    data = await _store(hass).async_load()
    items = data.get("backups") if isinstance(data, dict) else None
    blobs = data.get("blobs") if isinstance(data, dict) and isinstance(data.get("blobs"), dict) else {}
    return [b for b in (items or []) if isinstance(b, dict) and isinstance(b.get("id"), str) and isinstance(b.get("data"), dict)], {k: v for k, v in blobs.items() if isinstance(v, str)}


async def _load(hass: HomeAssistant) -> list[dict[str, Any]]:
    return (await _load_store(hass))[0]


def _sounds_of(data: dict[str, Any]) -> list[dict[str, Any]]:
    settings = data.get("settings")
    sounds = settings.get("custom_sounds") if isinstance(settings, dict) else None
    return [s for s in sounds if isinstance(s, dict)] if isinstance(sounds, list) else []


async def _save_store(hass: HomeAssistant, items: list[dict[str, Any]], blobs: dict[str, str]) -> None:
    # Töne, die keine Sicherung mehr nennt, fallen aus der Ablage: jede Datei steht nur einmal da, auch in zehn Sicherungen
    used = {s.get("sha256") for b in items for s in _sounds_of(b["data"])}
    await _store(hass).async_save({"backups": items, "blobs": {k: v for k, v in blobs.items() if k in used}})


async def async_list_backups(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Ohne den Inhalt: Kennung, Zeitpunkt und die Namen der gesicherten Anlagen."""
    return [
        {"id": b["id"], "name": b.get("name") or "", "created": b.get("created"), "auto": bool(b.get("auto")), "systems": [s.get("title") for s in b["data"].get("systems", []) if isinstance(s, dict)]}
        for b in await _load(hass)
    ]


async def async_create_backup(hass: HomeAssistant, integration_version: str | None, name: str = "", auto: bool = False) -> dict[str, Any] | None:
    data = await async_export(hass, integration_version)
    items, blobs = await _load_store(hass)
    name = " ".join(name.split())[:60]
    # Die Töne stehen einmal in der Ablage (nach ihrer Prüfsumme), die Sicherung nennt nur die Prüfsumme
    stored = copy.deepcopy(data)
    for sound in _sounds_of(stored):
        digest = hashlib.sha256(sound["wav"].encode()).hexdigest()
        blobs[digest] = sound.pop("wav")
        sound["sha256"] = digest
    if auto and (newest := next((b for b in items if b.get("auto")), None)) is not None and _same(newest["data"], stored):
        return None  # nichts hat sich geändert: keine zweite gleiche Sicherung (die fünf sollen verschiedene Stände zeigen)
    item = {"id": uuid.uuid4().hex[:12], "name": name, "created": data["created"], "auto": auto, "data": stored}
    items = [item, *items]
    # Eigene und automatische Sicherungen zählen getrennt: zehn eigene und dazu die letzten automatischen (Standard fünf, höchstens 50, die Wahl des Nutzers)
    manual = [b for b in items if not b.get("auto")][:MAX_BACKUPS]
    automatic = [b for b in items if b.get("auto")][:(await async_get_settings(hass)).auto_backup["keep"]]
    keep = {id(b) for b in (*manual, *automatic)}
    items = [b for b in items if id(b) in keep]
    await _save_store(hass, items, blobs)
    return {"id": item["id"], "name": name, "created": item["created"], "auto": auto, "systems": [s["title"] for s in data["systems"]]}


def _same(old: dict[str, Any], new: dict[str, Any]) -> bool:
    """Gleicher Inhalt, ohne Zeitpunkt und Version der Integration."""
    skip = ("created", "integration_version")
    return {k: v for k, v in old.items() if k not in skip} == {k: v for k, v in new.items() if k not in skip}


async def async_run_auto_backup(hass: HomeAssistant) -> None:
    """
    Legt eine automatische Sicherung ab, wenn sie fällig ist (Schalter an, die letzte automatische ist älter als der gewählte Abstand).
    Nie ein Fehler nach aussen: eine Sicherung ist Zusatz und darf die Anlagen nie stören.
    """
    try:
        cfg = (await async_get_settings(hass)).auto_backup
        entries = loaded_entries(hass)
        if not cfg["enabled"] or not entries:
            return
        newest = next((b for b in await _load(hass) if b.get("auto")), None)
        created = dt_util.parse_datetime(newest["created"]) if newest and isinstance(newest.get("created"), str) else None
        # Eine Stunde Spielraum: der Termin um 03:17 liegt nie knapp vor der Frist des Vortags
        if created is not None and dt_util.utcnow() - created < timedelta(days=AUTO_BACKUP_DAYS[cfg["every"]]) - timedelta(hours=1):
            return
        await async_create_backup(hass, entries[0].runtime_data.version, "", auto=True)
    except Exception:  # noqa: BLE001 - nie ein Fehler nach aussen
        _LOGGER.exception("The automatic backup failed")


async def async_start_auto_backup(hass: HomeAssistant) -> None:
    """Eine Prüfung täglich um 03:17 und eine kurz nach dem Start (verpasste nachholen); eine Instanz für alle Anlagen."""
    if DATA_AUTO_BACKUP in hass.data:
        return

    @callback
    def tick(_now: Any) -> None:
        hass.async_create_task(async_run_auto_backup(hass))

    hass.data[DATA_AUTO_BACKUP] = [async_track_time_change(hass, tick, hour=3, minute=17, second=0), async_call_later(hass, AUTO_BACKUP_START_DELAY, tick)]


@callback
def async_stop_auto_backup(hass: HomeAssistant) -> None:
    for unsub in hass.data.pop(DATA_AUTO_BACKUP, []):
        unsub()


async def async_get_backup(hass: HomeAssistant, backup_id: str) -> dict[str, Any] | None:
    items, blobs = await _load_store(hass)
    data = next((b["data"] for b in items if b["id"] == backup_id), None)
    if data is None:
        return None
    data = copy.deepcopy(data)
    settings = data.get("settings")
    if isinstance(settings, dict) and isinstance(settings.get("custom_sounds"), list):
        restored = []
        for sound in _sounds_of(data):
            wav = sound.get("wav") or blobs.get(str(sound.get("sha256")))
            if wav:
                restored.append({"id": sound.get("id"), "name": sound.get("name"), "wav": wav})
        settings["custom_sounds"] = restored
    return data


async def async_delete_backup(hass: HomeAssistant, backup_id: str) -> bool:
    items, blobs = await _load_store(hass)
    rest = [b for b in items if b["id"] != backup_id]
    if len(rest) == len(items):
        return False
    await _save_store(hass, rest, blobs)
    return True
