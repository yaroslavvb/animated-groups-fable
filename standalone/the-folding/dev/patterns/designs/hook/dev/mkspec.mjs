// dev/mkspec.mjs — write picks into the SPEC table of design.js: node mkspec.mjs A:o:1 M:**:3 ...   (file:id:index)
// Entries of groups that are not named stay as they are. The table is kept in the display order of the groups.
import fs from 'node:fs';
import { GROUPS } from '../../../../../src/groups.js';
const file = new URL('../design.js', import.meta.url);
let src = fs.readFileSync(file, 'utf8');
const m = src.match(/export const SPEC = \{\n([\s\S]*?)\n?\};\n/);
if (!m) throw new Error('no SPEC block');
const cur = {};
for (const line of m[1].split('\n')) { const k = line.match(/^\s*'([^']+)':\s*(\{.*\}),?\s*$/); if (k) cur[k[1]] = k[2]; }
const order = ['B', 'th', 'a', 'phi', 'u', 'phi2', 'b', 'r', 'rt', 'ta', 'rh', 'hb', 'fil', 'gap', 'rd', 'dr', 'dg', 'dx', 'dots'];
const fmt = (sp) => '{ ' + order.filter((k) => sp[k] !== undefined).map((k) => k + ': ' + JSON.stringify(sp[k]).replace(/,/g, ', ')).join(', ') + ' }';
for (const a of process.argv.slice(2)) {
  const [name, id, k] = a.split(':');
  const f = JSON.parse(fs.readFileSync(new URL('./out/' + name + '.json', import.meta.url)));
  const sp = { ...f[id][+k] }; delete sp._m; delete sp._from;
  cur[id] = fmt(sp);
}
const w = Math.max(...GROUPS.map((g) => g.id.length));
const lines = GROUPS.filter((g) => cur[g.id]).map((g) => `  '${g.id}':${' '.repeat(w - g.id.length + 1)}${cur[g.id]},`);
src = src.replace(m[0], 'export const SPEC = {\n' + lines.join('\n') + '\n};\n');
fs.writeFileSync(file, src);
console.log(lines.join('\n'));
