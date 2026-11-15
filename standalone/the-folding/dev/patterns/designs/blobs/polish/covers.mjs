// polish/covers.mjs — the bare disc of a group's row (design.js STROKES, or a strokes file) at several dark shares.
//   node polish/covers.mjs --ids '2*22,4*2' [--covers 0.5,0.53,0.56] [--strokes file.json] [--h 0.016]
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { STROKES } from '../design.js';
import { analyse2 } from './an2.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const over = opt.strokes ? JSON.parse(fs.readFileSync(opt.strokes, 'utf8')) : {};
const covers = (opt.covers || '0.5,0.53,0.56,0.6').split(',').map(Number), h = +opt.h || 0.016;
for (const id of opt.ids.split(',')) {
  const st = over[id] || STROKES[id];
  const cells = covers.map((cv) => { const m = analyse2(BY_ID[id], st, { h, cover: cv }); return `${cv}: c${m.cover.toFixed(3)} b${m.bare.toFixed(3)} g${m.gap.toFixed(3)} s${m.solid.toFixed(3)}${m.valid ? '' : ' BAD'}`; });
  console.log(id.padEnd(6), cells.join(' | '));
}
