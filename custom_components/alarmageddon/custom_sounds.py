"""
Eigene Töne (1.39.0): Der Nutzer lädt eine Tondatei hoch und gibt ihr einen Namen; der Ton steht danach überall zur Verfügung, wo es einen Ton
gibt (Alarmton, Voralarm, Aktivierungs- und Deaktivierungston), in jeder Alarmanlage. Ein Schritt verweist nur auf die Kennung, die Datei liegt
einmal in der Ablage von Home Assistant (Kopieren eines Schritts dupliziert nichts).

Beim Hochladen wird jede Datei in dasselbe Format gebracht wie die mitgelieferten Töne (Mono, 16 Bit, WAV): daraus baut sound_loop.py die Datei in der
gewählten Länge (Wiederholung der Bytes). WAV liest Alarmageddon selbst; MP3, OGG, FLAC und M4A nur, wenn ffmpeg da ist. Alles, was hochgeladen
wird, ist Eingabe von aussen: Grösse, Länge, Abtastrate und Anzahl sind begrenzt, ffmpeg bekommt nur ein festes Format und eine Zeitgrenze.
"""

from __future__ import annotations

import base64
import io
import logging
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from array import array
import uuid
import wave
from typing import Any

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    CUSTOM_SOUNDS_STORE_KEY,
    CUSTOM_SOUND_ID_RE,
    CUSTOM_URL_PATH,
    DATA_CUSTOM_SOUNDS,
    MAX_CUSTOM_NAME,
    MAX_CUSTOM_RATE,
    MAX_CUSTOM_SECONDS,
    MAX_CUSTOM_SOUNDS,
    MAX_CUSTOM_TOTAL_BYTES,
    MAX_UPLOAD_BYTES,
)

_LOGGER = logging.getLogger(__name__)
ID_RE = re.compile(CUSTOM_SOUND_ID_RE)
FFMPEG_TIMEOUT = 30
MIN_SECONDS = 0.05
MIN_RATE = 8000


class SoundError(Exception):
    """Fehler beim Hochladen oder Verwalten; `code` ist der Schlüssel für das Panel."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def sniff(raw: bytes) -> str | None:
    """Das Format an den ersten Bytes erkennen, nie an der Endung: "wav", "mp3", "ogg", "flac" oder "mov" (M4A/AAC)."""
    if raw[:4] == b"RIFF" and raw[8:12] == b"WAVE":
        return "wav"
    if raw[:3] == b"ID3" or (len(raw) > 2 and raw[0] == 0xFF and raw[1] & 0xE0 == 0xE0):
        return "mp3"
    if raw[:4] == b"OggS":
        return "ogg"
    if raw[:4] == b"fLaC":
        return "flac"
    if raw[4:8] == b"ftyp":
        return "mov"
    return None


def _to_mono16(frames: bytes, width: int, channels: int) -> array:
    """Die Rohdaten einer WAV-Datei als Mono mit 16 Bit (Zahlen mit Vorzeichen)."""
    if width == 1:
        data = array("h", [(b - 128) << 8 for b in frames])
    elif width == 2:
        data = array("h")
        data.frombytes(frames[: len(frames) - len(frames) % 2])
        if sys.byteorder == "big":
            data.byteswap()
    elif width == 3:
        data = array("h", [int.from_bytes(frames[i + 1 : i + 3], "little", signed=True) for i in range(0, len(frames) - len(frames) % 3, 3)])
    else:
        data = array("h", [int.from_bytes(frames[i + 2 : i + 4], "little", signed=True) for i in range(0, len(frames) - len(frames) % 4, 4)])
    if channels == 2:
        data = array("h", [(data[i] + data[i + 1]) // 2 for i in range(0, len(data) - len(data) % 2, 2)])
    return data


def normalize_wav(raw: bytes) -> tuple[bytes, float]:
    """
    Eine WAV-Datei (PCM, 8 bis 32 Bit, Mono oder Stereo) als Mono mit 16 Bit; gibt die Datei und die Länge in Sekunden zurück. Blockierend.
    Wirft SoundError: "invalid_sound" (keine lesbare PCM-WAV), "too_long", "too_short", "rate" (Abtastrate ausserhalb 8000 bis 48000 Hz).
    """
    try:
        with wave.open(io.BytesIO(raw)) as source:
            channels, width, rate, count = source.getnchannels(), source.getsampwidth(), source.getframerate(), source.getnframes()
            if channels not in (1, 2) or width not in (1, 2, 3, 4) or source.getcomptype() != "NONE":
                raise SoundError("invalid_sound")
            if not MIN_RATE <= rate <= MAX_CUSTOM_RATE:
                raise SoundError("rate")
            seconds = count / rate if rate else 0
            if seconds > MAX_CUSTOM_SECONDS:
                raise SoundError("too_long")
            if seconds < MIN_SECONDS:
                raise SoundError("too_short")
            frames = source.readframes(count)
    except (wave.Error, EOFError, ValueError) as err:
        raise SoundError("invalid_sound") from err
    samples = _to_mono16(frames, width, channels)
    if len(samples) / rate < MIN_SECONDS:
        raise SoundError("too_short")
    if sys.byteorder == "big":
        samples.byteswap()
    out = io.BytesIO()
    with wave.open(out, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(samples.tobytes())
    return out.getvalue(), len(samples) / rate


def ffmpeg_binary(hass: HomeAssistant | None = None) -> str | None:
    """Das Programm ffmpeg: das von Home Assistant (Integration ffmpeg), sonst eines im Suchpfad. None, wenn keines da ist."""
    if hass is not None:
        try:
            from homeassistant.components.ffmpeg import get_ffmpeg_manager

            return get_ffmpeg_manager(hass).binary or shutil.which("ffmpeg")
        except Exception:  # noqa: BLE001 - die Integration ist nicht geladen: Suchpfad
            pass
    return shutil.which("ffmpeg")


def convert(raw: bytes, ffmpeg: str | None) -> tuple[bytes, float]:
    """
    Hochgeladene Datei in das Format der Töne bringen. Blockierend. WAV liest Alarmageddon selbst; die anderen Formate wandelt ffmpeg
    um, mit festem Eingangsformat (kein Verfolgen von Listen oder Adressen), höchstens 31 Sekunden und einer Zeitgrenze.
    """
    kind = sniff(raw)
    if kind is None:
        raise SoundError("invalid_sound")
    if kind == "wav":
        return normalize_wav(raw)
    if not ffmpeg:
        raise SoundError("ffmpeg_missing")
    with tempfile.TemporaryDirectory(prefix="alarmageddon_") as tmp:
        source, target = Path(tmp) / "in.bin", Path(tmp) / "out.wav"
        source.write_bytes(raw)
        command = [ffmpeg, "-nostdin", "-v", "error", "-f", kind, "-i", str(source), "-t", str(MAX_CUSTOM_SECONDS + 1), "-vn", "-ac", "1",
                   "-ar", "44100", "-c:a", "pcm_s16le", "-f", "wav", str(target)]
        try:
            done = subprocess.run(command, capture_output=True, timeout=FFMPEG_TIMEOUT, check=False)  # noqa: S603 - Programm und Argumente sind fest
        except (subprocess.TimeoutExpired, OSError) as err:
            raise SoundError("invalid_sound") from err
        if done.returncode != 0 or not target.exists():
            raise SoundError("invalid_sound")
        return normalize_wav(target.read_bytes())


def clean_name(name: Any) -> str:
    text = " ".join(str(name or "").split())
    if not text or len(text) > MAX_CUSTOM_NAME:
        raise SoundError("name_invalid")
    return text


class CustomSounds:
    """Die eigenen Töne: Verzeichnis `alarmageddon_sounds` in der Konfiguration, dazu ein Verzeichnis der Namen in der Ablage von HA."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store = Store(hass, 1, CUSTOM_SOUNDS_STORE_KEY)
        self.dir = Path(hass.config.path("alarmageddon_sounds"))
        self.items: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        raw = data.get("sounds") if isinstance(data, dict) else None
        found: dict[str, dict[str, Any]] = {}
        for key, item in (raw or {}).items():
            if isinstance(key, str) and ID_RE.match(key) and isinstance(item, dict) and isinstance(item.get("name"), str) and (self.dir / f"{key}.wav").exists():
                found[key] = {"name": item["name"], "seconds": float(item.get("seconds") or 0), "size": int(item.get("size") or 0), "created": item.get("created")}
        self.items = found

    async def _save(self) -> None:
        await self._store.async_save({"sounds": self.items})

    def path(self, sound_id: str) -> Path:
        if not ID_RE.match(str(sound_id)):
            raise SoundError("not_found")
        return self.dir / f"{sound_id}.wav"

    def has(self, sound_id: Any) -> bool:
        return isinstance(sound_id, str) and sound_id in self.items

    def length(self, sound_id: Any) -> float | None:
        return float(self.items[sound_id]["seconds"]) if self.has(sound_id) else None

    def total_bytes(self) -> int:
        return sum(int(item.get("size") or 0) for item in self.items.values())

    def listing(self) -> list[dict[str, Any]]:
        return [{"id": key, "name": item["name"], "seconds": round(float(item["seconds"]), 2), "size": item["size"], "url": f"{CUSTOM_URL_PATH}/{key}.wav"}
                for key, item in sorted(self.items.items(), key=lambda kv: kv[1]["name"].casefold())]

    def _check_name(self, name: str, ignore: str | None = None) -> None:
        if any(key != ignore and item["name"].casefold() == name.casefold() for key, item in self.items.items()):
            raise SoundError("name_taken")

    async def async_add(self, name: Any, raw: bytes, ffmpeg: str | None = None, sound_id: str | None = None) -> dict[str, Any]:
        """Hochgeladene Datei annehmen: prüfen, umwandeln, ablegen. Wirft SoundError mit dem Fehlerschlüssel."""
        title = clean_name(name)
        if not raw or len(raw) > MAX_UPLOAD_BYTES:
            raise SoundError("too_big")
        if len(self.items) >= MAX_CUSTOM_SOUNDS:
            raise SoundError("too_many")
        self._check_name(title)
        wav, seconds = await self.hass.async_add_executor_job(convert, raw, ffmpeg)
        if self.total_bytes() + len(wav) > MAX_CUSTOM_TOTAL_BYTES:
            raise SoundError("no_space")
        key = sound_id or f"custom_{uuid.uuid4().hex[:12]}"
        await self.hass.async_add_executor_job(self._write, key, wav)
        self.items[key] = {"name": title, "seconds": seconds, "size": len(wav), "created": time.time()}
        await self._save()
        return self.listing_item(key)

    def listing_item(self, key: str) -> dict[str, Any]:
        return next(item for item in self.listing() if item["id"] == key)

    def _write(self, key: str, wav: bytes) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        (self.dir / f"{key}.wav").write_bytes(wav)

    async def async_rename(self, sound_id: str, name: Any) -> None:
        if not self.has(sound_id):
            raise SoundError("not_found")
        title = clean_name(name)
        self._check_name(title, ignore=sound_id)
        self.items[sound_id]["name"] = title
        await self._save()

    async def async_delete(self, sound_id: str) -> None:
        if not self.has(sound_id):
            raise SoundError("not_found")
        del self.items[sound_id]
        await self.hass.async_add_executor_job(lambda: self.path(sound_id).unlink(missing_ok=True))
        await self._save()
        # Der Speicher der gebauten Dateien (sound_loop) vergisst den Ton
        from . import sound_loop

        sound_loop.forget(self.hass, sound_id)

    # ----- Sicherung -----

    async def async_export(self) -> list[dict[str, Any]]:
        """Alle eigenen Töne mit ihren Daten (Base64) für die Sicherung."""
        def read() -> list[dict[str, Any]]:
            out = []
            for key, item in self.items.items():
                out.append({"id": key, "name": item["name"], "seconds": round(float(item["seconds"]), 3), "wav": base64.b64encode(self.path(key).read_bytes()).decode()})
            return out

        return await self.hass.async_add_executor_job(read)

    async def async_import(self, sounds: list[dict[str, Any]]) -> list[str]:
        """Töne aus einer Sicherung zurückholen: nur, was es noch nicht gibt (gleiche Kennung bleibt unverändert). Gibt die neuen Kennungen zurück."""
        added: list[str] = []
        for item in sounds:
            key = item["id"]
            if self.has(key):
                continue
            try:
                raw = base64.b64decode(item["wav"], validate=True)
                name = item["name"]
                if any(other["name"].casefold() == name.casefold() for other in self.items.values()):
                    name = f"{name} ({key[-4:]})"[:MAX_CUSTOM_NAME]
                await self.async_add(name, raw, None, sound_id=key)
                added.append(key)
            except (SoundError, ValueError):
                _LOGGER.warning("a custom sound of the backup could not be restored")
        return added


def valid_backup_sounds(items: Any) -> list[dict[str, Any]]:
    """Eigene Töne einer Sicherung prüfen: Form, Kennung, Name, Base64 und Grösse; ob die Datei ein Ton ist, prüft das Zurückholen."""
    out: list[dict[str, Any]] = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not ID_RE.match(item["id"]) or not isinstance(item.get("name"), str) or not isinstance(item.get("wav"), str):
            continue
        if len(item["wav"]) > MAX_UPLOAD_BYTES * 4 // 3 + 16:
            continue
        out.append({"id": item["id"], "name": " ".join(item["name"].split())[:MAX_CUSTOM_NAME] or "Ton", "wav": item["wav"]})
    return out[:MAX_CUSTOM_SOUNDS]


# ----- Adressen -----


class CustomSoundView(HomeAssistantView):
    """Ein eigener Ton, wie er abgelegt ist (Vorschau im Panel, ohne Anmeldung wie die mitgelieferten Töne)."""

    url = CUSTOM_URL_PATH + "/{name}.wav"
    name = "alarmageddon:custom_sound"
    requires_auth = False

    async def get(self, request: web.Request, name: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        reg: CustomSounds | None = hass.data.get(DATA_CUSTOM_SOUNDS)
        if reg is None or not reg.has(name):
            return web.Response(status=404)
        data = await hass.async_add_executor_job(reg.path(name).read_bytes)
        return web.Response(body=data, content_type="audio/wav", headers={"Cache-Control": "no-store"})


class SoundUploadView(HomeAssistantView):
    """Hochladen (Administratoren): Formular mit "name" und "file". Antwort: der neue Ton oder ein Fehlerschlüssel."""

    url = "/api/alarmageddon/sounds"
    name = "api:alarmageddon:sounds"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        user = request.get("hass_user")
        if user is None or not user.is_admin:
            return web.json_response({"error": "unauthorized"}, status=401)
        reg: CustomSounds | None = hass.data.get(DATA_CUSTOM_SOUNDS)
        if reg is None:
            return web.json_response({"error": "unavailable"}, status=503)
        if request.content_length and request.content_length > MAX_UPLOAD_BYTES + 64 * 1024:
            return web.json_response({"error": "too_big"}, status=413)
        name, raw = "", b""
        try:
            reader = await request.multipart()
            while (part := await reader.next()) is not None:
                if part.name == "name":
                    name = (await part.text())[:200]
                elif part.name == "file":
                    chunks: list[bytes] = []
                    size = 0
                    while chunk := await part.read_chunk(64 * 1024):
                        size += len(chunk)
                        if size > MAX_UPLOAD_BYTES:
                            return web.json_response({"error": "too_big"}, status=413)
                        chunks.append(chunk)
                    raw = b"".join(chunks)
        except (web.HTTPException, ValueError, AssertionError):
            return web.json_response({"error": "invalid_sound"}, status=400)
        try:
            item = await reg.async_add(name, raw, ffmpeg_binary(hass))
        except SoundError as err:
            return web.json_response({"error": err.code}, status=400)
        return web.json_response({"sound": item})


async def async_setup(hass: HomeAssistant) -> CustomSounds:
    """Einmal je Home Assistant: Verzeichnis laden und die Adressen anmelden."""
    reg = hass.data.get(DATA_CUSTOM_SOUNDS)
    if reg is None:
        reg = CustomSounds(hass)
        await reg.async_load()
        hass.data[DATA_CUSTOM_SOUNDS] = reg
        hass.http.register_view(CustomSoundView())
        hass.http.register_view(SoundUploadView())
    return reg
