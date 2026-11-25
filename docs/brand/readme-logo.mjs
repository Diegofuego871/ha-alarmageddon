// Logo der README (1.89.0, Wunsch des Nutzers 2026-11-25): das Schild, direkt darunter "Alarmageddon" in einer Zeile im orangen Verlauf des Schilds.
// GitHub zeigt ein SVG als Bild ohne Webschriften: die Schrift fiel dort auf eine Serifenschrift zurück ("Alarm" / "ageddon" sah falsch aus). Darum steht
// der Schriftzug hier als Pfade (Montserrat 700), das Bild hängt an keiner Schrift.
// Aufruf in einem leeren Ordner mit `npm install opentype.js @fontsource/montserrat`: `NODE_PATH=<ordner>/node_modules node docs/brand/readme-logo.mjs`
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(process.env.NODE_PATH || ".", "x.js"));
const opentype = require("opentype.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const fontFile = require.resolve("@fontsource/montserrat/files/montserrat-latin-700-normal.woff");
const buf = readFileSync(fontFile);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const TEXT = "Alarmageddon";
const SIZE = 120;
const TRACK = -2; // wie bisher im Logo (letter-spacing)
const ICON = 300; // Kantenlänge des Schilds
const GAP = 22; // Abstand Schild – Schriftzug
const PAD = 12;

// Zeichen einzeln setzen (mit Unterschneidung und Laufweite), dann die Grenzen messen
let x = 0;
const glyphs = font.stringToGlyphs(TEXT);
const paths = [];
glyphs.forEach((g, i) => {
  paths.push(g.getPath(x, 0, SIZE));
  const next = glyphs[i + 1];
  x += (g.advanceWidth * SIZE) / font.unitsPerEm + (next ? (font.getKerningValue(g, next) * SIZE) / font.unitsPerEm : 0) + (next ? TRACK : 0);
});
const box = paths.reduce((b, p) => {
  const bb = p.getBoundingBox();
  return { x1: Math.min(b.x1, bb.x1), y1: Math.min(b.y1, bb.y1), x2: Math.max(b.x2, bb.x2), y2: Math.max(b.y2, bb.y2) };
}, { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
const textW = box.x2 - box.x1;
const textH = box.y2 - box.y1;
const width = Math.ceil(Math.max(textW, ICON) + 2 * PAD);
const height = Math.ceil(PAD + ICON + GAP + textH + PAD);
const dx = (width - textW) / 2 - box.x1;
const dy = PAD + ICON + GAP - box.y1;
const d = paths.map((p) => p.toPathData(2)).join("");

// Das Schild wie in icon.svg (Ausschnitt 22 22 212 212), mittig über dem Schriftzug
const icon = readFileSync(path.join(here, "icon.svg"), "utf8");
const inner = icon.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="t" x1="${box.x1.toFixed(2)}" y1="0" x2="${box.x2.toFixed(2)}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFB45E"/><stop offset=".5" stop-color="#FF6A3D"/><stop offset="1" stop-color="#E5304A"/>
    </linearGradient>
  </defs>
  <svg x="${(width - ICON) / 2}" y="${PAD}" width="${ICON}" height="${ICON}" viewBox="22 22 212 212">${inner}</svg>
  <g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})"><path d="${d}" fill="url(#t)"/></g>
</svg>
`;
writeFileSync(path.join(here, "readme-logo.svg"), svg);
console.log(`readme-logo.svg ${width} x ${height}, Schriftzug ${Math.round(textW)} x ${Math.round(textH)}`);
