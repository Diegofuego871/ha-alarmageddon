// 1.62.1 (Bildschirmfotos des Nutzers, 2026-11-17): Die Zeilen "Routinen" und "Eigene Töne" im Reiter Anlage zeigen links eine Zusammenfassung
// ("3 Routinen · 3 aktiv", "1 eigener Ton") und rechts zwei Knöpfe. Bis 1.62.0 stand alles in einer Zeile; auf dem Handy schrumpfte der Text auf
// die Breite 0 und lief Wort für Wort unter die Knöpfe. Geprüft wird: der Text steht in einer Zeile und überlappt nie einen Knopf; auf dem Handy
// stehen die Knöpfe unter dem Text, auf dem Desktop daneben; nichts ragt aus der Karte. Je Sprache, Desktop und Handy, dazu zwei schmalere Handys.
import { check, done, launch, open, outDir } from "../lib.mjs";

const ROWS = [["Routinen", '.ag-rtsum:has([data-sys="rt-open"])'], ["Eigene Töne", '.ag-rtsum:has([data-sys="cs-open"])']];
const MEASURE = `const row=r.querySelector(arg); const card=row.closest('.ag-card').getBoundingClientRect(); const t=row.querySelector('.ag-settx'); const b=t.querySelector('b');
  const tb=t.getBoundingClientRect(); const bt=b.getBoundingClientRect(); const lh=parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.3;
  const btns=[...row.querySelectorAll('.ag-btnrow .ag-btn')].map((x) => x.getBoundingClientRect());
  const hit=(a, c) => a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1;
  return { text: b.textContent.trim(), width: Math.round(tb.width), oneLine: bt.height <= lh * 1.5, fits: b.scrollWidth <= t.clientWidth + 1,
    overlap: btns.some((x) => hit(x, bt) || hit(x, tb)), hint: (() => { const u=t.querySelector('.ag-unsaved'); if (!u) return null; const ub=u.getBoundingClientRect(); return { lines: Math.round(ub.height / (parseFloat(getComputedStyle(u).lineHeight) || 18)), width: Math.round(ub.width) }; })(), below: btns.every((x) => x.top >= tb.bottom - 1), beside: btns.every((x) => x.left >= tb.right - 1 && x.top < tb.bottom),
    inside: btns.every((x) => x.left >= card.left - 1 && x.right <= card.right + 1), big: btns.every((x) => Math.round(x.height) >= 38), n: btns.length }`;

const browser = await launch();
const cases = [["de", false, null], ["de", true, null], ["en", false, null], ["en", true, null], ["de", true, 360], ["de", true, 320]];
for (const [lang, mobile, width] of cases) {
  const tag = `${lang}/${mobile ? `Handy${width ? ` ${width} px` : ""}` : "Desktop"}`;
  const s = await open(browser, { mobile, lang, tab: "config", theme: "dark", query: "&sounds=1" });
  if (width) await s.page.setViewportSize({ width, height: 844 });
  await s.tap('[data-sub="system"]');
  await s.waitFor("return !!r.querySelector('.ag-rtsum [data-sys=\"rt-open\"]') && !!r.querySelector('.ag-rtsum [data-sys=\"cs-open\"]')");
  await s.page.waitForTimeout(500);
  for (const [name, sel] of ROWS) {
    const m = await s.ev(MEASURE, sel);
    check(`${tag}: ${name}: die Zusammenfassung "${m.text}" steht in einer Zeile und hat Platz`, m.oneLine && m.fits && m.width >= 100, JSON.stringify(m));
    check(`${tag}: ${name}: kein Knopf überdeckt den Text`, !m.overlap, JSON.stringify(m));
    check(`${tag}: ${name}: ${mobile ? "die Knöpfe stehen unter dem Text" : "die Knöpfe stehen rechts neben dem Text"}, in der Karte, gross genug`,
      m.n === 2 && (mobile ? m.below : m.beside) && m.inside && m.big, JSON.stringify(m));
    if (!width) {
      await s.ev(`r.querySelector(arg).scrollIntoView({ block: 'center' }); return 1`, sel);
      await s.page.waitForTimeout(150);
      await (await s.el(sel)).screenshot({ path: `${outDir}sumrow-${name === "Routinen" ? "routines" : "sounds"}-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    }
  }
  // Mit dem Hinweis "noch nicht gespeichert" (Bildschirmfoto des Nutzers): auch er steht neben dem Symbol, nicht unter den Knöpfen
  await s.tap('[data-sys="rt-open"]');
  await s.waitFor("return r.getElementById('ag-rtlist').open");
  await s.ev("r.querySelector('#ag-rtlist .ag-rtrow [data-sys=\"rt-on\"]').click(); return 1");
  if (await s.waitFor("return r.getElementById('ag-confirm').open", 800)) await s.ev("r.querySelector('#ag-confirm [data-c=\"yes\"]').click(); return 1");
  await s.ev("r.querySelector('#ag-rtlist [data-sys=\"rt-close\"]').click(); return 1");
  await s.waitFor("return !r.getElementById('ag-rtlist').open && !!r.querySelector('.ag-rtsum .ag-unsaved')");
  const mu = await s.ev(MEASURE, ROWS[0][1]);
  check(`${tag}: Routinen mit Hinweis "noch nicht gespeichert": nichts überdeckt den Text, der Hinweis hat Platz (höchstens zwei Zeilen)`, !mu.overlap && mu.oneLine && mu.hint && mu.hint.lines <= 2 && mu.hint.width >= 100 && (mobile ? mu.below : mu.beside), JSON.stringify(mu));
  if (!width && mobile) {
    await s.ev(`r.querySelector(arg).scrollIntoView({ block: 'center' }); return 1`, ROWS[0][1]);
    await (await s.el(ROWS[0][1])).screenshot({ path: `${outDir}sumrow-routines-unsaved-${lang}-mobile.png` });
  }
  check(`${tag}: kein seitliches Scrollen`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth + 1 && r.querySelector('.ag-view').scrollWidth <= r.querySelector('.ag-view').clientWidth + 1"));
  // Die Knöpfe wirken weiter: "Routinen anzeigen" öffnet das Fenster
  await s.tap('[data-sys="rt-open"]');
  check(`${tag}: "Routinen anzeigen" öffnet das Fenster`, await s.waitFor("return r.getElementById('ag-rtlist').open"));
  await s.ctx.close();
}
await browser.close();
done();
