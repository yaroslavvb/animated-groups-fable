// dev/equi.mjs — is the motif equivariant? For a group and a moved copy: frame origin, plain flag, loops, vertices, and
// the largest distance from a carried vertex to the moved motif's outline.   node equi.mjs <id> [th sc vx vy]
import { BY_ID } from '../../../../../src/groups.js';
import { motifOf, SPEC, frameOrigin } from '../design.js';

const id = process.argv[2] || '3*3';
const th = +(process.argv[3] ?? 0.7), sc = +(process.argv[4] ?? 1.9), v = [+(process.argv[5] ?? 3.1), +(process.argv[6] ?? -2.2)];
function moved(g) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => { const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]); return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] }; });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}
const T = (x, y) => [sc * (Math.cos(th) * x - Math.sin(th) * y) + v[0], sc * (Math.sin(th) * x + Math.cos(th) * y) + v[1]];
const g = BY_ID[id], h = moved(g), size = Math.sqrt(g.domainArea);
const a = motifOf(g, SPEC[id]), b = motifOf(h, SPEC[id]);
const O = frameOrigin(g), Oh = frameOrigin(h), TO = T(...O);
console.log('origin', O, '-> carried', TO, 'moved group origin', Oh, 'diff', Math.hypot(TO[0] - Oh[0], TO[1] - Oh[1]));
console.log('plain', a.plain, b.plain, 'apart', a.apart, b.apart, 'loops', a.shapes.length, b.shapes.length, 'verts', a.shapes.map((s) => s.pts.length), b.shapes.map((s) => s.pts.length), 'rivals', a.rivals.length, b.rivals.length);
function distToOutline(shapes, x, y) {
  let best = Infinity;
  for (const s of shapes) { const p = s.pts; for (let i = 0, n = p.length, j = n - 1; i < n; j = i++) { const ax = p[j][0], ay = p[j][1], ex = p[i][0] - ax, ey = p[i][1] - ay, l2 = ex * ex + ey * ey; const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0; best = Math.min(best, Math.hypot(x - ax - t * ex, y - ay - t * ey)); } }
  return best;
}
let worst = 0;
for (const s of a.shapes) for (const [x, y] of s.pts) worst = Math.max(worst, distToOutline(b.shapes, ...T(x, y)));
console.log('largest distance of a carried vertex to the moved outline:', (worst / (sc * size)).toExponential(2), 'tile sizes');
