// Einrichtungsassistent (1.69.0, Wunsch und Entscheide des Nutzers 2026-11-19, 20:43 und 21:05; Mockups docs/mockups/einrichtungsassistent-v1/).
// Erscheint einmal je Anlage (Zustand im Server, settings.wizard_payload), führt durch Modi, Sensoren, Zuordnung und Eingang, Code (freiwillig),
// Meldungen, Alarmaktionen und, wenn passende Sensoren da sind, die Überwachung. Kein eigener Editor: die Schritte nutzen die Entwürfe und das
// Speichern der Reiter (SystemUi, SensorsUi, NotifyUi, ActionsUi), "Zuordnung", "Alarmaktionen" und "Überwachung" zeigen die echten Ansichten
// der Reiter, eingebettet (das Panel zeichnet sie in this.host._view, hier der Platz .ag-wz-slot). Eine Änderung am Editor gilt so auch hier.
// "Weiter" speichert den Schritt; der Server merkt sich den Schritt, damit es nach "Später" genau dort weitergeht.

const V = new URL(import.meta.url).search;
const { ic, esc, onceBtn, DC, OPENINGS, MOTION, AIR, measureKind, MODE_KEY, MODE_ICON, errText, matchQuery, searchField, rowIcon } = await import(`./common.js${V}`);
const { NOTIFY_ICON, NOTIFY_TONE } = await import(`./notify.js${V}`);

export const WZ_STEPS = ["welcome", "modes", "sensors", "zones", "code", "notify", "actions", "monitor", "done"];
const ALL_MODES = ["home", "away", "night"];
// Unterseite der Konfiguration je Schritt: ihre Ereignisse (Klicks, Eingaben, Ziehen) gelten im Assistenten weiter
const SUB = { welcome: "system", modes: "system", sensors: "sensors", zones: "sensors", code: "system", notify: "notify", actions: "actions", monitor: "actions", done: "actions" };
// Schritte, die eine Ansicht eines Reiters einbetten
const EMBED = { zones: true, actions: true, monitor: true };
// Rauch, Wasser, Gas und Hitze: lösen über "Immer aktiv" aus, nicht über eine Zone
const SAFETY = new Set(["smoke", "gas", "carbon_monoxide", "moisture", "heat"]);
// Meldungen mit Schalter im Assistenten (die Alarmmeldung ist immer an; "Scharf geschaltet" und "Deaktiviert" stehen bei den Aktionen). Seit 1.91.0
// mit Symbol und Farbe wie unter Konfiguration › Benachrichtigungen (NOTIFY_ICON, NOTIFY_TONE; bis 1.90.0 eigene, teils andere Symbole)
const KINDS = ["arm_failed", "sensor_offline", "alarm_again", "code_locked", "battery_low", "sensor_unavailable", "selftest", "healthcheck"];
// Messwerte der Überwachung nach Art (Filter im Fenster "Messwerte hinzufügen" und in der Liste der gewählten; Wunsch des Nutzers 2026-11-20,
// 08:31: statt aller Messwerte als Knöpfe eine leere Liste, ein Fenster mit Suche und Filtern wie "Sensoren hinzufügen", die gewählten wieder
// mit Suche und Filtern)
// (Luftqualität `AIR` und `measureKind` seit 1.72.0 in common.js, gemeinsam mit den Filtern unter Konfiguration › Sensoren)
const MEASURE_FILTERS = [["all", "filterAll"], ["temperature", "dcTemperature"], ["humidity", "dcHumidity"], ["illuminance", "dcIlluminance"], ["air", "dcAqi"], ["other", "filterOther"]];
// Weitere Funktionen am Schluss: nur zur Information, wo sie stehen (Wunsch des Nutzers 2026-11-20, 08:33: die Kacheln verleiteten zum Klicken)
// Seit 1.72.0 (Wunsch des Nutzers 2026-11-20, 14:00) die Symbole in der Farbe ihres Kapitels unter Konfiguration › Anlage (`ag-tint-*`) und "Eigene Töne"
// dazu, in der Reihenfolge der Kapitel; die Dashboard-Karte hat kein Kapitel und bekommt eine eigene Farbe (`ag-tint-card`)
// Seit 1.73.0 (Wunsch des Nutzers 2026-11-21) springt ein runder Pfeil je Funktion direkt dorthin (`openPlace`); das Fenster schliesst man, und der
// Assistent steht wieder auf diesem Schritt. Die Dashboard-Karte steht im Dashboard von Home Assistant und hat keinen Sprung.
const MORE = [["flash", "routines", "rtTitle", "wzMore_routines", "wzWhere_routines", "routines", "ag-rtlist"], ["hand", "codes", "sysCodes", "wzMore_codes", "wzWhere_codes", "codes", "ag-codelist"],
  ["speaker", "sounds", "csTitle", "wzMore_sounds", "wzWhere_sounds", "sounds", "ag-cslist"], ["heartPulse", "health", "hcTitle", "wzMore_health", "wzWhere_health", "healthcheck", "ag-hclist"],
  ["viewOptions", "card", "wzMoreCard", "wzMore_card", "wzWhere_card", "", ""]];
const short = (s) => s.replace(/^notify\.(mobile_app_)?/, "");
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

export class WizardUi {
  constructor(host) {
    this.host = host;
    this.active = false;
    this.step = "welcome";
    this.entry = null;
    this.prev = null;
    this.busy = false;
    this.error = "";
    this.q = "";
    this.filter = "all";
    this.measures = null; // Messwerte des Hauses (für "Überwachung"), auf Abruf
    this.mq = ""; // Suche und Filter in der Liste der gewählten Messwerte
    this.mf = "all";
    this.pick = null; // offenes Fenster "Messwerte hinzufügen": { q, f, sel }
    this.finishTo = null; // "Konfiguration öffnen" am Schluss: danach Konfiguration › Anlage statt Übersicht
    this.ask = null; // offenes Fenster: "later" oder "dirty"
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get system() {
    return this.host._system(this.entry);
  }

  // ----- Schritte -----

  // "Überwachung" nur, wenn es passende Sensoren gibt oder sie schon eingeschaltet ist
  _monitorFits(s = this.system) {
    // Solange die Messwerte noch nicht geladen sind, bleibt ein angefangener Schritt "Überwachung" stehen (sonst sprang der Assistent nach
    // "Später" am nächsten Tag zu "Fertig", statt genau dort weiterzumachen)
    if (this.measures === null && this.step === "monitor") return true;
    return Boolean(s?.monitor_enabled || s?.monitor_sensors?.length || (this.measures && Object.keys(this.measures).length));
  }

  steps(s = this.system) {
    return WZ_STEPS.filter((x) => x !== "monitor" || this._monitorFits(s));
  }

  // Nummer eines Schritts (Willkommen und Fertig zählen nicht)
  number(step) {
    return WZ_STEPS.indexOf(step);
  }

  _numbered() {
    return this.steps().filter((x) => x !== "welcome" && x !== "done");
  }

  // ----- Öffnen und Schliessen -----

  _uis() {
    const h = this.host;
    return [h.sensors, h.systemUi, h.actions, h.notify];
  }

  _dirty() {
    return this._uis().some((ui) => ui.dirtyCount() > 0 && !this.host._isSaved(ui));
  }

  // Nach jedem Abruf: eine Anlage, für die der Assistent fällig ist, bekommt ihn (nie über ungespeicherte Änderungen, nie zweimal)
  maybeOpen() {
    const h = this.host;
    const s = h._system();
    if (this.active || h._creating || !s?.wizard?.due || this._dirty() || h._root.querySelector("dialog[open]")) return;
    this.open(s.entry_id, s.wizard.step);
  }

  // Von Hand (Konfiguration › Anlage): offene Änderungen fragen vorher
  async start(step = "welcome") {
    if (this._dirty()) {
      this.ask = { kind: "dirty", step };
      this._renderAsk();
      return;
    }
    await this._startNow(step);
  }

  async _startNow(step) {
    const h = this.host;
    const s = h._system();
    if (!s) return;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/wizard", entry_id: s.entry_id, action: "start", step });
      s.wizard = res.wizard;
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
      return;
    }
    this.open(s.entry_id, step);
  }

  open(entryId, step) {
    const h = this.host;
    this.prev = { tab: h._tab, sub: h._sub, trigger: h.actions.trigger };
    this.active = true;
    this.entry = entryId;
    this.step = WZ_STEPS.includes(step) ? step : "welcome";
    this.error = "";
    this._enter();
    h._render();
    this._loadCandidates();
    this._restoreTop();
  }

  // Nach der Rückkehr aus einem Fenster der Konfiguration: Lage wie vorher (der Inhalt wächst noch kurz, darum mehrere Versuche)
  _restoreTop() {
    const top = this._resumeTop;
    this._resumeTop = null;
    if (!top) return;
    // Die Lage wird mehrfach gesetzt: der Inhalt wächst noch (Messwerte, Listen), und die Ansicht dahinter stellt kurz ihre eigene Lage wieder her.
    // Fasst der Benutzer den Inhalt an, hört das sofort auf.
    const c = this.host._content;
    if (!c) return;
    // Jeder Lauf hat eine Nummer: ein neuer Lauf oder das Verlassen des Assistenten beendet die Zeitgeber des alten (sonst überschrieben sie die Lage nach einem schnellen zweiten Sprung)
    const id = (this._restoreId = (this._restoreId || 0) + 1);
    let stop = false;
    const halt = () => { stop = true; };
    c.addEventListener("wheel", halt, { once: true, passive: true });
    c.addEventListener("touchstart", halt, { once: true, passive: true });
    const set = () => {
      if (stop || !this.active || id !== this._restoreId) return;
      if (Math.abs(c.scrollTop - top) > 1) c.scrollTop = top;
    };
    set();
    window.requestAnimationFrame(set);
    for (const ms of [60, 150, 300, 600, 1000, 1600]) window.setTimeout(set, ms);
  }

  close() {
    const h = this.host;
    this.active = false;
    this.ask = null;
    if (this.prev) {
      h._tab = this.prev.tab;
      h._sub = this.prev.sub;
      h.actions.trigger = this.prev.trigger;
    }
    h._render();
  }

  // Unterseite und Auslöser der Aktionen für den Schritt (ohne die Merkzettel des Benutzers zu ändern)
  _enter() {
    const h = this.host;
    h._tab = "config";
    h._sub = SUB[this.step];
    const s = this.system;
    if (this.step === "monitor") h.actions.trigger = "monitor";
    else if (this.step === "actions" || this.step === "done") {
      const triggers = s ? h.actions.triggers(s).filter((t) => t !== "monitor" && t !== "always") : [];
      if (!triggers.includes(h.actions.trigger)) h.actions.trigger = triggers.includes("away") ? "away" : triggers[0] || "away";
    }
  }

  async _loadCandidates() {
    const h = this.host;
    try {
      await h._loadCandidates();
      const res = await h._hass.callWS({ type: "alarmageddon/sensor_candidates", measures: true });
      this.measures = Object.fromEntries(Object.entries(res?.sensors || {}).filter(([, info]) => info.kind === "value"));
    } catch {
      this.measures = this.measures || {};
    }
    if (this.active) h._renderView(false);
  }

  // Schritt wechseln: der Server merkt ihn sich (dort geht es nach "Später" weiter)
  go(step) {
    const h = this.host;
    if (!this.steps().includes(step)) step = "done";
    this.step = step;
    this.error = "";
    this._enter();
    this._persist(step);
    // Jeder Schritt beginnt oben (vor dem Aufbau: sonst stellte _keepScroll die Lage des vorigen Schritts wieder her)
    if (h._content) h._content.scrollTop = 0;
    h._render();
  }

  async _persist(step) {
    const h = this.host;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/wizard", entry_id: this.entry, action: "step", step });
      if (this.system) this.system.wizard = res.wizard;
    } catch {
      /* nur der Merkzettel; beim nächsten Schritt wieder */
    }
  }

  // ----- Speichern über die Reiter -----

  async _save(ui) {
    if (!ui.dirtyCount() || this.host._isSaved(ui)) return true;
    if (ui.invalid && ui.invalid().length) {
      this.error = this._t("wzInvalid");
      return false;
    }
    await ui.save();
    if (ui.saveState !== "saved") {
      this.error = typeof ui.saveState === "string" ? ui.saveState : this._t("wzInvalid");
      return false;
    }
    await this._settled();
    return true;
  }

  // Nach dem Speichern lädt die Anlage neu: warten, bis die neuen Daten da sind
  async _settled() {
    const h = this.host;
    const until = Date.now() + 26000;
    await sleep(50);
    while (h._wait && Date.now() < until) await sleep(250);
  }

  async _saveStep(step) {
    const h = this.host;
    if (step === "modes") return this._save(h.systemUi);
    // Schalter zum Code (1.89.0): Teil des Entwurfs der Seite Anlage
    if (step === "code") return this._save(h.systemUi);
    if (step === "sensors") return this._save(h.sensors);
    if (step === "zones") return (await this._save(h.sensors)) && this._save(h.systemUi);
    if (step === "notify") return this._save(h.notify);
    if (step === "actions" || step === "monitor") return this._save(h.actions);
    return true;
  }

  async next() {
    const h = this.host;
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this._paintFoot();
    try {
      if (!(await this._saveStep(this.step))) return;
      if (this.step === "done") {
        const res = await h._hass.callWS({ type: "alarmageddon/wizard", entry_id: this.entry, action: "done" });
        if (this.system) this.system.wizard = res.wizard;
        this.prev = this.finishTo ? { tab: "config", sub: this.finishTo, trigger: h.actions.trigger } : { tab: "overview", sub: this.prev?.sub || "sensors", trigger: h.actions.trigger };
        this.busy = false;
        this.close();
        return;
      }
      const list = this.steps();
      this.busy = false;
      this.go(list[list.indexOf(this.step) + 1] || "done");
    } catch (err) {
      this.error = this._t("errGeneric", { message: errText(err) });
    } finally {
      this.busy = false;
      if (this.active) this._paintFoot();
    }
  }

  back() {
    const list = this.steps();
    const i = list.indexOf(this.step);
    if (i > 0) this.go(list[i - 1]);
  }

  // Weitere Funktionen: direkt zur Funktion springen (Konfiguration › Anlage, das Fenster öffnet sich). Der Assistent bleibt offen im Sinn des
  // Servers (nichts wird abgeschlossen); schliesst man das Fenster, öffnet er sich wieder auf diesem Schritt. Offene Änderungen (Routinen sind
  // ein Entwurf der Seite) fragen dabei wie überall (`start`); man bleibt dann in der Konfiguration, der Knopf im Kopf führt weiter.
  _goMore(kind) {
    const h = this.host;
    const row = MORE.find((m) => m[5] === kind);
    if (!row || this.busy) return;
    const entry = this.entry;
    // Lage merken: nach dem Schliessen des Fensters steht der Schritt wieder dort, wo man ihn verlassen hat
    const top = h._content?.scrollTop || 0;
    this._restoreId = (this._restoreId || 0) + 1;
    this.close();
    h.openPlace(kind, entry);
    const dlgId = row[6];
    const wait = (n = 0) => {
      const dlg = h._root.getElementById(dlgId);
      if (dlg?.open) {
        dlg.addEventListener("close", () => {
          if (this.active) return;
          this._resumeTop = top;
          this.start("done");
        }, { once: true });
      } else if (n < 40) window.setTimeout(() => wait(n + 1), 50);
    };
    window.requestAnimationFrame(() => wait());
  }

  async later(action) {
    const h = this.host;
    try {
      const res = await h._hass.callWS({ type: "alarmageddon/wizard", entry_id: this.entry, action });
      if (this.system) this.system.wizard = res.wizard;
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
      return;
    }
    h._root.getElementById("ag-wzask")?.close();
    this.close();
  }

  // ----- Darstellung -----

  // Gerüst (einmal je Aufbau des Panels): links die Schritte (Computer), oben Titel und "Später", in der Mitte der Schritt, unten Zurück/Weiter
  frameHtml() {
    const narrow = this.host.hasAttribute("narrow");
    return `<div class="ag-wz ${narrow ? "narrow" : ""}" data-step="${this.step}">
      ${narrow ? "" : `<aside class="ag-wz-side"></aside>`}
      <div class="ag-wz-main"><header class="ag-wz-head"></header><div class="ag-wz-body"><div class="ag-wz-pre"></div><div class="ag-view ag-wz-slot"></div><div class="ag-wz-post"></div></div>
        <footer class="ag-wz-foot"></footer></div></div>`;
  }

  render(full = false) {
    const h = this.host;
    const s = this.system;
    const root = h._content?.querySelector(".ag-wz");
    if (!root) return;
    if (!s) {
      this.close();
      return;
    }
    if (!this.steps().includes(this.step)) this.step = this.step === "monitor" ? "done" : this.step;
    root.dataset.step = this.step;
    const side = root.querySelector(".ag-wz-side");
    if (side) h._setHtml(side, this._sideHtml());
    h._setHtml(root.querySelector(".ag-wz-head"), this._headHtml());
    const pre = root.querySelector(".ag-wz-pre");
    const post = root.querySelector(".ag-wz-post");
    const slot = root.querySelector(".ag-wz-slot");
    if (EMBED[this.step]) {
      h._setHtml(pre, this._preHtml());
      h._setHtml(post, this._postHtml());
      if (this.step !== "monitor" || s.monitor_enabled) {
        h._renderConfig(full);
        this._placeQuick(slot);
      } else {
        h._setHtml(slot, "");
      }
    } else {
      h._setHtml(pre, "");
      h._setHtml(post, "");
      h._setHtml(slot, this._ownHtml());
    }
    this._paintFoot();
  }

  // Live-Werte (Zustände): die eingebettete Zuordnung und "Bereit zum Scharfschalten" am Schluss
  renderLive() {
    if (this.step === "zones") this.host.sensors.render();
    else if (this.step === "done") this.render(false);
  }

  _paintFoot() {
    const foot = this.host._content?.querySelector(".ag-wz-foot");
    if (foot) this.host._setHtml(foot, this._footHtml());
  }

  _sideHtml() {
    const list = this.steps();
    const idx = list.indexOf(this.step);
    const item = (step, i) => {
      const state = i < idx ? "done" : i === idx ? "cur" : "todo";
      const dot = step === "welcome" ? ic(state === "done" ? "check" : "wand", 16) : step === "done" ? ic("check", 16) : state === "done" ? ic("check", 16) : String(this.number(step));
      const sub = state === "done" && step !== "welcome" ? this._summary(step) : step === "monitor" && state === "todo" ? this._t("wzOnlyFitting") : "";
      return `<li class="${state} ${step === "monitor" ? "opt" : ""}"><button type="button" data-wz="goto" data-step="${step}" ${i <= idx ? "" : "disabled"}><span class="ag-wz-dot">${dot}</span>
        <span class="ag-wz-st"><b>${esc(this._t(`wzS_${step}`))}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></button></li>`;
    };
    return `<div class="ag-wz-brand"><img src="/alarmageddon_icon.png" alt="" width="40" height="40"><div><b>${esc(this._t("wzSetup"))}</b><small>${esc(this._t("wzSystem", { name: this.system?.title || "" }))}</small></div></div>
      <ol class="ag-wz-steps">${list.map(item).join("")}</ol>
      <div class="ag-wz-sidefoot">${ic("check", 16)}<span>${esc(this._t("wzSavedHint"))}</span></div>`;
  }

  _headHtml() {
    const narrow = this.host.hasAttribute("narrow");
    const list = this._numbered();
    const n = list.indexOf(this.step) + 1;
    const kicker = this.step === "welcome" ? this._t("wzTitle") : this.step === "done" ? this._t("wzDoneKicker") : this._t("wzStepOf", { n, total: list.length });
    const title = this._t(this.step === "welcome" && narrow ? "wzH_welcomeShort" : `wzH_${this.step}`, { name: this.system?.title || "" });
    const lead = { welcome: "wzL_welcome", modes: "wzL_modes", sensors: "wzL_sensors", zones: "wzL_zones", code: "wzL_code", notify: "wzL_notify", done: "wzL_done" }[this.step];
    const later = `<button class="ag-btn ag-wz-later" data-wz="later">${narrow ? "" : ic("close", 18)}${esc(this._t("wzLater"))}</button>`;
    const prog = narrow && this.step !== "welcome" ? `<div class="ag-wz-prog">${list.map((x, i) => `<span class="${this.step === "done" || i < n - 1 ? "done" : i === n - 1 ? "cur" : ""}"></span>`).join("")}</div>` : "";
    const label = narrow && this.step !== "welcome" && this.step !== "done" ? `${kicker} · ${this._t(`wzS_${this.step}`)}` : kicker;
    // Auf der Startseite ein Logo des Assistenten (Zauberstab im Farbverlauf, Wunsch des Nutzers 2026-11-21): derselbe Stab wie im Knopf im Kopf, damit man ihn wiedererkennt
    const badge = this.step === "welcome" ? `<span class="ag-wz-badge" aria-hidden="true">${ic("wand", narrow ? 24 : 28)}</span>` : "";
    return `<div class="ag-wz-top ${badge ? "has-badge" : ""}">${badge}<span class="ag-wz-kicker">${esc(label)}</span>${later}</div>${prog}
      <h2>${esc(title)}</h2>${lead ? `<p class="ag-wz-lead">${esc(this._t(lead, { name: this.system?.title || "" }))}</p>` : ""}`;
  }

  _footHtml() {
    const s = this.system;
    const narrow = this.host.hasAttribute("narrow");
    const first = this.step === "welcome";
    const noCode = this.step === "code" && !this._hasCode(s);
    const label = first ? this._t("wzStart") : this.step === "done" ? this._t("wzFinish") : noCode ? this._t("wzSkipCode") : this._t("wzNext");
    const err = this.error ? `<span class="ag-err ag-wz-err">${esc(this.error)}</span>` : "";
    const saved = !first && !narrow && !this.error ? `<span class="ag-wz-saved">${ic("check", 16)}${esc(this._t("wzSavedBefore"))}</span>` : "";
    return `${first ? "" : `<button class="ag-btn" data-wz="back" ${this.busy ? "disabled" : ""}>${esc(this._t("wzBack"))}</button>`}${saved}${err}<span class="ag-grow"></span>
      <button class="ag-btn primary ag-wz-next" data-wz="next" ${this.busy ? "disabled" : ""}>${esc(this.busy ? this._t("wzSaving") : label)}${first || this.step !== "done" ? ic("chevRight", 18) : ""}</button>`;
  }

  // Bausteine
  _info(icon, html, cls = "") {
    return `<div class="ag-wz-info ${cls}">${ic(icon, 20)}<div>${html}</div></div>`;
  }

  _toggle(on, attrs, label) {
    return `<button class="ag-toggle ${on ? "on" : ""}" ${attrs} role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>`;
  }

  _chap(title, body, hint = "") {
    return `<section class="ag-chap"><h3 class="ag-chap-t">${esc(title)}</h3>${hint ? `<p class="ag-chap-h">${esc(hint)}</p>` : ""}${body}</section>`;
  }

  _ownHtml() {
    if (this.step === "welcome") return this._welcomeHtml();
    if (this.step === "modes") return this._modesHtml();
    if (this.step === "sensors") return this._sensorsHtml();
    if (this.step === "code") return this._codeHtml();
    if (this.step === "notify") return this._notifyHtml();
    if (this.step === "done") return this._doneHtml();
    return "";
  }

  _preHtml() {
    if (this.step === "zones") return "";
    if (this.step === "actions") return this._info("power", this._t("wzL_actions"));
    if (this.step === "monitor") return this._monitorHtml();
    return "";
  }

  _postHtml() {
    return this.step === "zones" ? this._timesHtml() : "";
  }

  // Schnellwahl der Aktionen unter der Leiste der Modi (Entscheid des Nutzers: Sirene und Alarmton, ohne Licht)
  _placeQuick(slot) {
    if (this.step !== "actions" || !slot) return;
    slot.querySelector(".ag-wz-quick")?.remove();
    const head = slot.querySelector(".ag-wf-head");
    if (!head) return;
    head.insertAdjacentHTML("afterend", `<div class="ag-wz-quick"><small>${esc(this._t("wzQuick"))}</small>
      <button class="ag-chip" data-wz="quick" data-q="siren">${ic("plus", 16)}${esc(this._t("wzQuickSiren"))}</button>
      <button class="ag-chip" data-wz="quick" data-q="sound">${ic("plus", 16)}${esc(this._t("wzQuickSound"))}</button></div>`);
  }

  _welcomeHtml() {
    const narrow = this.host.hasAttribute("narrow");
    const steps = this._numbered();
    const tiles = WZ_STEPS.filter((x) => x !== "welcome" && x !== "done").map((x) => `<div class="ag-card ag-wz-tile ${steps.includes(x) ? "" : "dim"}"><span class="ag-oav">${ic({ modes: "shieldAway", sensors: "sensor", zones: "door", code: "key", notify: "bell", actions: "power", monitor: "eye" }[x], 22)}</span>
      <div><span class="ag-wz-num">${esc(this._t("wzStepNo", { n: this.number(x) }))}${x === "monitor" ? ` · ${esc(this._t("wzIfFitting"))}` : ""}</span><b>${esc(this._t(`wzS_${x}`))}</b><small>${esc(this._t(`wzW_${x}`))}</small></div></div>`).join("");
    const facts = `<div class="ag-wz-facts"><span>${ic("clock", 16)}${esc(this._t("wzFactTime"))}</span><span>${ic("check", 16)}${esc(this._t("wzFactSaved"))}</span><span>${ic("undo", 16)}${esc(this._t("wzFactChange"))}</span></div>`;
    return `${narrow ? facts : `<div class="ag-wz-hero"><img src="/alarmageddon_icon.png" alt="" width="86" height="86">${facts}</div>`}
      <div class="ag-wz-grid">${tiles}</div>${this._info("info", this._t("wzLimits"))}`;
  }

  _modesHtml() {
    const h = this.host;
    const d = h.systemUi.ensureDraft();
    if (!d) return "";
    const row = (attrs, on, icon, title, hint) => `<div class="ag-orow ag-moderow"><span class="ag-oav ${on ? "on" : ""}">${ic(icon, 20)}</span><div class="ag-otx"><b>${esc(title)}</b><small>${esc(hint)}</small></div>${this._toggle(on, attrs, title)}</div>`;
    const modes = ALL_MODES.map((m) => row(`data-wz="mode" data-mode="${m}"`, d.modes[m], MODE_ICON[m], this._t(MODE_KEY[m]), this._t(`wzMode_${m}`))).join("");
    const none = !ALL_MODES.some((m) => d.modes[m]) ? `<small class="ag-err">${esc(this._t("sysModesNone"))}</small>` : "";
    return `<div class="ag-card ag-setlist">${modes}</div>${none}
      ${this._chap(this._t("wfAlways"), `<div class="ag-card ag-setlist">${row('data-wz="always"', d.always, "flash", this._t("wzAlwaysTitle"), this._t("wzAlwaysHint"))}</div>`)}
      ${this._info("info", esc(this._t("wzModesInfo")))}`;
  }

  // Alle passenden Ja/Nein-Sensoren des Hauses (die Kandidaten von "Sensoren hinzufügen"), gewählt ist, was im Entwurf der Anlage steht
  _candidates() {
    const h = this.host;
    const d = h.sensors.ensureDraft();
    const all = { ...(h._candidates || {}), ...(h._data?.sensors || {}) };
    const ids = new Set([...Object.keys(all).filter((id) => all[id].kind !== "value" && !all[id].missing), ...(d?.sensors || [])]);
    return [...ids].map((id) => ({ id, info: all[id] || {}, name: h._name(id), area: all[id]?.area || this._t("noArea") }))
      .sort((a, b) => Number(!a.info.area) - Number(!b.info.area) || a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
  }

  _filtered() {
    const q = this.q.trim().toLowerCase();
    return this._candidates().filter((r) => {
      const dc = r.info.device_class;
      if (this.filter === "openings" && !OPENINGS.has(dc)) return false;
      if (this.filter === "motion" && !MOTION.has(dc)) return false;
      if (this.filter === "safety" && !SAFETY.has(dc)) return false;
      if (this.filter === "other" && (OPENINGS.has(dc) || MOTION.has(dc) || SAFETY.has(dc))) return false;
      return !q || q.split(/\s+/).every((w) => `${r.name} ${r.area} ${r.id} ${r.info.integration || ""}`.toLowerCase().includes(w));
    });
  }

  _sensorsHtml() {
    const h = this.host;
    const d = h.sensors.ensureDraft();
    if (!d) return "";
    const narrow = h.hasAttribute("narrow");
    const all = this._candidates();
    const rows = this._filtered();
    const chosen = all.filter((r) => d.sensors.has(r.id)).length;
    const chips = [["all", "filterAll"], ["openings", "filterOpenings"], ["motion", "filterMotion"], ["safety", "wzFilterSafety"], ["other", "filterOther"]]
      .map(([k, label]) => `<button class="ag-chip ${this.filter === k ? "on" : ""}" data-wz="filter" data-f="${k}">${esc(this._t(label))}</button>`).join("");
    const count = `<span class="ag-wz-count">${esc(this._t("wzChosen", { n: chosen, total: all.length }))}</span>`;
    let area = null;
    const list = !h._candidates ? `<div class="ag-wz-wait"><span class="ag-t2">${esc(this._t("loading"))}</span></div>`
      : !rows.length ? `<div class="ag-t2 ag-small" style="padding:14px">${esc(this._t(all.length ? "pickNone" : "wzNoCandidates"))}</div>`
        : rows.map((r) => {
          const on = d.sensors.has(r.id);
          const [icon, label] = DC[r.info.device_class] || ["sensor", "dcOther"];
          const head = r.area !== area ? `<div class="ag-group-label">${esc((area = r.area))}</div>` : "";
          return `${head}<button class="ag-erow ${on ? "on" : ""}" data-wz="pick" data-ent="${esc(r.id)}" role="checkbox" aria-checked="${on}">
            <span class="ag-box ${on ? "on" : ""}">${on ? ic("check", 18) : ""}</span><span class="ag-av">${ic(icon, 18)}</span>
            <span style="flex:1;min-width:0"><b style="font-weight:500">${esc(r.name)}</b><small class="ag-t2">${esc([this._t(label), r.info.integration].filter(Boolean).join(" · "))}</small></span></button>`;
        }).join("");
    return `<div class="ag-wz-tools"><label class="list-search">${ic("search", 18)}<input type="search" data-wz="q" placeholder="${esc(this._t("search"))}" value="${esc(this.q)}" aria-label="${esc(this._t("search"))}"></label>
        <div class="ag-wz-chips">${chips}</div>${narrow ? "" : count}</div>
      ${narrow ? `<div class="ag-wz-quick">${count}</div>` : ""}
      <div class="ag-card ag-wz-list"><div class="ag-elist">${list}</div></div>
      <div class="ag-wz-quick"><button class="ag-link" data-wz="all">${esc(this._t("wzAllInList"))}</button><button class="ag-link" data-wz="none">${esc(this._t("wzNoneInList"))}</button></div>`;
  }

  // Vorschlag nach Sensorart für einen neu gewählten Sensor (Entscheid des Nutzers 21:05): Türen und Fenster in jedem Modus, Bewegung und
  // Übriges bei Abwesend, Rauch, Wasser und Gas nur über "Immer aktiv" (ohne "Immer aktiv" in jedem Modus, damit er überhaupt auslöst)
  _suggest(id) {
    const h = this.host;
    const d = h.sensors.ensureDraft();
    const own = h.systemUi.draft?.entry === this.entry ? h.systemUi.draft : null;
    const modes = ALL_MODES.filter((m) => (own ? own.modes[m] : (this.system?.modes || []).includes(m)));
    // "Immer aktiv" zählt nur, wenn es die Anlage eingeschaltet hat (Schritt Modi) und der Sensor es hat (Standard seiner Art)
    const always = (own ? own.always : this.system?.always_enabled !== false) && h.sensors.eff(id, "always");
    const dc = h._sensor(id).device_class;
    let into = [];
    if (SAFETY.has(dc)) into = always ? [] : modes;
    else if (OPENINGS.has(dc) || dc === "glass_break" || dc === "vibration") into = modes;
    else {
      into = modes.filter((m) => m === "away");
      if (!into.length) into = modes.filter((m) => m !== "home");
      if (!into.length) into = modes;
    }
    for (const m of into) d.zones[m].add(id);
  }

  _timesHtml() {
    const h = this.host;
    const d = h.systemUi.ensureDraft();
    if (!d) return "";
    const modes = ALL_MODES.filter((m) => d.modes[m]);
    const bad = new Set(h.systemUi.invalid());
    const num = (key, value, mark) => `<span class="ag-num ${mark ? "bad" : ""}"><input type="number" min="0" max="3600" step="1" inputmode="numeric" data-wz="${key}" value="${esc(value)}" aria-label="${esc(this._t(key === "exit" ? "wzExit" : "wzEntry", { mode: this._t("modeAway") }))}"><span class="ag-t2">${esc(this._t("seconds"))}</span></span>`;
    const first = modes.includes("away") ? "away" : modes[0] || "away";
    const entries = [...new Set(modes.map((m) => d.per[m].entry_delay))];
    // Symbole wie unter Konfiguration › Anlage › Zeiten (1.90.0)
    const exitRow = modes.includes("away") ? `<div class="ag-setrow">${rowIcon("timer")}<div class="ag-settx"><b>${esc(this._t("wzExit", { mode: this._t("modeAway") }))}</b><small>${esc(this._t("wzExitHint"))}</small></div>${num("exit", d.per.away.exit_delay, bad.has("away.exit_delay"))}</div>` : "";
    const entryRow = `<div class="ag-setrow">${rowIcon("doorOpen")}<div class="ag-settx"><b>${esc(this._t("wzEntry"))}</b><small>${esc(this._t("wzEntryHint"))}${entries.length > 1 ? ` ${esc(this._t("wzEntryMixed"))}` : ""}</small></div>${num("entry", d.per[first].entry_delay, modes.some((m) => bad.has(`${m}.entry_delay`)))}</div>`;
    return `${this._entryHtml()}${this._info("doorOpen", this._t("wzEntryInfo"))}${this._chap(this._t("chapTimes"), `<div class="ag-card ag-setlist">${exitRow}${entryRow}</div>`)}`;
  }

  // Eingang auf dem Handy: die Tabelle hat dort keine Spalte "Eingangsverzögerung" (sie steht im Blatt des Sensors, das im Assistenten nicht
  // aufgeht), darum je Sensor ein Schalter unter der Tabelle. Wählbar ist nur, was in einem Modus auslöst (sonst lehnt der Server ab);
  // Rauch, Wasser und Gas nie. Am Computer steht der Schalter in der Tabelle.
  _entryHtml() {
    const h = this.host;
    if (!h.hasAttribute("narrow")) return "";
    const d = h.sensors.ensureDraft();
    if (!d) return "";
    const ids = [...d.sensors].filter((id) => h._sensor(id).kind !== "value" && (!SAFETY.has(h._sensor(id).device_class) || d.entrySensors.has(id)))
      .sort((a, b) => Number(!OPENINGS.has(h._sensor(a).device_class)) - Number(!OPENINGS.has(h._sensor(b).device_class)) || h._name(a).localeCompare(h._name(b)));
    if (!ids.length) return "";
    const rows = ids.map((id) => {
      const on = d.entrySensors.has(id);
      const ok = h.sensors.inActive(id);
      const [icon, label] = DC[h._sensor(id).device_class] || ["sensor", "dcOther"];
      // Symbol der Sensorart zuerst (1.91.0, wie in der Sensortabelle), blau, wenn der Sensor der Eingang ist
      return `<div class="ag-setrow ag-wz-sw ag-wz-entry">${rowIcon(icon, on)}${this._toggle(on, `data-wz="entry-sensor" data-ent="${esc(id)}" ${ok || on ? "" : "disabled"}`, `${h._name(id)}: ${this._t("colEntry")}`)}
        <div class="ag-settx"><b>${esc(h._name(id))}</b><small>${esc(ok ? this._t(label) : this._t("entryHint"))}</small></div></div>`;
    }).join("");
    return this._chap(this._t("colEntry"), `<div class="ag-card ag-setlist">${rows}</div>`, this._t("wzEntryPick"));
  }

  // Nach einer Änderung in der eingebetteten Zuordnung (Kästchen): die Schalter des Eingangs folgen
  embedded() {
    if (!this.active || this.step !== "zones") return;
    const post = this.host._content?.querySelector(".ag-wz-post");
    if (post) this.host._setHtml(post, this._postHtml());
  }

  // Seit 1.90.0 gibt es nur noch Codes pro Person (kein Hauptcode mehr; einer aus 1.89.x ist beim Laden ein Code pro Person geworden)
  _hasCode(s = this.system) {
    return Boolean((s?.codes || []).length);
  }

  // Seit 1.89.0 (Wunsch des Nutzers 2026-11-25: alle Einstellungen zum Code auch im Assistenten): Codes pro Person und mit einem Code die Schalter,
  // wann er verlangt wird. Die Schalter sind dieselben wie unter Konfiguration › Anlage (SystemUi), gehören zum Entwurf der Seite Anlage und werden
  // mit "Weiter" gespeichert (_saveStep), Codes sofort wie dort. Die Zeile des Hauptcodes gibt es seit 1.90.0 nicht mehr.
  _codeHtml() {
    const h = this.host;
    const s = this.system;
    const codes = s?.codes || [];
    const names = codes.map((c) => c.name).join(", ");
    const title = codes.length ? this._t("wzCodeSome", { names }) : this._t("wzCodePersonNone");
    const card = `<div class="ag-card ag-setlist ag-codes"><div class="ag-setrow ag-rtsum ag-codesum"><span class="ag-oav ag-tint ag-tint-codes ${codes.length ? "on" : ""}">${ic("hand", 20)}</span>
        <div class="ag-settx"><b>${esc(title)}</b></div>
        <div class="ag-btnrow"><button class="ag-btn ${this._hasCode(s) ? "" : "primary"}" data-wz="code-add">${ic("plus", 18)}${esc(this._t("codeAdd"))}</button></div></div></div>`;
    const switches = s?.has_code ? this._chap(this._t("wzCodeWhen"), `<div class="ag-card ag-setlist ag-codes">${h.systemUi.codeSwitchesHtml(h.systemUi.ensureDraft())}</div>`) : "";
    return `${card}${switches}${this._info("check", esc(this._t("wzCodeHash")), "ok")}${this._info("hand", this._t("wzCodeMore"))}`;
  }

  _notifyHtml() {
    const h = this.host;
    const d = h.notify.ensureDraft();
    const services = h._data?.notify_services || [];
    const group = (key, title, hint) => {
      const chosen = d[key] || [];
      const free = services.filter((x) => !chosen.includes(x));
      const pills = chosen.map((x) => `<span class="ag-rpill ${services.includes(x) ? "" : "gone"}">${ic("bell", 14)}<span>${esc(short(x))}</span><button type="button" class="ag-rx" data-wz="target-del" data-key="${key}" data-target="${esc(x)}" aria-label="${esc(this._t("ntRemove", { name: short(x) }))}">${ic("close", 14)}</button></span>`).join("");
      const select = services.length ? `<select class="ag-input ag-rsel" data-wz="target-add" data-key="${key}" aria-label="${esc(this._t("ntAdd"))}" ${free.length ? "" : "disabled"}><option value="">${esc(this._t(free.length ? "ntAdd" : "ntAllChosen"))}</option>${free.map((x) => `<option value="${esc(x)}">${esc(short(x))}</option>`).join("")}</select>`
        : `<div class="ag-t2 ag-small">${esc(this._t("ntNoServices"))}</div>`;
      const none = !chosen.length && services.length ? `<small class="ag-warntext">${ic("alert", 14)} ${esc(this._t("ntNoneChosen"))}</small>` : "";
      // Symbol oben links wie unter Konfiguration › Benachrichtigungen (1.91.0): Glocke für die Alarme, Zahnrad für die Wartung
      return `<div class="ag-setrow ag-recip" data-group="${key}">${rowIcon(key === "alarm_targets" ? "bell" : "cog", true, `ag-ntone ${key === "alarm_targets" ? "fault" : "maint"}`)}<div class="ag-settx"><b>${esc(this._t(title))}</b><small>${esc(this._t(hint))}</small><div class="ag-rline">${select}</div>${pills ? `<div class="ag-rpills">${pills}</div>` : ""}${none}</div></div>`;
    };
    // Seit 1.91.0 (Wunsch des Nutzers 2026-11-25: "zuerst das Icon, dann der Schalter, dann der Text", "mit den gleichen Icons wie in den
    // Einstellungen"): Zeilen wie überall, das Symbol in der Farbe der Gruppe (Störung rot, Wartung orange), grau, solange die Meldung aus ist
    const kind = (key) => {
      const on = d.types[key]?.enabled !== false;
      return `<div class="ag-setrow ag-wz-kind ${on ? "" : "off"}" data-kind="${key}">${rowIcon(NOTIFY_ICON[key], on, `ag-ntone ${NOTIFY_TONE[key]}`)}${this._toggle(on, `data-wz="kind" data-kind="${key}"`, this._t(`ntT_${key}`))}
        <div class="ag-settx"><b>${esc(this._t(`ntT_${key}`))}</b><small>${esc(this._t(`ntH_${key}`))}</small></div></div>`;
    };
    // Die Alarmmeldung ist immer an: an der Stelle des Schalters ein Schloss
    const alarm = `<div class="ag-setrow ag-wz-kind" data-kind="triggered">${rowIcon("alert", true, "ag-ntone fault")}<span class="ag-wz-lock" title="${esc(this._t("wzKindAlarmHint"))}">${ic("lockClosed", 20)}</span>
      <div class="ag-settx"><b>${esc(this._t("ntT_triggered"))}</b><small>${esc(this._t("wzKindAlarmHint"))}</small></div></div>`;
    // Je eine Testmeldung an die Empfänger von Alarmen und von Wartungsmeldungen (Wunsch des Nutzers 2026-11-20, 11:40: sie können verschieden sein)
    const test = `<div class="ag-wz-testbtns">${this._groupTestBtn("alarm", "wzTestBtnAlarm", (d.alarm_targets || []).length)}${this._groupTestBtn("maintenance", "wzTestBtnMaint", (d.maintenance_targets || []).length)}</div>`;
    return `${this._chap(this._t("wzRecipients"), `<div class="ag-card ag-setlist">${group("alarm_targets", "ntAlarmTargets", "ntAlarmTargetsHint")}${group("maintenance_targets", "ntMaintTargets", "ntMaintTargetsHint")}</div>`, this._t("wzRecipientsHint"))}
      ${this._chap(this._t("wzKinds"), `<div class="ag-card ag-setlist ag-wz-kinds">${alarm}${KINDS.map(kind).join("")}</div><p class="ag-chap-h ag-wz-note">${esc(this._t("wzArmedNote"))}</p>`)}
      <div class="ag-card ag-setlist"><div class="ag-setrow ag-wz-testrow">${rowIcon("cellphoneCheck")}<div class="ag-settx"><b>${esc(this._t("wzTestTitle"))}</b><small>${esc(this._t("wzTestHint"))}</small></div>${test}</div></div>`;
  }

  // Messwerte der Überwachung, die gewählt sind (Entwurf der Sensoren, sonst gespeichert)
  _monChosen() {
    const h = this.host;
    return new Set(h.sensors.draft?.entry === this.entry ? h.sensors.draft.monitorSensors : this.system?.monitor_sensors || []);
  }

  _monInfo(id) {
    return this.measures?.[id] || this.host._sensor(id) || {};
  }

  // Jetziger Wert mit Einheit, in der Schreibweise der Sprache (hilft, gleichnamige Sensoren zu unterscheiden)
  _monValue(id) {
    const h = this.host;
    const st = h._state(id);
    const n = st && st.state !== "" ? Number(st.state) : NaN;
    if (!Number.isFinite(n)) return "–";
    const unit = st.attributes?.unit_of_measurement || this._monInfo(id).unit || "";
    return `${n.toLocaleString(h._hass?.locale?.language || h._lang, { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;
  }

  // Zeilen nach Bereich, wie "Sensoren hinzufügen": im Fenster mit Kästchen, in der Liste der gewählten mit Papierkorb
  _monRows(ids, q, f, pick) {
    const h = this.host;
    const rows = ids.map((id) => {
      const info = this._monInfo(id);
      return { id, info, name: info.name || h._name(id), area: info.area || this._t("noArea"), kind: measureKind(info.device_class) };
    }).filter((r) => (f === "all" || r.kind === f) && matchQuery(q, r.name, r.area, r.id, r.info.integration, this._t((DC[r.info.device_class] || [])[1] || "dcOther")))
      .sort((a, b) => Number(!a.info.area) - Number(!b.info.area) || a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
    if (!rows.length) return "";
    let area = null;
    return rows.map((r) => {
      const [icon, label] = DC[r.info.device_class] || ["gauge", "dcOther"];
      const head = r.area !== area ? `<div class="ag-group-label">${esc((area = r.area))}</div>` : "";
      const text = `<span class="ag-av">${ic(icon, 18)}</span><span class="ag-wz-mtx"><b>${esc(r.name)}</b><small class="ag-t2">${esc([this._t(label), r.info.integration].filter(Boolean).join(" · "))}</small></span><span class="ag-wz-mval">${esc(this._monValue(r.id))}</span>`;
      if (pick) {
        const on = this.pick.sel.has(r.id);
        return `${head}<button class="ag-erow ${on ? "on" : ""}" data-wz="mpick-toggle" data-ent="${esc(r.id)}" role="checkbox" aria-checked="${on}"><span class="ag-box ${on ? "on" : ""}">${on ? ic("check", 18) : ""}</span>${text}</button>`;
      }
      return `${head}<div class="ag-erow ag-wz-mrow">${text}<div class="ag-wf-btns ag-senbtns"><button class="ag-iconbtn" data-wz="mon-remove" data-ent="${esc(r.id)}" ${this.busy ? "disabled" : ""}
        aria-label="${esc(this._t("wzMonRemove", { name: r.name }))}" title="${esc(this._t("wzMonRemove", { name: r.name }))}">${ic("trash", 18)}</button></div></div>`;
    }).join("");
  }

  // Filter, die etwas zeigen: "Alle" und jede Art, die es in der Liste gibt
  _monChips(ids, current, act) {
    const kinds = new Set(ids.map((id) => measureKind(this._monInfo(id).device_class)));
    return MEASURE_FILTERS.filter(([k]) => k === "all" || kinds.has(k))
      .map(([k, label]) => `<button class="ag-chip ${current === k ? "on" : ""}" data-wz="${act}" data-f="${k}">${esc(this._t(label))}</button>`).join("");
  }

  _monListHtml() {
    const ids = [...this._monChosen()];
    return this._monRows(ids, this.mq, this.mf, false) || `<div class="ag-t2 ag-small ag-wz-mnone">${esc(this._t("pickNone"))}</div>`;
  }

  _monitorHtml() {
    if (this.measures === null) return `<div class="ag-wz-wait"><span class="ag-t2">${esc(this._t("loading"))}</span></div>`;
    const s = this.system;
    const measures = this.measures || {};
    const chosen = [...this._monChosen()];
    const on = Boolean(s.monitor_enabled);
    const free = Object.keys(measures).filter((id) => !chosen.includes(id)).length;
    if (!chosen.some((id) => this.mf === "all" || measureKind(this._monInfo(id).device_class) === this.mf)) this.mf = "all";
    const add = `<button class="ag-btn" data-wz="mpick-open" ${this.busy || !free ? "disabled" : ""}>${ic("plus", 18)}${esc(this._t("wzMonAdd"))}</button>`;
    // Symbol der Messwerte wie in der Sensortabelle (1.91.0); die leere Liste zeigt es nicht noch einmal
    const head = `<div class="ag-wz-mtitle">${rowIcon("gauge", chosen.length > 0)}<div class="ag-settx"><b>${esc(this._t("wzMonSensors"))}</b><small>${esc(this._t("wzMonSensorsHint"))}</small></div></div>`;
    // Leer: nur der Hinweis mit dem Knopf. Mit Messwerten: Knopf oben rechts, darunter Suche, Filter und die Liste fester Höhe
    const body = !chosen.length
      ? `${head}<div class="ag-wz-mempty"><div><b>${esc(this._t("wzMonEmpty"))}</b><small>${esc(this._t("wzMonEmptyHint", { n: free }))}</small></div>${add}</div>`
      : `<div class="ag-wz-mhead">${head}${add}</div>
        <div class="ag-wz-tools ag-wz-mtools">${searchField("data-wz", "mon-q", this.mq, this._t("search"), this._t("clearSearch"))}<div class="ag-wz-chips">${this._monChips(chosen, this.mf, "mon-filter")}</div>
          <span class="ag-wz-count">${esc(this._t("wzMonCount", { n: chosen.length }))}</span></div>
        <div class="ag-elist ag-wz-mlist">${this._monListHtml()}</div>`;
    return `${this._info("eye", this._t("wzL_monitor", { n: Object.keys(measures).length }))}
      <div class="ag-card ag-setlist"><div class="ag-setrow ag-wz-sw">${rowIcon("eye", on)}${this._toggle(on, `data-wz="mon-use" ${this.busy ? "disabled" : ""}`, this._t("wzMonUse"))}<div class="ag-settx"><b>${esc(this._t("wzMonUse"))}</b><small>${esc(this._t("wzMonUseHint"))}</small></div></div>
        ${on ? `<div class="ag-setrow ag-wz-monsensors">${body}</div>` : ""}</div>`;
  }

  // ----- Fenster "Messwerte hinzufügen" (#ag-wzpick), aufgebaut wie "Sensoren hinzufügen" -----

  _pickDlg() {
    return this.host._root.getElementById("ag-wzpick");
  }

  _pickIds() {
    const chosen = this._monChosen();
    return Object.keys(this.measures || {}).filter((id) => !chosen.has(id));
  }

  openPick() {
    const dlg = this._pickDlg();
    if (!dlg || this.busy) return;
    this.pick = { q: "", f: "all", sel: new Set(), error: "" };
    // Wie auch immer das Fenster schliesst: danach ist keine Auswahl mehr offen, und nichts bleibt im geschlossenen Fenster stehen
    dlg.onclose = () => {
      this.pick = null;
      dlg.innerHTML = "";
      this.host._lastHtml?.delete(dlg);
    };
    this._renderPick();
    dlg.showModal();
    dlg.querySelector('[data-wz="mpick-q"]')?.focus({ preventScroll: true });
  }

  _pickListHtml() {
    if (!this.measures) return `<div class="ag-wz-wait"><span class="ag-t2">${esc(this._t("loading"))}</span></div>`;
    return this._monRows(this._pickIds(), this.pick.q, this.pick.f, true) || `<div class="ag-t2 ag-small" style="padding:14px">${esc(this._t("pickNone"))}</div>`;
  }

  _renderPick() {
    const p = this.pick;
    const dlg = this._pickDlg();
    if (!p || !dlg) return;
    const ids = this._pickIds();
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-wz-pick"><h3>${esc(this._t("wzMonPickTitle"))}</h3><div class="ag-t2">${esc(this._t("wzMonPickHint"))}</div>
      <div class="ag-wz-tools">${searchField("data-wz", "mpick-q", p.q, this._t("search"), this._t("clearSearch"))}<div class="ag-wz-chips">${this._monChips(ids, p.f, "mpick-filter")}</div></div>
      <div class="ag-elist ag-wz-plist">${this._pickListHtml()}</div><div class="ag-dlg-err" aria-live="polite">${esc(p.error)}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-wz="mpick-close">${esc(this._t("cancel"))}</button>
        <button class="ag-btn primary" data-wz="mpick-add" ${p.sel.size && !this.busy ? "" : "disabled"}>${ic("plus", 18)}<span>${esc(this._t("pickAdd", { count: p.sel.size }))}</span></button></div></div>`);
  }

  // Nur die Liste neu (Suchfeld behält den Fokus, die Liste ihren Rollstand)
  _renderPickList() {
    const list = this._pickDlg()?.querySelector(".ag-wz-plist");
    if (!list) return;
    const top = list.scrollTop;
    list.innerHTML = this._pickListHtml();
    list.scrollTop = top;
    this._pickFoot();
  }

  _pickFoot() {
    const btn = this._pickDlg()?.querySelector('[data-wz="mpick-add"]');
    if (!btn || !this.pick) return;
    btn.disabled = !this.pick.sel.size || this.busy;
    btn.querySelector("span").textContent = this._t("pickAdd", { count: this.pick.sel.size });
  }

  // Hinzufügen gilt sofort (wie bisher die Knöpfe): erst danach können die Regeln darunter die Messwerte verwenden
  async _pickAdd() {
    const h = this.host;
    const p = this.pick;
    if (!p?.sel.size || this.busy) return;
    this.busy = true;
    this._pickFoot();
    try {
      const d = h.sensors.ensureDraft();
      for (const id of p.sel) d.monitorSensors.add(id);
      if (await this._save(h.sensors)) {
        this.mq = "";
        this.mf = "all";
        h._closeDialog("ag-wzpick");
      } else {
        p.error = this.error;
        this.error = "";
      }
    } finally {
      this.busy = false;
      if (this.pick) this._renderPick();
      if (this.active) h._renderView(true);
    }
  }

  // Liste der gewählten: nur die Zeilen neu
  _renderMonList() {
    const list = this.host._content?.querySelector(".ag-wz-mlist");
    if (list) list.innerHTML = this._monListHtml();
  }

  // Kurzfassung je Schritt (Schrittliste und Abschluss)
  _summary(step) {
    const h = this.host;
    const s = this.system;
    if (!s) return "";
    const modes = s.modes || [];
    if (step === "modes") return this._t("wzSumModes", { modes: modes.map((m) => this._t(MODE_KEY[m])).join(", "), always: s.always_enabled !== false ? this._t("wzSumAlways") : "" });
    const count = new Set([...(s.sensors || []), ...Object.values(s.zones || {}).flat()]).size;
    if (step === "sensors") return this._t("wzSumCount", { n: count });
    if (step === "zones") {
      const n = count;
      const entry = (s.entry_sensors || []).map((id) => h._name(id)).join(", ") || this._t("wzSumNoEntry");
      const ms = s.mode_settings || {};
      const first = modes.includes("away") ? "away" : modes[0];
      return this._t("wzSumSensors", { n, entry, exit: `${ms.away?.exit_delay ?? 0} s`, delay: `${ms[first]?.entry_delay ?? 0} s` });
    }
    if (step === "code") {
      const names = (s.codes || []).map((c) => c.name);
      return names.length ? this._t("wzSumCodes", { names: names.join(", ") }) : this._t("wzSumNoCode");
    }
    if (step === "notify") {
      const n = h._data?.notify || {};
      const targets = (n.alarm_targets || []).map(short).join(", ");
      const on = KINDS.filter((k) => n.types?.[k]?.enabled !== false).length + 1;
      return targets ? this._t("wzSumNotify", { targets, on, total: KINDS.length + 1 }) : this._t("wzSumNoTargets");
    }
    if (step === "actions") {
      const trig = modes.includes("away") ? "away" : modes[0];
      const n = (s.workflows?.[trig] || []).length;
      return n ? this._t("wzSumActions", { n }) : this._t("wzSumActionsNone");
    }
    if (step === "monitor") return s.monitor_enabled ? this._t("wzSumMonitor", { n: (s.monitors || []).length }) : this._t("wzSumMonitorOff");
    return "";
  }

  _doneHtml() {
    const h = this.host;
    const s = this.system;
    const icons = { modes: "shieldAway", zones: "sensor", code: "key", notify: "bell", actions: "power", monitor: "eye" };
    const rows = ["modes", "zones", "code", "notify", "actions", ...(this.steps().includes("monitor") ? ["monitor"] : [])].map((step) => `<div class="ag-setrow"><span class="ag-oav on">${ic(icons[step], 20)}</span>
      <div class="ag-settx"><b>${esc(this._t(`wzS_${step === "zones" ? "sensors" : step}`))}</b><small>${esc(this._summary(step))}</small></div><button class="ag-link" data-wz="goto" data-step="${step}">${esc(this._t("wzChange"))}</button></div>`).join("");
    const trig = h.actions.trigger;
    // Wie jeder Play-Knopf (Vorgabe des Nutzers 2026-11-17): rot mit Stopp, solange der Test läuft; ohne Aktionen gesperrt
    const running = Boolean(s.workflow_running && s.workflow_test);
    const steps = h.actions.ensureDraft() ? h.actions.steps().length : 0;
    const testLabel = this._t(running ? "playStop" : "wzTestActions");
    const testBtn = `<button type="button" class="ag-btn ${running ? "ag-running" : ""}" data-wz="wf-test" aria-label="${esc(testLabel)}" title="${esc(testLabel)}" ${!running && (s.workflow_running || !steps) ? "disabled" : ""}>${ic(running ? "stop" : "play", 16)}${esc(testLabel)}</button>`;
    // Ohne "Aktionen pro Modus" gilt ein Ablauf für alle Modi: dann ohne Namen des Modus
    const mode = { mode: this._t(MODE_KEY[trig] || "modeAway") };
    const per = Boolean(h.actions.draft?.perMode);
    const testHint = this._t(steps ? (per ? "wzTestActionsHint" : "wzTestActionsHintAll") : per ? "wzTestActionsNone" : "wzTestActionsNoneAll", mode);
    const msgRow = (group, title) => {
      const targets = (h._data?.notify?.[group === "alarm" ? "alarm_targets" : "maintenance_targets"] || []).map(short).join(", ");
      return `<div class="ag-setrow">${rowIcon(group === "alarm" ? "bell" : "cog")}<div class="ag-settx"><b>${esc(this._t(title))}</b><small>${esc(targets ? this._t("wzTestMsgHint", { targets }) : this._t("wzSumNoTargets"))}</small></div>${this._groupTestBtn(group, "ntTestType", targets)}</div>`;
    };
    const ready = (s.modes || []).map((m) => {
      const open = [...h._blocking(s, m), ...h._unreachable(s, m)]; // offen oder nicht erreichbar (1.87.0)
      return `<span class="ag-rchip ${open.length ? "no" : "ok"}">${ic(open.length ? "alert" : "check", 14)}${esc(this._t(MODE_KEY[m]))}${open.length ? `: ${esc(open.map((id) => h._name(id)).join(", "))}` : ""}</span>`;
    }).join("");
    // Nur zur Information, keine Kacheln (sie verleiteten zum Klicken): je Funktion, was sie tut und wo sie steht; unten ein Knopf, der den
    // Assistenten abschliesst und Konfiguration › Anlage öffnet
    const more = MORE.map(([icon, tint, title, text, where, go]) => `<div class="ag-setrow ag-wz-morerow">${rowIcon(icon, true, `ag-tint ag-tint-${tint} ag-wz-moreic`)}<div class="ag-settx"><b>${esc(this._t(title))}</b><small>${esc(this._t(text))}</small>
      <small class="ag-wz-where">${ic("info", 13)}${esc(this._t(where))}</small></div>${go ? `<div class="ag-wf-btns ag-wz-gowrap"><button class="ag-iconbtn ag-wz-go" data-wz="more-go" data-go="${go}" ${this.busy ? "disabled" : ""} aria-label="${esc(this._t("wzMoreGo", { name: this._t(title) }))}" title="${esc(this._t("wzMoreGo", { name: this._t(title) }))}">${ic("chevRight", 18)}</button></div>` : ""}</div>`).join("");
    return `<div class="ag-card ag-setlist ag-wz-sum">${rows}</div>
      ${this._chap(this._t("wzTry"), `<div class="ag-card ag-setlist">
        <div class="ag-setrow">${rowIcon("power")}<div class="ag-settx"><b>${esc(this._t("wzTestActions"))}</b><small>${esc(testHint)}</small></div>${testBtn}</div>
        ${msgRow("alarm", "wzTestMsgAlarm")}${msgRow("maintenance", "wzTestMsgMaint")}
        <div class="ag-setrow ag-wz-readyrow">${rowIcon("shieldCheck")}<div class="ag-settx"><b>${esc(this._t("wzReady"))}</b><small>${esc(this._t("wzReadyHint"))}</small></div><div class="ag-ready">${ready}</div></div></div>`)}
      ${this._chap(this._t("wzMore"), `<div class="ag-card ag-setlist ag-wz-more">${more}
        <div class="ag-setrow ag-wz-moreopen">${rowIcon("cog")}<div class="ag-settx"><small>${esc(this._t("wzMoreOpenHint"))}</small></div><button class="ag-btn" data-wz="settings" ${this.busy ? "disabled" : ""}>${ic("cog", 18)}${esc(this._t("wzMoreOpen"))}</button></div></div>`, this._t("wzMoreHint"))}`;
  }

  // ----- Fenster "Später" und "Offene Änderungen" -----

  askLater() {
    this.ask = { kind: "later" };
    this._renderAsk();
  }

  _renderAsk() {
    const dlg = this.host._root.getElementById("ag-wzask");
    if (!dlg || !this.ask) return;
    const t = (k) => esc(this._t(k));
    dlg.innerHTML = this.ask.kind === "dirty"
      ? `<div class="ag-dlg-body"><h3>${t("wzDirtyTitle")}</h3><div class="ag-t2">${t("wzDirtyText")}</div>
        <div class="ag-dlg-btns"><button class="ag-btn" data-wz="ask-close">${t("cancel")}</button><button class="ag-btn primary" data-wz="dirty-go">${t("wzDirtyGo")}</button></div></div>`
      : `<div class="ag-dlg-body ag-wz-ask"><h3>${t("wzAskTitle")}</h3><div class="ag-t2">${t("wzAskText")}</div>
        <button class="ag-btn primary" data-wz="ask-later">${ic("clock", 18)}<span><b>${t("wzAskTomorrow")}</b><small>${t("wzAskTomorrowHint")}</small></span></button>
        <button class="ag-btn" data-wz="ask-hide">${ic("eyeOff", 18)}<span><b>${t("wzAskHide")}</b><small>${t("wzAskHideHint")}</small></span></button>
        <button class="ag-btn" data-wz="ask-close">${ic("undo", 18)}<span><b>${t("wzAskStay")}</b></span></button></div>`;
    if (!dlg.open) dlg.showModal();
  }

  // ----- Ereignisse -----

  onClick(el) {
    const act = el?.dataset.wz;
    if (!act) return false;
    const h = this.host;
    if (act === "run") {
      this.start(el.dataset.step || "welcome");
      return true;
    }
    if (act === "ask-close") {
      h._root.getElementById("ag-wzask")?.close();
      this.ask = null;
      return true;
    }
    if (act === "dirty-go") {
      const step = this.ask?.step || "welcome";
      for (const ui of this._uis()) ui.reset();
      h._root.getElementById("ag-wzask")?.close();
      this.ask = null;
      this._startNow(step);
      return true;
    }
    if (!this.active) return false;
    if (act === "next") this.next();
    else if (act === "back") this.back();
    else if (act === "later") this.askLater();
    else if (act === "ask-later") this.later("later");
    else if (act === "ask-hide") this.later("hide");
    else if (act === "goto") {
      if (!el.disabled && el.dataset.step !== this.step) this.go(el.dataset.step);
    } else if (act === "mode") {
      const d = h.systemUi.ensureDraft();
      d.modes[el.dataset.mode] = !d.modes[el.dataset.mode];
      this.render();
    } else if (act === "always") {
      const d = h.systemUi.ensureDraft();
      d.always = !d.always;
      this.render();
    } else if (act === "filter") {
      this.filter = el.dataset.f;
      this.render();
    } else if (act === "pick") {
      const id = el.dataset.ent;
      const d = h.sensors.ensureDraft();
      if (d.sensors.has(id)) h.sensors.removeSensor(id);
      else {
        d.sensors.add(id);
        this._suggest(id);
      }
      h.sensors.saveState = null;
      this.render();
    } else if (act === "all" || act === "none") {
      const d = h.sensors.ensureDraft();
      for (const r of this._filtered()) {
        if (act === "all" && !d.sensors.has(r.id)) {
          d.sensors.add(r.id);
          this._suggest(r.id);
        } else if (act === "none" && d.sensors.has(r.id)) h.sensors.removeSensor(r.id);
      }
      this.render();
    } else if (act === "entry-sensor") {
      // Nicht "entry": so heisst das Feld der Zeit zum Deaktivieren (ein Klick hinein zeichnete sonst neu und nahm ihm den Fokus)
      const d = h.sensors.ensureDraft();
      const id = el.dataset.ent;
      if (d.entrySensors.has(id)) d.entrySensors.delete(id);
      else if (h.sensors.inActive(id)) d.entrySensors.add(id);
      h.sensors.saveState = null;
      this.render();
    } else if (act === "code-add") {
      const me = h._hass?.user;
      h.systemUi.openCodeForm("", me ? { userId: me.id, name: me.name } : null);
    } else if (act === "target-del") {
      const d = h.notify.ensureDraft();
      d[el.dataset.key] = (d[el.dataset.key] || []).filter((x) => x !== el.dataset.target);
      this.render();
    } else if (act === "kind") {
      const d = h.notify.ensureDraft();
      d.types[el.dataset.kind].enabled = d.types[el.dataset.kind].enabled === false;
      this.render();
    } else if (act === "nt-test") {
      this._notifyTest(el.dataset.group || "alarm");
    } else if (act === "quick") {
      h.actions.quickAdd(el.dataset.q);
    } else if (act === "mon-use") {
      this._monitorUse();
    } else if (act === "mon-remove") {
      this._monitorSensor(el.dataset.ent);
    } else if (act === "mon-filter") {
      this.mf = el.dataset.f;
      el.parentElement.querySelectorAll("[data-wz]").forEach((b) => b.classList.toggle("on", b === el));
      this._renderMonList();
    } else if (act === "mon-q-clear" || act === "mpick-q-clear") {
      const input = el.parentElement.querySelector("input");
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    } else if (act === "mpick-open") {
      this.openPick();
    } else if (act === "mpick-toggle") {
      const id = el.dataset.ent;
      if (this.pick.sel.has(id)) this.pick.sel.delete(id);
      else this.pick.sel.add(id);
      const on = this.pick.sel.has(id);
      el.classList.toggle("on", on);
      el.setAttribute("aria-checked", String(on));
      const box = el.querySelector(".ag-box");
      box.classList.toggle("on", on);
      box.innerHTML = on ? ic("check", 18) : "";
      this._pickFoot();
    } else if (act === "mpick-filter") {
      this.pick.f = el.dataset.f;
      el.parentElement.querySelectorAll("[data-wz]").forEach((b) => b.classList.toggle("on", b === el));
      this._renderPickList();
    } else if (act === "mpick-close") {
      this.host._closeDialog("ag-wzpick");
    } else if (act === "mpick-add") {
      this._pickAdd();
    } else if (act === "more-go") {
      this._goMore(el.dataset.go);
    } else if (act === "settings") {
      // Weitere Funktionen: schliesst den Assistenten wie "Fertig" (alles ist gespeichert) und öffnet Konfiguration › Anlage
      this.finishTo = "system";
      this.next().finally(() => (this.finishTo = null));
    } else if (act === "wf-test") {
      // Die Ansicht der Aktionen ist hier nicht eingebettet: danach den Schritt selbst neu zeichnen (Knopf rot bzw. wieder Play)
      const s = this.system;
      h.actions.test(Boolean(s?.workflow_running && s?.workflow_test)).then(() => {
        if (this.active && this.step === "done") this.render();
      });
    } else return false;
    return true;
  }

  onInput(el) {
    const act = el?.dataset.wz;
    if (!act || !this.active) return false;
    const h = this.host;
    if (act === "q") {
      this.q = el.value;
      // Nur die Liste neu (das Suchfeld behält den Fokus)
      const list = h._content?.querySelector(".ag-wz-list .ag-elist");
      const html = this._sensorsHtml();
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      if (list) list.innerHTML = tmp.querySelector(".ag-wz-list .ag-elist").innerHTML;
      return true;
    }
    if (act === "mon-q" || act === "mpick-q") {
      el.parentElement.querySelector(".ag-clear")?.toggleAttribute("hidden", !el.value);
      if (act === "mon-q") {
        this.mq = el.value;
        this._renderMonList();
      } else if (this.pick) {
        this.pick.q = el.value;
        this._renderPickList();
      }
      return true;
    }
    if (act === "exit" || act === "entry") {
      const d = h.systemUi.ensureDraft();
      const v = el.value === "" ? NaN : Number(el.value);
      const modes = ALL_MODES.filter((m) => d.modes[m]);
      if (act === "exit") {
        if (d.perMode) d.per.away.exit_delay = v;
        else for (const m of ALL_MODES) d.per[m].exit_delay = v;
      } else {
        for (const m of d.perMode ? modes : ALL_MODES) d.per[m].entry_delay = v;
      }
      el.closest(".ag-num")?.classList.toggle("bad", !Number.isInteger(v) || v < 0 || v > 3600);
      return true;
    }
    return false;
  }

  onChange(el) {
    const act = el?.dataset.wz;
    if (act !== "target-add" || !this.active || !el.value) return false;
    const d = this.host.notify.ensureDraft();
    const key = el.dataset.key;
    if (!(d[key] || []).includes(el.value)) d[key] = [...(d[key] || []), el.value];
    this.render();
    return true;
  }

  // Play-Knopf der Testmeldung an die Standard-Empfänger einer Gruppe ("alarm" oder "maintenance"); ohne Empfänger gesperrt
  _groupTestBtn(group, label, any) {
    const key = `nt:group:${group}`;
    return onceBtn(key, `data-wz="nt-test" data-group="${group}"`, { running: this.host.notify.onceKey === key, label: this._t(label), stopLabel: this._t("playStop"), text: this._t(label), size: 16, cls: "ag-btn", disabled: !any });
  }

  // Testmeldung an die Empfänger von Alarmen oder von Wartungsmeldungen: speichert zuerst still den Schritt (die Meldung geht an die gespeicherten
  // Empfänger). Der Hinweis sagt nichts vom Speichern (Wunsch des Nutzers 2026-11-20, 08:49: keine Seite des Assistenten soll man separat
  // speichern müssen; wir kümmern uns darum)
  async _notifyTest(group) {
    const h = this.host;
    if (h.notify.onceKey === `nt:group:${group}`) return h.notify.test(null, null, group);
    if (!(await this._save(h.notify))) return this._paintFoot();
    await h.notify.test(null, null, group);
  }

  // Überwachung ein/aus und ihre Sensoren gelten sofort: erst danach gibt es den Reiter der Regeln und die Sensoren darin
  async _monitorUse() {
    const h = this.host;
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const d = h.systemUi.ensureDraft();
      d.monitor = !d.monitor;
      await this._save(h.systemUi);
    } finally {
      this.busy = false;
      if (this.active) h._renderView(true);
    }
  }

  async _monitorSensor(id) {
    const h = this.host;
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const d = h.sensors.ensureDraft();
      if (d.monitorSensors.has(id)) d.monitorSensors.delete(id);
      else d.monitorSensors.add(id);
      await this._save(h.sensors);
    } finally {
      this.busy = false;
      if (this.active) h._renderView(true);
    }
  }
}
