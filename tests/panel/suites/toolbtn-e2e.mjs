// Knöpfe neben Filter-Pillen (1.92.0, Wunsch des Nutzers 2026-11-26: "wie dieser Button sich etwas mehr von den Pillen unterscheiden könnte? ohne grösser
// zu werden. inkl mobile", Mockup docs/mockups/voreinstellungen-knopf-v1, Entscheid "mach A", "Ansicht" am Computer auch). "Voreinstellungen" (Sensoren)
// und "Ansicht" (Übersicht, am Computer) sind eckig (12 px statt runder Enden) mit dem Symbol in einer Kachel; Höhe wie jeder Knopf, nicht breiter als
// mit der früheren Form. Die Pillen bleiben rund. Auf dem Handy bleibt "Ansicht" der runde Symbolknopf neben der Suche, ohne Kachel. Je Sprache,
// Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const J = JSON.stringify;
// Misst den Knopf, dann denselben Knopf ohne die Klasse (frühere Form), und die erste Pille daneben
const MEASURE = (sel) => `const b = r.querySelector('${sel}'); if (!b) return null;
  const box = (x) => { const q = x.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; };
  const cs = getComputedStyle(b), svg = b.querySelector(':scope > svg'), ss = getComputedStyle(svg);
  const out = { cls: b.classList.contains('ag-toolbtn'), size: box(b), radius: parseFloat(cs.borderRadius), tile: box(svg), tileBg: ss.backgroundColor, tileRadius: parseFloat(ss.borderRadius) };
  b.classList.remove('ag-toolbtn'); out.before = box(b); b.classList.add('ag-toolbtn');
  const chip = r.querySelector('.ag-chip'); out.chipRadius = chip ? parseFloat(getComputedStyle(chip).borderRadius) : null;
  return out;`;
const transparent = (c) => c === "rgba(0, 0, 0, 0)" || c === "transparent";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;

    // ----- Konfiguration › Sensoren: "Voreinstellungen" -----
    {
      const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "sensors" } });
      await s.waitFor("return !!r.querySelector('[data-sen=\"presets\"]')", 8000);
      const m = await s.ev(MEASURE('[data-sen="presets"]'));
      check(`${tag}: "Voreinstellungen" eckig (12 px) mit Symbolkachel, die Pillen rund`,
        m && m.cls && m.radius === 12 && m.chipRadius >= 17 && m.tile[0] === 26 && m.tile[1] === 26 && !transparent(m.tileBg) && m.tileRadius === 8, J(m));
      check(`${tag}: "Voreinstellungen" nicht grösser (38 px hoch, nicht breiter als mit runden Enden)`, m && m.size[1] === 38 && m.size[0] <= m.before[0] && m.before[1] === 38, J(m));
      // Der Knopf öffnet weiter die Voreinstellungen
      await s.tap('[data-sen="presets"]');
      check(`${tag}: "Voreinstellungen" öffnet das Fenster`, await s.waitFor("return r.getElementById('ag-presets').open"));
      await s.tap('[data-sen="presets-cancel"]');
      check(`${tag}: Sensoren: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }

    // ----- Übersicht: "Ansicht" -----
    {
      const s = await open(browser, { mobile, lang, tab: "overview" });
      await s.waitFor("return !!r.querySelector('[data-list=\"view\"]')", 8000);
      const m = await s.ev(MEASURE('[data-list="view"]'));
      if (!mobile) {
        check(`${tag}: "Ansicht" eckig (12 px) mit Symbolkachel, die Pillen rund`,
          m && m.cls && m.radius === 12 && m.chipRadius >= 17 && m.tile[1] === 28 && !transparent(m.tileBg) && m.tileRadius === 8, J(m));
        check(`${tag}: "Ansicht" nicht grösser (38 px hoch, nicht breiter als mit runden Enden)`, m && m.size[1] === 38 && m.size[0] <= m.before[0], J(m));
      } else {
        check(`${tag}: "Ansicht" bleibt der runde Symbolknopf neben der Suche, ohne Kachel`,
          m && m.radius >= 19 && m.size[0] === 44 && m.size[1] === 38 && transparent(m.tileBg) && m.tile[0] === 20, J(m));
      }
      await s.tap('[data-list="view"]');
      check(`${tag}: "Ansicht" öffnet das Fenster`, await s.waitFor("return r.getElementById('ag-view').open"));
      check(`${tag}: Übersicht: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }
  }
}
await browser.close();
done();
