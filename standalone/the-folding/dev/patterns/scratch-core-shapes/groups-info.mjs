// scratch: the lattices of the 17 groups
import { GROUPS } from '../../../src/groups.js';
import { motifFor } from '../../../src/motif.js';
for (const g of GROUPS) {
  const size = Math.sqrt(g.domainArea), L1 = Math.hypot(...g.e1), L2 = Math.hypot(...g.e2);
  const m = motifFor(g);
  console.log(g.id.padEnd(6), 'e1', g.e1.map((v) => v.toFixed(3)).join(','), 'e2', g.e2.map((v) => v.toFixed(3)).join(','), 'reps', String(g.reps.length).padStart(2),
    'size', size.toFixed(3), 'minH/size', (g.cellArea / Math.max(L1, L2) / size).toFixed(3), 'viewHalf', g.viewHalf, 'center', g.center.map((v) => v.toFixed(3)).join(','),
    'comma n', m.polylines[0].length / 2, 'r', m.radius.toFixed(3), 'cover', (m.info.cover || 0).toFixed(3));
}
