// dev/patterns/designs/bigcomma/preview.mjs — a LOCAL look at a design (no browser): a contact sheet as a PNG, drawn by
// a small scanline rasteriser the way dev/patterns/proto.html draws it, and the numbers of kit.measure on stdout.
//   node dev/patterns/designs/bigcomma/preview.mjs --out <png> [--design designs/bigcomma/design.js] [--ids 333,*x]
//        [--px 300] [--cols 4] [--zoom 1] [--side back] [--measure 1] [--per 56] [--gap 1]
// One short run (a few seconds for all 17); the official sheet is still dev/patterns/proto.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../../../../src/groups.js';
import { PRINT_FRONT, PRINT_BACK, PRINT_PLANE_ALPHA, PRINT_PLANE_ALPHA_BACK, INK, ACCENT } from '../../../../src/palette.js';
import { normalize, orbitElements, measure, tileOf, GAP_MIN, MAX_VERTS } from '../../kit.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url));
const designPath = path.resolve(here, '../..', opt.design || 'designs/bigcomma/design.js');
const mod = await import(pathToFileURL(designPath).href + '?t=' + Date.now());
if (opt.knobs && mod.KNOBS) for (const kv of opt.knobs.split(',')) { const [k, v] = kv.split('='); mod.KNOBS[k] = +v; }   // --knobs press=0.3,dots=2
const px = +opt.px || 300, cols = +opt.cols || 4, zoom = +opt.zoom || 1, back = opt.side === 'back', SS = 2;
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const doMeasure = opt.measure === '1', doGap = opt.gap !== '0';

const TAU_ = 2 * Math.PI;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (c, a) => c.map((v) => Math.round(255 + (v - 255) * a));
const pad = 8, rows = Math.ceil(ids.length / cols), W = cols * (px + pad) + pad, Hh = rows * (px + pad) + pad;
const img = new Uint8Array(W * Hh * 3).fill(255);

function fillPolys(buf, n, polys, val) {            // polys: [[x, y]...] in sample coordinates; adds val inside (even-odd per polygon)
  for (const P of polys) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of P) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const ya = Math.max(0, Math.ceil(y0 - 0.5)), yb = Math.min(n - 1, Math.floor(y1 - 0.5));
    const xs = [];
    for (let y = ya; y <= yb; y++) {
      const yc = y + 0.5; xs.length = 0;
      for (let i = 0, m = P.length, j = m - 1; i < m; j = i++) {
        const a = P[i], b = P[j];
        if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(n - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) buf[y * n + x] += val;
      }
    }
  }
}

function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
function minGap(group, N) {                          // smallest distance between the motif and another copy of it (world units)
  const size = Math.sqrt(group.domainArea);
  const els = elementsNear(group, N.cx, N.cy, 2 * N.R + 0.5 * size, N.cx, N.cy);
  const pts = [];
  for (const P of N.polys) for (let i = 0; i < P.pts.length; i += 2) pts.push([P.pts[i], P.pts[i + 1]]);
  let best = Infinity, inside = 0;
  for (const g of els) {
    const ident = Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.hypot(g.tx, g.ty) < 1e-9;
    if (ident) continue;
    for (const P of N.polys) {
      const m = P.pts.length / 2, Q = new Float64Array(2 * m);
      for (let i = 0; i < m; i++) { const x = P.pts[2 * i], y = P.pts[2 * i + 1]; Q[2 * i] = g.a * x + g.b * y + g.tx; Q[2 * i + 1] = g.c * x + g.d * y + g.ty; }
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let i = 0; i < m; i++) { bx0 = Math.min(bx0, Q[2 * i]); by0 = Math.min(by0, Q[2 * i + 1]); bx1 = Math.max(bx1, Q[2 * i]); by1 = Math.max(by1, Q[2 * i + 1]); }
      for (const p of pts) {
        if (p[0] < bx0 - best || p[0] > bx1 + best || p[1] < by0 - best || p[1] > by1 + best) continue;
        for (let i = 0; i < m; i++) { const j = (i + 1) % m; const d = segDist(p[0], p[1], Q[2 * i], Q[2 * i + 1], Q[2 * j], Q[2 * j + 1]); if (d < best) best = d; }
      }
    }
  }
  return best / size;
}
function selfCross(N) {                              // does a polygon of the motif cross itself?
  for (const P of N.polys) {
    const p = P.pts, n = p.length / 2;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * ((i + 1) % n)], by = p[2 * ((i + 1) % n) + 1];
      const cx = p[2 * j], cy = p[2 * j + 1], dx = p[2 * ((j + 1) % n)], dy = p[2 * ((j + 1) % n) + 1];
      const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      if ((d1 > 0) === (d2 > 0)) continue;
      const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      if ((d3 > 0) !== (d4 > 0)) return true;
    }
  }
  return false;
}

function edt(on, w, h) {                              // exact Euclidean distance (in cells) to the nearest cell with on[i]
  const INF = 1e20, f = new Float64Array(Math.max(w, h)), d = new Float64Array(w * h), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const pass = (n, get, set) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      for (;;) { const p = v[k]; s = (get(q) + q * q - (get(p) + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; } else { k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; set(q, (q - p) * (q - p) + get(p)); }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : INF; const col = f.slice(0, h); pass(h, (i) => col[i], (i, val) => { d[i * w + x] = val; }); }
  for (let y = 0; y < h; y++) { const row = d.slice(y * w, y * w + w); pass(w, (i) => row[i], (i, val) => { d[y * w + i] = val; }); }
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(d[i]);
  return d;
}
const doDiscs = opt.discs !== '0';

const out = [];
ids.forEach((id, q) => {
  const group = BY_ID[id], row = { id };
  try {
    // --strip 1: hand the design what the tests hand it (no presets, no viewHalf)
    const given = opt.strip === '1' ? { id: group.id, e1: group.e1, e2: group.e2, reps: group.reps, cellArea: group.cellArea, domainArea: group.domainArea, center: group.center } : group;
    mod.find(given);                                 // warm (the first call builds the design's tables)
    const t0 = performance.now();
    const res = mod.find(given);
    row.ms = +(performance.now() - t0).toFixed(1);
    const N = normalize(res.shapes);
    row.verts = N.verts; row.info = res.info;
    const n = px * SS, half = group.viewHalf / zoom, tile = tileOf(group);
    const fx = zoom > 1 ? tile.seed[0] : group.center[0], fy = zoom > 1 ? tile.seed[1] : group.center[1], s = n / (2 * half);
    const mapx = (x) => (x - fx) * s + n / 2, mapy = (y) => n / 2 - (y - fy) * s;
    const box = [fx - half, fy - half, fx + half, fy + half];
    // the print
    const wind = new Int16Array(n * n);
    for (const g of orbitElements(group, N, box)) {
      for (const P of N.polys) {
        const poly = [];
        for (let i = 0; i < P.pts.length; i += 2) { const x = P.pts[i], y = P.pts[i + 1]; poly.push([mapx(g.a * x + g.b * y + g.tx), mapy(g.c * x + g.d * y + g.ty)]); }
        fillPolys(wind, n, [poly], P.hole ? -1 : 1);
      }
    }
    // the copies of the tile, by hand; the tile itself
    const hand = new Int16Array(n * n), own = new Int16Array(n * n);
    const els = elementsNear(group, fx, fy, half * 1.5 + 2 * Math.sqrt(group.domainArea), tile.seed[0], tile.seed[1]);
    for (const g of els) {
      const poly = tile.poly.map((p) => [mapx(g.a * p[0] + g.b * p[1] + g.tx), mapy(g.c * p[0] + g.d * p[1] + g.ty)]);
      fillPolys(hand, n, [poly], g.a * g.d - g.b * g.c > 0 ? 1 : -1);
    }
    fillPolys(own, n, [tile.poly.map((p) => [mapx(p[0]), mapy(p[1])])], 1);
    const tones = (back ? PRINT_BACK : PRINT_FRONT).map(hex);
    const paleF = mix(hex(PRINT_FRONT[1]), PRINT_PLANE_ALPHA), paleB = mix(hex(PRINT_BACK[1]), PRINT_PLANE_ALPHA_BACK);
    const ink = hex(INK), acc = hex(ACCENT);
    // lines: mirrors, glides, the tile's outline; centres
    const sym = symmetryElements(group, fx, fy, half * 1.6);
    const lines = [];
    for (const m of sym.mirrors) lines.push([mapx(m.px - 9 * m.ux), mapy(m.py - 9 * m.uy), mapx(m.px + 9 * m.ux), mapy(m.py + 9 * m.uy), 1.3 * SS / 2, ink, 1]);
    for (const m of sym.glides) lines.push([mapx(m.px - 9 * m.ux), mapy(m.py - 9 * m.uy), mapx(m.px + 9 * m.ux), mapy(m.py + 9 * m.uy), 0.8 * SS / 2, [150, 150, 158], 1]);
    tile.poly.forEach((p, i) => { const r = tile.poly[(i + 1) % tile.poly.length]; lines.push([mapx(p[0]), mapy(p[1]), mapx(r[0]), mapy(r[1]), 2.2 * SS / 2, acc, 1]); });
    const cell = new Uint8Array(n * n * 3);
    for (let i = 0; i < n * n; i++) {
      const dark = wind[i] > 0;
      let c = [255, 255, 255];
      if (own[i] > 0) c = dark ? tones[1] : tones[0]; else if (dark) c = hand[i] < 0 ? paleB : paleF;
      cell[3 * i] = c[0]; cell[3 * i + 1] = c[1]; cell[3 * i + 2] = c[2];
    }
    for (const L of lines) {
      const [ax, ay, bx, by, hw, col] = L;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - hw - 1)), x1 = Math.min(n - 1, Math.ceil(Math.max(ax, bx) + hw + 1));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - hw - 1)), y1 = Math.min(n - 1, Math.ceil(Math.max(ay, by) + hw + 1));
      const steep = Math.abs(by - ay) > Math.abs(bx - ax);
      if (steep) { for (let y = y0; y <= y1; y++) { const t = (y + 0.5 - ay) / (by - ay); const xc = ax + t * (bx - ax); for (let x = Math.max(x0, Math.floor(xc - hw - 2)); x <= Math.min(x1, Math.ceil(xc + hw + 2)); x++) if (segDist(x + 0.5, y + 0.5, ax, ay, bx, by) <= hw) { cell[3 * (y * n + x)] = col[0]; cell[3 * (y * n + x) + 1] = col[1]; cell[3 * (y * n + x) + 2] = col[2]; } } } else { for (let x = x0; x <= x1; x++) { const t = (x + 0.5 - ax) / (bx - ax || 1e-9); const yc = ay + t * (by - ay); for (let y = Math.max(y0, Math.floor(yc - hw - 2)); y <= Math.min(y1, Math.ceil(yc + hw + 2)); y++) if (segDist(x + 0.5, y + 0.5, ax, ay, bx, by) <= hw) { cell[3 * (y * n + x)] = col[0]; cell[3 * (y * n + x) + 1] = col[1]; cell[3 * (y * n + x) + 2] = col[2]; } } }
    }
    if (doDiscs) {                                   // the largest bare disc (red ring) and the largest solid disc (blue ring), centred in the middle part of the window
      const dk = new Uint8Array(n * n), lt = new Uint8Array(n * n);
      for (let i = 0; i < n * n; i++) { dk[i] = wind[i] > 0 ? 1 : 0; lt[i] = 1 - dk[i]; }
      const dD = edt(dk, n, n), dL = edt(lt, n, n), lo = Math.round(n * 0.22), hi = n - lo;
      let be = 0, bx = 0, by = 0, bs = 0, cx2 = 0, cy2 = 0;
      for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) { const i = y * n + x; if (dD[i] > be) { be = dD[i]; bx = x; by = y; } if (dL[i] > bs) { bs = dL[i]; cx2 = x; cy2 = y; } }
      row.bareLocal = +((2 * be) / (s * Math.sqrt(group.domainArea))).toFixed(3); row.solidLocal = +((2 * bs) / (s * Math.sqrt(group.domainArea))).toFixed(3);
      for (const [cx, cy, r, col] of [[bx + 0.5, by + 0.5, be, [214, 60, 60]], [cx2 + 0.5, cy2 + 0.5, bs, [40, 90, 200]]]) {
        const m = Math.ceil(TAU_ * r * 1.2);
        for (let k = 0; k < m; k++) { const a = (TAU_ * k) / m, x = Math.round(cx + r * Math.cos(a) - 0.5), y = Math.round(cy + r * Math.sin(a) - 0.5); for (let v = -1; v <= 1; v++) for (let u2 = -1; u2 <= 1; u2++) { const X = x + u2, Y = y + v; if (X >= 0 && Y >= 0 && X < n && Y < n) { cell[3 * (Y * n + X)] = col[0]; cell[3 * (Y * n + X) + 1] = col[1]; cell[3 * (Y * n + X) + 2] = col[2]; } } }
      }
    }
    for (const p of sym.centers) {
      const cx = mapx(p.x), cy = mapy(p.y), r = (1.2 + 0.45 * p.order) * SS;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(n - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(n - 1, Math.ceil(cx + r)); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) { cell[3 * (y * n + x)] = ink[0]; cell[3 * (y * n + x) + 1] = ink[1]; cell[3 * (y * n + x) + 2] = ink[2]; }
    }
    // downsample into the sheet
    const ox = pad + (q % cols) * (px + pad), oy = pad + Math.floor(q / cols) * (px + pad);
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) for (let k = 0; k < 3; k++) {
      let sum = 0;
      for (let v = 0; v < SS; v++) for (let u2 = 0; u2 < SS; u2++) sum += cell[3 * ((y * SS + v) * n + x * SS + u2) + k];
      img[3 * ((oy + y) * W + ox + x) + k] = Math.round(sum / (SS * SS));
    }
    if (doMeasure) Object.assign(row, measure(group, N, { per: +opt.per || 56 }));
    if (doGap) { row.gap = +minGap(group, N).toFixed(4); row.selfCross = selfCross(N) || undefined; }
    // how much of the main mark lies in the default tile
    const P0 = N.polys[0]; let inn = 0;
    for (let i = 0; i < P0.pts.length; i += 2) if (tile.domain.contains(P0.pts[i], P0.pts[i + 1], 1e-9)) inn++;
    row.inTile = +(inn / (P0.pts.length / 2)).toFixed(3);
  } catch (e) { row.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  out.push(row);
});

// PNG
const raw = Buffer.alloc((W * 3 + 1) * Hh);
for (let y = 0; y < Hh; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(Hh, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
if (opt.out) { fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true }); fs.writeFileSync(path.resolve(opt.out), png); }
for (const r of out) {
  if (r.error) { console.log(r.id.padEnd(6), 'ERROR', r.error); continue; }
  const f = (v) => (v == null ? '  -  ' : v.toFixed(3));
  console.log(r.id.padEnd(6), 'ms', String(r.ms).padStart(6), 'pts', String(r.verts).padStart(4), doMeasure ? `dark ${f(r.coverage)} bare ${f(r.emptyDisc)} solid ${f(r.darkDisc)} over ${f(r.overlap)}` : '',
    doDiscs ? `bare~ ${f(r.bareLocal)} solid~ ${f(r.solidLocal)}` : '', doGap ? `gap ${f(r.gap)}${r.gap < GAP_MIN ? ' !!' : ''}${r.selfCross ? ' SELF-CROSS' : ''}` : '', 'inTile', f(r.inTile), JSON.stringify(r.info));
}
if (opt.out) console.log('WROTE', path.resolve(opt.out));
