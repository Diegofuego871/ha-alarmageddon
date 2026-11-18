# Übergabe 1.63.0 (2026-11-17)

Lieferung der externen Prüfstelle, **dritte Fassung** (ersetzt die ZIP-Dateien von 21:46 und 22:40): dazu die Ergebnisse des Code-Reviews
(Abschnitt 4b) und des Reviews des Panels (Abschnitt 4c). Wunsch des Nutzers vom 2026-11-17, 23:25: kein neues Release, alles zusammen in 1.63.0.
Basis ist `main` @ `8abe92c` (1.62.0, Tag `v1.62.0` auf `7c97e2e`, danach nur die Zeitgrenzen der CI). `v1.63.0` hat noch keinen Tag und steht nicht
auf `main` (geprüft): nach der Regel "Korrekturen an einer Version ohne Tag bleiben in derselben Version" bleibt es 1.63.0.
Zuerst dieses Protokoll, dann `docs/HANDOVER.md` (Abschnitt 1.63.0) und `CLAUDE.md` (neu: Design-Regel "Play-Knöpfe", Abschlussmeldung unter
"Feste Meldungen im Reiter Aktionen").

## 0. Inhalt der Übergabe und Anwenden

| Datei | Zweck |
| --- | --- |
| `UEBERGABE-1.63.0.md` | dieses Protokoll (identisch mit `files/docs/UEBERGABE-1.63.0.md`) |
| `RELEASE-NOTES-1.63.0.md` | Release Notes Englisch (für das GitHub-Release) und Deutsch |
| `1.63.0-auf-1.62.0.patch` | alle Änderungen als ein Patch gegen `main` @ `8abe92c` (mit den Bildern, binär) |
| `1.63.0-auf-1.63.0-zweite-lieferung.patch` | nur die Änderungen seit der zweiten Fassung von 22:40 (falls diese schon angewendet ist) |
| `files/` | jede geänderte oder neue Datei vollständig, in der Ordnerstruktur des Repositorys |

Anwenden: `git checkout main && git pull` (Stand muss `8abe92c` sein), dann `git apply --index 1.63.0-auf-1.62.0.patch`, oder den Inhalt
von `files/` über das Repository kopieren (gilt auch, wenn eine frühere Fassung schon angewendet, aber nicht committet ist). Ist die zweite
Fassung schon committet, `1.63.0-auf-1.63.0-zweite-lieferung.patch` anwenden (die erste Fassung allein: zuerst den ganzen Stand aus `files/`
kopieren). **Es ist keine Datei zu löschen.** Danach die Prüfungen aus Abschnitt 5, Commit mit Betreff
`1.63.0: Play-Knöpfe einheitlich, Abschlussmeldung wie die festen Meldungen, Codes pro Person im Fenster, Korrekturen auf dem Handy`, Push auf `main`, Release-Angaben
aus Abschnitt 7. Die Lieferung ändert keine Datei unter `.github/`.

Die Prüfstelle hat nichts committet und nichts gepusht.

## 1. Anlass und Entscheide

Bildschirmfotos und Wünsche des Nutzers vom 2026-11-17 (18:14 bis 20:39, alle vom Handy, Home Assistant mit 1.62.0):

1. Gruppe: "Wiederholen bis deaktiviert" grösser und fett.
2. Reiter Benachrichtigungen: das Kapitel "Meldungen" enthält nur noch Störungsmeldungen, also "Störungsmeldungen" heissen; daneben
   "Wartungsmeldungen".
3. Reiter Anlage auf dem Handy: Zeilen "Eigene Töne" und "Routinen" kaputt (Text Wort für Wort unter den Knöpfen, auch mit "noch nicht
   gespeichert").
4. Abschlussmeldung: gleich benennen ("Meldung: Abschlussmeldung") und gleich aufbauen wie die anderen festen Meldungen, mit dem Schalter
   aussen.
5. Play-Knopf auf den Karten der festen Meldungen; jeder Play-Knopf im Panel verhält sich gleich: beim Drücken rot und Stopp.
6. Eigene Töne: statt "Choose File" (und eines leeren Vierecks auf dem iPhone) ein Knopf im Stil des Panels mit Upload-Symbol; oben
   "Hochladen", der Knopf unten "Speichern".
7. Reiter Benachrichtigungen: der Hinweis auf den neuen Ort der Meldungen steht zu nah ("Text zu nah").
8. Fenster "Routinen" (und die anderen mit Liste, zum Beispiel "Eigene Töne"): beim Scrollen soll die Suchleiste kleben, mit immer gleichem
   Abstand zur Liste.
9. Reiter "Überwachung": den Schalter "Einstellungen pro Modus" auch dort zeigen; die Reiterleiste soll in allen Reitern fix stehen.
10. "Codes pro Person" als Fenster wie Routinen und Töne: Seite nur Einstellungen und ein Knopf zum Öffnen; im Fenster Suchfeld (klebend),
    Tabelle Name, Benutzer, Code als "******" mit einem Auge zum Einblenden, Stift (Bearbeiten im selben Fenster wie Hinzufügen, Name und
    Benutzer ausgefüllt, Kennwort leer), Papierkorb; sortierbar nach jeder Spalte ausser Code; "Code hinzufügen" in der Fusszeile; auf dem
    Handy Vollbild. Warnung bei sehr einfachen Codes (rot, fett, Achtung-Zeichen, unter den Codefeldern), Speichern bleibt immer möglich.

Rückfrage zu 4 (der Schalter im Fenster hiess bis 1.62.0 "eigener Text statt Standard", die Meldung ging immer hinaus): Entscheid des Nutzers
**"Senden ja/nein"** wie bei den anderen festen Meldungen. Aus heisst: wenn der Alarm endet, geht keine Meldung hinaus, die Alarmmeldung bleibt
auf dem Handy stehen.

Weil 4 und 5 neue Funktionen sind (Abschlussmeldung ausschaltbar, Testmeldung von der Karte), ist es 1.63.0 und nicht 1.62.1.

**Abweichung bei 10 (dem Nutzer vor dem Bau mitgeteilt):** Ein gespeicherter Code lässt sich nicht einblenden. Gespeichert ist nur ein
PBKDF2-Hash mit Salz; der Server kennt den Code danach selbst nicht mehr, und die Projektregel verbietet, einen Alarmcode im Panel zu zeigen.
Die Spalte Code zeigt deshalb einen festen Platzhalter "••••••" (gleich lang für jeden Code, verrät nichts), das Auge sitzt in den Codefeldern
des Fensters und blendet nur den gerade getippten Code ein. "Kürzer als 4 Ziffern" warnt, Speichern lehnt solche Codes aber wie bisher ab
(Regel 4 bis 8 Ziffern im Server, nicht gelockert).

## 2. Abschlussmeldung

- Neues Feld `workflow_end[auslöser].send` (nur `false` wird gespeichert). **Fehlt es, geht die Meldung wie bisher hinaus**; `notify.enabled`
  heisst weiterhin nur "eigene Werte statt Standard" und wird nie als "aus" gelesen (das Schema setzt dort `False` als Standard, ältere Werte
  und Sicherungen tragen es). Server: `schemas.END_SCHEMA`, `websocket_api._clean_end` (behält "aus" und die eigenen Werte),
  `Notifier._end_value`, `_end_sends`; beim Deaktivieren aus dem Alarm und beim Quittieren.
- Ist sie aus, geht nach einem Alarm **nichts** hinaus, auch nicht "Deaktiviert". Die kritische Alarmmeldung bleibt dann auf dem Handy
  stehen (sie wird sonst durch die Abschlussmeldung mit demselben tag ersetzt). Das steht im Hinweis des Fensters.
- Panel: Karte mit Schalter, "Meldung: Abschlussmeldung", Kurzfassung (Empfänger, kritisch, eigener Text, oder "Aus"), Play, Stift, Glocke wie
  die anderen. Im Fenster "Meldung senden" (an/aus), darunter die Felder; der frühere Schalter "eigene Meldung" ist weg, leere Felder heissen
  Standardtext. Eigene Werte werden nur gespeichert, wenn etwas vom Standard abweicht.
- **Beim Testen gefundener Fehler, behoben:** nach dem Speichern von "aus" übernahm das Panel den Stand lokal nur mit eigenen Werten
  (`save()`: `filter(v => v.notify)`); die Karte sprang auf "an" zurück und zeigte eine Scheinänderung.

## 3. Play-Knöpfe

Bestand vorher und jetzt:

| Knopf | bis 1.62.0 | jetzt |
| --- | --- | --- |
| Schritt testen, "Testen" unten | rot, Stopp | unverändert (gemeinsame Klasse) |
| Eigene Töne abspielen | rot, Stopp | unverändert (gemeinsame Klasse) |
| Probehören im Fenster eines Tons | blau, Stopp | rot, Stopp |
| Schritt der Überwachung testen | blau markiert, Play | rot, Stopp |
| Testmeldung (Benachrichtigungen, Fenster der Meldungen) | keine Änderung | rot, Stopp |
| Karten der fünf festen Meldungen | kein Play | neu: Play, rot, Stopp |

- Gemeinsam: Klasse `ag-running` (rot wie `--ag-error`, weiss, pulsiert, bei "Bewegung reduzieren" ohne Puls).
- Einmalige Tests (Testmeldung, Schritt der Überwachung): `common.js onceBtn`, `paintOnce`, `runOnce`. Der Knopf bleibt rot, bis der Server
  geantwortet hat, mindestens `ONCE_MS` (1,5 s). **Stopp beendet dort nur die Anzeige**: eine gesendete Meldung lässt sich nicht
  zurückholen, ein Gerät der Überwachung schaltet trotzdem (höchstens `SERVICE_TIMEOUT`).
- Karte und Fenster einer festen Meldung teilen denselben Test (gleicher Schlüssel). Die Karte sendet die Werte des Entwurfs (auch
  ungespeichert), das Fenster die Werte im Fenster. Ausgeschaltet ist Play gesperrt.
- Gefunden beim Testen: Die Überwachung zeichnete beim Ende des Tests die ganze Seite neu. Endete der Test (nach 1,5 s), während die Anlage
  nach dem Speichern neu lud, blieb die Ladeanzeige stehen (Suite `monitor-e2e`). Jetzt werden nur die Knöpfe umgemalt, wie überall.

## 4. Weitere Änderungen

- Kapitel "Störungsmeldungen" (EN "Fault messages"); Hinweis darunter mit 16 px Abstand zur Karte und 32 px zum nächsten Kapitel.
- Gruppe: Zusammenfassung 16 px fett.
- Reiter Anlage: `.ag-rtsum` bricht um; auf dem Handy stehen die Knöpfe unter dem Text und teilen sich die Breite. Ursache war
  `flex-wrap: nowrap` mit `min-width: 0` am Text: bei 390 px hatte der Text die Breite 0 (im Nachbau gemessen, die Suite war vorher rot).
- Feste Meldungen auf dem Handy: Play und Stift unter dem Text wie bei den Schritten.
- Eigene Töne: Dateiwahl als Knopf "Hochladen" (`customsounds.js pickHtml`), das echte Feld unsichtbar darüber (nicht `hidden`: so öffnet ein
  Tippen die Auswahl auch auf dem iPhone); der Name steht daneben (`filePicked`, im zentralen `change` des Panels). Wird das Feld geleert
  (Auswahl abgebrochen), ist auch keine Datei mehr gewählt. Der Knopf unten heisst "Speichern" (Symbol Häkchen).
- Fenster "Routinen", "Eigene Töne", "Sicherungen": Titel und Suchleiste stehen in einem klebenden Kopf (`.ag-pop-head`, Hintergrund wie das
  Fenster, reicht bis an die Ränder); die Liste läuft darunter durch, der Abstand von der Suchleiste zur Liste ist immer der untere Rand des
  Kopfs (14 px). Das X liegt darüber und überdeckt das Suchfeld nicht.
- Reiter "Überwachung": statt des unsichtbaren Platzhalters (1.58.0) steht der echte Schalter "Einstellungen pro Modus"; die Reiterzeile
  steht in allen Reitern auf derselben Höhe (geprüft in beiden Stellungen des Schalters). Umschalten dort lässt den Reiter "Überwachung"
  gewählt (vorher sprang es zum ersten Modus; der Schalter war dort aber nicht erreichbar).
- Bilder: `silent-*`, `group-*`, `actions-disarm-*` neu; `readme-shots.mjs` beachtet beim Bild "actions-disarm" beide festen Leisten und
  bricht ab, wenn die Überschrift darunter läge.

## 4a. Codes pro Person im Fenster

- **Server:** neuer WebSocket-Befehl `update_code` (nur Administratoren, nur geladene Anlagen dieser Integration): Name, Benutzer und optional ein
  neuer Code. Ohne Code bleiben Hash und Salz unverändert; ein neuer Code wird sofort gehasht (neues Salz), nie geloggt, nie zurückgegeben.
  Dieselben Prüfungen wie `add_code` (Format, Name, Benutzer, Code einer anderen Person oder Hauptcode), der bearbeitete Eintrag zählt dabei
  nicht mit. Ein schon verknüpfter Benutzer, den Home Assistant nicht mehr kennt, darf bleiben (sonst liesse sich der Eintrag nicht mehr
  umbenennen). Antwort `{"ok": true, "reload": …}` wie beim Entfernen.
- **Panel:** Seite mit Zusammenfassung ("2 Codes", Knopf "Codes anzeigen"), Hauptcode und "Quittieren verlangt den Code"; der Hinweis steht als
  Text über der Karte wie bei Routinen und Tönen. Fenster `#ag-codelist`: klebender Kopf mit Suche (Name und Benutzer), Tabelle Name, Benutzer
  ("Benutzer nicht verfügbar" für einen gelöschten oder deaktivierten), Code als Platzhalter, Stift, Papierkorb; sortierbar nach Name und
  Benutzer (Personen ohne Benutzer immer unten); Fusszeile "Schliessen" und "Code hinzufügen" (bei 20 Codes gesperrt); leer ein Hinweis mit
  Knopf in der Mitte. Unter 360 px Breite fällt die Spalte Code weg (bei 320 px ragte die Tabelle sonst 8 px hinaus).
- **Fenster Hinzufügen/Bearbeiten** (`#ag-codes`): Bearbeiten mit Name und Benutzer, Codefelder leer mit Hinweis "Leer lassen: der bisherige
  Code bleibt". Ungespeichert gilt nur, was vom Stand beim Öffnen abweicht (`data-init`). Auge je Codefeld (Typ `password`/`text`, nur dieses
  Feld); beim Schliessen werden beide Felder geleert und wieder verdeckt.
- **Warnung** (`system.js codeWeakness`, nur im Panel, der Code verlässt das Fenster dafür nicht): Zahlenfolgen auf- und absteigend (auch
  7890, in Zweierschritten 2468), nur eine Ziffer, wiederholte Muster (1212, 123123) und Paare (1122), drei gleiche Ziffern hintereinander,
  Spiegelzahlen, Linien auf dem Tastenfeld (2580, 147258, 159357), Jahreszahlen 1900 bis 2099 (vier Ziffern), Daten TTMMJJ, TTMMJJJJ, JJJJMMTT.
  "Zu kurz" erst nach dem Verlassen des Felds (sonst stünde es bei jeder Eingabe kurz da). Mehrere Gründe stehen in einer Zeile.

## 4b. Code-Review (Auftrag des Nutzers 20:44, Freigaben 21:56)

Freigegeben: B2 bis B5 umsetzen, P1 nicht; Verdachtsfälle mit Tests prüfen und verbessern; die verhaltensgleichen Verbesserungen D1 bis D4.
Jede Korrektur hat einen Test, der vorher rot war (geprüft über eine Zeile in `scripts/mutation_check.py` oder, beim Panel, mit der alten Datei).

| Punkt | Datei | Änderung |
| --- | --- | --- |
| B2 | `config_flow.py` | Neuer Hauptcode, der einem persönlichen Code gleicht: Fehler `code_taken` (Text EN/DE), der bisherige bleibt |
| B3 | `config_flow.py` | Anlegen: Name wie im Panel (`systems.new_system_name`), Fehler `name_taken` beim Feld statt Abbruch; `abort.already_configured` entfernt (ungenutzt) |
| B4 | `backup.py` | Sperre um Lesen, Ändern, Schreiben (`_lock`); Test mit langsamer Ablage (im Testspeicher zeigte sich der Wettlauf sonst nicht) |
| B5 | `custom_sounds.py` | Sperre um das Hochladen (`_add_lock`): kein doppelter Name, keine Grenze überschritten |
| V1 | `routines.py` | Start einer Routine fängt jeden Fehler (vorher nur KeyError, ValueError, TypeError): ein Auslöser als Text liess die ganze Anlage ungeladen |
| V2 | `backup.py` | Wiederherstellen liest "hat einen Code" aus den Optionen (`_has_code`), nicht vom Automaten einer evtl. nicht geladenen neuen Anlage |
| V3 | `websocket_api.py` | `save_zones`: fehlender Modus behält seine Zone (wie `save_workflows`) |
| V4 | `reception.py` | Beschädigte Ablage: leerer Verlauf, die Aufzeichnung startet (vorher blieb sie bis zum Neustart aus) |
| V5 | `sensor_history.py` | Beschädigte Stunde fällt weg (`_row`), statt dass das Laden der Statistik scheitert |
| D1 | `custom_sounds.py` | Prüfung der Dateien beim Start im Executor statt im Event-Loop |
| D2 | `routines.py` | Variable `known` nicht mehr überschrieben (`event_state`) |
| D3 | `workflow.py` | Ermittlung der Adresse für Töne einmal (`_base_url`) statt doppelt |
| D4 | `panel/card.js` | Entitäten der Anlage je Stand der Registrierung gemerkt (`WeakMap`); `card-e2e` zählt die Durchsuchungen (mit der alten Datei rot) |

`PANEL_VERSION` 223 (falls die erste Fassung schon installiert war). 11 neue Zeilen "Code-Review 1.63.0" in `scripts/mutation_check.py`.

## 4c. Review des Panels (Auftrag des Nutzers 23:04, Freigaben 23:2x)

Alle Module unter `panel/` sind gelesen (`styles.js` und `strings.js` automatisch geprüft, siehe 6). Verhaltensgleich direkt umgesetzt:

| Punkt | Datei | Änderung |
| --- | --- | --- |
| D5 | `panel/common.js` | 5 nie benutzte Symbole entfernt (`verOk`, `flask`, `refreshAuto`, `fork`, `blindsOpen`; geprüft in Panel, Server und Tests) |
| D6 | `panel/actions.js`, `sensors.js`, `system.js` | `;;` entfernt, zwei Kommentare eingerückt |
| D7 | `panel/actions.js` | Schalter "Einstellungen pro Modus": eine Zuweisung aus `_effective`, die bei eingeschaltetem Schalter die eigenen Listen zurückgab, also nichts bewirkte, entfernt; der Kommentar beschreibt jetzt, was wirklich geschieht |
| D8 | `panel/styles.js` | Regeln des früheren Zeitplans ohne Treffer entfernt (`.ag-schwarn`, `.ag-schrow.dim`, `.ag-schrow .ag-toggle`, `select.ag-input` in `.ag-schrow`); Bild des Routinen-Editors mit Zeitplan vorher und nachher pixelgleich (Desktop und Handy) |

Vom Nutzer freigegeben (alle acht, je mit Test, der mit dem alten Stand rot war):

| Punkt | Datei | Befund und Änderung |
| --- | --- | --- |
| B6 | `websocket_api.py`, `panel/system.js` | Doppelklick auf "Speichern" bei "Code hinzufügen" legte den Code zweimal an (im Test: zweimal "Anna" mit demselben Code). Ursache: zwischen Prüfen und Schreiben liegen `match_code` und `hash_code` im Executor, ohne Sperre. Jetzt `_codes_lock` je Anlage um `add_code`, `update_code`, `remove_code`, Prüfung gegen die gespeicherten Optionen (`_stored_codes`); gleichzeitiges Bearbeiten und Entfernen holte einen entfernten Code zurück, auch das ist behoben. Panel: der Knopf nimmt bis zur Antwort keinen zweiten Druck an (`_sendOnce`). **Korrektur meiner Meldung im Chat:** dort stand, der Server prüfe gegen einen veralteten Stand des Automaten; `controller.codes` liest die Optionen aber immer frisch, die Ursache ist allein die fehlende Sperre |
| F1 | `panel/alarmageddon-panel.js` | Verbindungsfehler: immer nur eine geplante Wiederholung (`_retryTimer`); bisher plante jede gescheiterte Abfrage eine eigene, nach einer Stunde Ausfall liefen rund 120 Ketten, bei der Rückkehr kamen alle zugleich beim Server an. Sichtbar gleich (Hinweis einmal, alle 5 s ein Versuch) |
| B7 | `panel/system.js` | Ebenso gesperrt bis zur Antwort: "Sichern", "Wiederherstellen", Umbenennen eines eigenen Tons (Doppelklick: zwei gleiche Sicherungen, ein zweiter Import) |
| V7 | `panel/sensors.js` | Nach dem Ziehen über Kästchen verschluckte das Panel den nächsten Tastendruck (Leertaste, Eingabe) auf einem Kästchen; ein click der Tastatur (`ev.detail` 0) wird nie mehr verworfen |
| B9 | `panel/strings.js`, `monitor.js`, `system.js` | Fehlertexte mit der richtigen Einheit: `invalidHours` (Erinnerung), `invalidMinutes` oder Sekunden bis 3600 (Schritt "Warten" der Überwachung, bisher "Sekunden von 0 bis 60"), `invalidCount` (Anzahl automatischer Sicherungen) |
| B10 | `panel/list.js`, `sensorview.js` | Sensoransicht, Reiter "Gerät": "Immer aktiv" stand bei jeder Anlage, deren Sensorart es voreingestellt hat, auch ohne den Sensor und bei ausgeschaltetem "Immer aktiv"; jetzt dieselbe Rechnung wie die Liste der Übersicht (`list.members()` liefert dafür `always`) |
| B8 | `panel/system.js` | Vorlesetexte der Zahlenfelder im Reiter Anlage: der Titel der Zeile statt `exit_delay`, `entry_delay`, `confirm_window` |
| B11 | `panel/routines.js`, `monitor.js`, `strings.js` | Geräteauswahl lädt mit den drei Punkten statt "Geräte werden geladen ..." (Regel in `loader.js`); der Text `rtLoading` ist entfernt |

Nicht geändert, nur festgehalten: Der Kopf der Sensoransicht (Zustand, Kacheln) ist eine Momentaufnahme beim Öffnen und Laden. Bleibt das
Panel ohne `hass` (nur ausserhalb von Home Assistant), entfernt `panel.html` das Element nach 15 s, der Takt von 250 ms läuft aber weiter; in
Home Assistant tritt das nicht ein. `_dataField` in `actions.js` setzt `min`, `max`, `step` aus `hass.services` ohne `esc` in Attribute (Werte
der Integrationen von Home Assistant).

`PANEL_VERSION` 224 (falls eine frühere Fassung schon installiert ist). 3 neue Zeilen "Code-Review 1.63.0 ... (keine Sperre)" in
`scripts/mutation_check.py` (347).

## 5. Prüfungen und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components tests scripts` | keine Funde |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1459 bestanden, 6 übersprungen (1.62.0: 1436; erste Fassung: 1446; zweite: 1457) |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1459 bestanden, 6 übersprungen |
| `python scripts/mutation_check.py` (Python 3.13) | 347 von 347 erkannt (1.62.0: 319 Zeilen; zweite Fassung: 344; in einer Kopie des Stands, die danach unverändert war) |
| `cd tests/panel && node run.mjs` | 64 Suiten, 6809 Prüfungen, alle bestanden (ein vollständiger Lauf mit dem endgültigen Stand) |
| `node --input-type=module --check` für alle Dateien unter `panel/` | ohne Fehler |
| Patch auf einem sauberen Stand `8abe92c` angewendet und mit `files/` verglichen | identisch |

Alle Läufe mit dem endgültigen Stand der dritten Fassung. Neue Suite `codereview-e2e.mjs` (64 Prüfungen, viermal hintereinander grün; mit den Panel-Dateien der zweiten Fassung 42 rot); im Nachbau neu `window.__wsDown` (jeder Aufruf scheitert sofort mit Fehler 3). `tests/test_codes.py`: zwei neue Tests (Doppelklick, Bearbeiten und Entfernen zugleich), mit dem alten Stand rot (Mutationszeilen). Drei ältere Mutationszeilen zu Codes wegen der neuen Einrückung unter der Sperre nachgeführt (Muster, nicht Inhalt). In der ersten Fassung brach `monitor-e2e` einmal ab: ein Tipp auf "Regel hinzufügen"
kam, während die Ladeanzeige nach dem Speichern noch stand (dieselbe Ursache wie früher in `notices-e2e`); die Suite wartet jetzt, bis das
Neuladen vorbei ist. `tests/test_security.py`: der Fall "Eingangssensor ausserhalb der aktiven Zonen" von `save_zones` sendet jetzt alle Modi
(ein fehlender Modus behält seine Zone, siehe 4b V3).

Neue Suiten: `play-e2e.mjs` (jeder Play-Knopf, 136 Prüfungen), `sumrow-e2e.mjs` (Zeilen im Reiter Anlage, vorher rot), `popsticky-e2e.mjs`
(klebender Kopf der Fenster mit Liste, mit dem Fenster der Codes 63), `codes-e2e.mjs` (Fenster der Codes, Bearbeiten, Auge, Warnungen, 291).
Angepasst: `actions`, `customsounds`, `group`, `hardening` (Codes im Fenster), `layout`, `monitor` (Schalter im Reiter "Überwachung", Warten
auf das Neuladen), `notices` (Abschlussmeldung, Kapitel, Abstand des Hinweises). Neue Python-Tests in `tests/test_event_notify.py`
(Abschlussmeldung aus beim Deaktivieren und Quittieren, alte Werte senden weiter, Speichern, Sicherung, ungültige Werte) und
`tests/test_codes.py` (Bearbeiten ohne und mit Code, Prüfungen, gelöschter Benutzer); `tests/test_security.py`: `update_code` in `COMMANDS`,
Antwort von `update_code` ohne Geheimnisse. 14 neue Zeilen in `scripts/mutation_check.py` (5 Abschlussmeldung, 9 Code bearbeiten).

## 6. Nicht geprüft und bekannte Grenzen

- **Die echte Anlage und echte Geräte**, Home Assistant 2026.11 selbst (das Testpaket gibt es erst für 2026.10.4).
- **iPhone:** Die Dateiwahl ist im Nachbau mit einem Testbrowser geprüft (Klick auf das unsichtbare Feld, Name daneben), nicht auf einem
  echten iPhone. Bitte einmal dort einen Ton hochladen.
- **Stopp bei einer Testmeldung** beendet nur die Anzeige (siehe 3).
- **Nicht geändert:** Die Knöpfe Play, Stift und Papierkorb im Fenster "Eigene Töne" haben auf dem Handy keinen Rand (anders als die runden
  Knöpfe sonst; auf dem Bildschirmfoto des Nutzers zu sehen). Sie verhalten sich wie alle Play-Knöpfe, sehen aber anders aus. Auf Wunsch angleichen.
- **Codes:** Die Warnung ist eine Auswahl von Mustern, keine Garantie; ein Code ohne Warnung kann trotzdem leicht zu erraten sein (zum
  Beispiel ein Geburtstag in der Form TTMM). Ein Benutzer, den Home Assistant nicht mehr kennt, ist im Nachbau geprüft, nicht mit einem echten
  gelöschten Benutzer.
- **Code-Review nicht vollständig:** gelesen sind das ganze Backend (ausser den Importen am Anfang von `websocket_api.py` und `const.py`, nur
  überflogen) und alle Module unter `panel/` sowie `panel.html`. `styles.js` ist automatisch geprüft (alle 3512 Deklarationen mit
  `CSS.supports` in Chromium, Variablen, ungenutzte Klassen), nicht Zeile für Zeile gelesen; `strings.js` automatisch (Schlüssel EN = DE,
  Platzhalter je Schlüssel gleich, jeder benutzte Schlüssel vorhanden, ohne Eszett), die Texte nicht einzeln. Tests, Skripte, CI und Doku sind
  nicht durchgesehen. Die Dashboard-Karte setzt voraus, dass Home Assistant `hass.entities` bei einer Änderung ersetzt (so im Nachbau und nach
  unserem Wissen im Frontend); änderte es das Objekt an Ort und Stelle, sähe die Karte eine neue Entität ihrer Anlage erst nach dem Neuladen
  der Seite.
- **Nachbau:** Die Fusszeile im Reiter Aktionen bricht im Nachbau bei 390 px auf zwei Zeilen um ("Speichern" in der zweiten), auf dem echten
  Handy des Nutzers nicht (Bildschirmfotos). Nicht untersucht.

## 7. Release-Angaben

- Version, Tag und Titel: `v1.63.0`. Ziel: `main`, Commit nach dem Push. Vorabversion: nach Regel beim Nutzer nachfragen.
- Release Notes: `RELEASE-NOTES-1.63.0.md`.
- `PANEL_VERSION` 221 auf 224, `manifest.json` 1.63.0. Neuer WebSocket-Befehl `alarmageddon/update_code`.
