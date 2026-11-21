// 1.68.0: Protokoll der HealthCheck-Dienste (Wunsch und Entscheide des Nutzers 2026-11-19, 17:06 bis 17:48; Mockups healthcheck-protokoll-v1/-v2).
// Runder Knopf "Protokoll" als erster je Zeile der Dienste; Ansicht mit den Bausteinen der Sensoransicht: Kopf mit Auswahl des Dienstes, Zustand und
// "Bearbeiten" (seit 1.69.0 drei runde Knöpfe wie in der Liste: Fehler senden, Lebenszeichen senden, Stift); Kacheln Verlauf, Antwortzeit, Dienst; Zeitraum 3 Std. bis 30 Tage; Grafik je Zeitraum (bis 1 Tag Herzschlag mit Band, 7 Tage
// Zeitleiste je Tag, 30 Tage Raster Tag x Stunde); Antwortzeit mit Zonen und Marken; Liste "Ereignisse" und "Alle Aufrufe", beide genau nach dem
// gewählten Zeitraum, die Zahl am Reiter ist die Zahl der Liste (Vorgabe des Nutzers); einzelne Aufrufe nur 24 Stunden (Hinweis bei 7 und 30 Tagen).
// Suche, Sortierung, Tabellenkopf klebt, nichts ragt seitlich hinaus. Je Sprache, Desktop und Handy, echte Klicks/Taps, feste Uhrzeit.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { log: "Protokoll", edit: "Bearbeiten", testFail: "Fehler senden", testOk: "Lebenszeichen senden", tabs: ["Verlauf", "Antwortzeit", "Dienst"], ranges: ["3 Std.", "12 Std.", "1 Tag", "7 Tage", "30 Tage", "6 Monate", "1 Jahr"], ok: "in Ordnung",
    okSince: "in Ordnung seit", failed: "gescheitert", failedSince: "gescheitert seit", every: "alle 5 min", kpis: ["erfolgreich", "Lebenszeichen", "gescheitert", "Fehler gemeldet", "Antwortzeit im Mittel"],
    latKpis: ["aktuell", "im Mittel", "langsamster Aufruf", "ohne Antwort"], zones: ["schnell", "langsam", "sehr langsam"], events: "Ereignisse", calls: "Alle Aufrufe",
    callsDay: "Einzelne Aufrufe bleiben 24 Stunden", noData: "Noch nichts aufgezeichnet", st: "Selbsttest", url: "Ping-URL", keep: "Aufbewahrt:", fail: "Gescheitert", start: "Erstes Lebenszeichen nach dem Start" },
  en: { log: "Log", edit: "Edit", testFail: "Send failure", testOk: "Send life sign", tabs: ["History", "Response time", "Service"], ranges: ["3 h", "12 h", "1 day", "7 days", "30 days", "6 months", "1 year"], ok: "OK",
    okSince: "OK since", failed: "Failed", failedSince: "Failed since", every: "every 5 min", kpis: ["successful", "life signs", "failed", "failures reported", "mean response time"],
    latKpis: ["now", "on average", "slowest call", "without answer"], zones: ["fast", "slow", "very slow"], events: "Events", calls: "All calls",
    callsDay: "Single calls are kept for 24 hours", noData: "Nothing recorded yet", st: "Self-test", url: "Ping URL", keep: "Kept:", fail: "Failed", start: "First life sign after the start" },
};
const NOW = new Date("2026-11-19T18:10:00+01:00").getTime();
// Erfundene Dienste des Nachbaus (?hc=sample), nie echte Ping-URLs
const HC = { id: "a1b2c3d4e5f6", name: "Healthchecks Haus", url: "https://hc-ping.com/5b2f3c1e-8d4a-4f6b-9c7e-2a1d0e9f8b3c" };
const BS = { id: "c3d4e5f6a1b2", name: "Better Stack Büro", url: "https://uptime.betterstack.com/api/v1/heartbeat/Qx7pW2mZk9RtV4sN" };

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&hc=sample", fixedTime: NOW });
    await s.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
    await s.tap('.ag-hcsum [data-hc="open"]');
    await s.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 3");
    const dlg = (code) => s.ev(`const d=r.getElementById('ag-hclog'); ${code}`);
    const ready = (hours) => s.waitFor(`const d=r.getElementById('ag-hclog'); return d.open && !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-range .on')?.dataset.hours === '${hours}' && !!d.querySelector('.ag-sv-chart svg, .ag-sv-chart .ag-sv-msg')`, 8000);
    const expected = (id, hours) => s.sim(`const i=window.__healthchecks.find((x) => x.id === arg[0]); const a=window.__hcLogHistory(i, arg[1]);
      return { ev: a.events_total, evShown: a.events.length, calls: a.calls_total, callsShown: a.calls.length, total: a.summary.total, fails: a.points.filter((p) => p[1] === 'fail').length }`, [id, hours]);
    const requests = () => s.sim("return window.__hcHistory.map((m) => [m.check_id, m.hours])");

    // ----- Knopf in der Liste -----
    const btn = await s.ev(`return [...r.querySelectorAll('#ag-hclist [data-hc-row]')].map((row) => { const b=row.querySelector('.ag-wf-btns .ag-iconbtn'); return { act: b.dataset.hc, label: b.getAttribute('aria-label'), icon: !!b.querySelector('svg'), w: Math.round(b.getBoundingClientRect().width) }; })`);
    check(`${tag}: je Zeile zuerst der runde Knopf "${t.log}" (Symbol, 44 px)`, btn.length === 3 && btn.every((b) => b.act === "log" && b.label === t.log && b.icon && b.w === 44), JSON.stringify(btn));
    await s.tap(`#ag-hclist [data-hc-row="${HC.id}"] [data-hc="log"]`);
    check(`${tag}: das Protokoll öffnet sich über der Liste (die Liste bleibt offen) und lädt "1 Tag"`, await ready(24) && await s.ev("return r.getElementById('ag-hclist').open")
      && JSON.stringify((await requests()).at(-1)) === JSON.stringify([HC.id, 24]));

    // ----- Kopf, Kacheln, Zeitraum -----
    // Seit 1.69.0 (Wunsch des Nutzers 2026-11-19, 21:50): statt "Bearbeiten" drei runde Knöpfe wie in der Liste: Fehler senden, Lebenszeichen
    // senden, Stift (gleiche Symbole, gleiche Reihenfolge, 44 px)
    const icons = await s.ev(`const d=r.getElementById('ag-hclist'); const b=[...d.querySelectorAll('[data-hc-row="${HC.id}"] .ag-iconbtn')]; return Object.fromEntries(b.map((x) => [x.dataset.hc, x.querySelector('svg')?.innerHTML]))`);
    const head = await dlg(`const h=d.querySelector('.ag-sv-head'); const x=d.querySelector('.ag-dlg-x').getBoundingClientRect(); const bs=[...h.querySelectorAll('.ag-hl-acts .ag-iconbtn')];
      return { name: h.querySelector('.ag-hl-pick b').textContent, sub: h.querySelector('.ag-sv-ttl small').textContent, pill: h.querySelector('.ag-sv-pill').textContent, pillCls: h.querySelector('.ag-sv-pill').className,
        acts: bs.map((b) => b.dataset.sv), labels: bs.map((b) => b.getAttribute('aria-label')), svg: bs.map((b) => b.querySelector('svg')?.innerHTML), size: bs.map((b) => Math.round(b.getBoundingClientRect().width)),
        text: bs.map((b) => b.textContent.trim()).join(''), tint: !!h.querySelector('.ag-oav.ag-tint-health svg'),
        free: bs.every((b) => { const e=b.getBoundingClientRect(); return e.right <= x.left + 1 || e.top >= x.bottom - 1; }), inside: bs.every((b) => b.getBoundingClientRect().right <= d.getBoundingClientRect().right), expanded: h.querySelector('[data-sv="menu"]').getAttribute('aria-expanded') }`);
    check(`${tag}: Kopf: getöntes Herz, Name als Auswahl, darunter Rechner${mobile ? "" : ", Anbieter"} und Intervall, Zustand "${t.ok}"`,
      head.name === HC.name && head.sub.includes("hc-ping.com") && head.sub.includes(t.every) && head.sub.includes("Healthchecks.io") !== mobile && head.pill === t.ok && !/err|act|off/.test(head.pillCls)
      && head.tint && head.expanded === "false", JSON.stringify(head));
    check(`${tag}: Kopf: drei runde Knöpfe "${t.testFail}", "${t.testOk}", "${t.edit}" mit den Symbolen der Liste, 44 px, ohne Text, ohne das X zu überdecken`,
      JSON.stringify(head.acts) === JSON.stringify(["test-fail", "test-ok", "edit"]) && JSON.stringify(head.labels) === JSON.stringify([t.testFail, t.testOk, t.edit])
      && head.svg[0] === icons["test-fail"] && head.svg[1] === icons["test-ok"] && head.svg[2] === icons.edit && head.size.every((w) => w === 44) && head.text === "" && head.free && head.inside, JSON.stringify(head));
    // Lebenszeichen und Fehler senden wie in der Liste; danach holt das Protokoll neu
    for (const [act, kind] of [["test-ok", "ok"], ["test-fail", "fail"]]) {
      const n = (await requests()).length;
      await s.tap(`#ag-hclog .ag-hl-acts [data-sv="${act}"]`);
      let reloaded = false;
      for (let i = 0; i < 60 && !reloaded; i += 1) {
        reloaded = (await requests()).length > n;
        if (!reloaded) await s.page.waitForTimeout(100);
      }
      const ping = (await s.sim("return window.__hcCalls.filter((m) => m.type === 'alarmageddon/healthcheck_ping').map((m) => [m.check_id, m.kind])")).at(-1);
      check(`${tag}: Kopf: "${kind === "ok" ? t.testOk : t.testFail}" sendet wie in der Liste, das Protokoll lädt neu, das Fenster bleibt`, reloaded && JSON.stringify(ping) === JSON.stringify([HC.id, kind])
        && (await s.waitFor("return !r.querySelector('#ag-hclog .ag-hl-acts [disabled]')", 6000)) && (await s.ev("return r.getElementById('ag-hclog').open")), JSON.stringify(ping));
    }
    await ready(24);
    const tiles = await dlg("return [...d.querySelectorAll('.ag-sv-tile')].map((b) => ({ tab: b.dataset.tab, label: b.querySelector('small').textContent, value: b.querySelector('b').textContent, on: b.classList.contains('on') }))");
    check(`${tag}: Kacheln ${t.tabs.join(", ")}; "Verlauf" gewählt mit "${t.okSince} …", Antwortzeit in ms, Dienst "Healthchecks.io"`,
      tiles.map((x) => x.label).join() === t.tabs.join() && tiles[0].on && tiles[0].value.startsWith(t.okSince) && /^\d+ ms$/.test(tiles[1].value) && tiles[2].value === "Healthchecks.io", JSON.stringify(tiles));
    const seg = await dlg("return [...d.querySelectorAll('.ag-sv-range button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : ''))");
    check(`${tag}: Zeitraum 3 Std. bis 1 Jahr (6 Monate und 1 Jahr, 90 Tage wurden am 2026-11-20 zu 6 Monaten), "1 Tag" gewählt`, JSON.stringify(seg) === JSON.stringify(t.ranges.map((v, i) => (i === 2 ? `${v}*` : v))), JSON.stringify(seg));
    const row = await dlg("const b=[...d.querySelectorAll('.ag-sv-range button')]; const r0=b[0].getBoundingClientRect(); const g=d.querySelector('.ag-sv-range'); return { one: b.every((x) => Math.abs(x.getBoundingClientRect().top - r0.top) < 1), clipped: b.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent), inside: g.getBoundingClientRect().right <= d.getBoundingClientRect().right }");
    check(`${tag}: alle sieben Zeiträume in einer Zeile, keiner abgeschnitten${mobile ? " (Handy: kleinere Schrift)" : ""}`, row.one && !row.clipped.length && row.inside, JSON.stringify(row));
    const kpis = await dlg("return [...d.querySelectorAll('.ag-sv-kpi span')].map((x) => x.textContent)");
    check(`${tag}: Kennzahlen ${mobile ? "(die ersten drei)" : ""}: ${t.kpis.join(", ")}`, kpis.join() === t.kpis.slice(0, mobile ? 3 : 5).join(), JSON.stringify(kpis));
    const beat = await dlg("const c=d.querySelector('.ag-sv-chart svg'); const k=(sel) => c.querySelectorAll(sel).length; return { bars: k('rect.hl-b'), ok: k('rect.hl-b.ok'), fail: k('rect.hl-b.fail'), report: k('rect.hl-b.report'), test: k('rect.hl-b.test'), gap: k('rect.hl-gap'), lane: k('rect.hl-lane'), marks: k('rect.hl-lane.mark'), band: k('.hl-band'), legend: d.querySelectorAll('.ag-sv-legend span').length }");
    check(`${tag}: 1 Tag: Herzschlag mit Balken je Abschnitt (grün, gescheitert, Fehler gemeldet, Test, Lücke grau), Band darunter mit Marken, Legende mit fünf Einträgen`,
      beat.bars > (mobile ? 60 : 200) && beat.ok > 50 && beat.fail >= 1 && beat.report >= 1 && beat.test >= 1 && beat.gap >= 1 && beat.lane >= beat.bars && beat.marks >= 3 && beat.band === 0 && beat.legend === 5, JSON.stringify(beat));

    // ----- Zeitraum: Grafik je Zeitraum, Zahl und Liste genau nach dem Zeitraum (Vorgabe des Nutzers) -----
    for (const hours of [3, 12, 168, 720, 4320, 8760, 24]) {
      await s.tap(`#ag-hclog [data-sv="range"][data-hours="${hours}"]`);
      const loaded = await ready(hours);
      const exp = await expected(HC.id, hours);
      const chart = await dlg("const c=d.querySelector('.ag-sv-chart svg'); return { lane: c.querySelectorAll('.hl-lane').length, band: c.querySelectorAll('rect.hl-band.ok').length, days: [...c.querySelectorAll('text.sv-tx')].filter((x) => x.getAttribute('text-anchor') === 'end' && /\\d/.test(x.textContent) && !/:/.test(x.textContent)).length, rects: c.querySelectorAll('rect').length, cells: c.querySelectorAll('rect.hl-cell').length, dayCells: c.querySelectorAll('rect[data-day]').length, kinds: [...new Set([...c.querySelectorAll('rect[data-day]')].map((x) => x.dataset.kind))].sort().join(), sum: d.querySelector('.ag-hl-sum')?.textContent || '' }");
      const shape = hours <= 24 ? chart.lane > 0 && chart.band === 0
        : hours === 168 ? chart.band >= 7 && chart.days === 7 && chart.lane === 0
          : hours === 720 ? chart.rects === 720 && chart.cells > 600 && chart.lane === 0
            : chart.dayCells === hours / 24 && chart.kinds.includes("fail") && chart.kinds.includes("ok") && chart.kinds.includes("gap") && chart.sum.length > 10 && (hours === 4320 || chart.kinds.includes("none"));
      const what = hours <= 24 ? "Herzschlag mit Band" : hours === 168 ? "Zeitleiste mit einer Zeile je Tag" : hours === 720 ? "Raster mit 30 Tagen zu 24 Stunden" : `Raster Monat × Tag mit ${hours / 24} Tagen und der Zahl der Tage darunter`;
      check(`${tag}: ${hours} Std.: ${what}`, loaded && shape, JSON.stringify(chart));
      const ev = await dlg("return { n: d.querySelector('[data-sv=\"pane\"][data-pane=\"events\"] .ag-sv-n').textContent, rows: d.querySelectorAll('.ag-sv-rows tbody tr:not(.day)').length, total: d.querySelectorAll('.ag-sv-kpi b')[1].textContent.replace(/\\D/g, '') }");
      check(`${tag}: ${hours} Std.: "${t.events}" zählt ${exp.ev} wie der Server, die Liste zeigt sie (Zahl = Liste); "Lebenszeichen" ${exp.total}`,
        Number(ev.n) === exp.ev && ev.rows === exp.evShown && ev.rows === Math.min(exp.ev, 300) && Number(ev.total) === exp.total, JSON.stringify({ ev, exp }));
      await s.tap('#ag-hclog [data-sv="pane"][data-pane="calls"]');
      const calls = await dlg("return { n: d.querySelector('[data-sv=\"pane\"][data-pane=\"calls\"] .ag-sv-n').textContent, rows: d.querySelectorAll('.ag-sv-rows tbody tr:not(.day)').length, lead: d.querySelector('.ag-hl-lead')?.textContent || '', on: d.querySelector('[data-sv=\"pane\"].on')?.dataset.pane }");
      check(`${tag}: ${hours} Std.: "${t.calls}" zählt ${exp.calls}, die Liste zeigt ${exp.callsShown}${hours > 24 ? `; über der Liste "${t.callsDay} …"` : ", ohne Hinweis"}`,
        calls.on === "calls" && Number(calls.n) === exp.calls && calls.rows === exp.callsShown && (hours > 24 ? calls.lead.startsWith(t.callsDay) : !calls.lead), JSON.stringify({ calls, exp }));
      if (hours === 3) check(`${tag}: 3 Std.: nur Aufrufe der letzten 3 Stunden (bei 5 Minuten Abstand rund 36)`, exp.calls >= 34 && exp.calls <= 40, JSON.stringify(exp));
      await s.tap('#ag-hclog [data-sv="pane"][data-pane="events"]');
    }

    // ----- Liste: Zeit, Suche, Sortierung, Tabellenkopf -----
    await s.tap('#ag-hclog [data-sv="pane"][data-pane="calls"]');
    const times = await dlg("return [...d.querySelectorAll('.ag-sv-rows tbody tr:not(.day) td:first-child')].slice(0, 5).map((x) => x.textContent)");
    check(`${tag}: Aufrufe mit Uhrzeit${mobile ? " (ohne Sekunden)" : " und Sekunden"}`, times.length === 5 && times.every((x) => (x.match(/:/g) || []).length === (mobile ? 1 : 2)), JSON.stringify(times));
    const scroll = await dlg("const l=d.querySelector('.ag-sv-list'), f=d.querySelector('.ag-sv-fix'), th=d.querySelector('.ag-sv-rows th'); const f0=f.getBoundingClientRect().top; const can=l.scrollHeight > l.clientHeight + 50; l.scrollTop=600; const lt=l.getBoundingClientRect().top; return { can, moved: l.scrollTop, fix: Math.abs(f.getBoundingClientRect().top - f0), th: Math.abs(th.getBoundingClientRect().top - lt), dlgScroll: d.scrollTop, wide: l.scrollWidth - l.clientWidth, fixWide: f.scrollWidth - f.clientWidth }");
    check(`${tag}: nur die Liste scrollt, der Tabellenkopf klebt, nichts ragt seitlich hinaus`, scroll.can && scroll.moved > 300 && scroll.fix < 1 && scroll.th < 1.5 && scroll.dlgScroll === 0 && scroll.wide <= 1 && scroll.fixWide <= 1, JSON.stringify(scroll));
    await dlg("d.querySelector('.ag-sv-list').scrollTop = 0; return 1");
    await (await s.el('#ag-hclog [data-sv="lq"]')).type("Test");
    check(`${tag}: Suche "Test" zeigt nur die zwei Tests, Fokus bleibt im Feld`, await s.waitFor("const d=r.getElementById('ag-hclog'); const tr=[...d.querySelectorAll('.ag-sv-rows tbody tr:not(.day)')]; return tr.length === 2 && tr.every((x) => x.dataset.kind === 'test') && r.activeElement === d.querySelector('[data-sv=\"lq\"]')"));
    await s.tap('#ag-hclog [data-sv="lq-clear"]');
    await s.tap('#ag-hclog .ag-sv-rows [data-sv="lsort"][data-key="by"]');
    check(`${tag}: Sortieren nach "Auslöser": aufsteigend, die Zeilen in dieser Reihenfolge`, await s.waitFor("const d=r.getElementById('ag-hclog'); const tags=[...d.querySelectorAll('.ag-sv-rows tbody tr:not(.day) .ag-sv-tag')].map((x) => x.textContent); return tags.length > 30 && tags.every((x, i) => !i || tags[i - 1].localeCompare(x, undefined, { sensitivity: 'base' }) <= 0) && d.querySelector('.ag-sv-rows th[aria-sort=\"ascending\"] [data-key=\"by\"]') !== null"));
    await s.tap('#ag-hclog [data-sv="pane"][data-pane="events"]');
    const evText = await dlg("return d.querySelector('.ag-sv-rows').innerText");
    check(`${tag}: Ereignisse nennen "${t.fail}" und "${t.start}"`, evText.includes(t.fail) && evText.includes(t.start), evText.slice(0, 300));

    // ----- Auswahl des Dienstes -----
    await s.tap('#ag-hclog [data-sv="menu"]');
    const menu = await dlg("const m=d.querySelector('.ag-hl-menu'); return { shown: !m.hidden && m.getBoundingClientRect().height > 100, items: [...m.querySelectorAll('[data-sv=\"pick\"]')].map((b) => ({ id: b.dataset.id, sel: b.getAttribute('aria-selected'), dot: b.querySelector('.ag-sv-dot').className, text: b.innerText })), expanded: d.querySelector('[data-sv=\"menu\"]').getAttribute('aria-expanded') }");
    const bsItem = menu.items.find((i) => i.id === BS.id);
    check(`${tag}: Auswahl: drei Dienste, der offene gewählt, je Punkt in der Farbe und "seit"; Better Stack rot mit "${t.failedSince}"`,
      menu.shown && menu.expanded === "true" && menu.items.length === 3 && menu.items.find((i) => i.id === HC.id)?.sel === "true" && bsItem?.dot.includes("fail") && bsItem.text.includes(t.failedSince), JSON.stringify(menu));
    await s.tap('#ag-hclog [data-sv="pane"][data-pane="calls"]');
    check(`${tag}: ein Tipp daneben schliesst die Auswahl und tut trotzdem, was er soll (Reiter "${t.calls}")`, await s.waitFor("const d=r.getElementById('ag-hclog'); return d.querySelector('.ag-hl-menu').hidden && d.querySelector('[data-sv=\"pane\"].on')?.dataset.pane === 'calls' && d.querySelector('[data-sv=\"menu\"]').getAttribute('aria-expanded') === 'false'"));
    await s.tap('#ag-hclog [data-sv="menu"]');
    await s.tap(`#ag-hclog [data-sv="pick"][data-id="${BS.id}"]`);
    const switched = await ready(24) && await dlg(`return d.querySelector('.ag-hl-pick b').textContent === ${JSON.stringify(BS.name)} && d.querySelector('.ag-sv-pill').classList.contains('err') && d.querySelector('.ag-sv-pill').textContent === ${JSON.stringify(t.failed)} && d.querySelector('.ag-sv-tile.on').dataset.tab === 'history' && d.querySelector('[data-sv="pane"].on').dataset.pane === 'events' && d.querySelector('.ag-hl-menu').hidden`);
    check(`${tag}: Wechsel zu "${BS.name}": neu geladen, Zustand rot "${t.failed}", wieder "${t.tabs[0]}" und "${t.events}"`, switched && JSON.stringify((await requests()).at(-1)) === JSON.stringify([BS.id, 24]));

    // ----- Antwortzeit -----
    await s.tap('#ag-hclog [data-sv="tab"][data-tab="latency"]');
    const lat = await dlg("const c=d.querySelector('.ag-sv-chart svg'); return { zones: c.querySelectorAll('rect.sv-zone').length, labels: [...c.querySelectorAll('text.sv-tx.ok, text.sv-tx.warn, text.sv-tx.err')].map((x) => x.textContent), marks: c.querySelectorAll('line.hl-failmark').length, line: c.querySelectorAll('path.sv-line').length, kpis: [...d.querySelectorAll('.ag-sv-kpi span')].map((x) => x.textContent), legend: d.querySelectorAll('.ag-sv-legend span').length, tile: d.querySelector('.ag-sv-tile[data-tab=\"latency\"] b').textContent }");
    const expBs = await expected(BS.id, 24);
    check(`${tag}: Antwortzeit: Linie, Zonen ${t.zones.join(", ")}, je gescheitertem Aufruf eine Marke (${expBs.fails}), Kennzahlen ${t.latKpis.slice(0, mobile ? 3 : 4).join(", ")}; letzter Aufruf gescheitert: "–"`,
      lat.zones === 3 && lat.labels.join() === t.zones.join() && lat.marks === expBs.fails && expBs.fails >= 2 && lat.line >= 1 && lat.kpis.join() === t.latKpis.slice(0, mobile ? 3 : 4).join() && lat.legend === 1 && lat.tile === "–", JSON.stringify(lat));

    // ----- Dienst und Bearbeiten -----
    await s.tap('#ag-hclog [data-sv="tab"][data-tab="service"]');
    const svc = await dlg(`const rows=[...d.querySelectorAll('.ag-sv-drow')].map((x) => [x.querySelector('.ag-t2').textContent, x.querySelector('b').textContent, !!x.querySelector('[data-sv="copy"]')]); return { rows, range: !!d.querySelector('.ag-sv-range'), keep: d.querySelector('.ag-hl-keep')?.textContent || '', wide: d.querySelector('.ag-sv-list').scrollWidth - d.querySelector('.ag-sv-list').clientWidth }`);
    const urlRow = svc.rows.find((x) => x[0] === t.url);
    check(`${tag}: Dienst: Angaben wie beim Gerät, je mit Kopieren; "${t.url}" ganz; kein Zeitraum; Hinweis "${t.keep} …"; nichts ragt hinaus`,
      urlRow?.[1] === BS.url && svc.rows.every((x) => x[2]) && svc.rows.length >= 8 && !svc.range && svc.keep.startsWith(t.keep) && svc.wide <= 1, JSON.stringify(svc));
    const before = (await requests()).length;
    await s.tap('#ag-hclog [data-sv="edit"]');
    check(`${tag}: "${t.edit}" öffnet das Formular des Dienstes über dem Protokoll`, await s.waitFor(`return r.getElementById('ag-hcform').open && r.getElementById('ag-hclog').open && r.querySelector('#ag-hcform [data-hc="f-name"]').value === ${JSON.stringify(BS.name)}`));
    const name = await s.el('#ag-hcform [data-hc="f-name"]');
    await name.fill(`${BS.name} 2`);
    await name.dispatchEvent("input");
    await s.tap('#ag-hcform button[type="submit"]');
    check(`${tag}: nach dem Speichern zeigt das Protokoll den neuen Namen und lädt neu`, await s.waitFor(`const d=r.getElementById('ag-hclog'); return !r.getElementById('ag-hcform').open && d.open && d.querySelector('.ag-hl-pick b').textContent === ${JSON.stringify(`${BS.name} 2`)}`)
      && (await requests()).length > before);

    // ----- Laden und Zwischenspeicher -----
    await s.tap('#ag-hclog [data-sv="tab"][data-tab="history"]');
    await s.sim("window.__hcLogDelay = 700; return 1");
    await s.tap('#ag-hclog [data-sv="range"][data-hours="168"]');
    check(`${tag}: beim Laden bleibt die alte Grafik gedimmt stehen, darüber die drei Punkte (nie "Lädt …")`, await s.waitFor("const d=r.getElementById('ag-hclog'); return !!d.querySelector('.ag-sv[data-busy]') && !!d.querySelector('.ag-sv-chart .ag-ld') && !!d.querySelector('.ag-sv-chart svg') && d.querySelector('.ag-sv-range .on')?.dataset.hours === '168'", 600));
    await ready(168);
    const count = (await requests()).length;
    await s.tap('#ag-hclog [data-sv="range"][data-hours="24"]');
    check(`${tag}: zurück auf "1 Tag" zeigt sofort den eben geholten Zeitraum (keine neue Abfrage)`, await s.waitFor("const d=r.getElementById('ag-hclog'); return !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-range .on')?.dataset.hours === '24'", 300) && (await requests()).length === count);
    await s.sim("window.__hcLogDelay = 0; return 1");
    await s.tap("#ag-hclog .ag-dlg-x");
    check(`${tag}: X schliesst das Protokoll, die Liste der Dienste bleibt offen`, await s.waitFor("return !r.getElementById('ag-hclog').open && r.getElementById('ag-hclist').open"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Statuskachel der Übersicht (Wunsch des Nutzers 2026-11-19, 18:36): mit Diensten unten zweigeteilt, gleich hoch; ohne Dienste wie bisher -----
    const tile = async (query) => {
      const o = await open(browser, { mobile, lang, query, fixedTime: NOW });
      await o.waitFor("return !!r.querySelector('.ag-status .ag-st-row')");
      const info = await o.ev(`const t=r.querySelector('.ag-status'); const h=[...t.querySelectorAll('.ag-half')];
        return { h: Math.round(t.getBoundingClientRect().height), halves: h.map((x) => ({ half: x.dataset.half, tone: x.querySelector('.ag-mini').className.replace('ag-mini', '').trim(), title: x.querySelector('.ag-half-t').textContent,
          cut: x.querySelector('.ag-half-t').scrollWidth > x.querySelector('.ag-half-t').clientWidth + 1, chevron: getComputedStyle(x.querySelector('.ag-cbtn')).display !== 'none', w: Math.round(x.getBoundingClientRect().width), top: Math.round(x.getBoundingClientRect().top) })),
          row: t.querySelector('.ag-st-row:not(.ag-half)')?.textContent.trim() || '' }`);
      return { o, info };
    };
    const without = await tile("");
    check(`${tag}: Statuskachel ohne Dienste wie bisher (eine Zeile "${lang === "de" ? "Selbsttest: …" : "Self-test: …"}", keine Hälften, keine Einladung)`, !without.info.halves.length && without.info.row.length > 5 && !/HealthCheck/.test(without.info.row), JSON.stringify(without.info));
    await without.o.ctx.close();
    const withHc = await tile("&hc=sample");
    const [left, right] = withHc.info.halves;
    check(`${tag}: mit Diensten unten zweigeteilt: links "${t.st}", rechts "HealthCheck" (rot, ein Dienst gescheitert), gleich breit, gleich hoch wie ohne${mobile ? ", ohne Pfeil, nichts abgeschnitten" : ""}`,
      withHc.info.halves.length === 2 && left.half === "selftest" && left.title === t.st && right.half === "healthcheck" && right.title === "HealthCheck" && right.tone === "err"
      && Math.abs(left.w - right.w) <= 1 && left.top === right.top && Math.abs(withHc.info.h - without.info.h) <= 1 && !left.cut && !right.cut && left.chevron === !mobile, JSON.stringify(withHc.info));
    await withHc.o.tap('.ag-status [data-half="healthcheck"]');
    check(`${tag}: rechte Hälfte öffnet die Liste der Dienste`, await withHc.o.waitFor("return r.getElementById('ag-hclist').open"));
    await withHc.o.ev("r.getElementById('ag-hclist').close(); return 1");
    await withHc.o.tap('.ag-status [data-half="selftest"]');
    check(`${tag}: linke Hälfte öffnet den Selbsttest`, await withHc.o.waitFor("return r.getElementById('ag-selftest').open"));
    await withHc.o.sim("for (const h of window.__healthchecks) h.status = { at: new Date().toISOString(), sent: 'ok', result: 'ok', code: 200, test: false }; return 1");
    await withHc.o.ev("r.getElementById('ag-selftest').close(); r.host._fetch(); return 1");
    check(`${tag}: alle Dienste in Ordnung: rechte Hälfte grün`, await withHc.o.waitFor("return r.querySelector('.ag-status [data-half=\"healthcheck\"] .ag-mini')?.classList.contains('ok')"));
    check(`${tag}: keine Fehler im Browser (Statuskachel)`, withHc.o.errors.length === 0, withHc.o.errors.join(" | "));
    await withHc.o.ctx.close();

    // ----- Sehr schmales Handy (320 px): sieben Zeiträume in zwei Zeilen, nichts ragt hinaus -----
    if (mobile) {
      const n = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&hc=sample", fixedTime: NOW, size: { width: 320, height: 700 } });
      await n.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
      await n.tap('.ag-hcsum [data-hc="open"]');
      await n.waitFor("return r.getElementById('ag-hclist').open");
      await n.tap(`#ag-hclist [data-hc-row="${HC.id}"] [data-hc="log"]`);
      await n.waitFor("const d=r.getElementById('ag-hclog'); return d.open && !d.querySelector('.ag-sv[data-busy]')");
      const narrow = await n.ev("const d=r.getElementById('ag-hclog'); const b=[...d.querySelectorAll('.ag-sv-range button')]; const tops=[...new Set(b.map((x) => Math.round(x.getBoundingClientRect().top)))]; const g=d.querySelector('.ag-sv-range').getBoundingClientRect(); return { rows: tops.length, clipped: b.filter((x) => x.scrollWidth > x.clientWidth + 1).length, inside: g.right <= innerWidth, wide: d.querySelector('.ag-sv-fix').scrollWidth - d.querySelector('.ag-sv-fix').clientWidth }");
      check(`${tag}: 320 px: die Zeiträume in zwei Zeilen, keiner abgeschnitten, nichts ragt hinaus`, narrow.rows === 2 && !narrow.clipped && narrow.inside && narrow.wide <= 1, JSON.stringify(narrow));
      await n.ctx.close();
    }

    // ----- Noch kein Protokoll (gleich nach dem Update) -----
    const e = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&hc=sample&hclog=empty", fixedTime: NOW });
    await e.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
    await e.tap('.ag-hcsum [data-hc="open"]');
    await e.waitFor("return r.getElementById('ag-hclist').open");
    await e.tap(`#ag-hclist [data-hc-row="${HC.id}"] [data-hc="log"]`);
    check(`${tag}: ohne Protokoll: "${t.noData} …" statt der Grafik, beide Reiter zählen 0, Zustand aus dem letzten Lebenszeichen`, await e.waitFor(`const d=r.getElementById('ag-hclog'); return d.open && !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-chart').innerText.startsWith(${JSON.stringify(t.noData)}) && [...d.querySelectorAll('[data-sv="pane"] .ag-sv-n')].map((x) => x.textContent).join() === '0,0' && !d.querySelector('.ag-sv-legend') && d.querySelector('.ag-sv-pill').textContent === ${JSON.stringify(t.ok)}`, 6000));
    check(`${tag}: keine Fehler im Browser (ohne Protokoll)`, e.errors.length === 0, e.errors.join(" | "));
    await e.ctx.close();
  }
}
await browser.close();
done();
