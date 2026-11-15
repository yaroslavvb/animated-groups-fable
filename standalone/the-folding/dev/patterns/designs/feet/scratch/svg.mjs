// scratch: a quick local look without a browser: the motif and its frame(s) of some groups as one SVG file.
//   node dev/patterns/designs/feet/scratch/svg.mjs --ids '*2222,442' --out <file.svg> [--variant 442=upright,632=pair]
import fs from 'node:fs';
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
import { find } from '../design.js';
const findWith = (g) => find(g);

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const V = {};
for (const kv of (opt.variant || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); V[k] = v; }
const cols = Math.ceil(Math.sqrt(ids.length)), rows = Math.ceil(ids.length / cols), px = Math.floor(1600 / cols);
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * px}" height="${rows * px}" viewBox="0 0 ${cols * px} ${rows * px}"><rect width="100%" height="100%" fill="#fff"/>`;
ids.forEach((id, k) => {
  const g = BY_ID[id], res = findWith(g, V), ts = Math.sqrt(g.domainArea), tile = tileOf(g);
  const all = [...tile.poly, ...res.info.frames.flatMap((f) => f.poly)];
  const x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0])), y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
  const s = (px - 40) / Math.max(x1 - x0, y1 - y0), ox = (k % cols) * px + 20, oy = Math.floor(k / cols) * px + 20;
  const M = (p) => `${(ox + (p[0] - x0) * s).toFixed(1)},${(oy + (y1 - p[1]) * s).toFixed(1)}`;
  out += `<polygon points="${tile.poly.map(M).join(' ')}" fill="#9ad5cc" stroke="#0f766e" stroke-width="1.5"/>`;
  for (const f of res.info.frames) out += `<polygon points="${f.poly.map(M).join(' ')}" fill="none" stroke="#b45309" stroke-width="1" stroke-dasharray="4 3"/>`;
  for (const sh of res.shapes) out += `<polygon points="${sh.pts.map(M).join(' ')}" fill="#4fa397"/>`;
  for (const f of res.info.frames) f.poly.forEach((p, i) => { const q = M(p).split(','); out += `<text x="${q[0]}" y="${q[1]}" font-size="11" fill="#b45309">${i}${f.toe.includes(i) ? 't' : ''}${f.heel.includes(i) ? 'h' : ''}</text>`; });
  out += `<text x="${ox}" y="${oy - 6}" font-size="13" font-family="sans-serif">${id}  cover ${res.info.coverage.toFixed(3)}  lean ${res.info.lean}  wider ${res.info.wider.toFixed(3)}  (${(1 / ts).toFixed(2)} ts per unit)</text>`;
});
out += '</svg>';
fs.writeFileSync(opt.out, out);
console.log('wrote', opt.out);
