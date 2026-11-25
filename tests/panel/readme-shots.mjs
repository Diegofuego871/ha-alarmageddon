// Bilder der README aus dem HA-Nachbau erzeugen (kein Test): `CHROMIUM_PATH=... node readme-shots.mjs`, danach
// `python3 ../../scripts/optimize_images.py` (verkleinert die PNG). Ausgabe: docs/img/<ansicht>-<sprache>.png.
// Nur erfundene Daten (CLAUDE.md): echte Namen aus dem Nachbau werden vor der Aufnahme ersetzt.
// Einzelne Bilder neu aufnehmen (seit 1.58.0): `ONLY=step-wizard,actions node readme-shots.mjs` (die Karten des Dashboards entstehen immer).
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, R } from "./lib.mjs";
import { startServer } from "./server.mjs";

const PORT = 8961;
const out = fileURLToPath(new URL("../../docs/img/", import.meta.url));
mkdirSync(out, { recursive: true });
const server = await startServer(PORT);
const browser = await launch();

// Ein Ablauf, wie ihn die README beschreibt: Meldung, Sirene ein, drei Minuten warten, Sirene aus
// (Schritte laufen seit 1.10.0 standardmässig weiter: "wait": false; ohne die Angabe zeigte die Karte die Pille "Wartet …")
const FLOW = [
  { type: "notify" },
  { type: "prealarm", players: ["media_player.sonos_kueche"], sound: "pre_beep", volume: 0.3, duration: 20, wait: true },
  { type: "action", action: "siren.turn_on", target: ["siren.flur"], data: {}, restore: true, wait: false },
  { type: "wait", seconds: 180 },
  { type: "action", action: "siren.turn_off", target: ["siren.flur"], data: {}, wait: false },
];
// Aktionen beim Scharfschalten (1.14.0): ein kurzer Aktivierungston
const ARMED = [{ type: "chime", players: ["media_player.sonos_kueche"], sound: "tone_rise", duration: 3, volume: null, wait: false }];
// Aktionen beim Deaktivieren (1.27.0): ein kurzer Deaktivierungston
const DISARMED = [{ type: "dechime", players: ["media_player.sonos_kueche"], sound: "off_fall", duration: 3, volume: null, wait: false }];
// Aktionen nach dem Quittieren: das Licht im Flur wieder aus
const AFTER = [{ type: "action", action: "light.turn_off", target: ["light.flur"], data: {}, restore: false, wait: false }];

async function shot(lang, name, opts = {}) { if (!process.env.ONLY || process.env.ONLY.split(",").includes(name)) return shotNow(lang, name, opts); }
async function shotNow(lang, name, { mobile = false, tab = "overview", prepare, height = 760, scrollTo = null, query = "" } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1180, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem("alarmageddon.tab", t), tab);
  await page.goto(`http://127.0.0.1:${PORT}/ha-sim.html?lang=${lang}&theme=light${query}`);
  const frameEl = await page.waitForSelector("#panel-frame");
  const frame = await frameEl.contentFrame();
  await frame.waitForFunction(new Function(`const r=${R}; return r && r.querySelector(".ag-view")`), null, { timeout: 10000 });
  // Erfundene Namen und der Ablauf der README
  await page.evaluate(([flow, after, armed, disarmed]) => {
    const swap = (v) => (typeof v === "string" ? v.replaceAll("Diego", "Marco") : v);
    for (const s of window.__systems) {
      for (const e of s.events) e.by = swap(e.by);
      s.workflows = { home: flow, away: flow };
      s.workflows_after = { home: after, away: after };
      s.workflows_armed = { home: armed, away: armed };
      s.workflows_disarmed = { home: disarmed, away: disarmed };
    }
  }, [FLOW, AFTER, ARMED, DISARMED]);
  await frame.evaluate(() => document.querySelector("alarmageddon-panel")._fetch());
  await page.waitForTimeout(400);
  if (prepare) await prepare({ page, frame });
  await page.waitForTimeout(600);
  // Auf den Inhalt rollen, um den es im Bild geht (der feste Kopf des Panels bleibt sichtbar)
  if (scrollTo) await frame.evaluate((sel) => {
    const el = document.querySelector("alarmageddon-panel").shadowRoot.querySelector(sel);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 190);
  }, scrollTo);
  await page.waitForTimeout(300);
  await frame.evaluate((lang) => {
    const root = document.querySelector("alarmageddon-panel").shadowRoot;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    // Erfundene Namen, und keine Herstellernamen im Bild (CLAUDE.md, "Neutrale Texte"): der Lautsprecher des Nachbaus heisst neutral
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.includes("Diego")) node.nodeValue = node.nodeValue.replaceAll("Diego", "Marco");
      if (node.nodeValue.includes("Sonos")) node.nodeValue = node.nodeValue.replaceAll("Sonos", lang === "de" ? "Lautsprecher" : "Speaker");
      // Integrationen nennt die Liste des Einrichtungsassistenten; ein Hersteller steht dort neutral als Technik
      if (node.nodeValue.includes("Shelly")) node.nodeValue = node.nodeValue.replaceAll("Shelly", lang === "de" ? "WLAN" : "Wi-Fi");
    }
  }, lang);
  await frameEl.screenshot({ path: `${out}${name}-${lang}.png` });
  console.log(`${name}-${lang}.png`);
  await ctx.close();
}

// Ein Element knapp unter die feste Leiste rollen (index: das wievielte Element mit diesem Selektor)
const toElement = (frame, selector, index = 0, gap = 12) => frame.evaluate(([sel, i, space]) => {
  const r = document.querySelector("alarmageddon-panel").shadowRoot;
  const el = r.querySelectorAll(sel)[i];
  // Unter der Leiste der Konfiguration klebt auf dem Desktop auch die Karte "Einstellungen pro Modus": die untere der beiden zählt
  // (mehrmals: erst nach dem Rollen steht fest, wo die klebenden Leisten liegen)
  for (let pass = 0; pass < 4; pass++) {
    const bottom = Math.max(...[".ag-cfg", ".ag-wf-head .ag-tools"].map((b) => r.querySelector(b)?.getBoundingClientRect().bottom ?? 0));
    r.host._content.scrollTop += el.getBoundingClientRect().top - (bottom + space);
  }
}, [selector, index, gap]);
const click = (sel) => ({ frame }) => frame.evaluate((s) => document.querySelector("alarmageddon-panel").shadowRoot.querySelector(s)?.click(), sel);
for (const lang of ["en", "de"]) {
  await shot(lang, "overview");
  await shot(lang, "sensors", { tab: "config" });
  // Der Ablauf des Alarms (seit 1.58.0 nur das Kapitel "Bei einem Alarm": die README ist kurz, das Bild auch)
  await shot(lang, "actions", { tab: "config", height: 1280, prepare: async ({ page, frame }) => {
    await click('[data-sub="actions"]')({ frame });
    await page.waitForTimeout(800);
    await toElement(frame, ".ag-wf-line.ag-wf-main"); // ab "Alarm beginnt": die Schritte des Alarms
  } });
  // Aktions-Gruppe (1.59.0): eine Gruppe "bis deaktiviert" im Ablauf des Alarms, mit einem Blinklicht (Handbuch)
  await shot(lang, "group", { tab: "config", height: 1520, prepare: async ({ page, frame }) => {
    await click('[data-sub="actions"]')({ frame });
    await page.waitForTimeout(800);
    await frame.evaluate((name) => {
      const a = document.querySelector("alarmageddon-panel").actions;
      a.ensureDraft();
      const light = (action) => ({ type: "action", action: `light.${action}`, target: ["light.flur"], data: {}, restore: action === "turn_on", wait: false });
      a._setSteps([{ type: "notify" }, { type: "group", name, mode: "until_disarmed", count: 2, seconds: 60, wait: false, steps: [light("turn_on"), { type: "wait", seconds: 2 }, light("turn_off"), { type: "wait", seconds: 2 }] }], "main");
      a.render();
    }, lang === "de" ? "Licht blinken" : "Flash the light");
    await page.waitForTimeout(400);
    await toElement(frame, ".ag-wf-line.ag-wf-main");
  } });
  // Kapitel "Bei einem stillen Alarm" (1.62.0) mit der festen Meldung und einer Aktion, darüber die feste Meldung "Scharf geschaltet" (Handbuch)
  await shot(lang, "silent", { tab: "config", height: 1240, prepare: async ({ page, frame }) => {
    await click('[data-sub="actions"]')({ frame });
    await page.waitForTimeout(800);
    await frame.evaluate(() => {
      const a = document.querySelector("alarmageddon-panel").actions;
      const d = a.ensureDraft();
      a._setSteps([{ type: "action", action: "light.turn_on", target: ["light.flur"], data: {}, restore: false, wait: false }], "report");
      d.notices[a.trigger].armed = { ...d.notices[a.trigger].armed, enabled: true };
      a.render();
    });
    await page.waitForTimeout(400);
    await toElement(frame, ".ag-wf-line.ag-wf-armed");
  } });
  // Die drei Schritte der README (1.58.0), alle auf dem Handy und gleich hoch: Sensoren wählen, Alarm festlegen, scharf schalten ("mobile")
  // Seit 1.69.0 zeigt der erste Schritt den Einrichtungsassistenten (Schritt "Sensoren"); dazu das Bild des Rundgangs am Computer beim Schritt
  // "Zuordnung und Eingang" mit der Schrittliste
  await shot(lang, "step-wizard", { mobile: true, query: "&wizard=open&wzstep=sensors" });
  await shot(lang, "wizard", { height: 860, query: "&wizard=open&wzstep=zones" });
  await shot(lang, "step-actions", { mobile: true, tab: "config", prepare: async ({ page, frame }) => {
    await click('[data-sub="actions"]')({ frame });
    await page.waitForTimeout(800);
    await toElement(frame, ".ag-wf-line.ag-wf-main", 0, 0); // ab "Alarm beginnt": die Schritte des Alarms
  } });
  // Das Kapitel "Beim Deaktivieren" liegt ganz unten: eigenes Bild, bis ans Ende der Seite gerollt
  // Seit 1.62.0 ist das Kapitel länger (feste Meldung "Deaktiviert"): höher, damit Überschrift und Liste ganz unter die festen Leisten passen
  await shot(lang, "actions-disarm", { tab: "config", height: 1000, prepare: async ({ page, frame }) => {
    await click('[data-sub="actions"]')({ frame });
    await page.waitForTimeout(800);
    // Die Überschrift des letzten Kapitels knapp unter die feste Leiste rollen (sonst verdeckt sie die Leiste)
    await frame.evaluate(() => {
      const r = document.querySelector("alarmageddon-panel").shadowRoot;
      const chap = [...r.querySelectorAll(".ag-wf-chap")].pop();
      // Beide festen Leisten zählen: die der Konfiguration und die mit "Einstellungen pro Modus" (sonst liegt die Überschrift darunter)
      const bottom = Math.max(...[".ag-cfg", ".ag-wf-head"].map((b) => r.querySelector(b)?.getBoundingClientRect().bottom ?? 0));
      r.host._content.scrollTop += chap.getBoundingClientRect().top - (bottom + 12);
    });
    await page.waitForTimeout(300);
    const where = await frame.evaluate(() => {
      const r = document.querySelector("alarmageddon-panel").shadowRoot;
      const chap = [...r.querySelectorAll(".ag-wf-chap")].pop().getBoundingClientRect().top;
      const bottom = Math.max(...[".ag-cfg", ".ag-wf-head"].map((b) => r.querySelector(b)?.getBoundingClientRect().bottom ?? 0));
      return { chap: Math.round(chap), bottom: Math.round(bottom) };
    });
    if (where.chap < where.bottom) throw new Error(`actions-disarm: die Überschrift liegt unter der festen Leiste ${JSON.stringify(where)}`);
  } });
  // Eigene Töne (1.39.0): das Kapitel in Konfiguration › Anlage, mit einem hochgeladenen Ton
  await shot(lang, "sounds", { tab: "config", height: 800, query: "&sounds=1", prepare: async ({ page, frame }) => {
    await click('[data-sub="system"]')({ frame });
    await page.waitForTimeout(800);
    // Die Überschrift des Kapitels knapp unter die feste Leiste rollen
    await frame.evaluate(() => {
      const r = document.querySelector("alarmageddon-panel").shadowRoot;
      const chap = r.querySelector('[data-sys="cs-open"]').closest(".ag-chap"); // seit 1.56.0 Zusammenfassung mit Knöpfen, die Liste liegt im Fenster
      const bar = r.querySelector(".ag-cfg");
      r.host._content.scrollTop += chap.getBoundingClientRect().top - (bar.getBoundingClientRect().bottom + 12);
    });
  } });
  // Routinen (1.44.0): das Kapitel in Konfiguration › Anlage mit den Routinen des Nachbaus (Zeit und Gerät, Und/Oder)
  await shot(lang, "routines", { tab: "config", height: 800, prepare: async ({ page, frame }) => {
    await click('[data-sub="system"]')({ frame });
    await page.waitForTimeout(800);
    await frame.evaluate(() => {
      const r = document.querySelector("alarmageddon-panel").shadowRoot;
      const chap = r.querySelector(".ag-rt").closest(".ag-chap");
      const bar = r.querySelector(".ag-cfg");
      r.host._content.scrollTop += chap.getBoundingClientRect().top - (bar.getBoundingClientRect().bottom + 12);
    });
    // Die Liste der Routinen liegt seit 1.55.0 im Fenster: fürs Bild öffnen
    await click('[data-sys="rt-open"]')({ frame });
    await page.waitForTimeout(500);
  } });
  // Überwachung (1.48.0): der Reiter mit den Regeln (Nachbau mit ?monitor=1: Kühlschrank zu warm, Tür offen)
  await shot(lang, "monitor", { tab: "config", height: 1250, query: "&monitor=1", prepare: async ({ page, frame }) => {
    await click('[data-sub="actions"]')({ frame });
    await page.waitForTimeout(600);
    await click('[data-trigger="monitor"]')({ frame });
    await page.waitForTimeout(800);
  } });
  // Beendete Alarme sind zugeklappt (1.17.9): fürs Bild den neuesten aufklappen
  await shot(lang, "log", { tab: "log", prepare: click(".ag-inc-head") });
  await shot(lang, "mobile", { mobile: true });
  // Sensoransicht einer Tür über 7 Tage (1.9.0)
  await shot(lang, "sensor", { height: 900, prepare: async ({ page, frame }) => {
    await frame.evaluate(() => document.querySelector("alarmageddon-panel").sensorView.open("binary_sensor.haustuer"));
    await page.waitForTimeout(500);
    await frame.evaluate(() => document.querySelector("alarmageddon-panel").shadowRoot.querySelector('#ag-sensor .ag-sv-range [data-hours="168"]')?.click());
    await page.waitForTimeout(500);
  } });
  // Selbsttest (1.65.0): das Fenster mit den Befunden des Nachbaus (?selftest=problems), der erste aufgeklappt
  await shot(lang, "selftest", { height: 900, query: "&selftest=problems", prepare: async ({ page, frame }) => {
    await click('.ag-status [data-st="open"]')({ frame });
    await page.waitForTimeout(500);
  } });
  // HealthCheck (1.65.0): das Kapitel in Konfiguration › Anlage (Selbsttest, Abstand, drei Dienste) und das Fenster mit der Liste. Erfundene
  // Adressen des Nachbaus (?hc=sample), alle Lebenszeichen in Ordnung (wie es zum Selbsttest ohne Probleme passt)
  const hcPrepare = (list) => async ({ page, frame }) => {
    await page.evaluate(() => { for (const h of window.__healthchecks) h.status = { at: h.status?.at || new Date(Date.now() - 4 * 60e3).toISOString(), sent: "ok", result: "ok", code: 200, test: false }; });
    await frame.evaluate(() => document.querySelector("alarmageddon-panel")._fetch());
    await click('[data-sub="system"]')({ frame });
    await page.waitForTimeout(800);
    await toElement(frame, ".ag-chap:has(.ag-health)", 0, 18);
    if (list) {
      await click('.ag-hcsum [data-hc="open"]')({ frame });
      await page.waitForTimeout(600);
    }
  };
  await shot(lang, "healthcheck", { tab: "config", height: 720, query: "&hc=sample", prepare: hcPrepare(false) });
  await shot(lang, "healthcheck-list", { tab: "config", height: 760, query: "&hc=sample", prepare: hcPrepare(true) });
  // Protokoll eines Dienstes (1.68.0): über der Liste, "1 Tag" mit Herzschlag, Band und Ereignissen (erfundener Verlauf des Nachbaus)
  await shot(lang, "healthcheck-log", { tab: "config", height: 860, query: "&hc=sample", prepare: async (ctx) => {
    await hcPrepare(true)(ctx);
    await click('#ag-hclist [data-hc-row="a1b2c3d4e5f6"] [data-hc="log"]')(ctx);
    await ctx.page.waitForTimeout(900);
  } });
  // Einstellungen eines Sensors (1.87.0): "Muss beim Scharfschalten geschlossen sein" (seit 1.89.0 mit "Umgehen" eingerückt darunter), "Muss beim
  // Scharfschalten erreichbar sein" (Handbuch)
  await shot(lang, "sensor-options", { tab: "config", height: 900, prepare: async ({ page, frame }) => {
    await click('[data-sub="sensors"]')({ frame });
    await page.waitForTimeout(600);
    await click('[data-sen="detail"][data-ent="binary_sensor.haustuer"]')({ frame });
    await page.waitForTimeout(600);
  } });
  // Störungsmeldungen (1.87.0): mit "Weiterer Sensor während eines Alarms" und "Codes nach Fehleingaben gesperrt" (Handbuch)
  await shot(lang, "notifications", { tab: "config", height: 900, prepare: async ({ page, frame }) => {
    await click('[data-sub="notify"]')({ frame });
    await page.waitForTimeout(800);
    await toElement(frame, ".ag-chap:has(.ag-ntk)", 0, 18);
  } });
  // Kapitel "Nach einem Alarm" (1.87.0) mit eingeschaltetem Nachalarm (Handbuch); seit 1.89.0 mit "Einstellungen pro Modus" und den Reitern
  await shot(lang, "after-alarm", { tab: "config", height: 800, prepare: async ({ page, frame }) => {
    // Gespeichert eingeschaltet (nicht als Entwurf: sonst zeigte das Bild "Noch nicht gespeichert")
    await page.evaluate(() => {
      for (const s of window.__systems) {
        Object.assign(s, { realarm_enabled: true, realarm_count: 3, realarm_per_mode: true,
          realarm_scopes: { home: { enabled: true, count: 3 }, away: { enabled: true, count: 3 }, night: { enabled: false, count: 3 }, always: { enabled: true, count: 2 } } });
      }
    });
    await frame.evaluate(() => document.querySelector("alarmageddon-panel")._fetch());
    await page.waitForTimeout(400);
    await click('[data-sub="system"]')({ frame });
    await page.waitForTimeout(800);
    await toElement(frame, '.ag-chap:has([data-sys="realarm"])', 0, 18);
  } });
  // Kapitel "Codes" (1.88.0): Hauptcode, "Quittieren verlangt den Code" und "Moduswechsel verlangt den Code" (Handbuch)
  await shot(lang, "codes", { tab: "config", height: 860, prepare: async ({ page, frame }) => {
    await click('[data-sub="system"]')({ frame });
    await page.waitForTimeout(800);
    await toElement(frame, '.ag-chap:has([data-sys="modecode"])', 0, 18);
  } });
  // Alarm auf dem Handy: rotes Band, Kachel mit Auslöser und "scharf seit … von …" (1.11.0)
  await shot(lang, "alarm", { mobile: true, prepare: async ({ page }) => {
    await page.evaluate(() => window.__setState("alarm_control_panel.haus", "triggered", { arm_mode: "away", changed_by: "Marco", armed_by: "Marco", armed_at: new Date(Date.now() - 95 * 60e3).toISOString(), triggered_by: "binary_sensor.haustuer", deadline: null }));
  } });
}
// Dashboard-Karten (1.34.0): Bedienteil und Status nebeneinander in einem Dashboard (sim/card-sim.html)
for (const lang of ["en", "de"]) {
  const ctx = await browser.newContext({ viewport: { width: 780, height: 300 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/card-sim.html?lang=${lang}&theme=light&status=warn`);
  await page.waitForFunction(() => window.__ready);
  // Seit 1.89.0 stimmig: die Statuskarte nennt "Fenster Bad" nicht erreichbar, also ist die Anlage dafür nicht bereit (Fenster: "Muss beim
  // Scharfschalten erreichbar sein", seit 1.87.0). Bis 1.88.0 zeigte das Bild "Bereit für" mit zwei Häkchen daneben
  await page.evaluate(() => {
    for (const m of ["home", "away"]) window.__setState(`binary_sensor.wohnung_ready_to_arm_${m}`, "off", { blocking_sensors: [], unreachable_sensors: ["binary_sensor.fenster_bad"] });
  });
  await page.waitForTimeout(500);
  await (await page.$("#dash")).screenshot({ path: `${out}cards-${lang}.png` });
  console.log(`cards-${lang}.png`);
  await ctx.close();
}
await browser.close();
server.close();
