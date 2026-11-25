// Mockup "Symbole einheitlich" (2026-11-25, Wunsch des Nutzers: "mach mal ein Mockup, wie du alle Icons einheitlich darstellen würdest, komplette
// Seite"). Nimmt das echte Panel im Nachbau (tests/panel/sim) und baut die Seiten Konfiguration › Anlage und › Benachrichtigungen im Browser um:
// - jede Zeile einer Karte trägt ein Symbol (Kachel 36 px) oben links im weissen Bereich ("das Icon soll immer oben links, im weissen Bereich sein")
// - ein Schalter folgt direkt nach dem Symbol, vor seinem Text ("Schalter sind immer links vor dem Text")
// - Kapitel "Zeiten und Verhalten" heisst "Zeiten", das Bestätigungsfenster steht in derselben Karte wie die Verzögerungen
// Aufruf im Wurzelverzeichnis (Server des Nachbaus auf PANEL_PORT): node docs/mockups/symbole-v1/src/mockup.mjs
import { launch, open } from "../../../../tests/panel/lib.mjs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
// Kachel mit Symbol; `on` wie die Modi (Akzentfarbe, solange der Schalter an ist), `tone` für eine feste Farbe (rot: Anlage löschen)
const MOCK = `return import(new URL('/alarmageddon_panel/common.js', location.href).href).then(({ ic }) => {
  const tile = (name, on = false, tone = '') => { const s = document.createElement('span'); s.className = 'ag-oav mk-tile' + (on ? ' on' : '') + (tone ? ' mk-' + tone : ''); s.innerHTML = ic(name, 20); return s; };
  const css = document.createElement('style');
  css.textContent = \`
    .ag-moderow > .ag-oav, .mk-tile { order: -2; }
    .ag-setrow > .mk-tile, .ag-pmsw > .mk-tile { align-self: flex-start; }
    .ag-pmsw { align-items: flex-start; } .ag-pmsw > .ag-toggle { margin-top: 6px; }
    .ag-setrow:has(> .mk-tile) { align-items: flex-start; } .ag-setrow:has(> .mk-tile) > .ag-toggle { margin-top: 6px; }
    .ag-setrow:has(> .mk-tile) > .ag-num, .ag-setrow:has(> .mk-tile) > .ag-btnrow { align-self: center; }
    .mk-red { background: color-mix(in srgb, var(--ag-error) 12%, transparent); color: var(--ag-error); }
    .ag-ntk > .ag-ntk-icon { order: -2; }
    .ag-recip { display: flex; gap: 12px; align-items: flex-start; }
    .ag-setrow > .ag-oav, .ag-setrow > .ag-st-av { align-self: flex-start; }
    .ag-bkauto { align-items: flex-start; } .ag-bkauto > .ag-toggle { margin-top: 6px; }
    .ag-sthours:has(> .mk-tile) { display: grid; grid-template-columns: var(--ag-tile) minmax(0, 1fr); column-gap: 12px; }
    .ag-sthours:has(> .mk-tile) > :not(.mk-tile) { grid-column: 2; }
  \`;
  r.appendChild(css);
  const chap = (title) => [...r.querySelectorAll('.ag-chap')].find((c) => c.querySelector('.ag-chap-t')?.textContent.trim().startsWith(title));
  const lead = (row, name, on) => row && !row.querySelector(':scope > .mk-tile') && row.prepend(tile(name, on));
  const isOn = (row) => row?.querySelector(':scope > .ag-toggle')?.classList.contains('on');
  // Einstellungen pro Modus (Nachalarm, Zeiten, Störungsmeldungen)
  r.querySelectorAll('.ag-pmsw').forEach((sw) => lead(sw, 'tune', sw.querySelector('.ag-toggle')?.classList.contains('on')));
  // Zeiten
  const times = chap('Zeiten');
  if (times) {
    times.querySelector('.ag-chap-t').textContent = 'Zeiten';
    const cards = [...times.querySelectorAll(':scope .ag-card.ag-setlist')];
    if (cards.length > 1) { for (const row of [...cards[1].children]) cards[0].appendChild(row); cards[1].remove(); }
    times.querySelectorAll('.ag-subh').forEach((x) => x.remove());
    const rows = [...cards[0].querySelectorAll(':scope > .ag-setrow')];
    ['timer', 'doorOpen', 'check'].forEach((n, i) => lead(rows[i], n));
  }
  // Codes: Schalter
  for (const [sys, name] of [['armcode', 'lockClosed'], ['modecode', 'repeat'], ['ackcode', 'bellOff']]) {
    const row = r.querySelector('[data-sys="' + sys + '"]')?.closest('.ag-setrow');
    lead(row, name, isOn(row));
  }
  // Selbsttest alle, Backup automatisch
  lead(r.querySelector('.ag-sthours'), 'clock');
  const bk = r.querySelector('.ag-bkauto > .ag-oav');
  if (bk) bk.style.order = '-2';
  // Anlage löschen
  const del = chap('Anlage löschen')?.querySelector('.ag-setrow');
  if (del && !del.querySelector('.mk-tile')) del.prepend(tile('trash', false, 'red'));
  // Benachrichtigungen: Empfänger
  const recips = [...r.querySelectorAll('.ag-recip')];
  ['bell', 'cog'].forEach((n, i) => lead(recips[i], n));
  return 1;
});`;

const browser = await launch();
for (const sub of ["system", "notify"]) {
  for (const mobile of [false, true]) {
    for (const variant of ["heute", "vorschlag"]) {
      const s = await open(browser, { lang: "de", tab: "config", prefs: { sub }, mobile, size: mobile ? null : { width: 1400, height: 900 } });
      await s.page.waitForTimeout(1200);
      // Zeiten: wie im Bestand der meisten Anlagen ohne "Einstellungen pro Modus" (eine Karte); im Nachbau, nicht als ungespeicherte Änderung
      if (sub === "system") {
        await s.sim("window.__systems[0].per_mode_settings = false; return 1");
        await s.ev("return r.host._fetch().then(() => { r.host.systemUi.reset(); r.host.systemUi.render(); return 1; })");
        await s.page.waitForTimeout(500);
      }
      if (variant === "vorschlag") await s.ev(MOCK);
      await s.page.waitForTimeout(400);
      const h = await s.ev("const c=r.host._content; return c ? c.scrollHeight : document.documentElement.scrollHeight");
      await s.page.setViewportSize({ width: mobile ? 390 : 1400, height: Math.min(h + (mobile ? 200 : 260), 16000) });
      await s.page.waitForTimeout(600);
      if (variant === "vorschlag") await s.ev(MOCK); // nach dem Neuzeichnen (Grösse) noch einmal
      await s.page.waitForTimeout(300);
      const name = `${sub === "system" ? "anlage" : "benachrichtigungen"}-${mobile ? "handy" : "desktop"}-${variant}.png`;
      await s.page.screenshot({ path: out + name });
      console.log(name, s.errors.join(" | ") || "");
      await s.ctx.close();
    }
  }
}
await browser.close();

// Handy: die lange Seite in Spalten nebeneinander, damit sie sich ganz ansehen lässt (Pillow über Python)
import { execFileSync } from "node:child_process";
execFileSync("python3", ["-c", `
from PIL import Image
import sys
for name in sys.argv[1:]:
    im = Image.open(name + ".png"); w, h = im.size
    cut = 2400
    parts = [im.crop((0, y, w, min(h, y + cut))) for y in range(0, h, cut)]
    out = Image.new("RGB", (len(parts) * (w + 40) - 40, cut), "white")
    for i, p in enumerate(parts):
        out.paste(p, (i * (w + 40), 0))
    out.save(name + "-spalten.png")
`, ...["anlage", "benachrichtigungen"].flatMap((p) => ["heute", "vorschlag"].map((v) => `${out}${p}-handy-${v}`))]);
