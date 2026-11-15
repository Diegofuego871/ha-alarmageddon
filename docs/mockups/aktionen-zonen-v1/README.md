# Mockups: Aktionen, Zone auf einen Blick erkennen (2026-11-15)

Frage des Nutzers: Wie sieht man bei den Aktionen sofort, in welche Zone ein Schritt gehört (Ausgangsverzögerung, scharf, Eingangsverzögerung,
Alarm, nach dem Quittieren, Deaktivieren)? Vorschlag des Nutzers: die einzelnen Schritte mit einem Farbverlauf einfärben. Dazu andere Ideen,
dunkel, am Computer und auf dem Handy (390 px). Die Bilder sind die echte Seite des Panels (HA-Nachbau, dunkel), die Varianten liegen als
zusätzliche Stile darüber; erfundene Daten. Quelle: `src/mock.mjs` (`node docs/mockups/aktionen-zonen-v1/src/mock.mjs`).

**Entschieden: Variante E, umgesetzt in 1.40.0.**

## Zonenfarben (in allen Varianten gleich)

Die Farbe der Zone ist die Farbe des festen Punktes davor, die schon heute da ist:

| Zone | Farbe |
| --- | --- |
| Scharfschalten beginnt (Ausgangsverzögerung), Eingangsverzögerung läuft | gelb |
| Anlage scharf geschaltet, Alarm beginnt | rot |
| Nach dem Quittieren, Beim Deaktivieren | grün |

## Varianten

| Bilder | Variante |
| --- | --- |
| `0-heute-desktop.png`, `0-heute-handy.png` | Heute: alle Schritte neutral, die Zone zeigt nur der feste Punkt darüber |
| `1-A-verlauf-desktop.png`, `1-A-verlauf-handy.png` | **A: Verlauf von links** (dein Vorschlag): jede Karte läuft von der Zonenfarbe (22 %) nach neutral |
| `2-B-leiste-desktop.png`, `2-B-leiste-handy.png` | **B: Farbleiste** links an der Karte, 6 px |
| `3-C-flaeche-desktop.png`, `3-C-flaeche-handy.png` | **C: Zonenfläche**: die ganze Zone (Punkt, Linie, Karten) liegt auf einer leicht getönten Fläche mit Rand |
| `4-D-verlauf-linie-pille-desktop.png`, `4-D-verlauf-linie-pille-handy.png` | **D: Verlauf (16 %), farbige Verbindungslinie und Zonen-Pille** in jedem Schritt ("Ausgangsverzögerung", "Alarm" …). **Empfehlung** |

| `5-E-sechs-farben-desktop.png`, `5-E-sechs-farben-handy.png` | **E: wie D, mit sechs eigenen Farben** (Vorschlag des Nutzers, 2026-11-15, nach D "passt"): Ausgangsverzögerung hellorange (`#ffb74d`), Eingangsverzögerung dunkelorange (`#ef6c00`), scharf geschaltet hellrot (`#ff8a80`), Alarm dunkelrot (`#d32f2f`), nach dem Quittieren hellgrün (`#81c784`), beim Deaktivieren dunkelgrün (`#2e7d32`) |

## Einschätzung

- **A** löst die Frage, braucht aber nur Farbe: wer Gelb und Rot schlecht unterscheidet (Rot-Grün-Schwäche), sieht den Unterschied zwischen
  "Alarm" und "Beim Deaktivieren" kaum.
- **B** ist am ruhigsten und am wenigsten verändert, aber die Farbe ist nur ein schmaler Streifen und fällt auf dem Handy weniger auf.
- **C** zeigt die Zugehörigkeit am deutlichsten (Gruppe), kostet aber Platz (Innenabstand je Zone) und macht die Seite auf dem Handy länger.
- **D** (A plus farbige Linie plus Text) sagt die Zone zusätzlich in Worten und trägt die Farbe in die Verbindungslinie, ohne mehr Platz zu
  brauchen als heute, ausser einer kleinen Zeile Pille. Das ist die Variante, die auch ohne Farbe funktioniert. Wer die Pille zu viel
  findet, nimmt A mit farbiger Linie.

## Offen und zu bedenken

1. Die Symbole der Schritte tragen schon eine Farbe nach der **Art** (Alarmton rot, Gerät blau, Warten grau, Voralarm gelb). Mit einer
   Zonenfarbe auf der Karte gibt es zwei Farbsprachen. Im Mockup sieht es ruhig genug aus; wenn nicht, werden die Symbole einfarbig.
2. "Scharf geschaltet" und "Alarm" sind beide rot, "Nach dem Quittieren" und "Beim Deaktivieren" beide grün, beide Verzögerungen gelb. Sie
   stehen in verschiedenen Kapiteln. Soll "Scharf geschaltet" eine eigene Farbe bekommen (zum Beispiel Blau)? Dann ist es der einzige Ort, an dem Blau
   mehr als "auswählbar" bedeutet.
3. Nur dunkel geprüft, wie gewünscht. Im hellen Thema wäre der Verlauf mit Mischung in die Kartenfarbe (`color-mix`) schwächer und müsste
   nachgesehen werden.
4. Beim Umsetzen: Tests für alle Zonen am Computer und Handy (Farbe je Zone, Pille, Abstände), dunkel und hell.
