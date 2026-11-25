"""
"Beim Scharfschalten umgehen" nur für offene Sensoren (1.89.0, Frage und Entscheid des Nutzers 2026-11-25: "Nur für offene", "Strenger werden").

Bis 1.88.0 liess "Umgehen" auch einen nicht erreichbaren Sensor durch, trotz "Muss beim Scharfschalten erreichbar sein": dasselbe wie "Muss
erreichbar sein" aus, also doppelt. Zusagen:
- Ob ein nicht erreichbarer Sensor das Scharfschalten verhindert, entscheidet allein "Muss beim Scharfschalten erreichbar sein", auch mit "Umgehen"
  (für alle Modi und mit eigenem Wert je Modus). Keine Umstellung des Bestands: ein Sensor mit beidem verhindert jetzt das Scharfschalten.
- "Bereit zum Scharfschalten" rechnet gleich und nennt den Sensor.
- "Umgehen" wirkt weiter auf offene Sensoren, die nicht offen sein dürfen: sie werden bis zum Deaktivieren übergangen, auch Schliessen und erneutes
  Öffnen lösen nichts aus.
- Wer nicht erreichbar scharf geschaltet wurde ("Muss erreichbar sein" aus), wird überwacht, sobald er sich meldet: zu zurück, dann offen = Alarm.
"""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from .conftest import ALARM, WINDOW, setup_alarm
from .test_alarm import call, state
from .test_review_1_87 import _classes, _events, _set

READY_AWAY = "binary_sensor.haus_ready_to_arm_away"


@pytest.mark.parametrize("config", [
    {"sensor_options": {WINDOW: {"bypass": True}}},
    {"sensor_options": {WINDOW: {"bypass": True, "reachable": True}}},
    {"per_mode_sensors": True, "sensor_modes": {"away": {WINDOW: {"bypass": True}}}},
], ids=["umgehen_voreinstellung_erreichbar", "umgehen_und_erreichbar_eigen", "umgehen_je_modus"])
async def test_bypass_no_longer_lets_an_unreachable_sensor_arm(hass: HomeAssistant, config: dict[str, Any]) -> None:
    _classes(hass)  # Fenster: Voreinstellung "Muss beim Scharfschalten erreichbar sein"
    entry = await setup_alarm(hass, exit_delay_away=0, **config)
    await _set(hass, WINDOW, "unavailable")
    assert state(hass, READY_AWAY) == "off"
    assert hass.states.get(READY_AWAY).attributes["unreachable_sensors"] == [WINDOW]
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "alarm_arm_away")
    assert err.value.translation_key == "sensors_not_ready"
    assert state(hass) == AlarmControlPanelState.DISARMED
    assert _events(entry, "arm_failed")[0]["unreachable"] == [WINDOW]


async def test_without_reachable_it_arms_and_watches_the_sensor_when_it_returns(hass: HomeAssistant) -> None:
    _classes(hass)
    await setup_alarm(hass, exit_delay_away=0, sensor_options={WINDOW: {"reachable": False}})
    await _set(hass, WINDOW, "unavailable")
    assert state(hass, READY_AWAY) == "on"
    await call(hass, "alarm_arm_away")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    await _set(hass, WINDOW, "off")  # meldet sich wieder, zu
    await _set(hass, WINDOW, "on")
    assert state(hass) == AlarmControlPanelState.TRIGGERED


async def test_bypass_still_skips_an_open_sensor_until_disarmed(hass: HomeAssistant) -> None:
    _classes(hass)
    await setup_alarm(hass, exit_delay_away=0, sensor_options={WINDOW: {"bypass": True}})
    await _set(hass, WINDOW, "on")
    assert state(hass, READY_AWAY) == "on"
    await call(hass, "alarm_arm_away")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    assert hass.states.get(ALARM).attributes["bypassed_sensors"] == [WINDOW]
    await _set(hass, WINDOW, "off")
    await _set(hass, WINDOW, "on")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY, "übergangen bis zum Deaktivieren"
    await call(hass, "alarm_disarm")
    assert hass.states.get(ALARM).attributes["bypassed_sensors"] == []


async def test_bypass_has_no_effect_when_the_sensor_may_be_open(hass: HomeAssistant) -> None:
    """Mit "Muss geschlossen sein" aus (darf offen sein) bleibt ein offener Sensor überwacht, auch mit "Umgehen": Schliessen und Öffnen alarmiert."""
    _classes(hass)
    await setup_alarm(hass, exit_delay_away=0, sensor_options={WINDOW: {"bypass": True, "open_ok": True}})
    await _set(hass, WINDOW, "on")
    await call(hass, "alarm_arm_away")
    assert hass.states.get(ALARM).attributes["bypassed_sensors"] == []
    await _set(hass, WINDOW, "off")
    await _set(hass, WINDOW, "on")
    assert state(hass) == AlarmControlPanelState.TRIGGERED
