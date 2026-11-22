// Selbsttest (1.65.0, Wunsch des Nutzers 2026-11-18): Zeile in der Statuskachel der Übersicht (immer, mit der Zeit der letzten Prüfung) und ein
// Fenster mit allen Befunden. Zu jedem Befund: was los ist, wo, was es bedeutet, mögliche Ursachen und wie man es behebt (Hilfe so ausführlich
// wie möglich), dazu "Öffnen" (springt an die Stelle) und bei Befunden der Laufzeit "Erledigt". "Jetzt prüfen" prüft sofort.
// Die Befunde kommen vom Server (selftest.py) nur als Kennungen und Namen; die Texte stehen hier (strings.js), wie überall im Panel.
const V = new URL(import.meta.url).search;
const { ic, esc, errText, iconTitle, MODE_KEY, matchQuery, searchField } = await import(`./common.js${V}`);

// Liste "Geprüft" (Wunsch des Nutzers 2026-11-19): Gruppen in dieser Reihenfolge; Entitäten nach ihrer Rolle, dazu Aktionen und Empfänger
const CHECKED_GROUPS = [["entity", "sensor"], ["entity", "watch"], ["entity", "output"], ["entity", "player"], ["entity", "trigger"], ["service", ""], ["recipient", ""]];

// Befunde, die einen Alarm verhindern oder stumm machen können: rot statt gelb
const RED_CODES = new Set(["system_not_loaded", "start_failed", "no_recipients", "no_url"]);

export class SelfTestUi {
  constructor(host) {
    this.host = host;
    this.opened = new Set(); // aufgeklappte Befunde (Schlüssel)
    this.busy = false;
    this.checked = null; // Liste "Geprüft" der letzten Prüfung (vom Server auf Abruf)
    this.checkedQ = "";
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get data() {
    return this.host._data?.selftest || null;
  }

  get dlg() {
    return this.host._root.getElementById("ag-selftest");
  }

  get checkedDlg() {
    return this.host._root.getElementById("ag-stchecked");
  }

  problems() {
    return this.data?.problems || [];
  }

  // Farbe des Symbols wie in der Zeile unter Konfiguration › Anlage: grün ohne Befund, gelb mit Befunden, rot, wenn einer einen Alarm verhindern
  // kann; grau vor der ersten Prüfung
  tone() {
    const n = this.problems().length;
    return n ? (this.problems().some((p) => this._red(p)) ? "err" : "warn") : this.data?.last ? "ok" : "";
  }

  // ----- Statuskachel -----

  // Zeile der Statuskachel: immer da, mit der Zeit der letzten Prüfung. Mit Befunden gelb (rot, wenn einer einen Alarm verhindern kann).
  tileRow() {
    const d = this.data;
    if (!d) return "";
    const n = this.problems().length;
    const label = !d.last && !n ? this._t("stRowNone") : n === 0 ? this._t("stRowOk") : n === 1 ? this._t("stRowProblem1") : this._t("stRowProblems", { count: n });
    const ago = d.last ? this._t("stRowAgo", { ago: this.host._fmtAgo(d.last) }) : "";
    const tone = n ? (this.problems().some((p) => this._red(p)) ? "err" : "warn") : "ok";
    return `<button class="ag-row ag-rowbtn ag-st-row" data-st="open"><span class="ag-mini ${tone}">${ic("stethoscope", 16)}</span><span class="ag-grow">${esc(label)}${ago ? `<small class="ag-t2 ag-block">${esc(ago)}</small>` : ""}</span><span class="ag-cbtn">${ic("chevRight", 16)}</span></button>`;
  }

  // Hälfte der unteren Zeile der Statuskachel, wenn HealthCheck-Dienste eingerichtet sind (1.68.0, Wunsch des Nutzers 2026-11-19, 18:36): links der
  // Selbsttest, rechts die Dienste, je mit farbigem Symbol; die Kachel wird dadurch nicht höher. Die Zeit der Prüfung steht im Tooltip.
  tileHalf() {
    const d = this.data;
    if (!d) return "";
    const n = this.problems().length;
    const state = !d.last && !n ? this._t("stHalfNone") : n === 0 ? this._t("stHalfOk") : n === 1 ? this._t("stHalfProblem1") : this._t("stHalfProblems", { count: n });
    const full = !d.last && !n ? this._t("stRowNone") : n === 0 ? this._t("stRowOk") : n === 1 ? this._t("stRowProblem1") : this._t("stRowProblems", { count: n });
    const ago = d.last ? this._t("stRowAgo", { ago: this.host._fmtAgo(d.last) }) : "";
    const tone = n ? (this.problems().some((p) => this._red(p)) ? "err" : "warn") : d.last ? "ok" : "";
    return `<button class="ag-row ag-rowbtn ag-st-row ag-half" data-st="open" data-half="selftest" title="${esc([full, ago].filter(Boolean).join(" · "))}"><span class="ag-mini ${tone}">${ic("stethoscope", 16)}</span>
      <span class="ag-grow"><span class="ag-half-t">${esc(this._t("stHalfTitle"))}</span><small class="ag-t2 ag-block">${esc(state)}</small></span><span class="ag-cbtn">${ic("chevRight", 16)}</span></button>`;
  }

  // ----- Fenster -----

  open() {
    const dlg = this.dlg;
    // Mit wenigen Befunden sind sie aufgeklappt; sonst nur der erste (die übrigen per Klick)
    if (!dlg.open) {
      const list = this.problems();
      this.opened = new Set(list.length <= 2 ? list.map((p) => p.key) : list.slice(0, 1).map((p) => p.key));
    }
    this.render(true);
    if (!dlg.open) dlg.showModal();
  }

  render(force = false) {
    const dlg = this.dlg;
    if (!dlg || (!dlg.open && !force)) return;
    const d = this.data;
    const list = this.problems();
    const meta = !d?.last ? this._t("stNever")
      : [this._t("stLast", { time: this._when(d.last) }), d.next ? this._t("stNext", { time: this._when(d.next) }) : "", `${this._every(d.minutes)}${d.armed ? ` (${this._t("stArmedNow")})` : ""}`].filter(Boolean).join(" · ");
    // Runder Pfeil zur Liste "Geprüft" (Wunsch des Nutzers 2026-11-19): ohne Befunde in der Karte "Keine Probleme", mit Befunden als eigene Karte
    const go = d?.last ? `<button type="button" class="ag-cbtn ag-st-checkedgo" data-st="checked-open" aria-label="${esc(this._t("stCheckedOpen"))}" title="${esc(this._t("stCheckedOpen"))}">${ic("chevRight", 16)}</button>` : "";
    const okCard = `<div class="ag-card ag-st-ok"><span class="ag-mini ok">${ic("check", 18)}</span><div class="ag-grow"><b>${esc(this._t("stOkTitle"))}</b><small class="ag-t2 ag-block">${esc(this._t("stOkText"))}</small>${d?.checked ? `<small class="ag-t2 ag-block">${esc(this._t("stCheckedRow", { count: d.checked }))}</small>` : ""}</div>${go}</div>`;
    const checkedCard = d?.last ? `<div class="ag-card ag-st-ok ag-st-checkedrow"><span class="ag-mini">${ic("check", 18)}</span><div class="ag-grow"><b>${esc(this._t("stCheckedRow", { count: d.checked || 0 }))}</b><small class="ag-t2 ag-block">${esc(this._t("stCheckedHint"))}</small></div>${go}</div>` : "";
    const body = list.length ? `${this._groups(list)}${checkedCard}` : okCard;
    const about = `<details class="ag-st-about"><summary>${ic("info", 16)}<span>${esc(this._t("stAbout"))}</span></summary>${this._lines(this._t("stAboutText"))}<p class="ag-t2 ag-small">${esc(this._t("stWhen", { every: this._every(d?.minutes_disarmed || d?.minutes || 360), armed: this._every(d?.minutes_armed || 60) }))}</p></details>`;
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-st-pop"><div class="ag-pop-head">${iconTitle("stethoscope", `ag-st-av ${this.tone()}`, this._t("stTitle"))}<div class="ag-t2 ag-small ag-st-meta">${esc(meta)}</div></div>
      <div class="ag-st-list">${body}${about}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-st="close">${esc(this._t("close"))}</button><button class="ag-btn primary" data-st="run" ${this.busy ? "disabled" : ""}>${ic("refresh", 18)}${esc(this._t("stRun"))}</button></div></div>`);
  }

  // Abstand in Worten (seit 1.67.0 in Minuten): ganze Stunden als Stunden, sonst Minuten
  _every(minutes) {
    const m = Number.isInteger(minutes) && minutes > 0 ? minutes : 360;
    if (m % 60) return this._t("stEveryMin", { minutes: m });
    return m === 60 ? this._t("stEvery1") : this._t("stEvery", { hours: m / 60 });
  }

  // Datum und Zeit in der Sprache des Panels (heute nur die Zeit)
  _when(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const locale = this.host._hass?.locale?.language || this.host._lang;
    const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })} ${time}`;
  }

  _lines(text, ordered = false) {
    const items = String(text || "").split("\n").filter(Boolean).map((line) => `<li>${esc(line)}</li>`).join("");
    return ordered ? `<ol class="ag-st-ul">${items}</ol>` : `<ul class="ag-st-ul">${items}</ul>`;
  }

  // Befunde je Anlage (in der Reihenfolge des Servers), die gemeinsamen zuletzt unter "Alle Anlagen"
  _groups(list) {
    const groups = new Map();
    for (const p of list) {
      const key = p.entry_id || "*";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const several = groups.size > 1 || this.host._systems().length > 1;
    return [...groups.entries()].map(([key, items]) => {
      const title = key === "*" ? this._t("stAll") : this.host._system(key)?.title || key;
      return `${several || key === "*" ? `<div class="ag-st-group">${ic(key === "*" ? "groups" : "shield", 16)}<span>${esc(title)}</span></div>` : ""}${items.map((p) => this._item(p)).join("")}`;
    }).join("");
  }

  _red(p) {
    if (RED_CODES.has(p.code)) return true;
    if (p.code === "entity_missing" && p.role === "sensor") return true;
    if (p.code === "start_failed") return true;
    // Was den Alarm selbst betrifft (nicht im Test)
    return ["entity_missing", "entity_unavailable", "step_failed", "healthcheck_missing"].includes(p.code) && (p.places || []).some((x) => x.list === "alarm" && !x.test);
  }

  _name(p) {
    if (p.entity_id) return this.host._name(p.entity_id);
    if (p.code === "start_failed") return this._t(`stPart_${p.part}`);
    return p.name || p.subject || "";
  }

  _vars(p) {
    const targets = (p.targets || []).map((id) => this.host._name(id)).join(", ");
    return {
      name: this._name(p), entity: p.entity_id || "", service: p.service || p.subject || "", sound: p.sound || "", label: p.label || p.subject || "",
      part: p.code === "start_failed" ? this._t(`stPart_${p.part}`) : "", since: p.since ? this._when(p.since) : "", targets: targets ? this._t("stTargets", { list: targets }) : "",
    };
  }

  // Textschlüssel eines Befunds: "Antwortet nicht" ist ein eigener Fall von "gescheitert"
  _code(p) {
    return p.code === "step_failed" && p.reason === "timeout" ? "step_timeout" : p.code;
  }

  _item(p) {
    const code = this._code(p);
    const vars = this._vars(p);
    const open = this.opened.has(p.key);
    const tone = this._red(p) ? "err" : "warn";
    const icon = { entity_missing: "close", entity_unavailable: "offline", service_missing: "script", recipient_missing: "bell", no_recipients: "bellOff", sound_missing: "tone",
      no_url: "speaker", rule_damaged: "alert", system_not_loaded: "shieldOff", step_failed: "alert", healthcheck_missing: "heartPulse", step_hung: "timer", notify_failed: "bellOff", start_failed: "powerOff", backup_failed: "archive", ping_failed: "heartPulse" }[p.code] || "alert";
    const head = `<button type="button" class="ag-st-head" data-st="toggle" data-key="${esc(p.key)}" aria-expanded="${open}"><span class="ag-mini ${tone}">${ic(icon, 16)}</span>
      <span class="ag-grow"><b>${esc(this._t(`stT_${code}`, vars))}</b><small class="ag-t2 ag-block">${esc(this._t(`stKind_${p.kind}`))}${p.kind === "runtime" ? ` · ${esc(this._t("stLastSeen", { time: this._when(p.last) }))}` : ""}</small></span>
      <span class="ag-st-chev ${open ? "open" : ""}">${ic("chevRight", 16)}</span></button>`;
    if (!open) return `<div class="ag-card ag-st-item ${tone}" data-st-key="${esc(p.key)}">${head}</div>`;
    let what = this._t(`stW_${code}`, vars);
    if (p.code === "entity_missing" && p.reason) what += ` ${this._t(`stR_${p.reason}`)}`;
    // Lebenszeichen (HealthCheck): was der Dienst geantwortet hat; nur Host und Statuscode, nie die Adresse (sie ist das Geheimnis des Eintrags)
    if (p.code === "ping_failed" && ["http", "timeout", "error"].includes(p.reason)) what += ` ${this._t(`stR_ping_${p.reason}`, { code: p.label || "?" })}`;
    if (p.kind === "runtime") {
      what += ` (${[this._t("stFirst", { time: this._when(p.first) }), p.count > 1 ? this._t("stTimes", { count: p.count }) : ""].filter(Boolean).join(", ")})`;
    }
    const impact = this._t(p.role && ["entity_missing", "entity_unavailable"].includes(p.code) ? `stI_${p.role}` : `stI_${p.code === "step_failed" ? "step_failed" : p.code}`);
    const causeKey = code === "step_timeout" ? "stC_step_timeout" : `stC_${p.code}`;
    const fixKey = code === "step_timeout" ? "stF_step_timeout" : `stF_${p.code}`;
    const places = (p.places || []).map((place, i) => {
      const go = this._target(p, place);
      return `<li><span>${esc(this._placeText(p, place))}</span>${go ? `<button type="button" class="ag-link ag-st-go" data-st="go" data-key="${esc(p.key)}" data-place="${i}">${esc(this._t("stGo"))}${ic("chevRight", 14)}</button>` : ""}</li>`;
    }).join("");
    const homeGo = !places && p.code === "system_not_loaded" ? `<button type="button" class="ag-link ag-st-go" data-st="go-integration">${esc(this._t("stGo"))}${ic("chevRight", 14)}</button>` : "";
    const sec = (title, html) => `<div class="ag-st-sec"><div class="ag-st-sect">${esc(title)}</div>${html}</div>`;
    const foot = p.kind === "runtime"
      ? `<div class="ag-st-foot"><small class="ag-t2">${esc(this._t("stDismissHint"))}</small><button class="ag-btn" data-st="dismiss" data-key="${esc(p.key)}">${ic("check", 18)}${esc(this._t("stDismiss"))}</button></div>`
      : `<div class="ag-st-foot"><small class="ag-t2">${esc(this._t("stConfigHint"))}</small></div>`;
    return `<div class="ag-card ag-st-item ${tone} open" data-st-key="${esc(p.key)}">${head}<div class="ag-st-body">
      ${sec(this._t("stSecWhat"), `<p>${esc(what)}</p>`)}
      ${places || homeGo ? sec(this._t("stSecWhere"), places ? `<ul class="ag-st-places">${places}</ul>` : homeGo) : ""}
      ${sec(this._t("stSecImpact"), `<p>${esc(impact)}</p>`)}
      ${sec(this._t("stSecWhy"), this._lines(this._t(causeKey)))}
      ${sec(this._t("stSecFix"), this._lines(this._t(fixKey), true))}
      ${foot}</div></div>`;
  }

  _trigger(trigger) {
    return trigger === "always" ? this._t("wfAlways") : this._t(MODE_KEY[trigger] || "modeAway");
  }

  // Fundstelle in Worten, wie die Wege im Panel: "Haus › Aktionen › Abwesend › Bei einem Alarm › Schritt 2"
  _placeText(p, place) {
    const system = p.entry_id ? this.host._system(p.entry_id)?.title || "" : "";
    const step = place.step ? (place.sub ? this._t("stP_sub", { step: place.step, sub: place.sub }) : this._t("stP_step", { step: place.step })) : "";
    let parts;
    if (place.area === "workflow") parts = [system, this._t("stP_actions"), this._trigger(place.trigger), this._t(`stL_${place.list}`), step];
    else if (place.area === "end") parts = [system, this._t("stP_actions"), this._trigger(place.trigger), this._t("stP_end")];
    else if (place.area === "event") parts = [system, this._t("stP_actions"), this._trigger(place.trigger), this._t("stP_event", { kind: this._t(`ntT_${place.kind}`) })];
    else if (place.area === "monitor") parts = [system, this._t("stP_monitor", { name: place.name || "" }), place.flow ? this._t(`stP_${place.flow}`) : "", step, place.test ? this._t("stP_test") : ""];
    else if (place.area === "routine") parts = [system, this._t("stP_routine", { name: place.name || "" })];
    else if (place.area === "sensors") parts = [system, this._t(place.monitor ? "stP_monitorSensors" : "stP_sensors")];
    else if (place.area === "notify") {
      const what = place.group ? this._t(place.group === "alarm" ? "stP_alarmGroup" : "stP_maintGroup") : this._t(`ntT_${place.type}`);
      parts = [this._t("stP_notify"), what, place.mode ? this._t(MODE_KEY[place.mode] || "modeAway") : ""];
    } else if (place.area === "healthcheck") parts = [this._t("stP_healthcheck"), p.name || p.service || ""];
    else if (place.area === "run") parts = [system, this._t("stP_actions"), place.trigger ? this._trigger(place.trigger) : "", this._t(`stL_${place.list}`), place.test ? this._t("stP_test") : ""];
    else parts = [system];
    return parts.filter(Boolean).join(" › ");
  }

  // Wohin "Öffnen" führt; null, wo es im Panel keine Stelle gibt
  _target(p, place) {
    const entry = p.entry_id;
    if (["workflow", "end", "event", "run"].includes(place.area) && entry && this.host._system(entry)) return { kind: "actions", entry, trigger: place.trigger };
    if (place.area === "monitor" && entry && place.id) return { kind: "monitor", entry, id: place.id };
    if (place.area === "routine" && entry) return { kind: "routines", entry };
    if (place.area === "sensors" && entry) return { kind: "sensors", entry };
    if (place.area === "notify") return { kind: "notify" };
    if (place.area === "healthcheck") return { kind: "healthcheck" };
    return null;
  }

  _go(target) {
    const h = this.host;
    this.dlg?.close();
    if (target.kind === "monitor") return h.openMonitorRule(target.entry, target.id);
    h.openPlace(target.kind, target.entry, target.trigger);
  }

  // ----- Liste "Geprüft" (Wunsch des Nutzers 2026-11-19): alles, was die letzte Prüfung angeschaut hat, grün, was in Ordnung ist -----

  async openChecked() {
    const dlg = this.checkedDlg;
    this.checkedQ = "";
    this.checked = null;
    this.renderChecked(true);
    if (!dlg.open) dlg.showModal();
    try {
      this.checked = await this.host._hass.callWS({ type: "alarmageddon/selftest_checked" });
    } catch (err) {
      this.checked = { last: null, items: [], error: errText(err) };
    }
    this.renderChecked(true);
  }

  _checkedRows() {
    const t = (k, v) => this._t(k, v);
    const c = this.checked;
    if (!c) return `<div class="ag-card ag-popempty"><span class="ag-t2">…</span></div>`;
    if (c.error) return `<div class="ag-card ag-popempty"><span class="ag-err">${esc(t("errGeneric", { message: c.error }))}</span></div>`;
    if (!c.items.length) return `<div class="ag-card ag-rtempty"><span class="ag-t2">${esc(t("stCheckedEmpty"))}</span></div>`;
    const several = this.host._systems().length > 1;
    const systems = (i) => (several ? i.entries.map((e) => this.host._system(e)?.title).filter(Boolean).join(", ") : "");
    const shown = c.items.filter((i) => matchQuery(this.checkedQ, i.name, i.id, systems(i), t(`stG_${i.type === "entity" ? i.role || "output" : i.type}`)));
    if (!shown.length) return `<div class="ag-card ag-popempty"><span class="ag-t2">${esc(t("stCheckedNoMatch"))}</span></div>`;
    const collator = new Intl.Collator(this.host._lang || "en", { numeric: true, sensitivity: "base" });
    return CHECKED_GROUPS.map(([type, role]) => {
      const items = shown.filter((i) => i.type === type && (type !== "entity" || (i.role || "output") === (role || "output"))).sort((a, b) => collator.compare(a.name, b.name));
      if (!items.length) return "";
      const rows = items.map((i) => {
        const sys = systems(i);
        const sub = [i.type === "entity" || i.name !== i.id ? i.id : "", sys].filter(Boolean).join(" · ");
        return `<div class="ag-st-chk ${i.ok ? "ok" : "bad"}" data-chk="${esc(`${i.type}|${i.id}`)}"><span class="ag-mini ${i.ok ? "ok" : "err"}" title="${esc(t(i.ok ? "stCheckedOk" : "stCheckedBad"))}" aria-label="${esc(t(i.ok ? "stCheckedOk" : "stCheckedBad"))}">${ic(i.ok ? "check" : "alert", 16)}</span>
          <div class="ag-grow"><b>${esc(i.name)}</b>${sub ? `<small class="ag-t2 ag-block">${esc(sub)}</small>` : ""}</div></div>`;
      }).join("");
      const label = t(`stG_${type === "entity" ? role : type}`);
      return `<div class="ag-st-group">${esc(label)} <span class="ag-t2">${items.length}</span></div><div class="ag-card ag-st-chklist">${rows}</div>`;
    }).join("");
  }

  renderChecked(force = false) {
    const dlg = this.checkedDlg;
    if (!dlg || (!dlg.open && !force)) return;
    const body = dlg.querySelector(".ag-st-chkbody");
    if (body && !force) {
      this.host._setHtml(body, this._checkedRows());
      return;
    }
    const c = this.checked;
    const meta = c?.last ? this._t("stCheckedMeta", { time: this._when(c.last), count: c.items.length }) : "";
    const okCount = c?.items?.filter((i) => i.ok).length ?? 0;
    const sum = c?.items?.length ? `<div class="ag-t2 ag-small">${esc(this._t("stCheckedSum", { ok: okCount, count: c.items.length }))}</div>` : "";
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-st-chkpop"><div class="ag-pop-head">${iconTitle("stethoscope", `ag-st-av ${this.tone()}`, this._t("stCheckedTitle"))}
      ${meta ? `<div class="ag-t2 ag-small">${esc(meta)}</div>` : ""}
      <div class="ag-tools ag-pop-tools" ${c?.items?.length ? "" : "hidden"}>${searchField("data-st", "checked-search", this.checkedQ, this._t("stCheckedSearch"), this._t("clearSearch"))}</div></div>
      <div class="ag-st-chkbody">${sum}${this._checkedRows()}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-st="checked-close">${esc(this._t("close"))}</button></div></div>`);
  }

  onInput(el) {
    if (el?.dataset?.st !== "checked-search") return false;
    this.checkedQ = el.value;
    const clear = this.checkedDlg?.querySelector('[data-st="checked-search-clear"]');
    if (clear) clear.hidden = !this.checkedQ;
    const body = this.checkedDlg?.querySelector(".ag-st-chkbody");
    if (body) {
      const okCount = this.checked?.items?.filter((i) => i.ok).length ?? 0;
      const sum = this.checked?.items?.length ? `<div class="ag-t2 ag-small">${esc(this._t("stCheckedSum", { ok: okCount, count: this.checked.items.length }))}</div>` : "";
      this.host._setHtml(body, `${sum}${this._checkedRows()}`);
    }
    return true;
  }

  // ----- Server -----

  async run() {
    const h = this.host;
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/selftest_run" });
      if (h._data && res?.selftest) h._data.selftest = res.selftest;
      const n = this.problems().length;
      h._toast(n === 0 ? this._t("stRunDone0") : n === 1 ? this._t("stRunDone1") : this._t("stRunDoneN", { count: n }));
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
    } finally {
      this.busy = false;
      this.render();
      if (h._view) h._renderView(false);
    }
  }

  async dismiss(key) {
    const h = this.host;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/selftest_dismiss", key });
      if (h._data && res?.selftest) h._data.selftest = res.selftest;
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
    }
    this.render();
    if (h._view) h._renderView(false);
  }

  onClick(el) {
    const act = el?.dataset.st;
    if (!act) return false;
    if (act === "open") this.open();
    else if (act === "close") this.dlg?.close();
    else if (act === "checked-open") this.openChecked();
    else if (act === "checked-close") this.checkedDlg?.close();
    else if (act === "checked-search") return true;
    else if (act === "checked-search-clear") {
      const input = el.closest(".list-search")?.querySelector("input");
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
    }
    else if (act === "run") this.run();
    else if (act === "toggle") {
      const key = el.dataset.key;
      if (this.opened.has(key)) this.opened.delete(key);
      else this.opened.add(key);
      this.render();
    } else if (act === "dismiss") this.dismiss(el.dataset.key);
    else if (act === "go") {
      const p = this.problems().find((x) => x.key === el.dataset.key);
      const place = p?.places?.[Number(el.dataset.place)];
      const target = p && place ? this._target(p, place) : null;
      if (target) this._go(target);
    } else if (act === "go-integration") {
      this.dlg?.close();
      this.host._navigate("/config/integrations/integration/alarmageddon");
    } else return false;
    return true;
  }
}
