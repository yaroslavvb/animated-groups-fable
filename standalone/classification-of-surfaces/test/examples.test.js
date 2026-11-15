// examples.test.js — tab 4, "Examples" (pp. 104-106). The three numbers of every example surface are COUNTED on
// its welded map (src/examples/complex.js); this file holds the book's values and checks the counting against them.
//
//   node --test test/examples.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { SURFACES, ORDER, measure } from '../src/examples/surfaces.js';
import { buildComplex, tidyForm, across, orientation } from '../src/examples/complex.js';
import { buildMesh, loopLine, edgeLine } from '../src/examples/mesh.js';
import { loopPath, pinwheelAt } from '../src/examples/pinwheel.js';

// The book: p. 105 (strange, disk, annulus, torus, Moebius band), p. 106 (Klein bottle, punched Moebius band).
const BOOK = {
  strange: { chi: -2, b: 2, sides: 2, symbol: 'o**' },
  disk: { chi: 1, b: 1, sides: 2, symbol: '*' },
  annulus: { chi: 0, b: 2, sides: 2, symbol: '**' },
  torus: { chi: 0, b: 0, sides: 2, symbol: 'o' },
  mobius: { chi: 0, b: 1, sides: 1, symbol: '*x' },
  klein: { chi: 0, b: 0, sides: 1, symbol: 'xx' },
  punched: { chi: -1, b: 2, sides: 1, symbol: '**x' },
};
const text = (c) => 'o'.repeat(c.o) + '*'.repeat(c.star) + 'x'.repeat(c.x) + 'X'.repeat(c.X);

test('the seven surfaces of the book, in the chips\' order', () => {
  assert.deepEqual(ORDER, ['disk', 'annulus', 'torus', 'mobius', 'klein', 'punched', 'strange']);
  assert.deepEqual(Object.keys(SURFACES).sort(), Object.keys(BOOK).sort());
});

for (const key of ORDER) {
  test(`${key}: Euler characteristic, boundaries and sides are the book's`, () => {
    const m = measure(key), want = BOOK[key];
    assert.equal(m.V - m.E + m.F, m.chi);
    assert.equal(m.chi, want.chi, `chi (V ${m.V}, E ${m.E}, F ${m.F})`);
    assert.equal(m.b, want.b, 'boundaries');
    assert.equal(m.orientable ? 2 : 1, want.sides, 'sides');
  });

  test(`${key}: Theorem 8.2 names it ${BOOK[key].symbol}`, () => {
    const m = measure(key);
    // two-sided: handles a = (2 - b - chi) / 2, symbol o^a *^b; one-sided: crosscaps c = 2 - b - chi, symbol *^b x^c
    const want = m.orientable ? 'o'.repeat((2 - m.b - m.chi) / 2) + '*'.repeat(m.b) : '*'.repeat(m.b) + 'x'.repeat(2 - m.b - m.chi);
    assert.equal(text(m.counts), want);
    assert.equal(text(m.counts), BOOK[key].symbol);
    assert.equal(2 - 2 * m.counts.o - m.counts.star - m.counts.x, m.chi, 'the tidy form has the same chi');
  });

  test(`${key}: the map is a proper one, small enough to read`, () => {
    const { cx, F, boundaries } = measure(key);
    assert.ok(F >= 6 && F <= 40, `${F} faces`);
    for (const e of cx.edges) assert.ok(e.uses.length === 1 || e.uses.length === 2, `edge ${e.id} lies in ${e.uses.length} faces`);
    for (const f of cx.faces) assert.ok(f.sides.filter(Boolean).length >= 3, `face ${f.id} has fewer than three sides`);
    assert.ok(orientation(cx).connected, 'one piece');
    // every boundary edge is on exactly one boundary curve, and each curve closes up
    const rim = cx.edges.filter((e) => e.uses.length === 1).map((e) => e.id).sort((a, b) => a - b);
    assert.deepEqual(boundaries.flatMap((l) => l.map((s) => s.edge)).sort((a, b) => a - b), rim);
    for (const loop of boundaries) {
      for (let i = 0; i < loop.length; i++) {
        const s = loop[i], t = loop[(i + 1) % loop.length], us = cx.edges[s.edge].uses[0], ut = cx.edges[t.edge].uses[0];
        assert.equal(s.forward ? us.to : us.from, t.forward ? ut.from : ut.to, 'the chain is broken');
      }
      const pts = loopLine(cx, loop);
      assert.ok(pts.length >= 9 && pts.every(Number.isFinite));
    }
    for (const e of cx.edges) assert.ok(edgeLine(cx, e).every(Number.isFinite));
  });

  test(`${key}: inside a patch the faces are wound alike; seams only on a one-sided surface`, () => {
    const { cx, paint, orientable } = measure(key);
    for (const f of cx.faces) for (let k = 0; k < 4; k++) {
      const nx = across(cx, f.id, k);
      if (!nx) continue;
      const g = cx.faces[nx.face], grid = g.patch === f.patch && Math.abs(g.i - f.i) + Math.abs(g.j - f.j) === 1;
      if (grid) assert.equal(nx.rel, 1, `faces ${f.id} and ${g.id} are neighbours in one chart`);
    }
    assert.equal(paint.seams.length === 0, orientable);
    assert.ok(paint.sign.every((s) => s === 1 || s === -1));
  });

  test(`${key}: the mesh is sound`, () => {
    const { cx, paint } = measure(key), { positions, indices } = buildMesh(cx, paint.sign), n = positions.length / 3;
    assert.ok(positions.every(Number.isFinite));
    assert.ok(indices.length > 0 && indices.every((i) => i < n));
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map((i) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      assert.ok(area > 1e-9, 'a triangle with no area');
    }
    assert.ok(n < 4000 && indices.length / 3 < 8000);
  });

  test(`${key}: the pinwheel comes back ${BOOK[key].sides === 1 ? 'mirrored' : 'as it left'}`, () => {
    const m = measure(key), path = loopPath(m.cx, m.loop);
    assert.equal(new Set(m.loop.map((l) => l.face)).size, m.loop.length, 'the loop visits a face twice');
    // the loop is taken from the map: on a one-sided surface it is one that turns the orientation over
    assert.equal(m.loopReverses, !m.orientable);
    // the geometry agrees, knowing nothing of the map: the frame carried round comes back turned over, or not
    assert.ok(Math.abs(Math.abs(path.turned) - 1) < 0.02, `frame came back askew: ${path.turned}`);
    assert.equal(path.turned < 0, !m.orientable);
    assert.equal(path.index(0), 0);
    assert.equal(path.index(1), path.n);
    // all the way round the pinwheel keeps its shape: every point within its radius of the hub (and a bit), and the
    // four tips (points 3, 12, 21, 30 of its line) out at the radius
    for (let i = 0; i <= path.n; i += i < path.n - 4 ? 4 : 1) {
      const mark = pinwheelAt(path, i, m.def.mark), s = path.samples[i % path.n];
      const from = (j) => Math.hypot(mark[3 * j] - s.p[0], mark[3 * j + 1] - s.p[1], mark[3 * j + 2] - s.p[2]) / m.def.mark;
      assert.ok(mark.every(Number.isFinite));
      for (let j = 0; j < mark.length / 3; j++) assert.ok(from(j) < 1.15, `sample ${i}: a sail ${from(j).toFixed(2)} radii from its hub`);
      for (const j of [3, 12, 21, 30]) assert.ok(from(j) > 0.8, `sample ${i}: a tip only ${from(j).toFixed(2)} radii from its hub`);
    }
    // the journey is one closed curve, walked in even steps, and the pinwheel never spins round in one step
    for (let i = 0; i < path.n; i++) {
      const p = path.samples[i].p, q = path.samples[(i + 1) % path.n].p, e = path.e1[i], g = path.e1[(i + 1) % path.n];
      assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 0.012, `a jump at sample ${i}`);
      assert.ok(e[0] * g[0] + e[1] * g[1] + e[2] * g[2] > 0.94, `the heading swings round at sample ${i}`);
    }
  });

  test(`${key}: no chart folds back over itself`, () => {
    const { cx } = measure(key), G = 7, at = (k) => 0.04 + (0.92 * k) / (G - 1);
    for (const face of cx.faces) {
      const f = cx.patches[face.patch].f, ha = (face.a1 - face.a0) * 1e-4, hb = (face.b1 - face.b0) * 1e-4;
      // da x db, with its sign: on a chart that folds over, it turns to its opposite between two neighbouring points
      const normal = (s, t) => {
        const a = face.a0 + (face.a1 - face.a0) * s, b = face.b0 + (face.b1 - face.b0) * t;
        const p = f(a - ha, b), q = f(a + ha, b), r = f(a, b - hb), u = f(a, b + hb);
        const x = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], y = [u[0] - r[0], u[1] - r[1], u[2] - r[2]];
        const n = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], l = Math.hypot(...n);
        assert.ok(l > 0, `face ${face.id}: the chart is singular inside the face`);
        return n.map((c) => c / l);
      };
      const N = Array.from({ length: G }, (_, i) => Array.from({ length: G }, (_, j) => normal(at(i), at(j))));
      const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
        if (i + 1 < G) assert.ok(dot(N[i][j], N[i + 1][j]) > 0.3, `face ${face.id} of patch ${face.patch} folds over`);
        if (j + 1 < G) assert.ok(dot(N[i][j], N[i][j + 1]) > 0.3, `face ${face.id} of patch ${face.patch} folds over`);
      }
    }
  });
}

test('the counts the page shows', () => {
  const got = Object.fromEntries(ORDER.map((k) => { const m = measure(k); return [k, [m.V, m.E, m.F]]; }));
  assert.deepEqual(got, {
    disk: [7, 12, 6], annulus: [16, 24, 8], torus: [18, 36, 18], mobius: [16, 24, 8], klein: [24, 48, 24], punched: [12, 20, 7], strange: [19, 36, 15],
  });
});

test('welding: sheets that only cross are not glued', () => {
  // two squares through each other along the x axis; their corners (-1,0,0), (0,0,0), (1,0,0) coincide
  const grid = { as: [-1, 0, 1], bs: [-1, 0, 1], sub: [1, 1] };
  const cx = buildComplex([{ ...grid, f: (a, b) => [a, b, 0] }, { ...grid, f: (a, b) => [a, 0, b] }]);
  assert.equal(cx.verts.length, 18);
  assert.equal(cx.edges.length, 24);
  assert.equal(orientation(cx).connected, false);
});

test('welding: the Klein bottle passes through itself, and no vertex is shared across the crossing', () => {
  const { cx, V } = measure('klein'), patch = cx.patches[0];
  assert.equal(V, (patch.as.length - 1) * (patch.bs.length - 1));
  // the crossing is there: two faces with no vertex in common come within a hair of each other
  const pts = cx.faces.map((f) => {
    const out = [];
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) out.push(patch.f(f.a0 + ((f.a1 - f.a0) * i) / 12, f.b0 + ((f.b1 - f.b0) * j) / 12));
    return out;
  });
  const corners = cx.faces.map((f) => new Set(f.sides.filter(Boolean).flatMap((s) => [s.from, s.to])));
  let closest = Infinity;
  for (let f = 0; f < cx.faces.length; f++) for (let g = f + 1; g < cx.faces.length; g++) {
    if ([...corners[f]].some((v) => corners[g].has(v))) continue;
    for (const p of pts[f]) for (const q of pts[g]) closest = Math.min(closest, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
  }
  assert.ok(closest < 0.03, `no crossing found (closest approach ${closest})`);
});

test('Theorem 8.2 refuses numbers no surface has', () => {
  assert.deepEqual(tidyForm({ chi: 2, b: 0, orientable: true }), { o: 0, star: 0, x: 0, X: 0 });
  assert.deepEqual(tidyForm({ chi: 1, b: 0, orientable: false }), { o: 0, star: 0, x: 1, X: 0 });
  assert.throws(() => tidyForm({ chi: 1, b: 0, orientable: true }));
  assert.throws(() => tidyForm({ chi: 2, b: 0, orientable: false }));
});
