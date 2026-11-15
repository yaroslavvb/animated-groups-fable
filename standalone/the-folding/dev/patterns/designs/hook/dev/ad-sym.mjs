// dev/ad-sym.mjs — extra.mjs as a function: the largest share of points that an isometry OUTSIDE the group keeps
// (kaleidoscope / warp supergroup elements, half lattice translations, turns and mirrors at the group's centres).
import { elementsNear, contains, symmetryElements } from '../../../../../src/groups.js';
import { makeShapePrint } from '../../../../../src/shapes.js';

const rot = (cx, cy, a) => ({ a: Math.cos(a), b: -Math.sin(a), c: Math.sin(a), d: Math.cos(a), tx: cx - Math.cos(a) * cx + Math.sin(a) * cy, ty: cy - Math.sin(a) * cx - Math.cos(a) * cy });
const refl = (px, py, ang) => { const c = Math.cos(2 * ang), s = Math.sin(2 * ang); return { a: c, b: s, c: s, d: -c, tx: px - c * px - s * py, ty: py - s * px + c * py }; };

export function nearSym(g, shapes, n = 1200) {
  const print = makeShapePrint(g, { key: 'hook', name: 'hook', shapes });
  const size = Math.sqrt(g.domainArea), cands = [];
  for (const sup of [g.kaleido && g.kaleido.group, g.warp]) if (sup) for (const e of elementsNear(sup, g.center[0], g.center[1], 2 * size)) if (!contains(g, e)) cands.push(e);
  for (const [s, t] of [[0.5, 0], [0, 0.5], [0.5, 0.5]]) cands.push({ a: 1, b: 0, c: 0, d: 1, tx: s * g.e1[0] + t * g.e2[0], ty: s * g.e1[1] + t * g.e2[1] });
  const sym = symmetryElements(g, g.center[0], g.center[1], 1.5 * size);
  for (const p of [...sym.centers, { x: g.center[0], y: g.center[1] }]) {
    for (const k of [2, 3, 4, 6]) { const e = rot(p.x, p.y, (2 * Math.PI) / k); if (!contains(g, e)) cands.push(e); }
    for (let k = 0; k < 12; k++) { const e = refl(p.x, p.y, (k * Math.PI) / 12); if (!contains(g, e)) cands.push(e); }
  }
  let best = 0;
  for (const e of cands) {
    let same = 0, m = 0;
    for (let i = 0; i < n; i++) {
      const x = g.center[0] + (((i * 0.6180339887) % 1) - 0.5) * 3 * size, y = g.center[1] + (((i * 0.7548776662) % 1) - 0.5) * 3 * size;
      if (print.margin(x, y) < 0.01 * size) continue;
      m++; if (print.tone(x, y) === print.tone(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty)) same++;
    }
    best = Math.max(best, same / m);
  }
  return best;
}
