// lab/png.mjs — a tiny RGB canvas and PNG writer for the Swell lab (node only; no dependencies).
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

export class Canvas {
  constructor(w, h, bg = [255, 255, 255]) {
    this.w = w; this.h = h; this.d = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) { this.d[3 * i] = bg[0]; this.d[3 * i + 1] = bg[1]; this.d[3 * i + 2] = bg[2]; }
  }
  blend(x, y, c, a = 1) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = 3 * (y * this.w + x), d = this.d;
    d[i] = d[i] + (c[0] - d[i]) * a; d[i + 1] = d[i + 1] + (c[1] - d[i + 1]) * a; d[i + 2] = d[i + 2] + (c[2] - d[i + 2]) * a;
  }
  rect(x0, y0, x1, y1, c, a = 1) { for (let y = Math.max(0, y0 | 0); y < Math.min(this.h, y1); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(this.w, x1); x++) this.blend(x, y, c, a); }
  /** A thick segment (pixel coordinates), soft edge of one pixel; clipped to the box [bx0, by0, bx1, by1). */
  line(x0, y0, x1, y1, width, c, a = 1, box = null, dash = 0) {
    const r = width / 2 + 1, bx0 = box ? box[0] : 0, by0 = box ? box[1] : 0, bx1 = box ? box[2] : this.w, by1 = box ? box[3] : this.h;
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
    const steep = Math.abs(dy) > Math.abs(dx);
    // walk along the major axis: only the pixels near the line
    const n = Math.ceil(l) + 1;
    const seen = new Set();
    for (let k = 0; k <= n; k++) {
      const t = k / n, cx = x0 + t * dx, cy = y0 + t * dy;
      if (dash && Math.floor((t * l) / dash) % 2) continue;
      for (let o = -Math.ceil(r); o <= Math.ceil(r); o++) {
        const px = Math.round(steep ? cx + o : cx), py = Math.round(steep ? cy : cy + o);
        if (px < bx0 || py < by0 || px >= bx1 || py >= by1) continue;
        const key = py * this.w + px;
        if (seen.has(key)) continue;
        seen.add(key);
        let tt = l2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        const dist = Math.hypot(px - x0 - tt * dx, py - y0 - tt * dy);
        const cov = Math.max(0, Math.min(1, width / 2 + 0.5 - dist));
        if (cov > 0) this.blend(px, py, c, a * cov);
      }
    }
  }
  disc(cx, cy, r, c, a = 1, box = null) {
    const bx0 = box ? box[0] : 0, by0 = box ? box[1] : 0, bx1 = box ? box[2] : this.w, by1 = box ? box[3] : this.h;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (x < bx0 || y < by0 || x >= bx1 || y >= by1) continue;
      const cov = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(x - cx, y - cy)));
      if (cov > 0) this.blend(x, y, c, a * cov);
    }
  }
  /** A 5x7 text in pixels (digits, letters, a few signs), for captions. */
  text(x, y, s, c = [40, 40, 46], scale = 1) {
    for (const ch of String(s)) {
      const g = FONT[ch] || FONT[ch.toUpperCase()] || FONT['?'];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r] & (16 >> q)) this.rect(x + q * scale, y + r * scale, x + (q + 1) * scale, y + (r + 1) * scale, c, 1);
      x += 6 * scale;
    }
  }
  save(file) {
    const { w, h, d } = this, raw = Buffer.alloc((3 * w + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (3 * w + 1)] = 0; Buffer.from(d.buffer, d.byteOffset + 3 * w * y, 3 * w).copy(raw, y * (3 * w + 1) + 1); }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
  }
}

/**
 * Scanline fill of closed polygons into a count buffer: buf[y * w + x] += add for every pixel centre (x + 0.5, y + 0.5)
 * inside the polygon (even-odd of that one polygon). pts: flat [x0, y0, x1, y1, ...] in pixel coordinates.
 */
export function fillCount(buf, w, h, pts, add, clip = null) {
  const n = pts.length / 2;
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < n; i++) { const y = pts[2 * i + 1]; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  const ya = Math.max(clip ? clip[1] : 0, Math.ceil(ymin - 0.5)), yb = Math.min((clip ? clip[3] : h) - 1, Math.floor(ymax - 0.5));
  const xs = [];
  const cx0 = clip ? clip[0] : 0, cx1 = clip ? clip[2] : w;
  for (let y = ya; y <= yb; y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = pts[2 * i + 1], yj = pts[2 * j + 1];
      if ((yi > yc) !== (yj > yc)) xs.push(pts[2 * i] + ((yc - yi) * (pts[2 * j] - pts[2 * i])) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(cx0, Math.ceil(xs[k] - 0.5)), xb = Math.min(cx1 - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) buf[y * w + x] += add;
    }
  }
}

const FONT = {
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14], '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ' ': [0, 0, 0, 0, 0, 0, 0], '-': [0, 0, 0, 31, 0, 0, 0], '*': [0, 21, 14, 31, 14, 21, 0], '%': [24, 25, 2, 4, 8, 19, 3],
  ':': [0, 12, 12, 0, 12, 12, 0], '=': [0, 0, 31, 0, 31, 0, 0], '/': [1, 1, 2, 4, 8, 16, 16], '?': [14, 17, 1, 2, 4, 0, 4], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28], E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31], M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17], Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
};
