// 1.61.0: Eingestellte Zeiten erscheinen überall gleich: unter 60 s in Sekunden, ab 60 s in Minuten und Sekunden, ab einer Stunde mit Stunden;
// Teile, die null sind, entfallen. Je Sprache, Desktop und Handy. Geprüft an den Karten der Aktionen (Warten, Ton, Gruppe, Rückgängig),
// an den Schnellwahl-Knöpfen und an der Überwachung.
import { check, done, launch, open } from "../lib.mjs";

const PLAYER = "media_player.sonos_wohnzimmer";
const wait = (seconds) => ({ type: "wait", seconds });
const tone = (duration) => ({ type: "sound", players: [PLAYER], sound: "siren", duration, restore: true });
const group = (mode, seconds, steps = [wait(2)]) => ({ type: "group", mode, count: 3, seconds, steps });
const sw = (undo) => ({ type: "action", action: "switch.turn_on", target: ["switch.steckdose"], undo_after: undo });

// Karte -> Text der Zeile mit den Angaben
const WAITS = [[5, "5 s"], [59, "59 s"], [60, "1 min"], [90, "1 min 30 s"], [120, "2 min"], [600, "10 min"], [3600, "1 h"], [3725, "1 h 2 min 5 s"]];

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "actions", trigger: "away" } });
    const texts = async (steps, sel) => {
      await s.ev(`const a=r.host.actions; a._setSteps(${JSON.stringify(steps)}); a.render(); return 1`);
      await s.page.waitForTimeout(250);
      return s.ev(`return [...r.querySelectorAll(${JSON.stringify(sel)})].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
    };

    // Warten: die Zahl der Sekunden, einheitlich formatiert (Deutsch "… warten", Englisch "Wait …")
    const w = await texts(WAITS.map(([n]) => wait(n)), ".ag-wf-main .ag-wf-step .ag-t2");
    check(`${tag}: Warten: unter 60 s in Sekunden, ab 60 s in Minuten und Sekunden, ab 1 h mit Stunden`, WAITS.every(([, text], i) => w[i]?.includes(text) && !(text.includes("min") && /\b\d{3,} s\b/.test(w[i]))), JSON.stringify(w));

    // Ton: die Dauer in der Karte, nicht "120 s"
    const t = await texts([tone(45), tone(120), tone(150)], ".ag-wf-main .ag-wf-step .ag-t2");
    check(`${tag}: Ton: 45 s, 2 min, 2 min 30 s (nicht "120 s")`, t[0].includes("45 s") && t[1].includes("2 min") && !/120 s/.test(t[1]) && t[2].includes("2 min 30 s"), JSON.stringify(t));

    // Rückgängig nach einer Zeit
    const u = await texts([sw(30), sw(120), sw(90)], ".ag-wf-main .ag-wf-step .ag-t2");
    check(`${tag}: Rückgängig: 30 s, 2 min, 1 min 30 s`, u[0].includes("30 s") && u[1].includes("2 min") && u[2].includes("1 min 30 s"), JSON.stringify(u));

    // Gruppe: "Wiederholen für …"
    const g = await texts([group("duration", 30), group("duration", 120), group("duration", 3600)], ".ag-wf-gsum");
    check(`${tag}: Gruppe: 30 s, 2 min, 1 h`, g.length === 3 && g[0].includes("30 s") && g[1].includes("2 min") && g[2].includes("1 h"), JSON.stringify(g));

    // Schnellwahl im Editor: "1 min", "2 min", "5 min", "10 min" statt 60, 120 ...
    await s.ev(`const a=r.host.actions; a._setSteps(${JSON.stringify([wait(30)])}); a.render(); return 1`);
    await s.page.waitForTimeout(200);
    await s.tap('.ag-wf-main .ag-wf-step [data-wf="edit"]');
    await s.waitFor("return r.getElementById('ag-step').open");
    const chips = await s.ev("return [...r.querySelectorAll('#ag-step [data-wf=\"secs\"]')].map((b) => b.textContent.trim())");
    check(`${tag}: Schnellwahl beim Warten: 10 s, 30 s, 1 min, 5 min`, JSON.stringify(chips) === JSON.stringify(["10 s", "30 s", "1 min", "5 min"]), JSON.stringify(chips));
    await s.tap('#ag-step [data-wf="close"]');
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // Überwachung: "mindestens 30 min", Erinnerung "alle 2 h" einheitlich
    const m = await open(browser, { mobile, lang, tab: "config", query: "&monitor=1", prefs: { sub: "actions", trigger: "monitor" } });
    await m.page.waitForTimeout(500);
    const sub = await m.ev("return [...r.querySelectorAll('.ag-mon-rule .ag-settx small')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ')");
    check(`${tag}: Überwachung: Dauer und Erinnerung im selben Format (min, h; kein "Min." und kein "Std.")`, /\d+ min/.test(sub) && !/Min\.|Std\./.test(sub), sub);
    await m.ctx.close();
  }
}
await browser.close();
done();
