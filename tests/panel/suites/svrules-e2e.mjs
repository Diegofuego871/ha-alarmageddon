// 1.65.0 (Wunsch und Entscheide des Nutzers, 2026-11-18): Sensoransicht der Sensoren, die in der Überwachung vorkommen. Unter der Grafik die Reiter
// "Ereignisse" und "Regeln" (die Regeln der Überwachung mit diesem Sensor, Spalte "Regeln"; Benennung wie überall im Panel, Entscheid des Nutzers
// 19:47), je mit Suche und sortierbarer Tabelle; der Pfeil einer Regel führt zu ihr (Konfiguration › Aktionen › Überwachung, aufgeklappt, unter
// den festen Leisten, markiert), mit Rückfrage bei offenen Änderungen einer anderen Anlage. Jede Grenze der Regeln ist in der Grafik zu sehen, auch
// weit weg von den Werten.
// Sensoren ausserhalb der Überwachung bleiben, wie sie waren. Je Sprache, Desktop und Handy, echte Klicks und Eingaben.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { events: "Ereignisse", rules: "Regeln", col: "Regeln", colRule: "Regel", on: "Aktiv", off: "Aus", out: "Ausserhalb", q: "ordnung", noMatch: "Nichts passt", searchEv: "Ereignisse durchsuchen", searchRules: "Regeln durchsuchen", limit: "Grenze 40 °C", none: "keiner Regel der Überwachung" },
  en: { events: "Events", rules: "Rules", col: "Rules", colRule: "Rule", on: "Active", off: "Off", out: "Outside", q: "normal", noMatch: "Nothing matches", searchEv: "Search events", searchRules: "Search rules", limit: "Limit 40 °C", none: "not part of any monitoring rule" },
};
const TEMP = "sensor.kuehlschrank_temperatur";
const HUM = "sensor.keller_luftfeuchtigkeit";
const GATE = "binary_sensor.garagentor";
const DOOR = "binary_sensor.haustuer";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, query: "&monitor=1" });
    const dlg = (js) => s.ev(`const d=r.getElementById("ag-sensor"); ${js}`);
    const openView = async (id) => {
      await s.ev(`r.host.sensorView.open(${JSON.stringify(id)}); return 1`);
      return s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector('.ag-sv-chart svg') && !d.querySelector('.ag-sv[data-busy]')`, 8000);
    };
    const rows = () => dlg("return [...d.querySelectorAll('.ag-sv-rows tbody tr:not(.day)')].map((tr) => ({ kind: tr.dataset.kind || tr.dataset.state, rule: tr.dataset.rule || '', text: tr.innerText.replace(/\\s+/g, ' ').trim() }))");
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${TEMP}"]')`);

    // ----- Messwert mit einer Regel: Reiter, Zählung, Suche, Sortierung -----
    await s.tap(`[data-act="more"][data-entity="${TEMP}"]`);
    check(`${tag}: Messwert: über der Liste die Reiter "${t.events}" (2) und "${t.rules}" (1), "${t.events}" gewählt, Suchfeld "${t.searchEv}"`, await s.waitFor(`const d=r.getElementById("ag-sensor"); const b=[...d.querySelectorAll('.ag-sv-lbar [data-sv="pane"]')];
      const lab=(x) => [x.querySelector('span').firstChild.textContent.trim(), x.querySelector('.ag-sv-n').textContent.trim()].join('|');
      return b.length === 2 && lab(b[0]) === ${JSON.stringify(`${t.events}|2`)} && lab(b[1]) === ${JSON.stringify(`${t.rules}|1`)} && b[0].classList.contains('on')
        && d.querySelector('.ag-sv-lbar [data-sv="lq"]')?.placeholder === ${JSON.stringify(t.searchEv)} && !!d.querySelector('.ag-sv-lbar .ag-pill')`, 8000));
    check(`${tag}: die Leiste liegt in der Liste (scrollt mit), der Tabellenkopf ist sortierbar, "Zeit" absteigend gewählt; Spalte "${t.colRule}"`, await dlg(`const l=d.querySelector('.ag-sv-list'); const ths=[...d.querySelectorAll('.ag-sv-rows thead th')];
      return l.contains(d.querySelector('.ag-sv-lbar')) && ths[0].getAttribute('aria-sort') === 'descending' && !!ths[0].querySelector('[data-sv="lsort"][data-key="time"].on') && ths.some((th) => th.innerText.trim() === ${JSON.stringify(t.colRule)})`));
    let ev = await rows();
    check(`${tag}: zwei Ereignisse, neuestes zuerst (wieder in Ordnung, ausserhalb), mit Tageszeile`, ev.length === 2 && ev[0].kind === "ok" && ev[1].kind === "out" && (await dlg("return d.querySelectorAll('.ag-sv-rows tr.day').length")) === 1, JSON.stringify(ev));
    // Suche: Fokus bleibt, X erscheint, nur passende Zeilen
    await s.tap('#ag-sensor [data-sv="lq"]');
    await s.page.keyboard.type(t.q);
    check(`${tag}: Suche "${t.q}": nur "wieder in Ordnung", das Feld behält den Fokus, das X erscheint`, await s.waitFor(`const d=r.getElementById("ag-sensor"); const tr=[...d.querySelectorAll('.ag-sv-rows tbody tr:not(.day)')];
      return tr.length === 1 && tr[0].dataset.kind === 'ok' && r.activeElement === d.querySelector('[data-sv="lq"]') && !d.querySelector('[data-sv="lq-clear"]').hidden`));
    await s.page.keyboard.type(" zzz");
    check(`${tag}: nichts passt: Hinweis "${t.noMatch}" statt der Tabelle, die Reiter bleiben`, await s.waitFor(`const d=r.getElementById("ag-sensor"); return !d.querySelector('.ag-sv-rows table') && d.querySelector('.ag-sv-rows').innerText.includes(${JSON.stringify(t.noMatch)}) && d.querySelectorAll('[data-sv="pane"]').length === 2`));
    await s.tap('#ag-sensor [data-sv="lq-clear"]');
    check(`${tag}: X leert die Suche: beide Ereignisse wieder da, Fokus im Feld, X versteckt`, await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.querySelectorAll('.ag-sv-rows tbody tr:not(.day)').length === 2 && d.querySelector('[data-sv="lq"]').value === '' && d.querySelector('[data-sv="lq-clear"]').hidden && r.activeElement === d.querySelector('[data-sv="lq"]')`));
    // Sortieren
    await s.tap('#ag-sensor [data-sv="lsort"][data-key="time"]');
    ev = await rows();
    check(`${tag}: "Zeit" noch einmal: älteste zuerst, Tageszeile bleibt, Pfeil nach oben`, ev[0]?.kind === "out" && ev[1]?.kind === "ok" && (await dlg("return d.querySelectorAll('.ag-sv-rows tr.day').length === 1 && d.querySelector('.ag-sv-rows th[aria-sort=\"ascending\"] [data-key=\"time\"]') !== null")), JSON.stringify(ev));
    await s.tap('#ag-sensor [data-sv="lsort"][data-key="event"]');
    const byEvent = await dlg("return { days: d.querySelectorAll('.ag-sv-rows tr.day').length, time: d.querySelector('.ag-sv-rows tbody tr td').innerText.trim(), on: d.querySelector('.ag-sv-rows th[aria-sort=\"ascending\"] [data-key]')?.dataset.key }");
    check(`${tag}: nach "Ereignis" sortiert: aufsteigend, ohne Tageszeilen, der Tag steht bei der Uhrzeit`, byEvent.days === 0 && byEvent.on === "event" && /,/.test(byEvent.time), JSON.stringify(byEvent));
    if (!mobile) {
      await s.tap('#ag-sensor [data-sv="lsort"][data-key="value"]');
      ev = await rows();
      check(`${tag}: nach "Stand" sortiert: ${lang === "de" ? "6,1" : "6.1"} °C vor ${lang === "de" ? "9,2" : "9.2"} °C`, ev[0]?.text.includes(lang === "de" ? "6,1 °C" : "6.1 °C") && ev[1]?.text.includes(lang === "de" ? "9,2 °C" : "9.2 °C"), JSON.stringify(ev));
    }

    // ----- Reiter "Regeln" -----
    await s.tap('#ag-sensor [data-sv="pane"][data-pane="rules"]');
    check(`${tag}: Reiter "${t.rules}": Spalte "${t.col}", eine Regel mit Bedingung in Worten, Zustand "${t.on}", runder Pfeil; Suchfeld "${t.searchRules}" leer`, await s.waitFor(`const d=r.getElementById("ag-sensor"); const tr=[...d.querySelectorAll('.ag-sv-rows tbody tr[data-rule]')];
      return tr.length === 1 && tr[0].dataset.rule === 'm_kuehl' && d.querySelector('.ag-sv-rows thead th').innerText.trim() === ${JSON.stringify(t.col)} && tr[0].querySelector('.ag-sv-rule b').textContent === 'Kühlschrank zu warm'
        && /8 °C/.test(tr[0].querySelector('.ag-sv-rule small').textContent) && tr[0].querySelector('.ag-sv-state.on')?.textContent.trim() === ${JSON.stringify(t.on)} && !!tr[0].querySelector('.ag-cbtn[data-sv="rule"]:not([disabled])')
        && d.querySelector('[data-sv="lq"]').placeholder === ${JSON.stringify(t.searchRules)} && d.querySelector('[data-sv="lq"]').value === '' && d.querySelector('[data-sv="pane"][data-pane="rules"]').classList.contains('on')`));
    await s.tap('#ag-sensor [data-sv="lq"]');
    await s.page.keyboard.type("Garagentor");
    check(`${tag}: Suche in den Regeln: nichts passt (die Regel nennt das Garagentor nicht)`, await s.waitFor(`return r.getElementById("ag-sensor").querySelector('.ag-sv-rows').innerText.includes(${JSON.stringify(t.noMatch)})`));
    await s.tap('#ag-sensor [data-sv="pane"][data-pane="events"]');
    check(`${tag}: jeder Reiter hat seine eigene Suche: bei den Ereignissen leer, beide Ereignisse da`, await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.querySelector('[data-sv="lq"]').value === '' && d.querySelectorAll('.ag-sv-rows tbody tr:not(.day)').length === 2`));
    await s.tap('#ag-sensor [data-sv="pane"][data-pane="rules"]');
    check(`${tag}: zurück bei "${t.rules}": deren Suche ist noch da`, await s.waitFor(`return r.getElementById("ag-sensor").querySelector('[data-sv="lq"]').value === 'Garagentor'`));
    await s.tap('#ag-sensor [data-sv="lq-clear"]');
    // Ausgeschaltete Regel
    await s.sim("window.__systems[0].monitors[0].enabled = false; return 1");
    await s.ev("return r.host._fetch().then(() => 1)");
    await s.ev("r.host.sensorView.render(); return 1");
    check(`${tag}: ausgeschaltete Regel: Zustand "${t.off}"`, await s.waitFor(`return r.getElementById("ag-sensor").querySelector('.ag-sv-rows tr[data-rule="m_kuehl"] .ag-sv-state.off')?.textContent.trim() === ${JSON.stringify(t.off)}`));
    await s.sim("window.__systems[0].monitors[0].enabled = true; return 1");
    await s.ev("return r.host._fetch().then(() => 1)");
    check(`${tag}: keine Fehler bis hier`, s.errors.length === 0, s.errors.join(" | "));

    // ----- Pfeil: zur Regel -----
    await s.ev("r.host.sensorView.render(); return 1");
    await s.tap('#ag-sensor .ag-sv-rows [data-sv="rule"]');
    check(`${tag}: Pfeil: Fenster zu, Konfiguration › Aktionen › Überwachung, die Regel aufgeklappt und markiert`, await s.waitFor(`const sec=r.querySelector('.ag-mon-rule[data-rule-id="m_kuehl"]');
      return !r.getElementById('ag-sensor').open && r.host._tab === 'config' && r.host._sub === 'actions' && r.host.actions.trigger === 'monitor' && !!sec && !sec.classList.contains('folded') && sec.classList.contains('ag-flash')`, 6000));
    const where = await s.ev(`const sec=r.querySelector('.ag-mon-rule[data-rule-id="m_kuehl"]').getBoundingClientRect(); const c=r.host._content.getBoundingClientRect();
      const fixed=Math.max(c.top, ...[...r.host._content.querySelectorAll('.ag-stk')].map((x) => x.getBoundingClientRect().bottom)); return { top: Math.round(sec.top), fixed: Math.round(fixed), bottom: Math.round(c.bottom) }`);
    check(`${tag}: die Regel beginnt knapp unter den festen Leisten (nicht verdeckt, nicht weit unten)`, where.top >= where.fixed && where.top <= where.fixed + 40 && where.top < where.bottom - 100, JSON.stringify(where));
    check(`${tag}: die Markierung verschwindet nach kurzer Zeit`, await s.waitFor("return !r.querySelector('.ag-mon-rule.ag-flash')", 4000));

    // ----- Andere Anlage gewählt, mit offener Änderung: Rückfrage -----
    await s.ev("r.host._sel = 'e_garage'; r.host._resetConfig(); r.host._tab = 'config'; r.host._sub = 'system'; r.host._render(); return 1");
    await s.waitFor("return !!r.querySelector('[data-sys=\"permode\"]')");
    await s.ev("r.querySelector('[data-sys=\"permode\"]').click(); return 1");
    await s.waitFor("return r.host._dirty()");
    await openView(TEMP);
    await s.tap('#ag-sensor [data-sv="pane"][data-pane="rules"]');
    await s.waitFor(`return !!r.getElementById("ag-sensor").querySelector('.ag-sv-rows [data-sv="rule"]')`);
    await s.tap('#ag-sensor .ag-sv-rows [data-sv="rule"]');
    check(`${tag}: andere Anlage mit offener Änderung: Rückfrage, die Anlage bleibt bis dahin`, await s.waitFor("return r.getElementById('ag-discard').open && r.host._sel === 'e_garage'"));
    await s.tap('#ag-discard [data-act="keep"]');
    check(`${tag}: "Weiter bearbeiten": bleibt bei der Garage, die Änderung bleibt`, await s.waitFor("return !r.getElementById('ag-discard').open && r.host._sel === 'e_garage' && r.host._dirty()"));
    await openView(TEMP);
    await s.tap('#ag-sensor [data-sv="pane"][data-pane="rules"]');
    await s.waitFor(`return !!r.getElementById("ag-sensor").querySelector('.ag-sv-rows [data-sv="rule"]')`);
    await s.tap('#ag-sensor .ag-sv-rows [data-sv="rule"]');
    await s.waitFor("return r.getElementById('ag-discard').open");
    await s.tap('#ag-discard [data-act="discard"]');
    check(`${tag}: "Verwerfen": wechselt zum Haus, zur Regel aufgeklappt`, await s.waitFor("const sec=r.querySelector('.ag-mon-rule[data-rule-id=\"m_kuehl\"]'); return r.host._sel === 'e_haus' && !r.host._dirty() && r.host._sub === 'actions' && !!sec && !sec.classList.contains('folded')", 6000));

    // ----- Ja/Nein-Sensor in einer Regel, gerade ausserhalb -----
    await openView(GATE);
    check(`${tag}: Ja/Nein-Sensor in einer Regel: dieselben Reiter, die Ereignisse sind sortierbar`, await dlg("return d.querySelectorAll('.ag-sv-lbar [data-sv=\"pane\"]').length === 2 && !!d.querySelector('.ag-sv-rows th [data-sv=\"lsort\"][data-key=\"time\"]')"));
    await s.tap('#ag-sensor [data-sv="pane"][data-pane="rules"]');
    check(`${tag}: Garagentor: Regel "Kühlschranktür offen" mit Zustand "${t.out}"`, await s.waitFor(`const tr=r.getElementById("ag-sensor").querySelector('.ag-sv-rows tr[data-rule="m_tuer"]'); return !!tr && tr.querySelector('.ag-sv-state.out')?.textContent.trim() === ${JSON.stringify(t.out)}`));
    // ----- Sensor ausserhalb der Überwachung: unverändert -----
    await openView(DOOR);
    check(`${tag}: Sensor ohne Regel (Haustür): keine Reiter, kein Suchfeld, Tabellenkopf ohne Sortierung wie bisher`, await dlg("return !d.querySelector('.ag-sv-lbar') && !d.querySelector('[data-sv=\"lsort\"]') && !!d.querySelector('.ag-sv-table th')"));
    // ----- Messwert ohne Regel: Reiter mit Hinweis -----
    await openView(HUM);
    await s.tap('#ag-sensor [data-sv="pane"][data-pane="rules"]');
    check(`${tag}: Messwert ohne Regel: Reiter "${t.rules}" (0) mit Hinweis`, await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.querySelector('[data-pane="rules"] .ag-sv-n').textContent.trim() === '0' && d.querySelector('[data-pane="rules"]').innerText.includes(${JSON.stringify(t.rules)}) && d.querySelector('.ag-sv-rows').innerText.includes(${JSON.stringify(t.none)})`));

    // ----- Grenze weit weg: trotzdem zu sehen -----
    await s.sim("window.__systems[0].monitors[0].tree.items[0].limit = 40; return 1");
    await s.ev("return r.host._fetch().then(() => 1)");
    await openView(TEMP);
    const chart = await dlg(`const svg=d.querySelector('.ag-sv-chart svg'); const thr=svg.querySelector('line.sv-thr'); const ys=[...svg.querySelectorAll('line.sv-grid')].map((g) => +g.getAttribute('y1'));
      const labels=[...svg.querySelectorAll('text')].map((x) => x.textContent); return { thr: svg.querySelectorAll('line.sv-thr').length, y: thr ? +thr.getAttribute('y1') : null, top: Math.min(...ys), bottom: Math.max(...ys), label: labels.find((x) => /40/.test(x) && /°C/.test(x)) || null }`);
    check(`${tag}: Grenze 40 °C (Werte um 5 °C): die Linie steht in der Grafik, beschriftet "${t.limit}"`, chart.thr === 1 && chart.y >= chart.top - 1 && chart.y <= chart.bottom && chart.label === t.limit, JSON.stringify(chart));
    await s.sim("window.__systems[0].monitors[0].tree.items[0].limit = 8; return 1");
    check(`${tag}: kein seitliches Scrollen im Fenster`, await dlg("return d.scrollWidth <= d.clientWidth + 1"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
