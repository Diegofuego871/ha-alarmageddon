// 1.81.0: Filter "Phase" im Reiter Aktionen (Wunsch des Nutzers 2026-11-22): in der Fusszeile neben "Aktionen übernehmen von …" eine Auswahl der Phase des Ablaufs
// (Scharfschalten beginnt, Anlage scharf, Stiller Alarm, Eingangsverzögerung, Alarm beginnt, Alarm endet, Anlage deaktiviert), in der Reihenfolge des Ablaufs, Standard
// "Alle Phasen". Nur die Ansicht: der Entwurf bleibt unberührt. Je Sprache, Desktop und Handy, echte Eingaben.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { all: "Alle Phasen", copy: "Aktionen übernehmen von …", opts: ["Scharfschalten beginnt", "Anlage scharf geschaltet", "Stiller Alarm", "Eingangsverzögerung läuft", "Alarm beginnt", "Alarm endet (quittiert)", "Anlage deaktiviert"] },
  en: { all: "All phases", copy: "Copy actions from …", opts: ["Arming begins", "Alarm system armed", "Silent alarm", "Entry delay running", "Alarm starts", "Alarm ends (acknowledged)", "Alarm system disarmed"] },
};
const KEYS = ["arming", "armed", "report", "entry", "alarm", "end", "disarmed"];
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "actions", trigger: "away" } });
    await s.waitFor("return !!r.querySelector('.ag-wf-main') && !!r.querySelector('.ag-phasefilter')");
    const info = () => s.ev(`const sel=r.querySelector('.ag-phasefilter'); const cp=r.querySelector('.ag-copyfrom'); const vis=[...r.querySelectorAll('[data-phase]')].filter((e) => !e.classList.contains('ag-phase-off') && e.getBoundingClientRect().height > 0);
      return { opts: [...sel.options].map((o) => [o.value, o.textContent]), value: sel.value, copy: cp?.options[0].textContent, same: cp ? Math.abs(cp.getBoundingClientRect().top - sel.getBoundingClientRect().top) < 2 : null, left: cp ? cp.getBoundingClientRect().left < sel.getBoundingClientRect().left : null, shown: [...new Set(vis.flatMap((e) => e.dataset.phase.split(' ')))], points: [...new Set(vis.filter((e) => !e.classList.contains('ag-wf-chap')).flatMap((e) => e.dataset.phase.split(' ')))], dirty: r.host.actions.flowDirty() }`);
    let i = await info();
    check(`${tag}: zwei Auswahlen in einer Zeile: links "${t.copy}", rechts die Phase; Standard "${t.all}"`, i.copy === t.copy && i.same && i.left && i.opts[0][1] === t.all && i.value === "", JSON.stringify(i));
    check(`${tag}: die Phasen stehen in der Reihenfolge des Ablaufs`, JSON.stringify(i.opts.slice(1).map((o) => o[0])) === JSON.stringify(KEYS) && JSON.stringify(i.opts.slice(1).map((o) => o[1])) === JSON.stringify(t.opts), JSON.stringify(i.opts));
    check(`${tag}: Standard zeigt alle Phasen`, KEYS.every((k) => i.shown.includes(k)), JSON.stringify(i.shown));
    for (const key of KEYS) {
      await s.ev(`const sel=r.querySelector('.ag-phasefilter'); sel.value=${JSON.stringify(key)}; sel.dispatchEvent(new Event('input',{bubbles:true})); sel.dispatchEvent(new Event('change',{bubbles:true})); return 1`);
      await s.page.waitForTimeout(150);
      i = await info();
      const expect = key === "end" ? ["end"] : [key];
      // Ein Kapitel, das mehrere Phasen überspannt ("Beim Scharfschalten", "Bei einem Alarm"), bleibt als Titel stehen; Punkte und Listen sind nur die der Phase
      const rest = i.points.filter((p) => !expect.includes(p));
      check(`${tag}: Phase "${key}": nur ihr Punkt samt Liste ist zu sehen (die Kapiteltitel bleiben), der Entwurf bleibt unberührt`, i.points.includes(key) && rest.length === 0 && i.value === key && i.dirty === 0, JSON.stringify(i.shown));
    }
    await s.ev("const sel=r.querySelector('.ag-phasefilter'); sel.value=''; sel.dispatchEvent(new Event('input',{bubbles:true})); return 1");
    await s.page.waitForTimeout(150);
    i = await info();
    check(`${tag}: "${t.all}" zeigt wieder alles`, KEYS.every((k) => i.shown.includes(k)) && i.value === "", JSON.stringify(i.shown));
    // Reiter "Immer aktiv": nur die Phasen, die es dort gibt; eine Auswahl, die es dort nicht gibt, fällt auf "Alle Phasen" zurück
    await s.ev("const sel=r.querySelector('.ag-phasefilter'); sel.value='disarmed'; sel.dispatchEvent(new Event('input',{bubbles:true})); return 1");
    await s.tap('[data-trigger="always"]');
    await s.page.waitForTimeout(500);
    i = await info();
    check(`${tag}: "Immer aktiv": nur Stiller Alarm, Alarm beginnt und Alarm endet; die nicht vorhandene Phase fällt auf "${t.all}" zurück`, JSON.stringify(i.opts.slice(1).map((o) => o[0])) === JSON.stringify(["report", "alarm", "end"]) && i.value === "" && i.shown.includes("report") && i.shown.includes("end"), JSON.stringify(i));
    check(`${tag}: keine Fehler im Panel`, s.errors.length === 0, s.errors.join("|"));
    await s.ctx.close();
  }
}
await browser.close();
done();
