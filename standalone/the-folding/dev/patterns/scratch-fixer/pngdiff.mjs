// pngdiff.mjs — compare two PNGs of the same size pixel by pixel (8-bit RGB / RGBA, non-interlaced).
//   node pngdiff.mjs a.png b.png [--out diff.png] [--tol 0] [--grid 3x6 --cell 388x261 --origin 10x10]
// Prints: size, differing pixels (any channel differs by more than tol), max channel difference, bounding box of the
// differences, and (with --grid) the count per cell of a sheet. --out writes a picture: grey copy of a, differences red.
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readPNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(file + ': not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; inter = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || inter !== 0 || (ctype !== 6 && ctype !== 2)) throw new Error(`${file}: unsupported PNG (depth ${depth}, colour type ${ctype}, interlace ${inter})`);
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[4 * (y * w + x)] = cur[bpp * x]; out[4 * (y * w + x) + 1] = cur[bpp * x + 1]; out[4 * (y * w + x) + 2] = cur[bpp * x + 2]; out[4 * (y * w + x) + 3] = bpp === 4 ? cur[bpp * x + 3] : 255; }
    prev.set(cur);
  }
  return { w, h, data: out };
}

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc((4 * w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (4 * w + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + 4 * w * y, 4 * w).copy(raw, y * (4 * w + 1) + 1); }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

export function diff(A, B, tol = 0) {
  if (A.w !== B.w || A.h !== B.h) return { sizeDiffers: true, a: [A.w, A.h], b: [B.w, B.h] };
  let n = 0, max = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const mask = new Uint8Array(A.w * A.h);
  for (let i = 0; i < A.w * A.h; i++) {
    let d = 0;
    for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[4 * i + k] - B.data[4 * i + k]));
    if (d > max) max = d;
    if (d > tol) { n++; mask[i] = 1; const x = i % A.w, y = (i / A.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { n, max, box: n ? [x0, y0, x1, y1] : null, mask, share: n / (A.w * A.h) };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const args = process.argv.slice(2), opt = {}, pos = [];
  for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
  const A = readPNG(pos[0]), B = readPNG(pos[1]), tol = +opt.tol || 0;
  const r = diff(A, B, tol);
  if (r.sizeDiffers) { console.log(`SIZE DIFFERS ${r.a.join('x')} vs ${r.b.join('x')}`); process.exit(1); }
  console.log(`${A.w}x${A.h}: ${r.n} pixels differ (tol ${tol}), ${(100 * r.share).toFixed(4)} %, max channel diff ${r.max}, box ${r.box ? r.box.join(',') : '-'}`);
  if (opt.grid) {
    const [gc, gr] = opt.grid.split('x').map(Number), [cw, ch] = (opt.cell || '388x261').split('x').map(Number), [ox, oy] = (opt.origin || '10x10').split('x').map(Number);
    const labels = (opt.labels || '').split(',');
    const cells = [];
    for (let r0 = 0; r0 < gr; r0++) for (let c0 = 0; c0 < gc; c0++) {
      let k = 0;
      for (let y = oy + r0 * ch; y < Math.min(A.h, oy + (r0 + 1) * ch); y++) for (let x = ox + c0 * cw; x < Math.min(A.w, ox + (c0 + 1) * cw); x++) k += r.mask[y * A.w + x];
      cells.push(`${labels[r0 * gc + c0] || r0 * gc + c0}:${k}`);
    }
    console.log('per cell: ' + cells.join(' '));
  }
  if (opt.out) {
    const o = new Uint8Array(A.w * A.h * 4);
    for (let i = 0; i < A.w * A.h; i++) {
      const g = (A.data[4 * i] * 0.3 + A.data[4 * i + 1] * 0.59 + A.data[4 * i + 2] * 0.11) * 0.35 + 165;
      if (r.mask[i]) { o[4 * i] = 230; o[4 * i + 1] = 0; o[4 * i + 2] = 0; } else { o[4 * i] = g; o[4 * i + 1] = g; o[4 * i + 2] = g; }
      o[4 * i + 3] = 255;
    }
    writePNG(opt.out, A.w, A.h, o);
    console.log('WROTE ' + opt.out);
  }
}
