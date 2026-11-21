// 1.44.0: Routinen in Konfiguration › Anlage (ersetzen den Zeitplan): Liste, Editor, Auslöser Zeitplan und Gerät mit Und/Oder und Gruppen,
// Geräteauswahl mit Suche (auch nach Entitäts-ID, angezeigt wird sie nie) und Filter, Zustände der Anlage, Sicherheit beim Deaktivieren.
// Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open, outDir } from "../lib.mjs";

const T = {
  de: {
    unlocked: "aufgeschlossen", bypass: "Umgeht den Code", disarmOff: "Deaktivieren per Routine ist aus", taken: "diesen Namen schon", noDevice: "mindestens ein Gerät",
    emptyGroup: "mindestens eine Bedingung", unsafe: "den Code umgeht", confirmFirst: "Zuerst unter", copy: "Kopie", short: "Kurzes Drücken", noDay: "mindestens einen Tag", saved: "Gespeichert", skipped: "Routine \"Heimkommen\" übersprungen: gilt nicht im Zustand: Beim Alarm",
  },
  en: {
    unlocked: "unlocked", bypass: "Bypasses the code", disarmOff: "Disarming by routine is off", taken: "already has this name", noDevice: "at least one device",
    emptyGroup: "at least one condition", unsafe: "bypasses the code", confirmFirst: "Confirm under", copy: "copy", short: "Short press", noDay: "at least one day", saved: "Saved", skipped: "Routine \"Heimkommen\" skipped: not allowed in this state: During the alarm",
  },
};

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="system"]');
    // Seit 1.55.0 steht die Liste im Popup: die Seite zeigt nur die Zahl und einen Knopf
    const listOpen = () => s.ev("return r.getElementById('ag-rtlist').open");
    const openList = async () => {
      if (await listOpen()) return;
      await s.tap('[data-sys="rt-open"]');
      await s.waitFor("return r.getElementById('ag-rtlist').open && !!r.querySelector('#ag-rtlist .ag-rt-pop')");
    };
    const closeList = async () => {
      if (!(await listOpen())) return;
      await s.tap('[data-sys="rt-close"]');
      await s.waitFor("return !r.getElementById('ag-rtlist').open");
    };
    const tapIn = async (sel) => {
      await openList();
      await s.tap(sel);
    };
    const savePage = async () => {
      await closeList();
      await s.tap('.ag-foot [data-sys="save"]');
    };
    const cancelPage = async () => {
      await closeList();
      await s.tap('.ag-foot [data-sys="cancel"]');
    };
    await openList();
    check(`${tag}: Seite: nur eine Zeile "3 Routinen · 3 aktiv" mit Knopf "Routinen anzeigen", keine Liste auf der Seite`, await s.waitFor(`const row=r.querySelector('.ag-sys-form .ag-rtsum'); return !!row && /3 .* 3/.test(row.innerText) && !!row.querySelector('[data-sys="rt-open"]') && !r.querySelector('.ag-sys-form .ag-rtrow')`));
    // 1.58.0: Routine direkt von der Seite anlegen (Knopf nicht blau), dezenter orange Hinweis auf Ungespeichertes
    check(`${tag}: Seite: Knopf "Routine hinzufügen" neben "Routinen anzeigen", nicht blau; ohne Änderung kein Hinweis "nicht gespeichert"`, await s.ev("const row=r.querySelector('.ag-sys-form .ag-rtsum'); const b=row.querySelector('[data-sys=\"rt-add-page\"]'); return !!b && !b.classList.contains('primary') && !b.disabled && !row.querySelector('.ag-unsaved')"));
    await closeList();
    await s.tap('[data-sys="rt-add-page"]');
    check(`${tag}: der Knopf der Seite öffnet gleich den Editor einer neuen Routine`, await s.waitFor("return r.getElementById('ag-step').open && !!r.querySelector('#ag-step [data-sys=\"rt-save\"]')"));
    await s.tap('#ag-step [data-sys="rt-cancel"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    await tapIn('.ag-rtrow [data-sys="rt-on"]');
    check(`${tag}: geänderte Routine: dezenter orange Hinweis "noch nicht gespeichert" in ihrer Zeile und auf der Seite, die anderen Zeilen ohne`, await s.waitFor("const rows=[...r.querySelectorAll('#ag-rtlist .ag-rtrow')]; const sum=r.querySelector('.ag-sys-form .ag-rtsum .ag-unsaved'); const n=rows[0]?.querySelector('.ag-unsaved'); return !!n && !!sum && rows.slice(1).every((x) => !x.querySelector('.ag-unsaved')) && getComputedStyle(n, '::before').borderRadius === '50%' && getComputedStyle(n, '::before').width === '8px'"));
    await tapIn('.ag-rtrow [data-sys="rt-on"]');
    check(`${tag}: zurückgestellt: der Hinweis verschwindet`, await s.waitFor("return !r.querySelector('#ag-rtlist .ag-unsaved') && !r.querySelector('.ag-sys-form .ag-rtsum .ag-unsaved')"));
    await openList();
    check(`${tag}: Popup: Überschrift, Fusszeile mit "Schliessen" und "Routine hinzufügen"`, await s.ev("const d=r.getElementById('ag-rtlist'); return !!d.querySelector('h3') && !!d.querySelector('[data-sys=\"rt-close\"]') && !!d.querySelector('.ag-dlg-btns [data-sys=\"rt-add\"]')"));
    await openList();
    check(`${tag}: Liste mit drei Routinen`, await s.waitFor("return r.querySelectorAll('.ag-rtrow').length === 3"));
    check(`${tag}: kein Kapitel "Zeitplan" mehr`, await s.ev("return !r.querySelector('.ag-sched') && !r.querySelector('[data-sys=\"sch-add\"]')"));
    const rows = await s.ev("return [...r.querySelectorAll('.ag-rtrow')].map((row) => ({ name: row.querySelector('b').textContent, text: row.innerText, bypass: !!row.querySelector('.ag-tag.err'), icon: !!row.querySelector('.ag-oav svg'), toggleLeft: row.querySelector('.ag-toggle').getBoundingClientRect().right <= row.querySelector('.ag-settx').getBoundingClientRect().left }))");
    check(`${tag}: Zeile mit Zeit, Gerät und Marke "Umgeht den Code"`, rows[0].text.includes("22:30") && rows[1].bypass && rows[1].text.includes(t.bypass) && !rows[0].bypass
      && rows[2].text.includes("Haustür-Schloss") && rows[2].text.includes("Marco") && rows[2].text.includes("22:00") && rows.every((x) => x.icon && x.toggleLeft), JSON.stringify(rows));
    check(`${tag}: keine zusätzliche Option "Deaktivieren per Routine erlauben" auf der Seite`, await s.ev("return !r.querySelector('[data-sys=\"rt-disarm\"]') && !r.querySelector('.ag-rt > .ag-setrow .ag-toggle:not([data-sys=\"rt-on\"])')"));

    // ----- Neue Routine mit Gerät, Gruppe, Oder -----
    await tapIn('[data-sys="rt-add"]');
    check(`${tag}: Editor offen, Speichern gesperrt (Name fehlt)`, await s.waitFor("return r.getElementById('ag-step').open && !!r.querySelector('.ag-rt-ed') && r.querySelector('[data-sys=\"rt-save\"]').disabled"));
    // 1.74.0 (Wunsch des Nutzers 2026-11-21): ein neues Formular beginnt ruhig, der Name ist nicht rot und keine Meldung steht da, Speichern bleibt gesperrt
    check(`${tag}: neue Routine beginnt ruhig: Namensfeld nicht rot, keine Meldung, Speichern gesperrt`, await s.ev("const n=r.querySelector('[data-sys=\"rt-name\"]'); const e=r.querySelector('.ag-rt-ed .ag-dlg-err'); return !n.classList.contains('bad') && getComputedStyle(n).borderTopColor !== getComputedStyle(r.host).getPropertyValue('--ag-error') && !e.classList.contains('show') && e.textContent === '' && r.querySelector('[data-sys=\"rt-save\"]').disabled"));
    // Fokus im Namen, ohne dass das Fenster dafür scrollt
    check(`${tag}: neue Routine: Fenster steht oben (kein Runterscrollen)`, await s.ev("const d=r.getElementById('ag-step'); return d.scrollTop === 0 && (d.querySelector('.ag-dlg-body')?.scrollTop || 0) === 0"));
    // Nach dem Tippen und Leeren des Namens wird er rot, die Meldung nennt die Länge
    const name0 = await s.el('[data-sys="rt-name"]');
    await name0.fill("x");
    await name0.fill("");
    check(`${tag}: Name angefasst und wieder leer: rot, Meldung zur Länge`, await s.ev("const n=r.querySelector('[data-sys=\"rt-name\"]'); const e=r.querySelector('.ag-rt-ed .ag-dlg-err'); return n.classList.contains('bad') && e.classList.contains('show') && e.textContent.length > 5"));
    const name = await s.el('[data-sys="rt-name"]');
    await name.fill("Haus verlassen");
    check(`${tag}: Fokus bleibt im Namen beim Tippen`, await s.ev("return r.activeElement?.dataset.sys === 'rt-name'"));
    check(`${tag}: ohne Gerät gesperrt, Meldung nennt das Gerät`, await s.ev(`return r.querySelector('[data-sys="rt-save"]').disabled && r.querySelector('.ag-rt-ed .ag-dlg-err').textContent.includes(${JSON.stringify(t.noDevice)})`));
    await s.tap('[data-sys="rt-add-dev"][data-path=""]');
    check(`${tag}: Geräteauswahl mit sechs Geräten`, await s.waitFor("return !!r.querySelector('.ag-rt-pick') && r.querySelectorAll('.ag-rtent').length === 7"));
    check(`${tag}: Suchfeld der Geräteauswahl hat seine normale Höhe (nicht die des Fensters)`, await s.ev("const h=r.querySelector('.ag-rt-pick .list-search').getBoundingClientRect().height; return h > 30 && h < 70"));
    check(`${tag}: die Entitäts-ID steht nirgends in der Liste`, await s.ev("return !/lock\\.haustuer|binary_sensor\\.|switch\\./.test(r.querySelector('.ag-rtlist').innerText)"));
    const q = await s.el('[data-sys="rt-q"]');
    await q.fill("lock.haus");
    check(`${tag}: Suche nach der Entitäts-ID findet das Schloss, angezeigt wird der Name`, await s.waitFor("const e=[...r.querySelectorAll('.ag-rtent')]; return e.length === 1 && e[0].querySelector('b').textContent === 'Haustür-Schloss' && !e[0].innerText.includes('lock.')"));
    check(`${tag}: Fokus bleibt im Suchfeld`, await s.ev("return r.activeElement?.dataset.sys === 'rt-q'"));
    await s.tap('[data-sys="rt-q-clear"]');
    check(`${tag}: Leeren zeigt wieder alle`, await s.waitFor("return r.querySelectorAll('.ag-rtent').length === 7"));
    await s.tap('[data-sys="rt-filter"][data-value="person"]');
    check(`${tag}: Filter Personen`, await s.waitFor("return r.querySelectorAll('.ag-rtent').length === 2"));
    await s.tap('[data-sys="rt-filter"][data-value="all"]');
    await (await s.el('[data-sys="rt-area"]')).selectOption("Garten");
    check(`${tag}: Filter Bereich`, await s.waitFor("const e=[...r.querySelectorAll('.ag-rtent')]; return e.length === 1 && e[0].querySelector('b').textContent === 'Garten-Schloss'"));
    await (await s.el('[data-sys="rt-area"]')).selectOption("");
    await (await s.el('[data-sys="rt-q"]')).fill("haustür"); // das Fenster wurde neu gezeichnet: neues Feld
    await s.waitFor("return r.querySelectorAll('.ag-rtent').length === 1");
    await s.tap('[data-sys="rt-choose"]');
    check(`${tag}: Gerät gewählt, zurück im Editor, Zustand "abgeschlossen" vorgewählt`, await s.waitFor("return !!r.querySelector('.ag-rt-ed') && r.querySelector('.ag-rtleaf .ag-rtdev b')?.textContent === 'Haustür-Schloss' && r.querySelector('[data-sys=\"rt-state\"]').value === 'locked'"));
    check(`${tag}: jetzt speicherbar`, await s.ev("return !r.querySelector('[data-sys=\"rt-save\"]').disabled"));
    // Gruppe: leer gesperrt, mit Person gültig
    await s.tap('[data-sys="rt-add-group"]');
    check(`${tag}: leere Gruppe sperrt Speichern`, await s.waitFor(`return r.querySelector('[data-sys="rt-save"]').disabled && r.querySelector('.ag-rt-ed .ag-dlg-err').textContent.includes(${JSON.stringify(t.emptyGroup)})`));
    await s.tap('[data-sys="rt-add-dev"][data-path="1"]');
    await s.waitFor("return r.querySelectorAll('.ag-rtent').length === 7");
    await s.tap('[data-sys="rt-choose"][data-id="person.anna"]');
    await s.waitFor("return !!r.querySelector('.ag-rtgroup .ag-rtleaf')");
    await (await s.el('[data-sys="rt-state"][data-path="1.0"]')).selectOption("not_home");
    await s.tap('[data-sys="rt-op"][data-path="1"][data-value="or"]');
    await s.tap('[data-sys="rt-add-time"][data-path="1"]');
    check(`${tag}: Uhrzeit in der Gruppe`, await s.waitFor("return r.querySelectorAll('.ag-rtgroup .ag-rtleaf').length === 2 && !!r.querySelector('[data-sys=\"rt-from\"][data-path=\"1.1\"]')"));
    const hold = await s.el('[data-sys="rt-hold"]');
    await hold.fill("5");
    check(`${tag}: Gruppe, Oder, "muss 5 s gelten": speicherbar`, await s.ev("return !r.querySelector('[data-sys=\"rt-save\"]').disabled && r.querySelector('[data-sys=\"rt-op\"][data-path=\"1\"][data-value=\"or\"]').classList.contains('on')"));
    // Ziel und Zustände: Scharfschalten gilt nie bei Eingangsverzögerung und Alarm
    await s.tap('[data-sys="rt-seg"][data-key="action"][data-value="away"]');
    const stateInfo = await s.ev("return [...r.querySelectorAll('[data-sys=\"rt-st\"]')].map((b) => ({ v: b.dataset.value, on: b.getAttribute('aria-checked') === 'true', off: b.disabled }))");
    check(`${tag}: fünf Zustände, nur "deaktiviert" an und wählbar; alle anderen gesperrt, bis die Bestätigung an ist`, stateInfo.length === 5 && stateInfo.filter((x) => x.on).map((x) => x.v).join() === "disarmed"
      && stateInfo.filter((x) => x.off).map((x) => x.v).join() === "arming,armed,pending,triggered", JSON.stringify(stateInfo));
    check(`${tag}: Sicherheitskasten auch beim Scharfschalten, über den Zuständen, Bestätigung aus`, await s.ev("const sf=r.querySelector('.ag-rtsafety'); const st=r.querySelector('[data-sys=\"rt-st\"]'); return !!sf && r.querySelector('[data-sys=\"rt-unsafe\"]').getAttribute('aria-checked') === 'false' && !!(sf.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING)"));
    check(`${tag}: gesperrte Zustände nennen den Grund (zuerst unter "Sicherheit" bestätigen)`, await s.ev(`const b=r.querySelector('[data-sys="rt-st"][data-value="armed"]'); return b.disabled && b.closest('.ag-setrow').innerText.includes(${JSON.stringify(t.confirmFirst)})`));
    await s.tap('[data-sys="rt-unsafe"]');
    const afterConfirm = await s.ev("return [...r.querySelectorAll('[data-sys=\"rt-st\"]')].filter((b) => b.disabled).map((b) => b.dataset.value).join()");
    check(`${tag}: nach der Bestätigung wählbar; nur Eingangsverzögerung und Alarm bleiben beim Scharfschalten gesperrt`, afterConfirm === "pending,triggered", afterConfirm);
    await s.tap('[data-sys="rt-st"][data-value="armed"]');
    await s.tap('[data-sys="rt-unsafe"]');
    check(`${tag}: Bestätigung wieder aus: nur "deaktiviert" bleibt gewählt, Speichern gesperrt ist nicht nötig`, await s.ev("return [...r.querySelectorAll('[data-sys=\"rt-st\"]')].filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.value).join() === 'disarmed' && [...r.querySelectorAll('[data-sys=\"rt-st\"]')].filter((b) => b.dataset.value !== 'disarmed').every((b) => b.disabled)"));
    await s.tap('[data-sys="rt-unsafe"]');
    await s.tap('[data-sys="rt-st"][data-value="armed"]');
    check(`${tag}: Vorschau des Ablaufs: Auslöser, Prüfung mit den zwei gewählten Zuständen und Aktion, Hinweis auf Übersprungen`, await s.ev("const f=r.querySelector('.ag-fl'); return !!f && f.querySelectorAll('.ag-fl-node').length === 3 && f.querySelectorAll('.ag-fl-band .on').length === 2 && f.querySelector('.ag-fl-node.arm') && f.querySelectorAll('.ag-fl-leaf').length >= 3"));
    await s.tap('[data-sys="rt-st"][data-value="disarmed"]');
    check(`${tag}: Vorschau folgt dem Entwurf (ein Zustand weniger)`, await s.ev("return r.querySelectorAll('.ag-fl-band .on').length === 1"));
    await s.tap('[data-sys="rt-st"][data-value="disarmed"]');
    const nModes = await s.ev("return r.querySelectorAll('[data-sys=\"rt-am\"]').length");
    check(`${tag}: "Anlage scharf" an: darunter ein Schalter je Modus, alle an`, nModes >= 2 && await s.ev("return [...r.querySelectorAll('[data-sys=\"rt-am\"]')].every((b) => b.getAttribute('aria-checked') === 'true')"));
    await s.tap('[data-sys="rt-am"]');
    check(`${tag}: ein Modus abgewählt: Vorschau nennt die übrigen`, await s.waitFor("return /\\(/.test(r.querySelector('.ag-fl-band .on').textContent)"));
    check(`${tag}: Vorschau reine Anzeige: nichts in ihr ist bedienbar`, await s.ev("return !r.querySelector('.ag-fl button, .ag-fl input, .ag-fl select, .ag-fl [data-sys]')"));
    await s.page.screenshot({ path: `${outDir}routines-editor-${lang}-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    check(`${tag}: kein Überlauf im Editor`, await s.ev("const d=r.getElementById('ag-step'); return d.scrollWidth <= d.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth"));
    if (mobile) check(`${tag}: Knöpfe unten im Fenster fest`, await s.ev("const d=r.getElementById('ag-step'); return d.lastElementChild.classList.contains('ag-dlg-btns')"));
    await s.tap('[data-sys="rt-save"]');
    await openList();
    check(`${tag}: Editor zu, vier Routinen, Änderung offen`, await s.waitFor("return !r.getElementById('ag-step').open && r.querySelectorAll('.ag-rtrow').length === 4 && r.host.systemUi.dirtyCount() === 1"));
    check(`${tag}: die neue Routine trägt bis zum Speichern der Seite den Hinweis "noch nicht gespeichert"`, await s.ev("return !!r.querySelector('.ag-sys-form .ag-rtsum .ag-unsaved')"));
    await savePage();
    check(`${tag}: nach dem Speichern der Seite ist der orange Hinweis weg (Seite und Liste)`, await s.waitFor("return !r.querySelector('.ag-sys-form .ag-rtsum .ag-unsaved')", 12000) && (await openList(), await s.waitFor("return r.querySelectorAll('#ag-rtlist .ag-rtrow').length > 3 && !r.querySelector('#ag-rtlist .ag-unsaved')")));
    check(`${tag}: gespeichert`, await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes('${t.saved}')`, 30000));
    // Nach dem Speichern und einer neuen Abfrage des Servers (der ergänzt Vorgaben und ordnet Schlüssel anders) darf nichts mehr offen sein: kein orange Punkt
    await s.waitFor("return !r.host._wait", 30000);
    await s.ev("return r.host._fetch().then(() => 1)");
    await s.page.waitForTimeout(400);
    check(`${tag}: nach dem Speichern und neuer Abfrage nichts offen, kein orange Punkt`, await s.ev("return r.host.systemUi.dirtyCount() === 0 && !r.querySelector('[data-sub=\"system\"]').classList.contains('has-edit') && r.querySelector('.ag-foot [data-sys=\"save\"]').disabled"));
    const ARMED_N = nModes - 1;
    const sent = (await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_system').at(-1)"))?.routines?.[3];
    check(`${tag}: Routine gesendet: Name, Ziel, Zustände, Baum mit Gruppe und Haltezeit, ohne Hilfsfelder`, sent?.name === "Haus verlassen" && sent.action === "away" && sent.unsafe === true
      && JSON.stringify(sent.states) === JSON.stringify(["armed", "disarmed"]) && sent.armed_modes.length === ARMED_N && sent.trigger.type === "device" && sent.trigger.hold === 5 && sent.trigger.tree.op === "and"
      && sent.trigger.tree.items[0].entity_id === "lock.haustuer" && sent.trigger.tree.items[1].op === "or" && sent.trigger.tree.items[1].items[0].state === "not_home"
      && sent.trigger.tree.items[1].items[1].kind === "time" && sent.trigger.tree.items[1].items[1].from === "22:00" && !("_device" in sent) && !("_times" in sent), JSON.stringify(sent));

    // Knöpfe der Routinen wie die der Schritte in den Aktionen: rund, 44 px, Reihenfolge Auge (Vorschau, 1.62.0), Stift, Kopieren, Papierkorb
    await openList();
    check(`${tag}: Knöpfe der Routine: Auge, Stift, Kopieren, Papierkorb, rund, mindestens 44 px, Abstand`, await s.ev(`const row=r.querySelector('.ag-rtrow .ag-wf-btns'); const b=[...row.querySelectorAll('.ag-iconbtn')]; const gap=b[1].getBoundingClientRect().left-b[0].getBoundingClientRect().right;
      return b.map((x)=>x.dataset.sys).join()==='rt-view,rt-edit,rt-dup,rt-del' && b.every((x)=>Math.round(x.getBoundingClientRect().width)>=44 && Math.round(x.getBoundingClientRect().height)>=44) && getComputedStyle(b[0]).borderTopWidth==='1px' && gap>=8`));
    // ----- Bestehende bearbeiten: Deaktivieren verlangt die Bestätigung -----
    await tapIn('[data-sys="rt-edit"][data-index="2"]');
    check(`${tag}: Heimkommen: Oder-Baum mit Gerät und Gruppe, Name steht drin`, await s.waitFor("return r.querySelector('[data-sys=\"rt-name\"]').value === 'Heimkommen' && r.querySelectorAll('.ag-rtleaf').length === 3 && !!r.querySelector('.ag-rtgroup')"));
    check(`${tag}: Vorschau bei Deaktivieren: rote Aktion mit Marke`, await s.ev("return !!r.querySelector('.ag-fl-node.off .ag-tag.err')"));
    check(`${tag}: Sicherheitskasten da, bestätigt, speicherbar`, await s.ev("return !!r.querySelector('.ag-rtsafety') && r.querySelector('[data-sys=\"rt-unsafe\"]').getAttribute('aria-checked') === 'true' && !r.querySelector('[data-sys=\"rt-save\"]').disabled"));
    await s.tap('[data-sys="rt-unsafe"]');
    check(`${tag}: Bestätigung weg: nur "deaktiviert" bleibt gewählt, die anderen gesperrt, Speichern möglich (nichts umgeht mehr den Code)`, await s.waitFor(`const on=[...r.querySelectorAll('[data-sys="rt-st"]')].filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.value).join(); return on === 'disarmed' && !r.querySelector('[data-sys="rt-save"]').disabled`));
    await s.tap('[data-sys="rt-unsafe"]');
    await s.tap('[data-sys="rt-st"][data-value="pending"]');
    check(`${tag}: Eingangsverzögerung bei Deaktivieren: roter Hinweis`, await s.waitFor("return !!r.querySelector('.ag-rtred')"));
    await s.tap('[data-sys="rt-cancel"]');
    check(`${tag}: Abbrechen mit offener Änderung fragt nach`, await s.waitFor("return r.getElementById('ag-confirm').open"));
    await s.tap('[data-c="yes"]');
    await openList();
    check(`${tag}: verworfen: Editor zu, Liste unverändert (vier Routinen, nichts offen)`, await s.waitFor("return !r.getElementById('ag-step').open && r.querySelectorAll('.ag-rtrow').length === 4 && r.host.systemUi.dirtyCount() === 0"));

    // ----- Duplizieren: Kopie hinter dem Original, ausgeschaltet, eindeutiger Name, erst nach dem Speichern gültig -----
    await openList();
    const before = await s.ev("return r.querySelectorAll('.ag-rtrow').length");
    await tapIn('[data-sys="rt-dup"][data-index="1"]');
    await openList();
    check(`${tag}: Duplizieren: eine Zeile mehr, Kopie hinter dem Original, ausgeschaltet, Name mit "${t.copy}", Änderung offen`, await s.waitFor(`const rows=[...r.querySelectorAll('.ag-rtrow')]; return rows.length === ${before} + 1 && rows[2].querySelector('b').textContent.includes(${JSON.stringify(t.copy)}) && rows[2].classList.contains('dim') && r.host.systemUi.dirtyCount() === 1`));
    await tapIn('[data-sys="rt-dup"][data-index="1"]');
    await openList();
    check(`${tag}: zweite Kopie bekommt einen anderen Namen`, await s.ev(`const n=[...r.querySelectorAll('.ag-rtrow b')].map((b) => b.textContent); return n.length === ${before} + 2 && new Set(n.map((x) => x.toLowerCase())).size === n.length`));
    await cancelPage();
    await openList();
    check(`${tag}: Abbrechen verwirft die Kopien`, await s.waitFor(`return r.querySelectorAll('.ag-rtrow').length === ${before} && r.host.systemUi.dirtyCount() === 0`));

    // ----- Tasten (Entität "event", zum Beispiel ein Hue-Taster): Auslöser im Augenblick des Drückens -----
    await tapIn('[data-sys="rt-add"]');
    await s.waitFor("return !!r.querySelector('.ag-rt-ed')");
    await (await s.el('[data-sys="rt-name"]')).fill("Taste scharf");
    await s.tap('[data-sys="rt-add-dev"][data-path=""]');
    await s.waitFor("return r.querySelectorAll('.ag-rtent').length === 7");
    await s.tap('[data-sys="rt-filter"][data-value="button"]');
    check(`${tag}: Filter Tasten zeigt die Taste, gesucht nach Name`, await s.waitFor("const e=[...r.querySelectorAll('.ag-rtent')]; return e.length === 1 && e[0].querySelector('b').textContent.includes('Taste 1')"));
    await s.tap('[data-sys="rt-choose"]');
    check(`${tag}: Taste gewählt: Arten des Drückens im Klartext, kein Zustand`, await s.waitFor(`const o=[...r.querySelectorAll('[data-sys="rt-state"] option')].map((x) => x.textContent); return o.length === 3 && o.includes(${JSON.stringify(t.short)})`));
    await (await s.el('[data-sys="rt-state"]')).selectOption("short_release");
    check(`${tag}: Haltezeit bei Tasten ausgeblendet, speicherbar`, await s.ev("return r.querySelector('.ag-rthold').hidden && !r.querySelector('[data-sys=\"rt-save\"]').disabled"));
    await s.tap('[data-sys="rt-save"]');
    await openList();
    await s.waitFor("return !r.getElementById('ag-step').open && r.querySelectorAll('.ag-rtrow').length === 5");
    await openList();
    check(`${tag}: Zeile nennt die Taste und die Art`, await s.ev(`return [...r.querySelectorAll('.ag-rtrow')].at(-1).innerText.includes(${JSON.stringify(t.short)})`));
    await tapIn('[data-sys="rt-del"][data-index="4"]');
    await openList();
    await s.waitFor("return r.querySelectorAll('.ag-rtrow').length === 4");

    // ----- Auslöser Zeitplan, mehrere Zeiten, Namen eindeutig -----
    await tapIn('[data-sys="rt-add"]');
    await s.waitFor("return !!r.querySelector('.ag-rt-ed')");
    await (await s.el('[data-sys="rt-name"]')).fill("nachts SCHARF");
    await s.tap('[data-sys="rt-seg"][data-key="trigger"][data-value="schedule"]');
    check(`${tag}: Zeitplan: eine Zeit, Tage als Knöpfe, schon speicherbar bis auf den Namen`, await s.waitFor("return r.querySelectorAll('.ag-rttimerow').length === 1 && r.querySelectorAll('.ag-rttimerow .ag-day.on').length === 5"));
    check(`${tag}: doppelter Name (ohne Beachtung der Grossschreibung) gesperrt`, await s.ev(`return r.querySelector('[data-sys="rt-save"]').disabled && r.querySelector('.ag-rt-ed .ag-dlg-err').textContent.includes(${JSON.stringify(t.taken)})`));
    await (await s.el('[data-sys="rt-name"]')).fill("Mittagspause");
    await s.tap('[data-sys="rt-add-timerow"]');
    await s.waitFor("return r.querySelectorAll('.ag-rttimerow').length === 2");
    const time = await s.el('.ag-rttimerow:nth-last-child(2) [data-sys="rt-time"]');
    await time.fill("12:15");
    check(`${tag}: Fokus bleibt in der Uhrzeit`, await s.ev("return r.activeElement?.dataset.sys === 'rt-time'"));
    for (const d of [0, 1, 2, 3, 4]) await s.tap(`.ag-rttimerow:nth-last-child(2) [data-sys="rt-day"][data-day="${d}"]`);
    check(`${tag}: Zeit ohne Tag gesperrt`, await s.ev(`return r.querySelector('[data-sys="rt-save"]').disabled && r.querySelector('.ag-rt-ed .ag-dlg-err').textContent.includes(${JSON.stringify(t.noDay)})`));
    await s.tap('.ag-rttimerow:nth-last-child(2) [data-sys="rt-day"][data-day="5"]');
    await s.tap('[data-sys="rt-seg"][data-key="action"][data-value="off"]');
    check(`${tag}: Deaktivieren, nur "deaktiviert": speicherbar ohne Bestätigung (die Marke "Umgeht den Code" fehlt noch)`, await s.ev("return !r.querySelector('[data-sys=\"rt-save\"]').disabled && !r.querySelector('.ag-fl-node.off .ag-tag.err')"));
    await s.tap('[data-sys="rt-unsafe"]');
    await s.tap('[data-sys="rt-st"][data-value="armed"]');
    check(`${tag}: mit Bestätigung und "Anlage scharf": speicherbar, die Marke "Umgeht den Code" steht da`, await s.ev("return !r.querySelector('[data-sys=\"rt-save\"]').disabled && !!r.querySelector('.ag-fl-node.off .ag-tag.err')"));
    await s.tap('[data-sys="rt-save"]');
    await openList();
    await s.waitFor("return !r.getElementById('ag-step').open && r.querySelectorAll('.ag-rtrow').length === 5");
    // Löschen einer Routine (Nachts scharf)
    await tapIn('[data-sys="rt-del"][data-index="0"]');
    await openList();
    check(`${tag}: gelöscht: vier Routinen, Änderung offen`, await s.waitFor("return r.querySelectorAll('.ag-rtrow').length === 4 && r.host.systemUi.dirtyCount() === 1"));
    await savePage();
    await s.waitFor(`return r.querySelector('.ag-foot').innerText.includes('${t.saved}')`, 30000);
    const sent2 = (await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_system').at(-1)"))?.routines?.at(-1);
    check(`${tag}: Zeitplan gesendet: eine Routine, zwei Zeiten mit eigenen Tagen, Deaktivieren bestätigt`, sent2?.name === "Mittagspause" && sent2.action === "off" && sent2.unsafe === true && JSON.stringify(sent2.states) === JSON.stringify(["armed", "disarmed"]) && sent2.trigger.type === "schedule"
      && sent2.trigger.times.length === 2 && JSON.stringify(sent2.trigger.times[1]) === JSON.stringify({ time: "12:15", days: [5] }), JSON.stringify(sent2));
    await s.waitFor("return !r.host._wait", 30000);
    await openList();
    await s.ev("r.querySelector('.ag-rtrow').scrollIntoView({ block: 'start' }); return 1");
    await s.page.waitForTimeout(400);
    await s.page.screenshot({ path: `${outDir}routines-list-${lang}-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    check(`${tag}: kein Überlauf auf der Seite`, await s.ev("return document.documentElement.scrollWidth <= window.innerWidth"));

    // ----- Protokoll -----
    const skipped = await s.ev(`return r.host._eventText({ kind: "routine_skipped", routine: "Heimkommen", reason: "state", at: "triggered", state: "triggered", mode: "away" })`);
    check(`${tag}: Protokolltext Routine übersprungen`, skipped === t.skipped, skipped);
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
