// 1.62.1 (Bildschirmfotos des Nutzers, 2026-11-17): Die Zeilen "Routinen" und "Eigene Töne" im Reiter Anlage zeigen links eine Zusammenfassung
// ("3 Routinen · 3 aktiv", "1 eigener Ton") und rechts zwei Knöpfe. Bis 1.62.0 stand alles in einer Zeile; auf dem Handy schrumpfte der Text auf
// die Breite 0 und lief Wort für Wort unter die Knöpfe. Geprüft wird: der Text steht in einer Zeile und überlappt nie einen Knopf; auf dem Handy
// stehen die Knöpfe unter dem Text, auf dem Desktop daneben; nichts ragt aus der Karte. Je Sprache, Desktop und Handy, dazu zwei schmalere Handys.
import { check, done, launch, open, outDir } from "../lib.mjs";

// Seit 1.64.0 (Wunsch des Nutzers) auch "Codes pro Person" (links "Code hinzufügen", rechts "Codes anzeigen") und "Backup" (links "Backup erstellen",
// rechts "Backups anzeigen"), dasselbe Layout wie die anderen
const ROWS = [["Routinen", '.ag-rtsum:has([data-sys="rt-open"])'], ["Eigene Töne", '.ag-rtsum:has([data-sys="cs-open"])'], ["Codes", '.ag-rtsum:has([data-sys="code-open"])'],
  ["Backup", '.ag-rtsum:has([data-sys="bk-open"])']];
const SHOW = ["rt-open", "cs-open", "code-open", "bk-open"];
const ADD = ["rt-add-page", "cs-upload-page", "code-add-page", "bk-create"];
const SHOT = { Routinen: "routines", "Eigene Töne": "sounds", Codes: "codes", Backup: "backup" };
const MEASURE = `const row=r.querySelector(arg); const card=row.closest('.ag-card').getBoundingClientRect(); const t=row.querySelector('.ag-settx'); const b=t.querySelector('b');
  const tb=t.getBoundingClientRect(); const bt=b.getBoundingClientRect(); const lh=parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.3;
  const btns=[...row.querySelectorAll('.ag-btnrow .ag-btn')].map((x) => x.getBoundingClientRect());
  const hit=(a, c) => a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1;
  return { text: b.textContent.trim(), width: Math.round(tb.width), oneLine: bt.height <= lh * 1.5, fits: b.scrollWidth <= t.clientWidth + 1,
    overlap: btns.some((x) => hit(x, bt) || hit(x, tb)), hint: (() => { const u=t.querySelector('.ag-unsaved'); if (!u) return null; const ub=u.getBoundingClientRect(); return { lines: Math.round(ub.height / (parseFloat(getComputedStyle(u).lineHeight) || 18)), width: Math.round(ub.width) }; })(), below: btns.every((x) => x.top >= tb.bottom - 1), beside: btns.every((x) => x.left >= tb.right - 1 && x.top < tb.bottom),
    inside: btns.every((x) => x.left >= card.left - 1 && x.right <= card.right + 1), big: btns.every((x) => Math.round(x.height) >= 38), n: btns.length }`;

const browser = await launch();
const cases = [["de", false, null], ["de", true, null], ["en", false, null], ["en", true, null], ["de", true, 360], ["de", true, 320]];
for (const [lang, mobile, width] of cases) {
  const tag = `${lang}/${mobile ? `Handy${width ? ` ${width} px` : ""}` : "Desktop"}`;
  const s = await open(browser, { mobile, lang, tab: "config", theme: "dark", query: "&sounds=1" });
  if (width) await s.page.setViewportSize({ width, height: 844 });
  await s.tap('[data-sub="system"]');
  await s.waitFor("return !!r.querySelector('.ag-rtsum [data-sys=\"rt-open\"]') && !!r.querySelector('.ag-rtsum [data-sys=\"cs-open\"]') && !!r.querySelector('.ag-bklast .ag-settx b')");
  await s.page.waitForTimeout(500);
  for (const [name, sel] of ROWS) {
    const m = await s.ev(MEASURE, sel);
    check(`${tag}: ${name}: die Zusammenfassung "${m.text}" steht in einer Zeile und hat Platz`, m.oneLine && m.fits && m.width >= 100, JSON.stringify(m));
    check(`${tag}: ${name}: kein Knopf überdeckt den Text`, !m.overlap, JSON.stringify(m));
    check(`${tag}: ${name}: ${mobile ? "die Knöpfe stehen unter dem Text" : "die Knöpfe stehen rechts neben dem Text"}, in der Karte, gross genug`,
      m.n === 2 && (mobile ? m.below : m.beside) && m.inside && m.big, JSON.stringify(m));
    if (!width) {
      await s.ev(`r.querySelector(arg).scrollIntoView({ block: 'center' }); return 1`, sel);
      await s.page.waitForTimeout(150);
      await (await s.el(sel)).screenshot({ path: `${outDir}sumrow-${SHOT[name]}-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    }
  }
  // Alle vier Zeilen gleich aufgebaut: links "+ … hinzufügen" (dasselbe Plus), rechts "… anzeigen"; jeder Knopf "… anzeigen" mit eigenem Symbol
  // (1.64.0, Wunsch des Nutzers); auf dem Handy sind die beiden Knöpfe einer Zeile gleich breit, wenn sie nebeneinander stehen
  const same = await s.ev(`const icon = (sel) => r.querySelector(sel)?.querySelector('svg')?.innerHTML || '';
    const rows = ${JSON.stringify(ROWS.map((x) => x[1]))}.map((sel) => { const row = r.querySelector(sel); const b = [...row.querySelectorAll('.ag-btnrow > .ag-btn')]; const x = b.map((e) => e.getBoundingClientRect());
      return { first: b[0]?.dataset.sys, last: b[1]?.dataset.sys, h: x.map((e) => Math.round(e.height)), w: x.map((e) => Math.round(e.width)), sideBySide: x.length === 2 && Math.abs(x[0].top - x[1].top) < 2 }; });
    return { rows, plus: ${JSON.stringify(ADD)}.map((a) => icon('[data-sys="' + a + '"]')), show: ${JSON.stringify(SHOW)}.map((a) => icon('[data-sys="' + a + '"]')) }`);
  check(`${tag}: Routinen, Töne, Codes und Backup: links "hinzufügen", rechts "anzeigen", alle Knöpfe gleich hoch`,
    same.rows.every((x, i) => x.first === ADD[i] && x.last === SHOW[i] && x.h.length === 2 && x.h.every((h) => h === same.rows[0].h[0])), JSON.stringify(same.rows));
  check(`${tag}: dasselbe Plus in allen vier "hinzufügen"`, same.plus.every((p) => p && p === same.plus[0]), JSON.stringify(same.plus.map((p) => p.length)));
  check(`${tag}: jeder Knopf "anzeigen" (Routinen, Töne, Codes, Backups) hat ein eigenes Symbol, keines ist das Plus`,
    same.show.every((p) => p) && new Set(same.show).size === 4 && !same.show.includes(same.plus[0]), JSON.stringify(same.show.map((p) => p.slice(0, 40))));
  if (mobile) check(`${tag}: nebeneinander stehende Knöpfe einer Zeile sind gleich breit`, same.rows.every((x) => !x.sideBySide || Math.abs(x.w[0] - x.w[1]) <= 2), JSON.stringify(same.rows));
  // Fenster mit dem Symbol ihres Kapitels im Titel (1.66.2, Wunsch des Nutzers 2026-11-19): dieselbe getönte Kachel wie die Zeile unter
  // Konfiguration › Anlage, etwas grösser (Computer 42 px, Handy 38 px), links vom Titel und mittig dazu; ebenso die Formulare dieser Kapitel
  if (!width) {
    const WINDOWS = [["Routinen", '.ag-rtsum:has([data-sys="rt-open"])', '[data-sys="rt-open"]', "ag-rtlist", '#ag-rtlist [data-sys="rt-add"]'],
      ["Eigene Töne", '.ag-rtsum:has([data-sys="cs-open"])', '[data-sys="cs-open"]', "ag-cslist", null],
      ["Codes", ".ag-codesum", '[data-sys="code-open"]', "ag-codelist", '#ag-codelist [data-sys="code-add"]'],
      ["HealthCheck", ".ag-hcsum", '.ag-hcsum [data-hc="open"]', "ag-hclist", '#ag-hclist [data-hc="add"]'],
      ["Selbsttest", ".ag-stsum", '.ag-stsum [data-st="open"]', "ag-selftest", null],
      ["Backups", ".ag-bklast", '[data-sys="bk-open"]', "ag-bklist", null]];
    const TITLE = `const [rowSel, h]=arg; const row=r.querySelector(rowSel).querySelector('.ag-oav'), t=h.querySelector('.ag-ttl-av');
      if (!t) return { none: true, text: h.textContent };
      const cls=(e) => [...e.classList].filter((c) => c.startsWith('ag-tint-') || ['ok', 'warn', 'err', 'ag-st-av'].includes(c)).sort().join(' ');
      const g=document.createElement('span'); g.className='ag-oav'; r.querySelector('.ag-view').appendChild(g); const grey=getComputedStyle(g).color; g.remove();
      const tb=t.getBoundingClientRect(), sp=h.querySelector(':scope > span:last-child').getBoundingClientRect();
      return { text: h.textContent, same: row.querySelector('svg').innerHTML === t.querySelector('svg').innerHTML, cls: [cls(row), cls(t)], w: Math.round(tb.width), rowW: Math.round(row.getBoundingClientRect().width),
        left: tb.right <= sp.left, mid: Math.abs((tb.top + tb.bottom) / 2 - (sp.top + sp.bottom) / 2) <= 2, colored: cls(t).includes('ag-st-av') || getComputedStyle(t).color !== grey }`;
    const good = (m) => !m.none && m.same && m.cls[0] === m.cls[1] && m.w === (mobile ? 38 : 42) && m.w > m.rowW && m.left && m.mid && m.colored;
    for (const [name, rowSel, openSel, id, addSel] of WINDOWS) {
      await s.ev(`r.querySelector(${JSON.stringify(openSel)}).click(); return 1`);
      await s.waitFor(`return r.getElementById('${id}').open && !!r.querySelector('#${id} .ag-pop-head > h3')`);
      const m = await s.ev(`arg=[arg, r.querySelector('#${id} .ag-pop-head > h3')]; ${TITLE}`, rowSel);
      check(`${tag}: Fenster "${m.text}": im Titel das Symbol der Zeile ${name}, gleich getönt, grösser (${mobile ? 38 : 42} px), links und mittig`, good(m), JSON.stringify(m));
      if (addSel) {
        await s.ev(`r.querySelector(${JSON.stringify(addSel)}).click(); return 1`);
        await s.page.waitForTimeout(400);
        const f = await s.ev(`const d=[...r.querySelectorAll('dialog')].filter((x) => x.open && x.id !== '${id}').pop() || r.getElementById('${id}');
          const hh=d.querySelector('.ag-dlg-body > h3, form > h3'); if (!hh) return { none: true }; arg=[arg, hh]; ${TITLE}`, rowSel);
        check(`${tag}: Formular "${f.text}": dasselbe Symbol im Titel`, good(f), JSON.stringify(f));
      }
      await s.ev("for (const d of r.querySelectorAll('dialog')) if (d.open) d.close(); return 1");
      await s.page.waitForTimeout(200);
    }
    if (!mobile) {
      await s.ev(`r.querySelector('[data-sys="rt-open"]').click(); return 1`);
      await s.waitFor("return r.getElementById('ag-rtlist').open");
      await s.page.waitForTimeout(300);
      await (await s.el("#ag-rtlist .ag-pop-head")).screenshot({ path: `${outDir}sumrow-title-routines-${lang}.png` });
      await s.ev("for (const d of r.querySelectorAll('dialog')) if (d.open) d.close(); return 1");
    }
  }
  // Mit dem Hinweis "noch nicht gespeichert" (Bildschirmfoto des Nutzers): auch er steht neben dem Symbol, nicht unter den Knöpfen
  await s.tap('[data-sys="rt-open"]');
  await s.waitFor("return r.getElementById('ag-rtlist').open");
  await s.ev("r.querySelector('#ag-rtlist .ag-rtrow [data-sys=\"rt-on\"]').click(); return 1");
  if (await s.waitFor("return r.getElementById('ag-confirm').open", 800)) await s.ev("r.querySelector('#ag-confirm [data-c=\"yes\"]').click(); return 1");
  await s.ev("r.querySelector('#ag-rtlist [data-sys=\"rt-close\"]').click(); return 1");
  await s.waitFor("return !r.getElementById('ag-rtlist').open && !!r.querySelector('.ag-rtsum .ag-unsaved')");
  const mu = await s.ev(MEASURE, ROWS[0][1]);
  check(`${tag}: Routinen mit Hinweis "noch nicht gespeichert": nichts überdeckt den Text, der Hinweis hat Platz (höchstens zwei Zeilen)`, !mu.overlap && mu.oneLine && mu.hint && mu.hint.lines <= 2 && mu.hint.width >= 100 && (mobile ? mu.below : mu.beside), JSON.stringify(mu));
  if (!width && mobile) {
    await s.ev(`r.querySelector(arg).scrollIntoView({ block: 'center' }); return 1`, ROWS[0][1]);
    await (await s.el(ROWS[0][1])).screenshot({ path: `${outDir}sumrow-routines-unsaved-${lang}-mobile.png` });
  }
  check(`${tag}: kein seitliches Scrollen`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth + 1 && r.querySelector('.ag-view').scrollWidth <= r.querySelector('.ag-view').clientWidth + 1"));
  // Die Knöpfe wirken weiter: "Routinen anzeigen" öffnet das Fenster
  await s.tap('[data-sys="rt-open"]');
  check(`${tag}: "Routinen anzeigen" öffnet das Fenster`, await s.waitFor("return r.getElementById('ag-rtlist').open"));
  await s.ctx.close();
}
await browser.close();
done();
