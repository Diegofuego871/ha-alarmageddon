"""
Seit wann der Zustand eines Sensors gilt (1.66.2, Wunsch des Nutzers 2026-11-19). Die Kachel "Verlauf" der Sensoransicht zeigte "in Ordnung
seit 13:23" und "ruhig seit 13:23", die Zeit des Neustarts von Home Assistant (`last_changed` springt dann), statt der letzten Bewegung oder
Auslösung. Nur ein Wechsel zwischen "offen" und "zu" zählt; "nicht verfügbar" und "unbekannt" dazwischen nie.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from custom_components.alarmageddon.last_change import state_since

T0 = datetime(2026, 11, 19, 6, 0, tzinfo=datetime.now().astimezone().tzinfo)


def at(minutes: float) -> datetime:
    return T0 + timedelta(minutes=minutes)


def iso(minutes: float) -> str:
    return at(minutes).isoformat()


@pytest.mark.parametrize(("gap", "label"), [("unavailable", "Neustart mit 'nicht verfügbar'"), ("unknown", "Neustart mit 'unbekannt'")])
def test_a_restart_never_counts_as_a_change(gap: str, label: str) -> None:
    """Bewegung bis 07:07, Neustart 07:23 ("nicht verfügbar" oder "unbekannt", dann wieder "zu"): ruhig seit 07:07, nicht seit 07:23."""
    items = [(at(0), "off"), (at(60), "on"), (at(67), "off"), (at(83), gap), (at(83.5), "off")]
    assert state_since(items) == {"state": "off", "t": iso(67), "real": "off", "real_t": iso(67)}, label


def test_a_fresh_state_after_a_restart_without_a_gap_is_no_change() -> None:
    """Home Assistant legt beim Start einen neuen Zustand an (gleicher Wert, neue Zeit): kein Wechsel."""
    items = [(at(0), "on"), (at(10), "off"), (at(83), "off")]
    assert state_since(items)["t"] == iso(10)


def test_open_since_the_real_opening_even_across_a_reconnect() -> None:
    """Offen seit 07:00, Funkabbruch 07:30 bis 07:35, wieder offen: offen seit 07:00."""
    items = [(at(0), "off"), (at(60), "on"), (at(90), "unavailable"), (at(95), "on")]
    assert state_since(items) == {"state": "on", "t": iso(60), "real": "on", "real_t": iso(60)}


def test_back_in_another_state_after_a_gap_is_a_change() -> None:
    """Zu, nicht erreichbar, offen zurück: das ist ein echter Wechsel (zur Zeit der Rückkehr)."""
    items = [(at(0), "off"), (at(30), "unavailable"), (at(40), "on")]
    assert state_since(items)["t"] == iso(40)


def test_unreachable_since_the_start_of_the_gap_across_a_restart() -> None:
    """Nicht erreichbar seit 06:30; beim Neustart 07:23 kommt wieder "nicht verfügbar", später "unbekannt": seit 06:30."""
    items = [(at(0), "off"), (at(10), "on"), (at(12), "off"), (at(30), "unavailable"), (at(83), "unavailable"), (at(84), "unknown")]
    assert state_since(items) == {"state": "gone", "t": iso(30), "real": "off", "real_t": iso(12)}


def test_unknown_when_nothing_changed_in_the_history() -> None:
    """Kein Wechsel im Verlauf und nichts gemerkt (ein Rauchmelder, der nie ausgelöst hat): keine Zeit, nie die des Neustarts."""
    assert state_since([(at(0), "off"), (at(83), "unavailable"), (at(83.5), "off")]) == {"state": "off", "t": None, "real": "off", "real_t": None}
    # Nicht erreichbar seit vor dem Verlauf: der Beginn ist nicht bekannt
    assert state_since([(at(0), "unavailable"), (at(83), "unknown")]) == {"state": "gone", "t": None, "real": None, "real_t": None}
    assert state_since([]) == {"state": None, "t": None, "real": None, "real_t": None}


def test_the_remembered_change_fills_in_and_never_hides_a_newer_one() -> None:
    """Die gemerkte letzte echte Änderung gilt, wenn der Verlauf keinen Wechsel kennt; ein neuerer im Verlauf geht vor, ein neuerer gemerkter auch."""
    quiet = [(at(0), "off"), (at(83), "unavailable"), (at(83.5), "off")]
    assert state_since(quiet, at(-600))["t"] == iso(-600)
    changed = [(at(0), "off"), (at(10), "on"), (at(12), "off")]
    assert state_since(changed, at(-600))["t"] == iso(12)
    assert state_since(changed, at(20))["t"] == iso(20)
    # Nicht erreichbar: der gemerkte Wert gilt nur für den Zustand davor
    assert state_since([(at(0), "off"), (at(30), "unavailable")], at(-600)) == {"state": "gone", "t": iso(30), "real": "off", "real_t": iso(-600)}
