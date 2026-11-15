// lab/dbg-pinonly.mjs — the pair seat with only the corner-pinned tails (the free family switched off), with relaxations.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
const id = process.argv[2] || '*442';
const g = BY_ID[id], u = Math.sqrt(g.domainArea), T = D.seatTile(g);
for (const set of [{}, { rMin: 0.06 }, { rMin: 0.06, pinSweep: [0.6, 5.5] }, { rMin: 0.06, pinSweep: [0.6, 5.5], pinMs: [0.25, 0.5, 1, 2, 4] }, { rMin: 0.04, pinSweep: [0.3, 6], pinIn: 0.05, pairGap: 0.06, lenMin: 0.4 }]) {
  const K = { ...D.KNOBS, sweeps: [], ...set };
  const s = D.seatPair(g, T, K);
  console.log(JSON.stringify(set), s ? JSON.stringify({ r0: +(s.r0 / u).toFixed(3), D: +(s.D / u).toFixed(3), sa: +s.sa.toFixed(2), sb: +s.sb.toFixed(2), ra: +s.ra.toFixed(2), rb: +s.rb.toFixed(2), m: s.m, area: +s.area.toFixed(3), bare0: +s.bare0.toFixed(3) }) : null);
}
