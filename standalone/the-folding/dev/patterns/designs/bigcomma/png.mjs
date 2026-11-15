// dev/patterns/designs/bigcomma/png.mjs — the smallest raster kit: an RGB canvas, a scanline polygon fill, a PNG writer.
// For local looks at shapes (no browser). Not part of the design.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export function canvas(w, h, bg = [255, 255, 255]) {
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { data[3 * i] = bg[0]; data[3 * i + 1] = bg[1]; data[3 * i + 2] = bg[2]; }
  return { w, h, data };
}

/** Fill polygons (lists of [x, y] in pixel coordinates) with a colour, even-odd over ALL of them together, 3x3 supersampled. */
export function fill(cv, polys, col, alpha = 1) {
  const S = 3, { w, h, data } = cv;
  let y0 = Infinity, y1 = -Infinity;
  for (const P of polys) for (const p of P) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(h - 1, Math.ceil(y1));
  const cov = new Float32Array(w), xs = [];
  for (let y = ya; y <= yb; y++) {
    cov.fill(0);
    for (let v = 0; v < S; v++) {
      const yc = y + (v + 0.5) / S; xs.length = 0;
      for (const P of polys) for (let i = 0, m = P.length, j = m - 1; i < m; j = i++) {
        const a = P[i], b = P[j];
        if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, xs[k]), xb = Math.min(w, xs[k + 1]);
        if (xb <= xa) continue;
        const ia = Math.floor(xa), ib = Math.min(w - 1, Math.floor(xb));
        if (ia === ib) cov[ia] += (xb - xa) / S; else { cov[ia] += (ia + 1 - xa) / S; for (let x = ia + 1; x < ib; x++) cov[x] += 1 / S; cov[ib] += (xb - ib) / S; }
      }
    }
    for (let x = 0; x < w; x++) if (cov[x] > 0) {
      const a = Math.min(1, cov[x]) * alpha, i = 3 * (y * w + x);
      data[i] += (col[0] - data[i]) * a; data[i + 1] += (col[1] - data[i + 1]) * a; data[i + 2] += (col[2] - data[i + 2]) * a;
    }
  }
}

/** A line as a thin quadrilateral. */
export function line(cv, ax, ay, bx, by, width, col, alpha = 1) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * width / 2, ny = (dx / l) * width / 2;
  fill(cv, [[[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]]], col, alpha);
}
export function disc(cv, cx, cy, r, col, alpha = 1) {
  const P = []; for (let i = 0; i < 24; i++) P.push([cx + r * Math.cos((i * Math.PI) / 12), cy + r * Math.sin((i * Math.PI) / 12)]);
  fill(cv, [P], col, alpha);
}

export function writePng(cv, file) {
  const { w, h, data } = cv, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(data.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (type, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(path.resolve(file), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
