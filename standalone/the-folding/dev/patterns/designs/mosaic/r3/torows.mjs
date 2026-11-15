// torows.mjs — commas given in the CELL's frame (origin p, world axes, tile sizes; what bench.mjs takes as "C") written
// as rows of the design's table, in the GROUP's own frame (lattice coordinates from the anchor, heading from e1) (dev).
//   node r3/torows.mjs '{"*x": [[x, y, dir, len, t0, t1, rad, pow, q], ...]}'
import { knobsFor, frameOf, toWorld, toFrame } from '../design.js';
import { BY_ID } from '../lab.mjs';
const C = JSON.parse(process.argv[2]), r4 = (v) => +(+v).toFixed(4);
for (const [id, list] of Object.entries(C)) {
  const g = BY_ID[id], F = frameOf(g), K = knobsFor(g), p = toWorld(g, F.A, K.p);
  for (const L of list) {
    const h = toFrame(g, F.A, [p[0] + F.size * L[0], p[1] + F.size * L[1]]);
    console.log(id, JSON.stringify([h[0], h[1], L[2] - F.e1ang, L[3], L[4], L[5], L[6], L[7] || 1, L[8] || 1].map(r4)));
  }
}
