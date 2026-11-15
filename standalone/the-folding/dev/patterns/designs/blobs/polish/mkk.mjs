// polish/mkk.mjs — hand-made starts for a chamber of a kaleidoscope (a triangle tile): a big comma whose head sits by
// the incentre and whose tail runs to one corner, and a small comma with its head in each other corner (paisley's
// layout), in every arrangement. Prints a variants file ([{ id, stroke: [big, small, small], label }]).
//   node polish/mkk.mjs --id '*333' [--k 3] [--rbig 0.24] [--rsmall 0.09] > polish/seeds-s333.json
import { BY_ID } from '../../../../../src/groups.js';
import { frameOf } from '../design.js';
import { tileInFrame } from '../lab/measure.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const id = opt.id, g = BY_ID[id], F = frameOf(g), T = tileInFrame(g, F), K = +opt.k || 3;
const rb = +opt.rbig || 0.24, rs = +opt.rsmall || 0.09, r4 = (v) => Math.round(v * 1e4) / 1e4;
let ix = 0, iy = 0, ws = 0;
for (let i = 0; i < 3; i++) { const p = T[(i + 1) % 3], q = T[(i + 2) % 3], w = Math.hypot(p[0] - q[0], p[1] - q[1]); ix += w * T[i][0]; iy += w * T[i][1]; ws += w; }
ix /= ws; iy /= ws;
const corner = (i, r, m = 0.04) => {
  const v = T[i], a = T[(i + 2) % 3], b = T[(i + 1) % 3];
  const ux = a[0] - v[0], uy = a[1] - v[1], wx = b[0] - v[0], wy = b[1] - v[1], lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
  const half = Math.acos((ux * wx + uy * wy) / (lu * lw)) / 2;
  let hx = ux / lu + wx / lw, hy = uy / lu + wy / lw; const lh = Math.hypot(hx, hy); hx /= lh; hy /= lh;
  const d = (r + m) / Math.sin(half);
  return [v[0] + d * hx, v[1] + d * hy];
};
const V = [];
const curve = (a, b, bulge) => {                    // four control points from a to b, bowed sideways by `bulge`
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  return [a, [a[0] + dx / 3 + bulge * nx, a[1] + dy / 3 + bulge * ny], [a[0] + (2 * dx) / 3 + bulge * nx, a[1] + (2 * dy) / 3 + bulge * ny], b];
};
for (let t = 0; t < 3; t++) for (const toward of [1, 2]) for (const bulge of [-0.14, 0.14]) {
  const hc = (t + toward) % 3, hp = [ix + 0.18 * (T[hc][0] - ix), iy + 0.18 * (T[hc][1] - iy)];
  const big = { p: curve(hp, corner(t, 0.04, 0.05), bulge).flat().map(r4), r0: rb, rh: rb, th: 0, q: 1.3, rt: 0.04 };
  const strokes = [big];
  for (const c of [0, 1, 2]) {
    if (c === t || strokes.length >= K) continue;
    const h = corner(c, rs), toward2 = [ix - h[0], iy - h[1]], L = Math.hypot(...toward2), u = [toward2[0] / L, toward2[1] / L];
    const side = (c + t + (bulge > 0 ? 1 : 0)) % 2 ? 1 : -1, n = [-u[1] * side, u[0] * side];
    const e = [h[0] + 0.22 * u[0] + 0.1 * n[0], h[1] + 0.22 * u[1] + 0.1 * n[1]];
    strokes.push({ p: curve(h, e, 0.05 * side).flat().map(r4), r0: rs, rh: rs, th: 0, q: 1.2, rt: 0.04 });
  }
  V.push({ id, stroke: strokes, label: `tail to ${t}, head toward ${hc}, bulge ${bulge}` });
}
console.log(JSON.stringify(V, null, 1));
