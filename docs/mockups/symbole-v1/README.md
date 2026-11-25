# Mockup "Symbole einheitlich" (v1, 2026-11-25)

Wunsch des Nutzers: "mach mal ein Mockup, wie du alle Icons einheitlich darstellen würdest. Komplette Seite, damit ich alles sehe." Vorgaben aus
dem Gespräch davor: "Das Icon soll immer oben links, im weissen Bereich sein", "Schalter sind immer links vor dem Text", das Kapitel "Zeiten und
Verhalten" heisst nur "Zeiten" und das Bestätigungsfenster steht im selben weissen Bereich wie die übrigen Zeiten.

Gebaut aus dem echten Panel im Nachbau (`src/mockup.mjs`: lädt Konfiguration › Anlage und › Benachrichtigungen und baut sie im Browser um),
Desktop (1400 px) und Handy (390 px), je "heute" und "vorschlag". Die Handy-Seiten gibt es zusätzlich in Spalten nebeneinander (`*-spalten.png`).

## Regel des Vorschlags

1. Jede Zeile einer Karte trägt ein Symbol in einer Kachel (36 px), **oben links** im weissen Bereich, auch bei mehrzeiligem Text und auf dem Handy.
2. Ein Schalter steht **direkt nach dem Symbol**, vor seinem Text (bisher stand er vor dem Symbol).
3. Kachel grau; bei Zeilen mit Schalter in der Akzentfarbe, solange er an ist (wie heute bei den Modi). Kapitel mit eigener Farbe (Routinen, Codes,
   Töne, HealthCheck, Backup, Akzentfarbe, Assistent) behalten sie. "Anlage löschen" rot.
4. Eingabefelder und Knöpfe bleiben rechts (Handy: darunter).

## Neue Symbole

| Zeile | Symbol |
| --- | --- |
| Einstellungen pro Modus (Nach einem Alarm, Zeiten, Störungsmeldungen) | Regler (`tune`) |
| Ausgangsverzögerung | Stoppuhr (`timer`) |
| Eingangsverzögerung | offene Tür (`doorOpen`) |
| Bestätigungsfenster | Häkchen (`check`) |
| Scharfschalten verlangt den Code | Schloss (`lockClosed`) |
| Moduswechsel verlangt den Code | Pfeile (`repeat`) |
| Quittieren verlangt den Code | Glocke aus (`bellOff`) |
| Selbsttest alle | Uhr (`clock`) |
| Anlage löschen | Papierkorb (`trash`, rot) |
| Empfänger von Alarmen | Glocke (`bell`) |
| Empfänger von Wartungsmeldungen | Zahnrad (`cog`) |

Verschoben (Symbol vor den Schalter): Modi, Nachalarm, Automatisches Backup, Karten der Stör- und Wartungsmeldungen.

## Nicht im Mockup

Die Karten der festen Meldungen unter Konfiguration › Aktionen ("Alarm endet", "Scharf geschaltet" usw.) und die Einstellungen eines Sensors haben
dieselbe Reihenfolge Schalter vor Symbol; sie würden nach demselben Entscheid umgestellt.
