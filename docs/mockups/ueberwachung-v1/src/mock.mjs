// Mockups "Überwachung" (2026-11-16): eigener Bereich neben Anwesend, Abwesend, Nacht und Immer aktiv für Messwerte (Temperatur, Luftfeuchtigkeit, CO2)
// und Ja/Nein-Sensoren, mit eigenem Ablauf je Regel, unabhängig vom Alarm. Die Bilder zeigen die echte Seite (HA-Nachbau, hell, Computer und Handy 390 px),
// die neuen Teile sind Entwurf. Erfundene Daten. Aufruf im Wurzelverzeichnis: node docs/mockups/ueberwachung-v1/src/mock.mjs
import { fileURLToPath } from "node:url";
import { launch, open, PORT } from "../../../../tests/panel/lib.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(PORT);
const browser = await launch();

const I = {
  therm: "M15 13V5A3 3 0 009 5v8a5 5 0 106 0m-3-9a1 1 0 011 1v3h-2V5a1 1 0 011-1z",
  drop: "M12,3.25C12,3.25 6,10 6,14C6,17.32 8.69,20 12,20A6,6 0 0,0 18,14C18,10 12,3.25 12,3.25Z",
  co2: "M7 8a3 3 0 100 8h2v-2H7a1 1 0 010-4h2V8H7zm8 0a3 3 0 100 8 3 3 0 000-8zm0 2a1 1 0 110 4 1 1 0 010-4z",
  door: "M8,3C6.89,3 6,3.89 6,5V21H18V5C18,3.89 17.11,3 16,3H8M8,5H16V19H8V5M13,11V13H15V11H13Z",
  bell: "M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  copy: "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z",
  trash: "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  eye: "M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z",
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3Z",
  repeat: "M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
};
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><path fill="currentColor" d="${I[n]}"/></svg>`;

const CSS = `<style>
.mk * { box-sizing: border-box; }
.mk-tile { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: var(--ag-subtle); color: var(--ag-text2); flex: none; }
.mk-card { border: 1px solid var(--ag-divider); border-radius: 18px; background: var(--ag-card); padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
.mk-rule { display: flex; gap: 12px; align-items: flex-start; }
.mk-rule + .mk-rule { margin-top: 12px; }
.mk-t { font-weight: 600; } .mk-s { font-size: 13px; color: var(--ag-text2); margin-top: 3px; line-height: 1.4; }
.mk-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.mk-tag { display: inline-flex; gap: 6px; align-items: center; min-height: 24px; padding: 2px 10px; border-radius: 999px; font-size: 12px; background: var(--ag-subtle); color: var(--ag-text2); }
.mk-tag.warn { background: #fff3e0; color: #b45309; } .mk-tag.ok { background: #e8f5e9; color: #2e7d32; }
.mk-btns { display: flex; gap: 6px; margin-left: auto; flex: none; }
.mk-ib { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--ag-divider); background: var(--ag-card); display: grid; place-items: center; color: var(--ag-text2); }
.mk-btn { display: inline-flex; gap: 8px; align-items: center; height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--ag-divider); background: var(--ag-card); color: var(--ag-text); font: inherit; }
.mk-btn.primary { background: var(--ag-primary); color: #fff; border-color: transparent; }
.mk-field { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--ag-divider); background: var(--ag-card); }
.mk-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 6px 0; }
.mk-chip { display: inline-flex; gap: 8px; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid var(--ag-divider); border-radius: 12px; background: var(--ag-card); font-weight: 500; }
/* Ablauf mit Zonenfarben wie in den Aktionen */
.mk-flow { display: flex; flex-direction: column; }
.mk-head { display: flex; gap: 12px; align-items: center; margin: 4px 0; }
.mk-head .mk-tile { background: color-mix(in srgb, var(--z) 25%, var(--ag-card)); color: color-mix(in srgb, var(--z) 70%, #000); }
.mk-link { margin-left: 18px; width: 2px; height: 14px; background: var(--ag-primary); }
.mk-step { --z: #ffb74d; margin: 0 0 0 0; border-radius: 18px; border: 1px solid var(--ag-divider); background: linear-gradient(100deg, color-mix(in srgb, var(--z) 22%, var(--ag-card)) 0%, var(--ag-card) 70%); padding: 12px 16px; display: flex; gap: 12px; align-items: center; }
.mk-step.ok { --z: #81c784; }
.mk-step .mk-tile { background: rgba(255,255,255,.7); color: #0288d1; }
.mk-plus { display: flex; gap: 10px; align-items: center; color: var(--ag-text2); font-size: 12.5px; }
.mk-plus b { width: 28px; height: 28px; border-radius: 50%; border: 1.5px dashed var(--ag-primary); display: grid; place-items: center; color: var(--ag-primary); }
@media (max-width: 480px) { .mk-rule { flex-wrap: wrap; } .mk-btns { margin-left: 50px; } }
</style>`;
const tag = (t, c = "") => `<span class="mk-tag ${c}">${t}</span>`;
const ib = (n) => `<span class="mk-ib">${ic(n, 18)}</span>`;

const RULES = [
  ["therm", "Kühlschrank zu warm", "Wenn <b>Kühlschrank Küche: Temperatur</b> über <b>8 °C</b> liegt, länger als <b>30 Minuten</b>", [tag("Push an Anna, Marco"), tag("Erinnerung alle 4 h"), tag("Entwarnung", "ok")]],
  ["door", "Kühlschranktür offen", "Wenn <b>Kühlschrank Küche: Tür</b> offen ist, länger als <b>5 Minuten</b>", [tag("Push an Anna, Marco"), tag("Erinnerung alle 15 Min")]],
  ["co2", "Büro: Luft verbraucht", "Wenn <b>Büro: CO2</b> über <b>1200 ppm</b> liegt, länger als <b>10 Minuten</b>, <b>und</b> es Mo–Fr 08:00–18:00 ist", [tag("Push an Marco"), tag("Entwarnung", "ok")]],
  ["drop", "Keller feucht", "Wenn <b>Keller: Luftfeuchtigkeit</b> über <b>70 %</b> liegt, länger als <b>1 Stunde</b>", [tag("Push an Anna, Marco"), tag("Gerät schalten: Entfeuchter an"), tag("Ausgeschaltet", "warn")]],
];
const ruleCard = (r) => `<div class="mk-card mk-rule"><span class="mk-tile">${ic(r[0])}</span><div style="min-width:0;flex:1 1 200px"><div class="mk-t">${r[1]}</div><div class="mk-s">${r[2]}</div><div class="mk-tags">${r[3].join("")}</div></div><div class="mk-btns">${ib("copy")}${ib("pencil")}${ib("trash")}</div></div>`;

// Aktionen-Seite: fünfter Reiter "Überwachung", die Inhalte darunter werden ersetzt
const tab = (body, note = "Die Überwachung läuft immer, auch bei deaktivierter Anlage. Sie löst nie die Sirene aus.") => `
  const seg = r.querySelector('[data-seg="wf-trigger"]');
  seg.insertAdjacentHTML('beforeend', '<button role="tab" class="on" aria-selected="true"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="${I.eye}"/></svg><span>Überwachung</span></button>');
  [...seg.querySelectorAll('button')].slice(0, -1).forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-selected', 'false'); });
  const card = seg.closest('.ag-card') || seg.parentElement;
  const note = [...card.querySelectorAll('*')].find((e) => /Alles darunter gilt/.test(e.textContent) && e.children.length < 3);
  if (note) note.innerHTML = ${JSON.stringify(ic("eye", 16) + " " + note)};
  const par = r.querySelector('.ag-wf-chap').parentElement;
  [...par.children].forEach((c) => { if (!c.contains(seg)) c.style.display = 'none'; });
  par.insertAdjacentHTML('beforeend', ${JSON.stringify(CSS + `<div class="mk">${body}</div>`)});`;

const LIST = `<section class="ag-chap"><h3 class="ag-chap-t">Regeln</h3><p class="ag-chap-h">Sobald eine Bedingung eine Weile zutrifft, läuft der Ablauf der Regel, und wenn sie wieder vorbei ist, der zweite. Für Messwerte (Temperatur, Luftfeuchtigkeit, CO2) und für Ja/Nein-Sensoren.</p>
  ${RULES.map(ruleCard).join("")}<div style="margin-top:14px"><span class="mk-btn">${ic("plus", 18)}Regel hinzufügen</span></div></section>`;

const step = (cls, icon, title, sub) => `<div class="mk-step ${cls}"><span class="mk-tile">${ic(icon)}</span><div><div class="mk-t">${title}</div><div class="mk-s" style="margin-top:2px">${sub}</div></div></div>`;
const plus = (t) => `<div class="mk-plus" style="margin:10px 0 0 0"><b>${ic("plus", 16)}</b>${t}</div>`;
// Variante B: je Regel ein Ablauf wie in den Aktionen, mit den Zonenfarben
const FLOW = `<section class="ag-chap"><h3 class="ag-chap-t">Kühlschrank zu warm</h3><p class="ag-chap-h">Temperatur über 8 °C, länger als 30 Minuten.</p>
  <div class="mk-flow">
    <div class="mk-head" style="--z:#ffb74d"><span class="mk-tile">${ic("therm")}</span><div><div class="mk-t">Ausserhalb der Grenzen</div><div class="mk-s" style="margin:0">Kühlschrank Küche: Temperatur über 8 °C seit 30 Min</div></div></div>
    <div class="mk-link"></div>
    ${step("", "bell", "Push-Meldung", "\"{sensor}: {value} {unit}, Grenze {limit} {unit}, seit {since}\" · Anna, Marco")}
    <div class="mk-link"></div>${step("", "repeat", "Erinnerung", "Alle 4 Stunden, solange es anhält · Push")}
    ${plus("Weitere Aktion, zum Beispiel ein Gerät schalten")}
    <div style="height:22px"></div>
    <div class="mk-head" style="--z:#81c784"><span class="mk-tile">${ic("check")}</span><div><div class="mk-t">Wieder in Ordnung</div><div class="mk-s" style="margin:0">Unter 7 °C (1 °C Rückkehr-Spanne)</div></div></div>
    <div class="mk-link"></div>
    ${step("ok", "bell", "Push-Meldung", "\"{sensor} ist wieder in Ordnung: {value} {unit}\" · Anna, Marco")}
    ${plus("Weitere Aktion")}
  </div></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Kühlschranktür offen</h3><p class="ag-chap-h">Tür offen, länger als 5 Minuten.</p>
  <div class="mk-flow"><div class="mk-head" style="--z:#ffb74d"><span class="mk-tile">${ic("door")}</span><div><div class="mk-t">Ausserhalb der Grenzen</div></div></div><div class="mk-link"></div>${step("", "bell", "Push-Meldung", "\"Kühlschranktür offen seit {since}\" · Anna, Marco")}</div></section>`;

// Editor der Regel (Variante A): Fenster mit Name, Bedingung, Dauer, zwei Abläufen
const EDITOR = `<div class="ag-dlg-body mk"><h3>Regel bearbeiten</h3>
  <section class="ag-chap"><h3 class="ag-chap-t">Name</h3><div class="mk-field">Kühlschrank zu warm</div></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Bedingung</h3><div class="mk-card" style="padding:8px 14px 14px">
    <div class="mk-line"><span class="mk-chip">${ic("therm", 18)}Kühlschrank Küche: Temperatur</span><span class="mk-field" style="min-width:150px;justify-content:space-between">liegt über <span>▾</span></span><span class="mk-field" style="width:110px">8 °C</span></div>
    <div class="mk-s" style="margin-top:8px">Auch "unter", "ausserhalb von … bis …" und bei Ja/Nein-Sensoren "ist an / aus". Mehrere Bedingungen mit Und/Oder und Gruppen wie bei den Routinen, dazu "Anlage ist scharf in Modus …".</div>
    <div class="mk-line" style="margin-top:8px"><div><b>Muss gelten, länger als</b><div class="mk-s" style="margin:0">gegen kurze Ausreisser, zum Beispiel eine offene Tür</div></div><span class="mk-field" style="width:110px;margin-left:auto">30 Min</span></div>
    <div class="mk-line"><div><b>Wieder in Ordnung unter</b><div class="mk-s" style="margin:0">damit es nicht dauernd hin und her meldet</div></div><span class="mk-field" style="width:110px;margin-left:auto">7 °C</span></div></div></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Wenn ausserhalb</h3>${step("", "bell", "Push-Meldung", "\"{sensor}: {value} {unit}, Grenze {limit} {unit}, seit {since}\"")}${plus("Aktion hinzufügen")}
    <div class="mk-line" style="margin-top:10px"><b>Erinnerung</b><span class="mk-field" style="margin-left:auto">alle 4 Stunden ▾</span></div></section>
  <section class="ag-chap"><h3 class="ag-chap-t">Wenn wieder in Ordnung</h3>${step("ok", "bell", "Push-Meldung", "\"{sensor} ist wieder in Ordnung: {value} {unit}\"")}${plus("Aktion hinzufügen")}</section>
  <div class="ag-dlg-btns"><span class="mk-btn">Abbrechen</span><span class="mk-btn primary">${ic("check", 18)}Speichern</span></div></div>`;

async function shot(name, mobile, run, dialog = false, anlage = false) {
  const size = mobile ? { width: 390, height: 2600 } : { width: 1180, height: 1500 };
  const s = await open(browser, { mobile, lang: "de", theme: "light", tab: "config", prefs: { sub: anlage ? "system" : "actions" }, size });
  await s.waitFor(anlage ? "return !!r.querySelector('[data-sys=\"mode\"]')" : "return !!r.querySelector('.ag-wf-chap')");
  await s.ev(run);
  await s.page.waitForTimeout(500);
  if (dialog) {
    const box = await s.ev("const d=r.getElementById('ag-step'); const b=d.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }");
    await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png`, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.w, size.width), height: Math.min(box.h, size.height) } });
  } else await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png`, fullPage: false, clip: { x: 0, y: 0, width: size.width, height: mobile ? 2000 : 1100 } });
  await s.ctx.close();
}

const dlg = (html) => `const d=r.getElementById('ag-step'); d.innerHTML=${JSON.stringify(CSS + html)}; d.showModal(); d.style.maxHeight='none'; d.style.height='auto'; return 1`;
const modes = `const rows=[...r.querySelectorAll('.ag-orow')]; const last=rows[rows.length-1]; last.insertAdjacentHTML('afterend', ${JSON.stringify(`<div class="ag-orow ag-moderow"><span class="ag-oav on">${ic("eye", 20)}</span><div class="ag-otx"><b>Überwachung</b><small>Eigene Regeln für Temperatur, Luftfeuchtigkeit, CO2 und Ja/Nein-Sensoren, mit eigenem Ablauf. Läuft immer, auch bei deaktivierter Anlage.</small></div><button class="ag-toggle on" role="switch" aria-checked="true"></button></div>`)}); rows[0].scrollIntoView({block:'start'}); return 1`;
const picker = `const d=r.getElementById('ag-step'); d.innerHTML=${JSON.stringify(CSS + `<div class="ag-dlg-body mk"><h3>Sensoren hinzufügen</h3><div class="ag-t2">Alle Sensoren, die Alarmageddon erkennt.</div>
  <div class="mk-field" style="margin:12px 0;height:48px;border-radius:14px">${ic("search", 18)}<span class="ag-t2">Sensor suchen</span></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${["Alle", "Türen & Fenster", "Bewegung", "Messwerte", "Weitere"].map((t, i) => `<span class="mk-btn" style="height:34px;${i === 3 ? "background:var(--ag-primary-soft);color:var(--ag-primary);border-color:transparent" : ""}">${t}</span>`).join("")}</div>
  <div class="mk-card" style="padding:0">${[["therm", "Kühlschrank Küche: Temperatur", "Temperatur · 4,8 °C · Matter"], ["therm", "Büro: Temperatur", "Temperatur · 21,4 °C · Zigbee"], ["drop", "Keller: Luftfeuchtigkeit", "Luftfeuchtigkeit · 58 % · Zigbee"], ["co2", "Büro: CO2", "CO2 · 780 ppm · Matter"]].map((x) => `<div class="mk-rule" style="padding:12px 14px;border-top:1px solid var(--ag-divider);margin:0;align-items:center"><span class="mk-field" style="width:26px;height:26px;padding:0;border-radius:8px"></span><span class="mk-tile">${ic(x[0])}</span><div><div class="mk-t" style="font-weight:500">${x[1]}</div><div class="mk-s" style="margin:0">${x[2]}</div></div></div>`).join("")}</div>
  <div class="ag-dlg-btns"><span class="mk-btn">Abbrechen</span><span class="mk-btn primary">${ic("plus", 18)}Hinzufügen (0)</span></div></div>`)}; d.showModal(); d.style.maxHeight='none'; d.style.height='auto'; return 1`;

for (const mobile of [false, true]) {
  await shot("1-schalter-modi", mobile, modes, false, true);
  await shot("2-sensoren-hinzufuegen", mobile, picker, true);
  await shot("A1-regeln-liste", mobile, tab(LIST));
  await shot("A2-regel-bearbeiten", mobile, dlg(EDITOR), true);
  await shot("B-ablauf-je-regel", mobile, tab(FLOW));
}
await browser.close();
server.close();
console.log("fertig");
