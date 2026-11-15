"""
hassfest (in der CI) verlangt jede importierte Integration in "dependencies" oder "after_dependencies". Lokal läuft hassfest nicht,
darum prüft dieser Test dasselbe: ein neuer Import scheitert hier und nicht erst nach dem Push (1.39.0: ffmpeg fehlte).
"""

from __future__ import annotations

import json
from pathlib import Path
import re

BASE = Path(__file__).resolve().parents[1] / "custom_components" / "alarmageddon"
# Plattformen, die jede Integration ohne Eintrag nutzen darf (hassfest: ALLOWED_USED_COMPONENTS, soweit hier gebraucht)
PLATFORMS = {"alarm_control_panel", "binary_sensor", "sensor", "button", "switch", "number", "select", "text", "event", "update"}


def test_every_imported_integration_is_declared_in_the_manifest() -> None:
    manifest = json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))
    declared = set(manifest.get("dependencies", [])) | set(manifest.get("after_dependencies", []))
    used: dict[str, str] = {}
    for path in BASE.glob("*.py"):
        for name in re.findall(r"homeassistant\.components\.([a-z_0-9]+)", path.read_text(encoding="utf-8")):
            used.setdefault(name, path.name)
    missing = {name: file for name, file in used.items() if name not in declared and name not in PLATFORMS}
    assert not missing, f"nicht im Manifest unter dependencies/after_dependencies: {missing}"
