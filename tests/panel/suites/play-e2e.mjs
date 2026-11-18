// 1.63.0 (Vorgabe des Nutzers, 2026-11-17): Jeder Play-Knopf im Panel verhält sich gleich. Beim Drücken wird er rot und zum Stopp-Knopf
// (weisses Stopp-Symbol, Name "Stopp"/"… beenden"), ein Druck auf Stopp macht ihn wieder zum Play-Knopf. Geprüft wird jeder Ort mit einem
// Play-Knopf: Schritt testen, "Testen" unten, die Karten der fünf festen Meldungen, der Test im Fenster einer Meldung, Probehören im Fenster
// eines Tonschritts, eigene Töne, Schritt der Überwachung, Testmeldung im Reiter Benachrichtigungen. Je Sprache, Desktop und Handy.
import { check, done, launch, open, outDir } from "../lib.mjs";

const PLAY = "M8,5.14V19.14L19,12.14L8,5.14Z";
const STOP = "M18,18H6V6H18V18Z";
// Zustand eines Knopfs: rot wie --ag-error, weiss, Stopp-Symbol, Name nennt das Anhalten; oder wieder Play
const LOOK = `const b=r.querySelector(arg); if (!b) return null; const c=getComputedStyle(b); const probe=document.createElement('i'); probe.style.color='var(--ag-error)'; r.appendChild(probe);
  const red=getComputedStyle(probe).color; probe.remove(); return { bg: c.backgroundColor, red, fg: c.color, d: b.querySelector('svg path')?.getAttribute('d') || '', label: b.getAttribute('aria-label') || '', running: b.classList.contains('ag-running'), disabled: b.disabled };`;
const stopLabel = /stop|beenden|Stoppen/i;

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const look = (s, sel) => s.ev(LOOK, sel);
    const isStop = (x) => !!x && x.running && x.bg === x.red && x.fg === "rgb(255, 255, 255)" && x.d === STOP && stopLabel.test(x.label) && !x.disabled;
    const isPlay = (x) => !!x && !x.running && x.bg !== x.red && x.d === PLAY && !stopLabel.test(x.label);
    // Ein Knopf: drücken, rot und Stopp sehen, Stopp drücken, wieder Play sehen. `running`/`idle`: Selektor im jeweiligen Zustand
    const cycle = async (s, name, idle, running = idle, { before = null } = {}) => {
      check(`${tag}: ${name}: vorher ein Play-Knopf`, isPlay(await look(s, idle)), JSON.stringify(await look(s, idle)));
      await s.ev("r.querySelector(arg).click(); return 1", idle);
      if (before) await before();
      let now = null;
      for (let i = 0; i < 30 && !isStop(now); i += 1) {
        now = await look(s, running);
        if (!isStop(now)) await s.page.waitForTimeout(100);
      }
      check(`${tag}: ${name}: beim Drücken rot mit weissem Stopp-Symbol`, isStop(now), JSON.stringify(now));
      await s.ev("r.querySelector(arg).click(); return 1", running);
      let back = null;
      for (let i = 0; i < 30 && !isPlay(back); i += 1) {
        back = await look(s, idle);
        if (!isPlay(back)) await s.page.waitForTimeout(100);
      }
      check(`${tag}: ${name}: Stopp macht ihn wieder zum Play-Knopf`, isPlay(back), JSON.stringify(back));
    };

    // ----- Aktionen -----
    {
      const s = await open(browser, { mobile, lang, tab: "config", query: "&monitor=1&sounds=1" });
      await s.tap('[data-sub="actions"]');
      await s.waitFor("return !!r.querySelector('.ag-wf-main .ag-wf-step') && !!r.querySelector('[data-end-notice]')");
      await s.page.waitForTimeout(400);
      // Einmalige Tests der Meldungen lange genug "unterwegs", damit Stopp zu drücken ist
      await s.sim("window.__delay = { 'alarmageddon/test_event_notify': 4000, 'alarmageddon/test_end_notify': 4000, 'alarmageddon/test_monitor_step': 4000, 'alarmageddon/test_notify': 4000 }; return 1");
      const confirm = async () => {
        if (await s.waitFor("return r.getElementById('ag-confirm').open", 800)) await s.ev("r.querySelector('#ag-confirm [data-c=\"yes\"]').click(); return 1");
      };
      await cycle(s, "Schritt testen", '.ag-wf-main > .ag-wf-step[data-index="0"] [data-wf="test-step"]', '.ag-wf-main > .ag-wf-step[data-index="0"] [data-wf="test-step-stop"]', { before: confirm });
      await s.page.waitForTimeout(300);
      await cycle(s, '"Testen" unten', '.ag-foot [data-wf="test"]', '.ag-foot [data-wf="test-stop"]', { before: confirm });
      await s.page.waitForTimeout(300);
      for (const kind of ["armed", "sensor_report"]) {
        if (await s.ev(`return r.querySelector('[data-notice="${kind}"] [data-wf="notice-on"]').getAttribute('aria-checked') !== 'true'`)) await s.tap(`[data-notice="${kind}"] [data-wf="notice-on"]`);
        await cycle(s, `Karte "${kind}"`, `[data-notice="${kind}"] [data-wf="notice-play"]`);
      }
      await cycle(s, "Karte Abschlussmeldung", '[data-end-notice] [data-wf="end-play"]');
      // Alle fünf Karten haben Play vor dem Stift; eine ausgeschaltete Meldung hat ihn gesperrt
      check(`${tag}: jede feste Meldung hat Play vor dem Stift`, await s.ev("const c=[...r.querySelectorAll('[data-notice], [data-end-notice]')]; return c.length === 5 && c.every((x) => { const b=[...x.querySelectorAll('.ag-wf-btns > button')]; return b.length === 2 && /-play$/.test(b[0].dataset.wf) && /-edit$/.test(b[1].dataset.wf); })"));
      await s.tap('[data-notice="pending"] [data-wf="notice-on"]');
      await s.tap('[data-notice="pending"] [data-wf="notice-on"]');
      check(`${tag}: ausgeschaltete Meldung: Play gesperrt`, await s.ev("const n=r.querySelector('[data-notice=\"pending\"]'); return n.classList.contains('off') === n.querySelector('[data-wf=\"notice-play\"]').disabled"));
      // Test im Fenster: derselbe Test wie auf der Karte (Karte und Fenster zeigen ihn gleich)
      await s.tap('[data-notice="armed"] [data-wf="notice-edit"]');
      await s.waitFor("return r.getElementById('ag-step').open && !!r.querySelector('#ag-step [data-wf=\"notice-test\"]')");
      await cycle(s, "Test im Fenster der Meldung", '#ag-step [data-wf="notice-test"]');
      await s.ev("r.querySelector('#ag-step [data-wf=\"close\"]').click(); return 1");
      if (await s.waitFor("return r.getElementById('ag-confirm').open", 600)) await s.ev("r.querySelector('#ag-confirm [data-c=\"yes\"]').click(); return 1");
      await s.waitFor("return !r.getElementById('ag-step').open");
      // Probehören im Fenster eines Tonschritts (Audio im Testbrowser nachgebaut: spielt, bis Stopp)
      await s.ev("window.Audio = function () { const o = { play: () => Promise.resolve(), pause() {}, addEventListener() {}, removeEventListener() {}, set onended(f) { o._end = f; }, set src(v) {}, currentTime: 0, volume: 1 }; return o; }; return 1");
      await s.ev("r.querySelector('.ag-wf-main > .ag-wf-plus .ag-wf-add').click(); return 1");
      await s.waitFor("return r.getElementById('ag-step').open && !!r.querySelector('#ag-step [data-wf=\"kind\"][data-kind=\"sound\"]')");
      await s.ev("r.querySelector('#ag-step [data-wf=\"kind\"][data-kind=\"sound\"]').click(); return 1");
      await s.waitFor("return !!r.querySelector('#ag-step [data-wf=\"pv-play\"]')");
      await cycle(s, "Probehören im Fenster eines Tons", '#ag-step [data-wf="pv-play"]', '#ag-step [data-wf="pv-stop"]');
      await s.ev("r.querySelector('#ag-step [data-wf=\"close\"]').click(); return 1");
      if (await s.waitFor("return r.getElementById('ag-confirm').open", 600)) await s.ev("r.querySelector('#ag-confirm [data-c=\"yes\"]').click(); return 1");
      // Überwachung: Schritt testen
      await s.tap('.ag-foot [data-wf="cancel"]');
      await s.tap('[data-trigger="monitor"]');
      await s.waitFor("return !!r.querySelector('.ag-mon-rule')");
      await s.ev("const b=r.querySelector('[data-wf=\"mon-fold-all\"]'); if (b) b.click(); return 1");
      await s.waitFor("return !!r.querySelector('[data-wf=\"mon-step-test\"]:not([disabled])')");
      const mon = await s.ev("const b=r.querySelector('[data-wf=\"mon-step-test\"]:not([disabled])'); return `[data-wf=\"mon-step-test\"][data-rule=\"${b.dataset.rule}\"][data-zone=\"${b.dataset.zone}\"][data-index=\"${b.dataset.index}\"]`");
      await cycle(s, "Schritt der Überwachung testen", mon);
      await s.page.screenshot({ path: `${outDir}play-${lang}-${mobile ? "mobile" : "desktop"}.png` });
      check(`${tag}: keine Fehler in der Konsole (Aktionen)`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }

    // ----- Benachrichtigungen und eigene Töne -----
    {
      const s = await open(browser, { mobile, lang, tab: "config", query: "&sounds=1" });
      await s.sim("window.__delay = { 'alarmageddon/test_notify': 4000 }; return 1");
      await s.tap('[data-sub="notify"]');
      await s.waitFor("return !!r.querySelector('.ag-nt [data-nt=\"test\"]')");
      await cycle(s, "Testmeldung im Reiter Benachrichtigungen", '.ag-nt [data-nt="test"][data-kind="sensor_offline"]');
      await s.tap('[data-sub="system"]');
      await s.ev("window.Audio = function () { const o = { play: () => Promise.resolve(), pause() {}, addEventListener() {}, removeEventListener() {}, set onended(f) { o._end = f; }, set src(v) {}, currentTime: 0 }; return o; }; return 1");
      await s.tap('[data-sys="cs-open"]');
      await s.waitFor("return r.getElementById('ag-cslist').open && !!r.querySelector('#ag-cslist .ag-csrow [data-sys=\"cs-play\"]')");
      await cycle(s, "Eigenen Ton abspielen", '#ag-cslist .ag-csrow [data-sys="cs-play"]', '#ag-cslist .ag-csrow [data-sys="cs-stop"]');
      check(`${tag}: keine Fehler in der Konsole (Benachrichtigungen, Töne)`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }
  }
}
await browser.close();
done();
