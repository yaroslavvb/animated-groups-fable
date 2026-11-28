// solver.js — the closed surface of the orbifold PQRS in space: two pillows, seals zipped, joined at the loop.
// Pure: no DOM; stands on pillow.js alone. 2222 is NOT handled here (the page has its exact module): set() throws.
//
//   const surf = createSurface({ nVertices: 2600 });      or { nTheta, nS } to fix the grid
//   surf.set(orders, L, tw, budgetMs = 30)   cold start: the start shape, then iterations within the budget
//   surf.settle(budgetMs)                    goes on (and catches up with the last update's numbers while surf.lag > 0)
//   surf.update(L, tw, budgetMs = 4)         warm: a slider frame for nearby numbers
//   surf.prepare(orders, L, tw) -> mesh      the mesh and a start shape for a state, no iterations (before a flip's carry)
//   surf.adoptPositions(positions, budgetMs) take closed positions for the CURRENT mesh (a flip's carry) and settle from them
//   surf.open(f) -> Float64Array             3 per vertex of mesh.open: f = 1 the closed surface, f = 0 the exact open crowns
//   surf.stats() -> { strainMean, strainMax, iterations, converged, regime: 'formula' | 'flat-start', lag }
//   live: surf.positions (Float64Array, 3 per closed vertex), surf.mesh (pillow.js's mesh), surf.meshVersion (changes when
//         triangles or edges are rewritten: a new mesh object, or the strip re-stitched), surf.converged, surf.settling,
//         surf.lag (sub-steps the surface is still behind the numbers of the last update; the surface shown is the orbifold
//         at surf.mesh.L, surf.mesh.tw)
//
// METHOD
//   energy   on the closed mesh: edge springs (a_e / 2)(|d| / rest - 1)^2, a_e a third of the two rest triangles
//            + bending (kBend / 2) |cotangent Laplacian of x|^2 / A, weights from the REST lengths, seal and cone vertices
//              left out (the seals are free creases)
//            + fold guard: a one-sided spring between the two far corners of every hinge at their flat distance
//            - pressure * volume (stands in for contact)
//   minimiser L-BFGS (two-loop, Armijo backtracking). One iteration is a function of the state alone, so the sequence of
//            shapes does not depend on how the time budget is cut into calls.
//   start    'formula': each pillow's rows laid on plane convex curves K(u) = A Seg + B Seg + c Disc (rounded parallelograms)
//            of the rows' own lengths, heights integrated up the meridians, 8 light edge sweeps: clean, mirror-symmetric
//            in the twist, the upper pillow turned by 2 pi tw. Used where its meridians are not overrun (info.over small).
//            'flat-start': the disphenoid of the flat 2222 whose loop is as long as this waist and whose pockets are as
//            high as these pillows on average, puffed 4 %: closed, convex, right for wide waists and (2, 2) pairs.
//   cap      settling stops at an iteration cap (formula start: before the seal notch of full convergence appears) or when
//            the mean stretch has stopped falling.
//   warm     Twist: the upper pillow is turned by 2 pi dtw about the waist's axis, then iterations. Length: the positions
//            are carried by the difference of two start shapes (formula where both are good, else flat), then iterations.
//            A change is taken in sub-steps (stepL, stepTw); a new sub-step is taken only when the last one has settled
//            enough (mean stretch under a gate), so a fast drag leaves surf.lag > 0 and later calls catch up.
import * as P from './pillow.js';

const { PI, sqrt, sin, cos, abs, min, max, floor, acos, asin, pow, log, ceil } = Math;
const TAU = 2 * PI;
const now = () => performance.now();

export const DEFAULTS = {
  nVertices: 2600, nTheta: 0, nS: 0,
  // the energy (the energy prototype's values)
  kBend: 1e-5, kFold: 0.1, pressure: 3e-3, thinFactor: 2, puff: 0.04, mem: 10, gtol: 1e-9, ftol: 1e-10,
  // the cap on polish
  capFormula: 100,     // iterations after a formula start
  capFlat: 2500,       // iterations after a flat start
  capWarm: 150,        // iterations after the last warm step
  capAdopt: 150,       // iterations after adoptPositions
  stallWindow: 100, stallShare: 0.01, stallFrom: 100, stallFromFlat: 800,
  warmWindow: 10, warmShare: 0.02, warmFrom: 20,      // after a warm step or adoptPositions: a short test, so a shape near rest stays put   // stop when the mean stretch fell by less than stallShare over stallWindow iterations
  // the formula (the constructive prototype's values)
  sweeps: 8, eta: 0.62, roundMin: 0.5, qRate: 0.8, qMin: 1.2, qMax: 2.2, safe: 0.02, safeRamp: 2.5, polishCut: 6, fPuff: 0.3, lam: 0, zMin: 0.12,
  overCold: 0.2,       // cold start: the formula is used when info.over (overrun of the meridians / (safe x their length)) is at most this
  overWarm: 0,         // Length predictor: the formula's difference is used when both ends have info.over at most this
  // warm steps
  stepL: 0.04,         // largest sub-step of ln L where the linear map carries the surface
  stepLFormula: 0.15,  // ... where the formula's difference does (the present state has info.over <= overWarm)
  stepTw: 0.02,        // largest sub-step of the twist
  gateBend: 1.4,       // ... and the bending energy under gateBend x its last rest value (else the surface gets lumpy in a drag)
  gateAbs: 0.015, gateRel: 1.3,   // the next sub-step is taken when the mean stretch is under max(gateAbs, gateRel x the last rest value)
  hardGate: 0.03,      // ... or after maxSubIters iterations if the mean stretch is under this; else only at the cap
  minSubIters: 3, maxSubIters: 60,
  // never a crossed surface on screen: a cold start is HELD (positions = the last shape that passed the crossing test)
  checkEvery: 20,      // iterations between crossing tests while held (then a quarter of the count so far)
  capHard: 6000,       // a held start that still crosses at rest goes on to this many iterations, then gives up (stats().crossed)
  trustOver: -1,       // a formula start with info.over at most this is not held (no crossing test); -1: every cold start is held
};

let KX = 0, KY = 0;
/** The point at arclength t (counter-clockwise) from the bisector corner of K = A Seg(1,0) + B Seg(cos psi, sin psi) + c Disc. */
function pointOnK(A, B, c, psi, t) {
  let mir = 1;
  if (psi < 0) { psi = -psi; t = -t; mir = -1; }
  const per = 4 * A + 4 * B + TAU * c;
  if (!(per > 0)) { KX = 0; KY = 0; return; }
  t -= per * floor(t / per);
  const cp = cos(psi), sp = sin(psi), hb = 0.5 * psi, ic = c > 1e-300 ? 1 / c : 0;
  let cx = A + B * cp, cy = B * sp, nu = hb, l;
  walk: {
    l = c * (PI / 2 - hb); if (t <= l) { nu += t * ic; break walk; } t -= l; nu = PI / 2;
    l = 2 * A; if (t <= l) { cx -= t; break walk; } t -= l; cx -= l;
    l = c * psi; if (t <= l) { nu += t * ic; break walk; } t -= l; nu = PI / 2 + psi;
    l = 2 * B; if (t <= l) { cx -= t * cp; cy -= t * sp; break walk; } t -= l; cx -= l * cp; cy -= l * sp;
    l = c * (PI - psi); if (t <= l) { nu += t * ic; break walk; } t -= l; nu = 1.5 * PI;
    l = 2 * A; if (t <= l) { cx += t; break walk; } t -= l; cx += l;
    l = c * psi; if (t <= l) { nu += t * ic; break walk; } t -= l; nu = 1.5 * PI + psi;
    l = 2 * B; if (t <= l) { cx += t * cp; cy += t * sp; break walk; } t -= l; cx += l * cp; cy += l * sp;
    nu += t * ic;
  }
  KX = cx + c * cos(nu); KY = mir * (cy + c * sin(nu));
}

export function createSurface(opts = {}) {
  const K = { ...DEFAULTS };
  for (const k in opts) if (opts[k] !== undefined && opts[k] !== null) K[k] = opts[k];
  let mesh = null, topo = null, n = 0, nE = 0, nT = 0, gN = 0, gS = 0;
  let x, g, xn, gn, dir, yv, G0, G1, form, formPrev, openForm, openOut, wA;
  let eK, eW, eA, eR, vA, vC, mask, triEdge, S, Y, rho, alpha, fHist, sHist;
  let dI, dJ, dL, dK, dX, dH, dCnt, isCone;
  const Wt = [null, null], Gt = [null, null], Hh = [null, null];
  let X2 = null, Y2 = null, Z2 = null, OV = null;
  let staticMap = null, stripCells = NaN, shownCells = NaN, pFactor = 1;
  let hist = 0, head = 0, E = 0, dirty = true, evMean = 0, evMax = 0, evBend = 0, strainNow = 0, strainMaxNow = 0, bendNow = 0, restBend = Infinity;
  let iters = 0, total = 0, cap = 0, stopFlag = false, converged = false, regime = 'flat-start', restStrain = Infinity;
  let tgtL = 0, tgtTw = 0, lag = 0;
  let nextCheck = 0, stallFrom = 100, stallWin = 100, stallShare = 0.01, coldHold = false;
  let hold = false, shown = null, shownMean = 0, shownMax = 0, grace = 0, crossedAtRest = false, unverified = false, repairs = 0, checks = 0, checkMs = 0;
  let restarts = 0;
  let tBox = null, tCell = null, bHead = null, bNext = null, bSize = 0, restOld = null;
  const NA = new Float64Array(36), NB = new Float64Array(6);
  let tablesL = NaN, formL = NaN, formTw = NaN, formOver = Infinity;
  const info = { psi: 0, c0: 0, mu: [0, 0], over: 0, clamped: 0 };
  const flatNow = { cuff: 0, h0: 0, h1: 0 }, flatWas = { cuff: 0, h0: 0, h1: 0 };
  const FC = new Float64Array(12);                 // the flat disphenoid's corners A, B, C, D
  let fvax = 0, fvay = 0, fvbx = 0, fvby = 0;

  // ---------------------------------------------------------------- buffers, once per topology
  function alloc() {
    topo = mesh._topo; n = mesh.nVertices; nE = mesh.nEdges; nT = mesh.nTriangles;
    const n3 = 3 * n, m = K.mem, N = topo.N, nS = topo.nS, nO3 = 3 * mesh.open.nVertices;
    x = new Float64Array(n3); g = new Float64Array(n3); xn = new Float64Array(n3); gn = new Float64Array(n3);
    dir = new Float64Array(n3); yv = new Float64Array(n3); G0 = new Float64Array(n3); G1 = new Float64Array(n3);
    form = new Float64Array(n3); formPrev = new Float64Array(n3); wA = new Float64Array(n);
    shown = new Float64Array(n3); restOld = new Float64Array(nE); tBox = new Float64Array(6 * nT); tCell = new Int32Array(3 * nT); bNext = new Int32Array(nT);
    bSize = 1; while (bSize < 2 * nT) bSize <<= 1; bHead = new Int32Array(bSize);
    openForm = new Float64Array(nO3); openOut = new Float64Array(nO3);
    eK = new Float64Array(nE); eW = new Float64Array(nE); eA = new Float64Array(nE); eR = new Float64Array(nE);
    vA = new Float64Array(n); vC = new Float64Array(n); mask = new Uint8Array(n);
    triEdge = new Uint32Array(3 * nT);
    dI = new Uint32Array(nE); dJ = new Uint32Array(nE); dL = new Float64Array(nE); dK = new Float64Array(nE); dX = new Float64Array(nE); dH = new Float64Array(nE); dCnt = new Uint8Array(nE); isCone = new Uint8Array(n);
    S = new Float64Array(m * n3); Y = new Float64Array(m * n3); rho = new Float64Array(m); alpha = new Float64Array(m);
    fHist = new Float64Array(30); sHist = new Float64Array(max(1, K.stallWindow));
    for (let k = 0; k < 2; k++) { Wt[k] = new Float64Array((nS + 1) * (N + 1)); Gt[k] = new Float64Array(nS + 1); Hh[k] = new Float64Array(N); }
    X2 = new Float64Array((nS + 1) * N); Y2 = new Float64Array((nS + 1) * N); Z2 = new Float64Array((nS + 1) * N); OV = new Float64Array(nS + 1);
    // the edge of every triangle side, fixed part (the strip's sides are set by syncStrip)
    staticMap = new Map();
    const ed = mesh.edges, nFixed = mesh.strip.edgeStart;
    for (let e = 0; e < nFixed; e++) { const a = ed[2 * e], b = ed[2 * e + 1]; staticMap.set(a < b ? a * n + b : b * n + a, e); }
    const tr = mesh.triangles, nTriFixed = mesh.strip.triStart;
    for (let t = 0; t < nTriFixed; t++) for (let k = 0; k < 3; k++) {
      const a = tr[3 * t + k], b = tr[3 * t + (k + 1) % 3], e = staticMap.get(a < b ? a * n + b : b * n + a);
      if (e === undefined) throw new Error('solver: a triangle side without an edge');
      triEdge[3 * t + k] = e;
    }
    mask.fill(1);
    for (const sl of mesh.seals) for (let k = 0; k < sl.chain.length; k++) mask[sl.chain[k]] = 0;
    isCone[mesh.cones.P] = 1; isCone[mesh.cones.Q] = 1; isCone[mesh.cones.R] = 1; isCone[mesh.cones.S] = 1;
    stripCells = NaN; tablesL = NaN; formL = NaN;
  }

  // the strip's triangles (b0, b1, t0), (b1, t1, t0) and their sides; pillow.js's fillTwist writes them in this order
  function syncStrip() {
    const N = topo.N, t0i = mesh.strip.triStart, e0 = mesh.strip.edgeStart, tr = mesh.triangles;
    for (let k = 0; k < N; k++) {
      const ta = t0i + 2 * k, tb = ta + 1, k1 = (k + 1) % N;
      const b0 = tr[3 * ta], b1 = tr[3 * ta + 1], t1 = tr[3 * tb + 1], t0 = tr[3 * tb + 2];
      const eB = staticMap.get(b0 < b1 ? b0 * n + b1 : b1 * n + b0), eT = staticMap.get(t0 < t1 ? t0 * n + t1 : t1 * n + t0);
      if (eB === undefined || eT === undefined) throw new Error('solver: a strip ring edge is missing');
      triEdge[3 * ta] = eB; triEdge[3 * ta + 1] = e0 + 2 * k + 1; triEdge[3 * ta + 2] = e0 + 2 * k;
      triEdge[3 * tb] = e0 + 2 * k1; triEdge[3 * tb + 1] = eT; triEdge[3 * tb + 2] = e0 + 2 * k + 1;
    }
    stripCells = mesh.strip.cells;
  }

  // everything the energy takes from the rest lengths
  function refreshWeights() {
    if (stripCells !== mesh.strip.cells) syncStrip();
    if (shownCells !== mesh.strip.cells) { shownCells = mesh.strip.cells; api.meshVersion++; }
    const tr = mesh.triangles, rest = mesh.restLength, ed = mesh.edges;
    eW.fill(0); eA.fill(0); vA.fill(0);
    for (let t = 0; t < nT; t++) {
      const e0 = triEdge[3 * t], e1 = triEdge[3 * t + 1], e2 = triEdge[3 * t + 2];
      const a = rest[e0], b = rest[e1], c = rest[e2], s = 0.5 * (a + b + c);
      const A = sqrt(max(1e-30, s * (s - a) * (s - b) * (s - c))), q = 0.125 / A, A3 = A / 3;
      const a2 = a * a, b2 = b * b, c2 = c * c;
      eW[e0] += q * (b2 + c2 - a2); eW[e1] += q * (c2 + a2 - b2); eW[e2] += q * (a2 + b2 - c2);
      eA[e0] += A3; eA[e1] += A3; eA[e2] += A3;
      vA[tr[3 * t]] += A3; vA[tr[3 * t + 1]] += A3; vA[tr[3 * t + 2]] += A3;
    }
    for (let e = 0; e < nE; e++) { eR[e] = 1 / rest[e]; eK[e] = eA[e] * eR[e] * eR[e]; }
    for (let i = 0; i < n; i++) vC[i] = mask[i] ? K.kBend / vA[i] : 0;
    // the fold guard: the two far corners of each hinge and their distance when the hinge is flat
    dCnt.fill(0);
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
      const e = triEdge[3 * t + k], l = rest[e], lb = rest[triEdge[3 * t + (k + 2) % 3]], la = rest[triEdge[3 * t + (k + 1) % 3]];
      let xo = (l * l + lb * lb - la * la) / (2 * l);
      const h = sqrt(max(0, lb * lb - xo * xo)), opp = tr[3 * t + (k + 2) % 3];
      if (tr[3 * t + k] !== ed[2 * e]) xo = l - xo;
      if (dCnt[e] === 0) { dI[e] = opp; dX[e] = xo; dH[e] = h; dCnt[e] = 1; }
      else { dJ[e] = opp; const ax = dX[e] - xo, ay = dH[e] + h; dL[e] = sqrt(ax * ax + ay * ay); dCnt[e] = 2; }
    }
    for (let e = 0; e < nE; e++) {
      const i = ed[2 * e], j = ed[2 * e + 1];
      dK[e] = K.kFold > 0 && dCnt[e] === 2 && !(mask[i] === 0 && mask[j] === 0) && !isCone[i] && !isCone[j] && dI[e] !== dJ[e] ? (K.kFold * eA[e]) / (dL[e] * dL[e]) : 0;
    }
    // the flat proxy's numbers: the pillows' mean heights
    const N = topo.N, H = N >> 1, cuff = mesh.cuff;
    for (const pt of topo.parts) {
      let a = 0;
      if (!pt.deg) { const pl = mesh.pillows[pt.k]; for (let j = 0; j <= H; j++) a += (j === 0 || j === H ? 0.5 : 1) * pl.roofAt((j * cuff) / N); a /= H; }
      if (pt.k === 0) flatNow.h0 = a; else flatNow.h1 = a;
    }
    flatNow.cuff = cuff;
    dirty = true;
  }

  // ---------------------------------------------------------------- energy and gradient (and the stretch, on the way)
  function evalEG(X, G) {
    const ed = mesh.edges, rest = mesh.restLength;
    let en = 0, ss = 0, sm = 0;
    G.fill(0); yv.fill(0);
    for (let e = 0; e < nE; e++) {
      const i = 3 * ed[2 * e], j = 3 * ed[2 * e + 1];
      const dx = X[j] - X[i], dy = X[j + 1] - X[i + 1], dz = X[j + 2] - X[i + 2];
      const len = sqrt(dx * dx + dy * dy + dz * dz), r = len - rest[e], k = eK[e];
      en += 0.5 * k * r * r;
      const st = (r < 0 ? -r : r) * eR[e]; ss += st; if (st > sm) sm = st;
      const f = len > 1e-300 ? (k * r) / len : 0, fx = f * dx, fy = f * dy, fz = f * dz;
      G[i] -= fx; G[i + 1] -= fy; G[i + 2] -= fz; G[j] += fx; G[j + 1] += fy; G[j + 2] += fz;
      const w = eW[e];
      yv[i] += w * dx; yv[i + 1] += w * dy; yv[i + 2] += w * dz; yv[j] -= w * dx; yv[j + 1] -= w * dy; yv[j + 2] -= w * dz;
    }
    evMean = ss / nE; evMax = sm;
    let eb = 0;
    for (let v = 0, i = 0; v < n; v++, i += 3) {
      const c = vC[v], a = yv[i], b = yv[i + 1], d = yv[i + 2];
      eb += 0.5 * c * (a * a + b * b + d * d);
      yv[i] = c * a; yv[i + 1] = c * b; yv[i + 2] = c * d;
    }
    en += eb; evBend = eb;
    for (let e = 0; e < nE; e++) {
      const i = 3 * ed[2 * e], j = 3 * ed[2 * e + 1], w = eW[e];
      const qx = w * (yv[j] - yv[i]), qy = w * (yv[j + 1] - yv[i + 1]), qz = w * (yv[j + 2] - yv[i + 2]);
      G[i] += qx; G[i + 1] += qy; G[i + 2] += qz; G[j] -= qx; G[j + 1] -= qy; G[j + 2] -= qz;
    }
    for (let e = 0; e < nE; e++) {
      const k = dK[e];
      if (k === 0) continue;
      const i = 3 * dI[e], j = 3 * dJ[e];
      const dx = X[j] - X[i], dy = X[j + 1] - X[i + 1], dz = X[j + 2] - X[i + 2];
      const len = sqrt(dx * dx + dy * dy + dz * dz), r = len - dL[e];
      if (r >= 0) continue;
      en += 0.5 * k * r * r;
      const f = len > 1e-300 ? (k * r) / len : 0, fx = f * dx, fy = f * dy, fz = f * dz;
      G[i] -= fx; G[i + 1] -= fy; G[i + 2] -= fz; G[j] += fx; G[j + 1] += fy; G[j + 2] += fz;
    }
    if (K.pressure > 0) {
      const tr = mesh.triangles, pp = (K.pressure * pFactor) / 6;
      let vol = 0;
      for (let t = 0; t < nT; t++) {
        const a = 3 * tr[3 * t], b = 3 * tr[3 * t + 1], c = 3 * tr[3 * t + 2];
        const ax = X[a], ay = X[a + 1], az = X[a + 2], bx = X[b], by = X[b + 1], bz = X[b + 2], cx = X[c], cy = X[c + 1], cz = X[c + 2];
        const bcx = by * cz - bz * cy, bcy = bz * cx - bx * cz, bcz = bx * cy - by * cx;
        const cax = cy * az - cz * ay, cay = cz * ax - cx * az, caz = cx * ay - cy * ax;
        const abx = ay * bz - az * by, aby = az * bx - ax * bz, abz = ax * by - ay * bx;
        vol += ax * bcx + ay * bcy + az * bcz;
        G[a] -= pp * bcx; G[a + 1] -= pp * bcy; G[a + 2] -= pp * bcz;
        G[b] -= pp * cax; G[b + 1] -= pp * cay; G[b + 2] -= pp * caz;
        G[c] -= pp * abx; G[c + 1] -= pp * aby; G[c + 2] -= pp * abz;
      }
      en -= pp * vol;
    }
    return en;
  }

  // ---------------------------------------------------------------- L-BFGS: ONE iteration, a function of the state alone
  function iterate() {
    const n3 = 3 * n, m = K.mem;
    if (dirty) { E = evalEG(x, g); strainNow = evMean; strainMaxNow = evMax; bendNow = evBend; dirty = false; }
    let gmax = 0;
    for (let i = 0; i < n3; i++) { const a = g[i] < 0 ? -g[i] : g[i]; if (a > gmax) gmax = a; }
    if (gmax < K.gtol) { stopFlag = true; return; }
    for (let i = 0; i < n3; i++) dir[i] = g[i];
    for (let h = 0; h < hist; h++) {
      const s = ((head - 1 - h) % m + m) % m, o = s * n3;
      let a = 0; for (let i = 0; i < n3; i++) a += S[o + i] * dir[i];
      a *= rho[s]; alpha[s] = a;
      for (let i = 0; i < n3; i++) dir[i] -= a * Y[o + i];
    }
    if (hist > 0) {
      const s = ((head - 1) % m + m) % m, o = s * n3;
      let yy = 0; for (let i = 0; i < n3; i++) yy += Y[o + i] * Y[o + i];
      const gam = 1 / (rho[s] * yy);
      for (let i = 0; i < n3; i++) dir[i] *= gam;
    }
    for (let h = hist - 1; h >= 0; h--) {
      const s = ((head - 1 - h) % m + m) % m, o = s * n3;
      let b = 0; for (let i = 0; i < n3; i++) b += Y[o + i] * dir[i];
      b *= rho[s];
      const c = alpha[s] - b;
      for (let i = 0; i < n3; i++) dir[i] += c * S[o + i];
    }
    let dg = 0; for (let i = 0; i < n3; i++) { dir[i] = -dir[i]; dg += dir[i] * g[i]; }
    if (!(dg < 0)) { hist = 0; head = 0; dg = 0; for (let i = 0; i < n3; i++) { dir[i] = -g[i]; dg -= g[i] * g[i]; } }
    let t = 1;
    if (hist === 0) { let dmax = 0; for (let i = 0; i < n3; i++) { const a = dir[i] < 0 ? -dir[i] : dir[i]; if (a > dmax) dmax = a; } t = min(1, 0.01 / (dmax || 1)); }
    let En = 0, ok = false;
    for (let ls = 0; ls < 30; ls++) {
      for (let i = 0; i < n3; i++) xn[i] = x[i] + t * dir[i];
      En = evalEG(xn, gn);
      if (En <= E + 1e-4 * t * dg) { ok = true; break; }
      const tq = (-dg * t * t) / (2 * (En - E - dg * t));
      t = tq > 0.1 * t && tq < 0.6 * t ? tq : 0.5 * t;
    }
    if (!ok) {                                        // no descent: drop the memory once, then it is rounding level
      if (hist > 0) { hist = 0; head = 0; fHist[iters % 30] = E; sHist[iters % sHist.length] = strainNow; iters++; total++; return; }
      stopFlag = true; return;
    }
    const o = head * n3;
    let sy = 0;
    for (let i = 0; i < n3; i++) { const s = xn[i] - x[i], y = gn[i] - g[i]; S[o + i] = s; Y[o + i] = y; sy += s * y; }
    if (sy > 1e-300) { rho[head] = 1 / sy; head = (head + 1) % m; if (hist < m) hist++; }
    for (let i = 0; i < n3; i++) { x[i] = xn[i]; g[i] = gn[i]; }
    fHist[iters % 30] = E; sHist[iters % sHist.length] = strainNow;
    E = En; strainNow = evMean; strainMaxNow = evMax; bendNow = evBend;
    iters++; total++;
  }

  /** Is the present shape as far as settling goes? (state only) */
  function atRest() {
    if (stopFlag || iters >= cap) return true;
    if (iters < grace) return false;
    if (iters >= 30) { const ref = fHist[iters % 30]; if (ref - E < K.ftol * abs(E)) return true; }
    const w = sHist.length;
    if (iters >= max(stallWin, stallFrom)) { const ref = sHist[(iters - stallWin) % w]; if (ref - strainNow < stallShare * strainNow) return true; }
    return false;
  }
  function restart(newCap) { hist = 0; head = 0; iters = 0; stopFlag = false; converged = false; dirty = true; cap = newCap; grace = 0; crossedAtRest = false; nextCheck = K.checkEvery; }

  // ---------------------------------------------------------------- the crossing test (the measure of the benches)
  // Does an edge of one triangle pass through another triangle that shares no vertex with it?
  function segTri(px, py, pz, qx, qy, qz, X, a, b, c) {
    const abx = X[b] - X[a], aby = X[b + 1] - X[a + 1], abz = X[b + 2] - X[a + 2], acx = X[c] - X[a], acy = X[c + 1] - X[a + 1], acz = X[c + 2] - X[a + 2];
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const dx = qx - px, dy = qy - py, dz = qz - pz, den = nx * dx + ny * dy + nz * dz;
    if (abs(den) < 1e-14) return false;
    const t = (nx * (X[a] - px) + ny * (X[a + 1] - py) + nz * (X[a + 2] - pz)) / den;
    if (t <= 1e-9 || t >= 1 - 1e-9) return false;
    const ax = px + t * dx - X[a], ay = py + t * dy - X[a + 1], az = pz + t * dz - X[a + 2];
    const d00 = abx * abx + aby * aby + abz * abz, d01 = abx * acx + aby * acy + abz * acz, d11 = acx * acx + acy * acy + acz * acz;
    const d20 = ax * abx + ay * aby + az * abz, d21 = ax * acx + ay * acy + az * acz, dd = d00 * d11 - d01 * d01;
    if (abs(dd) < 1e-18) return false;
    const v = (d11 * d20 - d01 * d21) / dd, w = (d00 * d21 - d01 * d20) / dd;
    return v > 1e-9 && w > 1e-9 && v + w < 1 - 1e-9;
  }
  /** Do triangles t and u (no common vertex) cross? */
  function pairCross(X, t, u) {
    const tr = mesh.triangles;
    const a = 3 * tr[3 * t], b = 3 * tr[3 * t + 1], c = 3 * tr[3 * t + 2], d = 3 * tr[3 * u], e = 3 * tr[3 * u + 1], f = 3 * tr[3 * u + 2];
    if (d === a || d === b || d === c || e === a || e === b || e === c || f === a || f === b || f === c) return false;
    // u wholly on one side of t's plane: no crossing
    const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2], vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nd = nx * X[a] + ny * X[a + 1] + nz * X[a + 2];
    const s1 = nx * X[d] + ny * X[d + 1] + nz * X[d + 2] - nd, s2 = nx * X[e] + ny * X[e + 1] + nz * X[e + 2] - nd, s3 = nx * X[f] + ny * X[f + 1] + nz * X[f + 2] - nd;
    if ((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0)) return false;
    return segTri(X[a], X[a + 1], X[a + 2], X[b], X[b + 1], X[b + 2], X, d, e, f) || segTri(X[b], X[b + 1], X[b + 2], X[c], X[c + 1], X[c + 2], X, d, e, f) || segTri(X[c], X[c + 1], X[c + 2], X[a], X[a + 1], X[a + 2], X, d, e, f)
      || segTri(X[d], X[d + 1], X[d + 2], X[e], X[e + 1], X[e + 2], X, a, b, c) || segTri(X[e], X[e + 1], X[e + 2], X[f], X[f + 1], X[f + 2], X, a, b, c) || segTri(X[f], X[f + 1], X[f + 2], X[d], X[d + 1], X[d + 2], X, a, b, c);
  }
  /** The number of crossing pairs of triangles of the closed surface X (stops at `limit`). */
  function crossings(X, limit = 1) {
    const t0 = now(), tr = mesh.triangles;
    let hMax = 0, hSum = 0, lox = Infinity, loy = Infinity, loz = Infinity;
    for (let t = 0; t < nT; t++) {
      const a = 3 * tr[3 * t], b = 3 * tr[3 * t + 1], c = 3 * tr[3 * t + 2], o = 6 * t;
      const x0 = min(X[a], X[b], X[c]), x1 = max(X[a], X[b], X[c]), y0 = min(X[a + 1], X[b + 1], X[c + 1]), y1 = max(X[a + 1], X[b + 1], X[c + 1]), z0 = min(X[a + 2], X[b + 2], X[c + 2]), z1 = max(X[a + 2], X[b + 2], X[c + 2]);
      tBox[o] = x0; tBox[o + 1] = y0; tBox[o + 2] = z0; tBox[o + 3] = x1; tBox[o + 4] = y1; tBox[o + 5] = z1;
      const side = max(x1 - x0, y1 - y0, z1 - z0); hSum += side; if (side > hMax) hMax = side;
      if (x0 < lox) lox = x0; if (y0 < loy) loy = y0; if (z0 < loz) loz = z0;
    }
    if (!(hMax > 0) || !Number.isFinite(hSum)) { checks++; checkMs += now() - t0; return Number.isFinite(hSum) ? 0 : limit; }
    // cells twice the mean box wide; the few larger triangles (long horns) are kept out of the grid and tried against all
    const h = min(hMax, (2 * hSum) / nT), ih = 1 / h, M = bSize - 1;
    bHead.fill(-1);
    let nBig = 0;
    for (let t = 0; t < nT; t++) {
      const o = 6 * t;
      if (tBox[o + 3] - tBox[o] > h || tBox[o + 4] - tBox[o + 1] > h || tBox[o + 5] - tBox[o + 2] > h) { tCell[3 * t] = -2147483647; bNext[t] = -2; nBig++; continue; }
      const ix = floor((tBox[o] - lox) * ih), iy = floor((tBox[o + 1] - loy) * ih), iz = floor((tBox[o + 2] - loz) * ih);
      tCell[3 * t] = ix; tCell[3 * t + 1] = iy; tCell[3 * t + 2] = iz;
      const k = ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & M;
      bNext[t] = bHead[k]; bHead[k] = t;
    }
    let hits = 0;
    for (let t = 0; t < nT && hits < limit; t++) {
      const o = 6 * t, x0 = tBox[o], y0 = tBox[o + 1], z0 = tBox[o + 2], x1 = tBox[o + 3], y1 = tBox[o + 4], z1 = tBox[o + 5];
      if (bNext[t] === -2) {                            // a large triangle: against every later large one and every small one
        for (let u = 0; u < nT; u++) {
          if (u === t || (bNext[u] === -2 && u < t)) continue;
          const p = 6 * u;
          if (tBox[p] > x1 || tBox[p + 3] < x0 || tBox[p + 1] > y1 || tBox[p + 4] < y0 || tBox[p + 2] > z1 || tBox[p + 5] < z0) continue;
          if (pairCross(X, t, u) && ++hits >= limit) break;
        }
        continue;
      }
      const cx = tCell[3 * t], cy = tCell[3 * t + 1], cz = tCell[3 * t + 2];
      for (let ex = -1; ex <= 1; ex++) for (let ey = -1; ey <= 1; ey++) for (let ez = -1; ez <= 1; ez++) {
        const qx = cx + ex, qy = cy + ey, qz = cz + ez;
        for (let u = bHead[((qx * 73856093) ^ (qy * 19349663) ^ (qz * 83492791)) & M]; u >= 0; u = bNext[u]) {
          if (u <= t || tCell[3 * u] !== qx || tCell[3 * u + 1] !== qy || tCell[3 * u + 2] !== qz) continue;
          const p = 6 * u;
          if (tBox[p] > x1 || tBox[p + 3] < x0 || tBox[p + 1] > y1 || tBox[p + 4] < y0 || tBox[p + 2] > z1 || tBox[p + 5] < z0) continue;
          if (pairCross(X, t, u)) hits++;
        }
      }
    }
    checks++; checkMs += now() - t0;
    return hits;
  }
  function publish() { shown.set(x); shownMean = strainNow; shownMax = strainMaxNow; }

  // ---------------------------------------------------------------- the formula start (rounded-parallelogram rows)
  function shapeTables() {
    const N = topo.N, nS = topo.nS, cuff = mesh.cuff, c = cuff / N, op = mesh.open;
    const pr = P.crownProfile(cuff, 0), rz = [0, 0];
    for (const pt of topo.parts) {
      const k = pt.k, Wk = Wt[k], Gk = Gt[k], hk = Hh[k];
      for (let j = 0; j < N; j++) hk[j] = pt.deg ? 0 : op.sigma[pt.baseOpen + (pt.roofRow - pt.rowMin) * N + j];
      for (let i = 0; i <= nS; i++) {
        const u = i / nS, row = i * (N + 1);
        let acc = 0, s0 = u * hk[0], z0 = 0;
        if (s0 > 0) { pr.rz(s0, rz); z0 = rz[1]; }
        Wk[row] = 0;
        for (let j = 0; j < N; j++) {
          const s1 = u * hk[(j + 1) % N]; let z1 = 0;
          if (s1 > 0) { pr.rz(s1, rz); z1 = rz[1]; }
          const e = P.dFermi(s0, c, s1, 0), dz = z1 - z0;
          let ep2 = e * e - dz * dz; const floor2 = 0.09 * e * e; if (ep2 < floor2) ep2 = floor2;
          acc += sqrt(ep2); Wk[row + j + 1] = acc; s0 = s1; z0 = z1;
        }
        Gk[i] = acc;
      }
    }
  }

  /** The bare formula at the mesh's present (L, tw): writes openForm and form (3 per closed vertex), and info. */
  function construct() {
    const N = topo.N, nS = topo.nS, cuff = mesh.cuff, rho0 = cuff / TAU, pls = mesh.pillows, tw = mesh.tw;
    const twr = tw - Math.round(tw);
    const m0 = pls[0].degenerate ? 0 : pls[0].m, m1 = pls[1].degenerate ? 0 : pls[1].m, msum = m0 + m1, mmin = min(m0, m1);
    const f0 = msum > 0 ? m0 / msum : 0.5;
    const cT = min(rho0, K.eta * mmin), cMin = K.roundMin * cT;
    const sg = twr < 0 ? -1 : 1, at = abs(twr);
    const psiLaw = sg * ((1 - K.lam) * TAU * at + K.lam * acos(max(-1, 1 - 4 * at)));
    const den = (cuff - TAU * cMin) / 4;
    const sMax = den > 1e-9 * cuff ? max(0, (K.eta * msum - 2 * cMin) / den) : Infinity;
    const sl = abs(sin(psiLaw)), se = min(sl, sMax);
    const psi = sg * (abs(psiLaw) <= PI / 2 ? asin(min(1, se)) : PI - asin(min(1, se)));
    const s = abs(sin(psi));
    const c0 = max(0, min(cT, (K.eta * msum - (cuff / 4) * s) / (2 - (PI / 2) * s)));
    const sl0 = max(0, K.eta * m0 - c0), sl1 = max(0, K.eta * m1 - c0), fB = sl0 + sl1 > 1e-12 ? sl0 / (sl0 + sl1) : f0;
    const Sx = (cuff - TAU * c0) / 4, A0 = Sx * (1 - fB), B0 = Sx * fB;
    info.psi = psi; info.c0 = c0; info.clamped = 0; info.mu[0] = 0; info.mu[1] = 0; info.over = 0;
    const nu0 = -PI / 2 + PI * twr, al0 = nu0 - psi / 2, al1 = nu0 + psi / 2;
    const op = mesh.open, F = openForm;
    for (const pt of topo.parts) {
      const k = pt.k, side = k === 1 ? 1 : -1, Aw = k === 0 ? A0 : B0, Bw = k === 0 ? B0 : A0;
      const psiLoc = k === 0 ? psi : -psi, alk = k === 0 ? al0 : al1, ca = cos(alk), sa = sin(alk);
      const Wk = Wt[k], Gk = Gt[k], hk = Hh[k];
      const mk = pls[k].degenerate ? 0 : pls[k].m, cp = K.fPuff * mk * (rho0 > 0 ? (1 - c0 / rho0) * (1 - c0 / rho0) : 0);
      const rows = pt.deg ? 0 : nS;
      const wid = Bw * s + c0, qk = wid > 1e-12 ? max(K.qMin, min(K.qMax, K.qRate * mk / wid)) : K.qMax;
      for (let i = 0; i <= rows; i++) {
        const u = i / nS, gi = Gk[i];
        let Bi = pt.deg ? 0 : Bw * (1 - pow(u, qk)), ci = pt.deg ? 0 : c0 * (1 - pow(u, qk)) + cp * 4 * u * (1 - u);
        let Ai = (gi - 4 * Bi - TAU * ci) / 4;
        if (Ai < 0) { const fac = gi / (4 * Bi + TAU * ci); Bi *= fac; ci *= fac; Ai = 0; }
        const tLeg = side * twr * (4 * Bi + PI * ci), row = i * (N + 1), r3 = i * N;
        for (let j = 0; j < N; j++) {
          pointOnK(Ai, Bi, ci, psiLoc, tLeg + side * Wk[row + j]);
          X2[r3 + j] = KX * ca - KY * sa; Y2[r3 + j] = KX * sa + KY * ca;
        }
      }
      if (pt.deg) {
        for (let j = 0; j < N; j++) { const v3 = 3 * (pt.baseOpen + j); F[v3] = X2[j]; F[v3 + 1] = Y2[j]; F[v3 + 2] = 0; }
        continue;
      }
      // z along each meridian: every meridian edge keeps its length where the lateral run allows
      let over = 0, lenSum = 0; OV.fill(0);
      for (let j = 0; j < N; j++) {
        const ds = hk[j] / nS, zf = K.zMin * ds; let z = 0; Z2[j] = 0; lenSum += hk[j];
        for (let i = 1; i <= nS; i++) {
          const a = (i - 1) * N + j, b = i * N + j, dx = X2[b] - X2[a], dy = Y2[b] - Y2[a];
          let d2 = ds * ds - dx * dx - dy * dy;
          if (d2 < zf * zf) { const ov = sqrt(dx * dx + dy * dy) - ds * sqrt(1 - K.zMin * K.zMin); over += ov; OV[i] += ov; d2 = zf * zf; info.clamped++; }
          z += sqrt(d2); Z2[b] = z;
        }
      }
      // the seal: its two copies share x, y; give them one height and spread the difference
      const H = N >> 1, top = nS * N;
      for (let j = 1; j < H; j++) {
        const j2 = N - j, zm = 0.5 * (Z2[top + j] + Z2[top + j2]), d1 = zm - Z2[top + j], d2 = zm - Z2[top + j2];
        const xm = 0.5 * (X2[top + j] + X2[top + j2]), ym = 0.5 * (Y2[top + j] + Y2[top + j2]);
        for (let i = 1; i <= nS; i++) { const w = i / nS; Z2[i * N + j] += w * d1; Z2[i * N + j2] += w * d2; }
        X2[top + j] = X2[top + j2] = xm; Y2[top + j] = Y2[top + j2] = ym;
      }
      // where meridians cannot reach: level rows, which cannot cross
      const ratio = over / (K.safe * lenSum), mu = min(1, max(0, K.safeRamp * ratio)); info.mu[k] = mu; if (ratio > info.over) info.over = ratio;
      if (mu > 0) for (let i = 1; i <= nS; i++) {
        let zs = 0; for (let j = 0; j < N; j++) zs += Z2[i * N + j]; zs /= N;
        for (let j = 0; j < N; j++) Z2[i * N + j] += mu * (zs - Z2[i * N + j]);
      }
      for (let i = pt.rowMin; i <= nS; i++) for (let j = 0; j < N; j++) {
        const v3 = 3 * (pt.baseOpen + (i - pt.rowMin) * N + j), a = i * N + j;
        F[v3] = X2[a]; F[v3 + 1] = Y2[a]; F[v3 + 2] = side * Z2[a];
      }
    }
    const cl = topo.closedOf, nO = op.nVertices, cnt = topo.copies;
    form.fill(0);
    for (let v = 0; v < nO; v++) { const c3 = 3 * cl[v], v3 = 3 * v; form[c3] += F[v3]; form[c3 + 1] += F[v3 + 1]; form[c3 + 2] += F[v3 + 2]; }
    for (let c = 0; c < n; c++) if (cnt[c] === 2) { form[3 * c] *= 0.5; form[3 * c + 1] *= 0.5; form[3 * c + 2] *= 0.5; }
  }
  /** `form` = the bare formula at the mesh's present state (kept until the state changes). */
  function ensureForm() {
    if (formL === mesh.L && formTw === mesh.tw) return;
    if (tablesL !== mesh.L) { shapeTables(); tablesL = mesh.L; }
    construct(); formL = mesh.L; formTw = mesh.tw; formOver = info.over;
  }
  /** A fixed number of Gauss-Seidel sweeps: every edge is pulled towards its rest length. */
  function polish(X, sweeps, gain) {
    const ed = mesh.edges, R = mesh.restLength, w = 0.5 * gain;
    if (w <= 0) return;
    for (let it = 0; it < sweeps; it++) for (let e = 0; e < nE; e++) {
      const a = 3 * ed[2 * e], b = 3 * ed[2 * e + 1];
      const dx = X[a] - X[b], dy = X[a + 1] - X[b + 1], dz = X[a + 2] - X[b + 2], d = sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-12) continue;
      const f = (w * (d - R[e])) / d;
      X[a] -= f * dx; X[a + 1] -= f * dy; X[a + 2] -= f * dz; X[b] += f * dx; X[b + 1] += f * dy; X[b + 2] += f * dz;
    }
  }

  // ---------------------------------------------------------------- the flat start (the disphenoid of the flat 2222)
  /** The solid of the lattice Z (ell, 0) + Z (2 ell t, 1 / ell): Selling's reduced superbase and the four corners. */
  function flatSolid(ell, t) {
    const e2x = 2 * ell * t, e2y = 1 / ell;
    let ma = 1, na = 0, mb = 0, nb = 1, mc = -1, nc = -1, ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0;
    for (let iter = 0; iter < 100000; iter++) {
      ax = ma * ell + na * e2x; ay = na * e2y; bx = mb * ell + nb * e2x; by = nb * e2y; cx = mc * ell + nc * e2x; cy = nc * e2y;
      if (ax * bx + ay * by > 1e-13) { const m2 = mb - ma, n2 = nb - na; mb = -mb; nb = -nb; mc = m2; nc = n2; }
      else if (ax * cx + ay * cy > 1e-13) { const m2 = mc - ma, n2 = nc - na; mc = -mc; nc = -nc; mb = m2; nb = n2; }
      else if (bx * cx + by * cy > 1e-13) { const m2 = mc - mb, n2 = nc - nb; mc = -mc; nc = -nc; ma = m2; na = n2; }
      else break;
    }
    const X = max(0, -(bx * cx + by * cy)), Y = max(0, -(ax * cx + ay * cy)), Z = max(0, -(ax * bx + ay * by));
    const sigma = ma * nb - na * mb, ex = ((na >> 1) & 1) ? -1 : 1;
    const xx = ex * sqrt(X), r = sqrt(Y + Z), cph = Y + Z > 0 ? (Y - Z) / (Y + Z) : 1, sph = Y + Z > 0 ? (-2 * sigma * ex * sqrt(Y * Z)) / (Y + Z) : 0;
    // corners in the frame (-abf z, abf y, abf x): the loop's axis along z
    FC[0] = 0; FC[1] = -r / 2; FC[2] = -xx / 2;
    FC[3] = 0; FC[4] = r / 2; FC[5] = -xx / 2;
    FC[6] = (r / 2) * sph; FC[7] = -(r / 2) * cph; FC[8] = xx / 2;
    FC[9] = -(r / 2) * sph; FC[10] = (r / 2) * cph; FC[11] = xx / 2;
    fvax = ax; fvay = ay; fvbx = bx; fvby = by;
  }
  /** The flat proxy for a waist `cuff` long and pillows h0, h1 high on average, at twist tw: 3 per closed vertex. */
  function guessFlat(out, cuff, h0, h1, tw) {
    const N = topo.N, H = N >> 1, parts = topo.parts, nS = topo.nS;
    const ht = h0 + h1, sig = sqrt((cuff * ht) / 2), ell = cuff / (2 * sig), cut = h0 / ht;
    flatSolid(ell, tw);
    const cf = 2 * ell, thPf = -cf / 4, thRf = thPf + tw * cf, det = fvax * fvby - fvay * fvbx;
    const cl = topo.closedOf, cp = topo.copies;
    out.fill(0);
    for (const pt of parts) {
      const k = pt.k, hf = k === 0 ? cut / ell : (1 - cut) / ell;
      for (let i = pt.rowMin; i <= pt.roofRow; i++) {
        const u = pt.deg ? 0 : i / nS;
        for (let j = 0; j < N; j++) {
          const idx = pt.baseOpen + (i - pt.rowMin) * N + j, tl = ((j <= H ? j : j - N) * cf) / N;
          const px = k === 0 ? -tl : thRf + tl - thPf, py = k === 0 ? cut / ell - u * hf : cut / ell + u * hf;
          const al = (px * fvby - py * fvbx) / det, be = (fvax * py - fvay * px) / det;
          const ii = floor(al), jj = floor(be), fa = al - ii, fb = be - jj;
          let c1, c2, c3, w1, w2, w3;
          if (fa >= fb) { c1 = (ii & 1) + 2 * (jj & 1); c2 = ((ii + 1) & 1) + 2 * (jj & 1); c3 = ((ii + 1) & 1) + 2 * ((jj + 1) & 1); w1 = 1 - fa; w2 = fa - fb; w3 = fb; }
          else { c1 = (ii & 1) + 2 * (jj & 1); c2 = ((ii + 1) & 1) + 2 * ((jj + 1) & 1); c3 = (ii & 1) + 2 * ((jj + 1) & 1); w1 = 1 - fb; w2 = fa; w3 = fb - fa; }
          const o3 = 3 * cl[idx];
          out[o3] += sig * (w1 * FC[3 * c1] + w2 * FC[3 * c2] + w3 * FC[3 * c3]);
          out[o3 + 1] += sig * (w1 * FC[3 * c1 + 1] + w2 * FC[3 * c2 + 1] + w3 * FC[3 * c3 + 1]);
          out[o3 + 2] += sig * (w1 * FC[3 * c1 + 2] + w2 * FC[3 * c2 + 2] + w3 * FC[3 * c3 + 2]);
        }
      }
    }
    for (let c = 0; c < n; c++) if (cp[c] === 2) { out[3 * c] *= 0.5; out[3 * c + 1] *= 0.5; out[3 * c + 2] *= 0.5; }
    if (K.puff > 0) {                                 // a flat envelope has no inside: push every vertex out along its normal
      const tr = mesh.triangles;
      yv.fill(0); wA.fill(0);
      for (let t = 0; t < nT; t++) {
        const a = 3 * tr[3 * t], b = 3 * tr[3 * t + 1], c = 3 * tr[3 * t + 2];
        const ux = out[b] - out[a], uy = out[b + 1] - out[a + 1], uz = out[b + 2] - out[a + 2], vx = out[c] - out[a], vy = out[c + 1] - out[a + 1], vz = out[c + 2] - out[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, ar = sqrt(nx * nx + ny * ny + nz * nz);
        yv[a] += nx; yv[a + 1] += ny; yv[a + 2] += nz; yv[b] += nx; yv[b + 1] += ny; yv[b + 2] += nz; yv[c] += nx; yv[c + 1] += ny; yv[c + 2] += nz;
        wA[tr[3 * t]] += ar; wA[tr[3 * t + 1]] += ar; wA[tr[3 * t + 2]] += ar;
      }
      const amp = K.puff * sig;
      for (let v = 0; v < n; v++) { const w = wA[v] > 0 ? amp / wA[v] : 0; out[3 * v] += w * yv[3 * v]; out[3 * v + 1] += w * yv[3 * v + 1]; out[3 * v + 2] += w * yv[3 * v + 2]; }
    }
  }

  // ---------------------------------------------------------------- mesh, start, warm steps
  function build(orders, L, tw, pickGrid) {
    if (P.isFlat(orders)) throw new Error('solver: 2222 is flat and has no solver here: draw it with the exact module (flat2222.js)');
    if (pickGrid || !mesh) {
      if (K.nTheta > 0 && K.nS > 0) { gN = K.nTheta; gS = K.nS; } else { const gr = P.suggestGrid(orders, L, K.nVertices); gN = gr.nTheta; gS = gr.nS; }
    }
    const old = mesh;
    mesh = P.orbifoldMesh(orders, L, tw, { nTheta: gN, nS: gS, minSlope: 0, into: mesh || undefined });
    pFactor = max(orders[0], orders[1], orders[2], orders[3]) > 6 ? K.thinFactor : 1;
    if (mesh !== old || mesh._topo !== topo) { alloc(); shownCells = NaN; }
    tablesL = NaN; formL = NaN;                        // another state (the orders may have changed): the tables are stale
    refreshWeights();
  }

  /** The start shape of the mesh's present state into x; chooses the regime. */
  function coldStart(keepShown = false) {
    ensureForm();
    if (info.over <= K.overCold) {
      regime = 'formula';
      x.set(form);
      const gn2 = max(0, 1 - K.polishCut * info.over);
      polish(x, K.sweeps, gn2 * gn2);
      restart(K.capFormula); stallFrom = K.stallFrom; stallWin = K.stallWindow; stallShare = K.stallShare;
    } else {
      regime = 'flat-start';
      guessFlat(x, flatNow.cuff, flatNow.h0, flatNow.h1, mesh.tw);
      restart(K.capFlat); stallFrom = K.stallFromFlat; stallWin = K.stallWindow; stallShare = K.stallShare;
    }
    restStrain = Infinity; restBend = Infinity; tgtL = mesh.L; tgtTw = mesh.tw; lag = 0;
    E = evalEG(x, g); strainNow = evMean; strainMaxNow = evMax; bendNow = evBend; dirty = false;
    hold = !(regime === 'formula' && info.over <= K.trustOver); coldHold = hold; unverified = false;
    if (hold && !keepShown) publish();
    if (hold && keepShown) { shownMean = strainNow; shownMax = strainMaxNow; }
  }

  function turnUpper(ang) {
    const w = mesh.waist, nw = w.length, pil = mesh.pillow;
    let cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < nw; i++) { const a = 3 * w[i]; cx += x[a]; cy += x[a + 1]; cz += x[a + 2]; }
    cx /= nw; cy /= nw; cz /= nw;
    for (let i = 0; i < nw; i++) {                               // Newell's normal of the ring
      const a = 3 * w[i], b = 3 * w[(i + 1) % nw];
      nx += (x[a + 1] - x[b + 1]) * (x[a + 2] + x[b + 2] - 2 * cz); ny += (x[a + 2] - x[b + 2]) * (x[a] + x[b] - 2 * cx); nz += (x[a] - x[b]) * (x[a + 1] + x[b + 1] - 2 * cy);
    }
    const c = mesh.cones, P3 = 3 * c.P, Q3 = 3 * c.Q, R3 = 3 * c.R, S3 = 3 * c.S;      // the axis points from the lower pillow to the upper
    const ux = x[R3] + x[S3] - x[P3] - x[Q3], uy = x[R3 + 1] + x[S3 + 1] - x[P3 + 1] - x[Q3 + 1], uz = x[R3 + 2] + x[S3 + 2] - x[P3 + 2] - x[Q3 + 2];
    let nn = sqrt(nx * nx + ny * ny + nz * nz);
    const ul = sqrt(ux * ux + uy * uy + uz * uz) || 1;
    if (nn < 1e-6 * ul * ul || mesh.degenerate[0] || mesh.degenerate[1]) { nx = ux; ny = uy; nz = uz; nn = ul; }
    if (nx * ux + ny * uy + nz * uz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    nx /= nn; ny /= nn; nz /= nn;
    const co = cos(ang), si = sin(ang);
    for (let v = 0; v < n; v++) {
      if (pil[v] !== 1) continue;
      const a = 3 * v, px = x[a] - cx, py = x[a + 1] - cy, pz = x[a + 2] - cz, d = (px * nx + py * ny + pz * nz) * (1 - co);
      const kx = ny * pz - nz * py, ky = nz * px - nx * pz, kz = nx * py - ny * px;
      x[a] = cx + px * co + kx * si + nx * d; x[a + 1] = cy + py * co + ky * si + ny * d; x[a + 2] = cz + pz * co + kz * si + nz * d;
    }
  }

  /** A cold start at other numbers of the same orders (the grid is kept). */
  function coldAt(L, tw, keepShown = false) {
    mesh = P.orbifoldMesh(mesh.orders, L, tw, { nTheta: gN, nS: gS, minSlope: 0, into: mesh });
    tablesL = NaN; formL = NaN; refreshWeights(); coldStart(keepShown);
    if (keepShown) { hold = true; coldHold = true; }
  }
  const stepsBehind = () => max(tgtL !== mesh.L ? ceil(abs(log(tgtL / mesh.L)) / (formL === mesh.L && formTw === mesh.tw && formOver <= K.overWarm ? K.stepLFormula : K.stepL) - 1e-9) : 0, tgtTw !== mesh.tw ? ceil(abs(tgtTw - mesh.tw) / K.stepTw - 1e-9) : 0);

  /**
   * Length moved outside the formula's good regime: carry the surface by ONE linear map (about its centroid), the
   * symmetric B that best gives every edge its change of rest length, d^ B d^ = rest' / rest - 1 in least squares.
   * A linear map of an embedded surface is embedded: this predictor cannot cross the surface.
   */
  function affinePredict() {
    const ed = mesh.edges, rest = mesh.restLength;
    NA.fill(0); NB.fill(0);
    for (let e = 0; e < nE; e++) {
      const i = 3 * ed[2 * e], j = 3 * ed[2 * e + 1], dx = x[j] - x[i], dy = x[j + 1] - x[i + 1], dz = x[j + 2] - x[i + 2], l2 = dx * dx + dy * dy + dz * dz;
      if (l2 < 1e-30) continue;
      const q = 1 / l2, f0 = dx * dx * q, f1 = dy * dy * q, f2 = dz * dz * q, f3 = 2 * dx * dy * q, f4 = 2 * dx * dz * q, f5 = 2 * dy * dz * q, w = eA[e], r = w * (rest[e] / restOld[e] - 1);
      NA[0] += w * f0 * f0; NA[1] += w * f0 * f1; NA[2] += w * f0 * f2; NA[3] += w * f0 * f3; NA[4] += w * f0 * f4; NA[5] += w * f0 * f5;
      NA[7] += w * f1 * f1; NA[8] += w * f1 * f2; NA[9] += w * f1 * f3; NA[10] += w * f1 * f4; NA[11] += w * f1 * f5;
      NA[14] += w * f2 * f2; NA[15] += w * f2 * f3; NA[16] += w * f2 * f4; NA[17] += w * f2 * f5;
      NA[21] += w * f3 * f3; NA[22] += w * f3 * f4; NA[23] += w * f3 * f5;
      NA[28] += w * f4 * f4; NA[29] += w * f4 * f5;
      NA[35] += w * f5 * f5;
      NB[0] += r * f0; NB[1] += r * f1; NB[2] += r * f2; NB[3] += r * f3; NB[4] += r * f4; NB[5] += r * f5;
    }
    let trc = 0;
    for (let a = 0; a < 6; a++) { trc += NA[7 * a]; for (let b = 0; b < a; b++) NA[6 * a + b] = NA[6 * b + a]; }
    for (let a = 0; a < 6; a++) NA[7 * a] += 1e-9 * trc;
    for (let a = 0; a < 6; a++) {                       // Gaussian elimination, partial pivoting
      let pv = a; for (let b = a + 1; b < 6; b++) if (abs(NA[6 * b + a]) > abs(NA[6 * pv + a])) pv = b;
      if (pv !== a) { for (let c = 0; c < 6; c++) { const t = NA[6 * a + c]; NA[6 * a + c] = NA[6 * pv + c]; NA[6 * pv + c] = t; } const t = NB[a]; NB[a] = NB[pv]; NB[pv] = t; }
      const d = NA[7 * a]; if (!(abs(d) > 0)) return;
      for (let b = a + 1; b < 6; b++) { const m = NA[6 * b + a] / d; if (m === 0) continue; for (let c = a; c < 6; c++) NA[6 * b + c] -= m * NA[6 * a + c]; NB[b] -= m * NB[a]; }
    }
    for (let a = 5; a >= 0; a--) { let v = NB[a]; for (let c = a + 1; c < 6; c++) v -= NA[6 * a + c] * NB[c]; NB[a] = v / NA[7 * a]; }
    const bxx = NB[0], byy = NB[1], bzz = NB[2], bxy = NB[3], bxz = NB[4], byz = NB[5];
    if (!(Number.isFinite(bxx + byy + bzz + bxy + bxz + byz))) return;
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < n; v++) { cx += x[3 * v]; cy += x[3 * v + 1]; cz += x[3 * v + 2]; }
    cx /= n; cy /= n; cz /= n;
    for (let v = 0; v < n; v++) {
      const a = 3 * v, px = x[a] - cx, py = x[a + 1] - cy, pz = x[a + 2] - cz;
      x[a] += bxx * px + bxy * py + bxz * pz; x[a + 1] += bxy * px + byy * py + byz * pz; x[a + 2] += bxz * px + byz * py + bzz * pz;
    }
  }

  /** One sub-step towards the numbers of the last update. */
  function advance() {
    const k = stepsBehind(), n3 = 3 * n;
    const L1 = k <= 1 ? tgtL : mesh.L * Math.exp(log(tgtL / mesh.L) / k), tw1 = k <= 1 ? tgtTw : mesh.tw + (tgtTw - mesh.tw) / k;
    if (L1 !== mesh.L) {
      // Length: carry the positions by the difference of two start shapes at the present twist
      const tw0 = mesh.tw;
      ensureForm();
      const over0 = formOver; let sw = form; form = formPrev; formPrev = sw;
      restOld.set(mesh.restLength);
      mesh = P.orbifoldMesh(mesh.orders, L1, tw0, { nTheta: gN, nS: gS, minSlope: 0, into: mesh });
      refreshWeights(); formL = NaN; ensureForm();
      if (over0 <= K.overWarm && formOver <= K.overWarm) for (let i = 0; i < n3; i++) x[i] += form[i] - formPrev[i];
      else affinePredict();
      regime = formOver <= K.overCold ? 'formula' : 'flat-start';
    }
    if (tw1 !== mesh.tw) {
      // Twist: turn the upper pillow by 2 pi dtw about the waist's axis (exact on the open crowns)
      const dtw = tw1 - mesh.tw;
      P.setTwist(mesh, tw1); refreshWeights();
      turnUpper(TAU * dtw);
    }
    iters = 0; stopFlag = false; converged = false; dirty = true; cap = K.capWarm; stallFrom = K.warmFrom; stallWin = K.warmWindow; stallShare = K.warmShare;      // the L-BFGS pairs are kept
  }

  /** At rest: a held start must pass the crossing test before it is shown; a warm path is tested once it rests. */
  function restOK() {
    if (hold) {
      if (crossings(x) === 0) { publish(); hold = false; coldHold = false; unverified = false; return true; }
      if (!coldHold) { repairs++; const L = tgtL, tw = tgtTw; coldStart(true); hold = true; coldHold = true; tgtL = L; tgtTw = tw; return false; }   // a held warm path that crossed: start again
      if (stopFlag || iters >= K.capHard) { crossedAtRest = true; return true; }      // gives up: the last clean shape stays shown
      grace = iters + K.checkEvery; if (cap < grace) cap = grace;
      return false;
    }
    if (unverified) {
      unverified = false;
      if (crossings(x) > 0) { repairs++; const L = tgtL, tw = tgtTw; coldStart(); tgtL = L; tgtTw = tw; return false; }   // a warm path that crossed: start again, held
    }
    return true;
  }

  /** Iterate, and take sub-steps towards the target when the shape has settled enough, until the deadline. */
  function pursue(deadline, maxIter) {
    let did = 0;
    for (;;) {
      const behind = coldHold ? 0 : stepsBehind();
      if (behind > 0) {
        const gate = max(K.gateAbs, K.gateRel * restStrain);
        if (dirty) { E = evalEG(x, g); strainNow = evMean; strainMaxNow = evMax; bendNow = evBend; dirty = false; }
        const rest = converged || atRest(), healthy = strainNow <= gate && bendNow <= K.gateBend * restBend;
        const risky = !(formOver <= K.overWarm);                 // outside the formula's good regime
        if ((rest || iters >= K.minSubIters) && healthy) {
          // a risky warm path is shown only as far as it has passed the crossing test
          if (hold || risky) {
            if (crossings(x) === 0) { if (risky) { publish(); hold = true; } else hold = false; }
            else if (!hold) { repairs++; const L = tgtL, tw = tgtTw; coldStart(); tgtL = L; tgtTw = tw; continue; }   // it was on screen: replace it at once
            else { repairs++; const L = tgtL, tw = tgtTw; coldAt(L, tw, true); tgtL = L; tgtTw = tw; continue; }      // held: start again at the numbers wanted
          }
          advance(); unverified = true; nextCheck = K.checkEvery;
          if (did > 0 && now() >= deadline) break;
          continue;
        }
        if (rest || iters >= K.maxSubIters) {
          // this sub-state will not get healthier. Good regime: accept it and go on. Else: start again at the numbers wanted.
          if (!risky && strainNow <= K.hardGate) {
            restStrain = strainNow; restBend = bendNow;
            advance(); unverified = true; nextCheck = K.checkEvery;
            if (did > 0 && now() >= deadline) break;
            continue;
          }
          restarts++;
          if (!hold && crossings(x) === 0) { publish(); hold = true; }
          { const L = tgtL, tw = tgtTw; coldAt(L, tw, hold); tgtL = L; tgtTw = tw; }
          continue;
        }
      } else {
        if (converged) { if (stepsBehind() === 0) break; converged = false; if (coldHold) coldAt(tgtL, tgtTw); continue; }
        if (atRest()) {
          if (restOK()) {
            converged = true; restStrain = strainNow; restBend = bendNow;
            if (stepsBehind() === 0) break;
            converged = false;
            if (coldHold) coldAt(tgtL, tgtTw);          // a held start that gave up, and other numbers are wanted: start there instead
            continue;
          }
          if (did > 0 && now() >= deadline) break;
          continue;
        }
      }
      if (did >= maxIter || (did > 0 && now() >= deadline)) break;      // at least one iteration a call; the rest test above has seen this count
      iterate(); did++;
      if (hold && iters >= nextCheck && iters < cap) { nextCheck = iters + max(K.checkEvery, iters >> 2); if (crossings(x) === 0) publish(); }
    }
    if (dirty) { E = evalEG(x, g); strainNow = evMean; strainMaxNow = evMax; bendNow = evBend; dirty = false; }
    lag = stepsBehind();
    return api;
  }

  // ---------------------------------------------------------------- the interface
  function set(orders, L, tw, budgetMs = 30) {
    const t0 = now();
    build(orders, L, tw, true);
    coldStart();
    return pursue(t0 + budgetMs, budgetMs > 0 ? Infinity : 0);
  }
  function prepare(orders, L, tw) { build(orders, L, tw, true); coldStart(); pursue(-Infinity, 0); return mesh; }
  function settle(budgetMs = 4, maxIterations = Infinity) {
    if (!mesh) throw new Error('solver: set() first');
    return pursue(now() + budgetMs, maxIterations);
  }
  function update(L, tw, budgetMs = 4) {
    if (!mesh) throw new Error('solver: set() first');
    const t0 = now();
    tgtL = L; tgtTw = tw;
    return pursue(t0 + budgetMs, Infinity);
  }
  function adoptPositions(positions, budgetMs = 4) {
    if (!mesh) throw new Error('solver: prepare() or set() first');
    if (positions.length !== 3 * n) throw new Error(`solver: adoptPositions wants ${3 * n} numbers`);
    const t0 = now();
    x.set(positions); restart(K.capAdopt); stallFrom = K.warmFrom; stallWin = K.warmWindow; stallShare = K.warmShare; restStrain = Infinity; restBend = Infinity; tgtL = mesh.L; tgtTw = mesh.tw; hold = false; coldHold = false; unverified = true;
    return pursue(t0 + budgetMs, Infinity);
  }
  function open(f) {
    const o = mesh.open, cl = o.closedOf, pO = o.positions, nO = o.nVertices, h = 1 - f, X = hold ? shown : x;
    for (let v = 0; v < nO; v++) { const c3 = 3 * cl[v], v3 = 3 * v; openOut[v3] = f * X[c3] + h * pO[v3]; openOut[v3 + 1] = f * X[c3 + 1] + h * pO[v3 + 1]; openOut[v3 + 2] = f * X[c3 + 2] + h * pO[v3 + 2]; }
    return openOut;
  }
  function stats() {
    if (mesh && dirty) { E = evalEG(x, g); strainNow = evMean; strainMaxNow = evMax; bendNow = evBend; dirty = false; }
    return { strainMean: hold ? shownMean : strainNow, strainMax: hold ? shownMax : strainMaxNow, iterations: iters, converged, regime, lag,
      held: hold, crossed: crossedAtRest, repairs, restarts, working: strainNow, totalIterations: total, energy: E, over: formOver, checks, checkMs };
  }

  const api = {
    set, settle, update, prepare, adoptPositions, open, stats, knobs: K, info, meshVersion: 0,
    get positions() { return hold ? shown : x; },
    get working() { return x; },
    crossings(limit = 1e9, which = 'shown') { return crossings(which === 'working' || !hold ? x : shown, limit); },
    get mesh() { return mesh; },
    get converged() { return converged; },
    get settling() { return !converged || lag > 0; },
    get lag() { return lag; },
    get regime() { return regime; },
    /** For tests: the two start shapes of the present state (3 per closed vertex). */
    startShapes() { ensureForm(); guessFlat(G0, flatNow.cuff, flatNow.h0, flatNow.h1, mesh.tw); return { formula: form, flat: G0, over: formOver, mu: [info.mu[0], info.mu[1]], clamped: info.clamped }; },
  };
  return api;
}
