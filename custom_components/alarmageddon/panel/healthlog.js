// Protokoll der HealthCheck-Dienste (1.68.0, Wunsch und Entscheide des Nutzers 2026-11-19, 17:06 bis 17:48; Mockups healthcheck-protokoll-v1 und
// -v2). Öffnet sich über den runden Knopf "Protokoll" je Zeile der Dienste. "Das Design soll wirklich genau gleich sein, als würde ich auf ein Gerät
// gehen": darum die Bausteine der Sensoransicht (Kopf, Kacheln als Reiter, Zeitraum, Kennzahlen, Grafik, Legende, Liste mit Reitern, Suche und
// Sortierung), hier als Unterklasse. Im Kopf der Name als Auswahl zum Wechseln des Dienstes und "Bearbeiten" (öffnet das Formular) an der Stelle von
// "In HA öffnen".
// Grafik je Zeitraum (Entscheid 17:31): bis 1 Tag "Herzschlag" (je Aufruf oder Abschnitt ein Balken: Höhe die Antwortzeit, Farbe das Ergebnis; darunter
// ein Band), 7 Tage eine Zeitleiste je Tag (grün, solange Lebenszeichen ankommen, Marken für Fehler und Tests), 30 Tage ein Raster wie bei Bewegung
// (Zeile je Tag, Zelle je Stunde; Entscheid 17:48 "Vorschlag 1"). Kachel "Antwortzeit" genau wie im Mockup v1: Linie mit Fläche, Zonen schnell,
// langsam, sehr langsam, gestrichelte rote Marke bei jedem gescheiterten Aufruf.
// Liste: "Ereignisse" (Standard) und "Alle Aufrufe", beide genau nach dem oben gewählten Zeitraum gefiltert, die Zahl am Reiter ist die Zahl der
// Liste (Vorgabe des Nutzers 17:48). Einzelne Aufrufe gibt es nur 24 Stunden ("ältere nur zusammengefasst"); bei 7 und 30 Tagen sagt das ein Hinweis.
// Die Daten kommen ausgewertet vom Server (healthcheck_log.py); hier wird nur gezeichnet. Die Ping-URL steht ganz in der Kachel "Dienst" (Ausnahme
// vom Geheimnis-Grundsatz, Entscheid des Nutzers "Ganz zeigen"); das Protokoll selbst kennt sie nicht.
const V = new URL(import.meta.url).search;
const { copyBtn, errText, esc, fmtDur, ic, searchField } = await import(`./common.js${V}`);
const { loaderStart } = await import(`./loader.js${V}`);
const { SensorView } = await import(`./sensorview.js${V}`);
const { applySuffix, suggest } = await import(`./healthcheck.js${V}`);

// 6 Monate und 1 Jahr (zuerst 90 Tage, Wunsch des Nutzers 2026-11-19, 18:24 "Langzeitstatistik"; 2026-11-20 19:01: "aus den 90 Tagen eine 6-Monats-Grafik, etwas gefüllter"); dort ein Raster Monat × Tag (Entscheid 18:35, Mockup v3 "B")
const RANGES = [3, 12, 24, 168, 720, 4320, 8760];
const RANGE_LABEL = { 3: "svR3h", 12: "svR12h", 24: "svR1d", 168: "svR7d", 720: "svR30d", 4320: "svR6m", 8760: "svR1y" };
const TABS = ["history", "latency", "service"];
const TAB_ICON = { history: "history", latency: "timer", service: "heartPulse" };
const RANK = { ok: 0, test: 1, report: 2, fail: 3 };
const HOUR = 3600000;
const SORT_DEFAULT = { events: { key: "time", dir: "desc" }, calls: { key: "time", dir: "desc" } };
// Geholte Zeiträume kurz behalten (Design-Regel "Ladeanzeige bei Grafiken"): ein Wechsel zurück zeigt sofort, was eben noch da war
const CACHE_MS = 30000;
// Zonen der Antwortzeit (Mockup v1, "genau so umsetzen"): schnell bis 300 ms, sehr langsam ab 1 s
const FAST = 300;
const SLOW = 1000;
const ms = (iso) => new Date(iso).getTime();

export class HealthLogView extends SensorView {
  constructor(host) {
    super(host);
    this.tab = "history";
    this.range = 24;
    this.menu = false;
    this.cache = new Map();
  }

  resetList() {
    this.pane = "events";
    this.lq = { events: "", calls: "" };
    this.lsort = { events: { ...SORT_DEFAULT.events }, calls: { ...SORT_DEFAULT.calls } };
  }

  get dlg() {
    return this.host._root.getElementById("ag-hclog");
  }

  get items() {
    return this.host._data?.healthchecks || [];
  }

  item(id = this.id) {
    return this.items.find((i) => i.id === id) || null;
  }

  tabs() {
    return TABS;
  }

  withPanes() {
    return true;
  }

  open(id) {
    if (id !== this.id) {
      this.resetList();
      this.data = null;
    }
    this.id = id;
    this.tab = "history";
    this.menu = false;
    this.error = null;
    if (!this._bound) {
      this._bound = true;
      this.dlg.addEventListener("close", () => {
        this.seq++;
        this.id = null;
        this.menu = false;
      });
    }
    const cached = this._cached();
    if (cached) this.data = cached;
    this.render();
    if (!this.dlg.open) this.dlg.showModal();
    this.load();
  }

  _cached(hours = this.range) {
    const hit = this.cache.get(`${this.id}|${hours}`);
    return hit && Date.now() - hit.at < CACHE_MS ? hit.data : null;
  }

  async load(force = true) {
    if (!this.id) return;
    const cached = force ? null : this._cached();
    if (cached) {
      this.data = cached;
      this.error = null;
      this.render();
      return;
    }
    const seq = ++this.seq;
    this.loading = true;
    this.error = null;
    this.render();
    try {
      const res = await this.host._hass.callWS({ type: "alarmageddon/healthcheck_history", check_id: this.id, hours: this.range });
      if (seq !== this.seq) return;
      this.data = res;
      this.cache.set(`${this.id}|${this.range}`, { at: Date.now(), data: res });
    } catch (err) {
      if (seq !== this.seq) return;
      this.data = null;
      this.error = errText(err);
    }
    this.loading = false;
    this.render();
  }

  // Nach dem Speichern im Formular ("Bearbeiten"): Name, Adresse oder Intervall können anders sein, die Lücken hängen am Intervall
  afterSave(id) {
    if (!this.dlg?.open || id !== this.id) return;
    this.cache.clear();
    this.load();
  }

  // Ein entfernter Dienst hat kein Protokoll mehr (der Server löscht es mit)
  afterRemove(id) {
    for (const key of [...this.cache.keys()]) if (key.startsWith(`${id}|`)) this.cache.delete(key);
    if (this.dlg?.open && id === this.id) this.close();
  }

  // Auswahl im Kopf: auf und zu nur im Fenster umschalten, ohne neu zu zeichnen (ein Tipp daneben schliesst sie und tut trotzdem, was er soll)
  setMenu(open) {
    this.menu = open;
    const menu = this.dlg?.querySelector(".ag-hl-menu");
    if (menu) menu.hidden = !open;
    this.dlg?.querySelector('[data-sv="menu"]')?.setAttribute("aria-expanded", String(open));
    this.host._lastHtml?.delete(this.dlg);
  }

  onClick(el) {
    const act = el.dataset.sv;
    if (act === "menu") {
      this.setMenu(!this.menu);
      return true;
    }
    if (this.menu) this.setMenu(false);
    if (act === "pick") {
      if (el.dataset.id !== this.id) this.open(el.dataset.id);
    } else if (act === "tab") {
      if (el.dataset.tab === this.tab) return true;
      this.tab = el.dataset.tab;
      this.render();
    } else if (act === "range") {
      const hours = Number(el.dataset.hours);
      if (hours === this.range && this.data?.hours === hours) return true;
      this.range = hours;
      this.load(false);
    } else if (act === "edit") {
      this.host.healthcheck.openForm(this.id);
    } else if (act === "test-ok" || act === "test-fail" || act === "test-alarm") {
      // Wie in der Liste; danach das Protokoll neu holen (der Aufruf steht dort als Test)
      const id = this.id;
      const run = this.host.healthcheck.test(id, act === "test-ok" ? "ok" : act === "test-alarm" ? "alarm" : "fail");
      this.render();
      run.then(() => {
        if (this.dlg?.open && this.id === id) this.load(true);
      });
    } else if (act === "retry") {
      this.load();
    } else if (["copy", "pane", "lsort", "lq-clear"].includes(act)) {
      return super.onClick(el);
    } else return false;
    return true;
  }

  // ----- Formate -----

  _ms(v) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return "–";
    return v >= 1000 ? `${(v / 1000).toLocaleString(this._locale(), { maximumFractionDigits: 1 })} s` : `${Math.round(v)} ms`;
  }

  _num(v) {
    return Number.isFinite(Number(v)) ? Number(v).toLocaleString(this._locale()) : "–";
  }

  _host(item) {
    try {
      return new URL(item.url).hostname;
    } catch {
      return "";
    }
  }

  // Zustand eines Dienstes: aus dem Protokoll (seit wann), sonst aus dem letzten Lebenszeichen (gleich nach dem Update gibt es noch kein Protokoll)
  _state(item) {
    const live = this.data?.id === item.id ? this.data.state : null;
    if (live?.state) return live;
    if (item.log?.state) return item.log;
    if (item.status) return { state: item.status.result !== "ok" ? "fail" : (item.status.sent === "fail" || item.status.sent === "alarm") && !item.status.test ? "report" : "ok", since: null };
    return { state: null, since: null };
  }

  _stateText(s) {
    const text = this._t({ ok: "hlStOk", report: "hlStReport", fail: "hlStFail" }[s.state] || "hlStNone");
    return s.since ? `${text} ${this._t("since", { time: this.host._fmtTime(s.since) })}` : text;
  }

  _result(e) {
    if (e.result === "timeout") return this._t("hcStTimeout");
    if (e.result === "error") return this._t("hcStError");
    return e.code === null || e.code === undefined ? "–" : `HTTP ${e.code}`;
  }

  _by(e) {
    return this._t(`hlBy_${e.by}`);
  }

  // ----- Rahmen -----

  render() {
    const dlg = this.dlg;
    if (!dlg || !this.id) return;
    const item = this.item();
    if (!item) {
      this.close();
      return;
    }
    const t = (k, v) => this._t(k, v);
    const state = this._state(item);
    const pill = { ok: "", report: "act", fail: "err" }[state.state] ?? "off";
    const host = this._host(item);
    const known = suggest(item.url);
    const every = t("hlEvery", { time: fmtDur(item.interval) });
    const sub = (this.narrow ? [host, every] : [host, known?.name, every]).filter(Boolean).join(" · ");
    const d = this.data?.id === this.id ? this.data : null;
    const tileValue = {
      history: this._stateText(state),
      latency: this._ms(d?.last?.ms),
      service: known?.name || host,
    };
    const tiles = TABS.map((tab) => `<button type="button" class="ag-sv-tile ${tab === this.tab ? "on" : ""}" data-sv="tab" data-tab="${tab}" role="tab" aria-selected="${tab === this.tab}">
        <span class="ag-sv-ti">${ic(TAB_ICON[tab], 22)}</span><span class="ag-sv-tx"><small>${esc(t(`hlTab_${tab}`))}</small><b>${esc(tileValue[tab])}</b></span></button>`).join("");
    const menu = this.items.map((i) => {
      const s = this._state(i);
      const on = i.id === this.id;
      return `<button type="button" class="ag-hl-mi ${on ? "on" : ""}" role="option" aria-selected="${on}" data-sv="pick" data-id="${esc(i.id)}"><span class="ag-sv-dot ${s.state || "none"}"></span>
        <span class="ag-hl-mt"><b>${esc(i.name || this._host(i))}</b><small>${esc([this._host(i), this._stateText(s)].filter(Boolean).join(" · "))}</small></span>${on ? ic("check", 20) : ""}</button>`;
    }).join("");
    const body = this.tab === "service" ? this._serviceHtml(item, d, state) : this._chartHtml();
    this.host._setHtml(dlg, `<div class="ag-sv ag-hl" data-tab="${this.tab}" ${body.busy ? "data-busy" : ""}>
      <div class="ag-sv-fix">
        <div class="ag-sv-head"><span class="ag-oav ag-tint ag-tint-health on">${ic("heartPulse", 24)}</span>
          <div class="ag-sv-ttl"><button type="button" class="ag-hl-pick" data-sv="menu" aria-haspopup="listbox" aria-expanded="${this.menu}" title="${esc(t("hlSwitch"))}"><b>${esc(item.name || host)}</b>${ic("arrowDown", 18)}</button><small>${esc(sub)}</small></div>
          <span class="ag-sv-pill ${pill}">${esc(this._stateText({ state: state.state }))}</span>
          ${this._actsHtml(item)}
          <div class="ag-hl-menu" role="listbox" aria-label="${esc(t("hlSwitch"))}" ${this.menu ? "" : "hidden"}>${menu}</div></div>
        <div class="ag-seg ag-sv-tiles n3" data-seg="sv-tabs" role="tablist">${tiles}</div>
        ${body.fix}
      </div>
      <div class="ag-sv-list">${body.list}</div></div>`);
    if (body.busy) loaderStart(this.host._root, this.host);
    this.host._placePills?.();
  }

  // Oben rechts (seit 1.69.0, Wunsch des Nutzers 2026-11-19, 21:50, statt nur "Bearbeiten"): "Fehler senden", "Lebenszeichen senden" und der
  // Stift, dieselben runden Knöpfe mit denselben Symbolen und in derselben Reihenfolge wie in der Liste der Dienste
  _actsHtml(item) {
    const t = (k) => this._t(k);
    const hc = this.host.healthcheck;
    const busy = (kind) => Boolean(hc.busy?.has(`${item.id}|${kind}`));
    const btn = (act, icon, label, off = false) => `<button type="button" class="ag-iconbtn" data-sv="${act}" title="${esc(label)}" aria-label="${esc(label)}" ${off ? "disabled" : ""}>${ic(icon, 18)}</button>`;
    return `<div class="ag-wf-btns ag-hcbtns ag-sv-ha ag-hl-acts">${item.fail_suffix ? btn("test-fail", "alert", t("hcTestFail"), busy("fail")) : ""}${item.alarm_suffix ? btn("test-alarm", "bell", t("hcTestAlarm"), busy("alarm")) : ""}${btn("test-ok", "check", t("hcTestOk"), busy("ok"))}${btn("edit", "pencil", t("hcEdit"))}</div>`;
  }

  _rangeSeg() {
    return `<div class="ag-seg ag-sv-range" data-seg="sv-range" role="group">${RANGES.map((h) => `<button type="button" data-sv="range" data-hours="${h}" class="${h === this.range ? "on" : ""}" aria-pressed="${h === this.range}">${esc(this._t(RANGE_LABEL[h]))}</button>`).join("")}</div>`;
  }

  // Verlauf und Antwortzeit: Zeitraum, Kennzahlen, Grafik, Legende; darunter die Liste. Mit alten Daten bleibt alles gedimmt stehen und die
  // Ladeanzeige liegt über der Grafik (wie in der Sensoransicht); beim ersten Laden steht sie in einer leeren Fläche.
  _chartHtml() {
    const seg = this._rangeSeg();
    if (this.error) return { fix: `${seg}<div class="ag-sv-msg">${esc(this._t("svError"))} <span class="ag-t2">${esc(this.error)}</span><br><button type="button" class="ag-btn" data-sv="retry">${esc(this._t("svRetry"))}</button></div>`, list: "" };
    const d = this.data;
    if (!d || d.id !== this.id) return { fix: `${seg}<div class="ag-sv-chart ag-sv-wait">${this._loader()}</div>`, list: "", busy: true };
    const busy = d.hours !== this.range;
    const s = d.summary;
    const W = this.narrow ? 358 : 832;
    const wide = !this.narrow;
    const t = (k, v) => this._t(k, v);
    let kpis;
    let chart;
    let legend;
    if (this.tab === "latency") {
      kpis = [[this._ms(d.last?.ms), t("hlKLast")], [this._ms(s.ms_mean), t("svKMean")], [this._ms(s.ms_max), t("hlKSlowest")], wide && [this._num(s.no_answer), t("hlKNoAnswer")]];
      chart = this._latency(d, W);
      // Wie im Mockup: die Zonen stehen in der Grafik, die Legende erklärt nur die Marke
      legend = this._legend([["hl-i-failmark", t(d.hours > 720 ? "hlLegFailDay" : "hlLegFailMark")]]);
    } else {
      const daily = d.hours > 720;
      kpis = [[s.rate === null || s.rate === undefined ? "–" : `${s.rate.toLocaleString(this._locale(), { maximumFractionDigits: daily ? 2 : 1 })} %`, t("hlKRate")], [this._num(s.total), t("hlKCalls")],
        [this._num(s.fail), t("hlKFail")], wide && [this._num(s.report), t("hlKReport")], wide && [this._ms(s.ms_mean), t("hlKMean")]];
      chart = d.hours <= 24 ? this._heartbeat(d, W) : d.hours <= 168 ? this._timeline(d, W) : daily ? this._monthRaster(d, W) : this._raster(d, W);
      legend = daily
        ? this._legend([["hl-i ok", t(wide ? "hlLegDayOk" : "hlLegOkShort")], ["hl-i report", t("hlLegReport")], ["hl-i fail", t("hlLegFail")],
          ["hl-i gap", wide ? t("hlLegGapDay", { n: d.gap_day ?? 30 }) : t("hlLegGapShort")], ["hl-i test dot", t("hlLegTest")]])
        : this._legend([["hl-i ok", t(wide ? "hlLegOk" : "hlLegOkShort")], ["hl-i report", t("hlLegReport")], ["hl-i fail", t("hlLegFail")], ["hl-i test", t("hlLegTest")],
          ["hl-i gap", t(wide ? "hlLegGap" : "hlLegGapShort")]]);
    }
    if (!d.since) chart = `<div class="ag-sv-msg ag-t2">${esc(t("hlNoData"))}</div>`;
    return { fix: `${seg}${this._kpis(kpis)}<div class="ag-sv-chart">${chart}${busy ? this._loader() : ""}</div>${d.since ? legend : ""}`, list: this._listArea(this._paneSpec(d)), busy };
  }

  // ----- Grafiken -----

  // Abschnitte eines Zeitraums mit den Aufrufen darin (Herzschlag und Antwortzeit bis 1 Tag)
  _buckets(d, n) {
    const now = ms(d.now);
    const start = ms(d.start);
    const step = (now - start) / n;
    const out = Array.from({ length: n }, (_v, i) => ({ a: start + i * step, b: start + (i + 1) * step, calls: [] }));
    for (const [iso, kind, v] of d.points) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((ms(iso) - start) / step)));
      out[i].calls.push({ kind, ms: v });
    }
    return out;
  }

  _gaps(d) {
    return (d.gaps || []).map(([a, b]) => [ms(a), ms(b)]);
  }

  _inGap(gaps, a, b, min = 0) {
    return gaps.some(([ga, gb]) => Math.min(b, gb) - Math.max(a, ga) > min);
  }

  // Schöne Höchstwerte der Achse in Millisekunden (mindestens `floor`)
  _msScale(values, floor) {
    const top = Math.max(floor, ...values.filter(Number.isFinite));
    if (top <= floor) return floor;
    const step = top <= 3000 ? 300 : top <= 6000 ? 1000 : 2000;
    return Math.ceil(top / step) * step;
  }

  // Bis 1 Tag: "Herzschlag". Je Abschnitt ein Balken in der Farbe des schlechtesten Ergebnisses, die Höhe ist die mittlere Antwortzeit (gescheitert:
  // ganz hoch); darunter ein Band mit dem Ergebnis je Abschnitt, Fehler, gemeldete Fehler und Tests als breitere Marke (ein einzelner Aufruf fällt auf).
  // Lücken ohne Daten grau. Am Computer 5 Minuten je Abschnitt, auf dem Handy breiter.
  _heartbeat(d, W) {
    const narrow = W < 500;
    const H = narrow ? 150 : 184;
    const L = 50;
    const R = W - 6;
    const top = 12;
    const laneH = 9;
    const bottom = H - 24 - laneH - 6;
    const lane = bottom + 6;
    const now = ms(d.now);
    const start = ms(d.start);
    const n = narrow ? (d.hours <= 3 ? 36 : d.hours <= 12 ? 72 : 96) : d.hours * 12;
    const bw = (R - L) / n;
    const gaps = this._gaps(d);
    const buckets = this._buckets(d, n).map((b) => {
      const worst = b.calls.reduce((m, c) => (RANK[c.kind] > RANK[m] ? c.kind : m), "ok");
      const times = b.calls.filter((c) => c.kind !== "fail" && Number.isFinite(c.ms)).map((c) => c.ms);
      return { ...b, worst, mean: times.length ? times.reduce((x, y) => x + y, 0) / times.length : null };
    });
    const max = this._msScale(buckets.map((b) => b.mean), 600);
    const y = (v) => bottom - (Math.min(max, v) / max) * (bottom - top);
    let s = "";
    for (const g of [0, max / 2, max]) s += `<line class="sv-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${this._txt(L - 6, y(g) + 4, g ? this._ms(g) : "0", "end")}`;
    s += `<rect class="sv-track" x="${L}" y="${lane}" width="${R - L}" height="${laneH}" rx="2"/>`;
    // Das Band zeigt den Zustand ohne Unterbruch: zwischen zwei Aufrufen gilt der letzte (gescheitert bleibt rot bis zum nächsten, der ankommt; ein
    // Test ändert nichts). Vor dem ersten Aufruf des Protokolls und in Lücken nicht.
    const since = d.since ? ms(d.since) : Infinity;
    let carried = null;
    buckets.forEach((b, i) => {
      const x = L + i * bw + (bw > 3 ? 0.6 : 0.25);
      const w = Math.max(0.8, bw - (bw > 3 ? 1.2 : 0.5));
      const laneAt = (cls) => `<rect class="hl-lane ${cls}" x="${(L + i * bw).toFixed(2)}" y="${lane}" width="${(bw + 0.3).toFixed(2)}" height="${laneH}"/>`;
      for (const c of b.calls) if (c.kind !== "test") carried = c.kind;
      if (!b.calls.length) {
        if (this._inGap(gaps, b.a, b.b)) {
          s += `<rect class="hl-gap" x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(2)}" height="${bottom - top}" rx="1"/>${laneAt("gap")}`;
          carried = null;
        } else if (carried && b.a >= since) s += laneAt(carried);
        return;
      }
      const yy = Math.min(b.worst === "fail" ? y(max) : y(b.mean ?? 0), bottom - 6);
      s += `<rect class="hl-b ${b.worst}" data-kind="${b.worst}" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${w.toFixed(2)}" height="${(bottom - yy).toFixed(1)}" rx="${bw > 3 ? 1.2 : 0.4}"/>`;
      s += laneAt(b.worst);
    });
    for (const [iso, kind] of d.points) {
      if (kind === "ok") continue;
      const cx = L + ((ms(iso) - start) / (now - start)) * (R - L);
      s += `<rect class="hl-lane ${kind} mark" x="${(cx - 2).toFixed(1)}" y="${lane - 2}" width="4" height="${laneH + 4}" rx="2"/>`;
    }
    for (const [tt, anchor, x] of [[start, "start", L], [(start + now) / 2, "middle", (L + R) / 2], [now, "end", R]]) s += this._txt(x, H - 6, this._clock(tt), anchor);
    return this._svg(W, H, s, this._t("hlChartBeat"));
  }

  // Grüne Strecken eines Abschnitts: vom Beginn des Protokolls bis jetzt, ohne die Lücken
  _okSpans(d, a, b) {
    const from = Math.max(a, ms(d.since));
    const to = Math.min(b, ms(d.now));
    if (to <= from) return [];
    const out = [];
    let cur = from;
    for (const [ga, gb] of this._gaps(d).filter(([ga, gb]) => gb > from && ga < to).sort((p, q) => p[0] - q[0])) {
      if (ga > cur) out.push([cur, ga]);
      cur = Math.max(cur, gb);
    }
    if (to > cur) out.push([cur, to]);
    return out;
  }

  // Der Tag eines Zeitpunkts als Zeile (Tage über den Kalender, nicht über 24 Stunden: ein Tag der Zeitumstellung hat 23 oder 25)
  _dayIndex(days) {
    const index = new Map(days.map((day, i) => [day.toDateString(), i]));
    return (time) => index.get(new Date(time).toDateString());
  }

  // 7 Tage: Zeitleiste je Tag wie Türen und Fenster. Grün, solange Lebenszeichen ankommen, grau eine Lücke ohne Daten, Marken für gescheitert, Fehler
  // gemeldet und Test (aus den Ereignissen, auf die Minute genau; einzelne Aufrufe gibt es nach 24 Stunden nicht mehr)
  _timeline(d, W) {
    const narrow = W < 500;
    const days = this._days(d);
    const L = narrow ? 52 : 70;
    const R = W - 6;
    const rowH = 16;
    const gap = 9;
    const top = 6;
    const H = top + days.length * (rowH + gap) + 18;
    const gaps = this._gaps(d);
    let s = "";
    days.forEach((day, r) => {
      const a = day.getTime();
      const b = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
      const y = top + r * (rowH + gap);
      // Die Zeile zeigt 0 bis 24 Uhr; an einem Tag mit 25 Stunden endet ein Balken am rechten Rand
      const x = (tt) => Math.min(R, L + ((tt - a) / (24 * HOUR)) * (R - L));
      s += this._txt(L - 8, y + 12, this._shortDay(day), "end", r === days.length - 1 ? "now" : "");
      s += `<rect class="sv-track" x="${L}" y="${y}" width="${R - L}" height="${rowH}" rx="4"/>`;
      for (const [sa, sb] of this._okSpans(d, a, b)) s += `<rect class="hl-band ok" x="${x(sa).toFixed(1)}" y="${y}" width="${Math.max(0.5, x(sb) - x(sa)).toFixed(1)}" height="${rowH}" rx="3"/>`;
      for (const [ga, gb] of gaps) {
        const ca = Math.max(a, ga);
        const cb = Math.min(b, gb);
        if (cb > ca) s += `<rect class="hl-band gap" x="${x(ca).toFixed(1)}" y="${y}" width="${Math.max(2, x(cb) - x(ca)).toFixed(1)}" height="${rowH}" rx="3"/>`;
      }
      for (const [ta, tb, kind] of d.marks || []) {
        const ma = Math.max(a, ms(ta));
        const mb = Math.min(b, tb ? ms(tb) : ms(ta));
        if (ms(ta) >= b || (tb ? ms(tb) : ms(ta)) < a) continue;
        s += `<rect class="hl-b ${kind}" data-kind="${kind}" x="${x(ma).toFixed(1)}" y="${y - 2}" width="${Math.max(3, x(mb) - x(ma)).toFixed(1)}" height="${rowH + 4}" rx="1.5"/>`;
      }
    });
    const xh = (h) => L + (h / 24) * (R - L);
    for (const h of narrow ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]) s += this._txt(xh(h), H - 4, `${String(h).padStart(2, "0")}:00`, h === 0 ? "start" : h === 24 ? "end" : "middle");
    return this._svg(W, H, s, this._t("hlChartDays"));
  }

  // 30 Tage: Raster wie bei Bewegung (Entscheid des Nutzers, "Vorschlag 1"). Eine Zeile je Tag, eine Zelle je Stunde in der Farbe des schlechtesten
  // Ergebnisses dieser Stunde; ruhige Stunden blass grün, eine Stunde mit mehr als einer halben Stunde Lücke grau, vor dem Protokoll und die Zukunft leer
  _raster(d, W) {
    const days = this._days(d);
    const L = 50;
    const R = W - 4;
    const top = 4;
    const cw = (R - L) / 24;
    const ch = W > 500 ? 6.2 : 5.6;
    const gap = 1.3;
    const now = ms(d.now);
    const since = ms(d.since);
    const gaps = this._gaps(d);
    const dayOf = this._dayIndex(days);
    // Stundenwerte des Servers in die Zelle ihrer Mitte (so passen sie auch in Zeitzonen mit halben Stunden)
    const cells = new Map();
    for (const [iso, ok, report, fail, test] of d.hourly) {
      const mid = new Date(ms(iso) + HOUR / 2);
      const i = dayOf(mid.getTime());
      if (i === undefined) continue;
      const key = `${i}|${mid.getHours()}`;
      const c = cells.get(key) || { ok: 0, report: 0, fail: 0, test: 0 };
      cells.set(key, { ok: c.ok + ok, report: c.report + report, fail: c.fail + fail, test: c.test + test });
    }
    let s = "";
    days.forEach((day, i) => {
      const y = top + i * (ch + gap);
      for (let h = 0; h < 24; h++) {
        const a = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).getTime();
        const b = a + HOUR;
        const x = (L + h * cw + 0.8).toFixed(1);
        const w = (cw - 1.6).toFixed(1);
        const c = cells.get(`${i}|${h}`);
        const worst = c ? ["fail", "report", "test"].find((k) => c[k] > 0) : null;
        let cls = "sv-track";
        if (worst) cls = `hl-b ${worst}`;
        else if (a >= now || b <= since) cls = "sv-track";
        else if (this._inGap(gaps, a, b, HOUR / 2)) cls = "hl-cell gap";
        else cls = "hl-cell ok";
        s += `<rect class="${cls}" ${worst ? `data-kind="${worst}"` : ""} x="${x}" y="${y.toFixed(1)}" width="${w}" height="${ch}" rx="1.5"/>`;
      }
      if (i === 0 || i === days.length - 1 || i % 5 === 4) s += this._txt(L - 8, y + ch / 2 + 4, this._shortDay(day), "end", i === days.length - 1 ? "now" : "");
    });
    const base = top + days.length * (ch + gap);
    for (const h of W < 500 ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]) s += this._txt(L + h * cw, base + 12, `${String(h).padStart(2, "0")}:00`, h === 24 ? "end" : h === 0 ? "start" : "middle");
    return this._svg(W, base + 18, s, this._t("hlChartHours"));
  }

  // Tag als Schlüssel der Tageswerte (JJJJ-MM-TT, Ortszeit wie der Server) und seine Mitte (Mittag; ein Tag der Zeitumstellung hat 23 oder 25 Stunden)
  _dayKey(day) {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }

  _dayMid(day) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
  }

  // Art eines Tages: gescheitert vor Fehler gemeldet vor Lücke (ab `gap_day` Minuten ohne Daten) vor in Ordnung; "none" vor dem Protokoll und in der
  // Zukunft. Ein Tag nach dem Beginn ohne einen einzigen Aufruf ist eine Lücke.
  _dayKind(d, day, row) {
    const start = day.getTime();
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    if (!d.since || end <= ms(d.since) || start > ms(d.now)) return "none";
    if (!row) return "gap";
    if (row[3] > 0) return "fail";
    if (row[2] > 0) return "report";
    if (row[8] >= (d.gap_day ?? 30) || row[1] + row[2] + row[3] + row[4] === 0) return "gap";
    return "ok";
  }

  // 6 Monate und 1 Jahr: Raster Monat × Tag (Entscheid des Nutzers 2026-11-19, 18:35, Mockup v3 "B"), das Raster der 30 Tage eine Stufe gröber. Eine
  // Zeile je Monat, eine Zelle je Tag in der Farbe des Tages; am Computer ein Test als blauer Punkt. Tage ausserhalb des Zeitraums bleiben leer.
  _monthRaster(d, W) {
    const narrow = W < 500;
    const days = this._days(d);
    const rows = new Map(d.daily.map((row) => [row[0], row]));
    const inRange = new Set(days.map((day) => this._dayKey(day)));
    const months = [];
    for (const day of days) {
      const key = `${day.getFullYear()}-${day.getMonth()}`;
      if (!months.length || months.at(-1).key !== key) months.push({ key, year: day.getFullYear(), month: day.getMonth() });
    }
    const L = 56;
    const R = W - 4;
    const top = 4;
    const cw = (R - L) / 31;
    const ch = narrow ? 9.5 : 15;
    const gap = narrow ? 2 : 3;
    const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString(this._locale(), { month: "short" }).replace(".", "");
    let s = "";
    months.forEach((m, r) => {
      const y = top + r * (ch + gap);
      const len = new Date(m.year, m.month + 1, 0).getDate();
      for (let n = 1; n <= len; n++) {
        const day = new Date(m.year, m.month, n);
        const key = this._dayKey(day);
        const x = (L + (n - 1) * cw + 0.8).toFixed(1);
        const w = (cw - 1.6).toFixed(1);
        if (!inRange.has(key)) {
          s += `<rect class="sv-track hl-out" x="${x}" y="${y.toFixed(1)}" width="${w}" height="${ch}" rx="2"/>`;
          continue;
        }
        const row = rows.get(key);
        const kind = this._dayKind(d, day, row);
        const cls = kind === "none" ? "sv-track" : kind === "ok" ? "hl-cell ok" : kind === "gap" ? "hl-cell gap" : `hl-b ${kind}`;
        s += `<rect class="${cls}" data-day="${key}" data-kind="${kind}" x="${x}" y="${y.toFixed(1)}" width="${w}" height="${ch}" rx="2"/>`;
        if (!narrow && row?.[4] > 0) s += `<circle class="hl-dot test" cx="${(L + (n - 0.5) * cw).toFixed(1)}" cy="${(y + ch / 2).toFixed(1)}" r="2.2"/>`;
      }
      const label = `${monthName(m.year, m.month)}${r === 0 || m.month === 0 ? ` ’${String(m.year).slice(2)}` : ""}`;
      s += this._txt(L - 8, y + ch / 2 + 4, label, "end", r === months.length - 1 ? "now" : "");
    });
    const base = top + months.length * (ch + gap);
    for (const n of narrow ? [1, 8, 15, 22, 29] : [1, 5, 10, 15, 20, 25, 31]) s += this._txt(L + (n - 0.5) * cw, base + 12, `${n}.`);
    // Darunter die Zahl der Tage mit Ausfall, mit Fehlermeldung und mit Lücke (und seit wann aufgezeichnet, wenn das Protokoll jünger ist)
    const count = { fail: 0, report: 0, gap: 0 };
    for (const day of days) {
      const kind = this._dayKind(d, day, rows.get(this._dayKey(day)));
      if (kind in count) count[kind]++;
    }
    const part = (kind, n) => `<span><b>${n}</b> ${esc(this._t(`hlDays_${kind}${n === 1 ? "1" : ""}`))}</span>`;
    const since = d.since && ms(d.since) > ms(d.start) ? `<span>${esc(this._t("hlRecordedSince", { date: new Date(d.since).toLocaleDateString(this._locale(), { day: "numeric", month: "short", year: "numeric" }) }))}</span>` : "";
    return `${this._svg(W, base + 18, s, this._t("hlChartMonths"))}<div class="ag-hl-sum">${part("fail", count.fail)}${part("report", count.report)}${part("gap", count.gap)}${since}</div>`;
  }

  // Kachel "Antwortzeit" (Mockup v1, "genau so umsetzen"): Linie mit Fläche wie "Empfang", Zonen schnell, langsam, sehr langsam; je gescheitertem
  // Aufruf eine gestrichelte rote Marke. Bis 1 Tag aus den Aufrufen, darüber aus den Stundenwerten; über eine Lücke ohne Daten läuft die Linie nicht.
  _latency(d, W) {
    const H = 150;
    const L = 50;
    const R = W - 6;
    const top = 10;
    const bottom = H - 22;
    const now = ms(d.now);
    const start = ms(d.start);
    const gaps = this._gaps(d);
    const n = W > 500 ? (d.hours <= 24 ? 96 : 168) : d.hours <= 24 ? 48 : 84;
    let pts;
    let fails;
    if (d.hours <= 24) {
      pts = this._buckets(d, n).map((b) => {
        const times = b.calls.filter((c) => c.kind !== "fail" && Number.isFinite(c.ms)).map((c) => c.ms);
        return times.length ? [(b.a + b.b) / 2, times.reduce((x, y) => x + y, 0) / times.length] : null;
      }).filter(Boolean);
      fails = d.points.filter((p) => p[1] === "fail").map((p) => ms(p[0]));
    } else if (d.hours > 720) {
      // Tageswerte (6 Monate, 1 Jahr): je Abschnitt das Mittel, gewichtet mit der Zahl der Aufrufe mit Antwort (Computer 1 oder 2 Tage, Handy 2 oder
      // 7 Tage); eine Marke an jedem Tag mit gescheitertem Aufruf. Ein Abschnitt ohne Antwort unterbricht die Linie.
      const per = W > 500 ? (d.hours > 4320 ? 2 : 1) : d.hours > 4320 ? 7 : 2;
      const days = this._days(d);
      const index = new Map(days.map((day, i) => [this._dayKey(day), i]));
      const sums = new Map();
      for (const [key, ok, report, , test, avg] of d.daily) {
        const i = index.get(key);
        if (i === undefined || avg === null || avg === undefined) continue;
        const chunk = Math.floor(i / per);
        const weight = Math.max(1, ok + report + test);
        const cur = sums.get(chunk) || [0, 0];
        sums.set(chunk, [cur[0] + avg * weight, cur[1] + weight]);
      }
      const mid = (chunk) => {
        const a = days[chunk * per];
        const b = days[Math.min(days.length - 1, chunk * per + per - 1)];
        return (this._dayMid(a) + this._dayMid(b)) / 2;
      };
      pts = [...sums.entries()].sort((a, b) => a[0] - b[0]).map(([chunk, [sum, count]]) => [mid(chunk), sum / count, chunk]);
      fails = d.daily.filter((row) => row[3] > 0 && index.has(row[0])).map((row) => this._dayMid(days[index.get(row[0])]));
    } else {
      // Stundenwerte zu Abschnitten zusammenfassen (gewichtet mit der Zahl der Aufrufe mit Antwort)
      const step = (now - start) / n;
      const sums = Array.from({ length: n }, () => [0, 0]);
      for (const [iso, ok, report, , test, avg] of d.hourly) {
        if (avg === null || avg === undefined) continue;
        const i = Math.min(n - 1, Math.max(0, Math.floor((ms(iso) + HOUR / 2 - start) / step)));
        const weight = Math.max(1, ok + report + test);
        sums[i][0] += avg * weight;
        sums[i][1] += weight;
      }
      pts = sums.map(([sum, count], i) => (count ? [start + (i + 0.5) * step, sum / count] : null)).filter(Boolean);
      fails = (d.marks || []).filter((m) => m[2] === "fail").map((m) => ms(m[0]));
    }
    if (!pts.length) return `<div class="ag-sv-msg ag-t2">${esc(this._t("hlNoTimes"))}</div>`;
    const max = this._msScale(pts.map((p) => p[1]), 1200);
    const x = (tt) => L + ((tt - start) / (now - start)) * (R - L);
    const y = (v) => bottom - (Math.min(max, v) / max) * (bottom - top);
    let s = "";
    for (const [from, to, cls, label] of [[0, FAST, "ok", "hlZoneFast"], [FAST, SLOW, "warn", "hlZoneSlow"], [SLOW, max, "err", "hlZoneVerySlow"]]) {
      // Beschriftung links: rechts liegt der letzte Wert (Punkt) und oft die Marke eines gescheiterten Aufrufs
      s += `<rect class="sv-zone ${cls}" x="${L}" y="${y(to).toFixed(1)}" width="${R - L}" height="${(y(from) - y(to)).toFixed(1)}"/>${this._txt(L + 6, y(to) + 13, this._t(label), "start", cls)}`;
    }
    for (const g of [0, max / 2, max]) s += `<line class="sv-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${this._txt(L - 6, y(g) + 4, g ? this._ms(g) : "0", "end")}`;
    // Linien je Abschnitt ohne Lücke dazwischen
    const parts = [];
    for (const p of pts) {
      const prev = parts.at(-1)?.at(-1);
      if (!prev || this._inGap(gaps, prev[0], p[0]) || (p[2] !== undefined && p[2] - prev[2] > 1)) parts.push([p]);
      else parts.at(-1).push(p);
    }
    for (const part of parts) {
      const path = part.map(([tt, v], i) => `${i ? "L" : "M"}${x(tt).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const ends = part.length > 1 ? ` L${x(part.at(-1)[0]).toFixed(1)},${bottom} L${x(part[0][0]).toFixed(1)},${bottom} Z` : "";
      if (ends) s += `<path class="sv-area" d="${path}${ends}"/>`;
      s += part.length > 1 ? `<path class="sv-line" d="${path}"/>` : `<circle class="sv-dot" cx="${x(part[0][0]).toFixed(1)}" cy="${y(part[0][1]).toFixed(1)}" r="2.5"/>`;
    }
    for (const f of fails) if (f >= start && f <= now) s += `<line class="hl-failmark" x1="${x(f).toFixed(1)}" y1="${top}" x2="${x(f).toFixed(1)}" y2="${bottom}"/>`;
    const last = pts.at(-1);
    s += `<circle class="sv-dot" cx="${x(last[0]).toFixed(1)}" cy="${y(last[1]).toFixed(1)}" r="4.5"/>`;
    const label = (tt) => (d.hours <= 24 ? this._clock(tt) : new Date(tt).toLocaleDateString(this._locale(), { day: "numeric", month: "short" }));
    for (const [tt, anchor, xx] of [[start, "start", L], [(start + now) / 2, "middle", (L + R) / 2], [now, "end", R]]) s += this._txt(xx, H - 6, label(tt), anchor);
    return this._svg(W, H, s, this._t("hlChartLatency"));
  }

  // ----- Liste: Ereignisse und alle Aufrufe -----

  _paneSpec(d) {
    return this.pane === "calls" ? this._callsSpec(d) : this._eventsSpec(d);
  }

  _notes(d) {
    const notes = [];
    if (d.since && ms(d.since) - ms(d.start) > HOUR) notes.push(this._t("hlListFrom", { date: new Date(d.since).toLocaleDateString(this._locale(), { day: "numeric", month: "long" }) }));
    return notes;
  }

  _eventText(e) {
    const t = (k, v) => this._t(k, v);
    let text;
    if (e.kind === "fail") text = t("hlEvFail");
    else if (e.kind === "report" && e.sent === "alarm") text = t("hlEvAlarm");
    else if (e.kind === "report") text = e.problems ? t(e.problems === 1 ? "hlEvReportOne" : "hlEvReportMany", { n: e.problems }) : t("hlEvReport");
    else if (e.kind === "test") text = t(e.sent === "alarm" ? "hlEvTestAlarm" : e.sent === "fail" ? "hlEvTestFail" : "hlEvTestOk");
    else if (e.kind === "back") text = t(e.from === "report" ? "hlEvBackReport" : "hlEvBack");
    else text = t("hlEvStart");
    // Eine Folge gescheiterter Aufrufe (oder gemeldeter Fehler) ist ein Ereignis mit Anzahl und Ende
    return e.n > 1 && e.end ? `${text} (${t("hlEvCount", { n: e.n, time: this._clock(e.end) })})` : text;
  }

  _callText(c) {
    if (c.kind === "test") return this._t(c.sent === "alarm" ? "hlEvTestAlarm" : c.sent === "fail" ? "hlEvTestFail" : "hlEvTestOk");
    if (c.kind === "report" && c.sent === "alarm") return this._t("hlEvAlarm");
    return this._t({ ok: "hcStOkSent", report: "hlEvReport", fail: "hlEvFail" }[c.kind] || "hlEvFail");
  }

  // Zeilen wie die Ereignisse der Sensoransicht: Zeit, Ereignis (mit Punkt in der Farbe), Ergebnis, Antwortzeit, Auslöser; auf dem Handy Ergebnis und
  // Antwortzeit klein unter dem Ereignis
  _rows(list, text, dotOf) {
    return list.map((e) => {
      const tt = ms(e.t);
      const what = text(e);
      const res = this._result(e);
      const time = this._ms(e.ms);
      const by = this._by(e);
      const dot = `<span class="ag-sv-dot ${dotOf(e)}"></span>`;
      const tag = `<span class="ag-sv-tag">${esc(by)}</span>`;
      return {
        t: tt,
        sort: { time: tt, event: what, result: res, ms: Number.isFinite(e.ms) ? e.ms : Infinity, by },
        hay: [what, res, time, by, this._dayLabel(new Date(tt)), this._clock(e.t), this._clockSec(e.t)],
        wide: (when) => `<tr data-kind="${e.kind}"><td>${esc(when)}</td><td><span class="ag-sv-ev">${dot}${esc(what)}</span></td><td>${esc(res)}</td><td>${esc(time)}</td><td>${tag}</td></tr>`,
        narrow: (when) => `<tr data-kind="${e.kind}"><td>${esc(when)}</td><td><span class="ag-sv-ev">${dot}<span>${esc(what)}<small>${esc(e.ms === null || e.ms === undefined ? res : `${res} · ${time}`)}</small></span></span></td><td class="r">${tag}</td></tr>`,
      };
    });
  }

  _cols() {
    return {
      cols: [["time", "svColTime", "c1"], ["event", "svColEvent", ""], ["result", "hlColResult", "c5"], ["ms", "hlColMs", "c5"], ["by", "hlColBy", "c6"]],
      ncols: [["time", "svColTime", ""], ["event", "svColEvent", ""], ["by", "hlColBy", "r"]],
    };
  }

  _eventsSpec(d) {
    const notes = this._notes(d);
    const total = Number.isInteger(d.events_total) ? d.events_total : d.events.length;
    if (d.events.length < total) notes.push(this._t("svListTruncated", { shown: d.events.length, total }));
    return {
      rows: this._rows(d.events, (e) => this._eventText(e), (e) => e.kind),
      total,
      notes,
      seconds: true,
      ...this._cols(),
      empty: `<div class="ag-sv-msg ag-t2">${esc(this._t(d.since ? "hlNoEvents" : "hlNoData"))}</div>`,
    };
  }

  _callsSpec(d) {
    const notes = this._notes(d);
    const total = Number.isInteger(d.calls_total) ? d.calls_total : d.calls.length;
    if (d.calls.length < total) notes.push(this._t("hlCallsTruncated", { shown: d.calls.length, total }));
    return {
      rows: this._rows(d.calls, (c) => this._callText(c), (c) => c.kind),
      total,
      // Einzelne Aufrufe nur 24 Stunden (Entscheid des Nutzers "ältere nur zusammengefasst"): bei 7 und 30 Tagen zeigt die Liste diese 24 Stunden,
      // und das steht über der Liste
      lead: d.hours > 24 ? [this._t("hlCallsDay")] : [],
      notes,
      seconds: true,
      ...this._cols(),
      empty: `<div class="ag-sv-msg ag-t2">${esc(this._t(d.since ? "hlNoCalls" : "hlNoData"))}</div>`,
    };
  }

  // Reiter "Ereignisse" und "Alle Aufrufe" mit der Zahl des gewählten Zeitraums, Suche; der Hinweis zu den einzelnen Aufrufen steht über der Liste
  _listArea(spec) {
    const d = this.data;
    const pane = this.pane;
    const events = pane === "events" ? spec : this._eventsSpec(d);
    const calls = pane === "calls" ? spec : this._callsSpec(d);
    const btn = (key, label, icon, n) => `<button role="tab" data-sv="pane" data-pane="${key}" class="${pane === key ? "on" : ""}" aria-selected="${pane === key}">${ic(icon, 20)}<span>${esc(this._t(label))}<span class="ag-sv-n">${n}</span></span></button>`;
    const note = (n, cls = "") => `<p class="ag-sv-note ${cls}">${esc(n)}</p>`;
    const search = searchField("data-sv", "lq", this.lq[pane], this._t(pane === "calls" ? "hlSearchCalls" : "svSearchEvents"), this._t("clearSearch"));
    return `<div class="ag-sv-lbar"><div class="ag-seg small ag-sv-panes" role="tablist" data-seg="sv-panes">${btn("events", "svPaneEvents", "alert", events.total)}${btn("calls", "hlPaneCalls", "history", calls.total)}</div>
      ${search}</div>${(spec.lead || []).map((n) => note(n, "ag-hl-lead")).join("")}<div class="ag-sv-rows">${this._rowsHtml(spec, true)}</div>${spec.notes.map((n) => note(n)).join("")}`;
  }

  // ----- Dienst: nur zur Ansicht, wie die Kachel "Gerät" -----

  _serviceHtml(item, d, state) {
    const t = (k, v) => this._t(k, v);
    const known = suggest(item.url);
    const failUrl = item.fail_suffix ? applySuffix(item.url, item.fail_suffix) : null;
    const row = (label, value, mono = false) => (value ? `<div class="ag-sv-drow ${mono ? "ag-hl-mono" : ""}"><span class="ag-t2">${esc(label)}</span><b>${esc(value)}</b>${copyBtn(value, t("svCopy", { name: label }), 'data-sv="copy"', "ag-sv-copy")}</div>` : "");
    // Link zum Dashboard (seit 1.76.0, freiwillig): nur mit Link eine Zeile, als Link (neues Fenster) und mit Kopierknopf; der Server lässt nur http(s) zu
    const pageRow = item.page_url ? `<div class="ag-sv-drow ag-hl-mono"><span class="ag-t2">${esc(t("hcPageRow"))}</span><b><a class="ag-link" data-hl="page" href="${esc(item.page_url)}" target="_blank" rel="noopener noreferrer">${esc(item.page_url)}</a></b>${copyBtn(item.page_url, t("svCopy", { name: t("hcPageRow") }), 'data-sv="copy"', "ag-sv-copy")}</div>` : "";
    const last = d?.last;
    const lastText = last ? [`${this._dayLabel(new Date(last.t))} ${this._clockSec(last.t)}`, this._result(last), last.ms !== null && last.ms !== undefined ? this._ms(last.ms) : null].filter(Boolean).join(" · ") : "";
    const facts = [row(t("hcName"), item.name), row(t("hlSvKnown"), known?.name), pageRow, row(t("hcUrl"), item.url, true), row(t("hcSuffix"), item.fail_suffix || t("hlSvNone"), Boolean(item.fail_suffix)),
      row(t("hlSvFailUrl"), failUrl, true), row(t("hcInterval"), fmtDur(item.interval))].join("");
    const log = [row(t("hlSvState"), this._stateText(state)), row(t("hlSvLast"), lastText),
      row(t("hlSvSince"), d?.since ? new Date(d.since).toLocaleDateString(this._locale(), { day: "numeric", month: "long", year: "numeric" }) : "")].join("");
    return { fix: "", list: `<div class="ag-sv-device"><div class="ag-label">${esc(t("hlTab_service"))}</div><div class="ag-card ag-sv-dcard">${facts}</div>
      <div class="ag-label">${esc(t("hlSvLog"))}</div><div class="ag-card ag-sv-dcard">${log || `<div class="ag-sv-msg ag-t2">${esc(t("hlNoData"))}</div>`}</div>
      <p class="ag-sv-note ag-hl-keep">${esc(t("hlSvKeep"))}</p></div>` };
  }
}
