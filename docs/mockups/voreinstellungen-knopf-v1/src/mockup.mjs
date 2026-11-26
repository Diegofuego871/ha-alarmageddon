// Mockup "Knopf Voreinstellungen" (2026-11-26, Wunsch des Nutzers mit Bildschirmfoto des Knopfs: "wie dieser Button sich etwas mehr von den Pillen
// unterscheiden könnte? ohne grösser zu werden. inkl mobile"). Heute sehen der Knopf (`.ag-btn`, 38 px) und die Filter-Pillen (`.ag-chip`, 34 px)
// gleich aus: Fläche der Karten, runde Enden, feiner Rand. Jede Variante ändert nur den Knopf, Höhe bleibt 38 px, die Breite gleich (A: 4 px schmaler).
// Nimmt das echte Panel im Nachbau (tests/panel/sim, erfundene Daten) und setzt je Variante ein paar Zeilen CSS ein.
// Aufruf im Wurzelverzeichnis (Server des Nachbaus auf PANEL_PORT): node docs/mockups/voreinstellungen-knopf-v1/src/mockup.mjs
import { launch, open } from "../../../../tests/panel/lib.mjs";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const out = fileURLToPath(new URL("../", import.meta.url));
const B = '.ag-btn[data-sen="presets"]';

const VARIANTS = [
  { id: "heute", title: "Heute", note: "Knopf und Pillen gleich: Fläche der Karten, runde Enden, feiner Rand", css: "" },
  { id: "a", title: "A: Eckig mit Symbolkachel (Empfehlung)", note: "Ecken 12 px wie das Suchfeld, Symbol in der blauen Kachel wie in den Zeilen der Einstellungen",
    css: `${B} { border-radius: 12px; padding: 0 14px 0 6px; gap: 8px; }
      ${B} svg { box-sizing: content-box; padding: 4px; border-radius: 8px; background: var(--ag-primary-soft); color: var(--ag-primary); }` },
  { id: "b", title: "B: Akzent-Kontur", note: "Form bleibt, Rand, Symbol und Text in der Akzentfarbe",
    css: `${B} { border-color: color-mix(in srgb, var(--ag-primary) 55%, transparent); color: var(--ag-primary); }
      ${B}:hover { background: color-mix(in srgb, var(--ag-primary) 6%, var(--ag-card)); }` },
  { id: "c", title: "C: Eckig und erhaben", note: "Ecken 12 px, kräftigerer Rand und leichter Schatten; die Pillen bleiben flach",
    css: `${B} { border-radius: 12px; border-color: color-mix(in srgb, var(--ag-text) 18%, transparent); box-shadow: 0 1px 2px rgba(15, 23, 42, .10), 0 3px 8px rgba(15, 23, 42, .07); }` },
  { id: "d", title: "D: Grau gefüllt, eckig", note: "Ecken 12 px, grau gefüllt ohne Rand; die Pillen behalten Fläche und Rand",
    css: `${B} { border-radius: 12px; border-color: transparent; background: color-mix(in srgb, var(--ag-text) 8%, var(--ag-bg)); }
      ${B}:hover { background: color-mix(in srgb, var(--ag-text) 12%, var(--ag-bg)); }` },
];

const shots = [];
const browser = await launch();
for (const [kind, opts] of [["desktop", { size: { width: 1400, height: 900 }, context: { deviceScaleFactor: 2 } }], ["handy", { mobile: true }], ["handy-dunkel", { mobile: true, theme: "dark" }]]) {
  for (const v of VARIANTS) {
    const s = await open(browser, { lang: "de", tab: "config", prefs: { sub: "sensors" }, ...opts });
    await s.page.waitForTimeout(700);
    const size = await s.ev(`const st = document.createElement('style'); st.textContent = ${JSON.stringify(v.css)}; r.appendChild(st);
      const b = r.querySelector('${B}').getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]`);
    await s.page.waitForTimeout(250);
    // Ausschnitt: Suche, Pillen, beide Knöpfe und die Karte "Einstellungen pro Modus" darunter (gleiches Symbol "tune")
    const tools = await (await s.el(".ag-tools")).boundingBox();
    const card = await (await s.el(".ag-pmsw")).boundingBox();
    const vw = s.page.viewportSize().width;
    const clip = { x: 0, y: Math.max(0, tools.y - 14), width: vw, height: card.y + card.height + 14 - (tools.y - 14) };
    const file = `${v.id}-${kind}.png`;
    await s.page.screenshot({ path: out + file, clip });
    shots.push({ kind, v, file, size });
    console.log(file, "Knopf", size.join(" × "), "px", s.errors.length ? s.errors.join(" | ") : "");
    await s.ctx.close();
  }
}

// Übersichten: am Computer untereinander, auf dem Handy nebeneinander (hell und dunkel)
const img = (f) => `data:image/png;base64,${readFileSync(out + f).toString("base64")}`;
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })).newPage();
const css = `body { margin: 0; font: 15px/1.4 Roboto, "Segoe UI", system-ui, sans-serif; background: #e9ecf1; color: #1f2328; }
  .wrap { padding: 28px; display: flex; flex-direction: column; gap: 22px; width: max-content; } .row { display: flex; gap: 22px; align-items: stretch; }
  .item { background: #fff; border-radius: 16px; padding: 14px 16px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .item h3 { margin: 0 0 2px; font-size: 17px; font-weight: 600; } .item p { margin: 0 0 10px; color: #5b6472; font-size: 13.5px; }
  .item img { display: block; border-radius: 10px; border: 1px solid #dde2e8; } .rec { outline: 3px solid #03a9f4; }
  h2 { margin: 0; font-size: 22px; font-weight: 600; }`;
const page1 = (kind, horizontal, width) => `<style>${css}</style><div class="wrap"><h2>Knopf "Voreinstellungen": ${kind === "desktop" ? "Computer (1400 px)" : kind === "handy" ? "Handy (390 px), hell" : "Handy (390 px), dunkel"}</h2>
  <div class="${horizontal ? "row" : ""}" style="${horizontal ? "" : "display:flex;flex-direction:column;gap:22px"}">${shots.filter((x) => x.kind === kind).map((x) => `<div class="item ${x.v.id === "a" ? "rec" : ""}" style="width:${width}px"><h3>${x.v.title}</h3><p>${x.v.note}</p>
  <img src="${img(x.file)}" style="width:${width}px"></div>`).join("")}</div></div>`;
for (const [kind, horizontal, width, vw] of [["desktop", false, 1300, 1400], ["handy", true, 360, 2150], ["handy-dunkel", true, 360, 2150]]) {
  // Kleine Höhe: das Bild ist so hoch wie der Inhalt (fullPage), ohne leeren Rand
  await page.setViewportSize({ width: vw, height: 200 });
  await page.setContent(page1(kind, horizontal, width));
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + `uebersicht-${kind}.png`, fullPage: true });
}
await browser.close();
