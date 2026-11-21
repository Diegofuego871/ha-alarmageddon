// 1.74.5: Logo des Einrichtungsassistenten auf der Startseite (Wunsch des Nutzers 2026-11-21): runder Farbverlauf mit weissem Zauberstab oben links
// (derselbe Stab wie im Knopf im Kopf); nur auf der Startseite, nicht in den Schritten. Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    let s = await open(browser, { mobile, lang, query: "&wizard=open&wzstep=welcome" });
    await s.waitFor("return !!r.querySelector('.ag-wz-badge')", 12000);
    const b = await s.ev(`const e=r.querySelector('.ag-wz-badge'); const q=e.getBoundingClientRect(); const k=r.querySelector('.ag-wz-kicker').getBoundingClientRect(); const t=r.querySelector('.ag-wz-top').getBoundingClientRect(); return { w: q.width, h: q.height, svg: !!e.querySelector('svg'), left: q.left - t.left, kickerRight: k.left >= q.right, bg: getComputedStyle(e).backgroundImage.includes('linear-gradient'), r: getComputedStyle(e).borderRadius, hidden: e.getAttribute('aria-hidden') }`);
    check(`${tag}: Logo: runder Farbverlauf mit Zauberstab, vor dem Titel, oben links`, b.svg && b.bg && b.w >= 44 && b.w === b.h && b.kickerRight && b.left < 4 && b.hidden === "true" && parseFloat(b.r) > 20, JSON.stringify(b));
    const t = await s.ev("const q=r.querySelector('.ag-wz-badge').getBoundingClientRect(); const l=r.querySelector('.ag-wz-later').getBoundingClientRect(); return q.right < l.left && q.top >= 0 && q.bottom <= innerHeight");
    check(`${tag}: Logo steht nicht auf "Später" und im Bild`, t);
    await s.tap('[data-wz="next"]').catch(() => {});
    const gone = await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step !== 'welcome' ? !r.querySelector('.ag-wz-badge') : false", 6000);
    check(`${tag}: in den Schritten gibt es das Logo nicht`, gone);
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
