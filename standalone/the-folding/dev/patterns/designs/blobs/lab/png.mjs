// lab/png.mjs — a tiny RGB raster with a PNG writer (node's zlib), for quick looks without a browser.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export class Raster {
  constructor(w, h, bg = [255, 255, 255]) {
    this.w = w; this.h = h; this.d = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) { this.d[3 * i] = bg[0]; this.d[3 * i + 1] = bg[1]; this.d[3 * i + 2] = bg[2]; }
  }
  set(x, y, c, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = 3 * (y * this.w + x);
    this.d[i] = this.d[i] * (1 - a) + c[0] * a; this.d[i + 1] = this.d[i + 1] * (1 - a) + c[1] * a; this.d[i + 2] = this.d[i + 2] * (1 - a) + c[2] * a;
  }
  /** A line of the given width (px), optionally dashed [on, off]; clipped to the box [x0, y0, x1, y1]. */
  line(ax, ay, bx, by, c, width = 1, a = 1, dash = null, clip = null) {
    const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L * 2));
    const r = width / 2;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (dash && ((t * L) % (dash[0] + dash[1])) > dash[0]) continue;
      const x = ax + t * (bx - ax), y = ay + t * (by - ay);
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy > r * r + 0.3) continue;
        const X = Math.round(x + dx), Y = Math.round(y + dy);
        if (clip && (X < clip[0] || Y < clip[1] || X >= clip[2] || Y >= clip[3])) continue;
        this.set(X, Y, c, a);
      }
    }
  }
  dot(x, y, r, c, clip = null) {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const X = Math.round(x + dx), Y = Math.round(y + dy);
      if (clip && (X < clip[0] || Y < clip[1] || X >= clip[2] || Y >= clip[3])) continue;
      this.set(X, Y, c);
    }
  }
  /** 3x5 digits and a few signs, for labels. */
  text(x, y, s, c = [26, 26, 31], scale = 2) {
    const G = {
      '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
      '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
      '.': '000000000000010', '*': '000101010101000', 'x': '000101010101000', 'o': '000111101111000', '-': '000000111000000',
      ' ': '000000000000000', ':': '000010000010000', '%': '101001010100101', '/': '001001010100100', '!': '010010010000010',
      'a': '010101111101101', 'b': '110101110101110', 'c': '111100100100111', 'd': '110101101101110', 'e': '111100111100111',
      'f': '111100111100100', 'g': '111100101101111', 'h': '101101111101101', 'i': '111010010010111', 'k': '101101110101101',
      'l': '100100100100111', 'm': '101111111101101', 'n': '110101101101101', 'p': '111101111100100', 'r': '110101110101101',
      's': '111100111001111', 't': '111010010010010', 'u': '101101101101111', 'v': '101101101101010', 'w': '101101111111101',
      'y': '101101010010010', 'z': '111001010100111', 'q': '111101111001001', 'j': '001001001101111',
    };
    let cx = x;
    for (const ch of String(s).toLowerCase()) {
      const g = G[ch] || G[' '];
      for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r * 3 + k] === '1') for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) this.set(cx + k * scale + sx, y + r * scale + sy, c);
      cx += 4 * scale;
    }
  }
  write(file) {
    const { w, h, d } = this, raw = Buffer.alloc(h * (1 + 3 * w));
    for (let y = 0; y < h; y++) { raw[y * (1 + 3 * w)] = 0; Buffer.from(d.buffer, d.byteOffset + 3 * w * y, 3 * w).copy(raw, y * (1 + 3 * w) + 1); }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
  }
}
