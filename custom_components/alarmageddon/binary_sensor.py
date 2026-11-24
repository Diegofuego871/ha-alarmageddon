"""
Eine Entität pro Zone: "ein" sobald ein Sensor der Zone offen ist.

Statt HA-Helfergruppen (Entscheid im Konzept): Die Zonen gehören zur
Integration, der Nutzer kann sie nicht versehentlich löschen oder umbauen.

Dazu (1.65.0) je Anlage der Selbsttest: "Problem", solange der Selbsttest
etwas gefunden hat, das die Anlage betrifft (selftest.py).
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN, EntityCategory
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from .const import DATA_SELFTEST, SIGNAL_SELFTEST
from .controller import AlarmController
from .entity import AlarmageddonEntity

# So viele Befunde stehen in den Attributen (der Rest im Panel); die Liste wird nicht aufgezeichnet
SELFTEST_ATTR_ITEMS = 20


# Keine Abfrage, die Werte kommen vom Automaten und von Home Assistant (Quality Scale "parallel-updates", 1.87.0)
PARALLEL_UPDATES = 0

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    controller: AlarmController = entry.runtime_data.controller
    async_add_entities([
        *(ZoneSensor(entry, controller, mode) for mode in controller.modes),
        *(ReadySensor(entry, controller, mode) for mode in controller.modes),
        SelfTestSensor(entry),
    ])


class ZoneSensor(AlarmageddonEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.SAFETY

    def __init__(self, entry: ConfigEntry, controller: AlarmController, mode: str) -> None:
        super().__init__(entry, f"zone_{mode}")
        self._ctl = controller
        self._mode = mode
        self._attr_translation_key = f"zone_{mode}"

    @property
    def _members(self) -> list[str]:
        return self._ctl.zone(self._mode)

    @property
    def is_on(self) -> bool:
        return bool(self._ctl.open_sensors(self._mode))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"sensors": self._members, "open_sensors": self._ctl.open_sensors(self._mode)}

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        if self._members:
            self.async_on_remove(async_track_state_change_event(self.hass, self._members, self._on_member))

    @callback
    def _on_member(self, event: Event[EventStateChangedData]) -> None:
        old, new = event.data["old_state"], event.data["new_state"]
        # Nur schreiben, wenn sich "offen" ändert; Attribute der Sensoren (Batterie, Signal) ändern oft
        if (old is not None and old.state == STATE_ON) != (new is not None and new.state == STATE_ON):
            self.async_write_ha_state()


class ReadySensor(AlarmageddonEntity, BinarySensorEntity):
    """
    "Bereit zum Scharfschalten" je Modus (aus Alarmo übernommen, Entscheid des
    Nutzers): ein, wenn kein offener und (seit 1.87.0) kein nicht erreichbarer
    Sensor mit "Muss beim Scharfschalten erreichbar sein" das Scharfschalten
    verhindert. Für Automationen, Wandtablets und die Übersicht im Panel.
    """

    def __init__(self, entry: ConfigEntry, controller: AlarmController, mode: str) -> None:
        super().__init__(entry, f"ready_{mode}")
        self._ctl = controller
        self._mode = mode
        self._attr_translation_key = f"ready_{mode}"

    @property
    def is_on(self) -> bool:
        return self._ctl.ready(self._mode)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"blocking_sensors": self._ctl.blocking_sensors(self._mode), "unreachable_sensors": self._ctl.blocking_unreachable(self._mode)}

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        if members := self._ctl.zone(self._mode):
            self.async_on_remove(async_track_state_change_event(self.hass, members, self._on_member))

    @callback
    def _on_member(self, event: Event[EventStateChangedData]) -> None:
        # Offen und (seit 1.87.0) erreichbar zählen beide: ein Sensor, der von "zu" auf "nicht verfügbar" geht, ändert "Bereit" ebenso
        if _readiness(event.data["old_state"]) != _readiness(event.data["new_state"]):
            self.async_write_ha_state()


def _readiness(state: State | None) -> tuple[bool, bool]:
    """Was an einem Sensor für "Bereit" zählt: offen, nicht erreichbar (fehlt, nicht verfügbar, unbekannt)."""
    return (state is not None and state.state == STATE_ON, state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN))


class SelfTestSensor(AlarmageddonEntity, BinarySensorEntity):
    """
    Selbsttest der Anlage (1.65.0, Wunsch des Nutzers: eine Entität je Anlage): "Problem", solange der Selbsttest etwas gefunden hat, das
    diese Anlage betrifft (ihre eigenen Befunde und die für alle Anlagen, zum Beispiel ein fehlender Empfänger). Vor der ersten Prüfung
    "unbekannt". Attribute: Zeit der letzten Prüfung, Zahl der Befunde und die ersten Befunde (nur Art und Kennung, nie Geheimnisse).
    """

    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_translation_key = "selftest"
    _unrecorded_attributes = frozenset({"problems"})

    def __init__(self, entry: ConfigEntry) -> None:
        super().__init__(entry, "selftest")

    def _state(self) -> tuple[str | None, list[dict[str, Any]]]:
        selftest = self.hass.data.get(DATA_SELFTEST) if self.hass is not None else None
        if selftest is None:
            return None, []
        return selftest.last, selftest.for_entry(self._entry.entry_id)

    @property
    def is_on(self) -> bool | None:
        last, problems = self._state()
        if last is None and not problems:
            return None
        return bool(problems)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        last, problems = self._state()
        items = [{"code": p["code"], "kind": p["kind"], **({"entity_id": p["entity_id"]} if p.get("entity_id") else {}),
                  **({"service": p["service"]} if p.get("service") else {})} for p in problems[:SELFTEST_ATTR_ITEMS]]
        return {"last_check": last, "count": len(problems), "problems": items}

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_SELFTEST, self._refresh))

    @callback
    def _refresh(self) -> None:
        self.async_write_ha_state()
