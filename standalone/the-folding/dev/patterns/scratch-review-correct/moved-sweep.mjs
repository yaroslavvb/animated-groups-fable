// scratch (review-correct, 15 Nov 2026): more moved copies than the shipped test's one per group — N turned, scaled and
// shifted copies of each group without presets (test/patterns-shipped's `moved`; ids kept, as there), each through the
// pattern's find: printable (what the page asks), exactly the moved group's, dark share, the find's time.
//   node moved-sweep.mjs <key> [N]          prints one line per failure and a summary
import { GROUPS } from '../../../src/groups.js';
import { makeShapePrint, printable, measureShapes } from '../../../src/shapes.js';
import { exactlyInvariant } from '../../../src/pattern.js';
import { SHAPE_PATTERNS } from '../../../src/patterns/index.js';

const key = process.argv[2], N = +(process.argv[3] || 6);
const find = SHAPE_PATTERNS.find((p) => p.meta.key === key).find;
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, Nn) => [M[0] * Nn[0] + M[1] * Nn[2], M[0] * Nn[1] + M[1] * Nn[3], M[2] * Nn[0] + M[3] * Nn[2], M[2] * Nn[1] + M[3] * Nn[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}
let a = 4242 + key.length;
const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
let fails = 0, n = 0, worstMs = 0, dmin = 1, dmax = 0;
for (const g of GROUPS) for (let k = 0; k < N; k++) {
  const th = 2 * Math.PI * rnd(), sc = 0.5 + 1.5 * rnd(), v = [4 * rnd() - 2, 4 * rnd() - 2], h = moved(g, th, sc, v);
  const label = `${key} ${g.id} th ${th.toFixed(3)} sc ${sc.toFixed(3)} v ${v.map((x) => x.toFixed(3))}`;
  n++;
  try {
    const t0 = performance.now(), r = find(h), ms = performance.now() - t0;
    worstMs = Math.max(worstMs, ms);
    const P = makeShapePrint(h, { key, name: key, shapes: r.shapes }), pr = printable(P);
    if (!pr.ok) { fails++; console.log(`NOT PRINTABLE ${label}: ${pr.problems.slice(0, 2).join(' | ')}`); continue; }
    if (!exactlyInvariant(h, P, 20, 5)) { fails++; console.log(`NOT EXACT ${label}`); continue; }
    const m = measureShapes(P, { per: 24 });
    dmin = Math.min(dmin, m.coverage); dmax = Math.max(dmax, m.coverage);
    if (m.overlap !== 0 || m.coverage < 0.3 || m.coverage > 0.7) { fails++; console.log(`COVERAGE ${label}: ${m.coverage} overlap ${m.overlap}`); }
  } catch (e) { fails++; console.log(`THREW ${label}: ${String(e.message).split('\n')[0]}`); }
}
console.log(`${key}: ${n} moved copies, ${fails} failing; dark ${dmin.toFixed(3)}..${dmax.toFixed(3)}; slowest find ${worstMs.toFixed(0)} ms`);
