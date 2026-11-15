// lab/validate.mjs — the motif of every group through the production checks of src/shapes.js (validateShapes) and its
// exact dark share (the polygons' areas over the tile's area).
//   node dev/patterns/designs/paisley/lab/validate.mjs [--bare 1]
import { GROUPS } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../../src/shapes.js';
import { find } from '../design.js';
const bare = process.argv.includes('--bare');
let bad = 0, cmin = 1, cmax = 0, gmin = Infinity;
for (const G0 of GROUPS) {
  const G = bare ? { id: G0.id, e1: G0.e1, e2: G0.e2, reps: G0.reps, cellArea: G0.cellArea, domainArea: G0.domainArea, center: G0.center } : G0;
  const res = find(G), print = makeShapePrint(G0, { key: 'paisley', name: 'paisley', shapes: res.shapes }), v = validateShapes(print);
  const exact = print.polys.reduce((a, P) => a + (P.hole ? -P.area : P.area), 0) / (v.stabilizer * G0.domainArea);
  cmin = Math.min(cmin, exact); cmax = Math.max(cmax, exact); gmin = Math.min(gmin, v.gap);
  if (!v.ok) bad++;
  console.log(G0.id.padEnd(6), v.ok ? 'ok ' : 'BAD', 'gap', v.gap.toFixed(4), 'stab', v.stabilizer, 'dark (exact)', exact.toFixed(3), 'find says', res.info.cover, 'marks', res.info.marks, v.problems.join(' | '));
}
console.log(`bad ${bad}; dark ${cmin.toFixed(3)} .. ${cmax.toFixed(3)}; smallest gap ${gmin.toFixed(4)}`);
