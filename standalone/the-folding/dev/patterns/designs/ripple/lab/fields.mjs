// designs/ripple/lab/fields.mjs — the grid of one group as a picture (the critique of 13 Nov 2026): what decides each
// point. Colours: dark tone (phi > 0) teal; inside a corner of the cell (lab) blue tint; points carried 'under' a swell
// orange; the medial axis of the comma's outside (|grad d1| < 0.97) red; outside the cell grey.
//   node dev/patterns/designs/ripple/lab/fields.mjs --id '**' --out <png> [--scale 4] [--knobs '{...}']
import fs from 'node:fs';
import zlib from 'node:zlib';
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const g = BY_ID[opt.id || '**'], S = +opt.scale || 4;
const res = find(g, { DEBUG: true, ...(opt.knobs ? JSON.parse(opt.knobs) : {}) });
const D = res.info.debug, nu = D.nu, nv = D.nv;
const W = nu * S, H = nv * S, img = new Uint8Array(W * H * 3).fill(255);
const gx = (s) => { const i = s % nu, il = i > 0 ? s - 1 : s, ir = i < nu - 1 ? s + 1 : s; return (D.d1[ir] - D.d1[il]) / ((ir - il) * D.h); };
const gy = (s) => { const j = Math.floor(s / nu), jl = j > 0 ? s - nu : s, jr = j < nv - 1 ? s + nu : s; return (D.d1[jr] - D.d1[jl]) / (((jr - jl) / nu) * D.h); };
for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
  const s = j * nu + i;
  let c = [255, 255, 255];
  const HUE = [[255, 180, 180], [180, 255, 180], [180, 180, 255], [255, 255, 150], [255, 170, 255], [150, 255, 255], [255, 210, 150], [210, 150, 255]];
  if (!D.cell[s]) c = [200, 200, 200];
  if (D.pools[s]) c = HUE[D.pools[s] % 8];
  if (D.under && D.under[s]) c = HUE[D.under[s] % 8].map((v) => v * 0.8);
  if (D.phi[s] > 0) c = c.map((v) => v * 0.45);
  if (opt.mode === 'tone') c = D.phi[s] > 0 ? [79, 163, 151] : [255, 255, 255];
  const gn = Math.hypot(gx(s), gy(s));
  if (D.d1[s] > 0 && gn < 0.97) c = [220, 40, 40];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const p = ((nv - 1 - j) * S + y) * W + i * S + x; img.set(c, 3 * p); }
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(opt.out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('grid', nu, nv, 'h', D.h, 'info', JSON.stringify({ r: res.info.r, seat: res.info.seat, turn: res.info.turn, corners: res.info.corners }));
