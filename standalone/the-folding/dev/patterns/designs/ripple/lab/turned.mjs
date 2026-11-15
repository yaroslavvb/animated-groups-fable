// designs/ripple/lab/turned.mjs — does a turned, scaled, shifted group get the turned, scaled, shifted motif? For each of
// the 17 groups (handed over without presets): find(S(group)) against S(find(group)): the largest distance from a vertex
// of one to the outline of the other, in tile sizes.   node dev/patterns/designs/ripple/lab/turned.mjs [angle] [scale]
import { GROUPS } from '../../../../../src/groups.js';
import { carried } from './raster.mjs';
import { find } from '../design.js';
const ang = +(process.argv[2] || 0.7), sc = +(process.argv[3] || 1.37), sh = [0.31, -0.23];
const S = (p) => [sc * (Math.cos(ang) * p[0] - Math.sin(ang) * p[1]) + sh[0], sc * (Math.sin(ang) * p[0] + Math.cos(ang) * p[1]) + sh[1]];
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const toOutline = (p, shapes) => { let best = Infinity; for (const s of shapes) for (let i = 0, n = s.pts.length; i < n; i++) { const d = segDist(p, s.pts[i], s.pts[(i + 1) % n]); if (d < best) best = d; } return best; };
let worst = 0;
for (const g0 of GROUPS) {
  const bare = { id: g0.id, e1: g0.e1, e2: g0.e2, reps: g0.reps, cellArea: g0.cellArea, domainArea: g0.domainArea, center: g0.center };
  const a = find(bare).shapes.map((s) => ({ pts: s.pts.map(S), hole: s.hole })), gc = carried(g0, ang, sc, sh), b = find(gc).shapes, size = Math.sqrt(gc.domainArea);
  let d = 0;
  for (const s of a) for (const p of s.pts) d = Math.max(d, toOutline(p, b));
  for (const s of b) for (const p of s.pts) d = Math.max(d, toOutline(p, a));
  worst = Math.max(worst, d / size);
  console.log(g0.id.padEnd(6), 'polygons', a.length, b.length, ' off by', (d / size).toExponential(2), 'tile sizes');
}
console.log('worst', worst.toExponential(2));
