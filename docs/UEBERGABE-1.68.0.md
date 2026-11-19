# Übergabe 1.68.0 (2026-11-19)

Lieferung der externen Prüfstelle. Basis ist `main` @ `321ff98` (Tag `v1.67.0`; auf GitHub vor der Lieferung geprüft: kein neuerer Tag, `main`
unverändert). Der Baum von `321ff98` ist gleich dem der Lieferung von 1.67.0.

Neue Funktionen, darum **1.68.0** (Minor). `manifest.json` 1.68.0, `PANEL_VERSION` 232 auf 233.

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.68.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.68.0.md`) |
| `RELEASE-NOTES-1.68.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.68.0-auf-1.67.0.patch` | alle Änderungen als ein Patch gegen `main` @ `321ff98` (`v1.67.0`) |
| `files/` | jede gegenüber `321ff98` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand `321ff98`), dann `git apply --index 1.68.0-auf-1.67.0.patch` oder den Inhalt von `files/` über
das Repository kopieren. Keine Datei ist zu löschen; neu sind unter anderem `healthcheck_log.py`, `panel/healthlog.js`, zwei Testdateien, zwei
Suiten, drei Ordner mit Mockups und die Bilder `healthcheck-log-*.png` (vollständige Liste in Abschnitt 2). Danach die Prüfungen aus Abschnitt 3,
Commit mit Betreff `1.68.0: Protokoll und Meldungen der HealthCheck-Dienste, Statuskachel mit den Diensten, Batterie schwach erst nach mehreren Prüfungen`, Push auf `main`, Release-Angaben aus
Abschnitt 5. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Wünsche und Entscheide des Nutzers vom 2026-11-19:

- 17:06, mit Bildschirmfotos (Liste der Dienste, Ansicht eines Anbieters, Sensoransicht eines Kühlschranks): je Dienst ein Symbol, das ein
  Protokoll öffnet; oben ein Dropdown zum Wechseln; der gewohnte Zeitraum; eine Grafik wie bei Batterie und Empfang; unten eine Liste, die
  standardmässig nur Fehler und Ereignisse zeigt. "Das Design soll wirklich genau gleich sein, als würde ich auf ein Gerät gehen." Mockup
  `docs/mockups/healthcheck-protokoll-v1/`.
- 17:31, auf v1: "könnte man nicht A und B kombinieren … 3 Stunden, 12 Stunden, ein Tag wie A ist und darüber etwas wie B." Zur Antwortzeit:
  "gefällt mir so sehr gut. Das bitte genauso umsetzen." Mockup `-v2/`.
- 17:48, auf v2: "1. vorschlag 1 / 2. ältere nur zusammengefasst, / 3. passt / denkt daran, die Ereignisse darunter genau gleich zu filtern, wie
  oben gewählt ist. Das gilt auch für die einzelnen aufrufe."
- 18:24, mit dem Bildschirmfoto der Kachel "Batterie" (30 Tage, 90 Tage, 1 Jahr): "Ich glaube, es würde doch Sinn machen, auch 90 Tage und ein Jahr
  anzubieten. Bei Ausfällen möchte man vielleicht schon eine Langzeitstatistik haben." Mockup `-v3/`.
- 18:35: "Genau, mach es so. Ich bin mit allen 4 Vorschlägen einverstanden." (Variante B, Tageswerte und Ereignisse ein Jahr, sieben Tasten auf dem
  Handy in einer Zeile, Lücke ab 30 Minuten.)
- 18:36: "Falls externe Dienste eingerichtet sind, möchte ich den unteren Teil dieser Kachel, ohne dass sie länger wird, in der Mitte halbieren.
  Links die Self-Tests und rechts die externen Tests. Je mit einem entsprechenden Symbol, die zeigen, ob alles grün ist … Macht das ohne Mockup."
  Und: "Wenn jedoch die Dienste nicht aktiv sind, sieht es aus wie heute. Es lädt nicht ein, etwas einzuladen."
- 18:42, mit dem Bildschirmfoto der Meldung "Selbsttest" unter Benachrichtigungen: "Hier bräuchte es unter Wartung noch einen weiteren Punkt, welcher
  die Mitteilung konfiguriert, wenn der Health-Dienst keine Antwort mehr gibt." Und: "Die Option dafür kannst du immer anzeigen, unabhängig davon, ob
  einer konfiguriert ist oder nicht."
- 18:43: "Mach ein Setting mit der Anzahl Polls, die fehlschlagen dürfen, bis die Meldung rausgeht, und es sind zwei Meldungen, eine für schlecht
  und eine wieder gut, die man mit den gewohnten Konfigurationen inklusive kritisch, was man möchte, Text, alles konfigurieren kann, Lautstärke …
  Mach dafür einen neuen Abschnitt für die externen Health-Dienste … Noch Fragen?"
- 19:38, mit Bildschirmfotos (Meldung "Wartung: Kühlschrank Küche Temperatur … Batterie 1 %" um etwa 19:33, Batterieansicht desselben Sensors mit
  61 %): "Ich habe heute eine Push-Mail bekommen, dass die Batterie leer ist. Ich denke, das war eine kleine Schwankung. Kannst du da irgendwas
  einbauen, dass die Batteriemeldung nur kommt, wenn der Status wirklich über mehrere Abfragen hinweg so besteht?"
- 19:41, auf die fünf Rückfragen zu den Meldungen der HealthCheck-Dienste: "1 bis 5 passt alles so".

### Protokoll

1. **Aufzeichnung:** je Aufruf Zeit, Art (Lebenszeichen, Fehler gemeldet, gescheitert, Test), Ergebnis, HTTP-Status, Antwortzeit und Auslöser
   (Intervall, Start, Speichern, Selbsttest, Test). **Nie die URL und nie der Text einer Ausnahme** (die Ausnahme enthält oft die URL).
2. **Aufbewahrt:** einzelne Aufrufe 24 Stunden, Stundenwerte 30 Tage, Tageswerte 366 Tage (Ortszeit von Home Assistant, mit Minuten ohne Daten),
   Ereignisse 366 Tage und höchstens 1000 je Dienst. Bei 5 Minuten Abstand üblich rund 60 KB je Dienst, höchstens rund 160 KB. Eigene Ablage
   `alarmageddon.healthcheck_log`, geschrieben spätestens 10 Minuten nach dem ersten ungeschriebenen Aufruf und beim Beenden von Home Assistant.
   Laufzeitdaten: nicht im Backup; ein entfernter Dienst nimmt sein Protokoll mit. Das Protokoll beginnt mit dem Update.
3. **Grafik je Zeitraum:** bis 1 Tag Herzschlag mit Band, 7 Tage Zeitleiste je Tag, 30 Tage Raster Tag × Stunde (Vorschlag 1), 90 Tage und 1 Jahr
   Raster Monat × Tag (v3 "B"; grau ab 30 Minuten ohne Daten an einem Tag, leer vor dem Beginn des Protokolls). Antwortzeit mit Zonen 300 ms und
   1 s und einer roten Marke je gescheitertem Aufruf; ab 90 Tagen das Mittel je Tag.
4. **Listen:** "Ereignisse" und "Alle Aufrufe" folgen genau dem Zeitraum; die Zahl auf dem Reiter ist die Zahl der Liste (höchstens 300 Zeilen mit
   Hinweis "neueste N von M"). Ab 7 Tagen zeigt "Alle Aufrufe" die letzten 24 Stunden, mit Hinweis (ältere gibt es nur zusammengefasst).
5. **Kein Schalter "Protokoll aus" je Dienst** (Empfehlung der Prüfstelle, solange der Nutzer ihn nicht verlangt; Rückfrage unbeantwortet).

### Statuskachel

6. Sind Dienste eingerichtet, ist die untere Zeile der Statuskachel geteilt, gleich hoch wie bisher: links Selbsttest, rechts Dienste, je mit
   farbigem Symbol (grün alle in Ordnung, orange Fehler gemeldet, rot gescheitert). Tipp links öffnet den Selbsttest, rechts die Liste der Dienste.
   Auf dem Handy ohne Pfeile (sonst wurde "HealthCheck" gekürzt). Ohne Dienste wie bisher, ohne Hinweis auf die Dienste.

### Meldungen der HealthCheck-Dienste

Auf "Noch Fragen?" hat die Prüfstelle fünf Rückfragen mit Empfehlung gestellt; umgesetzt ist jeweils die Empfehlung, vom Nutzer um 19:41
bestätigt ("1 bis 5 passt alles so"):

7. **Meldung "Selbsttest":** nennt ein gescheitertes Lebenszeichen nicht mehr (sonst kämen zwei Meldungen für denselben Ausfall). Der Befund
   `ping_failed` bleibt im Selbsttest und zählt in der Statuskachel.
8. **Zahl:** 1 bis 10 gescheiterte Aufrufe hintereinander, Standard 2. Es zählt jeder automatische Aufruf (Intervall, Start, nach dem Speichern,
   Wechsel des Selbsttests), nie der Testknopf. Bei 24 Stunden Intervall heisst 2 meist zwei Tage.
9. **"Antwortet wieder"** nur, wenn "antwortet nicht" hinausging (ist "antwortet nicht" ausgeschaltet, kommt auch kein "wieder"). Einmal je
   Ausfall, auch über einen Neustart (Zähler, Beginn und "gemeldet" in der Ablage).
10. **Standard:** beide an, nicht kritisch, Lautstärke 80 %, Empfänger leer = die Standard-Empfänger der Wartung, Tipp öffnet die Liste der Dienste
    (`?view=healthcheck`). Platzhalter `{name}`, `{host}`, `{reason}`, `{count}`, `{since}`; **nie die URL** (nur der Rechner).
11. **Ein Wert für alle Dienste**, keine eigene Zahl je Dienst.

Das Kapitel steht immer da, auch ohne Dienst (Vorgabe 18:42). Die Karten sind aufgebaut wie die festen Meldungen im Reiter Aktionen (Schalter links,
Play mit den Werten der Karte, Stift öffnet dasselbe Fenster mit eigenen Platzhaltern und "Testmeldung senden").

### Batterie schwach erst nach mehreren Prüfungen

12. **Ursache:** Die Wartung prüft alle 15 Minuten den aktuellen Wert des Batteriesensors und meldete beim ersten Wert unter der Schwelle. Ein
    einzelner falscher Wert des Geräts (hier vermutlich 1 % für einen Moment; der Verlauf in Home Assistant ist hier nicht einsehbar) genügte. Die
    Batterieansicht zeigt ab 30 Tagen Stunden- oder Tageswerte; ein kurzer Ausreisser ist dort nicht zu sehen.
13. **Neu:** "Meldung nach … Prüfungen" (1 bis 10, **Standard 3**) unter Benachrichtigungen › Wartungsmeldungen › Batterie schwach. Die Meldung
    geht erst hinaus, wenn die Batterie so oft hintereinander unter der Schwelle liegt; mit 3 also frühestens 30 Minuten nach der ersten
    schwachen Prüfung. Ein Wert über der Schwelle beginnt neu (auch genau auf der Schwelle). Ein Batteriesensor ohne Wert (nicht verfügbar) zählt
    nicht mit und beginnt nicht neu. Die Zählung lebt nur im Speicher: ein Neustart verzögert höchstens, er löst nie eine Meldung aus.
14. **Bewusst unverändert:** Statusentität (`low_battery`) und Übersicht zeigen den aktuellen Wert sofort, wie bisher auch "nicht erreichbar".
    Ein Ausreisser, der länger als drei Prüfungen besteht, meldet weiterhin; ein Gerät, das einen falschen Wert stundenlang stehen lässt, lässt
    sich so nicht erkennen.
15. **Dezimalzeichen:** Die Spalte "Änderung" der Batterieliste zeigte auf Deutsch "+0.8 %" (Bildschirmfoto); jetzt "+0,8 %".

## 2. Änderungen

| Datei | Änderung |
| --- | --- |
| `healthcheck_log.py` | **neu**: `HealthLog` (`record`, `history`, `gaps`, `brief`, `remove`), kompakte Zeilen, Tageswerte mit Lücken, eigener Zeitgeber zum Schreiben und `EVENT_HOMEASSISTANT_FINAL_WRITE` |
| `healthcheck.py` | `self.log`; `_send` misst die Antwortzeit und schreibt ins Protokoll (im `try`); `_notify` ("antwortet nicht"/"wieder", im `try`); Ablage mit `fails`, `fail_since`, `down`; `listing()` mit `log` |
| `notify.py` | Texte `hc_down_*`, `hc_up_*`, `hc_reason_*` (EN/DE), `HC_TOKENS`, `HC_CLICK`, `async_send_healthcheck` |
| `selftest.py` | `_report` ohne `ping_failed` |
| `maintenance.py` | Batterie schwach erst nach `battery_checks` Prüfungen hintereinander (`_low`) |
| `schemas.py` | `HC_NOTICE_SCHEMA` (feste Meldung, Klickziel `healthcheck`) |
| `settings.py` | `valid_notify` mit `healthcheck` (Zahl begrenzt, ungültige Meldung = Standard) und `battery_checks` (begrenzt) |
| `websocket_api.py` | neu `alarmageddon/healthcheck_history`, `alarmageddon/test_healthcheck_notify`; `save_notify` mit `healthcheck` und `battery_checks` (1 bis 10) |
| `const.py` | `HEALTHLOG_*`, `DEFAULT_NOTIFY["healthcheck"]`, `DEFAULT_NOTIFY["battery_checks"]`, `HEALTHCHECK_NOTIFY_FAILS_RANGE`, `BATTERY_CHECKS_RANGE`, `HC_NOTICE_KINDS`, `PANEL_VERSION` 233 |
| `manifest.json` | 1.68.0 |
| `panel/healthlog.js` | **neu**: `HealthLogView extends SensorView` (Fenster `#ag-hclog`, Grafiken je Zeitraum, Listen) |
| `panel/sensorview.js` | `_clockSec`, `spec.seconds`; Spalte "Änderung" mit `toLocaleString` |
| `panel/healthcheck.js` | Knopf "Protokoll" zuerst in jeder Zeile; `tileHalf`; Haken nach Speichern und Entfernen |
| `panel/selftest.js` | `tileHalf` |
| `panel/alarmageddon-panel.js` | Fenster `#ag-hclog`, Weichen in `_onClick`/`_onInput`, geteilte Statuskachel, `#ag-step` für die Meldungen der Dienste, `?view=healthcheck` |
| `panel/actions.js` | `openHcNoticeEditor`, `HC_NOTICE_KINDS`, `HC_TOKENS`, Vorschau mit Beispiel |
| `panel/notify.js` | Kapitel "HealthCheck-Dienste" (`_hcHtml`), Zahl, Schalter, Play, Stift; Entwurf und Prüfung; `NUMBERS` mit mehreren Feldern je Art ("Meldung nach … Prüfungen") |
| `panel/strings.js` | Texte `hl*`, `stHalf*`, `hcHalf*`, `ntChapHc*`, `ntHcFails*`, `ntc_hc_*`, `ntcDefTitle/Msg_hc_*` (gleich dem Server), `ntTokHc_*`, `ntBatteryChecks*` u. a. (EN/DE); `ntH_battery_low` "bleibt unter der Schwelle"; `bkAboutText` nennt das Protokoll |
| `panel/styles.js` | Protokoll, Zeitraum auf dem Handy, `.ag-row.ag-split`, `.ag-half`, Spalte der Knöpfe 284 px |
| `panel/panel.html` | `healthlog` in `MODULES` |
| Nachbau | `ha-sim.html`: Protokoll wie der Server (`__hcLogHistory`, `__hcLogBrief`, `?hclog=empty`), Meldungen (`__hcNoticeCalls`), `battery_checks` |
| Tests | **neu** `tests/test_healthcheck_log.py`, `tests/test_healthcheck_notify.py`; `test_security.py` (zwei Befehle, nie die URL), `test_healthcheck.py`; `test_maintenance.py` (sieben neue Tests zur Zählung, ältere mit `_setup(checks=1)`) |
| Suiten | **neu** `hclog-e2e.mjs`, `hcnotify-e2e.mjs`; `healthcheck-e2e.mjs` (fünf Knöpfe), `play-e2e.mjs` (Play der Meldungen), `notices-e2e.mjs`, `actions-e2e.mjs` (vier Kapitel), `hardening-e2e.mjs` ("Meldung nach … Prüfungen"), `sensor-e2e.mjs` (Dezimalzeichen) |
| `scripts/mutation_check.py` | 14 Zeilen "Protokoll HealthCheck", 7 Zeilen "Meldung HealthCheck", 3 Zeilen "Batterie schwach"; zwei Muster "HealthCheck" an den geänderten Code angepasst (`_send(item, None, by)`, Entfernen mit Protokoll) |
| Doku | CHANGELOG EN/DE (1.68.0), README EN/DE, MANUAL EN/DE (auch Wartung), `CLAUDE.md` (auch Batterie schwach), `docs/DESIGN.md`, `docs/HANDOVER.md`, dieses Protokoll |
| Mockups | **neu** `docs/mockups/healthcheck-protokoll-v1/`, `-v2/`, `-v3/` (je mit Entscheid) |
| Bilder | `healthcheck-list-*.png` (Knopf "Protokoll"), **neu** `healthcheck-log-*.png`; mit `readme-shots.mjs` und `scripts/optimize_images.py`, Bilder, die nur in der Uhrzeit abwichen, zurückgesetzt |

## 3. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Funde |
| `node --input-type=module --check` für alle Dateien unter `panel/` | keine Fehler |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1591 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1591 bestanden, 6 übersprungen |
| `cd tests/panel && node run.mjs` | 70 Suiten, 7851 Prüfungen, alle bestanden. In einem früheren vollen Lauf (vor der Batterie) scheiterte `savewait-e2e.mjs` an einer Zeitüberschreitung beim Bildschirmfoto (alle 35 Prüfungen bestanden; parallel lief die Mutationsprobe); im letzten Lauf bestanden. Vorher scheiterten `notices-e2e.mjs` und `actions-e2e.mjs`, weil sie drei Kapitel unter Benachrichtigungen erwarteten (jetzt vier); Erwartung angepasst |
| `python scripts/mutation_check.py` | 401 von 401 erkannt (1.67.0: 377; 21 Zeilen HealthCheck, 3 Zeilen Batterie). Im ersten vollen Lauf fehlten zwei Muster "HealthCheck" (der Code hatte sich geändert); nachgeführt |
| Neue Prüfungen zuerst rot | Dezimalzeichen: ohne Korrektur scheitert `sensor-e2e.mjs` (Deutsch "−0.5 %"); Batterie: die drei Mutationen "Batterie schwach" werden erkannt |
| Patch auf `321ff98` in einem sauberen Arbeitsbaum angewendet, mit `files/` und dem Arbeitsstand verglichen | identisch (beim Packen geprüft) |

## 4. Nicht geprüft und bekannte Grenzen

- An einer echten Anlage und mit echten Diensten nicht geprüft; nur in der Testumgebung von Home Assistant und im Nachbau (Computer und Handy).
- Das Protokoll beginnt mit dem Update; 90 Tage und 1 Jahr füllen sich erst mit der Zeit.
- Ein Ausfall von Home Assistant ist eine Lücke (grau), kein Ausfall des Dienstes. Fällt der Rechner aus, auf dem Home Assistant läuft, meldet
  das nur der externe Dienst selbst, nie Alarmageddon.
- "Antwortet nicht" misst, ob der Dienst antwortet, nicht, ob der Dienst den Ausfall erkannt hat.
- Batterie schwach: geprüft in der Testumgebung, nicht mit dem Gerät des Nutzers. Ob der Wert 1 % wirklich nur kurz anstand, lässt sich nur im
  Verlauf des Batteriesensors in Home Assistant sehen.
- In der Batterieansicht rechnet "je Tag" aus Anfang und Ende seit dem letzten Wechsel, "bis zur Warnung" aus einer Ausgleichsgeraden; beide
  Zahlen können sichtbar auseinanderliegen (Bildschirmfoto: −0,22 % je Tag und "~5 Monate" bei 61 %). Nicht geändert.

## 5. Release-Angaben

- Version, Tag und Titel: `v1.68.0`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.68.0.md` (Abschnitt 1.68.0; seit dem letzten veröffentlichten Tag `v1.67.0`).
