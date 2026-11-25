# Übergabe 1.88.0 (2026-11-24): Schalter "Moduswechsel verlangt den Code"

Auftrag des Nutzers an den Agenten, der hochlädt ("Einbauen, aber neue Lieferung"). **Baut auf der Lieferung 1.87.0 auf**
(`alarmageddon-1.87.0.zip`, Basis `main` @ `a2104d6` = Tag `v1.86.2`). Zuerst dieses Protokoll lesen, dann `docs/HANDOVER.md`
(Abschnitt 1.88.0), `docs/UEBERGABE-1.87.0.md`.

## 0. Inhalt der Übergabe und Anwenden

Das ZIP `alarmageddon-1.88.0.zip` enthält:

- `UEBERGABE-1.88.0.md` (dieses Protokoll, liegt auch unter `docs/`), `RELEASE-NOTES-1.88.0.md` (Englisch und Deutsch, zwei Fassungen, siehe unten),
- `1.88.0-auf-1.87.0.patch`: `git diff --binary` vom Stand der Lieferung 1.87.0 auf 1.88.0 (nur die Änderungen dieser Lieferung),
- `1.88.0-auf-v1.86.2.patch`: `git diff --binary` von `a2104d6` (`v1.86.2`) auf 1.88.0 (1.87.0 und 1.88.0 zusammen),
- `files/`: jede Datei, die sich gegenüber `v1.86.2` geändert hat oder neu ist, vollständig (also auch alles aus 1.87.0). Es ist nichts zu löschen.

Anwenden, je nach Stand von `main`:

1. **1.87.0 ist schon auf `main`:** `git apply --index 1.88.0-auf-1.87.0.patch`.
2. **1.87.0 ist noch nicht auf `main`** (`main` steht auf `a2104d6`): `git apply --index 1.88.0-auf-v1.86.2.patch`. Dann gibt es nur einen Commit.
3. Oder in beiden Fällen den Inhalt von `files/` über das Repository kopieren und `git add -A`.

Danach die Prüfungen aus `CLAUDE.md`, Commit `1.88.0: Schalter "Moduswechsel verlangt den Code"` (im Fall 2 zusätzlich die Punkte aus
`docs/UEBERGABE-1.87.0.md` in der Nachricht), Push auf `main`. Tag und Release legt der Nutzer an (Ziel `main`, keine Vorabversion).

**Release Notes:** Hat der Nutzer `v1.87.0` veröffentlicht, gilt Fassung A (nur 1.88.0). Sonst Fassung B (1.87.0 und 1.88.0 zusammen, mit dem Satz
"Includes the changes from 1.87.0"); in dem Fall bekommt der Abschnitt 1.87.0 in beiden CHANGELOG-Dateien den Vermerk "Not released" /
"Nicht veröffentlicht" und verliert seine Link-Fussnote (Regel in `CLAUDE.md`, "Git und Releases"). Das entscheidet sich erst beim Tag; die
Lieferung lässt den Abschnitt 1.87.0 darum unverändert.

## 1. Was gebaut wurde

Frage des Nutzers: Lässt sich der Code beim Moduswechsel (seit 1.87.0 immer) abschalten, wie beim Quittieren? Bis jetzt nicht.

| Teil | Umsetzung |
| --- | --- |
| Option | `code_mode_required` (`const.CONF_CODE_MODE_REQUIRED`) je Anlage. **Standard an, auch ohne gespeicherten Wert**; nur der Wert `False` schaltet ab (`controller.code_mode_required`: `is not False`), ein beschädigter Wert lässt den Schutz an. Nur mit einem Code wirksam |
| Wirkung | `controller.async_arm`: an = wie 1.87.0 (Wechsel im scharfen Zustand und in der Ausgangsverzögerung verlangt den Code, ausser `skip_code`); aus = wie bis 1.86.x (nur "Code zum Scharfschalten"). Deaktivieren verlangt den Code immer |
| Panel | Konfiguration › Anlage, Kapitel "Codes pro Person", direkt unter "Quittieren verlangt den Code" (`system.js _modeCodeRow`, Texte `sysModeCode`, `sysModeCodeHint`); ohne Code gesperrt wie der Schalter darüber; Teil des Entwurfs |
| Optionsdialog von HA | Abschnitt "Verhalten": "Code zum Wechseln des Modus" (`config_flow.py`, Standard an) |
| Server | `save_system` (nur Wahrheitswert; ohne Code gespeichert, aber ohne Wirkung), `data` (gespeicherter Wert), `SYSTEM_OPTIONS_SCHEMA` (Backup) |
| Entität | Attribut `code_mode_required` der Alarm-Entität (wirksamer Wert); die Dashboard-Karte fragt beim Moduswechsel nur dann nach dem Code (`card.js`; fehlt das Attribut, gilt "an") |
| Doku | CHANGELOG 1.88.0 (EN/DE), README und Handbuch (Sicherheit, Codes, HomeKit, Entitäten), neues Bild `codes-en.png`/`codes-de.png`, alle Bilder neu erzeugt |

## 2. Risiken und Grenzen

- "Aus" schwächt den Schutz bewusst: wer am Dashboard, über einen Sprachassistenten oder in Apple Home bedienen kann, wechselt ohne Code zum
  Beispiel von "Abwesend" auf "Anwesend" (Bewegungsmelder nicht mehr überwacht). Der Hinweis im Panel nennt das nicht ausdrücklich, nur die
  Wirkung; das Handbuch beschreibt es.
- Für Apple Home bleibt der bessere Weg der Code in der HomeKit Bridge (`entity_config` → `code`, nur in der YAML-Konfiguration der Bridge). Ein
  Standardcode der Entität gilt für jeden Aufruf ohne Code, auch fürs Deaktivieren; README und Handbuch sagen das.
- Nicht auf echter Hardware und nicht mit einem echten Apple-Gerät geprüft.

## 3. Prüfungen dieser Lieferung

Alle Läufe am Stand der Dateien in `files/`, am 2026-11-24/25 in dieser Session ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `python -m pyflakes custom_components/alarmageddon/*.py scripts/*.py` | keine Meldung |
| JSON gültig, `strings.json` = `translations/en.json`, `de.json` mit denselben Schlüsseln; `node --input-type=module --check` aller Panel-Dateien; kein "ß" in neuen Zeilen | in Ordnung |
| `python -m pytest`, Home Assistant 2026.2.3 (Python 3.13) | 1750 bestanden, 6 übersprungen |
| `python -m pytest`, Home Assistant 2026.10.4 (Python 3.14) | 1750 bestanden, 6 übersprungen |
| `tests/test_mode_code.py` gegen den Stand 1.87.0 | 6 von 11 rot (die neue Einstellung), 5 grün (Verhalten von 1.87.0, das bleibt) |
| Mutationsprobe | die 3 neuen Zeilen "Moduswechsel verlangt den Code" und die 3 Zeilen "Code-Review 1.87.0: Wechsel des Modus" (2 Muster nachgeführt): 6 von 6 erkannt. Alle 494 Muster stehen genau einmal im Code. **Kein voller Lauf** für 1.88.0 (der letzte volle Lauf war 1.87.0, siehe dort); geändert hat sich am Code nur `async_arm` und die neue Eigenschaft |
| Panel-Suiten (`node run.mjs`, Desktop und Handy, DE und EN) | alle 86 Suiten bestanden, 9529 Prüfungen, 0 fehlgeschlagen (voller Lauf) |
| Bilder | alle 50 neu erzeugt (`readme-shots.mjs`, `optimize_images.py`), das neue `codes-*.png` angesehen |

Nicht ausgeführt: HACS-Action und hassfest (nur in der CI), echte Hardware, Apple Home mit echtem Gerät.
