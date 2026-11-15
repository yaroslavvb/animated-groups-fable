// lab/dbg-o.mjs — why does a group get no seat? Runs seatSingle with relaxed limits and prints the best candidates.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
const id = process.argv[2] || 'o';
const g = BY_ID[id];
const T = D.seatTile(g);
for (const set of [{}, { rMin: 0.02 }, { rMin: 0.02, lenMin: 0.2 }, { rMin: 0.02, lenMin: 0.2, gap: 0.03 }]) {
  const K = { ...D.KNOBS, ...set };
  const s = D.seatSingle(g, T, K);
  console.log(JSON.stringify(set), s ? { r0: s.r0 / Math.sqrt(g.domainArea), D: s.D / Math.sqrt(g.domainArea), sweep: s.sweep, k: s.k, sgn: s.sgn, share: s.score, g: [s.g.a, s.g.b, s.g.c, s.g.d].map((v) => v.toFixed(2)).join(',') } : null);
}
