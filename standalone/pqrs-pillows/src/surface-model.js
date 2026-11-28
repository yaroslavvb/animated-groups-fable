// surface-model.js — the orbifold PQRS in space: what the Surface pane draws. Pure: no DOM.
//
// Since Fri 27 Nov 2026, 23:00 (his ask: "when I switch between sliders, there shouldn't be any change … The surface
// currently looks quite wobbly maybe find a better surface parameterization") the surface is no longer a mesh relaxed
// by a solver round one loop. It is THE SOLID of solid.js: the convex polyhedron whose surface is the orbifold, a
// tetrahedron whose six edges are the six seals (hyperbolic 3-space, shown in the Poincaré ball; ordinary space for
// 2222). It is exact, it is the same whichever partition is active, and it carries all three partitions at once:
// every card's two seals and its loop are drawn on it, each card in its own colour (the pane's), at all times.
//
//   const sm = createSurfaceModel({ levels: 5 });
//   sm.set(state);                 a new orbifold, a link: the solid in its level pose (below)
//   sm.update(state, { hold });    new numbers: the solid as it now is, turned as little as can be from where it was shown
//                                  (hold: [f, g], two cone points to keep in place: the moved card's pair that holds P)
//   sm.frame(j = 0, part = 0) -> {       j in [0, 2]: the journey (0 surface, 1 two pillows, 2 open crowns), along the loop
//                                  of partition `part` (0, 1, 2: PQ|RS, PR|QS, PS|QR). At j = 0 `part` plays no role
//     version,                     changes when the triangles change (never, for one `levels`): the pane then needs setMesh
//     cornersVersion,              changes with every set / update (the print's chart follows the corners)
//     nVertices, positions,        Float32Array, 3 per vertex
//     triangles, pillow,           Uint32Array (counter-clockwise seen from outside); Uint8Array of zeros (one paper)
//     corners,                     Float64Array, 9 per triangle: each corner's point in the engine's PAIR FRAME of
//                                  sm.state (hyperboloid [x, y, z]; 2222: the plane point [x, y, 1]): for print3d.chartOf
//     curves: [{ id: 'seal' | 'loop', part: 0 | 1 | 2, key: '01|23' …, points: Float32Array(3 n), closed }],
//     marks:  [{ id: 'P' …, feature, order, label: 'P3', p: [x, y, z] }],
//     frame: { center, radius }, kind, exact: true, flat, thick, swaps, edges: { '01': length, … } }
//   At j > 0 the mesh is the journey's (journey.js: the solid's faces cut along that loop and its seals), with its
//   own version; the loop is drawn on both rims, that partition's seals on their pillows (both sides of each once it
//   opens), and the other partitions' lines fade out in the first quarter of the way.
//   sm.relevel() -> turn | null    back to the level pose; `turn` (row-major 9) carries the new pose onto the old one,
//                                  for the pane's eased turn
//   sm.state                       the state the picture was made for (its pair frame is the chart's)
//
// A FLIP IS NOT AN EVENT HERE. Making another partition active changes the engine's frame and nothing of the
// orbifold; the page does not call the model then, and the picture stays as it is, pixel for pixel. The next
// update() comes with the new cut's state and is laid where the last picture was (the pose is carried by the four
// cone points, which have names, not by any frame).
//
// THE LEVEL POSE (a cold start, the reset button). The state's first pair below, its seal along y with its first
// point at -y; the second pair's seal above; the line through the two seals' middles is the z axis, up. A flat solid
// (Twist 0) then stands in the y-z plane, which the default view (az 70) sees nearly face on.

import { solidOf } from './solid.js';
import { journeyOf } from './journey.js';
import { cardsOf, CARD_KEYS } from './state.js';

const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];

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
 * Horn's absolute orientation: the rotation R (row-major) and the shift t that minimise sum w |R a + t - b|^2 over
 * n weighted pairs; A, B hold 3 numbers a point, W one a pair. With `about0` the shift is none: the best rotation
 * about the origin. Any size of rotation; never a reflection.
 */
export function fitRigid(n, A, B, W = null, about0 = false) {
  let sw = 0;
  const ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = 0; i < n; i++) { const w = W ? W[i] : 1; sw += w; for (let x = 0; x < 3; x++) { ca[x] += w * A[3 * i + x]; cb[x] += w * B[3 * i + x]; } }
  if (!(sw > 0)) return { R: I3(), t: [0, 0, 0] };
  for (let x = 0; x < 3; x++) { ca[x] = about0 ? 0 : ca[x] / sw; cb[x] = about0 ? 0 : cb[x] / sw; }
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

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : null; };

/**
 * The level pose: the rotation (row-major 9) that lays the vertices V (by feature, the solid's own frame) with the
 * pair (a, b) below and its seal along y (a at -y), the pair (c, d) above; the axis through the two seals' middles
 * is z. Where the two middles fall together (the seals cross, a flat solid seen along a diagonal partition) the axis
 * is the normal of both seals.
 */
export function levelPose(V, a, b, c, d) {
  const m1 = [0, 1, 2].map((x) => (V[a][x] + V[b][x]) / 2), m2 = [0, 1, 2].map((x) => (V[c][x] + V[d][x]) / 2);
  const size = Math.max(len(V[a]), len(V[b]), len(V[c]), len(V[d]), 1e-9);
  const along = sub(V[b], V[a]), other = sub(V[d], V[c]);
  let z = len(sub(m2, m1)) > 1e-6 * size ? unit(sub(m2, m1)) : null;
  if (!z) z = unit(cross(along, other)) || [0, 0, 1];
  // y: the first seal's direction, square to the axis (a seal that runs along the axis cannot be: then any y will do)
  const k = dot(along, z);
  let y = unit([along[0] - k * z[0], along[1] - k * z[1], along[2] - k * z[2]]);
  if (!y) y = unit(cross(z, [1, 0, 0])) || unit(cross(z, [0, 1, 0]));
  const x = cross(y, z);
  return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
}

const mul9 = (A, B) => { const C = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[3 * r + c] = A[3 * r] * B[c] + A[3 * r + 1] * B[3 + c] + A[3 * r + 2] * B[6 + c]; return C; };
const transpose = (M) => [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];

export function createSurfaceModel(opts = {}) {
  const levels = opts.levels ?? 5;
  const loopSteps = opts.loopSteps ?? 72, sealSteps = opts.sealSteps ?? 28;
  let st = null, S = null, mesh = null;
  let version = 1, cornersVersion = 0;
  let shown = null;                                  // the four cone points as last shown, by feature
  let curves = null, marks = null, positions32 = null, cards = [];
  let jm = null, jmKey = '', jVersion = 1000;         // the journey's mesh for (the state shown, a partition), made when first asked for
  const view = { center: [0, 0, 0], radius: 1 };

  const sameOrders = (a, b) => a && b && a.k === b.k && a.orders.length === b.orders.length && [0, 1, 2, 3].every((f) => a.orders[a.perm.indexOf(f)] === b.orders[b.perm.indexOf(f)]);

  function fitView(fresh) {
    let extent = 0;
    for (const p of shown) extent = Math.max(extent, len(p));
    // kept while the solid fits it (size is seen while a slider moves); taken anew when it no longer does
    if (fresh || extent > view.radius / 1.04 || extent < 0.52 * view.radius) view.radius = 1.16 * extent;
  }

  function build(fresh, hold = null) {
    S = solidOf(st);
    const V0 = S.vertex0;
    let R;
    if (fresh || !shown) R = levelPose(V0, st.perm[0], st.perm[1], st.perm[2], st.perm[3]);
    else {
      // as little turned from the last picture as can be: the best rotation of the four named cone points. While a
      // card's slider moves, the pair of that card that holds P is HELD (it weighs 30 times the other pair), so a
      // Twist is seen as the other pair turning against it (as on The real 2222 animated: "hold first pair fixed").
      const A = new Float64Array(12), B = new Float64Array(12), W = new Float64Array(4).fill(1);
      for (let f = 0; f < 4; f++) { A.set(V0[f], 3 * f); B.set(shown[f], 3 * f); }
      if (hold && hold.length === 2) { W.fill(1 / 30); W[hold[0]] = 1; W[hold[1]] = 1; }
      R = fitRigid(4, A, B, W, true).R;
      if (!R.every(Number.isFinite)) R = levelPose(V0, st.perm[0], st.perm[1], st.perm[2], st.perm[3]);
    }
    S.setRotation(R);
    shown = S.vertex;
    mesh = S.mesh(levels);
    if (!positions32 || positions32.length !== mesh.positions.length) { positions32 = new Float32Array(mesh.positions.length); version++; }
    positions32.set(mesh.positions);
    cornersVersion++;
    // every card's seals and loop, on the solid
    curves = [];
    try { cards = cardsOf(st); } catch (err) { cards = []; }
    for (const card of cards) {
      const part = CARD_KEYS.indexOf(card.key);
      for (const seal of card.seals || []) {
        if (!seal || !seal[0] || !seal[1]) continue;
        try { curves.push({ id: 'seal', part, key: card.key, points: S.trace(seal[0], seal[1], sealSteps), closed: false }); } catch (err) { /* a seal that cannot be laid is left out */ }
      }
      if (!card.onTree && card.seg) {
        try { curves.push({ id: 'loop', part, key: card.key, points: S.trace(card.seg[0], card.seg[1], loopSteps), closed: true }); } catch (err) { /* likewise */ }
      }
    }
    marks = [0, 1, 2, 3].map((f) => ({ id: 'PQRS'[f], feature: f, order: S.orders[f], label: `${'PQRS'[f]}${S.orders[f]}`, p: shown[f].slice() }));
    fitView(fresh);
  }

  function set(state) { st = state; build(true); return api; }
  /** opts.hold: two features [f, g] to hold in place as far as can be (the moved card's pair that holds P). */
  function update(state, { hold = null } = {}) {
    const fresh = !st || !sameOrders(state, st);
    st = state;
    build(fresh, hold);
    return api;
  }
  /** Back to the level pose. Returns the rotation that carries the NEW pose onto the old one (for the pane's turn), or null. */
  function relevel() {
    if (!st || !S) return null;
    const before = S.rotation;
    build(true);
    const turn = mul9(before, transpose(S.rotation));
    const moved = Math.abs(turn[0] - 1) + Math.abs(turn[4] - 1) + Math.abs(turn[8] - 1) > 1e-9;
    return moved ? turn : null;
  }

  // ---- the journey: surface -> two pillows -> open crowns, along one partition's loop -------------------------------
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const rot3 = (R, p) => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];
  /** A rotation matrix as a unit axis and an angle in [0, pi]. */
  function axisAngle(R) {
    const c = Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2)), angle = Math.acos(c);
    if (angle < 1e-9) return { axis: [0, 0, 1], angle: 0 };
    let ax = [R[7] - R[5], R[2] - R[6], R[3] - R[1]], n = len(ax);
    if (n < 1e-6) {                                   // near a half turn: the largest column of R + 1
      const cols = [[R[0] + 1, R[3], R[6]], [R[1], R[4] + 1, R[7]], [R[2], R[5], R[8] + 1]];
      ax = cols.reduce((u, v) => (len(v) > len(u) ? v : u));
      n = len(ax) || 1;
    }
    return { axis: [ax[0] / n, ax[1] / n, ax[2] / n], angle };
  }
  function rotation(axis, angle) {
    const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;
    return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  }

  /**
   * The journey's mesh for the state shown and a partition, with what its frames need: the crowns laid on the solid
   * as one rigid body (so that they stand where the pillows are), each pillow's own rigid fit of its crown onto its
   * closed shape, the axis the pillows part along, the gap, and the camera's reach.
   */
  function journeyMesh(part) {
    const key = `${cornersVersion}/${part}`;
    if (jm && jmKey === key) return jm;
    const card = cards[part];
    if (!card) return null;
    const J = journeyOf(S, st, card), nV = J.nVertices;
    // the crowns as one body, laid on the solid: the best rigid motion of every vertex's crown point onto its closed point
    const W = nV ? fitRigid(nV, J.crown, J.closed) : { R: I3(), t: [0, 0, 0] };
    const lay = (A) => { const out = new Float64Array(A.length); for (let i = 0; i < A.length; i += 3) { const q = rot3(W.R, [A[i], A[i + 1], A[i + 2]]); out[i] = q[0] + W.t[0]; out[i + 1] = q[1] + W.t[1]; out[i + 2] = q[2] + W.t[2]; } return out; };
    const crown = lay(J.crown);
    // each pillow's own fit: its crown (laid) onto its closed shape
    const fits = [0, 1].map((k) => {
      const A = [], B = [];
      for (let v = 0; v < nV; v++) if (J.pillow[v] === k) { A.push(crown[3 * v], crown[3 * v + 1], crown[3 * v + 2]); B.push(J.closed[3 * v], J.closed[3 * v + 1], J.closed[3 * v + 2]); }
      const fit = A.length >= 9 ? fitRigid(A.length / 3, A, B) : { R: I3(), t: [0, 0, 0] };
      return { ...fit, ...axisAngle(fit.R) };
    });
    // the axis the pillows part along: on the solid, from the first pair's seal to the second's; on the crowns, their own axis
    const mid = (A) => { const i = 3 * Math.floor(A.length / 6); return [A[i], A[i + 1], A[i + 2]]; };
    const axisW = unit(rot3(W.R, [0, 0, 1])) || [0, 0, 1];
    let axisC = unit(sub(mid(J.seals[1].closed), mid(J.seals[0].closed)));
    if (!axisC || dot(axisC, axisW) < 0.2) axisC = axisW;           // (seals that cross: the crowns' axis will do)
    let extent = 0;
    for (const p of shown) extent = Math.max(extent, len(p));
    const gap = 0.8 * J.rho + 0.15 * extent;
    let reach = extent + 0.5 * gap;
    for (let i = 0; i < crown.length; i += 3) reach = Math.max(reach, Math.hypot(crown[i], crown[i + 1], crown[i + 2]) + 0.5 * gap);
    jm = {
      J, crown, fits, axisC, axisW, gap, reach, version: ++jVersion, part,
      loopCrown: lay(J.loop.crown), sealCrown: J.seals.map((sl) => [lay(sl.crownA), lay(sl.crownB)]), coneCrown: J.cones.map((c) => rot3(W.R, c.crown).map((x, i) => x + W.t[i])),
    };
    jmKey = key;
    return jm;
  }

  /** Where a point of pillow k stands at the journey's place j: C its place on the solid, O on the crowns (laid). */
  function placer(m, j) {
    const e1 = ease(Math.min(1, j)), f = ease(Math.max(0, j - 1));
    const n = unit([(1 - f) * m.axisC[0] + f * m.axisW[0], (1 - f) * m.axisC[1] + f * m.axisW[1], (1 - f) * m.axisC[2] + f * m.axisW[2]]) || m.axisW;
    const half = 0.5 * m.gap * e1, off = [[-half * n[0], -half * n[1], -half * n[2]], [half * n[0], half * n[1], half * n[2]]];
    const turn = m.fits.map((ft) => (f > 0 ? rotation(ft.axis, (1 - f) * ft.angle) : null));
    return (k, C, ci, O, oi, out, o) => {
      const d = off[k];
      if (f <= 0) { out[o] = C[ci] + d[0]; out[o + 1] = C[ci + 1] + d[1]; out[o + 2] = C[ci + 2] + d[2]; return; }
      // the closed point seen from the crown's own place, mixed with the crown point, then put back part of the way
      const R = m.fits[k].R, t = m.fits[k].t, M = turn[k];
      const a = C[ci] - t[0], b = C[ci + 1] - t[1], c = C[ci + 2] - t[2];
      const sx = (1 - f) * (R[0] * a + R[3] * b + R[6] * c) + f * O[oi], sy = (1 - f) * (R[1] * a + R[4] * b + R[7] * c) + f * O[oi + 1], sz = (1 - f) * (R[2] * a + R[5] * b + R[8] * c) + f * O[oi + 2];
      out[o] = M[0] * sx + M[1] * sy + M[2] * sz + (1 - f) * t[0] + d[0];
      out[o + 1] = M[3] * sx + M[4] * sy + M[5] * sz + (1 - f) * t[1] + d[1];
      out[o + 2] = M[6] * sx + M[7] * sy + M[8] * sz + (1 - f) * t[2] + d[2];
    };
  }

  function journeyFrame(j, part) {
    const m = journeyMesh(part);
    if (!m) return null;
    const J = m.J, nV = J.nVertices, put = placer(m, j), f = Math.max(0, j - 1);
    const positions = new Float32Array(3 * nV), tmp = [0, 0, 0];
    for (let v = 0; v < nV; v++) put(J.pillow[v], J.closed, 3 * v, m.crown, 3 * v, positions, 3 * v);
    const key = CARD_KEYS[part], out = [];
    const lineOf = (k, closedPts, crownPts) => { const pts = new Float32Array(closedPts.length); for (let i = 0; i < closedPts.length; i += 3) put(k, closedPts, i, crownPts, i, pts, i); return pts; };
    // the loop on the rim of each pillow that has an inside
    for (let k = 0; k < 2; k++) if (!J.degenerate[k]) out.push({ id: 'loop', part, key, pillow: k, points: lineOf(k, J.loop.closed, m.loopCrown), closed: true });
    // that partition's two seals; once a pillow opens, both sides of its seal
    for (let k = 0; k < 2; k++) {
      out.push({ id: 'seal', part, key, pillow: k, points: lineOf(k, J.seals[k].closed, m.sealCrown[k][0]), closed: false });
      if (f > 0) out.push({ id: 'seal', part, key, pillow: k, points: lineOf(k, J.seals[k].closed, m.sealCrown[k][1]), closed: false });
    }
    // the other partitions' lines stay on the solid and fade out in the first quarter of the way
    const fade = Math.max(0, 1 - 4 * j);
    if (fade > 0) for (const c of curves) if (c.part !== part) out.push({ ...c, fade });
    const jMarks = J.cones.map((cn, i) => {
      put(cn.pillow, cn.closed, 0, m.coneCrown[i], 0, tmp, 0);
      return { id: 'PQRS'[cn.feature], feature: cn.feature, order: S.orders[cn.feature], label: `${'PQRS'[cn.feature]}${S.orders[cn.feature]}`, p: tmp.slice(), pillow: cn.pillow };
    }).sort((a, b) => a.feature - b.feature);
    const u = ease(Math.min(1, j)), radius = view.radius + u * Math.max(0, 1.08 * m.reach - view.radius);
    return {
      version: m.version, cornersVersion, nVertices: nV, positions, triangles: J.triangles, pillow: new Uint8Array(J.triangles.length / 3), corners: J.corners,
      curves: out, marks: jMarks, frame: { center: view.center.slice(), radius },
      journey: { j, part, key, cells: J.cells, gap: m.gap, crownsExact: J.exact, degenerate: J.degenerate.slice(), vertexPillow: J.pillow },
    };
  }

  function frame(j = 0, part = 0) {
    if (!st) throw new Error('surface-model: frame() before set()');
    j = Math.min(2, Math.max(0, Number(j) || 0));
    part = [0, 1, 2].includes(part) ? part : 0;
    const base = baseFrame();
    if (j <= 0) return base;
    let jf = null;
    try { jf = journeyFrame(j, part); } catch (err) { jf = null; }
    return jf ? { ...base, ...jf } : base;
  }

  function baseFrame() {
    const nT = mesh.triangles.length / 3, edges = {};
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) edges[`${a}${b}`] = S.dist[a][b];
    return {
      version, cornersVersion, nVertices: positions32.length / 3, positions: positions32,
      triangles: mesh.triangles, pillow: new Uint8Array(nT), corners: mesh.corners,
      curves, marks,
      frame: { center: view.center.slice(), radius: view.radius },
      kind: S.kind, exact: true, flat: S.thick < 1e-4, thick: S.thick, swaps: S.swaps, edges,
      stats: { strainMean: 0, strainMax: 0, exact: true },
    };
  }

  const api = {
    set, update, frame, relevel,
    get state() { return st; },
    get solid() { return S; },
    /** The four cone points as shown, by feature. */
    get shown() { return shown ? shown.map((p) => p.slice()) : null; },
  };
  return api;
}
