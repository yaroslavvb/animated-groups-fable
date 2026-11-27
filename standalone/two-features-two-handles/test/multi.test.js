// multi.test.js — orbifolds with more than two pairs (five or six cone points: src/multi.js), and orbifolds shown
// still (every other signature that has a pattern).
//
// His ask, Thu 26 Nov 2026: "user interface to allow modifying more orbifolds, more than just 2 pairs ones like
// 2222. Perhaps a plus button I can click to select another pair for modification. Also support other orbifolds
// which don't have these parameters. In that case, the pair controls are just disabled."
//
// Nothing is looked up: a signature is built from its pairs' Lengths and Twists, its tile is folded up on paper
// (orbifold.js analyse) and the signature read off again; the default shape is held to the Classification of
// Surfaces page's polygon; and the print is held to the promise of the four-feature families: at any Twist of any
// pair every comma is whole and meets no other.

import test from 'node:test';
import assert from 'node:assert/strict';

import { GH, invH, FAMILIES, normalizeFamilyKey, buildPatternModel, multiState, multiAtDefaults, multiPrint, multiCentred, multiBuild, surfacePartsFor, pairMetricsFor, psuToSO21 } from '../src/handles.js';
import { readSignature, kindOf, whyNot, movesOf, stillSpec } from '../src/custom.js';
import { mul, apply, I3 } from '../../classification-of-surfaces/src/sym/geom.js';
import { analyse, signatureOf, tiles } from '../../classification-of-surfaces/src/sym/orbifold.js';
import { design } from '../../classification-of-surfaces/src/sym/motifs.js';
import { parse, domainOf } from '../../classification-of-surfaces/src/sym/catalog.js';
import { inscribed } from '../../classification-of-surfaces/src/sym/domains.js';
import { buildSurface } from '../../classification-of-surfaces/src/sym/surface.js';

const G = GH, TAU = 2 * Math.PI;
const MANY = ['22222', '222222', '33333', '333333', '22233', '223344', '23456', '234567', '22223', '99999'];
const sorted = (list) => list.slice().sort().join('');
const areaOf = (orders) => TAU * (orders.reduce((s, n) => s + 1 - 1 / n, 0) - 2);
/** A state of a family of five or six cone points, its pairs' numbers moved off the defaults by `by` (0: the defaults). */
function stateOf(text, by = 0, active = 0) {
  const k = normalizeFamilyKey(text), d = FAMILIES[k].defaults;
  return multiState(k, { Ls: d.L.map((v, i) => v * (1 + by * (0.3 - 0.25 * i))), tws: d.tw.map((_, i) => by * (0.34 - 0.29 * i)), active, shown: d.L.length });
}
/**
 * How far apart two points are, told well when they are close (2 sinh of half the distance, from their difference:
 * G.dist goes by acosh of a product that is 1 for one point, and a few units from the plane's own point that loses
 * half the digits).
 */
const gap = (p, q) => { const x = p[0] - q[0], y = p[1] - q[1], z = p[2] - q[2]; return Math.sqrt(Math.max(0, x * x + y * y - z * z)); };
/**
 * Is { D, A } a tile of its pattern? Held to what a tile IS, with no help from the code that made it: the tile's
 * own point is the plane's own; each edge lies half way between it and its copy across the edge; the edge it is
 * glued to is carried onto it by the same motion, end for end; no corner is nearer to any neighbour's point than to
 * the tile's own; its area is the orbifold's; every cone point is a corner; and the motions are given a second
 * time as spinors, the same ones. Returns what is wrong, or ''.
 * (A corner where two edges meet at a hair's angle, far out, is placed to five digits and no better: 5e-5.)
 */
function tileFaults(c, orders) {
  const { D, A } = c, n = D.n, at = D.at, out = [];
  if (G.dist(at, G.origin) > 1e-12) out.push('the tile is not in its own frame');
  for (let i = 0; i < n; i++) {
    const a = D.verts[i], b = D.verts[(i + 1) % n], far = apply(A.maps[i], at), j = D.edges[i].to;
    if (Math.abs(G.dist(a, at) - G.dist(a, far)) > 1e-6 || Math.abs(G.dist(b, at) - G.dist(b, far)) > 1e-6) out.push(`edge ${i} is not half way to its neighbour`);
    if (D.edges[j].to !== i) out.push(`edge ${i}: its partner ${j} is glued elsewhere`);
    if (gap(apply(A.maps[i], D.verts[j]), b) > 5e-5 || gap(apply(A.maps[i], D.verts[(j + 1) % n]), a) > 5e-5) out.push(`edge ${i}: its partner is not carried onto it`);
    const M2 = psuToSO21(A.maps2[i]), size = Math.max(...A.maps[i].map(Math.abs));
    if (Math.max(...M2.map((x, q) => Math.abs(x - A.maps[i][q]))) > 1e-9 * size) out.push(`edge ${i}: its spinor is another motion`);
  }
  for (const v of D.verts) for (let i = 0; i < n; i++) if (G.dist(v, at) > G.dist(v, apply(A.maps[i], at)) + 1e-6) out.push('a corner lies nearer to a neighbour');
  if (Math.abs(G.area(D.verts) - areaOf(orders)) > 2e-4) out.push(`area ${G.area(D.verts)} for ${areaOf(orders)}`);
  if (A.classes.length !== orders.length || !A.classes.every((cl, f) => cl.n === orders[f] && cl.off < 5e-5)) out.push('a cone point is not a corner of the tile');
  return out.join('; ');
}
const straight = (p) => [p[0] / p[2], p[1] / p[2]];
/** Do two outlines (in Klein's picture, where lines are straight) share ground? */
function overlap(P, Q) {
  const box = (R) => R.reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const a = box(P), b = box(Q);
  if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) return false;
  const turn = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  for (let i = 0; i < P.length; i++) {
    const p1 = P[i], p2 = P[(i + 1) % P.length];
    for (let j = 0; j < Q.length; j++) {
      const q1 = Q[j], q2 = Q[(j + 1) % Q.length];
      if (turn(p1, p2, q1) * turn(p1, p2, q2) < -1e-18 && turn(q1, q2, p1) * turn(q1, q2, p2) < -1e-18) return true;
    }
  }
  const inside = (pt, R) => { let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) if ((R[i][1] > pt[1]) !== (R[j][1] > pt[1]) && pt[0] < ((R[j][0] - R[i][0]) * (pt[1] - R[i][1])) / (R[j][1] - R[i][1]) + R[i][0]) c = !c; return c; };
  return inside(P[0], Q) || inside(Q[0], P);
}
/** How many pairs of commas of a state's pattern share ground, over the tiles round the middle. */
function meetings(c) {
  const ts = tiles(c.D, c.A, { radius: 5.5, max: 1500, ms: 60000 });
  const base = c.shapes.map((sh) => sh.pts.map(straight));
  let meet = 0;
  for (const t of ts) {
    const same = t.M.every((x, i) => Math.abs(x - I3[i]) < 1e-9);
    c.shapes.forEach((sh, j) => {
      const copy = sh.pts.map((q) => straight(apply(t.M, q)));
      base.forEach((mine, i) => { if (same && i >= j) return; if (Math.hypot(copy[0][0] - mine[0][0], copy[0][1] - mine[0][1]) < 1e-9) return; if (overlap(mine, copy)) meet++; });
    });
  }
  return meet;
}

test('five or six cone points: the turns about them multiply to 1, each of its own order, whatever the Lengths and Twists', () => {
  for (const text of MANY) {
    for (const by of [0, 0.5, -0.35]) {
      const st = stateOf(text, by), b = multiBuild(st);
      assert.deepEqual(b.order.slice().sort(), st.orders.map((_, i) => i), `${text}: every turn once`);
      let P = I3.slice();
      for (const f of b.order) P = mul(P, b.gens[f]);
      const scale = Math.max(...b.gens.map((g) => Math.max(...g.map(Math.abs))));
      assert.ok(Math.max(...P.map((x, i) => Math.abs(x - I3[i]))) < 1e-9 * scale * scale, `${text} by ${by}: the relation`);
      b.gens.forEach((g, i) => {
        assert.ok(G.dist(apply(g, b.cones[i]), b.cones[i]) < 1e-7, `${text}: turn ${i} keeps its cone point`);
        // its order: a point near the cone point comes back after `order` turns and not before
        let q = apply(G.translate(G.origin, b.cones[i]), G.polar(0.6, 0.4));
        const start = q;
        for (let k = 1; k <= st.orders[i]; k++) { q = apply(g, q); if (k < st.orders[i]) assert.ok(G.dist(q, start) > 0.1, `${text}: turn ${i} is of order ${st.orders[i]}, not ${k}`); }
        assert.ok(G.dist(q, start) < 1e-6, `${text}: turn ${i} is of order ${st.orders[i]}`);
      });
    }
  }
});

test('at its default numbers the orbifold is the Classification page\'s: its cone points are that polygon\'s corners, every Twist 0', () => {
  for (const text of MANY) {
    const st = stateOf(text), b = multiBuild(st), P = inscribed(st.orders).verts;
    assert.ok(multiAtDefaults(st) && st.tws.every((t) => t === 0));
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) assert.ok(Math.abs(G.dist(b.cones[i], b.cones[j]) - G.dist(P[i], P[j])) < 1e-9, `${text}: cone points ${i} and ${j} as far apart as that polygon's corners`);
    // and the same way round: that page's frame goes onto this one by a motion that keeps the plane's sense
    assert.ok(multiPrint(st.k).off < 1e-9, `${text}: the polygon's corners land on the cone points (${multiPrint(st.k).off})`);
  }
});

test('the tile of any Lengths and Twists is a tile of the signature typed, with the area Gauss–Bonnet gives it', () => {
  for (const text of MANY) {
    const k = normalizeFamilyKey(text), fam = FAMILIES[k], d = fam.defaults, m = d.L.length;
    // at the default numbers the tile folds up on paper to the signature (orbifold.js analyse knows nothing of how it was made)
    const sig = signatureOf(analyse(multiCentred(multiState(k)).D));
    assert.ok(sig.o === 0 && sig.x === 0 && sig.stars.length === 0 && sorted(sig.cones) === sorted(fam.orders), `${text}: reads ${JSON.stringify(sig)}`);
    for (const [fl, ft] of [[1, 0], [0.6, 0.31], [1.35, -0.5], [1.5, 0.5], [0.5, -0.12], [1.2, 0.08]]) {
      for (let active = 0; active < m; active++) {
        const st = multiState(k, { Ls: d.L.map((v, i) => Math.max(0.75, Math.min(5.9, v * (i === active ? fl : 1 + 0.08 * i)))), tws: d.tw.map((_, i) => (i === active ? ft : -0.1 * i)), active, shown: m });
        const c = multiCentred(st);
        assert.equal(tileFaults(c, st.orders), '', `${text} L ${st.Ls.map((x) => x.toFixed(2))} tw ${st.tws.map((x) => x.toFixed(2))} pair ${active}`);
        // its pose lays the picked pair level in the middle, the first of the two on the left
        const pa = apply(c.pose, c.home[2 * active]), pb = apply(c.pose, c.home[2 * active + 1]);
        assert.ok(Math.abs(pa[1]) < 1e-9 && Math.abs(pb[1]) < 1e-9 && Math.abs(pa[0] + pb[0]) < 1e-9 && pa[0] < 0, `${text}: pair ${active} level in the middle`);
        const met = pairMetricsFor(st);
        assert.ok(Math.abs(met.d - G.dist(c.home[2 * active], c.home[2 * active + 1])) < 1e-9 && met.mDist >= -1e-12);
      }
    }
  }
});

test('over the sliders\' whole range a tile is found: 720 random shapes with every Length from 0.7 to 6, each a tile', () => {
  let seed = 20261126;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (const text of ['22222', '222222', '333333', '223344', '234567', '99999', '29292', '777777']) {
    const k = normalizeFamilyKey(text), fam = FAMILIES[k], d = fam.defaults, m = d.L.length;
    assert.deepEqual([fam.baseRange, fam.maxRange], [[0.8, 5.5], [0.7, 6.0]], text);
    for (let q = 0; q < 90; q++) {
      const st = multiState(k, { Ls: d.L.map(() => Math.exp(Math.log(0.7) + rnd() * Math.log(6 / 0.7))), tws: d.tw.map(() => rnd() - 0.5), active: Math.floor(rnd() * m), shown: m });
      let c = null;
      try { c = multiCentred(st); } catch (err) { assert.fail(`${text} L ${st.Ls.map((x) => x.toFixed(3))} tw ${st.tws.map((x) => x.toFixed(3))}: ${err.message}`); }
      assert.equal(tileFaults(c, st.orders), '', `${text} L ${st.Ls.map((x) => x.toFixed(3))} tw ${st.tws.map((x) => x.toFixed(3))}`);
    }
  }
});

test('a whole turn of any pair\'s Twist gives the same pattern back', () => {
  for (const text of ['22222', '333333', '23456']) {
    const k = normalizeFamilyKey(text), d = FAMILIES[k].defaults, m = d.L.length;
    for (let pair = 0; pair < m; pair++) {
      const at = (tw) => multiCentred(multiState(k, { Ls: d.L.map((v) => Math.min(5.9, v * 1.2)), tws: d.tw.map((_, i) => (i === pair ? tw : 0.1)), active: (pair + 1) % m, shown: m }));
      const lo = at(-0.5), hi = at(0.5);
      const ts = tiles(lo.D, lo.A, { radius: 7, max: 2500, ms: 60000 });
      hi.home.forEach((p, f) => {
        if (G.dist(p, G.origin) > 3) return;
        const near = Math.min(...ts.map((t) => G.dist(apply(t.M, lo.home[f]), p)));
        assert.ok(near < 1e-7, `${text} pair ${pair}: cone point ${f} at Twist +0.5 is a copy of itself at -0.5 (${near})`);
      });
    }
  }
});

test('at the default numbers, in the first view, the print is the Classification page\'s print in its first view', () => {
  for (const text of MANY) {
    const st = stateOf(text), c = multiCentred(st), pr = multiPrint(st.k);
    const D0 = domainOf(parse(st.k)), A0 = analyse(D0), theirs = design(D0), T = G.translate(D0.at, G.origin);
    const flat = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
    const marks = [];
    // (far enough for 99999, whose tile reaches 3.5 from its middle and has commas 4 from the middle of the view)
    for (const t of tiles(D0, A0, { radius: 9, max: 9000, ms: 60000 })) { const M = mul(T, t.M); theirs.forEach((sh, j) => sh.pts.forEach((p) => marks.push({ q: flat(apply(M, p)), j }))); }
    assert.equal(c.shapes.length, theirs.length, `${text}: as many commas as that page has`);
    assert.equal(pr.count, theirs.length);
    c.shapes.forEach((sh, k) => {
      // every seventh outline point of a comma lies on one comma of that page's print
      const hits = [];
      for (let q = 0; q < sh.pts.length; q += 7) { const v = flat(apply(c.view, sh.pts[q])); let best = null, bd = 1e-6; for (const mk of marks) { const dd = Math.hypot(mk.q[0] - v[0], mk.q[1] - v[1]); if (dd < bd) { bd = dd; best = mk; } } hits.push(best); }
      assert.ok(hits.every(Boolean) && hits.every((h) => h.j === hits[0].j), `${text} comma ${k}: lies on a comma of that page's print`);
    });
    assert.equal(c.scale, 1, `${text}: at that page's size`);
  }
});

test('at any Twist of any pair every comma is whole and meets no other', () => {
  for (const text of MANY) {
    const k = normalizeFamilyKey(text), d = FAMILIES[k].defaults, m = d.L.length, pr = multiPrint(k);
    assert.ok(pr.joints.every((j) => j.clear), `${text}: a joint for every cut that runs through no comma`);
    assert.ok(pr.tied.every((f) => f !== null), `${text}: every comma is carried`);
    const twists = [];
    for (let pair = 0; pair < m; pair++) for (const tw of [0.01, -0.02, 0.2, -0.5, 0.5]) twists.push(d.tw.map((_, i) => (i === pair ? tw : 0)));
    twists.push(d.tw.map((_, i) => 0.31 - 0.4 * i), d.tw.map(() => 0.5), d.tw.map((_, i) => (i % 2 ? -0.27 : 0.44)));
    for (const tws of twists) {
      const c = multiCentred(multiState(k, { Ls: d.L, tws, active: 0, shown: m }));
      assert.equal(c.shapes.length, pr.count, `${text}: every comma drawn`);
      assert.equal(meetings(c), 0, `${text} at Twists ${tws.map((t) => t.toFixed(2))}: commas share ground`);
    }
  }
  // only 99999 of these has commas larger than their blocks (twelve of them a tile): drawn in a little once a Twist leaves 0
  for (const text of MANY) assert.equal(multiPrint(normalizeFamilyKey(text)).fit < 1, text === '99999', text);
});

test('the pattern model: every shown pair\'s tree and cut, the picked pair\'s corner classes, the classified first view at the defaults only', () => {
  for (const text of ['22222', '222222', '23456']) {
    const k = normalizeFamilyKey(text), fam = FAMILIES[k], m = fam.pairs.length;
    assert.equal(fam.mode, 'multi');
    assert.deepEqual(fam.pairs, m === 3 ? [[0, 1], [2, 3], [4, 5]] : [[0, 1], [2, 3]]);
    assert.equal(surfacePartsFor(k).length, fam.orders.length);
    buildSurface(surfacePartsFor(k));
    const st = multiState(k), model = buildPatternModel(st), c = multiCentred(st);
    assert.ok(model.classified && model.lines.length === 2 && model.marks.length === 2 && model.design().length === multiPrint(k).count);
    assert.deepEqual(model.firstV, c.view, `${text}: opens as the Classification page lies`);
    assert.deepEqual(st.perm, [0, 1]);
    // the marks are the corner classes of the picked pair's two cone points, of the right orders
    model.marks.forEach((cls, q) => assert.equal(model.A.classes[cls].n, fam.orders[q], `${text}: mark ${q}`));
    // any other pair picked, or a number moved: it opens by its pose (the picked pair level in the middle)
    const all = buildPatternModel(multiState(k, { shown: m, active: m - 1 }));
    assert.ok(all.lines.length === 2 * m && !all.classified, `${text}: ${m} pairs shown, the last picked`);
    assert.deepEqual(all.firstV, all.pose);
    const moved = buildPatternModel(multiState(k, { tws: fam.defaults.tw.map(() => 0.1) }));
    assert.ok(!moved.classified && moved.firstV === moved.pose);
    // picking another pair changes nothing but the pose: the tile, the cone points and the commas are where they were
    const one = multiCentred(multiState(k, { shown: m, active: 0 })), other = multiCentred(multiState(k, { shown: m, active: 1 }));
    assert.deepEqual(one.D.verts, other.D.verts);
    assert.deepEqual(one.home, other.home);
    assert.deepEqual(one.shapes, other.shapes);
    // numbers out of range are brought in, missing ones are the defaults
    const odd = multiState(k, { Ls: [99, NaN], tws: [7], active: 9, shown: 0 });
    assert.ok(odd.Ls[0] === fam.maxRange[1] && odd.Ls[1] === fam.defaults.L[1] && odd.tws[0] === 0.5 && odd.active === m - 1 && odd.shown === m);
  }
});

test('every other signature that has a pattern is shown still, and what has none says why', () => {
  const still = { 237: [true, 0, 'H'], '*237': [true, 0, 'H'], 333: [true, 0, 'E'], '*2222': [false, 1, 'E'], '22*': [false, 1, 'E'], '3*3': [true, 0, 'E'], 532: [true, 0, 'S'], '*532': [true, 0, 'S'], '2*5': [true, 0, 'S'],
    o: [false, 2, 'E'], xx: [false, 1, 'E'], oo: [false, 6, 'H'], 2222222: [false, 8, 'H'], '*22222': [false, 2, 'H'], '2*33': [false, 1, 'H'] };
  for (const [text, [rigid, moves, kind]] of Object.entries(still)) {
    const sig = readSignature(text), k = normalizeFamilyKey(text), fam = FAMILIES[k];
    assert.equal(kindOf(sig), 'still', text);
    assert.ok(fam && fam.mode === 'still' && fam.kind === kind && fam.moves === moves && fam.rigid === rigid, `${text}: ${JSON.stringify([fam.kind, fam.moves, fam.rigid])}`);
    assert.equal(movesOf(sig), moves, text);
    const model = buildPatternModel({ k }), got = signatureOf(model.A);
    assert.ok(got.o === sig.o && got.x === sig.x && sorted(got.cones) === sorted(sig.cones) && got.stars.length === sig.stars.length, `${text}: its tile reads ${JSON.stringify(got)}`);
    assert.equal(fam.featLabels.length, fam.parts.length);
    if (fam.parts.reduce((s, p) => s + (p.t === 'o' ? 2 : 1), 0) <= 12) buildSurface(surfacePartsFor(k));
  }
  for (const [text, kind] of [['2222', 'pairs'], ['3333', 'pairs'], ['2345', 'pairs'], ['o27', 'pairs'], ['234*5', 'pairs'], ['22222', 'multi'], ['234567', 'multi']]) assert.equal(kindOf(readSignature(text)), kind, text);
  // no pattern at all: the book's four exceptions
  for (const [text, kind] of [['5', 'cone'], ['23', 'cones'], ['*5', 'corner'], ['*23', 'corners']]) {
    const sig = readSignature(text);
    assert.equal(kindOf(sig), null, text);
    assert.equal(normalizeFamilyKey(text), null, text);
    const w = whyNot(sig);
    assert.ok(w && w.kind === kind && w.tries.length >= 1 && w.tries.every((t) => normalizeFamilyKey(t)), `${text}: ${JSON.stringify(w)}`);
  }
  assert.equal(stillSpec(readSignature('3333')), null);
  assert.equal(whyNot(readSignature('237')), null);
});

test('(2, 2) pairs single-cover their cut geodesic at length L/2 with zero double-covered overlaps across twist', () => {
  const assertDisjointCutCopies = (m, cutLn, expectedLen, label) => {
    assert.ok(Math.abs(G.dist(cutLn.a, cutLn.b) - expectedLen) < 1e-8, `${label}: cut length`);
    const ts = tiles(m.D, m.A, { radius: 4.0, max: 600 });
    const axis = G.frame(cutLn.a, cutLn.b);
    const invAxis = invH(axis);
    const intervals = [];
    for (const t of ts) {
      const ca = apply(t.M, cutLn.a), cb = apply(t.M, cutLn.b);
      if (G.lineDist(ca, cutLn.a, cutLn.b) > 1e-4 || G.lineDist(cb, cutLn.a, cutLn.b) > 1e-4) continue;
      const qa = apply(invAxis, ca), qb = apply(invAxis, cb);
      const u0 = Math.asinh(qa[0]), u1 = Math.asinh(qb[0]);
      const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
      if (intervals.some(([a, b]) => Math.abs(a - lo) < 1e-4 && Math.abs(b - hi) < 1e-4)) continue;
      intervals.push([lo, hi]);
    }
    assert.ok(intervals.length >= 2, `${label}: expected multiple collinear copies`);
    intervals.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < intervals.length; i++) {
      assert.ok(intervals[i][0] >= intervals[i - 1][1] - 1e-4, `${label}: overlapping cut intervals ${JSON.stringify(intervals)}`);
    }
  };

  const k222222 = normalizeFamilyKey('222222');
  for (const tw2 of [-0.25, -0.15, 0, 0.0307, 0.25, 0.4]) {
    const st = {
      k: k222222, mode: 'multi', orders: [2, 2, 2, 2, 2, 2],
      Ls: [2.634, 2.634, 2.634], tws: [0.021, -0.2475, tw2],
      active: 2, shown: 3, L: 2.634, tw: tw2, b: 0, tau: 0,
    };
    const m = buildPatternModel(st);
    for (let pair = 0; pair < 3; pair++) {
      assertDisjointCutCopies(m, m.lines[2 * pair + 1], 2.634 / 2, `222222 tw2=${tw2} pair=${pair}`);
    }
  }

  for (const [famKey, perm, ord, L] of [
    ['2223', [0, 1, 2, 3], [2, 2, 2, 3], 1.5],
    [normalizeFamilyKey('3322'), [2, 3, 0, 1], [2, 2, 3, 3], 1.734],
  ]) {
    const st = { k: famKey, perm, orders: ord, L, tw: 0.17, b: 0, tau: 0 };
    const m = buildPatternModel(st);
    const cutLn = m.lines.find((ln) => ln.dash && !ln.once);
    assertDisjointCutCopies(m, cutLn, L / 2, `${famKey} perm=${perm.join('')}`);
  }
});
