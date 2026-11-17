"""Überwachung (1.48.0): Regeln für Messwerte und Ja/Nein-Sensoren, unabhängig vom Alarm."""

from __future__ import annotations

import asyncio
from datetime import timedelta

import pytest
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant, ServiceCall
from pytest_homeassistant_custom_component.common import async_fire_time_changed, async_mock_service

from custom_components.alarmageddon import monitor as monitor_module
from custom_components.alarmageddon.const import DATA_MONITOR, DATA_SETTINGS, MONITOR_STORE_KEY
from custom_components.alarmageddon.monitor import value_met

from .conftest import setup_alarm
from .test_alarm import call, state

TEMP = "sensor.kuehlschrank_temperatur"
HUM = "sensor.keller_luftfeuchtigkeit"
DOOR = "binary_sensor.kuehlschrank_tuer"
SWITCH = "switch.steckdose"
PUSH = {"type": "notify"}
_id = iter(range(1, 1000))


def _value(entity: str = TEMP, op: str = "above", limit: float = 8, upper: float | None = None) -> dict:
    leaf = {"kind": "value", "entity_id": entity, "op": op, "limit": limit}
    if upper is not None:
        leaf["upper"] = upper
    return leaf


def _is(entity: str, value: str) -> dict:
    return {"kind": "state", "entity_id": entity, "state": value}


def _rule(*items: dict, op: str = "and", name: str = "Kühlschrank", rid: str = "m1", hold: int = 1800, margin: float = 0, remind: int = 0,
          out: list | None = None, ok: list | None = None, enabled: bool = True) -> dict:
    return {"id": rid, "name": name, "enabled": enabled, "tree": {"op": op, "items": list(items)}, "hold": hold, "margin": margin, "remind": remind,
            "steps_out": [PUSH] if out is None else out, "steps_ok": [PUSH] if ok is None else ok}


async def settle(hass: HomeAssistant) -> None:
    """Abläufe der Überwachung laufen als Hintergrundaufgaben: abwarten, ohne auf hängende Aufrufe zu warten."""
    await hass.async_block_till_done()
    for _ in range(40):
        await asyncio.sleep(0)


async def tick(hass: HomeAssistant, freezer, seconds: float) -> None:
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await settle(hass)


async def set_temp(hass: HomeAssistant, value: str) -> None:
    hass.states.async_set(TEMP, value, {"friendly_name": "Kühlschrank Temperatur", "unit_of_measurement": "°C", "device_class": "temperature"})
    await settle(hass)


async def _setup(hass: HomeAssistant, monitors: list[dict], *, enabled: bool = True, start: str = "5", **options):
    pushes = async_mock_service(hass, "notify", "tablet")
    await set_temp(hass, start)
    entry = await setup_alarm(hass, monitors=monitors, monitor_enabled=enabled, **options)
    settings = hass.data[DATA_SETTINGS]
    await settings.async_set_notify({**settings.notify, "maintenance_targets": ["notify.tablet"]})
    await settle(hass)
    return entry, pushes


# ----- Auswertung -----


@pytest.mark.parametrize(("leaf", "value", "active", "margin", "expected"), [
    (_value(op="above", limit=8), 8.5, False, 0, True),
    (_value(op="above", limit=8), 8.0, False, 0, False),
    (_value(op="above", limit=8), 7.5, True, 1, True),  # ausgelöst: gilt weiter, bis 1 Grad unter der Grenze
    (_value(op="above", limit=8), 6.9, True, 1, False),
    (_value(op="above", limit=8), 7.5, False, 1, False),  # noch nicht ausgelöst: die Spanne gilt nicht
    (_value(op="below", limit=2), 1.5, False, 0, True),
    (_value(op="below", limit=2), 2.5, True, 1, True),
    (_value(op="below", limit=2), 3.1, True, 1, False),
    (_value(op="outside", limit=2, upper=8), 9, False, 0, True),
    (_value(op="outside", limit=2, upper=8), 1, False, 0, True),
    (_value(op="outside", limit=2, upper=8), 5, False, 0, False),
    (_value(op="outside", limit=2, upper=8), 7.5, True, 1, True),
    (_value(op="outside", limit=2, upper=8), 2.5, True, 1, True),
    (_value(op="outside", limit=2, upper=8), 5, True, 1, False),
])
def test_value_met(leaf, value, active, margin, expected) -> None:
    assert value_met(leaf, value, active, margin) is expected


# ----- Auslösen, Dauer, Rückkehr -----


async def test_fires_after_hold_and_recovers(hass: HomeAssistant, freezer) -> None:
    """Über 8 Grad seit 30 Minuten: eine Meldung. Danach wieder in Ordnung: eine zweite. Dazwischen nichts."""
    _entry, pushes = await _setup(hass, [_rule(_value())])
    await set_temp(hass, "9.5")
    await tick(hass, freezer, 1700)
    assert pushes == []
    await tick(hass, freezer, 120)
    assert len(pushes) == 1
    assert pushes[0].data["title"] == "⚠️ Kühlschrank"
    assert pushes[0].data["message"].startswith("Kühlschrank Temperatur: 9.5 °C (limit 8 °C) since ")
    await set_temp(hass, "9.9")
    await tick(hass, freezer, 3600)
    assert len(pushes) == 1  # keine Wiederholung ohne Erinnerung
    await set_temp(hass, "6")
    assert len(pushes) == 2
    assert pushes[1].data["title"] == "✅ Kühlschrank"
    assert "Back to normal" in pushes[1].data["message"]
    # Dieselbe Kennung: auf dem Handy ersetzt die zweite die erste
    assert pushes[0].data["data"]["tag"] == pushes[1].data["data"]["tag"]


async def test_dip_back_before_hold_never_fires(hass: HomeAssistant, freezer) -> None:
    _entry, pushes = await _setup(hass, [_rule(_value())])
    await set_temp(hass, "9")
    await tick(hass, freezer, 1000)
    await set_temp(hass, "7")
    await tick(hass, freezer, 2000)
    assert pushes == []
    await set_temp(hass, "9")
    await tick(hass, freezer, 1000)  # die Zeit beginnt von vorn
    assert pushes == []
    await tick(hass, freezer, 900)
    assert len(pushes) == 1


async def test_without_hold_fires_at_once(hass: HomeAssistant) -> None:
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0)])
    await set_temp(hass, "9")
    assert len(pushes) == 1


async def test_return_margin_prevents_flapping(hass: HomeAssistant) -> None:
    """Flattert der Wert um die Grenze, kommt weder eine zweite Meldung noch "in Ordnung": erst 1 Grad darunter gilt es als erledigt."""
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, margin=1)])
    for value in ("9", "7.8", "8.2", "7.5", "8.1"):
        await set_temp(hass, value)
    assert len(pushes) == 1
    await set_temp(hass, "6.9")
    assert len(pushes) == 2 and pushes[1].data["title"].startswith("✅")


async def test_door_open_for_five_minutes(hass: HomeAssistant, freezer) -> None:
    hass.states.async_set(DOOR, "off", {"friendly_name": "Kühlschranktür"})
    _entry, pushes = await _setup(hass, [_rule(_is(DOOR, "on"), name="Tür offen", hold=300)])
    hass.states.async_set(DOOR, "on", {"friendly_name": "Kühlschranktür"})
    await settle(hass)
    await tick(hass, freezer, 200)
    assert pushes == []
    await tick(hass, freezer, 120)
    assert len(pushes) == 1 and pushes[0].data["message"].startswith("Kühlschranktür: on since ")
    assert "limit" not in pushes[0].data["message"]  # Ja/Nein-Sensor: keine Grenze
    hass.states.async_set(DOOR, "off", {"friendly_name": "Kühlschranktür"})
    await settle(hass)
    assert len(pushes) == 2


async def test_condition_already_true_at_start_is_noticed(hass: HomeAssistant, freezer) -> None:
    """Nach einem Neustart zählt auch eine Bedingung, die schon gilt (der Kühlschrank ist ja warm geblieben)."""
    _entry, pushes = await _setup(hass, [_rule(_value())], start="11")
    await tick(hass, freezer, 1900)
    assert len(pushes) == 1


# ----- Nicht erreichbar -----


async def test_unreachable_sensor_never_counts(hass: HomeAssistant, freezer) -> None:
    """Ein Funkabriss löst nichts aus (kein Wert) und meldet nie "wieder in Ordnung"; erst ein echter Wert entscheidet."""
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=600)])
    await set_temp(hass, "unavailable")
    await tick(hass, freezer, 2000)
    assert pushes == []
    await set_temp(hass, "9")
    await tick(hass, freezer, 500)
    await set_temp(hass, "unknown")  # mitten in der Dauer: kein Beleg, die Zeit beginnt neu
    await tick(hass, freezer, 500)
    await set_temp(hass, "9")
    await tick(hass, freezer, 500)
    assert pushes == []
    await tick(hass, freezer, 200)
    assert len(pushes) == 1
    await set_temp(hass, "unavailable")
    await tick(hass, freezer, 7200)
    assert len(pushes) == 1  # Abriss ist kein "in Ordnung"
    await set_temp(hass, "abc")  # keine Zahl
    assert len(pushes) == 1
    await set_temp(hass, "5")
    assert len(pushes) == 2


async def test_unreachable_sensor_restarts_the_hold(hass: HomeAssistant, freezer) -> None:
    """Fällt der Sensor mitten in der Dauer aus, gilt die bisherige Zeit nicht: nach der Rückkehr beginnt sie von vorn."""
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=600)])
    await set_temp(hass, "9")
    await tick(hass, freezer, 300)
    await set_temp(hass, "unavailable")
    await tick(hass, freezer, 100)
    await set_temp(hass, "9")
    await tick(hass, freezer, 250)  # 650 Sekunden nach dem ersten Mal, aber nur 250 seit der Rückkehr
    assert pushes == []
    await tick(hass, freezer, 400)
    assert len(pushes) == 1


async def test_or_group_with_unreachable_sensor_still_fires_on_the_other(hass: HomeAssistant) -> None:
    hass.states.async_set(HUM, "unavailable")
    _entry, pushes = await _setup(hass, [_rule(_value(), _value(HUM, limit=70), op="or", hold=0)])
    await set_temp(hass, "9")
    assert len(pushes) == 1


# ----- Anlage, Modus, Bedingungen -----


async def test_runs_with_disarmed_system_and_never_triggers_alarm(hass: HomeAssistant) -> None:
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0)])
    assert state(hass) == AlarmControlPanelState.DISARMED
    await set_temp(hass, "12")
    assert len(pushes) == 1
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_off_by_default_and_when_switched_off(hass: HomeAssistant) -> None:
    """Standard ist aus: nichts läuft, auch wenn Regeln gespeichert sind; die Regeln bleiben erhalten."""
    entry, pushes = await _setup(hass, [_rule(_value(), hold=0)], enabled=False)
    await set_temp(hass, "12")
    assert pushes == []
    assert entry.options["monitors"][0]["name"] == "Kühlschrank"
    assert entry.runtime_data.controller.monitor_enabled is False


async def test_default_of_option_is_off(hass: HomeAssistant) -> None:
    entry = await setup_alarm(hass)
    assert "monitor_enabled" not in entry.options or entry.options["monitor_enabled"] is False
    assert entry.runtime_data.controller.monitor_enabled is False


async def test_disabled_rule_does_not_run(hass: HomeAssistant) -> None:
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, enabled=False)])
    await set_temp(hass, "12")
    assert pushes == []


async def test_condition_with_armed_mode(hass: HomeAssistant) -> None:
    """"Nur wenn die Anlage abwesend scharf ist": im Modus Zuhause gilt die Regel nicht, beim Scharfschalten abwesend sofort."""
    _entry, pushes = await _setup(hass, [_rule(_value(), {"kind": "armed", "modes": ["away"]}, hold=0)], exit_delay_away=0)
    await set_temp(hass, "12")
    assert pushes == []
    await call(hass, "alarm_arm_away")
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    assert len(pushes) == 1
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert len(pushes) == 2  # Bedingung gilt nicht mehr: "wieder in Ordnung"


# ----- Schritte -----


async def test_custom_text_placeholders(hass: HomeAssistant) -> None:
    step = {"type": "notify", "title": "{rule} / {name}", "message": "{sensor}: {value} {unit}, Grenze {limit}, seit {since}. {unknown}"}
    _entry, pushes = await _setup(hass, [_rule(_value(op="outside", limit=2, upper=8), hold=0, out=[step])])
    await set_temp(hass, "9.25")
    assert pushes[0].data["title"] == "Kühlschrank / Haus"
    message = pushes[0].data["message"]
    assert message.startswith("Kühlschrank Temperatur: 9.25 °C, Grenze 2–8, seit ")
    assert message.endswith("{unknown}")


async def test_own_recipients_and_urgency(hass: HomeAssistant) -> None:
    other = async_mock_service(hass, "notify", "anna")
    step = {"type": "notify", "critical": True, "volume": 0.5, "targets": ["notify.anna"]}
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, out=[step])])
    await set_temp(hass, "12")
    assert pushes == [] and len(other) == 1
    data = other[0].data["data"]
    assert data["push"]["interruption-level"] == "critical" and data["push"]["sound"]["volume"] == 0.5
    assert data["group"] == "alarmageddon_monitor"


async def test_device_step_and_wait(hass: HomeAssistant, freezer) -> None:
    switch = async_mock_service(hass, "switch", "turn_on")
    out = [{"type": "action", "action": "switch.turn_on", "target": [SWITCH]}, {"type": "wait", "seconds": 60}, PUSH]
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, out=out)])
    await set_temp(hass, "12")
    assert len(switch) == 1 and switch[0].data["entity_id"] == [SWITCH]
    assert pushes == []
    await tick(hass, freezer, 61)
    assert len(pushes) == 1


async def test_recovery_cancels_the_rest_of_the_out_flow(hass: HomeAssistant, freezer) -> None:
    """Ist der Wert zurück, bevor das Warten im ersten Ablauf um ist, kommt dessen Meldung nicht mehr: nur "wieder in Ordnung"."""
    out = [{"type": "wait", "seconds": 600}, {"type": "notify", "message": "zu warm"}]
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, out=out)])
    await set_temp(hass, "12")
    await tick(hass, freezer, 100)
    await set_temp(hass, "5")
    await tick(hass, freezer, 1000)
    assert [p.data["title"] for p in pushes] == ["✅ Kühlschrank"]


async def test_failing_step_does_not_stop_the_others(hass: HomeAssistant) -> None:
    async def broken(_call: ServiceCall) -> None:
        raise RuntimeError("kaputt")

    hass.services.async_register("broken", "now", broken)
    out = [{"type": "action", "action": "broken.now", "target": []}, PUSH]
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, out=out)])
    await set_temp(hass, "12")
    assert len(pushes) == 1


async def test_hanging_device_does_not_hold_back_the_next_step(hass: HomeAssistant, monkeypatch) -> None:
    """Sicherheitsregel (tests/test_action_hang.py): ein Gerät, das nicht antwortet, hält nach SERVICE_TIMEOUT nichts mehr auf."""
    monkeypatch.setattr(monitor_module, "SERVICE_TIMEOUT", 0.2)

    async def hang(_call: ServiceCall) -> None:
        await asyncio.Event().wait()

    hass.services.async_register("hang", "now", hang)
    out = [{"type": "action", "action": "hang.now", "target": ["switch.haengt"]}, PUSH]
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, out=out)])
    await set_temp(hass, "12")
    assert pushes == []
    await asyncio.sleep(0.4)
    await settle(hass)
    assert len(pushes) == 1


async def test_hanging_device_in_one_rule_does_not_hold_back_another(hass: HomeAssistant, monkeypatch) -> None:
    monkeypatch.setattr(monitor_module, "SERVICE_TIMEOUT", 5)

    async def hang(_call: ServiceCall) -> None:
        await asyncio.Event().wait()

    hass.services.async_register("hang", "now", hang)
    hang_rule = _rule(_value(), hold=0, out=[{"type": "action", "action": "hang.now", "target": []}], name="Hängt", rid="a")
    _entry, pushes = await _setup(hass, [hang_rule, _rule(_value(), hold=0, name="Zweite", rid="b")])
    await set_temp(hass, "12")
    assert [p.data["title"] for p in pushes] == ["⚠️ Zweite"]


# ----- Erinnerung -----


async def test_reminder_repeats_only_push_steps(hass: HomeAssistant, freezer) -> None:
    switch = async_mock_service(hass, "switch", "turn_on")
    out = [{"type": "action", "action": "switch.turn_on", "target": [SWITCH]}, PUSH]
    _entry, pushes = await _setup(hass, [_rule(_value(), hold=0, remind=2, out=out)])
    await set_temp(hass, "12")
    assert len(pushes) == 1
    await tick(hass, freezer, 2 * 3600 + 5)
    assert len(pushes) == 2 and pushes[1].data["message"].startswith("Still the case: ")
    await tick(hass, freezer, 2 * 3600)
    assert len(pushes) == 3
    assert len(switch) == 1  # das Gerät wird nicht erneut geschaltet
    await set_temp(hass, "5")
    await tick(hass, freezer, 10 * 3600)
    assert len(pushes) == 4  # nur noch "wieder in Ordnung", keine Erinnerung mehr


# ----- Neustart und Neuladen -----


async def test_reload_does_not_report_a_running_rule_again(hass: HomeAssistant) -> None:
    entry, pushes = await _setup(hass, [_rule(_value(), hold=0)])
    await set_temp(hass, "12")
    assert len(pushes) == 1
    await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    assert len(pushes) == 1
    await set_temp(hass, "5")
    assert len(pushes) == 2  # und die Rückkehr kommt trotzdem


async def test_restart_keeps_state_in_the_store(hass: HomeAssistant, hass_storage, freezer) -> None:
    entry, pushes = await _setup(hass, [_rule(_value(), hold=0)])
    await set_temp(hass, "12")
    await tick(hass, freezer, 5)  # die Ablage schreibt verzögert
    saved = hass_storage[f"{MONITOR_STORE_KEY}.{entry.entry_id}"]["data"]
    assert set(saved) == {"m1"} and saved["m1"]["entity"] == TEMP
    # Neustart von Home Assistant: der Arbeitsspeicher ist leer, die Ablage bleibt
    hass.data[DATA_MONITOR].pop(entry.entry_id)
    await hass.config_entries.async_reload(entry.entry_id)
    await settle(hass)
    assert len(pushes) == 1
    # Zwischenzeitlich wieder in Ordnung (während HA aus war): "wieder in Ordnung" kommt nach dem Start. HA ist dabei wirklich aus: die
    # Anlage ist entladen, niemand hört dem Sensor zu (mit laufender Anlage käme die Meldung sofort, und die Ablage wäre noch die alte)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await settle(hass)
    hass.data[DATA_MONITOR].pop(entry.entry_id, None)
    hass.states.async_set(TEMP, "5", {"friendly_name": "Kühlschrank Temperatur", "unit_of_measurement": "°C"})
    assert len(pushes) == 1
    assert await hass.config_entries.async_setup(entry.entry_id)
    await settle(hass)
    assert len(pushes) == 2 and pushes[1].data["title"].startswith("✅")


async def test_deleted_rule_is_forgotten(hass: HomeAssistant) -> None:
    entry, pushes = await _setup(hass, [_rule(_value(), hold=0)])
    await set_temp(hass, "12")
    hass.config_entries.async_update_entry(entry, options={**entry.options, "monitors": []})
    await hass.async_block_till_done()
    await settle(hass)
    assert hass.data[DATA_MONITOR][entry.entry_id] == {}
    await set_temp(hass, "5")
    assert len(pushes) == 1


# ----- Befehle -----


async def _ws(client, **msg):
    await client.send_json({"id": next(_id), **msg})
    return await client.receive_json()


def _save(entry, monitors):
    return {"type": "alarmageddon/save_monitors", "entry_id": entry.entry_id, "monitors": monitors}


async def test_save_monitors_roundtrip_and_data(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    hass.states.async_set(TEMP, "5", {"unit_of_measurement": "°C"})
    client = await hass_ws_client(hass)
    reply = await _ws(client, **_save(entry, [_rule(_value())]))
    assert reply["success"] and reply["result"]["ok"]
    await hass.async_block_till_done()
    system = (await _ws(client, type="alarmageddon/data"))["result"]["systems"][0]
    assert system["monitors"][0]["name"] == "Kühlschrank" and system["monitor_enabled"] is False
    # Standardwerte kommen vom Server (das Panel vergleicht damit)
    assert system["monitors"][0]["steps_ok"] == [{"type": "notify", "critical": False, "targets": []}]
    reply = await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, monitor_enabled=True)
    assert reply["success"]
    await hass.async_block_till_done()
    assert entry.runtime_data.controller.monitor_enabled is True


BAD_RULES = {
    "outside without upper": _rule(_value(op="outside", limit=2)),
    "outside upper below lower": _rule(_value(op="outside", limit=8, upper=2)),
    "upper with above": _rule(_value(upper=9)),
    "binary sensor as measured value": _rule(_value(DOOR)),
    "unsupported device state": _rule(_is("light.lampe", "kaputt")),
    "no device condition": _rule({"kind": "time", "from": "08:00", "to": "20:00"}),
    "same time twice": _rule(_value(), {"kind": "time", "from": "08:00", "to": "08:00"}),
    "own entity": _rule(_value("sensor.alarmageddon_haus")),
    "siren step is not allowed": _rule(_value(), out=[{"type": "sound", "players": ["media_player.a"], "sound": "alarm_siren"}]),
    "acknowledge step is not allowed": _rule(_value(), out=[{"type": "acknowledge"}]),
    "too many steps": _rule(_value(), out=[PUSH] * 11),
    "name too long": _rule(_value(), name="x" * 46),
    "negative hold": _rule(_value(), hold=-1),
    "not a number": _rule({"kind": "value", "entity_id": TEMP, "op": "above", "limit": "nan"}),
    "colour not offered": {**_rule(_value()), "color": "#123456"},
    "reminder too long": _rule(_value(), remind=100),
    "notify target not a service": _rule(_value(), out=[{"type": "notify", "targets": ["light.lampe"]}]),
}


@pytest.mark.parametrize("name", sorted(BAD_RULES))
async def test_save_monitors_rejects_invalid(hass: HomeAssistant, hass_ws_client, name: str) -> None:
    from homeassistant.helpers import entity_registry as er

    entry = await setup_alarm(hass)
    hass.states.async_set(TEMP, "5")
    # Eine Entität von Alarmageddon selbst, die als Sensor erscheint
    er.async_get(hass).async_get_or_create("sensor", "alarmageddon", "eigene", suggested_object_id="alarmageddon_haus")
    hass.states.async_set("sensor.alarmageddon_haus", "5")
    client = await hass_ws_client(hass)
    reply = await _ws(client, **_save(entry, [BAD_RULES[name]]))
    assert reply["success"] is False, reply
    assert "monitors" not in entry.options


async def test_rule_colour_is_saved_and_part_of_the_backup(hass: HomeAssistant, hass_ws_client) -> None:
    from custom_components.alarmageddon import backup
    from custom_components.alarmageddon.const import MONITOR_COLORS

    assert len(MONITOR_COLORS) == 10
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    reply = await _ws(client, **_save(entry, [{**_rule(_value()), "color": MONITOR_COLORS[3]}, _rule(_value(), name="Ohne", rid="m2")]))
    assert reply["success"]
    await hass.async_block_till_done()
    assert entry.options["monitors"][0]["color"] == MONITOR_COLORS[3] and "color" not in entry.options["monitors"][1]
    data = await backup.async_export(hass, "1.50.0")
    assert backup.validate(data, hass)["systems"][0]["options"]["monitors"][0]["color"] == MONITOR_COLORS[3]


async def test_save_monitors_rejects_duplicates_and_too_many(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, **_save(entry, [_rule(_value()), _rule(_value(), rid="m2")])))["success"] is False  # gleicher Name
    assert (await _ws(client, **_save(entry, [_rule(_value()), _rule(_value(), name="Anders")])))["success"] is False  # gleiche Kennung
    many = [_rule(_value(), name=f"R{i}", rid=f"m{i}") for i in range(21)]
    assert (await _ws(client, **_save(entry, many)))["success"] is False


async def test_monitor_entities_lists_values_and_devices(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    hass.states.async_set(TEMP, "5", {"unit_of_measurement": "°C", "device_class": "temperature", "friendly_name": "Kühlschrank"})
    hass.states.async_set("sensor.text", "hallo")  # Text: kein Messwert
    hass.states.async_set(DOOR, "off", {"device_class": "door"})
    client = await hass_ws_client(hass)
    rows = {e["entity_id"]: e for e in (await _ws(client, type="alarmageddon/monitor_entities"))["result"]["entities"]}
    assert rows[TEMP]["kind"] == "value" and rows[TEMP]["unit"] == "°C" and rows[TEMP]["device_class"] == "temperature"
    assert rows[DOOR]["kind"] == "state" and rows[DOOR]["states"] == ["on", "off"]
    assert "sensor.text" not in rows


# ----- Messwert-Sensoren in der Liste -----


async def test_monitor_sensors_are_listed_but_never_seen_by_the_alarm(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await setup_alarm(hass)
    hass.states.async_set(TEMP, "5", {"unit_of_measurement": "°C", "device_class": "temperature"})
    client = await hass_ws_client(hass)
    zones = {"type": "alarmageddon/save_zones", "entry_id": entry.entry_id, "zones": {"home": [], "away": [], "night": []}, "entry_sensors": []}
    reply = await _ws(client, **zones, monitor_sensors=[TEMP])
    assert reply["success"]
    await hass.async_block_till_done()
    data = (await _ws(client, type="alarmageddon/data"))["result"]
    assert data["systems"][0]["monitor_sensors"] == [TEMP]
    assert data["sensors"][TEMP]["kind"] == "value" and data["sensors"][TEMP]["unit"] == "°C"
    ctl = entry.runtime_data.controller
    assert TEMP not in ctl.all_sensors() and TEMP not in ctl.always_sensors()
    # Nur mit eingeschalteter Überwachung zählt der Sensor für die Wartung
    assert ctl.monitor_sensors() == set()
    await _ws(client, type="alarmageddon/save_system", entry_id=entry.entry_id, monitor_enabled=True)
    await hass.async_block_till_done()
    assert entry.runtime_data.controller.monitor_sensors() == {TEMP}


@pytest.mark.parametrize("bad", [DOOR, "light.lampe", "switch.x"])
async def test_monitor_sensors_reject_other_domains(hass: HomeAssistant, hass_ws_client, bad: str) -> None:
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    zones = {"type": "alarmageddon/save_zones", "entry_id": entry.entry_id, "zones": {"home": [], "away": [], "night": []}, "entry_sensors": []}
    assert (await _ws(client, **zones, monitor_sensors=[bad]))["success"] is False


async def test_binary_only_lists_stay_binary(hass: HomeAssistant, hass_ws_client) -> None:
    """Die Zonen und die Liste "sensors" nehmen weiterhin nur binary_sensor: ein Messwert gehört nie in den Alarm."""
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    base = {"type": "alarmageddon/save_zones", "entry_id": entry.entry_id, "entry_sensors": []}
    assert (await _ws(client, **base, zones={"home": [TEMP], "away": [], "night": []}))["success"] is False
    assert (await _ws(client, **base, zones={"home": [], "away": [], "night": []}, sensors=[TEMP]))["success"] is False


# ----- Sicherung -----


async def test_backup_carries_monitors_and_validates_them(hass: HomeAssistant, hass_ws_client) -> None:
    from custom_components.alarmageddon import backup

    entry, _pushes = await _setup(hass, [_rule(_value(), remind=3)], monitor_sensors=[TEMP])
    data = await backup.async_export(hass, "1.48.0")
    options = data["systems"][0]["options"]
    assert options["monitors"][0]["remind"] == 3 and options["monitor_enabled"] is True and options["monitor_sensors"] == [TEMP]
    assert backup.validate(data, hass)["systems"][0]["options"]["monitors"][0]["name"] == "Kühlschrank"
    broken = {**data, "systems": [{"title": "Haus", "options": {**options, "monitors": [BAD_RULES["siren step is not allowed"]]}}]}
    with pytest.raises(Exception):  # noqa: B017 - vol.Invalid
        backup.validate(broken, hass)
    # Der Aufbau stimmt, nur Home Assistant kann sagen, dass ein Ja/Nein-Sensor kein Messwert ist: auch das prüft die Sicherung
    broken = {**data, "systems": [{"title": "Haus", "options": {**options, "monitors": [BAD_RULES["binary sensor as measured value"]]}}]}
    with pytest.raises(Exception):  # noqa: B017
        backup.validate(broken, hass)
    broken = {**data, "systems": [{"title": "Haus", "options": {**options, "monitor_sensors": [DOOR]}}]}
    with pytest.raises(Exception):  # noqa: B017
        backup.validate(broken, hass)


# ----- Test eines Schritts (1.57.0: Knopf "Test" an jedem Schritt einer Regel) -----


async def _test_step(hass: HomeAssistant, hass_ws_client, entry, step: dict, kind: str = "out", **extra) -> dict:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/test_monitor_step", "entry_id": entry.entry_id, "kind": kind, "step": step, **extra})
    return await client.receive_json()


async def test_step_test_sends_marked_push_with_live_values(hass: HomeAssistant, hass_ws_client) -> None:
    entry, pushes = await _setup(hass, [_rule(_value(), hold=0, out=[])], start="12")
    reply = await _test_step(hass, hass_ws_client, entry, {"type": "notify", "message": "{sensor}: {value} {unit}"}, rule_id="m1")
    assert reply["success"] is True
    assert len(pushes) == 1
    assert pushes[0].data["title"].startswith("🧪 Test: ")
    assert pushes[0].data["message"] == "Kühlschrank Temperatur: 12 °C"


async def test_step_test_of_unsaved_rule_uses_its_name(hass: HomeAssistant, hass_ws_client) -> None:
    entry, pushes = await _setup(hass, [])
    reply = await _test_step(hass, hass_ws_client, entry, {"type": "notify", "message": "{rule}"}, kind="ok", rule_name="Neue Regel")
    assert reply["success"] is True and pushes[0].data["message"] == "Neue Regel"


async def test_step_test_switches_the_device(hass: HomeAssistant, hass_ws_client) -> None:
    switch = async_mock_service(hass, "switch", "turn_on")
    entry, _pushes = await _setup(hass, [])
    reply = await _test_step(hass, hass_ws_client, entry, {"type": "action", "action": "switch.turn_on", "target": [SWITCH]})
    assert reply["success"] is True and len(switch) == 1 and switch[0].data["entity_id"] == [SWITCH]


async def test_step_test_never_triggers_the_alarm(hass: HomeAssistant, hass_ws_client) -> None:
    entry, _pushes = await _setup(hass, [])
    await _test_step(hass, hass_ws_client, entry, {"type": "notify"})
    assert state(hass) == AlarmControlPanelState.DISARMED


async def test_step_test_of_wait_has_nothing_to_test(hass: HomeAssistant, hass_ws_client) -> None:
    entry, pushes = await _setup(hass, [])
    reply = await _test_step(hass, hass_ws_client, entry, {"type": "wait", "seconds": 60})
    assert reply["success"] is False and reply["error"]["code"] == "nothing_to_test" and pushes == []


async def test_step_test_reports_a_failing_device(hass: HomeAssistant, hass_ws_client) -> None:
    async def broken(_call: ServiceCall) -> None:
        raise RuntimeError("kaputt")

    hass.services.async_register("broken", "now", broken)
    entry, _pushes = await _setup(hass, [])
    reply = await _test_step(hass, hass_ws_client, entry, {"type": "action", "action": "broken.now", "target": []})
    assert reply["success"] is False and reply["error"]["code"] == "failed" and "kaputt" in reply["error"]["message"]


async def test_step_test_of_a_hanging_device_answers_after_the_timeout(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    """Sicherheitsregel (tests/test_action_hang.py): ein Gerät, das nicht antwortet, hält den Test nur SERVICE_TIMEOUT lang auf."""
    monkeypatch.setattr(monitor_module, "SERVICE_TIMEOUT", 0.2)

    async def hang(_call: ServiceCall) -> None:
        await asyncio.Event().wait()

    hass.services.async_register("hang", "now", hang)
    entry, _pushes = await _setup(hass, [])
    reply = await asyncio.wait_for(_test_step(hass, hass_ws_client, entry, {"type": "action", "action": "hang.now", "target": ["switch.haengt"]}), 5)
    assert reply["success"] is False and reply["error"]["code"] == "failed"
