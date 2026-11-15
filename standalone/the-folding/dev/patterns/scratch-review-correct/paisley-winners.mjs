// scratch (review-correct): does Paisley's WINNERS table give, for each of the 17 page groups, the very motif its full
// search gives (the polish notes: "the same motif, point for point")? KNOBS.table = false runs the search.
//   node dev/patterns/scratch-review-correct/paisley-winners.mjs
import { GROUPS } from '../../../src/groups.js';
import { find, KNOBS } from '../../../src/patterns/paisley.js';

const canon = (r) => JSON.stringify(r.shapes.map((s) => ({ hole: !!s.hole, pts: Array.from(s.pts || s, (p) => (Array.isArray(p) || ArrayBuffer.isView(p) ? Array.from(p) : p)) })));
let same = 0;
for (const g of GROUPS) {
  KNOBS.table = true;
  const t0 = performance.now(), a = find(g), ta = performance.now() - t0;
  KNOBS.table = false;
  const t1 = performance.now(), b = find(g), tb = performance.now() - t1;
  KNOBS.table = true;
  const eq = canon(a) === canon(b);
  if (eq) same++;
  console.log(`${g.id.padEnd(6)} ${eq ? 'same' : 'DIFFERENT'}  table ${ta.toFixed(0)} ms (looked ${a.info.looked}), search ${tb.toFixed(0)} ms${eq ? '' : `  marks ${a.shapes.length} vs ${b.shapes.length}`}`);
}
console.log(`${same} of ${GROUPS.length} the same`);
