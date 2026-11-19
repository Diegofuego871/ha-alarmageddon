// Mockups "Protokoll der HealthCheck-Dienste", dritte Fassung (2026-11-19, 18:24, Wunsch des Nutzers: "auch 90 Tage und ein Jahr anzubieten. Bei
// Ausfällen möchte man vielleicht schon eine Langzeitstatistik haben"). Kein Test: öffnet das echte Protokoll (1.68.0, noch nicht geliefert) im
// HA-Nachbau und ersetzt Zeitraum, Kennzahlen und Grafik durch die Vorschläge für 90 Tage und 1 Jahr. Erfundene Daten, erfundene Adressen.
// Aufruf im Wurzelverzeichnis: node docs/mockups/healthcheck-protokoll-v3/src/shots.mjs
process.env.PANEL_PORT = process.env.PANEL_PORT || "8967";
const { launch, open } = await import("../../../../tests/panel/lib.mjs");
const { startServer } = await import("../../../../tests/panel/server.mjs");
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(Number(process.env.PANEL_PORT));
const browser = await launch();
const NOW = new Date("2026-11-19T18:20:00+01:00").getTime();
const D = 24 * 3600e3;

// ---------- Erfundenes Jahr: "Healthchecks Haus", alle 5 Minuten (288 Aufrufe je Tag) ----------
// Je Tag: [Datum, ok, Fehler gemeldet, gescheitert, Test, Minuten ohne Daten, mittlere Antwortzeit]
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const SPECIAL = { 0: { fail: 2, report: 5, test: 2, gap: 40 }, 2: { fail: 4 }, 4: { report: 10 }, 5: { gap: 50 }, 11: { fail: 1 }, 18: { gap: 40 }, 23: { test: 1 },
  37: { fail: 9 }, 52: { report: 4 }, 61: { gap: 1440 }, 62: { gap: 610 }, 77: { fail: 2 }, 95: { test: 2 }, 118: { fail: 30, report: 3 }, 140: { gap: 95 },
  166: { report: 12 }, 190: { fail: 1 }, 214: { gap: 1440 }, 215: { gap: 1440 }, 216: { gap: 300 }, 240: { fail: 3 }, 262: { test: 1 }, 288: { report: 6 },
  301: { fail: 5 }, 330: { gap: 45 }, 351: { fail: 2 } };
const START = 340; // das Protokoll beginnt vor 340 Tagen (davor nichts)
const DAYS = [];
for (let i = 364; i >= 0; i--) {
  const day = new Date(NOW); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - i);
  if (i > START) { DAYS.push({ day, none: true }); continue; }
  const s = SPECIAL[i] || {};
  const share = i === 0 ? (new Date(NOW).getHours() * 60 + new Date(NOW).getMinutes()) / 1440 : 1;
  const calls = Math.round(288 * share * (1 - (s.gap || 0) / 1440));
  DAYS.push({ day, ok: calls - (s.fail || 0) - (s.report || 0), report: s.report || 0, fail: s.fail || 0, test: s.test || 0, gap: s.gap || 0, ms: 118 + Math.round(rnd() * 30) + (rnd() < 0.05 ? 80 : 0) });
}
const RANK = (d) => (d.none ? "none" : d.fail ? "fail" : d.report ? "report" : d.gap >= 30 ? "gap" : "ok");
const txt = (x, y, s, anchor = "middle", cls = "") => `<text x="${x.toFixed(1)}" y="${y}" text-anchor="${anchor}" class="sv-tx ${cls}">${s}</text>`;
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const month = (d) => d.toLocaleDateString("de", { month: "short" }).replace(".", "");
const fill = { ok: "hl-band ok", fail: "hl-b fail", report: "hl-b report", gap: "hl-band gap", none: "sv-track" };

// Variante A "Statusleiste" (wie die Leiste der Anbieter): je Tag ein Balken in der Farbe des schlechtesten Ergebnisses, Tests als blauer Punkt darunter.
// 1 Jahr auf dem Handy je Woche ein Balken (Tage wären unter einem Pixel breit).
function bars(days, W, perWeek = false) {
  const L = 6, R = W - 6, top = 8, h = 46;
  let list = days.map((d) => ({ ...d, k: RANK(d) }));
  if (perWeek) {
    const weeks = [];
    for (let i = 0; i < list.length; i += 7) {
      const w = list.slice(i, i + 7);
      const order = ["fail", "report", "gap", "ok", "none"];
      weeks.push({ day: w[0].day, k: order.find((o) => w.some((x) => x.k === o)), test: w.some((x) => x.test) });
    }
    list = weeks;
  }
  const n = list.length, bw = (R - L) / n, gap = bw > 4 ? 2 : bw > 2.4 ? 0.8 : 0.3;
  let s = "";
  list.forEach((d, i) => {
    const x = L + i * bw;
    s += `<rect class="${fill[d.k]}" x="${(x + gap / 2).toFixed(2)}" y="${top}" width="${Math.max(0.6, bw - gap).toFixed(2)}" height="${h}" rx="${bw > 4 ? 2 : 0.6}"/>`;
    if (d.test) s += `<circle class="hl-dot test" cx="${(x + bw / 2).toFixed(1)}" cy="${top + h + 7}" r="${Math.min(2.6, Math.max(1.4, bw / 3)).toFixed(1)}"/>`;
  });
  // Monate unten, nie übereinander (auf dem Handy nur jeder zweite Monat über ein Jahr)
  let lastX = -99;
  let count = 0;
  const minGap = W < 500 ? 34 : 40;
  list.forEach((d, i) => {
    const x = L + i * bw;
    if (d.day.getDate() <= (perWeek ? 7 : 1) && x - lastX >= minGap && R - x >= minGap + 10) {
      if (!(W < 500 && list.length > 60 && count++ % 2)) s += txt(x, top + h + 26, month(d.day), "start");
      lastX = x;
    }
  });
  s += txt(L, top + h + 26, "", "start") + txt(R, top + h + 26, "heute", "end", "now");
  return svg(W, top + h + 34, s, "Lebenszeichen je Tag");
}

// Variante B "Raster Monat × Tag" (wie das Raster über 30 Tage eine Stufe gröber): eine Zeile je Monat, eine Zelle je Tag (1 bis 31)
function raster(days, W) {
  const L = 56, R = W - 4, top = 4, cw = (R - L) / 31, ch = W > 500 ? 15 : 9.5, gap = W > 500 ? 3 : 2;
  const months = [];
  for (const d of days) {
    const key = `${d.day.getFullYear()}-${d.day.getMonth()}`;
    if (!months.length || months.at(-1).key !== key) months.push({ key, first: d.day, days: new Map() });
    months.at(-1).days.set(d.day.getDate(), d);
  }
  let s = "";
  months.forEach((m, r) => {
    const y = top + r * (ch + gap);
    const len = new Date(m.first.getFullYear(), m.first.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= 31; day++) {
      if (day > len) continue;
      const d = m.days.get(day);
      const k = d ? RANK(d) : "none";
      const cls = k === "ok" ? "hl-cell ok" : k === "gap" ? "hl-cell gap" : k === "none" ? "sv-track" : `hl-b ${k}`;
      s += `<rect class="${cls}" x="${(L + (day - 1) * cw + 0.8).toFixed(1)}" y="${y.toFixed(1)}" width="${(cw - 1.6).toFixed(1)}" height="${ch}" rx="2"/>`;
      if (d?.test && W > 500) s += `<circle class="hl-dot test" cx="${(L + (day - 0.5) * cw).toFixed(1)}" cy="${(y + ch / 2).toFixed(1)}" r="2.2"/>`;
    }
    s += txt(L - 8, y + ch / 2 + 4, `${month(m.first)}${m.first.getMonth() === 0 || r === 0 ? ` ’${String(m.first.getFullYear()).slice(2)}` : ""}`, "end", r === months.length - 1 ? "now" : "");
  });
  const base = top + months.length * (ch + gap);
  for (const day of W < 500 ? [1, 8, 15, 22, 29] : [1, 5, 10, 15, 20, 25, 31]) s += txt(L + (day - 0.5) * cw, base + 12, `${day}.`);
  return svg(W, base + 18, s, "Lebenszeichen je Tag");
}

// Antwortzeit über 90 Tage oder 1 Jahr: Mittel je Tag (Handy: je zwei oder sieben Tage), Zonen wie bis 30 Tage, Marke an Tagen mit Fehlern
function latency(days, W) {
  const H_ = 150, L = 50, R = W - 6, top = 10, bottom = H_ - 22, max = 1200;
  const live = days.filter((d) => !d.none);
  const step = W < 500 ? (days.length > 100 ? 7 : 2) : days.length > 100 ? 2 : 1;
  const pts = [];
  for (let i = 0; i < live.length; i += step) {
    const g = live.slice(i, i + step);
    pts.push([i + step / 2, g.reduce((a, b) => a + b.ms, 0) / g.length]);
  }
  const x = (i) => L + (i / live.length) * (R - L) + ((days.length - live.length) / days.length) * (R - L) * 0;
  const off = ((days.length - live.length) / days.length) * (R - L);
  const X = (i) => L + off + (i / live.length) * (R - L - off);
  const y = (ms) => bottom - (Math.min(max, ms) / max) * (bottom - top);
  let s = "";
  for (const [from, to, cls, label] of [[0, 300, "ok", "schnell"], [300, 1000, "warn", "langsam"], [1000, max, "err", "sehr langsam"]]) s += `<rect class="sv-zone ${cls}" x="${L}" y="${y(to).toFixed(1)}" width="${R - L}" height="${(y(from) - y(to)).toFixed(1)}"/>${txt(L + 6, y(to) + 13, label, "start", cls)}`;
  for (const g of [0, 600, 1200]) s += `<line class="sv-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${txt(L - 6, y(g) + 4, g ? (g >= 1000 ? "1,2 s" : `${g} ms`) : "0", "end")}`;
  const path = pts.map(([i, v], k) => `${k ? "L" : "M"}${X(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  s += `<path class="sv-area" d="${path} L${X(pts.at(-1)[0]).toFixed(1)},${bottom} L${X(pts[0][0]).toFixed(1)},${bottom} Z"/><path class="sv-line" d="${path}"/>`;
  live.forEach((d, i) => { if (d.fail) s += `<line class="hl-failmark" x1="${X(i + 0.5).toFixed(1)}" y1="${top}" x2="${X(i + 0.5).toFixed(1)}" y2="${bottom}"/>`; });
  s += `<circle class="sv-dot" cx="${X(pts.at(-1)[0]).toFixed(1)}" cy="${y(pts.at(-1)[1]).toFixed(1)}" r="4.5"/>`;
  const lab = (d) => d.toLocaleDateString("de", { day: "numeric", month: "short" });
  s += txt(L, H_ - 6, lab(days[0].day), "start") + txt((L + R) / 2, H_ - 6, lab(days[Math.floor(days.length / 2)].day)) + txt(R, H_ - 6, "heute", "end");
  return svg(W, H_, s, "Antwortzeit");
}

const CSS = `
.hl-dot.test { fill: var(--ag-primary); }
:host([narrow]) .mk-range button { padding: 0 1px; font-size: 12.5px; letter-spacing: -.1px; }
.mk-sum { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; font-size: 12.5px; color: var(--ag-text2); }
.mk-sum b { color: var(--ag-text); font-weight: 600; }
`;

const kpis = (days) => {
  const live = days.filter((d) => !d.none);
  const sum = (k) => live.reduce((a, d) => a + d[k], 0);
  const total = sum("ok") + sum("report") + sum("fail") + sum("test");
  const rate = (100 * (total - sum("fail"))) / total;
  return [[`${rate.toLocaleString("de", { maximumFractionDigits: 2 })} %`, "erfolgreich"], [total.toLocaleString("de"), "Lebenszeichen"], [String(sum("fail")), "gescheitert"],
    [String(sum("report")), "Fehler gemeldet"], [`${Math.round(live.reduce((a, d) => a + d.ms, 0) / live.length)} ms`, "Antwortzeit im Mittel"]];
};
const latKpis = (days) => {
  const live = days.filter((d) => !d.none);
  return [["124 ms", "aktuell"], [`${Math.round(live.reduce((a, d) => a + d.ms, 0) / live.length)} ms`, "im Mittel"], ["2,4 s", "langsamster Aufruf"], [String(live.reduce((a, d) => a + d.fail, 0)), "ohne Antwort"]];
};

async function view(mobile, { name, range, chart, tab = "history" }) {
  const s = await open(browser, { mobile, lang: "de", theme: mobile ? "dark" : "light", tab: "config", prefs: { sub: "system" }, query: "&hc=sample", fixedTime: NOW });
  await s.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
  await s.tap('.ag-hcsum [data-hc="open"]');
  await s.waitFor("return r.getElementById('ag-hclist').open");
  await s.tap('#ag-hclist [data-hc-row="a1b2c3d4e5f6"] [data-hc="log"]');
  await s.waitFor("const d=r.getElementById('ag-hclog'); return d.open && !d.querySelector('.ag-sv[data-busy]') && !!d.querySelector('.ag-sv-chart svg')");
  await s.tap('#ag-hclog [data-sv="range"][data-hours="720"]');
  await s.waitFor("const d=r.getElementById('ag-hclog'); return !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-range .on')?.dataset.hours === '720'");
  if (tab === "latency") await s.tap('#ag-hclog [data-sv="tab"][data-tab="latency"]');
  await s.page.waitForTimeout(300);
  const W = mobile ? 358 : 832;
  const days = DAYS.slice(range === 90 ? -90 : 0);
  const chartSvg = tab === "latency" ? latency(days, W) : chart === "a" ? bars(days, W, range === 365 && mobile) : raster(days, W);
  const k = tab === "latency" ? latKpis(days) : kpis(days);
  const live = days.filter((d) => !d.none);
  const sum = tab === "latency" ? "" : `<div class="mk-sum"><span><b>${live.filter((d) => d.fail).length}</b> Tage mit Ausfall</span><span><b>${live.filter((d) => d.report).length}</b> Tage mit Fehlermeldung</span><span><b>${live.filter((d) => d.gap >= 30).length}</b> Tage mit Lücke</span>${range === 365 ? "<span>aufgezeichnet seit 14. Dez. 2025</span>" : ""}</div>`;
  const legend = tab === "latency" ? [["hl-i-failmark", "Tag mit gescheitertem Aufruf"]]
    : [["hl-i ok", mobile ? "OK" : "alle angekommen"], ["hl-i report", "Fehler gemeldet"], ["hl-i fail", "gescheitert"], ["hl-i gap", mobile ? "Lücke" : "Lücke (über 30 min)"], ["mk-i-test", "Test"]];
  await s.ev(`const [css, chartSvg, k, legend, sum, range] = arg; const d=r.getElementById('ag-hclog');
    if (!r.querySelector('style.mk')) { const st=document.createElement('style'); st.className='mk'; st.textContent=css + '.mk-i-test { background: var(--ag-primary); border-radius: 50% !important; }'; r.appendChild(st); }
    const narrow=r.host.hasAttribute('narrow');
    const seg=d.querySelector('.ag-sv-range'); seg.classList.add('mk-range');
    seg.innerHTML=[[3,'3 Std.'],[12,'12 Std.'],[24,'1 Tag'],[168,'7 Tage'],[720,'30 Tage'],[90,'90 Tage'],[365,'1 Jahr']].map(([v,l]) => '<button type="button" class="' + (v === range ? 'on' : '') + '">' + l + '</button>').join('');
    d.querySelector('.ag-sv-kpis').innerHTML=(narrow ? k.slice(0, 3) : k).map(([b, l]) => '<div class="ag-sv-kpi"><b>' + b + '</b><span>' + l + '</span></div>').join('');
    d.querySelector('.ag-sv-chart').innerHTML=chartSvg + sum;
    d.querySelector('.ag-sv-legend').innerHTML=legend.map(([c, l]) => '<span><i class="' + c + '"></i>' + l + '</span>').join('');
    return 1;`, [CSS, chartSvg, k, legend, sum, range]);
  await s.page.waitForTimeout(400);
  const fits = await s.ev("const g=r.getElementById('ag-hclog').querySelector('.ag-sv-range'); return { sw: g.scrollWidth, cw: g.clientWidth, w: Math.round(g.getBoundingClientRect().width), clipped: [...g.querySelectorAll('button')].some((b) => b.scrollWidth > b.clientWidth + 1) }");
  console.log(name, mobile ? "handy" : "desktop", JSON.stringify(fits));
  await s.page.screenshot({ path: `${out}${name}-${mobile ? "handy" : "desktop"}.png` });
  await s.ctx.close();
}

for (const mobile of [false, true]) {
  await view(mobile, { name: "a-90tage-tagesbalken", range: 90, chart: "a" });
  await view(mobile, { name: "a-1jahr-tagesbalken", range: 365, chart: "a" });
  await view(mobile, { name: "b-90tage-raster", range: 90, chart: "b" });
  await view(mobile, { name: "b-1jahr-raster", range: 365, chart: "b" });
  await view(mobile, { name: "antwortzeit-1jahr", range: 365, tab: "latency" });
}
await browser.close();
server.close?.();
process.exit(0);
