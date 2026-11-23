// Mockups "Aktion verschieben" (v1, 2026-11-23, Wunsch des Nutzers): ein Knopf an jeder Aktion öffnet ein Fenster mit Reitern für die Modi und einem
// grafischen Baum aller Phasen; gezeigt werden nur Ziele, die für die Aktion erlaubt sind. Kein Test: öffnet das echte Panel im HA-Nachbau (Reiter
// Konfiguration › Aktionen) und legt die Varianten als Fenster darüber, gebaut aus den Klassen des Panels und wenigen eigenen Stilen (mk-).
// Erfundene Namen, keine Herstellernamen. Aufruf im Wurzelverzeichnis: node docs/mockups/aktion-verschieben-v1/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8973";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
const { ic } = await import("../../../../custom_components/alarmageddon/panel/common.js");
// Vorläufiges Symbol "Verschieben" (Pfeile nach oben und unten, wie "swap-vertical" aus Material Design Icons)
const mv = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9,3L5,7H8V14H10V7H13M16,17V10H14V17H11L15,21L19,17H16Z"/></svg>`;
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();

// ---------- Daten (erfunden) ----------
// Phasen in der Reihenfolge des Ablaufs, mit Kapitel; je Modus nur die Phasen, die es dort gibt (Verzögerungen nur mit Zeit, "Immer aktiv" nie scharf)
const CHAPTERS = [
  ["Beim Scharfschalten", ["arming", "armed"]],
  ["Bei einem stillen Alarm", ["report"]],
  ["Bei einem Alarm", ["entry", "alarm", "end"]],
  ["Beim Deaktivieren", ["disarmed"]],
];
const PHASE = {
  arming: { title: "Scharfschalten beginnt", sub: "Ausgangsverzögerung läuft", icon: "timer", color: "#ff8a80" },
  armed: { title: "Anlage scharf", sub: "direkt nach dem Scharfschalten", icon: "shieldAway", color: "#ff8a80" },
  report: { title: "Stiller Alarm", sub: "ein Sensor meldet nur", icon: "bellOff", color: "#f59e0b" },
  entry: { title: "Eingangsverzögerung", sub: "Zeit zum Deaktivieren läuft", icon: "timer", color: "#f59e0b" },
  alarm: { title: "Alarm beginnt", sub: "Sirene, Meldungen, Geräte", icon: "alert", color: "#e5484d" },
  end: { title: "Alarm endet", sub: "nach dem Quittieren", icon: "check", color: "#2e7d32" },
  disarmed: { title: "Anlage deaktiviert", sub: "beim Deaktivieren", icon: "shieldOff", color: "#2e7d32" },
};
const MODES = {
  home: { label: "Anwesend", icon: "shieldHome", phases: ["armed", "report", "alarm", "end", "disarmed"], n: { armed: 1, report: 1, alarm: 3, end: 1, disarmed: 1 } },
  away: { label: "Abwesend", icon: "shieldAway", phases: ["arming", "armed", "report", "entry", "alarm", "end", "disarmed"], n: { arming: 1, armed: 2, report: 1, entry: 1, alarm: 3, end: 2, disarmed: 1 } },
  night: { label: "Nacht", icon: "moon", phases: ["armed", "report", "entry", "alarm", "end", "disarmed"], n: { armed: 1, report: 1, entry: 1, alarm: 2, end: 1, disarmed: 0 } },
  always: { label: "Immer aktiv", icon: "flash", phases: ["report", "alarm", "end"], n: { report: 2, alarm: 2, end: 1 } },
};
// Aktionen mit ihren erlaubten Phasen (wie im Panel: Aktivierungston nur beim Scharfschalten, Alarmton nur im Alarm und danach, usw.)
const ALLOWED_ALL = ["arming", "armed", "report", "entry", "alarm", "end", "disarmed"];
const ITEMS = {
  health: { title: "HealthCheck melden", from: ["away", "alarm"], allowed: ALLOWED_ALL, icon: "heartPulse" },
  sound: { title: "Alarmton", from: ["away", "alarm"], allowed: ["alarm", "end"], icon: "speaker" },
};
const STEPS = { // Aktionen je Phase im Modus "Abwesend" (für die Einfügepunkte)
  alarm: ["Push-Meldung", "HealthCheck melden", "Gruppe \"Sirene\" (Wiederholen bis deaktiviert)"],
  end: ["Push-Meldung \"Alarm beendet\"", "Rollläden öffnen"],
};

// ---------- Bausteine ----------
const radio = (on) => `<span class="mk-radio ${on ? "on" : ""}">${on ? ic("check", 14) : ""}</span>`;
const modeSeg = (cur) => `<div class="ag-seg small ag-modeseg mk-modes" role="tablist">${Object.entries(MODES).map(([k, m]) => `<button class="ag-segbtn ${k === cur ? "on" : ""}" role="tab" aria-selected="${k === cur}">${ic(m.icon, 18)}<span>${m.label}</span></button>`).join("")}</div>`;
const visibleChapters = (item, mode) => CHAPTERS.map(([title, keys]) => [title, keys.filter((k) => MODES[mode].phases.includes(k) && item.allowed.includes(k))]).filter(([, keys]) => keys.length);
const hiddenCount = (item, mode) => MODES[mode].phases.filter((k) => !item.allowed.includes(k)).length;
const here = (item, mode, key) => item.from[0] === mode && item.from[1] === key;
const head = (item) => `<div class="mk-head"><span class="ag-oav ag-ttl-av ag-tint on mk-av">${mv(24)}</span><h3>Aktion verschieben</h3><button class="ag-iconbtn mk-x">${ic("close", 20)}</button></div>
  <p class="mk-what"><span class="ag-oav mk-what-ic">${ic(item.icon, 18)}</span><span><b>${item.title}</b><small>jetzt: ${MODES[item.from[0]].label} › ${PHASE[item.from[1]].title}</small></span></p>`;
const note = (item, mode) => { const n = hiddenCount(item, mode); return n ? `<p class="mk-note">${ic("info", 14)} ${n} ${n === 1 ? "Phase ist" : "Phasen sind"} ausgeblendet: Diese Aktion ist dort nicht möglich.</p>` : ""; };
const foot = (target, pos) => `<div class="mk-foot"><span class="mk-target">${target ? `Ziel: <b>${target}</b>${pos ? ` · ${pos}` : ""}` : "Wähle ein Ziel"}</span><span class="ag-grow"></span><button class="ag-btn">Abbrechen</button><button class="ag-btn primary" ${target ? "" : "disabled"}>${ic("check", 18)}Verschieben</button></div>`;
const posSeg = (on) => `<div class="mk-pos"><span>Position in der Phase</span><div class="ag-seg small"><button class="ag-segbtn ${on === "start" ? "on" : ""}">Am Anfang</button><button class="ag-segbtn ${on === "end" ? "on" : ""}">Am Ende</button></div></div>`;

// Variante A: Baum, ein Knoten je Phase; Ziel = Anfang oder Ende der Phase
function treeA(item, mode, pick) {
  return visibleChapters(item, mode).map(([title, keys]) => `<div class="mk-chap">${title}</div>${keys.map((k) => {
    const p = PHASE[k]; const cur = here(item, mode, k); const on = pick === k;
    const n = MODES[mode].n[k] || 0;
    const group = k === "alarm" && mode === "away" ? `<div class="mk-n child"><span class="mk-dot sm"></span><button class="mk-p ${pick === "grp" ? "on" : ""}"><span class="mk-p-t"><b>Gruppe "Sirene"</b><small>Wiederholen bis deaktiviert · 3 Aktionen</small></span>${radio(pick === "grp")}</button></div>` : "";
    return `<div class="mk-n"><span class="mk-dot" style="--c:${p.color}">${ic(p.icon, 16)}</span><button class="mk-p ${on ? "on" : ""} ${cur ? "cur" : ""}" ${cur ? "" : ""}>
      <span class="mk-p-t"><b>${p.title}</b><small>${p.sub} · ${n} ${n === 1 ? "Aktion" : "Aktionen"}</small></span>${cur ? `<span class="mk-tag">hier</span>` : radio(on)}</button></div>${group}`;
  }).join("")}`).join("");
}
function variantA(item, mode, pick, pos = "end") {
  const target = pick ? (pick === "grp" ? `${MODES[mode].label} › Gruppe "Sirene"` : `${MODES[mode].label} › ${PHASE[pick].title}`) : "";
  return `<div class="mk-dlg">${head(item)}${modeSeg(mode)}<div class="mk-scroll"><div class="mk-tree">${treeA(item, mode, pick)}</div>${note(item, mode)}</div>${posSeg(pos)}${foot(target, pick ? (pos === "end" ? "am Ende" : "am Anfang") : "")}</div>`;
}

// Variante B: Baum, die gewählte Phase klappt auf und zeigt die Aktionen mit Einfügepunkten (genaue Stelle)
function variantB(item, mode, pick, slot) {
  const steps = (k) => (mode === "away" ? STEPS[k] : null) || [];
  const tree = visibleChapters(item, mode).map(([title, keys]) => `<div class="mk-chap">${title}</div>${keys.map((k) => {
    const p = PHASE[k]; const cur = here(item, mode, k); const on = pick === k; const n = MODES[mode].n[k] || 0;
    const list = on ? `<div class="mk-slots">${[...steps(k), null].map((s, i, a) => `<button class="mk-slot ${slot === i ? "on" : ""}"><span class="mk-slot-l"></span>${slot === i ? "Hier einfügen" : "einfügen"}</button>${s ? `<div class="mk-step">${s}</div>` : ""}`).join("")}${steps(k).length ? "" : ""}</div>` : "";
    return `<div class="mk-n"><span class="mk-dot" style="--c:${p.color}">${ic(p.icon, 16)}</span><div class="mk-pw"><button class="mk-p ${on ? "on" : ""} ${cur ? "cur" : ""}"><span class="mk-p-t"><b>${p.title}</b><small>${p.sub} · ${n} ${n === 1 ? "Aktion" : "Aktionen"}</small></span>${cur ? `<span class="mk-tag">hier</span>` : `<span class="mk-chev ${on ? "open" : ""}">${ic("arrowDown", 18)}</span>`}</button>${list}</div></div>`;
  }).join("")}`).join("");
  const after = pick && slot != null ? (steps(pick)[slot - 1] ? `nach "${steps(pick)[slot - 1].replace(/ \(.*/, "")}"` : slot === 0 ? "ganz am Anfang" : "ganz am Ende") : "";
  return `<div class="mk-dlg">${head(item)}${modeSeg(mode)}<div class="mk-scroll"><div class="mk-tree">${tree}</div>${note(item, mode)}</div>${foot(pick ? `${MODES[mode].label} › ${PHASE[pick].title}` : "", after)}</div>`;
}

// Variante C: Kacheln statt Baum (kompakt, zwei Spalten am Computer)
function variantC(item, mode, pick, pos = "end") {
  const tiles = visibleChapters(item, mode).map(([title, keys]) => `<div class="mk-chap">${title}</div><div class="mk-tiles">${keys.map((k) => {
    const p = PHASE[k]; const cur = here(item, mode, k); const on = pick === k; const n = MODES[mode].n[k] || 0;
    return `<button class="mk-tile ${on ? "on" : ""} ${cur ? "cur" : ""}"><span class="mk-dot flat" style="--c:${p.color}">${ic(p.icon, 18)}</span><span class="mk-p-t"><b>${p.title}</b><small>${cur ? "hier" : `${n} ${n === 1 ? "Aktion" : "Aktionen"}`}</small></span>${cur ? "" : radio(on)}</button>`;
  }).join("")}</div>`).join("");
  return `<div class="mk-dlg">${head(item)}${modeSeg(mode)}<div class="mk-scroll">${tiles}${note(item, mode)}</div>${posSeg(pos)}${foot(pick ? `${MODES[mode].label} › ${PHASE[pick].title}` : "", pick ? (pos === "end" ? "am Ende" : "am Anfang") : "")}</div>`;
}

const CSS = `
.mk-back { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.42); display: grid; place-items: center; }
.mk-dlg { width: min(880px, calc(100vw - 32px)); max-height: calc(100vh - 48px); display: flex; flex-direction: column; background: var(--ag-card); border-radius: 22px; padding: 22px 24px 18px; box-shadow: 0 10px 40px rgba(0,0,0,.3); box-sizing: border-box; }
.mk-head { display: flex; align-items: center; gap: 12px; }
.mk-head h3 { flex: 1; margin: 0; font-size: 20px; font-weight: 600; }
.mk-av { background: var(--ag-primary-soft, color-mix(in srgb, var(--ag-primary) 14%, transparent)); color: var(--ag-primary); }
.mk-what { display: flex; align-items: center; gap: 12px; margin: 14px 0 12px; padding: 10px 12px; border-radius: 14px; background: var(--ag-subtle); }
.mk-what b { display: block; font-size: 15px; } .mk-what small { color: var(--ag-text2); font-size: 12.5px; }
.mk-what-ic { background: color-mix(in srgb, #d6336c 14%, transparent); color: #d6336c; }
.mk-modes { align-self: flex-start; margin: 2px 0 14px; }
.mk-scroll { flex: 1; min-height: 0; overflow: auto; padding: 2px 2px 8px; }
.mk-chap { margin: 14px 0 8px 46px; font-size: 12.5px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: var(--ag-text2); }
.mk-chap:first-child { margin-top: 2px; }
.mk-tree { position: relative; }
.mk-tree::before { content: ""; position: absolute; left: 17px; top: 14px; bottom: 14px; width: 2px; border-radius: 2px; background: linear-gradient(var(--ag-primary), color-mix(in srgb, var(--ag-primary) 25%, transparent)); }
.mk-n { position: relative; display: flex; align-items: flex-start; gap: 12px; margin: 0 0 10px; }
.mk-n.child { margin-left: 34px; }
.mk-dot { position: relative; z-index: 1; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--c, var(--ag-primary)); box-shadow: 0 2px 6px color-mix(in srgb, var(--c, var(--ag-primary)) 40%, transparent); }
.mk-dot.sm { width: 14px; height: 14px; margin: 11px 0 0 11px; box-shadow: none; background: var(--ag-card); border: 2px solid var(--ag-primary); }
.mk-dot.flat { width: 34px; height: 34px; box-shadow: none; border-radius: 10px; }
.mk-n.child::before { content: ""; position: absolute; left: -17px; top: 17px; width: 17px; height: 2px; background: color-mix(in srgb, var(--ag-primary) 45%, transparent); }
.mk-pw { flex: 1; min-width: 0; }
.mk-p { flex: 1; width: 100%; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 52px; text-align: left; font: inherit; color: inherit; cursor: pointer; border: 1px solid var(--ag-divider); border-radius: 14px; background: var(--ag-card); box-sizing: border-box; }
.mk-p:hover { border-color: var(--ag-primary); }
.mk-p.on { border: 2px solid var(--ag-primary); padding: 9px 13px; background: color-mix(in srgb, var(--ag-primary) 6%, var(--ag-card)); }
.mk-p.cur { border-style: dashed; cursor: default; background: var(--ag-subtle); }
.mk-p.cur b, .mk-p.cur small { color: var(--ag-text2); }
.mk-p-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mk-p-t b { font-size: 15px; font-weight: 600; } .mk-p-t small { color: var(--ag-text2); font-size: 12.5px; line-height: 1.3; }
.mk-radio { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--ag-divider); display: grid; place-items: center; color: #fff; box-sizing: border-box; }
.mk-radio.on { background: var(--ag-primary); border-color: var(--ag-primary); }
.mk-tag { flex: none; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--ag-card); border: 1px solid var(--ag-divider); color: var(--ag-text2); }
.mk-chev { flex: none; display: grid; place-items: center; color: var(--ag-text2); transition: transform .2s; } .mk-chev.open { transform: rotate(180deg); color: var(--ag-primary); }
.mk-note { display: flex; align-items: flex-start; gap: 8px; margin: 12px 0 0 46px; color: var(--ag-text2); font-size: 12.5px; line-height: 1.4; }
.mk-pos { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--ag-divider); font-size: 13.5px; font-weight: 500; }
.mk-foot { display: flex; align-items: center; gap: 10px; padding-top: 14px; margin-top: 8px; border-top: 1px solid var(--ag-divider); }
.mk-pos + .mk-foot { border-top: 0; margin-top: 0; padding-top: 10px; }
.mk-target { min-width: 0; font-size: 13.5px; color: var(--ag-text2); } .mk-target b { color: var(--ag-text); font-weight: 600; }
/* B: Einfügepunkte */
.mk-slots { margin: 8px 0 2px 14px; padding-left: 14px; border-left: 2px dotted color-mix(in srgb, var(--ag-primary) 45%, transparent); }
.mk-slot { display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 8px; margin: 2px 0; font: inherit; font-size: 12.5px; color: var(--ag-text2); background: none; border: 1px dashed var(--ag-divider); border-radius: 999px; cursor: pointer; }
.mk-slot-l { width: 8px; height: 8px; border-radius: 50%; background: var(--ag-divider); }
.mk-slot.on { color: var(--ag-primary); font-weight: 600; border: 1.5px solid var(--ag-primary); background: color-mix(in srgb, var(--ag-primary) 8%, var(--ag-card)); } .mk-slot.on .mk-slot-l { background: var(--ag-primary); }
.mk-step { margin: 2px 0; padding: 8px 12px; border-radius: 10px; background: var(--ag-subtle); font-size: 13px; font-weight: 500; }
/* C: Kacheln */
.mk-chap.t { margin-left: 2px; }
.mk-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 4px; }
.mk-scroll > .mk-chap { margin-left: 2px; }
.mk-tile { display: flex; align-items: center; gap: 12px; padding: 10px 12px; min-height: 56px; text-align: left; font: inherit; color: inherit; cursor: pointer; border: 1px solid var(--ag-divider); border-radius: 14px; background: var(--ag-card); }
.mk-tile.on { border: 2px solid var(--ag-primary); padding: 9px 11px; background: color-mix(in srgb, var(--ag-primary) 6%, var(--ag-card)); }
.mk-tile.cur { border-style: dashed; background: var(--ag-subtle); cursor: default; }
.mk-scroll > .mk-note { margin-left: 2px; }
/* Knopf an der Karte */
.mk-new { outline: 2px solid color-mix(in srgb, var(--ag-primary) 60%, transparent); outline-offset: 2px; }
/* Handy */
:host([narrow]) .mk-dlg { width: 100vw; max-height: none; height: 100vh; border-radius: 0; padding: 16px 14px 14px; }
:host([narrow]) .ag-seg.mk-modes { align-self: stretch; display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 2px; } :host([narrow]) .ag-seg.mk-modes .ag-segbtn { min-width: 0; width: auto; flex-direction: column; gap: 3px; padding: 7px 2px; font-size: 11.5px; min-height: 54px; justify-content: center; }
:host([narrow]) .mk-tiles { grid-template-columns: 1fr; }
:host([narrow]) .mk-pos { flex-wrap: wrap; } :host([narrow]) .mk-foot { flex-wrap: wrap; } :host([narrow]) .mk-target { flex: 0 0 100%; }
:host([narrow]) .mk-foot > .ag-btn { flex: 1; justify-content: center; } :host([narrow]) .mk-foot > .ag-grow { display: none; }
:host([narrow]) .mk-chap { margin-left: 46px; }
`;

async function shot(name, { mobile = false, theme = "light", html = null, button = false, height = null }) {
  const s = await open(browser, { mobile, lang: "de", theme, tab: "config", prefs: { sub: "actions" } });
  await s.waitFor("return !!r.querySelector('.ag-wf-main')");
  await s.page.waitForTimeout(300);
  await s.ev(`const st=document.createElement('style'); st.textContent=arg.css; r.appendChild(st);
    if (arg.button) for (const b of r.querySelectorAll('.ag-wf-btns')) { const t=b.querySelector('[data-wf="delete"]'); if (!t) continue; const m=document.createElement('button'); m.className='ag-iconbtn mk-new'; m.setAttribute('aria-label','Verschieben'); m.title='Verschieben'; m.innerHTML=arg.icon; b.insertBefore(m, t); }
    if (arg.html) { const d=document.createElement('div'); d.className='mk-back'; d.innerHTML=arg.html; r.appendChild(d); }
    return 1`, { css: CSS, button, html, icon: mv(18) });
  if (!html) await s.ev("const m=r.querySelector('.ag-wf-main'); r.host._content.scrollTop += m.getBoundingClientRect().top - 150; return 1");
  await s.page.setViewportSize({ width: mobile ? 390 : 1400, height: height || (mobile ? 844 : 1100) });
  await s.page.waitForTimeout(300);
  await s.page.screenshot({ path: `${out}${name}.png` });
  if (html) { // das Fenster allein, für die Vergleichsbilder
    const box = await s.ev("const d=r.querySelector('.mk-dlg').getBoundingClientRect(); const f=window.frameElement?.getBoundingClientRect() || { left: 0, top: 0 }; return { x: d.left, y: d.top, w: d.width, h: d.height };");
    const fr = await s.page.evaluate(() => { const f = document.querySelector("#panel-frame").getBoundingClientRect(); return { x: f.left, y: f.top }; });
    await s.page.screenshot({ path: `${out}${name}-fenster.png`, clip: { x: Math.max(0, box.x + fr.x), y: Math.max(0, box.y + fr.y), width: box.w, height: Math.min(box.h, (height || (mobile ? 844 : 1100)) - Math.max(0, box.y + fr.y)) } });
  }
  console.log(`${name}.png`, s.errors.join(" | "));
  await s.ctx.close();
}

// Knopf: heute und neu (neuer Knopf zwischen "Duplizieren" und "Löschen", Symbol: Pfeil in die Phase; im Mockup ein vorläufiges Symbol)
await shot("heute-desktop", { height: 820 });
await shot("knopf-desktop", { button: true, height: 820 });
await shot("knopf-handy", { mobile: true, theme: "dark", button: true });

await shot("a-desktop", { html: variantA(ITEMS.health, "away", "end") });
await shot("a-handy", { mobile: true, theme: "dark", html: variantA(ITEMS.health, "away", "end") });
await shot("a-handy-ganz", { mobile: true, theme: "dark", html: variantA(ITEMS.health, "away", "end"), height: 1250 });
await shot("a-immer-aktiv-desktop", { html: variantA(ITEMS.health, "always", "report", "start") });
await shot("a-eingeschraenkt-desktop", { html: variantA(ITEMS.sound, "away", "end") });
await shot("a-eingeschraenkt-handy", { mobile: true, theme: "dark", html: variantA(ITEMS.sound, "away", "grp") });
await shot("b-handy-ganz", { mobile: true, theme: "dark", html: variantB(ITEMS.health, "away", "end", 1), height: 1500 });
await shot("c-handy-ganz", { mobile: true, theme: "dark", html: variantC(ITEMS.health, "away", "end"), height: 1250 });
await shot("b-desktop", { html: variantB(ITEMS.health, "away", "end", 1) });
await shot("b-handy", { mobile: true, theme: "dark", html: variantB(ITEMS.health, "away", "end", 1) });
await shot("c-desktop", { html: variantC(ITEMS.health, "away", "end") });
await shot("c-handy", { mobile: true, theme: "dark", html: variantC(ITEMS.health, "away", "end") });

// ---------- Vergleichsbilder: A, B und C nebeneinander, mit dem Unterschied beschriftet ----------
const LABELS = [
  ["A", "Baum, Ziel = Anfang oder Ende", "Ein Kreis je Phase. Unten der Schalter \"Am Anfang / Am Ende\"."],
  ["B", "Baum mit Einfügepunkten", "Die gewählte Phase klappt auf: ihre Aktionen mit \"Hier einfügen\" dazwischen."],
  ["C", "Kacheln statt Baum", "Zwei Spalten, keine Linie, keine Gruppe als Ziel. Schalter \"Am Anfang / Am Ende\"."],
];
async function compare(name, files, width) {
  const cols = LABELS.map(([k, t, d], i) => `<div class="col"><div class="lab"><span class="k">${k}</span><div><b>${t}</b><small>${d}</small></div></div><img src="${files[i]}"></div>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:Inter,system-ui,sans-serif;background:#eef0f3;color:#1d2330}
    .row{display:flex;gap:24px;align-items:flex-start}.col{flex:1;min-width:0}.lab{display:flex;gap:12px;align-items:center;margin-bottom:12px}
    .k{flex:none;width:44px;height:44px;border-radius:50%;background:#03a9f4;color:#fff;font-size:24px;font-weight:700;display:grid;place-items:center}
    b{display:block;font-size:19px}small{display:block;font-size:14px;color:#566;margin-top:2px;line-height:1.35}img{width:100%;border-radius:18px;box-shadow:0 4px 18px rgba(0,0,0,.2);display:block}</style><div class="row">${cols}</div>`;
  const file = `${out}_vergleich.html`;
  (await import("node:fs")).writeFileSync(file, html);
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`file://${file}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  await ctx.close();
  (await import("node:fs")).unlinkSync(file);
  console.log(`${name}.png`);
}
await compare("vergleich-desktop", ["a-desktop-fenster.png", "b-desktop-fenster.png", "c-desktop-fenster.png"].map((f) => `${out}${f}`), 2100);
await compare("vergleich-handy", ["a-handy-ganz-fenster.png", "b-handy-ganz-fenster.png", "c-handy-ganz-fenster.png"].map((f) => `${out}${f}`), 1350);

await browser.close();
await server.close?.();
process.exit(0);
