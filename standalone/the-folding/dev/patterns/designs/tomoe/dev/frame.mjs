// prints every group's default tile in the design's frame: origin the tile's centroid, x along e1, units tile sizes
import { GROUPS, classify } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
const ids = process.argv[2] ? process.argv[2].split(',') : null;
for (const g of GROUPS) {
  if (ids && !ids.includes(g.id)) continue;
  const t = tileOf(g), s = Math.sqrt(g.domainArea), P = t.poly, n = P.length;
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n], w = p[0] * q[1] - p[1] * q[0]; A += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w; }
  cx /= 3 * A; cy /= 3 * A;
  const L = Math.hypot(g.e1[0], g.e1[1]), u = [g.e1[0] / L, g.e1[1] / L], sg = Math.sign(g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0]), v = [-u[1] * sg, u[0] * sg];
  const loc = (p) => [((p[0] - cx) * u[0] + (p[1] - cy) * u[1]) / s, ((p[0] - cx) * v[0] + (p[1] - cy) * v[1]) / s];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
    const ang = Math.acos(((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.hypot(c[0] - b[0], c[1] - b[1])) * 180 / Math.PI;
    const e = t.domain.edges[i], k = classify(e.g), l = loc(b);
    out.push(`  v${i} (${l[0].toFixed(3)}, ${l[1].toFixed(3)}) ${ang.toFixed(0)}deg | e${i} len ${(e.len / s).toFixed(2)} ${e.kind}${e.kind === 'cut' ? '->' + e.partner : ''} ${k.type}${k.order ? k.order : ''}`);
  }
  console.log(`${g.id} area-sign ${Math.sign(A)} size ${s.toFixed(3)} e1 ${g.e1.map((x) => x.toFixed(2))} centroid-world (${cx.toFixed(3)}, ${cy.toFixed(3)})\n` + out.join('\n'));
}
