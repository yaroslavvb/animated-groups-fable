// dev/patterns/scratch-fixer3/copy-design.mjs — the fixer's copy (15 Nov 2026) of a shipped design into src/patterns/,
// as dev/patterns/scratch-integrator/copy-designs.mjs made them on 14 Nov: the file as it is, its imports rewritten from
// '../../../../src/<f>.js' to '../<f>.js', its first line naming its new place, two lines saying where it came from.
//   node dev/patterns/scratch-fixer3/copy-design.mjs paisley|soft|tomoe
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const JOBS = {
  paisley: { from: 'dev/patterns/designs/paisley/design.js', note: 'Shipped 14 Nov 2026, the pattern round, its table of grown marks added 15 Nov' },
  soft: { from: 'dev/patterns/designs/blobs/design.js', note: 'Shipped 14 Nov 2026, the pattern round' },
  tomoe: { from: 'dev/patterns/designs/tomoe/design.js', note: 'Shipped 14 Nov 2026, the pattern round' },
};
const key = process.argv[2], j = JOBS[key];
if (!j) throw new Error('which design? paisley, soft or tomoe');
const to = `src/patterns/${key}.js`;
const lines = fs.readFileSync(path.join(W, j.from), 'utf8').split('\n');
let n = 0;
const out = lines.map((l) => {
  if (!/^import /.test(l)) return l;
  const m = l.replace(/'\.\.\/\.\.\/\.\.\/\.\.\/src\/([a-z0-9_-]+\.js)'/, (_, f) => `'../${f}'`);
  if (m === l) throw new Error(`${j.from}: an import that is not of src/: ${l}`);
  n++;
  return m;
});
if (!n) throw new Error(`${j.from}: no import rewritten`);
out[0] = out[0].replace(/^\/\/ dev\/patterns\/designs\/[a-z]+\/design\.js — /, `// ${to} — `);
if (!out[0].startsWith(`// ${to}`)) out[0] = `// ${to} — ` + out[0].replace(/^\/\/ /, '');
while (out[0].length > 120 && /^\/\/ /.test(out[1])) {
  const cut = out[0].lastIndexOf(' ');
  out[1] = '// ' + out[0].slice(cut + 1) + ' ' + out[1].slice(3);
  out[0] = out[0].slice(0, cut);
}
const at = out.findIndex((l) => /^\/\/.*[.:]$/.test(l)) + 1;
// (the note, wrapped at 120 characters)
const words = `(${j.note}: ${j.from} but for its imports; test/patterns-shipped.test.js holds the two to the same motif in every group. Its lab and notes stay in that folder.)`.split(' ');
const note = [];
let line = '//';
for (const w of words) { if ((line + ' ' + w).length > 120) { note.push(line); line = '//'; } line += ' ' + w; }
note.push(line);
out.splice(at, 0, ...note);
const text = out.join('\n');
if (!new RegExp(`meta = \\{ key: '${key}'`).test(text)) throw new Error(`${j.from}: meta.key is not '${key}'`);
fs.writeFileSync(path.join(W, to), text);
console.log(`${j.from} -> ${to}: ${n} imports rewritten, ${text.length} bytes`);
