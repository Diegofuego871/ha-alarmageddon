// Aufruf im Wurzelverzeichnis: node docs/mockups/einrichtung-fertig-v1/src/shots.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..");
const url = (v, t) => `file://${join(here, "mockup.html")}?v=${v}${t === undefined ? "" : `&t=${t}`}`;
const TIMES = { a: [0, 350, 800, 1250, 1600, 2300], b: [0, 400, 900, 1500, 1950, 2600, 3000, 3500], c: [0, 450, 1000, 1500, 1900, 2300, 2900], d: [0, 500, 1000, 1500, 1900, 2300, 3000, 3600], e: [0, 400, 800, 1200, 1700, 2100, 3000, 3600] };
const browser = await chromium.launch();
for (const [v, times] of Object.entries(TIMES)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const frames = [];
  for (const t of times) {
    await page.goto(url(v, t));
    await page.waitForTimeout(150);
    frames.push({ t, img: (await page.screenshot()).toString("base64") });
  }
  await ctx.close();
  const sheet = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const sp = await sheet.newPage();
  await sp.setContent(`<body style="margin:0;background:#0d0d0d;font:16px system-ui;color:#ccc"><div style="display:flex;gap:14px;padding:16px">${frames.map((f) => `<div><img src="data:image/png;base64,${f.img}" width="195" style="border-radius:10px;display:block"><div style="text-align:center;padding-top:6px">${(f.t / 1000).toFixed(2)} s</div></div>`).join("")}</div></body>`);
  const w = 16 + frames.length * 209;
  await sp.setViewportSize({ width: w, height: 372 });
  await sp.screenshot({ path: join(out, `${v}-ablauf-handy.png`) });
  await sheet.close();
  const dctx = await browser.newContext({ viewport: { width: 1100, height: 640 }, deviceScaleFactor: 1 });
  const dp = await dctx.newPage();
  await dp.goto(url(v, times[times.length - 2]));
  await dp.waitForTimeout(150);
  await dp.screenshot({ path: join(out, `${v}-desktop.png`) });
  await dctx.close();
}
await browser.close();
