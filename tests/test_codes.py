"""Mehrere Codes pro Person (0.5.0): "geändert von" mit dem Namen, Codes nie im Klartext, eindeutige Codes."""

from __future__ import annotations

import json

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import Context, HomeAssistant
from homeassistant.exceptions import ServiceValidationError
import pytest

from custom_components.alarmageddon.code import hash_code

from .conftest import ALARM, setup_alarm
from .test_alarm import call, state

_id = iter(range(1, 1000))


async def _ws(client, **msg):
    await client.send_json({"id": next(_id), **msg})
    return await client.receive_json()


async def _with_codes(hass: HomeAssistant, hass_ws_client, main: bool = True):
    extra = {}
    if main:
        extra["code_hash"], extra["code_salt"] = hash_code("1234")
    entry = await setup_alarm(hass, exit_delay_away=0, **extra)
    client = await hass_ws_client(hass)
    return entry, client


async def test_personal_code_sets_changed_by(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    entry, client = await _with_codes(hass, hass_ws_client)
    result = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678")
    assert result["success"], result
    await hass.async_block_till_done()
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm", code="5678")
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert hass.states.get(ALARM).attributes["changed_by"] == "Anna"
    # Der Hauptcode gilt weiter
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm", code="1234")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_code_never_stored_or_returned_in_clear(hass: HomeAssistant, hass_ws_client) -> None:
    entry, client = await _with_codes(hass, hass_ws_client)
    await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678")
    await hass.async_block_till_done()
    # Hash und Salz sind Hexwerte und können "5678" zufällig enthalten: sie zählen nicht mit
    def strip(value):
        if isinstance(value, dict):
            return {k: strip(v) for k, v in value.items() if k not in ("hash", "salt", "code_hash", "code_salt")}
        return [strip(v) for v in value] if isinstance(value, list) else value
    assert "5678" not in json.dumps(strip(dict(entry.options)))
    assert all(c["hash"] != "5678" and c["salt"] != "5678" for c in entry.options["codes"])
    data = await _ws(client, type="alarmageddon/data")
    system = data["result"]["systems"][0]
    assert system["codes"] == [{"id": system["codes"][0]["id"], "name": "Anna", "user_id": None}]
    assert "hash" not in json.dumps(data["result"]) and "salt" not in json.dumps(data["result"])
    assert system["main_code"] is True and system["has_code"] is True


async def test_add_code_validation(hass: HomeAssistant, hass_ws_client) -> None:
    entry, client = await _with_codes(hass, hass_ws_client)
    bad = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="12a4")
    assert bad["error"]["code"] == "invalid_code_format"
    # Gleicher Code wie der Hauptcode: "geändert von" wäre nicht eindeutig
    same = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="1234")
    assert same["error"]["code"] == "code_taken"
    ok = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678")
    assert ok["success"]
    await hass.async_block_till_done()
    name = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="anna", code="9999")
    assert name["error"]["code"] == "name_taken"


async def test_wrong_code_counts_for_lockout(hass: HomeAssistant, hass_ws_client) -> None:
    entry, client = await _with_codes(hass, hass_ws_client)
    await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678")
    await hass.async_block_till_done()
    await call(hass, "alarm_arm_away")
    for _ in range(5):
        with pytest.raises(ServiceValidationError):
            await call(hass, "alarm_disarm", code="0000")
    # Gesperrt: auch der richtige persönliche Code geht eine Minute nicht
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_disarm", code="5678")
    assert err.value.translation_key == "code_locked"
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_personal_code_without_main_code(hass: HomeAssistant, hass_ws_client) -> None:
    entry, client = await _with_codes(hass, hass_ws_client, main=False)
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm")  # ohne Code geht es noch
    await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678")
    await hass.async_block_till_done()
    assert hass.states.get(ALARM).attributes["code_format"] == "number"
    await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm")
    await call(hass, "alarm_disarm", code="5678")
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_remove_code(hass: HomeAssistant, hass_ws_client) -> None:
    entry, client = await _with_codes(hass, hass_ws_client, main=False)
    added = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678")
    await hass.async_block_till_done()
    hass.config_entries.async_update_entry(entry, options={**entry.options, "code_arm_required": True})
    await hass.async_block_till_done()
    removed = await _ws(client, type="alarmageddon/remove_code", entry_id=entry.entry_id, code_id=added["result"]["id"])
    assert removed["success"]
    await hass.async_block_till_done()
    assert entry.options["codes"] == []
    # Ohne jeden Code kann "Code zum Scharfschalten" nicht gelten
    assert entry.options["code_arm_required"] is False
    assert hass.states.get(ALARM).attributes["code_format"] is None


async def test_linked_user_name_without_code(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    """Mit einem HA-Benutzer verknüpft: Schaltet dieser Benutzer ohne Code scharf, steht der Name der Person da."""
    entry, client = await _with_codes(hass, hass_ws_client, main=False)
    result = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678", user_id=hass_admin_user.id)
    assert result["success"], result
    await hass.async_block_till_done()
    await hass.services.async_call("alarm_control_panel", "alarm_arm_away", {"entity_id": ALARM}, blocking=True,
                                   context=Context(user_id=hass_admin_user.id))
    await hass.async_block_till_done()
    assert hass.states.get(ALARM).attributes["changed_by"] == "Anna"
    # Derselbe Benutzer kann nicht zwei Codes haben
    again = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Bert", code="1357", user_id=hass_admin_user.id)
    assert again["error"]["code"] == "user_taken"


async def test_users_listed_for_linking(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    entry, client = await _with_codes(hass, hass_ws_client)
    data = await _ws(client, type="alarmageddon/data")
    assert any(u["id"] == hass_admin_user.id for u in data["result"]["users"])


# ----- Code bearbeiten (1.63.0): Name, Benutzer und, wenn angegeben, ein neuer Code -----


async def _two_codes(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    """Hauptcode 1234, Anna 5678 (mit dem Administrator verknüpft), Bert 1357."""
    entry, client = await _with_codes(hass, hass_ws_client)
    anna = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Anna", code="5678", user_id=hass_admin_user.id)
    await hass.async_block_till_done()
    bert = await _ws(client, type="alarmageddon/add_code", entry_id=entry.entry_id, name="Bert", code="1357")
    await hass.async_block_till_done()
    return entry, client, anna["result"]["id"], bert["result"]["id"]


def _code(entry, code_id: str) -> dict:
    return next(c for c in entry.options["codes"] if c["id"] == code_id)


async def test_update_code_without_code_keeps_the_code(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    """Leeres Codefeld: Name und Benutzer ändern sich, der bisherige Code (nur sein Hash ist gespeichert) gilt weiter."""
    entry, client, anna, _bert = await _two_codes(hass, hass_ws_client, hass_admin_user)
    before = _code(entry, anna)
    for empty in ({}, {"code": ""}, {"code": None}, {"code": "   "}):
        result = await _ws(client, type="alarmageddon/update_code", entry_id=entry.entry_id, code_id=anna, name="Anna Muster", user_id=hass_admin_user.id, **empty)
        assert result["success"], (empty, result)
        await hass.async_block_till_done()
        after = _code(entry, anna)
        assert (after["hash"], after["salt"], after["name"], after["user_id"]) == (before["hash"], before["salt"], "Anna Muster", hass_admin_user.id)
    # Unverändert: Home Assistant lädt die Anlage nicht neu
    assert result["result"] == {"ok": True, "reload": False}
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm", code="5678")
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert hass.states.get(ALARM).attributes["changed_by"] == "Anna Muster"
    # Die Reihenfolge der Codes bleibt
    assert [c["name"] for c in entry.options["codes"]] == ["Anna Muster", "Bert"]


async def test_update_code_with_a_new_code_replaces_the_old_one(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    """Neuer Code: nur noch er gilt; gespeichert sind ein neuer Hash und ein neues Salz, nie der Klartext; die Antwort nennt nichts davon."""
    entry, client, anna, _bert = await _two_codes(hass, hass_ws_client, hass_admin_user)
    before = _code(entry, anna)
    result = await _ws(client, type="alarmageddon/update_code", entry_id=entry.entry_id, code_id=anna, name="Anna", code=" 24680 ", user_id=hass_admin_user.id)
    assert result["success"] and result["result"] == {"ok": True, "reload": True}, result
    await hass.async_block_till_done()
    after = _code(entry, anna)
    assert after["hash"] != before["hash"] and after["salt"] != before["salt"] and after["id"] == anna
    assert "24680" not in json.dumps({k: v for k, v in after.items() if k not in ("hash", "salt")})
    await call(hass, "alarm_arm_away")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_disarm", code="5678")
    await call(hass, "alarm_disarm", code="24680")
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert hass.states.get(ALARM).attributes["changed_by"] == "Anna"
    # Der eigene bisherige Code ist kein "vergebener" Code
    again = await _ws(client, type="alarmageddon/update_code", entry_id=entry.entry_id, code_id=anna, name="Anna", code="24680", user_id=hass_admin_user.id)
    assert again["success"], again


async def test_update_code_validation(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    """Dieselben Regeln wie beim Anlegen; ein abgelehnter Wunsch ändert nichts."""
    entry, client, anna, bert = await _two_codes(hass, hass_ws_client, hass_admin_user)
    before = [dict(c) for c in entry.options["codes"]]
    base = {"type": "alarmageddon/update_code", "entry_id": entry.entry_id, "code_id": bert, "name": "Bert"}
    cases = (
        ({"code": "12a4"}, "invalid_code_format"),
        ({"code": "123"}, "invalid_code_format"),
        ({"code": "123456789"}, "invalid_code_format"),
        ({"code": "5678"}, "code_taken"),  # Annas Code
        ({"code": "1234"}, "code_taken"),  # Hauptcode
        ({"name": "anna"}, "name_taken"),
        ({"user_id": hass_admin_user.id}, "user_taken"),  # schon mit Anna verknüpft
        ({"user_id": "gibt-es-nicht"}, "user_taken"),
        ({"code_id": "gibt-es-nicht"}, "not_found"),
    )
    for change, error in cases:
        result = await _ws(client, **{**base, **change})
        assert result["success"] is False and result["error"]["code"] == error, (change, result)
    await hass.async_block_till_done()
    assert entry.options["codes"] == before
    # Eigener Name in anderer Schreibweise und eigener Benutzer sind erlaubt; Benutzer lösen geht auch
    ok = await _ws(client, type="alarmageddon/update_code", entry_id=entry.entry_id, code_id=anna, name="ANNA", user_id=hass_admin_user.id)
    assert ok["success"], ok
    await hass.async_block_till_done()
    unlinked = await _ws(client, type="alarmageddon/update_code", entry_id=entry.entry_id, code_id=anna, name="ANNA", user_id=None)
    assert unlinked["success"], unlinked
    await hass.async_block_till_done()
    assert _code(entry, anna)["user_id"] is None and _code(entry, anna)["name"] == "ANNA"
    # Danach ist der Benutzer frei für Bert
    moved = await _ws(client, **{**base, "user_id": hass_admin_user.id})
    assert moved["success"], moved
    await hass.async_block_till_done()
    assert _code(entry, bert)["user_id"] == hass_admin_user.id


async def test_update_code_keeps_a_linked_user_that_no_longer_exists(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    """Gibt es den verknüpften Benutzer in Home Assistant nicht mehr, lässt sich der Eintrag trotzdem umbenennen (sonst wäre er gesperrt)."""
    entry, client, anna, _bert = await _two_codes(hass, hass_ws_client, hass_admin_user)
    codes = [{**c, "user_id": "geloescht"} if c["id"] == anna else c for c in entry.options["codes"]]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "codes": codes})
    await hass.async_block_till_done()
    result = await _ws(client, type="alarmageddon/update_code", entry_id=entry.entry_id, code_id=anna, name="Anna B.", user_id="geloescht")
    assert result["success"], result
    await hass.async_block_till_done()
    assert _code(entry, anna)["name"] == "Anna B."


async def _both(client, first: dict, second: dict) -> dict[int, dict]:
    """Zwei Befehle ohne Warten auf die erste Antwort (wie ein Doppelklick): die Antworten nach ihrer Kennung."""
    ids = (next(_id), next(_id))
    await client.send_json({"id": ids[0], **first})
    await client.send_json({"id": ids[1], **second})
    replies = [await client.receive_json(), await client.receive_json()]
    by_id = {r["id"]: r for r in replies}
    return {0: by_id[ids[0]], 1: by_id[ids[1]]}


async def test_double_click_adds_the_code_only_once(hass: HomeAssistant, hass_ws_client) -> None:
    """
    Doppelklick auf "Speichern" (1.63.0, Code-Review): zweimal derselbe Code mit demselben Namen. Bis 1.62.0 lag zwischen Prüfen und
    Schreiben das Hashen im Executor, ohne Sperre: beide Aufrufe prüften die Liste ohne den neuen Code, "Anna" stand zweimal mit demselben
    Code da. Jetzt gilt der erste, der zweite meldet "Name vergeben".
    """
    entry, client = await _with_codes(hass, hass_ws_client)
    add = {"type": "alarmageddon/add_code", "entry_id": entry.entry_id, "name": "Anna", "code": "5678"}
    replies = await _both(client, add, add)
    await hass.async_block_till_done()
    assert replies[0]["success"], replies
    assert replies[1]["success"] is False and replies[1]["error"]["code"] == "name_taken", replies
    assert [c["name"] for c in entry.options["codes"]] == ["Anna"]
    # Zwei Namen, derselbe Code zur selben Zeit: der zweite ist vergeben ("geändert von" bliebe sonst nicht eindeutig)
    other = await _both(client, {**add, "name": "Bert", "code": "2468"}, {**add, "name": "Carla", "code": "2468"})
    await hass.async_block_till_done()
    assert other[0]["success"] and other[1]["error"]["code"] == "code_taken", other
    assert [c["name"] for c in entry.options["codes"]] == ["Anna", "Bert"]


async def test_editing_and_removing_at_the_same_time_lose_nothing(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    """
    Bearbeiten (mit neuem Code) und Entfernen zur selben Zeit (1.63.0): das Bearbeiten las die Liste vor dem Hashen und schrieb sie danach
    zurück, ein inzwischen entfernter Code stand wieder da. Unter der Sperre der Anlage gelten beide Änderungen.
    """
    entry, client, anna, bert = await _two_codes(hass, hass_ws_client, hass_admin_user)
    replies = await _both(
        client,
        {"type": "alarmageddon/update_code", "entry_id": entry.entry_id, "code_id": anna, "name": "Anna", "code": "13579", "user_id": hass_admin_user.id},
        {"type": "alarmageddon/remove_code", "entry_id": entry.entry_id, "code_id": bert},
    )
    await hass.async_block_till_done()
    assert replies[0]["success"] and replies[1]["success"], replies
    assert [c["id"] for c in entry.options["codes"]] == [anna]
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_disarm", code="13579")
    assert state(hass) == AlarmControlPanelState.DISARMED
