// scratch: the foot's own measurements per group (info.feet of find), in tile sizes
//   node dev/patterns/designs/feet/scratch/info.mjs [--ids 632,3*3]
import { GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const f = (v) => (typeof v === 'number' ? v.toFixed(3) : v);
for (const g of GROUPS) {
  if (!ids.includes(g.id)) continue;
  const r = find(g);
  for (const ft of r.info.feet) console.log(g.id.padEnd(6), Object.entries(ft).map(([k, v]) => `${k} ${f(v)}`).join('  '), ` coverage ${f(r.info.coverage)} lean ${r.info.lean} wider ${f(r.info.wider)}`);
}
