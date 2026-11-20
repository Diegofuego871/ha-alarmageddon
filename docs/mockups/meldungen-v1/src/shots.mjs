// Mockups "Konfiguration › Meldungen" (v1, 2026-11-19, Wunsch des Nutzers 22:16 bis 22:27). Kein Test: öffnet das echte Panel im HA-Nachbau,
// lässt das Kapitel "Standard-Empfänger" stehen und ersetzt den Rest der Seite durch die Varianten, gebaut aus den Klassen des Panels (Kapitel,
// Karten, Schalter, Felder, Knöpfe) und wenigen eigenen Stilen. Erfundene Namen (Marco, Anna), keine Herstellernamen.
// Aufruf im Wurzelverzeichnis: node docs/mockups/meldungen-v1/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8972";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
const { ic, chapter } = await import("../../../../custom_components/alarmageddon/panel/common.js");
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();

// ---------- Inhalt (wie die Seite heute, HealthCheck neu bei der Wartung) ----------
const ALARM = "Standard: Empfänger von Alarmen";
const MAINT = "Standard: Empfänger von Wartungsmeldungen";
const FAULTS = [
  { icon: "alert", title: "Sensor im scharfen Zustand nicht erreichbar", hint: "Ein blinder Fleck im scharfen Zustand; mit \"Ausfall gilt als Alarm\" löst der Sensor stattdessen aus.",
    on: true, origin: ALARM, pills: ["marco", "anna"], critical: true, volume: 80, sum: "An Marco, Anna · kritisch, 80 %" },
  { icon: "doorOpen", title: "Scharfschalten nicht möglich", hint: "Ein offener Sensor verhindert das Scharfschalten.", on: true, origin: ALARM, pills: ["marco", "anna"],
    switches: [["Aktion \"Erneut versuchen\"", "Knopf unter der Meldung: schaltet denselben Modus noch einmal scharf. Gilt eine Stunde, ohne Code.", true],
      ["Aktion \"Trotzdem scharf schalten\"", "Knopf unter der Meldung: schaltet scharf, obwohl Sensoren offen sind. Gilt eine Stunde, ohne Code.", true]],
    sum: "An Marco, Anna · zwei Knöpfe" },
];
const MAINTS = [
  { icon: "battery", title: "Batterie schwach", hint: "Eine Batterie bleibt unter der Schwelle.", on: true, origin: MAINT, pills: ["marco"],
    nums: [["Schwach unter", "", "20", "%"], ["Meldung nach", "Die Wartung prüft alle 15 Minuten. Erst wenn die Batterie so oft hintereinander unter der Schwelle liegt; ein Wert darüber beginnt neu.", "3", "Prüfungen"]],
    sum: "An Marco · unter 20 % · nach 3 Prüfungen" },
  { icon: "offline", title: "Sensor nicht erreichbar", hint: "Ein Sensor antwortet länger als die eingestellte Zeit nicht.", on: false, origin: MAINT, pills: ["marco"],
    nums: [["Nicht erreichbar nach", "", "60", "Minuten"]], sum: "Aus" },
  { icon: "stethoscope", title: "Selbsttest", hint: "Ein neues Problem des Selbsttests: fehlende oder nicht erreichbare Geräte, Aktionen und Empfänger, gescheiterte Schritte. Jedes Problem einmal.",
    on: true, origin: "Eigene Empfänger für diese Meldung", own: true, pills: ["marco", "anna"], persistent: true, sum: "An Marco, Anna (eigene) · in Home Assistant stehen lassen" },
  { icon: "heartPulse", title: "HealthCheck-Dienst antwortet nicht", hint: "Ein HealthCheck-Dienst antwortet mehrmals hintereinander nicht. Einmal je Ausfall; ein Tipp darauf öffnet die Liste der Dienste.",
    on: true, origin: MAINT, pills: ["marco"], nums: [["Meldung nach", "Gescheiterte Aufrufe hintereinander. Es zählt jeder automatische Aufruf, nie der Testknopf.", "2", "Fehlversuchen"]],
    switches: [["Melden, wenn er wieder antwortet", "Einmal, beim ersten Aufruf, der wieder klappt. Dieselben Empfänger, nie kritisch.", true]], sum: "An Marco · nach 2 Fehlversuchen · auch \"wieder da\"" },
];
const MOVED = "Die Meldungen \"Scharf geschaltet\", \"Deaktiviert\", \"Eingangsverzögerung\" und \"Stiller Alarm\" stehen unter Konfiguration › Aktionen, an ihrem Punkt im Ablauf jeder Anlage.";
const FAULT_HINT = "Je Meldung: ein oder aus, Empfänger, kritisch oder nicht. Kritische Meldungen ertönen auch im Lautlos-Modus und bei \"Nicht stören\".";
const MAINT_HINT = "Schwache Batterie, nicht erreichbare Sensoren, der Selbsttest und die HealthCheck-Dienste. Jedes Problem wird einmal gemeldet.";

// ---------- Bausteine: einheitliche Zeilen (Text links, Feld rechts; Schalter links, Text rechts) ----------
const toggle = (on) => `<button class="ag-toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}"></button>`;
const num = (value, unit) => `<span class="ag-num"><input type="number" value="${value}"><span class="ag-t2">${unit}</span></span>`;
const row = (label, hint, ctl, cls = "") => `<div class="mk-row ${cls}"><b>${label}</b><div class="mk-ctl">${ctl}</div>${hint ? `<small>${hint}</small>` : ""}</div>`;
const swRow = (label, hint, on) => `<div class="mk-row sw">${toggle(on)}<b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</div>`;
const pills = (list) => `<div class="ag-rpills mk-pills">${list.map((p) => `<span class="ag-rpill">${ic("bell", 14)}<span>${p}</span><button type="button" class="ag-rx">${ic("close", 14)}</button></span>`).join("")}</div>`;
const select = () => `<select class="ag-input ag-rsel"><option>Empfänger hinzufügen …</option></select>`;
const recip = (m) => `<div class="mk-row mk-recip"><b>Empfänger</b><div class="mk-ctl">${select()}</div><small class="${m.own ? "mk-own" : ""}">${m.origin}${m.own ? " · <a class=\"ag-link\">Standard übernehmen</a>" : ""}</small>${pills(m.pills)}</div>`;
const testBtn = () => `<button class="ag-btn">${ic("play", 16)}Testmeldung senden</button>`;
const settings = (m) => `<div class="mk-cols"><div class="mk-col mk-who">${recip(m)}</div><div class="mk-col">${options(m)}</div></div>`;
const options = (m) => [
  swRow("Kritisch", "Ertönt auch im Lautlos-Modus und bei \"Nicht stören\".", Boolean(m.critical)),
  m.critical ? row("Lautstärke", "", `<span class="mk-vol"><input type="range" class="ag-range" value="${m.volume}"><b>${m.volume} %</b></span>`) : "",
  swRow("Zusätzlich in Home Assistant stehen lassen", "Erscheint in der Glocke von Home Assistant, bis jemand sie wegklickt.", Boolean(m.persistent)),
  ...(m.nums || []).map(([label, hint, value, unit]) => row(label, hint, num(value, unit))),
  ...(m.switches || []).map(([label, hint, on]) => swRow(label, hint, on)),
].join("");

// ---------- Variante A: je Meldung eine Karte mit Kopf (Unterkapitel) ----------
function cardA(m, tone) {
  return `<section class="mk-a ${m.on ? "" : "off"}" style="--mk-tone: var(${tone})">
    <header class="mk-a-head">${toggle(m.on)}<span class="mk-ico">${ic(m.icon, 20)}</span><div class="mk-a-t"><h4>${m.title}</h4><p>${m.hint}</p></div></header>
    ${m.on ? `<div class="mk-a-body">${settings(m)}</div><footer class="mk-a-foot"><small>Geht mit den gespeicherten Einstellungen hinaus.</small>${testBtn()}</footer>` : ""}</section>`;
}
const permode = `<div class="ag-pmbar mk-pm"><div class="ag-pmsw">${toggle(false)}<div class="ag-settx"><b>Einstellungen pro Modus</b><small>Aus: die Einstellungen gelten für alle Modi. Ein: "Sensor im scharfen Zustand nicht erreichbar" bekommt je Modus eigene Werte (Reiter in ihrem Unterkapitel).</small></div></div></div>`;
const moved = `<p class="ag-chap-h ag-nt-moved">${ic("info", 14)} ${MOVED}</p>`;
const variantA = () => chapter("Störungsmeldungen", `${permode}<div class="mk-stack">${FAULTS.map((m) => cardA(m, "--mk-fault")).join("")}</div>${moved}`, FAULT_HINT)
  + chapter("Wartungsmeldungen", `<div class="mk-stack">${MAINTS.map((m) => cardA(m, "--mk-maint")).join("")}</div>`, MAINT_HINT);

// ---------- Variante B: eine Liste je Kapitel, jede Meldung klappt auf ----------
function rowB(m, tone, openRow) {
  return `<div class="mk-b ${m.on ? "" : "off"} ${openRow ? "open" : ""}" style="--mk-tone: var(${tone})">
    <div class="mk-b-head">${toggle(m.on)}<span class="mk-ico">${ic(m.icon, 20)}</span><div class="mk-b-t"><h4>${m.title}</h4><small>${m.sum}</small></div>
      <button class="ag-iconbtn mk-chev">${ic(openRow ? "arrowUp" : "arrowDown", 16)}</button></div>
    ${openRow ? `<div class="mk-b-body"><p class="mk-b-hint">${m.hint}</p>${settings(m)}<div class="mk-a-foot"><small>Geht mit den gespeicherten Einstellungen hinaus.</small>${testBtn()}</div></div>` : ""}</div>`;
}
const variantB = (openIndex = 0) => chapter("Störungsmeldungen", `${permode}<div class="ag-card mk-blist">${FAULTS.map((m) => rowB(m, "--mk-fault", false)).join("")}</div>${moved}`, FAULT_HINT)
  + chapter("Wartungsmeldungen", `<div class="ag-card mk-blist">${MAINTS.map((m, i) => rowB(m, "--mk-maint", i === openIndex)).join("")}</div>`, MAINT_HINT);

// ---------- Variante C: Karten wie die festen Meldungen unter Aktionen, Einstellungen im Fenster ----------
function cardC(m, tone) {
  return `<div class="ag-card mk-c ${m.on ? "" : "off"}" style="--mk-tone: var(${tone})">${toggle(m.on)}<span class="mk-ico">${ic(m.icon, 20)}</span>
    <div class="mk-c-t"><h4>${m.title}</h4><small>${m.sum}</small></div>
    <div class="ag-wf-btns"><button class="ag-iconbtn" ${m.on ? "" : "disabled"}>${ic("play", 18)}</button><button class="ag-iconbtn">${ic("pencil", 18)}</button></div></div>`;
}
const variantC = () => chapter("Störungsmeldungen", `${permode}<div class="mk-cgrid">${FAULTS.map((m) => cardC(m, "--mk-fault")).join("")}</div>${moved}`, FAULT_HINT)
  + chapter("Wartungsmeldungen", `<div class="mk-cgrid">${MAINTS.map((m) => cardC(m, "--mk-maint")).join("")}</div>`, MAINT_HINT);
const dialogC = (m) => `<div class="mk-dlgback"><div class="mk-dlg"><div class="mk-dlg-head"><span class="mk-ico" style="--mk-tone: var(--mk-maint)">${ic(m.icon, 22)}</span><h3>${m.title}</h3>
  <button class="ag-iconbtn ag-dlg-x">${ic("close", 18)}</button></div><p class="mk-b-hint">${m.hint}</p>${swRow("Senden", "", true)}${settings(m)}
  <div class="mk-dlg-btns">${testBtn()}<span class="ag-grow"></span><button class="ag-btn">Abbrechen</button><button class="ag-btn primary">Übernehmen</button></div></div></div>`;

// ---------- Stile der Varianten (Farben und Masse aus den Variablen des Panels) ----------
const CSS = `
:host { --mk-fault: var(--ag-error); --mk-maint: #ef8a00; }
:host([dark]) { --mk-maint: #ffb74d; }
.mk-stack { display: flex; flex-direction: column; gap: 14px; }
.mk-ico { width: 40px; height: 40px; border-radius: 12px; flex: none; display: grid; place-items: center; color: var(--mk-tone); background: color-mix(in srgb, var(--mk-tone) 14%, transparent); }
.off .mk-ico { color: var(--ag-text2); background: var(--ag-subtle); }
.mk-pm { margin-bottom: 14px; }
.mk-cols { display: grid; grid-template-columns: minmax(280px, 2fr) 3fr; column-gap: 36px; }
.mk-col { min-width: 0; }
.mk-who .mk-row { border-top: 0; }
.mk-who .mk-row.mk-recip { grid-template-columns: 1fr; }
.mk-who .mk-row.mk-recip > .mk-ctl { grid-row: auto; grid-column: 1; justify-content: flex-start; margin-top: 8px; order: 3; }
.mk-who .mk-row.mk-recip > small { order: 2; }
.mk-who .mk-row.mk-recip > .mk-pills { order: 4; }
:host([narrow]) .mk-cols { grid-template-columns: 1fr; }
:host([narrow]) .mk-who .mk-row.mk-recip { grid-template-columns: 1fr auto; }
:host([narrow]) .mk-who .mk-row.mk-recip > .mk-ctl { grid-row: 1; grid-column: 2; margin-top: 0; }
:host([narrow]) .mk-col + .mk-col .mk-row:first-child { border-top: 1px solid var(--ag-divider); }
/* A */
.mk-a { background: var(--ag-card); border-radius: 18px; box-shadow: var(--ag-shadow, 0 1px 2px rgba(0,0,0,.06)); border: 1px solid var(--ag-divider); overflow: hidden; }
.mk-a-head { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-left: 4px solid var(--mk-tone); }
.mk-a.off .mk-a-head { border-left-color: var(--ag-divider); }
.mk-a-t { flex: 1; min-width: 0; }
.mk-a-t h4 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.005em; }
.mk-a-t p { margin: 3px 0 0; color: var(--ag-text2); font-size: 13px; line-height: 1.4; }
.mk-a.off .mk-a-t h4 { color: var(--ag-text2); }
.mk-a-body { padding: 0 20px; border-top: 1px solid var(--ag-divider); }
.mk-a-foot { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--ag-divider); background: var(--ag-subtle); }
.mk-a-foot small { flex: 1; color: var(--ag-text2); font-size: 12.5px; }
/* Einheitliche Zeile: Beschriftung und Feld in einer Zeile, Hinweis darunter über die ganze Breite; Schalter links */
.mk-row { display: grid; grid-template-columns: 1fr auto; column-gap: 16px; row-gap: 2px; align-items: center; padding: 12px 0; border-top: 1px solid var(--ag-divider); }
.mk-row:first-child { border-top: 0; }
.mk-row > b { font-weight: 500; font-size: 14.5px; }
.mk-row > small { grid-column: 1 / -1; color: var(--ag-text2); font-size: 12.5px; line-height: 1.4; max-width: 640px; }
.mk-row > .mk-ctl { grid-row: 1; grid-column: 2; display: flex; align-items: center; justify-content: flex-end; }
.mk-row.sw { grid-template-columns: auto 1fr; column-gap: 12px; }
.mk-row.sw > .ag-toggle { grid-row: 1; margin: 0; }
.mk-row.sw > small { grid-column: 2; }
.mk-row .mk-pills { grid-column: 1 / -1; margin-top: 8px; }
.mk-row .ag-num input { width: 72px; }
.mk-vol { display: flex; align-items: center; gap: 10px; }
.mk-vol .ag-range { width: 220px; }
.mk-vol b { font-weight: 500; min-width: 44px; text-align: right; }
.mk-own { color: var(--ag-primary) !important; }
/* B */
.mk-blist { padding: 4px 0; }
.mk-b { border-top: 1px solid var(--ag-divider); }
.mk-b:first-child { border-top: 0; }
.mk-b-head { display: flex; align-items: center; gap: 14px; padding: 14px 18px; }
.mk-b.open .mk-b-head { border-left: 4px solid var(--mk-tone); padding-left: 14px; }
.mk-b-t { flex: 1; min-width: 0; }
.mk-b-t h4 { margin: 0; font-size: 16px; font-weight: 600; }
.mk-b-t small { display: block; color: var(--ag-text2); font-size: 13px; margin-top: 2px; }
.mk-b.off .mk-b-t h4 { color: var(--ag-text2); }
.mk-chev { width: 32px; height: 32px; border: 1px solid color-mix(in srgb, var(--ag-text2) 40%, transparent); }
.mk-b-body { margin: 0 18px 14px 70px; padding: 4px 16px 0; border-radius: 14px; background: var(--ag-subtle); }
.mk-b-body .mk-a-foot { margin: 0 -16px; border-radius: 0 0 14px 14px; background: transparent; padding: 12px 0; }
.mk-b-hint { margin: 10px 0 2px; color: var(--ag-text2); font-size: 13px; line-height: 1.4; }
/* C */
.mk-cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.mk-c { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-left: 4px solid var(--mk-tone); }
.mk-c.off { border-left-color: var(--ag-divider); }
.mk-c-t { flex: 1; min-width: 0; }
.mk-c-t h4 { margin: 0; font-size: 16px; font-weight: 600; }
.mk-c-t small { display: block; color: var(--ag-text2); font-size: 13px; margin-top: 2px; }
.mk-c.off .mk-c-t h4, .mk-c.off .mk-c-t small { color: var(--ag-text2); }
.mk-dlgback { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.42); display: grid; place-items: center; }
.mk-dlg { width: min(640px, calc(100vw - 32px)); max-height: calc(100vh - 60px); overflow: auto; background: var(--ag-card); border-radius: 22px; padding: 22px 24px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
.mk-dlg-head { display: flex; align-items: center; gap: 12px; }
.mk-dlg-head h3 { flex: 1; margin: 0; font-size: 19px; font-weight: 600; }
.mk-dlg-btns { display: flex; gap: 10px; align-items: center; padding-top: 14px; border-top: 1px solid var(--ag-divider); margin-top: 6px; }
/* Handy */
:host([narrow]) .mk-a-head { padding: 14px 14px; gap: 12px; align-items: flex-start; }
:host([narrow]) .mk-a-head > .ag-toggle { margin-top: 9px; }
:host([narrow]) .mk-a-t h4 { font-size: 16px; }
:host([narrow]) .mk-a-body { padding: 0 14px; }
:host([narrow]) .mk-a-foot { padding: 10px 14px; flex-wrap: wrap; }
:host([narrow]) .mk-row .ag-rsel { max-width: 190px; }
:host([narrow]) .mk-vol .ag-range { width: 130px; }
:host([narrow]) .mk-b-head { padding: 12px 12px; gap: 12px; }
:host([narrow]) .mk-b-body { margin: 0 12px 12px; }
:host([narrow]) .mk-cgrid { grid-template-columns: 1fr; }
:host([narrow]) .mk-c { flex-wrap: wrap; padding: 14px; }
:host([narrow]) .mk-c .ag-wf-btns { width: 100%; justify-content: flex-end; }
:host([narrow]) .mk-dlg { width: 100vw; max-height: none; height: 100vh; border-radius: 0; padding: 16px; }
:host([narrow]) .mk-dlg-btns { flex-wrap: wrap; }
:host([narrow]) .mk-dlg-btns > .ag-btn:first-child { flex: 0 0 100%; justify-content: center; }
:host([narrow]) .mk-dlg-btns > .ag-grow { display: none; }
:host([narrow]) .mk-dlg-btns > .ag-btn:not(:first-child) { flex: 1; justify-content: center; }
`;

async function shot(name, { mobile = false, theme = "light", html = null, dialog = null, scrollTo = null, height = null }) {
  const s = await open(browser, { mobile, lang: "de", theme, tab: "config", prefs: { sub: "notify" } });
  await s.waitFor("return !!r.querySelector('.ag-nt .ag-chap')");
  await s.sim("window.__notify.alarm_targets = ['notify.mobile_app_diego', 'notify.mobile_app_partnerin']; window.__notify.maintenance_targets = ['notify.mobile_app_diego']; return 1");
  await s.ev("r.host._fetch(); return 1");
  await s.waitFor("return r.host._data?.notify?.maintenance_targets?.length === 1");
  await s.ev("r.host.notify.reset(); r.host.notify.render(); return 1");
  await s.page.waitForTimeout(400);
  await s.ev(`const nt=r.querySelector('.ag-nt'); const first=nt.querySelector('.ag-chap').outerHTML; if (arg.html !== null) nt.innerHTML = first + arg.html + (arg.dialog || '');
    const st=document.createElement('style'); st.textContent=arg.css; r.appendChild(st);
    // Erfundene Namen
    const w=document.createTreeWalker(r, NodeFilter.SHOW_TEXT); for (let n=w.nextNode(); n; n=w.nextNode()) n.nodeValue=n.nodeValue.replace(/diego/gi, 'marco').replace(/partnerin/g, 'anna');
    return 1`, { html, dialog, css: CSS });
  // Ganze Seite: so hoch wie der Inhalt (am Computer höchstens 2600 px)
  const full = await s.ev("return r.host._content.scrollHeight + r.host._content.getBoundingClientRect().top + 90");
  const h = height || Math.min(mobile ? 4600 : 3400, full);
  await s.page.setViewportSize({ width: mobile ? 390 : 1400, height: h });
  await s.page.waitForTimeout(300);
  if (scrollTo) await s.ev(`const el=[...r.querySelectorAll('.ag-chap-t')].find((x) => x.textContent === arg); if (el) r.host._content.scrollTop += el.getBoundingClientRect().top - 120; return 1`, scrollTo);
  await s.page.waitForTimeout(200);
  await s.page.screenshot({ path: `${out}${name}.png` });
  console.log(`${name}.png`, s.errors.join(" | "));
  await s.ctx.close();
}

await shot("heute-desktop", {});
await shot("heute-handy", { mobile: true, theme: "dark", scrollTo: "Wartungsmeldungen", height: 1700 });
await shot("a-desktop", { html: variantA() });
await shot("a-handy", { mobile: true, theme: "dark", html: variantA(), scrollTo: "Wartungsmeldungen", height: 2400 });
await shot("b-desktop", { html: variantB(0) });
await shot("b-handy", { mobile: true, theme: "dark", html: variantB(0), scrollTo: "Wartungsmeldungen", height: 1700 });
await shot("c-desktop", { html: variantC() });
await shot("c-fenster-desktop", { html: variantC(), dialog: dialogC(MAINTS[0]), height: 950 });
await shot("c-handy", { mobile: true, theme: "dark", html: variantC(), scrollTo: "Wartungsmeldungen", height: 1500 });
await shot("c-fenster-handy", { mobile: true, theme: "dark", html: variantC(), dialog: dialogC(MAINTS[0]), height: 844 });
await browser.close();
server.close();
