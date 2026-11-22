"""
1.80.0 (Wunsch des Nutzers 2026-11-22): "HealthCheck melden" im Ablauf eines Alarms kann die Meldung bis zum Ende des Alarms **wiederholen** (im Abstand des
Dienstes, nie ein eigener) und die normalen Lebenszeichen dieses Dienstes **pausieren**, damit sie den Alarm beim Dienst nicht überschreiben. Beides gilt nur im
Ablauf eines echten Alarms, nie im Test und nie in den Läufen neben dem Alarm, endet mit Deaktivieren und Quittieren und hält nie etwas auf.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.alarmageddon.const import DATA_HEALTHCHECK, DATA_HEALTHCHECK_HOLDS, HEALTHCHECK_START_DELAY

from .conftest import ALARM, WINDOW, setup_alarm
from .test_action_hang import settle
from .test_alarm import call, open_sensor
from .test_healthcheck import HC, advance, calls

INTERVAL = 300
REPORT = f"{HC}/2"


def service(hass_storage) -> None:
    hass_storage["alarmageddon.settings"] = {"version": 1, "key": "alarmageddon.settings", "data": {"healthchecks": [
        {"id": "abc", "name": "Haus", "url": HC, "fail_suffix": "/fail", "interval": INTERVAL}]}}


def step(**flags) -> dict:
    return {"type": "healthcheck", "check_id": "abc", "suffix": "/2", **flags}


async def alarm(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker, steps, key: str = "home"):
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(REPORT, status=200)
    service(hass_storage)
    entry = await setup_alarm(hass, workflows={key: steps})
    await advance(hass, freezer, HEALTHCHECK_START_DELAY + 2)
    aioclient_mock.mock_calls.clear()
    return entry


async def trigger(hass: HomeAssistant) -> None:
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    assert hass.states.get(ALARM).state == "triggered"
    await settle(hass)


async def test_repeat_and_pause_replace_the_life_signs_in_the_interval_of_the_service(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=True)])
    await trigger(hass)
    assert calls(aioclient_mock) == [REPORT]
    for _ in range(3):
        await advance(hass, freezer, INTERVAL + 1)
    # Nur die Meldung, im Abstand des Dienstes; kein normales Lebenszeichen überschreibt sie
    assert calls(aioclient_mock) == [REPORT] * 4
    events = hass.data[DATA_HEALTHCHECK].log.history("abc", 24, 3600)["events"]
    assert sum(e.get("n", 1) for e in events if e["kind"] == "report") == 4, "die Wiederholungen stehen als Meldungen im Protokoll (zusammengefasst)"
    assert all(e["by"] != "end" for e in events)


async def test_nothing_is_held_without_the_switches(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    """Schritte aus 1.77.0 bis 1.79.x tragen die Angaben nicht: sie verhalten sich wie bisher (eine Meldung, der Takt läuft weiter)."""
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step()])
    await trigger(hass)
    assert not hass.data.get(DATA_HEALTHCHECK_HOLDS)
    await advance(hass, freezer, INTERVAL + 1)
    assert calls(aioclient_mock) == [REPORT, HC]


async def test_pause_alone_sends_one_report_and_no_life_sign(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=False, pause=True)])
    await trigger(hass)
    for _ in range(3):
        await advance(hass, freezer, INTERVAL + 1)
    assert calls(aioclient_mock) == [REPORT]


async def test_repeat_alone_keeps_the_life_signs_going(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=False)])
    await trigger(hass)
    await advance(hass, freezer, INTERVAL + 1)
    assert sorted(calls(aioclient_mock)) == sorted([REPORT, REPORT, HC])


@pytest.mark.parametrize("ending", ["alarm_disarm", "acknowledge"])
async def test_the_alarm_ending_stops_the_repeats_and_the_life_signs_follow_at_once(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker, ending: str) -> None:
    entry = await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=True)])
    await trigger(hass)
    aioclient_mock.mock_calls.clear()
    if ending == "alarm_disarm":
        await call(hass, "alarm_disarm")
    else:
        entry.runtime_data.controller.acknowledge()
    await settle(hass)
    await advance(hass, freezer, 61)  # der Mindestabstand der Lebenszeichen
    assert calls(aioclient_mock) == [HC], "gleich ein normales Lebenszeichen"
    assert not hass.data[DATA_HEALTHCHECK]._repeats and not hass.data[DATA_HEALTHCHECK]._paused
    assert not hass.data.get(DATA_HEALTHCHECK_HOLDS)
    aioclient_mock.mock_calls.clear()
    await advance(hass, freezer, INTERVAL + 1)
    assert calls(aioclient_mock) == [HC], "danach nur noch der normale Takt, keine Wiederholung"


async def test_a_test_run_and_a_run_beside_the_alarm_hold_nothing(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    entry = await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=True)])
    entry.runtime_data.workflow._run = {"trigger": "home", "index": 0, "test": True, "steps": []}
    entry.runtime_data.workflow._hc_hold({"hid": "abc", "suffix": "/2", "repeat": True, "pause": True})
    entry.runtime_data.workflow._run = {"trigger": "home", "index": 0, "test": False, "after": True, "phase": "armed", "steps": []}
    entry.runtime_data.workflow._hc_hold({"hid": "abc", "suffix": "/2", "repeat": True, "pause": True})
    entry.runtime_data.workflow._run = None
    assert not hass.data.get(DATA_HEALTHCHECK_HOLDS)
    assert not hass.data[DATA_HEALTHCHECK]._paused and not hass.data[DATA_HEALTHCHECK]._repeats


async def test_a_step_in_the_actions_after_the_alarm_holds_nothing(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(REPORT, status=200)
    service(hass_storage)
    await setup_alarm(hass, workflows_after={"home": [step(repeat=True, pause=True)]})
    await advance(hass, freezer, HEALTHCHECK_START_DELAY + 2)
    await trigger(hass)
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert not hass.data.get(DATA_HEALTHCHECK_HOLDS)
    assert not hass.data[DATA_HEALTHCHECK]._paused


async def test_a_reload_in_the_middle_of_the_alarm_keeps_repeating_and_pausing(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    entry = await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=True)])
    await trigger(hass)
    aioclient_mock.mock_calls.clear()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    assert healthcheck._paused == {"abc"} and len(healthcheck._repeats) == 1
    assert calls(aioclient_mock).count(REPORT) == 1, "nach dem Laden meldet er gleich wieder"
    aioclient_mock.mock_calls.clear()
    await advance(hass, freezer, INTERVAL + 1)
    assert calls(aioclient_mock) == [REPORT]


async def test_a_deleted_service_stops_its_repeats(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=True)])
    await trigger(hass)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    healthcheck._settings.data["healthchecks"] = []
    aioclient_mock.mock_calls.clear()
    await advance(hass, freezer, INTERVAL + 1)
    assert calls(aioclient_mock) == []
    healthcheck.async_sync_holds()
    assert not healthcheck._repeats and not healthcheck._paused


async def test_the_failure_of_the_selftest_still_goes_out_while_paused(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    """Pausiert werden nur die Lebenszeichen "in Ordnung"; ein Fehler des Selbsttests geht weiter hinaus."""
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=False, pause=True)])
    await trigger(hass)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    aioclient_mock.get(f"{HC}/fail", status=200)
    healthcheck.failing = lambda: True  # type: ignore[method-assign]
    aioclient_mock.mock_calls.clear()
    freezer.tick(timedelta(seconds=120))
    assert healthcheck.async_ping("abc", by="selftest") is not None
    await hass.async_block_till_done(wait_background_tasks=True)
    assert calls(aioclient_mock) == [f"{HC}/fail"]


def test_the_schema_takes_only_booleans_for_the_switches() -> None:
    import voluptuous as vol

    from custom_components.alarmageddon.schemas import STEP_SCHEMAS

    assert STEP_SCHEMAS["healthcheck"](step(repeat=True, pause=False))["repeat"] is True
    for bad in ("ja", 1.5, None, {}):
        with pytest.raises(vol.Invalid):
            STEP_SCHEMAS["healthcheck"](step(repeat=bad))
        with pytest.raises(vol.Invalid):
            STEP_SCHEMAS["healthcheck"](step(pause=bad))


async def test_a_failing_hold_never_stops_the_step_or_the_alarm(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    """Sicherheitsregel: nichts hier hält Schritte oder den Alarm auf; die nächsten Schritte laufen, die Meldung ging schon hinaus."""
    entry = await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=True), {"type": "action", "action": "switch.turn_on", "target": ["switch.sirene"]}])
    calls_made = []
    hass.services.async_register("switch", "turn_on", lambda call: calls_made.append(call))
    healthcheck = hass.data[DATA_HEALTHCHECK]

    def boom(*_a, **_k):
        raise RuntimeError("kaputt")

    healthcheck.async_sync_holds = boom  # type: ignore[method-assign]
    await trigger(hass)
    assert hass.states.get(ALARM).state == "triggered"
    assert calls(aioclient_mock)[0] == REPORT
    assert len(calls_made) == 1, "der Schritt danach lief"
    assert entry.runtime_data.workflow is not None


async def test_every_regular_life_sign_is_held_back_while_paused(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    """Nicht nur der Takt: auch ein Lebenszeichen nach einem Wechsel des Selbsttests oder dem Speichern kommt während der Pause nicht hinaus."""
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=False, pause=True)])
    await trigger(hass)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    aioclient_mock.mock_calls.clear()
    freezer.tick(timedelta(seconds=120))
    assert healthcheck.async_ping("abc", by="selftest") is None
    assert healthcheck.async_ping("abc", respect_gap=True, by="save") is None
    await hass.async_block_till_done(wait_background_tasks=True)
    assert calls(aioclient_mock) == []


async def test_the_repeat_waits_for_the_interval_of_the_service(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    """Der Abstand ist der des Dienstes (hier 300 s), nie ein eigener: davor keine Wiederholung."""
    await alarm(hass, freezer, hass_storage, aioclient_mock, [step(repeat=True, pause=True)])
    await trigger(hass)
    aioclient_mock.mock_calls.clear()
    await advance(hass, freezer, INTERVAL - 100)
    assert calls(aioclient_mock) == []
    await advance(hass, freezer, 101)
    assert calls(aioclient_mock) == [REPORT]
