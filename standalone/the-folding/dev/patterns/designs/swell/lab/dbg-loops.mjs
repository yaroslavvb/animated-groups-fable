// lab/dbg-loops.mjs — the loops of a motif: hole flags, areas (tile units), and whether each lies inside the tile.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
for (const id of (process.argv[2] || '*442').split(',')) {
  const g = BY_ID[id], u = Math.sqrt(g.domainArea), b = D.build(g), T = b.tile;
  const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; s += a[0] * c[1] - c[0] * a[1]; } return s / 2; };
  console.log(id, 'tile area', (Math.abs(area(T)) / u / u).toFixed(3), 'loops', b.shapes.map((s) => ({ hole: s.hole, n: s.pts.length, area: +(area(s.pts) / u / u).toFixed(3) })));
}
