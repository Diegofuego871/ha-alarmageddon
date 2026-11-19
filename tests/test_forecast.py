"""Batterieprognose (0.5.0): Regression ab dem letzten Wechsel, keine erfundenen Zahlen."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
import pytest

from custom_components.alarmageddon.forecast import forecast_days

from .conftest import setup_alarm

DAY = 86400


def test_linear_drop() -> None:
    # 1 % pro Tag, jetzt 50 %: in 30 Tagen bei 20 %
    points = [(d * DAY, 80 - d) for d in range(31)]
    assert forecast_days(points, 20) == pytest.approx(30, abs=0.1)


def test_since_last_replacement() -> None:
    """Vor dem Wechsel fiel sie schnell; zählen darf nur die neue Batterie."""
    old = [(d * DAY, 60 - 5 * d) for d in range(8)]  # bis 25 %
    new = [((8 + d) * DAY, 100 - 0.5 * d) for d in range(21)]  # dann 100 % und 0,5 % pro Tag
    days = forecast_days(old + new, 20)
    assert days == pytest.approx((90 - 20) / 0.5, abs=0.5)


def test_not_enough_data() -> None:
    assert forecast_days([], 20) is None
    assert forecast_days([(0, 90), (DAY, 89)], 20) is None  # zu kurz
    assert forecast_days([(d * DAY, 90) for d in range(10)], 20) is None  # kein Abfall
    assert forecast_days([(d * DAY, 80 + d) for d in range(10)], 20) is None  # steigt


def test_already_below() -> None:
    assert forecast_days([(0, 15)], 20) == 0.0


def test_capped() -> None:
    points = [(d * DAY, 100 - 0.001 * d) for d in range(30)]
    assert forecast_days(points, 20) == 3650


async def test_ws_without_recorder(hass: HomeAssistant, hass_ws_client) -> None:
    await setup_alarm(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/battery_forecast"})
    result = await client.receive_json()
    assert result["success"] and result["result"] == {"forecast": {}}


async def test_table_uses_the_same_year_as_the_sensor_view(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    """
    Meldung des Nutzers 2026-11-19: in der Tabelle stand bei manchen Geräten "–", die Sensoransicht zeigte bei "1 Jahr" eine Prognose (etwa
    "~16 Monate" für einen Fühler im Kühlschrank, der seit Monaten langsam fällt und zuletzt um 4 % stieg). Die Tabelle rechnete nur mit dem
    Verlauf (Recorder, meist 10 Tage); jetzt rechnen beide gleich aus der Statistik eines Jahres.
    """
    from datetime import timedelta

    from homeassistant.util import dt as dt_util

    from custom_components.alarmageddon import sensor_history

    from .conftest import WINDOW
    from .test_maintenance import BAT_WINDOW, _device

    now = dt_util.utcnow()
    # Tagesmittel eines Jahres: von 98 % langsam fallend; in den letzten 10 Tagen nach einem Tief wieder leicht steigend (kalter Fühler erholt sich)
    year = [(now - timedelta(days=365 - d), 98 - 0.09 * d) for d in range(355)]
    year += [(now - timedelta(days=d), v) for d, v in zip(range(9, 0, -1), (60.0, 59.0, 59.0, 60.0, 60.0, 61.0, 61.0, 62.0, 63.0), strict=True)]
    calls: list[int] = []

    async def fake_numeric(_hass, entity_id, start, hours):
        calls.append(hours)
        return [(w, v) for w, v in year if w >= start] if entity_id == BAT_WINDOW else []

    monkeypatch.setattr(sensor_history, "async_numeric", fake_numeric)
    _device(hass, WINDOW, BAT_WINDOW)
    await setup_alarm(hass)
    hass.config.components.add("recorder")
    hass.states.async_set(BAT_WINDOW, "65")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/battery_forecast"})
    result = await client.receive_json()
    assert result["success"], result
    table = result["result"]["forecast"][BAT_WINDOW]
    view = (await sensor_history.async_numeric_history(hass, BAT_WINDOW, "battery", 8760, 20))["summary"]["days_left"]
    assert table is not None and table == view
    assert 365 < table < 3650, table
    assert calls[0] == sensor_history.FORECAST_HOURS == 8760
    # Nur die letzten 10 Tage (wie bisher der Verlauf): keine Prognose, weil der Wert zuletzt stieg
    last_days = [(w.timestamp(), v) for w, v in year if w >= now - timedelta(days=10)] + [(now.timestamp(), 65.0)]
    assert forecast_days(last_days, 20) is None


async def test_measured_values_of_the_monitoring_get_a_forecast(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    """
    Meldung des Nutzers 2026-11-19: die Fühler im Kühlschrank (nur Messwerte der Überwachung, in keiner Zone) hatten in der Liste nie eine
    Prognose: der Befehl fragte nur die Sensoren der Zonen und "immer aktiv" an. Jetzt dieselben Sensoren wie die Liste.
    """
    from datetime import timedelta

    from homeassistant.util import dt as dt_util

    from custom_components.alarmageddon import sensor_history

    from .test_maintenance import _device

    temp, bat = "sensor.kuehlschrank_temperatur", "sensor.kuehlschrank_temperatur_batterie"
    now = dt_util.utcnow()
    points = [(now - timedelta(days=60 - d), 80 - 0.5 * d) for d in range(60)]

    async def fake_numeric(_hass, entity_id, start, hours):
        return [(w, v) for w, v in points if w >= start] if entity_id == bat else []

    monkeypatch.setattr(sensor_history, "async_numeric", fake_numeric)
    _device(hass, temp, bat)
    hass.states.async_set(temp, "5.4", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await setup_alarm(hass, monitor_sensors=[temp])
    hass.config.components.add("recorder")
    hass.states.async_set(bat, "50")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "alarmageddon/battery_forecast"})
    forecast = (await client.receive_json())["result"]["forecast"]
    # 0,5 % pro Tag, jetzt 50 %: in rund 60 Tagen unter 20 %
    assert forecast.get(bat) == pytest.approx(60, abs=2), forecast
