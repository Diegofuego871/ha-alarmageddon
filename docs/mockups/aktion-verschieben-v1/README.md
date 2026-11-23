# Aktion verschieben (v1, 2026-11-23): Knopf an der Aktion, Fenster mit Modi und Phasen-Baum

Wunsch des Nutzers vom 2026-11-23 (mit Bildschirmfoto der Aktionen im Modus "Abwesend"):

> Ich möchte hier noch einen Button, der Aktionen verschieben kann. Wenn man diesen Button drückt, öffnet sich ein Popup (gleiches Design wie
> bisherige Popups, Handy Fullscreen). Da soll, falls aktiv, ganz oben ein Tab-Switch sein, um zwischen Modi zu wechseln. Darunter eine grafische
> Baumstruktur, bei der ich alle Phasen sehen und die gewünschte anwählen kann. Es werden nur Zielorte gezeigt, die für das Objekt auch erlaubt sind.

Aufgenommen im HA-Nachbau (Computer hell, Handy dunkel, Deutsch), gebaut aus den Klassen des Panels und wenigen eigenen Stilen. Erfundene Daten.
Quelle: `src/shots.mjs` (Aufruf im Wurzelverzeichnis: `node docs/mockups/aktion-verschieben-v1/src/shots.mjs`). Das Symbol des Knopfes
(Pfeile nach oben und unten) ist vorläufig.

## Der Knopf (in allen Varianten gleich)

Ein runder Knopf, gleiche Grösse und Art wie Testen, Bearbeiten, Duplizieren und Löschen, zwischen "Duplizieren" und "Löschen". Auf dem Handy
steht er wie die anderen in der Zeile der Knöpfe. Am Computer und auf dem Handy: `knopf-desktop.png`, `knopf-handy.png` (der blaue Ring ist nur im Mockup,
zur Markierung). Zum Vergleich: `heute-desktop.png`.

## Was in allen Varianten gleich ist

- **Fenster wie die anderen Fenster der Listen:** Titel mit Symbol und X, am Computer 880 px breit, auf dem Handy bildfüllend, Knöpfe unten.
- **Kopfzeile des Fensters:** die Aktion, die verschoben wird (Symbol und Name), dazu "jetzt: Abwesend › Alarm beginnt".
- **Reiter der Modi ganz oben** (Anwesend, Abwesend, Nacht, Immer aktiv) im Stil der Modus-Reiter (`ag-modeseg`). Sie stehen nur, wenn
  "Einstellungen pro Modus" an ist; sonst gibt es nur einen Ablauf und das Fenster zeigt gleich den Baum. Der Reiter des aktuellen Modus ist vorgewählt;
  ein Wechsel zeigt den Baum des anderen Modus. "Überwachung" fehlt: ihre Regeln sind eine eigene Welt (nur Push, Gerät schalten, Warten).
- **Der Baum** zeigt die Phasen in der Reihenfolge des Ablaufs, mit der Linie wie im Ablauf: Beim Scharfschalten (Scharfschalten beginnt, Anlage
  scharf), Bei einem stillen Alarm, Bei einem Alarm (Eingangsverzögerung, Alarm beginnt, Alarm endet), Beim Deaktivieren. Phasen, die es im Modus nicht
  gibt, fehlen (Verzögerungen nur mit eingestellter Zeit; "Immer aktiv" wird nie scharf: `a-immer-aktiv-desktop.png`).
- **Nur erlaubte Ziele:** die Phasen, in denen die Aktion nicht möglich ist, werden nicht gezeigt (gleiche Regeln wie beim Ziehen und im Auswahlfenster: zum
  Beispiel der Alarmton nur im Alarm und danach, der Aktivierungston nur beim Scharfschalten). Ein Hinweis nennt, wie viele Phasen fehlen
  (`a-eingeschraenkt-desktop.png`, `a-eingeschraenkt-handy.png`). So gibt es keine Rückfrage "ungültige Aktionen fallen weg" mehr.
- **"hier":** die aktuelle Phase steht gestrichelt und grau da, nicht wählbar (Verschieben an dieselbe Stelle wäre nichts).
- **Gruppen:** eine Gruppe ("Sirene") ist ein Unterknoten ihrer Phase, ein Ziel wie die Phase selbst; eine Gruppe "bis deaktiviert" gibt es nur im Alarm.
- **Fusszeile:** links das gewählte Ziel in Worten ("Ziel: Abwesend › Alarm endet · am Ende"), rechts "Abbrechen" und "Verschieben" (gesperrt, bis ein Ziel
  gewählt ist). Verschieben ändert nur den Entwurf der Seite; gespeichert wird wie immer unten mit "Speichern" (offener orange Punkt am Reiter).

## Variante A: Baum, Ziel ist Anfang oder Ende der Phase (Empfehlung)

`a-desktop.png`, `a-handy.png` (sichtbarer Ausschnitt), `a-handy-ganz.png` (ganzer Inhalt zum Vergleich).

Ein Knoten je Phase mit Symbol auf der Linie, Name, kurzem Text und Anzahl der Aktionen; Auswahl mit Kreis. Unter dem Baum ein Schalter "Am Anfang / Am
Ende" (Standard: am Ende). Wer eine genaue Stelle in der Mitte will, verschiebt danach wie bisher durch Ziehen oder mit den Pfeiltasten.

- **Vorteile:** genau das, was gewünscht war; überschaubar, auf dem Handy gut tippbar, am wenigsten Bauaufwand.
- **Nachteil:** keine genaue Stelle in der Mitte der Phase.

## Variante B: Baum mit Einfügepunkten (genaue Stelle)

`b-desktop.png`, `b-handy.png`.

Wie A, aber die gewählte Phase klappt auf und zeigt ihre Aktionen mit Einfügepunkten dazwischen ("Hier einfügen"). Die Fusszeile sagt: "nach 'Push-Meldung'".

- **Vorteile:** genaue Stelle ohne Nacharbeit.
- **Nachteile:** der Baum wird bei langen Abläufen lang (Gruppen mit vielen Aktionen), auf dem Handy viel Scrollen; mehr Bauaufwand.

## Variante C: Kacheln statt Baum

`c-desktop.png`, `c-handy.png`.

Dieselben Phasen als Kacheln in zwei Spalten, nach Kapiteln gegliedert, ohne Linie. Kein Unterknoten für Gruppen (Ziel nur die Phase).

- **Vorteile:** am kompaktesten, am Computer alles auf einen Blick.
- **Nachteile:** das Bild eines Ablaufs (Reihenfolge, Zusammenhang) geht verloren, Gruppen nicht wählbar; weicht von der Vorgabe "Baumstruktur" ab.

## Empfehlung

**Variante A.** Sie setzt die Vorgabe (Reiter oben, grafischer Baum, nur erlaubte Ziele) am direktesten um und bleibt auf dem Handy bedienbar. Falls die genaue Stelle
wichtig ist, lässt sich B später aus A entwickeln (die gewählte Phase klappt auf), ohne dass der Rest ändert.

## Offene Fragen für die Entscheidung

1. **Variante** (A, B oder C)?
2. **Position:** reicht "Am Anfang / Am Ende" (A), oder soll die genaue Stelle wählbar sein (B)?
3. **Nach dem Verschieben:** soll die Seite zur Aktion im neuen Ort wechseln (Reiter des Modus, Phase aufscrollen, kurz hervorheben) oder beim jetzigen Ort bleiben?
   Empfehlung: wechseln und hervorheben, denn sonst ist die Aktion "verschwunden".
4. **Symbol des Knopfes:** Pfeile nach oben und unten (vorläufig) oder ein anderes?
