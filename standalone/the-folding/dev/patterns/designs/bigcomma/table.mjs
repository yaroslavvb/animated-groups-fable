// dev/patterns/designs/bigcomma/table.mjs — the table of NOTES.md: the sheet's numbers (rows.json of proto.mjs) beside the design's own.
//   node dev/patterns/designs/bigcomma/table.mjs <rows.json>
import fs from 'node:fs';
import { GROUPS } from '../../../../src/groups.js';
import { find } from './design.js';
const rows = Object.fromEntries(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).map((r) => [r.id, r]));
console.log('| group | dark | bare ⌀ | solid ⌀ | pts | ms | comma: head ⌀, length, shape | eye ⌀ | dots ⌀ |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const g of GROUPS) {
  const r = rows[g.id], i = find(g).info;
  const shape = i.ab > 89.9 ? 'classic' : i.back >= 1.45 ? 'curled' : 'flat';
  console.log(`| ${g.id.replace(/\*/g, '\\*')} | ${r.coverage.toFixed(2)} | ${r.emptyDisc.toFixed(2)} | ${r.darkDisc.toFixed(2)} | ${r.verts} | ${r.ms} | ${(2 * i.head).toFixed(2)}, ${i.length.toFixed(2)}, ${shape}${i.pinned ? ', tip in a corner' : ''} | ${(2 * i.eye).toFixed(2)} | ${i.dots.map((d) => (2 * d).toFixed(2)).join(', ')} |`);
}
