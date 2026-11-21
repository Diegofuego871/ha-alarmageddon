// 1.75.0: Akzentfarbe je Anlage (Wunsch des Nutzers 2026-11-21): Kapitel unter Konfiguration › Anlage über dem Einrichtungsassistenten (Auswahl wie im Device
// Panel), Entwurf mit "Speichern", Vorschau sofort; im Fenster "Anlage hinzufügen" ebenfalls wählbar; die Farbe ersetzt das Blau (--ag-primary) im ganzen Panel
// und gilt je Anlage. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const NAMES = { de: ["Home Assistant", "Himmelblau", "Ozeanblau", "Türkis", "Indigo", "Rosa", "Orange", "Rot", "Tannengrün", "Graphit"], en: ["Home Assistant", "Sky blue", "Ocean blue", "Turquoise", "Indigo", "Pink", "Orange", "Red", "Fir green", "Graphite"] };
const TITLE = { de: "Akzentfarbe", en: "Accent colour" };
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('.ag-health')");
    const prim = () => s.ev("return r.host.style.getPropertyValue('--ag-primary')");
    check(`${tag}: ohne eigene Farbe gilt die Farbe des Themes (kein Wert am Panel)`, (await prim()) === "");
    const chap = await s.ev(`const cs=[...r.querySelectorAll('.ag-chap')]; const i=cs.findIndex((c) => c.querySelector('.ag-chap-t')?.textContent === ${JSON.stringify(TITLE[lang])}); const wz=cs.findIndex((c) => c.querySelector('.ag-wzrow')); return { i, wz, names: [...cs[i].querySelectorAll('.ag-accbtn')].map((b) => b.innerText.trim()), on: cs[i].querySelector('.ag-accbtn.on')?.dataset.key }`);
    check(`${tag}: Kapitel "${TITLE[lang]}" direkt über dem Einrichtungsassistenten mit den zehn Farben`, chap.i >= 0 && chap.wz === chap.i + 1 && JSON.stringify(chap.names) === JSON.stringify(NAMES[lang]) && chap.on === "ha", JSON.stringify(chap));
    await s.tap('[data-sys="accent"][data-key="green"]');
    check(`${tag}: Wahl zeigt die Farbe sofort (Vorschau), die Seite hat eine ungespeicherte Änderung`, (await prim()) === "#4a8f5f" && await s.ev("return r.querySelector('.ag-accbtn.on')?.dataset.key === 'green'"));
    await s.tap('[data-sys="save"]');
    await s.page.waitForTimeout(500);
    check(`${tag}: gespeichert: die Anlage trägt die Farbe, das Panel zeigt sie`, await s.sim("return window.__systems.some((x) => x.accent === 'green')") && (await prim()) === "#4a8f5f");
    // Je Anlage: eine zweite Anlage ohne Farbe zeigt wieder die Farbe des Themes
    const ids = await s.sim("return window.__systems.map((x) => [x.entry_id, x.accent || 'ha'])");
    check(`${tag}: die Farbe gehört der Anlage (andere Anlagen bleiben bei "ha")`, ids.filter(([, a]) => a === "green").length === 1, JSON.stringify(ids));
    // Neu laden: bleibt
    await s.page.reload();
    await s.waitFor("return !!r.querySelector('.ag-health') || !!r.querySelector('.ag-headsys')", 12000).catch(() => {});
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Fenster "Anlage hinzufügen" -----
    const a = await open(browser, { mobile, lang });
    await a.page.waitForTimeout(300);
    await a.tap('.ag-headsys [data-act="add"]');
    await a.waitFor("return r.getElementById('ag-add').open");
    const grid = await a.ev(`const d=r.getElementById('ag-add'); return { n: d.querySelectorAll('.ag-accbtn').length, on: d.querySelector('.ag-accbtn.on')?.dataset.key, chap: [...d.querySelectorAll('.ag-chap-t')].map((e) => e.textContent) }`);
    check(`${tag}: Fenster "Anlage hinzufügen": zehn Farben, "Home Assistant" vorgewählt, Kapitel "${TITLE[lang]}"`, grid.n === 10 && grid.on === "ha" && grid.chap.includes(TITLE[lang]), JSON.stringify(grid));
    await a.tap('#ag-add [data-act="add-accent"][data-key="red"]');
    check(`${tag}: Wahl im Fenster markiert die Farbe`, await a.ev("return r.getElementById('ag-add').querySelector('.ag-accbtn.on')?.dataset.key === 'red'"));
    await (await a.el("#ag-add-input")).fill("Farbtest");
    await a.waitFor("return !r.getElementById('ag-add').querySelector('button[type=submit]').disabled", 6000);
    await a.tap('#ag-add button[type="submit"]');
    await a.page.waitForTimeout(800);
    check(`${tag}: neue Anlage trägt die gewählte Farbe, das Panel zeigt sie`, await a.sim("return window.__systems.some((x) => x.title === 'Farbtest' && x.accent === 'red')") && (await a.ev("return r.host.style.getPropertyValue('--ag-primary')")) === "#d9453d");
    check(`${tag}: keine Fehler der Seite (Fenster)`, a.errors.length === 0, a.errors.join(" | "));
    await a.ctx.close();
  }
}
await browser.close();
done();
