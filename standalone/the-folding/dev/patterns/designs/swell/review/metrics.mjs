// review/metrics.mjs — how comma-like the marks of a design are, per group (the art director's proxies, not the kit's):
//   solidity  area / convex hull area of a mark: a pebble or wedge is near 1, a comma with a bay well below (0.6 - 0.8)
//   asym      the least share of a mark that differs from its own reflection over a line through its centroid
//             (min over 72 angles of |M xor s(M)| / |M|): a teardrop, wedge or rounded square is near 0, a comma 0.25+
//   len       the mark's longest extent (Feret diameter) in tile sizes
//   tileHold  share of the default tile's area covered by the largest mark lying in it (whether the tile holds a whole mark)
// Marks = the outer loops of the motif (holes subtract). Usage:
//   node review/metrics.mjs [design.js] [ids]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUPS, BY_ID } from '../../../../../src/groups.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const si = args.indexOf('--set'), setArg = si >= 0 ? args.splice(si, 2)[1] : null;
const designPath = args[0] && args[0].endsWith('.js') ? path.resolve(args[0]) : path.resolve(here, '../design.js');
const ids = (args.find((a) => !a.endsWith('.js')) || GROUPS.map((g) => g.id).join(',')).split(',');
const mod = await import(pathToFileURL(designPath).href);
if (setArg && mod.KNOBS) for (const kv of setArg.split(',')) { const [k, v] = kv.split('='); mod.KNOBS[k] = v.includes(';') ? v.split(';').map(Number) : Number.isNaN(+v) ? v : +v; }

function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function raster(poly, x0, y0, s, n) {        // n x n bitmap of the polygon over [x0, x0 + n s] x [y0, y0 + n s] (even-odd)
  const B = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    const y = y0 + (j + 0.5) * s, xs = [];
    for (let i = 0, m = poly.length, k = m - 1; i < m; k = i++) {
      const a = poly[k], b = poly[i];
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const i0 = Math.max(0, Math.ceil((xs[q] - x0) / s - 0.5)), i1 = Math.min(n - 1, Math.floor((xs[q + 1] - x0) / s - 0.5));
      for (let i = i0; i <= i1; i++) B[j * n + i] = 1;
    }
  }
  return B;
}
function markStats(poly) {
  const A = Math.abs(area(poly)), H = Math.abs(area(hull(poly)));
  let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  // the bitmap centred on the centroid, large enough for any reflection about a line through it
  let R = 0; for (const p of poly) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cy));
  const n = 140, s = (2.05 * R) / n, bx = cx - (n / 2) * s, by = cy - (n / 2) * s;
  const B = raster(poly, bx, by, s, n);
  // the area centroid from the bitmap (the vertex mean is biased by the sampling)
  let sx = 0, sy = 0, cnt = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (B[j * n + i]) { sx += bx + (i + 0.5) * s; sy += by + (j + 0.5) * s; cnt++; }
  const mx = sx / cnt, my = sy / cnt;
  let asym = Infinity;
  for (let k = 0; k < 72; k++) {
    const th = (k * Math.PI) / 72, c2 = Math.cos(2 * th), s2 = Math.sin(2 * th);
    let miss = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (!B[j * n + i]) continue;
      const x = bx + (i + 0.5) * s - mx, y = by + (j + 0.5) * s - my;
      const rx = c2 * x + s2 * y + mx, ry = s2 * x - c2 * y + my;
      const ii = Math.floor((rx - bx) / s), jj = Math.floor((ry - by) / s);
      if (ii < 0 || jj < 0 || ii >= n || jj >= n || !B[jj * n + ii]) miss++;
    }
    asym = Math.min(asym, (2 * miss) / cnt);          // |M xor sM| = 2 |M \ sM|
  }
  let feret = 0; const Hp = hull(poly);
  for (let i = 0; i < Hp.length; i++) for (let j = i + 1; j < Hp.length; j++) feret = Math.max(feret, Math.hypot(Hp[i][0] - Hp[j][0], Hp[i][1] - Hp[j][1]));
  return { A, solidity: A / H, asym, feret };
}

const rows = [];
for (const id of ids) {
  const g = BY_ID[id], u = Math.sqrt(g.domainArea);
  const t0 = performance.now();
  const res = mod.find(g);
  const ms = Math.round(performance.now() - t0);
  const marks = res.shapes.filter((s) => !s.hole).map((s) => ({ ...markStats(s.pts), n: s.pts.length }));
  marks.sort((a, b) => b.A - a.A);
  const r2 = (v) => Math.round(v * 100) / 100;
  const row = { id, ms, marks: marks.map((m) => ({ area: r2(m.A / g.domainArea), solidity: r2(m.solidity), asym: r2(m.asym), len: r2(m.feret / u) })) };
  rows.push(row);
  console.log(id.padEnd(6), String(ms).padStart(4) + 'ms', row.marks.map((m) => `[area ${m.area.toFixed(2)} sol ${m.solidity.toFixed(2)} asym ${m.asym.toFixed(2)} len ${m.len.toFixed(2)}]`).join(' '));
}
const main = rows.map((r) => r.marks[0]);
const avg = (k) => r2m(main.reduce((s, m) => s + m[k], 0) / main.length);
function r2m(v) { return Math.round(v * 100) / 100; }
console.log('MEAN main mark: solidity', avg('solidity'), 'asym', avg('asym'), 'len', avg('len'));
