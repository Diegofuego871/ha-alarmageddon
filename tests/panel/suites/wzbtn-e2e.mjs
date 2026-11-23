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
    const anim = await s.ev(`const b=r.querySelector('${BTN}'); return [getComputedStyle(b.querySelector('.ag-wzstick')).animationName, ...[...b.querySelectorAll('.ag-wzstar')].map((x) => getComputedStyle(x).animationName + ':' + getComputedStyle(x).animationDuration)]`);
    check(`${tag}: Stab schwingt um den Griff; jeder Stern hat eine Zeitleiste für Bewegung und Ein-/Ausblenden (3,9 s: eingesogen, nach der Explosion wieder eingeblendet)`, J(anim) === J(["ag-wz-swing", "ag-wz-star0, ag-wz-fade0:3.9s", "ag-wz-star1, ag-wz-fade1:3.9s", "ag-wz-star2, ag-wz-fade2:3.9s"]), J(anim));
    // Sternschnuppe wie im Device Panel (Wunsch des Nutzers 2026-11-20): nach dem Schwung löst sich der Punkt und huscht mit Schweif um die Linie
    // Der Schweif ist ein Teil des Punktes (::before des Punktes), der Punkt dreht als Träger um die Knopfmitte: so läuft der Schweif dem Punkt nie voraus
    const comet = await s.ev(`const b=r.querySelector('${BTN}'); const dot=b.querySelector('.ag-wzbtn-dot'); const t=getComputedStyle(dot, '::before'); const bead=getComputedStyle(dot, '::after'); const d=getComputedStyle(dot); const bb=getComputedStyle(b, '::before');
      return { tail: t.animationName, delay: t.animationDelay, dur: t.animationDuration, mask: (t.webkitMaskImage || t.maskImage || '').includes('radial-gradient'), grad: t.backgroundImage.includes('conic-gradient'), orbit: d.animationName, orbitDur: d.animationDuration, origin: d.transformOrigin, bead: bead.animationName, beadDur: bead.animationDuration, carrierHidden: d.backgroundColor === 'rgba(0, 0, 0, 0)', buttonRing: bb.content }`);
    check(`${tag}: Sternschnuppe: der Schweif (conic-gradient, maskiert) gehört zum Punkt und startet mit ihm, sobald der letzte Stern eingesogen ist (1,445 s); der Punkt bleibt sichtbar und dreht als Träger um die Knopfmitte`,
      comet.tail === "ag-wz-comet-vis" && comet.delay.startsWith("1.445s") && comet.dur.startsWith("1.3s") && comet.mask && comet.grad && comet.orbit === "ag-wz-orbit" && comet.orbitDur === "3.9s" && comet.origin === "-9px 18px" && comet.bead === "ag-wz-land" && comet.beadDur === "3.9s" && comet.carrierHidden && (comet.buttonRing === "none" || comet.buttonRing === "normal"), J(comet));
    // Der Punkt dreht wirklich um die Knopfmitte: auf halber Strecke liegt er auf dem Ring, gegenüber seiner Ausgangslage (Abstand zur Mitte bleibt)
    const orbit = await s.ev(`const b=r.querySelector('${BTN}'); const dot=b.querySelector('.ag-wzbtn-dot'); const c=b.getBoundingClientRect(); const mx=c.left+c.width/2, my=c.top+c.height/2; const anims=b.getAnimations({ subtree: true }); anims.forEach((a) => a.pause()); const out=[]; for (const t of [0, 1800, 2100, 2400, 3500]) { anims.forEach((a) => (a.currentTime = t)); const q=dot.getBoundingClientRect(); out.push([Math.round(Math.hypot(q.left+q.width/2-mx, q.top+q.height/2-my) * 10) / 10, Math.round(Math.atan2(q.left+q.width/2-mx, -(q.top+q.height/2-my)) * 180 / Math.PI)]); } anims.forEach((a) => a.cancel()); return out`);
    check(`${tag}: der Punkt bleibt beim Umlauf auf dem Ring (Abstand zur Mitte gleich) und wandert im Uhrzeigersinn`, orbit.every((o) => Math.abs(o[0] - orbit[0][0]) < 1.2) && orbit[0][1] === 45 && orbit[1][1] !== 45, J(orbit));
    check(`${tag}: nach knapp 4 Sekunden ist die Welle vorbei`, await s.waitFor(`return !r.querySelector('${BTN}').classList.contains('wave')`, 7000));
    await s.tap('[data-tab="log"]');
    check(`${tag}: der Knopf steht auch im Reiter Protokoll`, await s.waitFor(`return r.host._tab === 'log' && !!r.querySelector('${BTN}')`));
    await s.tap('[data-tab="overview"]');
    check(`${tag}: der Knopf steht in jedem Reiter im Kopf`, await s.waitFor(`return !!r.querySelector('${BTN}')`));
    // Nach einer Pause von 30 Sekunden kommt die nächste Welle (Wunsch des Nutzers 2026-11-20); der Wechsel des Reiters startet keine zweite (ein Zeitgeber)
    const timer = await s.ev("return r.host._wzWaveTimer");
    check(`${tag}: die nächste Welle ist geplant, der Wechsel des Reiters hat keinen zweiten Zeitgeber gestartet`, !!timer && await s.ev("return r.host._wzWaved === true") && await s.ev(`return !r.querySelector('${BTN}').classList.contains('wave')`));
    if (!mobile && lang === "de") {
      const t1 = Date.now();
      const again = await s.waitFor(`return r.querySelector('${BTN}')?.classList.contains('wave')`, 36000);
      const pause = Date.now() - t1;
      check(`${tag}: nach rund 30 Sekunden Pause bewegt sich der Zauberstab erneut (${pause} ms nach dem Wechsel)`, again && pause > 15000 && pause < 33000, String(pause));
      check(`${tag}: danach endet die Welle wieder und die nächste ist geplant`, await s.waitFor(`return !r.querySelector('${BTN}').classList.contains('wave')`, 7000) && !!(await s.ev("return r.host._wzWaveTimer")));
    }
    // Klick: beim gemerkten Schritt weiter
    await s.sim("window.__wzCalls = []; return 1");
    await s.tap(BTN);
    check(`${tag}: Klick öffnet den Assistenten bei "${t.notify}" (Server: start bei notify); dort kein Knopf im Kopf`, await s.waitFor(`return r.querySelector('.ag-wz')?.dataset.step === 'notify' && !r.querySelector('.ag-wzbtn')`, 8000)
      && J((await s.sim("return window.__wzCalls")).map((c) => [c.action, c.step])) === J([["start", "notify"]]));
    // "Später" › "Nicht mehr anzeigen": der Knopf ist weg (Wunsch des Nutzers 2026-11-23); der Assistent bleibt unter Konfiguration › Anlage
    await s.tap('[data-wz="later"]');
    await s.waitFor("return r.getElementById('ag-wzask').open");
    await s.tap('#ag-wzask [data-wz="ask-hide"]');
    check(`${tag}: nach "Nicht mehr anzeigen" ist der Knopf im Kopf weg (Server: hidden)`, await s.waitFor(`return !r.querySelector('.ag-wz') && !!r.querySelector('[data-act="rename"]') && !r.querySelector('${BTN}')`, 8000)
      && (await s.sim("return window.__systems[0].wizard.state")) === "hidden");
    await s.tap('[data-tab="config"]');
    check(`${tag}: ausgeblendet: auch unter Konfiguration kein Knopf im Kopf`, await s.waitFor(`return !!r.querySelector('.ag-cfg, [data-sub]') && !r.querySelector('${BTN}')`));
    check(`${tag}: keine Fehler in der Konsole`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Ausgeblendet (Nicht mehr anzeigen): schon beim Laden kein Knopf -----
    s = await open(browser, { mobile, lang, query: "&wizard=hidden&wzstep=notify" });
    check(`${tag}: ausgeblendet: kein Knopf im Kopf`, await s.waitFor(`return !!r.querySelector('[data-act="rename"]') && !r.querySelector('${BTN}')`));
    await s.ctx.close();

    // ----- Später bei "Fertig": Klick, "Fertig" schliesst ab, danach kein Knopf mehr (auch nicht unter Konfiguration) -----
    s = await open(browser, { mobile, lang, query: "&wizard=later&wzuntil=2999-01-01&wzstep=done" });
    check(`${tag}: später: Knopf mit "${t.resume(8, t.done)}"`, await s.waitFor(`return r.querySelector('${BTN}')?.title === ${J(t.resume(8, t.done))}`));
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
