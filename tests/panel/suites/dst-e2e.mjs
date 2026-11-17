// 1.58.0: Sensoransicht über die Zeitumstellung hinweg. Am Tag der Umstellung im Herbst hat der Tag 25 Stunden: die Tageszeilen über 7 und
// 30 Tage liefen dann in eine Endlosschleife ("Invalid string length"), solange dieser Tag im Zeitraum lag. Die Suiten laufen sonst in UTC
// (CI), wo es keine Umstellung gibt: hier mit fester Zeitzone und fester Uhrzeit, je einmal nach der Umstellung im Herbst und im Frühling.
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
for (const [season, time] of [["Herbst (Tag mit 25 Stunden)", "2026-11-03T09:00:00Z"], ["Frühling (Tag mit 23 Stunden)", "2027-04-06T09:00:00Z"]]) {
  for (const mobile of [false, true]) {
    const tag = `${season}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang: "de", context: { timezoneId: "Europe/Zurich" }, fixedTime: new Date(time) });
    await s.ev("r.host.sensorView.open('binary_sensor.haustuer'); return 1");
    await s.waitFor("return r.getElementById('ag-sensor').open");
    for (const [hours, rows] of [[168, 7], [720, 30]]) {
      const start = Date.now();
      await s.ev(`r.getElementById('ag-sensor').querySelector('.ag-sv-range [data-hours="${hours}"]').click(); return 1`);
      const ok = await s.waitFor(`return r.getElementById('ag-sensor').querySelectorAll('.ag-sv-chart .sv-track').length === ${rows}`, 8000);
      check(`${tag}: ${rows} Tage: ${rows} Zeilen, die Grafik steht ohne Verzug (${Date.now() - start} ms)`, ok && Date.now() - start < 5000);
      const inside = await s.ev("const d=r.getElementById('ag-sensor'); const t=d.querySelector('.ag-sv-chart .sv-track').getBoundingClientRect(); return [...d.querySelectorAll('.ag-sv-chart rect.sv-on, .ag-sv-chart rect.sv-armed, .ag-sv-chart rect.sv-gone')].every((x) => { const b=x.getBoundingClientRect(); return b.left >= t.left - 1 && b.right <= t.right + 1; })");
      check(`${tag}: ${rows} Tage: kein Balken ragt über die Tageszeile hinaus`, inside);
    }
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
