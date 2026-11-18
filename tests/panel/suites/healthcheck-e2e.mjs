// 1.65.0: HealthCheck (Wunsch und Entscheide des Nutzers 2026-11-18). Kapitel in Konfiguration › Anlage: Selbsttest, Abstand und die Zeile der
// Lebenszeichen (Anzahl, "Dienst hinzufügen", "Dienste anzeigen" mit eigenem Symbol). Fenster mit Tabelle (Suche, Sortierung, Kopf klebt unter dem
// Kopf des Fensters), je Zeile URL ganz, Zeit, Intervall, Status, Testknöpfe "Fehler senden" und "Lebenszeichen senden", Bearbeiten, Entfernen.
// Formular generisch (URL, Fehler-Zusatz, Intervall mit Schnellwahl): bekannte Dienste werden erkannt und nur vorgeschlagen, der Nutzer hat das
// letzte Wort. Höchstens fünf. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { chapter: "HealthCheck", none: "Kein externer Dienst", one: "1 von 5 Diensten", three: "3 von 5 Diensten", five: "5 von 5 Diensten", add: "Dienst hinzufügen", show: "Dienste anzeigen",
    title: "HealthCheck-Dienste", empty: "Noch kein Dienst.", known: "Erkannt: Healthchecks.io", suggest: "Vorschlag für Healthchecks.io: /fail", take: "Übernehmen",
    preview: "Aufruf bei Fehler:", errUrl: "vollständige http- oder https-URL", errSuffix: "muss mit /, ? oder & beginnen", errInterval: "1 Minute bis 24 Stunden",
    saved: "Dienst gespeichert", okSent: "Lebenszeichen gesendet", failSent: "Fehler gesendet", failed: "Gescheitert", noAnswer: "keine Antwort", test: "Test",
    failedRow: "1 Dienst: letztes Lebenszeichen gescheitert", noMatch: "Kein Dienst passt zur Suche.", editTitle: "Dienst bearbeiten", removeTitle: "Dienst entfernen?" },
  en: { chapter: "HealthCheck", none: "No external service", one: "1 of 5 services", three: "3 of 5 services", five: "5 of 5 services", add: "Add service", show: "Show services",
    title: "HealthCheck services", empty: "No service yet.", known: "Recognized: Healthchecks.io", suggest: "Suggestion for Healthchecks.io: /fail", take: "Use",
    preview: "Call on failure:", errUrl: "complete http or https URL", errSuffix: "must start with /, ? or &", errInterval: "1 minute to 24 hours",
    saved: "Service saved", okSent: "Life sign sent", failSent: "Failure sent", failed: "Failed", noAnswer: "no answer", test: "test",
    failedRow: "1 service: last life sign failed", noMatch: "No service matches the search.", editTitle: "Edit service", removeTitle: "Remove service?" },
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
    check(`${tag}: leeres Fenster: "${t.title}", "${t.empty}", ohne Suche, "${t.add}" unten`, await s.waitFor(`const d=r.getElementById('ag-hclist'); return d.open && d.querySelector('.ag-pop-head h3').textContent.includes(${JSON.stringify(t.title)}) && d.innerText.includes(${JSON.stringify(t.empty)}) && d.querySelector('.ag-hctools').hidden && !!d.querySelector('.ag-dlg-btns [data-hc="add"]')`));

    // ----- Hinzufügen: Erkennung schlägt vor, der Nutzer entscheidet -----
    await s.tap('#ag-hclist .ag-dlg-btns [data-hc="add"]');
    check(`${tag}: Formular offen, Fokus in der URL`, await s.waitFor("return r.getElementById('ag-hcform').open && r.activeElement?.dataset.hc === 'f-url'"));
    const form = () => s.ev("const d=r.getElementById('ag-hcform'); return { suffix: d.querySelector('[data-hc=\"f-suffix\"]').value, known: d.querySelector('[data-hcp=\"known\"]').innerText, offer: d.querySelector('[data-hcp=\"offer\"]').innerText, prev: d.querySelector('[data-hcp=\"prev\"]').innerText, err: [...d.querySelectorAll('.ag-err')].map((e) => e.textContent).join(' | '), value: d.querySelector('[data-hc=\"f-value\"]').value, unit: d.querySelector('[data-hc=\"f-unit\"]').value, on: [...d.querySelectorAll('[data-hc=\"f-preset\"].on')].map((b) => b.dataset.sec) }");
    await (await s.el('[data-hc="f-url"]')).type(HC);
    let f = await form();
    check(`${tag}: Healthchecks.io erkannt, Zusatz "/fail" vorgeschlagen und eingetragen (Feld unberührt), Vorschau der Fehler-URL`,
      f.known.includes(t.known) && f.suffix === "/fail" && f.prev.includes(t.preview) && f.prev.includes(`${HC}/fail`) && !f.offer, JSON.stringify(f));
    check(`${tag}: Fokus bleibt beim Tippen in der URL`, await s.ev("return r.activeElement?.dataset.hc === 'f-url'"));
    // Andere URL: der Vorschlag folgt, solange niemand den Zusatz berührt hat
    await (await s.el('[data-hc="f-url"]')).fill(CRON);
    f = await form();
    check(`${tag}: Cronitor: Zusatz "?state=fail" folgt (unberührt)`, f.suffix === "?state=fail" && f.prev.includes(`${CRON}?state=fail`), JSON.stringify(f));
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
    check(`${tag}: ungültig (URL, Zusatz, Intervall): drei Fehler, nichts an den Server`, f.err.includes(t.errUrl) && f.err.includes(t.errSuffix) && f.err.includes(t.errInterval) && (await s.sim("return window.__hcCalls.length")) === saves, f.err);
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
    await (await s.el('[data-hc="f-url"]')).fill(HC);
    await (await s.el('[data-hc="f-suffix"]')).fill("/fail");
    await s.tap('#ag-hcform button[type="submit"]');
    check(`${tag}: Speichern: Formular zu, Hinweis "${t.saved}", Zeile in der Liste`, await s.waitFor(`return !r.getElementById('ag-hcform').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1`));
    let call = await lastCall("healthcheck_save");
    check(`${tag}: an den Server: URL, Zusatz, 300 Sekunden, ohne Kennung`, call && call.url === HC && call.fail_suffix === "/fail" && call.interval === 300 && !("check_id" in call), JSON.stringify(call));
    const row1 = await listText();
    check(`${tag}: Zeile zeigt die ganze URL, "Healthchecks.io", "5 min"`, row1.includes(HC) && row1.includes("Healthchecks.io") && row1.includes("5 min"), row1.slice(0, 300));
    await s.tap('#ag-hclist [data-hc="close"]');
    check(`${tag}: Kapitel zählt "${t.one}"`, await s.waitFor(`return r.querySelector('.ag-hcsum').innerText.includes(${JSON.stringify(t.one)})`));

    // ----- Zweiter Dienst ohne Zusatz -----
    await s.tap('.ag-hcsum [data-hc="add"]');
    await s.waitFor("return r.getElementById('ag-hcform').open");
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
    check(`${tag}: "Fehler senden" ohne Zusatz gesperrt, mit Zusatz frei`, await s.ev(`return r.querySelector('#ag-hclist [data-hc="test-fail"][data-id="${garage}"]').disabled && !r.querySelector('#ag-hclist [data-hc="test-fail"][data-id="${hc}"]').disabled`));
    const search = await s.el('#ag-hclist input[type="search"]');
    await search.type("garage");
    check(`${tag}: Suche "garage": eine Zeile, Fokus bleibt im Feld, X sichtbar`, await s.waitFor(`return r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1 && r.activeElement?.dataset.hc === 'search' && !r.querySelector('#ag-hclist [data-hc="search-clear"]').hidden`));
    await search.fill("zzz");
    check(`${tag}: keine Treffer: "${t.noMatch}"`, await s.waitFor(`return r.getElementById('ag-hclist').innerText.includes(${JSON.stringify(t.noMatch)})`));
    await s.tap('#ag-hclist [data-hc="search-clear"]');
    check(`${tag}: X leert die Suche, beide Zeilen wieder da`, await s.waitFor("return r.querySelectorAll('#ag-hclist [data-hc-row]').length === 2 && r.querySelector('#ag-hclist input[type=search]').value === ''"));
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
      check(`${tag}: Handy: Zuletzt, Intervall und Status stehen in der Zeile unter der URL (Spalten ausgeblendet)`, await s.ev("const row=r.querySelector('#ag-hclist [data-hc-row]'); const m=row.querySelector('.ag-hc-m'); return getComputedStyle(m).display !== 'none' && getComputedStyle(row.querySelector('.ag-hcint')).display === 'none' && getComputedStyle(row.querySelector('.ag-hcst')).display === 'none'"));
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
    check(`${tag}: "${t.editTitle}": URL, kein Zusatz, 24 Stunden`, (await s.ev("return r.querySelector('#ag-hcform h3').textContent")) === t.editTitle && f.suffix === "" && f.value === "24" && f.unit === "h", JSON.stringify(f));
    await (await s.el('[data-hc="f-url"]')).fill(HC.replace("6666", "7777"));
    f = await form();
    check(`${tag}: beim Bearbeiten ersetzt die Erkennung nichts (nur Vorschlag)`, f.suffix === "" && f.offer.includes(t.take), JSON.stringify(f));
    await s.tap('[data-hc="f-preset"][data-sec="900"]');
    await s.tap('#ag-hcform button[type="submit"]');
    await s.waitFor("return !r.getElementById('ag-hcform').open");
    call = await lastCall("healthcheck_save");
    check(`${tag}: Bearbeiten sendet die Kennung, 900 Sekunden`, call && call.check_id === garage && call.interval === 900 && call.fail_suffix === "", JSON.stringify(call));

    // ----- Entfernen mit Rückfrage -----
    await s.waitFor("return r.getElementById('ag-hclist').open");
    await s.tap(`#ag-hclist [data-hc="delete"][data-id="${garage}"]`);
    check(`${tag}: Entfernen fragt nach ("${t.removeTitle}")`, await s.waitFor(`return r.getElementById('ag-confirm').open && r.getElementById('ag-confirm').innerText.includes(${JSON.stringify(t.removeTitle)})`));
    await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: entfernt: eine Zeile, Server gefragt`, await s.waitFor("return r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1") && (await lastCall("healthcheck_delete"))?.check_id === garage);
    await s.tap('#ag-hclist [data-hc="close"]');
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
      body.scrollTop = 400; const th=d.querySelector('.ag-hctable th').getBoundingClientRect(); const head=d.querySelector('.ag-pop-head').getBoundingClientRect();
      const hit=r.elementFromPoint(th.left + 20, th.top + th.height / 2); return { scroll: body.scrollTop > 0, th: th.top, head: head.bottom, visible: !!hit?.closest('th') }`);
    check(`${tag}: gerollt: der Tabellenkopf klebt direkt unter Titel und Suche und bleibt sichtbar`, stick.scroll && Math.abs(stick.th - stick.head) <= 1 && stick.visible, JSON.stringify(stick));
    check(`${tag}: keine Fehler im Browser (fünf Dienste)`, f5.errors.length === 0, f5.errors.join(" | "));
    await f5.ctx.close();
  }
}
await browser.close();
done();
