// 1.62.0 (Wunsch des Nutzers, 2026-11-17): Die Meldungen "Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung" und "Stiller Alarm" stehen
// als feste Elemente im Reiter Aktionen, an ihrem Punkt im Ablauf (wie "Alarm endet"): immer da, anpassen oder ausschalten, die
// Standard-Empfänger sind vorgewählt. Neues Kapitel "Bei einem stillen Alarm" vor dem Alarm, mit eigenen Aktionen. Im Reiter Benachrichtigungen
// stehen die vier nicht mehr, "Empfänger" heisst "Standard-Empfänger". Eine Gruppe zeigt dezent, dass sich ihre Schritte wiederholen. Das
// Fenster "Routinen" hat je Zeile ein Auge: die Vorschau der Routine, nur zum Lesen, mit "Schliessen" (zurück zur Liste) und "Bearbeiten".
import { check, done, launch, open, outDir } from "../lib.mjs";

const T = {
  de: { armed: "Meldung: Scharf geschaltet", disarmed: "Meldung: Deaktiviert", pending: "Meldung: Eingangsverzögerung", report: "Meldung: Stiller Alarm", off: "Aus", standard: "Standard-Empfänger",
    critical: "kritisch, 80 %", own: "eigener Text", chapReport: "Bei einem stillen Alarm", point: "Stiller Alarm", recipients: "Standard-Empfänger", moved: "Konfiguration › Aktionen",
    close: "Schliessen", edit: "Bearbeiten", preview: "Vorschau", offTag: "Ausgeschaltet" },
  en: { armed: "Message: armed", disarmed: "Message: disarmed", pending: "Message: entry delay", report: "Message: silent alarm", off: "Off", standard: "Standard recipients",
    critical: "critical, 80 %", own: "own text", chapReport: "On a silent alarm", point: "Silent alarm", recipients: "Standard recipients", moved: "Configuration › Actions",
    close: "Close", edit: "Edit", preview: "Preview", offTag: "Switched off" },
};
const WAIT = { type: "wait", seconds: 2 };

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const shot = (name) => s.page.screenshot({ path: `${outDir}notices-${name}-${lang}-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    const s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="actions"]');
    await s.waitFor("return !!r.querySelector('.ag-wf-armed') && !!r.querySelector('.ag-wf-main')");
    await s.page.waitForTimeout(500);
    const saved = () => s.sim("const c=window.__calls.filter((x) => x.type === 'alarmageddon/save_workflows').pop(); return c ? JSON.parse(JSON.stringify(c)) : null");
    const card = (kind) => s.ev(`const c=r.querySelector('[data-notice="${kind}"]'); if (!c) return null; const tg=c.querySelector('.ag-toggle'); const tx=c.querySelector('.ag-wf-text');
      return { zone: [...c.parentElement.classList].find((k) => /^ag-wf-(armed|entry|disarmed|report)$/.test(k)) || '', title: tx.querySelector('b').textContent.trim(), sub: tx.querySelector('small').textContent.trim(),
        on: tg.getAttribute('aria-checked') === 'true', role: tg.getAttribute('role'), left: tg.getBoundingClientRect().right <= tx.getBoundingClientRect().left, off: c.classList.contains('off'),
        afterTitle: c.previousElementSibling?.classList.contains('ag-wf-start') === true, pencil: !!c.querySelector('[data-wf="notice-edit"]'), size: Math.round(tg.getBoundingClientRect().height) }`);
    const cur = await s.ev("return r.host.actions.trigger"); // der Nachbau hat getrennte Aktionen je Modus: alles gilt für den Reiter, der offen ist
    const noOverflow = () => s.ev("return document.documentElement.scrollWidth <= window.innerWidth + 1 && r.querySelector('.ag-view').scrollWidth <= r.querySelector('.ag-view').clientWidth + 1");

    // ----- Die vier festen Meldungen stehen an ihrem Punkt, direkt unter dem Titel des Punkts -----
    const cards = { armed: await card("armed"), report: await card("sensor_report"), pending: await card("pending"), disarmed: await card("disarmed") };
    check(`${tag}: vier feste Meldungen, jede an ihrem Punkt des Ablaufs (scharf geschaltet, stiller Alarm, Eingangsverzögerung, deaktiviert)`, cards.armed?.zone === "ag-wf-armed" && cards.report?.zone === "ag-wf-report"
      && cards.pending?.zone === "ag-wf-entry" && cards.disarmed?.zone === "ag-wf-disarmed" && (await s.ev("return r.querySelectorAll('[data-notice]').length")) === 4, JSON.stringify(cards));
    check(`${tag}: jede steht direkt unter dem Titel ihres Punkts und heisst wie die Meldung`, Object.values(cards).every((c) => c.afterTitle) && cards.armed.title === t.armed && cards.disarmed.title === t.disarmed
      && cards.pending.title === t.pending && cards.report.title === t.report, JSON.stringify(Object.values(cards).map((c) => [c.title, c.afterTitle])));
    check(`${tag}: Schalter links vom Text (Rolle "switch"), Stift rechts`, Object.values(cards).every((c) => c.left && c.role === "switch" && c.pencil), JSON.stringify(cards));
    check(`${tag}: Standard wie bisher im Reiter Benachrichtigungen: nur "Stiller Alarm" ist an (kritisch, an die Standard-Empfänger), die anderen sind aus`, cards.report.on && cards.report.sub === `${t.standard} · ${t.critical}`
      && !cards.armed.on && !cards.pending.on && !cards.disarmed.on && [cards.armed, cards.pending, cards.disarmed].every((c) => c.sub === t.off && c.off), JSON.stringify(Object.values(cards).map((c) => [c.on, c.sub])));
    check(`${tag}: nichts ist geändert (kein Punkt am Reiter, Speichern gesperrt)`, await s.ev("return !r.querySelector('[data-sub=\"actions\"]').classList.contains('has-edit') && r.querySelector('.ag-foot [data-wf=\"save\"]').disabled"));

    // ----- Kapitel "Bei einem stillen Alarm" vor dem Alarm -----
    const order = await s.ev("return [...r.querySelector('.ag-wf').children].map((c) => c.classList.contains('ag-wf-chap') ? 'chap:' + c.querySelector('h3').textContent.trim() : [...c.classList].find((k) => /^ag-wf-(report|main)$/.test(k))).filter(Boolean)");
    const at = (x) => order.indexOf(x);
    check(`${tag}: das Kapitel "${t.chapReport}" steht vor dem Alarm, sein Punkt heisst "${t.point}"`, at(`chap:${t.chapReport}`) >= 0 && at(`chap:${t.chapReport}`) < at("ag-wf-report") && at("ag-wf-report") < at("ag-wf-main")
      && (await s.ev("return r.querySelector('.ag-wf-report .ag-wf-start').textContent.trim()")).startsWith(t.point), JSON.stringify(order));
    check(`${tag}: der Punkt hat ein eigenes, ruhiges Symbol und ein Plus für Aktionen`, await s.ev("const m=r.querySelector('.ag-wf-report .ag-wf-start .ag-mini'); return m.classList.contains('quiet') && !!m.querySelector('svg') && !!r.querySelector('.ag-wf-report .ag-wf-plus .ag-wf-add')"));

    // ----- Schalter auf der Karte: nur ein/aus -----
    await s.tap('[data-notice="armed"] [data-wf="notice-on"]');
    check(`${tag}: Schalter ein: die Karte nennt die Standard-Empfänger, der Reiter hat den Punkt, Speichern ist frei`, await s.waitFor(`const c=r.querySelector('[data-notice="armed"]'); return c.querySelector('.ag-toggle').getAttribute('aria-checked') === 'true'
      && c.querySelector('small').textContent.trim() === ${JSON.stringify(t.standard)} && !c.classList.contains('off') && r.querySelector('[data-sub="actions"]').classList.contains('has-edit') && !r.querySelector('.ag-foot [data-wf="save"]').disabled`));

    // ----- Fenster der Meldung -----
    await s.tap('[data-notice="armed"] [data-wf="notice-edit"]');
    await s.waitFor("return r.getElementById('ag-step').open && !!r.querySelector('#ag-step [data-key=\"ntTitle\"]')");
    const fields = await s.ev(`const d=r.getElementById('ag-step'); return { on: d.querySelector('[data-wf="notice-enabled"]').getAttribute('aria-checked') === 'true', tokens: [...d.querySelectorAll('[data-wf="ins"]')].map((b) => b.dataset.token),
      title: d.querySelector('[data-key="ntTitle"]').value, message: d.querySelector('[data-key="ntMessage"]').value, buttons: d.querySelectorAll('[data-wf="nt-btn"]').length, test: !!d.querySelector('[data-wf="notice-test"]'),
      persist: !!d.querySelector('[data-wf="notice-persist"]'), crit: d.querySelector('[data-wf="nt-crit"]').getAttribute('aria-checked'), click: d.querySelector('[data-wf="nt-click"]').value,
      pills: [...d.querySelectorAll('.ag-rpill')].map((p) => p.textContent.trim()), ownTargets: !!d.querySelector('[data-wf="nt-tgt-own"]'), kinds: d.querySelectorAll('[data-wf="kind"]').length }`);
    check(`${tag}: Fenster: Schalter "Meldung senden" an, Standardtext in Titel und Text, Platzhalter mit {person}, ohne {alarm} und {sensor}`, fields.on && fields.title.includes("{name}") && fields.message.includes("{person}")
      && JSON.stringify(fields.tokens) === JSON.stringify(["{name}", "{mode}", "{person}", "{time}"]), JSON.stringify(fields));
    check(`${tag}: Fenster: Standard-Empfänger vorgewählt, nicht kritisch, "in Home Assistant stehen lassen", Klickziel Übersicht, Testmeldung; keine Knöpfe der Alarmmeldung, keine Wahl der Art`,
      fields.pills.some((p) => p.includes("diego")) && fields.ownTargets && fields.crit === "false" && fields.persist && fields.click === "overview" && fields.test && fields.buttons === 0 && fields.kinds === 0, JSON.stringify(fields));
    await (await s.el('#ag-step [data-key="ntTitle"]')).fill("Zuhause: {mode} von {person}");
    check(`${tag}: Vorschau füllt die Platzhalter mit Beispielwerten (keine geschweifte Klammer bleibt)`, await s.waitFor(`const p=r.getElementById('ag-ntprev').textContent; return p.includes('Zuhause: ') && !/[{}]/.test(p)`), await s.ev("return r.getElementById('ag-ntprev').textContent"));
    await s.tap('#ag-step [data-wf="nt-crit"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-wf=\"nt-vol\"]')");
    await s.tap('#ag-step [data-wf="notice-test"]');
    await s.page.waitForTimeout(300);
    const test = await s.sim("const c=window.__calls.filter((x) => x.type === 'alarmageddon/test_event_notify').pop(); return c ? JSON.parse(JSON.stringify(c)) : null");
    check(`${tag}: Testmeldung mit den ungespeicherten Werten aus dem Fenster (Art, Auslöser, eigener Titel, kritisch)`, test && test.kind === "armed" && test.trigger === cur && cur !== "always" && test.notice.enabled === true
      && test.notice.title === "Zuhause: {mode} von {person}" && test.notice.message === "" && test.notice.critical === true && JSON.stringify(test.notice.targets) === "[]", JSON.stringify(test));
    if (!mobile) await s.page.screenshot({ path: `${outDir}notices-editor-${lang}.png` });
    check(`${tag}: Fenster ohne Überlauf (auch das Auswahlfeld "Klickziel" bleibt in seiner Karte)`, await s.ev("const b=r.querySelector('#ag-step .ag-dlg-body'); const c=r.querySelector('#ag-step [data-wf=\"nt-click\"]'); return b.scrollWidth <= b.clientWidth + 1 && c.getBoundingClientRect().right <= c.parentElement.getBoundingClientRect().right"));
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    const after = await card("armed");
    check(`${tag}: nach "Übernehmen" nennt die Karte "kritisch" und "${t.own}"`, after.on && after.sub.includes(t.critical) && after.sub.includes(t.own), JSON.stringify(after));

    // ----- Fenster: ausschalten blendet die Felder aus -----
    await s.tap('[data-notice="pending"] [data-wf="notice-edit"]');
    await s.waitFor("return r.getElementById('ag-step').open");
    check(`${tag}: ausgeschaltete Meldung: das Fenster zeigt nur den Schalter mit der Erklärung`, await s.ev("const d=r.getElementById('ag-step'); return d.querySelector('[data-wf=\"notice-enabled\"]').getAttribute('aria-checked') === 'false' && !d.querySelector('[data-key=\"ntTitle\"]') && !d.querySelector('[data-wf=\"notice-test\"]')"));
    await s.tap('#ag-step [data-wf="notice-enabled"]');
    check(`${tag}: "Eingangsverzögerung" bietet {sensor} und {delay} an, aber nicht {person}`, await s.waitFor(`const tk=[...r.querySelectorAll('#ag-step [data-wf="ins"]')].map((b) => b.dataset.token); return tk.includes('{sensor}') && tk.includes('{delay}') && !tk.includes('{person}') && !tk.includes('{alarm}')`));
    await s.tap('#ag-step [data-wf="close"]');
    check(`${tag}: Abbrechen mit einer Änderung im Fenster fragt nach (wie bei den Schritten)`, await s.waitFor("return r.getElementById('ag-confirm').open"));
    await s.tap('#ag-confirm [data-c="yes"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    check(`${tag}: verworfen: die Meldung ist weiter aus`, (await card("pending")).on === false);

    // ----- Aktion bei einem stillen Alarm: nur, was dort sinnvoll ist -----
    await s.tap('.ag-wf-report .ag-wf-plus .ag-wf-add');
    await s.waitFor("return r.getElementById('ag-step').open && r.querySelectorAll('#ag-step [data-wf=\"kind\"]').length > 0");
    const kinds = await s.ev("return [...r.querySelectorAll('#ag-step [data-wf=\"kind\"]')].map((b) => b.dataset.kind)");
    check(`${tag}: Auswahl beim stillen Alarm: Ton, Gerät, Warten, Szene, eigene Aktion; keine Sirene, keine Alarmmeldung, kein Quittieren`, ["chime", "device", "wait"].every((k) => kinds.includes(k))
      && ["sound", "notify", "acknowledge", "prealarm", "dechime"].every((k) => !kinds.includes(k)), kinds.join(","));
    await s.tap('#ag-step [data-wf="kind"][data-kind="wait"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-wf=\"apply\"]')");
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    check(`${tag}: die Aktion steht als Karte unter der Meldung "Stiller Alarm"`, await s.waitFor("const z=r.querySelector('.ag-wf-report'); const st=z.querySelector('.ag-wf-step'); return !!st && !!(z.querySelector('[data-notice]').compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING)"));
    check(`${tag}: kein Überlauf (Aktionen)`, await noOverflow());
    await shot("actions");

    // ----- Speichern: nur die geänderte Meldung, dazu die Aktionen des stillen Alarms -----
    await s.tap('.ag-foot [data-wf="save"]');
    await s.waitFor("return !r.querySelector('[data-sub=\"actions\"]').classList.contains('has-edit')", 8000);
    const sent = await saved();
    const mine = sent?.event_notify?.[cur];
    check(`${tag}: gespeichert: nur "Scharf geschaltet" des offenen Reiters geht mit; die drei unberührten Meldungen und die anderen Modi nicht`, mine && JSON.stringify(Object.keys(sent.event_notify)) === JSON.stringify([cur])
      && JSON.stringify(Object.keys(mine)) === '["armed"]' && mine.armed.enabled === true && mine.armed.critical === true && mine.armed.title === "Zuhause: {mode} von {person}" && mine.armed.message === ""
      && JSON.stringify(mine.armed.targets) === "[]", JSON.stringify(sent?.event_notify));
    check(`${tag}: gespeichert: die Aktion des stillen Alarms beim offenen Reiter, die Listen der anderen Auslöser (auch "Immer aktiv") leer`, sent && Object.keys(sent.workflows_report || {}).includes("always")
      && Object.entries(sent.workflows_report).every(([k, l]) => (k === cur ? l.length === 1 && l[0].type === "wait" : l.length === 0)), JSON.stringify(sent?.workflows_report));
    await s.page.waitForTimeout(600);
    check(`${tag}: nach dem Speichern stehen Meldung und Aktion weiter da, nichts ist offen`, (await card("armed")).on && (await card("armed")).sub.includes(t.own) && await s.ev("return r.querySelectorAll('.ag-wf-report .ag-wf-step').length === 1 && r.querySelector('.ag-foot [data-wf=\"save\"]').disabled"));

    // ----- Eine andere Änderung speichern: die Meldungen gehen nicht mit (der Server behält, was er hat) -----
    await s.tap('[data-notice="sensor_report"] [data-wf="notice-on"]');
    await s.tap('[data-notice="sensor_report"] [data-wf="notice-on"]');
    check(`${tag}: aus und wieder ein ist keine Änderung`, await s.waitFor("return !r.querySelector('[data-sub=\"actions\"]').classList.contains('has-edit')"));
    await s.ev(`const a=r.host.actions; a.ensureDraft(); a._setSteps(arg, "report"); a.saveState=null; a.render(); r.host._renderDots(); return 1`, [WAIT, WAIT]);
    await s.waitFor("return !r.querySelector('.ag-foot [data-wf=\"save\"]').disabled");
    await s.tap('.ag-foot [data-wf="save"]');
    await s.waitFor("return !r.querySelector('[data-sub=\"actions\"]').classList.contains('has-edit')", 8000);
    const second = await saved();
    check(`${tag}: ohne geänderte Meldung fehlt "event_notify" beim Speichern ganz`, second && !("event_notify" in second) && second.workflows_report[cur].length === 2, JSON.stringify([second?.event_notify, second?.workflows_report]));
    // Ohne getrennte Aktionen gilt der Ablauf des ersten Auslösers für alle: die Meldungen ebenso, "Immer aktiv" bekommt nur "Stiller Alarm"
    const shared = await s.ev(`const a=r.host.actions; const d=JSON.parse(JSON.stringify(a.draft)); const keys=a.triggers(); d.notices[keys[0]].armed.title='Gemeinsam'; d.notices[keys[0]].sensor_report.enabled=false;
      const e=a._effective({ ...d, perMode: false }); return { keys, titles: keys.filter((k) => k !== 'always').map((k) => e.notices[k].armed.title), always: Object.keys(e.notices.always), off: keys.map((k) => e.notices[k].sensor_report.enabled) }`);
    check(`${tag}: ohne getrennte Aktionen gelten die Meldungen des ersten Auslösers für alle Modi; "Immer aktiv" bekommt nur "Stiller Alarm"`, shared.titles.every((x) => x === "Gemeinsam") && JSON.stringify(shared.always) === '["sensor_report"]'
      && shared.off.every((x) => x === false), JSON.stringify(shared));

    // ----- Je Modus: eigene Werte; "Immer aktiv" kennt nur "Stiller Alarm" -----
    await s.page.waitForTimeout(600);
    const other = cur === "away" ? "home" : "away";
    await s.tap('[data-notice="disarmed"] [data-wf="notice-on"]');
    await s.tap(`[data-trigger="${other}"]`);
    await s.waitFor(`return r.host.actions.trigger === ${JSON.stringify(other)}`);
    check(`${tag}: getrennt je Modus: "Deaktiviert" und "Scharf geschaltet" sind nur für den Modus an, in dem sie eingeschaltet wurden`, (await card("disarmed")).on === false && (await card("armed")).on === false && (await card("armed")).sub === t.off);
    await s.tap('[data-trigger="always"]');
    await s.waitFor("return r.host.actions.trigger === 'always'");
    check(`${tag}: "Immer aktiv": nur die Meldung "Stiller Alarm" (dort wird nie scharf geschaltet)`, await s.ev("return JSON.stringify([...r.querySelectorAll('[data-notice]')].map((c) => c.dataset.notice)) === '[\"sensor_report\"]' && !!r.querySelector('.ag-wf-report') && !!r.querySelector('.ag-wf-main')"));
    await s.tap('[data-notice="sensor_report"] [data-wf="notice-edit"]');
    await s.waitFor("return r.getElementById('ag-step').open");
    await (await s.el('#ag-step [data-wf="nt-tgt-own"]')).click();
    await (await s.el('#ag-step [data-wf="nt-tgt-add"]')).selectOption("notify.mobile_app_tablet");
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    check(`${tag}: eigene Empfänger stehen auf der Karte statt "Standard-Empfänger"`, (await card("sensor_report")).sub.includes("tablet") && !(await card("sensor_report")).sub.startsWith(t.standard), JSON.stringify(await card("sensor_report")));
    await s.tap('.ag-foot [data-wf="save"]');
    await s.waitFor("return !r.querySelector('[data-sub=\"actions\"]').classList.contains('has-edit')", 8000);
    const third = await saved();
    check(`${tag}: gespeichert je Auslöser: "Deaktiviert" nur für den einen Modus, "Stiller Alarm" mit eigenen Empfängern nur für "Immer aktiv"`, third && JSON.stringify(Object.keys(third.event_notify || {}).sort()) === JSON.stringify(["always", cur].sort())
      && JSON.stringify(Object.keys(third.event_notify[cur])) === '["disarmed"]' && third.event_notify[cur].disarmed.enabled === true && JSON.stringify(Object.keys(third.event_notify.always)) === '["sensor_report"]'
      && third.event_notify.always.sensor_report.targets.includes("notify.mobile_app_tablet"), JSON.stringify(third?.event_notify));
    await s.page.waitForTimeout(600);

    // ----- Gruppe: dezentes Zeichen, dass sich ihre Schritte wiederholen -----
    await s.tap(`[data-trigger="${cur}"]`);
    await s.waitFor(`return r.host.actions.trigger === ${JSON.stringify(cur)}`);
    await s.ev(`const a=r.host.actions; a.ensureDraft(); a._setSteps(arg, "main"); a.saveState=null; a.render(); return 1`, [{ type: "group", mode: "count", count: 3, steps: [WAIT, WAIT], wait: false }, { type: "group", mode: "count", count: 2, steps: [], wait: false }]);
    await s.waitFor("return r.querySelectorAll('.ag-wf-main .ag-wf-glist').length === 2");
    const loop = await s.ev(`const g=r.querySelector('.ag-wf-glist[data-zone="main:0"]'); const l=g.querySelector(':scope > .ag-wf-loop'); if (!l) return null; const lb=l.getBoundingClientRect(); const cs=getComputedStyle(l);
      const steps=[...g.querySelectorAll(':scope > .ag-wf-step')].map((x) => x.getBoundingClientRect()); const hit=r.elementFromPoint(lb.left + 2, lb.top + lb.height / 2);
      return { loopClass: g.classList.contains('loop'), hidden: l.getAttribute('aria-hidden'), events: cs.pointerEvents, style: cs.borderLeftStyle, width: Math.round(lb.width), leftOfSteps: steps.every((b) => lb.right <= b.left + 1),
        spans: lb.top <= steps[0].top + steps[0].height / 2 + 1 && lb.bottom >= steps.at(-1).top + steps.at(-1).height / 2 - 1, inside: lb.left >= g.getBoundingClientRect().left && lb.bottom <= g.getBoundingClientRect().bottom,
        arrow: getComputedStyle(l, '::after').content !== 'none', hitIsLoop: hit === l, empty: r.querySelector('.ag-wf-glist[data-zone="main:1"]').classList.contains('loop') || !!r.querySelector('.ag-wf-glist[data-zone="main:1"] > .ag-wf-loop:not([hidden])') && getComputedStyle(r.querySelector('.ag-wf-glist[data-zone="main:1"] > .ag-wf-loop')).display !== 'none' }`);
    check(`${tag}: Gruppe mit Schritten: gestrichelter Bogen mit Pfeil links neben den Schritten, vom ersten bis zum letzten`, loop && loop.loopClass && loop.style === "dashed" && loop.arrow && loop.leftOfSteps && loop.spans && loop.inside && loop.width <= 16, JSON.stringify(loop));
    check(`${tag}: der Bogen ist nur Zierde: für Vorleser verborgen, fängt keine Klicks`, loop && loop.hidden === "true" && loop.events === "none" && !loop.hitIsLoop, JSON.stringify(loop));
    check(`${tag}: eine leere Gruppe zeigt keinen Bogen`, loop && loop.empty === false, JSON.stringify(loop));
    await s.ev("r.querySelector('.ag-wf-glist[data-zone=\"main:0\"]').scrollIntoView({ block: 'center' }); return 1");
    await s.page.waitForTimeout(200);
    await s.page.screenshot({ path: `${outDir}notices-loop-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    check(`${tag}: kein Überlauf (Gruppe)`, await noOverflow());

    // ----- "Aktionen übernehmen von …" nimmt die festen Meldungen und die Aktionen des stillen Alarms mit -----
    await s.tap(`[data-trigger="${other}"]`);
    await s.waitFor(`return r.host.actions.trigger === ${JSON.stringify(other)}`);
    await (await s.el('.ag-foot select[data-wf="copy-from"]')).selectOption(cur);
    if (await s.waitFor("return r.getElementById('ag-confirm').open", 1500)) await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: "Aktionen übernehmen von": Meldungen (ein/aus, eigener Text) und Aktionen des stillen Alarms kommen mit, als Kopie`, await s.waitFor(`const d=r.host.actions.draft; const a=d.notices[${JSON.stringify(other)}], b=d.notices[${JSON.stringify(cur)}];
      return a.armed.enabled && a.armed.title === b.armed.title && a.disarmed.enabled && a !== b && a.armed !== b.armed && d.report[${JSON.stringify(other)}].length === 2 && d.report[${JSON.stringify(other)}] !== d.report[${JSON.stringify(cur)}]`)
      && (await card("armed")).on && (await card("armed")).sub.includes(t.own) && (await card("disarmed")).on, JSON.stringify(await s.ev(`return r.host.actions.draft.notices[${JSON.stringify(other)}]`)));
    // Von einem Modus nach "Immer aktiv": nur "Stiller Alarm" geht mit, nie eine Meldung, die es dort nicht gibt
    await s.tap('[data-trigger="always"]');
    await s.waitFor("return r.host.actions.trigger === 'always'");
    await s.ev(`const d=r.host.actions.draft; d.notices[${JSON.stringify(cur)}].sensor_report = { ...d.notices[${JSON.stringify(cur)}].sensor_report, title: "Still: {sensor}" }; return 1`);
    await (await s.el('.ag-foot select[data-wf="copy-from"]')).selectOption(cur);
    if (await s.waitFor("return r.getElementById('ag-confirm').open", 1500)) await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: nach "Immer aktiv" übernommen: nur "Stiller Alarm", keine Meldung, die es dort nicht gibt`, await s.waitFor(`const a=r.host.actions.draft.notices.always; return JSON.stringify(Object.keys(a)) === '["sensor_report"]' && a.sensor_report.title === 'Still: {sensor}'`),
      JSON.stringify(await s.ev("return r.host.actions.draft.notices.always")));
    await s.tap('.ag-foot [data-wf="cancel"]');

    // ----- Reiter Benachrichtigungen: ohne die vier Meldungen, "Standard-Empfänger", Hinweis auf den neuen Ort -----
    await s.tap('[data-sub="notify"]');
    await s.waitFor("return !!r.querySelector('.ag-nt [data-nt=\"target-add\"]')");
    check(`${tag}: Benachrichtigungen: das Kapitel der Empfänger heisst "${t.recipients}"`, await s.ev(`return [...r.querySelectorAll('.ag-nt h3, .ag-nt .ag-chap-t, .ag-nt .ag-chapter h3')].some((h) => h.textContent.trim() === ${JSON.stringify(t.recipients)})`),
      await s.ev("return [...r.querySelectorAll('.ag-nt h3')].map((h) => h.textContent.trim()).join(' | ')"));
    check(`${tag}: Benachrichtigungen: die vier Meldungen des Ablaufs stehen nicht mehr hier; ein Hinweis nennt "${t.moved}"`, await s.ev(`return ['sensor_report','pending','armed','disarmed'].every((k) => !r.querySelector('.ag-nt [data-kind="' + k + '"]'))
      && r.querySelector('.ag-nt .ag-nt-moved').textContent.includes(${JSON.stringify(t.moved)})`));
    check(`${tag}: Benachrichtigungen: die übrigen Arten bleiben (Ausfall, Scharfschalten nicht möglich, Batterie, nicht erreichbar)`, await s.ev("return ['sensor_offline','arm_failed','battery_low','sensor_unavailable'].every((k) => !!r.querySelector('.ag-nt [data-nt=\"enabled\"][data-kind=\"' + k + '\"]'))"));
    check(`${tag}: kein Überlauf (Benachrichtigungen)`, await noOverflow());
    await shot("notify");

    // ----- Fenster "Routinen": Auge zeigt die Vorschau, nur zum Lesen -----
    await s.tap('[data-sub="system"]');
    await s.tap('[data-sys="rt-open"]');
    await s.waitFor("return r.getElementById('ag-rtlist').open");
    const Q = '#ag-rtlist [data-sys="rt-search"]';
    await (await s.el(Q)).fill("heim");
    await s.waitFor("return r.querySelectorAll('#ag-rtlist .ag-rtrow').length === 1");
    const name = await s.ev("return r.querySelector('#ag-rtlist .ag-rtrow .ag-settx > b').textContent");
    check(`${tag}: jede Zeile hat das Auge vor dem Stift (mindestens 44 px, mit Namen für Vorleser)`, await s.ev("const b=[...r.querySelectorAll('#ag-rtlist .ag-rtrow .ag-wf-btns .ag-iconbtn')]; return b[0].dataset.sys === 'rt-view' && b[1].dataset.sys === 'rt-edit' && !!b[0].getAttribute('aria-label') && Math.round(b[0].getBoundingClientRect().width) >= 44"));
    await s.tap('#ag-rtlist .ag-rtrow [data-sys="rt-view"]');
    await s.waitFor("return !!r.querySelector('#ag-rtlist .ag-rt-view')");
    const view = await s.ev(`const d=r.getElementById('ag-rtlist'); const v=d.querySelector('.ag-rt-view'); const btn=[...d.querySelectorAll('.ag-dlg-btns .ag-btn')]; const box=d.getBoundingClientRect();
      return { open: d.open, title: v.querySelector('h3').textContent.trim(), inputs: v.querySelectorAll('input, select, textarea, .ag-toggle, [data-sys="rt-search"]').length, rows: v.querySelectorAll('.ag-rtrow').length,
        chapter: v.textContent.includes(${JSON.stringify(t.preview)}), flow: v.querySelectorAll('.ag-flow, .ag-rtflow, svg').length, buttons: btn.map((b) => [b.dataset.sys, b.textContent.trim(), b.classList.contains('primary')]),
        full: Math.round(box.width) >= window.innerWidth - 1 && Math.round(box.height) >= window.innerHeight - 1, x: !!d.querySelector(':scope > .ag-dlg-x'), fits: v.scrollWidth <= v.clientWidth + 1 }`);
    check(`${tag}: Vorschau im selben Fenster: Name der Routine als Titel, Kapitel "${t.preview}" mit der Grafik`, view.open && view.title === name && view.chapter && view.flow > 0 && view.rows === 0, JSON.stringify(view));
    check(`${tag}: Vorschau ist nur zum Lesen: keine Felder, keine Schalter`, view.inputs === 0, JSON.stringify(view));
    check(`${tag}: Fusszeile: "${t.close}" und blau "${t.edit}"`, JSON.stringify(view.buttons) === JSON.stringify([["rt-view-close", t.close, false], ["rt-view-edit", t.edit, true]]), JSON.stringify(view.buttons));
    check(`${tag}: ${mobile ? "Handy: ganzer Bildschirm" : "Desktop: im selben Fenster, nicht bildschirmfüllend"}; X oben rechts, kein Überlauf`, view.full === mobile && view.x && view.fits, JSON.stringify(view));
    await s.page.screenshot({ path: `${outDir}notices-rtview-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await s.tap('#ag-rtlist [data-sys="rt-view-close"]');
    check(`${tag}: "${t.close}" führt zur Liste zurück, die Suche steht noch`, await s.waitFor(`return r.getElementById('ag-rtlist').open && !r.querySelector('#ag-rtlist .ag-rt-view') && r.querySelector(${JSON.stringify(Q)}).value === 'heim' && r.querySelectorAll('#ag-rtlist .ag-rtrow').length === 1`));
    await s.tap('#ag-rtlist .ag-rtrow [data-sys="rt-view"]');
    await s.waitFor("return !!r.querySelector('#ag-rtlist .ag-rt-view')");
    await s.tap('#ag-rtlist [data-sys="rt-view-edit"]');
    check(`${tag}: "${t.edit}" öffnet den Editor dieser Routine`, await s.waitFor(`const d=r.getElementById('ag-step'); return d.open && d.querySelector('[data-sys="rt-name"]')?.value === ${JSON.stringify(name)}`),
      await s.ev("return [...r.querySelectorAll('dialog[open]')].map((d) => d.id).join(',')"));
    await s.tap('#ag-step [data-sys="rt-cancel"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    check(`${tag}: nach dem Editor steht wieder die Liste (nicht die Vorschau)`, await s.ev("return r.getElementById('ag-rtlist').open && !r.querySelector('#ag-rtlist .ag-rt-view')"));
    await s.tap('#ag-rtlist .ag-rtrow [data-sys="rt-view"]');
    await s.waitFor("return !!r.querySelector('#ag-rtlist .ag-rt-view')");
    await s.ev("r.querySelector('#ag-rtlist > .ag-dlg-x').click(); return 1");
    check(`${tag}: das X schliesst das ganze Fenster; beim nächsten Öffnen steht die Liste ohne Suche`, await s.waitFor("return !r.getElementById('ag-rtlist').open"));
    await s.tap('[data-sys="rt-open"]');
    check(`${tag}: neu geöffnet: Liste, Suche leer`, await s.waitFor(`return r.getElementById('ag-rtlist').open && !r.querySelector('#ag-rtlist .ag-rt-view') && r.querySelector(${JSON.stringify(Q)}).value === '' && r.querySelectorAll('#ag-rtlist .ag-rtrow').length === 3`));
    // Eine ausgeschaltete Routine sagt das in der Vorschau
    await s.tap('#ag-rtlist .ag-rtrow [data-sys="rt-on"]');
    await s.tap('#ag-rtlist .ag-rtrow [data-sys="rt-view"]');
    check(`${tag}: eine ausgeschaltete Routine trägt in der Vorschau die Marke "${t.offTag}"`, await s.waitFor(`const v=r.querySelector('#ag-rtlist .ag-rt-view'); return !!v && [...v.querySelectorAll('.ag-rttags .ag-tag')].some((x) => x.textContent.trim() === ${JSON.stringify(t.offTag)})`));
    check(`${tag}: keine Fehler in der Konsole`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
