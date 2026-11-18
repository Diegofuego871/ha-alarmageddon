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

## Selbsttest (seit 1.65.0, Wunsch des Nutzers vom 2026-11-18)

- Statuskachel der Übersicht: eine Zeile "Selbsttest" steht immer da (auch bei "Alles in Ordnung"), mit "geprüft vor …" darunter und dem Pfeil wie
  die anderen Zeilen. Symbol Stethoskop (`stethoscope`), grün ohne Befund, gelb mit Befunden, rot, wenn ein Befund einen Alarm verhindern oder stumm
  machen kann. Mit Befunden zählt die Zeile bei "N brauchen Aufmerksamkeit" mit (eine Zeile, wie "Nicht erreichbar" und "Batterie schwach").
- Fenster `#ag-selftest` (breit, auf dem Handy ganzer Bildschirm): Kopf mit letzter und nächster Prüfung und dem Abstand; je Anlage eine
  Überschrift, die gemeinsamen Befunde unter "Alle Anlagen". Je Befund eine Karte mit farbigem Rand links (gelb, rot), zugeklappt Titel und Art
  ("Einrichtung", "Im Betrieb"); aufgeklappt die Abschnitte "Was ist los?", "Wo" (Fundstellen als Wege wie im Panel, je mit "Öffnen"), "Was das
  bedeutet", "Mögliche Ursachen" (Liste), "So behebst du es" (nummeriert) und eine Fusszeile (bei Befunden im Betrieb mit "Erledigt"). Bis zwei
  Befunde sind aufgeklappt, sonst der erste. Unten "Jetzt prüfen" links, "Schliessen" rechts; darüber "Was prüft der Selbsttest?" zum Aufklappen.
- Benachrichtigungen › Wartungsmeldungen: nur die Meldungsart "Selbsttest" wie die anderen (Hinweis nennt das Kapitel HealthCheck). Abstand und
  "Jetzt prüfen" stehen seit der dritten Fassung von 1.65.0 im Kapitel HealthCheck (unten).

## HealthCheck (seit 1.65.0, Wunsch und Entscheide des Nutzers vom 2026-11-18, 21:38 bis 21:54)

- Kapitel "HealthCheck" in Konfiguration › Anlage, vor "Backup" (gilt für alle Anlagen), eine Karte mit drei Zeilen: Selbsttest (Symbol
  `stethoscope` auf grünem, gelbem oder rotem Grund wie in der Statuskachel, "geprüft vor …" und nächste Prüfung, Knöpfe "Jetzt prüfen" und
  "Probleme anzeigen"), "Selbsttest alle N Std." (Zahlenfeld, Entwurf der Seite wie das automatische Backup, ungültig rot mit Hinweis in der
  Fusszeile), Zeile der Lebenszeichen `.ag-rtsum.ag-hcsum` ("N von 5 Diensten" oder "Kein externer Dienst", darunter gelb, wenn ein
  Lebenszeichen scheiterte; "Dienst hinzufügen" mit Plus, "Dienste anzeigen" mit `heartPulse`; bei 5 ist "hinzufügen" gesperrt).
- Fenster `#ag-hclist` wie die Codes: klebender Kopf mit Titel (ohne Symbol, wie Routinen, Töne, Codes) und Suche, Zähler, Tabelle in
  `.ag-card.ag-bkwrap` (Spalten URL, Zuletzt, Intervall, Status, Knöpfe), sortierbar je Spalte. Der Tabellenkopf klebt unter dem Kopf des
  Fensters (`--ag-pophead`, gemessen in `healthcheck.js _stickHead`). URL ganz, einspaltig, bricht an jeder Stelle; darunter der erkannte Dienst
  als graue Marke und "Bei Fehler: …". Status mit Punkt (grün gesendet, gelb Fehler gesendet, rot gescheitert). Knöpfe: Warnzeichen "Fehler
  senden" (gesperrt ohne Zusatz), Haken "Lebenszeichen senden", Stift, Papierkorb. Handy: Zuletzt, Intervall und Status als Zeile unter der URL
  (`.ag-hc-m`), Spalten ausgeblendet, Knöpfe 34 px. Fusszeile "Schliessen" links, "Dienst hinzufügen" rechts.
- Formular `#ag-hcform`: Ping-URL (Fokus beim Öffnen), darunter Hinweis und "Erkannt: …"; Fehler-Zusatz mit Hinweis, Vorschlag
  "Vorschlag für …: …" mit "Übernehmen" nur, wenn der Zusatz vom Vorschlag abweicht, Vorschau "Aufruf bei Fehler: <URL>" in Monospace;
  Intervall als Zahl und Einheit (Minuten, Stunden) und Schnellwahl als Chips (1 min, 5 min, 15 min, 1 h, 6 h, 24 h). Beim Tippen werden nur
  Hinweise, Vorschau und Fehler neu gezeichnet, nie das Feld. Fehler erst nach dem ersten "Speichern" oder bei Inhalt im Feld.
