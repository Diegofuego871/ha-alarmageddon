// Selbsttest (1.65.0, Wunsch des Nutzers 2026-11-18): Zeile in der Statuskachel der Übersicht (immer, mit der Zeit der letzten Prüfung) und ein
// Fenster mit allen Befunden. Zu jedem Befund: was los ist, wo, was es bedeutet, mögliche Ursachen und wie man es behebt (Hilfe so ausführlich
// wie möglich), dazu "Öffnen" (springt an die Stelle) und bei Befunden der Laufzeit "Erledigt". "Jetzt prüfen" prüft sofort.
// Die Befunde kommen vom Server (selftest.py) nur als Kennungen und Namen; die Texte stehen hier (strings.js), wie überall im Panel.
const V = new URL(import.meta.url).search;
const { ic, esc, errText, MODE_KEY } = await import(`./common.js${V}`);

// Befunde, die einen Alarm verhindern oder stumm machen können: rot statt gelb
const RED_CODES = new Set(["system_not_loaded", "start_failed", "no_recipients", "no_url"]);

export class SelfTestUi {
  constructor(host) {
    this.host = host;
    this.opened = new Set(); // aufgeklappte Befunde (Schlüssel)
    this.busy = false;
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

  problems() {
    return this.data?.problems || [];
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
      : [this._t("stLast", { time: this._when(d.last) }), d.next ? this._t("stNext", { time: this._when(d.next) }) : "", this._every(d.hours)].filter(Boolean).join(" · ");
    const body = list.length ? this._groups(list) : `<div class="ag-card ag-st-ok"><span class="ag-mini ok">${ic("check", 18)}</span><div><b>${esc(this._t("stOkTitle"))}</b><small class="ag-t2 ag-block">${esc(this._t("stOkText"))}</small></div></div>`;
    const about = `<details class="ag-st-about"><summary>${ic("info", 16)}<span>${esc(this._t("stAbout"))}</span></summary>${this._lines(this._t("stAboutText"))}<p class="ag-t2 ag-small">${esc(this._t("stWhen", { every: this._every(d?.hours || 6) }))}</p></details>`;
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-st-pop"><div class="ag-pop-head"><h3>${ic("stethoscope", 20)}<span>${esc(this._t("stTitle"))}</span></h3><div class="ag-t2 ag-small ag-st-meta">${esc(meta)}</div></div>
      <div class="ag-st-list">${body}${about}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-st="run" ${this.busy ? "disabled" : ""}>${ic("refresh", 18)}${esc(this._t("stRun"))}</button><span class="ag-grow"></span><button class="ag-btn primary" data-st="close">${esc(this._t("close"))}</button></div></div>`);
  }

  _every(hours) {
    return hours === 1 ? this._t("stEvery1") : this._t("stEvery", { hours: hours || 6 });
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
    return ["entity_missing", "entity_unavailable", "step_failed"].includes(p.code) && (p.places || []).some((x) => x.list === "alarm" && !x.test);
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
      no_url: "speaker", rule_damaged: "alert", system_not_loaded: "shieldOff", step_failed: "alert", step_hung: "timer", notify_failed: "bellOff", start_failed: "powerOff", backup_failed: "archive", ping_failed: "heartPulse" }[p.code] || "alert";
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
    } else if (place.area === "healthcheck") parts = [this._t("stP_healthcheck"), p.service || ""];
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
