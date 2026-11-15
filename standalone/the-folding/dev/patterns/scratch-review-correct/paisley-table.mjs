// scratch (review-correct): does every page group's Paisley come from WINNERS (info.looked), and how long is each find?
import { GROUPS } from '../../../src/groups.js';
import { find } from '../../../src/patterns/paisley.js';
for (const g of GROUPS) {
  const t0 = performance.now(), r = find(g), ms = performance.now() - t0;
  console.log(`${g.id.padEnd(6)} table ${r.info.looked}  marks ${r.shapes.length}  ${ms.toFixed(1)} ms`);
}
