// 1.75.0: Akzentfarbe je Anlage (Wunsch des Nutzers 2026-11-21): Kapitel unter Konfiguration › Anlage über dem Einrichtungsassistenten (Auswahl wie im Device
// Panel), Entwurf mit "Speichern", Vorschau sofort; im Fenster "Anlage hinzufügen" ebenfalls wählbar; die Farbe ersetzt das Blau (--ag-primary) im ganzen Panel
// und gilt je Anlage. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const NAMES = { de: ["Home Assistant", "Himmelblau", "Ozeanblau", "Türkis", "Indigo", "Rosa", "Orange", "Rot", "Tannengrün", "Graphit"], en: ["Home Assistant", "Sky blue", "Ocean blue", "Turquoise", "Indigo", "Pink", "Orange", "Red", "Fir green", "Graphite"] };
const TITLE = { de: "Allgemein", en: "General" }; // Kapitel unter Konfiguration › Anlage (seit 1.94.0, vorher "Akzentfarbe")
const ADD_TITLE = { de: "Akzentfarbe", en: "Accent colour" }; // Kapitel im Fenster "Anlage hinzufügen"
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('.ag-health')");
    const prim = () => s.ev("return r.host.style.getPropertyValue('--ag-primary')");
    check(`${tag}: ohne eigene Farbe gilt die Farbe des Themes (kein Wert am Panel)`, (await prim()) === "");
    const chap = await s.ev(`const cs=[...r.querySelectorAll('.ag-chap')]; const i=cs.findIndex((c) => c.querySelector('.ag-chap-t')?.textContent === ${JSON.stringify(TITLE[lang])}); const wz=cs.findIndex((c) => c.querySelector('.ag-wzrow')); return { i, wz, btn: !!cs[i]?.querySelector('[data-sys="acc-open"]'), tint: !!cs[i]?.querySelector('.ag-tint-neutral'), grid: cs[i]?.querySelectorAll('.ag-accbtn').length, name: cs[i]?.querySelector('.ag-accname')?.textContent.trim(), dot: cs[i]?.querySelector('.ag-accdot')?.getBoundingClientRect().width, chips: !!cs[i]?.querySelector('.ag-accchips') }`);
    // Wunsch des Nutzers 2026-11-28: die beiden Symbole haben nicht dieselbe Farbe (Name: blau, nicht orange wie eine Warnung; Akzentfarbe: neutral mit Farbpunkten),
    // und "Umbenennen" ist wie "Akzentfarbe ändern" linksbündig und gleich gross (nicht über die ganze Breite)
    const gen = await s.ev(`const c=[...r.querySelectorAll('.ag-chap')].find((x) => x.querySelector('.ag-namerow')); const n=c.querySelector('.ag-namerow .ag-oav'), a=c.querySelector('.ag-accrow .ag-oav'); const bn=c.querySelector('.ag-namerow .ag-btnrow .ag-btn').getBoundingClientRect(), ba=c.querySelector('.ag-accrow .ag-btnrow .ag-btn').getBoundingClientRect(), card=c.querySelector('.ag-card').getBoundingClientRect(); const dots=a.querySelectorAll('svg circle'); return { nc: getComputedStyle(n).color, ac: getComputedStyle(a).color, dots: dots.length, same: Math.abs(bn.width - ba.width) < 1 && Math.abs(bn.height - ba.height) < 1, left: Math.abs(bn.left - ba.left) < 1, full: bn.width > card.width * 0.9 }`);
    check(`${tag}: Symbol "Name" und Symbol "Akzentfarbe" in verschiedenen Farben, die Palette mit vier Farbpunkten`, gen.nc !== gen.ac && gen.dots === 4, JSON.stringify(gen));
    if (mobile) check(`${tag}: Handy: "Umbenennen" und "Akzentfarbe ändern" linksbündig, gleich gross, nicht über die ganze Breite`, gen.same && gen.left && !gen.full, JSON.stringify(gen));
    check(`${tag}: Kapitel "${TITLE[lang]}" (Name und Akzentfarbe, seit 1.94.0) direkt über dem Einrichtungsassistenten: Zeile mit eigenem Symbol und Knopf, die Farben stehen nicht auf der Seite`, chap.i >= 0 && chap.wz === chap.i + 1 && chap.btn && chap.tint && !chap.grid && chap.name === NAMES[lang][0] && chap.dot >= 14, JSON.stringify(chap));
    await s.tap('[data-sys="acc-open"]');
    await s.waitFor("return r.getElementById('ag-accent').open");
    // Das Fenster ist am Computer so breit wie die Fenster der Listen (Dienste, Töne, Backups), Wunsch des Nutzers 2026-11-23
    if (!mobile) check(`${tag}: Fenster "Akzentfarbe" ist so breit wie die Fenster der Listen (880 px)`, await s.ev("return Math.abs(r.getElementById('ag-accent').getBoundingClientRect().width - Math.min(880, innerWidth - 32)) < 2"));
    const dlg = await s.ev(`const d=r.getElementById('ag-accent'); return { names: [...d.querySelectorAll('.ag-accbtn')].map((b) => b.innerText.trim()), on: d.querySelector('.ag-accbtn.on')?.dataset.key, prev: !!d.querySelector('.ag-accprev'), btns: [...d.querySelectorAll('.ag-dlg-btns .ag-btn')].map((b) => b.innerText.trim()) }`);
    check(`${tag}: Fenster: Symbol und Titel, zehn Farben, Vorschau, Abbrechen und Übernehmen`, JSON.stringify(dlg.names) === JSON.stringify(NAMES[lang]) && dlg.on === "ha" && dlg.prev && dlg.btns.length === 2, JSON.stringify(dlg));
    await s.tap('#ag-accent [data-sys="acc-pick"][data-key="green"]');
    const pv = await s.ev("const d=r.getElementById('ag-accent'); return { host: r.host.style.getPropertyValue('--ag-primary'), box: d.querySelector('.ag-accprev').style.getPropertyValue('--ag-primary'), on: d.querySelector('.ag-accbtn.on')?.dataset.key, btn: getComputedStyle(d.querySelector('.ag-accprev .ag-btn')).backgroundColor, tog: getComputedStyle(d.querySelector('.ag-accprev .ag-toggle')).backgroundColor }");
    check(`${tag}: Wahl zeigt die Farbe sofort im ganzen Panel und in der Vorschau (Knopf, Schalter)`, pv.host === "#4a8f5f" && pv.box === "#4a8f5f" && pv.on === "green" && pv.btn === "rgb(74, 143, 95)" && pv.tog === "rgb(74, 143, 95)", JSON.stringify(pv));
    // Simulation: Reiter, Schalter, Haken, Pfeil, Pille und Knopf lassen sich antippen und ändern nur die Anzeige im Fenster (die Wahl und die Anlage bleiben)
    const sim = async () => s.ev("const d=r.getElementById('ag-accent'); const p=d.querySelector('.ag-accprev'); return { tab: [...p.querySelectorAll('[data-sys=\"accpv-tab\"]')].findIndex((b) => b.classList.contains('on')), tog: p.querySelector('[data-sys=\"accpv-tog\"]').classList.contains('on'), chk: p.querySelector('[data-sys=\"accpv-chk\"]').classList.contains('on'), tag: p.querySelector('[data-sys=\"accpv-tag\"]').classList.contains('on'), up: !!p.querySelector('[data-sys=\"accpv-round\"] path') && p.querySelector('[data-sys=\"accpv-round\"] path').getAttribute('d').startsWith('M7.41,15'), btn: p.querySelector('[data-sys=\"accpv-btn\"]').innerText.trim(), pick: d.querySelector('.ag-accbtn.on')?.dataset.key }");
    const before = await sim();
    for (const a of ["accpv-tab\"][data-i=\"1", "accpv-tog", "accpv-chk", "accpv-tag", "accpv-round", "accpv-btn"]) await s.tap(`#ag-accent [data-sys="${a.replace(/\\"/g, '"')}"]`);
    const after = await sim();
    check(`${tag}: Vorschau ist eine Simulation: Reiter, Schalter, Haken, Pille, Pfeil und Knopf reagieren, die Farbwahl bleibt`, before.tab === 0 && after.tab === 1 && before.tog && !after.tog && before.chk && !after.chk && before.tag && !after.tag && before.up && !after.up && after.btn !== before.btn && after.pick === "green", JSON.stringify([before, after]));
    {
      // Knopf der Zeile wie "Assistent starten": linksbündig, nie über die ganze Breite
      const g = await s.ev(`const b=r.querySelector('[data-sys="acc-open"]'); const c=b.closest('.ag-card'); const x=b.getBoundingClientRect(), y=c.getBoundingClientRect(); return { w: x.width, cw: y.width, left: x.left - y.left }`);
      check(`${tag}: "Akzentfarbe ändern" nicht über die ganze Breite und linksbündig (${Math.round(g.w)} von ${Math.round(g.cw)} px)`, g.w < g.cw * 0.7 && (!mobile || g.left < 90));
    }
    {
      // Schieber der Vorschau: echtes Ziehen mit der Maus (Desktop) bzw. Antippen (Handy) ändert den Wert und füllt den Balken
      const h = await s.el('#ag-accent [data-sys="accpv-val"]');
      await h.scrollIntoViewIfNeeded();
      const box = await h.boundingBox();
      const v0 = Number(await s.ev("return r.querySelector('[data-sys=\"accpv-val\"]').value"));
      const x = box.x + box.width * 0.2, y = box.y + box.height / 2;
      if (mobile) await s.page.touchscreen.tap(x, y);
      else { await s.page.mouse.move(box.x + box.width * 0.6, y); await s.page.mouse.down(); await s.page.mouse.move(x, y, { steps: 6 }); await s.page.mouse.up(); }
      const v1 = await s.ev("const i=r.querySelector('[data-sys=\"accpv-val\"]'); return { v: Number(i.value), fill: i.style.getPropertyValue('--v') }");
      check(`${tag}: Schieber der Vorschau lässt sich bewegen und füllt den Balken (${v0} -> ${v1.v})`, v1.v !== v0 && v1.v < 40 && v1.fill === v1.v + '%');
    }
    await s.waitFor("return r.getElementById('ag-accent').querySelector('[data-sys=\"accpv-btn\"]').innerText.trim() !== '" + after.btn + "'", 3000).catch(() => {});
    await s.tap('#ag-accent [data-sys="acc-cancel"]');
    await s.waitFor("return !r.getElementById('ag-accent').open");
    await s.waitFor("return r.host.style.getPropertyValue('--ag-primary') === ''", 3000).catch(() => {});
    check(`${tag}: Abbrechen stellt die Farbe zurück, nichts ist geändert`, (await prim()) === "" && await s.ev("return !r.querySelector('.ag-unsaved') || ![...r.querySelectorAll('.ag-unsaved')].some((e) => e.closest('.ag-chap')?.querySelector('[data-sys=\"acc-open\"]'))"));
    await s.tap('[data-sys="acc-open"]');
    await s.waitFor("return r.getElementById('ag-accent').open");
    await s.tap('#ag-accent [data-sys="acc-pick"][data-key="green"]');
    await s.tap('#ag-accent [data-sys="acc-apply"]');
    await s.waitFor("return !r.getElementById('ag-accent').open");
    const dirty = await s.ev("const c=[...r.querySelectorAll('.ag-chap')].find((x) => x.querySelector('[data-sys=\"acc-open\"]')); return { name: c.querySelector('.ag-accname').textContent.trim(), unsaved: !!c.querySelector('.ag-unsaved'), prim: r.host.style.getPropertyValue('--ag-primary'), saveOn: !r.querySelector('[data-sys=\"save\"]').disabled }");
    check(`${tag}: Übernehmen: Zeile zeigt "${NAMES[lang][8]}" mit "Noch nicht gespeichert", Speichern frei, Farbe bleibt`, dirty.name === NAMES[lang][8] && dirty.unsaved && dirty.prim === "#4a8f5f" && dirty.saveOn, JSON.stringify(dirty));
    await s.tap('[data-sys="save"]');
    await s.page.waitForTimeout(500);
    check(`${tag}: gespeichert: die Anlage trägt die Farbe, die Marke "Noch nicht gespeichert" ist weg`, await s.sim("return window.__systems.some((x) => x.accent === 'green')") && (await prim()) === "#4a8f5f" && await s.ev("return ![...r.querySelectorAll('.ag-chap')].find((x) => x.querySelector('[data-sys=\"acc-open\"]')).querySelector('.ag-unsaved')"));
    // Je Anlage: eine zweite Anlage ohne Farbe zeigt wieder die Farbe des Themes
    const ids = await s.sim("return window.__systems.map((x) => [x.entry_id, x.accent || 'ha'])");
    check(`${tag}: die Farbe gehört der Anlage (andere Anlagen bleiben bei "ha")`, ids.filter(([, a]) => a === "green").length === 1, JSON.stringify(ids));
    // Neu laden: bleibt
    await s.page.reload();
    await s.waitFor("return !!r.querySelector('.ag-health') || !!r.querySelector('.ag-headsys')", 12000).catch(() => {});
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Fenster "Anlage hinzufügen" -----
    const a = await open(browser, { mobile, lang });
    await a.page.waitForTimeout(300);
    await a.tap('.ag-headsys [data-act="add"]');
    await a.waitFor("return r.getElementById('ag-add').open");
    const grid = await a.ev(`const d=r.getElementById('ag-add'); return { n: d.querySelectorAll('.ag-accbtn').length, on: d.querySelector('.ag-accbtn.on')?.dataset.key, chap: [...d.querySelectorAll('.ag-chap-t')].map((e) => e.textContent) }`);
    check(`${tag}: Fenster "Anlage hinzufügen": zehn Farben, "Home Assistant" vorgewählt, Kapitel "${ADD_TITLE[lang]}"`, grid.n === 10 && grid.on === "ha" && grid.chap.includes(ADD_TITLE[lang]), JSON.stringify(grid));
    await a.tap('#ag-add [data-act="add-accent"][data-key="red"]');
    check(`${tag}: Wahl im Fenster markiert die Farbe`, await a.ev("return r.getElementById('ag-add').querySelector('.ag-accbtn.on')?.dataset.key === 'red'"));
    await (await a.el("#ag-add-input")).fill("Farbtest");
    await a.waitFor("return !r.getElementById('ag-add').querySelector('button[type=submit]').disabled", 6000);
    await a.tap('#ag-add button[type="submit"]');
    await a.page.waitForTimeout(800);
    check(`${tag}: neue Anlage trägt die gewählte Farbe, das Panel zeigt sie`, await a.sim("return window.__systems.some((x) => x.title === 'Farbtest' && x.accent === 'red')") && (await a.ev("return r.host.style.getPropertyValue('--ag-primary')")) === "#d9453d");
    check(`${tag}: keine Fehler der Seite (Fenster)`, a.errors.length === 0, a.errors.join(" | "));
    await a.ctx.close();
  }
}
await browser.close();
done();
