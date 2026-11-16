// 0.6.0: Modi wählen in Konfiguration › Anlage. Je Sprache, Desktop und Handy, echte Klicks/Taps.
// Der Zeitplan ist seit 1.44.0 Teil der Routinen (routines-e2e.mjs); hier bleibt, dass das Speichern der Modi die Routinen unverändert mitschickt.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { saved: "Gespeichert", active: "in diesem Modus scharf", none: "mindestens einen Modus", skipped: "Zeitplan während des Alarms übersprungen: Deaktivieren" },
  en: { saved: "Saved", active: "armed in this mode", none: "at least one mode", skipped: "Schedule skipped during the alarm: Disarm" },
};

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="system"]');
    check(`${tag}: Modi sichtbar`, await s.waitFor("return r.querySelectorAll('[data-sys=\"mode\"]').length === 3"));
    check(`${tag}: alle drei an (Haus)`, await s.ev("return [...r.querySelectorAll('[data-sys=\"mode\"]')].every((b) => b.getAttribute('aria-checked') === 'true')"));
    // 1.17.12: je Modus ein Schalter (wie die übrigen Einstellungen), links vom Text, mit Symbol und Beschreibung; dazu "Immer aktiv"
    const sw = await s.ev("return [...r.querySelectorAll('[data-sys=\"mode\"], [data-sys=\"always\"]')].map((b) => { const row=b.closest('.ag-orow'); const tx=row?.querySelector('.ag-otx'); return { toggle: b.classList.contains('ag-toggle') && b.getAttribute('role') === 'switch', left: !!tx && b.getBoundingClientRect().right <= tx.getBoundingClientRect().left, title: tx?.querySelector('b')?.textContent.trim() || '', hint: (tx?.querySelector('small')?.textContent.trim().length || 0) > 10, icon: !!row?.querySelector('.ag-oav svg') }; })");
    check(`${tag}: Modi als Schalter: vier Zeilen (drei Modi und "Immer aktiv"), Schalter links, Symbol, Titel und Beschreibung`, sw.length === 4 && sw.every((x) => x.toggle && x.left && x.title && x.hint && x.icon) && !(await s.ev("return !!r.querySelector('.ag-sys-form .ag-chip[data-sys]')")), JSON.stringify(sw));

    // Abwesend ist gerade scharf: Abschalten lehnt der Server ab
    await s.tap('[data-sys="mode"][data-mode="away"]');
    check(`${tag}: Modusleiste ohne Abwesend`, await s.waitFor("return !r.querySelector('[data-scope=\"away\"]') && !!r.querySelector('[data-scope=\"home\"]')"));
    await s.tap('[data-sys="save"]');
    check(`${tag}: aktiver Modus abgelehnt`, await s.waitFor(`return r.querySelector('.ag-foot .ag-err')?.textContent.includes('${t.active}')`));
    await s.tap('[data-sys="cancel"]');

    // 1.17.12: eine Zeit geändert und gespeichert: danach ist nichts mehr offen (der orange Punkt blieb, wenn ein Modus abgeschaltet war)
    await s.tap('[data-sys="mode"][data-mode="night"]');
    await s.ev("const i=r.querySelector('[data-sys=\"num\"][data-field=\"entry_delay\"]'); i.value = String(Number(i.value) + 3); i.dispatchEvent(new Event('input', { bubbles: true })); return 1");
    check(`${tag}: Nacht abgeschaltet und Eingangsverzögerung geändert: Änderungen offen, Punkt am Reiter`, await s.waitFor("return r.host.systemUi.dirtyCount() >= 2 && r.querySelector('[data-sub=\"system\"]').classList.contains('has-edit')"));
    await s.tap('[data-sys="save"]');
    check(`${tag}: gespeichert: der Punkt ist weg und bleibt weg, auch nach dem Neuladen der Daten`, await s.waitFor("return r.host.systemUi.dirtyCount() === 0 && !r.querySelector('[data-sub=\"system\"]').classList.contains('has-edit') && !r.host._wait", 30000));
    await s.ev("return r.host._fetch().then(() => 1)");
    await s.page.waitForTimeout(300);
    check(`${tag}: nach einer weiteren Abfrage steht unten "Keine Änderungen"`, await s.ev("return r.host.systemUi.dirtyCount() === 0 && r.querySelector('.ag-foot [data-sys=\"save\"]').disabled && !r.querySelector('[data-sub=\"system\"]').classList.contains('has-edit')"));
    await s.tap('[data-sys="mode"][data-mode="night"]');
    await s.tap('[data-sys="save"]');
    await s.waitFor("return r.host.systemUi.dirtyCount() === 0 && !r.host._wait", 30000);

    // Keiner gewählt: gesperrt
    for (const m of ["home", "away", "night"]) await s.tap(`[data-sys="mode"][data-mode="${m}"]`);
    check(`${tag}: ohne Modus gesperrt`, await s.waitFor(`return r.querySelector('[data-sys="save"]').disabled && r.querySelector('.ag-foot .ag-err')?.textContent.includes('${t.none}')`));
    await s.tap('[data-sys="cancel"]');

    // Anwesend abschalten und speichern: die Routinen gehen unverändert mit
    await s.tap('[data-sys="mode"][data-mode="home"]');
    await s.tap('[data-sys="save"]');
    check(`${tag}: gespeichert`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes('${t.saved}')`));
    const sys = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_system').at(-1)");
    check(`${tag}: Modi gesendet`, sys?.home_enabled === false && sys?.away_enabled === true && sys?.night_enabled === true && !("home" in (sys?.exit_delay || {})), JSON.stringify(sys));
    check(`${tag}: Routinen unverändert mitgeschickt`, sys?.routines?.length === 3 && sys.routines[0].name === "Nachts scharf", JSON.stringify(sys?.routines));
    check(`${tag}: kein Überlauf`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));

    // Übersicht: Haus ohne "Anwesend"
    await s.tap('[data-tab="overview"]');
    check(`${tag}: Übersicht ohne Anwesend`, await s.waitFor(`return !!r.querySelector('[data-act="mode"][data-entry="e_haus"][data-mode="away"]') && !r.querySelector('[data-act="mode"][data-entry="e_haus"][data-mode="home"]')`));
    // Einträge im Protokoll aus der Zeit vor den Routinen bleiben lesbar
    const text = await s.ev(`return r.host._eventText({ kind: "schedule_skipped", action: "off", reason: "alarm", state: "triggered", mode: "away" })`);
    check(`${tag}: Ereignis Zeitplan übersprungen (alter Eintrag)`, text === t.skipped, text);
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
