// scratch: the long foot of 3*3 in its own triangle: A (heel corner) at the origin, the long side along x
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
const id = process.argv[2] || '3*3';
const g = BY_ID[id], ts = Math.sqrt(g.domainArea), r = find(g), f = r.info.frames[0];
const A = f.poly[f.heel[0]], B = f.poly[f.toe[0]];
const u = [(B[0] - A[0]), (B[1] - A[1])], l = Math.hypot(u[0], u[1]); u[0] /= l; u[1] /= l;
const loc = (p) => [((p[0] - A[0]) * u[0] + (p[1] - A[1]) * u[1]) / ts, (-(p[0] - A[0]) * u[1] + (p[1] - A[1]) * u[0]) / ts];
console.log('frame', f.poly.map((p) => loc(p).map((v) => v.toFixed(3)).join(',')).join('  '));
r.shapes.forEach((s, i) => {
  const q = s.pts.map(loc), xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  console.log(i ? 'toe ' + i : 'sole ', 'x', Math.min(...xs).toFixed(3), '..', Math.max(...xs).toFixed(3), ' y', Math.min(...ys).toFixed(3), '..', Math.max(...ys).toFixed(3));
  if (!i) { const low = q.filter((p) => Math.abs(p[1]) < 0.12); console.log('   sole points within 0.12 of the long side: x up to', Math.max(...low.map((p) => p[0])).toFixed(3)); }
});
