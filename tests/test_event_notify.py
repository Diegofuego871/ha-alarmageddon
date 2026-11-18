"""
Feste Meldungen im Reiter Aktionen und Aktionen bei einem stillen Alarm (1.62.0, Entscheide des Nutzers vom 2026-11-17).

"Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung" und "Stiller Alarm" gehören zum Ablauf einer Anlage: je Anlage und Auslöser
(Modus oder "Immer aktiv"), mit eigenem Text. Solange eine Anlage für einen Auslöser nichts Eigenes gespeichert hat, gilt die bisherige
gemeinsame Einstellung der Art: das Update ändert nichts. Bei einem stillen Alarm laufen zusätzlich eigene Aktionen; es gibt dabei nie
einen Alarm, und Alarm, Test und Verzögerungen haben Vorrang.
"""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.core import HomeAssistant, ServiceCall
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.alarmageddon.const import DATA_SETTINGS, DOMAIN
from custom_components.alarmageddon.notify import event_notice
from custom_components.alarmageddon.schemas import SYSTEM_OPTIONS_SCHEMA, valid_event_notify
from custom_components.alarmageddon.settings import valid_notify

from .conftest import FRONT_DOOR, MOTION, WINDOW, setup_alarm
from .test_alarm import advance, call, settle, state
from .test_sensor_options import SMOKE, _classes, open_sensor

LIGHT, SIREN = "switch.licht", "switch.sirene"
PLAYER = "media_player.wohnzimmer"
_id = iter(range(1, 100000))


async def _ws(client, **msg) -> dict[str, Any]:
    await client.send_json({"id": next(_id), **msg})
    return await client.receive_json()


def notice(enabled: bool = True, **more: Any) -> dict[str, Any]:
    return {"enabled": enabled, "critical": False, **more}


def act(target: str = LIGHT, **more: Any) -> dict[str, Any]:
    return {"type": "action", "action": "switch.turn_on", "target": [target], "wait": False, **more}


async def _setup(hass: HomeAssistant, **options: Any):
    """Anlage ohne Ausgangsverzögerung, Standard-Empfänger "notify.handy"; gibt die Anlage und die gesendeten Meldungen zurück."""
    _classes(hass)
    pushes = async_mock_service(hass, "notify", "handy")
    entry = await setup_alarm(hass, **{"exit_delay_away": 0, **options})
    settings = hass.data[DATA_SETTINGS]
    await settings.async_set_notify({**settings.notify, "alarm_targets": ["notify.handy"]})
    return entry, pushes


async def _report(hass: HomeAssistant, entity: str = MOTION) -> None:
    await open_sensor(hass, entity)
    await settle(hass)


# ----- Wirksame Meldung: eigener Wert der Anlage, sonst die bisherige gemeinsame Einstellung -----


def test_without_own_values_the_former_shared_settings_apply() -> None:
    """Das Update ändert nichts: ohne eigene Werte der Anlage gilt die Art aus dem Reiter Benachrichtigungen, mit den Werten des Modus."""
    cfg = valid_notify({"per_mode": True, "types": {"armed": {"enabled": True, "critical": True, "volume": 0.3, "persistent": True, "targets": ["notify.tablet"]}},
                        "modes": {"away": {"armed": {"enabled": False}, "sensor_report": {"volume": 0.1}}}})
    home = event_notice({}, cfg, "armed", "home")
    assert home == {"enabled": True, "title": "", "message": "", "critical": True, "volume": 0.3, "persistent": True, "click": "overview", "click_path": "", "targets": ["notify.tablet"]}
    assert event_notice({}, cfg, "armed", "away")["enabled"] is False  # eigener Wert des Modus
    assert event_notice({}, cfg, "sensor_report", "away")["volume"] == 0.1 and event_notice({}, cfg, "sensor_report", "always")["volume"] == 0.8
    # Standard der Arten: nur "Stiller Alarm" ist an und kritisch
    plain = valid_notify(None)
    assert {kind: (event_notice({}, plain, kind, "home")["enabled"], event_notice({}, plain, kind, "home")["critical"]) for kind in ("armed", "disarmed", "pending", "sensor_report")} == {
        "armed": (False, False), "disarmed": (False, False), "pending": (False, False), "sensor_report": (True, True)}
    # "Immer aktiv" ohne eigenen Wert: wie bis 1.61.0 der Wert des Modus, in dem die Anlage gerade scharf ist; deaktiviert der gemeinsame
    assert event_notice({}, cfg, "sensor_report", "always", "away")["volume"] == 0.1 and event_notice({}, cfg, "sensor_report", "always", "home")["volume"] == 0.8
    assert event_notice({"event_notify": {"always": {"sensor_report": {"enabled": True, "critical": False}}}}, cfg, "sensor_report", "always", "away")["critical"] is False
    # Ohne Auslöser (Modus unbekannt) und mit "pro Modus" aus: der gemeinsame Wert
    assert event_notice({}, cfg, "armed", None)["enabled"] is True
    assert event_notice({}, {**cfg, "per_mode": False}, "armed", "away")["enabled"] is True


def test_own_values_of_the_alarm_system_win_and_are_complete() -> None:
    cfg = valid_notify({"types": {"armed": {"enabled": False}}})
    options = {"event_notify": {"home": {"armed": {"enabled": True, "critical": False, "title": "Hallo"}}}}
    own = event_notice(options, cfg, "armed", "home")
    assert own["enabled"] is True and own["title"] == "Hallo" and own["volume"] == 0.8 and own["targets"] == [] and own["click"] == "overview"
    assert event_notice(options, cfg, "armed", "away")["enabled"] is False  # dieser Modus hat nichts Eigenes
    assert event_notice(options, cfg, "disarmed", "home")["enabled"] is False  # diese Art hat nichts Eigenes
    # Ein beschädigter Eintrag (kein "enabled") zählt nicht als eigener Wert
    assert event_notice({"event_notify": {"home": {"armed": {"title": "x"}}}}, cfg, "armed", "home")["title"] == ""
    assert event_notice({"event_notify": {"home": "kaputt"}}, cfg, "armed", "home")["enabled"] is False


async def test_data_names_the_effective_messages_for_every_trigger(hass: HomeAssistant, hass_ws_client) -> None:
    """Das Panel bekommt je Auslöser den wirksamen Stand; "Immer aktiv" kennt nur "Stiller Alarm"."""
    await _setup(hass, event_notify={"home": {"pending": notice(True, title="Achtung")}})
    client = await hass_ws_client(hass)
    system = (await _ws(client, type=f"{DOMAIN}/data"))["result"]["systems"][0]
    shown = system["event_notify"]
    assert set(shown) == {"home", "away", "night", "always"} and set(shown["always"]) == {"sensor_report"}
    assert set(shown["home"]) == {"armed", "disarmed", "pending", "sensor_report"}
    assert shown["home"]["pending"]["enabled"] is True and shown["home"]["pending"]["title"] == "Achtung"
    assert shown["away"]["pending"]["enabled"] is False and shown["away"]["sensor_report"] == {
        "enabled": True, "title": "", "message": "", "critical": True, "volume": 0.8, "persistent": False, "click": "overview", "click_path": "", "targets": []}
    assert system["workflows_report"] == {}


# ----- Die vier Meldungen gehen nach den Werten der Anlage hinaus -----


async def test_armed_and_disarmed_follow_the_mode(hass: HomeAssistant) -> None:
    """Je Modus eigene Werte: "Scharf geschaltet" für den Modus, der scharf wird, "Deaktiviert" für den Modus, der scharf war."""
    _entry, pushes = await _setup(hass, event_notify={
        "home": {"armed": notice(True), "disarmed": notice(False)},
        "away": {"armed": notice(False), "disarmed": notice(True, critical=True, volume=0.4)},
    })
    await call(hass, "alarm_arm_home")
    await settle(hass)
    assert len(pushes) == 1 and pushes[0].data["title"] == "🔒 Haus: Home armed" and pushes[0].data["message"] == "The alarm system is armed."
    assert "push" not in pushes[0].data["data"] and pushes[0].data["data"]["url"] == "/alarmageddon"
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert len(pushes) == 1  # "Deaktiviert" ist für Anwesend aus
    await call(hass, "alarm_arm_away")
    await settle(hass)
    assert len(pushes) == 1  # "Scharf geschaltet" ist für Abwesend aus
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert len(pushes) == 2 and pushes[1].data["title"] == "🔓 Haus disarmed"
    assert pushes[1].data["data"]["push"]["sound"] == {"name": "default", "critical": 1, "volume": 0.4}


async def test_the_entry_delay_message_follows_the_mode(hass: HomeAssistant) -> None:
    """ "Eingangsverzögerung" je Modus: aus heisst aus, auch wenn sie für einen anderen Modus an ist."""
    _entry, pushes = await _setup(hass, entry_delay=30, event_notify={"home": {"pending": notice(True)}, "away": {"pending": notice(False)}})
    await call(hass, "alarm_arm_away")
    await open_sensor(hass, FRONT_DOOR)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.PENDING and not pushes
    await call(hass, "alarm_disarm")
    await open_sensor(hass, FRONT_DOOR, "off")
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, FRONT_DOOR)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.PENDING
    assert [p.data["title"] for p in pushes] == ["⏳ Entry delay: Haus"] and "Alarm in 30 s" in pushes[0].data["message"]
    await call(hass, "alarm_disarm")
    await settle(hass)


async def test_own_text_with_placeholders(hass: HomeAssistant) -> None:
    """Eigener Titel und Text mit Platzhaltern; {person} ist, wer geschaltet hat, {delay} die Zeit der Eingangsverzögerung."""
    entry, pushes = await _setup(hass, entry_delay=90, event_notify={"away": {
        "armed": notice(True, title="{name} ist {mode}", message="von {person} um {time}"),
        "disarmed": notice(True, title="Aus: {name}", message="{person} hat deaktiviert ({mode})"),
        "pending": notice(True, title="{sensor} offen", message="Noch {delay}. {type} in {area}|"),
    }})
    ctl = entry.runtime_data.controller
    await ctl.async_arm("away", None, "Anna", skip_code=True)
    await settle(hass)
    assert pushes[-1].data["title"] == "Haus ist Away" and pushes[-1].data["message"].startswith("von Anna um ")
    await open_sensor(hass, FRONT_DOOR)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.PENDING
    assert pushes[-1].data["title"].endswith("offen") and pushes[-1].data["message"].startswith("Noch 1 min 30 s. Door in |")
    await ctl.async_disarm(None, "Anna", skip_code=True)
    await settle(hass)
    assert pushes[-1].data["title"] == "Aus: Haus" and pushes[-1].data["message"] == "Anna hat deaktiviert (Away)"
    assert len(pushes) == 3


async def test_a_text_of_only_placeholders_that_are_empty_falls_back_to_the_standard_text(hass: HomeAssistant) -> None:
    """Bleibt vom eigenen Text nichts übrig (nur leere Platzhalter), gilt der Standardtext: nie eine leere Meldung."""
    _entry, pushes = await _setup(hass, event_notify={"home": {"armed": notice(True, title="{person}", message=" {area} ")}})
    await call(hass, "alarm_arm_home")
    await settle(hass)
    assert pushes[0].data["title"] == "🔒 Haus: Home armed" and pushes[0].data["message"] == "The alarm system is armed."


async def test_recipients_persistent_and_click_target(hass: HomeAssistant) -> None:
    """Eigene Empfänger ersetzen die Standard-Empfänger; "in Home Assistant stehen lassen" legt die Benachrichtigung an; Klickziel."""
    tablet = async_mock_service(hass, "notify", "tablet")
    created: list[dict[str, Any]] = []
    hass.bus.async_listen("persistent_notifications_updated", lambda _event: None)
    _entry, pushes = await _setup(hass, event_notify={"home": {
        "armed": notice(True, targets=["notify.tablet"], persistent=True, click="custom", click_path="/lovelace/alarm"),
        "disarmed": notice(True, click="log"),
    }})
    from homeassistant.components import persistent_notification

    real = persistent_notification.async_create
    try:
        persistent_notification.async_create = lambda _hass, message, title=None, notification_id=None: created.append({"message": message, "title": title, "id": notification_id})
        await call(hass, "alarm_arm_home")
        await settle(hass)
        assert not pushes and len(tablet) == 1 and tablet[0].data["data"]["url"] == "/lovelace/alarm"
        assert len(created) == 1 and created[0]["title"] == "🔒 Haus: Home armed" and created[0]["id"].endswith("_armed")
        await call(hass, "alarm_disarm")
        await settle(hass)
        assert len(pushes) == 1 and pushes[0].data["data"]["url"] == "/alarmageddon?view=log" and len(created) == 1
    finally:
        persistent_notification.async_create = real


async def test_after_an_alarm_only_the_closing_message_goes_out(hass: HomeAssistant) -> None:
    """Deaktivieren aus dem Alarm: "Alarm beendet" ersetzt die Alarmmeldung; "Deaktiviert" kommt nicht zusätzlich."""
    _entry, pushes = await _setup(hass, event_notify={"home": {"disarmed": notice(True)}})
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    pushes.clear()
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert [p.data["title"] for p in pushes] == ["✅ Alarm ended: Haus"]


async def test_silent_alarm_uses_the_message_of_its_trigger(hass: HomeAssistant, freezer) -> None:
    """Sensor der Zone: die Meldung des Modus. Immer aktiver Sensor: die Meldung von "Immer aktiv", auch wenn die Anlage scharf ist."""
    _entry, pushes = await _setup(hass, per_mode_sensors=True, sensor_options={SMOKE: {"always": True}},
                                  sensor_modes={"always": {SMOKE: {"report_only": True}}, "away": {MOTION: {"report_only": True}}},
                                  event_notify={"away": {"sensor_report": notice(True, title="Zone: {sensor}")}, "always": {"sensor_report": notice(True, title="Immer: {sensor}", critical=True)}})
    await open_sensor(hass, SMOKE)  # deaktiviert: nur "Immer aktiv" gilt
    await settle(hass)
    assert len(pushes) == 1 and pushes[0].data["title"].startswith("Immer: ") and pushes[0].data["data"]["push"]["interruption-level"] == "critical"
    assert state(hass) == AlarmControlPanelState.DISARMED
    await call(hass, "alarm_arm_away")
    await _report(hass, MOTION)
    assert len(pushes) == 2 and pushes[1].data["title"].startswith("Zone: ") and "push" not in pushes[1].data["data"]
    assert pushes[1].data["data"]["tag"].endswith(f"_report_{MOTION}")
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY
    # Der immer aktive Sensor spricht an, während die Anlage scharf ist: weiterhin die Meldung von "Immer aktiv", nicht die des Modus
    await open_sensor(hass, SMOKE, "off")
    await advance(hass, freezer, 61)
    await _report(hass, SMOKE)
    assert len(pushes) == 3 and pushes[2].data["title"].startswith("Immer: ") and state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_a_failing_notification_in_home_assistant_never_stops_the_message(hass: HomeAssistant, monkeypatch) -> None:
    """ "In Home Assistant stehen lassen" ist Zusatz: scheitert das Anlegen, geht die Meldung aufs Handy trotzdem hinaus."""
    from homeassistant.components import persistent_notification

    def broken(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("kaputt")

    _entry, pushes = await _setup(hass, event_notify={"home": {"armed": notice(True, persistent=True)}})
    monkeypatch.setattr(persistent_notification, "async_create", broken)
    await call(hass, "alarm_arm_home")
    await settle(hass)
    assert len(pushes) == 1 and state(hass) == AlarmControlPanelState.ARMED_HOME


async def test_an_always_active_sensor_keeps_the_former_values_of_the_armed_mode(hass: HomeAssistant) -> None:
    """
    Das Update ändert nichts: Bis 1.61.0 nahm der stille Alarm eines immer aktiven Sensors die Werte des Modus, in dem die Anlage scharf
    ist. Solange "Immer aktiv" nichts Eigenes gespeichert hat, bleibt das so.
    """
    _entry, pushes = await _setup(hass, per_mode_sensors=True, sensor_options={SMOKE: {"always": True}}, sensor_modes={"always": {SMOKE: {"report_only": True}}})
    settings = hass.data[DATA_SETTINGS]
    await settings.async_set_notify({**settings.notify, "per_mode": True, "modes": {"away": {"sensor_report": {"critical": True, "volume": 0.2}}},
                                     "types": {**settings.notify["types"], "sensor_report": {**settings.notify["types"]["sensor_report"], "critical": False}}})
    await call(hass, "alarm_arm_away")
    await _report(hass, SMOKE)
    assert len(pushes) == 1 and pushes[0].data["data"]["push"]["sound"] == {"name": "default", "critical": 1, "volume": 0.2}


async def test_a_switched_off_silent_alarm_message_sends_nothing(hass: HomeAssistant) -> None:
    entry, pushes = await _setup(hass, sensor_options={MOTION: {"report_only": True}}, event_notify={"away": {"sensor_report": notice(False)}})
    await call(hass, "alarm_arm_away")
    await _report(hass)
    assert not pushes and any(e.get("kind") == "sensor_report" for e in entry.runtime_data.events.events)  # im Protokoll steht er trotzdem


# ----- Speichern, Prüfen, Testmeldung, Sicherung -----


async def test_saving_replaces_only_what_is_sent(hass: HomeAssistant, hass_ws_client) -> None:
    """Je Auslöser und Art ersetzen; was fehlt, bleibt (auch "noch nie gespeichert": dort gilt weiter die gemeinsame Einstellung)."""
    entry, _pushes = await _setup(hass, event_notify={"home": {"armed": notice(True, title="alt"), "disarmed": notice(True)}})
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/save_workflows", entry_id=entry.entry_id, workflows={}, workflows_report={"away": [act()], "home": []},
                       event_notify={"home": {"armed": notice(False, title="neu", targets=["notify.handy"])}, "always": {"sensor_report": notice(False)}})
    assert result["success"] and result["result"]["reload"] is True, result
    await hass.async_block_till_done()
    saved = entry.options["event_notify"]
    assert saved["home"]["armed"] == {"enabled": False, "title": "neu", "message": "", "critical": False, "volume": 0.8, "persistent": False, "click": "overview", "click_path": "", "targets": ["notify.handy"]}
    assert saved["home"]["disarmed"]["enabled"] is True and set(saved) == {"home", "always"} and "away" not in saved
    assert list(entry.options["workflows_report"]) == ["away"] and entry.options["workflows_report"]["away"][0]["target"] == [LIGHT]
    # Ohne Änderung lädt die Anlage nicht neu
    again = await _ws(client, type=f"{DOMAIN}/save_workflows", entry_id=entry.entry_id, workflows={})
    assert again["result"]["reload"] is False


BAD_NOTIFY = [
    {"gibt_es_nicht": {"armed": notice()}},
    {"gibt_es_nicht": {"sensor_report": notice()}},
    {"home": {"gibt_es_nicht": notice()}},
    {"home": {"triggered": notice()}},
    {"always": {"armed": notice()}},
    {"always": {"disarmed": notice()}},
    {"always": {"pending": notice()}},
    {"home": {"armed": {"critical": False}}},
    {"home": {"armed": {"enabled": True}}},
    {"home": {"armed": {"enabled": "ja", "critical": False}}},
    {"home": {"armed": notice(volume=1.5)}},
    {"home": {"armed": notice(title="x" * 101)}},
    {"home": {"armed": notice(message="x" * 301)}},
    {"home": {"armed": notice(targets=["light.flur"])}},
    {"home": {"armed": notice(targets=["notify.a"] * 21)}},
    {"home": {"armed": notice(click="extern")}},
    {"home": {"armed": notice(click="custom", click_path="https://example.org")}},
    {"home": {"armed": notice(unbekannt=True)}},
    {"home": "kaputt"},
    "kaputt",
]


@pytest.mark.parametrize("bad", BAD_NOTIFY)
async def test_invalid_messages_are_rejected_and_change_nothing(hass: HomeAssistant, hass_ws_client, bad: Any) -> None:
    """Unbekannter Auslöser, unbekannte Art, eine Art, die es für "Immer aktiv" nicht gibt, ungültige Werte: abgelehnt, beim Speichern und in einer Sicherung."""
    with pytest.raises(vol.Invalid):
        valid_event_notify(bad)
    with pytest.raises(vol.Invalid):
        SYSTEM_OPTIONS_SCHEMA({"event_notify": bad})
    entry, _pushes = await _setup(hass)
    before = dict(entry.options)
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/save_workflows", entry_id=entry.entry_id, workflows={}, event_notify=bad)
    assert result["success"] is False and dict(entry.options) == before


@pytest.mark.parametrize("steps", [
    [{"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 10}],
    [{"type": "notify"}],
    [{"type": "acknowledge"}],
    [{"type": "group", "mode": "until_disarmed", "steps": [{"type": "wait", "seconds": 1}]}],
    [{"type": "gibt_es_nicht"}],
])
async def test_silent_alarm_actions_never_take_a_siren_or_an_endless_group(hass: HomeAssistant, hass_ws_client, steps: list[dict[str, Any]]) -> None:
    """Stiller Alarm: dieselben Schritte wie beim Scharfschalten. Keine Sirene, keine Alarmmeldung, kein Quittieren, nichts "bis deaktiviert"."""
    with pytest.raises(vol.Invalid):
        SYSTEM_OPTIONS_SCHEMA({"workflows_report": {"home": steps}})
    with pytest.raises(vol.Invalid):
        SYSTEM_OPTIONS_SCHEMA({"workflows_report": {"gibt_es_nicht": []}})
    entry, _pushes = await _setup(hass)
    client = await hass_ws_client(hass)
    result = await _ws(client, type=f"{DOMAIN}/save_workflows", entry_id=entry.entry_id, workflows={}, workflows_report={"home": steps})
    assert result["success"] is False and "workflows_report" not in entry.options


async def test_test_message_uses_the_unsaved_values(hass: HomeAssistant, hass_ws_client) -> None:
    """Testmeldung aus dem Fenster: mit den Werten von dort (auch ungespeichert), Testtitel, an ihre Empfänger; nichts wird gespeichert."""
    tablet = async_mock_service(hass, "notify", "tablet")
    entry, pushes = await _setup(hass, entry_delay=45)
    before = dict(entry.options)
    client = await hass_ws_client(hass)
    reply = await _ws(client, type=f"{DOMAIN}/test_event_notify", entry_id=entry.entry_id, kind="pending", trigger="away",
                      notice=notice(False, title="{sensor}: noch {delay}", critical=True, volume=0.2, targets=["notify.tablet"]))
    assert reply["success"] and reply["result"]["targets"] == ["notify.tablet"], reply
    await settle(hass)
    assert not pushes and len(tablet) == 1
    assert tablet[0].data["title"].startswith("🧪 Test: ") and tablet[0].data["title"].endswith(": noch 45 s")
    assert tablet[0].data["data"]["push"]["sound"]["volume"] == 0.2 and dict(entry.options) == before
    # Standard-Empfänger, wenn die Meldung keine eigenen hat
    reply = await _ws(client, type=f"{DOMAIN}/test_event_notify", entry_id=entry.entry_id, kind="sensor_report", trigger="always", notice=notice())
    assert reply["result"]["targets"] == ["notify.handy"] and len(pushes) == 1
    # Was es für "Immer aktiv" nicht gibt, lässt sich auch nicht testen; ohne Empfänger eine klare Antwort
    for kind in ("armed", "disarmed", "pending"):
        assert (await _ws(client, type=f"{DOMAIN}/test_event_notify", entry_id=entry.entry_id, kind=kind, trigger="always", notice=notice()))["error"]["code"] == "invalid_format"
    settings = hass.data[DATA_SETTINGS]
    await settings.async_set_notify({**settings.notify, "alarm_targets": []})
    assert (await _ws(client, type=f"{DOMAIN}/test_event_notify", entry_id=entry.entry_id, kind="armed", trigger="home", notice=notice()))["error"]["code"] == "no_targets"
    assert not (await _ws(client, type=f"{DOMAIN}/test_event_notify", entry_id=entry.entry_id, kind="triggered", trigger="home", notice=notice()))["success"]


async def test_backup_carries_messages_and_silent_alarm_actions(hass: HomeAssistant, hass_ws_client) -> None:
    """Sicherung und Wiederherstellung: beides gehört zu den Optionen der Anlage."""
    own = {"home": {"armed": notice(True, title="Hallo {name}", targets=["notify.handy"])}, "always": {"sensor_report": notice(False)}}
    entry, _pushes = await _setup(hass, event_notify=own, workflows_report={"away": [act()]})
    client = await hass_ws_client(hass)
    exported = (await _ws(client, type=f"{DOMAIN}/export"))["result"]
    options = exported["systems"][0]["options"]
    assert options["event_notify"]["home"]["armed"]["title"] == "Hallo {name}" and options["workflows_report"]["away"][0]["target"] == [LIGHT]
    hass.config_entries.async_update_entry(entry, options={k: v for k, v in entry.options.items() if k not in ("event_notify", "workflows_report")})
    await hass.async_block_till_done()
    assert "event_notify" not in entry.options
    result = await _ws(client, type=f"{DOMAIN}/import", data=exported, dry_run=False)
    assert result["success"], result
    await hass.async_block_till_done()
    assert entry.options["event_notify"]["home"]["armed"]["targets"] == ["notify.handy"] and entry.options["event_notify"]["always"]["sensor_report"]["enabled"] is False
    assert entry.options["workflows_report"]["away"][0]["target"] == [LIGHT]


# ----- Aktionen bei einem stillen Alarm -----


async def _report_setup(hass: HomeAssistant, report: dict[str, list], **options: Any):
    on = async_mock_service(hass, "switch", "turn_on")
    entry, pushes = await _setup(hass, **{"sensor_options": {MOTION: {"report_only": True}}, "workflows": {"away": [act(SIREN)], "home": [act(SIREN)]}, "workflows_report": report, **options})
    return entry, on, pushes


def targets(calls: list[ServiceCall]) -> list[str]:
    return [t for c in calls for t in c.data["entity_id"]]


async def test_silent_alarm_runs_its_actions_and_never_an_alarm(hass: HomeAssistant, freezer) -> None:
    """Der Sensor spricht an: die Aktionen des Modus laufen, die Anlage bleibt scharf, die Sirene des Alarms bleibt aus; der Lauf endet von selbst."""
    entry, on, pushes = await _report_setup(hass, {"away": [act(LIGHT), {"type": "wait", "seconds": 5}, act("switch.zwei")], "home": [act("switch.falsch")]})
    await call(hass, "alarm_arm_away")
    await _report(hass)
    runner = entry.runtime_data.workflow
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY and targets(on) == [LIGHT]
    assert runner.running and runner.running.get("phase") == "report" and runner.running.get("after") is True
    assert len(pushes) == 1  # die Meldung "Stiller Alarm" geht daneben hinaus
    await advance(hass, freezer, 6)
    assert targets(on) == [LIGHT, "switch.zwei"] and runner.running is None
    assert state(hass) == AlarmControlPanelState.ARMED_AWAY and SIREN not in targets(on)


async def test_silent_alarm_actions_at_most_once_per_sensor_and_minute(hass: HomeAssistant, freezer) -> None:
    entry, on, _pushes = await _report_setup(hass, {"away": [act(LIGHT)]})
    await call(hass, "alarm_arm_away")
    for _ in range(3):
        await _report(hass)
        await open_sensor(hass, MOTION, "off")
    assert targets(on) == [LIGHT]
    await advance(hass, freezer, 61)
    await _report(hass)
    assert targets(on) == [LIGHT, LIGHT] and state(hass) == AlarmControlPanelState.ARMED_AWAY


async def test_an_always_active_silent_sensor_runs_the_actions_of_always(hass: HomeAssistant) -> None:
    """Immer aktiver Sensor auf "Stiller Alarm": die Aktionen von "Immer aktiv", auch bei deaktivierter Anlage."""
    entry, on, _pushes = await _report_setup(hass, {"always": [act(LIGHT)], "away": [act("switch.falsch")]}, per_mode_sensors=True,
                                             sensor_options={SMOKE: {"always": True}}, sensor_modes={"always": {SMOKE: {"report_only": True}}})
    await _report(hass, SMOKE)
    assert targets(on) == [LIGHT] and state(hass) == AlarmControlPanelState.DISARMED


async def test_an_alarm_replaces_the_silent_alarm_actions(hass: HomeAssistant, freezer) -> None:
    """Der Alarm hat Vorrang: er bricht die Aktionen des stillen Alarms ab und startet seine eigenen sofort."""
    entry, on, _pushes = await _report_setup(hass, {"away": [{"type": "wait", "seconds": 30}, act("switch.spaet")]})
    await call(hass, "alarm_arm_away")
    await _report(hass)
    runner = entry.runtime_data.workflow
    assert runner.running.get("phase") == "report"
    await open_sensor(hass, WINDOW)
    await settle(hass)
    assert state(hass) == AlarmControlPanelState.TRIGGERED and targets(on) == [SIREN]
    assert runner.running and not runner.running.get("after")
    await advance(hass, freezer, 31)
    assert "switch.spaet" not in targets(on)
    # Im Alarm startet ein stiller Alarm keine Aktionen
    await advance(hass, freezer, 61)
    await open_sensor(hass, MOTION, "off")
    await _report(hass)
    assert targets(on) == [SIREN]
    await call(hass, "alarm_disarm")
    await settle(hass)


async def test_disarming_ends_the_silent_alarm_actions(hass: HomeAssistant, freezer) -> None:
    """Deaktivieren beendet den Lauf sofort: ein Ton wird still, spätere Schritte laufen nicht mehr."""
    hass.states.async_set(PLAYER, "idle")
    await hass.config.async_update(internal_url="http://192.168.1.2:8123")
    async_mock_service(hass, "media_player", "play_media")
    stopped = async_mock_service(hass, "media_player", "media_stop")
    async_mock_service(hass, "media_player", "volume_set")
    chime = {"type": "chime", "players": [PLAYER], "sound": "tone_pip", "duration": 30, "wait": True}
    entry, on, _pushes = await _report_setup(hass, {"away": [chime, act("switch.spaet")]})
    await call(hass, "alarm_arm_away")
    await _report(hass)
    assert entry.runtime_data.workflow.running.get("phase") == "report" and not stopped
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert entry.runtime_data.workflow.running is None and len(stopped) >= 1
    await advance(hass, freezer, 31)
    assert "switch.spaet" not in targets(on)


async def test_the_entry_delay_has_priority_over_a_silent_alarm(hass: HomeAssistant, freezer) -> None:
    """Läuft die Eingangsverzögerung mit ihren Aktionen, startet ein stiller Alarm (immer aktiver Sensor) keine Aktionen und unterbricht sie nicht."""
    entry, on, _pushes = await _report_setup(hass, {"always": [act(LIGHT)]}, per_mode_sensors=True, entry_delay=30,
                                             sensor_options={SMOKE: {"always": True}}, sensor_modes={"always": {SMOKE: {"report_only": True}}},
                                             workflows_entry={"away": [{"type": "wait", "seconds": 20}, act("switch.voralarm")]})
    await call(hass, "alarm_arm_away")
    await open_sensor(hass, FRONT_DOOR)
    await settle(hass)
    runner = entry.runtime_data.workflow
    assert state(hass) == AlarmControlPanelState.PENDING and runner.running.get("phase") == "pending"
    await _report(hass, SMOKE)
    assert runner.running.get("phase") == "pending" and LIGHT not in targets(on)
    await advance(hass, freezer, 21)
    assert "switch.voralarm" in targets(on)  # die Aktionen der Verzögerung liefen ungestört weiter
    await call(hass, "alarm_disarm")
    await settle(hass)


async def test_a_new_silent_alarm_replaces_the_running_one_and_the_arming_tone(hass: HomeAssistant, freezer) -> None:
    """Ein zweiter Sensor: der Lauf beginnt neu (der alte endet). Auch der Aktivierungston vom Scharfschalten weicht."""
    entry, on, _pushes = await _report_setup(hass, {"away": [act(LIGHT), {"type": "wait", "seconds": 30}, act("switch.ende")]},
                                             sensor_options={MOTION: {"report_only": True}, WINDOW: {"report_only": True}},
                                             workflows_armed={"away": [{"type": "wait", "seconds": 50}, act("switch.armed_spaet")]})
    await call(hass, "alarm_arm_away")
    await settle(hass)
    runner = entry.runtime_data.workflow
    assert runner.running.get("phase") == "armed"
    await _report(hass, MOTION)
    assert runner.running.get("phase") == "report" and targets(on) == [LIGHT]
    await advance(hass, freezer, 20)
    await _report(hass, WINDOW)
    assert targets(on) == [LIGHT, LIGHT]
    await advance(hass, freezer, 20)
    assert "switch.ende" not in targets(on)  # der erste Lauf wurde ersetzt: seine 30 Sekunden zählen nicht weiter
    await advance(hass, freezer, 11)
    assert targets(on) == [LIGHT, LIGHT, "switch.ende"] and "switch.armed_spaet" not in targets(on)
    await advance(hass, freezer, 60)
    assert "switch.armed_spaet" not in targets(on)


async def test_a_running_test_has_priority_over_a_silent_alarm(hass: HomeAssistant) -> None:
    """Läuft ein Test der Alarmaktionen, starten die Aktionen eines stillen Alarms nicht: der Test bleibt, bis er endet."""
    entry, on, _pushes = await _report_setup(hass, {"always": [act(LIGHT)]}, per_mode_sensors=True, workflows={"home": [{"type": "wait", "seconds": 5}, act(SIREN)]},
                                             sensor_options={SMOKE: {"always": True}}, sensor_modes={"always": {SMOKE: {"report_only": True}}})
    runner = entry.runtime_data.workflow
    assert await runner.async_run("home", test=True)
    await settle(hass)
    test_run = runner.running
    assert test_run and test_run["test"]
    await _report(hass, SMOKE)
    assert runner.running is test_run and LIGHT not in targets(on)
    assert not await runner.async_run_report("always")
    await runner.async_stop()
    await settle(hass)


async def test_no_silent_alarm_actions_during_an_alarm_without_alarm_actions(hass: HomeAssistant) -> None:
    """Im Alarm starten sie nie, auch wenn der Alarm selbst keine Aktionen hat (dann läuft nichts, das sie sonst abhielte)."""
    entry, on, _pushes = await _report_setup(hass, {"always": [act(LIGHT)], "away": [act(LIGHT)]}, per_mode_sensors=True, workflows={},
                                             sensor_options={SMOKE: {"always": True}}, sensor_modes={"always": {SMOKE: {"report_only": True}}, "away": {MOTION: {"report_only": True}}})
    await call(hass, "alarm_arm_away")
    await open_sensor(hass, WINDOW)
    await settle(hass)
    runner = entry.runtime_data.workflow
    assert state(hass) == AlarmControlPanelState.TRIGGERED
    await _report(hass, SMOKE)
    await _report(hass, MOTION)
    assert LIGHT not in targets(on) and not (runner.running or {}).get("phase") == "report"
    assert not await runner.async_run_report("always") and not await runner.async_run_report("away")
    await call(hass, "alarm_disarm")
    await settle(hass)


async def test_the_actions_of_a_mode_only_run_while_that_mode_is_armed(hass: HomeAssistant) -> None:
    """Die Aktionen eines Modus gelten nur, solange die Anlage in diesem Modus scharf ist; die von "Immer aktiv" auch deaktiviert."""
    entry, on, _pushes = await _report_setup(hass, {"away": [act(LIGHT)], "home": [act("switch.home")], "always": [act("switch.immer")]})
    runner = entry.runtime_data.workflow
    assert not await runner.async_run_report("away") and not await runner.async_run_report("home")  # deaktiviert
    assert not await runner.async_run_report(None) and not await runner.async_run_report("gibt_es_nicht")
    await call(hass, "alarm_arm_home")
    await settle(hass)
    assert not await runner.async_run_report("away") and not on
    assert await runner.async_run_report("home")
    await settle(hass)
    assert targets(on) == ["switch.home"]
    assert await runner.async_run_report("always")
    await settle(hass)
    assert targets(on) == ["switch.home", "switch.immer"]
    await call(hass, "alarm_disarm")
    await settle(hass)


# ----- Abschlussmeldung ausschaltbar wie die anderen festen Meldungen (1.63.0, Entscheid des Nutzers vom 2026-11-17) -----


@pytest.mark.parametrize("how", ["deaktivieren", "quittieren"])
async def test_a_switched_off_closing_message_sends_nothing(hass: HomeAssistant, how: str) -> None:
    """Aus: weder "Alarm beendet" noch stattdessen "Deaktiviert"; die Alarmmeldung bleibt auf dem Handy. Der Modus ohne "aus" meldet wie bisher."""
    entry, pushes = await _setup(hass, event_notify={"home": {"disarmed": notice(True)}, "away": {"disarmed": notice(True)}},
                                 workflow_end={"home": {"send": False, "notify": {"enabled": True, "title": "Eigener Text"}}})
    for mode, expected in (("alarm_arm_home", []), ("alarm_arm_away", ["✅ Alarm ended: Haus"])):
        await call(hass, mode)
        await open_sensor(hass, WINDOW)
        await settle(hass)
        assert state(hass) == AlarmControlPanelState.TRIGGERED
        pushes.clear()
        if how == "deaktivieren":
            await call(hass, "alarm_disarm")
        else:
            assert entry.runtime_data.controller.acknowledge("Anna") is True
        await settle(hass)
        assert [p.data["title"] for p in pushes] == expected, mode
        await open_sensor(hass, WINDOW, "off")
        await call(hass, "alarm_disarm")
        await settle(hass)


async def test_without_the_new_value_the_closing_message_goes_out_as_before(hass: HomeAssistant) -> None:
    """Das Update ändert nichts: ein gespeicherter Wert ohne "send" (auch "notify.enabled: false" aus früheren Versionen) heisst "senden"."""
    _entry, pushes = await _setup(hass, workflow_end={"home": {"notify": {"enabled": False, "title": "alt"}}})
    await call(hass, "alarm_arm_home")
    await open_sensor(hass, WINDOW)
    await settle(hass)
    pushes.clear()
    await call(hass, "alarm_disarm")
    await settle(hass)
    assert [p.data["title"] for p in pushes] == ["✅ Alarm ended: Haus"]


async def test_switching_the_closing_message_off_keeps_its_own_text(hass: HomeAssistant, hass_ws_client) -> None:
    """Speichern: "aus" bleibt stehen, die eigenen Werte auch (wer wieder einschaltet, findet seinen Text); "an" wird nicht gespeichert."""
    entry, _pushes = await _setup(hass)
    client = await hass_ws_client(hass)
    own = {"enabled": True, "title": "Ruhe", "message": "", "critical": None, "volume": None, "click": "log", "click_path": ""}
    result = await _ws(client, type=f"{DOMAIN}/save_workflows", entry_id=entry.entry_id, workflows={}, workflow_end={"home": {"notify": own, "send": False}, "away": {"send": True}})
    assert result["success"], result
    await hass.async_block_till_done()
    assert entry.options["workflow_end"]["home"]["send"] is False and entry.options["workflow_end"]["home"]["notify"]["title"] == "Ruhe"
    assert "away" not in entry.options["workflow_end"]
    client2 = await hass_ws_client(hass)
    shown = (await _ws(client2, type=f"{DOMAIN}/data"))["result"]["systems"][0]["workflow_end"]
    assert shown["home"]["send"] is False
    for bad in ({"home": {"send": "nein"}}, {"home": {"send": 0}}):
        with pytest.raises(vol.Invalid):
            SYSTEM_OPTIONS_SCHEMA({"workflow_end": bad})
        assert not (await _ws(client2, type=f"{DOMAIN}/save_workflows", entry_id=entry.entry_id, workflows={}, workflow_end=bad))["success"]
    # Sicherung: "aus" geht mit und kommt zurück
    exported = (await _ws(client2, type=f"{DOMAIN}/export"))["result"]
    assert exported["systems"][0]["options"]["workflow_end"]["home"]["send"] is False
    hass.config_entries.async_update_entry(entry, options={k: v for k, v in entry.options.items() if k != "workflow_end"})
    await hass.async_block_till_done()
    assert (await _ws(client2, type=f"{DOMAIN}/import", data=exported, dry_run=False))["success"]
    await hass.async_block_till_done()
    assert entry.options["workflow_end"]["home"]["send"] is False
