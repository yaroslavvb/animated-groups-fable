// lab/check.mjs — the hard rules of a design, on the 17 groups AND on turned, scaled, shifted copies of them that carry
// only { id, e1, e2, reps, cellArea, domainArea, center } (no presets): vertices, self-crossings, holes inside, copies
// apart (kit.GAP_MIN), determinism, equivariance (the motif of the moved group is the moved motif).
//   node lab/check.mjs [ids] [--moved 0]
import { GROUPS, BY_ID, elementsNear } from '../../../../../src/groups.js';
import { normalize, orbitElements, GAP_MIN, MAX_VERTS } from '../../../kit.js';
import { find, meta } from '../design.js';

const ids = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
const conj = (r, T) => {                                       // T r T^-1 for the similarity T(x) = s R x + t
  const { s, c, n, tx, ty } = T, a = r.a, b = r.b, cc = r.c, d = r.d;
  // linear part: R L R^-1
  const A = [[c * a - n * cc, c * b - n * d], [n * a + c * cc, n * b + c * d]];
  const L = [[A[0][0] * c - A[0][1] * n, A[0][0] * n + A[0][1] * c], [A[1][0] * c - A[1][1] * n, A[1][0] * n + A[1][1] * c]];
  // translation: s R r.t + t - L t
  const px = s * (c * r.tx - n * r.ty) + tx, py = s * (n * r.tx + c * r.ty) + ty;
  return { a: L[0][0], b: L[0][1], c: L[1][0], d: L[1][1], tx: px - (L[0][0] * tx + L[0][1] * ty), ty: py - (L[1][0] * tx + L[1][1] * ty) };
};
const moved = (g, T) => {
  const ap = (p) => [T.s * (T.c * p[0] - T.n * p[1]) + T.tx, T.s * (T.n * p[0] + T.c * p[1]) + T.ty];
  const lin = (p) => [T.s * (T.c * p[0] - T.n * p[1]), T.s * (T.n * p[0] + T.c * p[1])];
  const e1 = lin(g.e1), e2 = lin(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { g: { id: g.id, e1, e2, reps: g.reps.map((r) => conj(r, T)), cellArea, domainArea: cellArea / g.reps.length, center: ap(g.center) }, ap };
};
const segX = (a, b, c, d) => {
  const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  if ((d1 > 0) === (d2 > 0)) return false;
  const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  return (d3 > 0) !== (d4 > 0);
};
function selfCross(pts) {
  const n = pts.length; let c = 0;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) c++; }
  return c;
}
function minGap(group, shapes) {                               // least distance between the motif and its other copies (points to segments)
  const N = normalize(shapes), size = Math.sqrt(group.domainArea);
  const all = shapes.flatMap((s) => s.pts);
  let best = Infinity;
  for (const g of elementsNear(group, N.cx, N.cy, 2 * N.R + 0.3 * size, N.cx, N.cy)) {
    const ox = g.a * N.cx + g.b * N.cy + g.tx, oy = g.c * N.cx + g.d * N.cy + g.ty;
    if (Math.hypot(ox - N.cx, oy - N.cy) < 1e-9 && Math.abs(g.a - 1) < 1e-9 && Math.abs(g.b) < 1e-9) continue;
    const img = all.map((p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty]);
    for (const p of all) for (let k = 0; k < img.length; k++) {
      const a = img[k], b = img[(k + 1) % img.length];           // (segments across two polygons of a motif are few and far)
      const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
      if (l2 > (0.1 * size) ** 2) continue;
      let t = l2 > 0 ? ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(a[0] + t * ex - p[0], a[1] + t * ey - p[1]);
      if (d < best) best = d;
    }
  }
  return best / size;
}
let bad = 0;
const T = { s: 1.37, c: Math.cos(0.83), n: Math.sin(0.83), tx: 3.21, ty: -1.77 };
for (const id of ids) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea), msgs = [];
  const t0 = performance.now(), r1 = find(g), ms = performance.now() - t0;
  const N = normalize(r1.shapes);
  if (N.verts > MAX_VERTS) msgs.push('verts ' + N.verts);
  let seg = 0, segMax = 0, cnt = 0;
  for (const s of r1.shapes) { const c = selfCross(s.pts); if (c) msgs.push('self-crossings ' + c); for (let i = 0; i < s.pts.length; i++) { const p = s.pts[i], q = s.pts[(i + 1) % s.pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]) / size; seg += l; cnt++; if (l > segMax) segMax = l; } }
  if (r1.shapes.filter((s) => !s.hole).length !== 1) msgs.push('outer polygons ' + r1.shapes.filter((s) => !s.hole).length);
  const gap = minGap(g, r1.shapes);
  if (gap < GAP_MIN) msgs.push('gap ' + gap.toFixed(4));
  // a moved copy without presets
  const M = moved(g, T), r2 = find(M.g);
  let dev = 0;
  if (r2.shapes.length !== r1.shapes.length) msgs.push('moved: ' + r2.shapes.length + ' polygons'); else {
    for (let k = 0; k < r1.shapes.length; k++) {
      const a = r1.shapes[k].pts, b = r2.shapes[k].pts;
      if (a.length !== b.length) { msgs.push('moved: ' + b.length + ' points for ' + a.length); dev = NaN; break; }
      for (let i = 0; i < a.length; i++) { const q = M.ap(a[i]); dev = Math.max(dev, Math.hypot(q[0] - b[i][0], q[1] - b[i][1]) / (T.s * size)); }
    }
  }
  if (!(dev < 2e-3)) msgs.push('moved motif differs by ' + dev);
  const gap2 = minGap(M.g, r2.shapes);
  if (gap2 < GAP_MIN) msgs.push('moved gap ' + gap2.toFixed(4));
  console.log(id.padEnd(6), 'verts', String(N.verts).padStart(4), 'seg mean', (seg / cnt).toFixed(4), 'max', segMax.toFixed(4), 'gap', gap.toFixed(3), 'moved dev', dev.toExponential(1), 'gap', gap2.toFixed(3), ms.toFixed(0) + 'ms', msgs.length ? 'FAIL: ' + msgs.join('; ') : 'ok');
  if (msgs.length) bad++;
}
console.log(bad ? bad + ' group(s) FAIL' : 'all ok', '(' + meta.key + ')');
process.exit(bad ? 1 : 0);
