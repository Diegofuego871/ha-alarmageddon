// 1.47.0: Automatische Sicherung in Konfiguration › Anlage › Sicherung: Schalter (Standard an), Abstand (Standard wöchentlich), Marke "Automatisch"
// in der Liste. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = { de: { auto: "Automatisch", every: ["Täglich", "Wöchentlich", "Monatlich"] }, en: { auto: "Automatic", every: ["Daily", "Weekly", "Monthly"] } };

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="system"]');
    check(`${tag}: Schalter "Automatisch sichern" steht an, Abstand wöchentlich`, await s.waitFor("return r.querySelector('[data-sys=\"ab-on\"]')?.getAttribute('aria-checked') === 'true' && r.querySelector('[data-sys=\"ab-every\"]').value === 'weekly' && !r.querySelector('[data-sys=\"ab-every\"]').disabled"));
    const opts = await s.ev("return [...r.querySelectorAll('[data-sys=\"ab-every\"] option')].map((o) => [o.value, o.textContent])");
    check(`${tag}: täglich, wöchentlich, monatlich`, JSON.stringify(opts) === JSON.stringify([["daily", t.every[0]], ["weekly", t.every[1]], ["monthly", t.every[2]]]), JSON.stringify(opts));
    check(`${tag}: Schalter links, Text rechts davon`, await s.ev("const b=r.querySelector('[data-sys=\"ab-on\"]'); const x=b.closest('.ag-setrow').querySelector('.ag-settx'); return b.getBoundingClientRect().right <= x.getBoundingClientRect().left"));
    await (await s.el('[data-sys="ab-every"]')).selectOption("monthly");
    check(`${tag}: Abstand monatlich gespeichert (sofort, kein Entwurf der Seite)`, await s.waitFor("return window.parent.__autoBackup?.every === 'monthly' || true") && (await s.sim("return window.__autoBackup")).every === "monthly" && (await s.ev("return r.host.systemUi.dirtyCount() === 0")));
    await s.tap('[data-sys="ab-on"]');
    check(`${tag}: ausgeschaltet: Abstand gesperrt, gespeichert`, await s.waitFor("return r.querySelector('[data-sys=\"ab-on\"]').getAttribute('aria-checked') === 'false' && r.querySelector('[data-sys=\"ab-every\"]').disabled") && (await s.sim("return window.__autoBackup")).enabled === false);
    await s.tap('[data-sys="ab-on"]');
    check(`${tag}: wieder an`, await s.waitFor("return r.querySelector('[data-sys=\"ab-on\"]').getAttribute('aria-checked') === 'true'") && (await s.sim("return window.__autoBackup")).enabled === true);
    // Liste: eine automatische Sicherung trägt die Marke
    await s.sim("window.__backups = [{ id: 'ba1', name: '', auto: true, data: { created: new Date().toISOString(), systems: [{ title: 'Haus' }] } }]; return 1");
    await s.ev("return r.host.systemUi.loadBackups().then(() => 1)");
    check(`${tag}: Marke "${t.auto}" in der Liste, Zählung nennt die automatischen getrennt`, await s.waitFor(`return r.querySelector('.ag-bkauto-tag')?.textContent.trim() === ${JSON.stringify(t.auto)} && /1 .* 5/.test(r.querySelector('.ag-bkbody').innerText)`));
    check(`${tag}: kein Überlauf`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
