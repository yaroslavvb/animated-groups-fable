// lab/lab.mjs — the Swell lab: a quick contact sheet of a design module drawn in node (no browser), with the numbers of
// kit.measure computed by scanline (same window, same grid, same formulas; the official sheet is dev/patterns/proto.mjs).
//   node dev/patterns/designs/swell/lab/lab.mjs --out <png> [--ids o,2222] [--px 400] [--cols 4] [--zoom 1.8]
//        [--side back] [--design ../design.js] [--site 1] [--measure 0] [--json <file>] [--set key=value,key=value]
// Colours: the tile in the paper's two tones; elsewhere the marks pale — teal for direct copies, sand for mirrored ones.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../../../../../src/groups.js';
import { normalize, orbitElements, tileOf, stabilizerOrder } from '../../../kit.js';
import { Canvas, fillCount } from './png.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url));
const px = +opt.px || 400, cols = +opt.cols || 4, zoom = +opt.zoom || 1, back = opt.side === 'back';
const doMeasure = opt.measure !== '0', showSite = opt.site === '1';
const mod = await import(pathToFileURL(path.resolve(here, opt.design || '../design.js')).href);
if (opt.set && mod.KNOBS) for (const kv of opt.set.split(',')) { const [k, v] = kv.split('='); mod.KNOBS[k] = v.includes(';') ? v.split(';').map(Number) : Number.isNaN(+v) ? v : +v; }
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const FRONT = [hex('#9ad5cc'), hex('#4fa397')], BACK = [hex('#f5e6c6'), hex('#d8bd85')], INK = hex('#1a1a1f'), ACCENT = hex('#0f766e');

function edt(on, w, h) {
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

/** kit.measure by scanline: the same window and grid, the tone from filled polygons instead of point tests. */
export function fastMeasure(group, N, per = 56) {
  const size = Math.sqrt(group.domainArea), h = size / per;
  const L = Math.max(Math.hypot(group.e1[0], group.e1[1]), Math.hypot(group.e2[0], group.e2[1]));
  const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;
  const w = Math.ceil((2 * (half + pad)) / h), x0 = group.center[0] - half - pad, y0 = group.center[1] - half - pad;
  const cnt = new Int16Array(w * w);
  const box = [x0, y0, x0 + w * h, y0 + w * h];
  const buf = [];
  for (const g of orbitElements(group, N, box)) for (const P of N.polys) {
    const p = P.pts, n = p.length / 2; buf.length = 2 * n;
    for (let i = 0; i < n; i++) { const x = p[2 * i], y = p[2 * i + 1]; buf[2 * i] = (g.a * x + g.b * y + g.tx - x0) / h; buf[2 * i + 1] = (g.c * x + g.d * y + g.ty - y0) / h; }
    fillCount(cnt, w, w, buf, P.hole ? -1 : 1);
  }
  const dark = new Uint8Array(w * w), light = new Uint8Array(w * w);
  let over = 0, inner = 0, nd = 0;
  const stab = stabilizerOrder(group, N);
  const inWin = (i, j) => Math.abs(x0 + (i + 0.5) * h - group.center[0]) <= half && Math.abs(y0 + (j + 0.5) * h - group.center[1]) <= half;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const W = cnt[j * w + i], t = W > 0 ? 1 : 0;
    dark[j * w + i] = t; light[j * w + i] = 1 - t;
    if (inWin(i, j)) { inner++; nd += t; if (W > stab) over++; }
  }
  const dToDark = edt(dark, w, w), dToLight = edt(light, w, w);
  let emptyR = 0, darkR = 0, ei = 0, ej = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    if (!inWin(i, j)) continue;
    if (dToDark[j * w + i] > emptyR) { emptyR = dToDark[j * w + i]; ei = i; ej = j; }
    darkR = Math.max(darkR, dToLight[j * w + i]);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  let area = 0; for (const P of N.polys) area += (P.hole ? -1 : 1) * P.area;                    // the share of a tile (kit.measure samples one lattice cell)
  return { coverage: r3(over ? nd / inner : area / group.domainArea), emptyDisc: r3((2 * emptyR * h) / size), darkDisc: r3((2 * darkR * h) / size), overlap: r3(over / inner), verts: N.verts,
    emptyAt: [x0 + (ei + 0.5) * h, y0 + (ej + 0.5) * h], emptyR: emptyR * h };
}

const capH = 30, gapPx = 8, n = ids.length, rows = Math.ceil(n / cols);
const cv = new Canvas(cols * (px + gapPx) + gapPx, rows * (px + capH + gapPx) + gapPx + 14);
cv.text(gapPx, 3, `${(mod.meta && mod.meta.label) || '?'}${back ? '  BACK' : ''}${zoom > 1 ? '  ZOOM ' + zoom : ''}  ${opt.set || ''}`.toUpperCase(), [40, 40, 46], 1);
const out = [];
ids.forEach((id, idx) => {
  const group = BY_ID[id];
  const ox = gapPx + (idx % cols) * (px + gapPx), oy = 14 + gapPx + Math.floor(idx / cols) * (px + capH + gapPx);
  const clipBox = [ox, oy, ox + px, oy + px];
  const row = { id };
  try {
    const t0 = performance.now();
    const res = showSite && mod.build ? mod.build(group) : mod.find(group);
    row.ms = Math.round(performance.now() - t0);
    const N = normalize(res.shapes);
    row.info = res.info;
    const tile = tileOf(group);
    const half = group.viewHalf / zoom, fx = zoom > 1 ? tile.seed[0] : group.center[0], fy = zoom > 1 ? tile.seed[1] : group.center[1], s = px / (2 * half);
    const mx = (x) => ox + (x - fx) * s + px / 2, my = (y) => oy + px / 2 - (y - fy) * s;
    const box = [fx - half, fy - half, fx + half, fy + half];
    const W = cv.w, H = cv.h;
    const cd = new Int16Array(W * H), cm = new Int16Array(W * H), tm = new Int16Array(W * H);
    const buf = [];
    for (const g of orbitElements(group, N, box)) {
      const mir = g.a * g.d - g.b * g.c < 0;
      for (const P of N.polys) {
        const p = P.pts, m = p.length / 2; buf.length = 2 * m;
        for (let i = 0; i < m; i++) { const x = p[2 * i], y = p[2 * i + 1]; buf[2 * i] = mx(g.a * x + g.b * y + g.tx); buf[2 * i + 1] = my(g.c * x + g.d * y + g.ty); }
        fillCount(mir ? cm : cd, W, H, buf, P.hole ? -1 : 1, clipBox);
      }
    }
    const tp = []; for (const p of tile.poly) tp.push(mx(p[0]), my(p[1]));
    fillCount(tm, W, H, tp, 1, clipBox);
    const tones = back ? BACK : FRONT;
    for (let y = oy; y < oy + px; y++) for (let x = ox; x < ox + px; x++) {
      const i = y * W + x, d = cd[i] > 0, m = cm[i] > 0;
      if (tm[i] > 0) { cv.blend(x, y, tones[0]); if (d || m) cv.blend(x, y, tones[1]); } else if (d) cv.blend(x, y, FRONT[1], 0.42); else if (m) cv.blend(x, y, BACK[1], 0.62);
      if (cd[i] + cm[i] > 1) cv.blend(x, y, [200, 40, 40], 0.8);          // two copies on one point: an overlap
    }
    // the comma itself (the site) of every copy, outlined
    if (showSite && res.site) {
      const S = res.site, sm = new Uint8Array(W * H);
      const els = elementsNear(group, fx, fy, half * 1.5 + S.R, S.cx, S.cy);
      for (const g of els) for (let k = 0; k < S.n; k++) {
        const cx = mx(g.a * S.x[k] + g.b * S.y[k] + g.tx), cy = my(g.c * S.x[k] + g.d * S.y[k] + g.ty), r = S.r[k] * s;
        for (let y = Math.max(oy, Math.floor(cy - r)); y <= Math.min(oy + px - 1, cy + r); y++) for (let x = Math.max(ox, Math.floor(cx - r)); x <= Math.min(ox + px - 1, cx + r); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) sm[y * W + x] = 1;
      }
      for (let y = oy + 1; y < oy + px - 1; y++) for (let x = ox + 1; x < ox + px - 1; x++) {
        const i = y * W + x;
        if (sm[i] && (!sm[i - 1] || !sm[i + 1] || !sm[i - W] || !sm[i + W])) cv.blend(x, y, [150, 30, 90], 0.75);
      }
    }
    const sym = symmetryElements(group, fx, fy, half * 1.6);
    for (const m of sym.glides) cv.line(mx(m.px - 9 * m.ux), my(m.py - 9 * m.uy), mx(m.px + 9 * m.ux), my(m.py + 9 * m.uy), 0.9, INK, 0.35, clipBox, 5);
    for (const m of sym.mirrors) cv.line(mx(m.px - 9 * m.ux), my(m.py - 9 * m.uy), mx(m.px + 9 * m.ux), my(m.py + 9 * m.uy), 1.3, INK, 1, clipBox);
    for (const p of sym.centers) cv.disc(mx(p.x), my(p.y), 1.2 + 0.45 * p.order, INK, 1, clipBox);
    for (let i = 0; i < tile.poly.length; i++) { const p = tile.poly[i], q = tile.poly[(i + 1) % tile.poly.length]; cv.line(mx(p[0]), my(p[1]), mx(q[0]), my(q[1]), 2.2, ACCENT, 1, clipBox); }
    if (doMeasure) {
      Object.assign(row, fastMeasure(group, N));
      if (opt.bare === '1') cv.disc(mx(row.emptyAt[0]), my(row.emptyAt[1]), row.emptyR * s, [220, 60, 60], 0.35, clipBox);
    }
    row.verts = N.verts;
    const pc = (v) => (v == null ? '-' : Math.round(100 * v) + '%');
    cv.text(ox, oy + px + 4, `${id}  DARK ${pc(row.coverage)}  BARE ${row.emptyDisc ?? '-'}  SOLID ${row.darkDisc ?? '-'}`, row.overlap > 0.004 ? [180, 60, 0] : INK);
    const inf = res.info || {};
    cv.text(ox, oy + px + 16, `${N.verts} PTS  ${row.ms} MS  LAM ${inf.lambda ?? '-'} W ${inf.channel ?? '-'} IN ${inf.inner ?? '-'}${row.overlap > 0.004 ? '  OVERLAP ' + pc(row.overlap) : ''}  ${inf.comma ? 'T' + inf.comma.turn + ' P' + inf.comma.taper + ' S' + inf.comma.share : ''}`, [82, 81, 74]);
  } catch (e) {
    row.error = String((e && e.stack) || e);
    cv.text(ox, oy + px + 4, `${id} ERROR ${String(e && e.message).slice(0, 50)}`, [180, 60, 0]);
    console.log('ROW ERROR ' + id + ' ' + row.error);
  }
  // frame
  for (const [a, b, c, d] of [[ox, oy, ox + px, oy], [ox, oy + px, ox + px, oy + px], [ox, oy, ox, oy + px], [ox + px, oy, ox + px, oy + px]]) cv.line(a, b, c, d, 1, [229, 229, 234], 1);
  out.push(row);
});
if (opt.out) { cv.save(path.resolve(opt.out)); console.log('WROTE ' + path.resolve(opt.out)); }
if (opt.json) fs.writeFileSync(path.resolve(opt.json), JSON.stringify(out, null, 1));
for (const r of out) console.log(JSON.stringify({ id: r.id, ms: r.ms, cov: r.coverage, bare: r.emptyDisc, solid: r.darkDisc, over: r.overlap, verts: r.verts, info: r.info, error: r.error && r.error.split('\n')[0] }));
