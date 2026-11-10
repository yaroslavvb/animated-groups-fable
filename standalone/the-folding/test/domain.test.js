// Tests for src/domain.js (SPEC 5.1): Dirichlet tiles, edge gluings, tiling property, warp, seed clamping.
// Every property is checked over all 17 groups x every preset x 30 seeded-random seeds x amp in {0, 1}.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, elementsNear, symmetryElements, contains } from '../src/groups.js';
import { inverse, apply, det, compose, polyArea, classify, isoEquals } from '../src/geom.js';
import { makeWarp, clampSeed, buildDomain, WARP_PEAK } from '../src/domain.js';

// CORE_SEEDS / CORE_SALT widen the sweep for stress runs, e.g. CORE_SEEDS=300 node --test test/domain.test.js
const SEEDS = Math.max(30, +process.env.CORE_SEEDS || 30);
const SALT = +process.env.CORE_SALT || 0;

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

/** Every (group, label, options) case: all presets, then SEEDS random seeds in the plane view's window. */
function* cases(group, salt = 1) {
  for (const [i, p] of group.presets.entries()) yield { label: `${group.id} preset ${i} (${p.name})`, seed: p.seed, metric: p.metric };
  const rnd = prng(1000 * salt + GROUPS.indexOf(group) + 7919 * SALT);
  for (let k = 0; k < SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
    yield { label: `${group.id} random seed ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: group.presets[k % group.presets.length].metric };
  }
}

const warps = new Map();
function warpOf(group, amp) {
  const key = group.id + '|' + amp;
  if (!warps.has(key)) warps.set(key, makeWarp(group, amp));
  return warps.get(key);
}

function forAllDomains(fn, amps = [0, 1]) {
  for (const group of GROUPS) {
    for (const amp of amps) {
      for (const c of cases(group)) {
        const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp: warpOf(group, amp) });
        fn(group, domain, `${c.label} amp ${amp}`, amp);
      }
    }
  }
}

const size = (g) => Math.sqrt(g.domainArea);

test('domain: area equals the group\'s domain area; polygon is convex, counter-clockwise, without short edges', () => {
  let shortest = Infinity;
  forAllDomains((group, d, label) => {
    assert.ok(Math.abs(d.area - group.domainArea) < 1e-7, `${label}: area ${d.area} vs ${group.domainArea}`);
    assert.ok(Math.abs(polyArea(d.poly) - d.area) < 1e-12, label);
    const n = d.poly.length;
    assert.ok(n >= 3, label);
    assert.equal(d.edges.length, n, label);
    for (let i = 0; i < n; i++) {
      const a = d.poly[i], b = d.poly[(i + 1) % n], c = d.poly[(i + 2) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      assert.ok(len > 1e-9, `${label}: zero-length edge ${i}`);
      assert.ok(Math.abs(len - d.edges[i].len) < 1e-12, label);
      shortest = Math.min(shortest, len / size(group));
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      assert.ok(cr > -1e-12, `${label}: reflex corner at ${i + 1}`);
    }
    assert.ok(d.contains(d.seed[0], d.seed[1], -1e-6), `${label}: seed is interior`);
  }, [0]);
  assert.ok(shortest > 1e-9);
});

test('domain: every edge is the bisector of the seed and g(seed); its half-plane is normalised and supports the polygon', () => {
  forAllDomains((group, d, label) => {
    const n = d.poly.length, [px, py] = d.seed, [q11, q12, q22] = d.metric;
    for (let i = 0; i < n; i++) {
      const e = d.edges[i];
      assert.ok(contains(group, e.g), `${label}: g of edge ${i} is in the group`);
      assert.ok(Math.abs(Math.hypot(e.nx, e.ny) - 1) < 1e-12, `${label}: unit normal`);
      const q = apply(e.g, px, py);
      // n is parallel to Q (q - p), and the Q-midpoint condition holds at both ends of the edge
      const nx = q11 * (q[0] - px) + q12 * (q[1] - py), ny = q12 * (q[0] - px) + q22 * (q[1] - py);
      assert.ok(Math.abs(nx * e.ny - ny * e.nx) < 1e-9 * Math.hypot(nx, ny), `${label}: normal direction of edge ${i}`);
      assert.ok(nx * e.nx + ny * e.ny > 0, `${label}: normal points outward`);
      const a = d.poly[i], b = d.poly[(i + 1) % n];
      for (const v of [a, b]) {
        assert.ok(Math.abs(e.nx * v[0] + e.ny * v[1] - e.c) < 1e-9, `${label}: endpoint of edge ${i} on its line`);
        const dp = (v[0] - px) * (q11 * (v[0] - px) + q12 * (v[1] - py)) + (v[1] - py) * (q12 * (v[0] - px) + q22 * (v[1] - py));
        const dq = (v[0] - q[0]) * (q11 * (v[0] - q[0]) + q12 * (v[1] - q[1])) + (v[1] - q[1]) * (q12 * (v[0] - q[0]) + q22 * (v[1] - q[1]));
        assert.ok(Math.abs(dp - dq) < 1e-9, `${label}: endpoint of edge ${i} is equidistant from seed and g(seed)`);
      }
      for (const v of d.poly) assert.ok(e.nx * v[0] + e.ny * v[1] - e.c < 1e-9, `${label}: polygon inside half-plane ${i}`);
    }
  }, [0]);
});

test('domain: gluing — partners, equal lengths, inverse(g_i) maps edge i onto edge j, classes consistent', () => {
  forAllDomains((group, d, label) => {
    const n = d.poly.length;
    const perClass = new Map();
    for (let i = 0; i < n; i++) {
      const e = d.edges[i], j = e.partner;
      assert.ok(Number.isInteger(j) && j >= 0 && j < n, `${label}: edge ${i} has a partner`);
      const f = d.edges[j];
      assert.equal(f.partner, i, `${label}: partner is an involution`);
      assert.ok(isoEquals(f.g, inverse(e.g), 1e-7), `${label}: partner carries the inverse element`);
      assert.ok(Math.abs(e.len - f.len) < 1e-9, `${label}: partners have equal length`);
      const a = d.poly[i], b = d.poly[(i + 1) % n], a2 = d.poly[j], b2 = d.poly[(j + 1) % n];
      const gi = inverse(e.g);
      const ia = apply(gi, a[0], a[1]), ib = apply(gi, b[0], b[1]);
      const orientationPreserving = det(e.g) > 0;
      assert.equal(e.rev, orientationPreserving, `${label}: rev flag`);
      // orientation-preserving g: direction of travel reversed (start -> end of j); orientation-reversing: kept
      const [ta, tb] = orientationPreserving ? [b2, a2] : [a2, b2];
      assert.ok(Math.hypot(ia[0] - ta[0], ia[1] - ta[1]) < 1e-9 && Math.hypot(ib[0] - tb[0], ib[1] - tb[1]) < 1e-9,
        `${label}: inverse(g) maps the endpoints of edge ${i} onto those of edge ${j}`);
      const c = classify(e.g);
      if (e.kind === 'mirror') {
        assert.equal(c.type, 'reflection', label);
        assert.equal(j, i, `${label}: a mirror edge is its own partner`);
        assert.equal(e.cls, -1, label);
        assert.equal(e.halfTurn, false, label);
      } else {
        assert.equal(e.kind, 'cut', label);
        assert.notEqual(c.type, 'reflection', `${label}: a reflection must be a mirror edge`);
        assert.ok(e.cls >= 0 && e.cls < d.classes, `${label}: class in range`);
        assert.equal(f.cls, e.cls, `${label}: partners share the class`);
        assert.equal(e.halfTurn, c.type === 'rotation' && c.order === 2, `${label}: halfTurn flag`);
        if (e.halfTurn) {
          assert.equal(j, i, `${label}: a half-turn edge is its own partner`);
          assert.ok(Math.hypot(c.center[0] - e.mid[0], c.center[1] - e.mid[1]) < 1e-9, `${label}: half-turn centre is the midpoint`);
        } else assert.notEqual(j, i, `${label}: only mirrors and half-turns are self-glued`);
        if (!perClass.has(e.cls)) perClass.set(e.cls, new Set());
        perClass.get(e.cls).add(i).add(j);
      }
    }
    assert.equal(perClass.size, d.classes, `${label}: number of classes`);
    for (const [cls, set] of perClass) assert.ok(set.size <= 2, `${label}: class ${cls} holds one glued pair`);
    // classes are numbered in order of first appearance along the boundary
    let next = 0;
    for (let i = 0; i < n; i++) if (d.edges[i].cls === next) next++; else assert.ok(d.edges[i].cls < next, `${label}: class order`);
  }, [0]);
});

test('domain: tiling property — a random point lies in exactly one tile g(D\'), amp 0 and 1', () => {
  const rnd = prng(77);
  forAllDomains((group, d, label) => {
    let rmax = 0;
    for (const v of d.poly) rmax = Math.max(rmax, Math.hypot(v[0] - d.seed[0], v[1] - d.seed[1]));
    const y = [0, 0], z = [0, 0];
    for (let k = 0; k < 24; k++) {
      const x = [group.center[0] + (2 * rnd() - 1) * 2 * group.viewHalf, group.center[1] + (2 * rnd() - 1) * 2 * group.viewHalf];
      d.warp.inv(x[0], x[1], y);            // x in g psi(D) = psi(g D)  <=>  g^-1 psi^-1(x) in D
      let inLoose = 0, inStrict = 0;
      for (const g of elementsNear(group, y[0], y[1], 1.5 * rmax + 1e-6, d.seed[0], d.seed[1])) {
        apply(inverse(g), y[0], y[1], z);
        if (d.contains(z[0], z[1], 1e-9)) inLoose++;
        if (d.contains(z[0], z[1], -1e-9)) inStrict++;
      }
      assert.equal(inLoose, 1, `${label}: point (${x}) lies in ${inLoose} tiles`);
      assert.equal(inStrict, 1, `${label}: point (${x}) lies strictly in ${inStrict} tiles`);
    }
  });
});

test('domain: outline follows the warped edges, is closed, and matching points of glued edges correspond under g', () => {
  forAllDomains((group, d, label, amp) => {
    const n = d.poly.length, s = size(group);
    const step = s / 20;
    const out = d.outline(step);
    assert.equal(out.length, n, label);
    const w = [0, 0];
    for (let i = 0; i < n; i++) {
      const o = out[i], m = o.pts.length / 2 - 1;
      assert.equal(o.edge, i, label);
      assert.ok(o.pts instanceof Float32Array && m >= 2 && m % 2 === 0, `${label}: even number of steps`);
      assert.equal(out[d.edges[i].partner].pts.length, o.pts.length, `${label}: glued partners have the same number of samples`);
      assert.ok(d.edges[i].len / m <= step + 1e-12, `${label}: step size`);
      const a = d.poly[i], b = d.poly[(i + 1) % n];
      for (let k = 0; k <= m; k++) {
        d.warp.fwd(a[0] + (k / m) * (b[0] - a[0]), a[1] + (k / m) * (b[1] - a[1]), w);
        assert.ok(Math.hypot(o.pts[2 * k] - w[0], o.pts[2 * k + 1] - w[1]) < 1e-6, `${label}: outline point ${k} of edge ${i}`);
        d.edgePoint(i, k / m, y2);
        assert.ok(Math.hypot(y2[0] - w[0], y2[1] - w[1]) < 1e-12, `${label}: edgePoint`);
      }
      const nx = out[(i + 1) % n].pts;
      assert.ok(o.pts[2 * m] === nx[0] && o.pts[2 * m + 1] === nx[1], `${label}: consecutive edges share the corner`);
      // glued partner: g^-1 maps sample k of edge i onto sample (m - k) (rev) or k (glide) of edge j, in actual coordinates
      const e = d.edges[i], gi = inverse(e.g), pj = out[e.partner].pts;
      for (let k = 0; k <= m; k++) {
        d.edgePoint(i, k / m, w);
        apply(gi, w[0], w[1], y2);
        const kk = e.rev ? m - k : k;
        assert.ok(Math.hypot(pj[2 * kk] - y2[0], pj[2 * kk + 1] - y2[1]) < 1e-6, `${label}: glued sample ${k} of edge ${i} (amp ${amp})`);
      }
    }
  });
});
const y2 = [0, 0];

/** Signed distance from (x, y) to the tile in straight coordinates: the largest distance to an edge line, negative inside. */
function outsideBy(d, x, y) {
  let worst = -Infinity;
  for (const e of d.edges) worst = Math.max(worst, e.nx * x + e.ny * y - e.c);
  return worst;
}

test('domain: cone points are exactly the rotation centres of G on the tile boundary', () => {
  forAllDomains((group, d, label) => {
    let rmax = 0;
    for (const v of d.poly) rmax = Math.max(rmax, Math.hypot(v[0] - d.seed[0], v[1] - d.seed[1]));
    const el = symmetryElements(group, d.seed[0], d.seed[1], rmax + 0.01);
    // ON the boundary: to the 1e-9 that vertices are merged at. (For these seeds — presets and random ones — a centre
    // is either on the boundary to rounding or far from it; the next test has the seeds where it is a hair off.)
    const onBoundary = el.centers.filter((c) => Math.abs(outsideBy(d, c.x, c.y)) < 1e-9);
    assert.equal(d.conePoints.length, onBoundary.length, `${label}: number of cone points`);
    for (const c of onBoundary) {
      const hit = d.conePoints.find((p) => Math.hypot(p.x - c.x, p.y - c.y) < 1e-7);
      assert.ok(hit, `${label}: centre (${c.x}, ${c.y}) is listed`);
      assert.equal(hit.order, c.order, `${label}: order`);
      assert.equal(hit.onMirror, c.onMirror, `${label}: onMirror`);
      // the warp fixes it
      const w = d.warp.fwd(hit.x, hit.y);
      assert.ok(Math.hypot(w[0] - hit.x, w[1] - hit.y) < 1e-12, `${label}: cone point is fixed by the warp`);
    }
    // no rotation centre is interior to the tile
    for (const c of el.centers) assert.ok(!d.contains(c.x, c.y, -1e-7), `${label}: rotation centre inside the tile`);
  });
});

test('domain: a seed a hair off a symmetric position — only the rotation centres ON the tile are cone points', () => {
  // 2222 on the lattice a x b, seed (a/4, 0) on a crease (the preset "Book"): the tile is the rectangle [0, a/2] x
  // [-b/2, b/2], four tiles meet at each of its corners, and all six half-turn centres on it are cone points of the
  // tile. Move the seed by 1e-7 * (-0.8, 0.6): the tile becomes a hexagon with two tiny edges at the top; the centres
  // at their midpoints stay cone points, their glued twins at the two bottom corners now lie 6e-8 or more OUTSIDE the
  // tile (9.2e-8 for the lattice 1.3 x 1 of 2026-11-09).
  const p2 = BY_ID['2222'], a = p2.e1[0], b = p2.e2[1];
  assert.ok(p2.e1[1] === 0 && p2.e2[0] === 0, 'the 2222 lattice is rectangular, sides along the axes');
  const sorted = (d) => d.conePoints.map((c) => [Math.round(c.x * 1e6) / 1e6, Math.round(c.y * 1e6) / 1e6]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const book = buildDomain(p2, { seed: [a / 4, 0] });
  assert.equal(book.poly.length, 4);
  assert.deepEqual(sorted(book), [[0, r6(-b / 2)], [0, 0], [0, r6(b / 2)], [r6(a / 2), r6(-b / 2)], [r6(a / 2), 0], [r6(a / 2), r6(b / 2)]]);
  const off = buildDomain(p2, { seed: [a / 4 - 0.8e-7, 0.6e-7] });
  assert.equal(off.poly.length, 6);
  assert.deepEqual(sorted(off), [[0, 0], [0, r6(b / 2)], [r6(a / 2), 0], [r6(a / 2), r6(b / 2)]]);
  for (const c of [[0, -b / 2], [a / 2, -b / 2]]) assert.ok(outsideBy(off, c[0], c[1]) > 5e-8, 'the twins are outside the tile');

  // every group, every preset, moved by 1e-5 ... 1e-12 in three directions: a listed centre is within 1e-8 of the
  // boundary (in fact 1e-9: the merge tolerance), a centre within 1e-10 of it is listed, each once, with the group's order
  const rot = (group, x, y) => {
    let n = 0;
    for (const r of group.reps) {
      if (det(r) < 0) continue;
      const st = [0, 0], wx = x - (r.a * x + r.b * y + r.tx), wy = y - (r.c * x + r.d * y + r.ty);
      const dd = group.e1[0] * group.e2[1] - group.e1[1] * group.e2[0];
      st[0] = (wx * group.e2[1] - wy * group.e2[0]) / dd; st[1] = (group.e1[0] * wy - group.e1[1] * wx) / dd;
      if (Math.abs(st[0] - Math.round(st[0])) < 1e-7 && Math.abs(st[1] - Math.round(st[1])) < 1e-7) n++;
    }
    return n;      // order of the rotation subgroup that fixes (x, y)
  };
  let tiles = 0, shortest = Infinity;
  for (const group of GROUPS) {
    for (const [i, p] of group.presets.entries()) {
      for (const eps of [1e-5, 1e-7, 1e-8, 3e-9, 1e-9, 3e-10, 1e-10, 1e-12]) {
        for (const [dx, dy] of [[0.6, 0.8], [-0.8, 0.6], [1, 0]]) {
          const seed = [p.seed[0] + eps * dx, p.seed[1] + eps * dy];
          const label = `${group.id} preset ${i} + ${eps} * (${dx}, ${dy})`;
          const d = buildDomain(group, { seed, metric: p.metric });
          tiles++;
          for (const e of d.edges) shortest = Math.min(shortest, e.len);
          for (const [k, c] of d.conePoints.entries()) {
            assert.ok(Math.abs(outsideBy(d, c.x, c.y)) <= 1e-9, `${label}: cone point (${c.x}, ${c.y}) is ${outsideBy(d, c.x, c.y)} off the tile`);
            assert.equal(rot(group, c.x, c.y), c.order, `${label}: order of the cone point (${c.x}, ${c.y})`);
            assert.ok(c.order >= 2, label);
            assert.ok(!d.conePoints.some((q, j) => j < k && Math.hypot(q.x - c.x, q.y - c.y) < 1e-6), `${label}: listed twice`);
          }
          let rmax = 0;
          for (const v of d.poly) rmax = Math.max(rmax, Math.hypot(v[0] - d.seed[0], v[1] - d.seed[1]));
          for (const c of symmetryElements(group, d.seed[0], d.seed[1], rmax + 0.01).centers) {
            if (Math.abs(outsideBy(d, c.x, c.y)) < 1e-10) assert.ok(d.conePoints.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 1e-7), `${label}: centre (${c.x}, ${c.y}) on the boundary is not listed`);
          }
          // the midpoint of every half-turn edge is a cone point, whatever the length of the edge
          for (const e of d.edges) if (e.halfTurn) assert.ok(d.conePoints.some((q) => Math.hypot(q.x - e.mid[0], q.y - e.mid[1]) < 1e-8), `${label}: midpoint of a half-turn edge`);
        }
      }
    }
  }
  assert.ok(tiles > 800 && shortest < 1e-7, `${tiles} tiles, shortest edge ${shortest}`);
});

test('buildDomain: a seed that is no seed (NaN, infinite, astronomically far) gives the first preset\'s tile, never an empty one', () => {
  for (const group of GROUPS) {
    const p0 = group.presets[0], base = buildDomain(group, { seed: p0.seed, metric: p0.metric });
    for (const seed of [[NaN, 0], [0.3, NaN], [Infinity, 0], [0, -Infinity], [NaN, NaN], [undefined, 1], [1e300, 0], [3e17, -2e17], [1e12, 5e11]]) {
      const label = `${group.id} seed [${seed}]`;
      assert.deepEqual(clampSeed(group, seed[0], seed[1]), base.seed, `${label}: clampSeed`);
      const d = buildDomain(group, { seed, metric: p0.metric });
      assert.deepEqual(d.seed, base.seed, label);
      assert.deepEqual(d.poly, base.poly, label);
      assert.ok(d.poly.length >= 3 && Math.abs(d.area - group.domainArea) < 1e-7, label);
    }
    // far, but a seed: whatever the rounding does to the tile out there, it is a closed polygon with every edge paired
    for (const k of [1e3, 1e5, 1e7, 4e8]) {
      for (const seed of [[p0.seed[0] + k * group.e1[0], p0.seed[1] + k * group.e1[1]], [p0.seed[0] - 0.7 * k, p0.seed[1] + 0.3 * k]]) {
        const d = buildDomain(group, { seed, metric: p0.metric });
        const label = `${group.id} seed [${seed}]`;
        assert.ok(d.poly.length >= 3 && d.edges.length === d.poly.length, label);
        assert.ok(d.poly.every((v) => Number.isFinite(v[0]) && Number.isFinite(v[1])) && d.seed.every(Number.isFinite) && d.area > 0, label);
        for (const [i, e] of d.edges.entries()) assert.equal(d.edges[e.partner].partner, i, `${label}: paired`);
      }
    }
  }
});

test('warp.bend bounds the second derivative of the inverse warp, and is not a wild overestimate', () => {
  const rnd = prng(11);
  for (const group of GROUPS) {
    assert.equal(makeWarp(group, 0).bend, 0);
    const s = size(group);
    let last = 0;
    for (const amp of [1e-6, 0.25, 0.5, 1]) {
      const w = makeWarp(group, amp);
      assert.ok(Number.isFinite(w.bend) && w.bend > last, `${group.id} amp ${amp}: bend ${w.bend} grows with amp`);
      last = w.bend;
      // second differences of psi^-1 along random directions: |g(x + h u) - 2 g(x) + g(x - h u)| / h² -> |D²g[u, u]|
      const h = 1e-3 * s, a = [0, 0], b = [0, 0], c = [0, 0];
      let worst = 0;
      for (let k = 0; k < 4000; k++) {
        const u = rnd(), t = rnd(), th = 2 * Math.PI * rnd();
        const x = u * group.e1[0] + t * group.e2[0], y = u * group.e1[1] + t * group.e2[1];
        w.inv(x, y, b); w.inv(x + h * Math.cos(th), y + h * Math.sin(th), a); w.inv(x - h * Math.cos(th), y - h * Math.sin(th), c);
        worst = Math.max(worst, Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]) / (h * h));
      }
      if (amp >= 0.25) {
        assert.ok(worst <= w.bend, `${group.id} amp ${amp}: second derivative ${worst} exceeds bend ${w.bend}`);
        assert.ok(w.bend < 4 * worst, `${group.id} amp ${amp}: bend ${w.bend} for a largest sampled second derivative of ${worst}`);
      }
    }
  }
});

test('warp: amp 0 is the exact identity; inv(fwd(x)) = x = fwd(inv(x))', () => {
  const rnd = prng(5);
  for (const group of GROUPS) {
    const w0 = makeWarp(group, 0);
    assert.equal(w0.amp, 0);
    for (let k = 0; k < 20; k++) {
      const x = 7 * rnd() - 3, y = 7 * rnd() - 3;
      assert.deepEqual(w0.fwd(x, y), [x, y]);
      assert.deepEqual(w0.inv(x, y), [x, y]);
    }
    for (const amp of [0.3, 1]) {
      const w = makeWarp(group, amp);
      assert.equal(w.amp, amp);
      const a = [0, 0], b = [0, 0];
      for (let k = 0; k < 400; k++) {
        const x = 7 * rnd() - 3, y = 7 * rnd() - 3;
        w.fwd(x, y, a); w.inv(a[0], a[1], b);
        assert.ok(Math.hypot(b[0] - x, b[1] - y) < 1e-11, `${group.id} amp ${amp}: inv(fwd) error ${Math.hypot(b[0] - x, b[1] - y)}`);
        w.inv(x, y, a); w.fwd(a[0], a[1], b);
        assert.ok(Math.hypot(b[0] - x, b[1] - y) < 1e-11, `${group.id} amp ${amp}: fwd(inv) error ${Math.hypot(b[0] - x, b[1] - y)}`);
        w.inv(x, y, b, a[0] + 1e-3, a[1] - 2e-3);   // started from a nearby guess: the same answer
        assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-11, `${group.id} amp ${amp}: inv with a guess`);
      }
    }
  }
});

test('warp: equivariance fwd(g x) = g fwd(x) and inv(g x) = g inv(x) for random group elements', () => {
  const rnd = prng(6);
  for (const group of GROUPS) {
    const w = makeWarp(group, 1);
    const els = elementsNear(group, group.center[0], group.center[1], 4);
    const a = [0, 0], b = [0, 0], c = [0, 0];
    for (let k = 0; k < 300; k++) {
      const g = els[Math.floor(rnd() * els.length)];
      const x = 5 * rnd() - 2, y = 5 * rnd() - 2;
      apply(g, x, y, a); w.fwd(a[0], a[1], b);
      w.fwd(x, y, c); apply(g, c[0], c[1], c);
      assert.ok(Math.hypot(b[0] - c[0], b[1] - c[1]) < 1e-12, `${group.id}: fwd equivariance error ${Math.hypot(b[0] - c[0], b[1] - c[1])}`);
      w.inv(a[0], a[1], b);
      w.inv(x, y, c); apply(g, c[0], c[1], c);
      assert.ok(Math.hypot(b[0] - c[0], b[1] - c[1]) < 1e-11, `${group.id}: inv equivariance`);
    }
  }
});

test('warp: peak displacement is 7-10 % of sqrt(domainArea), Jacobian determinant >= 0.35, the map is not trivial', () => {
  const rnd = prng(8);
  for (const group of GROUPS) {
    const w = makeWarp(group, 1), s = size(group);
    let peak = 0, minDet = Infinity;
    const v = [0, 0], J = [0, 0, 0, 0], p = [0, 0], q = [0, 0];
    for (let k = 0; k < 6000; k++) {
      const u = rnd(), t = rnd();
      const x = u * group.e1[0] + t * group.e2[0], y = u * group.e1[1] + t * group.e2[1];
      w.vec(x, y, v);
      peak = Math.max(peak, Math.hypot(v[0], v[1]));
      const dt = w.jac(x, y, J);
      minDet = Math.min(minDet, dt);
      if (k < 200) {   // the analytic Jacobian matches finite differences
        const h = 1e-6;
        w.fwd(x + h, y, p); w.fwd(x - h, y, q);
        assert.ok(Math.abs((p[0] - q[0]) / (2 * h) - J[0]) < 1e-6 && Math.abs((p[1] - q[1]) / (2 * h) - J[2]) < 1e-6, `${group.id}: d/dx`);
        w.fwd(x, y + h, p); w.fwd(x, y - h, q);
        assert.ok(Math.abs((p[0] - q[0]) / (2 * h) - J[1]) < 1e-6 && Math.abs((p[1] - q[1]) / (2 * h) - J[3]) < 1e-6, `${group.id}: d/dy`);
      }
    }
    assert.ok(peak / s > 0.07 && peak / s < 0.10, `${group.id}: peak displacement ${(peak / s).toFixed(4)} of the tile size`);
    assert.ok(Math.abs(w.peak / s - WARP_PEAK) < 0.005, `${group.id}: reported peak`);
    assert.ok(minDet >= 0.35, `${group.id}: min Jacobian determinant ${minDet}`);
    // half amplitude is half the displacement
    const h = makeWarp(group, 0.5);
    const a = w.vec(0.123, 0.456), b = h.vec(0.123, 0.456);
    assert.ok(Math.hypot(a[0] - 2 * b[0], a[1] - 2 * b[1]) < 1e-12, group.id);
  }
});

// ---- round 3, finding #1 (qa/round3-triage.md): "Wavy at 1 leaves many cut edges straight or nearly straight" ----
// The bow of an edge: its straight segment mapped through warp.fwd (160 samples), the largest distance from the chord
// between the two warped ends (the reviewer's measure, dev/review-plane-cuts-check.mjs (a)).
function bowOf(w, a, b, steps = 160) {
  const q = [0, 0], A = w.fwd(a[0], a[1], [0, 0]), B = w.fwd(b[0], b[1], [0, 0]);
  const cl = Math.hypot(B[0] - A[0], B[1] - A[1]), nx = -(B[1] - A[1]) / cl, ny = (B[0] - A[0]) / cl;
  let dev = 0;
  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    w.fwd((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], q);
    dev = Math.max(dev, Math.abs((q[0] - A[0]) * nx + (q[1] - A[1]) * ny));
  }
  return dev;
}
/** Laptop pixels per world unit of the plane view: 550 px across its window of 2 viewHalf (1280 x 720, round 2). */
const laptopPx = (g) => 550 / (2 * g.viewHalf);
const withCuts = GROUPS.filter((g) => g.fold !== 'snowflake');

test('warp: at Wavy 1 every cut edge of every preset bends visibly (finding #1)', () => {
  // Two bars, both measured on the exact warped edge:
  //  (a) against the field's own scale: bow >= 0.35 P min(1, (L / 0.4 size)^2), P = the peak displacement. A wave bends a
  //      segment shorter than about half its length by ~ L^2, hence the square for short edges. Before the fix the
  //      smallest was 0.000 (22x 'Pocket': glide edges on lines the field was symmetric in); with it 0.45.
  //  (b) what the reviewer counted as visible: 4 px or more at the laptop scale for every edge longer than 30 px (a
  //      4 px bow shows against the 3 px stroke of a seam; 35 preset edges failed it, 22x 'Pocket' at 0.0 px). It is
  //      1.6 px on a 224 px phone plane, which is all a 7-10 % wave of a tile 40 px across can do there.
  let worstRel = Infinity, worstPx = Infinity, edges = 0, relLabel = '', pxLabel = '';
  for (const group of withCuts) {
    const w = makeWarp(group, 1), s = size(group), P = w.peak, px = laptopPx(group);
    for (const [pi, p] of group.presets.entries()) {
      const d = buildDomain(group, { seed: p.seed, metric: p.metric, warp: w }), n = d.poly.length;
      d.edges.forEach((e, i) => {
        if (e.kind !== 'cut' || e.len < 0.1 * s) return;
        edges++;
        const b = bowOf(w, d.poly[i], d.poly[(i + 1) % n]), label = `${group.id} preset ${pi} (${p.name}) edge ${i}`;
        const rel = b / (P * Math.min(1, (e.len / (0.4 * s)) ** 2));
        if (rel < worstRel) { worstRel = rel; relLabel = label; }
        assert.ok(rel >= 0.35, `${label}: bow ${(b / s).toFixed(4)} tile sizes = ${rel.toFixed(3)} of its target (edge ${(e.len / s).toFixed(2)} sizes long)`);
        if (e.len * px > 30) {
          if (b * px < worstPx) { worstPx = b * px; pxLabel = label; }
          assert.ok(b * px >= 4, `${label}: bows ${(b * px).toFixed(2)} px on a ${(e.len * px).toFixed(0)} px edge at the laptop scale`);
        }
      });
    }
  }
  console.log(`      ${edges} preset cut edges; smallest bow ${worstRel.toFixed(3)} of its target (${relLabel}), ${worstPx.toFixed(2)} px at the laptop scale (${pxLabel})`);
});

test('warp: tiles of random seeds stay wavy too — in every group at most a quarter of their long cut edges bow under 4 px', () => {
  // Not part of the finding (it is about presets), a guard of what came with the fix: before it, the share of cut
  // edges longer than 30 laptop px that bowed under 4 px was 100 % for *x, 53 % for 333, 52 % for 632 and 35-46 % for
  // 2222, 3*3, 2*22 and 22*; after it at most 20 %.
  const rnd = prng(4711), rows = [];
  for (const group of withCuts) {
    const w = makeWarp(group, 1), px = laptopPx(group);
    let long = 0, weak = 0;
    for (let k = 0; k < 60; k++) {
      const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
      const d = buildDomain(group, { seed, metric: group.presets[k % group.presets.length].metric, warp: w }), n = d.poly.length;
      d.edges.forEach((e, i) => {
        if (e.kind !== 'cut' || e.partner < i || e.len * px <= 30) return;
        long++;
        if (bowOf(w, d.poly[i], d.poly[(i + 1) % n], 64) * px < 4) weak++;
      });
    }
    rows.push(`${group.id} ${(100 * weak / long).toFixed(0)}%`);
    assert.ok(long > 50 && weak <= 0.25 * long, `${group.id}: ${weak} of ${long} long cut edges of random tiles bow under 4 px`);
  }
  console.log('      share of long cut edges of random tiles bowing under 4 px: ' + rows.join('  '));
});

test('warp: the field has no symmetry beyond the group — no extra translation, no glide axis it is symmetric in', () => {
  // The cause of the straight 22x 'Pocket' edges: frequencies with even m only gave v(x + e1/2) = v(x); composed with a
  // glide that is a reflection the field is equivariant under, and the tile's glide edges lay on its line.
  const rnd = prng(31);
  for (const group of withCuts) {
    const w = makeWarp(group, 1), P = w.peak, a = [0, 0], b = [0, 0];
    assert.ok(w.waves && w.waves.rel > 0, `${group.id}: the waves were chosen for the cut edges (warp.waves)`);
    const { e1, e2 } = group;
    for (const k of [2, 3, 4, 6]) {
      for (const [p, q] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const hx = (p * e1[0] + q * e2[0]) / k, hy = (p * e1[1] + q * e2[1]) / k;
        let worst = 0;
        for (let t = 0; t < 200; t++) {
          const x = 3 * rnd() - 1, y = 3 * rnd() - 1;
          w.vec(x, y, a); w.vec(x + hx, y + hy, b);
          worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1]));
        }
        assert.ok(worst > 0.05 * P, `${group.id}: v(x + (${p} e1 + ${q} e2) / ${k}) = v(x) (largest difference ${(worst / P).toExponential(2)} P)`);
      }
    }
    for (const g of symmetryElements(group, group.center[0], group.center[1], 2 * group.viewHalf).glides) {
      let across = 0;
      for (let t = -40; t <= 40; t++) {
        w.vec(g.px + 0.05 * t * g.ux, g.py + 0.05 * t * g.uy, a);
        across = Math.max(across, Math.abs(-a[0] * g.uy + a[1] * g.ux));
      }
      assert.ok(across > 0.05 * P, `${group.id}: the field never crosses the glide axis through (${g.px}, ${g.py})`);
    }
  }
});

test('warp: the choice of the waves is deterministic and gives the same field for a copy of the group', () => {
  const rnd = prng(57), a = [0, 0], b = [0, 0];
  for (const group of GROUPS) {
    const w = makeWarp(group, 1), twin = makeWarp({ ...group }, 1);      // a fresh object: the field is built again
    assert.deepEqual(twin.waves, w.waves, group.id);
    for (let k = 0; k < 50; k++) {
      const x = 4 * rnd() - 2, y = 4 * rnd() - 2;
      w.fwd(x, y, a); twin.fwd(x, y, b);
      assert.ok(a[0] === b[0] && a[1] === b[1], `${group.id}: the two builds differ at (${x}, ${y})`);
    }
  }
});

test('warp: tangent to every mirror of G, zero at every rotation centre', () => {
  const rnd = prng(9);
  for (const group of GROUPS) {
    const w = makeWarp(group, 1), s = size(group);
    const el = symmetryElements(group, group.center[0], group.center[1], 2);
    const v = [0, 0];
    for (const c of el.centers) {
      w.vec(c.x, c.y, v);
      assert.ok(Math.hypot(v[0], v[1]) < 1e-12, `${group.id}: v vanishes at the centre (${c.x}, ${c.y})`);
    }
    let along = 0;
    for (const m of el.mirrors) {
      for (let k = 0; k < 20; k++) {
        const t = 4 * rnd() - 2;
        w.vec(m.px + t * m.ux, m.py + t * m.uy, v);
        assert.ok(Math.abs(-v[0] * m.uy + v[1] * m.ux) < 1e-12, `${group.id}: v is tangent to the mirror`);
        along = Math.max(along, Math.abs(v[0] * m.ux + v[1] * m.uy));
      }
    }
    if (el.mirrors.length) assert.ok(along > 0.01 * s, `${group.id}: points slide along mirrors (${along / s})`);
  }
});

test('clampSeed: result is at least delta from every mirror and rotation centre; clear seeds are untouched; idempotent', () => {
  const rnd = prng(10);
  for (const group of GROUPS) {
    const delta = 0.06 * size(group);
    const el = symmetryElements(group, group.center[0], group.center[1], 3 * group.viewHalf + 2);
    const clearance = (x, y) => {
      let d = Infinity;
      for (const m of el.mirrors) d = Math.min(d, Math.abs(-(x - m.px) * m.uy + (y - m.py) * m.ux));
      for (const c of el.centers) d = Math.min(d, Math.hypot(x - c.x, y - c.y));
      return d;
    };
    const check = (x, y, what) => {
      const [cx, cy] = clampSeed(group, x, y);
      assert.ok(Number.isFinite(cx) && Number.isFinite(cy), `${group.id} ${what}: finite`);
      assert.ok(clearance(cx, cy) >= delta - 1e-12, `${group.id} ${what}: clearance ${clearance(cx, cy) / delta} delta at (${x}, ${y})`);
      if (clearance(x, y) >= delta) assert.deepEqual([cx, cy], [x, y], `${group.id} ${what}: a clear seed is unchanged`);
      else assert.ok(Math.hypot(cx - x, cy - y) < 6 * delta, `${group.id} ${what}: moved ${Math.hypot(cx - x, cy - y) / delta} delta`);
      assert.deepEqual(clampSeed(group, cx, cy), [cx, cy], `${group.id} ${what}: idempotent`);
    };
    for (const p of group.presets) check(p.seed[0], p.seed[1], 'preset ' + p.name);
    for (let k = 0; k < 300; k++) check(group.center[0] + (2 * rnd() - 1) * 2.5 * group.viewHalf, group.center[1] + (2 * rnd() - 1) * 2.5 * group.viewHalf, 'random');
    // exactly on the special loci, and a hair off them
    for (const c of el.centers.slice(0, 40)) {
      check(c.x, c.y, 'centre');
      check(c.x + 1e-13, c.y - 1e-13, 'near centre');
      check(c.x + (rnd() - 0.5) * delta, c.y + (rnd() - 0.5) * delta, 'around centre');
    }
    for (const m of el.mirrors.slice(0, 40)) {
      for (let k = 0; k < 6; k++) {
        const t = 2 * rnd() - 1;
        check(m.px + t * m.ux, m.py + t * m.uy, 'on mirror');
        check(m.px + t * m.ux - 1e-14 * m.uy, m.py + t * m.uy + 1e-14 * m.ux, 'near mirror');
      }
    }
  }
});

test('buildDomain: seeds on special loci (mirrors, centres, kaleidoscope creases and corners) give valid tiles', () => {
  for (const group of GROUPS) {
    const pts = [];
    const el = symmetryElements(group, group.center[0], group.center[1], 1.5);
    for (const c of el.centers.slice(0, 12)) pts.push([c.x, c.y]);
    for (const m of el.mirrors.slice(0, 8)) pts.push([m.px, m.py], [m.px + 0.137 * m.ux, m.py + 0.137 * m.uy]);
    if (group.kaleido) {
      const T = group.kaleido.cell, n = T.length;
      for (const k of elementsNear(group.kaleido.group, group.center[0], group.center[1], 1.2)) {
        const P = T.map((p) => apply(k, p[0], p[1]));
        for (let i = 0; i < n; i++) {
          const a = P[i], b = P[(i + 1) % n];
          pts.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [a[0] + 0.31 * (b[0] - a[0]), a[1] + 0.31 * (b[1] - a[1])]);
        }
        pts.push([(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3]);
      }
    }
    pts.push([0, 0], group.center, [group.e1[0] / 2, group.e1[1] / 2], [group.e2[0] / 2, group.e2[1] / 2], [(group.e1[0] + group.e2[0]) / 4, (group.e1[1] + group.e2[1]) / 4]);
    for (const p of pts) {
      const d = buildDomain(group, { seed: p });
      const label = `${group.id} seed (${p[0]}, ${p[1]})`;
      assert.ok(Math.abs(d.area - group.domainArea) < 1e-7, `${label}: area`);
      for (const e of d.edges) {
        assert.ok(e.len > 1e-9, `${label}: no zero-length edges`);
        assert.equal(d.edges[e.partner].partner, d.edges.indexOf(e), `${label}: paired`);
      }
    }
  }
});

test('buildDomain: defaults, metric handling and the named degenerate presets', () => {
  // defaults: preset 0, Euclidean metric, identity warp
  const g = BY_ID['333'];
  const d = buildDomain(g);
  assert.deepEqual(d.metric, [1, 0, 1]);
  assert.equal(d.warp.amp, 0);
  assert.equal(d.poly.length, 4);
  assert.equal(d.group, g);
  // 'o': the metric decides the shape (4, 4, 6 sides)
  const o = BY_ID['o'];
  assert.deepEqual(o.presets.map((p) => buildDomain(o, p).poly.length), [4, 4, 6]);
  assert.deepEqual(buildDomain(o, o.presets[0]).metric, o.presets[0].metric);
  // a metric that the point group does not preserve is ignored
  const p4 = BY_ID['442'];
  const skew = buildDomain(p4, { seed: [0.3, 0.12], metric: [1, 0.4, 2] });
  const plain = buildDomain(p4, { seed: [0.3, 0.12] });
  assert.deepEqual(skew.metric, [1, 0, 1]);
  assert.deepEqual(skew.poly, plain.poly);
  // an invariant non-trivial metric is used: for 2222 any positive form is invariant under the half-turn
  const p2 = BY_ID['2222'];
  assert.deepEqual(buildDomain(p2, { seed: [0.2, 0.33], metric: [1, 0.4, 2] }).metric, [1, 0.4, 2]);
  assert.deepEqual(buildDomain(p2, { seed: [0.2, 0.33], metric: [1, 3, 2] }).metric, [1, 0, 1], 'indefinite form is ignored');
  // four tiles meeting at a point: no spurious edges
  assert.equal(buildDomain(BY_ID['22x'], BY_ID['22x'].presets[0]).poly.length, 4);
  assert.equal(buildDomain(p2, p2.presets[1]).poly.length, 4);
  assert.equal(buildDomain(p4, p4.presets[0]).poly.length, 4);
  assert.equal(buildDomain(p4, p4.presets[1]).poly.length, 3);
  // the kaleidoscopes: the tile is the cell itself, all sides mirrors, no classes
  for (const id of ['*2222', '*442', '*333', '*632']) {
    const k = BY_ID[id], dk = buildDomain(k, { seed: [0.21, 0.17], warp: makeWarp(k, 1) });
    assert.equal(dk.classes, 0, id);
    assert.ok(dk.edges.every((e) => e.kind === 'mirror' && e.cls === -1), id);
    assert.equal(dk.poly.length, k.kaleido.cell.length, id);
    // the warp maps the tile onto itself: boundary points stay on their mirror line
    for (const o2 of dk.outline()) {
      const e = dk.edges[o2.edge];
      for (let i = 0; i < o2.pts.length; i += 2) assert.ok(Math.abs(e.nx * o2.pts[i] + e.ny * o2.pts[i + 1] - e.c) < 1e-6, id);
    }
  }
});

test('domain: the element g of every edge composes correctly around the tile (g_i g_j^-1 stays in the group)', () => {
  for (const group of GROUPS) {
    const d = buildDomain(group, group.presets[0]);
    for (const e of d.edges) for (const f of d.edges) assert.ok(contains(group, compose(e.g, inverse(f.g))), group.id);
  }
});
