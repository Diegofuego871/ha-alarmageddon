// 1.59.0: Aktions-Gruppe (Wunsch des Nutzers, 2026-11-17; Variante B des Mockups mit dem Rahmen in der Farbe der Liste). Eine Gruppe
// wiederholt ihre Schritte: Anzahl, Dauer oder bis deaktiviert. Schritte kommen über das Plus in die Gruppe oder durch Ziehen, und wieder
// hinaus. Wandert eine Gruppe in einen anderen Bereich, fallen nach einer Rückfrage die Aktionen weg, die es dort nicht gibt.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { group: "Aktions-Gruppe", title: 'Gruppe "Blinken"', count: "4 Durchläufe", until: "Wiederholen bis deaktiviert", waits: "Wartet", lost: "nicht möglich", move: "Verschieben und entfernen" },
  en: { group: "Action group", title: 'Group "Blinken"', count: "4 rounds", until: "Repeat until disarmed", waits: "Waits", lost: "not possible", move: "Move and remove" },
};
const ON = { type: "action", action: "switch.turn_on", target: ["switch.steckdose_flur"], data: {}, restore: false, wait: false };
const WAIT = { type: "wait", seconds: 2 };

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config" });
    // Alle Listen zugleich im Bild (die Maus trifft nur, was sichtbar ist). Seit 1.62.0 höher: die festen Meldungen und das Kapitel
    // "Bei einem stillen Alarm" machen die Seite länger, mit einer vollen Gruppe reichte die frühere Höhe auf dem Handy nicht mehr.
    await s.page.setViewportSize(mobile ? { width: 390, height: 5800 } : { width: 1440, height: 4400 });
    await s.page.waitForTimeout(600);
    await s.tap('[data-sub="actions"]');
    await s.waitFor("return !!r.querySelector('.ag-wf-armed') && !!r.querySelector('.ag-wf-main')");
    await s.page.waitForTimeout(600);
    const draft = (zone) => s.ev(`return JSON.parse(JSON.stringify(r.host.actions.steps(${JSON.stringify(zone)})))`);
    const setSteps = (zone, steps) => s.ev(`const a=r.host.actions; a.ensureDraft(); a._setSteps(arg, ${JSON.stringify(zone)}); a.saveState=null; a.render(); return 1`, steps);
    const kindsIn = (sel) => s.ev(`return [...r.querySelectorAll(${JSON.stringify(sel)})].map((e) => [...e.classList].find((c) => c.startsWith('k-')).slice(2)).join()`);
    const box = async (sel) => (await s.el(sel)).boundingBox();
    const drag = async (grabSel, toSel, { probe = false, dy = 0 } = {}) => {
      const g = await box(grabSel);
      const to = await box(toSel);
      await s.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await s.page.mouse.down();
      await s.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 - 20, { steps: 4 });
      await s.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + dy, { steps: 12 });
      const lit = probe ? await s.ev("return [...r.querySelectorAll('.ag-wf-line.ag-drop')].map((e) => e.dataset.zone || 'main')") : null;
      const red = probe ? await s.ev("return [...r.querySelectorAll('.ag-wf-line.ag-drop-no')].map((e) => e.dataset.zone || 'main')") : null;
      await s.page.mouse.up();
      await s.page.waitForTimeout(250);
      return { lit, red };
    };

    // ----- Anlegen über das Plus -----
    const before = (await draft("main")).length;
    await s.tap(".ag-wf-main > .ag-wf-plus .ag-wf-add");
    await s.waitFor("return r.getElementById('ag-step').open");
    check(`${tag}: die Auswahl bietet "${t.group}" an`, await s.ev(`return [...r.querySelectorAll('#ag-step [data-wf="kind"] b')].some((b) => b.textContent === ${JSON.stringify(t.group)})`));
    await s.tap('#ag-step [data-wf="kind"][data-kind="group"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-key=\"gName\"]')");
    check(`${tag}: Fenster der Gruppe: Reiterleiste mit Kapsel, beim Alarm drei Arten (Anzahl, Dauer, bis deaktiviert)`, await s.ev("const seg=r.querySelector('#ag-step [data-seg=\"gmode\"]'); return !!seg && seg.querySelectorAll('button').length === 3 && !!seg.querySelector('.ag-pill') && seg.querySelector('button.on').dataset.value === 'count'"));
    await s.ev("const i=r.querySelector('#ag-step [data-key=\"gName\"]'); i.value='Blinken'; i.dispatchEvent(new Event('input',{bubbles:true})); const c=r.querySelector('#ag-step [data-key=\"gCount\"]'); c.value='4'; c.dispatchEvent(new Event('input',{bubbles:true})); return 1");
    await s.tap('#ag-step [data-wf="waitend"]');
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    const made = (await draft("main"))[0];
    check(`${tag}: die Gruppe steht im Entwurf (Name, Anzahl, wartet, noch ohne Schritte)`, (await draft("main")).length === before + 1 && made.type === "group" && made.name === "Blinken" && made.mode === "count" && made.count === 4 && made.wait === true && made.steps.length === 0, JSON.stringify(made));
    const head = await s.ev("const g=r.querySelector('.ag-wf-main > .ag-wf-group[data-index=\"0\"]'); return g ? { pill: g.querySelector('.ag-wf-gpill').textContent.trim(), sum: g.querySelector('.ag-wf-gsum').textContent.trim(), waits: g.querySelector('.ag-wf-ghead .ag-waitpill')?.textContent.trim() || '', zone: g.querySelector('.ag-wf-glist').dataset.zone } : null");
    check(`${tag}: Karte der Gruppe: Kopfzeile mit Name, Wiederholung und der Pille "Wartet ..."; eigene Liste "main:0"`, head?.pill === t.title && head.sum === t.count && head.waits.startsWith(t.waits) && head.zone === "main:0", JSON.stringify(head));
    // 1.62.1 (Wunsch des Nutzers): wie die Gruppe wiederholt, steht etwas grösser und fett, damit es auffällt
    const sumStyle = await s.ev("const x=getComputedStyle(r.querySelector('.ag-wf-main > .ag-wf-group[data-index=\"0\"] .ag-wf-gsum')); return { size: x.fontSize, weight: Number(x.fontWeight) }");
    check(`${tag}: "${t.count}" steht in 16 px und fett`, sumStyle.size === "16px" && sumStyle.weight >= 700, JSON.stringify(sumStyle));

    // Rahmen in der Farbe der Liste: beim Alarm rot, beim Scharfschalten hellrot (nie violett wie im Mockup)
    await setSteps("armed", [{ type: "group", mode: "count", count: 2, seconds: 60, steps: [], wait: false }]);
    const colour = await s.ev(`const want = (line) => { const probe = document.createElement('div'); probe.style.cssText = 'border:2px solid color-mix(in srgb, var(--z) 62%, var(--ag-card))'; line.appendChild(probe); const c = getComputedStyle(probe).borderTopColor; probe.remove(); return c; };
      const out = {}; for (const zone of ['main', 'armed']) { const line = r.querySelector('.ag-wf-' + zone); const g = line.querySelector(':scope > .ag-wf-group'); out[zone] = [getComputedStyle(g).borderTopColor, want(line), getComputedStyle(g).borderTopWidth, getComputedStyle(line).getPropertyValue('--z').trim()]; } return out;`);
    check(`${tag}: der Rahmen trägt die Farbe der Liste (Alarm #d32f2f, Scharf geschaltet #ff8a80), 2 px`, colour.main[0] === colour.main[1] && colour.armed[0] === colour.armed[1] && colour.main[0] !== colour.armed[0] && colour.main[2] === "2px" && colour.main[3] === "#d32f2f" && colour.armed[3] === "#ff8a80", JSON.stringify(colour));

    // ----- Schritt über das Plus in der Gruppe -----
    await s.tap('.ag-wf-main > .ag-wf-group[data-index="0"] .ag-wf-glist .ag-wf-add');
    await s.waitFor("return r.getElementById('ag-step').open");
    const offered = await s.ev("return [...r.querySelectorAll('#ag-step [data-wf=\"kind\"]')].map((b) => b.dataset.kind)");
    check(`${tag}: in der Gruppe gibt es weder Gruppe noch "Quittieren", sonst die Schritte der Liste`, !offered.includes("group") && !offered.includes("acknowledge") && offered.includes("notify") && offered.includes("device") && offered.includes("wait"), offered.join());
    await s.tap('#ag-step [data-wf="kind"][data-kind="wait"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-key=\"seconds\"]')");
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    check(`${tag}: der Schritt liegt in der Gruppe, als Karte wie überall (Test, Bearbeiten, Duplizieren, Löschen)`, (await draft("main"))[0].steps.length === 1 && (await draft("main:0"))[0].type === "wait"
      && await s.ev("const c=r.querySelector('.ag-wf-glist[data-zone=\"main:0\"] > .ag-wf-step'); return !!c && c.querySelectorAll('.ag-wf-btns .ag-iconbtn').length === 4"));

    // ----- "Bis deaktiviert": nur beim Alarm, wartet nie -----
    await s.tap('.ag-wf-main > .ag-wf-group[data-index="0"] > .ag-wf-ghead [data-wf="edit"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-seg=\"gmode\"]')");
    await s.tap('#ag-step [data-wf="gmode"][data-value="until_disarmed"]');
    check(`${tag}: "bis deaktiviert": der Schalter "Warten, bis ... beendet ist" ist aus und gesperrt`, await s.waitFor("const b=r.querySelector('#ag-step [data-wf=\"waitend\"]'); return !!b && b.disabled && !b.classList.contains('on')"));
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    const endless = (await draft("main"))[0];
    check(`${tag}: gespeichert als "bis deaktiviert" ohne Warten; die Kopfzeile sagt es, ohne Pille`, endless.mode === "until_disarmed" && endless.wait === false
      && await s.ev(`const g=r.querySelector('.ag-wf-main > .ag-wf-group'); return g.querySelector('.ag-wf-gsum').textContent.trim() === ${JSON.stringify(t.until)} && !g.querySelector('.ag-wf-ghead .ag-waitpill')`), JSON.stringify(endless));
    await s.tap('.ag-wf-armed > .ag-wf-group > .ag-wf-ghead [data-wf="edit"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-seg=\"gmode\"]')");
    check(`${tag}: ausserhalb des Alarms gibt es nur Anzahl und Dauer`, await s.ev("return [...r.querySelectorAll('#ag-step [data-wf=\"gmode\"]')].map((b) => b.dataset.value).join() === 'count,duration'"));
    await s.tap('#ag-step [data-wf="close"]');
    await s.waitFor("return !r.getElementById('ag-step').open");

    // ----- Test der Gruppe: der Play-Knopf schickt die ganze Gruppe -----
    await s.tap('.ag-wf-main > .ag-wf-group[data-index="0"] > .ag-wf-ghead [data-wf="test-step"]');
    await s.waitFor("return r.getElementById('ag-confirm').open");
    await s.tap('#ag-confirm [data-c="yes"]');
    await s.waitFor("return !r.getElementById('ag-confirm').open");
    await s.page.waitForTimeout(300);
    const tested = await s.sim("return window.__calls.filter((x) => x.type === 'alarmageddon/test_workflow').pop() || null");
    check(`${tag}: der Test schickt die Gruppe mit ihren Schritten`, tested?.step?.type === "group" && tested.step.steps.length === 1 && tested.step.mode === "until_disarmed", JSON.stringify(tested));
    await s.ev("r.host.actions.test(true); return 1");
    await s.page.waitForTimeout(300);

    // ----- Ziehen: in die Gruppe, in der Gruppe, aus der Gruppe -----
    await setSteps("armed", []);
    await setSteps("main", [{ type: "notify" }, { type: "group", name: "Blinken", mode: "until_disarmed", count: 2, seconds: 60, steps: [ON, WAIT], wait: false }, { type: "wait", seconds: 30 }]);
    await s.page.waitForTimeout(300);
    const into = await drag('.ag-wf-main > .ag-wf-step[data-index="2"] > [data-wf="grab"]', '.ag-wf-glist[data-zone="main:1"] > .ag-wf-step[data-index="0"]', { probe: true, dy: -30 });
    check(`${tag}: beim Ziehen über die Gruppe leuchtet ihre Liste auf, nicht die Liste darum`, JSON.stringify(into.lit) === JSON.stringify(["main:1"]), JSON.stringify(into));
    let main = await draft("main");
    check(`${tag}: der Schritt liegt jetzt in der Gruppe (an erster Stelle), in der Liste fehlt er`, main.length === 2 && main[1].steps.length === 3 && main[1].steps[0].type === "wait" && main[1].steps[0].seconds === 30, JSON.stringify(main.map((x) => x.type)) + JSON.stringify(main[1]?.steps?.map((x) => x.type)));
    await drag('.ag-wf-glist[data-zone="main:1"] > .ag-wf-step[data-index="0"] > [data-wf="grab"]', '.ag-wf-glist[data-zone="main:1"] > .ag-wf-step[data-index="2"]', { dy: 30 });
    main = await draft("main");
    check(`${tag}: in der Gruppe umordnen: der Schritt ist ans Ende gewandert, die Gruppe behält ihre drei Schritte`, main.length === 2 && main[1].steps.length === 3 && main[1].steps[2].seconds === 30, JSON.stringify(main[1]?.steps));
    const out = await drag('.ag-wf-glist[data-zone="main:1"] > .ag-wf-step[data-index="2"] > [data-wf="grab"]', '.ag-wf-main > .ag-wf-step[data-index="0"]', { probe: true });
    main = await draft("main");
    check(`${tag}: aus der Gruppe hinaus in ihre Liste: sie leuchtet auf, der Schritt liegt wieder dort`, JSON.stringify(out.lit) === JSON.stringify(["main"]) && main.length === 3 && main.filter((x) => x.type === "group")[0].steps.length === 2 && main.some((x) => x.type === "wait" && x.seconds === 30), JSON.stringify([out, main.map((x) => x.type)]));

    // Was es in einer Gruppe nicht gibt, lässt sich nicht hineinziehen: die Gruppe leuchtet rot, nichts bewegt sich
    await setSteps("main", [{ type: "acknowledge" }, { type: "group", mode: "count", count: 2, seconds: 60, steps: [ON, WAIT], wait: false }]);
    await s.page.waitForTimeout(300);
    const no = await drag('.ag-wf-main > .ag-wf-step[data-index="0"] > [data-wf="grab"]', '.ag-wf-glist[data-zone="main:1"] > .ag-wf-step[data-index="0"]', { probe: true });
    main = await draft("main");
    check(`${tag}: "Quittieren" geht nicht in eine Gruppe (rot), die Gruppe bleibt wie sie ist`, JSON.stringify(no.red) === JSON.stringify(["main:1"]) && no.lit.length === 0 && main.filter((x) => x.type === "group")[0].steps.length === 2 && main.some((x) => x.type === "acknowledge"), JSON.stringify([no, main.map((x) => x.type)]));

    // ----- Gruppe in einen anderen Bereich: Rückfrage, dann fallen ungültige Aktionen weg -----
    const sound = { type: "sound", players: ["media_player.sonos_kueche"], sound: "siren", volume: null, duration: 30, restore: true, wait: false };
    const mixed = [{ type: "group", name: "Blinken", mode: "until_disarmed", count: 5, seconds: 60, steps: [{ type: "notify" }, ON, sound, WAIT], wait: false }];
    await setSteps("main", mixed);
    await s.page.waitForTimeout(300);
    await drag('.ag-wf-main > .ag-wf-group[data-index="0"] > .ag-wf-ghead [data-wf="grab"]', ".ag-wf-armed > .ag-wf-plus");
    check(`${tag}: Rückfrage: nennt, dass Aktionen im Bereich nicht möglich sind und entfernt werden`, await s.waitFor("return r.getElementById('ag-confirm').open") && await s.ev(`const d=r.getElementById('ag-confirm'); return d.textContent.includes(${JSON.stringify(t.lost)}) && d.querySelector('[data-c="yes"]').textContent.trim() === ${JSON.stringify(t.move)}`), await s.ev("return r.getElementById('ag-confirm').textContent"));
    await s.tap('#ag-confirm [data-c="no"]');
    await s.waitFor("return !r.getElementById('ag-confirm').open");
    await s.page.waitForTimeout(200);
    check(`${tag}: "Abbrechen": die Gruppe bleibt, wo und wie sie war`, (await draft("main")).length === 1 && (await draft("main"))[0].steps.length === 4 && (await draft("armed")).length === 0);
    await drag('.ag-wf-main > .ag-wf-group[data-index="0"] > .ag-wf-ghead [data-wf="grab"]', ".ag-wf-armed > .ag-wf-plus");
    await s.waitFor("return r.getElementById('ag-confirm').open");
    await s.tap('#ag-confirm [data-c="yes"]');
    await s.waitFor("return !r.getElementById('ag-confirm').open");
    await s.page.waitForTimeout(300);
    const armed = await draft("armed");
    check(`${tag}: nach der Bestätigung liegt die Gruppe im neuen Bereich, ohne Meldung und Alarmton, mit Anzahl statt "bis deaktiviert"`, (await draft("main")).length === 0 && armed.length === 1 && armed[0].type === "group" && armed[0].steps.map((x) => x.type).join() === "action,wait" && armed[0].mode === "count" && armed[0].count === 5 && armed[0].name === "Blinken", JSON.stringify(armed));
    check(`${tag}: der Rahmen hat jetzt die Farbe des neuen Bereichs`, await s.ev("const line=r.querySelector('.ag-wf-armed'); return getComputedStyle(line).getPropertyValue('--z').trim() === '#ff8a80' && !!line.querySelector(':scope > .ag-wf-group')"));
    // Passt alles, kommt keine Rückfrage
    await setSteps("armed", []);
    await setSteps("main", [{ type: "group", mode: "count", count: 2, seconds: 60, steps: [ON, WAIT], wait: false }]);
    await s.page.waitForTimeout(300);
    await drag('.ag-wf-main > .ag-wf-group[data-index="0"] > .ag-wf-ghead [data-wf="grab"]', ".ag-wf-armed > .ag-wf-plus");
    check(`${tag}: eine Gruppe, deren Aktionen alle passen, wandert ohne Rückfrage`, await s.ev("return !r.getElementById('ag-confirm').open") && (await draft("armed")).length === 1 && (await draft("armed"))[0].steps.length === 2);

    // ----- Tastatur: hinein, hindurch, hinaus -----
    await setSteps("armed", []);
    await setSteps("main", [{ type: "wait", seconds: 7 }, { type: "group", mode: "count", count: 2, seconds: 60, steps: [ON], wait: false }]);
    await s.page.waitForTimeout(300);
    if (!mobile) {
      await s.ev("r.querySelector('.ag-wf-main > .ag-wf-step[data-index=\"0\"] > [data-wf=\"grab\"]').focus(); return 1");
      await s.page.keyboard.press("ArrowDown");
      await s.page.waitForTimeout(250);
      main = await draft("main");
      check(`${tag}: Pfeil nach unten vor einer Gruppe: der Schritt geht an ihren Anfang, der Griff behält den Fokus`, main.length === 1 && main[0].steps.map((x) => x.type).join() === "wait,action"
        && await s.ev("const a=r.activeElement; return !!a && a.dataset.wf === 'grab' && a.closest('[data-zone]')?.dataset.zone === 'main:0' && a.dataset.index === '0'"), JSON.stringify(main));
      await s.page.keyboard.press("ArrowDown");
      await s.page.waitForTimeout(200);
      await s.page.keyboard.press("ArrowDown");
      await s.page.waitForTimeout(250);
      main = await draft("main");
      check(`${tag}: weiter nach unten: durch die Gruppe hindurch und hinter ihr wieder hinaus`, main.length === 2 && main[0].type === "group" && main[0].steps.length === 1 && main[1].type === "wait", JSON.stringify(main.map((x) => x.type)));
      await s.page.keyboard.press("ArrowUp");
      await s.page.waitForTimeout(250);
      main = await draft("main");
      check(`${tag}: Pfeil nach oben hinter einer Gruppe: der Schritt geht an ihr Ende`, main.length === 1 && main[0].steps.map((x) => x.type).join() === "action,wait", JSON.stringify(main));
    }

    // ----- "Nach einer Zeit rückgängig machen" gibt es auch in der Gruppe (1.60.0): beim Hineinziehen bleibt die Einstellung erhalten -----
    await setSteps("main", [{ ...ON, undo_after: 120 }, { type: "group", mode: "count", count: 2, seconds: 60, steps: [WAIT], wait: false }]);
    await s.page.waitForTimeout(300);
    await drag('.ag-wf-main > .ag-wf-step[data-index="0"] > [data-wf="grab"]', '.ag-wf-glist[data-zone="main:1"] > .ag-wf-step[data-index="0"]', { dy: -30 });
    main = await draft("main");
    check(`${tag}: ein Schritt mit "Nach einer Zeit rückgängig" behält die Einstellung, wenn er in eine Gruppe gezogen wird`, main.length === 1 && main[0].steps.length === 2 && main[0].steps[0].undo_after === 120, JSON.stringify(main));
    await s.tap('.ag-wf-glist[data-zone="main:0"] > .ag-wf-step[data-index="0"] [data-wf="edit"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-wf=\"undo\"]')");
    check(`${tag}: das Fenster des Schritts in der Gruppe zeigt die Option (an, 120 s) mit dem Hinweis, dass jede Runde die Zeit neu beginnt`, await s.ev("const d=r.getElementById('ag-step'); return d.querySelector('[data-wf=\"undo\"]').classList.contains('on') && d.querySelector('[data-key=\"undoSeconds\"]').value === '120' && !!d.querySelector('.ag-undo-group')?.textContent.trim()"));
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    check(`${tag}: nach "Übernehmen" steht die Zeit weiter im Schritt, die Karte nennt sie`, (await draft("main"))[0].steps[0].undo_after === 120 && await s.ev("return /2\\s*min/.test(r.querySelector('.ag-wf-glist[data-zone=\"main:0\"] > .ag-wf-step[data-index=\"0\"] .ag-wf-text').textContent)"), await s.ev("return r.querySelector('.ag-wf-glist[data-zone=\"main:0\"] > .ag-wf-step[data-index=\"0\"] .ag-wf-text').textContent"));

    // ----- Grenzen: 10 Schritte je Gruppe -----
    await setSteps("main", [{ type: "group", mode: "count", count: 2, seconds: 60, steps: Array.from({ length: 10 }, () => WAIT), wait: false }, { type: "wait", seconds: 9 }]);
    await s.page.waitForTimeout(300);
    check(`${tag}: eine volle Gruppe (10 Schritte): Plus und Duplizieren in der Gruppe sind gesperrt`, await s.ev("const g=r.querySelector('.ag-wf-glist[data-zone=\"main:0\"]'); return [...g.querySelectorAll(':scope > .ag-wf-plus .ag-wf-add')].every((b) => b.disabled) && [...g.querySelectorAll('[data-wf=\"duplicate\"]')].every((b) => b.disabled)"));
    const fullDrag = await drag('.ag-wf-main > .ag-wf-step[data-index="1"] > [data-wf="grab"]', '.ag-wf-glist[data-zone="main:0"] > .ag-wf-step[data-index="9"]', { probe: true });
    check(`${tag}: in eine volle Gruppe lässt sich nichts ziehen (rot)`, JSON.stringify(fullDrag.red) === JSON.stringify(["main:0"]) && (await draft("main"))[0].steps.length === 10, JSON.stringify(fullDrag));

    // ----- Darstellung und Speichern -----
    await setSteps("main", [{ type: "notify" }, { type: "group", name: "Blinken", mode: "duration", count: 2, seconds: 300, steps: [ON, WAIT], wait: true }]);
    await s.page.waitForTimeout(300);
    const fit = await s.ev("const g=r.querySelector('.ag-wf-main > .ag-wf-group'); const b=g.getBoundingClientRect(); const cards=[...g.querySelectorAll('.ag-wf-glist > .ag-wf-step')].map((c) => c.getBoundingClientRect()); return { inside: cards.every((c) => c.left >= b.left && c.right <= b.right && c.top >= b.top && c.bottom <= b.bottom), right: b.right, width: window.innerWidth, btn: Math.min(...[...g.querySelectorAll('.ag-wf-btns .ag-iconbtn')].map((x) => x.getBoundingClientRect().width)) }");
    check(`${tag}: die Karten liegen im Rahmen, nichts ragt über den Rand; Knöpfe 44 px`, fit.inside && fit.right <= fit.width && fit.btn >= 44, JSON.stringify(fit));
    check(`${tag}: die Karten in der Gruppe tragen die Pille ihres Bereichs`, await s.ev("const z=[...r.querySelectorAll('.ag-wf-glist[data-zone=\"main:1\"] .ag-zone')]; const own=r.querySelector('.ag-wf-main > .ag-wf-step[data-index=\"0\"] .ag-zone').textContent; return z.length === 2 && z.every((x) => x.textContent === own)"));
    check(`${tag}: ungespeichert: Speichern ist möglich`, await s.ev("return !r.querySelector('[data-wf=\"save\"]').disabled"));
    await s.tap('[data-wf="save"]');
    const saved = await s.waitFor("return r.querySelector('[data-wf=\"save\"]')?.disabled === true", 30000);
    const sent = await s.sim("const c = window.__calls.filter((x) => x.type === 'alarmageddon/save_workflows').pop(); const g = Object.values(c.workflows)[0].find((x) => x.type === 'group') || Object.values(c.workflows).flat().find((x) => x.type === 'group'); return g");
    check(`${tag}: gespeichert wird die Gruppe mit Art, Dauer, "wait" und ihren Schritten; danach ist nichts mehr offen`, saved && sent?.mode === "duration" && sent.seconds === 300 && sent.wait === true && sent.steps.length === 2 && sent.name === "Blinken", JSON.stringify(sent));
    check(`${tag}: nach dem Speichern steht die Gruppe weiter da (aus dem gespeicherten Stand)`, await s.waitFor("return !!r.querySelector('.ag-wf-main > .ag-wf-group .ag-wf-glist > .ag-wf-step')"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
