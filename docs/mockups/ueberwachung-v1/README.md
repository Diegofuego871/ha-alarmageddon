# Mockups: Überwachung (2026-11-16)

Wunsch des Nutzers: Temperatur, Luftfeuchtigkeit und CO2 (zum Beispiel für einen Kühlschrank) sowie Ja/Nein-Sensoren überwachen, mit eigenem Ablauf und
unabhängig vom Alarm. Entschieden: (1) **eigener Bereich "Überwachung"**, wie die anderen Modi ein- und ausschaltbar; (2) auch Ja/Nein-Sensoren;
(3) **eigener Reiter** im Ablauf (Aktionen), neben Anwesend, Abwesend, Nacht und Immer aktiv. Die Bilder zeigen die echte Seite (HA-Nachbau, hell,
Computer und Handy 390 px); die neuen Teile sind Entwurf. Quelle: `src/mock.mjs`. **Noch nicht umgesetzt.**

| Bild | Inhalt |
| --- | --- |
| `1-schalter-modi-…` | Konfiguration › Anlage › Modi: neue Zeile "Überwachung" mit Schalter (Standard an); aus: Reiter und Regeln ausgeblendet, Einstellungen bleiben |
| `2-sensoren-hinzufuegen-…` | Fenster "Sensoren hinzufügen" mit neuem Filter "Messwerte" (Temperatur, Luftfeuchtigkeit, CO2) |
| `A1-regeln-liste-…`, `A2-regel-bearbeiten-…` | **Variante A:** Reiter "Überwachung" als Liste von Regelkarten (Bedingung in Klartext, Marken, Kopieren/Bearbeiten/Löschen); die Regel im Fenster mit Name, Bedingung (Baum wie bei den Routinen plus "über/unter X"), Dauer, Rückkehr-Spanne, zwei Abläufen |
| `B-ablauf-je-regel-…` | **Variante B:** jede Regel ist ein Kapitel mit dem Ablauf direkt auf der Seite, in den Zonenfarben der Aktionen: "Ausserhalb der Grenzen" (orange) und "Wieder in Ordnung" (grün); Schritte wie in den Aktionen, ziehbar |

## Regeln (für beide Varianten)

- Eine Regel: **Bedingung** (Messwert über/unter/ausserhalb, oder Ja/Nein-Zustand; Und/Oder, Gruppen, Uhrzeit-Fenster und "Anlage ist scharf in Modus …"
  wie bei den Routinen) + **Dauer** (zum Beispiel 30 Minuten) + **Rückkehr-Spanne** + zwei **Abläufe**: "Wenn ausserhalb" und "Wenn wieder in Ordnung".
- Schritte wie in den Aktionen (Push, Gerät schalten, Szene, Warten) plus **Erinnerung** alle N Stunden, solange es anhält.
- Neue Platzhalter für Texte: `{sensor}`, `{value}`, `{unit}`, `{limit}`, `{since}`.
- Läuft immer, auch bei deaktivierter Anlage, und löst nie die Sirene oder den Alarm aus. Ein nicht erreichbarer Sensor zählt nie als Wert
  (er meldet höchstens "nicht erreichbar" als eigene Meldung).
- Eigene Empfänger und Dringlichkeit im Push-Schritt, nicht die der Alarmmeldungen.
- In der Sicherung; "Stiller Alarm" bleibt vorerst unverändert und wird später durch eine Regel mit "Anlage ist scharf" ersetzt (eigene Freigabe).

## Empfehlung

**Variante B**, weil sie genau wie die Aktionen aussieht (gleiche Farben, gleiche Schritte, gleiches Ziehen) und der Ablauf jeder Regel auf einen Blick
sichtbar ist. Variante A ist übersichtlicher bei vielen Regeln (zehn Regeln sind zehn Zeilen, nicht zehn Kapitel). Mischform: B mit einer
einklappbaren Zeile je Regel (Name, Bedingung, Marken), Klick klappt den Ablauf auf.
