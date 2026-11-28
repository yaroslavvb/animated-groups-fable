// flat2222.test.js — the flat orbifold 2222 as the exact solid of Twist of 2222 (src/flat2222.js).
//   node --test test/flat2222.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/pillow.js';
import { flatSolid, flatPositions, flatPoint, flatCell, flatSealAngle, flatTipDistances, solid } from '../src/flat2222.js';

const REG = Math.pow(4 / 3, 0.25);
const STATES = [
  [1, 0], [1, 0.25], [REG, 0.25], [1, 0.1], [1, -0.2], [0.7, 0.3], [0.6, -0.45], [1.3, 0.4], [1.9, 0.15], [1.6, -0.35], [1.2, 0.1], [0.8672, 0.3085],
];
const d3 = (a, i, b, j) => Math.hypot(a[3 * i] - b[3 * j], a[3 * i + 1] - b[3 * j + 1], a[3 * i + 2] - b[3 * j + 2]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('the two copies of every seal vertex are one point, and every open copy sits on its closed vertex', () => {
  let worstSeal = 0, worstCopy = 0;
  for (const [L, tw] of STATES) {
    const mesh = P.orbifoldMesh([2, 2, 2, 2], L, tw, { nTheta: 48, nS: 8 }), F = flatSolid(L, tw), pos = flatPositions(F, mesh);
    for (const sl of mesh.seals) for (let k = 0; k < sl.chain.length; k++) {
      worstSeal = Math.max(worstSeal, d3(pos.open, sl.openA[k], pos.open, sl.openB[k]));
      worstCopy = Math.max(worstCopy, d3(pos.open, sl.openA[k], pos.closed, sl.chain[k]), d3(pos.open, sl.openB[k], pos.closed, sl.chain[k]));
    }
    for (let v = 0; v < mesh.open.nVertices; v++) worstCopy = Math.max(worstCopy, d3(pos.open, v, pos.closed, mesh.open.closedOf[v]));
    for (let i = 0; i < pos.closed.length; i++) assert.ok(Number.isFinite(pos.closed[i]));
  }
  assert.ok(worstSeal < 1e-12, `seal copies apart by ${worstSeal}`);
  assert.ok(worstCopy < 1e-12, `open copies off their closed vertex by ${worstCopy}`);
});

test('the four cone vertices are the corners of the solid; the first pair lies below, its seal along y, P at -y', () => {
  let worst = 0, unreduced = 0;
  for (const [L, tw] of STATES) {
    const mesh = P.orbifoldMesh([2, 2, 2, 2], L, tw, { nTheta: 48, nS: 8 }), F = flatSolid(L, tw), pos = flatPositions(F, mesh), S = F.S;
    for (const nm of ['P', 'Q', 'R', 'S']) {
      const v = mesh.cones[nm], c = F.corners[nm];
      worst = Math.max(worst, Math.hypot(pos.closed[3 * v] - c[0], pos.closed[3 * v + 1] - c[1], pos.closed[3 * v + 2] - c[2]));
    }
    // the corners are the solid's own, up to the pose (a rigid motion): the six distances are those of its abf frame
    const abf = S.abf, names = [['P', 'A'], ['Q', 'B'], ['R', 'C'], ['S', 'D']];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      worst = Math.max(worst, Math.abs(dist(F.corners[names[a][0]], F.corners[names[b][0]]) - dist(abf[names[a][1]], abf[names[b][1]])));
    }
    const { P: cp, Q: cq, R: cr, S: cs } = F.corners;
    assert.ok(Math.abs(cp[0]) < 1e-12 && Math.abs(cq[0]) < 1e-12, 'the seal PQ lies in the plane x = 0');
    assert.ok(cp[1] < 0 && cq[1] > 0 && Math.abs(cp[1] + cq[1]) < 1e-12, 'P at -y, Q at +y');
    assert.ok(Math.abs(cp[2] - cq[2]) < 1e-12 && cp[2] <= 1e-12, 'the seal PQ is level, below the loop');
    assert.ok(Math.abs(cr[2] - cs[2]) < 1e-12 && cr[2] >= -1e-12 && Math.abs(cr[2] + cp[2]) < 1e-12, 'the seal RS is level, as far above');
    // the loop (s = 0) is level at z = 0 wherever the pair's own vector is one of the solid's three (a reduced state:
    // then the seal PQ is the edge AB itself). Elsewhere the loop winds round the solid: the solid is the lattice's.
    const reduced = Math.abs(S.R[0][0]) === 1 && S.R[0][1] === 0;
    if (reduced) for (let i = 0; i < 40; i++) assert.ok(Math.abs(flatPoint(F, (i / 40) * F.cuff, 0)[2]) < 1e-12, `loop level at L ${L}, tw ${tw}`);
    else unreduced++;
  }
  assert.ok(worst < 1e-12, `corners off by ${worst}`);
  assert.ok(unreduced >= 1 && unreduced <= 5, `${unreduced} of the states are not reduced`);
});

test('L = 1, tw = 1/4: the seals are square to each other; L = (4/3)^(1/4), tw = 1/4: the regular tetrahedron', () => {
  assert.ok(Math.abs(flatSealAngle(flatSolid(1, 0.25)) - 90) < 1e-9);
  assert.ok(Math.abs(flatSealAngle(flatSolid(1, 0)) - 0) < 1e-6);
  // M2 section 6.5: for L^2 <= 2, 0 <= tw <= 1/2 the far seal is turned by arccos(1 - 4 tw)
  for (const tw of [0.02, 0.1, 0.25, 0.45]) {
    const want = (Math.acos(1 - 4 * tw) * 180) / Math.PI;
    assert.ok(Math.abs(flatSealAngle(flatSolid(1, tw)) - want) < 1e-9, `seal angle at tw ${tw}`);
  }
  const d = Object.values(flatTipDistances(flatSolid(REG, 0.25)));
  for (const x of d) assert.ok(Math.abs(x - d[0]) < 1e-12, `tip distances ${d}`);
  assert.ok(Math.abs(d[0] - 1.0745699318235418) < 1e-12);
  // the six edges are the three distances between cone points on the flat orbifold, each twice
  for (const [L, tw] of STATES) {
    const t = flatTipDistances(flatSolid(L, tw)), w = P.flatTipDistances(L, tw);
    for (const k of ['PQ', 'PR', 'PS', 'RS', 'QS', 'QR']) assert.ok(Math.abs(t[k] - w[k]) < 1e-12, `${k} at L ${L}, tw ${tw}: ${t[k]} against ${w[k]}`);
  }
});

test('the mesh on the solid: the surface closes, faces outward, and every edge that stays in one face has its exact length', () => {
  let folded = 0, total = 0, worstIn = 0, worstLong = 0;
  for (const [L, tw] of STATES) {
    const mesh = P.orbifoldMesh([2, 2, 2, 2], L, tw, { nTheta: 48, nS: 8 }), F = flatSolid(L, tw), pos = flatPositions(F, mesh), o = mesh.open;
    // closed: every edge in two triangles, Euler characteristic 2
    const cnt = new Map();
    for (let t = 0; t < mesh.nTriangles; t++) for (let c = 0; c < 3; c++) {
      const a = mesh.triangles[3 * t + c], b = mesh.triangles[3 * t + (c + 1) % 3], k = a < b ? `${a}_${b}` : `${b}_${a}`;
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    for (const n of cnt.values()) assert.equal(n, 2);
    assert.equal(mesh.nVertices - cnt.size + mesh.nTriangles, 2);
    // the volume enclosed is not negative (triangles counter-clockwise seen from outside)
    let vol = 0;
    const X = pos.closed;
    for (let t = 0; t < mesh.nTriangles; t++) {
      const a = 3 * mesh.triangles[3 * t], b = 3 * mesh.triangles[3 * t + 1], c = 3 * mesh.triangles[3 * t + 2];
      vol += X[a] * (X[b + 1] * X[c + 2] - X[b + 2] * X[c + 1]) - X[a + 1] * (X[b] * X[c + 2] - X[b + 2] * X[c]) + X[a + 2] * (X[b] * X[c + 1] - X[b + 1] * X[c]);
    }
    assert.ok(vol / 6 > -1e-9, `volume ${vol / 6} at L ${L}, tw ${tw}`);
    for (let e = 0; e < mesh.nEdges; e++) {
      const a = o.edges[2 * e], b = o.edges[2 * e + 1], chord = d3(pos.open, a, pos.open, b), rest = mesh.restLength[e];
      total++;
      worstLong = Math.max(worstLong, chord - rest);
      const thB = o.theta[a] + P.wrapSym(o.theta[b] - o.theta[a], mesh.cuff);
      const ca = flatCell(F, o.theta[a], o.s[a]), cb = flatCell(F, thB, o.s[b]);
      if (ca[0] === cb[0] && ca[1] === cb[1] && ca[2] === cb[2]) worstIn = Math.max(worstIn, Math.abs(chord - rest));
      if (rest - chord > 1e-9) folded++;
    }
  }
  assert.ok(worstLong < 1e-9, `a chord longer than its rest length by ${worstLong}`);
  assert.ok(worstIn < 1e-9, `an edge inside one face is off by ${worstIn}`);
  assert.ok(folded / total < 0.12, `${folded} of ${total} edges cross a crease`);
});

test('L = 1, tw = 0 is the doubled square with every edge exact; the copied solid() has the lattice numbers', () => {
  const mesh = P.orbifoldMesh([2, 2, 2, 2], 1, 0, { nTheta: 48, nS: 8 }), F = flatSolid(1, 0), pos = flatPositions(F, mesh), o = mesh.open;
  let worst = 0;
  for (let e = 0; e < mesh.nEdges; e++) worst = Math.max(worst, Math.abs(d3(pos.open, o.edges[2 * e], pos.open, o.edges[2 * e + 1]) - mesh.restLength[e]));
  assert.ok(worst < 1e-12, `worst edge ${worst}`);
  for (let i = 0; i < pos.closed.length; i += 3) assert.ok(Math.abs(pos.closed[i]) < 1e-12, 'flat: in the plane x = 0');
  const S = solid(1, 0);
  assert.deepEqual([S.X, S.Y, S.Z].map((v) => +v.toFixed(12)), [1, 1, 0]);
  const T = solid(REG, 0.25);
  assert.ok(Math.abs(T.X - T.Y) < 1e-12 && Math.abs(T.Y - T.Z) < 1e-12);
});
