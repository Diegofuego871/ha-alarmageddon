// 1.76.0: Link zum Dashboard eines HealthCheck-Dienstes (Wunsch des Nutzers 2026-11-22): freiwilliges Feld ganz unten im Formular, bei erkannten Diensten
// vorgeschlagen (der Nutzer hat das letzte Wort), nur mit Link eine Zeile in den Angaben des Dienstes (Link in neuem Fenster und Kopierknopf).
// Je Sprache, Desktop und Handy, echte Klicks/Taps, nur erfundene Adressen.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { chap: "Dashboard", row: "Dashboard", err: "Der Link muss mit http:// oder https:// beginnen", take: "Übernehmen" },
  en: { chap: "Dashboard", row: "Dashboard", err: "The link must start with http:// or https://", take: "Use" },
};
const CRON = "b2c3d4e5f6a1"; // erfundener Dienst mit Link (?hc=sample)
const HC = "a1b2c3d4e5f6"; // ohne Link
const CUSTOM = "https://meine-ueberwachung.example.org/dashboard";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&hc=sample" });
    await s.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
    await s.tap('.ag-hcsum [data-hc="open"]');
    await s.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 3");
    const form = () => s.ev("const d=r.getElementById('ag-hcform'); const q=(x) => d.querySelector(x); return { page: q('[data-hc=\"f-page\"]')?.value, offer: q('[data-hcp=\"offerPage\"]')?.innerText || '', err: q('[data-hcp=\"err-page\"]')?.innerText || '', chaps: [...d.querySelectorAll('.ag-chap-t')].map((c) => c.textContent), focus: r.activeElement?.dataset.hc }");

    // ----- Bearbeiten: der gespeicherte Link steht im Feld, Kapitel "Dashboard" als letztes vor dem Intervall -----
    await s.tap(`#ag-hclist [data-hc-row="${CRON}"] [data-hc="edit"]`);
    await s.waitFor("return r.getElementById('ag-hcform').open");
    let f = await form();
    const n = f.chaps.length;
    check(`${tag}: Formular: Feld mit dem gespeicherten Link, Kapitel "${t.chap}" ganz unten direkt vor dem Intervall`, f.page === "https://cronitor.io/app" && f.chaps[n - 2] === t.chap, JSON.stringify(f));
    check(`${tag}: erkannter Dienst, Link entspricht dem Vorschlag: kein "${t.take}" daneben`, !f.offer.includes(t.take), JSON.stringify(f));
    // eigener Link: bleibt auch, wenn die URL des Dienstes wechselt (der Nutzer hat das letzte Wort), der Vorschlag steht dann mit "Übernehmen" daneben
    await (await s.el('[data-hc="f-page"]')).fill(CUSTOM);
    await (await s.el('[data-hc="f-url"]')).fill("https://hc-ping.com/0a1b2c3d-1111-4222-8333-444455556666");
    f = await form();
    check(`${tag}: eigener Link bleibt nach Wechsel der URL, Vorschlag mit "${t.take}" daneben`, f.page === CUSTOM && f.offer.includes("healthchecks.io/accounts/login") && f.offer.includes(t.take), JSON.stringify(f));
    await s.tap('#ag-hcform [data-hc="f-take-page"]');
    check(`${tag}: "${t.take}" setzt den Vorschlag ein`, (await form()).page === "https://healthchecks.io/accounts/login/");
    // ungültig: Fehler, Speichern gesperrt
    await (await s.el('[data-hc="f-page"]')).fill("javascript:alert(1)");
    f = await form();
    check(`${tag}: ungültiger Link ("javascript:") meldet "${t.err}"`, f.err.includes(t.err), JSON.stringify(f));
    const before = await s.sim("return window.__hcCalls.length");
    await s.tap('#ag-hcform button[type="submit"]');
    check(`${tag}: mit ungültigem Link wird nichts gesendet, das Formular bleibt`, (await s.sim("return window.__hcCalls.length")) === before && (await s.ev("return r.getElementById('ag-hcform').open")));
    // Speichern mit eigenem Link
    await (await s.el('[data-hc="f-url"]')).fill("https://cronitor.link/p/3f9a6c2e8b1d4e7f/haus-alarm");
    await (await s.el('[data-hc="f-page"]')).fill(CUSTOM);
    await s.tap('#ag-hcform button[type="submit"]');
    await s.waitFor("return !r.getElementById('ag-hcform').open");
    const sent = await s.sim("return window.__hcCalls.filter((m) => m.type === 'alarmageddon/healthcheck_save').at(-1)");
    check(`${tag}: Speichern sendet den eigenen Link`, sent.page_url === CUSTOM && sent.check_id === CRON, JSON.stringify(sent));

    // ----- Angaben des Dienstes: Zeile mit Link (neues Fenster) und Kopierknopf -----
    await s.tap(`#ag-hclist [data-hc-row="${CRON}"] [data-hc="log"]`);
    await s.waitFor("return r.getElementById('ag-hclog').open && !r.getElementById('ag-hclog').querySelector('.ag-sv[data-busy]')", 8000);
    await s.tap('#ag-hclog [data-sv="tab"][data-tab="service"]');
    await s.waitFor("return !!r.getElementById('ag-hclog').querySelector('.ag-sv-device')", 8000);
    const row = () => s.ev(`const d=r.getElementById('ag-hclog'); const a=d.querySelector('a[data-hl="page"]'); const rw=a?.closest('.ag-sv-drow'); return { found: !!a, href: a?.getAttribute('href'), target: a?.target, rel: a?.rel, label: rw?.querySelector('.ag-t2')?.textContent, copy: rw?.querySelector('.ag-copy')?.dataset.value, first: [...d.querySelectorAll('.ag-sv-dcard')[0].querySelectorAll('.ag-sv-drow .ag-t2')].map((x) => x.textContent) }`);
    let r1 = await row();
    check(`${tag}: Angaben: Zeile "${t.row}" als Link in neuem Fenster (noopener) mit Kopierknopf für den ganzen Link`, r1.found && r1.href === CUSTOM && r1.target === "_blank" && r1.rel.includes("noopener") && r1.label === t.row && r1.copy === CUSTOM, JSON.stringify(r1));
    // ein Dienst ohne Link: keine Zeile
    await s.tap('#ag-hclog .ag-dlg-x');
    await s.waitFor("return !r.getElementById('ag-hclog').open");
    await s.tap(`#ag-hclist [data-hc-row="${HC}"] [data-hc="log"]`);
    await s.waitFor("return r.getElementById('ag-hclog').open && !r.getElementById('ag-hclog').querySelector('.ag-sv[data-busy]')", 8000);
    await s.tap('#ag-hclog [data-sv="tab"][data-tab="service"]');
    await s.waitFor("return !!r.getElementById('ag-hclog').querySelector('.ag-sv-device')", 8000);
    r1 = await row();
    check(`${tag}: Dienst ohne Link: keine Zeile "${t.row}"`, !r1.found && !r1.first.includes(t.row), JSON.stringify(r1));
    await s.ctx.close();

    // ----- Nur ein Dienst: im Kopf der Angaben kein Auswahlmenü (nichts umzuschalten), kein Pfeil; mit mehreren wie bisher -----
    const one = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&hc=one" });
    await one.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
    await one.tap('.ag-hcsum [data-hc="open"]');
    await one.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 1");
    await one.tap(`#ag-hclist [data-hc-row="${HC}"] [data-hc="log"]`);
    await one.waitFor("return r.getElementById('ag-hclog').open && !r.getElementById('ag-hclog').querySelector('.ag-sv[data-busy]')", 8000);
    const head1 = await one.ev("const d=r.getElementById('ag-hclog'); const p=d.querySelector('.ag-hl-pick'); return { tag: p?.tagName, svg: !!p?.querySelector('svg'), menu: !!d.querySelector('.ag-hl-menu'), btn: !!d.querySelector('[data-sv=\"menu\"]'), name: p?.textContent.trim() }");
    check(`${tag}: ein einziger Dienst: Name ohne Pfeil und ohne Auswahlmenü`, head1.tag === 'SPAN' && !head1.svg && !head1.menu && !head1.btn && head1.name === 'Healthchecks Haus', JSON.stringify(head1));
    await one.ctx.close();
    const many = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&hc=sample" });
    await many.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
    await many.tap('.ag-hcsum [data-hc="open"]');
    await many.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 3");
    await many.tap(`#ag-hclist [data-hc-row="${HC}"] [data-hc="log"]`);
    await many.waitFor("return r.getElementById('ag-hclog').open && !r.getElementById('ag-hclog').querySelector('.ag-sv[data-busy]')", 8000);
    check(`${tag}: mehrere Dienste: Name mit Pfeil und Auswahlmenü wie bisher`, await many.ev("const d=r.getElementById('ag-hclog'); return !!d.querySelector('button.ag-hl-pick svg') && !!d.querySelector('.ag-hl-menu')"));
    await many.ctx.close();
  }
}
await browser.close();
done();
