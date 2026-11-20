# Übergabe 1.71.0 (2026-11-20)

Lieferung der externen Prüfstelle. Basis ist `main` @ `c13bfa7` (Commit des Nutzers "1.70.0: …", Tag `v1.70.0` auf demselben Commit; vor dem
Packen auf GitHub geprüft: Baum gleich dem der Lieferung von 1.70.0, kein neuerer Tag).

Der Tag `v1.70.0` existiert, darum eine neue Version (Regel "Veröffentlichte Tags nie ändern"). **1.71.0** (Minor), weil neue Funktionen dazukommen
(zwei Testmeldungen, Knopf des Assistenten im Kopf, neue Option `group` am Befehl `test_notify`); dazu eine Fehlerbehebung. Eine vorbereitete 1.70.1
(nur die Fehlerbehebung) wurde nie geliefert und ist hier aufgegangen. `manifest.json` 1.71.0, `PANEL_VERSION` 235 auf 236.

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.71.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.71.0.md`) |
| `RELEASE-NOTES-1.71.0.md` | Release Notes Englisch (für das GitHub-Release, seit dem letzten Tag `v1.70.0`) und Deutsch |
| `1.71.0-auf-1.70.0.patch` | alle Änderungen als ein Patch gegen `main` @ `c13bfa7`, **ohne Bilder** (PNG, GIF der Mockups) |
| `files/` | jede gegenüber `c13bfa7` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys, mit den Bildern |

Anwenden: `git checkout main && git pull` (Stand `c13bfa7`), dann **entweder** `git apply --index 1.71.0-auf-1.70.0.patch` und danach den Inhalt von
`files/` über das Repository kopieren (bringt die Bilder der Mockups) und `git add -A`, **oder** nur den Inhalt von `files/` kopieren und `git add -A`.
Keine Datei wird gelöscht. Neu sind dieses Protokoll, die Suite `tests/panel/suites/wzbtn-e2e.mjs` und der Ordner `docs/mockups/assistent-knopf-v1/`.
Danach die Prüfungen aus Abschnitt 4, Commit mit Betreff `1.71.0: Einrichtungsassistent: Knopf im Kopf, zwei Testmeldungen, Fusszeile; Listen in
Fenstern`, Push auf `main`, Release-Angaben aus Abschnitt 6. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass

Wünsche und Entscheide des Nutzers vom 2026-11-20 nach dem Ausprobieren von 1.70.0, je mit Bildschirmfoto:

- 11:30 (Handy, dunkel, Fenster "Messwerte hinzufügen" mit seinen Sensoren): "Hier in der Ansicht sieht es ziemlich zusammengerückt aus. Bitte mach
  das besser." Auf dem Bild überlagern sich bei langen Namen Name und Art der einen Zeile mit der nächsten, und die Überschrift des ersten Bereichs fehlt.
- 11:37 (Handy, Fusszeile des Assistenten): "Der Weiter-Button unten ist viel breiter als der Zurück-Button. Könntest du das auf dem Handy so machen,
  dass sie sich den Platz quasi teilen … mittig teilen einfach, genau."
- 11:38 (Kopf der Übersicht, rechts neben dem Stift markiert): "neben dem Bleistift einen runden Button anzeigen mit einem animierten Zauberstab drin für
  den Assistenten … wenn es fertig geladen ist, nach 5 Sekunden … der Zauberstab soll sich dann schwingen … leicht dezent animiert, aber nicht zu wild
  … ein, 2 Vorschläge". Mockups `docs/mockups/assistent-knopf-v1/` (A Schwung, B Funkeln, C Drehung; Empfehlung A) mit drei Fragen.
- 11:38 (Computer, breites Fenster): "Auf dem Desktop sollte es so sein, dass dieser Später-Button oben und der Weiter-Button unten zum Inhalt rüber
  rückt … am ganz rechten Rand des tatsächlichen Inhalts."
- 11:40 (Schritt "Fertig", "Ausprobieren"): "Kannst du hier zwei Knöpfe anbieten, eine für die Wartungsmeldung die Alarmmeldung. … Empfänger für
  Wartungsmeldungen, … Empfänger für Alarmmeldungen. Einfach, dass wir hier beides anbieten. Das kann sich unterscheiden."
- 11:48, Antworten auf die Fragen zum Knopf: "1. a", "2. Sobald der Assistent einmal abgeschlossen ist, soll der Button gar nicht mehr angezeigt
  werden.", "3. nein, immer animieren" (die Einstellung "Bewegung reduzieren" gilt nicht).

## 2. Umsetzung

### Listen in Fenstern (11:30)

- **Ursache:** `.ag-elist` ist eine Flex-Spalte mit begrenzter Höhe und eigenem Rollbalken. Ihre Zeilen haben `min-height: 44px`; damit erlaubt der
  Browser, sie bis 44 px zusammenzudrücken, wenn die Liste zu hoch wäre. Eine Zeile mit zwei- oder dreizeiligem Namen wurde so niedriger als ihr
  Inhalt, der Text lief in die nächste Zeile; Bereichsüberschriften schrumpften ganz weg. Am Computer fiel das nicht auf (Namen meist einzeilig).
  Im Nachbau nachgestellt (lange Namen, Handy): 14 Texte ausserhalb ihrer Zeile.
- **Behebung:** `.ag-elist > * { flex-shrink: 0; }`: jede Zeile behält die Höhe ihres Inhalts, die Liste rollt. Gilt für alle Listen dieser Art:
  "Messwerte hinzufügen" und die Liste der gewählten im Assistenten, "Sensoren hinzufügen", die Wahl von Sensoren und Geräten in Regeln und Routinen.
- **Mehr Luft in den Zeilen der Messwerte** (Fenster und Liste der gewählten): mindestens 56 px hoch, 12 px Abstand, Name mit Zeilenhöhe 1,3, Art drei
  Pixel darunter; auf dem Handy Kästchen, Symbol und Wert oben bündig mit dem Namen. Die Bereiche ("Bad", "Büro") stehen als Überschrift mit hellem
  Hintergrund und Trennlinie über ihren Zeilen.

### Fusszeile und Kopf des Assistenten (11:37, 11:38)

- Handy: "Zurück" und "Weiter" je halbe Breite (`flex: 1 1 0`), Text mittig; ein Fehlertext steht über beiden über die ganze Breite.
- Computer: der Kopf des Schritts (`.ag-wz-head`) ist höchstens so breit wie der Inhalt (1120 px), "Später" steht damit an dessen rechtem Rand; die
  Fusszeile rückt "Weiter" mit `padding-right: max(40px, calc(100% - 1080px))` an denselben Rand. Bei schmaleren Fenstern bleibt alles wie bisher.

### Zwei Testmeldungen (11:40)

- **Server:** `Notifier.send_group_test(group)` sendet an die Standard-Empfänger der Gruppe (`alarm_targets` oder `maintenance_targets`), mit dem
  Titel "🧪 Test: Alarmmeldungen" bzw. "Wartungsmeldungen" (EN "Alarm notifications", "Maintenance notifications"). Hat die Gruppe keinen Empfänger,
  geht **nichts** hinaus (sonst nähme `_send` die Empfänger einer Art). `alarmageddon/test_notify` nimmt `group` (`alarm`, `maintenance`) statt `kind`;
  genau eines von beiden, sonst `invalid_format`. Nur Administratoren wie bisher (`COMMANDS` in `test_security.py` unverändert gültig).
- **Panel:** im Schritt "Meldungen" zwei Play-Knöpfe nebeneinander, "Alarmmeldung" und "Wartungsmeldung" (Handy je halbe Breite); unter "Ausprobieren"
  zwei Zeilen "Testmeldung Alarm" und "Testmeldung Wartung", je mit ihren Empfängern ("An diego."). Ein Knopf ohne Empfänger seiner Gruppe (im
  Entwurf der Seite) ist gesperrt. Wie bisher speichert der Knopf offene Änderungen der Seite still, bevor er sendet (`wizard.js _notifyTest(group)`);
  der Hinweis sagt nichts vom Speichern. `NotifyUi.test(null, null, group)` mit eigenem Schlüssel `nt:group:<gruppe>` für den Play-Knopf.

### Knopf des Assistenten im Kopf (11:38, Entscheide 11:48)

- `alarmageddon-panel.js _wizardBtn`: rund, 40 px, rechts neben dem Stift, in jedem Reiter (Übersicht, Protokoll, Konfiguration), hellblau mit blauem
  Rand, Zauberstab und blauem Punkt (blau, weil orange nur "ungespeichert" heisst). **Nur solange der Assistent der gewählten Anlage nicht `done` ist**
  (`open`, `later`, `hidden`); im Assistenten selbst gibt es ihn nicht (er ersetzt den Kopf).
- Tooltip und Name: "Einrichtungsassistent fortsetzen (Schritt 5: Meldungen)", beim Willkommen "Einrichtungsassistent starten". Klick: derselbe Start
  wie "Fortsetzen" unter Konfiguration › Anlage (`data-wz="run"` mit dem gemerkten Schritt; offene Änderungen fragen vorher).
- Bewegung Variante A (`styles.js`, `ag-wz-swing` 1,4 s um den Griff, `ag-wz-pop` je Stern mit 0, 0,12, 0,24 s Verzögerung): **einmal je Laden des
  Panels**, `WAVE_MS` (5 s) nachdem der Knopf zu sehen ist (`_waveLater`): nach dem Laden der Daten, oder später, wenn er erst dann erscheint (etwa
  nach "Später"). Nie bei einem Wechsel des Reiters. Auch bei "Bewegung reduzieren" (Entscheid 3). Die Klasse `wave` fällt nach dem letzten Stern weg.
- Nach "Fertig" verschwindet der Knopf (Entscheid 2); "Von vorn" bleibt unter Konfiguration › Anlage.

## 3. Änderungen

| Datei | Änderung |
| --- | --- |
| `manifest.json` | 1.71.0 |
| `const.py` | `PANEL_VERSION` 236 |
| `notify.py` | `send_group_test`, Texte `group_alarm`, `group_maintenance` (EN/DE) |
| `websocket_api.py` | `test_notify` mit `group` (genau eines von `kind` und `group`) |
| `panel/alarmageddon-panel.js` | `_wizardBtn`, `_waveLater`, `WAVE_MS`, `WAND_STICK`, `WAND_STARS`; Zeitgeber in `disconnectedCallback` |
| `panel/wizard.js` | `_groupTestBtn`, `_notifyTest(group)`; zwei Testknöpfe im Schritt "Meldungen", zwei Zeilen unter "Ausprobieren" |
| `panel/notify.js` | `test(kind, mode, group)` |
| `panel/strings.js` | `wzTestBtnAlarm`, `wzTestBtnMaint`, `wzTestMsgAlarm`, `wzTestMsgMaint` (statt `wzTestMsg`), `wzBtnStart`, `wzBtnResume`; `wzTestTitle`, `wzTestHint` für zwei Gruppen (EN/DE) |
| `panel/styles.js` | `.ag-elist > *` schrumpft nie; Zeilen und Bereiche von `.ag-wz-mlist`, `.ag-wz-plist`; Fusszeile Handy und Computer, `.ag-wz-head`; `.ag-wz-testbtns`; `.ag-wzbtn` mit Bewegung |
| `tests/test_notify_types.py` | `test_group_test_goes_to_the_standard_recipients_only` (Empfänger je Gruppe, leere Gruppe sendet nichts, `kind`+`group`, keines, unbekannte Gruppe abgelehnt) |
| `scripts/mutation_check.py` | zwei Zeilen "Testmeldung der Gruppe" (leere Gruppe sendet doch; Prüfung "genau eines" entfernt) |
| `tests/panel/sim/ha-sim.html` | `test_notify` mit `group`; `?mtargets=1` (Empfänger der Wartung vorbelegt) |
| `tests/panel/suites/wizard-e2e.mjs` | lange Namen im Fenster "Messwerte hinzufügen" (Handy und Computer); Fusszeile (Handy gleich breit, Computer am Rand des Inhalts); zwei Testknöpfe (gesperrt ohne Empfänger, frei mit Entwurf, je eigener Aufruf, Handy gleich breit), zwei Zeilen unter "Ausprobieren" |
| `tests/panel/suites/play-e2e.mjs` | die vier Testknöpfe des Assistenten (rot, Stopp, wieder Play) |
| `tests/panel/suites/wzbtn-e2e.mjs` | neu: Knopf im Kopf (Lage, Grösse, Punkt, Tooltip, Schwung nach rund 5 s, Variante A, auch bei "Bewegung reduzieren", nicht erneut beim Reiterwechsel, Klick beim Schritt, nach "Nicht mehr anzeigen" wieder da, nach "Fertig" weg, eingerichtete Anlage ohne Knopf, Rückfrage bei offenen Änderungen) |
| Doku | CHANGELOG EN/DE (1.71.0), MANUAL EN/DE (Einrichtungsassistent; Zahl der Schutzmassnahmen), README EN/DE (Zahl der Schutzmassnahmen), `CLAUDE.md`, `docs/DESIGN.md`, `docs/HANDOVER.md`, Mockups `assistent-knopf-v1` (mit Entscheid), dieses Protokoll |

Die README-Bilder zeigen die Schritte "Sensoren" und "Zuordnung" ohne den Kopf des Panels; keine neuen Bilder.

## 4. Prüfungen und Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py` | ohne Befund |
| `node --input-type=module --check` für jede Datei unter `panel/` | ohne Befund |
| JSON gültig, `strings.json` gleich `translations/en.json`, kein "ß" | ja |
| `pytest` mit Python 3.13 und Home Assistant 2026.2.3 | **1605 bestanden**, 6 übersprungen |
| `pytest` mit Python 3.14 und Home Assistant 2026.10.4 | **1605 bestanden**, 6 übersprungen |
| `python scripts/mutation_check.py` | **410 von 410 erkannt** (2 neu: "Testmeldung der Gruppe") |
| Panel: `node tests/panel/run.mjs` (alle Suiten, je Sprache, Desktop und Handy) | **73 von 73 Suiten bestanden, 8601 Prüfungen, 0 fehlgeschlagen** (`wizard-e2e.mjs` 432, `wzbtn-e2e.mjs` 96, `play-e2e.mjs` 212) |

Der Lauf aller Suiten stiess an die Zeitgrenze der Umgebung (30 Minuten) nach 70 Suiten, alle bestanden; die drei übrigen (`wizard`, `wzbtn`, `zones`)
liefen danach einzeln, ebenfalls bestanden. In einem früheren Lauf unter hoher Last (parallel zu anderen Suiten) scheiterte `dragscroll-e2e.mjs`
einmal beim Ziehen in eine weit entfernte Liste; einzeln zweimal und im Lauf oben bestanden. Die Lieferung ändert nichts am Ziehen.

README und Handbuch nennen "rund 8600 Prüfungen" (vorher 8500) und 410 Schutzmassnahmen (vorher 408).

## 5. Nicht geprüft und bekannte Grenzen

- An einer echten Anlage nicht geprüft; nur in der Testumgebung von Home Assistant und im Nachbau (Computer und Handy, Deutsch und Englisch, hell und
  dunkel). Ob eine Testmeldung auf dem Handy ankommt, hängt wie bisher an der Companion App.
- Der Knopf im Kopf gilt je gewählter Anlage: hat eine andere Anlage einen offenen Assistenten, zeigt er sich erst, wenn sie gewählt ist.

## 6. Release-Angaben

- Version, Tag und Titel: `v1.71.0`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.71.0.md`, seit dem letzten Tag `v1.70.0` (nur 1.71.0).
