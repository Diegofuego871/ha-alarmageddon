# Übergabe 1.91.0 (2026-11-25): Voreinstellungen gezielt anwenden, Zeitraum des Protokolls, Symbole im Assistenten

Auftrag des Nutzers an den Agenten, der hochlädt. **Baut auf `main` @ `a3f8b80` auf** (= Tag `v1.90.0`, geprüft auf GitHub am 2026-11-25). Zuerst
diese Datei lesen, dann `docs/HANDOVER.md` (Abschnitt 1.91.0) und `CLAUDE.md` ("Voreinstellungen auf Sensoren anwenden", "Entwürfe und Daten des
Servers", "Zeitraum des Protokolls").

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.91.0.zip` enthält:

- `UEBERGABE-1.91.0.md` (dieses Protokoll, liegt auch unter `docs/`), `RELEASE-NOTES-1.91.0.md` (Englisch und Deutsch),
- `1.91.0-auf-main-a3f8b80.patch`: `git diff --binary` von `a3f8b80` (heutiger Stand von `main`) auf 1.91.0, mit allen Bildern,
- `files/`: jede Datei, die sich gegenüber `a3f8b80` geändert hat oder neu ist, vollständig, **ausser Bildern** (`docs/img/` und die PNG des
  Mockups `docs/mockups/voreinstellungen-anwenden-v1/`; die stehen nur im Patch, damit das ZIP kein Bild doppelt trägt).
- Keine Datei wird gelöscht.

Anwenden (zuerst `git log -1` prüfen, `main` muss auf `a3f8b80` stehen):

1. `git apply --index 1.91.0-auf-main-a3f8b80.patch` (geprüft: lässt sich auf `a3f8b80` anwenden und ergibt genau den Stand dieser Lieferung).
2. Nur falls der Patch nicht passt (`main` hat sich bewegt): den Inhalt von `files/` über das Repository kopieren und die Bilder aus dem Patch holen
   (`git apply --index --include='docs/img/*' --include='docs/mockups/*' 1.91.0-auf-main-a3f8b80.patch`), dann `git add -A`.

Danach die Prüfungen aus `CLAUDE.md`, Commit `1.91.0: Voreinstellungen gezielt anwenden, Zeitraum des Protokolls, Symbole im Assistenten`, Push auf `main`. Tag und
Release legt der Nutzer an (Ziel `main`, keine Vorabversion).

**Release Notes:** `RELEASE-NOTES-1.91.0.md`, nur 1.91.0 (der letzte veröffentlichte Tag ist `v1.90.0`), Englisch für das Release und Deutsch.

## 1. Auftrag (Wünsche und Entscheide des Nutzers vom 2026-11-25)

- Mit Bildschirmfoto des Schalters "Auf alle Sensoren anwenden" (Fenster "Voreinstellungen je Sensorart", Handy): statt des Schalters "eher ein
  Button", der "ein Pop-up öffnet, bei dem alle Sensoren aufgelistet werden, die andere Werte haben, und im besten Fall sogar noch zeigen, was bei
  diesen Werten überschrieben werden würde"; "eine scrollbare Liste, eventuell sogar filterbar mit den gleichen Chips"; "vorgewählt sind jeweils
  alle"; gezielt "nur auf einen oder so, oder auf eine Gruppe ... zum Beispiel auf alle Fenster". Zuerst ein Mockup
  (`docs/mockups/voreinstellungen-anwenden-v1`, Varianten A und B), Entscheid: "Ja variante ah, neue lieferung. 1.91.0".
- Mit Bildschirmfoto des Protokolls (Zeitraum "Letzte 30 Tage"): "Setze hier den Zeitraum bitte per Default auf 7 Tage. Wenn es allerdings jemand
  verstellt, dann soll es auf dieser Einstellung bleiben ... Aber wenn es jemand neu installiert, bleibt es auf 7 Tage."
- Mit zwei Bildschirmfotos des Schritts "Meldungen" im Assistenten (20:25): "Kannst du beim Wizard überall auch noch das gleiche Icon einsetzen. Zudem
  noch eins für den Testbereich mit dem kommen die Meldungen an ... in dem gleichen Stil, mit den gleichen Icons, wie es dann auch in den
  Einstellungen gibt. Zudem ist das Konzept neu, ja, dass zuerst das Icon kommt, dann der Schalter, dann der Text. Auch das musst du
  wahrscheinlich im Wizard überall noch angleichen."

## 2. Was gebaut wurde

Einzelheiten mit Funktionsnamen in `docs/HANDOVER.md` (Abschnitt 1.91.0).

- **Voreinstellungen gezielt anwenden (Variante A):** im Fenster der Voreinstellungen die Zeile "Auf Sensoren anwenden" mit "Sensoren wählen (N)"
  (nur echte Abweichungen); Fenster "Voreinstellungen auf Sensoren anwenden" mit Suche, Pillen, Kästchen je Art und je Sensor, "bisher → neu" je
  Option, Marke des Modus, was bleibt; "Übernehmen" merkt die Wahl ("Noch nicht gespeichert", "Verwerfen", "Auswahl ändern"), erst "Speichern" der
  Voreinstellungen löscht. Server: `save_presets` mit `reset_entities` (je Anlage), geprüft vor jeder Änderung.
- **Zeitraum des Protokolls:** Standard "Letzte 7 Tage", eine Wahl bleibt je Browser; ein Alarm aus dem roten Kreis oder einer Meldung ist immer zu
  sehen (dann einmal "Alles").
- **Gefunden und behoben:** unberührte Entwürfe der vier Seiten der Konfiguration standen nach einer Änderung des Servers als ungespeicherte
  Änderungen da und hätten die alten Werte zurückgeschrieben (nach "Auf alle Sensoren anwenden" ebenso wie nach dem Speichern auf einem anderen
  Gerät). Jetzt fällt ein Entwurf weg, der gegen die bisherigen oder die neuen Daten unverändert ist.
- **Symbole im Assistenten:** jede Zeile [Symbol][Schalter][Text] wie in der Konfiguration; Meldungen mit Symbol und Farbe aus Konfiguration ›
  Benachrichtigungen (Störung rot, Wartung orange, grau, solange aus), Empfänger mit Glocke und Zahnrad, "Kommen die Meldungen an?" mit Handy und
  Haken, das Schloss der Alarmmeldung an der Stelle des Schalters; ebenso Eingang (Handy), Überwachung und "Fertig". Zwei neue Symbole
  (`cellphoneCheck`, `shieldCheck`, Material Design Icons).
- **Bilder:** `presets-apply-de/en.png` (neu, Handbuch), `log-de/en.png` (Zeitraum "Letzte 7 Tage"). Version 1.91.0, `PANEL_VERSION` 300;
  CHANGELOG (EN/DE), Handbuch (EN/DE), `CLAUDE.md`, `docs/HANDOVER.md`. Die README bleibt (keine Einzelheiten dort).

## 3. Risiken und Grenzen

- **Verhaltensänderung Protokoll:** wer bisher immer "Alles" sah, sieht nach dem Update "Letzte 7 Tage" (ältere Einträge erst nach Wahl von "Alles";
  die Wahl bleibt danach). Gemerkt wird je Browser (`localStorage`), nicht je Benutzer von HA: auf einem anderen Gerät beginnt es wieder mit 7 Tagen.
- **Entwürfe nach einer Änderung des Servers:** hat der Nutzer selbst etwas geändert und ändert zugleich ein anderes Gerät dieselbe Seite, bleibt
  sein Entwurf mit den alten übrigen Werten stehen (wie bisher; zwei gleichzeitige Bearbeiter sind nicht gelöst).
- `reset_sensors` (Zurücksetzen je Art, der frühere Schalter) nimmt der Server weiter an, damit ein noch offenes älteres Panel nicht scheitert; das
  neue Panel sendet es nicht mehr.
- Nicht auf echter Hardware und nicht in einem echten Home Assistant mit Browser geprüft.

## 4. Prüfungen dieser Lieferung

Alle Läufe am Stand der Dateien in `files/`, am 2026-11-25 in dieser Session ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Meldung |
| `node --input-type=module --check` aller Panel-Dateien, `node --check` aller Suiten und Skripte unter `tests/panel/`, JSON gültig, `strings.json` = `translations/en.json`, `de.json` mit denselben Schlüsseln, kein "ß" und keine typografischen Anführungszeichen in den geänderten Texten | in Ordnung |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1817 bestanden, 6 übersprungen (am Endstand) |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1817 bestanden, 6 übersprungen (am Endstand) |
| Mutationsprobe (`python -u scripts/mutation_check.py`, voller Lauf) | 518 von 518 erkannt, darunter die 4 Zeilen "Voreinstellungen gezielt". Gelaufen vor den Symbolen im Assistenten; diese ändern nur Dateien unter `panel/` und Suiten, keine Datei, die die Probe verändert oder prüft |
| Neue Tests gegen den Stand 1.90.0 | `tests/test_presets_apply.py`: 4 von 8 rot (die 4 Schemaprüfungen bestehen dort, weil der unbekannte Schlüssel ohnehin abgelehnt wurde); Suiten `presetapply-e2e.mjs`, `logrange-e2e.mjs`, `extchange-e2e.mjs` (32 von 96 Prüfungen rot: jede Seite zeigte die Änderung des Servers als ungespeicherte Änderung) und `wzicons-e2e.mjs` rot gegen 1.90.0. Dazu im Panel einmal die lokale Korrektur nach dem Speichern der Voreinstellungen entfernt (vor der Korrektur in `_fetch`): `presetapply-e2e` fand es |
| Panel-Suiten (`node run.mjs`, Desktop und Handy, DE und EN), alle 94 | Gesamtlauf am Endstand: 10178 Prüfungen bestanden, 0 fehlgeschlagen. Ein früherer Gesamtlauf, parallel zur Mutationsprobe und vor den Symbolen im Assistenten abgebrochen, hatte `dragscroll-e2e` einmal rot (Zeitgrenze unter Last); im Lauf am Endstand grün |
| Darstellung angesehen | Fenster "Voreinstellungen auf Sensoren anwenden" und die Zeile im Fenster der Voreinstellungen (Desktop und Handy, alle vier Zustände), Assistent vorher und nachher: Schritte Modi, Zuordnung und Eingang, Code, Meldungen, Überwachung, Fertig auf Desktop und Handy (Schloss der Alarmmeldung auf dem Handy zuerst zu tief, behoben) |
| Bilder | `presets-apply-de/en.png` neu, `log-de/en.png` neu (Zeitraum "Letzte 7 Tage"), verkleinert mit `optimize_images.py` (grösste Abweichung 5 bis 7, im Mittel 0.03 bis 0.20) und **jedes einzeln angesehen**; `cards-*.png`, die `readme-shots.mjs` immer mit aufnimmt, unverändert gelassen |
| Patch und `files/` | `git apply --index` des Patches auf einem frischen Klon @ `a3f8b80` ergibt genau den Baum des Lieferstands (Hash verglichen); `files/` enthält jede geänderte oder neue Datei ausser Bildern, Inhalt verglichen; ZIP unter 30 MB |

Nicht ausgeführt: HACS-Action und hassfest (nur in der CI), echte Hardware, echter Home Assistant mit Browser.
