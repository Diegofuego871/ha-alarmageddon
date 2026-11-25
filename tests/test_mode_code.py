"""
"Moduswechsel verlangt den Code" (1.88.0, Wunsch des Nutzers 2026-11-24): seit 1.87.0 verlangt der Wechsel des Modus einer scharfen Anlage den Code;
seit 1.88.0 lässt sich das je Anlage abschalten.

Zusagen:
- Standard an, auch ohne gespeicherten Wert (bestehende Anlagen behalten den Schutz aus 1.87.0); ein beschädigter Wert lässt ihn an.
- Aus: der Wechsel verlangt den Code nur, wenn auch das Scharfschalten ihn verlangt (wie bis 1.86.x).
- Ohne Code wirkungslos; der Wert bleibt gespeichert und gilt, sobald ein Code dazukommt.
- Einstellbar im Panel (save_system), im Optionsdialog von Home Assistant, Teil des Backups; die Entität nennt den wirksamen Wert (Dashboard-Karte).
"""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.alarmageddon.backup import FORMAT, VERSION, validate
from custom_components.alarmageddon.code import hash_code
from custom_components.alarmageddon.const import DOMAIN

from .conftest import ALARM, FRONT_DOOR, MOTION, WINDOW, options, setup_alarm
from .test_alarm import call, settle, state
from .test_config_flow import _sections


async def _with_code(hass: HomeAssistant, **overrides: Any) -> MockConfigEntry:
    code_hash, salt = hash_code("1234")
    return await setup_alarm(hass, code_hash=code_hash, code_salt=salt, exit_delay_away=0, exit_delay_home=0, **overrides)


async def test_default_is_on_without_a_stored_value(hass: HomeAssistant) -> None:
    """Eine Anlage aus 1.87.0 (oder älter) hat den Wert nicht gespeichert: der Schutz bleibt an."""
    code_hash, salt = hash_code("1234")
    stored = options(code_hash=code_hash, code_salt=salt, exit_delay_away=0, exit_delay_home=0)
    stored.pop("code_mode_required", None)
    for entity in (FRONT_DOOR, WINDOW, MOTION):
        hass.states.async_set(entity, "off")
    entry = MockConfigEntry(domain=DOMAIN, title="Haus", data={"name": "Haus"}, options=stored)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await settle(hass)
    assert "code_mode_required" not in entry.options
    await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_arm_home")
    assert err.value.translation_key == "code_mode_change"
    assert hass.states.get(ALARM).attributes["code_mode_required"] is True


async def test_off_switches_modes_without_the_code(hass: HomeAssistant) -> None:
    """Aus: wie bis 1.86.x. Ohne "Code zum Scharfschalten" geht der Wechsel ohne Code, auch während der Ausgangsverzögerung."""
    await _with_code(hass, code_mode_required=False)
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_arm_home")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert hass.states.get(ALARM).attributes["code_mode_required"] is False
    # Deaktivieren verlangt den Code weiterhin
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_off_still_follows_code_to_arm(hass: HomeAssistant) -> None:
    """Aus, aber "Code zum Scharfschalten" an: der Wechsel ist ein Scharfschalten und verlangt den Code (richtiger Code geht)."""
    await _with_code(hass, code_mode_required=False, code_arm_required=True)
    await call(hass, "alarm_arm_away", code="1234")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_home")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_home", code="9999")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await call(hass, "alarm_arm_home", code="1234")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


@pytest.mark.parametrize("value", ["nein", 0, None, "false"], ids=["text", "null_zahl", "none", "text_false"])
async def test_a_damaged_value_keeps_the_protection(hass: HomeAssistant, value: Any) -> None:
    """Nur der gespeicherte Wert False schaltet ab: was ein Fehler oder eine fremde Hand hineinschreibt, schwächt den Schutz nie."""
    await _with_code(hass, code_mode_required=value)
    await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_home")


async def test_without_a_code_it_has_no_effect(hass: HomeAssistant) -> None:
    await setup_alarm(hass, exit_delay_away=0, exit_delay_home=0, code_mode_required=True)
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_arm_home")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert hass.states.get(ALARM).attributes["code_mode_required"] is False, "die Entität nennt den wirksamen Wert"


async def test_panel_saves_and_reports_it(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _with_code(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/data"})
    data = (await client.receive_json())["result"]["systems"][0]
    assert data["code_mode_required"] is True
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "code_mode_required": False})
    assert (await client.receive_json())["success"]
    await settle(hass)
    entry = hass.config_entries.async_get_entry(entry.entry_id)
    assert entry.options["code_mode_required"] is False
    await client.send_json_auto_id({"type": f"{DOMAIN}/data"})
    assert (await client.receive_json())["result"]["systems"][0]["code_mode_required"] is False
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "code_mode_required": "aus"})
    assert not (await client.receive_json())["success"], "nur ein Wahrheitswert"


async def test_options_dialog_has_it(hass: HomeAssistant) -> None:
    entry = await _with_code(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], _sections(behaviour={"code_mode_required": False}))
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["code_mode_required"] is False
    await settle(hass)
    # Ohne Angabe (älteres Formular) bleibt der Standard an
    result = await hass.config_entries.options.async_init(entry.entry_id)
    schema = result["data_schema"].schema
    behaviour = next(v for k, v in schema.items() if str(k) == "behaviour").schema.schema
    assert any(str(k) == "code_mode_required" for k in behaviour)


def test_it_is_part_of_the_backup(hass: HomeAssistant) -> None:
    backup = {"format": FORMAT, "version": VERSION, "systems": [{"title": "Haus", "options": {"code_mode_required": False}}]}
    assert validate(backup, hass)["systems"][0]["options"]["code_mode_required"] is False
    backup["systems"][0]["options"]["code_mode_required"] = "aus"
    with pytest.raises(vol.Invalid):
        validate(backup, hass)
