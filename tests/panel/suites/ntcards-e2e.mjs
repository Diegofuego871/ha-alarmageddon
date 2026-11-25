// 1.69.0: Konfiguration › Meldungen im neuen Design (Wunsch des Nutzers 2026-11-19, 22:20 und 22:27; Entscheid 23:01: Variante C, Störung rot,
// Wartung orange, "Fehlversuche", Einstellungen weiterhin auf der Seite gespeichert, ungespeicherte Änderungen markiert wie überall). Jede Meldung
// ist eine Karte wie die festen Meldungen unter Aktionen (seit 1.90.0 Symbol, Schalter, Titel, Kurzfassung, Play, Stift); der Stift öffnet das Fenster
// #ag-ntkind. Das Fenster ändert nur den Entwurf: "Übernehmen" behält, "Abbrechen", X und Escape stellen nach einer Rückfrage den Stand beim
// Öffnen wieder her; gespeichert wird allein mit "Speichern" unten. Zahlen einheitlich: Beschriftung links, Felder in einer Flucht, Hinweis
// darunter. Je Sprache, Desktop und Handy, echte Klicks und Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { chapters: ["Standard-Empfänger", "Störungsmeldungen", "Wartungsmeldungen"], battery: "Batterie schwach", below: "unter 20 %", below25: "unter 25 %", checks: "nach 3 Prüfungen",
    fails: "nach 2 Fehlversuchen", unsaved: "Noch nicht gespeichert", sections: ["Meldung senden", "Empfänger", "Zustellung", "Einstellungen"], threshold: "Schwach unter", after: "Meldung nach",
    unit: "Prüfungen", range: "Meldung nach: 1 bis 10 Prüfungen.", saveFirst: "Zuerst speichern", off: "ausgeschaltet", edit: "Batterie schwach bearbeiten", one: "1 Änderung", scope: "Alles darunter gilt nur für" },
  en: { chapters: ["Standard recipients", "Fault messages", "Maintenance messages"], battery: "Low battery", below: "below 20 %", below25: "below 25 %", checks: "after 3 checks",
    fails: "after 2 failed attempts", unsaved: "Not saved yet", sections: ["Send the message", "Recipients", "Delivery", "Settings"], threshold: "Low below", after: "Message after",
    unit: "checks", range: "Message after: 1 to 10 checks.", saveFirst: "Save first", off: "switched off", edit: "Edit Low battery", one: "1 change", scope: "Everything below applies to" },
};
const CARD = (kind, mode = "") => `.ag-ntk[data-ntk="${kind}"]${mode ? `[data-mode="${mode}"]` : ":not([data-mode])"}`;
const DLG = "#ag-ntkind";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "notify" } });
    await s.waitFor(`return !!r.querySelector('${CARD("battery_low")}')`);
    await s.sim("window.__notify.maintenance_targets = ['notify.mobile_app_diego']; window.__notify.types.sensor_unavailable.enabled = false; return 1");
    await s.ev("r.host._fetch(); return 1");
    await s.waitFor("return r.host._data?.notify?.maintenance_targets?.length === 1");
    await s.ev("r.host.notify.reset(); r.host.notify.render(); return 1");

    // ----- Aufbau: drei Kapitel, Karten in der Reihenfolge der Kapitel -----
    const page = await s.ev(`const chaps=[...r.querySelectorAll('.ag-nt > .ag-chap, .ag-nt .ag-chap')].filter((c, i, a) => a.indexOf(c) === i);
      const kinds=(c) => [...c.querySelectorAll('.ag-ntk')].map((x) => x.dataset.ntk);
      return { titles: chaps.map((c) => c.querySelector('.ag-chap-t').textContent), recip: !!chaps[0].querySelector('[data-nt="target-add"]') && !chaps[0].querySelector('.ag-ntk'),
        alarm: kinds(chaps[1]), maint: kinds(chaps[2]), old: !!r.querySelector('.ag-nt .ag-mt'), wide: r.host._content.scrollWidth - r.host._content.clientWidth }`);
    // Wartungsmeldungen tragen denselben Rahmen wie die Störungsmeldungen (Wunsch des Nutzers 2026-11-23)
    check(`${tag}: Wartungsmeldungen stehen im gleichen Rahmen wie die Störungsmeldungen (gleiche Linie, gleiche Rundung)`, await s.ev(`const chaps=[...r.querySelectorAll('.ag-nt .ag-chap')]; const f=(c) => { const g=c.querySelector('.ag-pmgroup'); if (!g) return null; const st=getComputedStyle(g); return [st.borderTopWidth, st.borderTopLeftRadius, g.querySelectorAll('.ag-ntk').length]; }; const a=f(chaps[1]), m=f(chaps[2]); return !!a && !!m && a[1] === m[1] && m[0] === a[0] && parseFloat(m[0]) >= 1 && m[2] === 4`));
    // 1.87.0: dazu "Weiterer Sensor während eines Alarms" und "Codes nach Fehleingaben gesperrt"
    check(`${tag}: drei Kapitel ${t.chapters.join(", ")}; Störung: Ausfall, Scharfschalten, weiterer Sensor im Alarm, Codes gesperrt; Wartung: Batterie, nicht erreichbar, Selbsttest, HealthCheck; keine alten Zeilen`,
      JSON.stringify(page.titles) === JSON.stringify(t.chapters) && page.recip && JSON.stringify(page.alarm) === '["sensor_offline","arm_failed","alarm_again","code_locked"]'
      && JSON.stringify(page.maint) === '["battery_low","sensor_unavailable","selftest","healthcheck"]' && !page.old && page.wide <= 1, JSON.stringify(page));

    // 1.87.0: die neuen Störungsmeldungen sind Karten wie die anderen (Titel, Play, Stift, an); "Weiterer Sensor" ist standardmässig kritisch
    const fresh = await s.ev(`return ['alarm_again', 'code_locked'].map((k) => { const c=r.querySelector('.ag-ntk[data-ntk="' + k + '"]:not([data-mode])'); if (!c) return null; const p=c.querySelector('[data-nt="test"]');
      return { title: c.querySelector('.ag-wf-text b').textContent, sum: c.querySelector('.ag-wf-text small').textContent, play: !!p && !p.disabled, pen: !!c.querySelector('[data-nt="edit"]'),
        on: c.querySelector('[data-nt="enabled"]').getAttribute('aria-checked') }; })`);
    const fr = lang === "de" ? { again: "Weiterer Sensor während eines Alarms", locked: "Codes nach Fehleingaben gesperrt", crit: "kritisch" } : { again: "Another sensor during an alarm", locked: "Codes locked after wrong entries", crit: "critical" };
    check(`${tag}: neue Karten "${fr.again}" (kritisch) und "${fr.locked}" mit Play und Stift, eingeschaltet`, fresh.every((x) => x && x.play && x.pen && x.on === "true")
      && fresh[0].title === fr.again && fresh[1].title === fr.locked && fresh[0].sum.toLowerCase().includes(fr.crit) && !fresh[1].sum.toLowerCase().includes(fr.crit), JSON.stringify(fresh));

    // ----- Raster: am Computer zwei Spalten, auf dem Handy eine -----
    const grid = await s.ev(`const cards=[...r.querySelectorAll('.ag-chap:nth-of-type(3) .ag-ntk, .ag-nt .ag-ntk-grid')].length; const g=[...r.querySelectorAll('.ag-nt .ag-ntk-grid')].at(-1);
      const b=[...g.children].map((c) => c.getBoundingClientRect()); const gb=g.getBoundingClientRect();
      return { lefts: [...new Set(b.map((x) => Math.round(x.left)))].length, sameRow: Math.round(b[0].top) === Math.round(b[1].top), full: Math.abs(b[0].width - gb.width) <= 1, cards }`);
    check(`${tag}: ${mobile ? "eine Spalte über die ganze Breite" : "zwei Spalten nebeneinander"}`, mobile ? grid.lefts === 1 && grid.full && !grid.sameRow : grid.lefts === 2 && grid.sameRow, JSON.stringify(grid));

    // ----- Farben des Kapitels: der Streifen links steht am Rahmen um die Karten (Störung rot, Wartung orange), nicht an den einzelnen Karten (Wunsch des Nutzers 2026-11-23) -----
    const colors = await s.ev(`const probe=(v) => { const x=document.createElement('span'); x.style.color='var(' + v + ')'; r.querySelector('.ag-nt').appendChild(x); const c=getComputedStyle(x).color; x.remove(); return c; };
      const grp=(sel) => getComputedStyle(r.querySelector(sel)); const card=(k) => { const c=getComputedStyle(r.querySelector('.ag-ntk[data-ntk="' + k + '"]')); return c.borderLeftWidth === c.borderTopWidth; }; const icon=(k) => getComputedStyle(r.querySelector('.ag-ntk[data-ntk="' + k + '"] .ag-ntk-icon')).backgroundColor;
      return { fault: grp('.ag-ntgrp.fault').borderLeftColor, maint: grp('.ag-ntgrp.maint').borderLeftColor, faultW: grp('.ag-ntgrp.fault').borderLeftWidth, maintW: grp('.ag-ntgrp.maint').borderLeftWidth,
        cards: ['sensor_offline', 'arm_failed', 'battery_low', 'selftest', 'sensor_unavailable'].map(card), red: probe('--ag-error'), orange: probe('--ag-warning'),
        iconFault: icon('arm_failed'), iconMaint: icon('selftest'), iconOff: icon('sensor_unavailable') }`);
    check(`${tag}: Streifen links am Rahmen: rot (Störung), orange (Wartung); die Karten tragen keinen eigenen Streifen; Symbole getönt`, colors.fault === colors.red && colors.maint === colors.orange && colors.faultW === "5px" && colors.maintW === "5px"
      && colors.cards.every(Boolean) && colors.iconFault !== colors.iconMaint && colors.iconOff !== colors.iconMaint, JSON.stringify(colors));

    // ----- Karte: Symbol links (seit 1.90.0 vor dem Schalter, Vorgabe des Nutzers "Icon immer oben links"), Schalter, Titel, Kurzfassung, Play und Stift -----
    const card = await s.ev(`const c=r.querySelector('${CARD("battery_low")}'); const tg=c.querySelector('[data-nt="enabled"]').getBoundingClientRect(); const ico=c.querySelector('.ag-ntk-icon').getBoundingClientRect();
      const tx=c.querySelector('.ag-wf-text').getBoundingClientRect(); const play=c.querySelector('[data-nt="test"]'); const pen=c.querySelector('[data-nt="edit"]');
      return { order: ico.right <= tg.left && tg.right <= tx.left, title: c.querySelector('.ag-wf-text b').textContent, sum: c.querySelector('.ag-wf-text small').textContent,
        play: !!play && !play.disabled, pen: pen?.getAttribute('aria-label'), hc: r.querySelector('${CARD("healthcheck")} .ag-wf-text small').textContent,
        offPlay: r.querySelector('${CARD("sensor_unavailable")} [data-nt="test"]').disabled, offTip: r.querySelector('${CARD("sensor_unavailable")} [data-nt="test"]').title,
        offSum: r.querySelector('${CARD("sensor_unavailable")} .ag-wf-text small').textContent, marks: r.querySelectorAll('.ag-nt .ag-unsaved').length }`);
    check(`${tag}: Karte "${t.battery}": Symbol, Schalter, Text von links nach rechts; Kurzfassung "${t.below} · ${t.checks}"; Play frei, Stift "${t.edit}"`,
      card.order && card.title === t.battery && card.sum.includes(t.below) && card.sum.includes(t.checks) && card.play && card.pen === t.edit && card.marks === 0, JSON.stringify(card));
    check(`${tag}: HealthCheck "${t.fails}"; ausgeschaltete Meldung: Play gesperrt ("${t.off}")`, card.hc.includes(t.fails) && card.offPlay && card.offTip.includes(t.off) && card.offSum.length < 8, JSON.stringify(card));

    // ----- Fenster: Abschnitte, einheitliche Zahlenzeilen -----
    await s.tap(`${CARD("battery_low")} [data-nt="edit"]`);
    await s.waitFor(`return r.getElementById('ag-ntkind').open`);
    const win = await s.ev(`const d=r.getElementById('ag-ntkind'); const rows=[...d.querySelectorAll('.ag-ntk-num')].map((n) => { const l=n.querySelector('.ag-ntk-nl').getBoundingClientRect(); const i=n.querySelector('input').getBoundingClientRect();
        const u=n.querySelector('.ag-ntk-unit').getBoundingClientRect(); const h=n.querySelector('.ag-ntk-nh')?.getBoundingClientRect(); return { label: n.querySelector('.ag-ntk-nl').textContent, unit: n.querySelector('.ag-ntk-unit').textContent,
        li: l.right <= i.left, iu: i.right <= u.left, mid: Math.abs((l.top + l.bottom) / 2 - (i.top + i.bottom) / 2) <= 12, x: Math.round(i.left), hintBelow: h ? h.top >= i.bottom - 1 && h.left <= l.left + 1 : null }; });
      return { title: d.querySelector('.ag-sys-top h3').textContent, secs: [...d.querySelectorAll('.ag-sec-t')].map((x) => x.textContent), rows, wide: d.querySelector('.ag-dlg-body').scrollWidth - d.querySelector('.ag-dlg-body').clientWidth,
        x: !!d.querySelector('.ag-dlg-x'), btns: [...d.querySelectorAll('.ag-dlg-btns .ag-btn')].map((b) => b.dataset.nt), test: !!d.querySelector('[data-nt="test"][data-kind="battery_low"]') }`);
    check(`${tag}: Fenster "${t.battery}" mit X, Abschnitten ${t.sections.join(", ")}, Testmeldung, "Abbrechen" und "Übernehmen"`,
      win.title === t.battery && JSON.stringify(win.secs) === JSON.stringify(t.sections) && win.x && JSON.stringify(win.btns) === '["kind-cancel","kind-apply"]' && win.test && win.wide <= 1, JSON.stringify(win));
    check(`${tag}: Zahlen einheitlich: "${t.threshold}" und "${t.after}" links, Felder in einer Flucht, Einheit rechts, Hinweis darunter`,
      win.rows.length === 2 && win.rows[0].label === t.threshold && win.rows[1].label === t.after && win.rows[1].unit === t.unit && win.rows.every((x) => x.li && x.iu && x.mid)
      && win.rows[0].x === win.rows[1].x && win.rows[1].hintBelow === true, JSON.stringify(win.rows));

    // ----- Übernehmen: nur der Entwurf, Karte markiert, nichts gespeichert -----
    const thr = await s.el(`${DLG} [data-nt="num"][data-key="battery_threshold"]`);
    await thr.fill("25");
    await thr.dispatchEvent("input");
    await s.tap(`${DLG} [data-nt="kind-apply"]`);
    const applied = await s.waitFor(`return !r.getElementById('ag-ntkind').open && r.querySelector('${CARD("battery_low")} .ag-wf-text small').textContent.includes(${JSON.stringify(t.below25)})`)
      && await s.ev(`const c=r.querySelector('${CARD("battery_low")}'); return { mark: c.querySelector('.ag-unsaved')?.textContent, others: r.querySelectorAll('.ag-nt .ag-unsaved').length, foot: r.querySelector('.ag-foot').innerText,
        dot: r.querySelector('[data-sub="notify"]').classList.contains('has-edit'), play: c.querySelector('[data-nt="test"]').disabled, tip: c.querySelector('[data-nt="test"]').title }`);
    const simThr = await s.sim("return window.__notify.battery_threshold");
    check(`${tag}: "Übernehmen": Karte "${t.below25}" mit "${t.unsaved}" (orange Punkt), unten "${t.one}", Punkt am Reiter, Play gesperrt; nichts gespeichert`,
      applied && applied.mark === t.unsaved && applied.others === 1 && applied.foot.includes(t.one) && applied.dot && applied.play && applied.tip.includes(t.saveFirst) && simThr === 20, JSON.stringify({ applied, simThr }));
    const dotColor = await s.ev(`const c=r.querySelector('${CARD("battery_low")} .ag-unsaved'); const a=getComputedStyle(c, '::before'); const x=document.createElement('span'); x.style.color='var(--ag-warning)'; c.appendChild(x); const w=getComputedStyle(x).color; x.remove(); return a.backgroundColor === w`);
    check(`${tag}: der Punkt ist orange wie überall ("ungespeichert")`, dotColor);

    // ----- Abbrechen mit Änderung: Rückfrage, dann der Stand beim Öffnen -----
    await s.tap(`${CARD("battery_low")} [data-nt="edit"]`);
    await s.waitFor(`return r.getElementById('ag-ntkind').open`);
    await s.tap(`${DLG} [data-nt="critical"][data-kind="battery_low"]`);
    await s.waitFor(`return !!r.querySelector('${DLG} [data-nt="volume"]')`);
    await s.tap(`${DLG} [data-nt="kind-cancel"]`);
    check(`${tag}: "Abbrechen" mit Änderung fragt zuerst`, await s.waitFor("return r.getElementById('ag-confirm').open"));
    await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: verworfen: Kritisch wieder aus, die übernommene Schwelle bleibt (eine Änderung)`, await s.waitFor(`return !r.getElementById('ag-ntkind').open && !r.host.notify.draft.types.battery_low.critical && r.host.notify.draft.battery_threshold === 25 && r.host.notify.dirtyCount() === 1`));

    // ----- Escape: mit Änderung Rückfrage ("Nein" lässt das Fenster offen), ohne Änderung schliesst es sofort -----
    await s.tap(`${CARD("battery_low")} [data-nt="edit"]`);
    await s.waitFor(`return r.getElementById('ag-ntkind').open`);
    await s.tap(`${DLG} [data-nt="persistent"][data-kind="battery_low"]`);
    await s.waitFor(`return r.host.notify.draft.types.battery_low.persistent === true`);
    await s.page.keyboard.press("Escape");
    check(`${tag}: Escape mit Änderung fragt`, await s.waitFor("return r.getElementById('ag-confirm').open"));
    await s.tap('#ag-confirm [data-c="no"]');
    check(`${tag}: "Abbrechen" in der Rückfrage: Fenster bleibt offen, Änderung bleibt`, await s.waitFor("return !r.getElementById('ag-confirm').open && r.getElementById('ag-ntkind').open && r.host.notify.draft.types.battery_low.persistent === true"));
    await s.tap(`${DLG} .ag-dlg-x`);
    await s.waitFor("return r.getElementById('ag-confirm').open");
    await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: X mit Änderung: nach der Rückfrage verworfen`, await s.waitFor("return !r.getElementById('ag-ntkind').open && !r.host.notify.draft.types.battery_low.persistent && r.host.notify.dirtyCount() === 1"));
    await s.tap(`${CARD("battery_low")} [data-nt="edit"]`);
    await s.waitFor(`return r.getElementById('ag-ntkind').open`);
    await s.page.keyboard.press("Escape");
    check(`${tag}: Escape ohne Änderung schliesst ohne Rückfrage`, await s.waitFor("return !r.getElementById('ag-ntkind').open && !r.getElementById('ag-confirm').open && r.host.notify.kindEdit === null"));

    // ----- Ungültige Zahl: "Übernehmen" bleibt im Fenster und nennt den Bereich -----
    await s.tap(`${CARD("battery_low")} [data-nt="edit"]`);
    await s.waitFor(`return r.getElementById('ag-ntkind').open`);
    const checks = await s.el(`${DLG} [data-nt="num"][data-key="battery_checks"]`);
    await checks.fill("0");
    await checks.dispatchEvent("input");
    await s.tap(`${DLG} [data-nt="kind-apply"]`);
    check(`${tag}: 0 Prüfungen: Feld rot, Fenster bleibt offen mit "${t.range}"`, await s.waitFor(`const d=r.getElementById('ag-ntkind'); return d.open && d.querySelector('.ag-dlg-err').textContent === ${JSON.stringify(t.range)} && d.querySelector('[data-num="battery_checks"] .ag-num').classList.contains('bad')`));
    const checks2 = await s.el(`${DLG} [data-nt="num"][data-key="battery_checks"]`);
    await checks2.fill("4");
    await checks2.dispatchEvent("input");
    await s.tap(`${DLG} [data-nt="kind-apply"]`);
    check(`${tag}: 4 Prüfungen: übernommen`, await s.waitFor(`return !r.getElementById('ag-ntkind').open && r.host.notify.draft.battery_checks === 4 && r.host.notify.dirtyCount() === 2`));

    // ----- Speichern auf der Seite -----
    await s.tap('.ag-foot [data-nt="save"]');
    const saved = await s.waitFor("return r.host.notify.dirtyCount() === 0 && !r.host.notify.saving && !r.querySelector('.ag-nt .ag-unsaved')") && await s.sim("return { t: window.__notify.battery_threshold, c: window.__notify.battery_checks }");
    const after = await s.ev(`return { dot: r.querySelector('[data-sub="notify"]').classList.contains('has-edit'), play: r.querySelector('${CARD("battery_low")} [data-nt="test"]').disabled }`);
    check(`${tag}: "Speichern": Schwelle 25, 4 Prüfungen; Markierung und Punkt am Reiter weg, Play wieder frei`, saved && saved.t === 25 && saved.c === 4 && !after.dot && !after.play, JSON.stringify({ saved, after }));

    // ----- Einstellungen pro Modus: die Karte des Modus, im Fenster der Hinweis auf den Modus -----
    await s.tap('[data-nt="permode"]');
    await s.waitFor(`return !!r.querySelector('${CARD("sensor_offline", "home")}, ${CARD("sensor_offline", "away")}')`);
    const mode = await s.ev("return r.host.notify.modeTab");
    await s.tap(`${CARD("sensor_offline", mode)} [data-nt="edit"]`);
    await s.waitFor(`return r.getElementById('ag-ntkind').open`);
    const mwin = await s.ev(`const d=r.getElementById('ag-ntkind'); return { scope: d.querySelector(':scope .ag-pmscope')?.textContent || '', origin: !!d.querySelector('.ag-origin') }`);
    await s.tap(`${DLG} [data-nt="critical"][data-kind="sensor_offline"][data-mode="${mode}"]`);
    await s.waitFor(`return !!r.querySelector('${DLG} [data-nt="mode-reset"]')`);
    await s.tap(`${DLG} [data-nt="kind-apply"]`);
    const mcard = await s.waitFor(`return !r.getElementById('ag-ntkind').open && !!r.querySelector('${CARD("sensor_offline", mode)} [data-nt="mode-reset"]') && !!r.querySelector('${CARD("sensor_offline", mode)} .ag-unsaved')`);
    check(`${tag}: pro Modus: Fenster nennt "${t.scope} …"; ein eigener Wert erscheint auf der Karte mit Zurücksetzen und Markierung`, mwin.scope.includes(t.scope) && mwin.origin && mcard, JSON.stringify(mwin));
    await s.tap('.ag-foot [data-nt="cancel"]');
    check(`${tag}: "Abbrechen" unten verwirft alles`, await s.waitFor("return r.host.notify.dirtyCount() === 0 && !r.querySelector('.ag-nt .ag-unsaved') && !r.querySelector('[data-nt=\"permode\"]').classList.contains('on')"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
