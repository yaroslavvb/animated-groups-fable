// The DOM-free parts of src/render3d.js: view quaternions, camera matrices, the per-frame triangle sort, vertex
// normals, the polyline packing and the elastic zoom limit. (The pictures themselves are checked with tools/shot.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { viewFromAzEl, __test as T } from '../src/render3d.js';
import { hexToRgb } from '../src/palette.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const rotate = (q, v) => { const m = T.qToMat3(q, new Float64Array(9)); return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
const project = (cam, p) => {
  const v = cam.pv, w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
  return [(v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12]) / w, (v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13]) / w, (v[2] * p[0] + v[6] * p[1] + v[10] * p[2] + v[14]) / w, w];
};

test('default view: looking down from 55 degrees, +y up-screen, +z toward the viewer', () => {
  const { q, zoom } = viewFromAzEl();
  assert.equal(zoom, 1);
  assert.ok(near(Math.hypot(...q), 1, 1e-12));
  const c = Math.cos(35 * Math.PI / 180), s = Math.sin(35 * Math.PI / 180);
  const x = rotate(q, [1, 0, 0]), y = rotate(q, [0, 1, 0]), z = rotate(q, [0, 0, 1]);
  assert.ok(near(x[0], 1, 1e-12) && near(x[1], 0, 1e-12) && near(x[2], 0, 1e-12), 'x stays horizontal');
  assert.ok(near(y[1], c, 1e-12) && near(y[2], -s, 1e-12), 'y points up-screen and away');
  assert.ok(near(z[1], s, 1e-12) && near(z[2], c, 1e-12), 'z points up-screen and toward the eye');
  // the eye direction (camera-space +z) in world coordinates is (0, -cos 55, sin 55)
  const m = T.qToMat3(q, new Float64Array(9));
  assert.ok(near(m[6], 0, 1e-12) && near(m[7], -Math.cos(55 * Math.PI / 180), 1e-12) && near(m[8], Math.sin(55 * Math.PI / 180), 1e-12));
});

test('viewFromAzEl: plan view, azimuth and elevation', () => {
  const plan = viewFromAzEl(0, 90).q;
  for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) { const r = rotate(plan, v); assert.ok(r.every((t, i) => near(t, v[i], 1e-12)), 'el = 90 is the identity'); }
  const rand = rng(7);
  for (let k = 0; k < 50; k++) {
    const az = 360 * rand() - 180, el = 170 * rand() - 85;
    const m = T.qToMat3(viewFromAzEl(az, el).q, new Float64Array(9));
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    const eye = [Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e)];
    assert.ok(near(m[6], eye[0], 1e-9) && near(m[7], eye[1], 1e-9) && near(m[8], eye[2], 1e-9), 'eye direction');
    assert.ok(near(m[2], 0, 1e-9), 'the z axis has no sideways component: it stays upright on screen');
    assert.ok(m[5] >= -1e-12, 'and points up-screen');
  }
});

test('quaternions: product = composition, slerp hits its ends and stays on the sphere', () => {
  const rand = rng(11);
  for (let k = 0; k < 40; k++) {
    const a = T.qAxisAngle(rand() - 0.5, rand() - 0.5, rand() - 0.5, 6 * rand() - 3);
    const b = T.qAxisAngle(rand() - 0.5, rand() - 0.5, rand() - 0.5, 6 * rand() - 3);
    const v = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
    const lhs = rotate(T.qMul(a, b), v), rhs = rotate(a, rotate(b, v));
    assert.ok(lhs.every((t, i) => near(t, rhs[i], 1e-12)), 'qMul(a, b) applies b first');
    assert.ok(T.qSlerp(a, b, 0).every((t, i) => near(Math.abs(t), Math.abs(a[i]), 1e-9)));
    const end = T.qSlerp(a, b, 1), sgn = Math.sign(end[0] * b[0] + end[1] * b[1] + end[2] * b[2] + end[3] * b[3]);
    assert.ok(end.every((t, i) => near(t, sgn * b[i], 1e-9)));
    assert.ok(near(Math.hypot(...T.qSlerp(a, b, 0.37)), 1, 1e-12));
  }
  assert.deepEqual(T.qAxisAngle(0, 0, 0, 1), [0, 0, 0, 1], 'a zero axis is the identity');
  assert.deepEqual(T.qNormalize([NaN, 0, 0, 1]), [0, 0, 0, 1], 'garbage becomes the identity');
});

test('camera: the frame sphere fits the canvas for any aspect, zoom scales it, depth is in range', () => {
  const rand = rng(3);
  for (const aspect of [16 / 9, 1, 0.5, 390 / 780, 2.4]) {
    for (let k = 0; k < 12; k++) {
      const q = viewFromAzEl(360 * rand(), 180 * rand() - 90).q;
      const center = [rand() - 0.5, rand() - 0.5, rand() - 0.5], radius = 0.3 + 2 * rand();
      const cam = T.cameraMatrices(q, 1, center, radius, aspect, T.makeCamera());
      const c0 = project(cam, center);
      assert.ok(near(c0[0], 0, 1e-6) && near(c0[1], 0, 1e-6), 'the centre is in the middle');
      assert.ok(c0[2] > -1 && c0[2] < 1 && c0[3] > 0);
      let big = 0;
      for (let i = 0; i < 400; i++) {             // random points of the sphere
        const u = 2 * rand() - 1, ph = 2 * Math.PI * rand(), s = Math.sqrt(1 - u * u);
        const pr = project(cam, [center[0] + radius * s * Math.cos(ph), center[1] + radius * s * Math.sin(ph), center[2] + radius * u]);
        assert.ok(pr[3] > 0 && pr[2] > -1 && pr[2] < 1, 'in front of the eye, inside the depth range');
        big = Math.max(big, Math.abs(pr[0]), Math.abs(pr[1]));
      }
      assert.ok(big <= 1 / T.FIT_MARGIN + 1e-6, 'the sphere stays inside the canvas with its margin: ' + big);
      assert.ok(big > 0.45 / T.FIT_MARGIN, 'and is not tiny: ' + big);
      const cam2 = T.cameraMatrices(q, 2, center, radius, aspect, T.makeCamera());
      assert.ok(near(cam2.dist * 2, cam.dist, 1e-9), 'zoom 2 halves the distance');
      // camera-space axes: a step along the camera's right / up vector moves the image right / up
      const r = cam.rot, e = 0.01 * radius;
      const right = project(cam, [center[0] + e * r[0], center[1] + e * r[1], center[2] + e * r[2]]);
      const up = project(cam, [center[0] + e * r[3], center[1] + e * r[4], center[2] + e * r[5]]);
      assert.ok(right[0] > 0 && near(right[1], 0, 1e-6) && up[1] > 0 && near(up[0], 0, 1e-6));
    }
  }
});

test('triangle sort: a permutation, back to front, stable, and it survives NaN', () => {
  const rand = rng(5);
  const n = 900, m = 2500;
  const pos = new Float32Array(3 * n).map(() => 4 * rand() - 2);
  const tri = new Uint32Array(3 * m).map(() => Math.floor(n * rand()));
  const scratch = T.makeSortScratch(n, m), out = new Uint32Array(3 * m);
  for (let k = 0; k < 6; k++) {
    const d = [rand() - 0.5, rand() - 0.5, rand() - 0.5], l = Math.hypot(...d);
    const z = d.map((t) => t / l);
    T.sortTriangles(pos, n, tri, m, z[0], z[1], z[2], scratch, out);
    const depth = (a, b, c) => [a, b, c].reduce((s, v) => s + z[0] * pos[3 * v] + z[1] * pos[3 * v + 1] + z[2] * pos[3 * v + 2], 0);
    const key = (a, b, c) => a * n * n + b * n + c;
    const want = new Map(), got = new Map();
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < m; t++) {
      want.set(key(tri[3 * t], tri[3 * t + 1], tri[3 * t + 2]), (want.get(key(tri[3 * t], tri[3 * t + 1], tri[3 * t + 2])) || 0) + 1);
      got.set(key(out[3 * t], out[3 * t + 1], out[3 * t + 2]), (got.get(key(out[3 * t], out[3 * t + 1], out[3 * t + 2])) || 0) + 1);
      const dd = depth(tri[3 * t], tri[3 * t + 1], tri[3 * t + 2]);
      lo = Math.min(lo, dd); hi = Math.max(hi, dd);
    }
    assert.equal(got.size, want.size);
    for (const [kk, c] of want) assert.equal(got.get(kk), c, 'same multiset of triangles');
    const bucket = (hi - lo) / 65535;                // one bucket of the 16-bit key (plus float32 slack)
    let prev = -Infinity;
    for (let t = 0; t < m; t++) {
      const dd = depth(out[3 * t], out[3 * t + 1], out[3 * t + 2]);
      assert.ok(dd >= prev - 1.01 * bucket - 1e-5, 'farther triangles come first');
      prev = Math.max(prev, dd);
    }
  }
  // stable: equal depths keep their input order (no flicker between coplanar triangles)
  const flat = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 0, 0, 2, 1, 0]);
  const ftri = new Uint32Array([0, 1, 2, 1, 3, 2, 1, 4, 3, 4, 5, 3]);
  const fout = new Uint32Array(12);
  T.sortTriangles(flat, 6, ftri, 4, 0, 0, 1, T.makeSortScratch(6, 4), fout);
  assert.deepEqual([...fout], [...ftri]);
  // two parallel sheets: the lower one first when seen from above, last when seen from below
  const two = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.1, 1, 0, 0.1, 0, 1, 0.1]);
  const ttri = new Uint32Array([3, 4, 5, 0, 1, 2]), tout = new Uint32Array(6);
  T.sortTriangles(two, 6, ttri, 2, 0, 0, 1, T.makeSortScratch(6, 2), tout);
  assert.deepEqual([...tout], [0, 1, 2, 3, 4, 5]);
  T.sortTriangles(two, 6, ttri, 2, 0, 0, -1, T.makeSortScratch(6, 2), tout);
  assert.deepEqual([...tout], [3, 4, 5, 0, 1, 2]);
  // NaN positions must not throw or lose triangles
  const bad = Float32Array.from(pos); bad[5] = NaN; bad[301] = Infinity;
  T.sortTriangles(bad, n, tri, m, 0, 0, 1, scratch, out);
  let sumIn = 0, sumOut = 0;
  for (let i = 0; i < 3 * m; i++) { sumIn += tri[i]; sumOut += out[i]; }
  assert.equal(sumOut, sumIn);
});

test('vertex normals: +z on a flat counter-clockwise grid, radial on a sphere', () => {
  const N = 12, pos = new Float32Array(3 * (N + 1) * (N + 1)), tri = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const v = i * (N + 1) + j; pos[3 * v] = j / N + 0.02 * Math.sin(3 * i); pos[3 * v + 1] = i / N; pos[3 * v + 2] = 0; }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + 1, c = a + N + 2, d = a + N + 1; tri.push(a, b, c, a, c, d); }
  const nrm = T.accumulateNormals(pos, Uint32Array.from(tri), tri.length / 3, new Float32Array(pos.length));
  for (let v = 0; v < (N + 1) * (N + 1); v++) assert.ok(nrm[3 * v] === 0 && nrm[3 * v + 1] === 0 && nrm[3 * v + 2] > 0, 'front = +z');
  // octahedron subdivided once, pushed to the unit sphere
  const sp = [], st = [];
  const U = 24, V = 12;
  for (let i = 0; i <= V; i++) for (let j = 0; j < U; j++) { const th = Math.PI * (i / V), ph = 2 * Math.PI * j / U; sp.push(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)); }
  for (let i = 0; i < V; i++) for (let j = 0; j < U; j++) { const a = i * U + j, b = i * U + (j + 1) % U, c = (i + 1) * U + (j + 1) % U, d = (i + 1) * U + j; st.push(a, d, c, a, c, b); }
  const spos = Float32Array.from(sp), sn = T.accumulateNormals(spos, Uint32Array.from(st), st.length / 3, new Float32Array(sp.length));
  for (let v = U; v < V * U; v++) {              // away from the poles (their rings are degenerate)
    const l = Math.hypot(sn[3 * v], sn[3 * v + 1], sn[3 * v + 2]);
    const dot = (sn[3 * v] * spos[3 * v] + sn[3 * v + 1] * spos[3 * v + 1] + sn[3 * v + 2] * spos[3 * v + 2]) / l;
    assert.ok(dot > 0.995, 'outward: ' + dot);
  }
});

test('layer probe: counts the sheets seen through each probe point, exactly', () => {
  // a regular grid mesh of the square [-1,1]^2 (edges on a lattice: the probe points must not sit on them)
  const N = 16;
  const sheet = (z, flip) => {
    const pos = [], tri = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) pos.push(-1 + 2 * j / N, -1 + 2 * i / N, z);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = i * (N + 1) + j, b = a + 1, c = a + N + 2, d = a + N + 1;
      if (flip) tri.push(a, c, b, a, d, c); else tri.push(a, b, c, a, c, d);
    }
    return { pos, tri };
  };
  const stack = (zs) => {
    const pos = [], tri = [];
    zs.forEach((z, k) => { const s = sheet(z, k % 2 === 1), base = pos.length / 3; pos.push(...s.pos); for (const v of s.tri) tri.push(v + base); });
    return { pos: Float32Array.from(pos), tri: Uint32Array.from(tri) };
  };
  const cam = T.cameraMatrices(viewFromAzEl(0, 90).q, 1, [0, 0, 0], 1.5, 1, T.makeCamera());   // plan view, square canvas
  const inside = (mesh) => {            // probe points whose ray passes through the square (computed independently)
    let k = 0;
    const d = cam.dist, f = 1 / Math.tan(T.FOV_Y / 2);
    for (let py = 0; py < T.PROBE; py++) for (let px = 0; px < T.PROBE; px++) {
      const nx = (px + 0.6373) / (T.PROBE / 2) - 1, ny = (py + 0.2911) / (T.PROBE / 2) - 1;
      const z = mesh, x = nx * (d - z) / f, y = ny * (d - z) / f;       // the point of the plane z = mesh behind (nx, ny)
      if (Math.abs(x) < 1 && Math.abs(y) < 1) k++;
    }
    return k;
  };
  const one = stack([0]);
  const s1 = T.makeProbeScratch(one.pos.length / 3);
  const seen = T.probeSheets(one.pos, one.pos.length / 3, one.tri, one.tri.length / 3, cam.pv, 1, s1);
  assert.equal(seen, inside(0), 'one sheet: every probe point over the square counts exactly 1');
  assert.ok(seen > 0.3 * T.PROBE * T.PROBE, 'and the square fills a good part of the probe grid: ' + seen);
  for (const want of [2, 3, 4]) assert.equal(T.probeSheets(one.pos, one.pos.length / 3, one.tri, one.tri.length / 3, cam.pv, want, s1), 0, 'no double counting on shared edges');
  const three = stack([0, 0.02, 0.04]);
  const s3 = T.makeProbeScratch(three.pos.length / 3);
  const hits3 = T.probeSheets(three.pos, three.pos.length / 3, three.tri, three.tri.length / 3, cam.pv, 3, s3);
  assert.ok(hits3 >= inside(0) && hits3 <= inside(0.04), 'three stacked sheets (either winding): ' + hits3);
  assert.equal(T.probeSheets(three.pos, three.pos.length / 3, three.tri, three.tri.length / 3, cam.pv, 1, s3) +
    T.probeSheets(three.pos, three.pos.length / 3, three.tri, three.tri.length / 3, cam.pv, 2, s3) <= 4 * T.PROBE, true, 'only the rim sees fewer');
  // a closed surface (an octahedron) never shows an odd number of sheets, from any direction
  const octa = { pos: new Float32Array([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1]), tri: new Uint32Array([0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5]) };
  const so = T.makeProbeScratch(6), rand = rng(21);
  for (let k = 0; k < 25; k++) {
    const c = T.cameraMatrices(viewFromAzEl(360 * rand(), 180 * rand() - 90).q, 0.6 + 2 * rand(), [0, 0, 0], 1.2, 0.5 + rand(), T.makeCamera());
    assert.equal(T.probeSheets(octa.pos, 6, octa.tri, 8, c.pv, 1, so), 0);
    assert.equal(T.probeSheets(octa.pos, 6, octa.tri, 8, c.pv, 3, so), 0);
    assert.ok(T.probeSheets(octa.pos, 6, octa.tri, 8, c.pv, 2, so) > 0);
  }
  // garbage in: no throw, nothing counted
  const bad = Float32Array.from(one.pos).fill(NaN);
  assert.equal(T.probeSheets(bad, bad.length / 3, one.tri, one.tri.length / 3, cam.pv, 1, s1), 0);
});

test('polylines: segments, free ends, loops, duplicates, arc length, dashes', () => {
  const S = T.LINE_STRIDE, state = { data: new Float32Array(0), pts: new Float32Array(0), cum: new Float32Array(1) };
  const seg = (i) => Array.from(state.data.subarray(i * S, (i + 1) * S));
  const pts = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 2, 0, NaN, 0, 0, 4, 2, 0]);     // one duplicate, one NaN
  let count = T.packLines([{ points: pts, color: [0.1, 0.2, 0.3], width: 5 }], 1, 0.004, state);
  assert.equal(count, 3, 'four distinct points, three segments');
  let s0 = seg(0), s1 = seg(1), s2 = seg(2);
  assert.deepEqual(s0.slice(0, 3), s0.slice(3, 6), 'free start: prev = a');
  assert.deepEqual(s2.slice(6, 9), s2.slice(9, 12), 'free end: next = b');
  assert.deepEqual(s1.slice(0, 3), s0.slice(3, 6), 'prev of segment 1 = a of segment 0');
  assert.deepEqual(s1.slice(9, 12), s2.slice(6, 9), 'next of segment 1 = b of segment 2');
  assert.deepEqual(s0.slice(6, 9), s1.slice(3, 6), 'shared joint');
  for (const s of [s0, s1, s2]) {
    assert.ok(near(s[12], 0.1, 1e-6) && near(s[13], 0.2, 1e-6) && near(s[14], 0.3, 1e-6) && s[15] === 1, 'colour, alpha 1');
    assert.ok(s[16] === 5 && near(s[17], 0.35, 1e-6) && s[20] === 0 && s[21] === 0, 'width, default xray, solid');
  }
  assert.deepEqual([s0[18], s0[19], s1[18], s1[19], s2[18], s2[19]], [0, 1, 1, 3, 3, 6], 'arc length');
  // loop (with the first point repeated at the end): every joint is shared
  const sq = new Float32Array([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 0, 0, 0]);
  count = T.packLines([{ points: sq, color: [0, 0, 0], width: 2, loop: true, dashed: true }], 1, 0.004, state);
  assert.equal(count, 4);
  const last = seg(3), first = seg(0);
  assert.deepEqual(last.slice(6, 9), first.slice(3, 6), 'the loop closes');
  assert.deepEqual(first.slice(0, 3), last.slice(3, 6), 'prev of the first segment = start of the last');
  assert.deepEqual(last.slice(9, 12), first.slice(6, 9), 'next of the last segment = end of the first');
  assert.equal(last[19], 8, 'total length');
  const period = first[21], on = first[20];
  assert.ok(period > 0 && on > 0 && on < period);
  assert.ok(near(8 / period, Math.round(8 / period), 1e-5), 'a whole number of dashes round a loop: ' + 8 / period);
  // skipped lines, single points, explicit dash, several lines
  count = T.packLines([{ points: sq, width: 3, alpha: 0 }, { points: sq, width: 0 }, null, { points: new Float32Array([1, 2, 3]), width: 6, alpha: 0.5, xray: 1 },
    { points: pts, width: 2, dash: [0.3, 0.2] }], 1, 0.004, state);
  assert.equal(count, 1 + 3);
  const dot = seg(0);
  assert.deepEqual(dot.slice(3, 6), [1, 2, 3]); assert.deepEqual(dot.slice(6, 9), [1, 2, 3]);
  assert.ok(dot[15] === 0.5 && dot[17] === 1);
  assert.ok(near(seg(1)[21], 0.5, 1e-6) && near(seg(1)[20], 0.3 - 2 * 0.004, 1e-6), 'dash: period = on + off, the caps are taken off the dash');
  assert.equal(T.packLines([], 1, 0.004, state), 0);
});

test('lines: every pixel of a stroke is depth-tested at the depth of its centre line, with no sawtooth from segment to segment (finding 24)', () => {
  // 1. The shaders. The vertex shader hands the fragment shader the biased depths of the segment's two ends; the
  //    fragment shader writes, for every pixel of the stroke, the depth of the nearest point of the centre line, before
  //    anything can discard the pixel, so the hidden pass and the visible pass test one and the same depth.
  const vs = T.LINE_VS, fs = T.LINE_FS;
  assert.match(vs, /float zA = biasedDepth\(ca, hw\), zB = biasedDepth\(cb, hw\);/);
  assert.match(vs, /vZ = vec2\(zA, zB\)/);
  const writes = fs.match(/gl_FragDepth\s*=[^;]+;/g) || [];
  assert.equal(writes.length, 1, 'gl_FragDepth is written once');
  assert.equal(writes[0], 'gl_FragDepth = 0.5 + 0.5 * mix(vZ.x, vZ.y, clamp(along / max(len, 1e-3), 0.0, 1.0));');
  assert.ok(fs.indexOf('gl_FragDepth') < fs.indexOf('discard'), 'written before the first discard');
  // 2. Why that is right. Along a straight 3D segment the NDC depth is an affine function of the position on the
  //    screen, so mixing the ends' depths by the position along the projected segment gives the depth of the point
  //    under the pixel, and two segments agree at their joint. The camera-facing quad's own interpolation (its corners
  //    carry the ends' depths, but it runs ext = half width + 1.5 px past each end) misses an end by
  //    (zB - zA) ext / (len + 2 ext), with the opposite sign across every joint: the sawtooth behind the zipper.
  const rand = rng(41), W = 1200, H = 900, ext = 2.25 * 2 + 1.5;          // device px; a 4.5 css px line at dpr 2
  // the depth the depth test sees at the pixel `along` px from end A: the shader's (centre line) and the quad's (old)
  const centreDepth = (a, b, len, along) => a[2] + (b[2] - a[2]) * Math.min(1, Math.max(0, along / len));
  const quadDepth = (a, b, len, along) => a[2] + (b[2] - a[2]) * (along + ext) / (len + 2 * ext);
  let worstNew = 0, worstNewJump = 0, smallestOldJump = Infinity, joints = 0;
  for (let k = 0; k < 40; k++) {
    const cam = T.cameraMatrices(viewFromAzEl(360 * rand(), 170 * rand() - 85).q, 0.7 + rand(), [0, 0, 0], 1, 0.6 + rand(), T.makeCamera());
    const scr = (p) => { const c = project(cam, p); return [(c[0] * 0.5 + 0.5) * W, (c[1] * 0.5 + 0.5) * H, c[2]]; };
    // a gently bent polyline of short segments (about 8-15 px on the screen, like a tile's outline)
    const o = [rand() - 0.5, rand() - 0.5, rand() - 0.5], u = [rand() - 0.5, rand() - 0.5, rand() - 0.5], l = Math.hypot(...u);
    const P = Array.from({ length: 8 }, (_, i) => [0, 1, 2].map((j) => o[j] + 0.03 * i * u[j] / l + 0.002 * i * i * (j === 2 ? 1 : 0)));
    const S = P.map(scr), lens = [];
    for (let i = 0; i + 1 < P.length; i++) {
      const a = S[i], b = S[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      lens[i] = len;
      if (!(len > 1)) continue;
      for (const s of [0.13, 0.5, 0.87]) {     // the shader's formula against the true depth of the point under the pixel
        const p = scr(P[i].map((v, j) => v + s * (P[i + 1][j] - v)));
        const along = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len;
        worstNew = Math.max(worstNew, Math.abs(centreDepth(a, b, len, along) - p[2]) / Math.max(1e-12, Math.abs(b[2] - a[2])));
      }
    }
    // a quarter pixel before and after every joint
    for (let i = 0; i + 2 < P.length; i++) {
      const [a, b, c] = [S[i], S[i + 1], S[i + 2]], l0 = lens[i], l1 = lens[i + 1];
      if (!(l0 > 1 && l1 > 1)) continue;
      const s0 = b[2] - a[2], s1 = c[2] - b[2];
      const slack = 0.25 * (Math.abs(s0) / l0 + Math.abs(s1) / l1);      // what a straight line changes over half a pixel
      worstNewJump = Math.max(worstNewJump, Math.abs(centreDepth(b, c, l1, 0.25) - centreDepth(a, b, l0, l0 - 0.25)) / Math.max(1e-15, slack));
      if (Math.sign(s0) === Math.sign(s1)) {
        joints++;
        const jump = Math.abs(quadDepth(b, c, l1, 0.25) - quadDepth(a, b, l0, l0 - 0.25));
        smallestOldJump = Math.min(smallestOldJump, jump / (0.5 * (Math.abs(s0) + Math.abs(s1))));
      }
    }
  }
  assert.ok(worstNew < 1e-9, 'the centre line\'s depth is exact under every pixel: ' + worstNew);
  assert.ok(worstNewJump <= 1 + 1e-9, 'and continuous across the joints: ' + worstNewJump);
  assert.ok(joints > 100 && smallestOldJump > 0.2, 'the quad\'s own depth jumped by at least a fifth of a segment\'s depth step at each of ' + joints + ' joints: ' + smallestOldJump);
});

// ---- marker labels (screen space: css px, y down) ----

const rectDist = (px, py, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));
/** Run chooseLabelSpots on a scene given in screen space, at the time `now` (ms). markers: [{ x, y, r = 6, w?, h = 13,
 *  prev = -1, fresh = true, wish = -1 }] (a marker with a w has a label); lines: [{ pts: [x, y, x, y, ...], width = 4.5, alpha = 1 }]. */
function spots(markers, lines = [], now = 0, W = 600, H = 500, cx = W / 2, cy = H / 2) {
  const segs = [], marks = [];
  for (const L of lines) for (let i = 0; i + 3 < L.pts.length; i += 2) segs.push(L.pts[i], L.pts[i + 1], L.pts[i + 2], L.pts[i + 3], 0.5 * (L.width == null ? 4.5 : L.width), L.alpha == null ? 1 : L.alpha);
  for (const m of markers) marks.push(m.x, m.y, m.r == null ? 6 : m.r);
  const items = [];
  markers.forEach((m, i) => {
    if (m.w) items.push({ x: m.x, y: m.y, r: m.r == null ? 6 : m.r, w: m.w, h: m.h || 13, mark: i, prev: m.prev == null ? -1 : m.prev, fresh: m.fresh == null ? true : m.fresh, wish: m.wish == null ? -1 : m.wish });
  });
  T.chooseLabelSpots(items, items.length, Float32Array.from(segs), segs.length / 6, Float32Array.from(marks), markers.length, W, H, cx, cy, T.makeLabelScratch(), now);
  return { items, segs };
}
/** Does the label's box, grown by `grow` px, touch the stroke of any of the segments (stride 6)? */
function touches(box, segs, grow = 0, minWeight = 0) {
  for (let o = 0; o < segs.length; o += 6) {
    if (!(segs[o + 5] > minWeight)) continue;
    const e = segs[o + 4] + grow;
    if (T.clipLength(segs[o], segs[o + 1], segs[o + 2], segs[o + 3], box[0] - e, box[1] - e, box[2] + e, box[3] + e) > 0) return true;
  }
  return false;
}

test('labels: the eight spots lie LABEL_GAP clear of the marker on their own side; between them the box goes round it', () => {
  const rand = rng(31), box = [0, 0];
  for (let k = 0; k < 150; k++) {
    const mx = 600 * rand(), my = 500 * rand(), r = 2 + 8 * rand(), w = 5 + 30 * rand(), h = 9 + 8 * rand(), d = r + T.LABEL_GAP;
    for (let s = 0; s < 8; s++) {
      const ang = s * Math.PI / 4;
      T.labelBox(mx, my, r, w, h, ang, box);
      assert.ok(near(rectDist(mx, my, box[0], box[1], box[0] + w, box[1] + h), d, 1e-9), 'the nearest point of the box is r + gap away');
      let da = Math.atan2(-(box[1] + h / 2 - my), box[0] + w / 2 - mx) - ang;      // the box's centre, seen from the marker (y up)
      da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));
      assert.ok(Math.abs(da) < Math.PI / 4 + 1e-9, `spot ${s} lies on its own side (${(da * 180 / Math.PI).toFixed(1)} degrees off)`);
    }
    let prev = T.labelBox(mx, my, r, w, h, 0, [0, 0]);
    for (let a = 0.5; a <= 360; a += 0.5) {
      const b = T.labelBox(mx, my, r, w, h, a * Math.PI / 180, [0, 0]);
      assert.ok(Math.hypot(b[0] - prev[0], b[1] - prev[1]) < 0.02 * (d + w + h), 'continuous in the angle');
      assert.ok(rectDist(mx, my, b[0], b[1], b[0] + w, b[1] + h) > 0.8 * d, 'it goes round the marker, never over it');
      prev = b;
    }
  }
});

test('labels: clipLength is the length of a segment inside a box', () => {
  assert.equal(T.clipLength(-10, 5, 20, 5, 0, 0, 10, 10), 10, 'straight across');
  assert.equal(T.clipLength(2, 2, 8, 2, 0, 0, 10, 10), 6, 'inside');
  assert.equal(T.clipLength(-5, -5, -1, 20, 0, 0, 10, 10), 0, 'beside it');
  assert.equal(T.clipLength(3, 12, 3, 30, 0, 0, 10, 10), 0, 'beyond it, vertical');
  assert.equal(T.clipLength(5, 5, 5, 5, 0, 0, 10, 10), 0, 'a point');
  assert.ok(near(T.clipLength(3, -4, 3, 4, 0, 0, 10, 10), 4, 1e-12));
  assert.ok(near(T.clipLength(-5, -5, 15, 15, 0, 0, 10, 10), 10 * Math.SQRT2, 1e-12), 'diagonal, corner to corner');
  const rand = rng(41);
  for (let k = 0; k < 300; k++) {                      // against a sampled count
    const s = [40 * rand() - 15, 40 * rand() - 15, 40 * rand() - 15, 40 * rand() - 15];
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
    let inside = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) { const u = (i + 0.5) / N, x = s[0] + u * (s[2] - s[0]), y = s[1] + u * (s[3] - s[1]); if (x >= 0 && x <= 10 && y >= 0 && y <= 10) inside++; }
    assert.ok(Math.abs(T.clipLength(s[0], s[1], s[2], s[3], 0, 0, 10, 10) - len * inside / N) <= len / N * 2 + 1e-9);
  }
});

test('labels: projectSegments puts the packed lines on the screen as the camera does', () => {
  const state = { data: new Float32Array(0), pts: new Float32Array(0), cum: new Float32Array(1) };
  const a = new Float32Array([-0.6, -0.2, 0.1, 0.1, 0.4, 0.3, 0.5, -0.3, 0.6]);
  const b = new Float32Array([0.2, 0.2, -0.2, -0.4, 0.3, 0.1]);
  const count = T.packLines([{ points: a, width: 4, alpha: 0.5 }, { points: b, width: 2, dashed: true }], 1, 0.004, state);
  assert.equal(count, 3);
  const W = 600, H = 400, cam = T.cameraMatrices(viewFromAzEl(30, 40).q, 1.3, [0, 0, 0], 1.2, W / H, T.makeCamera());
  const out = {};
  assert.equal(T.projectSegments(state.data, count, cam.pv, W, H, out), 3);
  const screen = (p) => { const c = project(cam, p); return [(c[0] * 0.5 + 0.5) * W, (0.5 - c[1] * 0.5) * H]; };
  const ends = [[a.slice(0, 3), a.slice(3, 6)], [a.slice(3, 6), a.slice(6, 9)], [b.slice(0, 3), b.slice(3, 6)]];
  ends.forEach(([p, q], i) => {
    const s = out.segs.subarray(6 * i, 6 * i + 6), sp = screen(p), sq = screen(q);
    assert.ok(near(s[0], sp[0], 1e-3) && near(s[1], sp[1], 1e-3) && near(s[2], sq[0], 1e-3) && near(s[3], sq[1], 1e-3), 'ends ' + i);
  });
  assert.deepEqual([out.segs[4], out.segs[5], out.segs[16], +out.segs[17].toFixed(6)], [2, 0.5, 1, 0.6], 'half widths; weight = alpha, x 0.6 dashed');
  // a segment with an end behind the eye is left out
  const r = cam.rot, eye = [2 * cam.dist * r[6], 2 * cam.dist * r[7], 2 * cam.dist * r[8]];
  const c2 = T.packLines([{ points: new Float32Array([0, 0, 0, ...eye]), width: 3 }, { points: new Float32Array([0, 0, 0, 0.3, 0.3, 0]), width: 3 }], 1, 0.004, state);
  assert.equal(T.projectSegments(state.data, c2, cam.pv, W, H, out), 1);
});

test('labels: the spot faces away from the centre of the frame, upper right when nothing else counts', () => {
  const L = (x, y) => spots([{ x, y, w: 17 }]).items[0].cand;
  assert.equal(L(450, 250), 0, 'right of the centre: east');
  assert.equal(L(300, 100), 2, 'above it: north');
  assert.equal(L(150, 100), 3, 'upper left: north-west');
  assert.equal(L(150, 250), 4, 'left: west');
  assert.equal(L(150, 400), 5, 'lower left: south-west');
  assert.equal(L(300, 400), 6, 'below: south');
  assert.equal(L(450, 400), 7, 'lower right: south-east');
  assert.equal(L(300, 250), 1, 'at the centre: the upper right');
});

test('labels: a label leaves the lines, the other markers and labels alone and stays inside the canvas', () => {
  // a bold line across the outer side of a marker right of the centre: east, north-east and south-east are covered
  let r = spots([{ x: 450, y: 250, w: 17 }], [{ pts: [465, 200, 465, 300] }]);
  assert.ok(![0, 1, 7].includes(r.items[0].cand) && !touches(r.items[0].box, r.segs, T.LABEL_PAD), 'beside the line: ' + r.items[0].cand);
  // a corner whose two bold edges leave on its outer side (the corner of a tile turned toward the rim)
  for (let k = 0; k < 24; k++) {
    const x = 300 + 160 * Math.cos(k * Math.PI / 12), y = 250 - 160 * Math.sin(k * Math.PI / 12), o = Math.atan2(-(y - 250), x - 300);
    const e1 = o + 0.35, e2 = o - 0.5;
    r = spots([{ x, y, w: 17 }], [{ pts: [x, y, x + 90 * Math.cos(e1), y - 90 * Math.sin(e1)] }, { pts: [x, y, x + 90 * Math.cos(e2), y - 90 * Math.sin(e2)] },
      { pts: [x, y, x - 120 * Math.cos(o), y + 120 * Math.sin(o)], width: 1.8, alpha: 0.7 }]);
    assert.ok(!touches(r.items[0].box, r.segs, 1), 'clear of both edges and the thin line, corner at ' + k * 15 + ' degrees: spot ' + r.items[0].cand);
  }
  // another marker on the preferred spot
  r = spots([{ x: 450, y: 250, w: 17 }, { x: 476, y: 250, r: 6 }]);
  const b = r.items[0].box;
  assert.ok(rectDist(476, 250, b[0] - T.LABEL_PAD, b[1] - T.LABEL_PAD, b[2] + T.LABEL_PAD, b[3] + T.LABEL_PAD) >= 6, 'not over the other marker: ' + r.items[0].cand);
  // two labelled markers close together: the labels do not overlap
  for (const dx of [10, 18, 26]) {
    for (const dy of [0, 8, 14]) {
      r = spots([{ x: 300, y: 120, w: 17 }, { x: 300 + dx, y: 120 + dy, w: 17 }]);
      const [p, q] = r.items;
      assert.ok(Math.min(p.box[2], q.box[2]) - Math.max(p.box[0], q.box[0]) <= 0 || Math.min(p.box[3], q.box[3]) - Math.max(p.box[1], q.box[1]) <= 0, `labels ${dx}, ${dy} apart`);
    }
  }
  // inside the canvas, in every corner and along every side (the lines leave the canvas there)
  for (const [x, y] of [[4, 4], [596, 4], [4, 496], [596, 496], [300, 3], [597, 250], [300, 497], [3, 250], [12, 30]]) {
    r = spots([{ x, y, w: 25 }], [{ pts: [x - 50, y + 3, x + 50, y + 3], width: 1.6, alpha: 0.5 }]);
    const bb = r.items[0].box;
    assert.ok(bb[0] >= T.LABEL_MARGIN && bb[1] >= T.LABEL_MARGIN && bb[2] <= 600 - T.LABEL_MARGIN && bb[3] <= 500 - T.LABEL_MARGIN, `inside at ${x}, ${y}: ${bb.map((v) => v.toFixed(1))}`);
  }
});

test('labels: hysteresis — a label keeps its spot until another is clearly better, and never flickers', () => {
  // the outward direction of a marker swings to and fro by +-0.5 degrees about the angle where the best spot
  // changes from east to north-east: chosen afresh every frame it flips every frame; with hysteresis it stays
  const at = (deg) => [300 + 150 * Math.cos(deg * Math.PI / 180), 250 - 150 * Math.sin(deg * Math.PI / 180)];
  const fresh = (deg) => { const [x, y] = at(deg); return spots([{ x, y, w: 17 }]).items[0].cand; };
  let lo = 0, hi = 45;
  assert.equal(fresh(lo), 0); assert.equal(fresh(hi), 1);
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fresh(mid) === 0) lo = mid; else hi = mid; }
  let flips = 0, kept = 0, prevF = -1, prevH = -1;
  for (let f = 0; f < 60; f++) {
    const [x, y] = at(lo + (f % 2 ? 0.5 : -0.5));
    const cf = spots([{ x, y, w: 17 }]).items[0].cand;
    const ch = spots([{ x, y, w: 17, prev: prevH, fresh: prevH < 0 }]).items[0].cand;
    if (prevF >= 0 && cf !== prevF) flips++;
    if (prevH >= 0 && ch !== prevH) kept++;
    prevF = cf; prevH = ch;
  }
  assert.ok(flips >= 50, 'the control flips: ' + flips);
  assert.equal(kept, 0, 'with hysteresis it never moves');
  // A bold line sweeping across a marker and the spots round it, one frame every 16.7 ms. `speed` px a frame:
  // slowly, the label keeps out of its way and never goes back to a spot it left less than 20 frames before (no to
  // and fro); fast (across the label's spots in a few frames), it is let by: the label does not move at all.
  const sweep = (dx, dy, speed) => {
    let prev = -1, wish = -1, moves = 0, covered = 0;
    const left = [];                                  // frame at which each spot was last left
    for (let f = 0; 66 - speed * f >= -66; f++) {
      const u = 66 - speed * f, px = 450 - dx * u, py = 250 - dy * u;   // the line's foot: from 66 px on one side to 66 px past
      const r = spots([{ x: 450, y: 250, w: 17, prev, fresh: prev < 0, wish }], [{ pts: [px - 200 * dy, py + 200 * dx, px + 200 * dy, py - 200 * dx] }], 16.7 * f);
      const c = r.items[0].cand;
      if (prev >= 0 && c !== prev) {
        moves++;
        left[prev] = f;
        assert.ok(!(f - left[c] < 20), `sweep ${dx},${dy} at ${speed} px: back to spot ${c} ${f - left[c]} frames after leaving it`);
      }
      if (touches(r.items[0].box, r.segs, 0)) covered++;
      prev = c; wish = r.items[0].wish;
    }
    return { moves, covered };
  };
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0.6, -0.8]]) {
    const slow = sweep(dx, dy, 0.6);
    assert.ok(slow.moves >= 1 && slow.moves <= 5, `slow sweep ${dx},${dy}: it moves out of the way, a few times at most: ${slow.moves}`);
    assert.equal(slow.covered, 0, `slow sweep ${dx},${dy}: the line never runs through the label`);
    const fast = sweep(dx, dy, 12);
    assert.equal(fast.moves, 0, `fast sweep ${dx},${dy}: the line is let by`);
    assert.ok(fast.covered <= 4, `fast sweep ${dx},${dy}: and covers the label for a moment only: ${fast.covered} frames`);
  }
  // it stays while a thin line passes a few px off its halo; a bold line through it moves it after LABEL_WAIT
  const base = spots([{ x: 450, y: 250, w: 17 }]).items[0];
  const bx = base.box;
  const brush = spots([{ x: 450, y: 250, w: 17, prev: base.cand, fresh: false }], [{ pts: [bx[0] - 20, bx[3] + 7, bx[2] + 20, bx[3] + 7], width: 1.8, alpha: 0.7 }]).items[0];
  assert.equal(brush.cand, base.cand, 'a thin line passing near does not move it');
  assert.ok(brush.score > base.score, 'though it counts a little');
  const bold = [{ pts: [(bx[0] + bx[2]) / 2, bx[1] - 30, (bx[0] + bx[2]) / 2, bx[3] + 30] }];
  const cross0 = spots([{ x: 450, y: 250, w: 17, prev: base.cand, fresh: false }], bold, 1000).items[0];
  assert.equal(cross0.cand, base.cand, 'a bold line through it: not at once');
  assert.equal(cross0.wish, 1000, 'but it wants to move from then on');
  const cross1 = spots([{ x: 450, y: 250, w: 17, prev: base.cand, fresh: false, wish: cross0.wish }], bold, 1000 + T.LABEL_WAIT - 1).items[0];
  assert.equal(cross1.cand, base.cand, 'it waits LABEL_WAIT ms');
  const cross2 = spots([{ x: 450, y: 250, w: 17, prev: base.cand, fresh: false, wish: cross0.wish }], bold, 1000 + T.LABEL_WAIT).items[0];
  assert.notEqual(cross2.cand, base.cand, 'and then moves');
  assert.equal(cross2.wish, -1);
  assert.notEqual(spots([{ x: 450, y: 250, w: 17, prev: base.cand, fresh: true }], bold, 1000).items[0].cand, base.cand, 'chosen afresh it moves at once');
});

// Amended on 10 Nov 2026 for the owner's ask of 9-10 Nov ("find a way to occupy more space on the Orbifold", "I meant
// for all the examples"; qa/fill-judge.md): the pattern's comma is now one big comma per tile (30 % of it, 5 to 10
// times the old one) and its outline (a thin line, MOTIF_ALPHA 0.7, 1.8 px) runs past the cone points in some views,
// on every side of a few of them (632 at az 120, el 20: no spot of the eight is clear of it). The placement treats a
// thin line as the soft obstacle it is (round 2: the cost is alpha x width x the length it covers) and the label's white
// halo keeps it legible over one (qa/fill-port/lab-*.png). So: every other line, as before, never touches a label; the
// comma's outline touches one only where no spot is clean (clear of every line by 1 px, of every bold line by the
// placement's whole reach, inside the canvas and off the other markers).
// Accepted, and tightened, by the renderer's owner of the fill fix-up (10 Nov 2026; the verifier's finding 4 asked for
// the amended contract to be accepted explicitly or the old one kept). The old rule cannot be kept without making the
// pictures worse: in the cases left (2 of 240 labels then, both 2222 at az 120, el 20, once the table was placed for the
// view; 4 since 442's pillow got plumper on 10 Nov, 442 at az 40, el 30 and 2222 at az 120, el 20, laptop and phone,
// notes/integrator-final.md) the only spot the comma's outline does not cross has a bold seam edge against the label's halo, and the
// placement's cost model (round 2) rightly scores that worse (120) than the faint outline under the halo (59)
// (dev/fill-fix/label-scores.mjs). At most 1 label in 40 now (it was 1 in 20); and the halo itself is tested below.
test('labels: in the app at t = 1 (*333, *632, 333, 22x, *442, 442, 632, 2222; five views; laptop and phone) no label touches a line (the comma\'s outline only where no spot is clean)', async (t) => {
  const { BY_ID } = await import('../src/groups.js');
  const { buildScene, mapScene, sceneLines, sceneMarkers, lineScale, MOTIF_ALPHA } = await import('../src/app.js');
  const isComma = (segs, o) => Math.abs(segs[o + 5] - MOTIF_ALPHA) < 1e-6 && segs[o + 4] < 1.5;
  const touchesIf = (box, segs, grow, pred) => {
    for (let o = 0; o < segs.length; o += 6) {
      if (!(segs[o + 5] > 0) || !pred(o)) continue;
      const e = segs[o + 4] + grow;
      if (T.clipLength(segs[o], segs[o + 1], segs[o + 2], segs[o + 3], box[0] - e, box[1] - e, box[2] + e, box[3] + e) > 0) return true;
    }
    return false;
  };
  let commaTouches = 0;
  const state = { data: new Float32Array(0), pts: new Float32Array(0), cum: new Float32Array(1) };
  const views = [[0, 55], [40, 30], [-70, 65], [120, 20], [200, 75]];
  const panes = [[622, 550], [364, 356]];               // the 3D pane of the app at 1280 x 720 and at 390 x 780
  let checked = 0;
  for (const id of ['*333', '*632', '333', '22x', '*442', '442', '632', '2222']) {
    const group = BY_ID[id], p = group.presets[0];
    const scene = buildScene(group, { seed: p.seed, metric: p.metric, amp: 0, anchor: p.seed });
    mapScene(scene, 1);
    for (const [W, H] of panes) {
      const k = lineScale(W, H), lines = sceneLines(scene, k), marks = sceneMarkers(scene, k), f = scene.frame;
      const count = T.packLines(lines, f.radius, f.radius / (0.45 * Math.min(W, H)), state);
      for (const [az, el] of views) {
        const cam = T.cameraMatrices(viewFromAzEl(az, el).q, 1, f.center, f.radius, W / H, T.makeCamera());
        const out = {}, n = T.projectSegments(state.data, count, cam.pv, W, H, out), segs = out.segs.subarray(0, 6 * n);
        const screen = (q) => { const c = project(cam, q); return [(c[0] * 0.5 + 0.5) * W, (0.5 - c[1] * 0.5) * H]; };
        const mk = [], items = [];
        marks.forEach((m, i) => {
          const [x, y] = screen(m.p);
          mk.push(x, y, m.size / 2);
          if (m.label) items.push({ x, y, r: m.size / 2, w: 8.5 * String(m.label).length + 1, h: 13, mark: i, prev: -1, fresh: true });
        });
        T.chooseLabelSpots(items, items.length, segs, n, Float32Array.from(mk), marks.length, W, H, W / 2, H / 2, T.makeLabelScratch());
        const where = `${id} ${W}x${H} az ${az} el ${el}`;
        assert.ok(items.length >= 1, where + ': labels');
        items.forEach((it, i) => {
          assert.ok(!touchesIf(it.box, segs, 1, (o) => !isComma(segs, o)), `${where}: label ${i} (${marks[it.mark].label}, spot ${it.cand}) is clear of every line by 1 px (the comma's outline aside)`);
          if (touchesIf(it.box, segs, 1, (o) => isComma(segs, o))) {
            commaTouches++;
            const clean = [], b = [0, 0];
            for (let s = 0; s < 8; s++) {
              T.labelBox(it.x, it.y, it.r, it.w, it.h, (s * Math.PI) / 4, b);
              const box = [b[0], b[1], b[0] + it.w, b[1] + it.h];
              if (touchesIf(box, segs, 1, () => true)) continue;
              if (touchesIf(box, segs, T.LABEL_PAD + 1.5 + T.LABEL_CLEAR, (o) => segs[o + 4] >= 1.5)) continue;
              if (box[0] < T.LABEL_MARGIN || box[1] < T.LABEL_MARGIN || box[2] > W - T.LABEL_MARGIN || box[3] > H - T.LABEL_MARGIN) continue;
              if (marks.some((m, j) => j !== it.mark && rectDist(mk[3 * j], mk[3 * j + 1], box[0], box[1], box[2], box[3]) < mk[3 * j + 2] + 1)) continue;
              clean.push(s);
            }
            assert.deepEqual(clean, [], `${where}: label ${i} (${marks[it.mark].label}, spot ${it.cand}) lies on the comma's outline though spot(s) ${clean} are clean`);
          }
          assert.ok(it.box[0] >= 0 && it.box[1] >= 0 && it.box[2] <= W && it.box[3] <= H, `${where}: label ${i} inside`);
          for (let j = 0; j < items.length; j++) {
            if (j === i) continue;
            const q = items[j];
            assert.ok(rectDist(mk[3 * q.mark], mk[3 * q.mark + 1], it.box[0], it.box[1], it.box[2], it.box[3]) >= q.r, `${where}: label ${i} is off marker ${j}`);
            assert.ok(Math.min(it.box[2], q.box[2]) <= Math.max(it.box[0], q.box[0]) || Math.min(it.box[3], q.box[3]) <= Math.max(it.box[1], q.box[1]), `${where}: labels ${i} and ${j} apart`);
          }
          checked++;
        });
      }
    }
  }
  assert.ok(checked > 100, 'labels checked: ' + checked);
  assert.ok(commaTouches <= checked / 40, `${commaTouches} of ${checked} labels lie on the comma's outline`);
  t.diagnostic(`${checked} labels; ${commaTouches} touch the comma's outline (no clean spot there)`);
});

// The verifier's finding 4 (10 Nov 2026): no test covered a label over the comma's dark teal fill. In Chrome, all 185
// labels of the 13 groups with cone points at t = 1 in the five views above (dev/fill-fix/label-contrast.mjs): 3 lie
// mostly over the fill, and the worst of all (2222 at az 120, el 20, wholly over it) reads at 8.6:1 with the halo and
// 3.2:1 without it, below the 4.5:1 that text needs. So the halo is what makes them legible: it must stay.
test('labels: the white halo that keeps a label legible over the comma\'s fill and outline (dark ink; white text-shadow, three layers or more, reaching 4 px)', () => {
  const css = T.LABEL_STYLE;
  assert.match(css, /\.r3d-label/);
  const color = /(?:^|[;{])\s*color\s*:\s*([^;}]+)/.exec(css);
  assert.ok(color, 'the label sets its colour');
  const ink = hexToRgb(color[1].trim()), lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(ink[0]) + 0.7152 * lin(ink[1]) + 0.0722 * lin(ink[2]);
  assert.ok((1 + 0.05) / (L + 0.05) >= 15, `dark ink on the white halo: ${color[1]}`);
  const shadow = /text-shadow\s*:\s*([^;}]+)/.exec(css);
  assert.ok(shadow, 'the label has a halo (text-shadow)');
  const layers = shadow[1].split(/,(?![^(]*\))/).map((s) => s.trim());
  const white = layers.filter((s) => /#fff(?:fff)?\b|white|rgba?\(\s*255\s*,\s*255\s*,\s*255/i.test(s));
  assert.ok(white.length >= 3, `three white layers or more: ${shadow[1]}`);
  // a layer is "offset-x offset-y blur colour": the lengths are the tokens left once the colour is taken out
  const lengths = (s) => s.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\bwhite\b/gi, ' ').trim().split(/\s+/).map(parseFloat);
  const blur = Math.max(...white.map((s) => { const n = lengths(s); return n.length >= 3 && Number.isFinite(n[2]) ? n[2] : 0; }));
  assert.ok(blur >= 4, `the widest white layer reaches ${blur} px (the comma's outline is under 2 px wide)`);
});

test('labels: in the app, turning the view 1 degree a frame (60 fps) or folding, labels keep off the edges and do not hop to and fro', async () => {
  // The renderer's rules, frame by frame, on the app's scenes: a label is chosen afresh when it is new or its marker
  // jumped by 12 % of the canvas; otherwise it keeps its spot (hysteresis, LABEL_WAIT). Per run: moves, returns to a
  // spot left less than 20 frames (1/3 s) before, and the longest run of frames in which a bold edge touches a label.
  const { BY_ID } = await import('../src/groups.js');
  const { buildScene, mapScene, sceneLines, sceneMarkers, lineScale } = await import('../src/app.js');
  const W = 622, H = 550, k = lineScale(W, H);
  const state = { data: new Float32Array(0), pts: new Float32Array(0), cum: new Float32Array(1) };
  const run = (scene, frames, at) => {
    const scratch = T.makeLabelScratch(), out = {}, labels = [];
    let tPrev = null;
    for (let f = 0; f < frames; f++) {
      const s = at(f);
      if (s.t !== tPrev) { mapScene(scene, s.t); tPrev = s.t; }
      const lines = sceneLines(scene, k), marks = sceneMarkers(scene, k), fr = scene.frame;
      const count = T.packLines(lines, fr.radius, fr.radius / (0.45 * Math.min(W, H)), state);
      const cam = T.cameraMatrices(viewFromAzEl(s.az, s.el).q, 1, fr.center, fr.radius, W / H, T.makeCamera());
      const n = T.projectSegments(state.data, count, cam.pv, W, H, out), segs = out.segs.subarray(0, 6 * n);
      const mk = [], items = [];
      marks.forEach((m, i) => {
        const c = project(cam, m.p), x = (c[0] * 0.5 + 0.5) * W, y = (0.5 - c[1] * 0.5) * H;
        mk.push(x, y, m.size / 2);
        if (!m.label) return;
        const L = labels[items.length] || (labels[items.length] = { prev: -1, wish: -1, x: 0, y: 0, moves: 0, returns: 0, run: 0, longest: 0, left: [] });
        items.push({ x, y, r: m.size / 2, w: 8.5 * String(m.label).length + 1, h: 13, mark: i, prev: L.prev, wish: L.wish, L,
          fresh: L.prev < 0 || Math.hypot(x - L.x, y - L.y) > 0.12 * Math.min(W, H) });
      });
      labels.length = items.length;
      T.chooseLabelSpots(items, items.length, segs, n, Float32Array.from(mk), marks.length, W, H, W / 2, H / 2, scratch, 1000 * f / 60);
      for (const it of items) {
        const L = it.L;
        if (L.prev >= 0 && it.cand !== L.prev && !it.fresh) { L.moves++; L.left[L.prev] = f; if (f - L.left[it.cand] < 20) L.returns++; }
        let hit = false;
        for (let o = 0; o < segs.length && !hit; o += 6) {
          if (!(segs[o + 5] > 0.9 && segs[o + 4] > 1.5)) continue;       // the bold, solid edges
          const e = segs[o + 4];
          hit = T.clipLength(segs[o], segs[o + 1], segs[o + 2], segs[o + 3], it.box[0] - e, it.box[1] - e, it.box[2] + e, it.box[3] + e) > 0;
        }
        L.run = hit ? L.run + 1 : 0; L.longest = Math.max(L.longest, L.run);
        L.prev = it.cand; L.wish = it.wish; L.x = it.x; L.y = it.y;
      }
    }
    return labels;
  };
  for (const id of ['*333', '*632', '333', '22x', '442', '2222']) {
    const group = BY_ID[id], p = group.presets[0];
    const scene = buildScene(group, { seed: p.seed, metric: p.metric, amp: 0, anchor: p.seed });
    for (const el of [55, 30]) {
      const labels = run(scene, 360, (f) => ({ t: 1, az: f, el }));
      for (const L of labels) {
        assert.ok(L.longest <= 3, `${id} turning at el ${el}: a bold edge on a label for ${L.longest} frames running`);
        assert.ok(L.returns <= 1, `${id} turning at el ${el}: ${L.returns} returns`);
        assert.ok(L.moves <= 14, `${id} turning at el ${el}: ${L.moves} moves of one label in one turn`);
      }
    }
    for (const L of run(scene, 300, (f) => ({ t: f / 299, az: 25, el: 50 }))) {
      assert.ok(L.returns <= 1, `${id} folding: ${L.returns} returns`);     // (mid-fold edges can crowd a marker on every side)
      assert.ok(L.moves <= 8, `${id} folding: ${L.moves} moves of one label`);
    }
  }
});

test('labels: the cost per frame for 10 labels among 40 polylines (4000 segments)', (t) => {
  // Two scenes, each 40 wavy polylines of 101 points (4000 segments; a quarter thin, some dashed) and 10 labelled
  // markers, the view turning 0.7 degrees a frame: "crowded" puts every line through the middle of the picture,
  // where the markers are (about 160 segments within reach of each label); "spread" spreads them over the picture.
  // Both are far busier than any scene of the app (there some labels have no spot free of lines at all).
  const run = (spread) => {
    const rand = rng(51), W = 640, H = 560;
    const polylines = [];
    for (let l = 0; l < 40; l++) {
      const pts = new Float32Array(3 * 101), a = rand() * 6.3, c = [(rand() - 0.5) * (spread ? 2.2 : 1), (rand() - 0.5) * (spread ? 2.2 : 1)];
      const len = spread ? 1.4 : 1.6;
      for (let i = 0; i <= 100; i++) {
        const s = i / 100 - 0.5;
        pts[3 * i] = c[0] + len * s * Math.cos(a) + 0.08 * Math.sin(17 * s + l);
        pts[3 * i + 1] = c[1] + len * s * Math.sin(a) + 0.08 * Math.cos(13 * s + l);
        pts[3 * i + 2] = 0.2 * Math.sin(5 * s + l);
      }
      polylines.push({ points: pts, width: l % 4 ? 4.5 : 1.8, alpha: l % 4 ? 1 : 0.7, dashed: l % 7 === 0 });
    }
    const state = { data: new Float32Array(0), pts: new Float32Array(0), cum: new Float32Array(1) };
    const count = T.packLines(polylines, 1, 0.004, state);
    assert.equal(count, 4000);
    const markers = Array.from({ length: 10 }, () => [(rand() - 0.5) * (spread ? 2 : 1), (rand() - 0.5) * (spread ? 2 : 1), 0.1 * rand()]);
    const scratch = T.makeLabelScratch(), out = {}, mk = new Float32Array(30), items = markers.map(() => ({ box: [0, 0, 0, 0] }));
    const frame = (f) => {
      const cam = T.cameraMatrices(viewFromAzEl(f * 0.7, 55).q, 1, [0, 0, 0], spread ? 1.6 : 1.2, W / H, T.makeCamera());
      const n = T.projectSegments(state.data, count, cam.pv, W, H, out);
      markers.forEach((p, i) => {
        const c = project(cam, p), x = (c[0] * 0.5 + 0.5) * W, y = (0.5 - c[1] * 0.5) * H;
        mk[3 * i] = x; mk[3 * i + 1] = y; mk[3 * i + 2] = 6;
        Object.assign(items[i], { x, y, r: 6, w: 18, h: 13, mark: i, prev: items[i].cand == null ? -1 : items[i].cand, fresh: f === 0 });
      });
      T.chooseLabelSpots(items, 10, out.segs, n, mk, 10, W, H, W / 2, H / 2, scratch);
      return n;
    };
    for (let f = 0; f < 60; f++) frame(f);              // warm up
    const t0 = performance.now(), N = 300;
    for (let f = 0; f < N; f++) frame(f);
    return (performance.now() - t0) / N;
  };
  const crowded = run(false), spread = run(true);
  t.diagnostic(`label placement, camera matrices and projection included: ${crowded.toFixed(3)} ms per frame (crowded), ` +
    `${spread.toFixed(3)} ms (spread), for 10 labels among 40 polylines (4000 segments)`);
  assert.ok(crowded < 4 && spread < 4, `cheap: ${crowded.toFixed(3)} ms, ${spread.toFixed(3)} ms`);
});

test('elastic zoom limit', () => {
  const lo = Math.log(T.ZOOM_MIN), hi = Math.log(T.ZOOM_MAX), over = Math.log(1.05);
  for (let x = lo; x <= hi; x += 0.05) assert.equal(T.softLimit(x, lo, hi, over), x);
  let prev = hi;
  for (let x = hi; x < hi + 3; x += 0.01) { const y = T.softLimit(x, lo, hi, over); assert.ok(y >= prev && y <= hi + over); prev = y; }   // saturates
  assert.ok(T.softLimit(hi + 0.02, lo, hi, over) < hi + 0.02 && T.softLimit(hi + 0.02, lo, hi, over) > hi + 0.012, 'gives way, with resistance');
  prev = lo;
  for (let x = lo; x > lo - 3; x -= 0.01) { const y = T.softLimit(x, lo, hi, over); assert.ok(y <= prev && y >= lo - over); prev = y; }
  assert.ok(near(T.softLimit(hi + 1e-6, lo, hi, over), hi + 1e-6, 1e-9), 'continuous, slope 1 at the limit');
});
