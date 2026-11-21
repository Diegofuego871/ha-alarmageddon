// 1.63.0 (Wunsch des Nutzers, 2026-11-17): "Codes pro Person" im Fenster. Die Seite zeigt nur die Zusammenfassung mit "Codes anzeigen", den
// Hauptcode und "Quittieren verlangt den Code". Im Fenster: klebender Kopf mit Suche, Tabelle Name, Benutzer, Bearbeiten, Entfernen (seit 1.66.1
// ohne Spalte "Code", die nur einen Platzhalter zeigte: gespeichert ist ein Hash; Knöpfe rund wie überall); sortierbar nach Name und Benutzer; "Code hinzufügen" in der Fusszeile. Bearbeiten
// öffnet dasselbe Fenster wie Hinzufügen, Name und Benutzer stehen drin, die Codefelder sind leer (leer = bisheriger Code). Das Auge blendet nur
// den getippten Code ein. Warnung bei einfachen Codes (rot, fett, Achtung-Zeichen), Speichern bleibt möglich. Je Sprache, Desktop und Handy,
// dazu ein schmales Handy (320 px).
import { check, done, launch, open, outDir } from "../lib.mjs";

const T = {
  de: { one: "1 Code", many: "5 Codes", none: "Noch keine Codes", title: "Codes pro Person", gone: "Benutzer nicht verfügbar", weak: "Leicht zu erraten", short: "Zu kurz", edit: "Code bearbeiten", add: "Code hinzufügen", keep: "Leer lassen", noMatch: "Kein Code passt", mismatch: "stimmen nicht", taken: "schon vergeben", show: "Code anzeigen", hide: "Code ausblenden" },
  en: { one: "1 code", many: "5 codes", none: "No codes yet", title: "Codes per person", gone: "User not available", weak: "Easy to guess", short: "Too short", edit: "Edit code", add: "Add code", keep: "Leave empty", noMatch: "No code matches", mismatch: "do not match", taken: "already used", show: "Show code", hide: "Hide code" },
};
// Code und erwarteter Grund der Warnung (null: keine Warnung)
const WEAK = [["1234", "sequence"], ["9753", "sequence"], ["0000", "same"], ["1212", "pattern"], ["1122", "pattern"], ["1112", "run"], ["1221", "mirror"], ["2580", "keypad"],
  ["1987", "year"], ["24121990", "date"], ["8395", null], ["52816", null], ["739164", null]];
const EYE_OFF = "M2,5.27L3.28,4L20,20.72";
const ALERT = "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z";
// Weitere Codes im Nachbau: Bert mit Diego, Chiara ohne Benutzer, david mit einem Benutzer, den es nicht mehr gibt, Émile ohne Benutzer
const MORE = `const sys = window.__systems[0]; sys.codes.push({ id: 'c_bert', name: 'Bert', user_id: 'u_diego' }, { id: 'c_chiara', name: 'Chiara', user_id: null },
  { id: 'c_david', name: 'david', user_id: 'u_weg' }, { id: 'c_emile', name: 'Émile', user_id: null }); Object.assign(sys.pcodes, { c_bert: '5791', c_chiara: '8642', c_david: '3197', c_emile: '6420' }); return 1`;
const NAMES = "return [...r.querySelectorAll('#ag-codelist tr[data-code]')].map((x) => x.querySelector('.ag-codename').innerText.trim())";
const USERS = "return [...r.querySelectorAll('#ag-codelist tr[data-code]')].map((x) => x.querySelector('.ag-codeuser').innerText.trim())";

const browser = await launch();
for (const [lang, mobile, width] of [["de", false, null], ["de", true, null], ["en", false, null], ["en", true, null], ["de", true, 320]]) {
  const tag = `${lang}/${mobile ? `Handy${width ? ` ${width} px` : ""}` : "Desktop"}`;
  const t = T[lang];
  const s = await open(browser, { mobile, lang, tab: "config", theme: "dark" });
  if (width) await s.page.setViewportSize({ width, height: 700 });
  const coll = lang === "de" ? "de" : "en";
  const sorted = (list, dir = 1) => [...list].sort((a, b) => a.localeCompare(b, coll, { sensitivity: "base", numeric: true }) * dir);
  const confirmYes = async () => {
    if (await s.waitFor("return r.getElementById('ag-confirm').open", 800)) await s.ev("r.querySelector('#ag-confirm [data-c=\"yes\"]').click(); return 1");
  };
  await s.tap('[data-sub="system"]');
  await s.waitFor("return !!r.querySelector('[data-sys=\"code-open\"]')");

  // ----- Seite: Zusammenfassung mit "Code hinzufügen" und "Codes anzeigen" (seit 1.64.0 wie Routinen und Töne), Hauptcode und Quittieren -----
  const page = await s.ev(`const c=r.querySelector('[data-sys="code-open"]').closest('.ag-chap'); return { summary: c.querySelector('.ag-codesum b').innerText.trim(), add: !!r.querySelector('.ag-content [data-sys="code-add"]'),
    addPage: c.querySelector('.ag-codesum .ag-btnrow > .ag-btn:first-child')?.dataset.sys === 'code-add-page' && c.querySelector('.ag-codesum .ag-btnrow > .ag-btn:last-child')?.dataset.sys === 'code-open',
    addText: c.querySelector('[data-sys="code-add-page"]')?.innerText.trim(),
    rows: c.querySelectorAll('.ag-coderow').length, main: !!c.querySelector('[data-sys="code"]'), ack: !!c.querySelector('[data-sys="ackcode"]'), hint: c.querySelector(':scope > .ag-chap-h')?.innerText.trim() === r.host._t('sysCodesHint'),
    noName: !c.innerText.includes('Anna'), noCode: !c.innerText.includes('2468') }`);
  check(`${tag}: Seite: Zusammenfassung "${t.one}", links "${t.add}", rechts "Codes anzeigen", keine Liste`, page.summary === t.one && !page.add && page.addPage && page.addText === t.add && page.noName && page.noCode, JSON.stringify(page));
  // "Code hinzufügen" auf der Seite öffnet dasselbe Formular wie im Fenster, ohne das Fenster der Liste
  await s.tap('[data-sys="code-add-page"]');
  check(`${tag}: Seite: "${t.add}" öffnet das Formular "${t.add}" direkt (ohne die Liste)`, await s.waitFor(`const d=r.getElementById('ag-codes'); return d.open && d.querySelector('h3')?.innerText.trim() === ${JSON.stringify(t.add)} && !!d.querySelector('[data-sys="code-save"]') && !r.getElementById('ag-codelist').open`));
  await s.tap('#ag-codes [data-sys="code-close"]');
  await s.waitFor("return !r.getElementById('ag-codes').open");
  check(`${tag}: Seite: Hauptcode und "Quittieren verlangt den Code" bleiben, der Hinweis steht über der Karte`, page.rows === 1 && page.main && page.ack && page.hint, JSON.stringify(page));

  // Zeile mit der Zusammenfassung wie bei Routinen und Tönen: Text in einer Zeile, der Knopf überdeckt ihn nie (Handy: darunter, Desktop: daneben)
  const row = await s.ev(`const row=r.querySelector('.ag-codesum'); const card=row.closest('.ag-card').getBoundingClientRect(); const b=row.querySelector('.ag-settx b').getBoundingClientRect();
    const btn=row.querySelector('[data-sys="code-open"]').getBoundingClientRect(); const lh=parseFloat(getComputedStyle(row.querySelector('.ag-settx b')).lineHeight) || 20;
    return { oneLine: b.height <= lh * 1.5, below: btn.top >= b.bottom - 1, beside: btn.left >= b.right - 1, inside: btn.left >= card.left - 1 && btn.right <= card.right + 1, big: Math.round(btn.height) >= 38 }`);
  check(`${tag}: Seite: Zusammenfassung in einer Zeile, "Codes anzeigen" ${mobile ? "darunter" : "daneben"}, in der Karte`, row.oneLine && (mobile ? row.below : row.beside) && row.inside && row.big, JSON.stringify(row));
  await s.sim(MORE);
  await s.ev("return r.host._fetch()");
  check(`${tag}: Seite: Zusammenfassung zählt mit ("${t.many}")`, await s.waitFor(`return r.querySelector('.ag-codesum b').innerText.trim() === ${JSON.stringify(t.many)}`));

  // ----- Fenster: Kopf, Tabelle, Fusszeile -----
  await s.tap('[data-sys="code-open"]');
  check(`${tag}: "Codes anzeigen" öffnet das Fenster`, await s.waitFor("return r.getElementById('ag-codelist').open"));
  const win = await s.ev(`const d=r.getElementById('ag-codelist'); const head=d.querySelector('.ag-dlg-body > .ag-pop-head'); const ths=[...d.querySelectorAll('.ag-codetable tr:first-child th')];
    const foot=[...d.querySelectorAll('.ag-dlg-btns button')]; const b0=d.querySelector('tr[data-code] .ag-wf-btns .ag-iconbtn'); const round={ w: b0 ? Math.round(b0.getBoundingClientRect().width) : 0, border: b0 ? getComputedStyle(b0).borderTopStyle : '' };
    return { title: head?.querySelector('h3')?.innerText.trim(), search: !!head?.querySelector('[data-sys="code-search"]'), sort: ths.map((x) => x.querySelector('[data-sys="code-sort"]')?.dataset.key || ''),
      cols: ths.length, lastTh: ths[ths.length - 1]?.innerText.trim(), rows: d.querySelectorAll('tr[data-code]').length, round, dots: /•/.test(d.innerText), digits: /\\d{4}/.test(d.innerText),
      acts: [...d.querySelectorAll('tr[data-code]')].every((x) => x.querySelector('[data-sys="code-edit"]') && x.querySelector('[data-sys="code-del"]')),
      foot: foot.map((b) => b.dataset.sys + (b.classList.contains('primary') ? '*' : '')).join() }`);
  check(`${tag}: Fenster: Titel "${t.title}" und Suchfeld im klebenden Kopf`, win.title === t.title && win.search, JSON.stringify(win));
  check(`${tag}: Fenster: Spalten Name und Benutzer (sortierbar), dazu nur die Knöpfe; keine Spalte "Code"`, win.sort.join() === "name,user," && win.cols === 3 && win.lastTh === "", JSON.stringify(win));
  check(`${tag}: Fenster: fünf Zeilen, je Stift und Papierkorb in Kreisen (44 px, mit Rand), kein Platzhalter und keine Ziffern im Fenster`, win.rows === 5 && win.acts && win.round.w === 44 && win.round.border === "solid" && !win.dots && !win.digits, JSON.stringify(win));
  check(`${tag}: Fenster: Fusszeile "Schliessen" und "${t.add}" (blau)`, win.foot === "code-list-close,code-add*", win.foot);

  // Darstellung: kein seitliches Scrollen, Handy: ganzer Bildschirm, X oben rechts, Fusszeile unten
  const lay = await s.ev(`const d=r.getElementById('ag-codelist'); const b=d.querySelector('.ag-dlg-body'); const tb=d.querySelector('.ag-codetable').getBoundingClientRect(); const db=d.getBoundingClientRect();
    const x=d.querySelector(':scope > .ag-dlg-x').getBoundingClientRect(); const foot=d.querySelector('.ag-dlg-btns').getBoundingClientRect(); const bb=b.getBoundingClientRect();
    return { wide: b.scrollWidth <= b.clientWidth + 1 && tb.right <= bb.right + 1, full: Math.round(db.width) >= innerWidth - 1 && Math.round(db.height) >= innerHeight - 1,
      x: x.right >= db.right - 30 && x.top <= db.top + 30, foot: foot.bottom >= db.bottom - 2, rowsOk: [...d.querySelectorAll('tr[data-code]')].every((tr) => tr.getBoundingClientRect().height < 90) }`);
  check(`${tag}: Fenster: nichts ragt seitlich hinaus, jede Zeile bleibt niedrig`, lay.wide && lay.rowsOk, JSON.stringify(lay));
  if (mobile) check(`${tag}: Fenster: ganzer Bildschirm, X oben rechts, Fusszeile unten`, lay.full && lay.x && lay.foot, JSON.stringify(lay));
  if (!width) await s.page.screenshot({ path: `${outDir}codes-list-${lang}-${mobile ? "mobile" : "desktop"}.png` });

  // ----- Sortieren -----
  check(`${tag}: Sortierung: zuerst nach Name aufsteigend`, JSON.stringify(await s.ev(NAMES)) === JSON.stringify(sorted(["Anna", "Bert", "Chiara", "david", "Émile"])), JSON.stringify(await s.ev(NAMES)));
  await s.tap('#ag-codelist [data-sys="code-sort"][data-key="name"]');
  check(`${tag}: Sortierung: Name noch einmal: absteigend, Kopf zeigt es an`, JSON.stringify(await s.ev(NAMES)) === JSON.stringify(sorted(["Anna", "Bert", "Chiara", "david", "Émile"], -1))
    && await s.ev("return r.querySelector('#ag-codelist th:has([data-key=\"name\"])').getAttribute('aria-sort') === 'descending'"), JSON.stringify(await s.ev(NAMES)));
  for (const [dir, label] of [[1, "aufsteigend"], [-1, "absteigend"]]) {
    await s.tap('#ag-codelist [data-sys="code-sort"][data-key="user"]');
    const users = await s.ev(USERS);
    const linked = users.filter((u) => u !== "–");
    check(`${tag}: Sortierung nach Benutzer ${label}: verknüpfte Benutzer sortiert, ohne Benutzer immer unten`, linked.length === 3 && JSON.stringify(linked) === JSON.stringify(sorted(linked, dir))
      && users.slice(3).every((u) => u === "–") && linked.includes(t.gone), JSON.stringify(users));
  }

  // ----- Suche -----
  await (await s.el('#ag-codelist [data-sys="code-search"]')).fill("diego");
  check(`${tag}: Suche nach dem Benutzer findet die Person, das Feld behält den Fokus`, await s.waitFor(`${NAMES.replace("return ", "const n=")}; return n.length === 1 && n[0] === 'Bert' && r.activeElement?.dataset.sys === 'code-search'`));
  await (await s.el('#ag-codelist [data-sys="code-search"]')).fill("zzz");
  check(`${tag}: Suche ohne Treffer: Hinweis statt Tabelle`, await s.waitFor(`return !r.querySelector('#ag-codelist .ag-codetable') && r.querySelector('#ag-codelist .ag-codebody').innerText.includes(${JSON.stringify(t.noMatch)})`));
  await s.tap('#ag-codelist [data-sys="code-search-clear"]');
  check(`${tag}: Suche leeren zeigt wieder alle`, await s.waitFor("return r.querySelectorAll('#ag-codelist tr[data-code]').length === 5"));
  await s.tap('#ag-codelist [data-sys="code-sort"][data-key="name"]');

  // ----- Bearbeiten: Name und Benutzer drin, Codefelder leer, leer = bisheriger Code -----
  await s.tap('#ag-codelist [data-sys="code-edit"][data-id="c_bert"]');
  check(`${tag}: Stift öffnet "${t.edit}" über der Liste`, await s.waitFor("return r.getElementById('ag-codes').open && r.getElementById('ag-codelist').open"));
  // Breite (1.67.0, Wunsch des Nutzers 2026-11-19): das Formular so breit wie die Liste dahinter (Standardbreite aller Fenster); Handy: ganzer Bildschirm
  const widths = await s.ev("const w=(id) => Math.round(r.getElementById(id).getBoundingClientRect().width); return { form: w('ag-codes'), list: w('ag-codelist'), vw: innerWidth }");
  check(`${tag}: "${t.edit}" so breit wie die Liste${mobile ? " (ganzer Bildschirm)" : ""}`, widths.form === widths.list && (!mobile || widths.form === widths.vw), JSON.stringify(widths));
  const form = await s.ev(`const d=r.getElementById('ag-codes'); const v=(k) => d.querySelector('[data-key="' + k + '"]'); return { title: d.querySelector('h3').innerText.trim(), user: v('user_id').value, name: v('name').value,
    code: v('code').value, code2: v('code2').value, types: [v('code').type, v('code2').type].join(), keep: d.innerText.includes(${JSON.stringify(t.keep)}), dirty: r.host._dlgDirty(d),
    other: [...v('user_id').options].some((o) => o.value === 'u_anna') }`);
  check(`${tag}: Bearbeiten: Titel, Name und Benutzer stehen drin, beide Codefelder leer und verdeckt, Hinweis "leer lassen"`, form.title === t.edit && form.user === "u_diego" && form.name === "Bert" && form.code === "" && form.code2 === "" && form.types === "password,password" && form.keep, JSON.stringify(form));
  check(`${tag}: Bearbeiten: unverändert gilt nicht als Änderung; der Benutzer einer anderen Person ist nicht wählbar`, form.dirty === false && !form.other, JSON.stringify(form));
  await (await s.el('#ag-codes [data-key="name"]')).fill("Bert B.");
  await s.tap('#ag-codes [data-sys="code-save"]');
  check(`${tag}: Bearbeiten ohne Code: gespeichert, die Liste zeigt den neuen Namen`, await s.waitFor("return !r.getElementById('ag-codes').open && r.getElementById('ag-codelist').open && [...r.querySelectorAll('#ag-codelist .ag-codename')].some((x) => x.innerText.trim() === 'Bert B.')"));
  const upd = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/update_code').at(-1)");
  check(`${tag}: update_code ohne Code gesendet (bisheriger Code bleibt)`, upd?.code_id === "c_bert" && upd.name === "Bert B." && upd.user_id === "u_diego" && !("code" in upd), JSON.stringify(upd));
  check(`${tag}: im Nachbau gilt Berts Code weiter`, await s.sim("return window.__systems[0].pcodes.c_bert === '5791'"));

  // Neuer Code; Fehler: ungleich, vergeben
  await s.tap('#ag-codelist [data-sys="code-edit"][data-id="c_chiara"]');
  await s.waitFor("return r.getElementById('ag-codes').open");
  check(`${tag}: Bearbeiten ohne Benutzer: "Keiner" gewählt`, await s.ev("return r.querySelector('#ag-codes [data-key=\"user_id\"]').value === ''"));
  await (await s.el('#ag-codes [data-key="code"]')).fill("8395");
  await s.tap('#ag-codes [data-sys="code-save"]');
  check(`${tag}: Bearbeiten: nur ein Codefeld ausgefüllt meldet "ungleich"`, await s.waitFor(`return r.querySelector('#ag-codes .ag-dlg-err').textContent.includes(${JSON.stringify(t.mismatch)})`));
  await (await s.el('#ag-codes [data-key="code"]')).fill("2468");
  await (await s.el('#ag-codes [data-key="code2"]')).fill("2468");
  await s.tap('#ag-codes [data-sys="code-save"]');
  check(`${tag}: Bearbeiten: Code einer anderen Person abgelehnt`, await s.waitFor(`return r.querySelector('#ag-codes .ag-dlg-err').textContent.includes(${JSON.stringify(t.taken)})`));
  await (await s.el('#ag-codes [data-key="code"]')).fill("8395");
  await (await s.el('#ag-codes [data-key="code2"]')).fill("8395");
  await s.tap('#ag-codes [data-sys="code-save"]');
  check(`${tag}: Bearbeiten mit neuem Code gespeichert`, await s.waitFor("return !r.getElementById('ag-codes').open"));
  const upd2 = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/update_code').at(-1)");
  check(`${tag}: update_code mit dem neuen Code gesendet`, upd2?.code_id === "c_chiara" && upd2.code === "8395" && upd2.user_id === null, JSON.stringify(upd2));

  // Benutzer, den es nicht mehr gibt: bleibt gewählt (sonst löste ihn jedes Speichern)
  await s.tap('#ag-codelist [data-sys="code-edit"][data-id="c_david"]');
  await s.waitFor("return r.getElementById('ag-codes').open");
  check(`${tag}: Bearbeiten: verknüpfter Benutzer, den es nicht mehr gibt, bleibt gewählt ("${t.gone}")`, await s.ev(`const sel=r.querySelector('#ag-codes [data-key="user_id"]'); return sel.value === 'u_weg' && sel.selectedOptions[0].textContent === ${JSON.stringify(t.gone)}`));
  await s.tap('#ag-codes [data-sys="code-close"]');
  await s.waitFor("return !r.getElementById('ag-codes').open");

  // ----- Hinzufügen: Auge und Warnung -----
  await s.tap('#ag-codelist [data-sys="code-add"]');
  check(`${tag}: "${t.add}" öffnet das leere Fenster über der Liste`, await s.waitFor(`const d=r.getElementById('ag-codes'); return d.open && d.querySelector('h3').innerText.trim() === ${JSON.stringify(t.add)} && d.querySelector('[data-key="name"]').value === '' && !d.innerText.includes(${JSON.stringify(t.keep)})`));
  // 1.73.0: der Fokus liegt gleich im Feld Name, das Fenster steht dabei oben (kein Runterscrollen, der Titel bleibt sichtbar)
  check(`${tag}: Fokus im Feld Name, Fenster ohne Scrollen (Titel sichtbar)`, await s.ev(`const d=r.getElementById('ag-codes'); const n=d.querySelector('[data-key=name]'); const t=d.querySelector('h3'); const tr=t.getBoundingClientRect(); return r.activeElement === n && d.scrollTop === 0 && tr.top >= d.getBoundingClientRect().top - 1 && tr.bottom > 0`));
  // 1.73.0: Benutzer, Name und Code sind Kapitel (fetter Titel mit Strich davor), nicht mehr kleine Beschriftungen
  check(`${tag}: Fenster in drei Kapiteln (Benutzer, Name, Code) mit Strich vor dem Titel`, await s.ev(`const d=r.getElementById('ag-codes'); const ts=[...d.querySelectorAll('.ag-chap > h3.ag-chap-t')]; return ts.length === 3 && !d.querySelector('label.ag-label, span.ag-label') && ts.every((h) => getComputedStyle(h, '::before').width === '4px' && parseInt(getComputedStyle(h).fontWeight) >= 600)`));
  // Auge: blendet den getippten Code ein und wieder aus
  await (await s.el('#ag-codes [data-key="code"]')).fill("4718");
  const eye = '#ag-codes .ag-pwfld:has([data-key="code"]) [data-sys="code-eye"]';
  const eyeState = `const b=r.querySelector(${JSON.stringify(eye)}); const i=r.querySelector('#ag-codes [data-key="code"]'); return { type: i.type, value: i.value, pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), off: (b.querySelector('path')?.getAttribute('d') || '').startsWith(${JSON.stringify(EYE_OFF)}), other: r.querySelector('#ag-codes [data-key="code2"]').type }`;
  const e0 = await s.ev(eyeState);
  check(`${tag}: Auge: zuerst verdeckt, Knopf "${t.show}"`, e0.type === "password" && e0.pressed === "false" && e0.label === t.show && !e0.off, JSON.stringify(e0));
  await s.tap(eye);
  const e1 = await s.ev(eyeState);
  check(`${tag}: Auge: ein Druck zeigt den getippten Code (nur dieses Feld), Knopf "${t.hide}" mit durchgestrichenem Auge`, e1.type === "text" && e1.value === "4718" && e1.pressed === "true" && e1.label === t.hide && e1.off && e1.other === "password", JSON.stringify(e1));
  if (!width) await (await s.el("#ag-codes")).screenshot({ path: `${outDir}codes-eye-${lang}-${mobile ? "mobile" : "desktop"}.png` });
  await s.tap(eye);
  check(`${tag}: Auge: ein zweiter Druck verdeckt ihn wieder`, (await s.ev(eyeState)).type === "password");
  // Warnungen: rot, fett, Achtung-Zeichen, unter den Codefeldern
  const warnState = `const w=r.querySelector('#ag-codes .ag-codewarn'); const c2=r.querySelector('#ag-codes [data-key="code2"]').getBoundingClientRect(); const cs=getComputedStyle(w);
    const probe=document.createElement('i'); probe.style.color='var(--ag-error)'; r.appendChild(probe); const red=getComputedStyle(probe).color; probe.remove();
    return { shown: !w.hidden && w.getBoundingClientRect().height > 0, text: w.innerText.trim(), red: cs.color === red, bold: Number(cs.fontWeight) >= 700, icon: w.querySelector('svg path')?.getAttribute('d') === ${JSON.stringify(ALERT)}, below: w.getBoundingClientRect().top >= c2.bottom - 1 }`;
  for (const [code, kind] of WEAK) {
    await (await s.el('#ag-codes [data-key="code"]')).fill(code);
    const w = await s.ev(warnState);
    if (kind) {
      const reason = await s.ev(`return r.host._t('codeWeak_${kind}')`);
      check(`${tag}: Warnung bei ${code}: "${reason}", rot, fett, Achtung-Zeichen, unter den Codefeldern`, w.shown && w.text.startsWith(t.weak) && w.text.includes(reason) && w.red && w.bold && w.icon && w.below, JSON.stringify(w));
    } else check(`${tag}: keine Warnung bei ${code}`, !w.shown, JSON.stringify(w));
  }
  await (await s.el('#ag-codes [data-key="code"]')).fill("123");
  check(`${tag}: "zu kurz" nicht während des Tippens`, !(await s.ev(warnState)).shown);
  await (await s.el('#ag-codes [data-key="name"]')).focus();
  check(`${tag}: "zu kurz" nach dem Verlassen des Felds`, await s.waitFor(`return !r.querySelector('#ag-codes .ag-codewarn').hidden && r.querySelector('#ag-codes .ag-codewarn').innerText.includes(${JSON.stringify(t.short)})`));
  // Speichern bleibt mit einem einfachen Code möglich
  await (await s.el('#ag-codes [data-key="user_id"]')).selectOption("u_gast");
  await (await s.el('#ag-codes [data-key="code"]')).fill("1357");
  await (await s.el('#ag-codes [data-key="code2"]')).fill("1357");
  check(`${tag}: Warnung bei 1357 (Zahlenfolge), "Speichern" frei`, (await s.ev(warnState)).shown && await s.ev("return !r.querySelector('#ag-codes [data-sys=\"code-save\"]').disabled"));
  if (!width) await (await s.el("#ag-codes")).screenshot({ path: `${outDir}codes-warn-${lang}-${mobile ? "mobile" : "desktop"}.png` });
  if (mobile) {
    const full = await s.ev("const d=r.getElementById('ag-codes').getBoundingClientRect(); const f=r.querySelector('#ag-codes .ag-dlg-btns').getBoundingClientRect(); return { full: Math.round(d.width) >= innerWidth - 1 && Math.round(d.height) >= innerHeight - 1, foot: f.bottom >= d.bottom - 2, wide: r.querySelector('#ag-codes .ag-dlg-body').scrollWidth <= r.querySelector('#ag-codes .ag-dlg-body').clientWidth + 1 }");
    check(`${tag}: Fenster "Code hinzufügen": ganzer Bildschirm, Fusszeile unten, nichts ragt hinaus`, full.full && full.foot && full.wide, JSON.stringify(full));
  }
  await s.tap('#ag-codes [data-sys="code-save"]');
  check(`${tag}: einfacher Code trotzdem gespeichert, die Liste zeigt die Person`, await s.waitFor("return !r.getElementById('ag-codes').open && [...r.querySelectorAll('#ag-codelist .ag-codename')].some((x) => x.innerText.trim() === 'Gast')"));
  const added = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/add_code').at(-1)");
  check(`${tag}: add_code mit dem einfachen Code gesendet`, added?.code === "1357" && added.name === "Gast" && added.user_id === "u_gast", JSON.stringify(added));

  // Eingeblendeter Code: nach dem Schliessen wieder verdeckt und leer
  await s.tap('#ag-codelist [data-sys="code-add"]');
  await s.waitFor("return r.getElementById('ag-codes').open");
  await (await s.el('#ag-codes [data-key="code"]')).fill("4718");
  await s.tap(eye);
  await s.tap('#ag-codes [data-sys="code-close"]');
  await confirmYes();
  check(`${tag}: Abbrechen mit eingeblendetem Code: Fenster zu, beide Felder wieder verdeckt und leer`, await s.waitFor("const d=r.getElementById('ag-codes'); const i=[...d.querySelectorAll('[data-secret]')]; return !d.open && i.length === 2 && i.every((x) => x.type === 'password' && x.value === '')"));

  // ----- Höchstzahl, leere Liste -----
  await s.sim("const sys = window.__systems[0]; while (sys.codes.length < 20) { const id = 'c_x' + sys.codes.length; sys.codes.push({ id, name: 'Person ' + sys.codes.length, user_id: null }); } return 1");
  await s.ev("return r.host._fetch()");
  check(`${tag}: 20 Codes: "${t.add}" gesperrt (im Fenster und auf der Seite)`, await s.waitFor("return r.querySelectorAll('#ag-codelist tr[data-code]').length === 20 && r.querySelector('#ag-codelist [data-sys=\"code-add\"]').disabled && r.querySelector('.ag-content [data-sys=\"code-add-page\"]').disabled"));
  await s.sim("const sys = window.__systems[0]; sys.codes = []; sys.pcodes = {}; return 1");
  await s.ev("return r.host._fetch()");
  check(`${tag}: ohne Codes: Hinweis mit blauem Knopf in der Mitte, kein Suchfeld, Fusszeile nur "Schliessen"`, await s.waitFor("const d=r.getElementById('ag-codelist'); return !d.querySelector('.ag-codetable') && !!d.querySelector('.ag-rtempty [data-sys=\"code-add\"].primary') && !d.querySelector('[data-sys=\"code-search\"]') && [...d.querySelectorAll('.ag-dlg-btns button')].map((b) => b.dataset.sys).join() === 'code-list-close'"));
  await s.tap('#ag-codelist [data-sys="code-list-close"]');
  check(`${tag}: Seite ohne Codes: "${t.none}"`, await s.waitFor(`return !r.getElementById('ag-codelist').open && r.querySelector('.ag-codesum b').innerText.trim() === ${JSON.stringify(t.none)}`));
  if (!width) {
    await s.ev("r.querySelector('.ag-codesum').scrollIntoView({ block: 'center' }); return 1");
    await (await s.el('.ag-chap:has([data-sys="code-open"])')).screenshot({ path: `${outDir}codes-page-${lang}-${mobile ? "mobile" : "desktop"}.png` });
  }
  check(`${tag}: keine Fehler in der Konsole`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}
await browser.close();
done();
