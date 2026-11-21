# Übergabe 1.72.0 (2026-11-20)

Lieferung der externen Prüfstelle. Basis ist `main` @ `1aa5196` (Commit des Nutzers "1.71.0: …", Tag `v1.71.0` auf demselben Commit; vor dem
Packen auf GitHub geprüft: Baum gleich dem der Lieferung von 1.71.0, kein neuerer Tag).

Der Tag `v1.71.0` existiert, darum eine neue Version (Regel "Veröffentlichte Tags nie ändern"). **1.72.0** (Minor): neue Angaben der Statusentität
und der Statuskarte, geänderte Filter. `manifest.json` 1.72.0, `PANEL_VERSION` 236 auf 237.

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.72.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.72.0.md`) |
| `RELEASE-NOTES-1.72.0.md` | Release Notes Englisch (für das GitHub-Release, seit dem letzten Tag `v1.71.0`) und Deutsch |
| `1.72.0-auf-1.71.0.patch` | alle Änderungen als ein Patch gegen `main` @ `1aa5196` (diese Lieferung enthält keine Bilder) |
| `files/` | jede gegenüber `1aa5196` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand `1aa5196`), dann `git apply --index 1.72.0-auf-1.71.0.patch`, oder den Inhalt von `files/` über
das Repository kopieren und `git add -A` (keine Datei wird gelöscht). Neu ist nur dieses Protokoll. Danach die Prüfungen aus Abschnitt 4, Commit mit
Betreff `1.72.0: Filter der Sensoren nach Art, HealthCheck in der Statuskarte, Weitere Funktionen farbig`, Push auf `main`, Release-Angaben aus
Abschnitt 6. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass

Wünsche des Nutzers vom 2026-11-20, die ersten drei mit Bildschirmfoto:

- 13:56 (Handy, Fenster "Sensoren hinzufügen", Pillen Alle, Türen & Fenster, Bewegung, Weitere, Messwerte markiert): "Kannst du hier auch Filter-Pillen
  für Temperatur, Luftfeuchtigkeit, Helligkeit, Luftqualität anzeigen. Messwerte entfällt. Alles was nicht durch eine Pille abgedeckt ist, aber
  unterstützt werden würde, kommt unter die Pille "Weitere". Gibt es überhaupt weitere? Gas-Sensoren oder so? Es sollen nur die Pillen ersichtlich sein,
  für welche es in HA auch Geräte gibt."
- 14:45: "Für Wasser hätte ich ebenfalls gerne direkt eine Filter-Pille. Das kommt oft vor."
- 14:00 (Einrichtungsassistent "Weitere Funktionen" mit grauen Symbolen; Konfiguration › Anlage mit farbigen Symbolen): "kannst du hier die Icons
  ebenso farbig machen? zudem noch den Punkt mit den eigenen Tönen hinzufügen"
- 14:01 (Statuskarte auf einem Dashboard, Zeile "Selbsttest: keine Probleme" markiert): "bei der Dashboard-Karte hast du vergessen, den HealthCheck
  nachzuziehen"

## 2. Umsetzung

### Filter der Sensoren (13:56, 14:45)

- Pillen: Alle, Türen & Fenster, Bewegung, Wasser, Temperatur, Luftfeuchtigkeit, Helligkeit, Luftqualität, Weitere (`common.js SENSOR_FILTERS`,
  `sensorKind`). Wasser = Wassermelder (Geräteklasse `moisture`).
  "Messwerte" entfällt. Luftqualität: CO2, Feinstaub, VOC, AQI (und CO, NO2, Ozon, SO2, falls sie einmal angeboten werden; `AIR`).
- **"Weitere"** nimmt alles, was Alarmageddon unterstützt und keine eigene Pille hat. Unterstützt sind (Server `SENSOR_CLASSES`, `MEASURE_CLASSES`):
  Binärsensoren Rauch, Gas, Kohlenmonoxid, Hitze, Erschütterung, Sabotage, Sicherheit, Geräusch, Glasbruch, Schloss, Bewegung eines Geräts
  ("moving"); Messwerte Luftdruck. Antwort auf die Frage des Nutzers: ja, es gibt weitere.
- **Nur vorhandene Pillen** (`sensorFilters`): im Fenster "Sensoren hinzufügen" die Arten, die das Fenster anbieten kann (erkannt und noch nicht in
  der Liste, ohne Suche); in der Tabelle unter Konfiguration › Sensoren die Arten, die in der Tabelle stehen. "Alle" steht immer da. Fällt die gewählte
  Pille weg, gilt "Alle". Grund für "anbieten kann" statt "in HA vorhanden": eine Pille, deren Sensoren alle schon in der Liste stehen, zeigte eine
  leere Liste.
- Messwerte (und damit ihre Pillen) erscheinen wie bisher nur bei eingeschalteter Überwachung.
- Die Tabelle zeichnet ihre Pillen bei jedem Zeichnen nach (`.ag-senfilters` mit `display: contents`): kommt ein Sensor einer neuen Art dazu, erscheint
  ihre Pille sofort. Auch in der Tabelle die neuen Pillen, damit beide Stellen gleich filtern (vorher dieselben Pillen an beiden Stellen).
- `AIR` und `measureKind` stehen jetzt in `common.js` (vorher in `wizard.js`); der Assistent nutzt sie unverändert.

### "Weitere Funktionen" im Assistenten (14:00)

- Symbole in der Farbe ihres Kapitels unter Konfiguration › Anlage: Routinen violett, Codes pro Person türkis, Eigene Töne blau, HealthCheck rosa;
  die Dashboard-Karte hat kein Kapitel und bekommt hellblau (`ag-tint-card`).
- Neu "Eigene Töne": "Eigene Klänge hochladen (zum Beispiel eine Ansage) und in jedem Tonschritt wählen.", Ort "Konfiguration › Anlage › Eigene Töne".
  Reihenfolge wie die Kapitel: Routinen, Codes pro Person, Eigene Töne, HealthCheck, dann Dashboard-Karte.

### HealthCheck in der Statuskarte (14:01)

- **Server:** `HealthCheck.summary()` zählt die Dienste und ihren Zustand wie die Statuskachel des Panels (`ok`, `report` = Fehler gemeldet, `fail` =
  gescheitert; aus dem Zustand des Protokolls, sonst aus dem letzten Ergebnis). Die Statusentität (`sensor.<anlage>_status`) trägt die Zahlen als
  Attribute `healthcheck`, `healthcheck_ok`, `healthcheck_report`, `healthcheck_fail`. **Nur Zahlen, nie URL, Name oder Rechner** (Attribute stehen
  in jedem Dashboard und in der Aufzeichnung). Nach jedem Lebenszeichen und jeder Änderung der Liste `SIGNAL_HEALTHCHECK` (im `try`, hält kein
  Lebenszeichen auf); die Entität schreibt nur bei einer Änderung.
- **Karte:** sind Dienste eingerichtet (`healthcheck` > 0), ist die Zeile des Selbsttests geteilt wie in der Statuskachel des Panels: links
  "Selbsttest" mit Zustand (Zeit der letzten Prüfung im Tooltip), rechts "HealthCheck" mit Herz (grün in Ordnung, orange Fehler gemeldet, rot
  gescheitert, grau noch nichts gesendet). Ohne Pfeil, weil die Karte keine Fenster des Panels öffnet. Ohne Dienste und bei einem älteren Server
  wie bisher.
- Der Zustand der Anlage zählt nicht doppelt: ein gescheitertes Lebenszeichen ist wie bisher ein Befund des Selbsttests und zählt dort mit.

## 3. Änderungen

| Datei | Änderung |
| --- | --- |
| `manifest.json` | 1.72.0 |
| `const.py` | `PANEL_VERSION` 237, `SIGNAL_HEALTHCHECK` |
| `healthcheck.py` | `summary`, `_changed` (Signal nach jedem Lebenszeichen und nach `async_reconfigure`) |
| `sensor.py` | Statusentität: `_healthcheck`, Attribute `healthcheck*`, Zuhörer auf `SIGNAL_HEALTHCHECK` |
| `panel/common.js` | `AIR`, `measureKind`, `SENSOR_FILTERS`, `sensorKind`, `sensorFilters` |
| `panel/sensors.js` | Tabelle `_chosen`, `_filters` (Behälter `.ag-senfilters`); Fenster `_pickPool`, `_pickChips` |
| `panel/wizard.js` | `AIR`, `measureKind` aus `common.js`; `MORE` mit Farbe und "Eigene Töne" |
| `panel/card.js` | `_splitRow` |
| `panel/strings.js` | `wzMore_sounds`, `wzWhere_sounds` (EN/DE) |
| `panel/styles.js` | `.ag-senfilters`, `.ag-wz-moreic.ag-tint`, `.ag-tint-card` |
| `tests/test_healthcheck.py` | `test_the_status_entity_sums_up_the_services_without_their_address` (Zahlen nach Lebenszeichen, Fehlermeldung, Entfernen; keine URL, kein Name, kein Rechner in den Attributen; ohne das Signal rot gesehen) |
| `tests/panel/sim/card-sim.html` | `?hc=ok|fail|report|none`, `?hcn=N` |
| `tests/panel/suites/card-e2e.mjs` | geteilte Zeile je Zustand (Texte, Farbe, Tooltip, gleich breit, im Bild), mit Warnungen |
| `tests/panel/suites/monitor-e2e.mjs` | Pillen der Tabelle und des Fensters nach Art, nur vorhandene, Filter Temperatur, Luftfeuchtigkeit, Luftqualität, neue Pille nach dem Hinzufügen |
| `tests/panel/suites/pick-e2e.mjs` | Pillen des Fensters nur für vorhandene Arten (ohne Messwerte: Alle, Türen & Fenster, Bewegung, Wasser), Filter Wasser |
| `tests/panel/suites/wizard-e2e.mjs` | "Weitere Funktionen": fünf Zeilen in der Reihenfolge, Symbole farbig und verschieden |
| Doku | CHANGELOG EN/DE (1.72.0), MANUAL EN/DE (Sensoren und Zonen, Einrichtungsassistent, Dashboard-Karten), `CLAUDE.md`, `docs/DESIGN.md`, `docs/HANDOVER.md`, dieses Protokoll |

## 4. Prüfungen und Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py` | ohne Befund |
| `node --input-type=module --check` für jede Datei unter `panel/` | ohne Befund |
| JSON gültig, `strings.json` gleich `translations/en.json`, kein "ß" | ja |
| `pytest` mit Python 3.13 und Home Assistant 2026.2.3 | **1606 bestanden**, 6 übersprungen |
| `pytest` mit Python 3.14 und Home Assistant 2026.10.4 | **1606 bestanden**, 6 übersprungen |
| `python scripts/mutation_check.py` | **410 von 410 erkannt** |
| Panel: `node tests/panel/run.mjs` (alle Suiten, je Sprache, Desktop und Handy) | **72 von 73 Suiten bestanden, 8674 Prüfungen**; `dragscroll-e2e.mjs` siehe unten |
| Nach der Pille "Wasser" (14:45) erneut | `pick-e2e.mjs` 108, `monitor-e2e.mjs` 572, `groups-e2e.mjs` 98 bestanden; Dokutests bestanden |

**`dragscroll-e2e.mjs`:** im Gesamtlauf (parallel zur Mutationsprobe) gescheitert bei "das Gerät lässt sich so bis in die weit entfernte Liste
ziehen" (en/Desktop; danach bricht die Suite ab). Einzeln danach 6 Läufe: 5 bestanden (je 28 Prüfungen), einer scheiterte an derselben Stelle
(en/Handy). Zum Vergleich der Stand `v1.70.0` einzeln: 3 von 3 bestanden. Schon in der Lieferung 1.71.0 scheiterte dieselbe Prüfung einmal unter Last.
Die Lieferung ändert nichts am Editor der Aktionen oder am Ziehen (die Prüfung zieht einen Schritt mit automatischem Scrollen in eine weit entfernte
Liste); ich halte es für ein Zeitproblem des Tests, habe die Ursache aber nicht nachgewiesen. Offener Punkt in `docs/HANDOVER.md`.

README und Handbuch nennen "rund 8700 Prüfungen" (vorher 8600).

## 5. Nicht geprüft und bekannte Grenzen

- An einer echten Anlage nicht geprüft; nur in der Testumgebung von Home Assistant und im Nachbau (Computer und Handy, Deutsch und Englisch). Der
  Nachbau hat keine Helligkeits- und Luftdrucksensoren: dass "Helligkeit" ohne solche Sensoren fehlt, ist geprüft, die Pille mit Sensoren nur über
  dieselbe Rechnung wie die übrigen.
- Die Statuskarte zeigt die Dienste, sobald die Statusentität die neuen Attribute trägt (nach dem Update und Neustart); vorher wie bisher.
- Der Schritt "Sensoren" des Assistenten hat eigene Pillen (mit "Rauch & Wasser", nur Binärsensoren) und ist unverändert.

## 6. Release-Angaben

- Version, Tag und Titel: `v1.72.0`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.72.0.md`, seit dem letzten Tag `v1.71.0` (nur 1.72.0).
