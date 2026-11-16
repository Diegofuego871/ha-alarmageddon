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
    check(`${tag}: Feld "Sicherungen behalten": Standard 5, links vom Abstand (Handy: darüber), 1 bis 50`, await s.ev("const k=r.querySelector('[data-sys=\"ab-keep\"]'); const e=r.querySelector('[data-sys=\"ab-every\"]'); return k.value === '5' && k.min === '1' && k.max === '50' && (k.getBoundingClientRect().right <= e.getBoundingClientRect().left + 1 || k.getBoundingClientRect().bottom <= e.getBoundingClientRect().top + 1)"));
    await (await s.el('[data-sys="ab-keep"]')).fill("12");
    check(`${tag}: 12 wird nach kurzer Pause gespeichert, der Hinweis nennt 12, das Feld behält den Fokus`, await s.waitFor("return window.parent.__autoBackup?.keep === 12 || true") && await s.waitFor("return /12/.test(r.querySelector('.ag-bkauto .ag-settx small').textContent) && r.activeElement?.dataset.sys === 'ab-keep'") && (await s.sim("return window.__autoBackup")).keep === 12);
    await (await s.el('[data-sys="ab-keep"]')).fill("51");
    await s.page.waitForTimeout(900);
    check(`${tag}: 51 ist ungültig (rot, nicht gespeichert)`, await s.ev("return r.querySelector('[data-sys=\"ab-keep\"]').closest('.ag-num').classList.contains('bad')") && (await s.sim("return window.__autoBackup")).keep === 12);
    await (await s.el('[data-sys="ab-keep"]')).fill("5");
    await s.tap('[data-sys="ab-on"]');
    check(`${tag}: ausgeschaltet: Abstand gesperrt, gespeichert`, await s.waitFor("return r.querySelector('[data-sys=\"ab-on\"]').getAttribute('aria-checked') === 'false' && r.querySelector('[data-sys=\"ab-every\"]').disabled") && (await s.sim("return window.__autoBackup")).enabled === false);
    await s.tap('[data-sys="ab-on"]');
    check(`${tag}: wieder an`, await s.waitFor("return r.querySelector('[data-sys=\"ab-on\"]').getAttribute('aria-checked') === 'true'") && (await s.sim("return window.__autoBackup")).enabled === true);
    // Liste: eine automatische Sicherung trägt die Marke
    await s.sim("window.__backups = [{ id: 'ba1', name: '', auto: true, data: { created: new Date().toISOString(), systems: [{ title: 'Haus' }] } }]; return 1");
    await s.ev("return r.host.systemUi.loadBackups().then(() => 1)");
    check(`${tag}: Marke "${t.auto}" in der Liste, Zählung nennt die automatischen getrennt`, await s.waitFor(`return r.querySelector('.ag-bkauto-tag')?.textContent.trim() === ${JSON.stringify(t.auto)} && /1 .* 5/.test(r.querySelector('.ag-bkbody').innerText)`));
    // Liste: eigene Spalte "Datum" (Standard neueste oben), sortierbare Köpfe, ab zehn Zeilen ein Rollbereich mit festem Kopf
    await s.sim("const now = Date.now(); window.__backups = Array.from({ length: 14 }, (_, i) => ({ id: 'b' + i, name: i % 3 ? 'Stand ' + String.fromCharCode(65 + i) : '', auto: i % 3 === 0, data: { created: new Date(now - i * 86400e3).toISOString(), systems: [{ title: i % 2 ? 'Haus' : 'Garage' }] } })); return 1");
    await s.ev("return r.host.systemUi.loadBackups().then(() => 1)");
    await s.waitFor("return r.querySelectorAll('.ag-bktable tr[data-bk]').length === 14");
    const heads = await s.ev("return [...r.querySelectorAll('.ag-bktable th')].map((h) => h.textContent.trim())");
    check(`${tag}: Spalten Name, Datum, Alarmanlagen (Datum eigene Spalte)`, heads.length === 4 && heads[1] === (lang === "de" ? "DATUM" : "DATE") || heads[1].toLowerCase() === (lang === "de" ? "datum" : "date"), JSON.stringify(heads));
    check(`${tag}: Standard: nach Datum, neueste oben`, await s.ev("const ids=[...r.querySelectorAll('.ag-bktable tr[data-bk]')].map((x) => x.dataset.bk); return ids[0] === 'b0' && ids[13] === 'b13' && r.querySelector('.ag-bktable th[aria-sort=\"descending\"] [data-key=\"date\"]')"));
    await s.ev("r.querySelector('[data-sys=\"bk-sort\"][data-key=\"date\"]').scrollIntoView({block:'center'}); return 1");
    await s.tap('[data-sys="bk-sort"][data-key="date"]');
    check(`${tag}: Datum nochmal: älteste oben`, await s.waitFor("return r.querySelector('.ag-bktable tr[data-bk]').dataset.bk === 'b13' && !!r.querySelector('.ag-bktable th[aria-sort=\"ascending\"]')"));
    if (!mobile) { // Auf dem Handy fehlt die Spalte (die Anlagen stehen unter dem Namen)
      await s.tap('[data-sys="bk-sort"][data-key="systems"]');
      check(`${tag}: Sortieren nach Alarmanlagen (aufsteigend: Garage zuerst)`, await s.waitFor("const f=r.querySelector('.ag-bktable tr[data-bk] td:nth-child(3)').textContent; return f === 'Garage'"));
    }
    await s.tap('[data-sys="bk-sort"][data-key="name"]');
    check(`${tag}: Sortieren nach Name (ohne Namen zuerst)`, await s.waitFor("return !/Stand/.test(r.querySelector('.ag-bktable tr[data-bk] td').textContent)"));
    check(`${tag}: die Liste ist ein Rollbereich: höchstens ${mobile ? 'sieben' : 'zehn'} Zeilen hoch, Kopf klebt oben beim Rollen`, await s.ev(`const w=r.querySelector('.ag-bkscroll'); const rowH=r.querySelector('.ag-bktable tr[data-bk]').getBoundingClientRect().height; if (!(w.scrollHeight > w.clientHeight + 20 && w.clientHeight <= r.querySelector('.ag-bktable th').getBoundingClientRect().height + ${mobile ? 7 : 10} * rowH + 4)) return false; w.scrollTop = 300; const h=r.querySelector('.ag-bktable th').getBoundingClientRect(); return w.scrollTop > 0 && Math.abs(h.top - w.getBoundingClientRect().top) < 3`));
    if (mobile) {
      for (const [n, scrolls] of [[8, true], [7, false]]) {
        await s.sim(`window.__backups = window.__backups.slice(0, ${n}); return 1`);
        await s.ev("return r.host.systemUi.loadBackups().then(() => 1)");
        check(`${tag}: Handy: ${n} Zeilen ${scrolls ? "rollen" : "rollen nicht"} (Rollbereich ab 8)`, await s.waitFor(`const w=r.querySelector('.ag-bkscroll'); return !!w && r.querySelectorAll('.ag-bktable tr[data-bk]').length === ${n} && (w.scrollHeight > w.clientHeight + 4) === ${scrolls}`));
      }
    }
    await s.sim("window.__backups = window.__backups.slice(0, 4); return 1");
    await s.ev("return r.host.systemUi.loadBackups().then(() => 1)");
    check(`${tag}: bis zehn Zeilen kein Rollen`, await s.waitFor("const w=r.querySelector('.ag-bkscroll'); return !!w && w.scrollHeight <= w.clientHeight + 1"));
    check(`${tag}: kein Überlauf`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
