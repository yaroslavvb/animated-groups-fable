// test/shapes.test.js — the shape prints of src/shapes.js (13 Nov 2026): the orbit of a motif under the group, printed
// like the checkerboard. The meaning is that of dev/patterns/kit.js, the kit the designs were drawn with:
//     W(x) = sum over all elements g, over the polygons P of the motif: +1 inside g(P) if P is outer, -1 if a hole
//     dark <=> W(x) > 0
// What is tested here, on all 17 groups and on motifs of every kind a design can be:
//   comma    the page's own comma (src/motif.js motifFor): one polygon at a generic place
//   blob     a lopsided blob with a hole and an island in the hole, at a generic place found by a lattice-relative rule
//            (so it exists for a group that was moved about, too)
//   chip     a scalene triangle: the smallest polygon there is
//   centre   a rosette ON the rotation centre with the largest stabiliser, with that symmetry itself (coincident copies);
//            it has a round hole in its middle. Not in o, xx, **, *x: they have no rotation centre.
//   mirror   an egg ON a mirror line, symmetric in it. In the ten groups with mirrors.
// against the group itself (not only the generators), against brute force, against the canvas path of fillShapes
// (the NONZERO rule evaluated by hand), against the kit where it is at hand, and with planted faults.
//   node --test test/shapes.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, elementsNear, symmetryElements, contains, classify } from '../src/groups.js';
import { motifFor, commaOutline } from '../src/motif.js';
import { GAP_MIN, MAX_VERTS, makeShapePrint, shapeElements, fillShapes, copiesIn, validateShapes, measureShapes, bakeShapes, BAKE_SIZE, BAKE_RANGE, BAKE_KEEP, thinParts } from '../src/shapes.js';
import { bakeSDF, sdfSample, sdfDistance } from '../src/sdf.js';

// The kit is a dev tool (tools/test-all.mjs does not send dev/ to the test machine; dev/patterns/suite.sh does).
let kit = null;
try { kit = await import('../dev/patterns/kit.js'); } catch { kit = null; }

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
const len = (p) => Math.hypot(p[0], p[1]);
const det = (g) => g.a * g.d - g.b * g.c;
const sizeOf = (g) => Math.sqrt(g.domainArea);

/** The group carried to another place: x -> s R(th) x + v (reps conjugated, lattice and centre moved). As in test/pattern.test.js. */
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}
/** The same move for a point and for a motif. */
const mover = (th, sc, v) => (x, y) => [sc * (Math.cos(th) * x - Math.sin(th) * y) + v[0], sc * (Math.sin(th) * x + Math.cos(th) * y) + v[1]];
function pointsOf(s) {
  const src = s.pts || s, out = [];
  if (typeof src[0] === 'number') for (let i = 0; i + 1 < src.length; i += 2) out.push([src[i], src[i + 1]]);
  else for (const p of src) out.push([p[0], p[1]]);
  return out;
}
const carry = (shapes, T) => shapes.map((s) => ({ pts: pointsOf(s).map((p) => T(p[0], p[1])), hole: !!s.hole }));

// ---- the motifs --------------------------------------------------------------------------------------------------------

/** The elements of the group that leave the point where it is. */
function stabiliserAt(group, x, y) { return elementsNear(group, x, y, 1e-7 * sizeOf(group), x, y); }
/** The distance from the point to its nearest image that is another point. */
function clearance(group, x, y) {
  let D = Infinity;
  for (const g of elementsNear(group, x, y, 1.01 * Math.max(len(group.e1), len(group.e2)), x, y)) {
    const d = Math.hypot(g.a * x + g.b * y + g.tx - x, g.c * x + g.d * y + g.ty - y);
    if (d > 1e-7 * sizeOf(group) && d < D) D = d;
  }
  return D;
}
const PLACES = [];
for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) PLACES.push([(i + 0.37) / 7 - 0.5, (j + 0.61) / 7 - 0.5]);
/** A generic place by a lattice-relative rule: of the 49 places center + a e1 + b e2, the k-th roomiest. */
function genericPlace(group, k = 0) {
  const list = PLACES.map(([a, b]) => {
    const x = group.center[0] + a * group.e1[0] + b * group.e2[0], y = group.center[1] + a * group.e1[1] + b * group.e2[1];
    return { x, y, D: clearance(group, x, y) };
  }).sort((p, q) => q.D - p.D);
  return list[k];
}
function ring(cx, cy, n, radius, phase = 0, back = false) {
  const pts = [];
  for (let i = 0; i < n; i++) { const k = back ? n - i : i, th = phase + (TAU * k) / n, r = radius((TAU * k) / n); pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); }
  return pts;
}

const commaShapes = (group) => motifFor(group).polylines.map((p) => ({ pts: p }));

/** A lopsided blob within rho of the place, with a hole (given counter-clockwise) and an island in the hole (clockwise). */
function blobShapes(group, place = genericPlace(group)) {
  const rho = 0.42 * (place.D - 0.03 * sizeOf(group)), { x, y } = place, hx = x + 0.12 * rho, hy = y - 0.05 * rho;
  const outer = ring(x, y, 72, (t) => rho * (0.74 + 0.2 * Math.cos(t + 0.5) + 0.06 * Math.cos(3 * t + 1)));
  const hole = ring(hx, hy, 40, (t) => 0.22 * rho * (1 + 0.2 * Math.cos(2 * t)));
  const island = ring(hx, hy, 24, () => 0.07 * rho, 0, true);
  return { shapes: [{ pts: outer }, { pts: hole, hole: true }, { pts: island }], at: [x, y], rho, hole: [hx, hy], order: 1 };
}
/** A scalene triangle within rho of another generic place. */
function chipShapes(group) {
  const place = genericPlace(group, 1), rho = 0.42 * (place.D - 0.03 * sizeOf(group)), { x, y } = place;
  return { shapes: [[[x + rho, y], [x - 0.5 * rho, y + 0.8 * rho], [x - 0.3 * rho, y - 0.6 * rho]]], at: [x, y], rho, order: 1 };
}
/**
 * A motif ON a point with a stabiliser, with that symmetry itself: a rosette with the n-fold turns of the point (and its
 * mirrors, when it lies on mirrors; chiral when it does not), and a round hole in the middle. kind 'centre': the
 * rotation centre with the largest stabiliser; 'mirror': a point of a mirror line that is no rotation centre.
 */
function symmetricShapes(group, kind) {
  const L = len(group.e1) + len(group.e2), sym = symmetryElements(group, group.center[0], group.center[1], 1.2 * L);
  let place = null;
  if (kind === 'centre') {
    for (const c of sym.centers) {
      const S = stabiliserAt(group, c.x, c.y), d = Math.hypot(c.x - group.center[0], c.y - group.center[1]);
      if (!place || S.length > place.S.length || (S.length === place.S.length && d < place.d - 1e-9)) place = { x: c.x, y: c.y, S, d };
    }
  } else {
    for (const m of sym.mirrors.slice(0, 4)) for (let k = -12; k <= 12; k++) {
      const x = m.px + (k + 0.3) * 0.04 * L * m.ux, y = m.py + (k + 0.3) * 0.04 * L * m.uy, S = stabiliserAt(group, x, y);
      if (S.length !== 2) continue;
      const D = clearance(group, x, y);
      if (!place || D > place.D * (1 + 1e-9)) place = { x, y, S, D };
    }
  }
  if (!place) return null;
  const S = place.S, n = S.filter((g) => det(g) > 0).length, mir = S.find((g) => det(g) < 0);
  let phi = 0.4;
  if (mir) { const c = classify(mir); assert.equal(c.type, 'reflection'); phi = Math.atan2(c.dir[1], c.dir[0]); }
  const rho = 0.42 * (clearance(group, place.x, place.y) - 0.03 * sizeOf(group));
  const f = mir ? (psi) => Math.cos(psi) : (psi) => (Math.cos(psi) + 0.5 * Math.sin(2 * psi)) / 1.3;
  const outer = ring(place.x, place.y, 60 * n, (t) => rho * (0.72 + 0.28 * f(n * t)), phi);
  const hole = ring(place.x, place.y, 24 * n, () => 0.2 * rho, phi);
  return { shapes: [{ pts: outer }, { pts: hole, hole: true }], at: [place.x, place.y], rho, order: S.length, turns: n, mirrored: !!mir };
}

const CASES = [];
for (const g of GROUPS) {
  const add = (motif, m) => {
    if (!m) return;
    CASES.push({ g, size: sizeOf(g), motif, label: `${g.id} ${motif}`, ...m, P: makeShapePrint(g, { key: motif, name: motif + 's', shapes: m.shapes, info: { at: m.at } }) });
  };
  add('comma', { shapes: commaShapes(g), order: 1, at: motifFor(g).at });
  add('blob', blobShapes(g));
  add('chip', chipShapes(g));
  add('centre', symmetricShapes(g, 'centre'));
  add('mirror', symmetricShapes(g, 'mirror'));
}
const casesOf = (motif) => CASES.filter((C) => C.motif === motif);
const gens = (g) => g.reps.concat([{ a: 1, b: 0, c: 0, d: 1, tx: g.e1[0], ty: g.e1[1] }, { a: 1, b: 0, c: 0, d: 1, tx: g.e2[0], ty: g.e2[1] }]);

function pointSeg(x, y, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - ax - t * ex, y - ay - t * ey);
}
function areaOf(pts) { let s = 0; for (let i = 0, n = pts.length / 2; i < n; i++) { const j = (i + 1) % n; s += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1]; } return s / 2; }

// ---- the print ---------------------------------------------------------------------------------------------------------

test('shape prints: the motifs of the test — five kinds, on every group that can have them', (t) => {
  assert.equal(casesOf('comma').length, 17);
  assert.equal(casesOf('blob').length, 17);
  assert.equal(casesOf('chip').length, 17);
  assert.deepEqual(GROUPS.filter((g) => !casesOf('centre').some((C) => C.g === g)).map((g) => g.id), ['o', '**', 'xx', '*x'], 'a rosette on a rotation centre wherever there is one');
  assert.equal(casesOf('mirror').length, 10, 'an egg on a mirror in the ten groups with mirrors');
  for (const g of GROUPS) assert.ok(CASES.filter((C) => C.g === g).length >= 3, `${g.id}: at least three motifs`);
  // the stabilisers the symmetric motifs sit on: every kind there is
  const orders = Object.fromEntries(casesOf('centre').map((C) => [C.g.id, C.order]));
  assert.deepEqual(orders, { 2222: 2, 333: 3, '22x': 2, '22*': 2, '*2222': 4, '2*22': 4, 442: 4, 632: 6, '3*3': 6, '*333': 6, '4*2': 4, '*442': 8, '*632': 12 });
  for (const C of casesOf('mirror')) assert.equal(C.order, 2, C.label);
  for (const C of casesOf('blob').concat(casesOf('chip'))) assert.equal(stabiliserAt(C.g, C.at[0], C.at[1]).length, 1, `${C.label}: a generic place`);
  for (const C of CASES) assert.ok(C.rho === undefined || C.rho > 0.05 * C.size, `${C.label}: the motif has a size`);
  t.diagnostic(`${CASES.length} prints: ` + ['comma', 'blob', 'chip', 'centre', 'mirror'].map((m) => `${casesOf(m).length} ${m}`).join(', '));
});

test('shape prints: makeShapePrint — the Print, frozen; polygons turned the right way round; what it throws', () => {
  for (const C of CASES) {
    const { g, P, label } = C;
    assert.ok(Object.isFrozen(P), label);
    assert.equal(P.kind, 'shapes'); assert.equal(P.key, C.motif); assert.equal(P.name, C.motif + 's');
    assert.ok(Object.isFrozen(P.info) && Object.isFrozen(P.polys) && Object.isFrozen(P.reps) && Object.isFrozen(P.e1) && Object.isFrozen(P.inv), label);
    assert.deepEqual(P.info.at, C.at);
    // the lattice, its inverse, the representatives: copies, not the group's own objects
    assert.deepEqual([...P.e1, ...P.e2], [...g.e1, ...g.e2]);
    assert.ok(P.e1 !== g.e1 && P.reps !== g.reps && P.reps[0] !== g.reps[0], label);
    assert.equal(P.reps.length, g.reps.length);
    P.reps.forEach((r, k) => { for (const f of ['a', 'b', 'c', 'd', 'tx', 'ty']) assert.equal(r[f], g.reps[k][f]); assert.ok(Object.isFrozen(r)); });
    const I = P.inv;
    assert.ok(Math.abs(I[0] * g.e1[0] + I[1] * g.e1[1] - 1) < 1e-12 && Math.abs(I[2] * g.e1[0] + I[3] * g.e1[1]) < 1e-12 && Math.abs(I[0] * g.e2[0] + I[1] * g.e2[1]) < 1e-12 && Math.abs(I[2] * g.e2[0] + I[3] * g.e2[1] - 1) < 1e-12, `${label}: inv`);
    assert.ok(Math.abs(P.size - Math.sqrt(g.domainArea)) < 1e-12, `${label}: size`);
    // the polygons
    let verts = 0, net = 0;
    assert.equal(P.polys.length, C.shapes.length, label);
    P.polys.forEach((poly, i) => {
      const n = poly.pts.length / 2, A = areaOf(poly.pts);
      assert.ok(poly.pts instanceof Float64Array && n >= 3, label);
      assert.equal(poly.hole, !!C.shapes[i].hole, `${label}: polygon ${i} hole`);
      assert.ok(poly.hole ? A < 0 : A > 0, `${label}: polygon ${i} runs ${poly.hole ? 'clockwise' : 'counter-clockwise'}`);
      assert.ok(Math.abs(Math.abs(A) - poly.area) < 1e-12, `${label}: area`);
      assert.ok(Math.hypot(poly.pts[0] - poly.pts[2 * n - 2], poly.pts[1] - poly.pts[2 * n - 1]) > 1e-9, `${label}: no repeated last point`);
      for (let k = 0; k < n; k++) {
        const x = poly.pts[2 * k], y = poly.pts[2 * k + 1];
        assert.ok(x >= poly.box[0] && x <= poly.box[2] && y >= poly.box[1] && y <= poly.box[3], `${label}: box`);
        assert.ok(Math.hypot(x - P.cx, y - P.cy) <= P.R * (1 + 1e-12), `${label}: the bounding circle holds vertex ${k}`);
      }
      verts += n; net += poly.hole ? -poly.area : poly.area;
    });
    assert.equal(P.verts, verts, label);
    assert.ok(Math.abs(P.netArea - net) < 1e-12 && Math.abs(P.cell - Math.sqrt(net)) < 1e-12, `${label}: netArea, cell`);
    // the bounding circle is the smallest one: no circle 2 % smaller round any point near its centre holds the motif
    for (const [dx, dy] of [[0, 0], [0.01, 0], [-0.01, 0], [0, 0.01], [0, -0.01], [0.007, 0.007]]) {
      let far = 0;
      for (const poly of P.polys) for (let k = 0; k < poly.pts.length; k += 2) far = Math.max(far, Math.hypot(poly.pts[k] - P.cx - dx * P.R, poly.pts[k + 1] - P.cy - dy * P.R));
      assert.ok(far >= P.R * (1 - 1e-9), `${label}: a smaller circle would do (${far / P.R})`);
    }
  }
  // the comma: 92 points (the 93rd repeats the first), given as a Float32Array, taken as it is
  const c = casesOf('comma')[0];
  assert.equal(c.P.verts, motifFor(c.g).polylines[0].length / 2 - 1);
  // what cannot be used
  const g = BY_ID['442'], tri = [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]];
  assert.throws(() => makeShapePrint(g, { shapes: [] }), /no polygon/);
  assert.throws(() => makeShapePrint(g, {}), /shapes/);
  assert.throws(() => makeShapePrint(g, { shapes: [{ pts: [[0, 0], [1, 0]] }] }), /no polygon/);
  assert.throws(() => makeShapePrint(g, { shapes: [{ pts: [[0, 0], [1, 0], [1, 0], [0, 0]] }] }), /no polygon/, 'two different points only');
  assert.throws(() => makeShapePrint(g, { shapes: [{ pts: [[0, 0], [1, NaN], [0, 1]] }] }), /not a finite number/);
  assert.throws(() => makeShapePrint(g, { shapes: [tri, { pts: [[0, 0], [Infinity, 0], [0, 1]] }] }), /polygon 1 .*not a finite number/);
  assert.throws(() => makeShapePrint(g, { shapes: [[0, 0, 1, 0, 1]] }), /odd number/);
  assert.throws(() => makeShapePrint(null, { shapes: [tri] }), /lattice/);
  assert.throws(() => makeShapePrint({ e1: [1, 0], e2: [2, 0], reps: g.reps }, { shapes: [tri] }), /one line/);
  assert.throws(() => makeShapePrint({ e1: [1, 0], e2: [0, 1], reps: [] }, { shapes: [tri] }), /representatives/);
  // every way of writing a polygon gives the same print; too short a polygon beside a good one is left out
  const flat = tri.flat(), ways = [[tri], [{ pts: tri }], [flat], [{ pts: Float32Array.from(flat) }], [{ pts: tri.concat([tri[0]]) }], [{ pts: tri.slice().reverse() }], [[[0, 0], [1, 1]], tri]];
  for (const w of ways) {
    const P = makeShapePrint(g, { shapes: w });
    assert.equal(P.polys.length, 1); assert.equal(P.verts, 3); assert.equal(P.key, 'shapes');
    for (let k = 0; k < 6; k++) assert.ok(Math.abs(P.polys[0].pts[k] - flat[k]) < 1e-7, 'the same triangle, counter-clockwise from its first point');
    assert.equal(P.tone(0.2, 0.15), 1); assert.equal(P.tone(0.05, 0.05), 0);
  }
  // the print's own points are not the ones the caller sees: writing into print.polys does not move the tone
  const P = makeShapePrint(g, { shapes: [tri] });
  P.polys[0].pts[0] = 0.29;
  assert.equal(P.tone(0.12, 0.11), 1, 'tone() reads its own copy');
  assert.ok(P.margin(0.2, 0.1) < 1e-12 && Math.abs(P.margin(0.2, 0.05) - 0.05) < 1e-12);
});

test('shape prints: the tone is the group\'s — every coset representative, both translations and hundreds of other elements leave W, the tone and the margin as they are', (t) => {
  let checked = 0, more = 0;
  const rows = [];
  for (const C of CASES) {
    const { g, P, size, label } = C, G = gens(g), L = Math.max(len(g.e1), len(g.e2));
    // ... and one translation far out, where the lattice coordinates are in the thousands
    G.push({ a: 1, b: 0, c: 0, d: 1, tx: 1000 * g.e1[0] - 777 * g.e2[0], ty: 1000 * g.e1[1] - 777 * g.e2[1] });
    const els = elementsNear(g, g.center[0], g.center[1], 2 * (len(g.e1) + len(g.e2)));
    assert.ok(els.length >= 9, label);
    const rnd = prng(101 + CASES.indexOf(C));
    let n = 0, dark = 0;
    for (let i = 0; i < 20000 && n < 300; i++) {
      const x = g.center[0] + (2 * rnd() - 1) * 1.7 * L, y = g.center[1] + (2 * rnd() - 1) * 1.7 * L, m = P.margin(x, y);
      assert.ok(m >= 0 && Number.isFinite(m), `${label}: margin ${m}`);
      if (m < 1e-6 * size) continue;
      n++;
      const W = P.winding(x, y), tone = P.tone(x, y);
      assert.ok(W === 0 || W === C.order, `${label}: W = ${W} at (${x}, ${y}); the stabiliser has order ${C.order}`);
      assert.equal(tone, W > 0 ? 1 : 0, label);
      dark += tone;
      for (const e of G) {
        const u = e.a * x + e.b * y + e.tx, v = e.c * x + e.d * y + e.ty;
        assert.equal(P.winding(u, v), W, `${label}: ${JSON.stringify(e)} changes W at (${x}, ${y})`);
        assert.equal(P.tone(u, v), tone, label);
        assert.ok(Math.abs(P.margin(u, v) - m) < 1e-9 * size * (1 + Math.hypot(e.tx, e.ty)), `${label}: ${JSON.stringify(e)} changes the margin at (${x}, ${y}): ${P.margin(u, v)} for ${m}`);
        checked++;
      }
      if (n <= 25) for (const e of els) { assert.equal(P.winding(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty), W, `${label}: the element ${JSON.stringify(e)} changes W at (${x}, ${y})`); more++; }
    }
    assert.equal(n, 300, `${label}: ${n} points away from the outlines`);
    // both tones are there, in the share the areas give
    const share = P.netArea / (C.order * g.domainArea);
    assert.ok(Math.abs(dark / n - share) < 0.13 && dark < n, `${label}: ${dark} of ${n} points are dark, the areas say ${(100 * share).toFixed(1)} %`);
    rows.push(`${label.padEnd(14)} ${String(P.verts).padStart(4)} points  W = ${C.order}  dark ${(100 * share).toFixed(1).padStart(5)} %  R ${(P.R / size).toFixed(3)}`);
  }
  assert.ok(checked >= CASES.length * 300 * 4 && more > CASES.length * 25 * 9, `${checked} + ${more} checks`);
  for (const r of rows) t.diagnostic(r);
});

test('shape prints: winding counts coincident copies — inside a motif that sits on a centre or a mirror W is the stabiliser\'s order, in its hole 0', () => {
  for (const C of casesOf('centre').concat(casesOf('mirror'))) {
    const { P, label, rho, at } = C;
    assert.ok(C.order >= 2, label);
    for (let k = 0; k < 40; k++) {
      const th = 0.1 + (TAU * k) / 40;
      // the hole has radius 0.2 rho, the outline is nowhere nearer the centre than 0.44 rho and nowhere farther than rho
      assert.equal(P.winding(at[0] + 0.1 * rho * Math.cos(th), at[1] + 0.1 * rho * Math.sin(th)), 0, `${label}: in the hole`);
      assert.equal(P.winding(at[0] + 0.3 * rho * Math.cos(th), at[1] + 0.3 * rho * Math.sin(th)), C.order, `${label}: in the motif, ${C.order} copies lie on each other`);
      assert.equal(P.tone(at[0] + 0.3 * rho * Math.cos(th), at[1] + 0.3 * rho * Math.sin(th)), 1, label);
      assert.equal(P.winding(at[0] + 1.02 * rho * Math.cos(th), at[1] + 1.02 * rho * Math.sin(th)), 0, `${label}: just outside`);
    }
    assert.ok(Math.abs(P.margin(at[0], at[1]) - 0.2 * rho * Math.cos(Math.PI / (24 * C.turns))) < 1e-9, `${label}: the middle of the hole is its inradius from the outline`);
    // the centre of the bounding circle is the point the motif sits on (a symmetry of the motif fixes it)
    if (C.turns >= 2) assert.ok(Math.hypot(P.cx - at[0], P.cy - at[1]) < 1e-9 * C.size, `${label}: the bounding circle is centred on the rotation centre`);
  }
  for (const C of casesOf('blob')) {
    const { P, label, rho, at, hole } = C;
    assert.equal(P.winding(at[0] - 0.3 * rho, at[1] + 0.2 * rho), 1, `${label}: in the blob`);
    assert.equal(P.winding(hole[0] + 0.13 * rho, hole[1]), 0, `${label}: in the hole`);
    assert.equal(P.winding(hole[0], hole[1]), 1, `${label}: on the island in the hole`);
    assert.equal(P.tone(hole[0] + 0.13 * rho, hole[1]), 0); assert.equal(P.tone(hole[0], hole[1]), 1);
  }
  // two blobs that a half-turn swaps, both in the motif: the copies coincide, each polygon on the other one's image
  let pairs = 0;
  for (const g of GROUPS) {
    const sym = symmetryElements(g, g.center[0], g.center[1], 1.2 * (len(g.e1) + len(g.e2)));
    const c = sym.centers.find((q) => { const S = stabiliserAt(g, q.x, q.y); return S.length === 2 && S.every((e) => det(e) > 0); });
    if (!c) continue;
    const rho = 0.42 * (clearance(g, c.x, c.y) - 0.03 * sizeOf(g)), bx = c.x + 0.6 * rho * Math.cos(0.7), by = c.y + 0.6 * rho * Math.sin(0.7);
    const A = ring(bx, by, 36, (t) => 0.3 * rho * (0.8 + 0.2 * Math.cos(t + 1))), B = A.map(([x, y]) => [2 * c.x - x, 2 * c.y - y]);
    const P = makeShapePrint(g, { shapes: [A, B] }), V = validateShapes(P);
    assert.deepEqual(V.problems, [], `${g.id}: a pair round a 2-fold centre`);
    assert.equal(V.stabilizer, 2, g.id);
    assert.equal(P.winding(bx, by), 2, g.id); assert.equal(P.winding(2 * c.x - bx, 2 * c.y - by), 2, g.id); assert.equal(P.winding(c.x, c.y), 0, g.id);
    assert.ok(Math.abs(measureShapes(P, { per: 24 }).coverageExact - P.netArea / (2 * g.domainArea)) < 1e-12, g.id);
    // one of the pair alone is a motif at a generic place, with the same tone
    const Q = makeShapePrint(g, { shapes: [A] });
    assert.equal(validateShapes(Q).stabilizer, 1); assert.equal(Q.winding(bx, by), 1); assert.equal(Q.winding(2 * c.x - bx, 2 * c.y - by), 1);
    pairs++;
  }
  assert.ok(pairs >= 6, `${pairs} groups with a 2-fold centre off the mirrors`);
  // dark <=> W > 0, not W != 0: a hole that lies in no polygon (a motif that breaks the rules) is light, W = -1 in it
  for (const C of casesOf('blob')) {
    const [outer, hole] = C.shapes, dx = C.rho * Math.cos(2.64), dy = C.rho * Math.sin(2.64);
    const P = makeShapePrint(C.g, { shapes: [outer, { pts: hole.pts.map(([x, y]) => [x + dx, y + dy]), hole: true }] });
    assert.equal(P.winding(C.hole[0] + dx, C.hole[1] + dy), -1, `${C.label}: in a hole outside the blob`);
    assert.equal(P.tone(C.hole[0] + dx, C.hole[1] + dy), 0, `${C.label}: light there`);
    assert.equal(P.winding(C.hole[0], C.hole[1]), 1, `${C.label}: the blob is whole now`);
  }
});

/** W by brute force: every element of the group whose copy can hold the point (src/groups.js), every polygon, the crossing rule. */
function bruteWinding(g, P, x, y) {
  let W = 0;
  for (const e of elementsNear(g, x, y, P.R * (1 + 1e-9) + 1e-9, P.cx, P.cy)) {
    const dx = x - e.tx, dy = y - e.ty, d = det(e), u = (e.d * dx - e.b * dy) / d, v = (-e.c * dx + e.a * dy) / d;      // e^-1(x)
    for (const poly of P.polys) {
      const p = poly.pts;
      let inn = false;
      for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
        const yi = p[2 * i + 1], yj = p[2 * j + 1];
        if ((yi > v) !== (yj > v) && u < p[2 * i] + ((v - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn;
      }
      if (inn) W += poly.hole ? -1 : 1;
    }
  }
  return W;
}
/** Gauss reduction of a lattice basis (what the print reduces a point by). */
function reduced(e1, e2) {
  let u = e1.slice(), v = e2.slice();
  for (let it = 0; it < 100; it++) {
    if (len(u) > len(v)) { const t = u; u = v; v = t; }
    const m = Math.round((u[0] * v[0] + u[1] * v[1]) / (u[0] * u[0] + u[1] * u[1]));
    if (!m) break;
    v = [v[0] - m * u[0], v[1] - m * u[1]];
  }
  return [u, v];
}

test('shape prints: W where rounding could go either way — on the seams of the lattice reduction, at the heights of the vertices — and where many copies overlap: brute force', () => {
  let seams = 0, heights = 0, deep = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C, rnd = prng(900 + CASES.indexOf(C)), [u, v] = reduced(g.e1, g.e2);
    // the cell round the motif's centre ends half a lattice vector from it: points on those lines, carried by every representative
    for (const r of g.reps) for (const [p, q] of [[u, v], [v, u], [g.e1, g.e2], [g.e2, g.e1]]) for (let k = 0; k < 6; k++) {
      const m = Math.round(4 * rnd() - 2) + 0.5, t = 3 * rnd() - 1.5, nudge = (k % 3 - 1) * 2e-16;
      const qx = P.cx + (m + nudge) * p[0] + t * q[0], qy = P.cy + (m + nudge) * p[1] + t * q[1];
      const x = r.a * qx + r.b * qy + r.tx, y = r.c * qx + r.d * qy + r.ty;
      if (P.margin(x, y) < 1e-6 * size) continue;
      assert.equal(P.winding(x, y), bruteWinding(g, P, x, y), `${label}: W on a seam of the reduction, at (${x}, ${y})`);
      seams++;
    }
    // a ray through a vertex: the point at a vertex's height (in the motif's own frame), carried by elements of the group
    const els = elementsNear(g, g.center[0], g.center[1], 1.5 * (len(g.e1) + len(g.e2)));
    for (let k = 0; k < 60; k++) {
      const poly = P.polys[k % P.polys.length], i = Math.floor(rnd() * (poly.pts.length / 2)), e = k < 12 ? { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } : els[Math.floor(rnd() * els.length)];
      const qx = poly.pts[2 * i] + (2 * rnd() - 1) * P.R, qy = poly.pts[2 * i + 1], x = e.a * qx + e.b * qy + e.tx, y = e.c * qx + e.d * qy + e.ty;
      if (P.margin(x, y) < 1e-6 * size) continue;
      assert.equal(P.winding(x, y), bruteWinding(g, P, x, y), `${label}: W at the height of vertex ${i}, at (${x}, ${y})`);
      heights++;
    }
  }
  assert.ok(seams > CASES.length * 20 && heights > CASES.length * 40, `${seams} points on seams, ${heights} at vertex heights`);
  // the comma blown up 2.5 and 6 times: many copies on each other, a motif several lattice cells across
  let most = 0;
  for (const g of GROUPS) for (const k of [2.5, 6]) {
    const m = motifFor(g), big = pointsOf(commaShapes(g)[0]).map(([x, y]) => [m.at[0] + k * (x - m.at[0]), m.at[1] + k * (y - m.at[1])]);
    const P = makeShapePrint(g, { shapes: [big] }), rnd = prng(41), L = len(g.e1) + len(g.e2);
    for (let i = 0; i < 80; i++) {
      const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
      if (P.margin(x, y) < 1e-7 * P.size) continue;
      const W = P.winding(x, y);
      assert.equal(W, bruteWinding(g, P, x, y), `${g.id}, the comma ${k} times its size: W at (${x}, ${y})`);
      assert.equal(P.tone(x, y), W > 0 ? 1 : 0);
      most = Math.max(most, W); deep++;
    }
    // (the margin among overlapping copies, a few points)
    for (let i = 0; i < 4; i++) {
      const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
      let best = Infinity;
      for (const e of elementsNear(g, x, y, L + 2 * P.R, P.cx, P.cy)) {
        const p = P.polys[0].pts, n = p.length / 2;
        let ax = e.a * p[2 * n - 2] + e.b * p[2 * n - 1] + e.tx, ay = e.c * p[2 * n - 2] + e.d * p[2 * n - 1] + e.ty;
        for (let j = 0; j < n; j++) { const bx = e.a * p[2 * j] + e.b * p[2 * j + 1] + e.tx, by = e.c * p[2 * j] + e.d * p[2 * j + 1] + e.ty; best = Math.min(best, pointSeg(x, y, ax, ay, bx, by)); ax = bx; ay = by; }
      }
      assert.ok(Math.abs(P.margin(x, y) - best) < 1e-10, `${g.id}, the comma ${k} times its size: margin ${P.margin(x, y)} at (${x}, ${y}), brute force ${best}`);
    }
  }
  assert.ok(deep > 17 * 2 * 60 && most >= 8, `${deep} points, up to ${most} copies on each other`);
});

test('shape prints: margin is the distance to the nearest outline of any copy (brute force over the copies nearby)', () => {
  let n = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C, L = len(g.e1) + len(g.e2), rnd = prng(7 + CASES.indexOf(C));
    for (let i = 0; i < 40; i++) {
      // most points anywhere, some hard by the motif (inside its hole, at its rim)
      const near = i % 4 === 0, x = near ? P.cx + (2 * rnd() - 1) * 1.1 * P.R : g.center[0] + (2 * rnd() - 1) * L, y = near ? P.cy + (2 * rnd() - 1) * 1.1 * P.R : g.center[1] + (2 * rnd() - 1) * L;
      let best = Infinity;
      for (const e of elementsNear(g, x, y, L + 2 * P.R, P.cx, P.cy)) for (const poly of P.polys) {
        const p = poly.pts, m = p.length / 2;
        let ax = e.a * p[2 * m - 2] + e.b * p[2 * m - 1] + e.tx, ay = e.c * p[2 * m - 2] + e.d * p[2 * m - 1] + e.ty;
        for (let k = 0; k < m; k++) {
          const bx = e.a * p[2 * k] + e.b * p[2 * k + 1] + e.tx, by = e.c * p[2 * k] + e.d * p[2 * k + 1] + e.ty;
          best = Math.min(best, pointSeg(x, y, ax, ay, bx, by));
          ax = bx; ay = by;
        }
      }
      assert.ok(Math.abs(P.margin(x, y) - best) < 1e-10 * (1 + size), `${label}: margin ${P.margin(x, y)} at (${x}, ${y}), brute force ${best}`);
      n++;
    }
    // on a vertex it is 0
    assert.ok(P.margin(P.polys[0].pts[0], P.polys[0].pts[1]) < 1e-12, label);
  }
  assert.equal(n, CASES.length * 40);
});

// ---- the canvas --------------------------------------------------------------------------------------------------------

/** A 2D context that records what is filled: [{ path: [[x, y], ...][], rule, style }]. As in test/pattern.test.js. */
function recorder() {
  let path = [], cur = null;
  const stack = [];
  let clips = [];
  const fills = [];
  return {
    fills,
    set fillStyle(v) { this._fill = v; }, get fillStyle() { return this._fill; },
    beginPath() { path = []; cur = null; },
    moveTo(x, y) { cur = [[x, y]]; path.push(cur); },
    lineTo(x, y) { if (!cur) { cur = []; path.push(cur); } cur.push([x, y]); },
    closePath() { cur = null; },
    save() { stack.push(clips.slice()); },
    restore() { clips = stack.pop() || []; },
    clip() { clips = clips.concat([path.map((p) => p.slice())]); },
    fill(rule) { fills.push({ path: path.map((p) => p.slice()), clips: clips.slice(), rule: rule || 'nonzero', style: this._fill }); },
  };
}
/** The winding number of a path (closed subpaths [[x, y], ...]) round a point: what the NONZERO rule looks at. */
function windingNumber(subs, x, y) {
  let wn = 0;
  for (const s of subs) {
    if (x < s.box[0] || x > s.box[2] || y < s.box[1] || y > s.box[3]) continue;
    const p = s.pts;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const a = p[j], b = p[i], side = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
      if (a[1] <= y) { if (b[1] > y && side > 0) wn++; } else if (b[1] <= y && side < 0) wn--;
    }
  }
  return wn;
}
const boxedSubs = (path) => path.map((pts) => {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pts) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); }
  return { pts, box };
});

test('shape prints: fillShapes draws exactly the tone — ONE path, the nonzero rule; its winding number is W, through the plane\'s window, a turned and flipped card and a plain map', () => {
  const maps = [
    { name: 'the window', A: { a: 90, b: 0, c: 0, d: -90, tx: 300, ty: 280 } },                       // y up -> y down
    { name: 'a card turned 40 degrees and flipped', A: { a: 70 * Math.cos(0.7), b: 70 * Math.sin(0.7), c: 70 * Math.sin(0.7), d: -70 * Math.cos(0.7), tx: 210, ty: 190 } },
    { name: 'a turned map that keeps the hand', A: { a: 50 * Math.cos(2.1), b: -50 * Math.sin(2.1), c: 50 * Math.sin(2.1), d: 50 * Math.cos(2.1), tx: 120, ty: 90 } },
  ];
  let compared = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C;
    const box = [g.center[0] - 0.9, g.center[1] - 0.8, g.center[0] + 0.9, g.center[1] + 0.8];
    for (const M of maps) {
      const c = recorder(), A = M.A, hand = Math.sign(det(A));
      const copies = fillShapes(c, P, (x, y, out) => { out[0] = A.a * x + A.b * y + A.tx; out[1] = A.c * x + A.d * y + A.ty; return out; }, box, '#123456');
      assert.equal(c.fills.length, 1, `${label}: one path`);
      assert.equal(c.fills[0].rule, 'nonzero', label); assert.equal(c.fills[0].style, '#123456'); assert.equal(c.fills[0].clips.length, 0);
      assert.equal(copies, shapeElements(P, box).length, label);
      assert.equal(c.fills[0].path.length, copies * P.polys.length, `${label}: every polygon of every copy is a closed subpath`);
      const subs = boxedSubs(c.fills[0].path), rnd = prng(77 + CASES.indexOf(C));
      let n = 0, dark = 0;
      for (let i = 0; i < 40000 && n < 400; i++) {
        const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]);
        if (P.margin(x, y) < 1e-6 * size) continue;
        n++;
        const wn = windingNumber(subs, A.a * x + A.b * y + A.tx, A.c * x + A.d * y + A.ty), W = P.winding(x, y);
        assert.equal(wn !== 0 ? 1 : 0, P.tone(x, y), `${label}, ${M.name}: the canvas and the tone differ at (${x.toFixed(4)}, ${y.toFixed(4)})`);
        assert.equal(wn, W ? hand * W : 0, `${label}, ${M.name}: the path winds ${wn} times round (${x.toFixed(4)}, ${y.toFixed(4)}), W = ${W}`);
        dark += wn !== 0 ? 1 : 0; compared++;
      }
      assert.equal(n, 400, `${label}: ${n} points`);
      assert.ok(dark > 0 && dark < n, `${label}: ${dark} dark points of ${n}`);
    }
    // a map that only writes into `out` (pattern.js's fillPrint is called that way), no style given, no print
    const c = recorder();
    fillShapes(c, P, (x, y, out) => { out[0] = x; out[1] = y; }, box);
    assert.equal(c.fills.length, 1); assert.equal(c.fills[0].style, undefined);
    assert.ok(c.fills[0].path.every((s) => s.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))), label);
    assert.equal(fillShapes(recorder(), null, () => {}, box, '#000'), 0);
  }
  assert.equal(compared, CASES.length * 3 * 400);
});

test('shape prints: fillShapes with a tolerance (the plane) draws every outline simplified to within it: points of the outline, in its order, none of the outline farther than tol; a polygon under 2 tol across is left out', () => {
  const k = 90, A = { a: k, b: 0, c: 0, d: -k, tx: 300, ty: 280 };
  const map = (x, y, out) => { out[0] = A.a * x + A.b * y + A.tx; out[1] = A.c * x + A.d * y + A.ty; return out; };
  const segDist = (p, a, b) => {
    const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey);
  };
  let pointsExact = 0, pointsDrawn = 0, subpaths = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C;
    const box = [g.center[0] - 0.9, g.center[1] - 0.8, g.center[0] + 0.9, g.center[1] + 0.8];
    const exact = recorder();
    fillShapes(exact, P, map, box, '#000');
    const E = exact.fills[0].path, key = (p) => p[0] + ',' + p[1];
    const idx = E.map((sub) => new Map(sub.map((p, j) => [key(p), j])));
    /** The exact outline the drawn one is made of: every point of it in that outline, in its order (cyclically). */
    const sourceOf = (sub) => {
      for (let i = 0; i < E.length; i++) {
        const m = idx[i], n = E[i].length;
        if (!m.has(key(sub[0]))) continue;
        let j = m.get(key(sub[0])), ok = true;
        for (let q = 1; q < sub.length && ok; q++) {
          const h = m.get(key(sub[q]));
          ok = h !== undefined && (h - j + n) % n > 0;
          j = h;
        }
        if (ok) return E[i];
      }
      return null;
    };
    for (const tol of [0.002 * size, 0.012 * size]) {
      const c = recorder();
      assert.equal(fillShapes(c, P, map, box, '#000', tol), shapeElements(P, box).length, label);
      assert.equal(c.fills.length, 1); assert.equal(c.fills[0].rule, 'nonzero');
      const S = c.fills[0].path;
      assert.ok(S.length <= E.length && S.length > 0, label);
      for (const sub of S.slice(0, 12)) {
        // every point drawn is a point of one exact outline, and they come in its order (cyclically)
        const e = sourceOf(sub), n = e ? e.length : 0;
        assert.ok(e, `${label}, tol ${tol}: the drawn outline is no subset of an outline of the motif's copies`);
        // ... and no point of that outline is farther than tol from the drawn one (in canvas units: k tol)
        for (const p of e) {
          let d = Infinity;
          for (let q = 0; q < sub.length; q++) d = Math.min(d, segDist(p, sub[q], sub[(q + 1) % sub.length]));
          assert.ok(d <= k * tol * (1 + 1e-9) + 1e-9, `${label}, tol ${tol}: a point of the outline ${(d / k / size).toExponential(2)} tile sizes from the drawn one`);
        }
        pointsExact += n; pointsDrawn += sub.length; subpaths++;
      }
    }
    // the same tolerance twice: the same simplification (it is kept per print and tolerance)
    const a = recorder(), b = recorder();
    fillShapes(a, P, map, box, '#000', 0.004 * size); fillShapes(b, P, map, box, '#000', 0.004 * size);
    assert.deepEqual(a.fills[0].path, b.fills[0].path, label);
  }
  assert.ok(subpaths > 500, `${subpaths} outlines looked at`);
  assert.ok(pointsDrawn < 0.6 * pointsExact, `fewer points: ${pointsDrawn} of ${pointsExact}`);
  // a polygon under 2 tol across is left out (a triangle stays as it is); the rest of the motif is drawn
  const g = BY_ID['o'], size = sizeOf(g), cx = g.center[0], cy = g.center[1];
  const ring = (r, n, x0, y0) => Array.from({ length: n }, (_, i) => [x0 + r * Math.cos((2 * Math.PI * i) / n), y0 + r * Math.sin((2 * Math.PI * i) / n)]);
  const P = makeShapePrint(g, { shapes: [{ pts: ring(0.2 * size, 400, cx, cy) }, { pts: ring(0.001 * size, 12, cx + 0.3 * size, cy) }, { pts: [[cx - 0.3 * size, cy], [cx - 0.3 * size + 1e-4 * size, cy], [cx - 0.3 * size, cy + 1e-4 * size]] }] });
  const box = [cx - 0.01, cy - 0.01, cx + 0.01, cy + 0.01];
  const n0 = recorder(), n1 = recorder();
  fillShapes(n0, P, map, box, '#000'); fillShapes(n1, P, map, box, '#000', 0.002 * size);
  const copies = shapeElements(P, box).length;
  assert.equal(n0.fills[0].path.length, 3 * copies);
  assert.equal(n1.fills[0].path.length, 2 * copies, 'the small ring is left out, the triangle kept');
  assert.ok(n1.fills[0].path[0].length < 60, `the circle of 400 points: ${n1.fills[0].path[0].length}`);
});

test('shape prints: thinParts finds where a motif is thinner than a width — a needle (dark), a slit and the gap round an island (light), a blob smaller than the width; not a gentle bend (the reviews of 13 Nov: the 3D texture cuts such parts short)', () => {
  const g = BY_ID['o'], size = sizeOf(g), [cx, cy] = g.center, w = 0.003 * size;
  const ring = (r, n, x0, y0) => Array.from({ length: n }, (_, i) => [x0 + r * Math.cos((2 * Math.PI * i) / n), y0 + r * Math.sin((2 * Math.PI * i) / n)]);
  const print = (shapes) => makeShapePrint(g, { shapes });
  // a needle: an isosceles triangle with a 4 degree tip; it is thinner than w for w / sin 4deg along each side
  const th = (4 * Math.PI) / 180, leg = 0.3 * size;
  const needle = print([{ pts: [[cx, cy], [cx + leg * Math.cos(th / 2), cy - leg * Math.sin(th / 2)], [cx + leg * Math.cos(th / 2), cy + leg * Math.sin(th / 2)]] }]);
  let R = thinParts(needle, w);
  assert.equal(R.length, 1, 'one thin part: the tip');
  assert.equal(R[0].dark, true);
  const want = (2 * w) / Math.sin(th);
  assert.ok(Math.abs(R[0].length - want) < 0.1 * want, `the tip is thin along ${R[0].length / size} tile sizes of outline, ${want / size} wanted`);
  assert.ok(R[0].width < 0.1 * w && Math.hypot(R[0].at[0] - cx, R[0].at[1] - cy) < 0.2 * want, 'thinnest at the tip');
  // a square with a slit (a hole half as wide as w): its two long sides, light (its flat ends have nothing across)
  const q = 0.15 * size, sl = 0.05 * size;
  const slit = print([{ pts: [[cx - q, cy - q], [cx + q, cy - q], [cx + q, cy + q], [cx - q, cy + q]] }, { pts: [[cx - sl, cy - w / 4], [cx + sl, cy - w / 4], [cx + sl, cy + w / 4], [cx - sl, cy + w / 4]], hole: true }]);
  R = thinParts(slit, w);
  assert.equal(R.length, 2, 'the slit\'s two sides');
  for (const r of R) {
    assert.equal(r.dark, false, 'light');
    assert.ok(Math.abs(r.length - 2 * sl) < 0.05 * sl, `a side of the slit, ${r.length / size}`);
    assert.ok(Math.abs(r.width - w / 2) < 0.01 * w, 'as wide as the slit');
  }
  // an island in a hole with a gap of w / 3 all round: the gap is a thin light part (on both outlines)
  const isle = print([{ pts: ring(0.2 * size, 300, cx, cy) }, { pts: ring(0.1 * size, 300, cx, cy), hole: true }, { pts: ring(0.1 * size - w / 3, 300, cx, cy) }]);
  R = thinParts(isle, w);
  assert.ok(R.length >= 2 && R.every((r) => !r.dark), 'light');
  assert.ok(R[0].length > 0.9 * 2 * Math.PI * 0.1 * size, 'all round');
  // gentle bends are not thin: a disc, a fat comma
  assert.deepEqual(thinParts(print([{ pts: ring(0.15 * size, 400, cx, cy) }]), w), []);
  // ... but a blob smaller than the width is thin all round
  R = thinParts(print([{ pts: ring(0.3 * w, 60, cx, cy) }]), w);
  assert.equal(R.length, 1); assert.equal(R[0].dark, true);
  assert.ok(Math.abs(R[0].length - 2 * Math.PI * 0.3 * w) < 0.05 * w, 'its whole outline');
  // the page's comma: its tail is a needle
  const C = CASES.find((c) => c.motif === 'comma' && c.g.id === 'o');
  R = thinParts(C.P, w);
  assert.ok(R.length >= 1 && R[0].dark, 'the comma\'s tail');
  assert.deepEqual(thinParts(C.P, 0), [], 'width 0: nothing');
});

test('shape prints: shapeElements lists every element whose copy reaches the box, each once; copiesIn gives their polygons, outer ones counter-clockwise', () => {
  let boxes = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C, rnd = prng(31 + CASES.indexOf(C));
    for (let b = 0; b < 6; b++) {
      // boxes of every size, down to one much smaller than a tile, and one given the wrong way round
      const w = [1.8, 0.9, 0.5 * size, 0.08 * size, 3 * size, 1.1][b], h = [1.6, 0.3, 0.6 * size, 0.05 * size, 0.2 * size, 1.3][b];
      const mx = g.center[0] + (rnd() - 0.5) * 2, my = g.center[1] + (rnd() - 0.5) * 2;
      const box = b === 5 ? [mx + w / 2, my + h / 2, mx - w / 2, my - h / 2] : [mx - w / 2, my - h / 2, mx + w / 2, my + h / 2];
      const x0 = mx - w / 2, y0 = my - h / 2, x1 = mx + w / 2, y1 = my + h / 2;
      const els = shapeElements(P, box), key = (e) => `${e.rep}|${Math.round(e.tx * 1e6)}|${Math.round(e.ty * 1e6)}`, seen = new Set(els.map(key));
      assert.equal(seen.size, els.length, `${label}: each element once`);
      for (const e of els) {
        assert.ok(contains(g, e), `${label}: ${JSON.stringify(e)} is an element of the group`);
        const r = g.reps[e.rep];
        assert.ok(r.a === e.a && r.b === e.b && r.c === e.c && r.d === e.d, `${label}: rep`);
        // its bounding circle meets the box
        const px = e.a * P.cx + e.b * P.cy + e.tx, py = e.c * P.cx + e.d * P.cy + e.ty;
        assert.ok(Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1)) <= P.R * (1 + 1e-6), `${label}: a listed copy can touch the box`);
      }
      // none that reaches in is left out: every element near whose copy has a vertex in the box, or holds the box's middle
      for (const e of elementsNear(g, mx, my, Math.hypot(w, h) / 2 + P.R + 0.01, P.cx, P.cy)) {
        let reaches = false;
        for (const poly of P.polys) for (let k = 0; k < poly.pts.length && !reaches; k += 2) {
          const x = e.a * poly.pts[k] + e.b * poly.pts[k + 1] + e.tx, y = e.c * poly.pts[k] + e.d * poly.pts[k + 1] + e.ty;
          if (x >= x0 && x <= x1 && y >= y0 && y <= y1) reaches = true;
        }
        if (reaches) assert.ok(seen.has(key(e)), `${label}: the copy of ${JSON.stringify(e)} has a vertex in the box ${box} and is not listed`);
      }
      // (a box inside a mark holds no vertex: the tone there must still come out of the listed copies)
      const cop = copiesIn(P, box);
      assert.equal(cop.length, els.length * P.polys.length, label);
      cop.forEach((q, i) => {
        const e = els[Math.floor(i / P.polys.length)], src = P.polys[i % P.polys.length], n = q.pts.length / 2;
        assert.ok(q.pts instanceof Float64Array && n === src.pts.length / 2, label);
        assert.equal(q.hole, src.hole, label);
        const A = areaOf(q.pts);
        assert.ok(q.hole ? A < 0 : A > 0, `${label}: a copy's ${q.hole ? 'hole runs clockwise' : 'outer polygon runs counter-clockwise'} (a mirrored copy too)`);
        assert.ok(Math.abs(Math.abs(A) - src.area) < 1e-9 * (1 + src.area), `${label}: the copy has the motif's area`);
        // the points are the motif's, carried by the element (backwards when it mirrors)
        const flip = det(e) < 0;
        for (let k = 0; k < n; k += Math.max(1, n >> 3)) {
          const s = flip ? n - 1 - k : k, x = e.a * src.pts[2 * s] + e.b * src.pts[2 * s + 1] + e.tx, y = e.c * src.pts[2 * s] + e.d * src.pts[2 * s + 1] + e.ty;
          assert.ok(Math.abs(q.pts[2 * k] - x) < 1e-12 && Math.abs(q.pts[2 * k + 1] - y) < 1e-12, `${label}: point ${k} of a copy`);
          assert.ok(x >= q.box[0] && x <= q.box[2] && y >= q.box[1] && y <= q.box[3], `${label}: box of a copy`);
        }
      });
      // W inside the box, from these polygons alone
      const subs = cop.map((q) => { const pts = []; for (let k = 0; k < q.pts.length; k += 2) pts.push([q.pts[k], q.pts[k + 1]]); return { pts, box: q.box }; });
      for (let i = 0; i < 25; i++) {
        const x = x0 + rnd() * w, y = y0 + rnd() * h;
        if (P.margin(x, y) < 1e-6 * size) continue;
        assert.equal(windingNumber(subs, x, y), P.winding(x, y), `${label}: W from copiesIn at (${x}, ${y}) in the box ${box}`);
      }
      boxes++;
    }
    assert.deepEqual(shapeElements(P, [0, 0, NaN, 1]), [], 'a box that is no box');
    assert.deepEqual(shapeElements(null, [0, 0, 1, 1]), []); assert.deepEqual(copiesIn(null, [0, 0, 1, 1]), []);
  }
  assert.equal(boxes, CASES.length * 6);
});

// ---- a group that was moved ------------------------------------------------------------------------------------------------

test('shape prints: a group turned, scaled and shifted, with the motif carried along, gives the carried tone (a print keeps only e1, e2 and reps of its group)', () => {
  const rnd = prng(2026);
  let n = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C, L = Math.max(len(g.e1), len(g.e2));
    for (let k = 0; k < 4; k++) {
      const th = k < 2 ? [0.3, 3.66][k] : rnd() * TAU, sc = k < 1 ? 1 : 0.4 + 2.2 * rnd(), v = k === 0 ? [0, 0] : [3 * rnd() - 1.5, 3 * rnd() - 1.5];
      const h = moved(g, th, sc, v), T = mover(th, sc, v), where = `${label} turned ${th.toFixed(3)}, scaled ${sc.toFixed(3)}, shifted ${v.map((x) => x.toFixed(3))}`;
      const Q = makeShapePrint(h, { key: C.motif, shapes: carry(C.shapes, T) });
      assert.ok(Math.abs(Q.size - sc * size) < 1e-9 * sc && Math.abs(Q.cell - sc * P.cell) < 1e-9 * sc && Math.abs(Q.R - sc * P.R) < 1e-9 * sc, `${where}: size, cell, R`);
      const c = T(P.cx, P.cy);
      assert.ok(Math.hypot(Q.cx - c[0], Q.cy - c[1]) < 1e-9 * sc, `${where}: the bounding circle moves along`);
      let pts = 0;
      for (let i = 0; i < 4000 && pts < 120; i++) {
        const x = g.center[0] + (2 * rnd() - 1) * 1.7 * L, y = g.center[1] + (2 * rnd() - 1) * 1.7 * L, m = P.margin(x, y);
        if (m < 1e-6 * size) continue;
        pts++;
        const q = T(x, y);
        assert.equal(Q.winding(q[0], q[1]), P.winding(x, y), `${where}: W at (${x}, ${y})`);
        assert.equal(Q.tone(q[0], q[1]), P.tone(x, y), where);
        assert.ok(Math.abs(Q.margin(q[0], q[1]) - sc * m) < 1e-9 * sc * (1 + size), `${where}: the margin scales`);
      }
      assert.equal(pts, 120, where);
      // the rules are kept there as here, with the same gap (it is counted in tile sizes) and the same stabiliser
      const V = validateShapes(Q), V0 = validateShapes(P);
      assert.deepEqual(V.problems, [], where);
      assert.equal(V.stabilizer, C.order, where);
      assert.ok(Math.abs(V.gap - V0.gap) < 1e-7, `${where}: gap ${V.gap} for ${V0.gap}`);
      n++;
    }
  }
  assert.equal(n, CASES.length * 4);
  // the lattice-relative rule of the blob finds a place in a moved group by itself, and the print there is the group's
  for (const g of GROUPS) {
    const h = moved(g, 1.234, 1.7, [0.4, -0.9]), B = blobShapes(h), Q = makeShapePrint(h, { shapes: B.shapes });
    assert.deepEqual(validateShapes(Q).problems, [], `${g.id} moved: a blob by the rule`);
    assert.equal(Q.winding(B.hole[0], B.hole[1]), 1); assert.equal(Q.winding(B.hole[0] + 0.13 * B.rho, B.hole[1]), 0);
    const G = gens(h), r2 = prng(5);
    for (let i = 0, pts = 0; i < 2000 && pts < 60; i++) {
      const x = h.center[0] + (2 * r2() - 1) * 3, y = h.center[1] + (2 * r2() - 1) * 3;
      if (Q.margin(x, y) < 1e-6 * Q.size) continue;
      pts++;
      for (const e of G) assert.equal(Q.winding(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty), Q.winding(x, y), `${g.id} moved: ${JSON.stringify(e)}`);
    }
  }
});

test('shape prints: the print does not depend on how the group is written — other representatives of the cosets, another basis of the lattice (skew, or of the other hand)', () => {
  const keyOf = (e) => [e.a, e.b, e.c, e.d, e.tx, e.ty].map((v) => String(Math.round(v * 1e6) + 0)).join(',');
  let n = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C, rnd = prng(600 + CASES.indexOf(C)), [e1, e2] = [g.e1, g.e2], L = len(e1) + len(e2);
    const tr = (r) => { const m = Math.round(6 * rnd() - 3), k = Math.round(6 * rnd() - 3); return { a: r.a, b: r.b, c: r.c, d: r.d, tx: r.tx + m * e1[0] + k * e2[0], ty: r.ty + m * e1[1] + k * e2[1] }; };
    const ways = [
      ['other representatives', { e1, e2, reps: g.reps.map(tr) }],
      ['a skew basis', { e1: [e1[0] + 3 * e2[0], e1[1] + 3 * e2[1]], e2, reps: g.reps }],
      ['the basis of the other hand, the representatives backwards', { e1: e2, e2: e1, reps: g.reps.slice().reverse() }],
      ['a basis turned inside out, other representatives', { e1: [-e1[0] - e2[0], -e1[1] - e2[1]], e2: [2 * e1[0] + e2[0], 2 * e1[1] + e2[1]], reps: g.reps.map(tr) }],
    ];
    const V0 = validateShapes(P), box = [g.center[0] - 0.7, g.center[1] - 0.6, g.center[0] + 0.5, g.center[1] + 0.8], els0 = new Set(shapeElements(P, box).map(keyOf));
    for (const [name, h] of ways) {
      const Q = makeShapePrint(h, { shapes: C.shapes }), where = `${label}, ${name}`;
      assert.ok(Math.abs(Q.size - size) < 1e-12 && Math.abs(Q.cx - P.cx) < 1e-12 && Q.R === P.R && Q.verts === P.verts, where);
      for (let i = 0, pts = 0; i < 3000 && pts < 100; i++) {
        const x = g.center[0] + (2 * rnd() - 1) * 1.5 * L, y = g.center[1] + (2 * rnd() - 1) * 1.5 * L, m = P.margin(x, y);
        assert.ok(Math.abs(Q.margin(x, y) - m) < 1e-9 * (1 + size), `${where}: margin at (${x}, ${y})`);
        if (m < 1e-6 * size) continue;
        pts++;
        assert.equal(Q.winding(x, y), P.winding(x, y), `${where}: W at (${x}, ${y})`);
      }
      // the same copies near a box, whatever they are called
      const els = shapeElements(Q, box);
      assert.equal(els.length, els0.size, `${where}: as many copies near the box`);
      for (const e of els) assert.ok(els0.has(keyOf(e)), `${where}: ${JSON.stringify(e)} is a copy near the box`);
      const V = validateShapes(Q);
      assert.deepEqual(V.problems, [], where); assert.equal(V.stabilizer, V0.stabilizer, where); assert.ok(Math.abs(V.gap - V0.gap) < 1e-9, where);
      n++;
    }
  }
  assert.equal(n, CASES.length * 4);
  // the numbers are the pattern's, too
  const C = casesOf('blob').find((c) => c.g.id === '*x'), g = C.g;
  const M0 = measureShapes(C.P, { per: 30 }), M1 = measureShapes(makeShapePrint({ e1: [g.e1[0] + 3 * g.e2[0], g.e1[1] + 3 * g.e2[1]], e2: g.e2, reps: g.reps }, { shapes: C.shapes }), { per: 30 });
  assert.equal(M1.coverage, M0.coverage, 'coverage is sampled on the lattice\'s reduced basis, whatever basis the group gives');
  assert.ok(Math.abs(M1.coverageExact - M0.coverageExact) < 1e-12 && M1.overlap === 0);
});

// ---- the rules ---------------------------------------------------------------------------------------------------------

test('shape prints: validateShapes passes every good motif — the stabiliser\'s order, the gap the copies keep', (t) => {
  assert.equal(GAP_MIN, 0.02); assert.equal(MAX_VERTS, 2400);
  const rows = [];
  for (const C of CASES) {
    const V = validateShapes(C.P);
    assert.deepEqual(V.problems, [], C.label);
    assert.equal(V.ok, true, C.label);
    assert.equal(V.stabilizer, C.order, `${C.label}: the stabiliser's order`);
    assert.ok(V.gap >= GAP_MIN && V.gap < 4, `${C.label}: the copies keep ${V.gap}`);
    // the motifs of the test keep 0.16 clearances + 0.025 tile sizes by construction
    if (C.rho !== undefined) assert.ok(V.gap >= 0.025, `${C.label}: gap ${V.gap}`);
    rows.push(`${C.label.padEnd(14)} gap ${V.gap.toFixed(4)}  stabiliser ${V.stabilizer}`);
  }
  // the page's comma keeps FILL_GAP = 0.07 (src/motif.js found its place with its own distance code): the two agree
  for (const C of casesOf('comma')) assert.ok(validateShapes(C.P).gap >= 0.07 - 1e-3, `${C.label}: the comma's copies keep ${validateShapes(C.P).gap}`);
  // the gap by brute force: every edge of the motif against every edge of every other copy that can be that near
  // (a copy whose bounding circle is farther off than the gap found cannot be nearer; the copies that coincide with
  // the motif are the elements that fix the point it sits on)
  const cross = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx), d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  const keyOf = (e) => `${e.rep}|${Math.round(e.tx * 1e6)}|${Math.round(e.ty * 1e6)}`;
  let pairs = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C, V = validateShapes(P), same = new Set(stabiliserAt(g, C.order > 1 ? C.at[0] : P.cx, C.order > 1 ? C.at[1] : P.cy).map(keyOf));
    assert.equal(same.size, C.order, label);
    let best = Infinity;
    for (const e of elementsNear(g, P.cx, P.cy, 2 * P.R + V.gap * size + 1e-9, P.cx, P.cy)) {
      if (same.has(keyOf(e))) continue;
      pairs++;
      for (const A of P.polys) for (const B of P.polys) {
        const p = A.pts, q = B.pts, n = p.length / 2, m = q.length / 2, Q = new Float64Array(2 * m), qb = [Infinity, Infinity, -Infinity, -Infinity];
        for (let j = 0; j < m; j++) {
          const x = e.a * q[2 * j] + e.b * q[2 * j + 1] + e.tx, y = e.c * q[2 * j] + e.d * q[2 * j + 1] + e.ty;
          Q[2 * j] = x; Q[2 * j + 1] = y; qb[0] = Math.min(qb[0], x); qb[1] = Math.min(qb[1], y); qb[2] = Math.max(qb[2], x); qb[3] = Math.max(qb[3], y);
        }
        for (let i = 0, i0 = n - 1; i < n; i0 = i++) {
          const ax = p[2 * i0], ay = p[2 * i0 + 1], bx = p[2 * i], by = p[2 * i + 1];
          // (an edge farther from the other polygon's box than the best so far cannot do better)
          if (Math.hypot(Math.max(qb[0] - Math.max(ax, bx), 0, Math.min(ax, bx) - qb[2]), Math.max(qb[1] - Math.max(ay, by), 0, Math.min(ay, by) - qb[3])) > best) continue;
          for (let j = 0, j0 = m - 1; j < m; j0 = j++) {
            const cx = Q[2 * j0], cy = Q[2 * j0 + 1], dx = Q[2 * j], dy = Q[2 * j + 1];
            const d = cross(ax, ay, bx, by, cx, cy, dx, dy) ? 0 : Math.min(pointSeg(ax, ay, cx, cy, dx, dy), pointSeg(bx, by, cx, cy, dx, dy), pointSeg(cx, cy, ax, ay, bx, by), pointSeg(dx, dy, ax, ay, bx, by));
            if (d < best) best = d;
          }
        }
      }
    }
    assert.ok(Math.abs(best - V.gap * size) < 1e-9 * (1 + size), `${label}: the gap is ${best / size} tile sizes by brute force, validateShapes says ${V.gap}`);
  }
  assert.ok(pairs >= CASES.length, `${pairs} pairs of copies`);
  // a known gap: discs round a generic place, 0.008 tile sizes apart (128-gons: a hair more)
  for (const g of GROUPS) {
    const place = genericPlace(g), size = sizeOf(g), r = (place.D - 0.008 * size) / 2;
    const P = makeShapePrint(g, { shapes: [ring(place.x, place.y, 128, () => r, 0.123)] }), V = validateShapes(P);
    assert.ok(V.gap >= 0.008 - 1e-9 && V.gap < 0.008 + (2 * r * (1 - Math.cos(Math.PI / 128))) / size + 1e-9, `${g.id}: discs 0.008 apart, found ${V.gap}`);
    assert.equal(V.ok, false, g.id);
    assert.equal(V.problems.length, 1, `${g.id}: ${V.problems}`);
    assert.match(V.problems[0], /come within 0\.008\d* tile sizes of each other near \(-?[\d.]+, -?[\d.]+\): the rule is 0\.02/, g.id);
    assert.deepEqual(validateShapes(P, { gap: 0.0079 }).problems, [], `${g.id}: the same discs under a rule of 0.0079`);
    assert.equal(validateShapes(P, { gap: 0.009 }).ok, false);
    // the place the message names is the middle of the gap: half the gap from the outlines (it is written to 4 decimals)
    const m = /near \((-?[\d.]+), (-?[\d.]+)\)/.exec(V.problems[0]);
    assert.ok(Math.abs(P.margin(+m[1], +m[2]) - (V.gap * size) / 2) < 1.5e-4, `${g.id}: the place named is in the gap (margin ${P.margin(+m[1], +m[2]) / size} tile sizes)`);
    assert.equal(P.tone(+m[1], +m[2]), 0, g.id);
  }
  for (const r of rows) t.diagnostic(r);
});

test('shape prints: validateShapes catches planted faults — copies that overlap, a hole outside, a bow-tie, too many vertices, a motif on a centre without its symmetry', () => {
  const kinds = { blown: 0, hole: 0, bow: 0, many: 0, centre: 0, off: 0, twice: 0, touch: 0, nested: 0 };
  const some = (V, re, what) => { assert.equal(V.ok, false, what); assert.ok(V.problems.some((p) => re.test(p)), `${what}: ${JSON.stringify(V.problems)}`); };
  for (const g of GROUPS) {
    const size = sizeOf(g), m = motifFor(g), comma = commaShapes(g)[0];
    // the comma blown up 2.5 times about its middle: 6 times the area, more than the plane holds
    {
      const big = pointsOf(comma).map(([x, y]) => [m.at[0] + 2.5 * (x - m.at[0]), m.at[1] + 2.5 * (y - m.at[1])]);
      const V = validateShapes(makeShapePrint(g, { shapes: [big] }));
      some(V, /two copies of the motif cross or touch near/, `${g.id}: a comma blown up`);
      assert.equal(V.gap, 0, g.id);
      kinds.blown++;
    }
    const B = blobShapes(g), [outer, hole, island] = B.shapes;
    // the hole moved out of the blob, to where the blob is thin; the island stays behind, inside the blob
    {
      const dx = B.rho * Math.cos(2.64), dy = B.rho * Math.sin(2.64), out = { pts: hole.pts.map(([x, y]) => [x + dx, y + dy]), hole: true };
      const V = validateShapes(makeShapePrint(g, { shapes: [outer, out, island] }));
      some(V, /polygon 1, a hole, does not lie inside an outer polygon of the motif/, `${g.id}: a hole outside`);
      some(V, /polygon 2 lies inside another polygon of the motif/, `${g.id}: the island without its hole`);
      // ... and half way out: its outline crosses the blob's
      const half = { pts: hole.pts.map(([x, y]) => [x + 0.55 * dx, y + 0.55 * dy]), hole: true };
      some(validateShapes(makeShapePrint(g, { shapes: [outer, half] })), /polygons 0 and 1 of the motif cross or touch near/, `${g.id}: a hole across the outline`);
      // a hole alone
      some(validateShapes(makeShapePrint(g, { shapes: [hole] })), /no outer polygon/, `${g.id}: only a hole`);
      kinds.hole++;
    }
    // a bow-tie, and a comma with two of its points swapped
    {
      const s = 0.3 * B.rho, [x, y] = B.at, bow = [[x - s, y - s], [x + s, y + s], [x + s, y - s], [x - s, y + 0.6 * s]];
      some(validateShapes(makeShapePrint(g, { shapes: [bow] })), /polygon 0 crosses itself near/, `${g.id}: a bow-tie`);
      const p = pointsOf(comma), q = p.slice(); q[10] = p[40]; q[40] = p[10];
      some(validateShapes(makeShapePrint(g, { shapes: [q] })), /polygon 0 crosses itself near/, `${g.id}: a comma with two points swapped`);
      kinds.bow++;
    }
    // 5000 vertices
    {
      const V = validateShapes(makeShapePrint(g, { shapes: [ring(B.at[0], B.at[1], 5000, () => 0.5 * B.rho)] }));
      some(V, /the motif has 5000 vertices: more than 2400/, `${g.id}: 5000 vertices`);
      assert.equal(V.problems.length, 1, `${g.id}: a fine circle is otherwise in order: ${V.problems}`);
      assert.ok(validateShapes(makeShapePrint(g, { shapes: [ring(B.at[0], B.at[1], MAX_VERTS, () => 0.5 * B.rho)] })).ok, `${g.id}: 2400 vertices are allowed`);
      // far too many: said so, and nothing else is looked at (the print itself still works)
      if (g.id === '22x') {
        const huge = makeShapePrint(g, { shapes: [ring(B.at[0], B.at[1], 40001, () => 0.5 * B.rho)] }), H = validateShapes(huge);
        assert.equal(H.ok, false); assert.equal(H.problems.length, 2, String(H.problems));
        assert.match(H.problems[1], /its outlines were not looked at \(more than 40000 vertices\)/);
        assert.equal(huge.tone(B.at[0], B.at[1]), 1); assert.ok(Math.abs(huge.margin(B.at[0], B.at[1]) - 0.5 * B.rho) < 1e-6 * B.rho);
      }
      kinds.many++;
    }
    // two outer polygons of one motif on each other; one inside the other; two that share a corner
    {
      const [x, y] = B.at, r = 0.3 * B.rho, sq = (cx, cy, h) => [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
      some(validateShapes(makeShapePrint(g, { shapes: [sq(x, y, r), sq(x + r, y + 0.5 * r, r)] })), /polygons 0 and 1 of the motif cross or touch near/, `${g.id}: two squares across each other`);
      some(validateShapes(makeShapePrint(g, { shapes: [sq(x, y, r), sq(x, y, 0.4 * r)] })), /polygon 1 lies inside another polygon of the motif/, `${g.id}: a square in a square`);
      const V = validateShapes(makeShapePrint(g, { shapes: [sq(x - r, y - r, r), sq(x + r, y + r, r)] }));
      some(V, /polygons 0 and 1 of the motif cross or touch near/, `${g.id}: two squares corner to corner`);
      kinds.twice++;
      // a square with a notch cut to a point of its own rim: it touches itself
      const pinch = [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x, y + r], [x + 0.5 * r, y], [x - 0.5 * r, y], [x, y + r], [x - r, y + r]];
      some(validateShapes(makeShapePrint(g, { shapes: [pinch] })), /polygon 0 touches itself near/, `${g.id}: a pinched polygon`);
      // a square with a spike that has no width (out along a line and back along it, to a point short of where it left)
      const spiked = [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x, y + r], [x, y + 1.5 * r], [x, y + 1.2 * r], [x - r, y + r]];
      some(validateShapes(makeShapePrint(g, { shapes: [spiked] })), /polygon 0 touches itself near/, `${g.id}: a spike without width`);
      // three points on a line: a polygon, but of nothing
      const flat = makeShapePrint(g, { shapes: [sq(x, y, r), [[x + 2 * r, y], [x + 2.5 * r, y], [x + 3 * r, y]]] });
      some(validateShapes(flat), /polygon 1 has no area/, `${g.id}: three points on a line`);
      assert.ok(Math.abs(flat.netArea - 4 * r * r) < 1e-12); assert.equal(flat.winding(x + 2.4 * r, y), 0);
      kinds.touch++;
    }
    // a small disc one lattice vector away from a large one: it lies INSIDE the next copy of the large one, and no two
    // outlines come near each other. Only the test "is a copy inside another" sees it.
    {
      const place = genericPlace(g), r = 0.3 * place.D, [u] = reduced(g.e1, g.e2);
      const P = makeShapePrint(g, { shapes: [ring(place.x, place.y, 48, () => r), ring(place.x + u[0], place.y + u[1], 24, () => 0.3 * r)] }), V = validateShapes(P);
      some(V, /a copy of the motif lies inside another near/, `${g.id}: a disc inside the next copy`);
      assert.equal(V.problems.length, 1, `${g.id}: ${V.problems}`);
      assert.ok(V.gap > 0.04, `${g.id}: its outlines are ${V.gap} apart`);
      assert.equal(P.winding(place.x, place.y), 2, g.id);
      const M = measureShapes(P, { per: 48 });
      assert.equal(M.coverageExact, null, g.id); assert.ok(M.overlap > 0, `${g.id}: overlap ${M.overlap}`);
      kinds.nested++;
    }
  }
  // a motif ON a centre or a mirror that has not that symmetry: the comma put there; the rosette a hair off its centre
  for (const C of casesOf('centre').concat(casesOf('mirror'))) {
    const { g, label, at, rho } = C, m = motifFor(g), k = 0.9 * rho / m.radius;
    const comma = pointsOf(commaShapes(g)[0]).map(([x, y]) => [at[0] + k * (x - m.at[0]), at[1] + k * (y - m.at[1])]);
    const V = validateShapes(makeShapePrint(g, { shapes: [comma] }));
    assert.equal(V.ok, false, `${label}: a comma on it`);
    assert.ok(V.problems.some((p) => /two copies of the motif cross or touch|lies inside another/.test(p)), `${label}: ${V.problems}`);
    assert.equal(V.stabilizer, 1, `${label}: the comma has no symmetry`);
    kinds.centre++;
    const off = carry(C.shapes, (x, y) => [x + 0.013 * rho, y + 0.007 * rho]), W = validateShapes(makeShapePrint(g, { shapes: off }));
    assert.equal(W.ok, false, `${label}: the motif a hair off its place`);
    assert.equal(W.stabilizer, 1, label);
    assert.ok(W.problems.some((p) => /cross or touch/.test(p)), `${label}: ${W.problems}`);
    assert.match(W.problems[0], /the motif has a symmetry of the group only roughly: a copy of it strays up to [\d.e-]+ tile sizes/, `${label}: said in so many words`);
    // ... and with its symmetry spoiled by a ten-thousandth (a motif that was made symmetric by a method that is not exact)
    const rough = C.shapes.map((s) => ({ hole: s.hole, pts: s.pts.map(([x, y]) => { const f = 1 + 1e-4 * Math.cos(Math.atan2(y - at[1], x - at[0]) - 0.3); return [at[0] + f * (x - at[0]), at[1] + f * (y - at[1])]; }) }));
    const U = validateShapes(makeShapePrint(g, { shapes: rough }));
    assert.equal(U.ok, false, `${label}: nearly symmetric`); assert.equal(U.stabilizer, 1, label);
    assert.match(U.problems[0], /only roughly: a copy of it strays up to \d(\.\d)?e-[45] tile sizes from the motif itself \("coincide" is within 1e-6\)/, `${label}: ${U.problems}`);
    assert.ok(U.problems.some((p) => /cross or touch/.test(p)), `${label}: ${U.problems}`);
    kinds.off++;
  }
  assert.deepEqual(kinds, { blown: 17, hole: 17, bow: 17, many: 17, centre: 23, off: 23, twice: 17, touch: 17, nested: 17 });
});

// ---- the numbers ---------------------------------------------------------------------------------------------------------

test('shape prints: measureShapes — the sampled share of dark agrees with the exact area within 1.5 % for the comma of every group; discs of a known pattern', (t) => {
  const rows = [];
  for (const C of casesOf('comma')) {
    const { g, P, label } = C, M = measureShapes(P);
    const exact = P.netArea / g.domainArea;
    assert.ok(Math.abs(M.coverageExact - exact) < 1e-12, `${label}: coverageExact`);
    assert.ok(Math.abs(M.coverage / exact - 1) < 0.015, `${label}: sampled ${M.coverage}, exact ${exact.toFixed(4)}`);
    assert.equal(M.overlap, 0, label); assert.equal(M.verts, 92); assert.equal(M.stabilizer, 1);
    // the comma's head is a disc of half its radius (an ellipse where the comma is stretched: *x, xx); little in it is fatter
    const sc = motifFor(g).scale, lo = Math.min(sc[0], sc[1]) / Math.sqrt(g.domainArea), hi = Math.max(sc[0], sc[1]) / Math.sqrt(g.domainArea);
    assert.ok(M.darkDisc > lo - 0.04 && M.darkDisc < 1.25 * hi + 0.04, `${label}: the fattest disc ${M.darkDisc}, the head ${lo.toFixed(3)} by ${hi.toFixed(3)}`);
    assert.ok(M.emptyDisc > 0.3 && M.emptyDisc < 2.6, `${label}: the largest bare patch ${M.emptyDisc}`);
    rows.push(`${g.id.padEnd(6)} dark ${M.coverage.toFixed(3)} (exact ${exact.toFixed(4)})  bare ${M.emptyDisc.toFixed(3)}  solid ${M.darkDisc.toFixed(3)}`);
  }
  // discs of radius 0.2 on the lattice points of 2222 (the 2-fold centre at the origin; 1.3 x 1.0): what the numbers must be
  {
    const g = BY_ID['2222'], size = sizeOf(g), P = makeShapePrint(g, { shapes: [ring(0, 0, 180, () => 0.2)] }), M = measureShapes(P);
    assert.equal(M.stabilizer, 2);
    assert.ok(Math.abs(M.darkDisc - 0.4 / size) < 0.04, `the discs are ${M.darkDisc} across, ${(0.4 / size).toFixed(3)} is right`);
    assert.ok(Math.abs(M.emptyDisc - (2 * (Math.hypot(0.65, 0.5) - 0.2)) / size) < 0.04, `the largest bare disc ${M.emptyDisc}, ${((2 * (Math.hypot(0.65, 0.5) - 0.2)) / size).toFixed(3)} is right`);
    assert.ok(Math.abs(M.coverageExact - (Math.PI * 0.04) / 1.3) < 1e-4 && Math.abs(M.coverage - M.coverageExact) < 0.004, `dark ${M.coverage}, exact ${M.coverageExact}`);
    assert.equal(M.overlap, 0, 'two copies on each other are one mark');
    // a finer grid comes nearer, a coarse one is still near
    assert.ok(Math.abs(measureShapes(P, { per: 100 }).emptyDisc - (2 * (Math.hypot(0.65, 0.5) - 0.2)) / size) < 0.022);
    assert.ok(Math.abs(measureShapes(P, { per: 20 }).coverage - M.coverageExact) < 0.012);
    // the window may be put anywhere: the numbers are the pattern's
    const N = measureShapes(P, { center: [5.03, -2.2] });
    assert.ok(Math.abs(N.emptyDisc - M.emptyDisc) < 0.04 && Math.abs(N.darkDisc - M.darkDisc) < 0.04 && N.coverage === M.coverage);
  }
  // motifs with coincident copies, holes and islands: the areas still add up
  for (const C of CASES) {
    if (C.motif === 'comma') continue;
    const M = measureShapes(C.P, { per: 36 }), exact = C.P.netArea / (C.order * C.g.domainArea);
    assert.ok(Math.abs(M.coverageExact - exact) < 1e-12, `${C.label}: coverageExact ${M.coverageExact}`);
    assert.ok(Math.abs(M.coverage - exact) < 0.012, `${C.label}: sampled ${M.coverage}, exact ${exact.toFixed(4)}`);
    assert.equal(M.overlap, 0, C.label); assert.equal(M.stabilizer, C.order, C.label);
  }
  // copies that overlap: the share that is covered twice, and no exact number
  for (const id of ['o', '*x', '22x', '333', '*632']) {
    const g = BY_ID[id], m = motifFor(g);
    const big = pointsOf(commaShapes(g)[0]).map(([x, y]) => [m.at[0] + 2.5 * (x - m.at[0]), m.at[1] + 2.5 * (y - m.at[1])]);
    const M = measureShapes(makeShapePrint(g, { shapes: [big] }), { per: 30 });
    assert.equal(M.coverageExact, null, id);
    assert.ok(M.overlap > 0.05 && M.coverage > 0.5, `${id}: overlap ${M.overlap}, dark ${M.coverage}`);
  }
  for (const r of rows) t.diagnostic(r);
});

// ---- the kit ---------------------------------------------------------------------------------------------------------

test('shape prints: the same W as dev/patterns/kit.js, the kit the designs were drawn with; the same two discs', { skip: kit ? false : 'dev/patterns/kit.js is not here' }, () => {
  let n = 0;
  for (const C of CASES) {
    const { g, P, size, label } = C, N = kit.normalize(C.shapes.map((s) => ({ pts: pointsOf(s), hole: !!s.hole }))), rnd = prng(3 + CASES.indexOf(C)), L = len(g.e1) + len(g.e2);
    assert.equal(N.verts, P.verts, label);
    N.polys.forEach((q, i) => { assert.equal(q.hole, P.polys[i].hole); assert.ok(Math.abs(q.area - P.polys[i].area) < 1e-12); for (let k = 0; k < 4; k++) assert.ok(Math.abs(q.box[k] - P.polys[i].box[k]) < 1e-12, label); });
    for (let i = 0, pts = 0; i < 4000 && pts < 150; i++) {
      const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
      if (P.margin(x, y) < 1e-6 * size) continue;
      pts++; n++;
      assert.equal(P.winding(x, y), kit.windingAt(g, N, x, y), `${label}: W at (${x}, ${y})`);
      assert.equal(P.tone(x, y), kit.toneAt(g, N, x, y), label);
    }
    // fillShapes draws what kit.fillOrbit draws: the same W from either path
    const box = [g.center[0] - 0.5, g.center[1] - 0.4, g.center[0] + 0.5, g.center[1] + 0.4], a = recorder(), b = recorder(), id = (x, y, o) => { o[0] = x; o[1] = y; return o; };
    fillShapes(a, P, id, box, '#000'); kit.fillOrbit(b, g, N, id, box, '#000');
    const sa = boxedSubs(a.fills[0].path), sb = boxedSubs(b.fills[0].path);
    for (let i = 0; i < 60; i++) { const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]); if (P.margin(x, y) > 1e-6 * size) assert.equal(windingNumber(sa, x, y), windingNumber(sb, x, y), label); }
  }
  assert.ok(n >= CASES.length * 150);
  // ... also for a motif that breaks the rules: copies on each other (the comma 2.5 times its size), a bow-tie
  for (const g of GROUPS) {
    const m = motifFor(g), big = pointsOf(commaShapes(g)[0]).map(([x, y]) => [m.at[0] + 2.5 * (x - m.at[0]), m.at[1] + 2.5 * (y - m.at[1])]);
    const s = 0.3 * m.radius, bow = [[m.at[0] - s, m.at[1] - s], [m.at[0] + s, m.at[1] + s], [m.at[0] + s, m.at[1] - s], [m.at[0] - s, m.at[1] + 0.6 * s]];
    for (const shapes of [[big], [bow], [big, { pts: bow, hole: true }]]) {
      const P = makeShapePrint(g, { shapes }), N = kit.normalize(shapes.map((q) => ({ pts: q.pts || q, hole: !!q.hole }))), rnd = prng(17), L = len(g.e1) + len(g.e2);
      let deepest = 0;
      for (let i = 0; i < 120; i++) {
        const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
        if (P.margin(x, y) < 1e-7 * P.size) continue;
        const W = P.winding(x, y);
        assert.equal(W, kit.windingAt(g, N, x, y), `${g.id}: W of a motif that breaks the rules, at (${x}, ${y})`);
        deepest = Math.max(deepest, W);
      }
      if (shapes.length === 1 && shapes[0] === big) assert.ok(deepest >= 2, `${g.id}: copies on each other`);
    }
  }
  // the two discs, measured on the kit's own window (the group's centre). With the kit of 13 Nov the samples are the
  // same ones and the numbers equal; the bound here is the grid's step, so that a kit with another window still passes.
  for (const id of ['2222', '*x', '333', '4*2']) {
    const C = casesOf('comma').find((c) => c.g.id === id), N = kit.normalize(C.shapes.map((s) => ({ pts: pointsOf(s) })));
    const K = kit.measure(C.g, N, { per: 20 }), M = measureShapes(C.P, { per: 20, center: C.g.center });
    assert.ok(Math.abs(M.emptyDisc - K.emptyDisc) < 0.11 && Math.abs(M.darkDisc - K.darkDisc) < 0.11, `${id}: discs ${M.emptyDisc}, ${M.darkDisc}; the kit ${K.emptyDisc}, ${K.darkDisc}`);
    assert.equal(K.overlap, 0); assert.equal(M.overlap, 0);
  }
});

// ---- the texture -------------------------------------------------------------------------------------------------------

/** The lattice coordinates of a world point in the cell of a baked texture. */
function texCoords(T, x, y) {
  const d = T.e1[0] * T.e2[1] - T.e1[1] * T.e2[0], dx = x - T.origin[0], dy = y - T.origin[1];
  return [(dx * T.e2[1] - dy * T.e2[0]) / d, (T.e1[0] * dy - T.e1[1] * dx) / d];
}
/** The longer diagonal of a texel: no point of a bilinear patch is farther than this from any of its four texel centres. */
const texDiag = (T) => Math.max(Math.hypot(T.e1[0] + T.e2[0], T.e1[1] + T.e2[1]), Math.hypot(T.e1[0] - T.e2[0], T.e1[1] - T.e2[1])) / T.size;

test('shape prints: bakeShapes — the texture read as the shader reads it has the print\'s tone wherever the outline is more than a texel away (4000 points of the plane, every group, every motif); its bytes are the print\'s own distance', (t) => {
  let pts = 0, texels = 0, worst = 0, minFar = Infinity, minDeep = Infinity;
  const rows = [];
  for (const C of CASES) {
    const { g, P, label } = C, size = 256, T = bakeShapes(P, size);
    // what it is
    assert.ok(Object.isFrozen(T) && Object.isFrozen(T.origin) && Object.isFrozen(T.e1) && Object.isFrozen(T.e2), `${label}: frozen`);
    assert.deepEqual(Object.keys(T).sort(), ['data', 'e1', 'e2', 'origin', 'pitch', 'range', 'size'], label);
    assert.ok(T.data instanceof Uint8Array && T.data.length === size * size && T.size === size, label);
    assert.equal(bakeShapes(P, size), T, `${label}: the same object when asked again`);
    // its cell is a cell of the print's lattice (whole numbers, determinant +-1), reduced: the texels are no slivers
    const d = g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0];
    const co = [T.e1, T.e2].map((w) => [(w[0] * g.e2[1] - w[1] * g.e2[0]) / d, (g.e1[0] * w[1] - g.e1[1] * w[0]) / d]);
    for (const c of co.flat()) assert.ok(Math.abs(c - Math.round(c)) < 1e-9, `${label}: the texture's cell is on the lattice (${co})`);
    assert.equal(Math.abs(Math.round(co[0][0] * co[1][1] - co[0][1] * co[1][0])), 1, `${label}: one cell of the lattice`);
    const l1 = len(T.e1), l2 = len(T.e2), cos = Math.abs(T.e1[0] * T.e2[0] + T.e1[1] * T.e2[1]) / (l1 * l2);
    assert.ok(cos <= 0.5 + 1e-9, `${label}: the texture's basis is ${(Math.acos(cos) * 180 / Math.PI).toFixed(1)} degrees apart`);
    assert.ok(Math.abs(T.pitch - Math.max(l1, l2) / size) < 1e-15 && Math.abs(T.range - BAKE_RANGE * T.pitch) < 1e-15, `${label}: pitch and range`);
    // the motif's centre is the middle of the cell
    assert.ok(Math.hypot(T.origin[0] + (T.e1[0] + T.e2[0]) / 2 - P.cx, T.origin[1] + (T.e1[1] + T.e2[1]) / 2 - P.cy) < 1e-12, `${label}: origin`);
    // the bytes at the texel centres are the print's own signed distance (shapes.js margin and tone: no code of sdf.js)
    const rnd = prng(500 + CASES.indexOf(C));
    for (let k = 0; k < 500; k++) {
      const i = Math.floor(rnd() * size), j = Math.floor(rnd() * size);
      const x = T.origin[0] + ((i + 0.5) / size) * T.e1[0] + ((j + 0.5) / size) * T.e2[0], y = T.origin[1] + ((i + 0.5) / size) * T.e1[1] + ((j + 0.5) / size) * T.e2[1];
      const m = P.margin(x, y);
      if (m < 1e-9 * P.size) continue;                                   // (on an outline: either tone)
      const sd = P.tone(x, y) ? -m : m, want = 128 + 127 * Math.max(-1, Math.min(1, sd / T.range));
      assert.ok(Math.abs(T.data[j * size + i] - want) <= 0.5 + 1e-3, `${label}: texel (${i}, ${j}) is ${T.data[j * size + i]}, the print's distance gives ${want.toFixed(3)}`);
      texels++;
    }
    // read as the shader reads it, anywhere in the plane (the texture repeats)
    const diag = texDiag(T), L = len(g.e1) + len(g.e2);
    assert.ok(diag <= 1.7321 * T.pitch + 1e-12, `${label}: a texel's diagonal is ${(diag / T.pitch).toFixed(3)} pitches`);
    let far = 0, deep = 0;
    for (let k = 0; k < 4000; k++) {
      const x = g.center[0] + (2 * rnd() - 1) * 2 * L, y = g.center[1] + (2 * rnd() - 1) * 2 * L;
      const [s, u] = texCoords(T, x, y), v = sdfSample(T.data, size, s, u), m = P.margin(x, y), tone = P.tone(x, y);
      pts++;
      if (m > diag) { far++; assert.equal(v < 128 ? 1 : 0, tone, `${label}: at (${x}, ${y}), ${(m / T.pitch).toFixed(2)} pitches from an outline, the texture reads ${v.toFixed(2)} and the tone is ${tone}`); }
      const sd = tone ? -m : m, got = sdfDistance(v, T.range), slack = diag + T.range / 127;
      if (m < T.range - diag) { assert.ok(Math.abs(got - sd) <= slack, `${label}: the distance read at (${x}, ${y}) is ${got}, the print's ${sd}`); worst = Math.max(worst, Math.abs(got - sd) / T.pitch); }
      if (m > T.range + diag) { deep++; assert.equal(v, tone ? 1 : 255, `${label}: saturated beyond the range`); }
    }
    assert.ok(far > 2000 && deep > 100, `${label}: ${far} points off the outlines, ${deep} beyond the range`);
    minFar = Math.min(minFar, far); minDeep = Math.min(minDeep, deep);
    if (C.motif === 'comma') rows.push(`${g.id.padEnd(6)} the texture's cell ${T.e1.map((w) => w.toFixed(2))} | ${T.e2.map((w) => w.toFixed(2))}; a texel at ${BAKE_SIZE}: ${((1000 * T.pitch * size) / BAKE_SIZE / P.size).toFixed(2)} thousandths of a tile`);
  }
  assert.ok(pts === 4000 * CASES.length && texels > 400 * CASES.length);
  t.diagnostic(`${CASES.length} prints, ${pts} points (at least ${minFar} of 4000 off the outlines, ${minDeep} beyond the range), ${texels} texels; the distance read between texels is off by ${worst.toFixed(3)} pitches at most`);
  for (const r of rows) t.diagnostic(r);
});

test('shape prints: bakeShapes — the default size, a group that was moved, what is kept and what it throws', () => {
  assert.equal(BAKE_SIZE, 1024); assert.ok(BAKE_RANGE >= 4 && BAKE_RANGE <= 8); assert.ok(BAKE_KEEP >= 2);
  // the default: 1024 texels a side, a megabyte; the same bytes as bakeSDF gives for the copies near the cell
  for (const id of ['*x', '*632', 'xx']) {
    const C = casesOf('blob').find((c) => c.g.id === id), P = C.P, T = bakeShapes(P);
    assert.equal(T.size, BAKE_SIZE); assert.equal(T.data.length, BAKE_SIZE * BAKE_SIZE);
    assert.equal(bakeShapes(P, BAKE_SIZE), T, 'no size is the default size');
    assert.notEqual(bakeShapes(P, 64), T, 'another size is another texture');
    const xs = [0, T.e1[0], T.e2[0], T.e1[0] + T.e2[0]].map((v) => v + T.origin[0]), ys = [0, T.e1[1], T.e2[1], T.e1[1] + T.e2[1]].map((v) => v + T.origin[1]);
    const polys = copiesIn(P, [Math.min(...xs) - 2 * T.range, Math.min(...ys) - 2 * T.range, Math.max(...xs) + 2 * T.range, Math.max(...ys) + 2 * T.range]);
    const D = bakeSDF({ origin: T.origin, e1: T.e1, e2: T.e2, size: T.size, range: T.range, polys });
    let diff = 0;
    for (let i = 0; i < D.length; i++) if (D[i] !== T.data[i]) diff++;
    assert.equal(diff, 0, `${id}: ${diff} texels differ from a bake of every copy within two ranges of the cell`);
    // the texture's cell is a REDUCED basis of the lattice (|e1.e2| at most half of either square), whatever basis the
    // group is given on. (Until 14 Nov this read "|cos| < 0.2" for *x, true of its old 1.6 x 0.3 tile on a rhombus of
    // 21 degrees; the balanced *x of 13 Nov, cdf3fb6, is a 53-degree rhombus whose most orthogonal cell has |cos| 0.447.)
    const dot = Math.abs(T.e1[0] * T.e2[0] + T.e1[1] * T.e2[1]);
    assert.ok(dot <= 0.5 * Math.min(len(T.e1) ** 2, len(T.e2) ** 2) + 1e-9, `${id}: the texture's cell is not reduced`);
  }
  // a group turned, scaled and shifted, its motif carried along: the texture has the carried tone
  {
    const g = BY_ID['3*3'], th = 0.83, sc = 1.7, v = [2.4, -1.1], h = moved(g, th, sc, v), T0 = mover(th, sc, v);
    const C = casesOf('blob').find((c) => c.g === g), P = makeShapePrint(h, { shapes: carry(C.shapes, T0) }), T = bakeShapes(P, 128), rnd = prng(88), diag = texDiag(T);
    let n = 0;
    for (let k = 0; k < 1500; k++) {
      const x0 = g.center[0] + 3 * rnd() - 1.5, y0 = g.center[1] + 3 * rnd() - 1.5, [x, y] = T0(x0, y0);
      if (P.margin(x, y) <= diag) continue;
      n++;
      const [s, u] = texCoords(T, x, y);
      assert.equal(sdfSample(T.data, T.size, s, u) < 128 ? 1 : 0, C.P.tone(x0, y0), `the moved 3*3 at (${x}, ${y})`);
    }
    assert.ok(n > 900);
  }
  // kept: the BAKE_KEEP textures asked for last; one that was dropped is baked again, with the same bytes
  {
    assert.ok(BAKE_KEEP >= 3);
    const prints = casesOf('chip').slice(0, BAKE_KEEP + 1).map((c) => c.P);   // one more than is kept
    const first = prints.map((P) => bakeShapes(P, 32));                  // the last of these bakes dropped prints[0]'s
    for (let i = 1; i <= BAKE_KEEP; i++) assert.equal(bakeShapes(prints[i], 32), first[i], `texture ${i} of the last ${BAKE_KEEP} is kept`);
    const again = bakeShapes(prints[0], 32);                             // (this drops prints[1]'s)
    assert.notEqual(again, first[0], 'dropped and baked again: another object');
    assert.deepEqual(Array.from(again.data), Array.from(first[0].data), 'with the same bytes');
    assert.deepEqual([again.size, again.range, again.pitch, again.origin, again.e1, again.e2], [first[0].size, first[0].range, first[0].pitch, first[0].origin, first[0].e1, first[0].e2]);
    assert.equal(bakeShapes(prints[0], 32), again);
    // a texture that is asked for again is the last one asked for: not the next to go
    assert.equal(bakeShapes(prints[2], 32), first[2]);
    assert.notEqual(bakeShapes(prints[1], 32), first[1], 'prints[1] had been dropped; baking it again drops prints[3], not prints[2]');
    assert.equal(bakeShapes(prints[2], 32), first[2], 'the one asked for again stays');
    assert.notEqual(bakeShapes(prints[3], 32), first[3]);
  }
  const P = casesOf('comma')[0].P;
  for (const bad of [0, 1, -4, 2.5, NaN, '64', null]) assert.throws(() => bakeShapes(P, bad), RangeError, `size ${bad}`);
  for (const bad of [null, undefined, {}, { kind: 'linear' }, { kind: 'shapes' }]) assert.throws(() => bakeShapes(bad), TypeError);
});

// ---- speed ---------------------------------------------------------------------------------------------------------

test('shape prints: fast enough — a bake at the default size of a motif at the limit (the time a pattern takes to come up)', (t) => {
  // the comma drawn with MAX_VERTS points, in the group with the most copies a cell and in the one with the longest cell
  const unit = commaOutline({ nBack: MAX_VERTS / 2, nHollow: MAX_VERTS / 4, nHead: MAX_VERTS / 4 });
  for (const id of ['*632', 'xx', '333']) {
    const g = BY_ID[id], m = motifFor(g), co = Math.cos(m.angle), si = Math.sin(m.angle), pts = [];
    for (let i = 0; i + 2 < unit.length; i += 2) { const x = m.scale[0] * unit[i], y = m.scale[1] * unit[i + 1]; pts.push([m.at[0] + co * x - si * y, m.at[1] + si * x + co * y]); }
    let best = Infinity, first = 0;
    for (let k = 0; k < 3; k++) {
      const P = makeShapePrint(g, { shapes: [pts] });                    // a new print: nothing is kept for it
      assert.equal(P.verts, MAX_VERTS);
      const t0 = performance.now(), T = bakeShapes(P), dt = performance.now() - t0;
      assert.equal(T.size, BAKE_SIZE);
      if (!k) first = dt;
      best = Math.min(best, dt);
    }
    // measured 13 Nov 2026: 5 to 24 ms on an Intel laptop of 2019 (the first of a process up to 40 ms); the floor is for
    // a slow machine with the rest of the suite running beside this
    assert.ok(best < 600, `${id}: a bake of ${MAX_VERTS} vertices at ${BAKE_SIZE} took ${best.toFixed(1)} ms`);
    t.diagnostic(`${id.padEnd(5)} ${MAX_VERTS} vertices at ${BAKE_SIZE}: ${best.toFixed(1)} ms (the first: ${first.toFixed(1)} ms)`);
  }
});

test('shape prints: fast enough — tone() on a motif of 300 vertices, validateShapes on a design\'s worth of them', (t) => {
  // the comma drawn with 300 points, in the group with the most representatives and in the one with the largest motif
  const unit = commaOutline({ nBack: 150, nHollow: 75, nHead: 75 });
  for (const id of ['*632', 'o', '22x']) {
    const g = BY_ID[id], m = motifFor(g), co = Math.cos(m.angle), si = Math.sin(m.angle), pts = [];
    for (let i = 0; i + 2 < unit.length; i += 2) { const x = m.scale[0] * unit[i], y = m.scale[1] * unit[i + 1]; pts.push([m.at[0] + co * x - si * y, m.at[1] + si * x + co * y]); }
    const P = makeShapePrint(g, { shapes: [pts] });
    assert.equal(P.verts, 300);
    const rnd = prng(9), N = 60000, xy = new Float64Array(2 * N), L = len(g.e1) + len(g.e2);
    for (let i = 0; i < N; i++) { xy[2 * i] = g.center[0] + (2 * rnd() - 1) * L; xy[2 * i + 1] = g.center[1] + (2 * rnd() - 1) * L; }
    let best = Infinity, dark = 0;
    for (let round = 0; round < 5; round++) {
      const t0 = performance.now();
      dark = 0;
      for (let i = 0; i < N; i++) dark += P.tone(xy[2 * i], xy[2 * i + 1]);
      best = Math.min(best, performance.now() - t0);
    }
    const rate = N / (best / 1000);
    assert.ok(Math.abs(dark / N - P.netArea / g.domainArea) < 0.06, `${id}: ${dark} dark of ${N}`);
    // the aim is a million a second; the floor is for a slow machine with the rest of the suite running beside this
    assert.ok(rate > 150000, `${id}: ${Math.round(rate)} tone() calls a second`);
    const t1 = performance.now();
    let s = 0;
    for (let i = 0; i < 6000; i++) s += P.margin(xy[2 * i], xy[2 * i + 1]);
    const mrate = 6000 / ((performance.now() - t1) / 1000);
    assert.ok(s > 0 && mrate > 8000, `${id}: ${Math.round(mrate)} margin() calls a second`);
    t.diagnostic(`${id.padEnd(5)} 300 points: ${(rate / 1e6).toFixed(2)} million tone() a second, ${Math.round(mrate / 1000)} thousand margin() a second`);
  }
  // validateShapes: 17 groups times a dozen patterns must be nothing; here every print of this file, and a motif at the limit
  const t0 = performance.now();
  for (const C of CASES) validateShapes(C.P);
  const all = performance.now() - t0;
  assert.ok(all < 4000, `validateShapes on ${CASES.length} prints took ${Math.round(all)} ms`);
  const g = BY_ID['*632'], place = genericPlace(g), big = makeShapePrint(g, { shapes: [ring(place.x, place.y, MAX_VERTS, (th) => 0.4 * place.D * (0.9 + 0.1 * Math.cos(7 * th)))] });
  const t2 = performance.now(), V = validateShapes(big), one = performance.now() - t2;
  assert.deepEqual(V.problems, []);
  assert.ok(one < 1500, `validateShapes on ${MAX_VERTS} vertices took ${Math.round(one)} ms`);
  t.diagnostic(`validateShapes: ${CASES.length} prints in ${Math.round(all)} ms; ${MAX_VERTS} vertices in ${Math.round(one)} ms`);
});
