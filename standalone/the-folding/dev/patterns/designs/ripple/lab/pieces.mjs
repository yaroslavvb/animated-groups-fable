// the areas of the dark pieces of each motif, in tile areas (to see what SPECK leaves out): node lab/pieces.mjs ['{knobs}']
import { GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';
const kn = process.argv[2] ? JSON.parse(process.argv[2]) : undefined;
for (const g of GROUPS) {
  const res = find(g, kn), A = g.domainArea;
  const areas = res.shapes.map((s) => { let a = 0; for (let i = 0, n = s.pts.length; i < n; i++) { const p = s.pts[i], q = s.pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return (s.hole ? -1 : 1) * Math.abs(a / 2) / A; });
  console.log(g.id.padEnd(6), areas.map((a) => a.toFixed(3)).join(' '), ' dropped', res.info.dropped);
}
