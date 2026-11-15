// simplify-count.mjs (fixer) — how many vertices a motif keeps when its outline is simplified (Douglas-Peucker) to
// within `tol` css px at the plane's scale of a 622 x 550 pane (the 1280 x 720 window).
//   node dev/patterns/scratch-fixer/simplify-count.mjs stress '*442,*632,4*2,o' [0.15]
import { BY_ID } from '../../../src/groups.js';
import { planeScale } from '../../../src/plane.js';

const [key = 'stress', idsArg = '*442,*632,4*2,o', tolArg = '0.15'] = process.argv.slice(2);
const M = await import(`../designs/${key}/design.js`);

function dp(pts, tol) {               // pts: [[x, y], ...] closed; keeps a subset of the points
  const n = pts.length;
  if (n <= 3) return pts.slice();
  let f = 0, best = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > best) { best = d; f = i; } }
  const keep = new Uint8Array(n); keep[0] = 1; keep[f] = 1;
  const stack = [[0, f], [f, n]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const A = pts[a], B = pts[b % n], ex = B[0] - A[0], ey = B[1] - A[1], l2 = ex * ex + ey * ey;
    let m = -1, dm = -1;
    for (let i = a + 1; i < b; i++) {
      const P = pts[i];
      let t = l2 > 0 ? ((P[0] - A[0]) * ex + (P[1] - A[1]) * ey) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(P[0] - A[0] - t * ex, P[1] - A[1] - t * ey);
      if (d > dm) { dm = d; m = i; }
    }
    if (m >= 0 && dm > tol) { keep[m] = 1; stack.push([a, m], [m, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

for (const id of idsArg.split(',')) {
  const g = BY_ID[id], s = planeScale(g, 550, true), tol = +tolArg / s;
  const { shapes } = M.find(g);
  let before = 0, after = 0;
  for (const S of shapes) { const p = S.pts || S; before += p.length; after += dp(p, tol).length; }
  console.log(`${key} ${id}: scale ${s.toFixed(1)} px/unit, ${before} -> ${after} vertices at ${tolArg} px`);
}
