// lab/validate-tone.mjs — does a moved group get the moved PRINT (the same pattern, carried along) even where its motif is
// another copy of the same orbit? Compares the tone at 4000 points of the plane.
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, toneAt } from '../../../kit.js';
import { find } from '../design.js';
const T = { s: 1.37, c: Math.cos(0.83), n: Math.sin(0.83), tx: 3.21, ty: -1.77 };
const conj = (r) => { const { s, c, n, tx, ty } = T, a = r.a, b = r.b, cc = r.c, d = r.d; const A = [[c * a - n * cc, c * b - n * d], [n * a + c * cc, n * b + c * d]]; const L = [[A[0][0] * c - A[0][1] * n, A[0][0] * n + A[0][1] * c], [A[1][0] * c - A[1][1] * n, A[1][0] * n + A[1][1] * c]]; const px = s * (c * r.tx - n * r.ty) + tx, py = s * (n * r.tx + c * r.ty) + ty; return { a: L[0][0], b: L[0][1], c: L[1][0], d: L[1][1], tx: px - (L[0][0] * tx + L[0][1] * ty), ty: py - (L[1][0] * tx + L[1][1] * ty) }; };
const ap = (p) => [T.s * (T.c * p[0] - T.n * p[1]) + T.tx, T.s * (T.n * p[0] + T.c * p[1]) + T.ty];
const lin = (p) => [T.s * (T.c * p[0] - T.n * p[1]), T.s * (T.n * p[0] + T.c * p[1])];
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (const id of (process.argv[2] || 'xx,333,22*,442,632').split(',')) {
  const g = BY_ID[id], e1 = lin(g.e1), e2 = lin(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  const M = { id: g.id, e1, e2, reps: g.reps.map(conj), cellArea, domainArea: cellArea / g.reps.length, center: ap(g.center) };
  const N1 = normalize(find(g).shapes), N2 = normalize(find(M).shapes), u = Math.sqrt(g.domainArea);
  let diff = 0, n = 0;
  for (let k = 0; k < 4000; k++) {
    const p = [g.center[0] + (rnd() - 0.5) * 6 * u, g.center[1] + (rnd() - 0.5) * 6 * u], q = ap(p);
    if (toneAt(g, N1, p[0], p[1]) !== toneAt(M, N2, q[0], q[1])) diff++;
    n++;
  }
  console.log(id.padEnd(6), 'points whose tone differs', diff, 'of', n, diff / n < 0.01 ? 'the same print' : 'ANOTHER PRINT');
}
