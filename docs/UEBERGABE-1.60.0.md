# Übergabe 1.60.0 (2026-11-17)

Lieferung der externen Prüfstelle. Basis ist `main` @ `7cd1646` (1.59.0, Tag `v1.59.0` vorhanden). Dieses Protokoll **ersetzt** das
erste Protokoll zu 1.60.0 (nur "Rückgängig in der Gruppe"); das ZIP enthält alles, das erste ZIP wird nicht mehr gebraucht. Zuerst
dieses Protokoll, dann `docs/HANDOVER.md` (Abschnitt 1.60.0) und `CLAUDE.md` (neu: "Verträglichkeit mit neueren Versionen von Home
Assistant", "Geschwindigkeit der Übersicht", "Suche in den Fenstern mit Listen").

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.60.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.60.0.md`) |
| `RELEASE-NOTES-1.60.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.60.0-auf-1.59.0.patch` | alle Änderungen als ein Patch gegen `main` @ `7cd1646` |
| `files/` | jede geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand muss `7cd1646` sein), dann `git apply --index 1.60.0-auf-1.59.0.patch`, oder den
Inhalt von `files/` über das Repository kopieren. **Es ist keine Datei zu löschen.** Danach die Prüfungen aus Abschnitt 6, Commit
mit Betreff `1.60.0: Übersicht hält Home Assistant nicht mehr an, Suchfelder, Rückgängig in der Gruppe`, Push auf `main`,
Release-Angaben aus Abschnitt 8.

**Achtung beim Push:** Die Lieferung ändert `.github/workflows/tests.yml` (zweite Testumgebung). Ein Zugangstoken ohne das Recht
`workflow` kann diese Datei nicht pushen; dann die Datei im Browser ändern oder ein Token mit dem Recht verwenden.

## 1. Anlass

Meldungen des Nutzers vom 2026-11-17, in dieser Reihenfolge:

1. "Nach einer Zeit rückgängig machen" fehlt, sobald ein Schritt in eine Gruppe gezogen wird (Abschnitt 5).
2. Die Übersicht lädt träge, vermutlich seit Temperatursensoren dabei sind; dazu eine Aufzeichnung des Netzwerks seiner Anlage
   (Home Assistant 2026.11.1, Alarmageddon 1.59.0) (Abschnitt 2 und 3).
3. Suchfeld in den Fenstern "Routinen", "Eigene Töne" und "Sicherungen", bei den Sicherungen dazu ein Filter für die
   automatischen (Abschnitt 4).
4. Sensoransicht eines Temperatursensors: die Reiter "Batterie" und "Empfang" zeigen "Der Verlauf konnte nicht geladen werden.
   Kind does not fit the sensor" (Abschnitt 4).

## 2. Übersicht träge: Befund

### 2.1 Was die Aufzeichnung der echten Anlage zeigt

| Messung (Home Assistant 2026.11.1, Alarmageddon 1.59.0) | Wert |
| --- | --- |
| Dauer von `alarmageddon/data`, zwei Abrufe | 1419 ms und 1405 ms |
| Grösse der Antwort | 94 kB, 151 Sensoren (106 Messwerte, 45 Binärsensoren) auf 68 Geräten |
| Anlage | 34 gewählte Sensoren; Home Assistant mit 2679 Entitäten, 460 Geräten, 368 geladenen Komponenten |
| Zustandsereignisse von Home Assistant während der beiden Abrufe | keines; unmittelbar danach 11 beziehungsweise 4 auf einmal, alle mit Zeitstempeln der letzten 35 ms |
| Antwort auf den gleichzeitig gesendeten Befehl `frontend/get_user_data` | im selben Paket wie die Antwort auf `data`, dahinter |

Die letzten beiden Zeilen belegen: Während des Abrufs lief in Home Assistant **nichts anderes**. Der Abruf hielt den Event-Loop rund
1,4 Sekunden an, beim Öffnen des Panels und bei offenem Panel alle 30 Sekunden. In dieser Zeit verarbeitet Home Assistant kein
Ereignis, keine Automation und auch keinen Sensor der Alarmanlage.

### 2.2 Ursache

`reception._domains` las `DeviceEntry.config_entries`, in `live_signal` bis zu zweimal je Sensor. Neuere Versionen von Home
Assistant (gelesen in 2026.10.4 und 2026.11.1) führen dieses Feld nur noch als veraltete Brücke: Jeder Zugriff ruft
`frame.report_usage`, das den Aufrufer im Aufrufstapel und danach in **allen geladenen Modulen** sucht (`get_integration_frame`).
Das kostet je Zugriff Millisekunden, abhängig von der Zahl der geladenen Module. Im Log steht einmal die Warnung "Detected that
custom integration 'alarmageddon' accesses `DeviceEntry.config_entries` ...".

Warum es mit den Temperatursensoren auffiel: Mit eingeschalteter Überwachung nannte die Antwort jeden Messwert des Hauses als
Kandidaten (106 der 151 Sensoren), jeder kostete zwei solche Zugriffe.

Warum die Tests es nicht zeigten: Sie liefen nur gegen Home Assistant 2026.2.3. Dort ist das Feld ein gewöhnliches Feld.

### 2.3 Nachgestellt

Gleicher Aufbau (151 Sensoren auf 68 Geräten, alle in der Antwort), Dauer von `alarmageddon/data` im Testsystem:

| Stand | Home Assistant 2026.2.3 | Home Assistant 2026.10.4 |
| --- | --- | --- |
| 1.59.0 | 1,3 bis 1,7 ms | 234 bis 268 ms (0,87 ms je Zugriff bei 2360 geladenen Modulen) |
| 1.60.0 | wie zuvor | 4 bis 12 ms |

Das Testsystem hat rund 2400 geladene Module, die echte Anlage ein Mehrfaches; das erklärt 1,4 Sekunden statt 0,25.

### 2.4 Zwei weitere Ursachen (im Nachbau des Panels gemessen, vor der Aufzeichnung gefunden)

| Befund | Messung vorher | nachher |
| --- | --- | --- |
| `data` trug alle Kandidaten des Hauses, bei jedem Öffnen und alle 30 Sekunden | 475 kB (Test mit 400 Geräten, 1203 Kandidaten) | 14,4 kB (nur die Sensoren der Anlagen); die Kandidaten holt "Sensoren hinzufügen" auf Abruf (478 kB, rund 10 ms) |
| Jede Änderung irgendeines Kandidaten baute die ganze Sensorliste neu, seit 1.58.0 bis zu viermal je Sekunde (**diese Verschärfung stammt aus dem Code-Review 1.58.0 selbst:** `hass` wird seither alle 250 ms statt alle 5 Sekunden übernommen) | 40 Neuaufbauten in 10 Sekunden, Rechenzeit 1058 ms (Desktop) und 2777 ms (Handy-Profil, vierfach gebremst) | 4 Neuaufbauten, 354 ms und 1057 ms |

## 3. Übersicht träge: Umsetzung

| Datei | Änderung |
| --- | --- |
| `devices.py` | neu: `entry_ids` (Konfigurationseintrag eines Geräts: `config_entry_id`, bei älteren Versionen `config_entries`, bei zusammengesetzten Geräten alle), `main_device` (untergeordnetes Gerät: das übergeordnete trägt Hardware und Funkadresse), `device_field` (Hardware-Angabe ohne veralteten Zugriff), `system_device` (Gerät einer Anlage), `free_entity_id` |
| `reception.py` | `_domains` und `_address` über diese Funktionen; `live_signal` liest die Einträge einmal und nimmt das Funkteil vom Gerät mit der Hardware |
| `websocket_api.py` | `_sensor_info`: Empfang und Hardware einmal je Gerät statt je Sensor; `candidates=False` für `data`; neuer Befehl `alarmageddon/sensor_candidates` (nur Administratoren); Umbenennen und Vorschau über `system_device` und `free_entity_id` (die bisherigen Funktionen entfernt Home Assistant 2027) |
| `panel/alarmageddon-panel.js`, `panel/common.js`, `panel/sensors.js` | `_shownSensors`, `_stateSigs` (Zustände sofort, Messwerte, Batterie und Empfang gesammelt, `SOFT_MS` = 2 s), `_loadCandidates`, `_known`; "Sensoren hinzufügen" lädt die Kandidaten beim Öffnen (Ladeanzeige) |
| `schemas.py` | `strict_map` (siehe 4.3) |
| `tests/conftest.py` | jeder Test scheitert, wenn Home Assistant eine veraltete Nutzung durch die Integration meldet |
| `tests/test_ha_compat.py` (neu) | Geräte der neuen Registry nachgebaut (der veraltete Zugriff scheitert dort): Konfigurationseintrag, untergeordnetes Gerät, einmal je Gerät, Gerät der Anlage, freie Entitäts-ID, `strict_map` |
| `requirements_test_current.txt` (neu), `.github/workflows/tests.yml` | zweite Testumgebung: Home Assistant 2026.10.4 mit Python 3.14, als Matrix neben der bisherigen |
| `tests/panel/suites/perf-e2e.mjs` (neu), `tests/panel/sim/ha-sim.html` | grosses Haus im Nachbau (`?house=`, `?housechosen=`, `?churn=`); der Nachbau liefert `data` wie der Server nur mit den gewählten Sensoren |
| `tests/test_websocket.py`, `tests/test_security.py`, `tests/test_review_1_58.py` | an die geteilte Antwort angepasst; `sensor_candidates` in `COMMANDS` |

**Was der erste Lauf gegen Home Assistant 2026.10.4 sonst zeigte** (5 Fehler, 1 Abbruch, alle bearbeitet):

| Test | Befund | Umsetzung |
| --- | --- | --- |
| `test_security.py -k import_rejects_hostile[bad_options8]` | **echter Mangel:** siehe 4.3 | `strict_map` |
| `test_alarm.py` (2), `test_websocket.py -k rename` | die Tests selbst nutzten veraltete Zugriffe auf die Geräte-Registry; das Umbenennen in der Integration auch | Tests und Integration über `system_device` |
| `test_monitor.py -k restart_keeps_state` | der Test stellte "Home Assistant war aus" mit laufender Anlage nach; neuere Versionen führen den Zuhörer sofort aus, die Meldung kam doppelt. Im Betrieb kein Fehler: bei einem echten Neustart hört niemand zu | der Test entlädt die Anlage wirklich |
| `test_undo_after.py -k does_not_answer` | der Test endete, bevor der abgebrochene Aufruf zu Ende war | der Test wartet den Abbruch ab |

## 4. Weitere Änderungen

### 4.1 Suchfelder (Wunsch des Nutzers)

- Fenster "Routinen", "Eigene Töne", "Sicherungen": Suchfeld über der Liste, im Design der übrigen Listen, mit Knopf zum Leeren.
- Gesucht wird in allem, was die Zeile zeigt; bei Routinen zusätzlich in den Entitäts-IDs der Geräte (die Zeile zeigt nur Namen).
  Mehrere Wörter müssen alle vorkommen; Gross- und Kleinschreibung zählen nicht.
- Sicherungen: Filter "Nur automatische" neben dem Suchfeld (auf dem Handy darunter), mit der Suche verbindbar. Ohne Sicherungen
  bleiben Suchfeld und Filter verborgen.
- Beim Tippen wird nur die Liste neu gezeichnet: das Feld behält den Fokus, ein offenes Formular zum Hochladen seinen Inhalt. Die
  Knöpfe einer gefundenen Zeile wirken auf die richtige Routine. Neu geöffnet ist die Suche leer.
- Dateien: `panel/common.js` (`matchQuery`, `searchField`), `panel/routines.js` (`_rowsHtml`, `_matches`, `_tags`),
  `panel/system.js` (`_csRows`, `_bkBody`, `openBackupList`), `panel/strings.js` (8 neue Texte je Sprache), `panel/styles.js`,
  Suite `tests/panel/suites/popsearch-e2e.mjs` (96 Prüfungen: Deutsch Desktop und Handy, Englisch Desktop).

### 4.2 Sensoransicht eines Messwerts: "Batterie" und "Empfang"

`ws_sensor_history` lehnte die Arten "battery" und "signal" für jeden Messwert ab (die Bedingung verlangte für Messwerte die Art
"value"). Behoben; weiterhin abgelehnt sind der Zustandsverlauf eines Messwerts und der Werteverlauf eines Binärsensors. Test
`tests/test_measure_history.py -k battery_and_signal`, eine neue Zeile in `scripts/mutation_check.py`. Der Mangel bestand schon vor
dem Code-Review (im Stand 1.57.0 vorhanden) und war dort übersehen worden.

### 4.3 Sicherung mit unbekanntem Schlüssel (neuere Versionen von Home Assistant)

Neuere Versionen ersetzen die Prüf-Bibliothek voluptuous durch probatio. In einem Schema mit `REMOVE_EXTRA` (das Schema der
Sicherungen lässt so unbekannte Optionen anderer Versionen weg) verwirft probatio auch in den Wörterbüchern darunter einen
unbekannten Schlüssel, statt die Sicherung abzulehnen. Betroffen: `sensor_modes`, `sensor_options` und die sieben Listen der
Aktionen. **Gespeichert wurde nichts Ungültiges** (der Eintrag fiel weg), aber die Zusage "eine Sicherung mit einem ungültigen
Wert wird als Ganzes abgelehnt" galt dort nicht. Behoben mit `schemas.strict_map`; ein Test verlangt, dass im Schema der
Sicherungen kein Wörterbuch als Prüfung steht (läuft in beiden Testumgebungen). Die Befehle des Panels (ohne `REMOVE_EXTRA`) waren
nicht betroffen: die Sicherheitstests bestanden dort.

## 5. "Nach einer Zeit rückgängig machen" in einer Aktions-Gruppe (unverändert gegenüber dem ersten ZIP)

Entscheid des Nutzers: erlauben. In einer Gruppe gilt je Gerät nur ein vorgemerkter Gegendienst; jede Runde ersetzt den der
vorigen. **Mangel in 1.59.0:** Beim Hineinziehen fiel die Einstellung ohne Hinweis weg; sie bleibt jetzt erhalten.

- Runde länger als die Zeit: das Gerät schaltet in jeder Runde nach der Zeit zurück.
- Runde kürzer als die Zeit: jede Runde beginnt die Zeit neu; das Gerät schaltet zurück, wenn keine Runde es mehr schaltet.
- Deaktivieren, Quittieren, "Alarmton stumm" und das Ende eines Tests schalten wie bisher sofort zurück, einmal je Gerät.
- Dateien: `schemas.py` (`_valid_group`), `workflow.py` (`_IN_GROUP`, `_plan_undo`, `_same_undo`, `_undo_tasks`),
  `panel/actions.js`, `panel/strings.js` (`fldUndoGroupHint`), `tests/test_group.py` (`-k undo`),
  `tests/panel/suites/group-e2e.mjs`, zwei Zeilen in `scripts/mutation_check.py`.

## 6. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13, `requirements_test.txt`) | 1361 bestanden, 6 übersprungen (1.59.0: 1338) |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14, `requirements_test_current.txt`) | 1361 bestanden, 6 übersprungen (1.59.0 dort: 5 fehlgeschlagen, 1 Abbruch) |
| `python scripts/mutation_check.py` (Python 3.13) | 294 von 294 erkannt (1.59.0: 285 Zeilen) |
| `cd tests/panel && node run.mjs` | 57 Suiten, 5865 Prüfungen bestanden (1.59.0: 55 Suiten); neu `perf-e2e.mjs` (20) und `popsearch-e2e.mjs` (96) |
| `node --input-type=module --check` für alle Dateien unter `panel/` | ohne Fehler |
| Patch auf einem sauberen Stand `7cd1646` angewendet und mit `files/` verglichen | identisch |

Hinweise zum Ausführen:

- Die Mutationsprobe nie mit einer Zeitgrenze von aussen abbrechen: ein Abbruch mitten in einer Probe lässt eine Datei verändert
  zurück. Im Hintergrund starten und auf das Ende warten.
- Die Suiten des Panels nicht gleichzeitig mit den Python-Tests laufen lassen: `dragscroll-e2e.mjs` ist zeitabhängig und scheiterte
  unter Last einmal.

## 7. Nicht geprüft und bekannte Grenzen

- **Die echte Anlage nach dem Update.** Alle Messwerte "nachher" stammen aus dem Testsystem und dem Nachbau des Panels. Bitte nach
  dem Update prüfen: Browser, Entwicklerwerkzeuge, Reiter "Netzwerk", die WebSocket-Verbindung, Dauer von `alarmageddon/data`.
  Erwartet sind wenige Millisekunden statt 1,4 Sekunden, und im Log von Home Assistant keine Meldung "Detected that custom
  integration 'alarmageddon' ..." mehr. Bleibt es träge, bitte wieder eine Aufzeichnung senden.
- **Home Assistant 2026.11.** Das Testpaket gibt es erst für 2026.10.4. Die betroffenen Stellen der Geräte-Registry von 2026.11.1
  sind gelesen und entsprechen 2026.10.4; gelaufen sind die Tests dort nicht.
- **Untergeordnete Geräte** (neu in der Geräte-Registry). Die Anlage des Nutzers hat keine (460 Geräte, keines untergeordnet). Der
  Weg ist nur mit nachgebauten Geräten getestet.
- **Echte Geräte** für "Rückgängig in der Gruppe": bitte an der echten Sirene einmal testen (Play-Knopf an der Gruppe).
- **Bekannt, nicht geändert:** Ein Aufruf, der beim Zurückstellen am Ende eines Alarms nicht antwortet, läuft im Hintergrund weiter
  (Absicht: ein nur langsames Gerät schaltet so noch aus) und endet spätestens beim nächsten Stopp oder Entladen.
- **Bekannt, nicht geändert:** Der Nachbau des Panels prüft die Art in `sensor_history` nicht wie der Server; den Mangel aus 4.2
  hätte eine Suite des Panels darum nicht gefunden. Er ist durch den Python-Test gesichert.

## 8. Release-Angaben

- Version, Tag und Titel: `v1.60.0`. Ziel: `main`, Commit nach dem Push. Vorabversion: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.60.0.md` (nur 1.60.0; 1.59.0 ist veröffentlicht).
- `PANEL_VERSION` 217 auf 219, `manifest.json` 1.60.0.
