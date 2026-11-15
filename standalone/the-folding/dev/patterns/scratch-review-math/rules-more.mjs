// rules-more.mjs — the rest of validateShapes' claims (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/rules-more.mjs
import { makeShapePrint, validateShapes, measureShapes } from '../../../src/shapes.js';
import { BY_ID } from './lib.mjs';

const g = BY_ID['2222'], c = [0.31, 0.27], s = 0.12;
const sq = (x, y, r) => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
const cases = [
  ['holes only', [{ pts: sq(c[0], c[1], s), hole: true }]],
  ['a slit of zero width into a square', [{ pts: [[c[0] - s, c[1] - s], [c[0] + s, c[1] - s], [c[0] + s, c[1]], [c[0], c[1]], [c[0] + s, c[1]], [c[0] + s, c[1] + s], [c[0] - s, c[1] + s]] }]],
  ['a slit 1e-7 wide', [{ pts: [[c[0] - s, c[1] - s], [c[0] + s, c[1] - s], [c[0] + s, c[1] - 1e-7], [c[0], c[1] - 1e-7], [c[0], c[1] + 1e-7], [c[0] + s, c[1] + 1e-7], [c[0] + s, c[1] + s], [c[0] - s, c[1] + s]] }]],
  ['a slit 1e-4 wide (a hair; passes: no width rule inside a motif)', [{ pts: [[c[0] - s, c[1] - s], [c[0] + s, c[1] - s], [c[0] + s, c[1] - 1e-4], [c[0], c[1] - 1e-4], [c[0], c[1] + 1e-4], [c[0] + s, c[1] + 1e-4], [c[0] + s, c[1] + s], [c[0] - s, c[1] + s]] }]],
  ['two polygons of the motif 1e-4 apart (passes: GAP_MIN is for copies only)', [{ pts: sq(c[0], c[1], s) }, { pts: sq(c[0] + 2 * s + 1e-4 + 0.05, c[1], 0.05) }]],
  ['a collinear triangle', [{ pts: [[c[0], c[1]], [c[0] + s, c[1] + s], [c[0] + 2 * s, c[1] + 2 * s]] }, { pts: sq(c[0], c[1] - 3 * s, 0.5 * s) }]],
  ['an island touching its hole at a point', [{ pts: sq(c[0], c[1], s) }, { pts: sq(c[0], c[1], 0.6 * s), hole: true }, { pts: [[c[0] - 0.3 * s, c[1] - 0.3 * s], [c[0] + 0.6 * s, c[1]], [c[0] - 0.3 * s, c[1] + 0.3 * s]] }]],
];
for (const [name, shapes] of cases) {
  let line;
  try { const P = makeShapePrint(g, { shapes }), V = validateShapes(P); line = `ok ${V.ok}  ${V.problems.join(' | ').slice(0, 200) || '(no problems)'}`; } catch (e) { line = 'THROWS ' + e.message; }
  console.log(name.padEnd(70), line);
}
// above CHECK_VERTS: the outlines are not looked at, and it says so
{
  const n = 40100, pts = [];
  for (let k = 0; k < n; k++) { const t = (2 * Math.PI * k) / n; pts.push([c[0] + s * Math.cos(t), c[1] + s * Math.sin(t)]); }
  const t0 = performance.now(), P = makeShapePrint(g, { shapes: [{ pts }] }), t1 = performance.now(), V = validateShapes(P), t2 = performance.now();
  console.log(`40100 vertices: make ${(t1 - t0).toFixed(0)} ms, validate ${(t2 - t1).toFixed(0)} ms -> ok ${V.ok}: ${V.problems.join(' | ')}`);
  const t3 = performance.now(), M = measureShapes(P, { per: 20 });
  console.log(`   measureShapes ${(performance.now() - t3).toFixed(0)} ms, coverageExact ${M.coverageExact}`);
}
