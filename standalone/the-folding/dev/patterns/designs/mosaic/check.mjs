// check.mjs — the hard rules, measured (dev): the gap between copies, self-crossings, segment lengths, holes, time.
//   node check.mjs [ids]
import { find } from './design.js';
import { BY_ID, GROUPS, normalize, rasterOrbit, edt, tileOf } from './lab.mjs';
import { orbitElements } from '../../kit.js';
const ids = process.argv[2] ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
const segD = (px, py, ax, ay, bx, by) => { const ux = bx - ax, uy = by - ay, l2 = ux * ux + uy * uy; let t = l2 > 0 ? ((px - ax) * ux + (py - ay) * uy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - ax - t * ux, py - ay - t * uy); };
const cross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
let worstGap = Infinity;
for (const id of ids) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea);
  const times = []; let r;
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); r = find(g); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const N = normalize(r.shapes), P = N.polys.map((q) => { const o = []; for (let i = 0; i < q.pts.length; i += 2) o.push([q.pts[i], q.pts[i + 1]]); return o; });
  let selfX = 0, minSeg = Infinity, maxSeg = 0;
  for (const o of P) for (let i = 0, n = o.length; i < n; i++) {
    const a = o[i], b = o[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); minSeg = Math.min(minSeg, l / size); maxSeg = Math.max(maxSeg, l / size);
    for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (cross(a, b, o[j], o[(j + 1) % n])) selfX++; }
  }
  // the gap to every other copy
  const box = [N.cx - N.R, N.cy - N.R, N.cx + N.R, N.cy + N.R], els = orbitElements(g, N, box);
  let gap = Infinity, same = 0;
  for (const e of els) {
    if (Math.abs(e.a - 1) < 1e-9 && Math.abs(e.b) < 1e-9 && Math.abs(e.c) < 1e-9 && Math.abs(e.d - 1) < 1e-9 && Math.hypot(e.tx, e.ty) < 1e-9 * size) { same++; continue; }
    const Q = P.map((o) => o.map((v) => [e.a * v[0] + e.b * v[1] + e.tx, e.c * v[0] + e.d * v[1] + e.ty]));
    for (const o of P) for (const q of Q) for (const v of o) for (let j = 0, m = q.length; j < m; j++) { const d = segD(v[0], v[1], q[j][0], q[j][1], q[(j + 1) % m][0], q[(j + 1) % m][1]); if (d < gap) gap = d; }
  }
  gap /= size; worstGap = Math.min(worstGap, gap);
  // thin features: what an opening by a disc 0.04 tile sizes across takes away, of the dark and of the light (tile areas)
  const per = 160, h = size / per, pad = 0.25 * size, bx0 = N.cx - N.R - pad, by0 = N.cy - N.R - pad, w = Math.ceil((2 * (N.R + pad)) / h);
  const cnt = rasterOrbit(g, N, bx0, by0, h, w, w), dark = new Uint8Array(w * w), light = new Uint8Array(w * w);
  for (let i = 0; i < w * w; i++) { dark[i] = cnt[i] > 0 ? 1 : 0; light[i] = 1 - dark[i]; }
  const lost = (A, B) => { const dB = edt(B, w, w), er = new Uint8Array(w * w), r = 0.02 * per; for (let i = 0; i < w * w; i++) er[i] = A[i] && dB[i] > r ? 1 : 0; const dE = edt(er, w, w); let n = 0, tot = 0; const m = Math.round(pad / h); for (let j = m; j < w - m; j++) for (let i = m; i < w - m; i++) { const k = j * w + i; if (A[k]) { tot++; if (dE[k] > r + 1.5) n++; } } return n / (per * per) / (tot / (per * per)) * (tot / (per * per)); };
  const thinD = lost(dark, light), thinL = lost(light, dark);
  // the motif's own symmetry: the best overlap (intersection over union) of the cell with a turned or mirrored copy of itself
  const one = rasterOrbit({ ...g, reps: [{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }], e1: [1e3, 0], e2: [0, 1e3], cellArea: 1e6 }, N, bx0, by0, h * 2, w >> 1, w >> 1), w2 = w >> 1;
  let cxm = 0, cym = 0, na = 0;
  for (let j = 0; j < w2; j++) for (let i = 0; i < w2; i++) if (one[j * w2 + i]) { cxm += i; cym += j; na++; }
  cxm /= na; cym /= na;
  const iou = (fn) => { let inter = 0, uni = 0; for (let j = 0; j < w2; j++) for (let i = 0; i < w2; i++) { const [u, v] = fn(i - cxm, j - cym), ii = Math.round(u + cxm), jj = Math.round(v + cym), a = one[j * w2 + i] > 0, b = ii >= 0 && jj >= 0 && ii < w2 && jj < w2 && one[jj * w2 + ii] > 0; if (a && b) inter++; if (a || b) uni++; } return inter / uni; };
  let sym = 0;
  for (const n of [2, 3, 4, 6]) { const a = (2 * Math.PI) / n, c = Math.cos(a), s = Math.sin(a); sym = Math.max(sym, iou((x, y) => [c * x - s * y, s * x + c * y])); }
  for (let d = 0; d < 180; d += 3) { const a = (d * Math.PI) / 90, c = Math.cos(a), s = Math.sin(a); sym = Math.max(sym, iou((x, y) => [c * x + s * y, s * x - c * y])); }
  // how much of the motif the page's default tile holds
  const T = tileOf(g).poly, tm = rasterOrbit({ ...g, reps: [{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }], e1: [1e3, 0], e2: [0, 1e3], cellArea: 1e6 }, normalize([{ pts: T }]), bx0, by0, h * 2, w2, w2);
  let inT = 0; for (let i = 0; i < w2 * w2; i++) if (one[i] && tm[i]) inT++;
  console.log(id.padEnd(6), 'thin dark', thinD.toFixed(4), 'thin light', thinL.toFixed(4), 'self-symmetry IoU', sym.toFixed(2), 'in the default tile', (inT / na).toFixed(3));
  console.log(id.padEnd(6), 'gap', gap.toFixed(4), 'selfX', selfX, 'seg', minSeg.toFixed(4), '-', maxSeg.toFixed(4), 'polys', P.length, 'holes', N.polys.filter((q) => q.hole).length, 'verts', N.verts, 'ms', times[1].toFixed(1), '(first ' + times[2].toFixed(0) + ')', 'identity copies', same);
}
console.log('smallest gap between copies (tile sizes):', worstGap.toFixed(4));
