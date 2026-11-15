// scratch: the texture that src/sdf.js bakes from polygons against the texture the GPU proof was run on (the analytic
// field of dev/patterns/tex-demo.html, texel by texel), and the two JS readers against each other. No GPU, a second or so.
//   node dev/patterns/scratch-renderer/bake-check.mjs
import { bakeSDF, sdfSample, sdfDistance } from '../../../src/sdf.js';
import { sdfRead } from '../../../src/render3d.js';

const SC = 0.8, e1 = [1.0 * SC, 0], e2 = [0.35 * SC, 0.8 * SC], origin = [0.104, -0.056];
const det = e1[0] * e2[1] - e1[1] * e2[0], INV = [e2[1] / det, -e2[0] / det, -e1[1] / det, e1[0] / det];
const at = (s, t) => [s * e1[0] + t * e2[0], s * e1[1] + t * e2[1]];
const TH = 20 * Math.PI / 180, C = Math.cos(TH), S = Math.sin(TH);
const SHAPES = [
  { kind: 0, c: at(0.40, 0.33), r: 0.16 * SC }, { kind: 1, c: at(0.95, 0.60), rm: 0.135 * SC, hw: 0.045 * SC },
  { kind: 2, c: at(0.52, 0.03), hl: 0.17 * SC, hw: 0.02 * SC }, { kind: 0, c: at(0.04, 0.96), r: 0.07 * SC },
];
function sdAt(x, y) {
  const dx = x - origin[0], dy = y - origin[1];
  let s = INV[0] * dx + INV[1] * dy, t = INV[2] * dx + INV[3] * dy;
  s -= Math.floor(s); t -= Math.floor(t);
  const qx = s * e1[0] + t * e2[0], qy = s * e1[1] + t * e2[1];
  let best = Infinity;
  for (const Sh of SHAPES) for (let m = -1; m <= 1; m++) for (let n = -1; n <= 1; n++) {
    const ux = qx - Sh.c[0] - m * e1[0] - n * e2[0], uy = qy - Sh.c[1] - m * e1[1] - n * e2[1];
    let d;
    if (Sh.kind === 0) d = Math.hypot(ux, uy) - Sh.r;
    else if (Sh.kind === 1) d = Math.abs(Math.hypot(ux, uy) - Sh.rm) - Sh.hw;
    else { const ax = Math.abs(ux * C + uy * S) - Sh.hl, ay = Math.abs(-ux * S + uy * C) - Sh.hw; d = ax > 0 || ay > 0 ? Math.hypot(Math.max(ax, 0), Math.max(ay, 0)) : Math.max(ax, ay); }
    if (d < best) best = d;
  }
  return best;
}
// the same shapes as polygons, every copy near the cell
const NG = 4096, circle = (cx, cy, r, back) => { const p = []; for (let k = 0; k < NG; k++) { const a = (back ? -1 : 1) * 2 * Math.PI * k / NG; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
const polys = [];
for (const Sh of SHAPES) for (let m = -2; m <= 2; m++) for (let n = -2; n <= 2; n++) {
  const cx = origin[0] + Sh.c[0] + m * e1[0] + n * e2[0], cy = origin[1] + Sh.c[1] + m * e1[1] + n * e2[1];
  if (Sh.kind === 0) polys.push({ pts: circle(cx, cy, Sh.r), hole: false });
  else if (Sh.kind === 1) { polys.push({ pts: circle(cx, cy, Sh.rm + Sh.hw), hole: false }); polys.push({ pts: circle(cx, cy, Sh.rm - Sh.hw, true), hole: true }); }
  else polys.push({ pts: [[-Sh.hl, -Sh.hw], [Sh.hl, -Sh.hw], [Sh.hl, Sh.hw], [-Sh.hl, Sh.hw]].map(([u, v]) => [cx + u * C - v * S, cy + u * S + v * C]), hole: false });
}
let bad = false;
for (const size of [64, 256, 200]) for (const k of [2, 4, 8]) {
  const range = k * Math.hypot(...e1) / size;
  const t0 = performance.now();
  const baked = bakeSDF({ origin, e1, e2, size, range, polys });
  const ms = performance.now() - t0;
  let worst = 0, over1 = 0, signs = 0;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const s = (i + 0.5) / size, t = (j + 0.5) / size, sd = sdAt(origin[0] + s * e1[0] + t * e2[0], origin[1] + s * e1[1] + t * e2[1]);
    const want = Math.round(128 + 127 * Math.max(-1, Math.min(1, sd / range))), got = baked[j * size + i];
    const d = Math.abs(want - got);
    if (d > worst) worst = d; if (d > 1) over1++;
    if ((got < 128) !== (want < 128) && Math.abs(sd) > range / 254) signs++;
  }
  // the two readers
  const tex = { size, data: baked, range };
  let rd = 0;
  for (let q = 0; q < 5000; q++) { const s = 6 * Math.random() - 3, t = 6 * Math.random() - 3; rd = Math.max(rd, Math.abs(sdfRead(tex, s, t) - sdfDistance(sdfSample(baked, size, s, t), range))); }
  const ok = worst <= 1 && signs === 0 && rd < 1e-12;
  if (!ok) bad = true;
  console.log(`size ${String(size).padEnd(4)} range ${k} texels: baked in ${ms.toFixed(1)} ms; against the analytic texture: largest difference ${worst} level(s), ${over1} texels over 1, ${signs} of the wrong tone; sdfRead against sdf.js's reader: ${rd.toExponential(1)}  ${ok ? 'ok' : 'DIFFERENT'}`);
}
process.exit(bad ? 1 : 0);
