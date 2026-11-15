// Mockups "Reiter der Sensoransicht auf dem Handy" (2026-11-15): Auf kleinen Displays ist für Beschriftung und Wert in den vier Reitern zu wenig Platz.
// Die Bilder zeigen die echte Sensoransicht (HA-Nachbau, dunkel, 390 px) mit den Varianten als zusätzliche Stile. Erfundene Daten.
// Aufruf im Wurzelverzeichnis: node docs/mockups/tabs-handy-v1/src/mock.mjs
import { fileURLToPath } from "node:url";
import { launch, open, PORT } from "../../../../tests/panel/lib.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(PORT);
const browser = await launch();

// Gemeinsam: das Symbol steht wieder da (auf dem Handy ist es heute ausgeblendet), die Kachel zeigt Symbol und einen kurzen Text
const BASE = `
:host([narrow]) .ag-sv-ti { display: grid; }
:host([narrow]) .ag-sv-ti svg { width: 22px; height: 22px; }
:host([narrow]) .ag-seg > button.ag-sv-tile { flex-direction: column; justify-content: center; align-items: center; gap: 4px; padding: 8px 4px; text-align: center; min-height: 62px; }
:host([narrow]) .ag-sv-tx { flex: none; max-width: 100%; text-align: center; }
`;
const VARIANTS = {
  "0-heute": { css: "" },
  // A: nur Symbole
  "1-A-nur-symbole": { css: `${BASE}
:host([narrow]) .ag-sv-tx { display: none; }
:host([narrow]) .ag-seg > button.ag-sv-tile { min-height: 52px; }
:host([narrow]) .ag-sv-ti svg { width: 26px; height: 26px; }` },
  // B: Symbol plus kurzer Text: Verlauf und Gerät tragen ihr Wort, Batterie und Empfang den Wert
  "2-B-symbol-und-kurztext": { css: `${BASE}
:host([narrow]) .ag-sv-tile[data-tab="state"] .ag-sv-tx b, :host([narrow]) .ag-sv-tile[data-tab="device"] .ag-sv-tx b { display: none; }
:host([narrow]) .ag-sv-tile[data-tab="battery"] .ag-sv-tx small, :host([narrow]) .ag-sv-tile[data-tab="signal"] .ag-sv-tx small { display: none; }
:host([narrow]) .ag-sv-tile[data-tab="state"] .ag-sv-tx small, :host([narrow]) .ag-sv-tile[data-tab="device"] .ag-sv-tx small { font-size: 13px; font-weight: 600; color: inherit; }
:host([narrow]) .ag-sv-tile .ag-sv-tx b { font-size: 13px; }` },
};

async function shot(name, v) {
  const s = await open(browser, { mobile: true, lang: "de", theme: "dark", size: { width: 390, height: 720 } });
  await s.waitFor("return !!r.querySelector('[data-act=\"more\"][data-entity=\"binary_sensor.haustuer\"]')");
  await s.ev(`const st = document.createElement('style'); st.textContent = ${JSON.stringify(v.css)}; r.appendChild(st); r.host.sensorView.open('binary_sensor.haustuer'); return 1`);
  await s.waitFor("const d=r.getElementById('ag-sensor'); return d.open && d.querySelectorAll('.ag-sv-tile').length >= 3 && !!d.querySelector('.ag-sv-chart svg')");
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}${name}.png` });
  await s.ctx.close();
}
for (const [name, v] of Object.entries(VARIANTS)) await shot(name, v);
await browser.close();
server.close();
console.log("fertig");
