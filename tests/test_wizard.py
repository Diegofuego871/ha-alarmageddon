"""
Einrichtungsassistent (1.69.0, Wunsch und Entscheide des Nutzers 2026-11-19, 20:43 und 21:05): je Anlage ein Zustand in den globalen Einstellungen.
Eine neue Anlage bekommt ihn von selbst, bestehende nach dem Update nicht; "später" gilt bis zum nächsten Tag (Ortszeit von Home Assistant), dann
erscheint er wieder genau beim Schritt, bei dem man aufgehört hat; "nicht mehr anzeigen" nur noch von Hand; eine Anlage aus einem Backup bekommt
ihn nicht. Der Befehl ändert nichts an der Anlage selbst.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.alarmageddon.const import DATA_SETTINGS, DOMAIN, SETTINGS_STORE_KEY
from custom_components.alarmageddon.settings import valid_wizard

from .conftest import setup_alarm
from .test_backup import WORKFLOW

_id = iter(range(1, 10000))


async def ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": next(_id), **msg})
    return await client.receive_json()


async def systems(client) -> dict[str, dict[str, Any]]:
    data = (await ws(client, type=f"{DOMAIN}/data"))["result"]
    return {s["title"]: s for s in data["systems"]}


def at(freezer, day: tuple[int, int, int], hour: int, minute: int = 0) -> None:
    freezer.move_to(dt_util.as_utc(datetime(*day, hour, minute, tzinfo=dt_util.get_default_time_zone())))


async def test_a_new_system_gets_the_wizard(hass: HomeAssistant, hass_ws_client) -> None:
    """Neue Installation (keine Ablage): die Anlage ist neu, der Assistent offen beim Willkommen."""
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await systems(client))["Haus"]["wizard"] == {"state": "open", "until": None, "step": "welcome", "due": True}


async def test_existing_systems_do_not_get_it_after_the_update(hass: HomeAssistant, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    """Update auf 1.69.0: die Ablage gibt es, aber ohne Assistent. Die bestehende Anlage ist eingerichtet; eine danach angelegte bekommt ihn."""
    hass_storage[SETTINGS_STORE_KEY] = {"version": 1, "minor_version": 1, "key": SETTINGS_STORE_KEY, "data": {"names_with_device": True}}
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await systems(client))["Haus"]["wizard"]["due"] is False
    assert (await systems(client))["Haus"]["wizard"]["state"] == "done"
    # Sofort festgehalten: auch nach einem Neustart zählt die neue Anlage nicht als bestehend
    assert "wizard" in hass_storage[SETTINGS_STORE_KEY]["data"]
    created = await ws(client, type=f"{DOMAIN}/create_system", name="Garage")
    assert created["success"], created
    await hass.async_block_till_done()
    found = await systems(client)
    assert found["Garage"]["wizard"]["due"] is True and found["Haus"]["wizard"]["due"] is False


async def test_later_returns_the_next_day_at_the_same_step(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    at(freezer, (2026, 11, 19), 21, 5)  # nach der Anmeldung (das Token gilt ab der echten Zeit)
    assert (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="step", step="zones"))["success"]
    answer = await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="later")
    assert answer["result"]["wizard"] == {"state": "later", "until": "2026-11-20", "step": "zones", "due": False}
    at(freezer, (2026, 11, 19), 23, 59)
    assert (await systems(client))["Haus"]["wizard"]["due"] is False
    at(freezer, (2026, 11, 20), 0, 1)
    wizard = (await systems(client))["Haus"]["wizard"]
    assert wizard["due"] is True and wizard["step"] == "zones"


async def test_hide_done_and_start(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    at(freezer, (2026, 11, 19), 21, 5)  # nach der Anmeldung (das Token gilt ab der echten Zeit)
    await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="step", step="actions")
    hidden = (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="hide"))["result"]["wizard"]
    assert hidden["due"] is False and hidden["step"] == "actions"
    at(freezer, (2026, 12, 24), 12)
    assert (await systems(client))["Haus"]["wizard"]["due"] is False  # nie wieder von selbst
    # Von Hand fortsetzen: genau dort
    started = (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="start", step="actions"))["result"]["wizard"]
    assert started == {"state": "open", "until": None, "step": "actions", "due": True}
    done = (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="done"))["result"]["wizard"]
    assert done == {"state": "done", "until": None, "step": "welcome", "due": False}
    # Neu starten ohne Schritt: am Anfang
    assert (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="start"))["result"]["wizard"]["step"] == "welcome"


async def test_the_command_checks_its_input_and_changes_nothing_else(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass, workflows=WORKFLOW)
    client = await hass_ws_client(hass)
    before = dict(entry.options)
    assert (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="step"))["error"]["code"] == "invalid_format"
    assert (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="step", step="nirgends"))["success"] is False
    assert (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="weg"))["success"] is False
    assert (await ws(client, type=f"{DOMAIN}/wizard", entry_id="fremd", action="later"))["error"]["code"] == "not_found"
    assert (await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="later"))["success"]
    await hass.async_block_till_done()
    assert dict(entry.options) == before


async def test_a_removed_system_takes_its_wizard_along(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await ws(client, type=f"{DOMAIN}/wizard", entry_id=entry.entry_id, action="later")
    assert entry.entry_id in hass.data[DATA_SETTINGS].data["wizard"]
    assert (await ws(client, type=f"{DOMAIN}/delete_system", entry_id=entry.entry_id, name="Haus"))["success"]
    await hass.async_block_till_done()
    assert entry.entry_id not in hass.data[DATA_SETTINGS].data["wizard"]


async def test_a_system_from_a_backup_does_not_get_it(hass: HomeAssistant, hass_ws_client) -> None:
    """Als neue Anlage wiederhergestellt: sie trägt die Einstellungen des Backups und braucht keine Einrichtung."""
    await setup_alarm(hass, workflows=WORKFLOW)
    client = await hass_ws_client(hass)
    data = (await ws(client, type=f"{DOMAIN}/export"))["result"]
    assert "wizard" not in str(data)  # Zustand der Oberfläche, nie im Backup
    result = await ws(client, type=f"{DOMAIN}/import", data=data, mapping=[{"index": 0, "target": "new", "name": "Ferienhaus"}])
    assert result["success"], result
    await hass.async_block_till_done()
    found = await systems(client)
    assert found["Ferienhaus"]["wizard"]["due"] is False and found["Haus"]["wizard"]["due"] is True


def test_damaged_values_fall_back() -> None:
    assert valid_wizard({"a": {"state": "irgendwas", "until": "kein Datum", "step": 7}, 5: {}, "b": "x", "c": {"state": "later", "until": "2026-11-20"}}) == {
        "a": {"state": "open", "until": None, "step": "welcome"}, "c": {"state": "later", "until": "2026-11-20", "step": "welcome"}}
    assert valid_wizard(None) == {} and valid_wizard([1]) == {}
