# Mockups: Reiterleiste der Aktionen, nur Icons färben (v2, 2026-11-16)

Wunsch des Nutzers: Die Variante aus v1 (getönte Spur, Verlauf) gefällt nicht. Neuer Ausgangspunkt ist die **Leiste ohne Färbung**; gefärbt werden nur die
**Icons vorne**: die Reiter, die alarmieren können (Anwesend, Abwesend, Nacht, Immer aktiv), in einem Weinrot, "Überwachung" in Orange. Beachtet ist das
**Handy** (390 px), wo die Reiter im Viereck stehen (zwei Spalten, "Überwachung" über die ganze Breite darunter). Alles Entwurf mit festen Werten, noch **nicht umgesetzt**.
Quelle: `src/mock.mjs` (`node src/mock.mjs`).

| Bild | Inhalt |
| --- | --- |
| `reiter-desktop-dunkel.png`, `reiter-desktop-hell.png` | sechs Stände, je mit "Abwesend" und mit "Überwachung" gewählt |
| `reiter-handy-dunkel.png`, `reiter-handy-hell.png` | dieselben auf 390 px, mit vier Reitern und mit allen fünf (Nacht an) |

| Variante | Was ist gefärbt | Wirkung |
| --- | --- | --- |
| **0** Ausgangslage | nichts (gewählter Reiter blau) | Referenz |
| **A** nur Icons | Icon weinrot beziehungsweise orange | **am ruhigsten**, Gruppe an der Icon-Farbe erkennbar |
| **B** Icons in runden Plaketten | getönter Kreis um das Icon, beim gewählten Reiter gefüllt | deutlichste Gruppe, etwas unruhiger |
| **C** Icons und Strich unten | A plus feiner Strich am Reiterrand | Gruppe auch im Viereck sofort sichtbar |
| **D** zwei Leisten | A plus zwei leicht getönte Spuren | klarste Trennung, braucht mehr Platz (Handy: zwei Blöcke) |
| **E** gewählter Reiter mit Rand | Icons gedämpft, gewählter Reiter mit Rand in Gruppenfarbe | die Farbe sagt "was ist gewählt" |

## Empfehlung

**A** als Grundlage: Form, Spur und Kapsel bleiben wie heute, nur die Icons tragen Farbe; das ist die kleinste Änderung und auf Desktop und Handy gleich.
Wenn die Gruppe auf dem Handy im Viereck deutlicher sein soll, **C** (Strich) oder **E** (Rand am gewählten Reiter) dazunehmen. Farben als Vorschlag: dunkel Weinrot `#cf6a82`, Orange `#f2a33a`; hell `#b5475f` und `#e9962f`.
