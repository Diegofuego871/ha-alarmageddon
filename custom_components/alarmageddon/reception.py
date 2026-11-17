"""
Empfang eines Geräts (dBm oder LQI) und sein Verlauf, unabhängig von der Funktechnik.

Der Nutzer sieht nur einen Wert und den Verlauf, nicht, woher er kommt. Dahinter stehen drei Quellen, in dieser Reihenfolge:

1. **ZHA:** LQI oder RSSI direkt aus dem Geräteobjekt; die Sensoren dafür sind meist deaktiviert.
2. **Bluetooth:** der RSSI des **stärksten** Empfängers (Adapter oder Proxy). Home Assistant behält die zuletzt gewählte Quelle, bis eine
   neue deutlich stärker ist; das Gerät hängt dann oft an einem schwächeren Proxy, und beim Wechsel springt der Wert. Alle Adapter und
   Proxys hören aber gleichzeitig mit (`async_scanner_devices_by_address`): wir nehmen den stärksten unter den frischen und bleiben bei
   dem bisherigen, solange er höchstens `BLE_KEEP_DB` schwächer ist (kein Hin und Her bei Rauschen).
3. **Thread (Matter, seit 1.42.0):** die Nachbartabelle des Geräts (Thread-Diagnose, Attribut 0/53/7): der stärkste Nachbar (bei einem Endgerät
   sein Elternteil) mit dem mittleren RSSI. Home Assistant zeigt diesen Wert nirgends als Entität.
4. **Entität** des Geräts (WLAN, Zigbee2MQTT, Z-Wave …): Sache von `devices.device_sensors` und dem Recorder, hier nicht berührt.

Was Home Assistant nur intern kennt (ZHA, Bluetooth), wird vorsichtig gelesen: fehlt es oder ändert sich die Schnittstelle, bleibt der Wert
leer, statt dass die Liste scheitert. Der Recorder kennt diese Werte nicht, darum zeichnet `ReceptionLog` sie selbst auf (jede Minute für
überwachte Geräte, die gerade leben; 5-Minuten-Blöcke für 25 Stunden, Stundenblöcke für 31 Tage).
"""

from __future__ import annotations

import logging
import statistics
import time
from datetime import timedelta
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STOP, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DATA_BLE_BEST, DATA_BLE_STAMPS, DATA_RECEPTION, DOMAIN
from .devices import device_field, entry_ids, main_device

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.reception"
KIND_DBM = "dbm"
KIND_LQI = "lqi"
UNIT = {KIND_DBM: "dBm", KIND_LQI: "LQI"}

BLE_WINDOW_S = 60.0  # nur Empfänger, deren letzte Meldung höchstens so viel älter ist als die frischeste (selten sendende Geräte)
BLE_KEEP_DB = 2  # der bisherige Empfänger bleibt, solange er höchstens so viel schwächer ist wie der stärkste
BLE_MIN = -127  # "kein Wert" in Home Assistant
BLE_STAMPS_TTL_S = 5.0
# Plausible Werte; alles andere ist ein Messfehler (zum Beispiel 0 dBm oder 127 dBm)
DBM_RANGE = (-130.0, -1.0)
LQI_RANGE = (0.0, 255.0)

SAMPLE_INTERVAL = timedelta(seconds=60)
BLOCK_SECONDS = 300
HOUR_SECONDS = 3600
KEEP_BLOCKS = 86400 + HOUR_SECONDS
KEEP_HOURS = 31 * 86400
SAVE_DELAY = 900
# Glättung: Anzeige und Verlauf folgen dem Median der letzten Minuten, nicht dem Einzelwert (der schwankt von Meldung zu Meldung um 10 dB
# und mehr). Erst ab STEADY_MIN Messungen im Fenster, sonst der Einzelwert.
STEADY_WINDOW_S = 300
STEADY_MIN = 3


def plausible(kind: str, value: float) -> bool:
    low, high = DBM_RANGE if kind == KIND_DBM else LQI_RANGE
    return low <= value <= high


# -- Bluetooth -----------------------------------------------------------------------------------------------------------------------


def _stamps(hass: HomeAssistant, scanner: Any, now: float) -> dict[str, float]:
    """
    Zeitpunkte der letzten Meldung je Adresse bei einem Empfänger. Home Assistant baut dieses Wörterbuch bei jedem Zugriff neu (alle
    Adressen des Empfängers); bei vielen Geräten wäre das je Abfrage zu teuer, darum höchstens alle BLE_STAMPS_TTL_S Sekunden.
    """
    cache: dict[str, tuple[Any, float, dict[str, float]]] = hass.data.setdefault(DATA_BLE_STAMPS, {})
    hit = cache.get(str(scanner.source))
    if hit is not None and hit[0] is scanner and now - hit[1] < BLE_STAMPS_TTL_S:
        return hit[2]
    stamps = dict(getattr(scanner, "discovered_device_timestamps", None) or {})
    cache[str(scanner.source)] = (scanner, now, stamps)
    return stamps


def _ble_seen(hass: HomeAssistant, address: str) -> list[tuple[float, int, str]]:
    """
    Die letzte Meldung jedes Empfängers zu einem Gerät: (Alter in Sekunden, RSSI, Quelle). Ungültige Werte (kein Wert, 0 dBm, über 0) fallen
    weg: 0 wäre sonst der "stärkste" Wert und würde einen Empfänger ohne Messung wählen. Leer: nie gehört, Bluetooth nicht bereit oder die
    Schnittstelle fehlt.
    """
    if "bluetooth" not in hass.config.components:
        return []
    try:
        from homeassistant.components import bluetooth  # noqa: PLC0415

        now = time.monotonic()
        seen: list[tuple[float, int, str]] = []
        for item in bluetooth.async_scanner_devices_by_address(hass, address, connectable=False):
            rssi = getattr(item.advertisement, "rssi", None)
            if not isinstance(rssi, (int, float)) or not BLE_MIN < rssi < 0:
                continue
            stamp = _stamps(hass, item.scanner, now).get(address)
            age = max(0.0, now - stamp) if isinstance(stamp, (int, float)) else 0.0
            seen.append((age, int(rssi), str(item.scanner.source)))
        return seen
    except Exception:  # noqa: BLE001 - interne Schnittstelle von Home Assistant
        return []


def _ble_pick(hass: HomeAssistant, address: str, seen: list[tuple[float, int, str]]) -> tuple[float, int, str]:
    """Der gezählte Empfänger: der stärkste unter den frischen; der bisherige bleibt, solange er höchstens BLE_KEEP_DB schwächer ist."""
    freshest = min(age for age, *_ in seen)
    fresh = [x for x in seen if x[0] - freshest <= BLE_WINDOW_S]
    best = max(fresh, key=lambda x: (x[1], -x[0]))
    memory: dict[str, str] = hass.data.setdefault(DATA_BLE_BEST, {})
    kept = next((x for x in fresh if x[2] == memory.get(address)), None)
    if kept is not None and kept[1] >= best[1] - BLE_KEEP_DB:
        best = kept
    memory[address] = best[2]
    return best


def ble_rssi(hass: HomeAssistant, address: str) -> int | None:
    """RSSI des stärksten Empfängers; None: nie gehört oder Bluetooth nicht bereit."""
    if seen := _ble_seen(hass, address):
        return _ble_pick(hass, address, seen)[1]
    if "bluetooth" not in hass.config.components:
        return None
    try:
        from homeassistant.components import bluetooth  # noqa: PLC0415

        info = bluetooth.async_last_service_info(hass, address, connectable=False)
        rssi = getattr(info, "rssi", None)
        return int(rssi) if isinstance(rssi, (int, float)) and BLE_MIN < rssi < 0 else None
    except Exception:  # noqa: BLE001 - interne Schnittstelle von Home Assistant
        return None


# -- ZHA -----------------------------------------------------------------------------------------------------------------------------


def _zha(hass: HomeAssistant, device_id: str) -> dict[str, Any] | None:
    """LQI (sonst RSSI) direkt aus ZHA; die Sensoren dafür sind meist deaktiviert."""
    if "zha" not in hass.config.components:
        return None
    try:
        from homeassistant.components.zha.helpers import async_get_zha_device_proxy  # noqa: PLC0415

        device = async_get_zha_device_proxy(hass, device_id).device
        lqi, rssi = getattr(device, "lqi", None), getattr(device, "rssi", None)
    except Exception:  # noqa: BLE001 - interne Schnittstelle von ZHA
        return None
    if isinstance(lqi, (int, float)) and plausible(KIND_LQI, lqi):
        return {"kind": KIND_LQI, "value": round(lqi)}
    if isinstance(rssi, (int, float)) and plausible(KIND_DBM, rssi):
        return {"kind": KIND_DBM, "value": round(rssi)}
    return None


# -- Thread (Matter) -----------------------------------------------------------------------------------------------------------------

THREAD_NEIGHBORS = "0/53/7"  # Endpunkt 0, Cluster ThreadNetworkDiagnostics (53), Attribut NeighborTable (7)
# Felder eines Eintrags der Nachbartabelle (Tags der Matter-Spezifikation): 6 = averageRssi, 7 = lastRssi
_AVERAGE_RSSI = ("averageRssi", "6")
_LAST_RSSI = ("lastRssi", "7")


def _field(entry: Any, names: tuple[str, ...]) -> Any:
    """Feld eines Eintrags: der Matter-Server liefert Strukturen als Wörterbuch mit Tags oder als Objekt mit Namen."""
    for name in names:
        value = entry.get(name) if isinstance(entry, dict) else getattr(entry, name, None)
        if value is not None:
            return value
    return None


def _thread(hass: HomeAssistant, device: dr.DeviceEntry) -> dict[str, Any] | None:
    """
    {"kind": "dbm", "value": Zahl oder None} aus der Nachbartabelle eines Thread-Geräts (Matter); None, wenn das Gerät kein Thread-Gerät ist
    oder die Tabelle fehlt. Der stärkste Nachbar zählt (bei einem Endgerät sein Elternteil); der mittlere RSSI vor dem letzten. Ein Gerät,
    das Matter gerade nicht erreicht, hat keinen Wert (die Tabelle ist dann veraltet), behält aber seinen Reiter.
    """
    if "matter" not in hass.config.components:
        return None
    try:
        from homeassistant.components.matter.helpers import node_from_ha_device_id  # noqa: PLC0415

        node = node_from_ha_device_id(hass, device.id)
        table = node.node_data.attributes.get(THREAD_NEIGHBORS) if node is not None else None
        if not isinstance(table, list):
            return None
        values: list[int] = []
        for entry in table:
            rssi = _field(entry, _AVERAGE_RSSI)
            if not isinstance(rssi, (int, float)) or not plausible(KIND_DBM, rssi):
                rssi = _field(entry, _LAST_RSSI)
            if isinstance(rssi, (int, float)) and plausible(KIND_DBM, rssi):
                values.append(round(rssi))
        reachable = bool(getattr(node, "available", True))
    except Exception:  # noqa: BLE001 - interne Schnittstelle von Matter
        return None
    return {"kind": KIND_DBM, "value": max(values) if values and reachable else None}


# -- Quelle des Geräts ---------------------------------------------------------------------------------------------------------------


def _address(device: dr.DeviceEntry) -> str | None:
    return next((c[1] for c in device_field(device, "connections") or () if c[0] == dr.CONNECTION_BLUETOOTH), None)


def _domains(hass: HomeAssistant, device: dr.DeviceEntry) -> set[str]:
    # Nie `device.config_entries`: in neueren Versionen von Home Assistant kostet jeder Zugriff mehrere Millisekunden (siehe devices.py)
    return {e.domain for entry_id in entry_ids(device) if (e := hass.config_entries.async_get_entry(entry_id))}


def live_signal(hass: HomeAssistant, device: dr.DeviceEntry | None, smooth: bool = True) -> dict[str, Any] | None:
    """
    {"kind": "dbm"|"lqi", "value": Zahl oder None} für ein Gerät mit ZHA oder Bluetooth, sonst None (dann gilt der Sensor des Geräts).
    "value" None: das Gerät wird gerade nicht gehört; der Reiter "Empfang" bleibt trotzdem da (mit dem Verlauf).
    Mit `smooth` der Median der letzten Minuten; die Aufzeichnung selbst liest den Rohwert, sonst glättete sie doppelt.
    """
    if device is None:
        return None
    signal: dict[str, Any] | None = None
    known = False
    # Das Funkteil gehört dem Gerät mit der Hardware: für ein untergeordnetes Gerät dem übergeordneten. Der Verlauf bleibt beim Gerät selbst.
    radio = main_device(hass, device)
    domains = _domains(hass, radio)
    if "zha" in domains:
        known = True
        signal = _zha(hass, radio.id)
    address = _address(radio)
    if address:
        known = True
        # Bluetooth vor dem Sensor des Geräts: dessen Wert liest oft den Scanner, der das Gerät steuern kann, nicht den besten Empfang
        if (rssi := ble_rssi(hass, address)) is not None:
            signal = {"kind": KIND_DBM, "value": rssi}
        elif signal is None:
            signal = {"kind": KIND_DBM, "value": None}
    if not known and "matter" in domains and (thread := _thread(hass, radio)) is not None:
        known = True
        signal = thread
    if not known:
        return None
    log: ReceptionLog | None = hass.data.get(DATA_RECEPTION)
    if signal is None:
        # ZHA ohne Wert: die Art kennt nur der Verlauf; ohne ihn bleibt es beim Sensor des Geräts
        kind = log.kind(device.id) if log is not None else None
        return {"kind": kind, "value": None} if kind else None
    if smooth and signal["value"] is not None and log is not None:
        signal = log.steady(device.id, signal)
    return signal


# -- Aufzeichnung --------------------------------------------------------------------------------------------------------------------


def _block(values: list[float], start: float) -> list[float]:
    """[Start, Median, Schlechtester, Bester]."""
    return [round(start), round(statistics.median(values), 1), round(min(values), 1), round(max(values), 1)]


def _hour(blocks: list[list[float]], start: float) -> list[float]:
    return [round(start), round(statistics.median(b[1] for b in blocks), 1), min(b[2] for b in blocks), max(b[3] for b in blocks)]


class ReceptionLog:
    """Eigene Aufzeichnung des Empfangs für Geräte, deren Wert der Recorder nicht kennt (ZHA, Bluetooth), für alle Anlagen gemeinsam."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self._kind: dict[str, str] = {}
        self._blocks: dict[str, list[list[float]]] = {}
        self._hours: dict[str, list[list[float]]] = {}
        # Laufender Block je Gerät [Start, Werte] und laufende Stunde [Start, Blöcke]
        self._open: dict[str, list[Any]] = {}
        self._open_hour: dict[str, list[Any]] = {}
        # Rohwerte der letzten Minuten [(Zeit, Wert)] für die Glättung; nur im Arbeitsspeicher
        self._recent: dict[str, list[tuple[float, float]]] = {}
        self._save_pending = False
        self._unsub_tick: CALLBACK_TYPE | None = None
        self._unsub_stop: CALLBACK_TYPE | None = None

    # -- Speicher --

    async def async_start(self) -> None:
        try:
            stored = await self._store.async_load() or {}
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("The reception history could not be loaded: %s", err)
            stored = {}
        self.load(stored, time.time())
        self._unsub_tick = async_track_time_interval(self.hass, self._async_tick, SAMPLE_INTERVAL)
        self._unsub_stop = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._async_stop)

    async def _async_stop(self, _event: Event) -> None:
        if self._unsub_tick is not None:
            self._unsub_tick()
            self._unsub_tick = None
        self.prune(time.time())
        await self._store.async_save(self.data())

    def load(self, stored: dict[str, Any], now: float) -> None:
        def rows(raw: Any) -> dict[str, list[list[float]]]:
            return {
                str(dev): [list(b) for b in items if isinstance(b, list) and len(b) == 4]
                for dev, items in (raw or {}).items()
                if isinstance(items, list)
            }

        self._kind = {str(k): v for k, v in (stored.get("kind") or {}).items() if v in UNIT}
        self._blocks = rows(stored.get("blocks"))
        self._hours = rows(stored.get("hours"))
        self._open = {
            str(dev): [o[0], [float(v) for v in o[1]]]
            for dev, o in (stored.get("open") or {}).items()
            if isinstance(o, list) and len(o) == 2 and isinstance(o[1], list)
        }
        self._open_hour = {
            str(dev): [o[0], [list(b) for b in o[1]]]
            for dev, o in (stored.get("open_hours") or {}).items()
            if isinstance(o, list) and len(o) == 2 and isinstance(o[1], list)
        }
        self.prune(now)

    def data(self) -> dict[str, Any]:
        return {"kind": self._kind, "blocks": self._blocks, "hours": self._hours, "open": self._open, "open_hours": self._open_hour}

    def _save_soon(self) -> None:
        if not self._save_pending:
            self._save_pending = True
            self._store.async_delay_save(self._data_for_save, SAVE_DELAY)

    def _data_for_save(self) -> dict[str, Any]:
        self._save_pending = False
        return self.data()

    # -- Aufzeichnen --

    async def _async_tick(self, _now: Any) -> None:
        self.sample()

    def monitored_devices(self) -> dict[str, list[str]]:
        """Geräte der überwachten Sensoren aller geladenen Anlagen: {device_id: [Entitäten]}."""
        from homeassistant.config_entries import ConfigEntryState  # noqa: PLC0415

        registry = er.async_get(self.hass)
        out: dict[str, list[str]] = {}
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            if entry.state is not ConfigEntryState.LOADED:
                continue
            for entity_id in entry.runtime_data.controller.all_sensors():
                reg = registry.async_get(entity_id)
                if reg and reg.device_id and entity_id not in out.setdefault(reg.device_id, []):
                    out[reg.device_id].append(entity_id)
        return out

    @callback
    def sample(self, now: float | None = None) -> None:
        """
        Empfang aller überwachten Geräte mit ZHA oder Bluetooth, die gerade leben. Ausgefallen: beide liefern den letzten Wert weiter, er sagt
        nichts über jetzt; dann entsteht eine Lücke im Verlauf.
        """
        now = now if now is not None else time.time()
        devices = dr.async_get(self.hass)
        wrote = False
        for device_id, entities in self.monitored_devices().items():
            device = devices.async_get(device_id)
            alive = any((s := self.hass.states.get(e)) is not None and s.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN) for e in entities)
            if not alive:
                self._recent.pop(device_id, None)
                continue
            signal = live_signal(self.hass, device, smooth=False)
            if signal and signal.get("value") is not None:
                wrote = self.record(device_id, signal["kind"], float(signal["value"]), now) or wrote
        self.prune(now)
        if wrote:
            self._save_soon()

    def record(self, dev: str, kind: str, value: float, now: float) -> bool:
        if not plausible(kind, value):
            return False
        if self._kind.get(dev) not in (None, kind):
            # Andere Art (zum Beispiel Gerät neu angelernt): der alte Verlauf passt nicht mehr
            for rows in (self._blocks, self._hours, self._open, self._open_hour, self._recent):
                rows.pop(dev, None)
        self._kind[dev] = kind
        recent = [x for x in self._recent.get(dev, []) if now - x[0] <= STEADY_WINDOW_S]
        recent.append((now, value))
        self._recent[dev] = recent
        start = now - (now % BLOCK_SECONDS)
        current = self._open.get(dev)
        if current is not None and current[0] != start:
            self._close(dev)
            current = None
        if current is None:
            current = [start, []]
            self._open[dev] = current
        current[1].append(value)
        return True

    def kind(self, dev: str) -> str | None:
        return self._kind.get(dev)

    def steady(self, dev: str, signal: dict[str, Any], now: float | None = None) -> dict[str, Any]:
        """Empfang mit dem Median der letzten STEADY_WINDOW_S Sekunden (Messungen der Aufzeichnung plus aktueller Wert); sonst unverändert."""
        now = now if now is not None else time.time()
        recent = [v for t, v in self._recent.get(dev, []) if now - t <= STEADY_WINDOW_S]
        if len(recent) < STEADY_MIN or self._kind.get(dev) != signal.get("kind"):
            return signal
        return {**signal, "value": round(statistics.median([*recent, float(signal["value"])]))}

    def _close(self, dev: str) -> None:
        current = self._open.pop(dev, None)
        if current is None or not current[1]:
            return
        block = _block(current[1], current[0])
        self._blocks.setdefault(dev, []).append(block)
        hour_start = block[0] - (block[0] % HOUR_SECONDS)
        hour = self._open_hour.get(dev)
        if hour is not None and hour[0] != hour_start:
            self._close_hour(dev)
            hour = None
        if hour is None:
            hour = [hour_start, []]
            self._open_hour[dev] = hour
        hour[1].append(block)

    def _close_hour(self, dev: str) -> None:
        hour = self._open_hour.pop(dev, None)
        if hour is not None and hour[1]:
            self._hours.setdefault(dev, []).append(_hour(hour[1], hour[0]))

    def prune(self, now: float) -> None:
        # Abgelaufene laufende Blöcke und Stunden abschliessen, auch von Geräten ohne neue Messung; sonst blieben sie "laufend"
        start = now - (now % BLOCK_SECONDS)
        for dev in [d for d, o in self._open.items() if o[0] != start]:
            self._close(dev)
        hour_start = now - (now % HOUR_SECONDS)
        for dev in [d for d, h in self._open_hour.items() if h[0] != hour_start]:
            self._close_hour(dev)
        for rows, keep in ((self._blocks, KEEP_BLOCKS), (self._hours, KEEP_HOURS)):
            for dev in list(rows):
                kept = [b for b in rows[dev] if b[0] >= now - keep]
                if kept:
                    rows[dev] = kept
                else:
                    rows.pop(dev)
        for dev in [d for d in self._kind if d not in self._blocks and d not in self._hours and d not in self._open and d not in self._open_hour]:
            self._kind.pop(dev)

    # -- Verlauf --

    def points(self, dev: str, hours: int, now: float) -> list[tuple[float, float]]:
        """Punkte (Zeit, Wert) der letzten `hours` Stunden: bis 24 Stunden die 5-Minuten-Blöcke, darüber die Stundenwerte (und die Blöcke danach)."""
        self.prune(now)
        since = now - hours * 3600
        blocks = [*self._blocks.get(dev, [])]
        if (current := self._open.get(dev)) and current[1]:
            blocks.append(_block(current[1], current[0]))
        if hours <= 24:
            return [(b[0], b[1]) for b in blocks if b[0] >= since]
        rows = [h for h in self._hours.get(dev, []) if h[0] >= since]
        last = rows[-1][0] + HOUR_SECONDS if rows else since
        # Die Stunde, die gerade läuft (oder noch nicht abgeschlossen ist), steht in den Blöcken
        return [*[(h[0], h[1]) for h in rows], *[(b[0], b[1]) for b in blocks if b[0] >= max(last, since)]]


async def async_get_reception(hass: HomeAssistant) -> ReceptionLog:
    """Die gemeinsame Aufzeichnung: einmal je Home Assistant geladen und gestartet."""
    log: ReceptionLog | None = hass.data.get(DATA_RECEPTION)
    if log is None:
        log = ReceptionLog(hass)
        hass.data[DATA_RECEPTION] = log
        await log.async_start()
    return log


def history_response(hass: HomeAssistant, log: ReceptionLog, device_id: str, hours: int, entity_id: str | None) -> dict[str, Any]:
    """
    Antwort der Sensoransicht für den Reiter "Empfang" aus der eigenen Aufzeichnung. Ohne Messung im Zeitraum sind die Punkte leer (die
    Sensoransicht zeigt dann "noch keine Werte"); die Art kommt dann aus dem Gerät.
    """
    now = time.time()
    points = log.points(device_id, hours, now)
    device = dr.async_get(hass).async_get(device_id)
    live = live_signal(hass, device)
    kind = log.kind(device_id) or (live or {}).get("kind") or KIND_DBM
    stamp = dt_util.utc_from_timestamp
    # Die Linie läuft bis jetzt: der aktuelle Wert ist der letzte Punkt
    if live and live.get("value") is not None and (not points or now - points[-1][0] >= 60):
        points = [*points, (now, float(live["value"]))]
    values = [v for _t, v in points]
    current = live["value"] if live and live.get("value") is not None else (values[-1] if values else None)
    return {
        "kind": "signal", "hours": hours, "now": stamp(now).isoformat(), "start": stamp(now - hours * 3600).isoformat(), "entity_id": entity_id,
        "unit": UNIT[kind],
        "points": [[stamp(t).isoformat(), round(v, 1)] for t, v in points],
        "summary": {"current": current, "mean": round(sum(values) / len(values), 1) if values else None, "min": min(values, default=None), "max": max(values, default=None)},
    }
