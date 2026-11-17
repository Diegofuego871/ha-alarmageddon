// 1.58.0: Zustände kommen ohne Verzug im Panel an. Im echten Home Assistant holt panel.html das hass-Objekt selbst ab; bis 1.57.0 nur
// alle 5 Sekunden: ein Alarm stand erst nach bis zu 5 Sekunden im Panel, und nach dem Scharfschalten blieb die Ladeanzeige bis zu
// 4 Sekunden stehen. Der Nachbau läuft hier mit ?realhass=1 (er reicht das Objekt nicht selbst ins Panel). Dazu: die Module des Panels
// werden gleichzeitig geladen (modulepreload), nicht eines nach dem anderen.
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
for (const mobile of [false, true]) {
  const tag = mobile ? "Handy" : "Desktop";
  const s = await open(browser, { mobile, lang: "de", query: "&realhass=1" });
  const id = await s.ev("return r.host._systems()[0].entity_id");
  // Alarm: der Zustand ändert sich in Home Assistant, niemand stösst das Panel an
  await s.page.waitForTimeout(600);
  let start = Date.now();
  await s.sim("window.__setState(arg, 'triggered', { triggered_by: 'binary_sensor.haustuer' }); return 1", id);
  const shown = await s.waitFor("return !!r.querySelector('.ag-alarm')", 4000);
  let took = Date.now() - start;
  check(`${tag}: ein Alarm steht innert einer Sekunde im Panel (${took} ms), ohne dass es jemand anstösst`, shown && took < 1000, `${took} ms`);
  start = Date.now();
  await s.sim("window.__setState(arg, 'disarmed', { triggered_by: null }); return 1", id);
  const gone = await s.waitFor("return !r.querySelector('.ag-alarm')", 4000);
  took = Date.now() - start;
  check(`${tag}: das Ende des Alarms ebenso (${took} ms)`, gone && took < 1000, `${took} ms`);
  // Scharfschalten: die Ladeanzeige endet, sobald Home Assistant den neuen Zustand meldet, nicht erst nach Sekunden
  start = Date.now();
  await s.tap('.ag-sys [data-seg="mode"] button[data-mode="home"], .ag-sys .ag-seg button[data-mode="home"]');
  const armed = await s.waitFor("return !r.querySelector('.ag-root.ag-ldwrap') && !!r.querySelector('.ag-sys.ag-armed')", 6000);
  took = Date.now() - start;
  check(`${tag}: nach dem Scharfschalten ist das Panel innert 1,5 Sekunden wieder bedienbar (${took} ms)`, armed && took < 1500, `${took} ms`);
  // Dasselbe hass-Objekt wird nicht immer wieder gesetzt (nur ein neues Objekt geht ans Panel)
  const sets = await s.ev("const el=r.host; let n=0; const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'hass'); Object.defineProperty(el, 'hass', { configurable: true, get() { return d.get.call(el); }, set(v) { n += 1; d.set.call(el, v); } }); return new Promise((ok) => setTimeout(() => ok(n), 1200))");
  check(`${tag}: ohne Änderung in Home Assistant setzt panel.html nichts neu (${sets})`, sets === 0, String(sets));
  // Laden: alle Module sind vorab angemeldet und beginnen gleichzeitig
  const load = await s.frame.evaluate(() => {
    const links = [...document.querySelectorAll('link[rel="modulepreload"]')].map((l) => new URL(l.href).pathname.split("/").pop());
    const res = performance.getEntriesByType("resource").filter((e) => /\.js(\?|$)/.test(e.name)).map((e) => ({ name: new URL(e.name).pathname.split("/").pop(), start: e.startTime }));
    return { links, res };
  });
  const starts = load.res.map((x) => x.start);
  check(`${tag}: jedes geladene Modul ist vorab angemeldet (${load.links.length} Hinweise, ${load.res.length} Dateien)`, load.res.length >= 12 && load.res.every((x) => load.links.includes(x.name)), JSON.stringify(load.res.filter((x) => !load.links.includes(x.name))));
  check(`${tag}: die Module starten gleichzeitig, nicht eines nach dem anderen (Spanne ${Math.round(Math.max(...starts) - Math.min(...starts))} ms)`, Math.max(...starts) - Math.min(...starts) < 150);
  check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
  await s.ctx.close();
}
await browser.close();
done();
