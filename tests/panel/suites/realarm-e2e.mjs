// Nachalarm (1.87.0) und Nachalarm pro Modus (1.89.0, Wunsch des Nutzers 2026-11-25): Konfiguration › Anlage, Kapitel "Nach einem Alarm". Schalter
// "Einstellungen pro Modus" wie bei den Zeiten (Standard aus); an, gibt es Reiter für die eingeschalteten Modi und "Immer aktiv" (Entscheid des Nutzers),
// je mit eigenem Nachalarm (an/aus, Höchstzahl 1 bis 10) und dem orangen Punkt bei Änderungen. Gespeichert mit "Speichern" der Seite (save_system).
// Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { per: "Einstellungen pro Modus", tabs: "Anwesend,Abwesend,Nacht,Immer aktiv", tabsNoAlways: "Anwesend,Abwesend,Nacht", one: "1 Änderung", two: "2 Änderungen", none: "Keine Änderungen", saved: "Gespeichert", range: "1 bis 10", always: "Immer aktiv" },
  en: { per: "Settings per mode", tabs: "Home,Away,Night,Always active", tabsNoAlways: "Home,Away,Night", one: "1 change", two: "2 changes", none: "No changes", saved: "Saved", range: "1 to 10", always: "Always active" },
};
const CHAP = "r.querySelector('[data-sys=\"ra-permode\"]').closest('.ag-chap')";
const FOOT = "r.querySelector('.ag-foot').innerText.trim().split('\\n')[0]";
const LAST = "return window.__calls.filter((c) => c.type === 'alarmageddon/save_system').at(-1) || null";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('[data-sys=\"ra-permode\"]')", 10000);
    const tabs = () => s.ev(`return [...${CHAP}.querySelectorAll('[data-seg="sys-rascope"] button')].map((b) => b.innerText.trim()).join()`);
    const fill = async (value) => {
      const input = await s.el('[data-sys="realarm-count"]');
      await input.fill(String(value));
    };
    const saveAndWait = async () => {
      await s.tap('[data-sys="save"]');
      await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes(${JSON.stringify(t.saved)})`, 8000);
      await s.waitFor("return !r.querySelector('.ag-ldwrap')", 8000);
    };

    // ----- Ohne Schalter: ein Nachalarm für alle -----
    const start = await s.ev(`const c=${CHAP}; const sw=c.querySelector('[data-sys="ra-permode"]'); return { per: sw.getAttribute('aria-checked'), title: sw.closest('.ag-pmsw').querySelector('b').innerText.trim(),
      tabs: c.querySelectorAll('[data-seg="sys-rascope"]').length, ra: c.querySelector('[data-sys="realarm"]').getAttribute('aria-checked'), count: !!c.querySelector('[data-sys="realarm-count"]'),
      order: sw.getBoundingClientRect().top < c.querySelector('[data-sys="realarm"]').getBoundingClientRect().top }`);
    check(`${tag}: Schalter "${t.per}" aus (Standard), keine Reiter, Nachalarm aus ohne Höchstzahl, Schalter über dem Nachalarm`,
      start.per === "false" && start.title === t.per && start.tabs === 0 && start.ra === "false" && !start.count && start.order, JSON.stringify(start));
    await s.tap('[data-sys="realarm"]');
    await s.waitFor("return !!r.querySelector('[data-sys=\"realarm-count\"]')");
    await fill(2);
    check(`${tag}: gemeinsamer Nachalarm an mit 2: eine Änderung`, await s.waitFor(`return ${FOOT} === ${JSON.stringify(t.one)}`));
    await saveAndWait();
    const first = await s.sim(LAST);
    check(`${tag}: gespeichert: realarm_enabled, realarm_count 2, realarm_per_mode aus, keine Werte je Auslöser`,
      first.realarm_enabled === true && first.realarm_count === 2 && first.realarm_per_mode === false && !("realarm_scopes" in first), JSON.stringify(first));

    // ----- Schalter an: Reiter für die Modi und "Immer aktiv", jeder beginnt mit dem gemeinsamen Nachalarm -----
    await s.tap('[data-sys="ra-permode"]');
    check(`${tag}: Schalter an: Reiter ${t.tabs}, nur der Schalter zählt als Änderung`, await s.waitFor(`return ${JSON.stringify(t.tabs)} === [...${CHAP}.querySelectorAll('[data-seg="sys-rascope"] button')].map((b) => b.innerText.trim()).join() && ${FOOT} === ${JSON.stringify(t.one)}`), await tabs());
    const looks = await s.ev(`const c=${CHAP}; const g=c.querySelector('.ag-ragroup');
      return { on: g.classList.contains('on'), modeseg: !!c.querySelector('[data-seg="sys-rascope"].ag-modeseg'), line: !!c.querySelector('.ag-pmscope'), sameAsTimes: g.classList.contains('ag-pmgroup') && !!g.querySelector(':scope > .ag-pmbar .ag-pmsw'),
        ra: c.querySelector('[data-sys="realarm"]').getAttribute('aria-checked'), count: c.querySelector('[data-sys="realarm-count"]')?.value, wide: c.scrollWidth <= c.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1 }`);
    check(`${tag}: Gestaltung wie bei den Zeiten (Rahmen, Reiter der Modi, Zeile "gilt nur für"), Reiter mit dem gemeinsamen Wert (an, 2), nichts ragt hinaus`,
      looks.on && looks.modeseg && looks.line && looks.sameAsTimes && looks.ra === "true" && looks.count === "2" && looks.wide, JSON.stringify(looks));

    // Abwesend aus: Punkt am Reiter, zwei Änderungen
    await s.tap('[data-scope="ra:away"]');
    await s.tap('[data-sys="realarm"]');
    check(`${tag}: Abwesend aus: oranger Punkt am Reiter Abwesend, nicht an den anderen; zwei Änderungen`, await s.waitFor(`const b=[...${CHAP}.querySelectorAll('[data-seg="sys-rascope"] button')]; return b.find((x) => x.dataset.scope === 'ra:away').classList.contains('has-edit') && b.filter((x) => x.classList.contains('has-edit')).length === 1 && ${FOOT} === ${JSON.stringify(t.two)}`));
    // Immer aktiv: ungültige Zahl sperrt Speichern mit dem richtigen Bereich, dann 5
    await s.tap('[data-scope="ra:always"]');
    const line = await s.ev(`return ${CHAP}.querySelector('.ag-pmscope').innerText.trim()`);
    check(`${tag}: Reiter "${t.always}": eigene Zeile "gilt nur für Alarme von ..."`, line.includes(t.always), line);
    await fill(0);
    check(`${tag}: Höchstzahl 0 ist ungültig: Feld markiert, Speichern gesperrt, Meldung nennt ${t.range}`, await s.waitFor(`return !!r.querySelector('[data-sys="realarm-count"]').closest('.ag-num.bad') && r.querySelector('[data-sys="save"]').disabled && r.querySelector('.ag-foot .ag-err')?.innerText.includes(${JSON.stringify(t.range)})`));
    await fill(5);
    await s.waitFor("return !r.querySelector('[data-sys=\"save\"]').disabled");
    await saveAndWait();
    const per = await s.sim(LAST);
    const want = { home: { enabled: true, count: 2 }, away: { enabled: false, count: 2 }, night: { enabled: true, count: 2 }, always: { enabled: true, count: 5 } };
    check(`${tag}: gespeichert: realarm_per_mode an und je Auslöser der eigene Wert`, per.realarm_per_mode === true && JSON.stringify(per.realarm_scopes) === JSON.stringify(want), JSON.stringify(per));
    // Die Fusszeile sagt nach dem Speichern "Gespeichert", bis sich etwas ändert; gezählt wird nichts mehr
    const after = await s.waitFor(`const c=${CHAP}; return c.querySelector('[data-sys="ra-permode"]').getAttribute('aria-checked') === 'true' && [${JSON.stringify(t.none)}, ${JSON.stringify(t.saved)}].includes(${FOOT}) && r.host.systemUi.dirtyCount() === 0 && !c.querySelector('.has-edit')`, 8000);
    check(`${tag}: nach dem Speichern und Neuladen: Schalter an, keine Änderung, kein Punkt`, after, JSON.stringify(await s.ev(`const c=${CHAP}; return { sw: c.querySelector('[data-sys="ra-permode"]').getAttribute('aria-checked'), foot: ${FOOT}, n: r.host.systemUi.dirtyCount(), dots: c.querySelectorAll('.has-edit').length }`)));
    await s.tap('[data-scope="ra:away"]');
    check(`${tag}: Abwesend bleibt aus (Stand des Servers)`, await s.waitFor(`return ${CHAP}.querySelector('[data-sys="realarm"]').getAttribute('aria-checked') === 'false'`));

    // ----- "Immer aktiv" aus: der Reiter verschwindet -----
    await s.tap('[data-sys="always"]');
    check(`${tag}: "Immer aktiv" ausgeschaltet: Reiter ${t.tabsNoAlways}`, await s.waitFor(`return ${JSON.stringify(t.tabsNoAlways)} === [...${CHAP}.querySelectorAll('[data-seg="sys-rascope"] button')].map((b) => b.innerText.trim()).join()`), await tabs());
    await s.tap('[data-sys="cancel"]');
    await s.waitFor(`return ${FOOT} === ${JSON.stringify(t.none)}`);

    // ----- Schalter aus: der erste Reiter gilt für alle (wie bei den Zeiten) -----
    await s.tap('[data-sys="ra-permode"]');
    const off = await s.ev(`const c=${CHAP}; return { tabs: c.querySelectorAll('[data-seg="sys-rascope"]').length, ra: c.querySelector('[data-sys="realarm"]').getAttribute('aria-checked'), count: c.querySelector('[data-sys="realarm-count"]')?.value, foot: ${FOOT} }`);
    check(`${tag}: Schalter aus: keine Reiter, der Wert des ersten Reiters (Anwesend: an, 2), eine Änderung`, off.tabs === 0 && off.ra === "true" && off.count === "2" && off.foot === t.one, JSON.stringify(off));
    await saveAndWait();
    const back = await s.sim(LAST);
    check(`${tag}: gespeichert ohne Werte je Auslöser (sie bleiben auf dem Server)`, back.realarm_per_mode === false && !("realarm_scopes" in back) && await s.sim("return window.__systems[0].realarm_scopes?.always?.count === 5"), JSON.stringify(back));

    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
