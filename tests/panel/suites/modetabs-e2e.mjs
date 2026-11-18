// Reiterleisten der Modi überall gleich gefärbt (1.64.0, Wunsch des Nutzers): Sensoren, Aktionen (auch ohne "Überwachung"), Meldungen und Anlage zeigen
// die Reiter der Modi wie die Aktionen seit Variante E (2026-11-16): Spur und Text neutral, Icons im Dunkelrot der Zone "Alarm" (die Modi und "Immer
// aktiv"), "Überwachung" orange, der gewählte Reiter mit einem Rand in der Farbe seiner Gruppe und vollem Icon. Bis 1.63.0 waren nur die Aktionen mit dem
// Reiter "Überwachung" so gefärbt, alle anderen Leisten blau. Die übrigen Reiterleisten (Hauptreiter, Unterreiter, Ansicht) bleiben, wie sie sind.
import { check, done, launch, open, outDir } from "../lib.mjs";

const BARS = [
  ["Sensoren", "sensors", "sen-mode", '[data-sen="permode"]'],
  ["Aktionen", "actions", "wf-trigger", '[data-wf="permode"]'],
  ["Meldungen", "notify", "nt-mode", '[data-nt="permode"]'],
  ["Anlage", "system", "sys-scope", '[data-sys="permode"]'],
];
const READ = `const seg = r.querySelector('[data-seg="' + arg + '"]'); if (!seg) return null; const bs = [...seg.querySelectorAll(':scope > button')];
  const c = (b) => getComputedStyle(b.querySelector('svg')).color; const o = (b) => parseFloat(getComputedStyle(b.querySelector('svg')).opacity);
  const on = seg.querySelector(':scope > button.on'); const sub = r.querySelector('[data-sub].on');
  return { cls: seg.classList.contains('ag-modeseg'), alarm: bs.filter((b) => b.dataset.trigger !== 'monitor').map(c), mon: bs.filter((b) => b.dataset.trigger === 'monitor').map(c),
    ring: getComputedStyle(seg.querySelector('.ag-pill')).boxShadow, onKey: on ? (on.dataset.trigger || on.dataset.sen || on.dataset.nt || on.dataset.scope) : null,
    onText: on ? getComputedStyle(on).color : null, text: getComputedStyle(document.querySelector('alarmageddon-panel')).getPropertyValue('--ag-text').trim(),
    primaryText: sub ? getComputedStyle(sub).color : null, full: on ? o(on) : 0, dim: bs.filter((b) => b !== on).every((b) => o(b) < 1 && o(b) > 0.5) }`;
const rgb = (x) => x.replace("rgb(", "").replace(")", "");

const browser = await launch();
for (const [theme, mobile, query] of [["light", false, ""], ["dark", false, ""], ["dark", true, ""], ["dark", false, "&monitor=1"]]) {
  const tag = `${theme}/${mobile ? "Handy" : "Desktop"}${query ? " mit Überwachung" : ""}`;
  const s = await open(browser, { mobile, lang: "de", theme, tab: "config", query });
  const dark = await s.ev("return r.host.hasAttribute('dark')");
  const wantA = dark ? "rgb(224, 74, 71)" : "rgb(211, 47, 47)";
  const wantM = dark ? "rgb(242, 163, 58)" : "rgb(233, 150, 47)";
  for (const [name, sub, seg, sw] of BARS) {
    await s.tap(`[data-sub="${sub}"]`);
    await s.waitFor(`return !!r.querySelector('${sw.replace(/'/g, "\\'")}')`);
    // "Einstellungen pro Modus" einschalten, falls aus (die Reiter erscheinen nur dann)
    if (!(await s.ev(`return !!r.querySelector('[data-seg="${seg}"]') && r.host.${{ sensors: "sensors", actions: "actions", notify: "notify", system: "systemUi" }[sub]}.draft?.${sub === "notify" ? "per_mode" : "perMode"} !== false`))) {
      await s.tap(sw);
    }
    check(`${tag}: ${name}: Reiter der Modi da`, await s.waitFor(`return !!r.querySelector('[data-seg="${seg}"] > .ag-pill')`));
    await s.page.waitForTimeout(500);
    const m = await s.ev(READ, seg);
    check(`${tag}: ${name}: Klasse ag-modeseg, Icons der Modi im Dunkelrot der Zone "Alarm"${m?.mon?.length ? ', "Überwachung" orange' : ""}`,
      m && m.cls && m.alarm.length >= 2 && m.alarm.every((x) => x === wantA) && m.mon.every((x) => x === wantM), JSON.stringify(m));
    check(`${tag}: ${name}: gewählter Reiter mit dunkelrotem Rand, Text neutral (nicht blau), Icon voll, die anderen gedämpft`,
      m && m.onKey !== "monitor" && m.ring.includes(rgb(wantA)) && m.onText !== m.primaryText && m.full === 1 && m.dim, JSON.stringify(m));
    // Ein anderer Reiter gewählt: der Rand bleibt dunkelrot (bei "Überwachung" orange)
    const other = await s.ev(`const b = [...r.querySelectorAll('[data-seg="${seg}"] > button:not(.on)')].find((x) => x.dataset.trigger !== 'monitor'); return b ? [...b.attributes].filter((a) => a.name.startsWith('data-')).map((a) => '[' + a.name + '="' + a.value + '"]').join('') : null`);
    if (other) {
      await s.tap(`[data-seg="${seg}"] > button${other}`);
      check(`${tag}: ${name}: anderer Reiter gewählt, Rand weiter dunkelrot`, await s.waitFor(`const p = r.querySelector('[data-seg="${seg}"] > .ag-pill'); return !!p && getComputedStyle(p).boxShadow.includes(${JSON.stringify(rgb(wantA))}) && r.querySelector('[data-seg="${seg}"] > button.on')?.matches('${other.replace(/'/g, "\\'")}')`));
    }
    if (query && sub === "actions") {
      await s.tap('[data-seg="wf-trigger"] > [data-trigger="monitor"]');
      check(`${tag}: Aktionen: "Überwachung" gewählt, Rand orange`, await s.waitFor(`return getComputedStyle(r.querySelector('[data-seg="wf-trigger"] > .ag-pill')).boxShadow.includes(${JSON.stringify(rgb(wantM))})`));
    }
    if (theme === "dark" && !query) {
      await s.ev(`r.querySelector('[data-seg="${seg}"]').scrollIntoView({ block: 'center' }); return 1`);
      await s.page.waitForTimeout(400);
      await (await s.el(`[data-seg="${seg}"]`)).screenshot({ path: `${outDir}modetabs-${sub}-${mobile ? "mobile" : "desktop"}.png` });
    }
  }
  // Die anderen Reiterleisten bleiben blau: Hauptreiter und Unterreiter tragen die Klasse nicht
  check(`${tag}: Hauptreiter und Unterreiter ohne ag-modeseg`, await s.ev("return !r.querySelector('[data-seg=\"tabs\"]').classList.contains('ag-modeseg') && !r.querySelector('[data-seg=\"sub\"]').classList.contains('ag-modeseg')"));
  check(`${tag}: ohne Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}
await browser.close();
done();
