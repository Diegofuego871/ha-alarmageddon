"""1.79.0: die Einstellung "Deaktivieren im Alarm" aus 1.78.0 entfiel; Deaktivieren beendet den Alarm immer. Reste aus 1.78.0 stören nicht."""

from __future__ import annotations

from typing import Any

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant

from custom_components.alarmageddon.const import DOMAIN

from .conftest import WINDOW, setup_alarm
from .test_alarm import call, state
from .test_sensor_options import open_sensor

_ids = iter(range(1, 1000))


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": next(_ids), **msg})
    return await client.receive_json()


async def test_a_leftover_option_from_1_78_0_is_dropped_and_disarm_ends_the_alarm(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass, disarm_ends_alarm=False)
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert "disarm_ends_alarm" not in entry.options
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_a_backup_from_1_78_0_still_imports_and_drops_the_option(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    exported = (await _ws(client, type=f"{DOMAIN}/export"))["result"]
    exported["systems"][0]["options"]["disarm_ends_alarm"] = False
    assert (await _ws(client, type=f"{DOMAIN}/import", data=exported))["success"]
    await hass.async_block_till_done()
    assert "disarm_ends_alarm" not in entry.options
    assert "disarm_ends_alarm" not in (await _ws(client, type=f"{DOMAIN}/export"))["result"]["systems"][0]["options"]
