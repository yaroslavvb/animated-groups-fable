// surface-model.js — the orbifold PQRS in space as two pillows joined at the loop: what the Surface pane draws.
// Pure: no DOM. It owns the mesh (pillow.js), the closed shape (solver.js; flat2222.js for 2222), the pose, the
// carry of the surface through a flip, and the journey  surface -> two pillows -> open crowns.
//
//   const sm = createSurfaceModel({ nVertices: 2600 });
//        options: solver (knobs handed to the solver), createSurface (another solver's factory), settleSweeps,
//        followCreases (2222: move mesh vertices onto the solid's creases; default true), flatMinConorm (2222: > 0
//        draws a flat state that thick, as Twist of 2222 does with 4e-4; default 0 = exact)
//   sm.set(state);                         cold start (a new signature, a link); deterministic
//   sm.update(state, budgetMs = 4);        the same cut, new L / tw: a slider frame. Called again with the same
//                                          numbers it goes on relaxing (an idle frame); sm.settle(ms) does the same
//   sm.flip(newState, { invQ, before })    the same surface on the new cut's mesh
//        -> { turn, shift, cold }          turn: 3 x 3 rotation, row-major; new pose = turn * old pose + shift for every
//                                          point of the surface (identity and zeros after a cold start: cold = true)
//   sm.frame(j) -> {                       j in [0, 2]: 0 surface, 1 two pillows, 2 open crowns
//     version,                             changes when triangles / pillow / the vertex set change (the pane then needs setMesh)
//     cornersVersion,                      changes when `corners` change (every change of L, tw, cut)
//     nVertices, positions,                Float32Array, 3 per vertex of the FRAME's vertex set (below), already moved for j
//     triangles, pillow,                   Uint32Array of frame vertex ids; Uint8Array, 0 | 1 per triangle
//     vertexPillow,                        Uint8Array, 0 | 1 per frame vertex: every triangle's corners are of its own pillow
//     closedOf,                            Uint32Array per frame vertex: the vertex of the CLOSED surface it is a copy of
//     corners,                             Float64Array, 9 per triangle: each corner's point in the engine's PAIR FRAME
//                                          (hyperboloid [x, y, z]; 2222: the plane point [x, y, 1]), one triangle unwrapped
//     curves: [{ id: 'loop' | 'seal0' | 'seal1', chain, pillow, closed }],
//     marks:  [{ id: 'P' | 'Q' | 'R' | 'S', feature, slot, order, label: 'P3', vertex, pillow, pair: 0 | 1 }],
//     frame: { center, radius }, gap, kind, exact, degenerate: [bool, bool], stats: { strainMean, strainMax, … } }
//
// THE FRAME'S VERTEX SET. pillow.js's OPEN vertices (the two sides of each seal apart), and after them a second copy
// of the loop's ring. The ring's own vertices stay with the pillow that owns the ring (mesh.ringOwner); the copies
// belong to the other pillow, and the zipper strip's triangles use the copies. So no triangle has corners on both
// pillows, the pillows can part, and the loop can be drawn on both rims. At j = 0 the two rings coincide.
//
// THE WORLD FRAME. The loop's axis is z, up; the cut's first pair {P, Q} is below, its seal along y with the first
// point at -y: the frame of pillow.js's crowns. After every solve the closed shape is fitted back to that frame
// (the best rigid motion of the loop's ring and the four cone points onto their crown places; then a turn about z
// that lays the first seal along +y seen from above, and the ring's middle on the origin), so the solver may drift
// freely and a Twist turns the other pillow only. 2222: the exact solid in the same pose (flat2222.js).
//
// 2222. Exact: every vertex is the image of its chart point on the solid of Twist of 2222. The grid does not know
// where the solid folds, so (followCreases) each edge that crosses a crease has its nearer end moved to the
// crossing, along the edge: a vertex is only a sample of the chart, and `corners` and the open tube use the same
// moved chart points. A seal's vertices are never moved; a vertex of the loop moves along the loop only.
//
// THE JOURNEY. 0 -> 1: the pillows part along the axis by `gap`. 1 -> 2: each seal unzips: every vertex goes from
// its closed place to its place on the exact open crown. The crown is first laid on its closed pillow by the best
// rigid motion (ring and cone points), the two are mixed there, and the motion is undone gradually, so the shape
// opens instead of cross-fading. A (2, 2) pillow is its seal alone and has nothing to open.

import * as P from './pillow.js';
import { createSurface } from './solver.js';
import { flatSolid, flatPoint, flatCrossings } from './flat2222.js';
import { fourConeCentered, invH } from '../../two-features-two-handles/src/handles.js';
import { apply } from '../../classification-of-surfaces/src/sym/geom.js';

const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const NO_COMMAS = [null, null, null, null];
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// ---- rigid fits ----------------------------------------------------------------------------------------------------

/** The unit eigenvector of the largest eigenvalue of a symmetric 4 x 4 matrix (16 numbers), by Jacobi rotations. */
function eigenMax4(N) {
  const a = N.slice(), v = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 40; sweep++) {
    let off = 0, diag = 0;
    for (let p = 0; p < 4; p++) { diag += a[5 * p] * a[5 * p]; for (let q = p + 1; q < 4; q++) off += a[4 * p + q] * a[4 * p + q]; }
    if (off <= 1e-30 * (diag + 1e-300)) break;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
      const apq = a[4 * p + q];
      if (apq === 0) continue;
      const th = (a[5 * q] - a[5 * p]) / (2 * apq), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 4; k++) { const x = a[4 * k + p], y = a[4 * k + q]; a[4 * k + p] = c * x - s * y; a[4 * k + q] = s * x + c * y; }
      for (let k = 0; k < 4; k++) { const x = a[4 * p + k], y = a[4 * q + k]; a[4 * p + k] = c * x - s * y; a[4 * q + k] = s * x + c * y; }
      for (let k = 0; k < 4; k++) { const x = v[4 * k + p], y = v[4 * k + q]; v[4 * k + p] = c * x - s * y; v[4 * k + q] = s * x + c * y; }
    }
  }
  let b = 0;
  for (let i = 1; i < 4; i++) if (a[5 * i] > a[5 * b]) b = i;
  return [v[b], v[4 + b], v[8 + b], v[12 + b]];
}

/**
 * Horn's absolute orientation: the rotation R (row-major) and the shift t that minimise sum w |R a + t - b|^2
 * over n weighted pairs; A, B hold 3 numbers a point, W one a pair. Any size of rotation; never a reflection.
 */
export function fitRigid(n, A, B, W) {
  let sw = 0;
  const ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = 0; i < n; i++) { const w = W ? W[i] : 1; sw += w; for (let x = 0; x < 3; x++) { ca[x] += w * A[3 * i + x]; cb[x] += w * B[3 * i + x]; } }
  if (!(sw > 0)) return { R: I3(), t: [0, 0, 0] };
  for (let x = 0; x < 3; x++) { ca[x] /= sw; cb[x] /= sw; }
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const w = W ? W[i] : 1;
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) S[3 * x + y] += w * (A[3 * i + x] - ca[x]) * (B[3 * i + y] - cb[y]);
  }
  const [Sxx, Sxy, Sxz, Syx, Syy, Syz, Szx, Szy, Szz] = S;
  const q = eigenMax4([
    Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx,
    Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz,
    Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy,
    Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz,
  ]);
  const nq = Math.hypot(q[0], q[1], q[2], q[3]) || 1, w = q[0] / nq, x = q[1] / nq, y = q[2] / nq, z = q[3] / nq;
  const R = [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
  const t = [0, 0, 0];
  for (let r = 0; r < 3; r++) t[r] = cb[r] - (R[3 * r] * ca[0] + R[3 * r + 1] * ca[1] + R[3 * r + 2] * ca[2]);
  return { R, t };
}

/** A rotation matrix as a unit axis and an angle in [0, pi]. */
function axisAngle(R) {
  const c = Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2)), angle = Math.acos(c);
  if (angle < 1e-9) return { axis: [0, 0, 1], angle: 0 };
  let ax = [R[7] - R[5], R[2] - R[6], R[3] - R[1]], n = Math.hypot(ax[0], ax[1], ax[2]);
  if (n < 1e-6) {                                   // near a half turn: the largest column of R + 1
    const cols = [[R[0] + 1, R[3], R[6]], [R[1], R[4] + 1, R[7]], [R[2], R[5], R[8] + 1]];
    ax = cols.reduce((u, v) => (Math.hypot(v[0], v[1], v[2]) > Math.hypot(u[0], u[1], u[2]) ? v : u));
    n = Math.hypot(ax[0], ax[1], ax[2]) || 1;
  }
  return { axis: [ax[0] / n, ax[1] / n, ax[2] / n], angle };
}
/** The rotation by `angle` about the unit `axis`, row-major. */
function rotation(axis, angle) {
  const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
}

// ---- the model -----------------------------------------------------------------------------------------------------

export function createSurfaceModel(opts = {}) {
  const nVertices = opts.nVertices ?? 2600;
  const makeSolver = opts.createSurface || createSurface;
  const solverOpts = opts.solver || {};
  const settleSweeps = opts.settleSweeps ?? 30;      // after a flip's carry (a solver with relax()); else settleMs
  const settleMs = opts.settleMs ?? 12;
  const restartAt = opts.restartAt ?? 0.06;          // update(): a mean stretch above this is a lost shape: cold start at once
  const tiredAt = opts.tiredAt ?? 0.025;             // settle(): above this (or on a grid for another Length) cold start
  let restarts = 0;

  let st = null;                                     // { orders, L, tw, perm, kind }
  let solver = null, solverGrid = '';
  let mesh = null, meshId = 0, lastMesh = null;
  let flat = null;                                   // 2222: the solid
  let chartS = null, chartTh = null;                 // the orbifold-chart point of every OPEN vertex (2222: moved onto the creases)
  let crown = null;                                  // the open crowns, 3 per OPEN vertex (2222: the tube, at those chart points)
  let flatCrown = null;
  const flatMinConorm = opts.flatMinConorm ?? 0;     // 2222: > 0 draws a flat state that thick (Twist of 2222: 4e-4); 0 is exact
  const followCreases = opts.followCreases ?? true;  // 2222: move vertices along their edges onto the solid's creases
  let X = new Float64Array(0);                       // the closed surface in the world frame, 3 per CLOSED vertex
  let version = 0, cornersVersion = 0, positionsVersion = 0, topoKey = '';
  let top = null;
  let cornersCache = null, cornersAt = -1;
  let pillowFit = null, pillowFitAt = -1;
  let stats = { strainMean: 0, strainMax: 0 };
  const view = { center: [0, 0, 0], radius: 1, gap: 0.5, extent: 1, center0: [0, 0, 0], radius0: 1, extent0: 1 };

  const read = (state) => {
    const orders = Array.from(state.orders, Number);
    return { orders, L: Number(state.L), tw: Number(state.tw), perm: state.perm ? Array.from(state.perm, Number) : [0, 1, 2, 3], kind: P.isFlat(orders) ? 'E' : 'H' };
  };
  const sameOrders = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const pmatOf = (s) => fourConeCentered(s.orders, s.L, s.tw, { commas: NO_COMMAS }).Pmat;

  function useSolver(g) {
    const key = `${g.nTheta}x${g.nS}`;
    if (!solver || key !== solverGrid) { solver = makeSolver({ ...solverOpts, nTheta: g.nTheta, nS: g.nS }); solverGrid = key; }
    return solver;
  }

  // ---- the frame's vertex set and its chains (rebuilt when the triangles change) ----------------------------------
  function refreshTopology() {
    if (mesh !== lastMesh) { lastMesh = mesh; meshId++; }
    const key = `${meshId}/${mesh.nTheta}/${mesh.nS}/${mesh.degenerate}/${mesh.strip.cells}`;
    if (key === topoKey) return;
    topoKey = key;
    const o = mesh.open, nO = o.nVertices, owner = mesh.ringOwner, sp = mesh.strip, cuff = mesh.cuff;
    const triangles = Uint32Array.from(o.triangles), isRing = new Uint8Array(nO), ring = [];
    const s0 = 3 * sp.triStart, s1 = 3 * (sp.triStart + sp.triCount);
    for (let i = s0; i < s1; i++) { const v = triangles[i]; if (o.pillow[v] === owner && !isRing[v]) { isRing[v] = 1; ring.push(v); } }
    const along = (v) => { const t = o.theta[v] % cuff; return t < 0 ? t + cuff : t; };
    ring.sort((a, b) => along(a) - along(b) || a - b);
    const dupOf = new Int32Array(nO).fill(-1);
    ring.forEach((v, i) => { dupOf[v] = nO + i; });
    for (let i = s0; i < s1; i++) if (isRing[triangles[i]]) triangles[i] = dupOf[triangles[i]];
    const nV = nO + ring.length;
    const vOpen = new Uint32Array(nV), vClosed = new Uint32Array(nV), vPillow = new Uint8Array(nV);
    for (let v = 0; v < nV; v++) { const u = v < nO ? v : ring[v - nO]; vOpen[v] = u; vClosed[v] = o.closedOf[u]; vPillow[v] = v < nO ? o.pillow[u] : 1 - owner; }
    const H = mesh.seals[0].chain.length - 1;
    const rimOf = [null, null];
    rimOf[owner] = Uint32Array.from(ring);
    rimOf[1 - owner] = Uint32Array.from(ring, (v, i) => nO + i);
    const sealA = mesh.seals.map((sl) => Uint32Array.from(sl.openA)), sealB = mesh.seals.map((sl) => Uint32Array.from(sl.openB));
    const cones = [mesh.seals[0].openA[0], mesh.seals[0].openA[H], mesh.seals[1].openA[0], mesh.seals[1].openA[H]];
    top = { nV, nO, triangles, triPillow: Uint8Array.from(mesh.triPillow), vOpen, vClosed, vPillow, ring, rimOf, sealA, sealB, cones, owner, degenerate: mesh.degenerate.map(Boolean) };
    version++; cornersVersion++;
  }

  // ---- the pose: the closed shape fitted to the world frame -------------------------------------------------------
  /** The rigid motion that lays the closed positions x (3 per closed vertex) on the crowns' frame. */
  function poseOf(x) {
    const o = mesh.open, O = crown, ring = top.ring, n = ring.length + 4;
    const A = new Float64Array(3 * n), B = new Float64Array(3 * n), W = new Float64Array(n);
    let i = 0;
    const pair = (openV, w) => {
      const c = 3 * o.closedOf[openV], u = 3 * openV;
      A[3 * i] = x[c]; A[3 * i + 1] = x[c + 1]; A[3 * i + 2] = x[c + 2]; B[3 * i] = O[u]; B[3 * i + 1] = O[u + 1]; B[3 * i + 2] = O[u + 2]; W[i++] = w;
    };
    for (const v of ring) pair(v, 1);
    for (let k = 0; k < 4; k++) pair(top.cones[k], ring.length / 8);
    const fit = fitRigid(n, A, B, W), R = fit.R, t = fit.t;
    // then exactly: the first pair's seal along +y seen from above (a turn about z), the ring's middle at the origin
    const at = (openV) => { const c = 3 * o.closedOf[openV], a = x[c], b = x[c + 1], d = x[c + 2]; return [R[0] * a + R[1] * b + R[2] * d + t[0], R[3] * a + R[4] * b + R[5] * d + t[1], R[6] * a + R[7] * b + R[8] * d + t[2]]; };
    const p = at(top.cones[0]), q = at(top.cones[1]), dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    let c = 1, s = 0;
    if (len > 1e-9) { c = dy / len; s = dx / len; }                // the turn about z that takes (dx, dy) to (0, len)
    const Rz = [c, -s, 0, s, c, 0, 0, 0, 1], R2 = new Array(9), t2 = [c * t[0] - s * t[1], s * t[0] + c * t[1], t[2]];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) R2[3 * r + k] = Rz[3 * r] * R[k] + Rz[3 * r + 1] * R[3 + k] + Rz[3 * r + 2] * R[6 + k];
    const mid = [0, 0, 0];
    for (const v of ring) { const cc = 3 * o.closedOf[v], a = x[cc], b = x[cc + 1], d = x[cc + 2]; for (let r = 0; r < 3; r++) mid[r] += R2[3 * r] * a + R2[3 * r + 1] * b + R2[3 * r + 2] * d + t2[r]; }
    for (let r = 0; r < 3; r++) t2[r] -= mid[r] / ring.length;
    return { R: R2, t: t2 };
  }
  function place(x, pose) {
    const n3 = x.length, R = pose.R, t = pose.t;
    if (X.length !== n3) X = new Float64Array(n3);
    for (let i = 0; i < n3; i += 3) {
      const a = x[i], b = x[i + 1], c = x[i + 2];
      X[i] = R[0] * a + R[1] * b + R[2] * c + t[0]; X[i + 1] = R[3] * a + R[4] * b + R[5] * c + t[1]; X[i + 2] = R[6] * a + R[7] * b + R[8] * c + t[2];
    }
    positionsVersion++;
  }
  function afterSolve() {
    mesh = solver.mesh;
    chartS = mesh.open.s; chartTh = mesh.open.theta; crown = mesh.open.positions;
    refreshTopology();
    const pose = poseOf(solver.positions);
    place(solver.positions, pose);
    const s = solver.stats ? solver.stats() : {};
    stats = { ...s, strainMean: s.strainMean ?? 0, strainMax: s.strainMax ?? 0 };
    return pose;
  }

  function setFlat(fresh) {
    if (fresh || !mesh || mesh.kind !== 'E') {
      const g = P.suggestGrid(st.orders, st.L, nVertices);
      mesh = P.orbifoldMesh(st.orders, st.L, st.tw, { nTheta: g.nTheta, nS: g.nS });
    } else if (st.L !== mesh.L) mesh = P.orbifoldMesh(st.orders, st.L, st.tw, { nTheta: mesh.nTheta, nS: mesh.nS, into: mesh });
    else if (st.tw !== mesh.tw) P.setTwist(mesh, st.tw);
    flat = flatSolid(st.L, st.tw, { minConorm: flatMinConorm });
    refreshTopology();
    const o = mesh.open, nO = o.nVertices, nC = mesh.nVertices, cuff = mesh.cuff, k2 = (2 * Math.PI) / cuff, rho = cuff / (2 * Math.PI);
    chartS = Float64Array.from(o.s); chartTh = Float64Array.from(o.theta);
    const moved = followCreases ? snapToCreases() : 0;
    // the solid at those chart points (the two copies of a seal vertex are one point: they are never moved), and the tube
    if (X.length !== 3 * nC) X = new Float64Array(3 * nC);
    if (!flatCrown || flatCrown.length !== 3 * nO) flatCrown = new Float64Array(3 * nO);
    crown = flatCrown;                                // the model's own array: never a solver's mesh
    const p = [0, 0, 0];
    for (let v = 0; v < nO; v++) {
      flatPoint(flat, chartTh[v], chartS[v], p);
      const c = 3 * o.closedOf[v];
      X[c] = p[0]; X[c + 1] = p[1]; X[c + 2] = p[2];
      crown[3 * v] = rho * Math.cos(k2 * chartTh[v]); crown[3 * v + 1] = rho * Math.sin(k2 * chartTh[v]); crown[3 * v + 2] = chartS[v];
    }
    positionsVersion++;
    stats = { strainMean: 0, strainMax: 0, exact: true, onCreases: moved, method: 'the exact solid of Twist of 2222' };
  }

  /**
   * 2222: the grid does not know where the solid folds, and a triangle that straddles a crease cuts the corner (a
   * saw-toothed edge). Every point of the chart is a point of the surface, so a vertex may be moved: for each edge
   * that crosses a crease, the end nearer the crossing goes to the crossing, along the edge. A seal's vertices stay
   * (their two copies must remain one point); a vertex of the loop moves only along the loop. Returns how many moved.
   */
  function snapToCreases() {
    const o = mesh.open, nO = o.nVertices, cuff = mesh.cuff, ed = o.edges, nE = mesh.nEdges;
    const kind = new Uint8Array(nO);                 // 0 free, 1 on the loop, 2 fixed (a seal), 3 moved
    for (const v of top.ring) kind[v] = 1;
    for (const sl of mesh.seals) { for (const v of sl.openA) kind[v] = 2; for (const v of sl.openB) kind[v] = 2; }
    const onLoop = new Uint8Array(nO);
    for (const v of top.ring) onLoop[v] = 1;
    let count = 0;
    for (let pass = 0; pass < 3; pass++) {
      let did = 0;
      for (let e = 0; e < nE; e++) {
        const a = ed[2 * e], b = ed[2 * e + 1];
        const tha = chartTh[a], sa = chartS[a], thb = tha + P.wrapSym(chartTh[b] - tha, cuff), sb = chartS[b];
        const ts = flatCrossings(flat, tha, sa, thb, sb);
        if (!ts.length) continue;
        const loopEdge = onLoop[a] && onLoop[b];
        const mayA = kind[a] === 0 || (kind[a] === 1 && loopEdge), mayB = kind[b] === 0 || (kind[b] === 1 && loopEdge);
        let best = Infinity, bt = 0, end = -1;
        for (const t of ts) {
          if (mayA && t < best) { best = t; bt = t; end = 0; }
          if (mayB && 1 - t < best) { best = 1 - t; bt = t; end = 1; }
        }
        if (end < 0) continue;
        const th = tha + bt * (thb - tha), sv = sa + bt * (sb - sa);
        if (end === 0) { chartTh[a] = th; chartS[a] = onLoop[a] ? 0 : sv; kind[a] = 3; }
        else { chartTh[b] = th - (thb - chartTh[b]); chartS[b] = onLoop[b] ? 0 : sv; kind[b] = 3; }
        did++;
      }
      count += did;
      if (!did) break;
    }
    return count;
  }

  /**
   * The part gap (continuous in the state) and the camera's two frames (each kept while the shape fits it: size is
   * seen): `radius`, `center` hold the whole journey (the parted pillows, the open crowns); `radius0`, `center0` the
   * closed surface alone, which is what stop 0 shows (the integrator's change, 27 Nov: with the journey's frame at
   * every stop the closed solid filled 58 % of the pane's height on 3333; frame(j) now goes from the one to the other
   * as the pillows part).
   */
  function fitView(fresh) {
    const O = crown, cuff = mesh.cuff, rho = cuff / (2 * Math.PI);
    let rC = rho, zLoC = 0, zHiC = 0;
    for (let i = 0; i < X.length; i += 3) { const r = Math.hypot(X[i], X[i + 1]); if (r > rC) rC = r; if (X[i + 2] < zLoC) zLoC = X[i + 2]; if (X[i + 2] > zHiC) zHiC = X[i + 2]; }
    let rMax = rC, zLo = zLoC, zHi = zHiC;
    for (let i = 0; i < O.length; i += 3) { const r = Math.hypot(O[i], O[i + 1]); if (r > rMax) rMax = r; if (O[i + 2] < zLo) zLo = O[i + 2]; if (O[i + 2] > zHi) zHi = O[i + 2]; }
    view.gap = 0.8 * rho + 0.15 * Math.max(rMax, (zHi - zLo) / 2);
    const half = (zHi - zLo + view.gap) / 2, extent = Math.hypot(rMax, half);
    view.extent = extent;
    if (fresh || extent > view.radius / 1.03 || extent < 0.55 * view.radius) { view.radius = 1.1 * extent; view.center = [0, 0, (zHi + zLo) / 2]; }
    const mid0 = (zHiC + zLoC) / 2, extent0 = Math.hypot(rC, (zHiC - zLoC) / 2);
    view.extent0 = extent0;
    // (the closed frame is re-centred when the solid's middle has left it by more than the margin, too)
    if (fresh || extent0 + Math.abs(mid0 - view.center0[2]) > view.radius0 || extent0 < 0.55 * view.radius0) { view.radius0 = 1.04 * extent0; view.center0 = [0, 0, mid0]; }
    if (view.radius0 > view.radius) { view.radius0 = Math.max(1.04 * extent0, view.radius); view.center0 = [0, 0, mid0]; }   // never wider than the journey's
  }

  // ---- the three calls -----------------------------------------------------------------------------------------------
  function set(state) {
    st = read(state);
    if (st.kind === 'E') setFlat(true);
    else {
      useSolver(P.suggestGrid(st.orders, st.L, nVertices)).set(st.orders, st.L, st.tw);
      afterSolve();
    }
    cornersVersion++;
    fitView(true);
    return api;
  }

  function update(state, budgetMs = 4) {
    const next = read(state);
    if (!st || next.kind !== st.kind || !sameOrders(next.orders, st.orders) || (next.kind === 'H' && !solver)) return set(state);
    const moved = next.L !== st.L || next.tw !== st.tw;
    st = next;
    if (st.kind === 'E') { if (moved) setFlat(false); } else {
      solver.update(st.L, st.tw, budgetMs); afterSolve();
      // a warm step that has lost the shape (a long, fast drag): start again for this state, at once. A solver that
      // reports its own lag (solver.js since 27 Nov) catches up by itself and never shows a crossed surface: let it.
      if (solver.lag === undefined && !(stats.strainMean <= restartAt)) { restarts++; return set(st); }
    }
    if (moved) cornersVersion++;
    fitView(false);
    return api;
  }

  /** Is the grid chosen at the last cold start far from the one this Length would get? */
  function gridOff() {
    const g = P.suggestGrid(st.orders, st.L, nVertices), r = g.nTheta / mesh.nTheta;
    return r > 1.6 || r < 0.625;
  }

  /**
   * Go on relaxing at the present numbers (an idle frame). If the drag has left the shape poorer than a cold start
   * would (mean stretch over `tiredAt`), or on a grid made for another Length, it starts again cold: about a
   * quarter of a second, once, after which the same state shows the same shape as a link to it would.
   */
  function settle(budgetMs = 8) {
    if (!st || st.kind !== 'H' || !solver) return api;
    if (solver.settling !== undefined) {
      // solver.js: it says itself whether it is still settling (a cold start runs to its cap over several frames,
      // a drag catches up). At rest, a grid made for another Length is replaced by a cold start on the right one.
      if (!solver.settling) { if (gridOff()) { restarts++; return set(st); } return api; }
      solver.settle(budgetMs); afterSolve(); fitView(false);
      return api;
    }
    if (!(stats.strainMean <= tiredAt) || gridOff()) { restarts++; return set(st); }
    if (solver.settle) solver.settle(budgetMs); else solver.update(st.L, st.tw, budgetMs);
    afterSolve(); fitView(false);
    return api;
  }

  const coldFlip = (state) => { set(state); return { turn: I3(), shift: [0, 0, 0], cold: true }; };

  function flip(newState, { invQ = null, before = null } = {}) {
    if (!st || !mesh || !invQ) return coldFlip(newState);
    const next = read(newState);
    if (next.kind !== st.kind) return coldFlip(newState);
    if (before) {
      // invQ belongs to `before`: the surface must stand there first (a slider frame the page skipped is made up here)
      const b = read(before);
      if (!sameOrders(b.orders, st.orders)) return coldFlip(newState);
      if (Math.abs(b.L - st.L) > 1e-9 || Math.abs(b.tw - st.tw) > 1e-9) update(before, 4);
    }
    const prev = st;
    const feature = (s, f) => s.perm.indexOf(f);
    if (next.kind === 'E') {
      // both solids are exact: the turn is the rotation between them, cone point onto the same cone point
      const oldC = flat.corners, names = ['P', 'Q', 'R', 'S'];
      st = next; setFlat(true); cornersVersion++; fitView(false);
      const A = new Float64Array(12), B = new Float64Array(12);
      for (let f = 0; f < 4; f++) {
        const a = oldC[names[feature(prev, f)]], b = flat.corners[names[feature(next, f)]];
        if (!a || !b) return { turn: I3(), shift: [0, 0, 0], cold: true };
        A.set(a, 3 * f); B.set(b, 3 * f);
      }
      const fit = fitRigid(4, A, B, null);
      return { turn: fit.R, shift: fit.t, cold: false };
    }
    try {
      const g = P.suggestGrid(next.orders, next.L, nVertices);
      const nm = P.orbifoldMesh(next.orders, next.L, next.tw, { nTheta: g.nTheta, nS: g.nS });       // a mesh of its own: the old one is still needed
      const pmNew = pmatOf(next), pinvOld = invH(pmatOf(prev)), gOld = mesh.frame, cuff = nm.cuff;
      const carried = new Float64Array(3 * nm.nVertices), h = [0, 0, 0], loc = { tri: 0, w: [0, 0, 0] }, pt = [0, 0, 0];
      for (let c = 0; c < nm.nVertices; c++) {
        P.fermiToHyperboloid(nm.s[c], P.wrapSym(nm.theta[c], cuff), h);
        const y = apply(pinvOld, apply(invQ, apply(pmNew, h)));
        const at = P.toPillow(gOld, y);
        if (!at || !P.locate(mesh, at.k, at.sigma, at.thetaLocal, loc)) return coldFlip(newState);
        P.pointOn(mesh, loc, X, mesh.triangles, pt);
        if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1]) || !Number.isFinite(pt[2])) return coldFlip(newState);
        carried[3 * c] = pt[0]; carried[3 * c + 1] = pt[1]; carried[3 * c + 2] = pt[2];
      }
      useSolver(g);
      if (solver.prepare) solver.prepare(next.orders, next.L, next.tw); else solver.set(next.orders, next.L, next.tw);
      if (solver.mesh.nVertices !== nm.nVertices) return coldFlip(newState);
      solver.adoptPositions(carried);
      if (solver.relax) solver.relax(settleSweeps); else if (solver.settle) solver.settle(settleMs); else solver.update(next.L, next.tw, settleMs);
      st = next;
      const pose = afterSolve();
      cornersVersion++;
      fitView(false);
      for (let i = 0; i < X.length; i++) if (!Number.isFinite(X[i])) return coldFlip(newState);
      return { turn: pose.R, shift: pose.t, cold: false };
    } catch (err) {
      return coldFlip(newState);
    }
  }

  // ---- what the pane draws -------------------------------------------------------------------------------------------
  function corners() {
    if (cornersCache && cornersAt === cornersVersion) return cornersCache;
    const tri = top.triangles, nT = tri.length / 3, cuff = mesh.cuff, vOpen = top.vOpen;
    const out = cornersCache && cornersCache.length === 9 * nT ? cornersCache : new Float64Array(9 * nT);
    const flatKind = st.kind === 'E', Pm = flatKind ? null : pmatOf(st), y0 = flatKind ? flat.cut / st.L : 0, h = [0, 0, 0];
    for (let t = 0; t < nT; t++) {
      let ref = 0;
      for (let c = 0; c < 3; c++) {
        const v = vOpen[tri[3 * t + c]];
        const th = c === 0 ? (ref = P.wrapSym(chartTh[v], cuff)) : ref + P.wrapSym(chartTh[v] - ref, cuff);
        const k = 9 * t + 3 * c;
        if (flatKind) { out[k] = th; out[k + 1] = chartS[v] + y0; out[k + 2] = 1; } else {
          P.fermiToHyperboloid(chartS[v], th, h);
          out[k] = Pm[0] * h[0] + Pm[1] * h[1] + Pm[2] * h[2]; out[k + 1] = Pm[3] * h[0] + Pm[4] * h[1] + Pm[5] * h[2]; out[k + 2] = Pm[6] * h[0] + Pm[7] * h[1] + Pm[8] * h[2];
        }
      }
    }
    cornersCache = out; cornersAt = cornersVersion;
    return out;
  }

  /** For each pillow: the rigid motion that lays its exact crown on its closed shape (ring and cone points). */
  function crownFits() {
    if (pillowFit && pillowFitAt === positionsVersion) return pillowFit;
    const O = crown, fits = [null, null];
    for (let k = 0; k < 2; k++) {
      if (top.degenerate[k]) continue;
      const rim = top.rimOf[k], n = rim.length + 2, A = new Float64Array(3 * n), B = new Float64Array(3 * n), W = new Float64Array(n);
      let i = 0;
      const pair = (v, w) => {
        const u = 3 * top.vOpen[v], c = 3 * top.vClosed[v];
        A[3 * i] = O[u]; A[3 * i + 1] = O[u + 1]; A[3 * i + 2] = O[u + 2]; B[3 * i] = X[c]; B[3 * i + 1] = X[c + 1]; B[3 * i + 2] = X[c + 2]; W[i++] = w;
      };
      for (const v of rim) pair(v, 1);
      pair(top.cones[2 * k], rim.length / 4); pair(top.cones[2 * k + 1], rim.length / 4);
      const fit = fitRigid(n, A, B, W);
      fits[k] = { ...fit, ...axisAngle(fit.R) };
    }
    pillowFit = fits; pillowFitAt = positionsVersion;
    return fits;
  }

  /** What the camera keeps in view at the journey's place j: the closed solid's own frame at 0, the whole journey's from 1 on. */
  function cameraFrame(j) {
    const u = ease(Math.min(1, Math.max(0, j))), a = view.center0, b = view.center;
    return { center: [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), a[2] + u * (b[2] - a[2])], radius: view.radius0 + u * (view.radius - view.radius0) };
  }

  function frame(j = 0) {
    if (!st) throw new Error('surface-model: frame() before set()');
    j = Math.min(2, Math.max(0, Number(j) || 0));
    const { nV, vOpen, vClosed, vPillow } = top, O = crown;
    const positions = new Float32Array(3 * nV);
    const half = 0.5 * view.gap * ease(Math.min(1, j)), f = ease(Math.max(0, j - 1));
    if (f <= 0) {
      for (let v = 0; v < nV; v++) {
        const c = 3 * vClosed[v];
        positions[3 * v] = X[c]; positions[3 * v + 1] = X[c + 1]; positions[3 * v + 2] = X[c + 2] + (vPillow[v] ? half : -half);
      }
    } else {
      const fits = crownFits(), part = [null, null];
      for (let k = 0; k < 2; k++) if (fits[k]) part[k] = { R: fits[k].R, t: fits[k].t, M: rotation(fits[k].axis, (1 - f) * fits[k].angle) };
      for (let v = 0; v < nV; v++) {
        const k = vPillow[v], c = 3 * vClosed[v], dz = k ? half : -half, pk = part[k];
        if (!pk) { positions[3 * v] = X[c]; positions[3 * v + 1] = X[c + 1]; positions[3 * v + 2] = X[c + 2] + dz; continue; }
        // the closed point seen from the crown's own place, mixed with the crown point, then put back part of the way
        const R = pk.R, t = pk.t, M = pk.M, u = 3 * vOpen[v];
        const a = X[c] - t[0], b = X[c + 1] - t[1], d = X[c + 2] - t[2];
        const sx = (1 - f) * (R[0] * a + R[3] * b + R[6] * d) + f * O[u];
        const sy = (1 - f) * (R[1] * a + R[4] * b + R[7] * d) + f * O[u + 1];
        const sz = (1 - f) * (R[2] * a + R[5] * b + R[8] * d) + f * O[u + 2];
        positions[3 * v] = M[0] * sx + M[1] * sy + M[2] * sz + (1 - f) * t[0];
        positions[3 * v + 1] = M[3] * sx + M[4] * sy + M[5] * sz + (1 - f) * t[1];
        positions[3 * v + 2] = M[6] * sx + M[7] * sy + M[8] * sz + (1 - f) * t[2] + dz;
      }
    }
    const deg = top.degenerate, curves = [];
    // the loop: on the rim of each pillow that has an inside; joined (j = 0) the two rims are one curve
    const first = deg[0] ? 1 : 0;
    curves.push({ id: 'loop', chain: top.rimOf[first], pillow: first, closed: true });
    if (j > 0 && !deg[0] && !deg[1]) curves.push({ id: 'loop', chain: top.rimOf[1], pillow: 1, closed: true });
    for (let k = 0; k < 2; k++) {
      curves.push({ id: `seal${k}`, chain: top.sealA[k], pillow: k, closed: false });
      if (j > 1 && !deg[k]) curves.push({ id: `seal${k}`, chain: top.sealB[k], pillow: k, closed: false });
    }
    const marks = [0, 1, 2, 3].map((slot) => {
      const feature = st.perm[slot];
      return { id: 'PQRS'[feature], feature, slot, order: st.orders[slot], label: `${'PQRS'[feature]}${st.orders[slot]}`, vertex: top.cones[slot], pillow: slot < 2 ? 0 : 1, pair: slot < 2 ? 0 : 1 };
    });
    return {
      version, cornersVersion, nVertices: nV, positions,
      triangles: top.triangles, pillow: top.triPillow, vertexPillow: vPillow, closedOf: vClosed,
      corners: corners(), curves, marks,
      frame: cameraFrame(j), gap: view.gap,
      kind: st.kind, exact: st.kind === 'E' ? true : !!mesh.exact, degenerate: deg.slice(),
      stats: { ...stats },
    };
  }

  const api = {
    set, update, settle, flip, frame,
    /** For tests and tools: the mesh (pillow.js), the closed positions in the world frame (3 per closed vertex), the state. */
    get mesh() { return mesh; },
    get closed() { return X; },
    /** The exact open crowns, 3 per OPEN vertex of the mesh (2222: the tube). */
    get crown() { return crown; },
    get state() { return st; },
    get solver() { return solver; },
    /** Is the solver still settling (true), at rest (false), or unable to say (undefined: another solver; 2222 is exact)? */
    get settling() { return !st || st.kind !== 'H' ? false : solver && solver.settling !== undefined ? solver.settling : undefined; },
    /** How often update() / settle() have started again cold. */
    get restarts() { return restarts; },
  };
  return api;
}
