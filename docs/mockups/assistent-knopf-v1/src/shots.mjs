// Mockups "Knopf für den Einrichtungsassistenten im Kopf" (v1, 2026-11-20, Wunsch des Nutzers 11:38). Kein Test: öffnet die Übersicht im HA-Nachbau,
// setzt neben den Stift einen runden Knopf mit Zauberstab und nimmt drei Bewegungen als Einzelbilder auf (die Animation wird angehalten und Bild für
// Bild weitergestellt); `src/gif.py` setzt daraus die GIFs zusammen. Erfundene Daten (Anlage "Haus").
// Aufruf im Wurzelverzeichnis: node docs/mockups/assistent-knopf-v1/src/shots.mjs && python3 docs/mockups/assistent-knopf-v1/src/gif.py
process.env.PANEL_PORT = process.env.PANEL_PORT || "8978";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const frames = "/tmp/assistent-knopf-frames/";
mkdirSync(frames, { recursive: true });
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();

// Zauberstab in Teilen: drei Sterne und der Stab (aus dem Symbol "wand" des Panels), damit sich die Teile einzeln bewegen lassen
const STARS = ["M7.5,5.6L5,7L6.4,4.5L5,2L7.5,3.4L10,2L8.6,4.5L10,7L7.5,5.6Z", "M22,2L20.6,4.5L22,7L19.5,5.6L17,7L18.4,4.5L17,2L19.5,3.4L22,2Z",
  "M19.5,15.4L22,14L20.6,16.5L22,19L19.5,17.6L17,19L18.4,16.5L17,14L19.5,15.4Z"];
const STICK = "M13.34,12.78L15.78,10.34L13.66,8.22L11.22,10.66L13.34,12.78M14.37,7.29L16.71,9.63C17.1,10 17.1,10.65 16.71,11.04L5.04,22.71C4.65,23.1 4,23.1 3.63,22.71L1.29,20.37C0.9,20 0.9,19.35 1.29,18.96L12.96,7.29C13.35,6.9 14,6.9 14.37,7.29Z";
const svg = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style="overflow:visible"><g class="mk-stick"><path fill="currentColor" d="${STICK}"/></g>
  ${STARS.map((d, i) => `<g class="mk-star s${i}"><path fill="currentColor" d="${d}"/></g>`).join("")}</svg>`;
const button = (v) => `<button class="mk-wiz ${v}" title="Einrichtungsassistent fortsetzen (Schritt 5: Meldungen)">${svg}<span class="mk-dot"></span></button>`;

const CSS = `
.mk-wiz { position: relative; width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; padding: 0; cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--ag-primary) 45%, transparent); background: var(--ag-primary-soft); color: var(--ag-primary); }
.mk-wiz svg { display: block; }
.mk-wiz g { transform-box: view-box; }
.mk-dot { position: absolute; top: 1px; right: 1px; width: 9px; height: 9px; border-radius: 50%; background: var(--ag-primary); border: 2px solid var(--ag-card); }
/* A "Schwung": der Stab schwingt um den Griff, die Sterne blitzen nacheinander auf */
.mk-wiz.a .mk-stick { transform-origin: 3px 21px; animation: mk-swing 1.4s ease-in-out both; }
.mk-wiz.a .mk-star { transform-origin: center; transform-box: fill-box; animation: mk-pop 1.4s ease-out both; }
.mk-wiz.a .s1 { animation-delay: .12s; } .mk-wiz.a .s2 { animation-delay: .24s; }
@keyframes mk-swing { 0% { transform: rotate(0) } 22% { transform: rotate(-24deg) } 52% { transform: rotate(16deg) } 74% { transform: rotate(-6deg) } 100% { transform: rotate(0) } }
@keyframes mk-pop { 0%, 30% { transform: scale(1); opacity: 1 } 40% { transform: scale(.2); opacity: .2 } 60% { transform: scale(1.45) rotate(45deg); opacity: 1 } 100% { transform: scale(1) rotate(90deg); opacity: 1 } }
/* B "Funkeln": der Stab bleibt, die drei Sterne funkeln nacheinander, ein leichter Schein um den Knopf */
.mk-wiz.b .mk-star { transform-origin: center; transform-box: fill-box; animation: mk-twinkle 1.6s ease-in-out both; }
.mk-wiz.b .s1 { animation-delay: .25s; } .mk-wiz.b .s2 { animation-delay: .5s; }
.mk-wiz.b { animation: mk-glow 2.1s ease-in-out both; }
@keyframes mk-twinkle { 0% { transform: scale(1) rotate(0); opacity: 1 } 25% { transform: scale(.35) rotate(20deg); opacity: .35 } 55% { transform: scale(1.5) rotate(60deg); opacity: 1 } 100% { transform: scale(1) rotate(90deg); opacity: 1 } }
@keyframes mk-glow { 0%, 100% { box-shadow: 0 0 0 0 transparent } 45% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--ag-primary) 22%, transparent) } }
/* C "Drehung": der ganze Zauberstab dreht sich einmal, sanft beschleunigt und gebremst, mit einem Ring, der sich ausbreitet */
.mk-wiz.c svg { animation: mk-spin 1.3s cubic-bezier(.6,0,.3,1) both; }
.mk-wiz.c::after { content: ""; position: absolute; inset: -1px; border-radius: 50%; border: 2px solid var(--ag-primary); opacity: 0; animation: mk-ring 1.3s ease-out .5s both; }
@keyframes mk-spin { 0% { transform: rotate(0) } 100% { transform: rotate(360deg) } }
@keyframes mk-ring { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(1.7); opacity: 0 } }
`;

async function setup(mobile, theme) {
  const s = await open(browser, { mobile, lang: "de", theme, context: mobile ? {} : { deviceScaleFactor: 2 } });
  await s.waitFor("return !!r.querySelector('[data-act=\"rename\"]')");
  await s.ev("const st=document.createElement('style'); st.textContent=arg; r.appendChild(st); return 1", CSS);
  return s;
}

const VARIANTS = [["a", 1400], ["b", 2100], ["c", 1800]];
for (const [mobile, theme, tag] of [[false, "light", "desktop"], [true, "dark", "handy"]]) {
  for (const [v, ms] of VARIANTS) {
    const s = await setup(mobile, theme);
    await s.ev(`r.querySelector('[data-act="rename"]').insertAdjacentHTML('afterend', arg); return 1`, button(v));
    await s.page.waitForTimeout(200);
    const box = await s.ev("const h=r.querySelector('.ag-headsys').getBoundingClientRect(); const b=r.querySelector('.mk-wiz').getBoundingClientRect(); const f=r.host.getBoundingClientRect(); return { x: h.left, y: h.top - 14, w: Math.min(b.right - h.left + 30, 560), h: h.height + 28 }");
    const frame = await s.page.frames().find((f) => f.url().includes("panel"));
    const offset = await s.page.evaluate(() => { const f = document.querySelector("#panel-frame").getBoundingClientRect(); return { x: f.left, y: f.top }; });
    const clip = { x: box.x + offset.x, y: box.y + offset.y, width: box.w, height: box.h };
    const n = Math.round(ms / 40);
    for (let i = 0; i <= n; i += 1) {
      await s.ev(`for (const el of [r.querySelector('.mk-wiz'), ...r.querySelectorAll('.mk-wiz *')]) for (const a of el.getAnimations({ subtree: false })) { a.pause(); a.currentTime = arg; } return 1`, i * 40);
      await s.page.screenshot({ path: `${frames}${tag}-${v}-${String(i).padStart(3, "0")}.png`, clip });
    }
    if (v === "a") {
      await s.ev(`for (const el of [r.querySelector('.mk-wiz'), ...r.querySelectorAll('.mk-wiz *')]) for (const a of el.getAnimations()) a.finish(); return 1`);
      await s.page.screenshot({ path: `${out}kopf-${tag}.png` });
    }
    console.log(tag, v, n + 1, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
server.close();
