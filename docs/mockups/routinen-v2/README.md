# Mockups: Routinen, zweite Runde (2026-11-16)

Entscheide des Nutzers nach `routinen-v1`: (1) **Deaktivieren** ist dabei; (2) **mehrere Auslöser mit Und/Oder und Gruppen**, wie die Bedingungen von
Magic Push im Device Panel; (3) je Routine **fünf Schalter für die Zustände der Anlage**, in denen sie gelten darf (Ausgangsverzögerung, Anlage scharf,
Eingangsverzögerung, Beim Alarm, Anlage deaktiviert; nur der letzte standardmässig an); (4) **Zeitplan und Routinen werden eins**: Auslöser nach Wahl
**Zeitplan** oder **Gerät**. Die Bilder zeigen die echte Seite (HA-Nachbau, dunkel); die neuen Teile sind Entwurf. Dahinter sieht man noch das alte
Kapitel "Zeitplan": es entfällt. Quelle: `src/mock.mjs`.

**Noch nicht entschieden, noch nicht umgesetzt.**

| Bilder | Inhalt |
| --- | --- |
| `1-liste-…` | Eine Liste für alles: Zeitpläne (Uhr-Symbol) und Geräte-Routinen (Schloss …), je mit Auslöser in Klartext, Ziel, Marken ("Umgeht den Code", Zustände, nächste Zeit, zuletzt) |
| `2-ausloeser-geraet-…` | Auslöser Gerät: Bedingungen mit "Alle (und)" / "Eine davon (oder)", **eine Ebene Gruppen** mit eigenem Und/Oder, "muss mindestens N s gelten", Dann, Zustände, Sicherheit |
| `3-ausloeser-zeitplan-…` | Auslöser Zeitplan: Uhrzeit mit Wochentagen, mehrere Zeiten je Routine, Dann, Zustände |
| `4-zustaende-mit-warnung-…` | Die fünf Zustands-Schalter; roter Hinweis, wenn eine Deaktivieren-Routine bei Eingangsverzögerung oder Alarm gelten soll |

## Übernommen aus dem Device Panel (Magic Push)

- Bedingungsbaum `{op: und|oder, items: [Bedingung | {op, items}]}`, **eine Ebene Gruppen**, Höchstzahl (dort 10 Bedingungen, 3 Gruppen), Prüfung am Server.
- "Muss mindestens N Sekunden gelten" und "löst nur bei neu erfüllter Bedingung aus" (Kante, nie Dauerzustand).
- Zustände "nicht erreichbar/unbekannt" sind nicht beurteilbar (zählen weder als wahr noch lösen sie aus).
- Zeit als Bedingung (von–bis, Wochentage): für Alarmageddon als eigene Art "Uhrzeit" im Auslöser Gerät ("nur zwischen 22:00 und 06:00"); der
  Auslöser **Zeitplan** bleibt der einfache Weg für feste Zeiten.

## Entscheide, die ich vorschlage (bitte bestätigen)

1. **Zustände:** Für jede Routine gelten nur die gewählten Zustände; zur Laufzeit zählt der Zustand **beim Auslösen**. Nicht gewählt: die Routine wird
   übersprungen und das steht im Protokoll ("Routine 'Heimkommen' übersprungen: Anlage ist scharf"). Vorgabe: nur "Anlage deaktiviert".
2. **Warnung bei Eingangsverzögerung und Alarm:** Eine Deaktivieren-Routine darf dort nur gelten, wenn beides ausdrücklich gewählt und mit dem
   roten Hinweis bestätigt wird (Bild 4). Bisher deaktivierte ein Zeitplan nie einen Alarm oder eine Eingangsverzögerung; das ändert sich nur auf
   ausdrücklichen Wunsch je Routine.
3. **Übernahme der bestehenden Zeitpläne:** Beim Update wird jeder Zeitplan eine Routine mit Auslöser Zeitplan, Ziel wie bisher und den Zuständen
   **Anlage deaktiviert, Ausgangsverzögerung und Anlage scharf** (das entspricht dem heutigen Verhalten: nie in Eingangsverzögerung oder Alarm).
   Aus dem Kapitel "Zeitplan" wird das Kapitel "Routinen"; nichts geht verloren, Sicherungen älterer Version werden beim Wiederherstellen umgewandelt.
4. **Mehrere Zeiten je Routine:** eine Routine hat Auslöser Zeitplan mit mehreren Zeiten (jede mit eigenen Wochentagen).
5. **Deaktivieren** trägt immer die Marke "Umgeht den Code" und braucht beim Speichern die Bestätigung "Ich habe das verstanden" (nur, wenn die Anlage
   einen Code hat oder die Routine deaktiviert). Das Deaktivieren per Routine ist ein **Schalter in Konfiguration › Anlage** (Standard aus), wie
   "Deaktivieren per Push-Aktion".
6. Sperre je Routine gegen Doppelauslösung (10 s); eine Routine löst nie eine andere aus; Protokoll und Meldung nennen die Routine mit Namen.
