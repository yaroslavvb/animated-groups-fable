// node dev/look.mjs <ids> <out.png> [--per 70] [--half 1.6] [--cols 4] [--design ../design.js]
// A local look without a browser: the print around each group's default tile (front tones), the tile outline, mirrors
// in ink, and the LARGEST BARE DISC (red ring) and LARGEST SOLID DISC (blue ring) of the window, with their diameters
// in tile sizes. Lengths: tile sizes. Small grids only (a few seconds).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { GROUPS, BY_ID, symmetryElements } from '../../../../../src/groups.js';
import { normalize, windingAt, tileOf } from '../../../kit.js';

const args = process.argv.slice(2), opt = {};
const pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const ids = pos[0] === 'all' ? GROUPS.map((g) => g.id) : pos[0].split(',');
const out = pos[1];
const per = +opt.per || 70, half = +opt.half || 1.6;
const mod = await import(path.resolve(path.dirname(new URL(import.meta.url).pathname), opt.design || '../design.js'));
// --vars <file.json>: a list of knob overrides (an object, or { <id>: object }); one row per variant
const vars = opt.vars ? JSON.parse(fs.readFileSync(opt.vars, 'utf8')) : null;
const cols = vars ? ids.length : (+opt.cols || Math.min(4, ids.length));
const jobs = vars ? vars.flatMap((v, vi) => ids.map((id) => ({ id, vi, over: v[id] !== undefined ? v[id] : (Object.keys(v).some((k) => BY_ID[k]) ? (v.all || {}) : v) }))) : ids.map((id) => ({ id, vi: 0, over: null }));

const LIGHT = [0x9a, 0xd5, 0xcc], DARK = [0x4f, 0xa3, 0x97], PALE_L = [0xf4, 0xfa, 0xf9], PALE_D = [0xc5, 0xe3, 0xde];

function edt(on, w, h) {          // distance (cells) to the nearest cell with on[] set
  const INF = 1e20, n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), outD = new Float64Array(w * h);
  const pass = (len) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : INF; pass(h); for (let y = 0; y < h; y++) outD[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = outD[y * w + x]; pass(w); for (let x = 0; x < w; x++) outD[y * w + x] = Math.sqrt(d[x]); }
  return outD;
}

const P = Math.round(2 * half * per);           // panel size in px
const rowsN = Math.ceil(jobs.length / cols), W = cols * (P + 8) + 8, H = rowsN * (P + 8) + 8;
const img = new Uint8Array(W * H * 3).fill(255);
const put = (x, y, c, a = 1) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = 3 * (y * W + x); for (let k = 0; k < 3; k++) img[i + k] += (c[k] - img[i + k]) * a; };
const report = [];
jobs.forEach(({ id, vi, over }, idx) => {
  const g = BY_ID[id], s = Math.sqrt(g.domainArea), t = tileOf(g);
  const res = over ? mod.findWith(g, over) : mod.find(g), N = normalize(res.shapes);
  let cx = 0, cy = 0; for (const p of t.poly) { cx += p[0] / t.poly.length; cy += p[1] / t.poly.length; }
  const h = s / per, x0 = cx - half * s, y0 = cy - half * s;
  const pad = Math.round(0.8 * per), Wg = P + 2 * pad;           // the measuring grid is wider than the panel
  const dark = new Uint8Array(Wg * Wg), light = new Uint8Array(Wg * Wg);
  for (let j = 0; j < Wg; j++) for (let i = 0; i < Wg; i++) {
    const x = x0 + (i - pad + 0.5) * h, y = y0 + (j - pad + 0.5) * h, d = windingAt(g, N, x, y) > 0 ? 1 : 0;
    dark[j * Wg + i] = d; light[j * Wg + i] = 1 - d;
  }
  const dD = edt(dark, Wg, Wg), dL = edt(light, Wg, Wg);
  let bare = { r: 0 }, solid = { r: 0 }, nd = 0;
  for (let j = pad; j < pad + P; j++) for (let i = pad; i < pad + P; i++) {
    const k = j * Wg + i; nd += dark[k];
    if (dD[k] > bare.r) bare = { r: dD[k], i, j };
    if (dL[k] > solid.r) solid = { r: dL[k], i, j };
  }
  // of the places within a pixel of the largest, the one nearest the tile
  const nearest = (D, best) => { let o = best, od = Infinity; const c0 = pad + P / 2; for (let j = pad; j < pad + P; j++) for (let i = pad; i < pad + P; i++) { const k = j * Wg + i; if (D[k] >= best.r - 0.7) { const dd = Math.hypot(i - c0, j - c0); if (dd < od) { od = dd; o = { r: best.r, i, j }; } } } return o; };
  bare = nearest(dD, bare); solid = nearest(dL, solid);
  const ox = 8 + (idx % cols) * (P + 8), oy = 8 + Math.floor(idx / cols) * (P + 8);
  // inside the tile: front tones; outside: pale tones
  const inTile = (x, y) => { const Q = t.poly; let inn = false; for (let a = 0, b = Q.length - 1; a < Q.length; b = a++) { if ((Q[a][1] > y) !== (Q[b][1] > y) && x < Q[a][0] + ((y - Q[a][1]) * (Q[b][0] - Q[a][0])) / (Q[b][1] - Q[a][1])) inn = !inn; } return inn; };
  for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h, d = dark[(j + pad) * Wg + i + pad];
    const c = inTile(x, y) ? (d ? DARK : LIGHT) : (d ? PALE_D : PALE_L);
    put(ox + i, oy + P - 1 - j, c);
  }
  const toPx = (x, y) => [ox + (x - x0) / h, oy + P - (y - y0) / h];
  const clipPut = (x, y, c, a) => { if (x >= ox && x < ox + P && y >= oy && y < oy + P) put(x, y, c, a); };
  const seg = (a, b, c, wdt = 1) => { const [ax, ay] = toPx(a[0], a[1]), [bx, by] = toPx(b[0], b[1]); const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2); for (let k = 0; k <= n; k++) { const xx = ax + (bx - ax) * k / n, yy = ay + (by - ay) * k / n; for (let dx = -wdt + 1; dx < wdt; dx++) for (let dy = -wdt + 1; dy < wdt; dy++) clipPut(Math.round(xx) + dx, Math.round(yy) + dy, c, 0.8); } };
  const sym = symmetryElements(g, cx, cy, 2.5 * half * s);
  for (const m of sym.mirrors) seg([m.px - 9 * m.ux, m.py - 9 * m.uy], [m.px + 9 * m.ux, m.py + 9 * m.uy], [26, 26, 31]);
  for (let k = 0; k < t.poly.length; k++) seg(t.poly[k], t.poly[(k + 1) % t.poly.length], [15, 110, 100], 2);
  const ring = (ci, cj, r, c) => { for (let k = 0; k < 360; k++) { const f = k * Math.PI / 180; clipPut(Math.round(ox + ci - pad + r * Math.cos(f)), Math.round(oy + P - 1 - (cj - pad) + r * Math.sin(f)), c, 1); clipPut(Math.round(ox + ci - pad + (r - 1) * Math.cos(f)), Math.round(oy + P - 1 - (cj - pad) + (r - 1) * Math.sin(f)), c, 1); } };
  ring(bare.i, bare.j, bare.r, [220, 30, 30]);
  ring(solid.i, solid.j, solid.r, [30, 60, 220]);
  const toLoc = (i, j) => { const x = x0 + (i - pad + 0.5) * h - cx, y = y0 + (j - pad + 0.5) * h - cy; return [(x / s).toFixed(2), (y / s).toFixed(2)]; };
  report.push(`${vars ? 'v' + vi + ' ' : ''}${id.padEnd(6)} window-dark ${(nd / (P * P)).toFixed(3)}  bare ${(2 * bare.r / per).toFixed(3)} at (${toLoc(bare.i, bare.j)})  solid ${(2 * solid.r / per).toFixed(3)} at (${toLoc(solid.i, solid.j)})  verts ${N.verts}`);
});
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const chunk = (type, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([l, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(path.resolve(out), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(report.join('\n'));
