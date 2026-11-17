"""Zusatzsensoren eines Geräts (Batterie, Empfang), unabhängig von der Integration und der Funktechnik."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DATA_SETTINGS, DOMAIN


def device_sensors(hass: HomeAssistant) -> tuple[dict[str, str], dict[str, str]]:
    """
    (Batterie je Gerät, Empfang je Gerät) als device_id -> entity_id. Empfang
    ist Signalstärke (dBm) oder Verbindungsqualität (LQI), je nach
    Integration; nur wenn vorhanden.
    """
    batteries: dict[str, str] = {}
    signals: dict[str, str] = {}
    for entry in er.async_get(hass).entities.values():
        if entry.domain != "sensor" or not entry.device_id or entry.disabled_by:
            continue
        device_class = entry.device_class or entry.original_device_class
        if device_class == "battery":
            batteries.setdefault(entry.device_id, entry.entity_id)
        elif device_class == "signal_strength" or any(k in entry.entity_id for k in ("_lqi", "linkquality", "_rssi")):
            signals.setdefault(entry.device_id, entry.entity_id)
    return batteries, signals


def battery_of(hass: HomeAssistant, entity_ids: set[str]) -> dict[str, str]:
    """Sensor -> Batteriesensor desselben Geräts, nur wo es einen gibt."""
    registry = er.async_get(hass)
    batteries, _ = device_sensors(hass)
    out: dict[str, str] = {}
    for entity_id in entity_ids:
        reg = registry.async_get(entity_id)
        if reg and reg.device_id and reg.device_id in batteries:
            out[entity_id] = batteries[reg.device_id]
    return out


# -- Geräte-Registry verträglich lesen ------------------------------------------------------------------------------------------------
#
# Home Assistant hat die Geräte-Registry umgebaut (gemessen an 2026.10.4 und 2026.11.1; 2026.2.3 kennt es noch nicht): ein Gerät gehört
# zu genau einem Konfigurationseintrag (`config_entry_id`), und es gibt untergeordnete Geräte ohne eigene Hardware-Angaben. Die alten
# Zugriffe gibt es weiter, aber als veraltete Brücke: **jeder** Zugriff sucht den Aufrufer im Aufrufstapel und in allen geladenen
# Modulen (`frame.report_usage`, mehrere Millisekunden, im Event-Loop) und fällt 2027 weg. Die Übersicht las `config_entries` bis
# 1.59.0 je Sensor zweimal: an einer echten Anlage mit 151 Sensoren stand ganz Home Assistant bei jedem Abruf rund 1,4 Sekunden still
# (Aufzeichnung des Nutzers, 2026-11-17), bei offenem Panel alle 30 Sekunden. Darum laufen diese Zugriffe nur noch über die Funktionen
# hier; `tests/conftest.py` lässt jeden Test scheitern, bei dem Home Assistant eine veraltete Nutzung durch die Integration meldet.


def entry_ids(device: Any) -> set[str]:
    """Die Konfigurationseinträge eines Geräts: der eine neuerer Versionen, sonst die Menge älterer; alle bei einem zusammengesetzten Gerät."""
    if getattr(device, "is_composite_device", False):
        return set(device.config_entries)  # alte Geräte-ID, aus mehreren Einträgen zusammengesetzt: hier meldet der Zugriff nichts
    single = getattr(device, "config_entry_id", None)
    if single:
        return {single}
    return set(getattr(device, "config_entries", None) or ())


def main_device(hass: HomeAssistant, device: Any) -> Any:
    """
    Das Gerät mit der Hardware (Hersteller, Modell, Funkadresse): für ein untergeordnetes Gerät das übergeordnete, sonst es selbst.
    Fehlt das übergeordnete (beschädigte Registry), bleibt es beim Gerät selbst.
    """
    registry = None
    for _ in range(5):
        parent_id = getattr(device, "parent_device_id", None)
        if not parent_id:
            break
        registry = registry or dr.async_get(hass)
        parent = registry.async_get(parent_id)
        if parent is None:
            break
        device = parent
    return device


def device_field(device: Any, name: str) -> Any:
    """Hardware-Angabe eines Geräts; None, wo es sie nicht gibt (kein Gerät, oder ein untergeordnetes Gerät: dort wäre schon der Zugriff veraltet)."""
    if device is None or getattr(device, "parent_device_id", None):
        return None
    return getattr(device, name, None)


def system_device(hass: HomeAssistant, entry_id: str) -> Any:
    """Das Gerät einer Anlage in der Registry (Kennung: die ID ihres Eintrags), None ohne."""
    registry = dr.async_get(hass)
    lookup = getattr(registry, "async_get_device_by_identifier", None)
    if lookup is not None:
        return lookup((DOMAIN, entry_id), entry_id)
    return registry.async_get_device(identifiers={(DOMAIN, entry_id)})  # ältere Versionen: Kennungen sind dort eindeutig


def free_entity_id(registry: er.EntityRegistry, domain: str, object_id: str, current_entity_id: str | None = None) -> str:
    """Die nächste freie Entitäts-ID ("_2" bei belegter); `async_generate_entity_id` ist in neueren Versionen veraltet."""
    find = getattr(registry, "async_get_available_entity_id", None) or registry.async_generate_entity_id
    return find(domain, object_id, current_entity_id=current_entity_id)


NAME_SEPARATOR = " - "


def display_name(hass: HomeAssistant, entity_id: str) -> str:
    """
    Name eines Sensors, überall gleich (Panel, Protokoll, Meldungen, Fehlertexte).

    Der Nutzer wählt in der Ansicht (1.12.0, Einstellung `names_with_device`, für alle Geräte und auch für die Meldungen):
    - **an (Standard):** "Gerät - Sensor", der Name des Geräts und der eigene Name der Entität, mit Bindestrich getrennt. So ist
      jeder Sensor eindeutig, auch wenn mehrere von sich aus gleich heissen ("Bewegung").
    - **aus:** nur der eigene Name der Entität.

    Der eigene Name ist der, den der Nutzer der Entität gegeben hat, sonst der Name der Integration. Steht der Name des Geräts
    schon im eigenen Namen, wird er nicht noch einmal davorgesetzt. Die Hauptentität eines Geräts (ohne eigenen Namen) heisst wie
    das Gerät. Ohne Eintrag in der Registry und bei Entitäten, die ihren vollen Namen selbst tragen (has_entity_name aus, ältere
    Integrationen), gilt in beiden Fällen der Anzeigename von Home Assistant: dort gibt es nichts zusammenzusetzen.
    """
    state = hass.states.get(entity_id)
    fallback = state.name if state else entity_id
    reg = er.async_get(hass).async_get(entity_id)
    if reg is None or not getattr(reg, "has_entity_name", False):
        return fallback
    device = dr.async_get(hass).async_get(reg.device_id) if reg.device_id else None
    device_name = str(device.name_by_user or device.name or "") if device else ""
    own = str(reg.name or reg.original_name or "")
    if not own:
        return device_name or fallback
    settings = hass.data.get(DATA_SETTINGS)
    with_device = settings.names_with_device if settings is not None else True
    if not with_device or not device_name or device_name.casefold() in own.casefold():
        return own
    return f"{device_name}{NAME_SEPARATOR}{own}"


def sensor_info(hass: HomeAssistant, entity_id: str | None) -> tuple[str, str]:
    """
    (Geräteklasse, Bereich) eines Sensors für die Platzhalter {type} und {area} der Meldungen; leer, wo unbekannt.

    Geräteklasse: erst der Zustand (`device_class`, wie ihn die Integration meldet), sonst die Registry. Bereich: der der
    Entität, sonst der des Geräts (wie im Panel).
    """
    if not entity_id:
        return "", ""
    state = hass.states.get(entity_id)
    reg = er.async_get(hass).async_get(entity_id)
    device_class = str((state.attributes.get("device_class") if state else None) or (reg.device_class or reg.original_device_class if reg else "") or "")
    area_id = reg.area_id if reg else None
    if reg and not area_id and reg.device_id:
        device = dr.async_get(hass).async_get(reg.device_id)
        area_id = device.area_id if device else None
    area = ar.async_get(hass).async_get_area(area_id) if area_id else None
    return device_class, area.name if area else ""
