"""1.93.0: Anlage im Panel auf Werkseinstellungen zurücksetzen (Befehl reset_system): nur deaktiviert, alle Optionen wie bei einer neuen Anlage,
Assistent wieder offen, Name und Protokoll bleiben, auf Wunsch vorher ein Backup."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant

from custom_components.alarmageddon.config_flow import default_options
from custom_components.alarmageddon.const import CONF_ACCENT, CONF_CODES, DOMAIN
from custom_components.alarmageddon.settings import async_get_settings

from .conftest import setup_alarm
from .test_alarm import call, state
from .test_delete_system import _make

_ids = iter(range(1, 1000))


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": next(_ids), **msg})
    return await client.receive_json()


async def _reset(client, entry, **extra: Any) -> dict[str, Any]:
    return await _ws(client, type=f"{DOMAIN}/reset_system", entry_id=entry.entry_id, **extra)


async def test_reset_restores_factory_options(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_ACCENT: "pink", CONF_CODES: [{"name": "A", "hash": "x", "salt": "y"}]})
    await hass.async_block_till_done()
    assert entry.options[CONF_ACCENT] == "pink" and entry.options["zone_home"]
    client = await hass_ws_client(hass)
    result = await _reset(client, entry)
    assert result["success"], result
    await hass.async_block_till_done()
    # Genau die Optionen einer neuen Anlage: keine Sensoren, kein Code, keine Farbe
    assert dict(entry.options) == default_options()
    assert entry.title == "Haus" and hass.states.get("alarm_control_panel.haus") is not None
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_reset_starts_the_wizard_again(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    settings = await async_get_settings(hass)
    await settings.async_set_wizard(entry.entry_id, "done")
    assert settings.wizard_payload(entry.entry_id)["state"] == "done"
    client = await hass_ws_client(hass)
    assert (await _reset(client, entry))["success"]
    assert settings.wizard_payload(entry.entry_id)["state"] == "open"


@pytest.mark.parametrize("wanted", ["armed_home", "armed_away", "arming", "pending", "triggered"])
async def test_reset_refused_unless_disarmed(hass: HomeAssistant, hass_ws_client, freezer, wanted: str) -> None:
    """Eine scharfe Anlage, eine in der Verzögerung und eine im Alarm verliert nie still ihre Sensoren und Codes."""
    entry = await setup_alarm(hass)
    before = dict(entry.options)
    client = await hass_ws_client(hass)
    await _make(hass, freezer, wanted)
    result = await _reset(client, entry, backup_name="x")
    assert result["success"] is False and result["error"]["code"] == "not_disarmed", result
    assert dict(entry.options) == before and state(hass) == wanted
    # Kein Backup eines abgelehnten Zurücksetzens
    assert (await _ws(client, type=f"{DOMAIN}/backups"))["result"]["backups"] == []
    await call(hass, "alarm_disarm")
    assert (await _reset(client, entry))["success"]


async def test_reset_with_backup_keeps_the_old_settings(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    zones = list(entry.options["zone_home"])
    client = await hass_ws_client(hass)
    assert (await _reset(client, entry, backup_name="Vor Reset · 28.11.2026"))["success"]
    await hass.async_block_till_done()
    backups = (await _ws(client, type=f"{DOMAIN}/backups"))["result"]["backups"]
    assert [b["name"] for b in backups] == ["Vor Reset · 28.11.2026"]
    assert entry.options["zone_home"] == []
    # Das Backup trägt noch die alten Sensoren: mit "Wiederherstellen" ist alles zurück
    full = (await _ws(client, type=f"{DOMAIN}/backup_get", backup_id=backups[0]["id"]))["result"]
    assert full["systems"][0]["options"]["zone_home"] == zones


async def test_reset_without_backup_creates_none(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await _reset(client, entry))["success"]
    assert (await _ws(client, type=f"{DOMAIN}/backups"))["result"]["backups"] == []


async def test_reset_leaves_other_systems_alone(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    created = await _ws(client, type=f"{DOMAIN}/create_system", name="Garage")
    garage = hass.config_entries.async_get_entry(created["result"]["entry_id"])
    hass.config_entries.async_update_entry(garage, options={**garage.options, CONF_ACCENT: "teal"})
    await hass.async_block_till_done()
    assert (await _reset(client, entry))["success"]
    await hass.async_block_till_done()
    assert garage.options[CONF_ACCENT] == "teal"
