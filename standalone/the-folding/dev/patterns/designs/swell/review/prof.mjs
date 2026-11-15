// review/prof.mjs <id> — where find(group) spends its time (node, after a warm-up run): the seat, the swell(s)
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';

const id = process.argv[2] || '**', g = BY_ID[id], K = D.KNOBS;
D.build(g);                                                     // warm-up (JIT)
const t0 = performance.now();
const T = D.seatTile(g);
const t1 = performance.now();
const seat = D.seatSingle(g, T, K);
const t2 = performance.now();
const b = D.build(g);
const t3 = performance.now();
console.log(id, 'tile', (t1 - t0).toFixed(1), 'ms  seatSingle', (t2 - t1).toFixed(1), 'ms  whole build', (t3 - t2).toFixed(1), 'ms',
  ' seat', seat ? seat.g && (seat.g.a * seat.g.d - seat.g.b * seat.g.c > 0 ? 'direct' : 'mirrored') : null, ' info', JSON.stringify(b.info.comma));
