// dev/k632.mjs — a random search for the *632 tick (second run): the bend B in the 60-degree corner P3 (inset dB on
// its bisector), the long arm toward the 6-fold corner P6 along the hypotenuse, the short arm turned by phi from it,
// half-widths r (bend), rt (tail end), rh (head end). Objective: the bare disc, with the dark share kept in [0.48, 0.6].
// Run on the mini:  bash remote.sh k632.mjs [evals] [seed]   ->  out/K632.json (best first)
import fs from 'node:fs';
import { BY_ID, run } from './lib.mjs';
import { hook } from './seeds.mjs';

const S3 = Math.sqrt(3), P6 = [0, 0], P3 = [-0.5, -S3 / 6], P2 = [-0.25, -S3 / 4];
const EV = +(process.argv[2] || 400);
let seed = (+(process.argv[3] || 1)) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const g = BY_ID['*632'];
// p = [dB (world), tA (share of the way B -> P6's inset), lc (world), phiDeg (turn from the long arm), r, rt, rh]
const lo = [0.012, 0.85, 0.12, -95, 0.2, 0.12, 0.2], hi = [0.05, 1.0, 0.32, -40, 0.42, 0.42, 0.5];
const clamp = (p) => p.map((v, i) => Math.max(lo[i], Math.min(hi[i], v)));
function specOf(p) {
  const [dB, tA, lc, ph, r, rt, rh] = p;
  const u3 = [P6[0] - P3[0], P6[1] - P3[1]], w3 = [P2[0] - P3[0], P2[1] - P3[1]];
  const nu = Math.hypot(...u3), nw = Math.hypot(...w3), bis = [u3[0] / nu + w3[0] / nw, u3[1] / nu + w3[1] / nw], nb = Math.hypot(...bis);
  const B = [P3[0] + (bis[0] / nb) * dB / Math.sin(Math.PI / 6), P3[1] + (bis[1] / nb) * dB / Math.sin(Math.PI / 6)];
  // the long arm: parallel to the hypotenuse, to the share tA of the way to the 6-fold corner
  const hx = u3[0] / nu, hy = u3[1] / nu, L = Math.hypot(P6[0] - B[0], P6[1] - B[1]) * tA;
  const A = [B[0] + hx * L, B[1] + hy * L];
  const a0 = Math.atan2(hy, hx) + (ph * Math.PI) / 180, C = [B[0] + lc * Math.cos(a0), B[1] + lc * Math.sin(a0)];
  return hook('*632', A, B, C, { r: +r.toFixed(3), rt: +rt.toFixed(3), rh: +rh.toFixed(3), gap: 0.12, rd: 0.03, fil: 0.03 });
}
function score(p) {
  try {
    const m = run(g, specOf(p), { per: 24 });
    return { J: m.bare + 6 * Math.max(0, m.coverage - 0.6) + 6 * Math.max(0, 0.48 - m.coverage) + 0.5 * Math.max(0, m.solid - 0.55) + (m.loops !== 1 ? 0.2 : 0), m };
  } catch (e) { return { J: 9 }; }
}
let best = [];
// start: the first run's tick and random points
const starts = [[0.022, 1, 0.215, -60, 0.3, 0.3, 0.3]];
for (let k = 0; k < 7; k++) starts.push(clamp(lo.map((l, i) => l + (hi[i] - l) * rnd())));
const per = Math.floor(EV / starts.length);
for (const s of starts) {
  let p = s.slice(), cur = score(p);
  for (let it = 0; it < per; it++) {
    const q = p.slice(), f = Math.pow(0.6, Math.floor((3 * it) / per));
    const k = Math.floor(rnd() * q.length);
    q[k] += (rnd() * 2 - 1) * (hi[k] - lo[k]) * 0.25 * f;
    if (rnd() < 0.3) { const k2 = Math.floor(rnd() * q.length); q[k2] += (rnd() * 2 - 1) * (hi[k2] - lo[k2]) * 0.15 * f; }
    const qq = clamp(q), sc = score(qq);
    if (sc.J < cur.J) { p = qq; cur = sc; }
  }
  best.push({ ...specOf(p), _m: { J: +cur.J.toFixed(3), dark: cur.m.coverage, bare: cur.m.bare, solid: cur.m.solid, loops: cur.m.loops }, _p: p.map((v) => +v.toFixed(4)) });
}
best.sort((x, y) => x._m.J - y._m.J);
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./out/K632.json', import.meta.url), JSON.stringify({ '*632': best }, null, 1));
for (const b of best) console.log(JSON.stringify(b._m), JSON.stringify(b._p));
