// Mockups "Aktion verschieben oder kopieren" (v2, 2026-11-23): Entscheide des Nutzers zu v1: Variante B (Baum mit Einfügepunkten, genaue Stelle), nach dem
// Verschieben springt die Seite zur Aktion und hebt sie hervor, anderes Symbol für den Knopf (hier sechs Vorschläge), im Fenster neben "Verschieben" auch
// "Kopieren" (der Knopf "Duplizieren" an der Karte bleibt). Kein Test: öffnet das echte Panel im HA-Nachbau (Konfiguration › Aktionen) und legt Fenster darüber.
// Erfundene Daten. Aufruf im Wurzelverzeichnis: node docs/mockups/aktion-verschieben-v2/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8974";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
const { ic } = await import("../../../../custom_components/alarmageddon/panel/common.js");
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();

// ---------- Symbole (Material Design Icons, Apache 2.0) ----------
const ICONS = [
  ["1", "Vierfachpfeil", "das übliche Zeichen für Verschieben", "M13,6V11H18V7.75L22.25,12L18,16.25V13H13V18H16.25L12,22.25L7.75,18H11V13H6V16.25L1.75,12L6,7.75V11H11V6H7.75L12,1.75L16.25,6H13Z"],
  ["2", "Ordner mit Pfeil", "in einen anderen Ort legen", "M14,18V15H10V11H14V8L19,13M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6Z"],
  ["3", "Blatt mit Pfeil", "Aktion an einen anderen Ort", "M14,17H18V14L23,18.5L18,23V20H14V17M13,9H18.5L13,3.5V9M6,2H14L20,8V12.34C19.37,12.12 18.7,12 18,12A6,6 0 0,0 12,18C12,19.54 12.58,20.94 13.53,22H6C4.89,22 4,21.1 4,20V4A2,2 0 0,1 6,2Z"],
  ["4", "Pfeil nach unten rechts", "einordnen, einrücken", "M19,15L13,21L11.58,19.58L15.17,16H4V4H6V14H15.17L11.58,10.42L13,9L19,15Z"],
  ["5", "Pfeil in Kasten", "in einen Ort hinein", "M5,21A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3H19A2,2 0 0,1 21,5V19C21,20.11 20.1,21 19,21H5M6,13H14.5L11,16.5L12.42,17.92L18.34,12L12.42,6.08L11,7.5L14.5,11H6V13Z"],
  ["6", "Pfeil mit Strich", "von hier nach dort", "M3,8H5V16H3V8M7,8H9V16H7V8M11,8H13V16H11V8M15,19.25V4.75L22.25,12L15,19.25Z"],
];
const HEART = ic("heartPulse", 20);
const svg = (d, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;

// ---------- Daten (erfunden) ----------
const CHAPTERS = [
  ["Beim Scharfschalten", ["arming", "armed"]],
  ["Bei einem stillen Alarm", ["report"]],
  ["Bei einem Alarm", ["entry", "alarm", "end"]],
  ["Beim Deaktivieren", ["disarmed"]],
];
const PHASE = {
  arming: { title: "Scharfschalten beginnt", icon: "timer", color: "#ff8a80" },
  armed: { title: "Anlage scharf", icon: "shieldAway", color: "#ff8a80" },
  report: { title: "Stiller Alarm", icon: "bellOff", color: "#f59e0b" },
  entry: { title: "Eingangsverzögerung", icon: "timer", color: "#f59e0b" },
  alarm: { title: "Alarm beginnt", icon: "alert", color: "#e5484d" },
  end: { title: "Alarm endet", icon: "check", color: "#2e7d32" },
  disarmed: { title: "Anlage deaktiviert", icon: "shieldOff", color: "#2e7d32" },
};
const MODES = {
  home: { label: "Anwesend", icon: "shieldHome" },
  away: { label: "Abwesend", icon: "shieldAway" },
  night: { label: "Nacht", icon: "moon" },
  always: { label: "Immer aktiv", icon: "flash" },
};
const SELF = "HealthCheck melden";
// Aktionen je Phase im Modus "Abwesend"; ein Eintrag mit steps ist eine Gruppe
const FLOW = {
  arming: ["Aktivierungston"],
  armed: ["Rollläden schliessen", "Push-Meldung \"Scharf\""],
  report: ["Licht einschalten"],
  entry: ["Voralarm"],
  alarm: ["Push-Meldung", SELF, { group: "Gruppe \"Sirene\"", sub: "Wiederholen bis deaktiviert", steps: ["Alarmton", "Gerät schalten", "Warten"] }],
  end: ["Push-Meldung \"Alarm beendet\"", "Rollläden öffnen"],
  disarmed: ["Deaktivierungston"],
};
const HERE = "alarm";

// ---------- Bausteine ----------
const mv = (size) => svg(ICONS[0][3], size);
const modeSeg = (cur) => `<div class="ag-seg small ag-modeseg mk-modes" role="tablist">${Object.entries(MODES).map(([k, m]) => `<button class="ag-segbtn ${k === cur ? "on" : ""}" role="tab">${ic(m.icon, 18)}<span>${m.label}</span></button>`).join("")}</div>`;
const slot = (on, label, same) => `<button class="mk-slot ${on ? "on" : ""} ${same ? "same" : ""}"><span class="mk-slot-l"></span>${on ? "Hier einfügen" : (same ? "gleiche Stelle · nur Kopieren" : label || "einfügen")}</button>`;
// Eine Liste mit Einfügepunkten; pick = "Gruppe/Index" der gewählten Stelle, z. B. "2" oder "g:1"
function list(items, pick, inGroup = false, isHere = false) {
  const out = [];
  const idxKey = (i) => (inGroup ? `g:${i}` : String(i));
  items.forEach((it, i) => {
    const selfNext = isHere && items[i] === SELF;
    const selfPrev = isHere && items[i - 1] === SELF;
    out.push(slot(pick === idxKey(i), "", selfNext || selfPrev));
    if (typeof it === "string") out.push(`<div class="mk-step ${it === SELF && isHere ? "self" : ""}">${it}${it === SELF && isHere ? `<span class="mk-tag">diese Aktion</span>` : ""}</div>`);
    else out.push(`<div class="mk-grp"><div class="mk-grp-h">${ic("repeat", 16)}<b>${it.group}</b><small>${it.sub}</small></div>${list(it.steps, pick, true)}</div>`);
  });
  out.push(slot(pick === idxKey(items.length), "", isHere && items[items.length - 1] === SELF));
  return `<div class="mk-slots ${inGroup ? "in" : ""}">${out.join("")}</div>`;
}
const head = () => `<div class="mk-head"><span class="ag-oav ag-ttl-av ag-tint on mk-av">${mv(24)}</span><h3>Aktion verschieben oder kopieren</h3><button class="ag-iconbtn mk-x">${ic("close", 20)}</button></div>
  <p class="mk-what"><span class="ag-oav mk-what-ic">${ic("heartPulse", 18)}</span><span><b>${SELF}</b><small>jetzt: Abwesend › Alarm beginnt</small></span></p>`;
function dialog(mode, open, pick, target, where) {
  const tree = CHAPTERS.map(([title, keys]) => `<div class="mk-chap">${title}</div>${keys.map((k) => {
    const p = PHASE[k]; const on = open === k; const here = k === HERE && mode === "away"; const n = (FLOW[k] || []).reduce((a, x) => a + (typeof x === "string" ? 1 : 1 + x.steps.length), 0);
    return `<div class="mk-n"><span class="mk-dot" style="--c:${p.color}">${ic(p.icon, 16)}</span><div class="mk-pw"><button class="mk-p ${on ? "on" : ""}"><span class="mk-p-t"><b>${p.title}</b><small>${n} ${n === 1 ? "Aktion" : "Aktionen"}${here ? " · hier" : ""}</small></span><span class="mk-chev ${on ? "open" : ""}">${ic("arrowDown", 18)}</span></button>${on ? list(FLOW[k], pick, false, here) : ""}</div></div>`;
  }).join("")}`).join("");
  return `<div class="mk-dlg">${head()}${modeSeg(mode)}<div class="mk-scroll"><div class="mk-tree">${tree}</div></div>
    <div class="mk-foot"><span class="mk-target">${target ? `Ziel: <b>${target}</b>${where ? ` · ${where}` : ""}<small>Verschieben nimmt die Aktion von hier weg, Kopieren lässt sie hier stehen.</small>` : "Wähle eine Stelle"}</span><span class="ag-grow"></span>
    <button class="ag-btn">Abbrechen</button><button class="ag-btn" ${target ? "" : "disabled"}>${ic("copy", 18)}Kopieren</button><button class="ag-btn primary" ${target ? "" : "disabled"}>${mv(18)}Verschieben</button></div></div>`;
}
// Blatt mit den Symbolvorschlägen: die Zeile der Knöpfe einer Karte, mit dem Vorschlag zwischen "Duplizieren" und "Löschen"
const sheet = () => `<div class="mk-dlg mk-sheet"><div class="mk-head"><h3>Symbol für "Verschieben oder kopieren"</h3></div>
  <p class="mk-sub">So sieht der neue Knopf in der Zeile der Knöpfe aus (zwischen "Duplizieren" und "Löschen"). Der Knopf "Duplizieren" bleibt.</p>
  <div class="mk-icons">${ICONS.map(([n, t, d, p]) => `<div class="mk-icon"><div class="mk-icon-k">${n}</div><div class="mk-icon-row" data-icon="${n}"></div><div class="mk-icon-t"><div><b>${t}</b><small>${d}</small></div><div class="mk-icon-big">${svg(p, 40)}</div></div></div>`).join("")}</div></div>`;

const CSS = `
.mk-back { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.42); display: grid; place-items: center; }
.mk-dlg { width: min(880px, calc(100vw - 32px)); max-height: calc(100vh - 48px); display: flex; flex-direction: column; background: var(--ag-card); border-radius: 22px; padding: 22px 24px 18px; box-shadow: 0 10px 40px rgba(0,0,0,.3); box-sizing: border-box; }
.mk-head { display: flex; align-items: center; gap: 12px; } .mk-head h3 { flex: 1; margin: 0; font-size: 20px; font-weight: 600; }
.mk-av { background: color-mix(in srgb, var(--ag-primary) 14%, transparent); color: var(--ag-primary); }
.mk-what { display: flex; align-items: center; gap: 12px; margin: 14px 0 12px; padding: 10px 12px; border-radius: 14px; background: var(--ag-subtle); }
.mk-what b { display: block; font-size: 15px; } .mk-what small { color: var(--ag-text2); font-size: 12.5px; }
.mk-what-ic { background: color-mix(in srgb, #d6336c 14%, transparent); color: #d6336c; }
.mk-modes { align-self: flex-start; margin: 2px 0 14px; }
.mk-scroll { flex: 1; min-height: 0; overflow: auto; padding: 2px 2px 8px; }
.mk-chap { margin: 14px 0 8px 46px; font-size: 12.5px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: var(--ag-text2); } .mk-chap:first-child { margin-top: 2px; }
.mk-tree { position: relative; }
.mk-tree::before { content: ""; position: absolute; left: 17px; top: 14px; bottom: 14px; width: 2px; border-radius: 2px; background: linear-gradient(var(--ag-primary), color-mix(in srgb, var(--ag-primary) 25%, transparent)); }
.mk-n { position: relative; display: flex; align-items: flex-start; gap: 12px; margin: 0 0 10px; }
.mk-dot { position: relative; z-index: 1; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--c, var(--ag-primary)); box-shadow: 0 2px 6px color-mix(in srgb, var(--c, var(--ag-primary)) 40%, transparent); }
.mk-pw { flex: 1; min-width: 0; }
.mk-p { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 52px; text-align: left; font: inherit; color: inherit; cursor: pointer; border: 1px solid var(--ag-divider); border-radius: 14px; background: var(--ag-card); box-sizing: border-box; }
.mk-p.on { border: 2px solid var(--ag-primary); padding: 9px 13px; background: color-mix(in srgb, var(--ag-primary) 6%, var(--ag-card)); }
.mk-p-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; } .mk-p-t b { font-size: 15px; font-weight: 600; } .mk-p-t small { color: var(--ag-text2); font-size: 12.5px; }
.mk-chev { flex: none; display: grid; place-items: center; color: var(--ag-text2); } .mk-chev.open { transform: rotate(180deg); color: var(--ag-primary); }
.mk-slots { margin: 8px 0 2px 14px; padding-left: 14px; border-left: 2px dotted color-mix(in srgb, var(--ag-primary) 45%, transparent); }
.mk-slots.in { margin: 6px 0 4px 6px; padding-left: 12px; }
.mk-slot { display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px 8px; margin: 2px 0; font: inherit; font-size: 12.5px; color: var(--ag-text2); background: none; border: 1px dashed var(--ag-divider); border-radius: 999px; cursor: pointer; }
.mk-slot-l { width: 8px; height: 8px; border-radius: 50%; background: var(--ag-divider); }
.mk-slot.same { opacity: .55; border-style: dotted; }
.mk-slot.on { color: var(--ag-primary); font-weight: 600; border: 1.5px solid var(--ag-primary); background: color-mix(in srgb, var(--ag-primary) 8%, var(--ag-card)); } .mk-slot.on .mk-slot-l { background: var(--ag-primary); }
.mk-step { display: flex; align-items: center; gap: 8px; margin: 2px 0; padding: 8px 12px; border-radius: 10px; background: var(--ag-subtle); font-size: 13px; font-weight: 500; }
.mk-step.self { border: 1px dashed var(--ag-text2); background: var(--ag-card); color: var(--ag-text2); }
.mk-tag { margin-left: auto; padding: 1px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; background: var(--ag-subtle); border: 1px solid var(--ag-divider); color: var(--ag-text2); }
.mk-grp { margin: 3px 0; padding: 8px 10px 6px; border-radius: 12px; border: 1.5px solid color-mix(in srgb, #e5484d 45%, transparent); background: color-mix(in srgb, #e5484d 5%, var(--ag-card)); }
.mk-grp-h { display: flex; align-items: center; gap: 8px; font-size: 13px; } .mk-grp-h b { font-weight: 600; } .mk-grp-h small { color: var(--ag-text2); font-size: 12px; }
.mk-foot { display: flex; align-items: center; gap: 10px; padding-top: 14px; margin-top: 8px; border-top: 1px solid var(--ag-divider); }
.mk-target { min-width: 0; font-size: 13.5px; color: var(--ag-text2); } .mk-target b { color: var(--ag-text); font-weight: 600; } .mk-target small { display: block; margin-top: 3px; font-size: 12px; line-height: 1.35; }
/* Symbolblatt */
.mk-sheet { width: min(980px, calc(100vw - 32px)); } .mk-sub { margin: 10px 0 14px; color: var(--ag-text2); font-size: 13.5px; }
.mk-icons { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.mk-icon { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid var(--ag-divider); border-radius: 16px; background: var(--ag-subtle); position: relative; }
.mk-icon-k { position: absolute; top: -10px; left: -10px; width: 28px; height: 28px; border-radius: 50%; background: var(--ag-primary); color: #fff; font-weight: 700; display: grid; place-items: center; }
.mk-icon-row { display: flex; gap: 8px; align-items: center; justify-content: center; } .mk-icon-row .ag-iconbtn.mk-new { outline: 2px solid color-mix(in srgb, var(--ag-primary) 60%, transparent); outline-offset: 2px; }
.mk-icon-big { flex: none; color: var(--ag-text); opacity: .85; display: grid; place-items: center; }
.mk-icon-t { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mk-icon-t b { display: block; font-size: 14.5px; } .mk-icon-t small { color: var(--ag-text2); font-size: 12.5px; }
/* Nachher */
.mk-flash { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ag-primary) 70%, transparent) !important; border-radius: 16px; }
.mk-toast { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 85; display: flex; gap: 10px; align-items: center; padding: 12px 16px; border-radius: 14px; background: #1f2937; color: #fff; font-size: 14px; box-shadow: 0 6px 24px rgba(0,0,0,.35); max-width: calc(100vw - 32px); }
.mk-toast b { font-weight: 600; } .mk-toast svg { flex: none; }
:host([narrow]) .mk-dlg { width: 100vw; max-height: none; height: 100vh; border-radius: 0; padding: 16px 14px 14px; }
:host([narrow]) .ag-seg.mk-modes { align-self: stretch; display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 2px; } :host([narrow]) .ag-seg.mk-modes .ag-segbtn { min-width: 0; width: auto; flex-direction: column; gap: 3px; padding: 7px 2px; font-size: 11.5px; min-height: 54px; justify-content: center; }
:host([narrow]) .mk-foot { flex-wrap: wrap; } :host([narrow]) .mk-target { flex: 0 0 100%; } :host([narrow]) .mk-foot > .ag-grow { display: none; }
:host([narrow]) .mk-foot > .ag-btn:first-of-type { flex: 0 0 100%; justify-content: center; } :host([narrow]) .mk-foot > .ag-btn:not(:first-of-type) { flex: 1; justify-content: center; }
:host([narrow]) .mk-icons { grid-template-columns: repeat(2, minmax(0, 1fr)); } :host([narrow]) .mk-sheet { overflow: auto; }
`;

async function shot(name, { mobile = false, theme = "light", html = null, height = null, after = false, icons = false }) {
  const s = await open(browser, { mobile, lang: "de", theme, tab: "config", prefs: { sub: "actions" } });
  await s.waitFor("return !!r.querySelector('.ag-wf-main')");
  await s.page.waitForTimeout(300);
  await s.ev(`const st=document.createElement('style'); st.textContent=arg.css; r.appendChild(st);
    // Zeile der Knöpfe einer echten Karte für die Symbolvorschläge
    const row = r.querySelector('.ag-wf-main .ag-wf-btns');
    if (arg.icons) { const d=document.createElement('div'); d.className='mk-back'; d.innerHTML=arg.html; r.appendChild(d);
      for (const cell of d.querySelectorAll('.mk-icon-row')) { const c=row.cloneNode(true); const del=c.querySelector('[data-wf="delete"]'); const m=document.createElement('button'); m.className='ag-iconbtn mk-new'; m.innerHTML=arg.svgs[cell.dataset.icon]; c.insertBefore(m, del); c.querySelectorAll('[data-wf="test-step"],[data-wf="test-step-stop"]').forEach((x)=>x.removeAttribute('data-wf')); cell.appendChild(c); } }
    else if (arg.html) { const d=document.createElement('div'); d.className='mk-back'; d.innerHTML=arg.html; r.appendChild(d); }
    if (arg.after) { // nach dem Verschieben: die Aktion steht in "Alarm endet", die Seite ist dorthin gesprungen und hebt sie hervor
      const card=r.querySelector('.ag-wf-main .ag-wf-btns').closest('.ag-card, [class*="ag-wf-card"], .ag-wf-step') || r.querySelector('.ag-wf-main .ag-wf-btns').parentElement.parentElement;
      const after=r.querySelector('.ag-wf-after'); const c=card.cloneNode(true);
      c.querySelector('.ag-wf-text b').textContent='HealthCheck melden'; c.querySelector('.ag-wf-text .ag-small').textContent='Cronitor · ?state=fail&message=Alarm';
      c.querySelector('.ag-wf-icon').className='ag-wf-icon k-healthcheck'; c.querySelector('.ag-wf-icon').innerHTML=arg.heart; c.querySelector('.ag-wf-icon').style.cssText='background: color-mix(in srgb, #d6336c 14%, transparent); color: #d6336c;';
      const zone=c.querySelector('.ag-zone'); if (zone) zone.textContent='Alarm endet';
      c.classList.add('mk-flash'); c.querySelectorAll('.ag-wf-pill, .ag-pill, .ag-wf-chip').forEach((x)=>x.remove());
      const plus=after.querySelector('.ag-wf-plus'); after.insertBefore(c, plus?.nextSibling || null);
      const t=document.createElement('div'); t.className='mk-toast'; t.innerHTML=arg.toastIcon + '<span><b>HealthCheck melden</b> verschoben nach Abwesend › Alarm endet</span>'; r.appendChild(t);
      r.host._content.scrollTop += after.getBoundingClientRect().top - 260; }
    return 1`, { css: CSS, html, icons, after, svgs: Object.fromEntries(ICONS.map(([n, , , p]) => [n, svg(p, 18)])), toastIcon: svg(ICONS[0][3], 18).replace(/"/g, "'"), heart: HEART });
  await s.page.setViewportSize({ width: mobile ? 390 : 1400, height: height || (mobile ? 844 : 1100) });
  await s.page.waitForTimeout(300);
  await s.page.screenshot({ path: `${out}${name}.png` });
  console.log(`${name}.png`, s.errors.join(" | "));
  await s.ctx.close();
}

await shot("symbole-desktop", { html: sheet(), icons: true, height: 760 });
await shot("symbole-handy", { mobile: true, theme: "dark", html: sheet(), icons: true, height: 1100 });
await shot("b-desktop", { html: dialog("away", "end", "1", "Abwesend › Alarm endet", "nach \"Push-Meldung \\\"Alarm beendet\\\"\"") });
await shot("b-handy", { mobile: true, theme: "dark", html: dialog("away", "end", "1", "Abwesend › Alarm endet", "nach der ersten Aktion") });
await shot("b-handy-ganz", { mobile: true, theme: "dark", html: dialog("away", "end", "1", "Abwesend › Alarm endet", "nach der ersten Aktion"), height: 1500 });
await shot("b-gleiche-phase-desktop", { html: dialog("away", "alarm", "g:1", "Abwesend › Alarm beginnt › Gruppe \"Sirene\"", "nach \"Alarmton\""), height: 1500 });
await shot("b-gleiche-phase-handy", { mobile: true, theme: "dark", html: dialog("away", "alarm", "g:1", "Abwesend › Alarm beginnt › Gruppe \"Sirene\"", "nach \"Alarmton\""), height: 1800 });
await shot("nachher-desktop", { after: true, height: 820 });
await shot("nachher-handy", { mobile: true, theme: "dark", after: true });

await browser.close();
process.exit(0);
