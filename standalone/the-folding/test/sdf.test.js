// test/sdf.test.js — the signed-distance texture of src/sdf.js (13 Nov 2026): the rasteriser behind the "shape prints".
//
// What the texture must be: at every texel centre the signed Euclidean distance to the nearest outline of the polygons
// it was given, negative where W > 0 (outer polygons count +1, holes -1), as round(128 + 127 clamp(sd / range)).
// EXACT in the band |sd| <= range, saturated outside it. That is tested here against a brute force that shares nothing
// with sdf.js (world coordinates, every edge for every texel, crossings counted polygon by polygon): on square, skew,
// hexagonal and mirrored (det < 0) lattices, for discs, squares, concave shapes, holes, coincident copies, polygons
// listed the wrong way round, and sixty random scenes. And what the renderer leans on: no seam where a periodic pattern
// wraps, a thin stroke that keeps its tone, a bake fast enough to run when a pattern is picked, and (with src/shapes.js)
// the texture of a real print against that module's own distance and tone.
//   node --test test/sdf.test.js
// Do these tests notice a fault? dev/patterns/scratch-core-sdf/mutants-run.mjs plants 39 of them, one at a time, in a
// copy of src/sdf.js (a margin forgotten, a row counted twice, a sign trusted to the direction of the points, ...): every
// one makes a test of this file fail.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeSDF, sdfSample, sdfDistance, MAX_SIZE } from '../src/sdf.js';

const TAU = 2 * Math.PI;

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shapes (outer polygons counter-clockwise, holes clockwise: the way sdf.js asks for them)
// ---------------------------------------------------------------------------------------------------------------

function ngon(cx, cy, r, n = 40, phase = 0.1) {
  const pts = [];
  for (let k = 0; k < n; k++) { const a = phase + (TAU * k) / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return { pts, hole: false };
}
const rect = (x0, y0, x1, y1) => ({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], hole: false });
/** A dart: a concave quadrilateral with its notch at the bottom. */
const dart = (x, y, k) => ({ pts: [[0, 0], [0.3, 0.1], [0.6, 0], [0.3, 0.5]].map(([a, b]) => [x + k * a, y + k * b]), hole: false });
/** A thick letter C: two reflex corners, two arms. */
const letterC = (x, y, k) => ({ pts: [[0, 0], [0.5, 0], [0.5, 0.12], [0.12, 0.12], [0.12, 0.38], [0.5, 0.38], [0.5, 0.5], [0, 0.5]].map(([a, b]) => [x + k * a, y + k * b]), hole: false });
/** A star with sharp tips (turns close to a half-turn at the tips). */
function star(cx, cy, r, tips = 5, inner = 0.38, phase = 0.3) {
  const pts = [];
  for (let k = 0; k < 2 * tips; k++) { const a = phase + (TAU * k) / (2 * tips), q = k % 2 ? r * inner : r; pts.push([cx + q * Math.cos(a), cy + q * Math.sin(a)]); }
  return { pts, hole: false };
}
/** A crescent with a fat end and a pointed one: the comma's cousin (a smooth outline of short edges, one sharp tip). */
function crescent(cx, cy, r, n = 28, turn = 0) {
  const pts = [], c = Math.cos(turn), s = Math.sin(turn);
  const put = (q, a) => { const x = q * Math.cos(a), y = q * Math.sin(a); pts.push([cx + c * x - s * y, cy + s * x + c * y]); };
  for (let k = 0; k <= n; k++) put(r, (Math.PI * k) / n);
  for (let k = n - 1; k >= 0; k--) put(r * (0.35 + (0.65 * k) / n), (Math.PI * k) / n);
  return { pts, hole: false };
}
/** The same outline as a hole: run clockwise, flagged. */
const asHole = (P) => ({ pts: P.pts.slice().reverse(), hole: true });
/** The points the other way round, the flag kept (the mistake the module forgives). */
const turned = (P) => ({ ...P, pts: P.pts.slice().reverse() });
const flatPts = (P) => ({ ...P, pts: Float64Array.from(P.pts.flat()) });
const shifted = (P, dx, dy) => ({ ...P, pts: P.pts.map(([x, y]) => [x + dx, y + dy]) });
function area(P) { let s = 0; for (let i = 0, n = P.pts.length; i < n; i++) { const p = P.pts[i], q = P.pts[(i + 1) % n]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; }

// ---------------------------------------------------------------------------------------------------------------
// The reference: brute force in world coordinates
// ---------------------------------------------------------------------------------------------------------------

function prep(polys) {
  return polys.map((P) => {
    const s = P.pts || P, xy = typeof s[0] === 'number' ? Float64Array.from(s) : Float64Array.from(s.flat());
    return { xy, n: xy.length / 2, sign: P.hole ? -1 : 1 };
  });
}
/** The signed distance at (x, y): to the nearest point of any edge, negative where W > 0. */
function reference(prepped, x, y) {
  let W = 0, d2 = Infinity;
  for (const P of prepped) {
    const p = P.xy, n = P.n;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
      const vx = xi - xj, vy = yi - yj, wx = x - xj, wy = y - yj, vv = vx * vx + vy * vy;
      let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = wx - t * vx, qy = wy - t * vy, q = qx * qx + qy * qy;
      if (q < d2) d2 = q;
    }
    if (inside) W += P.sign;
  }
  const d = Math.sqrt(d2);
  return W > 0 ? -d : d;
}

const centre = ({ origin = [0, 0], e1, e2, size }, i, j) => [
  origin[0] + ((i + 0.5) / size) * e1[0] + ((j + 0.5) / size) * e2[0],
  origin[1] + ((i + 0.5) / size) * e1[1] + ((j + 0.5) / size) * e2[1],
];

/**
 * Bake `spec` and hold its texels against the reference: `samples` random texels, or every texel when there are no
 * more than that. In the band the decoded distance is within one step of the byte, range / 127 (the bound the module
 * was ordered with) and, sharper, the byte is the ROUNDED exact value; outside it the byte is 1 (dark) or 255 (light).
 */
function check(label, spec, { samples = 3000, seed = 1, polysRef = spec.polys } = {}) {
  const { size, range } = spec;
  const data = bakeSDF(spec);
  assert.ok(data instanceof Uint8Array, `${label}: a Uint8Array`);
  assert.equal(data.length, size * size, `${label}: size * size texels`);
  const ref = prep(polysRef || []), rnd = prng(seed), all = size * size <= samples, n = all ? size * size : samples;
  let band = 0, dark = 0, worst = 0;
  for (let q = 0; q < n; q++) {
    const i = all ? q % size : Math.floor(rnd() * size), j = all ? Math.floor(q / size) : Math.floor(rnd() * size);
    const [x, y] = centre(spec, i, j), sd = reference(ref, x, y), v = data[j * size + i];
    if (sd < 0) dark++;
    if (Math.abs(sd) <= range) {
      band++;
      const err = Math.abs(sdfDistance(v, range) - sd);
      if (!(err <= range / 127 + 1e-9)) assert.fail(`${label}: texel (${i}, ${j}) reads ${v} = ${sdfDistance(v, range)}, the distance is ${sd} (range ${range})`);
      const off = Math.abs(v - (128 + (127 * sd) / range));
      if (!(off <= 0.5 + 1e-3)) assert.fail(`${label}: texel (${i}, ${j}) reads ${v}, the exact value ${128 + (127 * sd) / range} rounds otherwise`);
      if (off > worst) worst = off;
    } else if (v !== (sd < 0 ? 1 : 255)) {
      assert.fail(`${label}: texel (${i}, ${j}) is ${(sd / range).toFixed(3)} ranges from the outline and reads ${v}, not ${sd < 0 ? 1 : 255}`);
    }
  }
  return { data, n, band, dark, worst };
}

/** Two textures that may differ by one step at a handful of texels (a rounding tie reached by another order of sums). */
function assertSame(a, b, label, share = 0.002) {
  assert.equal(a.length, b.length, label);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > 1) assert.fail(`${label}: texel ${i} reads ${a[i]} and ${b[i]}`);
    if (d) diff++;
  }
  assert.ok(diff <= Math.ceil(share * a.length), `${label}: ${diff} of ${a.length} texels differ by one step`);
  return diff;
}

const UNIT = { origin: [0, 0], e1: [1, 0], e2: [0, 1] };

// ---------------------------------------------------------------------------------------------------------------
// The twins of the shader
// ---------------------------------------------------------------------------------------------------------------

test('sdfDistance: 128 is the outline, 255 one range out in the light, 1 one range deep in the dark', () => {
  assert.equal(sdfDistance(128, 0.25), 0);
  assert.equal(sdfDistance(255, 0.25), 0.25);
  assert.equal(sdfDistance(1, 0.25), -0.25);
  assert.ok(Math.abs(sdfDistance(191.5, 2) - 1) < 1e-12, 'linear in between, also for a filtered value');
});

test('sdfSample: the texel at a texel centre, bilinear between centres, repeating both ways', () => {
  const size = 4, data = new Uint8Array(16);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) data[j * 4 + i] = 20 + 50 * j + 7 * i * i;
  const at = (i, j) => data[j * 4 + i], near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} against ${b}`);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) near(sdfSample(data, size, (i + 0.5) / 4, (j + 0.5) / 4), at(i, j), `centre (${i}, ${j})`);
  near(sdfSample(data, size, 1 / 4, 0.5 / 4), (at(0, 0) + at(1, 0)) / 2, 'halfway between two columns');
  near(sdfSample(data, size, 0.5 / 4, 2 / 4), (at(0, 1) + at(0, 2)) / 2, 'halfway between two rows');
  near(sdfSample(data, size, 2 / 4, 3 / 4), (at(1, 2) + at(2, 2) + at(1, 3) + at(2, 3)) / 4, 'the middle of four texels');
  near(sdfSample(data, size, 0.6 / 4, 0.5 / 4), 0.9 * at(0, 0) + 0.1 * at(1, 0), 'a tenth of the way');
  // the seams: s = 0 is halfway between the last column and the first
  near(sdfSample(data, size, 0, 1.5 / 4), (at(3, 1) + at(0, 1)) / 2, 's = 0');
  near(sdfSample(data, size, 1, 1.5 / 4), (at(3, 1) + at(0, 1)) / 2, 's = 1');
  near(sdfSample(data, size, 2.5 / 4, 0), (at(2, 3) + at(2, 0)) / 2, 't = 0');
  near(sdfSample(data, size, 0, 0), (at(0, 0) + at(3, 0) + at(0, 3) + at(3, 3)) / 4, 'the corner of the cell');
  const rnd = prng(5);
  for (let q = 0; q < 200; q++) {
    const s = rnd(), t = rnd(), v = sdfSample(data, size, s, t);
    assert.ok(v >= 20 && v <= 233, 'between the smallest and the largest texel');
    near(sdfSample(data, size, s + 1, t), v, 'one cell on');
    near(sdfSample(data, size, s - 3, t + 2), v, 'three cells back, two up');
    near(sdfSample(data, size, s, t - 1), v, 'one cell down');
  }
  // continuous through the seams
  for (let q = 0; q < 50; q++) {
    const t = rnd();
    assert.ok(Math.abs(sdfSample(data, size, 1e-9, t) - sdfSample(data, size, 1 - 1e-9, t)) < 1e-5, 'across s = 0 | 1');
    assert.ok(Math.abs(sdfSample(data, size, t, 1e-9) - sdfSample(data, size, t, 1 - 1e-9)) < 1e-5, 'across t = 0 | 1');
  }
  assert.equal(sdfSample(new Uint8Array([77]), 1, 0.3, 12.9), 77, 'a texture of one texel');
});

// ---------------------------------------------------------------------------------------------------------------
// Shapes against brute force
// ---------------------------------------------------------------------------------------------------------------

test('a disc: the layout of the texels, the scale of the values, every texel against brute force', () => {
  const size = 64, range = 0.1, D = ngon(0.3, 0.6, 0.2, 60);
  assert.ok(area(D) > 0, 'the test disc runs counter-clockwise');
  const r = check('disc', { ...UNIT, size, range, polys: [D] }, { samples: size * size });
  const at = (i, j) => r.data[j * size + i];
  assert.equal(at(19, 38), 1, 'column 19, row 38 holds the centre (0.3, 0.6) of the disc: deep in the dark');
  assert.equal(at(38, 19), 255, 'column 38, row 19 is far out in the light: index = row * size + column');
  // along the row through the centre the outline is near x = 0.5: texel 31 is 0.0078 inside, texel 33 is 0.0234 outside
  assert.ok(Math.abs(at(31, 38) - (128 - 127 * 0.078)) <= 1.5, `just inside: ${at(31, 38)}`);
  assert.ok(Math.abs(at(33, 38) - (128 + 127 * 0.234)) <= 1.5, `just outside: ${at(33, 38)}`);
  assert.ok(r.band > 500 && r.dark > 300 && r.dark < r.n / 2, `a real test: ${r.band} texels in the band, ${r.dark} dark`);
  let zero = 0;
  for (const v of r.data) if (v === 0) zero++;
  assert.equal(zero, 0, 'the byte 0 never occurs');
  // the two forms of a polygon's points give the same texture
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [flatPts(D)] }), r.data, 'Float64Array [x0, y0, x1, y1, ...]');
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [D.pts] }), r.data, 'a bare list of points is an outer polygon');
  assert.deepEqual(bakeSDF({ e1: [1, 0], e2: [0, 1], size, range, polys: [D] }), r.data, 'the origin defaults to (0, 0)');
});

test('squares: an edge through texel centres reads 128; the values one and half a texel either side', () => {
  const size = 32, h = 1 / size, range = 3 * h;
  // left edge through the centres of column 4, right edge between columns 19 and 20, top edge through the centres of row 23
  const S = rect(4.5 * h, 8 * h, 20 * h, 23.5 * h);
  const r = check('square', { ...UNIT, size, range, polys: [S] }, { samples: size * size });
  const at = (i, j) => r.data[j * size + i];
  assert.equal(at(4, 15), 128, 'on the left edge');
  assert.equal(at(10, 23), 128, 'on the top edge');
  assert.equal(at(4, 23), 128, 'on the corner');
  assert.equal(at(5, 15), Math.round(128 - 127 / 3), 'one texel inside');
  assert.equal(at(3, 15), Math.round(128 + 127 / 3), 'one texel outside');
  assert.equal(at(19, 15), Math.round(128 - 127 / 6), 'half a texel inside the right edge');
  assert.equal(at(20, 15), Math.round(128 + 127 / 6), 'half a texel outside it');
  assert.equal(at(12, 15), 1, 'the middle: more than a range from every edge');
  assert.equal(at(28, 28), 255, 'far out');
  // off a corner the distance is to the corner (4.5, 23.5), not to the line of an edge
  assert.equal(at(3, 24), Math.round(128 + (127 * Math.hypot(1, 1)) / 3), 'one texel left of the corner and one above it');
  assert.equal(at(3, 25), Math.round(128 + (127 * Math.hypot(1, 2)) / 3), 'one left, two above');
  assert.equal(at(2, 26), 255, 'two left, three above: beyond the range of three texels');
  // a second square, shifted so no edge meets a texel centre
  check('square, off the grid', { ...UNIT, size, range, polys: [rect(0.137, 0.211, 0.683, 0.759)] }, { samples: size * size });
});

test('vertices and edges ON texel centres: a diamond and a plus sign (the half-open rule of the rows)', () => {
  const size = 32, h = 1 / size, range = 3 * h, c = (i) => (i + 0.5) * h;      // c(i): the centre of column or row i
  // a diamond: its top and bottom vertices are a local maximum and minimum ON a row's centre line (the row must count
  // them twice or not at all), its left and right vertices lie on a centre line that the outline passes through (once)
  const diamond = { pts: [[c(16), c(8)], [c(24), c(16)], [c(16), c(24)], [c(8), c(16)]], hole: false };
  assert.ok(area(diamond) > 0);
  const d = check('diamond', { ...UNIT, size, range, polys: [diamond] }, { samples: size * size });
  const at = (r, i, j) => r.data[j * size + i];
  for (let q = 0; q <= 8; q++) {
    assert.equal(at(d, 16 + q, 8 + q), 128, 'on the lower right side');
    assert.equal(at(d, 16 - q, 24 - q), 128, 'on the upper left side');
  }
  for (const j of [8, 16, 24]) {
    // right and left of the diamond, in the rows of its vertices: light, at the right distance, no streak to the border
    assert.equal(at(d, 31, j), 255, `row ${j}: the right end is light`);
    assert.equal(at(d, 0, j), 255, `row ${j}: the left end is light`);
  }
  assert.equal(at(d, 17, 24), Math.round(128 + (127 * Math.SQRT1_2) / 3), 'next to the top vertex');
  assert.equal(at(d, 16, 23), Math.round(128 - (127 * Math.SQRT1_2) / 3), 'under the top vertex');
  assert.equal(at(d, 16, 7), Math.round(128 + 127 / 3), 'below the bottom vertex');
  // a plus sign with every vertex on a texel centre: level edges on centre lines at a maximum, at a minimum and at four steps
  const [a, b, e, f] = [c(6), c(13), c(19), c(26)];
  const plus = { pts: [[b, a], [e, a], [e, b], [f, b], [f, e], [e, e], [e, f], [b, f], [b, e], [a, e], [a, b], [b, b]], hole: false };
  assert.ok(area(plus) > 0);
  const p = check('plus', { ...UNIT, size, range, polys: [plus] }, { samples: size * size });
  for (const j of [6, 13, 19, 26]) {
    assert.equal(at(p, 31, j), 255, `row ${j}: the right end is light`);
    assert.equal(at(p, 0, j), 255, `row ${j}: the left end is light`);
  }
  assert.equal(at(p, 16, 16), 1, 'the middle of the plus');
  assert.equal(at(p, 9, 9), 255, 'in the notch, four texels from either arm');
  assert.equal(at(p, 11, 11), Math.round(128 + (127 * 2) / 3), 'in the notch, two texels from either arm');
  assert.equal(at(p, 15, 15), Math.round(128 - (127 * Math.hypot(2, 2)) / 3), 'inside, off the corner of the notch');
  assert.equal(at(p, 16, 6), 128, 'on the bottom edge');
  assert.equal(at(p, 26, 16), 128, 'on the right edge');
  // the same two, turned over (clockwise) and on a mirrored lattice: the rule is the same from the other side
  check('diamond and plus, mirrored lattice', { origin: [0, 0], e1: [0, 1], e2: [1, 0], size, range, polys: [turned(diamond)] }, { samples: size * size });
  check('plus as a hole in a square', { ...UNIT, size, range, polys: [rect(c(2), c(2), c(29), c(29)), asHole(plus)] }, { samples: size * size });
});

test('a vertex in the middle of a straight side, texel centres exactly on the normal through it', () => {
  // Where the outline runs straight on through a vertex, the strips of the two edges meet along the normal there, and
  // a texel centre ON that line belongs to both and, by a rounding, to neither. Sides along (3, 4), (4, 3), (5, 12) ...
  // texel steps with a vertex at every step put texel centres exactly there, at distances of 5, 10, 13 texels.
  const size = 64, h = 1 / size, c = (i) => (i + 0.5) * h;
  const chain = (i0, j0, [p, q], m, n) => {
    // a rectangle from the texel centre (i0, j0): m steps of (p, q), then n steps of (-q, p), with a vertex at every step
    const pts = [];
    for (let k = 0; k < m; k++) pts.push([c(i0 + k * p), c(j0 + k * q)]);
    for (let k = 0; k < n; k++) pts.push([c(i0 + m * p - k * q), c(j0 + m * q + k * p)]);
    for (let k = m; k > 0; k--) pts.push([c(i0 + k * p - n * q), c(j0 + k * q + n * p)]);
    for (let k = n; k > 0; k--) pts.push([c(i0 - k * q), c(j0 + k * p)]);
    return { pts, hole: false };
  };
  const scenes = [
    ['(3, 4)', chain(22, 6, [3, 4], 8, 2), 12], ['(4, 3)', chain(20, 4, [4, 3], 9, 3), 12], ['(-3, 4)', chain(40, 8, [-3, 4], 8, 2), 11],
    ['(5, 12)', chain(20, 8, [5, 12], 3, 1), 14], ['(12, 5)', chain(8, 20, [12, 5], 3, 1), 14], ['(1, 2)', chain(16, 8, [1, 2], 20, 5), 7], ['(2, -1)', chain(8, 50, [2, -1], 20, 6), 7],
  ];
  for (const [name, P, r] of scenes) {
    const res = check(`side along ${name}`, { ...UNIT, size, range: r * h, polys: [P] }, { samples: size * size });
    assert.ok(area(P) > 0 && res.band > 0.2 * res.n && res.dark > 100, `${name}: ${res.band} in the band, ${res.dark} dark`);
    check(`side along ${name}, the other way round`, { ...UNIT, size, range: r * h, polys: [turned(P)] }, { samples: size * size });
  }
  // the same on a lattice turned by the 3-4-5 angle, the sides along its own vectors, a vertex at every texel centre on them
  for (const [e1, e2] of [[[0.8, -0.6], [0.6, 0.8]], [[0.6, 0.8], [0.8, -0.6]], [[1.6, 1.2], [-0.3, 0.4]], [[5 / 13, 12 / 13], [-12 / 13, 5 / 13]]]) {
    const origin = [0.1, 0.2], at = (i, j) => [origin[0] + c(i) * e1[0] + c(j) * e2[0], origin[1] + c(i) * e1[1] + c(j) * e2[1]];
    const pts = [];
    for (let i = 14; i < 50; i++) pts.push(at(i, 18));
    for (let j = 18; j < 43; j++) pts.push(at(50, j));
    for (let i = 50; i > 14; i--) pts.push(at(i, 43));
    for (let j = 43; j > 18; j--) pts.push(at(14, j));
    for (const range of [5 * h * Math.hypot(...e1), 9.5 * h * Math.hypot(...e2)]) {
      const res = check(`lattice ${e1} | ${e2}`, { origin, e1, e2, size, range, polys: [{ pts, hole: false }] }, { samples: size * size });
      assert.ok(res.band > 800, `${res.band} texels in the band`);
    }
  }
});

test('an outline cut very fine: a ring of circles of 3000 and 1500 points, against brute force and against the circles', () => {
  // edges of a sixteenth of a texel that turn by a tenth of a degree: the strips are slivers, the wedges between them thinner
  const size = 96, range = 0.06, cx = 0.47, cy = 0.52, R = 0.3, r = 0.15;
  const outer = ngon(cx, cy, R, 3000, 0.01), inner = { ...ngon(cx, cy, r, 1500, 0.02), hole: true };      // the hole runs counter-clockwise: the flag decides
  const res = check('fine ring', { ...UNIT, size, range, polys: [outer, inner] }, { samples: size * size });
  assert.ok(res.band > 0.3 * res.n && res.dark > 0.15 * res.n, `${res.band} in the band, ${res.dark} dark`);
  // the polygons are within 2e-7 of the circles, so the texture is the ring's own distance field, byte for byte up to ties
  let diff = 0;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const d = Math.hypot((i + 0.5) / size - cx, (j + 0.5) / size - cy), sd = Math.max(d - R, r - d);
    const want = Math.round(128 + 127 * Math.max(-1, Math.min(1, sd / range))), got = res.data[j * size + i];
    if (Math.abs(want - got) > 1) assert.fail(`texel (${i}, ${j}) reads ${got}, the ring's distance gives ${want}`);
    if (want !== got) diff++;
  }
  assert.ok(diff <= 0.002 * size * size, `${diff} texels a step from the analytic ring`);
});

test('concave polygons: a dart, a letter C, a star with sharp tips, a crescent', () => {
  const shapes = [dart(0.06, 0.05, 0.7), letterC(0.55, 0.08, 0.72), star(0.27, 0.72, 0.21), crescent(0.72, 0.62, 0.2, 28, 0.4)];
  for (const P of shapes) assert.ok(area(P) > 0, 'the test shapes run counter-clockwise');
  for (const [size, range] of [[96, 0.06], [80, 0.02], [50, 0.3]]) {
    const r = check(`concave, size ${size}, range ${range}`, { ...UNIT, size, range, polys: shapes }, { samples: size * size });
    assert.ok(r.band > 0.3 * r.n * Math.min(1, range / 0.06) && r.dark > 0.1 * r.n, `size ${size}: ${r.band} in the band, ${r.dark} dark of ${r.n}`);
  }
  // in the notch of the dart and between the arms of the C the paper is light
  const size = 96, data = bakeSDF({ ...UNIT, size, range: 0.06, polys: shapes });
  const tone = (x, y) => data[Math.floor(y * size) * size + Math.floor(x * size)];
  assert.ok(tone(0.06 + 0.7 * 0.3, 0.05 + 0.7 * 0.04) > 128, 'the notch of the dart');
  assert.ok(tone(0.06 + 0.7 * 0.3, 0.05 + 0.7 * 0.25) < 128, 'the body of the dart');
  assert.ok(tone(0.55 + 0.72 * 0.35, 0.08 + 0.72 * 0.25) > 128, 'between the arms of the C');
  assert.ok(tone(0.55 + 0.72 * 0.06, 0.08 + 0.72 * 0.25) < 128, 'the back of the C');
});

test('a polygon with a hole, and an island in the hole', () => {
  const O = ngon(0.5, 0.5, 0.36, 48), H = asHole(ngon(0.52, 0.49, 0.22, 36, 0.4)), I = ngon(0.5, 0.52, 0.09, 20, 0.2);
  assert.ok(area(O) > 0 && area(H) < 0 && area(I) > 0, 'outer counter-clockwise, hole clockwise');
  const size = 72, range = 0.05;
  const r = check('hole', { ...UNIT, size, range, polys: [O, H, I] }, { samples: size * size });
  const tone = (x, y) => r.data[Math.floor(y * size) * size + Math.floor(x * size)];
  assert.ok(tone(0.5, 0.52) < 128, 'the island is dark');
  assert.ok(tone(0.52, 0.33) > 128 && tone(0.68, 0.5) > 128, 'the hole is light');
  assert.ok(tone(0.5, 0.2) < 128 && tone(0.2, 0.5) < 128, 'the ring is dark');
  assert.ok(tone(0.05, 0.05) > 128, 'outside is light');
  // the order of the list does not matter
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [I, H, O] }), r.data, 'listed in another order');
  // a hole in nothing (W = -1) is light, and its outline is an outline all the same
  const lone = check('a hole without an outer polygon', { ...UNIT, size, range, polys: [H] }, { samples: size * size });
  assert.equal(lone.dark, 0, 'W = -1 is not dark');
  assert.equal(lone.data[Math.floor(0.49 * size) * size + Math.floor(0.52 * size)], 255, 'its middle: light and far from the outline');
  assert.ok(lone.band > 300, 'the band around its outline');
  // two holes in one outer polygon, one of them listed twice: W = 1 - 2 < 0 there, as light as W = 0
  const H2 = asHole(ngon(0.26, 0.68, 0.05, 16));
  const twice = check('a hole listed twice', { ...UNIT, size, range, polys: [O, H, H, H2] }, { samples: size * size });
  assert.deepEqual(twice.data, bakeSDF({ ...UNIT, size, range, polys: [O, H, H2] }), 'a hole listed twice is the hole');
  // ... so an island in it needs its second copy too (the whole motif coincides with its copy, or none of it)
  const sunk = check('the island in a hole listed twice', { ...UNIT, size, range, polys: [O, H, H, I] }, { samples: size * size });
  assert.ok(sunk.data[Math.floor(0.52 * size) * size + Math.floor(0.5 * size)] > 128, 'W = 1 - 2 + 1 = 0 on the island: light');
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [O, O, H, H, I, I] }), r.data, 'the whole motif twice: the motif');
});

test('the same polygon listed twice and three times: W = 2, 3, still dark, the same texture', () => {
  const O = ngon(0.55, 0.5, 0.33, 44), H = asHole(star(0.55, 0.5, 0.2, 6, 0.5)), C = crescent(0.3, 0.86, 0.12, 14, 2.2);
  const lat = { origin: [0.1, -0.2], e1: [1.2, 0.15], e2: [0.35, 0.95] }, size = 80, range = 0.07;
  const once = bakeSDF({ ...lat, size, range, polys: [O, H, C] });
  assert.deepEqual(bakeSDF({ ...lat, size, range, polys: [O, O, H, H, C, C] }), once, 'everything twice');
  assert.deepEqual(bakeSDF({ ...lat, size, range, polys: [O, H, C, C, O, H, O, H, C] }), once, 'everything three times');
  assert.deepEqual(bakeSDF({ ...lat, size, range, polys: [O, H, C, C, C, C] }), once, 'one of them four times');
  assert.deepEqual(bakeSDF({ ...lat, size, range, polys: [O, H, ...Array(300).fill(C)] }), once, 'one of them 300 times');
  assert.deepEqual(bakeSDF({ ...lat, size, range, polys: [...Array(256).fill(O), ...Array(256).fill(H), C] }), once, 'the ring 256 times (no counter of a byte)');
  // a copy that starts at another vertex is the same outline
  const rolled = (P, k) => ({ ...P, pts: P.pts.slice(k).concat(P.pts.slice(0, k)) });
  assert.deepEqual(bakeSDF({ ...lat, size, range, polys: [O, rolled(O, 7), H, rolled(H, 3), C, rolled(C, 11)] }), once, 'a copy that starts at another vertex');
  check('listed three times, against brute force', { ...lat, size, range, polys: [O, H, C, C, O, H, O, H, C] }, { samples: size * size });
});

test('the flag decides, not the direction: an outer polygon listed clockwise is as dark, a mirrored copy needs no re-ordering', () => {
  const O = ngon(0.45, 0.5, 0.3, 40), H = asHole(ngon(0.4, 0.5, 0.12, 24)), D = dart(0.7, 0.72, 0.45);
  const size = 64, range = 0.08;
  const good = check('listed the right way round', { ...UNIT, size, range, polys: [O, H, D] }, { samples: size * size });
  assert.ok(area(O) > 0 && area(H) < 0 && area(D) > 0 && area(turned(O)) < 0 && area(turned(H)) > 0);
  // WHAT HAPPENS with an outer polygon listed clockwise by mistake: nothing. It is dark inside all the same.
  const wrong = bakeSDF({ ...UNIT, size, range, polys: [turned(O), H, D] });
  assertSame(wrong, good.data, 'the outer polygon clockwise');
  assert.ok(wrong[Math.floor(0.75 * size) * size + Math.floor(0.45 * size)] < 128, 'inside the clockwise polygon: dark');
  assert.ok(wrong[Math.floor(0.5 * size) * size + Math.floor(0.4 * size)] > 128, 'in its hole: light');
  assertSame(bakeSDF({ ...UNIT, size, range, polys: [O, turned(H), D] }), good.data, 'the hole counter-clockwise');
  assertSame(bakeSDF({ ...UNIT, size, range, polys: [turned(O), turned(H), turned(D)] }), good.data, 'all three the wrong way round');
  check('all three the wrong way round, against brute force', { ...UNIT, size, range, polys: [turned(O), turned(H), turned(D)] }, { samples: size * size });
  // a mirrored copy of the motif, its points in the motif's order (so every polygon runs the other way)
  const mirror = (P) => ({ ...P, pts: P.pts.map(([x, y]) => [1 - x, y]) });
  const lazy = bakeSDF({ ...UNIT, size, range, polys: [O, H, D].map(mirror) });
  const careful = bakeSDF({ ...UNIT, size, range, polys: [O, H, D].map(mirror).map(turned) });
  assertSame(lazy, careful, 'a mirrored copy, re-ordered or not');
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    if (Math.abs(lazy[j * size + (size - 1 - i)] - good.data[j * size + i]) > 1) assert.fail(`the mirror image of the texture, texel (${i}, ${j})`);
  }
  // no flag at all is an outer polygon
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [{ pts: O.pts }, H, { pts: D.pts }] }), good.data, 'hole left out');
});

test('lattices: square, skew, hexagonal, mirrored (det < 0), tall, far from the origin: 3000 random texels each', (t) => {
  const lattices = [
    ['square', [0, 0], [1, 0], [0, 1]],
    ['skew', [0.3, -0.2], [1.3, 0.2], [0.45, 0.85]],
    ['hexagonal', [0, 0], [1, 0], [-0.5, Math.sqrt(3) / 2]],
    ['mirrored', [-0.4, 0.1], [0.2, 1.1], [1.3, -0.1]],
    ['tall', [0, 0], [0.4, 0], [0.1, 1.7]],
    ['far away', [1234.5, -987.25], [0.9, -0.3], [0.2, 0.7]],
    ['mirrored and skew', [5, 5], [-0.9, -0.2], [-0.8, 0.5]],
  ];
  const size = 200;
  for (const [name, origin, e1, e2] of lattices) {
    const det = e1[0] * e2[1] - e1[1] * e2[0];
    assert.equal(det < 0, name.startsWith('mirrored'), `${name}: det ${det}`);
    const k = 0.3 * Math.sqrt(Math.abs(det));
    const at = (s, u) => [origin[0] + s * e1[0] + u * e2[0], origin[1] + s * e1[1] + u * e2[1]];
    const [ax, ay] = at(0.3, 0.3), [bx, by] = at(0.72, 0.4), [cx, cy] = at(0.4, 0.75), [dx, dy] = at(1, 0.15), [fx, fy] = at(0.02, 0.98);
    const polys = [
      ngon(ax, ay, 0.55 * k, 36), asHole(ngon(ax, ay, 0.25 * k, 18, 0.7)),
      dart(bx - 0.3 * k, by - 0.3 * k, 1.1 * k),
      crescent(cx, cy, 0.5 * k, 20, 1.1),
      rect(dx - 0.4 * k, dy - 0.3 * k, dx + 0.4 * k, dy + 0.3 * k),      // across the border s = 1
      star(fx, fy, 0.5 * k, 7, 0.45),                                    // across the corner (0, 1)
    ];
    const range = 0.12 * k;
    const r = check(name, { origin, e1, e2, size, range, polys }, { samples: 3000, seed: 7 + name.length });
    assert.ok(r.band > 250 && r.dark > 120 && r.dark < 2700, `${name}: ${r.band} texels in the band, ${r.dark} dark of 3000`);
    t.diagnostic(`${name}: det ${det.toFixed(3)}, ${r.band} of 3000 texels in the band, worst rounding ${r.worst.toFixed(4)} of a step`);
    // the same cell with its two vectors swapped is the same picture transposed
    const swapped = bakeSDF({ origin, e1: e2, e2: e1, size, range, polys });
    let diff = 0;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const d = Math.abs(swapped[i * size + j] - r.data[j * size + i]);
      if (d > 1) assert.fail(`${name}: swapping e1 and e2 must transpose the texture, texel (${i}, ${j})`);
      if (d) diff++;
    }
    assert.ok(diff <= 0.002 * size * size, `${name}: transposed, ${diff} texels a step apart`);
  }
});

test('sixty random scenes on random lattices: every texel against brute force', (t) => {
  const rnd = prng(20261113);
  let texels = 0, band = 0, worst = 0, mirrored = 0;
  for (let c = 0; c < 60; c++) {
    const phi = rnd() * TAU, psi = ((35 + 110 * rnd()) * Math.PI) / 180 * (rnd() < 0.5 ? -1 : 1);
    const l1 = 0.5 + 1.5 * rnd(), l2 = 0.5 + 1.5 * rnd();
    const e1 = [l1 * Math.cos(phi), l1 * Math.sin(phi)], e2 = [l2 * Math.cos(phi + psi), l2 * Math.sin(phi + psi)];
    const origin = [10 * rnd() - 5, 10 * rnd() - 5];
    const size = 24 + Math.floor(rnd() * 49);
    const texel = (l1 + l2) / (2 * size);
    const range = texel * (rnd() < 0.15 ? 20 + 40 * rnd() : 0.3 + 6.7 * rnd());
    const polys = [], count = 2 + Math.floor(rnd() * 6);
    for (let q = 0; q < count; q++) {
      const s = -0.4 + 1.8 * rnd(), u = -0.4 + 1.8 * rnd();
      const cx = origin[0] + s * e1[0] + u * e2[0], cy = origin[1] + s * e1[1] + u * e2[1];
      const R = (0.05 + 0.55 * rnd()) * Math.min(l1, l2), n = 3 + Math.floor(rnd() * 26), ph = rnd() * TAU;
      const pts = [];
      for (let k = 0; k < n; k++) { const a = ph + (TAU * (k + 0.8 * rnd())) / n, rr = R * (0.35 + 0.65 * rnd()); pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
      if (rnd() < 0.5) pts.reverse();
      const P = { pts: rnd() < 0.5 ? Float64Array.from(pts.flat()) : pts, hole: rnd() < 0.2 };
      polys.push(P);
      if (rnd() < 0.15) polys.push(P);
    }
    if (e1[0] * e2[1] - e1[1] * e2[0] < 0) mirrored++;
    const r = check(`scene ${c} (size ${size}, range ${(range / texel).toFixed(2)} texels, ${polys.length} polygons)`, { origin, e1, e2, size, range, polys }, { samples: size * size });
    texels += r.n; band += r.band; worst = Math.max(worst, r.worst);
  }
  assert.ok(mirrored > 15 && mirrored < 45, `both orientations of the lattice were drawn: ${mirrored} of 60 mirrored`);
  assert.ok(band > 0.3 * texels, 'most scenes have a real band');
  t.diagnostic(`${texels} texels, ${band} in the band, ${mirrored} mirrored lattices, worst rounding ${worst.toFixed(4)} of a step`);
});

// ---------------------------------------------------------------------------------------------------------------
// What the renderer leans on
// ---------------------------------------------------------------------------------------------------------------

test('a periodic pattern: no seam at s = 0 | 1 and t = 0 | 1, and the cell may start anywhere', () => {
  const origin = [0.17, -0.05], e1 = [1.3, 0.2], e2 = [0.4, 0.9], size = 96, range = 0.08;
  // a crescent across the corner of the cell, a dart across the seam s = 0 | 1 (at origin + e1 + e2 / 2), a star with a
  // hole in the middle of the cell, and all their translates near the cell
  const motif = [crescent(0.15, -0.02, 0.33, 22, 0.5), dart(1.67 - 0.075, 0.6 - 0.06, 0.25), star(0.17 + 0.65 + 0.2, -0.05 + 0.1 + 0.45, 0.2, 5, 0.42), asHole(ngon(0.17 + 0.65 + 0.2, -0.05 + 0.1 + 0.45, 0.06, 12))];
  const polys = [];
  for (let m = -2; m <= 2; m++) for (let n = -2; n <= 2; n++) for (const P of motif) polys.push(shifted(P, m * e1[0] + n * e2[0], m * e1[1] + n * e2[1]));
  const spec = { origin, e1, e2, size, range, polys };
  const r = check('periodic', spec, { samples: size * size });
  const data = r.data;
  assert.ok(r.dark > 0.1 * r.n && r.band > 0.3 * r.n, 'a real pattern');
  // the signed distance changes by at most the step between two samples: also from the last column to the first
  const la = Math.hypot(...e1) / size, lb = Math.hypot(...e2) / size;
  const stepA = (127 * la) / range + 1 + 1e-6, stepB = (127 * lb) / range + 1 + 1e-6;
  let seamA = 0, seamB = 0;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const v = data[j * size + i], right = data[j * size + ((i + 1) % size)], up = data[((j + 1) % size) * size + i];
    if (Math.abs(right - v) > stepA) assert.fail(`a jump of ${right - v} from column ${i} to ${(i + 1) % size} in row ${j}`);
    if (Math.abs(up - v) > stepB) assert.fail(`a jump of ${up - v} from row ${j} to ${(j + 1) % size} in column ${i}`);
    if (i === size - 1) seamA = Math.max(seamA, Math.abs(right - v));
    if (j === size - 1) seamB = Math.max(seamB, Math.abs(up - v));
  }
  assert.ok(seamA > 0 && seamB > 0, 'the pattern does cross both seams');
  // the same pattern baked from a cell that starts 37 texels along e1 and 61 along e2 is the same texture, rolled
  const k1 = 37, k2 = 61;
  const other = bakeSDF({ ...spec, origin: [origin[0] + (k1 / size) * e1[0] + (k2 / size) * e2[0], origin[1] + (k1 / size) * e1[1] + (k2 / size) * e2[1]] });
  const rolled = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) rolled[j * size + i] = data[((j + k2) % size) * size + ((i + k1) % size)];
  assertSame(other, rolled, 'the cell moved by (37, 61) texels');
  // the shader's fetch against the exact distance, anywhere in the plane (the pattern repeats, the fetch wraps)
  const ref = prep(polys), rnd = prng(99), slack = (la + lb) / 2 + range / 127;
  let tested = 0;
  for (let q = 0; q < 4000; q++) {
    const s = 3 * rnd() - 1, u = 3 * rnd() - 1, fs = s - Math.floor(s), fu = u - Math.floor(u);
    const sd = reference(ref, origin[0] + fs * e1[0] + fu * e2[0], origin[1] + fs * e1[1] + fu * e2[1]);
    if (Math.abs(sd) > range - (la + lb)) continue;
    tested++;
    const got = sdfDistance(sdfSample(data, size, s, u), range);
    if (Math.abs(got - sd) > slack) assert.fail(`sdfSample at (${s}, ${u}) decodes to ${got}, the distance is ${sd}`);
  }
  assert.ok(tested > 800, `${tested} fetches in the band`);
  // right on the seams the fetch is continuous and right
  for (let q = 0; q < 300; q++) {
    const u = rnd();
    for (const [sa, ua, sb, ub] of [[1e-7, u, 1 - 1e-7, u], [u, 1e-7, u, 1 - 1e-7]]) {
      const a = sdfSample(data, size, sa, ua), b = sdfSample(data, size, sb, ub);
      assert.ok(Math.abs(a - b) < 1e-3, 'continuous across the seam');
      const sd = reference(ref, origin[0] + sa * e1[0] + ua * e2[0], origin[1] + sa * e1[1] + ua * e2[1]);
      if (Math.abs(sd) <= range - (la + lb)) assert.ok(Math.abs(sdfDistance(a, range) - sd) <= slack, 'and it is the distance there');
    }
  }
});

test('a thin feature: a strip 1.5 texels wide keeps its tone along its centre line, at any angle', () => {
  const size = 64, h = 1 / size, range = 4 * h, w = 0.75 * h;
  const strip = (cx, cy, deg, half) => {
    const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    return { pts: [[-half, -w], [half, -w], [half, w], [-half, w]].map(([p, q]) => [cx + p * dx + q * nx, cy + p * dy + q * ny]), hole: false, dx, dy };
  };
  // along a row of texel centres: the texels of the row are 0.75 texels deep, the rows next to it 0.25 texels out
  let S = strip(0.5, 20.5 * h, 0, 0.35), data = bakeSDF({ ...UNIT, size, range, polys: [S] });
  for (let i = 14; i < 50; i++) {
    assert.equal(data[20 * size + i], Math.round(128 - (127 * 0.75) / 4), 'the row under the strip');
    assert.equal(data[19 * size + i], Math.round(128 + (127 * 0.25) / 4), 'the row below it');
    assert.equal(data[21 * size + i], Math.round(128 + (127 * 0.25) / 4), 'the row above it');
  }
  // between two rows: both are 0.25 texels deep
  S = strip(0.5, 21 * h, 0, 0.35); data = bakeSDF({ ...UNIT, size, range, polys: [S] });
  for (let i = 14; i < 50; i++) {
    assert.equal(data[20 * size + i], Math.round(128 - (127 * 0.25) / 4), 'the row below the centre line');
    assert.equal(data[21 * size + i], Math.round(128 - (127 * 0.25) / 4), 'the row above it');
  }
  // at any angle the fetch on the centre line is dark: the mean of |offset| over the four texels is at most half a
  // texel, so the filtered distance is at most -0.25 texels there (120.06 as a byte, the rounding adds half a step)
  let worst = 0;
  for (const deg of [0, 7, 17, 30, 45, 60, 71.57, 83, 90, 118, 135, 161]) {
    for (const [cx, cy] of [[0.5, 0.5], [0.5 + 0.37 * h, 0.5 - 0.21 * h], [0.5 + 0.5 * h, 0.5 + 0.5 * h]]) {
      S = strip(cx, cy, deg, 0.3); data = bakeSDF({ ...UNIT, size, range, polys: [S] });
      check(`strip at ${deg} degrees`, { ...UNIT, size, range, polys: [S] }, { samples: 600, seed: 3 });
      for (let q = 0; q <= 240; q++) {
        const p = (0.3 - 3 * h) * (q / 120 - 1), v = sdfSample(data, size, cx + p * S.dx, cy + p * S.dy);
        if (v > worst) worst = v;
        if (!(v < 121)) assert.fail(`a strip at ${deg} degrees reads ${v} on its centre line`);
      }
    }
  }
  assert.ok(worst > 100, `the worst fetch was ${worst}`);
  // a hairline thinner than the rows are apart may hold no texel centre, but the distances to it are still exact
  const hair = { pts: [[0.2, 0.41], [0.8, 0.59], [0.8, 0.59 + 0.4 * h], [0.2, 0.41 + 0.4 * h]], hole: false };
  const thin = check('a hairline 0.4 texels thick', { ...UNIT, size, range, polys: [hair] }, { samples: size * size });
  assert.ok(thin.dark < 60 && thin.band > 300, `${thin.dark} texel centres fell in the hairline, ${thin.band} texels in its band`);
});

test('the range: a fraction of a texel, and larger than the whole cell', () => {
  const polys = [ngon(0.4, 0.45, 0.25, 30), asHole(dart(0.28, 0.33, 0.4)), star(0.82, 0.8, 0.13)];
  const size = 60, h = 1 / size;
  const tiny = check('range 0.3 texels', { ...UNIT, size, range: 0.3 * h, polys }, { samples: size * size });
  assert.ok(tiny.band > 20 && tiny.band < 0.2 * tiny.n, `only the texels on the outline are in the band: ${tiny.band}`);
  let sat = 0;
  for (const v of tiny.data) if (v === 1 || v === 255) sat++;
  assert.ok(sat > 0.8 * tiny.n, 'the rest is saturated');
  const huge = check('range 3 cells', { ...UNIT, size, range: 3, polys }, { samples: size * size });
  assert.equal(huge.band, huge.n, 'every texel is in the band');
  for (const v of huge.data) assert.ok(v > 100 && v < 160, 'and the bytes stay near 128');
  for (const range of [1e-6, 0.004, 0.05, 0.4, 40]) check(`range ${range}`, { ...UNIT, size: 40, range, polys }, { samples: 1600 });
  // the texture does not depend on the unit of length
  const k = 1e-9, small = bakeSDF({ origin: [0, 0], e1: [k, 0], e2: [0, k], size, range: 0.05 * k, polys: polys.map((P) => ({ ...P, pts: P.pts.map(([x, y]) => [k * x, k * y]) })) });
  assertSame(small, bakeSDF({ ...UNIT, size, range: 0.05, polys }), 'the same scene in nanometres');
  const K = 1e12, big = bakeSDF({ origin: [0, 0], e1: [K, 0], e2: [0, K], size, range: 0.05 * K, polys: polys.map((P) => ({ ...P, pts: P.pts.map(([x, y]) => [K * x, K * y]) })) });
  assertSame(big, bakeSDF({ ...UNIT, size, range: 0.05, polys }), 'and in units of 1e12');
});

test('input that breaks the rules: repeated points, polygons without area, nothing at all', () => {
  const A = dart(0.2, 0.25, 0.9), size = 48, range = 0.07;
  const base = bakeSDF({ ...UNIT, size, range, polys: [A] });
  const closed = { ...A, pts: [...A.pts, A.pts[0]] };
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [closed] }), base, 'the first point repeated as the last');
  const stutter = { ...A, pts: [A.pts[0], A.pts[0], A.pts[1], A.pts[2], A.pts[2], A.pts[2], A.pts[3], A.pts[0], A.pts[0]] };
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [stutter] }), base, 'points that repeat');
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [flatPts(stutter)] }), base, 'the same as a Float64Array');
  const nothing = [
    { pts: [] }, { pts: [[0.5, 0.5]] }, { pts: [[0.1, 0.1], [0.9, 0.8]] },                       // too few points
    { pts: [[0.1, 0.9], [0.5, 0.5], [0.9, 0.1]] }, { pts: [[0.2, 0.2], [0.8, 0.2], [0.5, 0.2], [0.3, 0.2]] },   // on one line
    { pts: [[0.3, 0.3], [0.3, 0.3], [0.3, 0.3], [0.3, 0.3]] }, { pts: [[0.1, 0.5], [0.9, 0.6], [0.1, 0.5], [0.9, 0.6]] },   // one point; there and back
    { pts: new Float64Array(0), hole: true }, { pts: new Float64Array([0.5, 0.5, 0.6, 0.6]) },
  ];
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [...nothing, A, ...nothing] }), base, 'polygons without area bound nothing and are no outline');
  const blank = bakeSDF({ ...UNIT, size, range, polys: [] });
  assert.ok(blank.every((v) => v === 255), 'no polygons: all light, all far');
  assert.deepEqual(bakeSDF({ ...UNIT, size, range }), blank, 'polys left out');
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: nothing }), blank, 'only polygons without area');
  // polygons far from the cell change nothing; one that covers the cell with room to spare makes it all dark
  assert.deepEqual(bakeSDF({ ...UNIT, size, range, polys: [A, ngon(5, 5, 1), ngon(-3, 0.5, 0.8), rect(0.2, 1.5, 0.9, 2.5), rect(0.2, -2, 0.9, -0.5)] }), base, 'polygons out of reach');
  assert.ok(bakeSDF({ ...UNIT, size, range, polys: [rect(-1, -1, 2, 2)] }).every((v) => v === 1), 'under one large polygon: all dark, all deep');
  assert.ok(bakeSDF({ ...UNIT, size, range, polys: [rect(-1, -1, 2, 2), asHole(rect(-0.5, -0.5, 1.5, 1.5))] }).every((v) => v === 255), 'in its hole: all light');
  check('a polygon larger than the cell, an edge across it', { ...UNIT, size, range, polys: [rect(-1, -1, 0.5, 2)] }, { samples: size * size });
  check('the cell inside a ring', { ...UNIT, size, range, polys: [ngon(0.5, 0.5, 3, 80), asHole(ngon(0.5, 0.5, 0.72, 80))] }, { samples: size * size });
  // one texel, and a size that is no power of two
  const one = bakeSDF({ ...UNIT, size: 1, range: 1, polys: [rect(0.25, 0.25, 1.5, 1.5)] });
  assert.equal(one.length, 1);
  assert.equal(one[0], Math.round(128 - 127 * 0.25), 'the centre (0.5, 0.5) is 0.25 inside');
  check('size 37', { ...UNIT, size: 37, range, polys: [A] }, { samples: 37 * 37 });
});

test('polygons that overlap without coinciding: still dark, but the edge inside the dark stays an outline (documented)', () => {
  const A = ngon(0.4, 0.5, 0.25, 48), B = ngon(0.62, 0.5, 0.25, 48), size = 64, range = 0.06;
  const r = check('two overlapping discs', { ...UNIT, size, range, polys: [A, B] }, { samples: size * size });
  const at = (x, y) => r.data[Math.floor(y * size) * size + Math.floor(x * size)];
  assert.equal(at(0.27, 0.5), 1, 'deep in the first disc');
  assert.ok(at(0.51, 0.5) < 128, 'the lens is dark (W = 2)');
  // the outline of B runs through A at x = 0.37: dark on both sides, and the byte comes up to 128 on it
  assert.ok(at(0.335, 0.5) < 128 && at(0.4, 0.5) < 128, 'dark either side of the edge inside');
  assert.ok(at(0.371, 0.5) > 118 && at(0.371, 0.5) <= 128, `on that edge the texture reads ${at(0.371, 0.5)}: a hairline in the print`);
});

test('arguments that make no sense throw', () => {
  const ok = { ...UNIT, size: 16, range: 0.1, polys: [ngon(0.5, 0.5, 0.3, 12)] };
  assert.ok(bakeSDF(ok) instanceof Uint8Array);
  for (const size of [0, -4, 1.5, '16', NaN, Infinity, MAX_SIZE + 1, undefined]) assert.throws(() => bakeSDF({ ...ok, size }), RangeError, `size ${size}`);
  for (const range of [0, -1, NaN, Infinity, undefined, null]) assert.throws(() => bakeSDF({ ...ok, range }), RangeError, `range ${range}`);
  assert.throws(() => bakeSDF({ ...ok, e2: [2, 0] }), RangeError, 'e1 and e2 on one line');
  assert.throws(() => bakeSDF({ ...ok, e1: [0, 0] }), RangeError, 'e1 = 0');
  assert.throws(() => bakeSDF({ ...ok, e1: [NaN, 0] }), RangeError, 'e1 not a number');
  assert.throws(() => bakeSDF({ ...ok, origin: [0, Infinity] }), RangeError, 'origin not finite');
  assert.throws(() => bakeSDF({ ...ok, e1: undefined }), TypeError, 'e1 missing');
  assert.throws(() => bakeSDF({ ...ok, polys: 7 }), TypeError, 'polys no list');
  assert.throws(() => bakeSDF({ ...ok, polys: [{ pts: [[0, 0], [1, NaN], [1, 1]] }] }), TypeError, 'a point that is not a number');
  assert.throws(() => bakeSDF({ ...ok, polys: [{ pts: [[0, 0], [1], [1, 1]] }] }), TypeError, 'a point with one coordinate');
  assert.throws(() => bakeSDF({ ...ok, polys: [{ pts: [[0, 0], null, [1, 1]] }] }), TypeError, 'a point that is missing');
  assert.throws(() => bakeSDF({ ...ok, polys: [{ pts: new Float64Array([0, 0, 1, 0, 1]) }] }), TypeError, 'an odd number of coordinates');
  assert.throws(() => bakeSDF({ ...ok, polys: [null] }), TypeError, 'a polygon that is missing');
  assert.throws(() => bakeSDF({ ...ok, polys: [{ pts: 3 }] }), TypeError, 'points that are no list');
  assert.throws(() => bakeSDF(), RangeError, 'no arguments');
});

test('with src/shapes.js: the texture baked from copiesIn is the print\'s own tone and margin, byte for byte', async (t) => {
  // The production path of a shape print: makeShapePrint -> copiesIn(the cell's box widened by the range) -> bakeSDF.
  // shapes.js has its own exact distance to the nearest outline (margin) and its own tone, with no code from sdf.js.
  let shapes, groups;
  try { shapes = await import('../src/shapes.js'); groups = await import('../src/groups.js'); } catch (e) { t.skip(`src/shapes.js cannot be loaded: ${String(e.message).split('\n')[0]}`); return; }
  if (typeof shapes.makeShapePrint !== 'function' || typeof shapes.copiesIn !== 'function') { t.skip('src/shapes.js has no makeShapePrint and copiesIn'); return; }
  const size = 72;
  let texels = 0, off = 0, done = 0;
  for (const id of ['o', '22x', '*x', '4*2', '333', '*632']) {
    const group = groups.BY_ID[id], tile = Math.sqrt(group.domainArea), { e1, e2 } = group;
    // a crescent with an eye, at a place and a turn of no symmetry (its copies may well run into each other: the
    // tone and the distance to the nearest outline are defined all the same, by both modules alike)
    const ax = group.center[0] + 0.13 * tile, ay = group.center[1] + 0.07 * tile, R = 0.3 * tile;
    const body = crescent(ax, ay, R, 20, 0.7), eye = asHole(ngon(ax + 0.68 * R * Math.cos(0.85), ay + 0.68 * R * Math.sin(0.85), 0.1 * R, 14));
    let print;
    try { print = shapes.makeShapePrint(group, { key: 'test', shapes: [body, eye] }); } catch (e) { t.diagnostic(`${id}: makeShapePrint refused the motif (${String(e.message).split('\n')[0]})`); continue; }
    if (typeof print.margin !== 'function' || typeof print.tone !== 'function') { t.skip('a shape print has no margin(x, y) and tone(x, y)'); return; }
    const origin = [group.center[0] - (e1[0] + e2[0]) / 2, group.center[1] - (e1[1] + e2[1]) / 2];
    const range = (6 * Math.min(Math.hypot(...e1), Math.hypot(...e2))) / size;
    const xs = [0, e1[0], e2[0], e1[0] + e2[0]].map((v) => origin[0] + v), ys = [0, e1[1], e2[1], e1[1] + e2[1]].map((v) => origin[1] + v);
    const polys = shapes.copiesIn(print, [Math.min(...xs) - range, Math.min(...ys) - range, Math.max(...xs) + range, Math.max(...ys) + range]);
    assert.ok(polys.length >= 2 * group.reps.length, `${id}: ${polys.length} polygons reach the cell`);
    const data = bakeSDF({ origin, e1, e2, size, range, polys });
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const [x, y] = centre({ origin, e1, e2, size }, i, j), m = print.margin(x, y), sd = print.tone(x, y) ? -m : m;
      const want = Math.round(128 + 127 * Math.max(-1, Math.min(1, sd / range))), got = data[j * size + i];
      if (Math.abs(want - got) > 1) assert.fail(`${id}: texel (${i}, ${j}) reads ${got}; the print's margin ${m} and tone give ${want}`);
      if (want !== got) off++;
    }
    texels += size * size; done++;
  }
  if (done < 4) { t.skip(`only ${done} of 6 groups took the test motif`); return; }
  assert.ok(off <= 0.002 * texels, `${off} of ${texels} texels a step off`);
  t.diagnostic(`${done} groups, ${texels} texels, ${off} a step off the print's own distance`);
});

test('speed: about 6000 edges at size 1024 bake in a blink (a loose floor: the method is linear in the band)', (t) => {
  // 64 wobbly blobs of 94 edges: the outline of a print that fills the cell
  const rnd = prng(4242), polys = [];
  for (let b = 0; b < 64; b++) {
    const cx = ((b % 8) + 0.5 + 0.2 * (rnd() - 0.5)) / 8, cy = (Math.floor(b / 8) + 0.5 + 0.2 * (rnd() - 0.5)) / 8;
    const n = 94, ph = rnd() * TAU, lobes = 2 + Math.floor(rnd() * 4), amp = 0.1 + 0.25 * rnd(), pts = new Float64Array(2 * n);
    for (let k = 0; k < n; k++) { const a = (TAU * k) / n, r = 0.045 * (1 + amp * Math.cos(lobes * a + ph)); pts[2 * k] = cx + r * Math.cos(a); pts[2 * k + 1] = cy + r * Math.sin(a); }
    polys.push({ pts, hole: false });
  }
  const edges = polys.reduce((s, P) => s + P.pts.length / 2, 0);
  assert.equal(edges, 6016);
  const spec = { ...UNIT, size: 1024, range: 8 / 1024, polys };
  let best = Infinity, data = null;
  for (let run = 0; run < 4; run++) { const t0 = performance.now(); data = bakeSDF(spec); best = Math.min(best, performance.now() - t0); }
  let dark = 0;
  for (const v of data) if (v < 128) dark++;
  assert.ok(dark > 0.3 * data.length && dark < 0.5 * data.length, `the blobs cover ${(100 * dark / data.length).toFixed(1)} % of the cell`);
  t.diagnostic(`${edges} edges, size 1024, range 8 texels: ${best.toFixed(1)} ms (the best of 4)`);
  assert.ok(best < 500, `a bake took ${best.toFixed(1)} ms`);
  const r = check('the speed scene', spec, { samples: 3000, seed: 11 });
  assert.ok(r.band > 500, `${r.band} of 3000 texels in the band`);
});
