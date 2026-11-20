# Übergabe 1.70.0 (2026-11-20)

Lieferung der externen Prüfstelle. Basis ist `main` @ `467fe2a` (Commit des Nutzers "1.69.0: …", Tag `v1.69.0` auf demselben Commit; vor dem
Packen auf GitHub geprüft: Baum gleich dem der Lieferung von 1.69.0).

Der Tag `v1.69.0` existiert, darum eine neue Version (Regel "Veröffentlichte Tags nie ändern"). **1.70.0** (Minor), weil sich das Verhalten im
Einrichtungsassistenten ändert (Fenster für die Messwerte, Knopf "Konfiguration öffnen"); dazu eine Fehlerbehebung. `manifest.json` 1.70.0,
`PANEL_VERSION` 234 auf 235.

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.70.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.70.0.md`) |
| `RELEASE-NOTES-1.70.0.md` | Release Notes Englisch (für das GitHub-Release, seit dem letzten Tag `v1.69.0`) und Deutsch |
| `1.70.0-auf-1.69.0.patch` | alle Änderungen als ein Patch gegen `main` @ `467fe2a` (diese Lieferung enthält keine Bilder) |
| `files/` | jede gegenüber `467fe2a` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand `467fe2a`), dann `git apply --index 1.70.0-auf-1.69.0.patch`, oder den Inhalt von `files/` über
das Repository kopieren und `git add -A` (keine Datei wird gelöscht). Neu ist nur dieses Protokoll. Danach die Prüfungen aus Abschnitt 4, Commit
mit Betreff `1.70.0: Einrichtungsassistent: Messwerte im Fenster, Weitere Funktionen, Fortsetzen bei Überwachung`, Push auf `main`,
Release-Angaben aus Abschnitt 6. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass

Wünsche des Nutzers vom 2026-11-20 nach dem Ausprobieren von 1.69.0, je mit Bildschirmfoto aus dem Einrichtungsassistenten:

- 08:27 (Schritt "Meldungen", markiert "(speichert diesen Schritt zuerst)"): "Hier steht, der User soll den Schlittschuh speichern, aber er hat gar
  keine Möglichkeit dazu." (diktiert; gemeint ist der Schritt)
- 08:31 (Schritt "Überwachung" mit 106 Messwerten als Knöpfe; Schritt "Sensoren" als Vorbild): "Die Seite wirkt sehr, sehr unübersichtlich. …
  im gleichen Stil wie bei den Sensoren der Alarmanlage, dass man dort alles sieht, eine Suche hat, vielleicht Filter hat … zuerst nur ein leeres
  Feld … wie bei Sensor hinzufügen … nur in einem Pop-up. Sonst gibt es eine riesenlange Liste, … dann sieht man die Routinen gar nicht mehr … und
  dann Sensoren einzeln hinzufügen muss, die man haben möchte. Und danach sieht man sie ebenfalls wieder übersichtlich, kann nochmal danach suchen
  und filtern. Ja, so sollte es eigentlich sein."
- 08:33 (Schritt "Fertig", markiert "Wenn du mehr willst"): "Hier verleitet es so zum Klicken. … weitere Funktionen … Oder wir schreiben es so,
  dass es mehr informativ ist. … unten einen Link … jetzt Einstellungen öffnen, dann würde man quasi auf der Config-Seite landen".
- 08:49 (Rückfrage zur Testmeldung): "Es ist verwirrend, wenn das die einzige Seite ist, die man separat speichern muss. … dass gar nichts von
  Speichern steht. Dann kann er es einfach testen, wenn er möchte, und wir kümmern uns um das Speichern."

## 2. Umsetzung

### Testmeldung im Schritt "Meldungen" (08:27, 08:49)

- Der Knopf "Testmeldung senden" speicherte schon in 1.69.0 offene Änderungen der Seite selbst (`wizard.js _notifyTest`: dasselbe Speichern wie
  "Weiter", dann die Testmeldung); nur der Hinweis "(speichert diesen Schritt zuerst)" las sich wie eine Aufforderung. Der Hinweis sagt jetzt nichts
  mehr vom Speichern: "Sendet eine Testmeldung an die Empfänger von Alarmen. Kritische Meldungen musst du in der Companion App auf dem Handy erlauben,
  sonst bleiben sie im Stumm-Modus leise." Das Verhalten bleibt.
- Nicht gewählt: eine Testmeldung mit den ungespeicherten Werten (der Server müsste dafür ungespeicherte Empfänger annehmen); für den Nutzer ohne
  Unterschied.

### Schritt "Überwachung" (08:31)

- Umgesetzt ohne eigenes Mockup: der Nutzer beschrieb den Aufbau und nannte die Vorbilder ("Sensoren hinzufügen", Schritt "Sensoren").
- Die Liste der Messwerte beginnt leer (gestrichelter Rahmen, "Noch keine Messwerte gewählt", Zahl der passenden, Knopf "Messwerte hinzufügen").
- Fenster `#ag-wzpick` wie "Sensoren hinzufügen": Suchfeld mit X, Filter Alle, Temperatur, Luftfeuchtigkeit, Helligkeit, Luftqualität (CO2, CO,
  Feinstaub, VOC, AQI, NO2, Ozon, SO2), Weitere, jeweils nur die vorhandenen; Zeilen nach Bereich mit Kästchen, Symbol, Name, Art · Integration und
  dem jetzigen Wert rechts (hilft bei gleichnamigen Sensoren); "Hinzufügen (n)". Escape, X und "Abbrechen" fragen bei einer Auswahl.
- Die gewählten stehen in einer Liste fester Höhe (360 px, Handy 50 % der Höhe), damit die Regeln darunter nah bleiben: Suche, Filter der gewählten
  Arten, "n gewählt", Wert und runder Papierkorb je Zeile; "Messwerte hinzufügen" steht dann rechts neben dem Titel.
- Hinzufügen und Entfernen gelten wie in 1.69.0 sofort (erst dann können die Regeln darunter die Messwerte verwenden); gespeichert über das Speichern
  des Reiters Sensoren.

### Behoben: Fortsetzen bei "Überwachung"

- Beim Testen gefunden: wer bei "Überwachung" "Später" wählte, landete am nächsten Tag bei "Fertig". Der Schritt erscheint nur mit passenden
  Messwerten; beim Öffnen waren sie noch nicht geladen, und der Assistent ging zum nächsten vorhandenen Schritt. Jetzt bleibt ein angefangener
  Schritt "Überwachung" stehen, bis die Messwerte da sind (`_monitorFits`), mit "Lädt" im Schritt.

### "Weitere Funktionen" (08:33)

- Kapitel "Weitere Funktionen" (vorher "Wenn du mehr willst") mit "Für den Anfang nicht nötig; du findest sie jederzeit in der Konfiguration."; statt
  vier Kacheln eine Karte mit Zeilen zur Information: Routinen, Codes pro Person, HealthCheck, Dashboard-Karte, je was sie tun und wo sie stehen
  ("Konfiguration › Anlage › Routinen" … "Im Dashboard von Home Assistant: Karte hinzufügen, Suche "Alarmageddon"").
- Unten "Konfiguration öffnen": schliesst den Assistenten wie "Fertig" ab (Server `done`) und öffnet Konfiguration › Anlage. Von den zwei Vorschlägen
  des Nutzers der zweite (informativ mit einem Knopf), weil man nach einem Link je Funktion nicht in den Assistenten zurückkommt.

## 3. Änderungen

| Datei | Änderung |
| --- | --- |
| `manifest.json` | 1.70.0 |
| `const.py` | `PANEL_VERSION` 235 |
| `panel/wizard.js` | Schritt "Überwachung": `_monitorHtml`, `_monChosen`, `_monRows`, `_monChips`, Fenster `openPick`, `_renderPick`, `_pickAdd`; `_monitorFits` beim Laden; "Weitere Funktionen" (`MORE`, `finishTo`); Kommentar zur Testmeldung |
| `panel/alarmageddon-panel.js` | Fenster `#ag-wzpick`, Rückfrage (`DLG_CANCEL`, `_dlgDirty`) |
| `panel/strings.js` | `wzMon*`, `wzMore*`, `wzWhere_*` (EN/DE); `wzTestHint` ohne Speichern |
| `panel/styles.js` | `.ag-wz-mempty`, `.ag-wz-mhead`, `.ag-wz-mtools`, `.ag-wz-mlist`, `.ag-wz-plist`, `.ag-wz-more*`, `.ag-wz-where` |
| `tests/panel/suites/wizard-e2e.mjs` | Überwachung mit Fenster, Suche, Filter, Rückfrage, Hinzufügen, Entfernen, feste Höhe; Fortsetzen bei "Überwachung"; "Weitere Funktionen" und "Konfiguration öffnen"; Hinweis der Testmeldung ohne Speichern (402 Prüfungen, vorher 330) |
| Doku | CHANGELOG EN/DE (1.70.0), MANUAL EN/DE (Einrichtungsassistent; Zahlen der Tests), README EN/DE (Zahlen der Tests), `CLAUDE.md`, `docs/DESIGN.md`, `docs/HANDOVER.md`, dieses Protokoll |

Die README-Bilder zeigen die Schritte "Sensoren" und "Zuordnung"; keine neuen Bilder.

## 4. Prüfungen und Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py` | ohne Befund (kein Python geändert) |
| `node --input-type=module --check` für jede Datei unter `panel/` | ohne Befund |
| JSON gültig, Übersetzungen, kein "ß" | ja |
| `pytest` mit Python 3.13 und Home Assistant 2026.2.3 | **1604 bestanden**, 6 übersprungen |
| `pytest` mit Python 3.14 und Home Assistant 2026.10.4 | **1604 bestanden**, 6 übersprungen |
| `python scripts/mutation_check.py` | **408 von 408 erkannt** (am Stand von 1.69.0; 1.70.0 ändert kein Python) |
| Panel: `node tests/panel/run.mjs` (alle Suiten, je Sprache, Desktop und Handy) | **72 von 72 Suiten bestanden, 8451 Prüfungen, 0 fehlgeschlagen**; danach `wizard-e2e.mjs` mit dem Hinweis ohne Speichern erneut: 402 bestanden |

README und Handbuch nennen "rund 8500 Prüfungen" (vorher 8400).

## 5. Nicht geprüft und bekannte Grenzen

- An einer echten Anlage nicht geprüft; nur in der Testumgebung von Home Assistant und im Nachbau (Computer und Handy, Deutsch und Englisch). Der
  Nachbau hat drei Messwerte; eine Liste wie beim Nutzer (106) ist nur über die feste Höhe und das Rollen abgedeckt.
- Die Kacheln im Schritt "Willkommen" (Übersicht der Schritte) sehen aus wie die früheren Kacheln "Wenn du mehr willst"; nicht geändert, weil nicht
  verlangt.

## 6. Release-Angaben

- Version, Tag und Titel: `v1.70.0`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.70.0.md`, seit dem letzten Tag `v1.69.0` (nur 1.70.0).
