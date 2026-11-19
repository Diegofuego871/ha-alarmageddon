# Übergabe 1.66.0 (2026-11-19)

Lieferung der externen Prüfstelle. Basis ist `main` @ `61735e7` (Tag `v1.65.0`; auf GitHub vor der Lieferung geprüft: kein neuerer Tag, `main`
unverändert). Der Baum von `61735e7` ist gleich dem der dritten Fassung von 1.65.0 (ZIP-Datei vom 2026-11-18, 23:23).

Die Arbeit begann als vierte Fassung von 1.65.0 (Anweisung des Nutzers vom Vortag: "in die gleiche Version, gleiche Lieferung"). Während der Arbeit
war `v1.65.0` auf GitHub getaggt (Commit 2026-11-18 23:10 UTC). Nach der Regel "Veröffentlichte Tags nie ändern" und "Neue Funktionen bekommen eine
neue Nummer" ist diese Lieferung **1.66.0**; der CHANGELOG-Abschnitt 1.65.0 und `docs/UEBERGABE-1.65.0.md` bleiben, wie sie veröffentlicht sind.
Dem Nutzer um 07:42 mitgeteilt.

`PANEL_VERSION` 229 (1.65.0) auf 230, `manifest.json` 1.66.0. Python: `selftest.py`, `healthcheck.py`, `settings.py`, `websocket_api.py`,
`notify.py`, `const.py`; ein neuer WebSocket-Befehl `selftest_checked`. Zuerst dieses Protokoll, dann `docs/HANDOVER.md` (Abschnitt 1.66.0) und
`CLAUDE.md` (Regeln "Selbsttest" und "HealthCheck").

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.66.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.66.0.md`) |
| `RELEASE-NOTES-1.66.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.66.0-auf-1.65.0.patch` | alle Änderungen als ein Patch gegen `main` @ `61735e7` (`v1.65.0`), mit den Bildern (binär) |
| `files/` | jede gegenüber `61735e7` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand `61735e7`), dann `git apply --index 1.66.0-auf-1.65.0.patch` oder den Inhalt von `files/` über
das Repository kopieren. Keine Datei ist zu löschen; neu ist nur `docs/UEBERGABE-1.66.0.md`. Danach die Prüfungen aus Abschnitt 4, Commit mit
Betreff `1.66.0: Selbsttest öfter bei scharfer Anlage und Liste "Geprüft", HealthCheck mit Namen, Farben der Kapitel, Inhalt des Backups, Batterieprognose der Liste`, Push auf `main`,
Release-Angaben aus Abschnitt 6. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Wünsche des Nutzers vom 2026-11-19, je mit einem Bildschirmfoto vom Handy (Stand: dritte Fassung von 1.65.0):

- 06:52 (Frage): Gilt der Zeitraum oben in der Sensoransicht auch für die Ereignisse unten? Antwort: ja, die Liste zeigt nur Ereignisse des
  gewählten Zeitraums. Angeboten, den Zeitraum im Text "keine Ereignisse" oder bei der Anzahl zu nennen; noch ohne Antwort, nicht gebaut.
- 06:57: "Schliessen" nicht ganz links, sondern neben dem anderen Knopf, wie überall (Fenster der HealthCheck-Dienste).
- 06:58: Selbsttest mit zwei Abständen, nicht scharf und scharf, gleiche Spanne (1 bis 24 Stunden).
- 06:59: dasselbe je HealthCheck-Dienst, auch in der Tabelle sichtbar. **07:42 zurückgenommen:** "ich glaube hier machen wir das nicht auch mit dem
  anderen Intervall bei scharfer Anlage. vergiss das wieder. beim selbsttest reicht es. dieser würde dann ja ein fail senden". Die Dienste behalten
  ein Intervall (das schon gebaute zweite ist wieder entfernt).
- 07:01: Liste auf dem Handy: die Knöpfe in einer eigenen Zeile darunter, im gewohnten runden Stil.
- 07:03: Name je Dienst als Pflichtfeld; die URL darf in der Liste abgeschnitten sein.
- 07:15: Fenster des Selbsttests: die Knöpfe gleich gross und nebeneinander wie in allen Fenstern.
- 07:18: Im Fenster des Selbsttests ein Pfeil, der ein Fenster darüber öffnet (X oben rechts, unten "Schliessen") mit allen geprüften
  Entitäten, je mit Name und grünem Zeichen, "das soll dem User die Sicherheit vermitteln, dass alles geprüft wird". 07:38 mit Bildschirmfoto
  der Karte "Keine Probleme gefunden": dort soll der Pfeil sein (so gebaut; dem Nutzer mit zwei Bildern bestätigt).
- 07:59: Die Symbole der Kapitel unter Konfiguration › Anlage je mit eigener, leichter Pastellfarbe, damit sich die Kapitel abheben; der
  Selbsttest bleibt grün; nur das Symbol, sonst ändert sich nichts.
- 08:01: Beim Backup ein Info-"i" zum Aufklappen, das beschreibt, was gesichert wird (zum Beispiel, dass das Protokoll nicht dazugehört).
- 08:04 (Fehler): In der Sensorliste steht bei manchen Geräten keine Batterieprognose ("–"), die Sensoransicht zeigt aber eine (Rauchmelder
  Küche "~71 Monate", Kühlschrank Küche "~16 Monate", Kühlschrank Reduit "~6 Monate", je bei "1 Jahr").

Eigene Entscheide der Prüfstelle (bitte prüfen):

1. **"Scharf"** heisst: irgendeine Anlage ist nicht deaktiviert (Ausgangsverzögerung, scharf, Eingangsverzögerung, Alarm), `selftest.any_armed`.
   Selbsttest und HealthCheck gelten für alle Anlagen gemeinsam; ist eine scharf, gilt der Abstand "scharf".
2. Standard des Selbsttests bei scharfer Anlage: **1 Stunde** (nicht scharf bleibt 6 Stunden).
3. Dienste aus 1.65.0 (ohne Namen, auch aus Backups) heissen wie der Rechner ihrer URL (zum Beispiel `hc-ping.com`); der Name hat 1 bis 60
   Zeichen, Leerraum wird zusammengefasst.
4. **Takt der Lebenszeichen** (10 Sekunden) statt eines Zeitgebers je Dienst: eingeführt für das zweite Intervall, behalten, weil er zwei
   Lebenszeichen kurz nacheinander verhindert (nach dem Speichern, nach einem Wechsel des Selbsttests) und ersetzt damit `HEALTHCHECK_DEDUP` aus
   1.65.0. Folge: ein Lebenszeichen geht bis zu 10 Sekunden nach Ablauf des Intervalls hinaus. Ein reguläres Lebenszeichen hebt ein nach einem
   Wechsel aufgeschobenes auf.
5. Die Liste **"Geprüft"** enthält alles, was der Selbsttest prüft, nicht nur Entitäten: Sensoren der Anlagen und der Überwachung, Geräte und
   Lautsprecher der Aktionen, Geräte, die Routinen auslösen, Aktionen (Dienste) und Empfänger. Grün = in der letzten Prüfung ohne Befund; ein
   Eintrag mit Befund erscheint mit Warnzeichen. Die Liste kommt auf Abruf vom Server (neuer Befehl `selftest_checked`, nur Administratoren),
   nicht mit den Daten, die das Panel alle 30 Sekunden holt; höchstens 2000 Einträge.
6. Die Liste "Geprüft" gibt es auch mit Befunden (eigene Karte unter den Befunden); im Kapitel HealthCheck und in der Statuskachel gibt es keinen
   eigenen Pfeil dafür (der Weg führt über das Fenster des Selbsttests).
7. Die Meldung eines gescheiterten Lebenszeichens nennt Name und Rechner (`Alle Anlagen: das Lebenszeichen "Healthchecks Haus" (hc-ping.com)
   ging nicht hinaus`), nie die URL.
8. **Farben der Kapitel:** Routinen violett, Codes pro Person türkis, eigene Töne indigo, HealthCheck-Dienste pink, Backup braun (beide
   Symbole des Kapitels: "Letztes Backup" und "Automatisches Backup"); Hintergrund 15 % der Farbe wie die übrigen Pastelltöne, im dunklen
   Thema hellere Töne. Nie Blau (Hauptfarbe), Grün, Gelb oder Rot (Zustände). Ein leeres Kapitel bleibt grau wie bisher (zum Beispiel
   "Noch kein Backup"). Das Kapitel "Modi" bleibt, wie es ist (seine Symbole sind Schalter je Modus, keine Kapitel-Symbole).
9. **"Was ist im Backup?"** steht über der Karte des Backups, im Stil von "Was prüft der Selbsttest?", zu; es bleibt offen, wenn die Seite
   neu gezeichnet wird. Der Inhalt ist aus `backup.async_export` abgelesen (welche Einstellungen in die Datei gehen) und nennt, was nicht
   dabei ist, und dass das Backup von Home Assistant selbst alles sichert.
10. **Batterieprognose der Liste:** rechnet jetzt wie die Sensoransicht bei "1 Jahr" (Langzeitstatistik eines Jahres, ab dem letzten
   Batteriewechsel), nicht wie bei deren Standard "90 Tage". Mit "30 Tage" oder "90 Tage" kann die Ansicht darum weiter eine andere Zahl
   oder "–" zeigen.
11. Die Spalte "Status" der Liste ist am Computer 190 statt 150 px breit (die Spalte "Intervall" 110 statt 150 px), damit der Status auf zwei
   statt drei Zeilen passt.

Ursache der fehlenden Prognose (08:04), zwei Gründe im Server, im Code nachgewiesen und mit Tests belegt; welcher bei welchem Gerät des Nutzers
greift, ist ohne seine Daten nicht sicher:

- `ws_battery_forecast` fragte nur die Sensoren der Zonen und "immer aktiv" an (`controller.all_sensors()`), die Liste zeigt aber auch die
  Messwerte der Überwachung und Sensoren nur in der Liste (`_chosen_sensors`). Deren Batterien bekamen nie eine Prognose. Vermutlich die
  Ursache bei den beiden Fühlern im Kühlschrank (Gruppe "Messwerte").
- `forecast.async_forecasts` las nur den Verlauf des Recorders der letzten 90 Tage; Home Assistant bewahrt ihn standardmässig 10 Tage auf.
  Eine Batterie, die so lange gleich steht (Rauchmelder Küche: 82 % seit Mai) oder zuletzt steigt, hat dort keinen Abfall: keine Prognose.
  Die Sensoransicht rechnet dagegen mit der Langzeitstatistik über den gewählten Zeitraum.

Behoben: die Liste fragt dieselben Sensoren an, die sie zeigt, und rechnet mit demselben Weg wie die Sensoransicht
(`sensor_history.async_battery_forecasts`, `battery_summary`, `FORECAST_HOURS` = 8760).

## 2. Änderungen

| Datei | Änderung |
| --- | --- |
| `const.py` | `DEFAULT_NOTIFY.selftest_hours_armed` 1; `HEALTHCHECK_TICK` 10 (ersetzt `HEALTHCHECK_DEDUP`); `HEALTHCHECK_NAME_MAX` 60; `PANEL_VERSION` 230 |
| `manifest.json` | Version 1.66.0 |
| `settings.py` | `valid_notify`: `selftest_hours_armed` 1 bis 24; `valid_healthcheck_name` (Leerraum zusammengefasst, 1 bis 60 druckbare Zeichen); `valid_healthchecks` mit `name` (fehlt er: Rechner der URL) |
| `selftest.py` | `any_armed(hass)`; `SelfTest.hours` nach Zustand; `payload` mit `hours_disarmed`, `hours_armed`, `armed`, `checked` (Anzahl); Liste "Geprüft": `_Collector.seen` beim Prüfen von Entitäten, Aktionen und Empfängern, `ok` = ohne Befund, in der Ablage (`checked`, beim Laden geprüft), `checked_payload()` mit Namen (`display_name`), entfernte Einträge gefiltert |
| `healthcheck.py` | Takt `_tick` alle `HEALTHCHECK_TICK`: fällig, wenn seit dem letzten Lebenszeichen ohne Testknopf das Intervall vergangen ist; ein reguläres Lebenszeichen hebt ein aufgeschobenes des Wechsels auf (`_later`); `async_reconfigure` sendet für neue und geänderte Einträge sofort; entfernte Einträge heben ihren Befund auf; Log und Befund mit Name und Rechner |
| `websocket_api.py` | `save_notify` mit `selftest_hours_armed`; `healthcheck_save` mit `name` (Pflicht, Fehler `invalid_name`); neuer Befehl `selftest_checked` (nur Administratoren) |
| `notify.py` | Meldung des gescheiterten Lebenszeichens mit Name und Rechner (EN/DE) |
| `panel/selftest.js` | Fusszeile "Schliessen" + "Jetzt prüfen" rechts nebeneinander; Kopf mit "(eine Anlage ist scharf)"; "Was prüft der Selbsttest?" nennt beide Abstände; runder Pfeil in der Karte "Keine Probleme gefunden" ("N Einträge geprüft"), mit Befunden eigene Karte; Fenster `#ag-stchecked` (Gruppen, Name, grünes Zeichen oder Warnzeichen, Suche, X oben, "Schliessen" unten, schliesst nur die Liste) |
| `panel/healthcheck.js` | Spalte "Dienst" mit Name, URL abgeschnitten (ganz im Tooltip), erkanntem Dienst und Zusatz; Knöpfe rund (44 px) in `.ag-wf-btns`; Fusszeile "Schliessen" neben "Dienst hinzufügen"; Standardsortierung nach Name; Formular: Name zuerst (Pflicht, Fokus); Rückfrage beim Entfernen mit dem Namen |
| `panel/system.js`, `panel/notify.js` | Kapitel HealthCheck: "Selbsttest alle" mit zwei Feldern (nicht scharf, scharf; auf dem Handy untereinander), gespeichert mit `save_notify` nur `selftest_hours` und `selftest_hours_armed`; der Entwurf der Benachrichtigungen sendet beide nie mit |
| `panel/alarmageddon-panel.js` | Fenster `#ag-stchecked`, Eingaben `data-st` an `selftest.onInput` |
| `panel/strings.js`, `panel/styles.js` | Texte EN/DE (`ivOff`, `ivOn`, `stArmedNow`, `hcColName`, `hcName`, `hcNamePh`, `hcErrName`, `hcErrNameLong`, `stChecked*`, `stG_*`; `stWhen`, `hcDeleteText`, `stT_ping_failed`, `stW_ping_failed` angepasst; `hcColUrl` entfernt); Stile `.ag-hcname`, `.ag-hcaddr`, `.ag-hcbtns`, `.ag-sthfs`, `.ag-st-chk*`, `.ag-st-checkedgo`; feste Spaltenbreiten der Liste; Handy: Zeilen als Flexbox, Knöpfe in eigener Zeile, erste Zeile klebt |
| `sensor_history.py`, `forecast.py` | `battery_summary` (Wechsel, je Tag, Tage bis zur Warnung) für Sensoransicht und Liste gleich; `async_battery_points` und `async_battery_forecasts` (Statistik eines Jahres, Fehler je Sensor abgefangen); `forecast.py` behält nur `forecast_days` (die Abfrage des Verlaufs fällt weg) |
| `websocket_api.py` (Prognose) | `battery_forecast` fragt die Sensoren der Liste an (`_chosen_sensors`) und rechnet über `async_battery_forecasts` |
| `panel/routines.js`, `panel/system.js`, `panel/healthcheck.js`, `panel/styles.js` | Farben der Kapitel: `ag-tint ag-tint-<kapitel>` mit `--ag-tint` (hell und dunkel); "Was ist im Backup?" (`<details class="ag-st-about ag-bk-about">`, `bkAboutOpen`, Klick `data-sys="bk-about"`) |
| `panel/strings.js` | dazu `bkAbout`, `bkAboutText` (EN/DE) |
| `tests/panel/sim/ha-sim.html` | Dienste mit Namen, `healthcheck_save` prüft den Namen und lehnt ein zweites Intervall ab; `selftest_checked` (13 erfundene Einträge); `selftestPayload()` rechnet `armed`, `hours` und `next` wie der Server aus dem Zustand der Anlagen ("Haus" ist scharf; letzte Prüfung vor 20 Minuten statt 2 Stunden) |
| Tests | `test_healthcheck.py` (Name, kein zweites Intervall, aufgeschobenes Lebenszeichen, entfernter Dienst), `test_selftest.py` (Abstand scharf, Liste "Geprüft", `valid_notify`), `test_security.py` (`selftest_checked` in `COMMANDS`, Geheimnisse auch für `selftest_checked`, HealthCheck-Speichern, -Test, Export und Ablage); `mutation_check.py`: neu "Selbsttest" scharf, "Geprüft" grün; "HealthCheck" Takt, aufgeschobenes Lebenszeichen, Name Pflicht, entfernter Dienst; die Zeile zu `HEALTHCHECK_DEDUP` entfällt; "Batterieprognose" Zeitraum und angefragte Sensoren; `test_forecast.py` (Liste und Ansicht gleich, Messwerte der Überwachung mit Prognose); Suiten `healthcheck-e2e.mjs` (dazu Farben der Kapitel), `selftest-e2e.mjs`, `autobackup-e2e.mjs` ("Was ist im Backup?") |

Beim Bauen gefunden und behoben: im Nachbau stand der Selbsttest immer auf "alle 6 Stunden", obwohl "Haus" scharf ist (das Bild `selftest`
zeigte einen Zustand, den es mit dem Server nicht gibt); jetzt wie der Server. Die Knöpfe der Liste waren am Computer auf 43 px gequetscht
(Spalte jetzt 232 px breit); der klebende Tabellenkopf funktionierte auf dem Handy mit Flexbox-Zeilen nicht (jetzt klebt die erste Zeile).

## 3. Doku

- `CHANGELOG.md`, `CHANGELOG.de.md`: neuer Abschnitt 1.66.0 mit Link-Fussnote; 1.65.0 unverändert wie veröffentlicht.
- `docs/MANUAL.md`, `docs/MANUAL.de.md`: Selbsttest (zwei Abstände, Liste "Geprüft"), HealthCheck (Name, Liste, ein Intervall), Zahlen und
  Grenzen, Backup (was enthalten ist), Batterieprognose (Quelle und Zeitraum).
- `README.md`, `README.de.md`: Selbsttest (öfter bei scharfer Anlage, Liste), HealthCheck (Name, Bildtext), Zahlen der Tests.
- `CLAUDE.md`: Regeln "Selbsttest" (zweiter Abstand, Liste "Geprüft" nie in `data`) und "HealthCheck" (Name, ein Intervall, Takt).
- `docs/DESIGN.md`: Kapitel HealthCheck, Liste der Dienste, Formular, Farben der Kapitel, "Was ist im Backup?". `docs/HANDOVER.md`: Abschnitt 1.66.0.

## 4. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1542 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1542 bestanden, 6 übersprungen |
| `python scripts/mutation_check.py` | 368 Zeilen: voller Lauf 366 von 366 erkannt (vor der Prognose); danach zwei Zeilen dazu (Batterieprognose: Zeitraum, angefragte Sensoren) und alle 62 Zeilen der danach geänderten Dateien `sensor_history.py`, `websocket_api.py`, `forecast.py` erneut: 62 von 62 erkannt |
| `cd tests/panel && node run.mjs` | 68 Suiten, 7425 Prüfungen, alle bestanden (im Lauf davor, parallel zur Mutationsprobe, schlug in `dragscroll-e2e.mjs` eine Prüfung unter Last einmal fehl; allein und im letzten Lauf grün) |
| `node --input-type=module --check` für alle Dateien unter `panel/` | ohne Fehler |
| `tests/test_translations.py` (README, CHANGELOG, Handbuch EN/DE gleich aufgebaut) | bestanden |
| Patch auf `61735e7` in einem sauberen Arbeitsbaum angewendet, mit `files/` und dem Arbeitsstand verglichen | identisch (beim Packen geprüft) |

Suiten: `selftest-e2e.mjs` (156 Prüfungen) mit zwei Abständen im Kapitel (gültig, ungültig 25, nur diese Werte an den Server), Kopf "jede
Stunde (eine Anlage ist scharf)" und nach dem Deaktivieren "alle 6 Stunden" ohne den Hinweis, Fusszeile "Schliessen" neben "Jetzt prüfen",
Liste "Geprüft" (Pfeil mit Anzahl, Fenster über dem Selbsttest, vom Server auf Abruf, Gruppen, Namen, alles grün, Suche mit Fokus, "Schliessen"
schliesst nur die Liste; mit Befunden Sirene und alter Empfänger nicht grün), Befund `ping_failed` mit Name. `healthcheck-e2e.mjs` (164): Name
als Pflichtfeld mit Fokus, ein Intervall (kein zweites Feld, kein `interval_armed` an den Server), URL gekürzt mit Tooltip, vier runde Knöpfe
(44 px), auf dem Handy in eigener Zeile, Fusszeile "Schliessen" neben "Dienst hinzufügen", Rückfrage beim Entfernen mit dem Namen, Farben der
Kapitel (fünf verschiedene, nie Blau oder Grün, Selbsttest grün, Zeile unverändert). `autobackup-e2e.mjs` (112): "Was ist im Backup?" zu, mit
Info-Symbol über der Karte, aufgeklappt mit "Nicht enthalten" samt Protokoll und Codes, bleibt beim Neuzeichnen offen, zweiter Klick schliesst.
`test_forecast.py`: Liste und Sensoransicht rechnen gleich (ein Jahr), die letzten 10 Tage allein hätten keine Prognose ergeben; ein Messwert
nur der Überwachung bekommt eine Prognose.

**Bilder:** neu aufgenommen `healthcheck-list` (Name, gekürzte URL, ein Intervall, runde Knöpfe, "Schliessen" rechts), `healthcheck` und
`sounds` (Kapitel mit zwei Abständen des Selbsttests, Farben der Kapitel), `routines` (Farbe im Hintergrund), `selftest` (Kopf "jede Stunde
(eine Anlage ist scharf)", Fusszeile), je EN und DE. Alle
übrigen Bilder sind byteweise unverändert (nach `scripts/optimize_images.py` mit den Pixeln verglichen und, wo gleich, die bisherige Datei
zurückgelegt; Bilder, die sich nur in der Uhrzeit unterschieden, ebenfalls zurückgelegt).

## 5. Nicht geprüft und bekannte Grenzen

- **Echte Geräte, echte Dienste und Home Assistant 2026.11** nicht geprüft (Prüfumgebung ohne Zugang nach aussen; HealthCheck mit dem Nachbau
  von aiohttp und im Panel-Nachbau). Der Vorschlag für Uptime Kuma (`?status=down`) bleibt aus dem Format der Push-URL abgeleitet.
- **Liste "Geprüft" nach dem Update:** bis zur ersten Prüfung mit 1.66.0 (wenige Minuten nach dem Start von Home Assistant oder mit "Jetzt
  prüfen") ist sie leer ("Noch nichts geprüft"); die Ablage von 1.65.0 kennt sie nicht.
- **Wechsel auf "scharf" beim Selbsttest:** wirkt mit dem nächsten Takt (höchstens 5 Minuten). Ist die letzte Prüfung älter als der Abstand
  "scharf", läuft er dann sofort.
- **"Scharf" für alle:** ist eine einzige Anlage scharf, gilt für den Selbsttest der Abstand "scharf", auch wenn andere Anlagen deaktiviert sind.
- **Lebenszeichen:** gehen bis zu 10 Sekunden nach Ablauf des Intervalls hinaus (Takt). Beim Dienst die Periode und die Karenzzeit wie bisher
  etwas länger als das Intervall einstellen.
- **Release `v1.65.0`:** ob es als Vorabversion oder offiziell veröffentlicht ist, liess sich aus der Prüfumgebung nicht lesen (GitHub-API
  gesperrt); geprüft ist nur der Tag.
- **Batterieprognose:** Ob bei den Geräten des Nutzers jetzt überall eine Prognose steht, ist nicht geprüft (nur mit Nachbau und Tests). Ohne
  Langzeitstatistik (Sensor ohne `state_class`) bleibt nur der Verlauf, dann wie bisher meist 10 Tage. Ein Sensor, dessen Batterie nicht
  fällt, bekommt weiterhin keine Prognose ("–"). Die Liste holt die Prognose höchstens einmal je Stunde; nach dem Update also erst beim
  nächsten Öffnen des Panels.
- **Sensoransicht** (Frage 06:52): der Zeitraum gilt für Grafik und Ereignisse; ob er im Text "keine Ereignisse" oder bei der Anzahl genannt
  werden soll, ist offen.

## 6. Release-Angaben

- Version, Tag und Titel: `v1.66.0`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.66.0.md` (Abschnitt 1.66.0; seit dem letzten veröffentlichten Tag `v1.65.0`).
- `PANEL_VERSION` 229 auf 230, `manifest.json` 1.66.0. Neuer WebSocket-Befehl: `selftest_checked` (nur für Administratoren, in
  `tests/test_security.py COMMANDS`).
