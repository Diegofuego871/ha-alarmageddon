"""
Deaktivieren im Alarm (1.78.0, Wunsch des Nutzers 2026-11-22): je Anlage "beendet den Alarm" (Standard, wie Home Assistant und HomeKit) oder
"quittiert nur" (der Alarm endet, die Anlage bleibt scharf; erst das nächste Deaktivieren schaltet ab).
"""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from custom_components.alarmageddon.const import DOMAIN
from custom_components.alarmageddon.schemas import SYSTEM_OPTIONS_SCHEMA

from .conftest import FRONT_DOOR, WINDOW, setup_alarm
from .test_acknowledge import SIREN_ON
from .test_actions import _setup_workflow
from .test_alarm import call, state
from .test_sensor_options import open_sensor

_ids = iter(range(1, 1000))


async def _alarm(hass: HomeAssistant, steps: list[dict], **overrides: Any):
    entry, services = await _setup_workflow(hass, steps, **overrides)
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    return entry, services


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": next(_ids), **msg})
    return await client.receive_json()


async def test_default_disarm_ends_the_alarm_and_switches_off(hass: HomeAssistant) -> None:
    entry, services = await _alarm(hass, [SIREN_ON])
    assert entry.runtime_data.controller.disarm_ends_alarm is True
    await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert len(services["switch.turn_off"]) == 1


async def test_disarm_only_acknowledges_when_the_option_is_off(hass: HomeAssistant) -> None:
    entry, services = await _alarm(hass, [SIREN_ON], disarm_ends_alarm=False)
    assert entry.runtime_data.controller.disarm_ends_alarm is False
    await call(hass, "alarm_disarm")
    await hass.async_block_till_done()
    # Der Alarm endet und die Gegenaktionen laufen, die Anlage bleibt im selben Modus scharf
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert len(services["switch.turn_off"]) == 1
    assert entry.runtime_data.workflow.running is None
    record = entry.runtime_data.recorder.recordings[0]
    assert record["end"] and record["reason"] == "acknowledged"
    # Das nächste Deaktivieren schaltet ab
    await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_a_new_trigger_alarms_again_after_acknowledging_by_disarm(hass: HomeAssistant) -> None:
    entry, _ = await _alarm(hass, [], disarm_ends_alarm=False)
    await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    await open_sensor(hass, WINDOW, "off")
    await open_sensor(hass, WINDOW)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert len(entry.runtime_data.recorder.recordings) == 2


@pytest.mark.parametrize("phase", ["armed", "pending", "manual"])
async def test_the_option_changes_nothing_outside_a_running_alarm_of_an_armed_system(hass: HomeAssistant, phase: str) -> None:
    await setup_alarm(hass, disarm_ends_alarm=False, entry_delay=30)
    if phase == "manual":
        await call(hass, "alarm_trigger")  # Alarm von Hand ohne Modus: nichts, was scharf bliebe
        assert state(hass) == AlarmControlPanelState.TRIGGERED
    else:
        await call(hass, "alarm_arm_home")
        if phase == "pending":
            await open_sensor(hass, FRONT_DOOR)
            assert state(hass) == AlarmControlPanelState.PENDING
    await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.DISARMED
    if phase == "manual":
        # Kein Quittieren: der Alarm von Hand endet als gewöhnliches Deaktivieren (nicht "acknowledged")
        entry = hass.config_entries.async_entries(DOMAIN)[0]
        records = entry.runtime_data.recorder.recordings
        assert records and all(r.get("reason") != "acknowledged" for r in records)


async def test_disarm_with_the_option_off_still_asks_for_the_code(hass: HomeAssistant, hass_ws_client) -> None:
    entry, _ = await _alarm(hass, [], disarm_ends_alarm=False)
    client = await hass_ws_client(hass)
    assert (await _ws(client, type=f"{DOMAIN}/add_code", entry_id=entry.entry_id, name="Anna", code="5678"))["success"]
    await hass.async_block_till_done()
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm", code="0000")
    assert state(hass) == AlarmControlPanelState.TRIGGERED  # ein falscher Code quittiert nie
    await call(hass, "alarm_disarm", code="5678")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_save_system_stores_and_reports_the_option(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, type=f"{DOMAIN}/data"))["result"]["systems"][0]["disarm_ends_alarm"] is True
    result = await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, disarm_ends_alarm=False)
    assert result["success"], result
    await hass.async_block_till_done()
    assert entry.options["disarm_ends_alarm"] is False
    assert (await _ws(client, type=f"{DOMAIN}/data"))["result"]["systems"][0]["disarm_ends_alarm"] is False
    for bad in ("nein", 3, None):
        assert not (await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, disarm_ends_alarm=bad))["success"]
    assert entry.options["disarm_ends_alarm"] is False


@pytest.mark.parametrize("value", [True, False])
def test_backups_carry_the_option_and_reject_other_values(value: bool) -> None:
    assert SYSTEM_OPTIONS_SCHEMA({"disarm_ends_alarm": value})["disarm_ends_alarm"] is value
    with pytest.raises(vol.Invalid):
        SYSTEM_OPTIONS_SCHEMA({"disarm_ends_alarm": "nein"})
    assert "disarm_ends_alarm" not in SYSTEM_OPTIONS_SCHEMA({})  # ältere Backups: Standard gilt


async def test_backup_keeps_the_option_and_brings_it_back(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, disarm_ends_alarm=False)
    await hass.async_block_till_done()
    exported = (await _ws(client, type=f"{DOMAIN}/export"))["result"]
    assert exported["systems"][0]["options"]["disarm_ends_alarm"] is False
    await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, disarm_ends_alarm=True)
    await hass.async_block_till_done()
    assert (await _ws(client, type=f"{DOMAIN}/import", data=exported))["success"]
    await hass.async_block_till_done()
    assert entry.options["disarm_ends_alarm"] is False
