// 1.31.0: Alarmanlage im Panel hinzufügen: Knopf in der Kopfzeile (Desktop mit Text, Handy nur das runde Plus), eigener Dialog mit
// Erklärung, Namensfeld und Vorschau der Identität. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { title: "Alarmanlage hinzufügen", btn: "Anlage hinzufügen", hint: "Gib einen Namen ein", taken: "bereits vergeben", create: "Hinzufügen", cancel: "Abbrechen", device: "Gerät", entity: "Alarm-Entität", copy: "Alarm-Entität kopieren" },
  en: { title: "Add alarm system", btn: "Add alarm system", hint: "Enter a name", taken: "already used", create: "Add", cancel: "Cancel", device: "Device", entity: "Alarm entity", copy: "Copy Alarm entity" },
};

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang });
    await s.page.waitForTimeout(300);

    // ----- Knopf in der Kopfzeile -----
    check(`${tag}: Knopf zum Hinzufügen neben "Integration in HA öffnen"`, await s.ev("const a=r.querySelector('.ag-headsys [data-act=\"add\"]'); const h=r.querySelector('.ag-headsys [data-act=\"open-ha\"]'); return !!a && !!h && a.getBoundingClientRect().right <= h.getBoundingClientRect().left + 1"));
    if (mobile) {
      check(`${tag}: Handy: nur ein rundes Plus, gleich gross und gleich geformt wie der Knopf zu Home Assistant, ohne Text`, await s.ev("const a=r.querySelector('.ag-headsys [data-act=\"add\"]').getBoundingClientRect(); const h=r.querySelector('.ag-headsys [data-act=\"open-ha\"]').getBoundingClientRect(); return Math.abs(a.width - h.width) < 1 && Math.abs(a.height - h.height) < 1 && Math.abs(a.width - a.height) <= 3 && r.querySelector('.ag-headsys [data-act=\"add\"]').innerText.trim() === ''"));
      check(`${tag}: Handy: beide Knöpfe liegen im Bild`, await s.ev("const w=r.host.getBoundingClientRect().width; return [...r.querySelectorAll('.ag-headsys [data-act=\"add\"], .ag-headsys [data-act=\"open-ha\"]')].every((b) => { const q=b.getBoundingClientRect(); return q.left >= 0 && q.right <= w + 1; })"));
    } else {
      check(`${tag}: Desktop: Knopf mit Plus und Text "${t.btn}"`, await s.ev(`const a=r.querySelector('.ag-headsys [data-act="add"]'); return a.innerText.includes(${JSON.stringify(t.btn)}) && !!a.querySelector('svg')`));
    }
    check(`${tag}: Knopf trägt eine Beschriftung für Screenreader und Tooltip`, await s.ev(`const a=r.querySelector('.ag-headsys [data-act="add"]'); return a.getAttribute('aria-label') === ${JSON.stringify(t.btn)} && a.title === ${JSON.stringify(t.btn)}`));

    // ----- Dialog -----
    await s.tap('.ag-headsys [data-act="add"]');
    check(`${tag}: Dialog "${t.title}" mit Erklärung, Namensfeld im Fokus, Hinzufügen gesperrt`, await s.waitFor(`const d=r.getElementById('ag-add'); const i=d.querySelector('#ag-add-input'); return d.open && d.innerText.includes(${JSON.stringify(t.title)}) && d.querySelectorAll('.ag-t2').length > 0 && r.activeElement === i && d.querySelector('button[type=submit]').disabled && d.innerText.includes(${JSON.stringify(t.hint)})`));
    check(`${tag}: kein Wechsel zu Home Assistant (es bleibt im Panel)`, await s.sim("return !window.__navigated || window.__navigated.length === 0").catch(() => true));
    if (mobile) check(`${tag}: Handy: Dialog liegt ganz im Bild, Knöpfe sichtbar`, await s.ev("const d=r.getElementById('ag-add').getBoundingClientRect(); const b=[...r.getElementById('ag-add').querySelectorAll('.ag-dlg-btns button')].map((x) => x.getBoundingClientRect()); const w=r.host.getBoundingClientRect(); return d.left >= 0 && d.right <= w.width + 1 && d.bottom <= window.innerHeight + 1 && b.length === 2 && b.every((q) => q.height >= 38 && q.bottom <= window.innerHeight)"));

    // Vorschau: Umlaute, Entitäts-ID, Hinzufügen frei
    const input = await s.el("#ag-add-input");
    await input.fill("Küche Süd");
    check(`${tag}: Vorschau zeigt Gerät und die ID, die der Server vergibt (alarm_control_panel.kuche_sud)`, await s.waitFor(`const p=r.getElementById('ag-addprev').innerText; return p.includes('alarm_control_panel.kuche_sud') && p.includes('Küche Süd') && p.includes(${JSON.stringify(t.device)}) && p.includes(${JSON.stringify(t.entity)}) && !r.getElementById('ag-add').querySelector('button[type=submit]').disabled`));
    // Kopieren der Alarm-Entität (1.64.0, Wunsch des Nutzers): ein Knopf direkt hinter der ID, nur dort; kopiert wird die ganze ID, das Fenster bleibt
    // offen, nichts wird angelegt, Name und "Hinzufügen" bleiben, wie sie sind
    check(`${tag}: Kopieren-Knopf direkt hinter der Alarm-Entität ("${t.copy}"), auf derselben Zeile, im Fenster, nur einer`, await s.ev(`const d=r.getElementById('ag-add'); const bs=[...d.querySelectorAll('#ag-addprev [data-act="copy"]')]; if (bs.length !== 1) return false;
      const b=bs[0]; const id=b.closest('.ag-addval')?.querySelector('b'); if (!id || id.textContent !== 'alarm_control_panel.kuche_sud') return false; const q=b.getBoundingClientRect(); const w=id.getBoundingClientRect(); const dl=d.getBoundingClientRect();
      return b.dataset.value === 'alarm_control_panel.kuche_sud' && b.type === 'button' && b.getAttribute('aria-label') === ${JSON.stringify(t.copy)} && b.title === ${JSON.stringify(t.copy)} && q.left >= w.right - 1 && q.left - w.right <= 12
        && q.top < w.bottom && q.bottom > w.top && q.right <= dl.right - 8 && q.width >= 30 && q.height >= 30`));
    await s.ev("window.__copied = []; Object.defineProperty(r.host.ownerDocument.defaultView.navigator, 'clipboard', { configurable: true, value: { writeText: (v) => { window.__copied.push(v); return Promise.resolve(); } } }); return 1");
    await s.tap('#ag-addprev [data-act="copy"]');
    check(`${tag}: Kopieren legt die ganze ID in die Zwischenablage, Häkchen am Knopf; Fenster offen, nichts angelegt, Name und Knopf "${t.create}" unverändert`, await s.waitFor(`const d=r.getElementById('ag-add'); const b=d.querySelector('#ag-addprev [data-act="copy"]');
      return JSON.stringify(window.__copied) === '["alarm_control_panel.kuche_sud"]' && b.classList.contains('done') && d.open && d.querySelector('#ag-add-input').value === 'Küche Süd' && !d.querySelector('button[type=submit]').disabled`)
      && (await s.sim("return (window.__created || []).length === 0")));
    check(`${tag}: nach kurzer Zeit wieder das Kopieren-Symbol`, await s.waitFor("const b=r.querySelector('#ag-addprev [data-act=\"copy\"]'); return !b.classList.contains('done') && !b.classList.contains('fail')", 4000));
    // Ohne Zugriff auf die Zwischenablage (Companion App, kein HTTPS): Textfeld im Fenster, ganze ID markiert, dann "copy"
    await s.ev(`const doc=r.host.ownerDocument; Object.defineProperty(doc.defaultView.navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('nicht erlaubt')) } });
      window.__exec = null; doc.execCommand = (cmd) => { const a=r.getElementById('ag-add').querySelector('textarea'); window.__exec = { cmd, value: a?.value, all: !!a && a.selectionStart === 0 && a.selectionEnd === a.value.length }; return true; }; return 1`);
    await s.tap('#ag-addprev [data-act="copy"]');
    check(`${tag}: ohne Zwischenablage: Weg über ein Textfeld im Fenster mit der ganzen ID markiert, Häkchen, das Feld ist danach weg`, await s.waitFor(`const d=r.getElementById('ag-add'); return window.__exec?.cmd === 'copy' && window.__exec.value === 'alarm_control_panel.kuche_sud' && window.__exec.all
      && d.querySelector('#ag-addprev [data-act="copy"]').classList.contains('done') && !d.querySelector('textarea')`), JSON.stringify(await s.ev("return window.__exec")));
    // Beides verweigert: Warnzeichen statt Häkchen, kein Fehler im Browser
    await s.ev("r.host.ownerDocument.execCommand = () => false; return 1");
    await s.page.waitForTimeout(1700);
    await s.tap('#ag-addprev [data-act="copy"]');
    check(`${tag}: Kopieren nicht möglich: Warnzeichen am Knopf statt Häkchen`, await s.waitFor("const b=r.querySelector('#ag-addprev [data-act=\"copy\"]'); return b.classList.contains('fail') && !b.classList.contains('done')"));
    // Vergebener Name: Warnung, gesperrt (auch Gross-/Kleinschreibung)
    await input.fill("haus");
    check(`${tag}: schon vergebener Name ("haus"): Warnung, Hinzufügen gesperrt`, await s.waitFor(`const d=r.getElementById('ag-add'); return d.querySelector('#ag-addprev .ag-warntext') && d.querySelector('button[type=submit]').disabled && !d.querySelector('#ag-addprev').innerText.includes('alarm_control_panel')`));
    // Leeren: zurück zum Hinweis
    await input.fill("");
    check(`${tag}: leeres Feld: Hinweis, gesperrt`, await s.waitFor(`const d=r.getElementById('ag-add'); return d.innerText.includes(${JSON.stringify(t.hint)}) && d.querySelector('button[type=submit]').disabled`));
    // Nur Leerzeichen zählen nicht
    await input.fill("   ");
    check(`${tag}: nur Leerzeichen: gesperrt`, await s.waitFor("return r.getElementById('ag-add').querySelector('button[type=submit]').disabled"));
    // Dialog bleibt gleich hoch (kein Springen beim Tippen)
    const heights = [];
    for (const v of ["", "Garage Nord", "haus", "Garage Nord"]) {
      await input.fill(v);
      await s.page.waitForTimeout(450);
      heights.push(await s.ev("return Math.round(r.getElementById('ag-add').getBoundingClientRect().height)"));
    }
    check(`${tag}: Dialog springt beim Tippen nicht (Höhen ${heights.join("/")})`, new Set(heights).size === 1, JSON.stringify(heights));

    // Abbrechen schliesst, nichts wird angelegt
    await s.tap('#ag-add [data-act="close-add"]');
    check(`${tag}: Abbrechen schliesst den Dialog, nichts angelegt`, await s.waitFor("return !r.getElementById('ag-add').open") && (await s.sim("return (window.__created || []).length === 0")));

    // Fehler beim Anlegen: Meldung im Dialog, Dialog bleibt, Knopf wieder frei
    await s.tap('.ag-headsys [data-act="add"]');
    await (await s.el("#ag-add-input")).fill("Garage Nord");
    await s.waitFor("return !r.getElementById('ag-add').querySelector('button[type=submit]').disabled");
    await s.sim("window.__createFail = true");
    await s.tap('#ag-add button[type="submit"]');
    check(`${tag}: Fehler beim Anlegen steht im Dialog, der Dialog bleibt, Hinzufügen wieder frei`, await s.waitFor("const d=r.getElementById('ag-add'); return d.open && d.querySelector('.ag-dlg-err').textContent.trim() !== '' && !d.querySelector('button[type=submit]').disabled"));
    await s.sim("window.__createFail = false");

    // Anlegen
    await s.tap('#ag-add button[type="submit"]');
    // Seit 1.69.0 öffnet sich für die neue Anlage der Einrichtungsassistent; "Später" › "Nicht mehr anzeigen" führt dorthin, wo das Panel
    // die neue Anlage bisher zeigte (Konfiguration › Sensoren)
    check(`${tag}: Anlegen schliesst den Dialog und öffnet den Einrichtungsassistenten für die neue Anlage`, await s.waitFor("return !r.getElementById('ag-add').open && r.querySelector('.ag-wz')?.dataset.step === 'welcome' && r.querySelector('.ag-wz-lead')?.textContent.includes('Garage Nord')", 8000));
    await s.tap('[data-wz="later"]');
    await s.waitFor("return r.getElementById('ag-wzask').open");
    await s.tap('#ag-wzask [data-wz="ask-hide"]');
    check(`${tag}: danach die neue Anlage in Konfiguration › Sensoren`, await s.waitFor("const sel=r.querySelector('select[data-act=\"system\"]'); return !r.querySelector('.ag-wz') && !!sel && sel.value === 'e_garage_nord' && !!r.querySelector('[data-tab=\"config\"].on') && !!r.querySelector('[data-sub=\"sensors\"].on')", 8000));
    check(`${tag}: Server hat genau diese Anlage angelegt`, await s.sim("return JSON.stringify(window.__created) === JSON.stringify(['Garage Nord'])"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}

// Ohne Anlage: der Knopf der leeren Seite öffnet denselben Dialog und legt die erste Anlage an
for (const mobile of [false, true]) {
  const tag = mobile ? "leer/Handy" : "leer/Desktop";
  const s = await open(browser, { mobile, query: "&empty=1" });
  await s.tap('.ag-empty [data-act="add"]');
  check(`${tag}: Knopf der leeren Seite öffnet den Dialog im Panel`, await s.waitFor("return r.getElementById('ag-add').open"));
  await (await s.el("#ag-add-input")).fill("Wohnung");
  await s.waitFor("return !r.getElementById('ag-add').querySelector('button[type=submit]').disabled");
  await s.tap('#ag-add button[type="submit"]');
  check(`${tag}: erste Anlage angelegt, der Einrichtungsassistent öffnet sich für sie`, await s.waitFor("return !r.getElementById('ag-add').open && !r.querySelector('.ag-empty') && (r.querySelector('.ag-wz-lead')?.textContent || '').includes('Wohnung')", 8000));
  await s.tap('[data-wz="later"]');
  await s.waitFor("return r.getElementById('ag-wzask').open");
  await s.tap('#ag-wzask [data-wz="ask-later"]');
  // Die neue Anlage hat noch keine Sensoren (wie der Server): "Später" führt wie bisher zu Konfiguration › Sensoren, die leere Seite ohne Anlage ist weg
  check(`${tag}: nach "Später" zeigt das Panel sie in Konfiguration › Sensoren (kein "Noch keine Alarmanlage" mehr)`, await s.waitFor("return !r.querySelector('.ag-wz') && !r.querySelector('.ag-empty [data-act=\"add\"]') && !!r.querySelector('[data-tab=\"config\"].on') && !!r.querySelector('[data-sub=\"sensors\"].on') && (r.querySelector('.ag-head')?.innerText || '').includes('Wohnung')", 8000));
  await s.ctx.close();
}
await browser.close();
done();
