# Konfiguration › Meldungen (v1, 2026-11-19): neues Design der Seite

Wünsche des Nutzers vom 2026-11-19 (gekürzt, mit Bildschirmfotos):

- 22:16: Die Meldung der HealthCheck-Dienste "genau so aufbauen wie zum Beispiel beim Selbsttest", ohne eigenen Text: Empfänger, Kritisch ja/nein
  und so weiter, dazu "erneute Meldung, wenn wieder in Ordnung" und die Anzahl Polls.
- 22:17: "Die Meldungen sollen zudem in den Bereich der Wartungsmeldungen. Wie Selbsttest."
- 22:20: Die Meldungen unter "Störungsmeldungen" und "Wartungsmeldungen" übersichtlicher gestalten: der Titel kommt nicht zur Geltung, die Themen
  sollen sich besser unterscheiden und trotzdem klar zum Kapitel gehören, "eine Art Unterkapitel". Das Kapitel selbst bleibt; ganz oben nur die
  Standard-Empfänger. Gleiches Design für alle Meldungen beider Kapitel. "Bitte legt für die ganze Seite Meldungen ein neues Design vor."
- 22:27 (Bildschirmfoto "Batterie schwach": "Schwach unter" mit Feld rechts, "Meldung nach" mit Feld darunter): "Achte darauf beim Redesign, dass
  solche Fenster einheitlich sind."

Aufgenommen im HA-Nachbau (Computer hell, Handy dunkel, Deutsch). Das Kapitel "Standard-Empfänger" ist das echte und bleibt, wie es ist; darunter die
Varianten, gebaut aus den Klassen des Panels. Erfundene Namen (Marco, Anna). Quelle: `src/shots.mjs`. Heute: `heute-desktop.png`, `heute-handy.png`.

## Was in allen Varianten gleich ist

- **Drei Kapitel:** Standard-Empfänger (unverändert), Störungsmeldungen, Wartungsmeldungen. Das Kapitel "HealthCheck-Dienste" gibt es nicht mehr;
  "HealthCheck-Dienst antwortet nicht" ist die letzte Wartungsmeldung, aufgebaut wie "Selbsttest".
- **Jede Meldung ein Unterkapitel:** Titel gross und fett (16 bis 17 px statt 14 px), davor ein Symbol in der Farbe des Kapitels (Störung rot,
  Wartung orange) und ein Farbstreifen links: so gehört sie sichtbar zum Kapitel, und die Meldungen trennen sich klar voneinander. Ausgeschaltet:
  grau, nur der Kopf.
- **Einheitliche Felder** (Wunsch 22:27): jede Einstellung ist eine Zeile gleicher Art. Zahlen: Beschriftung links, Feld und Einheit rechts, der
  Hinweis darunter über die ganze Breite, auf dem Handy genauso ("Schwach unter [20] %", "Meldung nach [3] Prüfungen", "Nicht erreichbar nach [60]
  Minuten", "Meldung nach [2] Fehlversuchen"). Schalter links, Text rechts (Grundregel). Empfänger: Beschriftung, Herkunft ("Standard: …" oder
  "Eigene Empfänger … · Standard übernehmen"), Auswahl und Pillen.
- **Reihenfolge in jeder Meldung:** Empfänger, Kritisch (mit Lautstärke, wenn an), "In Home Assistant stehen lassen", die eigenen Einstellungen der
  Meldung (Zahlen, Knöpfe der Meldung, "Melden, wenn er wieder antwortet"), unten "Testmeldung senden".
- **"Einstellungen pro Modus"** bleibt oben im Kapitel Störungsmeldungen; eingeschaltet bekommt "Sensor im scharfen Zustand nicht erreichbar" die
  Reiter der Modi in ihrem Unterkapitel (nicht im Bild).

## Varianten

| Bild | Variante |
| --- | --- |
| `a-desktop.png`, `a-handy.png` | **A: Karte je Meldung.** Jede Meldung ist eine eigene Karte (Unterkapitel) mit Kopf (Schalter, Symbol, Titel, Erklärung), darunter alle Einstellungen, unten die Testmeldung. Am Computer zwei Spalten: links "Wer" (Empfänger), rechts "Wie" (Kritisch, stehen lassen, Zahlen). Alles auf einen Blick, ohne Klick. |
| `b-desktop.png`, `b-handy.png` | **B: Liste mit Aufklappen.** Je Kapitel eine Liste; jede Zeile zeigt Schalter, Symbol, Titel und eine Kurzfassung ("An Marco · unter 20 % · nach 3 Prüfungen"); der runde Pfeil klappt die Einstellungen auf (im Bild "Batterie schwach"). Kurz und übersichtlich, Einstellungen erst auf Klick. |
| `c-desktop.png`, `c-fenster-desktop.png`, `c-handy.png`, `c-fenster-handy.png` | **C: Karten wie die festen Meldungen unter Aktionen.** Am Computer zwei Spalten; jede Karte mit Schalter, Titel, Kurzfassung, Play (Testmeldung) und Stift; der Stift öffnet ein Fenster mit den Einstellungen ("Abbrechen", "Übernehmen"). Am kürzesten und gleich bedienbar wie die Meldungen unter Aktionen, Einstellungen aber erst im Fenster. |

**Empfehlung: A.** Sie setzt "eine Art Unterkapitel" am direktesten um: der Titel jeder Meldung steht gross über ihren Einstellungen, und man sieht
alles, ohne zu klicken. Die Seite wird länger als heute, ist aber durch die Köpfe leicht zu überfliegen. C wäre die Wahl, wenn die Meldungen
gleich wie unter Aktionen bedient werden sollen (Play und Stift); B liegt dazwischen.

## Fragen an den Nutzer

1. Variante **A**, B oder C?
2. Farben: Störungsmeldungen **rot**, Wartungsmeldungen **orange**?
3. Einheit bei HealthCheck: **"Meldung nach [2] Fehlversuchen"** (kurz, passt auf dem Handy in eine Zeile) oder "gescheiterten Aufrufen"?
4. Lieferung: das neue Design als **eigene Version 1.70.0** (1.69.0 mit dem Einrichtungsassistenten und HealthCheck bei der Wartung im heutigen Design
   geht vorher hinaus) oder alles zusammen in 1.69.0?

## Entscheid des Nutzers (2026-11-19, 23:01)

"1. C 2. passt 3. Fehlversuche 4. alles zusammen in einem paket. Achte darauf, das die settings nach wie vor auf der seite und nicht im popup pro
meldung gespeichert wird. Wie auch sonst überall, sollen ungesichterte änderungen markiert sein im gleichen stil"

- **Variante C**, Farben Störung rot und Wartung orange, Einheit "Fehlversuchen", alles in 1.69.0.
- Umgesetzt: Karten `.ag-ntk` (`notify.js _card`), Fenster `#ag-ntkind` mit den Abschnitten des Fensters der festen Meldungen unter Aktionen
  ("Meldung senden", "Empfänger", "Zustellung", "Einstellungen", Testmeldung, "Abbrechen", "Übernehmen") statt der zwei Spalten des Mockups, damit
  beide Fenster gleich aussehen. Das Fenster ändert nur den Entwurf der Seite; gespeichert wird mit "Speichern" unten. Eine geänderte Karte zeigt
  "Noch nicht gespeichert" mit dem orangen Punkt, dazu Punkt am Reiter und Zahl in der Fusszeile.
- Zahlen in einem gemeinsamen Raster: im Mockup standen "Schwach unter [20] %" und "Meldung nach [3] Prüfungen" nicht in einer Flucht; jetzt
  stehen die Felder einer Meldung genau untereinander.
