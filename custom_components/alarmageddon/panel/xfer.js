// Konfiguration › Aktionen: eine Aktion verschieben oder kopieren (1.85.0, Wunsch des Nutzers 2026-11-23, Mockups `aktion-verschieben-v1` und `-v2`, Variante B).
// Der Knopf an der Karte öffnet ein Fenster: oben die Reiter der Modi (nur mit "Einstellungen pro Modus"), darunter ein Baum aller Phasen des Ablaufs in
// der Reihenfolge des Ablaufs. Die gewählte Phase klappt auf und zeigt ihre Aktionen (Gruppen mit ihren Aktionen) mit Einfügepunkten: die genaue Stelle.
// Gezeigt werden nur Phasen und Gruppen, in denen die Aktion erlaubt ist (gleiche Regeln wie beim Ziehen und im Auswahlfenster). "Verschieben" nimmt die
// Aktion von ihrem Ort weg, "Kopieren" lässt sie dort stehen; beide ändern nur den Entwurf der Seite. Danach springt die Seite zur Aktion und hebt sie
// hervor, eine Meldung nennt das Ziel und bietet "Rückgängig" an (`ActionsUi._relocate`). Das Fenster rechnet nichts selbst: es fragt ActionsUi.

const V = new URL(import.meta.url).search;
const { ic, esc, iconTitle, MODE_ICON, MODE_KEY } = await import(`./common.js${V}`);

// Kapitel des Ablaufs und ihre Phasen (Schlüssel wie in ActionsUi.xfPhases)
const CHAPTERS = [
  ["wfChapArm", ["arming", "armed"]],
  ["wfChapReport", ["report"]],
  ["wfChapAlarm", ["entry", "alarm", "end"]],
  ["wfChapDisarm", ["disarmed"]],
];
const PHASE_ICON = { arming: "timer", armed: "shieldAway", report: "bellOff", entry: "timer", alarm: "alert", end: "check", disarmed: "shieldOff" };
const PHASE_COLOR = { arming: "#ff8a80", armed: "#ff8a80", report: "#f59e0b", entry: "#f59e0b", alarm: "#e5484d", end: "#2e7d32", disarmed: "#2e7d32" };

export class XferUi {
  constructor(actions) {
    this.a = actions;
    this.s = null; // { from: { trigger, zone, index }, mode, open, pick: { zone, at, phase } | null }
  }

  get host() {
    return this.a.host;
  }

  _t(key, params) {
    return this.a._t(key, params);
  }

  dlg() {
    return this.host._root.getElementById("ag-xfer");
  }

  // Fenster für die Aktion `index` der Liste `zone` im gewählten Reiter öffnen
  open(zone, index) {
    const a = this.a;
    if (!a.ensureDraft() || !a.steps(zone)[index]) return;
    this.s = { from: { trigger: a.trigger, zone, index }, mode: a.trigger, open: null, pick: null };
    this.render();
    this.dlg()?.showModal();
  }

  close() {
    this.s = null;
    const dlg = this.dlg();
    if (dlg?.open) dlg.close();
  }

  _modeLabel(trigger) {
    return this._t(trigger === "always" ? "wfAlways" : MODE_KEY[trigger]);
  }

  _step() {
    const { from } = this.s;
    return this.a.steps(from.zone, from.trigger)[from.index];
  }

  // Zahl der Aktionen einer Phase samt denen ihrer Gruppen
  _count(list) {
    return list.reduce((n, step) => n + 1 + (step?.type === "group" ? (step.steps || []).length : 0), 0);
  }

  // Liegt die Stelle unmittelbar vor oder hinter der Aktion selbst (Verschieben dorthin ändert nichts)?
  _same(zone, at) {
    const { from, mode } = this.s;
    return from.trigger === mode && from.zone === zone && (at === from.index || at === from.index + 1);
  }

  _isSelf(zone, i) {
    const { from, mode } = this.s;
    return from.trigger === mode && from.zone === zone && from.index === i;
  }

  // Eine Liste mit Einfügepunkten; `zone` ist der Pfad der Liste ("main" oder "main:2" für die Gruppe an Stelle 2)
  _list(zone, phase, kind) {
    const a = this.a;
    const { mode, pick } = this.s;
    const items = a.steps(zone, mode);
    const group = zone.includes(":");
    const slot = (at) => {
      const on = pick && pick.zone === zone && pick.at === at;
      const same = this._same(zone, at);
      return `<button type="button" class="ag-xf-slot ${on ? "on" : ""} ${same ? "same" : ""}" data-wf="xf-slot" data-zone="${esc(zone)}" data-at="${at}" data-phase="${phase}" aria-pressed="${Boolean(on)}">
        <span class="ag-xf-slot-l"></span>${esc(this._t(on ? "xfSlotHere" : same ? "xfSlotSame" : "xfSlot"))}</button>`;
    };
    const out = [];
    items.forEach((step, i) => {
      out.push(slot(i));
      if (step?.type === "group" && !group) {
        const inner = `${zone}:${i}`;
        // In die Gruppe nur, was dort erlaubt ist (nie eine Gruppe, nie "Quittieren")
        const body = a.zoneKinds(inner).includes(kind) ? this._list(inner, phase, kind) : "";
        out.push(`<div class="ag-xf-grp"><div class="ag-xf-grp-h">${ic("repeat", 16)}<b>${esc(a.xfName(step))}</b><small>${esc(a.xfGroupSummary(step))}</small></div>${body}</div>`);
      } else {
        const self = this._isSelf(zone, i);
        out.push(`<div class="ag-xf-step ${self ? "self" : ""}">${esc(a.xfName(step))}${self ? `<span class="ag-xf-tag">${esc(this._t("xfSelf"))}</span>` : ""}</div>`);
      }
    });
    out.push(slot(items.length));
    return `<div class="ag-xf-slots ${group ? "in" : ""}">${out.join("")}</div>`;
  }

  _tree(kind) {
    const a = this.a;
    const { mode, open, from } = this.s;
    const phases = a.xfPhases(mode).filter(([, zone]) => a.zoneKinds(zone).includes(kind));
    const byKey = new Map(phases.map((p) => [p[0], p]));
    return CHAPTERS.map(([title, keys]) => ({ title, keys: keys.filter((k) => byKey.has(k)) })).filter((c) => c.keys.length).map((c) => `<div class="ag-xf-chap">${esc(this._t(c.title))}</div>${c.keys.map((k) => {
      const [, zone, label] = byKey.get(k);
      const on = open === k;
      const n = this._count(a.steps(zone, mode));
      const here = from.trigger === mode && baseOf(from.zone) === zone;
      return `<div class="ag-xf-n"><span class="ag-xf-dot" style="--c:${PHASE_COLOR[k]}">${ic(PHASE_ICON[k], 16)}</span><div class="ag-xf-pw">
        <button type="button" class="ag-xf-p ${on ? "on" : ""}" data-wf="xf-phase" data-phase="${k}" aria-expanded="${on}"><span class="ag-xf-p-t"><b>${esc(this._t(label))}</b><small>${esc(this._t(n === 1 ? "xfOne" : "xfMany", { n }))}${here ? ` · ${esc(this._t("xfHere"))}` : ""}</small></span>
        <span class="ag-xf-chev ${on ? "open" : ""}">${ic("arrowDown", 18)}</span></button>${on ? this._list(zone, k, kind) : ""}</div></div>`;
    }).join("")}`).join("");
  }

  // Beschreibung der gewählten Stelle in Worten und ob Verschieben / Kopieren dort möglich sind
  _target() {
    const a = this.a;
    const { mode, pick, from } = this.s;
    if (!pick) return null;
    const base = baseOf(pick.zone);
    const phase = a.xfPhases(mode).find(([, zone]) => zone === base);
    const items = a.steps(pick.zone, mode);
    const group = pick.zone.includes(":") ? a.steps(base, mode)[Number(pick.zone.split(":")[1])] : null;
    const prev = items[pick.at - 1];
    const where = [this._modeLabel(mode), phase ? this._t(phase[2]) : "", group ? a.xfName(group) : ""].filter(Boolean).join(" › ");
    const place = prev ? this._t("xfAfter", { name: a.xfName(prev) }) : this._t(items.length ? "xfFirst" : "xfEmpty");
    const size = 1 + (this._step()?.type === "group" ? (this._step().steps || []).length : 0);
    const to = { trigger: mode, zone: pick.zone, at: pick.at };
    const copyOk = !a.xfFull(from, to, size, true);
    const moveOk = !this._same(pick.zone, pick.at) && !a.xfFull(from, to, size, false);
    return { where, place: items.length && pick.at === items.length && prev ? this._t("xfLast") : place, to, copyOk, moveOk, full: !copyOk };
  }

  render() {
    const dlg = this.dlg();
    if (!dlg || !this.s) return;
    const a = this.a;
    const step = this._step();
    if (!step) return this.close();
    const f = a.xfKind(step);
    const scroll = dlg.querySelector(".ag-xf-scroll")?.scrollTop || 0;
    const modes = a.triggers().map((t) => [`xf-mode:${t}`, this._modeLabel(t), t === "always" ? "flash" : MODE_ICON[t]]);
    const tabs = a.draft?.perMode && modes.length > 1 ? this.host._segHtml("xf-mode", modes, `xf-mode:${this.s.mode}`, "data-wf", "small ag-modeseg ag-xf-modes") : "";
    const nowPhase = a.xfPhases(this.s.from.trigger).find(([, zone]) => zone === baseOf(this.s.from.zone));
    const now = this._t("xfNow", { where: [this._modeLabel(this.s.from.trigger), nowPhase ? this._t(nowPhase[2]) : ""].filter(Boolean).join(" › ") });
    const target = this._target();
    const note = !a.xfPhases(this.s.mode).some(([, zone]) => a.zoneKinds(zone).includes(f)) ? `<p class="ag-t2 ag-small">${esc(this._t("xfNone"))}</p>` : "";
    const targetText = target
      ? `${esc(this._t("xfTarget"))} <b>${esc(target.where)}</b> · ${esc(target.place)}${target.full ? `<small class="ag-xf-warn">${esc(this._t("xfFull"))}</small>` : ""}`
      : esc(this._t("xfPick"));
    this.host._setHtml(dlg, `<div class="ag-dlg-body ag-xf">${iconTitle("fileMove", "ag-tint ag-tint-xfer on", this._t("xfTitle"))}
      <div class="ag-xf-what"><span class="ag-wf-icon k-${f}">${ic(a.xfIcon(step), 20)}</span><span><b>${esc(a.xfName(step))}</b><small>${esc(now)}</small></span></div>
      ${tabs}<div class="ag-xf-scroll"><div class="ag-xf-tree">${this._tree(f)}</div>${note}</div>
      <div class="ag-xf-foot"><div class="ag-xf-target">${targetText}<small>${esc(this._t("xfEffect"))}</small></div>
        <div class="ag-xf-btns"><button type="button" class="ag-btn" data-wf="xf-cancel">${esc(this._t("cancel"))}</button>
        <button type="button" class="ag-btn" data-wf="xf-copy" ${target?.copyOk ? "" : "disabled"}>${ic("copy", 18)}${esc(this._t("xfCopy"))}</button>
        <button type="button" class="ag-btn primary" data-wf="xf-move" ${target?.moveOk ? "" : "disabled"}>${ic("fileMove", 18)}${esc(this._t("xfMove"))}</button></div></div></div>`);
    const sc = dlg.querySelector(".ag-xf-scroll");
    if (sc) sc.scrollTop = scroll;
  }

  // true = erledigt
  onClick(el) {
    const act = el?.dataset.wf || "";
    if (!act.startsWith("xf-") || !this.s) return false;
    if (act.startsWith("xf-mode:")) {
      this.s = { ...this.s, mode: act.slice("xf-mode:".length), open: null, pick: null };
      this.render();
    } else if (act === "xf-phase") {
      const key = el.dataset.phase;
      this.s = { ...this.s, open: this.s.open === key ? null : key, pick: this.s.open === key ? this.s.pick : null };
      this.render();
    } else if (act === "xf-slot") {
      this.s = { ...this.s, pick: { zone: el.dataset.zone, at: Number(el.dataset.at), phase: el.dataset.phase } };
      this.render();
    } else if (act === "xf-cancel") this.close();
    else if (act === "xf-copy" || act === "xf-move") this._go(act === "xf-copy");
    return true;
  }

  async _go(copy) {
    const t = this._target();
    if (!t || !(copy ? t.copyOk : t.moveOk)) return;
    const { from, pick } = this.s;
    const name = this.a.xfName(this._step());
    const result = await this.a._relocate(from, t.to, copy, pick.phase);
    if (!result) return; // abgelehnt (zum Beispiel "Abbrechen" bei der Rückfrage zu einer Gruppe): das Fenster bleibt
    this.close();
    this.host._toast(this._t(copy ? "xfCopied" : "xfMoved", { name, where: t.where }), { label: this._t("xfUndo"), run: result.undo });
  }
}

function baseOf(zone) {
  return String(zone || "main").split(":")[0];
}
