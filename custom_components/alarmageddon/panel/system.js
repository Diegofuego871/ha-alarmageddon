// Konfiguration › Anlage: Modi, Verzögerungen, Verhalten bei offenen Sensoren, Zeitplan (Entwurf mit "Speichern");
// dazu Codes pro Person und Sicherung (sofort).
// Dieselben Schlüssel wie der Optionsdialog von HA (WebSocket alarmageddon/save_system). Der Code bleibt im Optionsdialog.

const V = new URL(import.meta.url).search;
const { ic, esc, MODE_KEY, MODE_ICON, errText, chapter } = await import(`./common.js${V}`);
const { customList, uploadHtml, uploadError, uploadSound, usage, soundInfo, soundBadge } = await import(`./customsounds.js${V}`);
const { RoutinesUi, normRoutines, canon } = await import(`./routines.js${V}`);

const MAX = 3600;
const DEFAULTS = { exit_delay: 0, entry_delay: 30, confirm_window: 60 };
const WINDOW = [5, 600];
const ALL_MODES = ["home", "away", "night"];
const MODE_HINT = { home: "sysModeHomeHint", away: "sysModeAwayHint", night: "sysModeNightHint" };

export class SystemUi {
  constructor(host) {
    this.host = host;
    this.draft = null;
    this.saveState = null;
    this.saving = false;
    this.backups = null; // in der Integration abgelegte Sicherungen (neueste zuerst), null = noch nicht geladen
    this.bkMax = 10;
    this.bkMaxAuto = 5;
    this.scope = "away"; // Modus, dessen Werte gerade angezeigt werden (Ansicht, nicht Teil des Entwurfs)
    this.cs = { rename: null, text: "", error: "", upload: null, playing: null }; // Eigene Töne (1.39.0): Ansicht, nie Teil des Entwurfs
    this.rt = new RoutinesUi(this); // Routinen (1.44.0): Liste im Entwurf, Editor als Fenster
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get system() {
    return this.host._system();
  }

  // Werte je Modus; fehlt etwas im Server-Stand, gilt die Grundeinstellung
  base(s = this.system) {
    const ms = s.mode_settings || {};
    const per = {};
    for (const m of ALL_MODES) per[m] = { ...DEFAULTS, ...(ms[m] || {}) };
    const active = (s.modes || ["home", "away"]).filter((m) => ALL_MODES.includes(m));
    // Schalter "Einstellungen pro Modus": gespeicherter Wert; ohne Wert an, wenn sich die Werte der Modi unterscheiden (Anlagen vor 0.34.0)
    const differ = active.some((m) => Object.keys(DEFAULTS).some((k) => per[m][k] !== per[active[0]][k]));
    return {
      entry: s.entry_id,
      perMode: typeof s.per_mode_settings === "boolean" ? s.per_mode_settings : differ,
      per,
      modes: Object.fromEntries(ALL_MODES.map((m) => [m, (s.modes || ["home", "away"]).includes(m)])),
      routines: normRoutines(s.routines),
      always: s.always_enabled !== false, // "Immer aktiv" als Ganzes (Standard an)
      monitor: s.monitor_enabled === true, // "Überwachung" als Ganzes (Standard aus)
      ackCode: Boolean(s.code_ack_required) && Boolean(s.has_code), // Quittieren verlangt den Code (nur mit einem Code)
    };
  }

  ensureDraft() {
    const s = this.system;
    if (!s) return null;
    if (!this.draft || this.draft.entry !== s.entry_id) this.draft = this.base(s);
    return this.draft;
  }

  reset() {
    this.draft = null;
    this.saveState = null;
  }

  // Reiter der Modi mit ungespeicherten Änderungen (für den Punkt am Reiter)
  dirtyTabs() {
    const s = this.system;
    if (!s || !this.draft || this.draft.entry !== s.entry_id) return [];
    const a = this.base(s);
    return ALL_MODES.filter((m) => Object.keys(a.per[m]).some((k) => a.per[m][k] !== this.draft.per[m][k])).map((m) => ["data-scope", m]);
  }

  dirtyCount() {
    const s = this.system;
    if (!s || !this.draft || this.draft.entry !== s.entry_id) return 0;
    const a = this.base(s);
    const d = this.draft;
    let n = 0;
    if (a.perMode !== d.perMode) n += 1; // der Schalter zählt als eigene Änderung
    // Je Modus mit Änderungen zählt einmal ("Abwesend: 2 Werte" ist eine Änderung am Modus)
    for (const scope of ALL_MODES) if (Object.keys(a.per[scope]).some((k) => a.per[scope][k] !== d.per[scope][k])) n += 1;
    for (const m of ALL_MODES) if (a.modes[m] !== d.modes[m]) n += 1;
    if (a.always !== d.always) n += 1;
    if (a.monitor !== d.monitor) n += 1;
    if (a.ackCode !== d.ackCode) n += 1;
    if (canon(normRoutines(a.routines)) !== canon(normRoutines(d.routines))) n += 1;
    return n;
  }

  // Zahlen lokal prüfen; ungültige Felder werden markiert und nichts wird gesendet (LEARNINGS: kein Speicherfehler)
  invalid() {
    const d = this.draft;
    const bad = [];
    const check = (key, v, [min, max] = [0, MAX]) => (!Number.isInteger(v) || v < min || v > max) && bad.push(key);
    for (const scope of ALL_MODES.filter((m) => d.modes[m])) {
      const v = d.per[scope];
      check(`${scope}.exit_delay`, v.exit_delay);
      check(`${scope}.entry_delay`, v.entry_delay);
      check(`${scope}.confirm_window`, v.confirm_window, WINDOW);
    }
    if (!ALL_MODES.some((m) => d.modes[m])) bad.push("modes");
    return bad;
  }

  html() {
    return `<div class="ag-sys-form"></div><div class="ag-foot"></div>`;
  }

  render() {
    const h = this.host;
    const form = h._view?.querySelector(".ag-sys-form");
    const d = this.ensureDraft();
    if (!form || !d) return;
    const modes = ALL_MODES.filter((m) => d.modes[m]);
    // Ohne Schalter gilt ein Satz Werte für alle Modi (angezeigt wird der des ersten Modus); mit Schalter wählt der Reiter den Modus
    if (!d.perMode) this.scope = modes[0] || "away";
    else if (!modes.includes(this.scope)) this.scope = modes.includes("away") ? "away" : modes[0] || "away";
    const scope = this.scope;
    const v = d.per[scope];
    const bad = new Set(this.invalid());
    const num = (field, value, min = 0, max = MAX, unit = "seconds") => `<span class="ag-num ${bad.has(`${scope}.${field}`) ? "bad" : ""}"><input type="number" min="${min}" max="${max}" step="1" inputmode="numeric" data-sys="num" data-field="${field}" value="${esc(value)}" aria-label="${esc(field)}"><span class="ag-t2">${esc(this._t(unit))}</span></span>`;
    // Reiter der Modi nur mit eingeschaltetem Schalter
    const scopeSeg = d.perMode ? h._segHtml("sys-scope", modes.map((m) => [m, this._t(MODE_KEY[m]), MODE_ICON[m]]), scope, "data-scope", "small") : "";
    const switchRow = `<div class="ag-pmbar"><div class="ag-pmsw"><button class="ag-toggle ${d.perMode ? "on" : ""}" data-sys="permode" role="switch" aria-checked="${d.perMode}" aria-label="${esc(this._t("sysPerMode"))}"></button>
      <div class="ag-settx"><b>${esc(this._t("sysPerMode"))}</b><small>${esc(this._t(d.perMode ? "sysPerModeOn" : "sysPerModeHint"))}</small></div></div>${scopeSeg}</div>`;
    const card = (rows) => `<div class="ag-card ag-setlist">${rows}</div>`;
    // Je Modus ein Schalter (1.17.12, wie die übrigen Einstellungen: Schalter links, Symbol, Titel und Beschreibung), dazu "Immer aktiv"
    const modeRow = (attr, on, icon, title, hint) => `<div class="ag-orow ag-moderow"><span class="ag-oav ${on ? "on" : ""}">${ic(icon, 20)}</span><div class="ag-otx"><b>${esc(title)}</b><small>${esc(hint)}</small></div>
        <button class="ag-toggle ${on ? "on" : ""}" ${attr} role="switch" aria-checked="${on}" aria-label="${esc(title)}"></button></div>`;
    const modesRow = ALL_MODES.map((m) => modeRow(`data-sys="mode" data-mode="${m}"`, d.modes[m], MODE_ICON[m], this._t(MODE_KEY[m]), this._t(MODE_HINT[m]))).join("")
      + modeRow('data-sys="always"', d.always, "flash", this._t("wfAlways"), this._t("sysModeAlwaysHint"))
      + modeRow('data-sys="monitor"', d.monitor, "eye", this._t("wfMonitor"), this._t("sysModeMonitorHint"))
      + (d.always && !bad.has("modes") ? "" : `<div class="ag-modenote">${d.always ? "" : `<small class="ag-warntext">${ic("alert", 14)} ${esc(this._t("sysAlwaysOff"))}</small>`}
          ${bad.has("modes") ? `<small class="ag-err">${esc(this._t("sysModesNone"))}</small>` : ""}</div>`);
    const row = (title, hint, control) => `<div class="ag-setrow"><div class="ag-settx"><b>${esc(this._t(title))}</b>${hint ? `<small>${esc(this._t(hint))}</small>` : ""}</div>${control}</div>`;
    const timesRows = row("sysExitDelay", "sysExitDelayHint", num("exit_delay", v.exit_delay)) + row("sysEntryDelay", "sysEntryDelayHint", num("entry_delay", v.entry_delay));
    const behaviourRows = row("sysConfirm", "sysConfirmHint", num("confirm_window", v.confirm_window, WINDOW[0], WINDOW[1]));
    const scopeLine = d.perMode ? `<div class="ag-pmscope">${ic(MODE_ICON[scope], 18)}${esc(this._t("pmScope", { mode: this._t(MODE_KEY[scope]) }))}</div>` : "";
    const perMode = chapter(this._t("chapPerMode"), `<div class="ag-pmgroup ${d.perMode ? "on" : ""}">${switchRow}${scopeLine}
        <div class="ag-subh">${esc(this._t("chapTimes"))}</div>${card(timesRows)}
        <div class="ag-subh">${esc(this._t("chapBehaviour"))}</div>${card(behaviourRows)}</div>`);
    const html = chapter(this._t("sysModes"), card(modesRow), this._t("sysModesHint")) + perMode
      + this.rt.html(modes) + this._codesHtml(d) + this._customSoundsHtml() + this._backupHtml() + this._deleteHtml();
    // Beim Tippen nie neu aufbauen (Cursor bliebe nicht stehen), nur bei Schaltern und Auswahl
    h._setHtml(form, html);
    h._placePills();
    this.renderFoot();
  }

  // ----- Codes pro Person (sofort gespeichert, nicht Teil des Entwurfs: ein Code soll nie im Panel liegen bleiben) -----

  _codesHtml(d) {
    const s = this.system;
    const users = this.host._data?.users || [];
    const userName = (id) => users.find((u) => u.id === id)?.name;
    const rows = (s.codes || []).map((c) => `<div class="ag-coderow"><span class="ag-oav">${ic("hand", 20)}</span><span class="ag-grow"><b>${esc(c.name)}</b><small class="ag-t2">${esc(userName(c.user_id) || this._t("codeNoUser"))}</small></span>
        <button class="ag-iconbtn" data-sys="code-del" data-id="${esc(c.id)}" aria-label="${esc(`${this._t("remove")}: ${c.name}`)}">${ic("trash", 18)}</button></div>`).join("");
    return chapter(this._t("sysCodes"), `<div class="ag-card ag-setlist ag-codes">
      <div class="ag-setrow"><div class="ag-settx"><small>${esc(this._t("sysCodesHint"))}</small></div>
        <button class="ag-btn" data-sys="code-add">${ic("plus", 18)}${esc(this._t("codeAdd"))}</button></div>
      ${rows}
      <div class="ag-coderow"><span class="ag-oav">${ic("lockClosed", 20)}</span><span class="ag-grow"><b>${esc(this._t("sysCodeMain"))}</b><small class="ag-t2">${esc(this._t(s.main_code ? "sysCodeMainSet" : "sysCodeMainNone"))}</small></span>
        <button class="ag-btn" data-sys="code">${ic("cog", 18)}${esc(this._t("sysCodeOpen"))}</button></div>
      ${this._ackRow(d, Boolean(s.has_code))}</div>`);
  }

  // Quittieren verlangt den Code (1.34.0): gilt für den Dienst, den die Dashboard-Karten nutzen; das Panel selbst ist nur für
  // Administratoren und fragt nie nach einem Code zum Quittieren. Ohne Code gesperrt.
  _ackRow(d, hasCode) {
    const on = Boolean(d?.ackCode) && hasCode;
    return `<div class="ag-setrow"><div class="ag-settx"><b>${esc(this._t("sysAckCode"))}</b><small>${esc(this._t(hasCode ? "sysAckCodeHint" : "sysAckCodeNone"))}</small></div>
      <button class="ag-toggle ${on ? "on" : ""}" data-sys="ackcode" role="switch" aria-checked="${on}" aria-label="${esc(this._t("sysAckCode"))}" ${hasCode ? "" : "disabled"}></button></div>`;
  }

  // Eigene Töne (1.39.0): gelten für alle Anlagen und alle Arten von Tönen; sofort gespeichert, nicht Teil des Entwurfs. Hochgeladen wird auch direkt im
  // Editor eines Schritts; hier werden sie angehört, umbenannt und gelöscht.
  _customSoundsHtml() {
    const t = (k, v) => this._t(k, v);
    const list = customList(this.host);
    const rows = list.map((s) => {
      if (this.cs.rename === s.id) {
        return `<div class="ag-setrow ag-csrow"><div class="ag-settx"><input class="ag-input" type="text" maxlength="40" value="${esc(this.cs.text)}" data-sys="cs-name-edit" aria-label="${esc(t("upName"))}">
          <small class="ag-dlg-err ag-up-err" aria-live="polite">${esc(this.cs.error)}</small></div>
          <div class="ag-btnrow"><button class="ag-btn primary" data-sys="cs-rename-ok">${esc(t("save"))}</button><button class="ag-btn" data-sys="cs-rename-cancel">${esc(t("cancel"))}</button></div></div>`;
      }
      const u = usage(this.host, s.id);
      const playing = this.cs.playing === s.url;
      return `<div class="ag-setrow ag-csrow" data-sound="${esc(s.id)}">${soundBadge(s.id, playing)}<div class="ag-settx"><b>${esc(s.name)}</b><small>${esc(soundInfo(s))} · ${esc(t(u.steps > 1 ? "csUsedMany" : u.steps ? "csUsed" : "csUnused", { n: u.steps }))}</small></div>
        <div class="ag-btnrow"><button class="ag-iconbtn ${playing ? "on" : ""}" data-sys="${playing ? "cs-stop" : "cs-play"}" data-url="${esc(s.url)}" aria-label="${esc(t(playing ? "pvStop" : "pvPlay"))}" title="${esc(t(playing ? "pvStop" : "pvPlay"))}">${ic(playing ? "stop" : "play", 18)}</button>
          <button class="ag-iconbtn" data-sys="cs-rename" data-id="${esc(s.id)}" aria-label="${esc(t("csRename"))}" title="${esc(t("csRename"))}">${ic("pencil", 18)}</button>
          <button class="ag-iconbtn" data-sys="cs-delete" data-id="${esc(s.id)}" aria-label="${esc(t("csDelete"))}" title="${esc(t("csDelete"))}">${ic("trash", 18)}</button></div></div>`;
    }).join("");
    const body = this.cs.upload
      ? `<div class="ag-setrow ag-up-row">${uploadHtml(t, this.host, this.cs.upload, (name) => `data-sys="${name}"`)}</div>`
      : `<div class="ag-setrow"><div class="ag-settx"><small>${esc(t("csHint"))}</small></div><div class="ag-btnrow"><button class="ag-btn" data-sys="cs-upload-open" ${list.length >= (this.host._data?.custom_sound_limits?.max || 20) ? "disabled" : ""}>${ic("plus", 18)}${esc(t("csUpload"))}</button></div></div>`;
    return chapter(t("csTitle"), `<div class="ag-card ag-setlist ag-codes" data-cs="manage">${rows || `<div class="ag-setrow"><div class="ag-settx"><small>${esc(t("csEmpty"))}</small></div></div>`}${body}</div>`);
  }

  _csStopAudio() {
    this._csAudio?.pause();
    this._csAudio = null;
    this.cs.playing = null;
  }

  async _csDelete(id) {
    const h = this.host;
    const sound = customList(h).find((s) => s.id === id);
    if (!sound) return;
    const u = usage(h, id);
    const text = this._t(u.steps > 1 ? "csDeleteUsedMany" : u.steps ? "csDeleteUsed" : "csDeleteText", { name: sound.name, n: u.steps, systems: u.systems.join(", ") });
    if (!(await h._confirm(this._t("csDeleteTitle", { name: sound.name }), text, this._t("csDelete")))) return;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/delete_sound", sound_id: id });
      h._data.custom_sounds = res.sounds;
      if (this.cs.playing === sound.url) this._csStopAudio();
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
    }
    this.render();
  }

  async _csRenameOk() {
    const h = this.host;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/rename_sound", sound_id: this.cs.rename, name: this.cs.text });
      h._data.custom_sounds = res.sounds;
      this.cs.rename = null;
      this.cs.error = "";
    } catch (err) {
      this.cs.error = uploadError((k, v) => this._t(k, v), err?.code || "upload_failed", err?.status);
    }
    this.render();
  }

  async _csUpload() {
    const ui = this.cs.upload;
    if (!ui || ui.busy) return;
    ui.busy = true;
    ui.error = "";
    this.host._view?.querySelector('[data-sys="cs-go"]')?.setAttribute("disabled", "");
    try {
      const sound = await uploadSound(this.host, this.host._root, ui, (k, v) => this._t(k, v));
      this.cs.upload = null;
      this.host._toast(this._t("upDone", { name: sound.name }));
    } catch (err) {
      ui.busy = false;
      ui.error = uploadError((k, v) => this._t(k, v), err.code || "upload_failed", err.status);
    }
    this.render();
  }

  _backupHtml() {
    if (this.backups === null && !this._bkLoading) this.loadBackups();
    const auto = this.host._data?.auto_backup || { enabled: true, every: "weekly", keep: 5 };
    const every = ["daily", "weekly", "monthly"].map((k) => `<option value="${k}" ${auto.every === k ? "selected" : ""}>${esc(this._t(`bkEvery_${k}`))}</option>`).join("");
    const autoRow = `<div class="ag-setrow ag-bkauto"><button class="ag-toggle ${auto.enabled ? "on" : ""}" data-sys="ab-on" role="switch" aria-checked="${auto.enabled}" aria-label="${esc(this._t("bkAuto"))}"></button>
      <span class="ag-oav ${auto.enabled ? "on" : ""}">${ic("restore", 20)}</span><div class="ag-settx"><b>${esc(this._t("bkAuto"))}</b><small>${esc(this._t("bkAutoHint", { max: this.bkMaxAuto }))}</small></div>
      <span class="ag-num ag-abkeep" title="${esc(this._t("bkAutoKeep"))}"><input type="number" min="1" max="50" step="1" inputmode="numeric" data-sys="ab-keep" value="${esc(auto.keep ?? 5)}" aria-label="${esc(this._t("bkAutoKeep"))}" ${auto.enabled ? "" : "disabled"}><span class="ag-t2">${esc(this._t("bkAutoKeepUnit"))}</span></span>
      <select class="ag-input" data-sys="ab-every" aria-label="${esc(this._t("bkAutoEvery"))}" ${auto.enabled ? "" : "disabled"}>${every}</select></div>`;
    return chapter(this._t("bkTitle"), `<div class="ag-card ag-setlist ag-codes">${autoRow}<div class="ag-setrow"><div class="ag-settx"><small>${esc(this._t("bkHint"))}</small></div>
      <div class="ag-btnrow"><button class="ag-btn primary" data-sys="bk-create">${ic("check", 18)}${esc(this._t("bkSave"))}</button>
        <button class="ag-btn" data-sys="export">${ic("arrowDown", 18)}${esc(this._t("bkExport"))}</button>
        <button class="ag-btn" data-sys="import">${ic("arrowUp", 18)}${esc(this._t("bkImport"))}</button><input type="file" accept="application/json,.json" data-sys="import-file" hidden></div></div></div>
      <div class="ag-bkbody">${this._bkBody()}</div>`);
  }

  // Anlage löschen (1.32.0): ganz unten, roter Textknopf; die Warnung kommt im Dialog. Nur bei deaktivierter Anlage (der Server prüft es auch).
  _deleteHtml() {
    const sys = this.host._system();
    if (!sys) return "";
    const disarmed = this.host._state(sys.entity_id)?.state === "disarmed";
    return chapter(this._t("delTitle"), `<div class="ag-card ag-setlist ag-codes"><div class="ag-setrow"><div class="ag-settx"><small>${esc(this._t("delHint", { name: sys.title }))}</small>
      ${disarmed ? "" : `<small class="ag-delnote">${ic("alert", 14)} ${esc(this._t("delNotDisarmed"))}</small>`}</div>
      <div class="ag-btnrow"><button class="ag-btn ag-btn-danger-text" data-sys="delete" ${disarmed ? "" : "disabled"}>${ic("trash", 18)}${esc(this._t("delButton", { name: sys.title }))}</button></div></div></div>`, "", "ag-chap-danger");
  }

  // Liste der Sicherungen als Tabelle: Datum, Anlagen, Herunterladen, Wiederherstellen, Löschen
  _bkBody() {
    if (this.backups === null) return "";
    const lang = this.host._lang || "en";
    const date = (iso) => (iso ? new Date(iso).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" }) : "–");
    if (!this.backups.length) return `<div class="ag-t2 ag-small" style="margin:10px 4px 0">${esc(this._t("bkEmpty"))}</div>`;
    const btn = (act, icon, key, id) => `<button class="ag-iconbtn" data-sys="${act}" data-id="${esc(id)}" title="${esc(this._t(key))}" aria-label="${esc(this._t(key))}">${ic(icon, 18)}</button>`;
    const rows = this.backups.map((b) => `<tr data-bk="${esc(b.id)}"><td><b class="ag-bkname">${esc(b.name || date(b.created))}</b>${b.auto ? `<span class="ag-tag none ag-bkauto-tag">${esc(this._t("bkAutoTag"))}</span>` : ""}${b.name ? `<small class="ag-t2 ag-bkdate">${esc(date(b.created))}</small>` : ""}</td><td class="ag-t2">${esc((b.systems || []).join(", ") || "–")}</td>
        <td class="ag-acts"><div class="ag-actrow">${btn("bk-download", "arrowLine", "bkDownload", b.id)}${btn("bk-restore", "restore", "bkRestoreOne", b.id)}${btn("bk-delete", "trash", "bkDelete", b.id)}</div></td></tr>`).join("");
    return `<div class="ag-t2 ag-small" style="margin:10px 4px 6px">${esc(this._t("bkCount", { count: this.backups.filter((b) => !b.auto).length, max: this.bkMax }))}${this.backups.some((b) => b.auto) ? ` · ${esc(this._t("bkCountAuto", { count: this.backups.filter((b) => b.auto).length, max: this.bkMaxAuto }))}` : ""}</div>
      <div class="ag-card ag-table-wrap ag-stickwrap"><table class="ag-table ag-bktable"><tr><th>${esc(this._t("bkColName"))}</th><th>${esc(this._t("bkColSystems"))}</th><th></th></tr>${rows}</table></div>`;
  }

  renderBackups() {
    const el = this.host._view?.querySelector(".ag-bkbody");
    if (el) this.host._setHtml(el, this._bkBody());
    this.host._stickySync?.();
  }

  async loadBackups() {
    this._bkLoading = true;
    try {
      const res = await this.host._hass.callWS({ type: "alarmageddon/backups" });
      this.backups = res.backups || [];
      this.bkMax = res.max || 10;
      this.bkMaxAuto = res.max_auto || 5;
    } catch {
      this.backups = [];
    } finally {
      this._bkLoading = false;
    }
    this.renderBackups();
  }

  // "Sichern" fragt zuerst nach einem Namen (leer erlaubt: dann zeigt die Liste das Datum)
  openCreateBackup() {
    const dlg = this._codeDlg();
    dlg.innerHTML = `<form class="ag-dlg-body" data-form="backup"><h3>${esc(this._t("bkNameTitle"))}</h3>
      <label class="ag-t2 ag-small" for="ag-bk-name">${esc(this._t("bkNameLabel"))}</label>
      <input class="ag-input" id="ag-bk-name" type="text" maxlength="60" placeholder="${esc(this._t("bkNamePlaceholder"))}" style="width:100%;box-sizing:border-box" autocomplete="off">
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button type="button" class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn primary" type="submit">${esc(this._t("bkSave"))}</button></div></form>`;
    dlg.showModal();
    dlg.querySelector("input").focus();
  }

  async createBackup(name = "") {
    try {
      const res = await this.host._hass.callWS({ type: "alarmageddon/backup_create", name: String(name || "").trim() });
      this._codeDlg().close();
      this.backups = res.backups || [];
      this.bkMax = res.max || 10;
      this.renderBackups();
      this.host._toast(this._t("bkSaved"));
    } catch (err) {
      this.host._toast(this._t("errGeneric", { message: errText(err) }));
    }
  }

  _download(data, name) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = this.host.ownerDocument.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async downloadBackup(id) {
    try {
      const data = await this.host._hass.callWS({ type: "alarmageddon/backup_get", backup_id: id });
      this._download(data, `alarmageddon-${String(data.created || new Date().toISOString()).slice(0, 10)}.json`);
    } catch (err) {
      this.host._toast(this._t("errGeneric", { message: errText(err) }));
    }
  }

  async restoreBackup(id) {
    try {
      await this.askRestore(await this.host._hass.callWS({ type: "alarmageddon/backup_get", backup_id: id }));
    } catch (err) {
      this.host._toast(this._backupErr(err));
    }
  }

  openDeleteBackup(id) {
    const b = (this.backups || []).find((x) => x.id === id);
    if (!b) return;
    const lang = this.host._lang || "en";
    const dlg = this._codeDlg();
    dlg.innerHTML = `<div class="ag-dlg-body"><h3>${esc(this._t("bkDeleteTitle"))}</h3><div class="ag-t2">${esc(b.created ? new Date(b.created).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" }) : "")}</div>
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn primary" data-sys="bk-delete-go" data-id="${esc(id)}">${esc(this._t("bkDelete"))}</button></div></div>`;
    dlg.showModal();
  }

  async deleteBackup(id) {
    try {
      const res = await this.host._hass.callWS({ type: "alarmageddon/backup_delete", backup_id: id });
      this.backups = res.backups || [];
      this._codeDlg().close();
      this.renderBackups();
    } catch (err) {
      this._codeError(this._t("errGeneric", { message: errText(err) }));
    }
  }

  async exportBackup() {
    try {
      const data = await this.host._hass.callWS({ type: "alarmageddon/export" });
      this._download(data, `alarmageddon-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (err) {
      this.host._toast(this._t("errGeneric", { message: errText(err) }));
    }
  }

  _backupErr(err) {
    const key = { not_a_backup: "errNotABackup", newer_version: "errNewerVersion", invalid_backup: "errInvalidBackup" }[err?.code];
    return key ? this._t(key) : this._t("errGeneric", { message: errText(err) });
  }

  async importFile(input) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return this.host._toast(this._t("errNotABackup"));
    }
    try {
      await this.askRestore(data);
    } catch (err) {
      this.host._toast(this._backupErr(err));
    }
  }

  // Wiederherstellen (1.33.0): je Anlage der Sicherung wählt man das Ziel, der Name spielt keine Rolle. Vorgeschlagen: gleicher Name
  // (ersetzt diese Anlage), sonst eine neue Anlage mit dem Namen aus der Sicherung. Der Server prüft alles noch einmal.
  async askRestore(data) {
    const plan = await this.host._hass.callWS({ type: "alarmageddon/import", data, dry_run: true });
    this._pendingBackup = data;
    this._plan = plan;
    this._choices = plan.items.map((i) => ({ index: i.index, title: i.title, target: i.default || "new", name: i.title, error: "" }));
    this._restoreSettings = true;
    const dlg = this._codeDlg();
    dlg.innerHTML = `<div class="ag-dlg-body"><h3>${esc(this._t("bkConfirmTitle"))}</h3>
      <div class="ag-t2">${esc(this._t("bkMapIntro"))}</div>
      <div class="ag-rmap">${this._restoreRows()}</div>
      ${plan.settings ? `<label class="ag-orow ag-rename-ids"><div class="ag-otx"><b>${esc(this._t("bkSettingsSwitch"))}</b><small>${esc(this._t("bkSettingsHint"))}</small></div>
        <button type="button" class="ag-toggle on" data-sys="rs" role="switch" aria-checked="true" aria-label="${esc(this._t("bkSettingsSwitch"))}"></button></label>` : ""}
      <div class="ag-t2 ag-small">${esc(this._t("bkCodesStay"))}</div>
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn primary" data-sys="import-go" disabled>${esc(this._t("bkRestore"))}</button></div></div>`;
    dlg.showModal();
    this._checkRestore();
  }

  _restoreRows() {
    const targets = this._plan?.targets || [];
    return this._choices.map((c, i) => {
      const options = `<option value="skip" ${c.target === "skip" ? "selected" : ""}>${esc(this._t("bkTargetSkip"))}</option>
        <option value="new" ${c.target === "new" ? "selected" : ""}>${esc(this._t("bkTargetNew"))}</option>
        ${targets.length ? `<optgroup label="${esc(this._t("bkTargetGroup"))}">${targets.map((t) => `<option value="${esc(t.entry_id)}" ${c.target === t.entry_id ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</optgroup>` : ""}`;
      const target = targets.find((t) => t.entry_id === c.target);
      const hint = c.target === "skip" ? this._t("bkHintSkip") : c.target === "new" ? this._t("bkHintNew") : this._t("bkHintReplace", { name: target?.title || "" });
      return `<div class="ag-rrow" data-ri="${i}"><div class="ag-rfrom"><b>${esc(c.title)}</b><span class="ag-t2">${esc(this._t("bkFromBackup"))}</span></div>
        <select class="ag-input" data-sys="rt" data-ri="${i}" aria-label="${esc(this._t("bkTargetLabel", { name: c.title }))}">${options}</select>
        ${c.target === "new" ? `<input class="ag-input" data-sys="rn" data-ri="${i}" maxlength="60" value="${esc(c.name)}" placeholder="${esc(this._t("bkNewName"))}" aria-label="${esc(this._t("bkNewName"))}" autocomplete="off">` : ""}
        <div class="ag-t2 ag-small ag-rhint ${c.error ? "ag-err" : ""}">${esc(c.error || hint)}</div></div>`;
    }).join("");
  }

  // Wahl prüfen: gleiches Ziel zweimal, gleiche neue Namen, Namen leer oder vergeben (Antwort des Servers); erst dann ist "Wiederherstellen" frei
  _checkRestore() {
    const dlg = this._codeDlg();
    const go = dlg.querySelector('[data-sys="import-go"]');
    if (!go || !this._choices) return;
    const seen = new Set();
    const names = new Set();
    for (const c of this._choices) {
      c.error = "";
      if (c.target === "skip") continue;
      if (c.target === "new") {
        const key = c.name.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
        if (names.has(key) && key) c.error = this._t("bkErrNewSame");
        names.add(key);
        if (c.nameError) c.error = c.error || this._t(c.nameError === "name_taken" ? "renameTaken" : "renameEmpty");
      } else {
        if (seen.has(c.target)) c.error = this._t("bkErrSameTarget");
        seen.add(c.target);
      }
    }
    const active = this._choices.some((c) => c.target !== "skip") || (this._plan?.settings && this._restoreSettings);
    dlg.querySelectorAll(".ag-rrow").forEach((row, i) => {
      const hint = row.querySelector(".ag-rhint");
      const c = this._choices[i];
      const base = c.target === "skip" ? this._t("bkHintSkip") : c.target === "new" ? this._t("bkHintNew") : this._t("bkHintReplace", { name: (this._plan.targets.find((t) => t.entry_id === c.target) || {}).title || "" });
      hint.textContent = c.error || base;
      hint.classList.toggle("ag-err", !!c.error);
    });
    const pendingName = this._choices.some((c) => c.target === "new" && c.nameChecking);
    go.disabled = !active || this._choices.some((c) => c.error) || pendingName || this._choices.some((c) => c.target === "new" && !c.name.trim());
  }

  // Der Name einer neuen Anlage: der Server sagt, ob er frei ist (überholte Antworten verwerfen)
  _checkNewName(i) {
    const c = this._choices[i];
    c.nameError = "";
    c.nameChecking = true;
    const seq = (c.seq = (c.seq || 0) + 1);
    clearTimeout(c.timer);
    this._checkRestore();
    c.timer = setTimeout(async () => {
      let res = null;
      try {
        res = await this.host._hass.callWS({ type: "alarmageddon/preview_system", name: c.name });
      } catch {
        res = null;
      }
      if (seq !== c.seq || !this._choices) return;
      c.nameChecking = false;
      c.nameError = res?.error || "";
      this._checkRestore();
    }, 200);
  }

  async importGo() {
    const mapping = this._choices.map((c) => ({ index: c.index, target: c.target, ...(c.target === "new" ? { name: c.name } : {}) }));
    try {
      await this.host._hass.callWS({ type: "alarmageddon/import", data: this._pendingBackup, mapping, restore_settings: !!this._restoreSettings });
      this._pendingBackup = null;
      this._choices = null;
      this._codeDlg().close();
      this.host._resetConfig?.();
      this.host._toast(this._t("bkDone"));
      this.host._fetch();
    } catch (err) {
      this._codeError(err?.code === "name_taken" ? this._t("renameTaken") : err?.code === "name_required" ? this._t("renameEmpty") : err?.code === "invalid_mapping" ? this._t("bkErrMapping") : this._backupErr(err));
    }
  }

  _codeDlg() {
    return this.host._root.getElementById("ag-codes");
  }

  openAddCode() {
    const users = this.host._data?.users || [];
    const taken = new Set((this.system.codes || []).map((c) => c.user_id).filter(Boolean));
    const dlg = this._codeDlg();
    dlg.innerHTML = `<div class="ag-dlg-body"><h3>${esc(this._t("codeAdd"))}</h3>
      <label class="ag-fld"><span class="ag-label">${esc(this._t("codeUser"))}</span><select class="ag-input" data-sys="cf" data-key="user_id" aria-label="${esc(this._t("codeUser"))}">
        <option value="">${esc(this._t("codeUserNone"))}</option>${users.filter((u) => !taken.has(u.id)).map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("")}</select>
        <small class="ag-t2">${esc(this._t("codeUserHint"))}</small></label>
      <label class="ag-fld"><span class="ag-label">${esc(this._t("codeName"))}</span><input class="ag-input" data-sys="cf" data-key="name" maxlength="40" autocomplete="off" aria-label="${esc(this._t("codeName"))}"></label>
      <label class="ag-fld"><span class="ag-label">${esc(this._t("codeValue"))}</span><input class="ag-input" type="password" inputmode="numeric" autocomplete="new-password" data-sys="cf" data-key="code" maxlength="8" aria-label="${esc(this._t("codeValue"))}"></label>
      <label class="ag-fld"><span class="ag-label">${esc(this._t("codeRepeat"))}</span><input class="ag-input" type="password" inputmode="numeric" autocomplete="new-password" data-sys="cf" data-key="code2" maxlength="8" aria-label="${esc(this._t("codeRepeat"))}"></label>
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn primary" data-sys="code-save">${ic("check", 18)}${esc(this._t("save"))}</button></div></div>`;
    dlg.showModal();
    dlg.querySelector('[data-key="name"]').focus();
  }

  openRemoveCode(id) {
    const c = (this.system.codes || []).find((x) => x.id === id);
    if (!c) return;
    const dlg = this._codeDlg();
    dlg.innerHTML = `<div class="ag-dlg-body"><h3>${esc(this._t("codeRemoveTitle"))}</h3><div class="ag-t2">${esc(this._t("codeRemoveText", { name: c.name }))}</div>
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn danger" data-sys="code-remove" data-id="${esc(id)}">${ic("trash", 18)}${esc(this._t("remove"))}</button></div></div>`;
    dlg.showModal();
  }

  _codeError(text) {
    const box = this._codeDlg().querySelector(".ag-dlg-err");
    if (box) box.textContent = text;
  }

  async saveCode() {
    const dlg = this._codeDlg();
    const val = (k) => dlg.querySelector(`[data-key="${k}"]`).value;
    const name = val("name").trim();
    if (!name) return this._codeError(this._t("codeNameMissing"));
    if (!/^\d{4,8}$/.test(val("code"))) return this._codeError(this._t("errInvalidCodeFormat"));
    if (val("code") !== val("code2")) return this._codeError(this._t("codeMismatch"));
    try {
      await this.host._hass.callWS({ type: "alarmageddon/add_code", entry_id: this.system.entry_id, name, code: val("code"), user_id: val("user_id") || null });
      dlg.close();
      this.host._toast(this._t("saved"));
      this.host._fetch();
    } catch (err) {
      this._codeError(this._codeErrText(err));
    }
  }

  async removeCode(id) {
    try {
      await this.host._hass.callWS({ type: "alarmageddon/remove_code", entry_id: this.system.entry_id, code_id: id });
      this.system.codes = (this.system.codes || []).filter((c) => c.id !== id);
      this._codeDlg().close();
      this.render();
      this.host._fetch();
    } catch (err) {
      this._codeError(this._codeErrText(err));
    }
  }

  _codeErrText(err) {
    const key = { invalid_code_format: "errInvalidCodeFormat", name_taken: "errNameTaken", code_taken: "errCodeTaken", user_taken: "errUserTaken", too_many: "errTooMany" }[err?.code];
    return key ? this._t(key) : this._t("errGeneric", { message: errText(err) });
  }

  renderFoot() {
    const h = this.host;
    h._renderDots?.(); // Punkt "ungespeichert" an den Reitern
    const foot = h._view?.querySelector(".ag-foot");
    if (!foot) return;
    const n = this.dirtyCount();
    const badKeys = this.invalid();
    const bad = badKeys.length;
    let status;
    if (this.saveState === "saved" && !n) status = `<span class="ag-saved">${ic("check", 16)} ${esc(this._t("saved"))}</span>`;
    else if (this.saveState && this.saveState !== "saved") status = `<span class="ag-err">${esc(this.saveState)}</span>`;
    else if (bad) {
      const first = badKeys[0];
      const text = first === "modes" ? this._t("sysModesNone")
        : first.endsWith(".confirm_window") ? this._t("invalidNumber", { min: 5, max: 600 }) : this._t("invalidNumber", { min: 0, max: MAX });
      status = `<span class="ag-err">${esc(text)}</span>`;
    }
    else status = `<span class="ag-t2">${esc(n === 0 ? this._t("noChanges") : n === 1 ? this._t("change") : this._t("changes", { count: n }))}</span>`;
    h._setHtml(foot, `${status}<span class="ag-grow"></span><button class="ag-btn" data-sys="cancel" ${n ? "" : "disabled"}>${esc(this._t("cancel"))}</button>
      <button class="ag-btn primary" data-sys="save" ${n && !bad && !this.saving ? "" : "disabled"}>${ic("check", 18)}${esc(this._t("save"))}</button>`);
  }

  async save() {
    const h = this.host;
    const s = this.system;
    const d = this.draft;
    if (!s || !d || this.saving || this.invalid().length) return;
    this.saving = true;
    this.renderFoot();
    try {
      const modes = ALL_MODES.filter((m) => d.modes[m]);
      // Alle Modi (auch abgeschaltete behalten ihre Werte)
      const mode_settings = Object.fromEntries(ALL_MODES.map((m) => [m, { ...d.per[m] }]));
      const saved = await h._hass.callWS({ type: "alarmageddon/save_system", entry_id: s.entry_id, mode_settings, per_mode_settings: d.perMode,
        home_enabled: d.modes.home, away_enabled: d.modes.away, night_enabled: d.modes.night, always_enabled: d.always, monitor_enabled: d.monitor, routines: d.routines,
        ...(s.has_code || s.code_ack_required ? { code_ack_required: d.ackCode && Boolean(s.has_code) } : {}) });
      Object.assign(s, { per_mode_settings: d.perMode, mode_settings: JSON.parse(JSON.stringify(mode_settings)), night_enabled: d.modes.night, always_enabled: d.always, monitor_enabled: d.monitor, modes, routines: JSON.parse(JSON.stringify(d.routines)), code_ack_required: d.ackCode && Boolean(s.has_code) });
      this.draft = null;
      this.saveState = "saved";
      this.host._markSaved(this); // Punkte "ungespeichert" verschwinden sofort
// Nur warten, wenn die Anlage wirklich neu lädt (sonst drehte die Ladeanzeige 25 Sekunden)
      if (saved?.reload !== false) h._reloadWait();
      else h._fetch();
    } catch (err) {
      const known = { no_mode: "errNoMode", mode_active: "errModeActive", invalid_routines: "rtSaveInvalid" }[err?.code];
      this.saveState = known ? this._t(known) : this._t("saveFailed", { message: errText(err) });
    } finally {
      this.saving = false;
      this.render();
    }
  }

  onClick(el) {
    // Modus der Einstellungen wählen: nur die Ansicht wechselt, der Entwurf bleibt
    if (el?.dataset.scope) {
      this.scope = el.dataset.scope;
      this.render();
      return true;
    }
    const act = el?.dataset.sys;
    if (!act) return false;
    // Automatische Sicherung: Schalter und Abstand gelten sofort (wie die Sicherung selbst), nicht als Entwurf der Seite
    if (act === "ab-on") {
      const cur = this.host._data?.auto_backup || { enabled: true, every: "weekly", keep: 5 };
      this.saveAutoBackup(!cur.enabled, cur.every, cur.keep);
      return true;
    }
    if (act === "delete") {
      this.host._openDelete();
      return true;
    }
    // Eigene Töne
    if (act.startsWith("cs-")) {
      if (act === "cs-play") {
        this._csStopAudio();
        const audio = new Audio(el.dataset.url);
        audio.addEventListener("ended", () => {
          if (this._csAudio === audio) this._csStopAudio();
          this.render();
        });
        this._csAudio = audio;
        this.cs.playing = el.dataset.url;
        audio.play().catch(() => this._csStopAudio());
        this.render();
      } else if (act === "cs-stop") {
        this._csStopAudio();
        this.render();
      } else if (act === "cs-rename") {
        const s = customList(this.host).find((x) => x.id === el.dataset.id);
        this.cs.rename = el.dataset.id;
        this.cs.text = s?.name || "";
        this.cs.error = "";
        this.render();
      } else if (act === "cs-rename-cancel") {
        this.cs.rename = null;
        this.render();
      } else if (act === "cs-rename-ok") this._csRenameOk();
      else if (act === "cs-delete") this._csDelete(el.dataset.id);
      else if (act === "cs-upload-open") {
        this.cs.upload = { name: "", error: "", busy: false };
        this.render();
      } else if (act === "cs-cancel") {
        this.cs.upload = null;
        this.render();
      } else if (act === "cs-go") this._csUpload();
      return true;
    }
    // Routinen (1.44.0): Liste und Editor
    if (act.startsWith("rt-")) return this.rt.onClick(el);
    const d = this.ensureDraft();
    if (act === "permode") {
      d.perMode = !d.perMode;
      if (!d.perMode) {
        // Aus: ein Satz Werte für alle Modi, der des ersten Modus
        const first = ALL_MODES.find((m) => d.modes[m]) || "away";
        for (const m of ALL_MODES) d.per[m] = { ...d.per[first] };
      }
      this.saveState = null;
      this.render();
    } else if (act === "ackcode") {
      d.ackCode = !d.ackCode;
      this.saveState = null;
      this.render();
    } else if (act === "always") {
      d.always = !d.always;
      this.saveState = null;
      this.render();
    } else if (act === "monitor") {
      d.monitor = !d.monitor;
      this.saveState = null;
      this.render();
    } else if (act === "mode") {
      d.modes[el.dataset.mode] = !d.modes[el.dataset.mode];
      this.saveState = null;
      this.render();
    } else if (act === "cancel") {
      this.reset();
      this.render();
    } else if (act === "save") {
      this.save();
    } else if (act === "code") {
      this.host._navigate("/config/integrations/integration/alarmageddon");
    } else if (act === "bk-create") {
      this.openCreateBackup();
    } else if (act === "bk-download") {
      this.downloadBackup(el.dataset.id);
    } else if (act === "bk-restore") {
      this.restoreBackup(el.dataset.id);
    } else if (act === "bk-delete") {
      this.openDeleteBackup(el.dataset.id);
    } else if (act === "bk-delete-go") {
      this.deleteBackup(el.dataset.id);
    } else if (act === "export") {
      this.exportBackup();
    } else if (act === "rs") {
      this._restoreSettings = !this._restoreSettings;
      el.classList.toggle("on", this._restoreSettings);
      el.setAttribute("aria-checked", String(this._restoreSettings));
      this._checkRestore();
    } else if (act === "import-go") {
      this.importGo();
    } else if (act === "import") {
      // Dateiauswahl über einen echten Knopf (Tastatur), die Wahl kommt über onInput
      this.host._view?.querySelector('[data-sys="import-file"]')?.click();
    } else if (act === "import-file") {
      return false;
    } else if (act === "code-add") {
      this.openAddCode();
    } else if (act === "code-del") {
      this.openRemoveCode(el.dataset.id);
    } else if (act === "code-close") {
      this._codeDlg().close();
    } else if (act === "code-save") {
      this.saveCode();
    } else if (act === "code-remove") {
      this.removeCode(el.dataset.id);
    } else {
      return false;
    }
    return true;
  }

  async saveAutoBackup(enabled, every, keep, quiet = false) {
    const h = this.host;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/save_auto_backup", enabled, every, ...(keep ? { keep } : {}) });
      if (h._data) h._data.auto_backup = res.auto_backup;
      this.bkMaxAuto = res.auto_backup.keep;
      if (quiet) {
        // Beim Tippen nicht neu zeichnen (das Feld behielte den Fokus nicht): nur der Hinweis zieht nach
        const small = h._view?.querySelector(".ag-bkauto .ag-settx small");
        if (small) small.textContent = this._t("bkAutoHint", { max: this.bkMaxAuto });
        h._lastHtml.delete(h._view?.querySelector(".ag-bkauto")?.closest(".ag-chap"));
        return;
      }
      h._toast(this._t("bkAutoSaved"));
    } catch (err) {
      h._toast(this._t("saveFailed", { message: errText(err) }));
    }
    this.render();
  }

  onInput(el) {
    if (el.dataset.sys === "ab-keep") {
      // Gespeichert wird erst kurz nach dem letzten Tippen und nur mit einer gültigen Zahl von 1 bis 50
      const n = el.value.trim() === "" ? NaN : Number(el.value);
      const ok = Number.isInteger(n) && n >= 1 && n <= 50;
      el.closest(".ag-num").classList.toggle("bad", !ok);
      clearTimeout(this._keepTimer);
      if (ok) this._keepTimer = setTimeout(() => this.saveAutoBackup(this.host._data?.auto_backup?.enabled !== false, this.host._data?.auto_backup?.every || "weekly", n, true), 600);
      return true;
    }
    if (el.dataset.sys === "ab-every") {
      this.saveAutoBackup(this.host._data?.auto_backup?.enabled !== false, el.value, this.host._data?.auto_backup?.keep);
      return true;
    }
    if (el.dataset.sys === "cs-name") {
      if (this.cs.upload) this.cs.upload.name = el.value;
      return true;
    }
    if (el.dataset.sys === "cs-name-edit") {
      this.cs.text = el.value;
      return true;
    }
    if (el.dataset.sys === "import-file") {
      this.importFile(el);
      return true;
    }
    if (el.dataset.sys === "rt" && this._choices) {
      const c = this._choices[Number(el.dataset.ri)];
      c.target = el.value;
      c.nameError = "";
      c.nameChecking = false;
      c.seq = (c.seq || 0) + 1;
      this._codeDlg().querySelector(".ag-rmap").innerHTML = this._restoreRows();
      if (c.target === "new") this._checkNewName(Number(el.dataset.ri));
      else this._checkRestore();
      return true;
    }
    if (el.dataset.sys === "rn" && this._choices) {
      this._choices[Number(el.dataset.ri)].name = el.value;
      this._checkNewName(Number(el.dataset.ri));
      return true;
    }
    if (el.dataset.sys === "cf") {
      // Benutzer gewählt und noch kein Name: Name des Benutzers vorschlagen
      if (el.dataset.key === "user_id" && el.value) {
        const name = this._codeDlg().querySelector('[data-key="name"]');
        if (!name.value) name.value = (this.host._data?.users || []).find((u) => u.id === el.value)?.name || "";
      }
      this._codeError("");
      return true;
    }
    if (el.dataset.sys?.startsWith("rt-")) return this.rt.onInput(el);
    if (el.dataset.sys !== "num") return false;
    const d = this.ensureDraft();
    const v = el.value === "" ? NaN : Number(el.value);
    const field = el.dataset.field;
    // Ohne Schalter gilt der Wert für alle Modi
    for (const m of d.perMode ? [this.scope] : ALL_MODES) d.per[m][field] = v;
    this.saveState = null;
    const [min, max] = field === "confirm_window" ? WINDOW : [0, MAX];
    el.closest(".ag-num")?.classList.toggle("bad", !Number.isInteger(v) || v < min || v > max);
    this.renderFoot();
    return true;
  }
}
