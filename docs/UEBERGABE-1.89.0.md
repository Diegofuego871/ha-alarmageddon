# Übergabe 1.89.0 (2026-11-25): alles aus dem Optionsdialog auch im Panel, Nachalarm pro Modus, Ausfall in der Ausgangsverzögerung

Auftrag des Nutzers an den Agenten, der hochlädt ("Ja, setzt das bitte so um. Ich möchte alles im Panel haben und mache es im genau gleichen Stil,
wie alles bisher ist ... mir ist es wichtig, dass es nicht unnötig Platz verbraucht"). **Baut auf `main` @ `8d3d3a2` auf** (= Tag `v1.88.0`,
veröffentlicht; 1.87.0 ist darin enthalten und nicht veröffentlicht, so steht es in beiden CHANGELOG-Dateien). Zuerst dieses Protokoll lesen, dann
`docs/HANDOVER.md` (Abschnitt 1.89.0), `docs/UEBERGABE-1.88.0.md`, `docs/UEBERGABE-1.87.0.md`.

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.89.0.zip` enthält:

- `UEBERGABE-1.89.0.md` (dieses Protokoll, liegt auch unter `docs/`), `RELEASE-NOTES-1.89.0.md` (Englisch und Deutsch),
- `1.89.0-auf-v1.88.0.patch`: `git diff --binary` von `8d3d3a2` (`v1.88.0`, heutiger Stand von `main`) auf 1.89.0, mit den Bildern,
- `files/`: jede Datei, die sich gegenüber `v1.88.0` geändert hat oder neu ist, vollständig, **ausser den Bildern unter `docs/img/`** (die stehen nur
  im Patch, damit das ZIP nicht jedes Bild doppelt trägt). Es ist nichts zu löschen.

Anwenden (zuerst `git log -1` prüfen, `main` muss auf `8d3d3a2` stehen):

1. `git apply --index 1.89.0-auf-v1.88.0.patch` (geprüft: lässt sich auf `8d3d3a2` anwenden und ergibt genau den Stand dieser Lieferung).
2. Nur falls der Patch nicht passt (`main` hat sich bewegt): den Inhalt von `files/` über das Repository kopieren und die Bilder aus dem Patch
   holen (`git apply --index --include='docs/img/*' 1.89.0-auf-v1.88.0.patch`), dann `git add -A`.

Danach die Prüfungen aus `CLAUDE.md`, Commit `1.89.0: Hauptcode im Panel, Nachalarm pro Modus, Ausfall in der Ausgangsverzögerung`, Push auf `main`.
Tag und Release legt der Nutzer an (Ziel `main`, keine Vorabversion).

**Release Notes:** `RELEASE-NOTES-1.89.0.md`, nur 1.89.0 (der letzte veröffentlichte Tag ist `v1.88.0`), Englisch für das Release und Deutsch.

## 1. Auftrag und Entscheide

Frage des Nutzers: Ist alles, was der Optionsdialog von Home Assistant einstellt, auch im Panel? Antwort nach Prüfung von `config_flow.py`: nein,
es fehlten "Code zum Scharfschalten" (`code_arm_required`) und das Festlegen, Ändern und Entfernen des Hauptcodes. Freigabe des Nutzers mit den
Vorgaben: im Panel, im genau gleichen Stil, Schalter mit sicherer Abhängigkeit erst zeigen, wenn die Voraussetzung erfüllt ist, kein unnötiger Platz.
Der Optionsdialog von Home Assistant bleibt (zusätzlich, unverändert).

Umgesetzte Abhängigkeiten (beide sicher, vom Server erzwungen):

- Ohne Code (kein Hauptcode, kein Code pro Person) wirkt keiner der drei Schalter zum Code: sie erscheinen erst mit einem Code. Statt dreier
  gesperrter Schalter sagt die Zeile des Hauptcodes "Noch kein Code: die Anlage verlangt nie einen. Die Schalter zum Code erscheinen hier mit dem
  ersten Code."
- Mit "Scharfschalten verlangt den Code" verlangt auch jeder Wechsel des Modus den Code (`controller.async_arm`: `code_arm_required or mode_code`);
  "Moduswechsel verlangt den Code" hätte keine Wirkung und erscheint nur, solange "Scharfschalten" aus ist. Kein Einrücken: die Abhängigkeit ist
  umgekehrt (sichtbar, wenn der andere Schalter aus ist).

Weitere Wünsche und Entscheide des Nutzers während der Arbeit (2026-11-25):

- **Nachalarm pro Modus** ("gleich wie bei den Zeiten. Default ist aus"): Schalter "Einstellungen pro Modus" im Kapitel "Nach einem Alarm".
  "Immer aktiv" bekommt einen eigenen Reiter (Entscheid "Eigener Reiter (Empfohlen)").
- **Kein Absprung mehr auf Home Assistant:** der Knopf "Optionen öffnen" entfällt (Platz), alles läuft im Panel.
- **Alle Einstellungen zum Code im Assistenten:** Schritt "Code" mit Hauptcode und den Schaltern.
- **Ausfall in der Ausgangsverzögerung** (Frage "Was passiert genau, wenn die Anlage nicht scharf geschaltet werden kann, weil zum Beispiel ein
  Sensor offline ist?"; beim Prüfen gefunden: ein Sensor, der in der Ausgangsverzögerung ausfiel, liess die Anlage still scharf werden;
  "ja gerne, korrigiere das gleich mit"). Dazu der Hinweistext der Meldung "Scharfschalten nicht möglich".
- **Assistent am Computer als Fenster** ("so gross wie das ganze Panel", "bei grossen Screens mittig", dann "so gross, dass man dahinter nichts
  mehr vom Panel sieht").
- **Logo der README** ("Alarmageddon direkt unter dem Badge-Icon, auch in Orange"), Überschrift darunter entfernt ("ja ohne Überschrift").
- **Blatt eines Sensors** (Bildschirmfoto des Nutzers: "Die Einstellungen des Sensors scrollen zusammen mit der Liste hoch ... dass die Settings
  eigenständig scrollbar sind"): behoben, das Blatt bleibt neben dem Tabellenkopf und scrollt für sich.
- **"Beim Scharfschalten umgehen"** (Frage "macht dieses Setting wirklich Sinn? ... wieso haben wir dann ein Setting auf dem gleichen Sensor, der das
  wieder überschreibt?"): Antwort nach Prüfung des Codes: für nicht erreichbare Sensoren war es dasselbe wie "Muss erreichbar sein" aus; das
  Weiterüberwachen nach der Rückkehr war schon Standard. Entscheide: "Nur für offene (Empfohlen)" (eingerückt unter "Muss geschlossen sein")
  und "Strenger werden" (keine Umstellung des Bestands).

## 2. Was gebaut wurde

| Teil | Umsetzung |
| --- | --- |
| Server | `websocket_api.py`: neue Befehle `set_main_code` (Format `CODE_PATTERN` → `invalid_code_format`; gleich wie ein Code pro Person → `code_taken`; unter `_codes_lock`; Hash im Executor; Optionen erst nach dem Hashen lesen; Antwort `{ok, reload}`) und `remove_main_code` (ohne Hauptcode `not_found`; bleibt kein Code pro Person, `code_arm_required` und `code_ack_required` auf `False`, wie `remove_code`). `save_system` nimmt `code_arm_required` (bool; an ohne Code → `code_missing`, gemeinsam mit `code_ack_required`) |
| Panel | `system.js`: Zeile des Hauptcodes `.ag-mainrow` ohne Hauptcode mit "Hauptcode festlegen" (auf dem Handy darunter über die ganze Breite), mit Hauptcode zwei Kreise "Hauptcode ändern" und "Hauptcode entfernen" (wie die Tabelle der Codes). Formular `openMainForm` im Fenster `ag-codes` (dieselben Codefelder mit Auge und Warnung wie "Code hinzufügen", `_codeFields`, `_codeFormEnd`), Rückfrage `openRemoveMain` (nennt, wenn danach kein Code bleibt). Nach dem Speichern wartet das Panel auf das Neuladen (`_reloadWait`). Schalter `_armCodeRow`, `_modeCodeRow`, `_ackRow` nur mit Code; Reihenfolge Scharfschalten, Moduswechsel, Quittieren. Die Schalter im Entwurf (`CODE_KEYS`) folgen dem Server, solange sie unverändert sind (`_followCodes`), sonst bliebe nach dem Entfernen des letzten Codes eine verborgene "1 Änderung" stehen. Knopf "Optionen öffnen" entfernt. CSS `.ag-mainrow` in `styles.js`. `PANEL_VERSION` 298 |
| Texte | `strings.js` EN/DE: `sysCodeNoneAll`, `mainSet`, `mainChange`, `mainRemove`, `mainFormHint`, `mainFormHintChange`, `mainRemoveTitle`, `mainRemoveText`, `mainRemoveLast`, `errMainTaken`, `errCodeMissing`, `sysArmCode`, `sysArmCodeHint`; geändert `sysCodeMainSet` ("Festgelegt"), `sysModeCodeHint` (gekürzt, "Aus: der Wechsel geht ohne Code"); entfernt `sysCodeOpen`, `sysAckCodeNone` |
| Nachalarm pro Modus | Optionen `realarm_per_mode` (nur `True` schaltet ein) und `realarm_scopes` (je Auslöser `home`, `away`, `night`, `always` genau `{enabled: bool, count: 1..10}`, `schemas.REALARM_SCOPES` mit `strict_map`, in `save_system` und im Backup). `const.realarm_scope`/`realarm_for`: an, gilt der Wert des Auslösers des laufenden Alarms (`workflow._realarm`, `plan[0]`), fehlt er, der gemeinsame; beschädigte Werte bleiben im Bereich. `save_system` ersetzt nur die genannten Auslöser, `data` liefert je Auslöser den wirksamen Wert. Panel `system.js`: Schalter `ra-permode` über dem Nachalarm, Reiter `sys-rascope` (`.ag-modeseg`, Rahmen `.ag-pmgroup` wie bei den Zeiten, Zeile "gilt nur für"), oranger Punkt je Reiter; aus, gilt der erste Reiter für alle |
| Ausgangsverzögerung | `controller.py`: `_arming_gone` (Sensoren der Zone, die in der Ausgangsverzögerung ausfielen; in der Übergabe beim Neuladen), `_offline_after_arming` beim Scharfwerden (Ereignis und Meldung wie ein Ausfall im scharfen Zustand, mit "Ausfall gilt als Alarm" der Alarm), `_arming_watch` in `_remember` (zu → ausgefallen → offen nach dem Scharfwerden = Öffnen nach `RETURN_CONFIRM`). Deaktivieren und ein neuer Versuch vergessen die Ausfälle. Text `ntH_arm_failed` nennt nicht erreichbare Sensoren |
| Assistent | `wizard.js _codeHtml`: Zeile der Codes pro Person, Zeile des Hauptcodes (`SystemUi.mainRowHtml`), Kapitel "Wann der Code verlangt wird" (`codeSwitchesHtml`, nur mit Code), gespeichert mit "Weiter" über `SystemUi`. `alarmageddon-panel.js _wizardPopup`: am Computer `.ag-wzpop` über dem ganzen Panel, deckend, Breite wie der Inhalt des Panels (höchstens 1680 px, mittig), der Inhalt des Panels dahinter leer und `inert`; `.ag-toast` mit z-index 50 und über der Fusszeile des Assistenten. Auf dem Handy unverändert |
| Umgehen | `controller.blocking_unreachable`: nur `reachable` (ohne `OPT_BYPASS`); Panel `_unreachable` gleich. `common.js OPTIONS`: `bypass` mit `under: "open_ok"`, `notFor: ["motion"]`, direkt nach `open_ok`; `optionShown` für Blatt, Kurztexte und Voreinstellungen ("–"); CSS `.ag-osub` (eingerückt, ohne Linie zum Schalter darüber). Texte `optBypassHint`, `optReachableHint` |
| Blatt | `styles.js`: `.ag-sen-layout.open > .ag-side { align-self: stretch }`: die Spalte reicht über die Tabelle, `.ag-sheet` (sticky) bleibt neben dem Tabellenkopf |
| Doku | CHANGELOG 1.89.0 (EN/DE), README (Logo `docs/brand/readme-logo.svg` aus `readme-logo.mjs`, ohne Überschrift; Sicherheit, Einrichten), Handbuch (Sicherheitsmechanismen, Codes pro Person, "Hauptcode im Panel", Assistent, Nachalarm pro Modus, Ausfall in der Ausgangsverzögerung; doppelter Absatz "Roter Kreis" im deutschen Handbuch entfernt), `docs/HANDOVER.md`, Regeln in `CLAUDE.md`, `scripts/optimize_images.py` (verliert keine Farben mehr), alle Bilder neu erzeugt |

## 3. Risiken und Grenzen

- Wer im Panel ist (nur Administratoren), legt den Hauptcode fest oder ändert ihn, ohne den bisherigen zu kennen. Das war im Optionsdialog von Home
  Assistant schon so und gilt auch für die Codes pro Person; das Handbuch sagt es.
- Entfernen des letzten Codes lässt die Anlage ohne Code: jeder, der sie bedienen kann, deaktiviert sie. Die Rückfrage sagt das ausdrücklich.
- Nach dem Festlegen oder Entfernen lädt Home Assistant die Anlage neu (wie bei jeder Änderung der Optionen); das Panel zeigt so lange die Ladeanzeige.
- Nachalarm pro Modus: ein Alarm nimmt den Wert des Auslösers, mit dem er begann; spricht im Alarm eines Modus ein Sensor "Immer aktiv" an, gilt
  weiter der Wert des Modus (der laufende Ablauf bestimmt, was erneut läuft).
- "Umgehen": strenger als bisher. Ein Sensor mit "Umgehen" und "Muss beim Scharfschalten erreichbar sein" verhindert jetzt das Scharfschalten,
  wenn er nicht antwortet (vorher schaltete die Anlage scharf). Gewollt (Entscheid "Strenger werden"); die Meldung "Scharfschalten nicht möglich"
  bietet "Trotzdem scharf schalten". Ein eigener Wert "Umgehen" bei einem Sensor, der offen sein darf, bleibt gespeichert und wirkt nicht.
- Ausfall in der Ausgangsverzögerung: mit "Ausfall gilt als Alarm" gibt ein Sensor, der in der Ausgangsverzögerung ausfällt und nicht zurückkommt,
  beim Scharfwerden den Alarm. Das ist gewollt (dieselbe Zusage wie im scharfen Zustand), aber neu: bisher wurde die Anlage still scharf.
- Nicht auf echter Hardware und nicht in einem echten Home Assistant mit Browser geprüft (nur pytest mit echtem HA-Kern und der Nachbau der Panel-Suiten).

## 4. Prüfungen dieser Lieferung

Alle Läufe am Stand der Dateien in `files/`, am 2026-11-25 in dieser Session ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Meldung |
| JSON gültig, `strings.json` = `translations/en.json`, `de.json` mit denselben Schlüsseln; `node --input-type=module --check` aller Panel-Dateien, `node --check` aller Suiten; kein "ß" in neuen Zeilen | in Ordnung |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1804 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1804 bestanden, 6 übersprungen |
| Neue Testdateien gegen den Stand 1.88.0 (Fehlertests zuerst rot) | `test_main_code_panel.py` 17 von 17 rot; `test_exit_delay_offline.py` 5 rot, 5 grün (Verhalten, das bleibt); `test_realarm_per_mode.py` 6 rot, 12 grün (Ablehnungen und Verhalten ohne Schalter, das bleibt); `test_bypass_open_only.py` 3 rot (Umgehen bei nicht erreichbarem Sensor), 3 grün |
| Mutationsprobe (`python -u scripts/mutation_check.py`, voller Lauf) | 518 von 518 erkannt; jedes Muster steht genau einmal im Code; danach alle Python-Dateien mit dem Stand vor dem Lauf verglichen (nichts zurückgeblieben) |
| Panel-Suiten (`node run.mjs`, Desktop und Handy, DE und EN), voller Lauf | 89 Suiten, 9764 Prüfungen bestanden, 1 fehlgeschlagen: `dragscroll-e2e` ("bis in die weit entfernte Liste ziehen"), lief parallel zur Mutationsprobe auf 2 Kernen; einzeln wiederholt: 28 von 28 bestanden. `wizard-e2e` nach der letzten Textänderung einzeln wiederholt: 464 von 464 |
| Neue Suite-Prüfungen gegen den Stand 1.88.0 | `bypass-e2e` 32 von 36 rot; `layout-e2e` "Liste ganz nach unten gescrollt: das Blatt steht neben dem Tabellenkopf" rot mit der Regel von 1.88.0 (im Browser nachgestellt: `align-self: start`; das Blatt lag 662 px über dem Tabellenkopf) |
| Bilder | alle 50 neu erzeugt (`readme-shots.mjs`, neues `optimize_images.py`: höchstens 9 von 255 Abweichung je Farbkanal, Verfahren MAXCOVERAGE bei allen) und **jedes einzeln angesehen**; dabei nachgebessert: `after-alarm-*` (Kapitel war unten abgeschnitten), `cards-*` ("Bereit für" passte nicht zum nicht erreichbaren Fenster), `step-wizard-*` (Text "Darf offen sein") |
| Patch und `files/` | auf `8d3d3a2` (`v1.88.0`) angewendet: der Patch allein und `files/` mit den Bildern aus dem Patch ergeben je genau den Stand dieser Lieferung; Tests zu CHANGELOG, README und Texten nach dem Nachtragen von "nicht veröffentlicht" für 1.87.0 in beiden Umgebungen bestanden (74 von 74) |
| Assistent als Fenster | angesehen am Computer bei 1400 und 2400 px (deckt das Panel ab, mittig 1680 px), auf dem Handy unverändert; geprüft in `wizard-e2e` |

Nicht ausgeführt: HACS-Action und hassfest (nur in der CI), echte Hardware, Apple Home mit echtem Gerät, echter Home Assistant mit Browser.
