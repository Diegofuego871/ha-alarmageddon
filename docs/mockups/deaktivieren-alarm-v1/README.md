# Deaktivieren im Alarm (v1, 2026-11-22): Mockup, in 1.78.0 gebaut und in 1.79.0 wieder entfernt

Wunsch des Nutzers (2026-11-22): eine Einstellung unter Konfiguration › Anlage › Zeiten und Verhalten, was beim Deaktivieren **während eines Alarms**
geschieht, als vertikaler Schieber (gleicher Stil wie die Reiterleisten mit Kapsel, nur senkrecht), daneben die Einstellung samt Beschreibung des Verhaltens.
Der Entscheid "so lassen, wie es heute ist" gilt weiter; das Mockup dient nur zum Anschauen. Aufgenommen im HA-Nachbau (Computer hell, Handy dunkel,
Deutsch). Quelle: `src/shots.mjs`.

## Verhalten

| Stellung | Was beim Deaktivieren im Alarm geschieht |
| --- | --- |
| **Oben: "Deaktivieren beendet den Alarm"** (Standard, heutiges Verhalten, wie Home Assistant und HomeKit) | Der Alarm stoppt, die Anlage wird deaktiviert. Es laufen die Aktionen "Nach dem Quittieren" und "Beim Deaktivieren". |
| **Unten: "Deaktivieren quittiert nur"** | Der Alarm endet, die Anlage bleibt im selben Modus scharf. Es laufen die Aktionen "Nach dem Quittieren", "Beim Deaktivieren" erst beim zweiten Deaktivieren. Das Bedienteil von HomeKit zeigt danach weiter "Scharf", obwohl man "Deaktivieren" gewählt hat. |

## Bilder

| Bild | Inhalt |
| --- | --- |
| `a-desktop.png`, `a-handy.png` | **A: vertikaler Schieber**, Stellung oben (Standard). Die Kapsel gleitet senkrecht, wie bei den Reiterleisten (Antippen von Symbol oder Text wählt). |
| `a-unten-desktop.png`, `a-unten-handy.png` | A mit der Stellung unten ("quittiert nur"). |
| `b-desktop.png`, `b-handy.png` | **B zum Vergleich:** ein gewöhnlicher Schalter "Deaktivieren beendet den Alarm" (aus = nur quittieren). |

## Offene Fragen, falls es gebaut wird

- Je Anlage oder je Modus (Ebenenregel: neben dem Bestätigungsfenster mit "Einstellungen pro Modus")?
- Die Stellung "quittiert nur" widerspricht dem HomeKit-Verhalten (dort gibt es im Alarm nur "Deaktiviert"). Ein Hinweis im Panel und ein Test mit der HomeKit-Bridge wären nötig.
- Ein Zwischenzustand "Alarm quittiert, Anlage scharf" ist schon heute das Ergebnis von "Quittieren"; die Einstellung ändert nur, was "Deaktivieren" im Alarm auslöst.
