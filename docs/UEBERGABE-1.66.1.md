# Übergabe 1.66.1 (2026-11-19)

Lieferung der externen Prüfstelle. Basis ist `main` @ `aa79129` (Tag `v1.66.0`; auf GitHub vor der Lieferung geprüft: kein neuerer Tag, `main`
unverändert). Der Baum von `aa79129` ist gleich dem der Lieferung von 1.66.0 (ZIP-Datei von 08:49).

Die Arbeit begann als Nachtrag zu 1.66.0. Vor dem Packen zeigte GitHub `v1.66.0` getaggt; nach der Regel "Veröffentlichte Tags nie ändern" ist
diese Lieferung **1.66.1** (Patch: Darstellung und eine Korrektur, keine neue Funktion). Der CHANGELOG-Abschnitt 1.66.0 und
`docs/UEBERGABE-1.66.0.md` bleiben, wie sie veröffentlicht sind.

Diese Fassung ersetzt die ZIP-Datei `alarmageddon-1.66.1.zip` von 10:55 vollständig (dazu die Wünsche von 11:08). Gleiche Basis, gleiche
Version; die frühere ZIP-Datei verwerfen.

`PANEL_VERSION` 230 (1.66.0) auf 231, `manifest.json` 1.66.1. Python: nur `sensor_history.py` (Zahl der Ereignisse) und diese beiden Werte.

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.66.1.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.66.1.md`) |
| `RELEASE-NOTES-1.66.1.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.66.1-auf-1.66.0.patch` | alle Änderungen als ein Patch gegen `main` @ `aa79129` (`v1.66.0`) |
| `files/` | jede gegenüber `aa79129` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand `aa79129`), dann `git apply --index 1.66.1-auf-1.66.0.patch` oder den Inhalt von `files/` über
das Repository kopieren. Keine Datei ist zu löschen; neu ist nur `docs/UEBERGABE-1.66.1.md`. Danach die Prüfungen aus Abschnitt 3, Commit mit
Betreff `1.66.1: Gleiche Knöpfe in allen Listen, Stift in der Sensortabelle, Zahl der Ereignisse des Zeitraums`, Push auf `main`, Release-Angaben aus Abschnitt 5. Die
Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Wünsche des Nutzers vom 2026-11-19, je mit einem Bildschirmfoto:

- 10:13 (Fenster "Codes pro Person"): die Knöpfe "machen es ebenfalls falsch"; die Spalte "Code" streichen, sie zeigte nur "••••••" und "hat
  absolut keinen Sinn".
- 10:13 (Fenster "Eigene Töne"): "Hier sind die Buttons ebenfalls falsch. Mach das gleich wie überall."
- 10:14 (Fenster "Backups"): "Auch hier sind die Buttons falsch. Das gleiche hier überall an. Dann haben wir ein Konzept, das überall gleich ist."
- 11:08 (Sensortabelle unter Konfiguration › Sensoren): "Erstens, diese Tabelle zeigt auf dem Desktop das Löschsymbol an, auf dem Handy nicht.
  Daher soll Sie nur auf dem Desktop das Löschsymbol, den Papierkorb, auch im runden Design bekommen und auch der Pfeil soll neu im gleichen Design
  ein Bleistift werden zum Editieren. Diesen Bleistift übernehmen wir auch bei der Handyansicht so."
- 11:08 (Sensoransicht): "der Tab oben, wo man den Zeitraum festlegen kann, soll bei den Ereignissen die Zahl filtern, sowie auch die
  angezeigten Ereignisse. Das soll übereinstimmen. Also die Zahl, die unten angezeigt wird, ist nie das Total, sondern immer entspricht immer den
  gewählten Filter oben."

Eigene Entscheide der Prüfstelle (bitte prüfen):

1. **Knöpfe je Zeile** überall `.ag-wf-btns` (rund, 44 px, Rand) wie bei Routinen, Regeln und HealthCheck-Diensten.
2. **Backups auf dem Handy:** drei runde Knöpfe neben Name und Datum ragten aus der Karte; darum wie bei den HealthCheck-Diensten eine eigene Zeile
   darunter. Codes: zwei Knöpfe passen neben Name und Benutzer (auch bei 320 px). Töne: wie bisher unter dem Namen.
3. **"Schliessen" im Fenster der Backups** war blau, jetzt weiss wie in allen anderen Fenstern (aus "ein Konzept, das überall gleich ist"; der
   Nutzer hat es nicht ausdrücklich verlangt, leicht zurückzustellen).
4. **Nicht geändert:** Symbole in Formularen und Kopfzeilen (Stift beim Namen der Anlage, Kopieren, Entfernen einer Bedingung, Verschieben in
   "Ansicht", Export des Protokolls): keine Zeilen-Knöpfe einer Liste.
5. **Sensortabelle:** Papierkorb und Stift in derselben Grösse wie überall (44 px, `.ag-wf-btns`), Stift ganz rechts. Auf dem Handy nur der
   Stift; er braucht mehr Platz als der alte Pfeil (24 px), darum brechen lange Namen bei 390 px früher um (z. B. "Rauchmelder Flur"). Kein
   seitliches Scrollen, auch bei 320 px. Eine kleinere Fassung nur für das Handy wäre eine Ausnahme vom Konzept "überall gleich"; nicht gebaut.
6. **Zahl der Ereignisse:** Die Zahl folgte schon dem gewählten Zeitraum (3 h bis 30 Tage), war aber bei mehr als 300 Ereignissen im Zeitraum
   auf 300 gekappt, die Länge der Liste. Jetzt liefert der Server die Zahl des Zeitraums (`events_total`), die Liste zeigt weiter höchstens die
   neuesten 300 (Leistung) und sagt darunter "Es werden die neuesten 300 von N Ereignissen im Zeitraum gezeigt". Gilt für Ja/Nein-Sensoren und
   für Messwerte der Überwachung.
7. **Bekannte Grenze, nicht geändert:** Liste und Zahl stammen aus dem Verlauf von Home Assistant (Standard 10 Tage). Bei "30 Tage" fehlen
   ältere Ereignisse in Liste und Zahl gleichermassen; der bestehende Hinweis "Die Liste reicht bis zum …" sagt das. Die Kennzahlen über der
   Grafik (z. B. "175× geöffnet") kommen aus der eigenen Stundenstatistik von Alarmageddon (`SensorStats.buckets`) und decken den ganzen
   Zeitraum ab; sie zählen zudem nur Öffnungen (keine Ausfälle). Sie können darum von der Zahl auf dem Reiter abweichen.

## 2. Änderungen

| Datei | Änderung |
| --- | --- |
| `panel/system.js` | Codes: Spalte "Code" entfernt, Knöpfe `.ag-wf-btns.ag-codebtns`; Töne: Knöpfe `.ag-wf-btns.ag-csbtns`; Backups: Knöpfe `.ag-wf-btns.ag-bkbtns`, "Schliessen" `ag-btn` statt `ag-btn primary` |
| `panel/styles.js` | `.ag-codebtns`, `.ag-csbtns`, `.ag-bkbtns`; Backups auf dem Handy als Flex-Zeilen (Name und Datum oben, Knöpfe darunter, erste Zeile klebt); Regeln für die Spalte "Code" und die kleinen 34-px-Knöpfe entfernt |
| `panel/sensors.js` | Sensortabelle: am Ende jeder Zeile `.ag-wf-btns.ag-senbtns` mit rundem Papierkorb (nur Computer) und rundem Stift `data-sen="detail"` statt Pfeil `.ag-cbtn` |
| `panel/sensorview.js` | Zahl auf dem Reiter "Ereignisse" aus `events_total` (Zustand und Messwert), Hinweis `svListTruncated` mit gezeigt und Total |
| `sensor_history.py` | Antwort mit `events_total`; `monitor_events` kappt nicht mehr, `async_measure_history` schneidet auf `EVENTS_MAX` und zählt |
| `panel/strings.js` | `codeColCode`, `codeHidden` entfernt; neu `editSensor`; `svListTruncated` mit `{shown}` und `{total}` (EN/DE) |
| `const.py`, `manifest.json` | `PANEL_VERSION` 231, Version 1.66.1 |
| Nachbau | `tests/panel/sim/ha-sim.html`: Ereignisse nach Zeitraum gefiltert, `?svmany=1` (alle 30 min ein Ereignis), `events_total` |
| Tests | `codes-e2e.mjs` (keine Spalte "Code", kein Platzhalter, runde Knöpfe), `customsounds-e2e.mjs` (runde Knöpfe), `hardening-e2e.mjs` (Backups: drei runde Knöpfe in der Karte, Handy darunter), `layout-e2e.mjs` und `pick-e2e.mjs` (Sensortabelle: Stift rund, kein Pfeil, Papierkorb nur am Computer), `svrules-e2e.mjs` (Zahl gleich Zeilen, folgt dem Zeitraum; mehr als 300: Zahl des Zeitraums, 300 Zeilen, Hinweis mit beiden Zahlen), `test_measure_history.py`, `test_sensor_history_recorder.py` |
| `scripts/mutation_check.py` | zwei Zeilen "Sensoransicht: Zahl der Ereignisse ist die Obergrenze der Liste …" (Verlauf, Überwachung) |
| Doku | CHANGELOG (Abschnitt 1.66.1 mit Fussnote: Geändert und Behoben), MANUAL EN/DE (Codes, Sensoren und Zonen, Sensoransicht), `CLAUDE.md` (Codes, Pfeile, Sensoransicht), `docs/DESIGN.md` (Knöpfe in Fenstern mit Liste, Sensortabelle), `docs/HANDOVER.md` (Abschnitt 1.66.1) |
| Bilder | `docs/img/sensors-en.png`, `sensors-de.png`, `step-sensors-en.png`, `step-sensors-de.png` (runde Knöpfe statt Pfeil) |

## 3. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1543 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1543 bestanden, 6 übersprungen |
| `cd tests/panel && node run.mjs` | 68 Suiten, 7438 Prüfungen, alle bestanden (Stand dieser Lieferung) |
| `python scripts/mutation_check.py` (Zeilen von `sensor_history.py`) | 9 von 9 erkannt, darunter die zwei neuen; gesamt 370 Zeilen (1.66.0: 368). Die übrigen Dateien sind seit 1.66.0 unverändert |
| Patch auf `aa79129` in einem sauberen Arbeitsbaum angewendet, mit `files/` und dem Arbeitsstand verglichen | identisch (beim Packen geprüft) |

Bilder der README: mit `ONLY=sensors,step-sensors,sensor node readme-shots.mjs` neu aufgenommen, `scripts/optimize_images.py`, danach jede
Datei mit pixelgleichem Inhalt zurückgesetzt. Geändert sind nur die vier Bilder der Sensortabelle; `sensor-*.png` und `cards-*.png` wichen
nur in Uhrzeit und Datum des Nachbaus ab und sind unverändert geblieben.

## 4. Nicht geprüft und bekannte Grenzen

- An einer echten Anlage nicht geprüft; nur im Nachbau auf Computer und Handy (390 px, Codes und Sensortabelle auch 320 px).
- Zahl der Ereignisse: siehe Abschnitt 1, Punkt 7 (Verlauf von Home Assistant, Standard 10 Tage).

## 5. Release-Angaben

- Version, Tag und Titel: `v1.66.1`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.66.1.md` (Abschnitt 1.66.1; seit dem letzten veröffentlichten Tag `v1.66.0`).
