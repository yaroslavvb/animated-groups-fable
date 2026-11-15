// scratch: the production check (src/shapes.js validateShapes, measureShapes) of the feet design: all 17 groups as
// they are, and turned, scaled and shifted copies without presets (as the tests hand them over).
//   node dev/patterns/designs/feet/scratch/validate.mjs [--ids o,632] [--measure 1]
import { GROUPS } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../../../src/shapes.js';
import { find, meta } from '../design.js';
import { moved } from './moved.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const places = [null, [0.7, 1.7, [3.1, -2.2]], [2.9, 0.31, [-40, 17]], [-1.234, 12, [1000, -2000]]];
let bad = 0;
console.log(`${meta.key} / ${meta.label} (${meta.label.length} chars) / ${meta.hint}`);
for (const g0 of GROUPS) {
  if (!ids.includes(g0.id)) continue;
  const line = [];
  places.forEach((pl, k) => {
    const g = pl ? moved(g0, ...pl) : g0;
    try {
      const res = find(g);
      const print = makeShapePrint(g, { key: meta.key, name: meta.key, shapes: res.shapes, info: res.info });
      const v = validateShapes(print);
      let m = '';
      if (opt.measure && !k) { const M = measureShapes(print); m = ` dark ${M.coverage.toFixed(3)} bare ${M.emptyDisc.toFixed(3)} solid ${M.darkDisc.toFixed(3)}`; }
      line.push(`${k ? 'moved' + k : 'as is'}: ${v.ok ? 'ok' : 'PROBLEMS ' + v.problems.join('; ')} (gap ${v.gap.toFixed(3)}, stabilizer ${v.stabilizer}, ${print.verts} pts)${m}`);
      if (!v.ok) bad++;
    } catch (e) { line.push(`${k ? 'moved' + k : 'as is'}: THROWS ${e && e.message}`); bad++; }
  });
  console.log(g0.id.padEnd(6), line.join(' | '));
}
console.log(bad ? `${bad} PROBLEMS` : 'validateShapes: all ok');
