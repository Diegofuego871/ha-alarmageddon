"""
Aktions-Gruppe (1.59.0, Wunsch des Nutzers 2026-11-17): eine Gruppe wiederholt ihre Schritte in der Reihenfolge, eine Anzahl
Durchläufe, für eine Dauer oder bis deaktiviert wird.

Die Gruppe greift in den Ablauf der Alarmaktionen ein. Diese Tests sichern die Zusagen:

- Prüfung: je Liste nur, was dort erlaubt ist; "bis deaktiviert" nur im Ablauf des Alarms; keine Gruppe in der Gruppe, kein
  "Quittieren", kein "Rückgängig nach einer Zeit"; die Schritte zählen zur Grenze je Liste.
- Ablauf: die Zahl der Runden und die Dauer gelten genau (die Dauer wird nie überschritten, die Gruppe endet nie mitten in einer
  Runde); "Warten, bis die Aktion beendet ist" wie bei den anderen Schritten; "bis deaktiviert" wartet nie.
- Sicherheit: ein scheiternder oder hängender Schritt hält weder die Gruppe noch den Ablauf auf; Deaktivieren, Quittieren und
  "Alarmton stumm" beenden die Gruppe sofort; nach Neuladen und Neustart läuft sie weiter, nie doppelt; keine Runde ohne Pause.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant, ServiceCall, State
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service, mock_restore_cache_with_extra_data

from custom_components.alarmageddon import workflow as wf
from custom_components.alarmageddon.const import DOMAIN, GROUP_MAX_ROUNDS, GROUP_MAX_STEPS, MAX_DELAY, MAX_STEPS, RECORDINGS_ENTRIES_KEEP, TEST_SECONDS, WORKFLOW_STORE_KEY
from custom_components.alarmageddon.schemas import step_list, valid_after_step, valid_armed_step, valid_arming_step, valid_disarmed_step, valid_entry_step, valid_step

from .conftest import ALARM, FRONT_DOOR, MOTION, WINDOW, options, setup_alarm
from .test_alarm import advance, call, open_sensor, settle, state

LIGHT = "switch.licht"
SIREN = "switch.sirene"
PLAYER = "media_player.wohnzimmer"
ON = {"type": "action", "action": "switch.turn_on", "target": [LIGHT]}
OFF = {"type": "action", "action": "switch.turn_off", "target": [LIGHT]}
SIREN_ON = {"type": "action", "action": "switch.turn_on", "target": [SIREN]}
CHIME = {"type": "chime", "players": [PLAYER], "sound": "tone_pip", "duration": 3}


def _wait(seconds: int) -> dict[str, Any]:
    return {"type": "wait", "seconds": seconds}


def _group(mode: str, steps: list[dict[str, Any]], **more: Any) -> dict[str, Any]:
    return {"type": "group", "mode": mode, "steps": steps, **more}


def _services(hass: HomeAssistant) -> dict[str, list]:
    for entity in (LIGHT, SIREN):
        hass.states.async_set(entity, "off")
    hass.states.async_set(PLAYER, "idle")
    return {name: async_mock_service(hass, *name.split(".")) for name in (
        "switch.turn_on", "switch.turn_off", "media_player.play_media", "media_player.media_stop", "media_player.volume_set")}


def _to(calls: list, entity: str) -> int:
    return len([c for c in calls if c.data.get("entity_id") in ([entity], entity)])


async def _alarm(hass: HomeAssistant, steps: list[dict[str, Any]], **more: Any) -> MockConfigEntry:
    entry = await setup_alarm(hass, workflows={"home": steps}, **more)
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    return entry


async def _tick(hass: HomeAssistant, freezer, seconds: int, step: int = 1) -> None:
    """Zeit in kleinen Schritten vorstellen: die Gruppe reiht ihre Zeitgeber aneinander, jeder beginnt erst nach dem vorigen."""
    for _ in range(0, seconds, step):
        await advance(hass, freezer, step)
        await settle(hass)


def _steps_on_timeline(entry) -> list[str]:
    record = entry.runtime_data.recorder.current or entry.runtime_data.recorder.recordings[0]
    return [e["step"] for e in record["entries"] if e["kind"] == "step"]


# ----- Prüfung -----


def test_a_group_is_valid_in_the_alarm_actions_with_every_mode() -> None:
    for mode in ("count", "duration", "until_disarmed"):
        group = valid_step(_group(mode, [ON, _wait(1), {"type": "notify"}], name="Blinken"))
        assert group["mode"] == mode and [s["type"] for s in group["steps"]] == ["action", "wait", "notify"]
        assert 1 <= group["count"] <= GROUP_MAX_ROUNDS and 1 <= group["seconds"] <= MAX_DELAY
    # "Bis deaktiviert" endet nie von selbst: auf die Gruppe lässt sich nicht warten, gleich was gespeichert werden soll
    assert valid_step(_group("until_disarmed", [ON], wait=True))["wait"] is False
    assert valid_step(_group("count", [ON], count=3, wait=True))["wait"] is True
    assert "wait" not in valid_step(_group("count", [ON], count=3))


BAD_GROUPS = {
    "Gruppe in der Gruppe": _group("count", [_group("count", [ON])]),
    "Quittieren in der Gruppe": _group("count", [{"type": "acknowledge"}]),
    "Rückgängig nach einer Zeit in der Gruppe": _group("count", [{**ON, "undo_after": 30}]),
    "unbekannter Schritt in der Gruppe": _group("count", [{"type": "explode"}]),
    "mehr Schritte als erlaubt": _group("count", [ON] * (GROUP_MAX_STEPS + 1)),
    "keine Runde": _group("count", [ON], count=0),
    "zu viele Runden": _group("count", [ON], count=GROUP_MAX_ROUNDS + 1),
    "Dauer null": _group("duration", [ON], seconds=0),
    "Dauer über der Grenze": _group("duration", [ON], seconds=MAX_DELAY + 1),
    "unbekannte Art der Wiederholung": _group("forever", [ON]),
    "ohne Art der Wiederholung": {"type": "group", "steps": [ON]},
    "Name zu lang": _group("count", [ON], name="x" * 41),
    "unbekannte Angabe": _group("count", [ON], rounds=3),
}


@pytest.mark.parametrize("name", sorted(BAD_GROUPS))
def test_an_invalid_group_is_rejected(name: str) -> None:
    with pytest.raises(vol.Invalid):
        valid_step(BAD_GROUPS[name])


LISTS = {"after": valid_after_step, "armed": valid_armed_step, "arming": valid_arming_step, "entry": valid_entry_step, "disarmed": valid_disarmed_step}
# Je Liste ein Schritt, den es dort nicht gibt (auch nicht in einer Gruppe)
FOREIGN = {
    "after": {"type": "notify"},
    "armed": {"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 5},
    "arming": {"type": "prealarm", "players": [PLAYER], "duration": 5},
    "entry": {"type": "dechime", "players": [PLAYER], "duration": 3},
    "disarmed": CHIME,
}


@pytest.mark.parametrize("zone", sorted(LISTS))
def test_in_the_other_lists_a_group_follows_the_rules_of_its_list(zone: str) -> None:
    check = LISTS[zone]
    group = check(_group("count", [{**ON, "restore": True}, _wait(1)], count=2))
    assert group["steps"][0]["restore"] is False, "Rückgängig gibt es in dieser Liste nicht, auch nicht in der Gruppe"
    assert check(_group("duration", [ON], seconds=30))["seconds"] == 30
    with pytest.raises(vol.Invalid):
        check(_group("until_disarmed", [ON]))  # dort deaktiviert danach niemand: die Gruppe liefe endlos
    with pytest.raises(vol.Invalid):
        check(_group("count", [FOREIGN[zone]]))
    with pytest.raises(vol.Invalid):
        check(_group("count", [_group("count", [ON])]))
    with pytest.raises(vol.Invalid):
        check(_group("count", [{**ON, "undo_after": 10}]))


def test_a_sound_in_a_group_after_the_alarm_needs_a_duration_and_a_tone_never_follows_a_delay_inside_a_group() -> None:
    with pytest.raises(vol.Invalid):
        valid_after_step(_group("count", [{"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 0}]))
    inner = valid_arming_step(_group("count", [{**CHIME, "delay": True}]))["steps"][0]
    assert "delay" not in inner


def test_the_steps_of_groups_count_towards_the_limit_of_a_list() -> None:
    check = step_list(valid_step)
    full = [_group("count", [ON] * 9) for _ in range(4)]  # 4 Gruppen mit je 9 Schritten: 40
    assert len(check(full)) == 4
    with pytest.raises(vol.Invalid):
        check([*full, _wait(1)])
    assert len(check([_wait(1)] * MAX_STEPS)) == MAX_STEPS
    with pytest.raises(vol.Invalid):
        check([_wait(1)] * (MAX_STEPS + 1))


async def test_groups_are_saved_and_rejected_over_the_websocket(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    group = _group("until_disarmed", [ON, _wait(2), OFF, _wait(2)], name="Blinken")
    await client.send_json({"id": 1, "type": "alarmageddon/save_workflows", "entry_id": entry.entry_id, "workflows": {"home": [group]},
                            "workflows_armed": {"home": [_group("count", [CHIME, _wait(1)], count=2, wait=True)]}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    saved = entry.options["workflows"]["home"][0]
    assert saved["type"] == "group" and saved["name"] == "Blinken" and len(saved["steps"]) == 4 and saved["wait"] is False
    assert entry.options["workflows_armed"]["home"][0]["count"] == 2
    bad = [
        {"workflows": {"home": [_group("count", [{"type": "acknowledge"}])]}},
        {"workflows": {}, "workflows_armed": {"home": [_group("until_disarmed", [ON])]}},
        {"workflows": {}, "workflows_after": {"home": [_group("count", [{"type": "notify"}])]}},
        {"workflows": {"home": [_group("count", [ON] * 9) for _ in range(5)]}},
    ]
    for number, body in enumerate(bad, start=2):
        await client.send_json({"id": number, "type": "alarmageddon/save_workflows", "entry_id": entry.entry_id, **body})
        assert not (await client.receive_json())["success"], body


def test_budget_and_waiting_of_a_group() -> None:
    """Der Wächter lässt einer abgewarteten Gruppe ihre volle Zeit; ohne "wait" und "bis deaktiviert" wird sie nie abgewartet."""
    blink = [ON, _wait(10), OFF, _wait(10)]
    assert wf.step_waits(_group("count", blink)) is False, "wie die anderen Schritte: ohne die Angabe läuft sie nebenher"
    assert wf.step_waits(_group("count", blink, wait=True)) is True
    assert wf.step_waits(_group("duration", blink, wait=True)) is True
    assert wf.step_waits(_group("until_disarmed", blink, wait=True)) is False
    assert wf.step_budget(_group("count", blink, count=5, wait=True)) > 5 * 20
    assert wf.step_budget(_group("duration", blink, seconds=600, wait=True)) > 600 + 20
    for group in (_group("count", blink, count=GROUP_MAX_ROUNDS), _group("duration", blink, seconds=MAX_DELAY), _group("until_disarmed", blink), _group("count", [])):
        assert 0 < wf.step_budget(group) < float("inf")
    # Was eine beschädigte Ablage auch enthält: in einer Gruppe läuft nie eine Gruppe und nie "Quittieren"
    assert wf.group_steps(_group("count", [ON, _group("count", [ON]), {"type": "acknowledge"}, "kaputt", _wait(1)])) == [ON, _wait(1)]
    assert wf.group_rounds({"count": 10_000}) == GROUP_MAX_ROUNDS and wf.group_rounds({"count": "x"}) == 1 and wf.group_rounds({"count": -3}) == 1
    assert wf.step_entities(_group("count", [{**ON, "restore": True}, {**SIREN_ON, "restore": True}, OFF])) == [LIGHT, SIREN]


# ----- Ablauf: Anzahl -----


async def test_count_runs_the_steps_that_many_times_and_the_flow_waits_when_asked(hass: HomeAssistant, freezer) -> None:
    s = _services(hass)
    await _alarm(hass, [_group("count", [ON, _wait(5), OFF, _wait(5)], count=3, wait=True), SIREN_ON])
    assert _to(s["switch.turn_on"], LIGHT) == 1 and not s["switch.turn_off"]
    await _tick(hass, freezer, 5)
    assert len(s["switch.turn_off"]) == 1 and _to(s["switch.turn_on"], LIGHT) == 1
    await _tick(hass, freezer, 5)
    assert _to(s["switch.turn_on"], LIGHT) == 2, "zweite Runde"
    await _tick(hass, freezer, 15)
    assert _to(s["switch.turn_on"], LIGHT) == 3 and len(s["switch.turn_off"]) == 3
    assert _to(s["switch.turn_on"], SIREN) == 0, "der nächste Schritt wartet auf das Ende der Gruppe"
    await _tick(hass, freezer, 5)
    assert _to(s["switch.turn_on"], SIREN) == 1
    await _tick(hass, freezer, 60)
    assert _to(s["switch.turn_on"], LIGHT) == 3 and len(s["switch.turn_off"]) == 3, "nach der letzten Runde ist Schluss"


async def test_without_wait_the_next_step_starts_at_once_like_for_other_steps(hass: HomeAssistant, freezer) -> None:
    s = _services(hass)
    await _alarm(hass, [_group("count", [ON, _wait(5), OFF, _wait(5)], count=2), SIREN_ON])
    assert _to(s["switch.turn_on"], LIGHT) == 1 and _to(s["switch.turn_on"], SIREN) == 1
    await _tick(hass, freezer, 30)
    assert _to(s["switch.turn_on"], LIGHT) == 2 and len(s["switch.turn_off"]) == 2


async def test_a_round_never_runs_without_a_pause(hass: HomeAssistant, freezer) -> None:
    """Eine Gruppe ohne "Warten" liefe sonst als Schleife ohne Pause: jede Runde dauert mindestens eine Sekunde."""
    s = _services(hass)
    await _alarm(hass, [_group("until_disarmed", [ON])])
    assert _to(s["switch.turn_on"], LIGHT) == 1
    for _ in range(40):
        await settle(hass)
    assert _to(s["switch.turn_on"], LIGHT) == 1, "ohne dass Zeit vergeht, beginnt keine zweite Runde"
    await _tick(hass, freezer, 5)
    assert _to(s["switch.turn_on"], LIGHT) == 6
    await call(hass, "alarm_disarm")


# ----- Ablauf: Dauer -----


@pytest.mark.parametrize(("seconds", "rounds"), [(60, 3), (50, 2), (59, 2), (20, 1), (5, 1)])
async def test_duration_never_runs_longer_than_set_and_never_ends_inside_a_round(hass: HomeAssistant, freezer, seconds: int, rounds: int) -> None:
    """
    Runden von 20 Sekunden. Eine Runde beginnt nur, wenn sie noch ganz in die Zeit passt: das Licht bleibt nie an, die Gruppe läuft nie
    länger als eingestellt. Die erste Runde läuft immer ganz (auch wenn die Dauer kürzer ist). Der nächste Schritt folgt nach der Dauer.
    """
    s = _services(hass)
    await _alarm(hass, [_group("duration", [ON, _wait(10), OFF, _wait(10)], seconds=seconds, wait=True), SIREN_ON])
    end = max(seconds, 20)
    await _tick(hass, freezer, end - 1)
    assert _to(s["switch.turn_on"], LIGHT) == rounds
    assert _to(s["switch.turn_on"], SIREN) == 0, "nicht vor der eingestellten Zeit"
    await _tick(hass, freezer, 2)
    assert _to(s["switch.turn_on"], SIREN) == 1
    assert _to(s["switch.turn_on"], LIGHT) == rounds and len(s["switch.turn_off"]) == rounds, "jede begonnene Runde ist zu Ende gelaufen"
    await _tick(hass, freezer, 60)
    assert _to(s["switch.turn_on"], LIGHT) == rounds


# ----- Ablauf: bis deaktiviert -----


@pytest.mark.parametrize("how", ["disarm", "acknowledge", "silence"])
async def test_until_disarmed_repeats_and_ends_at_once(hass: HomeAssistant, freezer, how: str) -> None:
    s = _services(hass)
    # Auch als "abwarten" abgelegt läuft die Gruppe nebenher: sonst käme die Sirene dahinter nie dran
    entry = await _alarm(hass, [{**_group("until_disarmed", [ON, _wait(2), OFF, _wait(2)]), "wait": True}, SIREN_ON])
    assert _to(s["switch.turn_on"], SIREN) == 1
    await _tick(hass, freezer, 40)
    assert _to(s["switch.turn_on"], LIGHT) == 11 and len(s["switch.turn_off"]) == 10
    runner = entry.runtime_data.workflow
    if how == "disarm":
        await call(hass, "alarm_disarm")
    elif how == "acknowledge":
        assert entry.runtime_data.controller.acknowledge("Test")
    else:
        assert await runner.async_silence()
    await settle(hass)
    assert runner.running is None
    before = (len(s["switch.turn_on"]), len(s["switch.turn_off"]))
    await _tick(hass, freezer, 30)
    assert (len(s["switch.turn_on"]), len(s["switch.turn_off"])) == before, "nach dem Ende läuft keine Runde mehr"


async def test_devices_of_a_group_return_when_disarming(hass: HomeAssistant, freezer) -> None:
    """Mitten in der Runde deaktiviert: ein Gerät mit "Rückgängig" kehrt in seinen Zustand vor dem Alarm zurück (das Licht bleibt nicht an)."""
    s = _services(hass)
    entry = await _alarm(hass, [_group("until_disarmed", [{**ON, "restore": True}, _wait(10), OFF, _wait(10)])])
    assert LIGHT in entry.runtime_data.workflow.running["snapshot"]
    hass.states.async_set(LIGHT, "on")  # die Gruppe hat eingeschaltet
    await _tick(hass, freezer, 3)
    assert not s["switch.turn_off"]
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert _to(s["switch.turn_off"], LIGHT) == 1


# ----- Sicherheit: scheitern, hängen -----


async def _loose(hass: HomeAssistant) -> None:
    """Ohne async_block_till_done: das wartet auf hängende Dienstaufrufe, und genau die gehören zu diesen Tests."""
    for _ in range(30):
        await asyncio.sleep(0)


async def _alarm_loose(hass: HomeAssistant, steps: list[dict[str, Any]]) -> MockConfigEntry:
    entry = await setup_alarm(hass, workflows={"home": steps})
    await call(hass, "alarm_arm_home")
    hass.states.async_set(WINDOW, "on")
    await _loose(hass)
    return entry


async def test_a_failing_step_never_stops_the_group_or_the_flow(hass: HomeAssistant, freezer) -> None:
    s = _services(hass)

    async def fail(_call: ServiceCall) -> None:
        raise RuntimeError("kaputt")

    hass.services.async_register("kaputt", "jetzt", fail)
    broken = {"type": "action", "action": "kaputt.jetzt", "target": ["switch.x"]}
    missing = {"type": "action", "action": "gibtes.nicht", "target": ["switch.x"]}
    await _alarm(hass, [_group("count", [broken, ON, missing, _wait(2)], count=3, wait=True), SIREN_ON])
    await _tick(hass, freezer, 8)
    assert _to(s["switch.turn_on"], LIGHT) == 3 and _to(s["switch.turn_on"], SIREN) == 1
    assert state(hass) == AlarmControlPanelState.TRIGGERED


async def test_a_hanging_device_in_a_group_holds_up_nothing(hass: HomeAssistant, monkeypatch) -> None:
    """Ein Gerät in der Gruppe antwortet nie: nach der Zeitgrenze geht die Runde weiter, der Ablauf auch; Deaktivieren beendet alles."""
    for name in ("SERVICE_TIMEOUT", "SNAPSHOT_TIMEOUT", "WATCHDOG_GRACE"):
        monkeypatch.setattr(wf, name, 0.1)
    s = _services(hass)
    cancelled = asyncio.Event()

    async def hang(_call: ServiceCall) -> None:
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    hass.services.async_register("hang", "now", hang)
    stuck = {"type": "action", "action": "hang.now", "target": ["switch.haengt"]}
    entry = await _alarm_loose(hass, [_group("count", [stuck, ON], count=1, wait=True), SIREN_ON])
    assert not s["switch.turn_on"]
    await asyncio.sleep(0.6)
    await _loose(hass)
    assert _to(s["switch.turn_on"], LIGHT) == 1, "der Schritt nach dem hängenden läuft"
    assert _to(s["switch.turn_on"], SIREN) == 1, "der Schritt nach der Gruppe läuft"
    await call(hass, "alarm_disarm")
    await _loose(hass)
    assert state(hass) == AlarmControlPanelState.DISARMED and entry.runtime_data.workflow.running is None
    await asyncio.wait_for(cancelled.wait(), 2)


async def test_a_group_that_hangs_as_a_whole_is_left_by_the_watchdog(hass: HomeAssistant, monkeypatch) -> None:
    """Hängt die Gruppe selbst aus einem unvorhergesehenen Grund, verlässt der Wächter sie nach ihrer Grenze: der nächste Schritt läuft."""
    for name in ("SERVICE_TIMEOUT", "SNAPSHOT_TIMEOUT", "WATCHDOG_GRACE"):
        monkeypatch.setattr(wf, name, 0.1)
    monkeypatch.setattr(wf, "step_budget", lambda _step: 0.2)
    s = _services(hass)

    async def never(self, step: dict, test: bool, resumable: bool = True) -> None:
        await asyncio.Event().wait()

    monkeypatch.setattr(wf.WorkflowRunner, "_group", never)
    await _alarm_loose(hass, [_group("count", [ON], count=2, wait=True), SIREN_ON])
    assert not s["switch.turn_on"]
    await asyncio.sleep(0.5)
    await _loose(hass)
    assert _to(s["switch.turn_on"], SIREN) == 1
    await call(hass, "alarm_disarm")


# ----- Neuladen und Neustart -----


async def _restart(hass: HomeAssistant, hass_storage, steps: list[dict[str, Any]], run: dict[str, Any]) -> MockConfigEntry:
    """Home Assistant startet mitten im Alarm neu: abgelegter Lauf, Zustand "Alarm"."""
    key = f"{WORKFLOW_STORE_KEY}.gruppe"
    hass_storage[key] = {"version": 1, "minor_version": 1, "key": key, "data": {"trigger": "home", "test": False, "snapshot": {}, "sonos": [], "steps": None, **run}}
    data = {"mode": "home", "deadline": None, "bypassed": [], "triggered_by": WINDOW, "changed_by": None}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, "triggered"), data)])
    for entity in (FRONT_DOOR, WINDOW, MOTION):
        hass.states.async_set(entity, "off")
    entry = MockConfigEntry(domain=DOMAIN, entry_id="gruppe", title="Haus", data={"name": "Haus"}, options=options(workflows={"home": steps}))
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    return entry


async def test_until_disarmed_goes_on_after_a_restart_in_the_alarm(hass: HomeAssistant, hass_storage, freezer) -> None:
    """Im Zweifel alarmieren: das Blinklicht hört nach einem Neustart von Home Assistant mitten im Alarm nicht still auf."""
    s = _services(hass)
    steps = [SIREN_ON, _group("until_disarmed", [ON, _wait(2), OFF, _wait(2)]), _wait(600), {"type": "action", "action": "switch.turn_off", "target": [SIREN]}]
    await _restart(hass, hass_storage, steps, {"index": 2, "endless": [1], "until": {"index": 2, "at": (dt_util.utcnow() + timedelta(seconds=300)).isoformat()}})
    assert _to(s["switch.turn_on"], LIGHT) == 1, "die Gruppe läuft wieder"
    assert _to(s["switch.turn_on"], SIREN) == 0, "der Schritt davor läuft nicht noch einmal"
    await _tick(hass, freezer, 8)
    assert _to(s["switch.turn_on"], LIGHT) == 3
    await call(hass, "alarm_disarm")
    await settle(hass)
    before = len(s["switch.turn_on"])
    await _tick(hass, freezer, 10)
    assert len(s["switch.turn_on"]) == before


async def test_a_group_before_the_stored_step_that_is_not_endless_does_not_start_again(hass: HomeAssistant, hass_storage, freezer) -> None:
    s = _services(hass)
    steps = [_group("count", [ON, _wait(2)], count=3), _wait(600)]
    await _restart(hass, hass_storage, steps, {"index": 1, "endless": [0, 5, "x"]})
    await _tick(hass, freezer, 6)
    assert not s["switch.turn_on"], "nur Gruppen \"bis deaktiviert\" beginnen wieder"


async def test_count_runs_only_the_remaining_rounds_after_a_restart(hass: HomeAssistant, hass_storage, freezer) -> None:
    s = _services(hass)
    steps = [_group("count", [ON, _wait(10)], count=5, wait=True), SIREN_ON]
    await _restart(hass, hass_storage, steps, {"index": 0, "group": {"index": 0, "round": 3}})
    await _tick(hass, freezer, 19)
    assert _to(s["switch.turn_on"], LIGHT) == 2 and _to(s["switch.turn_on"], SIREN) == 0
    await _tick(hass, freezer, 2)
    assert _to(s["switch.turn_on"], SIREN) == 1
    await _tick(hass, freezer, 30)
    assert _to(s["switch.turn_on"], LIGHT) == 2, "nicht noch einmal fünf Runden"


async def test_the_rounds_done_are_stored_with_the_run(hass: HomeAssistant, freezer) -> None:
    _services(hass)
    entry = await _alarm(hass, [_group("count", [ON, _wait(10)], count=5, wait=True)])
    await _tick(hass, freezer, 25)
    assert entry.runtime_data.workflow.running["group"] == {"index": 0, "round": 2}


async def test_duration_counts_from_the_first_start_across_a_restart(hass: HomeAssistant, hass_storage, freezer) -> None:
    """100 Sekunden eingestellt, nach 60 neu gestartet: es laufen noch 40 Sekunden (vier Runden zu 10), nicht noch einmal 100."""
    s = _services(hass)
    steps = [_group("duration", [ON, _wait(10)], seconds=100, wait=True), SIREN_ON]
    await _restart(hass, hass_storage, steps, {"index": 0, "until": {"index": 0, "at": (dt_util.utcnow() + timedelta(seconds=40)).isoformat()}})
    await _tick(hass, freezer, 39)
    assert _to(s["switch.turn_on"], LIGHT) == 4 and _to(s["switch.turn_on"], SIREN) == 0
    await _tick(hass, freezer, 2)
    assert _to(s["switch.turn_on"], SIREN) == 1
    await _tick(hass, freezer, 30)
    assert _to(s["switch.turn_on"], LIGHT) == 4


async def test_a_reload_in_the_alarm_keeps_the_group_running_once(hass: HomeAssistant, freezer) -> None:
    """Einstellungen mitten im Alarm gespeichert (die Anlage lädt neu): die Gruppe läuft weiter, und nur einmal."""
    s = _services(hass)
    entry = await _alarm(hass, [_group("until_disarmed", [ON, _wait(4)]), _wait(600)])
    await _tick(hass, freezer, 9)
    assert _to(s["switch.turn_on"], LIGHT) == 3
    assert entry.runtime_data.workflow.running["endless"] == [0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "entry_delay": 25})
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    count = _to(s["switch.turn_on"], LIGHT)
    assert count == 4, "nach dem Neuladen beginnt die Gruppe wieder"
    await _tick(hass, freezer, 12)
    assert _to(s["switch.turn_on"], LIGHT) == count + 3, "eine Runde alle vier Sekunden: die Gruppe läuft nicht doppelt"
    await call(hass, "alarm_disarm")


async def test_the_watchdog_never_starts_a_running_group_twice(hass: HomeAssistant, freezer) -> None:
    """Setzt der Wächter einen abgebrochenen Ablauf fort, läuft die Gruppe in diesem Prozess schon: sie startet nicht noch einmal."""
    s = _services(hass)
    steps = [_group("until_disarmed", [ON, _wait(4)]), _wait(600)]
    entry = await _alarm(hass, steps)
    runner = entry.runtime_data.workflow
    tasks = len(runner._side_tasks)
    runner._resume_endless("home", steps, 1, False)
    await settle(hass)
    assert len(runner._side_tasks) == tasks and _to(s["switch.turn_on"], LIGHT) == 1
    await call(hass, "alarm_disarm")


# ----- Meldungen, Zeitachse, Test -----


async def test_a_message_in_a_group_is_a_message_of_the_flow(hass: HomeAssistant, freezer) -> None:
    """Keine Standardmeldung zusätzlich, und die eigenen Empfänger des Schritts zählen als Alarm-Empfänger (ihre Knöpfe wirken)."""
    _services(hass)
    sent = async_mock_service(hass, "notify", "mobile_app_handy")
    own = async_mock_service(hass, "notify", "mobile_app_gast")
    notify = {"type": "notify", "title": "Erinnerung", "targets": ["notify.mobile_app_gast"]}
    entry = await _alarm(hass, [_group("until_disarmed", [notify, _wait(30)])], notify={"alarm_targets": ["notify.mobile_app_handy"]})
    await settle(hass)
    runner = entry.runtime_data.workflow
    assert runner.has_notify("home")
    assert len(own) == 1 and not sent, "nur die Meldung der Gruppe, keine Standardmeldung daneben"
    assert "notify.mobile_app_gast" in entry.runtime_data.notifier._alarm_recipients()
    await _tick(hass, freezer, 60, step=5)
    assert len(own) == 3, "jede Runde eine Meldung"
    await call(hass, "alarm_disarm")


async def test_the_timeline_shows_the_steps_of_a_group_once(hass: HomeAssistant, freezer) -> None:
    _services(hass)
    entry = await _alarm(hass, [_group("until_disarmed", [ON, _wait(2), OFF, _wait(2)])])
    await _tick(hass, freezer, 30)
    assert _steps_on_timeline(entry) == ["group", "action", "wait", "action", "wait"]
    await call(hass, "alarm_disarm")


async def test_the_recording_of_an_alarm_has_a_hard_limit_for_steps_and_messages(hass: HomeAssistant) -> None:
    """Eine Gruppe, die bis zum Deaktivieren jede Runde eine Meldung sendet, lässt die Aufzeichnung nicht ohne Ende wachsen."""
    _services(hass)
    entry = await _alarm(hass, [_wait(600)])
    recorder = entry.runtime_data.recorder
    for _ in range(3 * RECORDINGS_ENTRIES_KEEP):
        recorder._add({"kind": "notified", "type": "triggered"})
    assert len(recorder.current["entries"]) == 2 * RECORDINGS_ENTRIES_KEEP and recorder.current["truncated"] is True
    await call(hass, "alarm_disarm")
    await settle(hass)
    kinds = [e["kind"] for e in recorder.recordings[0]["entries"]]
    assert "state" in kinds[2 * RECORDINGS_ENTRIES_KEEP:] or len(kinds) > 2 * RECORDINGS_ENTRIES_KEEP, "Zustandswechsel und Ende kommen weiterhin dazu"


async def test_the_test_of_a_group_ends_with_the_test_window(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    """Der Play-Knopf an einer Gruppe "bis deaktiviert": sie läuft im Test, endet spätestens mit dem Zeitfenster und löst nie einen Alarm aus."""
    s = _services(hass)
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/test_workflow", "entry_id": entry.entry_id, "trigger": "home", "step": _group("until_disarmed", [ON, _wait(5)])})
    assert (await client.receive_json())["success"]
    await settle(hass)
    assert _to(s["switch.turn_on"], LIGHT) == 1 and state(hass) == AlarmControlPanelState.DISARMED
    await _tick(hass, freezer, TEST_SECONDS + 5, step=5)
    assert entry.runtime_data.workflow.running is None
    count = _to(s["switch.turn_on"], LIGHT)
    assert 10 <= count <= 13
    await _tick(hass, freezer, 30, step=5)
    assert _to(s["switch.turn_on"], LIGHT) == count


async def test_a_real_alarm_ends_the_test_of_a_group(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    s = _services(hass)
    entry = await setup_alarm(hass, workflows={"home": [SIREN_ON]})
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/test_workflow", "entry_id": entry.entry_id, "trigger": "home", "step": _group("until_disarmed", [ON, _wait(5)])})
    assert (await client.receive_json())["success"]
    await settle(hass)
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    await settle(hass)
    assert _to(s["switch.turn_on"], SIREN) == 1, "die echten Alarmaktionen laufen"
    count = _to(s["switch.turn_on"], LIGHT)
    await _tick(hass, freezer, 20, step=5)
    assert _to(s["switch.turn_on"], LIGHT) == count, "die Gruppe des Tests läuft nicht weiter"


# ----- Andere Listen -----


async def test_a_group_when_armed_runs_and_ends_with_disarming(hass: HomeAssistant, freezer) -> None:
    s = _services(hass)
    await setup_alarm(hass, workflows_armed={"home": [_group("count", [ON, _wait(2), OFF, _wait(2)], count=10)]})
    await call(hass, "alarm_arm_home")
    await settle(hass)
    await _tick(hass, freezer, 9)
    assert _to(s["switch.turn_on"], LIGHT) == 3
    await call(hass, "alarm_disarm")
    await settle(hass)
    before = len(s["switch.turn_on"])
    await _tick(hass, freezer, 20)
    assert len(s["switch.turn_on"]) == before


async def test_an_alarm_is_never_held_up_by_a_group_of_another_list(hass: HomeAssistant, freezer) -> None:
    """Eine Gruppe beim Scharfschalten läuft noch: der Alarm beginnt sofort, die Gruppe endet."""
    s = _services(hass)
    await setup_alarm(hass, workflows={"home": [SIREN_ON]}, workflows_armed={"home": [_group("duration", [ON, _wait(5)], seconds=600, wait=True)]})
    await call(hass, "alarm_arm_home")
    await settle(hass)
    await _tick(hass, freezer, 6)
    assert _to(s["switch.turn_on"], LIGHT) == 2
    await open_sensor(hass, WINDOW)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED and _to(s["switch.turn_on"], SIREN) == 1
    count = _to(s["switch.turn_on"], LIGHT)
    await _tick(hass, freezer, 20)
    assert _to(s["switch.turn_on"], LIGHT) == count
