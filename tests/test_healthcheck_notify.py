"""
Meldungen der HealthCheck-Dienste (1.68.0, Wunsch des Nutzers 2026-11-19, 18:42 und 18:43): "Dienst antwortet nicht" nach der eingestellten Zahl
gescheiterter Aufrufe hintereinander (jeder automatische Aufruf, nie der Testknopf), "Dienst antwortet wieder" beim ersten, der danach klappt, und nur, wenn
"antwortet nicht" hinausging. Nie die URL in einer Meldung. Ein gescheitertes Lebenszeichen geht nicht mehr über die Meldung "Selbsttest" hinaus (bleibt
dort ein Problem).

Seit 1.69.0 (Wunsch des Nutzers 2026-11-19, 22:16/22:17) eine Wartungsmeldung wie der Selbsttest ("types"/"healthcheck": an/aus, Empfänger, Kritisch,
Lautstärke, stehen lassen; fester Text), dazu "healthcheck_fails" und "healthcheck_up" ("Melden, wenn er wieder antwortet"). "Antwortet wieder" ist nie
kritisch. Einstellungen aus 1.68.0 (zwei feste Meldungen unter "healthcheck") werden übernommen.
"""

from __future__ import annotations

import json
from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.alarmageddon import selftest as st
from custom_components.alarmageddon.const import DATA_HEALTHCHECK, DATA_SELFTEST, DATA_SETTINGS, DEFAULT_NOTIFY, DOMAIN
from custom_components.alarmageddon.settings import valid_notify

from .conftest import setup_alarm
from .test_healthcheck import HC, add, advance, ws


async def settings_hc(hass: HomeAssistant, kind: dict[str, Any] | None = None, **values: Any) -> None:
    """Wartungsmeldung "healthcheck" (`kind`) und die Werte "healthcheck_fails", "healthcheck_up" ändern; Wartung an notify.handy."""
    settings = hass.data[DATA_SETTINGS]
    types = {**settings.notify["types"], "healthcheck": {**settings.notify["types"]["healthcheck"], **(kind or {})}}
    await settings.async_set_notify({**settings.notify, "maintenance_targets": ["notify.handy"], "types": types,
                                     **{f"healthcheck_{k}": v for k, v in values.items()}})


def texts(calls: list) -> list[tuple[str, str]]:
    return [(c.data["title"], c.data["message"]) for c in calls]


async def start(hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker, status: int = 500, kind: dict[str, Any] | None = None, **values: Any):
    aioclient_mock.get(HC, status=status)
    sent = async_mock_service(hass, "notify", "handy")
    await setup_alarm(hass)
    await settings_hc(hass, kind, **values)
    client = await hass_ws_client(hass)
    hid = (await add(client, interval=60))["result"]["id"]
    return client, hid, sent


async def recover(hass: HomeAssistant, freezer, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    await advance(hass, freezer, 61)


async def test_down_after_the_set_number_once_and_up_after_recovery(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock)
    await advance(hass, freezer, 2)  # erster gescheiterter Aufruf (gleich nach dem Speichern)
    assert sent == []
    await advance(hass, freezer, 61)  # zweiter: Standard 2
    assert len(sent) == 1
    title, message = texts(sent)[0]
    assert title == "⚠️ Health check \"Haus\" is not answering" and "Calls to hc-ping.com" in message and "failed attempts: 2" in message and "HTTP 500" in message
    assert sent[0].data["data"]["url"] == "/alarmageddon?view=healthcheck" and "push" not in sent[0].data["data"]
    assert sent[0].data["data"]["group"] == "alarmageddon_maintenance" and sent[0].data["data"]["tag"] == f"alarmageddon_hc_{hid}"
    for _ in range(3):  # weitere Ausfälle: keine weitere Meldung
        await advance(hass, freezer, 61)
    assert len(sent) == 1
    await recover(hass, freezer, aioclient_mock)
    assert len(sent) == 2 and texts(sent)[1][0] == "✅ Health check \"Haus\" answers again" and "failed attempts: 5" in texts(sent)[1][1]
    assert sent[1].data["data"]["tag"] == f"alarmageddon_hc_{hid}"  # ersetzt "antwortet nicht" auf dem Handy
    await advance(hass, freezer, 61)
    assert len(sent) == 2
    # Nie die URL (das Geheimnis des Dienstes), auch nicht ihr Pfad
    assert all("00000000-1111" not in str(c.data) for c in sent)


async def test_set_number_test_button_and_switch(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Eine Meldung schon nach dem ersten Ausfall, wenn so eingestellt; der Testknopf zählt nie; ausgeschaltet kommt auch kein "wieder"."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, kind={"enabled": False}, fails=1)
    await advance(hass, freezer, 2)
    for _ in range(2):
        assert (await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind="ok"))["success"]
    assert sent == [] and hass.data[DATA_HEALTHCHECK]._fails[hid] == 1  # die Tests zählen nicht mit
    await recover(hass, freezer, aioclient_mock)
    assert sent == []  # "antwortet nicht" ging nie hinaus, darum kein "antwortet wieder"
    await settings_hc(hass, {"enabled": True})
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, exc=TimeoutError())
    await advance(hass, freezer, 61)
    assert len(sent) == 1 and "no answer" in texts(sent)[0][1]


async def test_no_answer_again_without_a_message_before(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Ein Ausfall unter der eingestellten Zahl meldet nichts, also auch kein "antwortet wieder", wenn der Dienst danach antwortet."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=3)
    await advance(hass, freezer, 2)
    await advance(hass, freezer, 61)
    assert sent == [] and hass.data[DATA_HEALTHCHECK]._fails[hid] == 2
    await recover(hass, freezer, aioclient_mock)
    assert sent == [] and hid not in hass.data[DATA_HEALTHCHECK]._fails


async def test_switched_on_during_an_outage(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Ausgeschaltet zählt ein Ausfall nie als gemeldet: wer mitten im Ausfall einschaltet, bekommt beim nächsten Ausfall "antwortet nicht"."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, kind={"enabled": False}, fails=1)
    await advance(hass, freezer, 2)
    assert sent == [] and hid not in hass.data[DATA_HEALTHCHECK]._down
    await settings_hc(hass, {"enabled": True})
    await advance(hass, freezer, 61)
    assert len(sent) == 1 and "is not answering" in texts(sent)[0][0]


async def test_switched_off_after_the_message_sends_no_answer_again(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Wer nach "antwortet nicht" ausschaltet, bekommt auch kein "antwortet wieder" (aus heisst: keine Meldung dieser Art)."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=1)
    await advance(hass, freezer, 2)
    assert len(sent) == 1
    await settings_hc(hass, {"enabled": False})
    await recover(hass, freezer, aioclient_mock)
    assert len(sent) == 1


async def test_up_switch(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """"Melden, wenn er wieder antwortet" aus: nur "antwortet nicht"; danach gilt der Ausfall als beendet (ein neuer meldet wieder)."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=1, up=False)
    await advance(hass, freezer, 2)
    assert len(sent) == 1
    await recover(hass, freezer, aioclient_mock)
    assert len(sent) == 1 and hid not in hass.data[DATA_HEALTHCHECK]._down
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=503)
    await advance(hass, freezer, 61)
    assert len(sent) == 2 and "HTTP 503" in texts(sent)[1][1]


async def test_critical_recipients_and_persistent(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Empfänger, Kritisch, Lautstärke und "stehen lassen" wie jede Wartungsmeldung; "antwortet wieder" nie kritisch, ersetzt die Glocke."""
    other = async_mock_service(hass, "notify", "tablet")
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, kind={"critical": True, "volume": 0.4, "targets": ["notify.tablet"], "persistent": True}, fails=1)
    await advance(hass, freezer, 2)
    assert sent == [] and len(other) == 1
    data = other[0].data
    assert data["title"] == "⚠️ Health check \"Haus\" is not answering"
    assert data["data"]["push"]["sound"]["volume"] == 0.4 and data["data"]["push"]["interruption-level"] == "critical"
    bell = hass.states.get(f"persistent_notification.alarmageddon_hc_{hid}")
    assert bell is None or "00000000" not in str(bell.attributes)
    await recover(hass, freezer, aioclient_mock)
    assert len(other) == 2 and "push" not in other[1].data["data"] and "answers again" in other[1].data["title"]


async def test_restart_during_an_outage_does_not_repeat(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=1)
    await advance(hass, freezer, 2)
    assert len(sent) == 1
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.data[DATA_HEALTHCHECK]._down == {hid}
    await advance(hass, freezer, 61)
    await advance(hass, freezer, 61)
    assert len(sent) == 1
    await recover(hass, freezer, aioclient_mock)
    assert len(sent) == 2 and "answers again" in texts(sent)[1][0]


async def test_selftest_message_no_longer_repeats_a_failed_life_sign(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Das Problem bleibt im Selbsttest; seine Meldung nennt es nicht mehr (dafür gibt es "antwortet nicht")."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=5)
    await advance(hass, freezer, 2)
    assert any(p["code"] == "ping_failed" for p in hass.data[DATA_SELFTEST].problems())
    hass.data[DATA_SELFTEST]._report()
    await hass.async_block_till_done()
    assert sent == []
    st.async_note(hass, None, "backup_failed", "auto")
    hass.data[DATA_SELFTEST]._report()
    await hass.async_block_till_done()
    assert len(sent) == 1 and "health check" not in sent[0].data["message"].lower()


async def test_test_message_like_every_maintenance_message(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Testmeldung über den gewohnten Knopf der Wartungsmeldungen ("test_notify"), mit den gespeicherten Einstellungen der Art."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, status=200)
    answer = await ws(client, type=f"{DOMAIN}/test_notify", kind="healthcheck")
    assert answer["success"] and answer["result"]["targets"] == ["notify.handy"]
    assert "HealthCheck service not answering" in sent[-1].data["title"] and sent[-1].data["data"]["group"] == "alarmageddon_maintenance"
    # Den eigenen Befehl aus 1.68.0 gibt es nicht mehr
    assert (await ws(client, type=f"{DOMAIN}/test_healthcheck_notify", kind="hc_down", notice={}))["error"]["code"] == "unknown_command"


def test_settings_are_checked_and_taken_over_from_1_68() -> None:
    assert DEFAULT_NOTIFY["types"]["healthcheck"] == {"enabled": True, "critical": False, "volume": 0.8, "persistent": False, "targets": []}
    assert DEFAULT_NOTIFY["healthcheck_fails"] == 2 and DEFAULT_NOTIFY["healthcheck_up"] is True and "healthcheck" not in DEFAULT_NOTIFY
    out = valid_notify({"healthcheck_fails": 99, "healthcheck_up": "ja"})
    assert out["healthcheck_fails"] == 10 and out["healthcheck_up"] is True
    assert valid_notify({"healthcheck_fails": 0})["healthcheck_fails"] == 1
    # Form aus 1.68.0: an/aus, Empfänger, Kritisch, Lautstärke und "stehen lassen" von "antwortet nicht", die Zahl, an/aus von "antwortet wieder";
    # eigene Texte und Klickziel fallen weg
    old = {"healthcheck": {"fails": 4, "hc_down": {"enabled": False, "title": "{name} weg", "message": "x", "critical": True, "volume": 0.3, "persistent": True,
                                                   "click": "custom", "click_path": "/lovelace/0", "targets": ["notify.tablet"]},
                           "hc_up": {"enabled": False, "title": "", "message": "", "critical": True}}}
    out = valid_notify(old)
    assert out["types"]["healthcheck"] == {"enabled": False, "critical": True, "volume": 0.3, "persistent": True, "targets": ["notify.tablet"]}
    assert out["healthcheck_fails"] == 4 and out["healthcheck_up"] is False and "healthcheck" not in out and "weg" not in json.dumps(out)
    # Steht die neue Form schon da, gewinnt sie
    assert valid_notify({**old, "types": {"healthcheck": {"enabled": True}}, "healthcheck_fails": 3})["types"]["healthcheck"]["enabled"] is True
    assert valid_notify({**old, "healthcheck_fails": 3})["healthcheck_fails"] == 3
    # Kaputte alte Form: der Standard gilt (im Zweifel melden)
    assert valid_notify({"healthcheck": {"fails": "viele", "hc_down": "an"}})["types"]["healthcheck"]["enabled"] is True


async def test_saved_with_the_notifications_and_in_the_backup(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    current = hass.data[DATA_SETTINGS].notify
    saved = await ws(client, type=f"{DOMAIN}/save_notify", notify={"healthcheck_fails": 4, "healthcheck_up": False, "types": {"healthcheck": {"critical": True}}})
    assert saved["success"] and saved["result"]["notify"]["healthcheck_fails"] == 4 and saved["result"]["notify"]["healthcheck_up"] is False
    assert saved["result"]["notify"]["types"]["healthcheck"]["critical"] is True and saved["result"]["notify"]["types"]["selftest"] == current["types"]["selftest"]
    exported = json.dumps((await ws(client, type=f"{DOMAIN}/export"))["result"])
    assert '"healthcheck_fails": 4' in exported and '"healthcheck_up": false' in exported
    # Ein Panel aus 1.68.0 (noch offen) sendet die alte Form: abgelehnt, nichts geändert
    bad = await ws(client, type=f"{DOMAIN}/save_notify", notify={"healthcheck": {"fails": 2}})
    assert bad["success"] is False and hass.data[DATA_SETTINGS].notify["healthcheck_fails"] == 4
    assert (await ws(client, type=f"{DOMAIN}/save_notify", notify={"healthcheck_fails": 11}))["success"] is False


async def test_a_backup_from_1_68_keeps_its_settings(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    data = (await ws(client, type=f"{DOMAIN}/export"))["result"]
    notify = {k: v for k, v in data["settings"]["notify"].items() if k not in ("healthcheck_fails", "healthcheck_up")}
    notify["types"] = {k: v for k, v in notify["types"].items() if k != "healthcheck"}
    notify["healthcheck"] = {"fails": 5, "hc_down": {"enabled": True, "title": "", "message": "", "critical": True, "volume": 0.5, "persistent": False,
                                                   "click": "healthcheck", "click_path": "", "targets": []},
                             "hc_up": {"enabled": False, "title": "", "message": "", "critical": False, "volume": 0.8, "persistent": False,
                                       "click": "healthcheck", "click_path": "", "targets": []}}
    result = await ws(client, type=f"{DOMAIN}/import", data={**data, "settings": {**data["settings"], "notify": notify}}, mapping=[{"index": 0, "target": "new", "name": "Haus 2"}])
    assert result["success"], result
    await hass.async_block_till_done()
    cfg = hass.data[DATA_SETTINGS].notify
    assert cfg["healthcheck_fails"] == 5 and cfg["healthcheck_up"] is False and cfg["types"]["healthcheck"]["critical"] is True and "healthcheck" not in cfg


async def test_a_broken_notification_never_holds_up_the_life_sign(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker,
                                                                    monkeypatch) -> None:
    """Scheitert die Meldung, steht der Aufruf trotzdem im Zustand, im Protokoll und als Problem im Selbsttest."""
    from custom_components.alarmageddon import notify  # noqa: PLC0415

    def broken(*_a: Any, **_k: Any) -> list[str]:
        raise RuntimeError("kaputt")

    monkeypatch.setattr(notify, "async_send_healthcheck", broken)
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=1)
    await advance(hass, freezer, 2)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    assert healthcheck.status[hid]["result"] == "http" and len(healthcheck.log.calls[hid]) == 1
    assert any(p["code"] == "ping_failed" for p in hass.data[DATA_SELFTEST].problems())
