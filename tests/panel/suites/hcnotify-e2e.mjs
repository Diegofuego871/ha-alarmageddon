// 1.68.0: Meldungen der HealthCheck-Dienste (Wunsch des Nutzers 2026-11-19, 18:42 und 18:43). Konfiguration › Benachrichtigungen, Kapitel
// "HealthCheck-Dienste", immer da (auch ohne Dienst): Zahl gescheiterter Aufrufe (1 bis 10, Standard 2) und die Karten "Dienst antwortet nicht" und
// "Dienst antwortet wieder" wie die festen Meldungen unter Aktionen (Schalter, Play, Stift; dasselbe Fenster mit eigenen Platzhaltern, Empfänger
// standardmässig die der Wartung, Klickziel "Liste der HealthCheck-Dienste"). Entwurf mit "Speichern". Tipp auf eine Meldung: ?view=healthcheck
// öffnet die Liste der Dienste. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { chap: "HealthCheck-Dienste", fails: "Meldung nach", down: "Dienst antwortet nicht", up: "Dienst antwortet wieder", toMaint: "Empfänger der Wartung", own: "eigener Text",
    click: "Liste der HealthCheck-Dienste", maintDefault: "Standard-Empfänger von Wartungsmeldungen", tokens: ["Dienst", "Rechner", "Grund", "gescheiterte Aufrufe", "gestört seit"],
    stOld: "Lebenszeichen, die nicht hinausgingen", tested: "Testmeldung gesendet", list: "HealthCheck-Dienste" },
  en: { chap: "HealthCheck services", fails: "Message after", down: "Service is not answering", up: "Service answers again", toMaint: "Maintenance recipients", own: "own text",
    click: "List of the HealthCheck services", maintDefault: "Standard recipients of maintenance messages", tokens: ["service", "host", "reason", "failed calls", "failing since"],
    stOld: "life signs that did not go out", tested: "Test message sent", list: "HealthCheck services" },
};

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "notify" } });
    await s.waitFor("return !!r.querySelector('.ag-hcnotices')");
    await s.sim("window.__notify.maintenance_targets = ['notify.mobile_app_diego']; return 1");
    await s.ev("r.host._fetch(); return 1");
    await s.waitFor("return r.host._data?.notify?.maintenance_targets?.length === 1");
    await s.ev("r.host.notify.reset(); r.host.notify.render(); return 1");

    // ----- Kapitel, immer da (der Nachbau hat hier keinen Dienst) -----
    const chap = await s.ev(`const c=[...r.querySelectorAll('.ag-chap')].find((x) => x.querySelector('.ag-hcnotices')); const cards=[...c.querySelectorAll('[data-hc-notice]')];
      return { title: c.querySelector('.ag-chap-t').textContent, fails: c.querySelector('[data-nt="hc-fails"]').value, failsLabel: c.querySelector('.ag-hcfails b').textContent,
        cards: cards.map((x) => ({ kind: x.dataset.hcNotice, text: x.innerText, on: x.querySelector('.ag-toggle').classList.contains('on'), play: !!x.querySelector('[data-nt="hc-play"]'), edit: !!x.querySelector('[data-nt="hc-edit"]'),
          toggleLeft: x.querySelector('.ag-toggle').getBoundingClientRect().left - x.getBoundingClientRect().left })), services: (r.host._data.healthchecks || []).length,
        stHint: [...r.querySelectorAll('.ag-mt .ag-settx small')].map((x) => x.textContent).join(' '), wide: r.querySelector('.ag-nt').scrollWidth - r.querySelector('.ag-nt').clientWidth }`);
    check(`${tag}: Kapitel "${t.chap}" auch ohne Dienst: "${t.fails}" 2, Karten "${t.down}" und "${t.up}" (an, Schalter links, Play, Stift, an die ${t.toMaint})`,
      chap.title === t.chap && chap.services === 0 && chap.fails === "2" && chap.failsLabel === t.fails && chap.cards.length === 2 && chap.cards[0].kind === "hc_down" && chap.cards[0].text.includes(t.down)
      && chap.cards[1].text.includes(t.up) && chap.cards.every((c) => c.on && c.play && c.edit && c.toggleLeft < 40 && c.text.includes(t.toMaint)) && chap.wide <= 1, JSON.stringify(chap));
    check(`${tag}: die Meldung "Selbsttest" nennt gescheiterte Lebenszeichen nicht mehr`, !chap.stHint.includes(t.stOld), chap.stHint.slice(0, 200));

    // ----- Zahl: Entwurf, Grenzen -----
    const fails = await s.el('[data-nt="hc-fails"]');
    await fails.fill("0");
    await fails.dispatchEvent("input");
    check(`${tag}: 0 ist ungültig: Feld rot, "Speichern" gesperrt`, await s.waitFor("return r.querySelector('.ag-hcfails .ag-num').classList.contains('bad') && r.querySelector('[data-nt=\"save\"]').disabled"));
    await fails.fill("3");
    await fails.dispatchEvent("input");
    check(`${tag}: 3 ist gültig: eine Änderung, "Speichern" frei`, await s.waitFor("return !r.querySelector('.ag-hcfails .ag-num').classList.contains('bad') && !r.querySelector('[data-nt=\"save\"]').disabled && r.host.notify.dirtyCount() === 1"));

    // ----- Fenster der Meldung -----
    await s.tap('[data-nt="hc-edit"][data-kind="hc_down"]');
    const ed = await s.waitFor("return r.getElementById('ag-step').open") && await s.ev(`const d=r.getElementById('ag-step');
      return { title: d.querySelector('h3').textContent, chips: [...d.querySelectorAll('[data-wf="ins"] small')].map((x) => x.textContent), prev: d.querySelector('#ag-ntprev').innerText,
        click: d.querySelector('[data-wf="nt-click"]').selectedOptions[0].textContent, targets: d.innerText.includes(${JSON.stringify(t.maintDefault)}), test: !!d.querySelector('[data-wf="notice-test"]') }`);
    check(`${tag}: der Stift öffnet das Fenster der festen Meldungen: "${t.down}", Platzhalter ${t.tokens.join(", ")}, Vorschau mit Beispiel, Klickziel "${t.click}", Empfänger der Wartung`,
      ed && ed.title === t.down && JSON.stringify(ed.chips) === JSON.stringify(t.tokens) && ed.prev.includes("Healthchecks.io") && ed.prev.includes("hc-ping.com") && !/\{\w+\}/.test(ed.prev)
      && ed.click === t.click && ed.targets && ed.test, JSON.stringify(ed));
    const title = await s.el('#ag-step [data-key="ntTitle"]');
    await title.fill("{name} ist weg");
    await title.dispatchEvent("input");
    await s.tap('#ag-step [data-wf="notice-test"]');
    check(`${tag}: "Testmeldung senden" im Fenster schickt die (ungespeicherten) Werte`, await s.waitFor("return (window.parent.__hcNoticeCalls || []).at(-1)?.notice?.title === '{name} ist weg'"));
    await s.tap('#ag-step [data-wf="apply"]');
    check(`${tag}: "Übernehmen" schliesst das Fenster, die Karte nennt "${t.own}", zwei Änderungen im Entwurf (nie im Entwurf der Aktionen)`,
      await s.waitFor(`return !r.getElementById('ag-step').open && r.querySelector('[data-hc-notice="hc_down"]').innerText.includes(${JSON.stringify(t.own)}) && r.host.notify.dirtyCount() === 2 && r.host.actions.dirtyCount() === 0`));

    // ----- Schalter, Play -----
    await s.tap('[data-nt="hc-on"][data-kind="hc_up"]');
    check(`${tag}: Schalter "${t.up}" aus: Karte blass, Play gesperrt`, await s.waitFor("const c=r.querySelector('[data-hc-notice=\"hc_up\"]'); return c.classList.contains('off') && c.querySelector('[data-nt=\"hc-play\"]').disabled"));
    const before = await s.sim("return window.__hcNoticeCalls.length");
    await s.tap('[data-nt="hc-play"][data-kind="hc_down"]');
    check(`${tag}: Play auf der Karte schickt die Testmeldung mit dem Entwurf`, await s.waitFor(`const c=window.parent.__hcNoticeCalls; return c.length === ${before + 1} && c.at(-1).kind === "hc_down" && c.at(-1).notice.title === "{name} ist weg"`));

    // ----- Speichern -----
    await s.tap('[data-nt="save"]');
    const saved = await s.waitFor("return r.host.notify.dirtyCount() === 0 && !r.host.notify.saving") && await s.sim("return window.__notify.healthcheck");
    check(`${tag}: "Speichern" schickt die Zahl und beide Meldungen; danach keine offene Änderung`, saved && saved.fails === 3 && saved.hc_down.title === "{name} ist weg" && saved.hc_up.enabled === false && saved.hc_down.click === "healthcheck", JSON.stringify(saved));
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
