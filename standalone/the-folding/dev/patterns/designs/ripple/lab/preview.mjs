// designs/ripple/lab/preview.mjs — a quick look at a design without a browser: a contact sheet as a PNG, drawn by a small
// scanline rasteriser in node (a few seconds, one core), plus the numbers of kit.measure computed the same way.
//   node dev/patterns/designs/ripple/lab/preview.mjs --out <png> [--ids o,2222] [--px 360] [--cols 4] [--zoom 1.8]
//        [--side back] [--design ../design.js] [--bare 1 (no presets: the fallback seat)] [--turn 0.7 (a turned, scaled, shifted group)]
//        [--measure 0] [--lines 0] [--knobs '{"WIDE":0}' (overrides of the design's KNOBS, for experiments)]
// The official sheet is dev/patterns/proto.mjs (a Chrome on the mini); this one is for the many looks in between.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUPS, BY_ID, symmetryElements, elementsNear } from '../../../../../src/groups.js';
import { PRINT_FRONT, PRINT_BACK, INK, ACCENT } from '../../../../../src/palette.js';
import { normalize, tileOf } from '../../../kit.js';
import { windingRaster, fastMeasure, carried } from './raster.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url));
const mod = await import(pathToFileURL(path.resolve(here, opt.design || '../design.js')).href);
const px = +opt.px || 360, cols = +opt.cols || 4, zoom = +opt.zoom || 1, back = opt.side === 'back';
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const SS = 3;

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

const rows = Math.ceil(ids.length / cols), GAP = 8, IW = cols * (px + GAP) + GAP, IH = rows * (px + GAP) + GAP;
const img = new Uint8Array(IW * IH * 3).fill(255);
const report = [];

ids.forEach((id, idx) => {
  const base = BY_ID[id];
  let group = base;
  if (opt.turn !== undefined) group = carried(base, +opt.turn, 1.37, [0.31, -0.23]);
  else if (opt.bare) group = { id: base.id, e1: base.e1, e2: base.e2, reps: base.reps, cellArea: base.cellArea, domainArea: base.domainArea, center: base.center };
  const ox = GAP + (idx % cols) * (px + GAP), oy = GAP + Math.floor(idx / cols) * (px + GAP);
  const row = { id };
  try {
    const t0 = performance.now();
    const res = mod.find(group, opt.knobs ? JSON.parse(opt.knobs) : undefined);
    row.ms = Math.round(performance.now() - t0);
    const N = normalize(res.shapes);
    row.info = res.info;
    const size = Math.sqrt(group.domainArea);
    const viewHalf = (group.viewHalf || 2.1 * size * Math.sqrt(group.reps.length > 6 ? 1.2 : 1)) / zoom;
    let tile = null;
    try { tile = group.presets ? tileOf(group) : null; } catch { tile = null; }
    const fx = zoom > 1 && tile ? tile.seed[0] : group.center[0], fy = zoom > 1 && tile ? tile.seed[1] : group.center[1];
    const s = px / (2 * viewHalf), W = px * SS, x0 = fx - viewHalf, y0 = fy - viewHalf;
    const Wn = windingRaster(group, N, x0, y0, s * SS, W, W);
    let Tn = null;
    if (tile) { const T = normalize([{ pts: tile.poly }]); Tn = windingRaster(group, T, x0, y0, s * SS, W, W, T.polys); }
    const tones = back ? PRINT_BACK : PRINT_FRONT, lt = hex(tones[0]), dk = hex(tones[1]), pale = hex(PRINT_FRONT[1]);
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
      let r = 0, g = 0, b = 0;
      for (let b2 = 0; b2 < SS; b2++) for (let a2 = 0; a2 < SS; a2++) {
        const q = (j * SS + b2) * W + i * SS + a2, dark = Wn[q] > 0, inT = Tn ? Tn[q] !== 0 : false;
        if (inT) { const c = dark ? dk : lt; r += c[0]; g += c[1]; b += c[2]; } else if (dark) { r += 255 + 0.42 * (pale[0] - 255); g += 255 + 0.42 * (pale[1] - 255); b += 255 + 0.42 * (pale[2] - 255); } else { r += 255; g += 255; b += 255; }
      }
      const o = ((oy + px - 1 - j) * IW + ox + i) * 3;
      img[o] = r / (SS * SS); img[o + 1] = g / (SS * SS); img[o + 2] = b / (SS * SS);
    }
    // lines
    const blend = (i, j, c, a) => { if (i < 0 || j < 0 || i >= px || j >= px || a <= 0) return; const o = ((oy + px - 1 - j) * IW + ox + i) * 3; img[o] += (c[0] - img[o]) * a; img[o + 1] += (c[1] - img[o + 1]) * a; img[o + 2] += (c[2] - img[o + 2]) * a; };
    const line = (ax, ay, bx, by, wd, c, alpha = 1, dash = 0) => {
      const X0 = (ax - x0) * s, Y0 = (ay - y0) * s, X1 = (bx - x0) * s, Y1 = (by - y0) * s, dx = X1 - X0, dy = Y1 - Y0, l = Math.hypot(dx, dy);
      if (l < 1e-9) return;
      const i0 = Math.max(0, Math.floor(Math.min(X0, X1) - wd - 1)), i1 = Math.min(px - 1, Math.ceil(Math.max(X0, X1) + wd + 1));
      const j0 = Math.max(0, Math.floor(Math.min(Y0, Y1) - wd - 1)), j1 = Math.min(px - 1, Math.ceil(Math.max(Y0, Y1) + wd + 1));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const qx = i + 0.5 - X0, qy = j + 0.5 - Y0;
        let t = (qx * dx + qy * dy) / (l * l); t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (dash && Math.floor((t * l) / dash) % 2) continue;
        const d = Math.hypot(qx - t * dx, qy - t * dy), a = Math.max(0, Math.min(1, wd / 2 + 0.5 - d));
        blend(i, j, c, a * alpha);
      }
    };
    if (opt.lines !== '0') {
      const sym = symmetryElements(group, fx, fy, viewHalf * 1.6), ink = hex(INK);
      for (const m of sym.mirrors) line(m.px - 9 * m.ux, m.py - 9 * m.uy, m.px + 9 * m.ux, m.py + 9 * m.uy, 1.3, ink);
      for (const m of sym.glides) line(m.px - 9 * m.ux, m.py - 9 * m.uy, m.px + 9 * m.ux, m.py + 9 * m.uy, 0.8, ink, 0.35, 5);
      for (const p of sym.centers) { const rr = 1.2 + 0.45 * p.order; line(p.x - 1e-6, p.y, p.x + 1e-6, p.y, 2 * rr, ink); }
      if (tile) { const acc = hex(ACCENT); tile.poly.forEach((p, k) => { const q = tile.poly[(k + 1) % tile.poly.length]; line(p[0], p[1], q[0], q[1], 2.2, acc); }); }
    }
    if (opt.measure !== '0') Object.assign(row, fastMeasure(group, N));
    row.verts = N.verts;
  } catch (e) { row.error = String((e && e.stack) || e); }
  report.push(row);
});

// the PNG
const raw = Buffer.alloc((IW * 3 + 1) * IH);
for (let y = 0; y < IH; y++) { raw[y * (IW * 3 + 1)] = 0; Buffer.from(img.buffer, y * IW * 3, IW * 3).copy(raw, y * (IW * 3 + 1) + 1); }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(IW, 0); ihdr.writeUInt32BE(IH, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
const out = path.resolve(opt.out || path.join(here, 'preview.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
for (const r of report) {
  if (r.error) { console.log(`${r.id.padEnd(6)} ERROR ${r.error.split('\n').slice(0, 3).join(' | ')}`); continue; }
  const i = r.info || {};
  console.log(`${r.id.padEnd(6)} ${String(r.ms).padStart(4)} ms  dark ${r.coverage ?? '-'} (exact ${r.exact ?? '-'})  bare ${r.emptyDisc ?? '-'}  solid ${r.darkDisc ?? '-'}  overlap ${r.overlap ?? '-'}  pts ${r.verts}  | r ${i.r} sig ${i.sigma} A ${i.stretch} depth ${i.depth} nb ${i.neighbours}+${i.mirrors}m grid ${i.grid} corners ${JSON.stringify(i.corners)} dropped ${i.dropped}`);
}
console.log('WROTE ' + out);
