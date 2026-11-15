// dev/seeds.mjs — hand-made starting hooks, drawn in the world coordinates of the groups of src/groups.js and turned into
// the knobs of design.js (lattice coordinates, angles from e1, tile sizes). node seeds.mjs  ->  out/seeds.json
// Each is the idea for one group (NOTES.md says why); tune2.mjs --seeds seeds refines them.
import fs from 'node:fs';
import { BY_ID } from './lib.mjs';
import { frameOrigin } from '../design.js';

const DEG = Math.PI / 180;
const ang = (v) => Math.atan2(v[1], v[0]) / DEG;
const norm = (d) => { while (d > 180) d -= 360; while (d <= -180) d += 360; return d; };
const r4 = (v) => +v.toFixed(4);
function st(group, P) {
  const O = frameOrigin(group), { e1, e2 } = group, dd = e1[0] * e2[1] - e1[1] * e2[0], x = P[0] - O[0], y = P[1] - O[1];
  return [r4((x * e2[1] - y * e2[0]) / dd), r4((e1[0] * y - e1[1] * x) / dd)];
}
export function hook(id, A, B, C, extra = {}) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea), e = ang(g.e1);
  const ta = ang([A[0] - B[0], A[1] - B[1]]), tc = ang([C[0] - B[0], C[1] - B[1]]);
  return { B: st(g, B), th: r4(norm(ta - e)), phi: r4(norm(tc - ta)), a: r4(Math.hypot(A[0] - B[0], A[1] - B[1]) / size), b: r4(Math.hypot(C[0] - B[0], C[1] - B[1]) / size), ...extra };
}
export function jhook(id, A, B, B2, C, extra = {}) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea), e = ang(g.e1);
  const ta = ang([A[0] - B[0], A[1] - B[1]]), tb = ang([B2[0] - B[0], B2[1] - B[1]]), tc = ang([C[0] - B2[0], C[1] - B2[1]]);
  return { B: st(g, B), th: r4(norm(ta - e)), phi: r4(norm(tb - ta)), u: r4(Math.hypot(B2[0] - B[0], B2[1] - B[1]) / size), phi2: r4(norm(tc - tb)),
    a: r4(Math.hypot(A[0] - B[0], A[1] - B[1]) / size), b: r4(Math.hypot(C[0] - B2[0], C[1] - B2[1]) / size), ...extra };
}
export const dot = (id, P, r) => [...st(BY_ID[id], P), r];
export function dash(id, P, Q, r, r2 = r) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea);
  return [...st(g, P), r, r4(norm(ang([Q[0] - P[0], Q[1] - P[1]]) - ang(g.e1))), r4(Math.hypot(Q[0] - P[0], Q[1] - P[1]) / size), r2];
}

const S = {};
const add = (id, spec) => { (S[id] = S[id] || []).push(spec); };

// the kaleidoscopes: a fat tick that hugs two mirrors, its bend in an acute corner, its tail in another
add('*442', hook('*442', [0.43, 0.48], [0.0354, 0.0854], [0.0354, 0.25], { r: 0.27, gap: 0.12, fil: 0.03, dr: 0.2, dg: 0.12 }));
add('*442', hook('*442', [0.43, 0.48], [0.0354, 0.0854], [0.0354, 0.42], { r: 0.27, gap: 0.12, fil: 0.03 }));
add('*632', hook('*632', [-0.0618, -0.0667], [-0.4463, -0.2887], [-0.2818, -0.3837], { r: 0.3, gap: 0.1, fil: 0.03 }));
add('*333', hook('*333', [0.4917, 0.24], [0.076, 0], [0.224, -0.0855], { r: 0.3, gap: 0.12, fil: 0.03, dr: 0.2, dg: 0.12 }));
add('*2222', jhook('*2222', [0.57, 0.114], [0.114, 0.114], [0.114, 0.386], [0.33, 0.386], { r: 0.14, gap: 0.12, fil: 0.24, dr: 0.14, dg: 0.12 }));
add('*2222', hook('*2222', [0.615, 0.057], [0.057, 0.057], [0.057, 0.465], { r: 0.22, gap: 0.12, fil: 0.1, dots: [dash('*2222', [0.36, 0.35], [0.5, 0.35], 0.19)] }));
// the strips
add('**', jhook('**', [0.144, 1.107], [0.144, 0.2], [0.456, 0.2], [0.456, 0.85], { r: 0.11, gap: 0.12, fil: 0.18 }));
add('**', jhook('**', [0.144, 1.107], [0.144, 0.2], [0.456, 0.2], [0.456, 0.62], { r: 0.11, gap: 0.12, fil: 0.18, dr: 0.11, dg: 0.12 }));
add('*x', hook('*x', [1.5, 0.1074], [0.62, 0.1074], [0.38, 0.1926], { r: 0.095, gap: 0.12, fil: 0.3, dr: 0.095, dg: 0.12 }));
add('*x', hook('*x', [1.5, 0.1074], [0.42, 0.1074], [0.12, 0.1926], { r: 0.095, gap: 0.12, fil: 0.3 }));
add('22*', hook('22*', [1.66, 0.5298], [0.793, 0.5298], [0.46, 0.722], { r: 0.12, gap: 0.12, fil: 0.3, dr: 0.12, dg: 0.12 }));
add('22*', hook('22*', [1.66, 0.5298], [0.793, 0.5298], [0.291, 0.82], { r: 0.12, gap: 0.12, fil: 0.3 }));
// a cone point inside a mirror chamber
add('2*22', hook('2*22', [0.1, 0.093], [0.707, 0.093], [0.62, 0.218], { r: 0.13, gap: 0.12, fil: 0.1, dr: 0.13, dg: 0.12 }));
add('2*22', hook('2*22', [0.1, 0.093], [0.707, 0.093], [0.535, 0.339], { r: 0.13, gap: 0.12, fil: 0.1 }));
add('3*3', hook('3*3', [0.94, 0.072], [0.3, 0.072], [0.37, 0.16], { r: 0.13, gap: 0.12, fil: 0.2, dr: 0.13, dg: 0.12 }));
add('3*3', hook('3*3', [0.94, 0.072], [0.3, 0.072], [0.43, 0.24], { r: 0.13, gap: 0.12, fil: 0.2 }));
add('4*2', hook('4*2', [0.526, 0.0686], [0.2222, 0.3728], [0.21, 0.513], { r: 0.13, gap: 0.12, fil: 0.25, dots: [dot('4*2', [0.425, 0.425], 0.15)] }));

if (process.argv[1] && process.argv[1].endsWith('seeds.mjs')) {
  // more seeds: the candidates of earlier searches, out/<name>.json given as arguments
  for (const n of process.argv.slice(2)) { const f = JSON.parse(fs.readFileSync(new URL('./out/' + n + '.json', import.meta.url))); for (const id in f) for (const sp of f[id]) { const c = { ...sp }; delete c._m; add(id, c); } }
  fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('./out/seeds.json', import.meta.url), JSON.stringify(S, null, 1));
  for (const id in S) console.log(id.padEnd(6), S[id].length, JSON.stringify(S[id][0]));
}
