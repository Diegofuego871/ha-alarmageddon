# Design

Gleiche Gestaltung wie ha-device-panel: ruhig, HA-nah, hell und dunkel über
die Theme-Variablen von Home Assistant. Vollständige Vorlage mit allen
Entscheiden dort: `docs/reference/device-panel-DESIGN.md`. Diese Datei hält
fest, was Alarmageddon davon übernimmt und was eigen ist.

## Farben (CSS-Variablen, Präfix `--ag-`)

```css
:host {
  --ag-card: var(--card-background-color, #fff);
  --ag-text: var(--primary-text-color, #212121);
  --ag-text2: var(--secondary-text-color, #727272);
  --ag-text3: var(--disabled-text-color, #9e9e9e);
  --ag-divider: var(--divider-color, rgba(0,0,0,0.12));
  --ag-primary: var(--primary-color, #03a9f4);
  --ag-success: var(--success-color, #43a047);
  --ag-warning: var(--warning-color, #ff9800);
  --ag-error: var(--error-color, #db4437);
  --ag-subtle: color-mix(in srgb, var(--ag-text) 4%, var(--ag-card));
  --ag-primary-soft: color-mix(in srgb, var(--ag-primary) 14%, transparent);
  --ag-input: var(--primary-background-color, #fff);
  --ag-shadow: 0 10px 30px rgba(0,0,0,0.25);
}
```

Zustände der Alarmanlage: deaktiviert = `--ag-success`, scharf (anwesend,
abwesend) = `--ag-primary`, Verzögerung läuft = `--ag-warning`, ausgelöst =
`--ag-error`. Sensoren: OK = `--ag-success`, Achtung = `--ag-warning`,
offline = `--ag-error`, keine Daten = `--ag-text3`.

## Formen und Abstände (wie ha-device-panel)

- Karten und Dialoge: Radius 16–22 px, Schatten `--ag-shadow`, Innenabstand
  20 px (Handy 12–16 px).
- Knöpfe: Pill-Form, 36 px rund für Symbolknöpfe.
- Kacheln: Titel 12 px `--ag-text2`, Wert 20–24 px, Untertitel 12 px,
  Pfeil-Knopf unten rechts, wenn antippbar.
- Symbole: Material Design Icons als SVG-Pfade im Code (kein `ha-icon` im
  iframe).

## Layout (responsiv, Vorgabe des Nutzers)

- Panel als eingebautes iframe-Panel (siehe LEARNINGS).
- Desktop: volle Breite nutzen. Kacheln im Raster mit `auto-fill`, das sich
  an die Breite anpasst; Editoren zweispaltig (Liste links, Bearbeitung
  rechts). Keine fest schmale Mittelspalte.
- Sensorkarten: immer gleich hoch (1.29.0). Name drei Zeilen mit "…", feste Höhen für alle weiteren Zeilen, fehlende Angaben als "–".
- Handy (Companion App): einspaltig, Trefferflächen mindestens 44 px,
  Antippen als Ersatz für Ziehen, Blätter von unten, Safe-Area beachten.
- Breite < 600 px: Dialoge als Blatt von unten, Reiter mit Kurzbeschriftung.

## Interaktion (wie ha-device-panel)

- Toasts für Bestätigungen; in einem offenen Dialog die Bestätigung im
  Dialog selbst.
- Alles mit Tastatur bedienbar, `aria-label` auf Symbolknöpfen.
- Ziehen mit Griff, Zeile hebt sich ab, Pfeiltasten verschieben.
- Einheitlich speichern: Entwurf, "Abbrechen", "Speichern", Rückfrage beim
  Schliessen mit Änderungen.

- **Tabellenkopf klebt immer:** Die oberste Zeile jeder Tabelle (Beschriftung, Filtern, Sortieren) scrollt nie weg, auch auf dem Handy. Dort scrollen die Filter weg, die Tabelle passt ohne seitliches Rollen (`overflow: clip` statt `auto`; ein Rollbereich verhindert `position: sticky`). Fallback bei zu vielen gewählten Spalten: Klasse `hscroll` (seitlich wischen, Kopf klebt dann nicht).

## Schalter links, Text rechts (Grundregel, Vorgabe des Nutzers, 2026-11-11)

- Jeder Schalter (`.ag-toggle`) steht links, sein Text rechts davon und nahe dabei; der Text wächst nach rechts. So ist auf einem breiten Bildschirm wie auf dem Handy klar, welcher Schalter zu welcher Option gehört.
- Reihenfolge in einer Zeile: Schalter, Symbol der Option (falls vorhanden), Titel mit Beschreibung. Höchstens das Symbol steht zwischen Schalter und Text.
- Umsetzung zentral in `styles.js`: `.ag-orow`, `.ag-ef-row`, `.ag-setrow`, `.ag-colrow`, `.ag-schrow` setzen den Schalter mit `order: -1` nach vorn; `.ag-pmsw`, `.ag-mt-head` und `.ag-mt-opt.sw` haben ihn im Markup vorn. Eine neue Zeilenart wird dort ergänzt.
- In einer Zeile aus Eingabefeldern (Zeitplan) steht der Schalter ebenfalls links, vor Uhrzeit und Aktion.
- Ausnahme: Schalter in Tabellenzellen (Spalte "Eingangsverzögerung"); dort ist der Spaltenkopf die Beschriftung.
- Test: `tests/panel/suites/switches-e2e.mjs` prüft alle Reiter der Konfiguration und alle Fenster mit Schaltern, je Sprache auf Desktop und Handy.

## Vorgehen bei neuen Ansichten

Erst Mockup (HTML, Deutsch, erfundene Daten, Desktop und Handy, 2–4
Varianten mit Empfehlung), Nutzer wählt, dann umsetzen und mit Screenshots
aus dem HA-Nachbau prüfen.

## Offen

- Icon und Logo: vorerst bleibt das Schild mit A (Entscheid des Nutzers, 2026-11-08). Vorschläge mit Katze in `docs/mockups/brand-v1`. Ein Push-Bild mit 20 % Rand fehlt noch (kommt mit den Push-Meldungen).
- Die Konzept-Mockups (`docs/mockups/konzept-v1`) nutzen noch eine eigene
  Farbwelt; die echten Mockups pro Ansicht folgen dieser Datei.

## Orange Punkte (Vorgabe des Nutzers, 2026-11-10)

Ein orange Punkt bedeutet immer "ungespeicherte Änderung" (Punkt am Reiter, `has-edit`). Andere Markierungen sind blau (`--ag-primary`), zum Beispiel der Punkt für einen eigenen Wert am Sensornamen (`.ag-owndot`) und am Kästchen (`.ag-box.own`). Verschwindet ein orange Punkt nach dem Speichern nicht, ist das ein Fehler.

## Reiter der Modi (Vorgabe des Nutzers, 2026-11-18, seit 1.64.0)

Jede Reiterleiste, die zwischen den Modi wechselt ("Einstellungen pro Modus"), trägt die Klasse `ag-modeseg` und sieht überall gleich aus: Sensoren (`sen-mode`), Aktionen (`wf-trigger`), Benachrichtigungen (`nt-mode`) und Anlage (`sys-scope`). Spur und Text neutral, die Symbole im Dunkelrot der Zone "Alarm" (`--ag-seg-alarm`), der Reiter "Überwachung" orange (`--ag-seg-monitor`); der gewählte Reiter hat einen Rand in der Farbe seiner Gruppe und ein volles Symbol, die anderen sind gedämpft. Hauptreiter, Unterreiter und alle übrigen Leisten bleiben blau. Eine neue Leiste der Modi bekommt dieselbe Klasse, keine eigene Gestaltung. Test: `tests/panel/suites/modetabs-e2e.mjs`.

## Zeilen "Hinzufügen" und "Anzeigen" (Vorgabe des Nutzers, 2026-11-18, seit 1.64.0)

Kapitel mit einer Liste in eigenem Fenster (Routinen, eigene Töne, Codes pro Person, Backup) haben dieselbe Zeile `.ag-setrow.ag-rtsum` als erste Zeile der Karte: Symbol und Zusammenfassung, dahinter zwei Knöpfe: zuerst "… hinzufügen" mit dem Plus (öffnet direkt das Formular; beim Backup "Backup erstellen"), dann "… anzeigen" mit eigenem Symbol. Weitere Einstellungen des Kapitels folgen darunter, der Hinweis steht über der Karte (`chapter(..., hint)`). Das Plus ist überall gleich; jedes "Anzeigen" hat sein Symbol: Routinen `groups`, eigene Töne `speaker`, Codes `key`, HealthCheck `heartPulse`, Backups `archive`. Auf dem Handy sind beide Knöpfe gleich breit, wenn sie nebeneinander passen. Test: `tests/panel/suites/sumrow-e2e.mjs`.

Knöpfe in Fenstern mit Liste (seit 1.66.1, Wunsch des Nutzers 2026-11-19: "ein Konzept, das überall gleich ist"): je Zeile runde Knöpfe
`.ag-wf-btns` (44 px, Rand) wie bei Routinen, Regeln und Schritten, nie nackte Symbole: Routinen, HealthCheck-Dienste, Codes pro Person, eigene
Töne, Backups. Auf dem Handy in einer eigenen Zeile unter dem Eintrag, wenn sie neben Name und Angaben keinen Platz haben (HealthCheck, Töne,
Routinen, Backups; bei den Codes reichen zwei Knöpfe daneben). Fusszeile: "Schliessen" weiss (`ag-btn`), die Hauptaktion blau rechts daneben;
ohne Hauptaktion steht "Schliessen" allein rechts, ebenfalls weiss. Spalten, die nichts zeigen (etwa ein Platzhalter für einen Code, der nur
als Hash existiert), gibt es nicht. Tests: `codes-e2e.mjs`, `customsounds-e2e.mjs`, `hardening-e2e.mjs`, `healthcheck-e2e.mjs`.

Sensortabelle unter Konfiguration › Sensoren (seit 1.66.1, Wunsch des Nutzers 2026-11-19): am Ende jeder Zeile dieselben runden Knöpfe
`.ag-wf-btns.ag-senbtns`: am Computer Papierkorb und Stift (Stift ganz rechts), auf dem Handy nur der Stift. Der Stift öffnet die
Einstellungen des Sensors und ersetzt den Pfeil. Tests: `layout-e2e.mjs`, `pick-e2e.mjs` (Computer und Handy).

Farbe der Kapitel (seit 1.66.0, Wunsch des Nutzers 2026-11-19): das Symbol (`.ag-oav`) jedes Kapitels unter Konfiguration › Anlage hat eine
eigene, leichte Farbe, damit sich die Kapitel abheben; sonst ändert sich nichts. Klasse `ag-tint ag-tint-<kapitel>` mit `--ag-tint`, Grund 15 %
der Farbe, nur im Zustand `on` (ein leeres Kapitel bleibt grau): Routinen violett `#7e57c2`, Codes pro Person türkis `#00897b`, eigene Töne
indigo `#3f51b5`, HealthCheck-Dienste pink `#d81b60`, Backup (Letztes Backup und automatisches Backup) braun `#8d6e63`; im dunklen Thema hellere
Töne. Nie Blau (Hauptfarbe), Grün, Gelb oder Rot (Zustände): der Selbsttest behält seine Farbe nach dem Ergebnis. Neue Kapitel bekommen eine
eigene, noch freie Farbe. Test: `healthcheck-e2e.mjs`.

"Was ist im Backup?" (seit 1.66.0, Wunsch des Nutzers 2026-11-19): Info-Zeile `<details class="ag-st-about ag-bk-about">` über der Karte des
Backups, zu; aufgeklappt eine Liste, was enthalten ist und was nicht (Codes, Protokoll, Verlauf, Zustände, Ergebnisse); bleibt offen, wenn die
Seite neu gezeichnet wird (`SystemUi.bkAboutOpen`). Stil wie "Was prüft der Selbsttest?". Test: `autobackup-e2e.mjs`. Ebenso "Was sind
HealthCheck-Dienste?" unter der Liste im Fenster der Dienste (seit 1.67.0, `HealthCheckUi.aboutOpen`, Beispiele als Links); Test: `healthcheck-e2e.mjs`.

Symbol des Kapitels im Fenstertitel (seit 1.67.0, Wunsch des Nutzers 2026-11-19): Fenster eines Kapitels unter Konfiguration › Anlage (Listen,
Vorschau und Formulare: Routinen, eigene Töne, Codes pro Person, HealthCheck-Dienste, Selbsttest, Geprüft, Backups) tragen links im Titel dieselbe
getönte Kachel wie ihre Zeile (`common.js iconTitle`, `.ag-ttl-av`), immer in Farbe, etwas grösser: Computer 42 px, Handy 38 px (Zeile 36 px). Der
Selbsttest nimmt seine Farbe nach dem Ergebnis (`SelfTestUi.tone`). Rückfragen (Löschen?) bleiben ohne Symbol. Test: `sumrow-e2e.mjs`.

Breite der Fenster (seit 1.67.0, Wunsch des Nutzers 2026-11-19): Listen und Formulare haben am Computer die Standardbreite `dialog.ag-wide`
(880 px), auch ein Formular über einer Liste (`#ag-hcform`, `#ag-codes` mit `SystemUi._codeDlg(true)`); Rückfragen bleiben schmal (420 px,
`_codeDlg(false)`). Handy: immer ganzer Bildschirm. Noch schmal und nicht angeglichen: Anlage hinzufügen, Umbenennen, Ansicht. Tests:
`healthcheck-e2e.mjs`, `codes-e2e.mjs`, `hardening-e2e.mjs`.

## Selbsttest (seit 1.65.0, Wunsch des Nutzers vom 2026-11-18)

- Statuskachel der Übersicht: eine Zeile "Selbsttest" steht immer da (auch bei "Alles in Ordnung"), mit "geprüft vor …" darunter und dem Pfeil wie
  die anderen Zeilen. Symbol Stethoskop (`stethoscope`), grün ohne Befund, gelb mit Befunden, rot, wenn ein Befund einen Alarm verhindern oder stumm
  machen kann. Mit Befunden zählt die Zeile bei "N brauchen Aufmerksamkeit" mit (eine Zeile, wie "Nicht erreichbar" und "Batterie schwach").
  Seit 1.68.0 (Wunsch des Nutzers 2026-11-19, 18:36, ohne Mockup): sind HealthCheck-Dienste eingerichtet, ist diese Zeile in der Mitte geteilt
  (`.ag-row.ag-split`, zwei `.ag-half`, Linie dazwischen, gleich hoch wie vorher): links "Selbsttest" mit Stethoskop und Zustand ("keine Probleme",
  "1 Problem"), rechts "HealthCheck" mit Herz (grün alle in Ordnung, orange Fehler gemeldet, rot gescheitert, grau noch nichts gesendet), die Zeit
  der Prüfung im Tooltip; auf dem Handy ohne Pfeil (die ganze Hälfte ist der Knopf). Ohne Dienste wie bisher, ohne Einladung, einen einzurichten.
  Seit 1.72.0 (Wunsch des Nutzers 2026-11-20, 14:01) gleich in der Statuskarte für Dashboards (`card.js _splitRow`), dort ohne Pfeil (die Karte
  öffnet keine Fenster des Panels); Zahlen aus den Attributen der Statusentität.
- Fenster `#ag-selftest` (breit, auf dem Handy ganzer Bildschirm): Kopf mit letzter und nächster Prüfung und dem Abstand; je Anlage eine
  Überschrift, die gemeinsamen Befunde unter "Alle Anlagen". Je Befund eine Karte mit farbigem Rand links (gelb, rot), zugeklappt Titel und Art
  ("Einrichtung", "Im Betrieb"); aufgeklappt die Abschnitte "Was ist los?", "Wo" (Fundstellen als Wege wie im Panel, je mit "Öffnen"), "Was das
  bedeutet", "Mögliche Ursachen" (Liste), "So behebst du es" (nummeriert) und eine Fusszeile (bei Befunden im Betrieb mit "Erledigt"). Bis zwei
  Befunde sind aufgeklappt, sonst der erste. Unten rechts "Schliessen" und "Jetzt prüfen" nebeneinander (Wunsch des Nutzers 2026-11-19, wie in
  allen Fenstern); darüber "Was prüft der Selbsttest?" zum Aufklappen.
- Liste "Geprüft" (Wunsch des Nutzers 2026-11-19): runder Pfeil (`.ag-cbtn`) rechts in der Karte "Keine Probleme gefunden" (mit Befunden in einer
  eigenen Karte "N Einträge geprüft" unter den Befunden). Fenster `#ag-stchecked` über dem Selbsttest: Kopf mit Titel "Geprüft", Zeit und Anzahl,
  Suchfeld; Gruppen mit Überschrift und Anzahl (Sensoren der Anlagen, der Überwachung, Geräte, Lautsprecher, Auslöser von Routinen, Aktionen,
  Empfänger), je Eintrag grünes Häkchen (`.ag-mini.ok`) oder rotes Warnzeichen, Name fett, darunter Entitäts-ID und bei mehreren Anlagen ihre Namen.
  Unten nur "Schliessen"; X oben rechts wie überall.
- Benachrichtigungen › Wartungsmeldungen: nur die Meldungsart "Selbsttest" wie die anderen (Hinweis nennt das Kapitel HealthCheck). Abstand und
  "Jetzt prüfen" stehen seit der dritten Fassung von 1.65.0 im Kapitel HealthCheck (unten).

## HealthCheck (seit 1.65.0, Wunsch und Entscheide des Nutzers vom 2026-11-18, 21:38 bis 21:54)

- Kapitel "HealthCheck" in Konfiguration › Anlage, vor "Backup" (gilt für alle Anlagen), eine Karte mit drei Zeilen: Selbsttest (Symbol
  `stethoscope` auf grünem, gelbem oder rotem Grund wie in der Statuskachel, "geprüft vor …" und nächste Prüfung, Knöpfe "Jetzt prüfen" und
  "Probleme anzeigen"), "Selbsttest alle" mit zwei Zahlenfeldern "Nicht scharf" (Schild durchgestrichen) und "Scharf" (Schild), Entwurf der
  Seite wie das automatische Backup, ungültig rot mit Hinweis in der Fusszeile; seit 1.67.0 (Wunsch des Nutzers 2026-11-19) auf Computer und Handy
  untereinander unter dem Text, bündig (Raster), je Zahl und Einheit (Minuten, Stunden; 5 Minuten bis 24 Stunden; bei 320 px rückt die Einheit unter
  das Feld), Zeile der Lebenszeichen `.ag-rtsum.ag-hcsum` ("N von 5 Diensten" oder "Kein externer Dienst", darunter gelb, wenn ein
  Lebenszeichen scheiterte; "Dienst hinzufügen" mit Plus, "Dienste anzeigen" mit `heartPulse`; bei 5 ist "hinzufügen" gesperrt).
- Fenster `#ag-hclist` wie die Codes: klebender Kopf mit Titel (ohne Symbol, wie Routinen, Töne, Codes) und Suche, Zähler, Tabelle in
  `.ag-card.ag-bkwrap` (Spalten Dienst, Zuletzt, Intervall, Status, Knöpfe; feste Breiten, `table-layout: fixed`), sortierbar je Spalte. Der
  Tabellenkopf klebt unter dem Kopf des Fensters (`--ag-pophead`, gemessen in `healthcheck.js _stickHead`; auf dem Handy klebt die ganze erste
  Zeile). Dienst: Name fett, darunter die URL in Monospace auf eine Zeile gekürzt (ganz im Tooltip, Wunsch des Nutzers 2026-11-19), der erkannte
  Dienst als graue Marke und "Bei Fehler: …". Intervall als Dauer ("5 min", "24 h"). Status mit Punkt
  (grün gesendet, gelb Fehler gesendet, rot gescheitert). Knöpfe rund wie bei Routinen und Tönen (`.ag-wf-btns`, 44 px mit Rand): Warnzeichen
  "Fehler senden" (gesperrt ohne Zusatz), Haken "Lebenszeichen senden", Stift, Papierkorb. Handy (Wunsch des Nutzers 2026-11-19): Zeilen als
  Flex-Zeilen, Name, URL, Stand, Intervall und Zuletzt über die ganze Breite, die Knöpfe in einer eigenen Zeile darunter, rechts. Fusszeile
  "Schliessen" und "Dienst hinzufügen" nebeneinander rechts (bei leerer Liste nur "Schliessen", "Dienst hinzufügen" in der Mitte), wie bei Codes,
  Routinen und Tönen; ebenso im Fenster des Selbsttests ("Schliessen", "Jetzt prüfen").
- Formular `#ag-hcform`: Name (Pflichtfeld, Fokus beim Öffnen), Ping-URL, darunter Hinweis und "Erkannt: …"; Fehler-Zusatz mit Hinweis, Vorschlag
  "Vorschlag für …: …" mit "Übernehmen" nur, wenn der Zusatz vom Vorschlag abweicht, Vorschau "Aufruf bei Fehler: <URL>" in Monospace;
  Intervall mit Zahl und Einheit (Minuten, Stunden) und Schnellwahl als Chips (1 min, 5 min, 15 min, 1 h, 6 h, 24 h); kein eigenes Intervall
  bei scharfer Anlage (Entscheid des Nutzers 2026-11-19). Beim Tippen werden nur
  Hinweise, Vorschau und Fehler neu gezeichnet, nie das Feld. Fehler erst nach dem ersten "Speichern" oder bei Inhalt im Feld.

## Konfiguration › Benachrichtigungen (seit 1.69.0, Wünsche des Nutzers vom 2026-11-19, 22:16 bis 22:27; Entscheid 23:01, Mockups `meldungen-v1`)

- Drei Kapitel: "Standard-Empfänger" (unverändert, zwei Zeilen mit Dropdown und Pillen), "Störungsmeldungen" (mit "Einstellungen pro Modus" oben),
  "Wartungsmeldungen". Das Kapitel "HealthCheck-Dienste" aus 1.68.0 gibt es nicht mehr: "HealthCheck-Dienst antwortet nicht" ist die letzte
  Wartungsmeldung, aufgebaut wie "Selbsttest" (Wunsch 22:16/22:17), fester Text, Klick öffnet die Liste der Dienste.
- **Variante C:** jede Meldung eine Karte `.ag-ntk` wie die festen Meldungen unter Aktionen: Schalter links, Symbol 40 px in der Farbe des Kapitels
  (`.fault` rot `--ag-error`, `.maint` orange `--ag-warning`, Symbol in `--ag-warning-text`), Streifen links 4 px in derselben Farbe, Titel 16 px fett,
  Kurzfassung ("An …", "kritisch, 80 %", "bleibt in Home Assistant stehen", eigene Werte wie "unter 20 % · nach 3 Prüfungen", "nach 2
  Fehlversuchen · auch "antwortet wieder"", "mit beiden Knöpfen"; ohne Empfänger "Kein Empfänger" in `ag-warntext`), Play (`onceBtn`, gesperrt bei
  offenen Änderungen oder ausgeschaltet) und Stift, beide rund 44 px. Aus: Streifen und Symbol grau, Titel grau. Raster `.ag-ntk-grid`: Computer zwei
  Spalten, Handy eine (die Knöpfe in eigener Zeile rechts). Mit "Einstellungen pro Modus" stehen über den Karten die Zeilen `.ag-pmscope` ("Alles
  darunter gilt nur für …", "Für alle Modi").
- **Fenster `#ag-ntkind`** (`ag-wide`, Aufbau wie das Fenster der festen Meldungen unter Aktionen): Kopf mit Symbol in der Farbe des Kapitels und
  Titel, bei einem Modus `.ag-pmscope` und die Herkunft; Abschnitte (Kapitel-Stil `_sec`) "Meldung senden" (Schalter, Erklärung der Meldung),
  "Empfänger" (Herkunft, Dropdown, Pillen), "Zustellung" (Kritisch mit Lautstärke `.ag-ef-range`, "stehen lassen"), "Einstellungen" (nur wo es
  welche gibt), darunter "Testmeldung senden" mit Hinweis; Fusszeile "Abbrechen", "Übernehmen". Das Fenster ändert den Entwurf der Seite
  (Vorgabe 23:01: gespeichert wird auf der Seite); "Abbrechen", X, Escape mit Änderung fragen (`_dlgDirty`), dann gilt der Stand beim Öffnen.
- **Einheitliche Zahlen** (Wunsch 22:27, Bildschirmfoto "Batterie schwach"): `.ag-ntk-nums` ist ein Raster mit drei Spalten (Beschriftung, Feld,
  Einheit); jede Zeile ist `display: contents`, damit die Felder einer Meldung untereinander in einer Flucht stehen. Der Hinweis steht darunter über
  die ganze Breite, auf dem Handy genauso (Feld 72 px). Einheiten ausgeschrieben ("%", "Prüfungen", "Minuten", "Fehlversuchen").
- **Ungespeichert** (Vorgabe 23:01 "im gleichen Stil"): eine Karte mit Änderungen trägt `<small class="ag-unsaved">` "Noch nicht gespeichert" mit
  dem orangen Punkt (wie die Routinen), dazu der Punkt am Reiter und die Zahl in der Fusszeile.

## Protokoll der HealthCheck-Dienste (seit 1.68.0, Wunsch und Entscheide des Nutzers vom 2026-11-19, 17:06 bis 17:48)

- Öffnen: runder Knopf "Protokoll" (Symbol `history`) als erster in `.ag-wf-btns.ag-hcbtns` jeder Zeile (Wunsch: links von "Fehler senden");
  die Spalte der Knöpfe ist 284 px breit, die Knöpfe schrumpfen nie (`flex: none`). Das Fenster `#ag-hclog` (`ag-svdlg`) liegt über der Liste.
- "Das Design soll wirklich genau gleich sein, als würde ich auf ein Gerät gehen": Aufbau der Sensoransicht (`healthlog.js`, Unterklasse von
  `SensorView`). Kopf: getöntes Herz (`.ag-oav.ag-tint-health`, 44 px), der Name als Auswahl (`.ag-hl-pick` mit kleinem Pfeil, Menü
  `.ag-hl-menu` je Dienst mit Punkt in der Farbe des Zustands und "in Ordnung seit …"; ein Tipp daneben schliesst es und tut trotzdem, was er
  soll), darunter Rechner, erkannter Dienst (nur Computer) und "alle 5 min"; rechts der Zustand als Pille (grün, orange Fehler gemeldet, rot
  gescheitert `.ag-sv-pill.err`, grau ohne Protokoll) und an der Stelle von "In HA öffnen" seit 1.69.0 (Wunsch des Nutzers 2026-11-19, 21:50)
  die runden Knöpfe der Liste "Fehler senden", "Lebenszeichen senden" und der Stift (`.ag-hl-acts`, gleiche Symbole und Reihenfolge, 44 px,
  ohne Text; bis 1.68.0 "Bearbeiten" mit Text).
- Kacheln Verlauf (`history`, "in Ordnung seit …"), Antwortzeit (`timer`, letzter Wert), Dienst (`heartPulse`, Anbieter); auf dem Handy wie
  Verlauf/Empfang/Gerät der Sensoren (Wort, Wert, Wort). Zeitraum 3 Std. bis 1 Jahr (sieben Tasten, seit dem Wunsch des Nutzers 18:24 mit 90 Tagen und
  1 Jahr), gemeinsam für Verlauf und Antwortzeit; auf dem Handy in einer Zeile mit 12,5 px, bis 360 px Breite in zwei Zeilen (4 + 3).
- Verlauf: bis 1 Tag "Herzschlag" (Balken `hl-b` je Abschnitt, am Computer 5 Minuten, auf dem Handy 5, 10 oder 15 Minuten; Höhe die mittlere
  Antwortzeit, gescheitert ganz hoch; Lücke `hl-gap` grau), darunter das Band `hl-lane` ohne Unterbruch (zwischen zwei Aufrufen gilt der letzte,
  ein Test ändert nichts) mit breiteren Marken je Fehler und Test; 7 Tage Zeitleiste je Tag (`hl-band`, Marken aus `marks`); 30 Tage Raster
  24 × 30 (`hl-cell`, schlechtestes Ergebnis der Stunde, mehr als eine halbe Stunde Lücke grau); 90 Tage und 1 Jahr Raster Monat × Tag (Entscheid
  18:35, Mockup v3 "B": Zeile je Monat mit Kurzname, beim ersten und beim Januar mit Jahr, Zelle je Tag, Tage ausserhalb blass, Test als blauer Punkt
  nur am Computer, darunter `.ag-hl-sum` mit der Zahl der Tage mit Ausfall, Fehlermeldung und Lücke). Farben: grün Lebenszeichen, orange Fehler
  gemeldet, rot gescheitert, blau Test, grau keine Daten. Kennzahlen erfolgreich, Lebenszeichen, gescheitert (Handy: diese drei), Fehler
  gemeldet, Antwortzeit im Mittel.
- Antwortzeit (Mockup v1, "genau so umsetzen"): Linie mit Fläche, Zonen schnell bis 300 ms, langsam, sehr langsam ab 1 s (Beschriftung links,
  rechts liegt der letzte Wert), gestrichelte rote Marke `hl-failmark` je gescheitertem Aufruf; über eine Lücke läuft die Linie nicht.
- Dienst: Angaben wie die Kachel "Gerät", je mit Kopieren; URL und Zusatz in Monospace; darunter "Protokoll" (Zustand, letzter Aufruf,
  aufgezeichnet seit) und der Hinweis zur Aufbewahrung.
- Liste: Reiter "Ereignisse" (Standard, Symbol `alert`) und "Alle Aufrufe" (`history`) mit der Zahl des Zeitraums, Suche, Sortierung je Spalte
  (Zeit, Ereignis, Ergebnis, Antwortzeit, Auslöser; Handy: Zeit, Ereignis mit Ergebnis klein darunter, Auslöser), Zeit am Computer mit
  Sekunden. Hinweis "Einzelne Aufrufe bleiben 24 Stunden …" über der Liste bei 7 und 30 Tagen. Test: `hclog-e2e.mjs`.

## Einrichtungsassistent (seit 1.69.0, Wunsch und Entscheide des Nutzers vom 2026-11-19, 20:43 und 21:05)

Mockups `docs/mockups/einrichtungsassistent-v1/`, Variante B "Seite mit Schrittliste".

- Rahmen: der Assistent ersetzt Kopf und Reiter des Panels (`.ag-wz` im Scrollbereich `.ag-content.ag-wzc`). Am Computer links die Schrittliste
  (`.ag-wz-side`, klebt): Marke, Schritte mit Nummer (Willkommen: Zauberstab, erledigt: Häkchen, darunter die Kurzfassung), "Überwachung" als
  "nur mit passenden Sensoren", unten "Jeder Schritt wird mit Weiter gespeichert". Nur erledigte Schritte sind wählbar.
- Kopf (`.ag-wz-head`): "Schritt n von N" (Handy: dazu der Name des Schritts und ein Fortschritt aus Strichen), rechts "Später"; Titel als Frage,
  darunter ein Satz zur Erklärung. Fusszeile (`.ag-wz-foot`, klebt unten): "Zurück", "Schritte davor gespeichert" (Computer), "Weiter" mit Pfeil
  ("Los geht's", "Ohne Code weiter", "Fertig"); während des Speicherns "Speichert …" und gesperrt. Seit 1.71.0 (Wünsche des Nutzers 2026-11-20, 11:37
  und 11:38): auf dem Handy teilen sich "Zurück" und "Weiter" die Breite zu gleichen Teilen (ein Fehler steht darüber); am Computer stehen "Später"
  oben und "Weiter" unten am rechten Rand des Inhalts (`.ag-wz-head` höchstens 1120 px, Fusszeile mit `padding-right: max(40px, calc(100% - 1080px))`),
  nicht am Rand eines breiten Fensters.
- Knopf im Kopf des Panels (seit 1.71.0, Mockup `assistent-knopf-v1`, Variante A): `.ag-wzbtn` rechts neben dem Stift, rund 40 px, hellblau mit
  blauem Rand und blauem Punkt, Zauberstab in Teilen (`.ag-wzstick`, drei `.ag-wzstar`); nur solange der Assistent nicht fertig ist. Klasse `wave`
  einmal je Laden: Stab schwingt um den Griff (`ag-wz-swing`, 1,4 s), Sterne blitzen nacheinander auf (`ag-wz-pop`, 0, 0,12, 0,24 s Verzögerung). Gilt
  bewusst auch bei "Bewegung reduzieren" (Entscheid des Nutzers, wie das Easter Egg des Logos). Test: `wzbtn-e2e.mjs`.
- Inhalt: eigene Schritte aus den Bausteinen des Panels (Karten `.ag-setlist`, Schalter links, Kapitel, Hinweise `.ag-wz-info` mit Symbol);
  eingebettete Ansichten (Zuordnung, Alarmaktionen, Überwachung) zeigen den Reiter ohne Leiste der Konfiguration, Fusszeile, Werkzeuge der
  Tabelle und Knöpfe je Zeile. Auf dem Handy steht der Eingang unter der Tabelle (Schalter je Sensor), weil die Tabelle dort keine Spalte dafür hat.
- "Später" und Escape öffnen das Fenster `#ag-wzask` mit drei grossen Knöpfen (Morgen wieder anzeigen, Nicht mehr anzeigen, Weiter einrichten).
- Jeder Schritt beginnt oben. Kapitel "Einrichtungsassistent" unter Konfiguration › Anlage vor "Anlage löschen" (Symbol `wand`, Farbe
  `ag-tint-wizard`): Stand und "Assistent starten" bzw. "Von vorn" und "Bei Schritt n fortsetzen". Test: `wizard-e2e.mjs`.
- Schritt "Überwachung" (seit 1.70.0, Wunsch des Nutzers 2026-11-20, 08:31, mit Bildschirmfoto: 106 Messwerte als Knöpfe): die Liste der Messwerte beginnt
  leer (`.ag-wz-mempty`, gestrichelter Rahmen, "Messwerte hinzufügen"); das Fenster `#ag-wzpick` ist aufgebaut wie "Sensoren hinzufügen"
  (Suchfeld mit X, Filter Alle, Temperatur, Luftfeuchtigkeit, Helligkeit, Luftqualität, Weitere, nur die vorhandenen; Zeilen nach Bereich mit
  Kästchen, Symbol, Name, Art · Integration und dem jetzigen Wert rechts; "Hinzufügen (n)"). Die gewählten stehen in einer Liste fester Höhe
  (`.ag-wz-mlist`, 360 px, Handy 50 % der Höhe) mit Suche, Filtern der gewählten Arten, "n gewählt" und rundem Papierkorb je Zeile; der Knopf
  "Messwerte hinzufügen" steht dann rechts neben dem Titel. Seit 1.71.0 (Bildschirmfoto des Nutzers 11:30): Zeilen mindestens 56 px, Abstand 12 px, Bereiche als Überschrift mit Hintergrund; Zeilen
  einer `.ag-elist` schrumpfen nie (`flex-shrink: 0`), sonst laufen lange Namen in einer Liste fester Höhe in die nächste Zeile.
- Testmeldungen (seit 1.71.0, Wunsch des Nutzers 2026-11-20, 11:40): im Schritt "Meldungen" zwei Play-Knöpfe nebeneinander ("Alarmmeldung",
  "Wartungsmeldung", `.ag-wz-testbtns`, Handy je halbe Breite), unter "Ausprobieren" zwei Zeilen "Testmeldung Alarm" und "Testmeldung Wartung" mit den
  Empfängern; ein Knopf ohne Empfänger seiner Gruppe ist gesperrt.
- Filter der Sensoren (Konfiguration › Sensoren und Fenster "Sensoren hinzufügen", seit 1.72.0, Wunsch des Nutzers 2026-11-20, 13:56): Pillen
  Alle, Türen & Fenster, Bewegung, Wasser (14:45), Temperatur, Luftfeuchtigkeit, Helligkeit, Luftqualität, Weitere (`common.js SENSOR_FILTERS`, `sensorKind`); nur
  Pillen, zu denen die Liste bzw. das Fenster etwas hat (`sensorFilters`), "Alle" immer. Die Pillen der Tabelle stehen in `.ag-senfilters`
  (`display: contents`) und werden bei jedem Zeichnen nachgeführt, das Fenster rechnet sie aus seinen Kandidaten ohne Suche.
- "Weitere Funktionen" am Schluss (seit 1.70.0, Wunsch des Nutzers 2026-11-20, 08:33: die Kacheln "Wenn du mehr willst" verleiteten zum Klicken): eine Karte
  mit Zeilen zur Information (Symbol, Name, was es tut, darunter mit Info-Symbol, wo es steht) und unten "Konfiguration öffnen" (Zahnrad),
  das den Assistenten wie "Fertig" abschliesst und Konfiguration › Anlage öffnet. Keine Kachel und keine Zeile ist klickbar. Seit 1.72.0 (Wunsch des
  Nutzers 2026-11-20, 14:00): Routinen, Codes pro Person, Eigene Töne, HealthCheck (Reihenfolge der Kapitel), Dashboard-Karte; Symbole in der Farbe
  ihres Kapitels (`ag-tint-routines`, `-codes`, `-sounds`, `-health`; Karte `ag-tint-card`, hellblau).
