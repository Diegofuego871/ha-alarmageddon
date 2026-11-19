"""
Letzte echte Änderung eines Sensors (0.25.0): nur ein Wechsel zwischen "offen" und "zu" zählt.

Home Assistant setzt `last_changed` bei jedem Neustart und jeder Neuverbindung zurück ("nicht verfügbar" -> "zu"). Die Liste
soll aber zeigen, wann der Sensor zuletzt wirklich auf- oder zugegangen ist. Darum merkt sich Alarmageddon diesen Zeitpunkt selbst
(Speicher der Einstellungen) und holt für Sensoren ohne gemerkten Wert einmal den Verlauf (Recorder, letzte 90 Tage).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from functools import partial
import logging
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

HISTORY_DAYS = 90
_REAL = (STATE_ON, STATE_OFF)


def is_real_change(old: str | None, new: str | None) -> bool:
    """Nur auf <-> zu; alles mit "nicht verfügbar" oder "unbekannt" (Neustart, Funkabbruch) ist keine Änderung."""
    return old in _REAL and new in _REAL and old != new


def last_real_change(items: list[tuple[datetime, str]]) -> datetime | None:
    """
    Aus dem Verlauf (Zeit, Zustand), aufsteigend: der Zeitpunkt des letzten Wechsels zwischen "offen" und "zu". "Nicht verfügbar"
    dazwischen wird übersprungen; der erste Eintrag (Zustand zu Beginn des Zeitraums) ist kein Wechsel.
    """
    prev: str | None = None
    found: datetime | None = None
    for when, state in items:
        if state not in _REAL:
            continue
        if prev is not None and state != prev:
            found = when
        prev = state
    return found


def state_since(items: list[tuple[datetime, str]], known: datetime | None = None) -> dict[str, Any]:
    """
    Seit wann der jetzige Zustand gilt, für die Kachel "Verlauf" der Sensoransicht (1.66.2, Wunsch des Nutzers 2026-11-19: "in Ordnung
    seit 13:23" und "ruhig seit 13:23" zeigten den Neustart von Home Assistant statt der letzten Bewegung oder Auslösung).

    `items` ist der Verlauf (Zeit, Zustand) aufsteigend, der erste Eintrag der Zustand zu Beginn des Zeitraums (kein Wechsel). Nur ein
    Wechsel zwischen "offen" und "zu" zählt; "nicht verfügbar" und "unbekannt" dazwischen (Neustart, Neuverbindung) werden übersprungen,
    gleich wie in `last_real_change`. Ist der Sensor jetzt nicht erreichbar, gilt der Beginn dieser Unterbrechung, auch über einen Neustart
    hinweg. `known` ist die gemerkte letzte echte Änderung (Speicher der Einstellungen): sie gilt, wenn der Verlauf keinen späteren Wechsel
    kennt (der Zeitraum ist kürzer als die Ruhe des Sensors, oder der Recorder fehlt).

    Rückgabe: `state` ("on", "off", "gone" oder None), `t` (seit wann, None = nicht bekannt), `real` und `real_t` (der letzte bekannte
    Zustand "offen" oder "zu" und seit wann; das Panel braucht sie, wenn der Sensor nach der Antwort zurückkehrt).
    """
    real: str | None = None
    real_t: datetime | None = None
    gone = False
    gone_t: datetime | None = None
    for when, state in items:
        if state in _REAL:
            if real is not None and state != real:
                real_t = when
            elif real is None:
                real_t = None  # der Zustand zu Beginn des Verlaufs: seit wann er gilt, steht nicht darin
            real, gone, gone_t = state, False, None
        elif not gone:
            # Beginn der Unterbrechung; ohne bekannten Zustand davor begann sie vor dem Verlauf
            gone, gone_t = True, when if real is not None else None
    if real is not None and known is not None and (real_t is None or known > real_t):
        real_t = known
    return {"state": "gone" if gone else real, "t": _iso(gone_t if gone else real_t), "real": real, "real_t": _iso(real_t)}


def _iso(when: datetime | None) -> str | None:
    return when.isoformat() if when is not None else None


def _item(item: Any) -> tuple[datetime, str] | None:
    if isinstance(item, dict):
        state, when = item.get("state"), item.get("last_changed")
        when = dt_util.parse_datetime(when) if isinstance(when, str) else when
    else:
        state, when = item.state, item.last_changed
    return (when, str(state)) if isinstance(when, datetime) and state is not None else None


async def async_history_changes(hass: HomeAssistant, entities: list[str]) -> dict[str, str]:
    """Letzte echte Änderung je Sensor aus dem Verlauf; ohne Recorder oder ohne Wechsel in 90 Tagen fehlt der Eintrag."""
    if not entities or "recorder" not in hass.config.components:
        return {}
    from homeassistant.components.recorder import get_instance, history  # noqa: PLC0415 - nur mit Recorder

    start = dt_util.utcnow() - timedelta(days=HISTORY_DAYS)
    try:
        states = await get_instance(hass).async_add_executor_job(
            partial(history.get_significant_states, hass, start, None, entities,
                    significant_changes_only=False, minimal_response=True, no_attributes=True)
        )
    except Exception:  # noqa: BLE001 - die Liste darf wegen des Verlaufs nie ausfallen
        _LOGGER.exception("Sensor history could not be read")
        return {}
    out: dict[str, str] = {}
    for entity_id in entities:
        items = sorted(p for item in states.get(entity_id, []) if (p := _item(item)))
        if (found := last_real_change(items)) is not None:
            out[entity_id] = found.isoformat()
    return out
