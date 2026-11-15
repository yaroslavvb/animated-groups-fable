// node dev/prodcheck.mjs [--design ../design.js] — the shipped design against the PRODUCTION code (src/shapes.js), as the
// page will ask it: for all 17 groups of src/groups.js and for a turned, scaled and shifted copy of each without presets
// (test/pattern.test.js's moved()): makeShapePrint, printable (what printFor asks), validateShapes (the kit's GAP_MIN),
// and thinParts at 1.5 texels of the 3D texture (app-sheet.mjs's THIN). One line a case; exit 1 if any case fails.
import path from 'node:path';
import { GROUPS } from '../../../../../src/groups.js';
import { makeShapePrint, printable, validateShapes, thinParts, bakeShapes } from '../../../../../src/shapes.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const mod = await import(path.resolve(path.dirname(new URL(import.meta.url).pathname), opt.design || '../design.js'));

/** The group carried to another place: x -> s R(th) x + v (as test/pattern.test.js). */
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

let bad = 0, worstMs = 0, worstVerts = 0, thinCases = 0;
const cases = [];
GROUPS.forEach((g, k) => {
  cases.push([g.id, 'page', g]);
  cases.push([g.id, 'moved', moved(g, 0.37 + 0.71 * k, 0.45 + 0.13 * (k % 9), [1.3 - 0.21 * k, -0.8 + 0.17 * k])]);
});
for (const [id, label, grp] of cases) {
  try {
    const t0 = performance.now(), res = mod.find(grp), ms = performance.now() - t0;
    const P = makeShapePrint(grp, { key: 'tomoe', shapes: res.shapes });
    const pr = printable(P), V = validateShapes(P), pitch = bakeShapes(P).pitch;
    const thin = thinParts(P, 1.5 * pitch).filter((r) => r.length / pitch > 6);
    const verts = res.shapes.reduce((s, sh) => s + sh.pts.length, 0);
    worstMs = Math.max(worstMs, ms); worstVerts = Math.max(worstVerts, verts); if (thin.length) thinCases++;
    const okAll = pr.ok && V.ok && !thin.length && verts <= 2400;
    if (!okAll) bad++;
    console.log(`${id.padEnd(6)} ${label.padEnd(6)} ${okAll ? 'ok  ' : 'FAIL'} printable ${pr.ok ? 'yes' : 'NO: ' + pr.problems[0]}  validate ${V.ok ? 'yes' : 'NO: ' + V.problems[0]}  gap ${V.gap.toFixed(3)}  THIN ${thin.length ? thin.map((r) => `${r.dark ? 'dark' : 'light'} ${(r.length / pitch).toFixed(0)} tx`).join(', ') : 'none'}  verts ${verts}  ${ms.toFixed(1)} ms`);
  } catch (e) { bad++; console.log(`${id.padEnd(6)} ${label.padEnd(6)} THROWS ${e.message}`); }
}
console.log(`${cases.length} cases: ${cases.length - bad} ok, ${bad} failed; THIN in ${thinCases}; at most ${worstVerts} vertices; find() at most ${worstMs.toFixed(1)} ms in node`);
process.exit(bad ? 1 : 0);
