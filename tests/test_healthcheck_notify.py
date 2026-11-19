"""
Meldungen der HealthCheck-Dienste (1.68.0, Wunsch des Nutzers 2026-11-19, 18:42 und 18:43): "Dienst antwortet nicht" nach der eingestellten Zahl
gescheiterter Aufrufe hintereinander (jeder automatische Aufruf, nie der Testknopf), "Dienst antwortet wieder" beim ersten, der danach klappt, und nur, wenn
"antwortet nicht" hinausging. Je eine feste Meldung (Text, Empfänger, Kritisch, Lautstärke, stehen lassen, Klickziel) im Kapitel
"HealthCheck-Dienste" der Benachrichtigungen. Nie die URL in einer Meldung. Ein gescheitertes Lebenszeichen geht nicht mehr über die Meldung
"Selbsttest" hinaus (bleibt dort ein Problem).
"""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.alarmageddon import selftest as st
from custom_components.alarmageddon.const import DATA_HEALTHCHECK, DATA_SELFTEST, DATA_SETTINGS, DOMAIN
from custom_components.alarmageddon.settings import valid_notify

from .conftest import setup_alarm
from .test_healthcheck import HC, add, advance, ws


async def settings_hc(hass: HomeAssistant, **changes: Any) -> None:
    settings = hass.data[DATA_SETTINGS]
    current = settings.notify["healthcheck"]
    hc = {**current, **{k: ({**current[k], **v} if isinstance(v, dict) else v) for k, v in changes.items()}}
    await settings.async_set_notify({**settings.notify, "maintenance_targets": ["notify.handy"], "healthcheck": hc})


def texts(calls: list) -> list[tuple[str, str]]:
    return [(c.data["title"], c.data["message"]) for c in calls]


async def start(hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker, status: int = 500, **hc: Any):
    aioclient_mock.get(HC, status=status)
    sent = async_mock_service(hass, "notify", "handy")
    await setup_alarm(hass)
    await settings_hc(hass, **hc)
    client = await hass_ws_client(hass)
    hid = (await add(client, interval=60))["result"]["id"]
    return client, hid, sent


async def test_down_after_the_set_number_once_and_up_after_recovery(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock)
    await advance(hass, freezer, 2)  # erster gescheiterter Aufruf (gleich nach dem Speichern)
    assert sent == []
    await advance(hass, freezer, 61)  # zweiter: Standard 2
    assert len(sent) == 1
    title, message = texts(sent)[0]
    assert title == "⚠️ Health check \"Haus\" is not answering" and "2 calls to hc-ping.com" in message and "HTTP 500" in message
    assert sent[0].data["data"]["url"] == "/alarmageddon?view=healthcheck" and "push" not in sent[0].data["data"]
    for _ in range(3):  # weitere Ausfälle: keine weitere Meldung
        await advance(hass, freezer, 61)
    assert len(sent) == 1
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    await advance(hass, freezer, 61)
    assert len(sent) == 2 and texts(sent)[1][0] == "✅ Health check \"Haus\" answers again" and "5 failed calls" in texts(sent)[1][1]
    await advance(hass, freezer, 61)
    assert len(sent) == 2
    # Nie die URL (das Geheimnis des Dienstes), auch nicht ihr Pfad
    assert all("00000000-1111" not in str(c.data) for c in sent)


async def test_set_number_test_button_and_switch(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Eine Meldung schon nach dem ersten Ausfall, wenn so eingestellt; der Testknopf zählt nie; ausgeschaltet kommt auch kein "wieder"."""
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=1, hc_down={"enabled": False})
    await advance(hass, freezer, 2)
    for _ in range(2):
        assert (await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind="ok"))["success"]
    assert sent == [] and hass.data[DATA_HEALTHCHECK]._fails[hid] == 1  # die Tests zählen nicht mit
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    await advance(hass, freezer, 61)
    assert sent == []  # "antwortet nicht" ging nie hinaus, darum kein "antwortet wieder"
    await settings_hc(hass, hc_down={"enabled": True})
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, exc=TimeoutError())
    await advance(hass, freezer, 61)
    assert len(sent) == 1 and "no answer" in texts(sent)[0][1]


async def test_own_text_critical_recipients_and_click(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    other = async_mock_service(hass, "notify", "tablet")
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, fails=1, hc_down={
        "title": "{name} weg", "message": "{host}: {reason}, {count}x seit {since}", "critical": True, "volume": 0.4, "targets": ["notify.tablet"],
        "click": "custom", "click_path": "/lovelace/0", "persistent": True})
    await advance(hass, freezer, 2)
    assert sent == [] and len(other) == 1
    data = other[0].data
    assert data["title"] == "Haus weg" and data["message"].startswith("hc-ping.com: HTTP 500, 1x seit ")
    assert data["data"]["push"]["sound"]["volume"] == 0.4 and data["data"]["push"]["interruption-level"] == "critical" and data["data"]["url"] == "/lovelace/0"
    persistent = hass.states.async_all("persistent_notification")
    assert persistent == [] or all("00000000" not in str(s.attributes) for s in persistent)


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
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    await advance(hass, freezer, 61)
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


async def test_test_message_from_the_window(hass: HomeAssistant, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    client, hid, sent = await start(hass, hass_ws_client, aioclient_mock, status=200)
    notice = {"enabled": False, "title": "", "message": "", "critical": False, "targets": []}
    answer = await ws(client, type=f"{DOMAIN}/test_healthcheck_notify", kind="hc_down", notice=notice)
    assert answer["success"] and answer["result"]["targets"] == ["notify.handy"]
    assert sent[-1].data["title"].startswith("🧪 Test: ⚠️ Health check \"Haus\"") and "00000000" not in str(sent[-1].data)
    await settings_hc(hass)
    await hass.data[DATA_SETTINGS].async_set_notify({**hass.data[DATA_SETTINGS].notify, "maintenance_targets": []})
    answer = await ws(client, type=f"{DOMAIN}/test_healthcheck_notify", kind="hc_up", notice=notice)
    assert answer["success"] is False and answer["error"]["code"] == "no_targets"
    bad = await ws(client, type=f"{DOMAIN}/test_healthcheck_notify", kind="hc_sideways", notice=notice)
    assert bad["success"] is False


def test_settings_are_checked() -> None:
    out = valid_notify({"healthcheck": {"fails": 99, "hc_down": {"enabled": False, "critical": True, "click": "nirgends"}, "hc_up": {"enabled": False, "critical": True}}})
    assert out["healthcheck"]["fails"] == 10
    assert out["healthcheck"]["hc_down"]["enabled"] is True  # ungültig: der Standard gilt (im Zweifel melden)
    assert out["healthcheck"]["hc_up"]["enabled"] is False and out["healthcheck"]["hc_up"]["click"] == "healthcheck"
    assert valid_notify({"healthcheck": {"fails": 0}})["healthcheck"]["fails"] == 1
    assert valid_notify({})["healthcheck"]["fails"] == 2


async def test_saved_with_the_notifications_and_in_the_backup(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    current = hass.data[DATA_SETTINGS].notify
    saved = await ws(client, type=f"{DOMAIN}/save_notify", notify={**{k: v for k, v in current.items() if k != "types"}, "healthcheck": {
        **current["healthcheck"], "fails": 4, "hc_up": {**current["healthcheck"]["hc_up"], "title": "wieder da"}}})
    assert saved["success"] and saved["result"]["notify"]["healthcheck"]["fails"] == 4
    exported = (await ws(client, type=f"{DOMAIN}/export"))["result"]
    assert '"fails": 4' in __import__("json").dumps(exported) and "wieder da" in __import__("json").dumps(exported)


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


def test_panel_and_server_use_the_same_texts_and_tokens() -> None:
    """Standardtexte und Platzhalter im Fenster sind die, die der Server sendet (sonst zeigte die Vorschau etwas anderes, als ankommt)."""
    import json  # noqa: PLC0415
    from pathlib import Path  # noqa: PLC0415
    import re  # noqa: PLC0415

    from custom_components.alarmageddon.const import DEFAULT_NOTIFY, HC_NOTICE_KINDS  # noqa: PLC0415
    from custom_components.alarmageddon.notify import HC_TOKENS, TEXTS  # noqa: PLC0415

    panel = Path(__file__).parents[1] / "custom_components" / "alarmageddon" / "panel"
    actions = (panel / "actions.js").read_text(encoding="utf-8")
    assert re.findall(r'"(\{\w+\})"', re.search(r"HC_TOKENS = \[(.*?)\]", actions).group(1)) == list(HC_TOKENS)
    assert tuple(re.findall(r'"(\w+)"', re.search(r"HC_NOTICE_KINDS = \[(.*?)\]", actions).group(1))) == HC_NOTICE_KINDS
    strings = (panel / "strings.js").read_text(encoding="utf-8")
    en, de = strings.split("\n  de: {", 1)
    for lang, part in (("en", en), ("de", de)):
        for kind in HC_NOTICE_KINDS:
            title = json.loads(re.search(rf'\n    ntcDefTitle_{kind}: ("(?:[^"\\]|\\.)*")', part).group(1))
            message = json.loads(re.search(rf'\n    ntcDefMsg_{kind}: ("(?:[^"\\]|\\.)*")', part).group(1))
            assert title == TEXTS[lang][f"{kind}_title"] and message == TEXTS[lang][f"{kind}_message"], (lang, kind)
    assert DEFAULT_NOTIFY["healthcheck"]["fails"] == 2 and all(DEFAULT_NOTIFY["healthcheck"][k]["click"] == "healthcheck" for k in HC_NOTICE_KINDS)
