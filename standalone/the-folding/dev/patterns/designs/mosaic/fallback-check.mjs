// fallback-check.mjs — the path for a group the table does not know (dev): every lattice of the 17 handed over under an
// unknown id, so find() takes fallback(); the motif must still be valid (src/shapes.js validateShapes).
//   node fallback-check.mjs
import { find } from './design.js';
import { GROUPS } from '../../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../../src/shapes.js';
let bad = 0;
for (const g of GROUPS) {
  const h = { id: 'unknown-' + g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center };
  let line;
  try {
    const r = find(h), P = makeShapePrint(h, { key: 'mosaic', name: 'Mosaic', shapes: r.shapes }), v = validateShapes(P), m = measureShapes(P);
    if (!v.ok) bad++;
    line = `valid ${v.ok} dark ${m.coverage.toFixed(3)} bare ${m.emptyDisc.toFixed(3)} solid ${m.darkDisc.toFixed(3)} commas ${r.info.commas} ${v.problems.join(' | ')}`;
  } catch (e) { bad++; line = 'THREW ' + e.message; }
  console.log(g.id.padEnd(6), line);
}
console.log(bad ? bad + ' FAILED' : 'all valid');
