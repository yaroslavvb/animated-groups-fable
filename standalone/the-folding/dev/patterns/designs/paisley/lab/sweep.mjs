// lab/sweep.mjs — the design's own numbers for all 17 groups under several settings of KNOBS, side by side.
//   node dev/patterns/designs/paisley/lab/sweep.mjs '{"bigMargin":0.035}' '{"bigMargin":0.08}' ...
// (the numbers are find()'s own estimates on its grid: the kit's bare disc is up to 0.05 larger)
import { GROUPS } from '../../../../../src/groups.js';
import { find, KNOBS, resetShapes } from '../design.js';
const base = JSON.parse(JSON.stringify(KNOBS));
const sets = process.argv.slice(2).map((s) => JSON.parse(s));
if (!sets.length) sets.push({});
for (const set of sets) {
  for (const k of Object.keys(base)) KNOBS[k] = JSON.parse(JSON.stringify(base[k]));
  for (const [k, v] of Object.entries(set)) { if (v && typeof v === 'object') Object.assign(KNOBS[k], v); else KNOBS[k] = v; }
  resetShapes();
  let cmin = 1, cmax = 0, bmax = 0, marks = 0, tiny = 0, ms = 0, row = '';
  for (const g of GROUPS) {
    find(g);
    const t0 = performance.now(), r = find(g), dt = performance.now() - t0, I = r.info;
    cmin = Math.min(cmin, I.cover); cmax = Math.max(cmax, I.cover); bmax = Math.max(bmax, I.bare); marks += I.marks; ms = Math.max(ms, dt);
    const t = I.long.filter((l) => l < 0.2).length; tiny += t;
    row += `${g.id}:${(I.cover * 100).toFixed(0)}/${(I.bare * 100).toFixed(0)}/${I.marks}${t ? 't' + t : ''} `;
  }
  console.log(JSON.stringify(set));
  console.log('   cover', cmin.toFixed(3), '..', cmax.toFixed(3), ' bare max', bmax.toFixed(3), ' marks', marks, ' tiny', tiny, ' ms max', ms.toFixed(0));
  console.log('   ' + row);
}
