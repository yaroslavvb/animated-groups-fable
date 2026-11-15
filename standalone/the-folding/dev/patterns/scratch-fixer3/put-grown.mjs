// dev/patterns/scratch-fixer3/put-grown.mjs — the fixer (15 Nov 2026): the GROWN table made on the mini (grown-table.js
// in OUT/fixer3) into dev/patterns/designs/paisley/design.js, in place of the `const GROWN = [...];` there.
//   node dev/patterns/scratch-fixer3/put-grown.mjs [table.js]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const table = fs.readFileSync(process.argv[2] || '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3/grown-table.js', 'utf8').trim();
if (!/^const GROWN = \[\n[\s\S]*\n\];$/.test(table)) throw new Error('not a GROWN table');
const file = path.join(W, 'dev/patterns/designs/paisley/design.js');
const src = fs.readFileSync(file, 'utf8');
const re = /^const GROWN = \[[\s\S]*?^\];$/m;
if (!re.test(src)) throw new Error('design.js has no `const GROWN = [...];`');
const out = src.replace(re, () => table);
fs.writeFileSync(file, out);
console.log(`design.js: GROWN put in (${table.split('\n').length} lines); ${src.length} -> ${out.length} bytes`);
