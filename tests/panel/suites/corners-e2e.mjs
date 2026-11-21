// 1.73.0: Ecken der Tabellen in den Fenstern (Wunsch des Nutzers 2026-11-20, Bildschirmfotos der HealthCheck-Dienste und der Backups auf dem Handy: "die Ecken
// oder die Ränder sind quasi abgeschnitten"). Ursache: die klebende Kopfzeile hat eckige Ecken und deckt den runden Rand der Karte (18 px) zu. Geprüft wird
// in jedem Fenster mit einer Tabelle (HealthCheck-Dienste, Backups, Codes; die Töne sind eine Zeilenliste ohne Tabelle), auf dem Handy und am Computer, in beiden Farbthemen:
// jedes Element der Kopfzeile, das die obere linke oder rechte Ecke der Karte berührt und etwas malt (Hintergrund), trägt dort mindestens den inneren
// Radius der Karte (17 px). Dazu ein Pixeltest am Handy: die Ecke der Karte ist rund (der Hintergrund des Fensters scheint in der Ecke durch).
import { check, done, launch, open } from "../lib.mjs";

const WINDOWS = [
  { name: "HealthCheck-Dienste", open: '.ag-hcsum [data-hc="open"]', id: "ag-hclist", ready: "r.querySelectorAll('#ag-hclist [data-hc-row]').length >= 2", query: "&hc=sample" },
  { name: "Backups", open: '[data-sys="bk-open"]', id: "ag-bklist", ready: "r.querySelectorAll('#ag-bklist tr').length >= 3", query: "", before: "window.__backups = [{ id: 'b1', name: 'Vor dem Umbau', data: { created: new Date().toISOString(), systems: [{ title: 'Haus' }] } }, { id: 'b2', name: '', auto: true, data: { created: new Date(Date.now() - 864e5).toISOString(), systems: [{ title: 'Haus' }] } }]; return 1" },
  { name: "Codes", open: '[data-sys="code-open"]', id: "ag-codelist", ready: "true", query: "" },
];

const browser = await launch();
for (const theme of ["light", "dark"]) {
  for (const mobile of [false, true]) {
    for (const w of WINDOWS) {
      const tag = `${theme}/${mobile ? "Handy" : "Desktop"}: ${w.name}`;
      const s = await open(browser, { mobile, lang: "de", theme, tab: "config", prefs: { sub: "system" }, query: w.query });
      await s.waitFor(`return !!r.querySelector('${w.open}')`);
      await s.tap(w.open);
      if (w.before) {
        await s.sim(w.before);
        await s.ev("return r.host.systemUi.loadBackups().then(() => 1)"); // die Liste neu holen (Nachbau: window.__backups)
      }
      const ok = await s.waitFor(`const d=r.getElementById('${w.id}'); return d.open && ${w.ready}`);
      await s.page.waitForTimeout(300);
      const res = await s.ev(`const d=r.getElementById('${w.id}'); const card=d.querySelector('.ag-bkwrap, .ag-table-wrap, .ag-card table')?.closest('.ag-card, .ag-table-wrap') || d.querySelector('.ag-bkwrap');
        if (!card) return { none: true };
        const cb=card.getBoundingClientRect(); const cr=parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0; const clipped=getComputedStyle(card).overflow !== 'visible'; // eine Karte mit overflow hidden schneidet die Kopfzeile selbst rund
        const bad=[]; let touching=0;
        for (const e of card.querySelectorAll('table, thead, tbody, tr, th, td, button')) {
          const b=e.getBoundingClientRect(); const c=getComputedStyle(e);
          if (!b.width || !b.height || b.top > cb.top + 3 + 1) continue; // nur Elemente, die die obere Kante der Karte berühren
          const paints = c.backgroundColor !== 'rgba(0, 0, 0, 0)' && c.backgroundColor !== 'transparent';
          if (b.left <= cb.left + 2) { touching++; if (paints && !clipped && parseFloat(c.borderTopLeftRadius) < cr - 2) bad.push(e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' links ' + c.borderTopLeftRadius); }
          if (b.right >= cb.right - 2) { touching++; if (paints && !clipped && parseFloat(c.borderTopRightRadius) < cr - 2) bad.push(e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' rechts ' + c.borderTopRightRadius); }
        }
        return { cr, touching, bad };`);
      check(`${tag}: die klebende Kopfzeile folgt den runden Ecken der Karte`, ok && !res.none && res.cr >= 16 && res.touching >= 1 && res.bad.length === 0, JSON.stringify(res));
      check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }
  }
}
await browser.close();
done();
