// Konfiguration › Anlage › Routinen (1.44.0, ersetzen den Zeitplan): eine Routine schaltet die Anlage zu einer Zeit (Auslöser "Zeitplan") oder
// wenn Geräte von Home Assistant etwas tun (Auslöser "Gerät": Bedingungsbaum mit Und/Oder und einer Ebene Gruppen wie bei Magic Push im
// Device Panel). Je Routine wählt man die Zustände der Anlage, in denen sie gelten darf.
// Die Liste ist Teil des Entwurfs der Seite "Anlage" (Speichern unten); der Editor ist ein Fenster, das den Entwurf erst mit "Speichern" ändert.
// Dieselben Regeln wie routines.check_routines und schemas.py: der Server prüft alles noch einmal.

const V = new URL(import.meta.url).search;
const { ic, esc, MODE_KEY, MODE_ICON, chapter } = await import(`./common.js${V}`);

const ALL_MODES = ["home", "away", "night"];
const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_ROUTINES = 20;
const MAX_TIMES = 8;
const MAX_LEAVES = 10;
const MAX_GROUPS = 3;
const HOLD_MAX = 3600;
const NAME_MAX = 45;

// Zustände der Anlage, in denen eine Routine gelten kann (Reihenfolge wie im Ablauf)
const STATES = [
  ["arming", "rtStArming", "rtStArmingHint", "timer"],
  ["armed", "rtStArmed", "rtStArmedHint", "shield"],
  ["pending", "rtStPending", "rtStPendingHint", "alert"],
  ["triggered", "rtStTriggered", "rtStTriggeredHint", "alert"],
  ["disarmed", "rtStDisarmed", "rtStDisarmedHint", "shieldOff"],
];
const ALARM_STATES = ["pending", "triggered"];
const DEVICE_ICON = { lock: "lockClosed", binary_sensor: "sensor", switch: "toggle", input_boolean: "toggle", light: "bulb", cover: "blinds", person: "person", device_tracker: "person", event: "flash" };
// Filter der Geräteauswahl: Art des Geräts
const FILTERS = [
  ["all", "rtFilterAll", null],
  ["lock", "rtFilterLock", ["lock"]],
  ["sensor", "rtFilterSensor", ["binary_sensor"]],
  ["switch", "rtFilterSwitch", ["switch", "input_boolean", "light"]],
  ["cover", "rtFilterCover", ["cover"]],
  ["button", "rtFilterButton", ["event"]],
  ["person", "rtFilterPerson", ["person", "device_tracker"]],
];
const OPENING_CLASSES = ["door", "window", "opening", "garage_door"];
const MOTION_CLASSES = ["motion", "occupancy", "presence"];

const clone = (x) => JSON.parse(JSON.stringify(x));
const newId = () => Math.random().toString(36).slice(2, 10);

export class RoutinesUi {
  constructor(ui) {
    this.ui = ui;
    this.form = null; // Routine im Editor (Kopie), null = Fenster zu
    this.snap = "";
    this.index = -1; // Platz in der Liste; -1 = neue Routine
    this.pick = null; // Geräteauswahl: { path, q, filter, area }
    this.ents = null; // Geräte vom Server { list, byId }, null = noch nicht geladen
    this.loading = false;
  }

  get host() {
    return this.ui.host;
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get draft() {
    return this.ui.ensureDraft();
  }

  get dlg() {
    return this.host._root.getElementById("ag-step");
  }

  // ----- Geräte vom Server -----

  async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const res = await this.host._hass.callWS({ type: "alarmageddon/routine_entities" });
      const list = res?.entities || [];
      this.ents = { list, byId: Object.fromEntries(list.map((e) => [e.entity_id, e])) };
    } catch {
      this.ents = this.ents || { list: [], byId: {}, failed: true };
    } finally {
      this.loading = false;
    }
    if (this.form) this.renderDlg();
    else this.ui.render();
  }

  // Name eines Geräts: vom Server, sonst der Name in Home Assistant; nie die Entitäts-ID als Anzeige ausser als letzter Ausweg
  deviceName(id) {
    return this.ents?.byId[id]?.name || this.host._hass?.states?.[id]?.attributes?.friendly_name || id;
  }

  // ----- Texte -----

  stateText(id, state) {
    const e = this.ents?.byId[id];
    const domain = id.split(".")[0];
    const dc = e?.device_class || this.host._hass?.states?.[id]?.attributes?.device_class || "";
    let kind = "";
    if (domain === "binary_sensor") kind = OPENING_CLASSES.includes(dc) ? "opening" : MOTION_CLASSES.includes(dc) ? "motion" : "";
    const key = domain === "event" ? `rtEv_${state}` : kind ? `rtSt_${state}_${kind}` : `rtSt_${state}`;
    const text = this._t(key);
    return text === key ? state : text;
  }

  daysText(days) {
    const names = this._t("schDays").split(",");
    const d = [...(days || [])].sort((a, b) => a - b);
    if (d.length === 7 || !d.length) return this._t("rtEveryDay");
    if (d.join() === "0,1,2,3,4") return `${names[0]}–${names[4]}`;
    if (d.join() === "5,6") return `${names[5]}, ${names[6]}`;
    return d.map((x) => names[x]).join(", ");
  }

  leafText(leaf) {
    if (leaf.kind === "time") {
      const days = leaf.days?.length && leaf.days.length < 7 ? ` (${this.daysText(leaf.days)})` : "";
      return this._t("rtLeafTime", { from: leaf.from, to: leaf.to }) + days;
    }
    if (leaf.kind === "event") return this._t("rtLeafEvent", { device: this.deviceName(leaf.entity_id), event: this.stateText(leaf.entity_id, leaf.event_type) });
    return this._t("rtLeafState", { device: this.deviceName(leaf.entity_id), state: this.stateText(leaf.entity_id, leaf.state) });
  }

  treeText(tree) {
    const join = ` ${this._t(tree.op === "or" ? "rtOr" : "rtAnd")} `;
    return tree.items
      .map((item) => (item.items ? `(${item.items.map((l) => this.leafText(l)).join(` ${this._t(item.op === "or" ? "rtOr" : "rtAnd")} `)})` : this.leafText(item)))
      .join(join);
  }

  whenText(r) {
    if (r.trigger.type === "schedule") return r.trigger.times.map((t) => this._t("rtAtTime", { days: this.daysText(t.days), time: t.time })).join(", ");
    const hold = r.trigger.hold ? ` · ${this._t("rtHoldShort", { seconds: r.trigger.hold })}` : "";
    return `${this._t("rtWhen")} ${this.treeText(r.trigger.tree)}${hold}`;
  }

  thenText(r) {
    return r.action === "off" ? this._t("rtThenOff") : this._t("rtThenArm", { mode: this._t(MODE_KEY[r.action]) });
  }

  stateName(key) {
    return this._t(STATES.find((s) => s[0] === key)?.[1] || "rtStDisarmed");
  }

  // ----- Liste (Kapitel auf der Seite "Anlage") -----

  html(modes) {
    const d = this.draft;
    if (this.ents === null && !this.loading && d.routines.some((r) => r.trigger.type === "device")) this.load();
    const rows = d.routines.map((r, i) => this._row(r, i, modes)).join("");
    return chapter(this._t("rtTitle"), `<div class="ag-card ag-setlist ag-codes ag-rt">${rows || `<div class="ag-coderow ag-t2">${esc(this._t("rtEmpty"))}</div>`}
      <div class="ag-setrow"><div class="ag-settx"><small>${esc(this._t("rtFootHint"))}</small></div>
        <button class="ag-btn" data-sys="rt-add" ${d.routines.length >= MAX_ROUTINES ? "disabled" : ""}>${ic("plus", 18)}${esc(this._t("rtAdd"))}</button></div></div>`, this._t("rtHint"));
  }

  _row(r, i, modes) {
    const on = r.enabled !== false;
    const tags = [];
    if (r.action === "off") {
      tags.push(["err", this._t("rtBypass"), true]);
    }
    if (r.states.some((s) => ALARM_STATES.includes(s)) && r.action === "off") tags.push(["err", this._t("rtInAlarmTag"), true]);
    const names = STATES.filter((s) => r.states.includes(s[0]));
    if (r.states.length === 1 && r.states[0] === "disarmed") tags.push(["none", this._t("rtOnlyDisarmed")]);
    else if (r.states.length === 1 && r.states[0] === "armed") tags.push(["none", this._armedLabel(r) === this._t("rtStArmed") ? this._t("rtOnlyArmed") : this._t("rtIn", { states: this._armedLabel(r) })]);
    else tags.push(["none", this._t("rtIn", { states: names.map((s) => (s[0] === "armed" ? this._armedLabel(r) : this._t(s[1]))).join(", ") })]);
    if (r.action !== "off" && !modes.includes(r.action)) tags.push(["warn", this._t("rtModeOff"), true]);
    const icon = r.trigger.type === "schedule" ? "clock" : DEVICE_ICON[(r.trigger.tree.items[0]?.items?.[0] || r.trigger.tree.items[0])?.entity_id?.split(".")[0]] || "sensor";
    return `<div class="ag-setrow ag-csrow ag-rtrow ${on ? "" : "dim"}"><button class="ag-toggle ${on ? "on" : ""}" data-sys="rt-on" data-index="${i}" role="switch" aria-checked="${on}" aria-label="${esc(this._t("rtActive"))}"></button>
      <span class="ag-oav ${on ? "on" : ""}">${ic(icon, 20)}</span>
      <div class="ag-settx"><b>${esc(r.name)}</b><small>${esc(this.whenText(r))}</small><small>→ ${esc(this.thenText(r))}</small>
        <div class="ag-rttags">${tags.map(([cls, text, warn]) => `<span class="ag-tag ${cls}">${warn ? ic("alert", 13) : ""}${esc(text)}</span>`).join("")}</div></div>
      <div class="ag-btnrow"><button class="ag-iconbtn" data-sys="rt-dup" data-index="${i}" aria-label="${esc(this._t("rtDuplicate"))}" title="${esc(this._t("rtDuplicate"))}" ${this.draft.routines.length >= MAX_ROUTINES ? "disabled" : ""}>${ic("copy", 18)}</button>
        <button class="ag-iconbtn" data-sys="rt-edit" data-index="${i}" aria-label="${esc(this._t("rtEdit"))}">${ic("pencil", 18)}</button>
        <button class="ag-iconbtn" data-sys="rt-del" data-index="${i}" aria-label="${esc(this._t("rtDelete"))}">${ic("trash", 18)}</button></div></div>`;
  }

  // ----- Editor -----

  blank() {
    const modes = ALL_MODES.filter((m) => this.draft.modes[m]);
    return {
      id: newId(),
      name: "",
      enabled: true,
      action: ["away", "home", "night"].find((m) => modes.includes(m)) || "away",
      states: ["disarmed"],
      trigger: { type: "device", tree: { op: "and", items: [] }, hold: 0 },
      unsafe: false,
      armed_modes: [],
      // Nur im Editor: die Zeiten des Auslösers Zeitplan (beim Wechsel des Auslösers bleiben beide Entwürfe erhalten)
      _times: [{ time: "08:00", days: [0, 1, 2, 3, 4] }],
      _device: { tree: { op: "and", items: [] }, hold: 0 },
    };
  }

  open(index) {
    const base = index >= 0 ? clone(this.draft.routines[index]) : this.blank();
    if (index >= 0) {
      base._times = base.trigger.type === "schedule" ? clone(base.trigger.times) : [{ time: "08:00", days: [0, 1, 2, 3, 4] }];
      base._device = base.trigger.type === "device" ? { tree: clone(base.trigger.tree), hold: base.trigger.hold || 0 } : { tree: { op: "and", items: [] }, hold: 0 };
    }
    base.trigger = { type: base.trigger.type };
    this.form = base;
    this.index = index;
    this.pick = null;
    this.snap = JSON.stringify(this.form);
    this.renderDlg();
    const dlg = this.dlg;
    if (!this._bound) {
      // Schliesst das Fenster auf anderem Weg (Escape, X), ist der Editor zu: sonst zeichnete eine späte Antwort in ein fremdes Fenster
      dlg.addEventListener("close", () => {
        this.form = null;
        this.pick = null;
      });
      this._bound = true;
    }
    if (!dlg.open) dlg.showModal();
    this.load();
  }

  dirty() {
    return Boolean(this.form) && JSON.stringify(this.form) !== this.snap;
  }

  close() {
    this.form = null;
    this.pick = null;
    const dlg = this.dlg;
    if (dlg?.open) dlg.close();
  }

  // Ein Blatt oder eine Gruppe über den Pfad "2" oder "2.1" (Gruppe.Blatt)
  _list(path) {
    const tree = this.form._device.tree;
    if (path === "" || path === undefined) return tree.items;
    return tree.items[Number(path)].items;
  }

  _node(path) {
    const parts = String(path).split(".").map(Number);
    let node = this.form._device.tree.items[parts[0]];
    if (parts.length > 1) node = node.items[parts[1]];
    return node;
  }

  // Modi, in denen "Anlage scharf" gilt: eine leere Liste heisst in jedem Modus der Anlage (die eingeschalteten)
  _enabledModes() {
    return ALL_MODES.filter((m) => this.draft.modes[m]);
  }

  _armedModes(r = this.form) {
    const all = this._enabledModes();
    const own = (r.armed_modes || []).filter((m) => all.includes(m));
    return own.length ? own : all;
  }

  _armedLabel(r) {
    const all = this._enabledModes();
    const own = (r.armed_modes || []).filter((m) => all.includes(m));
    return own.length && own.length < all.length ? `${this._t("rtStArmed")} (${own.map((m) => this._t(MODE_KEY[m])).join(", ")})` : this._t("rtStArmed");
  }

  // Tasten gelten nur im Augenblick des Drückens: eine Haltezeit ergibt dort keinen Sinn
  _hasEvent() {
    return this._leaves().some((l) => l.kind === "event");
  }

  _leaves() {
    return this.form._device.tree.items.flatMap((i) => (i.items ? i.items : [i]));
  }

  // Probleme in der Reihenfolge, in der sie im Fenster stehen; leer = speicherbar
  problems() {
    const f = this.form;
    const bad = [];
    const name = f.name.trim();
    if (!name || name.length > NAME_MAX) bad.push("name");
    else if (this.draft.routines.some((r, i) => i !== this.index && r.name.trim().toLowerCase() === name.toLowerCase())) bad.push("nameTaken");
    if (f.trigger.type === "schedule") {
      if (!f._times.length || f._times.some((t) => !CLOCK_RE.test(t.time || "") || !t.days.length)) bad.push("times");
    } else {
      const tree = f._device.tree;
      const leaves = this._leaves();
      const groups = tree.items.filter((i) => i.items);
      const dev = leaves.filter((l) => l.kind !== "time");
      if (!dev.length || dev.some((l) => !l.entity_id || !(l.kind === "event" ? l.event_type : l.state))) bad.push("noDevice");
      if (groups.some((g) => !g.items.length)) bad.push("emptyGroup");
      if (leaves.some((l) => l.kind === "time" && (!CLOCK_RE.test(l.from) || !CLOCK_RE.test(l.to) || l.from === l.to))) bad.push("window");
      if (leaves.length > MAX_LEAVES || groups.length > MAX_GROUPS) bad.push("tooMany");
      const hold = Number(f._device.hold);
      if (!this._hasEvent() && (!Number.isInteger(hold) || hold < 0 || hold > HOLD_MAX)) bad.push("hold");
    }
    if (!f.states.length) bad.push("states");
    if (f.states.includes("armed") && !this._armedModes().length) bad.push("armedModes");
    if (f.action === "off" && !f.unsafe) bad.push("unsafe");
    return bad;
  }

  // Die Routine, wie der Server sie bekommt (ohne die Hilfsfelder des Editors)
  build() {
    const f = this.form;
    const out = { id: f.id, name: f.name.trim(), enabled: f.enabled !== false, action: f.action, states: STATES.map((s) => s[0]).filter((s) => f.states.includes(s)), unsafe: f.action === "off", armed_modes: f.states.includes("armed") && this._armedModes().length < this._enabledModes().length ? this._armedModes() : [] };
    if (f.trigger.type === "schedule") out.trigger = { type: "schedule", times: f._times.map((t) => ({ time: t.time, days: [...t.days].sort((a, b) => a - b) })) };
    else {
      const leaf = (l) => (l.kind === "time" ? { kind: "time", from: l.from, to: l.to, days: [...(l.days || [])].sort((a, b) => a - b) }
        : l.kind === "event" ? { kind: "event", entity_id: l.entity_id, event_type: l.event_type } : { kind: "state", entity_id: l.entity_id, state: l.state });
      const tree = f._device.tree;
      out.trigger = { type: "device", hold: this._hasEvent() ? 0 : Number(f._device.hold) || 0, tree: { op: tree.op, items: tree.items.map((i) => (i.items ? { op: i.op, items: i.items.map(leaf) } : leaf(i))) } };
    }
    return out;
  }

  save() {
    if (!this.form || this.problems().length) return;
    const routine = this.build();
    const d = this.draft;
    if (this.index >= 0) d.routines[this.index] = routine;
    else d.routines.push(routine);
    this.ui.saveState = null;
    this.close();
    this.ui.render();
  }

  // Auswahlknöpfe als Reiterleiste mit gleitender Kapsel (Design-Regel); die Kapsel setzt _placePills
  _seg(name, items, current, small = true) {
    return `<div class="ag-seg ${small ? "small" : ""}" role="tablist" data-seg="${name}">${items
      .map(([key, label, icon]) => `<button role="tab" data-sys="rt-seg" data-key="${name}" data-value="${key}" class="${current === key ? "on" : ""}" aria-selected="${current === key}">${icon ? ic(icon, 18) : ""}<span>${esc(label)}</span></button>`)
      .join("")}</div>`;
  }

  _opSeg(path, op) {
    return `<div class="ag-seg small ag-rtop" role="tablist" data-seg="op-${path || "root"}">${[["and", "rtOpAnd"], ["or", "rtOpOr"]]
      .map(([k, label]) => `<button role="tab" data-sys="rt-op" data-path="${path}" data-value="${k}" class="${op === k ? "on" : ""}" aria-selected="${op === k}"><span>${esc(this._t(label))}</span></button>`)
      .join("")}</div>`;
  }

  _leafRow(leaf, path, bad) {
    if (leaf.kind === "time") {
      const off = bad.has("window") && (!CLOCK_RE.test(leaf.from) || !CLOCK_RE.test(leaf.to) || leaf.from === leaf.to);
      const names = this._t("schDays").split(",");
      return `<div class="ag-rtleaf ag-rttime">
        <span class="ag-rtdev static">${ic("clock", 18)}<b>${esc(this._t("rtTimeWindow"))}</b></span>
        <span class="ag-t2">${esc(this._t("rtFrom"))}</span><input type="time" class="ag-input ag-time ${off ? "bad" : ""}" data-sys="rt-from" data-path="${path}" value="${esc(leaf.from)}" aria-label="${esc(this._t("rtFrom"))}">
        <span class="ag-t2">${esc(this._t("rtTo"))}</span><input type="time" class="ag-input ag-time ${off ? "bad" : ""}" data-sys="rt-to" data-path="${path}" value="${esc(leaf.to)}" aria-label="${esc(this._t("rtTo"))}">
        <button class="ag-iconbtn" data-sys="rt-del-leaf" data-path="${path}" aria-label="${esc(this._t("rtRemove"))}">${ic("trash", 18)}</button>
        <div class="ag-days ag-rtdays">${names.map((label, k) => `<button class="ag-day ${(leaf.days || []).includes(k) ? "on" : ""}" data-sys="rt-lday" data-path="${path}" data-day="${k}" aria-pressed="${(leaf.days || []).includes(k)}">${esc(label)}</button>`).join("")}</div>
        <small class="ag-t2 ag-rtnote">${esc(this._t("rtDaysAll"))}</small></div>`;
    }
    const domain = (leaf.entity_id || "").split(".")[0];
    const isEvent = leaf.kind === "event";
    const value = isEvent ? leaf.event_type : leaf.state;
    const options = this.ents?.byId[leaf.entity_id]?.states || (leaf.entity_id ? [value] : []);
    const missing = leaf.entity_id && this.ents && !this.ents.byId[leaf.entity_id];
    return `<div class="ag-rtleaf">
      <button class="ag-rtdev" data-sys="rt-pick" data-path="${path}" aria-label="${esc(this._t("rtChooseDevice"))}">${ic(DEVICE_ICON[domain] || "sensor", 18)}<b>${esc(leaf.entity_id ? this.deviceName(leaf.entity_id) : this._t("rtChooseDevice"))}</b></button>
      <span class="ag-t2">${esc(this._t(isEvent ? "rtOnButton" : "rtIs"))}</span>
      <select class="ag-input" data-sys="rt-state" data-path="${path}" aria-label="${esc(this._t("rtState"))}" ${leaf.entity_id ? "" : "disabled"}>${options.map((s) => `<option value="${esc(s)}" ${s === value ? "selected" : ""}>${esc(this.stateText(leaf.entity_id, s))}</option>`).join("")}</select>
      <button class="ag-iconbtn" data-sys="rt-del-leaf" data-path="${path}" aria-label="${esc(this._t("rtRemove"))}">${ic("trash", 18)}</button>
      ${missing ? `<small class="ag-warntext ag-rtnote">${ic("alert", 14)} ${esc(this._t("rtDeviceGone"))}</small>` : ""}</div>`;
  }

  _treeHtml(bad) {
    const tree = this.form._device.tree;
    const leaves = this._leaves();
    const groups = tree.items.filter((i) => i.items);
    const canLeaf = leaves.length < MAX_LEAVES;
    const addBtns = (path) => `<div class="ag-rtadd"><button class="ag-btn" data-sys="rt-add-dev" data-path="${path}" ${canLeaf ? "" : "disabled"}>${ic("plus", 18)}${esc(this._t("rtAddDevice"))}</button>
        <button class="ag-btn" data-sys="rt-add-time" data-path="${path}" ${canLeaf ? "" : "disabled"}>${ic("clock", 18)}${esc(this._t("rtAddTime"))}</button>${path === "" ? `<button class="ag-btn" data-sys="rt-add-group" ${groups.length < MAX_GROUPS ? "" : "disabled"}>${ic("plus", 18)}${esc(this._t("rtAddGroup"))}</button>` : ""}</div>`;
    const items = tree.items.map((item, i) => {
      if (!item.items) return this._leafRow(item, String(i), bad);
      return `<div class="ag-rtgroup"><div class="ag-rtghead"><b>${esc(this._t("rtGroup"))}</b>${this._opSeg(String(i), item.op)}
          <button class="ag-iconbtn" data-sys="rt-del-leaf" data-path="${i}" aria-label="${esc(this._t("rtRemove"))}">${ic("trash", 18)}</button></div>
        ${item.items.map((l, j) => this._leafRow(l, `${i}.${j}`, bad)).join("")}
        ${item.items.length ? "" : `<small class="ag-err">${esc(this._t("rtEmptyGroup"))}</small>`}${addBtns(String(i))}</div>`;
    }).join("");
    const hold = this.form._device.hold;
    return `<div class="ag-card ag-rttree">
      <div class="ag-rtghead">${this._opSeg("", tree.op)}</div>
      ${items || `<div class="ag-t2 ag-rtnone">${esc(this._t("rtTreeEmpty"))}</div>`}${addBtns("")}
      ${this._hasEvent() ? `<p class="ag-chap-h ag-rtedge">${esc(this._t("rtHoldEvent"))}</p>` : ""}
      <div class="ag-setrow ag-rthold" ${this._hasEvent() ? "hidden" : ""}><div class="ag-settx"><b>${esc(this._t("rtHold"))}</b><small>${esc(this._t("rtHoldHint"))}</small></div>
        <span class="ag-num ${bad.has("hold") ? "bad" : ""}"><input type="number" min="0" max="${HOLD_MAX}" step="1" inputmode="numeric" data-sys="rt-hold" value="${esc(hold)}" aria-label="${esc(this._t("rtHold"))}"><span class="ag-t2">${esc(this._t("seconds"))}</span></span></div></div>
      <p class="ag-chap-h ag-rtedge">${esc(this._t("rtEdgeHint"))}</p>`;
  }

  _timesHtml(bad) {
    const names = this._t("schDays").split(",");
    const rows = this.form._times.map((t, i) => `<div class="ag-schrow ag-rttimerow"><input type="time" class="ag-input ag-time ${bad.has("times") && !CLOCK_RE.test(t.time || "") ? "bad" : ""}" data-sys="rt-time" data-index="${i}" value="${esc(t.time)}" aria-label="${esc(this._t("schTime"))}">
        <div class="ag-days">${names.map((label, k) => `<button class="ag-day ${t.days.includes(k) ? "on" : ""}" data-sys="rt-day" data-index="${i}" data-day="${k}" aria-pressed="${t.days.includes(k)}">${esc(label)}</button>`).join("")}</div>
        ${this.form._times.length > 1 ? `<button class="ag-iconbtn" data-sys="rt-del-time" data-index="${i}" aria-label="${esc(this._t("schDelete"))}">${ic("trash", 18)}</button>` : ""}</div>`).join("");
    return `<div class="ag-card ag-setlist ag-codes">${rows}<div class="ag-setrow"><div class="ag-settx"><small>${esc(this._t("rtScheduleHint"))}</small></div>
      <button class="ag-btn" data-sys="rt-add-timerow" ${this.form._times.length >= MAX_TIMES ? "disabled" : ""}>${ic("plus", 18)}${esc(this._t("schAdd"))}</button></div></div>`;
  }

  _statesHtml() {
    const f = this.form;
    const arm = f.action !== "off";
    const rows = STATES.map(([key, label, hint, icon]) => {
      const locked = arm && ALARM_STATES.includes(key);
      const on = f.states.includes(key) && !locked;
      const row = `<div class="ag-setrow ${locked ? "dim" : ""}"><button class="ag-toggle ${on ? "on" : ""}" data-sys="rt-st" data-value="${key}" role="switch" aria-checked="${on}" aria-label="${esc(this._t(label))}" ${locked ? "disabled" : ""}></button>
        <span class="ag-oav ${on ? "on" : ""}">${ic(icon, 20)}</span><div class="ag-settx"><b>${esc(this._t(label))}</b><small>${esc(locked ? this._t("rtStNever") : this._t(hint))}</small></div></div>`;
      // "Anlage scharf": darunter ein Schalter je Modus der Anlage (in welchen Modi sie scharf sein muss)
      if (key !== "armed" || !on) return row;
      const picked = this._armedModes();
      return row + this._enabledModes().map((m) => `<div class="ag-setrow ag-rtsub"><button class="ag-toggle ${picked.includes(m) ? "on" : ""}" data-sys="rt-am" data-value="${m}" role="switch" aria-checked="${picked.includes(m)}" aria-label="${esc(this._t(MODE_KEY[m]))}"></button>
        <span class="ag-oav ${picked.includes(m) ? "on" : ""}">${ic(MODE_ICON[m], 20)}</span><div class="ag-settx"><b>${esc(this._t(MODE_KEY[m]))}</b><small>${esc(this._t("rtArmedModeHint", { mode: this._t(MODE_KEY[m]) }))}</small></div></div>`).join("");
    }).join("");
    const warn = !arm && f.states.some((s) => ALARM_STATES.includes(s))
      ? `<p class="ag-chap-h ag-rtred">${ic("alert", 14)} ${esc(this._t("rtAlarmWarn"))}</p>` : "";
    return chapter(this._t("rtStatesTitle"), `<div class="ag-card ag-setlist">${rows}</div>${warn}`, this._t("rtStatesHint"));
  }

  _safetyHtml() {
    const f = this.form;
    return chapter(this._t("rtSafetyTitle"), `<div class="ag-card ag-rtsafety"><div class="ag-rtsafehead">${ic("alert", 22)}<div><b>${esc(this._t("rtSafetyHead"))}</b>
        <div class="ag-t2">${esc(this._t("rtSafetyText"))}</div></div></div>
      <div class="ag-setrow"><button class="ag-toggle ${f.unsafe ? "on" : ""}" data-sys="rt-unsafe" role="switch" aria-checked="${Boolean(f.unsafe)}" aria-label="${esc(this._t("rtUnderstood"))}"></button>
        <div class="ag-settx"><b>${esc(this._t("rtUnderstood"))}</b></div></div></div>`);
  }

  // ----- Vorschau des Ablaufs (Grafik am Ende des Editors, reine Anzeige, folgt dem Entwurf) -----

  _flowLeaf(l) {
    const icon = l.kind === "time" ? "clock" : DEVICE_ICON[(l.entity_id || "").split(".")[0]] || "sensor";
    return `<span class="ag-fl-leaf">${ic(icon, 16)}<span>${esc(l.kind === "time" || l.entity_id ? this.leafText(l) : this._t("rtChooseDevice"))}</span></span>`;
  }

  _flowTree(tree) {
    if (!tree.items.length) return `<div class="ag-fl-s">${esc(this._t("rtTreeEmpty"))}</div>`;
    const word = (op) => `<span class="ag-fl-or">${esc(this._t(op === "or" ? "rtOr" : "rtAnd").toUpperCase())}</span>`;
    const parts = tree.items.map((item) => (item.items
      ? `<div class="ag-fl-grp">${item.items.length ? item.items.map((l) => this._flowLeaf(l)).join(word(item.op)) : `<span class="ag-fl-s">${esc(this._t("rtEmptyGroup"))}</span>`}</div>`
      : this._flowLeaf(item)));
    return `<div class="ag-fl-tree">${parts.join(word(tree.op))}</div>`;
  }

  flowHtml() {
    const f = this.form;
    const arm = f.action !== "off";
    const trigger = f.trigger.type === "schedule"
      ? `<div class="ag-fl-t">${esc(this._t("rtFlowWhenTime"))}</div><div class="ag-fl-tree">${f._times.map((t) => `<span class="ag-fl-leaf">${ic("clock", 16)}<span>${esc(this._t("rtAtTime", { days: this.daysText(t.days), time: t.time || "–" }))}</span></span>`).join("")}</div>`
      : `<div class="ag-fl-t">${esc(this._t("rtFlowWhenDevice"))}</div>${this._flowTree(f._device.tree)}`
        + `<div class="ag-fl-s">${esc(this._hasEvent() ? this._t("rtFlowEventNote") : this._t("rtFlowEdgeNote"))}${!this._hasEvent() && Number(f._device.hold) > 0 ? ` ${esc(this._t("rtFlowHold", { seconds: f._device.hold }))}` : ""}</div>`;
    const band = STATES.map(([key, label]) => `<div class="${f.states.includes(key) && !(arm && ALARM_STATES.includes(key)) ? "on" : ""}">${esc(key === "armed" ? this._armedLabel({ armed_modes: this._armedModes() }) : this._t(label))}</div>`).join("");
    const actionText = f.action === "off" ? this._t("rtThenOff") : this._t("rtThenArm", { mode: this._t(MODE_KEY[f.action]) });
    const step = (n, cls, node, last = false) => `<div class="ag-fl-step ${cls}"><div class="ag-fl-rail"><span class="ag-fl-num">${n}</span><span class="ag-fl-line"></span></div>${node}</div>`;
    return `<div class="ag-fl">
      ${step(1, "", `<div class="ag-fl-node"><span class="ag-fl-ico">${ic("flash", 20)}</span><div class="ag-fl-body"><div class="ag-fl-k">${esc(this._t("rtTrigger"))}</div>${trigger}</div></div>`)}
      ${step(2, "", `<div class="ag-fl-node"><span class="ag-fl-ico">${ic("tune", 20)}</span><div class="ag-fl-body"><div class="ag-fl-k">${esc(this._t("rtFlowCheck"))}</div><div class="ag-fl-t">${esc(this._t("rtFlowCheckQ"))}</div><div class="ag-fl-band">${band}</div></div></div>`)}
      ${step(3, arm ? "arm" : "off", `<div class="ag-fl-node ${arm ? "arm" : "off"}"><span class="ag-fl-ico">${ic(arm ? MODE_ICON[f.action] : "shieldOff", 20)}</span><div class="ag-fl-body"><div class="ag-fl-k">${esc(this._t("rtFlowAction"))}</div><div class="ag-fl-t">${esc(actionText)}</div>
        ${f.action === "off" ? `<span class="ag-tag err" style="margin-top:6px">${ic("alert", 13)}${esc(this._t("rtBypass"))}</span>` : ""}</div></div>`)}
      <div class="ag-fl-skip">${ic("info", 16)}<span>${esc(this._t("rtFlowSkipNote"))}</span></div></div>`;
  }

  editorHtml() {
    const f = this.form;
    const bad = new Set(this.problems());
    const modes = ALL_MODES.filter((m) => this.draft.modes[m]);
    const actions = [...ALL_MODES.filter((m) => modes.includes(m) || f.action === m).map((m) => [m, this._t(MODE_KEY[m]), MODE_ICON[m]]), ["off", this._t("rtDo_off"), "shieldOff"]];
    const message = bad.has("name") ? this._t("rtErrName") : bad.has("nameTaken") ? this._t("rtErrNameTaken") : bad.has("times") ? this._t("rtErrTimes")
      : bad.has("noDevice") ? this._t("rtErrNoDevice") : bad.has("emptyGroup") ? this._t("rtEmptyGroup") : bad.has("window") ? this._t("rtErrWindow")
      : bad.has("tooMany") ? this._t("rtErrTooMany") : bad.has("hold") ? this._t("invalidNumber", { min: 0, max: HOLD_MAX }) : bad.has("states") ? this._t("rtErrStates")
      : bad.has("armedModes") ? this._t("rtErrArmedModes") : bad.has("unsafe") ? this._t("rtErrUnsafe") : "";
    const nameField = `<input class="ag-input ag-rtname ${bad.has("name") || bad.has("nameTaken") ? "bad" : ""}" data-sys="rt-name" maxlength="${NAME_MAX}" value="${esc(f.name)}" placeholder="${esc(this._t("rtNamePh"))}" aria-label="${esc(this._t("rtName"))}">`;
    const when = f.trigger.type === "schedule" ? chapter(this._t("rtWhenTitle"), this._timesHtml(bad)) : chapter(this._t("rtIfTitle"), this._treeHtml(bad));
    return `<div class="ag-dlg-body ag-rt-ed"><h3>${esc(this._t(this.index >= 0 ? "rtEditTitle" : "rtNewTitle"))}</h3>
      ${chapter(this._t("rtName"), nameField)}
      ${chapter(this._t("rtTrigger"), this._seg("trigger", [["schedule", this._t("rtTrigSchedule"), "clock"], ["device", this._t("rtTrigDevice"), "sensor"]], f.trigger.type))}
      ${when}
      ${chapter(this._t("rtThenTitle"), this._seg("action", actions, f.action))}
      ${this._statesHtml()}
      ${f.action === "off" ? this._safetyHtml() : ""}
      ${chapter(this._t("rtFlowTitle"), this.flowHtml())}
      <div class="ag-dlg-err ${message ? "show" : ""}" aria-live="polite">${esc(message)}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="rt-cancel">${esc(this._t("cancel"))}</button>
        <button class="ag-btn primary" data-sys="rt-save" ${message ? "disabled" : ""}>${ic("check", 18)}${esc(this._t("save"))}</button></div></div>`;
  }

  // ----- Geräteauswahl (ersetzt den Inhalt des Fensters, bis ein Gerät gewählt ist) -----

  pickHtml() {
    const p = this.pick;
    const areas = [...new Set((this.ents?.list || []).map((e) => e.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const chips = FILTERS.map(([key, label]) => `<button class="ag-chip ${p.filter === key ? "on" : ""}" data-sys="rt-filter" data-value="${key}">${esc(this._t(label))}</button>`).join("");
    const areaSel = areas.length ? `<select class="ag-input ag-rtarea" data-sys="rt-area" aria-label="${esc(this._t("rtArea"))}"><option value="">${esc(this._t("rtAllAreas"))}</option>${areas.map((a) => `<option value="${esc(a)}" ${p.area === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>` : "";
    return `<div class="ag-dlg-body ag-rt-pick"><h3>${esc(this._t("rtPickTitle"))}</h3>
      <div class="ag-t2">${esc(this._t("rtPickHint"))}</div>
      <label class="list-search" style="margin-top:12px">${ic("search", 18)}<input type="search" data-sys="rt-q" value="${esc(p.q)}" placeholder="${esc(this._t("rtSearch"))}" aria-label="${esc(this._t("rtSearch"))}" autocomplete="off">
        <button type="button" class="ag-clear" data-sys="rt-q-clear" aria-label="${esc(this._t("clearSearch"))}" ${p.q ? "" : "hidden"}>${ic("close", 16)}</button></label>
      <div class="ag-tools ag-pick-chips">${chips}${areaSel}</div>
      <div class="ag-elist ag-rtlist" data-sys-list style="margin-top:10px;max-height:min(46vh,380px)">${this.pickList()}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="rt-pick-back">${esc(this._t("rtBack"))}</button></div></div>`;
  }

  // Die Liste einzeln neu zeichnen, damit der Cursor im Suchfeld bleibt. Gesucht wird in Name, Bereich und Entitäts-ID; angezeigt wird die ID nie.
  pickList() {
    if (!this.ents) return `<div class="ag-t2 ag-rtnone">${esc(this._t("rtLoading"))}</div>`;
    const p = this.pick;
    const group = FILTERS.find((f) => f[0] === p.filter)?.[2];
    const q = p.q.trim().toLowerCase();
    const list = this.ents.list.filter((e) => (!group || group.includes(e.domain)) && (!p.area || e.area === p.area)
      && (!q || `${e.name} ${e.area} ${e.entity_id}`.toLowerCase().includes(q)));
    if (!list.length) return `<div class="ag-t2 ag-rtnone">${esc(this._t(this.ents.failed ? "rtLoadFailed" : "rtNoDevices"))}</div>`;
    return list.slice(0, 200).map((e) => `<button class="ag-rtent" data-sys="rt-choose" data-id="${esc(e.entity_id)}"><span class="ag-oav">${ic(DEVICE_ICON[e.domain] || "sensor", 20)}</span>
      <span class="ag-grow"><b>${esc(e.name)}</b><small class="ag-t2">${esc([e.area, this.stateText(e.entity_id, e.state)].filter(Boolean).join(" · "))}</small></span></button>`).join("")
      + (list.length > 200 ? `<div class="ag-t2 ag-rtnone">${esc(this._t("rtMore", { count: list.length - 200 }))}</div>` : "");
  }

  renderDlg() {
    const h = this.host;
    if (!this.form) return;
    // Beim Tippen werden Teile des Fensters einzeln geändert (Liste, Meldung): der Vergleich mit dem zuletzt gesetzten Text wäre dann falsch
    h._lastHtml.delete(this.dlg);
    h._setHtml(this.dlg, this.pick ? this.pickHtml() : this.editorHtml());
    h._placePills();
  }

  // ----- Bedienung -----

  onClick(el) {
    const act = el.dataset.sys;
    const d = this.draft;
    const i = Number(el.dataset.index);
    const f = this.form;
    if (act === "rt-add") this.open(-1);
    else if (act === "rt-edit") this.open(i);
    else if (act === "rt-dup") {
      // Kopie gleich hinter dem Original, ausgeschaltet (sie soll nicht doppelt schalten, bis sie angepasst ist); sie gilt erst nach dem Speichern der Seite
      const copy = clone(d.routines[i]);
      const taken = new Set(d.routines.map((r) => r.name.trim().toLowerCase()));
      const suffix = ` (${this._t("rtCopySuffix")})`;
      const base = `${copy.name.slice(0, NAME_MAX - suffix.length - 4)}`;
      let name = `${base}${suffix}`;
      for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${base} (${this._t("rtCopySuffix")} ${n})`;
      Object.assign(copy, { id: newId(), name, enabled: false });
      d.routines.splice(i + 1, 0, copy);
      this.ui.saveState = null;
      this.ui.render();
    } else if (act === "rt-del") {
      d.routines.splice(i, 1);
      this.ui.saveState = null;
      this.ui.render();
    } else if (act === "rt-on") {
      d.routines[i].enabled = d.routines[i].enabled === false;
      this.ui.saveState = null;
      this.ui.render();
    } else if (act === "rt-cancel") this.close();
    else if (act === "rt-save") this.save();
    else if (!f) return false;
    else if (act === "rt-seg") {
      if (el.dataset.key === "trigger") f.trigger.type = el.dataset.value;
      else this._setAction(el.dataset.value);
      this.renderDlg();
    } else if (act === "rt-op") {
      (el.dataset.path === "" ? f._device.tree : f._device.tree.items[Number(el.dataset.path)]).op = el.dataset.value;
      this.renderDlg();
    } else if (act === "rt-add-dev") {
      this.pick = { path: el.dataset.path, add: true, q: "", filter: "all", area: "" };
      this.renderDlg();
      this.load();
    } else if (act === "rt-pick") {
      this.pick = { path: el.dataset.path, add: false, q: "", filter: "all", area: "" };
      this.renderDlg();
      this.load();
    } else if (act === "rt-add-time") {
      this._list(el.dataset.path).push({ kind: "time", from: "22:00", to: "06:00", days: [] });
      this.renderDlg();
    } else if (act === "rt-add-group") {
      f._device.tree.items.push({ op: "and", items: [] });
      this.renderDlg();
    } else if (act === "rt-del-leaf") {
      const parts = el.dataset.path.split(".").map(Number);
      if (parts.length === 1) f._device.tree.items.splice(parts[0], 1);
      else f._device.tree.items[parts[0]].items.splice(parts[1], 1);
      this.renderDlg();
    } else if (act === "rt-lday") {
      const leaf = this._node(el.dataset.path);
      const day = Number(el.dataset.day);
      leaf.days = leaf.days.includes(day) ? leaf.days.filter((x) => x !== day) : [...leaf.days, day].sort((a, b) => a - b);
      this.renderDlg();
    } else if (act === "rt-day") {
      const t = f._times[i];
      const day = Number(el.dataset.day);
      t.days = t.days.includes(day) ? t.days.filter((x) => x !== day) : [...t.days, day].sort((a, b) => a - b);
      this.renderDlg();
    } else if (act === "rt-add-timerow") {
      f._times.push({ time: "08:00", days: [0, 1, 2, 3, 4] });
      this.renderDlg();
    } else if (act === "rt-del-time") {
      f._times.splice(i, 1);
      this.renderDlg();
    } else if (act === "rt-st") {
      const s = el.dataset.value;
      f.states = f.states.includes(s) ? f.states.filter((x) => x !== s) : [...f.states, s];
      this.renderDlg();
    } else if (act === "rt-am") {
      const m = el.dataset.value;
      const cur = this._armedModes();
      f.armed_modes = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
      this.renderDlg();
    } else if (act === "rt-unsafe") {
      f.unsafe = !f.unsafe;
      this.renderDlg();
    } else if (act === "rt-filter") {
      this.pick.filter = el.dataset.value;
      this.renderDlg();
    } else if (act === "rt-q-clear") {
      this.pick.q = "";
      this.renderDlg();
      this.dlg.querySelector('[data-sys="rt-q"]')?.focus();
    } else if (act === "rt-pick-back") {
      this.pick = null;
      this.renderDlg();
    } else if (act === "rt-choose") this._choose(el.dataset.id);
    else return false;
    return true;
  }

  // Wechsel des Ziels: Scharfschalten gilt nie in der Eingangsverzögerung und im Alarm
  _setAction(action) {
    const f = this.form;
    f.action = action;
    if (action !== "off") {
      f.states = f.states.filter((s) => !ALARM_STATES.includes(s));
      f.unsafe = false;
    }
  }

  _choose(id) {
    const e = this.ents?.byId[id];
    const states = e?.states || [];
    const list = this.pick.add ? this._list(this.pick.path) : null;
    const event = id.startsWith("event.");
    const fresh = event ? { kind: "event", entity_id: id, event_type: states[0] || "" } : { kind: "state", entity_id: id, state: states[0] || "" };
    if (list) list.push(fresh);
    else {
      // Gerät gewechselt (auch von Zustand zu Taste): Art und Wert passen sich an
      const leaf = this._node(this.pick.path);
      const keep = (leaf.kind === "event" ? leaf.event_type : leaf.state);
      for (const k of ["state", "event_type"]) delete leaf[k];
      Object.assign(leaf, fresh);
      if (states.includes(keep) && leaf.kind === (event ? "event" : "state")) leaf[event ? "event_type" : "state"] = keep;
    }
    this.pick = null;
    this.renderDlg();
  }

  onInput(el) {
    const act = el.dataset.sys;
    const f = this.form;
    if (!f || !act?.startsWith("rt-")) return false;
    if (act === "rt-q") {
      this.pick.q = el.value;
      this.dlg.querySelector("[data-sys-list]").innerHTML = this.pickList();
      this.dlg.querySelector('[data-sys="rt-q-clear"]').hidden = !el.value;
    } else if (act === "rt-area") {
      this.pick.area = el.value;
      this.dlg.querySelector("[data-sys-list]").innerHTML = this.pickList();
    } else if (act === "rt-name") {
      f.name = el.value;
      this._refresh();
    } else if (act === "rt-time") {
      f._times[Number(el.dataset.index)].time = el.value;
      this._refresh();
    } else if (act === "rt-from" || act === "rt-to") {
      this._node(el.dataset.path)[act === "rt-from" ? "from" : "to"] = el.value;
      this._refresh();
    } else if (act === "rt-state") {
      const node = this._node(el.dataset.path);
      node[node.kind === "event" ? "event_type" : "state"] = el.value;
    } else if (act === "rt-hold") {
      f._device.hold = el.value === "" ? NaN : Number(el.value);
      this._refresh();
    } else return false;
    return true;
  }

  // Beim Tippen nicht neu aufbauen (der Cursor bliebe nicht stehen): nur Meldung und Speichern-Knopf nachführen
  _refresh() {
    const dlg = this.dlg;
    const html = this.editorHtml();
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const err = dlg.querySelector(".ag-dlg-err");
    const fresh = tmp.querySelector(".ag-dlg-err");
    if (err && fresh) {
      err.textContent = fresh.textContent;
      err.classList.toggle("show", fresh.classList.contains("show"));
    }
    // Die Vorschau folgt dem Tippen (Name der Zeit, Haltezeit)
    const flow = dlg.querySelector(".ag-fl"), freshFlow = tmp.querySelector(".ag-fl");
    if (flow && freshFlow) flow.innerHTML = freshFlow.innerHTML;
    const save = dlg.querySelector('[data-sys="rt-save"]');
    if (save) save.disabled = this.problems().length > 0;
    // Rahmen der Felder: ungültig rot
    dlg.querySelectorAll("input.ag-time, input.ag-rtname").forEach((n, k) => {
      const freshNode = tmp.querySelectorAll("input.ag-time, input.ag-rtname")[k];
      if (freshNode) n.classList.toggle("bad", freshNode.classList.contains("bad"));
    });
    const num = dlg.querySelector(".ag-rthold .ag-num");
    if (num) num.classList.toggle("bad", this.problems().includes("hold"));
  }
}
