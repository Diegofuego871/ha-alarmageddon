// 1.93.0: Danger Zone und Zurücksetzen (Wunsch des Nutzers 2026-11-26): "Zurücksetzen" und "Anlage löschen" stehen in einem roten Rahmen mit dem Titel
// "Danger Zone" (in jeder Sprache gleich); Zurücksetzen nur bei deaktivierter Anlage, Warn-Dialog mit Schalter "Vorher ein Backup erstellen" (an),
// Backup "Vor Reset · Zeit", Fehler im Dialog. Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { reset: "Zurücksetzen", backup: "Vorher ein Backup erstellen", prefix: "Vor Reset", goes: "Das wird entfernt", stays: "Das bleibt", confirm: "Zurücksetzen", notDisarmed: "Zuerst die Anlage deaktivieren", clearLog: "Auch Protokoll und Aufzeichnungen löschen", noBackup: "Ohne Backup", withBackup: "Das Backup, das du vorher erstellst", logLine: "Protokoll und Aufzeichnungen dieser Anlage", clearShared: "Auch gemeinsame Daten zurücksetzen" },
  en: { reset: "Reset", backup: "Make a backup first", prefix: "Before reset", goes: "What is removed", stays: "What stays", confirm: "Reset", notDisarmed: "Disarm the alarm system first", clearLog: "Also delete log and recordings", noBackup: "Without a backup", withBackup: "The backup you make first", logLine: "Log and recordings of this alarm system", clearShared: "Also reset shared data" },
};

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="system"]');
    await s.waitFor("return !!r.querySelector('.ag-dangerzone')");
    const toEnd = () => s.ev("const b=r.querySelector('[data-sys=\"reset\"]'); b?.scrollIntoView({ block: 'center' });");

    // Scharfe Anlage: beide Knöpfe gesperrt
    await (await s.el('select[data-act="system"]')).selectOption("e_haus");
    await s.page.waitForTimeout(300);
    await toEnd();
    check(`${tag}: Rahmen "Danger Zone" (nicht übersetzt) mit Zurücksetzen über Löschen, roter Rand`, await s.ev(`const c=r.querySelector('.ag-dangerzone'); const ch=c.closest('.ag-chap'); const b=[...c.querySelectorAll('[data-sys]')].map((x) => x.dataset.sys); return ch.querySelector('.ag-chap-t').innerText.trim() === 'Danger Zone' && b.join() === 'reset,delete' && parseFloat(getComputedStyle(c).borderTopWidth) >= 2`));
    check(`${tag}: scharfe Anlage: "${t.reset}" und Löschen gesperrt, mit Hinweis`, await s.ev(`const c=r.querySelector('.ag-dangerzone'); return [...c.querySelectorAll('button[data-sys]')].every((b) => b.disabled) && c.innerText.includes(${JSON.stringify(t.notDisarmed)})`));

    // Garage ist deaktiviert
    await (await s.el('select[data-act="system"]')).selectOption("e_garage");
    await s.page.waitForTimeout(400);
    await toEnd();
    check(`${tag}: deaktivierte Anlage: beide Knöpfe frei, roter Text`, await s.ev("const c=r.querySelector('.ag-dangerzone'); return [...c.querySelectorAll('button[data-sys]')].every((b) => !b.disabled && b.classList.contains('ag-btn-danger-text'))"));
    await s.tap('[data-sys="reset"]');
    check(`${tag}: Warn-Dialog nennt die Anlage, "${t.goes}" und "${t.stays}", Backup-Schalter ist an`, await s.waitFor(`const d=r.getElementById('ag-reset'); const x=d.innerText; const tg=d.querySelector('[data-act="reset-backup"]'); return d.open && x.includes('Garage') && x.includes(${JSON.stringify(t.goes)}) && x.includes(${JSON.stringify(t.stays)}) && x.includes(${JSON.stringify(t.backup)}) && tg.getAttribute('aria-checked') === 'true'`));
    check(`${tag}: zwei Anlagen: "${t.clearLog}" (aus) da, "${t.clearShared}" gar nicht angezeigt (nicht ausgegraut)`, await s.ev(`const d=r.getElementById('ag-reset'); const l=d.querySelector('[data-act="reset-log"]'); return !!l && l.getAttribute('aria-checked') === 'false' && d.innerText.includes(${JSON.stringify(t.clearLog)}) && !d.querySelector('[data-act="reset-shared"]') && !d.innerText.includes(${JSON.stringify(t.clearShared)})`));
    check(`${tag}: der Text folgt den Schaltern: Backup aus -> "${t.noBackup}", Protokoll an -> unter "entfernt" statt unter "bleibt", Anlagenzahlen stehen drin`, await s.ev(`const d=r.getElementById('ag-reset'); const uls=() => [...d.querySelectorAll('.ag-resetplan ul')].map((u) => u.innerText); const w=() => d.querySelector('.ag-delwarn').innerText; const before = w().includes(${JSON.stringify(t.withBackup)}) && uls()[1].includes(${JSON.stringify(t.logLine)}) && !uls()[0].includes(${JSON.stringify(t.logLine)}) && /[0-9]/.test(uls()[0]); d.querySelector('[data-act="reset-backup"]').click(); d.querySelector('[data-act="reset-log"]').click(); const after = w().includes(${JSON.stringify(t.noBackup)}) && uls()[0].includes(${JSON.stringify(t.logLine)}) && !uls()[1].includes(${JSON.stringify(t.logLine)}); d.querySelector('[data-act="reset-backup"]').click(); d.querySelector('[data-act="reset-log"]').click(); return before && after && w().includes(${JSON.stringify(t.withBackup)})`));
    check(`${tag}: Schalter links, Text rechts (Grundregel)`, await s.ev("const l=r.querySelector('#ag-reset .ag-rename-ids'); const tg=l.querySelector('.ag-toggle').getBoundingClientRect(); const tx=l.querySelector('.ag-otx').getBoundingClientRect(); return tg.right <= tx.left"));
    if (mobile) check(`${tag}: Handy: Knöpfe des Dialogs liegen im Bild`, await s.ev("const d=r.getElementById('ag-reset'); const w=r.host.getBoundingClientRect(); return [...d.querySelectorAll('.ag-dlg-btns button')].every((x) => { const b=x.getBoundingClientRect(); return b.left >= w.left && b.right <= w.right && b.bottom <= w.bottom && b.top >= 0 })"));

    // Fehler vom Server: im Dialog, Dialog bleibt, Knopf wieder frei
    await s.sim("window.__resetFail = true");
    await s.tap('#ag-reset button[type="submit"]');
    check(`${tag}: Fehler vom Server steht im Dialog, Dialog bleibt, Knopf wieder frei`, await s.waitFor("const d=r.getElementById('ag-reset'); return d.open && d.querySelector('.ag-dlg-err').textContent.trim() !== '' && !d.querySelector('button[type=submit]').disabled"));
    await s.sim("window.__resetFail = false");

    // Abbrechen setzt nichts zurück
    await s.tap('#ag-reset [data-act="close-reset"]');
    check(`${tag}: Abbrechen schliesst, nichts zurückgesetzt`, await s.waitFor("return !r.getElementById('ag-reset').open") && (await s.sim("return (window.__resets || []).length === 0")));

    // Zurücksetzen mit Backup (Standard)
    await toEnd();
    await s.tap('[data-sys="reset"]');
    await s.tap('#ag-reset [data-act="reset-log"]');
    await s.tap('#ag-reset button[type="submit"]');
    check(`${tag}: Zurücksetzen schliesst den Dialog, Server bekam Backup "${t.prefix} · Zeit" und die Anlage bleibt`, await s.waitFor(`return !r.getElementById('ag-reset').open`) && (await s.sim(`const d=window.__resets || []; return d.length === 1 && d[0].title === 'Garage' && d[0].backup_name.startsWith(${JSON.stringify(t.prefix + " · ")}) && d[0].backup_name.length <= 60 && d[0].clear_log === true && d[0].clear_shared === false && !!window.__systems.find((x) => x.title === 'Garage')`)));

    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    // Nach dem Zurücksetzen beginnt der Einrichtungsassistent wieder (Zustand "offen"), wie bei einer neuen Anlage
    check(`${tag}: der Einrichtungsassistent startet sofort im Panel (Desktop: Fenster, Handy: im Inhalt), beim Schritt "Willkommen"`, await s.waitFor("return !!r.querySelector('.ag-wz') && r.querySelector('.ag-wz')?.dataset.step === 'welcome' && (r.host.hasAttribute('narrow') || !!r.querySelector('.ag-wzpop'))", 8000));
    check(`${tag}: der Einrichtungsassistent ist wieder offen`, await s.sim("return window.__systems.find((x) => x.title === 'Garage').wizard.state === 'open'"));
    await s.ctx.close();

    // Ohne Backup (neue Seite: der Assistent der ersten würde sonst das Panel überdecken)
    {
      const s2 = await open(browser, { mobile, lang, tab: "config" });
      await s2.tap('[data-sub="system"]');
      await (await s2.el('select[data-act="system"]')).selectOption("e_garage");
      await s2.page.waitForTimeout(400);
      await s2.ev("r.querySelector('[data-sys=\"reset\"]')?.scrollIntoView({ block: 'center' });");
      await s2.tap('[data-sys="reset"]');
      await s2.tap('#ag-reset [data-act="reset-backup"]');
      check(`${tag}: Schalter aus: kein Backup`, await s2.ev("return r.querySelector('#ag-reset [data-act=\"reset-backup\"]').getAttribute('aria-checked') === 'false'"));
      await s2.tap('#ag-reset button[type="submit"]');
      check(`${tag}: ohne Backup geht kein Name mit`, await s2.waitFor("return !r.getElementById('ag-reset').open") && (await s2.sim("const d=window.__resets || []; return d.length === 1 && d[0].backup_name === ''")));
      await s2.ctx.close();
    }

    // Einzige Anlage: der Schalter "gemeinsame Daten" erscheint (aus), mit dem Hinweis "Backups bleiben immer"; eingeschaltet geht er an den Server
    {
      const s3 = await open(browser, { mobile, lang, tab: "config", query: "&single=e_garage" });
      await s3.tap('[data-sub="system"]');
      await s3.waitFor("return !!r.querySelector('[data-sys=\"reset\"]')");
      await s3.ev("r.querySelector('[data-sys=\"reset\"]').scrollIntoView({ block: 'center' })");
      await s3.tap('[data-sys="reset"]');
      check(`${tag}: einzige Anlage: "${t.clearShared}" ist da und aus, Schalter links, Text rechts`, await s3.ev(`const d=r.getElementById('ag-reset'); const b=d.querySelector('[data-act="reset-shared"]'); if (!b) return false; const l=b.closest('label'); return b.getAttribute('aria-checked') === 'false' && d.innerText.includes(${JSON.stringify(t.clearShared)}) && b.getBoundingClientRect().right <= l.querySelector('.ag-otx').getBoundingClientRect().left`));
      await s3.tap('#ag-reset [data-act="reset-shared"]');
      check(`${tag}: Schalter an (aria-checked)`, await s3.ev("return r.querySelector('#ag-reset [data-act=\"reset-shared\"]').getAttribute('aria-checked') === 'true'"));
      await s3.tap('#ag-reset button[type="submit"]');
      check(`${tag}: gemeinsame Daten gehen an den Server (clear_shared), Protokoll nicht`, await s3.waitFor("return !r.getElementById('ag-reset').open") && (await s3.sim("const d=window.__resets || []; return d.length === 1 && d[0].clear_shared === true && d[0].clear_log === false")));
      await s3.ctx.close();
    }
  }
}
await browser.close();
done();
