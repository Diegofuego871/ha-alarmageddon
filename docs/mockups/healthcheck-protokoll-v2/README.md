# Protokoll der HealthCheck-Dienste (v2, 2026-11-19)

Zweite Fassung nach der Antwort des Nutzers vom 2026-11-19, 17:31 auf `healthcheck-protokoll-v1`: "könnte man nicht A und B kombinieren … bei der
Tagesansicht ist es wie bei A. Sobald man dann auf 7 Tage geht, wäre es so wie bei B Zeitleisten … Und bei 30 Tagen könnten wir das System mit dem
Raster übernehmen von den Bewegungsmeldern oder so. Oder mach noch einen Vorschlag … 3 Stunden, 12 Stunden, ein Tag wie A ist und darüber etwas wie
B." Zur Kachel "Antwortzeit" (v1, `antwortzeit-1tag-*.png`): "gefällt mir so sehr gut. Das bitte genauso umsetzen."

Aufgenommen wie v1 in der echten Sensoransicht des HA-Nachbaus (Computer hell, Handy dunkel, Deutsch), erfundene Daten. Kopf, Kacheln, Kennzahlen
und Liste wie in v1. Quelle: `src/shots.mjs`. Übersicht: `uebersicht-desktop.png`, `uebersicht-handy.png`.

## Grafik je Zeitraum (kombiniert)

| Zeitraum | Grafik | Bilder |
| --- | --- | --- |
| 3 Std. | Herzschlag, je Aufruf ein Balken (Höhe Antwortzeit, Farbe Ergebnis), darunter das Band | `kombi-3std-*.png` |
| 12 Std., 1 Tag | Herzschlag, je Abschnitt ein Balken (Computer 5 Minuten, Handy 10 bis 15 Minuten) | `kombi-12std-*.png`, `kombi-1tag-*.png` |
| 7 Tage | Zeitleiste je Tag wie Türen und Fenster: grün, solange Lebenszeichen ankommen, Marken für Fehler, Tests, Lücken | `kombi-7tage-*.png` |
| 30 Tage | Vorschlag 1 Raster oder Vorschlag 2 Kalender (unten) | `30tage-*.png` |

## 30 Tage, Vorschlag 1: Raster wie Bewegung

`30tage-raster-*.png`: eine Zeile je Tag, eine Zelle je Stunde, wie das Raster der Bewegungsmelder über 30 Tage. Ruhige Stunden blass grün, eine
Stunde mit Fehler, Fehlermeldung oder Test in deren Farbe, ohne Daten grau. Zeigt, zu welcher Stunde etwas war; die einzelnen Zellen sind aber
klein (auf dem Handy etwa 12 × 6 Pixel), und bei 720 Zellen fällt ein einzelnes Ereignis wenig auf.

## 30 Tage, Vorschlag 2: Kalender (Empfehlung)

`30tage-kalender-*.png`: eine Kachel je Tag, Wochen untereinander von Montag bis Sonntag. Je Tag die Erfolgsquote (auf dem Computer) und je ein Punkt
für jede Art von Ereignis (gescheitert, Fehler gemeldet, Test, keine Daten). Ein Tag mit einem gescheiterten Aufruf ist rot hinterlegt, mit
Fehlermeldung orange, sonst grün; heute ist blau umrandet. Ein Tipp auf einen Tag filtert die Liste darunter auf diesen Tag (die Uhrzeit steht dort).

Empfehlung: Bei 30 Tagen will man wissen, an welchen Tagen etwas war; der Kalender beantwortet das auf einen Blick, auch auf dem Handy, und die
Zahl je Tag zeigt, wie schlimm es war. Die Stunde steht in der Liste und in der Ansicht "1 Tag".

## Unverändert aus v1

Knopf "Protokoll" in der Liste, Kopf mit Dropdown, Kacheln "Verlauf", "Antwortzeit" (wie v1, so umsetzen) und "Dienst", Kennzahlen, Liste mit
"Ereignisse" (Standard) und "Alle Aufrufe".

## Entscheid des Nutzers (2026-11-19, 17:48)

"1. vorschlag 1 / 2. ältere nur zusammengefasst, / 3. passt / denkt daran, die Ereignisse darunter genau gleich zu filtern, wie oben gewählt ist.
Das gilt auch für die einzelnen aufrufe." Umgesetzt in 1.68.0: 30 Tage als Raster (Vorschlag 1), einzelne Aufrufe 24 Stunden, ältere nur
zusammengefasst in Grafik und Kennzahlen, Aufbewahrung wie vorgeschlagen; "Ereignisse" und "Alle Aufrufe" folgen genau dem gewählten Zeitraum.
