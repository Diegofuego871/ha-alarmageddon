// Symbole der Zeilen (1.90.0, Wünsche des Nutzers 2026-11-25, Mockup docs/mockups/symbole-v1): "das Icon soll immer oben links, im weissen Bereich
// sein", "Schalter sind immer links vor dem Text". Jede Zeile mit Symbol: zuerst die Kachel, oben auf der Höhe des Textes, dann der Schalter (mittig auf
// der Kachel), dann der Text. "Einstellungen pro Modus" trägt auf allen vier Seiten das Symbol "tune". Dazu: das Kapitel "Zeiten" (eine Karte mit
// Ausgangs-, Eingangsverzögerung und Bestätigungsfenster, ohne Untertitel), "Höchstens" als Unteroption des Nachalarms (ohne Strich, eingerückt bis zum
// Text des Nachalarms), die Symbole der Empfänger und von "Anlage löschen", das Fenster "Voreinstellungen" so breit wie das Panel dahinter und das
// Fenster "Sensoren hinzufügen" am Computer immer gleich hoch (Suche und Knöpfe bleiben an ihrem Ort). Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const T = { de: { times: "Zeiten", old: "Zeiten und Verhalten" }, en: { times: "Times", old: "Times and behaviour" } };
const J = JSON.stringify;
// Prüft jede sichtbare Zeile mit eigener Kachel: Kachel ganz links, oben auf der Höhe des Textes (nie mittig neben langem Text), Schalter danach und mittig
// auf der Kachel, Text rechts vom Schalter
const GEO = (sel) => `const out = { n: 0, bad: [] };
  for (const row of r.querySelectorAll(${J(sel)})) {
    const o = row.querySelector(':scope > .ag-oav'); if (!o) continue;
    const q = o.getBoundingClientRect(); if (!q.width) continue;
    out.n++;
    const kids = [...row.children].filter((c) => c !== o && c.getBoundingClientRect().width);
    const tg = row.querySelector(':scope > .ag-toggle');
    const tx = kids.find((c) => c !== tg && c.textContent.trim());
    const name = (tx?.textContent || '').trim().slice(0, 30);
    if (!tx) { out.bad.push([name, 'kein Text']); continue; }
    const t = tx.getBoundingClientRect();
    // Auf dem Handy rutschen Felder und Knöpfe unter den Text (wie im Mockup): es zählt nur, was neben der Kachel steht
    if (kids.some((c) => { const b = c.getBoundingClientRect(); return b.top < q.bottom && b.bottom > q.top && b.left < q.right - 0.5; })) out.bad.push([name, 'Kachel nicht ganz links']);
    if (q.top > t.top + 2) out.bad.push([name, 'Kachel unter dem Textanfang', Math.round(q.top), Math.round(t.top)]);
    if (t.height > q.height * 1.5 && Math.abs(q.top - t.top) > 4) out.bad.push([name, 'Kachel nicht oben', Math.round(q.top), Math.round(t.top)]);
    if (tg) {
      const g = tg.getBoundingClientRect();
      if (g.left < q.right) out.bad.push([name, 'Schalter vor der Kachel']);
      if (t.left < g.right) out.bad.push([name, 'Text vor dem Schalter']);
      if (Math.abs((g.top + g.bottom) / 2 - (q.top + q.bottom) / 2) > 2) out.bad.push([name, 'Schalter nicht mittig auf der Kachel', Math.round(g.top), Math.round(q.top)]);
    }
  }
  return out;`;
const PMSW = "return [...r.querySelectorAll('.ag-pmsw')].filter((p) => p.getBoundingClientRect().width).map((p) => { const o = p.querySelector(':scope > .ag-oav'); return !!o && !!o.querySelector('svg') && o.classList.contains('on') === p.querySelector('.ag-toggle').classList.contains('on'); })";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const geo = async (where, sel, min, on = null) => {
      const g = await (on || cur).ev(GEO(sel));
      check(`${tag}: ${where}: ${g.n} Zeilen mit Kachel oben links, Schalter danach, Text rechts`, g.n >= min && g.bad.length === 0, J({ n: g.n, bad: g.bad.slice(0, 4) }));
    };
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&sensors=few" });
    let cur = s;
    await s.waitFor("return !!r.querySelector('[data-sys=\"permode\"]')", 10000);

    // ----- Konfiguration › Anlage -----
    const pm = await s.ev(PMSW);
    check(`${tag}: Anlage: "Einstellungen pro Modus" (Zeiten, Nachalarm) mit Symbol, blau wie der Schalter`, pm.length === 2 && pm.every(Boolean), J(pm));
    const times = await s.ev(`const c = [...r.querySelectorAll('.ag-chap')].find((x) => x.querySelector('.ag-chap-t')?.innerText.trim() === ${J(t.times)});
      if (!c) return null; const cards = [...c.querySelectorAll('.ag-card')];
      return { cards: cards.length, sub: !!c.querySelector('.ag-subh'), fields: [...cards[0].querySelectorAll('[data-field]')].map((i) => i.dataset.field).join(),
        icons: [...cards[0].querySelectorAll(':scope > .ag-setrow')].map((x) => !!x.querySelector(':scope > .ag-oav svg')).join(),
        old: [...r.querySelectorAll('.ag-chap-t')].some((h) => h.innerText.trim() === ${J(t.old)}) }`);
    check(`${tag}: Kapitel "${t.times}": eine Karte mit Ausgangs-, Eingangsverzögerung und Bestätigungsfenster, je mit Symbol, ohne Untertitel; kein "${t.old}"`,
      times && times.cards === 1 && !times.sub && times.fields === "exit_delay,entry_delay,confirm_window" && times.icons === "true,true,true" && !times.old, J(times));
    const codeIcons = await s.ev("return ['armcode', 'modecode', 'ackcode'].map((k) => !!r.querySelector(`[data-sys=\"${k}\"]`)?.parentElement.querySelector(':scope > .ag-oav svg'))");
    check(`${tag}: Schalter zum Code mit eigenem Symbol`, codeIcons.join() === "true,true,true", codeIcons.join());
    check(`${tag}: "Anlage löschen" mit rotem Symbol`, await s.ev("const o = r.querySelector('[data-sys=\"delete\"]')?.closest('.ag-card')?.querySelector('.ag-oav.ag-oav-danger'); return !!o && getComputedStyle(o).color !== getComputedStyle(r.querySelector('.ag-oav:not(.on):not(.ag-oav-danger)')).color"));
    // Nachalarm an: "Höchstens" ist eine Unteroption (ohne Symbol, ohne Strich, bündig mit dem Text des Nachalarms)
    if (await s.ev("return r.querySelector('[data-sys=\"realarm\"]').getAttribute('aria-checked') !== 'true'")) await s.tap('[data-sys="realarm"]');
    await s.waitFor("return !!r.querySelector('.ag-rowsub [data-sys=\"realarm-count\"]')", 5000);
    const sub = await s.ev(`const sub = r.querySelector('.ag-rowsub'); if (!sub) return null; const prev = sub.previousElementSibling;
      const a = prev.querySelector(':scope > .ag-otx').getBoundingClientRect(), b = sub.querySelector(':scope > .ag-settx').getBoundingClientRect();
      return { prev: prev.querySelector('[data-sys="realarm"]') ? 'realarm' : '', line: getComputedStyle(prev).borderBottomWidth, icon: !!sub.querySelector('.ag-oav'), dx: Math.round(b.left - a.left), gap: Math.round(b.top - a.bottom) }`);
    check(`${tag}: "Höchstens" direkt unter dem Nachalarm, ohne Strich und Symbol, bündig mit seinem Text`, !!sub && sub.prev === "realarm" && sub.line === "0px" && !sub.icon && Math.abs(sub.dx) <= 1 && sub.gap >= 0 && sub.gap <= 12, J(sub));
    await s.page.waitForTimeout(300);
    await geo("Anlage", ".ag-setrow, .ag-orow, .ag-pmsw", 14);

    // ----- Benachrichtigungen -----
    await s.tap('[data-sub="notify"]');
    await s.waitFor("return !!r.querySelector('[data-nt=\"permode\"]')", 8000);
    await s.page.waitForTimeout(400);
    const npm = await s.ev(PMSW);
    check(`${tag}: Benachrichtigungen: "Einstellungen pro Modus" mit Symbol`, npm.length === 1 && npm[0], J(npm));
    const recip = await s.ev("return [...r.querySelectorAll('.ag-recip')].map((x) => !!x.querySelector(':scope > .ag-oav svg'))");
    check(`${tag}: Empfänger von Alarmen und Wartung mit Symbol`, recip.join() === "true,true", recip.join());
    const cards = await s.ev("return [...r.querySelectorAll('.ag-ntk')].filter((k) => k.getBoundingClientRect().width).map((k) => { const i = k.querySelector(':scope > .ag-ntk-icon').getBoundingClientRect(), g = k.querySelector(':scope > .ag-toggle').getBoundingClientRect(); return i.right <= g.left; })");
    check(`${tag}: Karten der Meldungen: Symbol vor dem Schalter`, cards.length >= 6 && cards.every(Boolean), cards.join());
    await geo("Benachrichtigungen", ".ag-setrow, .ag-orow, .ag-pmsw", 3);

    // ----- Aktionen -----
    await s.tap('[data-sub="actions"]');
    await s.waitFor("return !!r.querySelector('[data-wf=\"permode\"]')", 8000);
    await s.page.waitForTimeout(400);
    const apm = await s.ev(PMSW);
    check(`${tag}: Aktionen: "Einstellungen pro Modus" mit Symbol`, apm.length === 1 && apm[0], J(apm));
    const notices = await s.ev("return [...r.querySelectorAll('.ag-wf-notice')].filter((k) => k.getBoundingClientRect().width && k.querySelector(':scope > .ag-toggle')).map((k) => { const i = k.querySelector(':scope > .ag-wf-icon').getBoundingClientRect(), g = k.querySelector(':scope > .ag-toggle').getBoundingClientRect(); return i.right <= g.left; })");
    check(`${tag}: feste Meldungen im Ablauf: Symbol vor dem Schalter`, notices.length >= 3 && notices.every(Boolean), notices.join());
    await geo("Aktionen", ".ag-pmsw", 1);

    // ----- Sensoren, Voreinstellungen, Sensoren hinzufügen -----
    await s.tap('[data-sub="sensors"]');
    await s.waitFor("return !!r.querySelector('[data-sen=\"permode\"]')", 8000);
    await s.page.waitForTimeout(400);
    const spm = await s.ev(PMSW);
    check(`${tag}: Sensoren: "Einstellungen pro Modus" mit Symbol`, spm.length === 1 && spm[0], J(spm));
    await geo("Sensoren", ".ag-pmsw", 1);
    // Einstellungen eines Sensors: dieselbe Reihenfolge; die Unteroption "Beim Scharfschalten umgehen" beginnt unter dem Schalter der Zeile darüber
    await s.tap('[data-sen="detail"][data-ent="binary_sensor.haustuer"]');
    await s.waitFor(mobile ? "return r.getElementById('ag-sheet').open" : "return !!r.querySelector('.ag-side .ag-sheet [data-key=\"bypass\"]')", 8000);
    await s.page.waitForTimeout(450);
    await geo("Einstellungen der Haustür", ".ag-orow, .ag-sheet .ag-setrow", 6);
    const osub = await s.ev(`const by = r.querySelector('[data-key="bypass"]').closest('.ag-orow'), close = by.previousElementSibling;
      return { sub: by.classList.contains('ag-osub'), dx: Math.round(by.querySelector(':scope > .ag-oav').getBoundingClientRect().left - close.querySelector(':scope > .ag-toggle').getBoundingClientRect().left) }`);
    check(`${tag}: "Beim Scharfschalten umgehen" eingerückt bis unter den Schalter von "Muss geschlossen sein"`, osub.sub && Math.abs(osub.dx) <= 1, J(osub));
    if (mobile) { await s.tap('#ag-sheet .ag-dlg-btns [data-sen="close-detail"]'); await s.waitFor("return !r.getElementById('ag-sheet').open", 5000); }
    else await s.tap('.ag-side [data-sen="close-detail"]');
    await s.page.waitForTimeout(300);

    const widths = mobile ? [390] : [1400, 2400];
    for (const w of widths) {
      if (!mobile) { await s.page.setViewportSize({ width: w, height: 1000 }); await s.page.waitForTimeout(400); }
      await s.tap('[data-sen="presets"]');
      await s.waitFor("return r.getElementById('ag-presets').open");
      await s.page.waitForTimeout(450);
      const p = await s.ev(`const d = r.getElementById('ag-presets').getBoundingClientRect(); const c = r.host._content; const cr = c.getBoundingClientRect(); const cs = getComputedStyle(c);
        const left = cr.left + parseFloat(cs.paddingLeft), width = cr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return { d: [Math.round(d.left), Math.round(d.width), Math.round(d.height)], c: [Math.round(left), Math.round(width)], vw: innerWidth, vh: innerHeight, over: document.documentElement.scrollWidth > innerWidth + 1 }`);
      const ok = mobile ? p.d[0] === 0 && p.d[1] === p.vw && Math.abs(p.d[2] - p.vh) <= 1 : Math.abs(p.d[0] - p.c[0]) <= 1 && Math.abs(p.d[1] - p.c[1]) <= 1;
      check(`${tag}${mobile ? "" : ` ${w}px`}: Voreinstellungen ${mobile ? "über den ganzen Bildschirm" : "so breit wie das Panel dahinter und bündig"}`, ok && !p.over, J(p));
      await s.ev("r.getElementById('ag-presets').close(); return 1");
      await s.page.waitForTimeout(200);
    }
    if (!mobile) { await s.page.setViewportSize({ width: 1400, height: 950 }); await s.page.waitForTimeout(400); }

    await s.tap('.ag-tools [data-sen="add"]');
    await s.waitFor("return !!r.querySelector('#ag-pick [data-sen=\"pick-toggle\"]')", 8000);
    await s.page.waitForTimeout(450);
    const POS = "const d = r.getElementById('ag-pick'); const q = d.querySelector('[data-sen=\"pick-q\"]').getBoundingClientRect(), b = d.querySelector('[data-sen=\"pick-add\"]').getBoundingClientRect(), x = d.getBoundingClientRect(); const l = d.querySelector('.ag-pick-list') || d.querySelector('.ag-elist'); const body = d.querySelector('.ag-dlg-body'); return { box: [Math.round(x.top), Math.round(x.height)], q: Math.round(q.top), add: Math.round(b.top), rows: d.querySelectorAll('[data-sen=\"pick-toggle\"]').length, list: l.scrollHeight > l.clientHeight + 1, body: body.scrollHeight > body.clientHeight + 1 }";
    const all = await s.ev(POS);
    await (await s.el('#ag-pick [data-sen="pick-q"]')).fill("wasser");
    await s.waitFor("return r.querySelectorAll('#ag-pick [data-sen=\"pick-toggle\"]').length === 1");
    const one = await s.ev(POS);
    await (await s.el('#ag-pick [data-sen="pick-q"]')).fill("zzzz");
    await s.waitFor("return r.querySelectorAll('#ag-pick [data-sen=\"pick-toggle\"]').length === 0");
    const none = await s.ev(POS);
    // Viele Kandidaten: die Liste scrollt in sich, das Fenster wächst nicht
    await (await s.el('#ag-pick [data-sen="pick-q"]')).fill("");
    await s.waitFor("return r.querySelectorAll('#ag-pick [data-sen=\"pick-toggle\"]').length > 1");
    await s.ev("const l = r.querySelector('#ag-pick .ag-pick-list') || r.querySelector('#ag-pick .ag-elist'); l.innerHTML = l.innerHTML.repeat(15); return 1");
    await s.page.waitForTimeout(200);
    const many = await s.ev(POS);
    const same = (a, b) => J(a.box) === J(b.box) && a.q === b.q && a.add === b.add;
    check(`${tag}: Sensoren hinzufügen: Fenster, Suche und Knöpfe bleiben am Ort bei ${all.rows}, 1, 0 und vielen Einträgen; nur die Liste scrollt`,
      all.rows > 1 && same(all, one) && same(all, none) && same(all, many) && many.list && !many.body, J({ all, one, none, many }));
    const vh = await s.ev("return innerHeight");
    if (!mobile) check(`${tag}: Sensoren hinzufügen am Computer hoch (900 px, höchstens 92 % des Fensters)`, Math.abs(all.box[1] - Math.min(vh * 0.92, 900)) <= 1, J({ box: all.box, vh }));

    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Regeln der Überwachung und Editor einer Routine (eigene Seite mit eingeschalteter Überwachung) -----
    const m = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "actions" }, query: "&monitor=1" });
    cur = m;
    await m.waitFor("return !!r.querySelector('[data-trigger=\"monitor\"]')", 10000);
    await m.tap('[data-trigger="monitor"]');
    await m.waitFor("return !!r.querySelector('.ag-mon-head')", 8000);
    await m.page.waitForTimeout(350);
    const heads = await m.ev("return [...r.querySelectorAll('.ag-mon-head')].filter((h) => h.getBoundingClientRect().width).map((h) => { const o = h.querySelector(':scope > .ag-oav').getBoundingClientRect(), g = h.querySelector(':scope > .ag-toggle').getBoundingClientRect(), t = h.querySelector(':scope > .ag-settx').getBoundingClientRect(); return o.right <= g.left && g.right <= t.left; })");
    check(`${tag}: Regeln der Überwachung: Symbol, Schalter, Text`, heads.length >= 2 && heads.every(Boolean), heads.join());
    await m.tap('[data-sub="system"]');
    await m.waitFor("return !!r.querySelector('[data-sys=\"rt-open\"]')", 8000);
    await m.tap('[data-sys="rt-open"]');
    await m.waitFor("return !!r.querySelector('[data-sys=\"rt-edit\"][data-index=\"0\"]')", 8000);
    await m.tap('[data-sys="rt-edit"][data-index="0"]');
    await m.waitFor("return !!r.querySelector('.ag-rtsub')", 8000);
    await m.page.waitForTimeout(350);
    const rt = await m.ev(`const subs = [...r.querySelectorAll('.ag-rtsub')]; let p = subs[0].previousElementSibling; while (p && p.classList.contains('ag-rtsub')) p = p.previousElementSibling;
      const g = p.querySelector(':scope > .ag-toggle').getBoundingClientRect(); return subs.map((x) => Math.round(x.querySelector(':scope > .ag-oav').getBoundingClientRect().left - g.left))`);
    check(`${tag}: Routine, "Anlage scharf": die Zeilen der Modi beginnen mit dem Symbol unter dem Schalter der Zeile darüber`, rt.length >= 2 && rt.every((d) => Math.abs(d) <= 1), rt.join());
    // Auf dem Handy steht der Text im Editor der Routine unter Symbol und Schalter (wie bis 1.89.x): dort nur die Reihenfolge Symbol, Schalter
    if (!mobile) await geo("Editor der Routine", ".ag-setrow", 6);
    else {
      const order = await m.ev("return [...r.querySelectorAll('.ag-rt-ed .ag-setrow, #ag-routines .ag-setrow')].filter((x) => x.getBoundingClientRect().width && x.querySelector(':scope > .ag-oav') && x.querySelector(':scope > .ag-toggle')).map((x) => x.querySelector(':scope > .ag-oav').getBoundingClientRect().right <= x.querySelector(':scope > .ag-toggle').getBoundingClientRect().left)");
      check(`${tag}: Editor der Routine: Symbol vor dem Schalter`, order.length >= 6 && order.every(Boolean), order.join());
    }
    check(`${tag}: keine Fehler der Seite (Überwachung, Routine)`, m.errors.length === 0, m.errors.join(" | "));
    await m.ctx.close();
  }
}
await browser.close();
done();
