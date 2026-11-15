// scratch-core-sdf/png.mjs — a PNG writer with node's zlib alone (RGB, 8 bits), for the pictures of the SDF agent.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** rgb: Uint8Array(w * h * 3), row 0 at the TOP. */
export function writePNG(file, w, h, rgb) {
  const stride = w * 3 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { raw[y * stride] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * stride + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
  return file;
}

/** A canvas of w x h pixels, white; px(x, y, [r, g, b]) with y DOWN; blit(other, x0, y0). */
export function canvas(w, h, fill = [255, 255, 255]) {
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { rgb[3 * i] = fill[0]; rgb[3 * i + 1] = fill[1]; rgb[3 * i + 2] = fill[2]; }
  return {
    w, h, rgb,
    px(x, y, c) { if (x < 0 || y < 0 || x >= w || y >= h) return; const o = 3 * (y * w + x); rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; },
    blit(src, x0, y0) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const o = 3 * (y * src.w + x); this.px(x0 + x, y0 + y, [src.rgb[o], src.rgb[o + 1], src.rgb[o + 2]]); } },
    save(file) { return writePNG(file, w, h, rgb); },
  };
}
export const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
