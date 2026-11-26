// Symbole im Einrichtungsassistenten (1.91.0, Wunsch des Nutzers 2026-11-25 mit Bildschirmfotos des Schritts "Meldungen" auf dem Handy: "beim Wizard
// überall auch noch das gleiche Icon einsetzen", ein Symbol für "Kommen die Meldungen an?", "in dem gleichen Stil, mit den gleichen Icons, wie es dann
// auch in den Einstellungen gibt", "zuerst das Icon, dann der Schalter, dann der Text"). Jede Zeile der Karten des Assistenten (ausser den eingebetteten
// Ansichten der Reiter, die ihre eigenen Prüfungen haben) beginnt mit der Kachel; Meldungen und Empfänger tragen dieselben Symbole und Farben wie unter
// Konfiguration › Benachrichtigungen. Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const J = JSON.stringify;
// Wie icons-e2e: Kachel ganz links und oben, Schalter (oder das Schloss der Alarmmeldung) danach und mittig auf der Kachel, Text rechts davon
const GEO = `const out = { n: 0, bad: [], none: [] };
  // Eingebettete Ansichten (Zuordnung, Aktionen, Regeln der Überwachung) liegen im Platz .ag-wz-slot und haben eigene Prüfungen; sonst zeichnet der
  // Assistent seinen eigenen Inhalt dorthin
  const embedded = ['zones', 'actions', 'monitor'].includes(r.host.wizard.step);
  const rows = [...r.querySelectorAll('.ag-wz .ag-card .ag-setrow, .ag-wz .ag-card .ag-orow')].filter((x) => !(embedded && x.closest('.ag-wz-slot')) && !x.classList.contains('ag-wz-monsensors') && x.getBoundingClientRect().width);
  for (const row of rows) {
    const o = row.querySelector(':scope > .ag-oav');
    const name = (row.querySelector('.ag-settx, .ag-otx')?.textContent || row.textContent).trim().slice(0, 30);
    if (!o) { out.none.push(name); continue; }
    out.n++;
    const q = o.getBoundingClientRect();
    const kids = [...row.children].filter((c) => c !== o && c.getBoundingClientRect().width);
    const sw = row.querySelector(':scope > .ag-toggle, :scope > .ag-wz-lock');
    const tx = row.querySelector(':scope > .ag-settx, :scope > .ag-otx');
    if (!tx) { out.bad.push([name, 'kein Text']); continue; }
    const t = tx.getBoundingClientRect();
    if (kids.some((c) => { const b = c.getBoundingClientRect(); return b.top < q.bottom && b.bottom > q.top && b.left < q.right - 0.5; })) out.bad.push([name, 'Kachel nicht ganz links']);
    if (q.top > t.top + 2) out.bad.push([name, 'Kachel unter dem Textanfang']);
    if (t.height > q.height * 1.5 && Math.abs(q.top - t.top) > 4) out.bad.push([name, 'Kachel nicht oben']);
    if (sw) {
      const g = sw.getBoundingClientRect();
      if (g.left < q.right) out.bad.push([name, 'Schalter vor der Kachel']);
      if (t.left < g.right) out.bad.push([name, 'Text vor dem Schalter']);
      const icon = sw.classList.contains('ag-wz-lock') ? sw.querySelector('svg').getBoundingClientRect() : g;
      if (Math.abs((icon.top + icon.bottom) / 2 - (q.top + q.bottom) / 2) > 2) out.bad.push([name, 'Schalter nicht mittig auf der Kachel', Math.round(icon.top), Math.round(q.top)]);
    }
  }
  return out;`;
const SVG = (sel) => `return Object.fromEntries([...r.querySelectorAll(${J(sel)})].map((x) => [x.dataset.kind || x.dataset.ntk, x.querySelector('.ag-oav svg, .ag-ntk-icon svg')?.innerHTML || '']))`;

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const step = async (name, query = "") => {
      const s = await open(browser, { mobile, lang, query: `&wizard=open&wzstep=${name}${query}` });
      await s.waitFor(`return r.host.wizard.active && r.host.wizard.step === ${J(name)} && !!r.querySelector('.ag-wz .ag-card')`, 10000);
      await s.page.waitForTimeout(500);
      return s;
    };
    const geo = async (s, where, min) => {
      const g = await s.ev(GEO);
      check(`${tag}: ${where}: jede Zeile mit Kachel (${g.n}), Kachel oben links, Schalter danach, Text rechts`, g.n >= min && g.none.length === 0 && g.bad.length === 0, J({ n: g.n, none: g.none, bad: g.bad.slice(0, 4) }));
    };

    // ----- Modi, Code: schon seit 1.90.0 so, bleiben so -----
    for (const [name, min] of [["modes", 4], ["code", 2]]) {
      const s = await step(name);
      await geo(s, name, min);
      check(`${tag}: ${name}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }

    // ----- Zuordnung und Eingang: auf dem Handy je Sensor das Symbol seiner Art, blau beim Eingang -----
    {
      const s = await step("zones");
      await s.waitFor("return !!r.querySelector('.ag-wz-post .ag-setrow')", 8000);
      await geo(s, "zones", mobile ? 4 : 2);
      if (mobile) {
        const entry = await s.ev("return [...r.querySelectorAll('.ag-wz-entry')].map((x) => ({ on: x.querySelector('.ag-toggle').classList.contains('on'), icon: x.querySelector(':scope > .ag-oav')?.classList.contains('on') ?? null, svg: !!x.querySelector(':scope > .ag-oav svg') }))");
        check(`${tag}: Eingang: jede Zeile mit Symbol, blau genau beim Eingang`, entry.length >= 3 && entry.every((e) => e.svg && e.icon === e.on) && entry.some((e) => e.on), J(entry));
      }
      check(`${tag}: zones: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }

    // ----- Meldungen: Empfänger, Meldungen und Test mit Symbol; Symbole und Farben wie unter Benachrichtigungen -----
    const set = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "notify" } });
    await set.waitFor("return r.querySelectorAll('.ag-ntk').length >= 8", 8000);
    const setIcons = await set.ev(SVG(".ag-ntk[data-ntk]"));
    check(`${tag}: Standard-Empfänger in den Einstellungen: Symbole rot (Alarme) und orange (Wartung)`, await set.ev("const k=[...r.querySelectorAll('.ag-nt .ag-recip')].map((x) => x.querySelector(':scope > .ag-oav')); return k.length === 2 && k[0].classList.contains('fault') && k[1].classList.contains('maint')"));
    const setRecip = await set.ev("return [...r.querySelectorAll('.ag-nt .ag-recip')].map((x) => x.querySelector(':scope > .ag-oav svg')?.innerHTML || '')");
    const setTone = await set.ev("const m = {}; for (const c of r.querySelectorAll('.ag-ntk[data-ntk]:not(.off)')) m[c.dataset.ntk] = getComputedStyle(c.querySelector('.ag-ntk-icon')).color; return m");
    await set.ctx.close();
    {
      const s = await step("notify");
      await geo(s, "notify", 12);
      const wz = await s.ev(SVG(".ag-wz-kind[data-kind]"));
      const kinds = Object.keys(setIcons);
      check(`${tag}: Meldungen: dieselben Symbole wie unter Benachrichtigungen (${kinds.length})`, kinds.length === 8 && kinds.every((k) => wz[k] && wz[k] === setIcons[k]), J({ missing: kinds.filter((k) => wz[k] !== setIcons[k]) }));
      const tone = await s.ev("const m = {}; for (const x of r.querySelectorAll('.ag-wz-kind[data-kind]:not(.off)')) m[x.dataset.kind] = getComputedStyle(x.querySelector(':scope > .ag-oav')).color; return m");
      check(`${tag}: Meldungen: Farbe der Kachel wie die Karte (Störung rot, Wartung orange)`, Object.keys(setTone).length === 8 && Object.keys(setTone).every((k) => tone[k] === setTone[k]), J({ tone, setTone }));
      const recip = await s.ev("return [...r.querySelectorAll('.ag-wz .ag-recip')].map((x) => x.querySelector(':scope > .ag-oav svg')?.innerHTML || '')");
      check(`${tag}: Empfänger: Symbole in der Farbe der Meldungen (Alarme rot, Wartung orange)`, await s.ev("const k=[...r.querySelectorAll('.ag-wz .ag-recip')].map((x) => x.querySelector(':scope > .ag-oav')); return k.length === 2 && k[0].classList.contains('ag-ntone') && k[0].classList.contains('fault') && k[1].classList.contains('maint')"));
      check(`${tag}: Empfänger: Glocke und Zahnrad wie unter Benachrichtigungen`, recip.length === 2 && J(recip) === J(setRecip), J({ recip: recip.map(Boolean), same: J(recip) === J(setRecip) }));
      const alarm = await s.ev("const x=r.querySelector('.ag-wz-kind[data-kind=\"triggered\"]'); return x ? { icon: !!x.querySelector(':scope > .ag-oav.on svg'), lock: !!x.querySelector(':scope > .ag-wz-lock svg'), toggle: !!x.querySelector('.ag-toggle') } : null");
      check(`${tag}: Alarmmeldung: Symbol, an der Stelle des Schalters das Schloss`, alarm && alarm.icon && alarm.lock && !alarm.toggle, J(alarm));
      const test = await s.ev("const x=r.querySelector('.ag-wz-testrow'); return x ? { icon: !!x.querySelector(':scope > .ag-oav svg'), btns: x.querySelectorAll('[data-wz=\"nt-test\"]').length } : null");
      check(`${tag}: "Kommen die Meldungen an?" mit Symbol und beiden Testknöpfen`, test && test.icon && test.btns === 2, J(test));
      // Ausschalten: die Kachel wird grau, wieder ein: Farbe zurück
      await s.tap('.ag-wz-kind[data-kind="battery_low"] [data-wz="kind"]');
      const off = await s.ev("const x=r.querySelector('.ag-wz-kind[data-kind=\"battery_low\"]'); return { off: x.classList.contains('off'), on: x.querySelector(':scope > .ag-oav').classList.contains('on') }");
      check(`${tag}: Meldung aus: Kachel grau`, off.off && !off.on, J(off));
      await s.tap('.ag-wz-kind[data-kind="battery_low"] [data-wz="kind"]');
      check(`${tag}: Meldung wieder an: Kachel in ihrer Farbe`, await s.ev("return r.querySelector('.ag-wz-kind[data-kind=\"battery_low\"] > .ag-oav').classList.contains('on')"));
      check(`${tag}: notify: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }

    // ----- Überwachung: "Überwachung verwenden" mit Auge, "Messwerte" mit Symbol (auch leer, dann ohne zweites Symbol im Rahmen) -----
    {
      const s = await step("monitor");
      await s.waitFor("return !!r.host.wizard.measures", 10000);
      if (!(await s.ev("return r.querySelector('[data-wz=\"mon-use\"]').classList.contains('on')"))) await s.tap('[data-wz="mon-use"]');
      await s.waitFor("return !!r.querySelector('.ag-wz-mempty') && !r.host.wizard.busy", 15000);
      await geo(s, "monitor", 1);
      const use = await s.ev("const x=r.querySelector('[data-wz=\"mon-use\"]').closest('.ag-setrow'); return { icon: !!x.querySelector(':scope > .ag-oav.on svg') }");
      check(`${tag}: "Überwachung verwenden": Auge, blau wie der Schalter`, use.icon, J(use));
      const empty = await s.ev("const t=r.querySelector('.ag-wz-mtitle'); const o=t?.querySelector(':scope > .ag-oav'); const x=t?.querySelector('.ag-settx'); return { icon: !!o?.querySelector('svg'), left: o && x ? x.getBoundingClientRect().left > o.getBoundingClientRect().right : false, twice: !!r.querySelector('.ag-wz-mempty > svg') }");
      check(`${tag}: leere Messwerte: Titel mit Symbol links, im Rahmen kein zweites`, empty.icon && empty.left && !empty.twice, J(empty));
      check(`${tag}: monitor: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }

    // ----- Fertig: Zusammenfassung, Ausprobieren und "Konfiguration öffnen" mit Symbol -----
    {
      const s = await step("done");
      await geo(s, "done", 11);
      check(`${tag}: done: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }
  }
}
await browser.close();
done();
