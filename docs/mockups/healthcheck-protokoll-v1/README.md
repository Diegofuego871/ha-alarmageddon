# Protokoll der HealthCheck-Dienste (v1, 2026-11-19)

Wunsch des Nutzers vom 2026-11-19, 17:06 (Bildschirmfotos: Liste der Dienste mit eingekreister Stelle links von "Fehler senden", Ansicht eines
Anbieters mit Erfolgsquote und Ereignissen, Sensoransicht eines Kühlschranks): je Dienst ein Symbol, das ein Protokoll öffnet; oben ein Dropdown zum
Wechseln zwischen den Diensten; darunter der gewohnte Zeitraum; in der Mitte eine Grafik wie bei Batterie und Empfang; unten eine Liste, die
standardmässig nur Fehler und Ereignisse zeigt (gescheitert, Fehler wegen des Selbsttests, Testknopf). "Das Design soll wirklich genau gleich sein,
als würde ich auf ein Gerät gehen."

Aufgenommen in der echten Sensoransicht des HA-Nachbaus (Computer hell, Handy dunkel, Deutsch), ihr Inhalt durch das Protokoll ersetzt: Fenster,
Kopf, Kacheln, Zeitraum, Kennzahlen, Grafik, Legende, Reiter, Suche und Tabelle sind dieselben Bausteine. Erfundene Daten und Adressen, nie die
Ping-URL eines Nutzers. Quelle: `src/shots.mjs`. Übersicht: `uebersicht-desktop.png`, `uebersicht-handy.png`.

## Öffnen

`liste-*.png`: ein neuer runder Knopf "Protokoll" (Symbol Verlauf, gestrichelt markiert) als erster Knopf je Zeile, an der eingekreisten Stelle.
Auf dem Handy passen fünf Knöpfe in die Zeile unter dem Eintrag.

## Aufbau (wie die Sensoransicht)

- **Kopf:** getöntes Herz wie im Titel der Liste, der Name als Dropdown mit kleinem Pfeil (`auswahl-*.png`: alle Dienste mit Punkt in der Farbe
  ihres Zustands und "in Ordnung seit …" oder "gescheitert seit …"), darunter Rechner, erkannter Anbieter und Intervall; rechts der Zustand als
  Pille und "Bearbeiten" (öffnet das Formular) an der Stelle von "In HA öffnen".
- **Kacheln:** "Verlauf" (Zustand seit), "Antwortzeit" (letzter Wert), "Dienst" (Angaben wie die Kachel "Gerät", `dienst-*.png`: Name, erkannt,
  Ping-URL ganz, Fehler-Zusatz, Intervall, letzter Aufruf, seit wann aufgezeichnet).
- **Zeitraum:** 3 Std. bis 30 Tage, wie bei den Sensoren.
- **Kennzahlen:** erfolgreich (in Prozent), Lebenszeichen, gescheitert, Fehler gemeldet, Antwortzeit im Mittel (auf dem Handy die ersten drei).
- **Liste:** Reiter "Ereignisse" (Standard) und "Alle Aufrufe", je mit Anzahl im Zeitraum, Suche, Sortierung nach jeder Spalte (Zeit, Ereignis,
  Ergebnis, Antwortzeit, Auslöser), Zeilen je Tag. Ereignisse: gescheitert (rot, mit Grund: keine Antwort, keine Verbindung, HTTP-Status), Fehler
  gemeldet wegen des Selbsttests (orange, mit Zahl der Probleme), Test (blau), wieder in Ordnung (grün), erstes Lebenszeichen nach dem Start (grau).
  Auslöser: Takt, Selbsttest, Test, Start.

## Grafik: Variante A "Herzschlag" (Empfehlung)

`a-verlauf-1tag-*.png`, `a-verlauf-7tage-*.png`

- Je Aufruf ein Balken (bei langen Zeiträumen je Abschnitt): die Höhe ist die Antwortzeit, die Farbe das Ergebnis. Gescheitert ist rot und ganz
  hoch, eine Lücke ohne Daten (Home Assistant aus) grau.
- Darunter ein Band mit dem Ergebnis je Abschnitt, wie die Leiste "Healthy" der Anbieter: Fehler, Tests und Lücken fallen auf einen Blick auf,
  auch wenn ihr Balken klein ist.
- Zeigt Erfolg und Antwortzeit in einer Grafik; sieht aus wie ein Herzschlag und passt zum Herz-Symbol.

## Variante B "Zeitleiste je Tag"

`b-zeitleiste-7tage-*.png`: wie Türen und Fenster eine Zeile je Tag, grün, solange Lebenszeichen ankommen, mit roten, orangen und blauen Marken.
Gut für "wann genau", aber ohne Antwortzeit und bei 30 Tagen sehr hoch.

## Kachel "Antwortzeit"

`antwortzeit-1tag-*.png`: Linie mit Fläche wie "Empfang", Zonen schnell (bis 300 ms), langsam, sehr langsam (über 1 s), gestrichelte rote Marke bei
einem gescheiterten Aufruf; Kennzahlen aktuell, im Mittel, langsamster Aufruf, ohne Antwort.

## Liste "Alle Aufrufe"

`alle-aufrufe-*.png`: jedes Lebenszeichen einzeln (Ergebnis, Antwortzeit, Auslöser). Vorschlag: einzeln nur die letzten 24 Stunden, ältere nur
zusammengefasst in der Grafik (bei 1 Minute Intervall wären es sonst 43 200 Zeilen je Monat und Dienst).

## Technik (Vorschlag)

- Jeder Aufruf hält Zeit, Art (Lebenszeichen, Fehler gemeldet, Test), Ergebnis (HTTP-Status, keine Antwort, keine Verbindung), Antwortzeit und
  Auslöser fest; nie die URL, nie den Text einer Ausnahme (er enthält oft die URL), wie im Log.
- Eigene Ablage, verzögert geschrieben: einzelne Aufrufe 24 Stunden, Stundenwerte für die Grafik 30 Tage, Ereignisse 90 Tage (höchstens 500 je
  Dienst). Entfernen eines Dienstes löscht sein Protokoll. Nicht im Backup (Laufzeitdaten wie das Protokoll der Anlagen).
- Ein Abruf auf Anfrage (`alarmageddon/healthcheck_history`, nur Administratoren), nie in der Antwort, die alle 30 Sekunden läuft.
- Aufgezeichnet wird ab dem Update; davor gibt es nichts.
- Auf dem Handy steht oben alles fest wie in der Sensoransicht, nur die Liste rollt (ihre Leiste rollt mit weg): die Grafik ist dort niedriger und
  der Text unter dem Namen kürzer, damit Platz für die Liste bleibt.

## Empfehlung

Variante A für "Verlauf", dazu die Kacheln "Antwortzeit" und "Dienst", die Liste mit "Ereignisse" als Standard und "Alle Aufrufe" für 24 Stunden.
