// glide-generic.mjs — a comma ACROSS a glide axis at a point no element fixes (the D case of stress.mjs, redone: there
// the roomiest point on a *632 glide axis was on a mirror) (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/glide-generic.mjs
import { makeShapePrint, validateShapes, bakeShapes } from '../../../src/shapes.js';
import { GROUPS, symmetryElements, roomAt, stabilizerOf, commaAt, flatMotif, bruteW, prng } from './lib.mjs';

for (const g of GROUPS) {
  const L = Math.hypot(...g.e1) + Math.hypot(...g.e2), sym = symmetryElements(g, g.center[0], g.center[1], L);
  if (!sym.glides.length) continue;
  for (const m of sym.glides.slice(0, 2)) {
    let best = null;
    for (let k = 0; k < 80; k++) {
      const t = -L + (2 * L * (k + 0.5)) / 80, p = [m.px + t * m.ux, m.py + t * m.uy];
      if (stabilizerOf(g, p).length !== 1) continue;
      const D = roomAt(g, p[0], p[1]);
      if (!best || D > best.D) best = { p, D };
    }
    if (!best) { console.log(g.id, 'no generic point on this glide axis?'); continue; }
    const shapes = [{ pts: commaAt(best.p, 0.45 * best.D, 1.1) }], P = makeShapePrint(g, { shapes }), V = validateShapes(P), F = flatMotif(shapes), rnd = prng(5);
    let bad = 0;
    for (let i = 0; i < 300; i++) { const x = best.p[0] + (2 * rnd() - 1) * L, y = best.p[1] + (2 * rnd() - 1) * L; if (P.margin(x, y) > 1e-9 && P.winding(x, y) !== bruteW(g, F, x, y)) bad++; }
    const T = bakeShapes(P, 64);
    let tb = 0;
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const s = (i + 0.5) / 64, u = (j + 0.5) / 64, x = T.origin[0] + s * T.e1[0] + u * T.e2[0], y = T.origin[1] + s * T.e1[1] + u * T.e2[1], mm = P.margin(x, y), lv = 127 * Math.min(1, mm / T.range), e = Math.round(P.winding(x, y) > 0 ? 128 - lv : 128 + lv); if (T.data[j * 64 + i] !== e && Math.abs((lv % 1) - 0.5) > 1e-3) tb++; }
    console.log(`${g.id.padEnd(6)} glide axis through (${m.px.toFixed(3)}, ${m.py.toFixed(3)}) dir (${m.ux.toFixed(3)}, ${m.uy.toFixed(3)}): ok ${V.ok} stab ${V.stabilizer} gap ${V.gap.toFixed(3)} ${V.problems.join(' | ')}; W vs brute ${bad}/300; texels off ${tb}`);
  }
}
