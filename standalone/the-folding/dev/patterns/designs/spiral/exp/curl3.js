// exp/curl2.js — prototype 2: the spiral as a FIGURE. A round head, one arm winding out round it and tapering to a
// point, a channel of one width between the turns. Drawn in a ROUND model (polar (u, phi) about the tile's Chebyshev
// centre, u = 1 on the rim) and carried into the tile by fitted levels r(u, phi) = u (T + u^k (Rr(phi) - T)). The last
// whorl's outer edge is the rim set back by a crescent that grows from the tip backward (a true width), and vanishes at
// the tile's sharp corners (so they stay under the arm). A level set, traced by marching squares.
import { TAU, tilePolygon, sidesOf, insetPolygon, shapeOf, chebyshev, smin, smax, sdConvex, traceLoops, thinLoop, loopArea } from './lib.js';

export const meta = { key: 'curl3', label: 'Curl3', hint: 'prototype' };
export const KNOBS = {
  margin: 0.026, squashCap: 2.2, keepDepth: 0.9,
  round: 0.05,       // the rim's corner radius (true)
  k: 5,              // how late the levels take the tile's shape
  turns: 1.6,        // turns of the arm
  chU: 0.2, chMin: 0.055,   // the channel: share of the inradius T, at least this (true)
  hwU: 0.24, hwMin: 0.03,   // the arm's half width at its root: share of T, at least (true)
  taper: 1,          // hw = hw0 (1 - x/N)^taper
  rootTurn: 0.22,    // the root rises out of the head over this many turns
  eps: 0.012,        // the tip this far inside the rim (true)
  crescent: 0.085,   // the bare between the last whorl and the rim, one turn back from the tip (true)
  sharp: 100, sharpWin: 0.6,  // corners under `sharp` degrees keep the last whorl on the rim, over sharpWin radians
  blend: 0.02, blendHead: 0.04,
  grid: 0.004, tol: 0.0004,
  hand: 1, tipAt: 'sharpest',
  mouth: 0.15,       // turns past the mouth over which the crescent shrinks to its true width
};

export function curlIn(tile, ts, K = KNOBS, opts = {}) {
  const t0 = sidesOf(tile, 1e-9 * ts);
  const rimP = insetPolygon(t0.poly, t0.S, K.margin * ts);
  const sh = shapeOf(rimP), co = Math.cos(sh.angle), si = Math.sin(sh.angle);
  const sq = (f) => rimP.map((p) => { const x = p[0] - sh.cx, y = p[1] - sh.cy; return [(co * x + si * y) / f, -si * x + co * y]; });
  const depthAt = (f) => chebyshev(sidesOf(sq(f), 1e-9 * ts).S, ts).r;
  let a = Math.min(sh.aspect, K.squashCap);
  const need = K.keepDepth * depthAt(1);
  if (a > 1 && depthAt(a) < need) { let lo = 1, hi = a; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (depthAt(mid) >= need) lo = mid; else hi = mid; } a = lo; }
  const Qs = sidesOf(sq(a), 1e-9 * ts), Q = Qs.poly, che = chebyshev(Qs.S, ts), T = che.r, cx = che.cx, cy = che.cy;
  const rr = K.round * ts, Qin = insetPolygon(Q, Qs.S, rr);
  const sdQ = (x, y) => (Qin.length >= 3 ? sdConvex(Qin, x, y) - rr : sdConvex(Q, x, y));
  const NA = 1024, Rr = new Float64Array(NA + 1);
  for (let j = 0; j <= NA; j++) {
    const th = (TAU * j) / NA, ux = Math.cos(th), uy = Math.sin(th);
    let lo = 0, hi = 4 * ts;
    for (let it = 0; it < 36; it++) { const mid = (lo + hi) / 2; if (sdQ(cx + mid * ux, cy + mid * uy) < 0) lo = mid; else hi = mid; }
    Rr[j] = (lo + hi) / 2;
  }
  const RrAt = (th) => { let x = (th / TAU) * NA; x -= Math.floor(x / NA) * NA; const j = Math.floor(x), w = x - j; return Rr[j] * (1 - w) + Rr[j + 1] * w; };
  const kk = K.k;
  // the stretch at the rim: true (normal) length of one u-unit there; kappa = T / J1 <= 1
  const KAP = new Float64Array(NA + 1);
  for (let j = 0; j <= NA; j++) {
    const jm = (j + NA - 1) % NA, jp = (j + 1) % NA, dR = (Rr[jp] - Rr[jm]) / ((2 * TAU) / NA);
    const cosPsi = 1 / Math.sqrt(1 + (dR / Rr[j]) ** 2), J1 = (T + (kk + 1) * Math.max(0, Rr[j] - T)) * cosPsi;
    KAP[j] = Math.min(1, T / J1);
  }
  const kapAt = (th) => { let x = (th / TAU) * NA; x -= Math.floor(x / NA) * NA; const j = Math.floor(x), w = x - j; return KAP[j] * (1 - w) + KAP[j + 1] * w; };
  const uOf = (t, R) => {
    const D = Math.max(0, R - T);
    let u = Math.min(1.3, t / R);
    for (let it = 0; it < 7; it++) { const uk = Math.pow(u, kk), g = T * u + D * uk * u - t, gp = T + (kk + 1) * D * uk; u -= g / gp; if (u < 0) u = 0; }
    return u;
  };
  // the corners: true angle (of the unsqueezed rim), direction from c in the squeezed frame
  const corners = [];
  for (let j = 0; j < rimP.length; j++) {
    const p = rimP[(j + rimP.length - 1) % rimP.length], q = rimP[j], r = rimP[(j + 1) % rimP.length];
    const v1 = [p[0] - q[0], p[1] - q[1]], v2 = [r[0] - q[0], r[1] - q[1]];
    const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))))) * 180 / Math.PI;
    const x = q[0] - sh.cx, y = q[1] - sh.cy, qx = (co * x + si * y) / a, qy = -si * x + co * y;
    corners.push({ ang, dir: Math.atan2(qy - cy, qx - cx) });
  }
  const angDist = (p, q) => { let d = Math.abs(p - q) % TAU; return d > Math.PI ? TAU - d : d; };
  const sigma = (th) => {
    let s = 1;
    for (const c of corners) {
      const w = Math.max(0, Math.min(1, (K.sharp - c.ang) / 30));
      if (!w) continue;
      const q = angDist(th, c.dir) / K.sharpWin;
      if (q < 1) s *= 1 - w * (1 - q * q) * (1 - q * q);
    }
    return s;
  };
  // ---- the arm in the round model (u-units: true / T) -----------------------------------------------------------
  const ch = Math.max(K.chU, (K.chMin * ts) / T), hw0 = Math.max(K.hwU, (K.hwMin * ts) / T);
  const N = opts.turns || K.turns, epsU = (K.eps * ts) / T;
  const hw = (x) => Math.max(0, hw0 * Math.pow(Math.max(0, 1 - x / N), K.taper));
  const NT = 400, M = Math.round(N * NT) + 1, ucT = new Float64Array(M);
  const build = (H) => {
    for (let i = 0; i < M; i++) {
      const x = (i / (M - 1)) * N;
      if (x < 1) {
        const full = H + ch + hw(x), root = H - hw(0);
        const q = Math.min(1, x / K.rootTurn), sm = q * q * (3 - 2 * q);
        ucT[i] = root + (full - root) * sm;
      } else {
        const j = i - NT, xj = (j / (M - 1)) * N;
        ucT[i] = Math.max(H, ucT[j] + hw(xj)) + ch + hw(x);
      }
    }
    return ucT[M - 1];
  };
  let lo = 0, hi = 1;
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (build(mid) < 1 - epsU) lo = mid; else hi = mid; }
  const H = lo; build(H);
  const ucAt = (x) => { const p = (x / N) * (M - 1); if (p <= 0) return ucT[0]; if (p >= M - 1) return ucT[M - 1]; const j = Math.floor(p), w = p - j; return ucT[j] * (1 - w) + ucT[j + 1] * w; };
  const dUc = (x) => (ucAt(Math.min(N, x + 0.004)) - ucAt(Math.max(0, x - 0.004))) / (Math.min(N, x + 0.004) - Math.max(0, x - 0.004));
  // the tip's direction (squeezed frame): toward the sharpest corner, or opts.tip
  let tipDir = 0;
  if (opts.tipDir !== undefined) tipDir = opts.tipDir;
  else { let best = Infinity; for (const c of corners) if (c.ang < best - 1e-6) { best = c.ang; tipDir = c.dir; } }
  const hand = opts.hand || K.hand, Theta = TAU * N, rootAng = tipDir - hand * Theta;
  const bl = K.blend * ts, blH = K.blendHead * ts, cres = K.crescent * ts, eps = K.eps * ts;
  const f = (X, Y) => {
    const dx0 = X - sh.cx, dy0 = Y - sh.cy;
    const qx = (co * dx0 + si * dy0) / a, qy = -si * dx0 + co * dy0;
    const sr = sdQ(qx, qy);
    if (sr > bl) return sr;
    const ex = qx - cx, ey = qy - cy, t = Math.hypot(ex, ey), th = Math.atan2(ey, ex);
    const R = RrAt(th), u = uOf(t, R), J = T + (kk + 1) * Math.pow(u, kk) * Math.max(0, R - T);
    const dHead = (u - H) * J;
    let base = hand * (th - rootAng); base -= Math.floor(base / TAU) * TAU;
    let D = Infinity;
    for (let xa = base; xa <= Theta + 1e-9; xa += TAU) {
      const x = xa / TAU, uc = ucAt(x), h = hw(x), sl = dUc(x) / TAU, cs = 1 / Math.sqrt(1 + (sl / Math.max(u, 0.05)) ** 2);
      let d;
      if (x < N - 1) d = (Math.abs(u - uc) - h) * J * cs;
      else {
        // the last turn: its outer edge is the rim less a crescent (u-units), eps + ch at the mouth down to eps at the
        // tip; past the mouth it is shrunk where the rim is stretched (kappa) and at sharp corners (sigma)
        const q = Math.min(1, (x - (N - 1)) / K.mouth), m = q * q * (3 - 2 * q);
        const fac = 1 - m * (1 - kapAt(th) * sigma(th));
        const oe = 1 - (epsU + ch * (N - x)) * fac;
        d = Math.max(uc - h - u, u - oe) * J * cs;
      }
      D = D === Infinity ? d : smin(D, d, bl);
    }
    const dark = D === Infinity ? dHead : smin(dHead, D, blH);
    return smax(sr, dark, bl);
  };
  if (opts.debug) return { f, corners, rimP, sh, a, T, cx, cy, H, N, tipDir, hand, sigma, kapAt, ucAt, hw, ch, epsU };
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const p of rimP) { X0 = Math.min(X0, p[0]); X1 = Math.max(X1, p[0]); Y0 = Math.min(Y0, p[1]); Y1 = Math.max(Y1, p[1]); }
  const g = K.grid * ts, pad = 2 * g, nx = Math.ceil((X1 - X0 + 2 * pad) / g) + 1, ny = Math.ceil((Y1 - Y0 + 2 * pad) / g) + 1;
  const gx0 = X0 - pad, gy0 = Y0 - pad, F = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let v = i === 0 || j === 0 || i === nx - 1 || j === ny - 1 ? 1 : f(gx0 + i * g, gy0 + j * g);
    if (v === 0) v = 1e-12;
    F[j * nx + i] = v;
  }
  const loops = traceLoops(F, nx, ny, gx0, gy0, g);
  let best = null, bestA = 0;
  for (const L of loops) { const A = loopArea(L); if (A > bestA) { bestA = A; best = L; } }
  return { pts: thinLoop(best, K.tol * ts), info: { head: +((H * T) / ts).toFixed(3), T: +(T / ts).toFixed(3), ch: +((ch * T) / ts).toFixed(3), hw0: +((hw0 * T) / ts).toFixed(3), squeeze: +a.toFixed(3), loops: loops.length } };
}

export function find(group) {
  const ts = Math.sqrt(group.domainArea);
  const r = curlIn(tilePolygon(group), ts, KNOBS);
  return { shapes: [{ pts: r.pts, hole: false }], info: r.info };
}
