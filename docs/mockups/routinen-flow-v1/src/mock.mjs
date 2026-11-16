// Mockups "Routinen: Vorschau des Ablaufs" (2026-11-16): am Ende des Editors einer Routine zeigt eine Grafik, was passiert (Auslöser, Prüfung des Zustands,
// Aktion). Die Bilder zeigen den echten Editor des Panels (HA-Nachbau, hell, Computer und Handy 390 px); die Vorschau ist als Entwurf eingesetzt.
// Erfundene Daten. Aufruf im Wurzelverzeichnis: node docs/mockups/routinen-flow-v1/src/mock.mjs
import { fileURLToPath } from "node:url";
import { launch, open, PORT } from "../../../../tests/panel/lib.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(PORT);
const browser = await launch();

const I = {
  lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18Z",
  person: "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z",
  clock: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  shieldOff: "M1,4.27L2.28,3L21,21.72L19.73,23L17.5,20.77C16.06,22 14.11,22.67 12,23C6.84,21.74 3,16.55 3,11V6.27L1,4.27M12,1L21,5V11C21,13.28 20.36,15.5 19.27,17.38L5.3,3.41L12,1Z",
  shield: "M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
  bolt: "M7,2V13H10V22L17,10H13L17,2H7Z",
  filter: "M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z",
  log: "M3,4H7V8H3V4M9,5V7H21V5H9M3,10H7V14H3V10M9,11V13H21V11H9M3,16H7V20H3V16M9,17V19H21V17H9Z",
};
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><path fill="currentColor" d="${I[n]}"/></svg>`;

const CSS = `<style>
.fl { --fl-line: var(--ag-primary); }
.fl * { box-sizing: border-box; }
.fl-card { border: 1px solid var(--ag-divider); border-radius: 16px; background: var(--ag-card); padding: 14px; }
.fl-node { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--ag-divider); background: var(--ag-card); }
.fl-node.go { border-color: var(--ag-success); background: var(--ag-success-soft); }
.fl-node.stop { border-style: dashed; background: var(--ag-subtle); color: var(--ag-text2); }
.fl-node.act { border-color: var(--ag-error); background: var(--ag-error-soft); }
.fl-ico { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--ag-primary-soft); color: var(--ag-primary); flex: none; }
.fl-node.go .fl-ico { background: #fff; color: var(--ag-success); } .fl-node.act .fl-ico { background: #fff; color: var(--ag-error); } .fl-node.stop .fl-ico { background: #fff; color: var(--ag-text2); }
.fl-t { font-weight: 600; } .fl-s { font-size: 13px; color: var(--ag-text2); margin-top: 2px; } .fl-node.act .fl-s, .fl-node.go .fl-s { color: var(--ag-text); }
.fl-k { font-size: 11.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--ag-text2); margin-bottom: 2px; }
.fl-con { display: flex; flex-direction: column; align-items: center; height: 30px; color: var(--fl-line); }
.fl-con::before { content: ""; flex: 1; width: 2px; background: currentColor; }
.fl-con::after { content: ""; border: 6px solid transparent; border-top: 8px solid currentColor; border-bottom: 0; }
.fl-con small { position: absolute; }
.fl-tree { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.fl-leaf { display: inline-flex; gap: 8px; align-items: center; padding: 6px 10px; border: 1px solid var(--ag-divider); border-radius: 10px; background: var(--ag-card); font-size: 13px; }
.fl-or { font-size: 11.5px; font-weight: 700; color: var(--ag-primary); letter-spacing: .05em; padding-left: 4px; }
.fl-grp { border-left: 3px solid var(--ag-primary); background: color-mix(in srgb, var(--ag-primary) 7%, transparent); border-radius: 0 10px 10px 0; padding: 6px 10px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.fl-band { display: flex; gap: 4px; margin-top: 10px; }
.fl-band > div { flex: 1 1 0; min-width: 0; text-align: center; font-size: 11.5px; line-height: 1.25; padding: 7px 3px; border-radius: 8px; background: var(--ag-subtle); color: var(--ag-text2); border: 1px dashed var(--ag-divider); }
.fl-band > div.on { background: var(--ag-success); color: #fff; border: 1px solid var(--ag-success); font-weight: 600; }
.fl-tag { display: inline-flex; gap: 5px; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 500; }
.fl-tag.err { color: var(--ag-error); background: var(--ag-error-soft); } .fl-tag.none { color: var(--ag-text2); background: var(--ag-subtle); }
.fl-row { display: grid; grid-template-columns: 1fr 24px 1fr 24px 1fr; align-items: stretch; gap: 0; }
.fl-arr { display: grid; place-items: center; color: var(--fl-line); font-size: 20px; }
.fl-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fl-yn { font-size: 12px; font-weight: 700; margin: 0 0 4px; } .fl-yn.y { color: var(--ag-success); } .fl-yn.n { color: var(--ag-text2); }
.fl-note { font-size: 12.5px; color: var(--ag-text2); margin: 10px 2px 0; }
@media (max-width: 480px) { .fl-band { flex-wrap: wrap; } .fl-band > div { flex: 1 1 28%; } .fl-leaf { flex-wrap: wrap; } .fl-row { grid-template-columns: 1fr; } .fl-arr { transform: rotate(90deg); height: 24px; } .fl-split { grid-template-columns: 1fr; } }
</style>`;

const tree = `<div class="fl-tree"><span class="fl-leaf">${ic("lock", 16)}<b>Haustür-Schloss</b> ist aufgeschlossen</span><span class="fl-or">ODER</span>
  <div class="fl-grp"><span class="fl-leaf">${ic("person", 16)}<b>Marco</b> ist zu Hause</span><span class="fl-or">UND</span><span class="fl-leaf">${ic("clock", 16)}zwischen 22:00 und 06:00</span></div></div>`;
const band = (on) => `<div class="fl-band">${["Ausgangs-<br>verzögerung", "Anlage<br>scharf", "Eingangs-<br>verzögerung", "Beim<br>Alarm", "Anlage<br>deaktiviert"].map((t, i) => `<div class="${on.includes(i) ? "on" : ""}">${t}</div>`).join("")}</div>`;
const tagBypass = `<span class="fl-tag err">${ic("alert", 13)}Umgeht den Code</span>`;
const chap = (t, body) => `<section class="ag-chap"><h3 class="ag-chap-t">${t}</h3>${body}</section>`;

// A: senkrechter Ablauf mit Verbindungslinien; der Zustands-Block hat das Band der fünf Zustände, daneben der Weg "übersprungen"
const A = chap("Vorschau", `<div class="fl">
  <div class="fl-node"><span class="fl-ico">${ic("bolt")}</span><div style="min-width:0"><div class="fl-k">1 · Auslöser</div><div class="fl-t">Wenn das Gerät neu zutrifft</div>${tree}<div class="fl-s" style="margin-top:8px">Nicht bei "nicht verfügbar", nicht nach einem Neustart.</div></div></div>
  <div class="fl-con"></div>
  <div class="fl-node"><span class="fl-ico">${ic("filter")}</span><div style="min-width:0;flex:1"><div class="fl-k">2 · Prüfung</div><div class="fl-t">Ist die Anlage in einem dieser Zustände?</div>${band([0, 1])}</div></div>
  <div class="fl-split" style="margin-top:0"><div><div class="fl-con" style="height:34px"></div><div class="fl-yn y">JA</div><div class="fl-node act"><span class="fl-ico">${ic("shieldOff")}</span><div><div class="fl-k">3 · Aktion</div><div class="fl-t">Anlage deaktivieren</div><div style="margin-top:6px">${tagBypass}</div></div></div></div>
    <div><div class="fl-con" style="height:34px;color:var(--ag-text2)"></div><div class="fl-yn n">NEIN</div><div class="fl-node stop"><span class="fl-ico">${ic("log")}</span><div><div class="fl-k">stattdessen</div><div class="fl-t">Übersprungen</div><div class="fl-s">Steht im Protokoll.</div></div></div></div></div></div>`);

// B: drei Schritte nebeneinander (Handy: untereinander), knapp
const B = chap("Vorschau", `<div class="fl"><div class="fl-row">
  <div class="fl-node"><span class="fl-ico">${ic("lock")}</span><div style="min-width:0"><div class="fl-k">Auslöser</div><div class="fl-t">Schloss aufgeschlossen</div><div class="fl-s">oder Marco zu Hause und 22:00–06:00</div></div></div>
  <div class="fl-arr">➜</div>
  <div class="fl-node go"><span class="fl-ico">${ic("filter")}</span><div style="min-width:0"><div class="fl-k">Nur wenn</div><div class="fl-t">Ausgangsverz. oder scharf</div><div class="fl-s">sonst übersprungen</div></div></div>
  <div class="fl-arr">➜</div>
  <div class="fl-node act"><span class="fl-ico">${ic("shieldOff")}</span><div style="min-width:0"><div class="fl-k">Aktion</div><div class="fl-t">Deaktivieren</div><div style="margin-top:6px">${tagBypass}</div></div></div></div>
  <p class="fl-note">Läuft nur, wenn die Bedingungen neu zutreffen. Mit "muss 5 s gelten" erst nach 5 Sekunden.</p></div>`);

// C: Lebenslauf der Anlage als Band mit der Routine darunter: zeigt vor allem, in welchen Zuständen sie wirkt; Auslöser und Aktion als Satz
const C = chap("Vorschau", `<div class="fl"><div class="fl-card">
  <div class="fl-k">Lebenslauf der Anlage</div>${band([0, 1])}
  <div style="display:flex;gap:6px;margin-top:6px;color:var(--ag-text2);font-size:12px"><span style="flex:2;text-align:center">✔ Routine wirkt</span><span style="flex:3;text-align:center">✖ übersprungen (steht im Protokoll)</span></div>
  <hr style="border:0;border-top:1px solid var(--ag-divider);margin:14px 0">
  <div style="line-height:2">Wenn <span class="fl-leaf">${ic("lock", 16)}<b>Haustür-Schloss</b> ist aufgeschlossen</span> oder <span class="fl-leaf">${ic("person", 16)}<b>Marco</b> ist zu Hause</span> und <span class="fl-leaf">${ic("clock", 16)}22:00–06:00</span>
    <br>dann <span class="fl-tag err" style="height:28px;font-size:13px">${ic("shieldOff", 15)}Anlage deaktivieren</span> ${tagBypass}</div></div></div>`);

async function shot(name, mobile, html) {
  const size = mobile ? { width: 390, height: 3800 } : { width: 1180, height: 3400 };
  const s = await open(browser, { mobile, lang: "de", theme: "light", tab: "config", prefs: { sub: "system" }, size });
  await s.waitFor("return !!r.querySelector('.ag-rtrow')");
  await s.tap('[data-sys="rt-edit"][data-index="2"]');
  await s.waitFor("return !!r.querySelector('.ag-rt-ed')");
  await s.ev(`const d=r.getElementById('ag-step'); d.style.maxHeight='none'; d.style.height='auto'; const e=d.querySelector('.ag-dlg-err'); e.insertAdjacentHTML('beforebegin', ${JSON.stringify(CSS + html)}); d.querySelector('.ag-dlg-body').style.maxHeight='none'; d.querySelector('.ag-dlg-body').style.overflow='visible'; return 1`);
  await s.page.waitForTimeout(500);
  // Ausschnitt ab dem Kapitel "Dann" bis zum Ende des Fensters (der Anfang des Editors ist bekannt)
  const box = await s.ev("const d=r.getElementById('ag-step'); const b=d.getBoundingClientRect(); const t=[...d.querySelectorAll('.ag-chap-t')].find((e)=>e.textContent==='Dann').getBoundingClientRect(); const f=d.querySelector('.fl').getBoundingClientRect(); return { x: b.x, y: t.top - 16, w: b.width, h: f.bottom - t.top + 120 }");
  await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png`, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.w, size.width), height: box.h }, fullPage: true });
  await s.ctx.close();
}
for (const [name, html] of [["A-ablauf-senkrecht", A], ["B-drei-schritte", B], ["C-zustandsband", C]]) for (const mobile of [false, true]) await shot(name, mobile, html);
await browser.close();
server.close();
console.log("fertig");
