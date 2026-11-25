// Voreinstellungen gezielt auf Sensoren anwenden (1.91.0, Wunsch des Nutzers 2026-11-25, Mockup docs/mockups/voreinstellungen-anwenden-v1, Variante A):
// statt des Schalters "Auf alle Sensoren anwenden" ein Knopf im Fenster "Voreinstellungen je Sensorart"; er öffnet ein Fenster mit allen Sensoren, deren
// eigene Werte von den Voreinstellungen (im Fenster, auch ungespeichert) abweichen, je mit "bisher → neu", gruppiert nach Sensorart, mit Suche und
// denselben Pillen wie die Sensortabelle, alle vorgewählt. "Übernehmen" merkt die Wahl ("Noch nicht gespeichert"), gelöscht wird erst mit "Speichern"
// der Voreinstellungen, und nur bei den gewählten Sensoren (je Anlage). Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const J = JSON.stringify;
const T = {
  de: { btn: "Sensoren wählen (7)", hint: "7 Sensoren haben eigene Werte", all: "Alle 7 Sensoren", filtered: "4 von 7 Sensoren (Filter)", chosen6: "6 von 7 gewählt", ok6: "Übernehmen (6)",
    rowChosen: "Beim Speichern übernehmen 5 von 7 Sensoren", rowChosen6: "5 von 6 Sensoren", unsaved: "Noch nicht gespeichert", keep: "Eigene Eingangsverzögerung 45 s bleibt",
    arm: "Scharf, sobald geschlossen", close: "Muss beim Scharfschalten geschlossen sein", away: "Abwesend", on: "an", off: "aus", busy: "Zuerst die Änderungen unter Sensoren",
    saved: "5 Sensoren folgen ihnen wieder", noChanges: "Keine Änderungen", none: "Kein Sensor passt zur Suche" },
  en: { btn: "Choose sensors (7)", hint: "7 sensors have own values", all: "All 7 sensors", filtered: "4 of 7 sensors (filter)", chosen6: "6 of 7 chosen", ok6: "Apply (6)",
    rowChosen: "When saving, 5 of 7 sensors take the defaults", rowChosen6: "5 of 6 sensors", unsaved: "Not saved yet", keep: "Own entry delay 45 s stays",
    arm: "Arm as soon as closed", close: "Must be closed when arming", away: "Away", on: "on", off: "off", busy: "First save or cancel the changes under Sensors",
    saved: "5 sensors follow them again", noChanges: "No changes", none: "No sensor matches the search" },
};
// Eigene Werte (erfundene Daten wie im Mockup): sieben weichen ab, der Rauchmelder gleicht der Voreinstellung ("Immer aktiv" an)
const SETUP = `const H = window.__systems[0], G = window.__systems[1];
  H.sensor_options = { "binary_sensor.haustuer": { arm_on_close: false, entry_delay: 45 }, "binary_sensor.terrassentuer": { offline_alarm: true },
    "binary_sensor.fenster_kueche": { open_ok: true }, "binary_sensor.fenster_bad": { confirm: true }, "binary_sensor.bewegung_flur": { confirm: true },
    "binary_sensor.rauchmelder_flur": { always: true }, "binary_sensor.wasser_keller": { report_only: true } };
  H.sensor_modes = { away: { "binary_sensor.fenster_kueche": { reachable: false } } };
  G.sensor_options = { "binary_sensor.bewegung_garage": { reachable: false } };
  return 1;`;
const ROWS = "return [...r.querySelectorAll('#ag-papply .ag-papply-row')].map((x) => ({ key: x.dataset.key, on: x.querySelector('[data-sen=\"papply-toggle\"]').getAttribute('aria-checked') === 'true', text: x.innerText }))";
const FOOT = "const d=r.getElementById('ag-papply'); return { count: d.querySelector('.ag-papply-count')?.innerText.trim(), ok: d.querySelector('[data-sen=\"papply-ok\"]')?.innerText.trim(), head: d.querySelector('.ag-papply-all b')?.innerText.trim() }";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "sensors" } });
    await s.waitFor("return !!r.querySelector('[data-sen=\"presets\"]')", 10000);
    await s.sim(SETUP);
    await s.ev("return r.host._fetch().then(() => { r.host.sensors.reset(); r.host.sensors.render(); return 1; })");
    const openPresets = async () => {
      await s.tap('[data-sen="presets"]');
      await s.waitFor("return r.getElementById('ag-presets').open");
      await s.page.waitForTimeout(350);
    };
    await openPresets();

    // ----- Knopf: zählt nur echte Abweichungen (der Rauchmelder gleicht der Voreinstellung) -----
    const row = await s.ev("const x=r.querySelector('#ag-presets .ag-papplyrow'); return x ? { btn: x.querySelector('[data-sen=\"papply-open\"]')?.innerText.trim(), text: x.innerText, icon: !!x.querySelector(':scope > .ag-oav svg'), toggle: !!r.querySelector('#ag-presets .ag-toggle') } : null");
    check(`${tag}: Zeile mit Symbol und Knopf "${t.btn}", kein Schalter mehr`, row && row.btn === t.btn && row.text.includes(t.hint) && row.icon && !row.toggle, J(row));

    // ----- Fenster: alle vorgewählt, gruppiert, je Änderung "bisher → neu" -----
    await s.tap('#ag-presets [data-sen="papply-open"]');
    await s.waitFor("return r.getElementById('ag-papply').open");
    await s.page.waitForTimeout(350);
    let rows = await s.ev(ROWS);
    check(`${tag}: 7 Sensoren, alle gewählt, Rauchmelder nicht dabei, Bewegung Garage aus der zweiten Anlage dabei`, rows.length === 7 && rows.every((x) => x.on)
      && !rows.some((x) => x.key.endsWith("rauchmelder_flur")) && rows.some((x) => x.key === "e_garage|binary_sensor.bewegung_garage"), J(rows.map((x) => x.key)));
    const groups = await s.ev("return [...r.querySelectorAll('#ag-papply .ag-papply-grp [data-sen=\"papply-group\"]')].map((g) => g.dataset.kind).join()");
    check(`${tag}: Gruppen je Sensorart in der Reihenfolge der Voreinstellungen`, groups === "door,window,motion,environment", groups);
    const door = rows.find((x) => x.key.endsWith("haustuer"))?.text || "";
    check(`${tag}: Haustür: "${t.arm}" ${t.off} → ${t.on}, die eigene Eingangsverzögerung bleibt`, door.includes(t.arm) && door.includes(t.keep), door);
    const kitchen = await s.ev("const x=[...r.querySelectorAll('#ag-papply .ag-papply-row')].find((y) => y.dataset.key.endsWith('fenster_kueche')); return [...x.querySelectorAll('.ag-papply-chg')].map((c) => ({ text: c.querySelector('.ag-papply-opt').innerText, mode: c.querySelector('.ag-papply-mode')?.innerText || '', from: c.querySelector('.ag-papply-old').innerText, to: c.querySelector('.ag-papply-new').innerText }))");
    check(`${tag}: Fenster Küche: "${t.close}" ${t.off} → ${t.on} (umgekehrt wie gespeichert) und ein Wert nur für "${t.away}"`, kitchen.length === 2 && kitchen[0].text === t.close && kitchen[0].from === t.off && kitchen[0].to === t.on && !kitchen[0].mode && kitchen[1].mode === t.away, J(kitchen));
    const pills = await s.ev("return [...r.querySelectorAll('#ag-papply [data-sen=\"papply-filter\"]')].map((b) => b.dataset.filter).join()");
    check(`${tag}: Pillen wie in der Sensortabelle, nur vorkommende Arten`, pills === "all,openings,motion,water", pills);
    let foot = await s.ev(FOOT);
    check(`${tag}: Kopf "${t.all}"`, foot.head === t.all, J(foot));

    // ----- Keine, Alle; Filter; einzeln und je Art -----
    await s.tap('#ag-papply [data-sen="papply-none"]');
    check(`${tag}: "Keine" wählt alle ab`, (await s.ev(ROWS)).every((x) => !x.on));
    await s.tap('#ag-papply [data-sen="papply-allon"]');
    check(`${tag}: "Alle" wählt alle wieder`, (await s.ev(ROWS)).every((x) => x.on));
    await s.tap('#ag-papply [data-sen="papply-filter"][data-filter="openings"]');
    rows = await s.ev(ROWS);
    foot = await s.ev(FOOT);
    check(`${tag}: Pille "Türen & Fenster": 4 Sensoren, Kopf "${t.filtered}"`, rows.length === 4 && foot.head === t.filtered, J({ n: rows.length, foot }));
    await s.tap('#ag-papply [data-sen="papply-toggle"][data-key="e_haus|binary_sensor.fenster_bad"]');
    foot = await s.ev(FOOT);
    const mixed = await s.ev("return !!r.querySelector('#ag-papply [data-sen=\"papply-group\"][data-kind=\"window\"] .ag-box.mixed') && !!r.querySelector('#ag-papply .ag-papply-all .ag-box.mixed')");
    check(`${tag}: Fenster Bad abgewählt: "${t.chosen6}", "${t.ok6}", Art und Kopf halb gewählt`, foot.count === t.chosen6 && foot.ok === t.ok6 && mixed, J(foot));
    await s.tap('#ag-papply [data-sen="papply-filter"][data-filter="water"]');
    await s.tap('#ag-papply [data-sen="papply-group"][data-kind="environment"]');
    check(`${tag}: ganze Art "Rauch, Wasser, Gas" abgewählt`, (await s.ev(ROWS)).every((x) => !x.on));
    await s.tap('#ag-papply [data-sen="papply-filter"][data-filter="all"]');
    // Suche: nur die Liste neu, der Fokus bleibt im Feld
    await s.tap('#ag-papply [data-sen="papply-q"]');
    await s.page.keyboard.type(lang === "de" ? "küche" : "Küche");
    check(`${tag}: Suche findet Fenster Küche, Fokus bleibt`, await s.waitFor("const rows=[...r.querySelectorAll('#ag-papply .ag-papply-row')]; return rows.length === 1 && rows[0].dataset.key.endsWith('fenster_kueche') && r.activeElement === r.querySelector('#ag-papply [data-sen=\"papply-q\"]')"));
    await s.page.keyboard.type("xyz");
    check(`${tag}: ohne Treffer "${t.none}"`, await s.waitFor(`return (r.querySelector('#ag-papply .ag-papply-list')?.innerText || '').includes(${J(t.none)})`));
    await s.tap('#ag-papply [data-sen="papply-q-clear"]');
    check(`${tag}: X leert die Suche, alle 7 wieder da, Wahl bleibt (5)`, await s.waitFor("const rows=[...r.querySelectorAll('#ag-papply .ag-papply-row')]; return rows.length === 7 && rows.filter((x) => x.querySelector('[aria-checked=\"true\"]')).length === 5"));
    // Grösse: am Computer fest hoch, nur die Liste scrollt; auf dem Handy Vollbild; nie seitlich hinaus
    const box = await s.ev("const d=r.getElementById('ag-papply').getBoundingClientRect(); const l=r.querySelector('#ag-papply .ag-papply-list'); return { h: Math.round(d.height), w: Math.round(d.width), vw: innerWidth, vh: innerHeight, side: r.getElementById('ag-papply').querySelector('.ag-dlg-body').scrollWidth > r.getElementById('ag-papply').querySelector('.ag-dlg-body').clientWidth + 1, list: l.clientHeight }");
    check(`${tag}: ${mobile ? "Vollbild" : "fest hoch (900 px, höchstens 92 %)"}, nichts ragt seitlich hinaus`, (mobile ? box.w === box.vw && Math.abs(box.h - box.vh) <= 1 : Math.abs(box.h - Math.min(box.vh * 0.92, 900)) <= 1) && !box.side && box.list > 100, J(box));
    // X mit geänderter Wahl fragt
    await s.tap('#ag-papply .ag-dlg-x');
    check(`${tag}: X mit geänderter Wahl fragt vor dem Verwerfen`, await s.waitFor("return r.getElementById('ag-confirm').open && r.getElementById('ag-papply').open"));
    await s.tap('#ag-confirm [data-c="no"]');
    await s.waitFor("return !r.getElementById('ag-confirm').open");

    // ----- Übernehmen: Zeile mit der Wahl, noch nichts gespeichert -----
    await s.tap('#ag-papply [data-sen="papply-ok"]');
    await s.waitFor("return !r.getElementById('ag-papply').open");
    const chosen = await s.ev("const x=r.querySelector('#ag-presets .ag-papplyrow'); return { chosen: x.classList.contains('chosen'), text: x.innerText, btns: [...x.querySelectorAll('button')].map((b) => b.dataset.sen).join() }");
    check(`${tag}: Zeile "${t.rowChosen}", "${t.unsaved}", Verwerfen und Auswahl ändern`, chosen.chosen && chosen.text.includes(t.rowChosen) && chosen.text.includes(t.unsaved) && chosen.btns === "papply-discard,papply-open", J(chosen));
    check(`${tag}: noch nichts an den Server`, !(await s.sim("return window.__calls.some((c) => c.type === 'alarmageddon/save_presets')")));
    // Auswahl ändern zeigt die gemerkte Wahl (5), nicht alle
    await s.tap('#ag-presets [data-sen="papply-open"]');
    await s.waitFor("return r.getElementById('ag-papply').open");
    check(`${tag}: "Auswahl ändern" öffnet mit der gemerkten Wahl`, (await s.ev(ROWS)).filter((x) => x.on).length === 5);
    await s.tap('#ag-papply [data-sen="papply-cancel"]');
    check(`${tag}: Abbrechen ohne Änderung schliesst sofort`, await s.waitFor("return !r.getElementById('ag-papply').open && !r.getElementById('ag-confirm').open"));
    // Eine geänderte Voreinstellung hebt eine Abweichung auf: Fenster Bad ("zweiter Sensor" an) zählt nicht mehr, die Wahl bleibt
    await s.tap('#ag-presets [data-sen="preset"][data-kind="window"][data-key="confirm"]');
    check(`${tag}: Voreinstellung geändert: "${t.rowChosen6}"`, await s.waitFor(`return (r.querySelector('#ag-presets .ag-papplyrow')?.innerText || '').includes(${J(t.rowChosen6)})`));
    await s.tap('#ag-presets [data-sen="preset"][data-kind="window"][data-key="confirm"]');
    // Mit gemerkter Wahl fragt X der Voreinstellungen vor dem Verwerfen
    await s.tap('#ag-presets .ag-dlg-x');
    check(`${tag}: X der Voreinstellungen mit Wahl fragt`, await s.waitFor("return r.getElementById('ag-confirm').open"));
    await s.tap('#ag-confirm [data-c="no"]');
    await s.waitFor("return !r.getElementById('ag-confirm').open");

    // ----- Speichern: nur die gewählten Sensoren je Anlage -----
    await s.tap('#ag-presets [data-sen="presets-save"]');
    await s.waitFor("return !r.getElementById('ag-presets').open", 8000);
    const sent = await s.sim("const c=window.__calls.filter((x) => x.type === 'alarmageddon/save_presets').at(-1); return { reset: Object.fromEntries(Object.entries(c.reset_entities || {}).map(([k, v]) => [k, [...v].sort()])), kinds: c.reset_sensors || null }");
    check(`${tag}: gesendet: Haus (Haustür, Terrassentür, Fenster Küche, Bewegung Flur) und Garage (Bewegung Garage), keine Sensorarten`, J(sent.reset) === J({ e_haus: ["binary_sensor.bewegung_flur", "binary_sensor.fenster_kueche", "binary_sensor.haustuer", "binary_sensor.terrassentuer"], e_garage: ["binary_sensor.bewegung_garage"] }) && sent.kinds === null, J(sent));
    const after = await s.sim("const H=window.__systems[0]; return { own: H.sensor_options, modes: H.sensor_modes }");
    check(`${tag}: Haustür behält nur die Eingangsverzögerung, Fenster Bad, Wassermelder und Rauchmelder ihre Werte`, J(after.own) === J({ "binary_sensor.haustuer": { entry_delay: 45 }, "binary_sensor.fenster_bad": { confirm: true }, "binary_sensor.rauchmelder_flur": { always: true }, "binary_sensor.wasser_keller": { report_only: true } }), J(after));
    check(`${tag}: Meldung "${t.saved}"`, await s.waitFor(`return (r.querySelector('.ag-toast')?.innerText || '').includes(${J(t.saved)})`, 5000));
    await s.page.waitForTimeout(1200);
    check(`${tag}: die Seite Sensoren hat danach keine ungespeicherte Änderung (bis 1.90.0 standen die alten Werte als Änderung da)`, await s.waitFor(`return r.host.sensors.dirtyCount() === 0 && !r.querySelector('[data-sub="sensors"]').classList.contains('has-edit') && r.querySelector('.ag-foot')?.innerText.includes(${J(t.noChanges)})`, 5000));

    // ----- Verwerfen: nichts wird zurückgesetzt -----
    await openPresets();
    await s.tap('#ag-presets [data-sen="papply-open"]');
    await s.waitFor("return r.getElementById('ag-papply').open");
    await s.tap('#ag-papply [data-sen="papply-ok"]');
    await s.waitFor("return !!r.querySelector('#ag-presets .ag-papplyrow.chosen')");
    await s.tap('#ag-presets [data-sen="papply-discard"]');
    check(`${tag}: Verwerfen: wieder der Knopf`, await s.waitFor("return !r.querySelector('#ag-presets .ag-papplyrow.chosen') && !!r.querySelector('#ag-presets [data-sen=\"papply-open\"]')"));
    await s.tap('#ag-presets [data-sen="presets-save"]');
    await s.waitFor("return !r.getElementById('ag-presets').open", 8000);
    check(`${tag}: nach Verwerfen sendet Speichern keine Sensoren`, await s.sim("return !window.__calls.filter((x) => x.type === 'alarmageddon/save_presets').at(-1).reset_entities"));

    // ----- Offene Änderungen der Seite Sensoren: erst speichern oder verwerfen -----
    await s.page.waitForTimeout(800);
    await s.ev("r.host.sensors.ensureDraft().opts['binary_sensor.fenster_bad'] = { confirm: false }; r.host.sensors.render(); return 1");
    await openPresets();
    const busy = await s.ev("const x=r.querySelector('#ag-presets .ag-papplyrow'); return { disabled: x.querySelector('[data-sen=\"papply-open\"]').disabled, warn: x.querySelector('.ag-warntext')?.innerText || '' }");
    check(`${tag}: mit offenen Änderungen der Seite ist der Knopf gesperrt, mit Hinweis`, busy.disabled && busy.warn.startsWith(t.busy), J(busy));
    await s.tap('#ag-presets [data-sen="presets-cancel"]');
    await s.waitFor("return !r.getElementById('ag-presets').open");
    await s.ev("r.host.sensors.draft = null; r.host.sensors.render(); return 1");

    // ----- Ohne Abweichung keine Zeile -----
    await s.sim("for (const x of window.__systems) { x.sensor_options = {}; x.sensor_modes = {}; } return 1");
    await s.ev("return r.host._fetch().then(() => { r.host.sensors.reset(); r.host.sensors.render(); return 1; })");
    await openPresets();
    check(`${tag}: ohne Abweichung keine Zeile "Auf Sensoren anwenden"`, await s.ev("return !r.querySelector('#ag-presets .ag-papplyrow')"));
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
