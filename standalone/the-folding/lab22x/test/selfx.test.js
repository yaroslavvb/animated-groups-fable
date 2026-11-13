// selfx.test.js — the detector of the lab: where a triangle mesh passes through itself.
//   node --test lab22x/test/selfx.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelfX, chainSegments, polylineLength, jitterPlane } from '../src/selfx.js';

/** An (nx x ny) grid of the unit square, carried to space by f(u, v) -> [x, y, z]. */
function patch(nx, ny, f) {
  const pos = [], tri = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) pos.push(...f(i / nx, j / ny));
  const id = (i, j) => j * (nx + 1) + i;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) tri.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
  return { pos, tri, n: pos.length / 3 };
}
function join(...parts) {
  const pos = [], tri = [];
  let off = 0;
  for (const p of parts) { pos.push(...p.pos); for (const i of p.tri) tri.push(i + off); off += p.n; }
  return { pos: Float32Array.from(pos), tri: Uint32Array.from(tri), n: off };
}
const floor = (nx = 7, ny = 7) => patch(nx, ny, (u, v) => [2 * u - 1, 2 * v - 1, 0]);                 // z = 0, [-1, 1]^2
const wall = (x, nx = 5, ny = 5, z0 = -1, z1 = 1) => patch(nx, ny, (u, v) => [x, u - 0.5, z0 + (z1 - z0) * v]);   // the plane x = const

test('two sheets at right angles cross along one segment of the right length', () => {
  const M = join(floor(), wall(0.1));
  const r = createSelfX(M.tri).compute(M.pos, 1);
  assert.ok(r.count > 0);
  assert.ok(Math.abs(r.length - 1) < 1e-5, `length ${r.length}`);
  const lines = chainSegments(r.segs, r.count, 1e-5);
  assert.equal(lines.length, 1, 'one polyline');
  assert.ok(Math.abs(polylineLength(lines) - 1) < 1e-5);
  // every point of it is on both planes
  for (let k = 0; k < lines[0].length; k += 3) {
    assert.ok(Math.abs(lines[0][k] - 0.1) < 1e-6 && Math.abs(lines[0][k + 2]) < 1e-6);
    assert.ok(Math.abs(lines[0][k + 1]) <= 0.5 + 1e-6);
  }
});

test('each segment lies in the two triangles it names', () => {
  const M = join(floor(6, 5), patch(4, 7, (u, v) => [0.07 + 0.3 * (v - 0.5), u - 0.5, 1.4 * v - 0.65]));   // a tilted wall (no grid line of it in the floor)
  const r = createSelfX(M.tri).compute(M.pos, 1);
  assert.ok(r.count > 0);
  const P = M.pos, plane = (T) => {
    const a = 3 * M.tri[3 * T], b = 3 * M.tri[3 * T + 1], c = 3 * M.tri[3 * T + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    return (x, y, z) => (x - P[a]) * nx + (y - P[a + 1]) * ny + (z - P[a + 2]) * nz;
  };
  for (let s = 0; s < r.count; s++) for (let w = 0; w < 2; w++) {
    const T = r.pairs[2 * s + w];
    assert.ok(T >= 0 && T < M.tri.length / 3);
    const d = plane(T);
    for (let e = 0; e < 2; e++) assert.ok(Math.abs(d(r.segs[6 * s + 3 * e], r.segs[6 * s + 3 * e + 1], r.segs[6 * s + 3 * e + 2])) < 1e-6);
  }
});

test('a finer mesh gives the same crossing', () => {
  const A = join(floor(7, 7), wall(0.1, 5, 5)), B = join(floor(23, 19), wall(0.1, 17, 13));
  const la = createSelfX(A.tri).compute(A.pos, 1).length, lb = createSelfX(B.tri).compute(B.pos, 1).length;
  assert.ok(Math.abs(la - lb) < 1e-5, `${la} against ${lb}`);
});

test('sheets that only touch are silent', () => {
  // a wall that ends ON the floor (its lower rim lies in the floor's plane)
  const T = join(floor(), wall(0.1, 5, 5, 0, 1));
  assert.equal(createSelfX(T.tri).compute(T.pos, 1).count, 0, 'a rim on a sheet');
  // a hinge: two sheets that share an edge
  const h = patch(4, 4, (u, v) => [u, v, 0]), k = patch(4, 4, (u, v) => [1 + 0.6 * u, v, 0.8 * u]);
  const pos = [...h.pos, ...k.pos], tri = [...h.tri];
  // weld the common edge: the vertices of k with u = 0 are the vertices of h with u = 1
  const map = new Map();
  for (let j = 0; j <= 4; j++) map.set(h.n + j * 5, j * 5 + 4);
  for (const i of k.tri) tri.push(map.has(i + h.n) ? map.get(i + h.n) : i + h.n);
  assert.equal(createSelfX(Uint32Array.from(tri)).compute(Float32Array.from(pos), 1).count, 0, 'a hinge');
  // four sheets that end on one line (as the rims of the Pocket on the double line of the cross-cap)
  const fan = [0.4, 1.3, 2.9, 4.4].map((a) => patch(3, 5, (u, v) => [0.9 * u * Math.cos(a), v, 0.9 * u * Math.sin(a)]));
  const F = join(...fan);
  assert.equal(createSelfX(F.tri).compute(F.pos, 1).count, 0, 'four rims on a line');
});

test('sheets that lie on each other are silent; a clear angle is found', () => {
  const flat = join(floor(7, 7), patch(5, 6, (u, v) => [1.2 * u - 0.5, 1.1 * v - 0.6, 0]));
  assert.equal(createSelfX(flat.tri).compute(flat.pos, 1).count, 0, 'coplanar');
  const near = join(floor(7, 7), patch(5, 6, (u, v) => [1.2 * u - 0.5, 1.1 * v - 0.6, 1e-7]));
  assert.equal(createSelfX(near.tri).compute(near.pos, 1).count, 0, 'parallel, a hair apart');
  const tilt = (a) => join(floor(7, 7), patch(5, 6, (u, v) => [1.2 * u - 0.55, 1.1 * v - 0.6, Math.tan(a) * (1.2 * u - 0.55)]));
  const shallow = tilt(0.01), clear = tilt(0.2);
  assert.equal(createSelfX(shallow.tri).compute(shallow.pos, 1).count, 0, 'below the least angle');
  const r = createSelfX(clear.tri).compute(clear.pos, 1);
  assert.ok(Math.abs(r.length - 1.1) < 1e-4, `the line x = 0 of the tilted sheet: ${r.length}`);
});

test('two crossings are two polylines; a closed crossing is a loop', () => {
  const two = join(floor(9, 9), wall(-0.45), wall(0.37));
  const r = createSelfX(two.tri).compute(two.pos, 1);
  const lines = chainSegments(r.segs, r.count, 1e-5);
  assert.equal(lines.length, 2);
  assert.ok(Math.abs(r.length - 2) < 1e-5);
  // a tube through the floor: the crossing is a circle (a polygon inscribed in it)
  const N = 24, tube = patch(N, 3, (u, v) => [0.5 * Math.cos(2 * Math.PI * u) + 0.03, 0.5 * Math.sin(2 * Math.PI * u) - 0.02, 1.2 * v - 0.5]);
  const M = join(floor(9, 9), tube);
  const q = createSelfX(M.tri).compute(M.pos, 1);
  const want = 2 * N * 0.5 * Math.sin(Math.PI / N);
  assert.ok(Math.abs(q.length - want) < 1e-4, `${q.length} against ${want}`);
});

test('jitterPlane moves the inside only, and turns no triangle over', () => {
  const nx = 6, ny = 5, xy = [], tri = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) xy.push(i / nx, j / ny);
  const id = (i, j) => j * (nx + 1) + i;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) tri.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
  const T = Uint32Array.from(tri), X = Float64Array.from(xy);
  // two pieces: the left half and the right half; the line between them must not move either
  const piece = Uint8Array.from({ length: T.length / 3 }, (_, t) => (xy[2 * T[3 * t]] + xy[2 * T[3 * t + 1]] + xy[2 * T[3 * t + 2]]) / 3 < 0.5 ? 0 : 1);
  const J = jitterPlane(X, T, piece);
  let moved = 0;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const v = id(i, j), d = Math.hypot(J[2 * v] - X[2 * v], J[2 * v + 1] - X[2 * v + 1]);
    const fixed = i === 0 || j === 0 || i === nx || j === ny || i === nx / 2;
    if (fixed) assert.equal(d, 0, `vertex ${i},${j} is on the outline or the crease`); else { assert.ok(d > 1e-4, `vertex ${i},${j} moved`); moved++; }
  }
  assert.ok(moved > 0);
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2];
    const ar = (J[2 * b] - J[2 * a]) * (J[2 * c + 1] - J[2 * a + 1]) - (J[2 * b + 1] - J[2 * a + 1]) * (J[2 * c] - J[2 * a]);
    assert.ok(ar > 0, 'counter-clockwise still');
  }
  // the same answer every time
  assert.deepEqual(Array.from(jitterPlane(X, T, piece)), Array.from(J));
});
