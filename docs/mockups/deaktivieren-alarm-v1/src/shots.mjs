// Mockup "Deaktivieren im Alarm" (v1, 2026-11-22, Wunsch des Nutzers): Einstellung unter Konfiguration › Anlage › Zeiten und Verhalten.
// Öffnet das echte Panel im HA-Nachbau und fügt eine Zeile in die Karte "Verhalten" ein. Kein Test. Erfundene Daten.
// Aufruf im Wurzelverzeichnis: node docs/mockups/deaktivieren-alarm-v1/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8973";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
const { ic } = await import("../../../../custom_components/alarmageddon/panel/common.js");
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();

const OPTS = [
  { icon: "shieldOff", title: "Deaktivieren beendet den Alarm",
    text: "Wie in Home Assistant und Apple Home: Deaktivieren im Alarm stoppt den Alarm und schaltet die Anlage ab. Die Aktionen \"Nach dem Quittieren\" und \"Beim Deaktivieren\" laufen." },
  { icon: "shieldAway", title: "Deaktivieren quittiert nur",
    text: "Der Alarm endet, die Anlage bleibt im selben Modus scharf. Es laufen die Aktionen \"Nach dem Quittieren\", \"Beim Deaktivieren\" erst beim zweiten Deaktivieren. Apple Home zeigt danach weiter \"Scharf\"." },
];

// ---------- Variante A: vertikaler Schieber (Reiterleiste mit Kapsel, senkrecht) ----------
const sliderRow = (sel) => `<div class="ag-setrow mk-vrow"><div class="ag-settx"><b>Deaktivieren im Alarm</b>
  <small>Was passiert, wenn die Anlage während eines Alarms deaktiviert wird (Bedienteil, Home Assistant, Apple Home oder Dashboard).</small>
  <div class="ag-seg mk-vseg" data-sel="${sel}">${OPTS.map((o, i) => `<button type="button" class="${i === sel ? "on" : ""}" aria-label="${o.title}" style="grid-row:${i + 1}">${ic(o.icon, 20)}</button>
    <div class="mk-vopt ${i === sel ? "on" : ""}" style="grid-row:${i + 1}"><b>${o.title}${i === 0 ? ' <em>Standard</em>' : ""}</b><small>${o.text}</small></div>`).join("")}<span class="ag-pill"></span></div></div></div>`;

// ---------- Variante B zum Vergleich: gewöhnlicher Schalter ----------
const switchRow = () => `<div class="ag-setrow"><button class="ag-toggle on" role="switch" aria-checked="true"></button><div class="ag-settx"><b>Deaktivieren beendet den Alarm</b>
  <small>An: Deaktivieren im Alarm stoppt den Alarm und schaltet die Anlage ab. Aus: der Alarm endet nur, die Anlage bleibt scharf.</small></div></div>`;

const CSS = `
.mk-vrow { display: block; }
.mk-vseg { display: grid; grid-template-columns: 46px 1fr; grid-auto-rows: auto; column-gap: 16px; row-gap: 2px; margin-top: 14px; padding: 3px 0 3px 3px; background: none; width: 100%; }
.mk-vseg::before { content: ""; position: absolute; z-index: 0; left: 0; top: 0; bottom: 0; width: 52px; border-radius: 14px; background: color-mix(in srgb, var(--ag-text) 7%, var(--ag-card)); }
.mk-vseg > button { grid-column: 1; min-height: 64px; height: auto; padding: 0; }
.mk-vopt { grid-column: 2; display: flex; flex-direction: column; justify-content: center; gap: 3px; padding: 10px 0; opacity: .62; position: relative; z-index: 1; }
.mk-vopt.on { opacity: 1; }
.mk-vopt b { font-weight: 500; font-size: 14.5px; }
.mk-vopt.on b { color: var(--ag-primary); }
.mk-vopt b em { font-style: normal; font-size: 11.5px; font-weight: 500; margin-left: 6px; padding: 1px 7px; border-radius: 9px; background: color-mix(in srgb, var(--ag-primary) 14%, transparent); color: var(--ag-primary); }
.mk-vopt small { color: var(--ag-text2); font-size: 12.5px; line-height: 1.4; }
`;

async function shot(name, { mobile = false, theme = "light", row, height }) {
  const s = await open(browser, { mobile, lang: "de", theme, tab: "config", prefs: { sub: "system" } });
  await s.page.setViewportSize({ width: mobile ? 390 : 1400, height });
  await s.page.waitForTimeout(700);
  await s.ev(`const g=r.querySelector('.ag-pmgroup'); const cards=g.querySelectorAll('.ag-card.ag-setlist'); const c=cards[cards.length-1];
    const st=document.createElement('style'); st.textContent=arg.css; r.appendChild(st);
    c.insertAdjacentHTML('beforeend', arg.row);
    const seg=c.querySelector('.mk-vseg');
    if (seg) { const i=Number(seg.dataset.sel); const b=seg.querySelectorAll('button')[i]; const pill=seg.querySelector('.ag-pill');
      pill.style.cssText='width:'+b.offsetWidth+'px;height:'+b.offsetHeight+'px;transform:translate('+b.offsetLeft+'px,'+b.offsetTop+'px);'; }
    c.scrollIntoView({block:'center'}); return 1`, { css: CSS, row });
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}${name}.png` });
  console.log(name);
  await s.ctx.close();
}

await shot("a-desktop", { row: sliderRow(0), height: 900 });
await shot("a-unten-desktop", { row: sliderRow(1), height: 900 });
await shot("a-handy", { mobile: true, theme: "dark", row: sliderRow(0), height: 1180 });
await shot("a-unten-handy", { mobile: true, theme: "dark", row: sliderRow(1), height: 1180 });
await shot("b-desktop", { row: switchRow(), height: 900 });
await shot("b-handy", { mobile: true, theme: "dark", row: switchRow(), height: 1180 });
await browser.close();
server.close();
