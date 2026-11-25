"""
Einrichtung: Anlegen einer Anlage (Name, Nacht, Code) und Optionen.

Die Optionen sind die Übergangslösung bis zum Panel (Phase 2): Das Panel
schreibt später dieselben Schlüssel. Mehrere Anlagen pro HA sind erlaubt
(Vorgabe des Nutzers), nur gleiche Namen nicht.
"""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol

from homeassistant.components.alarm_control_panel import AlarmControlPanelState
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

from .code import hash_code, match_code
from .systems import new_system_name
from .const import (
    CODE_PATTERN,
    CONF_CODE_ACK_REQUIRED,
    CONF_CODE_MODE_REQUIRED,
    CONF_CODE_ARM_REQUIRED,
    CONF_CODE_HASH,
    CONF_CODE_SALT,
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
    FIELD_CODE,
    FIELD_REMOVE_CODE,
    MAX_DELAY,
    MODE_ENABLED_DEFAULT,
    MODE_ENABLED_KEY,
    MODES,
)

SECTION_ZONES = "zones"
SECTION_DELAYS = "delays"
SECTION_BEHAVIOUR = "behaviour"
SECTION_CODE = "code_section"

_SENSORS = selector.EntitySelector(selector.EntitySelectorConfig(domain="binary_sensor", multiple=True))
_SECONDS = selector.NumberSelector(
    selector.NumberSelectorConfig(min=0, max=MAX_DELAY, step=1, unit_of_measurement="s", mode=selector.NumberSelectorMode.BOX)
)
_CODE = selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD))


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


def _valid_code(code: str) -> bool:
    return re.fullmatch(CODE_PATTERN, code) is not None


class AlarmageddonConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            # Wie im Panel (1.63.0): doppelte Leerzeichen fallen weg, ein vergebener Name zählt ohne Gross-/Kleinschreibung ("haus" neben
            # "Haus" gab es sonst, das Panel lehnte es ab)
            name, name_error = new_system_name(self.hass, user_input[CONF_NAME])
            code = (user_input.get(FIELD_CODE) or "").strip()
            if name_error:
                errors[CONF_NAME] = name_error
            elif code and not _valid_code(code):
                errors[FIELD_CODE] = "invalid_code_format"
            else:
                options = default_options()
                options[CONF_NIGHT_ENABLED] = bool(user_input.get(CONF_NIGHT_ENABLED, False))
                if code:
                    options[CONF_CODE_HASH], options[CONF_CODE_SALT] = await self.hass.async_add_executor_job(
                        hash_code, code
                    )
                return self.async_create_entry(title=name, data={CONF_NAME: name}, options=options)

        schema = vol.Schema(
            {
                vol.Required(CONF_NAME): selector.TextSelector(),
                vol.Optional(CONF_NIGHT_ENABLED, default=False): selector.BooleanSelector(),
                vol.Optional(FIELD_CODE): _CODE,
            }
        )
        # Den eingegebenen Code nie als Vorschlag zurückgeben (Sicherheitsregel: der Code bleibt im Eingabefeld des Nutzers)
        suggested = {k: v for k, v in (user_input or {}).items() if k != FIELD_CODE}
        return self.async_show_form(step_id="user", data_schema=self.add_suggested_values_to_schema(schema, suggested), errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return AlarmageddonOptionsFlow()


class AlarmageddonOptionsFlow(OptionsFlow):
    """Zonen, Verzögerungen, Verhalten und Code einer Anlage."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        current = {**default_options(), **self.config_entry.options}
        errors: dict[str, str] = {}
        if user_input is not None:
            zones = user_input.get(SECTION_ZONES, {})
            delays = user_input.get(SECTION_DELAYS, {})
            behaviour = user_input.get(SECTION_BEHAVIOUR, {})
            code_input = user_input.get(SECTION_CODE, {})
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
            new_code = (code_input.get(FIELD_CODE) or "").strip()
            # Wie im Panel (save_system): nie den Modus abschalten, in dem die Anlage gerade scharf ist oder wird. Nach dem Neuladen fände
            # der Zustand keinen Modus mehr und die Anlage wäre still deaktiviert.
            controller = getattr(getattr(self.config_entry, "runtime_data", None), "controller", None)
            if controller is not None and controller.mode and controller.mode not in active and controller.state != AlarmControlPanelState.DISARMED:
                errors["base"] = "mode_active"
            elif set(options[CONF_ENTRY_SENSORS]) - in_zones:
                errors["base"] = "entry_not_in_zone"
            elif new_code and not _valid_code(new_code):
                errors["base"] = "invalid_code_format"
            elif new_code and code_input.get(FIELD_REMOVE_CODE):
                errors["base"] = "code_and_remove"
            else:
                if code_input.get(FIELD_REMOVE_CODE):
                    options.pop(CONF_CODE_HASH, None)
                    options.pop(CONF_CODE_SALT, None)
                elif new_code:
                    # Nie derselbe Code wie ein persönlicher (1.63.0, wie add_code und update_code umgekehrt): sonst wäre "geändert von" leer,
                    # obwohl die Person ihren Code getippt hat
                    personal = [(c["hash"], c["salt"]) for c in options.get(CONF_CODES) or [] if isinstance(c, dict) and c.get("hash") and c.get("salt")]
                    if personal and await self.hass.async_add_executor_job(match_code, new_code, personal) is not None:
                        errors["base"] = "code_taken"
                    else:
                        options[CONF_CODE_HASH], options[CONF_CODE_SALT] = await self.hass.async_add_executor_job(
                            hash_code, new_code
                        )
                if errors:
                    pass
                elif (options[CONF_CODE_ARM_REQUIRED] or options[CONF_CODE_ACK_REQUIRED]) and not options.get(CONF_CODE_HASH) and not options.get(CONF_CODES):
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
        code = vol.Schema(
            {
                vol.Optional(FIELD_CODE): _CODE,
                vol.Optional(FIELD_REMOVE_CODE, default=False): selector.BooleanSelector(),
            }
        )
        return vol.Schema(
            {
                vol.Required(SECTION_ZONES): section(zones, {"collapsed": False}),
                vol.Required(SECTION_DELAYS): section(delays, {"collapsed": True}),
                vol.Required(SECTION_BEHAVIOUR): section(behaviour, {"collapsed": True}),
                vol.Required(SECTION_CODE): section(code, {"collapsed": True}),
            }
        )
