// lab/r3/same.mjs — two design files give the very same motif (every point) in all 17 groups, with presets and without.
//   node lab/r3/same.mjs [a.js] [b.js]      (relative to designs/paisley/; default design.js and design.lab.js)
import { GROUPS } from '../../../../../../src/groups.js';
const A = await import('../../' + (process.argv[2] || 'design.js')), B = await import('../../' + (process.argv[3] || 'design.lab.js'));
let bad = 0;
for (const g of GROUPS) for (const bare of [false, true]) {
  const G = bare ? { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center } : g;
  const a = A.find(G).shapes, b = B.find(G).shapes;
  const same = a.length === b.length && a.every((s, i) => s.pts.length === b[i].pts.length && s.pts.every((p, j) => p[0] === b[i].pts[j][0] && p[1] === b[i].pts[j][1]));
  if (!same) { bad++; console.log('DIFFERENT', g.id, bare ? 'without presets' : 'with presets'); }
}
console.log(bad ? `${bad} differ` : 'the same motifs in all 34 cases');
