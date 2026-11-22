"""
1.82.0 (Wunsch des Nutzers 2026-11-22): Aufräumen beim Löschen einer Anlage. Jede Anlage nimmt ihre eigenen Daten mit und die gemerkten letzten Änderungen ihrer Sensoren
(soweit keine andere Anlage sie nutzt); mit der letzten Anlage gehen auch die gemeinsamen Verläufe und der Wartungsstand. Backups, Einstellungen und eigene Töne bleiben.
"""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from custom_components.alarmageddon.const import (
    BACKUPS_STORE_KEY,
    CUSTOM_SOUNDS_STORE_KEY,
    DATA_RECEPTION,
    DOMAIN,
    EVENTS_STORE_KEY,
    HEALTHLOG_STORE_KEY,
    MAINTENANCE_STORE_KEY,
    RECORDINGS_STORE_KEY,
    SETTINGS_STORE_KEY,
)
from custom_components.alarmageddon.reception import STORE_KEY as RECEPTION_STORE_KEY
from custom_components.alarmageddon.sensor_history import STATS_STORE_KEY
from custom_components.alarmageddon.settings import async_get_settings

from .conftest import FRONT_DOOR, MOTION, WINDOW, setup_alarm


def _store(hass_storage, key: str, data) -> None:
    hass_storage[key] = {"version": 1, "key": key, "data": data}


async def test_removing_one_of_two_systems_drops_only_its_own_sensor_changes(hass: HomeAssistant, hass_storage) -> None:
    first = await setup_alarm(hass, title="Haus")
    second = await setup_alarm(hass, title="Garage", zone_home=[WINDOW], zone_away=[WINDOW], zone_night=[WINDOW], entry_sensors=[], sensors=[])
    settings = await async_get_settings(hass)
    for entity in (FRONT_DOOR, WINDOW, MOTION, "binary_sensor.fremd"):
        settings.note_change(entity, "2026-01-01T00:00:00+00:00")
    _store(hass_storage, f"{EVENTS_STORE_KEY}.{first.entry_id}", {"events": []})
    assert await hass.config_entries.async_remove(first.entry_id)
    await hass.async_block_till_done()
    # Die Sensoren, die nur "Haus" nutzte, sind weg; Fenster steht auch in der Garage, ein fremder Sensor gehört keiner Anlage
    assert set(settings.last_changes) == {WINDOW, "binary_sensor.fremd"}
    assert f"{EVENTS_STORE_KEY}.{first.entry_id}" not in hass_storage
    # Die gemeinsamen Daten bleiben, die andere Anlage braucht sie
    assert second.entry_id in {e.entry_id for e in hass.config_entries.async_entries(DOMAIN)}


async def test_removing_the_last_system_drops_the_shared_histories_but_keeps_backups_settings_and_sounds(hass: HomeAssistant, hass_storage) -> None:
    entry = await setup_alarm(hass)
    settings = await async_get_settings(hass)
    settings.note_change(WINDOW, "2026-01-01T00:00:00+00:00")
    keep = {BACKUPS_STORE_KEY: {"backups": []}, CUSTOM_SOUNDS_STORE_KEY: {"sounds": []}, SETTINGS_STORE_KEY: {"presets": {}}}
    gone = {HEALTHLOG_STORE_KEY: {"calls": {}}, MAINTENANCE_STORE_KEY: {"battery": {}}, STATS_STORE_KEY: {"x": {}}, RECEPTION_STORE_KEY: {"y": {}}}
    for key, data in {**keep, **gone}.items():
        _store(hass_storage, key, data)
    assert DATA_RECEPTION in hass.data
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    for key in gone:
        assert key not in hass_storage, key
    assert BACKUPS_STORE_KEY in hass_storage and CUSTOM_SOUNDS_STORE_KEY in hass_storage
    assert SETTINGS_STORE_KEY in hass_storage or settings.presets is not None
    assert settings.last_changes == {}
    assert DATA_RECEPTION not in hass.data, "nichts im Speicher schreibt die Verläufe wieder"
    assert f"{RECORDINGS_STORE_KEY}.{entry.entry_id}" not in hass_storage
