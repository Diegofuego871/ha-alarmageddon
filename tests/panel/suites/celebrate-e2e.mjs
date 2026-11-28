// 1.95.0: Seite "Fertig" des Einrichtungsassistenten mit Animation (Wunsch des Nutzers 2026-11-28, Mockup einrichtung-fertig-v1, Variante F):
// Schleier mit Schild über dem ganzen Fenster, fängt nie einen Klick ab, endet von selbst und lässt ein kleines Schild (kein Kreis) vor dem Titel;
// läuft einmal je Aufruf der Seite (nicht bei jedem Neuzeichnen), fehlt bei "Bewegung reduzieren", endet sofort beim Verlassen der Seite.
import { check, done, launch, open } from "../lib.mjs";

const T = { de: { tag: "Die Anlage ist bereit", title: "ist bereit" }, en: { tag: "The alarm system is ready", title: "is ready" } };
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const q = "&wizard=open&wzstep=done";
    // ----- mit Bewegung -----
    let s = await open(browser, { mobile, lang, tab: "config", query: q });
    check(`${tag}: Seite "Fertig" offen`, await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step === 'done'"));
    check(`${tag}: der Schleier liegt über dem Fenster, fängt keine Klicks ab, zeigt den Text "${t.tag}" und sieben Striche`, await s.waitFor(`const v=r.querySelector('.ag-wzcel'); return !!v && getComputedStyle(v).pointerEvents === 'none' && v.querySelector('[data-k="tag"]').textContent === ${JSON.stringify(t.tag)} && v.querySelectorAll('.ag-wzcel-bar').length === 7 && v.querySelector('svg.ag-wzcel-shield')`));
    check(`${tag}: das Schild im Titel ist bis zur Landung unsichtbar (kein Springen), sein Platz ist da`, await s.ev("const c=r.querySelector('#ag-wz-chip'); const b=c.getBoundingClientRect(); return c.classList.contains('pending') && getComputedStyle(c).visibility === 'hidden' && b.width > 20 && b.height > 20"));
    check(`${tag}: die Striche behalten ihre Dicke (Höhe) beim Fallen`, await (async () => {
      const hs = [];
      for (let i = 0; i < 5; i++) { hs.push(await s.ev("const b=r.querySelector('.ag-wzcel-bar'); if (!b) return 0; const r2=b.getBoundingClientRect(); const m=new DOMMatrix(getComputedStyle(b).transform); return Math.round(Math.hypot(m.c, m.d) * parseFloat(b.style.height) * 10) / 10")); await s.page.waitForTimeout(220); }
      return hs.some((x) => x > 0) && hs.every((x) => x === 0 || Math.abs(x - 5) < 0.6);
    })());
    await s.page.waitForTimeout(700);
    check(`${tag}: nach 2 s steht das grosse Schild sichtbar mitten im Fenster`, await s.ev("const v=r.querySelector('.ag-wzcel'); const c=v?.querySelector('.ag-wzcel-coin'); if (!c) return false; const b=c.getBoundingClientRect(); const w=r.host.ownerDocument.defaultView; return +getComputedStyle(c).opacity > 0.9 && b.left >= 0 && b.right <= w.innerWidth && b.top >= 0 && b.bottom <= w.innerHeight"));
    await s.page.waitForTimeout(2600);
    check(`${tag}: nach dem Ende ist der Schleier weg und das Schild (Form, kein Kreis) steht sichtbar vor dem Titel`, await s.waitFor(`const c=r.querySelector('#ag-wz-chip'); if (r.querySelector('.ag-wzcel') || !c || c.classList.contains('pending')) return false; const h=c.closest('h2'); const path=c.querySelector('path'); return !!path && !c.querySelector('circle') && h.textContent.includes(${JSON.stringify(t.title)}) && c.getBoundingClientRect().right <= h.getBoundingClientRect().right`, 3000));
    await s.ev("r.host.wizard.render(false); r.host.wizard.renderLive()");
    await s.page.waitForTimeout(400);
    check(`${tag}: Neuzeichnen der Seite spielt die Animation nicht noch einmal ab`, await s.ev("return !r.querySelector('.ag-wzcel') && !r.querySelector('#ag-wz-chip').classList.contains('pending')"));
    // Verlassen und wieder betreten: zurück beendet nichts Offenes, "Weiter" kommt wieder zu "Fertig" und spielt neu
    await s.tap('[data-wz="back"]');
    check(`${tag}: "Zurück" verlässt die Seite, kein Schleier bleibt`, await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step !== 'done' && !r.querySelector('.ag-wzcel')"));
    await s.tap('[data-wz="next"]');
    check(`${tag}: wieder bei "Fertig" läuft die Animation erneut (einmal je Aufruf der Seite)`, await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step === 'done' && !!r.querySelector('.ag-wzcel')", 8000));
    await s.tap('[data-wz="back"]');
    check(`${tag}: Verlassen mitten in der Animation beendet sie sofort`, await s.waitFor("return !r.querySelector('.ag-wzcel')", 2000));
    check(`${tag}: ohne Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Bewegung reduzieren: sofort das Schild, keine Animation -----
    s = await open(browser, { mobile, lang, tab: "config", query: q, context: { reducedMotion: "reduce" } });
    check(`${tag}: "Bewegung reduzieren": keine Animation, das Schild steht sofort vor dem Titel`, await s.waitFor("const c=r.querySelector('#ag-wz-chip'); return r.querySelector('.ag-wz')?.dataset.step === 'done' && !r.querySelector('.ag-wzcel') && !!c && !c.classList.contains('pending') && getComputedStyle(c).visibility === 'visible'"));
    await s.ctx.close();
  }
}
await browser.close();
done();
