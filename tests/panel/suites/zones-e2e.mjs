// 1.40.0: Zonenfarben in den Aktionen. Jede der sechs Zonen hat ihre Farbe (Vorgabe des Nutzers, 2026-11-15): Ausgangsverzögerung hellorange,
// Eingangsverzögerung dunkelorange, scharf geschaltet hellrot, Alarm dunkelrot, nach dem Quittieren hellgrün, beim Deaktivieren dunkelgrün.
// Die Schritte laufen von der Zonenfarbe nach neutral, die Verbindungslinie trägt sie, eine Pille nennt die Zone in Worten (auch ohne Farbe
// erkennbar). Je Sprache, Desktop und Handy, hell und dunkel; die Schrift der Pille bleibt lesbar (Kontrast 3:1).
import { check, done, launch, open, outDir } from "../lib.mjs";

const COLORS = { arming: [255, 183, 77], entry: [239, 108, 0], armed: [255, 138, 128], main: [211, 47, 47], after: [129, 199, 132], disarmed: [46, 125, 50] };
const LABEL = {
  de: { arming: "Ausgangsverzögerung", entry: "Eingangsverzögerung", armed: "Scharf geschaltet", main: "Alarm", after: "Nach dem Quittieren", disarmed: "Beim Deaktivieren" },
  en: { arming: "Exit delay", entry: "Entry delay", armed: "Armed", main: "Alarm", after: "After acknowledging", disarmed: "On disarming" },
};
const P = ["media_player.kueche"];
const DATA = {
  workflows_arming: { away: [{ type: "chime", players: P, sound: "tone_pip", volume: 0.4, duration: 3, delay: true, restore: true }] },
  workflows_armed: { away: [{ type: "chime", players: P, sound: "tone_pip", volume: 0.4, duration: 2, restore: true }] },
  workflows_entry: { away: [{ type: "prealarm", players: P, sound: "pre_beep", volume: 0.4, duration: 20, delay: true, restore: true }] },
  workflows: { away: [{ type: "notify" }, { type: "wait", seconds: 60 }] },
  workflows_after: { away: [{ type: "action", action: "cover.open_cover", target: ["cover.rollladen_wohnzimmer"], data: {}, wait: false }] },
  workflows_disarmed: { away: [{ type: "dechime", players: P, sound: "off_fall", volume: 0.4, duration: 2, restore: true }] },
};

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    for (const theme of ["light", "dark"]) {
      const tag = `${lang}/${mobile ? "Handy" : "Desktop"}/${theme === "dark" ? "dunkel" : "hell"}`;
      const size = mobile ? { width: 390, height: 4000 } : { width: 1180, height: 3000 };
      const s = await open(browser, { mobile, lang, theme, tab: "config", prefs: { sub: "actions", trigger: "away" }, size });
      await s.sim(`const sys = window.__systems[0]; Object.assign(sys, ${JSON.stringify(DATA)}); sys.workflow_end = {}; return 1`);
      await s.ev("r.host.actions.draft = null; r.host.actions.trigger = 'away'; return r.host._fetch().then(() => { r.host.actions.render(); return 1; })");
      await s.waitFor("return r.querySelectorAll('.ag-wf-line .ag-wf-step').length >= 6");
      await s.page.waitForTimeout(500);
      const zones = Object.keys(COLORS);
      const info = await s.ev(`const out = {}; for (const z of ${JSON.stringify(zones)}) { const line = r.querySelector('.ag-wf-' + z); if (!line) { out[z] = null; continue; } const step = line.querySelector('.ag-wf-step'); const pill = step.querySelector('.ag-zone'); const seg = line.querySelector('.ag-wf-seg'); const probe = document.createElement('i'); probe.style.color = getComputedStyle(line).getPropertyValue('--z').trim(); r.appendChild(probe); const zc = getComputedStyle(probe).color; probe.remove(); out[z] = { zone: zc, pill: pill?.textContent.trim(), grad: getComputedStyle(step).backgroundImage.includes('linear-gradient'), seg: getComputedStyle(seg).backgroundColor, pillColor: pill && getComputedStyle(pill).color, pillBg: pill && getComputedStyle(pill).backgroundColor, card: (() => { const q = document.createElement('i'); q.style.background = 'var(--ag-card)'; r.appendChild(q); const c = getComputedStyle(q).backgroundColor; q.remove(); return c; })(), count: line.querySelectorAll('.ag-wf-step').length === line.querySelectorAll('.ag-zone').length }; } return out;`);
      const rgb = (c) => { const v = (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number); return c.startsWith("color(") ? v.map((x, k) => (k < 3 ? x * 255 : x)) : v; }; // color-mix liefert color(srgb 0..1)
      for (const z of zones) {
        const i = info[z];
        check(`${tag}: Zone "${z}" hat ihre Farbe`, !!i && JSON.stringify(rgb(i.zone).slice(0, 3)) === JSON.stringify(COLORS[z]), JSON.stringify(i?.zone));
        check(`${tag}: Zone "${z}": Schritt mit Verlauf, Pille "${LABEL[lang][z]}" an jedem Schritt, Linie farbig`, !!i && i.grad && i.pill === LABEL[lang][z] && i.count && i.seg !== "rgba(0, 0, 0, 0)");
      }
      check(`${tag}: der feste Block "Abschlussmeldung" hat denselben Verlauf wie die Schritte nach dem Quittieren`, await s.ev("const card=r.querySelector('.ag-wf-end .ag-wf-endcard'); const step=r.querySelector('.ag-wf-after .ag-wf-step'); return !!card && !!step && getComputedStyle(card).backgroundImage.includes('linear-gradient') && getComputedStyle(card).backgroundImage === getComputedStyle(step).backgroundImage"));
      check(`${tag}: die Linien zum Plus-Knopf sind dünn (1,5 px), haben die Farbe des Knopfes und treffen ihn oben und unten mittig; der Ring hat dort einen Strich`, await s.ev("const add=r.querySelector('.ag-wf-add'); const plus=add.closest('.ag-wf-plus'); const segs=[...plus.querySelectorAll('.ag-wf-seg')]; const q=document.createElement('i'); q.style.background='var(--ag-primary)'; r.appendChild(q); const pc=getComputedStyle(q).backgroundColor; q.remove(); const b=add.getBoundingClientRect(); const cx=b.left + b.width / 2; const ring=getComputedStyle(add, '::before').backgroundImage; return segs.length >= 1 && segs.every((x) => getComputedStyle(x).backgroundColor === pc && x.getBoundingClientRect().width <= 1.6 && Math.abs(x.getBoundingClientRect().left + x.getBoundingClientRect().width / 2 - cx) <= 0.6) && /repeating-conic-gradient/.test(ring) && /from -7\\.5deg/.test(ring)"));
      check(`${tag}: die sechs Farben sind alle verschieden`, new Set(zones.map((z) => info[z]?.zone)).size === 6);
      // Lesbarkeit der Pillenschrift (3:1) auf der Pille über der Karte
      const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, k) => a + v * [0.2126, 0.7152, 0.0722][k], 0);
      const worst = Math.min(...zones.map((z) => {
        const i = info[z]; const card = rgb(i.card); const bg = rgb(i.pillBg); const a = bg[3] ?? 1; const mix = card.slice(0, 3).map((c, k) => c * (1 - a) + bg[k] * a);
        const hi = Math.max(lum(mix), lum(rgb(i.pillColor))); const lo = Math.min(lum(mix), lum(rgb(i.pillColor))); return (hi + 0.05) / (lo + 0.05);
      }));
      check(`${tag}: Schrift der Zonen-Pille lesbar (Kontrast mindestens 3:1)`, worst >= 3, worst.toFixed(2));
      check(`${tag}: kein seitlicher Überlauf`, await s.ev("return r.host.scrollWidth <= r.host.clientWidth + 1 || document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"));
      await s.page.screenshot({ path: `${outDir}zones-${lang}-${mobile ? "mobile" : "desktop"}-${theme}.png`, fullPage: false });
      await s.page.close?.();
    }
  }
}
await browser.close();
done();
