// 1.93.0: "Nicht mehr anzeigen" auf der Karte des Einrichtungsassistenten (Wunsch des Nutzers 2026-11-26/28): Symbol und Text (auch auf dem Handy), neben
// "Fortsetzen" in einer Zeile, wirkt sofort und ohne Rückfrage, verwirft den laufenden Assistenten. Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const T = { de: { hide: "Nicht mehr anzeigen", resume: "Fortsetzen", hidden: "Ausgeblendet" }, en: { hide: "Don't show again", resume: "Continue", hidden: "Hidden" } };
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    for (const state of ["later"]) {
      const tag = `${lang}/${mobile ? "Handy" : "Desktop"}/${state}`;
      const t = T[lang];
      const q = "&wizard=later&wzstep=zones&wzuntil=2999-01-01";
      const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: q });
      await s.waitFor("return !!r.querySelector('.ag-wzrow')");
      check(`${tag}: Knopf "${t.hide}" mit Symbol und Text, neben "${t.resume}", in einer Zeile`, await s.ev(`const row=r.querySelector('.ag-wzrow'); const h=row.querySelector('[data-wz="hide-now"]'); const bs=[...row.querySelectorAll('.ag-btnrow .ag-btn')].map((b) => b.getBoundingClientRect()); return h.innerText.trim() === ${JSON.stringify(t.hide)} && !!h.querySelector('svg') && bs.length === 2 && Math.abs(bs[0].top - bs[1].top) < 4 && bs[1].right <= row.getBoundingClientRect().right && (!${mobile} || (Math.abs(bs[0].width - bs[1].width) < 2 && [...row.querySelectorAll('.ag-btnrow .ag-btn')].every((b) => b.scrollWidth <= b.clientWidth + 1))) && row.querySelector('[data-wz="run"]').innerText.trim() === ${JSON.stringify(t.resume)}`));
      await s.tap('[data-wz="hide-now"]');
      check(`${tag}: wirkt sofort und ohne Rückfrage: Stand "${t.hidden}", Knopf weg, Server: hidden`, await s.waitFor(`const row=r.querySelector('.ag-wzrow'); return !r.getElementById('ag-wzask')?.open && !row.querySelector('[data-wz="hide-now"]') && row.innerText.includes(${JSON.stringify(t.hidden)})`) && (await s.sim("return window.__wzCalls.at(-1)?.action === 'hide' && window.__systems[0].wizard.state === 'hidden'")));
      check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }
  }
}
await browser.close();
done();
