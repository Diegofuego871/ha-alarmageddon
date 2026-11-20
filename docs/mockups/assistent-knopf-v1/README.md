# Knopf für den Einrichtungsassistenten im Kopf (v1, 2026-11-20)

Wunsch des Nutzers vom 2026-11-20, 11:38, mit Bildschirmfoto (Kopf der Übersicht, rechts neben dem Stift markiert): "neben dem Bleistift einen
runden Button anzeigen mit einem animierten Zauberstab drin für den Assistenten. Vielleicht hast du noch eine bessere Idee, aber es soll auf jeden
Fall animiert sein … wenn es fertig geladen ist, nach 5 Sekunden … der Zauberstab soll sich dann schwingen oder irgendwie sowas … leicht dezent
animiert, aber nicht zu wild. Es kann sich auch etwas drehen. … ein, 2 Vorschläge, wie das bewegt aussehen könnte. Und der Button soll einfach dem
User helfen, dass der Wizard da noch quasi vorhanden ist, wenn er vielleicht abgeschlossen ist, und er kann wieder draufklicken und dort weiterfahren,
wenn er ihn pausiert hat oder sich später erinnern lassen möchte."

Aufgenommen im HA-Nachbau (Computer hell, Handy dunkel, Deutsch), erfundene Daten. Quelle: `src/shots.mjs` (Einzelbilder) und `src/gif.py` (GIFs).
Die GIFs zeigen die Bewegung immer wieder; im Panel läuft sie **einmal**, 5 Sekunden nach dem Laden.

## Was in allen Varianten gleich ist

- **Platz und Form:** rechts neben dem Stift, rund, 40 px, heller blauer Grund mit blauem Rand, der Zauberstab des Panels (`wand`, dasselbe
  Symbol wie im Kapitel "Einrichtungsassistent" und in der Schrittliste). `kopf-desktop.png`, `kopf-handy.png`.
- **Blauer Punkt oben rechts**, solange der Assistent nicht fertig ist (offen, "Später", "Nicht mehr anzeigen").
- **Tooltip** sagt, was ein Klick tut: "Einrichtungsassistent fortsetzen (Schritt 5: Meldungen)" oder "Einrichtungsassistent starten".
- **Klick:** nicht fertig: genau beim gemerkten Schritt weiter; fertig: von vorn, mit allem, was eingerichtet ist, vorgewählt (wie "Von vorn" unter
  Konfiguration › Anlage). Offene Änderungen in einem Reiter: die bekannte Rückfrage.
- **Bewegung:** einmal je Laden des Panels, 5 Sekunden nachdem die Daten da sind; nicht bei jedem Wechsel des Reiters.

## Varianten

| Bild | Bewegung |
| --- | --- |
| `a-desktop.gif`, `a-handy.gif` | **A: Schwung** (1,4 s). Der Stab schwingt um den Griff nach links, nach rechts und pendelt aus; die drei Sterne verschwinden kurz und blitzen nacheinander grösser wieder auf. |
| `b-desktop.gif`, `b-handy.gif` | **B: Funkeln** (2,1 s). Der Stab bleibt still; die drei Sterne funkeln nacheinander (kleiner, grösser, mit einer Vierteldrehung), dazu ein leichter blauer Schein um den Knopf. |
| `c-desktop.gif`, `c-handy.gif` | **C: Drehung** (1,3 s). Der ganze Zauberstab dreht sich einmal sanft um sich selbst, ein blauer Ring breitet sich vom Knopf aus und verblasst. |

**Empfehlung: A.** Ein Zauberstab, der schwingt, sagt am deutlichsten "hier wird etwas eingerichtet", bleibt dabei klein (der Knopf bewegt sich
nicht, nur das Symbol darin) und ist nach gut einer Sekunde vorbei. B ist noch ruhiger, fällt aber leicht nicht auf; C ist am auffälligsten.

## Fragen an den Nutzer

1. Variante **A**, B oder C?
2. Bewegung und Punkt **nur, solange der Assistent nicht fertig ist**; danach ein ruhiger Knopf ohne Punkt, der von vorn startet? (Empfehlung: ja,
   sonst bewegt sich der Knopf bei jedem Öffnen für immer.)
3. Die Einstellung "Bewegung reduzieren" des Geräts **respektieren** (dann keine Bewegung, nur der Punkt)? Das Easter Egg des Logos tut das bewusst
   nicht; hier empfehle ich es, weil der Knopf bei jedem Laden erscheint.

## Entscheid des Nutzers (2026-11-20, 11:48)

1. "a": Variante **A (Schwung)**.
2. "Sobald der Assistent einmal abgeschlossen ist, soll der Button gar nicht mehr angezeigt werden." Kein ruhiger Knopf nach "Fertig"; "Von vorn"
   bleibt unter Konfiguration › Anlage.
3. "nein, immer animieren": die Einstellung "Bewegung reduzieren" gilt für diesen Knopf nicht.

Umgesetzt in 1.71.0 (`alarmageddon-panel.js _wizardBtn`, `_waveLater`; `styles.js .ag-wzbtn`; Suite `wzbtn-e2e.mjs`).
