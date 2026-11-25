"""
Nachalarm pro Modus (1.89.0, Wunsch des Nutzers 2026-11-25): Schalter "Einstellungen pro Modus" wie bei den Zeiten, Standard aus. An: je Auslöser des
Alarms (Anwesend, Abwesend, Nacht und "Immer aktiv", Entscheid des Nutzers: eigener Reiter wie bei den Aktionen) ein eigener Nachalarm (an/aus,
Höchstzahl 1 bis 10).

Zusagen:
- Aus (Standard, auch ohne gespeicherten Wert): es gilt der gemeinsame Nachalarm wie in 1.87.0; eigene Werte je Auslöser sind ohne Wirkung.
- An: der eigene Wert des Auslösers des laufenden Alarms gilt, auch "aus", wenn der gemeinsame an ist; fehlt ein eigener Wert, gilt der gemeinsame.
- Ein Alarm eines immer aktiven Sensors nimmt den Wert von "Immer aktiv".
- Panel (save_system, data) und Backup prüfen streng: nur die vier Auslöser, nur "enabled" (Wahrheitswert) und "count" (1 bis 10).
"""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.alarmageddon.backup import FORMAT, VERSION, validate
from custom_components.alarmageddon.const import DOMAIN

from .conftest import FRONT_DOOR, WINDOW, setup_alarm
from .test_alarm import advance, state
from .test_review_1_87 import SIREN, SMOKE, _alarm_done, _events, _set

SMOKE_2 = "binary_sensor.rauchmelder_keller"
ON = {"enabled": True, "count": 1}
OFF = {"enabled": False, "count": 3}


async def _again(hass: HomeAssistant) -> None:
    await _set(hass, FRONT_DOOR, "on")


async def test_off_by_default_the_common_setting_applies(hass: HomeAssistant, hass_ws_client) -> None:
    """Ohne den Schalter: eigene Werte je Auslöser wirken nicht, der gemeinsame (aus) gilt."""
    entry, _, siren = await _alarm_done(hass, hass_ws_client, realarm_scopes={"home": {"enabled": True, "count": 2}})
    assert "realarm_per_mode" not in entry.options
    await _again(hass)
    assert len(siren) == 1 and not _events(entry, "realarm")


async def test_own_setting_of_the_mode_applies(hass: HomeAssistant, hass_ws_client) -> None:
    entry, _, siren = await _alarm_done(hass, hass_ws_client, realarm_per_mode=True, realarm_scopes={"home": ON, "away": OFF})
    await _again(hass)
    assert len(siren) == 2, "Nachalarm im Modus Anwesend"
    await _set(hass, WINDOW, "off")
    await _set(hass, WINDOW, "on")
    assert len(siren) == 2, "Höchstzahl des Modus (1)"
    assert [e["count"] for e in _events(entry, "realarm")] == [1]


async def test_own_off_wins_over_the_common_on(hass: HomeAssistant, hass_ws_client) -> None:
    entry, _, siren = await _alarm_done(hass, hass_ws_client, realarm_enabled=True, realarm_per_mode=True, realarm_scopes={"home": OFF})
    await _again(hass)
    assert len(siren) == 1 and not _events(entry, "realarm")


async def test_missing_own_value_falls_back_to_the_common(hass: HomeAssistant, hass_ws_client) -> None:
    entry, _, siren = await _alarm_done(hass, hass_ws_client, realarm_enabled=True, realarm_count=1, realarm_per_mode=True, realarm_scopes={"away": OFF})
    await _again(hass)
    assert len(siren) == 2 and len(_events(entry, "realarm")) == 1


@pytest.mark.parametrize(("own", "expected"), [(ON, 2), (OFF, 1)], ids=["immer_aktiv_an", "immer_aktiv_aus"])
async def test_alarm_of_an_always_active_sensor_takes_always(hass: HomeAssistant, own: dict[str, Any], expected: int) -> None:
    """Rauch bei deaktivierter Anlage: es gilt "Immer aktiv", nicht der Modus (der Modus Anwesend hätte den Nachalarm an)."""
    async_mock_service(hass, "notify", "handy")
    siren = async_mock_service(hass, "switch", "turn_on")
    for entity in (SMOKE, SMOKE_2):
        hass.states.async_set(entity, "off", {"device_class": "smoke"})
    await setup_alarm(hass, sensor_options={SMOKE: {"always": True}, SMOKE_2: {"always": True}}, realarm_per_mode=True,
                      realarm_scopes={"always": own, "home": ON}, workflows={"always": [{"type": "action", "action": "switch.turn_on", "target": [SIREN]}]})
    await _set(hass, SMOKE, "on")
    assert state(hass) == AlarmControlPanelState.TRIGGERED and len(siren) == 1
    await _set(hass, SMOKE_2, "on")
    assert len(siren) == expected


async def test_panel_saves_and_reports_it(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass, realarm_enabled=True, realarm_count=4)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/data"})
    data = (await client.receive_json())["result"]["systems"][0]
    assert data["realarm_per_mode"] is False
    assert data["realarm_scopes"] == {scope: {"enabled": True, "count": 4} for scope in ("home", "away", "night", "always")}, "ohne eigenen Wert der gemeinsame"
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "realarm_per_mode": True,
                                    "realarm_scopes": {"home": ON, "always": {"enabled": True, "count": 10}}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    entry = hass.config_entries.async_get_entry(entry.entry_id)
    assert entry.options["realarm_per_mode"] is True
    assert entry.options["realarm_scopes"] == {"home": ON, "always": {"enabled": True, "count": 10}}
    # Nur genannte Auslöser werden ersetzt
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "realarm_scopes": {"away": OFF}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    entry = hass.config_entries.async_get_entry(entry.entry_id)
    assert entry.options["realarm_scopes"] == {"home": ON, "always": {"enabled": True, "count": 10}, "away": OFF}
    await client.send_json_auto_id({"type": f"{DOMAIN}/data"})
    data = (await client.receive_json())["result"]["systems"][0]
    assert data["realarm_per_mode"] is True and data["realarm_scopes"]["night"] == {"enabled": True, "count": 4}
    assert data["realarm_scopes"]["away"] == OFF


@pytest.mark.parametrize("bad", [
    {"garage": ON},
    {"home": {"enabled": True, "count": 0}},
    {"home": {"enabled": True, "count": 11}},
    {"home": {"enabled": "ja", "count": 3}},
    {"home": {"enabled": True, "count": True}},
    {"home": {"enabled": True}},
    {"home": {"enabled": True, "count": 3, "extra": 1}},
    {"home": "an"},
    ["home"],
], ids=["fremder_ausloeser", "null", "elf", "text", "wahrheitswert_als_zahl", "ohne_zahl", "zusatz", "kein_wörterbuch", "liste"])
async def test_bad_values_are_refused(hass: HomeAssistant, hass_ws_client, bad: Any) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "realarm_scopes": bad})
    assert not (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "realarm_per_mode": "ja"})
    assert not (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert "realarm_scopes" not in entry.options and "realarm_per_mode" not in entry.options


def test_it_is_part_of_the_backup(hass: HomeAssistant) -> None:
    backup = {"format": FORMAT, "version": VERSION, "systems": [{"title": "Haus", "options": {"realarm_per_mode": True, "realarm_scopes": {"night": ON}}}]}
    restored = validate(backup, hass)["systems"][0]["options"]
    assert restored["realarm_per_mode"] is True and restored["realarm_scopes"] == {"night": ON}
    for bad in ({"garage": ON}, {"night": {"enabled": True, "count": 0}}, {"night": {"enabled": True, "count": 3, "x": 1}}):
        backup["systems"][0]["options"]["realarm_scopes"] = bad
        with pytest.raises(vol.Invalid):
            validate(backup, hass)


async def test_damaged_stored_values_never_break_the_alarm(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    """Ein beschädigter eigener Wert (von Hand in die Ablage geschrieben): die Höchstzahl bleibt im Bereich, der Alarm läuft weiter."""
    entry, _, siren = await _alarm_done(hass, hass_ws_client, realarm_per_mode=True, realarm_scopes={"home": {"enabled": True, "count": 99}})
    for _ in range(12):
        await _set(hass, FRONT_DOOR, "off")
        await _set(hass, FRONT_DOOR, "on")
        await advance(hass, freezer, 301)
    assert len(_events(entry, "realarm")) == 10, "höchstens 10"
    assert state(hass) == AlarmControlPanelState.TRIGGERED
