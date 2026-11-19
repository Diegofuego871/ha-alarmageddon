"""
Batterieprognose (0.5.0): Wann fällt die Batterie unter die Schwelle?

Ab dem letzten Batteriewechsel (Sprung nach oben), lineare Regression. Ohne genug Daten (weniger als 3 Tage, kein Abfall) keine
Prognose: lieber nichts als eine erfundene Zahl. Die Punkte liefert `sensor_history` (Langzeitstatistik von Home Assistant, sonst der
Verlauf), für die Sensoransicht und seit 1.66.0 auch für die Tabelle (`async_battery_forecasts`, ein Jahr). Bis 1.65.0 las die Tabelle hier
nur den Verlauf der letzten 90 Tage, den der Recorder meist nur 10 Tage aufbewahrt.
"""

from __future__ import annotations

MIN_SPAN_DAYS = 3
REPLACED_JUMP = 10  # Prozentpunkte nach oben gelten als Batteriewechsel
MAX_DAYS = 3650


def forecast_days(points: list[tuple[float, float]], threshold: float) -> float | None:
    """
    Tage bis zur Schwelle ab dem letzten Messpunkt. points: (Zeit in
    Sekunden, Prozent), aufsteigend. 0 heisst: schon darunter.
    """
    if not points:
        return None
    start = 0
    for i in range(1, len(points)):
        if points[i][1] - points[i - 1][1] >= REPLACED_JUMP:
            start = i
    pts = points[start:]
    current = pts[-1][1]
    if current <= threshold:
        return 0.0
    if len(pts) < 3 or pts[-1][0] - pts[0][0] < MIN_SPAN_DAYS * 86400:
        return None
    n = len(pts)
    mean_t = sum(t for t, _ in pts) / n
    mean_v = sum(v for _, v in pts) / n
    var = sum((t - mean_t) ** 2 for t, _ in pts)
    if var == 0:
        return None
    slope = sum((t - mean_t) * (v - mean_v) for t, v in pts) / var  # Prozent pro Sekunde
    if slope >= 0:
        return None
    days = (current - threshold) / -slope / 86400
    return round(min(days, MAX_DAYS), 1)
