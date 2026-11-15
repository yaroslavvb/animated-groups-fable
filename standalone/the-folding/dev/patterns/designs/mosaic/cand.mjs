// cand.mjs — the commas of the table as a candidate file and back (dev). A candidate file is JSON { id: [hx, hy, dir,
// len, t0, t1, rad, pow, q?] }: the comma in the cell's own frame (origin p, the WORLD axes, unit = the tile size,
// heading from the world x axis), what view2.mjs takes as "L". Only the FIRST comma of a group (TABLE); a second one
// (MORE, run 3's *x) is written by hand (r3/torows.mjs).
//   node cand.mjs export <file.json>            the table as it is
//   node cand.mjs apply <file.json>             write the table of design.js from the file (rows: the group's frame)
import fs from 'node:fs';
import { GROUPS } from '../../../../src/groups.js';
import { TABLE, frameOf, toWorld, toFrame } from './design.js';
const [cmd, file] = process.argv.slice(2), r4 = (v) => +(+v).toFixed(4);
if (cmd === 'export') {
  const out = {};
  for (const g of GROUPS) {
    const row = TABLE[g.id], F = frameOf(g), p = toWorld(g, F.A, [row[0], row[1]]), h = toWorld(g, F.A, [row[2], row[3]]);
    out[g.id] = [r4((h[0] - p[0]) / F.size), r4((h[1] - p[1]) / F.size), r4(row[4] + F.e1ang), row[5], row[6], row[7], row[8], row[9] || 1, ...(row[10] ? [row[10]] : [])];
  }
  fs.writeFileSync(file, '{\n' + Object.entries(out).map(([k, v]) => ` "${k}": ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
  console.log('wrote', file);
} else if (cmd === 'apply') {
  const L = JSON.parse(fs.readFileSync(file, 'utf8')), dfile = new URL('./design.js', import.meta.url).pathname;
  const rows = GROUPS.map((g) => {
    const row = TABLE[g.id], v = L[g.id] || null;
    if (!v) return `  '${g.id}': [${row.map(r4).join(', ')}],`;
    const F = frameOf(g), p = toWorld(g, F.A, [row[0], row[1]]), h = toFrame(g, F.A, [p[0] + F.size * v[0], p[1] + F.size * v[1]]);
    const q = v[8] || row[10] || 1;                                  // run 3: how late the tail curls (1: run 2)
    return `  '${g.id}': [${[row[0], row[1], h[0], h[1], v[2] - F.e1ang, v[3], v[4], v[5], v[6], v[7] || 1, ...(q !== 1 ? [q] : [])].map(r4).join(', ')}],`;
  });
  let s = fs.readFileSync(dfile, 'utf8');
  const a = s.indexOf('// KNOBS-BEGIN'), b = s.indexOf('// KNOBS-END');
  if (a < 0 || b < 0) throw new Error('markers not found');
  s = s.slice(0, a) + '// KNOBS-BEGIN\nexport const TABLE = {\n' + rows.join('\n') + '\n};\n' + s.slice(b);
  fs.writeFileSync(dfile, s);
  console.log('wrote', rows.length, 'rows into design.js');
} else console.log('usage: node cand.mjs export|apply <file.json>');
