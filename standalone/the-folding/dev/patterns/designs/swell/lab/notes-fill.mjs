// lab/notes-fill.mjs — replace the numbers table of NOTES.md (between its header row and the next blank line).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const notes = new URL('../NOTES.md', import.meta.url), rows = process.argv[2];
const table = execFileSync(process.execPath, [new URL('./notes-table.mjs', import.meta.url).pathname, rows], { encoding: 'utf8' }).trimEnd();
let s = fs.readFileSync(notes, 'utf8');
const head = '| group | dark | bare ⌀ | solid ⌀ | pts | ms | nesting | λ | channel | head r |\n|---|---|---|---|---|---|---|---|---|---|\n';
const a = s.indexOf(head);
if (a < 0) throw new Error('no table');
const b = s.indexOf('\n\n', a + head.length);
s = s.slice(0, a + head.length) + table + s.slice(b);
s = s.replace('(λ and channel: `info`; "—": see `rows.json`, the value changed with the last two knobs. head r: before the lean.)',
  '(nesting, λ, channel, head r: `info` of `rows.json`; λ 1 with a wider channel: the commas fill their rooms; head r before the lean.)');
fs.writeFileSync(notes, s);
console.log('table written');
