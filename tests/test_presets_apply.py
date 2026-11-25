"""
Voreinstellungen gezielt auf Sensoren anwenden (1.91.0, Wunsch des Nutzers 2026-11-25, Mockup docs/mockups/voreinstellungen-anwenden-v1, Variante A).

`save_presets` nimmt neben den Sensorarten (`reset_sensors`, bis 1.90.0 der Schalter "Auf alle Sensoren anwenden") eine Liste gewählter Sensoren je
Anlage (`reset_entities`). Zusagen:
- Nur die gewählten Sensoren der genannten Anlage verlieren ihre eigenen Werte (gemeinsam und je Modus); derselbe Sensor in einer anderen Anlage und
  alle übrigen Sensoren behalten sie.
- Die eigene Eingangsverzögerung und "Immer aktiv ignorieren" gehören nicht zu den Voreinstellungen und bleiben.
- Nur geladene Anlagen dieser Integration; eine unbekannte oder nicht geladene Anlage lehnt den ganzen Aufruf ab, bevor sich etwas ändert (auch die
  Voreinstellungen bleiben).
- Ein gewählter Sensor ohne eigene Werte zählt nicht (nichts zu löschen), der Aufruf gelingt.
- Nur Binärsensoren als Kennung; jede betroffene Anlage lädt genau einmal neu.
"""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant

from custom_components.alarmageddon.const import DOMAIN

from .conftest import FRONT_DOOR, MOTION, WINDOW, setup_alarm
from .test_sensor_options import SMOKE, _classes


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def test_only_the_chosen_sensors_take_the_presets(hass: HomeAssistant, hass_ws_client) -> None:
    _classes(hass)
    haus = await setup_alarm(
        hass, "Haus", exit_delay_away=0, per_mode_sensors=True,
        sensor_options={FRONT_DOOR: {"arm_on_close": False, "entry_delay": 45}, WINDOW: {"open_ok": True}, MOTION: {"confirm": True}, SMOKE: {"report_only": True}},
        sensor_modes={"away": {WINDOW: {"reachable": False}, MOTION: {"always_off": False, "confirm": True}}},
    )
    garage = await setup_alarm(hass, "Garage", exit_delay_away=0, sensor_options={WINDOW: {"open_ok": True}})
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/save_presets", presets={}, reset_entities={haus.entry_id: [FRONT_DOOR, WINDOW, MOTION]})
    assert result["success"] and result["result"]["reset"] == 3
    await hass.async_block_till_done()
    # Haustür: nur die eigene Eingangsverzögerung bleibt; Fenster: gemeinsam und je Modus weg; Bewegung: "Immer aktiv ignorieren" bleibt je Modus
    assert haus.options["sensor_options"] == {FRONT_DOOR: {"entry_delay": 45}, SMOKE: {"report_only": True}}
    assert haus.options["sensor_modes"] == {"away": {MOTION: {"always_off": False}}}
    # Derselbe Sensor in der anderen Anlage behält seinen Wert
    assert garage.options["sensor_options"] == {WINDOW: {"open_ok": True}}
    ctl = haus.runtime_data.controller
    assert ctl.option(WINDOW, "open_ok") is False and ctl.option(FRONT_DOOR, "arm_on_close") is True and ctl.option(SMOKE, "report_only") is True


async def test_an_unknown_or_unloaded_system_changes_nothing(hass: HomeAssistant, hass_ws_client) -> None:
    _classes(hass)
    haus = await setup_alarm(hass, "Haus", sensor_options={WINDOW: {"open_ok": True}})
    garage = await setup_alarm(hass, "Garage", sensor_options={WINDOW: {"open_ok": True}})
    client = await hass_ws_client(hass)
    for entry_id in ("unbekannt", garage.entry_id):
        if entry_id == garage.entry_id:
            assert await hass.config_entries.async_unload(garage.entry_id)
            await hass.async_block_till_done()
            assert garage.state is ConfigEntryState.NOT_LOADED
        result = await _ws(client, type=f"{DOMAIN}/save_presets", presets={"window": ["confirm"]}, reset_entities={haus.entry_id: [WINDOW], entry_id: [WINDOW]})
        assert result["error"]["code"] == "not_found"
        await hass.async_block_till_done()
        assert haus.options["sensor_options"] == {WINDOW: {"open_ok": True}} and garage.options["sensor_options"] == {WINDOW: {"open_ok": True}}
        # Auch die Voreinstellungen bleiben (geprüft wird vor dem Speichern)
        assert (await _ws(client, type=f"{DOMAIN}/data"))["result"]["presets"]["window"] == ["reachable"]


async def test_a_chosen_sensor_without_own_values_counts_nothing(hass: HomeAssistant, hass_ws_client) -> None:
    _classes(hass)
    haus = await setup_alarm(hass, "Haus", sensor_options={WINDOW: {"open_ok": True}})
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/save_presets", presets={}, reset_entities={haus.entry_id: [MOTION]})
    assert result["success"] and result["result"]["reset"] == 0
    await hass.async_block_till_done()
    assert haus.options["sensor_options"] == {WINDOW: {"open_ok": True}}


@pytest.mark.parametrize("bad", [{"x": ["light.flur"]}, {"x": ["binary_sensor.Gross"]}, {"x": "binary_sensor.fenster"}, ["binary_sensor.fenster"]], ids=["andere_domaene", "gross", "keine_liste", "ohne_anlage"])
async def test_only_binary_sensors_per_system(hass: HomeAssistant, hass_ws_client, bad: Any) -> None:
    haus = await setup_alarm(hass, "Haus", sensor_options={WINDOW: {"open_ok": True}})
    client = await hass_ws_client(hass)
    if isinstance(bad, dict):
        bad = {haus.entry_id: next(iter(bad.values()))}
    result = await _ws(client, type=f"{DOMAIN}/save_presets", presets={}, reset_entities=bad)
    assert not result["success"]
    await hass.async_block_till_done()
    assert haus.options["sensor_options"] == {WINDOW: {"open_ok": True}}


async def test_each_system_reloads_once(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    """Voreinstellungen und gewählte Sensoren in einem Aufruf: jede betroffene Anlage lädt genau einmal neu, die übrigen über die Voreinstellungen."""
    _classes(hass)
    haus = await setup_alarm(hass, "Haus", sensor_options={WINDOW: {"open_ok": True}})
    garage = await setup_alarm(hass, "Garage", sensor_options={MOTION: {"confirm": True}})
    reloads: list[str] = []
    original = hass.config_entries.async_reload

    async def counting(entry_id: str) -> bool:
        reloads.append(entry_id)
        return await original(entry_id)

    monkeypatch.setattr(hass.config_entries, "async_reload", counting)
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/save_presets", presets={"window": ["reachable", "confirm"]}, reset_entities={haus.entry_id: [WINDOW]})
    assert result["success"] and result["result"]["reset"] == 1
    await hass.async_block_till_done()
    assert sorted(reloads) == sorted([haus.entry_id, garage.entry_id])
    assert haus.runtime_data.controller.option(WINDOW, "confirm") is True
    assert garage.options["sensor_options"] == {MOTION: {"confirm": True}}
