// why does 632 fail on a moved copy? print the tile in the e1 frame for the page and the moved group
import { BY_ID } from '../../../../../src/groups.js';
import { buildDomain } from '../../../../../src/domain.js';
import { findWith } from '../design.js';
const g = BY_ID['632'];
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => { const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]); return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] }; });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}
for (const G of [g, moved(g, 1.234, 1.7, [0.4, -0.9])]) {
  const r = findWith(G, null), s = Math.sqrt(G.domainArea);
  const L = Math.hypot(...G.e1), u = [G.e1[0] / L, G.e1[1] / L], v = [-u[1], u[0]];
  const k = [0, -0.5];
  const seedP = G.presets ? G.presets[0].seed : [G.center[0] - 0.086603 * G.e1[0] - 0.326795 * G.e2[0], G.center[1] - 0.086603 * G.e1[1] - 0.326795 * G.e2[1]];
  const D = buildDomain(G, { seed: seedP }).poly;
  let cx = 0, cy = 0; for (const p of D) { cx += p[0] / D.length; cy += p[1] / D.length; }
  console.log(G.presets ? 'page' : 'moved', 'verts', D.length, D.map((p) => { const w = [p[0] - cx, p[1] - cy]; return '(' + ((w[0] * u[0] + w[1] * u[1]) / s).toFixed(3) + ',' + ((w[0] * v[0] + w[1] * v[1]) / s).toFixed(3) + ')'; }).join(' '));
  console.log('  a', r.info.a.map((x) => x.toFixed(3)), 'b', r.info.b.map((x) => x.toFixed(3)), 'rB', r.info.rB.toFixed(3), 'rA', r.info.rA.toFixed(3), 'shapes', r.shapes.map((sh) => sh.pts.length + (sh.hole ? 'h' : '')).join(','));
}
