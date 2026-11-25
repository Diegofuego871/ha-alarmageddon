// Änderungen von aussen sind keine ungespeicherten Änderungen (1.91.0, gefunden beim Bau von "Voreinstellungen auf Sensoren anwenden"): ändert der
// Server etwas, während eine Seite der Konfiguration offen ist (eigene Werte über die Voreinstellungen zurückgesetzt, ein anderes Gerät hat
// gespeichert), verwirft das Panel den unberührten Entwurf und zeigt die neuen Werte. Bis 1.90.0 verglich es nur mit den neuen Daten: der Entwurf
// stand als "N Änderungen" da (orange Punkte) und hätte mit dem nächsten Speichern die alten Werte zurückgeschrieben. Eine echte Änderung des Nutzers
// bleibt. Je Seite (Sensoren, Anlage, Benachrichtigungen, Aktionen), Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const J = JSON.stringify;
// Je Seite: Teil des Panels, eine Änderung auf dem Server (Nachbau), was die Seite danach zeigen muss, und eine Änderung des Nutzers
const PAGES = [
  { sub: "sensors", ui: "sensors",
    server: "delete window.__systems[0].sensor_options['binary_sensor.terrassentuer']; window.__systems[0].sensor_options['binary_sensor.haustuer'] = { confirm: true }; return 1",
    shows: "const d=r.host.sensors.ensureDraft(); return !d.opts['binary_sensor.terrassentuer'] && d.opts['binary_sensor.haustuer']?.confirm === true",
    user: "r.host.sensors.ensureDraft().opts['binary_sensor.fenster_bad'] = { confirm: true }; r.host.sensors.render(); return 1",
    kept: "return r.host.sensors.draft?.opts['binary_sensor.fenster_bad']?.confirm === true" },
  { sub: "system", ui: "systemUi",
    server: "for (const m of Object.values(window.__systems[0].mode_settings)) m.entry_delay = 45; return 1",
    shows: "const d=r.host.systemUi.ensureDraft(); return Object.values(d.per).every((p) => Number(p.entry_delay) === 45)",
    user: "r.host.systemUi.ensureDraft().perMode = !r.host.systemUi.ensureDraft().perMode; r.host._renderView(false); return 1",
    kept: "return r.host.systemUi.dirtyCount() > 0" },
  { sub: "notify", ui: "notify",
    server: "window.__notify.battery_threshold = 25; return 1",
    shows: "return r.host.notify.dirtyCount() === 0 && r.host._data.notify.battery_threshold === 25 && (r.host.notify.draft === null || r.host.notify.ensureDraft().battery_threshold === 25)",
    user: "r.host.notify.ensureDraft().per_mode = !r.host.notify.ensureDraft().per_mode; r.host._renderView(false); return 1",
    kept: "return r.host.notify.dirtyCount() > 0" },
  { sub: "actions", ui: "actions",
    server: "const s=window.__systems[0]; s.workflows = { ...s.workflows, away: [{ type: 'notify' }, { type: 'wait', seconds: 30 }] }; return 1",
    shows: "return r.host.actions.dirtyCount() === 0 && r.host._system('e_haus').workflows.away.length === 2",
    user: "const a=r.host.actions; a.ensureDraft(); a._setSteps([{ type: 'notify' }], 'main'); a.render(); return 1",
    kept: "return r.host.actions.dirtyCount() > 0" },
];

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    for (const p of PAGES) {
      const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: p.sub } });
      await s.waitFor(`return !!r.querySelector('[data-sub="${p.sub}"].on, [data-sub="${p.sub}"][aria-selected="true"]') || r.host._sub === ${J(p.sub)}`, 8000);
      await s.page.waitForTimeout(400);
      // Der Entwurf entsteht beim Zeichnen oder bei der ersten Berührung: hier ausdrücklich, unberührt
      await s.ev(`r.host.${p.ui}.ensureDraft(); return 1`);
      const before = await s.ev(`return r.host.${p.ui}.dirtyCount()`);
      check(`${tag} ${p.sub}: Entwurf ohne Änderung`, before === 0, String(before));

      // ----- Der Server ändert etwas: kein orange Punkt, die Seite zeigt die neuen Werte -----
      await s.sim(p.server);
      await s.ev("return r.host._fetch().then(() => 1)");
      await s.page.waitForTimeout(300);
      const after = await s.ev(`return { n: r.host.${p.ui}.dirtyCount(), dot: r.querySelector('[data-sub="${p.sub}"]')?.classList.contains('has-edit'), cfg: r.querySelector('[data-tab="config"]')?.classList.contains('has-edit') }`);
      check(`${tag} ${p.sub}: Änderung des Servers ist keine ungespeicherte Änderung (kein oranger Punkt)`, after.n === 0 && !after.dot && !after.cfg, J(after));
      check(`${tag} ${p.sub}: die Seite zeigt die neuen Werte`, await s.ev(p.shows));

      // ----- Eine echte Änderung des Nutzers bleibt, auch wenn der Server danach wieder etwas ändert -----
      await s.ev(p.user);
      check(`${tag} ${p.sub}: Änderung des Nutzers zählt`, await s.ev(p.kept));
      await s.sim("window.__systems[1].sensor_options = { 'binary_sensor.bewegung_garage': { confirm: true } }; window.__notify.offline_minutes = 61; return 1");
      await s.ev("return r.host._fetch().then(() => 1)");
      await s.page.waitForTimeout(300);
      check(`${tag} ${p.sub}: Änderung des Nutzers bleibt nach dem Abruf`, await s.ev(p.kept));
      check(`${tag} ${p.sub}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
      await s.ctx.close();
    }
  }
}
await browser.close();
done();
