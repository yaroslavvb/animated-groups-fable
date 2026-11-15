// designs/ripple/lab/prod.mjs — the design through the production module src/shapes.js (when it is there): makeShapePrint,
// validateShapes (the rules, the gap between copies) and measureShapes (coverage over one lattice cell, the two discs).
//   node dev/patterns/designs/ripple/lab/prod.mjs [--bare 1] [--turn 0.7]
import { GROUPS } from '../../../../../src/groups.js';
import { carried } from './raster.mjs';
import { find } from '../design.js';
const S = await import('../../../../../src/shapes.js');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
let bad = 0;
for (const g0 of GROUPS) {
  let g = g0;
  if (opt.turn !== undefined) g = carried(g0, +opt.turn, 1.37, [0.31, -0.23]);
  else if (opt.bare) g = { id: g0.id, e1: g0.e1, e2: g0.e2, reps: g0.reps, cellArea: g0.cellArea, domainArea: g0.domainArea, center: g0.center };
  try {
    const res = find(g), print = S.makeShapePrint(g, { key: 'ripple', name: 'ripples', shapes: res.shapes, info: res.info });
    const t0 = performance.now(), v = S.validateShapes(print), t1 = performance.now(), m = S.measureShapes(print, { center: g.center });
    if (!v.ok) bad++;
    console.log(g.id.padEnd(6), v.ok ? 'ok ' : 'BAD', 'gap', v.gap.toFixed(4), 'stab', v.stabilizer, '| dark', m.coverage, 'exact', m.coverageExact == null ? '-' : m.coverageExact.toFixed(3), 'bare', m.emptyDisc, 'solid', m.darkDisc, 'overlap', m.overlap, 'pts', m.verts, v.ok ? '' : '| ' + v.problems.slice(0, 3).join(' ; '), `(${(t1 - t0).toFixed(0)} ms)`);
  } catch (e) { bad++; console.log(g.id.padEnd(6), 'ERROR', String(e && e.message)); }
}
console.log(bad ? bad + ' group(s) fail' : 'all 17 pass the production rules');
