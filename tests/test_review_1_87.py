"""
Code-Review 2026-11-24 (1.87.0): die Befunde dieses Reviews, jeder zuerst gegen den alten Stand (1.86.2) rot gesehen
(Nachbau in tests/test_review_1_87.py, die Fälle R1 bis R10 der Prüfung).

Zusagen, die hier gesichert sind:
- K1: Quittieren und sofort ein neuer Alarm: das Aufräumen des alten Laufs schaltet die Sirene des neuen nie ab, das Deaktivieren danach
  stellt alles zurück. Ein Voralarm in der Eingangsverzögerung stellt den Lautsprecher nie in den Alarmton hinein zurück.
- H1: Ein Sensor, der zu war, während der Überwachung ausfällt und offen zurückkommt, löst nach RETURN_CONFIRM Sekunden aus wie ein Öffnen.
- M1: Ein Sensor, der während des Neuladens (jedes Speichern im Panel) öffnet, löst aus.
- M4: "Muss beim Scharfschalten erreichbar sein" verhindert das Scharfschalten mit einem nicht erreichbaren Sensor (Standard für Tür,
  Fenster, Bewegung; bestehende Voreinstellungen und alte Backups bekommen es einmal).
- H2: Ein weiterer Sensor im Zustand "Alarm" meldet sich (Protokoll, Meldung); mit "Nachalarm" laufen die Alarmaktionen erneut,
  höchstens so oft wie eingestellt.
- H3: Ein Ton "bis zum Deaktivieren" läuft nach einem Neustart mitten im Alarm wieder.
- M2: Die Sperre nach falschen Codes wächst bis 15 Minuten, übersteht das Neuladen und steht im Protokoll und als Meldung.
- M3: Der Wechsel des Modus einer scharfen Anlage verlangt den Code.
- M5: Eine wiederhergestellte Eingangsverzögerung dauert nie länger als eingestellt.
- M6: Ein flatternder Sensor meldet "nicht erreichbar" höchstens einmal in OFFLINE_NOTIFY_GAP.
- O1: Die Diagnose nennt nie Code, Hash oder Salz; der Dienst "Quittieren" gibt es auch ohne geladene Anlage.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant, ServiceCall, State
from homeassistant.exceptions import ServiceValidationError
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service, mock_restore_cache_with_extra_data

from custom_components.alarmageddon import events as events_mod
from custom_components.alarmageddon.backup import FORMAT, VERSION, validate
from custom_components.alarmageddon.code import hash_code
from custom_components.alarmageddon.const import (
    CODE_LOCKOUT_STEPS,
    CODE_MAX_ATTEMPTS,
    DOMAIN,
    OFFLINE_NOTIFY_GAP,
    RETURN_CONFIRM,
    WORKFLOW_STORE_KEY,
)
from custom_components.alarmageddon.diagnostics import async_get_config_entry_diagnostics
from custom_components.alarmageddon.settings import async_get_settings

from .conftest import ALARM, FRONT_DOOR, MOTION, WINDOW, options, setup_alarm
from .test_actions import _notify_settings
from .test_alarm import advance, call, settle, state

SIREN = "switch.sirene"
PLAYER = "media_player.wohnzimmer"
SMOKE = "binary_sensor.rauchmelder"
SETTINGS_KEY = "alarmageddon.settings"


def _ids(call: ServiceCall) -> list[str]:
    ids = call.data["entity_id"]
    return [ids] if isinstance(ids, str) else list(ids)


def _classes(hass: HomeAssistant) -> None:
    """Geräteklassen wie echte Sensoren, damit die Voreinstellungen je Sensorart greifen (Tür, Fenster, Bewegung: "Muss erreichbar sein")."""
    hass.states.async_set(FRONT_DOOR, "off", {"device_class": "door"})
    hass.states.async_set(WINDOW, "off", {"device_class": "window"})
    hass.states.async_set(MOTION, "off", {"device_class": "motion"})
    hass.states.async_set(SMOKE, "off", {"device_class": "smoke"})


async def _set(hass: HomeAssistant, entity: str, value: str) -> None:
    """Zustand setzen und die Attribute (Geräteklasse) behalten, wie ein echter Sensor."""
    old = hass.states.get(entity)
    hass.states.async_set(entity, value, old.attributes if old else {})
    await settle(hass)


def _kinds(entry) -> list[str | None]:
    return [e.get("kind") for e in entry.runtime_data.events.events]


def _events(entry, kind: str) -> list[dict[str, Any]]:
    return [e for e in entry.runtime_data.events.events if e.get("kind") == kind]


def _real_switch(hass: HomeAssistant, delay_off: float = 0.0) -> dict[str, list[ServiceCall]]:
    """Schalter wie ein echtes Gerät: der Dienst ändert den Zustand (Ausschalten auf Wunsch verzögert, wie ein träges Funkgerät)."""
    calls: dict[str, list[ServiceCall]] = {"turn_on": [], "turn_off": []}

    async def turn_on(call: ServiceCall) -> None:
        calls["turn_on"].append(call)
        for e in _ids(call):
            hass.states.async_set(e, "on")

    async def turn_off(call: ServiceCall) -> None:
        calls["turn_off"].append(call)
        if delay_off:
            await asyncio.sleep(delay_off)
        for e in _ids(call):
            hass.states.async_set(e, "off")

    hass.services.async_register("switch", "turn_on", turn_on)
    hass.services.async_register("switch", "turn_off", turn_off)
    hass.states.async_set(SIREN, "off")
    return calls


def _real_player(hass: HomeAssistant, seconds: float) -> dict[str, list[ServiceCall]]:
    """Lautsprecher wie ein echtes Gerät im WLAN: jeder Aufruf braucht `seconds` und ändert danach den Zustand."""
    calls: dict[str, list[ServiceCall]] = {}
    effect = {"play_media": "playing", "media_stop": "idle", "turn_off": "off", "turn_on": "idle", "volume_set": None, "volume_mute": None}

    def make(name: str):
        async def handler(call: ServiceCall) -> None:
            calls.setdefault(name, []).append(call)
            await asyncio.sleep(seconds)
            for e in _ids(call):
                old = hass.states.get(e)
                attrs = dict(old.attributes) if old else {}
                if name == "volume_set":
                    attrs["volume_level"] = call.data["volume_level"]
                hass.states.async_set(e, effect[name] or (old.state if old else "idle"), attrs)
        return handler

    for name in effect:
        hass.services.async_register("media_player", name, make(name))
    return calls


async def _real_time(hass: HomeAssistant, seconds: float, until=None) -> None:
    """Echte Zeit laufen lassen (Geräte mit Antwortzeit), auf Wunsch nur bis eine Bedingung gilt."""
    for _ in range(int(seconds / 0.05)):
        await asyncio.sleep(0.05)
        await hass.async_block_till_done()
        if until is not None and until():
            return


async def _with_code(hass: HomeAssistant, **overrides: Any) -> MockConfigEntry:
    code_hash, salt = hash_code("1234")
    return await setup_alarm(hass, code_hash=code_hash, code_salt=salt, exit_delay_away=0, exit_delay_home=0, **overrides)


# ----- K1: Quittieren und sofort ein neuer Alarm -----


@pytest.mark.parametrize(("delay_off", "gap"), [(0.0, 0.0), (0.3, 0.0), (0.5, 0.1), (0.0, 0.1)],
                         ids=["gleicher_takt", "traeges_geraet", "traeges_geraet_100ms_spaeter", "schnelles_geraet_100ms_spaeter"])
async def test_retrigger_right_after_acknowledge_keeps_the_siren_of_the_new_alarm(hass: HomeAssistant, delay_off: float, gap: float) -> None:
    """Bis 1.86.x schaltete das Zurückstellen des quittierten Laufs die Sirene des neuen Alarms ab, oder das Deaktivieren liess sie an."""
    calls = _real_switch(hass, delay_off)
    siren_on = {"type": "action", "action": "switch.turn_on", "target": [SIREN], "restore": True}
    entry = await setup_alarm(hass, exit_delay_home=0, workflows={"home": [siren_on, {"type": "wait", "seconds": 300}]})
    await call(hass, "alarm_arm_home")
    hass.states.async_set(WINDOW, "on")
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED and hass.states.get(SIREN).state == "on"
    assert entry.runtime_data.controller.acknowledge("Anna")
    hass.states.async_set(WINDOW, "off")
    if gap:
        await asyncio.sleep(gap)
    hass.states.async_set(WINDOW, "on")
    await _real_time(hass, 1.0)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    during = hass.states.get(SIREN).state
    if not gap:
        # Der neue Alarm beginnt, bevor der alte zurückstellt: die Sirene geht ihm über, ohne kurz aus- und wieder einzuschalten
        assert not calls["turn_off"], "die Sirene des neuen Alarms ging kurz aus"
    await call(hass, "alarm_disarm")
    await _real_time(hass, 1.0)
    after = hass.states.get(SIREN).state
    assert (during, after) == ("on", "off"), f"Sirene im zweiten Alarm {during}, nach dem Deaktivieren {after}; {len(calls['turn_on'])} ein, {len(calls['turn_off'])} aus"


async def test_prealarm_never_puts_the_speaker_back_into_the_alarm_sound(hass: HomeAssistant) -> None:
    """Voralarm und Alarmton auf demselben Lautsprecher, jeder Befehl braucht 1,2 s: im Alarm spielt der Alarmton mit seiner Lautstärke."""
    await hass.config.async_update(internal_url="http://192.168.1.2:8123")
    hass.states.async_set(PLAYER, "off", {"volume_level": 0.2, "is_volume_muted": False})
    calls = _real_player(hass, 1.2)
    prealarm = {"type": "prealarm", "players": [PLAYER], "sound": "pre_beep", "delay": True, "restore": True}
    alarm = {"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 0, "volume": 1.0}
    await setup_alarm(hass, exit_delay_home=0, entry_delay=2, workflows_entry={"home": [prealarm]}, workflows={"home": [alarm]})
    await call(hass, "alarm_arm_home")
    hass.states.async_set(FRONT_DOOR, "on")
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.PENDING

    def playing() -> bool:
        player = hass.states.get(PLAYER)
        return state(hass) == AlarmControlPanelState.TRIGGERED and player.state == "playing" and player.attributes.get("volume_level") == 1.0

    await _real_time(hass, 20, playing)
    await _real_time(hass, 4)  # nichts darf danach noch zurückstellen
    player = hass.states.get(PLAYER)
    sequence = {name: len(c) for name, c in calls.items()}
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert player.state == "playing" and player.attributes.get("volume_level") == 1.0, f"Im Alarm {player.state}, {player.attributes.get('volume_level')}; {sequence}"


async def test_real_alarm_during_a_test_of_another_device_never_waits_for_it(hass: HomeAssistant) -> None:
    """
    Test eines einzelnen Schritts (Licht, nicht im Ablauf des Alarms), dann ein echter Alarm: die Sirene schaltet sofort. Das Zurückstellen
    des Lichts (hier hängend) wird nie abgewartet; das Licht kehrt beim Deaktivieren in den Zustand vor dem Test zurück.
    """
    light = "light.flur"
    hass.states.async_set(SIREN, "off")
    hass.states.async_set(light, "off")
    on = async_mock_service(hass, "switch", "turn_on")
    async_mock_service(hass, "light", "turn_on")
    release = asyncio.Event()
    light_off: list[ServiceCall] = []

    async def turn_off(service_call: ServiceCall) -> None:
        light_off.append(service_call)
        await release.wait()

    hass.services.async_register("light", "turn_off", turn_off)
    entry = await setup_alarm(hass, exit_delay_home=0, workflows={"home": [{"type": "action", "action": "switch.turn_on", "target": [SIREN]}]})
    runner = entry.runtime_data.workflow
    step = {"type": "action", "action": "light.turn_on", "target": [light], "restore": True}
    assert await runner.async_run("home", test=True, steps=[step, {"type": "wait", "seconds": 300}])
    await settle(hass)
    hass.states.async_set(light, "on")  # der Test hat das Licht eingeschaltet
    await call(hass, "alarm_arm_home")
    hass.states.async_set(WINDOW, "on")
    for _ in range(40):  # echte Zeit, ohne auf Aufgaben zu warten: ein abgewartetes Zurückstellen hielte die Sirene bis zu 10 s auf
        await asyncio.sleep(0.05)
        if on:
            break
    assert len(on) == 1, "die Sirene des echten Alarms schaltet sofort"
    assert not light_off, "das Licht des Tests wird nicht zwischendurch zurückgestellt"
    release.set()
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert len(light_off) == 1, "beim Deaktivieren kehrt das Licht in den Zustand vor dem Test zurück"


# ----- H1: zu, ausgefallen, offen zurück -----


async def test_closed_sensor_that_fails_and_returns_open_triggers_after_the_confirmation(hass: HomeAssistant, freezer) -> None:
    entry = await setup_alarm(hass, exit_delay_home=0)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await _set(hass, WINDOW, "on")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME, "erst nach der Bestätigung"
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert hass.states.get(ALARM).attributes["triggered_by"] == WINDOW
    assert _events(entry, "sensor_back_open")[0]["alarm"] is True


async def test_returning_open_for_a_moment_only_is_no_alarm(hass: HomeAssistant, freezer) -> None:
    """Ein kurzes "offen" beim Wiederverbinden (manche Funksensoren melden zuerst einen alten Wert) ist kein Öffnen."""
    await setup_alarm(hass, exit_delay_home=0)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await _set(hass, WINDOW, "on")
    await _set(hass, WINDOW, "off")
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_disarm_during_the_confirmation_is_no_alarm(hass: HomeAssistant, freezer) -> None:
    await setup_alarm(hass, exit_delay_home=0)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await _set(hass, WINDOW, "on")
    await call(hass, "alarm_disarm")
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_failure_while_disarmed_never_counts_after_arming(hass: HomeAssistant, freezer) -> None:
    """Fiel der Sensor aus, bevor die Anlage ihn überwachte, und kommt er offen zurück: kein Alarm, aber ein Eintrag (blinder Fleck)."""
    entry = await setup_alarm(hass, exit_delay_home=0)
    await _set(hass, WINDOW, "unavailable")
    await call(hass, "alarm_arm_home")  # ohne Geräteklasse: keine Voreinstellung "Muss erreichbar sein"
    await _set(hass, WINDOW, "on")
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert _events(entry, "sensor_back_open")[0]["alarm"] is False


async def test_sensor_outside_the_armed_zone_never_triggers_on_return(hass: HomeAssistant, freezer) -> None:
    await setup_alarm(hass, exit_delay_home=0)
    await call(hass, "alarm_arm_home")  # die Bewegung gehört nur zur Zone "Abwesend"
    await _set(hass, MOTION, "unavailable")
    await _set(hass, MOTION, "on")
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_always_active_sensor_that_returns_open_triggers_while_disarmed(hass: HomeAssistant, freezer) -> None:
    _classes(hass)
    await setup_alarm(hass, sensor_options={SMOKE: {"always": True}})
    await _set(hass, SMOKE, "unavailable")
    await _set(hass, SMOKE, "on")
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert hass.states.get(ALARM).attributes["triggered_by"] == SMOKE


# ----- M1: Öffnen während des Neuladens -----


async def test_sensor_opening_during_a_reload_triggers(hass: HomeAssistant) -> None:
    """Jedes Speichern im Panel lädt die Anlage neu; bis 1.86.x ging ein Öffnen in dieser Zeit verloren."""
    entry = await setup_alarm(hass, exit_delay_away=0)
    await call(hass, "alarm_arm_away")
    original = events_mod.EventLog.async_load

    async def load_and_open_window(self):
        hass.states.async_set(WINDOW, "on")  # genau während des Neuladens
        await original(self)

    with patch.object(events_mod.EventLog, "async_load", load_and_open_window):
        assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert hass.states.get(ALARM).attributes["triggered_by"] == WINDOW


async def test_reload_without_change_never_triggers(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass, exit_delay_away=0)
    await call(hass, "alarm_arm_away")
    assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_failure_during_a_reload_is_remembered(hass: HomeAssistant, freezer) -> None:
    """Zu vor dem Neuladen, ausgefallen währenddessen, offen danach: wie live (H1)."""
    entry = await setup_alarm(hass, exit_delay_away=0)
    await call(hass, "alarm_arm_away")
    original = events_mod.EventLog.async_load

    async def load_and_fail(self):
        hass.states.async_set(WINDOW, "unavailable")
        await original(self)

    with patch.object(events_mod.EventLog, "async_load", load_and_fail):
        assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    await _set(hass, WINDOW, "on")
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.TRIGGERED


# ----- M4: "Muss beim Scharfschalten erreichbar sein" -----


async def test_unreachable_window_prevents_arming(hass: HomeAssistant, hass_ws_client) -> None:
    pushes = async_mock_service(hass, "notify", "handy")
    _classes(hass)
    entry = await setup_alarm(hass, exit_delay_away=0)
    await _notify_settings(hass, hass_ws_client)
    await _set(hass, WINDOW, "unavailable")
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_arm_away")
    assert err.value.translation_key == "sensors_not_ready"
    assert state(hass) == AlarmControlPanelState.DISARMED
    failed = _events(entry, "arm_failed")[0]
    assert failed["unreachable"] == [WINDOW] and failed["sensors"] == []
    await settle(hass)
    assert pushes and "Not reachable" in pushes[-1].data["message"] and "fenster" in pushes[-1].data["message"]


# Bis 1.88.0 auch mit "Umgehen" (Fall "umgehen"); seit 1.89.0 entscheidet allein "Muss erreichbar sein", seit 1.92.0 gibt es "Umgehen" nicht mehr
# (tests/test_bypass_removed.py)
@pytest.mark.parametrize("own", [{"reachable": False}], ids=["abgewaehlt"])
async def test_unreachable_window_arms_without_the_option(hass: HomeAssistant, own: dict[str, bool]) -> None:
    _classes(hass)
    await setup_alarm(hass, exit_delay_away=0, sensor_options={WINDOW: own})
    await _set(hass, WINDOW, "unavailable")
    await call(hass, "alarm_arm_away")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_unreachable_motion_only_counts_in_its_zone(hass: HomeAssistant) -> None:
    _classes(hass)
    await setup_alarm(hass, exit_delay_away=0, exit_delay_home=0)
    await _set(hass, MOTION, "unavailable")
    await call(hass, "alarm_arm_home")  # Bewegung nicht in der Zone "Anwesend"
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    await call(hass, "alarm_disarm")
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_away")


async def test_sensor_without_a_type_is_not_required_to_be_reachable(hass: HomeAssistant) -> None:
    """Sensorart "Andere": keine Voreinstellung, das Verhalten bis 1.86.x bleibt."""
    await setup_alarm(hass, exit_delay_away=0)
    await _set(hass, WINDOW, "unavailable")
    await call(hass, "alarm_arm_away")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_arm_anyway_button_arms_with_an_unreachable_sensor(hass: HomeAssistant) -> None:
    """Der Knopf "Trotzdem scharf schalten" der Meldung (force) gilt auch für nicht erreichbare Sensoren."""
    _classes(hass)
    entry = await setup_alarm(hass, exit_delay_away=0)
    await _set(hass, WINDOW, "unavailable")
    await entry.runtime_data.controller.async_arm("away", None, skip_code=True, force=True)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_open_and_unreachable_both_named(hass: HomeAssistant) -> None:
    _classes(hass)
    entry = await setup_alarm(hass, exit_delay_away=0)
    await _set(hass, WINDOW, "unavailable")
    await _set(hass, FRONT_DOOR, "on")
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_arm_away")
    assert err.value.translation_key == "sensors_not_ready"
    failed = _events(entry, "arm_failed")[0]
    assert failed["unreachable"] == [WINDOW] and failed["sensors"] == [FRONT_DOOR]


async def test_ready_entity_follows_unreachable_sensors(hass: HomeAssistant) -> None:
    """"Bereit zum Scharfschalten" rechnet wie das Scharfschalten: zu -> nicht verfügbar ändert die Entität sofort, mit dem Sensor im Attribut."""
    _classes(hass)
    await setup_alarm(hass)
    ready = "binary_sensor.haus_ready_to_arm_home"
    assert state(hass, ready) == "on"
    await _set(hass, WINDOW, "unavailable")
    assert state(hass, ready) == "off"
    attrs = hass.states.get(ready).attributes
    assert attrs["unreachable_sensors"] == [WINDOW] and attrs["blocking_sensors"] == []
    await _set(hass, WINDOW, "off")
    assert state(hass, ready) == "on" and hass.states.get(ready).attributes["unreachable_sensors"] == []


async def test_existing_presets_get_reachable_once(hass: HomeAssistant, hass_storage) -> None:
    """Voreinstellungen von vor 1.87.0: Tür, Fenster und Bewegung bekommen "Muss erreichbar sein", alles andere bleibt."""
    hass_storage[SETTINGS_KEY] = {"version": 1, "key": SETTINGS_KEY, "data": {
        "presets": {"door": ["arm_on_close"], "window": [], "motion": ["open_ok"], "environment": ["always"], "tamper": ["offline_alarm"], "other": []}}}
    settings = await async_get_settings(hass)
    presets = settings.presets
    assert "reachable" in presets["door"] and "arm_on_close" in presets["door"]
    assert presets["window"] == ["reachable"] and set(presets["motion"]) == {"open_ok", "reachable"}
    assert "reachable" not in presets["environment"] and "reachable" not in presets["other"] and "reachable" not in presets["tamper"]
    assert hass_storage[SETTINGS_KEY]["data"]["presets_reachable"] is True, "sofort festgehalten"


async def test_presets_after_the_update_stay_as_the_user_chose(hass: HomeAssistant, hass_storage) -> None:
    """Hat der Nutzer "Muss erreichbar sein" nach dem Update abgewählt, kommt es nie wieder zurück."""
    hass_storage[SETTINGS_KEY] = {"version": 1, "key": SETTINGS_KEY, "data": {"presets_reachable": True, "presets": {"window": [], "door": ["arm_on_close"]}}}
    presets = (await async_get_settings(hass)).presets
    assert presets["window"] == [] and presets["door"] == ["arm_on_close"]


def test_old_backups_get_reachable_and_new_ones_keep_their_presets(hass: HomeAssistant) -> None:
    old = validate({"format": FORMAT, "version": VERSION, "systems": [], "settings": {"presets": {"window": []}}}, hass)
    assert old["presets"]["window"] == ["reachable"]
    new = validate({"format": FORMAT, "version": VERSION, "systems": [], "settings": {"presets_reachable": True, "presets": {"window": []}}}, hass)
    assert new["presets"]["window"] == []


# ----- H2: weiterer Sensor im Alarm, Nachalarm -----


async def _alarm_done(hass: HomeAssistant, hass_ws_client, **overrides: Any):
    pushes = async_mock_service(hass, "notify", "handy")
    siren = async_mock_service(hass, "switch", "turn_on")
    entry = await setup_alarm(hass, exit_delay_home=0, workflows={"home": [{"type": "action", "action": "switch.turn_on", "target": [SIREN]}]}, **overrides)
    await _notify_settings(hass, hass_ws_client)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "on")
    assert state(hass) == AlarmControlPanelState.TRIGGERED and len(siren) == 1
    return entry, pushes, siren


async def test_another_sensor_during_the_alarm_is_reported(hass: HomeAssistant, hass_ws_client) -> None:
    entry, pushes, siren = await _alarm_done(hass, hass_ws_client)
    before = len(pushes)
    await _set(hass, FRONT_DOOR, "on")
    assert _events(entry, "sensor_again")[0]["sensor"] == FRONT_DOOR
    assert len(pushes) == before + 1 and pushes[-1].data["data"]["tag"].endswith(f"_again_{FRONT_DOOR}")
    assert len(siren) == 1, "ohne Nachalarm laufen die Aktionen nicht erneut (Standard aus)"
    assert state(hass) == AlarmControlPanelState.TRIGGERED


async def test_another_sensor_is_reported_once_per_throttle(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    entry, pushes, _ = await _alarm_done(hass, hass_ws_client)
    before = len(pushes)
    for _ in range(5):
        await _set(hass, FRONT_DOOR, "on")
        await _set(hass, FRONT_DOOR, "off")
    assert len(_events(entry, "sensor_again")) == 1 and len(pushes) == before + 1


async def test_sensor_outside_the_zone_or_bypassed_is_no_further_alarm(hass: HomeAssistant, hass_ws_client) -> None:
    entry, pushes, _ = await _alarm_done(hass, hass_ws_client)
    await _set(hass, MOTION, "on")  # nur in der Zone "Abwesend"
    assert not _events(entry, "sensor_again")


async def test_realarm_runs_the_actions_again_up_to_the_count(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    entry, _, siren = await _alarm_done(hass, hass_ws_client, realarm_enabled=True, realarm_count=2)
    await _set(hass, FRONT_DOOR, "on")
    assert len(siren) == 2
    await _set(hass, WINDOW, "off")
    await advance(hass, freezer, 301)
    await _set(hass, WINDOW, "on")
    assert len(siren) == 3
    await advance(hass, freezer, 301)
    await _set(hass, FRONT_DOOR, "off")
    await _set(hass, FRONT_DOOR, "on")
    assert len(siren) == 3, "höchstens realarm_count Nachalarme"
    assert [e["count"] for e in _events(entry, "realarm")] == [2, 1]
    assert len(_events(entry, "sensor_again")) == 3, "die Meldung kommt weiter"


async def test_realarm_waits_while_the_actions_still_run(hass: HomeAssistant, hass_ws_client) -> None:
    siren = async_mock_service(hass, "switch", "turn_on")
    async_mock_service(hass, "notify", "handy")
    steps = [{"type": "action", "action": "switch.turn_on", "target": [SIREN]}, {"type": "wait", "seconds": 600}]
    entry = await setup_alarm(hass, exit_delay_home=0, realarm_enabled=True, workflows={"home": steps})
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "on")
    await _set(hass, FRONT_DOOR, "on")
    assert len(siren) == 1 and not _events(entry, "realarm")


async def test_realarm_restores_the_state_before_the_first_alarm(hass: HomeAssistant) -> None:
    """Der Nachalarm merkt sich nicht die laufende Sirene als Zustand "vorher": Deaktivieren schaltet sie aus."""
    _real_switch(hass)
    async_mock_service(hass, "notify", "handy")
    siren_on = {"type": "action", "action": "switch.turn_on", "target": [SIREN], "restore": True}
    await setup_alarm(hass, exit_delay_home=0, realarm_enabled=True, workflows={"home": [siren_on]})
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "on")
    await _set(hass, FRONT_DOOR, "on")
    await settle(hass)
    assert hass.states.get(SIREN).state == "on"
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert hass.states.get(SIREN).state == "off"


async def test_realarm_count_is_checked(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    for count, ok in ((0, False), (11, False), (1, True), (10, True)):
        await client.send_json_auto_id({"type": f"{DOMAIN}/save_system", "entry_id": entry.entry_id, "realarm_enabled": True, "realarm_count": count})
        msg = await client.receive_json()
        assert msg["success"] is ok, (count, msg)
        await hass.async_block_till_done()
    entry = hass.config_entries.async_get_entry(entry.entry_id)
    assert entry.options["realarm_enabled"] is True and entry.options["realarm_count"] == 10


# ----- H3: Ton "bis zum Deaktivieren" nach einem Neustart -----


async def test_endless_tone_resumes_after_a_restart_in_the_alarm(hass: HomeAssistant, hass_storage) -> None:
    await hass.config.async_update(internal_url="http://192.168.1.2:8123")
    hass.states.async_set(PLAYER, "idle", {"volume_level": 0.3})
    play = async_mock_service(hass, "media_player", "play_media")
    for name in ("media_stop", "volume_set"):
        async_mock_service(hass, "media_player", name)
    steps = [{"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 0}, {"type": "wait", "seconds": 600}, {"type": "notify"}]
    key = f"{WORKFLOW_STORE_KEY}.neustart"
    run = {"trigger": "home", "index": 1, "test": False, "snapshot": {}, "sonos": [], "steps": None,
           "until": {"index": 1, "at": (dt_util.utcnow() + timedelta(seconds=500)).isoformat()}}
    hass_storage[key] = {"version": 1, "minor_version": 1, "key": key, "data": run}
    data = {"mode": "home", "deadline": None, "bypassed": [], "triggered_by": WINDOW, "changed_by": None}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, "triggered"), data)])
    for entity in (FRONT_DOOR, WINDOW, MOTION):
        hass.states.async_set(entity, "off")
    entry = MockConfigEntry(domain=DOMAIN, entry_id="neustart", title="Haus", data={"name": "Haus"}, options=options(workflows={"home": steps}))
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert len(play) == 1, "der Alarmton bis zum Deaktivieren läuft wieder, genau einmal"


async def _restart_in_alarm(hass: HomeAssistant, hass_storage, steps: list[dict[str, Any]], tones: list[dict[str, Any]] | None) -> list[ServiceCall]:
    """Neustart mitten im Alarm: der Ablauf stand bei Schritt 2 (Warten), der Ton (Schritt 1) lief nebenher, `tones` wie gespeichert."""
    await hass.config.async_update(internal_url="http://192.168.1.2:8123")
    hass.states.async_set(PLAYER, "idle", {"volume_level": 0.3})
    play = async_mock_service(hass, "media_player", "play_media")
    for name in ("media_stop", "volume_set"):
        async_mock_service(hass, "media_player", name)
    key = f"{WORKFLOW_STORE_KEY}.neustart"
    run: dict[str, Any] = {"trigger": "home", "index": 1, "test": False, "snapshot": {}, "sonos": [], "steps": None,
                           "until": {"index": 1, "at": (dt_util.utcnow() + timedelta(seconds=500)).isoformat()}}
    if tones is not None:
        run["tones"] = tones
    hass_storage[key] = {"version": 1, "minor_version": 1, "key": key, "data": run}
    data = {"mode": "home", "deadline": None, "bypassed": [], "triggered_by": WINDOW, "changed_by": None}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, "triggered"), data)])
    for entity in (FRONT_DOOR, WINDOW, MOTION):
        hass.states.async_set(entity, "off")
    entry = MockConfigEntry(domain=DOMAIN, entry_id="neustart", title="Haus", data={"name": "Haus"}, options=options(workflows={"home": steps}))
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    return play


async def test_tone_with_a_duration_plays_its_rest_after_a_restart(hass: HomeAssistant, hass_storage) -> None:
    steps = [{"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 120}, {"type": "wait", "seconds": 600}]
    play = await _restart_in_alarm(hass, hass_storage, steps, [{"index": 0, "until": (dt_util.utcnow() + timedelta(seconds=40)).isoformat()}])
    assert len(play) == 1, "der Rest des Tons läuft"


@pytest.mark.parametrize("left", [-5.0, 0.9], ids=["vorbei", "weniger_als_eine_sekunde"])
async def test_tone_whose_time_is_over_stays_silent_after_a_restart(hass: HomeAssistant, hass_storage, left: float) -> None:
    """
    Nie länger als eingestellt: war die Zeit des Tons beim Wiederanlauf schon um (oder bleibt weniger als eine Sekunde), spielt er nicht noch
    einmal. Ein Rest um null würde aufgerundet sonst zur Dauer 0, also "bis zum Deaktivieren".
    """
    steps = [{"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 120}, {"type": "wait", "seconds": 600}]
    play = await _restart_in_alarm(hass, hass_storage, steps, [{"index": 0, "until": (dt_util.utcnow() + timedelta(seconds=left)).isoformat()}])
    assert not play


async def test_sensor_open_after_a_restart_is_no_alarm(hass: HomeAssistant) -> None:
    """Nach einem Neustart gibt es kein Gedächtnis: ein Sensor, der beim Start offen ist, löst nie aus (Verhalten wie bis 1.86.x)."""
    data = {"mode": "home", "deadline": None, "bypassed": [], "triggered_by": None, "changed_by": None}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, "armed_home"), data)])
    hass.states.async_set(WINDOW, "on")
    await setup_alarm(hass)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


# ----- M2: Sperre nach falschen Codes -----


async def _wrong(hass: HomeAssistant, times: int = CODE_MAX_ATTEMPTS) -> None:
    for _ in range(times):
        with pytest.raises(ServiceValidationError) as err:
            await call(hass, "alarm_disarm", code="0000")
        assert err.value.translation_key == "invalid_code"


async def _locked_seconds(hass: HomeAssistant) -> int:
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_disarm", code="1234")
    assert err.value.translation_key == "code_locked"
    return int(err.value.translation_placeholders["seconds"])


async def test_lockout_grows_up_to_fifteen_minutes(hass: HomeAssistant, freezer) -> None:
    await _with_code(hass)
    await call(hass, "alarm_arm_away", code="1234")
    for expected in (*CODE_LOCKOUT_STEPS, CODE_LOCKOUT_STEPS[-1]):
        await _wrong(hass)
        assert expected <= await _locked_seconds(hass) <= expected + 1
        await advance(hass, freezer, expected + 1)
    assert CODE_LOCKOUT_STEPS[-1] == 900
    # Der richtige Code beginnt von vorn
    await call(hass, "alarm_disarm", code="1234")
    await call(hass, "alarm_arm_away", code="1234")
    await _wrong(hass)
    assert await _locked_seconds(hass) <= CODE_LOCKOUT_STEPS[0] + 1


async def test_lockout_survives_a_reload(hass: HomeAssistant) -> None:
    """Jedes Speichern im Panel lädt neu: bis 1.86.x waren Zähler und Sperre danach vergessen."""
    entry = await _with_code(hass)
    await call(hass, "alarm_arm_away", code="1234")
    await _wrong(hass)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    await _locked_seconds(hass)


async def test_failed_attempts_survive_a_reload(hass: HomeAssistant) -> None:
    entry = await _with_code(hass)
    await call(hass, "alarm_arm_away", code="1234")
    await _wrong(hass, CODE_MAX_ATTEMPTS - 1)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    await _wrong(hass, 1)
    await _locked_seconds(hass)


async def test_wrong_codes_are_logged_and_a_lockout_is_reported(hass: HomeAssistant, hass_ws_client) -> None:
    pushes = async_mock_service(hass, "notify", "handy")
    entry = await _with_code(hass)
    await _notify_settings(hass, hass_ws_client)
    await call(hass, "alarm_arm_away", code="1234")
    await _wrong(hass)
    await settle(hass)
    assert [e["attempts"] for e in _events(entry, "code_failed")] == [5, 4, 3, 2, 1]
    assert _events(entry, "code_locked")[0]["seconds"] == CODE_LOCKOUT_STEPS[0]
    locked = [p for p in pushes if "1 minutes" in p.data["message"] or "locked" in p.data["message"]]
    assert len(locked) == 1
    assert not any("0000" in str(p.data) or "1234" in str(p.data) for p in pushes), "nie der Code"
    assert not any("0000" in str(e) for e in entry.runtime_data.events.events)


# ----- M3: Wechsel des Modus verlangt den Code -----


async def test_mode_change_while_armed_needs_the_code(hass: HomeAssistant) -> None:
    await _with_code(hass, code_arm_required=False)
    await call(hass, "alarm_arm_away")  # aus "deaktiviert" ohne Code wie bisher
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_arm_home")
    assert err.value.translation_key == "code_mode_change"
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_arm_home", code="9999")
    assert err.value.translation_key == "invalid_code"
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await call(hass, "alarm_arm_home", code="1234")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_mode_change_during_the_exit_delay_needs_the_code(hass: HomeAssistant) -> None:
    code_hash, salt = hash_code("1234")
    await setup_alarm(hass, code_hash=code_hash, code_salt=salt, code_arm_required=False, exit_delay_away=30)
    await call(hass, "alarm_arm_away")
    assert state(hass) == AlarmControlPanelState.ARMING
    with pytest.raises(ServiceValidationError):
        await call(hass, "alarm_arm_home")
    assert state(hass) == AlarmControlPanelState.ARMING


async def test_mode_change_without_any_code_stays_free(hass: HomeAssistant) -> None:
    await setup_alarm(hass, exit_delay_away=0, exit_delay_home=0)
    await call(hass, "alarm_arm_away")
    await call(hass, "alarm_arm_home")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_routines_switch_modes_without_the_code(hass: HomeAssistant) -> None:
    """Routinen und die Knöpfe der Meldung (skip_code) hat ein Administrator eingerichtet: sie brauchen keinen Code."""
    entry = await _with_code(hass)
    await call(hass, "alarm_arm_away", code="1234")
    await entry.runtime_data.controller.async_arm("home", None, skip_code=True)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


# ----- M5: wiederhergestellte Eingangsverzögerung -----


async def test_restored_entry_delay_is_never_longer_than_configured(hass: HomeAssistant) -> None:
    """Die Uhr eines Raspberry Pi ohne Echtzeituhr kann nach einem Stromausfall zurückliegen: die Frist zählt nie länger als eingestellt."""
    data = {"mode": "home", "deadline": (dt_util.utcnow() + timedelta(seconds=1800)).isoformat(), "bypassed": [], "triggered_by": FRONT_DOOR, "changed_by": None}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, "pending"), data)])
    entry = await setup_alarm(hass, entry_delay=20)
    left = entry.runtime_data.controller.delay_left()
    assert state(hass) == AlarmControlPanelState.PENDING
    assert left is not None and left <= 21


async def test_restored_exit_delay_is_never_longer_than_configured(hass: HomeAssistant) -> None:
    data = {"mode": "away", "deadline": (dt_util.utcnow() + timedelta(seconds=7200)).isoformat(), "bypassed": [], "triggered_by": None, "changed_by": None}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, "arming"), data)])
    entry = await setup_alarm(hass, exit_delay_away=30)
    left = entry.runtime_data.controller.delay_left()
    assert state(hass) == AlarmControlPanelState.ARMING
    assert left is not None and left <= 31


# ----- M6: flatternder Sensor -----


async def test_flapping_sensor_reports_unreachable_once_per_gap(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    pushes = async_mock_service(hass, "notify", "handy")
    entry = await setup_alarm(hass, exit_delay_away=0)
    await _notify_settings(hass, hass_ws_client)
    await call(hass, "alarm_arm_away")
    for _ in range(20):
        await _set(hass, WINDOW, "unavailable")
        await _set(hass, WINDOW, "off")
    assert len(pushes) == 1
    assert len(_events(entry, "sensor_offline")) == 20, "das Protokoll hält jeden Abriss fest"
    await advance(hass, freezer, OFFLINE_NOTIFY_GAP + 1)
    await _set(hass, WINDOW, "unavailable")
    assert len(pushes) == 2


async def test_other_sensors_are_reported_independently(hass: HomeAssistant, hass_ws_client) -> None:
    pushes = async_mock_service(hass, "notify", "handy")
    await setup_alarm(hass, exit_delay_away=0)
    await _notify_settings(hass, hass_ws_client)
    await call(hass, "alarm_arm_away")
    await _set(hass, WINDOW, "unavailable")
    await _set(hass, MOTION, "unavailable")
    assert len(pushes) == 2


# ----- O1: Diagnose und Dienst "Quittieren" -----


async def test_diagnostics_never_contain_secrets(hass: HomeAssistant, hass_ws_client) -> None:
    import json

    code_hash, salt = hash_code("84615297")
    entry = await setup_alarm(hass, code_hash=code_hash, code_salt=salt)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/add_code", "entry_id": entry.entry_id, "name": "Anna", "code": "73920518"})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    entry = hass.config_entries.async_get_entry(entry.entry_id)
    result = await async_get_config_entry_diagnostics(hass, entry)
    text = json.dumps(result, default=str)
    # Seit 1.90.0 ist der Hauptcode beim Laden ein Code pro Person geworden: zwei Codes, keiner davon in der Diagnose
    for secret in ("84615297", "73920518", code_hash, salt, *(c[k] for c in entry.options["codes"] for k in ("hash", "salt"))):
        assert secret not in text
    assert result["controller"]["state"] == "disarmed" and result["controller"]["personal_codes"] == 2


async def test_acknowledge_service_exists_without_a_loaded_system(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass)
    assert hass.services.has_service(DOMAIN, "acknowledge")
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.services.has_service(DOMAIN, "acknowledge"), "Quality Scale action-setup: der Dienst bleibt, die Anlage meldet sich als nicht geladen"


def test_realarm_is_part_of_the_backup(hass: HomeAssistant) -> None:
    """Der Nachalarm ist eine Einstellung der Anlage: im Backup, beim Einlesen geprüft (1 bis 10)."""
    import voluptuous as vol

    backup = {"format": FORMAT, "version": VERSION, "systems": [{"title": "Haus", "options": {"realarm_enabled": True, "realarm_count": 5}}]}
    restored = validate(backup, hass)["systems"][0]["options"]
    assert restored["realarm_enabled"] is True and restored["realarm_count"] == 5
    for bad in (0, 11, "viele"):
        backup["systems"][0]["options"]["realarm_count"] = bad
        with pytest.raises(vol.Invalid):
            validate(backup, hass)
