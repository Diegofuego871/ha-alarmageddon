# Mockups: Reiter der Sensoransicht am Tablet und Computer (2026-11-15)

Frage des Nutzers: Das Handy-Aussehen der Reiter (Symbol über Kurztext, seit 1.43.2) gefällt; soll es auf allen Grössen gelten? Die Bilder
zeigen die echte Sensoransicht (HA-Nachbau, dunkel) am Computer (1280 px) und am Tablet (834 px); erfundene Daten.
Quelle: `src/mock.mjs` (`node docs/mockups/tabs-gross-v1/src/mock.mjs`).

**Entschieden: Variante Y, umgesetzt in 1.43.3.**

| Bilder | Variante |
| --- | --- |
| `0-heute-desktop.png`, `0-heute-tablet.png` | Heute: Symbol links neben Beschriftung und Wert |
| `1-X-wie-handy-desktop.png`, `1-X-wie-handy-tablet.png` | **X: genau wie auf dem Handy:** Symbol über dem Text; Verlauf und Gerät mit Wort, Batterie und Empfang mit Wert |
| `2-Y-symbol-beschriftung-wert-desktop.png`, `2-Y-symbol-beschriftung-wert-tablet.png` | **Y: Symbol über Beschriftung und Wert** (zwei Zeilen, auch "zu seit 21:27" und der Gerätename): nichts geht verloren. **Empfehlung** |

## Einschätzung

- **X** ist am einheitlichsten (Handy, Tablet, Computer sehen gleich aus), die breiten Kacheln wirken aber leer, und "Batterie" und "Empfang" stehen
  nirgends als Wort.
- **Y** hat dieselbe Anordnung (Symbol oben, mittig), nutzt aber den Platz für Beschriftung und Wert, wie es heute schon ist.
