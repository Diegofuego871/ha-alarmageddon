"""
Globale Einstellungen, für alle Anlagen gleich: Voreinstellungen je Sensorart
(0.3.0), später auch Benachrichtigungen. Eine Ablage pro HA, nicht pro Anlage.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
import copy
from datetime import date, timedelta
import re
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    AUTO_BACKUP_DAYS,
    AUTO_BACKUP_DEFAULT,
    AUTO_BACKUP_KEEP_MAX,
    DATA_SETTINGS,
    DATA_SETTINGS_LOCK,
    BATTERY_CHECKS_RANGE,
    BATTERY_THRESHOLD_RANGE,
    DEFAULT_NOTIFY,
    OFFLINE_MINUTES_RANGE,
    SELFTEST_HOURS_KEYS,
    SELFTEST_MINUTES_RANGE,
    HEALTHCHECK_DEFAULT_INTERVAL,
    HEALTHCHECK_INTERVAL_RANGE,
    HEALTHCHECK_NOTIFY_FAILS_RANGE,
    HEALTHCHECK_NAME_MAX,
    HEALTHCHECK_SUFFIX_MAX,
    HEALTHCHECK_URL_MAX,
    MAX_HEALTHCHECKS,
    NOTIFY_TYPES,
    DEFAULT_PRESETS,
    DEVICE_CLASS_TYPE,
    DOMAIN,
    MODES,
    NOTIFY_MODE_KINDS,
    SENSOR_OPTIONS,
    SENSOR_TYPES,
    SETTINGS_STORE_KEY,
    TYPE_OTHER,
    WIZARD_STATES,
    WIZARD_STEPS,
)


def sensor_type(hass: HomeAssistant, entity_id: str) -> str:
    """Sensorart aus der Geräteklasse (Registry vor Zustand, wie HA selbst)."""
    reg = er.async_get(hass).async_get(entity_id)
    device_class = (reg.device_class or reg.original_device_class) if reg else None
    if not device_class and (state := hass.states.get(entity_id)):
        device_class = state.attributes.get("device_class")
    return DEVICE_CLASS_TYPE.get(device_class or "", TYPE_OTHER)


def valid_presets(value: Any) -> dict[str, list[str]]:
    """Nur bekannte Sensorarten und Optionen; fehlende Arten mit der Grundeinstellung."""
    out = copy.deepcopy(DEFAULT_PRESETS)
    if isinstance(value, dict):
        for kind in SENSOR_TYPES:
            if isinstance(value.get(kind), list):
                out[kind] = [o for o in SENSOR_OPTIONS if o in value[kind]]
    return out


NOTIFY_NAME = re.compile(r"notify\.[a-z0-9_]+")


def _valid_targets(value: Any) -> list[str]:
    """Eigene Empfänger einer Meldungsart: nur notify-Dienste, ohne Doppelte, höchstens 20; sonst leer (die Gruppe gilt)."""
    if not isinstance(value, list):
        return []
    return [t for t in dict.fromkeys(value) if isinstance(t, str) and NOTIFY_NAME.fullmatch(t)][:20]


def valid_notify(value: Any) -> dict[str, Any]:
    """
    Nur bekannte Schlüssel mit gültigen Werten; fehlende mit der Grundeinstellung. Alte Form (bis 0.8.0: "events", dazu ein
    gemeinsames "critical" und "volume") wird je Meldungsart übernommen: an/aus aus "events", kritisch und Lautstärke für die
    Arten, die damals kritisch sein konnten (Alarm, Sensorausfall im scharfen Zustand).
    """
    out = copy.deepcopy(DEFAULT_NOTIFY)
    if not isinstance(value, dict):
        return out
    value = dict(value)
    _healthcheck_1_68(value)
    for key in ("alarm_targets", "maintenance_targets"):
        if isinstance(value.get(key), list):
            # Wie die Listen je Art und je Schritt: nur ein gültiger Name eines notify-Dienstes. Ohne Obergrenze: ein Empfänger der
            # Gruppe darf nie still wegfallen (im Zweifel alarmieren)
            out[key] = [t for t in dict.fromkeys(value[key]) if isinstance(t, str) and NOTIFY_NAME.fullmatch(t)]
    for key in ("disarm_action", "open_action", "silence_action", "acknowledge_action", "arm_retry_action", "arm_force_action", "healthcheck_up"):
        if isinstance(value.get(key), bool):
            out[key] = value[key]
    # Abstände des Selbsttests bis 1.66.x in Stunden: übernommen, wenn der Wert in Minuten fehlt (gespeicherte Einstellungen, ältere Backups)
    value = dict(value)
    for old, new in SELFTEST_HOURS_KEYS:
        hours = value.pop(old, None)
        if new not in value and isinstance(hours, (int, float)) and not isinstance(hours, bool):
            value[new] = int(hours) * 60
    for key, (low, high) in (("battery_threshold", BATTERY_THRESHOLD_RANGE), ("battery_checks", BATTERY_CHECKS_RANGE), ("offline_minutes", OFFLINE_MINUTES_RANGE), ("selftest_minutes", SELFTEST_MINUTES_RANGE),
                              ("selftest_minutes_armed", SELFTEST_MINUTES_RANGE), ("healthcheck_fails", HEALTHCHECK_NOTIFY_FAILS_RANGE)):
        if isinstance(value.get(key), (int, float)) and not isinstance(value.get(key), bool):
            out[key] = max(low, min(high, int(value[key])))
    # Alte Form zuerst, die neue überschreibt sie
    old = value.get("events")
    if isinstance(old, dict):
        for kind in NOTIFY_TYPES:
            if isinstance(old.get(kind), bool):
                out["types"][kind]["enabled"] = old[kind]
        if isinstance(value.get("critical"), bool):
            for kind in ("triggered", "sensor_offline"):
                out["types"][kind]["critical"] = value["critical"]
        if isinstance(value.get("volume"), (int, float)) and not isinstance(value.get("volume"), bool):
            for kind in out["types"]:
                out["types"][kind]["volume"] = max(0.0, min(1.0, float(value["volume"])))
    types = value.get("types")
    if isinstance(types, dict):
        for kind in NOTIFY_TYPES:
            item = types.get(kind)
            if not isinstance(item, dict):
                continue
            for key in ("enabled", "critical", "persistent"):
                if isinstance(item.get(key), bool):
                    out["types"][kind][key] = item[key]
            if isinstance(item.get("volume"), (int, float)) and not isinstance(item.get("volume"), bool):
                out["types"][kind]["volume"] = max(0.0, min(1.0, float(item["volume"])))
            out["types"][kind]["targets"] = _valid_targets(item.get("targets"))
    if isinstance(value.get("per_mode"), bool):
        out["per_mode"] = value["per_mode"]
    # Eigene Werte je Modus (0.29.0): nur bekannte Modi und Arten, nur gültige Werte; leere Einträge fallen weg
    modes = value.get("modes")
    if isinstance(modes, dict):
        for mode in MODES:
            per_kind = modes.get(mode)
            if not isinstance(per_kind, dict):
                continue
            for kind in NOTIFY_MODE_KINDS:
                item = per_kind.get(kind)
                if not isinstance(item, dict):
                    continue
                own: dict[str, Any] = {}
                for key in ("enabled", "critical", "persistent"):
                    if isinstance(item.get(key), bool):
                        own[key] = item[key]
                if isinstance(item.get("volume"), (int, float)) and not isinstance(item.get("volume"), bool):
                    own["volume"] = max(0.0, min(1.0, float(item["volume"])))
                if targets := _valid_targets(item.get("targets")):
                    own["targets"] = targets
                if own:
                    out["modes"].setdefault(mode, {})[kind] = own
    return out


def _healthcheck_1_68(value: dict[str, Any]) -> None:
    """
    Meldungen der HealthCheck-Dienste aus 1.68.0 (zwei feste Meldungen "hc_down", "hc_up" unter "healthcheck") in die Form seit 1.69.0 (Wartungsmeldung
    "healthcheck" wie der Selbsttest, dazu "healthcheck_fails" und "healthcheck_up"; Wunsch des Nutzers 2026-11-19, 22:16/22:17). Übernommen werden
    an/aus, Empfänger, Kritisch, Lautstärke und "stehen lassen" von "antwortet nicht", die Zahl und an/aus von "antwortet wieder"; eigene Texte und das
    Klickziel gibt es nicht mehr. Was schon in der neuen Form steht, bleibt (gespeicherte Einstellungen, Backups aus 1.68.0, ein noch offenes altes Panel).
    """
    hc = value.pop("healthcheck", None)
    if not isinstance(hc, dict):
        return
    down = hc.get("hc_down") if isinstance(hc.get("hc_down"), dict) else {}
    types = value.get("types") if isinstance(value.get("types"), dict) else {}
    if "healthcheck" not in types and down:
        value["types"] = {**types, "healthcheck": {key: down[key] for key in ("enabled", "critical", "persistent", "volume", "targets") if key in down}}
    if "healthcheck_fails" not in value and "fails" in hc:
        value["healthcheck_fails"] = hc["fails"]
    up = hc.get("hc_up")
    if "healthcheck_up" not in value and isinstance(up, dict) and isinstance(up.get("enabled"), bool):
        value["healthcheck_up"] = up["enabled"]


HEALTHCHECK_ID = re.compile(r"^[a-z0-9]{1,16}$")


def valid_healthcheck_url(value: Any) -> str | None:
    """Adresse eines Lebenszeichens: http oder https mit Rechnername, ohne Leerzeichen, höchstens HEALTHCHECK_URL_MAX Zeichen; sonst None."""
    if not isinstance(value, str):
        return None
    url = value.strip()
    if not url or len(url) > HEALTHCHECK_URL_MAX or any(c.isspace() for c in url):
        return None
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    return url


def apply_fail_suffix(url: str, suffix: str) -> str | None:
    """
    Adresse für "Fehler" aus der URL und dem Fehler-Zusatz (1.65.0, generisch, Entscheid des Nutzers): "/…" kommt hinten an den Pfad (vor die
    Parameter), "?…" (oder "&…") setzt Parameter und ersetzt gleichnamige. Beispiele: Healthchecks.io und Better Stack "/fail", Cronitor
    "?state=fail". Leerer Zusatz: None (der Eintrag sendet nur das Lebenszeichen). Ein anderer Anfang ist ungültig: None.
    """
    if not suffix:
        return None
    parts = urlsplit(url)
    if suffix.startswith("/"):
        return urlunsplit(parts._replace(path=parts.path.rstrip("/") + suffix))
    if suffix[0] in "?&":
        extra = parse_qsl(suffix[1:], keep_blank_values=True)
        if not extra:
            return None
        names = {k for k, _v in extra}
        query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in names] + extra
        return urlunsplit(parts._replace(query=urlencode(query)))
    return None


def valid_fail_suffix(url: str, value: Any) -> str | None:
    """Fehler-Zusatz: leer, oder mit "/", "?" oder "&" am Anfang, ohne Leerzeichen, höchstens HEALTHCHECK_SUFFIX_MAX Zeichen, ergibt eine gültige URL."""
    if value is None:
        return ""
    if not isinstance(value, str):
        return None
    suffix = value.strip()
    if not suffix:
        return ""
    if len(suffix) > HEALTHCHECK_SUFFIX_MAX or any(c.isspace() for c in suffix):
        return None
    try:
        full = apply_fail_suffix(url, suffix)
    except ValueError:
        return None
    return suffix if full is not None and valid_healthcheck_url(full) is not None else None


def valid_healthcheck_name(value: Any) -> str | None:
    """Name eines Dienstes (Pflichtfeld): ohne Leerzeichen am Rand, ohne Steuerzeichen, 1 bis HEALTHCHECK_NAME_MAX Zeichen; sonst None."""
    if not isinstance(value, str):
        return None
    name = " ".join(value.split())
    return name if 0 < len(name) <= HEALTHCHECK_NAME_MAX and name.isprintable() else None


def valid_healthchecks(value: Any) -> list[dict[str, Any]]:
    """
    Lebenszeichen an externe Dienste (1.65.0): höchstens MAX_HEALTHCHECKS, jeder Eintrag einzeln geprüft (ein beschädigter fällt weg, nie die Liste).
    {"id", "name", "url", "fail_suffix" (leer erlaubt), "alarm_suffix" (leer erlaubt, seit 1.73.0), "page_url" (freiwillig, seit 1.76.0: Link zur Seite des Dienstes, nur http/https; fehlt, wenn leer), "interval" (Sekunden)}. Ein ungültiger Zusatz wird leer (der Eintrag sendet dann nur das
    Lebenszeichen). Der Name ist seit 1.66.0 Pflicht; ein Eintrag ohne gültigen Namen (aus 1.65.0, auch aus einem Backup) heisst wie der Rechner
    seiner URL.
    """
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in value if isinstance(value, list) else []:
        if not isinstance(item, dict) or len(out) >= MAX_HEALTHCHECKS:
            continue
        hid, url = item.get("id"), valid_healthcheck_url(item.get("url"))
        if not isinstance(hid, str) or not HEALTHCHECK_ID.match(hid) or hid in seen or url is None:
            continue
        interval = item.get("interval")
        if isinstance(interval, bool) or not isinstance(interval, int):
            interval = HEALTHCHECK_DEFAULT_INTERVAL
        interval = max(HEALTHCHECK_INTERVAL_RANGE[0], min(HEALTHCHECK_INTERVAL_RANGE[1], interval))
        seen.add(hid)
        name = valid_healthcheck_name(item.get("name")) or (urlsplit(url).hostname or "?")[:HEALTHCHECK_NAME_MAX]
        entry = {"id": hid, "name": name, "url": url, "fail_suffix": valid_fail_suffix(url, item.get("fail_suffix")) or "",
                 "alarm_suffix": valid_fail_suffix(url, item.get("alarm_suffix")) or "", "interval": interval}
        # Link zur Seite des Dienstes (seit 1.76.0, freiwillig): nur http oder https (er wird im Panel zum Link), sonst weggelassen
        if page_url := valid_healthcheck_url(item.get("page_url")):
            entry["page_url"] = page_url
        out.append(entry)
    return out


def valid_auto_backup(value: Any) -> dict[str, Any]:
    """Aus der Ablage gelesen oder vom Panel gesendet: unbekannte Werte fallen auf die Vorgabe (an, wöchentlich) zurück."""
    raw = value if isinstance(value, dict) else {}
    keep = raw.get("keep")
    if isinstance(keep, bool) or not isinstance(keep, int) or not 1 <= keep <= AUTO_BACKUP_KEEP_MAX:
        keep = AUTO_BACKUP_DEFAULT["keep"]
    return {"enabled": raw.get("enabled") is not False, "every": raw.get("every") if raw.get("every") in AUTO_BACKUP_DAYS else AUTO_BACKUP_DEFAULT["every"], "keep": keep}


def valid_wizard(value: Any) -> dict[str, dict[str, Any]]:
    """Zustand des Einrichtungsassistenten je Anlage (1.69.0): nur bekannte Zustände und Schritte, Datum als ISO-Tag; Unbekanntes fällt weg."""
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(value, dict):
        return out
    for entry_id, item in value.items():
        if not isinstance(entry_id, str) or not isinstance(item, dict):
            continue
        until = item.get("until")
        try:
            until = date.fromisoformat(until).isoformat() if isinstance(until, str) else None
        except ValueError:
            until = None
        out[entry_id] = {"state": item.get("state") if item.get("state") in WIZARD_STATES else "open", "until": until,
                         "step": item.get("step") if item.get("step") in WIZARD_STEPS else WIZARD_STEPS[0]}
    return out


class Settings:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store = Store(hass, 1, SETTINGS_STORE_KEY)
        self.data: dict[str, Any] = {
            "presets": copy.deepcopy(DEFAULT_PRESETS),
            "notify": copy.deepcopy(DEFAULT_NOTIFY),
            # Namen der Sensoren (1.12.0): an (Standard) = "Gerät - Sensor", aus = nur der Name des Sensors. Gilt überall, wo ein
            # Sensor genannt wird (Panel, Protokoll, Meldungen), siehe devices.display_name
            "names_with_device": True,
            # Automatische Sicherung (1.47.0): an (Standard), wöchentlich; gilt für alle Anlagen, nicht Teil der Sicherung selbst
            "auto_backup": dict(AUTO_BACKUP_DEFAULT),
            # HealthCheck (1.65.0): Lebenszeichen an externe Dienste, für alle Anlagen; Teil des Backups (Entscheid des Nutzers)
            "healthchecks": [],
            # Letzte echte Änderung (offen <-> zu) je Sensor, ISO-Zeit; intern, nicht in der Sicherung (Laufzeitdaten)
            "last_changes": {},
            # Einrichtungsassistent je Anlage (1.69.0, const.WIZARD_STEPS); nicht im Backup
            "wizard": {},
        }
        # (Schlüssel, Funktion): der Schlüssel ist die Anlage (entry_id), damit eine Anlage, die ohnehin neu lädt, ausgelassen werden kann
        self._listeners: list[tuple[str | None, Callable[[], None]]] = []
        # Ein verzögertes Schreiben steht aus (siehe _save_soon)
        self._save_pending = False

    def _save_soon(self) -> None:
        """
        Verzögert schreiben, ohne den Termin hinauszuschieben: Store.async_delay_save verschiebt ihn bei jedem Aufruf neu
        (LEARNINGS), bei dauernd wechselnden Sensoren würde sonst erst beim Beenden von Home Assistant geschrieben. Darum
        nur einen Termin planen; er schreibt den Stand, der dann gilt.
        """
        if self._save_pending:
            return
        self._save_pending = True
        self._store.async_delay_save(self._data_for_save, 5)

    def _data_for_save(self) -> dict[str, Any]:
        self._save_pending = False
        return self.data

    async def _async_write(self) -> None:
        # Sofort schreiben verwirft einen geplanten Termin: der Merker muss mit, sonst plante _save_soon nie wieder einen
        self._save_pending = False
        await self._store.async_save(self.data)

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            self.data.update(stored)
        # Update auf 1.69.0: Die Ablage gibt es schon, aber ohne Assistent. Die bestehenden Anlagen sind eingerichtet und bekommen ihn nicht von
        # selbst (Entscheid des Nutzers 2026-11-19, 21:05); nur danach angelegte. Bei einer neuen Installation (keine Ablage) ist jede Anlage neu.
        migrate = isinstance(stored, dict) and "wizard" not in stored
        if migrate:
            self.data["wizard"] = {e.entry_id: {"state": "done"} for e in self.hass.config_entries.async_entries(DOMAIN)}
        self.data["wizard"] = valid_wizard(self.data.get("wizard"))
        self.data["presets"] = valid_presets(self.data.get("presets"))
        self.data["notify"] = valid_notify(self.data.get("notify"))
        self.data["names_with_device"] = self.data.get("names_with_device") is not False
        self.data["auto_backup"] = valid_auto_backup(self.data.get("auto_backup"))
        self.data["healthchecks"] = valid_healthchecks(self.data.get("healthchecks"))
        # Reste der früheren Update-Funktion (bis 0.27.0) beim Laden verwerfen
        self.data.pop("update", None)
        self.data.pop("update_notified", None)
        stored_changes = self.data.get("last_changes")
        self.data["last_changes"] = {k: v for k, v in stored_changes.items() if isinstance(k, str) and isinstance(v, str)} if isinstance(stored_changes, dict) else {}
        if migrate:
            # Sofort festhalten: sonst hielte ein späterer Start die inzwischen neu angelegten Anlagen ebenfalls für eingerichtet
            await self._async_write()

    # -- Einrichtungsassistent (1.69.0) --

    def wizard(self, entry_id: str) -> dict[str, Any]:
        """Zustand des Assistenten einer Anlage; ohne Eintrag ist sie neu (offen, beim Willkommen)."""
        return dict(self.data["wizard"].get(entry_id) or {"state": "open", "until": None, "step": WIZARD_STEPS[0]})

    def wizard_payload(self, entry_id: str) -> dict[str, Any]:
        """Für das Panel: Zustand, Schritt und ob er jetzt erscheint ("due"); "später" gilt bis zum Tag "until" nach der Uhr von Home Assistant."""
        item = self.wizard(entry_id)
        due = item["state"] == "open" or (item["state"] == "later" and (item["until"] is None or dt_util.now().date().isoformat() >= item["until"]))
        return {**item, "due": due}

    async def async_set_wizard(self, entry_id: str, action: str, step: str | None = None) -> dict[str, Any]:
        """
        Aktion des Panels: "start" (offen, beim Schritt `step` oder am Anfang), "step" (offen, hier geht es weiter), "later" (ab morgen wieder,
        der Schritt bleibt), "hide" (nur noch von Hand), "done" (abgeschlossen).
        """
        item = self.wizard(entry_id)
        if action in ("start", "step"):
            item.update(state="open", until=None, step=step if step in WIZARD_STEPS else WIZARD_STEPS[0])
        elif action == "later":
            item.update(state="later", until=(dt_util.now().date() + timedelta(days=1)).isoformat())
        elif action == "hide":
            item.update(state="hidden", until=None)
        elif action == "done":
            item.update(state="done", until=None, step=WIZARD_STEPS[0])
        self.data["wizard"][entry_id] = item
        await self._async_write()
        return self.wizard_payload(entry_id)

    @callback
    def forget_wizard(self, entry_id: str) -> None:
        """Eine entfernte Anlage nimmt ihren Assistenten mit."""
        if self.data["wizard"].pop(entry_id, None) is not None:
            self._save_soon()

    @property
    def last_changes(self) -> dict[str, str]:
        return self.data["last_changes"]

    def note_change(self, entity_id: str, when: str) -> None:
        """Echte Änderung eines Sensors merken (aus dem Zustandsautomaten); selten, verzögertes Speichern genügt."""
        self.data["last_changes"][entity_id] = when
        self._save_soon()

    def seed_changes(self, found: dict[str, str]) -> None:
        """Aus dem Verlauf geholte Zeitpunkte nur für Sensoren ohne gemerkten Wert übernehmen."""
        added = {k: v for k, v in found.items() if k not in self.data["last_changes"]}
        if added:
            self.data["last_changes"].update(added)
            self._save_soon()

    @property
    def presets(self) -> dict[str, list[str]]:
        return self.data["presets"]

    @property
    def notify(self) -> dict[str, Any]:
        return self.data["notify"]

    @property
    def auto_backup(self) -> dict[str, Any]:
        return self.data["auto_backup"]

    async def async_set_auto_backup(self, enabled: bool, every: str, keep: int | None = None) -> None:
        self.data["auto_backup"] = valid_auto_backup({"enabled": enabled, "every": every, "keep": self.auto_backup["keep"] if keep is None else keep})
        await self._async_write()

    @property
    def healthchecks(self) -> list[dict[str, Any]]:
        return self.data["healthchecks"]

    async def async_set_healthchecks(self, items: list[dict[str, Any]]) -> None:
        # Lebenszeichen ändern nichts an den Anlagen: speichern ohne sie neu zu laden (healthcheck.py liest die Liste neu)
        self.data["healthchecks"] = valid_healthchecks(items)
        await self._async_write()

    @property
    def names_with_device(self) -> bool:
        return self.data.get("names_with_device") is not False

    async def async_set_names_with_device(self, value: bool) -> None:
        # Nur Anzeige: speichern ohne die Anlagen neu zu laden
        self.data["names_with_device"] = bool(value)
        await self._async_write()

    async def async_set_notify(self, notify: dict[str, Any]) -> None:
        # Benachrichtigungen ändern nichts an Zonen oder Entitäten: speichern ohne die Anlagen neu zu laden
        self.data["notify"] = valid_notify(notify)
        await self._async_write()

    async def async_store_presets(self, presets: dict[str, list[str]]) -> bool:
        """
        Voreinstellungen übernehmen und schreiben, ohne die Anlagen zu benachrichtigen. Gibt zurück, ob sie sich geändert haben.
        Für Abläufe, die danach auch Optionen von Anlagen ändern (Zurücksetzen eigener Werte, Sicherung einspielen): diese Anlagen
        laden über ihre Optionsänderung neu und sehen dabei schon die neuen Voreinstellungen; die übrigen meldet
        async_notify_listeners. So lädt jede Anlage genau einmal.
        """
        new = valid_presets(presets)
        if new == self.data["presets"]:
            return False
        self.data["presets"] = new
        # Selten geändert: sofort schreiben, damit nichts beim Neustart verloren geht
        await self._async_write()
        return True

    @callback
    def async_notify_listeners(self, skip: set[str] | frozenset[str] = frozenset()) -> None:
        """Anlagen neu laden lassen (neue Voreinstellungen); `skip`: Anlagen, die wegen geänderter Optionen ohnehin neu laden."""
        for key, listener in list(self._listeners):
            if key is None or key not in skip:
                listener()

    @callback
    def add_listener(self, listener: Callable[[], None], key: str | None = None) -> Callable[[], None]:
        item = (key, listener)
        self._listeners.append(item)
        return lambda: self._listeners.remove(item)


async def async_get_settings(hass: HomeAssistant) -> Settings:
    if (settings := hass.data.get(DATA_SETTINGS)) is not None:
        return settings
    # Beim Start laden alle Anlagen zugleich: ohne Sperre entstünden zwei Instanzen auf derselben Datei, und die Listener
    # (Neuladen bei neuen Voreinstellungen) hingen an der falschen (wie beim Panel, siehe panel.py)
    lock = hass.data.setdefault(DATA_SETTINGS_LOCK, asyncio.Lock())
    async with lock:
        if (settings := hass.data.get(DATA_SETTINGS)) is None:
            settings = Settings(hass)
            await settings.async_load()
            hass.data[DATA_SETTINGS] = settings
    return settings
