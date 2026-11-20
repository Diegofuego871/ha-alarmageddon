# Übergabe 1.69.0 (2026-11-20, Wünsche vom 2026-11-19)

Lieferung der externen Prüfstelle. Basis ist `main` @ `ddcfb75` (Commit des Nutzers "1.68.0: …"; auf GitHub vor der Lieferung geprüft: Baum
gleich dem der Lieferung von 1.68.0, `main` unverändert; unmittelbar vor dem Packen erneut geprüft: Tag `v1.68.0` steht auf demselben Commit
`ddcfb75`).

Neue Funktion, darum **1.69.0** (Minor, eigene Lieferung nach Wunsch des Nutzers). Dazu die Wünsche von 21:50 (Knöpfe im Protokoll der
HealthCheck-Dienste), 22:16/22:17 (Meldung der HealthCheck-Dienste als Wartungsmeldung wie "Selbsttest") und 22:20/22:27 (neues Design von
Konfiguration › Benachrichtigungen, Entscheid 23:01 "C"); auf Wunsch des Nutzers (23:01) "alles zusammen in einem Paket". `manifest.json` 1.69.0,
`PANEL_VERSION` 233 auf 234.

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.69.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.69.0.md`) |
| `RELEASE-NOTES-1.69.0.md` | Release Notes Englisch (für das GitHub-Release, seit dem letzten Tag `v1.68.0`, also nur 1.69.0; dazu eine Fassung ab `v1.67.0`) und Deutsch |
| `1.69.0-auf-1.68.0.patch` | alle Änderungen an Textdateien und die zwei gelöschten Bilder als ein Patch gegen `main` @ `ddcfb75`; **ohne** die neuen und geänderten Bilder (`*.png`) |
| `files/` | jede gegenüber `ddcfb75` geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys, **mit allen Bildern** |

Die Bilder stehen nur einmal im Paket, in `files/` (auf Wunsch des Nutzers vom 2026-11-20, 07:24: das Paket muss unter 30 MB bleiben; mit den
Bildern zusätzlich im Patch waren es 36 MB). Es fehlt nichts: Patch und `files/` zusammen ergeben genau den gelieferten Stand (beim Packen geprüft:
gleicher Git-Baum).

Anwenden: `git checkout main && git pull` (Stand `ddcfb75`), dann **entweder**

1. `git apply --index 1.69.0-auf-1.68.0.patch` (Textdateien und Löschungen), danach den Inhalt von `files/` über das Repository kopieren (bringt die
   Bilder; die Textdateien darin sind gleich wie nach dem Patch) und `git add -A`, **oder**
2. nur den Inhalt von `files/` über das Repository kopieren **und** die zwei Dateien `docs/img/step-sensors-en.png` und
   `docs/img/step-sensors-de.png` löschen (ersetzt durch `step-wizard-*.png`), dann `git add -A`.

Neu sind unter anderem `panel/wizard.js`, `tests/test_wizard.py`, die Suite `wizard-e2e.mjs`, die Suite `ntcards-e2e.mjs`, die Ordner
`docs/mockups/einrichtungsassistent-v1/` und `docs/mockups/meldungen-v1/` und die Bilder `wizard-*.png`, `step-wizard-*.png` (vollständige Liste in Abschnitt 3). Danach die Prüfungen aus Abschnitt 4, Commit mit Betreff `1.69.0: Einrichtungsassistent,
neues Design der Benachrichtigungen, HealthCheck-Meldung bei der Wartung, README überarbeitet`, Push auf `main`, Release-Angaben aus Abschnitt 6. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Wünsche und Entscheide des Nutzers vom 2026-11-19:

- 20:43: Ein Assistent erscheint, sobald man eine neue Anlage hinzufügt, einmal je Anlage; wegdrücken mit "nicht mehr anzeigen" oder "morgen"
  (dann ab dem nächsten Tag beim nächsten Laden wieder). Willkommensbildschirm mit Erklärung, dann geführte Grundeinrichtung: Sensoren über eine
  Filteransicht (ohne Voreinstellungen, der Standard gilt), Modi, vielleicht ein Code, die Aktionen je Modus mit derselben Seite, anders
  eingebettet ("bei den Aktionen muss alles gehen"), die Überwachung, falls passende Sensoren da sind, und die grundlegenden Benachrichtigungen
  (Empfänger und je Art ein Schalter, ohne Kritisch und Lautstärke). Kapitel "Einrichtungsassistent" unter Konfiguration › Anlage vor "Anlage
  löschen" mit einem Knopf zum erneuten Starten. "Bitte erstelle mal ein Konzept, vielleicht mit Mockups … Bewerte es, falls ich etwas vergessen
  habe." Mockups `docs/mockups/einrichtungsassistent-v1/`.
- 21:05: "Merkt ihr auch noch, dass wenn jemand einen Visitor unterbricht und am nächsten Tag weitermacht, soll es genau an der Stelle
  weitergehen. 1. B passt 2. passt, code muss freiwillig sein. Bei meldung nach alarm default und wartungs default empfänger fragen. 3. passt
  4. ja passt 5. genau, bei einem neuen start ist alles wie aktuell konfiguriert vorgewählt 6. ohne licht, rest passt. Ich commite die letzte
  version, das gibt eine neue sep lieferung"
- 21:06: "Wenn du ganz fertig bist, überarbeite bitte noch das README, auch mit der letzten Lieferung und diesem Wizard."
- 21:50, mit zwei Bildschirmfotos (Liste der HealthCheck-Dienste mit den runden Knöpfen markiert, Kopf des Protokolls mit "Bearbeiten" markiert):
  "noch eine Anpassung hier in der Protokollansicht für den externen Help-Check. Oben, wo der Bearbeiten-Button ist, bitte nicht nur den
  Bearbeiten-Button hinstellen, sondern neu den Bleistift, den Knopf, um die Meldung OK zu senden und den Knopf, um eine Störungsmeldung zu senden.
  Bitte diese drei Button an diese Stelle setzen und die gleichen Symbole verwenden wie auf der Liste."
- 22:16, mit zwei Bildschirmfotos (Kapitel "HealthCheck-Dienste" und Fenster einer Meldung): "Baue die meldung lieber genau so auf wie zb beim
  selbsttest. Der inhalt muss nicjt definierbar sein. Nur wie bei den anderen, empfänger, art, kritisch ja nein etc... es soll also ein angleich
  sein an die anderen meldungen. Allerdings gib es setting wie, "erneuten meldung wenn wieder in ordnung" oder so. Und die anzahl polls."
- 22:17: "Die meldungen sollen zudem in den bereich der Wartungsmeldungen. Wie selbsttest"
- 22:20: die Meldungen unter "Störungsmeldungen" und "Wartungsmeldungen" übersichtlicher (Titel kommt nicht zur Geltung, "eine Art
  Unterkapitel", gleiches Design für alle, oben nur die Standard-Empfänger): "Bitte belegt ihr für die ganze Seite Meldungen mit ein neues Design."
- 22:27, mit Bildschirmfoto "Batterie schwach": "Achte darauf beim redesign dass solche fenster eingeitlich sind, dieses würde ich zb recht
  erwarten". Mockups `docs/mockups/meldungen-v1/` (Varianten A, B, C).
- 23:01: "1. C 2. passt 3. Fehlversuche 4. alles zusammen in einem paket. Achte darauf, das die settings nach wie vor auf der seite und nicht im
  popup pro meldung gespeichert wird. Wie auch sonst überall, sollen ungesichterte änderungen markiert sein im gleichen stil"

Umgesetzt (Nummern wie die Fragen im Mockup):

1. **Rahmen B:** eine Seite anstelle von Kopf und Reitern des Panels, am Computer links die Schrittliste (erledigte Schritte mit Häkchen und
   Kurzfassung, nur sie wählbar), auf dem Handy oben "Schritt n von N · Name" und ein Fortschritt aus Strichen; unten "Zurück" und "Weiter".
2. **Reihenfolge:** Willkommen, Modi, Sensoren, Zuordnung und Eingang, Code, Meldungen, Alarmaktionen, Überwachung, Fertig. **Code freiwillig**
   ("Ohne Code weiter"; ein Hauptcode aus der Einrichtung in Home Assistant zählt als Code). **Meldungen:** die Empfänger der Alarme und die
   Empfänger der Wartung getrennt (beide gelten für alle Anlagen), dazu je Meldung ein Schalter (Scharfschalten gescheitert, Sensor ausgefallen,
   Batterie schwach, Sensor nicht erreichbar, Selbsttest; die Alarmmeldung immer an) und eine Testmeldung.
3. **Zuordnung und Eingang:** die echte Tabelle aus Konfiguration › Sensoren, beim Wählen eines Sensors nach seiner Art vorbelegt (Türen,
   Fenster, Glasbruch, Erschütterung in jedem eingeschalteten Modus; Bewegung und Übriges bei Abwesend; Rauch, Wasser, Gas, CO, Hitze in keiner
   Zone, weil "Immer aktiv" sie auslöst, ohne "Immer aktiv" in jedem Modus). Darunter Eingang, Zeit zum Verlassen (Abwesend) und Zeit zum
   Deaktivieren (gilt für alle Modi; waren sie verschieden, sagt ein Hinweis das).
4. **Bestehende Anlagen:** nach dem Update kein automatischer Assistent (beim ersten Laden ohne Eintrag `wizard` gelten alle Anlagen als
   abgeschlossen, sofort geschrieben), nur der Knopf. Eine Anlage aus einem Backup ebenso.
5. **Neu starten:** alles ist so vorgewählt, wie es eingerichtet ist (die Schritte lesen die Entwürfe der Reiter).
6. **Schnell hinzufügen** nur "Sirene 3 Minuten" (Gerät schalten, Domäne `siren`, nach 180 Sekunden zurück) und "Alarmton" (Ton, 180 Sekunden),
   ohne Licht; beide öffnen den Editor des Schritts vorbelegt, das Gerät wählt man selbst.
7. **Unterbrechen:** jeder Schrittwechsel geht an den Server; "Später" › "Morgen wieder anzeigen" öffnet ab dem nächsten Tag (Datum von Home
   Assistant) genau bei diesem Schritt, "Nicht mehr anzeigen" nur noch von Hand.

## 2. Umsetzung

### Server

- `settings.py`: `Settings.data["wizard"]` je Anlage `{state, until, step}` (`valid_wizard` prüft jeden Wert, Unbekanntes fällt auf "offen,
  Willkommen" zurück); `wizard_payload` mit `due` (offen, oder später und das Datum ist erreicht); `async_set_wizard` (Aktionen `start`, `step`,
  `later`, `hide`, `done`); `forget_wizard`. Migration in `async_load`.
- `websocket_api.py`: Befehl `alarmageddon/wizard` (nur Administratoren, Anlage muss geladen sein; `step` nur mit gültigem Schritt), in
  `alarmageddon/data` je Anlage `wizard`. `sensor_candidates` mit `measures` (Messwerte für den Schritt "Überwachung", auch wenn sie aus ist).
- `__init__.py`: Entfernen einer Anlage nimmt ihren Zustand mit. `backup.py`: eine als neue Anlage wiederhergestellte Anlage ist abgeschlossen.
  Der Zustand steht nie im Backup und ändert nie die Anlage selbst.
- `const.py`: `WIZARD_STEPS`, `WIZARD_STATES`, `WIZARD_ACTIONS`.

### Panel

- `panel/wizard.js` (neu, `WizardUi`): kein eigener Editor. Die Schritte speichern über die Entwürfe und das Speichern der Reiter
  (`SystemUi`, `SensorsUi`, `NotifyUi`, `ActionsUi`), "Weiter" wartet, bis die Anlage nach dem Speichern neu geladen ist. "Zuordnung",
  "Alarmaktionen" und "Überwachung" sind die eingebetteten Ansichten der Reiter: das Panel zeichnet sie in den Platz `.ag-wz-slot` (als `_view`),
  `_tab`/`_sub` stehen auf dem Schritt, Klicks, Eingaben und Ziehen laufen weiter über die Reiter. Was im Assistenten fehlen soll (Leiste der
  Konfiguration, Fusszeile, Werkzeuge der Tabelle, Knöpfe je Zeile, Reiter "Überwachung" im Schritt Alarmaktionen), blendet `styles.js` je Schritt
  aus.
- Öffnet sich nach jedem Abruf für die gewählte Anlage, wenn sie fällig ist, nie über ungespeicherte Änderungen oder ein offenes Fenster; beim
  Wechsel der Anlage ebenso. Nach "Anlage hinzufügen" erst nach dem Wechsel zur neuen Anlage (`_creating` hält ihn beim Abruf davor zurück), damit
  "Später" wie bisher zu Konfiguration › Sensoren führt, auch wenn es die erste Anlage ist. Der Start von Hand fragt bei ungespeicherten Änderungen ("Verwerfen und starten").
- Escape und "Später" öffnen das Fenster `#ag-wzask`. "Fertig" schliesst zur Übersicht.
- Schritt "Überwachung" nur, wenn es Messwerte gibt oder die Überwachung schon an ist; Schalter und Sensoren dort gelten sofort (erst dann gibt
  es die Regeln darunter).
- **Abweichung vom Mockup auf dem Handy:** die Tabelle hat dort keine Spalte "Eingangsverzögerung", und das Blatt des Sensors geht im Assistenten
  nicht auf. Darum steht unter der Tabelle ein Kapitel "Eingangsverzögerung" mit einem Schalter je Sensor (Türen und Fenster zuerst; wählbar nur,
  was in einem Modus auslöst, Rauch und Wasser nie); es folgt den Kästchen der Tabelle.
- "Fertig": Zusammenfassung mit "Ändern", Test der Alarmaktionen (Play-Knopf wie überall, ohne Aktionen gesperrt), Testmeldung, "Bereit zum
  Scharfschalten" je Modus, Hinweise auf Routinen, Codes, HealthCheck, Dashboard-Karte.
- Kapitel "Einrichtungsassistent" unter Konfiguration › Anlage vor "Anlage löschen": Stand (abgeschlossen, nicht fertig, verschoben bis, ausgeblendet)
  und "Assistent starten" bzw. "Von vorn" und "Bei Schritt n fortsetzen".
- Behoben während der Arbeit: Fusszeile auf dem Handy klebte 24 px über dem unteren Rand (Polster des Scrollbereichs auf dem Handy).

### Protokoll der HealthCheck-Dienste (Wunsch 21:50)

- Im Kopf des Protokolls stehen statt "Bearbeiten" (mit Text) die runden Knöpfe der Liste: "Fehler senden" (Warndreieck), "Lebenszeichen senden"
  (Häkchen) und der Stift, gleiche Symbole, 44 px, ohne Text (`healthlog.js _actsHtml`, `.ag-hl-acts`). **Reihenfolge wie in der Liste**
  (Fehler, Lebenszeichen, Stift); der Nutzer nannte den Stift zuerst, die Liste hat ihn zuletzt. Dem Nutzer so gemeldet.
- Die zwei Sendeknöpfe tun dasselbe wie in der Liste (`healthcheck.test`, WS `alarmageddon/healthcheck_ping`, gesperrt während des Sendens,
  "Fehler senden" ohne Fehler-Zusatz gesperrt); danach holt das Protokoll neu, der Aufruf steht dort als Test.
- Handy: rechts neben dem Zustand in der zweiten Zeile des Kopfs; Computer: rechts neben dem Zustand, vor dem X.

### Meldung der HealthCheck-Dienste als Wartungsmeldung (Wunsch 22:16/22:17)

- Server: neue Art `healthcheck` in `NOTIFY_TYPES` (Gruppe `maintenance`, Standard an, nicht kritisch), `notify.healthcheck_fails` (1 bis 10,
  Standard 2) und `notify.healthcheck_up` (Standard an). Feste Texte `hc_down_*`, `hc_up_*` (seit 23:01 mit "Fehlversuche"/"failed attempts",
  ohne Mehrzahlfehler bei 1), nie die URL; Klickziel `?view=healthcheck`; "antwortet wieder" nie kritisch. `healthcheck._notify` meldet nur,
  wenn die Meldung an ist; die Zählung läuft weiter, damit ein Einschalten mitten im Ausfall nicht sofort meldet (Test).
- Übernahme: `settings._healthcheck_1_68` übernimmt die Form aus 1.68.0 (`notify["healthcheck"]` mit `fails`, `hc_down`, `hc_up`) beim Laden, aus
  Backups und von einem alten Panel (an/aus, Empfänger, Kritisch, Lautstärke, "stehen lassen" aus `hc_down`; Zahl; an/aus von `hc_up`); eigene Texte
  und Klickziel entfallen. `save_notify` lehnt die alte Form ab.
- Entfernt: `HC_NOTICE_SCHEMA`, `HC_NOTICE_KINDS`, WS `alarmageddon/test_healthcheck_notify` (Testmeldung jetzt über `test_notify` mit Art
  `healthcheck`), im Panel `notify.js _hcHtml`, `actions.js openHcNoticeEditor` und die Weichen dazu, 19 Texte.

### Neues Design von Konfiguration › Benachrichtigungen (Wünsche 22:20 und 22:27, Entscheid 23:01)

- **Variante C:** jede Meldung eine Karte wie die festen Meldungen unter Aktionen (`notify.js _card`, `.ag-ntk`): Schalter, Symbol in der Farbe
  des Kapitels (Störungsmeldungen rot, Wartungsmeldungen orange, aus grau), Streifen links, Titel, Kurzfassung (an wen, kritisch, "bleibt in Home
  Assistant stehen", eigene Werte wie "unter 20 % · nach 3 Prüfungen", "nach 2 Fehlversuchen · auch "antwortet wieder""), Play und Stift. Am
  Computer zwei Spalten, auf dem Handy eine. Kapitel: "Standard-Empfänger" (unverändert), "Störungsmeldungen" (mit "Einstellungen pro Modus"),
  "Wartungsmeldungen".
- **Fenster `#ag-ntkind`** (Stift): Kopf mit Symbol und Titel; Abschnitte "Meldung senden", "Empfänger", "Zustellung", "Einstellungen" (nur wo es
  welche gibt), "Testmeldung senden", Fusszeile "Abbrechen", "Übernehmen". **Abweichung vom Mockup C:** die Abschnitte des Fensters der festen
  Meldungen unter Aktionen statt zwei Spalten, damit beide Fenster gleich aussehen und bedient werden.
- **Gespeichert wird auf der Seite** (Vorgabe 23:01): das Fenster ändert den Entwurf der Seite; "Übernehmen" schliesst; "Abbrechen", X und Escape
  fragen bei Änderungen (wie die anderen Fenster) und stellen dann den Stand beim Öffnen wieder her. Eine ungültige Zahl hält "Übernehmen" auf und
  nennt den Bereich ("Meldung nach: 1 bis 10 Prüfungen.").
- **Ungespeichert im gleichen Stil** (Vorgabe 23:01): eine geänderte Karte zeigt "Noch nicht gespeichert" mit dem orangen Punkt (`.ag-unsaved`, wie
  die Routinen), dazu Punkt am Reiter und Zahl der Änderungen in der Fusszeile; nach "Speichern" verschwindet beides.
- **Einheitliche Zahlen** (Wunsch 22:27): `.ag-ntk-nums` ist ein Raster mit Beschriftung, Feld und Einheit; die Felder einer Meldung stehen genau
  untereinander, der Hinweis darunter über die ganze Breite, am Computer und auf dem Handy. Einheiten "%", "Prüfungen", "Minuten" (statt "Min."),
  "Fehlversuchen".
- Kleiner Zusatz: hat die Gruppe keine Standard-Empfänger, sagt das Fenster "Kein Empfänger: Diese Meldung wird nicht gesendet …" (bisher stand
  dort der Text für eine selbst geleerte Liste). Der Text "ntInvalid" in der Fusszeile nennt jetzt alle vier Bereiche.
- Testmeldungen gehen wie bisher mit dem gespeicherten Stand hinaus (Play gesperrt bei offenen Änderungen, "Zuerst speichern …").

### README und Handbuch (Wunsch 21:06)

- README EN/DE überarbeitet: Einleitung mit dem Assistenten, erster der drei Schritte mit dem Assistenten auf dem Handy (`step-wizard-*.png`,
  ersetzt `step-sensors-*.png`), neuer Punkt "In wenigen Minuten eingerichtet", Batterie schwach erst nach mehreren Prüfungen und Protokoll der
  HealthCheck-Dienste (1.68.0) unter "Was du bekommst", Installation mit dem Assistenten, Rundgang mit "Der Einrichtungsassistent"
  (`wizard-*.png`), Zahlen der Tests nachgeführt.
- Handbuch EN/DE: Abschnitt "Einrichtungsassistent" am Anfang von "Die Oberfläche", "Mehrere Anlagen" nennt ihn; Abschnitt
  "Benachrichtigungen" neu geschrieben (Karten, Fenster, Speichern auf der Seite, HealthCheck-Meldung). Die Bilder der README zeigen die Seite
  Benachrichtigungen nicht; keine neuen Bilder dafür.

## 3. Änderungen

| Datei | Änderung |
| --- | --- |
| `settings.py` | `wizard` je Anlage, `valid_wizard`, `wizard_payload`, `async_set_wizard`, `forget_wizard`, Migration; `_healthcheck_1_68`, `healthcheck_fails`, `healthcheck_up` |
| `websocket_api.py` | Befehl `alarmageddon/wizard`; `wizard` in `data`; `sensor_candidates` mit `measures`; `save_notify` mit `healthcheck_fails`, `healthcheck_up`; `test_healthcheck_notify` entfernt |
| `notify.py`, `healthcheck.py`, `schemas.py` | Art `healthcheck`, `async_send_healthcheck` mit festen Texten ("Fehlversuche"); `_notify` nur, wenn an; `HC_NOTICE_SCHEMA` entfernt |
| `__init__.py`, `backup.py` | Entfernen nimmt den Zustand mit; Anlage aus einem Backup abgeschlossen |
| `const.py` | `WIZARD_*`, `NOTIFY_TYPES` mit `healthcheck`, `DEFAULT_NOTIFY` mit `healthcheck_fails`, `healthcheck_up`, `PANEL_VERSION` 234 |
| `manifest.json` | 1.69.0 |
| `panel/wizard.js` | **neu**: `WizardUi` |
| `panel/alarmageddon-panel.js` | Gerüst des Assistenten statt Kopf und Reitern, Weichen in `_onClick`/`_onInput`/`_onChange`, Escape, `maybeOpen` nach Abruf, Anlegen und Wechsel, Fenster `#ag-wzask`; Fenster `#ag-ntkind` mit Rückfrage (`_dlgDirty`, `DLG_CANCEL`) |
| `panel/system.js` | Kapitel "Einrichtungsassistent" (`_wizardHtml`); `openCodeForm` mit vorbelegtem Benutzer und Namen |
| `panel/actions.js` | `quickAdd` (Sirene 3 Minuten, Alarmton); Fenster der HealthCheck-Meldungen aus 1.68.0 entfernt |
| `panel/notify.js` | neues Design: Karten (`_card`, `_summary`, `kindChanged`), Fenster `#ag-ntkind` (`openKind`, `renderKind`, `closeKind`, `kindDirty`), Raster der Zahlen; HealthCheck als Wartungsmeldung |
| `panel/common.js` | Symbol `wand` |
| `panel/healthlog.js` | Kopf: "Fehler senden", "Lebenszeichen senden", Stift (`_actsHtml`), danach neu laden |
| `panel/strings.js` | Texte `wz*`, `ntk*`, `ntT_healthcheck`, `ntHcUp*`, Einheiten (EN/DE); 19 Texte der HealthCheck-Meldungen aus 1.68.0 entfernt |
| `panel/styles.js` | Gerüst, Schrittliste, Fortschritt, Fusszeile, eingebettete Ansichten, Handy, `ag-tint-wizard`; Karten `.ag-ntk`, Fenster `.ag-ntk-ed`, Raster `.ag-ntk-nums` |
| `panel/panel.html` | `wizard` in `MODULES` |
| Nachbau | `ha-sim.html`: Zustand je Anlage (`?wizard=`, `?wzstep=`, `?wzuntil=`, `window.__wzToday`, `window.__wzCalls`), Befehl `alarmageddon/wizard`, neue Anlagen ohne Sensoren (wie der Server) und mit offenem Assistenten, `?nomeasures=1`, eigener Benutzer mit Kennung; `lib.mjs` `open()` erkennt den Assistenten |
| Tests | **neu** `tests/test_wizard.py` (8 Tests); `tests/test_healthcheck_notify.py` neu geschrieben (Wartungsmeldung, Übernahme aus 1.68.0); `test_security.py` (Befehl `wizard` neu, `test_healthcheck_notify` entfernt); `test_review_1_58.py` (`measures`) |
| Suiten | **neu** `wizard-e2e.mjs`, `ntcards-e2e.mjs`; `hcnotify-e2e.mjs` neu geschrieben; `hclog-e2e.mjs` (drei Knöpfe im Kopf, Senden und Neuladen); `addsystem-e2e.mjs` (nach dem Anlegen der Assistent), `deletesystem-e2e.mjs` (Kapitel davor), `switches-e2e.mjs` (Schalter im Assistenten und in jedem Fenster einer Meldung), `play-e2e.mjs` (Tests im Assistenten, HealthCheck-Meldung); an die Karten und das Fenster angepasst: `actions-e2e`, `targets-e2e`, `layout-e2e`, `hardening-e2e`, `review-e2e`, `selftest-e2e` |
| `scripts/mutation_check.py` | 3 Zeilen "Assistent"; zwei Muster von `sensor_candidates` an `measures` angepasst; Zeilen "Meldung HealthCheck" an die Wartungsmeldung angepasst und ergänzt |
| `tests/panel/readme-shots.mjs` | Bilder `wizard`, `step-wizard` (statt `step-sensors`); "Shelly" im Bild neutral |
| Doku | CHANGELOG EN/DE (1.69.0), README EN/DE, MANUAL EN/DE, `CLAUDE.md` (Regeln HealthCheck-Meldung und Benachrichtigungen), `docs/DESIGN.md`, `docs/HANDOVER.md`, dieses Protokoll |
| Mockups | **neu** `docs/mockups/einrichtungsassistent-v1/` (mit den Entscheiden von 21:05), `docs/mockups/meldungen-v1/` (Varianten A, B, C, Entscheid 23:01) |
| Bilder | **neu** `docs/img/wizard-en.png`, `wizard-de.png`, `step-wizard-en.png`, `step-wizard-de.png`; `healthcheck-log-*.png` (drei Knöpfe im Kopf); **gelöscht** `step-sensors-en.png`, `step-sensors-de.png`; mit `readme-shots.mjs` und `scripts/optimize_images.py`, Bilder ohne Unterschied in den Pixeln zurückgesetzt |

## 4. Prüfungen und Ergebnisse

Alle Prüfungen am fertigen Stand (2026-11-20, kurz nach Mitternacht), Reihenfolge wie in `CLAUDE.md`:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py` | ohne Befund |
| `node --input-type=module --check` für jede Datei unter `panel/` | ohne Befund |
| JSON gültig, `strings.json` gleich `translations/en.json`, `de.json` mit denselben Schlüsseln | ja |
| kein "ß" in Code, Texten, README, CHANGELOG, Handbuch | ja |
| `pytest` mit Python 3.13 und Home Assistant 2026.2.3 | **1604 bestanden**, 6 übersprungen |
| `pytest` mit Python 3.14 und Home Assistant 2026.10.4 | **1604 bestanden**, 6 übersprungen |
| `python scripts/mutation_check.py` (ganzer Lauf) | **408 von 408 erkannt**, kein "ÜBERSEHEN", "FEHLT" oder "MEHRDEUTIG" |
| Panel: `node tests/panel/run.mjs` (alle Suiten, je Sprache, Desktop und Handy, echte Klicks und Taps) | **72 von 72 Suiten bestanden, 8379 Prüfungen, 0 fehlgeschlagen** |

Darin unter anderem: `ntcards-e2e.mjs` 84 (neu: Aufbau, Raster, Farben, Karte, Fenster, einheitliche Zahlen, Übernehmen ohne Speichern,
Markierung "Noch nicht gespeichert" mit orangem Punkt, Abbrechen, Escape und X mit Rückfrage, ungültige Zahl, Speichern, pro Modus),
`hcnotify-e2e.mjs` 56, `wizard-e2e.mjs` 330, `hclog-e2e.mjs` 230, `actions-e2e.mjs` 562, `targets-e2e.mjs` 72, `layout-e2e.mjs` 296,
`hardening-e2e.mjs` 222, `switches-e2e.mjs` 156 (mit jedem Fenster einer Meldung), `play-e2e.mjs` 188.

README und Handbuch nennen die Zahlen dieses Stands (über 1600 Tests, rund 8400 Prüfungen, 408 Schutzmassnahmen; vorher stand dort noch 1500,
7400 und 368).

## 5. Nicht geprüft und bekannte Grenzen

- An einer echten Anlage nicht geprüft; nur in der Testumgebung von Home Assistant und im Nachbau (Computer und Handy, Deutsch und Englisch).
- Die Mockups `meldungen-*.png` und `aktionen-*.png` zeigen noch den Stand vor dem Entscheid (eine Empfängerliste, "Licht an"); die README des
  Mockups sagt das. Nicht neu aufgenommen.
- "Morgen" zählt nach dem Datum von Home Assistant, nicht nach der Uhr des Browsers.
- Der Schritt "Zeiten" setzt die Zeit zum Deaktivieren für alle Modi gleich; wer sie je Modus verschieden will, stellt das unter Konfiguration ›
  Anlage mit "Einstellungen pro Modus" ein (der Schritt sagt, wenn sie bisher verschieden waren).
- Eine Anlage, die vor dem Update angelegt, aber nie eingerichtet wurde, bekommt den Assistenten nicht von selbst (Entscheid 4); der Knopf unter
  Konfiguration › Anlage startet ihn.
- Benachrichtigungen: Die Testmeldung (Play auf der Karte und im Fenster) geht wie bisher mit dem **gespeicherten** Stand hinaus und ist bei offenen
  Änderungen gesperrt. Unter Aktionen testet das Fenster einer festen Meldung dagegen die Werte im Fenster. Angleichen hiesse, `test_notify` die
  ungespeicherten Werte mitzugeben; nicht gemacht, weil nicht verlangt.
- Die Mockups `meldungen-v1` zeigen im Fenster zwei Spalten; umgesetzt sind die Abschnitte des Fensters unter Aktionen (siehe Abschnitt 2).
- Die zusätzliche Fassung der Release Notes ab `v1.67.0` nennt für die HealthCheck-Meldung und den Kopf des Protokolls nur den Endstand; der
  CHANGELOG führt beide Versionen getrennt. Ob `v1.68.0` als Vorabversion oder offiziell veröffentlicht ist, liess sich aus der Session nicht
  prüfen (nur der Tag ist lesbar).

## 6. Release-Angaben

- Version, Tag und Titel: `v1.69.0`. Ziel: `main`, Commit nach dem Push. Vorabversion oder offiziell: nach Regel beim Nutzer nachfragen (die Frage
  zu 1.68.0 ist noch offen).
- Release Notes: `RELEASE-NOTES-1.69.0.md`. Letzter Tag ist `v1.68.0` (auf `ddcfb75`); es gilt der Abschnitt 1.69.0. Wird 1.69.0 offiziell und
  war 1.68.0 eine Vorabversion, gilt nach Regel die Fassung ab dem letzten offiziellen Release (in der Datei die Fassung ab `v1.67.0`, "Includes
  the changes from 1.68.0").
