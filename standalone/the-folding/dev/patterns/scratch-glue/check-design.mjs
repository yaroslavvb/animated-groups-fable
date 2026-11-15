// check-design.mjs — a design on all 17 groups, in node: find, makeShapePrint, validateShapes, the share of dark, times.
//   node dev/patterns/scratch-glue/check-design.mjs designs/stress/design.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from '../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes, bakeShapes } from '../../../src/shapes.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const mod = await import(path.resolve(here, '..', process.argv[2] || 'designs/stress/design.js'));
let bad = 0;
for (const g of GROUPS) {
  try {
    const t0 = performance.now(), res = mod.find(g), t1 = performance.now();
    const P = makeShapePrint(g, { key: mod.meta.key, shapes: res.shapes, info: res.info }), t2 = performance.now();
    const V = validateShapes(P), t3 = performance.now(), M = measureShapes(P, { per: 30 });
    const t4 = performance.now(); bakeShapes(P); const t5 = performance.now();
    if (!V.ok) bad++;
    console.log(g.id.padEnd(6), `${P.verts} verts, ${P.polys.length} polys, stabiliser ${V.stabilizer}, gap ${V.gap.toFixed(4)}, dark ${(100 * (M.coverageExact ?? M.coverage)).toFixed(1)} %, bare ${M.emptyDisc}, R ${(P.R / P.size).toFixed(3)} tiles; find ${(t1 - t0).toFixed(1)} ms, print ${(t2 - t1).toFixed(1)}, validate ${(t3 - t2).toFixed(1)}, bake ${(t5 - t4).toFixed(1)}`, V.ok ? 'ok' : 'PROBLEMS: ' + V.problems.join(' | '));
  } catch (e) { bad++; console.log(g.id.padEnd(6), 'THROWS', String(e.message).split('\n')[0]); }
}
console.log(bad ? `${bad} groups with problems` : 'all 17 keep the rules');
