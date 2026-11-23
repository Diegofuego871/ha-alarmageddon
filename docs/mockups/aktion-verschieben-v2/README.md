# Aktion verschieben oder kopieren (v2, 2026-11-23): Variante B, Symbole, Kopieren, nach dem Verschieben

Entscheide des Nutzers zu `aktion-verschieben-v1`:

1. **Variante B** (Baum mit Einfügepunkten).
2. **Genaue Stelle** (nicht nur Anfang oder Ende).
3. Nach dem Verschieben **springt die Seite zur Aktion** und hebt sie hervor.
4. **Das Symbol passt nicht:** andere Vorschläge.
5. Im Fenster neben "Verschieben" auch **"Kopieren"**; der Knopf "Duplizieren" an der Karte bleibt.

Aufgenommen im HA-Nachbau (Computer hell, Handy dunkel, Deutsch), gebaut aus den Klassen des Panels. Erfundene Daten. Quelle: `src/shots.mjs`
(Aufruf im Wurzelverzeichnis: `node docs/mockups/aktion-verschieben-v2/src/shots.mjs`). Symbole: Material Design Icons (Apache 2.0).

## 1. Symbole für den Knopf

`symbole-desktop.png`, `symbole-handy.png`: sechs Vorschläge, jeweils in der Zeile der Knöpfe einer echten Karte (zwischen "Duplizieren" und "Löschen"),
daneben gross.

| Nr. | Symbol | Bedeutung |
|---|---|---|
| 1 | Vierfachpfeil | das übliche Zeichen für Verschieben |
| 2 | Ordner mit Pfeil | in einen anderen Ort legen |
| 3 | Blatt mit Pfeil | Aktion an einen anderen Ort |
| 4 | Pfeil nach unten rechts | einordnen |
| 5 | Pfeil in Kasten | in einen Ort hinein |
| 6 | Pfeil mit Strich | von hier nach dort |

Der Knopf steht für "Verschieben oder kopieren"; sein Tooltip heisst so. **Empfehlung: 2 (Ordner mit Pfeil)** oder 1 (Vierfachpfeil): beide sind sofort als
"an einen anderen Ort" lesbar und unterscheiden sich klar von "Duplizieren". Der Vierfachpfeil sagt aber eher "frei bewegen" als "an einen Ort in
der Liste".

## 2. Das Fenster (Variante B, mit Kopieren)

`b-desktop.png`, `b-handy.png` (sichtbarer Ausschnitt), `b-handy-ganz.png` (ganzer Inhalt).

- **Titel:** "Aktion verschieben oder kopieren" mit dem gewählten Symbol; darunter die Aktion mit ihrem jetzigen Ort.
- **Reiter der Modi** oben (nur mit "Einstellungen pro Modus"), dann der Baum der Phasen wie in v1.
- **Genaue Stelle:** die gewählte Phase klappt auf und zeigt ihre Aktionen mit Einfügepunkten ("einfügen"); die gewählte Stelle heisst "Hier einfügen". Es klappt
  immer nur eine Phase auf.
- **Fusszeile:** das Ziel in Worten ("Abwesend › Alarm endet · nach …"), ein Satz zur Wirkung ("Verschieben nimmt die Aktion von hier weg, Kopieren lässt sie hier
  stehen") und drei Knöpfe: **Abbrechen**, **Kopieren**, **Verschieben** (Hauptknopf). Beide sind gesperrt, bis eine Stelle gewählt ist; "Kopieren" ist
  gesperrt, wenn die Liste voll ist (wie bei "Duplizieren"). Auf dem Handy steht "Abbrechen" in einer eigenen Zeile, darunter "Kopieren" und "Verschieben".
- **Nur erlaubte Ziele:** wie in v1; die Phasen, in denen die Aktion nicht möglich ist, fehlen.

## 3. Gleiche Phase und Gruppen

`b-gleiche-phase-desktop.png`, `b-gleiche-phase-handy.png`.

- Die **aktuelle Phase ist wählbar** (so lässt sich die Reihenfolge ändern). Die Aktion selbst steht gestrichelt da ("diese Aktion"); die beiden Einfügepunkte direkt
  davor und danach tragen "gleiche Stelle · nur Kopieren": Verschieben dorthin wäre nichts, Kopieren daneben schon.
- **Gruppen** sind Teil des Baums: eine Gruppe ("Sirene") zeigt ihre Aktionen mit eigenen Einfügepunkten, so lässt sich eine Aktion auch in eine Gruppe verschieben
  (soweit dort erlaubt; "bis deaktiviert" nur im Alarm, nie eine Gruppe in der Gruppe).

## 4. Nach dem Verschieben

`nachher-desktop.png`, `nachher-handy.png`.

Das Fenster schliesst, der Reiter des Zielmodus ist offen, die Seite scrollt zur Aktion an ihrem neuen Ort und umrahmt sie kurz (wie die Regel in der Überwachung, `ag-flash`);
eine Meldung unten nennt das Ziel ("HealthCheck melden verschoben nach Abwesend › Alarm endet"). Auch "Kopieren" springt zur neuen Aktion. Verändert wurde nur der Entwurf:
"Abbrechen" auf der Seite nimmt alles zurück, gespeichert wird mit "Speichern".

## Offene Fragen

1. **Symbol:** Nr. 1 bis 6 (Empfehlung: 2 oder 1)?
2. **Reihenfolge der Knöpfe auf der Karte:** Testen, Bearbeiten, Duplizieren, **Verschieben/Kopieren**, Löschen (wie in den Bildern)?
3. **Meldung unten:** reicht die Meldung mit dem Ziel, oder zusätzlich "Rückgängig" (nur für diesen Schritt, bis zum nächsten Eintrag im Entwurf)?
