// prints the default tile of every group: polygon in tile sizes (relative to its centroid), edge kinds, angles
import { GROUPS, classify } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
for (const g of GROUPS) {
  const t = tileOf(g), s = Math.sqrt(g.domainArea), P = t.poly, n = P.length;
  let cx = 0, cy = 0; for (const p of P) { cx += p[0] / n; cy += p[1] / n; }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
    const ang = Math.acos(((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.hypot(c[0] - b[0], c[1] - b[1])) * 180 / Math.PI;
    const e = t.domain.edges[i], k = classify(e.g);
    out.push(`  v${i} (${((b[0] - cx) / s).toFixed(2)}, ${((b[1] - cy) / s).toFixed(2)}) ang ${ang.toFixed(0)}  | edge ${i}: len ${(e.len / s).toFixed(2)} ${e.kind}${e.kind === 'cut' ? ' ->' + e.partner : ''} ${k.type}${k.order ? k.order : ''}`);
  }
  console.log(`${g.id}  size ${s.toFixed(3)}  seed (${t.seed.map((v) => v.toFixed(3))})\n` + out.join('\n'));
}
