// 1.60.0: die Übersicht in einem grossen Haus mit laufend wechselnden Messwerten (Meldung des Nutzers, 2026-11-17: "träge, seit ich
// Temperatursensoren drin habe"). Ursache bis 1.59.0: jede Änderung irgendeines passenden Sensors des Hauses baute die ganze Liste neu
// auf, bis zu viermal je Sekunde, und die Antwort für die Übersicht nannte jeden solchen Sensor. Die Suite sichert:
// - "data" trägt nur die Sensoren der Anlagen; die Kandidaten kommen erst für "Sensoren hinzufügen",
// - Änderungen von Sensoren, die nirgends zu sehen sind, zeichnen nichts neu,
// - Messwerte, die zu sehen sind, werden gesammelt (höchstens alle 2 s), Zustände (Tür offen, Alarm) erscheinen sofort,
// - die Bedienung bleibt dabei möglich (ein Tipp öffnet die Sensoransicht).
// Mit ?realhass=1: hass kommt wie im echten Home Assistant nur über panel.html.
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
for (const mobile of [false, true]) {
  const tag = mobile ? "Handy" : "Desktop";
  const s = await open(browser, { mobile, lang: "de", query: "&realhass=1&monitor=1&house=300&housechosen=10&churn=100" });
  await s.waitFor("return r.host._loaded && !!r.querySelector('.ag-ov-list')");
  const counters = () => s.ev("return { ...window.__n }");
  await s.ev(`const h = r.host; window.__n = { list: 0, swap: 0 };
    const list = h._renderList.bind(h); h._renderList = (...a) => { window.__n.list += 1; return list(...a); };
    new MutationObserver((ms) => { window.__n.swap += ms.some((m) => m.addedNodes.length) ? 1 : 0; }).observe(r.querySelector('.ag-ov-list'), { childList: true });
    return 1`);

  // ----- Antwort für die Übersicht: nur die Sensoren der Anlagen -----
  const sent = await s.ev("return { sensors: Object.keys(r.host._data.sensors).length, house: Object.keys(r.host._data.sensors).filter((id) => id.startsWith('sensor.raum_')).length, candidates: r.host._candidates === undefined }");
  check(`${tag}: die Antwort für die Übersicht nennt nur die Sensoren der Anlagen (10 der 300 Messwerte des Hauses), keine Kandidaten`, sent.house === 10 && sent.sensors < 30 && sent.candidates
    && await s.sim("return !window.__calls.some((c) => c.type === 'alarmageddon/sensor_candidates')"), JSON.stringify(sent));

  // ----- 300 Messwerte wechseln reihum (10 je Sekunde), 290 davon sind nirgends zu sehen -----
  // Die 10 gezeigten sind nur in der ersten Sekunde jeder Runde von 30 Sekunden an der Reihe: abwarten, bis sie durch sind
  await s.waitFor("return window.parent.__churned % 300 > 20 && window.parent.__churned % 300 < 200", 40000);
  await s.page.waitForTimeout(2500); // ein gesammeltes Neuzeichnen der ersten Sekunde ist dann vorbei
  const before = await counters();
  await s.page.waitForTimeout(3000);
  const after = await counters();
  check(`${tag}: 30 Änderungen von Sensoren, die nirgends zu sehen sind: die Liste wird nicht neu gebaut und nicht ersetzt`, after.list === before.list && after.swap === before.swap, JSON.stringify([before, after]));

  // ----- Ein gezeigter Messwert wechselt zehnmal je Sekunde: gesammelt statt jedes Mal -----
  const b2 = await counters();
  for (let i = 0; i < 30; i++) {
    await s.sim(`window.__setState("sensor.raum_3_temperatur", "${(30 + i / 10).toFixed(1)}"); return 1`);
    await s.page.waitForTimeout(100);
  }
  const a2 = await counters();
  check(`${tag}: 30 Änderungen eines gezeigten Messwerts in 3 Sekunden: höchstens zweimal neu gezeichnet (vorher bei jeder Übernahme, viermal je Sekunde)`, a2.list - b2.list >= 1 && a2.list - b2.list <= 2, JSON.stringify([b2, a2]));
  check(`${tag}: der letzte Wert steht spätestens nach gut 2 Sekunden da`, await s.waitFor("return r.querySelector('.ag-ov-list').textContent.includes('32,9') || r.querySelector('.ag-ov-list').textContent.includes('32.9')", 3000), await s.ev("return r.querySelector('.ag-ov-list').textContent.slice(0, 400)"));

  // ----- Zustände erscheinen sofort, auch mitten im Wechsel der Messwerte -----
  const b3 = await counters();
  const t0 = Date.now();
  await s.sim('window.__setState("binary_sensor.fenster_kueche", "on"); return 1');
  const fast = await s.waitFor(`return window.__n.list > ${b3.list}`, 1500);
  check(`${tag}: ein Fenster geht auf: die Liste zeigt es sofort (${Date.now() - t0} ms, unter 700 ms)`, fast && Date.now() - t0 < 700);
  const t1 = Date.now();
  await s.sim('window.__setState("alarm_control_panel.haus", "triggered", { triggered_by: "binary_sensor.fenster_kueche" }); return 1');
  check(`${tag}: Alarm: das rote Band steht sofort da (${Date.now() - t1} ms)`, await s.waitFor("return !!r.querySelector('.ag-alarm, .ag-alarmband, [data-act=\"ack\"]')", 1500) && Date.now() - t1 < 900);
  await s.sim('window.__setState("alarm_control_panel.haus", "armed_away", { triggered_by: null }); return 1');

  // ----- Bedienung im laufenden Wechsel: ein Tipp auf einen Sensor öffnet seine Ansicht -----
  await s.ev("r.host.sensorView.open('sensor.raum_3_temperatur'); return 1");
  check(`${tag}: die Sensoransicht eines Messwerts öffnet`, await s.waitFor("return r.getElementById('ag-sensor').open"));
  await s.ev("r.getElementById('ag-sensor').close(); return 1");

  // ----- "Sensoren hinzufügen": die Kandidaten kommen erst jetzt, und ein neuer Messwert lässt sich wählen -----
  await s.tap('[data-act="config"], [data-tab="config"], [role="tab"][data-act="config"]').catch(() => {});
  await s.ev("if (r.host._tab !== 'config') { r.host._tab = 'config'; r.host._render(); } return 1");
  await s.waitFor("return !!r.querySelector('[data-sen=\"add\"]')");
  await s.tap('[data-sen="add"]');
  check(`${tag}: "Sensoren hinzufügen" holt die Kandidaten vom Server und zeigt die Messwerte des Hauses`, await s.waitFor("return r.getElementById('ag-pick').open && r.querySelectorAll('#ag-pick [data-sen=\"pick-toggle\"]').length > 250", 5000)
    && await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/sensor_candidates').length === 1"), await s.ev("return r.querySelectorAll('#ag-pick [data-sen=\"pick-toggle\"]').length"));
  await s.ev("r.querySelector('#ag-pick [data-sen=\"pick-toggle\"][data-ent=\"sensor.raum_250_temperatur\"]').click(); return 1");
  await s.tap('#ag-pick [data-sen="pick-add"]');
  check(`${tag}: der gewählte Messwert steht mit Namen in der Liste der Konfiguration (Überwachung), noch ungespeichert`, await s.waitFor("return !r.getElementById('ag-pick').open && r.host.sensors.draft.monitorSensors.has('sensor.raum_250_temperatur')")
    && await s.waitFor("return [...r.querySelectorAll('.ag-table tr, .ag-table-wrap tr')].some((tr) => tr.textContent.includes('Raum 250 Temperatur'))"), await s.ev("return r.host.sensors.draft ? [...r.host.sensors.draft.monitorSensors].length : -1"));
  check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}
await browser.close();
done();
