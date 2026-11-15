// dev/validate.mjs — the production check of the Hooks design (src/shapes.js validateShapes and measureShapes), once
// for all 17 groups and for turned, scaled and shifted copies of some groups handed over WITHOUT presets (as the tests
// of test/shapes.test.js carry them): their motif must be the carried motif.   node validate.mjs [--measure]
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../../../src/shapes.js';
import { find } from '../design.js';

const doMeasure = process.argv.includes('--measure');
let bad = 0;
const rows = [];
for (const g of GROUPS) {
  const t0 = performance.now();
  const res = find(g);
  const ms = performance.now() - t0;
  let line = g.id.padEnd(6) + ` ${ms.toFixed(0).padStart(3)} ms  verts ${res.shapes.reduce((s, p) => s + p.pts.length, 0)}`;
  try {
    const print = makeShapePrint(g, { key: 'hook', name: 'hook', shapes: res.shapes, info: res.info });
    const v = validateShapes(print);
    line += `  ok ${v.ok}  gap ${v.gap.toFixed(3)}  stabilizer ${v.stabilizer}` + (v.ok ? '' : '  PROBLEMS ' + v.problems.join(' | '));
    if (!v.ok) bad++;
    if (doMeasure) { const m = measureShapes(print); rows.push({ id: g.id, ...m }); line += `  dark ${m.coverage.toFixed(3)} bare ${m.emptyDisc.toFixed(3)} solid ${m.darkDisc.toFixed(3)}`; }
  } catch (e) { line += '  THROWS ' + e.message; bad++; }
  console.log(line);
}

// the moved copies (test/shapes.test.js moved(), mover())
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
const mover = (th, sc, v) => (x, y) => [sc * (Math.cos(th) * x - Math.sin(th) * y) + v[0], sc * (Math.sin(th) * x + Math.cos(th) * y) + v[1]];
const moves = [[0.7, 1.9, [3.1, -2.2]], [-2.3, 0.37, [-11.5, 40.25]], [Math.PI / 2, 1, [0.5, 0.25]]];
console.log('moved copies (no presets):');
for (const id of ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632']) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea);
  const ref = makeShapePrint(g, { key: 'hook', name: 'hook', shapes: find(g).shapes });
  for (const [th, sc, v] of moves) {
    const h = moved(g, th, sc, v), T = mover(th, sc, v);
    let line = `  ${id.padEnd(6)} turned ${th.toFixed(2)} scaled ${sc} shifted ${v}: `;
    try {
      const res = find(h);
      const p = makeShapePrint(h, { key: 'hook', name: 'hook', shapes: res.shapes });
      const val = validateShapes(p);
      // the tone of the moved print at moved points = the tone of the print at the points (a few thousand points)
      let diff = 0, near = 0, n = 0;
      for (let i = 0; i < 4000; i++) {
        const x = g.center[0] + (((i * 0.6180339887) % 1) - 0.5) * 4 * size, y = g.center[1] + (((i * 0.7548776662) % 1) - 0.5) * 4 * size;
        const [X, Y] = T(x, y);
        if (ref.margin(x, y) < 0.004 * size) { near++; continue; }  // on an outline: the tracing grid differs by a hair
        n++; if (ref.tone(x, y) !== p.tone(X, Y)) diff++;
      }
      line += `ok ${val.ok} stabilizer ${val.stabilizer}  tone differs at ${diff} of ${n} points (${near} on outlines skipped)`;
      if (!val.ok || diff > 0) { bad++; line += '  <-- ' + (val.problems || []).join(' | '); }
    } catch (e) { line += 'THROWS ' + e.message; bad++; }
    console.log(line);
  }
}
console.log(bad ? `FAIL: ${bad} problems` : 'ALL OK');
if (doMeasure) console.log(JSON.stringify(rows));
