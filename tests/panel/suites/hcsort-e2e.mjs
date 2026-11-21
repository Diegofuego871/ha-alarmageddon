// 1.74.7: HealthCheck-Dienste: Protokoll-Knopf mit dem Symbol "Diagramm im Kasten" (Wunsch des Nutzers 2026-11-21) und auf dem Handy "Sortieren nach"
// mit Auswahl und Richtung (statt der Spaltenköpfe, wie im Device Panel). Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, query: "&hc=sample" });
    await s.ev("r.host.healthcheck.openList(); return 1");
    await s.waitFor("return r.querySelectorAll('#ag-hclist tr[data-hc-row]').length >= 2", 10000);
    const names = () => s.ev("return [...r.querySelectorAll('#ag-hclist tr[data-hc-row] .ag-hcname')].map((e) => e.textContent)");
    const icon = await s.ev("const b=r.querySelector('#ag-hclist [data-hc=\"log\"]'); return b.querySelector('path').getAttribute('d').startsWith('M9,17H7V10H9V17')");
    check(`${tag}: Protokoll-Knopf zeigt das Symbol "Diagramm im Kasten"`, icon);
    const vis = await s.ev("const b=r.querySelector('#ag-hclist .ag-hcsort'); return getComputedStyle(b).display !== 'none'");
    check(`${tag}: Sortieren nach (Auswahl und Richtung) nur auf dem Handy`, vis === mobile, String(vis));
    if (mobile) {
      const head = await s.ev("const t=r.querySelector('#ag-hclist .ag-hctable tr'); return getComputedStyle(t).display");
      check(`${tag}: Kopfzeile der Tabelle fehlt auf dem Handy`, head === "none", head);
      const a = await names();
      await s.ev("const b=r.querySelector('#ag-hclist [data-hc=\"sortdir\"]'); b.click(); return 1");
      await s.page.waitForTimeout(200);
      const b = await names();
      check(`${tag}: Richtung kehrt die Reihenfolge um`, JSON.stringify(a) === JSON.stringify([...b].reverse()) && a.length >= 2, JSON.stringify([a, b]));
      await s.ev("const e=r.querySelector('#ag-hclist [data-hc=\"sortsel\"]'); e.value='interval'; e.dispatchEvent(new Event('input', { bubbles: true })); return 1");
      await s.page.waitForTimeout(200);
      const sel = await s.ev("return [r.querySelector('#ag-hclist [data-hc=\"sortsel\"]').value, r.host.healthcheck.sort.key, r.host.healthcheck.sort.dir]");
      check(`${tag}: Auswahl wechselt die Sortierung (Intervall, aufsteigend)`, JSON.stringify(sel) === JSON.stringify(["interval", "interval", "asc"]), JSON.stringify(sel));
    }
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
