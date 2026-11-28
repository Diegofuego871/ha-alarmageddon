"""1.93.0: Routinen und Zeitumstellung (Wunsch des Nutzers 2026-11-28): im Herbst läuft eine Uhrzeit aus der doppelten Stunde nur einmal, im Frühling wird
eine Uhrzeit aus der übersprungenen Stunde um 03:00 nachgeholt (Zeitfenster ebenso); nach einem Start wird nie nachgeholt."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from .conftest import setup_alarm
from .test_alarm import call, state
from .test_routines import _device, _rule, _times, _window

ALL_DAYS = (0, 1, 2, 3, 4, 5, 6)
ARMED = AlarmControlPanelState.ARMED_NIGHT
OFF = AlarmControlPanelState.DISARMED


async def _zurich(hass: HomeAssistant) -> None:
    await hass.config.async_set_time_zone("Europe/Zurich")


async def _walk(hass: HomeAssistant, freezer, start: datetime, minutes: int, until=None) -> None:
    """Minute für Minute weiterstellen und jeweils den Zeitwechsel auslösen; `until(t)` kann dazwischen etwas tun."""
    t = start
    for _ in range(minutes):
        t += timedelta(minutes=1)
        freezer.move_to(t)
        async_fire_time_changed(hass, t)
        await hass.async_block_till_done()
        if until is not None:
            await until(t)


def _utc(*args) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


async def test_autumn_time_runs_once_in_the_repeated_hour(hass: HomeAssistant, freezer) -> None:
    """25.10.2026: 02:30 gibt es zweimal (00:30 und 01:30 UTC). Wer dazwischen deaktiviert, wird nicht eine Stunde später erneut scharf."""
    await _zurich(hass)
    start = _utc(2026, 10, 24, 23, 50)
    freezer.move_to(start)
    await setup_alarm(hass, night_enabled=True, routines=[_rule("night", _times("02:30", ALL_DAYS), states=("disarmed", "armed_night"), name="Nachts scharf")])
    ran: list[str] = []

    async def step(t: datetime) -> None:
        if t == _utc(2026, 10, 25, 0, 31):  # erste 02:30: scharf, jemand deaktiviert gleich danach
            assert state(hass) == ARMED
            ran.append("first")
            await call(hass, "alarm_disarm")
        if t == _utc(2026, 10, 25, 1, 31):  # zweite 02:30 (Winterzeit): läuft nicht noch einmal
            ran.append("second")
            assert state(hass) == OFF

    await _walk(hass, freezer, start, 150, step)
    assert ran == ["first", "second"]


async def test_autumn_other_days_still_run_each_day(hass: HomeAssistant, freezer) -> None:
    await _zurich(hass)
    start = _utc(2026, 10, 25, 22, 0)
    freezer.move_to(start)
    await setup_alarm(hass, night_enabled=True, routines=[_rule("night", _times("02:30", ALL_DAYS), name="Nachts scharf")])
    await _walk(hass, freezer, start, 4 * 60)
    assert state(hass) == ARMED  # 26.10. 02:30 (01:30 UTC)


async def test_spring_time_in_the_skipped_hour_is_caught_up_at_three(hass: HomeAssistant, freezer) -> None:
    """29.03.2026: 02:30 gibt es nicht (01:59 → 03:00). Die Routine läuft um 03:00 (01:00 UTC), einmal."""
    await _zurich(hass)
    start = _utc(2026, 3, 29, 0, 30)  # 01:30 MEZ
    freezer.move_to(start)
    await setup_alarm(hass, night_enabled=True, routines=[_rule("night", _times("02:30", ALL_DAYS), states=("disarmed", "armed_night"), name="Nachts scharf")])
    seen: dict[str, AlarmControlPanelState] = {}

    async def step(t: datetime) -> None:
        if t == _utc(2026, 3, 29, 0, 59):  # 01:59 MEZ
            seen["before"] = state(hass)
        if t == _utc(2026, 3, 29, 1, 0):  # 03:00 MESZ
            seen["at_three"] = state(hass)
            await call(hass, "alarm_disarm")
        if t == _utc(2026, 3, 29, 1, 31):
            seen["later"] = state(hass)

    await _walk(hass, freezer, start, 90, step)
    assert seen == {"before": OFF, "at_three": ARMED, "later": OFF}  # nachgeholt um 03:00, danach nie wieder


async def test_spring_time_after_the_gap_is_not_caught_up_twice(hass: HomeAssistant, freezer) -> None:
    """Eine Uhrzeit, die selbst 03:00 ist, läuft nur einmal (Zeitgeber und Nachholen treffen dieselbe Minute)."""
    await _zurich(hass)
    start = _utc(2026, 3, 29, 0, 30)
    freezer.move_to(start)
    await setup_alarm(hass, night_enabled=True, routines=[_rule("night", _times("03:00", ALL_DAYS), states=("disarmed", "armed_night"), name="Nachts scharf")])
    runs = {"n": 0}

    async def step(t: datetime) -> None:
        if t == _utc(2026, 3, 29, 1, 0) and state(hass) == ARMED:
            runs["n"] += 1
            await call(hass, "alarm_disarm")
        if t == _utc(2026, 3, 29, 1, 1):
            assert state(hass) == OFF

    await _walk(hass, freezer, start, 60, step)
    assert runs["n"] == 1


async def test_spring_nothing_is_caught_up_after_a_start(hass: HomeAssistant, freezer) -> None:
    """Startet Home Assistant nach der Lücke (03:10), holt keine Routine etwas nach."""
    await _zurich(hass)
    start = _utc(2026, 3, 29, 1, 10)  # 03:10 MESZ
    freezer.move_to(start)
    await setup_alarm(hass, night_enabled=True, routines=[_rule("night", _times("02:30", ALL_DAYS), name="Nachts scharf")])
    await _walk(hass, freezer, start, 30)
    assert state(hass) == OFF


async def test_spring_window_starting_in_the_gap_is_caught_up(hass: HomeAssistant, freezer) -> None:
    """Ein Zeitfenster 02:30 bis 04:00 beginnt in der Lücke: um 03:00 gilt es, die Routine läuft."""
    await _zurich(hass)
    start = _utc(2026, 3, 29, 0, 30)
    freezer.move_to(start)
    await setup_alarm(hass, night_enabled=True, routines=[_rule("night", _device(_window("02:30", "04:00")), name="Nachts scharf")])
    seen: dict[str, AlarmControlPanelState] = {}

    async def step(t: datetime) -> None:
        if t == _utc(2026, 3, 29, 0, 59):
            seen["before"] = state(hass)
        if t == _utc(2026, 3, 29, 1, 0):
            seen["at_three"] = state(hass)

    await _walk(hass, freezer, start, 40, step)
    assert seen == {"before": OFF, "at_three": ARMED}
