// Mockups "Protokoll der HealthCheck-Dienste" (2026-11-19, Wunsch des Nutzers um 17:06). Kein Test: öffnet die echte Sensoransicht im HA-Nachbau
// (gleiche Fenster, Kacheln, Zeitraum, Kennzahlen, Grafik und Liste) und ersetzt ihren Inhalt durch das Protokoll eines Dienstes. Erfundene Daten,
// erfundene Adressen (nie die echte Ping-URL eines Nutzers). Aufruf im Wurzelverzeichnis: node docs/mockups/healthcheck-protokoll-v1/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8964";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();
const DOOR = "binary_sensor.haustuer";
const NOW = new Date("2026-11-19T17:05:00+01:00").getTime();
const MIN = 60e3, H = 3600e3, D = 24 * H;

// ---------- Erfundener Verlauf: "Healthchecks Haus", alle 5 Minuten ----------
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const at = (dayAgo, hh, mm) => { const d = new Date(NOW - dayAgo * D); d.setHours(hh, mm, 30, 0); return d.getTime(); };
// Besonderheiten der letzten 30 Tage: [Beginn, Ende, Art]; Art: gap (keine Daten: Home Assistant aus), fail (gescheitert), report (Fehler gemeldet),
// test (Testknopf)
const SPECIAL = [
  [at(0, 3, 12), at(0, 3, 24), "gap"], [at(0, 7, 40), at(0, 7, 41), "fail"], [at(0, 12, 28), at(0, 12, 53), "report"],
  [at(0, 16, 20) - 20e3, at(0, 16, 20) + 20e3, "test"], [at(2, 22, 5), at(2, 22, 21), "fail"], [at(4, 9, 0), at(4, 9, 50), "report"],
  [at(5, 2, 40), at(5, 3, 30), "gap"], [at(11, 14, 10), at(11, 14, 11), "fail"], [at(18, 6, 0), at(18, 6, 40), "gap"], [at(23, 19, 30), at(23, 19, 31), "test"],
];
const kindAt = (t) => SPECIAL.find(([a, b]) => t >= a && t < b)?.[2] || "ok";
const PINGS = [];
for (let t = NOW - 30 * D + 30e3; t <= NOW; t += 5 * MIN) {
  const k = kindAt(t);
  if (k === "gap") continue;
  let ms = 85 + Math.round(rnd() * 95) + (rnd() < 0.012 ? 220 + Math.round(rnd() * 420) : 0);
  if (k === "fail") ms = 10000;
  PINGS.push({ t, k, ms });
}
// Extra-Aufrufe ausserhalb des Takts: Wechsel des Selbsttests und Tests
PINGS.push({ t: at(0, 12, 28) + 20e3, k: "report", ms: 131 }, { t: at(0, 12, 53) + 15e3, k: "ok", ms: 118 }, { t: at(0, 16, 20) + 14e3, k: "test", ms: 140 },
  { t: at(0, 16, 21) + 2e3, k: "test", ms: 96 });
PINGS.sort((a, b) => a.t - b.t);

// Ereignisse der Liste (Standard: nur Ereignisse, nicht jedes Lebenszeichen)
const EVENTS = [
  [at(0, 16, 21) + 2e3, "test", "Test: Lebenszeichen gesendet", "HTTP 200", "96 ms", "Test"],
  [at(0, 16, 20) + 14e3, "test", "Test: Fehler gesendet", "HTTP 200", "140 ms", "Test"],
  [at(0, 12, 53) + 15e3, "back", "Wieder in Ordnung (Selbsttest ohne Probleme)", "HTTP 200", "118 ms", "Selbsttest"],
  [at(0, 12, 28) + 20e3, "report", "Fehler gemeldet: Selbsttest, 1 Problem", "HTTP 200", "131 ms", "Selbsttest"],
  [at(0, 7, 45), "back", "Wieder in Ordnung", "HTTP 200", "142 ms", "Takt"],
  [at(0, 7, 40), "fail", "Gescheitert", "keine Antwort (10 s)", "–", "Takt"],
  [at(0, 3, 24) + 31e3, "start", "Erstes Lebenszeichen nach dem Start", "HTTP 200", "164 ms", "Start"],
  [at(2, 22, 21), "back", "Wieder in Ordnung", "HTTP 200", "121 ms", "Takt"],
  [at(2, 22, 5), "fail", "Gescheitert (4 Aufrufe)", "keine Verbindung", "–", "Takt"],
];

const inRange = (hours) => PINGS.filter((p) => p.t > NOW - hours * H);
const fmtTime = (t, sec = false) => new Date(t).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", ...(sec ? { second: "2-digit" } : {}) });
const dayLabel = (t) => {
  const d = new Date(t), n = new Date(NOW);
  if (d.toDateString() === n.toDateString()) return "Heute";
  if (d.toDateString() === new Date(NOW - D).toDateString()) return "Gestern";
  return d.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
};
const txt = (x, y, s, anchor = "middle", cls = "") => `<text x="${x.toFixed(1)}" y="${y}" text-anchor="${anchor}" class="sv-tx ${cls}">${s}</text>`;
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const RANK = { ok: 0, test: 1, report: 2, fail: 3 };

// Variante A: Herzschlag. Je Aufruf (oder je Zeitabschnitt) ein Balken; die Höhe ist die Antwortzeit, die Farbe das Ergebnis; Lücken ohne Daten grau
function heartbeat(hours, W) {
  // Unter den Balken ein Band mit dem Ergebnis je Abschnitt (wie die Leiste "Healthy" der Anbieter): Ereignisse fallen auf einen Blick auf
  // Auf dem Handy niedriger: oben steht alles fest, darunter soll Platz für die Liste bleiben
  const H_ = W > 500 ? 184 : 150, L = 50, R = W - 6, top = 12, laneH = 9, bottom = H_ - 24 - laneH - 6;
  const lane = bottom + 6;
  const start = NOW - hours * H;
  const n = W > 500 ? (hours <= 24 ? hours * 12 : hours <= 168 ? 168 : 180) : (hours <= 24 ? hours * 4 : hours <= 168 ? 84 : 90);
  const step = (hours * H) / n;
  const bw = (R - L) / n;
  const max = 600;
  const y = (ms) => bottom - (Math.min(max, ms) / max) * (bottom - top);
  let s = "";
  for (const g of [0, 300, 600]) s += `<line class="sv-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${txt(L - 6, y(g) + 4, g ? `${g} ms` : "0", "end")}`;
  const pings = inRange(hours);
  for (let i = 0; i < n; i++) {
    const a = start + i * step, b = a + step;
    const inB = pings.filter((p) => p.t >= a && p.t < b);
    const x = L + i * bw + (bw > 3 ? 0.6 : 0.25);
    const w = Math.max(0.8, bw - (bw > 3 ? 1.2 : 0.5));
    if (!inB.length) {
      if (SPECIAL.some(([sa, sb, k]) => k === "gap" && sa < b && sb > a)) {
        s += `<rect class="mk-gap" x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(2)}" height="${bottom - top}" rx="1"/>`;
        s += `<rect class="mk-lane gap" x="${(L + i * bw).toFixed(2)}" y="${lane}" width="${(bw + 0.3).toFixed(2)}" height="${laneH}"/>`;
      }
      continue;
    }
    const worst = inB.reduce((m, p) => (RANK[p.k] > RANK[m] ? p.k : m), "ok");
    const ms = worst === "fail" ? max : Math.round(inB.reduce((m, p) => m + p.ms, 0) / inB.length);
    const yy = Math.min(y(ms), bottom - 6);
    s += `<rect class="mk-b ${worst}" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${w.toFixed(2)}" height="${(bottom - yy).toFixed(1)}" rx="${bw > 3 ? 1.2 : 0.4}"/>`;
    s += `<rect class="mk-lane ${worst}" x="${(L + i * bw).toFixed(2)}" y="${lane}" width="${(bw + 0.3).toFixed(2)}" height="${laneH}"/>`;
  }
  // Ereignisse über dem Band etwas breiter, damit ein einzelner Aufruf zu sehen ist
  for (const p of pings.filter((q) => q.k !== "ok")) {
    const cx = L + ((p.t - start) / (NOW - start)) * (R - L);
    s += `<rect class="mk-lane ${p.k} mark" x="${(cx - 2).toFixed(1)}" y="${lane - 2}" width="4" height="${laneH + 4}" rx="2"/>`;
  }
  const lab = (t) => (hours <= 24 ? fmtTime(t) : new Date(t).toLocaleDateString("de-CH", { day: "numeric", month: "short" }));
  for (const [t, anc] of [[start, "start"], [start + (NOW - start) / 2, "middle"], [NOW, "end"]]) s += txt(t === NOW ? R : t === start ? L : (L + R) / 2, H_ - 6, lab(t), anc);
  return svg(W, H_, s, "Lebenszeichen");
}

// Variante B: Zeitleiste je Tag (wie Türen und Fenster): grün, solange Lebenszeichen ankommen; rot gescheitert, orange Fehler gemeldet, blau Test
function band(days, W) {
  const narrow = W < 500, L = narrow ? 52 : 70, R = W - 6, rowH = 16, gap = 9, top = 6;
  const H_ = top + days * (rowH + gap) + 18;
  let s = "";
  for (let r = 0; r < days; r++) {
    const d0 = new Date(NOW - (days - 1 - r) * D); d0.setHours(0, 0, 0, 0);
    const a = d0.getTime(), b = a + D, y = top + r * (rowH + gap);
    const x = (t) => L + ((t - a) / D) * (R - L);
    s += txt(L - 8, y + 12, d0.toLocaleDateString("de-CH", { weekday: "short", day: "numeric" }), "end", r === days - 1 ? "now" : "");
    s += `<rect class="sv-track" x="${L}" y="${y}" width="${R - L}" height="${rowH}" rx="4"/>`;
    const end = Math.min(b, NOW);
    if (end > a) {
      // grün bis jetzt, unterbrochen von Lücken
      let cur = a;
      for (const [sa, sb, k] of SPECIAL.filter(([sa, sb, k]) => k === "gap" && sb > a && sa < end).sort((p, q) => p[0] - q[0])) {
        if (sa > cur) s += `<rect class="mk-ok" x="${x(cur).toFixed(1)}" y="${y}" width="${(x(sa) - x(cur)).toFixed(1)}" height="${rowH}" rx="3"/>`;
        cur = Math.max(cur, sb);
      }
      if (end > cur) s += `<rect class="mk-ok" x="${x(cur).toFixed(1)}" y="${y}" width="${(x(end) - x(cur)).toFixed(1)}" height="${rowH}" rx="3"/>`;
      for (const [sa, sb, k] of SPECIAL.filter(([sa, sb, k]) => k !== "gap" && sb > a && sa < end)) {
        const w = Math.max(3, x(Math.min(sb, end)) - x(Math.max(sa, a)));
        s += `<rect class="mk-b ${k}" x="${x(Math.max(sa, a)).toFixed(1)}" y="${y - 2}" width="${w.toFixed(1)}" height="${rowH + 4}" rx="1.5"/>`;
      }
    }
  }
  const x0 = (h) => L + (h / 24) * (R - L);
  for (const hh of narrow ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]) s += txt(x0(hh), H_ - 4, `${String(hh).padStart(2, "0")}:00`, hh === 0 ? "start" : hh === 24 ? "end" : "middle");
  return svg(W, H_, s, "Lebenszeichen je Tag");
}

// Kachel "Antwortzeit": Linie mit Fläche wie "Empfang", Zonen schnell, langsam, sehr langsam; senkrechte Marken bei gescheiterten Aufrufen
function latency(hours, W) {
  const H_ = 150, L = 50, R = W - 6, top = 10, bottom = H_ - 22;
  const start = NOW - hours * H;
  const n = W > 500 ? 96 : 48;
  const step = (hours * H) / n;
  const max = 1200;
  const x = (t) => L + ((t - start) / (NOW - start)) * (R - L);
  const y = (ms) => bottom - (Math.min(max, ms) / max) * (bottom - top);
  let s = "";
  for (const [from, to, cls, label] of [[0, 300, "ok", "schnell"], [300, 1000, "warn", "langsam"], [1000, max, "err", "sehr langsam"]]) {
    s += `<rect class="sv-zone ${cls}" x="${L}" y="${y(to).toFixed(1)}" width="${R - L}" height="${(y(from) - y(to)).toFixed(1)}"/>${txt(R - 6, y(to) + 13, label, "end", cls)}`;
  }
  for (const g of [0, 600, 1200]) s += `<line class="sv-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${txt(L - 6, y(g) + 4, g ? `${g >= 1000 ? `${g / 1000} s` : `${g} ms`}` : "0", "end")}`;
  const pings = inRange(hours);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start + i * step, inB = pings.filter((p) => p.t >= a && p.t < a + step && p.k !== "fail");
    if (inB.length) pts.push([a + step / 2, Math.round(inB.reduce((m, p) => m + p.ms, 0) / inB.length)]);
  }
  const path = pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  s += `<path class="sv-area" d="${path} L${x(pts.at(-1)[0]).toFixed(1)},${bottom} L${x(pts[0][0]).toFixed(1)},${bottom} Z"/><path class="sv-line" d="${path}"/>`;
  for (const p of pings.filter((q) => q.k === "fail")) s += `<line class="mk-failmark" x1="${x(p.t).toFixed(1)}" y1="${top}" x2="${x(p.t).toFixed(1)}" y2="${bottom}"/>`;
  s += `<circle class="sv-dot" cx="${x(pts.at(-1)[0]).toFixed(1)}" cy="${y(pts.at(-1)[1]).toFixed(1)}" r="4.5"/>`;
  for (const [t, anc] of [[start, "start"], [start + (NOW - start) / 2, "middle"], [NOW, "end"]]) s += txt(x(t), H_ - 6, fmtTime(t), anc);
  return svg(W, H_, s, "Antwortzeit");
}

const CSS = `
.mk-b.ok, .mk-ok { fill: var(--ag-success); } .mk-b.fail { fill: var(--ag-error); } .mk-b.report { fill: var(--ag-warning); } .mk-b.test { fill: var(--ag-primary); }
.mk-gap { fill: var(--ag-text3); opacity: .28; }
.mk-lane.ok { fill: var(--ag-success); opacity: .45; } .mk-lane.fail { fill: var(--ag-error); } .mk-lane.report { fill: var(--ag-warning); } .mk-lane.test { fill: var(--ag-primary); }
.mk-lane.gap { fill: var(--ag-text3); opacity: .35; } .mk-lane-frame { fill: none; stroke: var(--ag-card); stroke-width: 2; }
.mk-failmark { stroke: var(--ag-error); stroke-width: 2; stroke-dasharray: 3 3; }
.mk-i-ok { background: var(--ag-success); } .mk-i-fail { background: var(--ag-error); } .mk-i-report { background: var(--ag-warning); } .mk-i-test { background: var(--ag-primary); }
.mk-i-gap { background: var(--ag-text3); opacity: .45; }
.ag-sv-dot.ok, .ag-sv-dot.back { background: var(--ag-success); } .ag-sv-dot.fail { background: var(--ag-error); } .ag-sv-dot.report { background: var(--ag-warning); }
.ag-sv-dot.test { background: var(--ag-primary); } .ag-sv-dot.start { background: var(--ag-text3); }
.mk-pick { display: flex; align-items: center; gap: 6px; padding: 2px 8px 2px 0; margin: 0; border: 0; background: none; color: var(--ag-text); font: inherit; cursor: pointer; min-width: 0; max-width: 100%; }
.ag-sv-ttl > small { display: block; }
.mk-pick b { font-size: 18px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-pick svg { flex: none; color: var(--ag-text2); }
.mk-pick.open svg { transform: rotate(180deg); }
.ag-sv-head { position: relative; }
.ag-sv-head .ag-oav { width: 44px; height: 44px; border-radius: 13px; }
.mk-menu { position: absolute; z-index: 30; top: 52px; left: 56px; width: min(380px, calc(100% - 56px)); padding: 6px; border-radius: 16px; background: var(--ag-card); border: 1px solid var(--ag-divider); box-shadow: var(--ag-shadow); }
:host([narrow]) .mk-menu { left: 0; width: 100%; }
.mk-mi { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 11px; }
.mk-mi.on { background: var(--ag-primary-soft); }
.mk-mi .ag-sv-dot { width: 10px; height: 10px; }
.mk-mi div { flex: 1; min-width: 0; } .mk-mi b { display: block; font-weight: 500; } .mk-mi small { display: block; font-size: 12.5px; color: var(--ag-text2); }
.mk-mi svg { color: var(--ag-primary); flex: none; }
.mk-pill-err { background: var(--ag-error-soft) !important; color: var(--ag-error) !important; }
.mk-bar { display: flex; align-items: center; gap: 12px; padding: 14px 24px 10px; flex-wrap: wrap; }
.mk-bar .ag-seg { flex: none; }
.mk-bar .list-search { flex: 1 1 220px; max-width: 360px; margin: 0; }
:host([narrow]) .mk-bar { padding: 12px 16px 8px; }
:host([narrow]) .mk-bar .ag-seg { flex: 1 1 100%; }
:host([narrow]) .mk-bar .ag-seg > button { flex: 1; }
:host([narrow]) .mk-bar .list-search { max-width: none; }
.mk-n { margin-left: 6px; font-size: 12px; color: var(--ag-text2); font-weight: 500; }
.mk-sort { display: inline-flex; align-items: center; gap: 2px; } .mk-sort.on { color: var(--ag-text); } .mk-sort svg { width: 14px; height: 14px; }
.mk-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.mk-hint { padding: 0 24px 10px; font-size: 12px; color: var(--ag-text3); } :host([narrow]) .mk-hint { padding: 0 16px 10px; }
.mk-new { outline: 2px dashed var(--ag-primary); outline-offset: 3px; }
`;

const TILE = { history: "Verlauf", timer: "Antwortzeit", heartPulse: "Dienst" };

async function view(mobile, opts) {
  const { name, chart, range = 24, tab = "history", list = "events", menu = false, dienst = false, kpis, scroll = false } = opts;
  const s = await open(browser, { mobile, lang: "de", theme: mobile ? "dark" : "light", fixedTime: NOW });
  await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${DOOR}"]')`);
  await s.tap(`[data-act="more"][data-entity="${DOOR}"]`);
  await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector(".ag-sv-chart svg")`);
  await s.page.waitForTimeout(300);
  const W = mobile ? 358 : 832;
  const chartSvg = chart === "a" ? heartbeat(range, W) : chart === "b" ? band(range / 24, W) : latency(range, W);
  const rows = list === "events" ? EVENTS : [...EVENTS.filter((e) => e[1] !== "start").slice(0, 3),
    ...inRange(3).filter((p) => p.k === "ok").slice(-9).reverse().map((p) => [p.t, "ok", "Lebenszeichen gesendet", "HTTP 200", `${p.ms} ms`, "Takt"])].sort((a, b) => b[0] - a[0]);
  const rowData = rows.map(([t, k, what, res, ms, by]) => [dayLabel(t), fmtTime(t, true), k, what, res, ms, by]);
  await s.ev(`const [css, o, chartSvg, rowData, TILE] = arg; const h=r.host; const d=r.getElementById('ag-sensor');
    const url=location.origin + '/alarmageddon_panel/common.js?v=sim';
    return import(url).then(({ ic, esc }) => {
      if (!r.querySelector('style.mk')) { const st=document.createElement('style'); st.className='mk'; st.textContent=css; r.appendChild(st); }
      const narrow=h.hasAttribute('narrow');
      const head='<div class="ag-sv-head"><span class="ag-oav ag-tint ag-tint-health on">' + ic('heartPulse', 24) + '</span>'
        + '<div class="ag-sv-ttl"><button class="mk-pick ' + (o.menu ? 'open' : '') + '"><b>Healthchecks Haus</b>' + ic('arrowDown', 20) + '</button><small>' + (narrow ? 'hc-ping.com · alle 5 Min.' : 'hc-ping.com · Healthchecks.io · alle 5 Min.') + '</small></div>'
        + '<span class="ag-sv-pill">in Ordnung</span>'
        + '<button type="button" class="ag-btn ag-sv-ha">' + ic('pencil', 18) + 'Bearbeiten</button>'
        + (o.menu ? '<div class="mk-menu">'
          + [['ok', 'Healthchecks Haus', 'hc-ping.com · in Ordnung seit 12:53', true], ['fail', 'Better Stack Büro', 'uptime.betterstack.com · gescheitert seit 16:58', false], ['ok', 'Cronitor', 'cronitor.link · in Ordnung seit 07:46', false]]
            .map(([k, n, sub, on]) => '<div class="mk-mi ' + (on ? 'on' : '') + '"><span class="ag-sv-dot ' + k + '"></span><div><b>' + esc(n) + '</b><small>' + esc(sub) + '</small></div>' + (on ? ic('check', 20) : '') + '</div>').join('')
          + '</div>' : '') + '</div>';
      const tiles='<div class="ag-seg ag-sv-tiles n3" data-seg="sv-tabs" role="tablist">' + [['history', 'in Ordnung seit 12:53'], ['timer', '118 ms'], ['heartPulse', 'Healthchecks.io']]
        .map(([k, v]) => '<button type="button" class="ag-sv-tile ' + (o.tab === k ? 'on' : '') + '" data-tab="' + (k === 'history' ? 'state' : k === 'timer' ? 'signal' : 'device') + '"><span class="ag-sv-ti">' + ic(k, 22) + '</span><span class="ag-sv-tx"><small>' + TILE[k] + '</small><b>' + esc(v) + '</b></span></button>').join('') + '</div>';
      const range='<div class="ag-sv-seg ag-sv-range" role="group">' + [[3, '3 Std.'], [12, '12 Std.'], [24, '1 Tag'], [168, '7 Tage'], [720, '30 Tage']]
        .map(([v, l]) => '<button type="button" class="' + (v === o.range ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
      const kp=(narrow ? o.kpis.slice(0, 3) : o.kpis).map(([b, l]) => '<div class="ag-sv-kpi"><b>' + esc(b) + '</b><span>' + esc(l) + '</span></div>').join('');
      const legendItems = o.tab === 'timer' ? [['mk-i-fail', 'gescheitert']] : [['mk-i-ok', narrow ? 'OK' : 'Lebenszeichen'], ['mk-i-report', 'Fehler gemeldet'], ['mk-i-fail', 'gescheitert'], ['mk-i-test', 'Test'], ['mk-i-gap', narrow ? 'Lücke' : 'keine Daten']];
      const legend='<div class="ag-sv-legend">' + legendItems.map(([c, l]) => '<span><i class="' + c + '"></i>' + esc(l) + '</span>').join('') + '</div>';
      let fix, listHtml;
      if (o.dienst) {
        const row=(l, v, mono) => '<div class="ag-sv-drow"><span class="ag-t2">' + esc(l) + '</span><b class="' + (mono ? 'mk-mono' : '') + '">' + esc(v) + '</b></div>';
        fix=head + tiles;
        listHtml='<div class="ag-sv-device">' + row('Name', 'Healthchecks Haus') + row('Erkannt', 'Healthchecks.io') + row('Ping-URL', 'https://hc-ping.com/5b2f3c1e-8d4a-4f6b-9c7e-2a1d0e9f8b3c', true)
          + row('Fehler-Zusatz', '/fail', true) + row('Intervall', '5 Minuten') + row('Letzter Aufruf', 'heute 17:00:30 · HTTP 200 · 118 ms') + row('Seit wann aufgezeichnet', '20. Oktober 2026') + '</div>';
      } else {
        fix=head + tiles + range + '<div class="ag-sv-kpis">' + kp + '</div><div class="ag-sv-chart">' + chartSvg + '</div>' + legend;
        const seg=h._segHtml('mk', [['events', 'Ereignisse', 'alert'], ['all', 'Alle Aufrufe', 'history']], o.list, 'data-mk', 'small')
          .replace('<span>Ereignisse</span>', '<span>Ereignisse<span class="mk-n">9</span></span>').replace('<span>Alle Aufrufe</span>', '<span>Alle Aufrufe<span class="mk-n">288</span></span>');
        const search='<label class="list-search">' + ic('search', 18) + '<input type="search" placeholder="Ereignisse durchsuchen"></label>';
        const sort=(label, on, cls='') => '<th class="' + cls + '"><span class="mk-sort ' + (on ? 'on' : '') + '">' + esc(label) + (on ? ic('arrowDown', 14) : '') + '</span></th>';
        let day='', body='';
        for (const [dd, t, k, what, res, ms, by] of rowData) {
          if (dd !== day) { day=dd; body += '<tr class="day"><td colspan="' + (narrow ? 3 : 5) + '">' + esc(dd) + '</td></tr>'; }
          const dot='<span class="ag-sv-dot ' + k + '"></span>';
          body += narrow
            ? '<tr><td>' + t.slice(0, 5) + '</td><td><span class="ag-sv-ev">' + dot + '<span>' + esc(what) + '<small>' + esc(res + (ms !== '–' ? ' · ' + ms : '')) + '</small></span></span></td><td class="r"><span class="ag-sv-tag">' + esc(by) + '</span></td></tr>'
            : '<tr><td>' + t + '</td><td><span class="ag-sv-ev">' + dot + esc(what) + '</span></td><td>' + esc(res) + '</td><td>' + esc(ms) + '</td><td><span class="ag-sv-tag">' + esc(by) + '</span></td></tr>';
        }
        const thead = narrow ? '<tr>' + sort('Zeit', true) + sort('Ereignis') + sort('Auslöser', false, 'r') + '</tr>'
          : '<tr>' + sort('Zeit', true, 'c1') + sort('Ereignis') + sort('Ergebnis', false, 'c3') + sort('Antwortzeit', false, 'c3') + sort('Auslöser', false, 'c4') + '</tr>';
        const hint = o.list === 'all' ? '<div class="mk-hint">Alle Aufrufe der letzten 24 Stunden einzeln; ältere zusammengefasst in der Grafik.</div>' : '';
        listHtml='<div class="mk-bar">' + seg + search + '</div>' + hint + '<table class="ag-sv-table"><thead>' + thead + '</thead><tbody>' + body + '</tbody></table>';
      }
      d.querySelector('.ag-sv').innerHTML='<div class="ag-sv-fix">' + fix + '</div><div class="ag-sv-list">' + listHtml + '</div>';
      h._placePills?.();
      return 1;
    });`, [CSS, { menu, tab, range, list, dienst, kpis }, chartSvg, rowData, TILE]);
  // Wie in der Sensoransicht rollt nur die Liste, ihre Leiste (Reiter, Suche) rollt mit weg: einmal gerollt, damit Zeilen zu sehen sind
  if (scroll) await s.ev("const l=r.querySelector('#ag-sensor .ag-sv-list'); l.scrollTop = r.querySelector('#ag-sensor .mk-bar').offsetHeight + 40; return 1");
  await s.page.waitForTimeout(500);
  await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}

// Liste der Dienste mit dem neuen runden Knopf "Protokoll" links neben "Fehler senden" (wo der Nutzer ihn eingekreist hat)
async function list(mobile) {
  const s = await open(browser, { mobile, lang: "de", theme: mobile ? "dark" : "light", tab: "config", query: "&hc=sample", fixedTime: NOW });
  await s.tap('[data-sub="system"]');
  await s.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
  await s.ev("r.querySelector('.ag-hcsum [data-hc=\"open\"]').click(); return 1");
  await s.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length > 1");
  await s.ev(`const url=location.origin + '/alarmageddon_panel/common.js?v=sim';
    return import(url).then(({ ic }) => {
      if (!r.querySelector('style.mk')) { const st=document.createElement('style'); st.className='mk'; st.textContent=arg; r.appendChild(st); }
      for (const box of r.querySelectorAll('#ag-hclist .ag-wf-btns')) box.insertAdjacentHTML('afterbegin', '<button class="ag-iconbtn mk-new" title="Protokoll" aria-label="Protokoll">' + ic('history', 18) + '</button>');
      return 1;
    });`, CSS);
  await s.page.waitForTimeout(400);
  await s.page.screenshot({ path: `${out}liste-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}

const KPI_DAY = [["99,7 %", "erfolgreich"], ["284", "Lebenszeichen"], ["1", "gescheitert"], ["6", "Fehler gemeldet"], ["128 ms", "Antwortzeit im Mittel"]];
const KPI_WEEK = [["99,8 %", "erfolgreich"], ["1 994", "Lebenszeichen"], ["4", "gescheitert"], ["16", "Fehler gemeldet"], ["131 ms", "Antwortzeit im Mittel"]];
const KPI_LAT = [["118 ms", "aktuell"], ["128 ms", "im Mittel"], ["912 ms", "langsamster Aufruf"], ["1", "ohne Antwort"]];
for (const mobile of [false, true]) {
  await list(mobile);
  await view(mobile, { name: "a-verlauf-1tag", chart: "a", range: 24, kpis: KPI_DAY });
  await view(mobile, { name: "a-verlauf-7tage", chart: "a", range: 168, kpis: KPI_WEEK });
  await view(mobile, { name: "b-zeitleiste-7tage", chart: "b", range: 168, kpis: KPI_WEEK });
  await view(mobile, { name: "antwortzeit-1tag", chart: "c", range: 24, tab: "timer", kpis: KPI_LAT });
  await view(mobile, { name: "dienst", chart: "a", tab: "heartPulse", dienst: true, kpis: KPI_DAY });
  await view(mobile, { name: "auswahl", chart: "a", range: 24, menu: true, kpis: KPI_DAY });
  await view(mobile, { name: "alle-aufrufe", chart: "a", range: 24, list: "all", kpis: KPI_DAY, scroll: true });
}
await browser.close();
server.close?.();
process.exit(0);
