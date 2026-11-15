// dev/patterns/designs/bigcomma/validate.mjs — the design through the production validator (src/shapes.js validateShapes),
// for the 17 groups as the page has them and as the tests hand them over.   node dev/patterns/designs/bigcomma/validate.mjs
import { GROUPS } from '../../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../../src/shapes.js';
import { find, meta } from './design.js';
let bad = 0;
for (const g of GROUPS) for (const [name, given] of [['page', g], ['bare', { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center }]]) {
  try {
    const res = find(given), print = makeShapePrint(given, { key: meta.key, name: meta.label, shapes: res.shapes, info: res.info });
    const v = validateShapes(print, {}), m = process.argv.includes('--measure') ? measureShapes(print, {}) : null;
    if (!v.ok) bad++;
    console.log(g.id.padEnd(6), name, v.ok ? 'ok ' : 'NOT OK', 'gap', v.gap == null ? '-' : (+v.gap).toFixed(4), 'stabilizer', v.stabilizer, v.problems.join('; '), m ? JSON.stringify(m) : '');
  } catch (e) { bad++; console.log(g.id.padEnd(6), name, 'ERROR', String(e && e.message || e)); }
}
console.log(bad ? bad + ' not ok' : 'all ok');
