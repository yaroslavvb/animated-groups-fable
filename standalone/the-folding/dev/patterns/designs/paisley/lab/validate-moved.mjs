// lab/validate-moved.mjs — as validate.mjs, for every group carried to turned, scaled and shifted places the way
// test/shapes.test.js and test/pattern.test.js carry it (only { id, e1, e2, reps, cellArea, domainArea, center } is
// handed to find()): validateShapes of src/shapes.js, the exact dark share, the time.
//   node dev/patterns/designs/paisley/lab/validate-moved.mjs
import { GROUPS } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../../src/shapes.js';
import { find } from '../design.js';
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}
const places = [[0.37, 1.7, [3.1, -2.2]], [2.11, 0.45, [-40.5, 17.25]], [-1.3, 12, [1000.3, 2000.7]]];
let bad = 0, cmin = 1, cmax = 0, gmin = Infinity, msMax = 0, runs = 0;
for (const G0 of GROUPS) {
  let line = G0.id.padEnd(6);
  for (const [th, sc, v] of places) {
    const G = moved(G0, th, sc, v), t0 = performance.now(), res = find(G), ms = performance.now() - t0;
    const print = makeShapePrint(G, { key: 'paisley', name: 'paisley', shapes: res.shapes }), val = validateShapes(print);
    const exact = print.polys.reduce((a, P) => a + P.area, 0) / (val.stabilizer * G.domainArea);
    runs++; cmin = Math.min(cmin, exact); cmax = Math.max(cmax, exact); gmin = Math.min(gmin, val.gap); msMax = Math.max(msMax, ms);
    if (!val.ok) { bad++; console.log(G0.id, 'BAD', val.problems.join(' | ')); }
    line += ` | ${val.ok ? 'ok' : 'BAD'} gap ${val.gap.toFixed(3)} dark ${exact.toFixed(3)} bare ${res.info.bare.toFixed(2)} n ${res.info.marks} ${ms.toFixed(0)}ms`;
  }
  console.log(line);
}
console.log(`runs ${runs}; bad ${bad}; dark ${cmin.toFixed(3)} .. ${cmax.toFixed(3)}; smallest gap ${gmin.toFixed(4)}; ms max ${msMax.toFixed(0)}`);
