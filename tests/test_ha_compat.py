"""
Verträglichkeit mit neueren Versionen von Home Assistant (1.60.0, gemessen an 2026.10.4 und 2026.11.1).

Anlass: Aufzeichnung des Nutzers vom 2026-11-17 (Home Assistant 2026.11.1). Jeder Abruf der Übersicht hielt den Event-Loop rund 1,4
Sekunden an: `DeviceEntry.config_entries` ist dort eine veraltete Brücke, jeder Zugriff sucht den Aufrufer in allen geladenen Modulen,
und die Übersicht las das Feld je Sensor zweimal. Die Tests hier laufen mit jeder Version von Home Assistant: sie bauen die Geräte der
neuen Registry nach und lassen den veralteten Zugriff scheitern.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.alarmageddon import reception
from custom_components.alarmageddon.const import DOMAIN
from custom_components.alarmageddon.devices import device_field, entry_ids, free_entity_id, main_device, system_device
from custom_components.alarmageddon.schemas import SYSTEM_OPTIONS_SCHEMA, strict_map

from .conftest import WINDOW, setup_alarm

MAC = "AA:BB:CC:DD:EE:FF"


class NewDevice:
    """Gerät der neuen Registry: ein Konfigurationseintrag; der alte Zugriff ist die veraltete Brücke (hier: scheitert)."""

    is_composite_device = False

    def __init__(self, entry_id: str, device_id: str = "dev1", connections: set[tuple[str, str]] | None = None) -> None:
        self.config_entry_id = entry_id
        self.id = device_id
        self.connections = connections or set()
        self.manufacturer = "Eve"

    @property
    def config_entries(self) -> set[str]:
        raise AssertionError("veralteter Zugriff auf DeviceEntry.config_entries")


class ChildDevice:
    """Untergeordnetes Gerät der neuen Registry: keine Hardware-Angaben; der Zugriff darauf ist die veraltete Brücke (hier: scheitert)."""

    is_composite_device = False

    def __init__(self, entry_id: str, parent_id: str) -> None:
        self.config_entry_id = entry_id
        self.id = "child1"
        self.parent_device_id = parent_id

    def __getattr__(self, name: str) -> Any:
        raise AssertionError(f"veralteter Zugriff auf ChildDeviceEntry.{name}")


def _entry(hass: HomeAssistant, domain: str) -> MockConfigEntry:
    entry = MockConfigEntry(domain=domain)
    entry.add_to_hass(hass)
    return entry


async def test_the_config_entry_of_a_device_is_read_without_the_deprecated_field(hass: HomeAssistant) -> None:
    """Neue Registry: `config_entry_id`; das veraltete `config_entries` wird nie angefasst (jeder Zugriff kostet dort Millisekunden)."""
    entry = _entry(hass, "bthome")
    device = NewDevice(entry.entry_id, connections={(dr.CONNECTION_BLUETOOTH, MAC)})
    assert entry_ids(device) == {entry.entry_id}
    assert reception._domains(hass, device) == {"bthome"}
    # Der ganze Weg der Übersicht: Bluetooth-Gerät, nie gehört -> Art bekannt, kein Wert
    assert reception.live_signal(hass, device) == {"kind": "dbm", "value": None}
    # Kein Funkteil, das wir kennen: kein Empfang, und wieder kein veralteter Zugriff
    assert reception.live_signal(hass, NewDevice(_entry(hass, "hue").entry_id)) is None


async def test_older_and_composite_devices_still_name_all_their_config_entries(hass: HomeAssistant) -> None:
    """Ältere Versionen kennen nur `config_entries`; ein zusammengesetztes Gerät (alte Geräte-ID) nennt weiterhin alle Einträge."""
    one, two = _entry(hass, "zha"), _entry(hass, "bthome")
    old = SimpleNamespace(id="d", config_entries={one.entry_id, two.entry_id}, connections=set())
    assert entry_ids(old) == {one.entry_id, two.entry_id}
    assert reception._domains(hass, old) == {"zha", "bthome"}
    composite = SimpleNamespace(id="d", is_composite_device=True, config_entry_id=one.entry_id, config_entries={one.entry_id, two.entry_id}, connections=set())
    assert entry_ids(composite) == {one.entry_id, two.entry_id}
    assert entry_ids(SimpleNamespace(id="d")) == set()


async def test_a_child_device_takes_its_hardware_from_the_parent(hass: HomeAssistant) -> None:
    """Untergeordnetes Gerät: Funkadresse, Hersteller und Modell stehen am übergeordneten; am Kind wird nichts Veraltetes gelesen."""
    entry = _entry(hass, "bthome")
    parent = dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id, connections={(dr.CONNECTION_BLUETOOTH, MAC)}, manufacturer="Shelly", model="BLU")
    child = ChildDevice(entry.entry_id, parent.id)
    assert main_device(hass, child).id == parent.id
    assert main_device(hass, parent) is parent
    assert device_field(child, "manufacturer") is None and device_field(None, "model") is None
    assert device_field(main_device(hass, child), "manufacturer") == "Shelly"
    assert reception.live_signal(hass, child) == {"kind": "dbm", "value": None}
    # Das übergeordnete Gerät fehlt (beschädigte Registry): kein Fehler, kein Empfang
    orphan = ChildDevice(entry.entry_id, "gibt_es_nicht")
    assert main_device(hass, orphan) is orphan and reception.live_signal(hass, orphan) is None


async def test_the_overview_asks_for_the_signal_once_per_device(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    """Ein Gerät mit mehreren Sensoren: Empfang und Hardware werden je Abruf einmal je Gerät gelesen, nicht je Sensor."""
    source = _entry(hass, "bthome")
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, connections={(dr.CONNECTION_BLUETOOTH, MAC)}, manufacturer="Eve", model="Door")
    sensors = []
    for index in range(4):
        reg = er.async_get(hass).async_get_or_create("binary_sensor", "bthome", f"u{index}", device_id=device.id, original_device_class="window")
        hass.states.async_set(reg.entity_id, "off", {"device_class": "window"})
        sensors.append(reg.entity_id)
    await setup_alarm(hass, zone_home=[WINDOW, *sensors], zone_away=[WINDOW, *sensors])
    asked: list[str] = []
    real = reception.live_signal
    monkeypatch.setattr(reception, "live_signal", lambda hass_, dev, smooth=True: asked.append(dev.id) or real(hass_, dev, smooth))
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/data"})
    result = (await client.receive_json())["result"]
    assert asked == [device.id]
    for entity_id in sensors:
        info = result["sensors"][entity_id]
        assert info["signal_live"] == {"kind": "dbm", "value": None} and info["manufacturer"] == "Eve" and info["model"] == "Door"


async def test_the_device_of_an_alarm_system_and_free_entity_ids(hass: HomeAssistant) -> None:
    """Gerät der Anlage und freie Entitäts-ID über die Schnittstellen, die es in der laufenden Version gibt (nie die veralteten)."""
    entry = await setup_alarm(hass)
    device = system_device(hass, entry.entry_id)
    assert device is not None and device.name == "Haus" and (DOMAIN, entry.entry_id) in device.identifiers
    assert system_device(hass, "gibt_es_nicht") is None
    registry = er.async_get(hass)
    assert free_entity_id(registry, "alarm_control_panel", "haus") == "alarm_control_panel.haus_2"
    assert free_entity_id(registry, "alarm_control_panel", "haus", current_entity_id="alarm_control_panel.haus") == "alarm_control_panel.haus"


def test_a_strict_map_rejects_unknown_keys_and_bad_values() -> None:
    check = strict_map(vol.In(["home", "away"]), vol.All(int, vol.Range(min=0)))
    assert check({"home": 1, "away": 2}) == {"home": 1, "away": 2} and check({}) == {}
    for bad in ({"gibt_es_nicht": 1}, {"home": "x"}, {"home": -1}, ["home"], "home", None):
        with pytest.raises(vol.Invalid):
            check(bad)


def test_the_backup_schema_has_no_lenient_nested_maps() -> None:
    """
    Im Schema der Sicherungen (REMOVE_EXTRA) steht kein Wörterbuch als Prüfung: je nach Prüf-Bibliothek von Home Assistant würde ein
    unbekannter Schlüssel darin stillschweigend verworfen, statt die Sicherung abzulehnen. Immer strict_map.
    """
    lenient = [str(key) for key, value in SYSTEM_OPTIONS_SCHEMA.schema.items() if isinstance(value, dict)]
    assert lenient == []


@pytest.mark.parametrize(
    "options",
    [
        {"sensor_modes": {"gibt_es_nicht": {WINDOW: {"always": True}}}},
        {"sensor_modes": {"home": {"kein sensor": {"always": True}}}},
        {"sensor_options": {"kein sensor": {"always": True}}},
        {"workflows": {"gibt_es_nicht": []}},
        {"workflow_end": {"gibt_es_nicht": {}}},
        {"workflows_after": {"gibt_es_nicht": []}},
        {"workflows_armed": {"gibt_es_nicht": []}},
        {"workflows_disarmed": {"gibt_es_nicht": []}},
        {"workflows_arming": {"gibt_es_nicht": []}},
        {"workflows_entry": {"gibt_es_nicht": []}},
    ],
)
def test_a_backup_with_an_unknown_key_in_a_nested_map_is_rejected(options: dict[str, Any]) -> None:
    with pytest.raises(vol.Invalid):
        SYSTEM_OPTIONS_SCHEMA(options)
