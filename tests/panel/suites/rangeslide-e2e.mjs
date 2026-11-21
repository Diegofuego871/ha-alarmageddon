// 1.73.0: Die Zeitraum-Leiste der Sensoransicht und des Protokolls der HealthCheck-Dienste ist eine Reiterleiste mit gleitender Kapsel wie überall
// (Wunsch des Nutzers 2026-11-21: "der soll rüberfahren"). Geprüft wird mit echten Bildern: nach dem Tipp liegen Zwischenstände der Kapsel zwischen
// alter und neuer Taste, am Ende liegt sie genau auf der gewählten Taste, und es bleibt genau eine Kapsel (auch nach dem Neuzeichnen beim Laden).
import { check, done, launch, open } from "../lib.mjs";

const SAMPLE = `window.__pillTrack = []; const bar = () => r.querySelector('__BAR__'); const t0 = performance.now();
  const tick = () => { const p = bar()?.querySelector(':scope > .ag-pill'); if (p) { const m = new DOMMatrixReadOnly(getComputedStyle(p).transform); window.__pillTrack.push(Math.round(m.m41 * 10) / 10); }
    if (performance.now() - t0 < 900) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1`;

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    // ----- Protokoll der HealthCheck-Dienste -----
    let s = await open(browser, { mobile, lang, theme: "dark", tab: "config", prefs: { sub: "system" }, query: "&hc=sample" });
    await s.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
    await s.tap('.ag-hcsum [data-hc="open"]');
    await s.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length >= 2");
    await s.tap('#ag-hclist [data-hc-row] [data-hc="log"]');
    await s.waitFor("const d=r.getElementById('ag-hclog'); return d.open && !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-range > .ag-pill')", 15000);
    await s.page.waitForTimeout(700);
    const BAR = "#ag-hclog .ag-sv-range";
    const start = await s.ev(`const b=r.querySelector('${BAR}'); const on=b.querySelector('button.on'); return { n: b.querySelectorAll(':scope > .ag-pill').length, x: on.offsetLeft, seg: b.classList.contains('ag-seg') }`);
    check(`${tag}: Protokoll: Zeitraum ist eine Reiterleiste mit genau einer Kapsel auf der gewählten Taste`, start.seg && start.n === 1, JSON.stringify(start));
    await s.ev(SAMPLE.replace("__BAR__", BAR));
    await s.tap(`${BAR} [data-sv="range"][data-hours="3"]`);
    await s.page.waitForTimeout(1100);
    const track = await s.ev("return window.__pillTrack");
    const end = await s.ev(`const b=r.querySelector('${BAR}'); const on=b.querySelector('button.on'); const p=b.querySelector(':scope > .ag-pill'); return { n: b.querySelectorAll(':scope > .ag-pill').length, x: on.offsetLeft, px: new DOMMatrixReadOnly(getComputedStyle(p).transform).m41, hours: on.dataset.hours }`);
    const mid = track.filter((x) => x > Math.min(start.x, end.x) + 2 && x < Math.max(start.x, end.x) - 2);
    check(`${tag}: Protokoll: die Kapsel fährt zur neuen Taste (${mid.length} Zwischenstände), landet genau darauf, und es bleibt eine`, end.hours === "3" && end.n === 1 && mid.length >= 3 && Math.abs(end.px - end.x) < 1.5, JSON.stringify({ start, end, mid: mid.slice(0, 6) }));
    check(`${tag}: Protokoll: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Sensoransicht -----
    s = await open(browser, { mobile, lang, theme: "dark" });
    const DOOR = "binary_sensor.haustuer";
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${DOOR}"]')`, 15000);
    await s.tap(`[data-act="more"][data-entity="${DOOR}"]`);
    const ok = await s.waitFor("const d=r.getElementById('ag-sensor'); return d.open && !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-chart svg') && d.querySelector('.ag-sv-range > .ag-pill')", 15000);
    if (ok) {
      await s.page.waitForTimeout(700);
      const B2 = "#ag-sensor .ag-sv-range";
      const st = await s.ev(`const b=r.querySelector('${B2}'); return { x: b.querySelector('button.on').offsetLeft, hours: b.querySelector('button.on').dataset.hours, first: b.querySelector('button').dataset.hours }`);
      await s.ev(SAMPLE.replace("__BAR__", B2));
      const target = st.hours === st.first ? await s.ev(`return [...r.querySelectorAll('${B2} button')].at(-1).dataset.hours`) : st.first;
      await s.tap(`${B2} [data-sv="range"][data-hours="${target}"]`);
      await s.page.waitForTimeout(1100);
      const tr = await s.ev("return window.__pillTrack");
      const en = await s.ev(`const b=r.querySelector('${B2}'); const on=b.querySelector('button.on'); const p=b.querySelector(':scope > .ag-pill'); return { n: b.querySelectorAll(':scope > .ag-pill').length, x: on.offsetLeft, px: new DOMMatrixReadOnly(getComputedStyle(p).transform).m41, hours: on.dataset.hours }`);
      const md = tr.filter((x) => x > Math.min(st.x, en.x) + 2 && x < Math.max(st.x, en.x) - 2);
      check(`${tag}: Sensoransicht: die Kapsel fährt zur neuen Taste (${md.length} Zwischenstände), landet genau darauf, und es bleibt eine`, en.hours === target && en.n === 1 && md.length >= 3 && Math.abs(en.px - en.x) < 1.5, JSON.stringify({ st, en, md: md.slice(0, 6) }));
    } else check(`${tag}: Sensoransicht öffnet`, false, "Fenster nicht offen");
    check(`${tag}: Sensoransicht: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
// ----- Messwert-Sensor (Überwachung an): Verlauf, Batterie und Empfang haben je eine Zeitraum-Leiste, auch dort fährt die Kapsel -----
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, theme: "dark", query: "&monitor=1" });
    const TEMP = "sensor.kuehlschrank_temperatur";
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${TEMP}"]')`, 15000);
    await s.tap(`[data-act="more"][data-entity="${TEMP}"]`);
    await s.waitFor("const d=r.getElementById('ag-sensor'); return d.open && !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-range > .ag-pill')", 15000);
    const tabs = await s.ev("return [...r.querySelectorAll('#ag-sensor .ag-sv-tile')].map((b) => b.dataset.tab)");
    for (const tab of tabs.filter((x) => ["value", "battery", "signal"].includes(x))) {
      if (!(await s.ev(`return r.querySelector('#ag-sensor .ag-sv-tile.on')?.dataset.tab === ${JSON.stringify(tab)}`))) await s.tap(`#ag-sensor .ag-sv-tile[data-tab="${tab}"]`);
      const there = await s.waitFor(`const d=r.getElementById('ag-sensor'); return d.querySelector('.ag-sv-tile.on')?.dataset.tab === ${JSON.stringify(tab)} && d.querySelector('.ag-sv-range > .ag-pill')`, 15000);
      if (!there) { check(`${tag}: Messwert ${tab}: Zeitraum-Leiste mit Kapsel`, false, "keine Leiste"); continue; }
      await s.page.waitForTimeout(700);
      const B = "#ag-sensor .ag-sv-range";
      const st = await s.ev(`const b=r.querySelector('${B}'); return { x: b.querySelector('button.on').offsetLeft, hours: b.querySelector('button.on').dataset.hours, first: b.querySelector('button').dataset.hours }`);
      await s.ev(SAMPLE.replace("__BAR__", B));
      const target = st.hours === st.first ? await s.ev(`return [...r.querySelectorAll('${B} button')].at(-1).dataset.hours`) : st.first;
      await s.tap(`${B} [data-sv="range"][data-hours="${target}"]`);
      await s.page.waitForTimeout(1100);
      const tr = await s.ev("return window.__pillTrack");
      const en = await s.ev(`const b=r.querySelector('${B}'); const on=b.querySelector('button.on'); const p=b.querySelector(':scope > .ag-pill'); return { n: b.querySelectorAll(':scope > .ag-pill').length, x: on.offsetLeft, px: new DOMMatrixReadOnly(getComputedStyle(p).transform).m41, hours: on.dataset.hours }`);
      const md = tr.filter((x) => x > Math.min(st.x, en.x) + 2 && x < Math.max(st.x, en.x) - 2);
      check(`${tag}: Messwert ${tab}: die Kapsel fährt zur neuen Taste (${md.length} Zwischenstände), landet genau darauf, und es bleibt eine`, en.hours === target && en.n === 1 && md.length >= 3 && Math.abs(en.px - en.x) < 1.5, JSON.stringify({ st, en, md: md.slice(0, 6) }));
    }
    check(`${tag}: Messwert: mindestens der Verlauf wurde geprüft`, tabs.includes("value"), JSON.stringify(tabs));
    check(`${tag}: Messwert: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
