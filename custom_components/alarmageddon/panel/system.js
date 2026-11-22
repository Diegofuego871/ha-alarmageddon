// Konfiguration › Anlage: Modi, Verzögerungen, Verhalten bei offenen Sensoren, Zeitplan (Entwurf mit "Speichern");
// dazu Codes pro Person und Sicherung (sofort).
// Dieselben Schlüssel wie der Optionsdialog von HA (WebSocket alarmageddon/save_system). Der Code bleibt im Optionsdialog.

const V = new URL(import.meta.url).search;
const { ic, esc, MODE_KEY, MODE_ICON, errText, chapter, iconTitle, matchQuery, searchField, accentGrid, accentColor, accentPreview, ACC_PV } = await import(`./common.js${V}`);
const { customList, uploadHtml, uploadError, uploadSound, usage, soundInfo, soundBadge } = await import(`./customsounds.js${V}`);
const { RoutinesUi, normRoutines, canon } = await import(`./routines.js${V}`);

const MAX = 3600;
// Abstand des Selbsttests in Minuten (seit 1.67.0, Wunsch des Nutzers 2026-11-19: auch Minuten, etwa alle 5 bei scharfer Anlage); wie der Server
const ST_MIN = [5, 1440];
// Zahl und Einheit eines Abstands: ganze Stunden in Stunden, sonst in Minuten (wie das Intervall der HealthCheck-Dienste)
const stField = (minutes) => (minutes % 60 === 0 ? { value: minutes / 60, unit: "h" } : { value: minutes, unit: "min" });
export const stMinutes = (f) => (Number.isInteger(f?.value) ? f.value * (f.unit === "h" ? 60 : 1) : NaN);
const stOk = (f) => Number.isInteger(stMinutes(f)) && stMinutes(f) >= ST_MIN[0] && stMinutes(f) <= ST_MIN[1];
// Tönung der Zeilen der Kapitel, auch im Titel ihrer Fenster (1.66.2)
const TINT = { codes: "ag-tint ag-tint-codes on", sounds: "ag-tint ag-tint-sounds on", backup: "ag-tint ag-tint-backup on" };
const DEFAULTS = { exit_delay: 0, entry_delay: 30, confirm_window: 60 };
const WINDOW = [5, 600];
const ALL_MODES = ["home", "away", "night"];
const MODE_HINT = { home: "sysModeHomeHint", away: "sysModeAwayHint", night: "sysModeNightHint" };
// Vorlesetext der Zahlenfelder: der Titel ihrer Zeile (1.63.0, Code-Review; vorher der Schlüssel wie "exit_delay")
const NUM_LABEL = { exit_delay: "sysExitDelay", entry_delay: "sysEntryDelay", confirm_window: "sysConfirm" };
// Höchstzahl der Codes pro Person (wie MAX_CODES im Server, const.py)
const MAX_CODES = 20;

// Linien auf dem Tastenfeld (1 2 3 / 4 5 6 / 7 8 9 / 0 unter der 8): Zeilen, Spalten, Diagonalen, je in beide Richtungen
const KEYPAD_LINES = ["123", "456", "789", "147", "258", "369", "159", "357", "2580", "580"].flatMap((l) => [l, [...l].reverse().join("")]);

// Was einen Code leicht erraten lässt (1.63.0, Wunsch des Nutzers): nur für die Warnung im Fenster, Speichern bleibt möglich. "short": weniger
// als 4 Ziffern (der Server nimmt 4 bis 8 Ziffern). Ein Code aus lauter gleichen Ziffern nennt nur das. Keine Ziffernfolge: keine Warnung (das
// Format prüft "Speichern").
export function codeWeakness(code) {
  if (!/^\d+$/.test(code)) return [];
  if (code.length < 4) return ["short"];
  if (/^(\d)\1+$/.test(code)) return ["same"];
  const n = code.length;
  const digits = [...code].map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  const out = [];
  // Aufsteigend oder absteigend, auch mit der 0 nach der 9 (wie auf der Tastatur) und in Zweierschritten (2468, 9753)
  if ("01234567890".includes(code) || "09876543210".includes(code) || steps.every((x) => x === 2) || steps.every((x) => x === -2)) out.push("sequence");
  // Ein Block wiederholt (1212, 123123) oder lauter Paare (1122, 112233)
  const block = Array.from({ length: Math.floor(n / 2) - 1 }, (_, i) => i + 2).some((len) => n % len === 0 && code === code.slice(0, len).repeat(n / len));
  if (block || /^(?:(\d)\1)+$/.test(code)) out.push("pattern");
  if (/(\d)\1\1/.test(code)) out.push("run");
  if (code === [...code].reverse().join("")) out.push("mirror");
  // Ganz aus Linien des Tastenfelds (2580, 147258, 159357); eine Zahlenfolge sagt das schon
  const lines = (from) => from === n || KEYPAD_LINES.some((l) => code.startsWith(l, from) && lines(from + l.length));
  if (!out.includes("sequence") && lines(0)) out.push("keypad");
  const day = (dd) => dd >= 1 && dd <= 31;
  const month = (mm) => mm >= 1 && mm <= 12;
  const year = (yyyy) => yyyy >= 1900 && yyyy <= 2099;
  const num = (from, len) => Number(code.slice(from, from + len));
  if (n === 4 && year(num(0, 4))) out.push("year");
  // Datum wie TTMMJJ, TTMMJJJJ oder JJJJMMTT (Geburtstage)
  if ((n === 6 && day(num(0, 2)) && month(num(2, 2)))
    || (n === 8 && ((day(num(0, 2)) && month(num(2, 2)) && year(num(4, 4))) || (year(num(0, 4)) && month(num(4, 2)) && day(num(6, 2)))))) out.push("date");
  return out;
}

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

  // Ein Knopf, der etwas an den Server schickt, nimmt bis zur Antwort keinen weiteren Druck an (1.63.0, Code-Review): ein Doppelklick schickte
  // es zweimal (derselbe Code zweimal, zwei gleiche Sicherungen, ein zweiter Import). `key` benennt die Arbeit; der Knopf ist solange gesperrt.
  async _sendOnce(key, button, work) {
    this._sending ||= new Set();
    if (this._sending.has(key)) return undefined;
    this._sending.add(key);
    if (button) button.disabled = true;
    try {
      return await work();
    } finally {
      this._sending.delete(key);
      if (button?.isConnected) button.disabled = false;
    }
  }

  // Automatische Sicherung (gilt für alle Anlagen): Teil des Entwurfs der Seite, gespeichert mit "Speichern" (seit 1.55.0)
  autoOf(a) {
    const keep = Number(a?.keep);
    return { enabled: a?.enabled !== false, every: a?.every || "weekly", keep: Number.isInteger(keep) ? keep : 5 };
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
      accent: s.accent || "ha", // Akzentfarbe der Anlage (1.75.0)
      ackCode: Boolean(s.code_ack_required) && Boolean(s.has_code), // Quittieren verlangt den Code (nur mit einem Code)
      auto: this.autoOf(this.host._data?.auto_backup),
      // Abstand des Selbsttests (1.65.0, Kapitel HealthCheck; gilt für alle Anlagen, gespeichert in den Benachrichtigungen): nicht scharf und solange
      // eine Anlage scharf ist (Wunsch des Nutzers 2026-11-19: zwei Zeiten); je Zahl und Einheit, gespeichert in Minuten (seit 1.67.0)
      stOff: stField(Number.isInteger(this.host._data?.notify?.selftest_minutes) ? this.host._data.notify.selftest_minutes : 360),
      stOn: stField(Number.isInteger(this.host._data?.notify?.selftest_minutes_armed) ? this.host._data.notify.selftest_minutes_armed : 60),
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
    if (a.accent !== d.accent) n += 1;
    if (a.ackCode !== d.ackCode) n += 1;
    if (JSON.stringify(a.auto) !== JSON.stringify(d.auto)) n += 1;
    // Zählt der Abstand, nicht die Einheit (6 Stunden und 360 Minuten sind dasselbe)
    for (const k of ["stOff", "stOn"]) if (!Object.is(stMinutes(a[k]), stMinutes(d[k]))) n += 1;
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
    if (!Number.isInteger(d.auto.keep) || d.auto.keep < 1 || d.auto.keep > 50) bad.push("auto.keep");
    if (!stOk(d.stOff)) bad.push("st.off");
    if (!stOk(d.stOn)) bad.push("st.on");
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
    const num = (field, value, min = 0, max = MAX, unit = "seconds") => `<span class="ag-num ${bad.has(`${scope}.${field}`) ? "bad" : ""}"><input type="number" min="${min}" max="${max}" step="1" inputmode="numeric" data-sys="num" data-field="${field}" value="${esc(value)}" aria-label="${esc(this._t(NUM_LABEL[field]))}"><span class="ag-t2">${esc(this._t(unit))}</span></span>`;
    // Reiter der Modi nur mit eingeschaltetem Schalter
    const scopeSeg = d.perMode ? h._segHtml("sys-scope", modes.map((m) => [m, this._t(MODE_KEY[m]), MODE_ICON[m]]), scope, "data-scope", "small ag-modeseg") : "";
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
      + this.rt.html(modes) + this._codesHtml(d) + this._customSoundsHtml() + this._healthHtml(d, bad) + this._backupHtml() + this._accentHtml(d) + this._wizardHtml() + this._deleteHtml();
    // Beim Tippen nie neu aufbauen (Cursor bliebe nicht stehen), nur bei Schaltern und Auswahl
    h._setHtml(form, html);
    h._placePills();
    this.renderFoot();
    this.rt.refreshList(); // ein offenes Popup der Routinen folgt dem Entwurf
    this.refreshCsList(); // ebenso das Fenster der eigenen Töne
    this.refreshCodeList(); // und das Fenster der Codes
  }

  // ----- Codes pro Person (sofort gespeichert, nicht Teil des Entwurfs: ein Code soll nie im Panel liegen bleiben) -----

  // Seit 1.63.0 (Wunsch des Nutzers) steht auf der Seite nur die Zusammenfassung mit dem Knopf zum Fenster, dazu Hauptcode und "Quittieren
  // verlangt den Code". Die Liste, "Code hinzufügen", Bearbeiten und Entfernen stehen im Fenster (wie Routinen und eigene Töne).
  _codesHtml(d) {
    const s = this.system;
    const n = (s.codes || []).length;
    const summary = n ? this._t(n === 1 ? "codesSummaryOne" : "codesSummary", { count: n }) : this._t("codesNone");
    // Wie Routinen und eigene Töne (1.64.0, Wunsch des Nutzers): links "Code hinzufügen" (öffnet gleich das Formular), rechts "Codes anzeigen"
    // mit eigenem Symbol (Schlüssel)
    return chapter(this._t("sysCodes"), `<div class="ag-card ag-setlist ag-codes">
      <div class="ag-setrow ag-rtsum ag-codesum"><span class="ag-oav ag-tint ag-tint-codes ${n ? "on" : ""}">${ic("hand", 20)}</span><div class="ag-settx"><b>${esc(summary)}</b></div>
        <div class="ag-btnrow"><button class="ag-btn" data-sys="code-add-page" ${n >= MAX_CODES ? "disabled" : ""}>${ic("plus", 18)}${esc(this._t("codeAdd"))}</button>
          <button class="ag-btn" data-sys="code-open">${ic("key", 18)}${esc(this._t("codesShow"))}</button></div></div>
      <div class="ag-coderow"><span class="ag-oav">${ic("lockClosed", 20)}</span><span class="ag-grow"><b>${esc(this._t("sysCodeMain"))}</b><small class="ag-t2">${esc(this._t(s.main_code ? "sysCodeMainSet" : "sysCodeMainNone"))}</small></span>
        <button class="ag-btn" data-sys="code">${ic("cog", 18)}${esc(this._t("sysCodeOpen"))}</button></div>
      ${this._ackRow(d, Boolean(s.has_code))}</div>`, this._t("sysCodesHint"));
  }

  _codeListDlg() {
    return this.host._root.getElementById("ag-codelist");
  }

  // Name des verknüpften Benutzers; ist er in Home Assistant nicht mehr aktiv oder gelöscht, steht "nicht verfügbar" da (nicht "kein Benutzer")
  _codeUser(c) {
    if (!c.user_id) return "";
    return (this.host._data?.users || []).find((u) => u.id === c.user_id)?.name || this._t("codeUserGone");
  }

  // Fenster "Codes pro Person" (Handy: ganzer Bildschirm): Titel und Suchfeld im klebenden Kopf, darunter die Tabelle; leer: Karte mit Knopf
  // in der Mitte, sonst "Code hinzufügen" in der Fusszeile
  codeListHtml() {
    const t = (k, v) => this._t(k, v);
    const codes = this.system?.codes || [];
    const add = (cls) => `<button class="ag-btn ${cls}" data-sys="code-add" ${codes.length >= MAX_CODES ? "disabled" : ""}>${ic("plus", 18)}${esc(t("codeAdd"))}</button>`;
    const tools = codes.length ? `<div class="ag-tools ag-pop-tools">${searchField("data-sys", "code-search", this.codeQ || "", t("codeFilter"), t("clearSearch"))}</div>` : "";
    const body = codes.length ? `<div class="ag-codebody">${this._codeTable()}</div>` : `<div class="ag-card ag-rtempty"><span class="ag-t2">${esc(t("codesEmpty"))}</span>${add("primary")}</div>`;
    return `<div class="ag-dlg-body ag-code-pop"><div class="ag-pop-head">${iconTitle("hand", TINT.codes, t("sysCodes"))}${tools}</div>${body}
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="code-list-close">${esc(t("close"))}</button>${codes.length ? add("primary") : ""}</div></div>`;
  }

  // Tabelle der Codes: Name, Benutzer, Bearbeiten, Entfernen. Keine Spalte "Code" (seit 1.66.1, Wunsch des Nutzers 2026-11-19): gespeichert ist
  // nur ein Hash, ein Platzhalter "••••••" sagte nichts. Knöpfe in Kreisen wie bei Routinen, Tönen und HealthCheck (`.ag-wf-btns`).
  // Sortierbar nach Name und Benutzer (ohne Benutzer immer unten), Suche nach Name und Benutzer.
  _codeTable() {
    const t = (k, v) => this._t(k, v);
    const codes = this.system?.codes || [];
    const sort = this.codeSort || (this.codeSort = { key: "name", dir: "asc" });
    const shown = codes.filter((c) => matchQuery(this.codeQ || "", c.name, this._codeUser(c) || t("codeNoUser")));
    if (!shown.length) return `<div class="ag-card ag-popempty"><span class="ag-t2">${esc(t("codeNoMatch"))}</span></div>`;
    const cmp = (a, b) => String(a).localeCompare(String(b), this.host._lang || "en", { sensitivity: "base", numeric: true });
    const key = (c) => (sort.key === "user" ? this._codeUser(c) : c.name);
    const list = [...shown].sort((a, b) => {
      if (sort.key === "user" && !this._codeUser(a) !== !this._codeUser(b)) return this._codeUser(a) ? -1 : 1;
      return cmp(key(a), key(b)) * (sort.dir === "desc" ? -1 : 1) || cmp(a.name, b.name);
    });
    const btn = (act, icon, label, id) => `<button class="ag-iconbtn" data-sys="${act}" data-id="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}">${ic(icon, 18)}</button>`;
    const rows = list.map((c) => `<tr data-code="${esc(c.id)}"><td class="ag-codename"><b>${esc(c.name)}</b></td><td class="ag-t2 ag-codeuser">${esc(this._codeUser(c) || "–")}</td>
        <td class="ag-acts"><div class="ag-wf-btns ag-codebtns">${btn("code-edit", "pencil", `${t("codeEdit")}: ${c.name}`, c.id)}${btn("code-del", "trash", `${t("remove")}: ${c.name}`, c.id)}</div></td></tr>`).join("");
    const th = (k, label) => {
      const on = sort.key === k;
      return `<th aria-sort="${on ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button type="button" class="ag-sortbtn ${on ? "on" : ""}" data-sys="code-sort" data-key="${k}" title="${esc(t("sortBy", { column: label }))}">${esc(label)}<span class="ag-sortic">${on ? ic(sort.dir === "desc" ? "arrowDown" : "arrowUp", 14) : ""}</span></button></th>`;
    };
    return `<div class="ag-card ag-codewrap"><table class="ag-table ag-codetable"><tr>${th("name", t("codeColName"))}${th("user", t("codeColUser"))}<th class="ag-codeacts"></th></tr>${rows}</table></div>`;
  }

  openCodeList() {
    const dlg = this._codeListDlg();
    if (!dlg.open) this.codeQ = "";
    this.refreshCodeList(true);
    if (!dlg.open) dlg.showModal();
  }

  // Nach jeder Änderung folgt das offene Fenster. Steht die Tabelle schon da, wird nur sie neu gezeichnet: das Suchfeld behält Text und Fokus.
  refreshCodeList(force = false) {
    const dlg = this._codeListDlg();
    if (!dlg || (!dlg.open && !force)) return;
    const codes = this.system?.codes || [];
    const table = dlg.querySelector(".ag-codebody");
    if (!force && table && codes.length) {
      table.innerHTML = this._codeTable();
      const add = dlg.querySelector('[data-sys="code-add"]');
      if (add) add.disabled = codes.length >= MAX_CODES;
      return;
    }
    const top = dlg.querySelector(".ag-dlg-body")?.scrollTop || 0;
    dlg.innerHTML = this.codeListHtml();
    const again = dlg.querySelector(".ag-dlg-body");
    if (again && top) again.scrollTop = top;
  }

  // Quittieren verlangt den Code (1.34.0): gilt für den Dienst, den die Dashboard-Karten nutzen; das Panel selbst ist nur für
  // Administratoren und fragt nie nach einem Code zum Quittieren. Ohne Code gesperrt.
  _ackRow(d, hasCode) {
    const on = Boolean(d?.ackCode) && hasCode;
    return `<div class="ag-setrow"><div class="ag-settx"><b>${esc(this._t("sysAckCode"))}</b><small>${esc(this._t(hasCode ? "sysAckCodeHint" : "sysAckCodeNone"))}</small></div>
      <button class="ag-toggle ${on ? "on" : ""}" data-sys="ackcode" role="switch" aria-checked="${on}" aria-label="${esc(this._t("sysAckCode"))}" ${hasCode ? "" : "disabled"}></button></div>`;
  }

  // Eigene Töne (1.39.0, Fenster seit 1.56.0): gelten für alle Anlagen und alle Arten von Tönen; sofort gespeichert, nicht Teil des Entwurfs.
  // Hochgeladen wird auch direkt im Editor eines Schritts; hier werden sie angehört, umbenannt und gelöscht. Die Seite zeigt nur die Zusammenfassung,
  // die Liste steht im Fenster (Handy: ganzer Bildschirm), wie bei den Routinen.
  _customSoundsHtml() {
    const t = (k, v) => this._t(k, v);
    const n = customList(this.host).length;
    const summary = n ? t(n === 1 ? "csSummaryOne" : "csSummary", { count: n }) : t("csNone");
    // Hochladen direkt von der Seite (1.58.0, Wunsch des Nutzers): nicht blau; öffnet das Fenster mit dem Formular
    const full = n >= (this.host._data?.custom_sound_limits?.max || 20);
    return chapter(t("csTitle"), `<div class="ag-card ag-setlist ag-codes"><div class="ag-setrow ag-rtsum"><span class="ag-oav ag-tint ag-tint-sounds ${n ? "on" : ""}">${ic("speaker", 20)}</span>
      <div class="ag-settx"><b>${esc(summary)}</b></div><div class="ag-btnrow"><button class="ag-btn" data-sys="cs-upload-page" ${full ? "disabled" : ""}>${ic("plus", 18)}${esc(t("csUpload"))}</button>
        <button class="ag-btn" data-sys="cs-open">${ic("speaker", 18)}${esc(t("csShow"))}</button></div></div></div>`, t("csHint"));
  }

  // HealthCheck (1.65.0, Wunsch des Nutzers 2026-11-18): der Selbsttest (letzte Prüfung, "Jetzt prüfen", Befunde, Abstand) und die Lebenszeichen an
  // externe Dienste (Zusammenfassung wie Töne und Codes, Liste im Fenster, healthcheck.js). Gilt für alle Anlagen. Der Abstand ist Teil des Entwurfs
  // der Seite (wie das automatische Backup), die Lebenszeichen werden im Fenster sofort gespeichert.
  _healthHtml(d, bad) {
    const t = (k, v) => this._t(k, v);
    const st = this.host.selftest;
    const data = st.data;
    const n = st.problems().length;
    const title = !data?.last && !n ? t("stRowNone") : n === 0 ? t("stRowOk") : n === 1 ? t("stRowProblem1") : t("stRowProblems", { count: n });
    const sub = data?.last ? `${t("stRowAgo", { ago: this.host._fmtAgo(data.last) })}${data.next ? ` · ${t("stNext", { time: st._when(data.next) })}` : ""}` : t("hcStNever");
    const tone = n ? (st.problems().some((p) => st._red(p)) ? "err" : "warn") : data?.last ? "ok" : "";
    const stRow = `<div class="ag-setrow ag-rtsum ag-stsum"><span class="ag-oav ag-st-av ${tone}">${ic("stethoscope", 20)}</span><div class="ag-settx"><b>${esc(title)}</b><small>${esc(sub)}</small></div>
      <div class="ag-btnrow"><button class="ag-btn" data-st="run" ${st.busy ? "disabled" : ""}>${ic("refresh", 18)}${esc(t("stRun"))}</button>
        <button class="ag-btn" data-st="open">${ic("stethoscope", 18)}${esc(t("stShow"))}</button></div></div>`;
    // Zwei Abstände: nicht scharf und scharf (jede Anlage, die nicht deaktiviert ist). Seit 1.67.0 (Wunsch des Nutzers 2026-11-19) auf Computer und
    // Handy untereinander unter dem Text, je mit Zahl und Einheit (Minuten oder Stunden)
    const stLine = (key, which, label, icon) => {
      const f = d[which];
      return `<div class="ag-sthf"><span class="ag-sthf-l"><span class="ag-sthf-ic ${which === "stOn" ? "armed" : "disarmed"}">${ic(icon, 16)}</span>${esc(label)}</span>
      <span class="ag-num ${bad.has(key) ? "bad" : ""}"><input type="number" min="1" max="${f.unit === "h" ? 24 : 1440}" step="1" inputmode="numeric" data-sys="st-value" data-st-which="${which}" value="${esc(Number.isFinite(f.value) ? f.value : "")}" aria-label="${esc(`${t("stEveryLabel")}: ${label}`)}">
        <select class="ag-input ag-unit" data-sys="st-unit" data-st-which="${which}" aria-label="${esc(`${t("stEveryLabel")}: ${label}, ${t("hcUnit")}`)}"><option value="min" ${f.unit === "min" ? "selected" : ""}>${esc(t("hcMinutes"))}</option><option value="h" ${f.unit === "h" ? "selected" : ""}>${esc(t("hcHours"))}</option></select></span></div>`;
    };
    const hoursRow = `<div class="ag-setrow ag-sthours"><div class="ag-settx"><b>${esc(t("stEveryLabel"))}</b><small>${esc(t("stEveryHint"))}</small></div>
      <div class="ag-sthfs">${stLine("st.off", "stOff", t("ivOff"), "shieldOff")}${stLine("st.on", "stOn", t("ivOn"), "shield")}</div></div>`;
    return chapter(t("hcTitle"), `<div class="ag-card ag-setlist ag-codes ag-health">${stRow}${hoursRow}${this.host.healthcheck.summaryRow()}</div>`, t("hcHint"));
  }

  _csDlg() {
    return this.host._root.getElementById("ag-cslist");
  }

  // Inhalt des Fensters: Zeilen im Design der Seite; leer: Karte mit Knopf in der Mitte, sonst Knopf in der Fusszeile; beim Hochladen das Formular unter den Zeilen
  csListHtml() {
    const t = (k, v) => this._t(k, v);
    const list = customList(this.host);
    const rows = this._csRows();
    const full = list.length >= (this.host._data?.custom_sound_limits?.max || 20);
    const add = (cls) => `<button class="ag-btn ${cls}" data-sys="cs-upload-open" ${full ? "disabled" : ""}>${ic("plus", 18)}${esc(t("csUpload"))}</button>`;
    const up = this.cs.upload ? `<div class="ag-setrow ag-up-row">${uploadHtml(t, this.host, this.cs.upload, (name) => `data-sys="${name}"`)}</div>` : "";
    // Suchfeld über der Liste (1.60.0, wie bei den Routinen); die Zeilen stehen in einem eigenen Behälter, damit beim Tippen nur sie neu
    // gezeichnet werden (das Suchfeld behält den Fokus, ein offenes Formular zum Hochladen seine gewählte Datei)
    const tools = list.length ? `<div class="ag-tools ag-pop-tools">${searchField("data-sys", "cs-search", this.cs.q || "", t("csFilter"), t("clearSearch"))}</div>` : "";
    const body = list.length || up
      ? `<div class="ag-card ag-setlist ag-codes" data-cs="manage"><div class="ag-csrows">${rows}</div>${up}</div>`
      : `<div class="ag-card ag-rtempty" data-cs="manage"><span class="ag-t2">${esc(t("csEmpty"))}</span>${add("primary")}</div>`;
    // Titel und Suchfeld im klebenden Kopf (1.63.0, wie bei den Routinen)
    return `<div class="ag-dlg-body ag-cs-pop"><div class="ag-pop-head">${iconTitle("speaker", TINT.sounds, t("csTitle"))}${tools}</div>${body}
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="cs-close">${esc(t("close"))}</button>${list.length && !up ? add("primary") : ""}</div></div>`;
  }

  // Die Zeilen der Töne, die zur Suche passen: Name, Länge und Grösse, "genutzt" in Worten und die Anlagen, die den Ton nutzen. Die Zeile,
  // die gerade umbenannt wird, bleibt immer stehen.
  _csRows() {
    const t = (k, v) => this._t(k, v);
    const list = customList(this.host);
    const q = this.cs.q || "";
    const rows = list.map((s) => {
      const u = usage(this.host, s.id);
      const used = t(u.steps > 1 ? "csUsedMany" : u.steps ? "csUsed" : "csUnused", { n: u.steps });
      if (this.cs.rename !== s.id && !matchQuery(q, s.name, soundInfo(s), used, u.systems)) return "";
      if (this.cs.rename === s.id) {
        return `<div class="ag-setrow ag-csrow"><div class="ag-settx"><input class="ag-input" type="text" maxlength="40" value="${esc(this.cs.text)}" data-sys="cs-name-edit" aria-label="${esc(t("upName"))}">
          <small class="ag-dlg-err ag-up-err" aria-live="polite">${esc(this.cs.error)}</small></div>
          <div class="ag-btnrow"><button class="ag-btn primary" data-sys="cs-rename-ok">${esc(t("save"))}</button><button class="ag-btn" data-sys="cs-rename-cancel">${esc(t("cancel"))}</button></div></div>`;
      }
      const playing = this.cs.playing === s.url;
      return `<div class="ag-setrow ag-csrow" data-sound="${esc(s.id)}">${soundBadge(s.id, playing)}<div class="ag-settx"><b>${esc(s.name)}</b><small>${esc(soundInfo(s))} · ${esc(used)}</small></div>
        <div class="ag-wf-btns ag-csbtns"><button class="ag-iconbtn ${playing ? "ag-running" : ""}" data-sys="${playing ? "cs-stop" : "cs-play"}" data-url="${esc(s.url)}" aria-label="${esc(t(playing ? "pvStop" : "pvPlay"))}" title="${esc(t(playing ? "pvStop" : "pvPlay"))}">${ic(playing ? "stop" : "play", 18)}</button>
          <button class="ag-iconbtn" data-sys="cs-rename" data-id="${esc(s.id)}" aria-label="${esc(t("csRename"))}" title="${esc(t("csRename"))}">${ic("pencil", 18)}</button>
          <button class="ag-iconbtn" data-sys="cs-delete" data-id="${esc(s.id)}" aria-label="${esc(t("csDelete"))}" title="${esc(t("csDelete"))}">${ic("trash", 18)}</button></div></div>`;
    }).join("");
    return rows || (list.length ? `<div class="ag-setrow ag-popempty"><span class="ag-t2">${esc(t("csNoMatch"))}</span></div>` : "");
  }

  openCsList() {
    const dlg = this._csDlg();
    if (!dlg.open) this.cs.q = "";
    this.refreshCsList(true);
    if (dlg.open) return;
    // Beim Schliessen (Knopf, X, Esc): Ton anhalten, halbfertiges Umbenennen und Hochladen verwerfen
    dlg.addEventListener("close", () => {
      this._csStopAudio();
      this.cs.rename = null;
      this.cs.upload = null;
      this.cs.error = "";
    }, { once: true });
    dlg.showModal();
  }

  // Nach jeder Änderung: das offene Fenster folgt (Scrollstand bleibt)
  refreshCsList(force = false) {
    const dlg = this._csDlg();
    if (!dlg || (!dlg.open && !force)) return;
    const top = dlg.querySelector(".ag-dlg-body")?.scrollTop || 0;
    dlg.innerHTML = this.csListHtml();
    const again = dlg.querySelector(".ag-dlg-body");
    if (again && top) again.scrollTop = top;
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

  _csRenameOk() {
    return this._sendOnce("cs-rename", this._csDlg()?.querySelector('[data-sys="cs-rename-ok"]'), () => this._csRename());
  }

  async _csRename() {
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
    this._csDlg()?.querySelector('[data-sys="cs-go"]')?.setAttribute("disabled", "");
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
    const d = this.ensureDraft();
    const auto = d.auto;
    const keepOk = Number.isInteger(auto.keep) && auto.keep >= 1 && auto.keep <= 50;
    const every = ["daily", "weekly", "monthly"].map((k) => `<option value="${k}" ${auto.every === k ? "selected" : ""}>${esc(this._t(`bkEvery_${k}`))}</option>`).join("");
    const autoRow = `<div class="ag-setrow ag-bkauto"><button class="ag-toggle ${auto.enabled ? "on" : ""}" data-sys="ab-on" role="switch" aria-checked="${auto.enabled}" aria-label="${esc(this._t("bkAuto"))}"></button>
      <span class="ag-oav ag-tint ag-tint-backup ${auto.enabled ? "on" : ""}">${ic("restore", 20)}</span><div class="ag-settx"><b>${esc(this._t("bkAuto"))}</b><small>${esc(this._t("bkAutoHint", { max: keepOk ? auto.keep : 5 }))}</small></div>
      <span class="ag-num ag-abkeep ${keepOk ? "" : "bad"}" title="${esc(this._t("bkAutoKeep"))}"><input type="number" min="1" max="50" step="1" inputmode="numeric" data-sys="ab-keep" value="${keepOk ? esc(auto.keep) : esc(Number.isFinite(auto.keep) ? auto.keep : "")}" aria-label="${esc(this._t("bkAutoKeep"))}"><span class="ag-t2">${esc(this._t("bkAutoKeepUnit"))}</span></span>
      <select class="ag-input" data-sys="ab-every" aria-label="${esc(this._t("bkAutoEvery"))}" ${auto.enabled ? "" : "disabled"}>${every}</select></div>`;
    // Wie Routinen, eigene Töne und Codes (1.64.0, Wunsch des Nutzers): oben die Zeile mit "Letztes Backup", links "Backup erstellen", rechts
    // "Backups anzeigen"; der Hinweis steht über der Karte, darunter die automatischen Backups
    const has = Boolean(this.backups?.length);
    // Was im Backup steht und was nicht (Wunsch des Nutzers 2026-11-19, etwa: das Protokoll ist nicht dabei); zum Aufklappen wie "Was prüft der Selbsttest?"
    // Offen bleibt es auch, wenn die Seite neu gezeichnet wird (bkAboutOpen, gesetzt beim Klick auf die Zeile)
    const about = `<details class="ag-st-about ag-bk-about" ${this.bkAboutOpen ? "open" : ""}><summary data-sys="bk-about">${ic("info", 16)}<span>${esc(this._t("bkAbout"))}</span></summary><ul class="ag-st-ul">${this._t("bkAboutText").split("\n").filter(Boolean).map((line) => `<li>${esc(line)}</li>`).join("")}</ul></details>`;
    return chapter(this._t("bkTitle"), `${about}<div class="ag-card ag-setlist ag-codes">
      <div class="ag-setrow ag-rtsum ag-bklast"><span class="ag-oav ag-tint ag-tint-backup ${has ? "on" : ""}">${ic("archive", 20)}</span><div class="ag-settx ag-bklast-tx">${this._bkLastHtml()}</div>
        <div class="ag-btnrow"><button class="ag-btn" data-sys="bk-create">${ic("plus", 18)}${esc(this._t("bkSave"))}</button>
          <button class="ag-btn" data-sys="bk-open">${ic("archive", 18)}${esc(this._t("bkShow"))}</button></div></div>${autoRow}</div>`, this._t("bkHint"));
  }

  // "Letzte Sicherung: Datum, Name" (die Liste selbst steht im Popup)
  _bkLastHtml() {
    if (this.backups === null) return "";
    const lang = this.host._lang || "en";
    if (!this.backups.length) return `<b>${esc(this._t("bkLastNone"))}</b>`; // fett wie "Noch keine Codes" (Zeile wie Routinen, Töne, Codes; 1.64.0)
    const last = [...this.backups].sort((x, y) => (x.created < y.created ? 1 : -1))[0];
    const date = last.created ? new Date(last.created).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" }) : "–";
    const name = last.name ? ` · ${last.name}` : last.auto ? ` · ${this._t("bkAutoTag")}` : "";
    return `<b>${esc(this._t("bkLast"))}</b> <small class="ag-bklast-v">${esc(date + name)}</small>`;
  }

  _bkDlg() {
    return this.host._root.getElementById("ag-bklist");
  }

  // Popup mit der Liste der Sicherungen (Handy: ganzer Bildschirm); Export und Import stehen in der Fusszeile, die Einstellungen und "Backup erstellen" bleiben auf der Seite
  openBackupList() {
    const dlg = this._bkDlg();
    if (this.backups === null && !this._bkLoading) this.loadBackups();
    // Suchfeld und Filter "Automatisch" (1.60.0, Wunsch des Nutzers) stehen über der Liste und ausserhalb davon: die Liste wird beim Tippen
    // und beim Laden für sich neu gezeichnet. Ohne Sicherungen bleiben sie verborgen.
    if (!dlg.open) Object.assign(this, { bkQ: "", bkAutoOnly: false });
    // Titel, Suchfeld und Filter im klebenden Kopf (1.63.0, wie bei den Routinen)
    dlg.innerHTML = `<div class="ag-dlg-body ag-bk-pop"><div class="ag-pop-head">${iconTitle("archive", TINT.backup, this._t("bkListTitle"))}
      <div class="ag-tools ag-pop-tools ag-bktools" ${this.backups?.length ? "" : "hidden"}>${searchField("data-sys", "bk-search", this.bkQ || "", this._t("bkFilter"), this._t("clearSearch"))}
        <button type="button" class="ag-chip ${this.bkAutoOnly ? "on" : ""}" data-sys="bk-auto-only" aria-pressed="${Boolean(this.bkAutoOnly)}">${ic("restore", 16)}${esc(this._t("bkFilterAuto"))}</button></div></div>
      <div class="ag-bkbody">${this._bkBody()}</div>
      <div class="ag-dlg-btns ag-bkfoot"><button class="ag-btn" data-sys="export">${ic("arrowDown", 18)}${esc(this._t("bkExport"))}</button>
        <button class="ag-btn" data-sys="import">${ic("arrowUp", 18)}${esc(this._t("bkImport"))}</button><input type="file" accept="application/json,.json" data-sys="import-file" hidden>
        <span class="ag-grow"></span><button class="ag-btn" data-sys="bk-close">${esc(this._t("close"))}</button></div></div>`;
    if (!dlg.open) dlg.showModal();
  }

  // Anlage löschen (1.32.0): ganz unten, roter Textknopf; die Warnung kommt im Dialog. Nur bei deaktivierter Anlage (der Server prüft es auch).
  // Einrichtungsassistent (1.69.0, Wunsch des Nutzers 2026-11-19): kleines Kapitel vor "Anlage löschen". Zustand und Knopf zum Starten; ist er
  // nicht fertig, geht es mit "Fortsetzen" beim gemerkten Schritt weiter, "Von vorn" beginnt beim Willkommen (alles wie konfiguriert vorgewählt)
  // Akzentfarbe der Anlage (1.75.0; seit 1.76.0 wie Töne, Codes und Backups: eine Zeile mit Symbol und Knopf, die Auswahl im eigenen Fenster, Wunsch des
  // Nutzers 2026-11-22). Das Fenster ändert nur den Entwurf der Seite ("Übernehmen"), gespeichert wird mit "Speichern" der Seite; die Farbe zeigt sich
  // schon im Fenster als Vorschau
  _accentHtml(d) {
    const t = (k, v) => this._t(k, v);
    const hex = accentColor(d.accent);
    return chapter(t("accTitle"), `<div class="ag-card ag-setlist ag-codes"><div class="ag-setrow ag-rtsum ag-accrow"><span class="ag-oav ag-tint ag-tint-accent on">${ic("palette", 20)}</span>
      <div class="ag-settx"><b class="ag-accname"><span class="ag-accdot ag-accdot-s ag-accdot-ring" style="background:${hex || "var(--primary-color, #03a9f4)"}"></span>${esc(t(`acc_${d.accent}`))}</b>${d.accent !== this.base().accent ? `<small class="ag-t2 ag-unsaved">${esc(t("unsavedOne"))}</small>` : ""}</div><div class="ag-btnrow"><button class="ag-btn" data-sys="acc-open">${ic("palette", 18)}${esc(t("accChange"))}</button></div></div></div>`, t("accHint"));
  }

  accentDlg() {
    return this.host._root.getElementById("ag-accent");
  }

  openAccent() {
    const dlg = this.accentDlg();
    const d = this.ensureDraft();
    if (!dlg) return;
    this.accPick = d.accent;
    this.accPv = ACC_PV();
    // Wie auch immer das Fenster schliesst: die Vorschau fällt auf den Entwurf der Seite zurück
    dlg.onclose = () => {
      this.accPick = null;
      this.host._applyAccent?.(this.draft?.accent);
    };
    this._renderAccent();
    if (!dlg.open) dlg.showModal();
  }

  _renderAccent() {
    const dlg = this.accentDlg();
    const t = (k) => this._t(k);
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-acc-pop">${iconTitle("palette", "ag-tint ag-tint-accent on", t("accTitle"))}
      <p class="ag-t2">${esc(t("accHint"))}</p>
      ${accentGrid(this.accPick, 'data-sys="acc-pick"', t)}
      ${accentPreview(this.accPick, t, this.accPv)}
      <div class="ag-dlg-btns"><button type="button" class="ag-btn" data-sys="acc-cancel">${esc(t("cancel"))}</button><button type="button" class="ag-btn primary" data-sys="acc-apply">${ic("check", 18)}${esc(t("accApply"))}</button></div></div>`);
  }

  _wizardHtml() {
    const s = this.system;
    const w = s.wizard || { state: "done", step: "welcome" };
    const wz = this.host.wizard;
    const n = wz.number(w.step);
    const stepName = this._t(`wzS_${w.step}`);
    const date = w.until ? new Date(`${w.until}T00:00:00`).toLocaleDateString(this.host._hass?.locale?.language || undefined) : "";
    const status = w.state === "done" ? this._t("wzState_done") : w.state === "later" ? this._t("wzState_later", { date, n }) : w.state === "hidden" ? this._t("wzState_hidden", { n })
      : this._t("wzState_open", { n, step: stepName });
    const resume = w.state !== "done" && w.step !== "welcome";
    const btns = resume
      ? `<button class="ag-btn" data-wz="run" data-step="welcome">${esc(this._t("wzRestart"))}</button><button class="ag-btn primary" data-wz="run" data-step="${esc(w.step)}">${ic("wand", 18)}${esc(this._t("wzResume", { n }))}</button>`
      : `<button class="ag-btn" data-wz="run" data-step="welcome">${ic("wand", 18)}${esc(this._t("wzRun"))}</button>`;
    return chapter(this._t("wzChapter"), `<div class="ag-card ag-setlist ag-codes"><div class="ag-setrow ag-rtsum ag-wzrow"><span class="ag-oav ag-tint ag-tint-wizard on">${ic("wand", 20)}</span>
      <div class="ag-settx"><b>${esc(status)}</b><small>${esc(this._t("wzChapterText"))}</small></div><div class="ag-btnrow">${btns}</div></div></div>`, this._t("wzChapterHint"));
  }

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
    // Sortierbare Spalten (Standard: Datum, neueste oben); die Tabelle rollt für sich ab zehn Zeilen, der Kopf bleibt stehen
    const sort = this.bkSort || (this.bkSort = { key: "date", dir: "desc" });
    const val = { name: (b) => (b.name || "").toLowerCase(), date: (b) => b.created || "", systems: (b) => (b.systems || []).join(", ").toLowerCase() }[sort.key];
    // Suche: Name, "Automatisch", Datum (wie angezeigt) und die Anlagen; der Filter "Automatisch" zeigt nur die automatischen Sicherungen
    const shown = this.backups.filter((b) => (!this.bkAutoOnly || b.auto) && matchQuery(this.bkQ, b.name, b.auto ? this._t("bkAutoTag") : "", date(b.created), b.systems));
    const list = shown.sort((x, y) => (val(x) < val(y) ? -1 : val(x) > val(y) ? 1 : 0) * (sort.dir === "desc" ? -1 : 1) || (x.created < y.created ? 1 : -1));
    const rows = list.map((b) => `<tr data-bk="${esc(b.id)}"><td>${b.name || !b.auto ? `<b class="ag-bkname">${esc(b.name || "–")}</b>` : ""}${b.auto ? `<span class="ag-tag none ag-bkauto-tag">${esc(this._t("bkAutoTag"))}</span>` : ""}<small class="ag-t2 ag-bksys-m">${esc((b.systems || []).join(", ") || "–")}</small></td><td class="ag-t2 ag-bkdate">${esc(date(b.created))}</td><td class="ag-t2 ag-bksys">${esc((b.systems || []).join(", ") || "–")}</td>
        <td class="ag-acts"><div class="ag-wf-btns ag-bkbtns">${btn("bk-download", "arrowLine", "bkDownload", b.id)}${btn("bk-restore", "restore", "bkRestoreOne", b.id)}${btn("bk-delete", "trash", "bkDelete", b.id)}</div></td></tr>`).join("");
    const th = (key, label) => {
      const on = sort.key === key;
      return `<th aria-sort="${on ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button type="button" class="ag-sortbtn ${on ? "on" : ""}" data-sys="bk-sort" data-key="${key}" title="${esc(this._t("sortBy", { column: label }))}">${esc(label)}<span class="ag-sortic">${on ? ic(sort.dir === "desc" ? "arrowDown" : "arrowUp", 14) : ""}</span></button></th>`;
    };
    return `<div class="ag-t2 ag-small" style="margin:10px 4px 6px">${esc(this._t("bkCount", { count: this.backups.filter((b) => !b.auto).length, max: this.bkMax }))}${this.backups.some((b) => b.auto) ? ` · ${esc(this._t("bkCountAuto", { count: this.backups.filter((b) => b.auto).length, max: this.bkMaxAuto }))}` : ""}</div>
      ${rows ? `<div class="ag-card ag-bkwrap"><table class="ag-table ag-bktable"><tr>${th("name", this._t("bkColName"))}${th("date", this._t("bkColDate"))}${th("systems", this._t("bkColSystems")).replace("<th ", '<th class="ag-bksys" ')}<th></th></tr>${rows}</table></div>`
        : `<div class="ag-card ag-popempty"><span class="ag-t2">${esc(this._t("bkNoMatch"))}</span></div>`}`;
  }

  renderBackups() {
    const el = this._bkDlg()?.querySelector(".ag-bkbody");
    if (el) this.host._setHtml(el, this._bkBody());
    const tools = this._bkDlg()?.querySelector(".ag-bktools");
    if (tools) tools.hidden = !this.backups?.length;
    const last = this.host._view?.querySelector(".ag-bklast-tx");
    if (last) last.innerHTML = this._bkLastHtml();
    this.host._view?.querySelector(".ag-bklast > .ag-oav")?.classList.toggle("on", Boolean(this.backups?.length));
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
    const dlg = this._codeDlg(true);
    dlg.innerHTML = `<form class="ag-dlg-body" data-form="backup">${iconTitle("archive", TINT.backup, this._t("bkNameTitle"))}
      ${chapter(this._t("bkNameLabel"), `<input class="ag-input" id="ag-bk-name" type="text" maxlength="60" placeholder="${esc(this._t("bkNamePlaceholder"))}" style="width:100%;box-sizing:border-box" autocomplete="off" aria-label="${esc(this._t("bkNameLabel"))}">`)}
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button type="button" class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn primary" type="submit">${esc(this._t("bkSave"))}</button></div></form>`;
    dlg.showModal();
    dlg.querySelector("input").focus({ preventScroll: true }); // kein Runterscrollen beim Fokus (1.73.0, wie im Fenster "Code hinzufügen")
  }

  createBackup(name = "") {
    return this._sendOnce("bk-create", this._codeDlg()?.querySelector('[data-form="backup"] button[type="submit"]'), () => this._createBackup(name));
  }

  async _createBackup(name) {
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
    const dlg = this._codeDlg(false);
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
    const dlg = this._codeDlg(true);
    dlg.innerHTML = `<div class="ag-dlg-body">${iconTitle("archive", TINT.backup, this._t("bkConfirmTitle"))}
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
    go.disabled = !active || this._choices.some((c) => c.error) || pendingName || this._choices.some((c) => c.target === "new" && !c.name.trim()) || Boolean(this._sending?.has("import"));
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

  importGo() {
    return this._sendOnce("import", this._codeDlg()?.querySelector('[data-sys="import-go"]'), () => this._importGo()).finally(() => this._checkRestore());
  }

  async _importGo() {
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
      this._codeError(err?.code === "name_taken" ? this._t("renameTaken") : err?.code === "name_required" ? this._t("renameEmpty") : err?.code === "invalid_mapping" ? this._t("bkErrMapping") : err?.code === "mode_active" ? this._t("bkErrModeActive") : this._backupErr(err));
    }
  }

  // Ein Fenster für Formulare und Rückfragen von Codes und Backups. `wide` beim Öffnen: Formulare in der Standardbreite aller Fenster (wie die Liste
  // dahinter, Wunsch des Nutzers 2026-11-19), Rückfragen (Löschen?) schmal; auf dem Handy immer ganzer Bildschirm
  _codeDlg(wide) {
    const dlg = this.host._root.getElementById("ag-codes");
    if (dlg && wide !== undefined) dlg.classList.toggle("ag-wide", wide);
    return dlg;
  }

  // Code hinzufügen oder bearbeiten (Bearbeiten seit 1.63.0): dasselbe Fenster. Beim Bearbeiten stehen Name und Benutzer drin, die Codefelder
  // sind leer (der Code ist nirgends bekannt); leer gelassen bleibt der bisherige Code. Das Auge blendet nur den gerade getippten Code ein.
  // `preset` (Einrichtungsassistent, 1.69.0): ein neuer Code für den angemeldeten Benutzer, Name und Benutzer vorgewählt, wenn dieser noch keinen hat
  openCodeForm(id = "", preset = null) {
    const codes = this.system?.codes || [];
    const c = id ? codes.find((x) => x.id === id) : null;
    if (id && !c) return;
    const users = this.host._data?.users || [];
    const taken = new Set(codes.filter((x) => x !== c).map((x) => x.user_id).filter(Boolean));
    const mine = !c && preset?.userId && users.some((u) => u.id === preset.userId) && !taken.has(preset.userId) ? preset : null;
    const own = c?.user_id || mine?.userId || "";
    // Ein verknüpfter Benutzer, den Home Assistant nicht mehr als aktiv listet, bleibt wählbar (sonst löste ihn jedes Speichern still)
    const gone = own && !users.some((u) => u.id === own) ? `<option value="${esc(own)}" selected>${esc(this._t("codeUserGone"))}</option>` : "";
    const options = users.filter((u) => !taken.has(u.id)).map((u) => `<option value="${esc(u.id)}" ${u.id === own ? "selected" : ""}>${esc(u.name)}</option>`).join("");
    // Seit 1.73.0 (Wunsch des Nutzers): jedes Feld ist ein Kapitel (fetter Titel mit Strich davor, wie bei "Routine hinzufügen"); der Titel ersetzt die
    // kleine Beschriftung, das Feld trägt sie als aria-label. Der Einrichtungsassistent öffnet dasselbe Fenster und übernimmt es damit.
    const secret = (key, label) => `<span class="ag-pwfld"><input class="ag-input" id="ag-cf-${key}" type="password" inputmode="numeric" autocomplete="new-password" data-sys="cf" data-key="${key}" data-secret maxlength="8" aria-label="${esc(label)}">
          <button type="button" class="ag-iconbtn ag-pweye" data-sys="code-eye" aria-pressed="false" aria-label="${esc(this._t("codeShow"))}" title="${esc(this._t("codeShow"))}">${ic("eye", 18)}</button></span>`;
    const dlg = this._codeDlg(true);
    const userBody = `<select class="ag-input" data-sys="cf" data-key="user_id" data-init="${esc(own)}" aria-label="${esc(this._t("codeUser"))}">
        <option value="">${esc(this._t("codeUserNone"))}</option>${gone}${options}</select>`;
    const nameBody = `<input class="ag-input" data-sys="cf" data-key="name" maxlength="40" autocomplete="off" value="${esc(c?.name || mine?.name || "")}" data-init="${esc(c?.name || "")}" aria-label="${esc(this._t("codeName"))}">`;
    const codeBody = `<div class="ag-fld">${secret("code", this._t("codeValue"))}${secret("code2", this._t("codeRepeat"))}</div>`;
    dlg.innerHTML = `<div class="ag-dlg-body ag-codeform">${iconTitle("hand", TINT.codes, this._t(c ? "codeEdit" : "codeAdd"))}
      ${chapter(this._t("codeUser"), userBody, this._t("codeUserHint"))}
      ${chapter(this._t("codeName"), nameBody)}
      ${chapter(this._t("codeValue"), codeBody, c ? this._t("codeKeepHint") : "")}
      <div class="ag-codewarn" hidden aria-live="polite">${ic("alert", 18)}<span></span></div>
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn primary" data-sys="code-save" data-id="${esc(c?.id || "")}">${ic("check", 18)}${esc(this._t("save"))}</button></div></div>`;
    dlg.showModal();
    this._focusName(dlg);
  }

  // Der Fokus geht gleich ins Feld "Name", damit man lostippen kann, aber das Fenster scrollt dabei nicht (Wunsch des Nutzers 2026-11-21: auf dem iPhone
  // verschwand der Titel). `preventScroll` hält das Scrollen des Fokus an; öffnet die Tastatur trotzdem eine Verschiebung, steht das Fenster in den ersten
  // Sekunden wieder oben, solange das Feld dabei über der Tastatur bleibt (sonst bleibt es, wie es ist, das Feld geht vor).
  _focusName(dlg) {
    const name = dlg.querySelector('[data-key="name"]');
    if (!name) return;
    name.focus({ preventScroll: true });
    const top = () => {
      if (!dlg.open) return;
      const was = [dlg.scrollTop, dlg.querySelector(".ag-dlg-body")?.scrollTop || 0];
      for (const el of [dlg, dlg.querySelector(".ag-dlg-body")]) if (el) el.scrollTop = 0;
      window.scrollTo?.(0, 0);
      const vv = window.visualViewport;
      const room = (vv ? vv.height : window.innerHeight) - 8;
      if (name.getBoundingClientRect().bottom > room) {
        // das Feld läge hinter der Tastatur: den alten Stand zurück
        dlg.scrollTop = was[0];
        const body = dlg.querySelector(".ag-dlg-body");
        if (body) body.scrollTop = was[1];
      }
    };
    top();
    for (const ms of [80, 260, 520]) window.setTimeout(() => { if (this.host._root.activeElement === name) top(); }, ms);
  }

  // Warnung bei einem leicht zu erratenden Code (1.63.0, Wunsch des Nutzers): rot, fett, mit Achtung-Zeichen unter den Codefeldern; Speichern
  // bleibt möglich. "Zu kurz" erst, wenn das Feld verlassen ist (sonst stünde es bei jeder Eingabe kurz da). Der Code verlässt das Fenster dafür nie.
  codeWarn() {
    const dlg = this._codeDlg();
    const box = dlg?.querySelector(".ag-codewarn");
    const input = dlg?.querySelector('[data-key="code"]');
    if (!box || !input) return;
    const found = codeWeakness(input.value.trim());
    const short = found[0] === "short";
    const show = short ? this.host._root.activeElement !== input : found.length > 0;
    box.hidden = !show;
    box.querySelector("span").textContent = !show ? "" : short ? this._t("codeWeakShort")
      : this._t("codeWeak", { reasons: found.map((k) => this._t(`codeWeak_${k}`)).join(", ") });
  }

  openRemoveCode(id) {
    const c = (this.system.codes || []).find((x) => x.id === id);
    if (!c) return;
    const dlg = this._codeDlg(false);
    dlg.innerHTML = `<div class="ag-dlg-body"><h3>${esc(this._t("codeRemoveTitle"))}</h3><div class="ag-t2">${esc(this._t("codeRemoveText", { name: c.name }))}</div>
      <div class="ag-dlg-err" aria-live="polite"></div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-sys="code-close">${esc(this._t("cancel"))}</button><button class="ag-btn danger" data-sys="code-remove" data-id="${esc(id)}">${ic("trash", 18)}${esc(this._t("remove"))}</button></div></div>`;
    dlg.showModal();
  }

  _codeError(text) {
    const box = this._codeDlg().querySelector(".ag-dlg-err");
    if (box) box.textContent = text;
  }

  saveCode() {
    return this._sendOnce("code-save", this._codeDlg()?.querySelector('[data-sys="code-save"]'), () => this._saveCode());
  }

  async _saveCode() {
    const dlg = this._codeDlg();
    const id = dlg.querySelector('[data-sys="code-save"]')?.dataset.id || "";
    const val = (k) => dlg.querySelector(`[data-key="${k}"]`).value;
    const name = val("name").trim();
    if (!name) return this._codeError(this._t("codeNameMissing"));
    const code = val("code");
    // Beim Bearbeiten heisst ein leeres Codefeld "bisherigen Code behalten"; sonst gelten dieselben Prüfungen wie beim Hinzufügen
    if (!id || code || val("code2")) {
      if (!/^\d{4,8}$/.test(code)) return this._codeError(this._t("errInvalidCodeFormat"));
      if (code !== val("code2")) return this._codeError(this._t("codeMismatch"));
    }
    const userId = val("user_id") || null;
    const entryId = this.system.entry_id;
    try {
      let added = null;
      if (id) await this.host._hass.callWS({ type: "alarmageddon/update_code", entry_id: entryId, code_id: id, name, user_id: userId, ...(code ? { code } : {}) });
      else added = await this.host._hass.callWS({ type: "alarmageddon/add_code", entry_id: entryId, name, code, user_id: userId });
      // Das offene Fenster mit der Liste folgt sofort; die Abfrage danach bestätigt den Stand des Servers
      const sys = this.host._system(entryId);
      if (sys) {
        sys.codes = sys.codes || [];
        const mine = id ? sys.codes.find((c) => c.id === id) : null;
        if (mine) Object.assign(mine, { name, user_id: userId });
        else if (added?.id) sys.codes.push({ id: added.id, name, user_id: userId });
        if (added?.id) sys.has_code = true;
      }
      dlg.close();
      this.host._toast(this._t("saved"));
      this.render();
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
        : first === "auto.keep" ? this._t("invalidCount", { min: 1, max: 50 })
        : first === "st.off" || first === "st.on" ? this._t("stEveryInvalid")
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
      const autoChanged = JSON.stringify(d.auto) !== JSON.stringify(this.autoOf(h._data?.auto_backup));
      const modes = ALL_MODES.filter((m) => d.modes[m]);
      // Alle Modi (auch abgeschaltete behalten ihre Werte)
      const mode_settings = Object.fromEntries(ALL_MODES.map((m) => [m, { ...d.per[m] }]));
      const saved = await h._hass.callWS({ type: "alarmageddon/save_system", entry_id: s.entry_id, mode_settings, per_mode_settings: d.perMode,
        home_enabled: d.modes.home, away_enabled: d.modes.away, night_enabled: d.modes.night, always_enabled: d.always, monitor_enabled: d.monitor, accent: d.accent, routines: d.routines,
        ...(s.has_code || s.code_ack_required ? { code_ack_required: d.ackCode && Boolean(s.has_code) } : {}) });
      Object.assign(s, { per_mode_settings: d.perMode, mode_settings: JSON.parse(JSON.stringify(mode_settings)), night_enabled: d.modes.night, always_enabled: d.always, monitor_enabled: d.monitor, accent: d.accent, modes, routines: JSON.parse(JSON.stringify(d.routines)), code_ack_required: d.ackCode && Boolean(s.has_code) });
      // Abstand des Selbsttests (1.65.0): nur dieser Wert der Benachrichtigungen, alles andere bleibt, wie es ist
      const stBase = this.base(s);
      const [off, on] = [stMinutes(d.stOff), stMinutes(d.stOn)];
      if (off !== stMinutes(stBase.stOff) || on !== stMinutes(stBase.stOn)) {
        const res = await h._hass.callWS({ type: "alarmageddon/save_notify", notify: { selftest_minutes: off, selftest_minutes_armed: on } });
        if (h._data) {
          h._data.notify = res.notify;
          if (h._data.selftest) Object.assign(h._data.selftest, { minutes_disarmed: off, minutes_armed: on });
        }
      }
      if (autoChanged) {
        const res = await h._hass.callWS({ type: "alarmageddon/save_auto_backup", enabled: d.auto.enabled, every: d.auto.every, keep: d.auto.keep });
        if (h._data) h._data.auto_backup = res.auto_backup;
        this.bkMaxAuto = res.auto_backup.keep;
      }
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
    // "Was ist im Backup?": der Browser klappt auf oder zu, hier nur merken (der Klick kommt vor dem Umschalten)
    if (act === "bk-about") {
      this.bkAboutOpen = !el.closest("details")?.open;
      return true;
    }
    // Automatische Sicherung: Schalter und Abstand gelten sofort (wie die Sicherung selbst), nicht als Entwurf der Seite
    if (act === "bk-sort") {
      const cur = this.bkSort || { key: "date", dir: "desc" };
      this.bkSort = { key: el.dataset.key, dir: cur.key === el.dataset.key ? (cur.dir === "asc" ? "desc" : "asc") : el.dataset.key === "date" ? "desc" : "asc" };
      this.renderBackups();
      return true;
    }
    if (act === "ab-on") {
      const d = this.ensureDraft();
      d.auto.enabled = !d.auto.enabled;
      this.saveState = null;
      this.render();
      return true;
    }
    if (act === "cs-open") {
      this.openCsList();
      return true;
    }
    if (act === "code-open") {
      this.openCodeList();
      return true;
    }
    if (act === "code-list-close") {
      this._codeListDlg().close();
      return true;
    }
    if (act === "code-sort") {
      const cur = this.codeSort || { key: "name", dir: "asc" };
      this.codeSort = { key: el.dataset.key, dir: cur.key === el.dataset.key && cur.dir === "asc" ? "desc" : "asc" };
      this.refreshCodeList();
      return true;
    }
    if (act === "cs-search-clear" || act === "bk-search-clear" || act === "code-search-clear") {
      const input = el.closest(".list-search").querySelector("input");
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      return true;
    }
    if (act === "cs-search" || act === "bk-search" || act === "code-search") return true; // ein Klick ins Suchfeld löst nichts aus
    if (act === "bk-auto-only") {
      this.bkAutoOnly = !this.bkAutoOnly;
      el.classList.toggle("on", this.bkAutoOnly);
      el.setAttribute("aria-pressed", String(this.bkAutoOnly));
      this.renderBackups();
      return true;
    }
    if (act === "cs-close") {
      this._csDlg().close();
      return true;
    }
    if (act === "bk-open") {
      this.openBackupList();
      return true;
    }
    if (act === "bk-close") {
      this._bkDlg().close();
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
      else if (act === "cs-upload-page") {
        // Von der Seite: das Fenster öffnet gleich mit dem Formular zum Hochladen
        this.cs.upload = { name: "", error: "", busy: false };
        this.openCsList();
      } else if (act === "cs-upload-open") {
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
    } else if (act === "acc-open") {
      this.openAccent();
    } else if (act === "acc-pick") {
      this.accPick = el.dataset.key;
      this.host._applyAccent?.(this.accPick); // Vorschau im ganzen Panel
      this._renderAccent();
    } else if (act.startsWith("accpv-")) {
      // Simulation im Fenster: ändert nur diese Anzeige
      const pv = (this.accPv = this.accPv || ACC_PV());
      if (act === "accpv-tab") pv.tab = Number(el.dataset.i);
      else if (act === "accpv-tog") pv.tog = !pv.tog;
      else if (act === "accpv-chk") pv.chk = !pv.chk;
      else if (act === "accpv-round") pv.up = !pv.up;
      else if (act === "accpv-tag") pv.tag = !pv.tag;
      else if (act === "accpv-btn") {
        pv.flash = true;
        window.clearTimeout(this._accFlash);
        this._accFlash = window.setTimeout(() => {
          pv.flash = false;
          if (this.accentDlg()?.open) this._renderAccent();
        }, 1200);
      }
      this._renderAccent();
    } else if (act === "acc-cancel") {
      this.accentDlg()?.close();
    } else if (act === "acc-apply") {
      d.accent = this.accPick || d.accent;
      this.accentDlg()?.close();
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
      this._bkDlg()?.querySelector('[data-sys="import-file"]')?.click();
    } else if (act === "import-file") {
      return false;
    } else if (act === "code-add" || act === "code-add-page") {
      // Aus dem Fenster "Codes pro Person" oder direkt von der Seite (1.64.0): dasselbe Formular
      this.openCodeForm();
    } else if (act === "code-edit") {
      this.openCodeForm(el.dataset.id);
    } else if (act === "code-eye") {
      // Nur der gerade getippte Code (Feld im Fenster): ein gespeicherter Code ist nirgends bekannt und wird nie angezeigt
      const input = el.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      const label = this._t(show ? "codeHide" : "codeShow");
      el.setAttribute("aria-pressed", String(show));
      el.setAttribute("aria-label", label);
      el.title = label;
      el.innerHTML = ic(show ? "eyeOff" : "eye", 18);
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

  onInput(el) {
    if (el.dataset.sys === "accpv-val") {
      // Schieber der Vorschau: nur Anzeige, ohne Neuzeichnen (der Griff bleibt unter dem Finger)
      (this.accPv = this.accPv || ACC_PV()).val = Number(el.value);
      el.style.setProperty("--v", `${el.value}%`);
      return;
    }
    if (el.dataset.sys === "st-value" || el.dataset.sys === "st-unit") {
      // Entwurf der Seite wie das automatische Backup; ungültig (nicht 5 Minuten bis 24 Stunden) sperrt "Speichern"
      const d = this.ensureDraft();
      const f = { ...d[el.dataset.stWhich] };
      if (el.dataset.sys === "st-value") f.value = el.value.trim() === "" ? NaN : Number(el.value);
      else {
        // Umrechnen, wo es aufgeht (90 Minuten in Stunden geht nicht: dann bleibt die Zahl, und die Prüfung meldet die Grenzen), wie beim Intervall
        // der HealthCheck-Dienste
        const min = stMinutes(f);
        f.unit = el.value;
        if (Number.isFinite(min) && (f.unit === "min" || min % 60 === 0)) f.value = f.unit === "h" ? min / 60 : min;
        const box = el.closest(".ag-num").querySelector("input");
        box.max = f.unit === "h" ? "24" : "1440";
        box.value = Number.isFinite(f.value) ? String(f.value) : "";
      }
      d[el.dataset.stWhich] = f;
      el.closest(".ag-num").classList.toggle("bad", !stOk(f));
      this.saveState = null;
      this.renderFoot();
      return true;
    }
    if (el.dataset.sys === "ab-keep") {
      // Entwurf der Seite: gespeichert wird mit "Speichern"; ungültig (nicht 1 bis 50) sperrt "Speichern"
      const d = this.ensureDraft();
      const n = el.value.trim() === "" ? NaN : Number(el.value);
      d.auto.keep = n;
      const ok = Number.isInteger(n) && n >= 1 && n <= 50;
      el.closest(".ag-num").classList.toggle("bad", !ok);
      const small = el.closest(".ag-bkauto")?.querySelector(".ag-settx small");
      if (small && ok) small.textContent = this._t("bkAutoHint", { max: n });
      this.saveState = null;
      this.renderFoot();
      return true;
    }
    if (el.dataset.sys === "ab-every") {
      this.ensureDraft().auto.every = el.value;
      this.saveState = null;
      this.renderFoot();
      return true;
    }
    if (el.dataset.sys === "cs-name") {
      if (this.cs.upload) this.cs.upload.name = el.value;
      return true;
    }
    if (el.dataset.sys === "cs-search") {
      // Nur die Zeilen neu zeichnen: Suchfeld und ein offenes Formular zum Hochladen bleiben, wie sie sind
      this.cs.q = el.value;
      const dlg = this._csDlg();
      dlg.querySelector('[data-sys="cs-search-clear"]').hidden = !this.cs.q;
      dlg.querySelector(".ag-csrows").innerHTML = this._csRows();
      return true;
    }
    if (el.dataset.sys === "code-search") {
      // Nur die Tabelle neu zeichnen: das Suchfeld behält den Fokus
      this.codeQ = el.value;
      const dlg = this._codeListDlg();
      dlg.querySelector('[data-sys="code-search-clear"]').hidden = !this.codeQ;
      dlg.querySelector(".ag-codebody").innerHTML = this._codeTable();
      return true;
    }
    if (el.dataset.sys === "bk-search") {
      this.bkQ = el.value;
      this._bkDlg().querySelector('[data-sys="bk-search-clear"]').hidden = !this.bkQ;
      this.renderBackups();
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
      this.codeWarn();
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
