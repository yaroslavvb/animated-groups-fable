// dev/timing.mjs — find() per group, cold (the first call in this process, as the page calls it) and warm (motifOf again).
import { GROUPS } from '../../../../../src/groups.js';
import { find, motifOf, SPEC } from '../design.js';
const out = [];
for (const g of GROUPS) {
  const t0 = performance.now(); find(g); const cold = performance.now() - t0;
  const t1 = performance.now(); motifOf(g, SPEC[g.id]); const warm = performance.now() - t1;
  out.push(`${g.id} ${cold.toFixed(0)}/${warm.toFixed(0)}`);
}
console.log('ms cold/warm:', out.join('  '));
