// lab/validate.mjs — the production check (src/shapes.js validateShapes) of the design on the 17 groups and on turned,
// scaled, shifted copies of some of them that carry only { id, e1, e2, reps, cellArea, domainArea, center } (no presets),
// plus whether the moved group's motif is the moved motif (the seat is a rule, so it should be, to rounding).
//   node lab/validate.mjs [ids] [--moved ids]
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../../src/shapes.js';
import { find, meta } from '../design.js';

const args = process.argv.slice(2);
const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',') : GROUPS.map((g) => g.id);
const mi = args.indexOf('--moved');
const movedIds = mi >= 0 ? args[mi + 1].split(',') : ['o', '2222', 'xx', '*x', '333', '22*', '442', '632', '*442', '*632'];
const T = { s: 1.37, c: Math.cos(0.83), n: Math.sin(0.83), tx: 3.21, ty: -1.77 };
const conj = (r) => {                                          // T r T^-1 for the similarity T(x) = s R x + t
  const { s, c, n, tx, ty } = T, a = r.a, b = r.b, cc = r.c, d = r.d;
  const A = [[c * a - n * cc, c * b - n * d], [n * a + c * cc, n * b + c * d]];
  const L = [[A[0][0] * c - A[0][1] * n, A[0][0] * n + A[0][1] * c], [A[1][0] * c - A[1][1] * n, A[1][0] * n + A[1][1] * c]];
  const px = s * (c * r.tx - n * r.ty) + tx, py = s * (n * r.tx + c * r.ty) + ty;
  return { a: L[0][0], b: L[0][1], c: L[1][0], d: L[1][1], tx: px - (L[0][0] * tx + L[0][1] * ty), ty: py - (L[1][0] * tx + L[1][1] * ty) };
};
const ap = (p) => [T.s * (T.c * p[0] - T.n * p[1]) + T.tx, T.s * (T.n * p[0] + T.c * p[1]) + T.ty];
const lin = (p) => [T.s * (T.c * p[0] - T.n * p[1]), T.s * (T.n * p[0] + T.c * p[1])];
const movedGroup = (g) => {
  const e1 = lin(g.e1), e2 = lin(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps: g.reps.map(conj), cellArea, domainArea: cellArea / g.reps.length, center: ap(g.center) };
};
let bad = 0;
const check = (label, group, res) => {
  const print = makeShapePrint(group, { key: meta.key, name: meta.key, shapes: res.shapes, info: res.info });
  const v = validateShapes(print, {});
  const verts = res.shapes.reduce((s, p) => s + p.pts.length, 0);
  if (!v.ok) bad++;
  console.log(label.padEnd(14), v.ok ? 'ok ' : 'BAD', 'gap', (v.gap / Math.sqrt(group.domainArea)).toFixed(4), 'stab', v.stabilizer, 'verts', verts, 'loops', res.shapes.length, v.ok ? '' : v.problems.slice(0, 3).join(' | '));
};
for (const id of ids) {
  const g = BY_ID[id];
  check(id, g, find(g));
}
for (const id of movedIds) {
  const g = BY_ID[id], M = movedGroup(g), size = Math.sqrt(g.domainArea);
  const r1 = find(g), r2 = find(M);
  check(id + ' moved', M, r2);
  // the moved motif against the moved original: the largest distance from a point of one to the outline of the other
  let dev = 0;
  const segs = [];
  for (const s of r2.shapes) for (let i = 0; i < s.pts.length; i++) segs.push([s.pts[i], s.pts[(i + 1) % s.pts.length]]);
  for (const s of r1.shapes) for (const p of s.pts) {
    const q = ap(p);
    let d = Infinity;
    for (const [a, b] of segs) {
      const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
      let t = l2 > 0 ? ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      d = Math.min(d, Math.hypot(a[0] + t * ex - q[0], a[1] + t * ey - q[1]));
    }
    dev = Math.max(dev, d);
  }
  const rel = dev / (T.s * size);
  if (!(rel < 0.01)) bad++;
  console.log((id + ' moved').padEnd(14), 'motif = moved motif to', rel.toExponential(2), 'tile sizes', rel < 0.01 ? 'ok' : 'DIFFERS');
}
console.log(bad ? 'FAIL ' + bad : 'ALL OK');
