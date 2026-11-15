// lab/splice.mjs — replace the lines [from, to] (1-based, inclusive) of design.js with the contents of a file.
//   node lab/splice.mjs <from> <to> <file>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), target = path.resolve(here, '../design.js');
const [from, to, file] = [+process.argv[2], +process.argv[3], process.argv[4]];
const lines = fs.readFileSync(target, 'utf8').split('\n');
const add = fs.readFileSync(path.resolve(file), 'utf8').replace(/\n$/, '').split('\n');
const out = lines.slice(0, from - 1).concat(add, lines.slice(to));
fs.writeFileSync(target, out.join('\n'));
console.log('replaced lines', from, '-', to, 'with', add.length, 'lines; now', out.length, 'lines');
