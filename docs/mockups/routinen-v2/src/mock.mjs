// Mockups "Routinen", zweite Runde (2026-11-16): Zeitplan und Routinen sind eins; Auslöser Zeitplan oder Gerät (Bedingungen mit Und/Oder und Gruppen wie bei Magic Push im Device Panel); Zustände, in denen die Routine gilt: ein Kapitel unter Konfiguration › Anlage, in dem Zustandswechsel eines Geräts von Home Assistant (zum Beispiel ein Smart Lock)
// die Anlage schalten. Die Bilder zeigen die echte Seite des Panels (HA-Nachbau, dunkel, Computer und Handy 390 px); die neuen Teile sind als Entwurf
// eingesetzt (Stile und Klassen des Panels). Erfundene Daten. Aufruf im Wurzelverzeichnis: node docs/mockups/routinen-v2/src/mock.mjs
import { fileURLToPath } from "node:url";
import { launch, open, PORT } from "../../../../tests/panel/lib.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(PORT);
const browser = await launch();

const I = {
  lock: "M18 8h-1V6A5 5 0 007 6v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9V6z",
  alert: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5z",
  flash: "M7 2v11h3v9l7-12h-4l4-8z",
  shield: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  moon: "M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.4 5.4 0 01-4.4 2.26 5.4 5.4 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  pencil: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  trash: "M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  person: "M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  toggle: "M17 7H7a5 5 0 000 10h10a5 5 0 000-10zM7 15a3 3 0 110-6 3 3 0 010 6z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
};
const ic = (n, s = 20) => `<svg class="ag-ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${I[n]}"/></svg>`;
const tile = (n, on = true) => `<span class="ag-oav ${on ? "on" : ""}">${ic(n)}</span>`;
const toggle = (on) => `<button class="ag-toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}"></button>`;
const iconBtn = (n) => `<button class="ag-iconbtn">${ic(n, 18)}</button>`;

// ----- Bausteine -----
const chip = (t, on) => `<span class="ag-chip ${on ? "on" : ""}">${t}</span>`;
const seg = (items, cur) => `<div class="ag-seg small" style="display:flex;flex-wrap:wrap">${items.map((t, i) => `<button class="${i === cur ? "on" : ""}" style="flex:1 1 auto">${t}</button>`).join("")}</div>`;
const sel = (t) => `<span class="ag-input" style="display:inline-flex;align-items:center;justify-content:space-between;gap:8px;min-width:150px;height:40px;padding:0 12px">${t}<span style="opacity:.6">▾</span></span>`;
const days = (on) => `<div style="display:flex;gap:6px;flex-wrap:wrap">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d, i) => `<span class="ag-chip ${on.includes(i) ? "on" : ""}" style="height:34px;padding:0 11px">${d}</span>`).join("")}</div>`;
const leaf = (dev, ic_, cond, extra = "") => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0"><span style="display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border:1px solid var(--ag-divider);border-radius:12px;background:var(--ag-card)">${ic(ic_, 18)}<b style="font-weight:500">${dev}</b></span>${sel(cond)}${extra}<span style="flex:1"></span>${iconBtn("trash")}</div>`;
const group = (op, leaves) => `<div style="margin:8px 0;padding:6px 12px 10px;border-left:3px solid var(--ag-primary);background:color-mix(in srgb, var(--ag-primary) 6%, transparent);border-radius:0 12px 12px 0"><div style="display:flex;align-items:center;gap:10px;margin:6px 0"><b style="font-weight:500">Gruppe</b>${seg(["Alle (und)", "Eine davon (oder)"], op)}${iconBtn("trash")}</div>${leaves}<button class="ag-btn" style="margin-top:6px">${ic("plus", 18)}Bedingung</button></div>`;
const STATES = [["Ausgangsverzögerung", "Während die Anlage scharf wird", false, "timer"], ["Anlage scharf", "Sie ist scharf, ohne Alarm", false, "shield"], ["Eingangsverzögerung", "Jemand ist hereingekommen, die Zeit läuft", false, "alert"], ["Beim Alarm", "Die Anlage alarmiert", false, "alert"], ["Anlage deaktiviert", "Standard", true, "home"]];
I.timer = "M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.96 8.96 0 0012 4a9 9 0 109 9c0-2.12-.74-4.07-1.97-5.61zM12 20a7 7 0 110-14 7 7 0 010 14z";
const states = (on, warn) => `<section class="ag-chap"><h3 class="ag-chap-t">Gilt in diesen Zuständen</h3><p class="ag-chap-h">Die Routine läuft nur, wenn die Anlage in einem der gewählten Zustände ist.</p>
  <div class="ag-card ag-setlist">${STATES.map((s, i) => `<div class="ag-setrow" style="${i === STATES.length - 1 ? "border:0" : ""}">${toggle(on.includes(i))}${tile(s[3], on.includes(i))}<div class="ag-settx"><b>${s[0]}</b><small>${s[1]}</small></div></div>`).join("")}</div>
  ${warn ? `<p class="ag-chap-h" style="margin-top:8px;color:var(--ag-error)">${ic("alert", 14)} Bei Eingangsverzögerung und Alarm dürfte die Routine die Anlage deaktivieren: so wäre ein Einbruch mit dem Schloss "wegzuschalten".</p>` : ""}</section>`;
const dann = (cur) => `<section class="ag-chap"><h3 class="ag-chap-t">Dann</h3>${seg(["Anwesend", "Abwesend", "Nacht", "Deaktivieren"], cur)}</section>`;
const safety = `<section class="ag-chap"><h3 class="ag-chap-t">Sicherheit</h3><div class="ag-card" style="padding:14px;border:1.5px solid var(--ag-error);background:var(--ag-error-soft)">
  <div style="display:flex;gap:10px;align-items:flex-start;color:var(--ag-error)">${ic("alert", 22)}<div><b>Deaktiviert ohne Code</b><div class="ag-t2" style="color:var(--ag-text);margin-top:4px">Wer den Auslöser auslösen kann (Schloss per Funk oder Cloud), deaktiviert die Anlage.</div></div></div>
  <div class="ag-setrow" style="border:0;padding-bottom:0">${toggle(true)}<div class="ag-settx"><b>Ich habe das verstanden</b></div></div></div></section>`;
const btns = `<div class="ag-dlg-btns"><button class="ag-btn">Test</button><button class="ag-btn">Abbrechen</button><button class="ag-btn primary">Speichern</button></div>`;
const head = (name) => `<h3>Routine bearbeiten</h3><section class="ag-chap"><h3 class="ag-chap-t">Name</h3><input class="ag-input" value="${name}" style="width:100%"></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Auslöser</h3>${seg(["Zeitplan", "Gerät"], 1)}</section>`;

// ----- Szenen -----
const row = (r) => `<div class="ag-setrow ag-csrow" style="${r.off ? "opacity:.6" : ""}">${toggle(!r.off)}${tile(r.icon, !r.off)}<div class="ag-settx"><b>${r.name}</b>
  <small>${r.when}</small><small>→ ${r.then}</small>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${r.tags.map((t) => `<span class="ag-tag ${t[0]}">${t[2] ? ic("alert", 13) : ""}${t[1]}</span>`).join("")}</div></div>
  <div class="ag-btnrow">${iconBtn("pencil")}${iconBtn("trash")}</div></div>`;
I.clock = "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20a8 8 0 110-16 8 8 0 010 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z";
const ROUTINES = [
  { icon: "clock", name: "Nachts scharf", when: "Jeden Tag um <em style="font-style:normal;font-weight:600;color:var(--ag-text)">22:30</em>", then: "Anlage scharf: Nacht", tags: [["none", "Nur wenn deaktiviert"], ["none", "Nächste: heute 22:30"]] },
  { icon: "clock", name: "Morgens aus", when: "Mo–Fr um <em style="font-style:normal;font-weight:600;color:var(--ag-text)">06:45</em>", then: "Anlage deaktivieren", tags: [["err", "Umgeht den Code", true], ["none", "Nur wenn scharf"]] },
  { icon: "lock", name: "Haus verlassen", when: "Wenn <em style="font-style:normal;font-weight:600;color:var(--ag-text)">Haustür-Schloss</em> abgeschlossen wird <em style="font-style:normal;font-weight:600;color:var(--ag-text)">und</em> <em style="font-style:normal;font-weight:600;color:var(--ag-text)">Diego</em> nicht zu Hause ist", then: "Anlage scharf: Abwesend", tags: [["none", "Nur wenn deaktiviert"], ["none", "Zuletzt heute 07:41"]] },
  { icon: "lock", name: "Heimkommen", when: "Wenn <em style="font-style:normal;font-weight:600;color:var(--ag-text)">Haustür-Schloss</em> aufgeschlossen wird <em style="font-style:normal;font-weight:600;color:var(--ag-text)">oder</em> <em style="font-style:normal;font-weight:600;color:var(--ag-text)">Garten-Schloss</em> aufgeschlossen wird", then: "Anlage deaktivieren", tags: [["err", "Umgeht den Code", true], ["none", "Nur wenn scharf, Ausgangs- und Eingangsverzögerung"]] },
  { icon: "person", name: "Alle weg", off: true, when: "Wenn <em style="font-style:normal;font-weight:600;color:var(--ag-text)">Diego</em> <em style="font-style:normal;font-weight:600;color:var(--ag-text)">und</em> <em style="font-style:normal;font-weight:600;color:var(--ag-text)">Anna</em> nicht mehr zu Hause sind", then: "Anlage scharf: Abwesend", tags: [["none", "Aus"]] },
];
const LIST = `<section class="ag-chap" id="mk-routines"><h3 class="ag-chap-t">Routinen</h3>
  <p class="ag-chap-h">Zu einer Zeit oder wenn ein Gerät von Home Assistant etwas tut (zum Beispiel ein Smart Lock): die Routine schaltet diese Anlage. Sie gilt nur für diese Anlage und nur in den Zuständen, die du wählst.</p>
  <div class="ag-card ag-setlist ag-codes">${ROUTINES.map(row).join("")}
    <div class="ag-setrow"><div class="ag-settx"><small>Routinen umgehen den Code. Wer den Auslöser bedienen kann, kann die Anlage so schalten.</small></div><button class="ag-btn">${ic("plus", 18)}Routine hinzufügen</button></div></div></section>`;
const GERAET = `<div class="ag-dlg-body">${head("Heimkommen")}
  <section class="ag-chap"><h3 class="ag-chap-t">Wenn</h3><div class="ag-card" style="padding:6px 14px 12px">
    <div style="display:flex;align-items:center;gap:10px;margin:8px 0">${seg(["Alle (und)", "Eine davon (oder)"], 1)}</div>
    ${leaf("Haustür-Schloss", "lock", "wird aufgeschlossen")}${leaf("Garten-Schloss", "lock", "wird aufgeschlossen")}
    ${group(0, leaf("Diego", "person", "kommt nach Hause") + leaf("Garagentor", "home", "wird geöffnet"))}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="ag-btn">${ic("plus", 18)}Bedingung</button><button class="ag-btn">${ic("plus", 18)}Gruppe</button></div>
    <div class="ag-setrow" style="border:0;margin-top:6px"><div class="ag-settx"><b>Muss mindestens</b><small>so lange gelten, bevor die Routine läuft (gegen Flattern)</small></div><span class="ag-input" style="display:inline-flex;align-items:center;height:40px;padding:0 12px;min-width:90px">5 s</span></div>
  </div><p class="ag-chap-h" style="margin-top:8px">Die Routine läuft, wenn die Bedingungen neu zutreffen, nicht bei der Rückkehr aus "nicht verfügbar".</p></section>
  ${dann(3)}${states([4], false)}${safety}${btns}</div>`;
const ZEIT = `<div class="ag-dlg-body">${head("Nachts scharf").replace('seg(["Zeitplan", "Gerät"], 1)', "")}</div>`;
const ZEITPLAN = `<div class="ag-dlg-body"><h3>Routine bearbeiten</h3><section class="ag-chap"><h3 class="ag-chap-t">Name</h3><input class="ag-input" value="Nachts scharf" style="width:100%"></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Auslöser</h3>${seg(["Zeitplan", "Gerät"], 0)}</section>
  <section class="ag-chap"><h3 class="ag-chap-t">Wann</h3><div class="ag-card" style="padding:12px 14px">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="ag-input" style="display:inline-flex;align-items:center;height:44px;padding:0 14px;font-size:18px">22:30</span>${days([0, 1, 2, 3, 4, 5, 6])}${iconBtn("trash")}</div>
    <button class="ag-btn" style="margin-top:10px">${ic("plus", 18)}Zeit hinzufügen</button></div></section>
  ${dann(2)}${states([4], false)}${btns}</div>`;
const ZUSTAND = `<div class="ag-dlg-body"><h3>Routine bearbeiten</h3>${states([0, 1, 4], true)}${btns}</div>`;

async function shot(name, mobile, scene) {
  const size = mobile ? { width: 390, height: 2200 } : { width: 1180, height: 1500 };
  const s = await open(browser, { mobile, lang: "de", theme: "dark", tab: "config", prefs: { sub: "system" }, size });
  await s.waitFor("return !!r.querySelector('.ag-chap')");
  const js = (html, dlg) => `const h=${JSON.stringify(html)}; ${dlg ? `const d=r.getElementById(${JSON.stringify(dlg)}); d.innerHTML=h; d.showModal(); d.style.maxHeight='none'; d.style.height='auto';` : `const t=[...r.querySelectorAll('.ag-chap-t')].find((e) => /Zeitplan|Schedule/.test(e.textContent)); const c=t.closest('.ag-chap'); c.insertAdjacentHTML('afterend', h); r.getElementById('mk-routines').scrollIntoView({block:'start'});`} return 1`;
  if (scene === "liste") await s.ev(js(LIST));
  if (scene === "geraet") await s.ev(js(GERAET, "ag-step"));
  if (scene === "zeitplan") await s.ev(js(ZEITPLAN, "ag-step"));
  if (scene === "zustaende") await s.ev(js(ZUSTAND, "ag-step"));
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}
for (const [name, scene] of [["1-liste", "liste"], ["2-ausloeser-geraet", "geraet"], ["3-ausloeser-zeitplan", "zeitplan"], ["4-zustaende-mit-warnung", "zustaende"]]) for (const mobile of [false, true]) await shot(name, mobile, scene);
await browser.close();
server.close();
console.log("fertig");
