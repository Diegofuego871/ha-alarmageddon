// 0.5.0: Zwei-Sensor-Bestätigung, Codes pro Person, Sicherung, Wartungsmeldungen, Ereignistexte. Je Sprache, Desktop und Handy.
import { writeFileSync } from "node:fs";
import { check, done, launch, open, outDir } from "../lib.mjs";

const T = {
  de: { saved: "Gespeichert", confirm: "Braucht einen zweiten Sensor", mismatch: "stimmen nicht", taken: "schon vergeben", restored: "wiederhergestellt", maint: "Wartungsmeldungen", unconfirmed: "Nicht bestätigt, kein Alarm: Bewegung Flur", armFailed: "Abwesend nicht möglich, offen: Fenster Bad" },
  en: { saved: "Saved", confirm: "Needs a second sensor", mismatch: "do not match", taken: "already used", restored: "restored", maint: "Maintenance messages", unconfirmed: "Not confirmed, no alarm: Bewegung Flur", armFailed: "Away not possible, open: Fenster Bad" },
};

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];

    // ----- Ereignistexte (Übersicht) -----
    {
      const s = await open(browser, { mobile, lang });
      const texts = await s.ev(`const h=r.host; return [h._eventText({ kind: "unconfirmed", sensor: "binary_sensor.bewegung_flur", state: "armed_away", mode: "away" }),
        h._eventText({ kind: "arm_failed", sensors: ["binary_sensor.fenster_bad"], state: "disarmed", mode: "away" })]`);
      check(`${tag}: Ereignis "nicht bestätigt"`, texts[0] === t.unconfirmed, texts[0]);
      check(`${tag}: Ereignis "Scharfschalten nicht möglich"`, texts[1] === t.armFailed, texts[1]);
      await s.ctx.close();
    }

    const s = await open(browser, { mobile, lang, tab: "config" });

    // ----- Zwei-Sensor-Bestätigung im Seitenblatt -----
    await s.tap('[data-sen="detail"][data-ent="binary_sensor.bewegung_flur"]');
    const sheet = mobile ? "#ag-sheet" : ".ag-side";
    check(`${tag}: Option im Seitenblatt`, await s.waitFor(`return r.querySelector('${sheet}')?.innerText.includes('${t.confirm}')`));
    await s.tap(`${sheet} [data-sen="opt"][data-key="confirm"]`);
    check(`${tag}: Option "Stiller Alarm" im Seitenblatt`, await s.ev(`return !!r.querySelector('${sheet} [data-sen="opt"][data-key="report_only"]')`));
    await s.tap(`${sheet} [data-sen="opt"][data-key="report_only"]`);
    if (mobile) await s.tap('#ag-sheet .ag-dlg-btns [data-sen="close-detail"]');
    await s.tap('[data-sen="save"]');
    check(`${tag}: Option gespeichert`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes('${t.saved}')`));
    const zones = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_zones').at(-1)");
    check(`${tag}: confirm und report_only gesendet`, zones?.sensor_options?.["binary_sensor.bewegung_flur"]?.confirm === true && zones?.sensor_options?.["binary_sensor.bewegung_flur"]?.report_only === true, JSON.stringify(zones?.sensor_options));

    // ----- Anlage: Bestätigungsfenster -----
    await s.tap('[data-sub="system"]');
    check(`${tag}: Anlage offen`, await s.waitFor("return !!r.querySelector('[data-field=\"confirm_window\"]')"));
    const win = await s.el('[data-field="confirm_window"]');
    await win.fill("3");
    check(`${tag}: zu kleines Fenster abgelehnt`, await s.waitFor("return r.querySelector('[data-sys=\"save\"]').disabled && r.querySelector('.ag-foot .ag-err')?.textContent.includes('600')"));
    await win.fill("90");
    await s.tap('[data-sys="save"]');
    check(`${tag}: Fenster gespeichert`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes('${t.saved}')`));
    const sys = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_system').at(-1)");
    check(`${tag}: confirm_window gesendet (Abwesend)`, sys?.mode_settings?.away?.confirm_window === 90 && sys.mode_settings.home.confirm_window === 60, JSON.stringify(sys));

    // ----- Quittieren verlangt den Code (1.34.0): Schalter bei den Codes, Teil des Entwurfs, nur mit einem Code -----
    const ack = '[data-sys="ackcode"]';
    check(`${tag}: Schalter "Quittieren verlangt den Code" steht bei den Codes, aus und frei (die Anlage hat einen Code)`, await s.ev(`const b=r.querySelector('${ack}'); return !!b && !b.disabled && b.getAttribute('aria-checked') === 'false' && !!b.closest('.ag-codes')`));
    await s.tap(ack);
    check(`${tag}: Schalter an zählt als Änderung (Speichern frei)`, await s.waitFor(`return r.querySelector('${ack}').getAttribute('aria-checked') === 'true' && !r.querySelector('[data-sys="save"]').disabled`));
    await s.tap('[data-sys="save"]');
    check(`${tag}: gespeichert und mit code_ack_required gesendet`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes('${t.saved}')`) && await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_system').at(-1)?.code_ack_required === true"));
    await s.tap(ack);
    await s.tap('[data-sys="save"]');
    await s.waitFor(`return r.querySelector('${ack}').getAttribute('aria-checked') === 'false' && r.querySelector('[data-sys="save"]').disabled`);

    // ----- Codes pro Person (seit 1.63.0 im Fenster "Codes pro Person") -----
    await s.tap('[data-sys="code-open"]');
    check(`${tag}: Fenster der Codes offen`, await s.waitFor("return r.getElementById('ag-codelist').open"));
    check(`${tag}: Anna mit Benutzer`, await s.ev("const row=[...r.querySelectorAll('#ag-codelist tr[data-code]')].find((x) => x.innerText.includes('Anna')); return !!row && row.querySelector('.ag-codeuser').textContent === 'Anna'"));
    check(`${tag}: kein Code sichtbar`, await s.ev("return !r.getElementById('ag-codelist').innerText.includes('2468') && !r.getElementById('ag-codelist').innerText.includes('1234') && !r.querySelector('.ag-codes').innerText.includes('2468')"));
    await s.tap('#ag-codelist [data-sys="code-add"]');
    check(`${tag}: Dialog Code`, await s.waitFor("return r.getElementById('ag-codes').open"));
    check(`${tag}: verknüpfter Benutzer nicht wählbar`, await s.ev("return ![...r.querySelectorAll('#ag-codes option')].some((o) => o.value === 'u_anna')"));
    await (await s.el('#ag-codes [data-key="user_id"]')).selectOption("u_gast");
    check(`${tag}: Name vorgeschlagen`, await s.waitFor("return r.querySelector('#ag-codes [data-key=\"name\"]').value === 'Gast'"));
    await (await s.el('#ag-codes [data-key="code"]')).fill("8395");
    await (await s.el('#ag-codes [data-key="code2"]')).fill("8396");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: Codes ungleich`, await s.waitFor(`return r.querySelector('#ag-codes .ag-dlg-err').textContent.includes('${t.mismatch}')`));
    await (await s.el('#ag-codes [data-key="code"]')).fill("2468");
    await (await s.el('#ag-codes [data-key="code2"]')).fill("2468");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: gleicher Code abgelehnt`, await s.waitFor(`return r.querySelector('#ag-codes .ag-dlg-err').textContent.includes('${t.taken}')`));
    await (await s.el('#ag-codes [data-key="code"]')).fill("8395");
    await (await s.el('#ag-codes [data-key="code2"]')).fill("8395");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: Code hinzugefügt`, await s.waitFor("return !r.getElementById('ag-codes').open && [...r.querySelectorAll('#ag-codelist tr[data-code]')].some((x) => x.innerText.includes('Gast'))"));
    const added = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/add_code').at(-1)");
    check(`${tag}: add_code gesendet`, added?.name === "Gast" && added?.user_id === "u_gast" && added?.code === "8395", JSON.stringify(added));
    check(`${tag}: der Code bleibt nach dem Schliessen nicht im Fenster stehen`, await s.waitFor("return [...r.querySelectorAll('#ag-codes input[type=\"password\"]')].length === 2 && [...r.querySelectorAll('#ag-codes input[type=\"password\"]')].every((i) => i.value === '')"));
    // Entfernen mit Rückfrage (im Fenster)
    await s.tap('#ag-codelist [data-sys="code-del"][data-id="c_anna"]');
    check(`${tag}: Rückfrage Entfernen`, await s.waitFor("return r.getElementById('ag-codes').open && !!r.querySelector('#ag-codes [data-sys=\"code-remove\"]')"));
    // Rückfragen bleiben schmal, nach einem breiten Formular im selben Fenster (1.67.0: nur Formulare in der Standardbreite)
    const ask = await s.ev("const d=r.getElementById('ag-codes'); return { w: Math.round(d.getBoundingClientRect().width), wide: d.classList.contains('ag-wide'), vw: innerWidth }");
    check(`${tag}: Rückfrage Entfernen schmal (nicht in der Breite der Formulare)`, !ask.wide && (ask.w <= 420 || ask.w === ask.vw), JSON.stringify(ask));
    await s.tap('#ag-codes [data-sys="code-remove"]');
    check(`${tag}: Code entfernt`, await s.waitFor("return !r.getElementById('ag-codes').open && ![...r.querySelectorAll('#ag-codelist tr[data-code]')].some((x) => x.innerText.includes('Anna'))"));
    await s.tap('#ag-codelist [data-sys="code-list-close"]');
    await s.waitFor("return !r.getElementById('ag-codelist').open");
    await s.page.screenshot({ path: `${outDir}system-${lang}-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });

    // ----- Sicherung -----
    // Export und Import stehen seit 1.55.1 in der Fusszeile des Fensters "Sicherungen anzeigen"
    check(`${tag}: Export und Import nicht mehr auf der Seite`, await s.ev("return !r.querySelector('.ag-sys-form [data-sys=\"export\"]') && !r.querySelector('.ag-sys-form [data-sys=\"import\"]')"));
    await s.tap('[data-sys="bk-open"]');
    await s.waitFor("return r.getElementById('ag-bklist').open");
    check(`${tag}: Fusszeile des Fensters: Exportieren, Importieren und Schliessen`, await s.ev("const f=r.querySelector('#ag-bklist .ag-dlg-btns'); const b=[...f.querySelectorAll('button')].map((x) => x.dataset.sys); return b.join() === 'export,import,bk-close'"));
    const [download] = await Promise.all([s.page.waitForEvent("download", { timeout: 5000 }).catch(() => null), s.tap('[data-sys="export"]')]);
    check(`${tag}: Export lädt Datei`, !!download && /^alarmageddon-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download?.suggestedFilename());
    const file = `${outDir}backup-test.json`;
    writeFileSync(file, JSON.stringify({ format: "alarmageddon", version: 1, settings: {}, systems: [{ title: "Haus", options: { workflows: { away: [{ type: "notify" }] } } }, { title: "Ferienhaus", options: {} }] }));
    await (await s.el('[data-sys="import-file"]')).setInputFiles(file);
    check(`${tag}: Rückfrage mit gefundenen Anlagen`, await s.waitFor("const d=r.getElementById('ag-codes'); return d.open && d.innerText.includes('Haus') && d.innerText.includes('Ferienhaus')"));
    await s.tap('#ag-codes [data-sys="import-go"]');
    check(`${tag}: wiederhergestellt`, await s.waitFor("return !r.getElementById('ag-codes').open") && await s.sim("return window.__imported === true"));
    writeFileSync(file, JSON.stringify({ hello: "world" }));
    await (await s.el('[data-sys="import-file"]')).setInputFiles(file);
    // Die Datei wird asynchron gelesen: auf den dritten Aufruf warten, nicht sofort zählen
    const thirdCall = await s.page.waitForFunction(() => window.__calls.filter((c) => c.type === "alarmageddon/import").length === 3, null, { timeout: 5000 }).then(() => true, () => false);
    check(`${tag}: fremde Datei abgelehnt`, thirdCall && await s.waitFor("return !r.getElementById('ag-codes').open"));
    await s.tap('#ag-bklist [data-sys="bk-close"]');
    await s.waitFor("return !r.getElementById('ag-bklist').open");

    // ----- Sicherungen in der Integration: Sichern, Liste, Herunterladen, Wiederherstellen, Löschen, höchstens 10 -----
    const bkRows = () => s.ev("return r.querySelectorAll('.ag-bktable tr[data-bk]').length");
    const openBk = async () => {
      await s.tap('[data-sys="bk-open"]');
      await s.waitFor("return r.getElementById('ag-bklist').open && !!r.querySelector('#ag-bklist .ag-bkbody')");
    };
    const closeBk = async () => {
      await s.tap('[data-sys="bk-close"]');
      await s.waitFor("return !r.getElementById('ag-bklist').open");
    };
    check(`${tag}: Sichern: Knopf da, keine Liste auf der Seite, noch keine Sicherung (Hinweis auf der Seite und im Popup)`, await s.ev("return !!r.querySelector('[data-sys=\"bk-create\"]') && !r.querySelector('.ag-bktable') && /(Noch kein Backup|No backup yet)/.test(r.querySelector('.ag-bklast').innerText)"));
    await openBk();
    check(`${tag}: Popup ohne Sicherung: Hinweis statt Tabelle`, await s.ev("return !r.querySelector('#ag-bklist .ag-bktable') && r.querySelector('#ag-bklist .ag-bkbody').innerText.length > 10"));
    await closeBk();
    const makeBk = async (name) => {
      await s.tap('[data-sys="bk-create"]');
      await s.waitFor("return r.getElementById('ag-codes').open && !!r.querySelector('#ag-codes [data-form=\"backup\"]')");
      if (name) await s.ev(`r.querySelector('#ag-codes [data-form="backup"] input').value = ${JSON.stringify(name)}`);
      await s.ev("r.querySelector('#ag-codes [data-form=\"backup\"]').requestSubmit()");
      await s.waitFor("return !r.getElementById('ag-codes').open");
    };
    await makeBk("Vor dem Umbau");
    await openBk();
    check(`${tag}: Sicherung mit Name abgelegt, Meldung, Name und Datum in der Liste`, await s.waitFor("return r.querySelectorAll('.ag-bktable tr[data-bk]').length === 1 && !!r.querySelector('.ag-toast') && r.querySelector('.ag-bktable .ag-bkname').textContent === 'Vor dem Umbau' && !!r.querySelector('.ag-bktable .ag-bkdate')"));
    await closeBk();
    await makeBk("");
    await openBk();
    check(`${tag}: zwei Sicherungen mit Datum und Anlagen, drei runde Knöpfe je Zeile (44 px, wie überall), nichts ragt seitlich hinaus`, await s.waitFor("const row=r.querySelector('.ag-bktable tr[data-bk]'); const body=r.querySelector('#ag-bklist .ag-dlg-body'); return r.querySelectorAll('.ag-bktable tr[data-bk]').length === 2 && /\\d{4}/.test(row.cells[1].textContent) && row.cells[2].textContent.includes('Haus') && row.querySelectorAll('.ag-wf-btns .ag-iconbtn').length === 3 && [...row.querySelectorAll('.ag-iconbtn')].every((b) => Math.round(b.getBoundingClientRect().width) === 44 && b.getBoundingClientRect().right <= r.querySelector('#ag-bklist .ag-bkwrap').getBoundingClientRect().right + 1) && body.scrollWidth <= body.clientWidth + 1"));
    if (mobile) check(`${tag}: Handy: Knöpfe der Backups in einer eigenen Zeile unter Name und Datum (wie die HealthCheck-Dienste)`, await s.ev("const row=r.querySelector('.ag-bktable tr[data-bk]'); const box=row.querySelector('.ag-wf-btns').getBoundingClientRect(); return box.top >= row.cells[0].getBoundingClientRect().bottom - 1 && box.top >= row.querySelector('.ag-bkdate').getBoundingClientRect().bottom - 1"));
    check(`${tag}: Tabelle im Popup und passt in die Breite`, await s.ev("const w=r.querySelector('#ag-bklist .ag-dlg-body'); return !!w && r.querySelector('#ag-bklist .ag-bktable').scrollWidth <= w.clientWidth + 1"));
    check(`${tag}: Seite zeigt "Letztes Backup" mit dem Namen der neuesten`, await s.ev("return /(Letztes Backup|Last backup)/.test(r.querySelector('.ag-bklast').innerText)"));
    const [bkDownload] = await Promise.all([s.page.waitForEvent("download", { timeout: 5000 }).catch(() => null), s.tap('.ag-bktable tr[data-bk] [data-sys="bk-download"]')]);
    check(`${tag}: einzelne Sicherung herunterladen`, !!bkDownload && /^alarmageddon-\d{4}-\d{2}-\d{2}\.json$/.test(bkDownload.suggestedFilename()), bkDownload?.suggestedFilename());
    await s.tap('.ag-bktable tr[data-bk] [data-sys="bk-restore"]');
    check(`${tag}: Wiederherstellen fragt mit den gefundenen Anlagen`, await s.waitFor("const d=r.getElementById('ag-codes'); return d.open && d.innerText.includes('Haus') && !!d.querySelector('[data-sys=\"import-go\"]')"));
    await s.tap('#ag-codes [data-sys="code-close"]');
    await s.tap('.ag-bktable tr[data-bk] [data-sys="bk-delete"]');
    check(`${tag}: Löschen fragt nach`, await s.waitFor("const d=r.getElementById('ag-codes'); return d.open && !!d.querySelector('[data-sys=\"bk-delete-go\"]')"));
    await s.tap('#ag-codes [data-sys="bk-delete-go"]');
    check(`${tag}: gelöscht`, await s.waitFor("return !r.getElementById('ag-codes').open && r.querySelectorAll('.ag-bktable tr[data-bk]').length === 1"));
    await closeBk();
    for (let i = 0; i < 11; i += 1) await makeBk("");
    await openBk();
    check(`${tag}: höchstens 10 Sicherungen`, await s.waitFor("return r.querySelectorAll('.ag-bktable tr[data-bk]').length === 10 && /10/.test(r.querySelector('#ag-bklist .ag-bkbody .ag-small').textContent)"));
    await closeBk();

    // ----- Wartungsmeldungen -----
    await s.tap('[data-sub="notify"]');
    check(`${tag}: Wartung in Benachrichtigungen`, await s.waitFor(`return r.querySelector('.ag-nt')?.innerText.includes('${t.maint}')`));
    check(`${tag}: "Sensor nicht erreichbar" (länger) unter Wartung, "im scharfen Zustand" bei den Meldungen`, await s.ev("const chaps=[...r.querySelectorAll('.ag-chap')]; const maint=chaps[2]; const alarm=chaps[1]; return !!maint.querySelector('[data-nt=\"enabled\"][data-kind=\"sensor_unavailable\"]') && !maint.querySelector('[data-kind=\"sensor_offline\"]') && !!alarm.querySelector('[data-nt=\"enabled\"][data-kind=\"sensor_offline\"]')"));
    await s.page.screenshot({ path: `${outDir}notify-offline-${lang}-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    const thr = await s.el('[data-nt="num"][data-key="battery_threshold"]');
    await thr.fill("80");
    check(`${tag}: Schwelle zu hoch abgelehnt`, await s.waitFor("return r.querySelector('[data-nt=\"save\"]').disabled && !!r.querySelector('.ag-foot .ag-err')"));
    await thr.fill("25");
    // 1.68.0: "Meldung nach … Prüfungen in Folge" (Wunsch des Nutzers 2026-11-19, 19:38: ein einzelner falscher Wert eines Geräts meldet nichts)
    const checksRow = await s.ev(`const row=r.querySelector('[data-num="battery_checks"]'); return row && { unit: row.querySelector('.ag-num .ag-t2').textContent, unitLines: Math.round(row.querySelector('.ag-num .ag-t2').getBoundingClientRect().height / 14), value: row.querySelector('input').value,
      sameCard: !!row.closest('.ag-mt')?.querySelector('[data-nt="enabled"][data-kind="battery_low"]'), hint: row.querySelector('small')?.textContent || '',
      inside: row.getBoundingClientRect().right <= row.closest('.ag-mt').getBoundingClientRect().right + 1 }`);
    const checksText = lang === "de" ? "Prüfungen" : "checks";
    check(`${tag}: Batterie schwach: "… 3 ${checksText}" (eine Zeile) in derselben Karte, mit Hinweis auf die 15 Minuten der Wartung, passt in die Breite`,
      !!checksRow && checksRow.value === "3" && checksRow.sameCard && checksRow.unit === checksText && checksRow.unitLines <= 1 && checksRow.hint.includes("15") && checksRow.inside, JSON.stringify(checksRow));
    const checksField = await s.el('[data-nt="num"][data-key="battery_checks"]');
    await checksField.fill("0");
    check(`${tag}: 0 Prüfungen abgelehnt (Feld rot, "Speichern" gesperrt)`, await s.waitFor("return r.querySelector('[data-nt=\"save\"]').disabled && r.querySelector('[data-num=\"battery_checks\"] .ag-num').classList.contains('bad')"));
    await checksField.fill("4");
    await (await s.el('[data-nt="num"][data-key="offline_minutes"]')).fill("120");
    await s.tap('[data-nt="enabled"][data-kind="sensor_unavailable"]');
    check(`${tag}: Art aus blendet ihre Einstellungen aus`, await s.waitFor("return !r.querySelector('[data-nt=\"num\"][data-key=\"offline_minutes\"]')"));
    await s.tap('[data-nt="save"]');
    check(`${tag}: Wartung gespeichert`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes('${t.saved}')`));
    const nt = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_notify').at(-1)?.notify");
    check(`${tag}: Wartungswerte gesendet`, nt?.battery_threshold === 25 && nt?.battery_checks === 4 && nt?.offline_minutes === 120 && nt?.types?.sensor_unavailable?.enabled === false && nt?.types?.battery_low?.enabled === true, JSON.stringify(nt));
    check(`${tag}: kein Überlauf`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
