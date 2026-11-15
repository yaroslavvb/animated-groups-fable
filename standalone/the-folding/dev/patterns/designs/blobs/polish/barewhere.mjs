// polish/barewhere.mjs — WHERE proto's bare disc is: kit.js measure()'s grid and distance transform, done again here
// with the place of the largest empty disc (world and frame coordinates), and the group's centres near it.
//   node polish/barewhere.mjs --ids '22*,2*22'
import { BY_ID, symmetryElements } from '../../../../../src/groups.js';
import { normalize, toneAt } from '../../../kit.js';
import { find, frameOf } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
function edt1(f, n) {                                       // squared distances along one line (Felzenszwalb)
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) { const p = v[k]; s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
    if (s <= z[k]) { v[k] = q; z[k] = -Infinity; z[k + 1] = Infinity; } else { k++; v[k] = q; z[k] = s; z[k + 1] = Infinity; }
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  return d;
}
for (const id of opt.ids.split(',')) {
  const g = BY_ID[id], N = normalize(find(g).shapes), per = 56, size = Math.sqrt(g.domainArea), h = size / per;
  const L = Math.max(Math.hypot(g.e1[0], g.e1[1]), Math.hypot(g.e2[0], g.e2[1]));
  const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;
  const w = Math.ceil((2 * (half + pad)) / h), x0 = g.center[0] - half - pad, y0 = g.center[1] - half - pad;
  const dark = new Uint8Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) dark[j * w + i] = toneAt(g, N, x0 + (i + 0.5) * h, y0 + (j + 0.5) * h);
  const INF = 1e20, D = new Float64Array(w * w), col = new Float64Array(w), row = new Float64Array(w);
  for (let i = 0; i < w; i++) { for (let j = 0; j < w; j++) col[j] = dark[j * w + i] ? 0 : INF; const d = edt1(col, w); for (let j = 0; j < w; j++) D[j * w + i] = d[j]; }
  for (let j = 0; j < w; j++) { for (let i = 0; i < w; i++) row[i] = D[j * w + i]; const d = edt1(row, w); for (let i = 0; i < w; i++) D[j * w + i] = d[i]; }
  let best = 0, bi = 0, bj = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (Math.abs(x - g.center[0]) > half || Math.abs(y - g.center[1]) > half) continue;
    if (D[j * w + i] > best) { best = D[j * w + i]; bi = i; bj = j; }
  }
  const x = x0 + (bi + 0.5) * h, y = y0 + (bj + 0.5) * h, F = frameOf(g), f = F.toF(x, y);
  const sym = symmetryElements(g, x, y, 0.6 * size);
  const near = sym.centers.map((c) => `${c.order}${c.onMirror ? '*' : ''} at ${(Math.hypot(c.x - x, c.y - y) / size).toFixed(3)}`).slice(0, 4);
  const mir = sym.mirrors.map((m) => Math.abs((x - m.px) * -m.uy + (y - m.py) * m.ux) / size).sort((a, b) => a - b).slice(0, 2).map((d) => d.toFixed(3));
  console.log(`${id.padEnd(6)} bare ${((2 * Math.sqrt(best) * h) / size).toFixed(3)} at world (${x.toFixed(3)}, ${y.toFixed(3)}) frame (${f[0].toFixed(3)}, ${f[1].toFixed(3)})  centres: ${near.join(', ')}  mirrors at ${mir.join(', ')}`);
}
