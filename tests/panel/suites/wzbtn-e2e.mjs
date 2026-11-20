// 1.71.0: Knopf des Einrichtungsassistenten im Kopf (Wunsch des Nutzers 2026-11-20, 11:38, Mockup assistent-knopf-v1; Entscheide 11:48: Variante A
// "Schwung", nur solange der Assistent nicht fertig ist, Bewegung immer, auch bei "Bewegung reduzieren"). Je Sprache, Desktop und Handy, echte
// Klicks/Taps: rund neben dem Stift, blauer Punkt, Tooltip mit dem Schritt; der Zauberstab schwingt einmal, 5 Sekunden nach dem Laden, nicht bei
// jedem Wechsel des Reiters; ein Klick führt beim gemerkten Schritt weiter (offene Änderungen fragen vorher); nach "Fertig" kein Knopf mehr.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { resume: (n, step) => `Einrichtungsassistent fortsetzen (Schritt ${n}: ${step})`, start: "Einrichtungsassistent starten", notify: "Meldungen", done: "Fertig",
    dirty: "Ungespeicherte Änderungen" },
  en: { resume: (n, step) => `Continue setup assistant (step ${n}: ${step})`, start: "Start setup assistant", notify: "Notifications", done: "Done",
    dirty: "Unsaved changes" },
};
const J = JSON.stringify;
const LATER = "&wizard=later&wzuntil=2099-01-01";
const BTN = ".ag-headsys .ag-wzbtn";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];

    // ----- Verschoben bei "Meldungen": Knopf neben dem Stift, Schwung nach 5 Sekunden (Handy mit "Bewegung reduzieren": schwingt trotzdem) -----
    let s = await open(browser, { mobile, lang, query: `${LATER}&wzstep=notify`, context: mobile ? { reducedMotion: "reduce" } : {} });
    const t0 = Date.now();
    check(`${tag}: der Assistent öffnet sich nicht von selbst (verschoben)`, await s.ev("return !r.querySelector('.ag-wz')"));
    check(`${tag}: runder Knopf direkt rechts neben dem Stift, 40 px, mit Zauberstab und blauem Punkt`, await s.waitFor(`const b=r.querySelector('${BTN}'); if (!b) return false; const pen=r.querySelector('[data-act="rename"]');
      const rc=b.getBoundingClientRect(); const dot=b.querySelector('.ag-wzbtn-dot'); const cs=getComputedStyle(b);
      return pen.nextElementSibling === b && Math.round(rc.width) === 40 && Math.round(rc.height) === 40 && cs.borderRadius === '50%' && b.querySelectorAll('.ag-wzstar').length === 3 && !!b.querySelector('.ag-wzstick')
        && !!dot && dot.offsetWidth > 0 && getComputedStyle(dot).backgroundColor === getComputedStyle(b).color && rc.left >= pen.getBoundingClientRect().right`));
    const tip = await s.ev(`const b=r.querySelector('${BTN}'); return [b.title, b.getAttribute('aria-label')]`);
    check(`${tag}: Tooltip und Name: "${t.resume(5, t.notify)}"`, tip[0] === t.resume(5, t.notify) && tip[1] === tip[0], J(tip));
    if (mobile) {
      check(`${tag}: Handy: "Bewegung reduzieren" ist eingeschaltet (Prüfung, dass der Schwung trotzdem kommt)`, await s.ev("return matchMedia('(prefers-reduced-motion: reduce)').matches"));
      check(`${tag}: Handy: der Kopf passt ins Bild, nichts überlappt`, await s.ev(`const kids=[...r.querySelector('.ag-headsys').children].filter((x) => x.offsetWidth).map((x) => x.getBoundingClientRect());
        return kids.every((k) => k.left >= 0 && k.right <= innerWidth + 1) && kids.every((k, i) => i === 0 || k.left >= kids[i - 1].right - 1)`));
    }
    check(`${tag}: vor 3 Sekunden steht der Zauberstab still`, await s.ev(`return !r.querySelector('${BTN}').classList.contains('wave')`) && Date.now() - t0 < 3000);
    const waved = await s.waitFor(`return r.querySelector('${BTN}')?.classList.contains('wave')`, 9000);
    const after = Date.now() - t0;
    check(`${tag}: der Zauberstab schwingt rund 5 Sekunden nach dem Laden (${after} ms)`, waved && after > 3500 && after < 6800, String(after));
    const anim = await s.ev(`const b=r.querySelector('${BTN}'); return [getComputedStyle(b.querySelector('.ag-wzstick')).animationName, ...[...b.querySelectorAll('.ag-wzstar')].map((x) => getComputedStyle(x).animationName + ':' + getComputedStyle(x).animationDelay)]`);
    check(`${tag}: Variante A: Stab schwingt um den Griff, die drei Sterne blitzen nacheinander auf`, J(anim) === J(["ag-wz-swing", "ag-wz-pop:0s", "ag-wz-pop:0.12s", "ag-wz-pop:0.24s"]), J(anim));
    check(`${tag}: nach gut 1,6 Sekunden ist die Bewegung vorbei`, await s.waitFor(`return !r.querySelector('${BTN}').classList.contains('wave')`, 3000));
    await s.tap('[data-tab="log"]');
    check(`${tag}: der Knopf steht auch im Reiter Protokoll`, await s.waitFor(`return r.host._tab === 'log' && !!r.querySelector('${BTN}')`));
    await s.tap('[data-tab="overview"]');
    check(`${tag}: der Knopf steht in jedem Reiter im Kopf`, await s.waitFor(`return !!r.querySelector('${BTN}')`));
    if (!mobile && lang === "de") {
      await s.page.waitForTimeout(5800);
      check(`${tag}: der Wechsel des Reiters lässt ihn nicht noch einmal schwingen`, await s.ev(`return !r.querySelector('${BTN}').classList.contains('wave') && !r.host._wzWaveTimer`));
    } else {
      check(`${tag}: der Wechsel des Reiters lässt ihn nicht noch einmal schwingen (nichts geplant)`, await s.ev("return r.host._wzWaved === true && !r.host._wzWaveTimer"));
    }
    // Klick: beim gemerkten Schritt weiter
    await s.sim("window.__wzCalls = []; return 1");
    await s.tap(BTN);
    check(`${tag}: Klick öffnet den Assistenten bei "${t.notify}" (Server: start bei notify); dort kein Knopf im Kopf`, await s.waitFor(`return r.querySelector('.ag-wz')?.dataset.step === 'notify' && !r.querySelector('.ag-wzbtn')`, 8000)
      && J((await s.sim("return window.__wzCalls")).map((c) => [c.action, c.step])) === J([["start", "notify"]]));
    // "Später" › "Nicht mehr anzeigen": der Knopf ist wieder da (schwingt in diesem Laden nicht noch einmal)
    await s.tap('[data-wz="later"]');
    await s.waitFor("return r.getElementById('ag-wzask').open");
    await s.tap('#ag-wzask [data-wz="ask-hide"]');
    check(`${tag}: nach "Nicht mehr anzeigen" steht der Knopf wieder im Kopf, Schritt 5`, await s.waitFor(`return !r.querySelector('.ag-wz') && r.querySelector('${BTN}')?.title === ${J(t.resume(5, t.notify))}`, 8000));
    check(`${tag}: keine Fehler in der Konsole`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Ausgeblendet bei "Fertig": Klick, "Fertig" schliesst ab, danach kein Knopf mehr (auch nicht unter Konfiguration) -----
    s = await open(browser, { mobile, lang, query: "&wizard=hidden&wzstep=done" });
    check(`${tag}: ausgeblendet: Knopf mit "${t.resume(8, t.done)}"`, await s.waitFor(`return r.querySelector('${BTN}')?.title === ${J(t.resume(8, t.done))}`));
    await s.tap(BTN);
    check(`${tag}: Klick öffnet den Schritt "${t.done}"`, await s.waitFor("return r.querySelector('.ag-wz')?.dataset.step === 'done' && !r.querySelector('.ag-wz-next[disabled]')", 8000));
    await s.tap('[data-wz="next"]');
    check(`${tag}: nach "Fertig" kein Knopf mehr (Server: done)`, await s.waitFor(`return !r.querySelector('.ag-wz') && !!r.querySelector('[data-act="rename"]') && !r.querySelector('.ag-wzbtn')`, 8000)
      && (await s.sim("return window.__systems[0].wizard.state")) === "done");
    await s.tap('[data-tab="config"]');
    check(`${tag}: auch unter Konfiguration kein Knopf`, await s.waitFor(`return !!r.querySelector('.ag-cfg, [data-sub]') && !!r.querySelector('[data-act="rename"]') && !r.querySelector('.ag-wzbtn')`));
    check(`${tag}: keine Fehler in der Konsole (Fertig)`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Eingerichtete Anlage (Standard im Nachbau): nie ein Knopf, nichts geplant -----
    s = await open(browser, { mobile, lang });
    await s.page.waitForTimeout(400);
    check(`${tag}: eingerichtete Anlage: kein Knopf, kein Schwung geplant`, await s.ev("return !!r.querySelector('[data-act=\"rename\"]') && !r.querySelector('.ag-wzbtn') && !r.host._wzWaveTimer"));
    await s.ctx.close();

    // ----- Noch nicht begonnen (verschoben beim Willkommen): "starten"; offene Änderungen fragen vorher -----
    s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: LATER });
    check(`${tag}: beim Willkommen: "${t.start}"`, await s.waitFor(`return r.querySelector('${BTN}')?.title === ${J(t.start)} && r.querySelector('${BTN}').dataset.step === 'welcome'`));
    await s.tap('[data-sys="mode"][data-mode="night"]');
    await s.waitFor("return r.host.systemUi.dirtyCount() > 0");
    await s.tap(BTN);
    check(`${tag}: ungespeicherte Änderungen: Rückfrage "${t.dirty}" statt Start`, await s.waitFor(`const d=r.getElementById('ag-wzask'); return d.open && d.innerText.includes(${J(t.dirty)}) && !r.querySelector('.ag-wz')`));
    await s.tap('#ag-wzask [data-wz="ask-close"]');
    check(`${tag}: "Abbrechen": nichts gestartet, die Änderung bleibt, der Knopf auch`, await s.waitFor(`return !r.getElementById('ag-wzask').open && !r.querySelector('.ag-wz') && r.host.systemUi.dirtyCount() > 0 && !!r.querySelector('${BTN}')`));
    check(`${tag}: keine Fehler in der Konsole (Willkommen)`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
