// test/patterns-symmetry.test.js — no shipped shape print has a symmetry its group does not have (15 Nov 2026, the fixer,
// after the correctness review of the pattern round: the tests held each print to its group — every element keeps it —
// but nothing asked the other way, so a design edit that added a mirror or a half period would have shipped green; the
// review measured the 68 shipped prints with judge-math's symcheck and found no extra symmetry, Paisley's ** nearest at
// 0.84 of an exact one). After that check (dev/patterns/scratch-review-correct/extrasym.mjs), coarser:
//   the print rasterised on the torus R^2 / lattice (R x R samples in lattice coordinates); every lattice-preserving
//   linear part M that is not in the group's point group, and the identity (extra translations: an extra symmetry whose
//   linear part IS in the point group, composed with the group's own element of that part, is one), each with every
//   translation at once by an FFT correlation: near(h) = |dark ∩ h^-1(dark)| / |dark|. A candidate over the raster's
//   own level for an exact symmetry (one half a sample off the grid) is checked with the print's exact tone at 1500
//   generic points, its translation refined to a tenth of a sample: an exact extra symmetry keeps them all.
// Paisley, Soft commas, Tomoe and the Comma in all 17 groups; and a control that finds what it should: the print of 2222
// looked at as if it were a print of its translations alone has its half-turns as extra symmetries.
//   node --test test/patterns-symmetry.test.js        (a few seconds)

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { printFor } from '../src/pattern.js';

const R = 120;                      // samples a side (2^3 3 5: the mixed-radix FFT below)
const mod = (a, n) => ((a % n) + n) % n;

// ---- FFT, mixed radix (n = 2^a 3^b 5^c), as judge-math's symcheck and the review's extrasym.mjs ---------------------
function makeFFT(n) {
  const fac = []; let m = n;
  for (const p of [2, 3, 5]) while (m % p === 0) { fac.push(p); m /= p; }
  if (m !== 1) throw new Error('FFT size must be 2^a 3^b 5^c');
  const cosT = new Float64Array(n), sinT = new Float64Array(n);
  for (let k = 0; k < n; k++) { cosT[k] = Math.cos((2 * Math.PI * k) / n); sinT[k] = Math.sin((2 * Math.PI * k) / n); }
  const tmpR = new Float64Array(n), tmpI = new Float64Array(n), oR = new Float64Array(n), oI = new Float64Array(n);
  function rec(xr, xi, off, stride, len, oOff, sign, level) {
    if (len === 1) { oR[oOff] = xr[off]; oI[oOff] = xi[off]; return; }
    const p = fac[level], mm = len / p, s = n / len;
    for (let r = 0; r < p; r++) rec(xr, xi, off + stride * r, stride * p, mm, oOff + r * mm, sign, level + 1);
    for (let k = 0; k < mm; k++) for (let q = 0; q < p; q++) {
      const kk = k + mm * q;
      let ar = 0, ai = 0;
      for (let r = 0; r < p; r++) {
        const idx = (r * kk * s) % n, c = cosT[idx], sn = sign * sinT[idx], yr = oR[oOff + r * mm + k], yi = oI[oOff + r * mm + k];
        ar += yr * c - yi * sn; ai += yr * sn + yi * c;
      }
      tmpR[kk] = ar; tmpI[kk] = ai;
    }
    for (let k = 0; k < len; k++) { oR[oOff + k] = tmpR[k]; oI[oOff + k] = tmpI[k]; }
  }
  return (xr, xi, sign) => { rec(xr, xi, 0, 1, n, 0, sign, 0); return [oR, oI]; };
}
const fft1 = makeFFT(R);
function fft2(re, im, sign) {
  const rr = new Float64Array(R), ri = new Float64Array(R);
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < R; i++) { rr[i] = re[j * R + i]; ri[i] = im[j * R + i]; }
    const [a, b] = fft1(rr, ri, sign);
    for (let i = 0; i < R; i++) { re[j * R + i] = a[i]; im[j * R + i] = b[i]; }
  }
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < R; j++) { rr[j] = re[j * R + i]; ri[j] = im[j * R + i]; }
    const [a, b] = fft1(rr, ri, sign);
    for (let j = 0; j < R; j++) { re[j * R + i] = a[j]; im[j * R + i] = b[j]; }
  }
}

/** The print's dark tone on the torus: the motif's copies under the group's coset representatives (and the lattice). */
function raster(group, P) {
  const { e1, e2 } = group, dd = e1[0] * e2[1] - e1[1] * e2[0];
  const Wn = new Int16Array(R * R), cross = [];
  for (const r of group.reps) for (const Q of P.polys) {
    const n = Q.pts.length / 2, xs = new Float64Array(n), ys = new Float64Array(n);
    let y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const x = Q.pts[2 * k], y = Q.pts[2 * k + 1], X = r.a * x + r.b * y + r.tx, Y = r.c * x + r.d * y + r.ty;
      xs[k] = ((X * e2[1] - Y * e2[0]) / dd) * R; ys[k] = ((e1[0] * Y - e1[1] * X) / dd) * R;
      if (ys[k] < y0) y0 = ys[k]; if (ys[k] > y1) y1 = ys[k];
    }
    const w = Q.hole ? -1 : 1;
    for (let j = Math.ceil(y0); j <= Math.floor(y1); j++) {
      cross.length = 0;
      for (let k = 0, m = n - 1; k < n; m = k++) { const a = ys[m], b = ys[k]; if ((a <= j) !== (b <= j)) cross.push(xs[m] + ((j - a) * (xs[k] - xs[m])) / (b - a)); }
      cross.sort((a, b) => a - b);
      const jj = mod(j, R);
      for (let q = 0; q + 1 < cross.length; q += 2) for (let i = Math.ceil(cross[q]); i <= Math.floor(cross[q + 1]); i++) Wn[jj * R + mod(i, R)] += w;
    }
  }
  const f = new Uint8Array(R * R); let D = 0;
  for (let k = 0; k < R * R; k++) if (Wn[k] > 0) { f[k] = 1; D++; }
  return { f, D };
}

/** The lattice-preserving linear parts that are isometries ({ M in lattice coordinates, L in the world }), and the set of
 *  the group's own linear parts (its point group, in lattice coordinates). */
function linearParts(group) {
  const { e1, e2 } = group, B = [e1[0], e2[0], e1[1], e2[1]], dd = B[0] * B[3] - B[1] * B[2], Bi = [B[3] / dd, -B[1] / dd, -B[2] / dd, B[0] / dd];
  const mul = (P, Q) => [P[0] * Q[0] + P[1] * Q[2], P[0] * Q[1] + P[1] * Q[3], P[2] * Q[0] + P[3] * Q[2], P[2] * Q[1] + P[3] * Q[3]];
  const all = [];
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) for (let d = -3; d <= 3; d++) {
    const det = a * d - b * c;
    if (det !== 1 && det !== -1) continue;
    const L = mul(mul(B, [a, b, c, d]), Bi);
    if (Math.max(Math.abs(L[0] * L[0] + L[2] * L[2] - 1), Math.abs(L[0] * L[1] + L[2] * L[3]), Math.abs(L[1] * L[1] + L[3] * L[3] - 1)) < 1e-6) all.push({ M: [a, b, c, d], L, det });
  }
  const own = new Set(group.reps.map((r) => mul(mul(Bi, [r.a, r.b, r.c, r.d]), B).map((v) => Math.round(v)).join(',')));
  return { all, own, B };
}

/** The share of generic points (away from the outlines) whose tone the world isometry x -> L x + w keeps. */
function exactAgreement(group, P, L, w, n) {
  let a = 0x9e3779b9 >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const Lc = Math.hypot(...group.e1) + Math.hypot(...group.e2);
  let same = 0, done = 0;
  for (let i = 0; i < 20 * n && done < n; i++) {
    const x = group.center[0] + (2 * rnd() - 1) * Lc, y = group.center[1] + (2 * rnd() - 1) * Lc;
    if (P.margin(x, y) < 1e-3 * P.size) continue;
    const u = L[0] * x + L[1] * y + w[0], v = L[2] * x + L[3] * y + w[1];
    if (P.margin(u, v) < 1e-3 * P.size) continue;
    done++;
    if (P.tone(u, v) === P.tone(x, y)) same++;
  }
  return same / Math.max(1, done);
}

/**
 * The isometries beyond `seen`'s own (seen: the group whose symmetries count as its own; the print drawn by `drawn`'s
 * representatives): { near, exactLevel, extra: [the candidates over the exact level, with their exact agreement] }.
 */
function beyond(drawn, seen, P) {
  const { f, D } = raster(drawn, P), { all, own, B } = linearParts(seen);
  const Fr = new Float64Array(R * R), Fi = new Float64Array(R * R);
  for (let k = 0; k < R * R; k++) Fr[k] = f[k];
  fft2(Fr, Fi, -1);
  const cands = [];
  let slope = 0;
  for (const m of all) {
    const isI = m.M.join(',') === '1,0,0,1';
    if (!isI && own.has(m.M.join(','))) continue;
    const Mi = [m.M[3] * m.det, -m.M[1] * m.det, -m.M[2] * m.det, m.M[0] * m.det];
    const Gr = new Float64Array(R * R), Gi = new Float64Array(R * R);
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) Gr[j * R + i] = f[mod(Mi[2] * i + Mi[3] * j, R) * R + mod(Mi[0] * i + Mi[1] * j, R)];
    fft2(Gr, Gi, -1);
    const Pr = new Float64Array(R * R), Pi = new Float64Array(R * R);
    for (let k = 0; k < R * R; k++) { Pr[k] = Fr[k] * Gr[k] + Fi[k] * Gi[k]; Pi[k] = Fi[k] * Gr[k] - Fr[k] * Gi[k]; }
    fft2(Pr, Pi, +1);
    const C = new Float64Array(R * R);
    for (let k = 0; k < R * R; k++) C[k] = Pr[k] / (R * R);
    if (isI) slope = (2 * C[0] - C[1] - C[R]) / 2;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const v = C[j * R + i];
      if (isI && i === 0 && j === 0) continue;
      let peak = true;
      for (let dj = -1; dj <= 1 && peak; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && C[mod(j + dj, R) * R + mod(i + di, R)] > v) { peak = false; break; }
      if (peak) cands.push({ ov: v / D, L: m.L, t: [i, j] });
    }
  }
  cands.sort((a, b) => b.ov - a.ov);
  const exactLevel = 1 - (1.2 * slope) / D, extra = [];
  for (const c of cands.slice(0, 4)) {
    if (c.ov < Math.min(exactLevel, 0.95)) break;
    // the exact tone: the translation refined round the grid's peak — offsets a tenth of a sample apart, 150 points each;
    // then round the best five, a hundredth of a sample apart, 600 points each — and the best of those at 1500 points
    const wOf = (t) => [(B[0] * t[0] + B[1] * t[1]) / R, (B[2] * t[0] + B[3] * t[1]) / R];
    const coarse = [];
    for (let a = -10; a <= 10; a++) for (let b = -10; b <= 10; b++) coarse.push({ t: [c.t[0] + a / 10, c.t[1] + b / 10], d: a * a + b * b });
    for (const o of coarse) o.A = exactAgreement(seen, P, c.L, wOf(o.t), 150);
    coarse.sort((p, q) => q.A - p.A || p.d - q.d);
    let best = { A: -1 };
    for (const o of coarse.slice(0, 5)) for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {
      const t = [o.t[0] + a / 100, o.t[1] + b / 100], A = exactAgreement(seen, P, c.L, wOf(t), 600);
      if (A > best.A) best = { A, t };
    }
    const bw = wOf(best.t);
    extra.push({ near: +c.ov.toFixed(3), exact: exactAgreement(seen, P, c.L, bw, 1500), L: c.L.map((v) => +v.toFixed(3)), w: bw.map((v) => +v.toFixed(4)) });
  }
  return { near: cands.length ? cands[0].ov : 0, exactLevel, extra };
}

test('symmetry: no shipped shape print — Paisley, Soft commas, Tomoe, the Comma, all 17 groups — has an isometry its group lacks (not even one within the raster\'s resolution of exact)', (t) => {
  const found = [], rows = [];
  let nearest = { near: 0 };
  for (const key of ['paisley', 'soft', 'tomoe', 'comma']) for (const g of GROUPS) {
    const P = printFor(g, key);
    assert.ok(P && P.kind === 'shapes', `${key} ${g.id}: a print`);
    const r = beyond(g, g, P);
    for (const e of r.extra) if (e.exact > 0.99) found.push(`${key} ${g.id}: x -> ${JSON.stringify(e.L)} x + ${JSON.stringify(e.w)} keeps ${(100 * e.exact).toFixed(1)} % of generic points (raster ${e.near})`);
    if (r.near > nearest.near) nearest = { near: r.near, at: `${key} ${g.id}`, exactLevel: r.exactLevel };
    rows.push(`${key} ${g.id}: ${r.near.toFixed(3)} (exact ${r.exactLevel.toFixed(3)})`);
  }
  t.diagnostic(`the nearest to an extra symmetry: ${nearest.at}, ${nearest.near.toFixed(3)} of its dark kept (an exact one reads over ${nearest.exactLevel.toFixed(3)} at R = ${R})`);
  assert.deepEqual(found, [], 'extra symmetries');
});

test('symmetry: control — the print of 2222 looked at as a print of its translations alone has its half-turns found as extra symmetries; against its own group, none', () => {
  const g = BY_ID['2222'], P = printFor(g, 'paisley');
  const id = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, transl = { ...g, reps: [id] };
  const r = beyond(g, transl, P);
  assert.ok(r.extra.some((e) => e.exact > 0.999 && Math.abs(e.L[0] + 1) < 1e-3 && Math.abs(e.L[3] + 1) < 1e-3), `a half-turn: ${JSON.stringify(r.extra)}`);
  // and nothing is found where there is nothing: the same print against its own group
  assert.deepEqual(beyond(g, g, P).extra.filter((e) => e.exact > 0.99), []);
});
