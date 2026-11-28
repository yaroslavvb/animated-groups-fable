// standin-frame.js — a STAND-IN for surface-model.js's frame(j) (SPEC 3.3), for the pane owner's harness only.
// The mesh is pillow.js's orbifoldMesh; the positions are the exact open crowns (mesh.open), the pressed start
// (every seal vertex midway between its two crown points), the solver's closed surface, or the exact flat solid.
// corners: each corner's point in the engine's pair frame, Pmat · X(s, theta) (2222: the plane point (theta, s + 1/(2L))).
import { orbifoldMesh, suggestGrid, wrapSym } from '../../src/pillow.js';
import { centredFor } from '../../../two-features-two-handles/src/handles.js';

let version = 0, lastKey = '';

export function standinFrame(state, { mode = 'open', nVertices = 2600, solver = null, flat2222 = null } = {}) {
  const orders = state.orders, L = state.L, tw = state.tw;
  let mesh, closed = null, stats = null;
  if (mode === 'solved' && solver) {
    solver.set(orders, L, tw); mesh = solver.mesh; closed = solver.positions; stats = solver.stats();
  } else {
    const grid = suggestGrid(orders, L, nVertices);
    mesh = orbifoldMesh(orders, L, tw, { nTheta: grid.nTheta, nS: grid.nS });
    if (mode === 'pressed') closed = mesh.positions;
  }
  const o = mesh.open, nO = o.nVertices, flat = mesh.kind === 'E', cuff = mesh.cuff;
  const positions = new Float32Array(3 * nO);
  if (flat && mode !== 'open' && flat2222) {
    const F = flat2222.flatSolid(L, tw), P = flat2222.flatPositions(F, mesh);
    positions.set(P.open);
  } else if (closed) for (let v = 0; v < nO; v++) for (let x = 0; x < 3; x++) positions[3 * v + x] = closed[3 * o.closedOf[v] + x];
  else positions.set(o.positions);

  const c = centredFor(state), M = c.Pmat, nT = mesh.nTriangles, corners = new Float64Array(9 * nT), tri = o.triangles;
  for (let t = 0; t < nT; t++) {
    let ref = 0;
    for (let x = 0; x < 3; x++) {
      const v = tri[3 * t + x], s = o.s[v];
      let th = o.theta[v];
      if (x === 0) ref = th; else th = ref + wrapSym(th - ref, cuff);
      const q = 9 * t + 3 * x;
      if (flat) { corners[q] = th; corners[q + 1] = s + 0.5 / L; corners[q + 2] = 1; } else {
        const cs = Math.cosh(s), X0 = Math.sinh(th) * cs, X1 = Math.sinh(s), X2 = Math.cosh(th) * cs;
        corners[q] = M[0] * X0 + M[1] * X1 + M[2] * X2; corners[q + 1] = M[3] * X0 + M[4] * X1 + M[5] * X2; corners[q + 2] = M[6] * X0 + M[7] * X1 + M[8] * X2;
      }
    }
  }
  // the loop: the ring (sigma = 0) of the pillow that owns it, by theta
  const ring = [];
  for (let v = 0; v < nO; v++) if (o.sigma[v] === 0 && o.pillow[v] === mesh.ringOwner && !mesh.degenerate[mesh.ringOwner]) ring.push(v);
  if (!ring.length) for (let v = 0; v < nO; v++) if (o.sigma[v] === 0 && o.pillow[v] === mesh.ringOwner) ring.push(v);
  ring.sort((a, b) => o.theta[a] - o.theta[b]);
  const curves = [{ id: 'loop', chain: Uint32Array.from(ring), pillow: mesh.ringOwner, closed: true }];
  mesh.seals.forEach((sl, k) => {
    curves.push({ id: 'seal' + k, chain: sl.openA, pillow: k, closed: false });
    if (!closed && !(flat && mode !== 'open')) curves.push({ id: 'seal' + k, chain: sl.openB, pillow: k, closed: false });
  });
  const H = mesh.nTheta >> 1, slots = [mesh.seals[0].openA[0], mesh.seals[0].openA[H], mesh.seals[1].openA[0], mesh.seals[1].openA[H]];
  const marks = slots.map((vertex, slot) => {
    const feature = state.perm[slot];
    return { id: 'PQRS'[feature], feature, vertex, pillow: slot < 2 ? 0 : 1, pair: slot < 2 ? 0 : 1, label: 'PQRS'[feature] + orders[slot] };
  });
  let zLo = Infinity, zHi = -Infinity, rad = 0;
  for (let v = 0; v < nO; v++) { zLo = Math.min(zLo, positions[3 * v + 2]); zHi = Math.max(zHi, positions[3 * v + 2]); }
  const zc = (zLo + zHi) / 2;
  for (let v = 0; v < nO; v++) rad = Math.max(rad, Math.hypot(positions[3 * v], positions[3 * v + 1], positions[3 * v + 2] - zc));
  const key = [mesh.nTheta, mesh.nS, mesh.degenerate.join(''), mesh.strip ? mesh.strip.cells : 0].join('/');
  if (key !== lastKey) { lastKey = key; version++; }
  return {
    version, positions, triangles: tri, pillow: mesh.triPillow, corners, curves, marks,
    frame: { center: [0, 0, zc], radius: 1.12 * rad }, kind: mesh.kind, exact: mesh.exact, degenerate: mesh.degenerate, stats: stats || { strainMean: 0, strainMax: 0 },
    info: { nTheta: mesh.nTheta, nS: mesh.nS, triangles: nT, openVertices: nO, mode },
  };
}
