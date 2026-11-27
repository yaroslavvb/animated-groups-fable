// corner-fade.test.js — a mirror with a corner (333∗3, 234∗2, …): the tree does not jump at Corner shift 0.
//
// His question, Thu 26 Nov 2026, on 234∗2 at Length 3.221, Twist 0.0614, Mirror len 2.512, Corner shift -0.0008:
// "If I modify the corner shift here, the tree, the 'follow the tree line,' jumps rapidly. Is that necessary here?
// Can you explain why it jumps and if there is a way to avoid that?" And of the three ways offered: "make it a
// cross-fade".
//
// Why it jumped: the tree is the shortest arc from the cone point to the mirror. At Corner shift 0 the cone point
// stands on the bisector of the mirror's corner, both walls are equally near, and the nearest point of the mirror
// passes from one wall to the other without crossing what lies between. What is held here: the second arc is the
// arc square on the other wall; at 0 the two are mirror images, each drawn half; what the pattern pane is given
// (every stroke and dot with its strength) changes by little when Corner shift changes by little, across 0 too;
// and away from 0 one tree is drawn, as ever.

import test from 'node:test';
import assert from 'node:assert/strict';

import { GH, FAMILIES, normalizeFamilyKey, coneFeatCentered, buildPatternModel, followTreeData, cornerFade, CORNER_FADE, defaultCommas, invH } from '../src/handles.js';
import { apply } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';

const G = GH;
/** The mirror picked with a cone point, either way round, and the mirror in the far pair. */
const PERMS = [[0, 1, 2, 3], [1, 0, 2, 3], [0, 2, 1, 3], [2, 3, 1, 0]];
const CASES = [
  ['234*2', { L: 3.221, tw: 0.0614, b: 2.512 }],          // his numbers
  ['333*3', { L: 0.577, tw: 0.15, b: 1.4 }],
  ['333*3', { L: 2.0, tw: -0.3, b: 2.2 }],
  ['259*4', { L: 1.3, tw: -0.25, b: 0.8 }],
  ['234*5', { L: 2.4, tw: 0.4, b: 1.7 }],
];
const stateOf = (text, over, perm, tau) => {
  const k = normalizeFamilyKey(text);
  return { k, perm, orders: perm.map((c) => FAMILIES[k].baseOrders[c]), L: over.L, tw: over.tw, b: over.b, tau, thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)) };
};
const centred = (st) => coneFeatCentered(st.k, st.L, st.tw, st.b, st.tau, { perm: st.perm, thetas: st.thetas });

test('the weights: half and half at Corner shift 0, the second arc gone a little way off, the same either side', () => {
  assert.deepEqual(cornerFade(0), { main: 0.5, alt: 0.5 });
  for (const t of [-0.5, -0.2, -CORNER_FADE, CORNER_FADE, 0.3, 0.5]) assert.deepEqual(cornerFade(t), { main: 1, alt: 0 }, String(t));
  let last = 0.5;
  for (let i = 1; i <= 60; i++) {
    const t = (CORNER_FADE * i) / 60, f = cornerFade(t), g = cornerFade(-t);
    assert.ok(Math.abs(f.main + f.alt - 1) < 1e-15 && f.main >= last && f.main - last < 0.03, `Corner shift ${t}: ${f.main} after ${last}`);
    assert.deepEqual(f, g);
    last = f.main;
  }
  assert.ok(CORNER_FADE > 0.02 && CORNER_FADE < 0.1);
});

test('the second arc runs from the same cone point square onto another wall of the mirror, and is the longer of the two', () => {
  for (const [text, over] of CASES) {
    for (const perm of PERMS) {
      for (const tau of [-0.5, -0.31, -0.04, -0.001, 0.0007, 0.02, 0.2, 0.5]) {
        const st = stateOf(text, over, perm, tau), c = centred(st), cut = c.cut, tag = `${text} ${perm.join('')} Corner shift ${tau}`;
        assert.ok(c.treeFade && cut.footAlt, tag);
        // square on its wall: the foot is the nearest point of that wall's line to the cone point, between the wall's two corners
        const wallL = cut.footCornerAlt, wallR = apply(cut.TF, wallL), F = G.frame(wallL, wallR), q = apply(invH(F), cut.A_R);
        const u = Math.atanh(q[0] / q[2]);
        assert.ok(u > 0 && u < G.dist(wallL, wallR), `${tag}: the foot lies between the corners`);
        assert.ok(G.dist(apply(F, [Math.sinh(u), 0, Math.cosh(u)]), cut.footAlt) < 1e-9, `${tag}: the second arc is square on its wall`);
        assert.ok(G.dist(wallL, cut.footCorner) > 1e-6, `${tag}: another wall than the shortest arc's`);
        assert.ok(cut.featDistAlt >= cut.featDist - 1e-12 && Math.abs(c.treeFade.length - cut.featDistAlt) < 1e-12, `${tag}: the longer of the two`);
        // in the pattern's frame: from the cone point of the pair the mirror is in
        const coneSlot = c.mp.featPicked ? (perm[0] === 1 ? 1 : 0) : (perm[2] === 1 ? 3 : 2);
        assert.ok(G.dist(c.treeFade.seg[0], c.home[coneSlot]) < 1e-9, `${tag}: it starts at the cone point`);
        assert.ok(Math.abs(G.dist(c.treeFade.seg[0], c.treeFade.seg[1]) - cut.featDistAlt) < 1e-9);
        assert.equal(c.treeFade.far, !c.mp.featPicked);
      }
    }
  }
});

test('at Corner shift 0 the two arcs are mirror images in the line through the cone point and the corner, and equally long', () => {
  for (const [text, over] of CASES) {
    for (const perm of PERMS) {
      const c = centred(stateOf(text, over, perm, 0)), cut = c.cut, tag = `${text} ${perm.join('')}`;
      assert.ok(Math.abs(cut.featDist - cut.featDistAlt) < 1e-9, `${tag}: ${cut.featDist} and ${cut.featDistAlt}`);
      // the corner the two walls share: as far from one foot as from the other
      const shared = [cut.crL, cut.crR, apply(cut.TF, cut.crR), apply(invH(cut.TF), cut.crL)].reduce((best, p) => (G.dist(p, cut.A_R) < G.dist(best, cut.A_R) ? p : best));
      assert.ok(Math.abs(G.dist(shared, cut.footFeat) - G.dist(shared, cut.footAlt)) < 1e-9, `${tag}: the feet are as far from the corner`);
      assert.ok(G.dist(cut.footFeat, cut.footAlt) > 0.2, `${tag}: and apart`);
      assert.deepEqual([c.treeFade.main, c.treeFade.alt], [0.5, 0.5]);
    }
  }
  // his orbifold, his numbers: both walls 1.92 from the cone point, the corner 2.26; the tree used to turn by 23 degrees
  const c = centred(stateOf('234*2', CASES[0][1], [0, 1, 2, 3], 0)), cone = c.home[0];
  const dir = (p) => { const v = apply(G.translate(cone, G.origin), p); return Math.atan2(v[1], v[0]); };
  assert.ok(Math.abs(c.d - 1.9209) < 1e-4 && Math.abs(G.dist(c.cut.A_R, c.cut.crR) - 2.2568) < 1e-4);
  assert.ok(Math.abs(Math.abs(dir(c.home[1]) - dir(c.treeFade.seg[1])) * (180 / Math.PI) - 23.4) < 0.05);
});

/** How far two lists of what the pane draws are apart: every stroke (or dot) of one has one of the other at nearly the same place with nearly the same strength. */
function apart(listA, listB, key) {
  let worst = 0;
  const strength = (x) => (x.alpha === undefined ? 1 : x.alpha);
  for (const [xs, ys] of [[listA, listB], [listB, listA]]) {
    for (const x of xs) {
      if (strength(x) < 1e-3) continue;          // too faint to see: it need not have a partner
      let best = Infinity;
      for (const y of ys) {
        if (key(x) !== key(y)) continue;
        // (a stroke is the same stroke drawn from either end)
        const gap = x.p ? G.dist(x.p, y.p) : Math.min(Math.max(G.dist(x.a, y.a), G.dist(x.b, y.b)), Math.max(G.dist(x.a, y.b), G.dist(x.b, y.a)));
        best = Math.min(best, Math.max(gap, Math.abs(strength(x) - strength(y))));
      }
      worst = Math.max(worst, best);
    }
  }
  return worst;
}
const lineKey = (l) => `${l.width}|${l.color.join(',')}|${l.once ? 1 : 0}|${(l.dash || []).join(',')}`;
const dotKey = (d) => `${d.r}|${d.color.join(',')}|${d.after ? 1 : 0}`;

test('across Corner shift 0 nothing the pattern pane is given jumps: tree, foot and the Follow the tree walk', () => {
  const eps = 2e-5;
  for (const [text, over] of CASES) {
    for (const perm of PERMS) {
      for (const progress of [null, 0.2, 0.6, 1]) {
        const model = (tau) => { const st = stateOf(text, over, perm, tau); return buildPatternModel(st, progress === null ? {} : { follow: { active: true, data: followTreeData(st), progress } }); };
        const tag = `${text} ${perm.join('')}${progress === null ? '' : ' following ' + progress}`;
        for (const at of [0, 0.011, -0.03, CORNER_FADE, -CORNER_FADE]) {
          const lo = model(at - eps), hi = model(at + eps);
          const gapL = apart(lo.lines, hi.lines, lineKey), gapD = apart(lo.dots, hi.dots, dotKey);
          assert.ok(gapL < 2e-3, `${tag}: strokes ${gapL} apart either side of Corner shift ${at}`);
          assert.ok(gapD < 2e-3, `${tag}: dots ${gapD} apart either side of Corner shift ${at}`);
        }
      }
    }
  }
});

test('near 0 two trees share the one tree\'s strength; away from it there is one tree, drawn as ever', () => {
  for (const [text, over] of CASES) {
    for (const perm of PERMS) {
      const far = !(perm[0] === 1 || perm[1] === 1), full = far ? 0.5 : 0.9, width = far ? 1.9 : 2.3;
      const trees = (m) => m.lines.filter((l) => l.width === width && !l.dash && !l.once);
      for (const tau of [-0.5, -0.2, -CORNER_FADE, CORNER_FADE, 0.1, 0.37, 0.5]) {
        const st = stateOf(text, over, perm, tau), m = buildPatternModel(st), tag = `${text} ${perm.join('')} Corner shift ${tau}`;
        assert.equal(trees(m).length, 1, `${tag}: one tree`);
        assert.equal(trees(m)[0].alpha, full, tag);
        assert.ok(m.dots.every((d) => d.alpha === undefined), `${tag}: its foot at full strength`);
        assert.equal(m.dots.length, far ? 0 : 1, tag);
        // the walk is the one walk, untouched
        const fd = followTreeData(st), mf = buildPatternModel(st, { follow: { active: true, data: fd, progress: 1 } });
        assert.ok(mf.lines.every((l) => !l.once || [0.95, 0.75, 0.9, 1].includes(l.alpha)), `${tag}: the walk at full strength`);
      }
      for (const tau of [-0.04, -0.0008, 0, 0.002, 0.03]) {
        const st = stateOf(text, over, perm, tau), m = buildPatternModel(st), f = cornerFade(tau), tag = `${text} ${perm.join('')} Corner shift ${tau}`;
        const ts = trees(m);
        assert.equal(ts.length, 2, `${tag}: two trees`);
        assert.ok(Math.abs(ts[0].alpha + ts[1].alpha - full) < 1e-12, `${tag}: together as strong as one`);
        assert.ok(Math.abs(Math.max(ts[0].alpha, ts[1].alpha) - full * f.main) < 1e-12, tag);
        // the stronger one is the shortest arc
        const strong = ts[0].alpha >= ts[1].alpha ? ts[0] : ts[1], weak = strong === ts[0] ? ts[1] : ts[0];
        assert.ok(G.dist(strong.a, strong.b) <= G.dist(weak.a, weak.b) + 1e-9, `${tag}: the shortest is the stronger`);
        if (!far) {
          assert.equal(m.dots.length, 2, `${tag}: a foot for each`);
          assert.ok(Math.abs(m.dots[0].alpha + m.dots[1].alpha - 1) < 1e-12 && Math.abs(m.dots[0].alpha - f.main) < 1e-12, tag);
        }
      }
    }
  }
  // a mirror without a corner, a crosscap, a handle, four cone points: no second arc, nothing changed
  for (const [text, st] of [['333*', { L: 1.5, tw: 0.1, b: 1.2, tau: 0 }], ['333x', { L: 1.5, tw: 0.1, b: 0.6, tau: 0 }]]) {
    const k = normalizeFamilyKey(text), c = coneFeatCentered(k, st.L, st.tw, st.b, st.tau, { perm: [0, 1, 2, 3], thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)) });
    assert.equal(c.treeFade, null, text);
  }
});
