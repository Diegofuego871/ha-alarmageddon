"""
Diagnose einer Anlage (1.87.0, Quality Scale "diagnostics"): Einstellungen und Zustand zum Herunterladen unter Einstellungen › Geräte und Dienste.

Geheimnisse nie: Code, Hash, Salz und persönliche Codes fallen weg (wie im Backup). Die Ping-URLs der HealthCheck-Dienste stehen in den globalen
Einstellungen, nicht in der Anlage, und kommen nicht hinein.
"""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_CODE_HASH, CONF_CODE_SALT, CONF_CODES

TO_REDACT = {CONF_CODE_HASH, CONF_CODE_SALT, CONF_CODES, "hash", "salt", "code"}


def _redact(value: Any) -> Any:
    """Wie async_redact_data der Diagnose von HA, ohne die Integration "diagnostics" zu importieren (das Manifest bleibt ohne sie)."""
    if isinstance(value, dict):
        return {k: ("**REDACTED**" if k in TO_REDACT else _redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    runtime = getattr(entry, "runtime_data", None)
    controller = getattr(runtime, "controller", None)
    workflow = getattr(runtime, "workflow", None)
    state: dict[str, Any] = {}
    if controller is not None:
        state = {
            "state": str(controller.state),
            "mode": controller.mode,
            "modes": list(controller.modes),
            "deadline": controller.deadline.isoformat() if controller.deadline else None,
            "triggered_by": controller.triggered_by,
            "bypassed": sorted(controller.bypassed),
            "alarm_plan": controller.alarm_plan() if str(controller.state) == "triggered" else [],
            "has_code": controller.has_code,
            "personal_codes": len(controller.codes),
        }
    running = workflow.running if workflow is not None else None
    return {
        "version": getattr(runtime, "version", None),
        "options": _redact(dict(entry.options)),
        "controller": state,
        "workflow": {"running": running is not None, "trigger": (running or {}).get("trigger"), "index": (running or {}).get("index"),
                     "test": bool((running or {}).get("test")), "phase": (running or {}).get("phase")},
    }
