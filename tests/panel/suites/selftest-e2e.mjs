// 1.65.0: Selbsttest (Wunsch des Nutzers 2026-11-18). Statuskachel der Übersicht: eine Zeile mit der letzten Prüfung (immer), Befunde zählen
// mit. Fenster: Befunde je Anlage und für alle Anlagen, je Befund Hilfe (Was ist los, Wo, Was das bedeutet, Ursachen, So behebst du es),
// "Öffnen" springt an die Stelle, "Erledigt" nur bei Befunden der Laufzeit, "Jetzt prüfen". Benachrichtigungen: eigene Meldungsart. Seit der dritten
// Fassung von 1.65.0 stehen Abstand und "Jetzt prüfen" im Kapitel HealthCheck (Konfiguration › Anlage), der Abstand als Entwurf der Seite.
// Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { none: "Selbsttest: noch nicht gelaufen", ok: "Selbsttest: keine Probleme", four: "Selbsttest: 4 Probleme", three: "Selbsttest: 3 Probleme", ago: "geprüft vor",
    secs: ["Was ist los?", "Wo", "Was das bedeutet", "Mögliche Ursachen", "So behebst du es"], all: "Alle Anlagen", done: "Erledigt", run: "Jetzt prüfen", okTitle: "Keine Probleme gefunden",
    kind: "Selbsttest", every: "Selbsttest alle", chapter: "HealthCheck", ping: "Lebenszeichen an hc-ping.com gescheitert", http: "HTTP 404" },
  en: { none: "Self-test: not run yet", ok: "Self-test: no problems", four: "Self-test: 4 problems", three: "Self-test: 3 problems", ago: "checked",
    secs: ["What is wrong?", "Where", "What it means", "Possible causes", "How to fix it"], all: "All alarm systems", done: "Done", run: "Check now", okTitle: "No problems found",
    kind: "Self-test", every: "Self-test every", chapter: "HealthCheck", ping: "Health check to hc-ping.com failed", http: "HTTP 404" },
};

// Jeder Befund, jede Rolle, jede Art von Fundstelle: alle Texte müssen da sein (kein Schlüssel, kein offener Platzhalter)
const ALL = [
  ...["sensor", "output", "player", "trigger", "watch"].flatMap((role) => ["deleted", "disabled", "no_state"].map((reason) => ({ code: "entity_missing", role, reason, entity_id: "switch.x", subject: `switch.${role}${reason}` }))),
  ...["sensor", "output", "player", "trigger", "watch"].map((role) => ({ code: "entity_unavailable", role, entity_id: "switch.y", since: new Date().toISOString(), subject: `y${role}` })),
  { code: "service_missing", service: "script.weg", subject: "script.weg" }, { code: "recipient_missing", service: "notify.weg", subject: "notify.weg" }, { code: "no_recipients", subject: "" },
  { code: "sound_missing", sound: "custom_0123456789ab", subject: "custom_0123456789ab" }, { code: "no_url", subject: "" }, { code: "rule_damaged", name: "Kaputt", subject: "routine:r1" },
  { code: "system_not_loaded", name: "Garage", subject: "e_x", entry_id: null },
  ...["error", "timeout"].map((reason) => ({ code: "step_failed", kind: "runtime", reason, service: "switch.turn_on", targets: ["switch.a"], subject: `s|${reason}` })),
  { code: "step_hung", kind: "runtime", label: "prepare", subject: "prepare" }, { code: "notify_failed", kind: "runtime", service: "notify.x", reason: "error", subject: "notify.x", entry_id: null },
  ...["stats", "reception", "events", "recordings", "workflow", "monitor", "maintenance", "auto_backup"].map((part) => ({ code: "start_failed", kind: "runtime", part, subject: part })),
  { code: "backup_failed", kind: "runtime", subject: "auto", entry_id: null },
  // HealthCheck (1.65.0): Lebenszeichen gescheitert, je Grund; Teil "healthcheck" startete nicht
  ...["http", "timeout", "error"].map((reason) => ({ code: "ping_failed", kind: "runtime", reason, service: "hc-ping.com", label: reason === "http" ? "404" : "", subject: `hc${reason}`, entry_id: null })),
  { code: "start_failed", kind: "runtime", part: "healthcheck", subject: "healthcheck" },
].map((p, i) => ({ kind: "config", entry_id: "e_haus", first: new Date(Date.now() - 3600e3).toISOString(), last: new Date().toISOString(), count: 2, ...p, key: `k${i}`,
  places: [
    { area: "workflow", list: ["alarm", "after", "armed", "arming", "entry", "disarmed", "report"][i % 7], trigger: ["home", "away", "night", "always"][i % 4], step: 2, ...(i % 2 ? { sub: 1 } : {}) },
    { area: "end", trigger: "away" }, { area: "event", trigger: "home", kind: "armed" }, { area: "monitor", id: "m1", name: "Kühlschrank", flow: i % 2 ? "out" : "ok", step: 1, test: i % 3 === 0 },
    { area: "routine", id: "r1", name: "Abends" }, { area: "sensors", monitor: i % 2 === 0 }, { area: "notify", group: i % 2 ? "alarm" : "maintenance" }, { area: "notify", type: "battery_low", mode: "home" },
    { area: "run", list: "alarm", trigger: "away", test: true }, { area: "healthcheck", id: "a1b2c3d4e5f6" },
  ] }));

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    // Noch nie geprüft
    let s = await open(browser, { mobile, lang, query: "&selftest=none" });
    check(`${tag}: Statuskachel zeigt "${t.none}"`, await s.waitFor(`return r.querySelector('.ag-status [data-st="open"]')?.innerText.includes(${JSON.stringify(t.none)})`));
    await s.ctx.close();

    // Ohne Befunde: die Zeile steht da (mit der Zeit), zählt aber nicht
    s = await open(browser, { mobile, lang });
    const tile = () => s.ev("const b=r.querySelector('.ag-status'); return { text: b.innerText, h2: b.querySelector('h2').textContent, row: b.querySelector('[data-st=\"open\"]')?.innerText || '', tone: b.querySelector('[data-st=\"open\"] .ag-mini')?.className || '' }");
    let x = await tile();
    check(`${tag}: ohne Befunde: Zeile "${t.ok}" mit "${t.ago} ..." in der Kachel, grün`, x.row.includes(t.ok) && x.row.includes(t.ago) && /\bok\b/.test(x.tone), JSON.stringify(x));
    const before = x.h2;
    await s.tap('[data-st="open"]');
    check(`${tag}: Fenster: "${t.okTitle}", Kopf mit letzter und nächster Prüfung und dem Abstand`, await s.waitFor(`return r.getElementById('ag-selftest').open && r.querySelector('.ag-st-ok')?.innerText.includes(${JSON.stringify(t.okTitle)}) && /6/.test(r.querySelector('.ag-st-meta').textContent)`));
    // "Jetzt prüfen": der Server prüft, danach Befunde
    await s.sim(`window.__selftestAfterRun = [{ key: "e_haus|entity_missing|siren.flur", kind: "config", code: "entity_missing", entry_id: "e_haus", subject: "siren.flur", entity_id: "siren.flur", role: "output", reason: "deleted", places: [{ area: "workflow", list: "alarm", trigger: "away", step: 4 }] }]; return 1`);
    await s.tap('#ag-selftest [data-st="run"]');
    check(`${tag}: "${t.run}" ruft den Server und zeigt den Befund`, await s.waitFor("return r.querySelectorAll('#ag-selftest .ag-st-item').length === 1") && (await s.sim("return window.__selftestRuns")) === 1);
    x = await tile();
    check(`${tag}: der Befund zählt jetzt in der Kachel mit ("N brauchen Aufmerksamkeit" um eins höher)`, Number((x.h2.match(/\d+/) || [0])[0]) === Number((before.match(/\d+/) || [0])[0]) + 1, `${before} -> ${x.h2}`);
    await s.tap('#ag-selftest [data-st="close"]');
    await s.ctx.close();

    // Mit Befunden (Konfiguration, Laufzeit, für alle Anlagen)
    s = await open(browser, { mobile, lang, query: "&selftest=problems" });
    x = await tile();
    check(`${tag}: Zeile "${t.four}", rot (ein Befund betrifft den Alarm)`, x.row.includes(t.four) && /\berr\b/.test(x.tone), JSON.stringify(x));
    await s.tap('[data-st="open"]');
    await s.waitFor("return r.getElementById('ag-selftest').open");
    const pop = () => s.ev("const d=r.getElementById('ag-selftest'); return { items: d.querySelectorAll('.ag-st-item').length, open: d.querySelectorAll('.ag-st-item.open').length, groups: [...d.querySelectorAll('.ag-st-group')].map((g) => g.textContent.trim()), dismiss: [...d.querySelectorAll('[data-st=\"dismiss\"]')].map((b) => b.dataset.key) }");
    let p = await pop();
    check(`${tag}: vier Befunde, der erste aufgeklappt, Gruppen "Haus" und "${t.all}"`, p.items === 4 && p.open === 1 && JSON.stringify(p.groups) === JSON.stringify(["Haus", t.all]), JSON.stringify(p));
    const secs = await s.ev("return [...r.querySelectorAll('#ag-selftest .ag-st-item.open .ag-st-sect')].map((e) => e.textContent.trim())");
    check(`${tag}: Hilfe mit allen Abschnitten (${t.secs.join(", ")})`, JSON.stringify(secs) === JSON.stringify(t.secs), JSON.stringify(secs));
    check(`${tag}: Befund der Konfiguration ohne "${t.done}"`, (await s.ev("return !r.querySelector('#ag-selftest .ag-st-item.open [data-st=\"dismiss\"]')")));
    // Aufklappen per Klick
    await s.tap('#ag-selftest [data-st-key*="step_failed"] [data-st="toggle"]');
    p = await pop();
    check(`${tag}: Klick klappt den Befund der Laufzeit auf; nur er hat "${t.done}"`, p.open === 2 && p.dismiss.length === 1 && p.dismiss[0].includes("step_failed"), JSON.stringify(p));
    const runtime = await s.ev("return r.querySelector('#ag-selftest [data-st-key*=\"step_failed\"]').innerText");
    check(`${tag}: Laufzeit: erstmals, Anzahl, Geräte, Fundstelle "Test"`, /3/.test(runtime) && /Rollladen Küche/.test(runtime) && /Test|test/.test(runtime), runtime.slice(0, 300));
    await s.tap('#ag-selftest [data-st="dismiss"]');
    check(`${tag}: "${t.done}": der Server entfernt ihn, Fenster und Kachel zeigen 3`, await s.waitFor(`return r.querySelectorAll('#ag-selftest .ag-st-item').length === 3 && r.querySelector('.ag-status [data-st="open"]').innerText.includes(${JSON.stringify(t.three)})`)
      && (await s.sim("return window.__selftest.problems.length")) === 3);
    // Öffnen: springt an die Stelle (Aktionen der Anlage, Auslöser Abwesend)
    await s.tap('#ag-selftest [data-st-key*="entity_missing"] [data-st="go"]');
    check(`${tag}: "Öffnen" schliesst das Fenster und zeigt Konfiguration › Aktionen › Abwesend`, await s.waitFor("return !r.getElementById('ag-selftest').open && r.host._tab === 'config' && r.host._sub === 'actions' && r.host.actions.trigger === 'away' && !!r.querySelector('.ag-cfg')"));
    // Empfänger für alle Anlagen: zu den Benachrichtigungen
    await s.ev("r.host._tab = 'overview'; r.host._render(); return 1");
    await s.waitFor("return !!r.querySelector('.ag-status [data-st=\"open\"]')");
    await s.tap('.ag-status [data-st="open"]');
    await s.waitFor("return r.getElementById('ag-selftest').open");
    await s.tap('#ag-selftest [data-st-key*="recipient_missing"] [data-st="toggle"]');
    await s.tap('#ag-selftest [data-st-key*="recipient_missing"] [data-st="go"]');
    check(`${tag}: Empfänger: "Öffnen" zeigt Konfiguration › Benachrichtigungen`, await s.waitFor("return !r.getElementById('ag-selftest').open && r.host._sub === 'notify' && !!r.querySelector('.ag-nt [data-kind=\"selftest\"]')"));
    if (mobile) {
      await s.ev("r.host._tab = 'overview'; r.host._render(); return 1");
      await s.waitFor("return !!r.querySelector('.ag-status [data-st=\"open\"]')");
      await s.tap('.ag-status [data-st="open"]');
      await s.waitFor("return r.getElementById('ag-selftest').open");
      check(`${tag}: Handy: Fenster füllt den Bildschirm, Knöpfe unten fest`, await s.ev("const d=r.getElementById('ag-selftest'); const b=d.querySelector(':scope > .ag-dlg-btns'); return d.getBoundingClientRect().width >= 385 && !!b && b.getBoundingClientRect().bottom >= innerHeight - 2"));
      await s.tap('#ag-selftest [data-st="close"]');
    }

    // Alle Texte: jeder Befund, jede Rolle, jede Fundstelle
    await s.sim(`window.__selftest = { ...window.__selftest, problems: ${JSON.stringify(ALL)} }; return 1`);
    await s.ev("return r.host._fetch().then(() => 1)");
    await s.ev("r.host._tab = 'overview'; r.host._render(); return 1");
    await s.waitFor("return !!r.querySelector('.ag-status [data-st=\"open\"]')");
    await s.tap('.ag-status [data-st="open"]');
    await s.ev("r.host.selftest.opened = new Set(r.host.selftest.problems().map((p) => p.key)); r.host.selftest.render(); return 1");
    const text = await s.ev("return r.getElementById('ag-selftest').innerText");
    const raw = text.match(/\b(st[A-Z][A-Za-z]*_[a-z_]+|stP_[a-z]+|ntT_[a-z_]+|undefined|NaN)\b|\{[a-z]+\}/g);
    check(`${tag}: alle ${ALL.length} Befunde mit Text, ohne Schlüssel oder offene Platzhalter`, !raw && (await s.ev("return r.querySelectorAll('#ag-selftest .ag-st-item.open').length")) === ALL.length, JSON.stringify(raw?.slice(0, 5)));
    await s.tap('#ag-selftest [data-st="close"]');

    // Lebenszeichen gescheitert (HealthCheck): Grund, Host (nie die Adresse), "Öffnen" führt zur Liste der Dienste
    const pingProblem = { key: "*|ping_failed|a1b2c3d4e5f6", kind: "runtime", code: "ping_failed", entry_id: null, subject: "a1b2c3d4e5f6", service: "hc-ping.com", reason: "http", label: "404",
      first: new Date(Date.now() - 600e3).toISOString(), last: new Date().toISOString(), count: 2, places: [{ area: "healthcheck", id: "a1b2c3d4e5f6" }] };
    await s.sim(`window.__selftest = { ...window.__selftest, problems: [${JSON.stringify(pingProblem)}] }; window.__healthchecks = [{ id: "a1b2c3d4e5f6", url: "https://hc-ping.com/5b2f3c1e-8d4a-4f6b-9c7e-2a1d0e9f8b3c", fail_suffix: "/fail", interval: 300, status: { at: new Date().toISOString(), sent: "ok", result: "http", code: 404, test: false } }]; return 1`);
    await s.ev("return r.host._fetch().then(() => 1)");
    await s.ev("r.host._tab = 'overview'; r.host._render(); return 1");
    await s.waitFor("return !!r.querySelector('.ag-status [data-st=\"open\"]')");
    await s.tap('.ag-status [data-st="open"]');
    await s.waitFor("return r.getElementById('ag-selftest').open && !!r.querySelector('#ag-selftest .ag-st-item.open')");
    const ping = await s.ev("return r.querySelector('#ag-selftest .ag-st-item.open').innerText");
    check(`${tag}: Lebenszeichen: "${t.ping}", Grund "${t.http}", nur der Host (nie die Adresse)`, ping.includes(t.ping) && ping.includes(t.http) && !ping.includes("5b2f3c1e"), ping.slice(0, 300));
    await s.tap('#ag-selftest [data-st="go"]');
    check(`${tag}: Lebenszeichen: "Öffnen" zeigt Konfiguration › Anlage mit der Liste der Dienste`, await s.waitFor("return !r.getElementById('ag-selftest').open && r.host._tab === 'config' && r.host._sub === 'system' && r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1"));
    await s.tap('#ag-hclist [data-hc="close"]');

    // Benachrichtigungen: eigene Meldungsart (der Abstand steht nicht mehr hier)
    await s.ev("r.host.openPlace('notify'); return 1");
    await s.waitFor("return !!r.querySelector('.ag-nt [data-kind=\"selftest\"]')");
    check(`${tag}: Meldungsart "${t.kind}" unter den Wartungsmeldungen (an, wie die anderen)`, await s.ev(`return [...r.querySelectorAll('.ag-mt')].some((m) => m.querySelector('.ag-settx b')?.textContent === ${JSON.stringify(t.kind)} && m.querySelector('[data-nt="enabled"][data-kind="selftest"]')?.getAttribute('aria-checked') === 'true')`));
    check(`${tag}: Benachrichtigungen ohne Abstand und ohne "${t.run}" (beides im Kapitel ${t.chapter})`, await s.ev("return !r.querySelector('.ag-nt [data-key=\"selftest_hours\"]') && !r.querySelector('.ag-nt [data-st=\"run\"]')"));
    // Ein Entwurf der Benachrichtigungen sendet den Abstand nie mit (sonst überschriebe er einen neueren Wert)
    await s.tap('[data-nt="enabled"][data-kind="selftest"]');
    await s.sim("window.__notify.selftest_hours = 9; return 1");
    await s.tap('[data-nt="save"]');
    check(`${tag}: Speichern der Benachrichtigungen lässt den Abstand unberührt`, await s.waitFor("return /Gespeichert|Saved/.test(r.querySelector('.ag-foot').innerText)", 8000)
      && (await s.sim("const c = window.__calls.filter((m) => m.type === 'alarmageddon/save_notify').pop(); return window.__notify.selftest_hours === 9 && c && !('selftest_hours' in c.notify)")));
    await s.sim("window.__notify.selftest_hours = 6; window.__notify.types.selftest.enabled = true; return 1");
    await s.ev("return r.host._fetch().then(() => 1)");

    // Kapitel HealthCheck (Konfiguration › Anlage): Selbsttest mit "Jetzt prüfen", Abstand als Entwurf der Seite
    await s.ev("r.host._tab = 'config'; r.host._sub = 'system'; r.host._render(); return 1");
    await s.waitFor("return !!r.querySelector('.ag-health')");
    const chap = await s.ev("const c=r.querySelector('.ag-health').closest('.ag-chap'); return { title: c.querySelector('.ag-chap-t').textContent, text: c.innerText }");
    check(`${tag}: Kapitel "${t.chapter}" mit "${t.every}" und "${t.run}"`, chap.title === t.chapter && chap.text.includes(t.every) && chap.text.includes(t.run), JSON.stringify(chap).slice(0, 200));
    const hours = await s.el('[data-sys="st-hours"]');
    check(`${tag}: Abstand 6, 1 bis 24`, await s.ev("const i=r.querySelector('[data-sys=\"st-hours\"]'); return i.value === '6' && i.min === '1' && i.max === '24'"));
    await hours.fill("25");
    check(`${tag}: 25 ist ungültig: rot, "Speichern" gesperrt, Hinweis in der Fusszeile`, await s.waitFor("return r.querySelector('[data-sys=\"st-hours\"]').closest('.ag-num').classList.contains('bad') && r.querySelector('[data-sys=\"save\"]').disabled && !!r.querySelector('.ag-foot .ag-err')"));
    await (await s.el('[data-sys="st-hours"]')).fill("12");
    check(`${tag}: 12: eine Änderung, "Speichern" frei`, await s.waitFor("return !r.querySelector('[data-sys=\"save\"]').disabled && /1/.test(r.querySelector('.ag-foot').innerText)"));
    await s.tap('[data-sys="save"]');
    check(`${tag}: 12 gespeichert (nur dieser Wert der Benachrichtigungen)`, await s.waitFor("return /Gespeichert|Saved/.test(r.querySelector('.ag-foot').innerText)", 8000)
      && (await s.sim("const c = window.__calls.filter((m) => m.type === 'alarmageddon/save_notify').pop(); return window.__notify.selftest_hours === 12 && JSON.stringify(Object.keys(c.notify)) === '[\"selftest_hours\"]'")));
    const runs = await s.sim("return window.__selftestRuns || 0");
    await s.tap('.ag-health [data-st="run"]');
    const ran = await s.page.waitForFunction((n) => (window.__selftestRuns || 0) === n + 1, runs, { timeout: 5000 }).then(() => true, () => false);
    check(`${tag}: "${t.run}" im Kapitel ${t.chapter} prüft sofort`, ran);
    await s.tap('.ag-health [data-st="open"]');
    check(`${tag}: "Probleme anzeigen" öffnet das Fenster des Selbsttests`, await s.waitFor("return r.getElementById('ag-selftest').open"));
    await s.tap('#ag-selftest [data-st="close"]');
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
