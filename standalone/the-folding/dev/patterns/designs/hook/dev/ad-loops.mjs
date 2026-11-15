// dev/ad-loops.mjs — the polygons of a candidate: points, area (tile sizes squared), hole or not, centroid.
//   node ad-loops.mjs '<key>@<cand prefix>'
import { BY_ID } from '../../../../../src/groups.js';
import { motifOf } from '../design.js';
import { CANDS } from './ad-cands.mjs';

const [key, name] = process.argv[2].split('@');
const id = key.includes('#') ? key.split('#')[0] : BY_ID[key] ? key : key.replace(/[a-z]+$/, '');
const g = BY_ID[id], s2 = g.domainArea;
const spec = CANDS[key]().find(([n]) => n.startsWith(name))[1];
const m = motifOf(g, spec);
for (const p of m.shapes) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.pts.length; i++) { const [x0, y0] = p.pts[i], [x1, y1] = p.pts[(i + 1) % p.pts.length]; const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  console.log(p.pts.length, 'pts', p.hole ? 'HOLE' : 'outer', 'area', (Math.abs(A) / s2).toFixed(4), 'at', cx.toFixed(3), cy.toFixed(3));
}
