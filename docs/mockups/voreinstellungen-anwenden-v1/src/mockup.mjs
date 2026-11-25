// Mockup "Voreinstellungen gezielt auf Sensoren anwenden" (2026-11-25, Wunsch des Nutzers mit Bildschirmfoto des Schalters "Auf alle Sensoren
// anwenden"): statt des Schalters ein Knopf, der ein Fenster öffnet. Darin alle Sensoren, deren eigene Werte von den Voreinstellungen abweichen,
// je mit dem, was überschrieben würde; scrollbar, filterbar mit denselben Pillen wie die Sensortabelle, nach Sensorart gruppiert (ganze Art an- und
// abwählen), alle vorgewählt.
// Nimmt das echte Panel im Nachbau (tests/panel/sim, erfundene Daten) und baut das Fenster "Voreinstellungen je Sensorart" im Browser um.
// Aufruf im Wurzelverzeichnis (Server des Nachbaus auf PANEL_PORT): node docs/mockups/voreinstellungen-anwenden-v1/src/mockup.mjs
import { launch, open } from "../../../../tests/panel/lib.mjs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));

// Erfundene eigene Werte: sieben Sensoren weichen ab, der Rauchmelder hat einen eigenen Wert, der der Voreinstellung entspricht (erscheint nicht)
const SETUP = `const H = window.__systems[0], G = window.__systems[1];
  H.sensor_options = {
    "binary_sensor.haustuer": { arm_on_close: false, entry_delay: 45 },
    "binary_sensor.terrassentuer": { offline_alarm: true },
    "binary_sensor.fenster_kueche": { open_ok: true },
    "binary_sensor.fenster_bad": { confirm: true },
    "binary_sensor.bewegung_flur": { confirm: true },
    "binary_sensor.rauchmelder_flur": { always: true },
    "binary_sensor.wasser_keller": { report_only: true },
  };
  H.sensor_modes = { away: { "binary_sensor.fenster_kueche": { reachable: false } } };
  if (G) G.sensor_options = { "binary_sensor.bewegung_garage": { reachable: false } };
  return 1;`;

// Abweichungen je Sensor: Art der Voreinstellung, Name, Ort, Anlage, Symbol, Änderungen [Modus|null, Symbol, Option, eigener Wert, Voreinstellung],
// was bleibt
const ROWS = [
  { type: "door", name: "Haustür", where: "Flur · Haus", icon: "door", chg: [[null, "lockClosed", "Scharf, sobald geschlossen", "aus", "an"]], keep: "Eigene Eingangsverzögerung 45 s bleibt" },
  { type: "door", name: "Terrassentür", where: "Wohnzimmer · Haus", icon: "door", chg: [[null, "offline", "Ausfall gilt als Alarm", "an", "aus"]] },
  { type: "window", name: "Fenster Küche", where: "Küche · Haus", icon: "window", chg: [[null, "door", "Muss beim Scharfschalten geschlossen sein", "aus", "an"], ["Abwesend", "signal", "Muss beim Scharfschalten erreichbar sein", "aus", "an"]] },
  { type: "window", name: "Fenster Bad", where: "Bad · Haus", icon: "window", chg: [[null, "groups", "Braucht einen zweiten Sensor", "an", "aus"]] },
  { type: "motion", name: "Bewegung Flur", where: "Flur · Haus", icon: "motion", chg: [[null, "groups", "Braucht einen zweiten Sensor", "an", "aus"]] },
  { type: "motion", name: "Bewegung Garage", where: "Garage · Garage", icon: "motion", chg: [[null, "signal", "Muss beim Scharfschalten erreichbar sein", "aus", "an"]] },
  { type: "environment", name: "Wassermelder Keller", where: "Ohne Bereich · Haus", icon: "water", chg: [[null, "bell", "Stiller Alarm", "an", "aus"]] },
];
const GROUPS = [["door", "door", "Tür"], ["window", "window", "Fenster"], ["motion", "motion", "Bewegung"], ["environment", "smoke", "Rauch, Wasser, Gas"]];
const CHIP_OF = { door: "openings", window: "openings", motion: "motion", environment: "water" };

const CSS = `
  .mk-applyrow { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; margin-top: 14px; border: 1px solid var(--ag-divider); border-radius: 16px; background: var(--ag-card); }
  .mk-applyrow > .ag-oav { flex: none; }
  .mk-applyrow .ag-settx { flex: 1; min-width: 0; min-height: var(--ag-tile); display: flex; flex-direction: column; justify-content: center; }
  .mk-applyrow .ag-settx small { display: block; color: var(--ag-text2); font-size: 12.5px; margin-top: 2px; line-height: 1.4; }
  .mk-applyrow .ag-btnrow { align-self: center; display: flex; gap: 8px; flex: none; }
  .mk-applyrow.chosen { border-color: color-mix(in srgb, var(--ag-warning) 55%, var(--ag-divider)); background: color-mix(in srgb, var(--ag-warning) 6%, var(--ag-card)); }
  .mk-unsaved { display: inline-flex; align-items: center; gap: 6px; color: var(--ag-warning-text); font-size: 12px; margin-top: 4px; }
  .mk-unsaved::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--ag-warning); }
  :host([narrow]) .mk-applyrow { flex-wrap: wrap; }
  :host([narrow]) .mk-applyrow .ag-settx { flex: 1 1 0; }
  :host([narrow]) .mk-applyrow .ag-btnrow { flex: 1 1 100%; justify-content: stretch; }
  :host([narrow]) .mk-applyrow .ag-btnrow .ag-btn { flex: 1; justify-content: center; }
  dialog#mk-apply { width: min(1040px, calc(100vw - 32px)); }
  :host(:not([narrow])) dialog#mk-apply[open] { height: min(92vh, 900px); }
  #mk-apply > .ag-dlg-body { display: flex; flex-direction: column; flex: 1 1 auto; }
  #mk-apply .mk-head { display: flex; align-items: center; gap: 12px; }
  #mk-apply .mk-head h3 { margin: 0; }
  #mk-apply .ag-pick-chips { margin-top: 12px; }
  #mk-apply .mk-list { margin-top: 12px; flex: 1 1 0; min-height: 160px; max-height: none; }
  :host([narrow]) #mk-apply .mk-list { flex: 1 1 auto; max-height: none; }
  .mk-allrow { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--ag-card); border-bottom: 1px solid var(--ag-divider); font-size: 13.5px; }
  .mk-allrow b { font-weight: 600; }
  .mk-allrow .mk-sp { flex: 1; }
  .mk-link { border: 0; background: none; color: var(--ag-primary); font: inherit; font-size: 13px; padding: 4px 6px; cursor: pointer; }
  .mk-grp { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: var(--ag-subtle); border-bottom: 1px solid var(--ag-divider); font-size: 13.5px; position: sticky; top: 45px; z-index: 1; }
  .mk-grp b { font-weight: 600; }
  .mk-grp small { color: var(--ag-text2); font-size: 12.5px; }
  .mk-row { display: grid; grid-template-columns: 26px 32px minmax(170px, 250px) minmax(0, 1fr); column-gap: 12px; row-gap: 6px; align-items: start; padding: 11px 12px; border-bottom: 1px solid var(--ag-divider); background: var(--ag-card); }
  .mk-row:last-child { border-bottom: 0; }
  .mk-row.off .mk-name, .mk-row.off .mk-chgs { opacity: .5; }
  .mk-row .ag-box { margin-top: 3px; }
  .mk-row .ag-av { margin-top: 0; }
  .mk-name b { font-weight: 500; display: block; }
  .mk-name small { color: var(--ag-text2); font-size: 12.5px; }
  .mk-chgs { display: flex; flex-direction: column; gap: 5px; padding-top: 2px; }
  .mk-chg { display: flex; align-items: center; gap: 8px; font-size: 13px; flex-wrap: wrap; }
  .mk-chg > svg { color: var(--ag-text2); flex: none; }
  .mk-chg .mk-opt { color: var(--ag-text); }
  .mk-val { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; white-space: nowrap; }
  .mk-old { color: var(--ag-text2); text-decoration: line-through; }
  .mk-new { color: var(--ag-primary); font-weight: 600; }
  .mk-val small { color: var(--ag-text2); font-size: 11.5px; }
  .mk-mode { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; background: var(--ag-subtle); font-size: 11.5px; color: var(--ag-text2); }
  .mk-keep { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ag-text2); }
  .mk-keep svg { color: var(--ag-success); }
  .mk-grp > .ag-box, .mk-allrow > .ag-box, .mk-row > .ag-box { margin: 0; flex: none; }
  .mk-grp > .ag-av { margin: 0; }
  .mk-chgs { max-width: 640px; }
  .ag-box.mixed { background: var(--ag-primary); border-color: var(--ag-primary); color: #fff; }
  #mk-apply .ag-dlg-btns .mk-count { margin-right: auto; color: var(--ag-text2); font-size: 13px; align-self: center; }
  :host([narrow]) .mk-row { grid-template-columns: 26px 32px minmax(0, 1fr); }
  :host([narrow]) .mk-row .mk-chgs { grid-column: 3 / -1; }
  :host([narrow]) .mk-val { margin-left: 0; }
  :host([narrow]) .mk-chg { row-gap: 2px; }
  :host([narrow]) .mk-chg .mk-opt { flex: 1 1 calc(100% - 30px); }
  :host([narrow]) dialog#mk-apply { width: 100vw; max-width: 100vw; }
  :host([narrow]) #mk-apply .ag-dlg-btns { flex-wrap: wrap; gap: 8px; }
  :host([narrow]) #mk-apply .ag-dlg-btns .mk-count { flex: 1 1 100%; }
  :host([narrow]) #mk-apply .ag-dlg-btns .ag-btn { flex: 1 1 auto; justify-content: center; }
  :host([narrow]) #mk-apply .ag-dlg-btns .ag-btn.primary { flex: 1 1 100%; order: 5; }
`;

// Baut im Browser: Zeile mit Knopf im Fenster der Voreinstellungen und das neue Fenster. state: knopf | gewaehlt; fenster: { sel, filter, footer }
const MOCK = (cfg) => `return import(new URL('/alarmageddon_panel/common.js', location.href).href).then(({ ic, esc }) => {
  const cfg = ${JSON.stringify(cfg)};
  const ROWS = ${JSON.stringify(ROWS)}, GROUPS = ${JSON.stringify(GROUPS)}, CHIP_OF = ${JSON.stringify(CHIP_OF)};
  if (!r.getElementById('mk-css')) { const st = document.createElement('style'); st.id = 'mk-css'; st.textContent = ${JSON.stringify(CSS)}; r.appendChild(st); }
  const pre = r.getElementById('ag-presets');
  // Zeile anstelle des Schalters "Auf alle Sensoren anwenden" (und der Zahl darüber)
  const all = pre.querySelector('.ag-presetall');
  if (all) { all.previousElementSibling?.classList.contains('ag-small') && all.previousElementSibling.remove(); }
  pre.querySelector('.mk-applyrow')?.remove();
  const row = document.createElement('div');
  const chosen = cfg.state === 'gewaehlt';
  row.className = 'mk-applyrow' + (chosen ? ' chosen' : '');
  row.innerHTML = chosen
    ? '<span class="ag-oav on">' + ic('download', 20) + '</span><div class="ag-settx"><b>Beim Speichern übernehmen 5 von 7 Sensoren die Voreinstellungen</b>'
      + '<small>Haustür, Terrassentür, Fenster Küche, Bewegung Flur und Bewegung Garage verlieren ihre abweichenden eigenen Werte. Fenster Bad und Wassermelder Keller behalten sie.</small>'
      + '<span class="mk-unsaved">Noch nicht gespeichert</span></div>'
      + '<div class="ag-btnrow"><button class="ag-btn">' + ic('close', 18) + 'Verwerfen</button><button class="ag-btn">' + ic('pencil', 18) + 'Auswahl ändern</button></div>'
    : '<span class="ag-oav">' + ic('download', 20) + '</span><div class="ag-settx"><b>Auf Sensoren anwenden</b>'
      + '<small>7 Sensoren haben eigene Werte, die von diesen Voreinstellungen abweichen. Wähle, welche sie übernehmen sollen; vorher siehst du, was sich bei jedem ändert.</small></div>'
      + '<div class="ag-btnrow"><button class="ag-btn">' + ic('download', 18) + 'Sensoren wählen (7)</button></div>';
  if (all) all.replaceWith(row); else pre.querySelector('.ag-dlg-err').before(row);
  if (!cfg.window) return 1;
  // Neues Fenster über dem der Voreinstellungen
  let d = r.getElementById('mk-apply');
  if (!d) { d = document.createElement('dialog'); d.id = 'mk-apply'; d.className = 'ag-dlg'; r.appendChild(d); }
  const sel = new Set(cfg.window.sel);
  const shown = ROWS.filter((x) => cfg.window.filter === 'all' || CHIP_OF[x.type] === cfg.window.filter);
  const box = (state) => '<span class="ag-box ' + (state === 'on' ? 'on' : state === 'mixed' ? 'mixed' : '') + '">' + (state === 'on' ? ic('check', 18) : state === 'mixed' ? ic('minus', 18) : '') + '</span>';
  let list = '<div class="mk-allrow">' + box(sel.size === ROWS.length ? 'on' : sel.size ? 'mixed' : '') + '<span><b>' + (cfg.window.filter === 'all' ? 'Alle 7 Sensoren' : shown.length + ' von 7 Sensoren (Filter)') + '</b></span><span class="mk-sp"></span><button class="mk-link">Alle</button><button class="mk-link">Keine</button></div>';
  for (const [type, gicon, glabel] of GROUPS) {
    const rows = shown.filter((x) => x.type === type);
    if (!rows.length) continue;
    const n = rows.filter((x) => sel.has(x.name)).length;
    list += '<div class="mk-grp">' + box(n === rows.length ? 'on' : n ? 'mixed' : '') + '<span class="ag-av">' + ic(gicon, 16) + '</span><span><b>' + glabel + '</b> <small>· ' + n + ' von ' + rows.length + ' gewählt</small></span></div>';
    for (const x of rows) {
      const on = sel.has(x.name);
      const chg = x.chg.map(([mode, oic, opt, from, to]) => '<div class="mk-chg">' + ic(oic, 16) + (mode ? '<span class="mk-mode">' + mode + '</span>' : '') + '<span class="mk-opt">' + opt + '</span><span class="mk-val"><span class="mk-old">' + from + '</span>' + ic('chevRight', 14) + '<span class="mk-new">' + to + '</span></span></div>').join('')
        + (x.keep ? '<div class="mk-keep">' + ic('check', 14) + x.keep + '</div>' : '');
      list += '<div class="mk-row ' + (on ? '' : 'off') + '">' + box(on ? 'on' : '') + '<span class="ag-av">' + ic(x.icon, 18) + '</span><div class="mk-name"><b>' + x.name + '</b><small>' + x.where + '</small></div><div class="mk-chgs">' + chg + '</div></div>';
    }
  }
  const chips = [['all', 'Alle'], ['openings', 'Türen & Fenster'], ['motion', 'Bewegung'], ['water', 'Wasser']].map(([k, l]) => '<button class="ag-chip ' + (cfg.window.filter === k ? 'on' : '') + '">' + l + '</button>').join('');
  const foot = cfg.window.footer === 'b'
    ? '<span class="mk-count">' + sel.size + ' von 7 gewählt</span><button class="ag-btn">Zurück</button><button class="ag-btn">Nur Voreinstellungen speichern</button><button class="ag-btn primary">' + ic('check', 18) + 'Speichern und ' + sel.size + ' übernehmen</button>'
    : '<span class="mk-count">' + sel.size + ' von 7 gewählt</span><button class="ag-btn">Abbrechen</button><button class="ag-btn primary">' + ic('check', 18) + 'Übernehmen (' + sel.size + ')</button>';
  const intro = cfg.window.footer === 'b'
    ? 'Diese Sensoren haben eigene Werte, die von den neuen Voreinstellungen abweichen. Gewählte übernehmen die Voreinstellungen ihrer Art, ihre abweichenden eigenen Werte gehen verloren. Die eigene Eingangsverzögerung bleibt.'
    : 'Diese Sensoren haben eigene Werte, die von den Voreinstellungen abweichen. Gewählte übernehmen beim Speichern die Voreinstellungen ihrer Art, ihre abweichenden eigenen Werte gehen verloren. Die eigene Eingangsverzögerung bleibt.';
  d.innerHTML = '<div class="ag-dlg-body"><div class="mk-head"><span class="ag-oav on">' + ic('download', 20) + '</span><h3>' + (cfg.window.footer === 'b' ? 'Auch auf Sensoren anwenden?' : 'Voreinstellungen auf Sensoren anwenden') + '</h3></div>'
    + '<div class="ag-t2" style="margin-top:10px">' + intro + '</div>'
    + '<label class="list-search" style="margin-top:12px">' + ic('search', 18) + '<input type="search" placeholder="Sensor suchen"></label>'
    + '<div class="ag-tools ag-pick-chips">' + chips + '</div>'
    + '<div class="ag-elist mk-list">' + list + '</div>'
    + '<div class="ag-dlg-btns">' + foot + '</div></div>';
  if (!d.open) d.showModal();
  return 1;
});`;

const SHOTS = [
  // name, Zustand der Zeile, Fenster
  ["voreinstellungen-heute", null, null],
  ["a1-voreinstellungen-knopf", { state: "knopf" }, null],
  ["a2-fenster-alle", { state: "knopf", window: { sel: ROWS.map((x) => x.name), filter: "all" } }, null],
  ["a3-fenster-gefiltert", { state: "knopf", window: { sel: ["Haustür", "Terrassentür", "Fenster Küche"], filter: "openings" } }, null],
  ["a4-voreinstellungen-gewaehlt", { state: "gewaehlt" }, null],
  ["b-rueckfrage-beim-speichern", { state: "none", window: { sel: ROWS.map((x) => x.name), filter: "all", footer: "b" } }, null],
];

const browser = await launch();
for (const mobile of [false, true]) {
  for (const [name, cfg] of SHOTS) {
    const s = await open(browser, { lang: "de", tab: "config", prefs: { sub: "sensors" }, mobile, size: mobile ? null : { width: 1400, height: 950 } });
    await s.page.waitForTimeout(900);
    await s.sim(SETUP);
    await s.ev("return r.host._fetch().then(() => { r.host.sensorsUi?.reset?.(); r.host.sensorsUi?.render?.(); return 1; })");
    await s.page.waitForTimeout(500);
    await s.tap('[data-sen="presets"]');
    await s.waitFor("return r.getElementById('ag-presets').open");
    await s.page.waitForTimeout(500);
    if (!cfg) {
      // heute: Schalter eingeschaltet wie auf dem Bildschirmfoto des Nutzers
      await s.tap('#ag-presets [data-sen="preset-all"]');
    } else if (cfg.state === "none") {
      // Variante B: kein Knopf; "Speichern" öffnet die Rückfrage. Im Fenster dahinter ist eine Voreinstellung geändert
      await s.ev("r.getElementById('ag-presets').querySelector('.ag-presetall')?.remove(); return 1");
      await s.tap('#ag-presets [data-sen="preset"][data-kind="window"][data-key="confirm"]');
      await s.tap('#ag-presets [data-sen="preset"][data-kind="window"][data-key="confirm"]');
      await s.ev(MOCK({ state: "knopf", window: cfg.window }));
      await s.ev("r.querySelector('#ag-presets .mk-applyrow')?.remove(); return 1");
    } else {
      await s.ev(MOCK(cfg));
    }
    await s.page.waitForTimeout(500);
    // Liste im Fenster oben, Fenster der Voreinstellungen unten (dort steht die neue Zeile)
    await s.ev("const b = r.querySelector('#ag-presets > .ag-dlg-body'); if (b && !r.getElementById('mk-apply')?.open) b.scrollTop = b.scrollHeight; return 1");
    await s.page.waitForTimeout(300);
    const file = `${name}-${mobile ? "handy" : "desktop"}.png`;
    await s.page.screenshot({ path: out + file });
    console.log(file, s.errors.join(" | ") || "");
    await s.ctx.close();
  }
}
await browser.close();
