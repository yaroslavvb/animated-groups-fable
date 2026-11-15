// scratch: replace the lines [from, to] (1-based, inclusive) of a file by the contents of another file.
//   node splice.mjs <file> <from> <to> <replacement file>
import fs from 'node:fs';
const [file, from, to, repl] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split('\n');
const add = fs.readFileSync(repl, 'utf8').replace(/\n$/, '').split('\n');
lines.splice(+from - 1, +to - +from + 1, ...add);
fs.writeFileSync(file, lines.join('\n'));
console.log(`replaced ${+to - +from + 1} lines by ${add.length}`);
