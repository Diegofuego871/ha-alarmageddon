# Übergabe 1.67.0 (2026-11-19)

Lieferung der externen Prüfstelle. Basis ist `main` @ `f63e406` (Tag `v1.66.1`; auf GitHub vor der Lieferung geprüft: kein neuerer Tag, `main`
unverändert). Der Baum von `f63e406` ist gleich dem der Lieferung von 1.66.1 (ZIP-Datei von 11:53).

Die Arbeit begann als 1.66.2 (Korrektur "seit"). Mit dem Abstand des Selbsttests in Minuten kam eine neue Funktion dazu, darum **1.67.0**
(Minor). 1.66.2 wurde nie geliefert und hat keinen eigenen Abschnitt im CHANGELOG. `manifest.json` 1.67.0, `PANEL_VERSION` 231 auf 232.

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.67.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.67.0.md`) |
| `RELEASE-NOTES-1.67.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.67.0-auf-1.66.1.patch` | alle Änderungen als ein Patch gegen `main` @ `f63e406` (`v1.66.1`) |
| `files/` | jede gegenüber `f63e406` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand `f63e406`), dann `git apply --index 1.67.0-auf-1.66.1.patch` oder den Inhalt von `files/` über
das Repository kopieren. Keine Datei ist zu löschen; neu sind `docs/UEBERGABE-1.67.0.md` und `tests/test_sensor_since.py`. Danach die Prüfungen
aus Abschnitt 3, Commit mit Betreff `1.67.0: Selbsttest in Minuten, "seit" ohne Neustart, Symbol im Fenstertitel, Erklärung der HealthCheck-Dienste`,
Push auf `main`, Release-Angaben aus Abschnitt 5. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Wünsche des Nutzers vom 2026-11-19, je mit Bildschirmfotos:

- 13:29, Sensoransicht eines Rauchmelders ("in Ordnung seit 13:23"): "Den Rauch- und Wassersensoren steht hier das Datum in Ordnung seid, aber hier
  wird der Home Assistant Neustart reingepfuscht haben. Kannst du den Unknown-Status hier irgendwie ausblenden? Bitte prüfe das auch für alle
  anderen Sensorarten, wo es wirklich Sinn macht und wo nicht. Ich denke, wahrscheinlich sollte man das da überall ausblenden und nur echte
  Statuswarnungen mit einbeziehen in die Berechnung."
- 13:29, Bewegungsmelder ("ruhig seit 13:23", letzte Bewegung 13:07): "Hier sollte man die letzte Bewegung beachten oder den letzten Event von der
  Rauchmelder oder Feuerwehr, was auch immer, nicht, solange der Status schon so ist."
- 13:43, Fenster "HealthCheck-Dienste": "… bei all diesen Menüs ganz oben im Titel eigentlich das gleiche Symbol kommt, wie auch bei den
  Anlageeinstellungen da angezeigt wird. Vielleicht etwas leicht vergrössert, je nach Display, zum Beispiel auch bei den Routinen".
- 13:50: "Könnte man gleich wie beim Selbstcheck auch bei den Diensten noch eine Beschreibung machen, was die Idee von diesen Diensten ist. …
  3, 4 Beispiele von Webseiten nennen, versteckt dort in diesem Menü, dass man jeweils aufklappen muss." Auf die Rückfrage zum Namen: "HealthCheck-
  Dienste lassen".
- 13:52, Kapitel HealthCheck: "Die Settings dazu auf dem Desktop genau wie auf dem Handy untereinander anzeigen … die Option haben, das auf Basis
  von Minuten zu machen … im scharfen Zustand alle 5 Minuten … Den Standard belassen wir jeweils auf 6 Stunden bei nicht scharf und 1 Stunde bei
  scharf. Jedoch soll man die Stunden auch auf Minuten schalten können … die Einheit dahinter, hinter dem Feld noch verstellen kann."
- 13:55, Formular "Dienst bearbeiten": "Das könnt ihr gleich breit machen wie das andere dahinter. … Handy soll es nach wie vor einfach Fullscreen
  bleiben, aber auf dem Desktop bitte … die Standardbreite aller Pop-ups".

### "Seit" der Sensoransicht

**Ursache:** Die Kachel "Verlauf" nahm `last_changed` des Zustands von Home Assistant. Home Assistant setzt diese Zeit bei jedem Neustart und jeder
Neuverbindung neu, auch ohne Änderung des Zustands. Liste ("Letzte Änderung") und Karten hatten das Problem nicht: sie nehmen seit 0.25.0 die
gemerkte letzte echte Änderung (`last_changes`).

Entscheide der Prüfstelle (bitte prüfen):

1. **Je Sensorart:** Tür und Fenster, Bewegung, Rauch, Wasser, Gas, Sabotage und andere: überall die letzte echte Änderung zwischen offen und zu
   ("nicht verfügbar" und "unbekannt" dazwischen übersprungen). Kehrt ein Sensor nach einem Ausfall in einem **anderen** Zustand zurück, ist das
   ein echter Wechsel.
2. **Nicht erreichbar:** seit Beginn des Ausfalls, auch über einen Neustart hinweg. Begann er vor dem Verlauf: keine Zeit.
3. **Keine bekannte Änderung** (Rauchmelder, der nie ausgelöst hat): nur der Zustand, ohne Zeit. Davor gilt die gemerkte letzte echte Änderung.
4. **Messwerte, Batterie, Empfang:** zeigen einen Wert, kein "seit". Nichts zu ändern.
5. **Geprüft, unverändert:** "Letzte Änderung" in Liste und Karten (schon richtig), "seit" der Anlage (eigene Zeit seit 1.34.3), Wartung und
   Selbsttest ("nicht erreichbar" nach der eingestellten Zeit): dort setzt ein Neustart die Wartezeit zurück, das verzögert eine Warnung, löst aber
   nie eine falsche aus.
6. **Offen, beim Nutzer nachgefragt:** Kurze "nicht verfügbar"/"unbekannt" beim Neustart zählen in der Sensoransicht weiter als Ausfall (Zeile
   "Nicht erreichbar", Kennzahlen "Ausfälle" und "erreichbar"). Bei den Bildschirmfotos (Matter) entstand beim Neustart kein solcher Eintrag.

### Selbsttest in Minuten

7. **Gespeichert in Minuten:** `selftest_minutes` (Standard 360) und `selftest_minutes_armed` (Standard 60), je 5 bis 1440. Die Untergrenze 5
   Minuten folgt dem Beispiel des Nutzers und hält die Last klein; kürzer ginge technisch, ist aber nicht verlangt.
8. **Übernahme:** Werte in Stunden bis 1.66.x (`selftest_hours`, `selftest_hours_armed`) werden beim Laden, beim Zurückholen eines älteren Backups und
   beim Speichern aus einem noch offenen alten Panel als Minuten übernommen (mal 60), nie als Fehler und nie neben den Minuten gespeichert.
9. **Takt jede Minute** (`SELFTEST_TICK` 60 s statt 300 s): mit 5 Minuten Abstand liefe die Prüfung sonst bis zu 10 Minuten auseinander. Der Takt
   schaut nur, ob es Zeit ist.
10. **Panel:** je Abstand Zahl und Einheit (Minuten oder Stunden, wie beim Intervall der HealthCheck-Dienste), auf Computer und Handy untereinander
    unter dem Text. Ganze Stunden werden als Stunden gezeigt, sonst Minuten; Wechsel der Einheit rechnet um, wo es aufgeht (1 Stunde -> 60 Minuten).
    Gezählt wird der Abstand, nicht die Einheit (6 Stunden auf 360 Minuten ist keine Änderung). Ungültig: rot, "Speichern" gesperrt, Hinweis "Von 5
    Minuten bis 24 Stunden.". Bei 320 px rückt die Einheit unter das Feld.

### Fenster

11. **Symbol im Titel:** die Kachel der Zeile unter Konfiguration › Anlage, immer in Farbe, Computer 42 px, Handy 38 px (Zeile 36 px). Fenster:
    Routinen (Liste, Vorschau, Editor), eigene Töne, Codes pro Person (Liste, Formular), HealthCheck-Dienste (Liste, Formular), Selbsttest und
    Geprüft (Farbe nach Ergebnis), Backups (Liste, "Backup erstellen", "Backup wiederherstellen?" mit der Zuordnung der Anlagen). Ohne Symbol:
    Rückfragen (Löschen?) und die Auswahl eines Geräts für eine Routine. Das Symbol im Fenster "HealthCheck-Dienste" ist das Herz der Zeile "N von 5 Diensten", die das Fenster öffnet (das
    Bildschirmfoto zeigte einen Pfeil vom Stethoskop des Selbsttests; das Stethoskop steht jetzt im Fenster des Selbsttests).
12. **Erklärung der HealthCheck-Dienste:** zum Aufklappen unter der Liste wie "Was prüft der Selbsttest?": was die Dienste tun, warum Home Assistant
    das nicht selbst kann, Fehler-Zusatz, Einrichten; Beispiele Healthchecks.io, Cronitor, Better Stack, Uptime Kuma als Links in neuem Fenster
    (Seiten am 2026-11-19 geprüft; dieselben Anbieter, für die das Formular den Fehler-Zusatz vorschlägt). "Eine Auswahl, keine Empfehlung". Uptime
    Kuma mit dem Hinweis, dass es nur auf einem anderen Rechner an einem anderen Ort Sinn hat.
13. **Breite:** Formulare über einer Liste (HealthCheck-Dienst, Code, Backup erstellen, Wiederherstellen) in der Standardbreite `ag-wide` (880 px).
    Rückfragen bleiben 420 px. Handy: immer ganzer Bildschirm. Nicht angeglichen (nicht verlangt): Anlage hinzufügen, Umbenennen, Ansicht.

## 2. Änderungen

| Datei | Änderung |
| --- | --- |
| `last_change.py` | neu `state_since(items, known)` |
| `sensor_history.py` | `async_state_history(..., known)`: Antwort mit `since`; jetziger Zustand von HA, wenn neuer als der Recorder |
| `websocket_api.py` | `ws_sensor_history` gibt `last_changes` als `known` mit; `save_notify` mit `selftest_minutes*` (5 bis 1440), `selftest_hours*` aus alten Panels als Minuten |
| `const.py` | `selftest_minutes`, `selftest_minutes_armed`, `SELFTEST_MINUTES_RANGE`, `SELFTEST_HOURS_KEYS`, `SELFTEST_TICK` 60, `PANEL_VERSION` 232 |
| `settings.py` | `valid_notify`: Minuten, Übernahme der Stunden |
| `selftest.py` | `minutes` statt `hours`, Antwort `minutes`, `minutes_disarmed`, `minutes_armed` |
| `manifest.json` | 1.67.0 |
| `panel/common.js` | `iconTitle` |
| `panel/sensorview.js` | Kachel "Verlauf" mit `_since(st)` |
| `panel/system.js` | Abstände als Zahl und Einheit (`stField`, `stMinutes`); Titel mit Symbol (Codes, Töne, Backups); `_codeDlg(wide)` |
| `panel/routines.js`, `panel/healthcheck.js`, `panel/selftest.js` | Titel mit Symbol; HealthCheck: `_about`, `EXAMPLES`, `aboutOpen`; Selbsttest: `tone()`, `_every(minutes)` |
| `panel/alarmageddon-panel.js` | `#ag-hcform` mit `ag-wide` |
| `panel/notify.js` | sendet die Abstände des Selbsttests nie mit (Minuten und alte Stunden) |
| `panel/styles.js` | `.ag-ttl`, `.ag-ttl-av`; Abstände untereinander; `.ag-hc-about` |
| `panel/strings.js` | `hcAbout`, `hcAboutText`, `hcAboutExamples`, `hcAboutKuma`, `stEveryMin`, `stEveryInvalid` (EN/DE) |
| Nachbau | `ha-sim.html`: `since`, `__setState(..., changed)`, Selbsttest in Minuten |
| Tests | neu `tests/test_sensor_since.py`; `test_sensor_history_recorder.py -k since`; `test_selftest.py` (Minuten, Takt, Übernahme aus Ablage, Backup und altem Panel); Suiten `sensor`, `sumrow`, `healthcheck`, `codes`, `hardening`, `selftest` |
| `scripts/mutation_check.py` | sieben neue Zeilen ("Sensoransicht: … seit …", "Selbsttest: …"), eine angepasst; gesamt 377 |
| Doku | CHANGELOG EN/DE (1.67.0), README EN/DE (Selbsttest bis alle 5 Minuten), MANUAL EN/DE (Sensoransicht, Selbsttest, HealthCheck), `CLAUDE.md`, `docs/DESIGN.md`, `docs/HANDOVER.md` |
| Bilder | `sensor-*.png` (Kachel "zu seit" dem Ende der letzten Öffnung), `healthcheck-*.png` (Abstände untereinander mit Einheit), `healthcheck-list-*.png`, `routines-*.png`, `sounds-*.png`, `selftest-*.png` (Symbol im Titel; HealthCheck mit "Was sind HealthCheck-Dienste?"); neu aufgenommen mit `readme-shots.mjs`, `scripts/optimize_images.py`, pixelgleiche Dateien zurückgesetzt (`cards-*.png` wichen nur in der Uhrzeit ab) |

## 3. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1554 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1554 bestanden, 6 übersprungen |
| `cd tests/panel && node run.mjs` | 68 Suiten, 7549 Prüfungen, alle bestanden. Im ersten vollen Lauf scheiterte eine Prüfung in `selftest-e2e.mjs` (Handy 390 px: die Einheit rückte unter das Feld); behoben in `styles.js` (Auswahl der Einheit auf dem Handy so breit wie ihr Text), danach `selftest-e2e.mjs` erneut: 170 bestanden. Die Änderung betrifft nur `.ag-sthours` |
| `python scripts/mutation_check.py` | 377 von 377 erkannt (1.66.1: 370; sieben neue Zeilen, eine angepasst) |
| Patch auf `f63e406` in einem sauberen Arbeitsbaum angewendet, mit `files/` und dem Arbeitsstand verglichen | identisch (beim Packen geprüft) |

## 4. Nicht geprüft und bekannte Grenzen

- An einer echten Anlage nicht geprüft; nur im Nachbau (Computer und Handy) und mit dem Recorder der Testumgebung.
- Die Sensoransicht zeichnet nicht von selbst neu: ändert sich der Sensor, während sie offen ist, stimmt "seit" erst beim nächsten Tipp.
- Ohne Wechsel im gewählten Zeitraum gilt die gemerkte letzte echte Änderung; vor der ersten Aufnahme in eine Anlage stammt sie aus dem Verlauf (bis
  90 Tage, so weit der Recorder reicht).
- Die Links der Beispiele führen auf fremde Seiten; Angebot und Bedingungen der Anbieter sind nicht geprüft und können sich ändern.

## 5. Release-Angaben

- Version, Tag und Titel: `v1.67.0`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.67.0.md` (Abschnitt 1.67.0; seit dem letzten veröffentlichten Tag `v1.66.1`).
