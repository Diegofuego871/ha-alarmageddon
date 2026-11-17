# Mockup: Aktions-Gruppe (v1, 2026-11-17)

Wunsch des Nutzers (2026-11-17): ein neues Element "Aktions-Gruppe" im Ablauf der Aktionen. Schritte lassen sich in die Gruppe legen (Plus oder
Ziehen), die Gruppe wiederholt sie in ihrer Reihenfolge: eine Anzahl Durchläufe, eine Dauer oder bis deaktiviert wird. Sie soll als Gruppe
gut erkennbar sein, zum Beispiel leicht nach rechts versetzt mit einer Klammer davor.

**Stand: umgesetzt in 1.59.0.** Entscheide des Nutzers (2026-11-17):

- **Variante B** (Rahmen mit Kopfzeile), aber **nicht violett**: der Rahmen trägt die Farbe des Bereichs, in dem die Gruppe steht (beim Alarm
  rot), wie die anderen Aktionen dort. Die Bilder unten zeigen noch das Violett des Mockups.
- "Warten": je Gruppe dieselbe Option wie bei den anderen Aktionen ("Warten, bis die Aktion beendet ist", Standard aus). Auf "bis deaktiviert"
  lässt sich nicht warten (die Gruppe endet nie von selbst), wie beim Alarmton "bis zum Deaktivieren".
- In allen Listen der Aktionen, nicht in der Überwachung; "bis deaktiviert" nur im Ablauf des Alarms.
- Grenzen wie vorgeschlagen: 1 bis 100 Durchläufe, 1 bis 3600 s, höchstens 10 Aktionen je Gruppe (zählen zu den 40 je Liste), keine Gruppe in
  der Gruppe, mindestens 1 s je Runde.
- Zusatz: Wandert eine Gruppe in einen anderen Bereich, fallen nach einer Rückfrage die Aktionen weg, die es dort nicht gibt.

Was vom Konzept unten abweicht, steht in `docs/HANDOVER.md` (Abschnitt 1.59.0): flache Angaben `mode`/`count`/`seconds` statt `repeat`, die
Dauer endet nie mitten in einer Runde; "Rückgängig nach einer Zeit" gibt es in einer Gruppe seit 1.60.0 (je Gerät ein vorgemerkter Gegendienst).

## Varianten

| Bild | Variante |
| --- | --- |
| `1-A-klammer-desktop.png`, `1-A-klammer-handy.png` | **A: Klammer, nach rechts versetzt (Empfehlung).** Die Schritte der Gruppe stehen eingerückt, links eine violette Klammer über die ganze Höhe, oben eine Pille mit Name und Wiederholung, unten der Satz "danach wieder von oben". Eigene Farbe (Violett), damit die Gruppe sich von den Zonenfarben (Alarm rot, Verzögerung orange) abhebt. |
| `2-B-rahmen-desktop.png`, `2-B-rahmen-handy.png` | **B: Rahmen mit Kopfzeile.** Die Gruppe ist ein Kasten mit eigener Kopfzeile; die Schritte liegen als Karten darin. Braucht auf dem Handy mehr Breite (Rand links und rechts). |
| `3-fenster-gruppe-desktop.png`, `3-fenster-gruppe-handy.png` | Fenster der Gruppe: Name (freiwillig), "Wie lange wiederholen?" als Reiterleiste Anzahl / Dauer / Bis deaktiviert, dazu der Wert. |

Empfehlung: **A**. Sie entspricht der Idee des Nutzers, braucht auf dem Handy am wenigsten Breite (nur die Einrückung) und lässt die Karten der
Schritte unverändert (Test, Bearbeiten, Duplizieren, Löschen wie überall).

## Fragen an den Nutzer (vor dem Bau)

1. Variante A oder B?
2. "Bis deaktiviert": laufen die Schritte **nach** der Gruppe sofort weiter (Gruppe läuft nebenher, wie ein Alarmton "bis zum Deaktivieren"), oder
   sind nach einer solchen Gruppe keine Schritte mehr erlaubt? Empfehlung: nebenher, mit Hinweis im Fenster (im Mockup gezeigt).
3. In welchen Listen gibt es die Gruppe? Vorschlag: überall, wo es Schritte gibt, mit den Schritten, die dort erlaubt sind; "Bis deaktiviert" nur
   im Ablauf des Alarms (nach dem Quittieren und beim Deaktivieren deaktiviert niemand mehr: dort nur Anzahl und Dauer).
4. Gruppen in Gruppen? Vorschlag: nein (eine Ebene), wie bei den Bedingungen der Routinen.
5. Obergrenzen: Vorschlag 1 bis 100 Durchläufe, Dauer 1 bis 3600 s, höchstens 10 Schritte je Gruppe; die Schritte der Gruppe zählen zur
   Grenze von 40 Schritten je Ablauf.

## Technisches Konzept (für die Umsetzung)

- **Schema** (`schemas.py`): neue Schrittart `{"type": "group", "name"?: str, "repeat": {"mode": "count"|"duration"|"until_disarmed", "count"?: 1..100,
  "seconds"?: 1..3600}, "steps": [Schritte ohne "group"]}`. Je Liste gelten die dort erlaubten Arten auch in der Gruppe (`valid_after_step` usw.
  rufen sich für die inneren Schritte selbst). `until_disarmed` nur in `CONF_WORKFLOWS`. In Sicherung und Wiederherstellung über dasselbe Schema.
- **Ablauf** (`workflow.py`): `_step` für `group` läuft die inneren Schritte in einer Schleife über `_watched` je Schritt (dieselben Grenzen wie
  heute). `step_waits`: `until_disarmed` wartet nie (läuft nebenher wie der Dauerton), `count` und `duration` warten standardmässig (Option "wait").
  `step_budget`: Summe der inneren Grenzen mal Durchläufe bzw. Dauer plus eine Runde; für `until_disarmed` keine (läuft nebenher). Kein Durchlauf
  ohne Fortschritt: eine Gruppe, deren Runde weniger als 1 s dauert (nur Push oder Schalten ohne Warten), bekommt eine Mindestpause von 1 s je
  Runde, sonst liefe sie als Endlosschleife ohne Pause (Flut von Dienstaufrufen und Meldungen).
- **Dauer und Neustart**: `duration` zählt wie "Warten" ab dem ersten Start (`_remaining`, gespeichertes Ende im Lauf); `count` merkt Durchlauf und
  inneren Schritt im gespeicherten Stand (`run["group"] = {index, round, inner}`), damit nach Neuladen oder Neustart nichts doppelt läuft.
- **Rückgängig**: `step_entities` und `_plan_undo` müssen die inneren Schritte sehen (Schnappschuss vor dem ersten Schritt, Zurückstellen beim
  Deaktivieren).
- **Meldungen in der Gruppe**: eine Push-Meldung je Runde ersetzt die vorige (gleicher tag); `Notifier.workflow_has_notify` muss innere Schritte
  mitzählen, sonst käme zusätzlich die Standardmeldung.
- **Panel** (`actions.js`): Gruppe als eigene Liste in der Liste (Variante A: `.ag-wf-group` mit Klammer), Plus und Ziehen in die Gruppe und
  heraus (das Ziehen zwischen Listen gibt es seit 1.22.0), Fenster der Gruppe, Kurzfassung auf der Pille. `canon()`/`toStep()` für die neue Art.
- **Pflichttests** (CLAUDE.md): je ein Fall "scheitert" und "hängt" für einen inneren Schritt in `tests/test_action_hang.py`, Dauer in
  `tests/test_duration.py` (Anzahl, Dauer, bis deaktiviert, Neuladen, Neustart), Deaktivieren mitten in der Gruppe, `test_every_step_type_has_a_budget`,
  Zeilen in `scripts/mutation_check.py`, Panel-Suite je Sprache auf Desktop und Handy, Sicherung und Wiederherstellung.

Geschätzter Umfang: Server rund 250 Zeilen mit etwa 40 Testfällen, Panel rund 400 Zeilen mit einer eigenen Suite.

## Quelle

`src/mockup.html` (Parameter `?v=A`, `?v=B`, `?v=editor`), erfundene Daten.
