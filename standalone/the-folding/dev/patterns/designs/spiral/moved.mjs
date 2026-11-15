// designs/spiral/moved.mjs — the design on groups carried to a turned, scaled and shifted place and stripped to
// { id, e1, e2, reps, cellArea, domainArea, center } (no presets): does find() still work, is its motif the carried
// motif of the group at home, do its copies keep their distance, does it lie in one fundamental domain?
//   node dev/patterns/designs/spiral/moved.mjs [design.js]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GROUPS, elementsNear } from '../../../../src/groups.js';
import { normalize, measure } from '../../kit.js';

const file = process.argv[2] || 'design.js';
const mod = await import(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), file)).href);

function carry(g, th, sc, d) {
  const c = Math.cos(th), s = Math.sin(th);
  const lin = (v) => [sc * (c * v[0] - s * v[1]), sc * (s * v[0] + c * v[1])];
  const pt = (v) => { const w = lin(v); return [w[0] + d[0], w[1] + d[1]]; };
  const reps = g.reps.map((r) => {
    // L' = R L R^T
    const a = c * (r.a * c - r.b * s) - s * (r.c * c - r.d * s), b = c * (r.a * s + r.b * c) - s * (r.c * s + r.d * c);
    const cc = s * (r.a * c - r.b * s) + c * (r.c * c - r.d * s), dd = s * (r.a * s + r.b * c) + c * (r.c * s + r.d * c);
    const t = lin([r.tx, r.ty]);
    return { a, b, c: cc, d: dd, tx: t[0] + d[0] - (a * d[0] + b * d[1]), ty: t[1] + d[1] - (cc * d[0] + dd * d[1]) };
  });
  return { g2: { id: g.id, e1: lin(g.e1), e2: lin(g.e2), reps, cellArea: g.cellArea * sc * sc, domainArea: g.domainArea * sc * sc, center: pt(g.center) }, pt };
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function gapOf(g, shapes) {
  const N = normalize(shapes), ts = Math.sqrt(g.domainArea);
  const els = elementsNear(g, N.cx, N.cy, 2 * N.R + 0.1 * ts, N.cx, N.cy);
  const P0 = N.polys[0].pts, n0 = P0.length / 2, stride = Math.max(1, Math.floor(n0 / 300));
  let gap = Infinity, self = 0;
  for (const e of els) {
    const q = new Float64Array(P0.length);
    let move = 0;
    for (let i = 0; i < n0; i++) { q[2 * i] = e.a * P0[2 * i] + e.b * P0[2 * i + 1] + e.tx; q[2 * i + 1] = e.c * P0[2 * i] + e.d * P0[2 * i + 1] + e.ty; move = Math.max(move, Math.hypot(q[2 * i] - P0[2 * i], q[2 * i + 1] - P0[2 * i + 1])); }
    if (move < 1e-7 * ts) { self++; continue; }
    for (let i = 0; i < n0; i += stride) for (let j = 0; j < n0; j++) { const k = (j + 1) % n0; const dd = segDist(P0[2 * i], P0[2 * i + 1], q[2 * j], q[2 * j + 1], q[2 * k], q[2 * k + 1]); if (dd < gap) gap = dd; }
  }
  return { gap: gap / ts, self, area: N.polys[0].area / g.domainArea, verts: N.verts };
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const rows = [];
for (const g of GROUPS) {
  const home = mod.find(g);
  const { g2, pt } = carry(g, 0.7137, 1.618, [3.31, -2.47]);
  let row = { id: g.id };
  try {
    const t0 = performance.now();
    const moved = mod.find(g2);
    row.ms = r3(performance.now() - t0);
    const A = home.shapes[0].pts.map(pt), B = moved.shapes[0].pts, ts2 = Math.sqrt(g2.domainArea);
    let dev = 0;
    if (A.length === B.length) for (let i = 0; i < A.length; i++) dev = Math.max(dev, Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]) / ts2); else dev = NaN;
    const go = gapOf(g2, moved.shapes);
    Object.assign(row, { same: Number.isNaN(dev) ? 'other (' + A.length + ' / ' + B.length + ')' : dev < 1e-6 ? 'yes' : 'off ' + dev.toExponential(1), gap: r3(go.gap), dark: r3(go.area), verts: go.verts, hand: moved.info.hand, side: moved.info.side });
    // a coarse look at the kit's own numbers on the carried group (few samples: this is only a check that nothing overlaps)
    const M = measure(g2, normalize(moved.shapes), { per: 14 });
    row.overlap = M.overlap; row.cover = M.coverage;
  } catch (e) { row.error = String(e && e.message || e); }
  rows.push(row);
}
console.table(rows);
