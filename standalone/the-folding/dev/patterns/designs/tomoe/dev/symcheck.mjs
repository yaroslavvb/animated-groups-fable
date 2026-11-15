// node dev/symcheck.mjs [ids|all] [--design ../design.js] [--K 128] [--M 220]
// Does the print have MORE symmetry than its group (criterion a)? A general search, not a sieve at chosen points:
//   * the tone is rastered over one lattice cell (M x M in lattice coordinates) and looked up periodically;
//   * sample points are INTERIOR points (the tone is the same within rho = 0.03 tile sizes all round);
//   * every linear part (rotations by k * 7.5 deg, reflections in axes at j * 7.5 deg) is tried with every translation
//     on a K x K grid over one cell (grid step < rho, so a true symmetry is hit with no mismatch at all);
//   * a candidate that keeps the tone at all 400 samples is a symmetry; it is reported when it is NOT in the group.
// Also prints, per group, the best near-miss outside the group (the share of samples it gets wrong): a pattern that is
// almost symmetric under an extra isometry looks symmetric to the eye.
import path from 'node:path';
import { GROUPS, BY_ID, contains, latticeCoords } from '../../../../../src/groups.js';
import { normalize, windingAt } from '../../../kit.js';

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const ids = !pos[0] || pos[0] === 'all' ? GROUPS.map((g) => g.id) : pos[0].split(',');
const mod = await import(path.resolve(path.dirname(new URL(import.meta.url).pathname), opt.design || '../design.js'));
const K0 = +opt.K || 0, M0 = +opt.M || 0, RHO = +opt.rho || 0.03, NS = 400;

let seed = 11;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

for (const id of ids) {
  const g = BY_ID[id], s = Math.sqrt(g.domainArea), t0 = Date.now();
  const N = normalize(mod.find(g).shapes);
  const o = g.center, e1 = g.e1, e2 = g.e2;
  const span = Math.max(Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1])) / s;
  const M = M0 || Math.ceil(66 * span), K = K0 || Math.max(64, Math.ceil(span / 0.024));
  // the cell raster: (i + .5) / M, (j + .5) / M in lattice coordinates from the origin o
  const R = new Uint8Array(M * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const u = (i + 0.5) / M, v = (j + 0.5) / M;
    R[j * M + i] = windingAt(g, N, o[0] + u * e1[0] + v * e2[0], o[1] + u * e1[1] + v * e2[1]) > 0 ? 1 : 0;
  }
  const st = [0, 0];
  const tone = (x, y) => {
    latticeCoords(g, x - o[0], y - o[1], st);
    let u = st[0] - Math.floor(st[0]), v = st[1] - Math.floor(st[1]);
    const i = Math.min(M - 1, Math.floor(u * M)), j = Math.min(M - 1, Math.floor(v * M));
    return R[j * M + i];
  };
  // interior samples
  const S = [];
  const rho = RHO * s;
  for (let tries = 0; S.length < NS && tries < 40000; tries++) {
    const u = rnd(), v = rnd(), x = o[0] + u * e1[0] + v * e2[0], y = o[1] + u * e1[1] + v * e2[1], t = tone(x, y);
    let ok = true;
    for (let k = 0; k < 12 && ok; k++) { const f = (k * Math.PI) / 6; ok = tone(x + rho * Math.cos(f), y + rho * Math.sin(f)) === t && tone(x + 0.5 * rho * Math.cos(f), y + 0.5 * rho * Math.sin(f)) === t; }
    if (ok) S.push([x, y, t]);
  }
  const maps = [];
  for (let k = 0; k < 48; k++) { const f = (k * 7.5 * Math.PI) / 180, c = Math.cos(f), si = Math.sin(f); maps.push({ a: c, b: -si, c: si, d: c, what: `turn ${(k * 7.5).toFixed(1)}` }); }
  for (let j = 0; j < 24; j++) { const f = (j * 7.5 * Math.PI) / 180, c = Math.cos(2 * f), si = Math.sin(2 * f); maps.push({ a: c, b: si, c: si, d: -c, what: `mirror/glide axis ${(j * 7.5).toFixed(1)}` }); }
  const extra = [], nearMiss = { bad: 1, what: '' };
  let inGroupFound = 0;
  for (const L of maps) {
    // translation grid over one cell
    for (let p = 0; p < K; p++) for (let q = 0; q < K; q++) {
      const tx = (p / K) * e1[0] + (q / K) * e2[0], ty = (p / K) * e1[1] + (q / K) * e2[1];
      // identity with zero shift is trivially a symmetry; skip
      if (L.what === 'turn 0.0' && p === 0 && q === 0) continue;
      let bad = 0;
      const lim = 24;          // stage 1: 16 samples, at most 3 wrong; stage 2: all, early exit past 24 wrong
      let k = 0;
      for (; k < 16; k++) { const [x, y, t] = S[k]; if (tone(L.a * x + L.b * y + tx, L.c * x + L.d * y + ty) !== t) bad++; }
      if (bad > 3) continue;
      for (; k < S.length; k++) {
        const [x, y, t] = S[k];
        if (tone(L.a * x + L.b * y + tx, L.c * x + L.d * y + ty) !== t) { bad++; if (bad > lim) break; }
      }
      if (bad > lim) continue;
      const share = bad / S.length;
      const h = { a: L.a, b: L.b, c: L.c, d: L.d, tx, ty };
      // in the group? the grid translation is within a grid step of the true one: test with a loose tolerance
      const tol = Math.max((Math.hypot(e1[0], e1[1]) + Math.hypot(e2[0], e2[1])) / K, 0.12 * s);
      let inG = false;
      for (const r of g.reps) {
        if (Math.abs(r.a - h.a) > 1e-6 || Math.abs(r.b - h.b) > 1e-6 || Math.abs(r.c - h.c) > 1e-6 || Math.abs(r.d - h.d) > 1e-6) continue;
        latticeCoords(g, h.tx - r.tx, h.ty - r.ty, st);
        const dx = (st[0] - Math.round(st[0])) * e1[0] + (st[1] - Math.round(st[1])) * e2[0], dy = (st[0] - Math.round(st[0])) * e1[1] + (st[1] - Math.round(st[1])) * e2[1];
        if (Math.hypot(dx, dy) < tol) { inG = true; break; }
      }
      if (inG) { if (bad <= 2) inGroupFound++; continue; }
      if (bad <= 2) extra.push(`${L.what} + (${(p / K).toFixed(3)} e1, ${(q / K).toFixed(3)} e2)`);
      else if (share < nearMiss.bad) { nearMiss.bad = share; nearMiss.what = `${L.what} + (${(p / K).toFixed(3)} e1, ${(q / K).toFixed(3)} e2)`; }
    }
  }
  const dk = S.reduce((n, p) => n + p[2], 0);
  console.log(`${id.padEnd(6)} M ${M} K ${K} samples ${S.length} (dark ${dk}); group elements hit ${inGroupFound}; EXTRA: ${extra.length ? extra.slice(0, 4).join('; ') + (extra.length > 4 ? ` (+${extra.length - 4})` : '') : 'none'}; nearest miss ${nearMiss.what ? (100 * nearMiss.bad).toFixed(1) + '% wrong: ' + nearMiss.what : '> 6% wrong'}  (${Date.now() - t0} ms)`);
}
