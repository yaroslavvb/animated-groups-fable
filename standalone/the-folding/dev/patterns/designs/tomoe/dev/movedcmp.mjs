// node dev/movedcmp.mjs <id> — find() on the page's group and on a turned, scaled, shifted copy without presets: the
// two motifs carried back to the page's frame, compared (vertices, area, heads, how far the outlines lie apart).
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';

const g = BY_ID[process.argv[2] || '632'];
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { h: { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] }, back: (p) => mul(Ai, [p[0] - v[0], p[1] - v[1]]) };
}
const area = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; };
const r0 = find(g), s = Math.sqrt(g.domainArea);
for (const [th, sc, v] of [[1.234, 1.7, [0.4, -0.9]], [-0.31, 0.6, [-2.1, 3.3]], [0, 1, [0, 0]]]) {
  const { h, back } = moved(g, th, sc, v), r1 = find(h), P1 = r1.shapes[0].pts.map(back);
  const P0 = r0.shapes[0].pts;
  let far = 0;
  for (const p of P1) { let dm = Infinity; for (const q of P0) dm = Math.min(dm, Math.hypot(p[0] - q[0], p[1] - q[1])); far = Math.max(far, dm); }
  console.log(`turn ${th} scale ${sc}: verts ${P1.length} vs ${P0.length}, area ${(Math.abs(area(P1)) / s / s).toFixed(4)} vs ${(Math.abs(area(P0)) / s / s).toFixed(4)}, rB ${r1.info.rB.toFixed(3)} vs ${r0.info.rB.toFixed(3)}, rA ${r1.info.rA.toFixed(3)} vs ${r0.info.rA.toFixed(3)}, farthest outline point ${(far / s).toFixed(4)} tile sizes`);
}
