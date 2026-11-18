// Mockups "Sensoransicht: Ereignisse und Regeln" (2026-11-18, Wunsch des Nutzers). Kein Test: öffnet die echte Sensoransicht im HA-Nachbau
// (Überwachung an, Kühlschrank) und ersetzt die Liste unter der Grafik durch die Varianten. Erfundene Daten.
// Aufruf im Wurzelverzeichnis: CHROMIUM_PATH=... node docs/mockups/sensorview-regeln-v1/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8963";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();
const TEMP = "sensor.kuehlschrank_temperatur";

const EVENTS = [
  ["Heute", "14:12", "ok", "Wieder in Ordnung", "7,6 °C", "Kühlschrank zu warm"],
  ["Heute", "13:40", "out", "Ausserhalb der Grenzen", "8,4 °C", "Kühlschrank zu warm"],
  ["Gestern", "02:15", "ok", "Wieder in Ordnung", "7,8 °C", "Strom weg"],
  ["Gestern", "01:52", "out", "Ausserhalb der Grenzen", "12,3 °C", "Strom weg"],
];
const RULES = [
  ["Kühlschrank zu warm", "über 8 °C, länger als 10 Min.", "Haus", "on"],
  ["Strom weg", "über 12 °C oder Tür länger als 5 Min. offen", "Haus", "on"],
  ["Kühlschrank Frost", "unter 0 °C", "Haus", "off"],
];

const CSS = `
.mk-bar { display: flex; align-items: center; gap: 12px; padding: 14px 24px 10px; flex-wrap: wrap; }
.mk-bar .ag-seg { flex: none; }
.mk-bar .list-search { flex: 1 1 220px; max-width: 360px; margin: 0; }
:host([narrow]) .mk-bar { padding: 12px 16px 8px; }
:host([narrow]) .mk-bar .ag-seg { flex: 1 1 100%; }
:host([narrow]) .mk-bar .ag-seg > button { flex: 1; }
:host([narrow]) .mk-bar .list-search { max-width: none; }
.mk-n { margin-left: 6px; font-size: 12px; color: var(--ag-text2); font-weight: 500; }
.mk-sort { display: inline-flex; align-items: center; gap: 2px; cursor: pointer; }
.mk-sort.on { color: var(--ag-text); }
.mk-sort svg { width: 14px; height: 14px; }
.mk-rule b { display: block; font-weight: 500; } .mk-rule small { display: block; color: var(--ag-text2); font-size: 12.5px; margin-top: 2px; }
.mk-state { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 12px; white-space: nowrap; }
.mk-state.on { background: var(--ag-success-soft, color-mix(in srgb, var(--ag-success) 16%, transparent)); color: var(--ag-success); }
.mk-state.off { background: var(--ag-subtle); color: var(--ag-text2); }
.mk-go { width: 1%; white-space: nowrap; }
.mk-sec { padding: 14px 24px 6px; font-size: 13px; font-weight: 600; color: var(--ag-text2); display: flex; align-items: center; gap: 8px; }
:host([narrow]) .mk-sec { padding: 12px 16px 6px; }
.mk-cards { display: grid; gap: 8px; padding: 0 24px 6px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
:host([narrow]) .mk-cards { padding: 0 16px 6px; grid-template-columns: 1fr; }
.mk-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: var(--ag-subtle); border: 1px solid var(--ag-divider); }
.mk-card .mk-rule { flex: 1; min-width: 0; }
.mk-note { padding: 4px 24px 0; font-size: 12px; color: var(--ag-text3); }
`;

async function shot(mobile, variant, tab, name) {
  const s = await open(browser, { mobile, lang: "de", theme: "dark", query: "&monitor=1" });
  await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${TEMP}"]')`);
  await s.tap(`[data-act="more"][data-entity="${TEMP}"]`);
  await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector(".ag-sv-chart svg .sv-line")`);
  await s.page.waitForTimeout(400);
  await s.ev(`const [css, variant, tab, EVENTS, RULES] = arg; const h=r.host; const d=r.getElementById('ag-sensor');
    const url=performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\\/common\\.js/.test(n));
    return import(url).then(({ ic, esc }) => {
      if (!r.querySelector('style.mk')) { const st=document.createElement('style'); st.className='mk'; st.textContent=css; r.appendChild(st); }
      const narrow=h.hasAttribute('narrow');
      const search=(ph) => '<label class="list-search">' + ic('search', 18) + '<input type="search" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '"></label>';
      const sort=(label, on, cls='') => '<th class="' + cls + '"><span class="mk-sort ' + (on ? 'on' : '') + '">' + esc(label) + (on ? ic('arrowDown', 14) : '') + '</span></th>';
      const dot=(k) => '<span class="ag-sv-dot mon-' + k + '"></span>';
      let day=''; let ev='';
      for (const [dd, t, k, what, val, rule] of EVENTS) {
        if (dd !== day) { day=dd; ev += '<tr class="day"><td colspan="' + (narrow ? 3 : 4) + '">' + dd + '</td></tr>'; }
        ev += narrow
          ? '<tr><td>' + t + '</td><td><span class="ag-sv-ev">' + dot(k) + '<span>' + esc(what) + '<small>' + esc(val) + '</small></span></span></td><td class="r"><span class="ag-sv-tag">' + esc(rule) + '</span></td></tr>'
          : '<tr><td>' + t + '</td><td><span class="ag-sv-ev">' + dot(k) + esc(what) + '</span></td><td>' + esc(val) + '</td><td><span class="ag-sv-tag">' + esc(rule) + '</span></td></tr>';
      }
      const evHead = narrow ? '<tr>' + sort('Zeit', true) + sort('Ereignis') + sort('Regel', false, 'r') + '</tr>' : '<tr>' + sort('Zeit', true, 'c1') + sort('Ereignis') + sort('Stand', false, 'c3') + sort('Regel', false, 'c4') + '</tr>';
      const evTable='<table class="ag-sv-table"><thead>' + evHead + '</thead><tbody>' + ev + '</tbody></table>';
      const go='<button class="ag-cbtn" aria-label="Regel öffnen">' + ic('chevRight', 16) + '</button>';
      const state=(st) => '<span class="mk-state ' + st + '">' + (st === 'on' ? 'Aktiv' : 'Aus') + '</span>';
      const rl=RULES.map(([n, c, sys, st]) => narrow
        ? '<tr><td><span class="mk-rule"><b>' + esc(n) + '</b><small>' + esc(c) + '</small></span></td><td class="r">' + state(st) + '</td><td class="mk-go">' + go + '</td></tr>'
        : '<tr><td><span class="mk-rule"><b>' + esc(n) + '</b><small>' + esc(c) + '</small></span></td><td>' + esc(sys) + '</td><td>' + state(st) + '</td><td class="mk-go">' + go + '</td></tr>').join('');
      const rlHead = narrow ? '<tr>' + sort('Regel', true) + sort('Zustand', false, 'r') + '<th></th></tr>' : '<tr>' + sort('Regel', true) + sort('Anlage', false, 'c3') + sort('Zustand', false, 'c1') + '<th class="mk-go"></th></tr>';
      const rlTable='<table class="ag-sv-table"><thead>' + rlHead + '</thead><tbody>' + rl + '</tbody></table>';
      const list=d.querySelector('.ag-sv-list');
      if (variant === 'A') {
        const seg=h._segHtml('mk', [['ev', 'Ereignisse', 'history'], ['rules', 'Regeln', 'eye']], tab, 'data-mk', 'small');
        const segN=seg.replace('<span>Ereignisse</span>', '<span>Ereignisse<span class="mk-n">' + EVENTS.length + '</span></span>').replace('<span>Regeln</span>', '<span>Regeln<span class="mk-n">' + RULES.length + '</span></span>');
        list.innerHTML='<div class="mk-bar">' + segN + search(tab === 'ev' ? 'Ereignis, Stand oder Regel suchen' : 'Regel, Bedingung oder Anlage suchen') + '</div>' + (tab === 'ev' ? evTable : rlTable);
      } else {
        const cards=RULES.map(([n, c, sys, st]) => '<div class="mk-card"><span class="mk-rule"><b>' + esc(n) + '</b><small>' + esc(c) + '</small></span>' + state(st) + go + '</div>').join('');
        list.innerHTML='<div class="mk-sec">Regeln mit diesem Sensor<span class="mk-n">' + RULES.length + '</span></div><div class="mk-cards">' + cards + '</div>'
          + '<div class="mk-sec">Ereignisse<span class="mk-n">' + EVENTS.length + '</span></div><div class="mk-bar" style="padding-top:0">' + search('Ereignis, Stand oder Regel suchen') + '</div>' + evTable;
      }
      h._placePills?.();
      return 1;
    });`, [CSS, variant, tab, EVENTS, RULES]);
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}

// Grenze ausserhalb des gezeigten Bereichs: Marke am Rand statt nichts (Erklärung zu "Reduit")
async function edge(mobile) {
  const s = await open(browser, { mobile, lang: "de", theme: "dark", query: "&monitor=1" });
  await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${TEMP}"]')`);
  await s.tap(`[data-act="more"][data-entity="${TEMP}"]`);
  await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector(".ag-sv-chart svg .sv-line")`);
  await s.page.waitForTimeout(400);
  await s.ev(`const svg=r.getElementById('ag-sensor').querySelector('.ag-sv-chart svg'); svg.querySelectorAll('line.sv-thr').forEach((l) => l.remove());
    [...svg.querySelectorAll('text')].filter((t) => /Grenze/.test(t.textContent)).forEach((t) => t.remove());
    const grid=[...svg.querySelectorAll('line.sv-grid')]; const top=Math.min(...grid.map((g) => +g.getAttribute('y1'))); const x2=Math.max(...grid.map((g) => +g.getAttribute('x2')));
    const ns='http://www.w3.org/2000/svg'; const t=document.createElementNS(ns, 'text'); t.setAttribute('x', x2 - 4); t.setAttribute('y', top + 14); t.setAttribute('text-anchor', 'end'); t.setAttribute('class', 'sv-tx err');
    t.textContent='↑ Grenze 25 °C (ausserhalb)'; svg.appendChild(t); return 1`);
  await s.page.waitForTimeout(200);
  await s.page.screenshot({ path: `${out}grenze-am-rand-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}

for (const mobile of [true, false]) {
  await shot(mobile, "A", "ev", "a-ereignisse");
  await shot(mobile, "A", "rules", "a-regeln");
  await shot(mobile, "B", "ev", "b-regeln-oben");
  await edge(mobile);
}
await browser.close();
server.close?.();
process.exit(0);
