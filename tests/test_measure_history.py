"""Sensoransicht für Messwert-Sensoren (1.54.0): Werteverlauf, Ereignisse der Überwachung, Grenzen; nie ein beliebiger Sensor."""

from __future__ import annotations

from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.alarmageddon import sensor_history

from .conftest import WINDOW, setup_alarm
from .test_monitor import DOOR, TEMP, _rule, _value, set_temp, settle, tick

HUM = "sensor.keller_luftfeuchtigkeit"


async def _ask(client, mid: int, **msg) -> dict:
    await client.send_json({"id": mid, "type": "alarmageddon/sensor_history", **msg})
    return await client.receive_json()


@pytest.fixture
def values(monkeypatch):
    """Werte statt Recorder: ein Tag Temperatur."""

    async def numeric(_hass, _entity_id, start, _hours):
        return [(start + timedelta(hours=h), 4.0 + h * 0.5) for h in range(0, 12, 3)]

    monkeypatch.setattr(sensor_history, "async_numeric", numeric)


async def _setup(hass: HomeAssistant, *, enabled: bool = True, listed: bool = True, monitors: list | None = None):
    await set_temp(hass, "6.5")
    return await setup_alarm(hass, monitors=monitors if monitors is not None else [_rule(_value(TEMP, "above", 8))], monitor_enabled=enabled,
                             monitor_sensors=[TEMP] if listed else [])


async def test_measure_history_has_points_summary_unit_and_limits(hass: HomeAssistant, hass_ws_client, values) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    result = (await _ask(client, 1, entity_id=TEMP, kind="value", hours=24))["result"]
    assert result["kind"] == "value" and result["unit"] == "°C" and result["entity_id"] == TEMP
    assert [v for _t, v in result["points"]][:4] == [4.0, 5.5, 7.0, 8.5] or len(result["points"]) >= 4
    assert result["summary"]["current"] == 6.5 and result["summary"]["min"] <= result["summary"]["max"]
    assert result["limits"] == [{"rule": "Kühlschrank", "op": "above", "limits": [8.0]}]
    assert result["events"] == []


async def test_measure_history_outside_has_both_limits(hass: HomeAssistant, hass_ws_client, values) -> None:
    await _setup(hass, monitors=[_rule(_value(TEMP, "outside", 2, upper=8), name="Zone")])
    client = await hass_ws_client(hass)
    result = (await _ask(client, 1, entity_id=TEMP, kind="value", hours=24))["result"]
    assert result["limits"] == [{"rule": "Zone", "op": "outside", "limits": [2.0, 8.0]}]


async def test_measure_history_lists_only_monitor_events_of_this_sensor(hass: HomeAssistant, hass_ws_client, values, freezer) -> None:
    """Ereignisse der Überwachung (ausserhalb, wieder in Ordnung) zu diesem Sensor, mit Wert, Regel und Anlage; keine Messwerte, keine fremden Sensoren."""
    entry = await _setup(hass, monitors=[_rule(_value(TEMP, "above", 8), hold=1), _rule(_value(HUM, "above", 70), name="Keller", rid="m2", hold=1)])
    client = await hass_ws_client(hass)
    await set_temp(hass, "9.5")
    await tick(hass, freezer, 5)
    await set_temp(hass, "6")
    await tick(hass, freezer, 5)
    kinds = [(e["kind"], e["rule"], e["value"], e["unit"], e["system"]) for e in (await _ask(client, 1, entity_id=TEMP, kind="value", hours=24))["result"]["events"]]
    assert kinds == [("ok", "Kühlschrank", "6", "°C", entry.title), ("out", "Kühlschrank", "9.5", "°C", entry.title)]
    # ein fremdes Ereignis (anderer Sensor) und ein altes gehören nicht dazu
    entry.runtime_data.events.events.insert(0, {"t": dt_util.utcnow().isoformat(), "kind": "monitor_out", "monitor": "Keller", "entity_id": HUM, "value": "80", "unit": "%"})
    entry.runtime_data.events.events.append({"t": (dt_util.utcnow() - timedelta(days=3)).isoformat(), "kind": "monitor_out", "monitor": "Alt", "entity_id": TEMP})
    again = (await _ask(client, 2, entity_id=TEMP, kind="value", hours=24))["result"]["events"]
    assert [e["rule"] for e in again] == ["Kühlschrank", "Kühlschrank"]
    week = (await _ask(client, 3, entity_id=TEMP, kind="value", hours=168))["result"]["events"]
    assert "Alt" in [e["rule"] for e in week]


async def test_only_sensors_the_monitoring_lists_are_served(hass: HomeAssistant, hass_ws_client, values) -> None:
    """Nie ein beliebiger Sensor: nicht gelistet oder Überwachung aus gibt "nicht gefunden"; der Befehl ist kein Zugang zum Verlauf von Home Assistant."""
    await _setup(hass, enabled=False)
    client = await hass_ws_client(hass)
    off = await _ask(client, 1, entity_id=TEMP, kind="value", hours=24)
    assert off["success"] is False and off["error"]["code"] == "not_found"


async def test_unlisted_measure_sensor_is_refused(hass: HomeAssistant, hass_ws_client, values) -> None:
    await _setup(hass, listed=False)
    hass.states.async_set(HUM, "50", {"unit_of_measurement": "%", "device_class": "humidity"})
    client = await hass_ws_client(hass)
    for mid, entity in enumerate((TEMP, HUM), start=1):
        reply = await _ask(client, mid, entity_id=entity, kind="value", hours=24)
        assert reply["success"] is False and reply["error"]["code"] == "not_found", entity


@pytest.mark.parametrize(("entity", "kind"), [(TEMP, "state"), (WINDOW, "value"), (DOOR, "value")])
async def test_kind_has_to_fit_the_sensor(hass: HomeAssistant, hass_ws_client, values, entity: str, kind: str) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    reply = await _ask(client, 1, entity_id=entity, kind=kind, hours=24)
    assert reply["success"] is False and reply["error"]["code"] == "invalid_format"


async def test_period_has_to_fit(hass: HomeAssistant, hass_ws_client, values) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    reply = await _ask(client, 1, entity_id=TEMP, kind="value", hours=8760)
    assert reply["success"] is False


async def test_monitor_events_carry_value_and_unit(hass: HomeAssistant, freezer) -> None:
    """Das Ereignis im Protokoll trägt Wert und Einheit (für die Sensoransicht); beim Ende der Regel der aktuelle Wert."""
    entry = await _setup(hass, monitors=[_rule(_value(TEMP, "above", 8), hold=1)])
    await set_temp(hass, "9")
    await tick(hass, freezer, 5)
    out = next(e for e in entry.runtime_data.events.events if e.get("kind") == "monitor_out")
    assert out["value"] == "9" and out["unit"] == "°C" and out["entity_id"] == TEMP
    await set_temp(hass, "5")
    await tick(hass, freezer, 5)
    back = next(e for e in entry.runtime_data.events.events if e.get("kind") == "monitor_ok")
    assert back["value"] == "5" and back["unit"] == "°C"
    await settle(hass)


async def test_battery_and_signal_of_a_measured_value(hass: HomeAssistant, hass_ws_client, values) -> None:
    """
    Ein Messwert hat wie ein Binärsensor die Reiter "Batterie" und "Empfang". Bis 1.59.0 lehnte der Server beide für jeden Messwert ab
    ("Kind does not fit the sensor", Meldung des Nutzers vom 2026-11-17 an einem Temperatursensor).
    """
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "kuehlschrank")})
    registry = er.async_get(hass)
    temp = registry.async_get_or_create("sensor", "test", "temp", device_id=device.id, original_device_class="temperature", suggested_object_id=TEMP.split(".")[1])
    assert temp.entity_id == TEMP
    battery = registry.async_get_or_create("sensor", "test", "bat", device_id=device.id, original_device_class="battery", suggested_object_id="kuehlschrank_batterie")
    signal = registry.async_get_or_create("sensor", "test", "rssi", device_id=device.id, original_device_class="signal_strength", suggested_object_id="kuehlschrank_rssi")
    await _setup(hass)
    client = await hass_ws_client(hass)
    reply = await _ask(client, 1, entity_id=TEMP, kind="battery", hours=720)
    assert reply["success"], reply
    assert reply["result"]["entity_id"] == battery.entity_id and reply["result"]["points"]
    reply = await _ask(client, 2, entity_id=TEMP, kind="signal", hours=24)
    assert reply["success"], reply
    assert reply["result"]["entity_id"] == signal.entity_id and reply["result"]["points"]
    # Weiterhin abgelehnt: der Zustandsverlauf eines Messwerts und der Werteverlauf eines Binärsensors
    assert (await _ask(client, 3, entity_id=TEMP, kind="state", hours=24))["error"]["code"] == "invalid_format"
    assert (await _ask(client, 4, entity_id=WINDOW, kind="value", hours=24))["error"]["code"] == "invalid_format"
    # Und nur für Messwerte, die eine Anlage in der Überwachung führt
    assert (await _ask(client, 5, entity_id=HUM, kind="battery", hours=720))["error"]["code"] == "not_found"
