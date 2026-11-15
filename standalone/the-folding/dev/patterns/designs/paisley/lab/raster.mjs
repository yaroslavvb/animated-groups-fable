// lab/raster.mjs — a tiny software canvas for looking at shapes without a browser (the paisley design's own lab; not
// part of the page). Polygons are filled by the nonzero rule at SS x SS samples a pixel; PNG out through node:zlib.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export class Canvas {
  constructor(w, h, ss = 3) {
    this.w = w; this.h = h; this.ss = ss; this.W = w * ss; this.H = h * ss;
    this.buf = new Float32Array(this.W * this.H * 3).fill(1);
  }
  /** polys: [[ [x, y], ... ], ...] in pixel coordinates (y down); rgb 0..1; alpha 0..1. One nonzero fill of all of them. */
  fill(polys, rgb, alpha = 1) {
    const { W, H, ss, buf } = this;
    const edges = [];
    let y0 = Infinity, y1 = -Infinity;
    for (const p of polys) {
      const n = p.length;
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n];
        const ax = a[0] * ss, ay = a[1] * ss, bx = b[0] * ss, by = b[1] * ss;
        if (ay === by) continue;
        edges.push(ay < by ? [ax, ay, bx, by, 1] : [bx, by, ax, ay, -1]);
        y0 = Math.min(y0, ay, by); y1 = Math.max(y1, ay, by);
      }
    }
    const r0 = Math.max(0, Math.floor(y0)), r1 = Math.min(H - 1, Math.ceil(y1));
    for (let r = r0; r <= r1; r++) {
      const y = r + 0.5, xs = [];
      for (const e of edges) if (y >= e[1] && y < e[3]) xs.push([e[0] + ((y - e[1]) * (e[2] - e[0])) / (e[3] - e[1]), e[4]]);
      xs.sort((u, v) => u[0] - v[0]);
      let wind = 0;
      for (let k = 0; k + 1 < xs.length; k++) {
        wind += xs[k][1];
        if (!wind) continue;
        const c0 = Math.max(0, Math.ceil(xs[k][0] - 0.5)), c1 = Math.min(W - 1, Math.ceil(xs[k + 1][0] - 0.5) - 1);
        for (let c = c0; c <= c1; c++) {
          const o = (r * W + c) * 3;
          buf[o] += (rgb[0] - buf[o]) * alpha; buf[o + 1] += (rgb[1] - buf[o + 1]) * alpha; buf[o + 2] += (rgb[2] - buf[o + 2]) * alpha;
        }
      }
    }
  }
  /** A polyline of width wpx (pixels) as a row of quads. */
  line(pts, rgb, wpx = 1, alpha = 1, closed = false) {
    const n = pts.length, quads = [];
    for (let i = 0; i + 1 < n + (closed ? 1 : 0); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (l < 1e-9) continue;
      const nx = (-dy / l) * wpx / 2, ny = (dx / l) * wpx / 2;
      quads.push([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
    }
    for (const q of quads) this.fill([q], rgb, alpha);
  }
  dot(x, y, r, rgb, alpha = 1) {
    const p = [];
    for (let i = 0; i < 20; i++) p.push([x + r * Math.cos((i * Math.PI) / 10), y + r * Math.sin((i * Math.PI) / 10)]);
    this.fill([p], rgb, alpha);
  }
  save(file) {
    const { w, h, ss, W, buf } = this;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 3 + 1)] = 0;
      for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) {
        let s = 0;
        for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) s += buf[((y * ss + j) * W + x * ss + i) * 3 + k];
        raw[y * (w * 3 + 1) + 1 + x * 3 + k] = Math.max(0, Math.min(255, Math.round((255 * s) / (ss * ss))));
      }
    }
    const chunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
  }
}

export const hex = (s) => { const n = parseInt(s.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
