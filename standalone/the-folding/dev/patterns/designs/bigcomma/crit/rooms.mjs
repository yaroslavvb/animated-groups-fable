// crit/rooms.mjs — the rooms of design.v1.js (page and bare), in tile sizes, with corner angles, and the chosen comma.
import { GROUPS } from '../../../../../src/groups.js';
import { find, roomOf } from '../design.v1.js';
const DEG = Math.PI / 180;
for (const g of GROUPS) {
  const size = Math.sqrt(g.domainArea);
  for (const [name, given] of [['page', g], ['bare', { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center }]]) {
    const room = roomOf(given);
    const t0 = performance.now(); const r = find(given); const ms = performance.now() - t0;
    const sides = room.edges.map((e) => (e.len / size).toFixed(2)).join(' ');
    const angs = room.verts.map((v) => (v.angle / DEG).toFixed(0)).join(' ');
    console.log(g.id.padEnd(6), name, 'sides', sides, '| angles', angs, '|', JSON.stringify({ ...r.info, log: undefined, cands: undefined }), ms.toFixed(0) + 'ms');
  }
}
