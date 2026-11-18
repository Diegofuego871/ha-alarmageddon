// 1.60.0 (Wunsch des Nutzers, 2026-11-17): Suchfeld in den Fenstern "Routinen", "Eigene Töne" und "Sicherungen"; bei den Sicherungen dazu
// der Filter "Nur automatische". Die Suche findet alles, was die Zeile zeigt, bei Routinen auch die Entitäts-IDs der Geräte (die Zeile zeigt
// nur ihre Namen). Beim Tippen bleibt der Fokus im Feld; die Knöpfe einer gefilterten Zeile wirken auf die richtige Routine.
import { check, done, launch, open, outDir } from "../lib.mjs";

const T = {
  de: { rtNo: "Keine Routine passt", csNo: "Kein Ton passt", bkNo: "Kein Backup passt", bypass: "umgeht", unlocked: "aufgeschlossen", auto: "automatisch", autoOnly: "Nur automatische" },
  en: { rtNo: "No routine matches", csNo: "No sound matches", bkNo: "No backup matches", bypass: "bypasses", unlocked: "unlocked", auto: "automatic", autoOnly: "Automatic only" },
};

const browser = await launch();
for (const [lang, mobile] of [["de", false], ["de", true], ["en", false]]) {
  const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
  const t = T[lang];
  const s = await open(browser, { mobile, lang, tab: "config", query: "&sounds=1" });
  await s.tap('[data-sub="system"]');
  const type = async (sel, text) => (await s.el(sel)).fill(text);
  // Das Fenster ist nie breiter als sein Inhalt erlaubt: Suchfeld und Filter ragen nicht hinaus (Handy: der Filter steht unter dem Suchfeld)
  const fits = (id) => s.ev(`const d=r.getElementById(${JSON.stringify(id)}); const b=d.querySelector('.ag-dlg-body'); const box=b.getBoundingClientRect();
    return b.scrollWidth <= b.clientWidth + 1 && [...d.querySelectorAll('.ag-pop-tools > *')].every((x) => x.getBoundingClientRect().left >= box.left - 1 && x.getBoundingClientRect().right <= box.right + 1)`);
  const focused = (sel) => s.ev(`return r.activeElement === r.querySelector(${JSON.stringify(sel)})`);

  // ----- Routinen -----
  const names = () => s.ev("return [...r.querySelectorAll('#ag-rtlist .ag-rtrow .ag-settx > b')].map((b) => b.textContent)");
  const Q = '#ag-rtlist [data-sys="rt-search"]';
  await s.tap('[data-sys="rt-open"]');
  await s.waitFor("return r.getElementById('ag-rtlist').open");
  check(`${tag}: Routinen: Suchfeld über der Liste, leer, drei Routinen, Knopf zum Leeren verborgen`, (await names()).length === 3
    && await s.ev(`const q=r.querySelector(${JSON.stringify(Q)}); const list=r.querySelector('#ag-rtlist .ag-rtrows'); return !!q && q.value === '' && r.querySelector('#ag-rtlist [data-sys="rt-search-clear"]').hidden && q.getBoundingClientRect().bottom <= list.getBoundingClientRect().top`));
  await s.tap(Q);
  await type(Q, "lock.haustuer");
  check(`${tag}: Routinen: die Entitäts-ID eines Geräts findet die Routine (die Zeile zeigt die ID nicht)`, JSON.stringify(await names()) === '["Heimkommen"]'
    && await s.ev("return !r.querySelector('#ag-rtlist .ag-rtrows').textContent.includes('lock.haustuer')"), JSON.stringify(await names()));
  check(`${tag}: Routinen: der Fokus bleibt beim Tippen im Suchfeld, der Knopf zum Leeren erscheint`, await focused(Q) && await s.ev("return !r.querySelector('#ag-rtlist [data-sys=\"rt-search-clear\"]').hidden"));
  await type(Q, "NACHTS");
  check(`${tag}: Routinen: Name, Gross- und Kleinschreibung egal`, JSON.stringify(await names()) === '["Nachts scharf"]', JSON.stringify(await names()));
  await type(Q, "22:30");
  check(`${tag}: Routinen: Uhrzeit des Zeitplans`, JSON.stringify(await names()) === '["Nachts scharf"]', JSON.stringify(await names()));
  await type(Q, t.bypass);
  check(`${tag}: Routinen: Text einer Marke ("Umgeht den Code")`, JSON.stringify(await names()) === '["Morgens aus","Heimkommen"]', JSON.stringify(await names()));
  await type(Q, `heim  ${t.unlocked}`);
  check(`${tag}: Routinen: mehrere Wörter müssen alle vorkommen (Name und Zustand des Geräts)`, JSON.stringify(await names()) === '["Heimkommen"]', JSON.stringify(await names()));
  await type(Q, `heim 22:30`);
  check(`${tag}: Routinen: nichts passt: Hinweis statt Liste, der Knopf "Routine hinzufügen" bleibt`, (await names()).length === 0
    && await s.ev(`return r.querySelector('#ag-rtlist .ag-rtrows').textContent.includes(${JSON.stringify(t.rtNo)}) && !!r.querySelector('#ag-rtlist .ag-dlg-btns [data-sys="rt-add"]')`));
  await s.tap('#ag-rtlist [data-sys="rt-search-clear"]');
  check(`${tag}: Routinen: Leeren zeigt wieder alle, der Fokus steht im Feld`, (await names()).length === 3 && await focused(Q) && await s.ev(`return r.querySelector(${JSON.stringify(Q)}).value === ''`));
  // Knöpfe einer gefilterten Zeile wirken auf die richtige Routine, und die Suche bleibt nach dem Neuzeichnen stehen
  await type(Q, "heim");
  await s.tap('#ag-rtlist .ag-rtrow [data-sys="rt-on"]');
  check(`${tag}: Routinen: der Schalter der gefundenen Zeile schaltet diese Routine (nicht die erste der Liste), die Suche bleibt`, await s.ev("const d=r.host.systemUi.rt.draft.routines; return d[2].enabled === false && d[0].enabled !== false && d[1].enabled !== false")
    && JSON.stringify(await names()) === '["Heimkommen"]' && await s.ev(`return r.querySelector(${JSON.stringify(Q)}).value === 'heim'`));
  await s.tap('#ag-rtlist .ag-rtrow [data-sys="rt-on"]');
  check(`${tag}: Routinen: Suchfeld passen in das Fenster, nichts ragt seitlich hinaus`, await fits("ag-rtlist"));
  await s.page.screenshot({ path: `${outDir}popsearch-routinen-${lang}-${mobile ? "handy" : "desktop"}.png` });
  await s.tap('#ag-rtlist [data-sys="rt-close"]');
  await s.tap('[data-sys="rt-open"]');
  check(`${tag}: Routinen: neu geöffnet ist die Suche leer`, await s.ev(`return r.querySelector(${JSON.stringify(Q)}).value === ''`) && (await names()).length === 3);
  await s.tap('#ag-rtlist [data-sys="rt-close"]');

  // ----- Eigene Töne -----
  await s.sim("window.__customSounds.push({ id: 'custom_ba9876543210', name: 'Garage Tor', seconds: 12, size: 1200000, url: '/alarmageddon_custom/custom_ba9876543210.wav' }); return 1");
  await s.ev("return r.host._fetch()");
  const sounds = () => s.ev("return [...r.querySelectorAll('#ag-cslist .ag-csrow[data-sound] b')].map((b) => b.textContent)");
  const C = '#ag-cslist [data-sys="cs-search"]';
  await s.tap('[data-sys="cs-open"]');
  await s.waitFor("return r.getElementById('ag-cslist').open && r.querySelectorAll('#ag-cslist .ag-csrow[data-sound]').length === 2");
  check(`${tag}: Töne: Suchfeld über der Liste`, await s.ev(`const q=r.querySelector(${JSON.stringify(C)}); return !!q && q.getBoundingClientRect().bottom <= r.querySelector('#ag-cslist [data-cs="manage"]').getBoundingClientRect().top`));
  await s.tap(C);
  await type(C, "garage");
  check(`${tag}: Töne: Name`, JSON.stringify(await sounds()) === '["Garage Tor"]' && await focused(C), JSON.stringify(await sounds()));
  await type(C, "1.1 MB");
  check(`${tag}: Töne: Grösse, wie sie die Zeile zeigt`, JSON.stringify(await sounds()) === '["Garage Tor"]', JSON.stringify(await sounds()));
  await type(C, "gibt es nicht");
  check(`${tag}: Töne: nichts passt: Hinweis, "Ton hochladen" bleibt`, (await sounds()).length === 0 && await s.ev(`return r.querySelector('#ag-cslist .ag-csrows').textContent.includes(${JSON.stringify(t.csNo)}) && !!r.querySelector('#ag-cslist [data-sys="cs-upload-open"]')`));
  // Formular zum Hochladen offen: die Suche zeichnet nur die Zeilen neu, das Formular behält seinen Namen
  await s.tap('#ag-cslist [data-sys="cs-search-clear"]');
  await s.tap('#ag-cslist [data-sys="cs-upload-open"]');
  await type('#ag-cslist [data-sys="cs-name"]', "Neuer Ton");
  await type(C, "haust");
  check(`${tag}: Töne: mit offenem Formular zum Hochladen: nur die Zeilen ändern sich, das Formular bleibt mit seinem Namen`, JSON.stringify(await sounds()) === '["Haustür-Sirene"]'
    && await s.ev("const n=r.querySelector('#ag-cslist [data-sys=\"cs-name\"]'); return !!n && n.value === 'Neuer Ton'"));
  check(`${tag}: Töne: Suchfeld passen in das Fenster, nichts ragt seitlich hinaus`, await fits("ag-cslist"));
  await s.page.screenshot({ path: `${outDir}popsearch-toene-${lang}-${mobile ? "handy" : "desktop"}.png` });
  await s.tap('#ag-cslist [data-sys="cs-cancel"]');
  await s.tap('#ag-cslist [data-sys="cs-close"]');

  // ----- Sicherungen -----
  const rows = () => s.ev("return [...r.querySelectorAll('#ag-bklist tr[data-bk]')].map((tr) => tr.dataset.bk)");
  const B = '#ag-bklist [data-sys="bk-search"]';
  await s.sim("window.__backups = []; return 1");
  await s.tap('[data-sys="bk-open"]');
  await s.waitFor("return r.getElementById('ag-bklist').open && r.host.systemUi.backups !== null");
  check(`${tag}: Sicherungen: ohne Sicherung kein Suchfeld und kein Filter`, await s.ev("return r.querySelector('#ag-bklist .ag-bktools').hidden"));
  await s.tap('#ag-bklist [data-sys="bk-close"]');
  await s.sim(`const day = (n) => new Date(Date.UTC(2026, 10, n, 9, 30)).toISOString();
    window.__backups = [{ id: 'b1', name: 'Vor Umbau', data: { created: day(3), systems: [{ title: 'Haus' }] } }, { id: 'b2', name: '', auto: true, data: { created: day(9), systems: [{ title: 'Haus' }] } },
      { id: 'b3', name: 'Garage neu', data: { created: day(12), systems: [{ title: 'Haus' }, { title: 'Garage' }] } }, { id: 'b4', name: '', auto: true, data: { created: day(16), systems: [{ title: 'Haus' }, { title: 'Garage' }] } }]; return 1`);
  await s.ev("return r.host.systemUi.loadBackups()");
  await s.tap('[data-sys="bk-open"]');
  await s.waitFor("return r.querySelectorAll('#ag-bklist tr[data-bk]').length === 4");
  check(`${tag}: Sicherungen: Suchfeld und Filter "${t.autoOnly}" über der Liste, der Filter ist aus`, await s.ev(`const tools=r.querySelector('#ag-bklist .ag-bktools'); const chip=tools.querySelector('[data-sys="bk-auto-only"]');
    return !tools.hidden && !!tools.querySelector('[data-sys="bk-search"]') && chip.textContent.trim() === ${JSON.stringify(t.autoOnly)} && chip.getAttribute('aria-pressed') === 'false' && tools.getBoundingClientRect().bottom <= r.querySelector('#ag-bklist .ag-bkbody').getBoundingClientRect().top + 1`));
  await s.tap(B);
  await type(B, "umbau");
  check(`${tag}: Sicherungen: Name`, JSON.stringify(await rows()) === '["b1"]' && await focused(B), JSON.stringify(await rows()));
  await type(B, "garage");
  check(`${tag}: Sicherungen: Name oder Anlage (neueste zuerst)`, JSON.stringify(await rows()) === '["b4","b3"]', JSON.stringify(await rows()));
  await type(B, t.auto);
  check(`${tag}: Sicherungen: die Marke "Automatisch"`, JSON.stringify(await rows()) === '["b4","b2"]', JSON.stringify(await rows()));
  await type(B, "2026");
  check(`${tag}: Sicherungen: das Datum, wie es die Zeile zeigt`, (await rows()).length === 4, JSON.stringify(await rows()));
  await type(B, "");
  await s.tap('#ag-bklist [data-sys="bk-auto-only"]');
  check(`${tag}: Sicherungen: der Filter zeigt nur die automatischen und ist als gedrückt gekennzeichnet`, JSON.stringify(await rows()) === '["b4","b2"]'
    && await s.ev("const c=r.querySelector('#ag-bklist [data-sys=\"bk-auto-only\"]'); return c.classList.contains('on') && c.getAttribute('aria-pressed') === 'true'"), JSON.stringify(await rows()));
  await type(B, "garage");
  check(`${tag}: Sicherungen: Filter und Suche zusammen`, JSON.stringify(await rows()) === '["b4"]', JSON.stringify(await rows()));
  check(`${tag}: Sicherungen: Suchfeld und Filter passen in das Fenster, nichts ragt seitlich hinaus`, await fits("ag-bklist"));
  await s.page.screenshot({ path: `${outDir}popsearch-sicherungen-${lang}-${mobile ? "handy" : "desktop"}.png` });
  await type(B, "umbau");
  check(`${tag}: Sicherungen: nichts passt: Hinweis statt Tabelle, die Zähler bleiben`, (await rows()).length === 0 && await s.ev(`const b=r.querySelector('#ag-bklist .ag-bkbody'); return b.textContent.includes(${JSON.stringify(t.bkNo)}) && /2 .* 10/.test(b.textContent)`));
  await s.tap('#ag-bklist [data-sys="bk-search-clear"]');
  await s.tap('#ag-bklist [data-sys="bk-auto-only"]');
  check(`${tag}: Sicherungen: Suche geleert und Filter aus: wieder alle vier`, (await rows()).length === 4);
  // Sortieren und Löschen wirken weiter auf die gefilterte Liste
  await type(B, "garage");
  await s.tap('#ag-bklist [data-sys="bk-sort"][data-key="date"]');
  check(`${tag}: Sicherungen: Sortieren bleibt möglich, die Suche bleibt`, JSON.stringify(await rows()) === '["b3","b4"]' && await s.ev(`return r.querySelector(${JSON.stringify(B)}).value === 'garage'`), JSON.stringify(await rows()));
  await s.tap('#ag-bklist [data-sys="bk-close"]');
  await s.tap('[data-sys="bk-open"]');
  check(`${tag}: Sicherungen: neu geöffnet sind Suche und Filter zurückgesetzt`, await s.waitFor("return r.querySelectorAll('#ag-bklist tr[data-bk]').length === 4")
    && await s.ev(`return r.querySelector(${JSON.stringify(B)}).value === '' && r.querySelector('#ag-bklist [data-sys="bk-auto-only"]').getAttribute('aria-pressed') === 'false'`));
  check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}
await browser.close();
done();
