"""
Laden des Panels (1.58.0): panel.html meldet alle Module vorab an (modulepreload), damit der Browser sie gleichzeitig holt statt eines nach dem
anderen. Die Liste muss vollständig sein: ein Modul, das dort fehlt, lädt wieder erst, wenn das Modul davor fertig ist.
"""

from __future__ import annotations

import pathlib
import re

PANEL = pathlib.Path(__file__).resolve().parents[1] / "custom_components" / "alarmageddon" / "panel"


def _preloaded() -> set[str]:
    html = (PANEL / "panel.html").read_text(encoding="utf-8")
    block = re.search(r"const MODULES = \[(.*?)\];", html, re.S)
    assert block, "die Liste MODULES fehlt in panel.html"
    return set(re.findall(r'"([a-z-]+)"', block.group(1)))


def test_every_module_of_the_panel_is_preloaded() -> None:
    # card.js gehört nicht zum Panel: Home Assistant lädt es für die Dashboard-Karten selbst
    files = {path.stem for path in PANEL.glob("*.js")} - {"card"}
    assert _preloaded() == files


def test_the_panel_imports_its_modules_together() -> None:
    """Im Hauptmodul stehen keine `await import` in Folge mehr (jedes wartete auf das vorige), sondern ein gemeinsames Promise.all."""
    source = (PANEL / "alarmageddon-panel.js").read_text(encoding="utf-8")
    assert "await Promise.all(" in source
    assert len(re.findall(r"^const .* = await import\(", source, re.M)) == 0


def test_panel_html_takes_new_states_several_times_a_second() -> None:
    """Zustände (Alarm, Eingangsverzögerung) kommen ohne Verzug an: das hass-Objekt wird mehrmals je Sekunde abgeholt, nicht alle 5 Sekunden."""
    html = (PANEL / "panel.html").read_text(encoding="utf-8")
    match = re.search(r"setInterval\(applyHass, (\d+)\)", html)
    assert match and int(match.group(1)) <= 500
    assert "hass !== lastHass" in html
