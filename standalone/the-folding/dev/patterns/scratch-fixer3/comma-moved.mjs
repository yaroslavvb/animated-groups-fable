// dev/patterns/scratch-fixer3/comma-moved.mjs — the fixer (15 Nov 2026): the Comma of turned, scaled, shifted and mirrored
// copies of every group (no presets): printable? exactly the moved group's? its share of the tile against the page's.
//   node dev/patterns/scratch-fixer3/comma-moved.mjs
import { GROUPS } from '../../../src/groups.js';
import { find } from '../../../src/patterns/comma.js';
import { makeShapePrint, printable } from '../../../src/shapes.js';
import { exactlyInvariant, printFor } from '../../../src/pattern.js';

function carried(g, A, v) {
  const dA = A[0] * A[3] - A[1] * A[2], Ai = [A[3] / dA, -A[1] / dA, -A[2] / dA, A[0] / dA];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => { const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]); return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] }; });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}
let bad = 0;
for (const g of GROUPS) {
  const P0 = printFor(g, 'comma'), rows = [];
  for (const [mirror, th, sc] of [[false, 0.7, 1.6], [true, 2.1, 0.6]]) {
    const co = sc * Math.cos(th), si = sc * Math.sin(th), A = mirror ? [co, si, si, -co] : [co, -si, si, co];
    const h = carried(g, A, [0.37, -1.2]), r = find(h), P = makeShapePrint(h, { key: 'comma', shapes: r.shapes }), pr = printable(P), ex = exactlyInvariant(h, P, 20, 3);
    const share = P.netArea / h.domainArea, share0 = P0.netArea / g.domainArea;
    if (!pr.ok || !ex || Math.abs(share - share0) > 1e-9) bad++;
    rows.push(`${mirror ? 'mirrored' : 'turned  '} printable ${pr.ok} exact ${ex} share ${share.toFixed(4)} (page ${share0.toFixed(4)}) from ${r.info.from}`);
  }
  console.log(g.id.padEnd(6), rows.join(' | '));
}
console.log(bad ? `${bad} BAD` : 'all carried, printable, exact, the same share');
