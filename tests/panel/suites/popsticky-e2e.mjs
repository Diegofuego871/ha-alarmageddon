// 1.63.0 (Wunsch des Nutzers, 2026-11-17, Bildschirmfoto vom Handy): In den Fenstern mit Liste (Routinen, Eigene Töne, Sicherungen, Codes) bleiben Titel
// und Suchfeld beim Scrollen oben stehen, die Liste läuft darunter durch. Der Abstand von der Suchleiste zur Liste ist gescrollt wie ungescrollt
// gleich, nichts aus der Liste scheint durch den Kopf, das X überdeckt das Suchfeld nicht. Je Sprache, Handy und Desktop (niedriges Fenster,
// damit die Liste scrollt).
import { check, done, launch, open, outDir } from "../lib.mjs";

const WINDOWS = [
  ["Routinen", "ag-rtlist", '[data-sys="rt-open"]', null],
  ["Eigene Töne", "ag-cslist", '[data-sys="cs-open"]', null],
  ["Sicherungen", "ag-bklist", '[data-sys="bk-open"]', "return !r.querySelector('#ag-bklist .ag-bktools').hidden && !!r.querySelector('#ag-bklist .ag-bkbody tr, #ag-bklist .ag-bkbody .ag-setrow')"],
  ["Codes pro Person", "ag-codelist", '[data-sys="code-open"]', "return !!r.querySelector('#ag-codelist .ag-codetable tr[data-code]')"],
];
// Lage von Kopf, Suchfeld, X und erster Zeile der Liste im Fenster `id`
const MEASURE = `const d=r.getElementById(arg); const body=d.querySelector('.ag-dlg-body'); const head=body.querySelector(':scope > .ag-pop-head'); const q=head?.querySelector('.ag-pop-tools');
  const next=head?.nextElementSibling; const x=d.querySelector(':scope > .ag-dlg-x'); if (!head || !q || !next) return null;
  const bb=body.getBoundingClientRect(), inner=body.clientWidth, hb=head.getBoundingClientRect(), qb=q.getBoundingClientRect(), nb=next.getBoundingClientRect(), xb=x.getBoundingClientRect();
  const bg=getComputedStyle(head).backgroundColor; const probe=r.elementFromPoint(hb.left + hb.width / 2, hb.bottom - 4);
  return { scroll: Math.round(body.scrollTop), max: Math.round(body.scrollHeight - body.clientHeight), headTop: Math.round(hb.top - bb.top), gap: Math.round(nb.top - qb.bottom),
    edgeGap: Math.round(hb.bottom - qb.bottom), qVisible: qb.top >= bb.top - 1 && qb.bottom <= bb.bottom, title: !!head.querySelector('h3') && head.querySelector('h3').getBoundingClientRect().top >= bb.top - 1,
    opaque: bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent', onTop: !!probe && head.contains(probe), xOverQ: xb.left < qb.right - 1 && qb.left < xb.right - 1 && xb.top < qb.bottom - 1 && qb.top < xb.bottom - 1,
    full: Math.round(hb.width) >= inner - 1, qh: Math.round(qb.height) }`;

const browser = await launch();
for (const [lang, mobile] of [["de", true], ["de", false], ["en", true]]) {
  const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
  const s = await open(browser, { mobile, lang, tab: "config", theme: "dark", query: "&sounds=1" });
  await s.page.setViewportSize(mobile ? { width: 390, height: 560 } : { width: 1400, height: 760 });
  // Erfundene Sicherungen (der Nachbau startet ohne): sonst gibt es im Fenster "Sicherungen" weder Suchleiste noch Liste
  await s.sim(`const day = (n) => new Date(Date.UTC(2026, 10, n, 9, 30)).toISOString();
    window.__backups = Array.from({ length: 8 }, (_, i) => ({ id: 'b' + i, name: i % 2 ? '' : 'Sicherung ' + i, auto: i % 2 === 1, data: { created: day(2 + i), systems: [{ title: 'Haus' }] } })); return 1`);
  await s.tap('[data-sub="system"]');
  await s.ev("return r.host.systemUi.loadBackups()");
  await s.page.waitForTimeout(400);
  for (const [name, id, opener, ready] of WINDOWS) {
    await s.ev(`r.querySelector(arg).click(); return 1`, opener);
    await s.waitFor(`return r.getElementById(${JSON.stringify(id)}).open`);
    if (ready) await s.waitFor(ready, 5000);
    await s.page.waitForTimeout(400);
    // Die Liste länger machen, falls sie im Nachbau nicht scrollt (nur Abstand nach unten, ändert die Liste nicht)
    await s.ev(`const b=r.getElementById(arg).querySelector('.ag-dlg-body'); if (b.scrollHeight - b.clientHeight < 200) { const pad=document.createElement('div'); pad.style.cssText='flex:none;height:600px'; pad.className='zz-pad'; b.insertBefore(pad, b.querySelector(':scope > .ag-dlg-btns')); } return 1`, id);
    const a = await s.ev(MEASURE, id);
    check(`${tag}: ${name}: Titel und Suchfeld stehen im Kopf, der Kopf reicht über die ganze Breite und deckt ab`, !!a && a.title && a.qVisible && a.qh > 30 && a.full && a.opaque, JSON.stringify(a));
    check(`${tag}: ${name}: das X überdeckt das Suchfeld nicht`, !!a && !a.xOverQ, JSON.stringify(a));
    await s.ev(`const b=r.getElementById(arg).querySelector('.ag-dlg-body'); b.scrollTop = b.scrollHeight; return 1`, id);
    await s.page.waitForTimeout(250);
    const b = await s.ev(MEASURE, id);
    check(`${tag}: ${name}: gescrollt bleiben Titel und Suchfeld oben stehen`, !!b && b.scroll > 100 && b.headTop <= 1 && b.title && b.qVisible, JSON.stringify(b));
    check(`${tag}: ${name}: gescrollt läuft die Liste unter dem Kopf durch (nichts scheint durch), das X überdeckt das Suchfeld nicht`, !!b && b.onTop && b.opaque && !b.xOverQ, JSON.stringify(b));
    check(`${tag}: ${name}: der Abstand von der Suchleiste zur Liste ist gescrollt wie ungescrollt gleich (${a?.gap} px)`, !!a && !!b && a.gap === a.edgeGap && b.edgeGap === a.gap && a.gap >= 10 && a.gap <= 18, JSON.stringify({ a, b }));
    if (mobile && lang === "de") await s.page.screenshot({ path: `${outDir}popsticky-${id}.png` });
    await s.ev(`const b=r.getElementById(arg).querySelector('.ag-dlg-body'); b.querySelector('.zz-pad')?.remove(); b.scrollTop = 0; return 1`, id);
    await s.ev(`r.getElementById(arg).close(); return 1`, id);
    await s.page.waitForTimeout(200);
  }
  check(`${tag}: keine Fehler in der Konsole`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}
await browser.close();
done();
