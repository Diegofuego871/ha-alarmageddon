# Mockup "Voreinstellungen gezielt auf Sensoren anwenden" (v1, 2026-11-25)

Wunsch des Nutzers (mit Bildschirmfoto des Schalters "Auf alle Sensoren anwenden" im Fenster "Voreinstellungen je Sensorart" auf dem Handy):
statt des Schalters ein Knopf, der ein Fenster öffnet. Darin alle Sensoren, die andere Werte haben, "und im besten Fall sogar noch zeigen, was bei
diesen Werten überschrieben werden würde"; eine scrollbare Liste, filterbar "mit den gleichen Chips", alle vorgewählt ("weil auch die Funktion ja so
heisst"), damit man gezielt überschreiben kann: "sogar nur auf einen oder so, oder auf eine Gruppe", zum Beispiel "auf alle Fenster".

Gebaut aus dem echten Panel im Nachbau (`src/mockup.mjs`, erfundene Daten: sieben Sensoren mit abweichenden eigenen Werten in zwei Anlagen),
Desktop (1400 px) und Handy (390 px). Übersichten: `uebersicht-desktop.png`, `uebersicht-handy.png`.

## Heute

`voreinstellungen-heute-*.png`: Schalter "Auf alle Sensoren anwenden", Zahl "8 Sensoren haben eigene Werte". Der Schalter löscht beim Speichern die
eigenen Werte **aller** Sensoren der Arten in den Voreinstellungen, ohne zu zeigen, was sich ändert. Die Zahl zählt auch Sensoren, deren eigener
Wert gleich der Voreinstellung ist (im Beispiel der Rauchmelder): bei ihnen würde sich nichts ändern.

## Variante A (Empfehlung): Knopf im Fenster der Voreinstellungen

1. `a1-voreinstellungen-knopf-*.png`: anstelle des Schalters eine Zeile mit Symbol, Text und dem Knopf "Sensoren wählen (7)". Sie erscheint nur, wenn
   Sensoren mit den Voreinstellungen im Fenster (auch ungespeicherten Änderungen darin) abweichen; die Zahl zählt nur echte Abweichungen.
2. `a2-fenster-alle-*.png`: Fenster "Voreinstellungen auf Sensoren anwenden" über den Voreinstellungen. Suche und dieselben Pillen wie in der
   Sensortabelle (nur Arten, die vorkommen). Darunter die Liste (am Computer fest hoch wie "Sensoren hinzufügen", nur sie scrollt):
   - Kopfzeile mit Kästchen für alle und "Alle", "Keine" (klebt beim Scrollen),
   - je Sensorart eine Zeile mit Kästchen (ganze Art an oder ab, halb gefüllt bei teilweiser Wahl) und "2 von 2 gewählt",
   - je Sensor: Kästchen, Symbol, Name, Bereich und Anlage, rechts **jede Option, die sich ändern würde**, mit Symbol, Name und "bisher → neu"
     (alter Wert durchgestrichen, neuer in der Akzentfarbe); ein eigener Wert nur für einen Modus trägt den Modus als Marke ("Abwesend"),
   - was bleibt, steht grün darunter ("Eigene Eingangsverzögerung 45 s bleibt": die Eingangsverzögerung gehört nicht zu den Voreinstellungen).
   Alle sind vorgewählt. Fusszeile: "7 von 7 gewählt", "Abbrechen", "Übernehmen (7)".
3. `a3-fenster-gefiltert-*.png`: Pille "Türen & Fenster", "Fenster Bad" abgewählt: die Kopfzeile sagt "4 von 7 Sensoren (Filter)", die Art
   "Fenster" ist halb gewählt, der Knopf zählt die Gewählten aller Arten (3), auch der ausgeblendeten.
4. `a4-voreinstellungen-gewaehlt-*.png`: nach "Übernehmen" zurück in den Voreinstellungen. Die Zeile nennt, wer übernimmt und wer seine Werte behält,
   trägt "Noch nicht gespeichert" (orange, wie jede ungespeicherte Änderung) und hat "Verwerfen" und "Auswahl ändern". Erst "Speichern" der
   Voreinstellungen löscht die gewählten eigenen Werte (wie heute der Schalter: alles in einem Schritt, die Anlagen laden einmal neu).

## Variante B: Rückfrage erst beim Speichern

`b-rueckfrage-beim-speichern-*.png`: kein Knopf im Fenster. Hat der Nutzer Voreinstellungen geändert und gibt es abweichende Sensoren, öffnet
"Speichern" dasselbe Fenster als Rückfrage ("Auch auf Sensoren anwenden?") mit "Zurück", "Nur Voreinstellungen speichern" und "Speichern und 7
übernehmen". Nachteil: wer die Voreinstellungen nicht ändert, aber eigene Werte zurücksetzen will, kommt nicht hin; und eine Rückfrage beim Speichern
überrascht eher, als dass sie hilft.

## Was das für die Umsetzung heisst

- **Server:** `save_presets` setzt heute je **Art** zurück (`reset_sensors: ["door", ...]`). Für die gezielte Wahl braucht es eine Liste von
  **Sensoren** (Entitäts-IDs, je Anlage), geprüft gegen die Sensoren der Anlagen; dazu einen Test, eine Zeile der Mutationsprobe und den Eintrag in
  `test_security.py`. Wie heute bleiben die eigene Eingangsverzögerung und "Immer aktiv ignorieren" stehen; eigene Werte je Modus fallen mit weg.
- **Abweichung** heisst: der eigene Wert (gemeinsam oder je Modus) unterscheidet sich vom Wert der Voreinstellung **im Fenster**, also auch von einer
  ungespeicherten Änderung darin. Ändert man danach eine Voreinstellung, rechnet die Zeile neu (ein gewählter Sensor ohne Abweichung fällt weg).
- **Eigene Werte gleich der Voreinstellung** (im Beispiel der Rauchmelder) erscheinen nicht, weil sich nichts ändern würde. Sie bleiben als eigener
  Wert gespeichert und würden erst bei einer späteren Änderung der Voreinstellung zu einer Abweichung.
- Anzeige der Optionen mit denselben Namen wie in der Tabelle und im Blatt des Sensors (`OPTIONS`), "Muss geschlossen sein" umgekehrt wie dort
  (`invert`), "Umgehen" nur, wo es wirkt (`optionShown`).
