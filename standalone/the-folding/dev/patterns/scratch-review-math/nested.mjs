// nested.mjs — validateShapes' rarer claims (review-math, 13 Nov 2026):
//   (1) a copy that lies INSIDE another's dark without the outlines crossing ("a copy of the motif lies inside another")
//   (2) a copy that sits inside another's HOLE (an island: fine)
//   (3) copies that coincide in part only (one polygon symmetric about a mirror, the other not)
//   node dev/patterns/scratch-review-math/nested.mjs
import { makeShapePrint, validateShapes, fillShapes, bakeShapes } from '../../../src/shapes.js';
import { BY_ID, flatMotif, bruteW, recorder, windingOf, rosette, roomAt, symmetryElements, prng } from './lib.mjs';

const circle = (c, r, n = 96, ph = 0) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos(ph + (2 * Math.PI * i) / n), c[1] + r * Math.sin(ph + (2 * Math.PI * i) / n)]);
function run(name, g, shapes) {
  const P = makeShapePrint(g, { shapes }), V = validateShapes(P), F = flatMotif(shapes), rnd = prng(3);
  let bad = 0, n = 0, maxW = 0, fb = 0;
  const L = Math.max(Math.hypot(...g.e1), Math.hypot(...g.e2)), c = recorder();
  fillShapes(c, P, (x, y, o) => { o[0] = x; o[1] = y; return o; }, [g.center[0] - 2 * L, g.center[1] - 2 * L, g.center[0] + 2 * L, g.center[1] + 2 * L], '#000');
  for (let i = 0; i < 1500; i++) {
    const x = g.center[0] + (2 * rnd() - 1) * 1.5 * L, y = g.center[1] + (2 * rnd() - 1) * 1.5 * L;
    if (P.margin(x, y) < 1e-9) continue;
    n++;
    const W = P.winding(x, y);
    if (W !== bruteW(g, F, x, y)) bad++;
    if (windingOf(c.fills[0].path, x, y) !== W) fb++;
    maxW = Math.max(maxW, W);
  }
  console.log(`${name}: ok ${V.ok}, stab ${V.stabilizer}, gap ${V.gap.toFixed(4)}, max W ${maxW}, W vs brute ${bad}/${n} differ, fill vs W ${fb} differ\n    ${V.problems.join('\n    ') || '(no problems)'}`);
}
// (1) group o: a ring round c, and a small disc one lattice step to the left of the ring's band, so that its translate
// by e1 lies inside the ring's dark band; no outline crosses another
{
  const g = BY_ID.o, u = g.e1, lu = Math.hypot(...u), dir = [u[0] / lu, u[1] / lu], c = [0.3, 0.4];
  const d = [c[0] - u[0] + 0.25 * lu * -dir[1], c[1] - u[1] + 0.25 * lu * dir[0]];     // c - e1 + 0.25|e1| (normal of e1)
  run('(1) o: ring + disc whose translate lies in the ring', g, [{ pts: circle(c, 0.3 * lu) }, { pts: circle(c, 0.2 * lu, 72), hole: true }, { pts: circle(d, 0.02 * lu, 24) }]);
  // the same with the disc's translate inside the HOLE (an island of another copy: fine)
  const d2 = [c[0] - u[0] + 0.1 * lu * -dir[1], c[1] - u[1] + 0.1 * lu * dir[0]];
  run('(2) o: ring + disc whose translate lies in the ring\'s hole', g, [{ pts: circle(c, 0.3 * lu) }, { pts: circle(c, 0.2 * lu, 72), hole: true }, { pts: circle(d2, 0.02 * lu, 24) }]);
}
// (3) *2222 (mirrors): on a mirror, an egg symmetric about it plus a comma-ish lopsided blob beside it (the motif as a
// whole is not symmetric: its mirror copy coincides with it on the egg only)
{
  const g = BY_ID['*2222'], L = Math.hypot(...g.e1) + Math.hypot(...g.e2), sym = symmetryElements(g, g.center[0], g.center[1], L), m = sym.mirrors[0];
  let best = null;
  for (let k = 0; k < 40; k++) { const t = -L + (2 * L * (k + 0.5)) / 40, p = [m.px + t * m.ux, m.py + t * m.uy], D = roomAt(g, p[0], p[1]); if (!best || D > best.D) best = { p, D }; }
  const egg = rosette(g, best.p, 0.15 * best.D, 120, { amp: 0.1, seed: 4 });
  const nx = -m.uy, ny = m.ux, q = [best.p[0] + 0.3 * best.D * nx + 0.05 * best.D * m.ux, best.p[1] + 0.3 * best.D * ny + 0.05 * best.D * m.uy];
  console.log(`    (egg stab ${egg.order})`);
  run('(3) *2222: egg on a mirror + a disc off it', g, [{ pts: egg.pts }, { pts: circle(q, 0.05 * best.D, 40) }]);
}
