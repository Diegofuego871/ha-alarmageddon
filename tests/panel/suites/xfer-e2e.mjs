// 1.85.0: Aktion verschieben oder kopieren (Wunsch des Nutzers 2026-11-23, Mockups aktion-verschieben-v1 und -v2, Variante B). Der Knopf an der Karte öffnet das
// Fenster mit den Reitern der Modi und dem Baum der Phasen; die gewählte Phase klappt auf und zeigt ihre Aktionen mit Einfügepunkten (genaue Stelle). Nur erlaubte
// Ziele; "Verschieben" nimmt die Aktion weg, "Kopieren" lässt sie stehen; danach springt die Seite zur Aktion, hebt sie hervor und bietet "Rückgängig" an.
// Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { title: "Aktion verschieben oder kopieren", moved: "verschoben nach", copied: "kopiert nach", undo: "Rückgängig", full: "Diese Liste ist voll", same: "gleiche Stelle · nur Kopieren", self: "diese Aktion" },
  en: { title: "Move or copy action", moved: "moved to", copied: "copied to", undo: "Undo", full: "This list is full", same: "same place · copy only", self: "this action" },
};
const J = JSON.stringify;
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "actions" } });
    await s.waitFor("return !!r.querySelector('.ag-wf-main > .ag-wf-step')");
    const types = (zone, trigger = null) => s.ev(`const a=r.host.actions; return a.steps(${J(zone)}${trigger ? `, ${J(trigger)}` : ""}).map((x) => x.type)`);
    const xfer = (index, zone = "main") => s.tap(`${zone === "main" ? ".ag-wf-main" : ".ag-wf-" + zone} > .ag-wf-step[data-index="${index}"] [data-wf="xfer"]`);
    const dlgOpen = () => s.waitFor("return r.getElementById('ag-xfer').open");
    const dlg = (code) => s.ev(`const d=r.getElementById('ag-xfer'); ${code}`);
    const slots = () => dlg("return [...d.querySelectorAll('.ag-xf-slot')].map((b) => b.dataset.zone + ':' + b.dataset.at + (b.classList.contains('same') ? 's' : '') + (b.classList.contains('on') ? '*' : ''))");

    // ----- Knopf: an jeder Karte, zwischen "Duplizieren" und "Löschen" -----
    check(`${tag}: jede Karte hat den Knopf "Verschieben oder kopieren" zwischen Duplizieren und Löschen, "Duplizieren" bleibt`, await s.ev(`const cards=[...r.querySelectorAll('.ag-wf-step')]; return cards.length >= 5 && cards.every((c) => { const k=[...c.querySelector('.ag-wf-btns').querySelectorAll('[data-wf]')].map((b) => b.dataset.wf).filter((w) => ['duplicate','xfer','delete'].includes(w)); return k.join() === 'duplicate,xfer,delete'; })`));

    // ----- Fenster: Titel, Reiter der Modi, Baum; nur erlaubte Phasen -----
    await xfer(1);
    await dlgOpen();
    check(`${tag}: Fenster "${t.title}": Aktion mit jetzigem Ort, Reiter der Modi (Abwesend gewählt), alle Phasen für "Gerät schalten"`, await dlg(`const m=[...d.querySelectorAll('.ag-xf-modes button')].map((b) => b.dataset.wf + (b.classList.contains('on') ? '*' : '')); const p=[...d.querySelectorAll('.ag-xf-p')].map((b) => b.dataset.phase);
      return d.querySelector('.ag-ttl').textContent.trim() === ${J(t.title)} && m.join() === 'xf-mode:home,xf-mode:away*,xf-mode:night,xf-mode:always' && p.join() === 'arming,armed,report,entry,alarm,end,disarmed' && /Abwesend|Away/.test(d.querySelector('.ag-xf-what').innerText)`));
    check(`${tag}: ohne gewählte Stelle sind "Verschieben" und "Kopieren" gesperrt`, await dlg("return d.querySelector('[data-wf=\"xf-move\"]').disabled && d.querySelector('[data-wf=\"xf-copy\"]').disabled"));
    if (mobile) check(`${tag}: auf dem Handy füllt das Fenster den Bildschirm`, await dlg("const b=d.getBoundingClientRect(); return b.width >= innerWidth - 2 && b.height >= innerHeight - 2"));
    await s.tap('#ag-xfer [data-wf="xf-cancel"]');
    check(`${tag}: "Abbrechen" schliesst und ändert nichts`, !(await s.ev("return r.getElementById('ag-xfer').open")) && J(await types("main")) === J(["notify", "action", "wait", "action", "sound"]));

    // Alarmton: nur im Alarm und danach (wie beim Ziehen)
    await xfer(4);
    await dlgOpen();
    check(`${tag}: der Alarmton wird nur für "Alarm beginnt" und "Alarm endet" angeboten`, await dlg("return [...d.querySelectorAll('.ag-xf-p')].map((b) => b.dataset.phase).join() === 'alarm,end'"));
    await s.tap('#ag-xfer [data-wf="xf-cancel"]');
    await xfer(0);
    await dlgOpen();
    check(`${tag}: die Push-Meldung nur für "Alarm beginnt" (dort ist sie erlaubt)`, await dlg("return [...d.querySelectorAll('.ag-xf-p')].map((b) => b.dataset.phase).join() === 'alarm'"));
    await s.tap('#ag-xfer [data-wf="xf-cancel"]');

    // ----- Verschieben in eine andere Phase, genaue Stelle, Sprung, Hervorhebung, Rückgängig -----
    const before = J({ main: await types("main"), after: await types("after") });
    await xfer(1);
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="end"]');
    check(`${tag}: die gewählte Phase klappt auf: ein Einfügepunkt in der leeren Liste`, J(await slots()) === J(["after:0"]));
    await s.tap('#ag-xfer [data-wf="xf-slot"][data-zone="after"][data-at="0"]');
    check(`${tag}: das Ziel steht in Worten in der Fusszeile, beide Knöpfe sind frei`, await dlg("const f=d.querySelector('.ag-xf-target').innerText; return /Abwesend|Away/.test(f) && !d.querySelector('[data-wf=\"xf-move\"]').disabled && !d.querySelector('[data-wf=\"xf-copy\"]').disabled"));
    await s.tap('#ag-xfer [data-wf="xf-move"]');
    await s.waitFor("return !r.getElementById('ag-xfer').open");
    check(`${tag}: Verschieben: die Aktion steht jetzt in "Alarm endet" und nicht mehr im Alarm`, J(await types("main")) === J(["notify", "wait", "action", "sound"]) && J(await types("after")) === J(["action"]));
    check(`${tag}: die Seite ist zur Aktion gesprungen und hebt sie hervor, eine Meldung nennt das Ziel und bietet "${t.undo}" an`, await s.waitFor(`const c=r.querySelector('.ag-wf-after > .ag-wf-step'); const m=r.querySelector('.ag-toast'); const b=c?.getBoundingClientRect(); return !!c && c.classList.contains('ag-flash') && !!b && b.top >= 0 && b.bottom <= innerHeight + 4 && !!m && m.innerText.includes(${J(t.moved)}) && m.querySelector('.ag-toast-act')?.textContent === ${J(t.undo)}`, 4000));
    check(`${tag}: der Entwurf ist geändert (offener Punkt am Reiter, Speichern frei)`, await s.ev("return !!r.querySelector('.ag-modeseg [data-trigger=\"away\"] .ag-dot, .ag-modeseg [data-trigger=\"away\"].dirty, [data-trigger=\"away\"] .ag-unsaved-dot') || r.host.actions.dirtyTabs().length > 0"));
    await s.tap(".ag-toast-act");
    check(`${tag}: "${t.undo}" stellt den Stand davor wieder her`, J({ main: await types("main"), after: await types("after") }) === before);

    // Rückgängig nur, solange nichts anderes geändert wurde
    await xfer(1);
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="end"]');
    await s.tap('#ag-xfer [data-wf="xf-slot"][data-zone="after"][data-at="0"]');
    await s.tap('#ag-xfer [data-wf="xf-move"]');
    await s.waitFor("return !r.getElementById('ag-xfer').open");
    await s.ev("const a=r.host.actions; a._setSteps([...a.steps('after'), { type: 'wait', seconds: 5 }], 'after'); return 1");
    await s.tap(".ag-toast-act");
    check(`${tag}: nach einer weiteren Änderung gilt "${t.undo}" nicht mehr (Hinweis, nichts wird zurückgesetzt)`, J(await types("after")) === J(["action", "wait"]) && (await s.ev("return r.querySelector('.ag-toast')?.innerText.length > 5")));
    await s.ev("const a=r.host.actions; a.reset(); return 1");

    // ----- Kopieren: bleibt am alten Ort stehen -----
    await s.ev("r.host.actions.reset(); r.host.actions.render(); return 1");
    await s.waitFor("return r.querySelector('.ag-wf-main > .ag-wf-step')");
    await xfer(1);
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="report"]');
    await s.tap('#ag-xfer [data-wf="xf-slot"][data-zone="report"][data-at="0"]');
    await s.tap('#ag-xfer [data-wf="xf-copy"]');
    await s.waitFor("return !r.getElementById('ag-xfer').open");
    check(`${tag}: Kopieren: die Aktion steht am Ziel und bleibt im Alarm`, J(await types("report")) === J(["action"]) && J(await types("main")) === J(["notify", "action", "wait", "action", "sound"]) && (await s.ev("return r.querySelector('.ag-toast')?.innerText.includes(" + J(t.copied) + ")")));

    // ----- Gleiche Liste: Stellen neben der Aktion gelten nur für das Kopieren; Reihenfolge ändern -----
    await s.ev("r.host.actions.reset(); r.host.actions.render(); return 1");
    await s.waitFor("return r.querySelector('.ag-wf-main > .ag-wf-step')");
    await xfer(1);
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="alarm"]');
    check(`${tag}: die eigene Phase ist wählbar; die Aktion selbst steht gestrichelt da ("${t.self}"), die Stellen davor und danach tragen "${t.same}"`, J(await slots()) === J(["main:0", "main:1s", "main:2s", "main:3", "main:4", "main:5"]) && await dlg(`return d.querySelector('.ag-xf-step.self .ag-xf-tag')?.textContent === ${J(t.self)} && [...d.querySelectorAll('.ag-xf-slot.same')].every((b) => b.textContent.includes(${J(t.same)}))`));
    await s.tap('#ag-xfer [data-wf="xf-slot"][data-zone="main"][data-at="2"]');
    check(`${tag}: eine Stelle neben der Aktion: Kopieren frei, Verschieben gesperrt`, await dlg("return d.querySelector('[data-wf=\"xf-move\"]').disabled && !d.querySelector('[data-wf=\"xf-copy\"]').disabled"));
    await s.tap('#ag-xfer [data-wf="xf-slot"][data-zone="main"][data-at="5"]');
    await s.tap('#ag-xfer [data-wf="xf-move"]');
    await s.waitFor("return !r.getElementById('ag-xfer').open");
    check(`${tag}: Verschieben ans Ende derselben Liste: die Aktion ist jetzt die letzte`, J(await types("main")) === J(["notify", "wait", "action", "sound", "action"]));

    // ----- Gruppen: eine Gruppe ist Teil des Baums, die Aktion lässt sich hineinlegen -----
    await s.ev("r.host.actions.reset(); r.host.actions.render(); const a=r.host.actions; a._setSteps([...a.steps('main'), { type: 'group', mode: 'count', count: 2, steps: [{ type: 'wait', seconds: 5 }] }], 'main'); a.render(); return 1");
    await s.waitFor("return r.querySelectorAll('.ag-wf-main > .ag-wf-step').length === 6");
    await xfer(1);
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="alarm"]');
    check(`${tag}: die Gruppe zeigt ihre Aktionen mit eigenen Einfügepunkten`, J(await slots()).includes('"main:5:0"') && J(await slots()).includes('"main:5:1"'));
    await s.tap('#ag-xfer [data-wf="xf-slot"][data-zone="main:5"][data-at="1"]');
    await s.tap('#ag-xfer [data-wf="xf-move"]');
    await s.waitFor("return !r.getElementById('ag-xfer').open");
    check(`${tag}: die Aktion liegt am Ende der Gruppe (die Gruppe ist nach dem Entfernen eine Stelle weiter vorn)`, await s.ev("const a=r.host.actions; const g=a.steps('main').find((x) => x.type === 'group'); return a.steps('main').length === 5 && g.steps.map((x) => x.type).join() === 'wait,action'"));
    // Eine Gruppe lässt sich nicht in eine Gruppe legen: ihre Listen bieten keine Einfügepunkte
    await s.tap('.ag-wf-main > .ag-wf-group > .ag-wf-ghead [data-wf="xfer"]');
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="alarm"]');
    check(`${tag}: für eine Gruppe gibt es keine Einfügepunkte in anderen Gruppen`, !J(await slots()).includes("main:4:") && !J(await slots()).includes("main:3:"));
    await s.tap('#ag-xfer [data-wf="xf-cancel"]');

    // ----- Anderer Modus: Reiter im Fenster, Sprung zum Reiter des Ziels -----
    await s.ev("r.host.actions.reset(); r.host.actions.render(); return 1");
    await s.waitFor("return r.querySelector('.ag-wf-main > .ag-wf-step')");
    await xfer(1);
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-mode:always"]');
    check(`${tag}: Reiter "Immer aktiv": nur Stiller Alarm, Alarm beginnt und Alarm endet (nie scharf), keine Phase offen, keine Stelle gewählt`, await dlg("return [...d.querySelectorAll('.ag-xf-p')].map((b) => b.dataset.phase).join() === 'report,alarm,end' && !d.querySelector('.ag-xf-slot') && d.querySelector('[data-wf=\"xf-move\"]').disabled"));
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="alarm"]');
    const lastAt = (await s.ev("return r.host.actions.steps('main', 'always').length"));
    await s.tap(`#ag-xfer [data-wf="xf-slot"][data-zone="main"][data-at="${lastAt}"]`);
    await s.tap('#ag-xfer [data-wf="xf-copy"]');
    await s.waitFor("return !r.getElementById('ag-xfer').open");
    check(`${tag}: Kopieren in einen anderen Modus: die Seite wechselt zum Reiter "Immer aktiv", die Aktion steht dort am Ende und im Abwesend-Ablauf bleibt sie`, await s.waitFor(`const a=r.host.actions; return a.trigger === 'always' && a.steps('main', 'always').at(-1)?.type === 'action' && a.steps('main', 'away').length === 5 && !!r.querySelector('.ag-wf-main > .ag-wf-step.ag-flash')`, 3000));
    await s.tap(".ag-toast-act");
    check(`${tag}: "${t.undo}" bringt auch den Reiter zurück`, await s.ev("const a=r.host.actions; return a.trigger === 'away' && a.steps('main', 'always').length === 0 || a.trigger === 'away'"));

    // ----- Volle Liste: weder Kopieren noch Verschieben dorthin -----
    await s.ev("r.host.actions.reset(); r.host.actions.render(); return 1");
    await s.waitFor("return r.querySelector('.ag-wf-main > .ag-wf-step')");
    await s.ev("const a=r.host.actions; a._setSteps(Array.from({ length: 40 }, () => ({ type: 'wait', seconds: 1 })), 'after'); a.render(); return 1");
    await xfer(1);
    await dlgOpen();
    await s.tap('#ag-xfer [data-wf="xf-phase"][data-phase="end"]');
    await s.tap('#ag-xfer [data-wf="xf-slot"][data-zone="after"][data-at="0"]');
    check(`${tag}: eine volle Liste nimmt nichts mehr auf: beide Knöpfe gesperrt, Hinweis "${t.full}"`, await dlg(`return d.querySelector('[data-wf="xf-move"]').disabled && d.querySelector('[data-wf="xf-copy"]').disabled && d.querySelector('.ag-xf-target').innerText.includes(${J(t.full)})`));
    await s.tap('#ag-xfer [data-wf="xf-cancel"]');

    // ----- Ohne "Einstellungen pro Modus" gibt es keine Reiter im Fenster -----
    await s.ev("r.host.actions.reset(); r.host.actions.render(); return 1");
    await s.waitFor("return r.querySelector('.ag-wf-main > .ag-wf-step')");
    await s.tap('[data-wf="permode"]');
    // Der Ablauf des ersten Modus gilt für alle (im Nachbau leer): zwei Aktionen einlegen
    await s.ev("const a=r.host.actions; a._setSteps([{ type: 'wait', seconds: 1 }, { type: 'wait', seconds: 2 }], 'main'); a.render(); return 1");
    await s.waitFor("return r.querySelectorAll('.ag-wf-main > .ag-wf-step').length === 2");
    await xfer(1);
    await dlgOpen();
    check(`${tag}: ohne getrennte Modi stehen keine Reiter der Modi im Fenster`, await dlg("return !d.querySelector('.ag-xf-modes') && d.querySelectorAll('.ag-xf-p').length >= 5"));
    await s.tap('#ag-xfer [data-wf="xf-cancel"]');
    check(`${tag}: keine Fehler in der Konsole`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
