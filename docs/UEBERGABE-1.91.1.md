# Übergabe 1.91.1 (2026-11-25): "Auf Sensoren anwenden" immer sichtbar

Auftrag des Nutzers an den Agenten, der hochlädt. **Baut auf `main` @ `e82c914` auf** (= Tag `v1.91.0`, geprüft auf GitHub am 2026-11-25). Zuerst
diese Datei lesen, dann `docs/HANDOVER.md` (Abschnitt 1.91.1).

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.91.1.zip` enthält:

- `UEBERGABE-1.91.1.md` (dieses Protokoll, liegt auch unter `docs/`), `RELEASE-NOTES-1.91.1.md` (Englisch und Deutsch),
- `1.91.1-auf-main-e82c914.patch`: `git diff --binary` von `e82c914` (heutiger Stand von `main`) auf 1.91.1,
- `files/`: jede Datei, die sich gegenüber `e82c914` geändert hat oder neu ist, vollständig (diese Lieferung ändert keine Bilder).
- Keine Datei wird gelöscht.

Anwenden (zuerst `git log -1` prüfen, `main` muss auf `e82c914` stehen):

1. `git apply --index 1.91.1-auf-main-e82c914.patch` (geprüft: lässt sich auf `e82c914` anwenden und ergibt genau den Stand dieser Lieferung).
2. Nur falls der Patch nicht passt (`main` hat sich bewegt): den Inhalt von `files/` über das Repository kopieren, dann `git add -A`.

Danach die Prüfungen aus `CLAUDE.md`, Commit `1.91.1: "Auf Sensoren anwenden" immer sichtbar`, Push auf `main`. Tag und Release legt der Nutzer an
(Ziel `main`, keine Vorabversion).

**Release Notes:** `RELEASE-NOTES-1.91.1.md`, nur 1.91.1 (der letzte veröffentlichte Tag ist `v1.91.0`), Englisch für das Release und Deutsch.

## 1. Auftrag (Meldung des Nutzers vom 2026-11-25, 22:27)

Bildschirmfoto des Fensters "Voreinstellungen je Sensorart" auf dem Handy (1.91.0) ohne die Zeile "Auf Sensoren anwenden": "Hier fehlt der button, um
die einstellungen zu vererben mit den neuen popup".

## 2. Ursache und Änderung

- **Ursache:** in 1.91.0 erschien die Zeile nur, wenn mindestens ein Sensor eigene Werte hat, die von den Voreinstellungen abweichen (so im Mockup
  `voreinstellungen-anwenden-v1` beschrieben). Beim Nutzer gibt es offenbar keinen solchen Sensor; ob der frühere Schalter "Auf alle Sensoren
  anwenden" die eigenen Werte schon gelöscht hatte, lässt sich von hier nicht prüfen. Bis 1.90.0 stand der Schalter immer da, darum wirkte die
  Funktion verschwunden. Ein Fehler in der Berechnung (`applyDiffs`) ist nicht belegt: die Schlüssel der echten Antwort (`sensor_options`,
  `sensor_modes`, `type` je Sensor) sind dieselben wie im Nachbau.
- **Änderung:** die Zeile steht immer da (`sensors.js _applyRowHtml`). Ohne Abweichung: Hinweis "Alle Sensoren folgen diesen Voreinstellungen:
  keiner hat eigene Werte, die davon abweichen." (`presetsApplyNone`, EN/DE), Knopf "Sensoren wählen (0)" gesperrt. Ändert man im Fenster eine
  Voreinstellung so, dass ein eigener Wert abweicht, wird der Knopf frei (die Zeile rechnet bei jeder Änderung neu, wie in 1.91.0).
- Version 1.91.1, `PANEL_VERSION` 301; CHANGELOG (EN/DE), Handbuch (EN/DE), `CLAUDE.md`, `docs/HANDOVER.md`. Keine Änderung am Server.

## 3. Risiken und Grenzen

- Keine Verhaltensänderung beim Speichern; nur die Anzeige der Zeile. Nicht auf echter Hardware und nicht in einem echten Home Assistant mit Browser
  geprüft.

## 4. Prüfungen dieser Lieferung

Alle Läufe am Stand der Dateien in `files/`, am 2026-11-25 in dieser Session ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Meldung |
| `node --input-type=module --check` aller Panel-Dateien, `node --check` der geänderten Suite, JSON gültig, `strings.json` = `translations/en.json`, kein "ß" und keine typografischen Anführungszeichen in den geänderten Texten | in Ordnung |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1817 bestanden, 6 übersprungen. Ein erster Lauf parallel zur Mutationsprobe hatte 11 Fehler, weil die Probe gerade `workflow.py` verändert hatte; er zählt nicht, wiederholt nach der Probe |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1817 bestanden, 6 übersprungen (ebenso wiederholt; der Lauf parallel zur Probe hatte 6 Fehler) |
| Mutationsprobe (`python -u scripts/mutation_check.py`, voller Lauf) | 518 von 518 erkannt; danach ist der Arbeitsbaum unverändert (geprüft mit `git status`) |
| Geänderte Suite gegen den Stand 1.91.0 (`git archive e82c914`) | `presetapply-e2e.mjs` rot in der neuen Prüfung "ohne Abweichung: Zeile mit Hinweis und gesperrtem Knopf" (die Zeile fehlt dort) |
| Panel-Suiten (`node run.mjs`, Desktop und Handy, DE und EN), alle 94 | 10190 Prüfungen bestanden, 0 fehlgeschlagen (`presetapply-e2e` 140, `layout-e2e` 298) |
| Darstellung angesehen | Fenster "Voreinstellungen je Sensorart" ohne Abweichung: Handy dunkel und Desktop hell, Zeile mit Symbol, Hinweis und gesperrtem Knopf |
| Patch und `files/` | `git apply --index` des Patches auf einem frischen Klon @ `e82c914` ergibt genau den Baum des Lieferstands (Hash verglichen); `files/` enthält jede geänderte oder neue Datei, Inhalt verglichen; ZIP unter 30 MB |

Nicht ausgeführt: HACS-Action und hassfest (nur in der CI), echte Hardware, echter Home Assistant mit Browser.
