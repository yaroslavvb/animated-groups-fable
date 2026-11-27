// paisley.test.js — the print of the Classification of Surfaces page, on this page (src/paisley.js).
//
// His ask, Thu 26 Nov 2026: "…two-features-two-handles should look like …classification-of-surfaces#sym&k=3333".
// So nothing here is looked up either: that page's own tile (catalog.js domainOf), its own print (motifs.js design)
// and its own first view (the tile's middle in the middle) are built, and this page's default pattern in its first
// view is held to them outline point for outline point. Then the promise this page adds, after his "make sure
// that this is changed so that there are less breaks in pattern … The commas are all whole": at any Twist, of the
// family's own pair or of a pair picked on it, every comma is whole, lies in one block, and meets no other.

import test from 'node:test';
import assert from 'node:assert/strict';

import { GH, GE, FAMILIES, normalizeFamilyKey, defaultCommas, centredFor, recut, paisleyInfo, paisleyView, paisleyPrint, retiePrint, linkedPrint, printScale } from '../src/handles.js';
import { createPaisley } from '../src/paisley.js';
import { mul, apply } from '../../classification-of-surfaces/src/sym/geom.js';
import { analyse, tiles } from '../../classification-of-surfaces/src/sym/orbifold.js';
import { design } from '../../classification-of-surfaces/src/sym/motifs.js';
import { parse, domainOf } from '../../classification-of-surfaces/src/sym/catalog.js';

const CHIPS = ['3333', '2223', '2222', '333*', '333*3', '333x', 'o33'];
const FOUR_CONES = ['2345', '9999', '2229', '2227', '3456'];          // typed: four cone points of any orders
const WITH_A_CUFF = ['234*5', '957*', '957x', 'o27'];                 // typed: a mirror, a crosscap or a handle
const LAP = 0.004;                                                    // paisley.js: a hair
const TURN = 0.025;                                                   // paisley.js: over this much Twist an oversized comma is drawn in
const PAIRS = [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]];

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

/** A point where straight lines are the geometry's lines: the plane itself, or Klein's disc. */
const straight = (G, p) => (G.kind === 'H' ? [p[0] / p[2], p[1] / p[2]] : [p[0], p[1]]);
/** Do two outlines (lists of such points) share ground: an edge of one across an edge of the other, or one inside the other? */
function overlap(P, Q) {
  const box = (R) => R.reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const a = box(P), b = box(Q);
  if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) return false;
  const turn = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  for (let i = 0; i < P.length; i++) {
    const p1 = P[i], p2 = P[(i + 1) % P.length];
    for (let j = 0; j < Q.length; j++) {
      const q1 = Q[j], q2 = Q[(j + 1) % Q.length];
      const d1 = turn(p1, p2, q1), d2 = turn(p1, p2, q2), d3 = turn(q1, q2, p1), d4 = turn(q1, q2, p2);
      if (d1 * d2 < -1e-18 && d3 * d4 < -1e-18) return true;
    }
  }
  const inside = (pt, R) => { let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) if ((R[i][1] > pt[1]) !== (R[j][1] > pt[1]) && pt[0] < ((R[j][0] - R[i][0]) * (pt[1] - R[i][1])) / (R[j][1] - R[i][1]) + R[i][0]) c = !c; return c; };
  return inside(P[0], Q) || inside(Q[0], P);
}
/**
 * The pattern of a state looked over: `joints` is how far the deepest comma reaches across a joint (the curves at
 * the offset `delta` from the lifts of the state's cut: paisley.js jointOf), `meet` how many pairs of commas share
 * ground, over the tiles round the middle.
 */
function lookOver(state, delta) {
  const G = geomOf(state.k), fam = FAMILIES[state.k], model = centredFor(state);
  const ts = tiles(model.D, model.A, { radius: G.kind === 'E' ? 7 : 5.5, max: 1600, ms: 60000 });
  const coneSlots = [0, 1, 2, 3].filter((f) => fam.baseOrders[f] > 1).map((f) => state.perm.indexOf(f));
  const far = (v) => (G.kind === 'H' ? Math.asinh(v) : v) - delta;          // how far past the joint, as a distance
  let joints = -Infinity;
  for (const t of ts) {
    let m = lineOf(G, apply(t.M, model.cutSeg[0]), apply(t.M, model.cutSeg[1])), sgn = 0;
    for (const slot of coneSlots) { const v = side(m, apply(t.M, model.home[slot])); sgn += slot < 2 ? -v : v; }
    if (sgn < 0) m = m.map((x) => -x);
    for (const sh of model.shapes) {
      let lo = Infinity, hi = -Infinity;
      for (const q of sh.pts) { const d = far(side(m, q)); if (d < lo) lo = d; if (d > hi) hi = d; }
      joints = Math.max(joints, Math.min(-lo, hi));
    }
  }
  const base = model.shapes.map((sh) => sh.pts.map((q) => straight(G, q)));
  let meet = 0;
  for (const t of ts) {
    const same = t.M.every((x, i) => Math.abs(x - (i % 4 === 0 ? 1 : 0)) < 1e-9);
    model.shapes.forEach((sh, j) => {
      const copy = sh.pts.map((q) => straight(G, apply(t.M, q)));
      base.forEach((mine, i) => { if (same && i >= j) return; if (Math.hypot(copy[0][0] - mine[0][0], copy[0][1] - mine[0][1]) < 1e-9) return; if (overlap(mine, copy)) meet++; });
    });
  }
  return { joints, meet, shapes: model.shapes.length };
}
/** The state a pick leaves, with its print re-tied, as page.js makes it. */
function afterPick(st, i, j) {
  const r = recut(st, i, j);
  const next = { k: st.k, perm: r.perm, orders: r.orders, L: r.L, tw: r.tw, b: r.b ?? st.b, tau: r.tau ?? st.tau, thetas: r.thetas };
  next.print = retiePrint(next, st);
  return { next, r };
}

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

test('at any Twist every comma is whole, lies in one block and meets no other', () => {
  for (const text of [...CHIPS, ...FOUR_CONES, ...WITH_A_CUFF]) {
    const st0 = stateOf(text), k = st0.k, info = paisleyInfo(k);
    assert.equal(info.tied.length, info.shapes, `${text}: no comma is cut (${info.tied.length} drawn of ${info.shapes})`);
    assert.ok(info.joint.clear, `${text}: a joint that runs through no comma`);
    for (const dtw of [0, 0.004, 0.012, 0.02, 0.026, 0.07, -0.13, 0.31, -0.5, 0.5]) {
      const tw = Math.max(-0.5, Math.min(0.5, st0.tw + dtw)), state = { ...st0, tw };
      const seen = lookOver(state, info.joint.delta), away = Math.min(Math.abs(tw - st0.tw), 1 - Math.abs(tw - st0.tw));
      assert.equal(seen.shapes, info.shapes, `${text}: every comma is drawn, whole`);
      assert.equal(seen.meet, 0, `${text} tw=${tw.toFixed(3)}: ${seen.meet} pairs of commas share ground`);
      // an oversized comma (333∗'s fills its tile) is that page's at the family's own Twist, and inside its block once the Twist has left it
      if (info.fit === 1 || away >= TURN) assert.ok(seen.joints <= 1e-6, `${text} tw=${tw.toFixed(3)}: a comma reaches ${seen.joints.toFixed(4)} across a joint`);
      assert.ok(Math.abs(printScale(state) - (info.fit === 1 || away === 0 ? 1 : Math.max(info.fit, printScale(state)))) < 1e-12 && printScale(state) <= 1 && printScale(state) >= info.fit - 1e-12);
    }
  }
  // the four chips whose commas fit their blocks are drawn at that page's size at every Twist; the three with one comma to a tile draw it in a little
  for (const text of ['3333', '2223', '2222', 'o33']) assert.equal(paisleyInfo(normalizeFamilyKey(text)).fit, 1, `${text}: the commas fit their blocks`);
  for (const text of ['333*', '333*3', '333x']) { const fit = paisleyInfo(normalizeFamilyKey(text)).fit; assert.ok(fit < 1 && fit > 0.8, `${text}: drawn in to ${fit}`); }
});

test('a pick moves no comma and ties it to the new pair\'s blocks: a Twist along the new cut keeps the commas whole and apart', () => {
  for (const text of CHIPS) {
    const st0 = stateOf(text), k = st0.k, G = geomOf(k), before = centredFor(st0);
    for (const [i, j] of PAIRS) {
      const { next, r } = afterPick(st0, i, j), after = centredFor(next);
      assert.equal(after.shapes.length, before.shapes.length, `${text} (${i},${j}): as many commas`);
      // every comma after the pick is a comma before it, carried into the new pair's frame (Q) and round by the pattern
      const ts = tiles(after.D, after.A, { radius: G.kind === 'E' ? 9 : 7, max: 2500, ms: 60000 });
      const old = before.shapes.map((sh) => sh.pts.map((q) => apply(r.Q, q)));
      for (const sh of after.shapes) {
        let best = Infinity;
        for (const o of old) { if (o.length !== sh.pts.length) continue; for (const t of ts) { let worst = 0; for (let q = 0; q < o.length && worst < best; q += 7) worst = Math.max(worst, G.dist(apply(t.M, o[q]), sh.pts[q])); if (worst < best) best = worst; } }
        assert.ok(best < 1e-7, `${text} (${i},${j}): a comma moved by ${best}`);
      }
      assert.ok(next.print.joint.clear, `${text} (${i},${j}): a joint for the new cut`);
      for (const dtw of [0, 0.01, -0.02, 0.03, -0.1, 0.33]) {
        const tw = Math.max(-0.5, Math.min(0.5, next.tw + dtw)), state = { ...next, tw };
        const seen = lookOver(state, next.print.joint.delta), away = Math.min(Math.abs(tw - next.tw), 1 - Math.abs(tw - next.tw));
        assert.equal(seen.meet, 0, `${text} (${i},${j}) tw=${tw.toFixed(3)}: ${seen.meet} pairs of commas share ground`);
        if (next.print.fit === 1 || away >= TURN) assert.ok(seen.joints <= 1e-6, `${text} (${i},${j}) tw=${tw.toFixed(3)}: a comma reaches ${seen.joints.toFixed(4)} across a joint`);
      }
    }
  }
  // on 3333 and 2223 every pair's blocks hold that page's commas whole; on 2222 all but the two diagonal pairs do
  for (const [text, tight] of [['3333', []], ['2223', []], ['2222', ['1,2', '0,3']]]) {
    const st0 = stateOf(text);
    for (const [i, j] of PAIRS) assert.equal(afterPick(st0, i, j).next.print.fit < 1, tight.includes(`${i},${j}`), `${text} (${i},${j})`);
  }
});

test('a link to another pair gets the print that picks leave on the default pattern', () => {
  for (const [text, reach] of [['3333', 24], ['2223', 24], ['2222', 6], ['333*', 6], ['o33', 6]]) {
    const k = normalizeFamilyKey(text), fam = FAMILIES[k], count = paisleyInfo(k).shapes;
    const perms = [];
    const walk = (rest, got) => { if (!rest.length) perms.push(got); else rest.forEach((x, i) => walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...got, x])); };
    walk([0, 1, 2, 3], []);
    assert.equal(linkedPrint(k, fam.defaultM.split('').map(Number)), null, `${text}: the family's own pair has the family's print`);
    let reached = 1;
    for (const perm of perms) {
      const lp = linkedPrint(k, perm);
      if (!lp) continue;
      reached++;
      const state = { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: lp.base.L, tw: lp.base.tw, b: lp.base.b, tau: lp.base.tau, thetas: lp.thetas, print: lp.print };
      const seen = lookOver(state, lp.print.joint.delta);
      assert.ok(seen.shapes === count && seen.meet === 0, `${text} m=${perm.join('')}: ${seen.shapes} commas of ${count}, ${seen.meet} pairs sharing ground`);
    }
    assert.equal(reached, reach, `${text}: the pairings picks can name`);
  }
});

test('the print is made the same way every time: no clock, no order of asking', () => {
  const again = createPaisley({ families: FAMILIES, centred: (st, commas) => centredFor(st, { commas }), GH, GE });
  for (const text of [...CHIPS, '2345', '234*5'].reverse()) {
    const k = normalizeFamilyKey(text);
    assert.deepEqual(again.specs(k), defaultCommas(k), `${text}: the same parts on the same cone points`);
    assert.deepEqual(again.view(k), paisleyView(k), `${text}: the same first view`);
    assert.deepEqual(again.info(k), paisleyInfo(k));
    assert.deepEqual(again.print(k), paisleyPrint(k), `${text}: the same print`);
  }
});
