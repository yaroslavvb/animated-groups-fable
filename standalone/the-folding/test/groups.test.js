// Validates the group tables: closure, lattice invariance, kaleidoscope index, glued/open sides, symmetry elements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, contains, elementsNear, symmetryElements, latticeCoords } from '../src/groups.js';
import { compose, inverse, polyArea, classify } from '../src/geom.js';
import { HASSE_NODES, HASSE_EDGES } from '../src/hasse-data.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('17 groups, unique ids, presets present', () => {
  assert.equal(GROUPS.length, 17);
  assert.equal(new Set(GROUPS.map((g) => g.id)).size, 17);
  for (const g of GROUPS) {
    assert.ok(g.presets.length >= 1, g.id + ' has presets');
    assert.ok(g.fold, g.id + ' has a fold type');
  }
});

test('closure: products and inverses of coset representatives stay in the group', () => {
  for (const g of GROUPS) {
    for (const r of g.reps) {
      assert.ok(contains(g, inverse(r)), g.id + ' inverse');
      for (const s of g.reps) assert.ok(contains(g, compose(r, s)), g.id + ' product');
    }
  }
});

test('point group preserves the lattice', () => {
  for (const g of GROUPS) {
    for (const r of g.reps) {
      for (const e of [g.e1, g.e2]) {
        const st = latticeCoords(g, r.a * e[0] + r.b * e[1], r.c * e[0] + r.d * e[1]);
        assert.ok(near(st[0], Math.round(st[0]), 1e-7) && near(st[1], Math.round(st[1]), 1e-7), g.id + ' lattice');
      }
    }
  }
});

test('kaleidoscope: orientation-preserving part has index 2 (hinge, crosscap) or the group is the kaleidoscope (snowflake)', () => {
  for (const g of GROUPS) {
    if (!g.kaleido) { assert.ok(['torus', 'cylinder', 'mobius', 'klein'].includes(g.fold), g.id); continue; }
    const k = g.kaleido.group;
    const cellArea = polyArea(g.kaleido.cell);
    assert.ok(cellArea > 0, g.id + ' cell is counter-clockwise');
    assert.ok(near(cellArea, k.domainArea, 1e-9), g.id + ' cell is a fundamental domain of the kaleidoscope');
    if (g.fold === 'hinge') {
      for (const r of g.reps) assert.ok(contains(k, r), g.id + ' is a subgroup of its kaleidoscope');
      assert.ok(near(g.domainArea, 2 * cellArea, 1e-9), g.id + ' has index 2 in its kaleidoscope');
    } else if (g.fold === 'crosscap') {
      for (const r of g.reps) if (r.a * r.d - r.b * r.c > 0) assert.ok(contains(k, r), g.id + ' rotations lie in the kaleidoscope');
      assert.ok(near(g.domainArea, cellArea, 1e-9), g.id + ' tile area = cell area (half the pillow)');
      for (const r of g.reps) assert.ok(contains(g.warp, r), g.id + ' is a subgroup of its warp group');
      for (const r of k.reps) assert.ok(contains(g.warp, r), g.id + ' kaleidoscope is a subgroup of its warp group');
    } else if (g.fold === 'snowflake') {
      assert.ok(near(g.domainArea, cellArea, 1e-9), g.id);
      assert.ok(g.kaleido.glued.every((x) => !x), g.id + ' every side is a mirror');
    }
  }
});

test('glued / open sides of the kaleidoscope cell', () => {
  const expected = {
    '2222': [true, true, true, true],
    '22*': [true, true, false, true],   // bottom y=0, right, top y=0.4 (mirror), left
    '2*22': [false, true, true, false], // bottom (mirror), right, top, left (mirror)
    '442': [true, true, true],
    '4*2': [true, false, true],         // y=0, mirror x+y=1/2, x=y
    '333': [true, true, true],
    '3*3': [false, true, true],         // y=0 (mirror), x=1/2, 30-degree line
    '632': [true, true, true],
    '22x': [true, true, true, true],
  };
  for (const [id, exp] of Object.entries(expected)) assert.deepEqual(BY_ID[id].kaleido.glued, exp, id);
});

test('rotation centres per lattice cell and presence of mirrors / glides', () => {
  // per primitive cell: number of rotation centres by order
  const expect = {
    'o': {}, '2222': { 2: 4 }, '**': {}, 'xx': {}, '*x': {}, '22x': { 2: 4 }, '22*': { 2: 4 }, '*2222': { 2: 4 }, '2*22': { 2: 4 },
    '442': { 4: 2, 2: 2 }, '4*2': { 4: 2, 2: 2 }, '*442': { 4: 2, 2: 2 }, '333': { 3: 3 }, '3*3': { 3: 3 }, '*333': { 3: 3 },
    '632': { 6: 1, 3: 2, 2: 3 }, '*632': { 6: 1, 3: 2, 2: 3 },
  };
  const hasMirror = { 'o': 0, '2222': 0, '**': 1, 'xx': 0, '*x': 1, '22x': 0, '22*': 1, '*2222': 1, '2*22': 1, '442': 0, '4*2': 1, '*442': 1, '333': 0, '3*3': 1, '*333': 1, '632': 0, '*632': 1 };
  const hasGlide = { 'o': 0, '2222': 0, '**': 0, 'xx': 1, '*x': 1, '22x': 1, '22*': 1, '*2222': 0, '2*22': 1, '442': 0, '4*2': 1, '*442': 1, '333': 0, '3*3': 1, '*333': 1, '632': 0, '*632': 1 };
  for (const g of GROUPS) {
    const R = 6;
    const el = symmetryElements(g, g.center[0], g.center[1], R);
    const counts = {};
    for (const c of el.centers) {
      // count centres whose lattice coordinates fall in [0,1)^2
      const st = latticeCoords(g, c.x, c.y);
      const fs = st[0] - Math.floor(st[0] + 1e-7), ft = st[1] - Math.floor(st[1] + 1e-7);
      if (fs >= -1e-7 && fs < 1 - 1e-7 && ft >= -1e-7 && ft < 1 - 1e-7 && Math.hypot(c.x - g.center[0], c.y - g.center[1]) < R - 2.5) {
        counts[c.order] = (counts[c.order] || 0) + 1;
      }
    }
    // each lattice cell near the centre is counted once per translate, so normalise by counting cells
    const cells = new Set();
    for (const c of el.centers) {
      const st = latticeCoords(g, c.x, c.y);
      if (Math.hypot(c.x - g.center[0], c.y - g.center[1]) < R - 2.5) cells.add(Math.floor(st[0] + 1e-7) + ',' + Math.floor(st[1] + 1e-7));
    }
    const exp = expect[g.id];
    if (Object.keys(exp).length === 0) assert.equal(el.centers.length, 0, g.id + ' has no rotation centres');
    else {
      const perCell = {};
      for (const c of el.centers) {
        if (Math.hypot(c.x - g.center[0], c.y - g.center[1]) >= R - 2.5) continue;
        perCell[c.order] = (perCell[c.order] || 0) + 1;
      }
      const ratioKeys = Object.keys(exp).map(Number);
      const base = perCell[ratioKeys[0]] / exp[ratioKeys[0]];
      for (const o of ratioKeys) assert.ok(Math.abs(perCell[o] / exp[o] - base) / base < 0.25, g.id + ' centre ratio for order ' + o);
      assert.deepEqual(Object.keys(perCell).map(Number).sort(), ratioKeys.slice().sort(), g.id + ' centre orders');
    }
    assert.equal(el.mirrors.length > 0 ? 1 : 0, hasMirror[g.id], g.id + ' mirrors');
    assert.equal(el.glides.length > 0 ? 1 : 0, hasGlide[g.id], g.id + ' glides');
  }
});

test('elementsNear returns distinct elements of the group', () => {
  for (const g of GROUPS) {
    const els = elementsNear(g, g.center[0], g.center[1], 2.0);
    assert.ok(els.length >= g.reps.length, g.id);
    const keys = new Set(els.map((e) => [e.a, e.b, e.c, e.d, e.tx, e.ty].map((v) => Math.round(v * 1e6)).join(',')));
    assert.equal(keys.size, els.length, g.id + ' distinct');
    for (const e of els) assert.ok(contains(g, e), g.id + ' member');
    assert.ok(els.some((e) => classify(e).type === 'identity'), g.id + ' identity present');
  }
});

test('hasse data covers the 17 groups', () => {
  assert.equal(HASSE_NODES.length, 17);
  for (const n of HASSE_NODES) assert.ok(BY_ID[n.id], n.id);
  for (const [u, v, idx] of HASSE_EDGES) {
    assert.ok(BY_ID[u] && BY_ID[v], u + '->' + v);
    assert.equal(BY_ID[v].reps.length / BY_ID[u].reps.length, idx, u + '->' + v + ' index matches point-group orders');
  }
});
