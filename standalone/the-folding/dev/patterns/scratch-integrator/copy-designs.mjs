// dev/patterns/scratch-integrator/copy-designs.mjs — the integrator's copy of the three shipped designs into src/patterns/
// (14 Nov 2026): each file as it is, its imports rewritten from '../../../../src/<f>.js' to '../<f>.js', its first line
// naming its new place, and one line saying where it came from. Run again to refresh the copies from the design folders.
//   node dev/patterns/scratch-integrator/copy-designs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const JOBS = [
  { from: 'dev/patterns/designs/paisley/design.js', to: 'src/patterns/paisley.js', key: 'paisley' },
  { from: 'dev/patterns/designs/blobs/design.js', to: 'src/patterns/soft.js', key: 'soft' },
  { from: 'dev/patterns/designs/tomoe/design.js', to: 'src/patterns/tomoe.js', key: 'tomoe' },
];
for (const j of JOBS) {
  const src = fs.readFileSync(path.join(W, j.from), 'utf8');
  const lines = src.split('\n');
  // the imports: only the page's own modules, one directory up from src/patterns/
  let n = 0;
  const out = lines.map((l) => {
    if (!/^import /.test(l)) return l;
    const m = l.replace(/'\.\.\/\.\.\/\.\.\/\.\.\/src\/([a-z0-9_-]+\.js)'/, (_, f) => `'../${f}'`);
    if (m === l) throw new Error(`${j.from}: an import that is not of src/: ${l}`);
    n++;
    return m;
  });
  if (!n) throw new Error(`${j.from}: no import rewritten`);
  // the first line: the file's own name
  out[0] = out[0].replace(/^\/\/ dev\/patterns\/designs\/[a-z]+\/design\.js — /, `// src/patterns/${j.key}.js — `);
  if (!out[0].startsWith(`// src/patterns/${j.key}.js`)) out[0] = `// src/patterns/${j.key}.js — ` + out[0].replace(/^\/\/ /, '');
  // (a first line made too long by the name: its last words go to the second line)
  while (out[0].length > 120 && /^\/\/ /.test(out[1])) {
    const cut = out[0].lastIndexOf(' ');
    out[1] = '// ' + out[0].slice(cut + 1) + ' ' + out[1].slice(3);
    out[0] = out[0].slice(0, cut);
  }
  // (after the first sentence of the header)
  const at = out.findIndex((l) => /^\/\/.*[.:]$/.test(l)) + 1;
  out.splice(at, 0, `// (Shipped 14 Nov 2026, the pattern round: ${j.from} as it was then, but for its imports;`,
    `// test/patterns-shipped.test.js holds the two to the same motif in every group. Its lab and notes stay in that folder.)`);
  const text = out.join('\n');
  if (!new RegExp(`meta = \\{ key: '${j.key}'`).test(text)) throw new Error(`${j.from}: meta.key is not '${j.key}'`);
  fs.writeFileSync(path.join(W, j.to), text);
  console.log(`${j.from} -> ${j.to}: ${n} imports rewritten, ${text.length} bytes`);
}
