// scratch (art-director round): ONE motif of each group, large, as an SVG (and its frame), to judge the foot's shape:
//   node dev/patterns/designs/feet/scratch/one.mjs --ids '632,3*3,333' --out <file.svg> [--design <path>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GROUPS, BY_ID } from '../../../../../src/groups.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const mod = await import(pathToFileURL(path.resolve(opt.design || new URL('../design.js', import.meta.url).pathname)).href);
const cols = Math.ceil(Math.sqrt(ids.length)), rows = Math.ceil(ids.length / cols), px = 420, side = Math.max(cols, rows) * px;
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="100%" height="100%" fill="#fff"/>`;
ids.forEach((id, k) => {
  const g = BY_ID[id], ts = Math.sqrt(g.domainArea), res = mod.find(g);
  const all = res.shapes.flatMap((s) => s.pts).concat(res.info.frames ? res.info.frames.flatMap((f) => f.poly) : []);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 * 1.08;
  const s = (px - 30) / (2 * half), ox = (k % cols) * px + 15, oy = Math.floor(k / cols) * px + 22;
  const M = (p) => `${(ox + (p[0] - cx + half) * s).toFixed(1)},${(oy + (cy + half - p[1]) * s).toFixed(1)}`;
  for (const f of res.info.frames || []) out += `<polygon points="${f.poly.map(M).join(' ')}" fill="#9ad5cc" stroke="#0f766e" stroke-width="1"/>`;
  for (const sh of res.shapes) out += `<polygon points="${sh.pts.map(M).join(' ')}" fill="#4fa397"/>`;
  out += `<text x="${ox}" y="${oy - 6}" font-size="14" font-family="sans-serif">${id}  (one tile size = ${(s * ts).toFixed(0)} px)</text>`;
});
out += '</svg>';
fs.writeFileSync(opt.out, out);
console.log('wrote', opt.out);
