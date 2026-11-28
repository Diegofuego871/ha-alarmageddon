# Einrichtungsassistent: Seite "Fertig" mit Animation (v1, 2026-11-28)

Wunsch des Nutzers: auf der letzten Seite ist zu wenig deutlich, dass die Anlage bereit ist. Ein feierliches Symbol, kurz (unter 3 Sekunden): ein Rad dreht
sich zweimal, wird langsamer, bleibt stehen, ein grüner Haken zeichnet sich. Drei Vorschläge, alle mit erfundenen Daten, gebaut aus HTML/CSS/SVG
(`src/mockup.html`, Aufnahmen `src/shots.mjs`). Die Dateien `variante-a.html` bis `-e.html` (die Variante ist in jeder Datei fest eingebaut) laufen im Browser und wiederholen sich alle 6,5 Sekunden.

| | Variante | Ablauf | Dauer |
|---|---|---|---|
| A | **Rad im Seitenkopf** | Ring mit Bogen dreht zweimal und bremst, der Bogen schliesst sich, grüne Scheibe, Haken wird gezeichnet. Bleibt als Zeichen über dem Titel stehen. | 2,0 s |
| B | **Schild als Münze** | Die Seite dunkelt ab, das Schild kommt gross, dreht sich wie eine Münze zweimal und bremst weich, Haken zeichnet sich, Glanz läuft über das Schild, Ring als Puls, "Die Anlage ist bereit". Dann fliegt das Schild klein vor den Titel und bleibt dort als Haken. | 3,5 s |
| C | **Sieben Striche als Ring** | Die sieben Striche des Fortschritts laufen als Ring, drehen zweimal, leuchten nacheinander grün auf, Scheibe, Haken, kleine Funken. Bleibt stehen. | 2,6 s |
| D | **Schild zeichnet sich selbst** | Der Rand des Schilds wird gezeichnet, während es sich einmal dreht, dann füllt es sich von unten grün, Haken, Glanz, Flug zum Titel. | 3,6 s |
| E | **Aus den sieben Strichen wird das Schild** | Die sieben grünen Striche oben lösen sich, wirbeln zur Mitte und werden zum Schild (kurzes Aufpoppen mit Drehung), Haken, Glanz, Flug zum Titel. | 3,6 s |

B, D und E sind Schild-Varianten (Wunsch des Nutzers: das Schild gefällt); alle enden gleich: das Schild landet als kleiner Haken vor dem Titel.

Empfehlung: **E**, weil sie die sieben Schritte oben aufnimmt und im Schild enden lässt; **B** ist die klassische, ruhigste Schild-Variante.

Offene Punkte für die Umsetzung (nicht Teil des Mockups): bei "Bewegung reduzieren" sofort das Endbild, Wiederholung beim erneuten Öffnen der Seite "Fertig"
nur einmal je Aufruf, Farben über `--ag-success` und `--ag-primary` statt fester Werte.

Bilder: `a-` bis `e-ablauf-handy.png` (Einzelbilder zu den Zeiten darunter, Handy 390 × 640), `a-` bis `e-desktop.png` (Endbild am Computer).
