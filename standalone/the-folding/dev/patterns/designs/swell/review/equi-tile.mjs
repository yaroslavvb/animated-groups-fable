// review/equi-tile.mjs <id> — the seat tile of a group and of its moved copy, in lattice coordinates about the centre
import { BY_ID, latticeCoords } from '../../../../../src/groups.js';
import * as D from '../design.js';
const id = process.argv[2] || 'xx';
const T = { s: 1.37, c: Math.cos(0.83), n: Math.sin(0.83), tx: 3.21, ty: -1.77 };
const conj = (r) => {
  const { s, c, n, tx, ty } = T, a = r.a, b = r.b, cc = r.c, d = r.d;
  const A = [[c * a - n * cc, c * b - n * d], [n * a + c * cc, n * b + c * d]];
  const L = [[A[0][0] * c - A[0][1] * n, A[0][0] * n + A[0][1] * c], [A[1][0] * c - A[1][1] * n, A[1][0] * n + A[1][1] * c]];
  const px = s * (c * r.tx - n * r.ty) + tx, py = s * (n * r.tx + c * r.ty) + ty;
  return { a: L[0][0], b: L[0][1], c: L[1][0], d: L[1][1], tx: px - (L[0][0] * tx + L[0][1] * ty), ty: py - (L[1][0] * tx + L[1][1] * ty) };
};
const ap = (p) => [T.s * (T.c * p[0] - T.n * p[1]) + T.tx, T.s * (T.n * p[0] + T.c * p[1]) + T.ty];
const lin = (p) => [T.s * (T.c * p[0] - T.n * p[1]), T.s * (T.n * p[0] + T.c * p[1])];
const g = BY_ID[id];
const e1 = lin(g.e1), e2 = lin(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
const M = { id: g.id, e1, e2, reps: g.reps.map(conj), cellArea, domainArea: cellArea / g.reps.length, center: ap(g.center) };
for (const [label, grp] of [['orig', g], ['moved', M]]) {
  const st = [0, 0];
  const pts = D.seatTile(grp).map((p) => { latticeCoords(grp, p[0] - grp.center[0], p[1] - grp.center[1], st); return st.map((v) => v.toFixed(4)).join(','); });
  console.log(label.padEnd(6), pts.join('  '));
}
