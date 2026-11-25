// Zeitraum des Protokolls (1.91.0, Wunsch des Nutzers 2026-11-25: "Setze hier den Zeitraum per Default auf 7 Tage. Wenn es allerdings jemand verstellt,
// dann soll es auf dieser Einstellung bleiben ... bis es ein User verstellt"): ohne gemerkte Wahl gilt "Letzte 7 Tage" (bis 1.90.0 "Alle"), eine Wahl
// bleibt pro Browser gemerkt, auch über das Neuladen. Ein Alarm, den der rote Kreis oder die Alarmmeldung öffnet, ist immer zu sehen: liegt er vor dem
// Zeitraum, zeigt die Liste diesmal "Alle", ohne die gemerkte Wahl zu ändern. Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const J = JSON.stringify;
const RANGE = "return { value: r.querySelector('[data-log=\"range\"]')?.value, saved: localStorage.getItem('alarmageddon.logRange') }";
// Ein beendeter Alarm vor zwölf Tagen (erfundene Daten), im Nachbau als weiterer Alarm der Anlage "Haus"
const OLD = `const t = (m) => new Date(Date.now() - 12 * 86400e3 + m * 1000).toISOString();
  const rec = { id: t(0), start: t(0), end: t(120), ended_by: "Lena", mode: "away", sensor: "binary_sensor.fenster_bad", entries: [
    { t: t(0), kind: "sensor", sensor: "binary_sensor.fenster_bad", to: "on" }, { t: t(1), kind: "state", state: "triggered", sensor: "binary_sensor.fenster_bad" },
    { t: t(120), kind: "state", state: "disarmed", by: "Lena" } ] };
  window.__moreRecordings = [rec];
  return rec.id;`;

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;

    // ----- Ohne gemerkte Wahl: 7 Tage; eine Wahl bleibt, auch nach dem Neuladen -----
    const s = await open(browser, { mobile, lang, tab: "log" });
    await s.waitFor("return !!r.querySelector('[data-log=\"range\"]') && !r.querySelector('.ag-log-wait')", 8000);
    const first = await s.ev(RANGE);
    check(`${tag}: ohne gemerkte Wahl "Letzte 7 Tage", nichts gespeichert`, first.value === "7d" && first.saved === null, J(first));
    check(`${tag}: der Alarm von vor 95 Minuten ist zu sehen`, await s.waitFor("return r.querySelectorAll('.ag-inc').length === 1"));
    await s.ev("const sel = r.querySelector('[data-log=\"range\"]'); sel.value = '30d'; sel.dispatchEvent(new Event('change', { bubbles: true })); return 1");
    const picked = await s.ev(RANGE);
    check(`${tag}: "Letzte 30 Tage" gewählt und gemerkt`, picked.value === "30d" && picked.saved === "30d", J(picked));
    await s.page.reload();
    const frame = await (await s.page.waitForSelector("#panel-frame")).contentFrame();
    const again = await frame.waitForFunction(new Function("const r=document.querySelector('alarmageddon-panel')?.shadowRoot; const v = r?.querySelector('[data-log=\"range\"]')?.value; return v ? { value: v, saved: localStorage.getItem('alarmageddon.logRange') } : false"), null, { timeout: 10000 }).then((h) => h.jsonValue(), () => null);
    check(`${tag}: nach dem Neuladen bleibt "Letzte 30 Tage"`, again?.value === "30d" && again?.saved === "30d", J(again));
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Roter Kreis: ein ungelesener Alarm vor 12 Tagen ist zu sehen, die gemerkte Wahl bleibt -----
    const c = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system", logRange: "7d" } });
    const oldId = await c.sim(OLD);
    await c.sim(`window.__systems[0].alarm_unseen = { id: arg, running: false }; window.__seenMap = { [arg]: false }; return 1`, oldId);
    await c.ev("return r.host._fetch().then(() => 1)");
    await c.waitFor("return !!r.querySelector('.ag-albtn')", 8000);
    await c.tap(".ag-albtn");
    const shown = await c.waitFor(`return [...r.querySelectorAll('.ag-inc.open [data-log="toggle"]')].some((b) => b.dataset.id === ${J(oldId)})`, 8000);
    const after = await c.ev(RANGE);
    check(`${tag}: roter Kreis öffnet den Alarm von vor 12 Tagen aufgeklappt, die Liste zeigt "Alle"`, shown && after.value === "all", J(after));
    check(`${tag}: die gemerkte Wahl bleibt "Letzte 7 Tage"`, after.saved === "7d", J(after));
    check(`${tag}: keine Fehler der Seite (Kreis)`, c.errors.length === 0, c.errors.join(" | "));
    await c.ctx.close();

    // ----- Alarmmeldung (Link ?view=log): der neueste Alarm liegt vor dem Zeitraum und ist trotzdem zu sehen -----
    const d = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system", logRange: "24h" } });
    const newest = await d.sim(OLD);
    // Nur der alte Alarm: der von vor 95 Minuten ist gelöscht
    await d.ev("return r.host._hass.callWS({ type: 'alarmageddon/log' }).then((x) => x.systems[0].recordings.map((rec) => rec.id))").then(async (ids) => {
      await d.sim("window.__deleted = arg; return 1", ids.filter((id) => id !== newest));
    });
    await d.sim("history.replaceState(null, '', location.pathname + location.search + '&view=log'); return 1");
    await d.ev("r.host._applyDeepLink(); return 1");
    const deep = await d.waitFor(`return [...r.querySelectorAll('.ag-inc.open [data-log="toggle"]')].some((b) => b.dataset.id === ${J(newest)})`, 8000);
    const deepRange = await d.ev(RANGE);
    check(`${tag}: Link der Alarmmeldung zeigt den neuesten Alarm (vor 12 Tagen) aufgeklappt, Liste "Alle", gemerkt bleibt "24h"`, deep && deepRange.value === "all" && deepRange.saved === "24h", J(deepRange));
    // Liegt der Alarm im Zeitraum, bleibt der Zeitraum, wie er ist
    const e = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system", logRange: "7d" }, query: "&alarmunseen=1" });
    await e.waitFor("return !!r.querySelector('.ag-albtn')", 8000);
    await e.tap(".ag-albtn");
    await e.waitFor("return r.querySelectorAll('.ag-inc.open').length === 1", 8000);
    const inside = await e.ev(RANGE);
    check(`${tag}: ein Alarm im Zeitraum lässt "Letzte 7 Tage" stehen`, inside.value === "7d" && inside.saved === "7d", J(inside));
    check(`${tag}: keine Fehler der Seite (Link)`, d.errors.length === 0 && e.errors.length === 0, [...d.errors, ...e.errors].join(" | "));
    await d.ctx.close();
    await e.ctx.close();
  }
}
await browser.close();
done();
