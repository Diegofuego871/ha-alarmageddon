// 1.54.0: Messwert-Sensoren (Temperatur, Luftfeuchtigkeit, CO2) in der Übersicht und in der Sensoransicht. Bei eingeschalteter Überwachung stehen sie
// in der Übersicht (Wert mit Einheit statt Zustandswort), ein Klick öffnet dieselbe Ansicht wie bei den anderen Sensoren: Reiter "Verlauf" mit dem
// Werteverlauf als Grafik, Batterie, Empfang, Gerät; unten nur die Ereignisse der Überwachung. Aus: keine Messwerte in der Übersicht.
// Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { history: "Verlauf", battery: "Batterie", device: "Gerät", temp: "5,4 °C", out: "Ausserhalb der Grenzen", ok: "Wieder in Ordnung", limit: "Grenze 8 °C", monitor: "Überwachung", none: "Keine Ereignisse der Überwachung", measure: "Messwerte" },
  en: { history: "History", battery: "Battery", device: "Device", temp: "5.4 °C", out: "Outside the limits", ok: "Back to normal", limit: "Limit 8 °C", monitor: "Monitoring", none: "No events of the monitoring", measure: "Measurements" },
};
const TEMP = "sensor.kuehlschrank_temperatur";
const HUM = "sensor.keller_luftfeuchtigkeit";
const CO2 = "sensor.wohnzimmer_co2";
const DOOR = "binary_sensor.haustuer";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];

    // ----- Überwachung aus: keine Messwerte in der Übersicht -----
    let s = await open(browser, { mobile, lang });
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${DOOR}"]')`);
    check(`${tag}: Überwachung aus: keine Messwert-Sensoren in der Übersicht`, await s.ev(`return ![${[TEMP, HUM, CO2].map((e) => `'${e}'`)}].some((id) => r.querySelector('[data-act="more"][data-entity="' + id + '"]'))`));
    check(`${tag}: Überwachung aus: die Arten-Auswahl kennt keine Messwerte`, await s.ev(`return ![...r.querySelectorAll('[data-list="type"] option')].some((o) => o.value === 'measure')`));
    await s.ctx.close();

    // ----- Überwachung an -----
    s = await open(browser, { mobile, lang, query: "&monitor=1" });
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${TEMP}"]')`);
    // der Nachbau führt zwei Messwerte; den CO2-Sensor nimmt die Überwachung hier dazu
    await s.sim(`window.__systems[0].monitor_sensors.push(${JSON.stringify(CO2)}); return 1`);
    await s.ev("return r.host._fetch().then(() => 1)");
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${CO2}"]')`);
    const rowOf = (id) => `[data-act="more"][data-entity="${id}"]`;
    check(`${tag}: alle drei Messwert-Sensoren stehen in der Übersicht`, await s.ev(`return [${[TEMP, HUM, CO2].map((e) => `'${e}'`)}].every((id) => !!r.querySelector('[data-act="more"][data-entity="' + id + '"]'))`));
    check(`${tag}: der Zustand ist der Wert mit Einheit (${t.temp}), kein Zustandswort`, await s.ev(`return r.querySelector('${rowOf(TEMP)} .ag-tag').textContent.trim() === ${JSON.stringify(t.temp)}`));
    check(`${tag}: Messwert ohne Alarm: neutrale Marke, Zeile nicht hervorgehoben`, await s.ev(`const row=r.querySelector('${rowOf(TEMP)}'); return row.querySelector('.ag-tag').classList.contains('none') && !row.classList.contains('act')`));
    check(`${tag}: die Arten-Auswahl bietet "${t.measure}"`, await s.ev(`return [...r.querySelectorAll('[data-list="type"] option')].some((o) => o.value === 'measure' && o.textContent.trim() === ${JSON.stringify(t.measure)})`));
    await (await s.el('[data-list="type"]')).selectOption("measure");
    const filtered = await s.waitFor(`return [...r.querySelectorAll('[data-act="more"][data-entity^="sensor."]')].length === 3`);
    check(`${tag}: Filter "${t.measure}": genau die drei Messwerte`, filtered && (await s.ev("return [...r.querySelectorAll('[data-act=\"more\"][data-entity^=\"sensor.\"]')].map((x) => x.dataset.entity).sort().join()")) === [CO2, HUM, TEMP].sort().join());
    await (await s.el('[data-list="type"]')).selectOption("");

    // ----- Ansicht des Temperatursensors -----
    await s.tap(rowOf(TEMP));
    const dlg = (js) => s.ev(`const d=r.getElementById("ag-sensor"); ${js}`);
    const calls = () => s.sim(`return window.__calls.filter((c) => c.type === "alarmageddon/sensor_history").map((c) => [c.entity_id, c.kind, c.hours])`);
    await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector(".ag-sv-chart svg .sv-line")`);
    check(`${tag}: der Klick öffnet die Sensoransicht, Reiter "${t.history}" gewählt (erste Anfrage: Art "value", 24 Stunden)`, JSON.stringify((await calls())[0]) === JSON.stringify([TEMP, "value", 24]), JSON.stringify(await calls()));
    const tabs = await dlg("return [...d.querySelectorAll('[data-sv=\"tab\"]')].map((b) => [b.dataset.tab, b.querySelector('small').textContent.trim()])");
    check(`${tag}: Reiter ohne Batterie und Empfang: nur "${t.history}" und "${t.device}"`, JSON.stringify(tabs) === JSON.stringify([["value", t.history], ["device", t.device]]), JSON.stringify(tabs));
    check(`${tag}: die Kachel "${t.history}" zeigt den aktuellen Wert, die Kopfzeile ebenso`, await dlg(`return d.querySelector('[data-sv="tab"][data-tab="value"] b').textContent.trim() === ${JSON.stringify(t.temp)} && d.querySelector('.ag-sv-pill').textContent.trim() === ${JSON.stringify(t.temp)}`));
    check(`${tag}: Zeitraum wie bei den anderen Sensoren: 3 Std. bis 30 Tage, 1 Tag gewählt`, await dlg("const b=[...d.querySelectorAll('[data-sv=\"range\"]')]; return b.map((x) => x.dataset.hours).join() === '3,12,24,168,720' && b.find((x) => x.classList.contains('on')).dataset.hours === '24'"));
    const kpis = await dlg("return [...d.querySelectorAll('.ag-sv-kpi')].map((k) => [k.querySelector('b').textContent.trim(), k.querySelector('span').textContent.trim()])");
    check(`${tag}: Kennzahlen: aktuell, im Mittel, niedrigster${mobile ? "" : ", höchster"} Wert, mit Einheit`, kpis.length === (mobile ? 3 : 4) && kpis.every(([v]) => /°C/.test(v)), JSON.stringify(kpis));
    const chart = await dlg(`const svg=d.querySelector('.ag-sv-chart svg'); const labels=[...svg.querySelectorAll('text')].map((x) => x.textContent); const b=svg.getBoundingClientRect(); const box=d.querySelector('.ag-sv-chart').getBoundingClientRect();
      return { line: !!svg.querySelector('path.sv-line'), area: !!svg.querySelector('path.sv-area'), dot: !!svg.querySelector('circle.sv-dot'), grid: svg.querySelectorAll('line.sv-grid').length, thr: svg.querySelectorAll('line.sv-thr').length, labels, inside: b.left >= box.left - 1 && b.right <= box.right + 1 }`);
    check(`${tag}: Grafik: Linie, Fläche, Punkt für den letzten Wert, mindestens drei Gitterlinien`, chart.line && chart.area && chart.dot && chart.grid >= 3, JSON.stringify(chart));
    check(`${tag}: die oberste Achsenbeschriftung trägt die Einheit (°C), die anderen nur Zahlen`, chart.labels.filter((x) => /^[\d.,\-]+ °C$/.test(x)).length === 1 && chart.labels.filter((x) => /^[\d.,\-]+$/.test(x)).length >= 2, JSON.stringify(chart.labels));
    check(`${tag}: die Grenze der Regel steht als gestrichelte Linie mit "${t.limit}" da`, chart.thr === 1 && chart.labels.includes(t.limit), JSON.stringify(chart.labels));
    check(`${tag}: Grafik liegt im Rahmen`, chart.inside);
    // Ereignisse der Überwachung
    const events = await dlg("return [...d.querySelectorAll('.ag-sv-table tbody tr:not(.day)')].map((tr) => [tr.dataset.kind, tr.innerText.replace(/\\s+/g, ' ').trim()])");
    check(`${tag}: unten nur zwei Ereignisse der Überwachung (neuestes zuerst): wieder in Ordnung, ausserhalb`, events.length === 2 && events[0][0] === "ok" && events[1][0] === "out" && events[0][1].includes(t.ok) && events[1][1].includes(t.out), JSON.stringify(events));
    // Stand im Format der Sprache (1.64.0: bis dahin "9.2 °C" auch auf Deutsch, so wie der Server ihn ablegt)
    check(`${tag}: die Ereignisse nennen Wert (${lang === "de" ? "9,2" : "9.2"} °C) und Regel`, events[1][1].includes(lang === "de" ? "9,2 °C" : "9.2 °C") && !(lang === "de" && events[1][1].includes("9.2")) && events[1][1].includes("Kühlschrank zu warm"), events[1]?.[1]);
    check(`${tag}: keine Messwerte als Zeilen (nur die zwei Ereignisse)`, (await dlg("return d.querySelectorAll('.ag-sv-table tbody tr:not(.day)').length")) === 2);
    // Zeitraum wechseln lädt neu, gleiche Art
    await s.tap('#ag-sensor [data-sv="range"][data-hours="168"]');
    await s.waitFor(`return ${JSON.stringify(null)} === null && !r.getElementById('ag-sensor').querySelector('[data-busy]')`);
    check(`${tag}: 7 Tage: neue Anfrage, Art "value"`, JSON.stringify((await calls()).at(-1)) === JSON.stringify([TEMP, "value", 168]), JSON.stringify(await calls()));
    // Gerät: Überwachung als Ort
    await s.tap('#ag-sensor [data-sv="tab"][data-tab="device"]');
    check(`${tag}: Reiter Gerät: der Sensor wird von der Überwachung geführt (Marke "${t.monitor}")`, await s.waitFor(`return [...r.getElementById('ag-sensor').querySelectorAll('.ag-sv-chips .ag-sv-tag')].some((x) => x.textContent.trim() === ${JSON.stringify(t.monitor)})`));
    await s.tap('#ag-sensor > .ag-dlg-x');
    await s.waitFor("return !r.getElementById('ag-sensor').open");

    // ----- Luftfeuchtigkeit: mit Batterie -----
    await s.tap(rowOf(HUM));
    await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector(".ag-sv-chart svg .sv-line")`);
    const humTabs = await dlg("return [...d.querySelectorAll('[data-sv=\"tab\"]')].map((b) => b.dataset.tab).join()");
    check(`${tag}: Luftfeuchtigkeit: Verlauf, Batterie, Gerät (mit Batterie wie bei den anderen)`, humTabs === "value,battery,device", humTabs);
    check(`${tag}: Achse in Prozent`, (await dlg("return [...d.querySelectorAll('.ag-sv-chart svg text')].some((x) => /%/.test(x.textContent))")));
    check(`${tag}: ohne Regel keine Grenzlinie`, (await dlg("return d.querySelectorAll('.ag-sv-chart svg line.sv-thr').length")) === 0);
    check(`${tag}: ohne Ereignisse der Überwachung steht ein ruhiger Hinweis da`, await dlg(`return d.querySelector('.ag-sv-msg')?.textContent.includes(${JSON.stringify(t.none)})`));
    await s.tap('#ag-sensor [data-sv="tab"][data-tab="battery"]');
    check(`${tag}: Reiter Batterie wie bei den anderen Sensoren (Grafik mit Schwelle)`, await s.waitFor(`const d=r.getElementById("ag-sensor"); return !!d.querySelector('.ag-sv-chart svg .sv-thr') && d.querySelector('[data-sv="range"][data-hours="2160"]').classList.contains('on')`));
    await s.tap('#ag-sensor > .ag-dlg-x');
    await s.waitFor("return !r.getElementById('ag-sensor').open");

    // ----- CO2: ganze Zahlen -----
    await s.tap(rowOf(CO2));
    await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector(".ag-sv-chart svg .sv-line")`);
    check(`${tag}: CO2 in ppm, ganze Zahlen (Wert ${720})`, await dlg(`return d.querySelector('.ag-sv-pill').textContent.trim() === '720 ppm' && [...d.querySelectorAll('.ag-sv-chart svg text')].some((x) => /ppm/.test(x.textContent))`));
    await s.tap('#ag-sensor > .ag-dlg-x');
    await s.waitFor("return !r.getElementById('ag-sensor').open");

    // ----- Regel läuft: ausserhalb -----
    await s.sim(`window.__systems[0].monitor_active = { m1: { since: new Date().toISOString(), entity_id: ${JSON.stringify(TEMP)} } }; return 1`);
    await s.ev("return r.host._fetch().then(() => 1)");
    check(`${tag}: läuft eine Regel für den Sensor, ist die Marke gelb und die Zeile hervorgehoben`, await s.waitFor(`const row=r.querySelector('${rowOf(TEMP)}'); return !!row && row.querySelector('.ag-tag').classList.contains('warn') && row.classList.contains('act')`));
    check(`${tag}: der Filter "Probleme" zählt den Sensor mit`, await s.ev(`const c=r.querySelector('[data-list="filter"][data-filter="problems"] .ag-t2'); return Number(c.textContent) >= 1`));
    await s.tap(rowOf(TEMP));
    check(`${tag}: in der Ansicht ist die Kopfmarke hervorgehoben`, await s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && d.querySelector('.ag-sv-pill').classList.contains('act')`));
    await s.tap('#ag-sensor > .ag-dlg-x');

    check(`${tag}: kein Überlauf der Seite`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
