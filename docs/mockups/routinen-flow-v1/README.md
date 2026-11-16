# Mockups: Routinen, Vorschau des Ablaufs (2026-11-16)

Wunsch des Nutzers: Am Schluss des Editors einer Routine zeigt eine Grafik den Ablauf als Vorschau. Die Bilder zeigen den echten Editor (HA-Nachbau,
hell, Computer und Handy 390 px) ab dem Kapitel "Dann"; das neue Kapitel **Vorschau** ist Entwurf. Beispiel: "Heimkommen" (Schloss aufgeschlossen oder
Marco zu Hause und 22:00–06:00, gilt bei Ausgangsverzögerung und scharf, deaktiviert). Quelle: `src/mock.mjs`. **Noch nicht entschieden, nicht umgesetzt.**

| Variante | Idee | Stärke | Schwäche |
| --- | --- | --- | --- |
| **A** `A-ablauf-senkrecht-…` | Senkrechter Ablauf: 1 Auslöser (mit Und/Oder-Baum), 2 Prüfung (Band der fünf Zustände, die gewählten grün), danach **Ja** zur Aktion und **Nein** zu "Übersprungen, steht im Protokoll" | Zeigt alles, auch den Weg "übersprungen"; wächst mit dem Baum; Handy gut (alles untereinander) | Höchster Platzbedarf |
| **B** `B-drei-schritte-…` | Drei Karten nebeneinander (Handy untereinander): Auslöser, Nur wenn, Aktion | Kompakt, auf einen Blick | Der Baum ist nur ein Satz; "übersprungen" nur im Text |
| **C** `C-zustandsband-…` | Band "Lebenslauf der Anlage" mit dem Bereich, in dem die Routine wirkt, darunter ein Satz mit Auslösern und Aktion | Zeigt am besten, **wann** sie wirkt | Der Auslöser steht nur als Satz; kein Flussbild |

**Empfehlung: A**, mit dem Zustandsband aus C im Schritt 2. Es ist das einzige, das den Ablauf mit seinen beiden Ausgängen zeigt, und die Marke "Umgeht den Code"
steht an der Aktion, wo sie hingehört. Die Vorschau ist reine Anzeige (nie bedienbar) und folgt live dem Entwurf: Auslöser Zeitplan zeigt die Zeiten statt
des Baums, Scharfschalten zeigt die grüne Aktion "Anlage scharf: Abwesend", bei "Haltezeit" kommt ein Schritt "5 s halten" zwischen Auslöser und Prüfung.

Zu entscheiden: Variante (A, B oder C), und ob die Vorschau eingeklappt beginnt (Platz im Editor) oder immer offen ist.
