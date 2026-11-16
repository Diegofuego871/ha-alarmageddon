"""Routinen (1.44.0, ersetzen die Zeitpläne) und wählbare Modi (0.6.0)."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from homeassistant.components.alarm_control_panel import AlarmControlPanelEntityFeature, AlarmControlPanelState
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.alarmageddon.code import hash_code
from custom_components.alarmageddon.const import MAX_ROUTINE_LEAVES, ROUTINE_COOLDOWN

from .conftest import ALARM, FRONT_DOOR, WINDOW, setup_alarm
from .test_alarm import call, state

_id = iter(range(1, 1000))
MONDAY = (2026, 11, 9)


async def _at(hass: HomeAssistant, freezer, day: tuple[int, int, int], hour: int, minute: int) -> None:
    """Uhr auf eine lokale Zeit stellen und den Zeitwechsel auslösen."""
    local = datetime(*day, hour, minute, 0, tzinfo=dt_util.get_default_time_zone())
    freezer.move_to(dt_util.as_utc(local))
    async_fire_time_changed(hass, dt_util.utcnow())
    await hass.async_block_till_done()


async def _ws(client, **msg):
    await client.send_json({"id": next(_id), **msg})
    return await client.receive_json()


LOCK = "lock.haustuer"
BUTTON = "event.dimmer_taste_1"
EVENT_TYPES = ["initial_press", "short_release", "long_press"]
PERSON = "person.anna"
SWITCH = "switch.steckdose"


def _times(time: str, days=(0, 1, 2, 3, 4)) -> dict:
    return {"type": "schedule", "times": [{"time": time, "days": list(days)}]}


def _is(entity: str, value: str) -> dict:
    return {"kind": "state", "entity_id": entity, "state": value}


def _press(entity: str, event_type: str) -> dict:
    return {"kind": "event", "entity_id": entity, "event_type": event_type}


def _window(start: str, end: str, days=()) -> dict:
    return {"kind": "time", "from": start, "to": end, "days": list(days)}


def _device(*items: dict, op: str = "and", hold: int = 0) -> dict:
    return {"type": "device", "tree": {"op": op, "items": list(items)}, "hold": hold}


def _group(*items: dict, op: str = "and") -> dict:
    return {"op": op, "items": list(items)}


def _rule(action: str, trigger: dict, states=("disarmed",), name: str = "Routine", rid: str = "r1", enabled: bool = True, unsafe: bool | None = None) -> dict:
    return {"id": rid, "name": name, "enabled": enabled, "action": action, "states": list(states), "trigger": trigger,
            "unsafe": action == "off" if unsafe is None else unsafe}


def _events(entry) -> list[dict]:
    return entry.runtime_data.events.events


# ----- Auslöser Zeitplan -----


async def test_schedule_routine_arms_on_weekday(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 12, 0)
    await setup_alarm(hass, night_enabled=True, routines=[
        _rule("night", _times("22:30"), name="Nachts scharf"),
        _rule("off", _times("06:45"), states=("armed",), name="Morgens aus", rid="r2")])
    await _at(hass, freezer, MONDAY, 22, 30)
    assert state(hass) == AlarmControlPanelState.ARMED_NIGHT
    assert hass.states.get(ALARM).attributes["changed_by"] == "Routine: Nachts scharf"
    await _at(hass, freezer, (2026, 11, 10), 6, 45)
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_schedule_routine_respects_days_and_enabled(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 12, 0)
    await setup_alarm(hass, exit_delay_away=0, routines=[
        _rule("away", _times("13:00", days=[5, 6])), _rule("away", _times("14:00"), enabled=False, rid="r2", name="Aus")])
    await _at(hass, freezer, MONDAY, 13, 0)
    await _at(hass, freezer, MONDAY, 14, 0)
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_schedule_routine_with_several_times(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 6, 0)
    trigger = {"type": "schedule", "times": [{"time": "07:00", "days": [0]}, {"time": "09:00", "days": [1]}]}
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", trigger, states=("disarmed", "armed"))])
    await _at(hass, freezer, MONDAY, 7, 0)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await call(hass, "alarm_disarm")
    await _at(hass, freezer, MONDAY, 9, 0)  # Montag um 9: gehört zur Zeit am Dienstag
    assert state(hass) == AlarmControlPanelState.DISARMED
    await _at(hass, freezer, (2026, 11, 10), 9, 0)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


# ----- Zustände der Anlage -----


async def test_routine_skipped_in_state_not_chosen(hass: HomeAssistant, freezer) -> None:
    """Ein Einbruch kurz vor der Zeit darf nicht per Routine enden: ohne gewählten Zustand wird übersprungen, und das steht im Protokoll."""
    await _at(hass, freezer, MONDAY, 6, 0)
    entry = await setup_alarm(hass, exit_delay_away=0, trigger_time=0, routines=[_rule("off", _times("06:45"), states=("armed", "disarmed"))])
    await call(hass, "alarm_arm_away")
    hass.states.async_set(WINDOW, "on")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    await _at(hass, freezer, MONDAY, 6, 45)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert _events(entry)[0] == {**_events(entry)[0], "kind": "routine_skipped", "routine": "Routine", "reason": "state", "at": "triggered"}


async def test_routine_skipped_during_entry_delay(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 6, 0)
    await setup_alarm(hass, exit_delay_away=0, entry_delay=3600, routines=[_rule("off", _times("06:45"), states=("armed",))])
    await call(hass, "alarm_arm_away")
    hass.states.async_set(FRONT_DOOR, "on")
    await hass.async_block_till_done()
    await _at(hass, freezer, MONDAY, 6, 45)
    assert state(hass) == AlarmControlPanelState.PENDING


async def test_arming_routine_never_applies_during_alarm_even_if_stored_so(hass: HomeAssistant, freezer) -> None:
    """Auch ein beschädigter Stand (Zustand "Alarm" bei einer Scharfschalten-Routine, am Speichern vorbei) schaltet nie in einen Alarm hinein."""
    await _at(hass, freezer, MONDAY, 6, 0)
    entry = await setup_alarm(hass, exit_delay_away=0, trigger_time=0, routines=[_rule("night", _times("06:45"), states=("triggered", "armed"))], night_enabled=True)
    await call(hass, "alarm_arm_away")
    hass.states.async_set(WINDOW, "on")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    await _at(hass, freezer, MONDAY, 6, 45)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert _events(entry)[0]["reason"] == "alarm"


async def test_routine_may_disarm_during_entry_delay_when_chosen(hass: HomeAssistant, freezer) -> None:
    """Nur mit ausdrücklicher Wahl des Zustands (und der Bestätigung) gilt eine Deaktivieren-Routine in der Eingangsverzögerung."""
    await _at(hass, freezer, MONDAY, 6, 0)
    await setup_alarm(hass, exit_delay_away=0, entry_delay=3600, routines=[_rule("off", _times("06:45"), states=("armed", "pending"))])
    await call(hass, "alarm_arm_away")
    hass.states.async_set(FRONT_DOOR, "on")
    await hass.async_block_till_done()
    await _at(hass, freezer, MONDAY, 6, 45)
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_routine_disarms_without_code(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 6, 0)
    code_hash, salt = hash_code("1234")
    await setup_alarm(hass, exit_delay_away=0, code_hash=code_hash, code_salt=salt, code_arm_required=True,
                      routines=[_rule("away", _times("06:10")), _rule("off", _times("06:45"), states=("armed",), rid="r2", name="Aus")])
    await _at(hass, freezer, MONDAY, 6, 10)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await _at(hass, freezer, MONDAY, 6, 45)
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_routine_open_sensor_reports_arm_failed(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 6, 0)
    entry = await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _times("08:00"))])
    hass.states.async_set(WINDOW, "on")
    await _at(hass, freezer, MONDAY, 8, 0)
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert _events(entry)[0]["kind"] == "arm_failed"


async def test_routine_for_disabled_mode_skipped(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 6, 0)
    entry = await setup_alarm(hass, routines=[_rule("night", _times("22:00"))])
    await _at(hass, freezer, MONDAY, 22, 0)
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert _events(entry)[0] == {**_events(entry)[0], "kind": "routine_skipped", "reason": "mode"}


async def test_routine_cooldown_blocks_double_run(hass: HomeAssistant, freezer) -> None:
    """Zwei Auslöser kurz nacheinander (zum Beispiel Schloss meldet doppelt) schalten nur einmal."""
    await _at(hass, freezer, MONDAY, 6, 0)
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_is(LOCK, "locked")), states=("disarmed", "armed"))])
    hass.states.async_set(LOCK, "unlocked")
    await hass.async_block_till_done()
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await call(hass, "alarm_disarm")
    hass.states.async_set(LOCK, "unlocked")
    await hass.async_block_till_done()
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED  # innerhalb der Sperre
    freezer.tick(timedelta(seconds=ROUTINE_COOLDOWN + 1))
    hass.states.async_set(LOCK, "unlocked")
    await hass.async_block_till_done()
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_restart_after_routine_arm_keeps_state(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 6, 0)
    entry = await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _times("08:00"))])
    await _at(hass, freezer, MONDAY, 8, 0)
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    # Nach dem Neuladen feuert derselbe Termin am nächsten Tag wieder (kein doppelter Zeitgeber)
    await call(hass, "alarm_disarm")
    freezer.tick(timedelta(days=1))
    await _at(hass, freezer, (2026, 11, 10), 8, 0)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


# ----- Auslöser Gerät -----


async def test_device_routine_arms_when_lock_locks(hass: HomeAssistant) -> None:
    hass.states.async_set(LOCK, "unlocked")
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_is(LOCK, "locked")), name="Haus verlassen")])
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    assert hass.states.get(ALARM).attributes["changed_by"] == "Routine: Haus verlassen"


async def test_device_routine_does_not_run_for_state_at_start(hass: HomeAssistant) -> None:
    """Nach einem Neustart wird nichts nachgeholt: ein Schloss, das schon zu ist, schaltet nichts."""
    hass.states.async_set(LOCK, "locked")
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_is(LOCK, "locked")))])
    assert state(hass) == AlarmControlPanelState.DISARMED
    hass.states.async_set(LOCK, "locked", {"x": 1})  # nur ein Attribut: kein neuer Zustand
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED


@pytest.mark.parametrize("before", ["unavailable", "unknown"])
async def test_device_routine_ignores_return_from_unavailable(hass: HomeAssistant, before: str) -> None:
    """Die Rückkehr aus "nicht verfügbar" ist kein Abschliessen und deaktiviert nie die Anlage (Funkabriss)."""
    hass.states.async_set(LOCK, "unlocked")
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_is(LOCK, "locked"))),
                      _rule("off", _device(_is(LOCK, "unlocked")), states=("armed", "disarmed"), rid="r2", name="Auf")])
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    hass.states.async_set(LOCK, before)
    await hass.async_block_till_done()
    hass.states.async_set(LOCK, "unlocked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    # Ein echter Wechsel danach wirkt wieder
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    hass.states.async_set(LOCK, "unlocked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_device_routine_and_or_groups(hass: HomeAssistant) -> None:
    """Alle (und) mit einer Gruppe "eine davon (oder)": Schloss zu UND (Anna weg ODER Steckdose aus)."""
    hass.states.async_set(LOCK, "unlocked")
    hass.states.async_set(PERSON, "home")
    hass.states.async_set(SWITCH, "on")
    tree = _device(_is(LOCK, "locked"), _group(_is(PERSON, "not_home"), _is(SWITCH, "off"), op="or"))
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", tree)])
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED  # die Gruppe gilt nicht
    hass.states.async_set(SWITCH, "off")  # die Gruppe gilt neu, das Schloss ist schon zu
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_device_routine_hold_time(hass: HomeAssistant, freezer) -> None:
    """"Muss mindestens N Sekunden gelten": fällt die Bedingung vorher weg, läuft nichts."""
    hass.states.async_set(LOCK, "unlocked")
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_is(LOCK, "locked"), hold=30))])
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=10))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    hass.states.async_set(LOCK, "unlocked")
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=40))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=31))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_device_routine_time_window(hass: HomeAssistant, freezer) -> None:
    """Gerät UND Uhrzeit: nur nachts. Tagsüber läuft nichts; beginnt das Fenster, während die Bedingung gilt, läuft die Routine."""
    await _at(hass, freezer, MONDAY, 12, 0)
    hass.states.async_set(LOCK, "unlocked")
    tree = _device(_is(LOCK, "locked"), _window("22:00", "06:00"))
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", tree)])
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED
    await _at(hass, freezer, MONDAY, 22, 0)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_device_routine_disarm_when_unlocked(hass: HomeAssistant) -> None:
    hass.states.async_set(LOCK, "locked")
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("off", _device(_is(LOCK, "unlocked")), states=("armed",), name="Heimkommen")])
    await call(hass, "alarm_arm_away")
    hass.states.async_set(LOCK, "unlocked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert hass.states.get(ALARM).attributes["changed_by"] == "Routine: Heimkommen"


async def test_routine_never_triggers_another_via_own_entities(hass: HomeAssistant, hass_ws_client) -> None:
    """Eine Routine löst nie eine andere aus: Entitäten von Alarmageddon sind als Auslöser abgelehnt."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    bad = _rule("away", _device(_is("binary_sensor.haus_zone_away", "on")))
    result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, routines=[bad])
    assert result["success"] is False and result["error"]["code"] == "invalid_routines"


# ----- Prüfung beim Speichern -----


@pytest.mark.parametrize(
    "rule",
    [
        _rule("away", _times("25:00")),
        _rule("away", {"type": "schedule", "times": [{"time": "08:00", "days": []}]}),
        _rule("away", _times("08:00"), states=()),
        _rule("away", _times("08:00"), states=("armed", "pending")),  # Scharfschalten nie in der Eingangsverzögerung
        _rule("away", _times("08:00"), states=("triggered",)),
        _rule("off", _times("08:00"), unsafe=False),  # Deaktivieren ohne Bestätigung
        _rule("away", _device(_window("22:00", "06:00"))),  # nur Uhrzeit: dafür gibt es den Zeitplan
        _rule("away", _device(_is(LOCK, "locked"), _window("22:00", "22:00"))),  # Fenster ohne Länge
        _rule("away", _device(_is("sensor.temperatur", "on"))),  # Art nicht unterstützt
        _rule("away", _device(_is(LOCK, "kaputt"))),  # Zustand nicht bekannt für die Art
        _rule("away", _device(*[_is(LOCK, "locked")] * (MAX_ROUTINE_LEAVES + 1))),
        _rule("away", _device(_is(LOCK, "locked"), _group(_group(_is(LOCK, "locked"))))),  # keine Gruppe in der Gruppe
    ],
)
async def test_save_routines_rejects_invalid(hass: HomeAssistant, hass_ws_client, rule: dict) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, routines=[rule])
    assert result["success"] is False, rule
    assert not entry.options.get("routines")


async def test_save_routines_rejects_duplicate_names(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id,
                       routines=[_rule("away", _times("08:00"), name="Gleich"), _rule("home", _times("09:00"), name="gleich", rid="r2")])
    assert result["success"] is False and result["error"]["code"] == "invalid_routines"


async def test_save_routines_and_data(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    rule = _rule("away", _device(_is(LOCK, "locked"), _group(_is(PERSON, "not_home"), _window("22:00", "06:00", days=[4, 0, 0]), op="or"), hold=5), name="Haus verlassen")
    ok = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, routines=[rule])
    assert ok["success"]
    await hass.async_block_till_done()
    assert entry.options["routines"][0]["trigger"]["tree"]["items"][1]["items"][1]["days"] in ([0, 4], [4, 0, 0])
    data = await _ws(client, type="alarmageddon/data")
    system = data["result"]["systems"][0]
    assert system["routines"] == entry.options["routines"]


async def test_routine_entities_lists_devices_without_own(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    hass.states.async_set(LOCK, "locked", {"friendly_name": "Haustür"})
    hass.states.async_set("sensor.temperatur", "20")
    client = await hass_ws_client(hass)
    result = await _ws(client, type="alarmageddon/routine_entities")
    ids = {e["entity_id"]: e for e in result["result"]["entities"]}
    assert LOCK in ids and ids[LOCK]["states"] == ["locked", "unlocked", "jammed", "open"] and ids[LOCK]["name"] == "Haustür"
    assert "sensor.temperatur" not in ids
    assert not any(e.startswith("alarm_control_panel.") for e in ids)
    assert not any(e == "binary_sensor.haus_zone_away" for e in ids)


# ----- Übernahme der Zeitpläne und Sicherung -----


def _old(action: str, time: str, days=(0, 1, 2, 3, 4), rid: str = "r1") -> dict:
    return {"id": rid, "enabled": True, "action": action, "time": time, "days": list(days)}


async def test_old_schedules_become_routines(hass: HomeAssistant, freezer) -> None:
    await _at(hass, freezer, MONDAY, 6, 0)
    entry = await setup_alarm(hass, exit_delay_away=0, schedules=[_old("away", "08:00"), _old("off", "17:00", rid="r2")])
    assert "schedules" not in entry.options
    routines = entry.options["routines"]
    assert [r["name"] for r in routines] == ["Schedule 08:00", "Schedule 17:00"]
    assert routines[0]["states"] == ["arming", "armed", "disarmed"] and routines[0]["action"] == "away" and routines[0]["unsafe"] is False
    assert routines[1]["action"] == "off" and routines[1]["unsafe"] is True
    await _at(hass, freezer, MONDAY, 8, 0)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await _at(hass, freezer, MONDAY, 17, 0)
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_backup_contains_routines_and_modes(hass: HomeAssistant, hass_ws_client) -> None:
    rule = _rule("away", _times("08:00"))
    await setup_alarm(hass, home_enabled=False, routines=[rule])
    client = await hass_ws_client(hass)
    data = (await _ws(client, type="alarmageddon/export"))["result"]
    options = data["systems"][0]["options"]
    assert options["routines"] == [rule] and options["home_enabled"] is False
    assert "schedules" not in options


async def test_old_backup_with_schedules_restores_as_routines(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    backup = {"format": "alarmageddon", "version": 1, "systems": [{"title": "Haus", "options": {"schedules": [_old("away", "08:00")]}}]}
    result = await _ws(client, type="alarmageddon/import", data=backup)
    assert result["success"], result
    await hass.async_block_till_done()
    assert "schedules" not in entry.options
    assert [r["name"] for r in entry.options["routines"]] == ["Schedule 08:00"]


async def test_backup_with_bad_routine_is_rejected(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    bad = _rule("off", _times("08:00"), unsafe=False)
    backup = {"format": "alarmageddon", "version": 1, "systems": [{"title": "Haus", "options": {"routines": [bad]}}]}
    result = await _ws(client, type="alarmageddon/import", data=backup)
    assert result["success"] is False
    assert not entry.options.get("routines")


async def test_choose_modes(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, home_enabled=False, night_enabled=True)
    assert result["success"]
    await hass.async_block_till_done()
    features = hass.states.get(ALARM).attributes["supported_features"]
    assert not features & AlarmControlPanelEntityFeature.ARM_HOME
    assert features & AlarmControlPanelEntityFeature.ARM_AWAY and features & AlarmControlPanelEntityFeature.ARM_NIGHT
    assert hass.states.get("binary_sensor.haus_zone_home") is None
    assert hass.states.get("binary_sensor.haus_zone_night") is not None
    # Zonen bleiben gespeichert, kommen mit dem Modus zurück
    assert entry.options["zone_home"] == [FRONT_DOOR, WINDOW]
    data = await _ws(client, type="alarmageddon/data")
    assert data["result"]["systems"][0]["modes"] == ["away", "night"]


async def test_at_least_one_mode(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, home_enabled=False, away_enabled=False)
    assert result["error"]["code"] == "no_mode"


async def test_active_mode_cannot_be_switched_off(hass: HomeAssistant, hass_ws_client) -> None:
    """Sonst wäre die Anlage nach dem Neuladen still deaktiviert."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await call(hass, "alarm_arm_home")
    result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, home_enabled=False)
    assert result["error"]["code"] == "mode_active"
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    # Ein anderer Modus darf weg
    result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, away_enabled=False)
    assert result["success"]
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_HOME




# ----- Tasten (Entität "event", zum Beispiel ein Hue-Taster) -----


def _fire_button(hass: HomeAssistant, event_type: str, age: float = 0, entity: str = BUTTON) -> None:
    """Die Entität "event" nimmt den Zeitpunkt des Ereignisses als Zustand an und nennt die Art im Attribut."""
    stamp = (dt_util.utcnow() - timedelta(seconds=age)).isoformat()
    hass.states.async_set(entity, stamp, {"event_type": event_type, "event_types": EVENT_TYPES})


async def test_button_press_arms(hass: HomeAssistant) -> None:
    hass.states.async_set(BUTTON, "unknown", {"event_types": EVENT_TYPES})
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_press(BUTTON, "short_release")), name="Taste scharf")])
    _fire_button(hass, "initial_press")  # andere Art: nichts
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED
    _fire_button(hass, "short_release")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    assert hass.states.get(ALARM).attributes["changed_by"] == "Routine: Taste scharf"


async def test_old_button_event_never_triggers(hass: HomeAssistant) -> None:
    """Nach dem Neuladen der Integration kommt der alte Zeitpunkt zurück: das ist kein Tastendruck."""
    hass.states.async_set(BUTTON, "unavailable")
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_press(BUTTON, "short_release")))])
    _fire_button(hass, "short_release", age=3600)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED
    _fire_button(hass, "short_release", age=1)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_button_with_condition(hass: HomeAssistant) -> None:
    """Taste UND Schloss zu: ohne zweite Bedingung bleibt der Druck ohne Wirkung."""
    hass.states.async_set(LOCK, "unlocked")
    await setup_alarm(hass, exit_delay_away=0, routines=[_rule("away", _device(_press(BUTTON, "short_release"), _is(LOCK, "locked")))])
    _fire_button(hass, "short_release")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED
    hass.states.async_set(LOCK, "locked")
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.DISARMED  # der Druck ist vorbei, das Schloss allein genügt nicht
    _fire_button(hass, "short_release", age=0.5)
    await hass.async_block_till_done()
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_button_routine_rejects_hold_and_unknown_type(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    hass.states.async_set(BUTTON, "unknown", {"event_types": EVENT_TYPES})
    client = await hass_ws_client(hass)
    for rule in (_rule("away", _device(_press(BUTTON, "short_release"), hold=5)), _rule("away", _device(_press(BUTTON, "nie_gehoert"))),
                 _rule("away", _device(_press("light.flur", "short_release")))):
        result = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, routines=[rule])
        assert result["success"] is False, rule
    ok = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, routines=[_rule("away", _device(_press(BUTTON, "long_press")))])
    assert ok["success"]


async def test_routine_entities_lists_buttons_with_their_event_types(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    hass.states.async_set(BUTTON, "unknown", {"event_types": EVENT_TYPES, "friendly_name": "Taste 1"})
    client = await hass_ws_client(hass)
    entities = {e["entity_id"]: e for e in (await _ws(client, type="alarmageddon/routine_entities"))["result"]["entities"]}
    assert entities[BUTTON]["states"] == EVENT_TYPES and entities[BUTTON]["domain"] == "event" and entities[BUTTON]["state"] == ""


async def test_switch_from_1_44_0_is_dropped_everywhere(hass: HomeAssistant, hass_ws_client) -> None:
    """Der Schalter "Deaktivieren per Routine erlauben" entfiel: gespeicherte Werte und Sicherungen von 1.44.0 bleiben benutzbar."""
    entry = await setup_alarm(hass, routines_disarm=False, routines=[_rule("off", _times("06:45"), states=("armed",))])
    assert "routines_disarm" not in entry.options
    client = await hass_ws_client(hass)
    backup = {"format": "alarmageddon", "version": 1, "systems": [{"title": "Haus", "options": {"routines_disarm": True, "routines": [_rule("away", _times("08:00"))]}}]}
    result = await _ws(client, type="alarmageddon/import", data=backup)
    assert result["success"], result
    await hass.async_block_till_done()
    assert "routines_disarm" not in entry.options and entry.options["routines"][0]["action"] == "away"
