// dev/intile.mjs — for the SPEC of design.js: the largest share of ONE copy of the motif that lies inside the default
// tile (the best copy, over the elements near the tile), per group.   node intile.mjs [ids]
import { GROUPS, elementsNear } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
import { find } from '../design.js';

function inside(p, x, y) {
  let inn = false;
  for (let i = 0, n = p.length, j = n - 1; i < n; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < p[i][0] + ((y - p[i][1]) * (p[j][0] - p[i][0])) / (p[j][1] - p[i][1])) inn = !inn;
  return inn;
}
export function bestInTile(group, shapes, n = 50) {
  const t = tileOf(group), size = Math.sqrt(group.domainArea);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pts = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) / n) * (x1 - x0), y = y0 + ((j + 0.5) / n) * (y1 - y0);
    let w = 0; for (const s of shapes) if (inside(s.pts, x, y)) w += s.hole ? -1 : 1;
    if (w > 0) pts.push([x, y]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let best = 0;
  for (const g of elementsNear(group, t.seed[0], t.seed[1], 3 * size + Math.hypot(x1 - x0, y1 - y0), cx, cy)) {
    let k = 0;
    for (const [x, y] of pts) if (t.domain.contains(g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty, 1e-9)) k++;
    best = Math.max(best, k / pts.length);
  }
  return best;
}
if (process.argv[1] && process.argv[1].endsWith('intile.mjs')) {
  const ids = process.argv[2] ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
  for (const id of ids) { const g = GROUPS.find((x) => x.id === id); console.log(id.padEnd(6), bestInTile(g, find(g).shapes).toFixed(3)); }
}
