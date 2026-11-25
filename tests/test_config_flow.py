"""Einrichtung und Optionen."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

import pytest
import voluptuous as vol

from custom_components.alarmageddon.const import DOMAIN

from .conftest import FRONT_DOOR, MOTION, WINDOW, setup_alarm


async def _create(hass: HomeAssistant, **data):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    return await hass.config_entries.flow.async_configure(result["flow_id"], data)


async def test_create_alarm_system(hass: HomeAssistant) -> None:
    result = await _create(hass, name="Haus", night_enabled=True)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Haus"
    options = result["options"]
    assert options["night_enabled"] is True
    # Seit 1.90.0 ohne Code: es gibt keinen Hauptcode mehr, Codes pro Person entstehen nur im Panel
    assert not {"code_hash", "code_salt", "codes"} & set(options)
    await hass.async_block_till_done()
    assert hass.states.get("alarm_control_panel.haus") is not None
    assert hass.states.get("alarm_control_panel.haus").attributes["code_format"] is None


async def test_several_entries_but_unique_names(hass: HomeAssistant) -> None:
    """
    Mehrere Anlagen, aber nie zwei mit demselben Namen. Wie im Panel (1.63.0): ohne Gross-/Kleinschreibung und ohne doppelte Leerzeichen;
    der Dialog zeigt den Fehler beim Namen (bis 1.62.0 brach er bei genau gleichem Namen ab, "haus" neben "Haus" ging durch).
    """
    assert (await _create(hass, name="Haus"))["type"] is FlowResultType.CREATE_ENTRY
    assert (await _create(hass, name="Garage"))["type"] is FlowResultType.CREATE_ENTRY
    for taken in ("Haus", "haus", "  HAUS "):
        result = await _create(hass, name=taken)
        assert result["type"] is FlowResultType.FORM and result["errors"] == {"name": "name_taken"}, (taken, result)
    result = await _create(hass, name="  Haus   Ost ")
    assert result["type"] is FlowResultType.CREATE_ENTRY and result["title"] == "Haus Ost"
    assert [e.title for e in hass.config_entries.async_entries(DOMAIN)] == ["Haus", "Garage", "Haus Ost"]


async def test_empty_name_is_refused(hass: HomeAssistant) -> None:
    result = await _create(hass, name="   ")
    assert result["type"] is FlowResultType.FORM and result["errors"] == {"name": "name_required"}


async def test_setup_has_no_code_field(hass: HomeAssistant) -> None:
    """
    Seit 1.90.0 (Entscheid des Nutzers 2026-11-25: Hauptcode abschaffen) fragt die Einrichtung nicht mehr nach einem Code. Ein Code im Aufruf
    (alte Automatisierung, altes Skript) wird abgelehnt und legt nie einen Hauptcode an.
    """
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert [str(k) for k in result["data_schema"].schema] == ["name", "night_enabled"]
    with pytest.raises(vol.Invalid):
        await hass.config_entries.flow.async_configure(result["flow_id"], {"name": "Haus", "code": "2468"})
    assert not hass.config_entries.async_entries(DOMAIN)


def _sections(**changes):
    data = {
        "zones": {"zone_home": [FRONT_DOOR, WINDOW], "zone_away": [FRONT_DOOR, WINDOW, MOTION], "zone_night": []},
        "delays": {
            "exit_delay_home": 0.0,
            "exit_delay_away": 45.0,
            "exit_delay_night": 0.0,
            "entry_delay": 25.0,
            "entry_sensors": [FRONT_DOOR],
        },
        "behaviour": {"night_enabled": False, "code_arm_required": False},
    }
    for key, value in changes.items():
        data[key] = {**data[key], **value}
    return data


async def test_options(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(result["flow_id"], _sections())
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["zone_away"] == [FRONT_DOOR, WINDOW, MOTION]
    # Ganze Zahlen, wie später das Panel sie schreibt
    assert entry.options["exit_delay_away"] == 45 and isinstance(entry.options["exit_delay_away"], int)
    assert "open_sensors" not in entry.options


async def test_options_entry_sensor_must_be_in_zone(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], _sections(delays={"entry_sensors": [MOTION]}, zones={"zone_away": [FRONT_DOOR]})
    )
    assert result["errors"] == {"base": "entry_not_in_zone"}


async def test_options_dialog_has_no_code_section(hass: HomeAssistant) -> None:
    """Seit 1.90.0 setzt der Optionsdialog keinen Code mehr; ein Abschnitt "Code" im Aufruf wird abgelehnt und ändert nichts."""
    entry = await setup_alarm(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert [str(k) for k in result["data_schema"].schema] == ["zones", "delays", "behaviour"]
    with pytest.raises(vol.Invalid):
        await hass.config_entries.options.async_configure(result["flow_id"], {**_sections(), "code_section": {"code": "13579"}})
    assert not {"code_hash", "code_salt"} & set(entry.options) and not entry.options.get("codes")


async def test_options_arm_code_needs_code(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], _sections(behaviour={"code_arm_required": True})
    )
    assert result["errors"] == {"base": "code_missing"}


@pytest.mark.parametrize(
    "codes",
    [[{"id": "a", "name": "Ohne Hash", "user_id": None, "salt": "00ff"}], [{"id": "b", "name": "Ohne Salz", "user_id": None, "hash": "00ff"}], ["kein Eintrag"]],
    ids=["ohne_hash", "ohne_salz", "kein_eintrag"],
)
@pytest.mark.parametrize("switch", ["code_arm_required", "code_ack_required"])
async def test_options_code_switches_need_a_complete_code(hass: HomeAssistant, codes: list, switch: str) -> None:
    """Seit 1.90.0 zählt wie beim Entfernen nur ein vollständiger Code (bis 1.89.x genügte irgendein Eintrag in der Liste)."""
    entry = await setup_alarm(hass, codes=codes)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], _sections(behaviour={switch: True}))
    assert result["errors"] == {"base": "code_missing"}
    assert entry.options.get(switch) is not True


async def test_options_arm_code_with_a_personal_code(hass: HomeAssistant, hass_ws_client) -> None:
    """Mit einem Code pro Person (seit 1.90.0 die einzigen Codes) lässt der Dialog "Code zum Scharfschalten" einschalten."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "alarmageddon/add_code", "entry_id": entry.entry_id, "name": "Anna", "code": "5678"})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], _sections(behaviour={"code_arm_required": True}))
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["code_arm_required"] is True and [c["name"] for c in entry.options["codes"]] == ["Anna"]
