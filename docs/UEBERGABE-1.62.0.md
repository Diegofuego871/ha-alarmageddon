# Übergabe 1.62.0 (2026-11-17)

Lieferung der externen Prüfstelle. Basis ist `main` @ `bd64161` (1.61.0, Tag `v1.61.0` vorhanden). Zuerst dieses Protokoll, dann
`docs/HANDOVER.md` (Abschnitt 1.62.0) und `CLAUDE.md` (neu unter "Sicherheitsregeln": "Feste Meldungen im Reiter Aktionen", "Aktionen bei
einem stillen Alarm", "Vorschau einer Routine", "Zeichen der Wiederholung in einer Gruppe").

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.62.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.62.0.md`) |
| `RELEASE-NOTES-1.62.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.62.0-auf-1.61.0.patch` | alle Änderungen als ein Patch gegen `main` @ `bd64161` (mit den Bildern, binär) |
| `files/` | jede geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand muss `bd64161` sein), dann `git apply --index 1.62.0-auf-1.61.0.patch`, oder den Inhalt
von `files/` über das Repository kopieren. **Es ist keine Datei zu löschen.** Danach die Prüfungen aus Abschnitt 6, Commit mit Betreff
`1.62.0: Feste Meldungen im Reiter Aktionen, Aktionen bei einem stillen Alarm, Vorschau der Routine`, Push auf `main`, Release-Angaben
aus Abschnitt 8. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Wunsch des Nutzers vom 2026-11-17 (mit sieben Bildschirmfotos), sinngemäss:

1. Die Meldungen "Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung" und "Stiller Alarm" sollen in den Reiter Aktionen, als feste
   Elemente wie "Alarm endet": immer vorhanden, anpassen oder ausschalten. Im Reiter Benachrichtigungen verschwinden sie.
2. "Stiller Alarm" bekommt ein eigenes Kapitel im Reiter Aktionen, vor "Alarm beginnt", mit einem festen Element für die Push-Meldung.
3. In diesen Meldungen ist als Empfänger die Gruppe aus den Benachrichtigungen vorgewählt.
4. "Benachrichtigungen › Empfänger" heisst neu "Standard-Empfänger".
5. Bei der Gruppe in den Aktionen dezent zeigen, dass sich die Schritte wiederholen.
6. Im Fenster "Routinen" ein zusätzlicher Knopf (Auge): die Vorschau, die der Editor ganz unten zeigt, nur zum Lesen; auf dem Handy
   Vollbild, auf dem Desktop im selben Fenster; Fusszeile "Schliessen" und blau "Bearbeiten".

Drei Rückfragen, Antworten des Nutzers:

| Frage | Entscheid |
| --- | --- |
| Kapitel "Stiller Alarm": nur die Meldung oder auch Aktionen? | **Push und eigene Aktionen** |
| Feste Meldungen: nur ein/aus und Empfänger, oder auch eigener Text? | **Zusätzlich eigener Text** |
| Vorschau der Routine: wohin führt "Schliessen"? | **Zurück zur Liste** (das X schliesst das ganze Fenster) |

## 2. Feste Meldungen

### 2.1 Modell

- Ablage je Anlage in den Optionen: `event_notify[auslöser][art]`, Auslöser `home`, `away`, `night`, `always`; Arten `armed`, `disarmed`,
  `pending`, `sensor_report` (`const.EVENT_NOTIFY_KINDS`), für `always` nur `sensor_report` (`EVENT_NOTIFY_ALWAYS`).
- Eine Meldung (`schemas.EVENT_NOTICE_SCHEMA`): `enabled`, `critical` (Pflicht), `title` (bis 100), `message` (bis 300), `volume`,
  `persistent`, `click` (`overview`, `log`, `custom`), `click_path`, `targets` (leer = Standard-Empfänger von Alarmen).
- `schemas.valid_event_notify` lehnt unbekannte Auslöser, unbekannte Arten und Arten ab, die es für den Auslöser nicht gibt; es steht in
  `SYSTEM_OPTIONS_SCHEMA`, gilt also auch für Sicherungen.

### 2.2 Das Update ändert nichts

`notify.event_notice(options, cfg, art, auslöser, armed_mode)` liefert die wirksame Meldung: den eigenen Wert der Anlage, sonst die frühere
gemeinsame Einstellung der Art (`settings.notify["types"]`, mit den Werten je Modus, wenn "Einstellungen pro Modus" dort an ist). Es gibt
**keine Migration und kein Schreiben beim Update**: Eine Anlage, die nie etwas Eigenes speichert, meldet wie mit 1.61.0, und eine ältere
Sicherung verhält sich nach dem Einspielen wie zuvor. Geprüft gegen den alten Code: gleiche Empfänger, gleiches "kritisch", gleiche
Lautstärke, gleiche Kennung der Benachrichtigung in Home Assistant, gleiches Klickziel (Übersicht), gleiche Standardtexte. Für "Immer aktiv"
ohne eigenen Wert gilt wie bisher der Wert des Modus, in dem die Anlage gerade scharf ist.

Das Panel sendet beim Speichern nur Meldungen, die sich geändert haben (`actions.js save`); der Server ersetzt je Auslöser und Art und
behält den Rest. So wird aus einem geerbten Wert nicht still ein eigener, und Speichern ohne Änderung lädt die Anlage nicht neu.

### 2.3 Senden

`Notifier.send_event`: Standardtext der Art, ersetzt durch den eigenen Titel und Text mit Platzhaltern (`{name}`, `{sensor}`, `{type}`,
`{area}`, `{time}`, `{mode}`, neu `{person}` und `{delay}`). Bleibt vom eigenen Text nichts übrig (nur leere Platzhalter), gilt der
Standardtext. "Deaktiviert" nimmt die Werte des Modus, der scharf war (`_mode_seen`). Nach einem Alarm geht wie bisher nur die
Abschlussmeldung hinaus. Scheitert "in Home Assistant stehen lassen", geht die Meldung aufs Handy trotzdem hinaus.

Neuer Befehl `alarmageddon/test_event_notify` (nur Administratoren): Testmeldung mit den Werten aus dem Fenster, auch ungespeichert.

### 2.4 Panel

- Karte je Meldung direkt unter dem Titel ihres Punkts: Schalter links, Symbol, Name, Kurzfassung (Empfänger, kritisch, "bleibt stehen",
  "eigener Text" oder "Aus"), Stift rechts. Der Schalter ändert nur ein/aus.
- Fenster: "Meldung senden", Titel, Text, Platzhalter der Art, Vorschau, Empfänger (Standard vorgewählt), kritisch mit Lautstärke, "stehen
  lassen", Klickziel, Testmeldung. Keine Knöpfe der Alarmmeldung.
- "Einstellungen pro Modus" schaltet sich von selbst ein, wenn sich die Meldungen der Modi unterscheiden (sie zählen zum Vergleich der
  Abläufe); so überschreibt Speichern nie die Werte eines anderen Modus.
- "Aktionen übernehmen von …" (`_copyFrom`) nimmt die Aktionen des stillen Alarms und die festen Meldungen mit, die es in beiden Reitern
  gibt (nach und von "Immer aktiv" nur "Stiller Alarm").
- Reiter Benachrichtigungen: ohne die vier Arten, Kapitel "Standard-Empfänger", Hinweis auf den neuen Ort. Die früheren Werte der vier
  Arten bleiben im gespeicherten Stand unberührt erhalten.

## 3. Aktionen bei einem stillen Alarm

- Liste `workflows_report[auslöser]` in den Optionen, Schritte wie beim Scharfschalten (`schemas.valid_report_step`): Aktivierungston,
  Gerät, Warten, Szene, eigene Aktion, Gruppe mit Anzahl oder Dauer. Keine Sirene, keine Alarmmeldung, kein Quittieren, nichts "bis
  deaktiviert".
- Der Automat meldet `sensor_report` mit `scope`: der Modus, in dem die Anlage scharf ist, oder `always` für einen immer aktiven Sensor
  (`controller._report`). Je Sensor höchstens einmal in 60 Sekunden (wie die Meldung, `REPORT_THROTTLE`).
- `workflow.async_run_report`: ein Lauf neben dem Alarm (`phase: "report"`). Regeln:

| Lage | Verhalten |
| --- | --- |
| Alarm läuft | startet nicht |
| Test der Alarmaktionen läuft | startet nicht, der Test bleibt |
| Ein- oder Ausgangsverzögerung läuft (mit ihren Aktionen) | startet nicht, die Töne der Verzögerung laufen weiter |
| Aktivierungston, Aktionen nach dem Quittieren oder ein früherer stiller Alarm laufen | werden ersetzt |
| Alarm beginnt während der Aktionen | der Alarm bricht sie ab und startet sofort |
| Deaktivieren während der Aktionen | beendet sie sofort (Töne werden still) |
| Gerät antwortet nicht, Schritt oder Start scheitert | steht im Log; Alarm und Deaktivieren laufen wie immer |

- Geräte werden nicht zurückgestellt, und nach einem Neustart von Home Assistant läuft der Lauf nicht weiter (wie beim Scharfschalten).
- Panel: Kapitel "Bei einem stillen Alarm" vor "Bei einem Alarm", Punkt "Stiller Alarm" in Blaugrau, darunter die Meldung und die Liste.
  Im Reiter "Immer aktiv" stehen nur dieses Kapitel und der Alarm.

## 4. Weitere Änderungen

- **Vorschau einer Routine:** Auge je Zeile im Fenster "Routinen" (`rt-view`), zeigt `flowHtml` nur zum Lesen im selben Fenster (Handy:
  Vollbild). "Schliessen" führt zur Liste zurück, Suche und Rollstand bleiben; "Bearbeiten" öffnet den Editor; das X schliesst das Fenster.
- **Gruppe:** dünner gestrichelter Bogen mit Pfeil links neben den Schritten (`.ag-wf-loop`), nur bei Gruppen mit Schritten, reine Zierde.
  **Dazu gab es kein Mockup vorab**; es ist eine Variante. Der Nutzer entscheidet visuell (Bild `docs/img/group-de.png`).
- **Behoben:** Im Fenster einer Meldung ragte auf dem Handy das Auswahlfeld "Klickziel" über den Rand (auf Deutsch; bestand schon im
  Fenster der Abschlussmeldung). Gefunden von der neuen Suite.
- **Sicherung:** `event_notify` und `workflows_report` gehören zu den Optionen der Anlage und damit zu Export, Import und Sicherung.
- **Bilder:** neu `silent-de.png`, `silent-en.png`; neu aufgenommen `group-*`, `actions-disarm-*`, `routines-*` (alle aus dem Nachbau, mit
  erfundenen Daten).

## 5. Geänderte Dateien (Überblick)

- Server: `const.py`, `controller.py`, `notify.py`, `schemas.py`, `websocket_api.py`, `workflow.py`, `manifest.json`.
- Panel: `actions.js`, `common.js`, `customsounds.js`, `notify.js`, `routines.js`, `strings.js`, `styles.js`.
- Tests: neu `tests/test_event_notify.py`, `tests/panel/suites/notices-e2e.mjs`; angepasst `tests/test_action_hang.py`,
  `tests/test_alarm_kinds.py`, `tests/test_security.py`, `scripts/mutation_check.py`, `tests/panel/sim/ha-sim.html`,
  `tests/panel/readme-shots.mjs` und die Suiten `actions`, `armed`, `delays`, `group`, `layout`, `review`, `routines`, `switches`, `targets`.
- Dokumente: `CHANGELOG.md`, `CHANGELOG.de.md`, `README.md`, `README.de.md`, `docs/MANUAL.md`, `docs/MANUAL.de.md`, `docs/HANDOVER.md`,
  `CLAUDE.md`, dieses Protokoll, Bilder unter `docs/img/`.

Warum bestehende Suiten angepasst wurden: Sie prüften die vier Arten im Reiter Benachrichtigungen (`actions`, `layout`, `review`,
`targets`; jetzt mit den Arten, die dort bleiben, plus der Prüfung, dass die früheren Werte unberührt mitgehen), die Zahl der festen Punkte
und Kapitel (`armed`, `delays`), die Knöpfe einer Routine (`routines`) oder brauchten einen höheren Sichtbereich, weil die Seite länger ist
(`group`).

## 6. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components tests scripts` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13, `requirements_test.txt`) | 1436 bestanden, 6 übersprungen (1.61.0: 1372) |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14, `requirements_test_current.txt`) | 1436 bestanden, 6 übersprungen |
| `python scripts/mutation_check.py` (Python 3.13) | 319 von 319 erkannt (1.61.0: 294 Zeilen) |
| `cd tests/panel && node run.mjs` | 59 Suiten, 6129 Prüfungen bestanden (1.61.0: 58 Suiten); neu `notices-e2e.mjs` (212) |
| `node --input-type=module --check` für alle Dateien unter `panel/` | ohne Fehler |
| Patch auf einem sauberen Stand `bd64161` angewendet und mit `files/` verglichen | identisch |

Hinweise zum Ausführen wie bisher: die Mutationsprobe nie von aussen abbrechen, und die Suiten des Panels nicht gleichzeitig mit den
Python-Tests laufen lassen.

Eine Zeile der Mutationsprobe wurde bewusst nicht aufgenommen: "ein stiller Alarm ersetzt einen laufenden Test". Der Schutz ist doppelt
(`async_run_report` prüft es, und `_stop_side_run` fasst nur Läufe neben dem Alarm an); eine einzelne Mutation bleibt wirkungslos. Der
Test dazu steht in `tests/test_event_notify.py`.

## 7. Nicht geprüft und bekannte Grenzen

- **Die echte Anlage und echte Geräte.** Alles ist im Testsystem und im Nachbau des Panels geprüft. Bitte nach dem Update einmal prüfen:
  Reiter Aktionen zeigt die vier Meldungen mit dem bisherigen Stand (ein/aus, kritisch, Empfänger); eine Testmeldung aus dem Fenster kommt
  an; ein Sensor auf "Stiller Alarm" startet seine Aktionen.
- **Home Assistant 2026.11.** Das Testpaket gibt es erst für 2026.10.4.
- **Schalter "Einstellungen pro Modus" im Reiter Benachrichtigungen.** Er wirkt weiter auf die früheren Werte je Modus von "Stiller
  Alarm", "Eingangsverzögerung" und "Scharf geschaltet", solange eine Anlage dafür nichts Eigenes gespeichert hat. Diese Werte sind dort
  nicht mehr zu sehen. Wer ihn umschaltet, ändert also, was eine Anlage ohne eigene Werte sendet. Abhilfe: die Meldungen im Reiter
  Aktionen einmal speichern, dann gelten nur noch sie. Eine Migration, die das beim Update festschreibt, wurde nicht gebaut (Entscheid der
  Prüfstelle: kein Schreiben beim Update, ältere Sicherungen bleiben gültig); auf Wunsch nachlieferbar.
- **Bogen der Gruppe ohne Mockup.** Siehe Abschnitt 4.
- **Standardtext in der Vorschau.** Das Fenster zeigt den Standardtext der Meldung mit `{person}`; der Server sendet ohne bekannte Person
  den Satz ohne Namen ("Die Anlage ist scharf."). Ein eigener Text mit `{person}` bleibt an der Stelle leer.
- **Nachbau des Panels:** rechnet die geerbten Werte für "Immer aktiv" ohne den Modus, in dem die Anlage scharf ist. Das Verhalten des
  Servers ist durch den Python-Test gesichert.

## 8. Release-Angaben

- Version, Tag und Titel: `v1.62.0`. Ziel: `main`, Commit nach dem Push. Vorabversion: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.62.0.md`.
- `PANEL_VERSION` 220 auf 221, `manifest.json` 1.62.0.
