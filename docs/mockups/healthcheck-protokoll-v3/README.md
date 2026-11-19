# Protokoll der HealthCheck-Dienste (v3, 2026-11-19): 90 Tage und 1 Jahr

Wunsch des Nutzers vom 2026-11-19, 18:24 (Bildschirmfoto der Kachel "Batterie" mit 30 Tage, 90 Tage, 1 Jahr, die beiden längeren eingekreist): "Ich
glaube, es würde doch Sinn machen, auch 90 Tage und ein Jahr anzubieten. Bei Ausfällen möchte man vielleicht schon eine Langzeitstatistik haben."

Aufgenommen im echten Protokoll (1.68.0, noch nicht geliefert) im HA-Nachbau (Computer hell, Handy dunkel, Deutsch); ersetzt sind nur Zeitraum,
Kennzahlen, Grafik und Legende. Erfundene Daten: ein Jahr eines Dienstes mit 5 Minuten Abstand, das Protokoll beginnt vor 340 Tagen (davor leer),
mit Ausfällen, Fehlermeldungen, Tests und Lücken (zwei Tage ohne Strom). Die Liste darunter ist die echte des Nachbaus. Quelle: `src/shots.mjs`.
Übersicht: `uebersicht-desktop.png`, `uebersicht-handy.png`.

## Zeitraum

Sieben Tasten: 3 Std., 12 Std., 1 Tag, 7 Tage, 30 Tage, 90 Tage, 1 Jahr. Auf dem Handy (390 px) passen alle in eine Zeile, wenn die Schrift etwas
kleiner ist (12,5 statt 13,5 px, gemessen: nichts abgeschnitten); auf sehr schmalen Handys (320 px) in zwei Zeilen.

## Grafik über 90 Tage und 1 Jahr

Je Tag eine Farbe: grün alle angekommen, orange Fehler gemeldet, rot gescheitert, grau Lücke (mehr als 30 Minuten ohne Daten an diesem Tag), leer
vor dem Beginn des Protokolls; ein Test als blauer Punkt. Darunter die Zahl der Tage mit Ausfall, mit Fehlermeldung und mit Lücke.

| Variante | 90 Tage | 1 Jahr |
| --- | --- | --- |
| A "Statusleiste" wie die Leiste der Anbieter | je Tag ein Balken (`a-90tage-tagesbalken-*.png`) | Computer je Tag, Handy je Woche (`a-1jahr-tagesbalken-*.png`) |
| B "Raster Monat × Tag", das Raster der 30 Tage eine Stufe gröber | eine Zeile je Monat, eine Zelle je Tag (`b-90tage-raster-*.png`) | 13 Zeilen (`b-1jahr-raster-*.png`) |

**Empfehlung: B.** Dasselbe Prinzip wie bei 30 Tagen (Raster), auf dem Computer und dem Handy tagesgenau, auch über ein Jahr (A muss auf dem Handy
Wochen zusammenfassen, ein einzelner Ausfalltag ist dann eine ganze rote Woche), und Datum und Wochentag lassen sich ablesen. A ist die vertraute
Leiste der Anbieter und über 90 Tage auf einen Blick gut, sagt aber weniger, an welchem Tag etwas war.

## Antwortzeit über 1 Jahr

`antwortzeit-1jahr-*.png`: wie bis 30 Tage, das Mittel je Tag (Handy je Woche), Zonen schnell, langsam, sehr langsam, eine gestrichelte rote Marke an
jedem Tag mit gescheitertem Aufruf.

## Technik (Vorschlag)

- Neu Tageswerte je Dienst für 1 Jahr (Anzahl je Art, Antwortzeiten, ohne Antwort, Minuten ohne Daten), nach dem Tag von Home Assistant (Ortszeit);
  rund 15 KB je Dienst.
- Ereignisse 1 Jahr statt 90 Tage, damit die Liste "Ereignisse" auch bei 90 Tagen und 1 Jahr genau dem Zeitraum folgt; höchstens 1000 statt 500 je
  Dienst. Speicher je Dienst bei 5 Minuten Abstand: üblich rund 60 KB, höchstens rund 160 KB.
- "Alle Aufrufe" bleibt bei den letzten 24 Stunden (mit Hinweis), wie bei 7 und 30 Tagen.

## Entscheid des Nutzers (2026-11-19, 18:35)

"Genau, mach es so. Ich bin mit allen 4 Vorschlägen einverstanden." Umgesetzt in 1.68.0: Variante B (Raster Monat × Tag) für 90 Tage und 1 Jahr,
Tageswerte und Ereignisse ein Jahr (höchstens 1000 je Dienst), sieben Tasten auf dem Handy in einer Zeile, Lücke ab 30 Minuten.
