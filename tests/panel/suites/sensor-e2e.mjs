// 1.9.0: Sensoransicht. Ein Klick auf einen Sensor der Übersicht öffnet sie (nicht mehr das Gerät in Home Assistant).
// Desktop: Fenster in der Breite der Voreinstellungen; Handy: ganzer Bildschirm mit X. Oben fest, nur die Liste scrollt.
// Kacheln als Reiter (nur mit Daten), Zeitraum, Grafik je Sensorart, Sprung zum Alarm, Kachel "Gerät". Je Sprache auf Desktop und Handy.
import { check, done, launch, open, outDir } from "../lib.mjs";

const T = {
  de: { ha: "In HA öffnen", tabs: ["Verlauf", "Batterie", "Empfang", "Gerät"], ranges: ["3 Std.", "12 Std.", "1 Tag", "7 Tage", "30 Tage"], bat: ["30 Tage", "90 Tage", "1 Jahr"], opened: "Geöffnet", motion: "Bewegung erkannt", gone: "Nicht erreichbar", alarm: "Alarm ausgelöst", error: "Der Verlauf konnte nicht geladen werden", maker: "Hersteller", from: "Die Liste reicht bis" },
  en: { ha: "Open in HA", tabs: ["History", "Battery", "Signal", "Device"], ranges: ["3 h", "12 h", "1 day", "7 days", "30 days"], bat: ["30 days", "90 days", "1 year"], opened: "Opened", motion: "Motion detected", gone: "Unreachable", alarm: "Alarm triggered", error: "The history could not be loaded", maker: "Manufacturer", from: "The list goes back to" },
};
const DOOR = "binary_sensor.haustuer";
const MOTION = "binary_sensor.bewegung_flur";
const GARAGE = "binary_sensor.garagentor";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang });
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${DOOR}"]')`);
    // Mitschreiben, ob das Gerät in Home Assistant geöffnet wird
    await s.ev("const h=r.host; h.__more=[]; const o=h._moreInfo.bind(h); h._moreInfo=(id) => { h.__more.push(id); o(id); }; return 1");
    const dlg = (js) => s.ev(`const d=r.getElementById("ag-sensor"); ${js}`);
    const calls = () => s.sim(`return window.__calls.filter((c) => c.type === "alarmageddon/sensor_history").map((c) => [c.entity_id, c.kind, c.hours])`);
    const loaded = (sel) => s.waitFor(`const d=r.getElementById("ag-sensor"); return d.open && !!d.querySelector(${JSON.stringify(sel)})`);
    const openSensor = async (id) => {
      await s.tap(`[data-act="more"][data-entity="${id}"]`);
      await loaded(".ag-sv-chart svg");
    };

    // ----- Öffnen, Grösse, Kopf -----
    await openSensor(DOOR);
    check(`${tag}: Klick auf den Sensor öffnet die Sensoransicht, nicht Home Assistant`, (await dlg("return d.open")) && (await s.ev("return r.host.__more.length")) === 0);
    const box = await dlg("const b=d.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top), vw: innerWidth, vh: innerHeight }");
    if (mobile) check(`${tag}: Handy: ganzer Bildschirm`, box.w === box.vw && box.h === box.vh && box.x === 0 && box.y === 0, JSON.stringify(box));
    else {
      // Gleiche Breite wie das Fenster der Voreinstellungen (dialog.ag-wide), nie breiter
      const wide = await s.ev("const p=r.getElementById('ag-presets'); p.showModal(); const w=Math.round(p.getBoundingClientRect().width); p.close(); return w");
      check(`${tag}: Desktop: so breit wie die Voreinstellungen (${wide} px), nicht breiter`, box.w === wide && box.w <= 880, JSON.stringify(box));
    }
    const x = await dlg("const b=d.querySelector(':scope > .ag-dlg-x'); if (!b) return null; const q=b.getBoundingClientRect(), o=d.getBoundingClientRect(); return { top: q.top - o.top, right: o.right - q.right, w: q.width }");
    check(`${tag}: X oben rechts`, !!x && x.top < 30 && x.right < 30 && x.w >= 38, JSON.stringify(x));
    const head = await dlg("const h=d.querySelector('.ag-sv-head'); const b=h.querySelector('[data-sv=\"ha\"]'); const xb=d.querySelector(':scope > .ag-dlg-x').getBoundingClientRect(), bb=b.getBoundingClientRect(); return { name: h.querySelector('.ag-sv-ttl b').textContent, btn: b.textContent.trim(), icon: !!b.querySelector('svg'), clear: bb.right <= xb.left || bb.top >= xb.bottom, h: bb.height }");
    check(`${tag}: Kopf mit Name und Knopf "${t.ha}" (mit Symbol), der das X nicht überdeckt`, head.name === "Haustür" && head.btn === t.ha && head.icon && head.clear && head.h >= (mobile ? 44 : 36), JSON.stringify(head));
    await dlg("d.querySelector('[data-sv=\"ha\"]').click(); return 1");
    check(`${tag}: "${t.ha}" öffnet den Sensor in Home Assistant`, (await s.ev("return r.host.__more.join()")) === DOOR);

    // ----- Kacheln als Reiter, Zeitraum -----
    const tiles = () => dlg("return [...d.querySelectorAll('.ag-sv-tile')].map((b) => b.querySelector('small').textContent + (b.classList.contains('on') ? '*' : ''))");
    check(`${tag}: Tür mit Batterie und Empfang: vier Kacheln, "Verlauf" gewählt`, JSON.stringify(await tiles()) === JSON.stringify([`${t.tabs[0]}*`, t.tabs[1], t.tabs[2], t.tabs[3]]), JSON.stringify(await tiles()));
    check(`${tag}: Kacheln zeigen ihren aktuellen Wert`, await dlg("const v=[...d.querySelectorAll('.ag-sv-tile b')].map((b) => b.textContent); return /72/.test(v[1]) && /-58|−58/.test(v[2]) && v[0].length > 2"));
    // ----- Seit wann (1.66.2, Wunsch des Nutzers 2026-11-19): nie die Zeit eines Neustarts von Home Assistant -----
    // Im Nachbau tragen alle Zustände die Zeit des Ladens als last_changed, wie nach einem Neustart; die letzte echte Änderung ist das Ende der
    // neuesten Öffnung (wie last_change.state_since auf dem Server)
    const tileText = () => dlg("return d.querySelector('.ag-sv-tile b').textContent");
    const since = await dlg(`const h=r.host, sv=h.sensorView, st=h._state('${DOOR}'); return { tile: d.querySelector('.ag-sv-tile b').textContent, want: h._fmtTime(sv.since.t), restart: h._fmtTime(st.last_changed), state: sv.since.state }`);
    check(`${tag}: Kachel "Verlauf": "seit" ist das Ende der letzten Öffnung, nicht der Neustart von Home Assistant`, since.state === "off" && since.tile.endsWith(` ${since.want}`) && since.want !== since.restart, JSON.stringify(since));
    // Ohne bekannte echte Änderung (etwa ein Rauchmelder, der nie ausgelöst hat): nur der Zustand, keine Zeit
    const calm = await dlg(`const h=r.host, sv=h.sensorView; sv.since = { id: '${DOOR}', state: 'off', t: null, real: 'off', real_t: null }; sv.render(); return [d.querySelector('.ag-sv-tile b').textContent, sv._stateText()[0]]`);
    check(`${tag}: ohne bekannte Änderung nur der Zustand ("${calm[1]}"), keine Zeit des Neustarts`, calm[0] === calm[1], JSON.stringify(calm));
    // Nach der Antwort geöffnet: Home Assistant kennt diesen Wechsel genau
    const t0 = Date.now() - 4 * 3600e3, t1 = Date.now() - 3 * 3600e3;
    await dlg(`const sv=r.host.sensorView; sv.since = { id: '${DOOR}', state: 'off', t: new Date(${t0}).toISOString(), real: 'off', real_t: new Date(${t0}).toISOString() }; return 1`);
    await s.sim(`window.__setState("${DOOR}", "on", {}, ${t1}); return 1`);
    const opened = await dlg(`const h=r.host; h.sensorView.render(); return [d.querySelector('.ag-sv-tile b').textContent, h._fmtTime(new Date(${t1}).toISOString())]`);
    check(`${tag}: nach der Antwort geöffnet: "seit" ist die Zeit der Öffnung`, opened[0].endsWith(` ${opened[1]}`) && opened[0].startsWith(await dlg("return r.host.sensorView._stateText()[0]")), JSON.stringify(opened));
    // Nicht erreichbar: seit Beginn der Unterbrechung (vom Server, über einen Neustart hinweg); kehrt der Sensor im alten Zustand zurück, gilt
    // wieder die Zeit davor, nicht die der Rückkehr
    await s.sim(`window.__setState("${DOOR}", "unavailable"); return 1`);
    const gone = await dlg(`const h=r.host, sv=h.sensorView; sv.since = { id: '${DOOR}', state: 'gone', t: new Date(${t1}).toISOString(), real: 'off', real_t: new Date(${t0}).toISOString() }; sv.render(); return [d.querySelector('.ag-sv-tile b').textContent, h._fmtTime(new Date(${t1}).toISOString()), sv._stateText()[0]]`);
    check(`${tag}: nicht erreichbar: "${gone[2]}" seit Beginn der Unterbrechung`, gone[0] === `${gone[2]} ${(await dlg("return r.host._t('since', { time: 'X' })")).replace("X", gone[1])}`, JSON.stringify(gone));
    await s.sim(`window.__setState("${DOOR}", "off"); return 1`);
    const back = await dlg(`const h=r.host; h.sensorView.render(); return [d.querySelector('.ag-sv-tile b').textContent, h._fmtTime(new Date(${t0}).toISOString()), h._fmtTime(h._state('${DOOR}').last_changed)]`);
    check(`${tag}: zurück im alten Zustand: "seit" bleibt die Zeit vor der Unterbrechung, nicht die der Rückkehr`, back[0].endsWith(` ${back[1]}`) && back[1] !== back[2], JSON.stringify(back));
    // Vor der ersten Antwort: die gemerkte letzte echte Änderung (wie die Liste), nie last_changed
    const before = await dlg(`const h=r.host, sv=h.sensorView; sv.since = null; sv.render(); return [d.querySelector('.ag-sv-tile b').textContent, h._fmtTime(h._data.last_changes['${DOOR}'])]`);
    check(`${tag}: vor der ersten Antwort: die letzte echte Änderung der Liste`, before[0].endsWith(` ${before[1]}`), JSON.stringify(before));
    // Zurück auf den Stand des Nachbaus für die folgenden Prüfungen
    await dlg("d.querySelector('.ag-sv-range [data-hours=\"24\"]').click(); return 1");
    await s.waitFor("const sv=r.host.sensorView; return !!sv.since && !sv.loading");
    check(`${tag}: neue Antwort: wieder "seit" der letzten Öffnung`, (await tileText()).endsWith(` ${await dlg("const h=r.host; return h._fmtTime(h.sensorView.since.t)")}`));
    await s.page.waitForTimeout(450); // die Kapsel ist angekommen
    // Reiter oben wie alle Schieber-Tabs: eine Leiste (.ag-seg) mit gleitender Kapsel unter dem gewählten, ohne blauen Rahmen
    check(`${tag}: Reiter Verlauf/Gerät sind eine gemeinsame Reiterleiste mit Kapsel unter dem gewählten (kein blauer Rahmen)`, await dlg("const bar=d.querySelector('.ag-sv-tiles'); const on=bar.querySelector('.ag-sv-tile.on'); const pill=bar.querySelector(':scope > .ag-pill'); if (!bar.classList.contains('ag-seg') || !pill || !on) return false; const p=pill.getBoundingClientRect(), o=on.getBoundingClientRect(); const bw=parseFloat(getComputedStyle(on).borderTopWidth); return JSON.stringify({ dl: Math.round(p.left - o.left), dw: Math.round(p.width - o.width), bw, bg: getComputedStyle(on).backgroundColor }) && Math.abs(p.left - o.left) < 6 && Math.abs(p.width - o.width) < 6 && bw === 0 && getComputedStyle(on).backgroundColor === 'rgba(0, 0, 0, 0)'"));
    const seg = () => dlg("return [...d.querySelectorAll('.ag-sv-range button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : ''))");
    check(`${tag}: Zeitraum in einer Zeile, die gewählte Taste ist hervorgehoben (Reiterleiste mit gleitender Kapsel, seit 1.73.0)`, await dlg("const g=d.querySelector('.ag-sv-range'); const b=[...g.querySelectorAll('button')].map((x) => x.getBoundingClientRect()); return b.every((x) => Math.abs(x.top - b[0].top) < 1) && g.querySelectorAll(':scope > .ag-pill').length === 1 && g.classList.contains('ag-seg') && g.querySelector('.on').getBoundingClientRect().left >= g.getBoundingClientRect().left"));
    check(`${tag}: Zeitraum 3 Std. bis 30 Tage, "1 Tag" gewählt`, JSON.stringify(await seg()) === JSON.stringify(t.ranges.map((v, i) => (i === 2 ? `${v}*` : v))), JSON.stringify(await seg()));
    check(`${tag}: Tür, 1 Tag: Zustandsband mit Leiste "Anlage scharf", Kennzahlen, Legende`, await dlg(`const c=d.querySelector('.ag-sv-chart svg'); return c.querySelectorAll('.sv-on, .sv-alarm').length >= 3 && c.querySelectorAll('.sv-armed').length >= 1 && d.querySelectorAll('.ag-sv-kpi').length === ${mobile ? 3 : 4} && d.querySelectorAll('.ag-sv-legend span').length >= 3`));
    await dlg("d.querySelector('.ag-sv-range [data-hours=\"168\"]').click(); return 1");
    await s.waitFor("const d=r.getElementById('ag-sensor'); return d.querySelector('.ag-sv-range .on')?.dataset.hours === '168' && d.querySelectorAll('.ag-sv-chart .sv-track').length === 7");
    check(`${tag}: Wechsel auf 7 Tage fragt den Server neu (168 Stunden) und zeigt eine Zeile je Tag`, JSON.stringify((await calls()).at(-1)) === JSON.stringify([DOOR, "state", 168]) && (await dlg("return d.querySelectorAll('.ag-sv-chart .sv-track').length")) === 7);

    // ----- Fest und scrollend -----
    const scroll = await dlg("const l=d.querySelector('.ag-sv-list'), f=d.querySelector('.ag-sv-fix'), th=d.querySelector('.ag-sv-table th'); const f0=f.getBoundingClientRect().top; const can=l.scrollHeight > l.clientHeight + 50; l.scrollTop=220; const lt=l.getBoundingClientRect().top; return { can, moved: l.scrollTop, fix: Math.abs(f.getBoundingClientRect().top - f0), th: Math.abs(th.getBoundingClientRect().top - lt), dlgScroll: d.scrollTop }");
    check(`${tag}: nur die Liste scrollt: Kopf, Kacheln und Grafik bleiben stehen, der Kopf der Tabelle klebt`, scroll.can && scroll.moved > 100 && scroll.fix < 1 && scroll.th < 1.5 && scroll.dlgScroll === 0, JSON.stringify(scroll));
    const rows = await dlg("return { n: d.querySelectorAll('.ag-sv-table tbody tr:not(.day)').length, days: d.querySelectorAll('.ag-sv-table tr.day').length, text: d.querySelector('.ag-sv-table').innerText, note: d.querySelector('.ag-sv-note')?.textContent || '' }");
    check(`${tag}: Liste nach Tagen gruppiert, mit Öffnungen, Ausfall und Zustand der Anlage`, rows.n >= 20 && rows.days >= 6 && rows.text.includes(t.opened) && rows.text.includes(t.gone), `${rows.n}/${rows.days}`);
    await s.page.screenshot({ path: `${outDir}sensor-door-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await dlg("d.querySelector('.ag-sv-range [data-hours=\"720\"]').click(); return 1");
    await s.waitFor("const d=r.getElementById('ag-sensor'); return d.querySelectorAll('.ag-sv-chart .sv-track').length === 30");
    check(`${tag}: 30 Tage: 30 Zeilen, Hinweis, wie weit die Liste reicht`, (await dlg("return d.querySelector('.ag-sv-note')?.textContent || ''")).includes(t.from));
    // 1.39.0: Reiter verteilen sich immer gleichmässig und kürzen zu langen Text mit "…" statt hart abzuschneiden
    check(`${tag}: Reiter sind gleich breit und füllen die Leiste (kein Leerraum rechts)`, await dlg("const bar=d.querySelector('.ag-sv-tiles'); const b=[...bar.querySelectorAll('.ag-sv-tile')]; const w=b.map((x) => x.getBoundingClientRect().width); const last=b[b.length-1].getBoundingClientRect().right; return Math.max(...w) - Math.min(...w) <= 2 && bar.getBoundingClientRect().right - last <= 6"));
    check(`${tag}: Beschriftung und Wert der Reiter kürzen mit Auslassungspunkten`, await dlg("return [...d.querySelectorAll('.ag-sv-tx small, .ag-sv-tx b')].every((e) => { const c=getComputedStyle(e); return c.textOverflow === 'ellipsis' && c.overflow === 'hidden'; })"));
    // 1.44.0: Handy: Symbol plus Kurztext (Verlauf und Gerät mit Wort, Batterie und Empfang mit Wert, nichts gekürzt); Desktop bleibt wie es war
    check(`${tag}: ${mobile ? "Handy: jede Kachel zeigt Symbol und Kurztext, nichts wird gekürzt, Verlauf und Gerät tragen ihr Wort, Batterie und Empfang den Wert" : "Desktop und Tablet: Symbol über Beschriftung und Wert"}`, await dlg(`const t=[...d.querySelectorAll('.ag-sv-tile')]; const vis=(e) => e && getComputedStyle(e).display !== 'none'; const cut=(e) => e.scrollWidth > e.clientWidth + 1; if (${mobile}) return t.length >= 3 && t.every((b) => vis(b.querySelector('.ag-sv-ti')) && ![...b.querySelectorAll('.ag-sv-tx small, .ag-sv-tx b')].filter(vis).some(cut)) && t.filter((b) => ['state','device'].includes(b.dataset.tab)).every((b) => vis(b.querySelector('small')) && !vis(b.querySelector('b'))) && t.filter((b) => ['battery','signal'].includes(b.dataset.tab)).every((b) => vis(b.querySelector('b')) && !vis(b.querySelector('small'))); return t.every((b) => vis(b.querySelector('small')) && vis(b.querySelector('b')) && vis(b.querySelector('.ag-sv-ti')) && b.querySelector('.ag-sv-ti').getBoundingClientRect().bottom <= b.querySelector('.ag-sv-tx').getBoundingClientRect().top + 1);`));
    check(`${tag}: kein seitlicher Überlauf im Fenster`, await dlg("return d.scrollWidth <= d.clientWidth + 1 && [...d.querySelectorAll('.ag-sv-fix > *')].every((e) => e.getBoundingClientRect().right <= d.getBoundingClientRect().right + 1 || e.classList.contains('ag-sv-tiles'))"));

    // ----- Sprung zum Alarm im Protokoll -----
    await dlg("d.querySelector('.ag-sv-range [data-hours=\"24\"]').click(); return 1");
    await loaded('[data-sv="alarm"]');
    check(`${tag}: Ereignis mit Alarm trägt die Marke "${t.alarm}"`, (await dlg("return d.querySelector('[data-sv=\"alarm\"]').textContent.trim()")) === t.alarm);
    await dlg("d.querySelector('[data-sv=\"alarm\"]').click(); return 1");
    check(`${tag}: Tipp darauf schliesst das Fenster und zeigt den Alarm im Protokoll`, await s.waitFor("return !r.getElementById('ag-sensor').open && r.host._tab === 'log' && r.host.log.open.has('rec-1')"));
    await s.tap('[data-tab="overview"]');
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${MOTION}"]')`);

    // ----- Bewegung: Balken und Raster -----
    await openSensor(MOTION);
    check(`${tag}: Bewegung, 1 Tag: Balken je Stunde`, await dlg(`const b=d.querySelectorAll('.ag-sv-chart .sv-count').length; return b >= 24 && b <= 25 && d.querySelector('.ag-sv-table').innerText.includes(${JSON.stringify(t.motion)})`));
    await dlg("d.querySelector('.ag-sv-range [data-hours=\"168\"]').click(); return 1");
    check(`${tag}: Bewegung, 7 Tage: Raster Tag x Stunde (7 x 24 Felder) mit Skala`, await s.waitFor("const d=r.getElementById('ag-sensor'); return d.querySelectorAll('.ag-sv-chart [data-v]').length === 168 && !!d.querySelector('.ag-sv-scale')"));
    await s.page.screenshot({ path: `${outDir}sensor-motion-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    // ----- Batterie und Empfang -----
    await dlg("d.querySelector('[data-sv=\"tab\"][data-tab=\"battery\"]').click(); return 1");
    await loaded(".ag-sv-chart .sv-line");
    check(`${tag}: Kachel Batterie: Zeiträume 30 Tage, 90 Tage, 1 Jahr; Abfrage über 90 Tage`, JSON.stringify(await seg()) === JSON.stringify(t.bat.map((v, i) => (i === 1 ? `${v}*` : v))) && JSON.stringify((await calls()).at(-1)) === JSON.stringify([MOTION, "battery", 2160]), JSON.stringify(await seg()));
    check(`${tag}: Batterie: Linie mit Schwelle, Batteriewechsel und Prognose`, await dlg("const c=d.querySelector('.ag-sv-chart svg'); return !!c.querySelector('.sv-thr') && !!c.querySelector('.sv-mark') && !!c.querySelector('.sv-line.dash') && d.querySelectorAll('.ag-sv-kpi').length >= 3 && d.querySelectorAll('.ag-sv-table tbody tr').length > 5"));
    // 1.68.0: Änderung je Tag in der Schreibweise der Sprache (Deutsch "−0,6 %", Englisch "−0.6 %"; vorher überall "0.6")
    const changes = await dlg("return [...d.querySelectorAll('.ag-sv-table tbody tr')].map((tr) => tr.cells[2].textContent)");
    check(`${tag}: Batterie: Spalte "Änderung" mit Dezimalzeichen der Sprache`, changes.some((c) => /\d[.,]\d/.test(c)) && changes.every((c) => !(lang === "de" ? /\d\.\d/ : /\d,\d/).test(c)), JSON.stringify(changes.slice(0, 6)));
    await s.page.screenshot({ path: `${outDir}sensor-battery-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await dlg("d.querySelector('[data-sv=\"tab\"][data-tab=\"signal\"]').click(); return 1");
    await loaded(".ag-sv-chart .sv-zone");
    check(`${tag}: Kachel Empfang: Linie mit den Zonen gut, mittel, schwach`, (await dlg("return d.querySelectorAll('.ag-sv-chart .sv-zone').length")) === 3 && (await calls()).at(-1)[1] === "signal");

    // ----- Gerät -----
    await dlg("d.querySelector('[data-sv=\"tab\"][data-tab=\"device\"]').click(); return 1");
    check(`${tag}: Kachel Gerät: Angaben zum Gerät und wo es überwacht wird, ohne Schalter oder Eingaben`, await s.waitFor(`const d=r.getElementById('ag-sensor'); const v=d.querySelector('.ag-sv-device'); return !!v && v.innerText.includes(${JSON.stringify(t.maker)}) && v.innerText.includes('Haus') && !d.querySelector('.ag-toggle, input, select')`));
    // Copy-to-Clipboard hinter jeder Angabe; kopiert wird der ganze Wert
    await dlg("window.__copied = []; const w = d.ownerDocument.defaultView; Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: (v) => { window.__copied.push(v); return Promise.resolve(); } } }); return 1");
    check(`${tag}: Gerät: hinter jeder Angabe ein Kopieren-Knopf (Hersteller, Modell, Firmware, Integration, Bereich, Entität)`, await dlg("const rows=[...d.querySelector('.ag-sv-device .ag-sv-dcard').querySelectorAll('.ag-sv-drow')]; return rows.length >= 4 && rows.every((x) => !!x.querySelector('[data-sv=copy]'))"));
    await dlg("const rows=[...d.querySelector('.ag-sv-device .ag-sv-dcard').querySelectorAll('.ag-sv-drow')]; rows[rows.length - 1].querySelector('[data-sv=copy]').click(); return 1");
    check(`${tag}: Kopieren legt den ganzen Wert der Entität in die Zwischenablage und zeigt ein Häkchen`, await s.waitFor("const d=r.getElementById('ag-sensor'); const rows=[...d.querySelector('.ag-sv-device .ag-sv-dcard').querySelectorAll('.ag-sv-drow')]; const last=rows[rows.length-1]; const v=last.querySelector('b').textContent; return window.__copied?.length === 1 && window.__copied[0] === v && v.includes('.') && last.querySelector('.ag-sv-copy').classList.contains('done')"));
    await dlg("d.querySelector('[data-sv=\"config\"]').click(); return 1");
    check(`${tag}: "In der Konfiguration zeigen" führt zu Konfiguration, Sensoren`, await s.waitFor("return !r.getElementById('ag-sensor').open && r.host._tab === 'config' && r.host._sub === 'sensors'"));
    // Handy: das Blatt des Sensors öffnet sich nach dem Wechsel etwas später; erst warten, dann schliessen (sonst fängt es den Tipp ab)
    if (mobile && (await s.waitFor("return r.getElementById('ag-sheet').open"))) await s.tap('#ag-sheet .ag-dlg-btns [data-sen="close-detail"]');
    await s.tap('[data-tab="overview"]');
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${GARAGE}"]')`);

    // ----- Kacheln nur mit Daten, Fehler, Schliessen -----
    await openSensor(GARAGE);
    check(`${tag}: Gerät am Netz: keine Kachel "${t.tabs[1]}"`, JSON.stringify(await tiles()) === JSON.stringify([`${t.tabs[0]}*`, t.tabs[2], t.tabs[3]]), JSON.stringify(await tiles()));
    await dlg("d.querySelector(':scope > .ag-dlg-x').click(); return 1");
    check(`${tag}: X schliesst das Fenster`, await s.waitFor("return !r.getElementById('ag-sensor').open"));
    await s.sim('window.__sensorHistory = () => Promise.reject({ code: "unknown_error", message: "kaputt" })');
    await s.tap(`[data-act="more"][data-entity="${DOOR}"]`);
    check(`${tag}: Fehler beim Laden: Hinweis mit "Erneut versuchen", Kopf und Kacheln bleiben`, await s.waitFor(`const d=r.getElementById('ag-sensor'); return d.open && d.innerText.includes(${JSON.stringify(t.error)}) && !!d.querySelector('[data-sv="retry"]') && d.querySelectorAll('.ag-sv-tile').length === 4`));
    await s.sim("window.__sensorHistory = null");
    await dlg("d.querySelector('[data-sv=\"retry\"]').click(); return 1");
    check(`${tag}: "Erneut versuchen" lädt den Verlauf`, await loaded(".ag-sv-chart svg"));
    if (!mobile) {
      await s.page.keyboard.press("Escape");
      check(`${tag}: Esc schliesst das Fenster`, await s.waitFor("return !r.getElementById('ag-sensor').open"));
    }
    check(`${tag}: kein Überlauf der Seite`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));
    check(`${tag}: keine Fehler im Browser`, s.errors.filter((e) => !e.includes("kaputt")).length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
