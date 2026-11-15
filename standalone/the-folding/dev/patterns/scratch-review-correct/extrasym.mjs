// scratch (review-correct, 15 Nov 2026): does a SHIPPED print have a symmetry its group does not have? The page's own
// print (src/pattern.js printFor, the modules of src/patterns/ as they ship), not the design folders. Adapted from
// judge-math's symcheck.mjs (OUT/judge-math/tools/symcheck.mjs, 14 Nov, which ran on the design files BEFORE the polish and
// on the old *x lattice): the print rasterised on the torus R^2 / lattice (R x R samples in lattice coordinates), then
// every candidate extra symmetry at once by FFT correlation: the translations (M = I) and every lattice-preserving linear
// part M outside the group's point group (with any translation). An extra symmetry whose linear part IS in the point
// group, composed with the group's element of that linear part, is an extra translation, so these cover all.
//   near   |dark ∩ h^-1(dark)| / |dark| of the best non-group candidate h (1 = an exact extra symmetry)
//   kappa  (near - dark) / (1 - dark): above chance (the judges' k; the old comma reached 0.69)
//   exact  the raster's own level for an exact symmetry half a sample off the grid; a candidate over it is then checked
//          with the print's exact tone() at 4000 generic points (the translation refined to a hundredth of a sample)
//   marks  each mark (outer polygon with its holes): area (tile units), chi = best overlap with its own mirror image,
//          rho = with a turned copy (15..345 degrees)
//   node extrasym.mjs <keys comma-separated> [ids comma-separated] [--R 288] [--json]
import { GROUPS, BY_ID } from '../../../src/groups.js';
import { printFor } from '../../../src/pattern.js';

const argv = process.argv.slice(2);
const rIdx = argv.indexOf('--R');
const R = rIdx >= 0 ? +argv[rIdx + 1] : 288;
const KEYS = (argv[0] || 'paisley,soft,tomoe,comma').split(',');
const IDS = argv[1] && !argv[1].startsWith('--') ? argv[1].split(',') : GROUPS.map((g) => g.id);

// ---------------------------------------------------------------- FFT, mixed radix (n = 2^a 3^b 5^c) — symcheck's
function makeFFT(n) {
  const fac = []; let m = n;
  for (const p of [2, 3, 5]) while (m % p === 0) { fac.push(p); m /= p; }
  if (m !== 1) throw new Error('FFT size must be 2^a 3^b 5^c');
  const cosT = new Float64Array(n), sinT = new Float64Array(n);
  for (let k = 0; k < n; k++) { cosT[k] = Math.cos((2 * Math.PI * k) / n); sinT[k] = Math.sin((2 * Math.PI * k) / n); }
  const tmpR = new Float64Array(n), tmpI = new Float64Array(n);
  function rec(xr, xi, off, stride, len, oR, oI, oOff, sign, level) {
    if (len === 1) { oR[oOff] = xr[off]; oI[oOff] = xi[off]; return; }
    const p = fac[level], mm = len / p, s = n / len;
    for (let r = 0; r < p; r++) rec(xr, xi, off + stride * r, stride * p, mm, oR, oI, oOff + r * mm, sign, level + 1);
    for (let k = 0; k < mm; k++) {
      for (let q = 0; q < p; q++) {
        const kk = k + mm * q;
        let ar = 0, ai = 0;
        for (let r = 0; r < p; r++) {
          const idx = (r * kk * s) % n, c = cosT[idx], sn = sign * sinT[idx];
          const yr = oR[oOff + r * mm + k], yi = oI[oOff + r * mm + k];
          ar += yr * c - yi * sn; ai += yr * sn + yi * c;
        }
        tmpR[kk] = ar; tmpI[kk] = ai;
      }
    }
    for (let k = 0; k < len; k++) { oR[oOff + k] = tmpR[k]; oI[oOff + k] = tmpI[k]; }
  }
  const oR = new Float64Array(n), oI = new Float64Array(n);
  return (xr, xi, sign) => { rec(xr, xi, 0, 1, n, oR, oI, 0, sign, 0); return [oR, oI]; };
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
const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------- the print on the torus (the print's own polygons)
function raster(group, P) {
  const { e1, e2 } = group, dd = e1[0] * e2[1] - e1[1] * e2[0];
  const Wn = new Int16Array(R * R), cross = [];
  for (const r of group.reps) for (const Q of P.polys) {
    const n = Q.pts.length / 2, xs = new Float64Array(n), ys = new Float64Array(n);
    let y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const x = Q.pts[2 * k], y = Q.pts[2 * k + 1];
      const X = r.a * x + r.b * y + r.tx, Y = r.c * x + r.d * y + r.ty;
      xs[k] = ((X * e2[1] - Y * e2[0]) / dd) * R; ys[k] = ((e1[0] * Y - e1[1] * X) / dd) * R;
      if (ys[k] < y0) y0 = ys[k]; if (ys[k] > y1) y1 = ys[k];
    }
    const w = Q.hole ? -1 : 1;
    for (let j = Math.ceil(y0); j <= Math.floor(y1); j++) {
      cross.length = 0;
      for (let k = 0, m = n - 1; k < n; m = k++) {
        const a = ys[m], b = ys[k];
        if ((a <= j) !== (b <= j)) cross.push(xs[m] + ((j - a) * (xs[k] - xs[m])) / (b - a));
      }
      cross.sort((a, b) => a - b);
      const jj = mod(j, R);
      for (let q = 0; q + 1 < cross.length; q += 2) for (let i = Math.ceil(cross[q]); i <= Math.floor(cross[q + 1]); i++) Wn[jj * R + mod(i, R)] += w;
    }
  }
  const f = new Uint8Array(R * R); let D = 0;
  for (let k = 0; k < R * R; k++) if (Wn[k] > 0) { f[k] = 1; D++; }
  return { f, D };
}

function matsOf(group) {
  const { e1, e2 } = group, B = [e1[0], e2[0], e1[1], e2[1]], dd = B[0] * B[3] - B[1] * B[2];
  const Bi = [B[3] / dd, -B[1] / dd, -B[2] / dd, B[0] / dd];
  const mul = (P, Q) => [P[0] * Q[0] + P[1] * Q[2], P[0] * Q[1] + P[1] * Q[3], P[2] * Q[0] + P[3] * Q[2], P[2] * Q[1] + P[3] * Q[3]];
  const all = [];
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) for (let d = -3; d <= 3; d++) {
    const det = a * d - b * c; if (det !== 1 && det !== -1) continue;
    const L = mul(mul(B, [a, b, c, d]), Bi);
    const o = [L[0] * L[0] + L[2] * L[2] - 1, L[0] * L[1] + L[2] * L[3], L[1] * L[1] + L[3] * L[3] - 1];
    if (Math.max(...o.map(Math.abs)) < 1e-6) all.push({ M: [a, b, c, d], L, det });
  }
  const els = group.reps.map((r) => {
    const M = mul(mul(Bi, [r.a, r.b, r.c, r.d]), B).map((v) => Math.round(v));
    const tx = (r.tx * B[3] - r.ty * B[1]) / dd, ty = (B[0] * r.ty - B[2] * r.tx) / dd;
    return { M, t: [mod(Math.round(tx * R), R), mod(Math.round(ty * R), R)] };
  });
  const key = (e) => e.M.join(',') + '|' + e.t.join(',');
  const seen = new Map(els.map((e) => [key(e), e]));
  for (let grew = true; grew;) {
    grew = false;
    for (const p of [...seen.values()]) for (const q of [...seen.values()]) {
      const M = [p.M[0] * q.M[0] + p.M[1] * q.M[2], p.M[0] * q.M[1] + p.M[1] * q.M[3], p.M[2] * q.M[0] + p.M[3] * q.M[2], p.M[2] * q.M[1] + p.M[3] * q.M[3]];
      const t = [mod(p.M[0] * q.t[0] + p.M[1] * q.t[1] + p.t[0], R), mod(p.M[2] * q.t[0] + p.M[3] * q.t[1] + p.t[1], R)];
      const e = { M, t }, k = key(e);
      if (!seen.has(k)) { seen.set(k, e); grew = true; }
    }
  }
  return { all, G: [...seen.values()], B, Bi };
}

function describe(group, B, M, L, t) {
  const det = M[0] * M[3] - M[1] * M[2];
  const tw = [(B[0] * t[0] + B[1] * t[1]) / R, (B[2] * t[0] + B[3] * t[1]) / R];
  const lat = [];
  for (let m = -2; m <= 2; m++) for (let n = -2; n <= 2; n++) lat.push([m * group.e1[0] + n * group.e2[0], m * group.e1[1] + n * group.e2[1]]);
  const fr = (v) => { const x = mod(v / R, 1); for (const d of [2, 3, 4, 6]) { const k = Math.round(x * d); if (Math.abs(x * d - k) < 0.6 / R * d) return k === 0 ? '0' : `${k}/${d}`; } return x.toFixed(3); };
  if (det === 1) {
    const th = Math.atan2(L[2], L[0]);
    if (Math.abs(th) < 1e-6) return `translation (${fr(t[0])}, ${fr(t[1])})`;
    return `${Math.round((2 * Math.PI) / Math.abs(th))}-fold rotation`;
  }
  const phi = Math.atan2(L[2], L[0]) / 2, ax = [Math.cos(phi), Math.sin(phi)];
  let g = Infinity;
  for (const l of lat) g = Math.min(g, Math.abs((tw[0] + l[0]) * ax[0] + (tw[1] + l[1]) * ax[1]));
  const ang = mod(Math.round((phi * 180) / Math.PI), 180);
  return g < 0.5 * Math.sqrt(group.cellArea) / R * 2 ? `mirror at ${ang} deg` : `glide at ${ang} deg (step ${(g / Math.sqrt(group.domainArea)).toFixed(2)} tiles)`;
}

/** The exact tone under the world isometry x -> L x + w: the share of generic points (margin > 1e-3 tile) that keep their tone. */
function exactAgreement(group, P, L, w, n = 4000) {
  let a = 0x9e3779b9 >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const size = P.size, Lc = Math.hypot(...group.e1) + Math.hypot(...group.e2);
  let same = 0, done = 0;
  for (let i = 0; i < 20 * n && done < n; i++) {
    const x = group.center[0] + (2 * rnd() - 1) * Lc, y = group.center[1] + (2 * rnd() - 1) * Lc;
    if (P.margin(x, y) < 1e-3 * size) continue;
    const u = L[0] * x + L[1] * y + w[0], v = L[2] * x + L[3] * y + w[1];
    if (P.margin(u, v) < 1e-3 * size) continue;
    done++;
    if (P.tone(u, v) === P.tone(x, y)) same++;
  }
  return same / Math.max(1, done);
}

function symmetry(group, P, f, D) {
  const { all, G, B } = matsOf(group);
  const pg = new Set(G.map((e) => e.M.join(',')));
  let gmin = 1;
  for (const e of G) {
    let c = 0;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) if (f[j * R + i]) {
      const ii = mod(e.M[0] * i + e.M[1] * j + e.t[0], R), jj = mod(e.M[2] * i + e.M[3] * j + e.t[1], R);
      c += f[jj * R + ii];
    }
    gmin = Math.min(gmin, c / D);
  }
  const Fr = new Float64Array(R * R), Fi = new Float64Array(R * R);
  for (let k = 0; k < R * R; k++) Fr[k] = f[k];
  fft2(Fr, Fi, -1);
  const cands = [];
  let slope = 0;
  const lins = [];
  for (const m of all) {
    const isI = m.M.join(',') === '1,0,0,1';
    if (!isI && pg.has(m.M.join(','))) continue;
    lins.push(m.M.join(','));
    const det = m.det, Mi = [m.M[3] * det, -m.M[1] * det, -m.M[2] * det, m.M[0] * det];
    const Gr = new Float64Array(R * R), Gi = new Float64Array(R * R);
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const ii = mod(Mi[0] * i + Mi[1] * j, R), jj = mod(Mi[2] * i + Mi[3] * j, R);
      Gr[j * R + i] = f[jj * R + ii];
    }
    fft2(Gr, Gi, -1);
    const Pr = new Float64Array(R * R), Pi = new Float64Array(R * R);
    for (let k = 0; k < R * R; k++) { Pr[k] = Fr[k] * Gr[k] + Fi[k] * Gi[k]; Pi[k] = Fi[k] * Gr[k] - Fr[k] * Gi[k]; }
    fft2(Pr, Pi, +1);
    const C = new Float64Array(R * R);
    for (let k = 0; k < R * R; k++) C[k] = Pr[k] / (R * R);
    if (isI) slope = (2 * C[0] - C[1] - C[R]) / 2;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const k = j * R + i, v = C[k];
      if (isI && i === 0 && j === 0) continue;
      let peak = true;
      for (let dj = -1; dj <= 1 && peak; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        if (C[mod(j + dj, R) * R + mod(i + di, R)] > v) { peak = false; break; }
      }
      if (peak) cands.push({ ov: v / D, M: m.M, L: m.L, t: [i, j] });
    }
  }
  const pos = cands.sort((a, b) => b.ov - a.ov);
  const exactLevel = 1 - (1.2 * slope) / D;
  const best = pos.slice(0, 3).map((c) => {
    const o = { ov: +c.ov.toFixed(3), kind: describe(group, B, c.M, c.L, c.t), overExact: c.ov >= exactLevel };
    if (c.ov >= Math.min(exactLevel, 0.95)) {
      // the exact tone: the translation refined around the grid's peak (a hundredth of a sample)
      let bestA = -1, bt = null;
      for (let di = -1; di <= 1; di += 0.1) for (let dj = -1; dj <= 1; dj += 0.1) {
        const t = [c.t[0] + di, c.t[1] + dj], w = [(B[0] * t[0] + B[1] * t[1]) / R, (B[2] * t[0] + B[3] * t[1]) / R];
        const A = exactAgreement(group, P, c.L, w, 400);
        if (A > bestA) { bestA = A; bt = w; }
      }
      o.exactTone = +exactAgreement(group, P, c.L, bt, 4000).toFixed(4);
    }
    return o;
  });
  return { gmin: +gmin.toFixed(4), exactLevel: +exactLevel.toFixed(3), lins: lins.length, best };
}

// ---------------------------------------------------------------- a mark's hand and direction — symcheck's
function inside(p, x, y) {
  let inn = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const yi = p[2 * i + 1], yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn;
  }
  return inn;
}
function marksOf(P) {
  const outers = P.polys.filter((Q) => !Q.hole), holes = P.polys.filter((Q) => Q.hole);
  return outers.map((O) => ({ O, holes: holes.filter((H) => inside(O.pts, H.pts[0], H.pts[1])) }));
}
function handOf(mark, size) {
  const K = 72, { O, holes } = mark, [x0, y0, x1, y1] = O.box;
  const s = Math.max(x1 - x0, y1 - y0), h = s / (K - 8), ox = (x0 + x1) / 2 - (K / 2) * h, oy = (y0 + y1) / 2 - (K / 2) * h;
  const g = new Uint8Array(K * K); let n = 0, cx = 0, cy = 0;
  for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
    const x = ox + (i + 0.5) * h, y = oy + (j + 0.5) * h;
    if (inside(O.pts, x, y) && !holes.some((H) => inside(H.pts, x, y))) { g[j * K + i] = 1; n++; cx += x; cy += y; }
  }
  if (!n) return null;
  cx /= n; cy /= n;
  const pts = [];
  for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) if (g[j * K + i]) pts.push([ox + (i + 0.5) * h, oy + (j + 0.5) * h]);
  const at = (x, y) => { const i = Math.floor((x - ox) / h), j = Math.floor((y - oy) / h); return i >= 0 && j >= 0 && i < K && j < K ? g[j * K + i] : 0; };
  const over = (A, sh) => {
    let c = 0;
    for (const [x, y] of pts) { const dx = x - cx - sh[0], dy = y - cy - sh[1]; c += at(cx + A[0] * dx + A[1] * dy, cy + A[2] * dx + A[3] * dy); }
    return c / pts.length;
  };
  const shifts = []; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) shifts.push([a * 0.025 * s, b * 0.025 * s]);
  let chi = 0, rho = 0;
  for (let d = 0; d < 180; d += 3) {
    const t = (2 * d * Math.PI) / 180, A = [Math.cos(t), Math.sin(t), Math.sin(t), -Math.cos(t)];
    for (const sh of shifts) { const v = over(A, sh); if (v > chi) chi = v; }
  }
  for (let d = 15; d <= 345; d += 5) {
    const t = (d * Math.PI) / 180, A = [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t)];
    for (const sh of shifts) { const v = over(A, sh); if (v > rho) rho = v; }
  }
  return { area: +((O.area - holes.reduce((s2, H) => s2 + H.area, 0)) / size ** 2).toFixed(3), holes: holes.length, chi: +chi.toFixed(3), rho: +rho.toFixed(3) };
}

const out = [];
for (const key of KEYS) {
  for (const id of IDS) {
    const group = BY_ID[id], t0 = Date.now();
    const P = printFor(group, key);
    if (!P) { out.push({ key, id, error: 'no print' }); console.log(key, id, 'NO PRINT'); continue; }
    const { f, D } = raster(group, P);
    const sym = symmetry(group, P, f, D);
    const marks = marksOf(P).map((m) => handOf(m, P.size)).filter(Boolean).sort((a, b) => b.area - a.area);
    const dark = D / (R * R), b = sym.best[0];
    const row = { key, id, dark: +dark.toFixed(3), ...sym, kappa: +((b.ov - dark) / (1 - dark)).toFixed(3), marks, ms: Date.now() - t0 };
    out.push(row);
    console.log(`${key.padEnd(8)} ${id.padEnd(6)} dark ${row.dark.toFixed(3)}  G ${sym.gmin.toFixed(3)}  near ${b.ov.toFixed(3)} k ${row.kappa.toFixed(2)}${b.overExact ? ' OVER-EXACT-LEVEL' : ''}${b.exactTone !== undefined ? ` exactTone ${b.exactTone}` : ''} ${b.kind} | 2nd ${sym.best[1] ? sym.best[1].ov + ' ' + sym.best[1].kind : '-'} | exactLevel ${sym.exactLevel} lins ${sym.lins} | marks ${marks.slice(0, 4).map((m) => `${m.area}a/${m.chi}x/${m.rho}r${m.holes ? '/h' + m.holes : ''}`).join(' ')}  ${row.ms}ms`);
  }
}
if (argv.includes('--json')) console.log('JSON ' + JSON.stringify(out));
