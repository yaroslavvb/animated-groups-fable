// lab/table.mjs — the table of NOTES.md: the kit's numbers (rows.json of proto.mjs) beside find()'s own account.
//   node dev/patterns/designs/paisley/lab/table.mjs <rows.json>
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../../src/shapes.js';
import { find } from '../design.js';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log('| group | dark | dark (exact) | bare ⌀ | solid ⌀ | gap | pts | ms | marks | lengths of the marks | curl e of the big one | starts tried |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
const w = { cov: [1, 0], bare: 0, solid: 0, ms: 0, verts: 0, gap: 9, main: 9 };
for (const r of rows) {
  const G = BY_ID[r.id], res = find(G), I = res.info, print = makeShapePrint(G, { key: 'paisley', name: 'paisley', shapes: res.shapes }), v = validateShapes(print);
  const exact = print.polys.reduce((a, P) => a + P.area, 0) / G.domainArea;
  console.log(`| ${G.label} | ${r.coverage.toFixed(2)} | ${exact.toFixed(3)} | ${r.emptyDisc.toFixed(2)} | ${r.darkDisc.toFixed(2)} | ${v.gap.toFixed(3)} | ${r.verts} | ${r.ms} | ${I.marks} | ${I.long.join(', ')} | ${I.e[0]} | ${I.tried.length} |`);
  w.cov = [Math.min(w.cov[0], r.coverage), Math.max(w.cov[1], r.coverage)]; w.bare = Math.max(w.bare, r.emptyDisc); w.solid = Math.max(w.solid, r.darkDisc); w.ms = Math.max(w.ms, r.ms); w.verts = Math.max(w.verts, r.verts); w.gap = Math.min(w.gap, v.gap); w.main = Math.min(w.main, I.long[0]);
}
console.log('\nworst:', JSON.stringify(w));
