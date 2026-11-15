"""
Eigene Töne (1.39.0): hochladen, benennen, löschen, überall wählen, in der Sicherung.

Eine hochgeladene Datei ist Eingabe von aussen: sie wird nie anhand der Endung beurteilt, Grösse, Länge, Abtastrate und Anzahl sind begrenzt, nur
Administratoren dürfen hochladen, und ein Alarm klingt auch dann, wenn die Datei eines eigenen Tons fehlt.
"""

from __future__ import annotations

import base64
import io
from pathlib import Path
import shutil
import subprocess
import wave

import aiohttp
import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.alarmageddon import backup, custom_sounds as cs, sound_loop
from custom_components.alarmageddon import workflow as wf
from custom_components.alarmageddon.const import (
    BACKUPS_STORE_KEY,
    DATA_CUSTOM_SOUNDS,
    MAX_CUSTOM_SECONDS,
    MAX_CUSTOM_SOUNDS,
    MAX_UPLOAD_BYTES,
)
from custom_components.alarmageddon.schemas import STEP_SCHEMAS

from .conftest import setup_alarm
from .test_alarm import settle

PLAYER = "media_player.wohnzimmer"
HAS_FFMPEG = shutil.which("ffmpeg") is not None


def make_wav(seconds: float = 1.0, rate: int = 22050, channels: int = 1, width: int = 2) -> bytes:
    frames = int(seconds * rate)
    out = io.BytesIO()
    with wave.open(out, "wb") as target:
        target.setnchannels(channels)
        target.setsampwidth(width)
        target.setframerate(rate)
        value = {1: b"\xc0", 2: b"\x00\x20", 3: b"\x00\x00\x20", 4: b"\x00\x00\x00\x20"}[width]
        target.writeframes(value * channels * frames)
    return out.getvalue()


@pytest.fixture(autouse=True)
def _config_dir(hass: HomeAssistant, tmp_path: Path) -> None:
    """Die Dateien liegen in einer eigenen Ablage dieses Tests, nie im Verzeichnis der Testkonfiguration."""
    hass.config.config_dir = str(tmp_path)


async def upload(client, name: str, data: bytes, filename: str = "ton.wav"):
    form = aiohttp.FormData()
    form.add_field("name", name)
    form.add_field("file", data, filename=filename, content_type="application/octet-stream")
    return await client.post("/api/alarmageddon/sounds", data=form)


# ----- Umwandeln: die Eingabe ist nie vertrauenswürdig -----


@pytest.mark.parametrize(("channels", "width"), [(1, 2), (2, 2), (1, 1), (2, 1), (1, 3), (2, 3), (1, 4), (2, 4)])
def test_every_pcm_wav_becomes_mono_with_16_bit(channels: int, width: int) -> None:
    wav, seconds = cs.normalize_wav(make_wav(1.5, 22050, channels, width))
    with wave.open(io.BytesIO(wav)) as result:
        assert (result.getnchannels(), result.getsampwidth(), result.getframerate()) == (1, 2, 22050)
        assert result.getnframes() == int(1.5 * 22050)
    assert abs(seconds - 1.5) < 0.01


@pytest.mark.parametrize(
    ("data", "code"),
    [
        (make_wav(MAX_CUSTOM_SECONDS + 1, 8000), "too_long"),
        (make_wav(0.01, 22050), "too_short"),
        (make_wav(1, 96000), "rate"),
        (make_wav(1, 4000), "rate"),
        (b"RIFF\x00\x00\x00\x00WAVEfmt ", "invalid_sound"),
        (b"das ist keine Tondatei", "is_text"),
        (b"", "invalid_sound"),
    ],
    ids=["zu lang", "zu kurz", "Rate zu hoch", "Rate zu tief", "abgeschnitten", "Text", "leer"],
)
def test_a_file_that_is_not_a_usable_sound_is_refused(data: bytes, code: str) -> None:
    with pytest.raises(cs.SoundError) as err:
        cs.convert(data, None)
    assert err.value.code == code


def test_the_format_comes_from_the_content_and_never_from_the_ending() -> None:
    assert cs.sniff(make_wav()) == "wav"
    assert cs.sniff(b"ID3\x03\x00") == "mp3" and cs.sniff(b"\xff\xfb\x90\x00") == "mp3"
    assert cs.sniff(b"OggS\x00") == "ogg" and cs.sniff(b"fLaC\x00") == "flac" and cs.sniff(b"\x00\x00\x00\x18ftypM4A ") == "mov"
    assert cs.sniff(b"MZ\x90\x00 programm.exe") is None and cs.sniff(b"#EXTM3U\nhttp://...") is None
    with pytest.raises(cs.SoundError) as err:
        cs.convert(b"#EXTM3U\nhttp://example.invalid/stream", "/usr/bin/ffmpeg")
    assert err.value.code == "is_text", "Listen und Adressen werden nie an ffmpeg gegeben"


def test_without_ffmpeg_only_wav_is_possible() -> None:
    with pytest.raises(cs.SoundError) as err:
        cs.convert(b"ID3\x03\x00" + b"\x00" * 200, None)
    assert err.value.code == "ffmpeg_missing"


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg fehlt")
@pytest.mark.parametrize("fmt", ["mp3", "ogg", "flac", "m4a"])
def test_other_formats_are_converted_by_ffmpeg(fmt: str) -> None:
    codec = {"mp3": "libmp3lame", "ogg": "libvorbis", "flac": "flac", "m4a": "aac"}[fmt]
    made = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=800:duration=1.2", "-c:a", codec, "-f", {"m4a": "ipod"}.get(fmt, fmt), "pipe:1"], capture_output=True, check=False)
    if made.returncode != 0 or not made.stdout:
        pytest.skip(f"ffmpeg kann {fmt} nicht schreiben")
    wav, seconds = cs.convert(made.stdout, shutil.which("ffmpeg"))
    with wave.open(io.BytesIO(wav)) as result:
        assert (result.getnchannels(), result.getsampwidth()) == (1, 2)
    assert 1.0 < seconds < 1.5


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg fehlt")
def test_a_broken_or_too_long_file_for_ffmpeg_is_refused() -> None:
    with pytest.raises(cs.SoundError) as err:
        cs.convert(b"ID3\x03\x00" + b"\x01" * 500, shutil.which("ffmpeg"))
    assert err.value.code == "invalid_sound"
    long = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=duration=40", "-c:a", "flac", "-f", "flac", "pipe:1"], capture_output=True, check=False).stdout
    with pytest.raises(cs.SoundError) as err2:
        cs.convert(long, shutil.which("ffmpeg"))
    assert err2.value.code == "too_long"


def _fake_ffmpeg(monkeypatch: pytest.MonkeyPatch) -> dict:
    """ffmpeg durch eine Attrappe ersetzen, die Befehl und Zeitgrenze festhält und eine gültige WAV-Datei schreibt."""
    seen: dict = {}

    def run(command, **kwargs):
        seen["command"], seen["kwargs"] = list(command), kwargs
        Path(command[-1]).write_bytes(make_wav())
        return subprocess.CompletedProcess(command, 0, b"", b"")

    monkeypatch.setattr(cs.subprocess, "run", run)
    return seen


@pytest.mark.parametrize(("raw", "kind"), [(b"ID3\x03\x00" + b"\x00" * 50, "mp3"), (b"OggS" + b"\x00" * 50, "ogg"), (b"fLaC" + b"\x00" * 50, "flac")])
def test_ffmpeg_gets_the_format_from_the_content_and_a_time_limit(monkeypatch: pytest.MonkeyPatch, raw: bytes, kind: str) -> None:
    seen = _fake_ffmpeg(monkeypatch)
    cs.convert(raw, "/usr/bin/ffmpeg")
    command = seen["command"]
    assert command[command.index("-i") - 2:command.index("-i")] == ["-f", kind], "das Eingangsformat ist fest vorgegeben, ffmpeg raet nicht"
    assert seen["kwargs"]["timeout"] == cs.FFMPEG_TIMEOUT, "ohne Zeitgrenze koennte eine Datei ffmpeg endlos beschaeftigen"


def test_an_ffmpeg_that_takes_too_long_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    def run(command, **kwargs):
        raise subprocess.TimeoutExpired(command, kwargs["timeout"])

    monkeypatch.setattr(cs.subprocess, "run", run)
    with pytest.raises(cs.SoundError) as err:
        cs.convert(b"OggS" + b"\x00" * 50, "/usr/bin/ffmpeg")
    assert err.value.code == "invalid_sound"


@pytest.mark.parametrize(
    ("raw", "code"),
    [
        (b"\xff\xd8\xff\xe0" + b"\x00" * 40, "is_image"),
        (b"\x89PNG\r\n\x1a\n" + b"\x00" * 40, "is_image"),
        (b"\x00\x00\x00\x18ftypheic" + b"\x00" * 40, "is_image"),  # HEIC-Foto vom iPhone, nicht M4A/MP4
        (b"%PDF-1.7\n" + b"\x00" * 40, "is_document"),
        ("Hallo Welt, das ist kein Ton\nÜmläute".encode(), "is_text"),
        (b"\x01\x02\x03\x04\x05\x06" * 20, "invalid_sound"),
    ],
    ids=["JPEG", "PNG", "HEIC", "PDF", "Text", "Unbekannt"],
)
def test_a_file_that_is_not_a_sound_says_what_it_is(raw: bytes, code: str) -> None:
    with pytest.raises(cs.SoundError) as err:
        cs.convert(raw, "/usr/bin/ffmpeg")
    assert err.value.code == code


def test_a_video_without_a_sound_track_is_named_so(monkeypatch: pytest.MonkeyPatch) -> None:
    def run(command, **kwargs):
        return subprocess.CompletedProcess(command, 1, b"", b"Output file does not contain any stream")

    monkeypatch.setattr(cs.subprocess, "run", run)
    with pytest.raises(cs.SoundError) as err:
        cs.convert(b"\x00\x00\x00\x18ftypisom" + b"\x00" * 40, "/usr/bin/ffmpeg")
    assert err.value.code == "no_audio"


async def test_an_unexpected_error_while_reading_a_file_is_reported_as_unreadable_and_logged(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    await setup_alarm(hass)
    reg = hass.data[DATA_CUSTOM_SOUNDS]

    def boom(raw, ffmpeg):
        raise RuntimeError("kaputt")

    monkeypatch.setattr(cs, "convert", boom)
    with pytest.raises(cs.SoundError) as err:
        await reg.async_add("Test", make_wav(), None)
    assert err.value.code == "invalid_sound"
    assert "could not be read" in caplog.text, "der Grund steht im Protokoll von Home Assistant"


async def test_a_failure_while_saving_answers_with_a_readable_key_and_logs_it(hass: HomeAssistant, hass_client, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    await setup_alarm(hass)
    reg = hass.data[DATA_CUSTOM_SOUNDS]

    def boom(self, key, wav):
        raise OSError("Platte voll")

    monkeypatch.setattr(type(reg), "_write", boom)
    client = await hass_client()
    form = aiohttp.FormData()
    form.add_field("name", "Test")
    form.add_field("file", make_wav(), filename="t.wav", content_type="audio/wav")
    resp = await client.post("/api/alarmageddon/sounds", data=form)
    assert resp.status == 500 and (await resp.json())["error"] == "server"
    assert "Saving an uploaded sound failed" in caplog.text


# ----- Hochladen (HTTP) -----


async def test_an_administrator_uploads_names_and_finds_the_sound(hass: HomeAssistant, hass_client, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_client()
    reply = await upload(client, "  Haustür   Sirene ", make_wav(2.0))
    body = await reply.json()
    assert reply.status == 200 and body["sound"]["name"] == "Haustür Sirene" and body["sound"]["id"].startswith("custom_") and abs(body["sound"]["seconds"] - 2.0) < 0.05
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "alarmageddon/data"})
    data = (await ws.receive_json())["result"]
    assert [s["id"] for s in data["custom_sounds"]] == [body["sound"]["id"]] and data["custom_sound_limits"]["max"] == MAX_CUSTOM_SOUNDS
    assert (Path(hass.config.config_dir) / "alarmageddon_sounds" / f"{body['sound']['id']}.wav").exists()
    played = await client.get(body["sound"]["url"])
    assert played.status == 200 and played.content_type == "audio/wav" and (await played.read())[:4] == b"RIFF"


@pytest.mark.parametrize(
    ("name", "data", "status", "code"),
    [
        ("", make_wav(), 400, "name_invalid"),
        ("x" * 41, make_wav(), 400, "name_invalid"),
        ("Ton", b"kein Ton", 400, "is_text"),
        ("Ton", make_wav(MAX_CUSTOM_SECONDS + 5, 8000), 400, "too_long"),
        ("Ton", b"x" * (MAX_UPLOAD_BYTES + 10), 413, "too_big"),
    ],
    ids=["ohne Namen", "Name zu lang", "kein Ton", "zu lang", "zu gross"],
)
async def test_bad_uploads_are_refused_with_a_key(hass: HomeAssistant, hass_client, name: str, data: bytes, status: int, code: str) -> None:
    await setup_alarm(hass)
    reply = await upload(await hass_client(), name, data)
    assert reply.status == status and (await reply.json())["error"] == code
    assert hass.data[DATA_CUSTOM_SOUNDS].items == {}


async def test_only_administrators_may_upload(hass: HomeAssistant, hass_client_no_auth, hass_read_only_access_token) -> None:
    await setup_alarm(hass)
    anonymous = await hass_client_no_auth()
    reply = await upload(anonymous, "Ton", make_wav())
    assert reply.status == 401
    reader = await anonymous.post("/api/alarmageddon/sounds", headers={"Authorization": f"Bearer {hass_read_only_access_token}"}, data=aiohttp.FormData())
    assert reader.status == 401
    assert hass.data[DATA_CUSTOM_SOUNDS].items == {}


async def test_names_are_unique_and_the_number_and_size_are_limited(hass: HomeAssistant, hass_client, monkeypatch) -> None:
    await setup_alarm(hass)
    client = await hass_client()
    assert (await upload(client, "Eins", make_wav())).status == 200
    taken = await upload(client, "eins", make_wav())
    assert taken.status == 400 and (await taken.json())["error"] == "name_taken"
    monkeypatch.setattr(cs, "MAX_CUSTOM_SOUNDS", 2)
    assert (await upload(client, "Zwei", make_wav())).status == 200
    many = await upload(client, "Drei", make_wav())
    assert many.status == 400 and (await many.json())["error"] == "too_many"
    monkeypatch.setattr(cs, "MAX_CUSTOM_SOUNDS", 20)
    monkeypatch.setattr(cs, "MAX_CUSTOM_TOTAL_BYTES", 60000)
    full = await upload(client, "Gross", make_wav(2.0))
    assert full.status == 400 and (await full.json())["error"] == "no_space"


# ----- Umbenennen und Löschen (WebSocket) -----


async def test_rename_and_delete_over_the_websocket(hass: HomeAssistant, hass_client, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_client()
    one = (await (await upload(client, "Eins", make_wav())).json())["sound"]
    two = (await (await upload(client, "Zwei", make_wav())).json())["sound"]
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "alarmageddon/rename_sound", "sound_id": one["id"], "name": "Zwei"})
    assert (await ws.receive_json())["error"]["code"] == "name_taken"
    await ws.send_json({"id": 2, "type": "alarmageddon/rename_sound", "sound_id": one["id"], "name": "Garage"})
    reply = await ws.receive_json()
    assert reply["success"] and {s["name"] for s in reply["result"]["sounds"]} == {"Garage", "Zwei"}
    await ws.send_json({"id": 3, "type": "alarmageddon/delete_sound", "sound_id": two["id"]})
    reply = await ws.receive_json()
    assert reply["success"] and [s["id"] for s in reply["result"]["sounds"]] == [one["id"]]
    assert not (Path(hass.config.config_dir) / "alarmageddon_sounds" / f"{two['id']}.wav").exists()
    assert (await client.get(two["url"])).status == 404
    await ws.send_json({"id": 4, "type": "alarmageddon/delete_sound", "sound_id": two["id"]})
    assert (await ws.receive_json())["error"]["code"] == "not_found"
    await ws.send_json({"id": 5, "type": "alarmageddon/delete_sound", "sound_id": "../../etc/passwd"})
    assert (await ws.receive_json())["error"]["code"] == "not_found"


# ----- Abspielen -----


async def test_a_custom_sound_plays_in_every_kind_of_step_and_falls_back_when_its_file_is_missing(hass: HomeAssistant, hass_client, freezer) -> None:
    await hass.config.async_update(internal_url="http://192.168.1.2:8123")
    hass.states.async_set(PLAYER, "idle")
    played = async_mock_service(hass, "media_player", "play_media")
    async_mock_service(hass, "media_player", "media_stop")
    entry = await setup_alarm(hass, workflows={"home": [{"type": "sound", "players": [PLAYER], "sound": "custom_aaaaaaaaaaaa", "duration": 5}]})
    client = await hass_client()
    sound = (await (await upload(client, "Mein Ton", make_wav(1.0))).json())["sound"]
    reg = hass.data[DATA_CUSTOM_SOUNDS]
    reg.items["custom_aaaaaaaaaaaa"] = reg.items.pop(sound["id"])
    (reg.dir / f"{sound['id']}.wav").rename(reg.dir / "custom_aaaaaaaaaaaa.wav")
    runner = entry.runtime_data.workflow
    assert await runner.async_run("home", test=True)
    await settle(hass)
    assert played and "/alarmageddon_loop/5000/custom_aaaaaaaaaaaa.wav" in played[-1].data["media_content_id"]
    reply = await client.get("/alarmageddon_loop/5000/custom_aaaaaaaaaaaa.wav")
    assert reply.status == 200
    with wave.open(io.BytesIO(await reply.read())) as result:
        assert abs(result.getnframes() / result.getframerate() - 5.0) < 0.05
    await runner.async_stop()
    # Datei weg (gelöscht oder nie zurückgespielt): der Alarm klingt trotzdem, mit dem Standardton der Art
    await reg.async_delete("custom_aaaaaaaaaaaa")
    played.clear()
    assert await runner.async_run("home", test=True)
    await settle(hass)
    assert played and "/alarmageddon_loop/5000/siren.wav" in played[-1].data["media_content_id"]
    assert (await client.get("/alarmageddon_loop/5000/custom_aaaaaaaaaaaa.wav")).status == 404
    await runner.async_stop()


@pytest.mark.parametrize(("kind", "fallback"), [("chime", "tone_pip"), ("dechime", "off_fall"), ("prealarm", "pre_beep"), ("sound", "siren")])
async def test_every_kind_has_its_own_fallback_sound(hass: HomeAssistant, kind: str, fallback: str) -> None:
    entry = await setup_alarm(hass)
    runner = entry.runtime_data.workflow
    assert runner._sound("custom_bbbbbbbbbbbb", {"prealarm": "pre_beep", "chime": "tone_pip", "dechime": "off_fall"}.get(kind, "siren"))[0] == fallback
    assert runner._sound("kein_ton", "siren") is None and runner._sound("siren", "tone_pip")[0] == "siren"


def test_the_schema_takes_custom_ids_only_in_the_known_form_and_the_watchdog_allows_for_their_length() -> None:
    for kind, extra in (("sound", {}), ("chime", {}), ("dechime", {}), ("prealarm", {})):
        step = {"type": kind, "players": [PLAYER], "sound": "custom_0123456789ab", **extra}
        assert STEP_SCHEMAS[kind](step)["sound"] == "custom_0123456789ab"
        for bad in ("custom_xyz", "custom_0123456789abc", "../siren", "CUSTOM_0123456789AB", "custom_"):
            with pytest.raises(vol.Invalid):
                STEP_SCHEMAS[kind]({**step, "sound": bad})
    assert wf.step_budget({"type": "sound", "sound": "custom_0123456789ab", "duration": 10}) >= 10 + MAX_CUSTOM_SECONDS


# ----- Sicherung -----


async def test_a_backup_carries_the_custom_sounds_and_restores_them(hass: HomeAssistant, hass_client) -> None:
    entry = await setup_alarm(hass, workflows={"home": [{"type": "sound", "players": [PLAYER], "sound": "siren", "duration": 5}]})
    client = await hass_client()
    sound = (await (await upload(client, "Haus", make_wav(1.0))).json())["sound"]
    data = await backup.async_export(hass, "1.39.0")
    items = data["settings"]["custom_sounds"]
    assert [i["id"] for i in items] == [sound["id"]] and base64.b64decode(items[0]["wav"])[:4] == b"RIFF"
    checked = backup.validate(data)
    assert [i["id"] for i in checked["custom_sounds"]] == [sound["id"]]
    reg = hass.data[DATA_CUSTOM_SOUNDS]
    await reg.async_delete(sound["id"])
    result = await backup.async_restore(hass, checked)
    assert result["sounds"] == 1 and reg.has(sound["id"]) and reg.items[sound["id"]]["name"] == "Haus"
    assert (await client.get(sound["url"])).status == 200
    await backup.async_restore(hass, checked)  # nochmal: nichts doppelt, nichts überschrieben
    assert len(reg.items) == 1 and entry.title == "Haus"


async def test_a_restore_ignores_files_that_are_not_sounds(hass: HomeAssistant) -> None:
    await setup_alarm(hass)
    reg = hass.data[DATA_CUSTOM_SOUNDS]
    bad = [{"id": "custom_111111111111", "name": "Müll", "wav": base64.b64encode(b"nur Text").decode()},
           {"id": "custom_222222222222", "name": "Kein Base64", "wav": "***"},
           {"id": "../x", "name": "Pfad", "wav": base64.b64encode(make_wav()).decode()}]
    checked = cs.valid_backup_sounds(bad)
    assert [i["id"] for i in checked] == ["custom_111111111111", "custom_222222222222"]
    assert await reg.async_import(checked) == [] and reg.items == {}


def test_a_backup_entry_that_is_too_big_is_dropped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cs, "MAX_UPLOAD_BYTES", 90)
    big = {"id": "custom_333333333333", "name": "Gross", "wav": "A" * 400}
    small = {"id": "custom_444444444444", "name": "Klein", "wav": "A" * 40}
    assert [i["id"] for i in cs.valid_backup_sounds([big, small])] == ["custom_444444444444"]


async def test_the_backups_in_the_integration_keep_each_sound_once(hass: HomeAssistant, hass_client) -> None:
    await setup_alarm(hass)
    sound = (await (await upload(await hass_client(), "Haus", make_wav(1.0))).json())["sound"]
    first = await backup.async_create_backup(hass, "1.39.0", "eins")
    second = await backup.async_create_backup(hass, "1.39.0", "zwei")
    stored = await Store(hass, 1, BACKUPS_STORE_KEY).async_load()
    assert len(stored["blobs"]) == 1 and all("wav" not in s for b in stored["backups"] for s in b["data"]["settings"]["custom_sounds"])
    got = await backup.async_get_backup(hass, first["id"])
    assert [s["id"] for s in got["settings"]["custom_sounds"]] == [sound["id"]] and got["settings"]["custom_sounds"][0]["wav"]
    await backup.async_delete_backup(hass, first["id"])
    assert len((await Store(hass, 1, BACKUPS_STORE_KEY).async_load())["blobs"]) == 1
    await backup.async_delete_backup(hass, second["id"])
    assert (await Store(hass, 1, BACKUPS_STORE_KEY).async_load())["blobs"] == {}


async def test_loading_forgets_entries_whose_file_is_gone(hass: HomeAssistant, hass_client) -> None:
    await setup_alarm(hass)
    sound = (await (await upload(await hass_client(), "Haus", make_wav())).json())["sound"]
    reg = hass.data[DATA_CUSTOM_SOUNDS]
    (reg.dir / f"{sound['id']}.wav").unlink()
    await reg.async_load()
    assert reg.items == {}


def test_forgetting_a_sound_clears_the_built_files(hass: HomeAssistant) -> None:
    hass.data[sound_loop.DATA_LOOP_CACHE] = {("custom_aaaaaaaaaaaa", 1000): b"x", ("siren", 1000): b"y"}
    sound_loop.forget(hass, "custom_aaaaaaaaaaaa")
    assert list(hass.data[sound_loop.DATA_LOOP_CACHE]) == [("siren", 1000)]
