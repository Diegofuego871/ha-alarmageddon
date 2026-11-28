// 1.95.0: Die drei Zeiten (Konfiguration › Anlage › Zeiten) haben je ihre eigene Farbe (Wunsch des Nutzers 2026-11-28): Ausgangsverzögerung orange,
// Eingangsverzögerung blau, Bestätigungsfenster grün; sie sind verschieden, nicht die Farbe der Anlage. Hell und dunkel, Computer und Handy.
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
for (const theme of ["light", "dark"]) {
  for (const mobile of [false, true]) {
    const tag = `${theme}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang: "de", theme, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('[data-field=\"exit_delay\"]')");
    const cols = await s.ev(`const c=(f) => { const row=r.querySelector('[data-field="'+f+'"]').closest('.ag-setrow'); const av=row.querySelector(':scope > .ag-oav'); return { color: getComputedStyle(av).color, bg: getComputedStyle(av).backgroundColor, on: av.classList.contains('on') }; }; return ['exit_delay','entry_delay','confirm_window'].map(c)`);
    check(`${tag}: alle drei Zeiten tragen ein farbiges Symbol (an)`, cols.every((x) => x.on && x.color !== "rgba(0, 0, 0, 0)"), JSON.stringify(cols));
    check(`${tag}: die drei Farben sind verschieden`, new Set(cols.map((x) => x.color)).size === 3 && new Set(cols.map((x) => x.bg)).size === 3, JSON.stringify(cols));
    check(`${tag}: orange, blau, grün (Rot-, Blau-, Grünanteil)`, await s.ev(`const rgb=(f) => getComputedStyle(r.querySelector('[data-field="'+f+'"]').closest('.ag-setrow').querySelector(':scope > .ag-oav')).color.match(/[0-9.]+/g).map(Number); const [a,b,c]=['exit_delay','entry_delay','confirm_window'].map(rgb); return a[0] > a[2] + 80 && b[2] > b[0] + 80 && c[1] > c[0] + 20 && c[1] > c[2] + 20`));
    await s.ev("const t=r.querySelector('[data-sys=\"realarm\"]'); if (t && !t.classList.contains('on')) t.click()");
    await s.page.waitForTimeout(300);
    check(`${tag}: Nachalarm: rotorange statt der Farbe der Anlage (grün), wenn an`, await s.ev("const t=r.querySelector('[data-sys=\"realarm\"]'); if (!t) return false; const av=t.closest('.ag-moderow').querySelector(':scope > .ag-oav'); const c=getComputedStyle(av).color.match(/[0-9.]+/g).map(Number); return av.classList.contains('ag-tint-realarm') && c[0] > c[1] + 60 && c[0] > c[2] + 60"));
    check(`${tag}: ohne Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
// ----- Einrichtungsassistent: dieselben Farben wie in den Einstellungen (Wunsch des Nutzers 2026-11-28) -----
for (const theme of ["light", "dark"]) {
  for (const mobile of [false, true]) {
    const tag = `Assistent ${theme}/${mobile ? "Handy" : "Desktop"}`;
    let s = await open(browser, { mobile, lang: "de", theme, tab: "config", query: "&wizard=open&wzstep=modes" });
    await s.waitFor("return !!r.querySelector('.ag-wz .ag-moderow')");
    check(`${tag}: Schritt Modi: Symbole der Modi und "Immer aktiv" rot (wie unter Konfiguration)`, await s.ev("const l=[...r.querySelectorAll('.ag-wz .ag-moderow > .ag-oav.on')]; return l.length >= 3 && l.every((a) => { const c=getComputedStyle(a).color.match(/[0-9.]+/g).map(Number); return a.classList.contains('ag-tint-alarm') && c[0] > c[1] + 50 && c[0] > c[2] + 50; })"));
    await s.ctx.close();
    s = await open(browser, { mobile, lang: "de", theme, tab: "config", query: "&wizard=open&wzstep=zones" });
    await s.waitFor("return !!r.querySelector('.ag-wz .ag-oav.ag-tint-entry')");
    check(`${tag}: Schritt Zuordnung: Zeit zum Verlassen orange, Zeit zum Deaktivieren blau`, await s.ev("const q=(k) => getComputedStyle(r.querySelector('.ag-wz .ag-oav.ag-tint-'+k)).color.match(/[0-9.]+/g).map(Number); const a=q('exit'), b=q('entry'); return a[0] > a[2] + 80 && b[2] > b[0] + 80"));
    check(`${tag}: ohne Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
