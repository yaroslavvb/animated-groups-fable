// crit/timing.mjs — where find() spends its time (KNOBS.debug), per group: node crit/timing.mjs [ids] [knob=v,...]
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { find, KNOBS } from '../design.js';
const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
if (process.argv[3]) for (const kv of process.argv[3].split(',')) { const [k, v] = kv.split('='); KNOBS[k] = v === 'true' ? true : v === 'false' ? false : +v; }
KNOBS.debug = true;
const bare = process.argv.includes('--bare');
for (const id of ids) {
  const g0 = BY_ID[id], g = bare ? { id: g0.id, e1: g0.e1, e2: g0.e2, reps: g0.reps, cellArea: g0.cellArea, domainArea: g0.domainArea, center: g0.center } : g0;
  find(g);
  const t0 = performance.now(), r = find(g), ms = performance.now() - t0;
  const i = r.info;
  console.log(id.padEnd(6), 'ms', ms.toFixed(0).padStart(4), JSON.stringify(i.ms || {}), 'D', i.dark, 'B', i.bare, 'dots', JSON.stringify(i.dots), 'lam', i.lam, 'ab', i.ab, 'head', i.head);
  if (process.argv.includes('--log')) for (const l of i.log || []) if (l.startsWith('grown')) console.log('   ', l);
}
