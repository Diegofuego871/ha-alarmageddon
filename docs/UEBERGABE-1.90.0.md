# Übergabe 1.90.0 (2026-11-25): Hauptcode abgeschafft, Symbole oben links

Auftrag des Nutzers an den Agenten, der hochlädt. **Baut auf `main` @ `0a6aa00` auf** (Tag `v1.89.0` auf `7ddb68c`, danach nur der Commit `0a6aa00` mit einer Testkorrektur in `tests/test_auto_backup.py`; geprüft auf GitHub am 2026-11-25 um 18:12). Zuerst dieses Protokoll
lesen, dann `docs/HANDOVER.md` (Abschnitt 1.90.0), `docs/UEBERGABE-1.89.0.md`. Eine Version 1.89.1 gibt es nicht: sie wurde nie geliefert, ihr
Inhalt (Hauptcode im Fenster der Codes) ist durch die Abschaffung des Hauptcodes überholt.

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.90.0.zip` enthält:

- `UEBERGABE-1.90.0.md` (dieses Protokoll, liegt auch unter `docs/`), `RELEASE-NOTES-1.90.0.md` (Englisch und Deutsch),
- `1.90.0-auf-main-0a6aa00.patch`: `git diff --binary` von `0a6aa00` (heutiger Stand von `main`) auf 1.90.0, mit allen Bildern,
- `files/`: jede Datei, die sich gegenüber `0a6aa00` geändert hat oder neu ist, vollständig, **ausser Bildern** (`docs/img/` und die PNG des
  Mockups `docs/mockups/symbole-v1/`; die stehen nur im Patch, damit das ZIP kein Bild doppelt trägt).
- **Zu löschen** (im Patch enthalten, bei `files/` von Hand): `tests/test_main_code_panel.py`, `tests/panel/suites/maincode-e2e.mjs`.

Anwenden (zuerst `git log -1` prüfen, `main` muss auf `0a6aa00` stehen):

1. `git apply --index 1.90.0-auf-main-0a6aa00.patch` (geprüft: lässt sich auf `0a6aa00` anwenden und ergibt genau den Stand dieser Lieferung).
2. Nur falls der Patch nicht passt (`main` hat sich bewegt): den Inhalt von `files/` über das Repository kopieren, die beiden Dateien oben löschen
   und die Bilder aus dem Patch holen (`git apply --index --include='docs/img/*' --include='docs/mockups/*' 1.90.0-auf-main-0a6aa00.patch`), dann
   `git add -A`.

Danach die Prüfungen aus `CLAUDE.md`, Commit `1.90.0: Hauptcode abgeschafft, Symbole oben links`, Push auf `main`. Tag und Release legt der Nutzer
an (Ziel `main`, keine Vorabversion).

**Release Notes:** `RELEASE-NOTES-1.90.0.md`, nur 1.90.0 (der letzte veröffentlichte Tag ist `v1.89.0`), Englisch für das Release und Deutsch.

## 1. Auftrag (Wünsche und Entscheide des Nutzers vom 2026-11-25)

- Zum Schritt "Code" des Assistenten: "ich denke man müsste besser erklären was ein Hauptcode & was ein User Code ist. Wieso braucht es den
  Hauptcode überhaupt?" Auf die Rückfrage: "Abschaffen", danach: "Hauptcode würde ich sagen entfernen. Er hat keinen Nutzen und viel
  Erklärungsbedarf. Es ist heute schon möglich, einen Code ohne Verbindung zu einem User zu erstellen. Das reicht."
- Zu Konfiguration › Anlage (Bildschirmfotos): Zeilen ohne eigenes Symbol ("eigenes Icon" für "Anlage löschen" und "Empfänger von Alarmen"),
  "das Icon soll immer oben links, im weissen Bereich sein", "Schalter sind immer links vor dem Text". Mockup "wie du alle Icons einheitlich
  darstellen würdest, komplette Seite" (`docs/mockups/symbole-v1`), danach: "machst du das Icon für Einstellung pro Modus auch bei den Sensoren &
  Aktionen?" (ja, auf allen vier Seiten).
- "Der Bereich soll nur Zeiten heissen. Die Zeit für das Bestätigungsfenster kommt hoch in den gleichen weissen Bereich wie die anderen Zeiten."
- Zu "Höchstens" beim Nachalarm: "Option ohne den Strich. Es gehört zu Nachalarm."
- "Voreinstellungen je Sensorart": "auf dem Desktop breiter ... am besten gleich breit wie das Panel dahinter".
- "Sensoren hinzufügen": "soll auf dem Desktop immer gleich lang sein gegen unten, egal wie viele Einträge gezeigt werden. Damit sind die Buttons
  und Suchfelder immer am gleichen Ort."

## 2. Was gebaut wurde

Einzelheiten mit Funktionsnamen in `docs/HANDOVER.md` (Abschnitt 1.90.0) und `CLAUDE.md` ("Kein Hauptcode", "Symbol oben links", "Fenster mit
Listen am Computer").

- **Hauptcode abgeschafft:** beim ersten Laden nach dem Update wird ein vorhandener Hauptcode einmal zum Code pro Person "Hauptcode" ("Main code",
  wenn HA nicht Deutsch spricht; belegt: "… 2") ohne Benutzer, mit demselben Hash und Salz. Wer den Hauptcode kennt, schaltet unverändert; die
  Schalter zum Code bleiben. Ein beschädigter Hauptcode fällt weg. Einrichtung und Optionsdialog von HA haben kein Codefeld mehr; Panel ohne
  Hauptcode (Seite, Fenster "Codes anzeigen", Assistent); WebSocket-Befehle `set_main_code`/`remove_main_code` entfernt. Der Hinweis zum
  "Benutzer in Home Assistant" erklärt jetzt, wozu er dient (Name im Protokoll, ohne Benutzer für Gäste oder angebundene Systeme).
- **Symbole oben links:** [Symbol][Schalter][Text] in allen Zeilen mit Symbol, zentral im CSS; neue Symbole (siehe CHANGELOG); "Einstellungen pro
  Modus" mit Symbol auf allen vier Seiten; Unteroptionen ("Höchstens" ohne Symbol bündig mit dem Text, "Beim Scharfschalten umgehen" unter dem
  Schalter der Zeile darüber).
- **Kapitel "Zeiten"** mit einer Karte (Ausgangs-, Eingangsverzögerung, Bestätigungsfenster).
- **Fenster am Computer:** "Voreinstellungen je Sensorart" so breit wie das Panel dahinter; "Sensoren hinzufügen" immer gleich hoch.
- **Bilder:** Konfiguration und Kapitel "Codes pro Person" neu, `scripts/optimize_images.py` wählt nach mittlerer Abweichung.
- Version 1.90.0, `PANEL_VERSION` 299; CHANGELOG (EN/DE), README (EN/DE: Installation ohne Code), Handbuch (EN/DE), `CLAUDE.md`,
  `docs/HANDOVER.md`.

## 3. Risiken und Grenzen

- **Verhaltensänderung durch die Umstellung:** Protokoll und `changed_by` nennen nach dem Update bei Eingabe des früheren Hauptcodes
  "Hauptcode"; bisher den Benutzer von HA aus dem Aufruf (`_user_name`) oder niemanden. Wer Automationen auf `changed_by` stützt, sieht dort jetzt
  diesen Namen (er lässt sich im Panel umbenennen). Im Test `test_main_code_migration.py -k becomes` geprüft.
- Ein Code pro Person zählt zur Höchstzahl der Codes (`MAX_CODES`); hatte eine Anlage schon die Höchstzahl und einen Hauptcode, hat sie nach der
  Umstellung einen Code mehr als erlaubt. Die Umstellung lässt das zu (ein Code darf nie verloren gehen), neue Codes gehen erst nach dem Entfernen
  eines Codes.
- Der Optionsdialog von HA kann keinen Code mehr setzen. Wer ihn bisher dafür nutzte, findet den Weg in der Meldung des Dialogs
  (`code_missing`) und in der Beschreibung des Abschnitts.
- Ein Backup enthält nie Codes (unverändert); ein Backup aus 1.89.x mit Hauptcode-Feldern wird wie bisher ohne Code eingelesen.
- Nicht auf echter Hardware und nicht in einem echten Home Assistant mit Browser geprüft.

## 4. Prüfungen dieser Lieferung

Alle Läufe am Stand der Dateien in `files/`, am 2026-11-25 in dieser Session ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Meldung (vorher eine: `backup.py` nutzte `CONF_CODE_SALT` ohne Import; `_has_code` liest seither nur die Codes pro Person, siehe HANDOVER) |
| `node --input-type=module --check` aller Panel-Dateien, `node --check` aller Suiten und Skripte unter `tests/panel/`, JSON gültig, `strings.json` = `translations/en.json`, `de.json` mit denselben Schlüsseln, kein "ß" und keine typografischen Anführungszeichen in neuen Zeilen | in Ordnung |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1809 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1809 bestanden, 6 übersprungen |
| Mutationsprobe (`python -u scripts/mutation_check.py`, voller Lauf) | 514 von 514 erkannt, darunter die 7 Zeilen "Hauptcode abgeschafft" |
| Neue Tests gegen den Stand 1.89.0 (`git archive 7ddb68c`) | `test_main_code_migration.py`: 18 von 20 rot (die zwei übrigen sichern Verhalten, das schon galt); `test_config_flow.py -k complete_code`: 6 von 6 rot; Suite `icons-e2e.mjs` rot in den Prüfungen zu "Einstellungen pro Modus", Lage der Symbole auf allen vier Seiten, Kapitel "Zeiten", Schalter zum Code, "Anlage löschen", "Höchstens", Empfänger, Karten der Meldungen, festen Meldungen, Regeln der Überwachung, Routine sowie "Voreinstellungen" und "Sensoren hinzufügen" am Computer; grün blieb, was 1.89.0 schon erfüllte (beide Fenster auf dem Handy Vollbild, keine Fehler der Seite). Die Prüfung der Einrückung von "Beim Scharfschalten umgehen" kam danach dazu und lief nicht gegen 1.89.0 |
| Panel-Suiten (`node run.mjs`, Desktop und Handy, DE und EN), alle 90 | letzter Gesamtlauf am Endstand: 9824 Prüfungen bestanden, 0 fehlgeschlagen. Ein früherer Gesamtlauf (vor den letzten Korrekturen) fand vier Suiten rot: `layout-e2e` und `ntcards-e2e` prüften noch die alte Reihenfolge (Reiter unter dem Schalter, Schalter vor dem Symbol), `dlgchapters-e2e` öffnete das Fenster des Hauptcodes, `selftest-e2e` fand die Einheit von "Selbsttest alle" auf dem Handy unter dem Feld (echter Fehler, behoben); die drei Suiten folgen jetzt der neuen Reihenfolge |
| Darstellung angesehen | alle vier Seiten der Konfiguration auf Desktop und Handy, Einstellungen eines Sensors, Editor einer Routine, Assistent Schritt "Code", "Voreinstellungen" bei 1400, 2400 und 390 px, "Sensoren hinzufügen" mit 0, 1, 4 und vielen Einträgen; dabei nachgebessert: Schalter "Einstellungen pro Modus" sass nicht mittig auf dem Symbol, Einheit von "Selbsttest alle" rutschte auf dem Handy unter das Feld, Unteroptionen von Sensor und Routine nicht bündig, Symbol der Regeln der Überwachung stand noch nach dem Schalter |
| Bilder | 32 Bilder neu (`readme-shots.mjs`), verkleinert mit `optimize_images.py` (MAXCOVERAGE mit k-means, grösste Abweichung 6 bis 12, im Mittel 0.03 bis 0.85) und **jedes einzeln angesehen**: `actions`, `actions-disarm`, `after-alarm`, `codes`, `group`, `healthcheck`, `healthcheck-list`, `healthcheck-log`, `monitor`, `notifications`, `routines`, `sensor-options`, `sensors`, `silent`, `sounds`, `step-actions` (je DE und EN). Bilder ohne sichtbare Änderung der Oberfläche (`alarm`, `cards`, `log`, `mobile`, `overview`, `selftest`, `sensor`, `step-wizard`, `wizard`) unverändert gelassen; `codes-list-*.png` aus der nie gelieferten 1.89.1 gibt es nicht mehr |
| Patch und `files/` | `git apply --index` des Patches auf einem frischen Klon @ `0a6aa00` ergibt genau den Baum des Lieferstands (Hash verglichen); `files/` enthält jede geänderte oder neue Datei ausser Bildern; ZIP unter 30 MB |

Nicht ausgeführt: HACS-Action und hassfest (nur in der CI), echte Hardware, echter Home Assistant mit Browser.
