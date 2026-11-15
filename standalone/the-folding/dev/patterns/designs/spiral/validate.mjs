// designs/spiral/validate.mjs — the finished design through the PRODUCTION validator (src/shapes.js validateShapes):
// all 17 groups as the page has them, and every group carried to two turned, scaled and shifted places and stripped to
// { id, e1, e2, reps, cellArea, domainArea, center } (no presets). For a carried group it also measures how far the
// motif lies from the home motif carried along (the largest distance from a vertex of either outline to the other
// outline, in tile sizes): 0 for the spiral, the trace's own noise for the snail of *x.
//   node dev/patterns/designs/spiral/validate.mjs
import { GROUPS } from '../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../src/shapes.js';
import { find } from './design.js';

function carry(g, th, sc, d) {
  const c = Math.cos(th), s = Math.sin(th);
  const lin = (v) => [sc * (c * v[0] - s * v[1]), sc * (s * v[0] + c * v[1])];
  const pt = (v) => { const w = lin(v); return [w[0] + d[0], w[1] + d[1]]; };
  const reps = g.reps.map((r) => {
    const a = c * (r.a * c - r.b * s) - s * (r.c * c - r.d * s), b = c * (r.a * s + r.b * c) - s * (r.c * s + r.d * c);
    const cc = s * (r.a * c - r.b * s) + c * (r.c * c - r.d * s), dd = s * (r.a * s + r.b * c) + c * (r.c * s + r.d * c);
    const t = lin([r.tx, r.ty]);
    return { a, b, c: cc, d: dd, tx: t[0] + d[0] - (a * d[0] + b * d[1]), ty: t[1] + d[1] - (cc * d[0] + dd * d[1]) };
  });
  return { g2: { id: g.id, e1: lin(g.e1), e2: lin(g.e2), reps, cellArea: g.cellArea * sc * sc, domainArea: g.domainArea * sc * sc, center: pt(g.center) }, pt };
}
const segD = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const toOutline = (P, Q) => { let worst = 0; for (const p of P) { let b = Infinity; for (let i = 0; i < Q.length; i++) b = Math.min(b, segD(p, Q[i], Q[(i + 1) % Q.length])); worst = Math.max(worst, b); } return worst; };
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rows = [];
let bad = 0;
for (const g of GROUPS) {
  const home = find(g), pr = makeShapePrint(g, { key: 'spiral', shapes: home.shapes }), v = validateShapes(pr);
  const row = { id: g.id, ok: v.ok, gap: r4(v.gap), stab: v.stabilizer, verts: pr.verts, problems: v.problems.length ? v.problems.join('; ').slice(0, 80) : '' };
  if (!v.ok) bad++;
  for (const [k, [th, sc, d]] of [[0.7137, 1.618, [3.31, -2.47]], [-2.2, 0.37, [-0.5, 11.2]]].entries()) {
    const { g2, pt } = carry(g, th, sc, d);
    const m = find(g2), p2 = makeShapePrint(g2, { key: 'spiral', shapes: m.shapes }), v2 = validateShapes(p2), ts2 = Math.sqrt(g2.domainArea);
    const A = home.shapes[0].pts.map(pt), B = m.shapes[0].pts;
    row['ok' + (k + 1)] = v2.ok;
    row['off' + (k + 1)] = r4(Math.max(toOutline(A, B), toOutline(B, A)) / ts2);
    if (!v2.ok) { bad++; row.problems += ' | moved: ' + v2.problems.join('; ').slice(0, 60); }
  }
  rows.push(row);
}
console.table(rows);
console.log(bad ? bad + ' FAILED' : 'all valid');
