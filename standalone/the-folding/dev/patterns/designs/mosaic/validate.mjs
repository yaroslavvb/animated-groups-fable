// validate.mjs — the finished design against the production checks (dev): src/shapes.js validateShapes and
// measureShapes on all 17 groups, then on turned, scaled and shifted copies handed over WITHOUT presets (as the tests of
// test/pattern.test.js carry a group: reps conjugated, lattice and centre moved; only id, e1, e2, reps, cellArea,
// domainArea, center), where the motif must be the moved motif, vertex for vertex, and the print exactly the group's.
//   node validate.mjs [ids]
import { find } from './design.js';
import { GROUPS, BY_ID } from '../../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../../src/shapes.js';
import { exactlyInvariant } from '../../../../src/pattern.js';

/** The group carried to another place: x -> s R(th) x + v (the helper of test/pattern.test.js). */
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]], map: (p) => { const q = mul(A, p); return [q[0] + v[0], q[1] + v[1]]; } };
}

const ids = process.argv[2] ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
let bad = 0;
const r3 = (x) => (Math.round(x * 1000) / 1000).toFixed(3);
console.log('id      ok   gap    stab  verts  dark   bare   solid  ms');
for (const id of ids) {
  const g = BY_ID[id], t0 = performance.now(), r = find(g), ms = performance.now() - t0;
  const P = makeShapePrint(g, { key: 'mosaic', name: 'Mosaic', shapes: r.shapes, info: r.info });
  const v = validateShapes(P), m = measureShapes(P);
  if (!v.ok) bad++;
  console.log(id.padEnd(7), String(v.ok).padEnd(4), r3(v.gap), String(v.stabilizer).padEnd(5), String(m.verts).padEnd(6), r3(m.coverage), r3(m.emptyDisc), r3(m.darkDisc), ms.toFixed(1), v.problems.length ? 'PROBLEMS ' + v.problems.join(' | ') : '');
}
// turned, scaled, shifted; no presets
const moves = [[0.7, 1.9, [3.1, -2.4]], [-2.2, 0.37, [-0.6, 5.3]], [4.0, 3.3, [17.5, 9.25]]];
console.log('\nmoved copies (no presets): validator, exact invariance, and the motif = the moved motif');
for (const id of ids) {
  const g = BY_ID[id], base = find(g).shapes;
  for (const [th, sc, vv] of moves) {
    const h = moved(g, th, sc, vv), r = find(h), P = makeShapePrint(h, { key: 'mosaic', name: 'Mosaic', shapes: r.shapes });
    const v = validateShapes(P), inv = exactlyInvariant(h, P);
    // vertex for vertex: the motif of the moved group against the moved motif
    let dev = 0, same = base.length === r.shapes.length;
    if (same) base.forEach((s, i) => { if (s.pts.length !== r.shapes[i].pts.length) same = false; else s.pts.forEach((p, k) => { const q = h.map(p), w = r.shapes[i].pts[k]; dev = Math.max(dev, Math.hypot(q[0] - w[0], q[1] - w[1]) / (sc * Math.sqrt(g.domainArea))); }); });
    const ok = v.ok && inv && same && dev < 1e-6;
    if (!ok) bad++;
    console.log(id.padEnd(7), `turned ${th}, scaled ${sc}, shifted ${vv}:`, ok ? 'ok' : 'FAIL', 'valid', v.ok, 'exact', inv, 'same', same, 'dev', dev.toExponential(1), v.problems.length ? v.problems.join(' | ') : '');
  }
}
console.log(bad ? `\n${bad} FAILED` : '\nall passed');
process.exit(bad ? 1 : 0);
