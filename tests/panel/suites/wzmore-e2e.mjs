// 1.73.0: Einrichtungsassistent, "Weitere Funktionen" (Wunsch des Nutzers 2026-11-21): je Funktion ein runder Pfeil springt direkt dorthin
// (Konfiguration › Anlage, das Fenster öffnet sich); Routinen, Codes, Eigene Töne und HealthCheck. Schliesst man das Fenster, steht der Assistent
// wieder auf diesem Schritt ("Fertig"), ohne etwas abzuschliessen. Die Dashboard-Karte hat keinen Sprung. Je Sprache, Desktop und Handy,
// echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const GO = [
  { go: "routines", dlg: "ag-rtlist", de: "Routinen öffnen", en: "Open Routines" },
  { go: "codes", dlg: "ag-codelist", de: "Codes pro Person öffnen", en: "Open Codes per person" },
  { go: "sounds", dlg: "ag-cslist", de: "Eigene Töne öffnen", en: "Open Your own sounds" },
  { go: "healthcheck", dlg: "ag-hclist", de: "HealthCheck öffnen", en: "Open HealthCheck" },
];

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, query: "&wizard=open&wzstep=done&hc=sample" });
    await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step === 'done' && r.querySelectorAll('.ag-wz-morerow').length === 5", 15000);
    // Die Lage beim Verlassen kommt aus dem Assistenten selbst (der Tipp des Tests kann die Ansicht noch einmal verschieben)
    await s.ev("const w = r.host.wizard; const g = w._goMore.bind(w); window.__left = []; w._goMore = function (k) { window.__left.push(r.host._content.scrollTop); return g(k); }; return 1");
    const rows = await s.ev("return [...r.querySelectorAll('.ag-wz-morerow')].map((x) => ({ go: x.querySelector('.ag-wz-go')?.dataset.go || '', label: x.querySelector('.ag-wz-go')?.getAttribute('aria-label') || '', b: x.querySelector('.ag-wz-go')?.getBoundingClientRect().width || 0, r: x.querySelector('.ag-wz-go') ? getComputedStyle(x.querySelector('.ag-wz-go')).borderRadius : '' }))");
    check(`${tag}: vier Funktionen mit rundem Pfeil, die Dashboard-Karte ohne`, JSON.stringify(rows.map((x) => x.go)) === JSON.stringify(["routines", "codes", "sounds", "healthcheck", ""]) && rows.slice(0, 4).every((x) => x.b >= 36 && x.label.startsWith(lang === "de" ? GO[rows.indexOf(x)].de : GO[rows.indexOf(x)].en)), JSON.stringify(rows));
    const inside = await s.ev("const c=r.querySelector('.ag-wz-more').getBoundingClientRect(); return [...r.querySelectorAll('.ag-wz-go')].map((b) => { const q=b.getBoundingClientRect(); return q.right <= c.right && q.left >= c.left && q.width === 44 && q.height === 44 && getComputedStyle(b).borderRadius !== '0px'; })");
    check(`${tag}: die runden Pfeile (44 px) liegen im Rahmen der Karte`, inside.length === 4 && inside.every(Boolean), JSON.stringify(inside));
    for (const g of GO) {
      await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step === 'done'", 15000);
      // Lage vor dem Sprung: ganz nach unten gescrollt (Handy; auf dem Desktop passt es evtl. ohne Scrollen)
      // Der Pfeil liegt vorher im Bild (sonst scrollt der Tipp selbst und verändert die Lage)
      await s.ev(`const c = r.host._content; c.scrollTop = c.scrollHeight; r.querySelector('[data-wz="more-go"][data-go="${g.go}"]').scrollIntoView({ block: 'center' }); return c.scrollTop`);
      await s.tap(`[data-wz="more-go"][data-go="${g.go}"]`);
      const ok = await s.waitFor(`return !r.querySelector('.ag-wz') && r.getElementById('${g.dlg}')?.open === true`, 8000);
      const place = await s.ev("return { tab: r.host._tab, sub: r.host._sub, active: r.host.wizard.active }");
      check(`${tag}: ${g.go}: der Pfeil schliesst den Assistenten und öffnet das Fenster in Konfiguration › Anlage`, ok && place.tab === "config" && place.sub === "system" && place.active === false, JSON.stringify(place));
      const state = await s.sim("return window.__wzCalls.filter((c) => c.action === 'done').length");
      check(`${tag}: ${g.go}: nichts wird abgeschlossen`, state === 0, String(state));
      await s.ev(`r.getElementById('${g.dlg}').close(); return 1`);
      check(`${tag}: ${g.go}: das Schliessen des Fensters führt zurück zum Assistenten auf "Fertig"`, await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step === 'done' && r.querySelectorAll('.ag-wz-morerow').length === 5", 15000));
      const before = await s.ev("return window.__left[window.__left.length - 1]");
      await s.waitFor(`return Math.abs(r.host._content.scrollTop - ${before}) <= 2`, 4000);
      const after = await s.ev("return r.host._content.scrollTop");
      check(`${tag}: ${g.go}: nach der Rückkehr steht der Schritt wieder an derselben Stelle wie beim Verlassen (nicht oben)`, before > 100 && Math.abs(after - before) <= 2, `beim Verlassen ${before}, nachher ${after}`);
    }
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
