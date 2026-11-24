# Übergabe 1.87.0 (2026-11-24): Code-Review und Korrekturen der Alarmlogik

Auftrag des Nutzers an den Agenten, der hochlädt. Basis: `main` @ `a2104d6` (= Tag `v1.86.2`, auf GitHub geprüft am 2026-11-24). Zuerst
dieses Protokoll lesen, dann `docs/HANDOVER.md` (Abschnitt 1.87.0), `CLAUDE.md` (Regel "Code-Review 1.87.0"), den Bericht
`REVIEW-2026-11-24.md`.

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.87.0.zip` enthält:

- `UEBERGABE-1.87.0.md` (dieses Protokoll, liegt auch unter `docs/`), `RELEASE-NOTES-1.87.0.md` (Englisch und Deutsch), `REVIEW-2026-11-24.md`
  (Bericht des Code-Reviews, nur zur Information, gehört nicht ins Repository),
- `1.87.0.patch`: `git diff --binary` gegen `a2104d6` (Code, Tests, Texte, Bilder),
- `files/`: jede geänderte oder neue Datei vollständig, im Aufbau des Repositorys. Es ist nichts zu löschen.

Anwenden (eine der beiden Arten):

1. `git checkout main && git pull` (Stand `a2104d6` prüfen), dann `git apply --index 1.87.0.patch`.
2. Oder den Inhalt von `files/` über das Repository kopieren und `git add -A`.

Danach die Prüfungen aus `CLAUDE.md` ("Prüfungen vor jedem Commit"), Commit `1.87.0: Code-Review: Übergabe an einen neuen Alarm,
Sensorgedächtnis, "Muss erreichbar sein", Nachalarm, Code-Sperre`, Push auf `main`. Tag und Release `v1.87.0` legt der Nutzer an
(Ziel `main`, keine Vorabversion). Release Notes: `RELEASE-NOTES-1.87.0.md` (im Chat nur Englisch, Vorgabe in `CLAUDE.md`).

## 1. Entscheide des Nutzers (2026-11-24)

| Befund | Entscheid |
| --- | --- |
| H1 zu → nicht erreichbar → offen | "Alarm wie beim Öffnen", nach 2 s Bestätigung; gilt auch für Sensoren, die während des Neuladens öffnen |
| H2 weiterer Sensor im Alarm | "Meldung und Nachalarm": Meldung immer, Nachalarm je Anlage, Standard aus, Anzahl 1 bis 10, Standard 3 |
| M2 Sperre nach falschen Codes | "Steigern bis 15 Min." (1, 2, 4, 8, 15 Minuten), dazu Protokoll, Push, Ablage |
| M3 Moduswechsel ohne Code | "Code bei jedem Wechsel" im scharfen Zustand; Routinen und Push-Knöpfe ohne Code |
| M4 Scharfschalten mit nicht erreichbarem Sensor | "Wie offener Sensor", mit zwei "Muss"-Schaltern in den Einstellungen des Sensors und in den Voreinstellungen: "Muss beim Scharfschalten geschlossen sein" (Tür, Fenster, weitere; Anzeige umgekehrt zu `open_ok`), "Muss beim Scharfschalten erreichbar sein" (alle, auch Bewegung), dazu "Beim Scharfschalten umgehen". Standard "erreichbar" für Tür, Fenster, Bewegung; bestehende Installationen bekommen es mit dem Update |
| N1 Quittieren im Panel ohne Code | Nur Text ergänzen |
| M7 Ton-Adressen ohne Anmeldung | **Nie umsetzen** (auch künftig nicht vorschlagen) |
| README | Ganz nachführen, alle Bilder neu, Sicherheitsfunktionen im Handbuch, Kapitel "Warum ohne Automationen" |

## 2. Was umgesetzt ist

| Befund | Umsetzung | Gesichert durch |
| --- | --- | --- |
| K1 Quittieren und sofort neuer Alarm; Voralarm und Alarmton auf demselben Lautsprecher | `workflow.py`: Übergabe an einen neuen Alarm (`async_stop(yield_to_alarm=True)`, `_owned_by_alarm`, `_hand_over`, `_taken_over`, `_restore_handover`, `_await_free` mit `HANDOVER_TIMEOUT`, in `step_budget` eingerechnet) | `test_review_1_87.py -k "retrigger or prealarm_never"` (echte Zeit, Geräte mit 0 bis 1,2 s Antwortzeit), `test_action_hang.py` (Grenzen) |
| H1 zu → nicht erreichbar → offen | `controller._remember/_return_confirmed` (`RETURN_CONFIRM` = 2 s), Ereignis `sensor_back_open` | `-k "returns_open or for_a_moment or never_counts or outside_the_armed or always_active_sensor"` |
| M1 Wechsel während des Neuladens | `controller._hand_over_sensors` (beim Entladen), `_apply_handover` (in `async_finish_restore`), höchstens `SENSOR_HANDOVER_MAX_AGE` alt | `-k "during_a_reload or reload_without"` |
| M4 "Muss beim Scharfschalten erreichbar sein" | Option `reachable` (`const.SENSOR_OPTIONS`, `DEFAULT_PRESETS`), `controller.unreachable_sensors/blocking_unreachable/ready`, Fehler `sensors_not_ready`, `arm_failed` mit `unreachable`; Migration `settings.with_reachable` + Vermerk `presets_reachable` (Einstellungen und Backups); Panel `common.js` (`invert`, `notFor`), `_unreachable` in Panel und Assistent, Karte über Attribut `unreachable_sensors`; Bereit-Entität schreibt bei Wechsel der Erreichbarkeit neu | `-k "unreachable or presets or old_backups or ready_entity"`, Suiten `list-e2e`, `layout-e2e`, `review-e2e`, `card-e2e` |
| H2 weiterer Sensor im Alarm, Nachalarm | `controller._again` (Ereignis `sensor_again`, Drossel 5 min), Meldung `alarm_again` (an, kritisch), `workflow._realarm/_alarm_done` (Ereignis `realarm`), Optionen `realarm_enabled`/`realarm_count` (Schema, `save_system`, Backup), Panel-Kapitel "Nach einem Alarm" | `-k "another_sensor or realarm or outside_the_zone"`, Suiten `ntcards-e2e`, `review-e2e` |
| H3 Ton "bis zum Deaktivieren" nach Neustart | `workflow._note_tone/_resume_tones` (auch Rest eines Tons mit Dauer, nie länger) | `-k "endless_tone or rest_after or time_is_over"` |
| M2 Code-Sperre | `CODE_LOCKOUT_STEPS`, Zähler und Sperre in der Zustandsablage, Ereignisse `code_failed`/`code_locked`, Meldung `code_locked`. **Beim Testen neu gefunden:** die neue Instanz las beim Neuladen eine eigene `Store` und verpasste den ausstehenden Schreibvorgang der alten; jetzt eine Ablage je Anlage für die Laufzeit von HA (`controller.state_store`) | `-k "lockout or failed_attempts or wrong_codes"` |
| M3 Moduswechsel | `code_mode_change` in `async_arm` (scharf und Ausgangsverzögerung), ausser `skip_code` | `-k "mode_change or routines_switch"` |
| M5 Frist beim Wiederherstellen | Restzeit auf die eingestellte Verzögerung begrenzt (Eingang und Ausgang) | `-k "is_never_longer"` |
| M6 flatternder Sensor | `Notifier._offline_due` (`OFFLINE_NOTIFY_GAP` = 10 min je Sensor), Protokoll unverändert | `-k "flapping or independently"` |
| N1 | Text der Einstellung "Quittieren verlangt den Code" nennt, dass das Panel (nur Administratoren) ohne Code quittiert | Suite `codes-e2e` (unverändert grün) |
| N3 | Zustandsablage mit `atomic_writes=True` | Code |
| O1 Quality Scale | `diagnostics.py` (eigene Schwärzung von Code, Hash, Salz, Codes), Dienst `acknowledge` in `async_setup`, `PARALLEL_UPDATES = 0` | `-k "diagnostics or acknowledge_service"`, `test_security.py -k never_leave` |

Panel: `PANEL_VERSION` 296; neue Texte in `strings.js` (EN/DE); Nachbau `tests/panel/sim/ha-sim.html` kennt die neuen Meldungsarten,
`reachable` in den Voreinstellungen und den Nachalarm. README und Handbuch (EN/DE): Sicherheitsfunktionen, neues Kapitel "Warum ohne
Automationen" (Handbuch ausführlich mit Vergleichstabelle, README kurz mit Link), alle Bilder neu erzeugt, drei neue Bilder
(`sensor-options`, `notifications`, `after-alarm`).

## 3. Nicht umgesetzt, offen, Risiken

- **M7** bewusst nicht (Entscheid "Nie umsetzen").
- **Startprüfung nach einem Neustart von HA** (Sensor war zu, ist nach dem Start offen): nicht gebaut. Nach einem Neustart gibt es kein
  Gedächtnis; ein beim Start offener Sensor löst wie bisher nicht aus (Test `-k open_after_a_restart` sichert das bewusst).
- **N2** (Meldung "Code bereits vergeben") und **O2/O3** aus dem Bericht: nicht Teil dieser Lieferung.
- **Nicht auf echter Hardware geprüft** (Raspberry Pi, echte Funksensoren, echte Lautsprecher). Die Zeiten der Übergabe (K1) sind mit
  nachgebauten Geräten (0 bis 1,2 s Antwortzeit) geprüft; ein Gerät, das länger als `HANDOVER_TIMEOUT` (3 s) zum Zurückstellen braucht,
  kann den neuen Alarm weiterhin kurz überschreiben (dann steht eine Warnung im Log).
- **Verhaltensänderungen für bestehende Nutzer:** (1) ein nicht erreichbarer Tür-, Fenster- oder Bewegungssensor verhindert ab jetzt das
  Scharfschalten (auch über Routinen und Apple Home); (2) der Moduswechsel im scharfen Zustand verlangt den Code: Apple Home wechselt nur,
  wenn der Code in der HomeKit Bridge (`entity_config` → `code`) oder als Standardcode der Entität eingetragen ist. Beides steht in
  CHANGELOG, Release Notes und Handbuch.

## 4. Prüfungen dieser Lieferung

Alle Läufe am Stand der Dateien in `files/`, am 2026-11-24 in dieser Session ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py scripts/*.py` | keine Meldung |
| JSON gültig, `strings.json` = `translations/en.json`, `de.json` mit denselben Schlüsseln | in Ordnung |
| `node --input-type=module --check` für alle Dateien unter `panel/` | in Ordnung |
| Kein "ß" in den neuen Zeilen | in Ordnung |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1739 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1739 bestanden, 6 übersprungen |
| `tests/test_review_1_87.py` gegen den alten Stand 1.86.2 | 32 von 53 rot (die Befunde), 21 grün (Grenzen und Verhalten, das bleiben soll) |
| `python scripts/mutation_check.py` (491 Zeilen) | Voller Lauf: 477 erkannt. 11 Zeilen mit veraltetem Muster (FEHLT, durch den Umbau verschoben), 1 mehrdeutiges Muster, 1 übersehene ältere Zeile ("Alarm im Test", Test ergänzt) und 1 übersehene neue Zeile (Ton mit Restzeit, Test verstärkt): nachgeführt, danach diese 14 einzeln: 14 von 14 erkannt. **Kein zweiter voller Lauf** nach dem Nachführen; der Code hat sich danach nicht mehr geändert |
| Panel-Suiten (`node run.mjs`, Desktop und Handy, DE und EN) | alle 86 Suiten bestanden, 9505 Prüfungen, 0 fehlgeschlagen (voller Lauf am Ende) |
| Bilder | `node tests/panel/readme-shots.mjs` (alle 48 Bilder neu), `python scripts/optimize_images.py`; die drei neuen Bilder angesehen |

Nicht ausgeführt (nur in der CI oder auf Hardware möglich): HACS-Action und hassfest (`validate.yml`), Betrieb auf einem Raspberry Pi mit
echten Sensoren und Lautsprechern, Apple Home mit echtem Gerät.
