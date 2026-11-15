// node dev/check.mjs [ids] [--moved]  — find() of the design per group, checked by the production validator
// (src/shapes.js validateShapes): problems, smallest gap, vertices, ms, dark share (net motif area / tile area).
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../../src/shapes.js';
import { find } from '../design.js';

const args = process.argv.slice(2);
const ids = args[0] && !args[0].startsWith('--') && args[0] !== 'all' ? args[0].split(',') : GROUPS.map((g) => g.id);
const movedToo = args.includes('--moved');

function moved(g, th, sc, v) {           // as test/pattern.test.js: x -> s R(th) x + v
  const c = Math.cos(th), s = Math.sin(th), A = [sc * c, -sc * s, sc * s, sc * c];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const reps = g.reps.map((r) => {
    // A r A^-1 conjugated with the shift v: x -> A (r (A^-1 (x - v))) + v
    const ai = [c / sc, s / sc, -s / sc, c / sc];
    const L = [r.a, r.b, r.c, r.d];
    const m = (P, Q) => [P[0] * Q[0] + P[1] * Q[2], P[0] * Q[1] + P[1] * Q[3], P[2] * Q[0] + P[3] * Q[2], P[2] * Q[1] + P[3] * Q[3]];
    const M = m(A, m(L, ai));
    const t = mul(A, [r.tx, r.ty]);
    const Mv = mul(M, v);
    return { a: M[0], b: M[1], c: M[2], d: M[3], tx: t[0] + v[0] - Mv[0], ty: t[1] + v[1] - Mv[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}

function netArea(shapes) {
  let A = 0;
  for (const sh of shapes) { let s = 0; const P = sh.pts; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - p[1] * q[0]; } A += (sh.hole ? -1 : 1) * Math.abs(s / 2); }
  return A;
}

for (const id of ids) {
  const cases = [['page', BY_ID[id]]];
  if (movedToo) cases.push(['moved', moved(BY_ID[id], 1.234, 1.7, [0.4, -0.9])], ['moved2', moved(BY_ID[id], -0.31, 0.6, [-2.1, 3.3])]);
  for (const [label, g] of cases) {
    try {
      const t0 = performance.now(), res = find(g), ms = performance.now() - t0;
      const P = makeShapePrint(g, { key: 'tomoe', shapes: res.shapes });
      const V = validateShapes(P);
      const verts = res.shapes.reduce((n, sh) => n + sh.pts.length, 0);
      console.log(`${id.padEnd(6)} ${label.padEnd(6)} ${V.ok ? "ok " : "BAD"} stab ${V.stabilizer} gap ${V.gap.toFixed(3)} share ${(netArea(res.shapes) / g.domainArea).toFixed(3)} verts ${verts} ${ms.toFixed(1)}ms ${V.problems.slice(0, 3).join(' | ')}`);
    } catch (e) { console.log(`${id.padEnd(6)} ${label.padEnd(6)} THROWS ${e.stack.split('\n').slice(0, 3).join(' ')}`); }
  }
}
