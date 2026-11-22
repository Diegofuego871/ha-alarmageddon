// 1.82.0: roter Kreis im Kopf nach einem Alarm (Wunsch des Nutzers 2026-11-22): Alarmzeichen im roten Kreis, rundherum derselbe Komet wie beim Zauberstab (ohne Stab), steht für die
// ganze Anlage, bis man ihn antippt oder den Alarm im Protokoll von Hand öffnet; mit dem Zauberstab zugleich laufen beide Kometen im selben Augenblick. Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const T = { de: { tipNew: "Neuer Alarm: Protokoll öffnen", tipRun: "Alarm läuft: Protokoll öffnen" }, en: { tipNew: "New alarm: open the log", tipRun: "Alarm running: open the log" } };
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    // ----- Ohne ungesehenen Alarm: kein Kreis -----
    const none = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    check(`${tag}: ohne ungesehenen Alarm gibt es den Kreis nicht`, (await none.ev("return !r.querySelector('.ag-albtn')")) === true);
    await none.ctx.close();

    // ----- Ein beendeter Alarm: Kreis, Tippen führt ins Protokoll und löscht ihn für die ganze Anlage -----
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&alarmunseen=1" });
    await s.waitFor("return !!r.querySelector('.ag-albtn')");
    const i = await s.ev(`const b=r.querySelector('.ag-albtn'); const dot=b.querySelector('.ag-wzbtn-dot'); const rect=b.getBoundingClientRect(); return { tip: b.getAttribute('title'), round: Math.abs(rect.width - rect.height) < 1 && getComputedStyle(b).borderRadius.includes('50%'), color: getComputedStyle(dot).backgroundColor, text: getComputedStyle(b).color, icon: !!b.querySelector('svg path'), before: !!b.nextElementSibling?.classList?.contains('ag-grow') || true, inHead: !!b.closest('.ag-headsys') }`);
    const red = (c) => { const m = c.match(/\d+/g)?.map(Number) || []; return m[0] > 180 && m[1] < 120 && m[2] < 120; };
    check(`${tag}: roter runder Knopf mit Alarmzeichen und rotem Punkt im Kopf, Tipp "${t.tipNew}"`, i.tip === t.tipNew && i.round && red(i.text) && red(i.color) && i.icon && i.inHead, JSON.stringify(i));
    await s.tap('.ag-albtn');
    await s.waitFor("return r.querySelector('[data-tab=log]')?.classList.contains('on') || !!r.querySelector('.ag-inc')");
    await s.page.waitForTimeout(500);
    const after = await s.ev("return { gone: !r.querySelector('.ag-albtn'), pane: r.querySelector('[data-log=pane].on')?.dataset.pane, open: r.querySelectorAll('.ag-inc.open').length, seen: window.parent.__alarmSeen || [] }").catch(() => null);
    const seen = await s.sim("return window.__alarmSeen || []");
    check(`${tag}: Tippen öffnet Protokoll › Alarme mit dem neuesten Alarm aufgeklappt, der Kreis ist weg, der Server hat es erfahren`, after && after.gone && after.pane === "alarms" && after.open === 1 && seen.length === 1, JSON.stringify([after, seen]));
    check(`${tag}: keine Fehler im Panel`, s.errors.length === 0, s.errors.join("|"));
    await s.ctx.close();

    // ----- Ein laufender Alarm: Hinweistext -----
    const run = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&alarmunseen=running&alarm=open" });
    await run.waitFor("return !!r.querySelector('.ag-albtn')");
    check(`${tag}: ein laufender Alarm zeigt den Kreis sofort ("${t.tipRun}")`, (await run.ev("return r.querySelector('.ag-albtn').getAttribute('title')")) === t.tipRun);
    await run.ctx.close();

    // ----- Den Alarm im Protokoll von Hand öffnen gilt als gesehen; ein älterer Alarm lässt den Kreis stehen -----
    const lg = await open(browser, { mobile, lang, tab: "log", query: "&alarmunseen=1" });
    await lg.waitFor("return !!r.querySelector('.ag-inc')");
    check(`${tag}: im Protokoll steht der Kreis auch im Kopf`, (await lg.ev("return !!r.querySelector('.ag-albtn')")) === true);
    await lg.tap('.ag-inc-head');
    await lg.page.waitForTimeout(500);
    check(`${tag}: den neuesten Alarm im Protokoll von Hand öffnen löscht den Kreis`, (await lg.ev("return !r.querySelector('.ag-albtn')")) === true && (await lg.sim("return (window.__alarmSeen || []).length")) === 1);
    await lg.ctx.close();
    const old = await open(browser, { mobile, lang, tab: "log", query: "&alarmunseen=1" });
    await old.sim(`window.__moreRecordings = [{ id: new Date(Date.now() - 400 * 60e3).toISOString(), start: new Date(Date.now() - 400 * 60e3).toISOString(), end: new Date(Date.now() - 390 * 60e3).toISOString(), ended_by: "Diego", mode: "away", sensor: "binary_sensor.fenster_bad", entries: [{ t: new Date(Date.now() - 400 * 60e3).toISOString(), kind: "state", state: "triggered", sensor: "binary_sensor.fenster_bad" }] }]; return 1`);
    await old.sim("return 1");
    await old.ev("const h=r.host; h.log.load?.(true); return 1");
    await old.page.waitForTimeout(800);
    const heads = await old.ev("return r.querySelectorAll('.ag-inc-head').length");
    if (heads > 1) {
      await old.ev("const hs=[...r.querySelectorAll('.ag-inc-head')]; hs[hs.length - 1].click(); return 1");
      await old.page.waitForTimeout(500);
      check(`${tag}: einen älteren Alarm öffnen lässt den Kreis für den neueren stehen`, (await old.ev("return !!r.querySelector('.ag-albtn')")) === true);
    }
    await old.ctx.close();

    // ----- Gelesen / ungelesen umschalten (Wunsch des Nutzers): Beschriftung und Symbol wechseln mit, "ungelesen" bringt den Kreis als Erinnerung zurück -----
    const tg = await open(browser, { mobile, lang, tab: "log" });
    await tg.waitFor("return !!r.querySelector('.ag-inc')");
    await tg.tap('.ag-inc-head');
    await tg.waitFor("return !!r.querySelector('.ag-inc-seen')");
    const L = { de: ["Als ungelesen markieren", "Als gelesen markieren"], en: ["Mark as unread", "Mark as read"] }[lang];
    const state = () => tg.ev("const b=r.querySelector('.ag-inc-seen'); const d=r.querySelector('.ag-inc-foot .ag-inc-del'); return { text: b?.innerText.trim(), unread: b?.dataset.unread, circle: !!r.querySelector('.ag-albtn'), dot: !!r.querySelector('.ag-unread-dot'), icon: b?.querySelector('path')?.getAttribute('d')?.slice(0, 12), left: d && b ? b.getBoundingClientRect().right <= d.getBoundingClientRect().left + 1 || b.getBoundingClientRect().bottom <= d.getBoundingClientRect().top + 1 : true }");
    const a1 = await state();
    await tg.tap('.ag-inc-seen');
    await tg.page.waitForTimeout(900);
    const a2 = await state();
    check(`${tag}: "${L[0]}" setzt den Alarm auf ungelesen: Beschriftung und Symbol wechseln, der rote Kreis erscheint, ein roter Punkt am Alarm`, a1.text === L[0] && a1.unread === "false" && !a1.circle && a2.text === L[1] && a2.unread === "true" && a2.circle && a2.dot && a1.icon !== a2.icon && a2.left, JSON.stringify([a1, a2]));
    await tg.tap('.ag-inc-seen');
    await tg.page.waitForTimeout(900);
    const a3 = await state();
    check(`${tag}: "${L[1]}" setzt ihn zurück auf gelesen: Kreis und Punkt verschwinden, die Beschriftung wechselt zurück`, a3.text === L[0] && a3.unread === "false" && !a3.circle && !a3.dot, JSON.stringify(a3));
    await tg.ctx.close();

    // ----- Mit dem Zauberstab zugleich: beide Kometen im selben Augenblick -----
    const both = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&alarmunseen=1&wizard=later&wzuntil=2999-01-01" });
    await both.waitFor("return r.querySelectorAll('.ag-headsys .ag-wzbtn').length === 2");
    check(`${tag}: mit dem Zauberstab zugleich sind beide Knöpfe da`, (await both.ev("return !!r.querySelector('.ag-headsys .ag-albtn') && !!r.querySelector('.ag-headsys .ag-wzbtn:not(.ag-albtn)')")) === true);
    await both.waitFor("return [...r.querySelectorAll('.ag-wzbtn')].every((b) => b.classList.contains('wave'))", 12000);
    await both.page.waitForTimeout(2800);
    const anim = await both.ev("return [...r.querySelectorAll('.ag-wzbtn')].map((b) => { const a = b.querySelector('.ag-wzbtn-dot').getAnimations()[0]; return { name: a?.animationName, t: Math.round(a?.currentTime || 0), dur: a?.effect?.getComputedTiming().duration }; })");
    check(`${tag}: beide Kometen laufen gleichzeitig (dieselbe Animation, dieselbe Zeit, Abweichung unter 80 ms)`, anim.length === 2 && anim[0].name === anim[1].name && anim[0].name === "ag-wz-orbit" && anim[0].dur === anim[1].dur && Math.abs(anim[0].t - anim[1].t) < 80, JSON.stringify(anim));
    await both.ctx.close();
  }
}
await browser.close();
done();
