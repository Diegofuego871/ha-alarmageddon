# Änderungsprotokoll

[English](https://github.com/Diegofuego871/ha-alarmageddon/blob/main/CHANGELOG.md)

Alle nennenswerten Änderungen an dieser Integration stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/).

## [1.74.1] - 2026-11-21

### Geändert

- **Formular der HealthCheck-Dienste:** Der Titel "Bei Alarm (freiwillig)" heisst jetzt "Bei Alarm"; beide Zusätze sind freiwillig. Bei einem erkannten Dienst setzt Alarmageddon beide für dich ein (solange du sie nicht angefasst hast); du kannst sie leeren oder ohne sie speichern. Ohne Fehler- oder Alarm-Zusatz wird der passende Test-Knopf ("Fehler senden", "Alarm senden") nicht angezeigt, in der Liste und im Kopf des Protokolls.
- **Zauberstab des Assistenten:** Stab, Sterne und Sternschnuppe beginnen im selben Augenblick, ohne Lücke: während der Stab schwingt, wackeln die Sterne, und die Sternschnuppe fährt vom Punkt aus los, erst langsam und dann immer schneller (kurze Beschleunigungskurve) einmal um den Knopf; sobald der Stab zur Ruhe kommt, blitzt der Punkt kurz auf und bleibt stehen.

### Behoben

- **Einrichtungsassistent, "Weitere Funktionen":** nach dem Sprung in ein Fenster der Konfiguration und dem Schliessen bleibt der letzte Schritt an der Stelle, an der du ihn verlassen hast (vorher sprang er nach oben). Auf dem Handy ist "Assistent starten" (Konfiguration › Anlage) linksbündig und so breit wie "Anlage löschen" darunter, nicht über die ganze Breite.
- **Neue Routine:** Das Feld "Name" war rot und eine Meldung zur Zahl der Zeichen stand da, sobald das Fenster aufging, als hätte jemand schon versucht zu speichern. Das Formular beginnt jetzt ruhig: Der Name wird erst rot, wenn man ihn angefasst hat, die Meldung erscheint nach der ersten Änderung im Formular, und "Speichern" bleibt gesperrt, solange etwas fehlt. Fokus und Lage des Fensters bleiben, wie sie waren.

## [1.74.0] - 2026-11-21

Enthält die Änderungen aus 1.72.0 und 1.73.0 (beide wurden nicht als solche veröffentlicht).

### Behoben

- **Update vom Stand, der als "1.73.0" veröffentlicht wurde:** Ein Release mit dem Tag `1.73.0` (ohne "v") wurde versehentlich auf einem Zwischenstand desselben Tages veröffentlicht. Die Versionsnummer war damit vergeben, und Home Assistant bot den fertigen Stand nicht als Update an. 1.74.0 trägt den fertigen Stand von 1.73.0 unter neuer Nummer.

## [1.73.0] - 2026-11-21

Nicht veröffentlicht; enthalten in 1.74.0.

### Hinzugefügt

- **Alarm-Aufruf der HealthCheck-Dienste:** Neben dem Fehler-Zusatz (der Selbsttest hat Probleme) kann ein Dienst einen **Alarm-Zusatz** haben (freiwillig). Löst eine Anlage aus, ruft Alarmageddon den Dienst sofort damit auf (erkannt innerhalb von 10 Sekunden, nie vom Mindestabstand aufgehalten), damit der Dienst "Alarm ausgelöst" statt "Selbsttest fehlgeschlagen" meldet. Endet der Alarm, geht das normale Lebenszeichen hinaus. Ein Alarm hat Vorrang vor einem Fehler des Selbsttests. Dienste ohne Alarm-Zusatz verhalten sich wie bisher. Ein hängender Dienst hält einen Alarm nie auf.
- **Zweiter Knopf "Alarm senden"** in der Liste der Dienste und im Kopf des Protokolls, nur bei einem Dienst mit Alarm-Zusatz; das Protokoll hält den Aufruf als eigene Art Ereignis fest.
- **Vorschläge mit Nachricht auf Englisch:** Für Cronitor (`?state=fail&message=…`) und Uptime Kuma (`?status=down&msg=…`) tragen Fehler- und Alarm-Zusatz eine kurze Nachricht; für Healthchecks.io und Better Stack (die Nachricht geht dort nur per POST) `/fail` und für den Alarm `/2`. Den Alarm-Zusatz schlägt das Fenster nur vor ("Übernehmen"), es füllt ihn nie von selbst aus.
- **Zauberstab des Einrichtungsassistenten:** Er wiederholt sich nach 30 Sekunden Pause und endet mit einer Sternschnuppe rund um den Knopf, wie im Device Panel; die Sternschnuppe startet in dem Moment, in dem der Zauberstab aufhört sich zu bewegen.

### Geändert

- **Formular der HealthCheck-Dienste in Kapiteln:** Dienst, Bei Fehler des Selbsttests, Bei Alarm (freiwillig), Intervall, je mit Titel und Strich davor.
- **Protokoll der HealthCheck-Dienste:** Die Grafik für 90 Tage ist jetzt eine **6-Monats**-Grafik (voller); 90 Tage entfällt.
- **Aktionsknöpfe eingefärbt:** "Lebenszeichen senden" leicht grün, "Fehler senden" leicht orange, "Alarm senden" leicht rötlich; Stift und Protokoll bleiben neutral. Das X und die runden Knöpfe im Kopf des Protokolls sind auf dem iPad gleich gross und auf einer Höhe.
- **"Übernehmen" beim Vorschlag** (Fehler- und Alarm-Zusatz) ist ein kräftiger Knopf mit getöntem Hintergrund und Rand statt eines blassen Links, damit er nicht überlesen wird.
- **Einrichtungsassistent, "Weitere Funktionen":** Ein runder Pfeil in jeder Zeile springt direkt zur Funktion (Routinen, Codes pro Person, Eigene Töne, HealthCheck): Konfiguration › Anlage öffnet sich mit dem Fenster. Das Schliessen des Fensters führt zurück in den Assistenten auf denselben Schritt; unterwegs wird nichts abgeschlossen. Die Dashboard-Karte hat keinen Sprung (sie steht im Dashboard von Home Assistant).
- **Zeitraum der Sensoransicht und des Protokolls der HealthCheck-Dienste** (3 Stunden bis 1 Jahr) ist eine Reiterleiste mit gleitender Kapsel wie überall; vorher war es eine ruhende Leiste ohne Kapsel, beim Wechseln bewegte sich nichts.
- **Code hinzufügen:** Benutzer, Name und Code sind Kapitel (fetter Titel mit Strich davor, wie bei "Routine hinzufügen"); der Einrichtungsassistent nutzt dasselbe Fenster. Der Fokus geht gleich ins Feld "Name", damit man lostippen kann, das Fenster scrollt dafür aber nicht mehr nach unten (auf dem iPhone verschwand der Titel).
- **Kleine Fenster mit einem Namensfeld sehen überall gleich aus:** "Backup erstellen", "Anlage hinzufügen", Umbenennen und Löschen tragen den Feldtitel als Kapitel (fetter Titel mit Strich davor), wie "Code hinzufügen" und "Ton hochladen". Das Fenster zum Löschen bekommt das Kapitel "Bestätigung". Der Fokus scrollt in diesen Fenstern nicht mehr.
- **Abstände des Selbsttests** (Konfiguration › Anlage › HealthCheck): die Symbole vor "Nicht scharf" und "Scharf" sind grün und rot, im selben Ton wie auf der Karte der Anlage; die Schrift bleibt neutral.
- **Ton hochladen** (Fenster "Eigene Töne" und Schritt der Aktionen): "Name" und "Datei" sind Kapitel wie bei "Code hinzufügen", mit gleicher Schrift und Grösse.

### Behoben

- **Ecken der Tabellen auf dem Handy:** Die klebende Kopfzeile der Tabellen in den Fenstern HealthCheck-Dienste und Backups deckte die runden Ecken der Karte zu; die Ecken sind jetzt rund. Die sechs Knöpfe eines Dienstes passen auf dem Handy in die Zeile.

## [1.72.0] - 2026-11-20

Nicht veröffentlicht; enthalten in 1.74.0.

### Hinzugefügt

- **Statuskarte mit HealthCheck:** Sobald HealthCheck-Dienste eingerichtet sind, zeigt die Statuskarte auf einem Dashboard sie neben dem Selbsttest, wie die Statuskachel des Panels (alle in Ordnung, Fehler gemeldet, gescheitert). Die Statusentität trägt die Zahlen als Attribute (`healthcheck`, `healthcheck_ok`, `healthcheck_report`, `healthcheck_fail`), nie eine Adresse.
- **Einrichtungsassistent, "Weitere Funktionen":** "Eigene Töne" stehen jetzt auch in der Liste.

### Geändert

- **Filter der Sensoren** (Konfiguration › Sensoren und "Sensoren hinzufügen"): ein eigener Filter für Wassermelder; bei eingeschalteter Überwachung filtern Temperatur, Luftfeuchtigkeit, Helligkeit und Luftqualität die Messwerte nach Art, statt eines Filters "Messwerte". "Weitere" nimmt alles, was keinen eigenen Filter hat (Rauch, Gas, Hitze, Erschütterung, Sabotage, Geräusch, Glasbruch und Ähnliches, Luftdruck). Es erscheinen nur die Filter, zu denen es Sensoren gibt.
- **Einrichtungsassistent, "Weitere Funktionen":** Die Symbole haben die Farbe ihres Kapitels unter Konfiguration › Anlage.

## [1.71.0] - 2026-11-20

### Hinzugefügt

- **Knopf für den Einrichtungsassistenten im Kopf:** Solange der Einrichtungsassistent einer Anlage nicht fertig ist ("Später", "Nicht mehr anzeigen" oder noch nicht begonnen), steht neben dem Stift ein runder Knopf mit Zauberstab, in jedem Reiter. Er führt genau beim Schritt weiter, bei dem du aufgehört hast (der Tooltip nennt ihn); bei offenen Änderungen fragt er vorher. Einmal je Laden des Panels, fünf Sekunden nachdem er erscheint, schwingt der Zauberstab kurz. Nach "Fertig" ist der Knopf weg; "Von vorn" bleibt unter Konfiguration › Anlage.
- **Einrichtungsassistent, zwei Testmeldungen:** Der Schritt "Meldungen" und "Ausprobieren" am Schluss bieten einen Test für die Empfänger von Alarmen und einen für die Empfänger von Wartungsmeldungen (sie können verschieden sein). Jeder Knopf ist frei, sobald seine Gruppe einen Empfänger hat; offene Änderungen der Seite werden wie bisher von selbst gespeichert.

### Geändert

- **Einrichtungsassistent auf dem Handy:** "Zurück" und "Weiter" teilen sich die Breite der Fusszeile zu gleichen Teilen.
- **Einrichtungsassistent auf breiten Bildschirmen:** "Später" oben und "Weiter" unten stehen am rechten Rand des Inhalts statt am Rand des Fensters.

### Behoben

- **Listen in Fenstern auf dem Handy:** In "Messwerte hinzufügen" des Einrichtungsassistenten liefen lange Namen in die nächste Zeile (die Zeilen wurden auf die Höhe der Liste zusammengedrückt). Jede Zeile behält jetzt die Höhe ihres Inhalts; die Zeilen der Messwerte haben dazu mehr Platz, und die Bereiche heben sich als Überschriften ab. Dasselbe gilt für die anderen Listen dieser Art ("Sensoren hinzufügen", die Wahl von Geräten und Sensoren in Regeln und Routinen).

## [1.70.0] - 2026-11-20

### Geändert

- **Einrichtungsassistent, Schritt "Überwachung":** Die Messwerte erscheinen nicht mehr alle auf einmal als Knöpfe (bei vielen Sensoren eine sehr lange Liste, die die Regeln weit nach unten schob). Die Liste beginnt leer; "Messwerte hinzufügen" öffnet ein Fenster wie "Sensoren hinzufügen" mit Suche und Filtern (Temperatur, Luftfeuchtigkeit, Helligkeit, Luftqualität, Weitere; nur die vorhandenen), in dem du die gewünschten Messwerte ankreuzt. Die gewählten stehen in einer Liste fester Höhe mit ihrem jetzigen Wert, Suche, denselben Filtern und einem Papierkorb zum Entfernen. Hinzufügen und Entfernen gelten wie bisher sofort.
- **Einrichtungsassistent, "Fertig":** Aus "Wenn du mehr willst" wird "Weitere Funktionen", eine Liste zur Information statt Kacheln, die anklickbar aussahen: Routinen, Codes pro Person, HealthCheck und die Dashboard-Karte, je mit dem Ort, wo sie stehen. Darunter schliesst "Konfiguration öffnen" den Assistenten wie "Fertig" ab und öffnet Konfiguration › Anlage.
- **Einrichtungsassistent, Testmeldung im Schritt "Meldungen":** Der Hinweis sagt nicht mehr "(speichert diesen Schritt zuerst)". Der Knopf speichert offene Änderungen der Seite wie bisher selbst; separat speichern muss man nichts.

### Behoben

- **Einrichtungsassistent:** Wer beim Schritt "Überwachung" "Später" wählte, landete am nächsten Tag bei "Fertig" statt bei "Überwachung", weil der Schritt ausgeblendet war, solange die Messwerte noch luden. Jetzt geht es genau dort weiter.

## [1.69.0] - 2026-11-20

### Hinzugefügt

- **Einrichtungsassistent:** eine neue Anlage öffnet von selbst einen Einrichtungsassistenten, einmal, beim ersten Mal, wenn das Panel sie zeigt (im Panel oder unter Einstellungen › Geräte & Dienste hinzugefügt). Er fragt nur das Wichtigste und erklärt unterwegs: **Modi** (Anwesend, Abwesend, Nacht, dazu Rauch, Wasser und Gas immer aktiv), **Sensoren** (alle passenden Sensoren von Home Assistant mit Filtern und Suche), **Zuordnung und Eingang** (die Sensortabelle aus Konfiguration › Sensoren, vorbelegt nach Sensorart: Türen und Fenster in jedem Modus, Bewegung nur bei Abwesend, Rauch, Wasser und Gas immer; die Eingangstür, die Zeit zum Verlassen und die Zeit zum Deaktivieren), **Code** (freiwillig; mit dem eigenen Benutzer vorbelegt), **Meldungen** (Empfänger der Alarm- und der Wartungsmeldungen, ein Schalter je Meldung, eine Testmeldung), **Alarmaktionen** (der Editor aus Konfiguration › Aktionen, dazu schnell hinzuzufügen "Sirene 3 Minuten" und "Alarmton") und **Überwachung** (nur, wenn es passende Messwert-Sensoren gibt). "Fertig" fasst alles zusammen, mit "Ändern" je Schritt, einem Test der Alarmaktionen, einer Testmeldung und "Bereit zum Scharfschalten" je Modus.
  - Jeder Schritt wird mit "Weiter" gespeichert, über dasselbe Speichern wie die Reiter der Konfiguration. Am Computer zeigt links eine Schrittliste, was erledigt ist, auf dem Handy ein Fortschrittsbalken.
  - "Später" fragt "Morgen wieder anzeigen" (am nächsten Tag öffnet er genau beim Schritt, bei dem du aufgehört hast) oder "Nicht mehr anzeigen".
  - Ein neues Kapitel "Einrichtungsassistent" unter Konfiguration › Anlage, direkt vor "Anlage löschen", zeigt, wo er steht, und startet ihn erneut, bei diesem Schritt oder von vorn, mit allem, was eingerichtet ist, vorgewählt.
  - Anlagen, die es vor diesem Update gab, und Anlagen aus einem Backup bekommen ihn nicht von selbst. Sein Stand gehört nicht ins Backup und verschwindet mit der Anlage.

### Geändert

- **Anlage im Panel hinzufügen** öffnet jetzt den Einrichtungsassistenten der neuen Anlage (bisher: Konfiguration › Sensoren). "Später" führt wie bisher dorthin.
- **Konfiguration › Benachrichtigungen, neues Design:** Jede Meldung unter "Störungsmeldungen" und "Wartungsmeldungen" ist eine Karte wie die festen Meldungen unter Konfiguration › Aktionen: Schalter, Symbol in der Farbe ihres Kapitels (Störungsmeldungen rot, Wartungsmeldungen orange, ausgeschaltet grau), Titel, eine Kurzfassung (an wen, kritisch, die eigenen Einstellungen wie "unter 20 % · nach 3 Prüfungen"), Play (Testmeldung) und Stift. Der Stift öffnet ein Fenster mit allen Einstellungen der Meldung: "Meldung senden", Empfänger, Zustellung (Kritisch mit Lautstärke, "in Home Assistant stehen lassen") und die eigenen Einstellungen der Meldung. Zahlen sind einheitlich: Beschriftung links, Feld und Einheit rechts in einer Flucht, der Hinweis darunter. "Übernehmen" überträgt die Änderungen auf die Seite; gespeichert wird wie bisher nur mit "Speichern" unten. Eine geänderte Karte zeigt "Noch nicht gespeichert" mit dem orangen Punkt, wie überall im Panel; "Abbrechen", X und Escape fragen, bevor sie Änderungen im Fenster verwerfen. Am Computer stehen die Karten in zwei Spalten, auf dem Handy in einer. "Einstellungen pro Modus" bleibt oben bei den Störungsmeldungen.
- **Meldungen der HealthCheck-Dienste:** jetzt eine Wartungsmeldung "HealthCheck-Dienst antwortet nicht" unter Konfiguration › Benachrichtigungen › Wartungsmeldungen, aufgebaut wie "Selbsttest": Schalter, Empfänger (Standard: die der Wartung), Kritisch mit Lautstärke, "in Home Assistant stehen lassen", Testmeldung, dazu "Meldung nach … Fehlversuchen" (1 bis 10, Standard 2) und "Melden, wenn er wieder antwortet" (Standard an; dieselben Empfänger, nie kritisch, ersetzt die Meldung "antwortet nicht"). Die Texte sind fest; das Kapitel "HealthCheck-Dienste" mit eigenen Texten und Klickziel entfällt. Einstellungen aus 1.68.0 werden übernommen (an/aus, Empfänger, Kritisch, Lautstärke, "stehen lassen", die Zahl und an/aus von "antwortet wieder").
- **Protokoll der HealthCheck-Dienste:** Der Kopf zeigt statt "Bearbeiten" die runden Knöpfe der Liste: "Fehler senden", "Lebenszeichen senden" und den Stift, mit denselben Symbolen und in derselben Reihenfolge. Nach dem Senden lädt das Protokoll neu, mit dem neuen Aufruf.

## [1.68.0] - 2026-11-19

### Hinzugefügt

- **Protokoll der HealthCheck-Dienste:** Ein neuer runder Knopf "Protokoll" als erster Knopf in jeder Zeile der HealthCheck-Dienste öffnet das Protokoll dieses Dienstes, aufgebaut wie die Sensoransicht. Oben der Name als Auswahl zum Wechseln zwischen den Diensten (je in der Farbe seines Zustands und seit wann), der Zustand und "Bearbeiten". Drei Kacheln: **Verlauf**, **Antwortzeit** und **Dienst**; der Zeitraum reicht von 3 Stunden bis 1 Jahr.
  - **Verlauf:** bis 1 Tag ein "Herzschlag" mit einem Balken je Aufruf oder Abschnitt (Höhe: Antwortzeit, Farbe: Lebenszeichen, Fehler gemeldet, gescheitert, Test; grau, wo es keine Daten gibt, weil Home Assistant aus war) und darunter ein Band, das den Zustand ohne Unterbruch zeigt. 7 Tage zeigen eine Zeitleiste je Tag, 30 Tage ein Raster aus Tagen und Stunden wie bei den Bewegungsmeldern, 90 Tage und 1 Jahr ein Raster aus Monaten und Tagen (eine Zelle je Tag, grau bei einer Lücke von mehr als 30 Minuten) mit der Zahl der Tage mit Ausfall, mit Fehlermeldung und mit Lücke. Kennzahlen: erfolgreich in Prozent, Lebenszeichen, gescheitert, Fehler gemeldet, Antwortzeit im Mittel.
  - **Antwortzeit:** eine Linie mit den Zonen schnell (bis 300 ms), langsam und sehr langsam (über 1 s) und eine gestrichelte rote Marke bei jedem gescheiterten Aufruf; Kennzahlen aktuell, im Mittel, langsamster Aufruf, ohne Antwort.
  - **Dienst:** Name, erkannter Dienst, die ganze Ping-URL, Fehler-Zusatz, Aufruf bei Fehler, Intervall, Zustand, letzter Aufruf und seit wann das Protokoll aufzeichnet, je mit Knopf zum Kopieren.
  - **Listen "Ereignisse" und "Alle Aufrufe":** Ereignisse sind gescheitert (aufeinanderfolgende Fehler als ein Ereignis mit ihrer Anzahl), Fehler gemeldet wegen des Selbsttests (mit der Zahl der Probleme), Test, wieder in Ordnung und das erste Lebenszeichen nach einem Start; alle Aufrufe zeigen Ergebnis, Antwortzeit und Auslöser. Beide folgen genau dem oben gewählten Zeitraum, und die Zahl am Reiter ist die Zahl der Liste. Einzelne Aufrufe bleiben 24 Stunden; ab 7 Tagen sagt die Liste, dass sie die letzten 24 Stunden zeigt. Suche und Sortierung nach jeder Spalte.
  - Aufbewahrt: einzelne Aufrufe 24 Stunden, Stundenwerte 30 Tage, Tageswerte und Ereignisse ein Jahr (höchstens 1000 Ereignisse je Dienst); bei 5 Minuten Intervall üblich rund 60 KB je Dienst, höchstens rund 160 KB. Geschrieben spätestens 10 Minuten nach einem Aufruf und beim Beenden von Home Assistant. Das Protokoll enthält nie die URL, ist nicht im Backup und verschwindet mit dem Dienst. Es beginnt mit diesem Update.
- **Statuskachel mit den HealthCheck-Diensten:** Sind Dienste eingerichtet, ist die Zeile des Selbsttests unten in der Statuskachel in der Mitte geteilt, ohne dass die Kachel höher wird: links der Selbsttest, rechts die Dienste, je mit farbigem Symbol (grün alle in Ordnung, orange Fehler gemeldet, rot gescheitert); ein Tipp öffnet den Selbsttest oder die Liste der Dienste. Ohne Dienste bleibt die Kachel wie bisher.
- **Meldungen der HealthCheck-Dienste:** Ein neues Kapitel "HealthCheck-Dienste" unter Konfiguration › Benachrichtigungen, immer da: "Meldung nach … gescheiterten Aufrufen" (1 bis 10 hintereinander, Standard 2; es zählt jeder automatische Aufruf (Intervall, nach dem Speichern, Wechsel des Selbsttests), nie der Testknopf) und die Meldungen "Dienst antwortet nicht" (einmal je Ausfall, auch über einen Neustart) und "Dienst antwortet wieder" (nur, wenn "antwortet nicht" hinausging). Jede wird eingestellt wie die festen Meldungen im Reiter Aktionen: Schalter, Testmeldung, eigener Titel und Text mit {name}, {host}, {reason}, {count} und {since} (nie die URL), Empfänger (Standard: die der Wartung), Kritisch mit Lautstärke, "bleibt in Home Assistant stehen" und das Ziel eines Tipps (Standard: die Liste der Dienste).

### Geändert

- **Batterie schwach erst nach mehreren Prüfungen:** Die Meldung "Batterie schwach" geht erst hinaus, wenn die Batterie bei mehreren Prüfungen der Wartung hintereinander unter der Schwelle liegt ("Meldung nach … Prüfungen", 1 bis 10, Standard 3; die Wartung prüft alle 15 Minuten, standardmässig also frühestens nach 30 Minuten). Ein Wert über der Schwelle beginnt neu. Ein einzelner falscher Wert eines Geräts, etwa "Batterie 1 %" bei einer Batterie mit 61 %, löst keine Meldung mehr aus. Die Statusentität und die Übersicht zeigen weiterhin sofort den aktuellen Wert.
- **Meldung des Selbsttests:** Ein gescheitertes Lebenszeichen eines HealthCheck-Dienstes geht nicht mehr über die Meldung "Selbsttest" hinaus (es hat jetzt eigene Meldungen); es bleibt ein Problem des Selbsttests und zählt in der Statuskachel mit.
- **Fenster der HealthCheck-Dienste:** Die Spalte der Knöpfe ist breiter, damit alle fünf runden Knöpfe auf dem Computer ihre volle Grösse behalten.
- **Was ist im Backup?** nennt das Protokoll der HealthCheck-Dienste bei dem, was nicht enthalten ist.

### Behoben

- **Sensoransicht, Batterie und Empfang:** Die Spalte "Änderung" der Liste zeigte Dezimalzahlen auf Deutsch mit Punkt ("+0.8 %"); jetzt in der Schreibweise der Sprache ("+0,8 %").

## [1.67.0] - 2026-11-19

### Hinzugefügt

- **Selbsttest alle paar Minuten:** "Selbsttest alle" unter Konfiguration › Anlage › HealthCheck nimmt für beide Abstände (nicht scharf, scharf) Minuten oder Stunden, von 5 Minuten bis 24 Stunden, etwa alle 5 Minuten, solange eine Anlage scharf ist. Der Standard bleibt 6 Stunden und 1 Stunde; in Stunden gespeicherte Abstände werden übernommen. Alarmageddon schaut jetzt jede Minute, ob eine Prüfung fällig ist (vorher alle 5 Minuten).
- **Was sind HealthCheck-Dienste?** Das Fenster der Dienste hat unter der Liste eine Erklärung zum Aufklappen, wie beim Selbsttest: was diese Dienste tun, wie der Fehler-Zusatz wirkt und wie man einen Check einrichtet, mit Healthchecks.io, Cronitor, Better Stack und Uptime Kuma als Beispielen.

### Geändert

- **Fenstertitel mit dem Symbol ihres Kapitels:** Routinen, Eigene Töne, Codes pro Person, HealthCheck-Dienste, Selbsttest, Geprüft und Backups, dazu ihre Formulare, zeigen im Titel dasselbe getönte Symbol wie ihre Zeile unter Konfiguration › Anlage, etwas grösser.
- **Abstände des Selbsttests untereinander:** "Nicht scharf" und "Scharf" stehen auch am Computer unter dem Text, wie auf dem Handy, je mit Feld und Einheit.
- **Formulare so breit wie die anderen Fenster:** Hinzufügen oder Bearbeiten eines HealthCheck-Dienstes oder eines Codes und Erstellen oder Wiederherstellen eines Backups haben am Computer die Standardbreite der Fenster (vorher schmaler als die Liste dahinter). Rückfragen wie "Entfernen?" bleiben schmal; auf dem Handy bleibt alles ganzer Bildschirm.

### Behoben

- **Sensoransicht, "seit" in der Kachel "Verlauf":** Nach einem Neustart von Home Assistant stand dort die Zeit des Neustarts ("in Ordnung seit 13:23", "ruhig seit 13:23"), weil Home Assistant dann die Zeit der letzten Änderung neu setzt. Jetzt steht dort die letzte echte Änderung zwischen offen und zu (bei Bewegung das Ende der letzten Bewegung, bei Rauch, Wasser und Ähnlichem das Ende der letzten Auslösung), für alle Sensorarten. "Nicht verfügbar" und "unbekannt" dazwischen (Neustart, Verbindungsabbruch) zählen nicht mehr. Ist der Sensor nicht erreichbar, gilt der Beginn des Ausfalls, auch über einen Neustart hinweg. Ist keine echte Änderung bekannt (ein Rauchmelder, der nie ausgelöst hat), steht nur der Zustand da, ohne Zeit.

## [1.66.1] - 2026-11-19

### Geändert

- **Gleiche Knöpfe in jedem Fenster mit Liste:** Codes pro Person, Eigene Töne und Backups haben je Zeile runde Knöpfe wie Routinen und die HealthCheck-Dienste; auf dem Handy stehen die Knöpfe der Backups in einer eigenen Zeile unter Name und Datum. "Schliessen" im Fenster der Backups ist weiss wie in allen anderen Fenstern.
- **Codes pro Person:** Die Spalte "Code" fällt weg. Sie zeigte nur "••••••"; ein Code ist als Hash gespeichert und lässt sich nie anzeigen.
- **Sensortabelle (Konfiguration › Sensoren):** Ein runder Stift am Ende jeder Zeile öffnet die Einstellungen des Sensors (vorher ein Pfeil), am Computer entfernt der runde Papierkorb daneben den Sensor. Auf dem Handy steht nur der Stift, wie bisher ohne Papierkorb.

### Behoben

- **Sensoransicht, Zahl der Ereignisse:** Die Zahl auf dem Reiter "Ereignisse" zählt immer die Ereignisse des oben gewählten Zeitraums, gleich wie die Liste. Bei mehr als 300 Ereignissen im Zeitraum stand dort 300 (die Länge der Liste); jetzt steht die echte Zahl, und der Hinweis unter der Liste sagt "Es werden die neuesten 300 von N Ereignissen im Zeitraum gezeigt".

## [1.66.0] - 2026-11-19

### Hinzugefügt

- **Selbsttest: kürzerer Abstand bei scharfer Anlage.** Neben dem Abstand für "nicht scharf" (Standard alle 6 Stunden) hat der Selbsttest einen zweiten, der gilt, solange eine Anlage nicht deaktiviert ist (Ausgangsverzögerung, scharf, Eingangsverzögerung, Alarm): Standard jede Stunde. Beide sind von 1 bis 24 Stunden einstellbar unter Konfiguration › Anlage › HealthCheck. Das Fenster des Selbsttests nennt den Abstand, der gerade gilt. Findet der Selbsttest ein Problem, bekommen die HealthCheck-Dienste sofort den Fehler-Aufruf; sie behalten darum ein Intervall.
- **Selbsttest: Liste von allem Geprüften.** Ein runder Pfeil im Fenster des Selbsttests (in "Keine Probleme gefunden" oder unter den Problemen) öffnet eine Liste von allem, was die letzte Prüfung angeschaut hat: jede Entität mit ihrem Namen (Sensoren der Anlagen und der Überwachung, Geräte in den Aktionen, Lautsprecher, Geräte, die Routinen auslösen), jede Aktion und jeder Empfänger, gruppiert, grün, wenn in Ordnung, mit Suche. "Schliessen" schliesst nur die Liste.
- **Backup: "Was ist im Backup?"** Eine Info-Zeile über der Karte des Backups klappt eine Liste auf, was ein Backup enthält und was nicht: Codes, das Protokoll (Alarme, Ereignisse, Aufzeichnungen der Alarme), Verlauf der Sensoren, Zustände und Ergebnisse sind nicht dabei; das Backup von Home Assistant selbst sichert alles.
- **HealthCheck: ein Name für jeden Dienst.** Jeder Dienst hat jetzt einen Namen (Pflichtfeld, bis 60 Zeichen), in der Liste zuerst, die URL gekürzt darunter (ganz im Tooltip und im Formular). Dienste aus 1.65.0 heissen wie der Rechner ihrer URL, bis du den Namen änderst.

### Geändert

- **Liste der HealthCheck-Dienste:** runde Knöpfe wie bei Routinen und Tönen; auf dem Handy stehen sie in einer eigenen Zeile unter dem Eintrag. "Schliessen" steht rechts neben "Dienst hinzufügen", wie in allen Fenstern mit Liste. Die Liste ist nach Name sortiert.
- **Fenster des Selbsttests:** "Schliessen" und "Jetzt prüfen" stehen rechts nebeneinander, wie in allen Fenstern.
- **Kapitel unter Konfiguration › Anlage:** Die Symbole von Routinen, Codes pro Person, Eigene Töne, den HealthCheck-Diensten und Backup haben je eine eigene, leichte Farbe; so heben sich die Kapitel ab. Nur das Symbol ändert sich; ein leeres Kapitel bleibt grau, der Selbsttest behält seine Farbe nach dem Ergebnis.
- **Meldung eines gescheiterten Lebenszeichens:** nennt den Dienst mit Namen und Rechner (nie die URL).
- **Zeitpunkt der Lebenszeichen:** Ein Lebenszeichen geht höchstens 10 Sekunden nach Ablauf seines Intervalls hinaus. Ein Lebenszeichen, das nach einem Wechsel des Selbsttests aufgeschoben ist, entfällt, wenn das reguläre zuerst hinausgeht; so gehen nie zwei Aufrufe kurz nacheinander hinaus.

### Behoben

- **Batterieprognose in der Sensorliste.** Bei manchen Sensoren stand in der Spalte "Prognose" "–", obwohl die Sensoransicht eine Prognose zeigte (etwa "~16 Monate" bei "1 Jahr"). Zwei Ursachen: Die Prognose umfasste nur die Sensoren der Zonen und "immer aktiv", Messwerte der Überwachung und Sensoren nur in der Liste bekamen nie eine; und sie rechnete nur mit dem Verlauf des Recorders, den Home Assistant standardmässig 10 Tage aufbewahrt, so bekam eine Batterie, die seit Wochen gleich stand oder zuletzt leicht stieg, keine Prognose. Die Liste umfasst jetzt alle ihre Sensoren und rechnet wie die Sensoransicht bei "1 Jahr", aus der Langzeitstatistik seit dem letzten Batteriewechsel.

## [1.65.0] - 2026-11-18

Enthält die Änderungen aus 1.64.0.

### Hinzugefügt

- **Selbsttest.** Alarmageddon prüft sich jetzt regelmässig selbst: Gibt es alle Geräte, Lautsprecher, Aktionen (Dienste), Empfänger und eigenen Töne noch, die die Aktionen, die Regeln der Überwachung, die Routinen und die Benachrichtigungen verwenden, und sind sie erreichbar? Gibt es die Sensoren der Anlagen noch, und hat Home Assistant eine Adresse für die Lautsprecher? Im Betrieb hält er zudem Schritte fest, die scheiterten oder nicht antworteten, Meldungen, die nicht hinausgingen, Teile, die nicht starteten, ein gescheitertes automatisches Backup und Lebenszeichen an die HealthCheck-Dienste, die nicht hinausgingen. Ein Gerät, das ein Schritt schaltet (Sirene, Schalter, Lautsprecher), zählt, sobald es seit fünf Minuten nicht erreichbar ist; nicht erreichbare Sensoren melden weiterhin die Wartungsmeldungen (keine doppelte Meldung). Der Selbsttest liest nur: er schaltet nie etwas, spielt keinen Ton, sendet keine Testmeldung und hält nie einen Alarm auf.
  - **Wann:** wenige Minuten nach dem Start von Home Assistant, kurz nach jedem Speichern, alle 6 Stunden (einstellbar von 1 bis 24 Stunden unter Konfiguration › Anlage › HealthCheck) und mit "Jetzt prüfen".
  - **Wo:** Die Statuskachel der Übersicht zeigt immer eine Zeile mit der letzten Prüfung; Probleme zählen bei "N brauchen Aufmerksamkeit" mit. Ein Klick öffnet ein Fenster mit allen Problemen, je Anlage: was los ist, wo (mit "Öffnen", das dorthin springt), was es bedeutet, mögliche Ursachen und wie man es behebt. Jede Anlage bekommt eine neue Entität "Selbsttest" (Problem, Diagnose), die Statusentität und die Infokarte zählen die Probleme mit, und Home Assistant zeigt sie unter Reparaturen (eine Meldung je Anlage und eine für alle).
  - **Meldung:** neue Wartungsmeldung "Selbsttest", einzeln ein- und auszuschalten und einzustellen wie die anderen (Empfänger, kritisch, in Home Assistant); jedes Problem wird einmal gemeldet, erneut erst, wenn es nach dem Beheben wiederkommt.
  - **Verschwinden:** Ein Problem der Einrichtung verschwindet von selbst, sobald es behoben ist. Ein Problem im Betrieb verschwindet, sobald derselbe Aufruf wieder klappt (im Alarm oder im Test), oder mit "Erledigt" im Fenster.
- **HealthCheck: Lebenszeichen an externe Dienste.** Neues Kapitel unter Konfiguration › Anlage, für alle Anlagen: der Selbsttest (letzte Prüfung, "Jetzt prüfen", "Probleme anzeigen", Abstand) und bis zu fünf Dienste wie Healthchecks.io, Cronitor, Better Stack oder Uptime Kuma, die Alarmageddon regelmässig aufruft. Fällt Home Assistant aus oder verliert es das Internet, bleiben die Lebenszeichen aus, und der Dienst meldet sich, unabhängig von Home Assistant.
  - **Generisch:** Jeder Eintrag hat eine Ping-URL (http oder https), einen Fehler-Zusatz (freiwillig) und ein Intervall von 1 Minute bis 24 Stunden (Zahl und Einheit oder eine Schnellwahl). Solange der Selbsttest Probleme hat, ruft Alarmageddon stattdessen die URL mit dem Fehler-Zusatz auf ("/…" verlängert den Pfad, "?…" oder "&…" setzt Parameter); ohne Zusatz geht nur das Lebenszeichen hinaus. Ein Wechsel des Selbsttests geht sofort hinaus, höchstens einmal je Minute und Dienst.
  - **Vorschläge, nie eine Wahl für dich:** Bei bekannten Diensten (Healthchecks.io, Better Stack, Cronitor, Uptime Kuma) erkennt das Formular die URL und schlägt den Fehler-Zusatz vor. Er wird nur eingetragen, solange du das Feld nicht berührt hast; sonst steht der Vorschlag mit "Übernehmen" daneben. Eine Vorschau zeigt den genauen Aufruf bei Fehler.
  - **Liste im Fenster** wie Töne, Routinen und Codes: Tabelle mit Suche und Sortierung (URL, Zuletzt, Intervall, Status), je Zeile "Fehler senden" und "Lebenszeichen senden" als Test, Bearbeiten und Entfernen. Die Zeile im Kapitel zeigt, wie viele Dienste eingerichtet sind und ob ein Lebenszeichen gescheitert ist.
  - **Sicherheit:** Die Ping-URL steht ganz im Panel und im Backup (sie ist deine Einstellung); Log, Meldungen und Probleme des Selbsttests nennen nur den Rechnernamen. Ein Lebenszeichen wartet höchstens 10 Sekunden und hält nie etwas auf. Ein Lebenszeichen, das nicht hinausgeht, wird ein Problem des Selbsttests ("Öffnen" führt zur Liste); für das nächste Lebenszeichen zählt es nicht als Fehler.
- **Sensoransicht: Reiter "Ereignisse" und "Regeln" für jeden Sensor der Überwachung.** Messwerte und Ja/Nein-Sensoren, die in einer Regel der Überwachung vorkommen, zeigen unter der Grafik zwei Reiter. "Regeln" listet die Regeln der Überwachung mit diesem Sensor (alle Anlagen) mit der Bedingung in Worten und dem Zustand "Aktiv", "Aus" oder "Ausserhalb". Beide Listen lassen sich durchsuchen und nach jeder Spalte sortieren. Der Pfeil einer Regel öffnet sie unter Konfiguration › Aktionen › Überwachung, aufgeklappt und kurz markiert; offene Änderungen an einer anderen Anlage fragen vorher nach.

### Geändert

- **Jede Grenze ist in der Grafik zu sehen.** Bisher fiel eine Grenze weit weg von den Werten ohne Hinweis weg (ein Kühlschrank mit 5 °C zeigte für eine Grenze von 14 °C keine Linie); jetzt reicht die Grafik immer bis zu ihr.

### Behoben

- **Hinweis des Kapitels "Wartungsmeldungen".** Er nannte noch Updates, die Alarmageddon seit 0.27.0 nicht mehr prüft; jetzt nennt er den Selbsttest.

## [1.64.0] - 2026-11-18

Nicht veröffentlicht; enthalten in 1.65.0.

### Hinzugefügt

- **Codes pro Person: "Code hinzufügen" direkt auf der Seite.** Wie bei den Routinen und den eigenen Tönen steht links "Code hinzufügen" und rechts "Codes anzeigen". Es öffnet dasselbe Fenster wie "Code hinzufügen" in der Liste; bei 20 Codes ist der Knopf gesperrt.
- **Anlage hinzufügen: Entitäts-ID kopieren.** Ein Knopf direkt neben der Alarm-Entität (zum Beispiel `alarm_control_panel.garage`) kopiert sie in die Zwischenablage, mit einem Häkchen als Rückmeldung. Es ist derselbe Knopf wie in der Sensoransicht, wo sich Werte schon kopieren liessen.

### Geändert

- **Jeder Knopf "… anzeigen" hat ein eigenes Symbol.** Routinen behalten die Liste, eigene Töne den Lautsprecher, Codes bekommen einen Schlüssel und Backups eine Archivkiste; bisher hatten Routinen, Codes und Backups dasselbe Listensymbol. Das Plus von "… hinzufügen" bleibt überall gleich.
- **Die Zeilen "Routinen", "Eigene Töne" und "Codes pro Person" sind gleich aufgebaut.** Auf dem Handy sind die beiden Knöpfe einer Zeile gleich breit, wenn sie nebeneinander Platz haben.
- **Kapitel "Backup" wie die anderen.** Oben steht "Letztes Backup" mit "Backup erstellen" und "Backups anzeigen" nebeneinander in einer Zeile, darunter das automatische Backup; der Hinweis steht über der Karte. Bisher standen die beiden Knöpfe in zwei Zeilen.
- **Deutsch heisst es durchgängig "Backup".** Das Panel mischte bisher "Sicherung" und "Backup" (zum Beispiel "Sicherung (alle Anlagen)" neben "Backup erstellen"); jetzt sagt es überall "Backup", auch in den Fenstern, Hinweisen und Fehlermeldungen und beim Löschen einer Anlage. Englisch ist unverändert.
- **Die Reiter der Modi sehen überall gleich aus.** In den Reitern Sensoren, Benachrichtigungen und Anlage, und in den Aktionen ohne Überwachung, sehen die Reiter der Modi jetzt aus wie in den Aktionen mit Überwachung: Symbole im Dunkelrot der Zone "Alarm" ("Überwachung" orange), der gewählte Reiter mit rotem Rand, der Text neutral statt blau.

### Behoben

- **Sensoransicht: der Stand eines Ereignisses der Überwachung im Format der Sprache.** Auf Deutsch stand "9.2 °C" statt "9,2 °C".

## [1.63.0] - 2026-11-17

### Hinzugefügt

- **Play-Knopf auf jeder festen Meldung.** Die Karten "Scharf geschaltet", "Stiller Alarm", "Eingangsverzögerung", "Deaktiviert" und die Abschlussmeldung haben vor dem Stift einen Play-Knopf: Er sendet eine Testmeldung mit den Werten der Karte, auch ungespeichert. Ist die Meldung ausgeschaltet, ist er gesperrt.
- **Die Abschlussmeldung lässt sich ausschalten.** Ihr Schalter steht jetzt aussen auf der Karte wie bei den anderen festen Meldungen; im Fenster heisst er "Meldung senden". Aus: Wenn der Alarm endet, geht keine Meldung hinaus, die Alarmmeldung bleibt dann auf dem Handy stehen. Bisher ging "Alarm beendet" immer hinaus.
- **Codes pro Person: Code bearbeiten.** Der Stift öffnet dasselbe Fenster wie "Code hinzufügen", Name und Benutzer stehen drin. Leer gelassen behalten die Codefelder den bisherigen Code; ein neuer Code ersetzt ihn. Es gelten dieselben Regeln wie beim Hinzufügen (kein Code, Name oder Benutzer einer anderen Person).
- **Codes pro Person: ein Auge in den Codefeldern** blendet den gerade getippten Code ein und wieder aus. Gespeicherte Codes lassen sich nicht anzeigen: gespeichert ist nur ein Hash.
- **Codes pro Person: Warnung bei leicht zu erratenden Codes.** Rot und fett mit Achtung-Zeichen unter den Codefeldern: Zahlenfolgen (1234, 2468), nur eine Ziffer (0000), wiederholte Muster (1212, 1122), drei gleiche Ziffern hintereinander, Spiegelzahlen (1221), Linien auf dem Tastenfeld (2580), Jahreszahlen (1987) und Daten (24121990); während des Tippens weniger als 4 Ziffern "Zu kurz". Speichern bleibt möglich; Codes mit weniger als 4 oder mehr als 8 Ziffern werden wie bisher abgelehnt.

### Geändert

- **Jeder Play-Knopf verhält sich gleich.** Beim Drücken wird er rot und zum Stopp-Knopf, überall im Panel: Schritt testen, "Testen" unten, feste Meldungen, Test im Fenster einer Meldung, Probehören eines Tons, eigene Töne, Schritt der Überwachung, Testmeldung im Reiter Benachrichtigungen. Bisher wurde das Probehören blau, der Test der Überwachung blieb ein Play-Knopf, und die Testmeldungen zeigten gar nichts. Eine Testmeldung ist nach dem Senden schon unterwegs: Ihr Knopf bleibt rot, bis der Server geantwortet hat, mindestens 1,5 Sekunden; Stopp beendet dort nur die Anzeige.
- **Die Abschlussmeldung ist aufgebaut wie die anderen festen Meldungen.** "Meldung: Abschlussmeldung", darunter die Empfänger, kritisch und "eigener Text", dasselbe Glockensymbol. Im Fenster gibt es keinen zweiten Schalter "eigene Meldung" mehr: Titel und Text stehen gleich da, leer gilt der Standardtext. Bestehende Einstellungen bleiben, wie sie sind.
- **"Meldungen" heisst "Störungsmeldungen".** Das Kapitel im Reiter Benachrichtigungen enthält seit 1.62.0 nur noch "Scharfschalten nicht möglich" und "Sensor im scharfen Zustand nicht erreichbar"; darunter folgt "Wartungsmeldungen".
- **Eigene Töne: ein eigener Knopf "Hochladen" für die Datei.** Statt des Felds des Browsers ("Choose File", auf dem iPhone mit einem leeren Viereck vor dem Namen) steht ein Knopf im Stil des Panels mit Upload-Symbol, daneben der Name der Datei. Der Knopf unten heisst "Speichern".
- **Fenster "Routinen", "Eigene Töne", "Sicherungen" und "Codes pro Person": Titel und Suchfeld bleiben beim Scrollen oben stehen.** Die Liste läuft darunter durch, der Abstand vom Suchfeld zur Liste bleibt immer gleich. Bisher scrollte das Suchfeld mit und wurde auf dem Handy am oberen Rand halb abgeschnitten.
- **Codes pro Person im Fenster.** Die Seite behält die Zusammenfassung mit "Codes anzeigen", den Hauptcode und "Quittieren verlangt den Code". Das Fenster (auf dem Handy als Vollbild) zeigt eine Tabelle mit Name, Benutzer und Code, sortierbar nach Name und Benutzer, mit einem Suchfeld, das oben stehen bleibt; der Code steht nur als "••••••" da. "Code hinzufügen" steht in der Fusszeile, Stift und Papierkorb in jeder Zeile. Unter 360 Pixel Breite fällt die Spalte Code weg.
- **Reiter "Überwachung": der Schalter "Einstellungen pro Modus" steht auch hier.** Bisher hielt ein leerer Platz seine Stelle frei. Die Reiterzeile steht in allen Reitern an derselben Stelle; wer im Reiter "Überwachung" umschaltet, bleibt dort.
- **Aktions-Gruppe: "Wiederholen bis deaktiviert" fällt mehr auf.** Wie die Gruppe wiederholt, steht in der Kopfzeile etwas grösser und fett.
- **Anlage in Home Assistant hinzufügen: ein vergebener Name wird wie im Panel abgelehnt.** Gross- und Kleinschreibung und doppelte Leerzeichen machen keinen anderen Namen mehr ("haus" neben "Haus" war möglich); der Dialog zeigt den Fehler beim Namen, statt abzubrechen.
- **Der Hauptcode kann nicht mehr derselbe sein wie der Code einer Person.** In den Optionen der Integration wird ein neuer Hauptcode, der einer Person gehört, abgelehnt; "geändert von" bliebe sonst leer. Beim Hinzufügen eines persönlichen Codes wurde der Hauptcode schon abgelehnt.
- **Speichern der Zonen behält die Zone eines Modus, der in der Anfrage fehlt.** Das Panel sendet immer alle Modi; betroffen waren nur andere Aufrufer.
- **Dashboard-Karte: weniger Arbeit bei jeder Zustandsänderung im Haus.** Die Karte sucht die Entitäten ihrer Anlage nur, wenn sich die Registrierung der Entitäten ändert.
- **Ein Knopf, der etwas sendet, nimmt bis zur Antwort keinen zweiten Druck an.** "Speichern" beim Hinzufügen und Bearbeiten eines Codes, "Sichern" einer Sicherung, "Wiederherstellen" und das Umbenennen eines eigenen Tons. Ein Doppelklick schickte bisher alles zweimal (zwei gleiche Sicherungen, ein zweiter Import).
- **Weniger Abfragen nach einem Verbindungsabbruch.** Das Panel versucht es alle 5 Sekunden wieder, mit einer Abfrage. Bisher plante jede gescheiterte Abfrage eine eigene Wiederholung: nach einer Stunde ohne Verbindung liefen rund 120 nebeneinander, und alle kamen bei der Rückkehr der Verbindung zugleich bei Home Assistant an.
- **Fehlertexte der Zahlenfelder nennen die richtige Einheit.** Erinnerung einer Regel der Überwachung in Stunden, der Schritt "Warten" der Überwachung in Minuten oder Sekunden (bis 60 Minuten oder 3600 Sekunden), die Anzahl automatischer Sicherungen als Zahl. Bisher hiess es überall "Sekunden", beim Schritt "Warten" "von 0 bis 60".
- **Die Geräteauswahl von Routinen und Überwachung lädt mit den drei Punkten** wie überall im Panel, statt mit dem Text "Geräte werden geladen ...".
- **Screenreader nennen die Zahlenfelder im Reiter Anlage beim Titel** ("Ausgangsverzögerung") statt beim internen Schlüssel ("exit_delay").

### Behoben

- **Handy: Zeilen "Routinen" und "Eigene Töne" im Reiter Anlage.** Die Knöpfe drückten die Zusammenfassung auf die Breite null, der Text lief Wort für Wort unter die Knöpfe ("3 Ro…", auch mit "Änderungen noch nicht gespeichert"). Auf dem Handy stehen die Knöpfe jetzt unter dem Text.
- **Handy: Play und Stift der festen Meldungen** stehen unter dem Text wie bei den Schritten; daneben war für "Meldung: Abschlussmeldung" zu wenig Platz.
- **Reiter Benachrichtigungen: der Hinweis auf den neuen Ort der Meldungen klebte** an der Karte darüber und am nächsten Kapitel. Er hat jetzt Abstand.
- **Eine beschädigte Routine hält die Anlage nicht mehr vom Laden ab.** Bisher wurden nur einige Fehler abgefangen; ein Auslöser, der sich nicht lesen liess, liess die ganze Anlage ungeladen. Die übrigen Routinen laufen.
- **Ein beschädigter Verlauf des Empfangs oder der Sensorstatistik hält die Aufzeichnung nicht mehr an.** Bisher wurde bis zum Neustart von Home Assistant nichts aufgezeichnet, und die Sensoransicht zeigte bei jedem Sensor einen Fehler.
- **Wiederherstellen einer Sicherung in eine neue Anlage, deren Einrichtung scheiterte,** bricht nicht mehr mitten drin mit einem Fehler ab.
- **Gleichzeitig erstellte oder gelöschte Sicherungen verlieren keine Änderung mehr** (automatische Sicherung und Panel).
- **Zwei gleichzeitig hochgeladene Töne** können nicht mehr denselben Namen bekommen oder die Grenze überschreiten.
- **Doppelklick auf "Speichern" beim Hinzufügen eines Codes legte den Code zweimal an** (dieselbe Person mit demselben Code zweimal). Hinzufügen, Bearbeiten und Entfernen von Codes laufen je Anlage jetzt nacheinander; gleichzeitiges Bearbeiten und Entfernen holt einen entfernten Code nicht mehr zurück.
- **Sensoransicht, Reiter "Gerät": "Immer aktiv" nur dort, wo es gilt.** Es stand bei jeder Anlage, deren Sensorart "Immer aktiv" voreingestellt hat, auch wenn der Sensor gar nicht zu dieser Anlage gehörte oder "Immer aktiv" dort ausgeschaltet war. Die Ansicht rechnet jetzt wie die Liste der Übersicht.
- **Tastatur nach dem Ziehen über die Kästchen im Reiter Sensoren:** die erste Leertaste oder Eingabetaste auf einem Kästchen bewirkte nichts.

## [1.62.0] - 2026-11-17

### Hinzugefügt

- **Feste Meldungen im Reiter Aktionen.** "Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung" und "Stiller Alarm" stehen jetzt als festes Element an ihrem Punkt im Ablauf, wie die Abschlussmeldung unter "Alarm endet": immer da, mit einem Schalter zum Ein- und Ausschalten und einem Stift für die Einstellungen. Sie gelten je Alarmanlage und, mit "Einstellungen pro Modus", je Modus; im Reiter "Immer aktiv" gibt es nur "Stiller Alarm". Als Empfänger sind die Standard-Empfänger aus den Benachrichtigungen vorgewählt, eigene Empfänger lassen sich je Meldung wählen.
- **Eigener Titel und Text für diese Meldungen.** Im Fenster der Meldung: Titel und Text mit Platzhaltern, darunter neu {person} (wer scharf geschaltet oder deaktiviert hat) und {delay} (die Zeit der Eingangsverzögerung), mit Vorschau. Leer gilt der bisherige Standardtext. Dazu wie bisher kritisch mit Lautstärke und "in Home Assistant stehen lassen", neu das Klickziel und eine Testmeldung mit den Werten aus dem Fenster.
- **Neues Kapitel "Bei einem stillen Alarm" mit eigenen Aktionen.** Vor dem Kapitel "Bei einem Alarm". Spricht ein Sensor mit der Option "Stiller Alarm" an, geht die Meldung hinaus, und die Aktionen darunter laufen: Aktivierungston, Gerät schalten, Warten, Szene, eigene Aktion, auch in einer Gruppe. Es gibt dabei nie einen Alarm, darum auch keine Sirene und keine Alarmmeldung. Sie laufen je Sensor höchstens einmal je Minute, für den Modus, in dem die Anlage scharf ist; für immer aktive Sensoren gilt die Liste im Reiter "Immer aktiv". Ein Alarm, ein Test und eine laufende Ein- oder Ausgangsverzögerung haben Vorrang; ein Alarm oder Deaktivieren beendet sie sofort. Geräte werden nicht zurückgestellt.
- **Vorschau einer Routine.** Im Fenster "Routinen" hat jede Zeile ein Auge. Es zeigt die Routine so, wie sie der Editor ganz unten zeigt (Auslöser, Prüfung des Zustands, Aktion), nur zum Lesen, im selben Fenster und auf dem Handy als Vollbild. "Schliessen" führt zurück zur Liste (die Suche bleibt), "Bearbeiten" öffnet den Editor.
- **Eine Gruppe zeigt, dass sie sich wiederholt.** Links neben den Aktionen einer Gruppe führt ein dünner gestrichelter Bogen vom letzten Schritt zurück zum ersten.

### Geändert

- **Die vier Meldungen stehen nicht mehr im Reiter Benachrichtigungen.** Ein Hinweis dort nennt den neuen Ort. Deine bisherigen Einstellungen gelten weiter: Solange eine Alarmanlage für einen Modus nichts Eigenes gespeichert hat, sendet sie diese Meldungen genau wie vor dem Update (ein/aus, kritisch, Lautstärke, eigene Empfänger, auch die Werte je Modus). Der Reiter Aktionen zeigt diesen Stand. Erst was du dort speicherst, gilt für diese Anlage und diesen Modus.
- **"Empfänger" heisst "Standard-Empfänger".** Das Kapitel im Reiter Benachrichtigungen; die Meldungen im Reiter Aktionen nennen sie ebenso.
- **"Aktionen übernehmen von …" nimmt die festen Meldungen und die Aktionen bei einem stillen Alarm mit.** Von einem Modus nach "Immer aktiv" und umgekehrt nur die Meldung "Stiller Alarm".
- **Die Sicherung enthält die festen Meldungen und die Aktionen bei einem stillen Alarm.** Eine ältere Sicherung lässt sich wie bisher einspielen; ihre Anlagen melden dann nach den gemeinsamen Einstellungen.

### Behoben

- **Fenster einer Meldung auf dem Handy: das Auswahlfeld "Klickziel" ragte über den Rand.** Auf Deutsch war es breiter als seine Karte (im Fenster der Abschlussmeldung und der Alarmmeldung). Es bleibt jetzt in der Karte.

## [1.61.0] - 2026-11-17

### Geändert

- **Zeiten sehen überall gleich aus.** Ab 60 Sekunden steht eine Zeit in Minuten und Sekunden, ab einer Stunde mit Stunden; Teile, die null sind, entfallen ("45 s", "1 min 30 s", "2 min", "1 h 5 min"). Vorher konnte dieselbe Zeit auf einer Karte "120 s" und auf der nächsten "2 min" heissen, und eine Stunde Gruppenzeit hiess "60 min". Es gilt für die Karten der Aktionen (Warten, Tonlänge, "Rückgängig nach", Gruppe), die Schnellwahl im Editor, die Verzögerungen, die Kurzfassung der Überwachungsregeln (Haltezeit, Erinnerung, früher "30 Min." und "2 Std."), die Routinen, die Länge eines hochgeladenen Tons, die Zeitachse eines Alarms und die Push-Meldung "Alarm in 2 min" während der Eingangsverzögerung. Eingabefelder zählen weiter in Sekunden.

## [1.60.0] - 2026-11-17

### Hinzugefügt

- **"Nach einer Zeit rückgängig machen" auch in einer Aktions-Gruppe.** Die Option von "Gerät schalten" (zum Beispiel eine Steckdose mit Sirene: ein, nach 2 Minuten aus) gab es in einer Gruppe nicht. Jetzt gibt es sie dort wie überall. In einer Gruppe gilt je Gerät nur ein vorgemerktes Zurückschalten, und jede Runde beginnt die Zeit neu: Ist die Runde länger als die Zeit, schaltet das Gerät in jeder Runde nach der Zeit zurück. Ist sie kürzer, schaltet es erst zurück, wenn keine Runde es mehr schaltet, also nach der letzten Runde. Deaktivieren, Quittieren und "Alarmton stumm" schalten wie bisher sofort zurück. Das Fenster des Schritts sagt das in der Gruppe dazu.
- **Suchfeld in den Fenstern "Routinen", "Eigene Töne" und "Sicherungen".** Über jeder Liste steht ein Suchfeld. Es findet alles, was die Zeile zeigt (Name, Auslöser und Wirkung in Worten, Marken wie "Umgeht den Code", Länge und Grösse eines Tons, Datum und Anlagen einer Sicherung), bei Routinen auch die Entitäts-IDs der Geräte, zum Beispiel "lock.haustuer". Mehrere Wörter müssen alle vorkommen, Gross- und Kleinschreibung zählen nicht. Die Knöpfe einer gefundenen Zeile wirken wie gewohnt.
- **Filter "Nur automatische" bei den Sicherungen.** Neben dem Suchfeld; zeigt nur die automatischen Sicherungen und lässt sich mit der Suche verbinden.

### Geändert

- **Die Übersicht hält Home Assistant nicht mehr an.** Auf neueren Versionen von Home Assistant (gemessen an 2026.10.4 und 2026.11.1) stand bei jedem Abruf der Übersicht ganz Home Assistant still: an einer echten Anlage mit 151 Sensoren rund 1,4 Sekunden, beim Öffnen des Panels und danach alle 30 Sekunden. Ursache: Alarmageddon las je Sensor zweimal ein Feld der Geräte-Registry, das Home Assistant dort nur noch als veraltete Brücke führt, und jeder Zugriff darauf kostet mehrere Millisekunden. Mit eingeschalteter Überwachung zählte jede Temperatur und Luftfeuchtigkeit des Hauses mit, darum wurde es mit den Messwerten spürbar. Jetzt wird das neue Feld gelesen, und Empfang und Hardware je Gerät nur einmal. Im Test mit 151 Sensoren sinkt der Abruf von rund 250 auf rund 6 Millisekunden. Dasselbe traf einmal je Minute die Aufzeichnung des Empfangs.
- **Die Antwort für die Übersicht ist kleiner.** Sie nennt nur noch die Sensoren der Anlagen. Die Liste aller passenden Sensoren des Hauses holt das Panel erst, wenn du "Sensoren hinzufügen" öffnest (dort kurz mit der Ladeanzeige). In einem Haus mit 400 Geräten sind das rund 14 kB statt 475 kB, bei jedem Öffnen der Übersicht und danach alle 30 Sekunden.
- **Wechselnde Messwerte bauen die Liste nicht mehr laufend neu.** Seit 1.58.0 übernimmt das Panel neue Zustände viermal je Sekunde; jede Änderung irgendeines passenden Sensors des Hauses baute dabei die ganze Sensorliste neu auf. Jetzt zählen nur Sensoren, die zu sehen sind. Zustände (Tür offen, Bewegung, Alarm) erscheinen weiterhin sofort; Messwerte, Batterie und Empfang werden gesammelt und höchstens alle 2 Sekunden neu gezeichnet. In der Messung mit 20 Messwerten und 10 Änderungen je Sekunde wird die Liste in 10 Sekunden 4-mal statt 40-mal neu aufgebaut.
- **Getestet gegen eine aktuelle Version von Home Assistant.** Die Tests liefen bisher nur gegen 2026.2.3; die Mängel dieser Version waren dort nicht zu sehen. Jetzt laufen sie zusätzlich gegen 2026.10.4, und ein Test scheitert, sobald Home Assistant eine veraltete Nutzung durch Alarmageddon meldet.

### Behoben

- **Die Einstellung "Nach einer Zeit rückgängig machen" ging verloren, wenn ein Schritt in eine Gruppe gezogen wurde.** Sie fiel ohne Hinweis weg: Das Gerät wäre eingeschaltet geblieben, bis jemand deaktiviert. Sie bleibt jetzt erhalten.
- **Sensoransicht eines Messwerts: "Batterie" und "Empfang" zeigten nur "Der Verlauf konnte nicht geladen werden".** Der Server lehnte beide Reiter für jeden Messwert-Sensor ab (zum Beispiel einen Temperatursensor). Sie zeigen jetzt den Verlauf wie bei Tür- und Fenstersensoren.
- **Eine Sicherung mit einem unbekannten Eintrag wird auf neueren Versionen von Home Assistant wieder als Ganzes abgelehnt.** Dort wurde ein unbekannter Eintrag in den Einstellungen je Modus oder in den Aktionen stillschweigend weggelassen und der Rest eingespielt. Gespeichert wurde davon nichts; die Regel "eine Sicherung mit einem ungültigen Wert wird abgelehnt" gilt jetzt wieder mit jeder Version.
- **Keine veralteten Schnittstellen von Home Assistant mehr.** Das Umbenennen einer Anlage und die Vorschau der Entitäts-ID nutzten Funktionen, die Home Assistant 2027 entfernt (bisher eine Warnung im Log).

## [1.59.0] - 2026-11-17

Enthält die Änderungen aus 1.58.0.

### Hinzugefügt

- **Aktions-Gruppe.** Ein neues Element unter Konfiguration › Aktionen: Eine Gruppe wiederholt ihre Aktionen in der Reihenfolge, zum Beispiel "Licht ein, 2 Sekunden warten, Licht aus, 2 Sekunden warten" als Blinklicht oder eine Sirene im Takt. Du wählst, wie lange: eine **Anzahl** Durchläufe (1 bis 100), eine **Dauer** (1 bis 3600 Sekunden) oder **bis deaktiviert** (nur im Ablauf des Alarms; endet mit Deaktivieren, Quittieren oder "Alarmton stumm"). Die Gruppe ist ein Rahmen mit Kopfzeile in der Farbe ihres Bereichs (beim Alarm rot, beim Scharfschalten hellrot, bei den Verzögerungen orange, nach dem Quittieren und beim Deaktivieren grün); darin liegen die Aktionen als dieselben Karten wie überall. Aktionen kommen über das Plus in die Gruppe oder durch Ziehen, und ebenso wieder heraus; mit der Tastatur geht eine Aktion mit den Pfeiltasten in eine Gruppe hinein, hindurch und hinaus. Die Gruppe gibt es in allen Listen der Aktionen (nicht in den Regeln der Überwachung), jeweils mit den Aktionen, die dort möglich sind; eine Gruppe hat höchstens 10 Aktionen, die zur Grenze von 40 je Liste zählen.
- **"Warten, bis die Aktion beendet ist" auch für die Gruppe.** Wie bei den anderen Aktionen: aus (Standard) läuft die Gruppe nebenher und die folgenden Aktionen starten sofort, ein wartet der Ablauf auf ihr Ende. Auf eine Gruppe "bis deaktiviert" lässt sich nicht warten.
- **Rückfrage, wenn eine Gruppe in einen anderen Bereich wandert.** Ziehst du eine Gruppe zum Beispiel vom Alarm zum Scharfschalten, nennt ein Fenster die Aktionen, die es dort nicht gibt (etwa Push-Meldung oder Alarmton), und entfernt sie erst nach deiner Bestätigung; "bis deaktiviert" wird dort zu einer Anzahl Durchläufe. "Abbrechen" lässt die Gruppe, wo und wie sie ist.
- **Sicher wie die anderen Alarmaktionen.** Jede Aktion in der Gruppe steht unter denselben Grenzen (ein Gerät, das nicht antwortet, wird nach 10 Sekunden übergangen, ein Fehler bricht nie die übrigen ab). Jede Runde dauert mindestens 1 Sekunde, damit eine Gruppe ohne "Warten" keine Flut von Schaltbefehlen und Meldungen auslöst. Bei "Dauer" beginnt eine Runde nur, wenn sie noch ganz in die Zeit passt: Die Gruppe läuft nie länger als eingestellt und endet nie mitten in einer Runde (das Licht bleibt nicht an). Nach einem Neustart von Home Assistant mitten im Alarm läuft eine Gruppe "bis deaktiviert" wieder an; eine abgewartete Gruppe macht mit den restlichen Runden oder der restlichen Zeit weiter. Ein Gerät mit "Rückgängig" kehrt beim Deaktivieren in seinen vorherigen Zustand zurück, auch wenn mitten in einer Runde deaktiviert wird.

### Geändert

- **Die Aufzeichnung eines Alarms hat eine harte Grenze.** Aktionen und Meldungen kamen bisher immer auf die Zeitachse. Ab 600 Einträgen kommen nur noch Zustandswechsel und das Ende dazu: Eine Gruppe, die bis zum Deaktivieren jede Runde eine Meldung sendet, lässt die Aufzeichnung so nicht ohne Ende wachsen. Die Aktionen einer Gruppe stehen nur für die erste Runde auf der Zeitachse.

## [1.58.0] - 2026-11-17

Nicht veröffentlicht; enthalten in 1.59.0.

Ergebnis eines vollständigen Code-Reviews (Logik, Stabilität, Geschwindigkeit) und Wünsche zur Oberfläche.

### Hinzugefügt

- **"Ton hochladen" direkt auf der Seite Anlage.** Das Kapitel "Eigene Töne" hat neben "Töne anzeigen" den Knopf "Ton hochladen" (ein normaler Knopf, nicht blau); er öffnet das Fenster gleich mit dem Formular. Lädst du einen Ton im Editor eines Schritts hoch, steht unter der Auswahl ein dezenter oranger Hinweis: "Hochgeladen und für diesen Schritt gewählt. Der Schritt ist noch nicht gespeichert." Der Ton selbst ist sofort abgelegt; offen ist nur noch der Schritt.
- **"Routine hinzufügen" direkt auf der Seite Anlage.** Das Kapitel "Routinen" hat neben "Routinen anzeigen" den Knopf "Routine hinzufügen" (nicht blau); er öffnet gleich den Editor. Eine neue oder geänderte Routine trägt in der Liste die orange Marke "Noch nicht gespeichert", die Zusammenfassung der Seite "Änderungen noch nicht gespeichert", bis du die Seite speicherst.
- **Eigene Ablage für den Zustand der Anlage.** Jeder Wechsel (scharf, Verzögerung, Alarm, deaktiviert) wird sofort geschrieben. Home Assistant selbst legt Zustände nur alle 15 Minuten und beim sauberen Beenden ab: Nach einem Absturz oder Stromausfall kam die Anlage sonst mit einem bis zu 15 Minuten alten Stand zurück (zum Beispiel deaktiviert, obwohl sie scharf war). Beim Start gilt der neuere der beiden Stände; die Ablage wird mit der Anlage gelöscht.

### Geändert

- **Die Übersicht lädt schneller.** Die 15 Dateien des Panels wurden nacheinander geholt, jede erst nach der vorherigen; jetzt lädt der Browser alle zugleich (in der Messung bei 120 ms Verzögerung je Anfrage 1,0 s statt 2,7 s bis zur fertigen Übersicht, im lokalen Netz 0,27 s statt 0,4 s). Die Antwort mit den Daten enthält die Messwert-Sensoren des Hauses nur noch, wenn eine Anlage die Überwachung eingeschaltet hat, und die erste Antwort nach einem Neustart wartet höchstens 1,5 Sekunden auf den Verlauf für "Letzte Änderung" (der Rest wird nachgereicht).
- **Zustände erscheinen im Panel sofort.** Das Panel übernahm den Stand von Home Assistant nur alle 5 Sekunden: Ein Alarm oder ein offener Sensor stand bis zu 5 Sekunden zu spät da, und nach dem Scharfschalten drehte die Ladeanzeige bis zu 4 Sekunden. Jetzt prüft es alle 250 ms, ob es einen neuen Stand gibt.
- **Neues Symbol für "Sicherungen anzeigen":** eine Liste, wie bei "Routinen anzeigen". Das bisherige Symbol (Pfeil mit Auge) las sich als "Sicherung anlegen" oder "wiederherstellen".
- **Die Reiterzeile unter Konfiguration › Aktionen bleibt beim Wechsel auf "Überwachung" auf gleicher Höhe.** Der Platz des Schalters "Einstellungen pro Modus" bleibt dort frei, statt dass die Zeile nach oben springt.
- **Neustart mitten im Alarm ohne gespeicherten Ablauf:** Die Alarmaktionen beginnen von vorn, statt auszubleiben (im Zweifel alarmieren). Ein Alarm, den "Alarmton stumm" still gestellt hat, bleibt nach einem Neustart still. Ein Test oder Aktionen nach dem Quittieren werden nach einem Neustart nicht mehr als Alarmablauf fortgesetzt.
- **Weniger Arbeit je Sensorereignis.** Die Prüfung "Immer aktiv" und die Status-Entität haben bei jedem Ereignis eines Sensors alle Sensoren und die Registry durchsucht; ein Alarmton wurde für jeden Lautsprecher einzeln aufgebaut. Beides geschieht jetzt einmal.

### Behoben

- **Alarm ohne Sirene nach einem Neustart.** Lief die Eingangsverzögerung während eines Neustarts von Home Assistant ab, wechselte die Anlage zwar auf "Alarm", aber Alarmaktionen, Push-Meldung, Protokoll und Aufzeichnung blieben aus: Sie hörten zu diesem Zeitpunkt noch nicht zu. Der Alarm beginnt jetzt, sobald alle Teile bereit sind.
- **Beschädigte abgelegte Daten machten die Anlage "nicht verfügbar".** Ein unlesbarer Zeitpunkt oder ein falscher Typ im abgelegten Stand brach das Laden ab. Jeder Wert wird jetzt einzeln geprüft; was unlesbar ist, wird übergangen, der Zustand bleibt erhalten.
- **Der Modus, in dem die Anlage scharf ist, liess sich abschalten.** Im Dialog "Konfigurieren" der Integration und beim Wiederherstellen einer Sicherung: Die Anlage war danach ohne Meldung deaktiviert. Beides wird jetzt abgelehnt, mit dem Hinweis, zuerst zu deaktivieren.
- **Sensoransicht über 7 und 30 Tage blieb nach der Zeitumstellung im Herbst hängen.** Am Tag mit 25 Stunden lief die Berechnung der Tageszeilen endlos ("Invalid string length"), solange dieser Tag im Zeitraum lag, also bis zu 30 Tage lang.
- **Anlage anlegen oder löschen blieb im Panel stehen,** wenn in Home Assistant gerade eine lange Aufgabe lief (zum Beispiel eine Automation mit Wartezeit): Der Befehl wartete auf alle Aufgaben von Home Assistant statt nur auf die eigene.
- **Die Meldung "Eingangsverzögerung" nannte die Zeit des Modus,** auch wenn der auslösende Sensor eine eigene Verzögerung hat. Sie nennt jetzt die Zeit, die wirklich läuft.
- **Überwachung: der Schritt "Warten" beendete seine Wartezeit aus einem fremden Thread.** Das ist in Home Assistant nicht zulässig und konnte die folgenden Schritte verzögern oder verlieren.
- **Aufzeichnung eines Alarms: das Schreiben wurde bei vielen Ereignissen immer weiter verschoben.** Es wird jetzt spätestens 2 Sekunden nach dem ersten Ereignis geschrieben.

### Sicherheit

- **Die Sperre nach fünf falschen Codes liess sich mit gleichzeitigen Versuchen umgehen.** Die Prüfung eines Codes dauert einen Moment; Versuche, die in dieser Zeit eintrafen, wurden alle geprüft, bevor der Zähler stieg. Codes werden jetzt einzeln nacheinander geprüft.

## [1.57.0] - 2026-11-17

### Hinzugefügt

- **Test-Knopf an jedem Schritt einer Überwachungsregel.** Jede Schrittkarte einer Regel ("Ausserhalb der Grenzen" und "Wieder in Ordnung") hat an erster Stelle einen Play-Knopf, wie die Alarm-Aktionen. Er führt nur diesen Schritt einmal aus, auch wenn die Regel noch nicht gespeichert ist: eine Push-Meldung geht mit dem Titel "Test: ..." und den aktuellen Werten der Regel in den Platzhaltern hinaus, ein Geräteschritt schaltet das Gerät. "Warten" gibt es nicht zu testen, sein Knopf ist gesperrt. Während ein Test läuft, sind die Knöpfe gesperrt; danach meldet eine Meldung "Schritt getestet." oder den Grund des Fehlers (zum Beispiel ein Gerät, das nicht antwortet, nach höchstens 10 Sekunden). Ein Test löst nie Sirene oder Alarm aus, und nur Administratoren können ihn ausführen.

## [1.56.0] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.57.0.

### Geändert

- **Eigene Töne öffnen in einem eigenen Fenster.** Auf der Seite Anlage zeigt das Kapitel "Eigene Töne" nur eine Zusammenfassung ("1 eigener Ton") und einen Knopf "Töne anzeigen". Die Liste (abspielen, umbenennen, löschen) und das Formular zum Hochladen liegen im Fenster (auf dem Handy als Vollbild), wie bei den Routinen. Ohne Ton lädt eine Karte mit zentriertem Knopf "Ton hochladen" zum Hinzufügen ein, sonst steht der Knopf in der Fusszeile. Änderungen werden weiterhin sofort gespeichert. Auf dem Handy stehen die Knöpfe eines Tons unter seinem Namen, damit der Name Platz hat.
- **Das Formular zum Hochladen bleibt in seiner Karte**, auch in einem schmalen Fenster (die Felder ragen nicht mehr über den Rand).

## [1.55.1] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.56.0.

### Geändert

- **Der Knopf "Sichern" heisst jetzt "Backup erstellen".** "Sichern" wirkte, als würde er die Einstellungen der Seite speichern. Der Knopf, das Fenster "Backup erstellen" und die Hinweise sagen jetzt klar, dass eine Sicherungskopie angelegt wird (Meldung: "Backup erstellt.").
- **Neues Symbol für "Sicherungen anzeigen".** Der Wiederherstellen-Pfeil trägt jetzt ein Auge in der Mitte; der Knopf liest sich so als "Sicherungen ansehen" und nicht als "wiederherstellen".
- **"Exportieren" und "Importieren" stehen jetzt in der Fusszeile des Fensters "Sicherungen anzeigen".** Sie liegen nicht mehr auf der Seite neben "Backup erstellen"; der Hinweis auf der Seite sagt, wo sie sind. Der Hinweis ist kürzer und trennt die eigenen Backups (höchstens 10) von den automatischen, die nicht dazu zählen. "Backup erstellen" ist jetzt ein normaler Knopf (nicht mehr blau, mit Plus statt Häkchen), damit er nicht nach "Speichern" aussieht. Auf dem Handy bleiben die drei Knöpfe der Fusszeile (Exportieren, Importieren, Schliessen) in einer Zeile.

## [1.55.0] - 2026-11-16

### Geändert

- **Routinen und Sicherungsliste öffnen in einem eigenen Fenster.** Auf der Seite Anlage zeigen Routinen nur eine Zusammenfassung ("3 Routinen · 3 aktiv") und einen Knopf "Routinen anzeigen"; bei den Sicherungen steht "Letzte Sicherung: Datum, Name" und ein Knopf "Sicherungen anzeigen". Liste und Editor einer neuen Routine liegen im Fenster (auf dem Handy als Vollbild). Die Übersicht der Routinen sieht aus wie bisher; eine neue Routine entsteht im Fenster; ohne Routine lädt eine Karte mit zentriertem Knopf zum Hinzufügen ein, sonst steht der Knopf in der Fusszeile. Änderungen an den Routinen bleiben ein Entwurf und werden mit "Speichern" der Seite gesichert. Die Knöpfe für Sicherungs-Einstellungen, "Jetzt sichern", "Exportieren" und "Importieren" bleiben auf der Seite. Der Rollbereich der Sicherungsliste (ab sieben Zeilen) liegt jetzt im Fenster.
- **Automatische Sicherung wird mit der Seite gespeichert.** Schalter, Anzahl und Abstand gehören zum Entwurf der Seite wie jede andere Einstellung: orange Punkt, "1 Änderung", "Abbrechen" verwirft sie, eine ungültige Anzahl sperrt "Speichern". Vorher speicherte das Ändern der Anzahl sofort.
- **Gleiche Knöpfe bei Regeln und Routinen.** Die Regelkarten der Überwachung und die Zeilen der Routinen tragen die runden 44-px-Knöpfe (bearbeiten, kopieren, löschen) in derselben Reihenfolge wie die Aktionen.
- **Schlüsselzeilen einer Überwachungsregel grösser und fett.** "Löst aus" und "Wieder in Ordnung" fallen in der Karte auf.

## [1.54.0] - 2026-11-16

### Hinzugefügt

- **Messwert-Sensoren in der Übersicht und in der Sensoransicht.** Bei eingeschalteter Überwachung stehen die Temperatur-, Luftfeuchtigkeits- und CO2-Sensoren der Überwachung in der Übersicht, mit Wert und Einheit (statt eines Zustandsworts). Ein Tipp öffnet dieselbe Ansicht wie bei den anderen Sensoren: Reiter "Verlauf" mit dem Werteverlauf als saubere Grafik (schöne Achse in der Einheit des Sensors, die Grenzen der Regeln als gestrichelte Linien, der aktuelle Wert als Punkt), die Kennzahlen (aktuell, im Mittel, niedrigster, höchster Wert), die Zeiträume 3 Stunden bis 30 Tage, dazu Batterie, Empfang und Gerät mit denselben Grafiken wie bei den anderen Sensoren. Unter der Grafik stehen nur die Ereignisse der Überwachung ("Ausserhalb der Grenzen", "Wieder in Ordnung", mit Wert und Regel), nie die einzelnen Werte. Läuft eine Regel, ist der Sensor gelb markiert und zählt unter "Probleme". In der Arten-Auswahl gibt es den Filter "Messwerte".
- **Rückkehr-Spanne mit deinen Werten erklärt.** Unter dem Feld zeigt der Editor der Regel live beim Tippen: bei welchen Werten die Regel auslöst, ab welchem Wert sie wieder in Ordnung ist, die Pufferzone dazwischen (dort bleibt die Regel in ihrem Zustand) und den aktuellen Wert des Sensors, als Balken in den Farben der Überwachung. Die Karte der Regel nennt ebenfalls den Wert, ab dem sie wieder in Ordnung ist.

### Geändert

- **Sicherungen auf dem Handy scrollen ab sieben Zeilen** (am Computer ab zehn); alle Zeilen sind dort gleich hoch.
- **Cursor am Ende des Textes.** Tippt man ein Feld an, das schon Inhalt hat, steht der Cursor nach dem letzten Zeichen, nicht davor (Text, Zahlen und Textbereiche im ganzen Panel).

## [1.53.0] - 2026-11-16

### Geändert

- **Routinen: nur "Anlage deaktiviert" braucht keine Bestätigung.** Die Karte "Sicherheit" ("Ich habe das verstanden") erscheint jetzt bei jeder Routine, über den Zuständen. Jeder Zustand ausser "Anlage deaktiviert" (Schärfe läuft, scharf, Eingangsverzögerung, Alarm) lässt sich erst nach der Bestätigung einschalten, beim Deaktivieren wie beim Scharfschalten, weil eine Routine in diesen Zuständen sonst einen Code umgehen könnte (Wechsel von Anwesend auf Abwesend, Unterbrechen der Eingangsverzögerung). Eine neue Routine startet nur mit "Anlage deaktiviert". Schaltet man die Bestätigung aus, fallen die anderen Zustände wieder weg. Der Server prüft dieselbe Regel für neue und geänderte Routinen. Bisherige Routinen und Sicherungen laufen unverändert weiter; die Liste zeigt an ihnen "Bestätigung fehlt", bis sie erneut gespeichert werden, und eine Änderung braucht die Bestätigung. Die Texte der Karte, der Zustände und der Fehlermeldung sind angepasst.
- **Überwachung: die bearbeitete Regel bleibt offen.** Nach dem Bleistift und dem Zurückkehren (auch nach "Abbrechen") ist die Karte aufgeklappt.

### Hinzugefügt

- **Überwachung: Lautstärke bei kritischen Meldungen.** Ist "Kritische Meldung" an, zeigt der Push-Schritt einen Lautstärkeregler (Standard 100 %), wie bei den Alarmmeldungen.
- **Vorarbeit für Messwert-Sensoren im Panel (Server).** Der Befehl der Sensoransicht liefert jetzt auch den Werteverlauf von Temperatur-, Luftfeuchtigkeits- und CO2-Sensoren, die die Überwachung führt, mit den Ereignissen der Überwachung und den Grenzen der Regeln; Ereignisse der Überwachung tragen Wert und Einheit. Das Panel nutzt es ab 1.54.0.

## [1.52.1] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.53.0.

### Geändert

- **Die Reiterleiste der Aktionen ist nicht mehr getönt; nur die Icons tragen Farbe.** Spur und Text bleiben neutral. Die Icons der Reiter, die einen Alarm auslösen können (Anwesend, Abwesend, Nacht, Immer aktiv), sind dunkelrot, im selben Rot wie die Zone "Alarm" im Ablauf; das Icon von "Überwachung" ist orange. Nicht gewählte Reiter sind etwas gedämpft; der gewählte Reiter bekommt einen feinen Rand in der Farbe seiner Gruppe und ein volles Icon. Auf dem Handy mit fünf Reitern (Nacht an) steht "Überwachung" jetzt über die ganze Breite unter den anderen, statt aus seiner Zelle zu laufen.

## [1.52.0] - 2026-11-16

### Hinzugefügt

- **Überwachungsregeln sind standardmässig zugeklappt.** Man öffnet die gewünschten; "Alle aufklappen" / "Alle zuklappen" öffnet oder schliesst weiterhin alle.
- **Das Protokoll nach Routine filtern.** Unter Protokoll › Alle Ereignisse gibt es eine neue Pille "Routinen" (alles, was eine Routine getan oder übersprungen hat) und, immer sichtbar unter den Pillen, ein Dropdown über die ganze Breite, in dem man eine Routine über ihren Titel wählt; dann erscheinen nur deren Ereignisse. Das Dropdown führt alle Routinen mit der Anzahl ihrer Ereignisse auf.

## [1.51.2] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.52.0.

### Geändert

- **Regeln der Überwachung: der Pfeil zum Zuklappen steht oben rechts**, weg vom Schalter. Die Farbe einer Regel beginnt oben links wie ein Sonnenaufgang und blasst rasch aus, eine offene Regel ist also nur im oberen Teil gefärbt.

## [1.51.1] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.52.0.

### Behoben

- **Die getönte Reiterleiste der Aktionen auf dem Handy.** Brechen die Reiter in zwei Spalten um, ist nur die Zelle "Überwachung" orange und der Rest rot, statt eines orangen Verlaufs über die anderen Reiter.

## [1.51.0] - 2026-11-16

### Geändert

- **Die Reiterleiste der Aktionen ist getönt.** Die Reiter, die einen Alarm auslösen können (Anwesend, Abwesend, Nacht, Immer aktiv), stehen auf einer leicht roten Spur, "Überwachung" auf einer leicht orangen, mit weichem Übergang erst gegen Ende von "Immer aktiv". Man sieht den Unterschied schon vor dem Wählen.

## [1.50.0] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.51.0.

### Hinzugefügt

- **Regeln der Überwachung lassen sich zuklappen und durchsuchen.** Ein runder Pfeil an jeder Regel klappt sie auf den Kopf zu (nur die Ansicht, nichts wird gespeichert), "Alle zuklappen / Alle aufklappen" tut es für alle. Das Suchfeld darüber filtert nach dem Namen der Regel sowie nach Name und Entitäts-ID der darin verwendeten Sensoren und Geräte.
- **Vorschau der Meldung.** Das Fenster eines Push-Schritts zeigt die Meldung, wie sie aufs Handy kommt, mit den Platzhaltern aufgelöst durch die aktuellen Werte des ersten Sensors der Regel; sie folgt jedem Tastendruck und zeigt den Standardtext, wenn deiner leer ist.
- **Eine Farbe für jede Regel der Überwachung.** Im Fenster der Regel, Kapitel "Darstellung": eine von zehn Farben oder keine; die Karte der Regel färbt sich dann mit einem sanften Farbverlauf ein. Nur das Aussehen; die Farbe gehört in die Sicherung.
- **Die Liste der Sicherungen passt aufs Handy.** Dort entfällt die Spalte "Alarmanlagen", die Anlagen stehen unter dem Namen.
- **Die Liste der Sicherungen ist sortierbar und hat eine eigene Spalte "Datum".** Ein Klick auf eine Spaltenüberschrift sortiert nach Sicherung, Datum oder Alarmanlage; Standard ist nach Datum, neueste oben. Ab zehn Zeilen rollt die Tabelle für sich, die Kopfzeile bleibt sichtbar.

## [1.49.0] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.50.0.

### Hinzugefügt

- **Wählbar, wie viele automatische Sicherungen bleiben.** Ein Feld neben "Wöchentlich" unter Konfiguration › Anlage › Sicherung: 1 bis 50, Standard 5. Deine eigenen Sicherungen (bis 10) zählen getrennt.

## [1.48.1] - 2026-11-16

### Hinzugefügt

- **Jede Regel steht in einer eigenen umrandeten Karte** (Kopf, "Ausserhalb der Grenzen" und "Wieder in Ordnung" zusammen), damit klar ist, welche Abläufe zusammengehören.
- **Platzhalter sind antippbare Pillen.** Unter dem Titel und unter dem Text eines Push-Schritts hat jedes Feld seine eigene Reihe Pillen ({rule}, {sensor}, {value}, {unit}, {limit}, {since}, {name}); ein Antippen fügt den Platzhalter an der Schreibmarke dieses Feldes ein.

### Geändert

- **Eine Regel kann nur Messwerte aus der Sensorliste wählen** (Konfiguration › Sensoren › Sensoren hinzufügen, Filter "Messwerte"), nicht jeden Sensor von Home Assistant.

## [1.48.0] - 2026-11-16

### Hinzugefügt

- **Überwachung: Messwerte und Ja/Nein-Sensoren, unabhängig vom Alarm.** Ein neuer Bereich neben Anwesend, Abwesend, Nacht und Immer aktiv, mit eigenem Reiter unter Konfiguration › Aktionen › Überwachung. Eingeschaltet wird er unter Konfiguration › Anlage › Modi (**standardmässig aus**). Typische Fälle: ein Kühlschrank über 8 °C seit 30 Minuten oder seine Tür seit 5 Minuten offen. Jede Regel ist ein Kapitel mit ihrem Ablauf in den Farben der Aktionen: "Ausserhalb der Grenzen" (orange) und "Wieder in Ordnung" (grün). Eine Regel hat:
  - eine **Bedingung**: Messwert über, unter oder ausserhalb von Grenzen, Gerätezustand (Tür, Schalter, Schloss ...), Uhrzeit und "Anlage ist scharf" (in gewählten Modi), verbunden mit Und/Oder und Gruppen wie bei den Routinen;
  - eine **Dauer**: so lange muss die Bedingung gelten, bevor der erste Ablauf läuft;
  - eine **Rückkehr-Spanne**: ein Wert gilt erst so weit innerhalb der Grenze als wieder in Ordnung, damit ein Wert, der um die Grenze flattert, nicht ständig neu meldet;
  - **Schritte**: Push-Meldung (eigener Titel und Text mit `{rule}`, `{sensor}`, `{value}`, `{unit}`, `{limit}`, `{since}`, `{name}`, eigene Empfänger, auf Wunsch kritisch), Gerät schalten, Warten;
  - eine optionale **Erinnerung** alle N Stunden, solange es anhält (wiederholt nur die Push-Schritte).
- **Messwerte in der Sensorliste.** Bei eingeschalteter Überwachung bietet "Sensoren hinzufügen" auch Temperatur, Luftfeuchtigkeit, CO2 und andere Messwerte an (neuer Filter "Messwerte"). Sie stehen ausgegraut in der Tabelle: keine Zone, nie immer aktiv, keine Eingangsverzögerung. Der Alarm sieht sie nie; die Wartungsprüfung (Batterie, nicht erreichbar) erfasst sie. Sie gehören wie die Regeln in die Sicherung.
- **Sicher gebaut.** Ein Sensor, der nicht antwortet, zählt nie: Er löst keine Regel aus und beendet auch keine, ein Funkabriss meldet also nie "wieder in Ordnung". Eine laufende Regel meldet sich nach einem Neustart, einem Neuladen oder beim Speichern der Seite nicht noch einmal. Die Überwachung läuft auch bei deaktivierter Anlage und löst nie die Sirene oder den Alarm aus; kritische Ereignisse wie Feuer oder Wasser bleiben bei "Immer aktiv". Ein Gerät, das hängt, hält nichts auf (jeder Aufruf wartet höchstens 10 Sekunden), und ein fehlerhafter Schritt stoppt die übrigen nie.

### Geändert

- **Die Titel der Aktionskarten sind fett** (gleiche Grösse), damit sie deutlicher hervortreten.

## [1.47.0] - 2026-11-16

Nicht veröffentlicht; enthalten in 1.48.0.

### Hinzugefügt

- **Automatische Sicherung.** Unter Konfiguration › Anlage › Sicherung gibt es einen Schalter "Automatisch sichern" (standardmässig an) und die Wahl "Täglich / Wöchentlich / Monatlich" (standardmässig wöchentlich). Die Integration legt die Konfiguration aller Anlagen dann selbst ab, geprüft jede Nacht um 03:17 und kurz nach dem Start von Home Assistant (eine verpasste Sicherung wird nachgeholt). Es bleiben die letzten 5 automatischen Sicherungen, zusätzlich zu deinen 10 eigenen; in der Liste tragen sie die Marke "Automatisch". Hat sich seit der letzten automatischen Sicherung nichts geändert, wird keine gleiche Kopie abgelegt, damit die fünf verschiedene Stände zeigen. Wie jede Sicherung enthalten sie nie Codes; die Einstellung selbst gehört nicht zur Sicherung. Eine fehlgeschlagene automatische Sicherung stört die Anlagen nie.

### Geändert

- **Die Vorschau einer Routine sagt es in einfachen Worten.** "Sobald Folgendes eintritt" statt "Wenn das Gerät neu zutrifft", und "Nur bei einer echten Änderung: nicht nach einem Neustart und nicht, wenn ein Gerät wieder erreichbar wird".

## [1.46.1] - 2026-11-16

### Behoben

- **Der orange Punkt am Reiter "Anlage" blieb nach dem Speichern von Routinen stehen.** Der Server ergänzt Vorgaben (zum Beispiel die Modi bei "Anlage scharf") und ordnet die Werte anders, darum sah die gespeicherte Liste nicht mehr aus wie der Entwurf. Beide Seiten werden jetzt vor dem Vergleich in dieselbe Form gebracht, gespeicherte Routinen (auch alte, kopierte oder gelöschte) lassen nichts mehr offen.
- **Die Geräteauswahl einer Routine ist auf dem Handy nicht mehr viel zu gross.** Das Suchfeld war auf die ganze Fensterhöhe gewachsen; es hat wieder seine normale Höhe.

### Geändert

- **Die Zustände in der Vorschau einer Routine sind aufgeräumter.** Die Pillen sind gleich gross und werden nicht mehr mitten im Wort umgebrochen ("Ausgangsverzö-gerung"); die gewählten tragen ein Häkchen. Auf dem Handy stehen sie untereinander und die Kachel wächst nach unten, am Computer füllen sie die Zeile gleichmässig.

## [1.46.0] - 2026-11-16

### Hinzugefügt

- **Scharf nur in gewählten Modi.** Unter "Anlage scharf" hat die Routine einen Schalter je Modus der Anlage: sie gilt dann nur, wenn die Anlage in einem der gewählten Modi scharf ist (zum Beispiel nur "Abwesend"). Sonst wird sie übersprungen und das steht im Protokoll.
- **Routine duplizieren.** Ein Knopf neben dem Stift kopiert eine Routine (ausgeschaltet, mit freiem Namen "… (Kopie)"); die Kopie gilt, sobald du die Seite speicherst.

### Geändert

- **Die Vorschau des Ablaufs ist ruhiger und nutzt die Farben der Aktionen.** Drei Schritte an einer Linie mit nummerierten Kreisen; die Karten tragen die Zonenfarben der Aktionen mit ihrem Verlauf (Scharfschalten hellrot, Deaktivieren dunkelgrün). Der "Nein"-Zweig entfällt: Ein Hinweis sagt, dass die Routine in jedem anderen Zustand übersprungen wird und das im Protokoll steht.
- Der Name einer Routine darf bis zu 45 Zeichen haben (bisher 40).

## [1.45.0] - 2026-11-16

### Hinzugefügt

- **Tasten als Auslöser.** Eine Routine nach Gerät kann jetzt einen Tastendruck nutzen: jede Taste eines Fernbedieners oder Dimmers (zum Beispiel eines Hue-Tasters; es sind die "event"-Entitäten von Home Assistant) mit jeder Art des Drückens (kurz, lang, doppelt ...). In der Geräteauswahl hilft der Filter "Tasten". Ein Druck zählt nur im Augenblick, in dem er geschieht, nie ein wiederhergestellter alter (nach dem Neuladen einer Integration kommt der alte Zeitpunkt zurück und löst nie aus), und er lässt sich nicht mit "muss N Sekunden gelten" verbinden.
- **Vorschau des Ablaufs.** Am Ende des Editors einer Routine zeigt eine Grafik, was passiert: 1 Auslöser (mit Und/Oder-Baum oder den Zeiten), 2 Prüfung (die fünf Zustände der Anlage, die gewählten grün), danach JA zur Aktion (rot mit der Marke "Umgeht den Code" beim Deaktivieren) und NEIN zu "Übersprungen, steht im Protokoll". Sie folgt dem Entwurf beim Bearbeiten und ist reine Anzeige.

### Entfernt

- **Der Schalter "Deaktivieren per Routine erlauben" entfällt.** Die Bestätigung "Ich habe das verstanden" in der Routine genügt. Eine Routine, die deaktiviert, läuft jetzt immer (bei ausgeschaltetem Schalter wurde sie übersprungen); bitte prüfe deine Routinen, die deaktivieren. Gespeicherte Werte und Sicherungen von 1.44.0 bleiben benutzbar.

### Geändert

- Im Editor einer Routine steht der Papierkorb einer Gruppe neben "Alle (und) / Eine davon (oder)", und die Hinweise unter dem Bedingungsbaum haben mehr Abstand.

## [1.44.0] - 2026-11-16

### Hinzugefügt

- **Routinen: nach Zeit oder nach Gerät.** Unter Konfiguration › Anlage wird aus dem Kapitel "Zeitplan" das Kapitel "Routinen". Eine Routine schaltet die Anlage (Anwesend, Abwesend oder Nacht scharf, oder deaktivieren), wenn ihr Auslöser eintritt. Der Auslöser ist ein **Zeitplan** (eine oder mehrere Zeiten, jede mit eigenen Wochentagen) oder ein **Gerät** von Home Assistant, zum Beispiel ein Smart Lock, das abschliesst. Bedingungen bei Geräten sind "Gerät ist Zustand" (Schloss, Schalter, Licht, Abdeckung, Tür- oder Bewegungsmelder, Person ...) und "Uhrzeit von–bis" (auch über Mitternacht, mit Wochentagen). Sie werden mit "Alle (und)" oder "Eine davon (oder)" verbunden, mit einer Ebene Gruppen wie bei Magic Push im Device Panel (bis zu 10 Bedingungen in bis zu 3 Gruppen), und können erst nach N Sekunden gelten. Die Geräteauswahl sucht nach Name, Bereich und Entitäts-ID (die Entitäts-ID wird nie angezeigt) und filtert nach Art und Bereich.
- **Die Zustände, in denen eine Routine gilt.** Fünf Schalter je Routine: Ausgangsverzögerung, Anlage scharf, Eingangsverzögerung, Beim Alarm, Anlage deaktiviert (standardmässig nur der letzte). Der Zustand der Anlage im Moment des Auslösens entscheidet; sonst wird die Routine übersprungen und das steht im Protokoll ("Routine … übersprungen: gilt nicht im Zustand: …").
- **"Deaktivieren per Routine erlauben"** unter Konfiguration › Anlage (standardmässig aus, wie das Deaktivieren per Push-Aktion). Eine Routine, die deaktiviert, umgeht den Code: Sie trägt die Marke "Umgeht den Code", braucht die Bestätigung "Ich habe das verstanden" und gilt bei Eingangsverzögerung oder Alarm nur, wenn du diese Zustände ausdrücklich wählst (mit roter Warnung).

### Geändert

- **Eine Routine läuft nur bei einem echten Wechsel.** Sie läuft, wenn ihre Bedingungen neu zutreffen: nicht solange sie zutreffen, nicht nach einem Neustart von Home Assistant und nicht bei der Rückkehr aus "nicht verfügbar" oder "unbekannt" (ein Funkabriss schaltet die Anlage nie). Eine Routine läuft nie zweimal innerhalb von 10 Sekunden und löst nie eine andere aus (Entitäten von Alarmageddon sind als Auslöser nicht erlaubt). Scharfschalten gilt nie bei Eingangsverzögerung oder Alarm.
- **Zeitpläne sind zu Routinen geworden.** Beim ersten Start dieser Version wird jeder Zeitplan zu einer Routine mit dem Auslöser "Zeitplan", demselben Ziel und den Zuständen Ausgangsverzögerung, scharf und deaktiviert (was ein Zeitplan bisher tat: nie bei Eingangsverzögerung oder Alarm). Wenn ein Zeitplan deaktivierte, wurde "Deaktivieren per Routine erlauben" für diese Anlage eingeschaltet, damit er weiterläuft. Alte Sicherungen werden beim Wiederherstellen umgewandelt.
- Das Protokoll nennt die Routine ("Routine: Haus verlassen") als Herkunft des Scharfschaltens und Deaktivierens.

## [1.43.5] - 2026-11-15

### Behoben

- **Der Plus-Knopf und seine Linien in den Aktionen sehen sauber aus.** Die Linien sind dünner (1,5 px wie der Ring), alle im Blau des Knopfes (das kurze Stück über dem Abschluss-Punkt war grau-grün) und treffen den Ring oben und unten genau in der Mitte: Der gestrichelte Ring besteht jetzt aus 12 gleichen Strichen, je einer liegt genau oben und genau unten, es gibt dort keine Lücke, wo die Linie ankommt.

## [1.43.4] - 2026-11-15

### Geändert

- **Die Linien zum Plus-Knopf haben die Farbe des Knopfes.** In den Aktionen sind die kurzen Linien über und unter einem Plus-Knopf nicht mehr wie die Zone eingefärbt, sondern haben das Blau des Knopfes und treffen ihn oben und unten genau in der Mitte.

## [1.43.3] - 2026-11-15

### Geändert

- **Reiter des Sensorfensters am Tablet und Computer: Symbol über Beschriftung und Wert.** Die vier Reiter sehen jetzt aus wie auf dem Handy (Symbol oben, mittig), mit Beschriftung und Wert in zwei Zeilen darunter, damit nichts verloren geht, wo Platz ist. Nur das Handy behält die Kurzform.

## [1.43.2] - 2026-11-15

### Behoben

- **Die gewählte Datei bleibt erhalten, wenn der Name eines neuen Tons schon vergeben ist.** Der Name wird vor dem Hochladen geprüft (Gross- und Kleinschreibung und doppelte Leerzeichen zählen nicht). Ist er vergeben, bleibt das Formular, wie es ist, die Datei bleibt gewählt ("Gewählt: …") und du änderst nur den Namen. Das gilt auch nach jedem anderen Fehler beim Hochladen.

### Geändert

- **Der feste Block "Abschlussmeldung" ist eingefärbt wie die Aktionen nach dem Quittieren.** Er trägt denselben hellgrünen Verlauf und dieselbe Verbindungslinie wie die Schritte seiner Zone.
- **Reiter des Sensorfensters auf dem Handy: Symbol plus Kurztext.** Jeder Reiter zeigt sein Symbol mit einem kurzen Text darunter: "Verlauf" und "Gerät" mit dem Wort, "Batterie" und "Empfang" mit dem Wert (zum Beispiel "72 %" und "-58 dBm"). Nichts wird mehr abgeschnitten. Am Computer und Tablet ändert sich nichts.

## [1.43.1] - 2026-11-15

### Geändert

- **Alle Symbol-Kacheln der Seite "Anlage" sind gleich gross.** Die Symbole der Modi, des Hauptcodes, der Codes pro Person und der eigenen Töne (das Tondatei-Symbol) sind jetzt gleich gross (36 px, das Symbol darin 20 px), etwas grösser als bisher, und auf allen Seiten mit solchen Kacheln gleich (zum Beispiel in den Optionen eines Sensors).

### Behoben

- **Dateiauswahl für eigene Töne auf dem iPhone, zweiter Versuch.** Das Auswahlfenster bot weiterhin die Fotomediathek und die Videoaufnahme an. Die Liste der erlaubten Dateien besteht jetzt nur noch aus reinen Endungen (".wav", ".mp3", ".flac") und nennt "audio/*" nicht mehr, das das iPhone ebenfalls als Wunsch nach Medien behandelt. M4A- und OGG-Dateien sind absichtlich nicht genannt (das iPhone behandelt M4A als Video); werden sie auf dem iPhone ausgegraut, wähle im Dateifenster "Alle Dateien" oder melde es.
- **Die zwei Reiter im Protokoll sind gleich breit.** "Alarme" und "Alle Ereignisse" teilen sich die Leiste genau, auch auf dem Handy, statt dass der rechte breiter ist.

## [1.43.0] - 2026-11-15

### Geändert

- **MP3, OGG, FLAC und M4A brauchen das Programm ffmpeg nicht mehr.** Alarmageddon wandelt diese Formate jetzt mit PyAV um, das Home Assistant für die Integration "stream" ohnehin mitbringt (es enthält die FFmpeg-Bibliotheken). Das Hochladen geht damit auf jeder Installation mit der Standardkonfiguration, ohne dass du etwas installierst. Die Umwandlung läuft in einem eigenen Prozess, mit festem Format, Zeitgrenze und denselben Grenzen wie bisher (30 Sekunden, 8 MB): eine beschädigte Datei kann höchstens diesen Prozess stoppen, nie Home Assistant. Lässt sich PyAV nicht benutzen, gilt wie bisher das Programm ffmpeg; nur ohne beides bietet das Formular nur WAV an.

## [1.42.0] - 2026-11-15

### Hinzugefügt

- **Empfang von Thread-Geräten.** Geräte, die über Thread (Matter) funken, zeigen ihren Empfang jetzt wie Bluetooth-Geräte: einen Wert in der Liste und den Reiter "Empfang" mit dem Verlauf, nichts über Router oder Technik. Home Assistant zeigt diesen Wert nirgends; Alarmageddon liest ihn aus der Nachbartabelle des Geräts (der stärkste Nachbar zählt, bei einem Endgerät ist das sein Elternteil), ignoriert ungültige Werte und zeigt keinen Wert (der Reiter bleibt), solange Matter das Gerät nicht erreicht. Der Verlauf wird wie bei Bluetooth-Geräten aufgezeichnet. Matter-Geräte im WLAN haben keine solche Tabelle und bleiben bei ihrem Empfangssensor. Liefert dein Matter-Server die Tabelle nicht, bleibt der Empfang leer wie bisher.

## [1.41.0] - 2026-11-15

### Hinzugefügt

- **Empfang von Bluetooth- und ZHA-Geräten.** Geräte, deren Empfang nur Home Assistant selbst kennt (Bluetooth-Geräte, ZHA), zeigen jetzt auch ohne Empfangssensor einen Wert und einen Verlauf. Du siehst nur den Wert (dBm oder LQI) in der Liste und den Reiter "Empfang" mit dem Verlauf, nichts über Empfänger oder Technik. Bei mehreren Bluetooth-Adaptern oder Proxys zählt der **stärkste** Empfänger; der Wert springt nicht zwischen zwei fast gleich starken hin und her (der bisherige Empfänger bleibt, solange kein anderer mehr als 2 dB stärker ist; nur Empfänger, die das Gerät kürzlich gehört haben, zählen; ungültige Werte wie 0 dBm werden ignoriert). Der Wert folgt dem Median der letzten Minuten. Den Verlauf zeichnet das Panel selbst auf (jede Minute für überwachte Geräte, die leben: 5-Minuten-Blöcke für einen Tag, Stunden für 31 Tage), weil Home Assistant diese Werte nicht speichert. Ein Gerät, das gerade nicht gehört wird, behält den Reiter und zeigt "–". Geräte mit Empfangssensor funktionieren wie bisher.

### Geändert

- **"Aktionen" statt "Schritte" bei den eigenen Tönen.** In Konfiguration › Anlage › Eigene Töne steht die Nutzung als "in 1 Aktion genutzt" oder "in 3 Aktionen genutzt" (ebenso in der Rückfrage vor dem Löschen), mit richtiger Einzahl und Mehrzahl statt "Schritt(en)".

## [1.40.0] - 2026-11-15

### Hinzugefügt

- **Zonenfarben in den Aktionen.** Jede der sechs Zonen hat ihre eigene Farbe, so siehst du sofort, wohin ein Schritt gehört: Ausgangsverzögerung helles Orange, Eingangsverzögerung dunkles Orange, scharf geschaltet helles Rot, Alarm dunkles Rot, nach dem Quittieren helles Grün, beim Deaktivieren dunkles Grün. Die Schritte laufen von der Zonenfarbe nach neutral, die Verbindungslinie trägt die Farbe, und eine kleine Pille an jedem Schritt nennt die Zone in Worten (so geht es auch ohne Farben zu unterscheiden). Helles und dunkles Thema, Computer und Handy; die Schrift der Pille hat mindestens 3:1 Kontrast.
- **Tondatei-Symbol für eigene Töne.** Jeder Ton in Konfiguration › Anlage › Eigene Töne trägt vorn ein kleines Dateisymbol mit Wellenform. Die Wellenform ergibt sich aus dem Ton, jeder sieht also anders aus, und beim Abspielen bewegen sich die Balken.

### Geändert

- **Abspiel-Knopf der eigenen Töne** (Konfiguration › Anlage › Eigene Töne): Solange ein Ton spielt, ist der Knopf rot und pulsiert, genau wie der Stopp-Knopf eines getesteten Schritts, und wird wieder normal, wenn der Ton endet oder gestoppt wird. Der Knopf "Testen" unten bei den Aktionen verhielt sich schon so; ein Test sichert das jetzt ab.

### Behoben

- **Dateiauswahl für eigene Töne auf dem iPhone.** Das Auswahlfenster bietet die Fotomediathek und die Videoaufnahme nicht mehr an, nur noch Dateien. Die Liste der erlaubten Endungen nennt ".m4a", ".aac" und ".ogg" nicht mehr (das iPhone behandelt sie als Video); "audio/*" deckt weiterhin alle Audiodateien ab.
- **Verständliche Fehlermeldungen beim Hochladen eines Tons.** Statt "Das Hochladen ist fehlgeschlagen" sagt das Panel jetzt, was tatsächlich nicht stimmt: "Das ist ein Bild, kein Ton" (auch für iPhone-Fotos im Format HEIC), "ein Dokument", "eine Textdatei", "Die Datei hat keine Tonspur", "konnte nicht als Ton gelesen werden (beschädigt oder kein unterstütztes Audioformat)", oder, wenn die Anfrage nicht ankommt, "Die Datei konnte nicht gesendet werden" mit dem Hinweis, die Verbindung zu prüfen und dass die Datei auf dem Gerät liegt und nicht nur in der Cloud. Antwortet Home Assistant unerwartet, nennt die Meldung den Statuscode und verweist auf das Protokoll von Home Assistant, in dem die Ursache jetzt steht. Eine Datei, die sich nicht lesen lässt, endet nie als Serverfehler.
- **Prüfung durch Home Assistant (hassfest).** Die Integration führt ffmpeg als optionale Abhängigkeit (`after_dependencies`); ohne sie scheiterte die Prüfung von 1.39.0. Ein neuer Test vergleicht jede importierte Integration mit dem Manifest, damit das nicht mehr unbemerkt passiert.

## [1.39.0] - 2026-11-15

### Hinzugefügt

- **Eigene Töne.** Überall, wo ein Ton gewählt wird (Alarmton, Voralarm, Aktivierungs- und Deaktivierungston), endet die Liste mit "Eigenen Ton hochladen …": Namen geben, Datei wählen, fertig. Der Ton steht danach in der Liste jedes Schritts und jeder Alarmanlage; ein Schritt verweist nur auf ihn, ein kopierter Schritt kopiert nie die Datei. In Konfiguration › Anlage listet das neue Kapitel "Eigene Töne" sie mit Abspielen, Umbenennen und Löschen. Formate: WAV immer; MP3, OGG, FLAC und M4A, wenn ffmpeg in Home Assistant vorhanden ist (sonst sagt das Formular es). Grenzen: 20 Töne, 8 MB je Datei, 30 Sekunden, 12 MB insgesamt. Hochladen dürfen nur Administratoren. Das Format wird am Inhalt erkannt, nie an der Endung. Eigene Töne gehören zur Sicherung und kommen beim Wiederherstellen zurück.
- **Ein gelöschter Ton macht keinen Alarm stumm.** Vor dem Löschen eines genutzten Tons fragt das Fenster nach und nennt die Zahl der Schritte und die Alarmanlagen. Danach spielen diese Schritte den Standardton ihrer Art (Alarmton, Voralarm, Aktivierungs-, Deaktivierungston) und zeigen "Eigener Ton gelöscht (Standardton spielt)".

### Geändert

- **Hinweis zur Vorschau.** Er lautet jetzt "Vorschau spielt auf diesem Gerät und nicht auf der echten Anlage." statt Handy oder Computer zu nennen.
- **Reiter im Sensorfenster** sind immer gleich breit und füllen die ganze Leiste, auch bei nur zwei Reitern und auf dem Handy. Text, der nicht passt, wird mit "…" gekürzt statt abgeschnitten.
- **Titel des Fensters "Ansicht"** ist etwas grösser als die Kapiteltitel darunter, nicht fett. Dasselbe gilt für die Titel der anderen Fenster.

## [1.38.0] - 2026-11-15

### Hinzugefügt

- **Kopieren-Knopf für jede Angabe zu einem Gerät.** Im Fenster eines Sensors zeigt der Reiter "Gerät" hinter jeder Angabe (Hersteller, Modell, Firmware, Integration, Bereich, Entität) einen kleinen Knopf. Er kopiert den ganzen Wert, auch den langen Namen der Entität, den die Zeile abschneidet, und zeigt ein Häkchen. Erlaubt der Browser die Zwischenablage nicht (Companion App ohne HTTPS), gilt ein Ersatzweg.

### Geändert

- **Die Reiter des Sensorfensters sehen aus wie alle anderen Reiter.** "Verlauf", "Batterie", "Empfang" und "Gerät" oben sind eine verbundene Leiste mit gleitender Kapsel unter dem gewählten Reiter, wie überall im Panel, statt einzelner Kacheln mit blauem Rahmen. Grösse und die zwei Zeilen (Beschriftung oben, Wert darunter) bleiben.

## [1.37.0] - 2026-11-15

### Hinzugefügt

- **Einen Geräteschritt nach einer Zeit rückgängig machen.** Der Schritt "Gerät schalten" hat eine neue, optionale Einstellung "Nach einer Zeit rückgängig machen": nach der eingestellten Zeit (1 Sekunde bis 1 Stunde) folgt das Gegenteil, zum Beispiel bei einer Steckdose mit Sirene: ein, nach 2 Minuten aus; auch öffnen und schliessen, verriegeln und entriegeln; "Umschalten" schaltet wieder um. Die Karte des Schritts zeigt es ("Ausschalten nach 2 min"). Die Zeit bestimmst allein du, sie zählt ab dem Aufruf, auch über ein Neuladen oder einen Neustart von Home Assistant (nach einem Neustart läuft nur der Rest; war die Zeit inzwischen um, schaltet es sofort zurück). Deaktivieren, Quittieren und das Ende eines Tests schalten sofort zurück: eine Steckdose mit Sirene bleibt nie länger an als der Alarm. Der Gegenaufruf ist wie jeder Aufruf begrenzt (10 Sekunden), ein Gerät, das nicht antwortet, hält nichts auf. Schritte ohne Gegenteil (Position setzen, Temperatur setzen, Szene, eigener Dienst) bieten es nicht an.

## [1.36.1] - 2026-11-15

### Geändert

- **Mehr Platz für die Sensoren auf einem Tablet.** Auf einem Tablet (iPad im Querformat, mit oder ohne Seitenleiste von Home Assistant; Panel schmaler als 1200 Pixel) scrollt die Übersicht jetzt wie auf dem Handy: die Kopfzeile und die Kacheln der Alarmanlage und des Status scrollen weg, nur Suche und Filter bleiben oben stehen, und die Abstände bleiben beim Scrollen gleich. Ab etwa 14 Zoll (Panel 1200 Pixel und breiter) ändert sich nichts: Kopfzeile, Kacheln und Filter bleiben fest.

## [1.36.0] - 2026-11-15

### Hinzugefügt

- **Einen Schritt duplizieren.** Jeder Schritt der Aktionen hat einen neuen Knopf mit zwei Quadraten, zwischen "Bearbeiten" und "Löschen". Er legt direkt unter dem Schritt eine gleiche Kopie an, in derselben Liste (in den Verzögerungen, beim Scharfschalten, beim Alarm, nach dem Quittieren, beim Deaktivieren). Die Kopie ist vom Original unabhängig. Wie jede Änderung ist sie ein Entwurf, bis du speicherst. Eine Liste hat höchstens 40 Schritte; bei dieser Zahl ist der Knopf abgeschaltet.

## [1.35.5] - 2026-11-15

### Behoben

- **Lautstärke eines Tons: Karte und Fenster stimmten nicht überein.** Hatte ein Ton-Schritt eine eigene Lautstärke je Medienplayer und waren alle gleich (zum Beispiel 80 %), zeigte die Karte in der Liste weiter den alten gemeinsamen Wert (75 %), der im Fenster gar nicht mehr zu sehen ist, und das Speichern behielt diesen alten Wert. Die Karte zeigt jetzt den Wert, der wirklich spielt, und beim Übernehmen des Fensters werden gleiche Werte zur gemeinsamen Lautstärke. Schritte, die vor dieser Korrektur gespeichert wurden, zeigen sofort den richtigen Wert.

## [1.35.4] - 2026-11-15

### Behoben

- **Der Test eines Tons endet, wenn der Ton vorbei ist.** Der Stopp-Knopf eines getesteten Schritts blieb stehen, bis das Zeitfenster eines Tests (60 Sekunden) um war, auch wenn ein kurzer Ton längst zu Ende war. Ein Test, der nur Töne spielt, endet jetzt mit dem Ton, und das Panel fragt alle paar Sekunden nach, damit der Knopf von selbst verschwindet. Ein Test mit Geräteaktion (Licht, Schalter einer Sirene) bleibt bis zum Ende des Zeitfensters, damit man die Wirkung sieht, bevor alles zurückgestellt wird.

### Geändert

- **Der Stopp-Knopf eines laufenden Tests ist rot und pulsiert,** am Schritt und unten ("Test stoppen"). Man sieht auf einen Blick, dass etwas läuft und wo man es anhält. Ist am Gerät "Bewegung reduzieren" eingestellt, pulsiert er nicht.

## [1.35.3] - 2026-11-14

### Geändert

- **Das Fenster "Ansicht" ist am Computer breiter** (680 statt 420 Pixel): die Auswahl "Gruppieren nach" steht in einer Zeile, die Spalten haben Platz. Auf dem Handy füllt das Fenster weiterhin den Bildschirm.

## [1.35.2] - 2026-11-14

### Behoben

- **Der Test eines Tons "solange die Verzögerung läuft" spielt die ganze Verzögerung.** Der Test-Knopf eines Schritts wie dem Aktivierungston (oder dem Voralarm) piepste nur wenige Sekunden, weil während eines Tests keine Verzögerung läuft. Er spielt jetzt so lange, wie die Verzögerung des Modus eingestellt ist (Ausgangsverzögerung beim Aktivierungston, Eingangsverzögerung beim Voralarm), höchstens aber so lange, wie ein Test dauert (60 Sekunden). Stopp beendet ihn früher. Ist für den Modus keine Verzögerung eingestellt, gilt wie bisher die Dauer des Schritts.

## [1.35.1] - 2026-11-14

### Geändert

- **Ein eindeutigeres Symbol für "Ansicht":** der Knopf neben dem Suchfeld (auf dem Handy nur das Symbol) ist ein Auge mit Zahnrad statt drei Spalten, damit klar ist, dass er die Einstellungen der Ansicht öffnet. Der Knopf hat ausserdem einen Namen für Hilfsmittel und einen Tooltip.

## [1.35.0] - 2026-11-14

### Geändert

- **Das Panel startet nach 30 Minuten Abwesenheit wieder auf der Übersicht.** Bisher merkte es sich für immer, wo man zuletzt war (eine Seite der Konfiguration, ein Modus der Aktionen). Jetzt gilt das nur noch 30 Minuten: wer später zurückkommt, landet auf der Übersicht, in der Konfiguration auf "Sensoren". Das gilt beim erneuten Öffnen des Panels und wenn das Panel im Hintergrund offen blieb (Handy). Ungespeicherte Änderungen gehen vor: wer mitten in einer Bearbeitung war, bleibt dort. Die gewählte Alarmanlage, die Ansicht der Liste und die Filter des Protokolls bleiben wie bisher gemerkt.

## [1.34.4] - 2026-11-14

### Geändert

- **"Ansicht" sieht aus wie die Einstellungen:** die Abschnitte des Fensters (Darstellung, Gruppieren nach, Sortieren nach, Spalten, Angaben auf den Karten, Namen) haben jetzt denselben fetten Titel mit dem blauen Strich wie die Kapitel der Konfiguration, in derselben Grösse, statt kleiner grauer Grossbuchstaben.

## [1.34.3] - 2026-11-14

### Behoben

- **"Deaktiviert seit 08:26" springt bei einem Neustart von Home Assistant nicht mehr.** Die Zeit neben dem Zustand ("seit …", auch im Alarmband: "… um …") kam aus `last_changed` der Entität, und Home Assistant setzt sie beim Neustart auf dessen Zeit. Die Alarmanlage merkt sich jetzt die Zeit ihres letzten Zustandswechsels selbst, im gespeicherten Stand, und zeigt sie im Panel und auf den Karten. Neues Attribut `state_since` der Alarm-Entität. Hat sich der Zustand während des Neustarts geändert (eine Eingangsverzögerung ist abgelaufen), gilt die Zeit des Neustarts, wie es sein soll. Gespeicherte Stände von vor dieser Version kennen die Zeit nicht: sie zeigen bis zum nächsten Wechsel die von Home Assistant.

## [1.34.2] - 2026-11-14

Die Texte gehen nicht mehr davon aus, dass alle Apple Home oder Sonos nutzen.

### Geändert

- **Neutrale Formulierungen:** die Texte des Panels und die README nennen Apple Home nur noch als Beispiel für ein angebundenes System ("auch in angebundenen Systemen, zum Beispiel Apple Home") und erwähnen Sonos nicht mehr: Töne spielen auf "Medienplayern", und Player, die ihre ganze Wiedergabe sichern können (Quelle, Titel, Gruppe), nutzen das. Der Abschnitt "Apple HomeKit" der README bleibt als Anleitung für alle, die es nutzen. Am Verhalten ändert sich nichts.

## [1.34.1] - 2026-11-13

Die Dashboard-Karten sehen im dunklen Thema richtig aus, und die README sagt, was zu tun ist, wenn eine Karte nicht erscheint.

### Behoben

- **Dunkles Thema bei den Karten:** die Karten wussten nicht, dass das Dashboard dunkel ist, das Alarmband wurde im hellen Stil gezeichnet. Sie folgen jetzt dem Thema von Home Assistant.

### Geändert

- **README:** der Abschnitt "Dashboard-Karten" nennt, was zu tun ist, wenn die Karte im Auswahldialog nicht erscheint (Home Assistant neu starten, Seite neu laden oder den Frontend-Cache der App zurücksetzen, mit YAML testen).

## [1.34.0] - 2026-11-13

Zwei Dashboard-Karten: das Bedienteil und die Info-Kachel des Seitenpanels, für jedes Dashboard und jede Person.

### Hinzugefügt

- **Karte "Alarmageddon":** das Bedienteil des Seitenpanels als Dashboard-Karte. Sie zeigt den Zustand, die Modi zum Scharfschalten, "Bereit für" und bei einem Alarm das Alarmband mit "Quittieren" und "Deaktivieren". Sie sieht aus wie das Seitenpanel (hell und dunkel, Deutsch und Englisch).
- **Karte "Alarmageddon Status":** die Info-Kachel als Karte: Alarm, nicht erreichbare Sensoren und schwache Batterien, mit den Namen der Sensoren.
- **Karten hinzufügen:** beide Karten stehen in der Kartenauswahl ("Karte hinzufügen" › "Alarmageddon") und werden von der Integration selbst registriert, ohne Eintrag bei den Ressourcen. Der Karteneditor bietet die Alarmanlage, einen Namen und die Auswahl der angezeigten Teile.
- **Dienst `alarmageddon.acknowledge`:** stellt einen laufenden Alarm für jede Person ab, die die Karte benutzen darf, nicht nur für Administratoren. Ohne laufenden Alarm wird er abgelehnt.
- **Einstellung "Quittieren verlangt den Code":** in Konfiguration › Anlage (und im Optionsdialog von Home Assistant). Standardmässig aus; ist sie an, fragt "Quittieren" nach einem Code. Braucht einen programmierten Code; sie wird zurückgesetzt, wenn der Code entfernt wird.
- **Status-Entität je Alarmanlage** (`sensor.<name>_status`): die Zahl der offenen Probleme (Alarm, nicht erreichbare Sensoren, schwache Batterien); die Attribute nennen die Sensoren. Die Status-Karte liest sie.

### Geändert

- **Codes auf der Karte:** ist ein Code programmiert, fragt die Karte beim Deaktivieren danach (und beim Scharfschalten, wenn dafür der Code nötig ist), genau wie die Entität. Der Code bleibt nach dem Schliessen des Fensters nirgends in der Seite.
- **Das Seitenpanel bleibt nur für Administratoren.** Die Karten kann man jeder Person geben; sie nutzen nur Entitäten und Dienste von Home Assistant.

## [1.33.1] - 2026-11-13

Eine vollständige Code-Prüfung von allem, was zuletzt entstanden ist: eine Sicherheitskorrektur im Zustandsautomaten, ein robusterer Start und Stopp und Aufräumen, das für dich nichts ändert.

### Entfernt

- **Reste ohne Funktion:** fünf ungenutzte Konstanten und eine ungenutzte Methode der Integration; ungenutzte Stilregeln, drei ungenutzte Texte, einige ungenutzte Variablen und ein Klick-Zweig, den nichts auslöste, im Panel. Für dich ändert sich nichts.

### Behoben

- **Ein wartender Zeitgeber konnte ein zweites Mal auslösen (Sicherheit).** Löste ein zweiter Sensor in der Eingangsverzögerung aus, oder schlugen Rauch, Wasser, Gas oder "Panik" in der Eingangs- oder Ausgangsverzögerung an, begann der Alarm sofort, aber der Zeitgeber der laufenden Verzögerung wurde nicht abgebrochen, und "Deaktivieren" fand ihn nicht. So konnte der alte Zeitgeber nach dem Deaktivieren bei einer deaktivierten Alarmanlage Alarm auslösen, und am Ende einer Ausgangsverzögerung wurde ein schon laufender Alarm still zu "scharf". Jeder Wechsel des Zustands bricht jetzt den wartenden Zeitgeber ab. Quittierst du einen Alarm, der in der Ausgangsverzögerung begann (die Alarmanlage war nie scharf), zeigt die Kachel danach auch, seit wann sie scharf ist.
- **Ein Fehler in der Statistik hätte den Alarm aufhalten können.** Die Stundenzähler der Sensoransicht und die "Letzte Änderung" der Liste wurden vor der Alarmlogik geschrieben; scheiterte das, lief die Alarmlogik nicht. Jetzt läuft sie immer, und der Fehler steht im Log.
- **Ein scheiternder Zusatz nimmt die Alarmanlage nicht mehr mit.** Scheitert das Laden der Statistik, des Ereignisprotokolls oder der Alarmaufzeichnungen, der Start der Alarmaktionen oder der Start der Wartungsprüfung (zum Beispiel eine unlesbare Datei), startet die Alarmanlage trotzdem, hört auf ihre Sensoren und meldet; der Fehler steht im Log. Beim Entladen lässt ein Fehler beim Speichern des Ereignisprotokolls, der Aufzeichnungen oder der Aktionen die Alarmanlage nicht mehr ohne ihre Entität zurück, bis Home Assistant neu startet.
- **Beschädigte Code-Einträge:** ein Hauptcode ohne Salz oder ein Salz, das kein Hex-Text ist, lässt das Scharf- und Deaktivieren nicht mehr mit jedem Code scheitern. Der Eintrag wird übersprungen, die anderen Codes funktionieren weiter.
- **Alarmanlage löschen:** der Zustand wird nach dem Anlegen der Sicherung noch einmal geprüft. Wurde die Alarmanlage inzwischen scharf geschaltet oder löste aus, wird sie nicht gelöscht.
- **Platzhalter in Texten:** `{name}`, `{sensor}` und die übrigen werden in einem Durchgang ersetzt. Bisher wurde ein Wert, der selbst einen Platzhalter enthielt (eine Alarmanlage namens "Haus {sensor}"), ein zweites Mal ersetzt, in der Meldung und in der Vorschau des Panels.
- **Zwei Alarmanlagen, die zusammen starten,** konnten beim Start einige Stundenzähler der Sensoransicht verlieren: die zweite arbeitete mit einer Statistik, die noch nicht geladen war.
- **Schritte der Alarmaktionen** teilten sich einen leeren Standardwert für "data" und für die Ziele; jetzt hat jeder Schritt seinen eigenen (keine bekannte Wirkung, vorsorglich geändert).
- **CSV-Export des Protokolls:** Zellen, die mit einem Tabulator oder Zeilenumbruch beginnen, werden wie Zellen mit einem Formelzeichen am Anfang entschärft (Empfehlung von OWASP).
- **Aktion testen:** der Play-Knopf einer Aktion konnte nach einem anderen Test bis zu eine Minute gesperrt bleiben, auch wenn dessen Ton längst zu Ende war, weil ein Test die Alarmaktionen bis zum Ende seines Zeitfensters als "laufend" hielt. Jetzt beendet ein neuer Test den laufenden und startet (die Geräte des alten Tests kehren zurück): es läuft immer nur ein Test, und kein Play-Knopf bleibt gesperrt. Ein echter Alarm wird nie ersetzt: während eines Alarms lässt sich nichts testen.
- **"Aktionen übernehmen von …"** tat nichts, wenn die Aktionen beider Modi gleich waren und nur ein Detail im Schritt abwich (zum Beispiel die Lautstärke eines Lautsprechers), oder wenn sich nur "Beim Scharfschalten", die Verzögerungen oder "Beim Deaktivieren" unterschieden. Der Vergleich sah nur die Hauptliste, "Alarm endet" und "Danach", und nur die Aktionen, nicht die Einstellungen darin. Jetzt wird alles verglichen, auch alle Listen und die Details jedes Schritts.
- **Die letzte Alarmanlage löschen** zeigt sofort die leere Seite. Bisher wartete das Panel bis zu 30 Sekunden mit der Ladeanzeige und der schon gelöschten Alarmanlage, als würde sie neu geladen.
- **Die Auswahl der Alarmanlage in der Kopfzeile** (bei mehreren Alarmanlagen) wird beim Auffrischen nicht mehr neu gezeichnet; ein geöffnetes Dropdown klappt nicht mehr alle 30 Sekunden zu.
- **Empfänger für Alarme und Wartung** werden wie die Listen je Meldungsart und je Schritt geprüft: nur gültige Namen von notify-Diensten (`notify.` und Buchstaben, Ziffern, Unterstrich). Ungültige Einträge fallen weg; es gibt keine Obergrenze, damit nie ein Empfänger still verloren geht.
- **Tests:** neue Tests für die wartenden Zeitgeber (`tests/test_stale_timers.py`), das Mitschreiben, Start und Stopp, beschädigte Codes, das Rennen beim Löschen, die Platzhalter und das Panel; die Mutationsprobe hat für jede dieser Schutzmassnahmen neue Zeilen.

### Sicherheit

- **Ein getippter Code bleibt nie in einem geschlossenen Fenster stehen.** Die Code-Felder von "Code hinzufügen" und des Fensters zum Scharf- und Deaktivieren werden geleert, sobald das Fenster schliesst, egal wie. Bisher blieb der getippte Code im versteckten Fenster der Seite stehen, bis es das nächste Mal öffnete.

## [1.33.0] - 2026-11-13

Eine Sicherung auf jede Alarmanlage wiederherstellen, gleich wie sie heisst.

### Geändert

- **Beim Wiederherstellen wählst du für jede Anlage der Sicherung das Ziel; der Name spielt keine Rolle mehr.** Bisher liess sich eine Sicherung nur auf eine Alarmanlage mit demselben Namen anwenden. Die Einstellungen haben mit dem Namen nichts zu tun, darum zeigt das Fenster jetzt für jede Anlage der Sicherung eine Karte mit einer Wahl: **auf eine bestehende Anlage anwenden** (auf irgendeine, auch mit anderem Namen), **als neue Anlage hinzufügen** (mit einem Namen, den du ändern kannst; sie entsteht ohne Code und bekommt die gesicherten Einstellungen) oder **nicht wiederherstellen**. Vorgeschlagen bleibt das Bisherige: die Anlage mit demselben Namen, und eine neue Anlage, wo es keine gibt. Eine gelöschte Anlage kommt damit direkt aus ihrer Sicherung zurück. "Wiederherstellen" bleibt gesperrt, solange zwei Anlagen der Sicherung dasselbe Ziel haben oder ein neuer Name leer, schon vergeben oder doppelt ist. Ein Schalter bestimmt, ob auch die **gemeinsamen Einstellungen** (Voreinstellungen je Sensorart, Meldungen, Anzeige der Namen) wiederhergestellt werden; wie bisher ist er an. Codes sind weiterhin nie Teil einer Sicherung und bleiben, wie sie sind. Der Server prüft die ganze Wahl, bevor er etwas ändert.
- **Die Warnung beim Löschen einer Anlage** sagt nicht mehr, dass eine Sicherung sie nicht zurückbringen kann: mit der Sicherung lassen sich ihre Einstellungen später wiederherstellen, als neue Anlage oder auf eine andere.

## [1.32.0] - 2026-11-13

Alarmanlage im Panel löschen.

### Hinzugefügt

- **Eine Alarmanlage löschen.** Ganz unten in Konfiguration › Anlage, unter den Sicherungen, steht ein neues Kapitel "Anlage löschen" mit einem roten Textknopf. Er öffnet einen Warn-Dialog, der sagt, was verschwindet (das Gerät und alle seine Entitäten, ihre Sensoren, Aktionen, Zeitpläne und Codes, ihr Protokoll und ihre Aufzeichnungen) und was bleibt (die anderen Alarmanlagen, die Voreinstellungen je Sensorart, die Empfänger der Meldungen, Sicherungen), und der daran erinnert, dass Automationen, Szenen, Dashboards und Apple Home, die die Alarm-Entität nutzen, du selbst anpassen musst. "Endgültig löschen" wird erst frei, wenn du den genauen Namen der Alarmanlage eingetippt hast. Ein Schalter "Vorher eine Sicherung anlegen" ist standardmässig an; er belegt einen der 10 Sicherungsplätze. Eine Sicherung bringt eine gelöschte Alarmanlage nicht von selbst zurück, aber legst du eine Alarmanlage mit demselben Namen neu an und stellst die Sicherung wieder her, sind ihre Einstellungen zurück.
- **Nur im deaktivierten Zustand.** Eine scharfe Alarmanlage, eine in der Ausgangs- oder Eingangsverzögerung und eine im Alarm lässt sich nicht löschen; der Knopf ist gesperrt und sagt es, und auch der Server lehnt es ab (sie verschwindet nie still, während sie das Haus schützt). Ein Code wird nicht verlangt.
- **Neuer Befehl für Administratoren:** `delete_system`. Ohne Administratorrechte lässt sich keine Alarmanlage löschen. Er prüft Zustand und eingetippten Namen auf dem Server, nicht nur im Panel, und legt die Sicherung nur an, wenn beides stimmt.

## [1.31.0] - 2026-11-13

Alarmanlage im Panel hinzufügen.

### Hinzugefügt

- **Der Knopf "Anlage hinzufügen" ist zurück in der Kopfzeile und öffnet jetzt einen eigenen Dialog im Panel** statt Home Assistant. Am Computer steht er als "+ Anlage hinzufügen" neben "Integration in HA öffnen"; auf dem Handy ist es nur ein kleines rundes Plus, gleich gross und gleich geformt wie der Knopf zu Home Assistant. Der Dialog hat einen kurzen Erklärungstext, ein Namensfeld und eine **Vorschau der Identität**: den Namen des Geräts und die Entitäts-ID, die Home Assistant der Alarm-Entität gibt (zum Beispiel `alarm_control_panel.garage_nord`, Umlaute und belegte IDs rechnet der Server). Ein leerer und ein schon vergebener Name (Gross-/Kleinschreibung zählt nicht) werden abgelehnt, bevor du "Hinzufügen" drückst. Danach wechselt das Panel zur neuen Alarmanlage, in Konfiguration › Sensoren, damit du gleich ihre Sensoren wählen kannst; offene Änderungen an der bisherigen Anlage werden vorher nachgefragt. Modi, Aktionen und den Code stellst du danach in der Konfiguration ein; der Code wird nie in diesem Dialog eingegeben. Die leere Seite ohne jede Alarmanlage nutzt denselben Dialog. Das Hinzufügen in Home Assistant funktioniert weiter wie bisher.
- **Zwei neue Befehle für Administratoren:** `create_system` und `preview_system`. Ohne Administratorrechte lässt sich weder eine Anlage hinzufügen noch die Vorschau abfragen.

## [1.30.0] - 2026-11-13

Kein Knopf "+ Alarmanlage" mehr in der Kopfzeile.

### Entfernt

- **Der Knopf "+ Alarmanlage" oben rechts in der Übersicht auf dem Desktop ist weg.** Er führte an denselben Ort wie der Knopf "Integration in HA öffnen" daneben: zur Seite der Integration in Home Assistant, wo man eine Alarmanlage hinzufügt. Der Knopf "Integration in HA öffnen" bleibt. Auf dem Handy gab es den Knopf schon vorher nicht. Nur ohne jede Alarmanlage bietet die leere Seite weiterhin den Knopf zum Einrichten an.

## [1.29.0] - 2026-11-13

Alle Sensorkarten sind gleich hoch.

### Geändert

- **Die Sensorkarten der Übersicht sind immer gleich hoch,** im Raster auf dem Desktop und untereinander auf dem Handy, gleich bei welchem Sensor. Bisher war eine Karte so hoch wie ihr Inhalt: ein langer Name, ein Netzgerät ohne Batterie oder ein fehlender Wert machten die Karten ungleich. Jetzt hat jede Karte Platz für **drei Zeilen Name**; ein längerer Name wird mit "…" gekürzt (voll steht er im Tooltip und in den Optionen des Sensors). Die Zeile mit Batterie, Prognose, Empfang und Firmware hat eine feste Höhe (ab drei Angaben zwei Zeilen), und jede Angabe, die du unter "Ansicht" einschaltest (Modell, Integration, Letzte Änderung), steht immer da, mit "–", wo es keinen Wert gibt. Schaltest du unter "Ansicht" Angaben ab, werden alle Karten gleichmässig niedriger.

## [1.28.0] - 2026-11-13

Push-Meldungen, die sagen, was passiert ist: neue Platzhalter und passende Standardtexte.

### Hinzugefügt

- **Drei neue Platzhalter für den eigenen Push-Text:** `{type}` (die Art des Sensors in Worten, zum Beispiel "Rauchmelder" oder "Fenster"), `{area}` (der Raum oder Bereich des Sensors) und `{alarm}` (die Alarmart: "Feueralarm", "Wasseralarm", "Gasalarm", "Hitzealarm", "Einbruchalarm", sonst "Alarm"). Sie gelten in denselben Feldern wie `{name}`, `{sensor}`, `{time}` und `{mode}`: im Push-Schritt der Alarmaktionen und in der eigenen Meldung von "Alarm endet". Das Panel zeigt sie als Knöpfe und füllt die Vorschau mit dem ersten Sensor des Modus. Bei einem Alarm von Hand gibt es keinen Sensor: `{type}` und `{area}` bleiben leer, `{alarm}` lautet "Alarm".
- **Passender Standardtext für Rauch, Wasser, Gas und Hitze.** Ohne eigenen Text sendet ein Rauchmelder jetzt "🔥 Feueralarm: …" mit "… meldet Rauch um …", ein Wassersensor "💧 Wasseralarm", ein Gas- oder CO-Sensor "⚠️ Gasalarm" und ein Hitzemelder "🌡️ Hitzealarm". Türen, Fenster und Bewegungsmelder behalten den Standardtext wie bisher. Ein eigener Text gilt immer.

### Behoben

- **"Alarm endet" kennt jetzt den Sensor, der den Alarm ausgelöst hat.** Der Platzhalter `{sensor}` in der eigenen Meldung von "Alarm endet" blieb leer, wenn der Alarm durch Deaktivieren oder Quittieren endete, weil die Alarmanlage den Sensor da schon vergessen hatte. Die Meldungsstelle merkt ihn sich jetzt für den laufenden Alarm (auch über einen Neustart von Home Assistant).

## [1.27.0] - 2026-11-12

Aktionen beim Deaktivieren, mit einem Deaktivierungston.

### Hinzugefügt

- **Neues Kapitel "Beim Deaktivieren" ganz unten auf der Seite "Aktionen".** Unter dem festen Punkt "Anlage deaktiviert" steht eine eigene Liste mit einem Plus, wie beim Scharfschalten. Was dort steht, **läuft immer, wenn die Alarmanlage deaktiviert wird**: aus dem scharfen Zustand, mitten in der Ausgangs- oder Eingangsverzögerung und im Alarm (dann nach den Aktionen nach dem Quittieren). Es gilt je Modus, für den Modus, der scharf war; "Immer aktiv" hat keine. Möglich sind ein Deaktivierungston, ein Gerät, Warten, eine Szene oder eine eigene Aktion. Wieder scharf schalten oder ein Alarm beendet sie sofort, und der Alarm wartet nie darauf (auch ein hängender Lautsprecher hält nichts auf).
- **Neue Art von Ton: der Deaktivierungston,** das Gegenstück zum Aktivierungston. Er ist kurz, hat eine Dauer, die du wählst, läuft nie endlos und stellt den Lautsprecher danach zurück (standardmässig an, je Schritt abschaltbar). Er hat **fünf eigene Klänge**, die zu den Aktivierungstönen passen, aber fallen statt steigen: "Dreiklang absteigend", "Abschluss, zwei Töne", "Tiefe Glocke", "Sanft ausklingend" und "Doppelpiep, fallend". Jeder lässt sich im Panel probehören.
- **In der Sicherung und bei "Aktionen übernehmen von".** Die Liste gehört zu den Einstellungen, die gesichert und wiederhergestellt werden, und sie wird mit den anderen Listen kopiert.

### Geändert

- **Drag and Drop kennt die neue Liste.** Ein Schritt lässt sich wie in die anderen Listen nach "Beim Deaktivieren" ziehen, aber nur, was dort hingehört (Gerät, Warten, Szene, eigene Aktion, Deaktivierungston); der Deaktivierungston geht in keine andere Liste.

## [1.26.0] - 2026-11-12

Nicht veröffentlicht; enthalten in 1.27.0.

Jeder Ton stellt den Lautsprecher danach zurück.

### Hinzugefügt

- **"Lautsprecher danach zurückstellen" bei jeder Art von Ton.** Aktivierungston, Voralarm und der Alarmton in den Listen ausserhalb des Alarmablaufs (beim Scharfschalten, während der Verzögerungen, nach dem Quittieren) merken sich vor dem Start, wie der Lautsprecher war: ein oder aus, Lautstärke, Stummschaltung, bei Sonos die ganze Wiedergabe mit Quelle und Gruppe. Sie spielen in der gewählten Lautstärke und stellen den Lautsprecher danach zurück, schalten ihn auch wieder aus, wenn er aus war. **Standardmässig an**, und jeder Schritt kann es abschalten (Schalter im Schritt). Auch Schritte, die vor 1.26.0 ohne diese Angabe gespeichert wurden, stellen zurück.
- **Auch wenn mitten im Ton deaktiviert wird**, und für einen Voralarm im Alarmablauf, der nun beim Deaktivieren ebenfalls mit den anderen Geräten zurückkehrt.

### Geändert

- **Ein Lautsprecher, der aus war, wird wieder ausgeschaltet**, wenn der Alarmton beim Deaktivieren zurückgestellt wird (vorher blieb er nach dem Ton an).
- **Sicher wie bisher.** Merken und Zurückstellen sind nie ein Hindernis: Antwortet ein Lautsprecher nicht, gehen Ton, Ablauf und Sirene nach den Zeitgrenzen weiter (Tests mit hängenden und scheiternden Lautsprechern, dazu in der Mutationsprobe).
- **Aktionen: kein Hinweisfeld mehr in einem leeren Ablauf.** Unter "Alarm beginnt" genügt das Plus; das Feld "Noch keine Aktionen. Füge einen ersten Schritt hinzu …" mit eigenem Knopf entfällt und nimmt keinen Platz mehr weg.
- **Aktionen: das Feld unter "Alarm endet" heisst nur noch "Abschlussmeldung".** Die lange Beschreibung entfällt; nur wenn noch keine eigene Meldung geschrieben ist, steht dort "Standard: "Alarm beendet"".
- **Aktionen: die Vorschau eines Tons ist ein einziger Knopf, wie bei den Testknöpfen.** Er beginnt als Play-Zeichen und wird beim Abspielen zum Stopp-Zeichen; der getrennte Pause-Knopf entfällt. Die gelbe Umrandung bleibt, weil sie auf den Hinweis verweist, dass die Vorschau auf diesem Handy oder Computer spielt und nicht auf der echten Anlage.
- **Benachrichtigungen: die Empfängergruppe einer Meldung lässt sich zuerst entfernen.** Bei jeder Art von Meldung (und je Modus) lässt sich jetzt auch der letzte Empfänger entfernen, wie oben bei den Empfängern von Alarmen. Es erscheint eine Warnung. Speichert man ohne Empfänger, geht der Schalter dieser Meldung automatisch aus und ihre eigene Liste kehrt zum Standard zurück, damit nichts aktiv aussieht, was nicht aktiv ist. Vorher liess sich der letzte nicht entfernen, man musste zuerst den neuen hinzufügen.
- **Tablet (iPad im Querformat): die Optionen eines Sensors öffnen als Fenster und scrollen.** Unter 1300 px Breite liegt das Blatt nicht mehr über der Sensortabelle (der Tabellenkopf verdeckte seinen Titel). Es öffnet wie auf dem Handy als Fenster in der Mitte mit eigenem Scrollen und dem Knopf "Fertig". Auf breiten Bildschirmen bleibt das Blatt neben der Tabelle, ist aber nie höher als der sichtbare Bereich: der Kopf steht fest, die Optionen scrollen darin.
- **Die Kachel "Einstellungen pro Modus" ist nur so breit wie nötig**.
- Alarmtöne in den Listen ausserhalb des Alarmablaufs, die früher mit "Rückgängig" aus gespeichert wurden, behalten diesen Wert; im Schritt lässt er sich einschalten.

## [1.25.1] - 2026-11-12

Nicht veröffentlicht; enthalten in 1.27.0.

Einheitliche Benennung der Aktionen der Push-Meldung.

### Geändert

- **Benachrichtigungen › "Scharfschalten nicht möglich": die beiden Knöpfe heissen wie die anderen Aktionen der Push-Meldung.** Aus Knopf "Erneut versuchen" und Knopf "Trotzdem scharf schalten" wird Aktion "Erneut versuchen" und Aktion "Trotzdem scharf schalten", und ihre Beschreibung beginnt mit "Knopf unter der Meldung:", wie bei "Öffnen", "Quittieren" und "Deaktivieren".

## [1.25.0] - 2026-11-12

Das Abzeichen im Easter Egg ist ein massiver 3D-Körper.

### Geändert

- **Easter Egg: das Abzeichen ist dick, wie ein echtes Abzeichen.** Das Schild besteht aus vielen Ebenen in der Tiefe, hat beim Drehen sichtbare Dicke und sieht nicht mehr aus wie Papier. Vorder- und Rückseite haben einen runden Wulst mit Glanzlicht, die Seitenwand ist ein dunklerer Ton derselben Farben, und am Boden liegt ein weicher Schatten. Das Licht kommt von links oben: Die Helligkeit jeder Fläche folgt der Drehung, und ein Glanzstreifen läuft über die Vorderseite. Die Farben bleiben wie bisher.

## [1.24.0] - 2026-11-12

Nicht veröffentlicht; enthalten in 1.25.0.

Schritte ziehen: die Seite scrollt mit.

### Hinzugefügt

- **Die Seite scrollt beim Ziehen mit.** Hält man einen Schritt nahe am oberen oder unteren Rand des sichtbaren Bereichs (unter den festen Reitern, über der Leiste mit "Speichern"), scrollt die Seite von selbst, umso schneller, je näher am Rand. So erreicht man auch eine weit entfernte Liste in einem langen Ablauf. Bisher funktionierte das Scrollen am Rand im Panel nicht.
- **Eine Liste nimmt den Schritt auch an, wenn man ihn nur auf eine ihrer Aktionen zieht** oder knapp daneben (bis 48 px), nicht nur auf das Plus. Eine leere Liste gilt samt ihrem Plus.
- **Eine Liste, die den Schritt nicht aufnimmt, leuchtet rot.** Zum Beispiel die Sirene über "Eingangsverzögerung läuft": nichts wird verschoben, und man sieht, warum.

## [1.23.0] - 2026-11-12

Symbole in allen Auswahlknöpfen der Ansicht.

### Geändert

- **"Ansicht": jeder Auswahlknopf hat ein Symbol.** Im Fenster "Ansicht" der Sensorliste tragen "Liste" und "Karten" dieselben Symbole wie der Umschalter in der Werkzeugleiste, "Bereich", "Sensorart", "Anlage" und "Keine" (Gruppieren) sowie "Aufsteigend" und "Absteigend" je ein eigenes. Am Computer stehen die vier Gruppierknöpfe jetzt wie auf dem Handy in zwei Zeilen, damit nichts abgeschnitten wird.

## [1.22.0] - 2026-11-12

Nicht veröffentlicht; enthalten in 1.23.0.

Schritte per Ziehen zwischen den Listen verschieben.

### Hinzugefügt

- **Einen Schritt in eine andere Liste ziehen.** Auf der Seite "Aktionen" lässt sich ein Schritt am Griff jetzt auch auf eine andere Liste ziehen, auch auf eine leere (auf ihr Plus oder ihre Fläche). Die Liste leuchtet mit gestricheltem Rahmen auf, und beim Loslassen springt der Schritt dorthin. Das geht zwischen "Scharfschalten beginnt", "Anlage scharf geschaltet", "Eingangsverzögerung läuft", "Alarm beginnt" und "Nach dem Quittieren", aber nur in Listen, die diese Art von Schritt aufnehmen: die Sirene (Alarmton) geht nicht in eine Verzögerung, ein Voralarm nicht in "Scharfschalten beginnt", eine Meldung nur in den Alarmablauf.
- **Der Schritt wird für die neue Liste umgerechnet.** Ein Aktivierungston oder Voralarm, den man in eine Verzögerung zieht, folgt dieser Verzögerung (Schalter an, wie ein neuer Schritt dort); wieder herausgezogen hat er seine feste Dauer. Nach dem Quittieren kehrt nichts mehr zurück, wie bisher.
- **Tastatur statt Ziehen.** Pfeil nach oben beim ersten oder Pfeil nach unten beim letzten Schritt einer Liste verschiebt ihn in die nächste Liste, die ihn aufnimmt; der Fokus folgt.
## [1.21.0] - 2026-11-12

Nicht veröffentlicht; enthalten in 1.22.0.

Die Ladeanimation ignoriert "Bewegung reduzieren".

### Geändert

- **Ladeanimation der Grafiken: "Bewegung reduzieren" gilt nicht mehr.** Die drei kreisenden Punkte bewegen sich auch dann, wenn die Systemeinstellung "Bewegung reduzieren" an ist (Wunsch des Nutzers). Vorher pulsierten sie in diesem Fall nur sanft.

## [1.20.0] - 2026-11-12

Eine kleine Überraschung in der Kopfzeile.

### Hinzugefügt

- **Easter Egg: Dreifachklick aufs Logo.** Tippt man das Logo oben links dreimal rasch hintereinander an, zoomt es in die Bildmitte und wird zum Pop-up: Das Schild dreht sich um seine Achse, ein Lichtkegel kreist wie bei einer Sirenenleuchte, und das "A" pulsiert. Darunter steht die installierte Version. Ein Tipp irgendwohin oder Escape schliesst es. Auf dem Handy füllt es den ganzen Bildschirm. Die Animation läuft auch, wenn die Systemeinstellung "Bewegung reduzieren" an ist (Wunsch des Nutzers).

## [1.19.0] - 2026-11-12

Aktionen während der Ausgangs- und der Eingangsverzögerung.

### Hinzugefügt

- **Aktionen, solange die Ausgangsverzögerung läuft.** Die Aktionen-Seite hat vor "Anlage scharf geschaltet" einen neuen festen Punkt "Scharfschalten beginnt". Was du dort ablegst, startet, sobald jemand die Anlage scharf schaltet, zum Beispiel ein Aktivierungston, der alle zum Gehen auffordert. Ist die Anlage scharf, enden die Aktionen, ein laufender Ton verstummt, und die Schritte von "Anlage scharf geschaltet" folgen. Deaktivieren stoppt sie sofort.
- **Aktionen, solange die Eingangsverzögerung läuft.** Ein neuer fester Punkt "Eingangsverzögerung läuft" vor "Alarm beginnt": Schritte, die laufen, solange die Zeit zum Deaktivieren läuft, zum Beispiel ein Voralarm. Sie enden, wenn der Alarm beginnt (die Alarmaktionen übernehmen) oder die Anlage deaktiviert wird.
- **Ein Ton, der der Verzögerung folgt.** Bei Aktivierungston und Voralarm in diesen beiden Listen gibt es den Schalter "Solange die Ausgangsverzögerung läuft" (bzw. "Eingangsverzögerung"), bei neuen Schritten an. Der Ton dauert dann genau so lange wie die Verzögerung, die gerade läuft: der Wert des Modus, oder, hat der Sensor, der sie gestartet hat, eine eigene Eingangsverzögerung, deren Wert. Er folgt der Einstellung der Anlage; die feste Dauer gilt nur, wenn der Schalter aus ist. Die Karte des Schritts zeigt statt der Sekunden eine blaue Pille.
- **Zwei Kapitel.** Die Seite ist in "Beim Scharfschalten" und "Bei einem Alarm" gegliedert, die Punkte in der Reihenfolge der Zeit: Scharfschalten beginnt, scharf, Eingangsverzögerung läuft, Alarm beginnt, Alarm endet. Im Reiter "Immer aktiv" gibt es keines von beiden.
- **Nur wo es die Verzögerung gibt.** "Scharfschalten beginnt" steht nur in einem Modus, dessen Ausgangsverzögerung grösser als 0 ist, und "Eingangsverzögerung läuft" nur dort, wo eine Eingangsverzögerung laufen kann (ein Eingangssensor in der Zone, mit einer Verzögerung über 0). Gespeicherte Schritte bleiben erhalten.
- **Auch bei "Aktionen übernehmen von" und in der Sicherung.**

### Geändert

- **Der Alarm wartet nie auf diese Aktionen.** Ein Gerät, das während einer Verzögerung hängt oder scheitert, hält nichts auf: die Alarmaktionen starten in dem Moment, in dem der Alarm beginnt, das Ende der Aktionen der Verzögerung wird höchstens 3 Sekunden abgewartet. Ein Neuladen oder ein Neustart mitten in einer Verzögerung setzt nur die Töne für die Restzeit fort; ein Gerät wird nicht ein zweites Mal geschaltet.

## [1.18.1] - 2026-11-12

Der Testknopf eines Schritts wird zum Stopp-Knopf.

### Geändert

- **Aktionen: der Test eines Schritts wird beim Schritt gestoppt.** Testest du einen einzelnen Schritt, wird sein Play-Knopf zum Stopp-Knopf, und du beendest den Test genau dort. Der Knopf in der Fusszeile bleibt bei einem solchen Test gesperrt: er gehört zum Test des ganzen Ablaufs und ist während dieses Tests der Stopp-Knopf.

## [1.18.0] - 2026-11-12

"Scharfschalten nicht möglich" mit Knöpfen: erneut versuchen oder trotzdem scharf schalten.

### Hinzugefügt

- **Knöpfe in der Meldung "Scharfschalten nicht möglich".** Verhindert ein offener Sensor das Scharfschalten, trägt die Push-Meldung jetzt zwei Knöpfe. "Erneut versuchen" schaltet denselben Modus noch einmal scharf, zum Beispiel nachdem du das Fenster geschlossen hast; ist es noch offen, kommt die Meldung erneut. "Trotzdem scharf schalten" schaltet scharf, obwohl Sensoren offen sind: sie werden bis zum Deaktivieren übergangen und lösen keinen Alarm aus (angezeigt als übergangen wie mit der Option "Beim Scharfschalten umgehen"); alle anderen Sensoren werden überwacht.
- **Sicher gebaut.** Die Knöpfe gelten eine Stunde und nur, solange die Anlage deaktiviert ist; wurde sie scharf geschaltet (gleich auf welchem Weg), ist eine ältere Meldung verbraucht. Nur das Handy eines Empfängers dieser Meldung kann sie drücken. Scharf geschaltet wird der Modus, der gescheitert ist, mit seiner Ausgangsverzögerung. Ein Code ist nicht nötig, auch wenn die Anlage zum Scharfschalten einen verlangt.
- **Jeder Knopf lässt sich abschalten** unter Konfiguration › Meldungen › "Scharfschalten nicht möglich". Beide sind standardmässig an.

## [1.17.12] - 2026-11-12

Der orange Punkt verschwindet nach dem Speichern, und die Modi sind Schalter.

### Geändert

- **Anlage: je Modus ein Schalter.** Unter Konfiguration › Anlage sind die Modi Anwesend, Abwesend, Nacht und "Immer aktiv" keine Pillen mehr, sondern Zeilen wie die übrigen Einstellungen: Schalter links, Symbol, Name und eine kurze Beschreibung.

### Behoben

- **Anlage: "1 Änderung" und der orange Punkt blieben nach dem Speichern stehen.** Wer die Ausgangs- oder die Eingangsverzögerung änderte, während ein Modus abgeschaltet war (zum Beispiel Nacht), sah gleich nach dem Speichern wieder "1 Änderung", und erneutes Speichern half nicht. Das Panel speichert die Zeiten aller Modi, auch die eines abgeschalteten (er behält seine Werte), der Server meldete die Werte eines solchen Modus aber nicht zurück; das Panel hielt den gespeicherten Stand für geändert. Der Server meldet jetzt die Zeiten aller Modi. Die anderen Reiter speichern und lesen gleich zurück (mit Tests geprüft).

## [1.17.11] - 2026-11-11

Die Grafiken für Empfang und Batterie bleiben nicht mehr leer.

### Behoben

- **Sensoransicht: "In diesem Zeitraum gibt es noch keine Werte", obwohl es einen Wert gab.** Der Verlauf von Home Assistant kennt nur Wechsel. Änderte sich der Empfang (oder der Batteriestand) im gewählten Zeitraum nicht, gab es nur den Stand am Anfang, also einen einzigen Punkt, und statt der Grafik stand der Hinweis da, obwohl direkt darüber aktueller Wert, Mittel und schwächster Wert standen. Die Linie läuft jetzt bis jetzt und endet mit dem aktuellen Wert; ein gleichbleibender Wert ist eine waagrechte Linie. Liefert die Statistik von Home Assistant weniger als zwei Werte, wird zusätzlich der Verlauf gefragt.

## [1.17.10] - 2026-11-11

Fenster öffnen, ohne dass das Suchfeld aufspringt.

### Behoben

- **Aktionen: das Suchfeld geht nicht mehr von selbst auf.** Beim Öffnen eines Schritts setzte der Browser die Schreibmarke ins erste Feld des Fensters. Bei "Gerät schalten", Alarmton, Voralarm und Aktivierungston ist das die Suche nach Geräten oder Medienplayern: die Vorschlagsliste klappte auf, und auf dem Handy kam die Tastatur, obwohl du den Schritt nur ansehen wolltest. Ein Fenster öffnet jetzt ruhig; die Liste erscheint, sobald du ins Suchfeld tippst. Das gilt auch für "Sensoren hinzufügen" und den Schritt "Warten". Fenster, die bewusst im Feld starten (Umbenennen, Code), tun das weiterhin.

## [1.17.9] - 2026-11-11

Das Protokoll öffnet mit zugeklappten Alarmen.

### Geändert

- **Protokoll: auch der neueste Alarm ist zugeklappt.** Bisher war der neueste Alarm beim Öffnen des Protokolls immer aufgeklappt, und die Liste begann mit seiner langen Zeitachse. Jetzt ist jeder beendete Alarm zugeklappt, ein Tipp klappt ihn auf. Zwei Fälle bleiben von selbst offen: ein Alarm, der noch läuft, und der neueste Alarm nach einem Tipp auf die Alarmmeldung.

## [1.17.8] - 2026-11-11

Jeder Schalter links, sein Text gleich daneben, im ganzen Panel.

### Geändert

- **Schalter stehen überall links.** Was 1.17.7 für die Meldungen gemacht hat, gilt jetzt im ganzen Panel: im Sensor-Blatt, im Schritt-Editor der Aktionen ("Lautstärke setzen", "Bis die Alarmanlage deaktiviert wird", "Rückgängig", "Warten, bis die Aktion beendet ist", die Knöpfe der Push-Meldung), bei "Alarm endet", in den Voreinstellungen, im Fenster "Ansicht" und beim Umbenennen steht jeder Schalter links und sein Text gleich daneben und wächst nach rechts. Bisher standen die Schalter am rechten Rand, auf einem breiten Bildschirm weit weg von ihrem Text.
- **Zeitplan:** Der Schalter einer Zeit steht vorn in seiner Zeile. Auf dem Handy ist die Zeile aufgeräumter: Schalter, Uhrzeit und Papierkorb in der ersten Zeile, darunter die Aktion in voller Breite, dann die Wochentage; die Aktion wird nicht mehr abgeschnitten.
- **Schritt-Editor:** Eine Zeile mit Schalter hat mehr Luft zu dem, was über ihr steht, und zu ihrem Regler.

## [1.17.7] - 2026-11-11

Meldungen: jeder Schalter links, sein Text wächst nach rechts.

### Geändert

- **Meldungen: die Schalter stehen links.** In Konfiguration › Meldungen steht jeder Schalter (die Meldungsart selbst, "Kritisch", "Zusätzlich als Benachrichtigung in Home Assistant stehen lassen") links vom Text, und der Text wächst nach rechts, am Computer und auf dem Handy. Bisher standen sie am rechten Rand, auf einem breiten Bildschirm weit vom Text entfernt und auf dem Handy an merkwürdigen Stellen umgebrochen, sodass nicht klar war, welcher Schalter zu welcher Option gehört.

## [1.17.6] - 2026-11-11

"Einstellungen pro Modus" springt nicht mehr zurück.

### Behoben

- **Aktionen: "Einstellungen pro Modus" sprang nach 10 bis 20 Sekunden zurück auf "aus".** Wer den Schalter einschaltete und noch nichts anderes geändert hatte, dessen Entwurf hielt das Panel bei der nächsten regelmässigen Aktualisierung für unverändert und verwarf ihn; der Schalter fiel auf "aus" zurück. Der Schalter bleibt jetzt so, wie du ihn gesetzt hast, bis du speicherst, abbrichst oder die Seite verlässt.

## [1.17.5] - 2026-11-11

Der Modus in den Titeln des Ablaufs.

### Geändert

- **Aktionen: der Modus steht hinter den festen Punkten.** Mit eingeschaltetem "Einstellungen pro Modus" sagen die drei festen Punkte jetzt, welchen Ablauf du gerade siehst: "Anlage scharf geschaltet (Anwesend)", "Alarm beginnt (Anwesend)" und "Alarm endet (quittiert) (Anwesend)", ebenso für Abwesend, Nacht und Immer aktiv. So siehst du es auch nach dem Hinunterscrollen, wenn die Reiter nicht mehr im Bild sind. Bei ausgeschaltetem Schalter bleiben die Titel wie bisher.

## [1.17.4] - 2026-11-11

Besser zu treffen: die Knöpfe der Alarmschritte.

### Geändert

- **Aktionen: grössere Knöpfe mit Umrandung.** Testen, Bearbeiten und Löschen eines Schritts sind jetzt richtige Knöpfe mit Umrandung, mindestens 44 Pixel gross und mit mehr Abstand untereinander (auf dem Handy noch mehr), damit man sie mit dem Finger gut trifft. Löschen ist rot dargestellt.

## [1.17.3] - 2026-11-11

Mehr Abstand zwischen den Lautstärke-Reglern der Medienplayer.

### Geändert

- **Lautstärke je Medienplayer: mehr Luft.** Mit "Je Medienplayer einzeln" haben die Regler jetzt einen deutlichen Abstand zum Schalter darüber, untereinander und zwischen dem Namen des Lautsprechers und seinem Regler. Bisher standen sie eng untereinander.

## [1.17.2] - 2026-11-11

Die Reiter des Protokolls ohne Zahlen.

### Geändert

- **Protokoll: keine Zahlen in den Reitern.** "Alarme" und "Alle Ereignisse" zeigen nicht mehr die Anzahl der Einträge im gewählten Zeitraum; die Listen zeigen sie ohnehin.

## [1.17.1] - 2026-11-11

Badges oben im README; die Änderungen aus 1.17.0 (nicht separat veröffentlicht) sind enthalten.

### Geändert

- **README:** Ganz oben stehen jetzt Badges mit der Version, dem Stand der Tests und der Prüfungen von HACS und hassfest, der Anzahl Downloads und der Lizenz.
- **README:** Der Hinweis "Status: stabil (1.0.0)" ist entfernt.

## [1.17.0] - 2026-11-11

Töne spielen am Stück statt abgehackt.

### Geändert

- **Ein Ton spielt für seine ganze Dauer am Stück.** Bisher startete die Anlage die kurze Tondatei (1 bis 4 Sekunden) auf den Lautsprechern immer wieder neu. Jeder Neustart braucht auf einem Medienplayer einen Moment und schneidet den laufenden Ton ab: es klang abgehackt, als wäre die Datei zu kurz. Jetzt bekommt der Lautsprecher eine einzige Datei in der eingestellten Länge und wird nur einmal gestartet. Das gilt für alle Töne: Alarmton, Voralarm und Aktivierungston.
- **Weicher Anfang, weiches Ende.** Jeder Ton wird am Anfang kurz ein- und am Ende ausgeblendet, statt hart einzusetzen und abzubrechen.
- **Durchgehende Töne ohne Naht.** Sirene, Zweiton und Jaulton sind neu so berechnet, dass eine Wiederholung ohne Sprung und ohne Einbruch an die nächste anschliesst.
- **Sehr lange Töne** (über 3 Minuten und "bis zum Deaktivieren") bestehen aus Stücken von 3 Minuten; der Neustart dazwischen fällt in die ausgeblendete Stelle.

## [1.16.0] - 2026-11-11

Lautstärke je Medienplayer, und zwei Fehler beim Speichern der Aktionen.

### Hinzugefügt

- **Lautstärke je Medienplayer.** Bei Alarmton, Voralarm und Aktivierungston gibt es mit mehr als einem Medienplayer den Schalter "Je Medienplayer einzeln": dann hat jeder Lautsprecher seinen eigenen Regler, zum Beispiel leiser im Schlafzimmer. Ohne den Schalter gilt wie bisher ein Wert für alle. Die Karte des Schritts zeigt dann die Spanne ("30–70 %").

### Behoben

- **Aktionen: "Änderungen" nach dem Speichern oder Testen, obwohl nichts offen war.** Home Assistant legt einen gespeicherten Ablauf etwas anders ab, als das Panel ihn schickt (Vorgaben ergänzt, Felder in anderer Reihenfolge). Sobald das Panel die Daten neu lud, etwa nach dem Speichern oder nach einem Test, hielt es den Ablauf für geändert: unten stand "3 Änderungen", und "Speichern" war wieder aktiv. Das Panel vergleicht jetzt den Inhalt statt der Schreibweise.
- **Die Ladeanzeige drehte nach dem Speichern bis zu 25 Sekunden.** Wer in diesem Zustand noch einmal speicherte, speicherte denselben Stand. Home Assistant lädt die Anlage dann nicht neu, das Panel wartete aber auf diesen Neustart. Der Server sagt dem Panel jetzt, ob die Anlage neu lädt; ohne Neustart gibt es keine Ladeanzeige. Das gilt auch für Sensoren und Anlage.

## [1.15.0] - 2026-11-11

Drei Arten von Tönen mit eigenen Klängen: Alarmton, Voralarm und Aktivierungston.

### Hinzugefügt

- **Voralarm.** Eine neue Schrittart im Ablauf des Alarms: ein leiser Warnton auf Lautsprechern, bevor der Alarmton einsetzt. Standard sind 20 Sekunden bei 30 % Lautstärke; der Ablauf wartet auf sein Ende, danach folgt der nächste Schritt (zum Beispiel der Alarmton). Deaktivieren stoppt ihn sofort, der Alarmton setzt dann nicht mehr ein.
- **Eigene Klänge je Art.** Jede Art bietet ihre eigenen Töne an, alle zum Probehören:
  - **Alarmton:** Sirene, Alarm-Piepen, Hupe und neu Zweiton hoch-tief und Jaulton.
  - **Voralarm:** Gong, Warnung (bisher Alarmtöne) und neu langsames Piepsen, pulsierender Ton, ansteigender Ton.
  - **Aktivierungston:** Piepsen, Doppelpiep, sanfter Ton (dezent), Glocke, Dreiklang aufsteigend (freundlich), Bestätigung (zwei Töne), Ticken (sehr dezent).

### Geändert

- **Einheitliche Begriffe: Alarmton, Voralarm, Aktivierungston.** Der Schritt heisst "Alarmton" (bisher "Alarmton abspielen"), und der Knopf der Push-Meldung heisst "Alarmton stumm" (bisher "Sirene stumm"): nicht jeder hat eine Sirene, und der Knopf meint den Ton des Alarms. Auch die Einstellung dazu und der Eintrag im Protokoll heissen so.
- **Der Aktivierungston spielt nur ganze Wiederholungen.** Ein Ton von 1 Sekunde erklingt in 3 Sekunden dreimal, eine Melodie von 2 Sekunden einmal: sie wird nie mittendrin abgeschnitten. Seine Auswahl zeigt nur noch die eigenen Töne.
- **Früher gewählte Klänge bleiben gültig.** Ein Alarmton mit Gong oder Warnung spielt weiter wie bisher und bleibt im Schritt wählbar, solange er eingestellt ist.

## [1.14.0] - 2026-11-11

Aktionen beim Scharfschalten mit einem Aktivierungston, und besser lesbare Texte auf dem Handy.

### Hinzugefügt

- **Aktionen beim Scharfschalten.** Bei den Alarmaktionen steht ganz oben der neue feste Punkt "Anlage scharf geschaltet" mit einem Plus. Was du dort ablegst, läuft, sobald die Anlage scharf ist (nach der Ausgangsverzögerung), je Modus wie die Alarmaktionen; im Reiter "Immer aktiv" gibt es den Punkt nicht. Die Schritte laufen nicht nach einem quittierten Alarm (die Anlage war durchgehend scharf) und nicht beim Start von Home Assistant. Deaktivieren stoppt sie sofort, ein Alarm hat Vorrang.
- **Aktivierungston.** Eine eigene Schrittart neben dem Alarmton: ein kurzer Ton auf Lautsprechern, standardmässig ein Piepsen von 3 Sekunden; Ton, Lautstärke und Dauer (bis 5 Minuten) stellst du ein, mit Probehören. Er läuft nie "bis zum Deaktivieren" und stellt nichts zurück, damit er von der Sirene zu unterscheiden ist. Verfügbar beim Scharfschalten und nach dem Quittieren; beim Alarm bleibt es beim Alarmton.

### Geändert

- **Die festen Punkte des Ablaufs sind grösser.** "Anlage scharf geschaltet", "Alarm beginnt" und "Alarm endet (quittiert)" tragen ein grösseres Symbol und kräftigere Schrift: scharf mit rotem Schild, der Alarm in vollem Rot, das Ende grün.
- **Handy: Beschreibungen in lesbarer Grösse.** Hinweise und Beschreibungen sind auf dem Handy durchgängig grösser (14.5 statt rund 12 Pixel).

### Behoben

- **Die Schrift wurde beim Aufklappen eines Alarms grösser.** Auf dem iPhone vergrösserte die Automatik des Browsers einzelne Textblöcke, sobald die Seite länger wurde: derselbe Hinweis im Protokoll war einmal klein und einmal gross. Die Automatik ist abgeschaltet, die Grösse ist jetzt immer dieselbe.

## [1.13.3] - 2026-11-11

### Geändert

- **Derselbe Aufbau in Protokoll und Konfiguration.** Zuoberst steht die Hauptwahl (Übersicht, Protokoll, Konfiguration), direkt darunter an derselben Stelle die zweite Zeile mit den Reitern des Bereichs. Im Protokoll stehen dort jetzt "Alarme" und "Alle Ereignisse" (vorher unter Zeitraum und Anlage); Zeitraum und Anlage folgen darunter.
- **Symbole auf jeder Ebene.** Auch die zweite Zeile trägt Symbole, am Computer wie auf dem Handy, links vom Text: Sensoren, Aktionen, Benachrichtigungen, Anlage sowie Alarme und Alle Ereignisse. Auf dem Handy richten sich die Breiten dieser Reiter nach ihrem Inhalt, damit alle vier mit Symbol Platz haben.
- **README:** alle Bildschirmfotos neu erzeugt (Reiter mit Symbolen, Protokoll mit zwei Reitern).

## [1.13.2] - 2026-11-11

### Geändert

- **Ladeanzeige in Sensoransicht und Protokoll.** Wo eine Grafik lädt, steht jetzt dieselbe Ladeanzeige wie im ganzen Panel (drei kreisende Punkte in der Farbe des Panels), mitten in der Fläche der Grafik und etwas kleiner; die Textzeile "Verlauf wird geladen …" entfällt. Beim Wechsel des Zeitraums bleiben Kennzahlen, Grafik und Liste gedimmt stehen, bis die neuen Daten da sind: nichts springt. Das Protokoll zeigt sie beim ersten Laden statt eines leeren Reiters.

## [1.13.1] - 2026-11-11

### Geändert

- **Hauptreiter mit Symbol auch am Computer.** "Übersicht", "Protokoll" und "Konfiguration" tragen am Computer dasselbe Symbol wie auf dem Handy, links vom Text.

## [1.13.0] - 2026-11-11

Das Protokoll mit zwei Reitern, ein Jahr Aufbewahrung und das Löschen einzelner Alarme.

### Hinzugefügt

- **Protokoll mit zwei Reitern.** "Alarme" (gewählt) und "Alle Ereignisse" stehen jetzt nebeneinander statt untereinander, jeder mit der Anzahl im gewählten Zeitraum. Vorher standen die Ereignisse unter den Alarmen und rutschten mit jedem Alarm weiter nach unten. Zeitraum und Anlage gelten für beide Reiter, die Filter der Ereignisse stehen im Reiter "Alle Ereignisse". Die Reiter stehen im festen Teil oben und sind beim Scrollen immer erreichbar.
- **Einen Alarm löschen.** Ein geöffneter Alarm hat unten den Knopf "Alarm löschen" mit Papierkorb. Erst nach einer Rückfrage wird die Aufzeichnung entfernt; die Einträge unter "Alle Ereignisse" bleiben. Ein laufender Alarm lässt sich nicht löschen.
- **"Weitere anzeigen".** Lange Listen zeigen zuerst 30 Alarme oder 200 Ereignisse und holen mit einem Knopf die nächsten. Vorher endete die Liste der Ereignisse mit einem Hinweis auf den Export.

### Geändert

- **Aufbewahrung: ein Jahr.** Alarme und Ereignisse bleiben jetzt ein Jahr und werden danach verworfen. Bisher blieben die letzten 30 Alarme und die letzten 1000 Ereignisse je Anlage, gleich wie alt: in einem lebhaften Haushalt reichten 1000 Ereignisse nur für wenige Monate. Die Anzahl ist nur noch eine Obergrenze, damit die Ablage nicht unbegrenzt wächst (200 Alarme und 5000 Ereignisse je Anlage).

## [1.12.0] - 2026-11-11

Du wählst, wie deine Sensoren heissen: "Gerät - Sensor" oder nur der Name des Sensors.

### Hinzugefügt

- **Namen der Sensoren wählbar.** In der Ansicht der Übersicht gibt es den Schalter "Gerätename vor dem Sensornamen". An (Standard): der Name setzt sich aus Gerät und Sensor zusammen, mit Bindestrich getrennt, zum Beispiel "Hue Motion Keller - Bewegung". So ist jeder Sensor eindeutig, auch wenn mehrere von sich aus gleich heissen. Aus: nur der Name des Sensors ("Bewegung", oder der Name, den du der Entität selbst gegeben hast). Anders als der Rest der Ansicht gilt die Wahl überall, wo ein Sensor genannt wird (Listen, Sensoransicht, Protokoll, Push-Meldungen), und auf allen Geräten; sie steht auch in der Sicherung.

### Geändert

- **Eine Regel statt einer Vermutung.** 1.11.0 nahm den eigenen Namen allein, wenn du ihn der Entität selbst gegeben hattest, und sonst den Anzeigenamen von Home Assistant. Das entscheidet jetzt dein Schalter. Steht der Name des Geräts schon im Namen des Sensors, wird er nicht noch einmal davorgesetzt; die Hauptentität eines Geräts heisst wie das Gerät; Sensoren älterer Integrationen, die ihren vollen Namen selbst tragen, bleiben unverändert.

## [1.11.0] - 2026-11-11

Der Alarm im Rot der scharfen Anlage, eine Kachel, die sagt, wer scharf geschaltet und was ausgelöst hat, und ein aufgeräumtes Protokoll.

### Hinzugefügt

- **Attribute `armed_at` und `armed_by`** der Anlage: seit wann sie scharf ist und wer sie scharf geschaltet hat. Sie bleiben während Eingangsverzögerung und Alarm und nach dem Quittieren stehen (die Anlage war durchgehend scharf) und überstehen einen Neustart; Deaktivieren löscht sie.
- **README:** die Stärken stehen am Anfang (keine Automationen nötig, Push-Meldungen kommen von selbst, alles grafisch einstellbar), neue Abschnitte mit Bild für die Sensoransicht und den Alarm, alle Bildschirmfotos neu erzeugt.

### Geändert

- **Der Alarm im selben Rot wie "scharf".** Das Alarmband war eine flache Fläche in der Fehlerfarbe und stand im dunklen Design blass neben den übrigen Rottönen. Es hat jetzt denselben Verlauf und denselben roten Rand wie die scharfe Kachel. Die Kachel der Anlage bleibt im Alarm rot (am kräftigsten); vorher verlor sie ihr Rot genau dann. Zwischen Band und Kachel steht ein Abstand.
- **Die Kachel sagt im Alarm, was ausgelöst hat und wer scharf geschaltet hat.** Unter "Alarm" stand "seit 07:16 · Diego", als hätte Diego den Alarm ausgelöst. Jetzt steht dort "seit 07:16" mit dem Sensor, der ausgelöst hat, und in einer eigenen Zeile "Abwesend scharf seit 06:50 · Diego". Dasselbe gilt in der Eingangsverzögerung.
- **Protokoll: ein laufender Alarm aktualisiert sich jede Sekunde.** Dauer und Balken laufen gleichmässig hoch statt alle 5 Sekunden zu springen. Ohne laufenden Alarm bleibt es bei 5 Sekunden.
- **Protokoll auf dem Handy: "von" und "bis" nebeneinander.** Bei "Zeitraum wählen" steht die Auswahl in der ersten Zeile, die beiden Datumsfelder stehen gleich breit darunter (vorher das eine schmal neben der Auswahl, das andere breit darunter).

### Behoben

- **Protokoll: die Verbindung der Schritte läuft nie mehr durch ein Symbol.** In der Liste eines Alarms lief eine durchgehende Linie hinter den Symbolen durch und schien durch deren halb durchsichtige Fläche. Jede Zeile zeichnet jetzt ein Stück über und eines unter ihrem Symbol, beide enden kurz davor (wie bei den Alarmaktionen).
- **Sensornamen: nicht umbenannte Sensoren behalten den Namen ihres Geräts.** Seit 1.10.2 hiess ein Sensor, den du nicht selbst benannt hast, nur noch wie seine Entität in der Integration, also zum Beispiel jeder Bewegungsmelder "Bewegung": in der Liste, im Protokoll und in der Alarmmeldung ("Alarm: Bewegung") war nicht mehr zu erkennen, welcher gemeint ist. Der eigene Name steht jetzt nur dann allein, wenn du ihn der Entität selbst gegeben hast ("Wohnzimmer Belegung"); sonst bleibt der Name des Geräts davor ("Hue Motion Keller Bewegung").

## [1.10.2] - 2026-11-11

### Behoben

- **Ein Name für jeden Sensor, überall.** Home Assistant setzt den Anzeigenamen einer Entität aus dem Namen des Geräts und ihrem eigenen Namen zusammen. Wer das Gerät umbenannt hat, bekam in jeder Liste einen langen Namen wie "Aqara FP400 Anwesenheitssensor Wohnzimmer Wohnzimmer Belegung". Das Panel und alle Meldungen (Alarm, Eingangsverzögerung, Stiller Alarm, nicht erreichbar, Batterie, Scharfschalten nicht möglich) verwenden jetzt nur den eigenen Namen der Entität ("Wohnzimmer Belegung"); die Hauptentität eines Geräts, die keinen eigenen Namen hat, heisst wie das Gerät. Entitäten, die ihren vollen Namen selbst tragen, behalten ihn. Der Name des Geräts bleibt wie bisher sichtbar (Sensoransicht, Kachel "Gerät"). Eine Regel für Server und Panel (`devices.display_name`), damit der Name in Liste, Blatt, Protokoll und Push-Meldung gleich ist.

## [1.10.1] - 2026-11-10

### Behoben

- **Die Alarmanlage lädt auch, wenn sich das Panel nicht anmelden lässt.** Scheiterte die Anmeldung des Seitenpanels (zum Beispiel "Cannot register a resource into frozen router", wenn der Webserver schon eingefroren ist), lud die ganze Alarmanlage nicht. Das Panel ist Bequemlichkeit, die Alarmanlage nicht: Der Fehler wird jetzt als Fehler protokolliert, und die Anlage läuft ohne Panel weiter, scharf und alarmierend.

## [1.10.0] - 2026-11-10

Aktionen nach dem Quittieren, und Schritte, die standardmässig weiterlaufen.

### Hinzugefügt

- **Aktionen nach dem Quittieren.** Unter "Alarm endet (quittiert)" und der Meldung dazu steht jetzt ein weiteres Plus: Schritte, die laufen, sobald der Alarm vorbei ist, ob jemand quittiert oder die Anlage deaktiviert hat, zum Beispiel die Storen wieder schliessen oder das Licht ausschalten. Sie starten erst, wenn die Alarmaktionen gestoppt und die Geräte zurückgekehrt sind ("Rückgängig"), jeder Modus hat seine eigene Liste wie die Alarmaktionen, und "Aktionen übernehmen von" nimmt sie mit. Möglich sind Gerät, Ton mit Dauer, Warten, Szene und eigene Aktion; eine Alarmmeldung, Quittieren und "Rückgängig" gibt es hier nicht, weil nichts mehr folgt, das etwas zurücknehmen könnte. Ein neuer Alarm hat immer Vorrang: er bricht sie ab und startet sofort seine eigenen Aktionen.

### Geändert

- **Schritte laufen standardmässig weiter.** Bisher wartete ein Ablauf auf das Ende jedes Schritts, ausser "Nicht abwarten" war eingeschaltet. Das ist jetzt umgekehrt: jeder Schritt, der etwas ausführt (Gerät, Ton, Szene, eigene Aktion), startet den nächsten sofort, die Aktionen laufen so schnell wie möglich nacheinander durch; niemand muss auf das Ende einer Sirene warten. Soll der nächste Schritt erst starten, wenn dieser fertig ist, schaltest du im Schritt "Warten, bis die Aktion beendet ist" ein; er trägt dann eine Pille mit diesem Text. "Warten" wartet weiterhin, und auf einen Ton "bis zum Deaktivieren" lässt sich nicht warten.
- **Bestehende Abläufe verhalten sich wie bisher.** Schritte aus früheren Versionen, die gewartet haben, warten weiter und zeigen jetzt die Pille; Schritte, die nebenher liefen, tun das weiterhin und tragen keine Marke mehr. Ändern kannst du es im Schritt.
- **Alle Verbindungen im Ablauf sehen gleich aus.** Die gestrichelte blaue Linie nach einem Schritt, der nebenher lief, ist weg, ebenso der Schalter an der Karte: ob der Ablauf wartet, sagt die Pille auf dem Schritt.
- **"Alarm endet (quittiert)".** Die Marke am Ende des Ablaufs sagt jetzt, was sie meint; die Texte ihrer Meldung nennen Quittieren und Deaktivieren.
- **Handy: der Abstand unter der Reiterleiste bleibt beim Scrollen.** Unter der Leiste mit Sensoren, Aktionen, Meldungen und Anlage steht beim Scrollen immer derselbe Abstand wie über ihr. Bisher schob sich der Tabellenkopf ohne Abstand an die Leiste, es sah aus, als würden beide zusammenschmelzen.

## [1.9.0] - 2026-11-10

Eine Sensoransicht: einen Sensor der Übersicht antippen und sehen, was er getan hat, wie es seiner Batterie geht und wie gut sein Empfang ist.

### Hinzugefügt

- **Sensoransicht.** Ein Tipp auf einen Sensor der Übersicht (Liste oder Karten) öffnet ein eigenes Fenster statt des Geräts in Home Assistant. Es ist eine reine Übersicht ohne Einstellungen; der Knopf "In HA öffnen" im Kopf führt zum Sensor in Home Assistant. Auf dem Computer ist das Fenster so breit wie das der Voreinstellungen, auf dem Handy füllt es den Bildschirm, mit einem X oben. Kopf, Kacheln, Zeitraum, Kennzahlen und Grafik bleiben stehen, nur die Liste der Ereignisse scrollt.
- **Kacheln als Reiter:** "Verlauf", "Batterie", "Empfang" und "Gerät". Jede zeigt ihren aktuellen Wert; die gewählte bestimmt Grafik, Kennzahlen und Liste. Eine Kachel ohne Daten entfällt (keine "Batterie" bei einem Gerät am Netz).
- **Eine Grafik je Sensorart,** für 3 Stunden, 12 Stunden, 1 Tag, 7 Tage oder 30 Tage. Türen und Fenster: eine Zeitleiste mit den offenen Zeiten, ab 7 Tagen eine Zeile je Tag von 0 bis 24 Uhr. Bewegung: die Anzahl Bewegungen je Stunde als Balken, ab 7 Tagen ein Raster aus Tag und Stunde, das Gewohnheiten und Ausreisser zeigt. Rauch, Wasser und Ähnliches: die Erreichbarkeit mit Ausfällen und Auslösungen. Blau zeigt, wann die Anlage scharf war, Rot ein Ereignis, das einen Alarm ausgelöst hat.
- **Liste der Ereignisse** mit Zeit, Dauer und dem Zustand der Anlage in diesem Moment, nach Tagen gruppiert, auch "Nicht erreichbar". Ein Ereignis, das einen Alarm ausgelöst hat, trägt die Marke "Alarm ausgelöst"; ein Tipp darauf zeigt diesen Alarm im Protokoll.
- **Batterie:** der Stand über 30 Tage, 90 Tage oder ein Jahr mit der Schwelle der Warnung, einer Marke beim Batteriewechsel, dem Verbrauch je Tag und einer Prognose. **Empfang:** der Verlauf mit den Zonen gut, mittel und schwach.
- **Gerät:** Hersteller, Modell, Firmware, Integration und Bereich, dazu in welchen Modi welcher Anlage der Sensor überwacht wird, mit einem Link zu seiner Stelle in der Konfiguration.
- **30 Tage Verlauf für alle.** Home Assistant bewahrt den Verlauf von Zuständen standardmässig 10 Tage auf. Die Integration merkt sich jetzt je Sensor kleine Stundenwerte (Anzahl Auslösungen, Zeit offen) für 30 Tage und verwirft ältere; Grafik und Kennzahlen reichen damit immer 30 Tage zurück. Nach dem Update werden die Stunden davor einmal aus dem Verlauf von Home Assistant nachgetragen. Die Liste der einzelnen Ereignisse reicht so weit wie dieser Verlauf, mit einem Hinweis, wenn er kürzer ist als der gewählte Zeitraum.

### Geändert

- **Handy: jedes Fenster füllt den Bildschirm.** Die Fenster der Einstellungen (Ansicht, Voreinstellungen, Schritt bearbeiten, Sensoren hinzufügen, Blatt des Sensors, Codes und die neue Sensoransicht) öffnen sich nicht mehr als Blatt mit Rand oben. Das X steht immer ganz oben rechts, die Leiste mit den Knöpfen (Abbrechen, Fertig, Speichern) immer ganz unten: sie liegt ausserhalb des scrollenden Inhalts und bewegt sich nicht, auch nicht beim Ziehen über das Ende hinaus. Nur die kurzen Rückfragen ("Verwerfen?") bleiben ein kleines Blatt von unten.
- **Scharf ist rot, auf jedem Gerät und im dunklen Design.** Bisher zeigte das nur der schwache Farbverlauf der Kachel, auf dem Handy und im dunklen Design kaum zu sehen, während Symbol, Zustand und gewählter Modus blau waren. Jetzt sind das Symbol, der Zustand ("Abwesend scharf") und der gewählte Modus rot, die Kachel hat einen roten Rahmen, und der Verlauf ist im dunklen Design kräftiger. Deaktiviert: "Aus" ist grün. Ein Alarm hebt sich von "scharf" mit einem gefüllten roten Symbol ab. Auf dem Handy zeigt die Leiste bei vier Modi (Aus, Anwesend, Abwesend, Nacht) nur noch Text: mit Symbolen liefen die Beschriftungen ineinander.

## [1.8.0] - 2026-11-10

### Hinzugefügt

- **Übersicht, Kachel der Alarmanlage:** Die Kachel bekommt einen schwachen Farbverlauf von unten, wie die Karten der Sensoren: rot, solange die Anlage scharf ist (mit dem Modus dunkler: hell bei Anwesend, mittel bei Nacht, dunkel bei Abwesend), grün, solange sie deaktiviert ist.

## [1.7.0] - 2026-11-10

Eine klare Regel für Sensoren, die "Immer aktiv" sind und zugleich in der Zone eines Modus stehen, beide Abläufe der Alarmaktionen nebeneinander, einheitliche Punkte für Ungespeichertes eine Zeichnung des Ablaufs, die nicht mehr danebengehen kann, und die Sensorkarten der Übersicht so gruppiert, wie du es wählst.

### Hinzugefügt

- **Übersicht, Sensoren gruppiert nach Wahl:** nach Bereich, nach Sensorart (Türen, Fenster, Bewegung, Rauch und Wasser, …), nach Anlage oder gar nicht. Auf dem Computer steht die Auswahl in der Werkzeugleiste neben "Liste / Karten", auf dem Handy in "Ansicht"; sie wird je Gerät gemerkt und gilt für die Liste und für die Karten. In der Kartenansicht hat jede Gruppe einen Titel mit der Anzahl ihrer Sensoren über die ganze Breite, die Karten laufen nicht mehr ineinander.

### Geändert

- **"Immer aktiv" und zugleich ein Modus: ein Schalter, im Standard eindeutig.** Für einen Sensor, der "Immer aktiv" ist und zugleich in der Zone eines Modus steht, hat das Blatt des Sensors den Schalter "Scharf in <Modus>: nur <Modus> zählt" (vorher: "Immer aktiv ignorieren"). **An (neuer Standard):** Solange die Anlage in diesem Modus scharf ist, gelten für den Sensor nur die Einstellungen und die Aktionen dieses Modus. **Aus:** "Immer aktiv" gilt zusätzlich: der Sensor löst sofort aus, und beide Abläufe der Alarmaktionen laufen nebeneinander, der des Modus und der von "Immer aktiv". Bei deaktivierter Anlage und in Modi, deren Zone den Sensor nicht enthält, gilt "Immer aktiv" wie bisher. Vor dieser Version war der Standard für die Regel umgekehrt (der Sensor löste auch in seinem Modus sofort aus), und bei scharfer Anlage liefen immer nur die Aktionen des Modus.
- **Welche Alarmaktionen laufen,** richtet sich jetzt nach dem Sensor: deaktiviert oder scharf in einem Modus, der den Sensor nicht enthält, laufen die Aktionen von "Immer aktiv" (vorher liefen bei scharfer Anlage immer die Aktionen des Modus, auch für einen Rauchmelder ausserhalb der Zone). Hat "Immer aktiv" keine eigenen Aktionen, laufen die des scharfen Modus, damit kein Alarm ohne Aktionen bleibt. Ohne "Einstellungen pro Modus" bei den Aktionen (ein Ablauf für alles) läuft der Ablauf nie doppelt.
- **Blatt des Sensors:** Der Rahmen "Diese Einstellungen gelten …" steht immer da und sagt genau, wann die Einstellungen greifen, zum Beispiel "deaktiviert und scharf in Anwesend" mit dem Hinweis "Scharf in Abwesend gelten stattdessen die Einstellungen und Aktionen des Modus". Die Pillen "Alarmmodi" sind aus dem Blatt entfernt: zu welchen Modi ein Sensor gehört, steht in der Tabelle (die Kästchen und die Spalte "Immer aktiv").
- **Oranger Punkt = ungespeichert, überall gleich:** am Reiter "Konfiguration", am Unterreiter und neu auch am Reiter des Modus, der ungespeicherte Änderungen hat (Sensoren, Aktionen, Benachrichtigungen, Anlage). Die Punkte und die markierten Zeilen verschwinden sofort beim Speichern, nicht erst, wenn die Anlage neu geladen hat. Eigene Werte (Overrides) sind blau markiert, nie orange; der Balken an einer geänderten Sensorzeile ist orange.

### Behoben

- **Zeichnung des Ablaufs der Aktionen:** Die Verbindungslinie war teils blau, teils grau und konnte über einem Symbol liegen. Jede Verbindung zeichnet ihre Linie jetzt selbst im Fluss der Seite (ein Stück über und eines unter dem Plus) statt einer Linie hinter allem: sie endet immer am Plus und an den Karten, hat eine Farbe je Verbindung (gestrichelt blau nach einem Schritt, der nebenher läuft, auch auf dem Stück zu "Alarm endet") und liegt in jeder Breite und in beiden Designs auf einer Achse mit den Symbolen.
- **Zwei Abläufe unter derselben Aufsicht:** Der zweite Ablauf hat seinen eigenen Wächter, seine eigenen eingestellten Zeiten und seine eigene Stelle für einen Neustart oder ein Neuladen; eine Sirene schaltet also in beiden Abläufen nach der eingestellten Zeit aus.
## [1.6.5] - 2026-11-10

### Geändert

- **Punkte:** Orange Punkte bedeuten jetzt immer "ungespeicherte Änderung" (an den Reitern). Der Punkt am Kästchen, der einen "eigenen Wert" markiert (weicht von der Voreinstellung der Sensorart ab), ist jetzt blau wie der Punkt am Sensornamen und nicht mehr orange.

## [1.6.4] - 2026-11-10

### Behoben

- **Sensor-Blatt auf dem Handy:** Unter der Leiste mit "Fertig" schien der Inhalt des Blatts in einem Streifen am unteren Bildschirmrand durch (der Abstand zur Home-Anzeige wurde doppelt gezählt). Die Leiste endet jetzt genau am unteren Rand.

## [1.6.3] - 2026-11-10

### Behoben

- **Sensor-Blatt mit "Einstellungen pro Modus":** Ein Sensor, der nur "Immer aktiv" ist und im gewählten Reiter (zum Beispiel "Anwesend") in keiner Zone steht, zeigte die Einstellungen dieses Modus, die für ihn keine Wirkung haben. Das Blatt zeigt für einen solchen Sensor jetzt den Bereich "Immer aktiv" ("in jedem Zustand der Anlage", blauer Rahmen); steht er in der Zone des Reiters, zeigt es wieder den Modus.

## [1.6.2] - 2026-11-10

### Geändert

- **Blatt mit den Sensor-Optionen:** Der Abschnitt "Zonen" heisst jetzt "Alarmmodi" und zeigt "Immer aktiv" als Pille neben Anwesend, Abwesend und Nacht, damit klar ist, in welchen Zuständen ein Sensor gilt (die eigene Zeile "Immer aktiv" in der Liste entfällt). Der Schalter "Immer aktiv ignorieren" steht direkt darunter, sobald der Sensor "Immer aktiv" ist und in einer Zone steht; in einem Reiter, dessen Modus den Sensor nicht enthält, sagt ein Hinweis, dass es nichts zu überschreiben gibt.

## [1.6.1] - 2026-11-10

### Behoben

- **Übersicht:** Der Abstand zwischen den Filtern und dem Tabellenkopf bleibt beim Scrollen der Liste erhalten; vorher ging er zu, und über dem Kopf schienen Zeilen durch.

## [1.6.0] - 2026-11-10

### Hinzugefügt

- **"Immer aktiv" abschalten:** In Konfiguration › Anlage steht neben den Modi die Pille "Immer aktiv", die sich abschalten lässt (Standard an). Aus heisst: Kein Sensor ist immer aktiv, Rauch- und Wassermelder alarmieren dann nur noch, wenn sie in der Zone eines scharfen Modus stehen, und eine gelbe Warnung weist darauf hin. Reiter, Spalte und Option "Immer aktiv" verschwinden bei den Sensoren und der Reiter bei den Aktionen; alle Werte und Aktionen bleiben erhalten und kommen beim Einschalten zurück. Sensoren, die nur "Immer aktiv" sind, stehen in der Übersicht nicht in der Liste, solange es aus ist. Die Einstellung gehört zur Sicherung.

### Behoben

- **Beim Speichern der Aktionen geht der Ablauf eines abgeschalteten Modus oder von "Immer aktiv" nicht mehr verloren:** Auslöser, die nicht in der gespeicherten Meldung stehen, behalten ihren Ablauf und ihre Einstellungen für "Alarm endet"; ein leerer Ablauf in der Meldung löscht ihn weiterhin.

## [1.5.0] - 2026-11-10

### Hinzugefügt

- **Empfänger je Meldung:** Jede Meldung in Konfiguration › Benachrichtigungen hat ein Dropdown "Empfänger hinzufügen" mit den Empfängern als Pillen. Die oben gewählten Empfänger (Alarme oder Wartung) sind als Standard vorgewählt; wer einen hinzufügt oder entfernt, überschreibt sie für diese Meldung, "Zurück zum Standard" macht das rückgängig. Mit "Einstellungen pro Modus" können die Empfänger auch je Modus abweichen (Wert des Modus, dann der Meldung, dann die Gruppe oben). Der letzte Empfänger lässt sich nicht entfernen, damit keine Meldung ohne Empfänger bleibt. Testmeldungen und die gesammelte Wartungsmeldung folgen den eigenen Empfängern; Batterie- und Nicht-erreichbar-Meldungen mit verschiedenen Empfängern gehen getrennt hinaus. Die Werte gehören zur Sicherung.

## [1.4.0] - 2026-11-10

Nicht veröffentlicht; enthalten in 1.5.0.

### Hinzugefügt

- **Aktionen von einem anderen Modus übernehmen:** In Konfiguration › Aktionen bietet die Fusszeile mit "Einstellungen pro Modus" "Aktionen übernehmen von …". Sie ersetzt alle Aktionen des offenen Reiters (Schritte und "Alarm endet") durch die eines anderen Modus oder von "Immer aktiv", mit Rückfrage, wenn der Reiter eigene Aktionen hat. Gespeichert wird erst mit "Speichern".
- **Schalter "Immer aktiv ignorieren":** Für einen Sensor mit "Immer aktiv", der zugleich in der Zone eines Modus steht, lässt ein Schalter in den Sensor-Optionen (je Modus mit "Einstellungen pro Modus"; Standard aus) nur die Regel dieses Modus gelten, solange die Anlage darin scharf ist. In Modi, deren Zone den Sensor nicht enthält, tut er nichts, ein Rauchmelder bleibt dort also aktiv.

### Geändert

- **"Immer aktiv" ist immer aktiv:** Ein Sensor mit dieser Option löst in jedem Zustand der Anlage aus, scharf wie deaktiviert, und zwar sofort. Seine Optionen (zum Beispiel "Stiller Alarm") kommen jetzt immer aus dem Reiter "Immer aktiv", auch bei scharfer Anlage. Vorher las eine scharfe Anlage sie aus dem Reiter des aktiven Modus. Steht der Sensor zugleich in der Zone des scharfen Modus, laufen beide Regeln und die stärkere Wirkung zählt (ein Alarm schlägt eine stille Meldung).

### Behoben

- **Rauch- und Wassermelder wurden nicht beachtet und nicht angezeigt:** Ein Sensor, dessen Art standardmässig "immer aktiv" ist (Rauch, Wasser, Gas), wurde nur beachtet, wenn er in einer Zone stand oder einen eigenen Wert "Immer aktiv" hatte. Stand er nur in der Liste der Konfiguration, löste er keinen Alarm aus und erschien nicht in der Übersicht. Jetzt wird jeder Sensor der Anlage beachtet und aufgelistet, für den "Immer aktiv" gilt (eigener Wert oder Standard der Art).
- **Fenster "Ansicht":** Das Feld "Sortieren nach" war zusammengedrückt; es hat jetzt dieselbe Höhe und Rundung wie die Auswahlleisten darüber.
- **Grafik im Ablauf:** Nach einem Schritt, der "nebenher läuft", ragte die gestrichelte Linie in die Karte darüber und lag auf der durchgehenden Linie. Sie liegt jetzt genau zwischen Karte und Plus-Knopf, und die durchgehende Linie scheint nicht mehr durch.

## [1.3.0] - 2026-11-10

### Hinzugefügt

- **Knopf "Quittieren" im Panel:** Das rote Alarm-Band in der Übersicht hat neben "Deaktivieren" einen Knopf "Quittieren". Er beendet den Alarm und lässt die Anlage scharf; er steht nur da, solange ein Alarm läuft.

### Geändert

- **Der Knopf "Quittieren" in der Push-Meldung ist standardmässig an** (pro Push-Schritt abschaltbar). Er schaltet nichts ab, braucht also anders als "Deaktivieren" keine Freigabe; er wirkt weiterhin nur, solange der Alarm läuft, und nur vom Handy eines konfigurierten Alarm-Empfängers.

## [1.2.0] - 2026-11-10

Nicht veröffentlicht; enthalten in 1.3.0.

### Hinzugefügt

- **Alarm quittieren:** eine neue Aktion "Alarm beenden (quittieren)" für den Ablauf und ein Knopf "Quittieren" in der Push-Meldung. Quittieren beendet den Alarm: Die laufenden Schritte stoppen, die Geräte gehen in den früheren Zustand zurück ("Alarm endet" läuft wie beim Deaktivieren), das Protokoll hält fest, wer quittiert hat. Die Anlage **bleibt scharf** in ihrem Modus, der nächste Auslöser alarmiert wieder. Die Push-Meldung "Alarm beendet" ersetzt die Alarmmeldung auf dem Handy. Während der Eingangsverzögerung und bei scharfer Anlage ohne Alarm gibt es nichts zu quittieren. Der Knopf wirkt nur, solange der Alarm läuft, und nur vom Handy eines konfigurierten Alarm-Empfängers; der Schritt tut im Test nichts. Deaktivieren beendet den Alarm weiterhin ebenfalls und schaltet die Anlage aus.

## [1.1.0] - 2026-11-10

Nicht veröffentlicht; enthalten in 1.2.0.

### Hinzugefügt

- **Eingangsverzögerung pro Sensor:** Jeder Eingangssensor kann im Blatt mit den Sensor-Optionen eine eigene Eingangsverzögerung haben (0 bis 3600 s). Ohne eigenen Wert gilt die Eingangsverzögerung der Anlage für den aktuellen Modus; das Blatt zeigt die Herkunft des Werts und setzt ihn zurück. Mit "Einstellungen pro Modus" kann der Wert je Modus abweichen. 0 löst sofort aus. Der Wert gehört zur Sicherung. "Auf alle Sensoren anwenden" bei den Voreinstellungen lässt ihn stehen.
- **Eigene Empfänger je Meldung:** Der Schritt "Push-Meldung" und die Push-Meldung von "Alarm endet" können eigene Empfänger haben statt der Alarm-Empfänger aus der Konfiguration. Der Dialog zeigt die Standard-Empfänger; ein Schalter ersetzt sie durch eine eigene Liste. Eine leere Liste bedeutet wieder Standard. Push-Knöpfe werden von jedem Empfänger des Alarms akzeptiert, auch von denen aus den Schritten.
- **Emoji in jedem Standardtitel:** 🚨 Alarm, ⏳ Eingangsverzögerung, 🔒 scharf, 🔓 deaktiviert, ✅ Alarm beendet, ⛔ Scharfschalten nicht möglich, 📡 Sensor nicht erreichbar, 🔕 Stiller Alarm, ⚠️ Wartung, 🧪 Test. Ein Test stellt sicher, dass jeder Standardtitel mit einem Emoji beginnt. Eigene Titel bleiben, wie du sie schreibst.

### Geändert

- **Sensorliste:** Karten und Zeilen von Sensoren, die offen sind oder eine Bewegung erkannt haben, bekommen einen schwachen Farbverlauf von unten und fallen so auf einen Blick auf.
- Version 1.0.1 wurde nicht veröffentlicht; ihre Änderungen sind hier enthalten.

### Behoben

- **Fenster "Ansicht":** Ein Klick auf einen Schalter, eine Spalte oder die Reihenfolge scrollt das Fenster nicht mehr nach oben; es bleibt an derselben Stelle.

## [1.0.1] - 2026-11-10

Nicht veröffentlicht; enthalten in 1.1.0.

Kleine Design-Korrekturen für die Ansicht am Computer.

### Geändert

- **Kopfzeile in jedem Reiter gleich:** Der Name der Alarmanlage (bei mehreren ein Dropdown), der Stift und der Knopf "Integration in HA öffnen" stehen jetzt auch in der Übersicht und im Protokoll oben, nicht nur in der Konfiguration.
- **Blatt der Sensor-Optionen und oben rechts:** Bei einem breiten Fenster endet das Blatt der Sensor-Optionen auf derselben Linie wie die Knöpfe oben rechts (vorher hörte es vor dem Rand auf).
- **Sensoren, Reiter eines Modus:** Der Titel der Spalte des gewählten Modus (zum Beispiel "Abwesend") ist zusätzlich fett.

### Behoben

- **Abstand über der Sensortabelle:** Der Abstand zwischen der Kachel "Einstellungen pro Modus" und der Tabelle ist fest und verschwindet beim Scrollen nicht mehr.
- **Sortieren nach Zustand** in der Sensorliste brachte "ruhig" und "zu" in keine Ordnung; gleiche Zustände stehen jetzt beieinander.
- **Pfeil der Auswahlfelder** (Dropdowns): als Bild gezeichnet, damit er bei manchen Zoomstufen keine Kerbe zeigt.

## [1.0.0] - 2026-11-10

Erste stabile Version. Keine neue Funktion gegenüber 0.40.0: Versionsnummer und Status im README ändern sich, weil die ganze Integration durch einen externen Code-Review geprüft wurde (siehe 0.40.0) und keine Vorabversion mehr ist.

### Geändert

- **Version 1.0.0, keine Vorabversion mehr.** Das README nennt Alarmageddon nicht mehr eine frühe Vorabversion, und die Installation verlangt in HACS nicht mehr "Pre-release". Alles von 0.24.0 bis 0.40.0 ist enthalten; die Abschnitte darunter listen es auf.

## [0.40.0] - 2026-11-09

Nicht veröffentlicht; enthalten in 1.0.0.

Härtung nach einem externen Code-Review: Wettläufe im Zustandsautomaten, ein Test, der einen echten Alarm verschlucken konnte, ein veralteter Knopf "Deaktivieren", Knöpfe der Alarmmeldung nur für die konfigurierten Empfänger, und das Panel rechnet beim Scharfschalten gleich wie die Anlage.

### Hinzugefügt

- **Wächter für die Alarmaktionen.** Der Ablauf der Alarmaktionen steht jetzt als Ganzes unter Aufsicht, gleich aus welchem Grund etwas dauert: Nach dem Auslösen beginnt der erste Schritt nach höchstens 8 Sekunden (hängt oder scheitert der Start, startet der Wächter die Schritte selbst, ohne den Schnappschuss der Geräte); kein Schritt hält den nächsten länger auf als seine eigene Grenze (eine Aktion 12 Sekunden, ein Warten seine Zeit plus 2 Sekunden, ein Ton seine Dauer plus die Zeit, die der Player zum Antworten haben darf); und bricht der Ablauf selbst unerwartet ab, macht er mit dem nächsten Schritt weiter. Jeder Eingriff steht im Log von Home Assistant und in der Zeitachse des Alarms ("Wächter: …"). Ein hängender Schritt wird nicht abgebrochen (ein Skript darf fertig werden), aber nicht mehr abgewartet; Deaktivieren beendet ihn.

### Sicherheit

- **Knöpfe der Alarmmeldung nur für konfigurierte Empfänger:** "Deaktivieren" und "Sirene stumm" werden nur von einem Handy angenommen, dessen Home-Assistant-Benutzer zu einem konfigurierten Alarm-Empfänger gehört: ein direkt gewählter Dienst `notify.mobile_app_<gerät>` oder ein Mitglied einer gewählten notify-Gruppe (Plattform `group`, auch verschachtelt). Vorher konnte jede bei Home Assistant registrierte Companion App das Ereignis hinter den Knöpfen senden, auch das Handy eines Benutzers, der keine Alarmmeldungen bekommt. Home Assistant beglaubigt nur den Benutzer, der das Handy registriert hat, nicht das einzelne Gerät: zwei Handys desselben Benutzers lassen sich nicht unterscheiden. Ein abgewiesener Versuch steht im Log von Home Assistant. Empfänger, die keine Dienste der Companion App sind, können die Knöpfe nicht benutzen (sie konnten sie nie senden).

### Geändert

- **Ein Ton "bis zum Deaktivieren" läuft immer nebenher.** Er endet nie von selbst; als "abwarten" gespeichert, starteten die Schritte danach (zum Beispiel die Sirene) nie. Der Ablauf zeigt ihn als "läuft nebenher", der Schalter ist fest; bestehende Abläufe verhalten sich so, ohne neu zu speichern.
- **"Deaktivieren" und "Sirene stumm" in der Alarmmeldung** wirken nur, solange der Alarm läuft. Eine alte Alarmmeldung, die auf dem Handy liegen blieb (das "Alarm beendet" kam nie an), kann eine später wieder scharf geschaltete Anlage nicht mehr deaktivieren.
- **Echter Alarm während eines Tests der Alarmaktionen:** der Test endet sofort und der echte Ablauf startet, ohne auf etwas zu warten; die Geräte kehren beim Deaktivieren in den Zustand von vor dem Test zurück. Vorher liefen der Ablauf und, mit einem Push-Schritt im Ablauf, auch die Alarmmeldung nicht, solange der Test (bis 60 s) lief.
- **Meldungen, Einstellungen pro Modus:** mit eingeschaltetem Schalter stehen die Arten, die nicht vom Modus abhängen ("Scharfschalten nicht möglich", "Deaktiviert"), unter den Reitern der Modi unter "Für alle Modi"; mit eingeschaltetem Schalter waren sie gar nicht erreichbar. Mit ausgeschaltetem Schalter ändert sich nichts.
- **Sensortabelle, Reiter eines Modus:** die kleine Zeile unter dem Sensornamen zeigt die Optionen, die im gewählten Modus gelten (wie das Blatt), nicht die Werte für alle Modi.

### Behoben

- **Die eingestellte Dauer zählt ab dem ersten Start.** Wie lange eine Sirene oder ein Ton läuft, steht in den Alarmaktionen ("Sirene ein, Warten, Sirene aus" oder ein Ton mit Dauer). Wurden mitten im Alarm Einstellungen gespeichert (die Anlage lädt neu) oder startete Home Assistant neu, begann die Wartezeit oder der Ton von vorn, eine Sirene konnte bis zu doppelt so lange laufen wie eingestellt. Jetzt läuft nur der Rest; ist die Zeit schon um, folgt sofort der nächste Schritt.
- **Nichts hält die Alarmaktionen mehr auf.** Ein hängendes Gerät oder eine hängende Push-Meldung tat das schon bisher nicht (höchstens 10 Sekunden, eine Push-Meldung gar nicht). Jetzt gilt dasselbe für alles andere, was beim Auslösen mitläuft: scheitert das Ereignisprotokoll, die Alarm-Aufzeichnung, die Meldung oder die Benachrichtigung in Home Assistant, starten die Alarmaktionen trotzdem und die übrigen Teile laufen weiter (vorher stoppte ein scheiternder Teil alles danach, auch die Sirene). Hängt oder scheitert die Ablage vor dem ersten Schritt, starten die Schritte trotzdem (nach höchstens 3 Sekunden), und ein Fehler beim Schreiben der Zeitachse stoppt die folgenden Schritte nicht mehr.
- **Scharfschalten während der Code-Prüfung:** die Code-Prüfung läuft in einem Hilfsthread. Ging in diesem Moment ein Eingangssensor auf (Eingangsverzögerung läuft), beendete das Scharfschalten in einen anderen Modus die Verzögerung still, und die Anlage war scharf statt im Alarm. Das Scharfschalten wird jetzt abgelehnt ("zuerst deaktivieren"), die Verzögerung läuft zum Alarm weiter.
- **Mehrere Anlagen, die beim Start zugleich laden,** legten zwei Kopien der globalen Einstellungen (Voreinstellungen je Sensorart, Meldungen) auf derselben Datei an; eine geänderte Voreinstellung konnte dann das Neuladen einer Anlage auslassen. Eine Kopie, wie beim Panel.
- **"Alarm endet" nach einem Neustart von Home Assistant mitten im Alarm** nahm die Meldung von "Immer aktiv" statt die des Modus, in dem der Alarm lief.
- **Übersicht, "Bereit für" und offene Sensoren:** das Panel wendet dieselben Regeln an wie die Anlage: "Umgehen" und die Werte je Modus (Schalter "Einstellungen pro Modus") zählen. Vorher galt ein Sensor, den die Anlage umgehen würde, als Hindernis.
- **Sensorliste auf der Übersicht:** Sensoren, die nur im Reiter "Immer aktiv" (Einstellungen pro Modus) auf "Immer aktiv" stehen, fehlten in der Liste.
- **Alarm-Aufzeichnung:** ein Alarm, der ohne Deaktivieren endete (alte Alarmdauer aus der Zeit vor 0.25.0, wiederhergestellt), wurde nie abgeschlossen, und der nächste Alarm wurde nicht aufgezeichnet. Einträge eines Sensors, der in der Eingangsverzögerung dauernd ausfällt und zurückkommt (samt der Meldungen dazu), zählen jetzt wie Sensoreinträge gegen die Grenze je Alarm; Zustandswechsel, Schritte und die Alarmmeldung bleiben immer erhalten.
- **Panel:** ein fehlgeschlagenes Scharfschalten zeigte den Fehler in seltenen Fällen im falschen Fenster; der Zeitgeber der Datenabfrage wird freigegeben; ein entferntes Panel stoppt seine Zeitgeber; die Symbole der Sensorklassen Hitze, Schloss und Bewegt sich; in der Kurzfassung eines Alarmtons ohne Lautstärke fehlte ein Leerzeichen; der CSV-Export des Protokolls entschärft Zellen, die wie eine Tabellenformel beginnen.
- **Optionsdialog von Home Assistant:** Eingangssensoren werden gegen die wirklich eingeschalteten Modi geprüft (Anwesend und Abwesend lassen sich im Panel abschalten); der eingegebene Code wird nach einem Eingabefehler nicht in das Formular zurückgegeben.
- **Konfiguration:** ein persönlicher Code ohne Salz oder ein beschädigter Code-Eintrag bricht weder die Code-Prüfung noch das Panel.
- **Reiter Protokoll:** das Panel fragt bei offenem Reiter alle 5 Sekunden; der Server antwortet jetzt mit "unverändert", bis ein Ereignis oder ein Eintrag eines Alarms dazukam, statt jedes Mal bis zu 1000 Ereignisse und 30 Alarme je Anlage zu senden.
- **"Letzte Änderung" der Sensoren** wird innert 5 Sekunden geschrieben, auch wenn sich Sensoren dauernd ändern (vorher schob jede Änderung das Schreiben hinaus, es geschah erst beim Beenden von Home Assistant).
- **Voreinstellungen speichern mit "Auf alle Sensoren anwenden" und eine Sicherung einspielen** laden jede Anlage einmal statt zweimal neu; unveränderte Voreinstellungen laden nichts neu.
- **Code:** die Reste der entfernten Update-Funktion (`http_limit.py`), die ungenutzte Kartenansicht der Sensortabelle und 61 ungenutzte Texte des Panels sind weg; die eigenen Werte pro Sensor werden einmal je Stand der Optionen ermittelt statt bei jedem Sensorereignis.
- **README:** neu geschrieben und neu gegliedert: warum man es nutzt, ein Schnellstart, ein Rundgang mit Bildschirmfotos, die Sicherheitsmechanismen mit Schaubild, die Grenzen und die Details in einem Abschnitt "Gut zu wissen", der sich auf Klick öffnet. Die Bilder entstehen aus dem Nachbau (`tests/panel/readme-shots.mjs`).
- **Tests:** eine systematische Sicherheits-Testreihe (jeder Befehl des Panels nur für Administratoren und nur für die eigene Anlage, Codes und Hashes verlassen den Server nie, Code-Sperre, Zustandsautomat, feindliche Sicherungen und Eingaben, Pfade ohne Anmeldung) und eine Mutationsprobe, die jede Schutzmassnahme ausbaut und verlangt, dass ein Test scheitert; beides läuft bei jedem Push.

## [0.39.0] - 2026-11-09

Sicherungen können einen Namen haben.

### Hinzugefügt

- **Name für eine Sicherung:** "Sichern" fragt nach einem Namen (freiwillig, zum Beispiel "vor dem Umbau"). Die Liste zeigt den Namen mit dem Datum darunter; ohne Namen steht das Datum.

### Behoben

- **Übersicht auf dem Handy:** Suche, Filter-Pillen und Tabellenkopf stehen ganz oben am Bildschirmrand, nur die Zeilen scrollen; die Kopfzeile mit Logo und Reitern und die beiden Kacheln scrollen zuerst weg. Suche und "Ansicht" teilen sich eine Zeile, die Filter-Pillen stehen in einer Zeile zum Wischen, die Auswahlfelder in einer Zeile. Der Titel "Sensoren 19 von 19" entfällt dort (die Pille "Alle" zeigt die Anzahl).
- **Übersicht auf dem Handy:** Der Umschalter Liste/Karten steht nur noch unter "Ansicht" (er brauchte zu viel Platz in der Werkzeugleiste); am Computer bleibt er an beiden Orten.
- **Protokoll:** Die Filter-Pillen der Ereignisse gleiten unter den festen Zeitraum und bleiben dort stehen, während die Liste scrolt.
- **Alarmaktionen hängen nie:** Ein Gerät, das nicht innerhalb von 10 Sekunden antwortet (vorher: 15), hält den Ablauf nicht mehr auf; er geht mit dem nächsten Schritt weiter, und die Zeitachse des Alarms zeigt "Keine Antwort innerhalb von 10 s, der Ablauf ging weiter". Der hängende Aufruf wird nicht abgebrochen (ein Skript darf fertig werden), aber nicht mehr abgewartet, und Deaktivieren beendet ihn, auch wenn er den Abbruch ignoriert. Der Sonos-Schnappschuss vor dem ersten Schritt verzögert den Alarm höchstens um 3 Sekunden. Auch eine fehlschlagende Aktion steht auf der Zeitachse. Deaktivieren, während der Ablauf startet, hinterlässt keinen halb gestarteten Ablauf mehr. Meldungen an die Handys warten ebenfalls höchstens 15 Sekunden.
- **Alarmablauf auf dem Handy:** Die gestrichelte Linie und die Linie zu "Alarm endet" liegen jetzt genau unter der Mitte der Plus-Knöpfe (sie lagen 3 px zu weit rechts).

## [0.38.0] - 2026-11-09

Sicherungen in der Integration, mit Liste.

### Hinzugefügt

- **Sichern** (Konfiguration › Anlage › Sicherung): Ein Knopf legt die aktuelle Konfiguration (alle Anlagen, Voreinstellungen, Benachrichtigungen; nie Codes) in der Integration ab. Darunter listet eine Tabelle die Sicherungen mit Datum und Anlagen: **wiederherstellen** (mit derselben Rückfrage wie beim Import), eine einzelne Sicherung als Datei **herunterladen** oder **löschen**. Es bleiben höchstens 10 Sicherungen; kommt eine elfte dazu, fällt die älteste weg. "Exportieren" und "Importieren" mit einer Datei bleiben.

## [0.37.0] - 2026-11-09

Nicht veröffentlicht; enthalten in 0.38.0.

Scharf- und Deaktivieren in der Übersicht zeigt, dass die Anlage arbeitet.

### Geändert

- **Sensoren auf dem Handy:** Dieselbe Tabelle mit den Kästchen wie am Computer, kompakt (Symbole in der Kopfzeile, Name, vier Kästchen, Pfeil), statt einer Karte je Sensor. Die Eingangsverzögerung und "Sensor entfernen" stehen im Blatt, das der Pfeil öffnet.
- **Knopf "Integration in HA öffnen"** steht wieder in jedem Reiter der Konfiguration (neben dem Namen oben), nicht nur bei Anlage.
- **Übersicht, Scharf- und Deaktivieren:** Der Knopf wechselt sofort; danach erscheint die Ladeanzeige (drei drehende Punkte, wie sonst) über dem leicht verschwommenen Hintergrund, bis Home Assistant den neuen Zustand meldet (höchstens 4 Sekunden). Währenddessen lässt sich nichts antippen, so ist klar, dass die Anlage arbeitet und nicht hängt.

## [0.36.0] - 2026-11-09

Nicht veröffentlicht; enthalten in 0.38.0.

Ein aufgeräumteres Protokoll, besonders auf dem Handy.

### Geändert

- **Filter im Protokoll** sind beschriftet ("Zeitraum", "Alarmanlage"), und eine Zeile mit den Daten, die der gewählte Zeitraum umfasst (zum Beispiel "Montag, 9. November 2026"), macht klar, was die Liste zeigt.
- **Download** steht als unauffälliges Download-Symbol in der festen Leiste unten, neben der Anzahl der Ereignisse und Alarme.

### Entfernt

- **JSON-Export.** Der CSV-Download bleibt.

### Behoben

- **Sensoren auf dem Handy:** Die Erklärung zum Schalter "Einstellungen pro Modus" steht da (die Leiste mit Schalter und Reitern scrollt auf dem Handy mit der Seite, am Computer bleibt sie fest). Damit zeigen alle vier Stellen mit diesem Schalter (Sensoren, Aktionen, Meldungen, Anlage) eine Erklärung, die sich mit dem Schalter ändert.
- **Aktionen auf dem Handy:** Die Erklärung zum Schalter "Einstellungen pro Modus" steht wieder da (die Leiste scrollt mit der Seite, statt fest zu stehen).
- **Tabellenköpfe kleben auch auf dem Handy** (Übersicht und Sensoren): Die oberste Zeile einer Tabelle mit Beschriftung, Filtern und Sortieren scrollt nie weg; auf dem Handy scrollen dafür die Filter weg, und die Tabellen sind so kompakt, dass sie ohne seitliches Scrollen passen. Die Standardspalten der Übersicht auf dem Handy sind jetzt Zustand, Batterie und Empfang (Firmware lässt sich unter "Ansicht" ergänzen).
- **Sensor-Blatt auf dem Handy:** Nur noch ein X statt zwei, und das Blatt läuft nicht mehr 22 px über den rechten Rand (die Leiste mit "Fertig" war zu breit, was den Inhalt nach links verschob).
- **Alarmablauf:** Auch unter den Plus-Knöpfen mehr Abstand (zwischen Plus und nächster Aktion).
- **Handy:** Die vier Reiter der Einstellungen pro Modus (Modi und "Immer aktiv") stehen in zwei Reihen statt sich zu überlappen.
- **Mehrere Alarmanlagen beim Start:** Lud Home Assistant zwei oder mehr Alarmanlagen zugleich, scheiterte eine mit "Einrichtungsfehler" ("Overwriting panel alarmageddon") und fehlte im Panel. Das Panel wird jetzt sicher nur einmal registriert.
- **Laden mit beschädigten Optionen:** Eine Alarmanlage lädt auch dann, wenn ein Eintrag der Sensor-Optionen beschädigt ist (kein Wörterbuch), bei der Übernahme der alten Wahl "Offener Sensor beim Scharfschalten" oder später. Die Ursache eines Einrichtungsfehlers steht immer im Protokoll von Home Assistant; zeigt eine Anlage "Einrichtungsfehler", hilft der vollständige Eintrag dort.

## [0.35.2] - 2026-11-09

### Geändert

- **Name der Alarmanlage** (Titel oder Dropdown, Stift, "Integration in HA öffnen") steht ganz oben neben dem Logo statt unter den Reitern. Der Name (oder das Dropdown zum Wechseln der Anlage, mit dem Stift zum Umbenennen) bleibt in jedem Reiter der Konfiguration sichtbar, auch bei Benachrichtigungen. Der Knopf "Integration in HA öffnen" steht nur im Reiter Anlage. Auf dem Handy zeigt der Knopf nur das Symbol.

## [0.35.1] - 2026-11-09

### Geändert

- **Aktionen:** Der Knopf "Testen" steht in der festen Leiste unten, neben "Abbrechen" und "Speichern" (auf dem Handy nur das Symbol).

### Behoben

- **Aktionen:** Die Leiste mit Schalter und Reitern bleibt beim Scrollen jetzt wirklich fest (sie scrollte bisher weg); auf dem Handy ist sie kompakt, ohne Erklärtext.
- **Aktionen auf dem Handy:** Die Karte "Alarm endet" wird nicht mehr in eine schmale Spalte gequetscht.

## [0.35.0] - 2026-11-09

Die Alarmanlage lässt sich umbenennen, mit Kurzbefehl nach Home Assistant.

### Hinzugefügt

- **Name der Alarmanlage** gross und fett oben in der Konfiguration (Sensoren, Aktionen, Anlage), mit einem Stift zum Umbenennen. Der Name ändert sich durchgängig in Home Assistant: Eintrag, Gerät und Name aller Entitäten. Ein Schalter "Entitäts-IDs aus dem neuen Namen neu erzeugen" benennt auch die Entitäts-IDs um, die noch dem alten Namen folgen (selbst benannte IDs bleiben); Automationen, die die alte ID nutzen, müssen angepasst werden. Ein Name, den eine andere Alarmanlage schon hat, wird abgelehnt.
- **Knopf "Integration in HA öffnen"** neben dem Namen: öffnet die Integrationsseite dieser Alarmanlage in Home Assistant.
- **Einstellungen pro Modus bei den Aktionen** (Konfiguration › Aktionen): derselbe Schalter wie bei Sensoren, Meldungen und Anlage. Aus (Standard): Ein Ablauf, samt "Alarm endet", gilt für jeden Alarm, in allen Modi und bei immer aktiven Sensoren. Ein: Reiter der Modi und "Immer aktiv", jeder mit eigenem Ablauf. Anlagen, deren Abläufe sich schon unterscheiden, starten mit eingeschaltetem Schalter. Beim Ausschalten gilt der Ablauf des ersten Modus für alle (zurücknehmen mit "Abbrechen").
- **Filter-Pillen bei den Ereignissen** im Reiter Protokoll (Alle, Alarme, Scharf, Deaktiviert, Scharfschalten fehlgeschlagen), mit Anzahl.

### Geändert

- **Reiterleisten der Einstellungen pro Modus** (Sensoren, Aktionen, Benachrichtigungen › Meldungen, Anlage) stehen links bündig unter dem Schalter. Bei den Sensoren bleibt die Leiste mit Schalter und Reitern beim Scrollen fest.
- **Bei mehreren Alarmanlagen** wird der Name zu einem gleich grossen Dropdown zum Wechseln der Anlage (statt des kleinen Dropdowns neben den Reitern). Benachrichtigungen gelten für alle Anlagen und zeigen keinen Namen.

## [0.34.2] - 2026-11-09

Nicht veröffentlicht; enthalten in 0.35.0.

### Behoben

- **Alarmablauf:** Die gestrichelte Linie eines Schritts, der nebenher läuft, geht nicht mehr durch den Plus-Knopf; der Plus-Knopf hat etwas mehr Abstand nach oben.

## [0.34.1] - 2026-11-09

Nicht veröffentlicht; enthalten in 0.35.0.

Der Geltungsbereich der Einstellungen pro Modus ist jetzt klar ersichtlich.

### Geändert

- **Einstellungen pro Modus:** Schalter, Reiter und alle Einstellungen darunter stehen in einer umrandeten Gruppe (Sensoren, Benachrichtigungen › Meldungen, Anlage › Zeiten und Verhalten), mit der Zeile "Alles darunter gilt nur für <Modus>".
- **Sensor-Blatt:** Ein grosses Banner "Diese Einstellungen gelten nur für <Modus>" (im Reiter "Immer aktiv": "…solange die Anlage deaktiviert ist") ersetzt die kleine Überschrift.

## [0.34.0] - 2026-11-09

Ein Reiter "Immer aktiv" bei den Einstellungen pro Modus, und Einstellungen pro Modus bei den Meldungen.

### Hinzugefügt

- **Reiter "Immer aktiv"** bei den Einstellungen pro Modus der Sensoren (Konfiguration › Sensoren, Schalter an): Er hat alle Sensor-Optionen für sich und gilt, solange die Anlage deaktiviert ist. Die Spalte "Immer aktiv" gehört zu diesem Reiter; die Option "Immer aktiv" selbst hängt nie an einem Modus, ein Rauchmelder lässt sich also nicht in einem Modus abschalten.
- **Einstellungen pro Modus bei den Meldungen** (Konfiguration › Benachrichtigungen › Meldungen): ein Schalter "Einstellungen pro Modus"; nur wenn er an ist, erscheinen die Reiter der Modi (es gibt keinen Reiter "Alle Modi", der erste Modus ist gewählt), und jeder Modus bekommt eigenes An/Aus, Kritisch, Lautstärke und "In Home Assistant stehen lassen" für die Meldungen im scharfen Zustand: Stiller Alarm, **Sensor nicht erreichbar, während scharf**, Eingangsverzögerung und Scharf geschaltet. Bei ausgeschaltetem Schalter gilt alles für alle Modi; die eigenen Werte bleiben gespeichert. Teil des Entwurfs und der Sicherung.

- **Einstellungen pro Modus bei der Alarmanlage** (Konfiguration › Anlage › Zeiten und Verhalten): ein Schalter "Einstellungen pro Modus", standardmässig aus. Aus: ein Satz Ausgangsverzögerung, Eingangsverzögerung und Bestätigungsfenster für alle Modi. Ein: Die Reiter der Modi erscheinen, und jeder Modus hat eigene Werte. Anlagen, deren Modi sich schon unterscheiden, starten mit eingeschaltetem Schalter. Beim Ausschalten gelten die Werte des ersten Modus für alle Modi. Teil der Sicherung.

### Geändert

- **"Sensor nicht erreichbar, während scharf"** steht jetzt bei den übrigen Meldungen (vorher unter Wartung), damit es je Modus abweichen kann. "Sensor nicht erreichbar" (längere Zeit) bleibt unter Wartung.

## [0.33.0] - 2026-11-09

Einstellungen pro Modus vereinfacht: dieselbe Tabelle, mit den Einstellungen des gewählten Modus.

### Geändert

- **Einstellungen pro Modus funktionieren anders** (Konfiguration › Sensoren): Die Reiter der Modi erscheinen nur, wenn der Schalter "Einstellungen pro Modus" an ist; es gibt keinen Reiter "Alle Modi" mehr, und der erste Modus ist gewählt. Mit eingeschaltetem Schalter hat die Tabelle die **gleichen Spalten wie vorher** (Zonen aller Modi, "Immer aktiv", Eingangsverzögerung), so siehst du immer, in welchen Modi ein Sensor aktiv ist. Die Spalte des gewählten Modus und "Immer aktiv" (gilt dann für diesen Modus) sind hervorgehoben. Alle anderen Sensor-Optionen (darf offen sein, umgehen, scharf sobald geschlossen, Ausfall gilt als Alarm, braucht zweiten Sensor, stiller Alarm) stellst du im Blatt des Sensors ein, für den gewählten Modus. Mit ausgeschaltetem Schalter ist alles wie vor 0.32.0. Am Handy zeigen die Zonen-Knöpfe der Karten den gewählten Modus mit einem Rahmen. Mehr Abstand um den Schalter.
- **Der Herkunftstext** einer Option in einem Modus heisst "Grundwert (wie vor dem Einschalten)" und "Eigener Wert für {Modus}" mit "zurück zum Grundwert".

## [0.32.0] - 2026-11-09

Sensor-Einstellungen pro Modus, und "Umgehen" ist jetzt eine Einstellung pro Sensor.

### Hinzugefügt

- **Einstellungen pro Modus** in Konfiguration › Sensoren: Ein Schalter "Einstellungen pro Modus" über der Tabelle. Aus (Standard): Die Einstellungen eines Sensors gelten für alle Modi, wie bisher. Ein: Die Reiter "Alle Modi", "Anwesend", "Abwesend" und "Nacht" sind wählbar, und jeder Modus kann für **alle** Sensor-Optionen eigene Werte haben (immer aktiv, darf offen sein, umgehen, scharf sobald geschlossen, Ausfall gilt als Alarm, braucht zweiten Sensor, stiller Alarm). Der Reiter eines Modus zeigt die Tabelle mit allen Optionen als Kästchen (ein Punkt markiert einen eigenen Wert dieses Modus), das Blatt eines Sensors zeigt die Werte des gewählten Modus mit Herkunft ("Eigener Wert für Abwesend" / "Wie bei Alle Modi") und "zurück zu Alle Modi". Ohne eigenen Wert gilt der Wert für alle Modi, dann die Voreinstellung der Sensorart. Beim Ausschalten bleiben die Werte erhalten (sie gelten nur nicht). Teil des Entwurfs und der Sicherung.
- **Neue Sensor-Option "Beim Scharfschalten umgehen":** Ist der Sensor beim Scharfschalten offen und darf nicht offen sein, wird er bis zum Deaktivieren übergangen, statt das Scharfschalten zu verhindern. Sie gehört auch zu den Voreinstellungen je Sensorart.

### Entfernt

- **Die Einstellung "Offener Sensor beim Scharfschalten"** (verhindern oder umgehen) der Alarmanlage, im Panel und im Optionsdialog von Home Assistant. Das entscheidet jetzt jeder Sensor und, wenn du willst, jeder Modus. Bestehende Alarmanlagen behalten ihr Verhalten: Ein früheres "Umgehen" wird einmal auf die Option "Umgehen" der Sensoren übertragen (je Modus, wenn die Modi sich unterschieden); die alten Werte verschwinden.

## [0.31.0] - 2026-11-09

Meldungen können in Home Assistant stehen bleiben, "Nur melden" heisst neu "Stiller Alarm", und die Scrollposition springt nicht mehr.

Nicht veröffentlicht; enthalten in 0.32.0.

### Hinzugefügt

- **Als Benachrichtigung in Home Assistant stehen lassen** (Konfiguration › Benachrichtigungen): Jede Art, Alarm und Wartung, kann zusätzlich in der Glocke von Home Assistant erscheinen. Sie bleibt, bis jemand sie wegklickt, unabhängig von den Empfängern; dieselbe Art ersetzt ihren eigenen Eintrag (die Alarmmeldung wird durch "Alarm beendet" ersetzt). Die Einstellung kann auch je Modus abweichen, wo es Meldungen je Modus gibt. Teil der Sicherung.

### Geändert

- **Die Sensor-Option "Nur melden" heisst "Stiller Alarm"** überall (Option, Hinweise, Liste).

### Behoben

- **Sensoren hinzufügen scrollt nicht mehr nach oben:** Im Fenster "Sensoren hinzufügen" bleibt die Liste stehen, wenn du einen Sensor antippst, und Fenster behalten ihre Scrollposition, wenn sie neu gezeichnet werden.
- **Tabellenkopf und Blatt oben nicht mehr abgeschnitten:** Die festen Teile oben (Reiter, Unterreiter, Werkzeugleiste) verdecken die ersten Zeilen nicht mehr; ihr Abstand gehört zu den Teilen selbst und ist darum beim Scrollen gleich.

## [0.30.0] - 2026-11-09

Darstellungsfehler in der Sensortabelle und im Ablauf der Aktionen behoben.

### Behoben

- **Sensortabelle:** Auf einem breiten Bildschirm behält die Tabelle ihre Breite, und die Kästchen bleiben an ihrem Platz, wenn die Optionen eines Sensors aufgehen (das Blatt steht daneben). Papierkorb und Pfeil stehen auf einer Zeile, der Pfeil ganz rechts.
- **Feste Teile oben** (Reiter, Unterreiter, Werkzeugleiste, Spaltenkopf) schieben sich beim Scrollen nicht mehr übereinander; sie werden neu gemessen, wenn sich ihre Höhe ändert (zum Beispiel wenn das Logo geladen ist).
- **Ablauf der Aktionen:** Die Symbole "Alarm beginnt" und "Alarm endet" sind undurchsichtig, die Linie scheint nicht mehr durch.

## [0.29.0] - 2026-11-09

Eigene Meldungswerte je Modus für alles, was passiert, während die Anlage scharf ist.

Enthält die Änderungen aus 0.28.0.

### Hinzugefügt

- **Meldungen je Modus** (Konfiguration › Benachrichtigungen › Meldungen): Unterreiter "Alle Modi", "Anwesend", "Abwesend", "Nacht". Die Arten, die nur im scharfen Zustand vorkommen (**Stiller Alarm**, **Eingangsverzögerung**, **Scharf geschaltet**, **Sensor nicht erreichbar, während scharf**), können je Modus eigene Werte haben (an/aus, Kritisch, Lautstärke, eigene Testmeldung). Ohne eigenen Wert gilt der Wert von "Alle Modi"; jede Art zeigt ihre Herkunft ("Eigener Wert für diesen Modus" / "Wie bei Alle Modi") mit "Zurücksetzen", und "Alle Modi" weist auf die Modi mit eigenen Werten hin. Teil des Entwurfs und der Sicherung, vom Server geprüft.

## [0.28.0] - 2026-11-09

Die Update-Funktion ist entfernt, "Alarm endet" hat eine eigene Meldung, und die Sensortabelle zeigt "Immer aktiv".

Nicht veröffentlicht; enthalten in 0.29.0.

### Entfernt

- **Die ganze Update-Funktion** (Konfiguration › Updates, die tägliche Prüfung, die Entität von HACS, die Meldung "Update verfügbar" unter Reparaturen und bei den Meldungsarten, "Updates automatisch installieren", die Release Notes im Panel und die Einstellungen in der Sicherung). Aktualisiert wird über HACS wie bei jeder Integration. Alte Einstellungen und die alte Meldung unter Reparaturen verschwinden von selbst.

### Hinzugefügt

- **Element "Alarm endet"** am Ende jedes Ablaufs (Konfiguration › Aktionen, je Modus) mit einer optionalen **eigenen Meldung**, wenn jemand deaktiviert: dieselben Optionen wie die Alarmmeldung (Titel und Text mit Platzhaltern, Vorschau, Kritisch, Lautstärke, Klickziel; ohne Knöpfe), in einem Fenster wie bei den Schritten, mit Testknopf. Die Meldung ersetzt die Standardmeldung "Alarm beendet" (gleicher tag, ersetzt also die Alarmmeldung auf dem Handy). Teil der Sicherung. Ob Geräte nach dem Alarm zurückkehren, entscheidet allein "Rückgängig beim Deaktivieren/Quittieren" im jeweiligen Schritt.
- **"Immer aktiv" als Kästchen** in der Sensortabelle unter Konfiguration › Sensoren (und als Knopf auf den Karten am Handy): zeigt den wirksamen Wert; ein Klick setzt einen eigenen Wert für diesen Sensor.
- **Filter nach Sensorart** (Aufklappmenü) in der Sensorliste der Übersicht.
- **Übersicht bleibt im Blick:** Bei hohem Fenster bleiben die Karten der Alarmanlagen, die Filter und der Spaltenkopf beim Scrollen stehen.

### Geändert

- **Sensortabelle (Konfiguration):** Pfeil und Löschsymbol stehen nebeneinander, der Pfeil ganz rechts; die Spalten Integration und Batterie entfallen, damit es übersichtlich bleibt.
- **Ablauf der Aktionen:** Die Linie läuft nicht mehr durch die Karten und endet bei "Alarm endet", das ein farbiges Symbol hat.
- **Lautstärkeregler** höchstens halb so breit; **Rollbalken in Fenstern** mit mehr Abstand zum Rand.
- **Fenster:** Der Spaltenkopf der Tabellen wird nicht mehr von der Werkzeugleiste verdeckt.
- **"Sensor meldet (kein Alarm)" heisst neu "Stiller Alarm"**, und das Kapitel "Alarmmeldungen" heisst "Meldungen" (Konfiguration › Benachrichtigungen).

## [0.27.0] - 2026-11-09

Ein Element "Alarm endet" am Ende jedes Ablaufs bestimmt, was Deaktivieren tut.

Enthält die Änderungen aus 0.24.0, 0.25.0 und 0.26.0.

### Behoben

- **Die Ansicht springt nicht mehr nach oben**, wenn der Bildschirm neu gezeichnet wird (Sensoren markieren, Sensoren hinzufügen, Fenster schliessen): Die Scrollposition bleibt innerhalb derselben Ansicht erhalten, und ein schliessendes Fenster kehrt zur Position beim Öffnen zurück.

### Hinzugefügt

- **Element "Alarm endet"** am Ende jedes Ablaufs (Konfiguration › Aktionen, je Modus): die Wahl "Beim Deaktivieren/Quittieren": **Stoppen, markierte Schritte rückgängig** (wie bisher, Standard), **Stoppen, alle Schritte rückgängig** (alle Geräte, die die Schritte verändert haben, kehren in den Zustand vor dem Alarm zurück, unabhängig von der Einstellung je Schritt) oder **Nur stoppen, nichts rückgängig** (alle Schritte stoppen und Alarmtöne verstummen, geschaltete Geräte bleiben). Die Wahl gehört zum Entwurf, zur Sicherung und zu den Daten der Anlage; der Standard wird nicht gespeichert.

## [0.26.0] - 2026-11-09

Strukturierte Fenster mit Schliessen-Knopf und festen Knöpfen, feste Kopfzeile mit sortierbarer Liste, freie Spaltenwahl je Gerät, Filter "Belegung" und Voreinstellungen für alle Sensoren übernehmbar.

Nicht veröffentlicht; enthalten in 0.27.0.

### Hinzugefügt

- **Fenster (Popups) wie in Device Panel:** Jedes Fenster hat oben rechts einen runden Schliessen-Knopf (x), und die Knöpfe unten (Abbrechen, Übernehmen, Speichern …) bleiben im Blick, während der Inhalt scrollt. "Abbrechen", das x und Escape fragen "Änderungen verwerfen?", wenn etwas eingegeben oder geändert wurde (Aktionsschritt, Sensorauswahl, Voreinstellungen, neuer Code).
- **Feste Kopfzeile:** Titelleiste mit Reitern, Unterreiter, Werkzeugleiste und der Spaltenkopf der Sensortabellen bleiben beim Scrollen stehen; es scrollt nur die Liste.
- **Nach Spalte sortieren:** Ein Klick auf einen Spaltenkopf der Sensorliste sortiert danach (ein zweiter Klick kehrt um, ein Pfeil zeigt die Richtung); jede Spalte lässt sich sortieren (Zustand, Batterie, Prognose, Empfang, Firmware, Modell, Integration, letzte Änderung, Bereich, Zonen). Leere Werte stehen immer am Ende. Die Kopfzeile ist prägnanter. Die Wahl steht auch im Fenster "Ansicht" als Aufklappmenü.
- **Filter "Belegung":** Bewegungs-, Belegungs- und Anwesenheitssensoren haben einen eigenen Filter; "Offen" zählt sie nicht mehr mit.
- **Sensorzeile überall antippen** in Konfiguration › Sensoren (auf dem Handy auch die Karte) öffnet die Optionen; Kästchen, Schalter und Knöpfe in der Zeile behalten ihre Aufgabe.
- **"Auf alle Sensoren anwenden"** bei den Voreinstellungen je Sensorart: löscht die eigenen Werte aller Sensoren, damit jeder Sensor den Voreinstellungen folgt (mit Warnung und Anzahl der betroffenen Sensoren).
- **Logo** der Integration neben den Reitern.
- **"Rückgängig beim Deaktivieren/Quittieren"** (vorher "Beim Deaktivieren in den vorherigen Zustand zurück") mit klarem Hinweis bei jeder Aktion, wo es sinnvoll ist (Gerät schalten, Alarmton, Eigene Aktion mit Geräten). Nicht bei "Szene oder Skript", deren Wirkung sich nicht allgemein rückgängig machen lässt.

### Geändert

- **Alarmton:** Der neue Schritt ist standardmässig "Nicht abwarten", der nächste Schritt startet also sofort; bestehende Schritte bleiben wie gespeichert.
- **Aufklappmenüs sehen überall gleich aus** (eigener Pfeil mit Abstand zum Rand); die Wahl der Alarmanlage in der Konfiguration ist auffällig.
- **Breite Bildschirme:** Der Inhalt ist höchstens 1680 px breit, links und rechts bleibt Weissraum.
- **Dialog der Push-Meldung** in Kapiteln mit Strich vor dem Titel (Meldung, Zustellung, Klickziel, Aktionen); das Design gilt in allen Aktionsdialogen.

## [0.25.0] - 2026-11-09

Die Sensorliste auf der Übersicht funktioniert wie die Liste in Device Panel (eigene Spalten für Handy und Computer), und der Alarm dauert, bis er quittiert wird.

Nicht veröffentlicht; enthalten in 0.27.0.

### Hinzugefügt

- **Sensorliste wie in Device Panel:** Die Liste ist die Standardansicht, am Computer und auf dem Handy. Spalten werden für den **Computer** und das **Handy** getrennt gewählt und angeordnet (Ansicht › "Für diesen Computer" / "Für das Handy"), mit eigener Sortierung, Richtung und Gruppierung, und pro Benutzer in Home Assistant gespeichert (zusätzlich im Browser als Rückfall). Spalten: Zustand, Batterie, Prognose, Empfang, Firmware, Modell, Integration, letzte Änderung, Bereich, Zonen. Das Handy bekommt standardmässig einen kompakten Satz (Zustand, Batterie, Empfang, Firmware).
- **Kartenansicht ist optional** auf beiden Geräten (Umschalter "Liste / Karten"); die Karten zeigen die für das Gerät gewählten Felder.

### Geändert

- **Der Alarm dauert, bis er quittiert wird:** Der Zustand "Alarm" bleibt, bis jemand deaktiviert, in jedem Modus und auch bei immer aktiven Sensoren. Die Einstellung "Alarmdauer" ist aus dem Panel, dem Optionsdialog und den Alarmanlagen entfernt. Wie lange eine Sirene oder ein Alarmton läuft, steht im Schritt der Aktionen (Alarmton: "Dauer"). Deaktivieren stoppt weiterhin alle Schritte und stellt die Geräte zurück. Alte Werte in den Optionen oder in einer Sicherung werden ignoriert.
- **Die Vorschau der Pushmeldung** steht jetzt direkt unter den Platzhaltern, vor den Optionen zur Zustellung.
- **Verständlichere Beschriftung der Knöpfe der Pushmeldung** (Konfiguration › Aktionen, Schritt "Push-Meldung"): Die Gruppe heisst "Aktionen der Pushmeldung", jeder Eintrag sagt, dass er als Knopf unter der Meldung erscheint und was er tut. Der Hinweis zum Alarmton erwähnt die Alarmdauer nicht mehr.
- **Die Ebene "Immer aktiv" entfällt** in Konfiguration › Anlage › "Einstellungen je Modus": Sie enthielt nur die Alarmdauer. Die Aktionen für "immer aktiv" bleiben in Konfiguration › Aktionen.

## [0.24.0] - 2026-11-09

Nicht veröffentlicht; enthalten in 0.27.0.

### Geändert

- **Alle Reiter- und Auswahlleisten folgen dem Design von Device Panel** (Design-Regel "Auswahlknöpfe"): gleich breite Felder mit 2 px Abstand, 3 px Innenabstand und 14 px Rundung, die Leiste in 7 % Textfarbe über der Kartenfarbe, das gewählte Feld als Kapsel in der Farbe des Seitengrunds mit dünnem Innenrand, der gewählte Reiter in der Akzentfarbe (Schrift 500). Die Kapsel gleitet in 0,46 s mit leichtem Nachschwingen zum neuen Reiter und ist unterwegs etwas durchscheinend.
- **Neuzeichnen unterbricht das Gleiten nicht:** Das Panel merkt sich die letzte Lage jeder Kapsel und fährt von dort weiter, auch wenn die Leiste mitten in der Fahrt neu gezeichnet wird (kein Sprung zurück). Ohne gewählten Reiter gibt es keine Kapsel. Bei "Bewegung reduzieren" im System steht die Kapsel sofort am Ziel. Jede Leiste hat einen eigenen Schlüssel, zwei Leisten teilen sich nie eine Lage.
- **Handy:** Tippfläche mindestens 44 px, die Leisten füllen die Breite, ab fünf Reitern vier Spalten in Zeilen (bei schmalen Handys drei). Kleine Leisten (zum Beispiel der Umschalter Liste / Karten) bleiben so breit wie ihr Inhalt.
- **"Offener Sensor beim Scharfschalten" ist ein Aufklappmenü** (Konfiguration › Anlage › Verhalten) statt zwei Reitern: Reiter wirkten dort zu nah an der Navigation und verwirrten.

### Behoben

- **"Letzte Änderung" in der Sensorliste** springt nicht mehr auf den Zeitpunkt des letzten Neustarts von Home Assistant. Nur ein Wechsel zwischen offen und zu zählt; "nicht verfügbar" und zurück (Neustart, Funkabbruch) nicht. Alarmageddon merkt sich die Zeit selbst und liest für Sensoren ohne gemerkte Zeit einmal den Verlauf (Recorder, letzte 90 Tage); ohne echten Wechsel in dieser Zeit zeigt die Liste "–".


## [0.23.0] - 2026-11-08

Enthält die Änderungen aus 0.22.0.

### Hinzugefügt

- **Kartenlayout für die Sensorliste** (Übersicht): ein Umschalter "Liste / Karten" neben "Ansicht". Die Karten zeigen je Sensor eine kleine Karte mit allen Angaben der gewählten Spalten (Zustand, Batterie, Prognose, Empfang, Firmware, Modell, Integration, letzte Änderung, Zonen), als Raster und wie die Liste gruppiert. Auf dem Handy gelten immer die Karten, sie folgen der Breite.
- **Klickziel der Alarmmeldung** (Konfiguration › Aktionen, Schritt "Push-Meldung"): Standardmässig öffnet ein Tipp das Protokoll mit dem laufenden Alarm (was seit dem Auslösen wann passiert ist, die Ansicht aktualisiert sich alle 5 Sekunden). Alternativ die Übersicht oder ein eigener Pfad in Home Assistant (zum Beispiel `/lovelace/alarm`). Der Knopf "Öffnen" nutzt dasselbe Ziel.
- **"Wartet auf das Ende" / "Läuft nebenher" an jedem Schritt** des Ablaufs: Ein Schalter an der Karte stellt es mit einem Tipp um, und nach einem Schritt, der nebenher läuft, ist die Verbindung zum nächsten gestrichelt, so sieht man den Ablauf auf einen Blick.
- **Durchsuchbare Auswahl** bei "Art" und "Aktion" einer eigenen Aktion: Tippen filtert die Liste.
- **Sensoren hinzufügen** (Konfiguration › Sensoren › "Sensoren hinzufügen"): dieselben Filterpillen wie die Sensorliste (Alle, Türen & Fenster, Bewegung, Weitere) und ein höheres Suchfeld.
- Das Protokoll aktualisiert sich alle 5 Sekunden, solange es offen ist (vorher nur bei laufendem Alarm).

### Geändert

- **Filterpillen haben Abstand** (auch zwischen den Zeilen, wenn sie umbrechen).
- **Das Kapitel "Alarmmeldung" in Konfiguration › Benachrichtigungen entfällt** (die Einstellungen stehen im Push-Schritt, ein weiterer Hinweis braucht es nicht).

### Behoben

- **Die Alarmanlage wurde nach dem Hinzufügen von Sensoren vergessen** ("Noch keine Alarmanlage", und das Panel hing): Home Assistant lädt die Alarmanlage beim Speichern neu, und das Seitenpanel wurde dabei entfernt und neu angelegt. Das Panel bleibt jetzt stehen; die Oberfläche behält die letzten Daten und zeigt die Ladeanzeige (dieselbe wie Device Panel: gedimmter Inhalt, drei drehende Punkte), bis das Neuladen fertig ist. Das Seitenpanel verschwindet erst, wenn die letzte Alarmanlage entfernt wird.

## [0.22.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Hinzugefügt

- **Zeitraum im Protokoll** (Reiter Protokoll): "Alles", "Letzte 3 Stunden", "Letzte 24 Stunden", "Heute", "Gestern", "Letzte 7 Tage", "Letzte 30 Tage", "Tag wählen …" (mit dem Datumsfeld zu einem Tag springen) und "Zeitraum wählen …" (von, bis). Bei mehreren Alarmanlagen lässt sich auch nach Alarmanlage filtern. Die Liste zeigt, wie viele Ereignisse und Alarme passen. Der Zeitraum wird pro Browser gemerkt.
- **Export des Protokolls** als CSV (Semikolon und BOM, öffnet sich in Excel richtig) oder JSON. Der Export enthält genau das, was der gewählte Zeitraum und die gewählte Alarmanlage zeigen: die Ereignisse und die Zeitachsen der Alarme (CSV: eine Zeile je Eintrag mit Zeit, Alarmanlage, Art, Beschreibung, Sensor, Person und dem Alarm, zu dem er gehört). Die Liste auf dem Bildschirm zeigt die neuesten 300 Ereignisse; der Export enthält alle.

### Geändert

- **Das Protokoll behält mehr:** bis zu 1000 Ereignisse und 30 Alarme je Alarmanlage (vorher 50 und 20), damit Zeiträume wie "Letzte 30 Tage" etwas bringen.

## [0.21.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Hinzugefügt

- **Symbol der Integration in den Meldungen:** Jede Meldung von Alarmageddon (Alarm, Sensoren, Wartung, Update) trägt das Symbol der Integration. Android zeigt es als Symbol der Meldung. iOS zeigt immer das Symbol der Home-Assistant-App; das lässt sich von einer Integration nicht ersetzen. Das Symbol liefert Home Assistant ohne Anmeldung aus (`/alarmageddon_icon.png`).

## [0.20.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Geändert

- **Alarmmeldung nur im Push-Schritt** (Konfiguration › Aktionen, "Push-Meldung"): Kritisch, Lautstärke und die Knöpfe "Öffnen", "Sirene stumm" und "Deaktivieren" stellst du dort ein, zusammen mit Titel und Text, für jeden Modus und Push-Schritt getrennt. In Konfiguration › Benachrichtigungen gibt es die Art "Alarm" und das Kapitel "Knöpfe in der Meldung" nicht mehr; ein Hinweis mit Knopf führt zu den Aktionen.
- **Bestehende Alarmanlagen verhalten sich wie bisher:** Ein Push-Schritt ohne eigene Werte nutzt die früheren globalen Werte (Kritisch, Lautstärke, Knöpfe), bis du sie im Schritt änderst.
- **Ein Knopf wirkt nur, wenn die Meldung ihn anbietet.** Das wird aus der Konfiguration abgeleitet und wirkt darum auch nach einem Neustart von Home Assistant bei einer Meldung, die noch auf dem Handy steht.
- **Die Alarmmeldung lässt sich nicht mehr abschalten:** Sie geht immer raus (ein früheres "aus" bei der Art "Alarm" zählt nicht mehr). Ohne Push-Schritt in den Aktionen geht eine Standardmeldung raus (kritisch, Knopf "Öffnen").

## [0.19.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Hinzugefügt

- **Eigener Titel und Text der Alarmmeldung** (Konfiguration › Aktionen, Schritt "Push-Meldung", mit dem Stift öffnen): Der Standardtext steht in den Feldern und lässt sich beliebig ändern. Die Platzhalter `{name}` (Alarmanlage), `{sensor}` (auslösender Sensor), `{time}` (Uhrzeit) und `{mode}` (Modus) fügt man mit einem Tipp ein, beim Alarm werden sie gefüllt; eine Vorschau zeigt die Meldung mit echten Namen. "Standardtext wiederherstellen" bringt den Standard zurück. Ein unveränderter Text wird nicht gespeichert und folgt so weiter der Sprache von Home Assistant. Knöpfe, Kritisch und Lautstärke kommen wie bisher aus Konfiguration › Benachrichtigungen.

## [0.18.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Geändert

- **Alarmton: Dauer statt Wiederholungen** (Konfiguration › Aktionen): "Wie lange es klingeln darf" in Sekunden (mit Schnellwahl 10 s, 30 s, 1 min, 5 min) oder "Bis die Alarmanlage deaktiviert wird": Der Ton wiederholt sich dann ohne Ende, bis jemand deaktiviert, die Sirene stumm schaltet oder die Alarmdauer endet. Ist die Zeit um, werden die Medienplayer gestoppt, damit der Ton nicht ausklingt. Bestehende Schritte mit Wiederholungen funktionieren weiter (angezeigt als passende Sekundenzahl, gespeichert wie bisher, bis du sie bearbeitest).
- **"Sirene stumm" wirkt immer:** Der Knopf in der Meldung stoppt jetzt auch dann die Medienplayer, wenn alle Schritte der Aktionen schon durch sind, ein Ton aber noch klingen könnte, und er wirkt bei einem Ton ohne Ende.

## [0.17.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Hinzugefügt

- **"Nicht abwarten"** (Konfiguration › Aktionen, je Schritt der Art Gerät schalten, Alarmton, Szene oder Skript, Eigene Aktion): Der nächste Schritt startet sofort und nicht erst, wenn dieser zu Ende ist. Für einen sehr langen Alarmton oder ein träges Gerät, damit die folgenden Schritte nicht aufgehalten werden. Deaktivieren stoppt auch Schritte, die nebenher laufen. Ein fehlerhafter Schritt hält die anderen nie auf, mit oder ohne die Option (wie bisher). Schritte, die nebenher laufen, werden nach einem Neustart von Home Assistant mitten im Alarm nicht fortgesetzt; die Schritte danach schon.

### Behoben

- **Leiste mit Speichern unten:** Bei Seiten mit wenig Inhalt (zum Beispiel ein Alarm ohne Schritte) sitzt die Leiste mit "Abbrechen" und "Speichern" jetzt am unteren Fensterrand statt mitten im Bild; der Abstand darüber bleibt.


## [0.16.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Hinzugefügt

- **Knöpfe der Alarmmeldung mit eigenen Schaltern** (Konfiguration › Benachrichtigungen, Kapitel "Knöpfe in der Meldung"): "Öffnen" (standardmässig an), "Deaktivieren" (standardmässig aus, wie bisher) und neu "Sirene stumm" (standardmässig aus). "Sirene stumm" stoppt alle Schritte der Alarmaktionen und stellt die Geräte zurück; die Alarmanlage bleibt im Alarm, bis jemand deaktiviert. Es wirkt nur bei einem echten Alarm mit laufenden Aktionen, die letzten Ereignisse und die Zeitachse des Alarms zeigen es.

### Behoben

- **Eigene Aktion im Aktionen-Editor** zeigte die technischen Namen von Home Assistant (`cover.set_cover_position`, Feld `speed`). Arten, Aktionen, Beschreibungen, Feldnamen und Auswahlwerte erscheinen jetzt in deiner Sprache, geholt bei Home Assistant wie in dessen eigener Oberfläche; wo Home Assistant keine Übersetzung hat, wird der Name lesbar gemacht ("Set cover position").
- **Abstände:** Das letzte Element einer Seite klebt nicht mehr an der Leiste mit "Abbrechen" und "Speichern"; Hinweise, Warnungen und die Zeilen mit "Testmeldung" haben mehr Platz.


## [0.15.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Geändert

- **Nicht erreichbare Sensoren an einer Stelle** (Konfiguration › Benachrichtigungen, Kapitel "Wartungsmeldungen"): Die beiden Einträge "Sensor im scharfen Zustand nicht erreichbar" und "Sensor nicht erreichbar" sind jetzt eine Karte "Sensor nicht erreichbar" mit zwei Fällen, je mit eigenem Schalter, Kritisch, Lautstärke und Testmeldung: "Während die Anlage scharf ist" (wird sofort gemeldet, geht an die Empfänger für Alarme) und "Längere Zeit ausgefallen" (nach der eingestellten Zeit, auch bei deaktivierter Anlage, geht an die Empfänger für Wartung). Einstellungen und Empfänger bleiben unverändert.
- **Bessere Erklärungen:** "Sensor meldet (kein Alarm)" sagt jetzt, dass statt eines Alarms nur diese Meldung rausgeht, höchstens eine pro Sensor und Minute, und wo die Option "Nur melden" gesetzt wird (pro Sensor).

## [0.14.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Geändert

- **Sensorliste ist eine Auswahl** (Konfiguration › Sensoren): Die Liste zeigt nicht mehr jeden Sensor, den Home Assistant kennt; so blieben Sensoren sichtbar, die mit einer Alarmanlage nichts zu tun haben. "Sensoren hinzufügen" öffnet ein Fenster mit allen Sensoren, die Alarmageddon erkennt (Suche, nach Bereich gruppiert); du wählst die, die zu dieser Alarmanlage gehören, und nimmst sie auf. Jede Alarmanlage hat ihre eigene Liste.
- **Aus der Liste entfernen:** je Sensor mit dem Papierkorb-Knopf (oder im Seitenblatt des Sensors). Zonen, Eingangsverzögerung und eigene Optionen dieses Sensors werden gelöscht; er lässt sich jederzeit wieder aufnehmen.
- **Bestehende Alarmanlagen:** Sensoren, die schon in einer Zone stehen oder eigene Optionen haben, bleiben in der Liste; alle anderen müssen einmal hinzugefügt werden. Für Alarm, Zonen und Übersicht ändert sich nichts.
- Die Liste ist Teil der Sicherung.

## [0.13.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.23.0.

### Hinzugefügt

- **Aktionen und Meldungen in der Zeitachse des Alarms:** Jeder gestartete Schritt der Alarmaktionen (Meldung, Aktion mit Geräten, Alarmton, Warten) und jede Meldung, die während des Alarms rausgeht, erscheint im Reiter Protokoll in der Reihenfolge mit den Sensoren. Schritte eines Testlaufs sind mit "Test" markiert.

## [0.12.0] - 2026-11-08

Protokoll als eigener Reiter mit grafischer Zeitachse für jeden Alarm.

Enthält die Änderungen aus 0.7.0, 0.8.0, 0.9.0, 0.10.0 und 0.11.0.

### Hinzugefügt

- **Alarm-Aufzeichnung:** Jeder Alarm wird vom ersten Auslöser (Eingangsverzögerung oder Alarm) bis zum Quittieren durch Deaktivieren aufgezeichnet. Die Aufzeichnung enthält die Zustandswechsel und jede Änderung der Sensoren der Alarmanlage (angesprochen, wieder ruhig, nicht erreichbar, auch Sensoren, die nur melden) mit der Uhrzeit. Sie läuft nach einem Neustart von Home Assistant mitten im Alarm weiter. Auch Eingangsverzögerungen, die mit dem Deaktivieren enden, werden aufgezeichnet. Höchstens 20 Alarme je Alarmanlage und 300 Einträge je Alarm; bei einem flatternden Sensor bleiben die ersten Einträge (die Ursache) und das Ende. Die Aufzeichnungen sind Laufzeitdaten und nicht Teil der Sicherung.
- **Reiter Protokoll** auf der Startseite: Jeder Alarm als Karte mit Zeitachse (eine Bahn je Sensor mit einem Balken für die Zeit, in der er angesprochen hat, Linien für Eingangsverzögerung, Alarm und quittiert, Zeitachse) und darunter die Reihenfolge mit Uhrzeit und Abstand zum Anfang. Ein laufender Alarm aktualisiert sich alle 5 Sekunden; der neueste Alarm ist offen, ältere sind zugeklappt.

### Geändert

- **Letzte Ereignisse** sind von der Übersicht in den Reiter Protokoll gewandert ("Alle Ereignisse", bis zu 100 über alle Alarmanlagen).

## [0.11.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.12.0.

### Geändert

- **Aktionen-Editor neu gebaut** (Konfiguration › Aktionen): Die Bausteine sind "Push-Meldung", "Gerät schalten", "Alarmton abspielen", "Warten", "Szene oder Skript" und "Eigene Aktion". Nirgends mehr JSON.
  - **Gerät schalten** liest bei Home Assistant, was das Gerät kann: Man wählt Geräte (Suche, Gewählte als Pille mit x) und sieht dann nur passende Aktionen (ein/aus/umschalten, Rollläden öffnen/schliessen, Schlösser ver-/entriegeln) und beim Einschalten die Einstellungen, die das Gerät wirklich unterstützt (Helligkeit, Farbtemperatur, Position des Rollladens, Ventilatorstufe, Temperatur und Modus eines Thermostats), je mit Regler oder Dropdown. Nicht eingeschaltete Einstellungen bleiben, wie sie sind.
  - **Eigene Aktion** listet jede Aktion von Home Assistant mit ihren Feldern (Text, Zahl mit Regler, Auswahl, Entitäten-Dropdown, Schalter). Pflichtfelder sind markiert und werden geprüft. Werte von Feldern, die der Editor nicht zeigen kann, bleiben erhalten.
  - **Alarmton abspielen:** Medienplayer über ein Suchfeld mit Pillen, der Ton als Dropdown, daneben Abspielen und Pause (klar als Vorschau auf diesem Handy oder Computer gekennzeichnet, nicht auf der echten Anlage), Lautstärke und Wiederholungen mit Regler und Feld.
  - Bestehende Schritte erscheinen in den neuen Bausteinen, ohne dass sich die gespeicherten Daten ändern.
- Suchfelder im Editor behalten beim Tippen den Fokus; die Liste ist nur offen, solange das Feld benutzt wird.

### Hinzugefügt

- **Testknopf je Schritt:** führt nur diesen Schritt auf den echten Geräten aus, nach einer Rückfrage. Der Test des ganzen Ablaufs bleibt wie bisher.
- **Umordnen per Ziehen:** Jeder Schritt hat einen Griff; nach oben oder unten ziehen (Finger oder Maus), die Pfeiltasten gehen auch. Das Verschieben gehört wie jede Änderung zum Entwurf.

## [0.10.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.12.0.

### Geändert

- **Einstellungen je Modus** (Konfiguration › Anlage): "Anwesend", "Abwesend", "Nacht" oder "Immer aktiv" wählen und die Werte dieses Modus einstellen: Ausgangsverzögerung, Eingangsverzögerung, Alarmdauer, Verhalten bei offenen Sensoren und das Bestätigungsfenster der Zwei-Sensor-Bestätigung. "Immer aktiv" ist der Alarm eines immer aktiven Sensors (Rauch, Wasser), während die Anlage deaktiviert ist, und hat nur die Alarmdauer. Jeder Modus behält seine eigenen Werte, auch wenn er abgeschaltet ist.
- **Bestehende Anlagen verhalten sich wie bisher:** Solange ein Modus keinen eigenen Wert hat, gilt für ihn der gemeinsame Wert früherer Versionen.
- **Der Optionsdialog von Home Assistant** setzt gemeinsame Werte: Ein dort geänderter Wert gilt danach für alle Modi; unveränderte Werte lassen die Werte je Modus in Ruhe.
- Die Sicherung enthält die Werte je Modus.

## [0.9.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.12.0.


Meldungen neu aufgebaut: jede Meldungsart hat eigene Einstellungen, und ein Sensor kann melden statt auszulösen.

Enthält die Änderungen aus 0.7.0 und 0.8.0.

### Hinzugefügt

- **Einstellungen je Meldungsart** (Konfiguration › Meldungen): Jede Art (Alarm, Sensor meldet, Sensor im scharfen Zustand nicht erreichbar, Eingangsverzögerung, Scharfschalten nicht möglich, scharf, deaktiviert, Batterie schwach, Sensor nicht erreichbar, Update verfügbar) lässt sich ein- und ausschalten, kritisch oder nicht einstellen und hat ihre eigene Lautstärke (iOS). Jede Art hat einen eigenen Knopf "Testmeldung senden", der mit ihren gespeicherten Einstellungen hinausgeht: So hörst du, wie sie klingt.
- **Empfänger als Dropdown:** Einen Benachrichtigungsdienst im Dropdown wählen; gewählte erscheinen als Pille mit x. Getrennt für Alarme und Wartung. Eine Warnung erscheint, wenn eine Gruppe keinen Empfänger hat.
- **Nur melden** (neue Option pro Sensor): Spricht dieser Sensor im scharfen Zustand an, kommt eine Meldung (Art "Sensor meldet (kein Alarm)", standardmässig kritisch) statt eines Alarms. Für Sensoren, die oft ohne Einbruch ansprechen (Haustier, Sonnenlicht) oder deren Batterie zur Neige geht. Höchstens eine Meldung pro Sensor und Minute; die letzten Ereignisse zeigen sie. Nie voreingestellt; geht auf Wunsch auch bei "immer aktiven" Sensoren.

### Geändert

- **Meldungen in Kapiteln:** Empfänger, Alarmmeldungen, Wartungsmeldungen, Knöpfe in der Meldung.
- **Alte Einstellungen werden übernommen:** das einzelne "kritisch" und die "Lautstärke" früherer Versionen werden zu den Einstellungen von Alarm und "Sensor im scharfen Zustand nicht erreichbar"; ausgeschaltete Arten bleiben aus. Sicherungen früherer Versionen werden ebenso gelesen.
- Wartungsmeldungen und die Update-Meldung sind nur kritisch, wenn du das für ihre Art einschaltest (Standard: nein).

## [0.8.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.12.0.


Neues Aussehen der Einstellungen wie in Device Panel, und beim Reiterwechsel geht nichts verloren.

Enthält die Änderungen aus 0.7.0.

### Geändert

- **Einstellungen in Kapiteln:** jedes Kapitel hat einen Titel mit Strich davor (Konfiguration › Anlage: Modi, Zeiten, Verhalten, Zeitplan, Codes pro Person, Sicherung; Updates: Version, Einstellungen).
- **Reiter gleiten:** Beim Wechsel zwischen den Reitern der Konfiguration gleitet die Seite von der Seite herein.
- **Beim Reiterwechsel geht nichts verloren:** Jeder Reiter behält seine ungespeicherten Änderungen, auch wenn du zur Übersicht und zurück gehst. Ein gelber Punkt am Reiter zeigt, wo noch etwas offen ist; "Abbrechen" und "Speichern" bleiben in jedem Reiter. Eine Rückfrage kommt nur dort, wo ein Entwurf wirklich ersetzt würde (andere Alarmanlage) und beim Neuladen oder Schliessen der Seite.

## [0.7.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.12.0.


Updates aus dem Panel, wie in Device Panel.

### Hinzugefügt

- **Konfiguration › Updates:** zeigt die installierte und die neueste Version (GitHub und HACS), die Release Notes aller Versionen dazwischen (in deiner Sprache, aus dem CHANGELOG) und "Aktualisieren", das die neue Version über HACS installiert. Home Assistant startet nie von selbst neu: "Jetzt neu starten" erscheint, sobald die neue Version auf der Platte liegt, mit Rückfrage. Ein Punkt am Reiter zeigt, dass etwas wartet.
- **Tägliche Prüfung:** fragt einmal am Tag bei GitHub nach (die erste Prüfung zu einer zufälligen Zeit nach dem Start) und meldet eine neue Version unter Reparaturen. Lässt sich ausschalten.
- **Meldung "Update verfügbar"** an die Wartungs-Empfänger, einmal pro Version, unter Benachrichtigungen ein- und ausschaltbar.
- **Updates automatisch installieren:** standardmässig aus. Lädt die neue Version nach der täglichen Prüfung über HACS herunter; der Neustart bleibt bei dir. Benutzt wird nur die HACS-Entität dieses Repositorys.
- **Vorabversionen:** auf Wunsch angeboten (Standard: ja, solange eine Vorabversion installiert ist). HACS installiert sie nur mit seinem eigenen Schalter "Pre-release"; das Panel erklärt das und verlinkt auf das HACS-Gerät.
- Die Einstellungen der Updates gehören zur Sicherung.

## [0.6.0] - 2026-11-08

Zeitplan zum Scharfschalten und Deaktivieren, und die Modi einer Alarmanlage werden jetzt im Panel gewählt.

Enthält die Änderungen aus 0.3.0, 0.4.0 und 0.5.0.

### Hinzugefügt

- **Zeitplan:** pro Alarmanlage beliebig viele Zeiten unter Konfiguration › Anlage: "Anwesend", "Abwesend" oder "Nacht" scharf schalten oder deaktivieren, zu einer festen Uhrzeit an gewählten Wochentagen, jede Zeit einzeln ein- und ausschaltbar. Ein laufender Alarm oder eine Eingangsverzögerung wird per Zeitplan nie deaktiviert oder überschrieben (steht in den letzten Ereignissen). Offene Sensoren verhindern das Scharfschalten wie gewohnt, die Meldung "Scharfschalten nicht möglich" folgt. Ein Code ist nicht nötig. "Geändert von" zeigt "Zeitplan". Zeiten, die verstreichen, während Home Assistant aus ist, werden nicht nachgeholt.

### Geändert

- **Modi frei wählbar:** "Anwesend", "Abwesend" und "Nacht" lassen sich pro Alarmanlage unter Konfiguration › Anlage einzeln ein- und ausschalten (vorher nur "Nacht", und nur beim Einrichten oder in den Optionen). Mindestens ein Modus; Apple Home und die Übersicht bieten nur die eingeschalteten an. Ein abgeschalteter Modus behält Zone und Aktionen. Den Modus, in dem die Anlage gerade scharf ist, kann man nicht abschalten.

## [0.5.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.6.0.

Wartungsmeldungen und Batterieprognose, Zwei-Sensor-Bestätigung gegen Fehlalarm, Codes pro Person und eine Sicherung aller Einstellungen.


### Hinzugefügt

- **Wartungsmeldungen:** schwache Batterien und dauerhaft nicht erreichbare Sensoren gehen an die Wartungs-Empfänger, für alle Alarmanlagen. Jedes Problem wird einmal gemeldet, mehrere gesammelt in einer Meldung; erneut erst, wenn die Batterie gewechselt wurde oder der Sensor wieder antwortet. Schwelle (Standard 20 %) und Zeit bis "nicht erreichbar" (Standard 60 Minuten) unter Konfiguration › Benachrichtigungen. Geprüft wird alle 15 Minuten.
- **Batterieprognose:** Die Sensorliste zeigt, wann eine Batterie schwach wird, berechnet aus dem Verlauf seit dem letzten Batteriewechsel (Recorder, letzte 90 Tage). Ohne genug Verlauf erscheint keine Prognose.
- **Zwei-Sensor-Bestätigung:** neue Option pro Sensor "Braucht einen zweiten Sensor". Im scharfen Zustand löst ein solcher Sensor nur aus, wenn ein weiterer Sensor mit dieser Option innerhalb des Bestätigungsfensters anspricht (Standard 60 Sekunden, Konfiguration › Anlage). Gegen Fehlalarm durch Haustiere oder Sonnenlicht. Standardmässig aus; Sensoren ohne diese Option lösen weiterhin allein aus, und während der Eingangsverzögerung gilt sie nicht. Eine nicht bestätigte Auslösung steht in den letzten Ereignissen.
- **Codes pro Person:** beliebig viele persönliche Codes pro Alarmanlage unter Konfiguration › Anlage, auf Wunsch mit einem Benutzer von Home Assistant verknüpft. "Geändert von", die letzten Ereignisse und die Meldungen zeigen die Person. Zwei Personen können nicht denselben Code haben. Codes werden nur als Hash gespeichert und nie angezeigt; der Hauptcode aus den Optionen gilt weiter.
- **Sicherung:** alle Einstellungen als Datei exportieren (Zonen, Verzögerungen, Optionen pro Sensor, Aktionen, Voreinstellungen, Benachrichtigungen) und wiederherstellen, mit Vorschau, welche Alarmanlagen gefunden werden (Zuordnung über den Namen). Codes sind nie Teil einer Sicherung.

### Geändert

- **Schwelle "Batterie schwach"** kommt aus den Benachrichtigungen und gilt gleich für Liste, Statuskachel und Wartungsmeldung.

### Behoben

- **Letzte Ereignisse:** "Scharfschalten nicht möglich" erschien als "deaktiviert".
- **Handy:** Die Auswahl "Offener Sensor beim Scharfschalten" wurde abgeschnitten.

## [0.4.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.6.0.

Alarmaktionen als grafischer Ablauf pro Alarm, eigene Alarmtöne für Medienplayer und Benachrichtigungen mit kritischen Push-Meldungen.


### Hinzugefügt

- **Konfiguration › Aktionen:** ein Ablauf pro Alarmanlage und Alarm ("Anwesend", "Abwesend", "Nacht" und "immer aktiv" für Rauch, Wasser, Gas). Bausteine: Push-Meldung, Einschalten, Ausschalten, Rollläden öffnen und schliessen, Alarmton auf Medienplayern, Warten, Skript und jede Aktion von Home Assistant mit eigenen Daten. Schritte lassen sich an jeder Stelle einfügen, bearbeiten, verschieben und löschen; Änderungen sind ein Entwurf mit "Abbrechen" und "Speichern". Ein Ablauf mit eigenem Push-Schritt ersetzt die automatische Alarmmeldung, sie kommt nicht doppelt.
- **Alarmtöne:** fünf eigene Töne (Sirene, Alarm-Piepen, Hupe, Warnung, Gong) für Medienplayer wie Sonos, mit Vorhören im Panel, Lautstärke und Wiederholungen. Die Töne liefert Home Assistant selbst aus; der Medienplayer muss die lokale Adresse von Home Assistant erreichen.
- **Zurück in den Zustand davor:** Vor dem ersten Schritt merkt sich Alarmageddon den Zustand aller Geräte im Ablauf (ein/aus, Helligkeit, Position, Lautstärke, Quelle; bei Sonos zusätzlich den Sonos-Schnappschuss mit Gruppen). Deaktivieren oder das Ende der Alarmdauer stoppt alle Schritte und stellt markierte Geräte zurück. Bei Alarmtönen ist das standardmässig an. Das gilt auch nach einem Neustart von Home Assistant mitten im Alarm.
- **Test:** führt den Ablauf ohne Alarm aus und endet spätestens nach 60 Sekunden von selbst oder mit "Test stoppen". Ein echter Alarm lässt sich nicht im Ablauf stoppen, nur durch Deaktivieren.
- **Konfiguration › Benachrichtigungen (für alle Alarmanlagen):** Empfänger getrennt für Alarme und Wartungsmeldungen (jeder `notify`-Dienst, zum Beispiel die Companion App), kritische Alarmmeldung mit Lautstärke (iOS: kritisch, Android: Alarmkanal), Ereignisse (Alarm, Eingangsverzögerung, scharf, deaktiviert, Scharfschalten nicht möglich, Sensor im scharfen Zustand nicht erreichbar) und Testmeldungen.
- **Alarmmeldung:** mit Uhrzeit und auslösendem Sensor, Knopf "Öffnen"; "Alarm beendet" ersetzt nach dem Deaktivieren die Alarmmeldung auf dem Handy. Ein Sensor, der im scharfen Zustand nicht mehr erreichbar ist, wird kritisch gemeldet.
- **Knopf "Deaktivieren" in der Alarmmeldung:** standardmässig aus. iOS fragt nach Face ID oder dem Code des Geräts, Android nicht; das Panel weist darauf hin.

## [0.3.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.6.0.

Neue Startseite mit einer Liste der Sensoren wie in Device Panel, ein Bereich Konfiguration mit Optionen pro Sensor und "Bereit zum Scharfschalten".

### Hinzugefügt

- **Optionen pro Sensor:** "Immer aktiv" (Rauch, Wasser, Gas lösen auch unscharf aus), "Darf beim Scharfschalten offen sein" (zum Beispiel ein Bewegungsmelder auf dem Weg zur Tür), "Scharf, sobald geschlossen" (das Schliessen der Haustür beendet die Ausgangsverzögerung nach wenigen Sekunden), "Ausfall gilt als Alarm" (nicht erreichbar im scharfen Zustand löst aus). Ohne eigenen Wert gilt die Voreinstellung der Sensorart.
- **Voreinstellungen je Sensorart:** Tür, Fenster, Bewegung, Rauch/Wasser/Gas, Glasbruch/Erschütterung/Sabotage und weitere, für alle Anlagen. Vorschlag: Türen "Scharf, sobald geschlossen", Bewegung "Darf beim Scharfschalten offen sein", Rauch/Wasser/Gas "Immer aktiv", Glasbruch/Erschütterung/Sabotage "Ausfall gilt als Alarm".
- **Bereit zum Scharfschalten:** eine Entität pro Modus (zum Beispiel "Bereit für Abwesend") mit den verhindernden Sensoren als Attribut; die Übersicht zeigt "Bereit für" je Modus.
- **Startseite:** oben die Steuerung aller Anlagen und eine Kachel mit dem Status ("Alles in Ordnung" oder Warnungen wie schwache Batterie und nicht erreichbare Sensoren; ein Tipp filtert die Liste). Darunter eine Liste aller zugeordneten Sensoren mit Suche, Filtern (Probleme, offen, Batterie schwach, nicht erreichbar, Anlage, Bereich) und Ansichtseinstellung (Spalten, Gruppierung, Sortierung, pro Browser gemerkt). Spalten: Bereich, Zonen, Zustand, Batterie, Empfang (dBm oder LQI), Firmware, Hersteller/Modell, Integration, letzte Änderung.
- **Konfiguration › Sensoren:** das Raster der Zonen wie bisher, mit einem Seitenblatt pro Sensor (Zonen, Eingangsverzögerung, Optionen mit Herkunft "Voreinstellung" oder "Eigener Wert" und Zurücksetzen), auf dem Handy als Blatt von unten. Knopf "Voreinstellungen" für die Voreinstellungen je Sensorart.
- **Konfiguration › Anlage:** Modus "Nacht", Ausgangsverzögerung pro Modus, Eingangsverzögerung, Alarmdauer und Verhalten bei offenen Sensoren direkt im Panel.
- **Sensorausfall im scharfen Zustand** steht in den letzten Ereignissen.

### Geändert

- **Reiter des Panels:** "Übersicht" und "Konfiguration" (vorher "Übersicht" und "Sensorgruppen").

## [0.2.0] - 2026-11-08

Seitenpanel mit einer Übersicht aller Alarmanlagen und grafischen Sensorgruppen.

Enthält die Änderungen aus 0.1.0.

### Hinzugefügt

- **Seitenpanel "Alarmageddon":** wird mit der ersten Alarmanlage automatisch angelegt und mit der letzten entfernt. Nur für Administratoren. Funktioniert auf dem Desktop-Monitor und in der Companion App auf dem Handy.
- **Übersicht:** eine Karte pro Alarmanlage mit Zustand, Umschalten des Modus (Aus, Anwesend, Abwesend, Nacht), offenen Sensoren, nicht erreichbaren Sensoren und schwachen Batterien (unter 20 %). Ein Countdown zeigt die restliche Ausgangs- oder Eingangsverzögerung. Während eines Alarms steht zuoberst ein rotes Band mit "Deaktivieren". Das Panel fragt den Code nur, wenn er nötig ist (ein Standardcode in Home Assistant geht ohne Eingabe).
- **Letzte Ereignisse:** wer welche Alarmanlage scharf geschaltet oder deaktiviert hat und welcher Sensor ausgelöst hat, gespeichert pro Alarmanlage (die letzten 50).
- **Sensorgruppen:** eine Tabelle mit einer Spalte pro Zone und einem Schalter für die Eingangsverzögerung. Über mehrere Felder ziehen setzt alle auf einmal, "Alle" setzt eine ganze Spalte, mit Suche und Filtern (Türen & Fenster, Bewegung, Weitere). Sensoren nach Bereich gruppiert, mit Integration und Batterie. Auf dem Handy: eine Karte pro Sensor mit Zonen-Knöpfen. Änderungen sind ein Entwurf mit "Abbrechen" und "Speichern"; wer mit offenen Änderungen wechselt, wird gefragt.
- **Sensoren jeder Integration:** Das Panel bietet alle binären Sensoren mit passender Geräteklasse an (Tür, Fenster, Bewegung, Rauch, Wasser, Glasbruch und weitere). Die Batterie kommt vom Batteriesensor desselben Geräts.
- **Glasbruch:** binäre Sensoren mit der neuen Geräteklasse "Glasbruch" (Home Assistant 2026.10) werden ebenfalls angeboten.

## [0.1.0] - 2026-11-08

Nicht veröffentlicht; enthalten in 0.2.0.

Erste Vorabversion: der Kern der Alarmanlage mit Unterstützung für Apple HomeKit. Die grafische Einrichtung im Seitenpanel folgt in einer späteren Version.

### Hinzugefügt

- **Alarmanlage als Entität:** ein `alarm_control_panel` mit den Modi "Anwesend" und "Abwesend", optional "Nacht" (standardmässig aus), Ausgangsverzögerung pro Modus, Eingangsverzögerung für gewählte Sensoren (zum Beispiel die Haustür) und Alarmdauer (0 = bis zum Deaktivieren).
- **Mehrere Alarmanlagen:** ein Eintrag pro Alarmanlage, jede mit eigenem Gerät. Die Namen müssen eindeutig sein.
- **Apple HomeKit:** funktioniert mit der HomeKit-Bridge von Home Assistant. Apple Home bietet "Zuhause", "Abwesend", "Aus" und mit eingeschaltetem Modus "Nacht" auch "Nacht" an. Mit der echten HomeKit-Bridge getestet.
- **Zonen:** eine Entität pro Zone, "ein", sobald ein Sensor der Zone offen ist.
- **Offener Sensor beim Scharfschalten:** Scharfschalten verhindern oder die offenen Sensoren bis zum Deaktivieren umgehen.
- **Code:** optional, 4 bis 8 Ziffern, nur als Hash gespeichert, auf Wunsch auch zum Scharfschalten nötig. Nach fünf falschen Codes eine Minute gesperrt. Der Standardcode aus den Entitätseinstellungen von Home Assistant wird unterstützt.
- **Neustart:** Zustand, Verzögerungen und Alarm laufen nach einem Neustart oder beim Ändern der Optionen weiter. Eine Eingangsverzögerung, die während des Neustarts abgelaufen ist, wird zum Alarm. Ein Sensor, der aus "nicht verfügbar" als offen zurückkommt, löst nicht aus.
- **Sprachen:** Englisch und Deutsch.

[1.74.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.74.1
[1.74.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.74.0
[1.71.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.71.0
[1.70.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.70.0
[1.69.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.69.0
[1.68.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.68.0
[1.67.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.67.0
[1.66.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.66.1
[1.66.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.66.0
[1.65.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.65.0
[1.63.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.63.0
[1.62.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.62.0
[1.61.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.61.0
[1.60.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.60.0
[1.59.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.59.0
[1.57.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.57.0
[1.55.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.55.0
[1.54.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.54.0
[1.53.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.53.0
[1.52.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.52.0
[1.51.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.51.0
[1.48.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.48.1
[1.48.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.48.0
[1.46.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.46.1
[1.46.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.46.0
[1.45.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.45.0
[1.44.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.44.0
[1.43.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.5
[1.43.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.4
[1.43.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.3
[1.43.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.2
[1.43.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.1
[1.43.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.0
[1.42.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.42.0
[1.41.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.41.0
[1.40.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.40.0
[1.39.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.39.0
[1.38.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.38.0
[1.37.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.37.0
[1.36.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.36.1
[1.36.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.36.0
[1.35.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.5
[1.35.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.4
[1.35.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.3
[1.35.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.2
[1.35.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.1
[1.35.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.0
[1.34.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.4
[1.34.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.3
[1.34.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.2
[1.34.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.1
[1.34.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.0
[1.33.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.33.1
[1.33.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.33.0
[1.32.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.32.0
[1.31.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.31.0
[1.30.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.30.0
[1.29.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.29.0
[1.28.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.28.0
[1.27.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.27.0
[1.25.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.25.0
[1.23.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.23.0
[1.20.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.20.0
[1.19.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.19.0
[1.18.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.18.1
[1.18.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.18.0
[1.17.12]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.12
[1.17.11]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.11
[1.17.10]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.10
[1.17.9]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.9
[1.17.8]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.8
[1.17.7]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.7
[1.17.6]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.6
[1.17.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.5
[1.17.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.4
[1.17.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.3
[1.17.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.2
[1.17.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.1
[1.17.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.0
[1.16.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.16.0
[1.15.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.15.0
[1.14.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.14.0
[1.13.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.3
[1.13.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.2
[1.13.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.1
[1.13.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.0
[1.12.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.12.0
[1.11.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.11.0
[1.10.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.10.2
[1.10.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.10.1
[1.10.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.10.0
[1.9.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.9.0
[1.8.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.8.0
[1.7.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.7.0
[1.6.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.5
[1.6.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.4
[1.6.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.3
[1.6.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.2
[1.6.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.1
[1.6.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.0
[1.5.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.5.0
[1.3.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.3.0
[1.0.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.0.0
[0.39.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.39.0
[0.38.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.38.0
[0.35.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.35.2
[0.35.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.35.1
[0.35.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.35.0
[0.34.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.34.0
[0.33.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.33.0
[0.32.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.32.0
[0.30.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.30.0
[0.29.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.29.0
[0.27.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.27.0
[0.23.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.23.0
[0.12.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.12.0
[0.6.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.6.0
[0.2.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.2.0
