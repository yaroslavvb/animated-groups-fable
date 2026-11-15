// scratch: kit.measure's coverage (a square window that is not a whole number of periods) against the exact share
import { GROUPS } from '../../../src/groups.js';
import { motifFor } from '../../../src/motif.js';
import { normalize, measure } from '../kit.js';
const t0 = Date.now();
for (const g of GROUPS) {
  const m = motifFor(g);
  const N = normalize(m.polylines.map((p) => ({ pts: Array.from(p) })));
  const exact = N.polys.reduce((s, P) => s + (P.hole ? -P.area : P.area), 0) / g.domainArea;
  const t = Date.now();
  const M = measure(g, N, { per: 28 });
  console.log(g.id.padEnd(6), 'exact', exact.toFixed(4), 'kit coverage', M.coverage.toFixed(3), 'rel err', ((M.coverage / exact - 1) * 100).toFixed(1).padStart(5) + ' %', 'bare', M.emptyDisc, 'solid', M.darkDisc, 'overlap', M.overlap, (Date.now() - t) + ' ms');
}
console.log('total', Date.now() - t0, 'ms');
