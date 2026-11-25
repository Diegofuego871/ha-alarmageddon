"""
Hauptcode und "Scharfschalten verlangt den Code" im Panel (1.89.0, Wunsch des Nutzers 2026-11-25: alles, was der Optionsdialog von Home Assistant
einstellt, auch im Panel).

Zusagen:
- set_main_code: 4 bis 8 Ziffern, nie derselbe Code wie ein persönlicher, sofort als Hash gespeichert, die Antwort nennt weder Code noch Hash
  noch Salz. Ändern ersetzt den bisherigen Hauptcode (der alte gilt danach nicht mehr). Unter der Sperre der Codes: ein gleichzeitiges
  add_code mit demselben Code kann nicht beide durchlassen.
- remove_main_code: entfernt Hash und Salz. Bleibt kein Code, entfallen "Scharfschalten verlangt den Code" und "Quittieren verlangt den Code"
  (wie remove_code); gibt es noch Codes pro Person, bleiben beide, wie sie sind. Ohne Hauptcode: not_found, nichts ändert sich.
- save_system nimmt code_arm_required an (nur ein Wahrheitswert); an ohne Code lehnt es mit code_missing ab und speichert nichts.
- Nur für Administratoren und nur für geladene Anlagen dieser Integration (test_security, COMMANDS).
"""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from custom_components.alarmageddon.code import hash_code
from custom_components.alarmageddon.const import DOMAIN

from .conftest import setup_alarm
from .test_alarm import call, settle, state


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def _system(client) -> dict[str, Any]:
    return (await _ws(client, type=f"{DOMAIN}/data"))["result"]["systems"][0]


async def test_set_a_main_code_without_any_code(hass: HomeAssistant, hass_ws_client) -> None:
    """Ohne Code festlegen: danach verlangt Deaktivieren den Hauptcode, das Panel sieht "Hauptcode festgelegt"."""
    entry = await setup_alarm(hass, exit_delay_away=0)
    client = await hass_ws_client(hass)
    assert (await _system(client))["main_code"] is False
    answer = await _ws(client, type=f"{DOMAIN}/set_main_code", entry_id=entry.entry_id, code=" 4826 ")
    assert answer["success"], answer
    assert answer["result"] == {"ok": True, "reload": True}
    await settle(hass)
    assert entry.options.get("code_hash") and entry.options.get("code_salt")
    data = await _system(client)
    assert data["main_code"] is True and data["has_code"] is True
    await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm", code="9999")
    await call(hass, "alarm_disarm", code="4826")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_change_replaces_the_old_main_code(hass: HomeAssistant, hass_ws_client) -> None:
    code_hash, salt = hash_code("1234")
    entry = await setup_alarm(hass, code_hash=code_hash, code_salt=salt, exit_delay_away=0)
    client = await hass_ws_client(hass)
    assert (await _ws(client, type=f"{DOMAIN}/set_main_code", entry_id=entry.entry_id, code="97531"))["success"]
    await settle(hass)
    assert entry.options["code_hash"] != code_hash and entry.options["code_salt"] != salt
    await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm", code="1234")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await call(hass, "alarm_disarm", code="97531")
    assert state(hass) == AlarmControlPanelState.DISARMED


@pytest.mark.parametrize("code", ["123", "123456789", "12a4", "", "    ", "12 34", "-1234"])
async def test_a_bad_format_is_refused_and_nothing_changes(hass: HomeAssistant, hass_ws_client, code: str) -> None:
    code_hash, salt = hash_code("1234")
    entry = await setup_alarm(hass, code_hash=code_hash, code_salt=salt)
    client = await hass_ws_client(hass)
    answer = await _ws(client, type=f"{DOMAIN}/set_main_code", entry_id=entry.entry_id, code=code)
    assert not answer["success"] and answer["error"]["code"] == "invalid_code_format"
    await settle(hass)
    assert (entry.options["code_hash"], entry.options["code_salt"]) == (code_hash, salt)


async def test_never_the_same_code_as_a_personal_one(hass: HomeAssistant, hass_ws_client) -> None:
    """Wie im Optionsdialog: sonst wäre "geändert von" leer, obwohl die Person ihren Code getippt hat."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, type=f"{DOMAIN}/add_code", entry_id=entry.entry_id, name="Anna", code="2468"))["success"]
    await settle(hass)
    answer = await _ws(client, type=f"{DOMAIN}/set_main_code", entry_id=entry.entry_id, code="2468")
    assert not answer["success"] and answer["error"]["code"] == "code_taken"
    await settle(hass)
    assert "code_hash" not in entry.options
    # Ein anderer Code geht
    assert (await _ws(client, type=f"{DOMAIN}/set_main_code", entry_id=entry.entry_id, code="13579"))["success"]


async def test_main_code_and_personal_code_at_the_same_time(hass: HomeAssistant, hass_ws_client) -> None:
    """Hauptcode und ein persönlicher Code mit demselben Code gleichzeitig: höchstens einer kommt durch (Sperre der Codes)."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/set_main_code", "entry_id": entry.entry_id, "code": "5317"})
    await client.send_json_auto_id({"type": f"{DOMAIN}/add_code", "entry_id": entry.entry_id, "name": "Anna", "code": "5317"})
    answers = [await client.receive_json(), await client.receive_json()]
    await settle(hass)
    assert sorted(a["success"] for a in answers) == [False, True], answers
    assert next(a for a in answers if not a["success"])["error"]["code"] == "code_taken"
    assert bool(entry.options.get("code_hash")) != bool(entry.options.get("codes")), "genau einer von beiden ist gespeichert"


async def test_settings_saved_meanwhile_are_kept(hass: HomeAssistant, hass_ws_client) -> None:
    """Während der Hash gerechnet wird, speichert das Panel die Seite: beides bleibt erhalten."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/set_main_code", "entry_id": entry.entry_id, "code": "86420"})
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "realarm_enabled": True})
    answers = [await client.receive_json(), await client.receive_json()]
    await settle(hass)
    assert all(a["success"] for a in answers), answers
    assert entry.options.get("code_hash") and entry.options["realarm_enabled"] is True


async def test_remove_the_last_code_drops_the_switches(hass: HomeAssistant, hass_ws_client) -> None:
    """Ohne Code verlangt die Anlage nichts mehr: "Scharfschalten" und "Quittieren verlangt den Code" fallen weg (wie remove_code)."""
    code_hash, salt = hash_code("1234")
    entry = await setup_alarm(hass, code_hash=code_hash, code_salt=salt, code_arm_required=True, code_ack_required=True, exit_delay_away=0)
    client = await hass_ws_client(hass)
    answer = await _ws(client, type=f"{DOMAIN}/remove_main_code", entry_id=entry.entry_id)
    assert answer["success"] and answer["result"] == {"ok": True, "reload": True}
    await settle(hass)
    assert "code_hash" not in entry.options and "code_salt" not in entry.options
    assert entry.options["code_arm_required"] is False and entry.options["code_ack_required"] is False
    data = await _system(client)
    assert data["main_code"] is False and data["has_code"] is False and data["code_arm_required"] is False
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_remove_keeps_the_switches_while_personal_codes_remain(hass: HomeAssistant, hass_ws_client) -> None:
    code_hash, salt = hash_code("1234")
    entry = await setup_alarm(hass, code_hash=code_hash, code_salt=salt, code_arm_required=True, code_ack_required=True, exit_delay_away=0)
    client = await hass_ws_client(hass)
    assert (await _ws(client, type=f"{DOMAIN}/add_code", entry_id=entry.entry_id, name="Anna", code="2468"))["success"]
    await settle(hass)
    assert (await _ws(client, type=f"{DOMAIN}/remove_main_code", entry_id=entry.entry_id))["success"]
    await settle(hass)
    assert "code_hash" not in entry.options
    assert entry.options["code_arm_required"] is True and entry.options["code_ack_required"] is True
    # Der Hauptcode gilt nicht mehr, der persönliche schon; Scharfschalten verlangt weiter einen Code
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_away", code="1234")
    await call(hass, "alarm_arm_away", code="2468")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_remove_without_a_main_code_changes_nothing(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    before = dict(entry.options)
    answer = await _ws(client, type=f"{DOMAIN}/remove_main_code", entry_id=entry.entry_id)
    assert not answer["success"] and answer["error"]["code"] == "not_found"
    await settle(hass)
    assert dict(entry.options) == before


async def test_code_to_arm_from_the_panel(hass: HomeAssistant, hass_ws_client) -> None:
    """save_system: "Scharfschalten verlangt den Code" an und aus; an ohne Code wird abgelehnt."""
    entry = await setup_alarm(hass, exit_delay_away=0)
    client = await hass_ws_client(hass)
    answer = await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, code_arm_required=True)
    assert not answer["success"] and answer["error"]["code"] == "code_missing"
    await settle(hass)
    assert entry.options["code_arm_required"] is False
    assert (await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, code_arm_required="ja"))["success"] is False
    assert (await _ws(client, type=f"{DOMAIN}/set_main_code", entry_id=entry.entry_id, code="4826"))["success"]
    await settle(hass)
    assert (await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, code_arm_required=True))["success"]
    await settle(hass)
    assert entry.options["code_arm_required"] is True and (await _system(client))["code_arm_required"] is True
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_away")
    await call(hass, "alarm_arm_away", code="4826")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await call(hass, "alarm_disarm", code="4826")
    assert (await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, code_arm_required=False))["success"]
    await settle(hass)
    assert entry.options["code_arm_required"] is False
    await call(hass, "alarm_arm_away")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_two_changes_in_a_row_the_last_one_counts(hass: HomeAssistant, hass_ws_client) -> None:
    """Zwei Änderungen kurz hintereinander (die zweite wartet auf die Sperre, die Anlage lädt dazwischen neu): es gilt die letzte."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/set_main_code", "entry_id": entry.entry_id, "code": "1111"})
    await client.send_json_auto_id({"type": f"{DOMAIN}/set_main_code", "entry_id": entry.entry_id, "code": "2222"})
    answers = [await client.receive_json(), await client.receive_json()]
    await settle(hass)
    assert all(a["success"] for a in answers), answers
    await call(hass, "alarm_arm_home")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm", code="1111")
    await call(hass, "alarm_disarm", code="2222")
    assert state(hass) == AlarmControlPanelState.DISARMED
