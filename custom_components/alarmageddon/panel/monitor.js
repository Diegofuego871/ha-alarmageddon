// Aktionen › Überwachung (1.48.0): Regeln für Messwerte (Temperatur, Luftfeuchtigkeit, CO2 ...) und Ja/Nein-Sensoren, unabhängig vom Alarm.
// Jede Regel ist ein Kapitel mit ihrem Ablauf in den Zonenfarben der Aktionen: "Ausserhalb der Grenzen" (orange) und "Wieder in Ordnung" (grün);
// die Schritte sind Push-Meldung, Gerät schalten und Warten (nie Sirene oder Alarm). Die Regel selbst (Name, Bedingung, Dauer, Rückkehr-Spanne,
// Erinnerung) steht in einem Fenster. Alles ist ein Entwurf mit "Abbrechen" und "Speichern" (Regel der Seite); der Server prüft noch einmal
// (monitor.check_monitors, schemas.MONITORS).

const V = new URL(import.meta.url).search;
const { ic, esc, MODE_KEY, MODE_ICON, chapter, errText } = await import(`./common.js${V}`);

const ALL_MODES = ["home", "away", "night"];
const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const NAME_MAX = 45;
const MAX_MONITORS = 20;
const MAX_STEPS = 10;
const MAX_LEAVES = 10;
const MAX_GROUPS = 3;
const HOLD_MAX = 7 * 24 * 3600;
const REMIND_MAX = 72;
const WAIT_MAX = 3600;
const UNITS = { s: 1, m: 60, h: 3600 };
const OPENING = ["door", "window", "opening", "garage_door"];
const MOTION = ["motion", "occupancy", "presence"];
// Geräte, die ein Schritt "Gerät schalten" bedienen kann, und was er mit ihnen tut
const SWITCH_ACTIONS = [["turn_on", "monOn"], ["turn_off", "monOff"]];
const ACTIONS = {
  switch: SWITCH_ACTIONS, light: SWITCH_ACTIONS, input_boolean: SWITCH_ACTIONS, fan: SWITCH_ACTIONS, siren: SWITCH_ACTIONS,
  cover: [["open_cover", "monOpen"], ["close_cover", "monClose"]], lock: [["lock", "monLock"], ["unlock", "monUnlock"]],
  script: [["turn_on", "monRun"]], scene: [["turn_on", "monRun"]],
};
const DOMAIN_ICON = { switch: "toggle", light: "bulb", input_boolean: "toggle", fan: "power", siren: "bell", cover: "blinds", lock: "lockClosed", script: "script", scene: "script" };
const VALUE_FILTERS = [["all", "monFilterAll", null], ["temperature", "dcTemperature", ["temperature"]], ["humidity", "dcHumidity", ["humidity"]], ["co2", "dcCo2", ["carbon_dioxide"]]];
const PLACEHOLDERS = ["rule", "sensor", "value", "unit", "limit", "since", "name"];
const STEP_KINDS = [["notify", "monStepNotify", "bell"], ["action", "monStepAction", "power"], ["wait", "monStepWait", "timer"]];

// Farben der Regelkarte (Darstellung): dieselben Werte wie const.MONITOR_COLORS; der Name steht in strings.js (monColor_<Name>)
const COLORS = [["#ef5350", "red"], ["#ff8a65", "orange"], ["#ffca28", "yellow"], ["#9ccc65", "green"], ["#26a69a", "teal"], ["#29b6f6", "blue"], ["#7986cb", "indigo"], ["#ab47bc", "violet"], ["#ec407a", "pink"], ["#90a4ae", "grey"]];
const clone = (x) => JSON.parse(JSON.stringify(x));
const newId = () => `m${Math.random().toString(36).slice(2, 10)}`;
const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
const fmt = (n) => String(Math.round(Number(n) * 100) / 100);

// ----- Vergleichbare Form: der Server ergänzt Vorgaben und ordnet Schlüssel anders; verglichen wird nur diese Form -----

const normStep = (st) => {
  if (st.type === "notify") {
    return { type: "notify", ...(st.title ? { title: st.title } : {}), ...(st.message ? { message: st.message } : {}), critical: Boolean(st.critical),
      ...(st.volume !== undefined && st.volume !== null ? { volume: Number(st.volume) } : {}), targets: [...(st.targets || [])] };
  }
  if (st.type === "action") return { type: "action", action: st.action, target: [...(st.target || [])], data: clone(st.data || {}) };
  return { type: "wait", seconds: Number(st.seconds) || 0 };
};
const normLeaf = (l) => {
  if (l.kind === "value") return { kind: "value", entity_id: l.entity_id, op: l.op, limit: Number(l.limit), ...(l.op === "outside" ? { upper: Number(l.upper) } : {}) };
  if (l.kind === "armed") return { kind: "armed", modes: [...(l.modes || [])].sort() };
  if (l.kind === "time") return { kind: "time", from: l.from, to: l.to, days: [...(l.days || [])].sort((a, b) => a - b) };
  return { kind: "state", entity_id: l.entity_id, state: l.state };
};
const normTree = (t) => ({ op: t.op, items: (t.items || []).map((i) => (i.items ? { op: i.op, items: i.items.map(normLeaf) } : normLeaf(i))) });
export const normMonitor = (m) => ({
  id: m.id, name: m.name, enabled: m.enabled !== false, ...(m.color ? { color: m.color } : {}), tree: normTree(m.tree), hold: Number(m.hold) || 0, margin: Number(m.margin) || 0, remind: Number(m.remind) || 0,
  steps_out: (m.steps_out || []).map(normStep), steps_ok: (m.steps_ok || []).map(normStep),
});
const sortKeys = (x) => (Array.isArray(x) ? x.map(sortKeys) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortKeys(x[k])])) : x);
const canon = (x) => JSON.stringify(sortKeys(x));
export const normMonitors = (list) => (list || []).map(normMonitor);

export class MonitorUi {
  constructor(ui) {
    this.ui = ui;
    this.draft = null; // { entry, base, monitors }
    this.saveState = null;
    this.saving = false;
    this.form = null; // Regel im Editor (Kopie)
    this.index = -1;
    this.snap = "";
    this.pick = null; // Auswahl im Editor: { path, kind, q, filter }
    this.ents = null; // Geräte und Messwerte vom Server
    this.loading = false;
    this.q = ""; // Suche: Name der Regel, Name und Entität der Sensoren
    this.folded = new Set(); // zugeklappte Regeln (nur Ansicht, nicht gespeichert)
    this.step = null; // Schritt im Fenster: { zone, rule, index, form, pick }
  }

  get host() {
    return this.ui.host;
  }

  get system() {
    return this.host._system();
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get dlg() {
    return this.host._root.getElementById("ag-mon");
  }

  get sdlg() {
    return this.host._root.getElementById("ag-monstep");
  }

  // ----- Entwurf -----

  ensureDraft() {
    const s = this.system;
    if (!s) return null;
    const base = canon(normMonitors(s.monitors));
    // Ein sauberer Entwurf folgt den Daten des Servers (andere Browser, Neuladen); ein geänderter bleibt
    if (!this.draft || this.draft.entry !== s.entry_id || (this.draft.base !== base && !this.dirty())) {
      this.draft = { entry: s.entry_id, base, monitors: clone(normMonitors(s.monitors)) };
    }
    return this.draft;
  }

  dirty() {
    return Boolean(this.draft) && canon(this.draft.monitors) !== this.draft.base;
  }

  // Eine Änderung je Regel, die neu, geändert oder gelöscht ist
  dirtyCount() {
    const s = this.system;
    const d = this.draft;
    if (!s || !d || d.entry !== s.entry_id) return 0;
    const base = Object.fromEntries(JSON.parse(d.base).map((m) => [m.id, canon(m)]));
    const mine = Object.fromEntries(d.monitors.map((m) => [m.id, canon(m)]));
    let n = 0;
    for (const id of new Set([...Object.keys(base), ...Object.keys(mine)])) if (base[id] !== mine[id]) n += 1;
    return n;
  }

  reset() {
    this.draft = null;
    this.saveState = null;
    this.form = null;
    this.step = null;
  }

  // ----- Geräte vom Server -----

  async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const res = await this.host._hass.callWS({ type: "alarmageddon/monitor_entities" });
      const list = res?.entities || [];
      this.ents = { list, byId: Object.fromEntries(list.map((e) => [e.entity_id, e])) };
    } catch {
      this.ents = this.ents || { list: [], byId: {}, failed: true };
    } finally {
      this.loading = false;
    }
    if (this.form) this.renderDlg();
    this.ui.render();
  }

  deviceName(id) {
    return this.ents?.byId[id]?.name || this.host._hass?.states?.[id]?.attributes?.friendly_name || id;
  }

  unitOf(id) {
    return this.host._hass?.states?.[id]?.attributes?.unit_of_measurement || this.ents?.byId[id]?.unit || "";
  }

  stateText(id, state) {
    const dc = this.ents?.byId[id]?.device_class || this.host._hass?.states?.[id]?.attributes?.device_class || "";
    const domain = id.split(".")[0];
    let kind = "";
    if (domain === "binary_sensor") kind = OPENING.includes(dc) ? "opening" : MOTION.includes(dc) ? "motion" : dc === "moisture" ? "moisture" : "";
    const key = kind ? `monSt_${state}_${kind}` : `monSt_${state}`;
    const text = this._t(key);
    return text === key ? state : text;
  }

  // ----- Texte -----

  leafText(l) {
    if (l.kind === "value") {
      const u = this.unitOf(l.entity_id);
      const lim = (n) => `${fmt(n)}${u ? ` ${u}` : ""}`;
      const range = l.op === "outside" ? this._t("monOutsideOf", { from: fmt(l.limit), to: lim(l.upper) }) : `${lim(l.limit)}`;
      return `${this.deviceName(l.entity_id)} ${this._t(`monOp_${l.op}`)} ${range}`.trim();
    }
    if (l.kind === "armed") {
      const own = (l.modes || []).filter((m) => ALL_MODES.includes(m));
      return own.length ? this._t("monArmedIn", { modes: own.map((m) => this._t(MODE_KEY[m])).join(", ") }) : this._t("monArmed");
    }
    if (l.kind === "time") return this._t("monLeafTime", { from: l.from, to: l.to });
    return `${this.deviceName(l.entity_id)} ${this._t("monIs")} ${this.stateText(l.entity_id, l.state)}`;
  }

  treeText(tree) {
    const join = ` ${this._t(tree.op === "or" ? "monOr" : "monAnd")} `;
    return tree.items.map((i) => (i.items ? `(${i.items.map((l) => this.leafText(l)).join(` ${this._t(i.op === "or" ? "monOr" : "monAnd")} `)})` : this.leafText(i))).join(join);
  }

  durText(seconds) {
    const n = Number(seconds) || 0;
    if (n >= 3600 && n % 3600 === 0) return this._t("monHours", { n: n / 3600 });
    if (n >= 60 && n % 60 === 0) return this._t("monMinutes", { n: n / 60 });
    return this._t("monSeconds", { n });
  }

  ruleSub(m) {
    const parts = [this.treeText(m.tree)];
    if (m.hold) parts.push(this._t("monHoldShort", { time: this.durText(m.hold) }));
    if (m.remind) parts.push(this._t("monRemindShort", { n: m.remind }));
    return parts.join(" · ");
  }

  stepSummary(st) {
    if (st.type === "wait") return this.durText(st.seconds);
    if (st.type === "action") {
      const [domain, svc] = (st.action || "").split(".");
      const label = (ACTIONS[domain] || []).find((a) => a[0] === svc)?.[1];
      return `${st.target?.length ? st.target.map((e) => this.deviceName(e)).join(", ") : st.action}${label ? ` · ${this._t(label)}` : ` · ${st.action}`}`;
    }
    const who = st.targets?.length ? st.targets.map((t) => t.replace(/^notify\./, "")).join(", ") : this._t("monDefaultTargets");
    return [st.title || this._t("monDefaultText"), who, st.critical ? this._t("monCritical") : ""].filter(Boolean).join(" · ");
  }

  // ----- Seite -----

  bodyHtml() {
    const d = this.ensureDraft();
    if (!d) return "";
    if (this.ents === null && !this.loading) this.load();
    return `<div class="ag-mon-intro"><div class="ag-grow"><h3 class="ag-chap-t">${esc(this._t("monTitle"))}</h3><p class="ag-chap-h">${esc(this._t("monHint"))}</p></div>
        <button class="ag-btn primary" data-wf="mon-add" ${d.monitors.length >= MAX_MONITORS ? "disabled" : ""}>${ic("plus", 18)}${esc(this._t("monAdd"))}</button></div>
      ${d.monitors.length ? `<div class="ag-tools ag-mon-tools"><label class="list-search">${ic("search", 18)}<input type="search" data-wf="mon-search" placeholder="${esc(this._t("monSearch"))}" value="${esc(this.q)}" aria-label="${esc(this._t("monSearch"))}" autocomplete="off">
          <button type="button" class="ag-clear" data-wf="mon-search-clear" aria-label="${esc(this._t("clearSearch"))}" ${this.q ? "" : "hidden"}>${ic("close", 16)}</button></label>
          <button class="ag-btn" data-wf="mon-fold-all">${esc(this._t(this.folded.size >= d.monitors.length ? "monUnfoldAll" : "monFoldAll"))}</button></div>` : ""}
      <div class="ag-mon-list">${this._listHtml()}</div>`;
  }

  // Passt die Regel zur Suche? Name, Bedingung in Worten, Name und Entitäts-ID jedes Sensors oder Geräts darin
  _matches(m) {
    const q = this.q.trim().toLowerCase();
    if (!q) return true;
    const leaves = m.tree.items.flatMap((i) => (i.items ? i.items : [i])).filter((l) => l.entity_id);
    const hay = [m.name, this.ruleSub(m), ...leaves.flatMap((l) => [l.entity_id, this.deviceName(l.entity_id)])].join(" ").toLowerCase();
    return hay.includes(q);
  }

  _listHtml() {
    const d = this.draft;
    if (!d.monitors.length) return `<div class="ag-card ag-empty"><span class="ag-t2">${esc(this._t("monEmpty"))}</span></div>`;
    const shown = d.monitors.map((m, i) => (this._matches(m) ? this._rule(m, i) : "")).join("");
    return shown || `<div class="ag-card ag-empty"><span class="ag-t2">${esc(this._t("monNoMatch"))}</span></div>`;
  }

  _rule(m, i) {
    const on = m.enabled !== false;
    const active = this.system?.monitor_active?.[m.id];
    const since = active?.since ? new Date(active.since).toLocaleString(this.host._hass?.locale?.language || undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";
    const tag = active ? `<span class="ag-tag warn">${ic("alert", 13)}${esc(this._t("monActive", { since }))}</span>` : "";
    const full = this.draft.monitors.length >= MAX_MONITORS;
    const flow = (zone, steps, icon, cls, title) => {
      const plus = (at) => `<div class="ag-wf-plus ${at === steps.length ? "last" : ""}"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="mon-step-add" data-rule="${i}" data-zone="${zone}" data-at="${at}" aria-label="${esc(this._t("monStepAdd"))}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span></div>`;
      return `<div class="ag-wf-line ag-wf-mon-${zone}" data-zone="${zone}"><div class="ag-wf-start"><span class="ag-mini ${cls}">${ic(icon, 20)}</span>${esc(this._t(title))}</div>${plus(0)}${steps.map((st, k) => this._card(st, i, zone, k) + plus(k + 1)).join("")}</div>`;
    };
    const folded = this.folded.has(m.id);
    return `<section class="ag-mon-rule ${on ? "" : "dim"} ${folded ? "folded" : ""} ${m.color ? "coloured" : ""}" data-rule-id="${esc(m.id)}" ${m.color ? `style="--mc:${esc(m.color)}"` : ""}>
      <div class="ag-mon-head"><button class="ag-cbtn ag-mon-fold ${folded ? "" : "open"}" data-wf="mon-fold" data-rule="${i}" aria-expanded="${!folded}" aria-label="${esc(this._t(folded ? "monUnfold" : "monFold"))}" title="${esc(this._t(folded ? "monUnfold" : "monFold"))}">${ic("chevRight", 16)}</button><button class="ag-toggle ${on ? "on" : ""}" data-wf="mon-on" data-rule="${i}" role="switch" aria-checked="${on}" aria-label="${esc(`${m.name}: ${this._t("monActiveSwitch")}`)}"></button>
        <span class="ag-oav ${on ? "on" : ""}">${ic(this._ruleIcon(m), 20)}</span>
        <div class="ag-settx"><h3 class="ag-chap-t">${esc(m.name)}</h3><small>${esc(this.ruleSub(m))}</small>${tag ? `<div class="ag-rttags">${tag}</div>` : ""}</div>
        <div class="ag-btnrow"><button class="ag-iconbtn" data-wf="mon-dup" data-rule="${i}" ${full ? "disabled" : ""} aria-label="${esc(this._t("monDuplicate"))}" title="${esc(this._t("monDuplicate"))}">${ic("copy", 18)}</button>
          <button class="ag-iconbtn" data-wf="mon-edit" data-rule="${i}" aria-label="${esc(this._t("monEdit"))}" title="${esc(this._t("monEdit"))}">${ic("pencil", 18)}</button>
          <button class="ag-iconbtn" data-wf="mon-del" data-rule="${i}" aria-label="${esc(this._t("monDelete"))}" title="${esc(this._t("monDelete"))}">${ic("trash", 18)}</button></div></div>
      ${folded ? "" : flow("out", m.steps_out, "alert", "warn", "monOutTitle") + flow("ok", m.steps_ok, "check", "ok", "monOkTitle")}</section>`;
  }

  _ruleIcon(m) {
    const first = (m.tree.items[0]?.items?.[0] || m.tree.items[0]);
    const dc = this.ents?.byId[first?.entity_id]?.device_class || "";
    return dc === "temperature" ? "thermo" : first?.kind === "value" ? "gauge" : "eye";
  }

  _card(st, ruleIndex, zone, k) {
    const kind = st.type;
    const icon = kind === "notify" ? "bell" : kind === "wait" ? "timer" : "power";
    const title = this._t(STEP_KINDS.find((x) => x[0] === kind)[1]);
    const steps = this.draft.monitors[ruleIndex][`steps_${zone}`];
    return `<div class="ag-card ag-wf-step" data-index="${k}"><span class="ag-wf-icon k-${kind}">${ic(icon, 20)}</span>
      <div class="ag-wf-text"><b>${esc(title)}</b><div class="ag-t2 ag-small">${esc(this.stepSummary(st))}</div><span class="ag-zone">${esc(this._t(zone === "out" ? "monOutTitle" : "monOkTitle"))}</span></div>
      <div class="ag-wf-btns"><button class="ag-iconbtn" data-wf="mon-step-edit" data-rule="${ruleIndex}" data-zone="${zone}" data-index="${k}" aria-label="${esc(this._t("stepEdit"))}">${ic("pencil", 18)}</button>
        <button class="ag-iconbtn" data-wf="mon-step-dup" data-rule="${ruleIndex}" data-zone="${zone}" data-index="${k}" ${steps.length >= MAX_STEPS ? "disabled" : ""} aria-label="${esc(this._t("stepDuplicate"))}" title="${esc(this._t("stepDuplicate"))}">${ic("copy", 18)}</button>
        <button class="ag-iconbtn" data-wf="mon-step-del" data-rule="${ruleIndex}" data-zone="${zone}" data-index="${k}" aria-label="${esc(this._t("stepDelete"))}">${ic("trash", 18)}</button></div></div>`;
  }

  renderFoot() {
    const h = this.host;
    h._renderDots?.();
    const foot = h._view?.querySelector(".ag-foot");
    if (!foot) return;
    const n = this.dirtyCount();
    let status;
    if (this.saveState === "saved" && !n) status = `<span class="ag-saved">${ic("check", 16)} ${esc(this._t("saved"))}</span>`;
    else if (this.saveState && this.saveState !== "saved") status = `<span class="ag-err">${esc(this.saveState)}</span>`;
    else status = `<span class="ag-t2">${esc(n === 0 ? this._t("noChanges") : n === 1 ? this._t("change") : this._t("changes", { count: n }))}</span>`;
    h._setHtml(foot, `${status}<span class="ag-grow"></span><button class="ag-btn" data-wf="mon-cancel" ${n ? "" : "disabled"}>${esc(this._t("cancel"))}</button>
      <button class="ag-btn primary" data-wf="mon-save" ${n && !this.saving ? "" : "disabled"}>${ic("check", 18)}${esc(this._t("save"))}</button>`);
  }

  async save() {
    const h = this.host;
    const s = this.system;
    const d = this.draft;
    if (!s || !d || this.saving || !this.dirtyCount()) return;
    this.saving = true;
    this.renderFoot();
    try {
      const saved = await h._hass.callWS({ type: "alarmageddon/save_monitors", entry_id: s.entry_id, monitors: clone(d.monitors) });
      s.monitors = clone(d.monitors);
      this.draft = null;
      this.saveState = "saved";
      if (!this.ui.flowDirty?.()) h._markSaved(this.ui);
      if (saved?.reload !== false) h._reloadWait(s.entry_id);
      else h._fetch();
    } catch (err) {
      this.saveState = this._t("saveFailed", { message: errText(err) });
    } finally {
      this.saving = false;
      this.ui.render();
    }
  }

  // ----- Editor der Regel -----

  blank() {
    return { id: newId(), name: "", enabled: true, color: "", tree: { op: "and", items: [] }, holdN: 30, holdUnit: "m", margin: 0, remind: 0, steps_out: [], steps_ok: [] };
  }

  open(index) {
    const d = this.ensureDraft();
    let f;
    if (index >= 0) {
      const m = clone(d.monitors[index]);
      const unit = m.hold >= 3600 && m.hold % 3600 === 0 ? "h" : m.hold >= 60 && m.hold % 60 === 0 ? "m" : m.hold === 0 ? "m" : "s";
      f = { ...m, holdN: m.hold / UNITS[unit], holdUnit: unit };
    } else f = this.blank();
    this.form = f;
    this.index = index;
    this.pick = null;
    this.snap = JSON.stringify(f);
    this.renderDlg();
    if (!this._bound) {
      this.dlg.addEventListener("close", () => {
        this.form = null;
        this.pick = null;
      });
      this._bound = true;
    }
    if (!this.dlg.open) this.dlg.showModal();
    if (!this.ents) this.load();
  }

  formDirty() {
    return Boolean(this.form) && JSON.stringify(this.form) !== this.snap;
  }

  close() {
    this.form = null;
    this.pick = null;
    if (this.dlg?.open) this.dlg.close();
  }

  _leaves() {
    return this.form.tree.items.flatMap((i) => (i.items ? i.items : [i]));
  }

  _node(path) {
    const parts = String(path).split(".").map(Number);
    let node = this.form.tree.items[parts[0]];
    if (parts.length > 1) node = node.items[parts[1]];
    return node;
  }

  _list(path) {
    return path === "" || path === undefined ? this.form.tree.items : this.form.tree.items[Number(path)].items;
  }

  holdSeconds(f = this.form) {
    return Math.round(num(f.holdN) * UNITS[f.holdUnit]);
  }

  problems() {
    const f = this.form;
    const bad = [];
    const name = f.name.trim();
    if (!name || name.length > NAME_MAX) bad.push("name");
    else if (this.draft.monitors.some((m, i) => i !== this.index && m.name.trim().toLowerCase() === name.toLowerCase())) bad.push("nameTaken");
    const leaves = this._leaves();
    const groups = f.tree.items.filter((i) => i.items);
    const dev = leaves.filter((l) => l.kind === "value" || l.kind === "state");
    const badDev = (l) => !l.entity_id || (l.kind === "state" ? !l.state : !Number.isFinite(num(l.limit)) || (l.op === "outside" && !(num(l.upper) > num(l.limit))));
    if (!dev.length || dev.some(badDev)) bad.push("noDevice");
    if (groups.some((g) => !g.items.length)) bad.push("emptyGroup");
    if (leaves.some((l) => l.kind === "time" && (!CLOCK_RE.test(l.from) || !CLOCK_RE.test(l.to) || l.from === l.to))) bad.push("window");
    if (leaves.length > MAX_LEAVES || groups.length > MAX_GROUPS) bad.push("tooMany");
    const hold = this.holdSeconds();
    if (!Number.isInteger(hold) || hold < 0 || hold > HOLD_MAX) bad.push("hold");
    const margin = num(f.margin);
    if (!(margin >= 0) || margin > 100000) bad.push("margin");
    const remind = num(f.remind);
    if (!Number.isInteger(remind) || remind < 0 || remind > REMIND_MAX) bad.push("remind");
    return bad;
  }

  build() {
    const f = this.form;
    return normMonitor({ id: f.id, name: f.name.trim(), enabled: f.enabled !== false, color: f.color || "", tree: f.tree, hold: this.holdSeconds(), margin: this._hasValue() ? num(f.margin) : 0, remind: num(f.remind), steps_out: f.steps_out, steps_ok: f.steps_ok });
  }

  _hasValue() {
    return this._leaves().some((l) => l.kind === "value");
  }

  saveForm() {
    if (!this.form || this.problems().length) return;
    const m = this.build();
    const d = this.draft;
    if (this.index >= 0) d.monitors[this.index] = m;
    else d.monitors.push(m);
    this.saveState = null;
    this.close();
    this.ui.render();
  }

  _seg(name, items, current) {
    return `<div class="ag-seg small" role="tablist" data-seg="mon-${name}">${items
      .map(([key, label, icon]) => `<button role="tab" data-wf="mon-seg" data-key="${name}" data-value="${key}" class="${current === key ? "on" : ""}" aria-selected="${current === key}">${icon ? ic(icon, 18) : ""}<span>${esc(label)}</span></button>`)
      .join("")}</div>`;
  }

  _opSeg(path, op) {
    return `<div class="ag-seg small" role="tablist" data-seg="mon-op-${path || "root"}">${[["and", this._t("monAllOf")], ["or", this._t("monAnyOf")]]
      .map(([key, label]) => `<button role="tab" data-wf="mon-op" data-path="${path}" data-value="${key}" class="${op === key ? "on" : ""}" aria-selected="${op === key}"><span>${esc(label)}</span></button>`).join("")}</div>`;
  }

  _leafRow(leaf, path, bad) {
    const rm = `<button class="ag-iconbtn" data-wf="mon-leaf-del" data-path="${path}" aria-label="${esc(this._t("monRemove"))}">${ic("trash", 18)}</button>`;
    if (leaf.kind === "time") {
      const off = bad.has("window") && (!CLOCK_RE.test(leaf.from) || !CLOCK_RE.test(leaf.to) || leaf.from === leaf.to);
      return `<div class="ag-rtleaf ag-rttime"><span class="ag-rtdev static">${ic("clock", 18)}<b>${esc(this._t("monTimeWindow"))}</b></span>
        <span class="ag-t2">${esc(this._t("monFrom"))}</span><input type="time" class="ag-input ag-time ${off ? "bad" : ""}" data-wf="mon-from" data-path="${path}" value="${esc(leaf.from)}" aria-label="${esc(this._t("monFrom"))}">
        <span class="ag-t2">${esc(this._t("monTo"))}</span><input type="time" class="ag-input ag-time ${off ? "bad" : ""}" data-wf="mon-to" data-path="${path}" value="${esc(leaf.to)}" aria-label="${esc(this._t("monTo"))}">${rm}</div>`;
    }
    if (leaf.kind === "armed") {
      return `<div class="ag-rtleaf"><span class="ag-rtdev static">${ic("shield", 18)}<b>${esc(this._t("monArmedLabel"))}</b></span>
        <span class="ag-chips">${ALL_MODES.map((m) => `<button class="ag-chip ${(leaf.modes || []).includes(m) ? "on" : ""}" data-wf="mon-armed-mode" data-path="${path}" data-mode="${m}" aria-pressed="${(leaf.modes || []).includes(m)}">${esc(this._t(MODE_KEY[m]))}</button>`).join("")}</span>${rm}
        <small class="ag-t2 ag-rtnote">${esc(this._t("monArmedAny"))}</small></div>`;
    }
    const missing = leaf.entity_id && this.ents && !this.ents.byId[leaf.entity_id];
    const gone = missing ? `<small class="ag-warntext ag-rtnote">${ic("alert", 14)} ${esc(this._t("monDeviceGone"))}</small>` : "";
    if (leaf.kind === "value") {
      const u = this.unitOf(leaf.entity_id);
      const badNum = (v) => bad.has("noDevice") && !Number.isFinite(num(v));
      const badUpper = leaf.op === "outside" && bad.has("noDevice") && !(num(leaf.upper) > num(leaf.limit));
      const field = (key, value, label, off) => `<input type="number" step="any" inputmode="decimal" class="ag-input ag-valnum ${off ? "bad" : ""}" data-wf="mon-num" data-field="${key}" data-path="${path}" value="${esc(value ?? "")}" aria-label="${esc(label)}">`;
      return `<div class="ag-rtleaf"><button class="ag-rtdev" data-wf="mon-pick" data-path="${path}" data-kind="value" aria-label="${esc(this._t("monChooseSensor"))}">${ic("gauge", 18)}<b>${esc(leaf.entity_id ? this.deviceName(leaf.entity_id) : this._t("monChooseSensor"))}</b></button>
        ${this._seg(`opx${path}`, [["above", this._t("monOp_above")], ["below", this._t("monOp_below")], ["outside", this._t("monOp_outside")]], leaf.op).replace(/data-wf="mon-seg" data-key="[^"]*"/g, `data-wf="mon-leaf-op" data-path="${path}"`)}
        ${field("limit", leaf.limit, this._t("monLimit"), badNum(leaf.limit))}${leaf.op === "outside" ? `<span class="ag-t2">${esc(this._t("monTo"))}</span>${field("upper", leaf.upper, this._t("monUpper"), badUpper)}` : ""}${u ? `<span class="ag-t2">${esc(u)}</span>` : ""}${rm}${gone}</div>`;
    }
    const options = this.ents?.byId[leaf.entity_id]?.states || (leaf.entity_id ? [leaf.state] : []);
    return `<div class="ag-rtleaf"><button class="ag-rtdev" data-wf="mon-pick" data-path="${path}" data-kind="state" aria-label="${esc(this._t("monChooseDevice"))}">${ic("sensor", 18)}<b>${esc(leaf.entity_id ? this.deviceName(leaf.entity_id) : this._t("monChooseDevice"))}</b></button>
      <span class="ag-t2">${esc(this._t("monIs"))}</span>
      <select class="ag-input" data-wf="mon-state" data-path="${path}" aria-label="${esc(this._t("monState"))}" ${leaf.entity_id ? "" : "disabled"}>${options.map((s) => `<option value="${esc(s)}" ${s === leaf.state ? "selected" : ""}>${esc(this.stateText(leaf.entity_id, s))}</option>`).join("")}</select>${rm}${gone}</div>`;
  }

  _treeHtml(bad) {
    const tree = this.form.tree;
    const leaves = this._leaves();
    const groups = tree.items.filter((i) => i.items);
    const can = leaves.length < MAX_LEAVES;
    const add = (path) => `<div class="ag-rtadd"><button class="ag-btn" data-wf="mon-add-leaf" data-kind="value" data-path="${path}" ${can ? "" : "disabled"}>${ic("gauge", 18)}${esc(this._t("monAddValue"))}</button>
      <button class="ag-btn" data-wf="mon-add-leaf" data-kind="state" data-path="${path}" ${can ? "" : "disabled"}>${ic("sensor", 18)}${esc(this._t("monAddDevice"))}</button>
      <button class="ag-btn" data-wf="mon-add-leaf" data-kind="armed" data-path="${path}" ${can ? "" : "disabled"}>${ic("shield", 18)}${esc(this._t("monAddArmed"))}</button>
      <button class="ag-btn" data-wf="mon-add-leaf" data-kind="time" data-path="${path}" ${can ? "" : "disabled"}>${ic("clock", 18)}${esc(this._t("monAddTime"))}</button>${path === "" ? `<button class="ag-btn" data-wf="mon-add-group" ${groups.length < MAX_GROUPS ? "" : "disabled"}>${ic("plus", 18)}${esc(this._t("monAddGroup"))}</button>` : ""}</div>`;
    const items = tree.items.map((item, i) => {
      if (!item.items) return this._leafRow(item, String(i), bad);
      return `<div class="ag-rtgroup"><div class="ag-rtghead"><b>${esc(this._t("monGroup"))}</b>${this._opSeg(String(i), item.op)}
        <button class="ag-iconbtn" data-wf="mon-leaf-del" data-path="${i}" aria-label="${esc(this._t("monRemove"))}">${ic("trash", 18)}</button></div>
        ${item.items.map((l, j) => this._leafRow(l, `${i}.${j}`, bad)).join("")}${item.items.length ? "" : `<small class="ag-err">${esc(this._t("monEmptyGroup"))}</small>`}${add(String(i))}</div>`;
    }).join("");
    return `<div class="ag-card ag-rttree"><div class="ag-rtghead">${this._opSeg("", tree.op)}</div>${items || `<div class="ag-t2 ag-rtnone">${esc(this._t("monTreeEmpty"))}</div>`}${add("")}</div>`;
  }

  // Einheit der Rückkehr-Spanne: die des ersten Messwerts der Regel
  // Darstellung: eine von zehn Farben oder keine (Standard); die Karte der Regel färbt sich damit per Verlauf ein
  _colorsHtml() {
    const cur = this.form.color || "";
    const sw = (value, label, style) => `<button type="button" class="ag-swatch ${cur === value ? "on" : ""}" data-wf="mon-color" data-value="${esc(value)}" role="radio" aria-checked="${cur === value}" aria-label="${esc(label)}" title="${esc(label)}" ${style}>${cur === value ? ic("check", 16) : ""}</button>`;
    return `<div class="ag-swatches" role="radiogroup" aria-label="${esc(this._t("monAppearance"))}">${sw("", this._t("monColorNone"), "")}${COLORS.map(([hex, key]) => sw(hex, this._t(`monColor_${key}`), `style="--sw:${hex}"`)).join("")}</div>`;
  }

  _marginUnit() {
    const leaf = this._leaves().find((l) => l.kind === "value" && l.entity_id);
    return leaf ? this.unitOf(leaf.entity_id) : "";
  }

  _num(field, value, unit, bad, min = 0) {
    return `<span class="ag-num ${bad ? "bad" : ""}"><input type="number" min="${min}" step="any" inputmode="decimal" data-wf="mon-field" data-field="${field}" value="${esc(value)}" aria-label="${esc(this._t(`mon_${field}`))}"><span class="ag-t2">${esc(unit)}</span></span>`;
  }

  editorHtml() {
    const f = this.form;
    const bad = new Set(this.problems());
    const message = bad.has("name") ? this._t("monErrName") : bad.has("nameTaken") ? this._t("monErrNameTaken") : bad.has("noDevice") ? this._t("monErrNoDevice") : bad.has("emptyGroup") ? this._t("monEmptyGroup")
      : bad.has("window") ? this._t("monErrWindow") : bad.has("tooMany") ? this._t("monErrTooMany") : bad.has("hold") ? this._t("monErrHold") : bad.has("margin") ? this._t("monErrMargin")
      : bad.has("remind") ? this._t("invalidNumber", { min: 0, max: REMIND_MAX }) : "";
    const nameField = `<input class="ag-input ag-rtname ${bad.has("name") || bad.has("nameTaken") ? "bad" : ""}" data-wf="mon-name" maxlength="${NAME_MAX}" value="${esc(f.name)}" placeholder="${esc(this._t("monNamePh"))}" aria-label="${esc(this._t("monName"))}">`;
    const unitSel = `<select class="ag-input ag-unit" data-wf="mon-holdunit" aria-label="${esc(this._t("monHoldUnit"))}">${[["s", "monUnitSeconds"], ["m", "monUnitMinutes"], ["h", "monUnitHours"]].map(([k, l]) => `<option value="${k}" ${f.holdUnit === k ? "selected" : ""}>${esc(this._t(l))}</option>`).join("")}</select>`;
    const rows = `<div class="ag-card ag-setlist">
      <div class="ag-setrow"><div class="ag-settx"><b>${esc(this._t("monHold"))}</b><small>${esc(this._t("monHoldHint"))}</small></div>
        <span class="ag-num ${bad.has("hold") ? "bad" : ""}"><input type="number" min="0" step="any" inputmode="decimal" data-wf="mon-field" data-field="holdN" value="${esc(f.holdN)}" aria-label="${esc(this._t("monHold"))}">${unitSel}</span></div>
      ${this._hasValue() ? `<div class="ag-setrow"><div class="ag-settx"><b>${esc(this._t("monMargin"))}</b><small>${esc(this._t("monMarginHint"))}</small></div>${this._num("margin", f.margin, this._marginUnit(), bad.has("margin"))}</div>` : ""}
      <div class="ag-setrow"><div class="ag-settx"><b>${esc(this._t("monRemind"))}</b><small>${esc(this._t("monRemindHint"))}</small></div>${this._num("remind", f.remind, this._t("monUnitHours"), bad.has("remind"))}</div></div>`;
    return `<div class="ag-dlg-body ag-rt-ed"><h3>${esc(this._t(this.index >= 0 ? "monEditTitle" : "monNewTitle"))}</h3>
      ${chapter(this._t("monName"), nameField)}
      ${chapter(this._t("monIfTitle"), this._treeHtml(bad), this._t("monIfHint"))}
      ${chapter(this._t("monTimingTitle"), rows)}
      ${chapter(this._t("monAppearance"), this._colorsHtml(), this._t("monAppearanceHint"))}
      <div class="ag-dlg-err ${message ? "show" : ""}" aria-live="polite">${esc(message)}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-wf="mon-cancel-form">${esc(this._t("cancel"))}</button>
        <button class="ag-btn primary" data-wf="mon-save-form" ${message ? "disabled" : ""}>${ic("check", 18)}${esc(this._t("apply"))}</button></div></div>`;
  }

  // ----- Auswahl eines Sensors oder Geräts (ersetzt den Inhalt des Fensters) -----

  pickHtml() {
    const p = this.pick;
    const chips = p.kind === "value" ? `<div class="ag-tools ag-pick-chips">${VALUE_FILTERS.map(([key, label]) => `<button class="ag-chip ${p.filter === key ? "on" : ""}" data-wf="mon-filter" data-value="${key}">${esc(this._t(label))}</button>`).join("")}</div>` : "";
    return `<div class="ag-dlg-body ag-rt-pick"><h3>${esc(this._t(p.kind === "value" ? "monPickValue" : "monPickDevice"))}</h3>
      <div class="ag-t2">${esc(this._t(p.kind === "value" ? "monPickValueHint" : "monPickDeviceHint"))}</div>
      <label class="list-search" style="margin-top:12px">${ic("search", 18)}<input type="search" data-wf="mon-q" value="${esc(p.q)}" placeholder="${esc(this._t("search"))}" aria-label="${esc(this._t("search"))}" autocomplete="off">
        <button type="button" class="ag-clear" data-wf="mon-q-clear" aria-label="${esc(this._t("clearSearch"))}" ${p.q ? "" : "hidden"}>${ic("close", 16)}</button></label>${chips}
      <div class="ag-elist ag-rtlist" style="margin-top:10px;max-height:min(46vh,380px)">${this.pickList()}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-wf="mon-pick-back">${esc(this._t("rtBack"))}</button></div></div>`;
  }

  pickList() {
    if (!this.ents) return `<div class="ag-t2 ag-rtnone">${esc(this._t("rtLoading"))}</div>`;
    const p = this.pick;
    const group = VALUE_FILTERS.find((x) => x[0] === p.filter)?.[2];
    const q = p.q.trim().toLowerCase();
    // Messwerte nur aus der Sensorliste der Anlage (Konfiguration › Sensoren › Hinzufügen); Geräte mit Zuständen sind alle wählbar
    const mine = new Set(this.system?.monitor_sensors || []);
    const list = this.ents.list.filter((e) => e.kind === p.kind && (e.kind !== "value" || mine.has(e.entity_id)) && (!group || group.includes(e.device_class))
      && (!q || `${e.name} ${e.area} ${e.entity_id}`.toLowerCase().includes(q)));
    if (!list.length) return `<div class="ag-t2 ag-rtnone">${esc(this._t(this.ents.failed ? "rtLoadFailed" : p.kind === "value" && !mine.size ? "monNoValues" : "monNoDevices"))}</div>`;
    return list.slice(0, 200).map((e) => {
      const now = e.kind === "value" ? `${["unavailable", "unknown"].includes(e.state) ? "–" : e.state}${e.unit ? ` ${e.unit}` : ""}` : this.stateText(e.entity_id, e.state);
      return `<button class="ag-rtent" data-wf="mon-choose" data-id="${esc(e.entity_id)}"><span class="ag-oav">${ic(e.kind === "value" ? (e.device_class === "temperature" ? "thermo" : "gauge") : "sensor", 20)}</span>
        <span class="ag-grow"><b>${esc(e.name)}</b><small class="ag-t2">${esc([e.area, now].filter(Boolean).join(" · "))}</small></span></button>`;
    }).join("") + (list.length > 200 ? `<div class="ag-t2 ag-rtnone">${esc(this._t("rtMore", { count: list.length - 200 }))}</div>` : "");
  }

  renderDlg() {
    const h = this.host;
    if (!this.form) return;
    h._lastHtml.delete(this.dlg);
    h._setHtml(this.dlg, this.pick ? this.pickHtml() : this.editorHtml());
    h._placePills();
  }

  // ----- Fenster eines Schrittes -----

  openStep(zone, ruleIndex, index, at) {
    const d = this.ensureDraft();
    const steps = d.monitors[ruleIndex][`steps_${zone}`];
    const form = index >= 0 ? this._stepForm(steps[index]) : this._stepForm({ type: "notify" });
    this.step = { zone, rule: ruleIndex, index, at: at ?? steps.length, form, pick: null, snap: "" };
    this.step.snap = JSON.stringify(form);
    this.renderStep();
    if (!this._sbound) {
      this.sdlg.addEventListener("close", () => {
        this.step = null;
      });
      this._sbound = true;
    }
    if (!this.sdlg.open) this.sdlg.showModal();
  }

  _stepForm(st) {
    if (st.type === "wait") {
      const s = Number(st.seconds) || 0;
      const unit = s >= 60 && s % 60 === 0 ? "m" : "s";
      return { type: "wait", n: s / UNITS[unit], unit };
    }
    if (st.type === "action") {
      const [domain, service] = (st.action || "").split(".");
      const known = (ACTIONS[domain] || []).some((a) => a[0] === service) && (st.target || []).length === 1 && !Object.keys(st.data || {}).length;
      return { type: "action", entity: (st.target || [])[0] || "", service: known ? service : (ACTIONS[domain]?.[0]?.[0] || ""), raw: known || !st.action ? null : clone(st) };
    }
    return { type: "notify", title: st.title || "", message: st.message || "", critical: Boolean(st.critical), volume: st.volume ?? 1, targets: [...(st.targets || [])] };
  }

  _stepBuild(form) {
    if (form.type === "wait") return { type: "wait", seconds: Math.round(num(form.n) * UNITS[form.unit]) };
    if (form.type === "action") {
      if (form.raw) return form.raw;
      const domain = form.entity.split(".")[0];
      return { type: "action", action: `${domain}.${form.service}`, target: [form.entity], data: {} };
    }
    return normStep({ type: "notify", title: form.title.trim(), message: form.message.trim(), critical: form.critical, ...(form.critical ? { volume: Number(form.volume) } : {}), targets: form.targets });
  }

  _stepProblem(form) {
    if (form.type === "wait") {
      const s = Math.round(num(form.n) * UNITS[form.unit]);
      return !(s >= 0 && s <= WAIT_MAX) ? this._t("invalidNumber", { min: 0, max: WAIT_MAX / 60 }) : "";
    }
    if (form.type === "action") return form.raw || (form.entity && form.service) ? "" : this._t("monErrAction");
    return "";
  }

  _actionEntities() {
    const states = this.host._hass?.states || {};
    return Object.keys(states).filter((id) => ACTIONS[id.split(".")[0]]).map((id) => ({ id, name: states[id].attributes?.friendly_name || id, domain: id.split(".")[0] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Platzhalter als Pillen unter dem Feld: Antippen fügt sie an der Schreibmarke des Feldes ein (Titel und Text je eigene Reihe)
  _phRow(field) {
    return `<div class="ag-ph" role="group" aria-label="${esc(this._t("monPlaceholders"))}">${PLACEHOLDERS.map((k) => `<button type="button" class="ag-phpill" data-wf="mon-ph" data-field="${field}" data-ph="{${k}}" title="${esc(this._t(`monPh_${k}`))}">{${k}}</button>`).join("")}</div>`;
  }

  // Vorschau der Meldung mit aufgelösten Platzhaltern: Werte des ersten Sensors oder Geräts der Regel, so wie sie jetzt sind
  _previewValues() {
    const rule = this.draft?.monitors?.[this.step?.rule];
    const leaves = (rule?.tree?.items || []).flatMap((i) => (i.items ? i.items : [i])).filter((l) => (l.kind === "value" || l.kind === "state") && l.entity_id);
    const leaf = leaves[0];
    const st = leaf ? this.host._hass?.states?.[leaf.entity_id] : null;
    const bad = !st || ["unavailable", "unknown"].includes(st.state);
    const unit = leaf?.kind === "value" ? this.unitOf(leaf.entity_id) : "";
    const num = Number(st?.state);
    const limit = !leaf ? "" : leaf.kind === "value" ? (leaf.op === "outside" ? `${fmt(leaf.limit)}–${fmt(leaf.upper)}` : fmt(leaf.limit)) : leaf.state;
    const when = new Date().toLocaleString(this.host._hass?.locale?.language || undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return { rule: rule?.name || "…", sensor: leaf ? this.deviceName(leaf.entity_id) : "…", value: bad ? "–" : leaf.kind === "value" && Number.isFinite(num) ? fmt(num) : leaf ? this.stateText(leaf.entity_id, st.state) : "", unit, limit, since: when, name: this.system?.title || "", kind: leaf?.kind || "" };
  }

  _previewHtml() {
    const { form, zone } = this.step;
    const v = this._previewValues();
    const fill = (t) => t.replace(/\{(rule|sensor|value|unit|limit|since|name)\}/g, (_m, k) => v[k]).replace(/[ \t]{2,}/g, " ").trim();
    const val = `${v.value} ${v.unit}`.trim();
    const lim = v.kind === "value" ? this._t("monPrevLimit", { limit: `${v.limit} ${v.unit}`.trim() }) : "";
    const title = form.title.trim() ? fill(form.title) : `${zone === "ok" ? "✅" : "⚠️"} ${v.rule}`;
    const body = form.message.trim() ? fill(form.message) : this._t(zone === "ok" ? "monPrevOk" : "monPrevOut", { sensor: v.sensor, value: val, limit: lim, since: v.since });
    return `<div class="ag-ef"><label class="ag-ef-l">${esc(this._t("monPreview"))}</label>
      <div class="ag-push ${form.critical ? "crit" : ""}" data-prev><div class="ag-push-h"><span class="ag-push-ic">${ic("bell", 14)}</span><span>Alarmageddon</span><span class="ag-push-t">${esc(this._t("monPrevNow"))}</span>${form.critical ? `<span class="ag-tag err">${esc(this._t("monCritical"))}</span>` : ""}</div>
        <b data-prev-title>${esc(title)}</b><div data-prev-body>${esc(body)}</div></div>
      <span class="ag-ef-h">${esc(this._t("monPreviewHint"))}</span></div>`;
  }

  insertPlaceholder(field, token) {
    const input = this.sdlg.querySelector(`[data-wf="mon-sf"][data-field="${field}"]`);
    if (!input || !this.step) return;
    const max = Number(input.maxLength) > 0 ? input.maxLength : Infinity;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const value = input.value.slice(0, start) + token + input.value.slice(end);
    if (value.length > max) return;
    input.value = value;
    this.step.form[field] = value;
    input.focus();
    input.setSelectionRange(start + token.length, start + token.length);
    this._refreshStepMessage();
  }

  stepHtml() {
    const { form, zone } = this.step;
    const problem = this._stepProblem(form);
    if (this.step.pick) {
      const q = this.step.pick.q.trim().toLowerCase();
      const list = this._actionEntities().filter((e) => !q || `${e.name} ${e.id}`.toLowerCase().includes(q)).slice(0, 200);
      return `<div class="ag-dlg-body ag-rt-pick"><h3>${esc(this._t("monPickAction"))}</h3>
        <label class="list-search" style="margin-top:12px">${ic("search", 18)}<input type="search" data-wf="mon-sq" value="${esc(this.step.pick.q)}" placeholder="${esc(this._t("search"))}" aria-label="${esc(this._t("search"))}" autocomplete="off"></label>
        <div class="ag-elist ag-rtlist" style="margin-top:10px;max-height:min(46vh,380px)">${list.map((e) => `<button class="ag-rtent" data-wf="mon-schoose" data-id="${esc(e.id)}"><span class="ag-oav">${ic(DOMAIN_ICON[e.domain] || "power", 20)}</span><span class="ag-grow"><b>${esc(e.name)}</b></span></button>`).join("") || `<div class="ag-t2 ag-rtnone">${esc(this._t("monNoDevices"))}</div>`}</div>
        <div class="ag-dlg-btns"><button class="ag-btn" data-wf="mon-spick-back">${esc(this._t("rtBack"))}</button></div></div>`;
    }
    const kinds = this._seg("kind", STEP_KINDS.map(([k, l, i]) => [k, this._t(l), i]), form.type).replace(/data-wf="mon-seg" data-key="kind"/g, 'data-wf="mon-skind"');
    let body = "";
    if (form.type === "notify") {
      const services = this.host._data?.notify_services || [];
      const free = services.filter((s) => !form.targets.includes(s));
      const short = (s) => s.replace(/^notify\./, "");
      const pills = form.targets.map((s) => `<span class="ag-rpill ${services.includes(s) ? "" : "gone"}">${ic("bell", 14)}<span>${esc(short(s))}</span><button type="button" class="ag-rx" data-wf="mon-target-del" data-target="${esc(s)}" aria-label="${esc(short(s))}">${ic("close", 14)}</button></span>`).join("");
      const select = free.length ? `<select class="ag-input" data-wf="mon-target-add" aria-label="${esc(this._t("monTargetAdd"))}"><option value="">${esc(this._t("monTargetAdd"))}</option>${free.map((s) => `<option value="${esc(s)}">${esc(short(s))}</option>`).join("")}</select>` : "";
      body = `<div class="ag-ef"><label class="ag-ef-l">${esc(this._t("monTitleField"))}</label><input class="ag-input" data-wf="mon-sf" data-field="title" maxlength="100" value="${esc(form.title)}" placeholder="${esc(this._t("monTitlePh"))}">${this._phRow("title")}</div>
        <div class="ag-ef"><label class="ag-ef-l">${esc(this._t("monMessageField"))}</label><textarea class="ag-input" data-wf="mon-sf" data-field="message" maxlength="300" rows="3" placeholder="${esc(this._t("monMessagePh"))}">${esc(form.message)}</textarea>
          ${this._phRow("message")}</div>
        ${this._previewHtml()}
        <div class="ag-ef"><label class="ag-ef-l">${esc(this._t("monRecipients"))}</label><div class="ag-rpills">${pills || `<span class="ag-t2 ag-small">${esc(this._t("monDefaultTargets"))}</span>`}</div>${select}<span class="ag-ef-h">${esc(this._t("monRecipientsHint"))}</span></div>
        <div class="ag-ef-row"><button class="ag-toggle ${form.critical ? "on" : ""}" data-wf="mon-critical" role="switch" aria-checked="${form.critical}" aria-label="${esc(this._t("monCriticalLabel"))}"></button>
          <div class="ag-settx"><b>${esc(this._t("monCriticalLabel"))}</b><small>${esc(this._t("monCriticalHint"))}</small></div></div>`;
    } else if (form.type === "action") {
      const domain = form.entity.split(".")[0];
      const choices = ACTIONS[domain] || [];
      const device = `<button class="ag-rtdev" data-wf="mon-spick" aria-label="${esc(this._t("monChooseAction"))}">${ic(DOMAIN_ICON[domain] || "power", 18)}<b>${esc(form.entity ? this.deviceName(form.entity) : this._t("monChooseAction"))}</b></button>`;
      body = form.raw
        ? `<div class="ag-ef"><div class="ag-t2">${esc(this._t("monRawAction", { action: form.raw.action }))}</div></div>`
        : `<div class="ag-ef"><label class="ag-ef-l">${esc(this._t("monDevice"))}</label>${device}</div>
          <div class="ag-ef"><label class="ag-ef-l">${esc(this._t("monDo"))}</label><select class="ag-input" data-wf="mon-sf" data-field="service" ${choices.length ? "" : "disabled"}>${choices.map(([k, l]) => `<option value="${k}" ${k === form.service ? "selected" : ""}>${esc(this._t(l))}</option>`).join("")}</select></div>`;
    } else {
      body = `<div class="ag-ef"><label class="ag-ef-l">${esc(this._t("monWaitFor"))}</label><span class="ag-num ${problem ? "bad" : ""}"><input type="number" min="0" step="any" inputmode="decimal" data-wf="mon-sf" data-field="n" value="${esc(form.n)}">
        <select class="ag-input ag-unit" data-wf="mon-sf" data-field="unit">${[["s", "monUnitSeconds"], ["m", "monUnitMinutes"]].map(([k, l]) => `<option value="${k}" ${form.unit === k ? "selected" : ""}>${esc(this._t(l))}</option>`).join("")}</select></span>
        <span class="ag-ef-h">${esc(this._t("monWaitHint"))}</span></div>`;
    }
    return `<div class="ag-dlg-body"><h3>${esc(this._t(this.step.index >= 0 ? "monStepEditTitle" : "monStepNewTitle"))}</h3>
      <div class="ag-t2 ag-small">${esc(this._t(zone === "out" ? "monStepZoneOut" : "monStepZoneOk"))}</div>
      <div style="margin-top:12px">${kinds}</div>${body}
      <div class="ag-dlg-err ${problem ? "show" : ""}" aria-live="polite">${esc(problem)}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-wf="mon-step-cancel">${esc(this._t("cancel"))}</button>
        <button class="ag-btn primary" data-wf="mon-step-apply" ${problem ? "disabled" : ""}>${ic("check", 18)}${esc(this._t("apply"))}</button></div></div>`;
  }

  renderStep() {
    if (!this.step) return;
    this.host._lastHtml.delete(this.sdlg);
    this.host._setHtml(this.sdlg, this.stepHtml());
    this.host._placePills();
  }

  applyStep() {
    const st = this.step;
    if (!st || this._stepProblem(st.form)) return;
    const list = this.draft.monitors[st.rule][`steps_${st.zone}`];
    const built = this._stepBuild(st.form);
    if (st.index >= 0) list[st.index] = built;
    else list.splice(Math.min(st.at, list.length), 0, built);
    this.saveState = null;
    this.closeStep();
    this.ui.render();
  }

  closeStep() {
    this.step = null;
    if (this.sdlg?.open) this.sdlg.close();
  }

  // ----- Bedienung -----

  onClick(el) {
    const act = el.dataset.wf;
    const d = this.ensureDraft();
    const i = Number(el.dataset.rule);
    const zone = el.dataset.zone;
    const k = Number(el.dataset.index);
    const done = () => {
      this.saveState = null;
      this.ui.render();
    };
    // Seite
    if (act === "mon-add") this.open(-1);
    else if (act === "mon-edit") this.open(i);
    else if (act === "mon-fold") {
      const id = d.monitors[i].id;
      if (this.folded.has(id)) this.folded.delete(id);
      else this.folded.add(id);
      this.ui.render();
    } else if (act === "mon-fold-all") {
      if (this.folded.size >= d.monitors.length) this.folded.clear();
      else this.folded = new Set(d.monitors.map((m) => m.id));
      this.ui.render();
    } else if (act === "mon-search-clear") {
      const input = this.host._view.querySelector('[data-wf="mon-search"]');
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
    else if (act === "mon-on") {
      d.monitors[i].enabled = d.monitors[i].enabled === false;
      done();
    } else if (act === "mon-del") {
      d.monitors.splice(i, 1);
      done();
    } else if (act === "mon-dup") {
      const copy = clone(d.monitors[i]);
      copy.id = newId();
      let name = `${copy.name} ${this._t("monCopy")}`.slice(0, NAME_MAX);
      for (let n = 2; d.monitors.some((m) => m.name.toLowerCase() === name.toLowerCase()); n += 1) name = `${copy.name.slice(0, NAME_MAX - 4)} (${n})`;
      copy.name = name;
      d.monitors.splice(i + 1, 0, copy);
      done();
    } else if (act === "mon-step-add") this.openStep(zone, i, -1, Number(el.dataset.at));
    else if (act === "mon-step-edit") this.openStep(zone, i, k);
    else if (act === "mon-step-dup") {
      const list = d.monitors[i][`steps_${zone}`];
      if (list.length < MAX_STEPS) list.splice(k + 1, 0, clone(list[k]));
      done();
    } else if (act === "mon-step-del") {
      d.monitors[i][`steps_${zone}`].splice(k, 1);
      done();
    } else if (act === "mon-cancel") {
      this.draft = null;
      this.saveState = null;
      this.ui.render();
    } else if (act === "mon-save") this.save();
    // Fenster der Regel
    else if (act === "mon-cancel-form") this.close();
    else if (act === "mon-save-form") this.saveForm();
    else if (act === "mon-op") {
      const node = el.dataset.path === "" ? this.form.tree : this._node(el.dataset.path);
      node.op = el.dataset.value;
      this.renderDlg();
    } else if (act === "mon-add-leaf") {
      const kind = el.dataset.kind;
      const leaf = kind === "value" ? { kind, entity_id: "", op: "above", limit: "", upper: "" } : kind === "state" ? { kind, entity_id: "", state: "" }
        : kind === "armed" ? { kind, modes: [] } : { kind, from: "22:00", to: "06:00", days: [] };
      const list = this._list(el.dataset.path);
      list.push(leaf);
      const path = el.dataset.path === "" ? String(list.length - 1) : `${el.dataset.path}.${list.length - 1}`;
      if (kind === "value" || kind === "state") this.pick = { path, kind, q: "", filter: "all" };
      this.renderDlg();
    } else if (act === "mon-color") {
      this.form.color = el.dataset.value;
      this.renderDlg();
    } else if (act === "mon-add-group") {
      this.form.tree.items.push({ op: "and", items: [] });
      this.renderDlg();
    } else if (act === "mon-leaf-del") {
      const parts = el.dataset.path.split(".").map(Number);
      if (parts.length === 1) this.form.tree.items.splice(parts[0], 1);
      else this.form.tree.items[parts[0]].items.splice(parts[1], 1);
      this.renderDlg();
    } else if (act === "mon-leaf-op") {
      const leaf = this._node(el.dataset.path);
      leaf.op = el.dataset.value;
      if (leaf.op === "outside" && leaf.upper === undefined) leaf.upper = "";
      this.renderDlg();
    } else if (act === "mon-armed-mode") {
      const leaf = this._node(el.dataset.path);
      const set = new Set(leaf.modes || []);
      if (set.has(el.dataset.mode)) set.delete(el.dataset.mode);
      else set.add(el.dataset.mode);
      leaf.modes = ALL_MODES.filter((m) => set.has(m));
      this.renderDlg();
    } else if (act === "mon-pick") {
      this.pick = { path: el.dataset.path, kind: el.dataset.kind, q: "", filter: "all" };
      this.renderDlg();
      if (!this.ents) this.load();
    } else if (act === "mon-pick-back") {
      this.pick = null;
      this.renderDlg();
    } else if (act === "mon-filter") {
      this.pick.filter = el.dataset.value;
      this.renderDlg();
    } else if (act === "mon-q-clear") {
      const input = this.dlg.querySelector('[data-wf="mon-q"]');
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    } else if (act === "mon-choose") this._choose(el.dataset.id);
    // Fenster des Schrittes
    else if (act === "mon-step-cancel") this.closeStep();
    else if (act === "mon-step-apply") this.applyStep();
    else if (act === "mon-skind") {
      const type = el.dataset.value;
      if (this.step.form.type !== type) this.step.form = this._stepForm({ type });
      this.renderStep();
    } else if (act === "mon-spick") {
      this.step.pick = { q: "" };
      this.renderStep();
    } else if (act === "mon-spick-back") {
      this.step.pick = null;
      this.renderStep();
    } else if (act === "mon-schoose") {
      const id = el.dataset.id;
      const domain = id.split(".")[0];
      this.step.form.entity = id;
      this.step.form.raw = null;
      if (!(ACTIONS[domain] || []).some((a) => a[0] === this.step.form.service)) this.step.form.service = ACTIONS[domain][0][0];
      this.step.pick = null;
      this.renderStep();
    } else if (act === "mon-ph") {
      this.insertPlaceholder(el.dataset.field, el.dataset.ph);
    } else if (act === "mon-critical") {
      this.step.form.critical = !this.step.form.critical;
      this.renderStep();
    } else if (act === "mon-target-del") {
      this.step.form.targets = this.step.form.targets.filter((t) => t !== el.dataset.target);
      this.renderStep();
    } else return false;
    return true;
  }

  _choose(id) {
    const leaf = this._node(this.pick.path);
    const info = this.ents?.byId[id];
    leaf.entity_id = id;
    if (leaf.kind === "state") leaf.state = info?.states?.includes(leaf.state) ? leaf.state : info?.states?.[0] || "on";
    this.pick = null;
    this.renderDlg();
  }

  onInput(el) {
    const act = el.dataset.wf;
    if (!act || !act.startsWith("mon-")) return false;
    if (act === "mon-search") {
      // Nur die Liste neu zeichnen: das Suchfeld behält Fokus und Schreibmarke
      this.q = el.value;
      const view = this.host._view;
      view.querySelector('[data-wf="mon-search-clear"]').hidden = !this.q;
      const list = view.querySelector(".ag-mon-list");
      if (list && this.draft) list.innerHTML = this._listHtml();
      // Was die Seite jetzt zeigt, ist genau das, was ein Neuaufbau erzeugte: den Stand merken, sonst ersetzte der nächste Aufbau das Suchfeld
      const body = view.querySelector(".ag-wf");
      if (body) this.host._lastHtml.set(body, this.bodyHtml());
      return true;
    }
    if (act === "mon-q" && this.pick) {
      this.pick.q = el.value;
      this.dlg.querySelector('[data-wf="mon-q-clear"]').hidden = !el.value;
      const list = this.dlg.querySelector(".ag-rtlist");
      if (list) list.innerHTML = this.pickList();
      return true;
    }
    if (act === "mon-sq" && this.step?.pick) {
      this.step.pick.q = el.value;
      this.renderStep();
      const input = this.sdlg.querySelector('[data-wf="mon-sq"]');
      input?.focus();
      input?.setSelectionRange(el.value.length, el.value.length);
      return true;
    }
    if (!this.form && !this.step) return false;
    // Felder des Fensters: nur den Entwurf und die Meldung nachführen (ein Neuaufbau nähme den Fokus)
    if (this.step && ["mon-sf"].includes(act)) {
      this.step.form[el.dataset.field] = el.value;
      this._refreshStepMessage();
      return true;
    }
    if (!this.form) return false;
    if (act === "mon-name") this.form.name = el.value;
    else if (act === "mon-field") this.form[el.dataset.field] = el.value;
    else if (act === "mon-num") this._node(el.dataset.path)[el.dataset.field] = el.value;
    else if (act === "mon-from" || act === "mon-to") this._node(el.dataset.path)[act === "mon-from" ? "from" : "to"] = el.value;
    else return false;
    this._refreshMessage();
    return true;
  }

  onChange(el) {
    const act = el.dataset.wf;
    if (!act || !act.startsWith("mon-")) return false;
    if (act === "mon-state") this._node(el.dataset.path).state = el.value;
    else if (act === "mon-holdunit") this.form.holdUnit = el.value;
    else if (act === "mon-target-add" && this.step) {
      if (el.value && !this.step.form.targets.includes(el.value)) this.step.form.targets.push(el.value);
      this.renderStep();
      return true;
    } else if (act === "mon-sf" && this.step) {
      this.step.form[el.dataset.field] = el.value;
      this.renderStep();
      return true;
    } else return false;
    this.renderDlg();
    return true;
  }

  // Meldung und Speichern-Knopf nachführen, ohne das Fenster neu aufzubauen
  _refreshMessage() {
    const dlg = this.dlg;
    if (!dlg || !this.form || this.pick) return;
    const html = this.editorHtml();
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const err = tmp.querySelector(".ag-dlg-err");
    const mine = dlg.querySelector(".ag-dlg-err");
    if (err && mine) {
      mine.className = err.className;
      mine.textContent = err.textContent;
    }
    const btn = dlg.querySelector('[data-wf="mon-save-form"]');
    if (btn) btn.disabled = Boolean(err?.textContent);
    this.host._lastHtml.delete(dlg);
  }

  _refreshStepMessage() {
    const dlg = this.sdlg;
    if (!dlg || !this.step || this.step.pick) return;
    const prev = dlg.querySelector("[data-prev]");
    if (prev && this.step.form.type === "notify") {
      const tmp = document.createElement("div");
      tmp.innerHTML = this._previewHtml();
      prev.querySelector("[data-prev-title]").textContent = tmp.querySelector("[data-prev-title]").textContent;
      prev.querySelector("[data-prev-body]").textContent = tmp.querySelector("[data-prev-body]").textContent;
    }
    const problem = this._stepProblem(this.step.form);
    const err = dlg.querySelector(".ag-dlg-err");
    if (err) {
      err.classList.toggle("show", Boolean(problem));
      err.textContent = problem;
    }
    const btn = dlg.querySelector('[data-wf="mon-step-apply"]');
    if (btn) btn.disabled = Boolean(problem);
    this.host._lastHtml.delete(dlg);
  }
}
