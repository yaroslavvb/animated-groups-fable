// designs/ripple/lab/debug.mjs — the grid of one group as a picture: the cell, the corners (pools) by colour, the dark tone.
//   node dev/patterns/designs/ripple/lab/debug.mjs --id '*333' --out <png> [--knobs '{...}']
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const res = find(BY_ID[opt.id], { ...(opt.knobs ? JSON.parse(opt.knobs) : {}), DEBUG: 1 });
const D = res.info.debug, S = 3, W = D.nu * S, H = D.nv * S, img = new Uint8Array(W * H * 3);
const pal = [[230, 90, 60], [60, 140, 230], [240, 190, 40], [150, 90, 200], [60, 180, 120], [240, 120, 180], [120, 120, 120], [20, 200, 220]];
for (let j = 0; j < D.nv; j++) for (let i = 0; i < D.nu; i++) {
  const s = j * D.nu + i;
  let c = [255, 255, 255];
  if (D.cell[s]) c = [225, 235, 232];
  if (D.d1[s] < 0) c = [40, 60, 60];
  if (D.pools[s]) c = pal[(D.pools[s] - 1) % pal.length];
  if (D.phi[s] > 0) c = c.map((v) => v * 0.55);
  for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) { const o = (((D.nv - 1 - j) * S + b) * W + i * S + a) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; }
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(path.resolve(opt.out), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(JSON.stringify({ ...res.info, debug: undefined }));
console.log('pools', D.deep.map((v, q) => q ? `${q}:${(v / Math.sqrt(BY_ID[opt.id].domainArea)).toFixed(3)}/${D.nPer[q]}` : '').join(' '));
