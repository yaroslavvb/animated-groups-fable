// polish/check.mjs — the production check of the finished design (polish-soft, 14 Nov 2026): for all 17 groups as
// src/groups.js has them, and for a turned, scaled and shifted copy of each that carries no presets (the fields a test
// hands over, as test/pattern.test.js moved() builds them), src/shapes.js makeShapePrint + printable (what the page
// asks before it shows a print) + validateShapes (the kit's gap) + thinParts at 1.5 texels of the page's 3D texture.
//   node polish/check.mjs [--ids a,b] [--design path]       (one line per group and copy; "all ok" or "N BAD" last)
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint, printable, validateShapes, thinParts, bakeShapes, BAKE_SIZE } from '../../../../../src/shapes.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const D = await import(opt.design ? new URL(opt.design, `file://${process.cwd()}/`).href : '../design.js');
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);

/** test/pattern.test.js moved(): the group carried by x -> s R(th) x + v, with only the fields a test hands over. */
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

let bad = 0, thinGroups = 0, worstMs = 0, worstVerts = 0, worstThin = 0;
const run = (label, g, own) => {
  const t0 = performance.now(), res = D.find(g), ms = performance.now() - t0;
  const verts = res.shapes.reduce((n, s) => n + s.pts.length, 0);
  worstMs = Math.max(worstMs, ms); worstVerts = Math.max(worstVerts, verts);
  let line = `${label.padEnd(30)} ${ms.toFixed(0).padStart(4)} ms ${String(verts).padStart(5)} pts ${String(res.shapes.length).padStart(2)} polys`;
  try {
    const pr = makeShapePrint(g, { key: D.meta.key, name: D.meta.label, shapes: res.shapes, info: res.info });
    const p = printable(pr), v = validateShapes(pr);
    const pitch = (bakeShapes(pr, 16).pitch * 16) / BAKE_SIZE, thin = thinParts(pr, 1.5 * pitch), tx = thin.length ? thin[0].length / pitch : 0;
    worstThin = Math.max(worstThin, tx);
    line += `  printable ${p.ok ? 'ok' : 'NO: ' + p.problems.join('; ')}  rules ${v.ok ? 'ok' : 'NO: ' + v.problems.join('; ')}  gap ${(v.gap ?? NaN).toFixed(3)}  stab ${v.stabilizer}  thin ${tx > 6 ? 'THIN ' : ''}${tx.toFixed(1)} tx`;
    if (!p.ok || !v.ok || verts > 2400 || !res.shapes.length) bad++;
    if (own && tx > 6) thinGroups++;
  } catch (e) { bad++; line += '  THROWS ' + e.message; }
  console.log(line);
};
for (const id of ids) run(id, BY_ID[id], true);
const knobs = [[0.7, 1.9, [3.1, -2.4]], [-2.2, 0.37, [-0.4, 5.5]]];
for (const id of ids) for (const [th, sc, v] of knobs) run(`${id} moved ${th}/${sc}`, moved(BY_ID[id], th, sc, v), false);
console.log(`worst: ${worstMs.toFixed(0)} ms (node, cold first call included), ${worstVerts} vertices, thin run ${worstThin.toFixed(1)} texels; groups with THIN: ${thinGroups}`);
console.log(bad ? `${bad} BAD` : 'all ok');
