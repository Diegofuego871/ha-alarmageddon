# Übergabe 1.92.0 (2026-11-26): "Beim Scharfschalten umgehen" gestrichen, Flucht der Zeile "Eigene Eingangsverzögerung", Knöpfe neben Pillen

Auftrag des Nutzers an den Agenten, der hochlädt. **Baut auf `main` @ `5a40e8f` auf** (= Tag `v1.91.1`, geprüft auf GitHub am 2026-11-26). Zuerst
diese Datei lesen, dann `docs/HANDOVER.md` (Abschnitt 1.92.0).

**Diese Lieferung ersetzt die erste Lieferung 1.92.0 (ZIP von 07:53) vollständig.** Neu ist der Abschnitt "Knöpfe neben Filter-Pillen" (Wunsch des
Nutzers 08:15, Entscheid 08:20). Die Version bleibt 1.92.0 (weder auf `main` noch getaggt); `PANEL_VERSION` steigt auf 303.

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.92.0.zip` enthält:

- `UEBERGABE-1.92.0.md` (dieses Protokoll, liegt auch unter `docs/`), `RELEASE-NOTES-1.92.0.md` (Englisch und Deutsch),
- `1.92.0-auf-main-5a40e8f.patch`: `git diff --binary` von `5a40e8f` (heutiger Stand von `main`) auf 1.92.0, mit allen Bildern,
- `1.92.0-nachtrag-auf-erste-lieferung.patch`: nur der Unterschied zwischen der ersten Lieferung 1.92.0 (Baum `0d79e1acb7572e221c15746dbb62a56d8ac9055c`)
  und dieser, mit Bildern (für den Fall, dass die erste Lieferung schon angewendet ist),
- `files/`: jede Datei, die sich gegenüber `5a40e8f` geändert hat oder neu ist, vollständig, ohne Bilder. Die Bilder stehen nur in den Patches:
  `docs/img/sensor-options-de.png`, `docs/img/sensor-options-en.png`, `docs/img/sensors-de.png`, `docs/img/sensors-en.png` (geändert) und die 18
  Bilder des Mockups `docs/mockups/voreinstellungen-knopf-v1/` (neu).
- **Gelöscht wird eine Datei:** `tests/test_bypass_open_only.py` (ersetzt durch `tests/test_bypass_removed.py`).

Anwenden (zuerst `git log -1` und `git rev-parse HEAD^{tree}` prüfen):

1. `main` steht auf `5a40e8f` (die erste Lieferung ist noch nicht angewendet): `git apply --index 1.92.0-auf-main-5a40e8f.patch` (geprüft: lässt sich
   auf `5a40e8f` anwenden und ergibt genau den Stand dieser Lieferung, samt Bildern und Löschung).
2. Die erste Lieferung ist schon angewendet (Baum von `HEAD` oder des Index ist `0d79e1acb7572e221c15746dbb62a56d8ac9055c`): `git apply --index
   1.92.0-nachtrag-auf-erste-lieferung.patch` (geprüft: ergibt denselben Baum wie Schritt 1). Ist sie schon gepusht, kommt der Nachtrag als eigener
   Commit `1.92.0: Knöpfe neben Filter-Pillen` dazu, die Version bleibt 1.92.0, solange es keinen Tag gibt.
3. Nur falls keiner der Patches passt (`main` hat sich anders bewegt): den Inhalt von `files/` über das Repository kopieren, `git rm
   tests/test_bypass_open_only.py`, dann `git add -A`. Die Bilder fehlen auf diesem Weg; dann den Nutzer fragen.

Danach die Prüfungen aus `CLAUDE.md`, Commit `1.92.0: "Beim Scharfschalten umgehen" gestrichen, Knöpfe neben Filter-Pillen`, Push auf `main`. Tag und
Release legt der Nutzer an (Ziel `main`, keine Vorabversion).

**Release Notes:** `RELEASE-NOTES-1.92.0.md`, nur 1.92.0 (der letzte veröffentlichte Tag ist `v1.91.1`), Englisch für das Release und Deutsch.

## 1. Auftrag (Meldungen des Nutzers vom 2026-11-26)

- 06:28, Bildschirmfoto der Voreinstellungen je Sensorart mit der Spalte "Beim Scharfschalten umgehen" eingekreist: "Haben wir diese Option nicht
  gestrichen? Beim Scharfschalter umgehen, das widerspricht sich doch, das war doch das." Vorschlag: streichen, wo sie wirkte "Muss beim
  Scharfschalten geschlossen sein" aus. Antwort 06:32: "Ja mach es so, brauchr kein mockup".
- 06:32, Bildschirmfoto der Einstellungen eines Sensors mit roter Linie: "Hier bitte schauen, dass der Text bei der Zeit auf der gleichen Flucht ist
  wie die anderen Texte und dort einfach etwas Leerraum lassen."
- 08:15, Bildschirmfoto des Knopfs "Voreinstellungen" (rot umkreist): "kannst du mal mockups erstellen wie dieser butten sich etwas mehr von den pillen
  unterscheiden könnte? ohne grösser zu werden. inkl mobile". Mockup `docs/mockups/voreinstellungen-knopf-v1` mit vier Varianten (Empfehlung A).
  Antwort 08:20: "oke mach A"; auf die Rückfrage, ob auch "Ansicht" in der Übersicht mitkommt: "Ja, am Computer auch".

## 2. Änderungen

- **Option gestrichen:** `bypass` ist nicht mehr in `SENSOR_OPTIONS` (Server) und `OPTIONS` (Panel): kein Schalter im Blatt eines Sensors (auch je
  Modus), keine Spalte in den Voreinstellungen, kein Kurztext "umgangen" in der Tabelle, nichts im Fenster "Auf Sensoren anwenden". Ein offener
  Sensor, der geschlossen sein muss, verhindert das Scharfschalten immer; übergangen wird er nur noch mit "Trotzdem scharf schalten" (`force`,
  Attribut `bypassed_sensors`). Die Erklärung von "Muss beim Scharfschalten geschlossen sein" sagt, was "aus" bedeutet.
- **Umstellung des Bestands (`settings.fold_bypass`):** je Ebene wie `controller.option` (Modus, Sensor, Voreinstellung der Art): neu "darf offen
  sein" = bisher "darf offen sein" oder "umgehen". Damit geht Scharfschalten überall, wo es bisher ging; der Sensor wird danach aber überwacht (ein
  neues Öffnen nach dem Schliessen löst aus), statt bis zum Deaktivieren übergangen zu werden. Geschrieben wird nur, wo der Sensor auf der Ebene
  einen eigenen Wert hatte. Wann:
  - einmal beim ersten Laden der Einstellungen nach dem Update, für alle Anlagen, auch nicht geladene, mit den Voreinstellungen von vorher
    (Vermerk `presets_no_bypass`, sofort geschrieben); die Voreinstellungen selbst stellt `valid_presets` um;
  - beim Laden jeder Anlage (Reste aus "Offener Sensor beim Scharfschalten: umgehen" bis 0.31.0);
  - beim Zurückholen eines Backups, mit den Voreinstellungen des Backups.
  Die Umstellung ist wiederholbar ohne Wirkung. Das Panel kann `bypass` nicht mehr speichern (Zonen, Voreinstellungen).
- **Flucht:** die Zeile "Eigene Eingangsverzögerung" (ohne Schalter) hat nach der Kachel einen Leerraum in der Breite eines Schalters (`.ag-tgap`),
  ihr Text steht in der Flucht der anderen Texte, am Computer und auf dem Handy. Andere Listen mit gemischten Zeilen gibt es im Panel nicht (geprüft
  mit einem Durchlauf über alle Seiten der Konfiguration, die Übersicht, alle Schritte des Assistenten und die Fenster der Benachrichtigungen), ausser
  den Kopfzeilen der Karten Codes und Backups (Zusammenfassung mit Knöpfen über Zeilen mit Schalter): sie bleiben bündig mit der Kachel wie die
  gleichen Kopfzeilen bei Tönen und Routinen. Angleichen nur auf Wunsch.
- **Knöpfe neben Filter-Pillen (Variante A):** neue Klasse `.ag-btn.ag-toolbtn` (`styles.js`): Ecken 12 px wie das Suchfeld statt runder Enden,
  das Symbol in einer Kachel (`--ag-primary-soft`) wie in den Zeilen der Einstellungen, links 6 px Polster, damit der Knopf nicht breiter wird
  ("Voreinstellungen" 4 px schmaler als bisher). Gilt für "Voreinstellungen" (`sensors.js`) und "Ansicht" (`list.js`); auf dem Handy bleibt "Ansicht"
  der runde Symbolknopf neben der Suche ohne Kachel. Höhe unverändert 38 px. Die Pillen bleiben rund.
- Version 1.92.0, `PANEL_VERSION` 303; CHANGELOG (EN/DE), Handbuch (EN/DE, mit neuen Bildern `sensor-options-*.png`, `sensors-*.png`), `CLAUDE.md`,
  `docs/HANDOVER.md`, Mockup `docs/mockups/voreinstellungen-knopf-v1`.

## 3. Risiken und Grenzen

- **Verhaltensänderung für umgangene Sensoren:** wer zum Beispiel ein gekipptes Fenster mit "Umgehen" eingestellt hatte, konnte es bis 1.91.x
  während der scharfen Anlage schliessen und wieder öffnen, ohne Alarm. Ab 1.92.0 löst das neue Öffnen aus. Das ist gewollt (sonst bliebe der
  Widerspruch) und steht im CHANGELOG mit dem Hinweis, die Sensoren zu prüfen. Wer einen Sensor einmalig übergehen will, nutzt "Trotzdem scharf
  schalten".
- Knöpfe neben Filter-Pillen: nur Darstellung (eine Klasse), keine Logik; beide Knöpfe öffnen ihre Fenster wie bisher (Suite `toolbtn-e2e.mjs`).
- Nicht auf echter Hardware und nicht in einem echten Home Assistant mit Browser geprüft. Die Umstellung ist mit nachgebauten Ablagen geprüft
  (Einstellungen von 1.91.x mit `bypass` in den Voreinstellungen, eine nicht geladene Anlage, alte Backups).

## 4. Prüfungen dieser Lieferung

Alle Läufe am Stand der Dateien in `files/` (und den Bildern im Patch), am 2026-11-26 in dieser Session ausgeführt, nach der Änderung der Knöpfe:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Meldung |
| `node --input-type=module --check` aller Panel-Dateien, `node --check` der geänderten und neuen Suiten, von `readme-shots.mjs` und des Mockup-Skripts, JSON gültig, `strings.json` = `translations/en.json`, `de.json` mit denselben Schlüsseln, kein "ß" und keine typografischen Anführungszeichen in den geänderten Zeilen | in Ordnung |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1829 bestanden, 6 übersprungen (vor und nach der Mutationsprobe, nicht parallel dazu; zuletzt nach der letzten Textänderung im CHANGELOG) |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1829 bestanden, 6 übersprungen (ebenso) |
| Mutationsprobe (`python -u scripts/mutation_check.py`, voller Lauf) | 523 von 523 erkannt; die sieben neuen Zeilen "1.92.0" zuvor einzeln geprüft, jede scheitert an der erwarteten Prüfung von `tests/test_bypass_removed.py` |
| Neue und geänderte Suiten gegen den Stand 1.91.1 (`git archive 5a40e8f`) | rot in den neuen Prüfungen: `bypass-e2e.mjs` (Schalter, Erklärung mit "ausser mit Umgehen", Kurztext "umgangen", Spalte), `icons-e2e.mjs` (Text der Zeile 52 px links der übrigen, kein Leerraum), `review-e2e.mjs` (ein Rest "Umgehen" machte die Anlage bereit), `toolbtn-e2e.mjs` (6 Prüfungen: runde Enden, keine Kachel; "Ansicht" auf dem Handy war schon rund und bleibt grün) |
| Panel-Suiten (`node run.mjs`, Desktop und Handy, DE und EN), alle 95 | 94 Suiten grün im vollen Lauf; `dragscroll-e2e.mjs` scheiterte dort (3 bestanden, 1 fehlgeschlagen), während die Mutationsprobe parallel lief (zwei Kerne; im ersten Lauf dieser Version ebenso), allein wiederholt 28 von 28 bestanden. Zusammen 10220 Prüfungen bestanden (`toolbtn-e2e` 30, `bypass-e2e` 32, `icons-e2e` 100, `layout-e2e` 298, `review-e2e` 200) |
| Darstellung angesehen | Blatt der Haustür am Computer hell und auf dem Handy dunkel (Flucht der Eingangsverzögerung); Knöpfe "Voreinstellungen" und "Ansicht" am Computer; die vier geänderten Bilder `sensors-de/en.png`, `sensor-options-de/en.png` einzeln angesehen; die Übersichten des Mockups (Computer hell, Handy hell und dunkel). Neu erzeugte Bilder ohne sichtbare Änderung (`overview`, `mobile`, `cards`, `wizard`, `step-wizard`, `presets-apply`: nur Uhrzeiten oder Verschiebungen um einen Bildpunkt) sind unverändert vom Stand `5a40e8f` übernommen |
| Patches und `files/` | `git apply --index` des Patches auf einem frischen Klon @ `5a40e8f` ergibt genau den Baum des Lieferstands (Hash verglichen, samt Bildern und Löschung); der Nachtrag auf den Stand der ersten Lieferung ergibt denselben Baum; `files/` enthält jede geänderte oder neue Datei ausser den Bildern, Inhalt verglichen; ZIP unter 30 MB |

Nicht ausgeführt: HACS-Action und hassfest (nur in der CI), echte Hardware, echter Home Assistant mit Browser.
