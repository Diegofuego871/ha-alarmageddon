// Konfiguration › Meldungen (für alle Anlagen), in Kapiteln: Empfänger (Dropdown, gewählte als Pille mit x, getrennt für Alarme und
// Wartung), Alarmmeldungen und Wartungsmeldungen (je Art an/aus, kritisch ja/nein und Lautstärke, Testmeldung), Knöpfe in der
// Meldung. Entwurf mit "Speichern"; Testmeldungen gehen mit dem gespeicherten Stand hinaus.

const V = new URL(import.meta.url).search;
const { ic, esc, errText, chapter, MODE_KEY, MODE_ICON, onceBtn, paintOnce, runOnce } = await import(`./common.js${V}`);
const { HC_NOTICE_KINDS, normHcNotice } = await import(`./actions.js${V}`);
// Meldungen der HealthCheck-Dienste (1.68.0, Wunsch des Nutzers 2026-11-19, 18:42/18:43): Anzahl gescheiterter Aufrufe 1 bis 10 (Standard 2)
const HC_FAILS = [1, 10];
const hcBlock = (value) => ({ fails: Number.isInteger(value?.fails) ? value.fails : 2, ...Object.fromEntries(HC_NOTICE_KINDS.map((k) => [k, normHcNotice(value?.[k])])) });

// Arten je Gruppe in der Reihenfolge der Anzeige, mit Symbol
const GROUPS = {
  // Seit 1.62.0 ohne "Stiller Alarm", "Eingangsverzögerung", "Scharf geschaltet" und "Deaktiviert": sie stehen als feste Elemente im Reiter
  // Aktionen (je Anlage und Modus). Ihre früheren gemeinsamen Werte bleiben im Entwurf unberührt erhalten (der Server nimmt sie, solange
  // eine Anlage nichts Eigenes gespeichert hat).
  alarm: [["sensor_offline", "alert"], ["arm_failed", "doorOpen"]],
  // Selbsttest (1.65.0): eigene Meldungsart, einzeln ein- und auszuschalten wie die anderen
  maintenance: [["battery_low", "battery"], ["sensor_unavailable", "offline"], ["selftest", "stethoscope"]],
};
// Arten, die nur im scharfen Zustand vorkommen: je Modus eigene Werte (Unterreiter), sonst der gemeinsame Wert
const MODE_KINDS = [["sensor_offline", "alert"]];
const ALL_MODES = ["home", "away", "night"];
const TARGET_KEY = { alarm: "alarm_targets", maintenance: "maintenance_targets" };
// Die Abstände des Selbsttests (selftest_minutes, selftest_minutes_armed; bis 1.66.x selftest_hours, selftest_hours_armed) stehen seit der dritten Fassung von 1.65.0 im Kapitel HealthCheck (Konfiguration › Anlage) und werden
// dort gespeichert; dieser Entwurf sendet sie nie mit (sonst überschriebe ein älterer Entwurf die neuen Werte)
const RANGES = { battery_threshold: [5, 50], battery_checks: [1, 10], offline_minutes: [5, 1440] };
const ARM_BUTTONS = ["arm_retry_action", "arm_force_action"];
// Arten mit Zahlenfeldern: je Feld Schlüssel, Beschriftung, Einheit (Text oder Schlüssel), Hinweis. "Meldung nach … Prüfungen" seit 1.68.0 (Wunsch
// des Nutzers 2026-11-19, 19:38: eine Meldung "Batterie 1 %" bei 61 %, ein einzelner falscher Wert des Geräts)
const NUMBERS = {
  battery_low: [["battery_threshold", "ntThreshold", "%"], ["battery_checks", "ntBatteryChecks", "ntBatteryChecksUnit", "ntBatteryChecksHint"]],
  sensor_unavailable: [["offline_minutes", "ntOfflineAfter", "minutes"]],
};
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, list]) => list.map(([k]) => [k, g])));
const KINDS = [...GROUPS.alarm, ...GROUPS.maintenance].map(([k]) => k);

const short = (s) => s.replace(/^notify\.(mobile_app_)?/, "");

export class NotifyUi {
  constructor(host) {
    this.host = host;
    this.draft = null;
    this.saveState = null;
    this.saving = false;
    this.modeTab = "home"; // gewählter Modus (nur mit eingeschaltetem Schalter; Ansicht, nicht Teil des Entwurfs)
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get base() {
    const types = Object.fromEntries(KINDS.map((k) => [k, { enabled: true, critical: false, volume: 0.8 }]));
    return (this.host._data?.notify || { alarm_targets: [], maintenance_targets: [], types, battery_threshold: 20, battery_checks: 3, offline_minutes: 60, selftest_minutes: 360 });
  }

  // Knopf der Meldung "Scharfschalten nicht möglich": "retry" oder "force"; ohne gespeicherten Wert an
  _armButton(key) {
    return (this.draft || this.base)[`arm_${key}_action`] !== false;
  }

  ensureDraft() {
    if (!this.draft) this.draft = JSON.parse(JSON.stringify(this.base));
    this.draft.healthcheck = this.draft.healthcheck && typeof this.draft.healthcheck.fails !== "undefined" ? this.draft.healthcheck : hcBlock(this.draft.healthcheck);
    this.draft.modes ||= {};
    this.draft.per_mode = Boolean(this.draft.per_mode);
    return this.draft;
  }

  // Arten (und Modi), bei denen der Nutzer den letzten Empfänger entfernt hat und noch keinen neuen gewählt (1.26.0): nur im Entwurf,
  // "Art|Modus". Gespeichert wird so nicht (eine leere eigene Liste hiesse beim Server: es gilt die Gruppe oben).
  _empty() {
    return (this.emptyOwn ||= new Set());
  }

  reset() {
    this._empty().clear();
    this.draft = null;
    this.saveState = null;
  }

  // Reiter der Modi mit ungespeicherten Änderungen (für den Punkt am Reiter)
  dirtyTabs() {
    if (!this.draft) return [];
    return ALL_MODES.filter((m) => JSON.stringify(this.base.modes?.[m] || {}) !== JSON.stringify(this.draft.modes?.[m] || {})).map((m) => ["data-nt", `tab:${m}`]);
  }

  dirtyCount() {
    if (!this.draft) return 0;
    const a = this.base;
    const d = this.draft;
    let n = 0;
    for (const k of Object.values(TARGET_KEY)) if (JSON.stringify([...(a[k] || [])].sort()) !== JSON.stringify([...d[k]].sort())) n += 1;
    for (const kind of KINDS) {
      const x = a.types?.[kind] || {};
      const y = d.types[kind];
      if (!!x.enabled !== !!y.enabled || !!x.critical !== !!y.critical || !!x.persistent !== !!y.persistent || Math.round((x.volume ?? 0) * 100) !== Math.round(y.volume * 100) || JSON.stringify(x.targets || []) !== JSON.stringify(y.targets || [])) n += 1;
    }
    for (const k of Object.keys(RANGES)) if (a[k] !== d[k]) n += 1;
    for (const k of ARM_BUTTONS) if ((a[k] !== false) !== (d[k] !== false)) n += 1;
    n += this._empty().size; // entfernter letzter Empfänger einer Meldung: offene Änderung
    if (Boolean(a.per_mode) !== Boolean(d.per_mode)) n += 1; // der Schalter zählt als eigene Änderung
    // Eigene Werte je Modus: jeder Modus mit Änderung zählt einmal
    for (const m of ALL_MODES) if (JSON.stringify(a.modes?.[m] || {}) !== JSON.stringify(d.modes?.[m] || {})) n += 1;
    // HealthCheck-Dienste (1.68.0): die Zahl und jede der zwei Meldungen zählen einzeln
    const ha = hcBlock(a.healthcheck);
    const hd = hcBlock(d.healthcheck);
    if (ha.fails !== hd.fails) n += 1;
    for (const k of HC_NOTICE_KINDS) if (JSON.stringify(ha[k]) !== JSON.stringify(hd[k])) n += 1;
    return n;
  }

  invalid() {
    const d = this.draft;
    if (!d) return [];
    const bad = Object.entries(RANGES).filter(([k, [lo, hi]]) => !Number.isInteger(d[k]) || d[k] < lo || d[k] > hi).map(([k]) => k);
    const fails = d.healthcheck?.fails;
    if (!Number.isInteger(fails) || fails < HC_FAILS[0] || fails > HC_FAILS[1]) bad.push("hc_fails");
    return bad;
  }

  html() {
    return `<div class="ag-nt"></div><div class="ag-foot"></div>`;
  }

  // ----- Empfänger: Dropdown zum Hinzufügen, gewählte als Pille mit x -----

  _recipients(group) {
    const d = this.draft;
    const key = TARGET_KEY[group];
    const services = this.host._data?.notify_services || [];
    const chosen = d[key];
    const free = services.filter((s) => !chosen.includes(s));
    // Auch ein gewählter Dienst, den es nicht mehr gibt, bleibt sichtbar (und lässt sich entfernen)
    const pills = chosen.map((s) => `<span class="ag-rpill ${services.includes(s) ? "" : "gone"}">${ic("bell", 14)}<span>${esc(short(s))}</span><button type="button" class="ag-rx" data-nt="target-del" data-key="${key}" data-target="${esc(s)}" aria-label="${esc(this._t("ntRemove", { name: short(s) }))}">${ic("close", 14)}</button></span>`).join("");
    const select = services.length
      ? `<select class="ag-input ag-rsel" data-nt="target-add" data-key="${key}" aria-label="${esc(this._t("ntAdd"))}" ${free.length ? "" : "disabled"}>
          <option value="">${esc(this._t(free.length ? "ntAdd" : "ntAllChosen"))}</option>${free.map((s) => `<option value="${esc(s)}">${esc(short(s))}</option>`).join("")}</select>`
      : `<div class="ag-t2 ag-small">${esc(this._t("ntNoServices"))}</div>`;
    const none = !chosen.length && services.length ? `<small class="ag-warntext">${ic("alert", 14)} ${esc(this._t("ntNoneChosen"))}</small>` : "";
    return `<div class="ag-setrow ag-recip"><div class="ag-settx"><b>${esc(this._t(group === "alarm" ? "ntAlarmTargets" : "ntMaintTargets"))}</b><small>${esc(this._t(group === "alarm" ? "ntAlarmTargetsHint" : "ntMaintTargetsHint"))}</small>
        <div class="ag-rline">${select}</div>${pills ? `<div class="ag-rpills">${pills}</div>` : ""}${none}</div></div>`;
  }

  // Wirksame Werte einer Art in einem Modus (eigener Wert vor dem gemeinsamen)
  _eff(kind, mode) {
    const base = this.draft.types[kind];
    return mode ? { ...base, ...(this.draft.modes?.[mode]?.[kind] || {}) } : base;
  }

  // Empfänger einer Art (Entwurf): eigene Liste des Modus (Reiter), sonst eigene Liste der Art, sonst die Gruppe oben (Alarm oder Wartung)
  _recipientsOf(kind, mode) {
    const group = this.draft[TARGET_KEY[GROUP_OF[kind]]] || [];
    if (this._empty().has(`${kind}|${mode || ""}`)) return { list: [], own: true, ownHere: true, group };
    const own = this._eff(kind, mode).targets;
    return { list: own?.length ? own : group, own: Boolean(own?.length), ownHere: mode ? Boolean(this.draft.modes?.[mode]?.[kind]?.targets?.length) : Boolean(this.draft.types[kind].targets?.length), group };
  }

  // Liste der Empfänger einer Art setzen (null: eigene Liste entfällt, die Gruppe oder der Wert für alle Modi gilt wieder)
  _setTargets(kind, mode, list) {
    const d = this.draft;
    if (!mode) {
      d.types[kind].targets = list || [];
      return;
    }
    const own = { ...(d.modes[mode]?.[kind] || {}) };
    if (list?.length) own.targets = list;
    else delete own.targets;
    const kinds = { ...(d.modes[mode] || {}) };
    if (Object.keys(own).length) kinds[kind] = own;
    else delete kinds[kind];
    if (Object.keys(kinds).length) d.modes[mode] = kinds;
    else delete d.modes[mode];
  }

  // Dropdown und Pillen der Empfänger einer Meldungsart. Vorgewählt sind die Empfänger der Gruppe oben; wer hier etwas ändert, überschreibt sie
  _typeRecipients(kind, mode, name) {
    const md = mode ? ` data-mode="${mode}"` : "";
    const services = this.host._data?.notify_services || [];
    const r = this._recipientsOf(kind, mode);
    const free = services.filter((s) => !r.list.includes(s));
    const groupName = this._t(GROUP_OF[kind] === "alarm" ? "ntAlarmTargets" : "ntMaintTargets");
    const origin = r.own
      ? `<small class="ag-origin own">${esc(this._t(mode && !r.ownHere ? "ntSameAsAll" : "ntOwnTargets"))} ${r.ownHere ? `<button type="button" class="ag-link" data-nt="kt-reset" data-kind="${kind}"${md}>${esc(this._t("ntTargetsReset"))}</button>` : ""}</small>`
      : `<small class="ag-origin">${esc(this._t("ntTargetsDefault", { group: groupName }))}</small>`;
    const pills = r.list.map((s) => `<span class="ag-rpill ${services.includes(s) ? "" : "gone"}">${ic("bell", 14)}<span>${esc(short(s))}</span><button type="button" class="ag-rx" data-nt="kt-del" data-kind="${kind}"${md} data-target="${esc(s)}" aria-label="${esc(this._t("ntRemove", { name: short(s) }))}">${ic("close", 14)}</button></span>`).join("");
    const select = services.length
      ? `<select class="ag-input ag-rsel" data-nt="kt-add" data-kind="${kind}"${md} aria-label="${esc(`${name}: ${this._t("ntAdd")}`)}" ${free.length ? "" : "disabled"}><option value="">${esc(this._t(free.length ? "ntAdd" : "ntAllChosen"))}</option>${free.map((s) => `<option value="${esc(s)}">${esc(short(s))}</option>`).join("")}</select>`
      : "";
    return `<div class="ag-mt-opt ag-mt-recip"><span>${esc(this._t("ntRecipientsShort"))}<small class="ag-t2 ag-block">${origin}</small></span>${select}</div>${pills ? `<div class="ag-rpills ag-mt-pills">${pills}</div>` : `<small class="ag-warntext">${ic("alert", 14)} ${esc(this._t("ntNoneOwn"))}</small>`}`;
  }

  // Eigenen Wert eines Modus setzen; entspricht er dem gemeinsamen Wert, entfällt er (so folgt er späteren Änderungen mit)
  _setOwn(kind, mode, key, value) {
    const d = this.draft;
    const own = { ...(d.modes[mode]?.[kind] || {}) };
    if (value === d.types[kind][key] || (key === "volume" && Math.round(value * 100) === Math.round(d.types[kind].volume * 100))) delete own[key];
    else own[key] = value;
    const kinds = { ...(d.modes[mode] || {}) };
    if (Object.keys(own).length) kinds[kind] = own;
    else delete kinds[kind];
    if (Object.keys(kinds).length) d.modes[mode] = kinds;
    else delete d.modes[mode];
  }

  // ----- Eine Meldungsart -----

  _type(kind, icon, dirty, sub = false, mode = null) {
    const d = this.draft;
    const s = this._eff(kind, mode);
    const md = mode ? ` data-mode="${mode}"` : "";
    const toggle = (attr, on, label) => `<button class="ag-toggle ${on ? "on" : ""}" ${attr} role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>`;
    const name = this._t(`ntT_${kind}`);
    const hint = this._t(`ntH_${kind}`);
    const pct = Math.round(s.volume * 100);
    // Herkunft: im Modus "eigener Wert" (mit Zurücksetzen) oder "wie in Alle Modi"; in "Alle Modi" ein Hinweis auf abweichende Modi
    let origin = "";
    if (mode) {
      const own = d.modes?.[mode]?.[kind];
      origin = own
        ? `<small class="ag-origin own">${esc(this._t("ntOwnValue"))} <button type="button" class="ag-link" data-nt="mode-reset" data-kind="${kind}" data-mode="${mode}">${esc(this._t("ntReset"))}</button></small>`
        : `<small class="ag-origin">${esc(this._t("ntSameAsAll"))}</small>`;
    }
    let body = "";
    if (s.enabled) {
      const nums = NUMBERS[kind] || [];
      const bad = new Set(this.invalid());
      body = `<div class="ag-mt-body">
        ${this._typeRecipients(kind, mode, name)}
        <div class="ag-mt-opt sw">${toggle(`data-nt="critical" data-kind="${kind}"${md}`, s.critical, `${name}: ${this._t("ntCriticalShort")}`)}<span>${esc(this._t("ntCriticalShort"))}</span></div>
        ${s.critical ? `<div class="ag-mt-opt vol"><span>${esc(this._t("ntVolumeShort"))}: <b class="ag-vol" data-kind="${kind}"${md}>${pct} %</b></span>
          <input type="range" min="0" max="100" step="5" data-nt="volume" data-kind="${kind}"${md} value="${pct}" class="ag-range" aria-label="${esc(`${name}: ${this._t("ntVolumeShort")}`)}"></div>` : ""}
        <div class="ag-mt-opt sw">${toggle(`data-nt="persistent" data-kind="${kind}"${md}`, s.persistent, `${name}: ${this._t("ntPersistent")}`)}<span>${esc(this._t("ntPersistent"))}<small class="ag-t2 ag-block">${esc(this._t("ntPersistentHint"))}</small></span></div>
        ${kind === "arm_failed" ? ["retry", "force"].map((key) => `<div class="ag-mt-opt sw">${toggle(`data-nt="armbtn" data-key="${key}"`, this._armButton(key), `${name}: ${this._t(`ntArm_${key}`)}`)}<span>${esc(this._t(`ntArm_${key}`))}<small class="ag-t2 ag-block">${esc(this._t(`ntArmHint_${key}`))}</small></span></div>`).join("") : ""}
        ${nums.map(([key, label, unit, hint]) => `<div class="ag-mt-opt" data-num="${key}"><span>${esc(this._t(label))}${hint ? `<small>${esc(this._t(hint))}</small>` : ""}</span><span class="ag-num ${bad.has(key) ? "bad" : ""}"><input type="number" min="${RANGES[key][0]}" max="${RANGES[key][1]}" step="1" inputmode="numeric" data-nt="num" data-key="${key}" value="${esc(Number.isFinite(d[key]) ? d[key] : "")}" aria-label="${esc(this._t(label))}"><span class="ag-t2">${esc(unit === "%" ? unit : this._t(unit))}</span></span></div>`).join("")}
        <div class="ag-mt-opt"><span class="ag-t2 ag-small">${esc(this._t("ntTestHint"))}</span>
          ${onceBtn(`nt:${kind}:${mode || ""}`, `data-nt="test" data-kind="${kind}"${md}`, { running: this.onceKey === `nt:${kind}:${mode || ""}`, label: this._t("ntTestType"), stopLabel: this._t("playStop"), text: this._t("ntTestType"), size: 16, cls: "ag-btn", disabled: dirty, title: dirty ? this._t("wfSaveFirst") : this._t("ntTestType") })}</div></div>`;
    }
    return `<div class="ag-mt ${sub ? "sub" : ""} ${s.enabled ? "" : "off"}"><div class="ag-mt-head">${toggle(`data-nt="enabled" data-kind="${kind}"${md}`, s.enabled, name)}<span class="ag-mini">${ic(icon, 16)}</span>
        <div class="ag-settx"><b>${esc(name)}</b><small>${esc(hint)}</small>${origin}</div></div>${body}</div>`;
  }

  render() {
    const h = this.host;
    const box = h._view?.querySelector(".ag-nt");
    const d = this.ensureDraft();
    if (!box) return;
    const dirty = this.dirtyCount() > 0;
    const card = (rows) => `<div class="ag-card ag-setlist">${rows}</div>`;
    const list = (group) => GROUPS[group].map(([kind, icon]) => this._type(kind, icon, dirty)).join("");
    // Schalter "Einstellungen pro Modus": aus = ein Satz für alle Modi; ein = Reiter der Modi (der erste gewählt) mit eigenen Werten je Modus
    const modes = ALL_MODES.filter((m) => (h._systems().length ? h._systems().some((s) => (s.modes || []).includes(m)) : m !== "night"));
    if (d.per_mode && !modes.includes(this.modeTab)) this.modeTab = modes[0] || "home";
    const tabs = d.per_mode ? h._segHtml("nt-mode", modes.map((m) => [`tab:${m}`, this._t(MODE_KEY[m]), MODE_ICON[m]]), `tab:${this.modeTab}`, "data-nt", "small ag-modeseg") : "";
    const sw = `<div class="ag-pmbar"><div class="ag-pmsw"><button class="ag-toggle ${d.per_mode ? "on" : ""}" data-nt="permode" role="switch" aria-checked="${d.per_mode}" aria-label="${esc(this._t("ntPerMode"))}"></button>
      <div class="ag-settx"><b>${esc(this._t("ntPerMode"))}</b><small>${esc(this._t(d.per_mode ? "ntPerModeOn" : "ntPerModeHint"))}</small></div></div>${tabs}</div>`;
    const modeList = () => MODE_KINDS.map(([kind, icon]) => this._type(kind, icon, dirty, false, this.modeTab)).join("");
    // Arten, die nicht vom Modus abhängen (Scharfschalten nicht möglich, Deaktiviert): mit Schalter unter den Reitern, sonst in der Liste
    const modeKinds = new Set(MODE_KINDS.map(([k]) => k));
    const restList = () => GROUPS.alarm.filter(([kind]) => !modeKinds.has(kind)).map(([kind, icon]) => this._type(kind, icon, dirty)).join("");
    const alarmBody = d.per_mode
      ? `<div class="ag-pmscope">${ic(MODE_ICON[this.modeTab], 18)}${esc(this._t("pmScope", { mode: this._t(MODE_KEY[this.modeTab]) }))}</div><div class="ag-card ag-mtlist">${modeList()}</div>
        <div class="ag-pmscope">${ic("shield", 18)}${esc(this._t("ntAllModesScope"))}</div><div class="ag-card ag-mtlist">${restList()}</div>`
      : `<div class="ag-card ag-mtlist">${list("alarm")}</div>`;
    const html = chapter(this._t("ntChapRecipients"), card(this._recipients("alarm") + this._recipients("maintenance")), this._t("ntChapRecipientsHint"))
      + chapter(this._t("ntChapAlarm"), `<div class="ag-pmgroup ${d.per_mode ? "on" : ""}">${sw}${alarmBody}</div><p class="ag-chap-h ag-nt-moved">${ic("info", 14)} ${esc(this._t("ntMovedHint"))}</p>`, this._t("ntChapAlarmHint"))
      + chapter(this._t("ntChapMaint"), `<div class="ag-card ag-mtlist">${list("maintenance")}</div>`, this._t("ntChapMaintHint"))
      + chapter(this._t("ntChapHc"), this._hcHtml(), this._t("ntChapHcHint"));
    h._setHtml(box, html);
    h._placePills();
    this.renderFoot();
  }

  // Kapitel "HealthCheck-Dienste" (1.68.0): immer da, auch ohne eingerichteten Dienst (Wunsch des Nutzers 18:42). Die Zahl gescheiterter Aufrufe
  // und die zwei Meldungen als Karten wie die festen Meldungen unter Aktionen: Schalter, Play (Testmeldung mit den Werten der Karte, auch
  // ungespeichert) und Stift (dasselbe Fenster, Empfänger standardmässig die der Wartung).
  _hcHtml() {
    const d = this.draft;
    const hc = d.healthcheck;
    const bad = this.invalid().includes("hc_fails");
    const maint = d.maintenance_targets || [];
    const fails = `<div class="ag-setrow ag-hcfails"><div class="ag-settx"><b>${esc(this._t("ntHcFails"))}</b><small>${esc(this._t("ntHcFailsHint"))}</small></div>
      <span class="ag-num ${bad ? "bad" : ""}"><input type="number" min="${HC_FAILS[0]}" max="${HC_FAILS[1]}" step="1" inputmode="numeric" data-nt="hc-fails" value="${esc(Number.isFinite(hc.fails) ? hc.fails : "")}" aria-label="${esc(this._t("ntHcFails"))}"><span class="ag-t2">${esc(this._t("ntHcFailsUnit"))}</span></span></div>`;
    const card = (kind) => {
      const n = normHcNotice(hc[kind]);
      const label = this._t(`ntc_${kind}`);
      const to = n.targets.length ? n.targets.map(short).join(", ") : maint.length ? this._t("ntcToMaint") : this._t("ntcToNone");
      const parts = n.enabled ? [to, n.critical ? this._t("ntcCritical", { volume: Math.round(n.volume * 100) }) : "", n.persistent ? this._t("ntcPersistent") : "", n.title || n.message ? this._t("ntcOwnText") : ""].filter(Boolean) : [this._t("ntcOff")];
      const play = onceBtn(`hc:${kind}`, `data-nt="hc-play" data-kind="${kind}"`, { running: this.onceKey === `hc:${kind}`, label: this._t("ntcTest"), stopLabel: this._t("playStop"), disabled: !n.enabled, title: n.enabled ? this._t("ntcTest") : this._t("ntcTestOff") });
      return `<div class="ag-card ag-wf-endcard ag-wf-notice ag-hcnotice ${n.enabled ? "" : "off"}" data-hc-notice="${kind}">
        <button class="ag-toggle ${n.enabled ? "on" : ""}" data-nt="hc-on" data-kind="${kind}" role="switch" aria-checked="${n.enabled}" aria-label="${esc(label)}"></button>
        <span class="ag-wf-icon k-notify">${ic(kind === "hc_down" ? "heartPulse" : "check", 20)}</span><div class="ag-wf-text"><b>${esc(label)}</b><small class="ag-t2 ag-small ${n.enabled && !n.targets.length && !maint.length ? "ag-warntext" : ""}">${esc(parts.join(" · "))}</small></div>
        <div class="ag-wf-btns">${play}<button class="ag-iconbtn" data-nt="hc-edit" data-kind="${kind}" aria-label="${esc(this._t("ntcEdit", { name: label }))}" title="${esc(this._t("wfEndEdit"))}">${ic("pencil", 18)}</button></div></div>`;
    };
    return `<div class="ag-card ag-setlist">${fails}</div><div class="ag-hcnotices">${HC_NOTICE_KINDS.map(card).join("")}</div>`;
  }

  // Testmeldung einer Meldung der HealthCheck-Dienste mit den Werten der Karte (auch ungespeichert), an ihre Empfänger
  async hcTest(kind) {
    const h = this.host;
    const key = `hc:${kind}`;
    const paint = () => paintOnce([h._view], this.onceKey);
    if (this.onceKey === key) {
      this.onceKey = null;
      return paint();
    }
    const notice = normHcNotice(this.ensureDraft().healthcheck[kind]);
    await runOnce(this, key, async () => {
      try {
        await h._hass.callWS({ type: "alarmageddon/test_healthcheck_notify", kind, notice: { ...notice, enabled: true } });
        h._toast(this._t("wfEndTested"));
      } catch (err) {
        h._toast(err?.code === "no_targets" ? this._t("ntTestNone") : this._t("errGeneric", { message: errText(err) }));
      }
    }, paint);
  }

  renderFoot() {
    const h = this.host;
    h._renderDots?.(); // Punkt "ungespeichert" an den Reitern
    const foot = h._view?.querySelector(".ag-foot");
    if (!foot) return;
    const n = this.dirtyCount();
    const bad = this.invalid().length;
    let status;
    if (bad) status = `<span class="ag-err">${esc(this._t("ntInvalid"))}</span>`;
    else if (this.saveState === "saved" && !n) status = `<span class="ag-saved">${ic("check", 16)} ${esc(this._t("saved"))}</span>`;
    else if (this.saveState && this.saveState !== "saved") status = `<span class="ag-err">${esc(this.saveState)}</span>`;
    else status = `<span class="ag-t2">${esc(n === 0 ? this._t("noChanges") : n === 1 ? this._t("change") : this._t("changes", { count: n }))}</span>`;
    h._setHtml(foot, `${status}<span class="ag-grow"></span><button class="ag-btn" data-nt="cancel" ${n ? "" : "disabled"}>${esc(this._t("cancel"))}</button>
      <button class="ag-btn primary" data-nt="save" ${n && !bad && !this.saving ? "" : "disabled"}>${ic("check", 18)}${esc(this._t("save"))}</button>`);
    // Testmeldungen gehen mit dem gespeicherten Stand hinaus: mit offenen Änderungen gesperrt
    h._view.querySelectorAll('[data-nt="test"]').forEach((b) => (b.disabled = n > 0));
  }

  async save() {
    const h = this.host;
    if (!this.draft || this.saving || this.invalid().length) return;
    // Eine Meldung ohne Empfänger wird beim Speichern ausgeschaltet (Schalter aus, eigene Liste zurück auf den Standard): so ist
    // nichts vorgetäuscht, denn eine leere Liste hiesse beim Server "es gilt die Gruppe oben"
    for (const key of this._empty()) {
      const [kind, mode] = key.split("|");
      if (mode) {
        this._setOwn(kind, mode, "enabled", false);
        this._setTargets(kind, mode, null);
      } else {
        this.draft.types[kind].enabled = false;
        this.draft.types[kind].targets = [];
      }
    }
    this.saving = true;
    this.renderFoot();
    try {
      const { selftest_minutes: _off, selftest_minutes_armed: _on, selftest_hours: _hours, selftest_hours_armed: _armed, ...notify } = this.draft;
      const result = await h._hass.callWS({ type: "alarmageddon/save_notify", notify });
      if (h._data) h._data.notify = result?.notify || JSON.parse(JSON.stringify(this.draft));
      this._empty().clear();
      this.draft = null;
      this.saveState = "saved";
      this.host._markSaved(this); // Punkte "ungespeichert" verschwinden sofort
    } catch (err) {
      this.saveState = this._t("saveFailed", { message: errText(err) });
    } finally {
      this.saving = false;
      this.render();
    }
  }

  // Testmeldung einer Art: der Knopf wird rot und zum Stopp-Knopf wie jeder Play-Knopf (common.js runOnce); Stopp beendet nur die Anzeige
  async test(kind, mode) {
    const h = this.host;
    const key = `nt:${kind}:${mode || ""}`;
    const paint = () => paintOnce([h._view], this.onceKey);
    if (this.onceKey === key) {
      this.onceKey = null;
      return paint();
    }
    await runOnce(this, key, async () => {
      try {
        const result = await h._hass.callWS({ type: "alarmageddon/test_notify", kind, ...(mode ? { mode } : {}) });
        const n = result?.targets?.length || 0;
        h._toast(n ? this._t("ntTestSent", { count: n }) : this._t("ntTestNone"));
      } catch (err) {
        h._toast(this._t("errGeneric", { message: errText(err) }));
      }
    }, paint);
  }

  onClick(el) {
    const act = el?.dataset.nt;
    if (!act) return false;
    const d = this.ensureDraft();
    if (act === "target-del") {
      d[el.dataset.key] = d[el.dataset.key].filter((x) => x !== el.dataset.target);
    } else if (act === "permode") {
      d.per_mode = !d.per_mode;
      if (d.per_mode) this.modeTab = ALL_MODES.find((m) => this.host._systems().some((s) => (s.modes || []).includes(m))) || "home"; // der erste Modus ist gewählt
    } else if (act.startsWith("tab:")) {
      this.modeTab = act.slice(4);
      this.render();
      return true;
    } else if (act === "armbtn") {
      // Knöpfe der Meldung "Scharfschalten nicht möglich" (1.18.0); ohne gespeicherten Wert an
      d[`arm_${el.dataset.key}_action`] = !this._armButton(el.dataset.key);
    } else if (act === "enabled" || act === "critical" || act === "persistent") {
      const { kind, mode } = el.dataset;
      const key = act;
      if (mode) this._setOwn(kind, mode, key, !this._eff(kind, mode)[key]);
      else d.types[kind][key] = !d.types[kind][key];
    } else if (act === "kt-del") {
      const { kind, mode } = el.dataset;
      const next = this._recipientsOf(kind, mode || null).list.filter((x) => x !== el.dataset.target);
      // Der letzte lässt sich auch entfernen (wie oben bei den Empfängern von Alarmen): es erscheint die Warnung, und gespeichert
      // wird erst, wenn ein neuer Empfänger gewählt oder die Gruppe oben wieder übernommen ist
      if (!next.length) this._empty().add(`${kind}|${mode || ""}`);
      else this._setTargets(kind, mode || null, next);
    } else if (act === "kt-reset") {
      this._empty().delete(`${el.dataset.kind}|${el.dataset.mode || ""}`);
      this._setTargets(el.dataset.kind, el.dataset.mode || null, null);
    } else if (act === "mode-reset") {
      const { kind, mode } = el.dataset;
      const kinds = { ...(d.modes[mode] || {}) };
      delete kinds[kind];
      if (Object.keys(kinds).length) d.modes[mode] = kinds;
      else delete d.modes[mode];
    } else if (act === "cancel") { this._empty().clear(); this.draft = null; }
    else if (act === "save") return this.save(), true;
    else if (act === "hc-on") {
      const n = normHcNotice(d.healthcheck[el.dataset.kind]);
      d.healthcheck = { ...d.healthcheck, [el.dataset.kind]: { ...n, enabled: !n.enabled } };
    } else if (act === "hc-edit") {
      const kind = el.dataset.kind;
      this.host.actions.openHcNoticeEditor(kind, d.healthcheck[kind], (notice) => {
        const dr = this.ensureDraft();
        dr.healthcheck = { ...dr.healthcheck, [kind]: notice };
        this.saveState = null;
        this.render();
      });
      return true;
    } else if (act === "hc-play") return this.hcTest(el.dataset.kind), true;
    else if (act === "test") return this.test(el.dataset.kind, el.dataset.mode), true;
    else return false;
    this.saveState = null;
    this.render();
    return true;
  }

  onInput(el) {
    const act = el.dataset.nt;
    if (act === "target-add") {
      if (!el.value) return true;
      const d = this.ensureDraft();
      d[el.dataset.key] = [...d[el.dataset.key], el.value];
      this.saveState = null;
      this.render();
      return true;
    }
    if (act === "kt-add") {
      if (!el.value || !/^notify\.[a-z0-9_]+$/.test(el.value)) return true;
      this.ensureDraft();
      const { kind, mode } = el.dataset;
      const cur = this._recipientsOf(kind, mode || null).list;
      this._empty().delete(`${kind}|${mode || ""}`);
      if (!cur.includes(el.value)) this._setTargets(kind, mode || null, [...cur, el.value]);
      this.saveState = null;
      this.render();
      return true;
    }
    if (act === "hc-fails") {
      const d = this.ensureDraft();
      d.healthcheck = { ...d.healthcheck, fails: el.value === "" ? NaN : Number(el.value) };
      this.saveState = null;
      el.closest(".ag-num")?.classList.toggle("bad", this.invalid().includes("hc_fails"));
      this.renderFoot();
      return true;
    }
    if (act === "num") {
      const d = this.ensureDraft();
      const key = el.dataset.key;
      d[key] = el.value === "" ? NaN : Number(el.value);
      this.saveState = null;
      const [lo, hi] = RANGES[key];
      el.closest(".ag-num")?.classList.toggle("bad", !Number.isInteger(d[key]) || d[key] < lo || d[key] > hi);
      this.renderFoot();
      return true;
    }
    if (act === "volume") {
      const { kind, mode } = el.dataset;
      this.ensureDraft();
      if (mode) this._setOwn(kind, mode, "volume", Number(el.value) / 100);
      else this.draft.types[kind].volume = Number(el.value) / 100;
      this.saveState = null;
      const label = this.host._view.querySelector(`.ag-vol[data-kind="${kind}"]${mode ? `[data-mode="${mode}"]` : ""}`);
      if (label) label.textContent = `${el.value} %`;
      this.renderFoot();
      return true;
    }
    return false;
  }
}
