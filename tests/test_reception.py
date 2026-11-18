"""
Empfang von Bluetooth und ZHA (1.41.0): der stärkste Empfänger zählt, ohne Hin und Her; die Aufzeichnung füllt den Verlauf, den der Recorder
nicht kennt; der Nutzer sieht nur Wert und Verlauf.
"""

from __future__ import annotations

import sys
import time
import types
from types import SimpleNamespace

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.alarmageddon import reception
from custom_components.alarmageddon.const import DATA_BLE_BEST, DATA_RECEPTION

from .conftest import WINDOW, setup_alarm

ADDRESS = "AA:BB:CC:DD:EE:FF"


def scanner(source: str, name: str = "Proxy") -> SimpleNamespace:
    return SimpleNamespace(source=source, name=name, discovered_device_timestamps={})


def advert(source: str, rssi) -> SimpleNamespace:
    return SimpleNamespace(advertisement=SimpleNamespace(rssi=rssi), scanner=scanner(source))


@pytest.fixture
def ble(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch):
    """Bluetooth ist da; was die Empfänger melden, bestimmt der Test (Liste von (Quelle, RSSI) in `heard`)."""
    hass.config.components.add("bluetooth")
    state = SimpleNamespace(heard=[], last=None)
    fake = types.ModuleType("homeassistant.components.bluetooth")
    fake.async_scanner_devices_by_address = lambda _hass, address, connectable=True: [advert(s, r) for s, r in state.heard]
    fake.async_last_service_info = lambda _hass, address, connectable=True: state.last
    monkeypatch.setitem(sys.modules, "homeassistant.components.bluetooth", fake)
    monkeypatch.setattr("homeassistant.components.bluetooth", fake, raising=False)
    return state


def test_the_strongest_receiver_counts(hass: HomeAssistant, ble) -> None:
    ble.heard = [("adapter", -80), ("proxy_kueche", -62), ("proxy_bad", -71)]
    assert reception.ble_rssi(hass, ADDRESS) == -62


def test_a_receiver_that_is_a_little_weaker_does_not_make_the_value_jump(hass: HomeAssistant, ble) -> None:
    """Bis BLE_KEEP_DB schwächer bleibt der bisherige Empfänger: kein Hin und Her zwischen zwei fast gleich starken."""
    ble.heard = [("a", -62), ("b", -70)]
    assert reception.ble_rssi(hass, ADDRESS) == -62  # a zählt
    ble.heard = [("a", -64), ("b", -63)]  # b ist nur 1 dB stärker: a bleibt
    assert reception.ble_rssi(hass, ADDRESS) == -64
    ble.heard = [("a", -65), ("b", -62)]  # b ist 3 dB stärker: Wechsel
    assert reception.ble_rssi(hass, ADDRESS) == -62
    ble.heard = [("a", -61), ("b", -62)]  # jetzt bleibt b
    assert reception.ble_rssi(hass, ADDRESS) == -62


def test_invalid_values_never_count(hass: HomeAssistant, ble) -> None:
    """0 dBm wäre sonst der "stärkste" Wert und würde einen Empfänger ohne Messung wählen."""
    ble.heard = [("a", 0), ("b", -127), ("c", None), ("d", -75)]
    assert reception.ble_rssi(hass, ADDRESS) == -75


def test_a_receiver_that_has_not_heard_the_device_for_long_does_not_count(hass: HomeAssistant, ble, monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Empfänger, dessen letzte Meldung weit hinter der frischesten liegt, ist veraltet (das Gerät steht anderswo)."""
    now = time.monotonic()
    ble.heard = [("alt", -50), ("frisch", -80)]
    monkeypatch.setattr(reception, "_stamps", lambda _hass, sc, _now: {ADDRESS: now - (600 if sc.source == "alt" else 5)})
    assert reception.ble_rssi(hass, ADDRESS) == -80


def test_without_any_listener_there_is_no_value(hass: HomeAssistant, ble) -> None:
    assert reception.ble_rssi(hass, ADDRESS) is None
    ble.last = SimpleNamespace(rssi=-70)  # die Meldung, die Home Assistant führt, ersetzt die Einzelsicht nicht, wenn es sie nicht gibt
    assert reception.ble_rssi(hass, ADDRESS) == -70
    ble.last = SimpleNamespace(rssi=0)
    assert reception.ble_rssi(hass, ADDRESS) is None


def test_a_missing_bluetooth_integration_leaves_the_value_empty(hass: HomeAssistant) -> None:
    assert reception.ble_rssi(hass, ADDRESS) is None


def _bt_device(hass: HomeAssistant, with_address: bool = True, domain: str = "test") -> dr.DeviceEntry:
    entry = MockConfigEntry(domain=domain)
    entry.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={(domain, "bt")}, connections={(dr.CONNECTION_BLUETOOTH, ADDRESS)} if with_address else set()
    )


def test_a_bluetooth_device_shows_dbm_and_stays_when_it_is_silent(hass: HomeAssistant, ble) -> None:
    device = _bt_device(hass)
    ble.heard = [("a", -66)]
    assert reception.live_signal(hass, device) == {"kind": "dbm", "value": -66}
    ble.heard = []
    assert reception.live_signal(hass, device) == {"kind": "dbm", "value": None}, "der Reiter bleibt, der Wert fehlt"


def test_a_device_without_zha_or_bluetooth_has_no_live_value(hass: HomeAssistant) -> None:
    device = _bt_device(hass, with_address=False)
    assert reception.live_signal(hass, device) is None and reception.live_signal(hass, None) is None


def test_zha_comes_directly_from_the_device_and_bluetooth_wins_over_it_only_when_present(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch) -> None:
    device = _bt_device(hass, with_address=False, domain="zha")
    hass.config.components.add("zha")
    zha = types.ModuleType("homeassistant.components.zha.helpers")
    zha.async_get_zha_device_proxy = lambda _hass, _id: SimpleNamespace(device=SimpleNamespace(lqi=187, rssi=-70))
    monkeypatch.setitem(sys.modules, "homeassistant.components.zha.helpers", zha)
    assert reception.live_signal(hass, device) == {"kind": "lqi", "value": 187}
    zha.async_get_zha_device_proxy = lambda _hass, _id: SimpleNamespace(device=SimpleNamespace(lqi=None, rssi=-70))
    assert reception.live_signal(hass, device) == {"kind": "dbm", "value": -70}
    zha.async_get_zha_device_proxy = lambda _hass, _id: SimpleNamespace(device=SimpleNamespace(lqi=0, rssi=0))  # kein Messwert
    assert reception.live_signal(hass, device) is None or reception.live_signal(hass, device)["value"] is not None


def test_the_log_writes_blocks_and_hours_and_answers_with_points(hass: HomeAssistant) -> None:
    log = reception.ReceptionLog(hass)
    start = 1_700_000_100.0
    start -= start % 3600  # volle Stunde
    for minute in range(0, 130, 1):
        log.record("dev", "dbm", -60.0 - (minute % 5), start + minute * 60)
    now = start + 130 * 60
    log.prune(now)
    short = log.points("dev", 3, now)
    assert len(short) >= 20 and all(-65 <= v <= -60 for _t, v in short)
    long = log.points("dev", 168, now)
    assert 2 <= len(long) <= len(short) + 3, "über 24 Stunden gibt es Stundenwerte"
    assert log.kind("dev") == "dbm"


def test_implausible_values_are_not_recorded(hass: HomeAssistant) -> None:
    log = reception.ReceptionLog(hass)
    assert not log.record("dev", "dbm", 0.0, 1000.0) and not log.record("dev", "dbm", 127.0, 1000.0) and not log.record("dev", "lqi", 300.0, 1000.0)
    assert log.kind("dev") is None and log.points("dev", 3, 2000.0) == []


def test_the_value_follows_the_median_of_the_last_minutes(hass: HomeAssistant) -> None:
    """Der Einzelwert schwankt um 10 dB und mehr: Anzeige und Verlauf folgen dem Median der letzten Minuten."""
    log = reception.ReceptionLog(hass)
    now = 10_000.0
    for i, value in enumerate([-60, -61, -59, -60]):
        log.record("dev", "dbm", float(value), now - 240 + i * 60)
    assert log.steady("dev", {"kind": "dbm", "value": -85}, now)["value"] == -60  # ein Ausreisser zählt kaum
    assert log.steady("dev", {"kind": "lqi", "value": 50}, now)["value"] == 50  # andere Art: unverändert
    assert log.steady("none", {"kind": "dbm", "value": -85}, now)["value"] == -85  # zu wenige Messungen


def test_a_new_kind_forgets_the_old_history(hass: HomeAssistant) -> None:
    log = reception.ReceptionLog(hass)
    log.record("dev", "dbm", -60.0, 1000.0)
    log.record("dev", "lqi", 200.0, 1060.0)
    assert log.kind("dev") == "lqi" and [v for _t, v in log.points("dev", 3, 1100.0)] == [200.0]


def test_the_log_survives_a_restart(hass: HomeAssistant) -> None:
    log = reception.ReceptionLog(hass)
    for i in range(10):
        log.record("dev", "dbm", -60.0 - i, 1_000_000.0 + i * 60)
    saved = log.data()
    other = reception.ReceptionLog(hass)
    other.load(saved, 1_000_000.0 + 700)
    assert other.kind("dev") == "dbm" and other.points("dev", 3, 1_000_000.0 + 700)


async def test_the_panel_gets_value_and_history_without_a_receiver_name(hass: HomeAssistant, hass_ws_client, ble) -> None:
    """Das Gerät hat keinen Sensor, nur Bluetooth: Wert in der Liste, Verlauf aus der Aufzeichnung, nichts über Proxys oder Adapter."""
    entry = MockConfigEntry(domain="test")
    entry.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id, identifiers={("test", "w")}, connections={(dr.CONNECTION_BLUETOOTH, ADDRESS)})
    er.async_get(hass).async_get_or_create("binary_sensor", "test", "fenster_kueche", device_id=device.id, suggested_object_id="fenster_kueche")
    ble.heard = [("proxy_kueche", -63), ("adapter", -77)]
    await setup_alarm(hass)
    log = hass.data[DATA_RECEPTION]
    now = time.time()
    for i in range(12):
        log.record(device.id, "dbm", -63.0, now - (12 - i) * 60)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/data"})
    data = (await client.receive_json())["result"]
    info = data["sensors"][WINDOW]
    assert info["signal"] is None and info["signal_live"] == {"kind": "dbm", "value": -63}
    await client.send_json({"id": 2, "type": "alarmageddon/sensor_history", "entity_id": WINDOW, "kind": "signal", "hours": 3})
    result = (await client.receive_json())["result"]
    assert result["unit"] == "dBm" and len(result["points"]) >= 2 and result["summary"]["current"] == -63
    text = str(data) + str(result)
    assert "proxy_kueche" not in text and "adapter" not in text, "der Nutzer sieht keinen Empfänger"


async def test_a_silent_device_keeps_the_tab_and_gives_an_empty_history(hass: HomeAssistant, hass_ws_client, ble) -> None:
    entry = MockConfigEntry(domain="test")
    entry.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id, identifiers={("test", "w")}, connections={(dr.CONNECTION_BLUETOOTH, ADDRESS)})
    er.async_get(hass).async_get_or_create("binary_sensor", "test", "fenster_kueche", device_id=device.id, suggested_object_id="fenster_kueche")
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/data"})
    assert (await client.receive_json())["result"]["sensors"][WINDOW]["signal_live"] == {"kind": "dbm", "value": None}
    await client.send_json({"id": 2, "type": "alarmageddon/sensor_history", "entity_id": WINDOW, "kind": "signal", "hours": 24})
    result = (await client.receive_json())["result"]
    assert result["points"] == [] and result["summary"]["current"] is None


async def test_sampling_records_only_devices_that_are_alive(hass: HomeAssistant, ble) -> None:
    entry = MockConfigEntry(domain="test")
    entry.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id, identifiers={("test", "w")}, connections={(dr.CONNECTION_BLUETOOTH, ADDRESS)})
    er.async_get(hass).async_get_or_create("binary_sensor", "test", "fenster_kueche", device_id=device.id, suggested_object_id="fenster_kueche")
    ble.heard = [("a", -64)]
    hass.states.async_set(WINDOW, "off")
    await setup_alarm(hass)
    log = hass.data[DATA_RECEPTION]
    now = time.time()
    log.sample(now)
    assert log.kind(device.id) == "dbm" and log.points(device.id, 3, now + 1)
    hass.states.async_set(WINDOW, "unavailable")  # ausgefallen: Bluetooth liefert den letzten Wert weiter, er sagt nichts über jetzt
    ble.heard = [("a", -90)]
    log.sample(now + 60)
    assert [v for _t, v in log.points(device.id, 3, now + 61)] == [-64.0], "der Wert des ausgefallenen Geräts zählt nicht (im Block stünde sonst der Median beider)"


def test_the_remembered_receiver_is_forgotten_per_address(hass: HomeAssistant, ble) -> None:
    ble.heard = [("a", -60)]
    reception.ble_rssi(hass, ADDRESS)
    assert hass.data[DATA_BLE_BEST][ADDRESS] == "a"


# ----- Thread (Matter) -----


@pytest.fixture
def thread(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch):
    """Matter ist da; die Nachbartabelle des Geräts bestimmt der Test (`node.table`, `node.available`)."""
    hass.config.components.add("matter")
    node = SimpleNamespace(available=True, node_data=SimpleNamespace(attributes={}))
    package = types.ModuleType("homeassistant.components.matter")
    helpers = types.ModuleType("homeassistant.components.matter.helpers")
    helpers.node_from_ha_device_id = lambda _hass, _id: node
    monkeypatch.setitem(sys.modules, "homeassistant.components.matter", package)
    monkeypatch.setitem(sys.modules, "homeassistant.components.matter.helpers", helpers)
    monkeypatch.setattr("homeassistant.components.matter", package, raising=False)
    return node


def _matter_device(hass: HomeAssistant) -> dr.DeviceEntry:
    return _bt_device(hass, with_address=False, domain="matter")


def test_a_thread_device_shows_the_strongest_neighbour(hass: HomeAssistant, thread) -> None:
    """Die Nachbartabelle des Geräts: bei einem Endgerät ist der stärkste Nachbar sein Elternteil."""
    device = _matter_device(hass)
    thread.node_data.attributes["0/53/7"] = [{"6": -78, "7": -80}, {"6": -64, "7": -66}, {"6": -91, "7": -90}]
    assert reception.live_signal(hass, device) == {"kind": "dbm", "value": -64}


def test_the_thread_table_also_works_with_named_fields_and_falls_back_to_the_last_value(hass: HomeAssistant, thread) -> None:
    device = _matter_device(hass)
    thread.node_data.attributes["0/53/7"] = [SimpleNamespace(averageRssi=None, lastRssi=-70), SimpleNamespace(averageRssi=-75, lastRssi=-60)]
    assert reception.live_signal(hass, device)["value"] == -70


def test_invalid_thread_values_never_count(hass: HomeAssistant, thread) -> None:
    device = _matter_device(hass)
    thread.node_data.attributes["0/53/7"] = [{"6": 0, "7": 0}, {"6": 127}, {"6": -72}]
    assert reception.live_signal(hass, device)["value"] == -72
    thread.node_data.attributes["0/53/7"] = [{"6": 0, "7": -70}]  # der mittlere Wert ist ungültig: der letzte gilt
    assert reception.live_signal(hass, device)["value"] == -70
    thread.node_data.attributes["0/53/7"] = [{"6": 0}, {"7": None}]
    assert reception.live_signal(hass, device) == {"kind": "dbm", "value": None}, "die Tabelle ist da, aber ohne Messwert: der Reiter bleibt"


def test_a_thread_device_that_matter_cannot_reach_has_no_value(hass: HomeAssistant, thread) -> None:
    """Die Tabelle eines nicht erreichbaren Geräts ist veraltet: sie sagt nichts über jetzt."""
    device = _matter_device(hass)
    thread.node_data.attributes["0/53/7"] = [{"6": -64}]
    thread.available = False
    assert reception.live_signal(hass, device) == {"kind": "dbm", "value": None}


def test_a_matter_device_without_a_thread_table_has_no_live_value(hass: HomeAssistant, thread) -> None:
    """Ein Matter-Gerät im WLAN hat keine Nachbartabelle: es bleibt beim Sensor des Geräts."""
    assert reception.live_signal(hass, _matter_device(hass)) is None


def test_missing_matter_internals_leave_the_value_empty(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch) -> None:
    hass.config.components.add("matter")
    device = _matter_device(hass)
    monkeypatch.setitem(sys.modules, "homeassistant.components.matter", None)  # nicht importierbar
    assert reception.live_signal(hass, device) is None


@pytest.mark.parametrize("damaged", [{"open": {"dev_a": [0, ["kein Wert"]]}}, {"blocks": ["eine Liste"]}, ["kein Wörterbuch"]], ids=["Text", "Liste", "Ablage"])
async def test_a_damaged_reception_history_never_stops_the_recording(hass: HomeAssistant, hass_storage, damaged) -> None:
    """
    Code-Review 1.63.0: Eine beschädigte Ablage der Aufzeichnung heisst nur "kein Verlauf". Bis 1.62.0 brach der Start dann vor der Aufzeichnung ab
    (ValueError oder AttributeError beim Lesen), und bis zum Neustart von Home Assistant wurde für keine Anlage mehr etwas aufgezeichnet.
    """
    hass_storage[reception.STORE_KEY] = {"version": 1, "minor_version": 1, "key": reception.STORE_KEY, "data": damaged}
    await setup_alarm(hass)
    log = hass.data[DATA_RECEPTION]
    assert log._unsub_tick is not None and log._unsub_stop is not None
    assert log.record("dev_b", reception.KIND_DBM, -60.0, time.time())
