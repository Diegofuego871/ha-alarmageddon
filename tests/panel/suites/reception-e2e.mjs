// 1.41.0: Empfang von ZHA und Bluetooth. Der Server liefert den Wert (stärkster Empfänger, geglättet), das Panel zeigt nur den Wert und den Verlauf:
// kein Empfängername, keine Technik. Geht ein Gerät gerade nicht, bleibt der Reiter "Empfang" da und zeigt "–". Je Sprache, Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const WINDOW = "binary_sensor.fenster_kueche";
const SILENT = "binary_sensor.terrassentuer";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, query: "&ble=1" });
    await s.waitFor(`return !!r.querySelector('[data-act="more"][data-entity="${WINDOW}"]')`);
    const rows = await s.ev("return r.host.list.rows().map((x) => [x.id, x.signal])");
    const byId = Object.fromEntries(rows);
    check(`${tag}: das Küchenfenster zeigt den Wert vom Server: -61 dBm, ohne Entität`, JSON.stringify(byId[WINDOW]) === JSON.stringify({ value: -61, unit: "dBm" }), JSON.stringify(byId[WINDOW]));
    check(`${tag}: ein Gerät, das gerade nicht gehört wird, zeigt keinen Wert ("–")`, byId[SILENT] === null);
    check(`${tag}: Geräte mit Sensor zeigen weiter den Wert des Sensors`, byId["binary_sensor.haustuer"]?.value === -58 && byId["binary_sensor.haustuer"]?.unit === "dBm");
    await s.tap(`[data-act="more"][data-entity="${WINDOW}"]`);
    await s.waitFor("const d=r.getElementById('ag-sensor'); return d.open && d.querySelectorAll('.ag-sv-tile').length >= 3");
    const tiles = await s.ev("return [...r.getElementById('ag-sensor').querySelectorAll('.ag-sv-tile')].map((b) => [b.querySelector('small').textContent, b.querySelector('b').textContent])");
    const sig = tiles.find((t) => /Empfang|Signal/.test(t[0]));
    check(`${tag}: Reiter "Empfang" mit -61 dBm`, !!sig && /-61|−61/.test(sig[1]) && /dBm/.test(sig[1]), JSON.stringify(tiles));
    check(`${tag}: im Fenster steht kein Name eines Empfängers oder einer Technik`, await s.ev("return !/proxy|adapter|esphome|bluetooth|scanner|zha/i.test(r.getElementById('ag-sensor').innerText)"));
    await s.tap("#ag-sensor .ag-sv-tile:nth-child(3)");
    await s.waitFor("return !!r.getElementById('ag-sensor').querySelector('.ag-sv-chart svg')");
    check(`${tag}: Verlauf des Empfangs wird gefragt`, await s.sim(`return window.__calls.some((c) => c.type === "alarmageddon/sensor_history" && c.entity_id === ${JSON.stringify(WINDOW)} && c.kind === "signal")`));
    await s.tap('#ag-sensor [data-act="close"], #ag-sensor .ag-dlg-x');
    await s.ctx.close();
  }
}
await browser.close();
done();
