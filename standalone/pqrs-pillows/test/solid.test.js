// solid.test.js — the orbifold as a solid (src/solid.js): the six seals are the edges of a tetrahedron of the
// orbifold's own curvature; it is flat exactly where the orbifold has a mirror; it does not depend on which
// partition is the cut; points and curves of the pattern land on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solidOf, cardsTriangulation, reducedTriangulation, loopQuantity, partnerQuantity, BALL } from '../src/solid.js';
import { PRESETS, stateFor, withNumbers, activate, cardsOf, CARD_KEYS } from '../src/state.js';
import { triangle, relation } from '../src/flips.js';
import { flatTipDistances } from '../src/pillow.js';
import { flatSolid, flatTipDistances as solidTipDistances } from '../src/flat2222.js';

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b} (off by ${Math.abs(a - b)})`);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The hyperbolic distance of two points drawn in the ball of radius BALL. */
function ballDist(p, q) {
  const a = p.map((x) => x / BALL), b = q.map((x) => x / BALL);
  const aa = a[0] ** 2 + a[1] ** 2 + a[2] ** 2, bb = b[0] ** 2 + b[1] ** 2 + b[2] ** 2;
  return Math.acosh(1 + (2 * dist3(a, b) ** 2) / ((1 - aa) * (1 - bb)));
}
const spaceDist = (S, p, q) => (S.kind === 'E' ? dist3(p, q) : ballDist(p, q));
/** A deterministic stream of numbers in [0, 1). */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

test('every preset opens flat (Twist 0 is a mirror of the orbifold), with its cards\' seals as the six edges', () => {
  for (const sig of PRESETS) {
    const st = stateFor(sig), S = solidOf(st);
    assert.equal(S.swaps, 0, `${sig}: the cards' triangle is the reduced one`);
    assert.ok(S.thick < 1e-6, `${sig}: flat at the engine's defaults (thickness ${S.thick})`);
    for (const c of cardsOf(st)) {
      c.seals.forEach((seal, i) => {
        const d = S.G.dist(S.G.q(seal[0], seal[1])), [a, b] = c.pairs[i];
        near(d, S.dist[a][b], 1e-9, `${sig} card ${c.key}: seal ${i} is the edge ${a}-${b}`);
      });
    }
  }
});

test('the vertices stand at the edge lengths from one another, in the space of the orbifold\'s curvature', () => {
  for (const [sig, tw, L] of [['3333', 0.12, null], ['3333', -0.31, 3.4], ['2345', 0.2, null], ['2223', 0.1, null], ['4444', 0.4, 2.2], ['2222', 0.17, null], ['2222', -0.4, 1.3], ['2468', 0.07, null]]) {
    let st = stateFor(sig);
    st = withNumbers(st, { tw });
    if (L) st = withNumbers(st, { L });
    const S = solidOf(st), V = S.vertex;
    for (const [a, b] of PAIRS) near(spaceDist(S, V[a], V[b]), S.dist[a][b], 1e-9, `${sig} tw ${tw}: |${a}${b}|`);
    assert.ok(S.thick > 0.05, `${sig} tw ${tw}: a twisted orbifold is a true tetrahedron (thickness ${S.thick})`);
    // its middle is the origin: the four vertices balance (hyperbolic: their sum on the hyperboloid is over the origin)
    const mid = [0, 1, 2].map((x) => V.reduce((s, p) => s + (S.kind === 'E' ? p[x] : (p[x] / BALL) * 2 / (1 - (p[0] ** 2 + p[1] ** 2 + p[2] ** 2) / BALL ** 2)), 0));
    assert.ok(Math.hypot(...mid) < 1e-9, `${sig} tw ${tw}: centred (${mid})`);
  }
});

test('the faces are counter-clockwise seen from outside: the pattern is not mirrored on the solid', () => {
  for (const [sig, tw] of [['3333', 0.2], ['3333', -0.2], ['2345', 0.3], ['2222', 0.2], ['2222', -0.3]]) {
    const S = solidOf(withNumbers(stateFor(sig), { tw })), V = S.vertex;
    for (const fc of S.faces) {
      const [a, b, c] = fc.f.map((f) => V[f]), d = V[6 - fc.f[0] - fc.f[1] - fc.f[2]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      assert.ok(n[0] * w[0] + n[1] * w[1] + n[2] * w[2] < 0, `${sig} tw ${tw}: the fourth vertex lies behind the face ${fc.f.join('')}`);
      // and the face's own developed triangle is counter-clockwise in the pattern's frame
      assert.ok(fc.d > 0, `${sig}: the developed face ${fc.f.join('')} is counter-clockwise`);
    }
  }
});

test('the solid is flat exactly at the mirrors: Twist 0 and 1/2; in between it is a tetrahedron', () => {
  for (const sig of ['3333', '2345', '2222']) {
    const base = stateFor(sig);
    for (const tw of [0, 0.5, -0.5]) assert.ok(solidOf(withNumbers(base, { tw })).thick < 1e-5, `${sig}: flat at Twist ${tw}`);
    let last = 0;
    for (const tw of [0.01, 0.05, 0.12, 0.25]) {
      const t = solidOf(withNumbers(base, { tw })).thick;
      assert.ok(t > last, `${sig}: the thickness grows from Twist 0 to 1/4 (${t} at ${tw})`);
      last = t;
    }
    // the mirror image at the opposite Twist: the same six edges between the same cone points
    const a = solidOf(withNumbers(base, { tw: 0.2 })), b = solidOf(withNumbers(base, { tw: -0.2 }));
    for (const [f, g] of PAIRS) near(a.dist[f][g], b.dist[f][g], 1e-9, `${sig}: edge ${f}${g} at Twist +-0.2`);
  }
});

test('2222: the edges are those of the tetrahedron of Twist of 2222 (pillow.js flatTipDistances)', () => {
  const r = rng(7);
  for (let i = 0; i < 40; i++) {
    const L = 0.6 + 1.3 * r(), tw = r() - 0.5;
    const st = withNumbers(withNumbers(stateFor('2222'), { tw }), { L }), S = solidOf(st), t = flatTipDistances(st.L, st.tw);
    for (const [a, b] of PAIRS) near(S.dist[a][b], t['PQRS'[a] + 'PQRS'[b]], 1e-9, `L ${st.L} tw ${st.tw}: edge ${a}${b}`);
    // and against the solid of Twist of 2222 itself (flat2222.js, copied from that page: kept as this test's witness)
    const own = solidTipDistances(flatSolid(st.L, st.tw));
    for (const [a, b] of PAIRS) near(S.dist[a][b], own['PQRS'[a] + 'PQRS'[b]], 1e-9, `L ${st.L} tw ${st.tw}: edge ${a}${b} against Twist of 2222's solid`);
  }
});

test('the reduced triangle: no loop is longer than its twin, and a tetrahedron with its seals always exists', () => {
  const r = rng(11);
  let moved = 0, checked = 0;
  for (const sig of ['3333', '2345', '2223', '4444', '2222', '3579']) {
    for (let i = 0; i < 60; i++) {
      let st = stateFor(sig);
      const hi = sig === '2222' ? 2 : 6.5, lo = sig === '2222' ? 0.5 : 0.5;
      st = withNumbers(st, { tw: r() - 0.5 });
      st = withNumbers(st, { L: lo + (hi - lo) * r() });
      if (i % 3 === 1) st = withNumbers(activate(st, CARD_KEYS[1 + (i % 2)]).state, { tw: r() - 0.5 });
      const { T, swaps } = reducedTriangulation(st), S = solidOf(st);
      if (swaps) moved++;
      checked++;
      // a tetrahedron exists: the fourth vertex's height squared is not negative (to rounding)
      assert.ok(S.z2 > -1e-7 * Math.max(1, ...PAIRS.map(([a, b]) => Math.abs(T.q[a][b])) ) ** 2, `${sig} #${i}: z^2 = ${S.z2}`);
      // reduced: by the trace relation, each loop's X is no more than its twin's (flips.js relation, partner)
      const o = T.orders, X = (a, b) => loopQuantity(T.kind, T.q[a][b], o[a], o[b]);
      const loops = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]].map((pairing) => ({ X: X(...pairing[0]), slots: pairing }));
      // both seals of a loop give the same loop
      for (const lp of loops) near(X(...lp.slots[1]), lp.X, 1e-7 * Math.max(1, lp.X), `${sig} #${i}: the two seals of a loop agree`);
      const rel = relation(T.kind, [0, 1, 2, 3].map((f) => o[f]), loops);
      assert.ok(Math.abs(rel.residual) < 1e-7, `${sig} #${i}: the three loops meet each other twice (the trace relation holds: ${rel.residual})`);
      loops.forEach((lp, k) => assert.ok(lp.X <= rel.partner[k] * (1 + 1e-7) + 1e-9, `${sig} #${i}: loop ${k} is no longer than its twin (${lp.X} against ${rel.partner[k]})`));
    }
  }
  assert.ok(moved > 10 && moved < checked, `some states need twin moves, some none (${moved} of ${checked})`);
});

test('the solid does not depend on which partition is the cut: the same edges and the same shape after a flip', () => {
  for (const [sig, tw, L] of [['3333', 0.15, null], ['2345', -0.22, 3.1], ['2223', 0.1, null], ['2222', 0.3, 1.2], ['3333', 0.25, 4.5]]) {
    let st = withNumbers(stateFor(sig), { tw });
    if (L) st = withNumbers(st, { L });
    const A = solidOf(st);
    for (const key of CARD_KEYS) {
      const B = solidOf(activate(st, key).state);
      for (const [a, b] of PAIRS) near(B.dist[a][b], A.dist[a][b], 1e-8, `${sig} flip to ${key}: edge ${a}${b}`);
      near(B.thick, A.thick, 1e-7, `${sig} flip to ${key}: thickness`);
    }
  }
});

test('a point of the pattern, taken on any lift, lands on one point of the solid', () => {
  const st = withNumbers(stateFor('3333'), { tw: 0.18 }), S = solidOf(st), G = S.G, tr = triangle(st);
  // a point inside the face, and its images under the turns about the face's corners (lifts of the same point)
  const [A, B, C] = tr.face, y = G.norm([0.5 * A[0] + 0.3 * B[0] + 0.2 * C[0], 0.5 * A[1] + 0.3 * B[1] + 0.2 * C[1], 0.5 * A[2] + 0.3 * B[2] + 0.2 * C[2]]);
  const rot = (X, Cn, ang) => {      // pillow.js rotateAbout, here to keep the test's own arithmetic
    const d = X[2] * Cn[2] - X[0] * Cn[0] - X[1] * Cn[1], c = Math.cos(ang), s = Math.sin(ang);
    const kx = Cn[1] * X[2] - Cn[2] * X[1], ky = Cn[2] * X[0] - Cn[0] * X[2], kz = Cn[1] * X[0] - Cn[0] * X[1];
    return [d * Cn[0] + c * (X[0] - d * Cn[0]) + s * kx, d * Cn[1] + c * (X[1] - d * Cn[1]) + s * ky, d * Cn[2] + c * (X[2] - d * Cn[2]) + s * kz];
  };
  const p0 = S.point(y, [0, 0, 0]) && (() => { const o = [0, 0, 0]; S.point(y, o); return o; })();
  let lifts = 0;
  for (const corner of [A, B, C]) for (const turns of [1, 2]) {
    const y2 = rot(y, corner, (turns * 2 * Math.PI) / 3), o = [0, 0, 0];
    S.point(y2, o);
    assert.ok(dist3(o, p0) < 1e-8, `the lift turned ${turns} thirds about a corner lands ${dist3(o, p0)} away`);
    lifts++;
  }
  assert.equal(lifts, 6);
});

test('a seal laid on the solid is the edge itself; a loop is a closed curve that keeps off its own seals', () => {
  for (const [sig, tw] of [['3333', 0.2], ['2345', 0.1], ['2222', 0.25]]) {
    const st = withNumbers(stateFor(sig), { tw }), S = solidOf(st), V = S.vertex;
    for (const c of cardsOf(st)) {
      c.seals.forEach((seal, i) => {
        const pts = S.trace(seal[0], seal[1], 16), [a, b] = c.pairs[i], n = pts.length / 3;
        const first = [pts[0], pts[1], pts[2]], last = [pts[3 * n - 3], pts[3 * n - 2], pts[3 * n - 1]];
        const ends = Math.min(dist3(first, V[a]) + dist3(last, V[b]), dist3(first, V[b]) + dist3(last, V[a]));
        assert.ok(ends < 1e-6, `${sig} ${c.key}: the seal runs from cone point to cone point (${ends})`);
        // every point of it lies on the edge: its two distances to the ends add up to the edge
        for (let k = 1; k < n - 1; k++) {
          const p = [pts[3 * k], pts[3 * k + 1], pts[3 * k + 2]];
          near(spaceDist(S, p, V[a]) + spaceDist(S, p, V[b]), S.dist[a][b], 2e-5, `${sig} ${c.key}: point ${k} of seal ${i} on the edge`);
        }
      });
      if (c.onTree) continue;
      const loop = S.trace(c.seg[0], c.seg[1], 48), n = loop.length / 3;
      assert.ok(dist3([loop[0], loop[1], loop[2]], [loop[3 * n - 3], loop[3 * n - 2], loop[3 * n - 1]]) < 1e-5, `${sig} ${c.key}: the loop closes`);
      // its length on the solid is the card's Length (2222: twice the pair spacing)
      let len = 0;
      for (let k = 1; k < n; k++) len += spaceDist(S, [loop[3 * k - 3], loop[3 * k - 2], loop[3 * k - 1]], [loop[3 * k], loop[3 * k + 1], loop[3 * k + 2]]);
      near(len, c.length, 2e-3 * c.length, `${sig} ${c.key}: the loop's length on the solid`);
    }
  }
});

test('the mesh: four faces, corners at the cone points, every vertex where its chart point lands, triangles facing out', () => {
  for (const [sig, tw] of [['3333', 0.2], ['2222', 0.2], ['2345', 0]]) {
    const st = withNumbers(stateFor(sig), { tw }), S = solidOf(st), m = S.mesh(3), n = 8;
    assert.equal(m.triangles.length / 3, 4 * n * n);
    assert.equal(m.positions.length / 3, 4 * ((n + 1) * (n + 2)) / 2);
    assert.ok(m.positions.every(Number.isFinite) && m.corners.every(Number.isFinite));
    const V = S.vertex, o = [0, 0, 0];
    let out = 0, total = 0;
    for (let t = 0; t < m.triangles.length / 3; t++) {
      const ids = [m.triangles[3 * t], m.triangles[3 * t + 1], m.triangles[3 * t + 2]], P = ids.map((v) => [m.positions[3 * v], m.positions[3 * v + 1], m.positions[3 * v + 2]]);
      for (let c = 0; c < 3; c++) {
        S.point([m.corners[9 * t + 3 * c], m.corners[9 * t + 3 * c + 1], m.corners[9 * t + 3 * c + 2]], o);
        assert.ok(dist3(o, P[c]) < 1e-8, `${sig}: triangle ${t} corner ${c} is where its chart point lands (${dist3(o, P[c])})`);
      }
      if (S.thick > 0.05) {
        const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], v = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
        const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
        const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3, cz = (P[0][2] + P[1][2] + P[2][2]) / 3;
        // seen from the solid's middle (the origin) the face's fourth vertex is behind: the normal points away from it
        const d = V[6 - S.faces[m.face[t]].f.reduce((s, f) => s + f, 0)];
        if (nx * (cx - d[0]) + ny * (cy - d[1]) + nz * (cz - d[2]) > 0) out++;
        total++;
      }
    }
    if (total) assert.equal(out, total, `${sig}: every triangle faces away from the opposite vertex`);
    // each face's three corner vertices are cone points
    for (let fi = 0; fi < 4; fi++) {
      const base = fi * m.perFace, at = (v) => [m.positions[3 * v], m.positions[3 * v + 1], m.positions[3 * v + 2]];
      assert.ok(dist3(at(base), V[S.faces[fi].f[0]]) < 1e-9);
    }
  }
});

test('rotate() turns everything that is drawn, and nothing else', () => {
  const st = withNumbers(stateFor('3333'), { tw: 0.2 }), S = solidOf(st), before = S.vertex;
  const R = [0, -1, 0, 1, 0, 0, 0, 0, 1];
  S.setRotation(R);
  const after = S.vertex;
  for (let f = 0; f < 4; f++) assert.ok(dist3(after[f], [-before[f][1], before[f][0], before[f][2]]) < 1e-12);
  for (const [a, b] of PAIRS) near(dist3(after[a], after[b]), dist3(before[a], before[b]), 1e-12, 'a rotation keeps distances');
  assert.deepEqual(S.vertex0.map((p) => p.map((x) => +x.toFixed(12))), before.map((p) => p.map((x) => +x.toFixed(12))));
});

test('partnerQuantity: the two seals of a loop, from the pillow formula', () => {
  // {3, 3, L} and {4, 5, L}: cosh(L/2) = sin sin cosh d - cos cos on both sides
  const L = 2.7, X = Math.cosh(L / 2), s = (n) => Math.sin(Math.PI / n), c = (n) => Math.cos(Math.PI / n);
  const q33 = (X + c(3) * c(3)) / (s(3) * s(3)), q45 = (X + c(4) * c(5)) / (s(4) * s(5));
  near(partnerQuantity('H', q33, 3, 3, 4, 5), q45, 1e-12, 'the other seal');
  near(loopQuantity('H', q45, 4, 5), X, 1e-12, 'the loop');
  assert.equal(partnerQuantity('E', 1.25, 2, 2, 2, 2), 1.25);
});
