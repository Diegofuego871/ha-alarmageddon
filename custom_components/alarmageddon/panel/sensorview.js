// Sensoransicht (1.9.0): öffnet sich beim Klick auf einen Sensor der Übersicht. Reine Übersicht, keine Einstellungen.
// Oben fest: Kopf (mit "In HA öffnen"), Kacheln als Reiter (Verlauf, Batterie, Empfang, Gerät), Zeitraum, Kennzahlen, Grafik.
// Darunter scrollt nur die Liste. Desktop: Fenster in der Breite der Voreinstellungen; Handy: ganzer Bildschirm.
// Sensoren der Überwachung (1.65.0, Wunsch des Nutzers): über der Liste die Reiter "Ereignisse" und "Regeln" (die Regeln der Überwachung, in denen
// der Sensor vorkommt), je mit Suche und sortierbarer Tabelle; der Pfeil einer Regel führt zu ihr in Konfiguration › Aktionen › Überwachung.
// Benennung wie überall im Panel "Regeln" (Entscheid des Nutzers, 2026-11-18, 19:47; eine erste Fassung hiess dort "Aktionen").
// Die Daten kommen ausgewertet vom Server (sensor_history.py); hier wird nur gezeichnet.
const V = new URL(import.meta.url).search;
const { DC, MODE_ICON, MODE_KEY, TYPES, copyBtn, copyValue, errText, esc, ic, matchQuery, searchField } = await import(`./common.js${V}`);
const { loaderHtml, loaderStart } = await import(`./loader.js${V}`);
const { normMonitor } = await import(`./monitor.js${V}`);

const RANGES = { state: [3, 12, 24, 168, 720], value: [3, 12, 24, 168, 720], signal: [3, 12, 24, 168, 720], battery: [720, 2160, 8760] };
const RANGE_LABEL = { 3: "svR3h", 12: "svR12h", 24: "svR1d", 168: "svR7d", 720: "svR30d", 2160: "svR90d", 8760: "svR1y" };
const TAB_ICON = { state: "history", value: "history", battery: "battery", signal: "signal", device: "chip" };
const MODES = ["home", "away", "night"];
const HOUR = 3600000;
// Reiter unter der Grafik (1.65.0): Standard-Sortierung je Reiter; Zustand einer Regel der Überwachung in dieser Reihenfolge
const SORT_DEFAULT = { events: { key: "time", dir: "desc" }, rules: { key: "name", dir: "asc" } };
const STATE_ORDER = { out: 0, on: 1, off: 2 };
const cmp = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" }));

export class SensorView {
  constructor(host) {
    this.host = host;
    this.id = null;
    this.tab = "state";
    this.hours = { state: 24, value: 24, signal: 168, battery: 2160 };
    this.data = null;
    this.loading = false;
    this.error = null;
    this.seq = 0;
    this.resetList();
  }

  // Reiter, Suche und Sortierung der Liste: je Sensor neu (1.65.0)
  resetList() {
    this.pane = "events";
    this.lq = { events: "", rules: "" };
    this.lsort = { events: { ...SORT_DEFAULT.events }, rules: { ...SORT_DEFAULT.rules } };
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get dlg() {
    return this.host._root.getElementById("ag-sensor");
  }

  get narrow() {
    return this.host.hasAttribute("narrow");
  }

  info() {
    return this.host._sensor(this.id) || {};
  }

  // Messwert-Sensor (Temperatur, Luftfeuchtigkeit, CO2): Reiter "Verlauf" zeigt den Werteverlauf statt der Öffnungen
  get measure() {
    return this.info().type === "measure";
  }

  // Eine Regel der Überwachung ist für diesen Sensor gerade "ausserhalb"
  _alarmActive() {
    return this.host._systems().some((sys) => Object.values(sys.monitor_active || {}).some((a) => a?.entity_id === this.id));
  }

  _valueText(value, unit) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "–";
    const num = Number(value).toLocaleString(this._locale(), { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1 });
    return `${num}${unit ? ` ${unit}` : ""}`;
  }

  // Art der Darstellung: "open" (Tür, Fenster), "motion" (Bewegung, Belegung), sonst "alert" (Rauch, Wasser, Sabotage …)
  flavor() {
    const info = this.info();
    if (info.type === "measure") return "value";
    if (info.type === "door" || info.type === "window") return "open";
    if (info.type === "motion") return "motion";
    return "alert";
  }

  tabs() {
    const info = this.info();
    return [this.measure ? "value" : "state", ...(info.battery ? ["battery"] : []), ...(info.signal || info.signal_live ? ["signal"] : []), "device"];
  }

  open(id) {
    if (id !== this.id) this.resetList();
    this.id = id;
    this.tab = this.measure ? "value" : "state";
    this.data = null;
    this.error = null;
    this.render();
    if (!this._bound) {
      // Schliessen (X, Esc): späte Antworten gehören nicht mehr zu einer offenen Ansicht
      this._bound = true;
      this.dlg.addEventListener("close", () => {
        this.seq++;
        this.id = null;
      });
    }
    if (!this.dlg.open) this.dlg.showModal();
    this.load();
  }

  close() {
    this.seq++;
    if (this.dlg.open) this.dlg.close();
    this.id = null;
  }

  async load() {
    if (!this.id || this.tab === "device") return;
    const seq = ++this.seq;
    this.loading = true;
    this.error = null;
    this.render();
    try {
      const res = await this.host._hass.callWS({ type: "alarmageddon/sensor_history", entity_id: this.id, kind: this.tab, hours: this.hours[this.tab] });
      if (seq !== this.seq) return;
      this.data = res;
    } catch (err) {
      if (seq !== this.seq) return;
      this.data = null;
      this.error = errText(err);
    }
    this.loading = false;
    this.render();
  }

  onClick(el) {
    const act = el.dataset.sv;
    if (act === "tab") {
      if (el.dataset.tab === this.tab) return true;
      this.tab = el.dataset.tab;
      this.data = null;
      this.render();
      this.load();
    } else if (act === "copy") {
      copyValue(el, this.host._root.ownerDocument);
    } else if (act === "pane") {
      if (el.dataset.pane === this.pane) return true;
      this.pane = el.dataset.pane;
      this.render();
    } else if (act === "lsort") {
      const cur = this.lsort[this.pane];
      const key = el.dataset.key;
      this.lsort[this.pane] = { key, dir: cur.key === key ? (cur.dir === "asc" ? "desc" : "asc") : key === "time" ? "desc" : "asc" };
      this._renderRows();
    } else if (act === "lq-clear") {
      const input = this.dlg.querySelector('[data-sv="lq"]');
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    } else if (act === "rule") {
      // Zur Regel der Überwachung: Fenster zu, die Anlage der Regel (offene Änderungen fragen vorher), aufgeklappt in der Liste
      if (el.disabled) return true;
      const { entry, rule } = el.dataset;
      this.close();
      this.host.openMonitorRule(entry, rule);
    } else if (act === "range") {
      this.hours[this.tab] = Number(el.dataset.hours);
      this.load();
    } else if (act === "ha") {
      this.host._moreInfo(this.id);
    } else if (act === "retry") {
      this.load();
    } else if (act === "alarm") {
      // Zum Alarm im Protokoll: Fenster zu, Reiter "Protokoll", diesen Alarm aufgeklappt
      const id = el.dataset.id;
      this.close();
      this.host.log.touched = true;
      this.host.log.open = new Set([id]);
      this.host.log.pane = "alarms";
      this.host._root.querySelector('[data-tab="log"]')?.click();
    } else if (act === "config") {
      const id = this.id;
      this.close();
      this.host._root.querySelector('[data-tab="config"]')?.click();
      window.requestAnimationFrame(() => {
        this.host._root.querySelector('[data-sub="sensors"]')?.click();
        window.requestAnimationFrame(() => this.host._root.querySelector(`[data-sen="detail"][data-ent="${CSS.escape(id)}"]`)?.click());
      });
    } else return false;
    return true;
  }

  // ----- Formate -----

  _locale() {
    return this.host._hass?.locale?.language || this.host._lang;
  }

  _clock(iso) {
    return new Date(iso).toLocaleTimeString(this._locale(), { hour: "2-digit", minute: "2-digit" });
  }

  _dur(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s} s`;
    if (s < 3600) return `${Math.floor(s / 60)} min${s < 600 && s % 60 ? ` ${s % 60} s` : ""}`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
    return `${Math.floor(s / 86400)} d ${Math.round((s % 86400) / 3600)} h`;
  }

  _dayLabel(date) {
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return this._t("svToday");
    if (date.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return this._t("yesterday");
    return date.toLocaleDateString(this._locale(), { weekday: "long", day: "numeric", month: "long" });
  }

  _shortDay(date) {
    return date.toLocaleDateString(this._locale(), { weekday: "short", day: "numeric" });
  }

  _stateText() {
    const st = this.host._state(this.id);
    if (!st || st.state === "unavailable" || st.state === "unknown") return [this._t("svGone"), "off"];
    if (this.measure) return [this._valueText(st.state, this.info().unit || st.attributes?.unit_of_measurement), this._alarmActive() ? "act" : ""];
    const flavor = this.flavor();
    if (st.state === "on") return [this._t(flavor === "open" ? "svOpen" : flavor === "motion" ? "svActive" : "svTrig"), "act"];
    return [this._t(flavor === "open" ? "svClosed" : flavor === "motion" ? "svCalm" : "svOk"), ""];
  }

  // ----- Rahmen -----

  render() {
    const dlg = this.dlg;
    if (!dlg || !this.id) return;
    const info = this.info();
    const [stateText, stateCls] = this._stateText();
    const [icon] = DC[info.device_class] || ["sensor"];
    const typeKey = TYPES.find(([k]) => k === (info.type || "other"))?.[2];
    const sub = [typeKey ? this._t(typeKey) : "", info.area, info.integration || info.platform].filter(Boolean).join(" · ");
    const st = this.host._state(this.id);
    const tileValue = {
      value: () => stateText,
      state: () => `${stateText}${st?.last_changed ? ` ${this._t("since", { time: this.host._fmtTime(st.last_changed) })}` : ""}`,
      battery: () => this._entityValue(info.battery, "%"),
      signal: () => (info.signal_live ? this._liveValue(info.signal_live) : this._entityValue(info.signal, "")),
      device: () => [info.manufacturer, info.model].filter(Boolean).join(" ") || this._t("svDeviceNone"),
    };
    const tiles = this.tabs().map((tab) => `<button type="button" class="ag-sv-tile ${tab === this.tab ? "on" : ""}" data-sv="tab" data-tab="${tab}" role="tab" aria-selected="${tab === this.tab}">
        <span class="ag-sv-ti">${ic(TAB_ICON[tab], 22)}</span><span class="ag-sv-tx"><small>${esc(this._t(`svTab_${tab}`))}</small><b>${esc(tileValue[tab]())}</b></span></button>`).join("");
    const body = this.tab === "device" ? this._deviceHtml() : this._tabHtml();
    this.host._setHtml(dlg, `<div class="ag-sv" data-flavor="${this.flavor()}" ${body.busy ? "data-busy" : ""}>
      <div class="ag-sv-fix">
        <div class="ag-sv-head"><span class="ag-av ${stateCls === "act" ? "open" : stateCls === "off" ? "missing" : ""}">${ic(icon, 22)}</span>
          <div class="ag-sv-ttl"><b>${esc(info.name || this.id)}</b><small>${esc(sub)}</small></div>
          <span class="ag-sv-pill ${stateCls}">${esc(stateText)}</span>
          <button type="button" class="ag-btn ag-sv-ha" data-sv="ha">${ic("external", 18)}${esc(this._t("svOpenHa"))}</button></div>
        <div class="ag-seg ag-sv-tiles n${this.tabs().length}" data-seg="sv-tabs" role="tablist">${tiles}</div>
        ${body.fix}
      </div>
      <div class="ag-sv-list">${body.list}</div></div>`);
    if (body.busy) loaderStart(this.host._root, this.host);
    // Die Reiter oben sind eine gewöhnliche Reiterleiste mit gleitender Kapsel wie im ganzen Panel: das Panel setzt die Kapsel
    this.host._placePills?.();
  }

  // Empfang von ZHA oder Bluetooth: der Wert kommt vom Server (1.41.0)
  _liveValue(live) {
    return live.value === null || live.value === undefined ? "–" : `${Math.round(live.value)} ${live.kind === "dbm" ? "dBm" : "LQI"}`;
  }

  _entityValue(entityId, fallbackUnit) {
    const st = entityId ? this.host._hass?.states?.[entityId] : null;
    if (!st || st.state === "unavailable" || st.state === "unknown") return "–";
    const unit = st.attributes?.unit_of_measurement || fallbackUnit;
    return `${Number.isFinite(Number(st.state)) ? Math.round(Number(st.state)) : st.state}${unit ? ` ${unit}` : ""}`;
  }

  _rangeSeg() {
    const cur = this.hours[this.tab];
    // Eigene, ruhende Leiste (nicht .ag-seg): deren wandernde Kapsel wird vom Panel vermessen und passt nicht in ein Fenster, das neu zeichnet
    return `<div class="ag-sv-seg ag-sv-range" role="group">${RANGES[this.tab].map((h) => `<button type="button" data-sv="range" data-hours="${h}" class="${h === cur ? "on" : ""}" aria-pressed="${h === cur}">${esc(this._t(RANGE_LABEL[h]))}</button>`).join("")}</div>`;
  }

  _kpis(items) {
    return `<div class="ag-sv-kpis">${items.filter(Boolean).map(([value, label]) => `<div class="ag-sv-kpi"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join("")}</div>`;
  }

  _legend(items) {
    return `<div class="ag-sv-legend">${items.map(([cls, label]) => `<span><i class="${cls}"></i>${esc(label)}</span>`).join("")}</div>`;
  }

  _tabHtml() {
    const seg = this._rangeSeg();
    if (this.error) return { fix: `${seg}<div class="ag-sv-msg">${esc(this._t("svError"))} <span class="ag-t2">${esc(this.error)}</span><br><button type="button" class="ag-btn" data-sv="retry">${esc(this._t("svRetry"))}</button></div>`, list: "" };
    const d = this.data;
    // Laden (1.13.2): dieselbe Ladeanzeige wie im ganzen Panel, mitten in der Grafik; nie ein Text "Lädt …" (Regel in loader.js).
    // Gibt es schon Daten dieses Reiters (anderer Zeitraum), bleiben Kennzahlen, Grafik und Liste gedimmt stehen und die Ladeanzeige
    // liegt über der Grafik: so springt nichts. Beim ersten Laden steht sie in einer leeren Fläche in der Höhe der Grafik.
    const waiting = !d || d.kind !== this.tab || d.hours !== this.hours[this.tab];
    if (waiting && (!d || d.kind !== this.tab)) return { fix: `${seg}<div class="ag-sv-chart ag-sv-wait">${this._loader()}</div>`, list: "", busy: true };
    const out = this.tab === "state" ? this._stateHtml(d, seg, waiting) : this._numericHtml(d, seg, waiting);
    return { ...out, busy: waiting };
  }

  // ----- Verlauf -----

  _loader() {
    return loaderHtml(esc(this._t("svLoading")));
  }

  _stateHtml(d, seg, busy = false) {
    const flavor = this.flavor();
    const s = d.summary;
    const last = s.last ? this.host._fmtTime(s.last) : "–";
    const wide = !this.narrow;
    const kpis = flavor === "open"
      ? [[`${s.count}×`, this._t("svKOpened")], [this._dur(s.seconds), this._t("svKOpenTotal")], [this._dur(s.longest), this._t("svKLongest")], wide && [last, this._t("svKLastOpened")]]
      : flavor === "motion"
        ? [[`${s.count}`, this._t("svKMotions")], [s.busiest_hour === null ? "–" : this._t("svHourRange", { from: String(s.busiest_hour).padStart(2, "0"), to: String((s.busiest_hour + 1) % 24).padStart(2, "0") }), this._t("svKBusiest")],
          [last, this._t("svKLast")], wide && (d.hours >= 24 ? [`${s.per_day}`, this._t("svKPerDay")] : [this._dur(s.seconds), this._t("svKMotionTotal")])]
        : [[`${s.alarms}`, this._t("svKAlarms")], [`${s.available} %`, this._t("svKAvailable")], [`${s.gone_count}`, this._t("svKOutages")], wide && [last, this._t("svKLastTrig")]];
    const W = this.narrow ? 358 : 832;
    let chart;
    let legend;
    const onLabel = this._t(flavor === "open" ? "svOpen" : flavor === "motion" ? "svLegMotion" : "svTrig");
    if (flavor === "motion" && d.hours <= 24) {
      chart = this._bars(d, W);
      legend = this._legend([["sv-i-count", this._t(d.hours === 3 ? "svLegPer10" : "svLegPerHour")]]);
    } else if (flavor === "motion") {
      chart = this._heat(d, W);
      legend = `<div class="ag-sv-legend"><span>${esc(this._t("svLess"))}</span><span class="ag-sv-scale">${[0.2, 0.45, 0.7, 1].map((o) => `<i class="sv-i-count" style="opacity:${o}"></i>`).join("")}</span><span>${esc(this._t("svMore"))}</span></div>`;
    } else {
      chart = d.hours <= 24 ? this._band(d, W) : this._dayRows(d, W);
      legend = this._legend([["sv-i-on", onLabel], ["sv-i-armed", this._t("svLegArmed")], ["sv-i-alarm", this._t("svLegAlarm")], ...(s.gone_count ? [["sv-i-gone", this._t("svGone")]] : [])]);
    }
    return { fix: `${seg}${this._kpis(kpis)}<div class="ag-sv-chart">${chart}${busy ? this._loader() : ""}</div>${legend}`, list: this._listArea(this._stateEventsSpec(d, flavor)) };
  }

  // Zeilen der Ereignisse eines Ja/Nein-Sensors (Öffnungen, Bewegungen, Auslösungen, Ausfälle). Jede Zeile kennt ihre Werte zum Sortieren und den
  // Text für die Suche (alles, was sie zeigt, dazu Tag und Uhrzeit); gezeichnet wird in _rowsHtml (1.65.0, vorher eine feste Tabelle)
  _stateEventsSpec(d, flavor) {
    const start = new Date(d.start).getTime();
    const from = d.events_from ? new Date(d.events_from).getTime() : null;
    const notes = [];
    if (from !== null && from - start > HOUR) notes.push(this._t("svListFrom", { date: new Date(from).toLocaleDateString(this._locale(), { day: "numeric", month: "long" }) }));
    if (d.truncated) notes.push(this._t("svListTruncated"));
    const what = (e) => (e.kind === "gone" ? this._t("svGoneEvent") : this._t(flavor === "open" ? "svEvOpened" : flavor === "motion" ? "svEvMotion" : "svEvTrig"));
    const len = (e) => (e.end === null ? this._t("svOngoing") : e.kind === "on" && flavor === "open" ? this._t("svDurOpen", { time: this._dur(e.seconds) }) : this._dur(e.seconds));
    const tagText = (e) => (e.mode ? this._t(MODE_KEY[e.mode] || "armed") : this._t("svDisarmed"));
    const tag = (e) => (e.mode ? `<span class="ag-sv-tag arm">${ic(MODE_ICON[e.mode] || "shield", 12)}${esc(tagText(e))}</span>` : `<span class="ag-sv-tag">${esc(tagText(e))}</span>`);
    const alarm = (e) => (e.alarm ? `<button type="button" class="ag-sv-tag alarm" data-sv="alarm" data-id="${esc(e.alarm)}" title="${esc(this._t("svToAlarm"))}">${ic("alert", 12)}${esc(this._t("svAlarm"))}</button>` : "");
    const rows = d.events.map((e) => {
      const t = new Date(e.start).getTime();
      const dot = `<span class="ag-sv-dot ${e.alarm ? "alarm" : e.kind === "gone" ? "gone" : ""}"></span>`;
      return {
        t,
        sort: { time: t, event: what(e), duration: e.end === null ? Infinity : Number(e.seconds) || 0, system: tagText(e) },
        hay: [what(e), len(e), tagText(e), e.alarm ? this._t("svAlarm") : "", this._dayLabel(new Date(t)), this._clock(e.start)],
        wide: (time) => `<tr data-kind="${e.kind}"><td>${esc(time)}</td><td><span class="ag-sv-ev">${dot}${esc(what(e))}${alarm(e)}</span></td><td>${esc(len(e))}</td><td>${tag(e)}</td></tr>`,
        narrow: (time) => `<tr data-kind="${e.kind}"><td>${esc(time)}</td><td><span class="ag-sv-ev">${dot}<span>${esc(what(e))}${alarm(e)}<small>${esc(len(e))}</small></span></span></td><td class="r">${tag(e)}</td></tr>`,
      };
    });
    return {
      rows,
      notes,
      cols: [["time", "svColTime", "c1"], ["event", "svColEvent", ""], ["duration", "svColDuration", "c3"], ["system", "svColSystem", "c4"]],
      ncols: [["time", "svColTime", ""], ["event", "svColEvent", ""], ["system", "svColSystem", "r"]],
      empty: `<div class="ag-sv-msg ag-t2">${esc(this._t(from === null ? "svNoHistory" : "svNoEvents"))}</div>`,
    };
  }

  // ----- Liste unter der Grafik (1.65.0) -----

  // Regeln der Überwachung, in denen dieser Sensor vorkommt, aus allen Anlagen. Zustand: "out" (gerade ausserhalb der Grenzen), "on" (läuft),
  // "off" (die Regel oder die Überwachung der Anlage ist aus). Die Bedingung in Worten wie auf der Karte der Regel.
  monRules() {
    const mon = this.host.actions?.mon;
    const out = [];
    for (const sys of this.host._systems()) {
      for (const raw of sys.monitors || []) {
        let m;
        try {
          m = normMonitor(raw);
        } catch {
          continue;
        }
        if (!m.tree.items.flatMap((i) => (i.items ? i.items : [i])).some((l) => l.entity_id === this.id)) continue;
        const running = sys.monitor_enabled === true && m.enabled;
        const state = running && sys.monitor_active?.[m.id] ? "out" : running ? "on" : "off";
        let cond = "";
        try {
          cond = mon ? mon.ruleSub(m) : "";
        } catch {
          cond = "";
        }
        out.push({ entry: sys.entry_id, system: sys.title, m, state, cond, reachable: sys.monitor_enabled === true });
      }
    }
    return out;
  }

  // Reiter über der Liste nur bei Sensoren der Überwachung: jeder Messwert und alles, was in einer Regel der Überwachung vorkommt
  withPanes() {
    return this.measure || this.monRules().length > 0;
  }

  _rulesSpec(list) {
    const multi = this.host._systems().length > 1;
    const label = { out: this._t("svRuleOut"), on: this._t("svRuleOn"), off: this._t("svRuleOff") };
    const rows = list.map((a) => {
      const name = `<span class="ag-sv-rule"><b>${esc(a.m.name)}</b>${a.cond ? `<small>${esc(a.cond)}</small>` : ""}${multi && this.narrow ? `<small>${esc(a.system)}</small>` : ""}</span>`;
      const st = `<span class="ag-sv-state ${a.state}">${a.state === "out" ? ic("alert", 12) : ""}${esc(label[a.state])}</span>`;
      const tip = this._t(a.reachable ? "svRuleOpen" : "svRuleMonOff");
      const go = `<button type="button" class="ag-cbtn" data-sv="rule" data-entry="${esc(a.entry)}" data-rule="${esc(a.m.id)}" ${a.reachable ? "" : "disabled"} aria-label="${esc(`${a.m.name}: ${tip}`)}" title="${esc(tip)}">${ic("chevRight", 16)}</button>`;
      const tr = `<tr data-rule="${esc(a.m.id)}" data-state="${a.state}">`;
      return {
        t: 0,
        sort: { name: a.m.name, system: a.system, state: STATE_ORDER[a.state] },
        hay: [a.m.name, a.cond, a.system, label[a.state]],
        wide: () => `${tr}<td>${name}</td>${multi ? `<td>${esc(a.system)}</td>` : ""}<td>${st}</td><td class="ag-sv-go">${go}</td></tr>`,
        narrow: () => `${tr}<td>${name}</td><td class="r">${st}</td><td class="ag-sv-go">${go}</td></tr>`,
      };
    });
    return {
      rows,
      notes: [],
      byTime: false,
      cols: [["name", "svColRules", ""], ...(multi ? [["system", "svColSystem", "c3"]] : []), ["state", "svColState", "c1"], [null, "", "ag-sv-go"]],
      ncols: [["name", "svColRules", ""], ["state", "svColState", "r"], [null, "", "ag-sv-go"]],
      empty: `<div class="ag-sv-msg ag-t2">${esc(this._t("svNoRules"))}</div>`,
    };
  }

  // Zeilen der Liste zum Reiter: Ereignisse (je nach Art des Sensors) oder Regeln der Überwachung
  _paneSpec(d) {
    if (this.pane === "rules") return this._rulesSpec(this.monRules());
    return this.tab === "value" ? this._monEventsSpec(d) : this._stateEventsSpec(d, this.flavor());
  }

  // Tabelle: Suche (jedes Wort muss vorkommen) und Sortierung je Spalte nur mit Reitern; nach Zeit sortiert mit einer Zeile je Tag, sonst steht der
  // Tag bei der Uhrzeit. Ohne Reiter genau wie bis 1.64.0 (neueste zuerst, nicht sortierbar).
  _rowsHtml(spec, sortable) {
    if (!spec.rows.length) return spec.empty;
    const q = sortable ? this.lq[this.pane] : "";
    const sort = sortable ? this.lsort[this.pane] : SORT_DEFAULT.events;
    const cols = this.narrow ? spec.ncols : spec.cols;
    let rows = spec.rows.filter((r) => matchQuery(q, r.hay));
    if (!rows.length) return `<div class="ag-sv-msg ag-t2">${esc(this._t("svNoMatch"))}</div>`;
    if (sortable) rows = [...rows].sort((a, b) => cmp(a.sort[sort.key], b.sort[sort.key]) * (sort.dir === "desc" ? -1 : 1) || b.t - a.t);
    const byDay = spec.byTime !== false && sort.key === "time";
    let day = "";
    let body = "";
    for (const r of rows) {
      const date = new Date(r.t);
      if (byDay && date.toDateString() !== day) {
        day = date.toDateString();
        body += `<tr class="day"><td colspan="${cols.length}">${esc(this._dayLabel(date))}</td></tr>`;
      }
      const time = spec.byTime === false ? "" : byDay ? this._clock(date) : `${this._shortDay(date)}, ${this._clock(date)}`;
      body += (this.narrow ? r.narrow : r.wide)(time);
    }
    const th = ([key, label, cls]) => {
      const c = cls ? ` class="${cls}"` : "";
      if (!key || !sortable) return `<th${c}>${label ? esc(this._t(label)) : ""}</th>`;
      const on = sort.key === key;
      const text = this._t(label);
      return `<th${c} aria-sort="${on ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button type="button" class="ag-sv-sort ${on ? "on" : ""}" data-sv="lsort" data-key="${key}" title="${esc(this._t("sortBy", { column: text }))}">${esc(text)}<span class="ag-sortic">${on ? ic(sort.dir === "desc" ? "arrowDown" : "arrowUp", 14) : ""}</span></button></th>`;
    };
    return `<table class="ag-sv-table"><thead><tr>${cols.map(th).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }

  // Liste unter der Grafik: bei Sensoren der Überwachung mit den Reitern "Ereignisse" und "Regeln" und einem Suchfeld; die Leiste scrollt mit
  // (auf dem Handy bleibt so mehr Platz für die Zeilen), der Tabellenkopf bleibt stehen
  _listArea(spec) {
    const tail = spec.notes.map((n) => `<p class="ag-sv-note">${esc(n)}</p>`).join("");
    if (!this.withPanes()) return this._rowsHtml(spec, false) + tail;
    const rules = this.monRules();
    const pane = this.pane;
    const btn = (key, label, icon, n) => `<button role="tab" data-sv="pane" data-pane="${key}" class="${pane === key ? "on" : ""}" aria-selected="${pane === key}">${ic(icon, 20)}<span>${esc(this._t(label))}<span class="ag-sv-n">${n}</span></span></button>`;
    const shown = pane === "rules" ? this._rulesSpec(rules) : spec;
    return `<div class="ag-sv-lbar"><div class="ag-seg small ag-sv-panes" role="tablist" data-seg="sv-panes">${btn("events", "svPaneEvents", "history", spec.rows.length)}${btn("rules", "svPaneRules", "eye", rules.length)}</div>
      ${searchField("data-sv", "lq", this.lq[pane], this._t(pane === "rules" ? "svSearchRules" : "svSearchEvents"), this._t("clearSearch"))}</div>
      <div class="ag-sv-rows">${this._rowsHtml(shown, true)}</div>${pane === "events" ? tail : ""}`;
  }

  // Nur die Zeilen neu (Suche, Sortierung): das Suchfeld behält Fokus und Eingabe
  _renderRows() {
    const el = this.dlg?.querySelector(".ag-sv-rows");
    if (!el || !this.data) return;
    el.innerHTML = this._rowsHtml(this._paneSpec(this.data), true);
    // Beim nächsten Zeichnen das ganze Fenster neu (sonst hielte _setHtml den Stand vor der Suche für aktuell)
    this.host._lastHtml?.delete(this.dlg);
  }

  onInput(el) {
    if (el.dataset?.sv !== "lq") return false;
    this.lq[this.pane] = el.value;
    const clear = this.dlg?.querySelector('[data-sv="lq-clear"]');
    if (clear) clear.hidden = !el.value;
    this._renderRows();
    return true;
  }

  // ----- Grafiken (SVG, Farben über Klassen aus den Variablen des Panels) -----

  _svg(w, h, body, label) {
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  }

  _txt(x, y, text, anchor = "middle", cls = "") {
    return `<text x="${x.toFixed(1)}" y="${y}" text-anchor="${anchor}" class="sv-tx ${cls}">${esc(text)}</text>`;
  }

  // Zustandsband bis zu einem Tag: oben schmal "Anlage scharf", darunter die Abschnitte des Sensors, unten die Zeitachse
  _band(d, W) {
    const now = new Date(d.now).getTime();
    const start = new Date(d.start).getTime();
    const L = 4;
    const R = W - 4;
    const x = (t) => L + ((Math.min(now, Math.max(start, t)) - start) / (now - start)) * (R - L);
    let s = `<rect class="sv-track" x="${L}" y="6" width="${R - L}" height="8" rx="4"/>`;
    for (const a of d.armed) s += `<rect class="sv-armed" x="${x(new Date(a.from).getTime()).toFixed(1)}" y="6" width="${Math.max(2, x(a.to ? new Date(a.to).getTime() : now) - x(new Date(a.from).getTime())).toFixed(1)}" height="8" rx="4"/>`;
    s += `<rect class="sv-track" x="${L}" y="24" width="${R - L}" height="40" rx="9"/>`;
    for (const e of [...d.events].reverse()) {
      const from = x(new Date(e.start).getTime());
      const width = Math.max(2.5, x(e.end ? new Date(e.end).getTime() : now) - from);
      s += `<rect class="${e.kind === "gone" ? "sv-gone" : e.alarm ? "sv-alarm" : "sv-on"}" x="${from.toFixed(1)}" y="24" width="${width.toFixed(1)}" height="40" rx="${Math.min(3, width / 2).toFixed(1)}"/>`;
    }
    const step = (W < 500 ? (d.hours <= 3 ? 1 : d.hours <= 12 ? 3 : 6) : d.hours <= 3 ? 0.5 : d.hours <= 12 ? 2 : 3) * HOUR;
    for (let t = Math.ceil(start / step) * step; t <= now; t += step) {
      const xx = x(t);
      s += `<line class="sv-tick" x1="${xx.toFixed(1)}" y1="66" x2="${xx.toFixed(1)}" y2="71"/>${this._txt(xx, 84, this._clock(t), xx < 24 ? "start" : xx > W - 24 ? "end" : "middle")}`;
    }
    return this._svg(W, 90, s, this._t("svChartBand"));
  }

  // Die Tage des Zeitraums (lokal, ältester zuerst) mit ihrem Beginn
  _days(d) {
    const count = Math.round(d.hours / 24);
    const today = new Date(d.now);
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: count }, (_v, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1 - i)));
  }

  // Tageszeilen für 7 und 30 Tage: eine Zeile je Tag von 0 bis 24 Uhr, aus den Stundenwerten (Sekunden offen je Stunde)
  _dayRows(d, W) {
    const days = this._days(d);
    const few = days.length <= 7;
    const rowH = few ? 15 : 5;
    const gap = few ? 6 : 2.4;
    const L = few ? 50 : 44;
    const R = W - 4;
    const top = 4;
    const hourW = (R - L) / 24;
    const now = new Date(d.now).getTime();
    const index = new Map(days.map((day, i) => [day.toDateString(), i]));
    let s = "";
    days.forEach((day, i) => {
      const y = top + i * (rowH + gap);
      s += `<rect class="sv-track" x="${L}" y="${y}" width="${R - L}" height="${rowH}" rx="${(rowH / 3).toFixed(1)}"/>`;
      if (few || i === 0 || i === days.length - 1 || i % 5 === 0) s += this._txt(L - 8, y + rowH / 2 + 4, this._shortDay(day), "end", i === days.length - 1 ? "now" : "");
    });
    const span = (from, to, cls, minW) => {
      // Ein Abschnitt kann über Mitternacht gehen: je Tag ein Stück
      for (let t = from; t < to;) {
        const day = new Date(t);
        const i = index.get(day.toDateString());
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
        // Der nächste Tag beginnt nach dem Kalender, nicht nach 24 Stunden (1.58.0): am Tag der Zeitumstellung im Herbst hat der Tag
        // 25 Stunden. Mit "Beginn + 24 h" blieb die Schleife um 23 Uhr desselben Tages stehen und lief endlos, bis der Browser mit
        // "Invalid string length" abbrach: die Ansichten über 7 und 30 Tage waren wochenlang nicht benutzbar.
        const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
        const end = Math.min(to, nextDay);
        if (end <= t) break; // nie ohne Fortschritt weiter (Sicherung gegen jede Endlosschleife)
        if (i !== undefined) {
          // Die Zeile zeigt 0 bis 24 Uhr: an einem Tag mit 25 Stunden endet der Balken am rechten Rand
          const x0 = Math.min(R, L + ((t - dayStart) / HOUR) * hourW);
          const width = Math.min(R - x0, Math.max(minW, ((end - t) / HOUR) * hourW));
          if (width > 0) s += `<rect class="${cls}" x="${x0.toFixed(1)}" y="${top + i * (rowH + gap)}" width="${width.toFixed(1)}" height="${rowH}"/>`;
        }
        t = end;
      }
    };
    for (const a of d.armed) span(new Date(a.from).getTime(), a.to ? new Date(a.to).getTime() : now, "sv-armed soft", 0);
    for (const [hour, , seconds] of d.buckets) {
      if (!seconds) continue;
      const t = new Date(hour).getTime();
      span(t, t + Math.min(HOUR, seconds * 1000), "sv-on", few ? 3 : 2.2);
    }
    for (const e of d.events) {
      if (e.kind === "gone") span(new Date(e.start).getTime(), e.end ? new Date(e.end).getTime() : now, "sv-gone", 2);
      else if (e.alarm) span(new Date(e.start).getTime(), new Date(e.start).getTime() + Math.max(e.seconds * 1000, 1), "sv-alarm", few ? 3 : 2.2);
    }
    const base = top + days.length * (rowH + gap);
    for (const h of W < 500 ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]) s += this._txt(L + h * hourW, base + 12, `${String(h).padStart(2, "0")}:00`, h === 24 ? "end" : h === 0 ? "start" : "middle");
    return this._svg(W, base + 18, s, this._t("svChartDays"));
  }

  // Balken: Anzahl je Abschnitt (10 Minuten bei 3 Stunden aus den Ereignissen, sonst je Stunde aus den Stundenwerten)
  _bars(d, W) {
    const now = new Date(d.now).getTime();
    const start = new Date(d.start).getTime();
    const size = d.hours === 3 ? HOUR / 6 : HOUR;
    const first = Math.floor(start / size) * size + size;
    const n = Math.round((Math.floor(now / size) * size + size - first) / size);
    const values = new Array(n).fill(0);
    if (d.hours === 3) {
      for (const e of d.events) if (e.kind === "on") { const i = Math.floor((new Date(e.start).getTime() - first) / size); if (i >= 0 && i < n) values[i]++; }
    } else {
      for (const [hour, count] of d.buckets) { const i = Math.round((new Date(hour).getTime() - first) / size); if (i >= 0 && i < n) values[i] += count; }
    }
    const H = 118;
    const L = 28;
    const R = W - 4;
    const top = 8;
    const bottom = H - 22;
    const nice = Math.max(4, Math.ceil(Math.max(...values) / 4) * 4);
    let s = "";
    for (const g of [0, nice / 2, nice]) {
      const y = bottom - (g / nice) * (bottom - top);
      s += `<line class="sv-grid" x1="${L}" y1="${y}" x2="${R}" y2="${y}"/>${this._txt(L - 6, y + 4, String(g), "end")}`;
    }
    const bw = (R - L) / n;
    const every = d.hours === 3 ? 6 : d.hours === 12 ? 2 : W < 500 ? 6 : 3;
    values.forEach((v, i) => {
      const h = (v / nice) * (bottom - top);
      s += `<rect class="sv-count" data-v="${v}" x="${(L + i * bw + bw * 0.16).toFixed(1)}" y="${(bottom - h).toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${Math.max(v ? 2 : 0, h).toFixed(1)}" rx="${Math.min(4, bw * 0.2).toFixed(1)}"/>`;
      if (i % every === 0) s += this._txt(L + i * bw + bw / 2, H - 6, this._clock(first + i * size));
    });
    return this._svg(W, H, s, this._t("svChartBars"));
  }

  // Raster Tag x Stunde: je kräftiger, desto mehr Bewegung in dieser Stunde
  _heat(d, W) {
    const days = this._days(d);
    const few = days.length <= 7;
    const L = 50;
    const R = W - 4;
    const top = 4;
    const cw = (R - L) / 24;
    const ch = few ? 17 : 5.6;
    const gap = few ? 3 : 1.2;
    const index = new Map(days.map((day, i) => [day.toDateString(), i]));
    const grid = days.map(() => new Array(24).fill(0));
    for (const [hour, count] of d.buckets) {
      const date = new Date(hour);
      const i = index.get(date.toDateString());
      if (i !== undefined) grid[i][date.getHours()] += count;
    }
    const max = Math.max(1, ...grid.flat());
    let s = "";
    grid.forEach((row, i) => {
      const y = top + i * (ch + gap);
      row.forEach((v, h) => {
        s += `<rect class="${v ? "sv-count" : "sv-track"}" data-v="${v}" x="${(L + h * cw + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${ch}" rx="${few ? 4 : 1.5}" ${v ? `style="opacity:${(0.18 + 0.82 * (v / max)).toFixed(2)}"` : ""}/>`;
      });
      if (few || i === 0 || i === days.length - 1 || i % 5 === 0) s += this._txt(L - 8, y + ch / 2 + 4, this._shortDay(days[i]), "end", i === days.length - 1 ? "now" : "");
    });
    const base = top + days.length * (ch + gap);
    for (const h of W < 500 ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]) s += this._txt(L + h * cw, base + 12, `${String(h).padStart(2, "0")}:00`, h === 24 ? "end" : h === 0 ? "start" : "middle");
    return this._svg(W, base + 18, s, this._t("svChartHeat"));
  }

  // ----- Batterie und Empfang -----

  _numericHtml(d, seg, busy = false) {
    const s = d.summary;
    const battery = d.kind === "battery";
    const value = d.kind === "value";
    const unit = d.unit || (battery ? "%" : "");
    const fmt = value ? (v) => this._valueText(v, unit) : (v) => (v === null || v === undefined ? "–" : `${Math.round(v)}${unit ? ` ${unit}` : ""}`);
    const wide = !this.narrow;
    let kpis;
    if (battery) {
      const left = s.days_left;
      const leftText = left === null || left === undefined ? "–" : left <= 0 ? this._t("svNowLow") : left >= 60 ? this._t("svMonths", { n: Math.round(left / 30) }) : this._t("svDays", { n: Math.round(left) });
      kpis = [[fmt(s.current), this._t("svKCurrent")], [s.per_day === null || s.per_day === undefined ? "–" : `${s.per_day.toLocaleString(this._locale(), { maximumFractionDigits: 2 })} %`, this._t("svKPerDayUse")],
        [leftText, this._t("svKUntilWarn")], wide && [s.last_change ? this.host._fmtAgo(s.last_change) : "–", this._t("svKChanged")]];
    } else if (value) {
      kpis = [[fmt(s.current), this._t("svKCurrent")], [fmt(s.mean), this._t("svKMean")], [fmt(s.min), this._t("svKLowest")], wide && [fmt(s.max), this._t("svKHighest")]];
    } else {
      kpis = [[fmt(s.current), this._t("svKCurrent")], [fmt(s.mean), this._t("svKMean")], [fmt(s.min), this._t("svKWeakest")]];
    }
    const chart = d.points.length < 2 ? `<div class="ag-sv-msg ag-t2">${esc(this._t("svNoValues"))}</div>` : (d.kind === "value" ? this._valueLine(d, this.narrow ? 358 : 832) : this._line(d, this.narrow ? 358 : 832));
    return { fix: `${seg}${this._kpis(kpis)}<div class="ag-sv-chart">${chart}${busy ? this._loader() : ""}</div>`, list: value ? this._listArea(this._monEventsSpec(d)) : this._valuesHtml(d, fmt) };
  }

  // Linie mit Fläche: Batterie mit Schwelle der Warnung, Batteriewechsel und Prognose; Empfang in dBm mit den Zonen gut, mittel, schwach
  _line(d, W) {
    const battery = d.kind === "battery";
    const pts = d.points.map(([t, v]) => [new Date(t).getTime(), v]);
    const now = new Date(d.now).getTime();
    const start = new Date(d.start).getTime();
    const left = battery ? d.summary.days_left : null;
    const future = battery && left ? Math.min(left * 24 * HOUR, (now - start) * 0.45) : 0;
    const dbm = !battery && d.unit === "dBm";
    const values = pts.map((p) => p[1]);
    const min = battery ? 0 : dbm ? Math.min(-95, ...values) : Math.min(...values);
    const max = battery ? 100 : dbm ? Math.max(-40, ...values) : Math.max(...values, min + 1);
    const H = 150;
    const L = 40;
    const R = W - 6;
    const top = 10;
    const bottom = H - 22;
    const x = (t) => L + ((t - start) / (now + future - start)) * (R - L);
    const y = (v) => bottom - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (bottom - top);
    let s = "";
    if (dbm) for (const [from, to, cls, label] of [[-65, max, "ok", "svZoneGood"], [-80, -65, "warn", "svZoneMid"], [min, -80, "err", "svZoneWeak"]]) {
      s += `<rect class="sv-zone ${cls}" x="${L}" y="${y(to).toFixed(1)}" width="${R - L}" height="${(y(from) - y(to)).toFixed(1)}"/>${this._txt(R - 6, y(to) + 13, this._t(label), "end", cls)}`;
    }
    for (const g of [min, (min + max) / 2, max]) s += `<line class="sv-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${this._txt(L - 6, y(g) + 4, `${Math.round(g)}${battery ? " %" : ""}`, "end")}`;
    if (battery) s += `<line class="sv-thr" x1="${L}" y1="${y(d.threshold).toFixed(1)}" x2="${R}" y2="${y(d.threshold).toFixed(1)}"/>${this._txt((L + R) / 2, y(d.threshold) + 13, this._t("svWarnBelow", { n: d.threshold }), "middle", "err")}`;
    const path = pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const [lastT, lastV] = pts[pts.length - 1];
    s += `<path class="sv-area" d="${path} L${x(lastT).toFixed(1)},${bottom} L${x(pts[0][0]).toFixed(1)},${bottom} Z"/><path class="sv-line" d="${path}"/>`;
    if (future) {
      s += `<path class="sv-line dash" d="M${x(lastT).toFixed(1)},${y(lastV).toFixed(1)} L${x(now + future).toFixed(1)},${y(lastV - ((lastV - d.threshold) * future) / (left * 24 * HOUR)).toFixed(1)}"/>`;
      s += `<line class="sv-tick dash" x1="${x(now).toFixed(1)}" y1="${top}" x2="${x(now).toFixed(1)}" y2="${bottom}"/>${this._txt(x(now) - 6, top + 10, this._t("svToday"), "end")}${this._txt(x(now) + 6, top + 10, this._t("svForecast"), "start")}`;
    }
    for (const c of d.changes || []) {
      const cx = x(new Date(c).getTime());
      s += `<line class="sv-mark" x1="${cx.toFixed(1)}" y1="${top + 14}" x2="${cx.toFixed(1)}" y2="${bottom}"/>${this._txt(cx + 5, top + 24, this._t("svBatteryChanged"), "start", "ok")}`;
    }
    s += `<circle class="sv-dot" cx="${x(lastT).toFixed(1)}" cy="${y(lastV).toFixed(1)}" r="4.5"/>`;
    const fmtDate = (t) => new Date(t).toLocaleDateString(this._locale(), d.hours <= 24 ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
    for (const [t, anchor] of [[start, "start"], [(start + now) / 2, "middle"], [now, future ? "middle" : "end"]]) s += this._txt(x(t), H - 6, d.hours <= 24 ? this._clock(t) : fmtDate(t), anchor);
    return this._svg(W, H, s, this._t(battery ? "svChartBattery" : "svChartSignal"));
  }

  // Liste der Werte: je Tag der letzte Wert, mit der Änderung zum Tag davor (bis zu einem Tag: je Stunde)
  _valuesHtml(d, fmt) {
    if (!d.points.length) return "";
    const byHour = d.hours <= 24;
    const groups = new Map();
    for (const [t, v] of d.points) {
      const date = new Date(t);
      const key = byHour ? `${date.toDateString()} ${date.getHours()}` : date.toDateString();
      groups.set(key, [date, v]);
    }
    const rows = [...groups.values()];
    const changes = new Set((d.changes || []).map((c) => (byHour ? "" : new Date(c).toDateString())));
    let body = "";
    for (let i = rows.length - 1; i >= 0; i--) {
      const [date, v] = rows[i];
      const diff = i ? v - rows[i - 1][1] : null;
      const sign = diff === null ? "–" : `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(Math.round(diff * 10) / 10)}${d.unit ? ` ${d.unit}` : ""}`;
      const mark = changes.has(date.toDateString()) ? `<span class="ag-sv-tag ok">${ic("restore", 12)}${esc(this._t("svBatteryChanged"))}</span>` : "";
      body += `<tr><td>${esc(byHour ? this._clock(date) : date.toLocaleDateString(this._locale(), { weekday: "short", day: "numeric", month: "short" }))}</td><td>${esc(fmt(v))}${this.narrow ? mark : ""}</td><td class="${this.narrow ? "r" : ""}">${esc(sign)}</td>${this.narrow ? "" : `<td>${mark}</td>`}</tr>`;
    }
    const head = `<tr><th class="c1w">${esc(this._t(byHour ? "svColTime" : "svColDay"))}</th><th>${esc(this._t("svColValue"))}</th><th class="${this.narrow ? "r" : "c3"}">${esc(this._t("svColChange"))}</th>${this.narrow ? "" : '<th class="c4"></th>'}</tr>`;
    return `<table class="ag-sv-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  // Schöne Achsenwerte: Schritt 1, 2 oder 5 mal Zehnerpotenz, drei bis fünf Linien über den Bereich der Werte
  _niceTicks(lo, hi) {
    const span = Math.max(hi - lo, 1e-6);
    const raw = span / 3;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((x) => x >= raw) || raw;
    const first = Math.floor(lo / step) * step;
    const last = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = first; v <= last + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { ticks, step };
  }

  // Werteverlauf eines Messwert-Sensors (Temperatur, Luftfeuchtigkeit, CO2): Linie mit Fläche, schöne Achse in der Einheit des Sensors,
  // Grenzen der Regeln der Überwachung als gestrichelte Linien (nur, wenn sie nahe an den Werten liegen), letzter Wert als Punkt
  _valueLine(d, W) {
    const pts = d.points.map(([t, v]) => [new Date(t).getTime(), v]);
    const now = new Date(d.now).getTime();
    const start = new Date(d.start).getTime();
    const values = pts.map((p) => p[1]);
    const vmin = Math.min(...values);
    const vmax = Math.max(...values);
    const span = Math.max(vmax - vmin, Math.abs(vmax) * 0.05, 1);
    // Jede Grenze ist zu sehen (1.65.0, Entscheid des Nutzers): der Bereich der Grafik reicht bis zu ihr, auch wenn die Kurve dadurch flacher wird.
    // Bis 1.64.0 fielen Grenzen weg, die weiter als zwei Spannweiten neben den Werten lagen (Kühlschrank mit 4,8 bis 6,1 °C: Grenze 14 °C fehlte).
    const limits = (d.limits || []).flatMap((l) => l.limits.map((value) => ({ rule: l.rule, value }))).filter((l) => Number.isFinite(l.value));
    const lo = Math.min(vmin, ...limits.map((l) => l.value));
    const hi = Math.max(vmax, ...limits.map((l) => l.value));
    const pad = Math.max(hi - lo, span) * 0.05;
    const { ticks, step } = this._niceTicks(lo - pad, hi + pad);
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const decimals = step >= 1 ? 0 : Math.min(2, Math.ceil(-Math.log10(step)));
    const unit = d.unit ? ` ${d.unit}` : "";
    const label = (v) => `${v.toLocaleString(this._locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    const H = 150;
    const L = Math.max(36, 14 + 7 * Math.max(...ticks.map((v) => label(v).length)));
    const R = W - 6;
    const top = 10;
    const bottom = H - 22;
    const x = (t) => L + ((t - start) / (now - start)) * (R - L);
    const y = (v) => bottom - ((v - min) / (max - min)) * (bottom - top);
    let s = "";
    ticks.forEach((g, i) => {
      s += `<line class="sv-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${this._txt(L - 6, y(g) + 4, i === ticks.length - 1 ? `${label(g)}${unit}` : label(g), "end")}`;
    });
    for (const l of limits) {
      s += `<line class="sv-thr" x1="${L}" y1="${y(l.value).toFixed(1)}" x2="${R}" y2="${y(l.value).toFixed(1)}"/>${this._txt(R - 4, y(l.value) - 4, this._t("svLimit", { value: `${l.value.toLocaleString(this._locale())}${unit}` }), "end", "err")}`;
    }
    const path = pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const [lastT, lastV] = pts[pts.length - 1];
    s += `<path class="sv-area" d="${path} L${x(lastT).toFixed(1)},${bottom} L${x(pts[0][0]).toFixed(1)},${bottom} Z"/><path class="sv-line" d="${path}"/>`;
    s += `<circle class="sv-dot" cx="${x(lastT).toFixed(1)}" cy="${y(lastV).toFixed(1)}" r="4.5"/>`;
    const fmtDate = (t) => new Date(t).toLocaleDateString(this._locale(), d.hours <= 24 ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
    for (const [t, anchor] of [[start, "start"], [(start + now) / 2, "middle"], [now, "end"]]) s += this._txt(x(t), H - 6, d.hours <= 24 ? this._clock(t) : fmtDate(t), anchor);
    return this._svg(W, H, s, this._t("svChartValue"));
  }

  // Ereignisse der Überwachung zu diesem Sensor (nie die Messwerte selbst: das wäre unübersichtlich): ausserhalb der Grenzen, wieder in Ordnung
  _monEventsSpec(d) {
    const events = d.events || [];
    const multi = this.host._systems().length > 1;
    const what = (e) => this._t(e.kind === "out" ? "svEvMonOut" : "svEvMonOk");
    // Der Server legt den Stand als Zahl mit Punkt ab ("6.1"); angezeigt im Format der Sprache ("6,1 °C" auf Deutsch, 1.64.0)
    const isNum = (v) => /^-?\d+(\.\d+)?$/.test(String(v));
    const num = (v) => (isNum(v) ? Number(v).toLocaleString(this._locale()) : v);
    const val = (e) => (e.value ? `${num(e.value)}${e.unit ? ` ${e.unit}` : ""}` : "–");
    const tagText = (e) => `${e.rule || "–"}${multi && e.system ? ` · ${e.system}` : ""}`;
    const tag = (e) => `<span class="ag-sv-tag">${esc(tagText(e))}</span>`;
    const rows = events.map((e) => {
      const t = new Date(e.t).getTime();
      const dot = `<span class="ag-sv-dot mon-${e.kind}"></span>`;
      return {
        t,
        sort: { time: t, event: what(e), value: isNum(e.value) ? Number(e.value) : -Infinity, rule: tagText(e) },
        hay: [what(e), val(e), tagText(e), this._dayLabel(new Date(t)), this._clock(e.t)],
        wide: (time) => `<tr data-kind="${e.kind}"><td>${esc(time)}</td><td><span class="ag-sv-ev">${dot}${esc(what(e))}</span></td><td>${esc(val(e))}</td><td>${tag(e)}</td></tr>`,
        narrow: (time) => `<tr data-kind="${e.kind}"><td>${esc(time)}</td><td><span class="ag-sv-ev">${dot}<span>${esc(what(e))}<small>${esc(val(e))}</small></span></span></td><td class="r">${tag(e)}</td></tr>`,
      };
    });
    return {
      rows,
      notes: [],
      cols: [["time", "svColTime", "c1"], ["event", "svColEvent", ""], ["value", "svColValue", "c3"], ["rule", "svColRule", "c4"]],
      ncols: [["time", "svColTime", ""], ["event", "svColEvent", ""], ["rule", "svColRule", "r"]],
      empty: `<div class="ag-sv-msg ag-t2">${esc(this._t("svNoMonEvents"))}</div>`,
    };
  }

  // ----- Gerät: nur zur Ansicht -----

  _deviceHtml() {
    const info = this.info();
    // Hinter jeder Angabe ein Knopf, der den ganzen Wert kopiert (auch wenn die Zeile ihn abschneidet oder umbricht)
    const row = (label, value) => (value ? `<div class="ag-sv-drow"><span class="ag-t2">${esc(label)}</span><b>${esc(value)}</b>${copyBtn(value, this._t("svCopy", { name: label }), 'data-sv="copy"', "ag-sv-copy")}</div>` : "");
    const facts = [row(this._t("svDevMaker"), info.manufacturer), row(this._t("svDevModel"), info.model), row(this._t("svDevFirmware"), info.sw_version),
      row(this._t("svDevIntegration"), info.integration || info.platform), row(this._t("svDevArea"), info.area), row(this._t("svDevEntity"), this.id)].join("");
    // Dieselbe Rechnung wie die Liste der Übersicht (list.members, 1.63.0, Code-Review): bis 1.62.0 stand hier "Immer aktiv" schon, wenn die
    // Voreinstellung der Sensorart es vorsah, auch bei einer Anlage, zu der der Sensor gar nicht gehört, und bei ausgeschaltetem "Immer aktiv"
    const systems = (this.host.list?.members().get(this.id) || []).map((m) => {
      const sys = this.host._system(m.entry) || {};
      const zones = MODES.filter((mode) => m.modes.includes(mode));
      const always = m.always;
      const watched = m.monitor;
      if (!zones.length && !always && !watched) return "";
      const chips = [...zones.map((mode) => `<span class="ag-sv-tag arm">${ic(MODE_ICON[mode], 12)}${esc(this._t(MODE_KEY[mode]))}</span>`),
        ...(always ? [`<span class="ag-sv-tag arm">${ic("flash", 12)}${esc(this._t("optAlways"))}</span>`] : []),
        ...(watched ? [`<span class="ag-sv-tag arm">${ic("eye", 12)}${esc(this._t("wfMonitor"))}</span>`] : []),
        ...((sys.entry_sensors || []).includes(this.id) ? [`<span class="ag-sv-tag">${ic("timer", 12)}${esc(this._t("optEntryShort"))}</span>`] : [])].join("");
      return `<div class="ag-sv-drow"><span class="ag-t2">${esc(m.title)}</span><span class="ag-sv-chips">${chips}</span></div>`;
    }).join("");
    return { fix: "", list: `<div class="ag-sv-device"><div class="ag-label">${esc(this._t("svDevDevice"))}</div><div class="ag-card ag-sv-dcard">${facts || `<div class="ag-sv-msg ag-t2">${esc(this._t("svDeviceNone"))}</div>`}</div>
      <div class="ag-label">${esc(this._t("svDevWatched"))}</div><div class="ag-card ag-sv-dcard">${systems || `<div class="ag-sv-msg ag-t2">${esc(this._t("svDevNowhere"))}</div>`}</div>
      <button type="button" class="ag-btn ag-sv-config" data-sv="config">${ic("tune", 18)}${esc(this._t("svDevConfig"))}</button></div>` };
  }
}
