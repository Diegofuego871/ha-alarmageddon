// 1.47.0: Automatische Sicherung in Konfiguration › Anlage › Sicherung: Schalter (Standard an), Abstand (Standard wöchentlich), Marke "Automatisch"
// in der Liste. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";
import { readFileSync } from "node:fs";

// Symbol "archive" aus dem Panel (seit 1.64.0 das eigene Symbol von "Sicherungen anzeigen")
const ARCHIVE = readFileSync(new URL("../../../custom_components/alarmageddon/panel/common.js", import.meta.url), "utf8").match(/\barchive: "([^"]+)"/)[1];

const T = { de: { auto: "Automatisch", every: ["Täglich", "Wöchentlich", "Monatlich"], about: "Was ist im Backup?", not: "Nicht enthalten:", log: "das Protokoll" },
  en: { auto: "Automatic", every: ["Daily", "Weekly", "Monthly"], about: "What is in a backup?", not: "Not included:", log: "the log" } };

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="system"]');
    check(`${tag}: Schalter "Automatisch sichern" steht an, Abstand wöchentlich`, await s.waitFor("return r.querySelector('[data-sys=\"ab-on\"]')?.getAttribute('aria-checked') === 'true' && r.querySelector('[data-sys=\"ab-every\"]').value === 'weekly' && !r.querySelector('[data-sys=\"ab-every\"]').disabled"));
    // "Was ist im Backup?" (Wunsch des Nutzers 2026-11-19): Info-Zeile über der Karte, zu; ein Klick klappt auf, das Protokoll steht unter "Nicht enthalten"
    const about = () => s.ev("const d=r.querySelector('.ag-bk-about'); const card=d && d.nextElementSibling; return d ? { open: d.open, text: d.innerText, svg: !!d.querySelector('summary svg'), above: !!card && card.classList.contains('ag-card') && card.querySelector('.ag-bklast') !== null } : null");
    let ab = await about();
    check(`${tag}: Backup: "${t.about}" mit Info-Symbol über der Karte, zu`, ab && !ab.open && ab.svg && ab.above && ab.text.includes(t.about), JSON.stringify(ab));
    await s.tap('.ag-bk-about summary');
    ab = await about();
    const line = ab?.text.split("\n").find((l) => l.startsWith(t.not)) || "";
    check(`${tag}: aufgeklappt: was dabei ist und "${t.not}" mit ${t.log}`, ab?.open && line.includes(t.log) && line.includes(lang === "de" ? "Codes" : "codes"), JSON.stringify(ab));
    await s.ev("r.host._lastHtml = new WeakMap(); r.host.systemUi.render(); return 1");
    check(`${tag}: bleibt offen, wenn die Seite neu gezeichnet wird`, await s.ev("return r.querySelector('.ag-bk-about')?.open === true"));
    await s.tap('.ag-bk-about summary');
    await s.ev("r.host._lastHtml = new WeakMap(); r.host.systemUi.render(); return 1");
    check(`${tag}: ein zweiter Klick klappt zu, auch nach dem Neuzeichnen`, await s.ev("return r.querySelector('.ag-bk-about')?.open === false"));
    const opts = await s.ev("return [...r.querySelectorAll('[data-sys=\"ab-every\"] option')].map((o) => [o.value, o.textContent])");
    check(`${tag}: täglich, wöchentlich, monatlich`, JSON.stringify(opts) === JSON.stringify([["daily", t.every[0]], ["weekly", t.every[1]], ["monthly", t.every[2]]]), JSON.stringify(opts));
    check(`${tag}: Schalter links, Text rechts davon`, await s.ev("const b=r.querySelector('[data-sys=\"ab-on\"]'); const x=b.closest('.ag-setrow').querySelector('.ag-settx'); return b.getBoundingClientRect().right <= x.getBoundingClientRect().left"));
    // Entwurf (seit 1.55.0): Schalter, Anzahl und Abstand werden erst mit "Speichern" der Seite gespeichert, wie alles andere
    const server = () => s.sim("return window.__autoBackup");
    const dirty = () => s.ev("return r.host.systemUi.dirtyCount()");
    await (await s.el('[data-sys="ab-every"]')).selectOption("monthly");
    check(`${tag}: Abstand monatlich ist nur ein Entwurf: "1 Änderung", orange Punkt, Server unverändert`, (await dirty()) === 1 && (await server())?.every !== "monthly" && (await s.ev("return /(1 Änderung|1 change)/.test(r.querySelector('.ag-foot').innerText) && !!r.querySelector('[data-sub=\"system\"].has-edit')")));
    check(`${tag}: Feld "Sicherungen behalten": Standard 5, links vom Abstand (Handy: darüber), 1 bis 50`, await s.ev("const k=r.querySelector('[data-sys=\"ab-keep\"]'); const e=r.querySelector('[data-sys=\"ab-every\"]'); return k.value === '5' && k.min === '1' && k.max === '50' && (k.getBoundingClientRect().right <= e.getBoundingClientRect().left + 1 || k.getBoundingClientRect().bottom <= e.getBoundingClientRect().top + 1)"));
    await (await s.el('[data-sys="ab-keep"]')).fill("12");
    check(`${tag}: 12 im Entwurf: der Hinweis nennt 12, das Feld behält den Fokus, Server noch unverändert`, await s.waitFor("return /12/.test(r.querySelector('.ag-bkauto .ag-settx small').textContent) && r.activeElement?.dataset.sys === 'ab-keep'") && (await server())?.keep !== 12);
    await (await s.el('[data-sys="ab-keep"]')).fill("51");
    check(`${tag}: 51 ist ungültig (rot) und sperrt "Speichern", Meldung nennt 1 bis 50`, await s.waitFor("return r.querySelector('[data-sys=\"ab-keep\"]').closest('.ag-num').classList.contains('bad') && r.querySelector('[data-sys=\"save\"]').disabled && /1.*50/.test(r.querySelector('.ag-foot .ag-err')?.textContent || '')"));
    await (await s.el('[data-sys="ab-keep"]')).fill("12");
    await s.tap('[data-sys="ab-on"]');
    check(`${tag}: ausgeschaltet im Entwurf: Abstand gesperrt, zählt als eine Änderung (Abschnitt)`, await s.waitFor("return r.querySelector('[data-sys=\"ab-on\"]').getAttribute('aria-checked') === 'false' && r.querySelector('[data-sys=\"ab-every\"]').disabled") && (await dirty()) === 1 && (await server())?.enabled !== false);
    await s.tap('[data-sys="ab-on"]');
    // Abbrechen verwirft alles
    await s.tap('[data-sys="cancel"]');
    check(`${tag}: Abbrechen verwirft: wieder 5, wöchentlich, an, keine Änderung`, await s.waitFor("return r.querySelector('[data-sys=\"ab-keep\"]').value === '5' && r.querySelector('[data-sys=\"ab-every\"]').value === 'weekly' && r.querySelector('[data-sys=\"ab-on\"]').getAttribute('aria-checked') === 'true' && r.host.systemUi.dirtyCount() === 0"));
    // Speichern schickt es an den Server
    await (await s.el('[data-sys="ab-every"]')).selectOption("daily");
    await (await s.el('[data-sys="ab-keep"]')).fill("9");
    await s.tap('[data-sys="ab-on"]');
    check(`${tag}: drei Änderungen am Abschnitt zählen als eine`, (await dirty()) === 1);
    await s.tap('[data-sys="save"]');
    check(`${tag}: Speichern: der Server hat aus, täglich, 9; danach keine Änderung und kein oranger Punkt`, await s.waitFor("return /Gespeichert|Saved/.test(r.querySelector('.ag-foot').innerText)", 8000) && JSON.stringify(await server()) === JSON.stringify({ enabled: false, every: "daily", keep: 9 }) && (await s.waitFor("return r.host.systemUi.dirtyCount() === 0 && !r.querySelector('[data-sub=\"system\"].has-edit')")));
    await s.tap('[data-sys="ab-on"]');
    await s.tap('[data-sys="save"]');
    check(`${tag}: wieder an gespeichert`, await s.waitFor("return /Gespeichert|Saved/.test(r.querySelector('.ag-foot').innerText)", 8000) && (await server())?.enabled === true);
    // Liste: eine automatische Sicherung trägt die Marke
    await s.tap('[data-sys="bk-open"]');
    await s.waitFor("return r.getElementById('ag-bklist').open");
    await s.sim("window.__backups = [{ id: 'ba1', name: '', auto: true, data: { created: new Date().toISOString(), systems: [{ title: 'Haus' }] } }]; return 1");
    await s.ev("return r.host.systemUi.loadBackups().then(() => 1)");
    check(`${tag}: Marke "${t.auto}" in der Liste, Zählung nennt die automatischen getrennt`, await s.waitFor(`return r.querySelector('.ag-bkauto-tag')?.textContent.trim() === ${JSON.stringify(t.auto)} && /1 .* 5/.test(r.querySelector('.ag-bkbody').innerText)`));
    // Liste: eigene Spalte "Datum" (Standard neueste oben), sortierbare Köpfe, ab zehn Zeilen ein Rollbereich mit festem Kopf
    await s.sim("const now = Date.now(); window.__backups = Array.from({ length: 14 }, (_, i) => ({ id: 'b' + i, name: i % 3 ? 'Stand ' + String.fromCharCode(65 + i) : '', auto: i % 3 === 0, data: { created: new Date(now - i * 86400e3).toISOString(), systems: [{ title: i % 2 ? 'Haus' : 'Garage' }] } })); return 1");
    await s.ev("return r.host.systemUi.loadBackups().then(() => 1)");
    await s.waitFor("return r.querySelectorAll('.ag-bktable tr[data-bk]').length === 14");
    const heads = await s.ev("return [...r.querySelectorAll('.ag-bktable th')].map((h) => h.textContent.trim())");
    check(`${tag}: Spalten Name, Datum, Alarmanlagen (Datum eigene Spalte)`, heads.length === 4 && heads[1] === (lang === "de" ? "DATUM" : "DATE") || heads[1].toLowerCase() === (lang === "de" ? "datum" : "date"), JSON.stringify(heads));
    check(`${tag}: Standard: nach Datum, neueste oben`, await s.ev("const ids=[...r.querySelectorAll('.ag-bktable tr[data-bk]')].map((x) => x.dataset.bk); return ids[0] === 'b0' && ids[13] === 'b13' && r.querySelector('.ag-bktable th[aria-sort=\"descending\"] [data-key=\"date\"]')"));
    await s.ev("r.querySelector('[data-sys=\"bk-sort\"][data-key=\"date\"]').scrollIntoView({block:'center'}); return 1");
    await s.tap('[data-sys="bk-sort"][data-key="date"]');
    check(`${tag}: Datum nochmal: älteste oben`, await s.waitFor("return r.querySelector('.ag-bktable tr[data-bk]').dataset.bk === 'b13' && !!r.querySelector('.ag-bktable th[aria-sort=\"ascending\"]')"));
    if (!mobile) { // Auf dem Handy fehlt die Spalte (die Anlagen stehen unter dem Namen)
      await s.tap('[data-sys="bk-sort"][data-key="systems"]');
      check(`${tag}: Sortieren nach Alarmanlagen (aufsteigend: Garage zuerst)`, await s.waitFor("const f=r.querySelector('.ag-bktable tr[data-bk] td:nth-child(3)').textContent; return f === 'Garage'"));
    }
    await s.tap('[data-sys="bk-sort"][data-key="name"]');
    check(`${tag}: Sortieren nach Name (ohne Namen zuerst)`, await s.waitFor("return !/Stand/.test(r.querySelector('.ag-bktable tr[data-bk] td').textContent)"));
    check(`${tag}: die Liste steht im Popup (nicht auf der Seite), das Popup scrollt, der Tabellenkopf klebt oben beim Rollen`, await s.ev(`const d=r.getElementById('ag-bklist'); const body=d.querySelector('.ag-dlg-body'); if (r.querySelector('.ag-sys-form .ag-bktable')) return false; if (!(body.scrollHeight > body.clientHeight + 20)) return false; body.scrollTop = 400; const h=r.querySelector('#ag-bklist .ag-bktable th').getBoundingClientRect(); const top=body.getBoundingClientRect().top; return body.scrollTop > 0 && h.top >= top - 1 && h.top <= top + 60`));
    check(`${tag}: alle 14 Zeilen stehen in der Liste, ohne inneren Rollbereich`, await s.ev("return r.querySelectorAll('#ag-bklist .ag-bktable tr[data-bk]').length === 14 && !r.querySelector('#ag-bklist .ag-bkscroll')"));
    // Deutsch durchgängig "Backup", nie "Sicherung" (Wunsch des Nutzers, 2026-11-18): Kapitel samt Hinweis und Fenster mit Liste
    if (lang === "de") check(`${tag}: Kapitel und Fenster sagen "Backup", nie "Sicherung"`, await s.ev("const t=r.querySelector('.ag-bklast').closest('.ag-chap').innerText + ' ' + r.getElementById('ag-bklist').innerText; return /Backup/.test(t) && !/[Ss]icherung|[Ss]ichern\\b|[Gg]esichert/.test(t)"));
    await s.tap('[data-sys="bk-close"]');
    await s.waitFor("return !r.getElementById('ag-bklist').open");
    // Seit 1.64.0 (Wunsch des Nutzers) wie Routinen, eigene Töne und Codes: eine Zeile oben in der Karte, links "Backup erstellen", rechts "Backups
    // anzeigen"; der Hinweis steht über der Karte, darunter die automatischen Backups
    check(`${tag}: Seite: "Letztes Backup" mit Datum, daneben "Backup erstellen" und "Backups anzeigen" in derselben Zeile, oben in der Karte`, await s.ev(`const l=r.querySelector('.ag-bklast'); if (!l || !/(Letztes Backup|Last backup)/.test(l.innerText)) return false;
      const b=[...l.querySelectorAll('.ag-btnrow > .ag-btn')].map((x) => x.dataset.sys); const card=l.closest('.ag-card'); const chap=l.closest('.ag-chap');
      return b.join() === 'bk-create,bk-open' && card.firstElementChild === l && l.nextElementSibling?.classList.contains('ag-bkauto') && card.querySelectorAll('[data-sys="bk-create"], [data-sys="bk-open"]').length === 2
        && !!chap.querySelector(':scope > .ag-chap-h') && chap.querySelector(':scope > .ag-chap-h').compareDocumentPosition(card) === Node.DOCUMENT_POSITION_FOLLOWING`));
    // Bis 1.63.0 das Listen-Symbol der Routinen (Wunsch 1.58.0); seit 1.64.0 ein eigenes (Wunsch des Nutzers: jede Liste ihr Symbol), weder das der
    // Routinen noch das der automatischen Sicherung
    check(`${tag}: der Knopf "Sicherungen anzeigen" trägt sein eigenes Symbol (Archiv), nicht das von "Routinen anzeigen" und nicht das der automatischen Sicherung`, await s.ev(`const d=(sel) => r.querySelector(sel)?.querySelector('svg path')?.getAttribute('d'); const a=d('[data-sys="bk-open"]'); return a === ${JSON.stringify(ARCHIVE)} && a !== d('[data-sys="rt-open"]') && a !== d('.ag-bkauto .ag-oav')`));
    check(`${tag}: kein Überlauf`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
