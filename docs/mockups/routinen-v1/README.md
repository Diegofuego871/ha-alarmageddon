# Mockups: Routinen (2026-11-16)

Idee des Nutzers: Ein Kapitel "Routinen" unter Konfiguration › Anlage. Eine Routine hat einen Namen, ein Gerät von Home Assistant (zum Beispiel ein
Smart Lock) und einen Zustandswechsel (abgeschlossen, aufgeschlossen …); sie schaltet dann diese Anlage in einen Zustand. Mehrere Routinen sind
möglich; Warnung, wenn der Code umgangen wird; Gerätewahl mit Suche (auch nach Entitäts-ID, angezeigt wird nur der Name) und Filter.
Die Bilder zeigen die echte Seite (HA-Nachbau, dunkel, Computer und Handy), die neuen Teile sind als Entwurf eingesetzt; erfundene Daten.
Quelle: `src/mock.mjs`.

**Noch nicht entschieden, noch nicht umgesetzt.**

| Bilder | Inhalt |
| --- | --- |
| `1-liste-desktop.png`, `1-liste-handy.png` | Kapitel "Routinen" in der Liste: Schalter links, Name, "Wenn … → Dann …", Marken ("Umgeht den Code" mit Ausrufezeichen, "Zuletzt …") |
| `2-routine-bearbeiten-desktop.png`, `2-routine-bearbeiten-handy.png` | Fenster "Routine bearbeiten": Name, Gerät, Ereignis (je nach Gerätetyp), Ziel, Sicherheit |
| `3-geraet-waehlen-desktop.png`, `3-geraet-waehlen-handy.png` | Gerät wählen: Suche (auch nach Kennung), Filter-Chips nach Art, Bereich |

## Einschätzung

Die Idee ist gut und passt zum Produkt: Der häufigste Wunsch ("Schloss zu → scharf") braucht heute eine eigene Automation in YAML. Eine Routine
im Panel ist sichtbarer, geschützt und hat dasselbe Verhalten wie ein Knopfdruck (Ausgangsverzögerung, "Scharfschalten nicht möglich" mit
Push-Knöpfen, Protokoll).

### Einwände und Antworten (die wichtigen zuerst)

1. **Deaktivieren per Routine ist ein Sicherheitsloch.** Wer den Auslöser auslösen kann (Schloss per Funk oder Cloud, ein Schalter in der App),
   deaktiviert die Anlage ohne Code. Empfehlung: *Scharfschalten* ist frei wählbar, *Deaktivieren* braucht beim Anlegen eine ausdrückliche Bestätigung
   ("Ich habe das verstanden", Bild 2), trägt dauerhaft die Marke "Umgeht den Code" mit Ausrufezeichen (Bild 1) und ist **standardmässig nicht
   erlaubt** (Schalter in Konfiguration › Anlage, wie bei "Deaktivieren per Push-Aktion"). Das passt zu bestehenden Regeln.
2. **Code umgehen.** Ein Code lässt sich per Routine nie eingeben; also umgeht jede Routine ihn. Nur Deaktivieren ist heikel (Scharfschalten braucht
   keinen Code). Darum keine Option "Code umgehen" je Routine, sondern die Marke und die Bestätigung nur bei Deaktivieren, und nur, wenn die Anlage
   einen Code hat.
3. **Echter Wechsel.** Nur ein Wechsel zwischen zwei bekannten Zuständen zählt, nicht die Rückkehr aus "nicht verfügbar" oder "unbekannt" (sonst
   deaktivierte ein Neustart oder ein Funkabriss die Anlage). Optional "muss mindestens N Sekunden so bleiben" gegen Flattern. Nach einem Neustart
   wird nichts nachgeholt.
4. **Schleifen und Doppelauslösung.** Eine Routine schaltet die Anlage, die Anlage schaltet vielleicht das Schloss (Aktion): kurze Sperre je Routine
   (zum Beispiel 10 s), und eine Routine löst nie eine andere aus.
5. **Alarm läuft.** Während eines Alarms oder einer Eingangsverzögerung schaltet keine Routine scharf; Deaktivieren nur, wenn die Routine das
   ausdrücklich darf. Scharfschalten mit offenen Sensoren geht den normalen Weg ("Scharfschalten nicht möglich", Push mit "Erneut versuchen").
6. **Nachvollziehbar.** Protokoll und Meldung nennen die Routine ("Routine 'Haus verlassen' schaltete scharf, ausgelöst von Haustür-Schloss").
7. **Berechtigung.** Nur Administratoren legen Routinen an. Sicherung und Wiederherstellung enthalten sie. Obergrenze (zum Beispiel 20 je Anlage).
8. **Mehrere Anlagen.** Eine Routine gehört zu einer Anlage (das Kapitel steht in der Konfiguration der Anlage), keine Wahl der Anlage nötig.

### Gerätewahl (Bild 3)

- Suche nach Name **und** Entitäts-ID; Treffer zeigen nur den Namen des Geräts (das Gerät wird gewählt, nicht die Kennung; Treffer in der Kennung
  tragen eine kleine Marke).
- Filter-Chips nach Art mit Anzahl ("Schlösser · 3", Schalter, Sensoren, Personen, Alle) und ein Auswahlfeld für den Bereich; Standard: die Art, die
  zu den meisten Routinen passt (Schlösser). Eigene Entitäten von Alarmageddon sind ausgeblendet.
- Je Art zeigt "dieses passiert" die richtigen Ereignisse in Klartext: Schloss (abgeschlossen, aufgeschlossen, klemmt), Tür/Fenster (geöffnet,
  geschlossen), Schalter und Lichter (ein, aus), Person oder Gerät (kommt nach Hause, verlässt das Haus), Taster (gedrückt). Messwerte (Zahlen)
  gibt es in der ersten Version nicht.

### Offen (Entscheid des Nutzers)

1. Ist **Deaktivieren** in der ersten Version überhaupt dabei (mit Bestätigung und Marke), oder nur Scharfschalten und Quittieren?
2. Mehrere Auslöser je Routine ("wenn Diego **oder** Anna …")? Meine Empfehlung: erst später; ein Auslöser je Routine, dafür viele Routinen.
3. Bedingung "nur wenn die Anlage deaktiviert ist" (verhindert, dass "Schloss abgeschlossen" eine scharfe Anlage umschaltet)? Empfehlung: ja, als
   Schalter in der Routine, Standard an.
