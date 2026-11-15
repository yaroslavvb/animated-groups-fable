// lab/dbg-pair.mjs — the pair seat of a chamber with variations of the knobs: area, bare probe, the winner's shape.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
const id = process.argv[2] || '*442';
const g = BY_ID[id], u = Math.sqrt(g.domainArea);
const T = D.seatTile(g);
const sets = [{}, { pinIn: 0.05 }, { pairGap: 0.06, pinIn: 0.05 }, { rMin: 0.07 }, { probeB0: 0.4, probeW: 8 }];
for (const set of sets) {
  const K = { ...D.KNOBS, ...set };
  const t0 = Date.now();
  const s = D.seatPair(g, T, K);
  const ms = Date.now() - t0;
  console.log(JSON.stringify(set), ms + 'ms', s ? JSON.stringify({ r0: +(s.r0 / u).toFixed(3), D: +(s.D / u).toFixed(3), sa: +s.sa.toFixed(2), sb: +s.sb.toFixed(2), ra: +s.ra.toFixed(2), rb: +s.rb.toFixed(2), m: s.m, sgn: s.sgn, area: +s.area.toFixed(3), bare0: +s.bare0.toFixed(3), score: +s.score.toFixed(3) }) : null);
}
