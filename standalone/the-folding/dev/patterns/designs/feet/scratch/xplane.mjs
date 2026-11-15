// scratch: the plane around the default tile, drawn locally as SVG, with the largest bare disc (red) and the largest
// all-dark disc (blue) marked and their diameters (tile sizes) printed. A cheaper, local cousin of kit.measure: the
// window is the tile's box plus a margin, so the numbers are those of kit.measure only if the worst disc is near the tile
// (it is: the pattern is periodic and every tile is alike).
//   node dev/patterns/designs/feet/scratch/plane.mjs --ids '*2222,442' --out <file.svg> [--variant k=v,..] [--per 44] [--margin 0.9]
import fs from 'node:fs';
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../../../../../src/groups.js';
import { tileOf, normalize, windingAt, orbitElements } from '../../../kit.js';
import { find } from '../design.js';
const findWith = (g, V) => find(g, Object.fromEntries(Object.entries(V).map(([k, v]) => [k, v === "true" ? true : v === "false" ? false : isNaN(+v) ? v : +v])));

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const V = {};
for (const kv of (opt.variant || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); V[k] = v; }
const per = +opt.per || 44, margin = +opt.margin || 0.9;

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

const cols = Math.ceil(Math.sqrt(ids.length)), rows = Math.ceil(ids.length / cols), px = Math.floor(1600 / cols);
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * px}" height="${rows * px}" viewBox="0 0 ${cols * px} ${rows * px}"><rect width="100%" height="100%" fill="#fff"/>`;
ids.forEach((id, k) => {
  const g = BY_ID[id], res = findWith(g, V), ts = Math.sqrt(g.domainArea), tile = tileOf(g), N = normalize(res.shapes);
  const xs = tile.poly.map((p) => p[0]), ys = tile.poly.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + margin * ts, pad = 0.75 * ts;
  const h = ts / per, w = Math.ceil((2 * (half + pad)) / h), x0 = cx - half - pad, y0 = cy - half - pad;
  const dark = new Uint8Array(w * w), light = new Uint8Array(w * w);
  let nd = 0, ni = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h, t = windingAt(g, N, x, y) > 0 ? 1 : 0;
    dark[j * w + i] = t; light[j * w + i] = 1 - t;
    if (Math.abs(x - cx) <= half && Math.abs(y - cy) <= half) { ni++; nd += t; }
  }
  const dD = edt(dark, w, w), dL = edt(light, w, w);
  let eb = { r: 0 }, db = { r: 0 };
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (Math.abs(x - cx) > half || Math.abs(y - cy) > half) continue;
    if (dD[j * w + i] > eb.r) eb = { r: dD[j * w + i], x, y };
    if (dL[j * w + i] > db.r) db = { r: dL[j * w + i], x, y };
  }
  const s = (px - 30) / (2 * half), ox = (k % cols) * px + 15, oy = Math.floor(k / cols) * px + 22;
  const M = (x, y) => `${(ox + (x - cx + half) * s).toFixed(1)},${(oy + (cy + half - y) * s).toFixed(1)}`;
  out += `<clipPath id="c${k}"><rect x="${ox}" y="${oy}" width="${px - 30}" height="${px - 30}"/></clipPath><g clip-path="url(#c${k})">`;
  const box = [cx - half, cy - half, cx + half, cy + half];
  let d = '';
  for (const e of orbitElements(g, N, box)) for (const P of N.polys) {
    const p = P.pts;
    for (let i = 0; i < p.length; i += 2) d += (i ? 'L' : 'M') + M(e.a * p[i] + e.b * p[i + 1] + e.tx, e.c * p[i] + e.d * p[i + 1] + e.ty);
    d += 'Z';
  }
  out += `<path d="${d}" fill="#4fa397" fill-opacity="0.55"/>`;
  out += `<polygon points="${tile.poly.map((p) => M(p[0], p[1])).join(' ')}" fill="none" stroke="#0f766e" stroke-width="2"/>`;
  const sym = symmetryElements(g, cx, cy, half * 1.5);
  for (const m of sym.mirrors) out += `<line x1="${M(m.px - 9 * m.ux, m.py - 9 * m.uy).split(',')[0]}" y1="${M(m.px - 9 * m.ux, m.py - 9 * m.uy).split(',')[1]}" x2="${M(m.px + 9 * m.ux, m.py + 9 * m.uy).split(',')[0]}" y2="${M(m.px + 9 * m.ux, m.py + 9 * m.uy).split(',')[1]}" stroke="#1a1a1f" stroke-width="1"/>`;
  for (const c of sym.centers) { const q = M(c.x, c.y).split(','); out += `<circle cx="${q[0]}" cy="${q[1]}" r="${1.5 + 0.6 * c.order}" fill="#1a1a1f"/>`; }
  const q1 = M(eb.x, eb.y).split(','), q2 = M(db.x, db.y).split(',');
  out += `<circle cx="${q1[0]}" cy="${q1[1]}" r="${(eb.r * h * s).toFixed(1)}" fill="none" stroke="#dc2626" stroke-width="2"/>`;
  out += `<circle cx="${q2[0]}" cy="${q2[1]}" r="${(db.r * h * s).toFixed(1)}" fill="none" stroke="#2563eb" stroke-width="2"/></g>`;
  const line = `${id}  dark ${(nd / ni).toFixed(3)}  bare ${(2 * eb.r * h / ts).toFixed(3)}  solid ${(2 * db.r * h / ts).toFixed(3)}`;
  out += `<text x="${ox}" y="${oy - 6}" font-size="14" font-family="sans-serif">${line}</text>`;
  console.log(line + `   bare at tile-relative (${((eb.x - tile.seed[0]) / ts).toFixed(2)}, ${((eb.y - tile.seed[1]) / ts).toFixed(2)})`);
});
out += '</svg>';
fs.writeFileSync(opt.out, out);
console.log('wrote', opt.out);
