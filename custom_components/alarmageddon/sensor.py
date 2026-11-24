"""
Status der Anlage als Entität (1.34.0): wie viele Dinge Aufmerksamkeit brauchen (Alarm, nicht erreichbare Sensoren, schwache Batterien und
seit 1.65.0 die Befunde des Selbsttests, Entscheid des Nutzers 2026-11-18: sie zählen mit).

Die Infokarte für Dashboards liest sie. Das Panel braucht Administratorrechte, die Karte nicht: sie darf nur lesen, was jeder Nutzer in
Home Assistant sehen kann, also Entitäten. Gerechnet wird wie in der Infokarte des Panels: ein Sensor gilt als nicht erreichbar, sobald
er "nicht verfügbar" oder "unbekannt" meldet, eine Batterie als schwach unter der Schwelle der Wartung.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.components.alarm_control_panel import AlarmControlPanelState

from .const import DATA_HEALTHCHECK, DATA_SELFTEST, DEFAULT_NOTIFY, SIGNAL_HEALTHCHECK, SIGNAL_SELFTEST
from .controller import AlarmController
from .devices import battery_of
from .entity import AlarmageddonEntity

GONE = (STATE_UNAVAILABLE, STATE_UNKNOWN)


# Keine Abfrage, die Werte kommen vom Automaten und von Home Assistant (Quality Scale "parallel-updates", 1.87.0)
PARALLEL_UPDATES = 0

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([StatusSensor(entry, entry.runtime_data.controller)])


class StatusSensor(AlarmageddonEntity, SensorEntity):
    _attr_translation_key = "status"
    _attr_icon = "mdi:shield-check"

    def __init__(self, entry: ConfigEntry, controller: AlarmController) -> None:
        super().__init__(entry, "status")
        self._ctl = controller
        self._last: tuple[Any, ...] | None = None
        self._watch: tuple[set[str], dict[str, str]] = (set(), {})
        self._watch_for: Any = None

    def _threshold(self) -> float:
        settings = self._ctl.settings
        return float(((settings.notify if settings is not None else None) or DEFAULT_NOTIFY)["battery_threshold"])

    def _watched(self) -> tuple[set[str], dict[str, str]]:
        """
        Sensoren der Anlage und ihre Batteriesensoren, je Stand der Optionen einmal ermittelt (Home Assistant ersetzt das Objekt der Optionen bei
        jeder Änderung, und die Anlage lädt dann neu). Bis 1.57.0 lief die Suche über die ganze Entitäts-Registry bei jedem Zustandswechsel
        eines Sensors, bis zu dreimal je Wechsel.
        """
        options = self._ctl.options
        if self._watch_for is not options:
            sensors = self._ctl.all_sensors()
            self._watch = (sensors, battery_of(self.hass, sensors))
            self._watch_for = options
        return self._watch

    def _problems(self) -> tuple[bool, list[str], list[dict[str, Any]]]:
        """(Alarm läuft, nicht erreichbare Sensoren, schwache Batterien) dieser Anlage."""
        sensors, batteries = self._watched()
        offline = sorted(s for s in sensors if (state := self.hass.states.get(s)) is not None and state.state in GONE)
        low: list[dict[str, Any]] = []
        threshold = self._threshold()
        for sensor, battery in sorted(batteries.items()):
            state = self.hass.states.get(battery)
            try:
                value = float(state.state) if state is not None and state.state not in GONE else None
            except ValueError:
                value = None
            if value is not None and value < threshold:
                low.append({"entity_id": sensor, "battery": round(value)})
        return self._ctl.state == AlarmControlPanelState.TRIGGERED, offline, low

    def _selftest(self) -> tuple[int, str | None]:
        """Befunde des Selbsttests, die diese Anlage betreffen, und die Zeit der letzten Prüfung (1.65.0)."""
        selftest = self.hass.data.get(DATA_SELFTEST) if self.hass is not None else None
        if selftest is None:
            return 0, None
        return len(selftest.for_entry(self._entry.entry_id)), selftest.last

    def _healthcheck(self) -> dict[str, int]:
        """Zusammenfassung der HealthCheck-Dienste (1.72.0, für die Dashboard-Karte): nur Zahlen, nie eine URL; ohne Dienste alles 0."""
        healthcheck = self.hass.data.get(DATA_HEALTHCHECK) if self.hass is not None else None
        try:
            return healthcheck.summary() if healthcheck is not None else {"count": 0, "ok": 0, "report": 0, "fail": 0}
        except Exception:  # noqa: BLE001 - nur eine Anzeige: die übrigen Angaben der Entität bleiben
            return {"count": 0, "ok": 0, "report": 0, "fail": 0}

    @property
    def native_value(self) -> int:
        alarm, offline, low = self._problems()
        return int(alarm) + len(offline) + len(low) + self._selftest()[0]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        alarm, offline, low = self._problems()
        selftest, last = self._selftest()
        hc = self._healthcheck()
        return {"alarm": alarm, "offline": offline, "low_battery": low, "battery_threshold": self._threshold(), "selftest": selftest, "selftest_last": last,
                "healthcheck": hc["count"], "healthcheck_ok": hc["ok"], "healthcheck_report": hc["report"], "healthcheck_fail": hc["fail"]}

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(self._ctl.add_listener(self._refresh))
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_SELFTEST, self._refresh))
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_HEALTHCHECK, self._refresh))
        sensors, batteries = self._watched()
        watched = sorted(sensors | set(batteries.values()))
        if watched:
            self.async_on_remove(async_track_state_change_event(self.hass, watched, self._on_change))

    @callback
    def _on_change(self, _event: Event[EventStateChangedData]) -> None:
        self._refresh()

    @callback
    def _refresh(self) -> None:
        # Nur schreiben, wenn sich etwas ändert: Sensoren melden ständig neue Attribute
        alarm, offline, low = self._problems()
        key = (alarm, tuple(offline), tuple((x["entity_id"], x["battery"]) for x in low), self._selftest(), tuple(self._healthcheck().values()))
        if key != self._last:
            self._last = key
            self.async_write_ha_state()
