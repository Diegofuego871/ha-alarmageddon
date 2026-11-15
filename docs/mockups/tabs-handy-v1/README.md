# Mockups: Reiter der Sensoransicht auf dem Handy (2026-11-15)

Frage des Nutzers: Auf kleinen Displays ist in den vier Reitern (Verlauf, Batterie, Empfang, Gerät) zu wenig Platz für Beschriftung und Wert
(Text wird mit "…" gekürzt). Am Computer und auf dem Tablet soll alles bleiben, wie es ist; die Änderung gilt nur für das Handy.
Die Bilder zeigen die echte Sensoransicht (HA-Nachbau, dunkel, 390 px), die Varianten liegen als zusätzliche Stile darüber; erfundene Daten.
Quelle: `src/mock.mjs` (`node docs/mockups/tabs-handy-v1/src/mock.mjs`).

**Noch nicht entschieden, noch nicht umgesetzt.**

| Bild | Variante |
| --- | --- |
| `0-heute.png` | Heute: Beschriftung und Wert als Text, kein Symbol, Text wird gekürzt |
| `1-A-nur-symbole.png` | **A: nur Symbole.** Vier gleich breite Kacheln mit grossem Symbol (Uhr, Batterie, Empfang, Chip), kein Text |
| `2-B-symbol-und-kurztext.png` | **B: Symbol plus Kurztext.** Verlauf: Symbol und "Verlauf"; Batterie: Symbol und Stand ("72 %"); Empfang: Symbol und Wert ("-58 dBm"); Gerät: Symbol und "Gerät". Kein "ruhig seit …", keine Marke |

## Einschätzung

- **A** ist am ruhigsten und braucht am wenigsten Platz, aber die Symbole stehen allein: ohne die Werte sieht man Batterie und Empfang erst nach dem
  Antippen, und das Symbol des Geräts (Chip) ist weniger eindeutig als ein Wort.
- **B** zeigt auf einen Blick, was heute Platz wegnimmt, aber kurz genug, dass nichts gekürzt wird: beide Wörter und beide Werte passen bei 390 px
  in eine Kachel. Das ist meine Empfehlung.
- In beiden bleibt die gewählte Kachel mit dem Rahmen/der Kapsel markiert wie überall. Die Tab-Leiste bleibt eine Reiterleiste mit gleitender Kapsel.

## Offen

1. Bei sehr schmalen Handys (320 px) wäre der Wert "-100 dBm" mit Symbol noch knapp; in B würde die Schrift dort leicht kleiner.
2. Fehlt der Wert (Gerät gerade nicht gehört), steht in B bei Batterie und Empfang "–".
