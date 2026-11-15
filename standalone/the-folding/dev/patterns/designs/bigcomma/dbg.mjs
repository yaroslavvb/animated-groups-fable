// dev/patterns/designs/bigcomma/dbg.mjs — the candidates of a group, with what each is worth.
//   node dev/patterns/designs/bigcomma/dbg.mjs '*2222,442' [knob=value,...] [bare]
// "bare": the group as the tests hand it over (no presets: the room is the roundest Dirichlet tile).
import { BY_ID } from '../../../../src/groups.js';
import { find, KNOBS, roomOf } from './design.js';
KNOBS.debug = true;
for (const kv of (process.argv[3] || '').split(',')) { const [k, v] = kv.split('='); if (k && v !== undefined) KNOBS[k] = +v; }
for (const id of process.argv[2].split(',')) {
  const g = BY_ID[id], given = process.argv.includes('bare') ? { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center } : g;
  const r = find(given);
  console.log(id, 'room', JSON.stringify(roomOf(given).poly.map((p) => p.map((v) => +v.toFixed(3)))));
  console.log(id, JSON.stringify({ ...r.info, log: undefined }));
  for (const l of r.info.log) console.log('   ', l);
}
