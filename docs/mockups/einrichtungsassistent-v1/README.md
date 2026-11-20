# Einrichtungsassistent (v1, 2026-11-19): Konzept mit Mockups

Wunsch des Nutzers vom 2026-11-19, 20:43 (gekürzt): Ein Assistent erscheint, sobald man eine neue Anlage hinzufügt, einmal je Anlage.
Wegdrücken mit der Wahl "nicht mehr anzeigen" oder "morgen" (dann erscheint er ab dem nächsten Tag beim nächsten Laden wieder). Ziel:
geführte erste Einrichtung mit den grundlegenden Optionen, dabei die Möglichkeiten kennenlernen, mit informativem Teil. Zuerst ein
Willkommensbildschirm, dann Schritte: Sensoren über eine Filteransicht wählen (ohne Voreinstellungen, der Standard gilt), Modi, vielleicht ein
Code, die Aktionen mit dem Schalter je Modus im selben Ablauf wie heute ("die gleiche Seite nehmen und anders einbetten", damit spätere
Änderungen dort auch hier gelten; bei den Aktionen muss alles gehen), die Überwachung, falls passende Sensoren da sind, und die grundlegenden
Benachrichtigungen (Empfänger der Standardmeldungen und je Art ein Schalter, ohne Kritisch, Lautstärke usw.). Unter Konfiguration › Anlage
vor "Anlage löschen" ein kleines Kapitel "Einrichtungsassistent" mit einem Knopf zum erneuten Starten. "Bitte erstelle mal ein Konzept,
vielleicht mit Mockups … Bewerte es, falls ich etwas vergessen habe".

Aufgenommen im HA-Nachbau (Computer hell, Handy dunkel, Deutsch). Der Assistent liegt als Ebene über dem echten Panel und ist aus dessen
Bausteinen gebaut (Karten, Schalter, Kästchen, Knöpfe, Kapitel, Fenster). In "Alarmaktionen" und "Überwachung" steckt der **echte Editor**
des Reiters Aktionen, in den Assistenten verschoben: genau so würde er eingebettet. Erfundene Daten und Namen (Marco, Anna). Quelle:
`src/shots.mjs`. Übersicht: `uebersicht-desktop.png`, `uebersicht-handy.png`.

## Bewertung der Idee

Sinnvoll. Heute steht eine neue Anlage leer da: keine Sensoren, keine Zonen, kein Eingang, keine Empfänger. Die Reiter zeigen alles auf
einmal, auch was es am Anfang nicht braucht (Sensoroptionen, Gruppen, stille Alarme, Routinen). Der Assistent führt durch das, ohne das die
Anlage nicht sinnvoll schützt, und zeigt dabei, wo die Dinge später stehen. Zwei Punkte machen ihn wartbar: Er baut keine eigenen Editoren,
sondern bettet die bestehenden ein (Aktionen, Überwachung) oder nutzt ihre Daten und Speicherwege (Modi, Sensoren, Codes, Meldungen), und
jeder Schritt speichert mit "Weiter" über denselben Weg wie "Speichern" im Reiter.

## Was fehlte (Vorschlag der Prüfstelle)

1. **Eingang und Zeiten (wichtig):** Ohne Eingangssensor löst schon das Öffnen der Haustür sofort den Alarm aus, und ohne Zeit zum Verlassen
   kommt man bei "Abwesend" nicht aus dem Haus. Darum Schritt 3 "Zuordnung und Eingang": welcher Sensor in welchem Modus auslöst (Vorschlag
   nach Sensorart), welche Tür der Eingang ist, Zeit zum Verlassen (Standard 60 s) und zum Deaktivieren (Standard 30 s).
2. **Wo die Sensoren auslösen:** Neue Sensoren liegen heute in keiner Zone. Der Assistent schlägt vor: Türen und Fenster in jedem Modus,
   Bewegung nur bei "Abwesend", Rauch, Wasser und Gas "Immer aktiv". Ohne diesen Vorschlag wäre jede Anlage nach dem Assistenten noch blind.
3. **Reihenfolge:** Modi vor Sensoren (die Zuordnung braucht die Modi) und Meldungen vor Aktionen (die Push-Meldung der Aktionen geht an die
   Alarm-Empfänger; ohne Empfänger geht sie nirgends hin).
4. **Ausprobieren am Schluss:** Testmeldung (kritische Meldungen müssen in der Companion App erlaubt sein, sonst sind sie im Stumm-Modus leise)
   und "Alarmaktionen testen". Dazu "Bereit zum Scharfschalten" mit den offenen Sensoren.
5. **Grenzen offen sagen:** Kein Alarm, wenn Home Assistant, Strom oder Netz ausfallen (Willkommen); Hinweis auf Sirene mit Akku und
   HealthCheck-Dienste.
6. **Ausblick statt Einstellungen:** Routinen, weitere Codes, HealthCheck-Dienste und die Dashboard-Karte nur als Hinweis am Schluss.

Bewusst **nicht** im Assistenten: Optionen je Sensor (der Standard der Sensorart gilt), Einstellungen pro Modus für Sensoren und Zeiten,
kritisch, Lautstärke, eigene Texte und eigene Empfänger je Meldung, stille Alarme (sie stehen im eingebetteten Editor, werden aber nicht
erklärt), Routinen, eigene Töne, HealthCheck-Dienste, Backup (automatisch an), Ansicht.

## Ablauf

| Bild | Schritt | Inhalt |
| --- | --- | --- |
| `willkommen-*.png` | Willkommen | Was der Assistent tut, die Schritte mit je einem Satz, Dauer (etwa 10 Minuten), "jeder Schritt wird mit Weiter gespeichert", Grenzen einer Alarmanlage in Home Assistant. "Los geht's" oder "Später". |
| `spaeter-*.png` | Später | "Morgen wieder anzeigen" (erscheint beim ersten Öffnen des Panels ab dem nächsten Tag), "Nicht mehr anzeigen" (nur noch über Konfiguration › Anlage), "Weiter einrichten". Dasselbe Fenster beim X und beim "Später" jedes Schritts. |
| `modi-*.png` | 1 Modi | Anwesend, Abwesend, Nacht mit Beispiel, was auslöst; "Immer aktiv" für Rauch, Wasser und Gas (Standard an). Mindestens ein Modus. |
| `sensoren-*.png` | 2 Sensoren | Liste aller passenden Sensoren nach Bereich, Suche, Filter (Alle, Türen und Fenster, Bewegung, Rauch und Wasser, Weitere), "Alle in der Liste wählen". Keine Optionen je Sensor. |
| `zuordnung-*.png` | 3 Zuordnung und Eingang | Tabelle wie unter Konfiguration › Sensoren, vorbelegt nach Sensorart (nur die eingeschalteten Modi), Schalter "Eingang" bei Türen, Zeit zum Verlassen und zum Deaktivieren. |
| `code-*.png` | 4 Code | Ein Code für dich (Name und Benutzer vorgewählt), wie das Formular "Code hinzufügen"; "Ohne Code weiter". Hinweis auf weitere Codes je Person. |
| `meldungen-*.png` | 5 Meldungen | Alarm-Empfänger; Schalter "Wartung an dieselben Empfänger" (aus: eigene Liste); je Art ein Schalter mit einem Satz Erklärung (Alarm immer an); Testmeldung. |
| `aktionen-*.png`, `aktionen-alarm-*.png` | 6 Alarmaktionen | Der echte Editor des Reiters Aktionen mit "Einstellungen pro Modus" und den Reitern der eingeschalteten Modi, alles wie im Reiter (Play, Stift, Ziehen, Gruppen). Darüber eine Erklärung und "Schnell hinzufügen" (Vorschlag, siehe Fragen). |
| `ueberwachung-*.png` | 7 Überwachung | Nur, wenn es Messwerte (Temperatur, Luftfeuchtigkeit, CO2 …) gibt: Schalter "Überwachung verwenden", die gefundenen Sensoren, darunter der echte Editor der Regeln. |
| `fertig-*.png` | Fertig | Zusammenfassung mit "Ändern" je Schritt, "Alarmaktionen testen", Testmeldung, "Bereit zum Scharfschalten", Ausblick. |
| `anlage-kapitel-*.png` | Konfiguration › Anlage | Neues Kapitel "Einrichtungsassistent" vor "Anlage löschen": Zustand (abgeschlossen am, ausgeblendet, offen bei Schritt N) und "Assistent starten". |

## Rahmen: zwei Varianten (Computer; auf dem Handy immer ganzer Bildschirm)

| Variante | Bilder | Beschreibung |
| --- | --- | --- |
| A "Fenster" | `a-willkommen-desktop.png`, `a-aktionen-desktop.png` | Wie die übrigen Fenster des Panels (940 px), Fortschritt als Balken oben. Das Panel bleibt dahinter sichtbar. |
| B "Seite mit Schrittliste" | alle übrigen `*-desktop.png` | Ganze Fläche des Panels, links die Schritte mit Haken und kurzer Zusammenfassung, rechts der Schritt, unten Zurück/Weiter. |

**Empfehlung: B.** Der Editor der Aktionen und die Tabelle der Zuordnung brauchen Breite (in A sind sie gedrängt, siehe `a-aktionen`), die
Schrittliste zeigt jederzeit, wo man steht und was schon gespeichert ist, und eine Einrichtung von 10 Minuten fühlt sich als eigene Seite
ruhiger an als ein Fenster. Auf dem Handy sind A und B gleich: ganzer Bildschirm, Fortschritt oben, Zurück und Weiter unten.

## Verhalten (Vorschlag)

- **Wann er erscheint:** einmal je Anlage, für jede neu angelegte Anlage, egal ob über "Anlage hinzufügen" im Panel (dann sofort) oder über
  Einstellungen › Geräte und Dienste (dann beim nächsten Öffnen des Panels mit dieser Anlage). Hat man mehrere offene Anlagen, erscheint er für
  die gewählte. Nur Administratoren sehen das Panel, also auch nur sie den Assistenten.
- **Später:** "Morgen wieder anzeigen" merkt das Datum; beim ersten Laden des Panels ab dem nächsten Tag (Ortszeit von Home Assistant)
  erscheint er wieder, beim angefangenen Schritt. "Nicht mehr anzeigen" blendet ihn für diese Anlage aus.
- **Gemerkt im Server, je Anlage** (nicht im Browser): wer ihn auf dem Handy wegdrückt, sieht ihn am Computer nicht wieder, und ein zweiter
  Administrator sieht denselben Stand. Gespeichert neben den Einstellungen, nicht in den Optionen der Anlage (sonst lädt sie bei jedem Schritt
  neu); nicht im Backup (Zustand der Oberfläche).
- **Speichern je Schritt:** "Weiter" speichert den Schritt über denselben Weg wie "Speichern" im Reiter; ungültige Felder sind rot, "Weiter"
  ist dann gesperrt. "Zurück" geht ohne Speichern. Wer abbricht, behält alles bis zum letzten "Weiter".
- **Offene Entwürfe:** Hat ein Reiter ungespeicherte Änderungen, fragt der Assistent vor dem Start, ob sie gespeichert oder verworfen werden
  (er schreibt dieselben Daten).
- **Neu starten** (Konfiguration › Anlage): mit den heutigen Werten vorbelegt, nichts wird gelöscht; der Assistent ist dann ein geführter Weg
  durch die Grundeinstellungen. "Nicht mehr anzeigen" lässt sich dort zurücknehmen.
- **Bestehende Anlagen nach dem Update:** kein automatischer Assistent (sie sind eingerichtet); der Knopf steht im neuen Kapitel.

## Technik (Vorschlag)

- **Server:** Zustand je Anlage (`state`: offen, später bis Datum, ausgeblendet, abgeschlossen; `step`) in der Ablage der Einstellungen, in
  `alarmageddon/data` mitgeliefert (klein), WS-Befehl zum Setzen (nur Administratoren, Eintrag in `test_security.py`). Neue Anlagen bekommen beim
  Anlegen "offen", bestehende beim Update "abgeschlossen". Entfernte Anlagen nehmen ihren Eintrag mit.
- **Panel:** neues Modul `wizard.js` (Rahmen, Schritte, Willkommen, Fertig). Die Reiter-Ansichten (`actions.js`, Überwachung,
  `notify.js`, `sensors.js`, `system.js`) zeichnen heute in `h._view`; sie bekommen einen Behälter als Ziel, damit derselbe Code im Reiter
  und im Assistenten zeichnet. Aktionen und Überwachung erscheinen unverändert; Modi, Sensorliste, Zuordnung, Code und Meldungen nutzen die
  Entwürfe und Speicherwege der Reiter mit einer vereinfachten Darstellung. Eine spätere Änderung am Editor der Aktionen gilt so automatisch
  auch im Assistenten.
- **Vorschlag der Zuordnung:** eine Tabelle Sensorart → Modi und "Immer aktiv" (Panel und Server gleich, Test wie `test_alarm_kinds.py`).
- **Tests:** Server (Zustand, "morgen" über Mitternacht, je Anlage, bestehende Anlagen nicht, Neustart des Assistenten ändert nichts ohne
  "Weiter"), Suite `wizard-e2e.mjs` (Desktop und Handy, Deutsch und Englisch, alle Schritte, Später, Fortsetzen), die bestehenden Suiten der
  Reiter laufen weiter (sie prüfen den eingebetteten Editor mit).
- **Umfang:** gross (eine eigene Version, 1.69.0). Grösstes Risiko ist das Umbauen der Reiter auf einen Behälter; die Suiten der Reiter
  sichern das ab.

## Fragen an den Nutzer (je mit Empfehlung)

1. Rahmen: **B "Seite mit Schrittliste"** oder A "Fenster"?
2. Reihenfolge: **Modi, Sensoren, Zuordnung und Eingang, Code, Meldungen, Aktionen, Überwachung** (Meldungen vor Aktionen)?
3. Schritt "Zuordnung und Eingang" mit Vorschlag nach Sensorart und den zwei Zeiten: **ja**?
4. Bestehende Anlagen nach dem Update: **kein automatischer Assistent**, nur der Knopf?
5. Neu starten: **mit den heutigen Werten vorbelegt, nichts gelöscht**?
6. "Schnell hinzufügen" bei den Aktionen (Sirene 3 Minuten, Licht an, Alarmton: öffnet den Schritt vorbelegt, das Gerät wählt man selbst):
   **ja**, oder nur der Editor?

## Entscheide des Nutzers (2026-11-19, 21:05)

Wörtlich: "Merkt ihr auch noch, dass wenn jemand einen Visitor unterbricht und am nächsten Tag weitermacht, soll es genau an der Stelle
weitergehen. 1. B passt 2. passt, code muss freiwillig sein. Bei meldung nach alarm default und wartungs default empfänger fragen. 3. passt
4. ja passt 5. genau, bei einem neuen start ist alles wie aktuell konfiguriert vorgewählt 6. ohne licht, rest passt."

1. Rahmen **B** (Seite mit Schrittliste).
2. Reihenfolge wie vorgeschlagen; der **Code ist freiwillig** ("Ohne Code weiter"). Im Schritt "Meldungen" werden die **Empfänger der Alarme
   und die Empfänger der Wartung** getrennt gefragt (die Bilder `meldungen-*.png` zeigen noch eine gemeinsame Liste).
3. "Zuordnung und Eingang" mit Vorschlag nach Sensorart und den zwei Zeiten.
4. Bestehende Anlagen bekommen den Assistenten nach dem Update nicht von selbst, nur über den Knopf.
5. Ein neuer Start zeigt alles so vorgewählt, wie es aktuell eingerichtet ist.
6. "Schnell hinzufügen" nur mit **"Sirene 3 Minuten" und "Alarmton"**, ohne Licht (die Bilder `aktionen-*.png` zeigen noch "Licht an").
7. Unterbrechen und am nächsten Tag weitermachen: **genau beim Schritt**, bei dem man aufgehört hat (der Server merkt sich den Schritt).

Umgesetzt in 1.69.0 (`panel/wizard.js`, `settings.py`, Befehl `alarmageddon/wizard`, Suite `wizard-e2e.mjs`). Abweichung vom Mockup auf dem
Handy: die Tabelle der Zuordnung hat dort keine Spalte für den Eingang, darum steht unter der Tabelle ein Kapitel "Eingangsverzögerung" mit
einem Schalter je Sensor (wählbar ist nur, was in einem Modus auslöst).
