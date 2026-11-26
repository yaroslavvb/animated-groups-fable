// paisley.test.js — the print of the Classification of Surfaces page, on this page (src/paisley.js).
//
// His ask, Thu 26 Nov 2026: "…two-features-two-handles should look like …classification-of-surfaces#sym&k=3333".
// So nothing here is looked up either: that page's own tile (catalog.js domainOf), its own print (motifs.js design)
// and its own first view (the tile's middle in the middle) are built, and this page's default pattern in its first
// view is held to them outline point for outline point. Then the promise this page adds: a Twist cuts the print
// along the isolating cut and slides it, and no part of a comma ever crosses that cut.

import test from 'node:test';
import assert from 'node:assert/strict';

import { GH, GE, FAMILIES, normalizeFamilyKey, defaultCommas, centredFor, paisleyInfo, paisleyView } from '../src/handles.js';
import { createPaisley } from '../src/paisley.js';
import { mul, apply } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { analyse, tiles } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { design } from '../../2026-11-15-classification-of-surfaces/src/sym/motifs.js';
import { parse, domainOf } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';

const CHIPS = ['3333', '2223', '2222', '333*', '333*3', '333x', 'o33'];
const FOUR_CONES = ['2345', '9999', '2229', '2227', '3456'];          // typed: four cone points of any orders
const WITH_A_CUFF = ['234*5', '957*', '957x', 'o27'];                 // typed: a mirror, a crosscap or a handle
const LAP = 0.004;                                                    // paisley.js: the two parts of a comma overlap by two hairs

/** The default state of the family a signature names, as page.js makes it. */
function stateOf(text, over = {}) {
  const k = normalizeFamilyKey(text);
  assert.ok(k, `${text} is a family`);
  const fam = FAMILIES[k], perm = fam.defaultM.split('').map(Number);
  return {
    k, perm, orders: perm.map((c) => fam.baseOrders[c]),
    L: over.L ?? fam.defaultL, tw: over.tw ?? fam.defaultTw, b: over.b ?? fam.defaultB ?? 0, tau: over.tau ?? fam.defaultTau ?? 0,
    thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)),
  };
}
const geomOf = (k) => (FAMILIES[k].kind === 'E' ? GE : GH);
/** Where a point of the geometry is on the pane: the Poincaré disc, or the plane itself. */
const flat = (G, p) => (G.kind === 'H' ? [p[0] / (1 + p[2]), p[1] / (1 + p[2])] : [p[0], p[1]]);
/** The line through a and b as paisley.js keeps it: side(m, p) is p's distance from it (its sinh on the hyperbolic plane). */
function lineOf(G, a, b) {
  const m = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const w = G.kind === 'H' ? Math.sqrt(Math.max(1e-300, m[0] * m[0] + m[1] * m[1] - m[2] * m[2])) : Math.hypot(m[0], m[1]) || 1;
  return [m[0] / w, m[1] / w, m[2] / w];
}
const side = (m, p) => m[0] * p[0] + m[1] * p[1] + m[2] * p[2];

test('the seven chips and four cone points of any orders open on that page\'s tile; a typed cuff gets the same design on this page\'s tile', () => {
  for (const text of [...CHIPS, ...FOUR_CONES]) {
    const k = normalizeFamilyKey(text), info = paisleyInfo(k);
    assert.equal(info.error, null, `${text}: ${info.error}`);
    assert.ok(info.exact, `${text}: a motion carries that page's tile onto this page's default pattern`);
    assert.ok(info.shapes >= 1 && info.tied.length >= info.shapes, `${text}: every comma is carried by a cone point`);
    assert.ok(paisleyView(k), `${text}: a first view`);
  }
  for (const text of FOUR_CONES) {
    const fam = FAMILIES[normalizeFamilyKey(text)];
    assert.ok(fam.custom && fam.defaultM === '0132' && fam.defaultTw === 0 && fam.defaultL > 0, `${text}: its default numbers are that page's metric`);
  }
  for (const text of WITH_A_CUFF) {
    const k = normalizeFamilyKey(text), info = paisleyInfo(k);
    assert.equal(info.error, null, `${text}: ${info.error}`);
    assert.ok(!info.exact && info.shapes >= 1 && paisleyView(k) === null, `${text}: Paisley on this page's own tile, opened on its pair`);
  }
});

test('at the default numbers, in the first view, the print is that page\'s print in its first view: outline point for outline point', () => {
  for (const text of [...CHIPS, ...FOUR_CONES]) {
    const st = stateOf(text), k = st.k, G = geomOf(k);
    const model = centredFor(st), V = paisleyView(k);
    const D0 = domainOf(parse(k)), A0 = analyse(D0), theirs = design(D0);
    // the two pages draw the plane to one scale on the screen (a tile's area): a unit here is z units there
    const z = G.kind === 'E' ? Math.sqrt(Math.abs(G.area(model.D.verts)) / Math.abs(G.area(D0.verts))) : 1;
    // 333*, 333*3, 333x and o33 carry that page's metric to six digits; the others to the last
    const tol = /[*x]|o/.test(k) ? 4e-4 : 1e-7;

    // that page's print in its first view (its tile's middle in the middle), on the tiles round the middle
    const T = G.translate(D0.at, G.origin), cell = 1e-3, grid = new Map();
    const keyOf = (x, y) => Math.round(x / cell) + ':' + Math.round(y / cell);
    const ts0 = tiles(D0, A0, { radius: G.kind === 'E' ? 18 : 7.5, max: 6000, ms: 60000 });
    ts0.forEach((t, ti) => {
      const M = mul(T, t.M);
      theirs.forEach((sh, j) => sh.pts.forEach((p, i) => {
        const q = flat(G, apply(M, p)).map((x) => x * z), key = keyOf(q[0], q[1]);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push({ q, ti, j, i });
      }));
    });
    const find = (q) => {
      let best = null, bd = tol;
      const cx = Math.round(q[0] / cell), cy = Math.round(q[1] / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const e of grid.get((cx + dx) + ':' + (cy + dy)) || []) { const d = Math.hypot(e.q[0] - q[0], e.q[1] - q[1]); if (d < bd) { bd = d; best = e; } }
      }
      return best;
    };

    // this page's print: every part once, at its cone point, seen in the first view
    // (an outline may name a point twice, where it closes: such points count once)
    const first = theirs.map((sh) => sh.pts.map((p, i) => sh.pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-12)));
    const used = theirs.map(() => new Set());
    assert.ok(model.shapes.length >= theirs.length, `${text}: ${model.shapes.length} parts of ${theirs.length} commas`);
    model.shapes.forEach((part, pi) => {
      const hits = part.pts.map((p) => find(flat(G, apply(V, p)))).filter(Boolean);
      assert.ok(hits.length >= 3, `${text} part ${pi}: ${hits.length} of its ${part.pts.length} points lie on that page's print`);
      assert.ok(hits.every((h) => h.ti === hits[0].ti && h.j === hits[0].j), `${text} part ${pi}: on one comma of that page`);
      assert.ok(part.pts.length - hits.length <= 12, `${text} part ${pi}: only where the cut crosses it does it leave that page's outline`);
      for (const h of hits) used[h.j].add(first[h.j][h.i]);
    });
    theirs.forEach((sh, j) => assert.equal(used[j].size, new Set(first[j]).size, `${text} comma ${j}: its parts make up the whole comma`));
  }
});

test('a Twist cuts the print along the isolating cut and slides it: no part of a comma crosses the cut, at any Twist', () => {
  for (const text of [...CHIPS, ...FOUR_CONES, ...WITH_A_CUFF]) {
    const st0 = stateOf(text), k = st0.k, G = geomOf(k), info = paisleyInfo(k);
    for (const dtw of [0, 0.07, -0.13, 0.31, -0.5, 0.5]) {
      const tw = Math.max(-0.5, Math.min(0.5, st0.tw + dtw));
      const model = centredFor({ ...st0, tw });
      const ts = tiles(model.D, model.A, { radius: G.kind === 'E' ? 9 : 7, max: 2500, ms: 60000 });
      const cuts = ts.map((t) => lineOf(G, apply(t.M, model.cutSeg[0]), apply(t.M, model.cutSeg[1])));
      assert.equal(model.shapes.length, info.tied.length, `${text}: every part is drawn`);
      model.shapes.forEach((part, pi) => {
        for (const m of cuts) {
          let lo = Infinity, hi = -Infinity;
          for (const p of part.pts) { const d = side(m, p); if (d < lo) lo = d; if (d > hi) hi = d; }
          assert.ok(Math.min(-lo, hi) <= 2 * LAP + 1e-6, `${text} tw=${tw.toFixed(3)} part ${pi}: it reaches ${Math.min(-lo, hi).toFixed(4)} across a lift of the cut`);
        }
      });
    }
  }
});

test('the print is made the same way every time: no clock, no order of asking', () => {
  const again = createPaisley({ families: FAMILIES, centred: (st, commas) => centredFor(st, { commas }), GH, GE });
  for (const text of [...CHIPS, '2345', '234*5'].reverse()) {
    const k = normalizeFamilyKey(text);
    assert.deepEqual(again.specs(k), defaultCommas(k), `${text}: the same parts on the same cone points`);
    assert.deepEqual(again.view(k), paisleyView(k), `${text}: the same first view`);
    assert.deepEqual(again.info(k), paisleyInfo(k));
  }
});
