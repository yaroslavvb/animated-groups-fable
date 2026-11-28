// print3d.test.js — the baked print against the engine's own commas (node --test test/print3d.test.js).
//
// The claim tested: for a point X of the pattern (a point of the base tile, or its image under any motion of the
// group), the texture that bake() made, read at chartOf(X), is dark exactly when X lies inside a comma of the
// pattern, except within two texels of an outline.
// "Inside a comma of the pattern" is decided here WITHOUT print3d's ways: the group is enumerated afresh from the
// engine's side pairings (centredFor(state).A.maps, a breadth-first walk of this file, not tilesPSU), the point is
// carried by every motion that could bring it into one of the engine's outlines (centredFor(state).shapes), and the
// point-in-polygon test is made in the Klein model, where the outline's geodesic edges are straight (the bake lays
// chords of the Poincaré disc: the difference is far under a texel).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrint3d, RANGE_TEXELS, PRINT_SIZE, PRINT_SIZE_DRAG } from '../src/print3d.js';
import { FAMILIES, normalizeFamilyKey, centredFor, defaultCommas, recut, retiePrint } from '../../two-features-two-handles/src/handles.js';
import { orbifoldMesh } from '../src/pillow.js';
import { sdfSample } from '../../the-folding/src/sdf.js';

// the page's state for four cone points (state.js stateFor does the same; kept here so this file stands alone)
function stateFor(text, over = {}) {
  const k = normalizeFamilyKey(text), fam = k && FAMILIES[k];
  if (!fam || (fam.mode !== 'cones' && fam.mode !== 'pillow')) return null;
  const perm = fam.defaultM.split('').map(Number);
  return { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: 0, tau: 0, thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)), print: null, ...over };
}

function rng(seed) {                                  // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mul = (A, B) => { const C = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[3 * r + c] = A[3 * r] * B[c] + A[3 * r + 1] * B[3 + c] + A[3 * r + 2] * B[6 + c]; return C; };
const app = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
/** Even-odd point in polygon; poly = [[x, y], ...]. */
function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const flatOf = (kind) => kind === 'E';
/** A point as the plane of straight lines sees it: Klein (x / z, y / z); the plane itself for 2222. */
const straight = (p) => [p[0] / p[2], p[1] / p[2]];
/** How far a motion moves the middle `mid`: hyperbolic distance, or Euclidean. */
function moved(kind, g, mid) {
  const q = app(g, mid);
  if (flatOf(kind)) return Math.hypot(q[0] - mid[0], q[1] - mid[1]);
  return Math.acosh(Math.max(1, q[2] * mid[2] - q[0] * mid[0] - q[1] * mid[1]));
}
/** Every motion of the group that moves `mid` by at most `radius`: a walk over the engine's side pairings. */
function groupNear(kind, maps, mid, radius, slack) {
  const key = (g) => g.map((x) => Math.round(x * 1e5)).join(',');
  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1], seen = new Map([[key(I), I]]), queue = [I];
  while (queue.length) {
    const e = queue.pop();
    for (const m of maps) {
      const h = mul(e, m);
      if (moved(kind, h, mid) > radius + slack) continue;
      const k = key(h);
      if (!seen.has(k)) { seen.set(k, h); queue.push(h); }
    }
    assert.ok(seen.size < 200000, 'the walk over the group ran away');
  }
  return [...seen.values()].filter((g) => moved(kind, g, mid) <= radius);
}

/** The texture as the shader reads it: the value at a chart point (128 on an outline, under it in a comma). */
function reader(print) {
  const { origin, e1, e2, size } = print, det = e1[0] * e2[1] - e1[1] * e2[0];
  return (u, v) => sdfSample(print.data, size, (e2[1] * (u - origin[0]) - e2[0] * (v - origin[1])) / det, (-e1[1] * (u - origin[0]) + e1[0] * (v - origin[1])) / det);
}
const NEAR = (127 * 2) / RANGE_TEXELS;               // |value - 128| under this: within two texels of an outline

/**
 * from = { state, Q }: the truth is the pattern of ANOTHER state (the one before a flip), in whose frame the points
 * are taken; they are carried by Q into the frame of `state` before they are handed to chartOf.
 */
function check(label, state, { size, seed, nPoints = 500, from = null, make = undefined }) {
  const c = centredFor(from ? from.state : state), kind = c.D.G.kind, flat = flatOf(kind), rand = rng(seed);
  const carry = from ? (P) => app(from.Q, P) : (P) => P;
  const mid = flat ? [0, 0, 1] : [0, 0, 1];
  const distMid = (p) => (flat ? Math.hypot(p[0], p[1]) : Math.acosh(Math.max(1, p[2])));
  // the outlines, straightened, with their boxes and their reach from the middle
  const shapes = c.shapes.map((sh) => {
    const poly = sh.pts.map(straight);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { poly, box: [x0, y0, x1, y1] };
  });
  const shapeReach = Math.max(...c.shapes.map((sh) => Math.max(...sh.pts.map(distMid))));
  const tileReach = Math.max(...c.D.verts.map(distMid));
  // every motion g with g X possibly inside an outline, for X in the tile: it moves the middle by at most tileReach + shapeReach
  const group = groupNear(kind, c.A.maps, mid, tileReach + shapeReach + 0.05, 2.5);
  const zCut = flat ? Infinity : Math.cosh(shapeReach + 0.01);
  const inside = (X) => {
    for (const g of group) {
      const Y = app(g, X);
      if (Y[2] > zCut) continue;
      const x = Y[0] / Y[2], y = Y[1] / Y[2];
      for (const sh of shapes) if (x >= sh.box[0] && x <= sh.box[2] && y >= sh.box[1] && y <= sh.box[3] && inPoly(sh.poly, x, y)) return true;
    }
    return false;
  };
  // random points of the base tile (the engine's D: a convex polygon in the straight model)
  const tile = c.D.verts.map(straight);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [x, y] of tile) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  const points = [];
  while (points.length < nPoints) {
    const x = bx0 + (bx1 - bx0) * rand(), y = by0 + (by1 - by0) * rand();
    if (!inPoly(tile, x, y)) continue;
    if (flat) points.push([x, y, 1]); else { const z = 1 / Math.sqrt(1 - x * x - y * y); points.push([x * z, y * z, z]); }
  }
  // the motions the images are taken under: any of the group that moves the middle by up to 4.5 (hyperbolic) / 7 (flat)
  const movers = groupNear(kind, c.A.maps, mid, flat ? 7 : 4.5, 2.5);
  assert.ok(movers.length > 12, `${label}: only ${movers.length} motions to take images under`);

  const p3 = createPrint3d(make), t0 = performance.now(), print = p3.bake(state, { size }), bakeMs = performance.now() - t0;
  assert.ok(print, `${label}: bake gave no print`);
  assert.equal(print.size, size);
  assert.equal(print.data.length, size * size);
  if (!flat) { assert.deepEqual(print.origin, [-1, -1]); assert.deepEqual(print.e1, [2, 0]); assert.deepEqual(print.e2, [0, 2]); }
  const { e1, e2 } = print;
  const texel = Math.max(Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1])) / size;
  assert.ok(Math.abs(print.range - RANGE_TEXELS * texel) < 1e-12, `${label}: the range is ${RANGE_TEXELS} texels`);
  const read = reader(print), nearBand = NEAR;

  const tri = new Float64Array(9);
  let tested = 0, near = 0, dark = 0, light = 0, wrong = 0, rMax = 0;
  const bad = [];
  for (let i = 0; i < points.length; i++) {
    const X = points[i], truth = inside(X);
    for (let image = 0; image < 2; image++) {
      const P = carry(image ? app(movers[Math.floor(rand() * movers.length)], X) : X);
      for (let k = 0; k < 9; k++) tri[k] = P[k % 3];
      const uv = p3.chartOf(tri);
      assert.ok(Number.isFinite(uv[0]) && Number.isFinite(uv[1]), `${label}: a chart point is not a number`);
      if (!flat) rMax = Math.max(rMax, Math.hypot(uv[0], uv[1]));
      const v = read(uv[0], uv[1]);
      if (Math.abs(v - 128) < nearBand) { near++; continue; }
      tested++;
      const got = v < 128;
      if (got) dark++; else light++;
      if (got !== truth) { wrong++; if (bad.length < 5) bad.push({ i, image, P: P.map((x) => +x.toFixed(5)), uv: [uv[0], uv[1]], v: +v.toFixed(1), truth }); }
    }
  }
  const total = 2 * points.length;
  console.log(`  ${label} (size ${size}): bake ${bakeMs.toFixed(1)} ms, ${print.info.polys} outlines / ${print.info.edges} edges` + (flat ? '' : `, ${print.info.tiles} tiles walked, fold reach ${print.info.reach.toFixed(2)}, baked to ${print.info.radius.toFixed(2)}, chart radius up to ${rMax.toFixed(3)}`) + `; ${tested} of ${total} read (${near} within two texels of an outline), ${dark} dark / ${light} light, ${wrong} wrong; group: ${group.length} motions for the direct test, ${movers.length} for the images`);
  assert.equal(wrong, 0, `${label}: the texture and the engine's outlines disagree at ${wrong} of ${tested} points, e.g. ${JSON.stringify(bad)}`);
  assert.ok(tested > 0.75 * total, `${label}: only ${tested} of ${total} points were far enough from an outline to count`);
  assert.ok(dark > 0.025 * total && light > 0.025 * total, `${label}: both tones must be met (${dark} dark, ${light} light)`);
  if (!flat) assert.ok(rMax <= Math.tanh(print.info.radius / 2) + 1e-6, `${label}: a chart point (disc radius ${rMax}) lies outside what was baked (radius ${print.info.radius})`);
  return { print, p3, bakeMs };
}

test('3333: the texture at chartOf(point) is the pattern (defaults, Twist 0.2)', () => {
  check('3333 defaults', stateFor('3333'), { size: PRINT_SIZE, seed: 11 });
  check('3333 Twist 0.2', stateFor('3333', { tw: 0.2 }), { size: PRINT_SIZE_DRAG, seed: 12 });
});

test('2345 (cut P2 Q3 | S5 R4, the engine\'s default pairing: orders [2, 3, 5, 4]): the same', () => {
  const st = stateFor('2345');
  assert.deepEqual(st.orders, [2, 3, 5, 4]);
  check('2345 defaults', st, { size: PRINT_SIZE, seed: 21 });
  check('2345 Twist 0.2', stateFor('2345', { tw: 0.2 }), { size: PRINT_SIZE_DRAG, seed: 22 });
});

test('2222: one lattice cell of the plane, chart point = plane point (defaults, Twist 0.2)', () => {
  const a = check('2222 defaults', stateFor('2222'), { size: PRINT_SIZE, seed: 31 });
  // the cell is one cell of the translation lattice 2 a, 2 b (area 4 at any Length and Twist), reduced
  const cell = (pr) => Math.abs(pr.e1[0] * pr.e2[1] - pr.e1[1] * pr.e2[0]);
  assert.ok(Math.abs(cell(a.print) - 4) < 1e-9, 'the cell of 2222 has area 4');
  const b = check('2222 Twist 0.2', stateFor('2222', { tw: 0.2 }), { size: PRINT_SIZE_DRAG, seed: 32 });
  assert.ok(Math.abs(cell(b.print) - 4) < 1e-9);
  const c = check('2222 Length 1.6, Twist -0.37', stateFor('2222', { L: 1.6, tw: -0.37 }), { size: PRINT_SIZE_DRAG, seed: 33 });
  const dot = c.print.e1[0] * c.print.e2[0] + c.print.e1[1] * c.print.e2[1], l1 = Math.hypot(...c.print.e1), l2 = Math.hypot(...c.print.e2);
  assert.ok(Math.abs(dot) <= 0.5 * l1 * l1 + 1e-9 && l1 <= l2 + 1e-9, 'the cell of the texture is a reduced basis');
});

test('other states: 2223 (a (2,2) pair on the loop), a long loop, a short loop with a large Twist', () => {
  check('2223 defaults', stateFor('2223'), { size: PRINT_SIZE_DRAG, seed: 41, nPoints: 250 });
  check('3333 Length 5.5, Twist -0.31', stateFor('3333', { L: 5.5, tw: -0.31 }), { size: PRINT_SIZE_DRAG, seed: 42, nPoints: 250 });
  check('2345 Length 1.8, Twist 0.45', stateFor('2345', { L: 1.8, tw: 0.45 }), { size: PRINT_SIZE_DRAG, seed: 43, nPoints: 250 });
  check('3333 Length 0.8 (two pillows on a long neck)', stateFor('3333', { L: 0.8 }), { size: PRINT_SIZE_DRAG, seed: 44, nPoints: 250 });
  // Length 7, Twist -1/2: two cone points stand close above one another. A fold that only tries the motions that move
  // the middle least never brings a far triangle home here (it reached 7.16; the tile's own points lie within 2.3).
  const far = check('3333 Length 7, Twist -0.5', stateFor('3333', { L: 7, tw: -0.5 }), { size: PRINT_SIZE_DRAG, seed: 45, nPoints: 200 });
  assert.ok(far.print.info.reach < 2.6, `the fold reaches ${far.print.info.reach} at Length 7, Twist -0.5`);
  // the chart centred on the pair frame's own origin (createPrint3d({ centre: 'pair' })) is the same print, laid wider
  const own = check('3333 defaults, the pair frame\'s own disc', stateFor('3333'), { size: PRINT_SIZE_DRAG, seed: 46, nPoints: 200, make: { centre: 'pair' } });
  assert.deepEqual(own.print.info.centre, [0, 0, 1]);
});

test('overlapping commas are baked as their union: no outline of one comma shows inside another', () => {
  // 3333 at Length 0.7 (the family's own is 2.63): the commas ride rigid with their cone points and overlap
  const st = stateFor('3333', { L: 0.7 }), c = centredFor(st), p3 = createPrint3d(), print = p3.bake(st, { size: PRINT_SIZE_DRAG }), read = reader(print);
  assert.ok(print.info.layers >= 2, `overlapping outlines are baked in layers (${print.info.layers})`);
  const group = groupNear('H', c.A.maps, [0, 0, 1], 4, 2.5), tri = new Float64Array(9);
  const dH = (p, q) => Math.acosh(Math.max(1, p[2] * q[2] - p[0] * q[0] - p[1] * q[1]));
  const klein = c.shapes.map((sh) => sh.pts.map(straight));
  const isId = (g) => Math.abs(g[0] - 1) + Math.abs(g[4] - 1) + Math.abs(g[8] - 1) < 1e-9;
  let deep = 0, bad = 0, worst = 0, deepest = 0;
  for (let a = 0; a < c.shapes.length; a++) for (let i = 0; i < c.shapes[a].pts.length; i++) {
    const v = c.shapes[a].pts[i];
    let depth = 0;                                   // how deep v lies inside another copy (the deepest of them)
    for (const g of group) for (let b = 0; b < c.shapes.length; b++) {
      if (b === a && isId(g)) continue;
      const w = app(g, v);                           // v inside g^-1 · shape b  <=>  g v inside shape b
      if (!inPoly(klein[b], w[0] / w[2], w[1] / w[2])) continue;
      let d = Infinity;
      for (const q of c.shapes[b].pts) d = Math.min(d, dH(w, q));
      depth = Math.max(depth, d);
    }
    deepest = Math.max(deepest, depth);
    if (depth < 0.1) continue;                       // (0.1 from the other comma's outline POINTS: five texels and more of this texture from its outline)
    deep++;
    for (let k = 0; k < 9; k++) tri[k] = v[k % 3];
    const uv = p3.chartOf(tri), value = read(uv[0], uv[1]);
    worst = Math.max(worst, value);
    if (!(value < 128 - NEAR)) bad++;
  }
  console.log(`  3333 Length 0.7: ${print.info.layers} layers; ${deep} outline points lie 0.1 or more inside another comma (the deepest ${deepest.toFixed(2)}): ${bad} of them read as an outline (the lightest value ${worst.toFixed(0)}; 128 = an outline, ${(128 - NEAR).toFixed(0)} = two texels inside)`);
  assert.ok(deep > 5, `too few outline points inside another comma to tell (${deep})`);
  assert.equal(bad, 0, 'an outline shows inside another comma');
});

test('after a flip the surface carries the SAME commas: the new state\'s print, read in the new frame, is the old pattern', () => {
  // the engine's flip, as the page makes it: recut to another pair, the print tied anew (retiePrint); Q carries the
  // old pair frame to the new one (X_new = Q X_old), so nothing of the pattern moves
  for (const [key, over, i, j, seed] of [['3333', {}, 0, 2, 51], ['3333', { tw: 0.2 }, 0, 3, 52], ['2345', {}, 0, 2, 53], ['2222', { tw: 0.2 }, 0, 2, 54]]) {
    const old = stateFor(key, over), next = recut(old, i, j);
    const st = { k: next.k, perm: next.perm, orders: next.orders, L: next.L, tw: next.tw, b: 0, tau: 0, thetas: next.thetas };
    st.print = retiePrint(st, old);
    check(`${key}${over.tw ? ' Twist ' + over.tw : ''} flipped to the pair (${i}, ${j}): L ${st.L.toFixed(3)}, tw ${st.tw.toFixed(3)}`, st, { size: PRINT_SIZE_DRAG, seed, nPoints: 300, from: { state: old, Q: next.Q } });
  }
});

test('on pillow.js\'s mesh: the two sides of a seal read the same print, and so do the two ends of a turn round the loop', () => {
  // the corners a frame hands over are Pmat · X(s, theta) of the mesh's orbifold chart (2222: (theta, s + 1 / (2 L)));
  // the two copies of a seal vertex, and a point and its lift one loop further, are one point of the surface
  const fermi = (s, th) => [Math.sinh(th) * Math.cosh(s), Math.sinh(s), Math.cosh(th) * Math.cosh(s)];
  for (const [key, over] of [['3333', {}], ['3333', { tw: 0.2 }], ['2345', {}], ['2345', { tw: 0.2 }], ['2223', {}], ['2222', {}], ['2222', { tw: 0.2 }]]) {
    const st = stateFor(key, over), c = centredFor(st), flat = c.D.G.kind === 'E';
    const mesh = orbifoldMesh(st.orders, st.L, st.tw, { nTheta: 120, nS: 10 }), o = mesh.open;
    const p3 = createPrint3d(), print = p3.bake(st, { size: PRINT_SIZE_DRAG }), read = reader(print), tri = new Float64Array(9);
    const valueAt = (s, th) => {
      const X = flat ? [th, s + 0.5 / st.L, 1] : app(c.Pmat, fermi(s, th));
      for (let k = 0; k < 9; k++) tri[k] = X[k % 3];
      const uv = p3.chartOf(tri);
      return read(uv[0], uv[1]);
    };
    let pairs = 0, counted = 0, wrong = 0, dark = 0;
    const same = (va, vb) => {
      pairs++;
      if (Math.abs(va - 128) < NEAR || Math.abs(vb - 128) < NEAR) return;
      counted++;
      if (va < 128) dark++;
      if ((va < 128) !== (vb < 128)) wrong++;
    };
    for (const sl of mesh.seals) for (let i = 0; i < sl.openA.length; i++) { const a = sl.openA[i], b = sl.openB[i]; same(valueAt(o.s[a], o.theta[a]), valueAt(o.s[b], o.theta[b])); }
    for (let v = 0; v < o.nVertices; v += 7) same(valueAt(o.s[v], o.theta[v]), valueAt(o.s[v], o.theta[v] + mesh.cuff));
    console.log(`  ${key}${over.tw ? ' Twist ' + over.tw : ''}: ${pairs} pairs of chart points of one surface point, ${counted} counted (the rest within two texels of an outline), ${dark} dark, ${wrong} differ`);
    assert.equal(wrong, 0, `${key}: ${wrong} points read another tone on their other copy`);
    assert.ok(counted > 0.6 * pairs && dark > 0, `${key}: too few pairs counted (${counted} of ${pairs}, ${dark} dark)`);
  }
});

test('a triangle moves as one: the fold is a motion, and brings a far triangle near', () => {
  const st = stateFor('3333'), c = centredFor(st), p3 = createPrint3d();
  const print = p3.bake(st, { size: 256 });
  const movers = groupNear('H', c.A.maps, [0, 0, 1], 5, 2.5), rand = rng(5);
  const dH = (p, q) => Math.acosh(Math.max(1, p[2] * q[2] - p[0] * q[0] - p[1] * q[1]));
  const hyp = (u, v) => { const r2 = u * u + v * v, k = 1 / (1 - r2); return [2 * u * k, 2 * v * k, (1 + r2) * k]; };
  let worst = 0, far = 0, farAfter = 0;
  for (let n = 0; n < 200; n++) {
    const base = [0, 1, 2].map(() => { const d = 0.9 * rand(), a = 6.283 * rand(); return [Math.sinh(d) * Math.cos(a), Math.sinh(d) * Math.sin(a), Math.cosh(d)]; });
    const g = movers[Math.floor(rand() * movers.length)], T = base.map((p) => app(g, p));
    const uv = p3.chartOf(Float64Array.from(T.flat())), Q = [0, 1, 2].map((k) => hyp(uv[2 * k], uv[2 * k + 1]));
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) worst = Math.max(worst, Math.abs(dH(Q[a], Q[b]) - dH(base[a], base[b])));
    far = Math.max(far, Math.acosh(T[0][2])); farAfter = Math.max(farAfter, Math.acosh(Q[0][2]));
  }
  console.log(`  200 triangles carried up to ${far.toFixed(2)} from the middle: after the fold at most ${farAfter.toFixed(2)}; side lengths kept to ${worst.toExponential(1)}`);
  assert.ok(worst < 2e-4, `the three corners must move together (side lengths off by ${worst})`);      // (the chart is Float32)
  assert.ok(farAfter <= print.info.radius, 'a folded triangle lies within what was baked');
  assert.ok(far > 4 && farAfter < 3, 'the fold brings far triangles near');
});

test('the same state and size give the same print; another state another data array (the renderer uploads by identity)', () => {
  const p3 = createPrint3d(), a = stateFor('3333'), b = stateFor('3333', { tw: 0.1 }), c = stateFor('3333', { tw: 0.2 });
  const pa = p3.bake(a, { size: 256 });
  assert.equal(p3.bake(a, { size: 256 }), pa, 'asked again: the same object, no bake');
  const pb = p3.bake(b, { size: 256 });
  assert.notEqual(pb.data, pa.data, 'a new state is written into the other array');
  const keep = pb.data.slice(), pc = p3.bake(c, { size: 256 });
  assert.notEqual(pc.data, pb.data);
  assert.deepEqual(pb.data, keep, 'the array handed over last is not written into by the next bake');
  assert.equal(pc.data, pa.data, 'two arrays a size, in turn');
  assert.notEqual(p3.bake(c, { size: 512 }).data.length, pc.data.length);
  // a state the engine cannot build: no print, no throw
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(p3.bake({ k: 'nonsense' }, { size: 256 }), null); } finally { console.warn = warn; }
});

test('no DOM is touched, and the times are those of a frame', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const p3 = createPrint3d(), rows = [];
  for (const key of ['3333', '2345', '2222']) {
    for (const size of [512, 1024]) {
      const ts = [];
      for (let i = 0; i < 6; i++) { const st = stateFor(key, { tw: 0.01 * (i + 1) }); const t0 = performance.now(); assert.ok(p3.bake(st, { size })); ts.push(performance.now() - t0); }
      ts.sort((x, y) => x - y);
      rows.push(`${key} ${size}: ${ts[2].toFixed(1)} ms (best ${ts[0].toFixed(1)}, worst ${ts[5].toFixed(1)})`);
    }
  }
  // chartOf: 5,200 triangles spread over the tile and its neighbours
  const st = stateFor('3333'), c = centredFor(st); p3.bake(st, { size: 256 });
  const movers = groupNear('H', c.A.maps, [0, 0, 1], 2.7, 2.5), rand = rng(9), m = 5200, corners = new Float64Array(9 * m);
  for (let t = 0; t < m; t++) {
    const g = movers[Math.floor(rand() * movers.length)], d0 = 1.2 * rand(), a0 = 6.283 * rand();
    for (let k = 0; k < 3; k++) { const d = d0 + 0.05 * rand(), a = a0 + 0.05 * rand(), p = app(g, [Math.sinh(d) * Math.cos(a), Math.sinh(d) * Math.sin(a), Math.cosh(d)]); corners.set(p, 9 * t + 3 * k); }
  }
  const out = new Float32Array(6 * m), ts = [];
  for (let i = 0; i < 9; i++) { const t0 = performance.now(); p3.chartOf(corners, out); ts.push(performance.now() - t0); }
  ts.sort((x, y) => x - y);
  console.log('  bake, median of 6 states each: ' + rows.join('; '));
  console.log(`  chartOf, ${m} triangles: ${ts[4].toFixed(2)} ms (best ${ts[0].toFixed(2)}, worst ${ts[8].toFixed(2)})`);
  assert.ok(ts[4] < 25, 'chartOf of a frame takes a frame');
});
