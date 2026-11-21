// 1.73.0: Alle kleinen Fenster mit einem Namensfeld sehen gleich aus wie "Code hinzufügen" (Wunsch des Nutzers 2026-11-21: "es soll überall gleich aussehen"):
// Backup erstellen, Anlage hinzufügen, umbenennen und löschen tragen den Feldtitel als Kapitel (fetter Titel mit Strich davor) statt einer kleinen grauen
// Beschriftung. Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const DIALOGS = [
  { name: "Backup erstellen", open: "r.host.systemUi.openCreateBackup(); return 1", id: "ag-codes", title: { de: "Name (optional)", en: "Name (optional)" } },
  { name: "Anlage hinzufügen", open: "r.host._openAdd(); return 1", id: "ag-add", title: { de: "Name", en: "Name" } },
  { name: "Anlage umbenennen", open: "r.host._openRename(); return 1", id: "ag-rename", title: { de: "Name", en: "Name" } },
  { name: "Anlage löschen", open: "r.host._openDelete(); return 1", id: "ag-delete", title: { de: "Bestätigung", en: "Confirmation" } },
];

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, theme: "dark", tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('[data-sys=\"bk-open\"], .ag-sys')", 15000);
    await s.sim(`window.__setState("alarm_control_panel.haus", "disarmed", { arm_mode: null, changed_by: null, deadline: null }); return 1`); // das Löschen gibt es nur bei deaktivierter Anlage
    for (const d of DIALOGS) {
      await s.ev(d.open);
      const ok = await s.waitFor(`const d=r.getElementById('${d.id}'); return d && d.open && d.querySelector('.ag-chap > h3.ag-chap-t')`, 8000);
      const info = await s.ev(`const d=r.getElementById('${d.id}'); const h=d.querySelector('.ag-chap > h3.ag-chap-t'); const c=h && getComputedStyle(h); return { title: h?.textContent, weight: c ? parseInt(c.fontWeight) : 0, size: c ? parseFloat(c.fontSize) : 0, bar: h ? getComputedStyle(h, '::before').width : '', small: !!d.querySelector('label.ag-t2.ag-small'), input: d.querySelector('.ag-chap input.ag-input')?.getBoundingClientRect().width || 0 }`);
      check(`${tag}: ${d.name}: Feldtitel "${d.title[lang]}" als Kapitel (fett, Strich davor), keine kleine Beschriftung, Feld in voller Breite`,
        ok && info.title === d.title[lang] && info.weight >= 600 && info.bar === "4px" && !info.small && info.input > 150, JSON.stringify(info));
      await s.ev(`r.getElementById('${d.id}').close(); return 1`);
    }
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
