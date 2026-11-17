# Übergabe 1.59.0 (2026-11-17): Code-Review, Übersicht schneller, README neu, Wünsche zur Oberfläche, Aktions-Gruppe

Lieferung der externen Prüfstelle an die Session, die das Repository pflegt. Basis ist `main` @ `bdd04a8` (1.57.0, Tag `v1.57.0`
vorhanden; am Ende der Arbeit noch einmal geprüft: `origin/main` steht unverändert auf `bdd04a8`). Zuerst dieses Protokoll lesen,
dann `docs/REVIEW-2026-11-17.md` (Befunde und offene Entscheide), danach `docs/HANDOVER.md` (Abschnitte 1.59.0 und 1.58.0) und `CLAUDE.md`.

**Diese Lieferung ersetzt `alarmageddon-1.58.0.zip`.** Sie enthält alles daraus und zusätzlich die Aktions-Gruppe. 1.58.0 wurde nie
getaggt und ist darum übersprungen (CHANGELOG: "Nicht veröffentlicht; enthalten in 1.59.0"); die Version ist **1.59.0**.

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.59.0.zip` enthält:

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.59.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.59.0.md`) |
| `REVIEW-2026-11-17.md` | Bericht des Code-Reviews (identisch mit `files/docs/REVIEW-2026-11-17.md`) |
| `RELEASE-NOTES-1.59.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch, 1.59.0 und 1.58.0 zusammengeführt |
| `1.59.0-auf-1.57.0.patch` | alle Änderungen als ein Patch gegen `main` @ `bdd04a8`, mit neuen Dateien und Bildern (binär) |
| `files/` | jede geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden (eine der beiden Arten):

1. `git checkout main && git pull` (Stand muss `bdd04a8` sein, sonst zuerst abgleichen), dann
   `git apply --index 1.59.0-auf-1.57.0.patch`.
2. Oder den Inhalt von `files/` über das Repository kopieren. **Es ist keine Datei zu löschen.**

Danach die Prüfungen aus `CLAUDE.md` laufen lassen (Abschnitt 4 nennt Befehle und die hier erzielten Ergebnisse), committen mit
Betreff `1.59.0: Aktions-Gruppe, Code-Review, Übersicht schneller, README neu`, auf `main` pushen und die Release-Angaben aus Abschnitt 6 ausgeben.
Nichts an den gelieferten Dateien ist halb fertig.

## 1. Aufträge des Nutzers und Umsetzung

| Auftrag | Umsetzung | Stand |
| --- | --- | --- |
| Vollständiges Code-Review: Logik, Leistung, weitere Tests; Sicherheit und Stabilität zuerst | 15 Befunde behoben (3 der höchsten Stufe), 9 Punkte als offene Entscheide beschrieben; 89 neue Python-Tests, 22 neue Zeilen in der Mutationsprobe, 2 neue Suiten der Oberfläche (Stand des Reviews; mit der Aktions-Gruppe insgesamt 142 neue Tests, 39 Zeilen, 3 Suiten) | erledigt, Bericht in `docs/REVIEW-2026-11-17.md` |
| Die Übersicht lädt zu lange | Module des Panels parallel statt nacheinander; Stand von HA alle 250 ms statt alle 5 s; Antwort `data` kleiner; erste Antwort nach Neustart wartet höchstens 1,5 s | erledigt, Messwerte im Bericht, Abschnitt 3 |
| README überarbeiten, neue Bildschirmfotos, kurz, Idee sofort klar | README neu aufgebaut (107 statt 284 Zeilen): Idee in einem Satz, Bild, "In drei Schritten" mit drei Handy-Bildern, sechs Punkte, Installation, Rundgang, Sicherheit. Alle Einzelheiten ins neue Handbuch `docs/MANUAL.md` und `docs/MANUAL.de.md` verschoben. Alle Bilder neu erzeugt | erledigt |
| "Ton hochladen" direkt auf der Seite Anlage, Knopf nicht blau; nach dem Hochladen dezent orange zeigen, dass noch zu speichern ist | Knopf `cs-upload-page` im Kapitel "Eigene Töne"; oranger Hinweis im Editor eines Schritts nach dem Hochladen (Annahme, siehe Abschnitt 5) | erledigt |
| "Routine hinzufügen" direkt auf der Seite Anlage, nicht blau; neue Routine orange als ungespeichert markieren | Knopf `rt-add-page` im Kapitel "Routinen"; Marke "Noch nicht gespeichert" an neuen und geänderten Routinen, "Änderungen noch nicht gespeichert" in der Zusammenfassung; beide verschwinden nach dem Speichern | erledigt |
| Besseres Symbol für "Sicherungen anzeigen" (Liste zeigen, nicht Backup anlegen) | Symbol `groups` (Liste), wie bei "Routinen anzeigen"; `restoreEye` entfernt | erledigt |
| Reiterzeile springt beim Wechsel auf "Überwachung" | Unsichtbarer Platzhalter am Platz des Schalters "Einstellungen pro Modus" | erledigt |
| Neues Element "Aktions-Gruppe" (Schritte wiederholen: Anzahl, Dauer, bis deaktiviert), Variante B, Rahmen in der Farbe des Bereichs statt violett | Neue Schrittart `group` in Server und Panel, siehe Abschnitt 1a | erledigt (1.59.0) |
| Je Gruppe die Option, ob die folgenden Aktionen warten, wie bei den anderen Aktionen | `wait` an der Gruppe, Standard aus; "bis deaktiviert" wartet nie | erledigt |
| Gruppe in einen Bereich verschoben, in dem Aktionen ungültig sind: nach einer Warnung entfernen | Rückfrage beim Verschieben, nennt die Aktionen; "Abbrechen" lässt alles, wie es ist | erledigt |

## 1a. Aktions-Gruppe (1.59.0)

Entscheide des Nutzers vom 2026-11-17 (Rückfragen im Chat): Variante B; Rahmen in der Farbe des Bereichs; "Warten" als Option je Gruppe wie
bei den anderen Aktionen; in allen Listen der Aktionen (nicht in der Überwachung); Grenzen 1 bis 100 Durchläufe, 1 bis 3600 s, höchstens 10
Aktionen je Gruppe, keine Gruppe in der Gruppe, mindestens 1 s je Runde; Rückfrage beim Verschieben in einen anderen Bereich.

| Teil | Umsetzung |
| --- | --- |
| Schema | `{"type": "group", "name"?, "mode": "count"/"duration"/"until_disarmed", "count", "seconds", "steps": [...], "wait"?}`. Die Schritte prüft die Liste, in der die Gruppe steht; "bis deaktiviert" nur im Ablauf des Alarms; keine Gruppe, kein "Quittieren", kein `undo_after` in der Gruppe; die Schritte zählen zur Grenze von 40 je Liste |
| Ablauf | `workflow._group`: Runden in der Reihenfolge; jeder abgewartete Schritt unter Aufsicht des Wächters, die anderen nebenher; ein Fehler bricht nie die übrigen ab; mindestens 1 s je Runde |
| Anzahl | so viele Runden; eine abgewartete Gruppe merkt die fertigen Runden im Lauf (`run["group"]`): nach Neuladen und Neustart läuft nur der Rest |
| Dauer | zählt ab dem ersten Start, auch über Neuladen und Neustart. Eine Runde beginnt nur, wenn sie (gemessen an der vorigen) noch ganz in die Zeit passt; danach wartet die Gruppe den Rest ab. Sie läuft also nie länger als eingestellt und endet nie mitten in einer Runde; die erste Runde läuft immer ganz |
| Bis deaktiviert | läuft immer nebenher, endet mit Deaktivieren, Quittieren und "Alarmton stumm"; nach einem Neustart mitten im Alarm läuft sie wieder an (`run["endless"]`), nie doppelt |
| Warten | `wait` wie bei den anderen Schritten: ohne die Angabe läuft die Gruppe nebenher |
| Geräte | Ein Schritt mit "Rückgängig" kehrt beim Deaktivieren zurück, auch mitten in der Runde (Schnappschuss vor dem ersten Schritt) |
| Meldungen | Eine Push-Meldung in der Gruppe zählt als Meldung des Ablaufs (keine Standardmeldung zusätzlich), ihre eigenen Empfänger zählen als Alarm-Empfänger |
| Aufzeichnung | Schritte der Gruppe nur für die erste Runde; harte Grenze von 600 Einträgen für Schritte und Meldungen je Alarm |
| Panel | Rahmen mit Kopfzeile in der Farbe der Liste (`--z`), Karten der Schritte wie überall; Plus in der Gruppe; Ziehen hinein, darin und hinaus; Tastatur mit Pfeiltasten hinein, hindurch, hinaus; Fenster mit Name, Reiterleiste Anzahl / Dauer / Bis deaktiviert, Wert, "Warten"; Play-Knopf testet die ganze Gruppe |
| Verschieben in einen anderen Bereich | Rückfrage nennt die Aktionen, die es dort nicht gibt; nach "Verschieben und entfernen" fallen sie weg, "bis deaktiviert" wird ausserhalb des Alarms zu "Anzahl" |

**Abweichungen vom Konzept im Mockup** (dort Vorschläge, hier entschieden): flache Angaben `mode`/`count`/`seconds` statt `repeat: {...}`;
bei "Dauer" werden Wartezeiten nicht gekappt (siehe oben); `undo_after` ist in einer Gruppe abgelehnt.

**Grenzen, bewusst:** keine Gruppe in den Regeln der Überwachung. Eine nebenher laufende Gruppe mit Anzahl oder Dauer läuft nach einem
Neustart nicht weiter (wie jeder Schritt, der nebenher läuft); "bis deaktiviert" und abgewartete Gruppen laufen weiter. Wird mitten in einer
Runde deaktiviert, bleibt ein Gerät ohne "Rückgängig" in dem Zustand, in dem es gerade ist (wie bei "ein, warten, aus" ohne Gruppe).

## 2. Dateien

### Neu

| Datei | Inhalt |
| --- | --- |
| `tests/test_group.py` | 52 Fälle zur Aktions-Gruppe: Prüfung je Liste, Anzahl, Dauer, bis deaktiviert, scheitern und hängen, Neuladen und Neustart, Meldungen, Zeitachse, Test |
| `tests/panel/suites/group-e2e.mjs` | Aktions-Gruppe im Panel: anlegen, Farbe des Rahmens, Plus, Ziehen, Rückfrage beim Verschieben, Tastatur, Grenzen, Speichern (122 Prüfungen) |
| `tests/test_review_1_58.py` | 85 Fälle zu den Befunden des Reviews (Neustart, Codes, eigene Ablage, beschädigte Daten, scharfer Modus, Meldung, Überwachung, Anlegen und Löschen, Aufzeichnung, Tonschleife, Leistung) |
| `tests/test_panel_preload.py` | 3 Tests: Liste `MODULES` vollständig, gemeinsamer Import, 250-ms-Takt |
| `tests/panel/suites/dst-e2e.mjs` | Sensoransicht über die Zeitumstellung (Zeitzone Europe/Zurich, Herbst und Frühling, Desktop und Handy) |
| `tests/panel/suites/livestate-e2e.mjs` | Zustände erscheinen ohne Verzug, auf dem echten Weg (`?realhass=1`) |
| `docs/REVIEW-2026-11-17.md` | Bericht des Reviews |
| `docs/UEBERGABE-1.59.0.md` | dieses Protokoll |
| `docs/MANUAL.md`, `docs/MANUAL.de.md` | Handbuch: die Einzelheiten der bisherigen README, nachgeführt auf 1.59.0 |
| `docs/mockups/aktionsgruppe-v1/` | Mockup der Aktions-Gruppe (Grundlage des Entscheids): `README.md` mit den Entscheiden, sechs Bilder, `src/mockup.html` |
| `docs/img/step-sensors-{de,en}.png`, `docs/img/step-actions-{de,en}.png` | Handy-Bilder für "In drei Schritten" |
| `docs/img/group-{de,en}.png` | Bild der Aktions-Gruppe im Handbuch |

### Geändert: Integration (Python)

| Datei | Änderung |
| --- | --- |
| `controller.py` | `_code_lock` (Codes einzeln prüfen); eigene Ablage des Zustands (`_save_state`, `_state_for_save`, `async_load_state`, `async_remove_state`, `newer_state`); `_restore` prüft jeden Wert einzeln (`_as_time`, `_as_text`) und löst bei abgelaufener Eingangsverzögerung nicht mehr selbst aus (`_alarm_after_restore`); neu `async_finish_restore()`; `is_always(entity)` für die Prüfung je Sensorereignis |
| `alarm_control_panel.py` | Beim Start gilt der neuere von eigener Ablage und Restore-Stand von HA |
| `__init__.py` | `controller.async_finish_restore()` nach dem Start des Ablaufs; `async_remove_entry` löscht die Ablage des Zustands |
| `const.py` | `STATE_STORE_KEY`; `GROUP_*` (Aktions-Gruppe); `PANEL_VERSION` 215 auf 217 |
| `workflow.py` | `async_start`: nur Alarmläufe fortsetzen, Alarm ohne abgelegten Lauf beginnt seine Aktionen, "stumm" bleibt stumm (`_mark_silenced`). Aktions-Gruppe: `group_steps`, `group_rounds`, `flat_steps`, `_group`, `_group_done`, `_note_endless`, `_resume_endless`; `step_budget`, `step_waits`, `step_entities`, `_record`, `has_notify`, `_sound_only`, `async_silence` kennen die Gruppe |
| `schemas.py` | Schrittart `group`, `_valid_group`, `step_list` (Grenze je Liste samt Schritten der Gruppen); jede Listenprüfung prüft Gruppen mit ihren eigenen Regeln |
| `config_flow.py` | Options-Flow lehnt das Abschalten des scharfen Modus ab (`mode_active`) |
| `backup.py` | `_check_active_modes`: Wiederherstellen lehnt das Abschalten des scharfen Modus ab (`RestoreError("mode_active")`) |
| `strings.json`, `translations/en.json`, `translations/de.json` | Text `options.error.mode_active` |
| `notify.py` | Meldung "Eingangsverzögerung" nennt die laufende Zeit; `_with_groups`: Meldungen in Gruppen zählen (Empfänger, Schritte des Alarms) |
| `monitor.py` | `_sleep`: Zeitgeber mit `@callback`-Ziel statt `lambda` |
| `systems.py`, `websocket_api.py` | `hass.async_block_till_done()` entfernt (Anlegen, Löschen) |
| `websocket_api.py` | `save_workflows` mit `step_list`; `data`: Messwert-Kandidaten nur bei eingeschalteter Überwachung; "Letzte Änderung" nur für `binary_sensor`, höchstens `LAST_CHANGE_WAIT` abgewartet |
| `recording.py` | Ein offener Schreibauftrag, spätestens nach 2 s; harte Grenze für Schritte und Meldungen je Alarm |
| `sound_loop.py` | Aufbau eines Tons unter Sperre, zweiter Blick in den Zwischenspeicher |
| `sensor.py` | `StatusSensor._watched()` merkt sich die beobachteten Sensoren je Stand der Optionen |
| `manifest.json` | Version 1.59.0 |

### Geändert: Panel

| Datei | Änderung |
| --- | --- |
| `panel/panel.html` | Liste `MODULES` mit `modulepreload`; `hass` alle 250 ms weitergereicht, wenn sich die Referenz geändert hat |
| `panel/alarmageddon-panel.js` | Module mit einem `Promise.all` importiert |
| `panel/sensorview.js` | `_dayRows`: Tagesende aus dem Kalender, Abbruch ohne Fortschritt, Balken am Rand begrenzt (Zeitumstellung) |
| `panel/system.js` | Knopf `cs-upload-page`; Symbol `groups` bei `bk-open`; Fehlertext für `mode_active` beim Wiederherstellen |
| `panel/routines.js` | Knopf `rt-add-page`; Marken für Ungespeichertes |
| `panel/actions.js` | Hinweis nach dem Hochladen eines Tons im Schritt (`edit.uploaded`); Platzhalter `.ag-ghost` im Reiter "Überwachung". Aktions-Gruppe: Listen mit Pfad (`baseZone`, `groupIndex`), `_groupCard`, `_groupFields`, `_full`, `_total`, `_lineEl`, `_moveAcross` (Rückfrage), Ziehen und Tastatur in Gruppen |
| `panel/log.js`, `panel/customsounds.js` | Zeitachse nennt die Gruppe; Zählung "Ton wird benutzt" sieht Schritte in Gruppen |
| `panel/common.js` | Symbol `restoreEye` entfernt, Symbol `repeat` neu |
| `panel/styles.js` | `.ag-unsaved`, `.ag-unsaved-note`, `.ag-rtsum .ag-btnrow`, `.ag-ghost`; `.ag-wf-group`, `.ag-wf-ghead`, `.ag-wf-gpill`, `.ag-wf-gsum`, `.ag-wf-glist` |
| `panel/strings.js` | `unsavedOne`, `unsavedChanges`, `upStepUnsaved`, `bkErrModeActive`; 39 Texte der Aktions-Gruppe (`stepGroup`, `grp*`, `fldGrp*`, `wfFull`, `logStepGroup*`), Englisch und Deutsch |

### Geändert: Tests, Skripte, Dokumente

| Datei | Änderung |
| --- | --- |
| `scripts/mutation_check.py` | 17 neue Zeilen "Aktions-Gruppe: ..."; 22 neue Zeilen "Code-Review 1.58.0: ..."; drei bestehende Muster an den umgebauten Code angepasst (Löschen nach Sicherung, Schalter "nur der Modus zählt", Aufsicht über den Start) |
| `tests/test_state_since.py` | ruft nach `async_restore` neu `async_finish_restore()` |
| `tests/test_action_hang.py` | Beispiel und hängender Fall für die Schrittart `group` |
| `tests/test_translations.py` | Handbuch in die Prüfungen "zweisprachig, gleicher Aufbau" und "kein Eszett" aufgenommen |
| `tests/panel/lib.mjs` | `open()` nimmt `context` (zum Beispiel `timezoneId`) und `fixedTime` |
| `tests/panel/sim/ha-sim.html` | Schalter `?realhass=1`: der Nachbau setzt `hass` nicht direkt ins Panel |
| `tests/panel/suites/routines-e2e.mjs`, `customsounds-e2e.mjs`, `monitor-e2e.mjs`, `autobackup-e2e.mjs` | Prüfungen für die neuen Knöpfe, Hinweise, das Symbol und die Höhe der Reiterzeile |
| `tests/panel/suites/actions-e2e.mjs`, `after-e2e.mjs`, `armed-e2e.mjs`, `delays-e2e.mjs`, `disarm-e2e.mjs` | Die Auswahl der Schritte enthält in jeder Liste zusätzlich die Aktions-Gruppe |
| `tests/panel/readme-shots.mjs` | neue Bilder `step-sensors`, `step-actions`, `group`; `actions` zeigt den Ablauf ab "Alarm beginnt"; `ONLY=...` nimmt einzelne Bilder neu auf; Lautsprecher im Bild neutral benannt; zwei veraltete Selektoren repariert (das Skript brach seit 1.56.0 bei "Eigene Töne" ab) |
| `README.md`, `README.de.md` | neu geschrieben (kurz) |
| `CHANGELOG.md`, `CHANGELOG.de.md` | Abschnitt 1.59.0 mit Link-Fussnote; Abschnitt 1.58.0 mit dem Vermerk "Nicht veröffentlicht; enthalten in 1.59.0", ohne Fussnote |
| `docs/HANDOVER.md` | Abschnitte 1.59.0 und 1.58.0 |
| `CLAUDE.md` | fünf Ergänzungen: Sicherheitsregel "Aktions-Gruppe"; README kurz und Handbuch; neue Panel-Datei in `MODULES`; Handbuch bei jeder Lieferung nachführen; Regel "Neustart und Absturz" (eigene Ablage, `async_finish_restore`, nie `async_block_till_done`, Zeitgeber nur mit `@callback`) |
| `docs/img/*.png` (22 Bilder) | neu erzeugt mit `readme-shots.mjs` und `optimize_images.py` (die zwei Bilder der Dashboard-Karten sind unverändert) |

Unverändert: die vier Kurzfilme `docs/img/alarm-live-*.gif` (Übersicht, Alarm und Protokoll sehen aus wie zuvor) und die
Schaubilder `flow-*.svg`, `safety-*.svg`.

## 3. Was sich am Verhalten ändert (für die Release Notes und für Rückfragen)

- Nach einem Neustart mit abgelaufener Eingangsverzögerung laufen Alarmaktionen und Meldung (vorher nur der Zustand "Alarm").
- Nach einem Absturz gilt der letzte Zustand, nicht der bis zu 15 Minuten alte.
- Der Dialog "Konfigurieren" und das Wiederherstellen einer Sicherung lehnen ab, solange die Anlage in einem Modus scharf ist, den
  sie abschalten würden. Vorher gingen beide durch und deaktivierten die Anlage still.
- Ein Alarm, der mit "Alarmton stumm" still gestellt wurde, bleibt nach einem Neustart still (der Zustand "Alarm" bleibt).
- Gleichzeitige Code-Versuche werden nacheinander geprüft; für einen einzelnen Versuch ändert sich nichts.

## 4. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Funde |
| `python -m pytest` (HA 2026.2.3, Python 3.13) | 1338 bestanden, 6 übersprungen (1.57.0: 1196) |
| `python scripts/mutation_check.py` | 285 von 285 erkannt (1.57.0: 246 Zeilen) |
| `cd tests/panel && node run.mjs` | 55 Suiten, 5737 Prüfungen, alle bestanden |
| `node --input-type=module --check` für alle Dateien unter `panel/` | ohne Fehler |
| `strings.json` gleich `translations/en.json`, `de.json` mit denselben Schlüsseln, kein "ß" | in Ordnung (Tests) |

Hinweise zu den Läufen:

- Die Suiten liefen hier in UTC, `dst-e2e.mjs` setzt seine Zeitzone selbst. `sensor-e2e.mjs` scheitert auf dem Stand 1.57.0 in der
  Zeitzone Europe/Zurich noch bis am 24.11.2026 (Befund 7 im Bericht); mit dieser Lieferung besteht sie in beiden Zeitzonen.
- Eine Prüfung in `monitor-e2e.mjs` (Höhe der Reiterzeile) rechnet den Rollstand mit ein: Playwright rollt auf dem Handy den Reiter
  vor dem Antippen selbst in die Bildmitte.

**Nicht geprüft:** echte Geräte (Lautsprecher, Sirenen), ein echtes Home Assistant unter Last, Companion App, HomeKit am Gerät.
Die Ladezeiten stammen aus dem Nachbau.

## 5. Offen, Annahmen, Entscheide

- **Aktions-Gruppe:** umgesetzt (Abschnitt 1a). Nicht an echten Geräten geprüft: bitte einmal mit einer echten Lampe oder Steckdose
  testen (Play-Knopf an der Gruppe), bevor sie in einem Alarmablauf produktiv läuft.
- **Annahme beim Hinweis nach dem Hochladen eines Tons:** Ein hochgeladener Ton ist sofort abgelegt (so war es, und die Seite sagt
  es: "Änderungen hier sind sofort gespeichert"). Es gibt dort also nichts zu speichern. Der orange Hinweis steht darum dort, wo
  wirklich etwas offen ist: im Editor eines Schritts, in dem der neue Ton gewählt ist ("Der Schritt ist noch nicht gespeichert").
  Lädt man von der Seite Anlage hoch, erscheint kein Hinweis. Meinte der Nutzer etwas anderes (zum Beispiel: Töne sollen wie
  Routinen ein Entwurf der Seite werden), ist das eine Verhaltensänderung und neu zu entscheiden.
- **Neun offene Entscheide** aus dem Review: `docs/REVIEW-2026-11-17.md`, Abschnitt 4. Die zwei wichtigsten: Wechsel in einen
  schwächeren scharfen Modus ohne Code, und der Ton "bis zum Deaktivieren", der nach einem Neustart mitten im Alarm nicht wieder
  beginnt.
- **Am Rand bemerkt, nicht geändert:** Auf dem Handy bricht die Fusszeile der Aktionen auf Deutsch um ("Speichern" steht allein in
  der zweiten Zeile), auf Englisch nicht.

## 6. Release-Angaben

- Version, Tag und Titel: `v1.59.0` (in `manifest.json` gesetzt). Ziel: `main`, Commit nach dem Push.
- Vorabversion: nach Regel beim Nutzer nachfragen.
- 1.57.0 ist getaggt, 1.58.0 übersprungen: die Release Notes fassen 1.59.0 und 1.58.0 zusammen, mit dem Satz "Includes the changes from
  1.58.0". Text: `RELEASE-NOTES-1.59.0.md` (Englisch für das Release, Deutsch zur Information), aus
  `python3 .github/scripts/changelog_section.py 1.59.0` und `... 1.58.0` (und `de`).
- Tags und Releases legt der Nutzer an.

## 7. Für die nächste Session

- Neue Datei unter `panel/`: in `MODULES` in `panel/panel.html` eintragen (sonst scheitert `tests/test_panel_preload.py`).
- Wer in einem Test `controller.async_restore(...)` direkt ruft und einen Alarm nach dem Wiederherstellen erwartet, ruft danach
  `controller.async_finish_restore()`.
- Die Ablage `alarmageddon.state.<entry_id>` ist Laufzeit, kein Teil der Sicherung.
- Einzelheiten zu Funktionen gehören ins Handbuch (`docs/MANUAL*.md`), die README bleibt kurz.
- Bilder einzeln neu aufnehmen: `ONLY=actions,step-actions node tests/panel/readme-shots.mjs`.
