"""
Ausfall während der Ausgangsverzögerung (1.89.0, Entscheid des Nutzers 2026-11-25): bis 1.88.0 wurde die Anlage still scharf, wenn ein Sensor der Zone
während der Ausgangsverzögerung ausfiel: keine Meldung, kein Eintrag, und kam er danach offen zurück, nur ein Eintrag im Protokoll (kein Alarm).

Zusagen:
- Ein Sensor der Zone, der während der Ausgangsverzögerung ausfällt und beim Scharfwerden noch nicht zurück ist, wird gemeldet wie ein Ausfall im
  scharfen Zustand (Ereignis und Meldung "Sensor im scharfen Zustand nicht erreichbar"); mit "Bei Ausfall Alarm" gibt es den Alarm.
- War er zu, als er ausfiel, und kommt er offen zurück, nachdem die Anlage scharf ist, ist das nach RETURN_CONFIRM ein Öffnen (Alarm).
- Kommt er noch während der Ausgangsverzögerung zurück (zu oder offen), geschieht nichts Besonderes: offen ist in dieser Zeit gewöhnlich.
- Sensoren, die schon vor dem Scharfschalten ausgefallen waren (erlaubt oder "Trotzdem scharf schalten"), meldet das Scharfwerden nicht.
- Deaktivieren oder ein neuer Versuch in der Ausgangsverzögerung vergisst die Ausfälle.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.alarmageddon.const import RETURN_CONFIRM

from .conftest import ALARM, FRONT_DOOR, MOTION, WINDOW, setup_alarm
from .test_actions import _notify_settings
from .test_alarm import advance, call, settle, state

DELAY = 30


async def _set(hass: HomeAssistant, entity: str, value: str) -> None:
    old = hass.states.get(entity)
    hass.states.async_set(entity, value, old.attributes if old else {})
    await settle(hass)


def _events(entry, kind: str) -> list[dict[str, Any]]:
    return [e for e in entry.runtime_data.events.events if e.get("kind") == kind]


async def test_failure_during_the_exit_delay_is_reported_when_armed(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    pushes = async_mock_service(hass, "notify", "handy")
    entry = await setup_alarm(hass, exit_delay_home=DELAY)
    await _notify_settings(hass, hass_ws_client)
    await call(hass, "alarm_arm_home")
    assert state(hass) == AlarmControlPanelState.ARMING
    await _set(hass, WINDOW, "unavailable")
    assert not _events(entry, "sensor_offline"), "erst beim Scharfwerden"
    before = len(pushes)
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert [e["sensor"] for e in _events(entry, "sensor_offline")] == [WINDOW]
    assert len(pushes) == before + 1, "Meldung \"Sensor im scharfen Zustand nicht erreichbar\""


async def test_with_offline_alarm_it_triggers_when_armed(hass: HomeAssistant, freezer) -> None:
    await setup_alarm(hass, exit_delay_home=DELAY, sensor_options={WINDOW: {"offline_alarm": True}})
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert hass.states.get(ALARM).attributes["triggered_by"] == WINDOW


async def test_all_failures_are_reported_and_the_alarm_starts_once(hass: HomeAssistant, freezer) -> None:
    entry = await setup_alarm(hass, exit_delay_home=DELAY, sensor_options={FRONT_DOOR: {"offline_alarm": True}, WINDOW: {"offline_alarm": True}})
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await _set(hass, FRONT_DOOR, "unavailable")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert sorted(e["sensor"] for e in _events(entry, "sensor_offline")) == sorted([FRONT_DOOR, WINDOW])
    alarms = [e for e in entry.runtime_data.events.events if "kind" not in e and e.get("state") == "triggered"]
    assert len(alarms) == 1 and alarms[0]["sensor"] == min(FRONT_DOOR, WINDOW), "ein Alarm, mit dem ersten Sensor"


async def test_closed_failed_returning_open_after_arming_triggers(hass: HomeAssistant, freezer) -> None:
    entry = await setup_alarm(hass, exit_delay_home=DELAY)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    await _set(hass, WINDOW, "on")
    assert state(hass) == AlarmControlPanelState.ARMED_HOME, "erst nach der Bestätigung"
    await advance(hass, freezer, RETURN_CONFIRM + 1)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert _events(entry, "sensor_back_open")[0]["alarm"] is True


async def test_returning_during_the_exit_delay_is_ordinary(hass: HomeAssistant, freezer) -> None:
    """Zurück in der Ausgangsverzögerung, offen: kein Alarm (auch nicht, wenn die Bestätigung erst nach dem Scharfwerden fällig wäre), keine Meldung."""
    entry = await setup_alarm(hass, exit_delay_home=DELAY)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await advance(hass, freezer, DELAY - 1)
    await _set(hass, WINDOW, "on")
    await advance(hass, freezer, RETURN_CONFIRM + 2)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert not _events(entry, "sensor_offline") and not _events(entry, "sensor_back_open")


async def test_returning_closed_during_the_exit_delay_is_not_reported(hass: HomeAssistant, freezer) -> None:
    entry = await setup_alarm(hass, exit_delay_home=DELAY)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await _set(hass, WINDOW, "off")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME and not _events(entry, "sensor_offline")


async def test_failure_before_arming_is_not_reported_again(hass: HomeAssistant, freezer) -> None:
    """Schon vor dem Versuch ausgefallen (ohne "Muss erreichbar sein" erlaubt): das Scharfschalten hat es gesehen, das Scharfwerden meldet es nicht."""
    entry = await setup_alarm(hass, exit_delay_home=DELAY)
    await _set(hass, WINDOW, "unavailable")
    await call(hass, "alarm_arm_home")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME and not _events(entry, "sensor_offline")


async def test_disarm_or_a_new_attempt_forgets_the_failures(hass: HomeAssistant, freezer) -> None:
    entry = await setup_alarm(hass, exit_delay_home=DELAY, exit_delay_away=DELAY)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await call(hass, "alarm_disarm")
    await call(hass, "alarm_arm_home")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME and not _events(entry, "sensor_offline")
    await call(hass, "alarm_disarm")
    await _set(hass, WINDOW, "off")
    # Ein neuer Versuch in der Ausgangsverzögerung (anderer Modus): was vorher ausfiel, prüft dieser Versuch selbst
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    await call(hass, "alarm_arm_away")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY and not _events(entry, "sensor_offline")


async def test_sensor_outside_the_zone_or_bypassed_is_not_reported(hass: HomeAssistant, freezer) -> None:
    entry = await setup_alarm(hass, exit_delay_home=DELAY, sensor_options={FRONT_DOOR: {"bypass": True}})
    await _set(hass, FRONT_DOOR, "on")  # offen beim Scharfschalten: mit "Umgehen" bis zum Deaktivieren übergangen
    await call(hass, "alarm_arm_home")
    await _set(hass, MOTION, "unavailable")  # nur in der Zone "Abwesend"
    await _set(hass, FRONT_DOOR, "unavailable")
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME and not _events(entry, "sensor_offline")


async def test_reload_during_the_exit_delay_keeps_the_failure(hass: HomeAssistant, freezer) -> None:
    """Speichern im Panel lädt die Anlage neu: ein Ausfall in der Ausgangsverzögerung geht dabei nicht verloren."""
    entry = await setup_alarm(hass, exit_delay_home=DELAY)
    await call(hass, "alarm_arm_home")
    await _set(hass, WINDOW, "unavailable")
    assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.ARMING
    await advance(hass, freezer, DELAY + 1)
    assert state(hass) == AlarmControlPanelState.ARMED_HOME
    assert [e["sensor"] for e in _events(entry, "sensor_offline")] == [WINDOW]
