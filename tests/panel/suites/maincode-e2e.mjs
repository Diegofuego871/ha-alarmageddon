// 1.89.0 (Wunsch des Nutzers 2026-11-25: alles aus dem Optionsdialog von Home Assistant auch im Panel, im selben Stil, ohne unnötigen Platz):
// Konfiguration › Anlage, Kapitel "Codes pro Person". Hauptcode festlegen, ändern und entfernen in seiner Zeile (Knöpfe in Kreisen wie in der Tabelle
// der Codes; ohne Hauptcode "Hauptcode festlegen", auf dem Handy darunter über die ganze Breite). Formular wie "Code hinzufügen" (zwei Codefelder mit
// Auge, Warnung bei einfachen Codes, Prüfungen), Rückfrage beim Entfernen (nennt, wenn danach kein Code mehr bleibt). Die Schalter zum Code nur mit
// einem Code; "Moduswechsel verlangt den Code" nur, solange "Scharfschalten verlangt den Code" aus ist. Kein Knopf "Optionen öffnen" mehr.
// Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { set: "Festgelegt", none: "Kein Hauptcode", noneAll: "Noch kein Code", setBtn: "Hauptcode festlegen", change: "Hauptcode ändern", remove: "Hauptcode entfernen",
    removeTitle: "Hauptcode entfernen?", removeText: "Die Codes pro Person bleiben", removeLast: "keinen Code mehr", taken: "Diesen Code verwendet schon eine Person", format: "4 bis 8 Ziffern",
    mismatch: "stimmen nicht", weak: "Leicht zu erraten", noChanges: "Keine Änderungen", one: "1 Änderung", saved: "Gespeichert", missing: "Ohne Code gibt es nichts zu verlangen", discard: "Verwerfen" },
  en: { set: "Set", none: "No main code", noneAll: "No code yet", setBtn: "Set main code", change: "Change main code", remove: "Remove main code",
    removeTitle: "Remove main code?", removeText: "The codes per person stay", removeLast: "no code at all", taken: "A person already uses this code", format: "4 to 8 digits",
    mismatch: "do not match", weak: "Easy to guess", noChanges: "No changes", one: "1 change", saved: "Saved", missing: "Without a code there is nothing to ask for", discard: "Discard" },
};
const CHAP = "r.querySelector('[data-sys=\"code-open\"]').closest('.ag-chap')";
const SWITCHES = `return [...${CHAP}.querySelectorAll('.ag-toggle')].map((b) => b.dataset.sys + ':' + b.getAttribute('aria-checked'))`;
const FOOT = "r.querySelector('.ag-foot').innerText.trim().split('\\n')[0]";
const LAST = (type) => `return window.__calls.filter((c) => c.type === 'alarmageddon/${type}').at(-1) || null`;

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('[data-sys=\"code-open\"]')", 10000);
    const fill = async (key, value) => (await s.el(`#ag-codes [data-key="${key}"]`)).fill(value);
    const err = () => s.ev("return r.querySelector('#ag-codes .ag-dlg-err')?.textContent || ''");

    // ----- Seite mit Hauptcode und einem Code pro Person -----
    const page = await s.ev(`const c=${CHAP}; const row=c.querySelector('.ag-mainrow'); const btns=[...row.querySelectorAll('.ag-wf-btns .ag-iconbtn')];
      return { text: row.querySelector('small').innerText.trim(), btns: btns.map((b) => b.dataset.sys + '|' + b.getAttribute('aria-label')), w: btns.map((b) => Math.round(b.getBoundingClientRect().width)),
        border: btns.every((b) => getComputedStyle(b).borderTopStyle === 'solid'), options: !!c.querySelector('[data-sys="code"]'), digits: /\\d{4}/.test(c.innerText),
        beside: btns.every((b) => Math.abs(b.getBoundingClientRect().top - row.querySelector('.ag-oav').getBoundingClientRect().top) < 30) }`);
    check(`${tag}: Hauptcode "${t.set}" mit Ändern und Entfernen in Kreisen (44 px, mit Rand) neben dem Text, kein "Optionen öffnen", keine Ziffern`,
      page.text === t.set && page.btns.join() === `main-edit|${t.change},main-del|${t.remove}` && page.w.every((w) => w === 44) && page.border && !page.options && !page.digits && page.beside, JSON.stringify(page));
    check(`${tag}: drei Schalter in der Reihenfolge Scharfschalten (aus), Moduswechsel (an), Quittieren (aus)`, (await s.ev(SWITCHES)).join() === "armcode:false,modecode:true,ackcode:false", (await s.ev(SWITCHES)).join());
    const over = await s.ev(`const c=${CHAP}.querySelector('.ag-card'); return c.scrollWidth <= c.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1`);
    check(`${tag}: nichts ragt seitlich hinaus`, over);

    // ----- Scharfschalten verlangt den Code: Moduswechsel verschwindet, eine verborgene Änderung bleibt nicht stehen -----
    await s.tap('[data-sys="modecode"]');
    check(`${tag}: Moduswechsel aus zählt als Änderung`, await s.waitFor(`return ${JSON.stringify(t.one)} === (${FOOT})`));
    await s.tap('[data-sys="armcode"]');
    check(`${tag}: Scharfschalten an: Moduswechsel ausgeblendet (ohne Wirkung), seine Änderung verworfen (nur 1 Änderung)`,
      await s.waitFor(`return !r.querySelector('[data-sys="modecode"]') && r.querySelector('[data-sys="armcode"]').getAttribute('aria-checked') === 'true' && ${JSON.stringify(t.one)} === (${FOOT})`));
    await s.tap('[data-sys="save"]');
    check(`${tag}: gespeichert mit code_arm_required an, Moduswechsel unverändert an`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes(${JSON.stringify(t.saved)})`, 8000)
      && await s.sim(`const c=window.__calls.filter((x) => x.type === 'alarmageddon/save_system').at(-1); return c.code_arm_required === true && c.code_mode_required === true && c.code_ack_required === false`));
    check(`${tag}: nach dem Speichern bleibt Moduswechsel ausgeblendet`, await s.waitFor(`return !r.querySelector('[data-sys="modecode"]') && r.querySelector('[data-sys="armcode"]').getAttribute('aria-checked') === 'true'`, 8000));
    await s.tap('[data-sys="armcode"]');
    await s.tap('[data-sys="save"]');
    check(`${tag}: Scharfschalten wieder aus gespeichert, Moduswechsel wieder da`, await s.waitFor(`return !!r.querySelector('[data-sys="modecode"]') && r.querySelector('[data-sys="save"]').disabled`, 8000)
      && await s.sim("return window.__calls.filter((x) => x.type === 'alarmageddon/save_system').at(-1).code_arm_required === false"));

    // ----- Hauptcode ändern -----
    await s.waitFor("return !r.querySelector('.ag-ldwrap')", 8000);
    await s.tap('[data-sys="main-edit"]');
    check(`${tag}: Formular "${t.change}" offen`, await s.waitFor(`const d=r.getElementById('ag-codes'); return d.open && d.querySelector('h3')?.innerText.trim() === ${JSON.stringify(t.change)}`));
    const form = await s.ev(`const d=r.getElementById('ag-codes'); return { chaps: d.querySelectorAll('.ag-chap').length, secrets: d.querySelectorAll('input[type="password"][data-secret]').length, eyes: d.querySelectorAll('[data-sys="code-eye"]').length,
      name: !!d.querySelector('[data-key="name"], [data-key="user_id"]'), focus: r.activeElement?.dataset?.key, wide: d.classList.contains('ag-wide'), full: Math.round(d.getBoundingClientRect().width) >= innerWidth - 1 }`);
    check(`${tag}: Formular: ein Kapitel, zwei Codefelder mit Auge, kein Name und kein Benutzer, Fokus im Codefeld, ${mobile ? "ganzer Bildschirm" : "breit wie die übrigen Formulare"}`,
      form.chaps === 1 && form.secrets === 2 && form.eyes === 2 && !form.name && form.focus === "code" && form.wide && (!mobile || form.full), JSON.stringify(form));
    await fill("code", "1234");
    check(`${tag}: einfacher Code: Warnung "${t.weak}"`, await s.waitFor(`const w=r.querySelector('#ag-codes .ag-codewarn'); return !w.hidden && w.innerText.includes(${JSON.stringify(t.weak)})`));
    await fill("code2", "1235");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: ungleiche Codes abgelehnt, nichts gesendet`, (await err()).includes(t.mismatch) && !(await s.sim(LAST("set_main_code"))));
    await fill("code", "12");
    await fill("code2", "12");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: zu kurzer Code abgelehnt`, (await err()).includes(t.format) && !(await s.sim(LAST("set_main_code"))));
    await fill("code", "2468");
    await fill("code2", "2468");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: Code einer Person abgelehnt ("${t.taken}")`, await s.waitFor(`return r.querySelector('#ag-codes .ag-dlg-err').textContent.includes(${JSON.stringify(t.taken)})`) && await s.sim("return window.__systems[0].code === '1234'"));
    // Schliessen mit getipptem Code fragt nach
    await s.tap("#ag-codes .ag-dlg-x");
    check(`${tag}: Schliessen mit getipptem Code fragt nach`, await s.waitFor("return r.getElementById('ag-confirm').open"));
    await s.ev("r.querySelector('#ag-confirm [data-c=\"no\"]').click(); return 1");
    await s.waitFor("return !r.getElementById('ag-confirm').open");
    await fill("code", "86429");
    await fill("code2", "86429");
    await s.tap('#ag-codes [data-sys="code-save"]');
    // Das Leeren der Felder hängt am Ereignis "close" des Fensters, das der Browser kurz nach dem Schliessen schickt
    const closed = await s.waitFor("const d=r.getElementById('ag-codes'); return !d.open && [...d.querySelectorAll('input')].every((i) => i.value === '' && i.type === 'password')", 3000);
    const after = await s.ev("const d=r.getElementById('ag-codes'); return { open: d.open, err: d.querySelector('.ag-dlg-err')?.textContent || '', inputs: [...d.querySelectorAll('input')].map((i) => i.value) }");
    check(`${tag}: neuer Hauptcode gespeichert, Fenster zu, Felder leer`, closed && await s.sim("return window.__systems[0].code === '86429'"), JSON.stringify(after));
    // Gesendet wurden nur der abgelehnte Code einer Person und der neue Code; ein falsches Format und ungleiche Codes prüft schon das Panel
    const sent = await s.sim("return window.__calls.filter((x) => x.type === 'alarmageddon/set_main_code').map((x) => x.entry_id + ':' + x.code)");
    check(`${tag}: set_main_code nur mit gültigen, gleichen Codes gesendet`, sent.join() === "e_haus:2468,e_haus:86429", sent.join());
    await s.waitFor("return !r.querySelector('.ag-ldwrap')", 8000);
    check(`${tag}: kein Code im Kapitel sichtbar`, await s.ev(`return !${CHAP}.innerText.includes('86429') && !r.getElementById('ag-codes').innerText.includes('86429')`));

    // ----- Entfernen, solange ein Code pro Person bleibt -----
    await s.tap('[data-sys="main-del"]');
    check(`${tag}: Rückfrage "${t.removeTitle}": die Codes pro Person bleiben`, await s.waitFor(`const d=r.getElementById('ag-codes'); return d.open && d.querySelector('h3').innerText.trim() === ${JSON.stringify(t.removeTitle)} && d.innerText.includes(${JSON.stringify(t.removeText)}) && !!d.querySelector('[data-sys="main-remove"].danger')`));
    await s.tap('#ag-codes [data-sys="main-remove"]');
    check(`${tag}: entfernt: "${t.none}" mit "${t.setBtn}", die Schalter bleiben (Anna hat einen Code)`, await s.waitFor(`const c=${CHAP}; return !r.getElementById('ag-codes').open && c.querySelector('.ag-mainrow small').innerText.trim() === ${JSON.stringify(t.none)}
      && c.querySelector('.ag-mainrow [data-sys="main-set"]')?.innerText.trim() === ${JSON.stringify(t.setBtn)} && c.querySelectorAll('.ag-toggle').length === 3`, 8000) && await s.sim("return window.__systems[0].main_code === false"));
    const setBtn = await s.ev(`const row=${CHAP}.querySelector('.ag-mainrow'); const b=row.querySelector('[data-sys="main-set"]').getBoundingClientRect(); const tx=row.querySelector('.ag-grow').getBoundingClientRect(); const rr=row.getBoundingClientRect();
      return { below: b.top >= tx.bottom - 1, full: Math.round(b.width) >= Math.round(rr.width) - 2, beside: b.left >= tx.right - 1 && Math.abs(b.top - rr.top) < 20 }`);
    check(`${tag}: "${t.setBtn}" ${mobile ? "unter dem Text über die ganze Breite" : "neben dem Text"}`, mobile ? setBtn.below && setBtn.full : setBtn.beside, JSON.stringify(setBtn));

    // ----- Letzten Code entfernen: die Schalter verschwinden, ein offener Schalter im Entwurf bleibt nicht als Änderung stehen -----
    await s.tap('[data-sys="ackcode"]');
    await s.waitFor(`return ${JSON.stringify(t.one)} === (${FOOT})`);
    await s.tap('[data-sys="code-open"]');
    await s.waitFor("return r.getElementById('ag-codelist').open");
    await s.tap('#ag-codelist [data-sys="code-del"][data-id="c_anna"]');
    await s.waitFor("return !!r.querySelector('#ag-codes [data-sys=\"code-remove\"]')");
    await s.tap('#ag-codes [data-sys="code-remove"]');
    await s.waitFor("return !r.getElementById('ag-codes').open");
    await s.tap('#ag-codelist [data-sys="code-list-close"]');
    check(`${tag}: ohne Code: keine Schalter, die Zeile sagt es ("${t.noneAll}"), keine verborgene Änderung`, await s.waitFor(`const c=${CHAP}; return c.querySelectorAll('.ag-toggle').length === 0 && c.querySelector('.ag-mainrow small').innerText.startsWith(${JSON.stringify(t.noneAll)})
      && ${JSON.stringify(t.noChanges)} === (${FOOT})`, 8000));
    check(`${tag}: der Server hat "Quittieren" nicht bekommen und alles zurückgesetzt`, await s.sim("const s=window.__systems[0]; return s.has_code === false && s.code_ack_required === false && s.code_arm_required === false"));

    // ----- Hauptcode festlegen ohne jeden Code: die Schalter kommen mit dem gespeicherten Stand zurück -----
    await s.tap('[data-sys="main-set"]');
    check(`${tag}: Formular "${t.setBtn}"`, await s.waitFor(`const d=r.getElementById('ag-codes'); return d.open && d.querySelector('h3')?.innerText.trim() === ${JSON.stringify(t.setBtn)}`));
    await fill("code", "73915");
    await fill("code2", "73915");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: festgelegt: drei Schalter wie gespeichert, keine Änderung offen`, await s.waitFor(`const c=${CHAP}; return !r.getElementById('ag-codes').open && c.querySelector('.ag-mainrow small').innerText.trim() === ${JSON.stringify(t.set)}
      && [...c.querySelectorAll('.ag-toggle')].map((b) => b.dataset.sys + ':' + b.getAttribute('aria-checked')).join() === 'armcode:false,modecode:true,ackcode:false' && ${JSON.stringify(t.noChanges)} === (${FOOT})`, 8000));

    // ----- Der Server kennt keinen Code mehr (anderes Fenster): "an" wird abgelehnt und verständlich gemeldet -----
    await s.waitFor("return !r.querySelector('.ag-ldwrap')", 8000);
    await s.sim("Object.assign(window.__systems[0], { has_code: false, main_code: false, code: null }); return 1");
    await s.tap('[data-sys="armcode"]');
    await s.tap('[data-sys="save"]');
    check(`${tag}: code_missing wird als "${t.missing} ..." gemeldet`, await s.waitFor(`return r.querySelector('.ag-foot .ag-err')?.innerText.includes(${JSON.stringify(t.missing)})`, 8000));
    await s.sim("Object.assign(window.__systems[0], { has_code: true, main_code: true, code: '73915' }); return 1");
    await s.tap('[data-sys="armcode"]');

    // ----- Entfernen des letzten Codes: die Rückfrage nennt die Folge -----
    await s.tap('[data-sys="main-del"]');
    check(`${tag}: Rückfrage ohne weitere Codes: die Anlage hat danach ${t.removeLast}`, await s.waitFor(`const d=r.getElementById('ag-codes'); return d.open && d.innerText.includes(${JSON.stringify(t.removeLast)})`));
    const narrow = await s.ev("const d=r.getElementById('ag-codes'); return { wide: d.classList.contains('ag-wide'), w: Math.round(d.getBoundingClientRect().width), vw: innerWidth }");
    check(`${tag}: Rückfrage schmal wie die übrigen Rückfragen`, !narrow.wide && (narrow.w <= 420 || narrow.w === narrow.vw), JSON.stringify(narrow));
    await s.tap('#ag-codes [data-sys="code-close"]');

    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
