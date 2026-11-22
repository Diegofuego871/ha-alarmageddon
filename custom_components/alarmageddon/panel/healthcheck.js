// HealthCheck (1.65.0, Wunsch und Entscheide des Nutzers 2026-11-18): Lebenszeichen an externe Dienste (bis zu 5, für alle Anlagen), verwaltet in
// einem Fenster wie Töne, Routinen und Codes. Generisch (Entscheid des Nutzers 21:54): je Eintrag URL, Fehler-Zusatz und Abstand, keine Auswahl
// des Anbieters. Für bekannte Dienste schlägt das Panel den Zusatz vor (`suggest`); der Nutzer hat immer das letzte Wort: ein Vorschlag füllt das
// Feld nur, solange es niemand berührt hat, sonst steht er als "Übernehmen" daneben. Die URL steht ganz in der Tabelle (Entscheid des Nutzers).
// Sofort gespeichert (WebSocket healthcheck_save/_delete), nicht Teil des Entwurfs der Seite. Testknöpfe je Zeile: "Fehler senden", "OK senden".
// Seit 1.66.0 hat jeder Eintrag einen Namen (Pflichtfeld, Wunsch des Nutzers 2026-11-19); in der Liste steht der Name, die URL darunter gekürzt
// (ganz im Tooltip und im Formular). Ein Intervall je Eintrag, kein eigenes bei scharfer Anlage (Entscheid des Nutzers 2026-11-19: der Selbsttest
// prüft dann öfter, und findet er etwas, geht der Fehler sofort hinaus). Knöpfe der Zeile in Kreisen wie bei Routinen und Tönen (`.ag-wf-btns`), auf dem Handy in einer
// eigenen Zeile unter dem Eintrag (Wunsch des Nutzers 2026-11-19). Seit 1.68.0 als erster Knopf "Protokoll" (healthlog.js, Wunsch des Nutzers: an der
// eingekreisten Stelle links von "Fehler senden").
const V = new URL(import.meta.url).search;
const { chapter, ic, esc, errText, fmtDur, iconTitle, matchQuery, searchField } = await import(`./common.js${V}`);

// Tönung der Zeile im Kapitel HealthCheck, auch im Titel der Fenster (1.66.2)
const HC_TINT = "ag-tint ag-tint-health on";
const MIN = 60;
const MAX = 86400;
// Schnellwahl des Abstands (Wunsch des Nutzers: "schlaue" Eingabe); dazu Zahl und Einheit für jeden anderen Wert von 1 Minute bis 24 Stunden
const PRESETS = [60, 300, 900, 3600, 21600, 86400];

// Bekannte Dienste: Name und vorgeschlagene Zusätze, `suffix` für den Fehler des Selbsttests, `alarm` für den Alarm. Nur ein Vorschlag (der Nutzer
// entscheidet), geprüft an den Unterlagen der Dienste (2026-11-21): Healthchecks.io und Better Stack kennen "/fail" und "/<Exit-Code>" und nehmen
// eine Nachricht nur im Körper eines POST an (Alarmageddon sendet nur GET): dort unterscheidet der Exit-Code "/2" den Alarm vom Fehler "/fail".
// Cronitor nimmt die Nachricht als Parameter "message" (URL-kodiert, bis 2000 Zeichen); Uptime Kuma (Quelltext der Push-Route) "msg" bei "status=down".
// Die Nachricht steht auf Englisch (Wunsch des Nutzers 2026-11-20): sie geht an den Dienst, nicht an die Oberfläche.
// `page`: Vorschlag für den freiwilligen Link zum Dashboard (seit 1.76.0, Wunsch des Nutzers 2026-11-22): bei den gehosteten Diensten die Anmeldeseite, bei
// selbst gehosteten (Healthchecks, Uptime Kuma) die Adresse des eigenen Servers; der Nutzer kann ihn ändern, etwa auf sein eigenes Dashboard.
const KNOWN = [
  { name: "Healthchecks.io", suffix: "/fail", alarm: "/2", page: () => "https://healthchecks.io/accounts/login/", test: (u) => u.hostname === "hc-ping.com" },
  { name: "Healthchecks", suffix: "/fail", alarm: "/2", page: (u) => `${u.origin}/`, test: (u) => /^\/ping\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(u.pathname) },
  { name: "Better Stack", suffix: "/fail", alarm: "/2", page: () => "https://uptime.betterstack.com/", test: (u) => /(^|\.)(betterstack\.com|betteruptime\.com)$/.test(u.hostname) && u.pathname.includes("/heartbeat/") },
  { name: "Cronitor", suffix: "?state=fail&message=Self-test+failed", alarm: "?state=fail&message=Alarm+triggered", page: () => "https://cronitor.io/app", test: (u) => u.hostname === "cronitor.link" },
  { name: "Uptime Kuma", suffix: "?status=down&msg=Self-test+failed", alarm: "?status=down&msg=Alarm+triggered", page: (u) => `${u.origin}/dashboard`, test: (u) => u.pathname.includes("/api/push/") },
];

// Beispiele im Fenster (Wunsch des Nutzers 2026-11-19: drei, vier Anbieter zum Aufklappen); dieselben, für die KNOWN den Fehler-Zusatz vorschlägt.
// Seiten geprüft am 2026-11-19. Uptime Kuma läuft beim Nutzer selbst: sinnvoll nur ausserhalb von Home Assistant.
const EXAMPLES = [["Healthchecks.io", "https://healthchecks.io"], ["Cronitor", "https://cronitor.io"], ["Better Stack", "https://betterstack.com"],
  ["Uptime Kuma", "https://github.com/louislam/uptime-kuma", "hcAboutKuma"]];

export function suggest(url) {
  let u;
  try {
    u = new URL(String(url || "").trim());
  } catch {
    return null;
  }
  return KNOWN.find((k) => k.test(u)) || null;
}

// Vorschlag für den Link zum Dashboard eines erkannten Dienstes (sonst null)
export function suggestPage(url) {
  const known = suggest(url);
  if (!known?.page) return null;
  try {
    return known.page(new URL(String(url || "").trim()));
  } catch {
    return null;
  }
}

// Wie der Server (settings.apply_fail_suffix): "/…" an den Pfad, "?…" oder "&…" setzt Parameter und ersetzt gleichnamige; sonst null
export function applySuffix(url, suffix) {
  const s = String(suffix || "").trim();
  if (!s) return null;
  let u;
  try {
    u = new URL(String(url || "").trim());
  } catch {
    return null;
  }
  if (s.startsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "") + s;
    return u.toString();
  }
  if (s[0] === "?" || s[0] === "&") {
    const extra = new URLSearchParams(s.slice(1));
    if (![...extra.keys()].length) return null;
    const keep = [...u.searchParams.entries()].filter(([k]) => !extra.has(k));
    const params = new URLSearchParams([...keep, ...extra.entries()]);
    u.search = params.toString();
    return u.toString();
  }
  return null;
}

export const validUrl = (url) => {
  const s = String(url || "").trim();
  if (!s || s.length > 500 || /\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
};

export class HealthCheckUi {
  constructor(host) {
    this.host = host;
    this.q = "";
    this.sort = { key: "name", dir: "asc" };
    this.form = null; // offenes Formular: { id, url, suffix, touched, value, unit, error, saving }
    this.busy = new Set(); // laufende Tests "id|ok" oder "id|fail"
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get items() {
    return this.host._data?.healthchecks || [];
  }

  get max() {
    return this.host._data?.healthcheck_max || 5;
  }

  get listDlg() {
    return this.host._root.getElementById("ag-hclist");
  }

  get formDlg() {
    return this.host._root.getElementById("ag-hcform");
  }

  // ----- Zeile im Kapitel HealthCheck (Konfiguration › Anlage) -----

  summaryRow() {
    const n = this.items.length;
    const failed = this.items.filter((i) => i.status && i.status.result !== "ok").length;
    const text = n ? this._t("hcSummary", { count: n, max: this.max }) : this._t("hcNone");
    const sub = !n ? this._t("hcNoneHint") : failed ? this._t(failed === 1 ? "hcFailedOne" : "hcFailed", { count: failed }) : this._t("hcAllOk");
    return `<div class="ag-setrow ag-rtsum ag-hcsum"><span class="ag-oav ag-tint ag-tint-health ${n ? "on" : ""}">${ic("heartPulse", 20)}</span><div class="ag-settx"><b>${esc(text)}</b><small class="${failed ? "ag-warntext" : ""}">${esc(sub)}</small></div>
      <div class="ag-btnrow"><button class="ag-btn" data-hc="add" ${n >= this.max ? "disabled" : ""}>${ic("plus", 18)}${esc(this._t("hcAdd"))}</button>
        <button class="ag-btn" data-hc="open">${ic("heartPulse", 18)}${esc(this._t("hcShow"))}</button></div></div>`;
  }

  // Rechte Hälfte der unteren Zeile der Statuskachel (1.68.0, Wunsch des Nutzers 2026-11-19, 18:36): nur, wenn Dienste eingerichtet sind (sonst bleibt
  // die Kachel wie bisher und lädt zu nichts ein). Grün, wenn alle in Ordnung sind; rot, sobald einer gescheitert ist; orange, solange ein Fehler
  // gemeldet ist (der Selbsttest hat Probleme). Öffnet die Liste der Dienste.
  tileHalf() {
    const items = this.items;
    if (!items.length) return "";
    const state = (i) => i.log?.state || (i.status ? (i.status.result !== "ok" ? "fail" : (i.status.sent === "fail" || i.status.sent === "alarm") && !i.status.test ? "report" : "ok") : null);
    const states = items.map(state);
    const fail = states.filter((x) => x === "fail").length;
    const report = states.filter((x) => x === "report").length;
    const none = states.every((x) => !x);
    const tone = fail ? "err" : report ? "warn" : none ? "" : "ok";
    const text = fail ? this._t(fail === 1 ? "hcHalfFail1" : "hcHalfFail", { count: fail }) : report ? this._t("hcHalfReport") : none ? this._t("hcHalfNone")
      : this._t(items.length === 1 ? "hcHalfOk1" : "hcHalfOk");
    const title = `${this._t("hcListTitle")}: ${text}`;
    return `<button class="ag-row ag-rowbtn ag-half" data-hc="open" data-half="healthcheck" title="${esc(title)}"><span class="ag-mini ${tone}">${ic("heartPulse", 16)}</span>
      <span class="ag-grow"><span class="ag-half-t">${esc(this._t("hcTitle"))}</span><small class="ag-t2 ag-block">${esc(text)}</small></span><span class="ag-cbtn">${ic("chevRight", 16)}</span></button>`;
  }

  // ----- Fenster mit der Liste -----

  openList() {
    const dlg = this.listDlg;
    if (!dlg.open) this.q = "";
    this.renderList(true);
    if (!dlg.open) dlg.showModal();
  }

  renderList(force = false) {
    const dlg = this.listDlg;
    if (!dlg || (!dlg.open && !force)) return;
    // Steht die Tabelle schon da, nur sie neu zeichnen: das Suchfeld behält Text und Fokus
    const body = dlg.querySelector(".ag-hcbody");
    if (body && !force) {
      this.host._setHtml(body, this._body());
      // Fusszeile wie bei Codes, Routinen und Tönen: "Dienst hinzufügen" erst, wenn die Liste nicht leer ist (sonst steht er in der Mitte)
      const foot = dlg.querySelector(".ag-dlg-btns");
      if (foot) this.host._setHtml(foot, this._foot());
      const tools = dlg.querySelector(".ag-hctools");
      if (tools) tools.hidden = !this.items.length;
      this._stickHead(dlg);
      return;
    }
    const n = this.items.length;
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-hc-pop"><div class="ag-pop-head">${iconTitle("heartPulse", HC_TINT, this._t("hcListTitle"))}
      <div class="ag-tools ag-pop-tools ag-hctools" ${n ? "" : "hidden"}>${searchField("data-hc", "search", this.q, this._t("hcFilter"), this._t("clearSearch"))}</div></div>
      <div class="ag-hcbody">${this._body()}</div>${this._about()}
      <div class="ag-dlg-btns">${this._foot()}</div></div>`);
    this._stickHead(dlg);
  }

  // Was diese Dienste sind, mit Beispielen (Wunsch des Nutzers 2026-11-19, wie "Was prüft der Selbsttest?"): zum Aufklappen unter der Liste. Offen
  // bleibt es, auch wenn das Fenster neu gezeichnet wird (aboutOpen, gesetzt beim Klick auf die Zeile; der Browser klappt selbst um)
  _about() {
    const t = (k) => this._t(k);
    const lines = t("hcAboutText").split("\n").filter(Boolean).map((line) => `<li>${esc(line)}</li>`).join("");
    const links = EXAMPLES.map(([name, url, note]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a> <span class="ag-t2">${esc(url.replace(/^https:\/\//, ""))}${note ? ` · ${esc(t(note))}` : ""}</span></li>`).join("");
    return `<details class="ag-st-about ag-hc-about" ${this.aboutOpen ? "open" : ""}><summary data-hc="about">${ic("info", 16)}<span>${esc(t("hcAbout"))}</span></summary>
      <ul class="ag-st-ul">${lines}</ul><p class="ag-hc-exh">${esc(t("hcAboutExamples"))}</p><ul class="ag-st-ul ag-hc-ex">${links}</ul></details>`;
  }

  // "Schliessen" und "Dienst hinzufügen" nebeneinander rechts, wie in allen Fenstern mit Liste (Wunsch des Nutzers 2026-11-19)
  _foot() {
    const n = this.items.length;
    const add = n ? `<button class="ag-btn primary" data-hc="add" ${n >= this.max ? "disabled" : ""}>${ic("plus", 18)}${esc(this._t("hcAdd"))}</button>` : "";
    return `<button class="ag-btn" data-hc="close">${esc(this._t("close"))}</button>${add}`;
  }

  // Der Tabellenkopf klebt unter dem klebenden Kopf des Fensters (Titel und Suche), nicht dahinter (Vorgabe: der Tabellenkopf scrollt nie weg)
  _stickHead(dlg) {
    const run = () => {
      const head = dlg.querySelector(".ag-pop-head");
      if (head) dlg.style.setProperty("--ag-pophead", `${head.offsetHeight}px`);
    };
    run();
    window.requestAnimationFrame(run); // erst nach showModal hat der Kopf seine Höhe
  }

  _when(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "–";
    const locale = this.host._hass?.locale?.language || this.host._lang;
    const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })} ${time}`;
  }

  _statusText(s) {
    if (!s) return this._t("hcStNone");
    const what = this._t(s.sent === "alarm" ? "hcStAlarmSent" : s.sent === "fail" ? "hcStFailSent" : "hcStOkSent");
    const test = s.test ? ` (${this._t("hcStTest")})` : "";
    if (s.result === "ok") return `${what}${test} · HTTP ${s.code}`;
    const why = s.result === "http" ? `HTTP ${s.code}` : this._t(s.result === "timeout" ? "hcStTimeout" : "hcStError");
    return `${this._t("hcStFailed")}${test} · ${why}`;
  }

  _statusTone(s) {
    if (!s) return "none";
    if (s.result !== "ok") return "err";
    return s.sent === "fail" || s.sent === "alarm" ? "warn" : "ok";
  }

  _body() {
    const t = (k, v) => this._t(k, v);
    const items = this.items;
    if (!items.length) return `<div class="ag-card ag-rtempty"><span class="ag-t2">${esc(t("hcEmpty"))}</span><button class="ag-btn primary" data-hc="add">${ic("plus", 18)}${esc(t("hcAdd"))}</button></div>`;
    const shown = items.filter((i) => matchQuery(this.q, i.name || "", i.url, i.page_url || "", i.fail_suffix, i.alarm_suffix, suggest(i.url)?.name || "", fmtDur(i.interval), this._statusText(i.status)));
    if (!shown.length) return `<div class="ag-card ag-popempty"><span class="ag-t2">${esc(t("hcNoMatch"))}</span></div>`;
    const sort = this.sort;
    const val = { name: (i) => (i.name || i.url).toLowerCase(), last: (i) => i.status?.at || "", interval: (i) => i.interval, status: (i) => this._statusText(i.status) }[sort.key];
    const cmp = (a, b) => (typeof a === "number" ? a - b : String(a).localeCompare(String(b), this.host._lang || "en", { numeric: true }));
    const list = [...shown].sort((a, b) => cmp(val(a), val(b)) * (sort.dir === "desc" ? -1 : 1) || cmp(a.name || "", b.name || "") || cmp(a.url, b.url));
    const testing = (act, id) => (act === "test-fail" || act === "test-ok" || act === "test-alarm") && this.busy.has(`${id}|${act === "test-fail" ? "fail" : act === "test-alarm" ? "alarm" : "ok"}`);
    const btn = (act, icon, label, id, off = false) => `<button class="ag-iconbtn" data-hc="${act}" data-id="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}" ${off || testing(act, id) ? "disabled" : ""}>${ic(icon, 18)}</button>`;
    const rows = list.map((i) => {
      const known = suggest(i.url);
      return `<tr data-hc-row="${esc(i.id)}"><td class="ag-hcurl"><b class="ag-hcname">${esc(i.name || i.url)}</b><span class="ag-mono ag-hcaddr" title="${esc(i.url)}">${esc(i.url)}</span>
          <small class="ag-t2 ag-hcinfo">${known ? `<span class="ag-tag none">${esc(known.name)}</span> ` : ""}${esc(i.fail_suffix ? t("hcSuffixShort", { suffix: i.fail_suffix }) : t("hcSuffixNone"))}${i.alarm_suffix ? ` · ${esc(t("hcAlarmShort", { suffix: i.alarm_suffix }))}` : ""}</small>
          <div class="ag-hc-m"><span class="ag-hcstate ${this._statusTone(i.status)}">${esc(this._statusText(i.status))}</span>
            <span class="ag-t2">${esc(`${t("hcColInterval")}: ${fmtDur(i.interval)} · ${t("hcColLast")}: ${i.status ? this._when(i.status.at) : "–"}`)}</span></div></td>
        <td class="ag-t2 ag-hclast">${esc(i.status ? this._when(i.status.at) : "–")}</td>
        <td class="ag-t2 ag-hcint">${esc(fmtDur(i.interval))}</td>
        <td class="ag-hcst"><span class="ag-hcstate ${this._statusTone(i.status)}">${esc(this._statusText(i.status))}</span></td>
        <td class="ag-acts"><div class="ag-wf-btns ag-hcbtns">${btn("log", "chartBox", t("hlOpen"), i.id)}${i.fail_suffix ? btn("test-fail", "alert", t("hcTestFail"), i.id) : ""}${i.alarm_suffix ? btn("test-alarm", "bell", t("hcTestAlarm"), i.id) : ""}${btn("test-ok", "check", t("hcTestOk"), i.id)}${btn("edit", "pencil", t("hcEdit"), i.id)}${btn("delete", "trash", t("remove"), i.id)}</div></td></tr>`;
    }).join("");
    const th = (k, label, cls = "") => {
      const on = sort.key === k;
      return `<th class="${cls}" aria-sort="${on ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button type="button" class="ag-sortbtn ${on ? "on" : ""}" data-hc="sort" data-key="${k}" title="${esc(t("sortBy", { column: label }))}">${esc(label)}<span class="ag-sortic">${on ? ic(sort.dir === "desc" ? "arrowDown" : "arrowUp", 14) : ""}</span></button></th>`;
    };
    // Auf dem Handy gibt es keine sortierbaren Spaltenköpfe: dort steht "Sortieren nach" mit Auswahl und Richtung neben der Zahl (Wunsch des Nutzers 2026-11-21, wie im Device Panel)
    const opts = [["name", "hcColName"], ["last", "hcColLast"], ["interval", "hcColInterval"], ["status", "hcColStatus"]];
    const sortbar = `<div class="ag-hcsort"><span class="ag-t2">${esc(t("viewSort"))}</span><select class="ag-input" data-hc="sortsel" aria-label="${esc(t("viewSort"))}">${opts.map(([k, l]) => `<option value="${k}" ${sort.key === k ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select>
      <button type="button" class="ag-iconbtn" data-hc="sortdir" title="${esc(t(sort.dir === "desc" ? "hcSortDesc" : "hcSortAsc"))}" aria-label="${esc(t(sort.dir === "desc" ? "hcSortDesc" : "hcSortAsc"))}">${ic(sort.dir === "desc" ? "arrowDown" : "arrowUp", 20)}</button></div>`;
    return `<div class="ag-hcrow"><span class="ag-t2 ag-small ag-hccount">${esc(t("hcCount", { count: items.length, max: this.max }))}</span>${sortbar}</div>
      <div class="ag-card ag-bkwrap"><table class="ag-table ag-hctable"><tr>${th("name", t("hcColName"), "ag-hcurl")}${th("last", t("hcColLast"), "ag-hclast")}${th("interval", t("hcColInterval"), "ag-hcint")}${th("status", t("hcColStatus"), "ag-hcst")}<th class="ag-hcacts"></th></tr>${rows}</table></div>`;
  }

  // ----- Formular -----

  openForm(id = null) {
    const item = id ? this.items.find((i) => i.id === id) : null;
    if (!item && this.items.length >= this.max) return;
    const interval = item?.interval ?? 300;
    const hours = interval % 3600 === 0;
    this.form = { id: item?.id || null, name: item?.name || "", url: item?.url || "", suffix: item?.fail_suffix ?? "", alarm: item?.alarm_suffix ?? "", page: item?.page_url ?? "", touched: Boolean(item), alarmTouched: Boolean(item), pageTouched: Boolean(item),
      value: hours ? interval / 3600 : Math.round(interval / 60), unit: hours ? "h" : "min", error: "", saving: false };
    this.renderForm(true);
    const dlg = this.formDlg;
    if (!dlg.open) dlg.showModal();
    if (!item) dlg.querySelector('[data-hc="f-name"]')?.focus();
  }

  _seconds(f = this.form) {
    const n = Number(f.value);
    if (f.value === "" || !Number.isInteger(n)) return NaN;
    return f.unit === "h" ? n * 3600 : n * 60;
  }

  _formProblems(f = this.form) {
    const out = {};
    const name = String(f.name || "").trim();
    if (!name || name.length > 60) out.name = this._t(name ? "hcErrNameLong" : "hcErrName");
    if (!validUrl(f.url)) out.url = this._t(String(f.url || "").trim() ? "hcErrUrl" : "hcErrUrlEmpty");
    if (String(f.suffix || "").trim() && (!/^[/?&]/.test(f.suffix.trim()) || !applySuffix(f.url, f.suffix) || /\s/.test(f.suffix.trim()))) out.suffix = this._t("hcErrSuffix");
    if (String(f.alarm || "").trim() && (!/^[/?&]/.test(f.alarm.trim()) || !applySuffix(f.url, f.alarm) || /\s/.test(f.alarm.trim()))) out.alarm = this._t("hcErrAlarm");
    if (String(f.page || "").trim() && !validUrl(f.page)) out.page = this._t("hcErrPage");
    const sec = this._seconds(f);
    if (!Number.isFinite(sec) || sec < MIN || sec > MAX) out.interval = this._t("hcErrInterval");
    return out;
  }

  // Teile des Formulars, die sich beim Tippen ändern (Erkennung, Vorschlag, Vorschau, Fehler); die Felder selbst werden nie neu gebaut
  _parts() {
    const t = (k, v) => this._t(k, v);
    const f = this.form;
    const bad = this._formProblems();
    const known = suggest(f.url);
    const preview = validUrl(f.url) && !bad.suffix ? applySuffix(f.url, f.suffix) : null;
    const previewAlarm = validUrl(f.url) && !bad.alarm ? applySuffix(f.url, f.alarm) : null;
    const err = (key) => (bad[key] && (f.shown || String({ url: f.url, suffix: f.suffix, alarm: f.alarm, name: f.name, page: f.page }[key] ?? "x").trim()) ? `<small class="ag-err ag-block">${esc(bad[key])}</small>` : "");
    return {
      known: known ? `<span class="ag-tag none ag-hcknown">${esc(t("hcKnown", { name: known.name }))}</span>` : "",
      offer: known && known.suffix !== String(f.suffix || "").trim()
        ? `<div class="ag-hcoffer"><span class="ag-t2">${esc(t("hcSuggest", { name: known.name, suffix: known.suffix }))}</span><button type="button" class="ag-link" data-hc="f-take">${esc(t("hcTake"))}</button></div>` : "",
      prev: preview ? `${esc(t("hcPreview"))} <span class="ag-mono">${esc(preview)}</span>` : esc(t(String(f.suffix || "").trim() ? "hcPreviewNone" : "hcPreviewEmpty")),
      // Alarm-Zusatz: wie der Fehler-Zusatz (seit 1.74.1 setzt ihn ein erkannter Dienst von selbst ein, solange ihn niemand berührt hat); danach steht nur noch "Übernehmen" daneben
      offerAlarm: known?.alarm && known.alarm !== String(f.alarm || "").trim()
        ? `<div class="ag-hcoffer"><span class="ag-t2">${esc(t("hcSuggest", { name: known.name, suffix: known.alarm }))}</span><button type="button" class="ag-link" data-hc="f-take-alarm">${esc(t("hcTake"))}</button></div>` : "",
      prevAlarm: previewAlarm ? `${esc(t("hcPreviewAlarm"))} <span class="ag-mono">${esc(previewAlarm)}</span>` : esc(t(String(f.alarm || "").trim() ? "hcPreviewNone" : "hcPreviewAlarmEmpty")),
      offerPage: suggestPage(f.url) && suggestPage(f.url) !== String(f.page || "").trim()
        ? `<div class="ag-hcoffer"><span class="ag-t2">${esc(t("hcSuggestPage", { name: known.name, url: suggestPage(f.url) }))}</span><button type="button" class="ag-link" data-hc="f-take-page">${esc(t("hcTake"))}</button></div>` : "",
      "err-page": err("page"),
      "err-alarm": err("alarm"),
      "err-name": err("name"),
      "err-url": err("url"),
      "err-suffix": err("suffix"),
      "err-interval": err("interval"),
      presets: PRESETS.map((sec) => `<button type="button" class="ag-chip ${this._seconds() === sec ? "on" : ""}" data-hc="f-preset" data-sec="${sec}" aria-pressed="${this._seconds() === sec}">${esc(fmtDur(sec))}</button>`).join(""),
    };
  }

  renderForm(force = false) {
    const dlg = this.formDlg;
    const f = this.form;
    if (!dlg || !f || (!dlg.open && !force)) return;
    const t = (k, v) => this._t(k, v);
    const p = this._parts();
    const bad = this._formProblems();
    // Kapitel mit Strich vor dem Titel, wie die Fenster der Routinen (Wunsch des Nutzers 2026-11-20): Dienst, Selbsttest-Fehler, Alarm, Abstand
    const field = (key, body) => `<label class="ag-hcfield"><span class="ag-hclabel">${esc(t(key))}</span>${body}</label>`;
    this.host._setHtml(dlg, `<form class="ag-dlg-body ag-hcform" data-form="hc" novalidate>${iconTitle("heartPulse", HC_TINT, t(f.id ? "hcEditTitle" : "hcAddTitle"))}
      <div class="ag-t2 ag-small">${esc(t("hcFormHint"))}</div>
      ${chapter(t("hcChapService"), `${field("hcName", `<input class="ag-input" type="text" data-hc="f-name" value="${esc(f.name)}" placeholder="${esc(t("hcNamePh"))}" autocomplete="off" maxlength="60" required>
        <span data-hcp="err-name">${p["err-name"]}</span>`)}
        ${field("hcUrl", `<input class="ag-input" type="url" inputmode="url" data-hc="f-url" value="${esc(f.url)}" placeholder="https://…" autocomplete="off" spellcheck="false" maxlength="500">
        <small class="ag-t2 ag-block">${esc(t("hcUrlHint"))}</small><span data-hcp="known">${p.known}</span><span data-hcp="err-url">${p["err-url"]}</span>`)}`)}
      ${chapter(t("hcChapFail"), field("hcSuffix", `<input class="ag-input" type="text" data-hc="f-suffix" value="${esc(f.suffix)}" placeholder="/fail" autocomplete="off" spellcheck="false" maxlength="200">
        <small class="ag-t2 ag-block">${esc(t("hcSuffixHint"))}</small><div data-hcp="offer">${p.offer}</div>
        <small class="ag-t2 ag-block ag-hcprev" data-hcp="prev">${p.prev}</small><span data-hcp="err-suffix">${p["err-suffix"]}</span>`))}
      ${chapter(t("hcChapAlarm"), field("hcAlarm", `<input class="ag-input" type="text" data-hc="f-alarm" value="${esc(f.alarm)}" placeholder="/2" autocomplete="off" spellcheck="false" maxlength="200">
        <small class="ag-t2 ag-block">${esc(t("hcAlarmHint"))}</small><div data-hcp="offerAlarm">${p.offerAlarm}</div>
        <small class="ag-t2 ag-block ag-hcprev" data-hcp="prevAlarm">${p.prevAlarm}</small><span data-hcp="err-alarm">${p["err-alarm"]}</span>`))}
      ${chapter(t("hcChapPage"), field("hcPage", `<input class="ag-input" type="url" inputmode="url" data-hc="f-page" value="${esc(f.page || "")}" placeholder="https://…" autocomplete="off" spellcheck="false" maxlength="500">
        <small class="ag-t2 ag-block">${esc(t("hcPageHint"))}</small><div data-hcp="offerPage">${p.offerPage}</div><span data-hcp="err-page">${p["err-page"]}</span>`))}
      ${chapter(t("hcChapInterval"), `<div class="ag-hcfield"><div class="ag-hcint-row"><span class="ag-num ${bad.interval ? "bad" : ""}"><input type="number" min="1" max="${f.unit === "h" ? 24 : 1440}" step="1" inputmode="numeric" data-hc="f-value" value="${esc(f.value)}" aria-label="${esc(t("hcInterval"))}"></span>
          <select class="ag-input" data-hc="f-unit" aria-label="${esc(t("hcUnit"))}"><option value="min" ${f.unit === "min" ? "selected" : ""}>${esc(t("hcMinutes"))}</option><option value="h" ${f.unit === "h" ? "selected" : ""}>${esc(t("hcHours"))}</option></select></div>
        <div class="ag-zline ag-hcpresets" data-hcp="presets">${p.presets}</div>
        <small class="ag-t2 ag-block">${esc(t("hcIntervalHint"))}</small><span data-hcp="err-interval">${p["err-interval"]}</span></div>`)}
      <div class="ag-dlg-err" aria-live="polite">${esc(f.error || "")}</div>
      <div class="ag-dlg-btns"><button type="button" class="ag-btn" data-hc="f-cancel">${esc(t("cancel"))}</button><button class="ag-btn primary" type="submit" ${f.saving ? "disabled" : ""}>${ic("check", 18)}${esc(t("save"))}</button></div></form>`);
  }

  // Nur Hinweise, Vorschau und Fehler neu zeichnen, nie das Feld, in dem getippt wird (Cursor und Fokus bleiben). Ein Vorschlag füllt den Zusatz
  // nur, solange niemand ihn berührt hat.
  _refreshFormParts() {
    const dlg = this.formDlg;
    const f = this.form;
    if (!dlg || !f) return;
    const p = this._parts();
    for (const [key, html] of Object.entries(p)) {
      const el = dlg.querySelector(`[data-hcp="${key}"]`);
      if (el && el.innerHTML !== html) el.innerHTML = html;
    }
    const suffix = dlg.querySelector('[data-hc="f-suffix"]');
    if (suffix && suffix !== this.host._root.activeElement && suffix.value !== f.suffix) suffix.value = f.suffix;
    const alarm = dlg.querySelector('[data-hc="f-alarm"]');
    if (alarm && alarm !== this.host._root.activeElement && alarm.value !== f.alarm) alarm.value = f.alarm;
    const page = dlg.querySelector('[data-hc="f-page"]');
    if (page && page !== this.host._root.activeElement && page.value !== (f.page || "")) page.value = f.page || "";
    const value = dlg.querySelector('[data-hc="f-value"]');
    if (value) {
      value.max = f.unit === "h" ? "24" : "1440";
      if (value !== this.host._root.activeElement && String(value.value) !== String(f.value)) value.value = f.value;
      value.closest(".ag-num")?.classList.toggle("bad", Boolean(this._formProblems().interval));
    }
    const unit = dlg.querySelector('[data-hc="f-unit"]');
    if (unit && unit.value !== f.unit) unit.value = f.unit;
    const err = dlg.querySelector(".ag-dlg-err");
    if (err) err.textContent = f.error || "";
  }

  async submit() {
    const h = this.host;
    const f = this.form;
    if (!f || f.saving) return;
    f.shown = true;
    if (Object.keys(this._formProblems()).length) return this.renderForm();
    f.saving = true;
    f.error = "";
    this.renderForm();
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/healthcheck_save", ...(f.id ? { check_id: f.id } : {}), name: String(f.name).trim(), url: f.url.trim(), fail_suffix: String(f.suffix || "").trim(), alarm_suffix: String(f.alarm || "").trim(), page_url: String(f.page || "").trim(), interval: this._seconds() });
      if (h._data) h._data.healthchecks = res.healthchecks;
      this.form = null;
      this.formDlg.close();
      h._toast(this._t("hcSaved"));
      this.renderList();
      h.hcLog?.afterSave(res.id); // "Bearbeiten" im Protokoll: dort gleich mit den neuen Werten
      if (h._tab === "config" && h._sub === "system") h.systemUi.render();
    } catch (err) {
      f.saving = false;
      const known = { invalid_name: "hcErrName", invalid_url: "hcErrUrl", invalid_suffix: "hcErrSuffix", invalid_page_url: "hcErrPage", too_many: "hcErrTooMany" }[err?.code];
      f.error = known ? this._t(known) : this._t("saveFailed", { message: errText(err) });
      this.renderForm();
    }
  }

  async remove(id) {
    const h = this.host;
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    const ok = await h._confirm(this._t("hcDeleteTitle"), this._t("hcDeleteText", { name: item.name || item.url }), this._t("remove"));
    if (!ok) return;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/healthcheck_delete", check_id: id });
      if (h._data) h._data.healthchecks = res.healthchecks;
      h.hcLog?.afterRemove(id);
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
    }
    this.renderList();
    if (h._tab === "config" && h._sub === "system") h.systemUi.render();
  }

  // Testknöpfe (Wunsch des Nutzers): genau "Fehler" oder "OK" an den Dienst; das Ergebnis steht in der Zeile und kurz als Hinweis
  async test(id, kind) {
    const h = this.host;
    const key = `${id}|${kind}`;
    if (this.busy.has(key)) return;
    this.busy.add(key);
    this.renderList();
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/healthcheck_ping", check_id: id, kind });
      if (h._data) h._data.healthchecks = res.healthchecks;
      h._toast(this._statusText(res.status));
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
    } finally {
      this.busy.delete(key);
      this.renderList();
      if (h._tab === "config" && h._sub === "system") h.systemUi.render();
    }
  }

  onClick(el) {
    const act = el?.dataset.hc;
    if (!act) return false;
    // "Was sind HealthCheck-Dienste?": der Browser klappt auf oder zu, hier nur merken (der Klick kommt vor dem Umschalten)
    if (act === "about") {
      this.aboutOpen = !el.closest("details")?.open;
      return true;
    }
    if (act === "open") this.openList();
    else if (act === "log") this.host.hcLog.open(el.dataset.id); // Protokoll des Dienstes (1.68.0), über der Liste
    else if (act === "close") this.listDlg?.close();
    else if (act === "add") this.openForm();
    else if (act === "edit") this.openForm(el.dataset.id);
    else if (act === "delete") this.remove(el.dataset.id);
    else if (act === "test-ok") this.test(el.dataset.id, "ok");
    else if (act === "test-fail") this.test(el.dataset.id, "fail");
    else if (act === "test-alarm") this.test(el.dataset.id, "alarm");
    else if (act === "sortdir") {
      this.sort = { ...this.sort, dir: this.sort.dir === "asc" ? "desc" : "asc" };
      this.renderList();
    } else if (act === "sort") {
      const k = el.dataset.key;
      this.sort = { key: k, dir: this.sort.key === k ? (this.sort.dir === "asc" ? "desc" : "asc") : k === "last" ? "desc" : "asc" };
      this.renderList();
    } else if (act === "f-cancel") {
      this.form = null;
      this.formDlg?.close();
    } else if (act === "f-preset") {
      const sec = Number(el.dataset.sec);
      if (this.form && Number.isInteger(sec)) {
        const hours = sec % 3600 === 0;
        this.form.unit = hours ? "h" : "min";
        this.form.value = hours ? sec / 3600 : sec / 60;
        const value = this.formDlg?.querySelector('[data-hc="f-value"]');
        if (value) value.value = String(this.form.value);
        this._refreshFormParts();
      }
    } else if (act === "search-clear") {
      const input = el.closest(".list-search")?.querySelector("input");
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
    } else if (act === "f-take") {
      const known = suggest(this.form?.url);
      if (this.form && known) {
        this.form.suffix = known.suffix;
        this.form.touched = true;
        this._refreshFormParts();
      }
    } else if (act === "f-take-alarm") {
      const known = suggest(this.form?.url);
      if (this.form && known?.alarm) {
        this.form.alarm = known.alarm;
        this.form.alarmTouched = true;
        this._refreshFormParts();
      }
    } else if (act === "f-take-page") {
      const page = suggestPage(this.form?.url);
      if (this.form && page) {
        this.form.page = page;
        this.form.pageTouched = true;
        this._refreshFormParts();
      }
    } else if (act === "search" || act.startsWith("f-")) return true; // Felder: Eingaben kommen über onInput
    else return false;
    return true;
  }

  onInput(el) {
    const act = el?.dataset?.hc;
    if (!act) return false;
    if (act === "sortsel") {
      const k = el.value;
      this.sort = { key: k, dir: k === "last" ? "desc" : "asc" };
      this.renderList();
      return true;
    }
    if (act === "search") {
      this.q = el.value;
      const clear = this.listDlg?.querySelector('[data-hc="search-clear"]');
      if (clear) clear.hidden = !this.q;
      this.renderList();
      return true;
    }
    const f = this.form;
    if (!f) return true;
    if (act === "f-name") {
      f.name = el.value;
    } else if (act === "f-url") {
      f.url = el.value;
      // Vorschlag nur, solange niemand den Zusatz berührt hat: der Nutzer hat das letzte Wort
      const known = suggest(f.url);
      if (!f.touched) f.suffix = known ? known.suffix : "";
      // Seit 1.74.1 (Wunsch des Nutzers 2026-11-21) setzt ein erkannter Dienst auch den Alarm-Zusatz ein, solange ihn niemand berührt hat; beide Zusätze bleiben freiwillig
      if (!f.alarmTouched) f.alarm = known?.alarm ?? "";
      // Ebenso der Link zum Dashboard (seit 1.76.0): ein Vorschlag nur, solange ihn niemand berührt hat
      if (!f.pageTouched) f.page = suggestPage(f.url) ?? "";
    } else if (act === "f-suffix") {
      f.suffix = el.value;
      f.touched = true;
    } else if (act === "f-alarm") {
      f.alarm = el.value;
      f.alarmTouched = true;
    } else if (act === "f-page") {
      f.page = el.value;
      f.pageTouched = true;
    } else if (act === "f-value") {
      f.value = el.value.trim() === "" ? "" : Number(el.value);
    } else if (act === "f-unit") {
      // Umrechnen, wo es aufgeht (90 min -> 1,5 h geht nicht: dann bleibt die Zahl, und die Prüfung meldet die Grenzen)
      const sec = this._seconds();
      f.unit = el.value;
      if (Number.isFinite(sec) && (el.value === "min" || sec % 3600 === 0)) f.value = el.value === "h" ? sec / 3600 : sec / 60;
    }
    f.error = "";
    this._refreshFormParts();
    return true;
  }
}
