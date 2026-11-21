"""1.75.0: Akzentfarbe je Anlage (Wunsch des Nutzers 2026-11-21): speichern, beim Anlegen wählen, im Backup, nur bekannte Farben."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant

from custom_components.alarmageddon.const import ACCENTS, DOMAIN

from .conftest import setup_alarm

_ids = iter(range(1, 1000))


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": next(_ids), **msg})
    return await client.receive_json()


async def _data(client) -> dict[str, Any]:
    return (await _ws(client, type=f"{DOMAIN}/data"))["result"]


async def test_accent_defaults_to_the_home_assistant_colour(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await _data(client))["systems"][0]["accent"] == "ha"


@pytest.mark.parametrize("accent", [a for a in ACCENTS if a != "ha"])
async def test_save_system_stores_each_accent(hass: HomeAssistant, hass_ws_client, accent: str) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, accent=accent)
    assert result["success"], result
    await hass.async_block_till_done()
    assert entry.options["accent"] == accent
    assert (await _data(client))["systems"][0]["accent"] == accent


async def test_save_system_rejects_unknown_colours(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    for bad in ("magenta", "#ff0000", "", 5, "red; background:url(x)"):
        result = await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, accent=bad)
        assert not result["success"], bad
    assert "accent" not in entry.options


async def test_accent_is_per_system(hass: HomeAssistant, hass_ws_client) -> None:
    first = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    created = await _ws(client, type=f"{DOMAIN}/create_system", name="Garage", accent="green")
    assert created["success"], created
    second = hass.config_entries.async_get_entry(created["result"]["entry_id"])
    await hass.async_block_till_done()
    assert second.options["accent"] == "green" and "accent" not in first.options
    colours = {s["title"]: s["accent"] for s in (await _data(client))["systems"]}
    assert colours == {"Haus": "ha", "Garage": "green"}


async def test_create_system_without_or_with_default_accent_stores_nothing(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    for name, extra in (("Eins", {}), ("Zwei", {"accent": "ha"})):
        created = await _ws(client, type=f"{DOMAIN}/create_system", name=name, **extra)
        assert created["success"], created
        assert "accent" not in hass.config_entries.async_get_entry(created["result"]["entry_id"]).options
    bad = await _ws(client, type=f"{DOMAIN}/create_system", name="Drei", accent="nope")
    assert not bad["success"]
    assert sorted(e.title for e in hass.config_entries.async_entries(DOMAIN)) == ["Eins", "Haus", "Zwei"]


async def test_accent_is_in_the_backup_and_comes_back(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, accent="indigo")
    await hass.async_block_till_done()
    exported = (await _ws(client, type=f"{DOMAIN}/export"))["result"]
    assert exported["systems"][0]["options"]["accent"] == "indigo"
    await _ws(client, type=f"{DOMAIN}/save_system", entry_id=entry.entry_id, accent="red")
    await hass.async_block_till_done()
    result = await _ws(client, type=f"{DOMAIN}/import", data=exported)
    assert result["success"], result
    await hass.async_block_till_done()
    assert entry.options["accent"] == "indigo"
    # Eine unbekannte Farbe in einer Datei wird abgelehnt
    exported["systems"][0]["options"]["accent"] = "magenta"
    assert not (await _ws(client, type=f"{DOMAIN}/import", data=exported, dry_run=True))["success"]
