"""
Code-Review 2026-11-17 (1.58.0): die Fehler aus diesem Review, jeder zuerst gegen den alten Code rot gesehen.

Zusagen, die hier gesichert sind:
- Eine während des Neustarts abgelaufene Eingangsverzögerung löst die Alarmaktionen, die Alarmmeldung, das Protokoll und die Aufzeichnung aus
  (vorher stand nur der Zustand auf "Alarm").
- Die Sperre nach falschen Codes lässt sich nicht mit gleichzeitigen Versuchen umgehen.
- Der Zustand der Anlage übersteht einen Absturz von Home Assistant (eigene Ablage, sofort geschrieben).
- Ein beschädigter gespeicherter Stand hindert die Anlage nie am Laden und deaktiviert sie nie still.
- Weder der Optionsdialog noch eine Sicherung schalten den Modus ab, in dem die Anlage scharf ist.
- Kein Befehl des Panels wartet auf fremde Aufgaben von Home Assistant.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import CoreState, HomeAssistant, State
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service, mock_restore_cache_with_extra_data

from custom_components.alarmageddon import sound_loop
from custom_components.alarmageddon.code import hash_code
from custom_components.alarmageddon.const import CODE_MAX_ATTEMPTS, DOMAIN, STATE_STORE_KEY
from custom_components.alarmageddon.controller import AlarmController

from .conftest import ALARM, FRONT_DOOR, MOTION, WINDOW, options, setup_alarm
from .test_alarm import advance, call, open_sensor, settle, state
from .test_config_flow import _sections

SIREN = "switch.sirene"
PLAYER = "media_player.wohnzimmer"
ENTRY_ID = "e_review"
STATE_KEY = f"{STATE_STORE_KEY}.{ENTRY_ID}"
WORKFLOW_KEY = f"alarmageddon.workflow.{ENTRY_ID}"
SIREN_ON = [{"type": "action", "action": "switch.turn_on", "target": [SIREN]}]


def _restore_cache(hass: HomeAssistant, last: str, **extra: Any) -> None:
    data = {"mode": None, "deadline": None, "bypassed": [], "triggered_by": None, "changed_by": None, **extra}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, last), data)])


async def _boot(hass: HomeAssistant, **overrides: Any) -> MockConfigEntry:
    """Wie ein Start von Home Assistant: erst einrichten, dann "gestartet". Feste Kennung, damit die Ablagen der Anlage vorab gefüllt werden können."""
    hass.set_state(CoreState.not_running)
    for entity in (FRONT_DOOR, WINDOW, MOTION):
        hass.states.async_set(entity, "off")
    entry = MockConfigEntry(domain=DOMAIN, entry_id=ENTRY_ID, title="Haus", data={"name": "Haus"}, options=options(**overrides))
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_start()
    await settle(hass)
    return entry


def _alarm_recipient(hass_storage: dict[str, Any]) -> None:
    hass_storage["alarmageddon.settings"] = {"version": 1, "key": "alarmageddon.settings", "data": {"notify": {"alarm_targets": ["notify.handy"]}}}


# ----- Eingangsverzögerung läuft während des Neustarts ab -----


async def test_entry_delay_over_during_restart_runs_the_alarm_actions_and_the_message(hass: HomeAssistant, hass_storage) -> None:
    """Im Zweifel alarmieren heisst mehr als der Zustand: Sirene, Meldung, Protokoll und Aufzeichnung gehören dazu."""
    siren = async_mock_service(hass, "switch", "turn_on")
    pushes = async_mock_service(hass, "notify", "handy")
    _alarm_recipient(hass_storage)
    _restore_cache(hass, "pending", mode="home", triggered_by=FRONT_DOOR, deadline=(dt_util.utcnow() - timedelta(seconds=5)).isoformat())
    entry = await _boot(hass, workflows={"home": SIREN_ON})
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert len(siren) == 1 and siren[0].data["entity_id"] == [SIREN]
    assert len(pushes) == 1 and "Alarm" in pushes[0].data["title"]
    events = entry.runtime_data.events.events
    assert events[0]["state"] == "triggered" and events[0]["sensor"] == FRONT_DOOR
    recording = entry.runtime_data.recorder.current
    assert recording is not None and any(e.get("kind") == "step" for e in recording["entries"])


async def test_entry_delay_still_running_after_restart_alarms_at_its_end(hass: HomeAssistant, freezer) -> None:
    """Die Restzeit läuft weiter; am Ende laufen die Aktionen genau einmal (nicht zusätzlich durch die Nachholung beim Start)."""
    siren = async_mock_service(hass, "switch", "turn_on")
    _restore_cache(hass, "pending", mode="home", triggered_by=FRONT_DOOR, deadline=(dt_util.utcnow() + timedelta(seconds=8)).isoformat())
    await _boot(hass, workflows={"home": SIREN_ON})
    assert state(hass) == AlarmControlPanelState.PENDING and not siren
    await advance(hass, freezer, 9)
    assert state(hass) == AlarmControlPanelState.TRIGGERED and len(siren) == 1


async def test_disarm_right_after_the_restart_wins_over_the_expired_entry_delay(hass: HomeAssistant) -> None:
    """Die Nachholung löst nur aus, wenn die Anlage noch in der Eingangsverzögerung steht."""
    entry = await setup_alarm(hass)
    ctl = entry.runtime_data.controller
    await ctl.async_arm("home", None)
    data = {**ctl.restore_data(), "deadline": (dt_util.utcnow() - timedelta(seconds=5)).isoformat()}
    ctl.async_restore("pending", data)
    assert state(hass) == AlarmControlPanelState.PENDING
    await ctl.async_disarm(None)
    ctl.async_finish_restore()
    assert state(hass) == AlarmControlPanelState.DISARMED
    # Und ohne abgelaufene Verzögerung geschieht nichts
    ctl.async_finish_restore()
    assert state(hass) == AlarmControlPanelState.DISARMED


# ----- Ablauf nach dem Neustart -----


async def test_restart_in_alarm_never_resumes_the_tones_of_a_delay_instead_of_the_alarm_actions(hass: HomeAssistant, hass_storage) -> None:
    """Gespeichert ist nur ein Lauf neben dem Alarm (Ton der Eingangsverzögerung): nach dem Neustart im Alarm laufen die Alarmaktionen."""
    siren = async_mock_service(hass, "switch", "turn_on")
    light = async_mock_service(hass, "light", "turn_on")
    side = {"trigger": "home", "index": 0, "test": False, "after": True, "phase": "pending", "snapshot": {}, "sonos": [],
            "steps": [{"type": "action", "action": "light.turn_on", "target": ["light.flur"], "data": {}, "restore": False}]}
    hass_storage[WORKFLOW_KEY] = {"version": 1, "key": WORKFLOW_KEY, "data": side}
    _restore_cache(hass, "triggered", mode="home", triggered_by=WINDOW)
    await _boot(hass, workflows={"home": SIREN_ON})
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert len(siren) == 1, "die Alarmaktionen laufen"
    assert not light, "die Schritte der Verzögerung laufen nicht als Alarmablauf weiter"


async def test_alarm_without_a_saved_flow_starts_its_actions_after_the_restart(hass: HomeAssistant) -> None:
    """Home Assistant fiel aus, bevor der Stand des Ablaufs geschrieben war: die Aktionen beginnen beim Start."""
    siren = async_mock_service(hass, "switch", "turn_on")
    _restore_cache(hass, "triggered", mode="home", triggered_by=WINDOW)
    await _boot(hass, workflows={"home": SIREN_ON})
    assert len(siren) == 1


async def test_a_silenced_alarm_stays_silent_after_a_restart(hass: HomeAssistant, hass_storage) -> None:
    """ "Alarmton stumm" beendet den Ablauf dieses Alarms: ein Neustart von Home Assistant beginnt ihn nicht von vorn."""
    siren = async_mock_service(hass, "switch", "turn_on")
    hass.states.async_set(SIREN, "off")
    entry = await setup_alarm(hass, workflows={"home": SIREN_ON})
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    assert len(siren) == 1
    assert await entry.runtime_data.workflow.async_silence()
    await settle(hass)
    key = f"alarmageddon.workflow.{entry.entry_id}"
    assert hass_storage[key]["data"] == {"silenced": True}
    # Neuladen mitten im stummen Alarm (wie ein Neustart: der Zustand bleibt "Alarm")
    await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert len(siren) == 1, "nicht noch einmal"
    # Mit dem Alarm verschwindet die Marke
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert key not in hass_storage


# ----- Code-Sperre -----


async def test_parallel_code_attempts_cannot_get_around_the_lockout(hass: HomeAssistant) -> None:
    """Viele Versuche im selben Augenblick: nach CODE_MAX_ATTEMPTS falschen ist gesperrt, auch der richtige Code danach hilft nicht."""
    code_hash, salt = hash_code("4321")
    await setup_alarm(hass, code_hash=code_hash, code_salt=salt)
    await call(hass, "alarm_arm_home")

    async def attempt(code: str) -> str:
        try:
            await hass.services.async_call("alarm_control_panel", "alarm_disarm", {"entity_id": ALARM, "code": code}, blocking=True)
        except ServiceValidationError as err:
            return str(err.translation_key)
        return "ok"

    codes = [f"{n:04d}" for n in range(4300, 4322)]  # 21 falsche, der richtige (4321) zuletzt
    results = await asyncio.gather(*(attempt(code) for code in codes))
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert results.count("invalid_code") == CODE_MAX_ATTEMPTS
    assert results.count("code_locked") == len(codes) - CODE_MAX_ATTEMPTS and "ok" not in results


# ----- Eigene Ablage des Zustands -----


async def test_the_state_is_written_at_once_and_wins_over_an_older_state_of_home_assistant(hass: HomeAssistant, hass_storage) -> None:
    """
    Home Assistant sichert Entitäten nur alle 15 Minuten und beim sauberen Beenden. Nach einem Absturz kurz nach dem Scharfschalten kennt
    es noch "deaktiviert"; die eigene Ablage kennt "scharf".
    """
    entry = await setup_alarm(hass)
    key = f"{STATE_STORE_KEY}.{entry.entry_id}"
    await call(hass, "alarm_arm_home")
    await settle(hass)
    saved = hass_storage[key]["data"]
    assert saved["state"] == "armed_home" and saved["data"]["mode"] == "home"
    text = str(hass_storage[key])
    assert "hash" not in text and "salt" not in text


async def test_after_a_crash_the_own_state_counts_not_the_stale_one(hass: HomeAssistant, hass_storage) -> None:
    since = dt_util.utcnow().isoformat()
    own = {"mode": "away", "deadline": None, "bypassed": [], "triggered_by": None, "changed_by": "Anna", "armed_at": since, "armed_by": "Anna",
           "state_since": since, "alarm_flows": []}
    hass_storage[STATE_KEY] = {"version": 1, "key": STATE_KEY, "data": {"state": "armed_away", "data": own, "saved": since}}
    _restore_cache(hass, "disarmed", state_since=(dt_util.utcnow() - timedelta(minutes=14)).isoformat())
    await _boot(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    assert hass.states.get(ALARM).attributes["armed_by"] == "Anna"


async def test_a_newer_state_of_home_assistant_wins_over_an_own_state_that_could_not_be_written(hass: HomeAssistant, hass_storage) -> None:
    old = (dt_util.utcnow() - timedelta(hours=2)).isoformat()
    own = {"mode": None, "deadline": None, "bypassed": [], "triggered_by": None, "changed_by": None, "state_since": old, "alarm_flows": []}
    hass_storage[STATE_KEY] = {"version": 1, "key": STATE_KEY, "data": {"state": "disarmed", "data": own, "saved": old}}
    _restore_cache(hass, "armed_home", mode="home", state_since=dt_util.utcnow().isoformat())
    await _boot(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


@pytest.mark.parametrize("stored", [None, "kaputt", [], {"state": 5, "data": {}}, {"state": "armed_home"}, {"state": "armed_home", "data": "x"}])
async def test_a_damaged_own_state_falls_back_to_home_assistant(hass: HomeAssistant, hass_storage, stored) -> None:
    hass_storage[STATE_KEY] = {"version": 1, "key": STATE_KEY, "data": stored}
    _restore_cache(hass, "armed_home", mode="home")
    await _boot(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_removing_the_system_removes_its_state(hass: HomeAssistant, hass_storage) -> None:
    entry = await setup_alarm(hass)
    key = f"{STATE_STORE_KEY}.{entry.entry_id}"
    await call(hass, "alarm_arm_home")
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert key in hass_storage
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert key not in hass_storage


def test_which_state_counts() -> None:
    pick = AlarmController.newer_state
    assert pick(None, "armed_home", {"mode": "home"}) == ("armed_home", {"mode": "home"})
    assert pick(("armed_away", {"state_since": "2026-11-17T10:00:00+00:00"}), None, None)[0] == "armed_away"
    # Gleich alt oder ohne Zeit: der eigene Stand
    assert pick(("armed_away", {}), "disarmed", {})[0] == "armed_away"
    assert pick(("armed_away", {"state_since": "2026-11-17T10:00:00+00:00"}), "disarmed", {"state_since": "2026-11-17T10:00:00+00:00"})[0] == "armed_away"
    # Nachweislich neuer: der von Home Assistant; eine unlesbare Zeit zählt nie als neuer
    assert pick(("armed_away", {"state_since": "2026-11-17T10:00:00+00:00"}), "disarmed", {"state_since": "2026-11-17T10:00:01+00:00"})[0] == "disarmed"
    assert pick(("armed_away", {"state_since": "2026-11-17T10:00:00+00:00"}), "disarmed", {"state_since": 7})[0] == "armed_away"


# ----- Beschädigter Stand -----


@pytest.mark.parametrize("extra", [
    {"bypassed": 5}, {"bypassed": "x"}, {"bypassed": [1, None]}, {"deadline": 12345}, {"deadline": "2020-01-01T10:00:00"}, {"deadline": ["x"]},
    {"armed_at": 5}, {"armed_at": "gestern"}, {"alarm_flows": "home"}, {"alarm_flows": [1, {}]}, {"state_since": 7}, {"triggered_by": {"a": 1}},
    {"changed_by": ["x"]}, {"armed_by": 3},
])
@pytest.mark.parametrize(("last", "expected"), [("armed_home", "armed_home"), ("arming", "armed_home"), ("pending", "triggered"), ("triggered", "triggered")])
async def test_damaged_state_never_stops_the_system_or_disarms_it(hass: HomeAssistant, last: str, expected: str, extra: dict) -> None:
    """Jeder Wert des gespeicherten Stands kann beschädigt sein: die Entität lädt, und die Anlage bleibt scharf bzw. alarmiert."""
    _restore_cache(hass, last, **{"mode": "home", **extra})
    await _boot(hass)
    if last == "triggered" and extra.get("deadline") == "2020-01-01T10:00:00":
        expected = "armed_home"  # lesbare, abgelaufene Alarmdauer aus alten Ständen (bis 0.24.0): zurück in den Modus, nie deaktiviert
    assert state(hass) == expected


# ----- Aktiver Modus wird nie abgeschaltet -----


async def test_options_dialog_never_switches_off_the_armed_mode(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass, night_enabled=True)
    await call(hass, "alarm_arm_night")
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], _sections(behaviour={"night_enabled": False}))
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.FORM and result["errors"] == {"base": "mode_active"}
    assert state(hass) == AlarmControlPanelState.ARMED_NIGHT and entry.options["night_enabled"] is True
    # Deaktiviert geht es
    await call(hass, "alarm_disarm")
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], _sections(behaviour={"night_enabled": False}))
    assert result["type"] is FlowResultType.CREATE_ENTRY


@pytest.mark.parametrize("arm", ["alarm_arm_night", "pending"])
async def test_restoring_a_backup_never_switches_off_the_armed_mode(hass: HomeAssistant, hass_ws_client, arm: str) -> None:
    """Auch in der Eingangsverzögerung: die Sicherung wird als Ganzes abgelehnt, nichts ändert sich."""
    entry = await setup_alarm(hass, night_enabled=True, zone_night=[FRONT_DOOR, WINDOW])
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/export"})
    backup = (await client.receive_json())["result"]
    backup["systems"][0]["options"]["night_enabled"] = False
    backup["systems"][0]["options"]["entry_delay"] = 99
    await call(hass, "alarm_arm_night")
    expected = AlarmControlPanelState.ARMED_NIGHT
    if arm == "pending":
        await open_sensor(hass, FRONT_DOOR)
        expected = AlarmControlPanelState.PENDING
    assert state(hass) == expected
    await client.send_json({"id": 2, "type": "alarmageddon/import", "data": backup})
    answer = await client.receive_json()
    await hass.async_block_till_done()
    assert not answer["success"] and answer["error"]["code"] == "mode_active"
    assert state(hass) == expected
    assert entry.options["night_enabled"] is True and entry.options["entry_delay"] != 99
    # Die Vorschau (dry_run) ändert nichts und bleibt möglich; deaktiviert lässt sich die Sicherung einspielen
    await call(hass, "alarm_disarm")
    await client.send_json({"id": 3, "type": "alarmageddon/import", "data": backup})
    assert (await client.receive_json())["success"]


# ----- Meldung der Eingangsverzögerung -----


async def test_entry_delay_message_names_the_delay_of_the_sensor(hass: HomeAssistant, hass_ws_client) -> None:
    pushes = async_mock_service(hass, "notify", "handy")
    await setup_alarm(hass, sensor_options={FRONT_DOOR: {"entry_delay": 7}})
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/save_notify", "notify": {"alarm_targets": ["notify.handy"], "types": {"pending": {"enabled": True}}}})
    assert (await client.receive_json())["success"]
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, FRONT_DOOR)
    assert state(hass) == AlarmControlPanelState.PENDING
    assert "7 s" in pushes[-1].data["message"] and "20 s" not in pushes[-1].data["message"]


# ----- Überwachung: Warten -----


async def test_the_wait_of_a_monitoring_rule_never_leaves_the_event_loop(hass: HomeAssistant, freezer, monkeypatch) -> None:
    """
    Der Zeitgeber von "Warten" hat eine @callback-Funktion als Ziel (LEARNINGS): eine lambda liefe als Executor-Job in einem Thread und
    weckte den Ablauf von dort (nicht threadsicher; im Debug-Modus von asyncio käme der Schritt danach nie).
    """
    from homeassistant.core import is_callback

    from custom_components.alarmageddon import monitor as monitor_module

    from .test_monitor import SWITCH, _rule, _setup, _value, set_temp, tick

    on = async_mock_service(hass, "switch", "turn_on")
    targets: list[bool] = []
    original = monitor_module.async_call_later

    def watching(hass_, delay, action):
        targets.append(is_callback(action))
        return original(hass_, delay, action)

    monkeypatch.setattr(monitor_module, "async_call_later", watching)
    steps = [{"type": "wait", "seconds": 30}, {"type": "action", "action": "switch.turn_on", "target": [SWITCH], "data": {}}]
    await _setup(hass, [_rule(_value(), hold=0, out=steps, ok=[])])
    await set_temp(hass, "9")
    assert not on
    await tick(hass, freezer, 31)
    await tick(hass, freezer, 1)
    assert len(on) == 1
    assert targets and all(targets), "jeder Zeitgeber der Überwachung läuft im Ereignis-Loop"


# ----- Befehle warten nie auf fremde Aufgaben -----


async def test_deleting_and_creating_a_system_never_waits_for_other_tasks(hass: HomeAssistant, hass_ws_client) -> None:
    """Eine Automation mit langer Wartezeit ist eine laufende Aufgabe von Home Assistant: die Antwort kommt trotzdem sofort."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    blocker = asyncio.Event()

    async def long_running() -> None:
        await blocker.wait()

    hass.async_create_task(long_running())
    try:
        await client.send_json({"id": 1, "type": "alarmageddon/create_system", "name": "Garage"})
        created = await asyncio.wait_for(client.receive_json(), 5)
        assert created["success"]
        await client.send_json({"id": 2, "type": "alarmageddon/delete_system", "entry_id": entry.entry_id, "name": "Haus"})
        deleted = await asyncio.wait_for(client.receive_json(), 5)
        assert deleted["success"]
        assert hass.config_entries.async_get_entry(entry.entry_id) is None
    finally:
        blocker.set()
        await hass.async_block_till_done()


# ----- Aufzeichnung -----


async def test_the_recording_reaches_the_disk_while_entries_keep_coming(hass: HomeAssistant, hass_storage, freezer) -> None:
    """Ein Alarm mit laufend neuen Einträgen (Bewegungsmelder alle Sekunde) steht spätestens zwei Sekunden nach dem ersten auf der Platte."""
    entry = await setup_alarm(hass)
    key = f"alarmageddon.recordings.{entry.entry_id}"
    await call(hass, "alarm_arm_away")
    await advance(hass, freezer, 31)
    await open_sensor(hass, WINDOW)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    for index in range(6):
        hass.states.async_set(MOTION, "on" if index % 2 == 0 else "off")
        freezer.tick(timedelta(seconds=1))
        async_fire_time_changed(hass, dt_util.utcnow())
        await settle(hass)
    assert key in hass_storage, "der Alarm ist geschrieben, obwohl alle Sekunde ein Eintrag dazukam"
    assert any(e.get("sensor") == MOTION for e in hass_storage[key]["data"][0]["entries"])


# ----- Ton in der verlangten Länge -----


async def test_many_speakers_fetching_the_same_tone_build_it_once(hass: HomeAssistant, hass_client_no_auth, monkeypatch) -> None:
    await setup_alarm(hass)
    client = await hass_client_no_auth()
    calls: list[tuple[str, int]] = []
    original = sound_loop.render

    def counting(name: str, milliseconds: int, custom=None) -> bytes:
        calls.append((name, milliseconds))
        return original(name, milliseconds, custom)

    monkeypatch.setattr(sound_loop, "render", counting)
    answers = await asyncio.gather(*(client.get("/alarmageddon_loop/7000/siren.wav") for _ in range(6)))
    assert all(a.status == 200 for a in answers)
    assert calls == [("siren", 7000)]


# ----- Kosten je Sensorereignis -----


async def test_is_always_agrees_with_always_sensors_for_every_watched_sensor(hass: HomeAssistant) -> None:
    smoke = "binary_sensor.rauch_flur"
    hass.states.async_set(smoke, "off", {"device_class": "smoke"})
    for flags in ({}, {"always_enabled": False}, {"sensor_options": {WINDOW: {"always": True}, smoke: {"always": False}}},
                  {"per_mode_sensors": True, "sensor_modes": {"always": {MOTION: {"always": True}}, "home": {WINDOW: {"always": True}}}}):
        entry = await setup_alarm(hass, title=f"Haus {len(hass.config_entries.async_entries(DOMAIN))}", sensors=[smoke], **flags)
        ctl = entry.runtime_data.controller
        watched = ctl.all_sensors() | {smoke}
        assert {e for e in watched if ctl.is_always(e)} == ctl.always_sensors(), flags


async def test_status_sensor_does_not_search_the_registry_on_every_sensor_event(hass: HomeAssistant, monkeypatch) -> None:
    from custom_components.alarmageddon import sensor as sensor_module

    await setup_alarm(hass)
    calls = 0
    original = sensor_module.battery_of

    def counting(*args: Any) -> dict[str, str]:
        nonlocal calls
        calls += 1
        return original(*args)

    monkeypatch.setattr(sensor_module, "battery_of", counting)
    for index in range(10):
        hass.states.async_set(MOTION, "on" if index % 2 == 0 else "off")
        await hass.async_block_till_done()
    assert calls == 0


# ----- Antwort für die Übersicht -----


async def test_data_lists_measured_values_only_with_monitoring_and_never_waits_long_for_the_history(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    from custom_components.alarmageddon import last_change, websocket_api

    hass.states.async_set("sensor.keller_temperatur", "18", {"device_class": "temperature", "unit_of_measurement": "°C"})
    asked: list[list[str]] = []
    release = asyncio.Event()

    async def slow_history(_hass: HomeAssistant, entities: list[str]) -> dict[str, str]:
        asked.append(list(entities))
        await release.wait()
        return {WINDOW: "2026-11-01T10:00:00+00:00"}

    monkeypatch.setattr(last_change, "async_history_changes", slow_history)
    monkeypatch.setattr(websocket_api, "LAST_CHANGE_WAIT", 0.05)
    entry = await setup_alarm(hass, monitor_sensors=["sensor.gewaehlt"])
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/data"})
    data = (await asyncio.wait_for(client.receive_json(), 5))["result"]
    # Kein Kandidat in der Antwort für die Übersicht (seit 1.60.0: nur die gewählten Sensoren), und der Verlauf hält die Antwort nicht auf
    assert "sensor.keller_temperatur" not in data["sensors"] and "sensor.gewaehlt" in data["sensors"]
    await client.send_json({"id": 10, "type": "alarmageddon/sensor_candidates"})
    assert "sensor.keller_temperatur" not in (await client.receive_json())["result"]["sensors"], "Überwachung aus: kein Messwert als Kandidat"
    assert WINDOW not in data["last_changes"]
    assert asked and all(e.startswith("binary_sensor.") for e in asked[0]), "Messwerte werden nie im Verlauf gesucht"
    release.set()
    await settle(hass)
    await client.send_json({"id": 20, "type": "alarmageddon/data"})
    assert (await client.receive_json())["result"]["last_changes"][WINDOW] == "2026-11-01T10:00:00+00:00"
    assert len(asked) == 1, "nur einmal je Lauf von Home Assistant"
    # Überwachung an: die Messwerte stehen zur Wahl
    hass.config_entries.async_update_entry(entry, options={**entry.options, "monitor_enabled": True})
    await hass.async_block_till_done()
    await client.send_json({"id": 30, "type": "alarmageddon/sensor_candidates"})
    assert "sensor.keller_temperatur" in (await client.receive_json())["result"]["sensors"]
    await client.send_json({"id": 40, "type": "alarmageddon/data"})
    assert "sensor.keller_temperatur" not in (await client.receive_json())["result"]["sensors"], "auch mit Überwachung: die Übersicht bekommt keine Kandidaten"


# ----- Zeitangaben einheitlich (1.61.0) -----


@pytest.mark.parametrize(("seconds", "expected"), [(0, "0 s"), (5, "5 s"), (59, "59 s"), (60, "1 min"), (90, "1 min 30 s"), (120, "2 min"),
                                                  (600, "10 min"), (3600, "1 h"), (3725, "1 h 2 min 5 s"), (7200, "2 h")])
def test_format_duration_like_the_panel(seconds: int, expected: str) -> None:
    """Dieselben Regeln wie `fmtDur` im Panel (common.js): unter 60 s Sekunden, ab 60 s Minuten und Sekunden, ab 1 h Stunden; Nullen entfallen."""
    from custom_components.alarmageddon.notify import format_duration

    assert format_duration(seconds) == expected


async def test_entry_delay_message_shows_minutes_from_60_seconds(hass: HomeAssistant, hass_ws_client) -> None:
    pushes = async_mock_service(hass, "notify", "handy")
    await setup_alarm(hass, sensor_options={FRONT_DOOR: {"entry_delay": 120}})
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/save_notify", "notify": {"alarm_targets": ["notify.handy"], "types": {"pending": {"enabled": True}}}})
    assert (await client.receive_json())["success"]
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, FRONT_DOOR)
    assert state(hass) == AlarmControlPanelState.PENDING
    assert "2 min" in pushes[-1].data["message"] and "120 s" not in pushes[-1].data["message"]
