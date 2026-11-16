// 1.52.0: Protokoll › Alle Ereignisse: Filterpille "Routinen" und Auswahl einer Routine (Dropdown über die ganze Breite, immer sichtbar).
// Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = { de: { pill: "Routinen", all: "Alle Routinen" }, en: { pill: "Routines", all: "All routines" } };
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "log", query: "&routineevents=1" });
    await s.tap('[data-log="pane"][data-pane="events"]');
    await s.waitFor("return !!r.querySelector('.ag-evchips')");
    const rows = () => s.ev("return [...r.querySelectorAll('[data-pane=\"events\"] .ag-row')].filter((x) => x.offsetParent).map((x) => x.textContent)");
    const total = (await rows()).length;
    check(`${tag}: Pille "${t.pill}" mit Anzahl 4 (drei Zustandswechsel, ein Überspringen)`, await s.ev(`const b=[...r.querySelectorAll('.ag-evchips .ag-chip')].find((x) => x.textContent.includes(${JSON.stringify(t.pill)})); return !!b && /4/.test(b.textContent)`));
    check(`${tag}: das Dropdown ist immer da, über die ganze Breite, mit "${t.all}" und beiden Routinen samt Anzahl`, await s.ev(`const sel=r.querySelector('[data-log="evroutine"]'); const w=r.querySelector('[data-pane="events"] .ag-log').getBoundingClientRect().width; const o=[...sel.options].map((x) => x.textContent); return o[0] === ${JSON.stringify(t.all)} && o.some((x) => /Heimkommen \\(2\\)/.test(x)) && o.some((x) => /Nachts scharf \\(2\\)/.test(x)) && Math.abs(sel.getBoundingClientRect().width - w) < 4`));
    await s.tap(`.ag-evchips .ag-chip[data-filter="routine"]`);
    check(`${tag}: Pille "${t.pill}": nur Ereignisse von Routinen (4)`, await s.waitFor("return [...r.querySelectorAll('[data-pane=\"events\"] .ag-row')].filter((x) => x.offsetParent).length === 4"));
    await (await s.el('[data-log="evroutine"]')).selectOption("Heimkommen");
    check(`${tag}: Routine "Heimkommen" gewählt: genau ihre zwei Ereignisse, die Pille ist an`, await s.waitFor("const r2=[...r.querySelectorAll('[data-pane=\"events\"] .ag-row')].filter((x) => x.offsetParent); return r2.length === 2 && r2.every((x) => /Heimkommen/.test(x.textContent)) && r.querySelector('.ag-evchips .ag-chip.on').dataset.filter === 'routine' && r.querySelector('[data-log=\"evroutine\"]').value === 'Heimkommen'"));
    await (await s.el('[data-log="evroutine"]')).selectOption("Nachts scharf");
    check(`${tag}: andere Routine: ihre zwei Ereignisse (Ausgelöst von der Routine)`, await s.waitFor("const r2=[...r.querySelectorAll('[data-pane=\"events\"] .ag-row')].filter((x) => x.offsetParent); return r2.length === 2 && r2.every((x) => /Routine: Nachts scharf|Nachts scharf/.test(x.textContent))"));
    await (await s.el('[data-log="evroutine"]')).selectOption("");
    check(`${tag}: "${t.all}": alle vier`, await s.waitFor("return [...r.querySelectorAll('[data-pane=\"events\"] .ag-row')].filter((x) => x.offsetParent).length === 4"));
    await s.tap(`.ag-evchips .ag-chip[data-filter="all"]`);
    check(`${tag}: Pille "Alle" zeigt wieder alles, die Auswahl der Routine ist zurückgesetzt`, await s.waitFor(`return [...r.querySelectorAll('[data-pane="events"] .ag-row')].filter((x) => x.offsetParent).length === ${total} && r.querySelector('[data-log="evroutine"]').value === ''`));
    check(`${tag}: kein Überlauf, keine Fehler`, (await s.ev("return document.documentElement.scrollWidth <= window.innerWidth")) && s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
