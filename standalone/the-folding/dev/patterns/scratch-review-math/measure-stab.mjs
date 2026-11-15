// measure-stab.mjs — measureShapes' coverageExact (netArea / (stabilizer * domainArea)) for motifs ON centres and
// mirrors, against a fine sampled share and the reviewer's brute-force W (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/measure-stab.mjs
import { makeShapePrint, measureShapes, validateShapes } from '../../../src/shapes.js';
import { BY_ID, rosette, roomAt, symmetryElements, flatMotif, bruteW } from './lib.mjs';

for (const id of ['2222', '*2222', '333', '442', '*442', '632', '*632', '3*3', '4*2']) {
  const g = BY_ID[id], L = Math.hypot(...g.e1) + Math.hypot(...g.e2), cs = symmetryElements(g, g.center[0], g.center[1], L).centers.sort((p, q) => q.order - p.order);
  const c = cs[0], room = roomAt(g, c.x, c.y), o = rosette(g, [c.x, c.y], 0.3 * room, 240, { amp: 0.08, seed: 11 }), h = rosette(g, [c.x, c.y], 0.15 * room, 120, { amp: 0.05, seed: 3 });
  const shapes = [{ pts: o.pts }, { pts: h.pts, hole: true }], P = makeShapePrint(g, { shapes }), V = validateShapes(P), M = measureShapes(P, { per: 40 });
  // a fine share by brute force over one cell
  const F = flatMotif(shapes), N = 120;
  let d = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const s = (i + 0.37) / N, t = (j + 0.61) / N; if (bruteW(g, F, s * g.e1[0] + t * g.e2[0], s * g.e1[1] + t * g.e2[1]) > 0) d++; }
  console.log(`${id.padEnd(6)} centre of order ${c.order}${c.onMirror ? ' on a mirror' : ''}: stab ${V.stabilizer} (ok ${V.ok}); coverageExact ${M.coverageExact.toFixed(4)}, sampled ${M.coverage}, brute ${(d / N / N).toFixed(4)}; overlap ${M.overlap}`);
}
