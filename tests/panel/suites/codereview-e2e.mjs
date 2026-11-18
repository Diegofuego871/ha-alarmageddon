// Code-Review 1.63.0, zweiter Teil (Panel, Freigabe des Nutzers vom 2026-11-17): Knöpfe, die etwas senden, nehmen bis zur Antwort keinen
// zweiten Druck an; bei einem Verbindungsabbruch gibt es immer nur eine geplante Wiederholung; die Tastatur wirkt auch nach dem Ziehen über
// Kästchen; Fehlertexte nennen die richtige Einheit; der Reiter "Gerät" der Sensoransicht rechnet wie die Liste der Übersicht; Zahlenfelder
// der Anlage haben übersetzte Vorlesetexte; die Geräteauswahl von Routinen und Überwachung lädt mit den drei Punkten statt mit einem Text.
import { launch, open, check, done, outDir } from "../lib.mjs";

const browser = await launch();
const calls = (s, type, extra = "true") => s.sim(`return window.__calls.filter((c) => c.type === ${JSON.stringify(type)} && (${extra})).length`);

for (const [lang, mobile] of [["de", false], ["de", true], ["en", false]]) {
  const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
  const s = await open(browser, { mobile, lang, tab: "config", query: "&sounds=1" });
  // Zwei Drücke rasch hintereinander (Doppelklick, auf dem Handy zwei Taps); ein gesperrter Knopf löst keinen click aus
  const twice = async (sel) => {
    const h = await s.el(sel);
    if (mobile) {
      await h.tap({ force: true });
      await h.tap({ force: true });
    } else await h.dblclick({ force: true });
  };
  const disabledNow = (sel) => s.ev(`return !!r.querySelector(${JSON.stringify(sel)})?.disabled`);
  await s.tap('[data-sub="system"]');
  await s.waitFor("return !!r.querySelector('[data-sys=\"code-open\"]')");

  // ----- Code hinzufügen: Doppelklick auf "Speichern" sendet einmal -----
  await s.tap('[data-sys="code-open"]');
  await s.waitFor("return r.getElementById('ag-codelist').open");
  await s.tap('#ag-codelist [data-sys="code-add"]');
  await s.waitFor("return r.getElementById('ag-codes').open");
  await (await s.el('#ag-codes [data-key="name"]')).fill("Doppel");
  await (await s.el('#ag-codes [data-key="code"]')).fill("4826");
  await (await s.el('#ag-codes [data-key="code2"]')).fill("4826");
  await s.sim('window.__delay = { "alarmageddon/add_code": 900 }; return 1');
  const add0 = await calls(s, "alarmageddon/add_code");
  await twice('#ag-codes [data-sys="code-save"]');
  check(`${tag}: Code: "Speichern" während des Sendens gesperrt`, await disabledNow('#ag-codes [data-sys="code-save"]'));
  await s.waitFor("return !r.getElementById('ag-codes').open", 5000);
  check(`${tag}: Code: Doppelklick auf "Speichern" sendet add_code genau einmal`, (await calls(s, "alarmageddon/add_code")) - add0 === 1, String((await calls(s, "alarmageddon/add_code")) - add0));
  check(`${tag}: Code: die Liste zeigt "Doppel" einmal`, await s.waitFor("return [...r.querySelectorAll('#ag-codelist .ag-codename')].filter((x) => x.innerText.trim() === 'Doppel').length === 1"));
  await s.sim("window.__delay = {}; return 1");
  await s.ev("r.getElementById('ag-codelist').close(); return 1");

  // ----- Sicherung erstellen: zweimal "Sichern" legt eine an -----
  await s.tap('[data-sys="bk-create"]');
  await s.waitFor("return r.getElementById('ag-codes').open && !!r.querySelector('#ag-codes [data-form=\"backup\"]')");
  await (await s.el("#ag-bk-name")).fill("Vor dem Umbau");
  await s.sim('window.__delay = { "alarmageddon/backup_create": 900 }; return 1');
  const bk0 = await calls(s, "alarmageddon/backup_create");
  await twice('#ag-codes [data-form="backup"] button[type="submit"]');
  check(`${tag}: Sicherung: "Sichern" während des Sendens gesperrt`, await disabledNow('#ag-codes [data-form="backup"] button[type="submit"]'));
  await s.waitFor("return !r.getElementById('ag-codes').open", 5000);
  check(`${tag}: Sicherung: Doppelklick legt genau eine an`, (await calls(s, "alarmageddon/backup_create")) - bk0 === 1 && (await s.sim("return window.__backups.length")) === 1,
    String((await calls(s, "alarmageddon/backup_create")) - bk0));
  await s.sim("window.__delay = {}; return 1");

  // ----- Wiederherstellen: zweimal gedrückt, einmal importiert -----
  await s.ev("r.host.systemUi.loadBackups(); return 1");
  await s.waitFor("return (r.host.systemUi.backups || []).length === 1");
  await s.ev("r.host.systemUi.restoreBackup(r.host.systemUi.backups[0].id); return 1");
  check(`${tag}: Wiederherstellen: Fenster offen, Knopf frei`, await s.waitFor("const b=r.querySelector('#ag-codes [data-sys=\"import-go\"]'); return r.getElementById('ag-codes').open && b && !b.disabled"));
  await s.sim('window.__delay = { "alarmageddon/import": 900 }; return 1');
  const imp0 = await calls(s, "alarmageddon/import", "!c.dry_run");
  await twice('#ag-codes [data-sys="import-go"]');
  check(`${tag}: Wiederherstellen: Knopf während des Sendens gesperrt`, await disabledNow('#ag-codes [data-sys="import-go"]'));
  await s.waitFor("return !r.getElementById('ag-codes').open", 5000);
  check(`${tag}: Wiederherstellen: Doppelklick importiert genau einmal`, (await calls(s, "alarmageddon/import", "!c.dry_run")) - imp0 === 1, String((await calls(s, "alarmageddon/import", "!c.dry_run")) - imp0));
  await s.sim("window.__delay = {}; return 1");

  // ----- Eigenen Ton umbenennen: zweimal "Speichern", einmal gesendet -----
  await s.tap('[data-sys="cs-open"]');
  await s.waitFor("return r.getElementById('ag-cslist').open");
  await s.tap('#ag-cslist [data-sys="cs-rename"]');
  await (await s.el('#ag-cslist [data-sys="cs-name-edit"]')).fill("Haustür neu");
  await s.sim('window.__delay = { "alarmageddon/rename_sound": 900 }; return 1');
  const rn0 = await calls(s, "alarmageddon/rename_sound");
  await twice('#ag-cslist [data-sys="cs-rename-ok"]');
  await s.waitFor("return !r.querySelector('#ag-cslist [data-sys=\"cs-name-edit\"]')", 5000);
  check(`${tag}: Ton umbenennen: Doppelklick sendet genau einmal, der neue Name steht da`, (await calls(s, "alarmageddon/rename_sound")) - rn0 === 1
    && await s.waitFor("return r.getElementById('ag-cslist').innerText.includes('Haustür neu')"), String((await calls(s, "alarmageddon/rename_sound")) - rn0));
  await s.sim("window.__delay = {}; return 1");
  await s.ev("r.getElementById('ag-cslist').close(); return 1");

  // ----- Vorlesetexte der Zahlenfelder: der Titel der Zeile, nie der Schlüssel -----
  const labels = await s.ev(`return [...r.querySelectorAll('[data-sys="num"]')].map((i) => [i.dataset.field, i.getAttribute('aria-label')])`);
  const want = await s.ev(`return { exit_delay: r.host._t("sysExitDelay"), entry_delay: r.host._t("sysEntryDelay"), confirm_window: r.host._t("sysConfirm") }`);
  check(`${tag}: Zahlenfelder der Anlage: Vorlesetext ist der übersetzte Titel`, labels.length >= 3 && labels.every(([f, l]) => l === want[f] && l !== f), JSON.stringify(labels));

  // ----- Fehlertexte je Einheit -----
  const texts = await s.ev(`const mon = r.host.actions.mon; mon.ensureDraft();
    const wait = (n, unit) => mon._stepProblem({ type: "wait", n, unit });
    const sys = r.host.systemUi; sys.ensureDraft().auto.keep = 99; sys.renderFoot();
    const keep = r.querySelector('.ag-foot .ag-err')?.innerText || "";
    sys.reset(); sys.render();
    mon.open(-1); mon.form.name = "Probe"; mon.form.tree.items = [{ kind: "value", entity_id: "sensor.keller_luftfeuchtigkeit", op: "above", limit: 70 }]; mon.form.remind = 99;
    const remind = (() => { const d = document.createElement("div"); d.innerHTML = mon.editorHtml(); return d.querySelector(".ag-dlg-err").textContent; })();
    mon.close();
    return { minutes: wait(70, "m"), seconds: wait(4000, "s"), ok: wait(30, "m"), keep, remind,
      exp: { minutes: r.host._t("invalidMinutes", { min: 0, max: 60 }), seconds: r.host._t("invalidNumber", { min: 0, max: 3600 }), keep: r.host._t("invalidCount", { min: 1, max: 50 }), remind: r.host._t("invalidHours", { min: 0, max: 72 }) } }`);
  check(`${tag}: Warten-Schritt der Überwachung: Grenze in der gewählten Einheit (60 min, 3600 s)`, texts.minutes === texts.exp.minutes && texts.seconds === texts.exp.seconds && texts.ok === ""
    && texts.minutes.includes("60") && texts.seconds.includes("3600"), JSON.stringify(texts));
  check(`${tag}: Erinnerung: "Stunden", Anzahl automatischer Sicherungen: "Zahl", nie "Sekunden"`, texts.remind === texts.exp.remind && texts.keep === texts.exp.keep
    && !/Sekunden|seconds/.test(texts.remind + texts.keep), JSON.stringify(texts));

  // ----- Ladeanzeige der Geräteauswahl (Routinen und Überwachung): drei Punkte, kein Text -----
  await s.ev("r.host.systemUi.rt.ents = null; return 1");
  await s.sim('window.__delay = { "alarmageddon/routine_entities": 1500, "alarmageddon/monitor_entities": 1500 }; return 1');
  await s.tap('[data-sys="rt-add-page"]');
  await s.waitFor("return r.getElementById('ag-step').open");
  await s.tap('#ag-step [data-sys="rt-add-dev"][data-path=""]');
  const rtWait = await s.ev("const l=r.querySelector('#ag-step .ag-rtlist'); return { dots: !!l?.querySelector('.ag-ld'), text: l?.innerText.trim() || '' }");
  check(`${tag}: Routine, Geräteauswahl lädt: drei Punkte, kein Text`, rtWait.dots && rtWait.text === "", JSON.stringify(rtWait));
  check(`${tag}: Routine, Geräteauswahl: danach die Geräte`, await s.waitFor("return r.querySelectorAll('#ag-step .ag-rtent').length > 0", 5000));
  // Die Fenster der Überwachung bedient der Reiter "Aktionen" (seine Klicks laufen nur dort)
  await s.ev("r.host.systemUi.rt.close(); return 1");
  await s.tap('[data-sub="actions"]');
  await s.waitFor("return !!r.querySelector('.ag-wf-head')");
  await s.ev("r.host.actions.mon.ents = null; r.host.actions.mon.open(-1); return 1");
  await s.waitFor("return r.getElementById('ag-mon').open");
  await s.tap('#ag-mon [data-wf="mon-add-leaf"][data-kind="state"][data-path=""]');
  const monWait = await s.ev("const l=r.querySelector('#ag-mon .ag-rtlist'); return { dots: !!l?.querySelector('.ag-ld'), text: l?.innerText.trim() || '' }");
  check(`${tag}: Überwachung, Geräteauswahl lädt: drei Punkte, kein Text`, monWait.dots && monWait.text === "", JSON.stringify(monWait));
  check(`${tag}: Überwachung, Geräteauswahl: danach die Geräte`, await s.waitFor("return r.querySelectorAll('#ag-mon .ag-rtent').length > 0", 5000));
  await s.ev("r.host.actions.mon.close(); return 1");
  await s.sim("window.__delay = {}; return 1");
  if (!mobile && lang === "de") await s.page.screenshot({ path: `${outDir}codereview-${lang}-${mobile ? "mobile" : "desktop"}.png` });
  check(`${tag}: ohne Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}

// ----- Verbindungsabbruch: immer nur eine geplante Wiederholung -----
{
  const s = await open(browser, { lang: "de" });
  await s.ev("clearInterval(r.host._poll); return 1"); // der Takt alle 30 s soll die Zählung nicht stören
  await s.sim("window.__wsDown = true; return 1");
  for (let i = 0; i < 3; i += 1) await s.ev("return r.host._fetch()"); // drei Abfragen scheitern (wie Takt und Sichtbarkeit während eines Ausfalls)
  check("Verbindung weg: Hinweis einmal, Anlagen bleiben stehen", (await s.ev("return r.querySelectorAll('.ag-toast').length")) === 1 && (await s.ev("return r.querySelectorAll('.ag-sys[data-system]').length")) > 0);
  const start = await calls(s, "alarmageddon/data");
  await s.page.waitForTimeout(5700);
  const retries = (await calls(s, "alarmageddon/data")) - start;
  check("Verbindung weg: nach 5 s genau eine Wiederholung (bis 1.62.0 eine je gescheiterter Abfrage)", retries === 1, String(retries));
  await s.sim("window.__wsDown = false; return 1");
  check("Verbindung zurück: die geplante Wiederholung holt die Daten", await s.waitFor("return r.host._connError === false && !r.host._retryTimer", 7000));
  const after = await calls(s, "alarmageddon/data");
  await s.page.waitForTimeout(5500);
  check("Verbindung zurück: danach keine weiteren Wiederholungen", (await calls(s, "alarmageddon/data")) === after, String((await calls(s, "alarmageddon/data")) - after));
  await s.ctx.close();
}

// ----- Tastatur nach dem Ziehen über Kästchen: die Leertaste wirkt -----
{
  const s = await open(browser, { lang: "de", tab: "config", prefs: { sub: "sensors" } });
  await s.waitFor("return r.querySelectorAll('[data-box][data-mode=\"away\"]').length > 2");
  const boxes = await s.ev("return [...r.querySelectorAll('[data-box][data-mode=\"away\"]')].slice(0, 3).map((b) => { const x = b.getBoundingClientRect(); return [x.left + x.width / 2, x.top + x.height / 2, b.dataset.ent]; })");
  const frame = await (await s.page.$("#panel-frame")).boundingBox();
  const at = ([x, y]) => [frame.x + x, frame.y + y];
  await s.page.mouse.move(...at(boxes[0]));
  await s.page.mouse.down();
  await s.page.mouse.move(...at(boxes[1]), { steps: 5 });
  await s.page.mouse.up();
  await s.page.waitForTimeout(200);
  const third = `r.querySelector('[data-box][data-mode="away"][data-ent="${boxes[2][2]}"]')`;
  const before = await s.ev(`return ${third}.classList.contains("on")`);
  await s.ev(`${third}.focus(); return 1`);
  await s.page.keyboard.press("Space");
  check("Ziehen über zwei Kästchen, dann Leertaste auf einem dritten: es wechselt", await s.waitFor(`return ${third}.classList.contains("on") === ${!before}`, 1500));
  await s.ev(`${third}.focus(); return 1`); // die Tabelle ist neu gezeichnet
  await s.page.keyboard.press("Space");
  check("zweite Leertaste: es wechselt zurück", await s.waitFor(`return ${third}.classList.contains("on") === ${before}`, 1500));
  // Maus wie bisher: ein Klick stellt genau einmal um (pointerdown), der click danach wird verworfen
  const box = await s.el(`[data-box][data-mode="away"][data-ent="${boxes[2][2]}"]`);
  await box.click();
  check("ein Mausklick stellt genau einmal um", await s.waitFor(`return ${third}.classList.contains("on") === ${!before}`, 1500));
  await s.ctx.close();
}

// ----- Sensoransicht, Reiter "Gerät": "Immer aktiv" nur, wo es wirklich gilt -----
for (const mobile of [false, true]) {
  const tag = mobile ? "Handy" : "Desktop";
  const s = await open(browser, { lang: "de", mobile, query: "&sensors=few" });
  const device = async () => {
    await s.ev("r.host.sensorView.open('binary_sensor.rauchmelder_flur'); return 1");
    await s.waitFor("return !!r.querySelector('#ag-sensor [data-sv=\"tab\"][data-tab=\"device\"]')");
    await s.ev("r.querySelector('#ag-sensor [data-sv=\"tab\"][data-tab=\"device\"]').click(); return 1");
    await s.waitFor("return r.querySelectorAll('#ag-sensor .ag-sv-dcard').length === 2");
    const text = await s.ev("return (r.querySelectorAll('#ag-sensor .ag-sv-dcard')[1]?.innerText || '').replace(/\\s+/g, ' ').trim()");
    await s.ev("r.host.sensorView.close(); return 1");
    return text;
  };
  const list = await s.ev("return (r.host.list.members().get('binary_sensor.rauchmelder_flur') || []).map((x) => x.title)");
  const text = await device();
  check(`${tag}: Rauchmelder nur in "Haus": die Ansicht nennt "Haus · Immer aktiv", nie "Garage" (wie die Liste)`, text.includes("Haus") && text.includes("Immer aktiv") && !text.includes("Garage")
    && JSON.stringify(list) === JSON.stringify(["Haus"]), `${text} | ${JSON.stringify(list)}`);
  await s.sim("window.__systems[0].always_enabled = false; return 1");
  await s.ev("return r.host._fetch()");
  const off = await device();
  check(`${tag}: "Immer aktiv" der Anlage ausgeschaltet: kein "Immer aktiv" mehr`, !off.includes("Immer aktiv"), off);
  check(`${tag}: Sensoransicht ohne Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}

await browser.close();
done();
