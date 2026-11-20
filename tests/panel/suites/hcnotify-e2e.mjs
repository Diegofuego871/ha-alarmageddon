// 1.68.0: Meldungen der HealthCheck-Dienste (Wunsch des Nutzers 2026-11-19, 18:42 und 18:43). Seit 1.69.0 (Wunsch des Nutzers 22:16/22:17) eine
// Wartungsmeldung wie "Selbsttest", im Kapitel "Wartungsmeldungen" als letzte: Schalter, Empfänger (Standard: die der Wartung), Kritisch mit
// Lautstärke, "stehen lassen", dazu "Meldung nach … Fehlversuchen" (1 bis 10, Standard 2; Entscheid 23:01 "Fehlversuche") und "Melden, wenn er
// wieder antwortet"; fester Text, kein eigenes Kapitel. Seit dem neuen Design (Entscheid 23:01, Variante C) eine Karte mit Play und Stift, die
// Einstellungen im Fenster #ag-ntkind; gespeichert wird mit "Speichern" auf der Seite. Testmeldung wie jede Wartungsmeldung. Tipp auf eine Meldung:
// ?view=healthcheck öffnet die Liste der Dienste. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { maint: "Wartungsmeldungen", oldChap: "HealthCheck-Dienste", name: "HealthCheck-Dienst antwortet nicht", fails: "Meldung nach", unit: "Fehlversuchen", sum: "nach 2 Fehlversuchen", sum4: "nach 4 Fehlversuchen",
    up: "Melden, wenn er wieder antwortet", upSum: "auch \"antwortet wieder\"", critical: "Kritisch", stOld: "Lebenszeichen, die nicht hinausgingen", list: "HealthCheck-Dienste", range: "Meldung nach: 1 bis 10 Fehlversuchen." },
  en: { maint: "Maintenance messages", oldChap: "HealthCheck services", name: "HealthCheck service not answering", fails: "Message after", unit: "failed attempts", sum: "after 2 failed attempts", sum4: "after 4 failed attempts",
    up: "Message when it answers again", upSum: "also \"answers again\"", critical: "Critical", stOld: "life signs that did not go out", list: "HealthCheck services", range: "Message after: 1 to 10 failed attempts." },
};
const CARD = '.ag-ntk[data-ntk="healthcheck"]';
const DLG = "#ag-ntkind";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "notify" } });
    await s.waitFor(`return !!r.querySelector('${CARD}')`);
    await s.sim("window.__notify.maintenance_targets = ['notify.mobile_app_diego']; return 1");
    await s.ev("r.host._fetch(); return 1");
    await s.waitFor("return r.host._data?.notify?.maintenance_targets?.length === 1");
    await s.ev("r.host.notify.reset(); r.host.notify.render(); return 1");

    // ----- Platz: im Kapitel "Wartungsmeldungen", nach "Selbsttest"; kein eigenes Kapitel mehr -----
    const place = await s.ev(`const card=r.querySelector('${CARD}'); const chap=card.closest('.ag-chap'); const all=[...chap.querySelectorAll('.ag-ntk')];
      return { chap: chap.querySelector('.ag-chap-t').textContent, last: all.at(-1) === card, before: all.at(-2)?.dataset.ntk,
        chapters: [...r.querySelectorAll('.ag-nt .ag-chap-t')].map((x) => x.textContent), title: card.querySelector('.ag-wf-text b').textContent, sum: card.querySelector('.ag-wf-text small').textContent,
        on: card.querySelector('[data-nt="enabled"]').classList.contains('on'), maint: card.classList.contains('maint'), stHint: [...r.querySelectorAll('.ag-ntk .ag-wf-text small')].map((x) => x.textContent).join(' '),
        wide: r.querySelector('.ag-nt').scrollWidth - r.querySelector('.ag-nt').clientWidth, editor: !!r.querySelector('[data-nt="hc-edit"], [data-nt="hc-play"], .ag-hcnotices') }`);
    check(`${tag}: "${t.name}" ist die letzte der ${t.maint}, nach "Selbsttest", an, orange; kein Kapitel "${t.oldChap}", kein Fenster mit eigenem Text`,
      place.chap === t.maint && place.last && place.before === "selftest" && place.title === t.name && place.on && place.maint && !place.chapters.includes(t.oldChap) && !place.editor && place.wide <= 1, JSON.stringify(place));
    check(`${tag}: Kurzfassung "${t.sum} · ${t.upSum}"`, place.sum.includes(t.sum) && place.sum.includes(t.upSum), place.sum);
    check(`${tag}: die Meldung "Selbsttest" nennt gescheiterte Lebenszeichen nicht mehr`, !place.stHint.includes(t.stOld), place.stHint.slice(0, 200));

    // ----- Fenster: aufgebaut wie "Selbsttest": Empfänger, Kritisch, stehen lassen, Testmeldung; dazu Zahl und "wieder" -----
    const sections = async (kind) => {
      await s.tap(`.ag-ntk[data-ntk="${kind}"] [data-nt="edit"]`);
      await s.waitFor("return r.getElementById('ag-ntkind').open");
      const out = await s.ev(`const d=r.getElementById('ag-ntkind'); return [...d.querySelectorAll('[data-nt]')].map((x) => x.dataset.nt).filter((x, i, a) => a.indexOf(x) === i)`);
      return out;
    };
    const self = await sections("selftest");
    await s.tap(`${DLG} [data-nt="kind-cancel"]`);
    await s.waitFor("return !r.getElementById('ag-ntkind').open");
    const mine = await sections("healthcheck");
    const body = await s.ev(`const d=r.getElementById('ag-ntkind'); const num=d.querySelector('[data-num="healthcheck_fails"]'); const up=d.querySelector('[data-nt="hcup"]');
      return { fails: num?.querySelector('input').value, label: num?.querySelector('.ag-ntk-nl').textContent, unit: num?.querySelector('.ag-ntk-unit').textContent, up: up?.classList.contains('on'), upText: up?.parentElement.innerText,
        upLeft: up ? up.getBoundingClientRect().right <= up.parentElement.querySelector('.ag-settx').getBoundingClientRect().left : false }`);
    check(`${tag}: Fenster wie "Selbsttest" (Empfänger, ${t.critical}, stehen lassen, Testmeldung); dazu "${t.fails} [2] ${t.unit}" und "${t.up}" (an, Schalter links)`,
      self.every((x) => mine.includes(x)) && ["kt-add", "critical", "persistent", "test", "num", "hcup"].every((x) => mine.includes(x)) && body.fails === "2" && body.label === t.fails && body.unit === t.unit
      && body.up === true && body.upText.includes(t.up) && body.upLeft, JSON.stringify({ self, mine, body }));

    // ----- Zahl: Grenzen -----
    const fails = await s.el(`${DLG} [data-num="healthcheck_fails"] input`);
    await fails.fill("0");
    await fails.dispatchEvent("input");
    check(`${tag}: 0 ist ungültig: Feld rot, "Speichern" gesperrt`, await s.waitFor(`return r.querySelector('${DLG} [data-num="healthcheck_fails"] .ag-num').classList.contains('bad') && r.querySelector('[data-nt="save"]').disabled`));
    await fails.fill("11");
    await fails.dispatchEvent("input");
    await s.tap(`${DLG} [data-nt="kind-apply"]`);
    check(`${tag}: 11 ist ungültig: "Übernehmen" bleibt im Fenster mit "${t.range}"`, await s.waitFor(`const d=r.getElementById('ag-ntkind'); return d.open && d.querySelector('.ag-dlg-err').textContent === ${JSON.stringify(t.range)}`));
    const fails2 = await s.el(`${DLG} [data-num="healthcheck_fails"] input`);
    await fails2.fill("4");
    await fails2.dispatchEvent("input");
    check(`${tag}: 4 ist gültig: eine Änderung, "Speichern" frei`, await s.waitFor(`return !r.querySelector('${DLG} [data-num="healthcheck_fails"] .ag-num').classList.contains('bad') && !r.querySelector('[data-nt="save"]').disabled && r.host.notify.dirtyCount() === 1`));

    // ----- Schalter -----
    await s.tap(`${DLG} [data-nt="hcup"]`);
    await s.waitFor(`return !r.querySelector('${DLG} [data-nt="hcup"]').classList.contains('on')`);
    await s.tap(`${DLG} [data-nt="critical"][data-kind="healthcheck"]`);
    check(`${tag}: "${t.up}" aus und ${t.critical} an: drei Änderungen, die Lautstärke erscheint`, await s.waitFor(`const c=r.querySelector('${DLG}'); return !c.querySelector('[data-nt="hcup"]').classList.contains('on') && c.querySelector('[data-nt="critical"]').classList.contains('on')
      && !!c.querySelector('[data-nt="volume"]') && r.host.notify.dirtyCount() === 3`));
    await s.tap(`${DLG} [data-nt="kind-apply"]`);
    const card = await s.waitFor(`return !r.getElementById('ag-ntkind').open`) && await s.ev(`const c=r.querySelector('${CARD}'); return { sum: c.querySelector('.ag-wf-text small').textContent, mark: !!c.querySelector('.ag-unsaved') }`);
    check(`${tag}: "Übernehmen": Karte "${t.sum4}", ohne "wieder", kritisch, als ungespeichert markiert`, card && card.sum.includes(t.sum4) && !card.sum.includes(t.upSum) && card.mark, JSON.stringify(card));

    // ----- Speichern -----
    await s.tap('[data-nt="save"]');
    const saved = await s.waitFor("return r.host.notify.dirtyCount() === 0 && !r.host.notify.saving") && await s.sim("return window.__notify");
    check(`${tag}: "Speichern": Zahl 4, "wieder" aus, Kritisch an; nie die Form aus 1.68.0 ("healthcheck")`,
      saved && saved.healthcheck_fails === 4 && saved.healthcheck_up === false && saved.types.healthcheck.critical === true && !("healthcheck" in saved), JSON.stringify(saved && { f: saved.healthcheck_fails, u: saved.healthcheck_up, t: saved.types.healthcheck, old: saved.healthcheck }));

    // ----- Testmeldung wie jede Wartungsmeldung: Play auf der Karte und im Fenster -----
    await s.sim("window.__testNotify = []; return 1");
    await s.tap(`${CARD} [data-nt="test"]`);
    check(`${tag}: Play auf der Karte geht über den Befehl der Wartungsmeldungen (Art "healthcheck")`, await s.waitFor("return (window.parent.__testNotify || []).at(-1) === 'healthcheck'"));
    await s.waitFor(`return !r.querySelector('${CARD} [data-nt="test"]').classList.contains('ag-running')`, 4000);
    await s.sim("window.__testNotify = []; return 1");
    await s.tap(`${CARD} [data-nt="edit"]`);
    await s.waitFor("return r.getElementById('ag-ntkind').open");
    await s.tap(`${DLG} [data-nt="test"]`);
    check(`${tag}: "Testmeldung senden" im Fenster ebenso`, await s.waitFor("return (window.parent.__testNotify || []).at(-1) === 'healthcheck'"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Tipp auf die Meldung: ?view=healthcheck öffnet die Liste der Dienste -----
    const d = await open(browser, { mobile, lang, query: "&hc=sample&view=healthcheck" });
    check(`${tag}: ?view=healthcheck öffnet die Liste "${t.list}"`, await d.waitFor("return r.getElementById('ag-hclist')?.open", 6000));
    await d.ctx.close();
  }
}
await browser.close();
done();
