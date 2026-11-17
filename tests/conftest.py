"""Gemeinsame Fixtures: echtes Home Assistant über pytest-homeassistant-custom-component."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

# Beim Sammeln importieren: später zeigt custom_components je nach Reihenfolge auf das Testpaket von HA (LEARNINGS).
from custom_components.alarmageddon.config_flow import default_options
from custom_components.alarmageddon.const import CONF_NAME, DOMAIN

pytest_plugins = "pytest_homeassistant_custom_component"

ALARM = "alarm_control_panel.haus"
FRONT_DOOR = "binary_sensor.haustuer"
WINDOW = "binary_sensor.fenster_kueche"
MOTION = "binary_sensor.bewegung_flur"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Lädt custom_components/alarmageddon in jedem Test."""
    yield


@pytest.fixture(autouse=True)
def no_deprecated_home_assistant_use(caplog):
    """
    Kein Test darf eine veraltete Schnittstelle von Home Assistant benutzen (1.60.0). Home Assistant meldet das im Log ("Detected that
    custom integration 'alarmageddon' ..."); jede solche Meldung kostet im Betrieb mehrere Millisekunden im Event-Loop, und die
    Schnittstelle fällt später weg. Bis 1.59.0 stand Home Assistant deswegen bei jedem Abruf der Übersicht still (siehe devices.py).
    """
    yield
    hits = [
        record.getMessage()
        for when in ("setup", "call", "teardown")
        for record in caplog.get_records(when)
        if "Detected that custom integration 'alarmageddon'" in record.getMessage()
    ]
    assert not hits, f"Veraltete Schnittstelle von Home Assistant benutzt: {hits[0]}"


@pytest.fixture(autouse=True)
def skip_frontend(hass):
    """Das Testpaket bringt das HA-Frontend nicht mit: als geladen markieren (LEARNINGS)."""
    hass.config.components.add("frontend")
    yield


def options(**overrides: Any) -> dict[str, Any]:
    """Typische Anlage: Haustür mit Eingangsverzögerung, Fenster in beiden Zonen, Bewegung nur abwesend."""
    data = default_options()
    data.update(
        zone_home=[FRONT_DOOR, WINDOW],
        zone_away=[FRONT_DOOR, WINDOW, MOTION],
        zone_night=[FRONT_DOOR, WINDOW],
        entry_sensors=[FRONT_DOOR],
        exit_delay_away=30,
        entry_delay=20,
    )
    data.update(overrides)
    return data


async def setup_alarm(hass: HomeAssistant, title: str = "Haus", **overrides: Any) -> MockConfigEntry:
    for entity in (FRONT_DOOR, WINDOW, MOTION):
        if hass.states.get(entity) is None:
            hass.states.async_set(entity, "off")
    entry = MockConfigEntry(domain=DOMAIN, title=title, data={CONF_NAME: title}, options=options(**overrides))
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry
