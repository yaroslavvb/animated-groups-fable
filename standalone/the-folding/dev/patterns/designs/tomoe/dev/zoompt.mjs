// node dev/zoompt.mjs <id> <x> <y> <out.png> [--half 0.15] [--px 400] [--design ../design.js]
// The print around one WORLD point (x, y), a window of half-width --half tile sizes, drawn --px pixels wide: dark and
// light in the front tones, the point marked by a red cross. For hunting slivers and near-touches.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, windingAt } from '../../../kit.js';

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const g = BY_ID[pos[0]], X = +pos[1], Y = +pos[2], out = pos[3];
const mod = await import(path.resolve(path.dirname(new URL(import.meta.url).pathname), opt.design || '../design.js'));
const s = Math.sqrt(g.domainArea), half = (+opt.half || 0.15) * s, W = +opt.px || 400, h = (2 * half) / W;
const N = normalize(mod.find(g).shapes);
const img = Buffer.alloc(W * W * 3);
for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
  const x = X - half + (i + 0.5) * h, y = Y + half - (j + 0.5) * h, d = windingAt(g, N, x, y) > 0;
  const c = d ? [0x4f, 0xa3, 0x97] : [0x9a, 0xd5, 0xcc], k = 3 * (j * W + i);
  img[k] = c[0]; img[k + 1] = c[1]; img[k + 2] = c[2];
}
for (let t = -6; t <= 6; t++) for (const [i, j] of [[W / 2 + t, W / 2], [W / 2, W / 2 + t]]) { const k = 3 * (Math.round(j) * W + Math.round(i)); img[k] = 220; img[k + 1] = 30; img[k + 2] = 30; }
const raw = Buffer.alloc((W * 3 + 1) * W);
for (let y = 0; y < W; y++) { raw[y * (W * 3 + 1)] = 0; img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const chunk = (type, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([l, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(path.resolve(out), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote ${out}: ${pos[0]} around (${X}, ${Y}), half ${opt.half || 0.15} tile sizes`);
