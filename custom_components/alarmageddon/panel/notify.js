// Konfiguration › Meldungen (für alle Anlagen), in Kapiteln: Standard-Empfänger (Dropdown, gewählte als Pille mit x, getrennt für Alarme und
// Wartung), Störungsmeldungen und Wartungsmeldungen. Seit 1.69.0 (Wunsch des Nutzers 2026-11-19, 22:20; Entscheid 23:01 "C") ist jede Meldung eine
// Karte wie die festen Meldungen unter Aktionen: Schalter, Symbol in der Farbe des Kapitels, Titel, Kurzfassung, Play (Testmeldung) und Stift. Der
// Stift öffnet das Fenster #ag-ntkind mit allen Einstellungen der Meldung. Das Fenster ändert nur den Entwurf der Seite ("Übernehmen");
// gespeichert wird wie bisher allein mit "Speichern" unten (Vorgabe des Nutzers 23:01), "Abbrechen" stellt den Stand beim Öffnen wieder her.
// Testmeldungen gehen mit dem gespeicherten Stand hinaus.

const V = new URL(import.meta.url).search;
const { ic, esc, errText, chapter, MODE_KEY, MODE_ICON, onceBtn, paintOnce, runOnce } = await import(`./common.js${V}`);

// Arten je Gruppe in der Reihenfolge der Anzeige, mit Symbol
const GROUPS = {
  // Seit 1.62.0 ohne "Stiller Alarm", "Eingangsverzögerung", "Scharf geschaltet" und "Deaktiviert": sie stehen als feste Elemente im Reiter
  // Aktionen (je Anlage und Modus). Ihre früheren gemeinsamen Werte bleiben im Entwurf unberührt erhalten (der Server nimmt sie, solange
  // eine Anlage nichts Eigenes gespeichert hat).
  alarm: [["sensor_offline", "alert"], ["arm_failed", "doorOpen"]],
  // Selbsttest (1.65.0): eigene Meldungsart, einzeln ein- und auszuschalten wie die anderen. HealthCheck-Dienst antwortet nicht (seit 1.69.0, Wunsch
  // des Nutzers 2026-11-19, 22:16/22:17): wie der Selbsttest, dazu die Zahl der Fehlversuche und "Melden, wenn er wieder antwortet"
  maintenance: [["battery_low", "battery"], ["sensor_unavailable", "offline"], ["selftest", "stethoscope"], ["healthcheck", "heartPulse"]],
};
// Arten, die nur im scharfen Zustand vorkommen: je Modus eigene Werte (Unterreiter), sonst der gemeinsame Wert
const MODE_KINDS = [["sensor_offline", "alert"]];
const ALL_MODES = ["home", "away", "night"];
const TARGET_KEY = { alarm: "alarm_targets", maintenance: "maintenance_targets" };
// Die Abstände des Selbsttests (selftest_minutes, selftest_minutes_armed; bis 1.66.x selftest_hours, selftest_hours_armed) stehen seit der dritten Fassung von 1.65.0 im Kapitel HealthCheck (Konfiguration › Anlage) und werden
// dort gespeichert; dieser Entwurf sendet sie nie mit (sonst überschriebe ein älterer Entwurf die neuen Werte)
const RANGES = { battery_threshold: [5, 50], battery_checks: [1, 10], offline_minutes: [5, 1440], healthcheck_fails: [1, 10] };
const ARM_BUTTONS = ["arm_retry_action", "arm_force_action"];
// Arten mit Zahlenfeldern: je Feld Schlüssel, Beschriftung, Einheit (Schlüssel), Hinweis. "Meldung nach … Prüfungen" seit 1.68.0 (Wunsch des Nutzers
// 2026-11-19, 19:38: eine Meldung "Batterie 1 %" bei 61 %, ein einzelner falscher Wert des Geräts). Seit 1.69.0 im Fenster als einheitliche Zeilen
// (Wunsch des Nutzers 22:27): Beschriftung links, Feld und Einheit rechts in gleicher Flucht, der Hinweis darunter.
const NUMBERS = {
  battery_low: [["battery_threshold", "ntThreshold", "ntPercent"], ["battery_checks", "ntBatteryChecks", "ntBatteryChecksUnit", "ntBatteryChecksHint"]],
  sensor_unavailable: [["offline_minutes", "ntOfflineAfter", "ntOfflineUnit"]],
  healthcheck: [["healthcheck_fails", "ntHcFails", "ntHcFailsUnit", "ntHcFailsHint"]],
};
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, list]) => list.map(([k]) => [k, g])));
const ICON_OF = Object.fromEntries([...GROUPS.alarm, ...GROUPS.maintenance]);
const KINDS = [...GROUPS.alarm, ...GROUPS.maintenance].map(([k]) => k);

const short = (s) => s.replace(/^notify\.(mobile_app_)?/, "");

export class NotifyUi {
  constructor(host) {
    this.host = host;
    this.draft = null;
    this.saveState = null;
    this.saving = false;
    this.modeTab = "home"; // gewählter Modus (nur mit eingeschaltetem Schalter; Ansicht, nicht Teil des Entwurfs)
    this.kindEdit = null; // offenes Fenster einer Meldung: { kind, mode, snap, empty, hadDraft, error }
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get base() {
    const types = Object.fromEntries(KINDS.map((k) => [k, { enabled: true, critical: false, volume: 0.8 }]));
    return (this.host._data?.notify || { alarm_targets: [], maintenance_targets: [], types, battery_threshold: 20, battery_checks: 3, offline_minutes: 60, selftest_minutes: 360, healthcheck_fails: 2, healthcheck_up: true });
  }

  // Knopf der Meldung "Scharfschalten nicht möglich": "retry" oder "force"; ohne gespeicherten Wert an
  _armButton(key) {
    return (this.draft || this.base)[`arm_${key}_action`] !== false;
  }

  ensureDraft() {
    if (!this.draft) this.draft = JSON.parse(JSON.stringify(this.base));
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

  // Werte einer Art, die für "geändert" zählen
  _typeSig(types, kind) {
    const x = types?.[kind] || {};
    return JSON.stringify([!!x.enabled, !!x.critical, !!x.persistent, Math.round((x.volume ?? 0) * 100), x.targets || []]);
  }

  dirtyCount() {
    if (!this.draft) return 0;
    const a = this.base;
    const d = this.draft;
    let n = 0;
    for (const k of Object.values(TARGET_KEY)) if (JSON.stringify([...(a[k] || [])].sort()) !== JSON.stringify([...d[k]].sort())) n += 1;
    for (const kind of KINDS) if (this._typeSig(a.types, kind) !== this._typeSig(d.types, kind)) n += 1;
    for (const k of Object.keys(RANGES)) if (a[k] !== d[k]) n += 1;
    for (const k of [...ARM_BUTTONS, "healthcheck_up"]) if ((a[k] !== false) !== (d[k] !== false)) n += 1;
    n += this._empty().size; // entfernter letzter Empfänger einer Meldung: offene Änderung
    if (Boolean(a.per_mode) !== Boolean(d.per_mode)) n += 1; // der Schalter zählt als eigene Änderung
    // Eigene Werte je Modus: jeder Modus mit Änderung zählt einmal
    for (const m of ALL_MODES) if (JSON.stringify(a.modes?.[m] || {}) !== JSON.stringify(d.modes?.[m] || {})) n += 1;
    return n;
  }

  // Hat eine Meldung ungespeicherte Änderungen? (orange Punkt "Noch nicht gespeichert" auf ihrer Karte, wie überall im Panel)
  kindChanged(kind) {
    if (!this.draft) return false;
    const a = this.base;
    const d = this.draft;
    if (this._typeSig(a.types, kind) !== this._typeSig(d.types, kind)) return true;
    if ((NUMBERS[kind] || []).some(([key]) => a[key] !== d[key])) return true;
    if (kind === "arm_failed" && ARM_BUTTONS.some((k) => (a[k] !== false) !== (d[k] !== false))) return true;
    if (kind === "healthcheck" && (a.healthcheck_up !== false) !== (d.healthcheck_up !== false)) return true;
    if ([...this._empty()].some((x) => x.split("|")[0] === kind)) return true;
    return ALL_MODES.some((m) => JSON.stringify(a.modes?.[m]?.[kind] || {}) !== JSON.stringify(d.modes?.[m]?.[kind] || {}));
  }

  invalid() {
    const d = this.draft;
    if (!d) return [];
    return Object.entries(RANGES).filter(([k, [lo, hi]]) => !Number.isInteger(d[k]) || d[k] < lo || d[k] > hi).map(([k]) => k);
  }

  html() {
    return `<div class="ag-nt"></div><div class="ag-foot"></div>`;
  }

  // ----- Standard-Empfänger: Dropdown zum Hinzufügen, gewählte als Pille mit x -----

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

  _toggle(attr, on, label) {
    return `<button class="ag-toggle ${on ? "on" : ""}" ${attr} role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>`;
  }

  // Herkunft im Modus: "eigener Wert" (mit Zurücksetzen) oder "Grundwert"
  _origin(kind, mode) {
    if (!mode) return "";
    return this.draft.modes?.[mode]?.[kind]
      ? `<small class="ag-origin own">${esc(this._t("ntOwnValue"))} <button type="button" class="ag-link" data-nt="mode-reset" data-kind="${kind}" data-mode="${mode}">${esc(this._t("ntReset"))}</button></small>`
      : `<small class="ag-origin">${esc(this._t("ntSameAsAll"))}</small>`;
  }

  // ----- Karte einer Meldung (wie die festen Meldungen unter Aktionen) -----

  // Kurzfassung auf der Karte: an wen, wie, und die eigenen Einstellungen der Meldung; [Text, Warnung?]
  _summary(kind, mode) {
    const d = this.draft;
    const s = this._eff(kind, mode);
    if (!s.enabled) return [this._t("ntcOff"), false];
    const r = this._recipientsOf(kind, mode);
    const names = r.list.map(short).join(", ");
    const parts = [names ? this._t(r.own ? "ntkToOwn" : "ntkTo", { names }) : this._t("ntkToNone")];
    if (s.critical) parts.push(this._t("ntcCritical", { volume: Math.round(s.volume * 100) }));
    if (s.persistent) parts.push(this._t("ntcPersistent"));
    const num = (key) => (Number.isFinite(d[key]) ? d[key] : "–");
    if (kind === "battery_low") parts.push(this._t("ntkBelow", { value: num("battery_threshold") }));
    for (const [key] of NUMBERS[kind] || []) {
      if (key === "battery_threshold") continue;
      parts.push(this._t(d[key] === 1 ? `ntkAfter1_${key}` : `ntkAfter_${key}`, { n: num(key) }));
    }
    if (kind === "healthcheck" && d.healthcheck_up !== false) parts.push(this._t("ntkUp"));
    if (kind === "arm_failed") {
      const on = ["retry", "force"].filter((key) => this._armButton(key));
      parts.push(on.length === 2 ? this._t("ntkArmBoth") : on.length ? this._t("ntkArmOne", { name: this._t(`ntArmShort_${on[0]}`) }) : this._t("ntkArmNone"));
    }
    return [parts.join(" · "), !names];
  }

  _card(kind, mode, dirty) {
    const s = this._eff(kind, mode);
    const md = mode ? ` data-mode="${mode}"` : "";
    const name = this._t(`ntT_${kind}`);
    const [summary, warn] = this._summary(kind, mode);
    const key = `nt:${kind}:${mode || ""}`;
    const tone = GROUP_OF[kind] === "alarm" ? "fault" : "maint";
    const changed = this.kindChanged(kind);
    // Testmeldungen gehen mit dem gespeicherten Stand hinaus: ausgeschaltet oder mit offenen Änderungen gesperrt
    const play = onceBtn(key, `data-nt="test" data-kind="${kind}"${md}${s.enabled ? "" : ' data-off="1"'}`, { running: this.onceKey === key, label: this._t("ntTestType"), stopLabel: this._t("playStop"),
      disabled: !s.enabled || dirty, title: !s.enabled ? this._t("ntcTestOff") : dirty ? this._t("wfSaveFirst") : this._t("ntTestType") });
    return `<div class="ag-card ag-ntk ${tone} ${s.enabled ? "" : "off"}" data-ntk="${kind}"${md}>${this._toggle(`data-nt="enabled" data-kind="${kind}"${md}`, s.enabled, name)}
      <span class="ag-ntk-icon">${ic(ICON_OF[kind], 20)}</span><div class="ag-wf-text"><b>${esc(name)}</b><small class="ag-t2 ag-small ${warn ? "ag-warntext" : ""}">${esc(summary)}</small>${this._origin(kind, mode)}${changed ? `<small class="ag-unsaved">${esc(this._t("unsavedOne"))}</small>` : ""}</div>
      <div class="ag-wf-btns">${play}<button class="ag-iconbtn" data-nt="edit" data-kind="${kind}"${md} aria-label="${esc(this._t("ntcEdit", { name }))}" title="${esc(this._t("wfEndEdit"))}">${ic("pencil", 18)}</button></div></div>`;
  }

  render() {
    const h = this.host;
    const box = h._view?.querySelector(".ag-nt");
    const d = this.ensureDraft();
    if (!box) return;
    const dirty = this.dirtyCount() > 0;
    const grid = (cards) => `<div class="ag-ntk-grid">${cards}</div>`;
    const list = (group) => GROUPS[group].map(([kind]) => this._card(kind, null, dirty)).join("");
    // Schalter "Einstellungen pro Modus": aus = ein Satz für alle Modi; ein = Reiter der Modi (der erste gewählt) mit eigenen Werten je Modus
    const modes = ALL_MODES.filter((m) => (h._systems().length ? h._systems().some((s) => (s.modes || []).includes(m)) : m !== "night"));
    if (d.per_mode && !modes.includes(this.modeTab)) this.modeTab = modes[0] || "home";
    const tabs = d.per_mode ? h._segHtml("nt-mode", modes.map((m) => [`tab:${m}`, this._t(MODE_KEY[m]), MODE_ICON[m]]), `tab:${this.modeTab}`, "data-nt", "small ag-modeseg") : "";
    const sw = `<div class="ag-pmbar"><div class="ag-pmsw">${this._toggle('data-nt="permode"', d.per_mode, this._t("ntPerMode"))}
      <div class="ag-settx"><b>${esc(this._t("ntPerMode"))}</b><small>${esc(this._t(d.per_mode ? "ntPerModeOn" : "ntPerModeHint"))}</small></div></div>${tabs}</div>`;
    // Arten, die nicht vom Modus abhängen (Scharfschalten nicht möglich): mit Schalter unter den Reitern, sonst im gemeinsamen Raster
    const modeKinds = new Set(MODE_KINDS.map(([k]) => k));
    const alarmBody = d.per_mode
      ? `<div class="ag-pmscope">${ic(MODE_ICON[this.modeTab], 18)}${esc(this._t("pmScope", { mode: this._t(MODE_KEY[this.modeTab]) }))}</div>${grid(MODE_KINDS.map(([kind]) => this._card(kind, this.modeTab, dirty)).join(""))}
        <div class="ag-pmscope">${ic("shield", 18)}${esc(this._t("ntAllModesScope"))}</div>${grid(GROUPS.alarm.filter(([kind]) => !modeKinds.has(kind)).map(([kind]) => this._card(kind, null, dirty)).join(""))}`
      : grid(list("alarm"));
    const html = chapter(this._t("ntChapRecipients"), `<div class="ag-card ag-setlist">${this._recipients("alarm") + this._recipients("maintenance")}</div>`, this._t("ntChapRecipientsHint"))
      + chapter(this._t("ntChapAlarm"), `<div class="ag-pmgroup ${d.per_mode ? "on" : ""}">${sw}${alarmBody}</div><p class="ag-chap-h ag-nt-moved">${ic("info", 14)} ${esc(this._t("ntMovedHint"))}</p>`, this._t("ntChapAlarmHint"))
      + chapter(this._t("ntChapMaint"), grid(list("maintenance")), this._t("ntChapMaintHint"));
    h._setHtml(box, html);
    h._placePills();
    if (this.kindEdit && this._dlg()?.open) this.renderKind();
    this.renderFoot();
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
    // Testmeldungen gehen mit dem gespeicherten Stand hinaus: mit offenen Änderungen gesperrt (auch im Fenster), ausgeschaltete Meldungen immer
    for (const b of [h._view, this._dlg()].flatMap((root) => [...(root?.querySelectorAll('[data-nt="test"]') || [])])) {
      if (b.classList.contains("ag-running")) continue;
      b.disabled = n > 0 || b.dataset.off === "1";
      b.title = b.dataset.off === "1" ? this._t("ntcTestOff") : n > 0 ? this._t("wfSaveFirst") : this._t("ntTestType");
      b.dataset.tip = b.title;
    }
  }

  // ----- Fenster einer Meldung (#ag-ntkind): alle Einstellungen, angewendet auf den Entwurf der Seite -----

  _dlg() {
    return this.host._root?.getElementById("ag-ntkind");
  }

  // Stand von Entwurf und leeren Empfängerlisten, für "Abbrechen" und die Rückfrage vor dem Verwerfen
  _snapshot() {
    return JSON.stringify([this.draft, [...this._empty()].sort()]);
  }

  kindDirty() {
    return Boolean(this.kindEdit) && this._snapshot() !== this.kindEdit.snap;
  }

  openKind(kind, mode) {
    const hadDraft = Boolean(this.draft);
    this.ensureDraft();
    this.kindEdit = { kind, mode: mode || null, snap: this._snapshot(), hadDraft, error: "" };
    const dlg = this._dlg();
    if (!dlg) return;
    // Wie auch immer das Fenster schliesst (Übernehmen, Abbrechen, X, Escape ohne Änderungen): danach ist es nicht mehr offen, und es bleiben
    // keine Felder und Knöpfe einer Meldung im geschlossenen Fenster stehen
    dlg.onclose = () => {
      this.kindEdit = null;
      dlg.innerHTML = "";
      this.host._lastHtml?.delete(dlg);
      this.render();
    };
    this.renderKind();
    dlg.showModal();
  }

  closeKind(apply) {
    const e = this.kindEdit;
    if (!e) return;
    if (apply) {
      const bad = this.invalid().filter((k) => (NUMBERS[e.kind] || []).some(([key]) => key === k));
      if (bad.length) {
        const [key, label, unit] = NUMBERS[e.kind].find(([k]) => k === bad[0]);
        e.error = this._t("ntkRange", { label: this._t(label), min: RANGES[key][0], max: RANGES[key][1], unit: this._t(unit) });
        return this.renderKind();
      }
    } else {
      // Abbrechen: der Stand beim Öffnen gilt wieder, auch ein vorher leerer Entwurf
      const [draft, empty] = JSON.parse(e.snap);
      this.draft = e.hadDraft ? draft : null;
      this.emptyOwn = new Set(empty);
    }
    this.kindEdit = null;
    this._dlg()?.close();
    this.render();
  }

  // Einheitliche Zahlenzeilen: Beschriftung links, Feld und Einheit rechts in einem gemeinsamen Raster (gleiche Flucht), Hinweis darunter
  _numbers(kind) {
    const d = this.draft;
    const bad = new Set(this.invalid());
    const rows = (NUMBERS[kind] || []).map(([key, label, unit, hint]) => `<div class="ag-ntk-num" data-num="${key}"><span class="ag-ntk-nl">${esc(this._t(label))}</span>
      <span class="ag-num ${bad.has(key) ? "bad" : ""}"><input type="number" min="${RANGES[key][0]}" max="${RANGES[key][1]}" step="1" inputmode="numeric" data-nt="num" data-key="${key}" value="${esc(Number.isFinite(d[key]) ? d[key] : "")}" aria-label="${esc(this._t(label))}"><span class="ag-t2 ag-ntk-unit">${esc(this._t(unit))}</span></span>
      ${hint ? `<small class="ag-ntk-nh">${esc(this._t(hint))}</small>` : ""}</div>`).join("");
    return rows ? `<div class="ag-ntk-nums">${rows}</div>` : "";
  }

  _row(attr, on, label, hint) {
    return `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ""}</div>${this._toggle(attr, on, label)}</div>`;
  }

  _sec(title, body, cls = "") {
    return `<section class="ag-chap ag-chap-s ${cls}"><h4 class="ag-sec-t">${esc(title)}</h4><div class="ag-card ag-efcard">${body}</div></section>`;
  }

  renderKind() {
    const e = this.kindEdit;
    const dlg = this._dlg();
    if (!e || !dlg) return;
    const { kind, mode } = e;
    const d = this.draft;
    const s = this._eff(kind, mode);
    const md = mode ? ` data-mode="${mode}"` : "";
    const name = this._t(`ntT_${kind}`);
    const tone = GROUP_OF[kind] === "alarm" ? "fault" : "maint";
    const scope = mode ? `<div class="ag-pmscope">${ic(MODE_ICON[mode], 18)}${esc(this._t("pmScope", { mode: this._t(MODE_KEY[mode]) }))}</div>${this._origin(kind, mode)}` : "";
    let body = this._sec(this._t("ntcSend"), this._row(`data-nt="enabled" data-kind="${kind}"${md}`, s.enabled, this._t("ntcSend"), this._t(`ntH_${kind}`)));
    if (s.enabled) {
      // Empfänger: vorgewählt die Standard-Empfänger der Gruppe; wer hier etwas ändert, überschreibt sie für diese Meldung
      const services = this.host._data?.notify_services || [];
      const r = this._recipientsOf(kind, mode);
      const free = services.filter((x) => !r.list.includes(x));
      const groupName = this._t(GROUP_OF[kind] === "alarm" ? "ntAlarmTargets" : "ntMaintTargets");
      const origin = r.own
        ? `<small class="ag-origin own">${esc(this._t(mode && !r.ownHere ? "ntSameAsAll" : "ntOwnTargets"))} ${r.ownHere ? `<button type="button" class="ag-link" data-nt="kt-reset" data-kind="${kind}"${md}>${esc(this._t("ntTargetsReset"))}</button>` : ""}</small>`
        : `<small class="ag-origin">${esc(this._t("ntTargetsDefault", { group: groupName }))}</small>`;
      const pills = r.list.map((x) => `<span class="ag-rpill ${services.includes(x) ? "" : "gone"}">${ic("bell", 14)}<span>${esc(short(x))}</span><button type="button" class="ag-rx" data-nt="kt-del" data-kind="${kind}"${md} data-target="${esc(x)}" aria-label="${esc(this._t("ntRemove", { name: short(x) }))}">${ic("close", 14)}</button></span>`).join("");
      const select = services.length
        ? `<div class="ag-rline"><select class="ag-input ag-rsel" data-nt="kt-add" data-kind="${kind}"${md} aria-label="${esc(`${name}: ${this._t("ntAdd")}`)}" ${free.length ? "" : "disabled"}><option value="">${esc(this._t(free.length ? "ntAdd" : "ntAllChosen"))}</option>${free.map((x) => `<option value="${esc(x)}">${esc(short(x))}</option>`).join("")}</select></div>`
        : `<div class="ag-t2 ag-small">${esc(this._t("ntNoServices"))}</div>`;
      body += this._sec(this._t("fldNtTargets"), `<div class="ag-ntk-recip">${origin}${select}${pills ? `<div class="ag-rpills ag-ntk-pills">${pills}</div>` : `<small class="ag-warntext">${ic("alert", 14)} ${esc(this._t(r.own ? "ntNoneOwn" : "ntkNoneGroup"))}</small>`}</div>`);
      // Zustellung: kritisch (mit Lautstärke), in Home Assistant stehen lassen
      const pct = Math.round(s.volume * 100);
      body += this._sec(this._t("fldNtDelivery"), this._row(`data-nt="critical" data-kind="${kind}"${md}`, s.critical, this._t("ntCriticalShort"), this._t("fldNtCriticalHint"))
        + (s.critical ? `<div class="ag-ef-range"><label><span>${esc(this._t("ntVolumeShort"))}</span><b class="ag-ef-val ag-vol" data-kind="${kind}"${md}>${pct} %</b></label><input type="range" class="ag-range" min="0" max="100" step="5" data-nt="volume" data-kind="${kind}"${md} value="${pct}" aria-label="${esc(`${name}: ${this._t("ntVolumeShort")}`)}"></div>` : "")
        + this._row(`data-nt="persistent" data-kind="${kind}"${md}`, s.persistent, this._t("ntPersistent"), this._t("ntPersistentHint")));
      // Eigene Einstellungen der Meldung: Zahlen, Knöpfe der Meldung, "Melden, wenn er wieder antwortet"
      const own = this._numbers(kind)
        + (kind === "arm_failed" ? ["retry", "force"].map((key) => this._row(`data-nt="armbtn" data-key="${key}"`, this._armButton(key), this._t(`ntArm_${key}`), this._t(`ntArmHint_${key}`))).join("") : "")
        + (kind === "healthcheck" ? this._row('data-nt="hcup"', d.healthcheck_up !== false, this._t("ntHcUp"), this._t("ntHcUpHint")) : "");
      if (own) body += this._sec(this._t("ntkSettings"), own);
      const key = `nt:${kind}:${mode || ""}`;
      const dirty = this.dirtyCount() > 0;
      body += `<div class="ag-ntk-test">${onceBtn(key, `data-nt="test" data-kind="${kind}"${md}`, { running: this.onceKey === key, label: this._t("ntTestType"), stopLabel: this._t("playStop"), text: this._t("ntTestType"), size: 16, cls: "ag-btn",
        disabled: dirty, title: dirty ? this._t("wfSaveFirst") : this._t("ntTestType") })}<small class="ag-t2">${esc(this._t("ntTestHint"))}</small></div>`;
    }
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-step-ed ag-ntk-ed"><div class="ag-sys-top"><span class="ag-ntk-icon ${tone}">${ic(ICON_OF[kind], 22)}</span><h3>${esc(name)}</h3></div>${scope}
      ${body}<div class="ag-dlg-err" aria-live="polite">${esc(e.error || "")}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-nt="kind-cancel">${esc(this._t("cancel"))}</button><button class="ag-btn primary" data-nt="kind-apply">${esc(this._t("apply"))}</button></div></div>`);
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
      // "healthcheck": die Form aus 1.68.0 (zwei feste Meldungen); seit 1.69.0 nie mehr gesendet (der Server nimmt sie nicht mehr an)
      const { selftest_minutes: _off, selftest_minutes_armed: _on, selftest_hours: _hours, selftest_hours_armed: _armed, healthcheck: _old, ...notify } = this.draft;
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

  // Testmeldung einer Art: der Knopf wird rot und zum Stopp-Knopf wie jeder Play-Knopf (common.js runOnce); Stopp beendet nur die Anzeige.
  // Karte und Fenster tragen denselben Schlüssel und laufen gemeinsam. Mit `group` ("alarm", "maintenance"; Einrichtungsassistent, 1.71.0) an die
  // Standard-Empfänger der Gruppe statt an die Empfänger einer Art.
  async test(kind, mode, group = null) {
    const h = this.host;
    const key = group ? `nt:group:${group}` : `nt:${kind}:${mode || ""}`;
    const paint = () => paintOnce([h._view, this._dlg()], this.onceKey);
    if (this.onceKey === key) {
      this.onceKey = null;
      return paint();
    }
    await runOnce(this, key, async () => {
      try {
        const result = await h._hass.callWS(group ? { type: "alarmageddon/test_notify", group } : { type: "alarmageddon/test_notify", kind, ...(mode ? { mode } : {}) });
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
    if (act === "edit") return this.openKind(el.dataset.kind, el.dataset.mode), true;
    if (act === "kind-apply" || act === "kind-cancel") return this.closeKind(act === "kind-apply"), true;
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
    else if (act === "hcup") d.healthcheck_up = d.healthcheck_up === false;
    else if (act === "test") return this.test(el.dataset.kind, el.dataset.mode), true;
    else return false;
    this.saveState = null;
    if (this.kindEdit) this.kindEdit.error = "";
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
    if (act === "num") {
      const d = this.ensureDraft();
      const key = el.dataset.key;
      d[key] = el.value === "" ? NaN : Number(el.value);
      this.saveState = null;
      const [lo, hi] = RANGES[key];
      el.closest(".ag-num")?.classList.toggle("bad", !Number.isInteger(d[key]) || d[key] < lo || d[key] > hi);
      if (this.kindEdit?.error) {
        this.kindEdit.error = "";
        const err = this._dlg()?.querySelector(".ag-dlg-err");
        if (err) err.textContent = "";
      }
      this.renderFoot();
      return true;
    }
    if (act === "volume") {
      const { kind, mode } = el.dataset;
      this.ensureDraft();
      if (mode) this._setOwn(kind, mode, "volume", Number(el.value) / 100);
      else this.draft.types[kind].volume = Number(el.value) / 100;
      this.saveState = null;
      const label = el.closest(".ag-ef-range")?.querySelector(".ag-vol");
      if (label) label.textContent = `${el.value} %`;
      this.renderFoot();
      return true;
    }
    return false;
  }
}
