// 1.65.0: HealthCheck (Wunsch und Entscheide des Nutzers 2026-11-18), Namen und Darstellung seit 1.66.0 (Wünsche 2026-11-19). Kapitel in Konfiguration › Anlage: Selbsttest, Abstand und die Zeile der
// Lebenszeichen (Anzahl, "Dienst hinzufügen", "Dienste anzeigen" mit eigenem Symbol). Fenster mit Tabelle (Suche, Sortierung, Kopf klebt unter dem
// Kopf des Fensters), je Zeile Name, URL gekürzt, Zeit, Intervall, Status, runde Knöpfe "Fehler senden", "Lebenszeichen senden", Bearbeiten,
// Entfernen (auf dem Handy in einer eigenen Zeile). Formular generisch (Name als Pflichtfeld, URL, Fehler-Zusatz, ein Intervall mit Schnellwahl;
// kein eigenes bei scharfer Anlage, Entscheid des Nutzers 2026-11-19): bekannte Dienste werden erkannt und nur vorgeschlagen, der Nutzer hat das
// letzte Wort.
// Höchstens fünf. "Schliessen" steht neben "Dienst hinzufügen" (Wunsch des Nutzers 2026-11-19). Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { chapter: "HealthCheck", none: "Kein externer Dienst", one: "1 von 5 Diensten", three: "3 von 5 Diensten", five: "5 von 5 Diensten", add: "Dienst hinzufügen", show: "Dienste anzeigen",
    title: "HealthCheck-Dienste", empty: "Noch kein Dienst.", known: "Erkannt: Healthchecks.io", suggest: "Vorschlag für Healthchecks.io: /fail", take: "Übernehmen",
    preview: "Aufruf bei Fehler:", errUrl: "vollständige http- oder https-URL", errSuffix: "muss mit /, ? oder & beginnen", errInterval: "1 Minute bis 24 Stunden",
    saved: "Dienst gespeichert", okSent: "Lebenszeichen gesendet", failSent: "Fehler gesendet", failed: "Gescheitert", noAnswer: "keine Antwort", test: "Test",
    failedRow: "1 Dienst: letztes Lebenszeichen gescheitert", noMatch: "Kein Dienst passt zur Suche.", editTitle: "Dienst bearbeiten", removeTitle: "Dienst entfernen?",
    errName: "Einen Namen eingeben.", chaps: ["Dienst", "Bei Selbsttest-Fehler", "Bei Alarm", "Intervall"], alarmEmpty: "Ohne Zusatz wird diesem Dienst kein Alarm gemeldet." },
  en: { chapter: "HealthCheck", none: "No external service", one: "1 of 5 services", three: "3 of 5 services", five: "5 of 5 services", add: "Add service", show: "Show services",
    title: "HealthCheck services", empty: "No service yet.", known: "Recognized: Healthchecks.io", suggest: "Suggestion for Healthchecks.io: /fail", take: "Use",
    preview: "Call on failure:", errUrl: "complete http or https URL", errSuffix: "must start with /, ? or &", errInterval: "1 minute to 24 hours",
    saved: "Service saved", okSent: "Life sign sent", failSent: "Failure sent", failed: "Failed", noAnswer: "no answer", test: "test",
    failedRow: "1 service: last life sign failed", noMatch: "No service matches the search.", editTitle: "Edit service", removeTitle: "Remove service?",
    errName: "Enter a name.", chaps: ["Service", "On self-test failure", "On alarm", "Interval"], alarmEmpty: "Without a suffix no alarm is reported to this service." },
};
// Erfundene Adressen (nie eine echte Ping-URL)
const HC = "https://hc-ping.com/0a1b2c3d-1111-4222-8333-444455556666";
const CRON = "https://cronitor.link/p/9e8d7c6b5a4f3e2d/garage";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('.ag-health')");
    const lastCall = (type) => s.sim(`const c = window.__hcCalls.filter((m) => m.type === "alarmageddon/${type}").pop(); return c || null`);
    const listText = () => s.ev("return r.getElementById('ag-hclist').innerText");

    // ----- Kapitel -----
    const chap = await s.ev("const c=r.querySelector('.ag-health').closest('.ag-chap'); const sum=c.querySelector('.ag-hcsum'); return { title: c.querySelector('.ag-chap-t').textContent, sum: sum?.innerText || '', icon: !!sum?.querySelector('[data-hc=\"open\"] svg'), add: !!sum?.querySelector('[data-hc=\"add\"]:not([disabled])'), before: [...r.querySelectorAll('.ag-chap-t')].map((h) => h.textContent) }");
    const bkIndex = chap.before.findIndex((x) => /Backup/.test(x));
    check(`${tag}: Kapitel "${t.chapter}" vor dem Backup, Zeile "${t.none}" mit "${t.add}" und "${t.show}" (eigenes Symbol)`,
      chap.title === t.chapter && chap.sum.includes(t.none) && chap.sum.includes(t.add) && chap.sum.includes(t.show) && chap.icon && chap.add && chap.before.indexOf(t.chapter) < bkIndex, JSON.stringify(chap));

    // ----- Leere Liste -----
    await s.tap('.ag-hcsum [data-hc="open"]');
    check(`${tag}: leeres Fenster: "${t.title}", "${t.empty}" mit "${t.add}" in der Mitte, ohne Suche; unten nur "Schliessen" (wie Codes, Routinen, Töne)`, await s.waitFor(`const d=r.getElementById('ag-hclist'); return d.open && d.querySelector('.ag-pop-head h3').textContent.includes(${JSON.stringify(t.title)}) && d.innerText.includes(${JSON.stringify(t.empty)}) && d.querySelector('.ag-hctools').hidden && !!d.querySelector('.ag-rtempty [data-hc="add"]') && !d.querySelector('.ag-dlg-btns [data-hc="add"]') && !!d.querySelector('.ag-dlg-btns [data-hc="close"]')`));

    // ----- Hinzufügen: Erkennung schlägt vor, der Nutzer entscheidet -----
    await s.tap('#ag-hclist .ag-rtempty [data-hc="add"]');
    check(`${tag}: Formular offen, Fokus im Namen (Pflichtfeld, ganz oben)`, await s.waitFor("return r.getElementById('ag-hcform').open && r.activeElement?.dataset.hc === 'f-name' && r.querySelector('#ag-hcform .ag-hcfield input')?.dataset.hc === 'f-name'"));
    // Breite (1.67.0, Wunsch des Nutzers 2026-11-19): so breit wie die Liste dahinter (Standardbreite aller Fenster); Handy: ganzer Bildschirm
    const widths = await s.ev("const w=(id) => Math.round(r.getElementById(id).getBoundingClientRect().width); return { form: w('ag-hcform'), list: w('ag-hclist'), vw: innerWidth }");
    check(`${tag}: Formular so breit wie die Liste${mobile ? " (ganzer Bildschirm)" : " (Standardbreite)"}`, widths.form === widths.list && (mobile ? widths.form === widths.vw : widths.form > 600), JSON.stringify(widths));
    const form = () => s.ev("const d=r.getElementById('ag-hcform'); const q=(sel)=>d.querySelector(sel); return { suffix: q('[data-hc=\"f-suffix\"]').value, known: q('[data-hcp=\"known\"]').innerText, offer: q('[data-hcp=\"offer\"]').innerText, prev: q('[data-hcp=\"prev\"]').innerText, err: [...d.querySelectorAll('.ag-err')].map((e) => e.textContent).join(' | '), value: q('[data-hc=\"f-value\"]').value, unit: q('[data-hc=\"f-unit\"]').value, on: [...d.querySelectorAll('[data-hc=\"f-preset\"].on')].map((b) => b.dataset.sec), values: d.querySelectorAll('[data-hc=\"f-value\"]').length }");
    await (await s.el('[data-hc="f-url"]')).type(HC);
    let f = await form();
    check(`${tag}: Healthchecks.io erkannt, Zusatz "/fail" vorgeschlagen und eingetragen (Feld unberührt), Vorschau der Fehler-URL`,
      f.known.includes(t.known) && f.suffix === "/fail" && f.prev.includes(t.preview) && f.prev.includes(`${HC}/fail`) && !f.offer, JSON.stringify(f));
    check(`${tag}: Healthchecks.io erkannt: auch der Alarm-Zusatz "/2" ist eingesetzt`, await s.ev("return r.querySelector('#ag-hcform [data-hc=\"f-alarm\"]').value === '/2'"));
    check(`${tag}: Fokus bleibt beim Tippen in der URL`, await s.ev("return r.activeElement?.dataset.hc === 'f-url'"));
    // Andere URL: der Vorschlag folgt, solange niemand den Zusatz berührt hat
    await (await s.el('[data-hc="f-url"]')).fill(CRON);
    f = await form();
    check(`${tag}: Cronitor: Zusatz mit englischer Meldung folgt (unberührt)`, f.suffix === "?state=fail&message=Self-test+failed" && f.prev.includes(`${CRON}?state=fail&message=Self-test+failed`), JSON.stringify(f));
    // Alarm-Zusatz: eigenes Kapitel ohne Zusatz "freiwillig" im Titel; seit 1.74.1 (Wunsch des Nutzers 2026-11-21) setzt ein erkannter Dienst beide Zusätze von selbst ein,
    // solange sie niemand berührt hat; beide bleiben freiwillig (leer speichern geht, dann entfällt der Testknopf)
    const chapters = await s.ev("const d=r.getElementById('ag-hcform'); return [...d.querySelectorAll('section.ag-chap > h3.ag-chap-t')].map((h) => h.textContent)");
    check(`${tag}: Formular in vier Kapiteln mit Titel (Strich davor): ${t.chaps.join(", ")}`, JSON.stringify(chapters) === JSON.stringify(t.chaps), JSON.stringify(chapters));
    const alarm = await s.ev("const d=r.getElementById('ag-hcform'); const q=(sel)=>d.querySelector(sel); return { value: q('[data-hc=\"f-alarm\"]').value, offer: q('[data-hcp=\"offerAlarm\"]').innerText, prev: q('[data-hcp=\"prevAlarm\"]').innerText }");
    check(`${tag}: Cronitor erkannt: der Alarm-Zusatz ist von selbst eingesetzt ("?state=fail&message=Alarm+triggered"), Vorschau mit der Adresse, kein Vorschlag daneben`,
      alarm.value === "?state=fail&message=Alarm+triggered" && !alarm.offer && alarm.prev.includes(`${CRON}?state=fail&message=Alarm+triggered`), JSON.stringify(alarm));
    // Der Nutzer ändert den Zusatz: der Vorschlag steht wieder daneben ("Übernehmen")
    await (await s.el('[data-hc="f-alarm"]')).fill("/meinalarm");
    // "Übernehmen" ist ein kräftiger Knopf (fett, getönter Hintergrund, Rand, mindestens 34 px hoch), beim Fehler- wie beim Alarm-Zusatz
    const loud = await s.ev("const d=r.getElementById('ag-hcform'); return [...d.querySelectorAll('.ag-hcoffer > button.ag-link')].map((b) => { const c=getComputedStyle(b); return { w: parseInt(c.fontWeight), h: Math.round(b.getBoundingClientRect().height), bg: c.backgroundColor, bw: c.borderTopWidth }; })");
    check(`${tag}: "${t.take}" ist ein kräftiger Knopf (fett, Hintergrund, Rand, mind. 34 px)`, loud.length >= 1 && loud.every((l) => l.w >= 700 && l.h >= 34 && l.bg !== "rgba(0, 0, 0, 0)" && l.bw === "1px"), JSON.stringify(loud));
    await s.tap('#ag-hcform [data-hc="f-take-alarm"]');
    const taken = await s.ev("const d=r.getElementById('ag-hcform'); const q=(sel)=>d.querySelector(sel); return { value: q('[data-hc=\"f-alarm\"]').value, offer: q('[data-hcp=\"offerAlarm\"]').innerText, prev: q('[data-hcp=\"prevAlarm\"]').innerText }");
    check(`${tag}: "${t.take}" setzt den Alarm-Zusatz wieder, Vorschau mit der Adresse, kein Vorschlag mehr`, taken.value === "?state=fail&message=Alarm+triggered" && !taken.offer && taken.prev.includes(`${CRON}?state=fail&message=Alarm+triggered`), JSON.stringify(taken));
    await (await s.el('[data-hc="f-alarm"]')).fill("");
    // Eigener Zusatz: das letzte Wort hat der Nutzer
    await (await s.el('[data-hc="f-suffix"]')).fill("/meins");
    await (await s.el('[data-hc="f-url"]')).fill(HC);
    f = await form();
    check(`${tag}: eigener Zusatz bleibt bei neuer URL; der Vorschlag steht daneben ("${t.suggest}", "${t.take}")`, f.suffix === "/meins" && f.offer.includes(t.suggest) && f.offer.includes(t.take), JSON.stringify(f));
    await s.tap('[data-hc="f-take"]');
    f = await form();
    check(`${tag}: "${t.take}" setzt den Vorschlag, danach kein Vorschlag mehr`, f.suffix === "/fail" && !f.offer, JSON.stringify(f));

    // ----- Prüfungen im Formular -----
    await (await s.el('[data-hc="f-url"]')).fill("ftp://example.org/x");
    await (await s.el('[data-hc="f-suffix"]')).fill("fail");
    await (await s.el('[data-hc="f-value"]')).fill("0");
    const saves = (await s.sim("return window.__hcCalls.length"));
    await s.tap('#ag-hcform button[type="submit"]');
    f = await form();
    check(`${tag}: ungültig (Name leer, URL, Zusatz, Intervall): Fehler je Feld ("${t.errName}"), nichts an den Server`, f.err.includes(t.errName) && f.err.includes(t.errUrl) && f.err.includes(t.errSuffix) && f.err.includes(t.errInterval) && (await s.sim("return window.__hcCalls.length")) === saves, f.err);
    // Schnellwahl und Einheit
    await s.tap('[data-hc="f-preset"][data-sec="3600"]');
    f = await form();
    check(`${tag}: Schnellwahl "1 h": 1 Stunde, Knopf gewählt, Fehler des Intervalls weg`, f.value === "1" && f.unit === "h" && JSON.stringify(f.on) === '["3600"]' && !f.err.includes(t.errInterval), JSON.stringify(f));
    await s.page.evaluate(() => 0);
    await (await s.el('[data-hc="f-unit"]')).selectOption("min");
    f = await form();
    check(`${tag}: Einheit auf Minuten: 60 min (umgerechnet)`, f.value === "60" && f.unit === "min" && JSON.stringify(f.on) === '["3600"]', JSON.stringify(f));
    await (await s.el('[data-hc="f-value"]')).fill("1500");
    f = await form();
    check(`${tag}: 1500 Minuten (über 24 Stunden) ist ungültig`, f.err.includes(t.errInterval), JSON.stringify(f));
    await s.tap('[data-hc="f-preset"][data-sec="300"]');
    f = await form();
    check(`${tag}: ein Intervall (kein eigenes bei scharfer Anlage), Schnellwahl 5 min`, f.values === 1 && f.value === "5" && f.unit === "min" && JSON.stringify(f.on) === '["300"]' && !(await s.ev("return !!r.querySelector('#ag-hcform [data-iv]')")), JSON.stringify(f));
    await (await s.el('[data-hc="f-name"]')).fill("  Healthchecks Haus ");
    await (await s.el('[data-hc="f-url"]')).fill(HC);
    await (await s.el('[data-hc="f-suffix"]')).fill("/fail");
    await s.tap('#ag-hcform button[type="submit"]');
    check(`${tag}: Speichern: Formular zu, Hinweis "${t.saved}", Zeile in der Liste`, await s.waitFor(`return !r.getElementById('ag-hcform').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1`));
    let call = await lastCall("healthcheck_save");
    check(`${tag}: an den Server: Name, URL, Zusatz, 300 Sekunden, ohne Kennung und ohne zweites Intervall`, call && call.name === "Healthchecks Haus" && call.url === HC && call.fail_suffix === "/fail" && call.interval === 300 && !("interval_armed" in call) && !("check_id" in call), JSON.stringify(call));
    const row1 = await s.ev("const row=r.querySelector('#ag-hclist [data-hc-row]'); const a=row.querySelector('.ag-hcaddr'); return { text: row.innerText, name: row.querySelector('.ag-hcname')?.textContent, title: a.title, cut: a.scrollWidth > a.clientWidth + 1 }");
    check(`${tag}: Zeile zeigt den Namen, die URL gekürzt (ganz im Tooltip), "Healthchecks.io" und das Intervall 5 min`,
      row1.name === "Healthchecks Haus" && row1.title === HC && row1.cut && row1.text.includes("Healthchecks.io") && row1.text.includes("5 min"), JSON.stringify(row1));
    // Knöpfe der Zeile: rund wie bei Routinen und Tönen; auf dem Handy in einer eigenen Zeile unter dem Eintrag, rechts
    // Seit 1.68.0 fünf: "Protokoll" zuerst (Wunsch des Nutzers: links von "Fehler senden")
    const btns = await s.ev("const row=r.querySelector('#ag-hclist [data-hc-row]'); const b=[...row.querySelectorAll('.ag-wf-btns .ag-iconbtn')]; const cs=getComputedStyle(b[0]); const u=row.querySelector('td.ag-hcurl').getBoundingClientRect(); const box=row.querySelector('.ag-wf-btns').getBoundingClientRect(); return { n: b.length, acts: b.map((x) => x.dataset.hc).join(), w: Math.round(b[0].getBoundingClientRect().width), border: cs.borderTopStyle, below: box.top >= u.bottom - 1, right: Math.round(u.right - b[b.length - 1].getBoundingClientRect().right), left: Math.round(b[0].getBoundingClientRect().left - u.left) }");
    check(`${tag}: fünf runde Knöpfe (44 px, mit Rand), "Protokoll" zuerst${mobile ? ", in eigener Zeile unter dem Eintrag, rechts, alle in der Breite" : ""}`, btns.n === 5 && btns.acts === "log,test-fail,test-ok,edit,delete" && btns.w === 44 && btns.border === "solid" && (!mobile || (btns.below && btns.right <= 16 && btns.left >= 0)), JSON.stringify(btns));
    // Fusszeile: "Schliessen" neben "Dienst hinzufügen", beide rechts
    const foot = await s.ev("const d=r.getElementById('ag-hclist'); const f=d.querySelector('.ag-dlg-btns'); const c=f.querySelector('[data-hc=\"close\"]').getBoundingClientRect(); const a=f.querySelector('[data-hc=\"add\"]').getBoundingClientRect(); const fr=f.getBoundingClientRect(); return { gap: Math.round(a.left - c.right), right: Math.round(fr.right - a.right), order: c.left < a.left }");
    check(`${tag}: Fusszeile: "Schliessen" direkt neben "${t.add}", rechts (wie in allen Fenstern mit Liste)`, foot.order && foot.gap >= 0 && foot.gap <= 12 && foot.right <= 30, JSON.stringify(foot));
    await s.tap('#ag-hclist [data-hc="close"]');
    check(`${tag}: Kapitel zählt "${t.one}"`, await s.waitFor(`return r.querySelector('.ag-hcsum').innerText.includes(${JSON.stringify(t.one)})`));

    // ----- Zweiter Dienst ohne Zusatz -----
    await s.tap('.ag-hcsum [data-hc="add"]');
    await s.waitFor("return r.getElementById('ag-hcform').open");
    await (await s.el('[data-hc="f-name"]')).fill("Garage");
    await (await s.el('[data-hc="f-url"]')).fill("https://ping.example.net/check/garage");
    f = await form();
    check(`${tag}: unbekannter Dienst: nichts erkannt, kein Zusatz`, !f.known && f.suffix === "" && !f.offer, JSON.stringify(f));
    await s.tap('[data-hc="f-preset"][data-sec="86400"]');
    await s.tap('#ag-hcform button[type="submit"]');
    await s.waitFor("return !r.getElementById('ag-hcform').open");
    call = await lastCall("healthcheck_save");
    check(`${tag}: ohne Zusatz gespeichert, 24 Stunden`, call && call.fail_suffix === "" && call.interval === 86400, JSON.stringify(call));

    // ----- Liste: Suche, Sortierung, Testknöpfe -----
    await s.tap('.ag-hcsum [data-hc="open"]');
    await s.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 2");
    const garage = await s.sim("return window.__healthchecks.find((x) => x.url.includes('garage')).id");
    const hc = await s.sim("return window.__healthchecks.find((x) => x.url.includes('hc-ping')).id");
    check(`${tag}: "Fehler senden" gibt es nur mit Fehler-Zusatz (ohne Zusatz fehlt der Knopf, wie "Alarm senden")`, await s.ev(`const q=(id) => r.querySelector('#ag-hclist [data-hc="test-fail"][data-id="' + id + '"]'); return !q("${garage}") && !!q("${hc}") && !q("${hc}").disabled`));
    const search = await s.el('#ag-hclist input[type="search"]');
    await search.type("garage");
    check(`${tag}: Suche "garage": eine Zeile, Fokus bleibt im Feld, X sichtbar`, await s.waitFor(`return r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1 && r.activeElement?.dataset.hc === 'search' && !r.querySelector('#ag-hclist [data-hc="search-clear"]').hidden`));
    await search.fill("zzz");
    check(`${tag}: keine Treffer: "${t.noMatch}"`, await s.waitFor(`return r.getElementById('ag-hclist').innerText.includes(${JSON.stringify(t.noMatch)})`));
    await s.tap('#ag-hclist [data-hc="search-clear"]');
    check(`${tag}: X leert die Suche, beide Zeilen wieder da`, await s.waitFor("return r.querySelectorAll('#ag-hclist [data-hc-row]').length === 2 && r.querySelector('#ag-hclist input[type=search]').value === ''"));
    // "Was sind HealthCheck-Dienste?" (1.67.0, Wunsch des Nutzers 2026-11-19): zum Aufklappen unter der Liste, wie "Was prüft der Selbsttest?",
    // mit vier Beispielen als Links in einem neuen Fenster; bleibt offen, wenn das Fenster neu gezeichnet wird
    const about = () => s.ev("const d=r.querySelector('#ag-hclist details.ag-hc-about'); if (!d) return null; const b=d.getBoundingClientRect(), t=r.querySelector('#ag-hclist .ag-hcbody').getBoundingClientRect(); return { open: d.open, summary: d.querySelector('summary').textContent.trim(), below: b.top >= t.bottom - 1, info: !!d.querySelector('summary svg'), lines: d.querySelectorAll('.ag-st-ul:not(.ag-hc-ex) li').length, links: [...d.querySelectorAll('.ag-hc-ex a')].map((a) => [a.textContent, a.getAttribute('href'), a.target, a.rel]) }");
    const a0 = await about();
    check(`${tag}: "${lang === "de" ? "Was sind HealthCheck-Dienste?" : "What are HealthCheck services?"}" unter der Liste, zugeklappt, mit Info-Symbol`, !!a0 && !a0.open && a0.below && a0.info && a0.summary === (lang === "de" ? "Was sind HealthCheck-Dienste?" : "What are HealthCheck services?"), JSON.stringify(a0));
    await s.tap("#ag-hclist .ag-hc-about summary");
    const a1 = await about();
    check(`${tag}: aufgeklappt: vier Absätze und vier Beispiele (Healthchecks.io, Cronitor, Better Stack, Uptime Kuma) als https-Links in neuem Fenster`, a1.open && a1.lines === 4
      && JSON.stringify(a1.links.map((l) => l[0])) === JSON.stringify(["Healthchecks.io", "Cronitor", "Better Stack", "Uptime Kuma"]) && a1.links.every((l) => l[1].startsWith("https://") && l[2] === "_blank" && l[3].includes("noopener")), JSON.stringify(a1));
    await s.ev("r.host.healthcheck.renderList(true); return 1");
    check(`${tag}: neu gezeichnet: bleibt aufgeklappt`, (await about())?.open === true);
    await s.tap('#ag-hclist [data-hc="close"]');
    await s.tap('.ag-hcsum [data-hc="open"]');
    await s.waitFor("return r.getElementById('ag-hclist').open");
    check(`${tag}: nach Schliessen und Öffnen des Fensters bleibt es aufgeklappt`, (await about())?.open === true);
    await s.tap("#ag-hclist .ag-hc-about summary");
    check(`${tag}: zugeklappt bleibt es zu`, (await about())?.open === false);
    // Sortieren nach Intervall (nur auf dem Desktop als Spalte; auf dem Handy über die URL)
    const order = () => s.ev("return [...r.querySelectorAll('#ag-hclist [data-hc-row]')].map((x) => x.dataset.hcRow)");
    if (!mobile) {
      await s.tap('#ag-hclist [data-hc="sort"][data-key="interval"]');
      let o = await order();
      check(`${tag}: Sortierung nach Intervall aufsteigend (5 min vor 24 h), Kopf zeigt es`, JSON.stringify(o) === JSON.stringify([hc, garage]) && (await s.ev("return r.querySelector('#ag-hclist th[aria-sort=\"ascending\"]')?.textContent || ''")).length > 0, JSON.stringify(o));
      await s.tap('#ag-hclist [data-hc="sort"][data-key="interval"]');
      o = await order();
      check(`${tag}: noch einmal: absteigend`, JSON.stringify(o) === JSON.stringify([garage, hc]) && !!(await s.ev("return r.querySelector('#ag-hclist th[aria-sort=\"descending\"]')")), JSON.stringify(o));
    } else {
      check(`${tag}: Handy: Zuletzt, Intervall und Status stehen unter Name und URL (Spalten ausgeblendet)`, await s.ev("const row=r.querySelector('#ag-hclist [data-hc-row]'); const m=row.querySelector('.ag-hc-m'); return getComputedStyle(m).display !== 'none' && getComputedStyle(row.querySelector('.ag-hcint')).display === 'none' && getComputedStyle(row.querySelector('.ag-hcst')).display === 'none'"));
      check(`${tag}: Handy: Tabelle passt ohne seitliches Scrollen`, await s.ev("const d=r.getElementById('ag-hclist'); const b=d.querySelector('.ag-dlg-body'); return b.scrollWidth <= b.clientWidth + 1 && d.querySelector('.ag-hctable').getBoundingClientRect().right <= innerWidth"));
    }
    await s.tap(`#ag-hclist [data-hc="test-ok"][data-id="${hc}"]`);
    check(`${tag}: "Lebenszeichen senden": Test an den Server, Zeile zeigt "${t.okSent} (${t.test})"`, await s.waitFor(`return r.querySelector('#ag-hclist [data-hc-row="${hc}"]').innerText.includes(${JSON.stringify(`${t.okSent} (${t.test})`)})`)
      && JSON.stringify(await lastCall("healthcheck_ping")).includes('"kind":"ok"'));
    await s.sim('window.__hcResult = "timeout"; return 1');
    await s.tap(`#ag-hclist [data-hc="test-fail"][data-id="${hc}"]`);
    check(`${tag}: "Fehler senden": Fehler an den Server; keine Antwort: rot "${t.failed} (${t.test}) · ${t.noAnswer}"`, await s.waitFor(`const st=r.querySelector('#ag-hclist [data-hc-row="${hc}"] .ag-hcstate'); return st.innerText.includes(${JSON.stringify(t.failed)}) && st.innerText.includes(${JSON.stringify(t.noAnswer)}) && st.classList.contains('err')`)
      && JSON.stringify(await lastCall("healthcheck_ping")).includes('"kind":"fail"'));
    await s.sim('window.__hcResult = "ok"; return 1');
    await s.tap('#ag-hclist [data-hc="close"]');
    check(`${tag}: Kapitel zeigt "${t.failedRow}"`, await s.waitFor(`return r.querySelector('.ag-hcsum').innerText.includes(${JSON.stringify(t.failedRow)})`));

    // ----- Bearbeiten: Werte da, der eigene Zusatz bleibt -----
    await s.tap('.ag-hcsum [data-hc="open"]');
    await s.waitFor("return r.getElementById('ag-hclist').open");
    await s.tap(`#ag-hclist [data-hc="edit"][data-id="${garage}"]`);
    await s.waitFor("return r.getElementById('ag-hcform').open");
    f = await form();
    check(`${tag}: "${t.editTitle}": Name, kein Zusatz, 24 Stunden`, (await s.ev("return r.querySelector('#ag-hcform h3').textContent")) === t.editTitle && (await s.ev("return r.querySelector('[data-hc=\"f-name\"]').value")) === "Garage" && f.suffix === "" && f.value === "24" && f.unit === "h", JSON.stringify(f));
    await (await s.el('[data-hc="f-url"]')).fill(HC.replace("6666", "7777"));
    f = await form();
    check(`${tag}: beim Bearbeiten ersetzt die Erkennung nichts (nur Vorschlag)`, f.suffix === "" && f.offer.includes(t.take), JSON.stringify(f));
    await s.tap('[data-hc="f-preset"][data-sec="900"]');
    await s.tap('#ag-hcform button[type="submit"]');
    await s.waitFor("return !r.getElementById('ag-hcform').open");
    call = await lastCall("healthcheck_save");
    check(`${tag}: Bearbeiten sendet die Kennung, den Namen und 900 Sekunden`, call && call.check_id === garage && call.name === "Garage" && call.interval === 900 && !("interval_armed" in call) && call.fail_suffix === "", JSON.stringify(call));

    // ----- Entfernen mit Rückfrage -----
    await s.waitFor("return r.getElementById('ag-hclist').open");
    await s.tap(`#ag-hclist [data-hc="delete"][data-id="${garage}"]`);
    check(`${tag}: Entfernen fragt nach ("${t.removeTitle}", mit dem Namen)`, await s.waitFor(`return r.getElementById('ag-confirm').open && r.getElementById('ag-confirm').innerText.includes(${JSON.stringify(t.removeTitle)}) && r.getElementById('ag-confirm').innerText.includes('"Garage"')`));
    await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: entfernt: eine Zeile, Server gefragt`, await s.waitFor("return r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1") && (await lastCall("healthcheck_delete"))?.check_id === garage);
    await s.tap('#ag-hclist [data-hc="close"]');
    // Symbole der Kapitel je mit eigener Pastellfarbe (Wunsch des Nutzers 2026-11-19): nur das Symbol, der Selbsttest bleibt grün
    // Je Kapitel die Farbe (auch wenn das Symbol grau ist, weil das Kapitel leer ist); die eingeschalteten zeigen sie
    const tints = await s.ev(`const out = {}; for (const k of ["routines", "codes", "sounds", "health", "backup"]) { const el = r.querySelector('.ag-tint-' + k + '.on') || r.querySelector('.ag-tint-' + k); if (el) { const cs = getComputedStyle(el); const probe = document.createElement('span'); probe.style.color = cs.getPropertyValue('--ag-tint').trim(); r.appendChild(probe); const tint = getComputedStyle(probe).color; probe.remove(); out[k] = { tint, on: el.classList.contains('on'), color: cs.color, bg: cs.backgroundColor, row: getComputedStyle(el.closest('.ag-setrow')).backgroundColor }; } }
      const probe = document.createElement('span'); probe.style.color = getComputedStyle(r.host).getPropertyValue('--ag-primary'); r.appendChild(probe); const primary = getComputedStyle(probe).color; probe.style.color = getComputedStyle(r.host).getPropertyValue('--ag-success'); const success = getComputedStyle(probe).color; probe.remove();
      const st = r.querySelector('.ag-stsum .ag-st-av'); const plain = getComputedStyle(r.querySelector('.ag-health .ag-setrow:not(.ag-rtsum)') || r.querySelector('.ag-setrow')).backgroundColor;
      return { out, primary, success, st: st && getComputedStyle(st).color, plain }`);
    const vals = Object.values(tints.out);
    const on = vals.filter((v) => v.on);
    check(`${tag}: Kapitel-Symbole (Routinen, Codes, Töne, HealthCheck, Backup) je eigene Farbe, nicht Blau; eingeschaltete in ihrer Farbe, Hintergrund der Zeile unverändert; Selbsttest grün`,
      vals.length === 5 && new Set(vals.map((v) => v.tint)).size === 5 && vals.every((v) => v.tint !== tints.primary && v.tint !== tints.success && v.row === tints.plain)
      && on.length >= 4 && on.every((v) => v.color === v.tint && v.bg !== "rgba(0, 0, 0, 0)") && tints.st === tints.success, JSON.stringify(tints));
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Höchstzahl, Kopf der Tabelle klebt unter dem Kopf des Fensters -----
    const f5 = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&hc=full", size: mobile ? null : { width: 1400, height: 600 } });
    await f5.waitFor("return !!r.querySelector('.ag-health')");
    check(`${tag}: fünf Dienste: "${t.five}", "${t.add}" gesperrt`, await f5.ev(`const sum=r.querySelector('.ag-hcsum'); return sum.innerText.includes(${JSON.stringify(t.five)}) && sum.querySelector('[data-hc="add"]').disabled`));
    await f5.tap('.ag-hcsum [data-hc="open"]');
    await f5.waitFor("return r.getElementById('ag-hclist').open");
    await f5.page.waitForTimeout(300);
    check(`${tag}: fünf Zeilen, "${t.add}" im Fenster gesperrt`, await f5.ev("const d=r.getElementById('ag-hclist'); return d.querySelectorAll('[data-hc-row]').length === 5 && d.querySelector('.ag-dlg-btns [data-hc=\"add\"]').disabled"));
    const stick = await f5.ev(`const d=r.getElementById('ag-hclist'); const body=d.querySelector('.ag-dlg-body'); if (!(body.scrollHeight > body.clientHeight + 20)) return { scroll: false };
      body.scrollTop = 400; const th=(getComputedStyle(d.querySelector('.ag-hctable tr')).display === 'none' ? d.querySelector('.ag-hcrow') : d.querySelector('.ag-hctable th')).getBoundingClientRect(); const head=d.querySelector('.ag-pop-head').getBoundingClientRect();
      const hit=r.elementFromPoint(th.left + 20, th.top + th.height / 2); return { scroll: body.scrollTop > 0, th: th.top, head: head.bottom, visible: !!hit?.closest('th, .ag-hcrow') }`);
    check(`${tag}: gerollt: der Tabellenkopf klebt direkt unter Titel und Suche und bleibt sichtbar`, stick.scroll && Math.abs(stick.th - stick.head) <= 1 && stick.visible, JSON.stringify(stick));
    check(`${tag}: keine Fehler im Browser (fünf Dienste)`, f5.errors.length === 0, f5.errors.join(" | "));
    await f5.ctx.close();
  }
}
await browser.close();
done();
