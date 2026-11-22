"""
1.82.0 (Wunsch des Nutzers 2026-11-22): roter Kreis im Kopf des Panels nach einem Alarm. Der Server merkt je Anlage, welcher aufgezeichnete Alarm noch nicht gesehen ist
(`seen` im Alarm, WS `alarm_seen`, `alarm_unseen` in `data`). Nur echte Alarme, wie das Protokoll sie aufzeichnet; Alarme aus früheren Versionen gelten als gesehen.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant

from custom_components.alarmageddon.const import DOMAIN, RECORDINGS_STORE_KEY

from .conftest import ALARM, WINDOW, setup_alarm
from .test_alarm import call
from .test_sensor_options import open_sensor

_ids = iter(range(1, 1000))


async def _ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": next(_ids), **msg})
    return await client.receive_json()


async def _unseen(client) -> Any:
    return (await _ws(client, type=f"{DOMAIN}/data"))["result"]["systems"][0]["alarm_unseen"]


async def _alarm(hass: HomeAssistant) -> None:
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    assert hass.states.get(ALARM).state == AlarmControlPanelState.TRIGGERED


async def test_no_alarm_means_no_circle(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert entry.runtime_data.recorder.unseen is None
    assert await _unseen(client) is None


async def test_a_new_alarm_is_unseen_for_the_whole_system_until_marked(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await _alarm(hass)
    record = entry.runtime_data.recorder.recordings[0]
    assert record["seen"] is False
    assert await _unseen(client) == {"id": record["id"], "running": True}
    await call(hass, "alarm_disarm")
    await hass.async_block_till_done()
    assert await _unseen(client) == {"id": record["id"], "running": False}, "nach dem Alarm bleibt der Kreis stehen"
    assert (await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording=record["id"]))["success"]
    assert await _unseen(client) is None


async def test_only_the_alarm_and_older_ones_are_marked(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    recorder = entry.runtime_data.recorder
    recorder.recordings[:] = [
        {"id": "2026-03-03T00:00:00+00:00", "start": "2026-03-03T00:00:00+00:00", "end": "2026-03-03T00:05:00+00:00", "entries": [], "seen": False},
        {"id": "2026-02-02T00:00:00+00:00", "start": "2026-02-02T00:00:00+00:00", "end": "2026-02-02T00:05:00+00:00", "entries": [], "seen": False},
        {"id": "2026-01-01T00:00:00+00:00", "start": "2026-01-01T00:00:00+00:00", "end": "2026-01-01T00:05:00+00:00", "entries": [], "seen": False},
    ]
    # Ein älterer Alarm von Hand geöffnet: der neueste bleibt ungesehen
    assert (await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording="2026-02-02T00:00:00+00:00"))["success"]
    assert await _unseen(client) == {"id": "2026-03-03T00:00:00+00:00", "running": False}
    assert [r["seen"] for r in recorder.recordings] == [False, True, True]
    assert (await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording="2026-03-03T00:00:00+00:00"))["success"]
    assert await _unseen(client) is None


async def test_an_unknown_alarm_is_refused(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording="gibt-es-nicht")
    assert result["success"] is False and result["error"]["code"] == "not_found"


async def test_alarms_from_earlier_versions_count_as_seen_and_the_state_survives_a_reload(hass: HomeAssistant, hass_storage, hass_ws_client) -> None:
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from custom_components.alarmageddon.const import DOMAIN as D

    from .conftest import options

    old = {"id": "2026-01-01T00:00:00+00:00", "start": "2026-01-01T00:00:00+00:00", "end": "2026-01-01T00:05:00+00:00", "ended_by": None, "entries": []}
    for entity in ("binary_sensor.haustuer", "binary_sensor.fenster_kueche", "binary_sensor.bewegung_flur"):
        hass.states.async_set(entity, "off")
    entry = MockConfigEntry(domain=D, title="Haus", data={"name": "Haus"}, options=options())
    entry.add_to_hass(hass)
    hass_storage[f"{RECORDINGS_STORE_KEY}.{entry.entry_id}"] = {"version": 1, "key": f"{RECORDINGS_STORE_KEY}.{entry.entry_id}", "data": [old]}
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    assert await _unseen(client) is None, "nach dem Update zeigt kein alter Alarm den Kreis"
    assert entry.runtime_data.recorder.recordings[0]["seen"] is True
    await _alarm(hass)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    unseen = await _unseen(client)
    assert unseen is not None and unseen["id"] != old["id"], "der neue Alarm bleibt über das Neuladen ungesehen"


async def test_marking_an_alarm_unread_brings_the_circle_back_for_that_alarm_only(hass: HomeAssistant, hass_ws_client) -> None:
    """Wunsch des Nutzers (2026-11-22): "ungelesen" lässt den Kreis als Erinnerung wieder erscheinen; es betrifft nur diesen einen Alarm."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    recorder = entry.runtime_data.recorder
    ids = ["2026-03-03T00:00:00+00:00", "2026-02-02T00:00:00+00:00", "2026-01-01T00:00:00+00:00"]
    recorder.recordings[:] = [{"id": i, "start": i, "end": i, "entries": [], "seen": True} for i in ids]
    assert await _unseen(client) is None
    assert (await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording=ids[1], seen=False))["success"]
    assert [r["seen"] for r in recorder.recordings] == [True, False, True], "nur dieser eine Alarm"
    assert await _unseen(client) == {"id": ids[1], "running": False}
    # Ein weiterer ungelesener, neuerer Alarm: der Kreis zeigt den neuesten ungelesenen
    assert (await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording=ids[0], seen=False))["success"]
    assert await _unseen(client) == {"id": ids[0], "running": False}
    # Wieder als gelesen: gilt für ihn und die älteren
    assert (await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording=ids[0]))["success"]
    assert await _unseen(client) is None
    assert (await _ws(client, type=f"{DOMAIN}/alarm_seen", entry_id=entry.entry_id, recording="gibt-es-nicht", seen=False))["success"] is False
