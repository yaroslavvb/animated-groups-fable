// r6/stats.mjs — the lab's numbers of the design as it is (or of strokes given in a JSON file), one line per group.
//   node r6/stats.mjs [--ids a,b] [--strokes file.json] [--h 0.02]
// thin = the narrowest dark feature, gap = the narrowest light channel (tile sizes, from the torus grid);
// asym = 1 - the largest share of the home blob that a mirror image or the half-turn of it covers (a comma: >= 0.28);
// inTile = the share of the home blob inside the default tile (0.04 in from its rim); len = the blob's length.
import fs from 'node:fs';
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { STROKES } from '../design.js';
import { analyse } from '../lab/measure.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const over = opt.strokes ? JSON.parse(fs.readFileSync(opt.strokes, 'utf8')) : {};
const h = +opt.h || 0.02;
const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '-');
console.log('id      cover  bare  solid  thin   gap   asym  inTile  len   marks valid ms');
for (const id of ids) {
  const st = over[id] || STROKES[id] || STROKES.default;
  const m = analyse(BY_ID[id], st, { h });
  console.log(`${id.padEnd(6)} ${f(m.cover)} ${f(m.bare)} ${f(m.solid)} ${f(m.thin)} ${f(m.gap)} ${f(m.asym, 2)}  ${f(m.inTile, 2)}   ${f(m.length, 2)}  ${m.marks}  ${m.valid ? 'ok' : 'BAD'}  ${Math.round(m.ms)}`);
}
