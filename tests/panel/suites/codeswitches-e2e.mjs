// Schalter zum Code im Kapitel "Codes pro Person" (Konfiguration › Anlage), seit 1.89.0 (Wunsch des Nutzers 2026-11-25: alles aus dem Optionsdialog
// auch im Panel, ohne unnötigen Platz): "Scharfschalten", "Moduswechsel" und "Quittieren verlangt den Code" nur mit einem Code; "Moduswechsel" nur,
// solange "Scharfschalten" aus ist (an verlangt auch der Wechsel des Modus den Code). Bis 1.89.x stand das in maincode-e2e.mjs zusammen mit dem
// Hauptcode; seit 1.90.0 gibt es keinen Hauptcode mehr (Entscheid des Nutzers: abgeschafft), nur noch Codes pro Person, und auf der Seite keine
// Zeile und keinen Knopf eines Hauptcodes. Ohne Code sagt die Zusammenfassung, dass die Anlage nie einen Code verlangt.
// Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { one: "1 Code", none: "Noch keine Codes", noneHint: "Die Anlage verlangt nie einen Code", noChanges: "Keine Änderungen", one1: "1 Änderung", saved: "Gespeichert",
    missing: "Ohne Code gibt es nichts zu verlangen", add: "Code hinzufügen" },
  en: { one: "1 code", none: "No codes yet", noneHint: "The alarm system never asks for a code", noChanges: "No changes", one1: "1 change", saved: "Saved",
    missing: "Without a code there is nothing to ask for", add: "Add code" },
};
const CHAP = "r.querySelector('[data-sys=\"code-open\"]').closest('.ag-chap')";
const SWITCHES = `return [...${CHAP}.querySelectorAll('.ag-toggle')].map((b) => b.dataset.sys + ':' + b.getAttribute('aria-checked'))`;
const FOOT = "r.querySelector('.ag-foot').innerText.trim().split('\\n')[0]";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const J = JSON.stringify;
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('[data-sys=\"code-open\"]')", 10000);
    const fill = async (key, value) => (await s.el(`#ag-codes [data-key="${key}"]`)).fill(value);

    // ----- Seite mit einem Code pro Person (Anna) -----
    const page = await s.ev(`const c=${CHAP}; return { main: !!c.querySelector('.ag-mainrow, .ag-coderow, [data-sys^="main-"]') || /Hauptcode|Main code/.test(c.innerText),
      options: !!c.querySelector('[data-sys="code"]'), digits: /\\d{4}/.test(c.innerText), sum: c.querySelector('.ag-codesum b').innerText.trim(), small: !!c.querySelector('.ag-codesum small') }`);
    check(`${tag}: Seite: "${t.one}" ohne Zusatz, keine Spur eines Hauptcodes, kein "Optionen öffnen", keine Ziffern`,
      !page.main && !page.options && !page.digits && page.sum === t.one && !page.small, J(page));
    check(`${tag}: drei Schalter in der Reihenfolge Scharfschalten (aus), Moduswechsel (an), Quittieren (aus)`, (await s.ev(SWITCHES)).join() === "armcode:false,modecode:true,ackcode:false", (await s.ev(SWITCHES)).join());
    const over = await s.ev(`const c=${CHAP}.querySelector('.ag-card'); return c.scrollWidth <= c.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1`);
    check(`${tag}: nichts ragt seitlich hinaus`, over);

    // ----- Scharfschalten verlangt den Code: Moduswechsel verschwindet, eine verborgene Änderung bleibt nicht stehen -----
    await s.tap('[data-sys="modecode"]');
    check(`${tag}: Moduswechsel aus zählt als Änderung`, await s.waitFor(`return ${J(t.one1)} === (${FOOT})`));
    await s.tap('[data-sys="armcode"]');
    check(`${tag}: Scharfschalten an: Moduswechsel ausgeblendet (ohne Wirkung), seine Änderung verworfen (nur 1 Änderung)`,
      await s.waitFor(`return !r.querySelector('[data-sys="modecode"]') && r.querySelector('[data-sys="armcode"]').getAttribute('aria-checked') === 'true' && ${J(t.one1)} === (${FOOT})`));
    await s.tap('[data-sys="save"]');
    check(`${tag}: gespeichert mit code_arm_required an, Moduswechsel unverändert an`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes(${J(t.saved)})`, 8000)
      && await s.sim(`const c=window.__calls.filter((x) => x.type === 'alarmageddon/save_system').at(-1); return c.code_arm_required === true && c.code_mode_required === true && c.code_ack_required === false`));
    check(`${tag}: nach dem Speichern bleibt Moduswechsel ausgeblendet`, await s.waitFor(`return !r.querySelector('[data-sys="modecode"]') && r.querySelector('[data-sys="armcode"]').getAttribute('aria-checked') === 'true'`, 8000));
    await s.tap('[data-sys="armcode"]');
    await s.tap('[data-sys="save"]');
    check(`${tag}: Scharfschalten wieder aus gespeichert, Moduswechsel wieder da`, await s.waitFor(`return !!r.querySelector('[data-sys="modecode"]') && r.querySelector('[data-sys="save"]').disabled`, 8000)
      && await s.sim("return window.__calls.filter((x) => x.type === 'alarmageddon/save_system').at(-1).code_arm_required === false"));

    // ----- Letzten Code entfernen: die Schalter verschwinden, ein offener Schalter im Entwurf bleibt nicht als Änderung stehen -----
    await s.waitFor("return !r.querySelector('.ag-ldwrap')", 8000);
    await s.tap('[data-sys="ackcode"]');
    await s.waitFor(`return ${J(t.one1)} === (${FOOT})`);
    await s.tap('[data-sys="code-open"]');
    await s.waitFor("return r.getElementById('ag-codelist').open");
    await s.tap('#ag-codelist [data-sys="code-del"][data-id="c_anna"]');
    await s.waitFor("return !!r.querySelector('#ag-codes [data-sys=\"code-remove\"]')");
    await s.tap('#ag-codes [data-sys="code-remove"]');
    await s.waitFor("return !r.getElementById('ag-codes').open");
    check(`${tag}: Fenster ohne Codes: nur der Hinweis mit dem blauen Knopf, keine Tabelle, keine Zeile eines Hauptcodes`,
      await s.waitFor("const d=r.getElementById('ag-codelist'); return !d.querySelector('.ag-codetable') && !!d.querySelector('.ag-rtempty [data-sys=\"code-add\"].primary') && !d.querySelector('[data-sys^=\"main-\"]')"));
    await s.tap('#ag-codelist [data-sys="code-list-close"]');
    check(`${tag}: ohne Code: keine Schalter, "${t.none}" mit "${t.noneHint} ...", keine verborgene Änderung`, await s.waitFor(`const c=${CHAP}; return c.querySelectorAll('.ag-toggle').length === 0
      && c.querySelector('.ag-codesum b').innerText.trim() === ${J(t.none)} && (c.querySelector('.ag-codesum small')?.innerText || '').startsWith(${J(t.noneHint)}) && ${J(t.noChanges)} === (${FOOT})`, 8000));
    check(`${tag}: der Server hat "Quittieren" nicht bekommen und alles zurückgesetzt`, await s.sim("const s=window.__systems[0]; return s.has_code === false && s.code_ack_required === false && s.code_arm_required === false"));

    // ----- Der Server kennt keinen Code (anderes Fenster): "an" wird abgelehnt und verständlich gemeldet -----
    await s.sim("Object.assign(window.__systems[0], { has_code: true }); return 1");
    await s.ev("return r.host._fetch().then(() => 1)");
    await s.waitFor("return !!r.querySelector('[data-sys=\"armcode\"]')", 8000);
    await s.sim("Object.assign(window.__systems[0], { has_code: false }); return 1");
    await s.tap('[data-sys="armcode"]');
    await s.tap('[data-sys="save"]');
    check(`${tag}: code_missing wird als "${t.missing} ..." gemeldet`, await s.waitFor(`return r.querySelector('.ag-foot .ag-err')?.innerText.includes(${J(t.missing)})`, 8000));
    await s.tap('[data-sys="cancel"]');
    await s.ev("return r.host._fetch().then(() => 1)");

    // ----- Einen Code hinzufügen: die Schalter kommen mit dem gespeicherten Stand zurück -----
    await s.waitFor(`return ${CHAP}.querySelectorAll('.ag-toggle').length === 0`, 8000);
    await s.tap('[data-sys="code-add-page"]');
    check(`${tag}: "${t.add}" auf der Seite öffnet das Formular`, await s.waitFor(`const d=r.getElementById('ag-codes'); return d.open && d.querySelector('h3')?.innerText.trim() === ${J(t.add)}`));
    await fill("name", "Lena");
    await fill("code", "73915");
    await fill("code2", "73915");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: Code hinzugefügt: "${t.one}", drei Schalter wie gespeichert, keine Änderung offen`, await s.waitFor(`const c=${CHAP}; return !r.getElementById('ag-codes').open && c.querySelector('.ag-codesum b').innerText.trim() === ${J(t.one)}
      && [...c.querySelectorAll('.ag-toggle')].map((b) => b.dataset.sys + ':' + b.getAttribute('aria-checked')).join() === 'armcode:false,modecode:true,ackcode:false' && ${J(t.noChanges)} === (${FOOT})`, 8000));
    check(`${tag}: der Code steht nirgends in der Seite`, await s.sim("return !document.getElementById('panel-frame').contentDocument.querySelector('alarmageddon-panel').shadowRoot.innerHTML.includes('73915')"));

    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
