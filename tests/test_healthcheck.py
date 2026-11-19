"""
HealthCheck (1.65.0, Wunsch und Entscheide des Nutzers 2026-11-18): Lebenszeichen an externe Dienste, generisch (URL, Fehler-Zusatz, Abstand; keine
Auswahl des Anbieters), bis zu fünf, für alle Anlagen, je mit eigenem Abstand (1 Minute bis 24 Stunden). "In Ordnung" oder, solange der Selbsttest
Probleme hat, "Fehler"; Testknöpfe "OK senden" und "Fehler senden". Die URL steht ganz im Panel und im Backup (Entscheid des Nutzers), nie im Log.
Ein Lebenszeichen hält nie etwas auf.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_fire_time_changed
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker, AiohttpClientMockResponse

from custom_components.alarmageddon import backup
from custom_components.alarmageddon import selftest as st
from custom_components.alarmageddon.const import (
    DATA_HEALTHCHECK,
    DATA_SELFTEST,
    DATA_SETTINGS,
    DOMAIN,
    HEALTHCHECK_MIN_GAP,
    HEALTHCHECK_START_DELAY,
    HEALTHCHECK_STORE_KEY,
    HEALTHCHECK_TIMEOUT,
    MAX_HEALTHCHECKS,
)
from custom_components.alarmageddon.healthcheck import fail_url, host_of
from custom_components.alarmageddon.settings import valid_fail_suffix, valid_healthchecks

from .conftest import ALARM, setup_alarm
from .test_alarm import call

# Erfundene Kennungen (nie eine echte URL eines Nutzers in Tests)
HC = "https://hc-ping.com/00000000-1111-2222-3333-444444444444"
BS = "https://uptime.betterstack.com/api/v1/heartbeat/abcdefABCDEF123456"
CR = "https://cronitor.link/p/0123456789abcdef/alarmanlage"


async def ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def advance(hass: HomeAssistant, freezer, seconds: float) -> None:
    """Zeit vorstellen; Lebenszeichen laufen als Hintergrundaufgaben (async_block_till_done wartet sonst nicht auf sie)."""
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)


async def add(client, **values: Any) -> dict[str, Any]:
    return await ws(client, type=f"{DOMAIN}/healthcheck_save", **{"name": "Haus", "url": HC, "fail_suffix": "/fail", "interval": 300, **values})


def calls(aioclient_mock: AiohttpClientMocker) -> list[str]:
    return [str(url) for _method, url, _data, _headers in aioclient_mock.mock_calls]


# ----- Werte -----


def test_values_are_checked_one_by_one() -> None:
    """Höchstens fünf, nur http oder https, Abstand 1 Minute bis 24 Stunden; ein kaputter Eintrag fällt einzeln weg, ein kaputter Zusatz wird leer."""
    items = [{"id": f"a{i}", "url": HC, "fail_suffix": "/fail", "interval": 300} for i in range(7)]
    assert len(valid_healthchecks(items)) == MAX_HEALTHCHECKS
    out = valid_healthchecks([
        {"id": "ok", "url": f" {BS} ", "interval": 5, "fail_suffix": " /fail "},
        {"id": "ftp", "url": "ftp://hc-ping.com/x", "interval": 300},
        {"id": "js", "url": "javascript:alert(1)", "interval": 300},
        {"id": "leer", "url": "https://", "interval": 300},
        {"id": "ok", "url": HC, "interval": 300},  # doppelt
        {"id": "Gross!", "url": HC, "interval": 300},
        {"id": "lang", "url": "http://192.168.1.5:8000/ping/x", "interval": 999999, "fail_suffix": "fail"},
        "kein Wörterbuch",
    ])
    # Ohne Namen (Einträge aus 1.65.0) heisst ein Eintrag wie sein Rechner
    assert out == [
        {"id": "ok", "name": "uptime.betterstack.com", "url": BS, "fail_suffix": "/fail", "interval": 60},
        {"id": "lang", "name": "192.168.1.5", "url": "http://192.168.1.5:8000/ping/x", "fail_suffix": "", "interval": 86400},
    ]
    # Unbekannte Felder (etwa ein zweites Intervall) fallen weg
    named = valid_healthchecks([{"id": "a", "name": "  Haus \n  Büro ", "url": HC, "interval": 3600, "interval_armed": 30},
                                {"id": "b", "name": "x" * 61, "url": HC, "interval": 3600}])
    assert named == [{"id": "a", "name": "Haus Büro", "url": HC, "fail_suffix": "", "interval": 3600},
                     {"id": "b", "name": "hc-ping.com", "url": HC, "fail_suffix": "", "interval": 3600}]


@pytest.mark.parametrize(("url", "suffix", "expected"), [
    (HC, "/fail", f"{HC}/fail"),  # Healthchecks.io
    (f"{HC}/", "/fail", f"{HC}/fail"),
    ("https://hc.example.com/ping/abc?rid=1", "/fail", "https://hc.example.com/ping/abc/fail?rid=1"),  # selbst gehostet, mit Parameter
    (HC, "/1", f"{HC}/1"),  # Healthchecks.io: Exit-Code
    (BS, "/fail", f"{BS}/fail"),  # Better Stack
    (CR, "?state=fail", f"{CR}?state=fail"),  # Cronitor
    (f"{CR}?env=prod&state=complete", "?state=fail", f"{CR}?env=prod&state=fail"),  # gleichnamiger Parameter ersetzt
    (f"{CR}?env=prod", "&state=fail", f"{CR}?env=prod&state=fail"),
    ("https://kuma.example.net/api/push/abc?status=up&msg=OK&ping=", "?status=down", "https://kuma.example.net/api/push/abc?msg=OK&ping=&status=down"),
    (HC, "", None),
    (HC, "fail", None),
    (HC, "?", None),
])
def test_the_failure_address_from_url_and_suffix(url: str, suffix: str, expected: str | None) -> None:
    """Generisch (Entscheid des Nutzers): "/…" an den Pfad, "?…" setzt Parameter und ersetzt gleichnamige; ohne Zusatz kein Fehler."""
    assert fail_url({"url": url, "fail_suffix": suffix}) == expected


def test_only_a_valid_suffix_is_accepted() -> None:
    assert valid_fail_suffix(HC, "") == "" and valid_fail_suffix(HC, None) == ""
    assert valid_fail_suffix(HC, " /fail ") == "/fail"
    assert valid_fail_suffix(HC, "fail") is None
    assert valid_fail_suffix(HC, "/ f") is None
    assert valid_fail_suffix(HC, "/" + "x" * 300) is None


def test_only_the_host_is_named() -> None:
    assert host_of(HC) == "hc-ping.com" and host_of(BS) == "uptime.betterstack.com"


# ----- Senden -----


async def test_pings_after_the_start_and_in_its_interval(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    saved = await add(client, interval=120)
    assert saved["success"], saved
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC]  # gleich nach dem Speichern
    status = hass.data[DATA_HEALTHCHECK].status[saved["result"]["id"]]
    assert status["sent"] == "ok" and status["result"] == "ok" and status["code"] == 200
    await advance(hass, freezer, 121)
    assert calls(aioclient_mock) == [HC, HC]
    # Panel: Eintrag mit der ganzen URL (Entscheid des Nutzers) und dem letzten Ergebnis
    data = (await ws(client, type=f"{DOMAIN}/data"))["result"]
    assert data["healthcheck_max"] == MAX_HEALTHCHECKS
    assert data["healthchecks"][0]["url"] == HC and data["healthchecks"][0]["status"]["result"] == "ok"


async def test_problems_of_the_selftest_send_a_failure_at_once(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Lebenszeichen + Fehler (Entscheid des Nutzers): mit Problemen die Fehler-URL; ein Wechsel geht sofort hinaus, höchstens einmal je Minute."""
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(f"{HC}/fail", status=200)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await add(client, interval=3600)
    await advance(hass, freezer, 2)
    await advance(hass, freezer, HEALTHCHECK_MIN_GAP + 5)
    assert calls(aioclient_mock) == [HC]
    st.async_note(hass, None, "backup_failed", "auto")
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC, f"{HC}/fail"]
    st.async_resolve(hass, None, "backup_failed", "auto")
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC, f"{HC}/fail"], "nicht öfter als einmal je Minute"
    await advance(hass, freezer, HEALTHCHECK_MIN_GAP)
    assert calls(aioclient_mock) == [HC, f"{HC}/fail", HC], "danach das Lebenszeichen in Ordnung"


async def test_a_regular_life_sign_replaces_a_deferred_one(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Ein Wechsel des Selbsttests kurz nach einem Lebenszeichen wartet die Minute ab; geht vorher eines regulär hinaus, entfällt das aufgeschobene."""
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(f"{HC}/fail", status=200)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    hid = (await add(client, interval=60))["result"]["id"]
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC]
    # Ein Befund, den in dieser Zeit nichts aufhebt (das automatische Backup nach dem Start hebt "backup_failed" auf)
    st.async_note(hass, None, "notify_failed", "notify.altes_handy", service="notify.altes_handy", reason="error")
    hass.data[DATA_SELFTEST]._flush()
    healthcheck = hass.data[DATA_HEALTHCHECK]
    assert hid in healthcheck._later, "aufgeschoben: das letzte Lebenszeichen ist keine Minute her"
    healthcheck.async_ping(hid)  # regulär, wie der Takt: zeigt den aktuellen Stand
    assert hid not in healthcheck._later
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC, f"{HC}/fail"]
    await advance(hass, freezer, 58)
    assert calls(aioclient_mock) == [HC, f"{HC}/fail", f"{HC}/fail"], "danach nur das fällige im Abstand"


async def test_arming_does_not_change_the_interval(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """
    Entscheid des Nutzers 2026-11-19: kein eigenes Intervall bei scharfer Anlage (nur der Selbsttest prüft dann öfter; findet er etwas, geht der
    Fehler sofort hinaus). Ein zweites Intervall nimmt der Server nicht an.
    """
    aioclient_mock.get(HC, status=200)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    assert (await add(client, interval=3600, interval_armed=60))["success"] is False
    saved = await add(client, interval=300)
    assert "interval_armed" not in saved["result"]["healthchecks"][0]
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC]
    await call(hass, "alarm_arm_home")
    assert hass.states.get(ALARM).state == "armed_home"
    await advance(hass, freezer, 280)
    assert calls(aioclient_mock) == [HC], "scharf: weiter alle 5 Minuten, nicht öfter"
    await advance(hass, freezer, 30)
    assert calls(aioclient_mock) == [HC, HC]


async def test_a_service_without_failure_address_only_sends_the_heartbeat(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    url = "https://x.example/ok"
    aioclient_mock.get(url, status=200)
    await setup_alarm(hass)
    st.async_note(hass, None, "backup_failed", "auto")
    client = await hass_ws_client(hass)
    saved = await add(client, url=url, fail_suffix="")
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [url]
    assert hass.data[DATA_HEALTHCHECK].status[saved["result"]["id"]]["sent"] == "ok"


@pytest.mark.parametrize(("kind", "result"), [("http", "http"), ("error", "error"), ("timeout", "timeout")])
async def test_a_failing_heartbeat_is_a_problem_until_one_works(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker, caplog, kind: str, result: str) -> None:
    """Ein gescheitertes Lebenszeichen hält der Selbsttest fest (nur der Rechnername, nie die URL im Log); das nächste, das klappt, hebt es auf."""
    caplog.set_level(logging.DEBUG)
    if kind == "http":
        aioclient_mock.get(HC, status=500)
    elif kind == "error":
        aioclient_mock.get(HC, exc=OSError(f"keine Verbindung zu {HC}"))
    else:
        aioclient_mock.get(HC, exc=TimeoutError())
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    saved = await add(client)
    await advance(hass, freezer, 2)
    hid = saved["result"]["id"]
    problem = next(p for p in hass.data[DATA_SELFTEST].problems() if p["code"] == "ping_failed")
    assert problem["subject"] == hid and problem["service"] == "hc-ping.com" and problem["reason"] == result
    assert problem["places"] == [{"area": "healthcheck", "id": hid}]
    assert (problem["label"] == "500") == (kind == "http")
    own_log = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("custom_components.alarmageddon"))
    assert "hc-ping.com" in own_log and "00000000-1111" not in own_log
    # Ein gescheitertes Lebenszeichen zählt nicht als Problem für das nächste (es liesse sich so nicht melden)
    assert hass.data[DATA_HEALTHCHECK].failing() is False
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    result_ping = await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind="ok")
    assert result_ping["success"] and result_ping["result"]["status"] == {**result_ping["result"]["status"], "result": "ok", "sent": "ok", "test": True}
    assert [p for p in hass.data[DATA_SELFTEST].problems() if p["code"] == "ping_failed"] == []


async def test_a_hanging_service_never_holds_anything_up(hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker, monkeypatch) -> None:
    """Ein Dienst, der nie antwortet: das Lebenszeichen endet nach seiner Zeitgrenze als "keine Antwort", Speichern und Selbsttest warten nicht."""
    monkeypatch.setattr("custom_components.alarmageddon.healthcheck.HEALTHCHECK_TIMEOUT", 0.2)

    async def hang(*_args) -> AiohttpClientMockResponse:
        await asyncio.sleep(30)
        raise AssertionError("nie erreicht")

    aioclient_mock.get(HC, side_effect=hang)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    saved = await asyncio.wait_for(add(client), 2)
    assert saved["success"]
    hass.data[DATA_SELFTEST].async_run()  # läuft, ohne zu warten
    result = await asyncio.wait_for(ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=saved["result"]["id"], kind="ok"), 2)
    assert result["result"]["status"]["result"] == "timeout"
    assert HEALTHCHECK_TIMEOUT == 10


# ----- Verwalten -----


async def test_save_edit_delete_and_limits(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(BS, status=200)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    bad = await add(client, url="hc-ping.com/ohne-schema")
    assert bad["success"] is False and bad["error"]["code"] == "invalid_url"
    bad = await add(client, url="https://x.example/ok", fail_suffix="fail")
    assert bad["error"]["code"] == "invalid_suffix"
    assert (await add(client, interval=59))["success"] is False
    assert (await add(client, interval=86401))["success"] is False
    ids = [(await add(client))["result"]["id"] for _ in range(MAX_HEALTHCHECKS)]
    too_many = await add(client)
    assert too_many["success"] is False and too_many["error"]["code"] == "too_many"
    edited = await add(client, check_id=ids[0], url=BS, fail_suffix="/fail", interval=86400)
    first = {k: v for k, v in edited["result"]["healthchecks"][0].items() if k not in ("status", "log")}
    assert edited["success"] and first == {"id": ids[0], "name": "Haus", "url": BS, "fail_suffix": "/fail", "interval": 86400}
    # Name ist Pflicht (Wunsch des Nutzers 2026-11-19)
    for bad_name in ("", "   ", "x" * 61):
        assert (await add(client, check_id=ids[0], name=bad_name))["error"]["code"] in ("invalid_name", "invalid_format")
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_save", url=HC, fail_suffix="", interval=300))["success"] is False
    assert (await add(client, check_id="gibtsnicht"))["error"]["code"] == "not_found"
    await advance(hass, freezer, 2)
    deleted = await ws(client, type=f"{DOMAIN}/healthcheck_delete", check_id=ids[0])
    assert deleted["success"] and [i["id"] for i in deleted["result"]["healthchecks"]] == ids[1:]
    assert ids[0] not in hass.data[DATA_HEALTHCHECK].status
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_delete", check_id=ids[0]))["error"]["code"] == "not_found"
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=ids[0], kind="ok"))["error"]["code"] == "not_found"
    # Gelöscht: sein Zeitgeber ruft nie mehr
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    await advance(hass, freezer, 86400)
    assert BS not in calls(aioclient_mock)
    assert hass.data[DATA_SETTINGS].healthchecks == [i for i in hass.data[DATA_SETTINGS].healthchecks if i["id"] != ids[0]]


async def test_removing_a_service_clears_its_failed_life_sign(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Ein entfernter Dienst lässt keinen Befund zurück, der sich nie mehr aufheben liesse (kein Lebenszeichen mehr, das klappen könnte)."""
    aioclient_mock.get(HC, status=404)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    hid = (await add(client))["result"]["id"]
    await advance(hass, freezer, 2)
    assert [p["subject"] for p in hass.data[DATA_SELFTEST].problems() if p["code"] == "ping_failed"] == [hid]
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_delete", check_id=hid))["success"]
    assert [p for p in hass.data[DATA_SELFTEST].problems() if p["code"] == "ping_failed"] == []


async def test_the_first_ping_after_a_restart_waits_a_little(hass: HomeAssistant, freezer, hass_storage, aioclient_mock: AiohttpClientMocker) -> None:
    """Gespeicherte Einträge senden nach dem Start (HEALTHCHECK_START_DELAY), das letzte Ergebnis kommt aus der Ablage."""
    aioclient_mock.get(HC, status=200)
    hass_storage["alarmageddon.settings"] = {"version": 1, "key": "alarmageddon.settings", "data": {"healthchecks": [{"id": "abc", "url": HC, "fail_suffix": "/fail", "interval": 600}]}}
    hass_storage[HEALTHCHECK_STORE_KEY] = {"version": 1, "key": HEALTHCHECK_STORE_KEY, "data": {"status": {
        "abc": {"at": "2026-11-18T10:00:00+00:00", "sent": "ok", "result": "http", "code": 503}, "kaputt": {"at": "nie"}}}}
    await setup_alarm(hass)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    assert healthcheck.status == {"abc": {"at": "2026-11-18T10:00:00+00:00", "sent": "ok", "result": "http", "code": 503, "test": False}}
    await advance(hass, freezer, HEALTHCHECK_START_DELAY - 5)
    assert calls(aioclient_mock) == []
    await advance(hass, freezer, 10)
    assert calls(aioclient_mock) == [HC]


async def test_health_checks_are_part_of_the_backup(hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Entscheid des Nutzers: die Einträge mit ihren URLs gehören ins Backup; ein älteres Backup ohne sie lässt sie, wie sie sind."""
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(BS, status=200)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await add(client)
    exported = await backup.async_export(hass, "1.65.0")
    assert exported["settings"]["healthchecks"][0]["url"] == HC
    restored = backup.validate({**exported, "settings": {**exported["settings"], "healthchecks": [{"id": "neu", "url": BS, "fail_suffix": "/fail", "interval": 60}]}}, hass)
    await backup.async_restore(hass, restored)
    await hass.async_block_till_done()
    assert [i["url"] for i in hass.data[DATA_SETTINGS].healthchecks] == [BS]
    old = backup.validate({**exported, "settings": {k: v for k, v in exported["settings"].items() if k != "healthchecks"}}, hass)
    assert old["healthchecks"] is None
    await backup.async_restore(hass, old)
    await hass.async_block_till_done()
    assert [i["url"] for i in hass.data[DATA_SETTINGS].healthchecks] == [BS]


async def test_removing_the_last_system_stops_and_removes_everything(hass: HomeAssistant, hass_storage, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    entry = await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await add(client)
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert DATA_HEALTHCHECK not in hass.data and HEALTHCHECK_STORE_KEY not in hass_storage


async def test_the_test_buttons_send_exactly_ok_or_failure(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Wunsch des Nutzers: je Eintrag "Fehler senden" (auch ohne Probleme) und "OK senden" (auch mit Problemen); ohne Zusatz kein Fehlertest."""
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(f"{HC}/fail", status=200)
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    hid = (await add(client))["result"]["id"]
    await advance(hass, freezer, 2)
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(f"{HC}/fail", status=200)
    fail = await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind="fail")
    assert fail["result"]["status"]["sent"] == "fail" and fail["result"]["status"]["test"] is True
    st.async_note(hass, None, "backup_failed", "auto")
    ok = await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind="ok")
    assert ok["result"]["status"]["sent"] == "ok"
    assert calls(aioclient_mock)[:2] == [f"{HC}/fail", HC]
    plain = (await add(client, url="https://x.example/ok", fail_suffix=""))["result"]["id"]
    refused = await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=plain, kind="fail")
    assert refused["success"] is False and refused["error"]["code"] == "not_found"
