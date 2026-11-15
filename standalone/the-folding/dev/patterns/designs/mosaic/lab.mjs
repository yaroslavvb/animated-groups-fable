// dev/patterns/designs/mosaic/lab.mjs — the mosaic designer's own bench (node, no browser): a fast raster of a motif's
// orbit, the numbers of kit.measure computed from it (same grid, same window), and a contact sheet as a PNG.
// Dev only; nothing of the page imports it.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { BY_ID, GROUPS, symmetryElements } from '../../../../src/groups.js';
import { normalize, orbitElements, tileOf } from '../../kit.js';

/** cnt[j * w + i] = how many copies of the motif cover the sample (x0 + (i + .5) h, y0 + (j + .5) h); sign: bit by hand. */
export function rasterOrbit(group, N, x0, y0, h, w, hgt, hand = null) {
  const cnt = new Uint8Array(w * hgt), box = [x0, y0, x0 + w * h, y0 + hgt * h];
  const els = orbitElements(group, N, box), xs = [];
  for (const g of els) {
    const flip = g.a * g.d - g.b * g.c < 0;
    const P = N.polys.map((Q) => { const n = Q.pts.length / 2, o = new Float64Array(2 * n); for (let k = 0; k < n; k++) { const x = Q.pts[2 * k], y = Q.pts[2 * k + 1]; o[2 * k] = g.a * x + g.b * y + g.tx; o[2 * k + 1] = g.c * x + g.d * y + g.ty; } return o; });
    let ya = Infinity, yb = -Infinity;
    for (const o of P) for (let k = 1; k < o.length; k += 2) { ya = Math.min(ya, o[k]); yb = Math.max(yb, o[k]); }
    const j0 = Math.max(0, Math.ceil((ya - y0) / h - 0.5)), j1 = Math.min(hgt - 1, Math.floor((yb - y0) / h - 0.5));
    for (let j = j0; j <= j1; j++) {
      const y = y0 + (j + 0.5) * h;
      xs.length = 0;
      for (const o of P) for (let k = 0, n = o.length / 2, q = n - 1; k < n; q = k++) {
        const yi = o[2 * k + 1], yj = o[2 * q + 1];
        if ((yi > y) !== (yj > y)) xs.push(o[2 * k] + ((y - yi) * (o[2 * q] - o[2 * k])) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - x0) / h - 0.5)), i1 = Math.min(w - 1, Math.floor((xs[k + 1] - x0) / h - 0.5));
        for (let i = i0; i <= i1; i++) { cnt[j * w + i]++; if (hand && flip) hand[j * w + i] = 1; }
      }
    }
  }
  return cnt;
}

export function edt(on, w, h) {
  const INF = 1e20, n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(w * h), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (m, get, set) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < m; q++) {
      let s;
      for (;;) { const p = v[k]; s = (get(q) + q * q - (get(p) + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; } else { k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    }
    k = 0;
    for (let q = 0; q < m; q++) { while (z[k + 1] < q) k++; const p = v[k]; set(q, (q - p) * (q - p) + get(p)); }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : INF; const col = f.slice(0, h); pass(h, (i) => col[i], (i, val) => { d[i * w + x] = val; }); }
  for (let y = 0; y < h; y++) { const row = d.slice(y * w, y * w + w); pass(w, (i) => row[i], (i, val) => { d[y * w + i] = val; }); }
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(d[i]);
  return d;
}

/** The numbers of kit.measure (same window, same grid), from the fast raster. */
export function measureFast(group, N, { per = 56 } = {}) {
  const size = Math.sqrt(group.domainArea), h = size / per;
  const L = Math.max(Math.hypot(group.e1[0], group.e1[1]), Math.hypot(group.e2[0], group.e2[1]));
  const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;
  const w = Math.ceil((2 * (half + pad)) / h), x0 = group.center[0] - half - pad, y0 = group.center[1] - half - pad;
  const cnt = rasterOrbit(group, N, x0, y0, h, w, w);
  const dark = new Uint8Array(w * w), light = new Uint8Array(w * w);
  let over = 0, inner = 0, nd = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const t = cnt[j * w + i] > 0 ? 1 : 0, x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    dark[j * w + i] = t; light[j * w + i] = 1 - t;
    if (Math.abs(x - group.center[0]) <= half && Math.abs(y - group.center[1]) <= half) { inner++; nd += t; if (cnt[j * w + i] > 1) over++; }
  }
  const dD = edt(dark, w, w), dL = edt(light, w, w);
  let eR = 0, kR = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (Math.abs(x - group.center[0]) > half || Math.abs(y - group.center[1]) > half) continue;
    eR = Math.max(eR, dD[j * w + i]); kR = Math.max(kR, dL[j * w + i]);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { coverage: r3(nd / inner), emptyDisc: r3((2 * eR * h) / size), darkDisc: r3((2 * kR * h) / size), overlap: r3(over / inner), verts: N.verts };
}

// ---- a tiny PNG and a contact sheet --------------------------------------------------------------------------------
function png(w, h, rgb) {
  const raw = Buffer.alloc((3 * w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (3 * w + 1)] = 0; rgb.copy(raw, y * (3 * w + 1) + 1, y * 3 * w, (y + 1) * 3 * w); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

const FONT = { o: '01110100011000110001100011000101110', 2: '01110100010000100010001000100011111', 3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 6: '00110010001000011110100011000101110', '*': '00000101010111011111011101010100000', x: '00000100010101000100010101000100000' };

/** items: [{ group, shapes }]. One square per item, drawn like dev/patterns/proto.html (the hand by the copy's own hand). */
export function sheet(items, { px = 300, cols = 4, zoom = 1, back = false, ss = 3 } = {}) {
  const rows = Math.ceil(items.length / cols), W = cols * (px + 6) + 6, Hh = rows * (px + 6) + 6, img = Buffer.alloc(3 * W * Hh, 255);
  const TL = back ? [245, 230, 198] : [154, 213, 204], TD = back ? [216, 189, 133] : [79, 163, 151];
  items.forEach(({ group, shapes }, idx) => {
    const ox = 6 + (idx % cols) * (px + 6), oy = 6 + Math.floor(idx / cols) * (px + 6);
    const N = normalize(shapes), tile = tileOf(group), half = group.viewHalf / zoom;
    const fx = zoom > 1 ? tile.seed[0] : group.center[0], fy = zoom > 1 ? tile.seed[1] : group.center[1];
    const n = px * ss, h = (2 * half) / n, x0 = fx - half, y0 = fy - half;
    const hand = new Uint8Array(n * n), cnt = rasterOrbit(group, N, x0, y0, h, n, n, hand);
    const tm = rasterOrbit({ ...group, reps: [{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }], e1: [1e3, 0], e2: [0, 1e3], cellArea: 1e6 }, normalize([{ pts: tile.poly }]), x0, y0, h, n, n);
    const sym = symmetryElements(group, fx, fy, half * 1.6), s = px / (2 * half);
    for (let Y = 0; Y < px; Y++) for (let X = 0; X < px; X++) {
      let r = 0, g = 0, b = 0;
      for (let v = 0; v < ss; v++) for (let u = 0; u < ss; u++) {
        const k = (n - 1 - (Y * ss + v)) * n + X * ss + u, d = cnt[k] > 0, t = tm[k] > 0;
        const c = t ? (d ? TD : TL) : d ? (hand[k] ? [239, 227, 204] : [220, 237, 234]) : [255, 255, 255];
        r += c[0]; g += c[1]; b += c[2];
      }
      const q = ss * ss; r /= q; g /= q; b /= q;
      const wx = x0 + ((X + 0.5) * 2 * half) / px, wy = y0 + ((px - Y - 0.5) * 2 * half) / px;
      let ink = 0;
      for (const m of sym.mirrors) { const d = Math.abs((wx - m.px) * -m.uy + (wy - m.py) * m.ux) * s; ink = Math.max(ink, Math.min(1, Math.max(0, 1.1 - d))); }
      for (const m of sym.glides) { const d = Math.abs((wx - m.px) * -m.uy + (wy - m.py) * m.ux) * s, al = ((wx - m.px) * m.ux + (wy - m.py) * m.uy) * s; if (((al % 7) + 7) % 7 < 4) ink = Math.max(ink, 0.35 * Math.min(1, Math.max(0, 0.9 - d))); }
      for (const c of sym.centers) { const d = Math.hypot(wx - c.x, wy - c.y) * s; ink = Math.max(ink, Math.min(1, Math.max(0, 1.6 + 0.45 * c.order - d))); }
      let acc = 0;
      for (let i = 0, m = tile.poly.length; i < m; i++) {
        const a = tile.poly[i], c = tile.poly[(i + 1) % m], ux = c[0] - a[0], uy = c[1] - a[1], l2 = ux * ux + uy * uy;
        const t = Math.max(0, Math.min(1, ((wx - a[0]) * ux + (wy - a[1]) * uy) / l2));
        acc = Math.max(acc, Math.min(1, Math.max(0, 1.5 - Math.hypot(wx - a[0] - t * ux, wy - a[1] - t * uy) * s)));
      }
      r = r * (1 - ink) + 26 * ink; g = g * (1 - ink) + 26 * ink; b = b * (1 - ink) + 31 * ink;
      r = r * (1 - acc) + 15 * acc; g = g * (1 - acc) + 118 * acc; b = b * (1 - acc) + 110 * acc;
      const o = 3 * ((oy + Y) * W + ox + X); img[o] = r; img[o + 1] = g; img[o + 2] = b;
    }
    [...group.id].forEach((ch, ci) => { const bits = FONT[ch]; if (!bits) return; for (let k = 0; k < 35; k++) if (bits[k] === '1') for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) { const o = 3 * ((oy + 4 + Math.floor(k / 5) * 2 + v) * W + ox + 4 + ci * 12 + (k % 5) * 2 + u); img[o] = 180; img[o + 1] = 60; img[o + 2] = 20; } });
  });
  return png(W, Hh, img);
}

export function writeSheet(file, items, opts) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, sheet(items, opts)); }
export { BY_ID, GROUPS, normalize, tileOf };
