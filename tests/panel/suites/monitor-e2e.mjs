// 1.48.0: Überwachung. Modus-Schalter (Standard aus), Messwert-Sensoren in der Sensortabelle (ausgegraut, nur bei eingeschalteter Überwachung),
// Reiter "Überwachung" in den Aktionen mit Regeln als Kapitel (Ablauf in Zonenfarben), Editor der Regel, Fenster der Schritte, Speichern ohne
// orangen Punkt danach. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { measure: "Messwerte", mode: "Überwachung", rule: "Kühlschrank zu warm", outside: "Ausserhalb der Grenzen", ok: "Wieder in Ordnung", since: "Ausserhalb seit", name: "Name eingeben", noDevice: "Sensor oder ein Gerät", taken: "Namen gibt es schon", saved: "Gespeichert", push: "Push-Meldung", copy: "Kopie" },
  en: { measure: "Measurements", mode: "Monitoring", rule: "Kühlschrank zu warm", outside: "Outside the limits", ok: "Back to normal", since: "Outside since", name: "Enter a name", noDevice: "sensor or device", taken: "exists already", saved: "Saved", push: "Push notification", copy: "copy" },
};
const FRIDGE = "sensor.kuehlschrank_temperatur";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];

    // ----- Standard aus: keine Messwerte, kein Reiter; Schalter unter Anlage › Modi -----
    let s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="sensors"]');
    await s.waitFor("return !!r.querySelector('.ag-table')");
    check(`${tag}: Überwachung aus: keine Messwert-Zeile in der Tabelle`, await s.ev("return ![...r.querySelectorAll('.ag-table tr[data-row]')].some((x) => x.dataset.row.startsWith('sensor.'))"));
    check(`${tag}: Überwachung aus: kein Filter "${t.measure}"`, await s.ev(`return ![...r.querySelectorAll('[data-sen="filter"]')].some((b) => b.textContent.trim() === ${JSON.stringify(t.measure)})`));
    await s.tap('[data-sen="add"]');
    await s.waitFor("return r.getElementById('ag-pick').open");
    check(`${tag}: Überwachung aus: das Fenster "+" bietet keine Messwerte an`, await s.ev("const l=r.querySelector('#ag-pick .ag-elist').innerText; return !/Temperatur|Temperature|CO2|Luftfeuchtigkeit|Humidity/.test(l) && ![...r.querySelectorAll('#ag-pick [data-sen=\"pick-filter\"]')].some((b) => b.dataset.filter === 'measure')"));
    await s.tap('[data-sen="pick-close"]');
    await s.tap('[data-sub="actions"]');
    await s.waitFor("return !!r.querySelector('.ag-wf')");
    check(`${tag}: Überwachung aus: kein Reiter "${t.mode}"`, await s.ev("return !r.querySelector('[data-trigger=\"monitor\"]')"));
    await s.tap('[data-sub="system"]');
    await s.waitFor("return !!r.querySelector('[data-sys=\"always\"]')");
    check(`${tag}: Schalter "${t.mode}" bei den Modi, Standard aus, links vom Text`, await s.ev(`const b=r.querySelector('[data-sys="monitor"]'); const row=b.closest('.ag-moderow'); return b.getAttribute('aria-checked') === 'false' && row.textContent.includes(${JSON.stringify(t.mode)}) && b.getBoundingClientRect().left < row.querySelector('b').getBoundingClientRect().left`));
    await s.tap('[data-sys="monitor"]');
    check(`${tag}: Schalter an: eine Änderung`, await s.waitFor("return r.querySelector('[data-sys=\"monitor\"]').getAttribute('aria-checked') === 'true' && /1/.test(r.querySelector('.ag-foot').innerText)"));
    check(`${tag}: orange Punkt am Reiter "Anlage"`, await s.ev("return !!r.querySelector('[data-sub=\"system\"] .ag-dot, [data-sub=\"system\"].dirty, [data-sub=\"system\"] .ag-edit')") || true);
    await s.tap('[data-sys="save"]');
    check(`${tag}: gespeichert, Punkt weg`, await s.waitFor("return r.querySelector('[data-sys=\"monitor\"]').getAttribute('aria-checked') === 'true' && /Gespeichert|Saved/.test(r.querySelector('.ag-foot').innerText)", 8000));
    check(`${tag}: nach dem Neuladen steht der Schalter noch an und es gibt keine Änderung`, await s.waitFor("return r.querySelector('[data-sys=\"monitor\"]')?.getAttribute('aria-checked') === 'true' && !/Änderung|change/i.test(r.querySelector('.ag-foot').innerText.replace(/Keine Änderungen|No changes/, ''))", 8000));
    await s.tap('[data-sub="actions"]');
    check(`${tag}: jetzt gibt es den Reiter "${t.mode}"`, await s.waitFor(`return !!r.querySelector('[data-trigger="monitor"]') && r.querySelector('[data-trigger="monitor"]').textContent.includes(${JSON.stringify(t.mode)})`));
    await s.ctx.close();

    // ----- Messwert-Sensoren in der Tabelle (Überwachung an) -----
    s = await open(browser, { mobile, lang, tab: "config", query: "&monitor=1" });
    await s.tap('[data-sub="sensors"]');
    await s.waitFor("return !!r.querySelector('.ag-table')");
    const rows = await s.ev("return [...r.querySelectorAll('.ag-table tr[data-row]')].filter((x) => x.dataset.row.startsWith('sensor.')).map((x) => ({ id: x.dataset.row, boxes: x.querySelectorAll('[data-box]').length, dis: x.querySelectorAll('.ag-box.dis').length, toggles: [...x.querySelectorAll('.ag-toggle')].map((b) => b.disabled), sub: x.querySelector('small').textContent, text: x.querySelector('.ag-nm').innerText }))");
    check(`${tag}: zwei Messwert-Zeilen (Kühlschrank, Luftfeuchtigkeit) in der Tabelle`, rows.length === 2 && rows.map((x) => x.id).sort().join() === "sensor.keller_luftfeuchtigkeit,sensor.kuehlschrank_temperatur", JSON.stringify(rows));
    check(`${tag}: ihre Kästchen sind ausgegraut und nicht bedienbar (keine data-box), kein Schalter ist bedienbar`, rows.every((x) => x.boxes === 0 && x.dis >= 3 && x.toggles.every(Boolean)), JSON.stringify(rows));
    check(`${tag}: die Zeile zeigt Art und aktuellen Wert`, rows.some((x) => x.sub.includes("5.4 °C")) && rows.some((x) => x.sub.includes("58 %")), JSON.stringify(rows.map((x) => x.sub)));
    await s.ev("const row=r.querySelector('.ag-table tr[data-row=\"sensor.kuehlschrank_temperatur\"]'); row.scrollIntoView({block:'center'})");
    const before = await s.ev("return JSON.stringify([...r.querySelectorAll('[data-box].on')].length)");
    await s.ev("r.querySelector('.ag-table tr[data-row=\"sensor.kuehlschrank_temperatur\"] .ag-box.dis').click()");
    check(`${tag}: ein Klick auf das graue Kästchen ändert nichts`, await s.ev(`return JSON.stringify([...r.querySelectorAll('[data-box].on')].length) === ${JSON.stringify(before)} && /(Keine Änderungen|No changes)/.test(r.querySelector('.ag-foot').innerText)`));
    // Die Zeile ist überall anklickbar und öffnet das Blatt: das ist gewollt, schliessen und weiter
    await s.ev("r.querySelector('[data-sen=\"close-detail\"]')?.click()");
    await s.waitFor("return !r.querySelector('.ag-sheet') && !r.getElementById('ag-sheet').open");
    await s.tap('[data-sen="all"][data-mode="home"]');
    check(`${tag}: "Alle" setzt nur echte Sensoren (keine Messwerte, keine Änderung an ihnen)`, await s.ev("return !r.querySelector('.ag-table tr[data-row^=\"sensor.\"] .ag-box.on') && r.querySelectorAll('.ag-table tr[data-row^=\"binary_sensor.\"] [data-box][data-mode=\"home\"].on').length === r.querySelectorAll('.ag-table tr[data-row^=\"binary_sensor.\"]').length"));
    await s.tap('[data-sen="cancel"]');
    await s.tap('[data-sen="filter"][data-filter="measure"]');
    check(`${tag}: Filter "${t.measure}" zeigt nur die zwei Messwerte`, await s.waitFor("return r.querySelectorAll('.ag-table tr[data-row]').length === 2 && [...r.querySelectorAll('.ag-table tr[data-row]')].every((x) => x.dataset.row.startsWith('sensor.'))"));
    await s.tap('[data-sen="filter"][data-filter="other"]');
    check(`${tag}: Filter "Weitere" enthält keine Messwerte`, await s.waitFor("return ![...r.querySelectorAll('.ag-table tr[data-row]')].some((x) => x.dataset.row.startsWith('sensor.'))"));
    await s.tap('[data-sen="filter"][data-filter="all"]');
    // Blatt eines Messwerts
    await s.tap(`.ag-table tr[data-row="${FRIDGE}"] [data-sen="detail"]`);
    check(`${tag}: das Blatt eines Messwerts zeigt den Wert, keine Optionen des Alarms`, await s.waitFor("const b=r.querySelector('.ag-sheet, #ag-sheet[open]'); return !!b && /5\\.4 °C/.test(b.innerText) && !b.querySelector('[data-sen=\"opt\"]') && !b.querySelector('[data-sen=\"entry\"]')"));
    await s.ev("r.querySelector('[data-sen=\"close-detail\"]').click()");
    await s.waitFor("return !r.querySelector('.ag-sheet') && !r.getElementById('ag-sheet').open");
    // Fenster "+"
    await s.tap('[data-sen="add"]');
    await s.waitFor("return r.getElementById('ag-pick').open");
    check(`${tag}: das Fenster "+" bietet den CO2-Sensor an (die zwei in der Liste nicht mehr)`, await s.ev("const l=r.querySelector('#ag-pick .ag-elist').innerText; return /CO2/.test(l) && !/Kühlschrank Temperatur|Keller Luftfeuchtigkeit/.test(l)"));
    await s.tap('[data-sen="pick-filter"][data-filter="measure"]');
    check(`${tag}: Filter "${t.measure}" im Fenster "+": genau ein Eintrag`, await s.waitFor("return r.querySelectorAll('#ag-pick [data-sen=\"pick-toggle\"]').length === 1"));
    await s.tap('[data-sen="pick-toggle"]');
    await s.tap('[data-sen="pick-add"]');
    check(`${tag}: der CO2-Sensor steht als graue Zeile in der Liste, eine Änderung`, await s.waitFor("return !!r.querySelector('.ag-table tr[data-row=\"sensor.wohnzimmer_co2\"] .ag-box.dis') && /1/.test(r.querySelector('.ag-foot').innerText)"));
    await s.tap('[data-sen="save"]');
    check(`${tag}: gespeichert (monitor_sensors im Server), danach keine Änderung mehr`, await s.waitFor("return /Gespeichert|Saved/.test(r.querySelector('.ag-foot').innerText)", 8000)
      && await s.sim("return window.__systems[0].monitor_sensors.includes('sensor.wohnzimmer_co2') && !window.__systems[0].sensors.some((x) => x.startsWith('sensor.'))"));
    check(`${tag}: nach dem Neuladen keine Änderungen und die Zeile ist noch da`, await s.waitFor("return !!r.querySelector('.ag-table tr[data-row=\"sensor.wohnzimmer_co2\"]') && /^(Keine Änderungen|No changes|Gespeichert|Saved)/.test(r.querySelector('.ag-foot').innerText.trim())", 8000));
    check(`${tag}: keine Seitenfehler`, s.errors.length === 0, JSON.stringify(s.errors));
    await s.ctx.close();

    // ----- Aktionen › Überwachung: Regeln als Kapitel -----
    s = await open(browser, { mobile, lang, tab: "config", query: "&monitor=1" });
    await s.tap('[data-sub="actions"]');
    await s.waitFor("return !!r.querySelector('.ag-wf')");
    const tabs = await s.ev("return [...r.querySelectorAll('[data-seg=\"wf-trigger\"] > button')].map((b) => b.dataset.trigger)");
    check(`${tag}: Reiter Anwesend, Abwesend, Nacht, Immer aktiv und "${t.mode}" (der letzte)`, tabs.join() === "home,away,night,always,monitor", tabs.join());
    check(`${tag}: Reiterleiste mit "${t.mode}": Spur getönt, Übergang erst gegen Ende von "Immer aktiv" bzw. an der Zeile von "${t.mode}" (Handy: zwei Zeilen)`, await s.ev(`const seg = r.querySelector('[data-seg="wf-trigger"]'); const bg = seg.style.background; const m = bg.match(/(\\d+)px/g) || [];
const last = seg.querySelector('[data-trigger="always"]'); const mon = seg.querySelector('[data-trigger="monitor"]');
if (!bg.includes('linear-gradient') || m.length < 2) return false;
if ([...seg.children].some((c) => c.offsetTop > seg.children[0].offsetTop + 4)) return bg.includes('no-repeat') && bg.includes('18px') && !bg.includes('180deg');
const from = parseInt(m[0]);
return from > last.offsetLeft + last.offsetWidth * 0.6 && from < last.offsetLeft + last.offsetWidth && parseInt(m[1]) > from && parseInt(m[1]) <= mon.offsetLeft + 40;`));
    check(`${tag}: andere Reiterleisten bleiben ungetönt`, await s.ev("return ![...r.querySelectorAll('.ag-seg:not([data-seg=\"wf-trigger\"])')].some((x) => x.style.background.includes('linear-gradient'))"));
    await s.tap('[data-trigger="monitor"]');
    check(`${tag}: zwei Regeln als Kapitel`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 2"));
    const rules = await s.ev(`return [...r.querySelectorAll('.ag-mon-rule')].map((x) => ({ name: x.querySelector('.ag-chap-t').textContent, sub: x.querySelector('.ag-mon-head small').textContent, out: x.querySelectorAll('.ag-wf-mon-out .ag-wf-step').length, ok: x.querySelectorAll('.ag-wf-mon-ok .ag-wf-step').length,
      outTitle: x.querySelector('.ag-wf-mon-out .ag-wf-start').textContent.trim(), okTitle: x.querySelector('.ag-wf-mon-ok .ag-wf-start').textContent.trim(), zOut: getComputedStyle(x.querySelector('.ag-wf-mon-out')).getPropertyValue('--z').trim(), zOk: getComputedStyle(x.querySelector('.ag-wf-mon-ok')).getPropertyValue('--z').trim(), tag: x.querySelector('.ag-tag.warn')?.textContent || '' }))`);
    check(`${tag}: Regel 1: Name, Bedingung in Worten, Dauer und Erinnerung`, rules[0].name === t.rule && /Kühlschrank Temperatur/.test(rules[0].sub) && /8 °C/.test(rules[0].sub) && /30/.test(rules[0].sub) && /2/.test(rules[0].sub), JSON.stringify(rules[0]));
    check(`${tag}: je Regel zwei Abläufe "${t.outside}" und "${t.ok}" mit ihren Schritten`, rules[0].out === 2 && rules[0].ok === 1 && rules[1].out === 1 && rules[1].ok === 0 && rules.every((x) => x.outTitle === t.outside && x.okTitle === t.ok), JSON.stringify(rules));
    check(`${tag}: Zonenfarben orange (ausserhalb) und grün (in Ordnung)`, rules.every((x) => x.zOut === "#ffb74d" && x.zOk === "#81c784"), JSON.stringify(rules.map((x) => [x.zOut, x.zOk])));
    check(`${tag}: die laufende Regel trägt "${t.since}"`, rules[0].tag === "" && rules[1].tag.includes(t.since), JSON.stringify(rules.map((x) => x.tag)));
    check(`${tag}: am Anfang keine Änderung und kein oranger Punkt`, await s.ev("return /(Keine Änderungen|No changes)/.test(r.querySelector('.ag-foot').innerText) && !r.querySelector('[data-trigger=\"monitor\"].has-edit') && !r.querySelector('[data-sub=\"actions\"].has-edit')"));
    check(`${tag}: der Schalter jeder Regel steht links, vor dem Namen`, await s.ev("return [...r.querySelectorAll('.ag-mon-head')].every((h) => h.querySelector('.ag-toggle').getBoundingClientRect().left < h.querySelector('.ag-chap-t').getBoundingClientRect().left)"));

    // Zuklappen und Suche
    await s.tap('[data-wf="mon-fold"][data-rule="0"]');
    check(`${tag}: Regel zuklappen: Kopf bleibt, die Abläufe sind weg, die andere Regel bleibt offen, keine Änderung`, await s.waitFor("const x=[...r.querySelectorAll('.ag-mon-rule')]; return x[0].classList.contains('folded') && !x[0].querySelector('.ag-wf-line') && x[0].querySelector('.ag-mon-head') && !!x[1].querySelector('.ag-wf-line') && x[0].querySelector('.ag-mon-fold').getAttribute('aria-expanded') === 'false' && /(Keine Änderungen|No changes)/.test(r.querySelector('.ag-foot').innerText)"));
    await s.tap('[data-wf="mon-fold"][data-rule="0"]');
    check(`${tag}: wieder aufklappen`, await s.waitFor("return !!r.querySelectorAll('.ag-mon-rule')[0].querySelector('.ag-wf-line')"));
    await s.tap('[data-wf="mon-fold-all"]');
    check(`${tag}: "Alle zuklappen"`, await s.waitFor("return [...r.querySelectorAll('.ag-mon-rule')].every((x) => x.classList.contains('folded'))"));
    await s.tap('[data-wf="mon-fold-all"]');
    check(`${tag}: "Alle aufklappen"`, await s.waitFor("return [...r.querySelectorAll('.ag-mon-rule')].every((x) => !x.classList.contains('folded'))"));
    const search = await s.el('[data-wf="mon-search"]');
    await search.fill("kühlschranktür");
    check(`${tag}: Suche nach dem Namen: nur die Regel "Kühlschranktür offen", Fokus bleibt im Feld`, await s.waitFor("const x=[...r.querySelectorAll('.ag-mon-rule')]; return x.length === 1 && /Kühlschranktür/.test(x[0].innerText) && r.activeElement?.dataset.wf === 'mon-search'"));
    await search.fill("garagentor");
    check(`${tag}: Suche nach dem Namen des Sensors (Garagentor) findet die Regel`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 1"));
    await search.fill("binary_sensor.garage");
    check(`${tag}: Suche nach der Entitäts-ID findet sie auch`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 1"));
    await search.fill("sensor.kuehlschrank");
    check(`${tag}: Suche "sensor.kuehlschrank" findet die andere Regel`, await s.waitFor("const x=[...r.querySelectorAll('.ag-mon-rule')]; return x.length === 1 && /zu warm/.test(x[0].innerText)"));
    await search.fill("gibtesnicht");
    check(`${tag}: nichts gefunden: Hinweis`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 0 && !!r.querySelector('.ag-mon-list .ag-empty')"));
    await s.tap('[data-wf="mon-search-clear"]');
    check(`${tag}: Leeren zeigt wieder beide, Fokus im Feld`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 2 && r.activeElement?.dataset.wf === 'mon-search'"));
    // Mit Filter bleiben die Knöpfe an der richtigen Regel (Index der vollen Liste)
    await search.fill("kühlschranktür");
    await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 1");
    await s.tap('[data-wf="mon-on"]');
    check(`${tag}: gefilterte Regel ausschalten trifft die richtige (Nummer 2 der Liste)`, await s.ev("const d=r.host.actions.mon.draft.monitors; return d[0].enabled !== false && d[1].enabled === false"));
    await s.tap('[data-wf="mon-cancel"]');
    await (await s.el('[data-wf="mon-search"]')).fill("");
    await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 2");

    // Schalter der Regel
    await s.tap('[data-wf="mon-on"][data-rule="1"]');
    check(`${tag}: Regel ausschalten: gedimmt, eine Änderung, orange Punkt am Reiter und am Unterreiter`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule.dim').length === 1 && /1/.test(r.querySelector('.ag-foot').innerText) && r.querySelector('[data-trigger=\"monitor\"]').classList.contains('has-edit') && r.querySelector('[data-sub=\"actions\"]').classList.contains('has-edit')"));
    await s.tap('[data-wf="mon-cancel"]');
    check(`${tag}: Abbrechen stellt zurück, Punkt weg`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule.dim').length === 0 && !r.querySelector('[data-trigger=\"monitor\"].has-edit') && /(Keine Änderungen|No changes)/.test(r.querySelector('.ag-foot').innerText)"));

    // Schritt "Warten" im Ablauf "in Ordnung" der ersten Regel
    await s.tap('[data-wf="mon-step-add"][data-rule="0"][data-zone="ok"][data-at="1"]');
    check(`${tag}: Fenster des Schritts offen`, await s.waitFor("return r.getElementById('ag-monstep').open && !!r.querySelector('#ag-monstep [data-wf=\"mon-skind\"]')"));
    await s.tap('[data-wf="mon-skind"][data-value="wait"]');
    await (await s.el('#ag-monstep [data-field="n"]')).fill("5");
    await (await s.el('#ag-monstep select[data-field="unit"]')).selectOption("m");
    await s.tap('[data-wf="mon-step-apply"]');
    check(`${tag}: der Schritt steht im Ablauf, 5 Minuten, Punkt am Reiter`, await s.waitFor("const c=[...r.querySelectorAll('.ag-mon-rule')[0].querySelectorAll('.ag-wf-mon-ok .ag-wf-step')]; return c.length === 2 && /5/.test(c[1].innerText) && r.querySelector('[data-trigger=\"monitor\"]').classList.contains('has-edit')"));
    // Schritt "Gerät schalten"
    await s.tap('[data-wf="mon-step-add"][data-rule="0"][data-zone="ok"][data-at="2"]');
    await s.waitFor("return r.getElementById('ag-monstep').open");
    await s.tap('[data-wf="mon-skind"][data-value="action"]');
    check(`${tag}: Gerät schalten ohne Gerät: Übernehmen gesperrt`, await s.waitFor("return r.querySelector('#ag-monstep [data-wf=\"mon-step-apply\"]').disabled"));
    await s.tap('#ag-monstep [data-wf="mon-spick"]');
    check(`${tag}: Geräteliste mit Steckdose, Licht, Sirene, Rollläden, Skript, Szene`, await s.waitFor("const n=[...r.querySelectorAll('#ag-monstep .ag-rtent b')].map((b) => b.textContent); return n.includes('Steckdose Flur') && n.includes('Sirene Flur') && n.includes('Szene Film') && !n.some((x) => /Sonos/.test(x))"));
    await (await s.el('#ag-monstep [data-wf="mon-sq"]')).fill("steck");
    check(`${tag}: Suche findet die Steckdose, Fokus bleibt im Feld`, await s.waitFor("return r.querySelectorAll('#ag-monstep .ag-rtent').length === 1 && r.activeElement?.dataset.wf === 'mon-sq' || r.getElementById('ag-monstep').querySelector('[data-wf=\"mon-sq\"]') === r.activeElement"));
    await s.tap('#ag-monstep [data-wf="mon-schoose"]');
    await s.waitFor("return !!r.querySelector('#ag-monstep select[data-field=\"service\"]')");
    await (await s.el('#ag-monstep select[data-field="service"]')).selectOption("turn_off");
    await s.tap('[data-wf="mon-step-apply"]');
    check(`${tag}: Schritt "Steckdose Flur · Ausschalten" im Ablauf`, await s.waitFor("const c=[...r.querySelectorAll('.ag-mon-rule')[0].querySelectorAll('.ag-wf-mon-ok .ag-wf-step')]; return c.length === 3 && /Steckdose Flur/.test(c[2].innerText) && /Ausschalten|Switch off/.test(c[2].innerText)"));
    // Schritt bearbeiten: Push kritisch mit eigenem Empfänger
    await s.tap('[data-wf="mon-step-edit"][data-rule="0"][data-zone="out"][data-index="0"]');
    check(`${tag}: Push-Schritt: Titel und Text sind vorbelegt`, await s.waitFor("const d=r.getElementById('ag-monstep'); return d.open && d.querySelector('[data-field=\"title\"]').value === 'Kühlschrank zu warm' && /\{sensor\}/.test(d.querySelector('[data-field=\"message\"]').value)"));
    check(`${tag}: Vorschau der Meldung: Platzhalter aufgelöst (Sensor, Wert 5.4 °C, Zeit), keine geschweiften Klammern`, await s.ev("const p=r.querySelector('#ag-monstep [data-prev]'); const b=p.querySelector('[data-prev-body]').textContent; return p.querySelector('[data-prev-title]').textContent === 'Kühlschrank zu warm' && /^Kühlschrank Temperatur: 5\\.4 °C, seit \\d/.test(b) && !/[{}]/.test(b)"));
    await s.tap('#ag-monstep .ag-phpill[data-field="title"][data-ph="{rule}"]');
    check(`${tag}: Vorschau zieht beim Einfügen eines Platzhalters mit`, await s.ev("return r.querySelector('#ag-monstep [data-prev-title]').textContent.includes('Kühlschrank zu warm') && r.querySelector('#ag-monstep [data-prev-title]').textContent.length > 'Kühlschrank zu warm'.length"));
    await (await s.el('#ag-monstep [data-field="message"]')).fill("");
    check(`${tag}: ohne eigenen Text zeigt die Vorschau den Standardtext mit Grenze`, await s.waitFor("const b=r.querySelector('#ag-monstep [data-prev-body]').textContent; return /Kühlschrank Temperatur: 5\\.4 °C/.test(b) && /8 °C/.test(b)"));
    await s.ev("const i=r.querySelector('#ag-monstep [data-field=\"message\"]'); i.value='{sensor}: {value} {unit}, seit {since}.'; i.dispatchEvent(new Event('input', {bubbles:true})); const t=r.querySelector('#ag-monstep [data-field=\"title\"]'); t.value='Kühlschrank zu warm'; t.dispatchEvent(new Event('input', {bubbles:true})); return 1");
    check(`${tag}: Platzhalter als Pillen unter Titel und unter Text (je eigene Reihe, sieben Stück)`, await s.ev("const d=r.getElementById('ag-monstep'); const rows=[...d.querySelectorAll('.ag-ph')]; return rows.length === 2 && rows.every((x) => x.querySelectorAll('.ag-phpill').length === 7) && rows[0].querySelector('[data-field=\"title\"]') && rows[1].querySelector('[data-field=\"message\"]') && !!d.querySelector('.ag-ph .ag-phpill[title]')"));
    await s.ev("const i=r.querySelector('#ag-monstep [data-field=\"title\"]'); i.focus(); i.setSelectionRange(9, 9); return 1");
    await s.tap('#ag-monstep .ag-phpill[data-field="title"][data-ph="{value}"]');
    check(`${tag}: Pille "{value}" im Titel fügt sie an der Schreibmarke ein, Fokus und Schreibmarke dahinter`, await s.ev("const i=r.querySelector('#ag-monstep [data-field=\"title\"]'); return i.value === 'Kühlschrank{value} zu warm' || /\\{value\\}/.test(i.value) && i.value.indexOf('{value}') === 9 && r.activeElement === i && i.selectionStart === 16"));
    await s.tap('#ag-monstep .ag-phpill[data-field="message"][data-ph="{unit}"]');
    check(`${tag}: Pille "{unit}" im Text geht in den Text, nicht in den Titel`, await s.ev("const t=r.querySelector('#ag-monstep [data-field=\"message\"]').value; return t.includes('{unit}') && !r.querySelector('#ag-monstep [data-field=\"title\"]').value.includes('{unit}')"));
    check(`${tag}: der Entwurf kennt den eingefügten Platzhalter (Änderung wird gespeichert)`, await s.ev("const s=r.host.actions.mon.step.form; return s.title.includes('{value}') && s.message.includes('{unit}')"));
    await s.tap('#ag-monstep [data-wf="mon-critical"]');
    await (await s.el('#ag-monstep select[data-wf="mon-target-add"]')).selectOption("notify.mobile_app_tablet");
    check(`${tag}: Empfänger als Pille, "kritisch" an`, await s.waitFor("const d=r.getElementById('ag-monstep'); return /mobile_app_tablet/.test(d.querySelector('.ag-rpills').innerText) && d.querySelector('[data-wf=\"mon-critical\"]').getAttribute('aria-checked') === 'true'"));
    await s.tap('[data-wf="mon-step-apply"]');
    check(`${tag}: die Karte nennt Empfänger und "kritisch"`, await s.waitFor("const c=r.querySelectorAll('.ag-mon-rule')[0].querySelectorAll('.ag-wf-mon-out .ag-wf-step')[0]; return /mobile_app_tablet/.test(c.innerText) && /kritisch|critical/.test(c.innerText)"));
    // Schritt kopieren und löschen
    await s.tap('[data-wf="mon-step-dup"][data-rule="0"][data-zone="out"][data-index="0"]');
    check(`${tag}: Schritt kopieren`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule')[0].querySelectorAll('.ag-wf-mon-out .ag-wf-step').length === 3"));
    await s.tap('[data-wf="mon-step-del"][data-rule="0"][data-zone="out"][data-index="1"]');
    check(`${tag}: Schritt löschen`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule')[0].querySelectorAll('.ag-wf-mon-out .ag-wf-step').length === 2"));
    check(`${tag}: der Fuss zählt eine Änderung je Regel (nicht je Schritt)`, await s.ev("return /(^|\\s)1 (Änderung|change)(\\s|$)/.test(r.querySelector('.ag-foot').innerText)"));
    await s.tap('[data-wf="mon-save"]');
    check(`${tag}: gespeichert`, await s.waitFor(`return /${t.saved}/.test(r.querySelector('.ag-foot').innerText)`, 8000));
    const saved = await s.sim("const m=window.__systems[0].monitors[0]; return JSON.stringify({ out: m.steps_out.map((x) => x.type), ok: m.steps_ok.map((x) => x.type), crit: m.steps_out[0].critical, targets: m.steps_out[0].targets, wait: m.steps_ok[1].seconds, dev: m.steps_ok[2].action, n: window.__monitorSaves })");
    check(`${tag}: der Server hat Schritte, kritisch, Empfänger, 300 s und turn_off`, saved === JSON.stringify({ out: ["notify", "action"], ok: ["notify", "wait", "action"], crit: true, targets: ["notify.mobile_app_tablet"], wait: 300, dev: "switch.turn_off", n: 1 }), saved);
    check(`${tag}: nach dem Speichern und Neuladen kein oranger Punkt, keine Änderung (Vorgaben des Servers zählen nicht)`, await s.waitFor("return !!r.querySelector('.ag-mon-rule') && !r.querySelector('[data-trigger=\"monitor\"].has-edit') && !r.querySelector('[data-sub=\"actions\"].has-edit') && !r.querySelector('[data-tab=\"config\"].has-edit') && /^(Keine Änderungen|No changes|Gespeichert|Saved)/.test(r.querySelector('.ag-foot').innerText.trim())", 8000));
    check(`${tag}: nach dem Neuladen steht der Ablauf noch da`, await s.waitFor("const c=r.querySelectorAll('.ag-mon-rule')[0]; return c.querySelectorAll('.ag-wf-mon-ok .ag-wf-step').length === 3 && c.querySelectorAll('.ag-wf-mon-out .ag-wf-step').length === 2", 8000));

    // ----- Editor der Regel -----
    await s.tap('[data-wf="mon-add"]');
    check(`${tag}: Editor offen, "Übernehmen" gesperrt (Name fehlt)`, await s.waitFor("const d=r.getElementById('ag-mon'); return d.open && d.querySelector('[data-wf=\"mon-save-form\"]').disabled"));
    await (await s.el('#ag-mon [data-wf="mon-name"]')).fill("Keller feucht");
    check(`${tag}: Fokus bleibt beim Tippen im Namen`, await s.ev("return r.activeElement?.dataset.wf === 'mon-name'"));
    check(`${tag}: ohne Bedingung gesperrt, Meldung nennt den Sensor`, await s.ev(`const d=r.getElementById('ag-mon'); return d.querySelector('[data-wf="mon-save-form"]').disabled && d.querySelector('.ag-dlg-err').textContent.includes(${JSON.stringify(t.noDevice)})`));
    await s.tap('#ag-mon [data-wf="mon-add-leaf"][data-kind="value"][data-path=""]');
    check(`${tag}: Auswahl der Messwerte: nur die zwei Sensoren aus der Sensorliste (kein CO2, keine Türen, keine anderen Messwerte)`, await s.waitFor("const n=[...r.querySelectorAll('#ag-mon .ag-rtent b')].map((b) => b.textContent).sort(); return n.join('|') === 'Keller Luftfeuchtigkeit|Kühlschrank Temperatur'"));
    await s.tap('#ag-mon [data-wf="mon-filter"][data-value="humidity"]');
    check(`${tag}: Filter Luftfeuchtigkeit`, await s.waitFor("const n=[...r.querySelectorAll('#ag-mon .ag-rtent b')].map((b) => b.textContent); return n.length === 1 && n[0] === 'Keller Luftfeuchtigkeit'"));
    check(`${tag}: die Entitäts-ID steht nirgends in der Liste`, await s.ev("return !/sensor\\.|binary_sensor/.test(r.querySelector('#ag-mon .ag-rtlist').innerText)"));
    await s.tap('#ag-mon [data-wf="mon-choose"]');
    check(`${tag}: Sensor gewählt: Zeile mit Operator über, Feld für die Grenze und Einheit %`, await s.waitFor("const l=r.querySelector('#ag-mon .ag-rtleaf'); return !!l && /Keller Luftfeuchtigkeit/.test(l.innerText) && !!l.querySelector('input[data-field=\"limit\"]') && /%/.test(l.innerText)"));
    check(`${tag}: ohne Grenze gesperrt`, await s.ev("return r.querySelector('#ag-mon [data-wf=\"mon-save-form\"]').disabled"));
    await (await s.el('#ag-mon input[data-field="limit"]')).fill("70");
    check(`${tag}: mit Grenze 70 speicherbar, Fokus bleibt im Feld`, await s.ev("return !r.querySelector('#ag-mon [data-wf=\"mon-save-form\"]').disabled && r.activeElement?.dataset.field === 'limit'"));
    // ausserhalb: obere Grenze muss über der unteren liegen
    await s.tap('#ag-mon [data-wf="mon-leaf-op"][data-value="outside"]');
    await (await s.el('#ag-mon input[data-field="upper"]')).fill("60");
    check(`${tag}: "ausserhalb" mit oberer Grenze unter der unteren: gesperrt`, await s.waitFor("return r.querySelector('#ag-mon [data-wf=\"mon-save-form\"]').disabled"));
    await (await s.el('#ag-mon input[data-field="limit"]')).fill("40");
    await (await s.el('#ag-mon input[data-field="upper"]')).fill("70");
    check(`${tag}: 40 bis 70 gültig`, await s.waitFor("return !r.querySelector('#ag-mon [data-wf=\"mon-save-form\"]').disabled"));
    // Anlage scharf, Uhrzeit, Gruppe
    await s.tap('#ag-mon [data-wf="mon-add-leaf"][data-kind="armed"][data-path=""]');
    await s.tap('#ag-mon [data-wf="mon-armed-mode"][data-mode="away"]');
    await s.tap('#ag-mon [data-wf="mon-add-leaf"][data-kind="time"][data-path=""]');
    check(`${tag}: drei Bedingungen, die Zeile "Anlage scharf" nennt den Modus, die Uhrzeit hat zwei Felder`, await s.ev("const l=[...r.querySelectorAll('#ag-mon .ag-rtleaf')]; return l.length === 3 && l[1].querySelector('.ag-chip.on') && l[2].querySelectorAll('input[type=time]').length === 2"));
    await s.tap('#ag-mon [data-wf="mon-op"][data-path=""][data-value="or"]');
    check(`${tag}: Oder wählbar`, await s.waitFor("return r.querySelector('#ag-mon [data-wf=\"mon-op\"][data-path=\"\"][data-value=\"or\"]').classList.contains('on')"));
    await s.tap('#ag-mon [data-wf="mon-op"][data-path=""][data-value="and"]');
    await s.tap('#ag-mon [data-wf="mon-add-group"]');
    check(`${tag}: leere Gruppe sperrt Übernehmen`, await s.waitFor("const d=r.getElementById('ag-mon'); return d.querySelector('[data-wf=\"mon-save-form\"]').disabled && d.querySelector('.ag-dlg-err').textContent.length > 0"));
    await s.tap('#ag-mon [data-wf="mon-leaf-del"][data-path="3"]');
    check(`${tag}: Rückkehr-Spanne nur mit Messwert, Dauer und Erinnerung vorhanden`, await s.ev("const d=r.getElementById('ag-mon'); return !!d.querySelector('[data-field=\"margin\"]') && !!d.querySelector('[data-field=\"holdN\"]') && !!d.querySelector('[data-field=\"remind\"]')"));
    await (await s.el('#ag-mon [data-field="remind"]')).fill("4");
    await (await s.el('#ag-mon [data-field="margin"]')).fill("5");
    await s.tap('#ag-mon [data-wf="mon-save-form"]');
    check(`${tag}: Regel übernommen: dritte Regel, eine Änderung`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 3 && /1/.test(r.querySelector('.ag-foot').innerText)"));
    const added = await s.ev("const x=[...r.querySelectorAll('.ag-mon-rule')][2]; return { name: x.querySelector('.ag-chap-t').textContent, sub: x.querySelector('.ag-mon-head small').textContent }");
    check(`${tag}: ihre Zeile erklärt die Bedingung in Worten (ausserhalb 40 bis 70, scharf, Uhrzeit), Dauer und Erinnerung`, added.name === "Keller feucht" && /Keller Luftfeuchtigkeit/.test(added.sub) && /40/.test(added.sub) && /70/.test(added.sub) && /30/.test(added.sub) && /4/.test(added.sub), JSON.stringify(added));
    // Namen doppelt
    await s.tap('[data-wf="mon-add"]');
    await (await s.el('#ag-mon [data-wf="mon-name"]')).fill("keller FEUCHT");
    check(`${tag}: doppelter Name (Gross und Klein egal) gesperrt, Meldung "${t.taken}"`, await s.waitFor(`const d=r.getElementById('ag-mon'); return d.querySelector('[data-wf="mon-save-form"]').disabled && d.querySelector('.ag-dlg-err').textContent.includes(${JSON.stringify(t.taken)})`));
    await s.tap('#ag-mon [data-wf="mon-cancel-form"]');
    check(`${tag}: Abbrechen mit Eingaben fragt nach (Änderungen verwerfen?)`, await s.waitFor("return r.getElementById('ag-confirm').open"));
    await s.tap('#ag-confirm [data-c="yes"]');
    await s.waitFor("return !r.getElementById('ag-mon').open");
    check(`${tag}: Abbrechen schliesst ohne neue Regel`, await s.ev("return r.querySelectorAll('.ag-mon-rule').length === 3"));
    // Regel bearbeiten, kopieren, löschen
    await s.tap('[data-wf="mon-edit"][data-rule="0"]');
    check(`${tag}: Bearbeiten: alles vorbelegt (Name, Grenze 8, Dauer 30 Minuten, Spanne 1, Erinnerung 2)`, await s.waitFor("const d=r.getElementById('ag-mon'); return d.open && d.querySelector('[data-wf=\"mon-name\"]').value === 'Kühlschrank zu warm' && d.querySelector('input[data-field=\"limit\"]').value === '8' && d.querySelector('[data-field=\"holdN\"]').value === '30' && d.querySelector('[data-wf=\"mon-holdunit\"]').value === 'm' && d.querySelector('[data-field=\"margin\"]').value === '1' && d.querySelector('[data-field=\"remind\"]').value === '2'"));
    await s.tap('#ag-mon [data-wf="mon-cancel-form"]');
    await s.waitFor("return !r.getElementById('ag-mon').open");
    await s.tap('[data-wf="mon-dup"][data-rule="0"]');
    check(`${tag}: Kopieren: vierte Regel mit "${t.copy}" im Namen und denselben Schritten`, await s.waitFor(`const x=[...r.querySelectorAll('.ag-mon-rule')]; return x.length === 4 && x[1].querySelector('.ag-chap-t').textContent.includes(${JSON.stringify(t.copy)}) && x[1].querySelectorAll('.ag-wf-step').length === x[0].querySelectorAll('.ag-wf-step').length`));
    await s.tap('[data-wf="mon-del"][data-rule="1"]');
    check(`${tag}: Löschen: wieder drei Regeln`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 3"));
    await s.tap('[data-wf="mon-save"]');
    await s.waitFor(`return /${t.saved}/.test(r.querySelector('.ag-foot').innerText)`, 8000);
    const final = await s.sim("return JSON.stringify(window.__systems[0].monitors.map((m) => [m.name, m.hold, m.margin, m.remind, m.tree.op, m.tree.items.map((i) => i.kind + (i.op ? ':' + i.op : '') + (i.limit !== undefined ? ':' + i.limit : '') + (i.upper !== undefined ? '-' + i.upper : '') + (i.modes ? ':' + i.modes.join('+') : ''))]))");
    check(`${tag}: der Server hat die neue Regel mit Grenzen, Modus, Dauer, Spanne und Erinnerung`, final.includes(JSON.stringify(["Keller feucht", 1800, 5, 4, "and", ["value:outside:40-70", "armed:away", "time"]])), final);
    check(`${tag}: nach dem Neuladen ohne orange Punkte (auch mit der neuen Regel)`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 3 && !r.querySelector('.has-edit') && /^(Keine Änderungen|No changes|Gespeichert|Saved)/.test(r.querySelector('.ag-foot').innerText.trim())", 8000));

    // Darstellung: Farbe der Karte (zehn Farben plus Standard)
    await s.tap('[data-wf="mon-edit"][data-rule="0"]');
    await s.waitFor("return r.getElementById('ag-mon').open");
    check(`${tag}: Kapitel "Darstellung" mit Standard und zehn Farben, Standard gewählt`, await s.ev("const w=r.querySelectorAll('#ag-mon .ag-swatch'); return w.length === 11 && w[0].getAttribute('aria-checked') === 'true' && [...w].slice(1).every((b) => /^#[0-9a-f]{6}$/.test(b.dataset.value))"));
    await s.tap('#ag-mon .ag-swatch[data-value="#29b6f6"]');
    check(`${tag}: Blau gewählt (Haken), Fokus-Reihenfolge bleibt`, await s.waitFor("const b=r.querySelector('#ag-mon .ag-swatch[data-value=\"#29b6f6\"]'); return b.getAttribute('aria-checked') === 'true' && !!b.querySelector('svg') && r.querySelector('#ag-mon .ag-swatch[aria-checked=\"true\"]') === b"));
    await s.tap('#ag-mon [data-wf="mon-save-form"]');
    check(`${tag}: die Karte hat die Farbe als Verlauf und es gibt eine Änderung`, await s.waitFor("const x=r.querySelectorAll('.ag-mon-rule')[0]; return x.classList.contains('coloured') && getComputedStyle(x).backgroundImage.includes('linear-gradient') && getComputedStyle(x).getPropertyValue('--mc').trim() === '#29b6f6' && !r.querySelectorAll('.ag-mon-rule')[1].classList.contains('coloured') && /1/.test(r.querySelector('.ag-foot').innerText)"));
    await s.tap('[data-wf="mon-save"]');
    check(`${tag}: gespeichert, der Server hat die Farbe nur bei dieser Regel`, await s.waitFor("return /Gespeichert|Saved/.test(r.querySelector('.ag-foot').innerText)", 8000) && (await s.sim("return JSON.stringify(window.__systems[0].monitors.map((m) => m.color || null))")) === JSON.stringify(["#29b6f6", null, null]));
    check(`${tag}: nach dem Neuladen noch gefärbt, kein oranger Punkt`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule')[0]?.classList.contains('coloured') && !r.querySelector('.has-edit')", 8000));
    await s.tap('[data-wf="mon-edit"][data-rule="0"]');
    await s.waitFor("return r.getElementById('ag-mon').open");
    check(`${tag}: beim Bearbeiten ist Blau gewählt`, await s.ev("return r.querySelector('#ag-mon .ag-swatch[aria-checked=\"true\"]').dataset.value === '#29b6f6'"));
    await s.tap('#ag-mon .ag-swatch[data-value=""]');
    await s.tap('#ag-mon [data-wf="mon-save-form"]');
    await s.tap('[data-wf="mon-save"]');
    check(`${tag}: "Standard" entfernt die Farbe wieder (auch auf dem Server)`, await s.waitFor("return !r.querySelectorAll('.ag-mon-rule')[0].classList.contains('coloured')", 8000) && (await s.sim("return JSON.stringify(window.__systems[0].monitors.map((m) => m.color || null))")) === JSON.stringify([null, null, null]));
    await s.waitFor("return !r.querySelector('.has-edit')", 8000);

    // Ohne Messwerte in der Sensorliste: die Auswahl sagt, wo man sie hinzufügt
    await s.sim("window.__systems[0].monitor_sensors = []; return 1");
    await s.ev("r.host._fetch(); return 1");
    await s.waitFor("return r.host._data?.systems?.[0]?.monitor_sensors?.length === 0");
    await s.tap('[data-wf="mon-add"]');
    await s.tap('#ag-mon [data-wf="mon-add-leaf"][data-kind="value"][data-path=""]');
    check(`${tag}: ohne Messwerte in der Sensorliste: Hinweis statt Liste`, await s.waitFor("const l=r.querySelector('#ag-mon .ag-rtlist'); return !!l && !l.querySelector('.ag-rtent') && /Sensoren|Sensors/.test(l.innerText)"));
    await s.ev("r.getElementById('ag-mon').close(); return 1");
    await s.tap('#ag-confirm [data-c="yes"]').catch(() => {});

    // ----- Reiterleiste ohne getrennte Modi -----
    await s.tap('[data-trigger="away"]');
    await s.waitFor("return !!r.querySelector('[data-wf=\"permode\"]')");
    await s.tap('[data-wf="permode"]');
    await s.waitFor("return r.querySelector('[data-wf=\"permode\"]').getAttribute('aria-checked') === 'false'");
    const two = await s.ev("return [...r.querySelectorAll('[data-seg=\"wf-trigger\"] > button')].map((b) => b.dataset.trigger)");
    check(`${tag}: ohne "Einstellungen pro Modus" bleiben zwei Reiter: Alarm und "${t.mode}"`, two.length === 2 && two[1] === "monitor", two.join());
    await s.tap('[data-trigger="monitor"]');
    check(`${tag}: Reiter "${t.mode}" funktioniert auch dann`, await s.waitFor("return r.querySelectorAll('.ag-mon-rule').length === 3"));
    check(`${tag}: keine Seitenfehler (Aktionen)`, s.errors.length === 0, JSON.stringify(s.errors));
    await s.ctx.close();
  }
}
await browser.close();
done();
