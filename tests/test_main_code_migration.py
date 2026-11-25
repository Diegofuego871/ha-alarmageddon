"""
Hauptcode abgeschafft (1.90.0; Frage des Nutzers 2026-11-25 "Wieso braucht es den Hauptcode überhaupt?", Entscheid "Abschaffen").

Bis 1.89.x hatte eine Anlage neben den Codes pro Person einen Hauptcode (`code_hash`, `code_salt`) ohne Person. Zusagen:
- Beim Laden wird ein Hauptcode einmal zu einem Code pro Person "Hauptcode" ("Main code") ohne Benutzer, mit demselben Hash und Salz: wer ihn
  kennt, schaltet unverändert weiter; "geändert von" nennt jetzt den Namen. `code_hash` und `code_salt` sind danach weg.
- Der Name folgt der Sprache von Home Assistant und ist nie doppelt ("Main code 2", wie add_code ohne Gross-/Kleinschreibung).
- Die übrigen Codes bleiben, wie sie sind. Ein unvollständiger Hauptcode (Hash ohne Salz oder umgekehrt) galt nie und fällt weg.
- Die Schalter "Scharfschalten" und "Quittieren verlangt den Code" bleiben, wie sie waren (es gibt ja weiter einen Code).
- Die Übertragung läuft einmal; die Höchstzahl der Codes hält sie nicht auf (danach erst wieder hinzufügen, wenn einer entfernt ist).
- Panel und Server kennen keinen Hauptcode mehr: kein `main_code` in den Daten, keine Befehle `set_main_code`/`remove_main_code`.
- save_system nimmt "Scharfschalten verlangt den Code" nur mit einem Code an (bis 1.89.x in test_main_code_panel.py mit dem Hauptcode geprüft).
"""

from __future__ import annotations

import logging
from typing import Any

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from custom_components.alarmageddon.code import hash_code
from custom_components.alarmageddon.const import DOMAIN, MAX_CODES

from .conftest import ALARM, setup_alarm
from .test_alarm import call, settle, state


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def _system(client) -> dict[str, Any]:
    return (await _ws(client, type=f"{DOMAIN}/data"))["result"]["systems"][0]


def _legacy(code: str = "1234") -> dict[str, str]:
    code_hash, salt = hash_code(code)
    return {"code_hash": code_hash, "code_salt": salt}


def _personal(name: str, code: str, user_id: str | None = None, code_id: str | None = None) -> dict[str, Any]:
    code_hash, salt = hash_code(code)
    return {"id": code_id or f"id_{name}", "name": name, "user_id": user_id, "hash": code_hash, "salt": salt}


async def test_the_main_code_becomes_a_code_per_person(hass: HomeAssistant, hass_ws_client, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    legacy = _legacy("739158")
    entry = await setup_alarm(hass, exit_delay_away=0, **legacy)
    assert "code_hash" not in entry.options and "code_salt" not in entry.options
    [code] = entry.options["codes"]
    assert set(code) == {"id", "name", "user_id", "hash", "salt"}
    assert (code["name"], code["user_id"], code["hash"], code["salt"]) == ("Main code", None, legacy["code_hash"], legacy["code_salt"])
    assert len(code["id"]) == 12 and int(code["id"], 16) >= 0
    # Derselbe Code schaltet weiter, "geändert von" nennt jetzt den Namen
    await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm")
    await call(hass, "alarm_disarm", code="739158")
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert hass.states.get(ALARM).attributes["changed_by"] == "Main code"
    # Das Panel sieht einen Code wie jeden anderen und keinen Hauptcode
    client = await hass_ws_client(hass)
    system = await _system(client)
    assert system["codes"] == [{"id": code["id"], "name": "Main code", "user_id": None}]
    assert system["has_code"] is True and "main_code" not in system
    # Weder Code noch Hash noch Salz im Log (Umstellung, Schalten, Abruf)
    assert not any(secret in caplog.text for secret in ("739158", legacy["code_hash"], legacy["code_salt"]))


@pytest.mark.parametrize(("language", "name"), [("de", "Hauptcode"), ("de-CH", "Hauptcode"), ("en", "Main code"), ("fr", "Main code")])
async def test_the_name_follows_the_language(hass: HomeAssistant, language: str, name: str) -> None:
    hass.config.language = language
    entry = await setup_alarm(hass, **_legacy())
    assert [c["name"] for c in entry.options["codes"]] == [name]


async def test_the_name_is_never_taken_twice(hass: HomeAssistant) -> None:
    """Wie add_code: zwei Codes mit demselben Namen (ohne Gross-/Kleinschreibung) gibt es nie, sonst wäre "geändert von" nicht eindeutig."""
    taken = [_personal("main code", "5678"), _personal("Main code 2", "2468")]
    entry = await setup_alarm(hass, exit_delay_away=0, codes=taken, **_legacy("1357"))
    assert [c["name"] for c in entry.options["codes"]] == ["main code", "Main code 2", "Main code 3"]
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm", code="1357")
    assert hass.states.get(ALARM).attributes["changed_by"] == "Main code 3"


async def test_the_other_codes_stay_as_they_are(hass: HomeAssistant, hass_admin_user) -> None:
    anna = _personal("Anna", "5678", user_id=hass_admin_user.id, code_id="aaa")
    bert = _personal("Bert", "2468", code_id="bbb")
    entry = await setup_alarm(hass, exit_delay_away=0, codes=[anna, bert], **_legacy("1234"))
    assert entry.options["codes"][:2] == [anna, bert]
    assert [c["name"] for c in entry.options["codes"]] == ["Anna", "Bert", "Main code"]
    for code, who in (("5678", "Anna"), ("2468", "Bert"), ("1234", "Main code")):
        await call(hass, "alarm_arm_away")
        await call(hass, "alarm_disarm", code=code)
        assert state(hass) == AlarmControlPanelState.DISARMED and hass.states.get(ALARM).attributes["changed_by"] == who


@pytest.mark.parametrize("broken", [{"code_hash": "abcd"}, {"code_salt": "00"}, {"code_hash": "", "code_salt": ""}, {"code_hash": None, "code_salt": "00"},
                                    {"code_hash": "kein-hex", "code_salt": "zz"}, {"code_hash": "abc", "code_salt": "00"}],
                         ids=["ohne_salz", "ohne_hash", "leer", "kein_text", "kein_hex", "ungerade_laenge"])
async def test_an_incomplete_main_code_is_dropped(hass: HomeAssistant, broken: dict[str, Any]) -> None:
    """
    Ein Hauptcode ohne Hash oder Salz oder mit einem Wert, der kein Hex ist, passte nie (bis 1.89.x übersprang ihn die Prüfung): er wird kein
    Code, die Schlüssel verschwinden.
    """
    anna = _personal("Anna", "5678")
    entry = await setup_alarm(hass, exit_delay_away=0, codes=[anna], **broken)
    assert not {"code_hash", "code_salt"} & set(entry.options)
    assert entry.options["codes"] == [anna]
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm", code="5678")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_damaged_codes_are_replaced_by_the_main_code(hass: HomeAssistant) -> None:
    """Eine beschädigte Liste der Codes (kein Liste) galt nie; der Hauptcode wird dann der einzige Code."""
    entry = await setup_alarm(hass, exit_delay_away=0, codes="kaputt", **_legacy("1234"))
    assert [c["name"] for c in entry.options["codes"]] == ["Main code"]
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm", code="1234")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_the_switches_stay_as_they_were(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass, exit_delay_away=0, code_arm_required=True, code_ack_required=True, **_legacy("1234"))
    assert entry.options["code_arm_required"] is True and entry.options["code_ack_required"] is True
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_away")
    await call(hass, "alarm_arm_away", code="1234")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_it_runs_once(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass, **_legacy())
    first = [dict(c) for c in entry.options["codes"]]
    assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    assert entry.options["codes"] == first and len(first) == 1


async def test_the_maximum_does_not_stop_it(hass: HomeAssistant, hass_ws_client) -> None:
    """20 Codes pro Person und ein Hauptcode: es werden 21; ein weiterer Code geht erst, wenn einer entfernt ist."""
    codes = [_personal(f"P{i}", f"{1000 + i * 7}") for i in range(MAX_CODES)]
    entry = await setup_alarm(hass, codes=codes, **_legacy("9876"))
    assert len(entry.options["codes"]) == MAX_CODES + 1 and entry.options["codes"][-1]["name"] == "Main code"
    client = await hass_ws_client(hass)
    full = await _ws(client, type=f"{DOMAIN}/add_code", entry_id=entry.entry_id, name="Neu", code="13579")
    assert full["success"] is False and full["error"]["code"] == "too_many"


async def test_the_main_code_commands_are_gone(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    for msg in ({"type": f"{DOMAIN}/set_main_code", "code": "4826"}, {"type": f"{DOMAIN}/remove_main_code"}):
        answer = await _ws(client, entry_id=entry.entry_id, **msg)
        assert answer["success"] is False and answer["error"]["code"] == "unknown_command", answer
    await settle(hass)
    assert not {"code_hash", "code_salt"} & set(entry.options) and not entry.options.get("codes")


async def test_removing_the_last_complete_code_drops_the_switches(hass: HomeAssistant, hass_ws_client) -> None:
    """
    Wie bisher: ohne Code verlangt die Anlage nichts mehr. Seit 1.90.0 zählt dafür nur ein vollständiger Code pro Person (es gibt keinen Hauptcode
    mehr, der bliebe); ein beschädigter Eintrag in der Liste hält die Schalter nicht an.
    """
    damaged = {"id": "kaputt", "name": "Kaputt", "user_id": None, "hash": "", "salt": ""}
    entry = await setup_alarm(hass, exit_delay_away=0, codes=[damaged], code_arm_required=True, code_ack_required=True, **_legacy("1234"))
    client = await hass_ws_client(hass)
    main = next(c["id"] for c in entry.options["codes"] if c["name"] == "Main code")
    assert (await _ws(client, type=f"{DOMAIN}/remove_code", entry_id=entry.entry_id, code_id=main))["success"]
    await settle(hass)
    assert entry.options["code_arm_required"] is False and entry.options["code_ack_required"] is False
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_code_to_arm_from_the_panel(hass: HomeAssistant, hass_ws_client) -> None:
    """save_system: "Scharfschalten verlangt den Code" an und aus; an ohne Code wird abgelehnt (seit 1.89.0, seit 1.90.0 mit einem Code pro Person)."""
    entry = await setup_alarm(hass, exit_delay_away=0)
    client = await hass_ws_client(hass)
    answer = await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, code_arm_required=True)
    assert not answer["success"] and answer["error"]["code"] == "code_missing"
    await settle(hass)
    assert entry.options["code_arm_required"] is False
    assert (await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, code_arm_required="ja"))["success"] is False
    assert (await _ws(client, type=f"{DOMAIN}/add_code", entry_id=entry.entry_id, name="Anna", code="4826"))["success"]
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
