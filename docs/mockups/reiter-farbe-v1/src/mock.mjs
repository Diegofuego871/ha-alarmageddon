// Mockups "Reiterleiste der Aktionen einfärben" (2026-11-16): Form der Leiste bleibt (Kapsel am gewählten Knopf), nur Farbe und Übergang zwischen
// den vier Alarm-Reitern und "Überwachung" sind Thema. Reine Entwürfe mit festen Werten. Aufruf: node src/mock.mjs (aus diesem Ordner).
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
const TABS = [["home", "Anwesend"], ["away", "Abwesend"], ["night", "Nacht"], ["always", "Immer aktiv"], ["eye", "Überwachung"]];
const ic = (k) => `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="${ICON[k]}"/></svg>`;
const bar = (cls, sel, extra = "") => `<div class="seg ${cls}">${extra}${TABS.map(([k, l], i) => `<button class="${i === 4 ? "mon" : "alarm"} ${i === sel ? "on" : ""} ${i === 4 ? "first-mon" : ""}">${ic(k)}<span>${l}</span></button>`).join("")}</div>`;

const CSS = `
:root { --alarm: #e5654f; --alarm-soft: #fde7e2; --mon: #1f9d8f; --mon-soft: #d9f2ee; --track: #eceff1; --card: #fff; --text: #1d2a33; --text2: #5d6b75; --line: #dfe4e8; }
* { box-sizing: border-box; } body { margin: 0; padding: 28px 32px; font: 14px/1.4 Inter, system-ui, sans-serif; background: #f4f6f8; color: var(--text); width: 1100px; }
body.phone { width: 390px; padding: 16px; }
h2 { font-size: 17px; margin: 26px 0 4px; } p { margin: 0 0 12px; color: var(--text2); font-size: 13px; } .row { margin: 10px 0 18px; } small.l { display: block; color: var(--text2); font-size: 12px; margin-bottom: 4px; }
.seg { display: inline-flex; gap: 0; padding: 4px; border-radius: 16px; background: var(--track); position: relative; max-width: 100%; }
.seg button { all: unset; display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 16px; border-radius: 12px; color: var(--text2); cursor: default; font-size: 14px; position: relative; z-index: 1; white-space: nowrap; }
body.phone .seg { flex-wrap: wrap; } body.phone .seg button { padding: 0 11px; height: 40px; gap: 5px; } body.phone .seg button span { font-size: 13px; }
.seg button.on { background: var(--card); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.18); }

/* A: zwei Tönungen auf der Spur, harte Kante mit Lücke */
.A { background: linear-gradient(90deg, var(--alarm-soft) 0 calc(100% - var(--w, 150px) - 3px), transparent 0); padding: 4px; gap: 0; }
.A .first-mon { margin-left: 6px; } .A { background: none; box-shadow: none; position: relative; }
.A::before { content: ""; position: absolute; inset: 0; border-radius: 16px; background: var(--alarm-soft); clip-path: inset(0 var(--mw, 154px) 0 0 round 16px 6px 6px 16px); }
.A::after { content: ""; position: absolute; inset: 0; border-radius: 16px; background: var(--mon-soft); clip-path: inset(0 0 0 calc(100% - var(--mw, 154px) + 3px) round 6px 16px 16px 6px); }
.A button.on.alarm { color: var(--alarm); } .A button.on.mon { color: var(--mon); }

/* B: weicher Übergang (Verlauf) von Rot- zu Türkistönung */
.B { background: linear-gradient(90deg, var(--alarm-soft) 0%, var(--alarm-soft) 52%, var(--mon-soft) 84%, var(--mon-soft) 100%); }
.B button.on.alarm { color: var(--alarm); } .B button.on.mon { color: var(--mon); }

/* C: Spur neutral; die Kapsel nimmt die Farbe der Gruppe an, dazu ein kleiner farbiger Strich unter jeder Gruppe */
.C button.on { background: var(--card); } .C button.on.alarm { box-shadow: 0 1px 4px rgba(0,0,0,.14), inset 0 -3px 0 var(--alarm); color: var(--alarm); } .C button.on.mon { box-shadow: 0 1px 4px rgba(0,0,0,.14), inset 0 -3px 0 var(--mon); color: var(--mon); }
.C button.alarm::after, .C button.mon::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 3px; height: 2px; border-radius: 2px; opacity: .55; }
.C button.alarm::after { background: var(--alarm); } .C button.mon::after { background: var(--mon); } .C button.on::after { display: none; } .C .first-mon { margin-left: 10px; }

/* D: zwei getrennte Leisten mit Abstand, jede in eigener Tönung (Form wie bisher), kleine Überschrift darüber */
.dwrap { display: inline-flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; } .dg { display: flex; flex-direction: column; gap: 4px; } .dg > small { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; font-weight: 600; margin: 0 0 0 6px; }
.dg.a > small { color: var(--alarm); } .dg.m > small { color: var(--mon); } .dg.a .seg { background: var(--alarm-soft); } .dg.m .seg { background: var(--mon-soft); }
.dg.a button.on { color: var(--alarm); } .dg.m button.on { color: var(--mon); }

/* E: eine Spur, die Kapsel selbst gefärbt (Alarm rotstichig, Überwachung türkis), Spur neutral mit feiner Trennlinie vor Überwachung */
.E button.on.alarm { background: var(--alarm); color: #fff; box-shadow: 0 2px 6px color-mix(in srgb, var(--alarm) 45%, transparent); } .E button.on.mon { background: var(--mon); color: #fff; box-shadow: 0 2px 6px color-mix(in srgb, var(--mon) 45%, transparent); }
.E .first-mon { margin-left: 13px; } .E .first-mon::before { content: ""; position: absolute; left: -8px; top: 9px; bottom: 9px; width: 1.5px; background: var(--line); border-radius: 2px; }
`;
const variants = [
  ["A", "A: zwei Tönungen, harte Kante mit kleiner Lücke", "Die Spur ist links (Alarm) leicht rot getönt und rechts (Überwachung) türkis; dazwischen ein schmaler Schlitz. Klare Grenze, kein Verlauf.", (s) => bar("A", s)],
  ["B", "B: weicher Farbverlauf über die ganze Spur", "Ein durchgehender Übergang von Rot zu Türkis, die Grenze verschwimmt. Ruhig, aber ohne klare Trennung.", (s) => bar("B", s)],
  ["C", "C: Spur neutral, Farbe nur als Strich und an der Kapsel", "Die Spur bleibt grau wie heute. Unter jedem Reiter ein feiner Strich in der Gruppenfarbe, die gewählte Kapsel trägt ihn kräftig. Am wenigsten bunt.", (s) => bar("C", s)],
  ["D", "D: zwei getrennte Leisten", "Gleiche Form, aber zwei Leisten mit Abstand und kleiner Überschrift (Alarm / Überwachung): keine Grenze mehr, sondern zwei Gruppen.", (s) => `<div class="dwrap"><div class="dg a"><small>Alarm</small><div class="seg">${TABS.slice(0, 4).map(([k, l], i) => `<button class="${i === s ? "on" : ""}">${ic(k)}<span>${l}</span></button>`).join("")}</div></div><div class="dg m"><small>Überwachung</small><div class="seg"><button class="${s === 4 ? "on" : ""}">${ic("eye")}<span>Überwachung</span></button></div></div></div>`],
  ["E", "E: gefärbte Kapsel, feine Trennlinie", "Die Spur bleibt neutral, nur die gewählte Kapsel ist farbig (Alarm rotstichig, Überwachung türkis). Vor \"Überwachung\" eine feine Trennlinie statt eines Farbübergangs.", (s) => bar("E", s)],
];
const html = (phone) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body class="${phone ? "phone" : ""}">${variants.map(([id, title, text, f]) => `<h2>${title}</h2><p>${text}</p><div class="row"><small class="l">"Abwesend" gewählt</small>${f(1)}</div><div class="row"><small class="l">"Überwachung" gewählt</small>${f(4)}</div>`).join("")}</body>`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const phone of [false, true]) {
  const page = await browser.newPage({ viewport: { width: phone ? 390 : 1100, height: 800 }, deviceScaleFactor: 2 });
  await page.setContent(html(phone));
  await page.screenshot({ path: `${out}reiterleiste-${phone ? "handy" : "desktop"}.png`, fullPage: true });
}
await browser.close();
console.log("ok");
