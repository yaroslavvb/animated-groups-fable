// designs/spiral/rows.mjs — the numbers of a proto.mjs rows.json as a table, and the worst of them over the groups.
//   node dev/patterns/designs/spiral/rows.mjs ~/drive.unsynced/artifacts/the-folding-patterns/spiral/rows.json
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log('| group | dark | bare ⌀ | solid ⌀ | overlap | verts | ms | turns | hand |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} | ${r.coverage} | ${r.emptyDisc} | ${r.darkDisc} | ${r.overlap} | ${r.verts} | ${r.ms} | ${r.info && r.info.turns} | ${r.info && (r.info.snail ? 'snail ' : '') + r.info.hand} |`);
const col = (k) => rows.map((r) => r[k]);
console.log(JSON.stringify({ coverageMin: Math.min(...col('coverage')), coverageMax: Math.max(...col('coverage')), emptyDiscMax: Math.max(...col('emptyDisc')), darkDiscMax: Math.max(...col('darkDisc')), overlapMax: Math.max(...col('overlap')), vertsMax: Math.max(...col('verts')), msMax: Math.max(...col('ms')) }));
