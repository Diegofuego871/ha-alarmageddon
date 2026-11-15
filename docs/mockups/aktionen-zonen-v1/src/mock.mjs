// Mockups "Aktionen: Zonen erkennen" (2026-11-15): wie lässt sich bei den Aktionen auf einen Blick sehen, in welche Zone (Ausgangsverzögerung,
// scharf, Eingangsverzögerung, Alarm, nach dem Quittieren, Deaktivieren) ein Schritt gehört? Die Bilder zeigen die echte Seite des Panels
// (HA-Nachbau, dunkel) mit den Varianten als zusätzliche Stile. Erfundene Daten.
// Aufruf im Wurzelverzeichnis: node docs/mockups/aktionen-zonen-v1/src/mock.mjs
import { fileURLToPath } from "node:url";
import { launch, open, PORT } from "../../../../tests/panel/lib.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(PORT);
const browser = await launch();

// Zonenfarbe je Liste: die Farbe des festen Punktes davor (gelb: Verzögerung, rot: scharf und Alarm, grün: Ende und Deaktivieren)
const ZONES = `
.ag-wf-arming, .ag-wf-entry { --z: var(--ag-warning); }
.ag-wf-armed, .ag-wf-main { --z: var(--ag-error); }
.ag-wf-after, .ag-wf-disarmed { --z: var(--ag-success); }
`;
const VARIANTS = {
  "0-heute": { title: "Heute", css: "" },
  "1-A-verlauf": { title: "A: Verlauf von links", css: `${ZONES}
    .ag-wf-line .ag-wf-step { background: linear-gradient(100deg, color-mix(in srgb, var(--z) 22%, var(--ag-card)) 0%, var(--ag-card) 70%); }` },
  "2-B-leiste": { title: "B: Farbleiste links", css: `${ZONES}
    .ag-wf-line .ag-wf-step { box-shadow: inset 6px 0 0 var(--z); }` },
  "3-C-flaeche": { title: "C: Zonenfläche", css: `${ZONES}
    .ag-wf-line { background: color-mix(in srgb, var(--z) 8%, var(--ag-bg)); border: 1px solid color-mix(in srgb, var(--z) 28%, transparent); border-radius: 22px; padding: 8px 12px 6px; margin-bottom: 14px; }
    .ag-wf-line .ag-wf-step { background: var(--ag-card); }
    .ag-wf-line .ag-wf-plus .ag-wf-add { background: var(--ag-bg); }` },
  "4-D-verlauf-linie-pille": { title: "D: Verlauf, farbige Linie und Zonen-Pille (Empfehlung)", css: `${ZONES}
    .ag-wf-line .ag-wf-step { background: linear-gradient(100deg, color-mix(in srgb, var(--z) 16%, var(--ag-card)) 0%, var(--ag-card) 65%); }
    .ag-wf-line .ag-wf-seg { background: color-mix(in srgb, var(--z) 60%, var(--ag-divider)); }
    .mk-zone { display: flex; width: fit-content; align-items: center; margin-top: 8px; min-height: 24px; padding: 1px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; background: color-mix(in srgb, var(--z) 18%, transparent); color: color-mix(in srgb, var(--z) 80%, var(--ag-text)); }` },
};
// Sechs eigene Farben (Vorschlag des Nutzers, 2026-11-15): Verzögerungen orange (Ausgang hell, Eingang dunkel), scharf und Alarm rot (hell, dunkel),
// quittiert und deaktiviert grün (hell, dunkel)
const ZONES6 = `
.ag-wf-arming { --z: #ffb74d; }
.ag-wf-entry { --z: #ef6c00; }
.ag-wf-armed { --z: #ff8a80; }
.ag-wf-main { --z: #d32f2f; }
.ag-wf-after { --z: #81c784; }
.ag-wf-disarmed { --z: #2e7d32; }
`;
VARIANTS["5-E-sechs-farben"] = { title: "E: wie D, sechs eigene Farben (Vorschlag des Nutzers)", css: VARIANTS["4-D-verlauf-linie-pille"].css.replace(ZONES, ZONES6)
  .replace("color-mix(in srgb, var(--z) 16%, var(--ag-card))", "color-mix(in srgb, var(--z) 22%, var(--ag-card))") };
const LABEL = { arming: "Ausgangsverzögerung", armed: "Scharf geschaltet", entry: "Eingangsverzögerung", main: "Alarm", after: "Nach dem Quittieren", disarmed: "Beim Deaktivieren" };

// Schritte in allen Zonen (erfundene Anlage "Alarmanlage Wohnung", Modus "Abwesend")
const P = ["media_player.sonos_kueche"];
const DATA = {
  workflows_arming: { away: [{ type: "chime", players: P, sound: "tone_pip", volume: 0.4, duration: 3, delay: true, restore: true }] },
  workflows_armed: { away: [{ type: "chime", players: P, sound: "ok_double", volume: 0.4, duration: 2, restore: true }, { type: "action", action: "light.turn_off", target: ["light.wohnzimmer"], data: {}, wait: false }] },
  workflows_entry: { away: [{ type: "prealarm", players: ["media_player.sonos_wohnzimmer", ...P], sound: "pre_beep", volume: 0.4, duration: 20, delay: true, restore: true }] },
  workflows: { away: [{ type: "notify" }, { type: "action", action: "siren.turn_on", target: ["siren.flur"], data: {}, restore: true }, { type: "wait", seconds: 60 }, { type: "sound", players: ["media_player.sonos_wohnzimmer", ...P], sound: "siren", volume: 0.75, duration: 300, restore: true }] },
  workflows_after: { away: [{ type: "action", action: "cover.open_cover", target: ["cover.rollladen_wohnzimmer"], data: {}, wait: false }] },
  workflows_disarmed: { away: [{ type: "dechime", players: P, sound: "off_fall", volume: 0.4, duration: 2, restore: true }] },
};

async function shot(name, mobile, v) {
  const size = mobile ? { width: 390, height: 4000 } : { width: 1180, height: 2950 };
  const s = await open(browser, { mobile, lang: "de", theme: "dark", tab: "config", prefs: { sub: "actions", trigger: "away" }, size });
  await s.sim(`const sys = window.__systems[0]; sys.title = 'Alarmanlage Wohnung'; Object.assign(sys, ${JSON.stringify(DATA)}); sys.workflow_end = {}; return 1`);
  await s.ev("r.host.actions.draft = null; r.host.actions.trigger = 'away'; return r.host._fetch().then(() => { r.host.actions.render(); return 1; })");
  await s.page.waitForTimeout(700);
  await s.ev(`const st = document.createElement('style'); st.textContent = ${JSON.stringify(v.css)}; r.appendChild(st);
    const label = ${JSON.stringify(LABEL)};
    if (/^[45]-/.test(${JSON.stringify(name)})) for (const line of r.querySelectorAll('.ag-wf-line')) { const z = [...line.classList].find((c) => c.startsWith('ag-wf-') && label[c.slice(6)]); if (!z) continue; for (const t of line.querySelectorAll('.ag-wf-step .ag-wf-text')) { const p = document.createElement('span'); p.className = 'mk-zone'; p.textContent = label[z.slice(6)]; t.appendChild(p); } }
    return 1`);
  await s.page.waitForTimeout(400);
  // ab dem Kapitel "Beim Scharfschalten", direkt unter den festen Teilen
  await s.ev("const c = r.querySelector('.ag-content'); c.scrollTop = 0; const h = r.querySelector('.ag-wf-chap'); const stk = Math.max(...[...r.querySelectorAll('.ag-stk')].map((e) => e.getBoundingClientRect().bottom)); if (h) c.scrollTop = h.getBoundingClientRect().top - stk - 12; return 1");
  await s.page.waitForTimeout(300);
  await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}
for (const [name, v] of Object.entries(VARIANTS)) for (const mobile of [false, true]) await shot(name, mobile, v);
await browser.close();
server.close();
console.log("fertig");
