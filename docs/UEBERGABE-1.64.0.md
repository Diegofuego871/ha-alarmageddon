# Übergabe 1.64.0 (2026-11-18)

**Zweite Fassung** (ersetzt die ZIP-Datei von 17:05): dazu der Kopier-Knopf im Fenster "Anlage hinzufügen" (Wunsch 7, Abschnitt 2a), der Stand
der Ereignisse der Überwachung im Format der Sprache (2b) und Mockups zu Wunsch 8 (2c, nicht gebaut).
1.64.0 hat noch keinen Tag: nach der Regel bleibt es 1.64.0; `PANEL_VERSION` 226 (falls die erste Fassung schon installiert ist).

Lieferung der externen Prüfstelle. Basis ist `main` @ `115d3fc` (1.63.0, Tag `v1.63.0` auf `115d3fc`, vor Beginn mit `git pull` geholt und
geprüft). Weil eine neue Funktion dazukommt ("Code hinzufügen" direkt auf der Seite) und sich das Aussehen mehrerer Reiter ändert, ist es
1.64.0 und nicht 1.63.1. Zuerst dieses Protokoll, dann `docs/HANDOVER.md` (Abschnitt 1.64.0) und `CLAUDE.md` (neu: Design-Regeln "Reiter der
Modi" und "Hinzufügen und Anzeigen", ausführlich in `docs/DESIGN.md`).

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.64.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.64.0.md`) |
| `RELEASE-NOTES-1.64.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.64.0-auf-1.63.0.patch` | alle Änderungen als ein Patch gegen `main` @ `115d3fc` (mit den Bildern, binär) |
| `files/` | jede geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |
| `mockups/` | Mockups zu Wunsch 8 zum Ansehen (dieselben Dateien liegen unter `files/docs/mockups/sensorview-regeln-v1/`) |

Anwenden: `git checkout main && git pull` (Stand muss `115d3fc` sein), dann `git apply --index 1.64.0-auf-1.63.0.patch`, oder den Inhalt
von `files/` über das Repository kopieren. **Es ist keine Datei zu löschen.** Danach die Prüfungen aus Abschnitt 4, Commit mit Betreff
`1.64.0: Code hinzufügen auf der Seite, Kapitel Backup wie die anderen, eigene Symbole für "anzeigen", Reiter der Modi überall gleich, Deutsch "Backup", Entitäts-ID kopieren`, Push auf `main`,
Release-Angaben aus Abschnitt 6. Die Lieferung ändert keine Datei unter `.github/` und keine Python-Logik (nur `PANEL_VERSION`; neu ein Test
in `tests/test_translations.py`).

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass

Bildschirmfotos und Wünsche des Nutzers vom 2026-11-18 (vom Handy, die letzten zwei vom Desktop; Home Assistant mit 1.63.0):

1. 15:43: Bei den Codes, wie bei Routinen und Tönen, ein eigenes Symbol für "Codes anzeigen" (ein Schlüssel); Töne, Routinen und Codes je ihr
   eigenes Symbol für "anzeigen". Das Plus bleibt bei allen gleich. Alle drei Zeilen mit demselben Aufbau.
2. 15:44: "Sicherungen anzeigen" hatte dasselbe Symbol wie "Routinen anzeigen": ebenfalls ein eigenes Symbol.
3. 15:46: Das Farbkonzept der Reiter der Modi (Aktionen: rote Symbole, roter Rand, "Überwachung" orange) überall, wo zwischen den Modi
   gewechselt wird oder "Einstellungen pro Modus" angeboten wird (Bildschirmfotos: Aktionen, Sensoren, Benachrichtigungen, Anlage).
4. 15:48: Bei den Codes links ein Knopf, um einen Code hinzuzufügen, ohne zuerst die Liste zu öffnen; er öffnet dasselbe Fenster wie
   "Code hinzufügen" in der Liste.
5. 16:21: Im Kapitel "Sicherung (alle Anlagen)" durchgängig das Wort "Backup" statt "Sicherung" verwenden.
6. 16:22: Der Knopf "Backup erstellen" soll neben "Sicherungen anzeigen" stehen, wie in den anderen Abschnitten.
7. 17:39 (Bildschirmfoto vom Handy, Fenster "Alarmanlage hinzufügen"): neben der Alarm-Entität einen Knopf "In die Zwischenablage kopieren".
8. 17:43 (Bildschirmfotos der Sensoransicht "Kühlschrank Küche" und "Kühlschrank Reduit"): warum die Grenze der Regel nur bei der Küche in der
   Grafik steht; Wunsch: unter der Grafik zwei Reiter, Ereignisse und die Regeln, in denen das Gerät vorkommt, beide durchsuchbar und sortierbar,
   ein Klick auf eine Regel führt zu ihr. Nach der Projektregel "vor grösseren UI-Änderungen Mockups" zuerst Mockups (2c).

Keine Rückfrage nötig: die Wünsche waren eindeutig. Auslegung bei 5: "durchgängig" gilt für alle deutschen Texte des Panels zum Backup (auch
Fenster, Fehlermeldungen, "Anlage löschen") sowie README.de und MANUAL.de, nicht nur für das Kapitel. Auslegung bei 6: das Kapitel ist jetzt
gleich aufgebaut wie "Codes pro Person": die Zeile mit beiden Knöpfen steht oben in der Karte, der Hinweis über der Karte (wie bei Routinen,
Tönen und Codes), darunter das automatische Backup. Wünscht der Nutzer die alte Reihenfolge (automatisches Backup oben), ist das eine Zeile.

## 2. Änderungen

| Punkt | Datei | Änderung |
| --- | --- | --- |
| 1, 2 | `panel/common.js` | Neue Symbole `key` (Schlüssel: Ring links unten, Bart rechts oben, um 45 Grad gedreht) und `archive` (Kiste mit Deckel und Griff), selbst entworfen im Stil der übrigen Symbole (gefüllt, 24er-Raster) |
| 1 | `panel/system.js` | "Codes anzeigen" mit `key` statt `groups`; Routinen behalten `groups`, eigene Töne `speaker` |
| 2 | `panel/system.js` | "Backups anzeigen" mit `archive` statt `groups` |
| 6 | `panel/system.js` | Kapitel "Backup": erste Zeile `.ag-rtsum.ag-bklast` mit Symbol `archive` (blau, sobald es ein Backup gibt), "Letztes Backup" mit Datum, links "Backup erstellen" (`bk-create`), rechts "Backups anzeigen" (`bk-open`); darunter "Automatisches Backup"; der Hinweis `bkHint` steht als Hinweis des Kapitels über der Karte. Bisher: automatisches Backup, Hinweis mit "Backup erstellen", "Letzte Sicherung" mit "Sicherungen anzeigen" in drei Zeilen. "Noch kein Backup" ist fett wie "Noch keine Codes" |
| 5 | `panel/strings.js` | 31 deutsche Texte: "Backup" statt "Sicherung" (Titel, Knöpfe, Zähler, Hinweise, Fenster, Wiederherstellen, Fehlermeldungen, "Anlage löschen"); Artikel angepasst ("das Backup", "Letztes Backup:", "Noch kein Backup", "Automatisches Backup" statt "Automatisch sichern"). Englisch unverändert |
| 4 | `panel/system.js` | Zeile "Codes pro Person": links "Code hinzufügen" (`code-add-page`, Plus, bei 20 Codes gesperrt), rechts "Codes anzeigen"; der Knopf ruft dasselbe `openCodeForm()` wie `code-add` im Fenster der Liste. Die Liste bleibt dabei zu |
| 1 | `panel/styles.js` | Auf dem Handy sind die beiden Knöpfe einer Zeile `.ag-rtsum` gleich breit, wenn sie nebeneinander passen (Routinen, eigene Töne, Codes); reicht der Platz nicht, bricht die Zeile wie bisher um |
| 3 | `panel/sensors.js`, `actions.js`, `notify.js`, `system.js` | Reiterleisten `sen-mode`, `wf-trigger`, `nt-mode`, `sys-scope` mit Klasse `ag-modeseg` |
| 3 | `panel/styles.js` | Farben der Reiter der Modi über `.ag-seg.ag-modeseg` statt über `:has([data-trigger="monitor"])`: Symbole dunkelrot (`--ag-seg-alarm`), "Überwachung" orange (`--ag-seg-monitor`), der gewählte Reiter mit Rand in der Farbe seiner Gruppe, Text neutral, nicht gewählte Symbole gedämpft. Bis 1.63.0 nur in den Aktionen und nur mit eingeschalteter Überwachung |
| | `const.py`, `manifest.json` | `PANEL_VERSION` 224 auf 226 (225 in der ersten Fassung), Version 1.64.0 |

Hauptreiter, Unterreiter (Sensoren, Aktionen, Benachrichtigungen, Anlage) und alle anderen Reiterleisten bleiben blau (geprüft).

Die Symbole im Überblick: Routinen anzeigen `groups` (Liste), eigene Töne anzeigen `speaker`, Codes anzeigen `key`, Backups anzeigen
`archive`; "… hinzufügen" und "Backup erstellen" mit demselben Plus.

## 2a. Kopieren der Entitäts-ID (Wunsch 7)

- Fenster "Anlage hinzufügen": hinter `alarm_control_panel.<name>` ein runder Knopf mit dem Kopieren-Symbol (Beschriftung "Alarm-Entität
  kopieren"). Er kopiert die ganze ID, auch wenn sie umbricht; Rückmeldung am Knopf (Häkchen, bei Misserfolg ein Warnzeichen), nach 1,6 s wieder das
  Symbol. Das Fenster bleibt offen, nichts wird angelegt. Nur die Alarm-Entität hat den Knopf (der Name des Geräts steht im Feld darüber).
- Gemeinsam mit der Sensoransicht: `common.js copyBtn` (Knopf) und `copyValue` (Kopieren). Die Sensoransicht hatte das bisher für sich
  (`sensorview.js _copy`); sie nutzt jetzt dieselben Funktionen, ihr Verhalten ist unverändert (`sensor-e2e` grün). Ohne Zugriff auf
  `navigator.clipboard` (Companion App, kein HTTPS) geht es über ein verstecktes Textfeld im Fenster und `execCommand("copy")`.
- Die Zeile bleibt so hoch wie der Text (negativer Rand am Knopf): das Fenster springt beim Tippen nicht (Prüfung in `addsystem-e2e`).

## 2b. Stand der Ereignisse der Überwachung (beim Mockup gefunden)

Die Sensoransicht zeigte den Stand eines Ereignisses so, wie der Server ihn ablegt (`monitor._format`: "9.2"), also auch auf Deutsch "9.2 °C". Jetzt im
Format der Sprache ("9,2 °C"), nur in der Anzeige (`sensorview.js _monitorEventsHtml`). Nicht geändert: die Push-Texte der Überwachung tragen den Wert
weiterhin mit Punkt (Server). `measure-e2e` prüft jetzt je Sprache genau (mit der alten Zeile 2 rot).

## 2c. Mockups "Sensoransicht: Ereignisse und Regeln" (Wunsch 8, nicht gebaut)

`docs/mockups/sensorview-regeln-v1/` mit `README.md`, acht Bildern (Handy und Desktop) und Quelle `src/shots.mjs` (echte Sensoransicht im Nachbau,
Liste durch die Varianten ersetzt). Ursache der fehlenden Grenze: `sensorview.js _valueLine` zeigt eine Grenze nur, wenn sie höchstens zwei
Spannweiten neben den Werten liegt (Küche 6,6 bis 11,5 °C: bis 21,3 °C sichtbar; Reduit 4,8 bis 6,1 °C: nur bis 8,7 °C). Die Grenze der Regel
des Reduits ist hier nicht bekannt; ist sie höher als 8,7 °C, ist das die Ursache. Varianten A (zwei Reiter, Empfehlung) und B (Regeln als
Karten über den Ereignissen), dazu eine Marke am Rand für eine Grenze ausserhalb. Offene Fragen im README des Mockups. Wird es gebaut, ist es eine
neue Version (neue Funktion).

## 3. Doku

- `CHANGELOG.md`, `CHANGELOG.de.md`: Abschnitt 1.64.0 mit Link.
- `docs/MANUAL.md`, `docs/MANUAL.de.md`: "Mehrere Anlagen" nennt die Vorschau und das Kopieren der Entitäts-ID; Abschnitte "Codes pro Person im Panel" und "Backup" nennen beide Knöpfe; Deutsch "Backup" statt
  "Sicherung" (auch Inhaltsverzeichnis, Grenzen, Überschrift "Routinen, Backup und HomeKit im Detail"). `README.de.md`: zwei Stellen.
- `docs/mockups/sensorview-regeln-v1/`: neu (2c).
- `docs/DESIGN.md`: neue Abschnitte "Reiter der Modi" und "Zeilen Hinzufügen und Anzeigen"; `CLAUDE.md` mit diesen Regeln in Kurzform und
  der Regel "Backup, nie Sicherung".
- `docs/HANDOVER.md`: Abschnitt 1.64.0.
- README: sonst unverändert (der Text nennt weder die Knöpfe noch die Farben der Reiter). Bilder siehe Abschnitt 4.

## 4. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components tests scripts` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1460 bestanden, 6 übersprungen (1.63.0: 1459; neu `test_german_says_backup`) |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1460 bestanden, 6 übersprungen |
| Tests, die Panel-Dateien lesen (`test_alarm_kinds`, `test_dashboard_card`, `test_panel_preload`, `test_security`, `test_translations`, `test_websocket`) | 238 bestanden, nach der letzten Änderung (die beiden vollen Läufe darüber liefen davor; danach änderten sich nur Panel-Dateien, Tests und Doku) |
| `cd tests/panel && node run.mjs` | 65 Suiten, 6967 Prüfungen, alle bestanden (ein vollständiger Lauf mit dem endgültigen Stand; erste Fassung 6947; 1.63.0: 64 Suiten, 6809) |
| `node --input-type=module --check` für alle Dateien unter `panel/` | ohne Fehler |
| `python scripts/mutation_check.py` | nicht gelaufen: keine Python-Logik geändert (nur die Zahl `PANEL_VERSION` und ein neuer Test) |
| Patch auf einem sauberen Stand `115d3fc` angewendet und mit `files/` verglichen | identisch |

Gegenproben mit dem alten Stand (Panel-Dateien von 1.63.0, neue Tests): `modetabs-e2e` 46 rot, `sumrow-e2e` rot (bricht bei der Zeile Backup
ab, vorher 25 rot ohne sie), `codes-e2e` Abbruch (kein Knopf auf der Seite), `autobackup-e2e` Abbruch (kein Symbol `archive`),
`test_german_says_backup` rot mit dem alten `strings.js`, `addsystem-e2e` rot mit den Panel-Dateien von 1.63.0 (kein Kopier-Knopf),
`measure-e2e` 2 rot ohne die Formatierung des Stands.

Neue Suite `modetabs-e2e.mjs` (73 Prüfungen: alle vier Leisten, hell und dunkel, Desktop und Handy, mit Überwachung). Angepasst:
`sumrow-e2e` (Zeilen Codes und Backup, vier verschiedene Symbole, gleich breite Knöpfe; 112), `codes-e2e` (Knopf auf der Seite, gesperrt bei
20; 296), `autobackup-e2e` (Zeile mit beiden Knöpfen oben, Hinweis über der Karte, Symbol, kein "Sicherung" in Kapitel und Fenster; 96),
erwartete Texte in `hardening`, `popsearch`, `deletesystem`, `restoremap`; `addsystem-e2e` (Kopier-Knopf: Lage, Zwischenablage, Weg über
das Textfeld, Warnzeichen; 88), `measure-e2e` (Stand je Sprache; 128).

**Bilder:** `actions-*`, `actions-disarm-*`, `group-*`, `silent-*` (Reiter der Modi) und `sounds-*` (Kapitel Backup darunter) neu aufgenommen
und mit denselben Einstellungen wie `scripts/optimize_images.py` verkleinert (nur diese zehn Dateien). Alle Bilder wurden mit dem alten und
dem neuen Panel aufgenommen und Pixel für Pixel verglichen: die übrigen 22 unterscheiden sich nur in Uhrzeiten (Zeitpunkt der Aufnahme) und
bleiben unverändert. Kein Bild zeigt die Zeile "Codes pro Person".

## 5. Nicht geprüft und bekannte Grenzen

- **Die echte Anlage und echte Geräte**, Home Assistant 2026.11 selbst (das Testpaket gibt es erst für 2026.10.4).
- **Push-Texte der Überwachung:** der Wert steht dort weiterhin mit Punkt ("9.2 °C"), auch auf Deutsch (Server, nicht Teil dieser Lieferung).
- **Wortwahl:** Code-Kommentare und Docstrings sagen weiter "Sicherung" (intern, nicht sichtbar), ebenso frühere Einträge im CHANGELOG
  (Geschichte). Das Handbuch nennt auch die Sicherung von Home Assistant selbst jetzt "Backup" (wie Home Assistant sie im deutschen Menü
  nennt, ist hier nicht geprüft).
- **Nachbau und Handy:** Im Nachbau brechen die Knöpfe der Zeilen Routinen, Codes und (deutsch) Backup bei 390 px Breite untereinander um, weil die Schrift
  des Nachbaus breiter ist als die von iOS; auf den Bildschirmfotos des Nutzers stehen sie nebeneinander. Geprüft ist: stehen die Knöpfe
  nebeneinander, sind sie gleich breit (`sumrow-e2e`, Englisch); untereinander nimmt jeder die ganze Breite (im Nachbau gesehen, keine eigene
  Prüfung). Auf dem echten Handy nicht geprüft.
- **Symbole:** `key` und `archive` sind eigene Entwürfe (keine Kopie eines Symbolsatzes), bei 18 px im Nachbau angesehen (hell und dunkel).
  Ob sie dem Nutzer gefallen, entscheidet er; Alternativen auf Wunsch.
- **Farbe der Reiter:** In den Reitern ohne Überwachung (Sensoren, Benachrichtigungen, Anlage) gibt es nur Dunkelrot. Ob Dunkelrot dort die
  richtige Bedeutung trägt (es ist die Farbe der Zone "Alarm"), ist eine Entscheidung des Nutzers; umgesetzt wie gewünscht.

## 6. Release-Angaben

- Version, Tag und Titel: `v1.64.0`. Ziel: `main`, Commit nach dem Push. Vorabversion: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.64.0.md`.
- `PANEL_VERSION` 224 auf 226, `manifest.json` 1.64.0. Keine neuen WebSocket-Befehle, keine neuen Texte in `strings.js`.
