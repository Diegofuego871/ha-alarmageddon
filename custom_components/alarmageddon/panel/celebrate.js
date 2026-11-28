// Seite "Fertig" des Einrichtungsassistenten: Animation "Die Anlage ist bereit" (1.95.0, Wunsch und Entscheide des Nutzers 2026-11-28,
// Mockup docs/mockups/einrichtung-fertig-v1/ Variante F). Die sieben Striche des Fortschritts lösen sich, wirbeln zur Mitte und werden zum
// Schild, der Haken zeichnet sich, eine Welle in Schildform dehnt sich einmal aus, das Schild fliegt klein vor den Titel und bleibt dort stehen.
// Nur CSS-Animationen (@keyframes), keine Web-Animations-API: sie läuft auch in Umgebungen, die nur CSS abspielen. Läuft einmal je Aufruf der Seite,
// hält nie etwas auf (pointer-events: none, endet von selbst nach TOTAL_MS) und fehlt bei "Bewegung reduzieren" ganz (das Schild steht sofort da).

export const TOTAL_MS = 3900;
const T0 = 1750; // Beginn des Hakens
const TF = 3150; // Beginn des Flugs zum Titel
const EASE = "cubic-bezier(.16,.7,.2,1)";
const INOUT = "cubic-bezier(.65,0,.35,1)";
const SH = "M60 12l36 14v26c0 24-15 42-36 52C39 94 24 76 24 52V26z";
const CHECK = "M40 60l14 14 27-30";

// Kleines Schild mit Haken für den Titel (gleiche viewBox wie das grosse, damit der Flug passgenau landet)
export const chipSvg = (size = 36) => `<svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs><linearGradient id="agwz-gr2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color: color-mix(in srgb, var(--ag-success) 80%, #fff)"/><stop offset="1" style="stop-color: color-mix(in srgb, var(--ag-success) 72%, #000)"/></linearGradient></defs><path d="${SH}" fill="url(#agwz-gr2)" stroke="color-mix(in srgb, var(--ag-success) 55%, #fff)" stroke-width="3.5" stroke-linejoin="round"/><path d="${CHECK}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const reducedMotion = () => {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch (_e) {
    return false;
  }
};

// Startet die Animation in `root` (ShadowRoot). chip: Ziel vor dem Titel, bars: Rechtecke der sieben Striche, label: Text unter dem Schild,
// onEnd: ruft der Aufrufer, wenn das Schild gelandet ist (der Titel zeigt es dann). Gibt eine Funktion zum sofortigen Beenden zurück.
export function celebrate(root, { chip, bars, label, onLand, onEnd }) {
  const veil = document.createElement("div");
  veil.className = "ag-wzcel";
  veil.setAttribute("aria-hidden", "true");
  veil.innerHTML = `<div class="ag-wzcel-coin"><svg class="ag-wzcel-shield" width="170" height="170" viewBox="0 0 120 120" focusable="false">
      <defs><linearGradient id="agwz-gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color: color-mix(in srgb, var(--ag-success) 80%, #fff)"/><stop offset="1" style="stop-color: color-mix(in srgb, var(--ag-success) 72%, #000)"/></linearGradient>
        <linearGradient id="agwz-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="agwz-clip"><path d="${SH}"/></clipPath></defs>
      <path class="ag-wzcel-wave" data-k="wave" d="${SH}"/>
      <path d="${SH}" fill="url(#agwz-gr)"/>
      <path d="${SH}" fill="none" style="stroke: color-mix(in srgb, var(--ag-success) 55%, #fff)" stroke-width="3.5" stroke-linejoin="round"/>
      <g clip-path="url(#agwz-clip)"><rect data-k="sheen" x="-60" y="0" width="50" height="120" fill="url(#agwz-sheen)"/></g>
      <path class="ag-wzcel-check" data-k="check" d="${CHECK}"/></svg></div><div class="ag-wzcel-tag" data-k="tag"></div>`;
  veil.querySelector('[data-k="tag"]').textContent = label || "";
  root.appendChild(veil);
  const $ = (k) => veil.querySelector(`[data-k="${k}"]`);
  const coin = veil.querySelector(".ag-wzcel-coin"), shield = veil.querySelector(".ag-wzcel-shield");
  const timers = [];
  let ended = false;
  const finish = (landed = true) => {
    if (ended) return;
    ended = true;
    timers.forEach(clearTimeout);
    veil.remove();
    if (landed) onLand?.();
    onEnd?.();
  };
  let css = "", n = 0;
  const tl = (el, stops) => { // stops: [ms, "css", easing zum nächsten Halt]
    const name = `agwz${n++}`;
    css += `@keyframes ${name} {` + stops.map(([t, p, e]) => `${(t / TOTAL_MS * 100).toFixed(3)}% { ${p}${e ? `; animation-timing-function: ${e}` : ""} }`).join(" ") + "}\n";
    el.style.animation = `${name} ${TOTAL_MS}ms linear both`;
  };
  const c = coin.getBoundingClientRect(), k = chip.getBoundingClientRect();
  const dx = k.left + k.width / 2 - (c.left + c.width / 2), dy = k.top + k.height / 2 - (c.top + c.height / 2), sc = (k.width / c.width).toFixed(3);
  const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  const OP = (o, tr) => `opacity:${o}; transform:${tr}`;
  const rest = "translate(0px,0px) scale(1)", gone = `translate(${dx}px,${dy}px) scale(${sc})`;
  const rot = (d, s) => `transform: perspective(700px) rotateY(${d}deg) scale(${s})`;
  tl(veil, [[0, "opacity:0", "ease-out"], [320, "opacity:1"], [TF + 80, "opacity:1", "ease-in"], [TF + 640, "opacity:0"], [TOTAL_MS, "opacity:0"]]);
  tl(coin, [[0, OP(0, "translate(0px,0px) scale(.3)")], [1150, OP(0, "translate(0px,0px) scale(.3)"), EASE], [1480, OP(1, "translate(0px,0px) scale(1.15)"), "ease-out"], [1700, OP(1, rest)],
    [TF, OP(1, rest), INOUT], [TF + 585, OP(1, gone)], [TF + 650, OP(0, gone)], [TOTAL_MS, OP(0, gone)]]);
  tl(shield, [[0, rot(-360, 1)], [1150, rot(-360, 1), EASE], [2050, rot(0, 1)], [TOTAL_MS, rot(0, 1)]]);
  // die sieben Striche: Dicke bleibt, nur die Länge schrumpft
  (bars || []).forEach((r, i) => {
    const bar = document.createElement("div");
    bar.className = "ag-wzcel-bar";
    Object.assign(bar.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    veil.appendChild(bar);
    const bx = cx - (r.left + r.width / 2), by = cy - (r.top + r.height / 2), s = 250 + i * 70, d = i % 2 ? 1 : -1;
    const f = (x, y, rr, sx, o) => `opacity:${o}; transform: translate(${x}px,${y}px) rotate(${rr}deg) scale(${sx},1)`;
    tl(bar, [[0, f(0, 0, 0, 1, 0)], [s, f(0, 0, 0, 1, 1), INOUT], [s + 520, f(bx * .55, by * .55 - 30, 200 * d, .8, 1), INOUT], [s + 950, f(bx, by, 420 * d, .3, 0)], [TOTAL_MS, f(bx, by, 420 * d, .3, 0)]]);
  });
  tl($("check"), [[0, "opacity:0; stroke-dashoffset:60; stroke-width:0"], [T0, "opacity:0; stroke-dashoffset:60; stroke-width:0"], [T0 + 40, "opacity:1; stroke-dashoffset:55; stroke-width:8", "cubic-bezier(.4,0,.2,1)"], [T0 + 480, "opacity:1; stroke-dashoffset:0; stroke-width:8"], [TOTAL_MS, "opacity:1; stroke-dashoffset:0; stroke-width:8"]]);
  tl($("wave"), [[0, "opacity:0; transform:scale(1)"], [T0 + 350, "opacity:.75; transform:scale(1)", "cubic-bezier(.2,.6,.3,1)"], [T0 + 1250, "opacity:0; transform:scale(2.1)"], [TOTAL_MS, "opacity:0; transform:scale(2.1)"]]);
  tl($("sheen"), [[0, "transform:translateX(0px) skewX(-18deg)"], [T0 + 420, "transform:translateX(0px) skewX(-18deg)", "ease-in-out"], [T0 + 1120, "transform:translateX(260px) skewX(-18deg)"], [TOTAL_MS, "transform:translateX(260px) skewX(-18deg)"]]);
  tl($("tag"), [[0, "opacity:0; transform:translate(-50%,6px)"], [T0 + 200, "opacity:0; transform:translate(-50%,6px)", "ease-out"], [T0 + 650, "opacity:1; transform:translate(-50%,0px)"], [TF - 100, "opacity:1; transform:translate(-50%,0px)"], [TF + 250, "opacity:0; transform:translate(-50%,0px)"], [TOTAL_MS, "opacity:0; transform:translate(-50%,0px)"]]);
  const st = document.createElement("style");
  st.textContent = css;
  veil.appendChild(st);
  // Das Schild im Titel erscheint, wenn das grosse gelandet ist (beide haben dieselbe Form und Lage)
  timers.push(setTimeout(() => onLand?.(), TF + 600));
  timers.push(setTimeout(() => finish(true), TOTAL_MS + 100));
  return () => finish(true);
}
