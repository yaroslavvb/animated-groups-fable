// polish/setrows.mjs — put rows into the table of design.js IN PLACE (the other rows and every comment stay):
//   node polish/setrows.mjs <rows.json>        rows.json: { id: stroke | [stroke, ...] | { stroke } }
// A row that is one stroke is written on one line, an array of strokes on several. Numbers to 4 decimals.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), file = path.join(here, '..', 'design.js');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const f = (v) => String(Math.round(v * 1e4) / 1e4);
const one = (st) => {
  let row = `{ p: [${st.p.map(f).join(', ')}], r0: ${f(st.r0 ?? st.rh)}, rh: ${f(st.rh)}, th: ${f(st.th || 0)}, q: ${f(st.q || 1)}`;
  if (st.rt !== undefined) row += `, rt: ${f(st.rt)}`;
  if (st.lobes && st.lobes.length) row += `, lobes: [${st.lobes.map((l) => `[${l.map(f).join(', ')}]`).join(', ')}]`;
  if (st.eye) row += `, eye: [${st.eye.map(f).join(', ')}]`;
  if (st.cover !== undefined) row += `, cover: ${f(st.cover)}`;
  return row + ' }';
};
let src = fs.readFileSync(file, 'utf8');
const a = src.indexOf('  // TABLE-BEGIN'), b = src.indexOf('  // TABLE-END');
if (a < 0 || b < 0) { console.error('no table marks in design.js'); process.exit(1); }
const lines = src.slice(a, b).split('\n');
for (let [id, st] of Object.entries(rows)) {
  if (st && !Array.isArray(st) && st.stroke) st = st.stroke;
  if (Array.isArray(st) && st.length === 1) st = st[0];
  const key = /^[a-z_$][a-z0-9_$]*$/i.test(id) ? id : `'${id}'`;
  const text = Array.isArray(st) ? `  ${key}: [\n${st.map((s) => '    ' + one(s)).join(',\n')},\n  ],` : `  ${key}: ${one(st)},`;
  const i = lines.findIndex((l) => l.startsWith(`  ${key}: `));
  if (i < 0) { lines.splice(lines.length - 1, 0, ...text.split('\n')); console.log(`added ${id}`); continue; }
  let j = i;
  if (lines[i].trimEnd().endsWith('[')) { while (j < lines.length && lines[j] !== '  ],') j++; }
  lines.splice(i, j - i + 1, ...text.split('\n'));
  console.log(`set ${id}`);
}
src = src.slice(0, a) + lines.join('\n') + src.slice(b);
fs.writeFileSync(file, src);
