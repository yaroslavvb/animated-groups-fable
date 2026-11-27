// custom.test.js — the text field after the chips: any signature of the engine's shapes, with any orders 2 .. 9.
// (Five or six cone points, and the signatures shown still, are in multi.test.js.)
//
// Nothing here is looked up: a typed signature becomes a family (handles.js normalizeFamilyKey), its tile is built,
// folded up on paper (orbifold.js analyse) and the signature read off again; its area is held to Gauss–Bonnet; and
// every re-cut is held to the page's own promise: no cone point and no comma moves.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GH, FAMILIES, normalizeFamilyKey,
  fourConeCentered, coneFeatCentered, o33Centered, recut,
  followTreeData, stadium, handleBeltLoop, beadOnLoop, sitesForBall,
  surfacePartsFor, featureAnchorsForBall,
  defaultCommas, buildPatternModel, pairMetricsFor,
} from '../src/handles.js';
import { customSpec, specOf, whyNot, shows, featuresOf, featureLabel, prettyOf, readSignature, canonText, cursorTokenIndex } from '../src/custom.js';
import { tilesPSU, locateTilePSU } from '../src/pattern-ext.js';
import { mul, apply, inv, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { signatureOf, tiles, fval } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { parse, textOf, costOf } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';
import { buildSurface } from '../../2026-11-15-classification-of-surfaces/src/sym/surface.js';

const TAU = 2 * Math.PI;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const PAIRS = [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]];

/** A state of the family a signature names, as page.js makes it (its defaults, or the given numbers). */
function stateOf(text, over = {}) {
  const k = normalizeFamilyKey(text);
  assert.ok(k, `${text} is a family`);
  const fam = FAMILIES[k], perm = (over.perm || fam.defaultM.split('').map(Number)).slice();
  return {
    k, perm, orders: perm.map((c) => fam.baseOrders[c]),
    L: over.L ?? fam.defaultL, tw: over.tw ?? fam.defaultTw, b: over.b ?? fam.defaultB ?? 0, tau: over.tau ?? fam.defaultTau ?? 0,
    thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)),
  };
}
const centred = (st) => {
  const fam = FAMILIES[st.k];
  if (fam.mode === 'cones') return fourConeCentered(st.orders, st.L, st.tw, { thetas: st.thetas, perm: st.perm, k: st.k });
  if (fam.mode === 'handle') return o33Centered(st.L, st.tw, st.b, st.tau, { perm: st.perm, thetas: st.thetas, k: st.k });
  return coneFeatCentered(st.k, st.L, st.tw, st.b, st.tau, { perm: st.perm, thetas: st.thetas });
};
/** The signature read off a tile, in the spelling catalog.js gives a typed one (larger numbers first where order is free). */
const readOff = (A) => { const s = signatureOf(A); return textOf({ o: s.o, cones: s.cones.slice().sort((a, b) => b - a), stars: s.stars, x: s.x }); };
const sorted = (text) => { const s = parse(text); return textOf({ o: s.o, cones: s.cones.slice().sort((a, b) => b - a), stars: s.stars, x: s.x }); };

const SWEEP = [
  '2345', '5432', '2229', '9992', '2233', '2323', '3222', '4444', '9999', '2379', '3334', '2226',
  '234*', '222*', '229*', '992*', '357*', '999*',
  '234*5', '222*2', '333*2', '333*9', '259*4', '999*9',
  '234x', '222x', '229x', '357x', '999x',
  'o23', 'o22', 'o29', 'o92', 'o57', 'o99', 'o32',
];

test('a typed signature becomes a family: its shape, its features in the engine\'s own order, its labels', () => {
  const f = (t) => FAMILIES[normalizeFamilyKey(t)];
  assert.equal(normalizeFamilyKey('2345'), '2345');
  assert.deepEqual([f('2345').mode, f('2345').baseOrders, f('2345').featLabels], ['cones', [2, 3, 4, 5], ['2', '3', '4', '5']]);
  assert.deepEqual([f('234*').mode, f('234*').baseOrders, f('234*').featLabels, f('234*').featIdx], ['cone-star', [2, 0, 3, 4], ['2', '∗', '3', '4'], 1]);
  assert.deepEqual([f('234∗5').mode, f('234*5').corner, f('234*5').featLabels, f('234*5').k], ['cone-star3', 5, ['2', '∗5', '3', '4'], '234*5']);
  assert.deepEqual([f('234×').mode, f('234x').baseOrders, f('234x').featLabels], ['cone-x', [2, 0, 3, 4], ['2', '×', '3', '4']]);
  assert.deepEqual([f('o23').mode, f('o23').baseOrders, f('o23').featLabels], ['handle', [0, 0, 2, 3], ['o⁺', 'o⁻', '2', '3']]);
  assert.equal(f('234*5').label, '234∗5');
  // the seven of the page are themselves, untouched; a custom family takes the numbers of the one of its shape
  for (const k of ['3333', '2223', '333*', '333*3', '333x', 'o33', '2222']) { assert.equal(normalizeFamilyKey(k), k); assert.ok(!FAMILIES[k].custom); }
  assert.equal(f('234*').bRange, FAMILIES['333*'].bRange);
  assert.equal(f('234x').bMult, 2);
  assert.equal(f('o23').tauLabel, 'Handle shift');
  assert.equal(f('2345').custom, true);
  // what is no signature, or a signature no pattern has, is no family
  for (const t of ['', '1', 'abc', '2341', '2y45', '2-3-4-5', '5', '23', '*5', '*23'])
    assert.equal(normalizeFamilyKey(t), null, `"${t}" is no family`);
  // what the four-feature engine does not build is a family all the same, shown another way (multi.test.js):
  // five or six cone points with a cut for every pair, anything else as classified, its pair controls off
  for (const t of ['22222', '234567']) assert.equal(FAMILIES[normalizeFamilyKey(t)].mode, 'multi', t);
  for (const t of ['237', '22**', '22*x', '2xx', 'oo', 'o2*', '234*56', '*2345', 'o2', 'o234', 'o22x', '2222222'])
    assert.equal(FAMILIES[normalizeFamilyKey(t)].mode, 'still', t);
  for (const t of ['237', '22222', 'oo', '234*56']) assert.equal(customSpec(t), null, t);          // none of them is one of the engine's four-feature shapes
  assert.equal(customSpec('2222'), null);          // flat: the page's own family, not a custom one
  assert.ok(shows(parse('2222')) && shows(parse('2345')) && shows(parse('237')) && shows(parse('22222')) && !shows(parse('23')) && !shows(parse('')));
});

test('a signature is read as people type it', () => {
  const r = (t) => { const s = readSignature(t); return s ? textOf(s) : null; };
  // spaces and commas anywhere; the star and the cross as typed or as printed; capitals; a zero for the ring
  for (const [typed, want] of [['2345', '2345'], [' 2 3 4 5 ', '2345'], ['2,3,4,5', '2345'], ['234*5', '234*5'], ['234∗5', '234*5'], ['2 3 4 ∗ 5', '234*5'],
    ['234x', '234x'], ['234×', '234x'], ['234X', '234x'], ['o23', 'o23'], ['O23', 'o23'], ['○23', 'o23'], ['023', 'o23'], ['', '']]) assert.equal(r(typed), want, `"${typed}"`);
  // rings and crosses wherever they were put: their place in a signature says nothing
  for (const [typed, want] of [['x234', '234x'], ['2x34', '234x'], ['23o', 'o23'], ['2o3', 'o23'], ['23*5x', '23*5x'], ['x23*5', '23*5x']]) assert.equal(r(typed), want, `"${typed}"`);
  // a digit keeps its side of the star: before it a cone point, after it a corner
  assert.equal(r('5*234'), '5*234');
  assert.deepEqual(readSignature('5*234'), { o: 0, cones: [5], stars: [[2, 3, 4]], x: 0 });
  // a ring beside a cross is two crosses more, as catalog.js reads it
  assert.equal(r('o2x'), '2xxx');
  // what is no signature
  for (const t of ['1', '10', 'abc', '2y45', '23-45', '2345!', '(2345)', '2345/', '∞']) assert.equal(readSignature(t), null, `"${t}"`);
  // and the families take the same spellings
  assert.equal(normalizeFamilyKey('2 3 4 5'), '2345');
  assert.equal(normalizeFamilyKey('x 2 3 4'), '234x');
  assert.equal(normalizeFamilyKey('2,3,4,∗5'), '234*5');
  assert.equal(normalizeFamilyKey('27O'), 'o27');
  assert.equal(normalizeFamilyKey('3 3 3 ∗ 3'), '333*3');
  assert.ok(!FAMILIES['333*3'].custom);
  assert.equal(normalizeFamilyKey('2 2 2 2'), '2222');          // the page's own flat family, not a custom one
  assert.ok(!FAMILIES['2222'].custom);
  assert.equal(customSpec('2 3 4 x').k, '234x');
  assert.deepEqual([canonText('x 2 3 4'), canonText('2 2 2 2'), canonText('2y'), canonText('')], ['234x', '2222', null, '']);
});

test('what cannot be shown says why, and offers signatures that can', () => {
  const w = (t) => whyNot(parse(t));
  // every signature that has a pattern is shown: nothing to say
  for (const t of ['2345', '2222', '237', '22', 'o', '23*', '2*3', '*632', '23456', '2345*', '234*56', '22**', '22*x', 'oo', 'xxxx', '*', 'x', '**', '*x', 'xx', '2*22', '*2222', '22222', '234*567', 'ooo', '***', 'o2*3', '2345x', '99*99'])
    assert.equal(w(t), null, t);
  // nothing typed
  assert.deepEqual([w('').kind, w('').tries], ['empty', ['2345', '22233', '237', '*2222']]);
  // the four shapes no pattern folds up to: one cone point alone, two of different orders, and the same with corners
  assert.deepEqual([w('5').kind, w('5').m, w('5').tries], ['cone', 5, ['55', '5*', '5x']]);
  assert.deepEqual([w('23').kind, w('23').m, w('23').n, w('23').tries], ['cones', 2, 3, ['22', '33', '322']]);
  assert.deepEqual([w('*5').kind, w('*5').m, w('*5').tries], ['corner', 5, ['5*', '*55']]);
  assert.deepEqual([w('*23').kind, w('*23').m, w('*23').n, w('*23').tries], ['corners', 2, 3, ['2*3', '3*2', '32*', '*22']]);
  // every offer is one the page shows
  for (const t of ['', '2', '9', '29', '*2', '*29', '5', '23', '*5', '*23'])
    for (const tr of w(t).tries) assert.ok(normalizeFamilyKey(tr), `${t} -> ${tr}`);
  assert.deepEqual(featuresOf(parse('o23*5x')).map(featureLabel), ['2', '3', '∗5', '×', '×', '×']);      // a ring beside a cross is two crosses more
  assert.deepEqual(featuresOf(parse('o23')).map(featureLabel), ['o⁺', 'o⁻', '2', '3']);
  assert.equal(prettyOf(parse('234*5')), '234∗5');
});

test('every custom tile folds up to the signature typed, with the area Gauss–Bonnet gives it', () => {
  for (const text of SWEEP) {
    const k = normalizeFamilyKey(text), fam = FAMILIES[k];
    const want = sorted(text), area = TAU * (fval(costOf(parse(text))) - 2);
    const perms = fam.mode === 'handle' ? [[0, 2, 1, 3], [0, 3, 1, 2], [0, 1, 2, 3], [2, 3, 0, 1]] : [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2], [2, 3, 0, 1], [1, 2, 0, 3], [1, 3, 0, 2]];
    for (const perm of perms) {
      for (const L of [0.45, 1.3, 2.0, 4.2, 7.0]) {
        for (const tw of [-0.5, -0.21, 0, 0.33, 0.5]) {
          const over = { perm, L, tw };
          for (const [b, tau] of fam.bRange ? [[fam.bRange[0], -0.37], [fam.defaultB, 0.25], [fam.bRange[1], 0.5]] : [[0, 0]]) {
            const st = stateOf(text, { ...over, b, tau });
            const { D, A } = centred(st);
            assert.equal(readOff(A), want, `${text} m=${perm.join('')} L=${L} tw=${tw} b=${b} tau=${tau}`);
            assert.ok(near(Math.abs(GH.area(D.verts)), area, 1e-6), `${text} m=${perm.join('')} L=${L} tw=${tw} b=${b}: area ${Math.abs(GH.area(D.verts))} vs ${area}`);
          }
        }
      }
    }
  }
});

test('all 6 picks and a 6-step chain keep every cone point and every comma of a custom orbifold in place', () => {
  const cases = [
    ['2345', {}], ['5432', { L: 0.8, tw: -0.32 }], ['2229', { L: 3.1, tw: 0.45 }], ['2233', {}], ['2323', { L: 1.4, tw: -0.2 }], ['3222', {}], ['9999', { L: 2.6, tw: 0.1 }], ['2379', { L: 1.1, tw: 0.4 }],
    ['234*', {}], ['222*', { L: 1.2, tw: -0.3, b: 0.9 }], ['957*', { L: 2.9, tw: 0.35, b: 2.2 }], ['229*', {}],
    ['234*5', {}], ['222*2', { tau: -0.4 }], ['259*4', { L: 1.3, tw: -0.25, b: 0.8, tau: 0.1 }], ['333*9', {}],
    ['234x', {}], ['222x', { L: 1.2, tw: 0.3, b: 0.4 }], ['957x', { L: 2.9, tw: -0.35, b: 1.1 }],
    ['o23', {}], ['o23', { perm: [0, 1, 2, 3], L: 2.5, tw: -0.18, b: 1.1, tau: -0.3 }], ['o22', {}], ['o29', { L: 1.4, tw: 0.3, b: 0.7, tau: 0.45 }], ['o92', { perm: [1, 2, 0, 3] }], ['o57', { perm: [2, 3, 0, 1], L: 3.3, tw: 0.2 }],
  ];
  for (const [text, over] of cases) {
    const st0 = stateOf(text, over), fam = FAMILIES[st0.k];
    const b0 = centred(st0);
    const ts0 = tiles(b0.D, b0.A, { radius: 11, max: 7000, ms: 4000 });
    const isPoint = (f) => fam.baseOrders[f] > 1;
    const orbFeat0 = [0, 1, 2, 3].map((f) => ts0.map((t) => apply(t.M, b0.home[st0.perm.indexOf(f)])));
    const orbCommas0 = b0.shapes.map((sh) => ts0.map((t) => sh.pts.map((p) => apply(t.M, p))));
    const line0 = b0.extraLines && b0.extraLines[0] ? ts0.map((t) => [apply(t.M, b0.extraLines[0].a), apply(t.M, b0.extraLines[0].b)]) : null;
    assert.ok(b0.shapes.length >= 2, `${text}: commas to watch`);

    for (const [i, j] of PAIRS) {
      const st1 = recut(st0, i, j), tag = `${text} ${JSON.stringify(over)} pick (${i},${j})`;
      assert.equal(st1.k, st0.k, tag);
      assert.deepEqual(st1.orders, st1.perm.map((c) => fam.baseOrders[c]), tag);
      assert.ok(st1.L > 0 && st1.tw >= -0.5 - 1e-12 && st1.tw <= 0.5 + 1e-12, `${tag}: L'=${st1.L} tw'=${st1.tw}`);
      const b1 = centred(st1);
      assert.equal(readOff(b1.A), sorted(text), tag);
      for (let slot = 0; slot < 4; slot++) {
        const f = st1.perm[slot], pOld = apply(st1.invQ, b1.home[slot]);
        if (isPoint(f)) {
          const dMin = Math.min(...orbFeat0[f].map((q) => GH.dist(pOld, q)));
          assert.ok(dMin < 1e-9, `${tag} feature ${f} moved ${dMin}`);
        } else if (line0 && b1.extraLines && b1.extraLines[0]) {
          const lMin = Math.min(...line0.map(([u, v]) => GH.lineDist(apply(st1.invQ, b1.extraLines[0].a), u, v)));
          assert.ok(lMin < 1e-9, `${tag} handle line moved ${lMin}`);
        }
      }
      b1.shapes.forEach((sh1, si) => {
        const ptsOld = sh1.pts.map((p) => apply(st1.invQ, p));
        const best = Math.min(...orbCommas0[si].map((oc) => Math.max(...ptsOld.map((p, pi) => GH.dist(p, oc[pi])))));
        assert.ok(best < 1e-9, `${tag} comma ${si} moved ${best}`);
      });
      // picking the first pair again cuts between the same two pairs. Its length need not be the one left behind:
      // a re-cut takes the shortest tree it finds for the pair (3333 itself comes back shorter from L = 4.1)
      const back = recut(st1, st0.perm[0], st0.perm[1]);
      assert.deepEqual(back.perm.slice(0, 2).sort(), st0.perm.slice(0, 2).sort(), tag);
      assert.ok(back.L > 0 && back.L <= st0.L + 1e-9, `${tag} round trip L ${back.L} vs ${st0.L}`);
    }

    let cur = st0, Qacc = I3.slice();
    for (const [ci, cj] of PAIRS) { cur = recut(cur, ci, cj); Qacc = GH.fix(mul(cur.Q, Qacc), 1); }
    const invQacc = GH.fix(inv(Qacc), 1), bChain = centred(cur);
    bChain.shapes.forEach((shC, si) => {
      const ptsOld = shC.pts.map((p) => apply(invQacc, p));
      const best = Math.min(...orbCommas0[si].map((oc) => Math.max(...ptsOld.map((p, pi) => GH.dist(p, oc[pi])))));
      // six motions multiplied as 3 x 3 matrices: each step holds to 1e-9 above, the product of six to 1e-7
      assert.ok(best < 1e-7, `${text} ${JSON.stringify(over)} 6-step chain comma ${si} moved ${best}`);
    });
  }
});

test('the twist and the shifts of a custom orbifold have period 1; equal far orders swap at half a turn', () => {
  const sameCommas = (a, b, tag) => {
    const ts = tiles(a.D, a.A, { radius: 8, max: 2500, ms: 2500 });
    b.shapes.forEach((sh, si) => {
      const all = ts.map((t) => a.shapes[si].pts.map((p) => apply(t.M, p)));
      const best = Math.min(...all.map((pts) => Math.max(...pts.map((p, q) => GH.dist(p, sh.pts[q])))));
      assert.ok(best < 1e-9, `${tag} comma ${si}: ${best}`);
    });
  };
  for (const text of ['2345', '2229', '234*', '234*5', '234x', 'o23', 'o92']) {
    const fam = FAMILIES[normalizeFamilyKey(text)];
    sameCommas(centred(stateOf(text, { tw: -0.5 })), centred(stateOf(text, { tw: 0.5 })), `${text} tw -0.5 / +0.5`);
    if (fam.tauLabel) sameCommas(centred(stateOf(text, { tau: -0.5 })), centred(stateOf(text, { tau: 0.5 })), `${text} tau -0.5 / +0.5`);
  }
});

test('the 3D ball, the walk and the pattern model of a custom orbifold', () => {
  for (const text of SWEEP) {
    const st = stateOf(text), k = st.k, fam = FAMILIES[k];
    const parts = surfacePartsFor(k);
    assert.equal(parts.length, fam.mode === 'handle' ? 3 : 4, text);
    const built = buildSurface(parts);
    built.scene.finish();
    const feats = featureAnchorsForBall(built, k);
    assert.deepEqual(feats.map((f) => f.label), fam.featLabels, text);
    for (const pair of PAIRS) {
      const { siteOf, loopSites, complement } = sitesForBall(built, pair, k);
      assert.deepEqual(loopSites, [siteOf[pair[0]], siteOf[pair[1]]], `${text} ${pair}: loopSites must match picked pair`);
      assert.equal(complement, false, `${text} ${pair}: complement must be false`);
      const ns = [0, 1, 2, 3].map((f) => built.layout.sites[siteOf[f]].site.n);
      const ang = (a, b) => {
        const la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1;
        return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb))));
      };
      const loop = stadium(ns[pair[0]], ns[pair[1]], 1.014);
      const pickedSet = new Set(pair);
      for (let f = 0; f < 4; f++) {
        const minAng = Math.min(...loop.pts.map((p) => ang(p, ns[f])));
        assert.ok(minAng >= (pickedSet.has(f) ? 0.35 : 0.38), `${text} ${pair} feat ${f} clearance ${minAng}`);
      }
      const b0 = beadOnLoop(loop, 0), b1 = beadOnLoop(loop, 1);
      assert.ok(Math.hypot(b0[0] - b1[0], b0[1] - b1[1], b0[2] - b1[2]) < 1e-9);
    }
    if (fam.mode === 'handle') { const belt = handleBeltLoop(built); assert.ok(belt.total > 0); }
    for (const [i, j] of PAIRS) {
      const s = { ...st, ...recut(st, i, j) };
      const fd = followTreeData(s);
      assert.ok(fd.fwdSegs.length >= 2 && fd.backSegs.length >= 2 && fd.legs.length === 4, `${text} (${i},${j}) walk`);
      const pm = buildPatternModel(s, { follow: { active: true, data: fd, progress: 1 } });
      assert.equal(pm.outline, false);
      const { d, mDist } = pairMetricsFor(s);
      assert.ok(Number.isFinite(d) && d > 0 && Number.isFinite(mDist) && mDist >= 0, `${text} (${i},${j}): d=${d} m=${mDist}`);
      for (const ln of pm.lines) for (const p of [ln.a, ln.b]) assert.ok(p.every(Number.isFinite), `${text} (${i},${j}): a line's end`);
    }
  }
});

test('a custom pattern tiles the disc from any focus the view can reach', () => {
  for (const text of ['2345', '9999', '2229', '957*', '259*4', '957x', 'o29', 'o57']) {
    for (const over of [{}, { L: 0.5, tw: 0.4 }, { L: 6.5, tw: -0.45 }]) {
      const st = stateOf(text, over), { D, A } = centred(st);
      for (const ang of [0, 1.1, 2.3, 3.9, 5.2]) {
        for (const r of [0.2, 0.9, 0.995]) {
          const focus = [r * Math.cos(ang), r * Math.sin(ang)];
          const loc = locateTilePSU(D, A, focus);
          assert.ok(loc && loc.g && loc.g.every(Number.isFinite), `${text} ${JSON.stringify(over)} focus ${focus}`);
          const ts = tilesPSU(D, A, { focus, radius: 3.2, max: 1500 });
          assert.ok(ts.length >= 1, `${text} ${JSON.stringify(over)} focus ${focus}: ${ts.length} tiles`);
        }
      }
    }
  }
});

test('cursorTokenIndex maps cursor position in custom input across canonical, loose, selection, and trade forms', () => {
  // Standard 234*5 at every caret position 0..5
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((p) => cursorTokenIndex('234*5', p, p)), [0, 0, 1, 2, 3, 4]);
  assert.equal(cursorTokenIndex('234*5'), 4);

  // Loose notation: spaces, commas, unicode symbols, and reordered rings/crosses
  assert.equal(cursorTokenIndex('2 3 4 ∗ 5', 1, 1), 0); // '2| 3...' -> '2'
  assert.equal(cursorTokenIndex('2 3 4 ∗ 5', 2, 2), 1); // '2 |3...' -> '3'
  assert.equal(cursorTokenIndex('2 3 4 ∗ 5', 7, 7), 3); // '2 3 4 ∗| 5' -> '∗'
  assert.equal(cursorTokenIndex('2 3 4 ∗ 5', 9, 9), 4); // '2 3 4 ∗ 5|' -> '5'
  assert.deepEqual([1, 3, 5, 7].map((p) => cursorTokenIndex('x 2 3 4', p, p)), [3, 0, 1, 2]);
  assert.deepEqual([1, 2, 3].map((p) => cursorTokenIndex('27o', p, p)), [1, 2, 0]);
  assert.equal(cursorTokenIndex('2,3,4,×', 7, 7), 3);

  // Selections: single token -> index; multiple tokens / Select All -> null; separator-only -> fallback
  assert.equal(cursorTokenIndex('234*5', 1, 2), 1);
  assert.equal(cursorTokenIndex('2 34', 1, 3), 1); // spans ' 3', only one token inside
  assert.equal(cursorTokenIndex('234*5', 0, 5), null);
  assert.equal(cursorTokenIndex('234*5', 0, 2), null);
  assert.equal(cursorTokenIndex('2 34', 1, 2), 0); // whitespace only, falls back to char before selection

  // Invalid or empty signatures -> null
  for (const bad of ['', '   ', '1', '2y4', '(2345)']) {
    assert.equal(cursorTokenIndex(bad, 1, 1), null, `"${bad}"`);
  }

  // Handle + crosscap trade rule (ox -> xxx, o23x -> 23xxx)
  assert.equal(cursorTokenIndex('ox', 1, 1), 0);
  assert.equal(cursorTokenIndex('ox', 2, 2), 2);
  assert.equal(cursorTokenIndex('o23x', 1, 1), 2);
  assert.equal(cursorTokenIndex('o23x', 2, 2), 0);
  assert.equal(cursorTokenIndex('o23x', 4, 4), 4);
});
