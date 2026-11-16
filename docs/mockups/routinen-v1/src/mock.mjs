// Mockups "Routinen" (2026-11-16): ein Kapitel unter Konfiguration › Anlage, in dem Zustandswechsel eines Geräts von Home Assistant (zum Beispiel ein Smart Lock)
// die Anlage schalten. Die Bilder zeigen die echte Seite des Panels (HA-Nachbau, dunkel, Computer und Handy 390 px); die neuen Teile sind als Entwurf
// eingesetzt (Stile und Klassen des Panels). Erfundene Daten. Aufruf im Wurzelverzeichnis: node docs/mockups/routinen-v1/src/mock.mjs
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

// ----- Kapitel in der Liste -----
const row = (r) => `<div class="ag-setrow ag-csrow" style="${r.off ? "opacity:.6" : ""}">${toggle(!r.off)}${tile(r.icon, !r.off)}<div class="ag-settx"><b>${r.name}</b>
  <small>${r.when}</small><small>→ ${r.then}</small>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${r.tags.map((t) => `<span class="ag-tag ${t[0]}">${t[2] ? ic("alert", 13) : ""}${t[1]}</span>`).join("")}</div></div>
  <div class="ag-btnrow">${iconBtn("pencil")}${iconBtn("trash")}</div></div>`;
const ROUTINES = [
  { icon: "lock", name: "Haus verlassen", when: "Wenn <b>Haustür-Schloss</b> abgeschlossen wird", then: "Anlage scharf: Abwesend", tags: [["none", "Zuletzt heute 07:41"]] },
  { icon: "lock", name: "Heimkommen", when: "Wenn <b>Haustür-Schloss</b> aufgeschlossen wird", then: "Anlage deaktivieren", tags: [["err", "Umgeht den Code", true], ["none", "Zuletzt gestern 18:12"]] },
  { icon: "toggle", name: "Gute Nacht", when: "Wenn <b>Nachtmodus</b> (Schalter) eingeschaltet wird", then: "Anlage scharf: Nacht", tags: [["none", "Noch nie ausgelöst"]] },
  { icon: "person", name: "Alle weg", off: true, when: "Wenn <b>Diego</b> und <b>Anna</b> nicht mehr zu Hause sind", then: "Anlage scharf: Abwesend", tags: [["none", "Aus"]] },
];
const LIST = `<section class="ag-chap" id="mk-routines"><h3 class="ag-chap-t">Routinen</h3>
  <p class="ag-chap-h">Ein Gerät von Home Assistant schaltet diese Anlage, zum Beispiel ein Smart Lock beim Abschliessen. Eine Routine gilt nur für diese Anlage.</p>
  <div class="ag-card ag-setlist ag-codes">${ROUTINES.map(row).join("")}
    <div class="ag-setrow"><div class="ag-settx"><small>Routinen umgehen den Code. Wer das Gerät bedienen kann, kann die Anlage so schalten.</small></div><button class="ag-btn">${ic("plus", 18)}Routine hinzufügen</button></div></div></section>`;

// ----- Editor -----
const chip = (t, on) => `<span class="ag-chip ${on ? "on" : ""}">${t}</span>`;
const seg = (items, cur) => `<div class="ag-seg small" style="display:flex;flex-wrap:wrap">${items.map((t, i) => `<button class="${i === cur ? "on" : ""}" style="flex:1 1 auto">${t}</button>`).join("")}</div>`;
const EDITOR = `<div class="ag-dlg-body"><h3>Routine bearbeiten</h3>
  <section class="ag-chap"><h3 class="ag-chap-t">Name</h3><input class="ag-input" value="Heimkommen" style="width:100%"></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Wenn dieses Gerät …</h3>
    <div class="ag-card ag-setlist"><div class="ag-setrow" style="border:0">${tile("lock")}<div class="ag-settx"><b>Haustür-Schloss</b><small>Schloss · Eingang</small></div><button class="ag-btn">Ändern</button></div></div></section>
  <section class="ag-chap"><h3 class="ag-chap-t">… dieses passiert</h3>${seg(["Abgeschlossen", "Aufgeschlossen", "Offen"], 1)}
    <p class="ag-chap-h" style="margin-top:8px">Nur ein echter Wechsel zählt, nicht die Rückkehr aus "nicht verfügbar" (zum Beispiel nach einem Neustart).</p></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Dann</h3>${seg(["Anwesend", "Abwesend", "Nacht", "Deaktivieren"], 3)}</section>
  <section class="ag-chap"><h3 class="ag-chap-t">Sicherheit</h3><div class="ag-card" style="padding:14px;border:1.5px solid var(--ag-error);background:var(--ag-error-soft)">
    <div style="display:flex;gap:10px;align-items:flex-start;color:var(--ag-error)">${ic("alert", 22)}<div><b>Deaktiviert ohne Code</b><div class="ag-t2" style="color:var(--ag-text);margin-top:4px">Jede Öffnung des Schlosses deaktiviert die Anlage, auch per Cloud oder Funk. Das Schloss muss dafür so sicher sein wie der Code.</div></div></div>
    <div class="ag-setrow" style="border:0;padding-bottom:0">${toggle(true)}<div class="ag-settx"><b>Ich habe das verstanden</b></div></div></div></section>
  <div class="ag-dlg-btns"><button class="ag-btn">Test</button><button class="ag-btn">Abbrechen</button><button class="ag-btn primary">Speichern</button></div></div>`;

// ----- Gerät wählen -----
const dev = (n, name, sub, hit) => `<div class="ag-setrow" style="padding:10px 0">${tile(n, false)}<div class="ag-settx"><b>${name}</b><small>${sub}</small></div>${hit ? `<span class="ag-tag none">Treffer in der Kennung</span>` : ""}</div>`;
const PICKER = `<div class="ag-dlg-body"><h3>Gerät wählen</h3>
  <div style="position:relative"><input class="ag-input" type="search" value="lock.haus" style="width:100%;padding-left:40px"><span style="position:absolute;left:12px;top:12px;color:var(--ag-text2)">${ic("search", 18)}</span></div>
  <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:2px">${chip("Alle", false)}${chip("Schlösser · 3", true)}${chip("Schalter · 9", false)}${chip("Sensoren · 14", false)}${chip("Personen · 2", false)}${chip("Alle Bereiche ▾", false)}</div>
  <div class="ag-card ag-setlist" style="padding:4px 14px">${dev("lock", "Haustür-Schloss", "Schloss · Eingang", true)}${dev("lock", "Garten-Schloss", "Schloss · Terrasse", true)}</div>
  <p class="ag-chap-h">Die Suche findet auch Entitäts-IDs (zum Beispiel "lock.haus"); angezeigt wird immer nur der Name des Geräts. Gewählt wird das Gerät, nicht die Kennung.</p>
  <div class="ag-dlg-btns"><button class="ag-btn">Abbrechen</button></div></div>`;

async function shot(name, mobile, scene) {
  const size = mobile ? { width: 390, height: 844 } : { width: 1180, height: 900 };
  const s = await open(browser, { mobile, lang: "de", theme: "dark", tab: "config", prefs: { sub: "system" }, size });
  await s.waitFor("return !!r.querySelector('.ag-chap')");
  const js = (html, dlg) => `const h=${JSON.stringify(html)}; ${dlg ? `const d=r.getElementById(${JSON.stringify(dlg)}); d.innerHTML=h; d.showModal();` : `const t=[...r.querySelectorAll('.ag-chap-t')].find((e) => /Zeitplan|Schedule/.test(e.textContent)); const c=t.closest('.ag-chap'); c.insertAdjacentHTML('afterend', h); r.getElementById('mk-routines').scrollIntoView({block:'start'});`} return 1`;
  if (scene === "liste") await s.ev(js(LIST));
  if (scene === "editor") await s.ev(js(EDITOR, "ag-step"));
  if (scene === "geraet") await s.ev(js(PICKER, "ag-pick"));
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}
for (const [name, scene] of [["1-liste", "liste"], ["2-routine-bearbeiten", "editor"], ["3-geraet-waehlen", "geraet"]]) for (const mobile of [false, true]) await shot(name, mobile, scene);
await browser.close();
server.close();
console.log("fertig");
