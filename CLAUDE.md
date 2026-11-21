# CLAUDE.md – Alarmageddon

Anweisungen für Claude Code in diesem Repository. Zuerst `docs/HANDOVER.md`
(Stand, nächste Schritte, Zweisprachigkeit), dann vor jeder Arbeit lesen,
zusammen mit `docs/CONCEPT.md`, `docs/LEARNINGS.md` und `docs/DESIGN.md`.

Die Regeln sind aus Diegofuego871/ha-device-panel übernommen (Wunsch des
Nutzers, 2026-11-08) und auf Alarmageddon angepasst. Bei Fragen zum Vorgehen
dort nachsehen: ha-device-panel ist Vorbild in Aufbau, Arbeitsweise und
Design.

## Projekt

Home-Assistant-Integration (HACS, Domain `alarmageddon`): stellt eine
Alarmanlage als `alarm_control_panel`-Entität bereit. Einrichtung grafisch in
einem automatisch angelegten Seitenpanel: Sensorgruppen "Anwesend" und
"Abwesend" per Drag and Drop, frei konfigurierbare Alarmszenarien (Sirene,
Rollläden, Medien, kritische Push-Meldungen mit Aktionen), Wartungsübersicht
der Sensoren nach Bereich (Batterie, letzte Aktivität, Prognose) und
Überwachung nach dem Vorbild von Device Panel. Konzept: `docs/CONCEPT.md`,
Mockups: `docs/mockups/konzept-v1/`.

Feste Vorgaben des Nutzers (2026-11-08):

- **Mehrere Alarmanlagen pro HA:** ein Config Entry pro Alarmanlage, jede mit
  eigenem Gerät und eigener `alarm_control_panel`-Entität. Kein
  `single_config_entry`.
- **Apple HomeKit ist zentral:** Jede Alarmanlage muss sich über die
  HomeKit-Bridge von HA übergeben und dort steuern lassen. Zustände,
  unterstützte Funktionen und Code-Verhalten so wählen, dass HomeKit sie
  abbildet; Verhalten im HA-Quellcode (`homeassistant/components/homekit`)
  prüfen und mit Tests absichern, nicht annehmen.
- **Neutrale Texte (Vorgabe des Nutzers, 2026-11-14):** In Texten für Nutzer (Panel, Meldungen, README, Release Notes) nie davon
  ausgehen, dass jemand Apple Home oder ein bestimmtes Gerät hat. Apple Home nur als Beispiel ("zum Beispiel Apple Home"), der
  Abschnitt "Apple HomeKit" der README bleibt als Anleitung. Herstellernamen wie Sonos nicht in Texten, sondern "Medienplayer".
  Im Quelltext (Dienstaufrufe, Tests, Nachbau) sind sie erlaubt.
- **Modi frei wählbar (geändert 2026-11-08, vorher waren "Anwesend" und
  "Abwesend" immer da):** pro Alarmanlage "Anwesend", "Abwesend" und
  "Nacht" einzeln ein- und ausschaltbar, im Panel unter Konfiguration ›
  Anlage, mindestens einer. Standard: Anwesend und Abwesend an, Nacht aus.
  Den Modus, in dem die Anlage gerade scharf ist, kann man nicht abschalten.
- **Veröffentlichung über HACS:** alle Regeln von HACS und hassfest
  einhalten (siehe "HACS").
- **Jede Funktechnik:** Alarmageddon arbeitet nur mit HA-Entitäten
  (`binary_sensor`, `sensor` für Batterie, `siren`, `cover` …) und ist damit
  unabhängig von der Technik. Der Nutzer selbst nutzt WLAN und Thread
  (Matter); Zigbee (ZHA, Zigbee2MQTT), Z-Wave, Bluetooth und andere müssen
  ebenso gehen. Angaben je Technik (Signal, "zuletzt gesehen",
  Koordinator-Ausfall) nur als Zusatz, wo verfügbar, nie als Voraussetzung.
- **Responsiv:** Das Panel nutzt einen Desktop-Monitor in der Breite gut
  aus (mehrspaltig, Kacheln füllen die Fläche, keine schmale Mittelspalte)
  und ist auf dem Handy in der Companion App ebenso gut bedienbar (Tippen
  statt Ziehen, grosse Trefferflächen, Blätter von unten, Safe-Area). Jede
  Ansicht wird auf Desktop und Handy (390 × 844) gebaut und geprüft.

## Sprache (Vorgabe des Nutzers, wörtlich)

> Die Integration soll grundsätzlich English sein, erkennt aber zusätzlich
> Deutsch, wenn HA so läuft.
> Alle README und Release Notes führen wir ab jetzt in diesen beiden Sprachen.
> Mockups sind grundsätzlich deutsch.

Umsetzung:

- Integration: Englisch ist die Grundsprache und der Rückfall. Deutsch, wenn
  HA auf `de`/`de-*` läuft (Panel: `hass.locale.language`; Server:
  `hass.config.language`). Jede andere Sprache bekommt Englisch.
- README: `README.md` (Englisch) und `README.de.md` (Deutsch), gleicher
  Aufbau, gegenseitig verlinkt, immer beide im selben Commit. Die README ist seit 1.58.0 kurz (Idee, drei Schritte, Rundgang,
  Sicherheit); alle Einzelheiten stehen im Handbuch `docs/MANUAL.md` und `docs/MANUAL.de.md` (gleicher Aufbau, ein Test prüft es).
  Neue Einzelheiten gehören ins Handbuch, nicht in die README. Direkt unter den Abzeichen steht in beiden READMEs der Knopf "Buy Me a Coffee"
  (Wunsch des Nutzers, 2026-11-18, Vorbild: Orphan Entity Cleaner in HACS; `width`/`height` als Attribute, GitHub entfernt `style`).
- CHANGELOG: `CHANGELOG.md` (Englisch) und `CHANGELOG.de.md` (Deutsch),
  gleicher Aufbau nach Keep a Changelog (Added/Hinzugefügt, Changed/Geändert,
  Deprecated/Veraltet, Removed/Entfernt, Fixed/Behoben, Security/Sicherheit),
  immer beide im selben Commit.
- Release Notes: Englisch **und** Deutsch (abweichend von ha-device-panel,
  wo sie nur Englisch sind). Grundlage sind die Abschnitte aus beiden
  CHANGELOG-Dateien.
- Mockups: Deutsch, mit erfundenen Daten.
- Panel-Texte in `panel/strings.js`, Englisch und Deutsch mit denselben
  Schlüsseln; HA-Texte in `strings.json` = `translations/en.json` und
  `translations/de.json`. Kein Text fest im Code.
- **"Backup", nie "Sicherung" (Vorgabe des Nutzers, 2026-11-18):** Deutsch
  heisst es in Panel, HA-Texten, README und Handbuch durchgängig "das Backup",
  "Backup erstellen", "Backups anzeigen"; nie "Sicherung", "sichern",
  "gesichert" für ein Backup (`tests/test_translations.py -k backup`).
  "Sicherheit" ist etwas anderes. Code-Kommentare und frühere Einträge im
  CHANGELOG bleiben, wie sie sind.
- Kommunikation mit dem Nutzer: Deutsch, Schweizer Rechtschreibung (nie "ß",
  immer "ss"), präzise, ohne Füllwörter. Anführungszeichen: "".
- Code-Kommentare und Docstrings auf Deutsch. Kommentare erklären das Warum,
  nicht das Was.
- **Zeitangaben in Schweizer Zeit (Vorgabe des Nutzers, 2026-11-15):** Jede Uhrzeit, die dem Nutzer genannt wird (geplante CI-Prüfungen,
  Zeitpunkte aus Logs, Release-Zeiten), steht in Schweizer Zeit (`Europe/Zurich`: im Winter MEZ = UTC+1, im Sommer MESZ = UTC+2), nie in
  UTC. Bei `send_later` und geplanten Aufgaben die Zeit mit `[Europe/Zurich]` angeben und dem Nutzer die Schweizer Zeit nennen. Zeitstempel
  in Commits, Logs und Dateien bleiben unverändert.

## Arbeitsweise

- Vor grösseren UI-Änderungen Mockups bauen (HTML, gerendert als Bild,
  mehrere Varianten mit Empfehlung, Desktop und Handy). Der Nutzer
  entscheidet visuell. Ablage: `docs/mockups/<thema>-vN/` mit `README.md`,
  Bildern und Quelle unter `src/`.
- Bei Entscheidungen mit Verhaltensänderung oder Risiko nachfragen, mit
  Auswirkungen und Empfehlung. Kleine, klare Fehler direkt beheben.
- Nichts annehmen, was sich prüfen lässt: Code, HA-Quellcode, Tests.
- Screenshots, Mockups und Testdaten nur mit erfundenen Daten.
- Sicherheitsrelevantes (Tokens, Keys, Alarmcode) nie im Panel anzeigen und
  nie loggen.
- Andere Integrationen nie ohne ausdrücklichen Knopfdruck des Nutzers ändern.
  Szenario-Aktionen, die der Nutzer selbst eingerichtet hat, sind davon
  ausgenommen.

## Sicherheitsregeln (Alarmageddon)

- Eine Alarmanlage muss im Zweifel alarmieren, nicht schweigen. Fehler in
  einem Szenario-Schritt brechen die übrigen Schritte nicht ab.
- Deaktivieren stoppt immer alle laufenden Schritte und führt die
  Gegenaktionen aus, auch nach einem Neustart von HA mitten im Alarm.
- Kein Gerät darf den Ablauf der Alarmaktionen aufhalten: Jeder Aufruf wartet
  höchstens 10 Sekunden (`SERVICE_TIMEOUT` in `workflow.py`), dann geht der
  Ablauf weiter; Deaktivieren beendet hängende Aufrufe, auch solche, die
  Abbrüche ignorieren. Jeder neue Schritt im Ablauf braucht einen Test mit
  hängendem Gerät (`tests/test_action_hang.py`).
- Nichts, was beim Auslösen mitläuft, darf die Alarmaktionen aufhalten oder verhindern (seit 0.40.0): Zuhörer des
  Automaten werden einzeln aufgerufen (`controller._call_each`; die Alarmaktionen hängen als letzter Zuhörer an derselben
  Liste wie Protokoll, Aufzeichnung und Meldung), Meldungen gehen ohne Abwarten hinaus, die Ablage vor dem ersten Schritt
  wartet höchstens `SNAPSHOT_TIMEOUT`, Mitschreiben (Zeitachse, gespeicherter Stand) steht im `try`. Schritte, die etwas
  ausführen, laufen standardmässig weiter (seit 1.10.0; `workflow.step_waits`: nur mit `"wait": true` wartet der Ablauf,
  ältere Schritte ohne die Angabe warten wie bisher); ein Schritt, der nie von selbst endet (Ton "bis zum Deaktivieren"),
  wartet nie. Darüber wacht der
  Wächter (`workflow._watched`, `step_budget`, `start_budget`, `_check_started`, `_on_flow_done`): in `async_run` und
  `_execute` steht jedes `await` unter `self._watched(...)` (ein Test prüft das am Quelltext), jeder Schritttyp hat eine
  Grenze in `step_budget`. Jeder neue Zuhörer,
  jeder neue Schritt und alles, was vor dem ersten Schritt läuft, braucht einen Test "scheitert" und "hängt" in
  `tests/test_action_hang.py` und eine Zeile in `scripts/mutation_check.py`.
- Wie lange Sirene und Ton laufen, bestimmt allein der Nutzer (rechtlich wichtig: eine Sirene endet nach der gewählten Zeit).
  Nie eine feste Dauer in den Code schreiben. Die Dauer steht im Ablauf (Schritt "Warten", "Dauer" beim Ton), gilt genau und
  zählt ab dem ersten Start des Schritts, auch über Neuladen und Neustart (`workflow._remaining`). Die Grenzen des Wächters
  begrenzen nur Antwortzeiten und liegen immer über der eingestellten Zeit. Jede Änderung an Schritten mit Dauer braucht einen
  Test in `tests/test_duration.py`.
- Töne stellen den Lautsprecher nach dem Ende selbst zurück (seit 1.26.0, Standard an, je Schritt `restore`): Merken vorher
  (`workflow._remember`) und Zurückstellen danach (`_put_back`, auch wieder aus, wenn er aus war) sind nie ein Hindernis: jeder Aufruf
  steht unter den Grenzen, `step_budget` rechnet sie ein. Tests in `tests/test_tone_restore.py` (auch hängend und scheiternd), Zeilen
  in `scripts/mutation_check.py`.
- Aktionen beim Deaktivieren (seit 1.27.0, Schritt `dechime` und Liste `workflows_disarmed` je Modus): Sie laufen bei jedem Deaktivieren
  (`workflow._on_disarmed`, aus dem Alarm im Lauf der Aktionen nach dem Quittieren, `_end`), nie bei "Quittieren" und nie ohne scharfen
  Modus (`_mode_seen`). Sie sind Zusatz: Scharfschalten und Alarm beenden sie sofort, kein Gerät und kein Fehler hält den Alarm oder das
  Scharfschalten auf. Tests in `tests/test_disarmed_actions.py` und `tests/test_action_hang.py`, Zeilen in `scripts/mutation_check.py`.
- Rückgängig nach einer Zeit (seit 1.37.0, Schritt "Gerät schalten", `undo_after`): die Zeit bestimmt allein der Nutzer und zählt ab dem Aufruf, auch über
  Neuladen und Neustart (`run["undo"]`, `workflow._arm_undo`); Deaktivieren, Quittieren und das Ende eines Tests schalten sofort zurück
  (`_flush_undos`), der Gegendienst ist wie jeder Aufruf begrenzt. Tests in `tests/test_undo_after.py`, Zeilen in `scripts/mutation_check.py`.
- Deaktivieren per Push-Aktion ist standardmässig aus.
- Automatische Sicherung (seit 1.47.0, `backup.async_run_auto_backup`): Standard an und wöchentlich (Entscheid des Nutzers, 2026-11-16); höchstens `AUTO_BACKUP_KEEP` automatische neben `MAX_BACKUPS` eigenen; sie ist Zusatz und wirft nie einen Fehler (ein Fehler steht im Log, die Anlagen laufen weiter); Codes sind nie enthalten. Tests in `tests/test_auto_backup.py`, Zeilen in `scripts/mutation_check.py`.
- Routinen (seit 1.44.0, `routines.py`, ersetzen den Zeitplan; Entscheid des Nutzers, 2026-11-16): Eine Routine schaltet die Anlage nach Zeit oder
  wenn Geräte von HA etwas tun. Sie läuft nur bei einem **echten Wechsel** zwischen zwei bekannten Zuständen und neu erfüllter Bedingung (nie im
  Dauerzustand, nie nach einem Neustart, nie bei der Rückkehr aus "nicht verfügbar" oder "unbekannt": ein Funkabriss schaltet die Anlage nie).
  Der Zustand der Anlage beim Auslösen muss zu den gewählten Zuständen der Routine gehören, sonst wird übersprungen und protokolliert
  (`routine_skipped`). Scharfschalten gilt nie bei Eingangsverzögerung oder Alarm (Schema und Laufzeit prüfen es unabhängig). **Jeder Zustand ausser "Anlage deaktiviert"** braucht `unsafe` (Bestätigung "Ich habe das verstanden") in der Routine, für Deaktivieren und Scharfschalten (Entscheid des Nutzers, 2026-11-16, ersetzt "nur Deaktivieren"): neue Routinen starten nur mit "Anlage deaktiviert", im Panel sind die anderen Zustände bis zur Bestätigung gesperrt, der Server prüft neue und geänderte Routinen streng (`routines.check_routines`, `known`); unveränderte Routinen aus dem Bestand und Sicherungen gelten weiter und tragen "Bestätigung fehlt". Kein zusätzlicher Schalter der Anlage;
  Deaktivieren in anderen Zuständen trägt im Panel die Marke "Umgeht den Code". Eine Routine löst nie eine andere aus (Entitäten von Alarmageddon sind als Auslöser
  abgelehnt), je Routine gilt eine Sperre von `ROUTINE_COOLDOWN` Sekunden. Jede dieser Bedingungen hat einen Test in `tests/test_routines.py`
  und eine Zeile in `scripts/mutation_check.py`. Neue Bedingungsarten oder Geräte-Domänen (`LEAF_STATES`) ergänzen die parametrisierten
  Prüfungen `test_save_routines_rejects_invalid` und die Suite `routines-e2e.mjs`.
- Überwachung (seit 1.48.0, `monitor.py`; Entscheid des Nutzers, 2026-11-16): Regeln für Messwerte und Ja/Nein-Sensoren, **unabhängig vom Alarm, nie Sirene oder Alarm**; Standard **aus** (Anlage › Modi, `monitor_enabled`). Ein Sensor, der nichts liefert (nicht verfügbar, unbekannt, keine Zahl), zählt nie: er löst nichts aus, beendet nichts und setzt eine laufende Dauer zurück (ein Funkabriss meldet nie "wieder in Ordnung"). Eine laufende Regel meldet sich nach Neuladen und Neustart nicht erneut (`hass.data[DATA_MONITOR]`, Store). Schritte nur Push, Gerät schalten, Warten; jeder Aufruf höchstens `SERVICE_TIMEOUT`, ein Fehler bricht nie die übrigen ab, jede Regel läuft in eigener Aufgabe. Der Test-Knopf an einem Schritt (seit 1.57.0, WS `test_monitor_step`, `async_test_step`) führt nur diesen Schritt einmal aus: nur Administratoren, Meldung mit Testtitel, Gerät höchstens `SERVICE_TIMEOUT`, "Warten" nicht testbar, nie Alarm oder Sirene. Messwert-Sensoren (`monitor_sensors`) sind eine eigene Liste, nie in Zonen oder `all_sensors()`, in der Tabelle ausgegraut und nur bei eingeschalteter Überwachung sichtbar. Jede dieser Bedingungen hat einen Test in `tests/test_monitor.py` und eine Zeile in `scripts/mutation_check.py`; neue Bedingungsarten oder Schritte ergänzen `BAD_RULES` und `tests/panel/suites/monitor-e2e.mjs`.
- Scharfschalten per Push-Knopf (seit 1.18.0, Meldung "Scharfschalten nicht möglich": "Erneut versuchen", "Trotzdem scharf
  schalten") ist standardmässig an (Entscheid des Nutzers, 2026-11-12). Die Knöpfe wirken nur bei deaktivierter Anlage, eine
  Stunde lang (`ARM_BUTTONS_VALID`), nur vom Handy eines Empfängers dieser Meldung, für den Modus des gescheiterten Versuchs
  (nie aus dem Ereignis des Handys) und ohne Code. Jede dieser Bedingungen hat einen Test in `tests/test_arm_buttons.py`
  und eine Zeile in `scripts/mutation_check.py`.
- Eigene Töne (seit 1.39.0, `custom_sounds.py`): Hochladen nur für Administratoren; das Format kommt aus den ersten Bytes (`sniff`), nie aus
  der Endung; Nicht-WAV nur über PyAV (`av`) oder das Programm ffmpeg, beide in einem eigenen Prozess (nie im Prozess von Home Assistant: eine kaputte Datei darf nur den Wandler abstürzen lassen) mit fest vorgegebenem Format, Zeitgrenze und Länge `MAX_CUSTOM_SECONDS`; Grenzen für Anzahl, Grösse,
  Länge, Abtastrate stehen in `const.py`. Fehlt die Datei eines eigenen Tons, spielt der Schritt den Standardton seiner Art (`workflow._sound`):
  ein Alarm darf nie stumm bleiben. Der Wächter rechnet für eigene Töne mit `MAX_CUSTOM_SECONDS`. Tests in `tests/test_custom_sounds.py`,
  Zeilen in `scripts/mutation_check.py`; Sicherungen tragen die Töne und prüfen sie beim Zurückholen (`valid_backup_sounds`).
- Empfang (seit 1.41.0, `reception.py`): Der Nutzer sieht nur Wert und Verlauf, nie Empfänger, Proxy oder Technik (Vorgabe des Nutzers, 2026-11-15). Bei Bluetooth
  zählt der stärkste Empfänger, der bisherige bleibt bis `BLE_KEEP_DB` dB Unterschied (kein Hin und Her); ungültige Werte (0 dBm) und veraltete Empfänger
  zählen nie. Interne Schnittstellen von HA und ZHA sind mit `try` gelesen: fehlt etwas, bleibt der Wert leer, nie ein Fehler in der Liste. Ausgefallene
  Geräte werden nicht aufgezeichnet. Thread (seit 1.42.0): stärkster Nachbar der Matter-Nachbartabelle, nicht erreichbares Gerät ohne Wert. Tests in `tests/test_reception.py`, Zeilen in `scripts/mutation_check.py`.
- Aktions-Gruppe (seit 1.59.0, Schritt `group`; Entscheide des Nutzers, 2026-11-17): wiederholt ihre Schritte eine Anzahl Durchläufe, für eine Dauer oder
  bis deaktiviert wird (`mode`: `count`, `duration`, `until_disarmed`). In allen Listen der Aktionen (nicht in der Überwachung), mit den Schritten, die dort
  erlaubt sind (`schemas._valid_group` prüft die Schritte mit der Prüfung ihrer Liste); "bis deaktiviert" nur im Ablauf des Alarms; nie eine Gruppe in der
  Gruppe, nie "Quittieren" darin; `undo_after` in einer Gruppe (seit 1.60.0, Entscheid des Nutzers): je Gerät nur ein vorgemerkter Gegendienst, jede Runde
  ersetzt den der vorigen (`workflow._plan_undo`, `_IN_GROUP`), nie eine Liste, die mit den Runden wächst; höchstens `GROUP_MAX_STEPS` Schritte, sie zählen zu `MAX_STEPS` (`schemas.step_list`). "wait" wie bei den
  anderen Schritten (Standard: läuft nebenher); "bis deaktiviert" wartet nie (`workflow.step_waits`). Jeder Schritt der Gruppe steht unter denselben Grenzen
  wie im Ablauf (`workflow._group`: `_watched` je abgewartetem Schritt, ein Fehler bricht nie die übrigen ab); jede Runde dauert mindestens `GROUP_MIN_ROUND`
  Sekunden (nie eine Schleife ohne Pause). Die Dauer bestimmt der Nutzer und zählt ab dem ersten Start, auch über Neuladen und Neustart; eine Runde beginnt
  nur, wenn sie noch ganz in die Zeit passt (nie länger als eingestellt, nie Ende mitten in der Runde). Nach einem Neustart mitten im Alarm läuft "bis
  deaktiviert" wieder an (`run["endless"]`, `_resume_endless`), nie doppelt; eine abgewartete Gruppe mit Anzahl macht mit den restlichen Runden weiter
  (`run["group"]`). Wer Schritte einer Liste durchsucht (Meldung vorhanden, Empfänger, Lautsprecher, Geräte zum Zurückstellen), nimmt die Schritte der
  Gruppen mit (`workflow.flat_steps`, `notify._with_groups`, `step_entities`). Panel: Variante B, Rahmen in der Farbe der Liste (`--z`), die Liste in einer
  Gruppe ist eine Liste wie die anderen (`data-zone="<Liste>:<Stelle>"`, `actions.js baseZone/groupIndex`); wandert eine Gruppe in einen anderen Bereich,
  fallen ungültige Aktionen erst nach einer Rückfrage weg (`_moveAcross`). Tests in `tests/test_group.py` und `tests/test_action_hang.py`, Suite
  `group-e2e.mjs`, Zeilen "Aktions-Gruppe" in `scripts/mutation_check.py`. Jede neue Schrittart ergänzt `GROUP_EXCLUDED` oder ist in Gruppen erlaubt (Test).
- Feste Meldungen im Reiter Aktionen (seit 1.62.0, Wunsch und Entscheide des Nutzers vom 2026-11-17): "Scharf geschaltet", "Deaktiviert",
  "Eingangsverzögerung" und "Stiller Alarm" gehören zum Ablauf einer Anlage, je Auslöser (`CONF_EVENT_NOTIFY[auslöser][art]`, `EVENT_NOTICE_SCHEMA`,
  `valid_event_notify`; für "Immer aktiv" nur "Stiller Alarm", `EVENT_NOTIFY_ALWAYS`). Sie sind feste Elemente wie "Alarm endet": immer da, ein/aus,
  eigener Text (leer = Standardtext; bleibt vom eigenen Text nichts übrig, gilt ebenfalls der Standardtext), Empfänger (leer = Standard-Empfänger),
  kritisch, Lautstärke, "stehen lassen", Klickziel, Testmeldung (`alarmageddon/test_event_notify`). **Das Update ändert nichts:** hat eine Anlage für
  einen Auslöser nichts Eigenes gespeichert, gilt die frühere gemeinsame Einstellung der Art samt den Werten je Modus (`notify.event_notice`; für
  "Immer aktiv" der Wert des Modus, in dem die Anlage scharf ist, wie bis 1.61.0). Es gibt keine Migration: `settings.notify["types"]` behält die vier
  Arten, der Reiter Benachrichtigungen zeigt sie nicht mehr und lässt ihre Werte unberührt. Das Panel sendet beim Speichern nur geänderte Meldungen
  (`actions.js save`); der Server ersetzt je Auslöser und Art und behält den Rest. "Deaktiviert" nimmt die Werte des Modus, der scharf war
  (`Notifier._mode_seen`); nach einem Alarm geht nur die Abschlussmeldung hinaus. Tests in `tests/test_event_notify.py`, Suite `notices-e2e.mjs`,
  Zeilen "Feste Meldung" in `scripts/mutation_check.py`. Eine neue feste Meldung ergänzt `EVENT_NOTIFY_KINDS`, `NOTICE_KINDS` und `NOTICE_TOKENS`
  (`tests/test_alarm_kinds.py` vergleicht Panel und Server). Seit 1.63.0 (Entscheid des Nutzers vom 2026-11-17) gehört die Abschlussmeldung unter "Alarm
  endet" dazu, gleich aufgebaut (Schalter, Play, Stift): `workflow_end[auslöser].send: false` schaltet sie aus (dann geht nach einem Alarm nichts
  hinaus, die Alarmmeldung bleibt auf dem Handy); fehlt `send`, geht sie wie bisher hinaus. `notify.enabled` heisst dort weiterhin nur "eigene Werte
  statt Standard" und wird nie als "aus" gelesen (ältere Werte, Schema-Standard `False`). Tests `test_event_notify.py -k closing`, Zeilen
  "Abschlussmeldung" in `scripts/mutation_check.py`.
- Aktionen bei einem stillen Alarm (seit 1.62.0, Liste `workflows_report` je Auslöser, Kapitel "Bei einem stillen Alarm" vor dem Alarm): Der Automat
  meldet `sensor_report` mit `scope` (der Modus oder "always", `controller._report`); Meldung und Aktionen nehmen die Werte dieses Auslösers. Die
  Aktionen sind ein Lauf neben dem Alarm (`phase: "report"`, in `SIDE_PHASES`) mit den Schritten des Scharfschaltens (`valid_report_step`): **nie ein
  Alarm, nie eine Sirene, nie "bis deaktiviert"**. Vorrang haben Alarm, Test und eine laufende Verzögerung (dann startet er nicht,
  `workflow.async_run_report`, `_report_possible`); er ersetzt Aktivierungston, Aktionen nach dem Quittieren und einen früheren stillen Alarm; Alarm und
  Deaktivieren beenden ihn sofort. Kein Gerät und kein Fehler darin hält Alarm oder Deaktivieren auf. Tests in `tests/test_event_notify.py` und
  `tests/test_action_hang.py` (hängt, scheitert), Zeilen "Aktionen bei einem stillen Alarm" in `scripts/mutation_check.py`.
- Vorschau einer Routine (seit 1.62.0, Wunsch des Nutzers): das Auge je Zeile im Fenster "Routinen" zeigt `flowHtml` der gespeicherten oder
  ungespeicherten Routine nur zum Lesen, im selben Fenster anstelle der Liste (`routines.js viewing`, `_viewHtml`); "Schliessen" führt zur Liste
  zurück (Suche und Rollstand bleiben), "Bearbeiten" öffnet den Editor, das X schliesst das Fenster. Die Vorschau hat nie Felder oder Schalter.
- Zeichen der Wiederholung in einer Gruppe (seit 1.62.0): `.ag-wf-loop` ist reine Zierde (`aria-hidden`, `pointer-events: none`), nur bei Gruppen
  mit Schritten; es darf nie Klicks oder das Ziehen stören (Suite `notices-e2e.mjs`, `group-e2e.mjs`).
- Verträglichkeit mit neueren Versionen von Home Assistant (seit 1.60.0; Aufzeichnung des Nutzers vom 2026-11-17 auf 2026.11.1): Die Tests liefen bis
  1.59.0 nur gegen 2026.2.3, drei Mängel blieben deshalb unbemerkt. **Geräte-Registry:** ein Gerät gehört dort zu einem Konfigurationseintrag
  (`config_entry_id`), es gibt untergeordnete Geräte ohne Hardware-Angaben; die alten Zugriffe (`DeviceEntry.config_entries`, `primary_config_entry`,
  `registry.devices` als Wörterbuch, `async_get_device`, Hardware-Felder am untergeordneten Gerät) sind veraltete Brücken, die bei **jedem** Zugriff den
  Aufrufer in allen geladenen Modulen suchen (`frame.report_usage`, mehrere Millisekunden im Event-Loop). `reception._domains` las `config_entries` je
  Sensor zweimal: bei 151 Sensoren stand ganz Home Assistant bei jedem Abruf der Übersicht rund 1,4 Sekunden still, bei offenem Panel alle 30 Sekunden.
  Darum: Geräte nur über `devices.entry_ids`, `main_device`, `device_field`, `system_device` lesen, freie Entitäts-IDs über `devices.free_entity_id`; nie
  die alten Zugriffe direkt. Was je Gerät gleich ist (Empfang, Hardware), je Abruf einmal je Gerät lesen, nicht je Sensor. `tests/conftest.py` lässt
  jeden Test scheitern, bei dem Home Assistant eine veraltete Nutzung durch die Integration meldet (wirkt in der aktuellen Testumgebung);
  `tests/test_ha_compat.py` baut die neuen Geräte nach und läuft in beiden. **Prüf-Bibliothek:** neuere Versionen ersetzen voluptuous durch probatio;
  in einem Schema mit `REMOVE_EXTRA` (Sicherungen) verwirft sie auch in den Wörterbüchern darunter unbekannte Schlüssel, statt abzulehnen: dort nie
  `{vol.In(...): ...}`, immer `schemas.strict_map` (Test `-k lenient_nested_maps`). **Zwei Testumgebungen:** `requirements_test.txt` (2026.2.3, Python
  3.13) und `requirements_test_current.txt` (2026.10.4, Python 3.14); beide müssen bestehen (`.github/workflows/tests.yml`, Matrix). Beim Anheben der
  aktuellen Umgebung die Liste der veralteten Schnittstellen in `homeassistant/helpers/device_registry.py` und `entity_registry.py` ansehen
  (`report_usage`).
- Geschwindigkeit der Übersicht (seit 1.60.0, Meldung des Nutzers): `alarmageddon/data` nennt nur die Sensoren der Anlagen (`_sensor_info(..., candidates=False)`); die
  Kandidaten des ganzen Hauses kommen nur auf Abruf (`alarmageddon/sensor_candidates`, Panel `_loadCandidates`, Fenster "Sensoren hinzufügen"). Nie wieder alles,
  was das Haus hat, in eine Antwort legen, die bei jedem Öffnen und alle 30 Sekunden läuft; `ws_data` läuft ohne Unterbrechung im Event-Loop, jede Millisekunde
  darin hält ganz Home Assistant an. Das Panel bekommt `hass` viermal je Sekunde (`panel.html`): in `set hass` nur billige Arbeit, und neu gezeichnet wird nur
  für Sensoren, die zu sehen sind (`_shownSensors`), Zustände sofort, Messwerte, Batterie und Empfang gesammelt höchstens alle `SOFT_MS` (`_stateSigs`: zwei
  Signaturen). Wer eine Ansicht um laufend wechselnde Werte erweitert, legt sie in die zweite Signatur. Suite `perf-e2e.mjs` (grosses Haus im Nachbau:
  `?house=`, `?housechosen=`, `?churn=`), Tests `test_websocket.py::test_data`, `test_review_1_58.py -k data_lists`, `test_ha_compat.py -k once_per_device`.
- Suche in den Fenstern mit Listen (seit 1.60.0, Wunsch des Nutzers): Routinen, Eigene Töne, Sicherungen haben ein Suchfeld über der Liste
  (`common.js searchField`, `matchQuery`: jedes Wort muss vorkommen), die Sicherungen dazu den Filter "Nur automatische". Gesucht wird in allem, was die
  Zeile zeigt, bei Routinen auch in den Entitäts-IDs. Beim Tippen wird nur der Behälter der Zeilen neu gezeichnet (`.ag-rtrows`, `.ag-csrows`,
  `.ag-bkbody`): das Feld behält den Fokus, ein offenes Formular seinen Inhalt. Gefilterte Zeilen behalten ihre Stelle im Entwurf (`data-index`).
  Suite `popsearch-e2e.mjs`. Ein neues Fenster mit einer Liste bekommt dasselbe Suchfeld. Seit 1.63.0 (Wunsch des Nutzers) stehen Titel und Suchfeld in
  einem klebenden Kopf (`.ag-pop-head`, gleicher Hintergrund wie das Fenster, Abstand zur Liste immer der untere Rand des Kopfs); Suite `popsticky-e2e.mjs`.
- Codes pro Person (seit 1.63.0, Wunsch des Nutzers): Liste im Fenster `#ag-codelist` (Tabelle Name, Benutzer, Stift, Papierkorb in Kreisen;
  seit 1.66.1 ohne Spalte "Code", die nur einen Platzhalter zeigte; Suche; "Code hinzufügen" in der Fusszeile). Ein gespeicherter Code wird nie angezeigt (es gibt ihn nur als Hash); das Auge in den
  Codefeldern zeigt nur den gerade getippten Code. Bearbeiten über `update_code`: leeres Codefeld = bisheriger Hash bleibt. Warnung bei einfachen Codes
  (`system.js codeWeakness`) nur als Hinweis, Speichern bleibt möglich; die Regel 4 bis 8 Ziffern prüft der Server. Suite `codes-e2e.mjs`.
  Hinzufügen, Bearbeiten und Entfernen laufen je Anlage unter `websocket_api._codes_lock` (zwischen Prüfen und Schreiben liegt das Hashen im
  Executor; ohne Sperre legte ein Doppelklick denselben Code zweimal an, `tests/test_codes.py -k "double_click or same_time"`). Knöpfe, die
  etwas an den Server schicken, nehmen bis zur Antwort keinen zweiten Druck an (`system.js _sendOnce`, Suite `codereview-e2e.mjs`).
- Sensoransicht (seit 1.60.0): ein Messwert hat Werteverlauf, Batterie und Empfang, ein Binärsensor Verlauf, Batterie und Empfang
  (`ws_sensor_history`; bis 1.59.0 waren Batterie und Empfang für Messwerte abgelehnt). Test `test_measure_history.py -k battery_and_signal`.
  **"Seit" der Kachel "Verlauf" (seit 1.66.2, Wunsch des Nutzers 2026-11-19):** nie `last_changed` von Home Assistant (springt bei jedem
  Neustart und jeder Neuverbindung), sondern `since` aus der Antwort (`last_change.state_since`: letzte echte Änderung zu <-> offen, "nicht
  verfügbar" und "unbekannt" übersprungen; nicht erreichbar: Beginn der Unterbrechung; ohne Wechsel im Verlauf die gemerkte `last_changes`;
  der jetzige Zustand von HA kommt dazu, wenn der Recorder nachhinkt). Unbekannt: nur der Zustand, keine Zeit (`sensorview.js _since`).
  Gilt für jede neue Zeitangabe "seit" eines Sensors. Tests `test_sensor_since.py`, `test_sensor_history_recorder.py -k since`, Suite `sensor-e2e.mjs`.
- Sensoransicht der Überwachung (seit 1.65.0, Entscheide des Nutzers vom 2026-11-18): jeder Messwert und jeder Sensor, der in einer Regel
  der Überwachung vorkommt, hat über der Liste die Reiter "Ereignisse" und "Regeln", je mit Suche (`matchQuery`) und Sortierung nach jeder
  Spalte; die Leiste scrollt mit, der Tabellenkopf bleibt stehen; beim Tippen nur die Zeilen neu (`sensorview.js _renderRows`). Der Pfeil führt
  zur Regel (`openMonitorRule`: andere Anlage nur über `_guard`, Suche der Liste leer, aufgeklappt, unter den festen Leisten, `ag-flash`).
  **Jede Grenze ist in der Grafik zu sehen** (`_valueLine`), nie eine still weggelassene. Andere Sensoren bleiben ohne Reiter. Suite
  `svrules-e2e.mjs`. **Zahl der Ereignisse (seit 1.66.1, Vorgabe des Nutzers 2026-11-19):** die Zahl auf dem Reiter "Ereignisse" ist nie
  ein Total, sondern immer die Zahl des oben gewählten Zeitraums, gleich wie die Liste; der Server liefert `events_total` (Zustand und
  Messwert), die Liste höchstens `EVENTS_MAX` (300) neueste mit Hinweis `svListTruncated` ("neueste N von M"). **Benennung (Entscheid des Nutzers, 19:47):** die Einträge der Überwachung heissen überall "Regeln" (Sensoransicht,
  Konfiguration › Aktionen › Überwachung, Einstellungen), nie "Aktionen" oder "Überwachungsaktionen".
- Selbsttest (seit 1.65.0, `selftest.py`, Entscheide des Nutzers vom 2026-11-18): prüft nach dem Start (`SELFTEST_START_DELAY`), kurz nach jedem
  Speichern (Neuladen einer Anlage, `save_notify`), alle `selftest_minutes` Minuten, solange eine Anlage nicht deaktiviert ist alle `selftest_minutes_armed`
  Minuten (Standard 360 und 60, je `SELFTEST_MINUTES_RANGE` 5 bis 1440; zweiter Abstand seit 1.66.0, Minuten seit 1.67.0, Wünsche des Nutzers
  2026-11-19; bis 1.66.x `selftest_hours*` in Stunden, beim Laden, in Backups und von einem alten Panel übernommen: `SELFTEST_HOURS_KEYS`,
  `settings.valid_notify`, `ws_save_notify`; Takt `SELFTEST_TICK` 60 s; `selftest.any_armed`; im Panel je Zahl und Einheit untereinander,
  `system.js stField`, `stMinutes`), eingestellt im Kapitel
  HealthCheck unter Konfiguration › Anlage, **immer sichtbar**, auch wenn die Meldung aus ist; der Entwurf der Benachrichtigungen sendet die Werte nie mit) und mit
  "Jetzt prüfen". **Er liest nur**: nie einen Dienst aufrufen, nie einen Ton, nie eine
  Probemeldung (Test `-k reads_only`). Befunde der Konfiguration (Geräte, Lautsprecher, Aktionen, Empfänger, Töne, Adresse, Sensoren, Routinen,
  Regeln) verschwinden, sobald behoben; Befunde der Laufzeit (`async_note`: Aufruf gescheitert oder ohne Antwort, Wächter, Meldung, Start eines
  Teils, automatisches Backup) verschwinden, wenn **derselbe Aufruf** wieder klappt (`async_resolve`, im Alarm oder im Test) oder mit "Erledigt"
  (nur Laufzeit, der Server lehnt anderes ab). Ein Gerät eines Ablaufs zählt schon, wenn es seit `SELFTEST_GRACE` nicht erreichbar ist; Sensoren
  des Alarms und der Überwachung nur, wenn sie fehlen (die Wartung meldet "nicht erreichbar"). Abläufe ausgeschalteter Modi werden nicht geprüft.
  `async_note` und `async_resolve` sind synchron und fangen alles ab; die Aufrufe im Ablauf (`workflow._selftest`, `monitor._selftest`) stehen
  zusätzlich im `try`: **der Selbsttest hält nie einen Schritt, einen Alarm oder ein "Rückgängig" auf** (Tests `test_action_hang.py -k selftest`).
  Ein Befund trägt nur Kennungen und Namen, nie die Daten eines Aufrufs (Test `-k never_contain_secrets`, `test_codes_and_hashes_never_leave_the_server`).
  Ausgabe: Statuskachel (Zeile immer, Befunde zählen mit), Fenster `#ag-selftest` (`panel/selftest.js`, Hilfe je Befund: Was ist los, Wo mit
  "Öffnen", Was das bedeutet, Ursachen, So behebst du es), Liste "Geprüft" (`#ag-stchecked`, WS `selftest_checked` auf Abruf, nie in `data`;
  `_Collector.seen` hält je Prüfung fest, was angeschaut wurde, grün nur ohne Befund dazu), Entität `binary_sensor.<anlage>_self_test` (Problem, Diagnose, Liste nicht aufgezeichnet),
  Statusentität und Infokarte zählen mit, Reparaturen von HA (je Anlage und `selftest_global`), Meldungsart `selftest` (je Befund einmal, erneut
  erst nach dem Beheben). Ein neuer Befund ergänzt `CONFIG_CODES` oder `RUNTIME_CODES`, die Texte `st_*` in `notify.py` (EN/DE), `stT_`, `stW_`,
  `stI_`, `stC_`, `stF_` in `strings.js` (die Suite `selftest-e2e.mjs` prüft alle) und einen Test in `tests/test_selftest.py`.
- HealthCheck (seit 1.65.0, `healthcheck.py`, `panel/healthcheck.js`; Wunsch und Entscheide des Nutzers vom 2026-11-18): Lebenszeichen an externe Dienste,
  für alle Anlagen, höchstens `MAX_HEALTHCHECKS`, je mit Namen (seit 1.66.0 Pflichtfeld, `valid_healthcheck_name`; Einträge ohne Namen aus
  1.65.0 heissen wie ihr Rechner) und **einem** Intervall in `HEALTHCHECK_INTERVAL_RANGE`. Kein eigenes Intervall bei scharfer Anlage
  (Entscheid des Nutzers 2026-11-19: das hat nur der Selbsttest, und sein Wechsel auf "Probleme" geht ohnehin sofort hinaus). Ein Takt alle
  `HEALTHCHECK_TICK` Sekunden sendet, was fällig ist (nie zwei fast gleichzeitig). **Generisch** (Entscheid des Nutzers): URL + Fehler-Zusatz,
  keine Auswahl des Anbieters; bekannte Dienste werden nur vorgeschlagen, **der Nutzer hat immer das letzte Wort** (ein Vorschlag füllt nur ein
  unberührtes Feld, sonst "Übernehmen"). Solange der Selbsttest Probleme hat, geht die Fehler-URL hinaus; ein gescheitertes Lebenszeichen
  (`ping_failed`) zählt dafür nie (`failing()`). **Ausnahme vom Geheimnis-Grundsatz (Entscheid des Nutzers, "Ganz zeigen, im Backup"):** die Ping-URL
  steht im Panel (in der Liste gekürzt mit Tooltip, im Formular ganz) und ganz im Backup; im Log, in Meldungen und in Befunden steht nur der Rechnername (`host_of`), auch die Meldung einer Ausnahme der
  Verbindung kommt nie ins Log (sie enthält oft die URL). Ein Lebenszeichen ist eine Hintergrundaufgabe mit `HEALTHCHECK_TIMEOUT`, hält nie etwas
  auf; ein Wechsel des Selbsttests geht höchstens alle `HEALTHCHECK_MIN_GAP` Sekunden hinaus. Tests in `tests/test_healthcheck.py`, Zeilen
  "HealthCheck" in `scripts/mutation_check.py`, Suite `healthcheck-e2e.mjs`. Nie die echte Ping-URL eines Nutzers (Bildschirmfoto) in Code, Tests
  oder Bildern verwenden; der Nachbau hat erfundene Adressen (`?hc=sample`). Das Fenster der Dienste erklärt sie unter der Liste zum Aufklappen
  ("Was sind HealthCheck-Dienste?", seit 1.67.0, Wunsch des Nutzers; Name bleibt "HealthCheck-Dienste", Entscheid des Nutzers 2026-11-19) mit den
  Beispielen `EXAMPLES` in `healthcheck.js` (Links in neuem Fenster, dieselben Anbieter wie `KNOWN`). Statusentität und Statuskarte (seit 1.72.0,
  Wunsch des Nutzers 2026-11-20): `HealthCheck.summary` gibt nur Zahlen (`healthcheck`, `_ok`, `_report`, `_fail` als Attribute), **nie URL, Name
  oder Rechner** (Attribute stehen in jedem Dashboard und in der Aufzeichnung; Test `test_healthcheck.py -k status_entity`); `SIGNAL_HEALTHCHECK` nach
  jedem Lebenszeichen und jeder Änderung der Liste (`_changed`, im `try`).
- Alarm-Aufruf der HealthCheck-Dienste (seit 1.73.0, Wunsch des Nutzers 2026-11-20): Ein Dienst kann neben `fail_suffix` einen `alarm_suffix` haben
  (freiwillig, `alarm_url`). Löst eine Anlage aus (`selftest.any_alarm`, nie ein Fehler), ruft `HealthCheck._tick` jeden Dienst mit Alarm-Zusatz
  sofort damit auf (`by: "alarm"`, **nie** `respect_gap`; erkannt im Takt, höchstens `HEALTHCHECK_TICK` Sekunden, kein Zuhörer am Automaten); das Ende
  des Alarms sendet das Lebenszeichen (mit Mindestabstand). **Der Alarm hat Vorrang vor dem Fehler des Selbsttests** (`status["sent"]`: `alarm`/`fail`/`ok`,
  Probleme zählen nur bei `fail`); Dienste ohne Alarm-Zusatz bleiben unberührt. Wie jedes Lebenszeichen eine Hintergrundaufgabe mit `HEALTHCHECK_TIMEOUT`:
  **nie etwas, das einen Alarm aufhält** (Test `test_healthcheck.py -k hanging_service`). Der Testknopf "Alarm senden" (`healthcheck_ping` kind `alarm`)
  gibt es nur mit Alarm-Zusatz. Protokoll: Art `report`, Ereignisse tragen `sent: "alarm"` und laufen nie mit Fehlern des Selbsttests zusammen. Das Panel
  schlägt den Alarm-Zusatz nur vor ("Übernehmen"), füllt ihn nie von selbst; Nachrichten der Vorschläge bleiben Englisch (Vorgabe des Nutzers). Tests
  `tests/test_healthcheck.py -k alarm`, `tests/test_healthcheck_log.py -k alarm_call`, Suite `hcalarm-e2e.mjs`, Zeilen "HealthCheck Alarm" in `scripts/mutation_check.py`.
  Das Protokoll hat statt 90 Tagen 6 Monate (`HEALTHLOG_RANGES`: 3, 12, 24, 168, 720, 4320, 8760 Stunden).
- Zauberstab des Einrichtungsassistenten (seit 1.73.0, Wunsch des Nutzers): wiederholt sich alle `WAVE_PAUSE_MS` (30 s) nach dem Ende (`WAVE_LEN_MS`) und endet
  mit der Sternschnuppe wie im Device Panel (`ag-wz-comet`, `ag-wz-land`), auch bei "Bewegung reduzieren"; der Zeitgeber stoppt, wenn der Knopf weg ist.
- Ecken der Tabellen (seit 1.73.0): die klebende Kopfzeile einer Tabelle in einer Karte mit rundem Rand trägt dort denselben inneren Radius (17 px); auf dem
  Handy ist die Zeile selbst gerundet und ihre `th` transparent. Jede neue Tabelle in einer Karte kommt in `tests/panel/suites/corners-e2e.mjs`.
- Protokoll der HealthCheck-Dienste (seit 1.68.0, `healthcheck_log.py`, `panel/healthlog.js`; Wunsch und Entscheide des Nutzers vom 2026-11-19,
  17:06 bis 17:48, Mockups `healthcheck-protokoll-v1`/`-v2`): je Aufruf Zeit, Art (`ok`, `report`, `fail`, `test`), Ergebnis, HTTP-Status,
  Antwortzeit und Auslöser; **nie die URL und nie der Text einer Ausnahme** (Test in `test_security.py`). Aufbewahrt: einzelne Aufrufe
  `HEALTHLOG_CALL_HOURS`, Stundenwerte `HEALTHLOG_HOUR_DAYS`, Tageswerte `HEALTHLOG_DAY_DAYS` (Ortszeit von HA, mit Sekunden ohne Daten, gezählt in
  `record` über `last` und `interval`), Ereignisse `HEALTHLOG_EVENT_DAYS` und höchstens `HEALTHLOG_EVENT_MAX` je Dienst (Entscheide "ältere nur
  zusammengefasst", "passt", 18:35 "einverstanden" für 90 Tage und 1 Jahr); eigene Ablage `HEALTHLOG_STORE_KEY`, geschrieben spätestens
  `HEALTHLOG_SAVE_DELAY` nach dem ersten ungeschriebenen Aufruf (eigener Zeitgeber, **nie** `Store.async_delay_save` mit fester Verzögerung: das
  verschiebt bei jedem Aufruf und schriebe erst beim Beenden) und bei `EVENT_HOMEASSISTANT_FINAL_WRITE`; Laufzeit, nicht im Backup; ein entfernter Dienst nimmt sein Protokoll mit. **Das Protokoll hält nie ein Lebenszeichen auf**
  (`healthcheck._send`: `record` im `try`, nach dem Setzen des Zustands). Abruf nur auf Anfrage (`alarmageddon/healthcheck_history`, nur
  Administratoren, Zeiträume `HEALTHLOG_RANGES` bis 1 Jahr), nie in `data` (dort nur `log` = Zustand und seit wann je Dienst). **Zahl und Liste
  folgen genau dem gewählten Zeitraum** (Vorgabe des Nutzers, auch für die einzelnen Aufrufe): `events_total`, `calls_total`, höchstens 300 Zeilen
  mit Hinweis; ab 90 Tagen ganze Tage (Beginn Mitternacht des ersten Tages).
  Ansicht mit den Bausteinen der Sensoransicht (`HealthLogView extends SensorView`, Fenster `#ag-hclog`, Weiche in `_onClick`/`_onInput` vor der
  Sensoransicht; im Kopf seit 1.69.0 die runden Knöpfe der Liste "Fehler senden", "Lebenszeichen senden", Stift, `healthlog.js _actsHtml`, Wunsch
  des Nutzers 21:50); Grafik bis 1 Tag Herzschlag mit Band, 7 Tage Zeitleiste, 30 Tage Raster (Entscheid "Vorschlag 1"), 90 Tage und 1 Jahr Raster
  Monat × Tag (Mockup v3 "B", Lücke ab `HEALTHLOG_GAP_DAY_MINUTES`); Antwortzeit mit Zonen 300 ms und 1 s. Statuskachel: sind Dienste eingerichtet,
  ist die Zeile des Selbsttests geteilt (`selftest.js tileHalf`, `healthcheck.js tileHalf`, gleich hoch), ohne Dienste wie bisher und ohne Einladung.
- Meldungen der HealthCheck-Dienste (seit 1.68.0, Wunsch des Nutzers vom 2026-11-19, 18:42/18:43; seit 1.69.0, Wunsch 22:16/22:17, eine
  Wartungsmeldung wie "Selbsttest"): Art `healthcheck` in `NOTIFY_TYPES` (Gruppe `maintenance`, Standard an, nicht kritisch) mit `notify.healthcheck_fails`
  (`HEALTHCHECK_NOTIFY_FAILS_RANGE`, Standard 2) und `notify.healthcheck_up` (Standard an). Feste Texte `hc_down_*`, `hc_up_*` in `notify.TEXTS`,
  **nie die URL**, Klickziel `?view=healthcheck`. `healthcheck._notify` nach jedem Aufruf **ohne** Testknopf: "antwortet nicht" einmal je Ausfall nach
  `healthcheck_fails` gescheiterten hintereinander und nur, wenn die Meldung an ist; "antwortet wieder" nur nach einem "antwortet nicht" und nur mit
  `healthcheck_up`, nie kritisch; `_fails`, `_fail_since`, `_down` in der Ablage (ein Neustart meldet nicht noch einmal); im `try` (hält nie ein
  Lebenszeichen auf). Gesendet über `notify.async_send_healthcheck` (Empfänger leer = Wartung). Die Form aus 1.68.0 (`notify["healthcheck"]` mit `fails`,
  `hc_down`, `hc_up`) übernimmt `settings._healthcheck_1_68` beim Laden, aus Backups und von einem alten Panel; `save_notify` lehnt sie ab. Der Selbsttest
  meldet `ping_failed` nicht (`selftest._report`), der Befund bleibt. Testmeldung über `test_notify` (Art `healthcheck`). Tests
  `tests/test_healthcheck_notify.py`, Suiten `hcnotify-e2e.mjs`, `play-e2e.mjs`, Zeilen "Meldung HealthCheck" in `scripts/mutation_check.py`. Tests
  `tests/test_healthcheck_log.py`, Suite `hclog-e2e.mjs`, Zeilen "Protokoll HealthCheck" in `scripts/mutation_check.py`. Der Nachbau rechnet wie der
  Server (`__hcLogHistory`, `?hclog=empty`).
- Konfiguration › Benachrichtigungen (seit 1.69.0, Wünsche des Nutzers vom 2026-11-19, 22:20 und 22:27; Entscheid 23:01 "C", Mockups `meldungen-v1`):
  jede Meldung der Kapitel "Störungsmeldungen" und "Wartungsmeldungen" ist eine Karte (`notify.js _card`, `.ag-ntk`, Farbe des Kapitels: Störung rot,
  Wartung orange) mit Schalter, Kurzfassung, Play und Stift; der Stift öffnet das Fenster `#ag-ntkind` (`renderKind`). **Gespeichert wird nur auf der
  Seite** (Vorgabe des Nutzers): das Fenster ändert den Entwurf (`NotifyUi.draft`), "Übernehmen" schliesst, "Abbrechen", X und Escape stellen nach der
  Rückfrage (`_dlgDirty` → `kindDirty`) den Stand beim Öffnen wieder her (`openKind` merkt Entwurf und leere Empfängerlisten). Eine geänderte Meldung
  trägt "Noch nicht gespeichert" mit dem orangen Punkt (`kindChanged`); eine ungültige Zahl hält "Übernehmen" auf (`ntkRange`). Zahlen einheitlich im
  Raster `.ag-ntk-nums` (Beschriftung links, Felder in einer Flucht, Hinweis darunter). Eine neue Meldungsart ergänzt `GROUPS`, bei Zahlen `NUMBERS` und
  `RANGES`, die Kurzfassung (`_summary`, Texte `ntkAfter_*`), und die Suiten `ntcards-e2e.mjs`, `switches-e2e.mjs`.
- Batterie schwach (Wartung, `maintenance.py`; seit 1.68.0, Wunsch des Nutzers vom 2026-11-19, 19:38, nach einer Meldung "Batterie 1 %" bei 61 %):
  die Meldung geht erst hinaus, wenn die Batterie bei `battery_checks` Prüfungen hintereinander (`BATTERY_CHECKS_RANGE`, Standard 3, Prüfung alle
  `MAINTENANCE_INTERVAL`) unter der Schwelle liegt; ein Wert über der Schwelle beginnt neu, ein Batteriesensor ohne Wert zählt nicht und beginnt
  nicht neu. Die Zählung (`Maintenance._low`) lebt nur im Speicher: ein Neustart verzögert höchstens. Statusentität und Übersicht zeigen den
  aktuellen Wert sofort. Tests `tests/test_maintenance.py` (ältere Tests mit `_setup(checks=1)`), Suite `hardening-e2e.mjs`, Zeilen "Batterie
  schwach" in `scripts/mutation_check.py`.
- Einrichtungsassistent (seit 1.69.0, `panel/wizard.js`, `settings.py` `wizard`, WS `alarmageddon/wizard`; Wunsch und Entscheide des Nutzers vom
  2026-11-19, 20:43 und 21:05, Mockups `einrichtungsassistent-v1`): Zustand je Anlage in den globalen Einstellungen (`open`; `later` mit `until` =
  Datum von morgen in Ortszeit von HA; `hidden`; `done`; dazu `step`), fällig (`due`) rechnet der Server. Eine neue Anlage bekommt ihn (kein Eintrag
  = offen); beim ersten Laden nach dem Update (Ablage ohne `wizard`) gelten alle bestehenden Anlagen als `done`, sofort geschrieben; eine Anlage aus
  einem Backup bekommt `done`; Entfernen nimmt den Zustand mit; nie im Backup. Der Befehl ändert nie die Anlage selbst. "Später" führt am nächsten
  Tag **genau zum Schritt** zurück, bei dem man aufgehört hat (jeder Schrittwechsel geht an den Server). **Kein eigener Editor:** die Schritte
  speichern über die Entwürfe und das Speichern der Reiter (`SystemUi`, `SensorsUi`, `NotifyUi`, `ActionsUi`); "Zuordnung", "Alarmaktionen" und
  "Überwachung" sind die eingebetteten Ansichten (das Panel zeichnet in `.ag-wz-slot` als `_view`, `_tab`/`_sub` stehen auf dem Schritt, Ereignisse
  laufen weiter über die Reiter). Eine Änderung an einem Reiter gilt damit auch im Assistenten; was im Assistenten fehlen soll, blendet `styles.js`
  je Schritt aus. Er öffnet sich nie über ungespeicherte Änderungen oder ein offenes Fenster; der Start von Hand fragt vorher. Der Code ist
  freiwillig (ein Hauptcode zählt), "Schnell hinzufügen" nur Sirene 3 Minuten und Alarmton (Entscheid: ohne Licht), "Überwachung" nur mit
  passenden Messwerten oder eingeschalteter Überwachung (seit 1.70.0: solange die Messwerte laden, bleibt ein angefangener Schritt "Überwachung" stehen,
  `_monitorFits`; Messwerte über das Fenster `#ag-wzpick`, nie alle als Knöpfe, Wunsch des Nutzers 2026-11-20). "Weitere Funktionen" am Schluss hat seit 1.73.0 je Funktion (ausser der Dashboard-Karte)
  einen runden Pfeil (`data-wz="more-go"`, `wizard._goMore`, `MORE`): er schliesst den Assistenten **ohne ihn abzuschliessen**, springt mit `openPlace` (Routinen,
  Codes, Töne, HealthCheck) nach Konfiguration › Anlage und öffnet das Fenster; das Schliessen des Fensters (`close`-Ereignis) startet den Assistenten wieder
  auf "Fertig" (`start`, offene Änderungen fragen vorher). Suite `wzmore-e2e.mjs`. Der Knopf "Konfiguration öffnen" schliesst ab wie "Fertig". Testmeldungen im Assistenten (seit 1.71.0, Wunsch des Nutzers
  2026-11-20, 11:40): je eine an die Standard-Empfänger der Alarme und der Wartung (`test_notify` mit `group`, `Notifier.send_group_test`: ohne
  Empfänger der Gruppe geht nichts hinaus, nie an die Empfänger einer Art; `kind` und `group` schliessen sich aus). Knopf im Kopf (seit 1.71.0,
  Entscheide des Nutzers 11:48): rund neben dem Stift (`_wizardBtn`), nur solange der Assistent nicht `done` ist, führt beim gemerkten Schritt weiter
  (`data-wz="run"`, offene Änderungen fragen vorher); der Zauberstab schwingt einmal je Laden, `WAVE_MS` nach dem Erscheinen (`_waveLater`), **auch bei
  "Bewegung reduzieren"** (Entscheid "immer animieren"); Suite `wzbtn-e2e.mjs`. Ein neuer Schritt ergänzt `WZ_STEPS` (Panel) und `WIZARD_STEPS` (Server), die Texte `wz*`
  und die Suite `wizard-e2e.mjs`; Tests `tests/test_wizard.py`, Zeilen "Assistent" in `scripts/mutation_check.py`.
- Neustart und Absturz (seit 1.58.0, Code-Review): Der Zustand steht in einer eigenen Ablage (`controller._save_state`, `STATE_STORE_KEY`), sofort bei jedem
  Wechsel geschrieben; beim Start gilt der neuere von eigener Ablage und Restore-Stand von HA (`controller.newer_state`). Was beim Wiederherstellen
  auslösen muss (abgelaufene Eingangsverzögerung), löst erst in `controller.async_finish_restore()` aus, wenn alle Zuhörer angemeldet sind
  (`__init__.py`, nach `workflow.async_start()`): sonst gäbe es einen Alarm ohne Aktionen, Meldung und Aufzeichnung. Abgelegte Werte werden einzeln
  geprüft, ein beschädigter Wert macht die Anlage nie "nicht verfügbar". Nie `hass.async_block_till_done()` im Code der Integration (wartet auf jede
  Aufgabe von HA); Ziele von `async_call_later` sind immer `@callback`-Funktionen, nie ein `lambda` (läuft sonst in einem Thread). Tests in
  `tests/test_review_1_58.py`, Zeilen "Code-Review 1.58.0" in `scripts/mutation_check.py`.
- Jede Änderung am Zustandsautomaten oder an der Szenario-Engine braucht
  Tests für: Deaktivieren während Verzögerung, Neustart während Alarm,
  Sensor fällt im scharfen Zustand aus.

## Sicherheitstests (seit 0.40.0, Code-Review)

Alarmageddon ist ein Sicherheitsprodukt: Tests sichern Zusagen, nicht Zeilen. Verbindlich:

- `tests/test_security.py` prüft Zusagen vollständig statt am Beispiel. Jeder neue WebSocket-Befehl bekommt einen Eintrag
  in `COMMANDS` (sonst scheitert `test_every_websocket_command_is_listed`); damit gelten für ihn automatisch
  "nur Administratoren" und "fremde oder nicht geladene Anlage abgelehnt".
- Jede neue Schutzmassnahme (Prüfung einer Berechtigung, eines Zustands, einer Eingabe, eines Absenders) bekommt einen
  Test **und** eine Zeile in `scripts/mutation_check.py`. Die Mutationsprobe baut die Massnahme aus und verlangt, dass
  ein Test scheitert; "ÜBERSEHEN" oder "FEHLT" ist ein Fehler, auch in der CI.
- Neue Zustände, Modi oder Empfängertypen ergänzen die parametrisierten Tests (Zustandsmatrix, Wiederherstellung,
  `recipient_users`), nicht nur einen Einzelfall.
- Geheimnisse (Code, Hash, Salz) dürfen in keiner Antwort, Ablage oder Logzeile der Integration stehen:
  `test_codes_and_hashes_never_leave_the_server` um jede neue Antwort und Ablage erweitern.
- Fehlertests zuerst rot sehen (LEARNINGS); Panel-Änderungen bekommen eine Prüfung in einer Suite unter `tests/panel`
  (`review-e2e.mjs` für Logik, die Server und Panel gleich rechnen müssen).

## Regel: Ebenen einer Einstellung

- Eine Einstellung, die sich mehr als global ändern lässt, bekommt alle
  Ebenen zugleich, mit Anzeige der Herkunft, Zurücksetzen, Übersicht der
  eigenen Werte, Sicherung und Wiederherstellung und Tests. Nie nur einen
  Teil der Ebenen bauen und den Rest später nachreichen.
- Ebenen für Alarmageddon (Entscheid des Nutzers, 2026-11-08, ersetzt den
  früheren Entscheid für vier Ebenen): zwei Ebenen, Voreinstellung je
  Sensorart (global, für alle Anlagen) › eigener Wert pro Sensor (Wirksam:
  Sensor > Sensorart). Keine eigenen Ebenen für Alarmanlage und Bereich.

## HACS

- Öffentliches Repository, genau eine Integration unter
  `custom_components/alarmageddon/`.
- `hacs.json` im Root mit `name`, `render_readme`, ehrlicher Mindestversion
  `homeassistant`.
- `manifest.json` mit `domain`, `name`, `version`, `documentation`,
  `issue_tracker`, `codeowners`, `config_flow`, `iot_class`,
  `integration_type`, `requirements`, `dependencies`/`after_dependencies`
  für jede importierte Integration.
- Brand-Bilder lokal unter `custom_components/alarmageddon/brand/`
  (`icon.png` 256 × 256, `icon@2x.png`, `logo.png`, `logo@2x.png`, Test
  der Masse), optional PR an home-assistant/brands.
- GitHub: Beschreibung, Topics und Issues sind gesetzt (geprüft 2026-11-08:
  `hacs`, `hacs-integration`, `home-assistant`, `homeassistant`,
  `integration`, `marketplace`; Lizenz MIT). Die HACS-Action prüft das mit.
- Actions `validate.yml` (HACS-Action und hassfest) und `tests.yml` müssen
  grün sein; Actions mit fester Commit-Version.
- Releases als GitHub-Release mit Tag (siehe "Git und Releases").

## Design-Regeln

Übernommen aus ha-device-panel (`docs/reference/device-panel-DESIGN.md`),
Klassen und Präfix (`--ag-`) für Alarmageddon neu. Details in
`docs/DESIGN.md`.

- **Auswahlknöpfe:** Jede Auswahl in Reiter- oder Segmentform ist eine
  Reiterleiste mit gleitender Kapsel am gewählten Knopf. Nie eine eigene
  Segmentleiste ohne Kapsel. Grösse darf abweichen, Stil nie. Eine Leiste
  ohne gewählten Knopf zeigt keine Kapsel.
- **Auch der Zeitraum ist eine Reiterleiste mit Kapsel (seit 1.73.0, Wunsch des Nutzers 2026-11-21):** die Leiste 3 Std. bis 1 Jahr in der Sensoransicht und im
  Protokoll der HealthCheck-Dienste ist `.ag-seg.ag-sv-range` mit `data-seg` (in der Sensoransicht je Reiter einer), die Kapsel fährt auch, wenn das Fenster beim Laden
  neu zeichnet (`_segSync` merkt die Lage je Leiste). Nie wieder eine eigene Leiste ohne Kapsel (`.ag-sv-seg` gibt es nur noch als Stil für andere Stellen). Suite
  `rangeslide-e2e.mjs` misst die Zwischenstände der Kapsel.
- **Reiter der Modi:** Jede Leiste, die zwischen den Modi wechselt
  (Sensoren, Aktionen, Benachrichtigungen, Anlage), trägt `ag-modeseg`:
  Symbole dunkelrot, "Überwachung" orange, Rand am gewählten Reiter, Text
  neutral. Nie blau, nie eigene Gestaltung (`docs/DESIGN.md`, seit 1.64.0).
- **Hinzufügen und Anzeigen:** Listen in eigenem Fenster haben dieselbe
  Zeile `.ag-rtsum`: links "… hinzufügen" mit Plus (öffnet das Formular,
  bei Backups "Backup erstellen"), rechts "… anzeigen" mit eigenem Symbol
  je Liste (Routinen `groups`, Töne `speaker`, Codes `key`, HealthCheck
  `heartPulse`, Backups `archive`).
- **Suchfelder:** `<input type="search">` mit Lupe links und eigenem X zum
  Leeren rechts (nur sichtbar mit Inhalt, Fokus bleibt im Feld). Ein
  gemeinsamer Handler, keine eigene Gestaltung je Feld.
- **Pfeile:** Jeder Pfeil, der eine Zeile, Kachel oder einen Abschnitt öffnet
  oder weiterspringt, ist derselbe runde Pfeil-Knopf (24 px, Pfeil 16 px).
  Ausnahmen: Dropdowns und Auswahlfelder behalten ihren kleinen Pfeil.
  Die Zeilen der Sensortabelle (Konfiguration › Sensoren) haben seit 1.66.1
  (Wunsch des Nutzers 2026-11-19) statt des Pfeils einen runden Stift
  (`.ag-wf-btns.ag-senbtns`, `data-sen="detail"`), am Computer davor den
  runden Papierkorb (`data-sen="remove"`), auf dem Handy nur den Stift.
- **Ladeanzeige bei Grafiken:** Reiter wechselt sofort, danach lädt es. Die
  alte Grafik bleibt gedimmt, darüber drei sich drehende Punkte in der Farbe
  der Grafik. Überholte Antworten verwerfen, geholte Zeiträume kurz
  zwischenspeichern. Nie "Lädt …" als Text oder einen Balken.
- **Einheitlich speichern:** Änderungen sind ein Entwurf mit "Abbrechen" und
  "Speichern". Beim Wechsel zwischen Reitern geht nie etwas verloren: jeder
  Reiter behält seinen Entwurf, ein gelber Punkt am Reiter zeigt offene
  Änderungen. Rückfrage nur dort, wo ein Entwurf wirklich ersetzt oder
  verworfen würde (andere Anlage, Neuladen der Seite).
- **Tabellenkopf klebt immer (Vorgabe des Nutzers, 2026-11-09):** Die oberste
  Zeile jeder Tabelle (Beschriftung, Filtern, Sortieren) scrollt nie weg, auf
  Desktop und auf dem Handy; nur die Zeilen darunter scrollen. Auf dem Handy
  scrollen dafür die Filter weg, und die Tabelle ist so kompakt, dass sie ohne
  seitliches Scrollen passt (ein Rollbereich mit `overflow` verhindert das
  Festkleben). Jede neue Tabelle bekommt einen Test, der auf Desktop und Handy
  scrollt und die Lage des Kopfes prüft.
- **Orange Punkte (Vorgabe des Nutzers, 2026-11-10):** Ein orange Punkt bedeutet immer "ungespeicherte Änderung" (zum Beispiel am Reiter). Jede andere Markierung, etwa "eigener Wert", ist blau. Verschwindet ein orange Punkt nach dem Speichern nicht, ist es ein Fehler.
- **Schalter links, Text rechts (Grundregel, Vorgabe des Nutzers, 2026-11-11):** Jeder Schalter steht links, sein Text
  rechts davon und nahe dabei; der Text wächst nach rechts. Nie ein Schalter am rechten Rand, weit weg von seinem Text,
  auf Desktop und auf dem Handy. Zwischen Schalter und Text darf nur das Symbol der Option stehen. Die Regel gilt
  zentral im CSS für alle Zeilenarten (`order: -1` in `styles.js`); eine neue Zeilenart wird dort ergänzt. Ausnahme:
  Schalter in Tabellenzellen (die Spalte ist ihre Beschriftung). `tests/panel/suites/switches-e2e.mjs` prüft das ganze
  Panel samt allen Fenstern; jede neue Ansicht mit Schaltern kommt dort dazu.
- **Sensorkarten gleich hoch (Vorgabe des Nutzers, 2026-11-13):** Alle Karten der Übersicht sind immer gleich hoch, im Raster und auf
  dem Handy. Der Name hat immer Platz für drei Zeilen (danach "…", voll im Tooltip), die übrigen Zeilen haben feste Höhen, fehlende
  Angaben stehen als "–" da. Eine neue Zeile oder Angabe auf der Karte bekommt eine feste Höhe; `tests/panel/suites/cardheight-e2e.mjs`
  prüft das mit langen Namen, auf Desktop und Handy.
- **Play-Knöpfe (Vorgabe des Nutzers, 2026-11-17):** Jeder Play-Knopf im Panel verhält sich gleich: beim Drücken rot mit weissem Stopp-Symbol
  (Klasse `ag-running`, pulsiert), Stopp macht ihn wieder zum Play-Knopf. Was läuft, hält Stopp an; einmalige Tests (Testmeldung, Schritt der
  Überwachung) über `common.js onceBtn`, `paintOnce`, `runOnce`: rot bis zur Antwort, mindestens `ONCE_MS`, Stopp beendet nur die Anzeige. Beim Wechsel
  nur die Knöpfe ummalen (`paintOnce`), nie die Seite neu zeichnen (ein Neuzeichnen während des Neuladens nach dem Speichern liess die Ladeanzeige
  stehen). Ein neuer Play-Knopf kommt in `tests/panel/suites/play-e2e.mjs`.
- **Kapitel:** Einstellungen stehen in Kapiteln; jedes hat einen Titel mit
  einem Strich davor (`chapter()` in `panel/common.js`), darunter die Karte. Das Fenster "Ansicht" folgt dem seit 1.34.4 (Vorgabe
  des Nutzers 2026-11-14): Abschnitte als Kapitel statt kleiner grauer Grossbuchstaben (`.ag-label`). Andere Fenster mit `.ag-label`
  als Abschnittstitel sind noch nicht angeglichen.
  Reiter der Konfiguration gleiten beim Wechsel seitlich herein.
- **Drag and Drop** mit Pointer-Ereignissen am Fenster und Tastatur-Ersatz
  (siehe LEARNINGS); auf Touch zusätzlich Antippen statt Ziehen.

## Git und Releases

- Nur auf `main` pushen, keine weiteren Branches. Gilt auch, wenn die
  Session einen anderen Branch vorgibt. Liegt Arbeit auf einem anderen
  Branch, nach `main` bringen und den Branch löschen. Lehnt GitHub den Push
  auf `main` ab, über einen PR mergen und den Branch danach löschen. Remote-
  Branches löschen kann die Session nicht (403): dann den Nutzer bitten.
- Tags und Releases legt der Nutzer selbst an, immer mit Ziel `main`
  (Sessions können keine Tags pushen). Ob ein Tag existiert, prüft Claude auf
  GitHub unmittelbar vor jedem Push: Tags und Releases, mit und ohne
  "v"-Präfix.
- Korrekturen an einer Version, deren Tag noch nicht existiert, bleiben in
  derselben Version (CHANGELOG-Abschnitt ergänzen). Neue Funktionen
  bekommen eine neue Nummer, auch wenn die vorige noch keinen Tag hat; die
  vorige wird dann übersprungen.
- Nach jedem Push, der die Integration ändert (Code, Manifest, CHANGELOG),
  liefert Claude die Release-Angaben für den aktuellen Stand von `main`:
  - Version (wie in `manifest.json`), Tag und Titel `vX.Y.Z`
  - Ziel: `main` mit Commit-Hash
  - Vorabversion: Version 1.0.0 ist offiziell (Entscheid des Nutzers,
    2026-11-10, kein "Pre-release"-Haken). Für spätere Versionen vor dem
    Release nachfragen, ob Vorabversion oder offiziell. Bisherige Regel,
    standardmässig **ja**, bis der Nutzer ausdrücklich sagt,
    dass eine Version offiziell wird. Versionsnummern ohne a/b/rc-Suffix;
    der Unterschied liegt nur am Haken "Pre-release". Grund: HACS zeigt
    Vorabversionen nur Nutzern, die sie einschalten.
  - Release Notes im Chat **nur auf Englisch** (Entscheid des Nutzers,
    2026-11-08; CHANGELOG und README bleiben zweisprachig), als
    Markdown-Codeblock, beginnend mit `## X.Y.Z (JJJJ-MM-TT)`. Grundlage:
    `python3 .github/scripts/changelog_section.py X.Y.Z` (Englisch) und
    `python3 .github/scripts/changelog_section.py X.Y.Z de` (Deutsch).
  - **Offizielles Release nach Vorabversionen:** Die Notes fassen alles seit
    dem letzten *offiziellen* Release zusammen, mit dem Satz "Includes the
    changes from X and Y" / "Enthält die Änderungen aus X und Y".
  - **Übersprungene Versionen:** Die Notes fassen alles seit dem letzten
    Release zusammen (Abschnitte zusammengeführt), mit demselben Satz.
- **Vorgabe des Nutzers (2026-11-08):** Immer wenn ein Release fertig ist und
  Claude auf den Nutzer wartet, gibt Claude die kompletten Release Notes
  (nur Englisch) seit dem letzten vom Nutzer veröffentlichten Tag
  aus, nicht nur die der letzten Version. Vorher auf GitHub prüfen, welches
  der letzte veröffentlichte Tag ist. Aktuell sind alle Releases
  Vorabversionen ("Vorabversion: ja").
- Im CHANGELOG (beide Sprachen) bleiben übersprungene Versionen mit eigenem
  Abschnitt stehen, mit dem Vermerk "Not released" / "Nicht veröffentlicht"
  und ohne Link-Fussnote.
- Veröffentlichte Tags nie ändern: Ist ein Release falsch, neue Version.

## Bei jeder funktionalen Änderung

1. Version in `manifest.json` erhöhen (SemVer: Patch für Fehler, Minor für
   Funktionen oder Verhaltensänderungen).
2. `PANEL_VERSION` in `const.py` erhöhen, sobald sich Dateien unter
   `panel/` ändern (Cache-Buster). Eine neue Datei unter `panel/` in die Liste `MODULES` in `panel/panel.html` eintragen (seit 1.58.0
   lädt das Panel alle Module zugleich; `tests/test_panel_preload.py` prüft die Liste).
3. CHANGELOG-Eintrag in `CHANGELOG.md` und `CHANGELOG.de.md` inkl.
   Link-Fussnote.
4. README und Handbuch (`docs/MANUAL*.md`) EN und DE nachführen, bei jeder Lieferung (Vorgabe des Nutzers, 2026-11-11). Hat sich die Oberfläche sichtbar
   geändert, auch die Bilder neu erzeugen: `node tests/panel/readme-shots.mjs`, danach `python scripts/optimize_images.py`.
5. Sicherung und Wiederherstellung prüfen: Alles, was der Nutzer eingestellt
   hat (Zonen, Szenarien, Überwachung, Einstellungen pro Gerät), gehört in
   die Sicherung, mit Prüfung des Werts und Test. Laufzeitdaten nicht.
6. Prüfungen (siehe unten) und Tests laufen lassen.
7. `.pyc`/`__pycache__` nie committen.
8. Nach dem Push die Release-Angaben ausgeben (siehe "Git und Releases").
9. `docs/HANDOVER.md` nachführen (Stand, offene Punkte).

## Prüfungen vor jedem Commit

Gelten, sobald der jeweilige Teil existiert:

- Python: `python -m pyflakes custom_components/alarmageddon/*.py`
- JSON gültig, `strings.json` identisch mit `translations/en.json`,
  `translations/de.json` mit denselben Schlüsseln
- `node --input-type=module --check < Datei` für alle Panel-Dateien
  (`node --check` allein findet in Modulen keine Syntaxfehler)
- kein "ß" in Code, Texten, README, CHANGELOG
- README und CHANGELOG EN/DE gleich aufgebaut (Test)
- `python -m pytest` in beiden Testumgebungen: Python 3.13 mit `pip install -r requirements_test.txt` (Home Assistant 2026.2.3) und Python 3.14 mit
  `pip install -r requirements_test_current.txt` (Home Assistant 2026.10.4)
- `python scripts/mutation_check.py` (Mutationsprobe der Sicherheitstests, siehe "Sicherheitstests")
- Panel-Tests mit HA-Nachbau und Playwright, je Sprache, Desktop und Handy
  (390 × 844), echte Klicks/Taps.

## Commit-Nachrichten

Kurze Betreffzeile mit Version ("0.2.0: …"), Liste der Änderungen, am Ende
die vom System vorgegebenen Co-Author-/Session-Zeilen.
