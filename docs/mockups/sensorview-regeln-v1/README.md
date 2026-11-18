# Sensoransicht: Ereignisse und Regeln (v1, 2026-11-18)

Wunsch des Nutzers vom 2026-11-18, 17:43 (Bildschirmfotos "Kühlschrank Küche" und "Kühlschrank Reduit"): unter der Grafik eines Sensors der
Überwachung die Ereignisse und die Regeln, in denen der Sensor vorkommt, beide durchsuchbar und sortierbar; ein Klick auf eine Regel führt zu ihr.
Dazu die Frage, warum die Grenze nur bei einem der beiden Kühlschränke in der Grafik steht.

Aufgenommen in der echten Sensoransicht des HA-Nachbaus (dunkel, Deutsch), die Liste unter der Grafik ist durch die Varianten ersetzt. Erfundene
Daten. Quelle: `src/shots.mjs`.

## Warum fehlt die Grenze beim Reduit?

Die Grafik zeigt eine Grenze nur, wenn sie höchstens zwei Spannweiten der Werte von ihnen entfernt liegt (`sensorview.js _valueLine`), damit eine
weit entfernte Grenze die Kurve nicht flach drückt. Küche: Werte 6,6 bis 11,5 °C, Spannweite 4,9, gezeigt wird bis 21,3 °C, die Grenze 14 °C
erscheint. Reduit: Werte 4,8 bis 6,1 °C, Spannweite 1,3, gezeigt wird nur bis 8,7 °C; eine Grenze darüber (zum Beispiel 14 °C) fällt weg, ohne
Hinweis. Nicht geprüft: die Grenze der Regel des Reduits (die Konfiguration ist hier nicht bekannt). Die zweite mögliche Ursache wäre eine Regel,
die einen anderen Sensor beobachtet.

Vorschlag `grenze-am-rand-*.png`: eine Grenze ausserhalb des gezeigten Bereichs steht als Marke am Rand ("↑ Grenze 25 °C (ausserhalb)"), statt
zu verschwinden. Die Kurve bleibt gross.

## Variante A: zwei Reiter unter der Grafik (Empfehlung)

`a-ereignisse-*.png`, `a-regeln-*.png`

- Reiterleiste "Ereignisse" und "Regeln" mit Anzahl, darunter ein Suchfeld je Reiter, Tabellenkopf zum Sortieren (wie im übrigen Panel).
- Ereignisse: Zeit, Ereignis, Stand, Regel (wie bisher, neu durchsuchbar und sortierbar).
- Regeln: Name mit Bedingung in Klartext, Anlage (nur bei mehreren Anlagen), Zustand (Aktiv, Aus; dazu "Ausserhalb" rot, wenn die Regel gerade
  ausgelöst ist), runder Pfeil. Der Pfeil führt zu Konfiguration › Aktionen › Überwachung der Anlage, die Regel aufgeklappt und kurz markiert.
- Grafik und Kennzahlen bleiben oben stehen, nur die Liste darunter wechselt: auf dem Handy bleibt so viel Platz für die Ereignisse wie heute.

## Variante B: Regeln oben als Karten, Ereignisse darunter

`b-regeln-oben-*.png`

- Alles auf einen Blick, ohne Reiter. Bei mehreren Regeln schiebt es die Ereignisse auf dem Handy nach unten (bei drei Regeln etwa eine
  Bildschirmhöhe), Suchen und Sortieren gibt es nur für die Ereignisse.

## Empfehlung

A: passt zu jeder Zahl von Regeln, Suchen und Sortieren gelten für beide Listen, der Platz für die Ereignisse bleibt. Die Reiterleiste ist eine
gewöhnliche Leiste des Panels (blau, keine Reiter der Modi).

## Entscheid des Nutzers (2026-11-18, 18:58), gebaut in 1.65.0

1. Variante A, aber der Reiter heisst "Aktionen" statt "Regeln"; in der Tabelle (mehr Platz) "Überwachungsaktionen", damit klar ist, dass es nur
   die Aktionen der Überwachung sind.
2. Für alles, was in einer Aktion der Überwachung vorkommt (Messwerte und Ja/Nein-Sensoren).
3. Grenze immer sichtbar (als Linie, die Grafik reicht bis zu ihr; keine Marke am Rand).
4. Pfeil: die Aktion aufgeklappt in der Liste.

Nachtrag 19:47 (Entscheid des Nutzers): zurück zur Benennung "Regeln", wie überall im Panel. Reiter "Regeln", Spalte "Regeln", Spalte der Ereignisse
"Regel"; "Aktionen" und "Überwachungsaktionen" werden nicht verwendet.

## Offene Fragen an den Nutzer (beantwortet, oben)

1. Variante A oder B.
2. Nur Messwerte oder auch Ja/Nein-Sensoren, die in einer Regel vorkommen (zum Beispiel die Kühlschranktür)?
3. Grenze ausserhalb: Marke am Rand (Vorschlag) oder Grafik immer so weit, dass jede Grenze als Linie zu sehen ist (die Kurve wird flacher)?
4. Ziel des Pfeils: Regel aufgeklappt in der Liste (Vorschlag) oder direkt das Fenster "Regel bearbeiten"?

Nebenbei gefunden (im Nachbau): der "Stand" in den Ereignissen stand mit Punkt ("6.1 °C") statt im Format der Sprache ("6,1 °C"); behoben in 1.64.0.
