// 1.77.0: Aktion "HealthCheck melden" (Wunsch des Nutzers 2026-11-22; ersetzt den Alarm-Zusatz im Dienst). Der Schritt steht in den Aktionen, nur sichtbar mit
// eingerichteten Diensten; Dienst aus einer Auswahl, der Zusatz ist das einzige Bearbeitbare (bei erkannten Diensten mit Vorschlag und "Vorschlag
// übernehmen"), die ganze Adresse steht nur zur Ansicht; der Play-Knopf der Karte testet ihn wie jeden Schritt; ein Link führt zu den Diensten.
// Im Dienst selbst gibt es keinen Alarm-Zusatz und keinen Alarm-Testknopf mehr. Je Sprache, Desktop und Handy, echte Klicks/Taps, erfundene Adressen.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { title: "HealthCheck melden", take: "Vorschlag übernehmen", gone: "Dienst fehlt", open: "HealthCheck-Dienste öffnen", sugHc: "Vorschlag für Healthchecks.io: /2" },
  en: { title: "Report to HealthCheck", take: "Use suggestion", gone: "Service missing", open: "Open HealthCheck services", sugHc: "Suggestion for Healthchecks.io: /2" },
};
const HC = "a1b2c3d4e5f6"; // Healthchecks.io (erfunden, ?hc=sample)
const CRON = "b2c3d4e5f6a1";
const CRON_ALARM = "?state=fail&message=Alarm+triggered";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];

    // ----- Ohne Dienste: die Aktion wird nicht angeboten -----
    const none = await open(browser, { mobile, lang, tab: "config" });
    await none.tap('[data-sub="actions"]');
    await none.waitFor("return !!r.querySelector('.ag-wf-main')");
    await none.tap(".ag-wf-main > .ag-wf-plus .ag-wf-add");
    await none.waitFor("return r.getElementById('ag-step').open");
    check(`${tag}: ohne eingerichtete Dienste fehlt "${t.title}" in der Auswahl`, await none.ev("const k=[...r.querySelectorAll('#ag-step [data-wf=\"kind\"]')].map((b) => b.dataset.kind); return k.length > 3 && !k.includes('healthcheck')"));
    await none.ctx.close();

    // ----- Mit Diensten -----
    const s = await open(browser, { mobile, lang, tab: "config", query: "&hc=sample" });
    await s.tap('[data-sub="actions"]');
    await s.waitFor("return !!r.querySelector('.ag-wf-main')");
    const draft = () => s.ev("return JSON.parse(JSON.stringify(r.host.actions.steps('main')))");
    const before = (await draft()).length;
    await s.tap(".ag-wf-main > .ag-wf-plus .ag-wf-add");
    await s.waitFor("return r.getElementById('ag-step').open");
    check(`${tag}: mit Diensten bietet die Auswahl "${t.title}" an`, await s.ev(`return [...r.querySelectorAll('#ag-step [data-wf="kind"][data-kind="healthcheck"] b')].some((b) => b.textContent === ${JSON.stringify(t.title)})`));
    await s.tap('#ag-step [data-wf="kind"][data-kind="healthcheck"]');
    await s.waitFor("return !!r.querySelector('#ag-step [data-wf=\"hc-suffix\"]')");
    const form = () => s.ev("const d=r.getElementById('ag-step'); const q=(x) => d.querySelector(x); return { options: [...d.querySelectorAll('[data-wf=\"hc-id\"] option')].map((o) => [o.value, o.textContent, o.selected]), suffix: q('[data-wf=\"hc-suffix\"]').value, offer: q('[data-hcp=\"offer\"]').innerText.trim(), preview: q('[data-hcp=\"preview\"]').value, ro: q('[data-hcp=\"preview\"]').readOnly, err: q('.ag-dlg-err').textContent.trim(), chaps: [...d.querySelectorAll('.ag-sec-t')].map((h) => h.textContent) }");
    let f = await form();
    check(`${tag}: Auswahl nennt nur die eingerichteten Dienste (3), der erste ist gewählt`, f.options.length === 3 && f.options[0][0] === HC && f.options[0][2] && f.options.map((o) => o[0]).includes(CRON), JSON.stringify(f.options));
    check(`${tag}: erkannter Dienst (Healthchecks.io): Zusatz "/2" von selbst eingesetzt, Vorschau mit der ganzen Adresse nur zur Ansicht, kein Vorschlag daneben`,
      f.suffix === "/2" && f.preview.startsWith("https://hc-ping.com/") && f.preview.endsWith("/2") && f.ro && !f.offer, JSON.stringify(f));
    check(`${tag}: drei Kapitel (Dienst, Zusatz, Aufruf) und der Link "${t.open}"`, f.chaps.length === 3 && await s.ev(`return [...r.querySelectorAll('#ag-step [data-wf="hc-open"]')].some((b) => b.textContent.trim() === ${JSON.stringify(t.open)})`), JSON.stringify(f.chaps));
    // Anderer Dienst: der Vorschlag folgt, solange niemand den Zusatz berührt hat
    await s.ev(`const sel=r.querySelector('#ag-step [data-wf="hc-id"]'); sel.value=${JSON.stringify(CRON)}; sel.dispatchEvent(new Event('input',{bubbles:true}));`);
    f = await form();
    check(`${tag}: Cronitor gewählt: der Zusatz folgt ("${CRON_ALARM}"), die Vorschau mit der Adresse des Dienstes`, f.suffix === CRON_ALARM && f.preview.startsWith("https://cronitor.link/") && f.preview.includes("message=Alarm+triggered"), JSON.stringify(f));
    // Eigener Zusatz: das letzte Wort hat der Nutzer; der Vorschlag steht daneben
    await (await s.el('#ag-step [data-wf="hc-suffix"]')).fill("?state=fail&message=Einbruch");
    f = await form();
    check(`${tag}: eigener Zusatz: Vorschau folgt beim Tippen, der Vorschlag steht mit "${t.take}" daneben, das Feld behält den Fokus`, f.preview.includes("message=Einbruch") && f.offer.includes(t.take) && await s.ev("return r.activeElement?.dataset.wf === 'hc-suffix'"), JSON.stringify(f));
    await s.ev(`const sel=r.querySelector('#ag-step [data-wf="hc-id"]'); sel.value=${JSON.stringify(HC)}; sel.dispatchEvent(new Event('input',{bubbles:true}));`);
    f = await form();
    check(`${tag}: ein anderer Dienst ändert den berührten Zusatz nicht (der Nutzer hat das letzte Wort)`, f.suffix === "?state=fail&message=Einbruch" && f.offer.includes(t.sugHc), JSON.stringify(f));
    await s.tap('#ag-step [data-wf="hc-take"]');
    f = await form();
    check(`${tag}: "${t.take}" setzt den Vorschlag ein, danach steht kein Vorschlag mehr daneben`, f.suffix === "/2" && !f.offer, JSON.stringify(f));
    // Ungültig: Fehler, nichts gespeichert
    await (await s.el('#ag-step [data-wf="hc-suffix"]')).fill("ohne-anfang");
    await s.tap('#ag-step [data-wf="apply"]');
    f = await form();
    check(`${tag}: ein Zusatz ohne /, ? oder & am Anfang meldet einen Fehler, das Fenster bleibt`, f.err.length > 10 && (await s.ev("return r.getElementById('ag-step').open")) && (await draft()).length === before, JSON.stringify(f));
    // Gültig: Cronitor mit dem Vorschlag
    await s.ev(`const sel=r.querySelector('#ag-step [data-wf="hc-id"]'); sel.value=${JSON.stringify(CRON)}; sel.dispatchEvent(new Event('input',{bubbles:true}));`);
    await s.tap('#ag-step [data-wf="hc-take"]');
    await s.tap('#ag-step [data-wf="apply"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    const steps = await draft();
    const made = steps[0] && steps.find((x) => x.type === "healthcheck");
    check(`${tag}: der Schritt steht im Entwurf: nur Kennung des Dienstes und Zusatz, nie die Adresse`, steps.length === before + 1 && made && made.check_id === CRON && made.suffix === CRON_ALARM && Object.keys(made).sort().join() === "check_id,suffix,type", JSON.stringify(made));
    const card = await s.ev("const c=[...r.querySelectorAll('.ag-wf-main > .ag-wf-step')].find((x) => x.querySelector('.k-healthcheck')); return c ? { title: c.querySelector('b').textContent, sum: c.querySelector('.ag-wf-text .ag-small').textContent, play: !!c.querySelector('[data-wf=\"test-step\"]'), pill: !!c.querySelector('.ag-waitpill') } : null");
    check(`${tag}: Karte: "${t.title}", Dienst und Zusatz in der Zeile, Play-Knopf wie bei jedem Schritt, keine Pille "Wartet"`, card && card.title === t.title && card.sum.includes("Cronitor") && card.sum.includes(CRON_ALARM) && card.play && !card.pill, JSON.stringify(card));
    // Play: Rückfrage, dann geht genau dieser Schritt an den Server (wie jeder Schritt)
    await s.tap('.ag-wf-main > .ag-wf-step:has(.k-healthcheck) [data-wf="test-step"]');
    await s.waitFor("return r.getElementById('ag-confirm').open");
    await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: der Play-Knopf schickt genau diesen Schritt zum Test`, await s.waitFor("return !!r.querySelector('.ag-wf-step [data-wf=\"test-step-stop\"]')") && await s.sim("const c=window.__calls.filter((x) => x.type === 'alarmageddon/test_workflow').at(-1); return c?.step?.type === 'healthcheck' && c.step.check_id === 'b2c3d4e5f6a1'"));
    await s.sim("window.__calls.length = 0; return 1");
    // Bearbeiten: die Werte stehen wieder im Fenster
    const idx = steps.findIndex((x) => x.type === "healthcheck");
    await s.tap(`.ag-wf-main > .ag-wf-step[data-index="${idx}"] [data-wf="edit"]`);
    await s.waitFor("return r.getElementById('ag-step').open");
    f = await form();
    check(`${tag}: Bearbeiten: Dienst und Zusatz sind wieder da`, f.options.find((o) => o[2])?.[0] === CRON && f.suffix === CRON_ALARM, JSON.stringify(f));
    // Link zu den Diensten: das Fenster der Dienste öffnet sich über dem Fenster des Schritts
    await s.tap('#ag-step [data-wf="hc-open"]');
    check(`${tag}: "${t.open}" öffnet die Dienste über dem Fenster des Schritts`, await s.waitFor("return r.getElementById('ag-hclist').open && r.getElementById('ag-step').open"));
    await s.tap('#ag-hclist [data-hc="close"], #ag-hclist .ag-dlg-x');
    await s.waitFor("return !r.getElementById('ag-hclist').open");
    check(`${tag}: danach ist das Fenster des Schritts noch offen, mit den Werten`, await s.ev("return r.getElementById('ag-step').open && r.querySelector('#ag-step [data-wf=\"hc-suffix\"]').value === '?state=fail&message=Alarm+triggered'"));
    // Dienst gelöscht: die Karte und das Fenster sagen es
    await s.sim("window.__healthchecks.splice(window.__healthchecks.findIndex((i) => i.id === 'b2c3d4e5f6a1'), 1); return 1");
    await s.ev("r.host._data.healthchecks = r.host._data.healthchecks.filter((i) => i.id !== 'b2c3d4e5f6a1'); r.host.actions.renderEditor(); return 1");
    f = await form();
    check(`${tag}: ist der Dienst weg, steht "${t.gone}" in der Auswahl und der Hinweis darunter`, f.options.some((o) => o[2] && o[1] === t.gone) && (await s.ev("return !!r.querySelector('#ag-step .ag-err')")), JSON.stringify(f.options));
    await s.tap('#ag-step [data-wf="apply"]');
    check(`${tag}: ohne Dienst lässt sich der Schritt nicht übernehmen`, (await s.ev("return r.getElementById('ag-step').open")) && (await s.ev("return r.querySelector('#ag-step .ag-dlg-err').textContent.trim().length > 5")));
    await s.tap('#ag-step [data-wf="close"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    await s.ev("r.host.actions.render(); return 1");
    const gone = await s.ev("const c=[...r.querySelectorAll('.ag-wf-main > .ag-wf-step')].find((x) => x.querySelector('.k-healthcheck')); return c?.querySelector('.ag-wf-text .ag-small').textContent");
    check(`${tag}: die Karte nennt den fehlenden Dienst ("${t.gone}")`, typeof gone === "string" && gone.includes(t.gone), String(gone));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
