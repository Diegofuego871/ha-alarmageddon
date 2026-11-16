# Mockups: Reiterleiste der Aktionen einfärben (2026-11-16)

Wunsch des Nutzers: Die Leiste "Anwesend, Abwesend, Nacht, Immer aktiv, Überwachung" soll etwas Farbe bekommen, aber nicht zu bunt. Die vier Reiter, die
einen Alarm auslösen können, tragen eine leicht andere Farbe als "Überwachung". Die **Form der Leiste bleibt** (Spur mit Kapsel am gewählten Knopf);
das Problem ist die Grenze, der Farbübergang zwischen den Gruppen. Alles Entwurf mit festen Werten, noch **nicht umgesetzt**. Quelle: `src/mock.mjs`.

| Bild | Inhalt |
| --- | --- |
| `reiterleiste-desktop.png` | fünf Varianten, je mit "Abwesend" und mit "Überwachung" gewählt |
| `reiterleiste-handy.png` | dieselben auf 390 px (hier brechen die Reiter um; im Panel würde die Leiste auf dem Handy wie bisher gekürzt oder seitlich verschoben) |

| Variante | Grenze | Farbigkeit |
| --- | --- | --- |
| **A** zwei Tönungen, harte Kante mit Schlitz | klar, aber hart | mittel |
| **B** weicher Verlauf über die Spur | verschwimmt, keine Trennung | mittel |
| **C** Spur grau, Strich unter jedem Reiter, Kapsel mit Strich | feiner Farbwechsel am Strich | **am wenigsten bunt** |
| **D** zwei getrennte Leisten mit Überschrift | keine Grenze, zwei Gruppen | mittel bis hoch, braucht mehr Platz (auf dem Handy zwei Zeilen) |
| **E** neutrale Spur, farbige Kapsel, feine Trennlinie | Linie statt Übergang | wenig, nur der gewählte Reiter ist bunt |

## Empfehlung

**E**, mit dem Strich aus **C** als Möglichkeit: Die Leiste bleibt ruhig und behält ihre Form, die Farbe sagt nur "welche Gruppe ist gewählt" (rotstichig = kann alarmieren, türkis = Überwachung),
und die Grenze ist eine feine Linie statt eines Farbübergangs. A und B färben die ganze Spur ein, das wird schnell "zu farbig"; D ist die klarste Trennung, kostet aber Platz.
Die Farben sind Vorschläge (Alarm `#e5654f`, Überwachung `#1f9d8f`); im Dunkelmodus wären sie abzudunkeln.
