// Mockups "Reiter der Sensoransicht am Tablet und Computer" (2026-11-15): Soll das Handy-Aussehen (Symbol über Kurztext) auf allen Grössen gelten?
// Die Bilder zeigen die echte Sensoransicht (HA-Nachbau, dunkel) mit den Varianten als zusätzliche Stile; erfundene Daten.
// Aufruf im Wurzelverzeichnis: node docs/mockups/tabs-gross-v1/src/mock.mjs
import { fileURLToPath } from "node:url";
import { launch, open, PORT } from "../../../../tests/panel/lib.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(PORT);
const browser = await launch();

// Gemeinsam: Symbol über dem Text, Kacheln mittig (wie auf dem Handy)
const BASE = `
.ag-sv-ti { display: grid; }
.ag-sv-ti svg { width: 24px; height: 24px; }
.ag-seg > button.ag-sv-tile { flex-direction: column; justify-content: center; align-items: center; gap: 5px; padding: 10px 8px; text-align: center; min-height: 68px; }
.ag-sv-tx { flex: none; max-width: 100%; text-align: center; }
`;
const VARIANTS = {
  "0-heute": "",
  // X: genau wie auf dem Handy: Verlauf und Gerät mit Wort, Batterie und Empfang mit Wert
  "1-X-wie-handy": `${BASE}
.ag-sv-tile[data-tab="state"] .ag-sv-tx b, .ag-sv-tile[data-tab="device"] .ag-sv-tx b { display: none; }
.ag-sv-tile[data-tab="battery"] .ag-sv-tx small, .ag-sv-tile[data-tab="signal"] .ag-sv-tx small { display: none; }
.ag-sv-tile[data-tab="state"] .ag-sv-tx small, .ag-sv-tile[data-tab="device"] .ag-sv-tx small { font-size: 14px; font-weight: 600; color: inherit; }
.ag-sv-tile .ag-sv-tx b { font-size: 14px; }`,
  // Y: Symbol über Beschriftung und Wert (zwei Zeilen), nichts geht verloren
  "2-Y-symbol-beschriftung-wert": `${BASE}`,
};

async function shot(name, css, device, size) {
  const s = await open(browser, { mobile: false, lang: "de", theme: "dark", size });
  await s.waitFor("return !!r.querySelector('[data-act=\"more\"][data-entity=\"binary_sensor.haustuer\"]')");
  await s.ev(`const st = document.createElement('style'); st.textContent = ${JSON.stringify(css)}; r.appendChild(st); r.host.sensorView.open('binary_sensor.haustuer'); return 1`);
  await s.waitFor("const d=r.getElementById('ag-sensor'); return d.open && d.querySelectorAll('.ag-sv-tile').length >= 3 && !!d.querySelector('.ag-sv-chart svg')");
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}${name}-${device}.png` });
  await s.ctx.close();
}
for (const [name, css] of Object.entries(VARIANTS)) {
  await shot(name, css, "desktop", { width: 1280, height: 760 });
  await shot(name, css, "tablet", { width: 834, height: 1000 });
}
await browser.close();
server.close();
console.log("fertig");
