// lab/prof.mjs — where find() spends its time (node; the browser on the mini is about 3x faster than this Mac)
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { KNOBS, seatTile, seatStroke, strokeDiscs, field, swell } from '../design.js';
if (process.argv[3]) for (const kv of process.argv[3].split(',')) { const [k, v] = kv.split('='); KNOBS[k] = v.includes(';') ? v.split(';').map(Number) : Number.isNaN(+v) ? v : +v; }
const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
const t = () => performance.now();
for (let rep = 0; rep < 2; rep++) for (const id of ids) {
  const g = BY_ID[id];
  const t0 = t(), T = seatTile(g), t1 = t(), st = seatStroke(g, T), t2 = t(), S = strokeDiscs(st), F = field(g, S), t3 = t(), W = swell(g, S), t4 = t();
  if (rep) console.log(id.padEnd(6), 'tile', (t1 - t0).toFixed(1), 'seat', (t2 - t1).toFixed(1), 'field', (t3 - t2).toFixed(1), 'swell(all)', (t4 - t3).toFixed(1), 'nodes', F.nx * F.ny, 'copies', F.copies);
}
