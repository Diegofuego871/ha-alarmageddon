"""
Selbsttest (1.65.0, Wunsch des Nutzers 2026-11-18): Befunde der Konfiguration und der Laufzeit, Meldung je Befund einmal, Entität je Anlage,
Statusentität, Reparaturen, Intervall, "Jetzt prüfen" und "Erledigt". Der Selbsttest liest nur und hält nie einen Alarm auf.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
import json
from typing import Any

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.alarmageddon import selftest as st
from custom_components.alarmageddon.const import DATA_SELFTEST, DATA_SETTINGS, DOMAIN, SELFTEST_GRACE, SELFTEST_STORE_KEY, SETTINGS_STORE_KEY

from .conftest import ALARM, FRONT_DOOR, WINDOW, options, setup_alarm
from .test_alarm import call

SIREN = "switch.sirene"
LIGHT = "light.flur"
SPEAKER = "media_player.kueche"
STEP_SIREN = {"type": "action", "action": "switch.turn_on", "target": [SIREN]}
STEP_LIGHT = {"type": "action", "action": "light.turn_on", "target": [LIGHT]}


async def settle(hass: HomeAssistant) -> None:
    for _ in range(30):
        await asyncio.sleep(0)


async def ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


def selftest(hass: HomeAssistant) -> st.SelfTest:
    return hass.data[DATA_SELFTEST]


def codes(hass: HomeAssistant) -> set[tuple[str, str]]:
    return {(p["code"], p["subject"]) for p in selftest(hass).problems()}


def find(hass: HomeAssistant, code: str, subject: str | None = None) -> dict[str, Any]:
    return next(p for p in selftest(hass).problems() if p["code"] == code and (subject is None or p["subject"] == subject))


async def notify_settings(hass: HomeAssistant, **changes: Any) -> None:
    settings = hass.data[DATA_SETTINGS]
    types = dict(settings.notify["types"])
    for kind, values in changes.pop("types", {}).items():
        types[kind] = {**types[kind], **values}
    await settings.async_set_notify({**settings.notify, "types": types, **changes})


# ----- Konfiguration -----


async def test_finds_missing_devices_actions_and_recipients_in_the_alarm_actions(hass: HomeAssistant) -> None:
    """Gerät fehlt, Aktion fehlt, Empfänger fehlt, Lautsprecher fehlt: je ein Befund mit der Fundstelle (Liste, Auslöser, Schritt)."""
    async_mock_service(hass, "switch", "turn_on")
    async_mock_service(hass, "notify", "handy")
    hass.states.async_set(LIGHT, "off")
    await setup_alarm(hass, workflows={
        "home": [STEP_SIREN, {"type": "action", "action": "script.gibt_es_nicht"}, {"type": "notify", "targets": ["notify.weg", "notify.handy"]},
                 {"type": "group", "mode": "count", "count": 2, "steps": [STEP_LIGHT, {"type": "sound", "players": [SPEAKER], "sound": "siren", "duration": 5}]}],
    })
    await hass.config.async_update(internal_url="http://192.168.1.2:8123")
    selftest(hass).async_run()
    assert codes(hass) == {
        ("entity_missing", SIREN), ("service_missing", "script.gibt_es_nicht"), ("recipient_missing", "notify.weg"), ("entity_missing", SPEAKER),
        ("service_missing", "light.turn_on"),
    }
    siren = find(hass, "entity_missing", SIREN)
    assert siren["role"] == "output" and siren["reason"] == "deleted" and siren["kind"] == "config"
    assert siren["places"] == [{"area": "workflow", "list": "alarm", "trigger": "home", "step": 1}]
    assert find(hass, "entity_missing", SPEAKER)["places"] == [{"area": "workflow", "list": "alarm", "trigger": "home", "step": 4, "sub": 2}]
    assert find(hass, "entity_missing", SPEAKER)["role"] == "player"
    # Behoben: beim nächsten Lauf verschwinden die Befunde von selbst
    hass.states.async_set(SIREN, "off")
    hass.states.async_set(SPEAKER, "idle")
    async_mock_service(hass, "light", "turn_on")
    selftest(hass).async_run()
    assert codes(hass) == {("service_missing", "script.gibt_es_nicht"), ("recipient_missing", "notify.weg")}


async def test_the_list_of_checked_entries(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    """
    Wunsch des Nutzers 2026-11-19: im Fenster des Selbsttests die Liste aller geprüften Entitäten (mit Namen), dazu Aktionen und Empfänger; grün,
    was in Ordnung ist. Auf Abruf (selftest_checked), nicht in `data`; über einen Neustart (Ablage) erhalten.
    """
    async_mock_service(hass, "switch", "turn_on")
    async_mock_service(hass, "notify", "handy")
    hass.states.async_set(LIGHT, "off", {"friendly_name": "Licht Flur"})
    await setup_alarm(hass, workflows={"home": [STEP_SIREN, STEP_LIGHT, {"type": "action", "action": "script.gibt_es_nicht"},
                                                {"type": "notify", "targets": ["notify.weg", "notify.handy"]}]})
    payload = selftest(hass).async_run()
    client = await hass_ws_client(hass)
    result = (await ws(client, type=f"{DOMAIN}/selftest_checked"))["result"]
    items = {(i["type"], i["id"]): i for i in result["items"]}
    assert result["last"] == selftest(hass).last and payload["checked"] == len(result["items"])
    assert items[("entity", WINDOW)]["role"] == "sensor" and items[("entity", WINDOW)]["ok"] is True
    assert items[("entity", LIGHT)] | {"entries": []} == {"type": "entity", "id": LIGHT, "role": "output", "ok": True, "name": "Licht Flur", "entries": []}
    assert items[("entity", SIREN)]["ok"] is False, "fehlt: nicht grün"
    assert items[("service", "script.gibt_es_nicht")]["ok"] is False and items[("service", "light.turn_on")]["ok"] is False
    assert items[("recipient", "notify.handy")]["ok"] is True and items[("recipient", "notify.weg")]["ok"] is False
    assert all(i["entries"] for i in result["items"] if i["type"] == "entity")
    # Über einen Neustart erhalten (Ablage), jeder Eintrag einzeln geprüft
    await selftest(hass).async_save()
    stored = hass_storage[SELFTEST_STORE_KEY]["data"]["checked"]
    assert {(i["type"], i["id"]) for i in stored} == set(items)
    fresh = st.SelfTest(hass, hass.data[DATA_SETTINGS])
    hass_storage[SELFTEST_STORE_KEY]["data"]["checked"] = [*stored, {"type": "erfunden", "id": "x", "ok": True}, "kaputt", {"type": "entity", "id": "", "ok": True}]
    await fresh.async_load()
    assert len(fresh.checked) == len(stored)


async def test_an_unreachable_device_counts_only_after_the_grace_time(hass: HomeAssistant, freezer) -> None:
    """Entscheid des Nutzers: ein Gerät eines Ablaufs, das nicht erreichbar ist, zählt (nicht erst, wenn es fehlt); ein kurzer Abriss nicht."""
    async_mock_service(hass, "switch", "turn_on")
    hass.states.async_set(SIREN, "unavailable")
    await setup_alarm(hass, workflows={"away": [STEP_SIREN]})
    freezer.tick(timedelta(seconds=SELFTEST_GRACE - 10))
    selftest(hass).async_run()
    assert codes(hass) == set()
    freezer.tick(timedelta(seconds=20))
    selftest(hass).async_run()
    problem = find(hass, "entity_unavailable", SIREN)
    assert problem["role"] == "output" and problem["since"]
    hass.states.async_set(SIREN, "off")
    selftest(hass).async_run()
    assert codes(hass) == set()


async def test_alarm_sensors_count_only_when_missing(hass: HomeAssistant, freezer) -> None:
    """Nicht erreichbare Sensoren meldet die Wartung; der Selbsttest meldet bei ihnen nur, wenn sie ganz fehlen (keine doppelte Meldung)."""
    await setup_alarm(hass)
    hass.states.async_set(WINDOW, "unavailable")
    freezer.tick(timedelta(hours=2))
    selftest(hass).async_run()
    assert codes(hass) == set()
    hass.states.async_remove(FRONT_DOOR)
    selftest(hass).async_run()
    assert find(hass, "entity_missing", FRONT_DOOR)["role"] == "sensor"
    assert find(hass, "entity_missing", FRONT_DOOR)["places"] == [{"area": "sensors"}]


async def test_a_disabled_entity_is_named_as_such(hass: HomeAssistant) -> None:
    async_mock_service(hass, "switch", "turn_on")
    reg = er.async_get(hass)
    reg.async_get_or_create("switch", "test", "sirene", suggested_object_id="sirene", disabled_by=er.RegistryEntryDisabler.USER)
    await setup_alarm(hass, workflows={"away": [STEP_SIREN]})
    selftest(hass).async_run()
    assert find(hass, "entity_missing", SIREN)["reason"] == "disabled"


async def test_flows_that_cannot_run_are_not_checked(hass: HomeAssistant) -> None:
    """Abläufe eines ausgeschalteten Modus (Nacht) und "Immer aktiv" bei ausgeschaltetem "Immer aktiv" laufen nie: kein Befund."""
    async_mock_service(hass, "switch", "turn_on")
    await setup_alarm(hass, night_enabled=False, always_enabled=False, workflows={"night": [STEP_SIREN], "always": [STEP_SIREN]})
    selftest(hass).async_run()
    assert codes(hass) == set()


async def test_every_list_of_actions_is_checked(hass: HomeAssistant) -> None:
    """Alle Listen: nach dem Quittieren, beim Scharfschalten, in den Verzögerungen, beim Deaktivieren, beim stillen Alarm."""
    async_mock_service(hass, "switch", "turn_on")
    lists = {"workflows_after": "after", "workflows_armed": "armed", "workflows_arming": "arming", "workflows_entry": "entry",
             "workflows_disarmed": "disarmed", "workflows_report": "report"}
    await setup_alarm(hass, **{key: {"home": [STEP_SIREN]} for key in lists})
    selftest(hass).async_run()
    assert sorted(p["list"] for p in find(hass, "entity_missing", SIREN)["places"]) == sorted(lists.values())


async def test_push_without_any_recipient_is_found(hass: HomeAssistant) -> None:
    """Eine Push-Meldung ohne eigene Empfänger, wenn auch die Standard-Empfänger leer sind: sie ginge nirgends hin."""
    await setup_alarm(hass, workflows={"home": [{"type": "notify"}]})
    selftest(hass).async_run()
    assert find(hass, "no_recipients")["places"] == [{"area": "workflow", "list": "alarm", "trigger": "home", "step": 1}]
    async_mock_service(hass, "notify", "handy")
    await notify_settings(hass, alarm_targets=["notify.handy"])
    selftest(hass).async_run()
    assert codes(hass) == set()


async def test_missing_recipients_of_the_settings_concern_all_systems(hass: HomeAssistant) -> None:
    """Empfänger der Benachrichtigungen, die es nicht gibt: ein gemeinsamer Befund (keiner Anlage zugeordnet), je Gruppe oder Art."""
    await setup_alarm(hass)
    await notify_settings(hass, maintenance_targets=["notify.altes_handy"], types={"battery_low": {"targets": ["notify.weg"]}, "armed": {"enabled": False, "targets": ["notify.egal"]}})
    selftest(hass).async_run()
    assert codes(hass) == {("recipient_missing", "notify.altes_handy"), ("recipient_missing", "notify.weg")}
    assert find(hass, "recipient_missing", "notify.altes_handy")["entry_id"] is None
    assert find(hass, "recipient_missing", "notify.weg")["places"] == [{"area": "notify", "type": "battery_low"}]


async def test_custom_sound_and_address_for_the_sounds(hass: HomeAssistant, monkeypatch) -> None:
    """Ein eigener Ton, den es nicht mehr gibt (es spielt der Standardton), und keine Adresse von HA für die Lautsprecher."""
    from homeassistant.helpers.network import NoURLAvailableError

    def no_url(*_args, **_kwargs) -> str:
        raise NoURLAvailableError

    hass.states.async_set(SPEAKER, "idle")
    await setup_alarm(hass, workflows_armed={"home": [{"type": "chime", "players": [SPEAKER], "sound": "custom_0123456789ab", "duration": 3}]})
    monkeypatch.setattr(st, "get_url", no_url)
    selftest(hass).async_run()
    assert {c for c, _s in codes(hass)} == {"sound_missing", "no_url"}
    assert find(hass, "no_url")["places"] == [{"area": "workflow", "list": "armed", "trigger": "home", "step": 1}]
    monkeypatch.undo()
    selftest(hass).async_run()
    assert codes(hass) == {("sound_missing", "custom_0123456789ab")}


async def test_monitoring_rules_and_routines_are_checked(hass: HomeAssistant, freezer) -> None:
    """Überwachung: beobachtete Sensoren und Schritte; Routinen: Geräte des Auslösers (auch nicht erreichbar, das meldet sonst niemand)."""
    hass.states.async_set("sensor.kuehlschrank", "5", {"unit_of_measurement": "°C"})
    hass.states.async_set("lock.haustuer", "unavailable")
    rule = {"id": "m1", "name": "Kühlschrank", "enabled": True, "tree": {"op": "and", "items": [
        {"kind": "value", "entity_id": "sensor.kuehlschrank", "op": "above", "limit": 8}, {"kind": "state", "entity_id": "binary_sensor.weg", "state": "on"}]},
        "hold": 0, "margin": 0, "remind": 0, "steps_out": [{"type": "action", "action": "switch.turn_on", "target": [SIREN]}], "steps_ok": []}
    routine = {"id": "r1", "name": "Abends", "enabled": True, "action": "off", "states": ["disarmed"], "unsafe": True,
               "trigger": {"type": "device", "hold": 0, "tree": {"op": "and", "items": [{"kind": "state", "entity_id": "lock.haustuer", "state": "locked"}]}}}
    async_mock_service(hass, "switch", "turn_on")
    await setup_alarm(hass, monitor_enabled=True, monitors=[rule], routines=[routine])
    freezer.tick(timedelta(seconds=SELFTEST_GRACE + 1))
    selftest(hass).async_run()
    assert codes(hass) == {("entity_missing", "binary_sensor.weg"), ("entity_missing", SIREN), ("entity_unavailable", "lock.haustuer")}
    assert find(hass, "entity_missing", "binary_sensor.weg")["places"] == [{"area": "monitor", "id": "m1", "name": "Kühlschrank"}]
    assert find(hass, "entity_missing", SIREN)["places"] == [{"area": "monitor", "id": "m1", "name": "Kühlschrank", "flow": "out", "step": 1}]
    assert find(hass, "entity_unavailable", "lock.haustuer")["role"] == "trigger"


async def test_a_damaged_routine_is_found(hass: HomeAssistant) -> None:
    routine = {"id": "r_kaputt", "name": "Kaputt", "enabled": True, "action": "off", "states": ["disarmed"], "trigger": {"type": "schedule", "times": [{"time": "25:99"}]}}
    await setup_alarm(hass, routines=[routine])
    selftest(hass).async_run()
    problem = find(hass, "rule_damaged")
    assert problem["name"] == "Kaputt" and problem["places"] == [{"area": "routine", "id": "r_kaputt", "name": "Kaputt"}]


async def test_an_alarm_system_that_cannot_load_is_found(hass: HomeAssistant) -> None:
    await setup_alarm(hass)
    broken = MockConfigEntry(domain=DOMAIN, title="Garage", data={"name": "Garage"}, options=options())
    broken.add_to_hass(hass)
    broken.mock_state(hass, ConfigEntryState.SETUP_ERROR)
    selftest(hass).async_run()
    assert find(hass, "system_not_loaded")["name"] == "Garage"


# ----- Laufzeit -----


async def test_a_failing_step_is_recorded_and_clears_when_it_works_again(hass: HomeAssistant, hass_ws_client) -> None:
    """Entscheid des Nutzers: ein Laufzeitbefund verschwindet, wenn derselbe Schritt wieder klappt (im Test oder echt)."""
    hass.states.async_set(SIREN, "off")
    broken = True

    async def turn_on(_call: ServiceCall) -> None:
        if broken:
            raise RuntimeError("Gerät antwortet mit Fehler")

    hass.services.async_register("switch", "turn_on", turn_on)
    entry = await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    await call(hass, "alarm_arm_home")
    hass.states.async_set(WINDOW, "on")
    await hass.async_block_till_done()
    problem = find(hass, "step_failed")
    assert problem["kind"] == "runtime" and problem["service"] == "switch.turn_on" and problem["targets"] == [SIREN] and problem["reason"] == "error"
    assert problem["places"] == [{"area": "run", "list": "alarm", "trigger": "home", "test": False}]
    assert problem["count"] == 1 and problem["first"] == problem["last"]
    await call(hass, "alarm_disarm")
    await hass.async_block_till_done()
    # Die nächste Prüfung der Konfiguration hebt ihn nicht auf (das Gerät ist da), nur derselbe Aufruf, wenn er klappt
    selftest(hass).async_run()
    assert find(hass, "step_failed")
    broken = False
    client = await hass_ws_client(hass)
    assert (await ws(client, type=f"{DOMAIN}/test_workflow", entry_id=entry.entry_id, trigger="home"))["success"]
    await hass.async_block_till_done()
    assert [p for p in selftest(hass).problems() if p["code"] == "step_failed"] == []


async def test_a_step_that_does_not_answer_is_recorded_as_timeout(hass: HomeAssistant, monkeypatch) -> None:
    monkeypatch.setattr("custom_components.alarmageddon.workflow.SERVICE_TIMEOUT", 0.2)

    async def hang(_call: ServiceCall) -> None:
        await asyncio.Event().wait()

    hass.services.async_register("switch", "turn_on", hang)
    hass.states.async_set(SIREN, "off")
    await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    await call(hass, "alarm_arm_home")
    hass.states.async_set(WINDOW, "on")
    await asyncio.sleep(0.4)
    await settle(hass)
    assert find(hass, "step_failed")["reason"] == "timeout"
    await call(hass, "alarm_disarm")
    await settle(hass)


async def test_a_failing_monitoring_step_is_recorded(hass: HomeAssistant, hass_ws_client) -> None:
    async def boom(_call: ServiceCall) -> None:
        raise RuntimeError("kaputt")

    hass.services.async_register("switch", "turn_on", boom)
    hass.states.async_set(SIREN, "off")
    rule = {"id": "m1", "name": "Kühlschrank", "enabled": True, "tree": {"op": "and", "items": [{"kind": "value", "entity_id": "sensor.t", "op": "above", "limit": 8}]},
            "hold": 0, "margin": 0, "remind": 0, "steps_out": [STEP_SIREN], "steps_ok": []}
    hass.states.async_set("sensor.t", "5", {"unit_of_measurement": "°C"})
    entry = await setup_alarm(hass, monitor_enabled=True, monitors=[rule])
    client = await hass_ws_client(hass)
    result = await ws(client, type=f"{DOMAIN}/test_monitor_step", entry_id=entry.entry_id, kind="out", rule_id="m1", step=STEP_SIREN)
    assert result["success"] is False
    problem = find(hass, "step_failed")
    assert problem["places"] == [{"area": "monitor", "id": "m1", "name": "Kühlschrank", "test": True}]


async def test_a_notification_that_fails_is_recorded_and_clears(hass: HomeAssistant) -> None:
    failing = True

    async def handy(_call: ServiceCall) -> None:
        if failing:
            raise RuntimeError("App abgemeldet")

    hass.services.async_register("notify", "handy", handy)
    await setup_alarm(hass)
    await notify_settings(hass, alarm_targets=["notify.handy"])
    hass.data[DATA_SETTINGS]  # Einstellungen stehen
    from custom_components.alarmageddon.notify import async_send

    async_send(hass, ["notify.handy"], {"title": "t", "message": "m"})
    await hass.async_block_till_done()
    problem = find(hass, "notify_failed", "notify.handy")
    assert problem["entry_id"] is None and problem["reason"] == "error"
    failing = False
    async_send(hass, ["notify.handy"], {"title": "t", "message": "m"})
    await hass.async_block_till_done()
    assert [p for p in selftest(hass).problems() if p["code"] == "notify_failed"] == []


async def test_a_part_that_does_not_start_is_recorded_and_clears_on_the_next_start(hass: HomeAssistant, monkeypatch) -> None:
    async def boom(_self) -> None:
        raise RuntimeError("Ablage kaputt")

    original = __import__("custom_components.alarmageddon.monitor", fromlist=["MonitorEngine"]).MonitorEngine.async_start
    monkeypatch.setattr("custom_components.alarmageddon.monitor.MonitorEngine.async_start", boom)
    entry = await setup_alarm(hass)
    assert hass.states.get(ALARM) is not None  # die Anlage läuft trotzdem
    problem = find(hass, "start_failed", "monitor")
    assert problem["part"] == "monitor" and problem["entry_id"] == entry.entry_id
    monkeypatch.setattr("custom_components.alarmageddon.monitor.MonitorEngine.async_start", original)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert [p for p in selftest(hass).problems() if p["code"] == "start_failed"] == []


async def test_a_failing_automatic_backup_is_recorded(hass: HomeAssistant, monkeypatch) -> None:
    from custom_components.alarmageddon import backup

    await setup_alarm(hass)

    async def boom(*_args, **_kwargs):
        raise OSError("Datenträger voll")

    monkeypatch.setattr(backup, "async_create_backup", boom)
    await backup.async_run_auto_backup(hass)
    assert find(hass, "backup_failed")["entry_id"] is None
    monkeypatch.undo()
    await backup.async_run_auto_backup(hass)
    assert [p for p in selftest(hass).problems() if p["code"] == "backup_failed"] == []


async def test_dismiss_only_works_for_runtime_problems(hass: HomeAssistant, hass_ws_client) -> None:
    """"Erledigt" gibt es nur für Laufzeitbefunde; ein Befund der Konfiguration verschwindet erst, wenn er behoben ist."""
    async_mock_service(hass, "switch", "turn_on")
    await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    st.async_note(hass, None, "backup_failed", "auto")
    client = await hass_ws_client(hass)
    run = await ws(client, type=f"{DOMAIN}/selftest_run")
    assert run["success"] and {p["code"] for p in run["result"]["selftest"]["problems"]} == {"entity_missing", "backup_failed"}
    config_key = find(hass, "entity_missing")["key"]
    refused = await ws(client, type=f"{DOMAIN}/selftest_dismiss", key=config_key)
    assert refused["success"] is False and refused["error"]["code"] == "not_found"
    done = await ws(client, type=f"{DOMAIN}/selftest_dismiss", key="*|backup_failed|auto")
    assert done["success"] and {p["code"] for p in done["result"]["selftest"]["problems"]} == {"entity_missing"}


async def test_runtime_problems_are_capped(hass: HomeAssistant) -> None:
    await setup_alarm(hass)
    for index in range(st.SELFTEST_MAX_INCIDENTS + 15):
        st.async_note(hass, None, "notify_failed", f"notify.handy_{index}", service=f"notify.handy_{index}")
    assert len(selftest(hass).incidents) == st.SELFTEST_MAX_INCIDENTS


# ----- Meldung, Entitäten, Reparaturen -----


async def test_each_problem_is_reported_once_and_again_after_it_came_back(hass: HomeAssistant) -> None:
    pushes = async_mock_service(hass, "notify", "tablet")
    async_mock_service(hass, "switch", "turn_on")
    await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    await notify_settings(hass, maintenance_targets=["notify.tablet"])
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert len(pushes) == 1
    assert pushes[0].data["title"] == "⚠️ Self-test: 1 problem"
    assert pushes[0].data["data"]["tag"] == "alarmageddon_selftest" and pushes[0].data["data"]["group"] == "alarmageddon_maintenance"
    assert "Haus" in pushes[0].data["message"] and SIREN in pushes[0].data["message"]
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert len(pushes) == 1  # still
    hass.states.async_set(SIREN, "off")
    selftest(hass).async_run()
    hass.states.async_remove(SIREN)
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert len(pushes) == 2  # behoben und wieder da: neue Meldung


async def test_the_notification_can_be_switched_off_and_has_its_own_recipients(hass: HomeAssistant) -> None:
    tablet = async_mock_service(hass, "notify", "tablet")
    handy = async_mock_service(hass, "notify", "handy")
    async_mock_service(hass, "switch", "turn_on")
    await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    await notify_settings(hass, maintenance_targets=["notify.tablet"], types={"selftest": {"enabled": False}})
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert not tablet and not selftest(hass).reported  # ausgeschaltet: nichts gemeldet, eingeschaltet kommt es noch
    await notify_settings(hass, types={"selftest": {"enabled": True, "targets": ["notify.handy"]}})
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert not tablet and len(handy) == 1


async def test_new_runtime_problems_are_reported_after_a_short_wait(hass: HomeAssistant, freezer) -> None:
    pushes = async_mock_service(hass, "notify", "tablet")
    await setup_alarm(hass)
    await notify_settings(hass, maintenance_targets=["notify.tablet"])
    selftest(hass).async_run()
    st.async_note(hass, None, "backup_failed", "auto")
    await hass.async_block_till_done()
    assert not pushes
    freezer.tick(timedelta(seconds=st.SELFTEST_REPORT_DELAY + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(pushes) == 1


async def test_entity_per_system_and_status_entity_count_the_problems(hass: HomeAssistant) -> None:
    """Entität je Anlage (Problem), vor der ersten Prüfung unbekannt; die Statusentität zählt mit (Entscheid des Nutzers)."""
    async_mock_service(hass, "switch", "turn_on")
    await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    entity = "binary_sensor.haus_self_test"
    reg = er.async_get(hass).async_get(entity)
    assert reg is not None and reg.entity_category == er.EntityCategory.DIAGNOSTIC
    assert hass.states.get(entity).state == "unknown"
    assert hass.states.get("sensor.haus_status").state == "0"
    selftest(hass).async_run()
    await hass.async_block_till_done()
    state = hass.states.get(entity)
    assert state.state == "on" and state.attributes["device_class"] == "problem" and state.attributes["count"] == 1
    assert state.attributes["problems"] == [{"code": "entity_missing", "kind": "config", "entity_id": SIREN}]
    assert state.attributes["last_check"] == selftest(hass).last
    status = hass.states.get("sensor.haus_status")
    assert status.state == "1" and status.attributes["selftest"] == 1 and status.attributes["selftest_last"] == selftest(hass).last
    hass.states.async_set(SIREN, "off")
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert hass.states.get(entity).state == "off"
    assert hass.states.get("sensor.haus_status").state == "0"


async def test_shared_problems_count_for_every_system_but_belong_to_none(hass: HomeAssistant) -> None:
    await setup_alarm(hass, "Haus")
    await setup_alarm(hass, "Garage")
    await notify_settings(hass, alarm_targets=["notify.weg"])
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert hass.states.get("binary_sensor.haus_self_test").state == "on"
    assert hass.states.get("binary_sensor.garage_self_test").state == "on"
    assert len(selftest(hass).problems()) == 1


async def test_repairs_per_system_and_for_all_systems(hass: HomeAssistant) -> None:
    async_mock_service(hass, "switch", "turn_on")
    entry = await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    await notify_settings(hass, alarm_targets=["notify.weg"])
    selftest(hass).async_run()
    issues = ir.async_get(hass)
    own = issues.async_get_issue(DOMAIN, f"selftest_{entry.entry_id}")
    common = issues.async_get_issue(DOMAIN, "selftest_global")
    assert own is not None and own.translation_key == "selftest" and own.translation_placeholders["name"] == "Haus"
    assert SIREN in own.translation_placeholders["problems"] and own.translation_placeholders["count"] == "1"
    assert common is not None and "notify.weg" in common.translation_placeholders["problems"]
    hass.states.async_set(SIREN, "off")
    await notify_settings(hass, alarm_targets=[])
    selftest(hass).async_run()
    assert issues.async_get_issue(DOMAIN, f"selftest_{entry.entry_id}") is None
    assert issues.async_get_issue(DOMAIN, "selftest_global") is None


async def test_removing_the_last_system_removes_its_repairs_and_the_storage(hass: HomeAssistant, hass_storage) -> None:
    async_mock_service(hass, "switch", "turn_on")
    entry = await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    selftest(hass).async_run()
    assert ir.async_get(hass).async_get_issue(DOMAIN, f"selftest_{entry.entry_id}") is not None
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert ir.async_get(hass).async_get_issue(DOMAIN, f"selftest_{entry.entry_id}") is None
    assert SELFTEST_STORE_KEY not in hass_storage
    assert DATA_SELFTEST not in hass.data


# ----- Zeitpunkte -----


async def test_runs_after_the_start_and_after_saving(hass: HomeAssistant, freezer, hass_ws_client) -> None:
    """Läuft HA schon (neue Anlage, Neuladen nach dem Speichern), prüft der Selbsttest kurz danach; ebenso nach "Benachrichtigungen speichern"."""
    entry = await setup_alarm(hass)
    assert selftest(hass).last is None
    freezer.tick(timedelta(seconds=st.SELFTEST_SOON + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    first = selftest(hass).last
    assert first is not None
    # Speichern (die Anlage lädt neu): kurz danach erneut
    freezer.tick(timedelta(minutes=1))
    hass.config_entries.async_update_entry(entry, options={**entry.options, "entry_delay": 25})
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=st.SELFTEST_SOON + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    second = selftest(hass).last
    assert second is not None and second > first
    client = await hass_ws_client(hass)
    freezer.tick(timedelta(minutes=1))
    assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"selftest_minutes": 720}))["success"]
    freezer.tick(timedelta(seconds=st.SELFTEST_SOON + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert selftest(hass).last > second


async def test_the_interval_is_a_setting(hass: HomeAssistant, freezer, hass_ws_client) -> None:
    """
    Entscheid des Nutzers: einstellbar (Standard alle 6 Stunden); seit 1.67.0 in Minuten, 5 bis 1440 (Wunsch des Nutzers 2026-11-19); der Takt
    schaut jede Minute, ob es Zeit ist.
    """
    await setup_alarm(hass)
    assert hass.data[DATA_SETTINGS].notify["selftest_minutes"] == 360
    assert st.SELFTEST_TICK == 60
    client = await hass_ws_client(hass)
    for bad in (0, 4, 1441):
        assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"selftest_minutes": bad}))["success"] is False
    assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"selftest_minutes": 90}))["success"]
    # Die Prüfung kurz nach dem Start und nach dem Speichern abwarten
    freezer.tick(timedelta(seconds=st.SELFTEST_SOON + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    first = dt_util.parse_datetime(selftest(hass).last)
    assert selftest(hass).payload()["next"] == (first + timedelta(minutes=90)).isoformat()
    freezer.tick(timedelta(minutes=89))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert dt_util.parse_datetime(selftest(hass).last) == first
    freezer.tick(timedelta(minutes=2))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert dt_util.parse_datetime(selftest(hass).last) > first, "nach 90 Minuten, beim nächsten Takt (höchstens eine Minute später)"


async def test_while_armed_the_armed_interval_applies(hass: HomeAssistant, freezer, hass_ws_client) -> None:
    """
    Wunsch des Nutzers 2026-11-19: zwei Abstände, "nicht scharf" und "scharf" (Standard 6 Stunden und 1 Stunde); seit 1.67.0 in Minuten, damit
    etwa alle 5 Minuten bei scharfer Anlage geht.
    """
    await setup_alarm(hass)
    assert hass.data[DATA_SETTINGS].notify["selftest_minutes_armed"] == 60
    client = await hass_ws_client(hass)
    for bad in (0, 4, 1441):
        assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"selftest_minutes_armed": bad}))["success"] is False
    assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"selftest_minutes": 360, "selftest_minutes_armed": 5}))["success"]
    freezer.tick(timedelta(seconds=st.SELFTEST_SOON + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    first = dt_util.parse_datetime(selftest(hass).last)
    payload = selftest(hass).payload()
    assert (payload["minutes"], payload["minutes_disarmed"], payload["minutes_armed"], payload["armed"]) == (360, 360, 5, False)
    freezer.tick(timedelta(minutes=10))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert dt_util.parse_datetime(selftest(hass).last) == first, "nicht scharf: alle 6 Stunden"
    await call(hass, "alarm_arm_home")
    payload = selftest(hass).payload()
    assert (payload["minutes"], payload["armed"]) == (5, True)
    assert payload["next"] == (first + timedelta(minutes=5)).isoformat()
    freezer.tick(timedelta(seconds=st.SELFTEST_TICK))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    second = dt_util.parse_datetime(selftest(hass).last)
    assert second > first, "scharf: die 5 Minuten sind um, beim nächsten Takt"
    freezer.tick(timedelta(minutes=4))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert dt_util.parse_datetime(selftest(hass).last) == second
    freezer.tick(timedelta(minutes=1, seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert dt_util.parse_datetime(selftest(hass).last) > second, "scharf: wieder nach 5 Minuten, nicht erst nach 10"


async def test_stored_hours_of_1_66_become_minutes(hass: HomeAssistant, hass_storage) -> None:
    """Gespeicherte Einstellungen bis 1.66.x tragen Stunden (12 und 2): nach dem Update gelten 720 und 120 Minuten, der Selbsttest rechnet damit."""
    hass_storage[SETTINGS_STORE_KEY] = {"version": 1, "key": SETTINGS_STORE_KEY, "data": {"notify": {"selftest_hours": 12, "selftest_hours_armed": 2}}}
    await setup_alarm(hass)
    notify = hass.data[DATA_SETTINGS].notify
    assert (notify["selftest_minutes"], notify["selftest_minutes_armed"], "selftest_hours" in notify) == (720, 120, False)
    assert (selftest(hass).payload()["minutes_disarmed"], selftest(hass).payload()["minutes_armed"]) == (720, 120)


async def test_a_panel_of_1_66_still_saves_hours(hass: HomeAssistant, hass_ws_client) -> None:
    """Ein noch offenes Panel bis 1.66.x sendet Stunden: sie gelten als Minuten (mal 60), nie als Fehler und nie neben den Minuten gespeichert."""
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"selftest_hours": 12, "selftest_hours_armed": 2}))["success"]
    notify = hass.data[DATA_SETTINGS].notify
    assert (notify["selftest_minutes"], notify["selftest_minutes_armed"]) == (720, 120)
    assert "selftest_hours" not in notify and "selftest_hours_armed" not in notify
    # Mit beiden gilt der Wert in Minuten
    assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"selftest_hours": 3, "selftest_minutes": 15}))["success"]
    assert hass.data[DATA_SETTINGS].notify["selftest_minutes"] == 15


# ----- Ablage -----


async def test_storage_survives_a_restart_and_damaged_entries_are_dropped(hass: HomeAssistant, hass_storage) -> None:
    """Laufzeitbefunde bleiben über einen Neustart; ein beschädigter Eintrag fällt einzeln weg, nie die ganze Ablage."""
    good = {"key": "*|backup_failed|auto", "kind": "runtime", "code": "backup_failed", "entry_id": None, "subject": "auto",
            "first": "2026-11-18T10:00:00+00:00", "last": "2026-11-18T11:00:00+00:00", "count": 3, "places": [{"area": "run", "evil": "x"}, "kaputt"]}
    hass_storage[SELFTEST_STORE_KEY] = {"version": 1, "key": SELFTEST_STORE_KEY, "data": {
        "last": "2026-11-18T09:00:00+00:00",
        "incidents": {good["key"]: good, "x|kaputt|y": {"code": "erfunden"}, "*|notify_failed|n": {"code": "notify_failed", "entry_id": None, "subject": "anders"},
                      "*|step_failed|s": "kein Wörterbuch"},
        "config": {"*|recipient_missing|notify.x": {"code": "recipient_missing", "entry_id": None, "subject": "notify.x", "service": "notify.x", "places": []}},
        "reported": {"*|backup_failed|auto": "2026-11-18T10:01:00+00:00", "x": 5},
    }}
    await setup_alarm(hass)
    test = selftest(hass)
    assert list(test.incidents) == ["*|backup_failed|auto"]
    assert test.incidents["*|backup_failed|auto"]["count"] == 3 and test.incidents["*|backup_failed|auto"]["places"] == [{"area": "run"}]
    assert list(test.config) == ["*|recipient_missing|notify.x"]  # gilt bis zur nächsten Prüfung
    assert test.reported == {"*|backup_failed|auto": "2026-11-18T10:01:00+00:00"}
    assert test.last == "2026-11-18T09:00:00+00:00"
    test.async_run()
    assert list(test.config) == []


async def test_a_broken_storage_never_stops_the_alarm_system(hass: HomeAssistant, hass_storage) -> None:
    hass_storage[SELFTEST_STORE_KEY] = {"version": 1, "key": SELFTEST_STORE_KEY, "data": ["kein", "Wörterbuch"]}
    await setup_alarm(hass)
    assert hass.states.get(ALARM) is not None and selftest(hass).incidents == {}


# ----- Sicherheit: der Selbsttest hält nie etwas auf -----


async def test_note_and_resolve_never_raise(hass: HomeAssistant, monkeypatch) -> None:
    """Der Einstieg von aussen (mitten im Alarm) fängt jeden Fehler des Selbsttests ab."""
    await setup_alarm(hass)

    def boom(*_args, **_kwargs) -> None:
        raise RuntimeError("Selbsttest kaputt")

    monkeypatch.setattr(st.SelfTest, "note", boom)
    monkeypatch.setattr(st.SelfTest, "resolve", boom)
    st.async_note(hass, None, "backup_failed", "auto")
    selftest(hass).incidents["*|backup_failed|auto"] = {"key": "*|backup_failed|auto"}
    st.async_resolve(hass, None, "backup_failed", "auto")


def test_the_entry_points_are_synchronous() -> None:
    """Nichts zum Abwarten: der Selbsttest kann einen Schritt des Alarms nie aufhalten (kein await im Ablauf)."""
    for function in (st.async_note, st.async_resolve, st.SelfTest.note, st.SelfTest.resolve, st.SelfTest.async_run):
        assert not asyncio.iscoroutinefunction(function), function


async def test_the_selftest_reads_only(hass: HomeAssistant) -> None:
    """Eine Prüfung ruft keinen Dienst auf (schaltet nichts, spielt nichts, sendet nichts ausser der eigenen Meldung)."""
    calls: list[str] = []
    hass.bus.async_listen("call_service", lambda event: calls.append(f"{event.data['domain']}.{event.data['service']}"))
    async_mock_service(hass, "switch", "turn_on")
    hass.states.async_set(SIREN, "off")
    await setup_alarm(hass, workflows={"home": [STEP_SIREN]})
    await hass.async_block_till_done()
    calls.clear()
    selftest(hass).async_run()
    await hass.async_block_till_done()
    assert calls == []


async def test_findings_never_contain_secrets(hass: HomeAssistant, hass_storage) -> None:
    """Ein Befund trägt nie die Daten eines Aufrufs (dort könnte ein Code oder Token stehen), nur Dienst und Geräte."""
    secret = "geheim-123456"

    async def boom(_call: ServiceCall) -> None:
        raise RuntimeError(f"Fehler mit {secret}")

    hass.services.async_register("rest_command", "tor", boom)
    await setup_alarm(hass, workflows={"home": [{"type": "action", "action": "rest_command.tor", "data": {"token": secret}}]})
    await call(hass, "alarm_arm_home")
    hass.states.async_set(WINDOW, "on")
    await hass.async_block_till_done()
    await selftest(hass).async_save()
    assert find(hass, "step_failed")["service"] == "rest_command.tor"
    text = json.dumps([selftest(hass).payload(), hass_storage[SELFTEST_STORE_KEY], dict(hass.states.get("binary_sensor.haus_self_test").attributes)], default=str)
    assert secret not in text


@pytest.mark.parametrize("language", ["en", "de"])
async def test_texts_exist_for_every_code(hass: HomeAssistant, language: str) -> None:
    """Jeder Befund hat eine Zeile für die Push-Meldung und die Reparaturen, in beiden Sprachen."""
    from custom_components.alarmageddon.notify import TEXTS

    for code in (*st.CONFIG_CODES, *st.RUNTIME_CODES, "step_timeout"):
        assert f"st_{code}" in TEXTS[language], code


def test_the_interval_is_part_of_the_settings_and_backups() -> None:
    """
    Der Abstand gehört zu den Benachrichtigungen (und damit in jedes Backup); ein Backup ohne ihn bekommt 6 Stunden und 1 Stunde, Unsinn wird
    begrenzt. Seit 1.67.0 in Minuten; gespeicherte Einstellungen und Backups bis 1.66.x tragen Stunden: sie werden übernommen (mal 60).
    """
    from custom_components.alarmageddon.settings import valid_notify

    assert (valid_notify({})["selftest_minutes"], valid_notify({})["selftest_minutes_armed"]) == (360, 60)
    assert valid_notify({"selftest_minutes": 5})["selftest_minutes"] == 5
    assert valid_notify({"selftest_minutes": 0})["selftest_minutes"] == 5
    assert valid_notify({"selftest_minutes": 9999})["selftest_minutes"] == 1440
    assert valid_notify({"selftest_minutes": True})["selftest_minutes"] == 360
    assert valid_notify({"selftest_minutes_armed": 15})["selftest_minutes_armed"] == 15
    # Bis 1.66.x: Stunden
    old = valid_notify({"selftest_hours": 12, "selftest_hours_armed": 2})
    assert (old["selftest_minutes"], old["selftest_minutes_armed"]) == (720, 120) and "selftest_hours" not in old and "selftest_hours_armed" not in old
    assert valid_notify({"selftest_hours": 99})["selftest_minutes"] == 1440
    assert valid_notify({"selftest_hours": True})["selftest_minutes"] == 360
    assert valid_notify({"selftest_hours": 12, "selftest_minutes": 30})["selftest_minutes"] == 30, "der Wert in Minuten geht vor"
    assert valid_notify({"types": {"selftest": {"enabled": False}}})["types"]["selftest"]["enabled"] is False
    assert valid_notify({})["types"]["selftest"] == {"enabled": True, "critical": False, "volume": 0.8, "persistent": False, "targets": []}
