// 1.36.1: Übersicht auf Tablets (iPad im Querformat, Panel unter 1200 px breit, mit und ohne Seitenleiste): wie auf dem Handy scrollen Kopfzeile und
// Karten weg, nur Suche und Filter bleiben oben stehen, und die Abstände bleiben beim Scrollen gleich. Ab 1200 px (etwa 14 Zoll) bleibt es
// wie am Computer (Kopfzeile, Karten und Filter fest).
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
const measure = (s) => s.ev(`const c=r.querySelector('.ag-content'); const cb=c.getBoundingClientRect(); const head=r.querySelector('.ag-head').getBoundingClientRect(); const top=r.querySelector('.ag-ov-top').getBoundingClientRect(); const tools=r.querySelector('.ag-ov-tools').getBoundingClientRect(); const th=r.querySelector('.ag-ltable th')?.getBoundingClientRect(); return { scroll: Math.round(c.scrollTop), max: c.scrollHeight - c.clientHeight, headBottom: Math.round(head.bottom - cb.top), topBottom: Math.round(top.bottom - cb.top), toolsTop: Math.round(tools.top - cb.top), gapToTh: th ? Math.round((th.top - tools.bottom) * 10) / 10 : null, gapAbove: Math.round((tools.top - top.bottom) * 10) / 10 }`);
for (const lang of ["de", "en"]) {
  for (const [name, size, compact] of [["iPad 940 (mit Seitenleiste)", { width: 940, height: 778 }, true], ["iPad 1194 (Seitenleiste zu)", { width: 1194, height: 778 }, true], ["Computer 1400", { width: 1400, height: 950 }, false]]) {
    const tag = `${lang}/${name}`;
    const s = await open(browser, { lang, size });
    await s.page.waitForTimeout(500);
    check(`${tag}: Panel erkennt ${compact ? "Tablet (compact)" : "Computer"}`, (await s.ev("return r.host.hasAttribute('compact')")) === compact);
    const rest = await measure(s);
    await s.ev("r.querySelector('.ag-content').scrollTop = 700; return 1");
    await s.page.waitForTimeout(250);
    const a = await measure(s);
    await s.ev("r.querySelector('.ag-content').scrollTop = 1000; return 1");
    await s.page.waitForTimeout(250);
    const b = await measure(s);
    if (compact) {
      check(`${tag}: Kopfzeile und Karten scrollen weg, die Filter kleben oben (${JSON.stringify({ a: [a.headBottom, a.topBottom, a.toolsTop] })})`, a.scroll > 100 && a.headBottom <= 1 && a.topBottom <= 1 && a.toolsTop >= 0 && a.toolsTop <= 2);
      check(`${tag}: Abstand zwischen Filter und Liste bleibt beim Weiterscrollen gleich (${a.gapToTh} px)`, a.gapToTh !== null && Math.abs(a.gapToTh - b.gapToTh) <= 0.5 && b.toolsTop <= 2);
      check(`${tag}: Abstand zwischen Karten und Filter vor dem Scrollen (${rest.gapAbove} px) ist ein fester kleiner Abstand`, rest.gapAbove >= 4 && rest.gapAbove <= 40);
    } else {
      check(`${tag}: Computer: Kopfzeile, Karten und Filter bleiben fest`, a.headBottom > 1 && a.topBottom > a.headBottom && a.toolsTop >= a.topBottom - 1);
    }
    check(`${tag}: keine Browserfehler`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
