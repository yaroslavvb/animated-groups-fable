// lab/r3/prodcheck.mjs — the production checks of src/shapes.js on design.js (polish round, 14 Nov 2026): for each of the
// 17 groups (with presets, as the page has them) and for a turned, scaled and shifted copy of each WITHOUT presets (as
// test/pattern.test.js moves a group): makeShapePrint, printable (what the page asks), validateShapes (the kit's
// GAP_MIN), thinParts at 1.5 texels of the 3D texture (app-sheet's THIN: more than 6 texels of outline), vertices.
//   node lab/r3/prodcheck.mjs [design.js]
import { GROUPS } from '../../../../../../src/groups.js';
import { makeShapePrint, printable, validateShapes, thinParts, bakeShapes, MAX_VERTS } from '../../../../../../src/shapes.js';
const { find, meta } = await import('../../' + (process.argv[2] || 'design.js'));

/** The group carried to another place: x -> s R(th) x + v (as test/pattern.test.js `moved`: reps conjugated, lattice and centre moved, no presets). */
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

let bad = 0, thinGroups = 0;
const check = (g, label) => {
  const res = find(g), print = makeShapePrint(g, { key: meta.key, name: meta.label, shapes: res.shapes });
  const P = printable(print), V = validateShapes(print), pitch = bakeShapes(print).pitch;
  const thin = thinParts(print, 1.5 * pitch).filter((r) => r.length / pitch > 6);
  const dark = print.polys.reduce((a, Q) => a + (Q.hole ? -Q.area : Q.area), 0) / ((V.stabilizer || 1) * g.domainArea);
  const ok = P.ok && V.ok && !thin.length && print.verts <= MAX_VERTS;
  if (!ok) bad++;
  if (thin.length) thinGroups++;
  console.log(`${label.padEnd(26)} printable ${P.ok ? 'yes' : 'NO '}  validateShapes ${V.ok ? 'ok ' : 'BAD'} gap ${V.gap.toFixed(3)}  thin ${thin.length ? thin.map((r) => (r.length / pitch).toFixed(1) + ' texels').join(', ') : 'none'}  ${print.verts} vertices  dark ${dark.toFixed(3)}` + (ok ? '' : '  ' + [...P.problems, ...V.problems].slice(0, 2).join(' | ')));
};
for (const g of GROUPS) check(g, g.id);
const moves = [[0.7, 1.7, [0.9, -1.3]], [3.66, 0.55, [-1.2, 0.4]]];
for (const g of GROUPS) for (const [th, sc, v] of moves) check(moved(g, th, sc, v), `${g.id} moved ${th}/${sc} (no presets)`);
console.log(bad ? `${bad} FAILED` : `all ${GROUPS.length * (1 + moves.length)} pass: printable, validateShapes, no THIN part, at most ${MAX_VERTS} vertices` + (thinGroups ? '' : ''));
