# Mockup "Knopf Voreinstellungen" (v1, 2026-11-26)

Wunsch des Nutzers (Bildschirmfoto des Knopfs "Voreinstellungen" unter Konfiguration › Sensoren, 08:15): "kannst du mal mockups erstellen wie dieser
butten sich etwas mehr von den pillen unterscheiden könnte? ohne grösser zu werden. inkl mobile".

Gebaut aus dem echten Panel im Nachbau (`src/mockup.mjs`, erfundene Daten); je Variante ändern nur ein paar Zeilen CSS den Knopf. Ausschnitt: Suche,
Pillen, beide Knöpfe und die Karte "Einstellungen pro Modus" darunter. Computer (1400 px) hell, Handy (390 px) hell und dunkel. Übersichten:
`uebersicht-desktop.png`, `uebersicht-handy.png`, `uebersicht-handy-dunkel.png`; Einzelbilder `<variante>-desktop.png`, `-handy.png`,
`-handy-dunkel.png`.

## Heute

Knopf (`.ag-btn`, 38 px hoch) und Filter-Pillen (`.ag-chip`, 34 px) sehen gleich aus: Fläche der Karten, runde Enden, feiner grauer Rand. Auf dem
Handy steht "Voreinstellungen" in einer eigenen Zeile direkt unter den Pillen und wirkt wie eine weitere Pille.

## Varianten (alle 38 px hoch, gleich breit oder schmaler)

- **A: Eckig mit Symbolkachel (Empfehlung).** Ecken 12 px wie das Suchfeld, das Symbol steht in einer kleinen blauen Kachel (26 px) wie in den Zeilen
  der Einstellungen (`.ag-oav`). Zwei Unterschiede zugleich: die Form (Pillen rund, Knopf eckig) und die Kachel. Die Kachel sagt "hier sind
  Einstellungen", passend zur Karte "Einstellungen pro Modus" darunter mit demselben Symbol. 4 px schmaler als heute. Wirkt hell und dunkel.
- **B: Akzent-Kontur.** Form bleibt rund, Rand, Symbol und Text in der Akzentfarbe. Hebt sich ab, ist aber blau wie die gewählte Pille "Alle" und
  kann so selbst wie ein gewählter Filter wirken.
- **C: Eckig und erhaben.** Ecken 12 px, kräftigerer Rand und leichter Schatten; die Pillen bleiben flach. Ruhig; im dunklen Modus ist der Schatten
  kaum zu sehen, dort bleibt nur die Form.
- **D: Grau gefüllt, eckig.** Ecken 12 px, graue Fläche ohne Rand. Deutlich anders als die Pillen, wirkt aber auch etwas wie ein gesperrter Knopf.

## Was das für die Umsetzung heisst

- Nur der Knopf `[data-sen="presets"]` ändert sich (eine Klasse, zum Beispiel `.ag-btn.ag-toolbtn`, in `styles.js`), keine Logik. Der Knopf
  "Sensoren hinzufügen" bleibt blau gefüllt (er unterscheidet sich schon).
- Dasselbe Problem hat der Knopf **"Ansicht"** in der Übersicht (neben Pillen und Auswahlfeldern). Mit der gewählten Variante sollte er dieselbe
  Klasse bekommen, damit Knöpfe neben Pillen überall gleich aussehen. Andere `.ag-btn` (Fenster, Fusszeile, "Code hinzufügen") bleiben, wie sie sind.
- Prüfung in einer Suite: Knopf und Pillen unterscheiden sich in Form (Ecken) und Höhe bleibt 38 px, auf Computer und Handy.
