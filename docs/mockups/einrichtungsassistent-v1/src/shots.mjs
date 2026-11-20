// Mockups "Einrichtungsassistent" (v1, 2026-11-19, Wunsch des Nutzers 20:43). Kein Test: öffnet das echte Panel im HA-Nachbau und legt den Assistenten
// als Ebene darüber, gebaut aus den Klassen des Panels (Karten, Schalter, Kästchen, Knöpfe, Kapitel). Die Schritte "Alarmaktionen" und
// "Überwachung" zeigen den echten Editor des Reiters Aktionen, in den Assistenten verschoben: so würde er auch eingebettet. Erfundene Daten und
// Namen (Marco, Anna), keine Herstellernamen. Aufruf im Wurzelverzeichnis: node docs/mockups/einrichtungsassistent-v1/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8973";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
const { ic, esc } = await import("../../../../custom_components/alarmageddon/panel/common.js");
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();
const NOW = new Date("2026-11-19T20:50:00+01:00").getTime();
// Zauberstab (MDI "auto-fix") für den Assistenten; im Panel gibt es dieses Symbol noch nicht
const WAND = `<svg class="ag-ic" width="SZ" height="SZ" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.5,5.6L5,7L6.4,4.5L5,2L7.5,3.4L10,2L8.6,4.5L10,7L7.5,5.6M19.5,15.4L22,14L20.6,16.5L22,19L19.5,17.6L17,19L18.4,16.5L17,14L19.5,15.4M22,2L20.6,4.5L22,7L19.5,5.6L17,7L18.4,4.5L17,2L19.5,3.4L22,2M13.34,12.78L15.78,10.34L13.66,8.22L11.22,10.66L13.34,12.78M14.37,7.29L16.71,9.63C17.1,10 17.1,10.65 16.71,11.04L5.04,22.71C4.65,23.1 4,23.1 3.63,22.71L1.29,20.37C0.9,20 0.9,19.35 1.29,18.96L12.96,7.29C13.35,6.9 14,6.9 14.37,7.29Z"/></svg>`;
const wand = (size) => WAND.replaceAll("SZ", String(size));
const icon = (name, size = 18) => (name === "wand" ? wand(size) : ic(name, size));

// ---------- Schritte ----------
const STEPS = [
  { id: "modes", title: "Modi", icon: "shieldAway", summary: "Anwesend, Abwesend" },
  { id: "sensors", title: "Sensoren", icon: "sensor", summary: "10 gewählt" },
  { id: "zones", title: "Zuordnung und Eingang", icon: "door", summary: "Eingang: Haustür" },
  { id: "code", title: "Code", icon: "key", summary: "Marco" },
  { id: "notify", title: "Meldungen", icon: "bell", summary: "an marco, anna" },
  { id: "actions", title: "Alarmaktionen", icon: "power", summary: "4 Schritte" },
  { id: "monitor", title: "Überwachung", icon: "eye", summary: "1 Regel", optional: true },
];
const stepNo = (id) => STEPS.findIndex((s) => s.id === id) + 1;

// ---------- Stile des Assistenten (Vorschlag; Farben und Masse aus den Variablen des Panels) ----------
const CSS = `
.wz { position: fixed; inset: 0; z-index: 60; background: var(--ag-bg); color: var(--ag-text); display: flex; }
.wz h2 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -.005em; }
.wz p.wz-lead { margin: 8px 0 0; color: var(--ag-text2); font-size: 15px; line-height: 1.5; max-width: 760px; }
.wz-kicker { font-size: 12.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ag-primary); margin-bottom: 6px; }
/* Variante B: Seite mit Schrittliste links */
.wz-side { width: 290px; flex: none; background: var(--ag-card); border-right: 1px solid var(--ag-divider); display: flex; flex-direction: column; padding: 22px 16px 18px; gap: 18px; }
.wz-brand { display: flex; align-items: center; gap: 12px; padding: 0 6px; }
.wz-brand img { width: 40px; height: 40px; }
.wz-brand b { display: block; font-size: 16px; }
.wz-brand small { color: var(--ag-text2); font-size: 13px; }
.wz-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.wz-steps li { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 12px; color: var(--ag-text2); }
.wz-steps li.cur { background: var(--ag-primary-soft); color: var(--ag-text); }
.wz-steps li b { display: block; font-weight: 500; font-size: 14px; color: inherit; }
.wz-steps li.cur b { font-weight: 600; }
.wz-steps li small { display: block; font-size: 12px; color: var(--ag-text2); margin-top: 1px; }
.wz-dot { width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 13px; font-weight: 600;
  border: 2px solid color-mix(in srgb, var(--ag-text) 22%, transparent); color: var(--ag-text2); }
.wz-steps li.cur .wz-dot { border-color: var(--ag-primary); background: var(--ag-primary); color: #fff; }
.wz-steps li.done .wz-dot { border-color: var(--ag-success); background: var(--ag-success); color: #fff; }
.wz-steps li.done b { color: var(--ag-text); }
.wz-steps li.skip .wz-dot { border-style: dashed; }
.wz-side-foot { margin-top: auto; font-size: 12.5px; color: var(--ag-text2); line-height: 1.45; padding: 0 6px; display: flex; gap: 8px; }
.wz-side-foot .ag-ic { color: var(--ag-success); margin-top: 1px; }
.wz-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.wz-head { padding: 26px 40px 0; display: flex; gap: 16px; align-items: flex-start; }
.wz-head > div { flex: 1; min-width: 0; }
.wz-scroll { flex: 1; overflow: auto; padding: 22px 40px 28px; }
.wz-body { max-width: 1040px; display: flex; flex-direction: column; gap: 18px; }
.wz-foot { display: flex; align-items: center; gap: 10px; padding: 14px 40px; border-top: 1px solid var(--ag-divider); background: var(--ag-card); }
.wz-foot .wz-saved { color: var(--ag-text2); font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
.wz-foot .wz-saved .ag-ic { color: var(--ag-success); }
/* Handy: ganzer Bildschirm, Fortschritt oben, Knöpfe unten */
.wz.wz-m { flex-direction: column; }
.wz-mtop { padding: 10px 12px 0; display: flex; flex-direction: column; gap: 8px; background: var(--ag-bg); }
.wz-mrow { display: flex; align-items: center; gap: 8px; }
.wz-mrow small { flex: 1; color: var(--ag-text2); font-size: 13px; }
.wz-prog { display: flex; gap: 4px; }
.wz-prog span { flex: 1; height: 5px; border-radius: 3px; background: color-mix(in srgb, var(--ag-text) 12%, transparent); }
.wz-prog span.done { background: var(--ag-success); }
.wz-prog span.cur { background: var(--ag-primary); }
.wz-m .wz-scroll { padding: 14px 12px 20px; }
.wz-m h2 { font-size: 22px; }
.wz-m p.wz-lead { font-size: 14px; }
.wz-m .wz-foot { padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)); }
.wz-m .wz-foot .ag-btn { min-height: 44px; }
.wz-m .wz-foot .ag-btn.primary { flex: 1; }
/* Variante A: Fenster über dem Panel */
.wz.wz-a { background: rgba(15,23,42,.42); align-items: center; justify-content: center; }
.wz-dlg { width: min(940px, calc(100vw - 48px)); height: min(860px, calc(100vh - 48px)); background: var(--ag-card); border-radius: 24px; box-shadow: var(--ag-shadow); display: flex; flex-direction: column; overflow: hidden; }
.wz-dlg .wz-dtop { padding: 18px 26px 0; display: flex; flex-direction: column; gap: 10px; }
.wz-dlg .wz-scroll { padding: 18px 26px 22px; }
.wz-dlg .wz-foot { padding: 12px 26px; }
/* Bausteine */
.wz-info { display: flex; gap: 12px; padding: 14px 16px; border-radius: 16px; background: var(--ag-primary-soft); line-height: 1.5; font-size: 14px; }
.wz-info > .ag-ic { color: var(--ag-primary); margin-top: 2px; }
.wz-info b { font-weight: 600; }
.wz-info.warn { background: var(--ag-warning-soft); }
.wz-info.warn > .ag-ic { color: var(--ag-warning-text); }
.wz-info.ok { background: var(--ag-success-soft); }
.wz-info.ok > .ag-ic { color: var(--ag-success); }
.wz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
.wz-tile { display: flex; gap: 14px; padding: 16px; align-items: flex-start; }
.wz-tile b { display: block; font-size: 15px; }
.wz-tile small { display: block; color: var(--ag-text2); font-size: 13px; line-height: 1.45; margin-top: 2px; }
.wz-tile .ag-oav { --ag-tile: 42px; color: var(--ag-primary); background: var(--ag-primary-soft); }
.wz-num { font-size: 12px; font-weight: 700; color: var(--ag-text2); letter-spacing: .04em; display: block; margin-bottom: 2px; }
.wz-hero { display: flex; gap: 22px; align-items: center; }
.wz-hero img { width: 86px; height: 86px; flex: none; }
.wz-m .wz-hero { flex-direction: column; align-items: flex-start; gap: 12px; }
.wz-m .wz-hero img { width: 64px; height: 64px; }
.wz-facts { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--ag-text2); font-size: 13.5px; }
.wz-facts span { display: inline-flex; align-items: center; gap: 6px; }
.wz-facts .ag-ic { color: var(--ag-success); }
.wz-ex { display: block; margin-top: 6px; font-size: 12.5px; color: var(--ag-text2); }
.wz-ex i { font-style: normal; display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; }
.wz-ex i.y { color: var(--ag-success); }
.wz-ex i.n { color: var(--ag-text3); }
.wz-lock { color: var(--ag-text3); width: 44px; display: grid; place-items: center; flex: none; }
.wz-m .wz-grid { grid-template-columns: 1fr; gap: 8px; }
.wz-m .wz-tile { padding: 12px; gap: 12px; }
.wz-m .wz-tile .ag-oav { --ag-tile: 36px; }
.wz-sum .ag-setrow { align-items: center; }
.wz-sum .ag-oav { --ag-tile: 38px; }
.wz-sum .wz-val { color: var(--ag-text2); font-size: 13.5px; }
.wz-link { border: 0; background: none; color: var(--ag-primary); font: inherit; font-weight: 500; cursor: pointer; padding: 6px 4px; }
.wz-ready { display: flex; flex-wrap: wrap; gap: 8px; }
.wz-ready span { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 999px; font-size: 13px; background: var(--ag-success-soft); }
.wz-ready span.no { background: var(--ag-warning-soft); }
.wz-quick { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.wz-quick > small { color: var(--ag-text2); margin-right: 4px; }
.wz-sel { display: flex; flex-wrap: wrap; gap: 8px; }
.wz-sel .ag-chip.on { background: var(--ag-primary-soft); border-color: transparent; color: var(--ag-text); }
.wz-count { margin-left: auto; color: var(--ag-text2); font-size: 13px; }
.wz-lst { padding: 4px 0; }
.wz-lst .ag-group-label { padding: 10px 14px 4px; }
.wz-lst .ag-erow { padding: 9px 14px; }
.wz .ag-table th.z, .wz .ag-table td.z { text-align: center; }
.wz-ent { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ag-text2); }
/* Später-Fenster */
.wz-ask { position: fixed; inset: 0; z-index: 70; background: rgba(15,23,42,.42); display: grid; place-items: center; }
.wz-ask > div { width: min(460px, calc(100vw - 32px)); background: var(--ag-card); border-radius: 22px; box-shadow: var(--ag-shadow); padding: 22px; display: flex; flex-direction: column; gap: 12px; }
.wz-ask h3 { margin: 0; font-size: 19px; }
.wz-ask p { margin: 0; color: var(--ag-text2); line-height: 1.5; }
.wz-ask .ag-btn { width: 100%; min-height: 48px; justify-content: flex-start; height: auto; padding: 8px 16px; text-align: left; border-radius: 16px; }
.wz-ask .ag-btn span { display: flex; flex-direction: column; }
.wz-ask .ag-btn small { color: var(--ag-text2); font-size: 12.5px; font-weight: 400; }
.wz-ask .ag-btn.primary small { color: rgba(255,255,255,.88); }
/* Eingebetteter Editor der Aktionen: Kopfleiste nicht kleben lassen, keine Fusszeile des Reiters */
.wz .ag-stk { position: static !important; }
`;

// ---------- Teile ----------
const toggle = (on, label, extra = "") => `<button class="ag-toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" ${extra}></button>`;
const box = (on) => `<button class="ag-box ${on ? "on" : ""}" role="checkbox" aria-checked="${on}">${on ? ic("check", 18) : ""}</button>`;
const info = (iconName, html, cls = "") => `<div class="wz-info ${cls}">${ic(iconName, 20)}<div>${html}</div></div>`;
const chap = (title, body, hint = "") => `<section class="ag-chap"><h3 class="ag-chap-t">${esc(title)}</h3>${hint ? `<p class="ag-chap-h">${esc(hint)}</p>` : ""}${body}</section>`;
const settx = (title, hint) => `<div class="ag-settx"><b>${esc(title)}</b>${hint ? `<small>${hint}</small>` : ""}</div>`;
const optRow = (iconName, title, hint, on, extra = "") => `<div class="ag-orow ag-moderow"><span class="ag-oav ${on ? "on" : ""}">${icon(iconName, 20)}</span><div class="ag-otx"><b>${esc(title)}</b><small>${hint}</small>${extra}</div>${toggle(on, title)}</div>`;

function shellB(cur, { title, lead, body, back = true, next = "Weiter", skip = "", saved = true }) {
  const idx = STEPS.findIndex((s) => s.id === cur);
  const items = [`<li class="${cur === "welcome" ? "cur" : "done"}"><span class="wz-dot">${cur === "welcome" ? icon("wand", 16) : ic("check", 16)}</span><div><b>Willkommen</b></div></li>`,
    ...STEPS.map((s, i) => {
      const state = cur === "done" || i < idx ? "done" : i === idx ? "cur" : "todo";
      return `<li class="${state} ${s.optional ? "skip" : ""}"><span class="wz-dot">${state === "done" ? ic("check", 16) : i + 1}</span><div><b>${esc(s.title)}</b>${state === "done" ? `<small>${esc(s.summary)}</small>` : s.optional ? "<small>nur mit passenden Sensoren</small>" : ""}</div></li>`;
    }),
    `<li class="${cur === "done" ? "cur" : ""}"><span class="wz-dot">${ic("check", 16)}</span><div><b>Fertig</b></div></li>`];
  const kicker = cur === "welcome" ? "Einrichtungsassistent" : cur === "done" ? "Geschafft" : `Schritt ${stepNo(cur)} von ${STEPS.length}`;
  return `<div class="wz wz-b"><aside class="wz-side"><div class="wz-brand"><img src="/alarmageddon_icon.png" alt=""><div><b>Einrichtung</b><small>Anlage "Haus"</small></div></div>
      <ol class="wz-steps">${items.join("")}</ol>
      <div class="wz-side-foot">${ic("check", 16)}<span>Jeder Schritt wird mit "Weiter" gespeichert. Du kannst jederzeit unterbrechen und später weitermachen.</span></div></aside>
    <main class="wz-main"><header class="wz-head"><div><div class="wz-kicker">${kicker}</div><h2>${esc(title)}</h2>${lead ? `<p class="wz-lead">${lead}</p>` : ""}</div>
      <button class="ag-btn">${ic("close", 18)}Später</button></header>
      <div class="wz-scroll"><div class="wz-body">${body}</div></div>
      <footer class="wz-foot">${back ? `<button class="ag-btn">Zurück</button>` : ""}${saved && cur !== "welcome" ? `<span class="wz-saved">${ic("check", 16)}Schritte davor gespeichert</span>` : ""}<span class="ag-grow"></span>
        ${skip ? `<button class="ag-btn">${esc(skip)}</button>` : ""}<button class="ag-btn primary">${esc(next)}${next === "Weiter" || next === "Los geht's" ? ic("chevRight", 18) : ""}</button></footer></main></div>`;
}

function shellM(cur, { title, lead, body, back = true, next = "Weiter", skip = "" }) {
  const idx = STEPS.findIndex((s) => s.id === cur);
  const prog = STEPS.map((s, i) => `<span class="${cur === "done" || i < idx ? "done" : i === idx ? "cur" : ""}"></span>`).join("");
  const label = cur === "welcome" ? "Einrichtungsassistent" : cur === "done" ? "Geschafft" : `Schritt ${stepNo(cur)} von ${STEPS.length} · ${STEPS[idx].title}`;
  return `<div class="wz wz-m"><header class="wz-mtop"><div class="wz-mrow"><small>${esc(label)}</small><button class="ag-btn">Später</button></div>
      ${cur === "welcome" ? "" : `<div class="wz-prog">${prog}</div>`}</header>
    <div class="wz-scroll"><div class="wz-body"><div><h2>${esc(title)}</h2>${lead ? `<p class="wz-lead">${lead}</p>` : ""}</div>${body}</div></div>
    <footer class="wz-foot">${back ? `<button class="ag-btn">Zurück</button>` : ""}${skip ? `<button class="ag-btn">${esc(skip)}</button>` : ""}<button class="ag-btn primary">${esc(next)}</button></footer></div>`;
}

function shellA(cur, { title, lead, body, back = true, next = "Weiter" }) {
  const idx = STEPS.findIndex((s) => s.id === cur);
  const prog = STEPS.map((s, i) => `<span class="${i < idx ? "done" : i === idx ? "cur" : ""}"></span>`).join("");
  const label = cur === "welcome" ? "Einrichtungsassistent · Anlage \"Haus\"" : `Schritt ${stepNo(cur)} von ${STEPS.length} · ${STEPS[idx].title}`;
  return `<div class="wz wz-a"><div class="wz-dlg"><div class="wz-dtop"><div class="wz-mrow"><small>${esc(label)}</small><button class="ag-btn">${ic("close", 18)}Später</button></div>
      ${cur === "welcome" ? "" : `<div class="wz-prog">${prog}</div>`}<div><h2>${esc(title)}</h2>${lead ? `<p class="wz-lead">${lead}</p>` : ""}</div></div>
    <div class="wz-scroll"><div class="wz-body">${body}</div></div>
    <footer class="wz-foot">${back ? `<button class="ag-btn">Zurück</button>` : ""}<span class="ag-grow"></span><button class="ag-btn primary">${esc(next)}${ic("chevRight", 18)}</button></footer></div></div>`;
}

// ---------- Inhalte ----------
const welcome = (mobile) => {
  const tiles = STEPS.map((s, i) => {
    const what = { modes: "Wann die Anlage scharf ist: zu Hause, abwesend, in der Nacht.", sensors: "Türen, Fenster, Bewegung, Rauch und Wasser aus deinem Home Assistant.",
      zones: "Welcher Sensor wann auslöst und durch welche Tür du nach Hause kommst.", code: "Damit nur deaktiviert, wer den Code kennt.",
      notify: "Wer Alarm- und Wartungsmeldungen bekommt, und welche.", actions: "Was bei einem Alarm passiert: Sirene, Licht, Alarmton, Storen.",
      monitor: "Kühlschrank zu warm, Keller zu feucht: nur, wenn du solche Sensoren hast." }[s.id];
    return `<div class="ag-card wz-tile"><span class="ag-oav">${ic(s.icon, 22)}</span><div><span class="wz-num">SCHRITT ${i + 1}${s.optional ? " · WENN PASSEND" : ""}</span><b>${esc(s.title)}</b><small>${esc(what)}</small></div></div>`;
  }).join("");
  return {
    title: mobile ? "Willkommen" : "Willkommen bei Alarmageddon",
    lead: "Dieser Assistent richtet die Anlage \"Haus\" in wenigen Schritten so ein, dass sie schützt. Er fragt nur das Wichtigste und erklärt unterwegs, was es bedeutet. Alles Weitere findest du später unter Konfiguration.",
    body: `${mobile ? "" : `<div class="wz-hero"><img src="/alarmageddon_icon.png" alt=""><div class="wz-facts"><span>${ic("clock", 16)}Etwa 10 Minuten</span><span>${ic("check", 16)}Jeder Schritt wird mit "Weiter" gespeichert</span><span>${ic("undo", 16)}Alles lässt sich später ändern</span></div></div>`}
      ${mobile ? `<div class="wz-facts"><span>${ic("clock", 16)}Etwa 10 Minuten</span><span>${ic("check", 16)}Mit "Weiter" gespeichert</span><span>${ic("undo", 16)}Später änderbar</span></div>` : ""}
      <div class="wz-grid">${tiles}</div>
      ${info("info", "<b>Was eine Alarmanlage in Home Assistant kann und was nicht:</b> Sie arbeitet mit den Sensoren und Geräten, die Home Assistant schon kennt. Fällt Home Assistant, der Strom oder das Netz aus, gibt es keinen Alarm; eine Sirene mit eigenem Akku und ein HealthCheck-Dienst helfen dagegen.")}`,
    back: false, next: "Los geht's",
  };
};

const modes = () => ({
  title: "Welche Modi brauchst du?",
  lead: "Ein Modus bestimmt, welche Sensoren auslösen. Schalte ein, was zu deinem Alltag passt; jeder eingeschaltete Modus lässt sich später auch in angebundenen Systemen wählen (zum Beispiel Apple Home).",
  body: `<div class="ag-card ag-setlist">
      ${optRow("shieldHome", "Anwesend", "Du bist zu Hause. Meist lösen Türen und Fenster aus, Bewegungsmelder nicht.", true, `<span class="wz-ex"><i class="y">${ic("check", 14)}Türen und Fenster</i><i class="n">${ic("close", 14)}Bewegung</i></span>`)}
      ${optRow("shieldAway", "Abwesend", "Niemand ist zu Hause. Alles löst aus, auch Bewegung. Beim Gehen hast du Zeit, das Haus zu verlassen.", true, `<span class="wz-ex"><i class="y">${ic("check", 14)}Türen und Fenster</i><i class="y">${ic("check", 14)}Bewegung</i></span>`)}
      ${optRow("moon", "Nacht", "Alle schlafen. Wie Anwesend, dazu zum Beispiel Bewegung im Erdgeschoss.", false)}
    </div>
    ${chap("Immer aktiv", `<div class="ag-card ag-setlist">${optRow("flash", "Rauch, Wasser und Gas", "Diese Sensoren lösen in jedem Zustand aus, auch wenn die Anlage aus ist. Empfohlen.", true)}</div>`)}
    ${info("info", "Mindestens ein Modus. Ein Modus, den du später ausschaltest, behält seine Sensoren und Aktionen und bekommt sie beim Einschalten zurück.")}`,
});

const SENSORS = [
  ["Eingang", [["Haustür", "door", "Tür · Matter", true], ["Garagentor", "garage", "Garagentor · Zigbee", true]]],
  ["Wohnzimmer", [["Fenster Wohnzimmer", "window", "Fenster · Matter", true], ["Terrassentür", "door", "Tür · Matter", true], ["Bewegung Wohnzimmer", "motion", "Bewegung · Zigbee", true]]],
  ["Küche", [["Fenster Küche", "window", "Fenster · Matter", true], ["Rauchmelder Küche", "smoke", "Rauch · Zigbee", true], ["Wasser Spüle", "water", "Wasser · Zigbee", true]]],
  ["Flur", [["Bewegung Flur", "motion", "Bewegung · Matter", true]]],
  ["Keller", [["Kellertür", "door", "Tür · Zigbee", false], ["Wasser Keller", "water", "Wasser · Zigbee", true]]],
  ["Schlafzimmer", [["Fenster Schlafzimmer", "window", "Fenster · Matter", false]]],
];
const sensors = (mobile) => {
  const rows = SENSORS.map(([area, list]) => `<div class="ag-group-label">${esc(area)}</div>${list.map(([name, iconName, sub, on]) => `<button class="ag-erow ${on ? "on" : ""}" role="checkbox" aria-checked="${on}">
      <span class="ag-box ${on ? "on" : ""}">${on ? ic("check", 18) : ""}</span><span class="ag-av">${ic(iconName, 18)}</span><span style="flex:1;min-width:0"><b style="font-weight:500">${esc(name)}</b><small class="ag-t2">${esc(sub)}</small></span></button>`).join("")}`).join("");
  return {
    title: "Welche Sensoren gehören dazu?",
    lead: 'Wähle die Sensoren dieser Anlage. Wo sie auslösen, schlägt der nächste Schritt nach ihrer Art vor. Einstellungen je Sensor (zum Beispiel "Darf offen sein") gelten nach Standard und lassen sich später ändern.',
    body: `<div class="ag-tools" style="flex-wrap:wrap;gap:10px"><label class="list-search" style="${mobile ? "width:100%" : "flex:0 1 360px"}">${ic("search", 18)}<input type="search" placeholder="Sensor suchen"></label>
        <div class="wz-sel">${[["Alle", true], ["Türen & Fenster"], ["Bewegung"], ["Rauch & Wasser"], ["Weitere"]].map(([l, on]) => `<button class="ag-chip ${on ? "on" : ""}">${esc(l)}</button>`).join("")}</div>
        ${mobile ? "" : `<span class="wz-count">10 von 12 gewählt</span>`}</div>
      ${mobile ? `<div class="wz-quick"><small>10 von 12 gewählt</small><button class="wz-link">Alle in der Liste</button></div>` : ""}
      <div class="ag-card wz-lst"><div class="ag-elist" style="max-height:none;border:0">${rows}</div></div>
      ${mobile ? "" : `<div class="wz-quick"><button class="wz-link">Alle in der Liste wählen</button><button class="wz-link">Keine</button></div>`}`,
  };
};

const ZONES = [["Eingang", [["Haustür", "door", "Tür", [1, 1], 0, 1], ["Garagentor", "garage", "Garagentor", [1, 1], 0, 0]]],
  ["Wohnzimmer", [["Fenster Wohnzimmer", "window", "Fenster", [1, 1], 0, 0], ["Terrassentür", "door", "Tür", [1, 1], 0, 0], ["Bewegung Wohnzimmer", "motion", "Bewegung", [0, 1], 0, 0]]],
  ["Küche", [["Fenster Küche", "window", "Fenster", [1, 1], 0, 0], ["Rauchmelder Küche", "smoke", "Rauch", [0, 0], 1, 0], ["Wasser Spüle", "water", "Wasser", [0, 0], 1, 0]]],
  ["Flur", [["Bewegung Flur", "motion", "Bewegung", [0, 1], 0, 0]]], ["Keller", [["Wasser Keller", "water", "Wasser", [0, 0], 1, 0]]]];
const zones = (mobile) => {
  const head = mobile
    ? `<tr><th>Sensor</th><th class="z"><span title="Anwesend">${ic("shieldHome", 20)}</span></th><th class="z"><span title="Abwesend">${ic("shieldAway", 20)}</span></th><th class="z"><span title="Immer aktiv">${ic("flash", 20)}</span></th><th class="z"><span title="Eingang">${ic("doorOpen", 20)}</span></th></tr>`
    : `<tr><th>Sensor</th><th class="z">Anwesend</th><th class="z">Abwesend</th><th class="z">Immer aktiv</th><th class="z">Eingang</th></tr>`;
  const body = ZONES.map(([area, list]) => `<tr class="grp"><td colspan="5">${esc(area)} · ${list.length}</td></tr>${list.map(([name, iconName, sub, [home, away], always, entry]) => `<tr>
      <td><div class="ag-nm">${mobile ? "" : `<span class="ag-av">${ic(iconName, 18)}</span>`}<div>${esc(name)}<small>${esc(sub)}</small></div></div></td>
      <td class="z">${box(home)}</td><td class="z">${box(away)}</td><td class="z">${box(always)}</td><td class="z">${iconName === "door" || iconName === "garage" ? toggle(entry, `${name}: Eingang`) : ""}</td></tr>`).join("")}`).join("");
  const num = (v, unit) => `<span class="ag-num"><input type="number" value="${v}" inputmode="numeric"><span class="ag-t2">${unit}</span></span>`;
  return {
    title: "Wann löst welcher Sensor aus?",
    lead: "Vorschlag nach Sensorart: Türen und Fenster in jedem Modus, Bewegung nur bei Abwesend, Rauch und Wasser immer. Passe an, was nicht stimmt.",
    body: `<div class="ag-card ag-table-wrap"><table class="ag-table"><tbody>${head}${body}</tbody></table></div>
      ${info("doorOpen", "<b>Eingang:</b> die Tür, durch die du nach Hause kommst. Öffnest du sie bei scharfer Anlage, hast du Zeit zum Deaktivieren. Jeder andere Sensor löst sofort aus. Ohne Eingang löst schon das Öffnen der Haustür sofort Alarm aus.")}
      ${chap("Zeiten", `<div class="ag-card ag-setlist">
        <div class="ag-setrow">${settx("Zeit zum Verlassen (Abwesend)", "So lange kannst du nach dem Scharfschalten das Haus verlassen. Anwesend schaltet sofort scharf.")}${num(60, "s")}</div>
        <div class="ag-setrow">${settx("Zeit zum Deaktivieren", "So lange hast du nach dem Öffnen des Eingangs Zeit, die Anlage zu deaktivieren.")}${num(30, "s")}</div></div>`)}`,
  };
};

const code = (mobile) => ({
  title: "Ein Code zum Deaktivieren",
  lead: "Mit einem Code deaktiviert nur, wer ihn kennt: am Bedienteil im Panel, an der Dashboard-Karte und in angebundenen Systemen (zum Beispiel Apple Home). Ohne Code kann jede Person mit Zugang zu Home Assistant die Anlage ausschalten.",
  body: `<div class="ag-card" style="padding:18px 18px 8px;display:grid;grid-template-columns:${mobile ? "1fr" : "1fr 1fr"};gap:4px 18px">
      <label class="ag-fld"><span class="ag-label">Name</span><input class="ag-input" value="Marco"><small class="ag-t2">Steht im Protokoll und in den Meldungen ("deaktiviert von Marco").</small></label>
      <label class="ag-fld"><span class="ag-label">Benutzer in Home Assistant</span><select class="ag-input"><option>Marco</option></select><small class="ag-t2">Vorgewählt: du.</small></label>
      <div class="ag-fld"><span class="ag-label">Code (4 bis 8 Ziffern)</span><span class="ag-pwfld"><input class="ag-input" type="password" value="583914"><button class="ag-iconbtn ag-pweye">${ic("eye", 18)}</button></span></div>
      <div class="ag-fld"><span class="ag-label">Code wiederholen</span><span class="ag-pwfld"><input class="ag-input" type="password" value="583914"><button class="ag-iconbtn ag-pweye">${ic("eye", 18)}</button></span></div></div>
    ${info("check", "Der Code wird nur als Hash gespeichert und nie wieder angezeigt, auch nicht im Backup.", "ok")}
    ${info("hand", "<b>Weitere Personen:</b> jede bekommt später ihren eigenen Code unter Konfiguration › Anlage › Codes pro Person. Dann zeigt das Protokoll, wer geschaltet hat.")}`,
  skip: "Ohne Code weiter",
});

const notify = (mobile) => {
  const pill = (name) => `<span class="ag-rpill">${ic("bell", 14)}<span>${esc(name)}</span><button type="button" class="ag-rx">${ic("close", 14)}</button></span>`;
  const kind = (iconName, title, hint, on, locked = false) => `<div class="ag-mt ${on ? "" : "off"}"><div class="ag-mt-head">${locked ? `<span class="wz-lock" title="Immer an">${ic("lockClosed", 20)}</span>` : toggle(on, title)}<span class="ag-mini">${ic(iconName, 16)}</span>
      ${settx(title, hint)}</div></div>`;
  return {
    title: "Wer bekommt welche Meldungen?",
    lead: "Wähle die Handys, die Alarm- und Wartungsmeldungen bekommen, und welche Meldungen hinausgehen. Kritisch, Lautstärke, eigene Texte und Empfänger je Meldung stellst du später unter Benachrichtigungen ein.",
    body: `${chap("Empfänger", `<div class="ag-card ag-setlist">
        <div class="ag-setrow ag-recip">${settx("Alarm", "Bekommen die Alarmmeldung, kritisch, auch im Stumm-Modus.")}${mobile ? "" : ""}<div style="${mobile ? "width:100%" : "flex:0 1 420px"}"><div class="ag-rline"><select class="ag-input ag-rsel"><option>Empfänger hinzufügen …</option></select></div><div class="ag-rpills">${pill("marco")}${pill("anna")}</div></div></div>
        <div class="ag-setrow">${toggle(true, "Wartungsmeldungen an dieselben Empfänger")}${settx("Wartung an dieselben Empfänger", "Batterie, nicht erreichbare Sensoren, Selbsttest. Aus: eigene Empfänger wählen.")}</div></div>`)}
      ${chap("Welche Meldungen?", `<div class="ag-card ag-mtlist">
        ${kind("alert", "Alarm", 'Geht bei jedem Alarm hinaus, mit "Quittieren" und "Deaktivieren". Immer an.', true, true)}
        ${kind("shieldAway", "Scharf geschaltet", "Bestätigt, dass die Anlage scharf ist, und wer geschaltet hat.", false)}
        ${kind("shieldOff", "Deaktiviert", "Meldet, wer die Anlage ausgeschaltet hat.", false)}
        ${kind("window", "Scharfschalten nicht möglich", 'Ein Fenster ist offen: mit den Knöpfen "Erneut versuchen" und "Trotzdem scharf schalten".', true)}
        ${kind("offline", "Sensor im scharfen Zustand nicht erreichbar", "Ein blinder Fleck, während die Anlage scharf ist.", true)}
        ${kind("battery", "Batterie schwach", "Wenn eine Batterie über mehrere Prüfungen unter 20 % bleibt.", true)}
        ${kind("offline", "Sensor nicht erreichbar", "Ein Sensor antwortet seit einer Stunde nicht.", true)}
        ${kind("stethoscope", "Selbsttest", "Fehlt ein Gerät, ein Empfänger oder klappt ein Schritt nicht, sagt es dir der Selbsttest.", true)}</div>`)}
      <div class="ag-card ag-setlist"><div class="ag-setrow">${settx("Kommt die Meldung an?", "Sende eine Testmeldung an die Empfänger. Kritische Meldungen musst du in der Companion App auf dem Handy erlauben, sonst bleiben sie im Stumm-Modus leise.")}
        <button class="ag-btn">${ic("play", 16)}Testmeldung senden</button></div></div>`,
  };
};

const actionsIntro = (mobile) => `${info("power", "<b>Was soll bei einem Alarm passieren?</b> Füge Schritte hinzu: Sirene, Licht, Alarmton auf Medienplayern, Storen. Jeder Schritt hat einen Play-Knopf zum Ausprobieren. Ohne eigene Schritte geht trotzdem die Alarmmeldung an die Empfänger.")}
  <div class="wz-quick"><small>Schnell hinzufügen:</small>${["Sirene 3 Minuten", "Licht an", "Alarmton"].map((x) => `<button class="ag-chip">${ic("plus", 16)}${esc(x)}</button>`).join("")}</div>`;

const monitorIntro = (mobile) => `${info("eye", "<b>Gefunden: 3 Sensoren, die sich für die Überwachung eignen.</b> Die Überwachung meldet, was nichts mit Einbruch zu tun hat, zum Beispiel einen Kühlschrank, der zu warm wird, oder einen feuchten Keller. Sie löst nie den Alarm aus. Dieser Schritt erscheint nur, wenn es solche Sensoren gibt.")}
  <div class="ag-card ag-setlist"><div class="ag-setrow">${toggle(true, "Überwachung verwenden")}${settx("Überwachung verwenden", "Aus: der Schritt wird übersprungen, einschalten lässt sie sich später unter Konfiguration › Anlage › Modi.")}</div>
    <div class="ag-setrow" style="flex-wrap:wrap">${settx("Sensoren", "")}<div class="wz-sel">${[["Temperatur Kühlschrank", true, "thermo"], ["Luftfeuchtigkeit Keller", true, "smoke"], ["CO2 Wohnzimmer", false, "gauge"]].map(([l, on, i]) => `<button class="ag-chip ${on ? "on" : ""}">${ic(on ? "check" : i, 16)}${esc(l)}</button>`).join("")}</div></div></div>`;

const done = (mobile) => {
  const row = (iconName, title, value, step) => `<div class="ag-setrow"><span class="ag-oav on">${ic(iconName, 20)}</span><div class="ag-settx"><b>${esc(title)}</b><small class="wz-val">${esc(value)}</small></div><button class="wz-link">Ändern</button></div>`;
  return {
    title: "Die Anlage \"Haus\" ist bereit",
    lead: "Das Wichtigste ist eingerichtet. Probiere es aus, bevor du dich darauf verlässt.",
    body: `<div class="ag-card ag-setlist wz-sum">
        ${row("shieldAway", "Modi", "Anwesend, Abwesend · Rauch, Wasser und Gas immer aktiv", "modes")}
        ${row("sensor", "Sensoren", "10 Sensoren · Eingang: Haustür, 30 s · Verlassen: 60 s", "sensors")}
        ${row("key", "Code", "Marco", "code")}
        ${row("bell", "Meldungen", "an marco, anna · 6 von 8 Meldungen an", "notify")}
        ${row("power", "Alarmaktionen", "Push-Meldung, Sirene 3 Minuten, Licht an, Licht aus · für alle Modi gleich", "actions")}
        ${row("eye", "Überwachung", "Kühlschrank zu warm (über 8 °C, 30 Minuten)", "monitor")}</div>
      ${chap("Ausprobieren", `<div class="ag-card ag-setlist">
        <div class="ag-setrow">${settx("Alarmaktionen testen", "Führt die Schritte ohne Alarm aus, höchstens 60 Sekunden. Die Sirene ertönt wirklich.")}<button class="ag-btn">${ic("play", 16)}Testen</button></div>
        <div class="ag-setrow">${settx("Testmeldung", "An marco und anna.")}<button class="ag-btn">${ic("play", 16)}Senden</button></div>
        <div class="ag-setrow" style="flex-wrap:wrap">${settx("Bereit zum Scharfschalten", "Was jetzt offen ist, verhindert das Scharfschalten.")}<div class="wz-ready"><span>${ic("check", 14)}Anwesend</span><span class="no">${ic("window", 14)}Abwesend: Fenster Küche offen</span></div></div></div>`)}
      ${chap("Wenn du mehr willst", `<div class="wz-grid">${[["groups", "Routinen", "Automatisch scharf schalten, zum Beispiel um 23 Uhr oder wenn das Schloss abschliesst."],
        ["hand", "Weitere Codes", "Je Person ein Code, damit das Protokoll zeigt, wer geschaltet hat."],
        ["heartPulse", "HealthCheck-Dienste", "Ein Dienst ausserhalb meldet, wenn Home Assistant selbst ausfällt."],
        ["viewOptions", "Dashboard-Karte", "Bedienteil und Status auf jedem Dashboard, auch für Personen ohne Panel."]].map(([i, t, s]) => `<div class="ag-card wz-tile"><span class="ag-oav">${ic(i, 22)}</span><div><b>${esc(t)}</b><small>${esc(s)}</small></div></div>`).join("")}</div>`)}`,
    next: "Fertig", back: true,
  };
};

// ---------- Aufnahme ----------
async function shot(name, { mobile = false, variant = "b", sub = "system", query = "", tall = 0, build, move = null, prepare = null, ask = false, scrollTo = null }) {
  const size = mobile ? { width: 390, height: tall || 844 } : { width: 1440, height: tall || 960 };
  const s = await open(browser, { mobile, lang: "de", theme: mobile ? "dark" : "light", tab: "config", prefs: { sub }, query, fixedTime: NOW, size,
    context: mobile ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { deviceScaleFactor: 1 } });
  await s.page.waitForTimeout(700);
  if (prepare) await prepare(s);
  const content = build(mobile);
  const html = (mobile ? shellM : variant === "a" ? shellA : shellB)(content.id, content);
  await s.frame.evaluate(([css, markup, mv, withAsk]) => {
    const r = document.querySelector("alarmageddon-panel").shadowRoot;
    const style = document.createElement("style");
    style.textContent = css;
    r.appendChild(style);
    const wrap = document.createElement("div");
    wrap.innerHTML = markup;
    const wz = wrap.firstElementChild;
    r.appendChild(wz);
    // Echter Editor des Reiters (Aktionen, Überwachung): in den Assistenten verschoben, ohne die Fusszeile des Reiters
    if (mv) {
      const body = wz.querySelector(".wz-body");
      const pane = r.querySelector(".ag-view .ag-pane");
      for (const child of [...pane.children]) {
        if (child.classList.contains("ag-foot")) continue;
        if (mv === "monitor" && child.classList.contains("ag-wf-head")) continue;
        body.appendChild(child);
      }
      body.querySelector('.ag-wf-head [data-trigger="night"]')?.remove();
      const quick = body.querySelector(".wz-quick");
      const head = body.querySelector(".ag-wf-head");
      if (quick && head) head.after(quick);
      if (mv === "monitor") {
        const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeValue = n.nodeValue.replace("Garagentor ist offen", "Kühlschranktür ist offen");
      }
    }
    if (withAsk) {
      const a = document.createElement("div");
      a.className = "wz-ask";
      a.innerHTML = withAsk;
      r.appendChild(a);
    }
    // Erfundene Namen, keine Herstellernamen (CLAUDE.md)
    const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      n.nodeValue = n.nodeValue.replaceAll("Diego", "Marco").replaceAll("diego", "marco").replaceAll("partnerin", "anna").replaceAll("Sonos", "Lautsprecher");
    }
  }, [CSS, html, move, ask ? askHtml(mobile) : ""]);
  if (scrollTo) await s.frame.evaluate((sel) => {
    const r = document.querySelector("alarmageddon-panel").shadowRoot;
    const sc = r.querySelector(".wz-scroll");
    const el = r.querySelector(sel);
    sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12;
  }, scrollTo);
  await s.page.waitForTimeout(400);
  const file = `${out}${name.replace(/^b-/, "")}-${mobile ? "handy" : "desktop"}.png`;
  await s.page.screenshot({ path: file });
  console.log(file.split("/").pop(), s.errors.length ? s.errors.join(" | ") : "");
  await s.ctx.close();
}

const askHtml = () => `<div><h3>Assistent später fortsetzen?</h3>
  <p>Was du mit "Weiter" gespeichert hast, bleibt. Du findest den Assistenten jederzeit unter Konfiguration › Anlage › Einrichtungsassistent.</p>
  <button class="ag-btn primary">${ic("clock", 18)}<span>Morgen wieder anzeigen<small>beim ersten Öffnen ab morgen</small></span></button>
  <button class="ag-btn">${ic("eyeOff", 18)}<span>Nicht mehr anzeigen<small>starten nur noch unter Konfiguration › Anlage</small></span></button>
  <button class="ag-btn">${ic("undo", 18)}Weiter einrichten</button></div>`;

const withId = (id, f) => (mobile) => ({ id, ...f(mobile) });
const actionsStep = (mobile) => ({ id: "actions", title: "Was passiert bei einem Alarm?", lead: "", body: actionsIntro(mobile) });
const monitorStep = (mobile) => ({ id: "monitor", title: "Überwachung", lead: "", body: monitorIntro(mobile) });
const openActions = async (s) => { await s.ev("r.querySelector('[data-sub=\"actions\"]').click(); return 1"); await s.page.waitForTimeout(900); };
const openMonitor = async (s) => { await openActions(s); await s.ev("r.querySelector('[data-trigger=\"monitor\"]')?.click(); return 1"); await s.page.waitForTimeout(900); };

for (const mobile of [false, true]) {
  await shot("willkommen", { mobile, build: withId("welcome", welcome), tall: mobile ? 1500 : 1000 });
  await shot("spaeter", { mobile, build: withId("welcome", welcome), ask: true });
  await shot("modi", { mobile, build: withId("modes", modes), tall: mobile ? 1250 : 0 });
  await shot("sensoren", { mobile, build: withId("sensors", sensors), tall: mobile ? 1500 : 1180 });
  await shot("zuordnung", { mobile, build: withId("zones", zones), tall: mobile ? 1650 : 1280 });
  await shot("code", { mobile, build: withId("code", code), tall: mobile ? 1350 : 0 });
  await shot("meldungen", { mobile, build: withId("notify", notify), tall: mobile ? 2000 : 1350 });
  await shot("aktionen", { mobile, build: actionsStep, move: "actions", prepare: openActions, tall: mobile ? 1700 : 1350 });
  await shot("aktionen-alarm", { mobile, build: actionsStep, move: "actions", prepare: openActions, tall: mobile ? 1700 : 1350, scrollTo: ".ag-wf-line.ag-wf-main" });
  await shot("ueberwachung", { mobile, build: monitorStep, move: "monitor", prepare: openMonitor, query: "&monitor=1", tall: mobile ? 1500 : 1100 });
  await shot("fertig", { mobile, build: withId("done", done), tall: mobile ? 1900 : 1250 });
}
// Variante A (Fenster über dem Panel), nur am Computer: Willkommen und Alarmaktionen
await shot("a-willkommen", { variant: "a", build: withId("welcome", welcome), sub: "sensors", tall: 960 });
await shot("a-aktionen", { variant: "a", build: actionsStep, move: "actions", prepare: openActions, sub: "sensors", tall: 960 });

// Kapitel unter Konfiguration › Anlage, vor "Anlage löschen"
for (const mobile of [false, true]) {
  const size = mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 };
  const s = await open(browser, { mobile, lang: "de", theme: mobile ? "dark" : "light", tab: "config", prefs: { sub: "system" }, fixedTime: NOW, size,
    context: mobile ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {} });
  await s.page.waitForTimeout(800);
  const chapterHtml = chap("Einrichtungsassistent", `<div class="ag-card ag-setlist ag-codes"><div class="ag-setrow ag-rtsum"><span class="ag-oav on" style="color:var(--ag-primary);background:var(--ag-primary-soft)">${wand(20)}</span>
      <div class="ag-settx"><b>Abgeschlossen am 19.11.2026</b><small>Führt Schritt für Schritt durch Modi, Sensoren, Code, Meldungen und Aktionen. Was eingerichtet ist, bleibt und lässt sich anpassen.</small></div>
      <div class="ag-btnrow"><button class="ag-btn">${wand(18)}Assistent starten</button></div></div></div>`, "Für neue Anlagen öffnet er sich von selbst, einmal je Anlage.");
  await s.frame.evaluate(([markup, css]) => {
    const r = document.querySelector("alarmageddon-panel").shadowRoot;
    const style = document.createElement("style");
    style.textContent = css;
    r.appendChild(style);
    const chaps = [...r.querySelectorAll(".ag-sys-form > .ag-chap")];
    const last = chaps.at(-1);
    const wrap = document.createElement("div");
    wrap.innerHTML = markup;
    const el = wrap.firstElementChild;
    el.style.outline = "2px dashed var(--ag-primary)";
    el.style.outlineOffset = "8px";
    el.style.borderRadius = "14px";
    last.before(el);
    r.host._content.scrollTop = el.offsetTop - 140;
    const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) n.nodeValue = n.nodeValue.replaceAll("Diego", "Marco");
  }, [chapterHtml, CSS]);
  await s.page.waitForTimeout(300);
  await s.page.screenshot({ path: `${out}anlage-kapitel-${mobile ? "handy" : "desktop"}.png` });
  console.log(`anlage-kapitel-${mobile ? "handy" : "desktop"}.png`);
  await s.ctx.close();
}
await browser.close();
server.close();
