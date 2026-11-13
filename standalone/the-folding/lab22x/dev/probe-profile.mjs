// probe-profile.mjs — for every cut × motion: when the sheet passes through itself (first, last t), the largest
// crossing and the crossing at t = 1, in tile widths, on the detector's jittered triangulation (as the page does).
import { CUTS, MOTIONS, buildSheet, positionsAt } from '../src/motions.js';
import { createSelfX, jitterPlane } from '../src/selfx.js';
const N = 240, NONE = 0.004, rows = [];
for (let c = 0; c < CUTS.length; c++) for (const m of MOTIONS) {
  const sh = buildSheet(c, m.key), uv = jitterPlane(sh.uv, sh.tri, sh.triTag), X = createSelfX(sh.tri), pos = new Float32Array(3 * sh.n);
  let first = null, last = null, max = 0, at = 0, end = 0, ms = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N, t0 = performance.now();
    positionsAt(sh, t, uv, sh.tag, pos);
    const L = X.compute(pos, sh.size).length / sh.size;
    ms += performance.now() - t0;
    if (L >= NONE) { if (first === null) first = t; last = t; }
    if (L > max) { max = L; at = t; }
    if (i === N) end = L;
  }
  rows.push({ cut: CUTS[c].name, motion: m.key, first: first === null ? '-' : first.toFixed(3), last: last === null ? '-' : last.toFixed(3), max: max.toFixed(3), at: at.toFixed(3), end: end.toFixed(3), tris: sh.tri.length / 3, msPerStep: (ms / (N + 1)).toFixed(1), stops: sh.stops.map((s) => s.t.toFixed(2)).join(' ') });
}
console.table(rows);
const fr = buildSheet(2, 'acts'); console.log('double line / size =', (fr.fold.finalMap.mu * fr.frame.hy / fr.size).toFixed(3));
