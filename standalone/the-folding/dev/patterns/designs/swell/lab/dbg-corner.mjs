// lab/dbg-corner.mjs — the tone of the print along each corner's bisector of the tile (kit.toneAt), and the field there.
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, toneAt } from '../../../kit.js';
import * as D from '../design.js';
const id = process.argv[2] || '*442';
const g = BY_ID[id], u = Math.sqrt(g.domainArea), b = D.build(g), T = b.tile, N = normalize(b.shapes);
const c = T.reduce((q, p) => [q[0] + p[0] / T.length, q[1] + p[1] / T.length], [0, 0]);
for (const V of T) {
  const dx = c[0] - V[0], dy = c[1] - V[1], l = Math.hypot(dx, dy);
  const row = [];
  for (const t of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7]) row.push(t + ':' + toneAt(g, N, V[0] + (dx / l) * t * u, V[1] + (dy / l) * t * u));
  console.log('corner', (V[0] / u).toFixed(3), (V[1] / u).toFixed(3), row.join(' '));
}
