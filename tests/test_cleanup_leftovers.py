"""
1.82.0 (Wunsch des Nutzers 2026-11-22): wiederkehrendes Aufräumen (CLEANUP_DELAY nach dem Start, danach täglich), auch wenn eine Anlage ausserhalb der Integration gelöscht wurde. Ablagen je Anlage, deren Anlage es nicht mehr gibt, und gemerkte
letzte Änderungen von Sensoren, die keine Anlage mehr nennt. Vorsichtig: jede Anlage zählt, auch eine deaktivierte; Backups, Einstellungen und eigene Töne bleiben.
"""

from __future__ import annotations

import pytest
from homeassistant.config_entries import ConfigEntryDisabler
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

import custom_components.alarmageddon as integration
from custom_components.alarmageddon.const import (
    BACKUPS_STORE_KEY,
    CUSTOM_SOUNDS_STORE_KEY,
    DOMAIN,
    EVENTS_STORE_KEY,
    HEALTHLOG_STORE_KEY,
    MONITOR_STORE_KEY,
    RECORDINGS_STORE_KEY,
    SETTINGS_STORE_KEY,
    STATE_STORE_KEY,
    WORKFLOW_STORE_KEY,
)
from custom_components.alarmageddon.settings import async_get_settings

from .conftest import FRONT_DOOR, WINDOW, options, setup_alarm

GONE = "01ORPHANORPHANORPHANORPH01"
KINDS = (EVENTS_STORE_KEY, RECORDINGS_STORE_KEY, WORKFLOW_STORE_KEY, MONITOR_STORE_KEY, STATE_STORE_KEY)


def _store(hass_storage, key: str, data=None) -> None:
    hass_storage[key] = {"version": 1, "key": key, "data": data if data is not None else {}}


@pytest.fixture(autouse=True)
def _listing(hass_storage, monkeypatch):
    """Im Test gibt es keine echten Dateien: die Auflistung der Ablage kommt aus der nachgebauten Ablage."""
    monkeypatch.setattr(integration, "_storage_names", lambda _path: list(hass_storage))


def _seed(hass_storage) -> None:
    for kind in KINDS:
        _store(hass_storage, f"{kind}.{GONE}")
    for key in (BACKUPS_STORE_KEY, CUSTOM_SOUNDS_STORE_KEY, HEALTHLOG_STORE_KEY):
        _store(hass_storage, key)
    _store(hass_storage, SETTINGS_STORE_KEY, {"last_changes": {WINDOW: "2026-01-01T00:00:00+00:00", FRONT_DOOR: "2026-01-01T00:00:00+00:00", "binary_sensor.alt": "2026-01-01T00:00:00+00:00"}, "wizard": {}})


async def _after(hass: HomeAssistant, seconds: float) -> None:
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=seconds))
    await hass.async_block_till_done(wait_background_tasks=True)


async def test_orphan_stores_and_stale_sensor_changes_go_after_the_delay_and_the_rest_stays(hass: HomeAssistant, hass_storage) -> None:
    await setup_alarm(hass)
    _seed(hass_storage)
    settings = await async_get_settings(hass)
    settings.last_changes.update({WINDOW: "2026-01-01T00:00:00+00:00", FRONT_DOOR: "2026-01-01T00:00:00+00:00", "binary_sensor.alt": "2026-01-01T00:00:00+00:00"})
    await _after(hass, integration.CLEANUP_DELAY - 10)
    assert f"{EVENTS_STORE_KEY}.{GONE}" in hass_storage, "vor Ablauf der Wartezeit passiert nichts"
    await _after(hass, integration.CLEANUP_DELAY + 5)
    for kind in KINDS:
        assert f"{kind}.{GONE}" not in hass_storage, kind
    for key in (BACKUPS_STORE_KEY, CUSTOM_SOUNDS_STORE_KEY, HEALTHLOG_STORE_KEY, SETTINGS_STORE_KEY):
        assert key in hass_storage, key
    assert set(settings.last_changes) == {WINDOW, FRONT_DOOR}, "ein Sensor, den keine Anlage mehr nennt, ist weg"


async def test_it_comes_back_daily_for_systems_deleted_later(hass: HomeAssistant, hass_storage) -> None:
    await setup_alarm(hass)
    await _after(hass, integration.CLEANUP_DELAY + 5)
    _store(hass_storage, f"{EVENTS_STORE_KEY}.{GONE}")  # später in Home Assistant gelöscht, Rest bleibt liegen
    await _after(hass, integration.CLEANUP_DELAY + integration.CLEANUP_EVERY.total_seconds() + 10)
    assert f"{EVENTS_STORE_KEY}.{GONE}" not in hass_storage


async def test_every_existing_system_counts_even_a_disabled_one(hass: HomeAssistant, hass_storage) -> None:
    disabled = MockConfigEntry(domain=DOMAIN, title="Garage", data={"name": "Garage"}, options=options(), disabled_by=ConfigEntryDisabler.USER)
    disabled.add_to_hass(hass)
    await setup_alarm(hass)
    for kind in KINDS:
        _store(hass_storage, f"{kind}.{disabled.entry_id}")
    _seed(hass_storage)
    await _after(hass, integration.CLEANUP_DELAY + 5)
    for kind in KINDS:
        assert f"{kind}.{disabled.entry_id}" in hass_storage, "die Ablagen einer deaktivierten Anlage bleiben"
        assert f"{kind}.{GONE}" not in hass_storage


async def test_a_failing_cleanup_never_stops_the_alarm_system_and_runs_again(hass: HomeAssistant, hass_storage, monkeypatch) -> None:
    await setup_alarm(hass)
    _seed(hass_storage)

    def boom(_path):
        raise RuntimeError("kaputt")

    monkeypatch.setattr(integration, "_storage_names", boom)
    await _after(hass, integration.CLEANUP_DELAY + 5)
    assert hass.states.get("alarm_control_panel.haus") is not None, "die Anlage läuft trotzdem"
    assert f"{EVENTS_STORE_KEY}.{GONE}" in hass_storage
    monkeypatch.setattr(integration, "_storage_names", lambda _path: list(hass_storage))
    await _after(hass, integration.CLEANUP_DELAY + integration.CLEANUP_EVERY.total_seconds() + 10)
    assert f"{EVENTS_STORE_KEY}.{GONE}" not in hass_storage


async def test_the_schedule_ends_with_the_last_system(hass: HomeAssistant, hass_storage) -> None:
    entry = await setup_alarm(hass)
    assert f"{DOMAIN}_cleanup" in hass.data
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert f"{DOMAIN}_cleanup" not in hass.data
    _seed(hass_storage)
    await _after(hass, integration.CLEANUP_DELAY + 5)
    assert f"{EVENTS_STORE_KEY}.{GONE}" in hass_storage, "ohne geladene Anlage läuft nichts"
