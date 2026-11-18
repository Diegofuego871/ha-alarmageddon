# Übergabe 1.65.0 (2026-11-18)

**Dritte Fassung** (ersetzt die ZIP-Datei von 20:20): der **Selbsttest** (Wunsch des Nutzers 20:23 und 20:31, Entscheide auf die Rückfragen danach,
Abschnitt 1a), **HealthCheck** (Wunsch 21:38, Entscheide 21:50 und 21:54, Abschnitt 1b) und die **überarbeitete README** (Wunsch 21:58). 1.65.0 hat
noch keinen Tag, darum bleibt es 1.65.0 (Anweisung des Nutzers: "in die gleiche Version, gleiche Lieferung"); `PANEL_VERSION` 229 (228 in der
zweiten, 227 in der ersten Fassung). Anders als die beiden ersten Fassungen ändert diese Fassung Python-Logik (neue Module `selftest.py` und
`healthcheck.py`, Haken in Ablauf, Überwachung, Meldungen, Start und Backup, neue Entität, fünf neue WebSocket-Befehle).

Die **zweite Fassung** (20:20) brachte die Benennung zurück auf "Regeln" (Entscheid des Nutzers 19:47, Abschnitt 1) und den Knopf "Buy Me a Coffee"
in beiden READMEs.

Lieferung der externen Prüfstelle. Basis ist `main` @ `115d3fc` (1.63.0, Tag `v1.63.0`; auf GitHub vor der Lieferung geprüft: kein neuerer Tag,
`main` unverändert). 1.64.0 (zwei Lieferungen von 17:05 und 18:18) ist nicht veröffentlicht: nach der Regel "neue Funktionen bekommen eine neue
Nummer, die vorige wird übersprungen" ist 1.64.0 im CHANGELOG als "Nicht veröffentlicht; enthalten in 1.65.0" vermerkt, ohne Link-Fussnote, und
1.65.0 enthält ihre Änderungen. Zuerst dieses Protokoll, dann `docs/HANDOVER.md` (Abschnitt 1.65.0, darunter 1.64.0), `docs/UEBERGABE-1.64.0.md`
und `CLAUDE.md` (neu: Regeln "Sensoransicht der Überwachung", "Selbsttest" und "HealthCheck").

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.65.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.65.0.md`) |
| `RELEASE-NOTES-1.65.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch, mit den Änderungen aus 1.64.0 |
| `1.65.0-auf-1.63.0.patch` | alle Änderungen (1.64.0 und 1.65.0) als ein Patch gegen `main` @ `115d3fc`, mit den Bildern (binär) |
| `1.65.0-auf-1.64.0.patch` | nur die Änderungen seit der zweiten Lieferung von 1.64.0 (18:18), falls diese schon angewendet ist |
| `1.65.0-auf-1.65.0-erste-fassung.patch` | nur die Änderungen seit der ersten Fassung von 1.65.0 (19:42), falls diese schon angewendet ist |
| `1.65.0-auf-1.65.0-zweite-fassung.patch` | nur die Änderungen seit der zweiten Fassung von 1.65.0 (20:20), also Selbsttest, HealthCheck und README, falls diese schon angewendet ist |
| `files/` | jede gegenüber `115d3fc` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand `115d3fc`), dann `git apply --index 1.65.0-auf-1.63.0.patch`, oder den Inhalt von `files/` über
das Repository kopieren (gilt auch, wenn 1.64.0 schon angewendet, aber nicht committet ist). Ist die zweite Lieferung von 1.64.0 schon angewendet und
committet: `1.65.0-auf-1.64.0.patch`; ist die erste Fassung von 1.65.0 schon angewendet und committet: `1.65.0-auf-1.65.0-erste-fassung.patch`
(er benennt `tests/panel/suites/svactions-e2e.mjs` in `svrules-e2e.mjs` um; wer `files/` kopiert, löscht `svactions-e2e.mjs` von Hand, falls die
erste Fassung kopiert wurde); ist die zweite Fassung schon angewendet und committet: `1.65.0-auf-1.65.0-zweite-fassung.patch`. Sonst ist keine Datei
zu löschen. Danach die Prüfungen aus Abschnitt 4, Commit mit Betreff
`1.65.0: Selbsttest, HealthCheck, Sensoransicht mit Ereignissen und Regeln, Grenzen immer sichtbar, README (enthält 1.64.0)`, Push auf `main`,
Release-Angaben aus Abschnitt 6. Die Lieferung ändert keine Datei unter `.github/`. Neue Dateien: `custom_components/alarmageddon/selftest.py`,
`custom_components/alarmageddon/healthcheck.py`, `custom_components/alarmageddon/panel/selftest.js`, `custom_components/alarmageddon/panel/healthcheck.js`,
`tests/test_selftest.py`, `tests/test_healthcheck.py`, `tests/panel/suites/selftest-e2e.mjs`, `tests/panel/suites/healthcheck-e2e.mjs`,
`docs/img/selftest-en.png`, `docs/img/selftest-de.png`, `docs/img/healthcheck-en.png`, `docs/img/healthcheck-de.png`,
`docs/img/healthcheck-list-en.png`, `docs/img/healthcheck-list-de.png`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Wunsch des Nutzers vom 2026-11-18, 17:43 (Bildschirmfotos der Sensoransicht "Kühlschrank Küche" und "Kühlschrank Reduit"): die Grenze der Regel
stand nur bei der Küche in der Grafik; unter der Grafik zwei Reiter, Ereignisse und die Regeln, in denen das Gerät vorkommt, beide durchsuchbar und
sortierbar; ein Klick auf eine Regel führt zu ihr. Mockups: `docs/mockups/sensorview-regeln-v1/` (Variante A Reiter, Variante B Karten, Marke am
Rand). Entscheide des Nutzers (18:58):

1. Variante A. Der Reiter heisst "Aktionen" statt "Regeln"; in der Tabelle (mehr Platz) "Überwachungsaktionen", damit klar ist, dass es nur die
   Aktionen der Überwachung sind.
2. Für alles, was in einer Aktion der Überwachung vorkommt.
3. Grenze immer sichtbar.
4. Der Pfeil führt zur Aktion, aufgeklappt in der Liste.

Entscheid des Nutzers (19:47, nach der ersten Fassung): zurück zur Benennung "Regeln", wie überall im Panel: der Reiter heisst "Regeln", die
Tabelle "Regeln", die Spalte der Ereignisse "Regel"; unter Konfiguration › Aktionen › Überwachung und in den Einstellungen heisst es schon
"Regeln", das bleibt. Dazu: der Knopf "Buy Me a Coffee" in der README, "nicht ganz oben, aber eher oben"; 20:04 mit Bildschirmfoto (Orphan Entity Cleaner in HACS)
genauer: direkt unter den Abzeichen.

Ursache der fehlenden Grenze: `sensorview.js _valueLine` zeigte eine Grenze nur, wenn sie höchstens zwei Spannweiten neben den Werten lag
(Reduit 4,8 bis 6,1 °C: nur bis 8,7 °C). Die Grenze der Regel des Reduits war hier nicht bekannt; für Grenzen darüber war das die Ursache.

## 1a. Selbsttest: Anlass und Entscheide (dritte Fassung)

Frage des Nutzers 20:20 (Watchdog-App für die Integration), Antwort der Prüfstelle: eine App überwacht Home Assistant, nicht die Integration;
vorgeschlagen wurden ein Zustand der Integration und ein externer Herzschlag. Der Nutzer (20:23, 20:31): Punkt 2 "Zustand der Integration" umsetzen,
"gleich beide Schritte" (Konfiguration und Laufzeit), bei jedem Start und regelmässig (mindestens viermal am Tag), Anzeige in den Reparaturen von
Home Assistant und im Panel, eine Entität je Anlage, die Statuskachel zeigt immer die letzte Prüfung und Probleme, ein Klick öffnet ein Fenster mit
Erklärung und Hilfetexten "so ausführlich wie möglich", eine eigene Wartungsmeldung, einzeln ein- und auszuschalten und einzustellen wie die anderen,
keine Mockups, in dieselbe Version und Lieferung. Antworten auf die vier Rückfragen:

1. Ein Problem im Betrieb verschwindet: **beides**, wenn derselbe Schritt wieder klappt (Test oder echt) und mit "Erledigt" im Fenster.
2. Probleme zählen mit: **ja**, in der Statuskachel ("N brauchen Aufmerksamkeit"), in der Statusentität und in der Infokarte.
3. Ein Gerät eines Ablaufs (Sirene, Schalter, Lautsprecher), das nicht erreichbar ist: **als Problem** (nicht erst, wenn es fehlt).
4. Abstand: **einstellbar** (Standard alle 6 Stunden, 1 bis 24, im Kapitel Wartungsmeldungen).

Eigene Entscheide der Prüfstelle (bitte prüfen): Sensoren des Alarms und der Überwachung zählen nur, wenn sie **fehlen** (nicht erreichbare meldet
die Wartung schon, keine doppelte Meldung); ein Gerät gilt erst nach 5 Minuten als nicht erreichbar (`SELFTEST_GRACE`); Abläufe eines
ausgeschalteten Modus werden nicht geprüft; die erste Prüfung nach dem Start von Home Assistant kommt nach 5 Minuten (die Geräte verbinden sich
erst), "bei jedem Start" heisst also "kurz nach jedem Start"; Fehlschläge im **Test** (Play) zählen auch als Problem im Betrieb (mit "Test" in der
Fundstelle); "Erledigt" gibt es nur für Probleme im Betrieb, ein Problem der Einrichtung verschwindet erst, wenn es behoben ist (der Server lehnt
"Erledigt" dafür ab); in der Statuskachel zählt der Selbsttest als **eine** Zeile (wie "3 nicht erreichbar"), in der Statusentität zählt jedes
Problem einzeln (wie dort die Sensoren).

## 1b. HealthCheck: Anlass und Entscheide (dritte Fassung)

Wunsch des Nutzers 21:38 (mit Bildschirmfoto eines Checks bei Healthchecks.io; dessen echte Ping-URL ist nirgends verwendet): ein neuer Bereich
"HealthCheck" in den Einstellungen der Anlage; dort HTTP-Aufrufe (URLs) an Dienste wie Healthchecks.io, Cronitor oder Better Stack eintragen, wie
oft sie laufen (1 Minute bis 24 Stunden, "schlaue" Eingabe), bis zu 5 Einträge, verwaltet in einem Fenster wie Töne, Routinen und Codes (Übersicht
mit Anzahl, "hinzufügen", "Liste anzeigen" mit eigenem Symbol; im Fenster nochmals "hinzufügen" und "Schliessen"; Tabelle mit Suche, sortierbar,
Zeilen mit URL, Zeitstempel, Intervall, Status; bearbeiten und löschen). Antworten auf die Rückfragen: **für alle Anlagen**; **Lebenszeichen +
Fehler** (Fehler, solange der Selbsttest Probleme hat); die URL **ganz zeigen und ins Backup** (Ausnahme vom Grundsatz "Geheimnisse nie zeigen",
im Log, in Meldungen und Befunden steht nur der Rechnername); die Einstellungen des Selbsttests (Abstand, "Jetzt prüfen") **ins Kapitel HealthCheck**.
21:50/21:54: **generisch** ohne Auswahl des Anbieters: URL und ein Fehler-Zusatz; die Erkennung bekannter Dienste **schlägt nur vor**, "der User soll
aber immer das letzte Wort haben"; weitere etablierte Dienste dürfen erkannt werden; je Eintrag ein Testknopf "Fehler senden" (dazu "Lebenszeichen
senden"). 21:58: die ganze README überarbeiten (Knopf "Buy Me a Coffee" bleibt), neue Bilder, HealthCheck erwähnen.

Eigene Entscheide der Prüfstelle (bitte prüfen): Fehler-Zusatz "/…" an den Pfad (vor der Abfrage, ein Schrägstrich am Ende fällt weg), "?…" oder
"&…" setzt Parameter (gleichnamige ersetzt), leer = nur Lebenszeichen; erkannt werden Healthchecks.io (`hc-ping.com` und selbst betrieben mit
`/ping/<uuid>`, `/fail`), Better Stack (`/heartbeat/`, `/fail`), Cronitor (`cronitor.link`, `?state=fail`), Uptime Kuma (`/api/push/`,
`?status=down`, nicht an einem echten Uptime Kuma geprüft); ein Wechsel des Selbsttests geht sofort hinaus, höchstens einmal je Minute und Dienst;
das fällige Lebenszeichen entfällt, wenn vor weniger als 10 Sekunden eines wegen eines Wechsels hinausging; erstes Lebenszeichen 30 Sekunden nach
dem Start; ein gescheitertes Lebenszeichen wird ein Problem des Selbsttests, zählt aber nicht für "Fehler" (sonst ginge nur noch "Fehler"
hinaus); Weiterleitungen werden befolgt; Testknöpfe nur für Administratoren, Ergebnis mit "(Test)" in der Zeile; Schnellwahl 1 min, 5 min,
15 min, 1 h, 6 h, 24 h; Kapitel vor "Backup"; der Titel des Fensters ohne Symbol (wie Routinen, Töne, Codes).

## 2. Änderungen

| Datei | Änderung |
| --- | --- |
| `panel/sensorview.js` | Reiter "Ereignisse" und "Regeln" über der Liste (`withPanes`: jeder Messwert und jeder Sensor in einer Regel der Überwachung). Suchfeld je Reiter (eigene Suche je Reiter), Tabellenkopf mit Sortierung nach jeder Spalte (Zeit absteigend als Standard; nach Zeit mit Tageszeilen, sonst steht der Tag bei der Uhrzeit). Die Leiste liegt in der Liste und scrollt mit, der Tabellenkopf bleibt stehen. Beim Tippen werden nur die Zeilen neu gezeichnet (Fokus bleibt). Reiter "Regeln": alle Regeln der Überwachung mit diesem Sensor aus allen Anlagen, Spalte "Regeln", Name und Bedingung in Worten (wie auf der Karte der Regel), Anlage (Desktop als Spalte, Handy unter der Bedingung, nur bei mehreren Anlagen), Zustand "Aktiv", "Aus" (Regel oder Überwachung der Anlage aus) oder "Ausserhalb" (gerade ausgelöst, orange), runder Pfeil (gesperrt, wenn die Überwachung der Anlage aus ist). Ohne Reiter (andere Sensoren) bleibt die Liste genau wie bisher. Grenzen: kein Filter mehr, die Grafik reicht bis zu jeder Grenze |
| `panel/alarmageddon-panel.js` | `openMonitorRule(entry, ruleId)`: andere Anlage nur über die Rückfrage bei offenen Änderungen (`_guard`), Konfiguration › Aktionen › Reiter "Überwachung", Suche der Liste leer, Regel aufgeklappt, 12 px unter der untersten festen Leiste, 2 s markiert (`ag-flash`). Eingaben in der Sensoransicht gehen an `sensorView.onInput` |
| `panel/styles.js` | `.ag-sv-lbar`, `.ag-sv-n`, `.ag-sv-sort`, `.ag-sv-rule`, `.ag-sv-state`, `.ag-sv-go`, `ag-flash` (ohne Bewegung bei "Bewegung reduzieren") |
| `panel/strings.js` | neue Texte EN/DE (`svPaneEvents`, `svPaneRules`, `svColRules`, `svColState`, `svSearchEvents`, `svSearchRules`, `svNoMatch`, `svNoRules`, `svRuleOn/Off/Out`, `svRuleOpen`, `svRuleMonOff`); `svColRule` bleibt "Regel"/"Rule" (in der ersten Fassung "Aktion") |
| `tests/panel/sim/ha-sim.html` | Grenzen der Sensoransicht aus den Regeln der Anlagen wie der Server (`sensor_history.monitor_limits`), statt fest 8 °C |
| `README.md`, `README.de.md` | Knopf "Buy Me a Coffee" (Link `https://www.buymeacoffee.com/Diego871`, Bild von `cdn.buymeacoffee.com`), zentriert direkt unter den Abzeichen, vor dem Link zur anderen Sprache. `width`/`height` als Attribute statt `style` (GitHub entfernt `style`, ebenso `target`) |
| `const.py`, `manifest.json` | `PANEL_VERSION` 226 auf 228 (227 in der ersten Fassung), Version 1.65.0 |


### 2a. Selbsttest (dritte Fassung)

| Datei | Änderung |
| --- | --- |
| `selftest.py` (neu) | Eine Instanz für alle Anlagen, Ablage `alarmageddon.selftest` (letzte Prüfung, Befunde, gemeldete Befunde; jeder Eintrag einzeln geprüft). `check_entry`/`check_global` lesen nur: Sensoren (fehlt), Geräte und Lautsprecher aller Listen der Aktionen samt Gruppen (fehlt, nicht erreichbar), Aktionen, Empfänger (Schritte, "Alarm endet", feste Meldungen, Benachrichtigungen), Push ohne Empfänger, eigene Töne, Adresse von HA, Regeln der Überwachung und Routinen (Entitäten, beschädigt), nicht geladene Anlagen. `async_note`/`async_resolve` für Probleme im Betrieb (synchron, fangen alles ab). Zeitpunkte: Start, Neuladen einer Anlage, Speichern der Benachrichtigungen, Takt alle 5 Minuten mit "fällig?", "Jetzt prüfen". Ausgabe: Reparaturen je Anlage und für alle, Signal an die Entitäten, Wartungsmeldung "Selbsttest" (je Problem einmal) |
| `__init__.py` | Selbsttest zuerst laden (hält fest, wenn ein Teil nicht startet: `_isolated(..., part)`), am Ende starten; `RuntimeData.routines`; Entladen stoppt ihn mit der letzten Anlage; Entfernen löscht die Reparaturen der Anlage (mit der letzten auch die Ablage) |
| `workflow.py` | `_bounded` mit den Geräten (`targets`), Ergebnis an den Selbsttest (`_selftest`, im `try`); Wächter (`_note`, `_selftest_hung_ok`) |
| `monitor.py`, `routines.py` | Schritt "Gerät schalten" der Überwachung an den Selbsttest; beschädigte Regeln und Routinen in `damaged` |
| `notify.py` | Meldung über einen Dienst gescheitert oder ohne Antwort: Problem, klappt sie wieder: behoben; Texte EN/DE der Meldung (`type_selftest`, `selftest_*`, `st_*`) |
| `backup.py` | gescheitertes automatisches Backup: Problem, das nächste, das klappt: behoben |
| `binary_sensor.py` | Entität "Selbsttest" je Anlage (`SelfTestSensor`, Problem, Diagnose, vor der ersten Prüfung unbekannt; Liste der Probleme nicht aufgezeichnet) |
| `sensor.py` | Statusentität zählt die Probleme mit (Attribute `selftest`, `selftest_last`) |
| `websocket_api.py` | `selftest_run`, `selftest_dismiss` (nur Administratoren, nur Probleme im Betrieb), Feld `selftest` in `data`, `selftest_hours` in `save_notify` (1 bis 24), nach dem Speichern neue Prüfung |
| `const.py`, `settings.py` | Meldungsart `selftest` (Gruppe Wartung, Standard an), `selftest_hours` (6, 1 bis 24), Zeiten und Grenzen des Selbsttests |
| `strings.json`, `translations/*.json` | Name der Entität, Reparaturen `selftest` und `selftest_global` (EN/DE) |
| `panel/selftest.js` (neu), `panel.html` | Zeile der Statuskachel, Fenster `#ag-selftest` mit Hilfe je Problem (Was ist los, Wo mit "Öffnen", Was das bedeutet, Ursachen, So behebst du es), "Erledigt", "Jetzt prüfen" |
| `panel/alarmageddon-panel.js` | Modul laden, Fenster, Klicks `data-st`, Statuskachel (Zeile immer, mit Problemen zählt sie), `openPlace` (Sprung zu Aktionen, Routinen, Sensoren, Benachrichtigungen) |
| `panel/notify.js` | Meldungsart "Selbsttest" unter den Wartungsmeldungen, Karte "Selbsttest alle N Std." (immer sichtbar) mit "Jetzt prüfen" |
| `panel/card.js` | Infokarte Status: Zeile "Selbsttest", Probleme zählen mit |
| `panel/strings.js`, `panel/styles.js`, `panel/common.js` | Texte EN/DE (rund 170 je Sprache), Stile `.ag-st-*`, Symbol `stethoscope`; Hinweis der Wartungsmeldungen nennt den Selbsttest statt der Updates |
| `tests/panel/sim/ha-sim.html`, `sim/card-sim.html` | Nachbau: `?selftest=problems`, `?selftest=none`, `selftest_run`, `selftest_dismiss`, Attribute der Statusentität |

### 2b. HealthCheck und README (dritte Fassung)

| Datei | Änderung |
| --- | --- |
| `healthcheck.py` (neu) | Eine Instanz für alle Anlagen, Ergebnisse in `alarmageddon.healthcheck`. Zeitgeber je Eintrag (Intervall, erstes Lebenszeichen 1 s nach dem Speichern, 30 s nach dem Start), Wechsel des Selbsttests (Signal) sofort, höchstens alle 60 s; GET mit 10 s Zeitgrenze als Hintergrundaufgabe; Ergebnis ok/http/timeout/error; Problem `ping_failed` (nur Rechnername), behoben mit dem nächsten Erfolg oder beim Entfernen; Log nur mit Rechnername |
| `settings.py` | `healthchecks` (Liste, je Eintrag geprüft: Kennung, http/https mit Rechnername, ohne Leerzeichen, höchstens 500 Zeichen; Zusatz; Intervall 60 bis 86400 s), `apply_fail_suffix`, `valid_fail_suffix` |
| `const.py` | `MAX_HEALTHCHECKS` 5, Grenzen und Zeiten (`HEALTHCHECK_*`, darunter `HEALTHCHECK_DEDUP` 10) |
| `__init__.py` | HealthCheck nach dem Selbsttest laden und starten (`_isolated(..., "healthcheck")`), mit der letzten Anlage stoppen, beim Entfernen der letzten die Ablage löschen |
| `websocket_api.py` | `healthcheck_save` (anlegen/ändern, `check_id` optional), `healthcheck_delete`, `healthcheck_ping` (`kind` ok/fail; "fail" ohne Zusatz abgelehnt), Felder `healthchecks` und `healthcheck_max` in `data` |
| `backup.py` | Dienste gehören zu den Einstellungen des Backups (Export, Prüfung, Wiederherstellen samt Neustart der Zeitgeber) |
| `selftest.py`, `notify.py` | Befund `ping_failed`, Teil `healthcheck`, Text der Meldung EN/DE |
| `panel/healthcheck.js` (neu), `panel.html` | Zeile im Kapitel, Fenster `#ag-hclist` (Tabelle, Suche, Sortierung, Testknöpfe, Bearbeiten, Entfernen mit Rückfrage), Formular `#ag-hcform` (URL, Erkennung, Vorschlag mit "Übernehmen", Vorschau des Fehleraufrufs, Intervall mit Zahl, Einheit und Schnellwahl) |
| `panel/system.js` | Kapitel "HealthCheck" vor "Backup": Selbsttest ("Jetzt prüfen", "Probleme anzeigen"), "Selbsttest alle N Std." als Entwurf der Seite (gespeichert mit `save_notify` nur `selftest_hours`), Zeile der Dienste |
| `panel/notify.js` | Karte des Selbsttests entfernt; der Entwurf sendet `selftest_hours` nie mit (sonst überschriebe ein älterer Entwurf den Wert aus dem Kapitel HealthCheck) |
| `panel/selftest.js`, `panel/alarmageddon-panel.js` | Fundstelle "HealthCheck" mit "Öffnen" (Konfiguration › Anlage, Liste offen), Grund des gescheiterten Lebenszeichens; Fenster, Klicks `data-hc`, Eingaben, Formular |
| `panel/strings.js`, `panel/styles.js`, `panel/common.js` | Texte EN/DE (`hc*`, `stEveryLabel`, `stEveryHint`, `stShow`, `st*_ping_failed`, `stR_ping_*`, `stP_healthcheck`), Hinweis der Meldung "Selbsttest" nennt das Kapitel; Stile `.ag-hc*`, `.ag-sthours`, `.ag-st-av`; Symbol `heartPulse`; `stWhen` EN ohne doppeltes "every" |
| `tests/panel/sim/ha-sim.html`, `tests/panel/readme-shots.mjs` | Nachbau `?hc=sample` (drei erfundene Dienste), `?hc=full` (fünf), WebSocket-Befehle wie der Server; Bilder `healthcheck`, `healthcheck-list` |
| `README.md`, `README.de.md` | ganz überarbeitet: Einleitung, "Was du bekommst" (Überwachung, "Behält sich selbst im Blick"), Einrichten (Konfiguration › Anlage), Sensoransicht (Regeln, Grenzen), Selbsttest (Lebenszeichen), neuer Abschnitt HealthCheck mit Bild, Sicherheit (HealthCheck, neue Zahlen), Grenzen; Knopf "Buy Me a Coffee" unverändert direkt unter den Abzeichen |

Beim Bauen gefunden und behoben: der erste Sprung zur Regel landete unter den festen Leisten (`scrollIntoView` lief, bevor die Liste nach dem
Laden der Geräte der Überwachung neu gezeichnet und die Höhe der Leisten gemessen war); und `CSS.escape` scheiterte, weil `CSS` in
`alarmageddon-panel.js` das Modul der Stile ist (jetzt `window.CSS.escape`). Beim HealthCheck: ein Test schlug zufällig fehl, weil nach dem
Speichern das erste Lebenszeichen und das Lebenszeichen wegen eines Wechsels des Selbsttests fast gleichzeitig hinausgingen (zwei Aufrufe in einer
Sekunde); jetzt entfällt das fällige, wenn eben eines hinausging (`HEALTHCHECK_DEDUP`, Test und Mutationszeile). Der Tabellenkopf der Liste klebte
hinter dem Kopf des Fensters (unsichtbar); jetzt darunter (`--ag-pophead`).

## 3. Doku

- `CHANGELOG.md`, `CHANGELOG.de.md`: Abschnitt 1.65.0 ("Includes the changes from 1.64.0"), 1.64.0 als nicht veröffentlicht, ohne Fussnote.
- `docs/MANUAL.md`, `docs/MANUAL.de.md`: Abschnitt der Messwerte der Überwachung (Grenzen, Reiter, Suche, Sortierung, Pfeil).
- `CHANGELOG.md`, `CHANGELOG.de.md`: dazu Selbsttest und HealthCheck (Hinzugefügt; der Selbsttest nennt den Abstand im Kapitel HealthCheck; kein Eintrag für den Umzug, die Einstellung war nie veröffentlicht).
- `docs/MANUAL.md`, `docs/MANUAL.de.md`: dazu Abschnitte "Selbsttest" (Abstand jetzt im Kapitel HealthCheck) und "HealthCheck" (neu, mit zwei
  Bildern), Inhalt, Benachrichtigungen, Sicherheitsmechanismen (Zeile HealthCheck, neue Zahlen), Grenzen, Zahlen und Grenzen, Backup.
- `CLAUDE.md`: Regeln "Sensoransicht der Überwachung", "Selbsttest" (Abstand im Kapitel HealthCheck) und "HealthCheck" (neu, mit der Ausnahme
  "URL ganz im Panel und im Backup"); `docs/DESIGN.md`: Abschnitt HealthCheck; `docs/HANDOVER.md`: Abschnitt 1.65.0; Mockup-README mit dem Entscheid.
- README: ganz überarbeitet (Abschnitt 2b), Knopf "Buy Me a Coffee" direkt unter den Abzeichen. Bilder siehe Abschnitt 4.

## 4. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py tests/*.py scripts/*.py` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1536 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1536 bestanden, 6 übersprungen |
| `python scripts/mutation_check.py` | 362 von 362 erkannt (neu: 7 Zeilen "Selbsttest", 8 Zeilen "HealthCheck"; eine Zeile nach einer Änderung des Musters einzeln nachgeprüft) |
| `cd tests/panel && node run.mjs` | 68 Suiten, 7351 Prüfungen, alle bestanden |
| `node --input-type=module --check` für alle Dateien unter `panel/` | ohne Fehler |
| `tests/test_translations.py` (README, CHANGELOG, Handbuch EN/DE gleich aufgebaut; "Backup" statt "Sicherung") | bestanden |
| Gesamtpatch auf `115d3fc` und Zusatzpatches auf die früheren Lieferungen, je mit `files/` verglichen | identisch (beim Packen geprüft) |

Neue Suite `healthcheck-e2e.mjs` (148 Prüfungen, je Sprache auf Desktop und Handy): Kapitel vor dem Backup mit Zeile, Symbol und Knöpfen; leeres
Fenster; Formular mit Fokus, Erkennung Healthchecks.io und Cronitor (Vorschlag folgt nur dem unberührten Feld, eigener Zusatz bleibt, "Übernehmen"),
Vorschau des Fehleraufrufs, Prüfungen (URL, Zusatz, Intervall) ohne Aufruf des Servers, Schnellwahl und Einheit; Speichern, Bearbeiten (Kennung,
Erkennung ersetzt nichts), Entfernen mit Rückfrage; Suche (Fokus bleibt, X, keine Treffer), Sortierung, Handy ohne seitliches Scrollen;
Testknöpfe (OK, Fehler, keine Antwort, "Fehler senden" ohne Zusatz gesperrt); fünf Dienste sperren "hinzufügen"; Tabellenkopf klebt sichtbar unter
dem Kopf des Fensters. Gegenprobe: ohne "der Nutzer hat das letzte Wort" (Vorschlag überschreibt) 8 bzw. 1 rot. `selftest-e2e.mjs` (114): Abstand und
"Jetzt prüfen" im Kapitel HealthCheck (Entwurf, ungültig 25, nur `selftest_hours` an den Server), Benachrichtigungen ohne Abstand und ohne
"Jetzt prüfen", ein Entwurf der Benachrichtigungen lässt den Abstand unberührt, Befund `ping_failed` (nur Host, "Öffnen" zur Liste), alle Texte
samt `ping_failed` und Teil `healthcheck`. `review-e2e.mjs`: Art "Selbsttest" in der Liste der Meldungen.

**Bilder:** neu `healthcheck-en/de.png` (Kapitel) und `healthcheck-list-en/de.png` (Fenster, erfundene Adressen), `selftest-en/de.png`; neu
aufgenommen, weil sich die Ansicht geändert hat: `overview`, `mobile`, `alarm` (Zeile des Selbsttests in der Statuskachel), `cards` (Zeile im
Status), `sounds` und `routines` (Kapitel HealthCheck auf der Seite). Alle übrigen Bilder sind byteweise unverändert (nach dem Verkleinern mit
`scripts/optimize_images.py` mit den Pixeln verglichen und, wo gleich, die bisherige Datei zurückgelegt).

## 5. Nicht geprüft und bekannte Grenzen

- **Echte Geräte und die echte Anlage**, Home Assistant 2026.11 selbst.
- **Ja/Nein-Sensoren:** Ereignisse der Überwachung, die ein Ja/Nein-Sensor ausgelöst hat ("Ausserhalb der Grenzen" einer Regel mit der Tür),
  stehen nicht in seiner Liste: der Server liefert sie nur für Messwerte, die Liste zeigt dort wie bisher Öffnungen und Ausfälle. Auf Wunsch
  ergänzen (Python und Panel).
- **Grenzen ausgeschalteter Regeln** erscheinen weiterhin als Linie in der Grafik (wie bisher); im Reiter "Regeln" steht dann "Aus".
- **Weit entfernte Grenze:** die Kurve wird entsprechend flach (so entschieden); eine Grenze von zum Beispiel 100 °C bei Werten um 5 °C lässt die
  Kurve fast als Linie erscheinen.
- **Push-Texte der Überwachung** tragen den Wert weiterhin mit Punkt (Server, aus 1.64.0 bekannt).
- **HealthCheck gegen echte Dienste** nicht geprüft (Prüfumgebung ohne Zugang nach aussen; geprüft mit dem Nachbau von aiohttp und im Panel-Nachbau).
  Die Fehler-Zusätze für Healthchecks.io, Better Stack und Cronitor stammen aus deren Unterlagen; der Vorschlag für Uptime Kuma (`?status=down`) ist
  aus dem Format der Push-URL abgeleitet und nicht an einem echten Uptime Kuma geprüft (die Quelle liess sich aus der Prüfumgebung nicht lesen). Es
  ist nur ein Vorschlag; der Nutzer entscheidet.
- **"Fehler senden"** lässt den Dienst bis zum nächsten Lebenszeichen auf Fehler (bei 24 Stunden Intervall einen Tag lang); "Lebenszeichen senden"
  stellt ihn sofort zurück. So gebaut, damit der Test sichtbar bleibt; auf Wunsch könnte nach einem Fehlertest automatisch wieder "in Ordnung" folgen.
- **Ausfall von Home Assistant:** Die Lebenszeichen bleiben aus, die Meldung kommt vom Dienst, nicht von Alarmageddon; wie schnell, bestimmt die
  Periode und die Karenzzeit beim Dienst.
- **README-Knopf:** nicht gerendert geprüft (das Bild liegt bei `cdn.buymeacoffee.com`, aus der Prüfumgebung nicht erreichbar). Wie GitHub und
  HACS ihn zeigen, bitte nach dem Push ansehen.

## 6. Release-Angaben

- Version, Tag und Titel: `v1.65.0`. Ziel: `main`, Commit nach dem Push. Vorabversion: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.65.0.md` (mit "Includes the changes from 1.64.0" und den Abschnitten beider Versionen).
- `PANEL_VERSION` 224 (1.63.0) auf 229, `manifest.json` 1.65.0. Neue WebSocket-Befehle: `selftest_run`, `selftest_dismiss`, `healthcheck_save`,
  `healthcheck_delete`, `healthcheck_ping` (alle nur für Administratoren, in `tests/test_security.py COMMANDS`).
