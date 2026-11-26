"""
"Beim Scharfschalten umgehen" gestrichen (1.92.0, Frage des Nutzers 2026-11-26: "Haben wir diese Option nicht gestrichen? ... das widerspricht sich
doch", Entscheid: streichen, Sensoren mit "Umgehen" bekommen einmalig "Muss geschlossen sein" aus).

Bis 1.91.x gab es neben "Muss beim Scharfschalten geschlossen sein" (gespeichert als `open_ok`, umgekehrt) die Option "Umgehen" (`bypass`): ein offener
Sensor, der nicht offen sein durfte, liess sich trotzdem scharf schalten und wurde bis zum Deaktivieren übergangen. Zusagen:
- Ein offener Sensor, der nicht offen sein darf, verhindert das Scharfschalten immer; übergangen wird er nur noch mit "Trotzdem scharf schalten".
- Wo "Umgehen" wirkte (eigener Wert, je Modus, Voreinstellung), darf der Sensor jetzt offen sein: Scharfschalten geht wie bisher, der Sensor wird
  überwacht statt übergangen (Schliessen und erneutes Öffnen löst aus). Wo es nicht wirkte (eigener Wert "aus" gegen eine Voreinstellung "an"),
  bleibt "Muss geschlossen sein" an. Andere Werte (eigene Eingangsverzögerung, beschädigte Einträge) bleiben unberührt.
- Umgestellt wird beim ersten Laden der Einstellungen nach dem Update, für alle Anlagen (auch nicht geladene), mit den Voreinstellungen von vorher,
  und sofort gespeichert; danach entscheidet der Nutzer. Reste (sehr alte Anlagen, Backups) werden beim Laden oder Einlesen ebenso umgestellt.
- Vom Panel nimmt der Server "Umgehen" nicht mehr an (Sensoren und Voreinstellungen); Backups bis 1.91.x lassen sich weiter einlesen.
"""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.alarmageddon.backup import FORMAT, VERSION, validate
from custom_components.alarmageddon.const import DOMAIN
from custom_components.alarmageddon.settings import async_get_settings, fold_bypass, stored_presets, valid_presets

from .conftest import ALARM, FRONT_DOOR, MOTION, WINDOW, options, setup_alarm
from .test_alarm import call, state
from .test_review_1_87 import SETTINGS_KEY, _classes, _set

KIND = {WINDOW: "window", FRONT_DOOR: "door", MOTION: "motion"}.get
PRESETS_1_91 = {"door": ["reachable", "arm_on_close"], "window": ["reachable"], "motion": ["open_ok", "reachable"], "environment": ["always"],
                "tamper": ["offline_alarm"], "other": []}


def _fold(own: dict[str, Any] | None = None, modes: dict[str, Any] | None = None, presets: dict[str, list[str]] | None = None) -> dict[str, Any] | None:
    opts: dict[str, Any] = {}
    if own is not None:
        opts["sensor_options"] = own
    if modes is not None:
        opts["sensor_modes"] = modes
    return fold_bypass(opts, stored_presets(presets or PRESETS_1_91), lambda e: KIND(e, "other"))


@pytest.mark.parametrize(("own", "modes", "presets", "want_own", "want_modes"), [
    # "Umgehen" an: darf offen sein; die eigene Eingangsverzögerung bleibt
    ({WINDOW: {"bypass": True, "entry_delay": 20}}, None, None, {WINDOW: {"open_ok": True, "entry_delay": 20}}, None),
    # "Muss geschlossen sein" an und "Umgehen" an: darf offen sein
    ({WINDOW: {"bypass": True, "open_ok": False}}, None, None, {WINDOW: {"open_ok": True}}, None),
    # "Umgehen" aus: es wirkte nicht, der Wert fällt weg (die Voreinstellung sagt dasselbe)
    ({WINDOW: {"bypass": False}}, None, None, {}, None),
    # Bewegung darf ohnehin offen sein: kein eigener Wert nötig
    ({MOTION: {"bypass": True}}, None, None, {}, None),
    # Je Modus: gemeinsam "Umgehen" an, in Abwesend aus: gemeinsam darf offen sein, Abwesend muss geschlossen sein (dort wirkte es nicht)
    ({WINDOW: {"bypass": True}}, {"away": {WINDOW: {"bypass": False}}}, None, {WINDOW: {"open_ok": True}}, {"away": {WINDOW: {"open_ok": False}}}),
    # Nur in einem Modus "Umgehen": nur dort darf er offen sein
    ({}, {"home": {WINDOW: {"bypass": True}}, "away": {FRONT_DOOR: {"confirm": True}}}, None, {}, {"home": {WINDOW: {"open_ok": True}}, "away": {FRONT_DOOR: {"confirm": True}}}),
    # Voreinstellung "Umgehen" für Fenster: ein eigenes "Muss geschlossen sein" wirkte nicht (umgangen), jetzt darf er offen sein
    ({WINDOW: {"open_ok": False}}, None, {**PRESETS_1_91, "window": ["reachable", "bypass"]}, {WINDOW: {"open_ok": True}}, None),
    # Voreinstellung "Umgehen", eigener Wert "Umgehen" aus: es wirkte nicht, er muss geschlossen sein (gegen die neue Voreinstellung)
    ({WINDOW: {"bypass": False}}, None, {**PRESETS_1_91, "window": ["reachable", "bypass"]}, {WINDOW: {"open_ok": False}}, None),
    # Beschädigte Einträge bleiben, wie sie sind
    ({WINDOW: {"bypass": True}, FRONT_DOOR: None}, {"night": None}, None, {WINDOW: {"open_ok": True}, FRONT_DOOR: None}, {"night": None}),
], ids=["umgehen", "umgehen_und_geschlossen", "umgehen_aus", "bewegung", "je_modus_aus", "nur_ein_modus", "voreinstellung_umgehen",
        "voreinstellung_umgehen_eigen_aus", "beschaedigt"])
def test_bypass_becomes_may_be_open_where_it_worked(own, modes, presets, want_own, want_modes) -> None:
    out = _fold(own, modes, presets)
    assert out is not None
    assert out["sensor_options"] == want_own
    if want_modes is not None:
        assert out["sensor_modes"] == want_modes


def test_nothing_to_fold_changes_nothing() -> None:
    assert _fold({WINDOW: {"open_ok": False, "confirm": True}}, {"away": {WINDOW: {"open_ok": True}}}) is None
    assert _fold(None, None) is None


def test_presets_with_bypass_become_may_be_open() -> None:
    presets = valid_presets({**PRESETS_1_91, "window": ["reachable", "bypass"], "other": ["bypass"]})
    assert presets["window"] == ["open_ok", "reachable"] and presets["other"] == ["open_ok"]
    assert all("bypass" not in options for options in presets.values())


async def test_an_open_sensor_that_must_be_closed_always_blocks_arming(hass: HomeAssistant) -> None:
    """Ohne "Umgehen" verhindert ein offenes Fenster das Scharfschalten; "Trotzdem scharf schalten" (force) übergeht es bis zum Deaktivieren."""
    _classes(hass)
    entry = await setup_alarm(hass, exit_delay_away=0)
    await _set(hass, WINDOW, "on")
    assert state(hass, "binary_sensor.haus_ready_to_arm_away") == "off"
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_arm_away")
    assert err.value.translation_key == "open_sensors"
    await entry.runtime_data.controller.async_arm("away", None, force=True)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY and hass.states.get(ALARM).attributes["bypassed_sensors"] == [WINDOW]


async def test_a_loaded_bypass_arms_and_then_watches_the_sensor(hass: HomeAssistant) -> None:
    """Rest aus einer alten Anlage: beim Laden umgestellt; scharf schalten geht wie bisher, Schliessen und Öffnen löst jetzt aus."""
    _classes(hass)
    entry = await setup_alarm(hass, exit_delay_away=0, sensor_options={WINDOW: {"bypass": True}})
    assert entry.options["sensor_options"] == {WINDOW: {"open_ok": True}}
    await _set(hass, WINDOW, "on")
    await call(hass, "alarm_arm_away")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY and hass.states.get(ALARM).attributes["bypassed_sensors"] == []
    await _set(hass, WINDOW, "off")
    await _set(hass, WINDOW, "on")
    assert state(hass) == AlarmControlPanelState.TRIGGERED


async def test_the_update_folds_every_system_once_with_the_old_presets(hass: HomeAssistant, hass_storage) -> None:
    """Erstes Laden nach dem Update: alle Anlagen (auch eine nicht geladene) mit den Voreinstellungen von vorher, sofort gespeichert."""
    _classes(hass)
    hass_storage[SETTINGS_KEY] = {"version": 1, "key": SETTINGS_KEY, "data": {
        "presets_reachable": True, "presets": {**PRESETS_1_91, "window": ["reachable", "bypass"]}}}
    idle = MockConfigEntry(domain=DOMAIN, title="Garage", data={"name": "Garage"}, options=options(sensor_options={WINDOW: {"open_ok": False}}))
    idle.add_to_hass(hass)  # nicht geladen
    entry = await setup_alarm(hass, exit_delay_away=0, sensor_options={WINDOW: {"open_ok": False}, FRONT_DOOR: {"bypass": True}})
    assert entry.options["sensor_options"] == {WINDOW: {"open_ok": True}, FRONT_DOOR: {"open_ok": True}}
    assert idle.options["sensor_options"] == {WINDOW: {"open_ok": True}}, "auch eine nicht geladene Anlage"
    data = hass_storage[SETTINGS_KEY]["data"]
    assert data["presets_no_bypass"] is True and data["presets"]["window"] == ["open_ok", "reachable"], "sofort festgehalten"
    # Danach entscheidet der Nutzer: "Muss geschlossen sein" wieder an bleibt an, auch nach dem Neuladen
    settings = await async_get_settings(hass)
    assert "bypass" not in settings.presets["window"]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "sensor_options": {WINDOW: {"open_ok": False}}})
    await hass.async_block_till_done()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.options["sensor_options"] == {WINDOW: {"open_ok": False}}


async def test_old_backups_are_folded_with_their_own_presets(hass: HomeAssistant) -> None:
    _classes(hass)
    data = {"format": FORMAT, "version": VERSION, "settings": {"presets_reachable": True, "presets": {**PRESETS_1_91, "window": ["reachable", "bypass"]}},
            "systems": [{"title": "Haus", "options": {"sensor_options": {WINDOW: {"open_ok": False}, FRONT_DOOR: {"bypass": True, "entry_delay": 30}},
                                                       "per_mode_sensors": True, "sensor_modes": {"away": {MOTION: {"bypass": False}}}}}]}
    backup = validate(data, hass)
    opts = backup["systems"][0]["options"]
    assert opts["sensor_options"] == {WINDOW: {"open_ok": True}, FRONT_DOOR: {"open_ok": True, "entry_delay": 30}}
    assert opts["sensor_modes"] == {}, "Bewegung darf ohnehin offen sein, der Wert fällt weg"
    assert backup["presets"]["window"] == ["open_ok", "reachable"]


@pytest.mark.parametrize("message", [
    {"sensor_options": {WINDOW: {"bypass": True}}},
    {"sensor_modes": {"away": {WINDOW: {"bypass": True}}}},
], ids=["eigener_wert", "je_modus"])
async def test_the_panel_can_no_longer_save_bypass(hass: HomeAssistant, hass_ws_client, message: dict[str, Any]) -> None:
    entry = await setup_alarm(hass)
    before = dict(entry.options)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_zones", "entry_id": entry.entry_id, "zones": {"home": [WINDOW]}, "entry_sensors": [], **message})
    result = await client.receive_json()
    assert result["success"] is False and result["error"]["code"] == "invalid_format"
    assert dict(entry.options) == before


async def test_the_presets_can_no_longer_hold_bypass(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/save_presets", "presets": {"window": ["reachable", "bypass"]}})
    result = await client.receive_json()
    assert result["success"] is False
    assert "bypass" not in (await async_get_settings(hass)).presets["window"]
