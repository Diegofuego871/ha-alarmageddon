// 1.86.0: Befunde des Selbsttests an den Karten der Aktionen (Wunsch des Nutzers 2026-11-23): fehlt eine Entität oder ist sie nicht erreichbar, trägt die Karte
// des Schritts ein grosses rotes Ausrufezeichen, einen roten Rahmen und eine Zeile je Befund (ein Tipp öffnet den Befund im Selbsttest); der Reiter des Modus trägt
// ein Ausrufezeichen; Befunde ohne Gefahr für den Alarm sind orange; Gruppen zeigen ihre Befunde mit; nach "Jetzt prüfen" folgt alles dem neuen Stand.
// Je Sprache, Desktop und Handy, echte Klicks/Taps, erfundene Namen.
import { check, done, launch, open } from "../lib.mjs";

const J = JSON.stringify;
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;

    // ----- Ohne Befunde: nichts markiert -----
    const clean = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "actions" } });
    await clean.waitFor("return !!r.querySelector('.ag-wf-main > .ag-wf-step')");
    check(`${tag}: ohne Befunde trägt keine Karte und kein Reiter eine Marke`, await clean.ev("return !r.querySelector('.ag-bad, .ag-wf-badge, .ag-wf-prob, .ag-tabmark')"));
    await clean.ctx.close();

    // ----- Mit Befunden (Nachbau: siren.flur fehlt im Schritt 4, ein Lautsprecher ist nicht erreichbar im Schritt 5, beides beim Alarm im Modus Abwesend) -----
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "actions" }, query: "&selftest=problems" });
    await s.waitFor("return !!r.querySelector('.ag-wf-main > .ag-wf-step')");
    const marked = (zone, i) => s.ev(`const c=r.querySelector('${zone} > .ag-wf-step[data-index="${i}"]'); const b=c?.querySelector(':scope > .ag-wf-badge'); const p=[...(c?.querySelectorAll(':scope .ag-wf-prob') || [])]; return c ? { bad: c.classList.contains('ag-bad'), tone: c.classList.contains('err') ? 'err' : c.classList.contains('warn') ? 'warn' : '', badge: b?.textContent || '', left: b ? b.getBoundingClientRect().left : null, size: b ? b.getBoundingClientRect().width : 0, probs: p.map((x) => x.textContent.trim()) } : null`);
    const m3 = await marked(".ag-wf-main", 3);
    const m4 = await marked(".ag-wf-main", 4);
    check(`${tag}: Schritt 4 (Entität fehlt): grosses rotes Ausrufezeichen an der Ecke, roter Rahmen, eine Zeile mit dem Befund`, m3.bad && m3.tone === "err" && m3.badge === "!" && m3.size >= 30 && m3.left >= 0 && m3.probs.length === 1 && m3.probs[0].includes("Sirene Flur"), J(m3));
    check(`${tag}: Schritt 5 (nicht erreichbar): ebenfalls markiert, mit dem Namen des Geräts`, m4.bad && m4.badge === "!" && m4.probs.length === 1 && m4.probs[0].includes("Sonos Wohnzimmer"), J(m4));
    check(`${tag}: die Schritte ohne Befund bleiben unmarkiert`, await s.ev("return [0, 1, 2].every((i) => { const c=r.querySelector('.ag-wf-main > .ag-wf-step[data-index=\"' + i + '\"]'); return !!c && !c.classList.contains('ag-bad') && !c.querySelector(':scope > .ag-wf-badge'); })"));
    check(`${tag}: der Reiter Abwesend trägt ein Ausrufezeichen mit der Zahl der Befunde im Tooltip, die anderen Reiter keins`, await s.ev("const t=(m) => r.querySelector('[data-trigger=\"' + m + '\"] .ag-tabmark'); const a=t('away'); return !!a && a.textContent === '!' && /2/.test(a.title) && !t('home') && !t('always')"));

    // Tipp auf die Zeile: der Selbsttest öffnet genau diesen Befund aufgeklappt
    await s.tap('.ag-wf-main > .ag-wf-step[data-index="3"] [data-wf="st-open"]');
    check(`${tag}: ein Tipp auf die Zeile öffnet den Selbsttest bei diesem Befund (aufgeklappt)`, await s.waitFor("const d=r.getElementById('ag-selftest'); const it=d.querySelector('[data-st-key=\"e_haus|entity_missing|siren.flur\"]'); return d.open && !!it && it.querySelector('.ag-st-head').getAttribute('aria-expanded') === 'true'", 4000));

    // "Jetzt prüfen": ist alles behoben, verschwinden die Marken
    await s.sim("window.__selftestAfterRun = []; return 1");
    await s.tap('#ag-selftest [data-st="run"]');
    await s.waitFor("return !r.querySelector('.ag-wf-main .ag-bad')", 6000);
    await s.tap('#ag-selftest [data-st="close"]');
    check(`${tag}: nach "Jetzt prüfen" ohne Befunde sind alle Marken weg (Karten, Zeilen, Reiter)`, await s.ev("return !r.querySelector('.ag-bad, .ag-wf-badge, .ag-wf-prob, .ag-tabmark')"));

    // ----- Nach dem Speichern wird sofort geprüft: die Marke eines behobenen Befunds verschwindet, ohne auf die nächste Abfrage zu warten (Wunsch des Nutzers 2026-11-23) -----
    const fix = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "actions" }, query: "&selftest=problems" });
    await fix.waitFor("return !!r.querySelector('.ag-wf-main > .ag-wf-step.ag-bad')");
    await fix.sim("window.__selftestAfterRun = []; window.__selftestRuns = 0; window.__selftestDelay = 1500; return 1");
    // Der Nutzer behebt den Fehler: er entfernt den Schritt mit der fehlenden Sirene (Entwurf ändern), dann "Speichern"
    await fix.ev("const a=r.host.actions; a._setSteps(a.steps('main').filter((_s, i) => i !== 3), 'main'); a.render(); return 1");
    await fix.waitFor("const b=r.querySelector('[data-wf=\"save\"]'); return !!b && !b.disabled");
    await fix.tap('[data-wf="save"]');

    check(`${tag}: während der Prüfung zeigt die Karte "Wird geprüft" (drehender Ring) und die Marke ist noch nicht weg`, await fix.waitFor("return !!r.querySelector('.ag-wf-main .ag-wf-badge.chk') && !!r.querySelector('.ag-wf-prob.chk')", 4000).catch(() => false) !== false);
    check(`${tag}: die Prüfung läuft sofort beim Speichern (ein Lauf), danach sind die Marken weg`, await fix.waitFor("return (window.parent.__selftestRuns ?? window.__selftestRuns ?? 0) >= 1 && !r.querySelector('.ag-bad, .ag-wf-badge, .ag-tabmark')", 9000).catch(() => false) !== false);
    check(`${tag}: keine Fehler in der Konsole (Speichern)`, fix.errors.length === 0, fix.errors.join(" | "));
    // Findet die Prüfung den Befund weiterhin, bleibt die Marke nach dem Prüfen stehen (nie "verschwindet" ohne wirklich gut)
    await fix.sim("window.__selftestAfterRun = null; window.__selftestRuns = 0; return 1");
    await fix.ev("r.host.selftest.checkAfterSave(); return 1");
    await fix.waitFor("return !r.querySelector('.ag-wf-badge.chk') && (window.parent.__selftestRuns ?? window.__selftestRuns ?? 0) >= 1", 9000);
    check(`${tag}: bleibt der Befund bestehen, steht die Marke nach der Prüfung weiter da`, await fix.ev("return r.host.selftest.problems().length === 0 || !!r.querySelector('.ag-wf-badge.err, .ag-wf-badge.warn, .ag-tabmark')"));
    await fix.ctx.close();

    // ----- Gruppen und orange Befunde (Nachbau: Befunde direkt setzen) -----
    await s.sim(`window.__selftest.problems = [
      { key: 'e_haus|entity_missing|light.keller', kind: 'config', code: 'entity_missing', entry_id: 'e_haus', subject: 'light.keller', entity_id: 'light.keller', role: 'output', reason: 'deleted', places: [{ area: 'workflow', list: 'alarm', trigger: 'away', step: 6, sub: 1 }] },
      { key: 'e_haus|entity_unavailable|cover.garage', kind: 'config', code: 'entity_unavailable', entry_id: 'e_haus', subject: 'cover.garage', entity_id: 'cover.garage', role: 'output', since: new Date().toISOString(), places: [{ area: 'workflow', list: 'armed', trigger: 'away', step: 1 }] },
    ]; return 1`);
    await s.ev("r.host._fetch(); return 1");
    await s.waitFor("return r.host._data?.selftest?.problems?.length === 2");
    await s.ev("const a=r.host.actions; a.reset(); a.render(); return 1");
    await s.waitFor("return !!r.querySelector('.ag-wf-main > .ag-wf-step')");
    await s.ev("const a=r.host.actions; a._setSteps([...a.steps('main'), { type: 'group', mode: 'count', count: 2, steps: [{ type: 'wait', seconds: 5 }] }], 'main'); a._setSteps([{ type: 'wait', seconds: 1 }], 'armed'); const sys=r.host._system(); sys.workflows={...sys.workflows,[a.trigger]:JSON.parse(JSON.stringify(a.steps('main')))}; sys.workflows_armed={...sys.workflows_armed,[a.trigger]:JSON.parse(JSON.stringify(a.steps('armed')))}; a.render(); return 1");
    await s.waitFor("return !!r.querySelector('.ag-wf-main > .ag-wf-group')");
    check(`${tag}: eine Gruppe trägt das Ausrufezeichen und zählt ihre Befunde ("1 Problem"), die Karte in der Gruppe trägt ihren eigenen`, await s.ev("const g=r.querySelector('.ag-wf-main > .ag-wf-group'); const inner=g.querySelector('.ag-wf-glist > .ag-wf-step'); const sum=g.querySelector('.ag-wf-ghead .ag-wf-prob.gsum'); return g.classList.contains('ag-bad') && !!g.querySelector(':scope > .ag-wf-badge') && !!sum && /1/.test(sum.textContent) && !!inner && inner.classList.contains('ag-bad') && !!inner.querySelector('.ag-wf-prob') && /Keller|keller/i.test(inner.querySelector('.ag-wf-prob').textContent)"));
    check(`${tag}: ein Befund ausserhalb des Alarms (Gerät nicht erreichbar beim Scharfschalten) ist orange, nicht rot`, await s.ev("const c=r.querySelector('.ag-wf-armed > .ag-wf-step'); const b=c?.querySelector(':scope > .ag-wf-badge'); return !!c && c.classList.contains('warn') && !!b && b.classList.contains('warn') && getComputedStyle(b).backgroundColor !== getComputedStyle(r.querySelector('.ag-wf-main .ag-wf-badge')).backgroundColor"));
    check(`${tag}: der Reiter trägt die Zahl beider Befunde (ein roter dabei)`, await s.ev("const a=r.querySelector('[data-trigger=\"away\"] .ag-tabmark'); return !!a && /2/.test(a.title) && a.classList.contains('err')"));
    // Absicherung: ändert sich die Reihenfolge der Schritte im Entwurf, sässen die Marken (über die Stelle) an der falschen Karte: sie fehlen bis zum Speichern und Prüfen
    await s.ev("const a=r.host.actions; a._setSteps([...a.steps('main')].reverse(), 'main'); a.render(); return 1");
    check(`${tag}: nach einer geänderten Reihenfolge im Entwurf steht keine Marke an einer Karte der Liste (nie an der falschen)`, await s.waitFor("return !r.querySelector('.ag-wf-main .ag-wf-badge, .ag-wf-main .ag-wf-prob')", 3000).catch(() => false) !== false);
    check(`${tag}: die Marken einer anderen, unveränderten Liste bleiben`, await s.ev("return !!r.querySelector('.ag-wf-armed > .ag-wf-step > .ag-wf-badge')"));
    await s.ev("const a=r.host.actions; a._setSteps([...a.steps('main')].reverse(), 'main'); a.render(); return 1");
    check(`${tag}: stimmt die Reihenfolge wieder, sind die Marken wieder da`, await s.waitFor("return !!r.querySelector('.ag-wf-main .ag-wf-badge')", 3000).catch(() => false) !== false);
    check(`${tag}: keine Fehler in der Konsole`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
