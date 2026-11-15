// lab/settable.mjs — write the strokes of a { id: stroke } file into the table of design.js (between its two marks).
//   node lab/settable.mjs <strokes.json> [--merge 1]
// A stroke may be an array of strokes (one blob of each per tile). --merge 1: keep the rows of the table that the file
// does not name (the table is read from design.js's STROKES).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from '../../../../../src/groups.js';
import { STROKES } from '../design.js';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.join(here, '..', 'design.js');
let strokes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (process.argv[3] === '--merge' && process.argv[4] === '1') strokes = { ...Object.fromEntries(GROUPS.map((g) => [g.id, STROKES[g.id]]).filter((e) => e[1])), ...strokes };
const f = (v) => String(Math.round(v * 1000) / 1000);
const one = (st) => {
  let row = `{ p: [${st.p.map(f).join(', ')}], r0: ${f(st.r0 ?? st.rh)}, rh: ${f(st.rh)}, th: ${f(st.th || 0)}, q: ${f(st.q || 1)}`;
  if (st.rt !== undefined) row += `, rt: ${f(st.rt)}`;
  if (st.lobes && st.lobes.length) row += `, lobes: [${st.lobes.map((l) => `[${l.map(f).join(', ')}]`).join(', ')}]`;
  if (st.cover !== undefined) row += `, cover: ${f(st.cover)}`;
  return row + ' }';
};
const lines = [];
for (const g of GROUPS) {
  let st = strokes[g.id];
  if (st && !Array.isArray(st) && st.stroke) st = st.stroke;
  if (!st) continue;
  const key = /^[a-z_$][a-z0-9_$]*$/i.test(g.id) ? g.id : `'${g.id}'`;
  lines.push(Array.isArray(st) ? `  ${key}: [\n${st.map((s) => '    ' + one(s)).join(',\n')},\n  ],` : `  ${key}: ${one(st)},`);
}
const src = fs.readFileSync(file, 'utf8'), a = src.indexOf('  // TABLE-BEGIN'), b = src.indexOf('  // TABLE-END');
if (a < 0 || b < 0) { console.error('no table marks in design.js'); process.exit(1); }
const head = src.slice(a, src.indexOf('\n', a) + 1);
fs.writeFileSync(file, src.slice(0, a) + head + lines.join('\n') + (lines.length ? '\n' : '') + src.slice(b));
console.log(`wrote ${lines.length} strokes into design.js`);
