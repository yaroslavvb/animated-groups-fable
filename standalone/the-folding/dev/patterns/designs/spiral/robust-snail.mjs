// designs/spiral/robust-snail.mjs — the SNAIL forced on every tile (presets and random Dirichlet tiles of all 17 groups:
// triangles, quadrilaterals, pentagons, hexagons), which the default tiles never ask of it (only the strip of *x is too
// shallow for the spiral). Per tile: does snailIn() return one loop that does not cross itself and stays inside the
// tile by the margin, with a sane dark share? (null = "no room", counted, not a failure: the caller falls back.)
//   node dev/patterns/designs/spiral/robust-snail.mjs [random tiles per group, default 6]
import { GROUPS } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';
import { snailIn, KNOBS } from './design.js';

const per = +process.argv[2] || 6;
let seed = 98765;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
const cross = (a, b, c, d) => {
  const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
function inset(poly, d) {                                         // the convex ccw polygon with every side moved in by d
  let P = poly.map((p) => [p[0], p[1]]);
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const a = poly[k], b = poly[(k + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    if (l < 1e-12) continue;
    const nx = dy / l, ny = -dx / l, c = nx * a[0] + ny * a[1] - d, Q = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c;
      if (sp <= 0) Q.push(p);
      if ((sp <= 0) !== (sq <= 0)) { const w = sp / (sp - sq); Q.push([p[0] + w * (q[0] - p[0]), p[1] + w * (q[1] - p[1])]); }
    }
    P = Q;
  }
  return P;
}
const rows = [];
let bad = 0, total = 0, none = 0, worst = 0;
for (const g of GROUPS) {
  const ts = Math.sqrt(g.domainArea);
  const tiles = g.presets.map((p) => buildDomain(g, { seed: p.seed, metric: p.metric }));
  for (let i = 0; i < per; i++) tiles.push(buildDomain(g, { seed: [g.center[0] + (rnd() - 0.5) * 2 * g.viewHalf, g.center[1] + (rnd() - 0.5) * 2 * g.viewHalf] }));
  const row = { id: g.id, tiles: tiles.length, none: 0, loops: 0, crossed: 0, outside: 0, darkMin: 1, darkMax: 0, vertsMax: 0, msMax: 0 };
  for (const d of tiles) {
    total++;
    const rim = inset(d.poly.map((p) => [p[0], p[1]]), KNOBS.margin * ts);
    const t0 = performance.now();
    let sn = null;
    try { sn = snailIn(rim, ts, KNOBS); } catch (e) { bad++; console.log('THREW', g.id, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); continue; }
    const ms = performance.now() - t0;
    row.msMax = Math.max(row.msMax, +ms.toFixed(1)); worst = Math.max(worst, ms);
    if (!sn) { row.none++; none++; continue; }
    const p = sn.pts, n = p.length;
    let A = 0, x = 0, out = 0;
    for (let k = 0; k < n; k++) { const a = p[k], b = p[(k + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; if (!d.contains(a[0], a[1], -0.9 * KNOBS.margin * ts)) out++; }
    for (let k = 0; k < n; k++) for (let j = k + 2; j < n; j++) { if (k === 0 && j === n - 1) continue; if (cross(p[k], p[(k + 1) % n], p[j], p[(j + 1) % n])) x++; }
    const dark = Math.abs(A) / 2 / g.domainArea;
    row.darkMin = Math.min(row.darkMin, +dark.toFixed(3)); row.darkMax = Math.max(row.darkMax, +dark.toFixed(3)); row.vertsMax = Math.max(row.vertsMax, n);
    if (sn.info.loops > 1) row.loops++;
    if (x) { row.crossed++; bad++; }
    if (out) { row.outside++; bad++; }
  }
  rows.push(row);
}
console.table(rows);
console.log(total, 'tiles,', none, 'without room,', bad, 'problems, slowest', worst.toFixed(1), 'ms');
