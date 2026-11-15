// scratch (review-correct): the Comma print for a turned, scaled and shifted copy of each group (test/patterns-shipped's
// `moved`, no presets) — the one shape pattern the tests do not move. With the group's id kept (motif.js's table is per
// id: the copy is "stale" there) and with no id. Printable? the moved group's exactly? the comma's size against the
// unmoved group's?   node dev/patterns/scratch-review-correct/comma-moved.mjs
import { GROUPS } from '../../../src/groups.js';
import { makeShapePrint, printable } from '../../../src/shapes.js';
import { exactlyInvariant } from '../../../src/pattern.js';
import { find } from '../../../src/patterns/comma.js';
import { motifFor } from '../../../src/motif.js';

const warns = [];
console.warn = (...a) => warns.push(a.join(' '));
function moved(g, th, sc, v, id) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  // the presets carried too (motif.js reads presets[0]): seed' = A seed + v; metric Q' = A^-T Q A^-1
  const presets = (g.presets || []).map((p) => {
    const s = mul(A, p.seed), out = { ...p, seed: [s[0] + v[0], s[1] + v[1]] };
    if (p.metric) {
      const [q11, q12, q22] = p.metric, Q = [q11, q12, q12, q22], AiT = [Ai[0], Ai[2], Ai[1], Ai[3]], Qp = mm(mm(AiT, Q), Ai);
      out.metric = [Qp[0], Qp[1], Qp[3]];
    }
    return out;
  });
  return { id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]], viewHalf: (g.viewHalf || 1.2) * sc, presets };
}
let a = 99;
const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
for (const g of GROUPS) {
  const th = 2 * Math.PI * rnd(), sc = 0.5 + 1.5 * rnd(), v = [4 * rnd() - 2, 4 * rnd() - 2];
  const row = [g.id.padEnd(6)];
  for (const id of [g.id, null]) {
    const h = moved(g, th, sc, v, id);
    try {
      const r = find(h), P = makeShapePrint(h, { key: 'comma', shapes: r.shapes }), pr = printable(P);
      const s0 = motifFor(g).scale[0] * sc, s1 = r.info.scale[0];
      row.push(`${id ? 'id kept' : 'no id  '}: ${pr.ok ? 'printable' : 'NOT printable (' + pr.problems[0].slice(0, 60) + ')'}, ${exactlyInvariant(h, P) ? 'exact' : 'NOT EXACT'}, size ${(s1 / s0).toFixed(3)} of the page's (source ${r.info.source})`);
    } catch (e) { row.push(`${id ? 'id kept' : 'no id'}: THREW ${e.message.slice(0, 80)}`); }
  }
  console.log(row.join('  |  '));
}
console.log(`warnings: ${warns.length}`); for (const w of warns.slice(0, 6)) console.log('  ' + w);
