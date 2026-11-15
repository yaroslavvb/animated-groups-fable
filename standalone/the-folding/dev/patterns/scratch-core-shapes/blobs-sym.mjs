// scratch: how far from symmetric are the motifs of a design that sits on a rotation centre? For every element of the
// group that fixes the centre of the motif's bounding circle: the largest distance from a vertex of g(motif) to the
// motif's own outline, in tile sizes ("coincide" is 1e-6).
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS, elementsNear, classify } from '../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../src/shapes.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const key = process.argv[2] || 'blobs';
const mod = await import(pathToFileURL(path.resolve(here, '../designs', key, 'design.js')).href);
function seg(x, y, ax, ay, bx, by) { const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey; let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - ax - t * ex, y - ay - t * ey); }
for (const g of GROUPS) {
  let res; try { res = mod.find(g); } catch (e) { console.log(g.id, 'throws', e.message); continue; }
  const P = makeShapePrint(g, { shapes: res.shapes }), V = validateShapes(P), size = P.size;
  // candidates: elements that move the centre of the bounding circle by less than a hundredth of a tile
  const els = elementsNear(g, P.cx, P.cy, 0.02 * size, P.cx, P.cy);
  const out = [];
  for (const e of els) {
    const c = classify(e);
    if (c.type === 'identity') continue;
    let worst = 0;
    for (const poly of P.polys) for (let i = 0; i < poly.pts.length; i += 2) {
      const x = e.a * poly.pts[i] + e.b * poly.pts[i + 1] + e.tx, y = e.c * poly.pts[i] + e.d * poly.pts[i + 1] + e.ty;
      let best = Infinity;
      for (const q of P.polys) for (let k = 0, n = q.pts.length / 2, j = n - 1; k < n; j = k++) best = Math.min(best, seg(x, y, q.pts[2 * j], q.pts[2 * j + 1], q.pts[2 * k], q.pts[2 * k + 1]));
      worst = Math.max(worst, best);
    }
    const shift = Math.hypot(e.a * P.cx + e.b * P.cy + e.tx - P.cx, e.c * P.cx + e.d * P.cy + e.ty - P.cy);
    out.push(`${c.type}${c.order ? ' ' + c.order : ''}: off by ${(worst / size).toExponential(1)} (centre moved ${(shift / size).toExponential(1)})`);
  }
  console.log(g.id.padEnd(6), 'W', V.stabilizer, 'gap', V.gap.toFixed(4), '|', out.join('; ') || 'no element fixes the centre');
}
