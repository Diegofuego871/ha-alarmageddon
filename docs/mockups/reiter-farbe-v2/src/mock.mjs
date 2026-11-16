// Mockups "Reiterleiste: nur die Icons färben" (v2, 2026-11-16). Ausgangspunkt ist die Leiste ohne Färbung (Variante 0); gefärbt werden nur Icons
// (und je Variante kleine Akzente). Alarm-Reiter weinrot, Überwachung orange. Dunkel (wie im Panel des Nutzers) und hell, Desktop und Handy
// (390 px, Reiter im Viereck: zwei Spalten). Reine Entwürfe mit festen Werten. Aufruf: node src/mock.mjs (aus diesem Ordner).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(fileURLToPath(new URL("../../../../tests/panel/", import.meta.url)));
const { chromium } = require("playwright-core");
const out = fileURLToPath(new URL("../", import.meta.url));

const ICON = {
  home: "M12,1L3,5V11C3,16.5 6.8,21.7 12,23C17.2,21.7 21,16.5 21,11V5L12,1M12,7L17,11V17H14V13H10V17H7V11L12,7Z",
  away: "M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z",
  night: "M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.2,13.5L16.75,15.3L16.6,13.2L14.6,12.4L16.6,11.8L16.75,9.7L18.2,11.5L21.25,11M12,10A9,9 0 0,0 3,19A9,9 0 0,0 12,28",
  always: "M11,15H6L13,1V9H18L11,23V15Z",
  eye: "M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C15.76,17.5 19.17,15.36 20.82,12C19.17,8.64 15.76,6.5 12,6.5C8.24,6.5 4.83,8.64 3.18,12Z",
};
const TABS = [["home", "Anwesend", "a"], ["away", "Abwesend", "a"], ["night", "Nacht", "a"], ["always", "Immer aktiv", "a"], ["eye", "Überwachung", "m"]];
const ic = (k) => `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="${ICON[k]}"/></svg>`;
const btn = ([k, l, g], i, sel) => `<button class="${g} ${i === sel ? "on" : ""}"><i>${ic(k)}</i><span>${l}</span></button>`;
const bar = (cls, sel, tabs = TABS, five = false) => `<div class="seg ${cls} ${five ? "five" : ""}">${tabs.map((t, i) => btn(t, TABS.indexOf(t), sel)).join("")}</div>`;
const two = (cls, sel) => `<div class="two ${cls}">${bar(cls, sel, TABS.slice(0, 4))}${bar(cls, sel, TABS.slice(4))}</div>`;

const CSS = `
:root { --wine: #b5475f; --wine-s: #c9586f; --amber: #e9962f; --bg: #f4f6f8; --card: #fff; --track: #eceff1; --text: #1d2a33; --text2: #5d6b75; --line: #dfe4e8; --cap: #fff; --capline: rgba(0,0,0,.08); --blue: #1c7fb5; }
body.dark { --wine: #cf6a82; --wine-s: #cf6a82; --amber: #f2a33a; --bg: #121212; --card: #1c1c1c; --track: #2a2a2a; --text: #e6e6e6; --text2: #a9a9a9; --line: #3a3a3a; --cap: #101010; --capline: #333; --blue: #44a2d8; }
* { box-sizing: border-box; } body { margin: 0; padding: 26px 30px; font: 14px/1.4 Inter, system-ui, sans-serif; background: var(--bg); color: var(--text); width: 1100px; }
body.phone { width: 390px; padding: 14px; }
h2 { font-size: 16px; margin: 24px 0 3px; } p { margin: 0 0 10px; color: var(--text2); font-size: 13px; }
.row { margin: 8px 0 14px; padding: 14px; background: var(--card); border-radius: 16px; display: flex; flex-direction: column; gap: 12px; } small.l { display: block; color: var(--text2); font-size: 11px; margin-bottom: 4px; }
.seg { display: inline-flex; padding: 4px; border-radius: 16px; background: var(--track); max-width: 100%; position: relative; }
.seg button { all: unset; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 12px; color: var(--text2); font-size: 14px; position: relative; white-space: nowrap; box-sizing: border-box; }
.seg button i { display: inline-flex; } .seg button.on { background: var(--cap); color: var(--text); box-shadow: 0 0 0 1px var(--capline), 0 1px 4px rgba(0,0,0,.22); }
body.phone .seg { display: grid; grid-template-columns: 1fr 1fr; width: 100%; gap: 2px; } body.phone .seg button { padding: 0 8px; height: 44px; }
body.phone .seg.five button:last-child { grid-column: 1 / -1; }
/* 0 Referenz: nichts gefärbt; die gewählte Kapsel trägt wie heute den Akzent */
.R button.on { color: var(--blue); }
/* A nur Icons: Alarm weinrot, Überwachung orange */
.A button.a i { color: var(--wine); } .A button.m i { color: var(--amber); } .A button.on { color: var(--text); }
/* B Icons in kleinen Plaketten (runde, getönte Fläche), gewählt: Plakette gefüllt */
.B button i { width: 28px; height: 28px; border-radius: 50%; align-items: center; justify-content: center; } .B button.a i { color: var(--wine); background: color-mix(in srgb, var(--wine) 18%, transparent); }
.B button.m i { color: var(--amber); background: color-mix(in srgb, var(--amber) 20%, transparent); } .B button.a.on i { background: var(--wine); color: #fff; } .B button.m.on i { background: var(--amber); color: #1a1208; } .B button { padding-left: 8px; }
/* C Icons gefärbt plus feiner Strich am unteren Rand jedes Reiters in der Gruppenfarbe (im Viereck am Zellrand) */
.C button.a i { color: var(--wine); } .C button.m i { color: var(--amber); } .C button::after { content: ""; position: absolute; left: 14px; right: 14px; bottom: 3px; height: 2px; border-radius: 2px; } .C button.a::after { background: color-mix(in srgb, var(--wine) 55%, transparent); } .C button.m::after { background: color-mix(in srgb, var(--amber) 70%, transparent); } .C button.on::after { left: 22px; right: 22px; height: 3px; bottom: 4px; }
/* D zwei getrennte Leisten: Alarm-Reiter oben, Überwachung eigene Leiste mit Abstand; Icons gefärbt */
.two { display: inline-flex; gap: 12px; flex-wrap: wrap; } body.phone .two .seg:last-child button { width: 100%; } body.phone .two { display: flex; flex-direction: column; gap: 8px; width: 100%; } .D button.a i { color: var(--wine); } .D button.m i { color: var(--amber); } .D button.on { color: var(--text); }
.two.D .seg:last-child { background: color-mix(in srgb, var(--amber) 11%, var(--track)); } .two.D .seg:first-child { background: color-mix(in srgb, var(--wine) 8%, var(--track)); }
/* E gewählte Kapsel bekommt einen feinen Rand in Gruppenfarbe, Icon dort kräftig, in den übrigen Reitern gedämpft */
.E button.a i { color: var(--wine); opacity: .62; } .E button.m i { color: var(--amber); opacity: .7; } .E button.on { color: var(--text); } .E button.a.on { box-shadow: 0 0 0 1.5px var(--wine), 0 1px 4px rgba(0,0,0,.22); } .E button.m.on { box-shadow: 0 0 0 1.5px var(--amber), 0 1px 4px rgba(0,0,0,.22); } .E button.on i { opacity: 1; }
`;
const R = (s, t = TABS.slice(0, 4)) => bar("R", s, t);
const variants = [
  ["0", "0: Ausgangslage, ohne Färbung", "So ist es ohne Färbung (der gewählte Reiter trägt den blauen Akzent). Referenz für alle Vorschläge.", (s, five) => bar("R", s, five ? TABS : TABS.slice(0, 4), five)],
  ["A", "A: nur die Icons gefärbt", "Alarm-Reiter mit weinrotem Icon, \"Überwachung\" mit orangem Icon; Spur, Kapsel und Text bleiben neutral. Das ruhigste.", (s, five) => bar("A", s, five ? TABS : TABS.slice(0, 4), five)],
  ["B", "B: Icons in runden Plaketten", "Das Icon sitzt in einem kleinen, getönten Kreis (weinrot beziehungsweise orange); beim gewählten Reiter ist der Kreis gefüllt. Deutlicher, Gruppe auf einen Blick.", (s, five) => bar("B", s, five ? TABS : TABS.slice(0, 4), five)],
  ["C", "C: Icons gefärbt, Strich unten an jedem Reiter", "Zusätzlich zum Icon ein feiner Strich in der Gruppenfarbe am unteren Rand jedes Reiters; beim gewählten Reiter kräftiger. Auf dem Handy bleibt die Gruppe auch im Viereck erkennbar.", (s, five) => bar("C", s, five ? TABS : TABS.slice(0, 4), five)],
  ["D", "D: zwei Leisten, Icons gefärbt", "Alarm-Reiter und \"Überwachung\" in getrennten Leisten (Überwachung rechts beziehungsweise auf dem Handy darunter, volle Breite); jede Spur nur ganz leicht getönt. Klarste Trennung, braucht mehr Platz.", (s, five) => two("D", s)],
  ["E", "E: Icons gedämpft, gewählter Reiter mit Rand in Gruppenfarbe", "Nicht gewählte Reiter: Icon in der Gruppenfarbe, etwas gedämpft. Der gewählte Reiter bekommt einen feinen Rand und ein volles Icon in der Gruppenfarbe. Die Farbe sagt \"was ist gewählt\".", (s, five) => bar("E", s, five ? TABS : TABS.slice(0, 4), five)],
];
const html = (phone, dark) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body class="${phone ? "phone" : ""} ${dark ? "dark" : ""}">${variants.map(([id, title, text, f]) => {
  const rows = phone ? `<div><small class="l">Abwesend gewählt (vier Reiter)</small>${f(1, false)}</div><div><small class="l">Überwachung gewählt (mit "Nacht", fünf Reiter)</small>${f(4, true)}</div>`
    : `<div><small class="l">Abwesend gewählt</small>${f(1, true)}</div><div><small class="l">Überwachung gewählt</small>${f(4, true)}</div>`;
  return `<h2>${title}</h2><p>${text}</p><div class="row">${rows}</div>`;
}).join("")}</body>`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const phone of [false, true]) for (const dark of [true, false]) {
  const page = await browser.newPage({ viewport: { width: phone ? 390 : 1100, height: 800 }, deviceScaleFactor: 2 });
  await page.setContent(html(phone, dark));
  await page.screenshot({ path: `${out}reiter-${phone ? "handy" : "desktop"}-${dark ? "dunkel" : "hell"}.png`, fullPage: true });
}
await browser.close();
console.log("ok");
