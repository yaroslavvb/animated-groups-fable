// lab/fresh.mjs — do the delivered numbers (rows.json of proto.mjs) belong to design.js as it is now? Compares the
// vertex count of every group, and prints the worst numbers of the file.
//   node dev/patterns/designs/paisley/lab/fresh.mjs <rows.json>
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let stale = 0;
const w = { coverageMin: 1, coverageMax: 0, emptyDiscMax: 0, darkDiscMax: 0, overlapMax: 0, vertsMax: 0, msMax: 0 };
for (const r of rows) {
  const v = find(BY_ID[r.id]).shapes.reduce((a, s) => a + s.pts.length, 0);
  if (v !== r.verts) { stale++; console.log('STALE', r.id, 'file', r.verts, 'now', v); }
  w.coverageMin = Math.min(w.coverageMin, r.coverage); w.coverageMax = Math.max(w.coverageMax, r.coverage); w.emptyDiscMax = Math.max(w.emptyDiscMax, r.emptyDisc);
  w.darkDiscMax = Math.max(w.darkDiscMax, r.darkDisc); w.overlapMax = Math.max(w.overlapMax, r.overlap); w.vertsMax = Math.max(w.vertsMax, r.verts); w.msMax = Math.max(w.msMax, r.ms);
}
console.log(stale ? `${stale} rows are stale` : `all ${rows.length} rows belong to the design as it is`, JSON.stringify(w));
