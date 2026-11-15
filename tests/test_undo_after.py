"""
Rückgängig nach einer Zeit (1.37.0): "Gerät schalten" ruft nach N Sekunden den Gegendienst auf (Steckdose mit Sirene: ein, nach 120 s aus).

Die Zeit bestimmt allein der Nutzer (CLAUDE.md, Sicherheitsregeln): sie gilt genau, zählt ab dem Aufruf, auch über Neuladen und Neustart, und
Deaktivieren, Quittieren und das Ende eines Tests schalten sofort zurück. Der Gegendienst ist Zusatz: er hängt nie etwas auf.
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
from custom_components.alarmageddon.const import DOMAIN, TEST_SECONDS, UNDO_SERVICES, WORKFLOW_STORE_KEY
from custom_components.alarmageddon.schemas import valid_step

from .conftest import ALARM, FRONT_DOOR, MOTION, WINDOW, options, setup_alarm
from .test_alarm import advance, call, open_sensor, settle, state

SIREN = "switch.steckdose_sirene"


def step(seconds: int | None, action: str = "switch.turn_on", target: str = SIREN, **more: Any) -> dict[str, Any]:
    out: dict[str, Any] = {"type": "action", "action": action, "target": [target], **more}
    if seconds is not None:
        out["undo_after"] = seconds
    return out


def mock(hass: HomeAssistant, *names: str) -> dict[str, list[ServiceCall]]:
    return {name: async_mock_service(hass, *name.split(".")) for name in names}


@pytest.mark.parametrize("seconds", [1, 30, 180])
async def test_the_counter_service_runs_after_exactly_the_set_time(hass: HomeAssistant, freezer, seconds: int) -> None:
    s = mock(hass, "switch.turn_on", "switch.turn_off")
    await setup_alarm(hass, workflows={"home": [step(seconds)]})
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    assert len(s["switch.turn_on"]) == 1 and not s["switch.turn_off"]
    if seconds > 1:
        await advance(hass, freezer, seconds - 1)
        assert not s["switch.turn_off"], "nicht vor der eingestellten Zeit"
    await advance(hass, freezer, 1)
    assert len(s["switch.turn_off"]) == 1 and s["switch.turn_off"][0].data["entity_id"] == [SIREN]
    await advance(hass, freezer, 3600)
    assert len(s["switch.turn_off"]) == 1 and len(s["switch.turn_on"]) == 1, "weder ein zweites Mal aus noch ein zweites Mal ein"
    assert state(hass) == AlarmControlPanelState.TRIGGERED


@pytest.mark.parametrize("pair", sorted(UNDO_SERVICES.items()), ids=lambda p: f"{p[0]}->{p[1]}")
async def test_every_service_has_its_counter_service(hass: HomeAssistant, freezer, pair: tuple[str, str]) -> None:
    service, inverse = pair
    domain = {"open_cover": "cover", "close_cover": "cover", "open_valve": "valve", "close_valve": "valve", "lock": "lock", "unlock": "lock"}.get(service, "switch")
    inverse_domain = domain
    s = mock(hass, f"{domain}.{service}", f"{inverse_domain}.{inverse}")
    entity = f"{domain}.gerät"
    await setup_alarm(hass, workflows={"home": [step(20, f"{domain}.{service}", entity)]})
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    assert len(s[f"{domain}.{service}"]) >= 1
    calls_before = len(s[f"{inverse_domain}.{inverse}"]) if inverse != service else 0
    await advance(hass, freezer, 21)
    got = s[f"{inverse_domain}.{inverse}"]
    assert len(got) == (1 if inverse != service else 2) and got[-1].data["entity_id"] == [entity], (calls_before, len(got))


@pytest.mark.parametrize("how", ["deactivate", "acknowledge"])
async def test_ending_the_alarm_switches_back_at_once(hass: HomeAssistant, freezer, how: str) -> None:
    """Eine Steckdose mit Sirene bleibt nie länger an als der Alarm: Deaktivieren und Quittieren schalten sofort zurück, nicht erst zur Zeit."""
    s = mock(hass, "switch.turn_on", "switch.turn_off")
    entry = await setup_alarm(hass, workflows={"home": [step(600)]})
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    await advance(hass, freezer, 30)
    assert not s["switch.turn_off"]
    ctl = entry.runtime_data.controller
    if how == "deactivate":
        await ctl.async_disarm(None, skip_code=True)
    else:
        ctl.acknowledge("Test")
    await settle(hass)
    assert len(s["switch.turn_off"]) == 1
    await advance(hass, freezer, 700)
    assert len(s["switch.turn_off"]) == 1, "die vorgemerkte Zeit schaltet nicht ein zweites Mal"


async def test_the_set_time_counts_from_the_call_across_a_reload(hass: HomeAssistant, freezer) -> None:
    s = mock(hass, "switch.turn_on", "switch.turn_off")
    entry = await setup_alarm(hass, workflows={"home": [step(180), {"type": "wait", "seconds": 3600}]})  # der Schritt danach hält den Ablauf bei Schritt 2
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    await advance(hass, freezer, 100)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "entry_delay": 25})
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert not s["switch.turn_off"], "das Neuladen schaltet nicht vor der Zeit zurück"
    await advance(hass, freezer, 79)
    assert not s["switch.turn_off"]
    await advance(hass, freezer, 2)
    assert len(s["switch.turn_off"]) == 1 and len(s["switch.turn_on"]) == 1


@pytest.mark.parametrize(("elapsed", "left"), [(60, 120), (179, 1), (400, 0)], ids=["nach 60 s", "kurz vor Ende", "Zeit schon um"])
async def test_the_set_time_counts_across_a_restart_of_home_assistant(hass: HomeAssistant, hass_storage, freezer, elapsed: int, left: int) -> None:
    s = mock(hass, "switch.turn_on", "switch.turn_off")
    started = dt_util.utcnow() - timedelta(seconds=elapsed)
    key = f"{WORKFLOW_STORE_KEY}.undo"
    entry_data = {"domain": "switch", "service": "turn_off", "target": [SIREN], "at": (started + timedelta(seconds=180)).isoformat()}
    run = {"trigger": "home", "index": 1, "test": False, "snapshot": {}, "sonos": [], "steps": None, "undo": [entry_data]}
    hass_storage[key] = {"version": 1, "minor_version": 1, "key": key, "data": run}
    data = {"mode": "home", "deadline": None, "bypassed": [], "triggered_by": WINDOW, "changed_by": None}
    mock_restore_cache_with_extra_data(hass, [(State(ALARM, "triggered"), data)])
    for entity in (FRONT_DOOR, WINDOW, MOTION):
        hass.states.async_set(entity, "off")
    config = MockConfigEntry(domain=DOMAIN, entry_id="undo", title="Haus", data={"name": "Haus"}, options=options(workflows={"home": [step(180), {"type": "wait", "seconds": 3600}]}))
    config.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config.entry_id)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    assert not s["switch.turn_on"], "der Schritt läuft nach dem Neustart nicht ein zweites Mal"
    if left:
        await advance(hass, freezer, left - 1)
        assert not s["switch.turn_off"]
        await advance(hass, freezer, 2)
    else:
        await advance(hass, freezer, 1)
    assert len(s["switch.turn_off"]) == 1


async def test_a_counter_service_that_does_not_answer_never_holds_up_the_end(hass: HomeAssistant, monkeypatch) -> None:
    """Antwortet das Gerät beim Zurückschalten nicht, endet das Deaktivieren trotzdem innerhalb der Grenze für Aufrufe."""
    monkeypatch.setattr(wf, "SERVICE_TIMEOUT", 0.3)
    async_mock_service(hass, "switch", "turn_on")

    async def hang(_call: ServiceCall) -> None:
        await asyncio.sleep(3600)

    hass.services.async_register("switch", "turn_off", hang)
    entry = await setup_alarm(hass, workflows={"home": [step(600)]})
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    await asyncio.wait_for(entry.runtime_data.controller.async_disarm(None, skip_code=True), 5)
    await asyncio.wait_for(entry.runtime_data.workflow.async_stop(), 5)
    assert entry.runtime_data.workflow.running is None


async def test_a_test_switches_back_when_it_ends(hass: HomeAssistant, freezer) -> None:
    """Der Test-Knopf eines Schritts mit Rückgängig: nach der Zeit zurück, beim Stopp und am Ende des Zeitfensters sofort."""
    s = mock(hass, "switch.turn_on", "switch.turn_off")
    entry = await setup_alarm(hass)
    runner = entry.runtime_data.workflow
    assert await runner.async_run("home", test=True, steps=[step(20)])
    await settle(hass)
    assert len(s["switch.turn_on"]) == 1 and not s["switch.turn_off"]
    await advance(hass, freezer, 21)
    assert len(s["switch.turn_off"]) == 1
    # Stopp vor der Zeit
    await runner.async_stop()
    s["switch.turn_off"].clear()
    assert await runner.async_run("home", test=True, steps=[step(600)])
    await settle(hass)
    await runner.async_stop()
    assert len(s["switch.turn_off"]) == 1
    # Ende des Zeitfensters vor der Zeit
    s["switch.turn_off"].clear()
    assert await runner.async_run("home", test=True, steps=[step(3000)])
    await settle(hass)
    await advance(hass, freezer, TEST_SECONDS + 1)
    assert len(s["switch.turn_off"]) == 1 and runner.running is None


async def test_a_real_alarm_takes_over_the_pending_counter_service_of_a_test(hass: HomeAssistant, freezer) -> None:
    """Kommt mitten im Test ein echter Alarm, geht der vorgemerkte Gegendienst nicht verloren und kommt nicht früher als eingestellt."""
    s = mock(hass, "switch.turn_on", "switch.turn_off")
    entry = await setup_alarm(hass, workflows={"home": [{"type": "wait", "seconds": 3000}]})
    runner = entry.runtime_data.workflow
    assert await runner.async_run("home", test=True, steps=[step(120)])
    await settle(hass)
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    assert runner.running is not None and not runner.running.get("test")
    assert not s["switch.turn_off"]
    await advance(hass, freezer, 119)
    assert not s["switch.turn_off"]
    await advance(hass, freezer, 2)
    assert len(s["switch.turn_off"]) == 1


def test_the_step_schema_only_allows_a_time_where_there_is_a_counter_service() -> None:
    assert valid_step(step(30))["undo_after"] == 30
    assert valid_step(step(30, "cover.open_cover", "cover.rollladen"))["undo_after"] == 30
    for bad in (step(30, "scene.turn_on", "scene.abend"), step(30, "light.set_temperature_x"), {"type": "action", "action": "switch.turn_on", "target": [], "undo_after": 30}):
        with pytest.raises(vol.Invalid):
            valid_step(bad)
    for bad_time in (0, -5, 3601):
        with pytest.raises(vol.Invalid):
            valid_step(step(bad_time))
    assert "undo_after" not in valid_step(step(None))
