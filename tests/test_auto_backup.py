"""Automatische Sicherung (1.47.0): Schalter (Standard an), Abstand (Standard wöchentlich), höchstens 5 zusätzlich zu den 10 eigenen."""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.alarmageddon import backup
from custom_components.alarmageddon.const import AUTO_BACKUP_DEFAULT, AUTO_BACKUP_KEEP, AUTO_BACKUP_START_DELAY, MAX_BACKUPS
from custom_components.alarmageddon.settings import async_get_settings

from .conftest import setup_alarm

_id = iter(range(1, 1000))


async def _ws(client, **msg):
    await client.send_json({"id": next(_id), **msg})
    return await client.receive_json()


async def _list(hass: HomeAssistant) -> list[dict]:
    return await backup.async_list_backups(hass)


async def _after_start(hass: HomeAssistant, freezer) -> None:
    freezer.tick(timedelta(seconds=AUTO_BACKUP_START_DELAY + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def _change(hass: HomeAssistant, entry, n: int) -> None:
    """Etwas einstellen, damit sich der Inhalt der Sicherung ändert."""
    hass.config_entries.async_update_entry(entry, options={**entry.options, "exit_delay_away": 10 + n})
    await hass.async_block_till_done()


async def test_defaults_are_on_and_weekly(hass: HomeAssistant) -> None:
    settings = await async_get_settings(hass)
    assert settings.auto_backup == {"enabled": True, "every": "weekly"} == AUTO_BACKUP_DEFAULT


async def test_first_automatic_backup_after_start(hass: HomeAssistant, freezer) -> None:
    await setup_alarm(hass)
    assert await _list(hass) == []
    await _after_start(hass, freezer)
    items = await _list(hass)
    assert len(items) == 1 and items[0]["auto"] is True and items[0]["systems"] == ["Haus"]


async def test_switch_off_makes_no_backup(hass: HomeAssistant, freezer) -> None:
    settings = await async_get_settings(hass)
    await settings.async_set_auto_backup(False, "weekly")
    await setup_alarm(hass)
    await _after_start(hass, freezer)
    assert await _list(hass) == []


@pytest.mark.parametrize(("every", "days"), [("daily", 1), ("weekly", 7), ("monthly", 30)])
async def test_interval_is_respected(hass: HomeAssistant, freezer, every: str, days: int) -> None:
    settings = await async_get_settings(hass)
    await settings.async_set_auto_backup(True, every)
    entry = await setup_alarm(hass)
    await _after_start(hass, freezer)
    assert len(await _list(hass)) == 1
    await _change(hass, entry, 1)
    freezer.tick(timedelta(days=days - 1, hours=2))  # noch nicht fällig
    await backup.async_run_auto_backup(hass)
    assert len(await _list(hass)) == 1
    freezer.tick(timedelta(days=1))  # fällig
    await backup.async_run_auto_backup(hass)
    assert len(await _list(hass)) == 2


async def test_identical_backup_is_skipped(hass: HomeAssistant, freezer) -> None:
    """Ohne Änderung entsteht keine zweite gleiche Sicherung: die fünf zeigen verschiedene Stände."""
    await setup_alarm(hass)
    await _after_start(hass, freezer)
    freezer.tick(timedelta(days=8))
    await backup.async_run_auto_backup(hass)
    assert len(await _list(hass)) == 1


async def test_only_five_automatic_and_ten_manual_are_kept(hass: HomeAssistant, freezer) -> None:
    entry = await setup_alarm(hass)
    for n in range(MAX_BACKUPS + 2):
        await _change(hass, entry, 100 + n)
        freezer.tick(timedelta(minutes=1))
        await backup.async_create_backup(hass, "1", f"eigene {n}")
    for n in range(AUTO_BACKUP_KEEP + 3):
        await _change(hass, entry, n)
        freezer.tick(timedelta(minutes=1))
        assert await backup.async_create_backup(hass, "1", "", auto=True) is not None
    items = await _list(hass)
    assert sum(1 for i in items if i["auto"]) == AUTO_BACKUP_KEEP and sum(1 for i in items if not i["auto"]) == MAX_BACKUPS


async def test_automatic_backup_never_raises(hass: HomeAssistant) -> None:
    await setup_alarm(hass)
    with patch("custom_components.alarmageddon.backup.async_export", side_effect=RuntimeError("kaputt")):
        await backup.async_run_auto_backup(hass)  # kein Fehler nach aussen
    assert await _list(hass) == []


async def test_save_auto_backup_command(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    bad = await _ws(client, type="alarmageddon/save_auto_backup", enabled=True, every="hourly")
    assert bad["success"] is False
    ok = await _ws(client, type="alarmageddon/save_auto_backup", enabled=False, every="monthly")
    assert ok["success"] and ok["result"]["auto_backup"] == {"enabled": False, "every": "monthly"}
    data = (await _ws(client, type="alarmageddon/data"))["result"]
    assert data["auto_backup"] == {"enabled": False, "every": "monthly"}
    listing = (await _ws(client, type="alarmageddon/backups"))["result"]
    assert listing["max_auto"] == AUTO_BACKUP_KEEP and listing["max"] == MAX_BACKUPS


async def test_the_setting_itself_is_not_part_of_a_backup(hass: HomeAssistant) -> None:
    await setup_alarm(hass)
    data = await backup.async_export(hass, "1")
    assert "auto_backup" not in data["settings"]
