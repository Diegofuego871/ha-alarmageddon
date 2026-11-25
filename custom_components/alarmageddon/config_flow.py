"""
Einrichtung: Anlegen einer Anlage (Name, Nacht; seit 1.90.0 ohne Code) und Optionen.

Die Optionen sind die Übergangslösung bis zum Panel (Phase 2): Das Panel
schreibt später dieselben Schlüssel. Mehrere Anlagen pro HA sind erlaubt
(Vorgabe des Nutzers), nur gleiche Namen nicht.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

from .systems import new_system_name
from .const import (
    CONF_CODE_ACK_REQUIRED,
    CONF_CODE_MODE_REQUIRED,
    CONF_CODE_ARM_REQUIRED,
    CONF_CODES,
    CONF_ENTRY_DELAY,
    CONF_ENTRY_SENSORS,
    CONF_EXIT_DELAY_PREFIX,
    CONF_NAME,
    CONF_NIGHT_ENABLED,
    CONF_ZONE_PREFIX,
    DEFAULT_ENTRY_DELAY,
    DEFAULT_EXIT_DELAY,
    DOMAIN,
    MAX_DELAY,
    MODE_ENABLED_DEFAULT,
    MODE_ENABLED_KEY,
    MODES,
)

SECTION_ZONES = "zones"
SECTION_DELAYS = "delays"
SECTION_BEHAVIOUR = "behaviour"

_SENSORS = selector.EntitySelector(selector.EntitySelectorConfig(domain="binary_sensor", multiple=True))
_SECONDS = selector.NumberSelector(
    selector.NumberSelectorConfig(min=0, max=MAX_DELAY, step=1, unit_of_measurement="s", mode=selector.NumberSelectorMode.BOX)
)


def default_options() -> dict[str, Any]:
    options: dict[str, Any] = {f"{CONF_ZONE_PREFIX}{mode}": [] for mode in MODES}
    options |= {f"{CONF_EXIT_DELAY_PREFIX}{mode}": DEFAULT_EXIT_DELAY[mode] for mode in MODES}
    options |= {
        CONF_NIGHT_ENABLED: False,
        CONF_ENTRY_SENSORS: [],
        CONF_ENTRY_DELAY: DEFAULT_ENTRY_DELAY,
        CONF_CODE_ARM_REQUIRED: False,
        CONF_CODE_ACK_REQUIRED: False,
        CONF_CODE_MODE_REQUIRED: True,
    }
    return options


def _has_code(options: dict[str, Any]) -> bool:
    """Wie AlarmController.has_code: ein vollständiger Code pro Person (seit 1.90.0 die einzigen Codes; sie entstehen nur im Panel)."""
    return any(isinstance(c, dict) and c.get("hash") and c.get("salt") for c in options.get(CONF_CODES) or [])


class AlarmageddonConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            # Wie im Panel (1.63.0): doppelte Leerzeichen fallen weg, ein vergebener Name zählt ohne Gross-/Kleinschreibung ("haus" neben
            # "Haus" gab es sonst, das Panel lehnte es ab)
            name, name_error = new_system_name(self.hass, user_input[CONF_NAME])
            if name_error:
                errors[CONF_NAME] = name_error
            else:
                options = default_options()
                options[CONF_NIGHT_ENABLED] = bool(user_input.get(CONF_NIGHT_ENABLED, False))
                return self.async_create_entry(title=name, data={CONF_NAME: name}, options=options)

        # Seit 1.90.0 ohne Feld "Code": es gibt keinen Hauptcode mehr, die Codes pro Person legt man im Panel an (der Einrichtungsassistent
        # fragt im Schritt "Code" danach)
        schema = vol.Schema(
            {
                vol.Required(CONF_NAME): selector.TextSelector(),
                vol.Optional(CONF_NIGHT_ENABLED, default=False): selector.BooleanSelector(),
            }
        )
        return self.async_show_form(step_id="user", data_schema=self.add_suggested_values_to_schema(schema, user_input or {}), errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return AlarmageddonOptionsFlow()


class AlarmageddonOptionsFlow(OptionsFlow):
    """Zonen, Verzögerungen und Verhalten einer Anlage (die Codes stehen seit 1.90.0 nur im Panel)."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        current = {**default_options(), **self.config_entry.options}
        errors: dict[str, str] = {}
        if user_input is not None:
            zones = user_input.get(SECTION_ZONES, {})
            delays = user_input.get(SECTION_DELAYS, {})
            behaviour = user_input.get(SECTION_BEHAVIOUR, {})
            options = dict(current)
            for mode in MODES:
                options[f"{CONF_ZONE_PREFIX}{mode}"] = list(zones.get(f"{CONF_ZONE_PREFIX}{mode}", []))
                # NumberSelector liefert Kommazahlen (LEARNINGS): als int speichern wie später das Panel
                options[f"{CONF_EXIT_DELAY_PREFIX}{mode}"] = int(delays.get(f"{CONF_EXIT_DELAY_PREFIX}{mode}", 0))
            options[CONF_ENTRY_SENSORS] = list(delays.get(CONF_ENTRY_SENSORS, []))
            options[CONF_ENTRY_DELAY] = int(delays.get(CONF_ENTRY_DELAY, 0))
            # Dieser Dialog setzt gemeinsame Werte: ein geänderter Wert gilt für alle Modi (im Panel lassen sie sich je Modus einstellen)
            for key in (CONF_ENTRY_DELAY,):
                if options[key] != current[key]:
                    for scope in MODES:
                        options[f"{key}_{scope}"] = options[key]
            options[CONF_NIGHT_ENABLED] = bool(behaviour.get(CONF_NIGHT_ENABLED, False))
            options[CONF_CODE_ARM_REQUIRED] = bool(behaviour.get(CONF_CODE_ARM_REQUIRED, False))
            options[CONF_CODE_ACK_REQUIRED] = bool(behaviour.get(CONF_CODE_ACK_REQUIRED, False))
            options[CONF_CODE_MODE_REQUIRED] = bool(behaviour.get(CONF_CODE_MODE_REQUIRED, True))

            # Aktive Modi wie im Panel: Anwesend und Abwesend lassen sich dort abschalten, Nacht hier
            active = [m for m in MODES if bool(options.get(MODE_ENABLED_KEY[m], MODE_ENABLED_DEFAULT[m]))]
            in_zones = {e for m in active for e in options[f"{CONF_ZONE_PREFIX}{m}"]}
            # Wie im Panel (save_system): nie den Modus abschalten, in dem die Anlage gerade scharf ist oder wird. Nach dem Neuladen fände
            # der Zustand keinen Modus mehr und die Anlage wäre still deaktiviert.
            controller = getattr(getattr(self.config_entry, "runtime_data", None), "controller", None)
            if controller is not None and controller.mode and controller.mode not in active and controller.state != AlarmControlPanelState.DISARMED:
                errors["base"] = "mode_active"
            elif set(options[CONF_ENTRY_SENSORS]) - in_zones:
                errors["base"] = "entry_not_in_zone"
            # Seit 1.90.0 setzt dieser Dialog keinen Code mehr (kein Hauptcode): die Codes pro Person stehen im Panel
            elif (options[CONF_CODE_ARM_REQUIRED] or options[CONF_CODE_ACK_REQUIRED]) and not _has_code(options):
                errors["base"] = "code_missing"
            else:
                return self.async_create_entry(data=options)
            current = options

        return self.async_show_form(step_id="init", data_schema=self._schema(current), errors=errors)

    @staticmethod
    def _schema(o: dict[str, Any]) -> vol.Schema:
        zones = vol.Schema(
            {vol.Optional(f"{CONF_ZONE_PREFIX}{m}", default=o[f"{CONF_ZONE_PREFIX}{m}"]): _SENSORS for m in MODES}
        )
        delays = vol.Schema(
            {
                **{vol.Required(f"{CONF_EXIT_DELAY_PREFIX}{m}", default=o[f"{CONF_EXIT_DELAY_PREFIX}{m}"]): _SECONDS for m in MODES},
                vol.Required(CONF_ENTRY_DELAY, default=o[CONF_ENTRY_DELAY]): _SECONDS,
                vol.Optional(CONF_ENTRY_SENSORS, default=o[CONF_ENTRY_SENSORS]): _SENSORS,
            }
        )
        behaviour = vol.Schema(
            {
                vol.Required(CONF_NIGHT_ENABLED, default=o[CONF_NIGHT_ENABLED]): selector.BooleanSelector(),
                vol.Required(CONF_CODE_ARM_REQUIRED, default=o[CONF_CODE_ARM_REQUIRED]): selector.BooleanSelector(),
                vol.Required(CONF_CODE_ACK_REQUIRED, default=o.get(CONF_CODE_ACK_REQUIRED, False)): selector.BooleanSelector(),
                vol.Required(CONF_CODE_MODE_REQUIRED, default=o.get(CONF_CODE_MODE_REQUIRED, True) is not False): selector.BooleanSelector(),
            }
        )
        return vol.Schema(
            {
                vol.Required(SECTION_ZONES): section(zones, {"collapsed": False}),
                vol.Required(SECTION_DELAYS): section(delays, {"collapsed": True}),
                vol.Required(SECTION_BEHAVIOUR): section(behaviour, {"collapsed": True}),
            }
        )
