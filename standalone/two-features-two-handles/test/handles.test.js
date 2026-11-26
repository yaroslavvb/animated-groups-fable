import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GH, GE, FAMILIES, normalizeFamilyKey,
  invH, psuI, psuMul, psuInv, psuApplyDisc, psuToSO21, so21ToPSU, discDist, psuRotate, psuBoostX, psuAxisOfTrans,
  hgt, d0, pairDistance, pairLength, treeToCut,
  fourConeUHP, uhpToDisc, uhpToHyp, discToHyp, pairFrameUHP,
  fourConeCentered, coneFeatCentered, o33Centered, recut, recutH, pillowCentered, recut2222,
  followTreeData, interpolateView, stadium, handleBeltLoop, beadOnLoop, sitesForBall,
  surfacePartsFor, featureAnchorsForBall,
  defaultCommas, buildPatternModel, pairMetricsFor,
} from '../src/handles.js';
import { locateTilePSU, tilesPSU, poincareArc, createPattern } from '../src/pattern-ext.js';
import { mul, apply, inv, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { signatureOf, tiles, analyse } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { parse, domainOf } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';
import { buildSurface } from '../../2026-11-15-classification-of-surfaces/src/sym/surface.js';

const TAU = 2 * Math.PI;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const cDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ang3 = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot3(unit3(a), unit3(b)))));

function sphericalWinding(pts, q) {
  const uq = unit3(q);
  const ref = Math.abs(uq[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const ex = unit3(cross3(ref, uq)), ey = cross3(uq, ex);
  const proj = (p) => { const up = unit3(p), d = 1 + dot3(up, uq); return [dot3(up, ex) / d, dot3(up, ey) / d]; };
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = proj(pts[i]), b = proj(pts[(i + 1) % pts.length]);
    sum += Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
  }
  const w = Math.round(sum / TAU);
  return w || 0;
}

function assertBallLoopForPair(built, pair, k = '3333') {
  const { siteOf, loopSites, complement } = sitesForBall(built, pair, k);
  assert.deepEqual(loopSites, [siteOf[pair[0]], siteOf[pair[1]]], `${k} ${pair} loopSites must match picked pair`);
  assert.equal(complement, false, `${k} ${pair} must not fall back to complement`);
  const sites = built.layout.sites;
  const loop = stadium(sites[loopSites[0]].site.n, sites[loopSites[1]].site.n, 1.014);
  const pickedSet = new Set(pair);
  for (let f = 0; f < 4; f++) {
    const n = sites[siteOf[f]].site.n;
    const minAng = Math.min(...loop.pts.map((p) => ang3(p, n)));
    const w = sphericalWinding(loop.pts, n);
    if (pickedSet.has(f)) {
      assert.equal(Math.abs(w), 1, `${k} ${pair} picked feat ${f} winding=${w}`);
      assert.ok(minAng >= 0.35, `${k} ${pair} picked feat ${f} minAng=${minAng}`);
    } else {
      assert.equal(w, 0, `${k} ${pair} unselected feat ${f} winding=${w}`);
      assert.ok(minAng >= 0.38, `${k} ${pair} unselected feat ${f} minAng=${minAng}`);
    }
  }
  return loop;
}

test('math-general.md §9 test vector (3,4|2,5), L = 1.6, t = 0.5', () => {
  const g = fourConeUHP([3, 4, 2, 5], 1.6, 0.5);
  assert.ok(near(g.h[0], 1.345000, 1e-6));
  assert.ok(near(g.h[1], 1.571130, 1e-6));
  assert.ok(near(g.h[2], 0.816981, 1e-6));
  assert.ok(near(g.h[3], 1.475705, 1e-6));
  assert.ok(near(pairDistance(3, 4, 1.6), 1.674348, 1e-6));
  assert.ok(near(pairDistance(2, 5, 1.6), 1.463079, 1e-6));

  const wantUHP = [
    [0.872868, 0.487956],
    [2.041278, 0.886688],
    [-1.110288, 1.218829],
    [-3.304789, 1.594399],
  ];
  const gotUHP = [g.A, g.B, g.C, g.D];
  for (let i = 0; i < 4; i++) {
    assert.ok(cDist(gotUHP[i], wantUHP[i]) < 1e-6, `UHP point ${i}`);
  }

  const wantDisc = [
    [0.0, -0.586622],
    [0.511626, -0.528390],
    [0.279126, 0.360721],
    [0.706059, 0.374427],
  ];
  for (let i = 0; i < 4; i++) {
    assert.ok(cDist(uhpToDisc(gotUHP[i]), wantDisc[i]) < 1e-6, `disc point ${i}`);
  }

  // Relation RA RB RD RC = +I (in SL(2,R))
  const mm = (M, N) => [
    M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3],
    M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3],
  ];
  const T = mm(g.RA, g.RB);
  assert.ok(near(T[0], -Math.exp(-0.8), 1e-10) && near(T[3], -Math.exp(0.8), 1e-10));
  assert.ok(Math.abs(T[1]) < 1e-12 && Math.abs(T[2]) < 1e-12);
  const rel = mm(T, mm(g.RD, g.RC));
  assert.ok(near(rel[0], 1, 1e-10) && near(rel[3], 1, 1e-10) && Math.abs(rel[1]) < 1e-10 && Math.abs(rel[2]) < 1e-10);

  // Pair frame + treeToCut + pairLength inverse check
  const { d } = pairFrameUHP(g.A, g.B);
  assert.ok(near(d, pairDistance(3, 4, 1.6), 1e-10));
  assert.ok(near(pairLength(3, 4, d), 1.6, 1e-10));
  assert.ok(near(d0(3, 3), Math.log(3), 1e-12));
  assert.ok(near(treeToCut(2, 2, 1.6).m, 0, 1e-15));
  assert.ok(near(treeToCut(3, 3, 2.0).m, Math.asinh(0.5 / Math.sinh(0.5)), 1e-12));
});

test('Moment numbers match orbifold-handles-hyperbolic-check.py & design', () => {
  // Moment 1: 3333, L=2, tw=0.175 -> pick (1, 2) gives L'=3.7020, tw'=+0.1091
  const s1 = {
    k: '3333',
    perm: [0, 1, 2, 3],
    orders: [3, 3, 3, 3],
    L: 2.0,
    tw: 0.175,
    thetas: defaultCommas('3333').map((c) => (c ? c.theta : 0)),
  };
  const r12 = recutH(s1, 1, 2);
  assert.ok(near(r12.L, 3.7020, 1e-4), `got L'=${r12.L}`);
  assert.ok(near(r12.tw, 0.1091, 1e-4), `got tw'=${r12.tw}`);
  const r02 = recutH(s1, 0, 2);
  assert.ok(near(r02.L, 3.4971, 1e-4));
  assert.ok(near(r02.tw, -0.0654, 1e-4));

  // Moment 2: 3333, L=0.8, tw=0
  assert.ok(near(pairDistance(3, 3, 0.8), 1.1759, 1e-4));
  assert.ok(near(treeToCut(3, 3, 0.8).m, 1.6411, 1e-4));

  // 2223: 3012, L=1.6, tw=0.1
  const s2 = {
    k: '2223',
    perm: [3, 0, 1, 2],
    orders: [3, 2, 2, 2],
    L: 1.6,
    tw: 0.1,
    thetas: defaultCommas('2223').map((c) => (c ? c.theta : 0)),
  };
  const rCA = recutH(s2, 1, 3); // C=1, A=3
  assert.ok(near(rCA.L, 1.1246, 1e-4));
  assert.ok(near(rCA.tw, -0.1865, 1e-4));
  const rDA = recutH(s2, 2, 3); // D=2, A=3
  assert.ok(near(rDA.L, 1.7150, 1e-4));
  assert.ok(near(rDA.tw, 0.3521, 1e-4));
});

test('All 6 picks on 3333 and 2223 keep cone points & commas in place to 1e-9 and round-trip (L, tw)', () => {
  const pairs = [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]];
  const cases = [
    { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2.0, tw: 0.175 },
    { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 0.8, tw: -0.32 },
    { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 4.1, tw: 0.45 },
    { k: '2223', perm: [3, 0, 1, 2], orders: [3, 2, 2, 2], L: 1.6, tw: 0.1 },
    { k: '2223', perm: [0, 1, 2, 3], orders: [2, 2, 2, 3], L: 1.3, tw: -0.22 },
  ];

  for (const c of cases) {
    const baseThetas = defaultCommas(c.k).map((sp) => (sp ? sp.theta : 0));
    const st0 = { ...c, thetas: baseThetas };
    const b0 = fourConeCentered(st0.orders, st0.L, st0.tw, { thetas: st0.thetas, perm: st0.perm, k: st0.k });
    const ts0 = tiles(b0.D, b0.A, { radius: 12, max: 6000, ms: 4000 });
    const orbitCones0 = [0, 1, 2, 3].map((coneIdx) => {
      const slot = st0.perm.indexOf(coneIdx);
      return ts0.map((t) => apply(t.M, b0.home[slot]));
    });
    const orbitCommas0 = b0.shapes.map((sh) => ts0.map((t) => sh.pts.map((p) => apply(t.M, p))));

    for (const [i, j] of pairs) {
      const st1 = recutH(st0, i, j);
      assert.ok(st1.tw >= -0.5 - 1e-12 && st1.tw <= 0.5 + 1e-12, `tw'=${st1.tw} out of [-0.5, 0.5]`);
      const b1 = fourConeCentered(st1.orders, st1.L, st1.tw, { thetas: st1.thetas, perm: st1.perm, k: st1.k });

      // Carried back onto old frame via invQ: every cone point of b1 matches an old cone point of the same class
      for (let slot = 0; slot < 4; slot++) {
        const coneIdx = st1.perm[slot];
        const pInOld = apply(st1.invQ, b1.home[slot]);
        const dMin = Math.min(...orbitCones0[coneIdx].map((q) => GH.dist(pInOld, q)));
        assert.ok(dMin < 1e-9, `${c.k} L=${c.L} pick (${i},${j}) slot ${slot}: cone drift ${dMin}`);
      }

      // Every comma of b1 carried back via invQ matches an old comma of b0 vertex-for-vertex!
      b1.shapes.forEach((sh1, si) => {
        const ptsInOld = sh1.pts.map((p) => apply(st1.invQ, p));
        let bestCommaErr = Infinity;
        for (const oldCopy of orbitCommas0[si]) {
          const maxD = Math.max(...ptsInOld.map((p, pi) => GH.dist(p, oldCopy[pi])));
          if (maxD < bestCommaErr) bestCommaErr = maxD;
        }
        assert.ok(bestCommaErr < 1e-9, `${c.k} L=${c.L} pick (${i},${j}) comma ${si}: drift ${bestCommaErr}`);
      });

      // Round-trip back to original pair (st0.perm[0], st0.perm[1])
      const stBack = recutH(st1, st0.perm[0], st0.perm[1]);
      assert.ok(near(stBack.L, st0.L, 1e-9), `round-trip L: ${stBack.L} vs ${st0.L}`);
      const sameFarOrder = stBack.perm[2] === st0.perm[2];
      const expectedTw = sameFarOrder ? st0.tw : (st0.tw > 0 ? st0.tw - 0.5 : st0.tw + 0.5);
      assert.ok(near(stBack.tw, expectedTw, 1e-9) || near(Math.abs(stBack.tw - expectedTw), 1, 1e-9),
        `round-trip tw: ${stBack.tw} vs ${expectedTw} (sameFar=${sameFarOrder})`);
    }

    // 5-step chained random recut keeps every cone & comma fixed in place on the initial group
    let cur = st0, Qacc = I3.slice();
    const chain = [[1, 2], [2, 3], [0, 3], [0, 2], [0, 1]];
    for (const [ci, cj] of chain) {
      cur = recutH(cur, ci, cj);
      Qacc = GH.fix(mul(cur.Q, Qacc), 1);
    }
    const invQacc = GH.fix(inv(Qacc), 1);
    const bChain = fourConeCentered(cur.orders, cur.L, cur.tw, { thetas: cur.thetas, perm: cur.perm, k: cur.k });
    bChain.shapes.forEach((shC, si) => {
      const ptsInOld = shC.pts.map((p) => apply(invQacc, p));
      const bestCommaErr = Math.min(...orbitCommas0[si].map((oldCopy) => Math.max(...ptsInOld.map((p, pi) => GH.dist(p, oldCopy[pi])))));
      assert.ok(bestCommaErr < 1e-8, `${c.k} 5-step chain comma ${si} drift ${bestCommaErr}`);
    });
  }
});

test('All 6 picks on 2222 keep centres & commas in place to 1e-9 and round-trip (ell, tw)', () => {
  const pairs = [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]];
  for (const [ell, tw] of [[1.1, 0.15], [0.75, -0.35], [1.35, 0.42], [1.07457, 0.25]]) {
    const st0 = {
      k: '2222',
      perm: [0, 1, 2, 3],
      orders: [2, 2, 2, 2],
      L: ell,
      tw,
      thetas: defaultCommas('2222').map((c) => (c ? c.theta : 0)),
    };
    const b0 = pillowCentered(st0.L, st0.tw, { thetas: st0.thetas, perm: st0.perm });
    const ts0 = tiles(b0.D, b0.A, { radius: 8, max: 300 });
    const orbitCones0 = [0, 1, 2, 3].map((coneIdx) => {
      const slot = st0.perm.indexOf(coneIdx);
      return ts0.map((t) => apply(t.M, b0.home[slot]));
    });
    const orbitCommas0 = b0.shapes.map((sh) => ts0.map((t) => sh.pts.map((p) => apply(t.M, p))));

    for (const [i, j] of pairs) {
      const st1 = recut2222(st0, i, j);
      assert.ok(st1.tw >= -0.5 - 1e-12 && st1.tw <= 0.5 + 1e-12);
      const b1 = pillowCentered(st1.L, st1.tw, { thetas: st1.thetas, perm: st1.perm });

      for (let slot = 0; slot < 4; slot++) {
        const coneIdx = st1.perm[slot];
        const pInOld = apply(st1.invQ, b1.home[slot]);
        const dMin = Math.min(...orbitCones0[coneIdx].map((q) => GE.dist(pInOld, q)));
        assert.ok(dMin < 1e-9, `2222 ell=${ell} pick (${i},${j}) slot ${slot}: drift ${dMin}`);
      }

      b1.shapes.forEach((sh1, si) => {
        const ptsInOld = sh1.pts.map((p) => apply(st1.invQ, p));
        let bestCommaErr = Infinity;
        for (const oldCopy of orbitCommas0[si]) {
          const maxD = Math.max(...ptsInOld.map((p, pi) => GE.dist(p, oldCopy[pi])));
          if (maxD < bestCommaErr) bestCommaErr = maxD;
        }
        assert.ok(bestCommaErr < 1e-9, `2222 ell=${ell} pick (${i},${j}) comma ${si}: drift ${bestCommaErr}`);
      });

      const stBack = recut2222(st1, 0, 1);
      assert.ok(near(stBack.L, st0.L, 1e-9));
      assert.ok(near(Math.abs(stBack.tw - st0.tw), 0, 1e-9) || near(Math.abs(stBack.tw - st0.tw), 1, 1e-9));
    }
  }
});

test('Full turn (-0.5 vs +0.5) returns every centre and every comma; half-turn swaps far pair', () => {
  // 3333
  {
    const bNeg = fourConeCentered([3, 3, 3, 3], 2.0, -0.5, { k: '3333' });
    const bPos = fourConeCentered([3, 3, 3, 3], 2.0, 0.5, { k: '3333' });
    const tsNeg = tiles(bNeg.D, bNeg.A, { radius: 6, max: 1500, ms: 2000 });
    const tsPos = tiles(bPos.D, bPos.A, { radius: 6, max: 1500, ms: 2000 });
    const setNeg = tsNeg.flatMap((t) => bNeg.home.map((p) => apply(t.M, p)));
    for (const t of tsPos.slice(0, 40)) {
      for (const p of bPos.home) {
        const q = apply(t.M, p);
        if (GH.dist(q, GH.origin) < 3.0) {
          assert.ok(Math.min(...setNeg.map((x) => GH.dist(x, q))) < 1e-9);
        }
      }
    }
    // Commas also repeat after full turn (-0.5 -> +0.5)
    const cNeg = tsNeg.map((t) => bNeg.shapes[2].pts.map((p) => apply(t.M, p)));
    const cPos0 = bPos.shapes[2].pts;
    const minComma = Math.min(...cNeg.map((pts) => Math.max(...pts.map((p, k) => GH.dist(p, cPos0[k])))));
    assert.ok(minComma < 1e-9, `3333 full turn comma drift ${minComma}`);

    // Half turn (0 vs +0.5): C and D swap places!
    const b0 = fourConeCentered([3, 3, 3, 3], 2.0, 0.0, { k: '3333' });
    assert.ok(GH.dist(b0.home[3], bPos.home[2]) < 1e-9);
  }
  // 2222
  {
    const bNeg = pillowCentered(1.15, -0.5);
    const bPos = pillowCentered(1.15, 0.5);
    const tsNeg = tiles(bNeg.D, bNeg.A, { radius: 6, max: 200 });
    const setNeg = tsNeg.flatMap((t) => bNeg.home.map((p) => apply(t.M, p)));
    for (const p of bPos.home) assert.ok(Math.min(...setNeg.map((x) => GE.dist(x, p))) < 1e-9);
    const cNeg = tsNeg.map((t) => bNeg.shapes[2].pts.map((p) => apply(t.M, p)));
    const minComma = Math.min(...cNeg.map((pts) => Math.max(...pts.map((p, k) => GE.dist(p, bPos.shapes[2].pts[k])))));
    assert.ok(minComma < 1e-9);
  }
});

test('analyse(D) reads exact signature across L in [0.4, 7.0] and tw in [-0.5, 0.5] and 2222 range', () => {
  for (const orders of [[3, 3, 3, 3], [2, 2, 2, 3], [3, 2, 2, 2]]) {
    const want = orders.slice().sort((a, b) => b - a).join('');
    for (const L of [0.4, 0.6, 1.0, 2.0, 3.5, 5.0, 7.0]) {
      for (const tw of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const { D, A } = fourConeCentered(orders, L, tw);
        const got = signatureOf(A).cones.slice().sort((a, b) => b - a).join('');
        assert.equal(got, want, `orders=${orders} L=${L} tw=${tw}`);
        const area = Math.abs(GH.area(D.verts));
        const expectedArea = TAU * Math.abs(2 - orders.reduce((s, n) => s + (n - 1) / n, 0));
        assert.ok(near(area, expectedArea, 1e-6), `area ${area} vs ${expectedArea}`);
      }
    }
  }
  for (const ell of [0.5, Math.SQRT1_2, 1.0, Math.SQRT2, 2.0]) {
    for (const tw of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const { D, A } = pillowCentered(ell, tw);
      assert.equal(signatureOf(A).cones.join(''), '2222');
      assert.ok(near(Math.abs(GE.area(D.verts)), 2, 1e-9));
    }
  }
});

test('3D ball stadium loop, bead, walk data, and view interpolation', () => {
  for (const k of ['3333', '2223', '2222']) {
    const parts = FAMILIES[k].baseOrders.map((n) => ({ t: 'cone', n }));
    const built = buildSurface(parts);
    built.scene.finish();
    for (const pair of [[0, 1], [1, 3], [0, 2], [2, 3]]) {
      const loop = assertBallLoopForPair(built, pair, k);
      const b0 = beadOnLoop(loop, 0.0);
      const b1 = beadOnLoop(loop, 1.0);
      assert.ok(Math.hypot(b0[0] - b1[0], b0[1] - b1[1], b0[2] - b1[2]) < 1e-9);
    }
  }
  const fd = followTreeData({ k: '3333', orders: [3, 3, 3, 3], L: 2.0, tw: 0.175 });
  assert.ok(fd.fwdSegs.length >= 4 && fd.backSegs.length >= 4 && fd.cutPts.length > 5 && fd.legs.length === 4);

  const st0 = {
    k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2.0, tw: 0.175,
    thetas: defaultCommas('3333').map((c) => (c ? c.theta : 0)),
  };
  const r = recutH(st0, 1, 2);
  const m0 = interpolateView('H', r.invQ, I3, 0);
  const m1 = interpolateView('H', r.invQ, I3, 1);
  for (let idx = 0; idx < 9; idx++) {
    assert.ok(near(m0[idx], r.invQ[idx], 1e-9));
    assert.ok(near(m1[idx], I3[idx], 1e-9));
  }

  const m = buildPatternModel(st0, { follow: { active: true, data: fd, progress: 1 } });
  assert.equal(m.outline, false);
  assert.equal(m.marks.length, 2);
});

test('General five-feature families (333*, 333*3, 333x, o33) signatures across extreme parameters', () => {
  assert.equal(normalizeFamilyKey('333∗'), '333*');
  assert.equal(normalizeFamilyKey('333∗3'), '333*3');
  assert.equal(normalizeFamilyKey('333×'), '333x');
  assert.equal(normalizeFamilyKey('o33'), 'o33');

  for (const L of [0.5, 1.4, 2.5, 5.5]) {
    for (const tw of [-0.5, 0, 0.25, 0.5]) {
      for (const b of [0.5, 1.4, 2.8]) {
        const sStar = signatureOf(coneFeatCentered('333*', L, tw, b, 0).A);
        assert.deepEqual(sStar, { o: 0, x: 0, cones: [3, 3, 3], stars: [[]] });
      }
      for (const b of [0.3, 0.7, 1.6]) {
        const sX = signatureOf(coneFeatCentered('333x', L, tw, b, 0).A);
        assert.deepEqual(sX, { o: 0, x: 1, cones: [3, 3, 3], stars: [] });
      }
      for (const tauC of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const sS3 = signatureOf(coneFeatCentered('333*3', L, tw, 1.4, tauC).A);
        assert.deepEqual(sS3, { o: 0, x: 0, cones: [3, 3, 3], stars: [[3]] });
      }
      for (const perm of [[0, 2, 1, 3], [0, 1, 2, 3]]) {
        for (const tauO of [-0.5, -0.2, 0, 0.2, 0.5]) {
          const sO = signatureOf(o33Centered(L, tw, 1.3, tauO, { perm }).A);
          assert.deepEqual(sO, { o: 1, x: 0, cones: [3, 3], stars: [] });
        }
      }
    }
  }
});

test('All 6 picks + 6-step chains on 333*, 333*3, 333x, o33 preserve features & commas to 1e-8', () => {
  const buildCentered = (st) => FAMILIES[st.k].mode === 'handle'
    ? o33Centered(st.L, st.tw, st.b, st.tau, { perm: st.perm, thetas: st.thetas })
    : coneFeatCentered(st.k, st.L, st.tw, st.b, st.tau, { perm: st.perm, thetas: st.thetas });

  const pairs = [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]];
  const cases = [
    { k: '333*', perm: [0, 1, 2, 3], L: 2.0, tw: 0.15, b: 1.4, tau: 0 },
    { k: '333*3', perm: [0, 1, 2, 3], L: 2.0, tw: 0.15, b: 1.4, tau: 0.25 },
    { k: '333x', perm: [0, 1, 2, 3], L: 2.0, tw: 0.15, b: 0.7, tau: 0 },
    { k: 'o33', perm: [0, 2, 1, 3], L: 2.2, tw: 0.15, b: 1.3, tau: 0.2 },
    { k: 'o33', perm: [0, 1, 2, 3], L: 2.5, tw: -0.18, b: 1.1, tau: -0.3 },
  ];

  for (const c of cases) {
    const fam = FAMILIES[c.k];
    const thetas = defaultCommas(c.k).map((sp) => (sp ? sp.theta : 0));
    const st0 = { ...c, orders: c.perm.map((x) => fam.baseOrders[x]), thetas };
    const b0 = buildCentered(st0);
    const ts0 = tiles(b0.D, b0.A, { radius: 11, max: 7000, ms: 4000 });
    const orbFeat0 = [0, 1, 2, 3].map((f) => {
      const slot = st0.perm.indexOf(f);
      return ts0.map((t) => apply(t.M, b0.home[slot]));
    });
    const orbCommas0 = b0.shapes.map((sh) => ts0.map((t) => sh.pts.map((p) => apply(t.M, p))));
    const g0Line0 = b0.extraLines && b0.extraLines[0] ? ts0.map((t) => [apply(t.M, b0.extraLines[0].a), apply(t.M, b0.extraLines[0].b)]) : null;

    for (const [i, j] of pairs) {
      const st1 = recut(st0, i, j);
      assert.ok(st1.tw >= -0.5 - 1e-12 && st1.tw <= 0.5 + 1e-12);
      const b1 = buildCentered(st1);

      for (let slot = 0; slot < 4; slot++) {
        const f = st1.perm[slot];
        const pOld = apply(st1.invQ, b1.home[slot]);
        const isGeod = (c.k === 'o33' && f < 2) || ((c.k === '333*' || c.k === '333x' || c.k === '333*3') && f === fam.featIdx);
        if (!isGeod) {
          const dMin = Math.min(...orbFeat0[f].map((q) => GH.dist(pOld, q)));
          assert.ok(dMin < 1e-9, `${c.k} pick (${i},${j}) feat ${f} drift ${dMin}`);
        } else if (g0Line0 && b1.extraLines && b1.extraLines[0]) {
          const hOldA = apply(st1.invQ, b1.extraLines[0].a);
          const lMin = Math.min(...g0Line0.map(([u, v]) => GH.lineDist(hOldA, u, v)));
          assert.ok(lMin < 1e-9, `${c.k} pick (${i},${j}) handle line drift ${lMin}`);
        }
      }

      b1.shapes.forEach((sh1, si) => {
        const ptsOld = sh1.pts.map((p) => apply(st1.invQ, p));
        const bestComma = Math.min(...orbCommas0[si].map((oc) => Math.max(...ptsOld.map((p, pi) => GH.dist(p, oc[pi])))));
        assert.ok(bestComma < 1e-9, `${c.k} pick (${i},${j}) comma ${si} drift ${bestComma}`);
      });

      const stBack = recut(st1, st0.perm[0], st0.perm[1]);
      assert.ok(near(stBack.L, st0.L, 1e-9), `${c.k} round-trip L ${stBack.L} vs ${st0.L}`);
    }

    let cur = st0, Qacc = I3.slice();
    for (const [ci, cj] of pairs) {
      cur = recut(cur, ci, cj);
      Qacc = GH.fix(mul(cur.Q, Qacc), 1);
    }
    const invQacc = GH.fix(inv(Qacc), 1);
    const bChain = buildCentered(cur);
    bChain.shapes.forEach((shC, si) => {
      const ptsOld = shC.pts.map((p) => apply(invQacc, p));
      const bestComma = Math.min(...orbCommas0[si].map((oc) => Math.max(...ptsOld.map((p, pi) => GH.dist(p, oc[pi])))));
      assert.ok(bestComma < 1e-8, `${c.k} 6-step chain comma ${si} drift ${bestComma}`);
    });
  }
});

test('Period-1 invariance of tauO/tauC and 3D + followTreeData across all 7 families', () => {
  for (const perm of [[0, 2, 1, 3], [0, 1, 2, 3]]) {
    const bNeg = o33Centered(2.2, 0.15, 1.3, -0.5, { perm });
    const bPos = o33Centered(2.2, 0.15, 1.3, 0.5, { perm });
    const tsNeg = tiles(bNeg.D, bNeg.A, { radius: 8, max: 2000, ms: 2000 });
    const cNeg = tsNeg.map((t) => bNeg.shapes[0].pts.map((p) => apply(t.M, p)));
    const minC = Math.min(...cNeg.map((pts) => Math.max(...pts.map((p, k) => GH.dist(p, bPos.shapes[0].pts[k])))));
    assert.ok(minC < 1e-9, `o33 tauO=-0.5 vs +0.5 comma drift ${minC}`);
  }
  {
    const bNeg = coneFeatCentered('333*3', 2.0, 0.15, 1.4, -0.5);
    const bPos = coneFeatCentered('333*3', 2.0, 0.15, 1.4, 0.5);
    const tsNeg = tiles(bNeg.D, bNeg.A, { radius: 8, max: 2000, ms: 2000 });
    const cNeg = tsNeg.map((t) => bNeg.shapes[0].pts.map((p) => apply(t.M, p)));
    const minC = Math.min(...cNeg.map((pts) => Math.max(...pts.map((p, k) => GH.dist(p, bPos.shapes[0].pts[k])))));
    assert.ok(minC < 1e-9, `333*3 tauC=-0.5 vs +0.5 comma drift ${minC}`);
  }

  for (const k of ['3333', '2223', '333*', '333*3', '333x', 'o33', '2222']) {
    const built = buildSurface(surfacePartsFor(k));
    built.scene.finish();
    const feats = featureAnchorsForBall(built, k);
    assert.equal(feats.length, 4);
    for (const pair of [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]) {
      assertBallLoopForPair(built, pair, k);
    }
    if (k === 'o33') {
      const belt = handleBeltLoop(built);
      const b0 = beadOnLoop(belt, 0.0), b1 = beadOnLoop(belt, 1.0);
      assert.ok(Math.hypot(b0[0] - b1[0], b0[1] - b1[1], b0[2] - b1[2]) < 1e-9);
    }
    const fam = FAMILIES[k];
    const perm = fam.defaultM.split('').map(Number);
    const st = { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: fam.defaultB ?? 0, tau: fam.defaultTau ?? 0, thetas: defaultCommas(k).map((c) => (c ? c.theta : 0)) };
    const fd = followTreeData(st);
    assert.ok(fd.fwdSegs.length >= 2 && fd.backSegs.length >= 2 && fd.legs.length === 4);
    const pm = buildPatternModel(st, { follow: { active: true, data: fd, progress: 1 } });
    assert.equal(pm.outline, false);
  }
});

test('Exact Lorentz invH, so21ToPSU/psuToSO21 roundtrip, and psuAxisOfTrans accuracy', () => {
  const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
  const samplePt = GH.polar(3.2, 1.1);
  for (const flip of [false, true]) {
    const M = GH.fit(GH.polar(1.5, 0.4), GH.polar(4.1, -0.7), GH.polar(5.0, 2.1), GH.polar(3.8, -1.9), flip);
    const P = mul(M, invH(M));
    for (let i = 0; i < 9; i++) assert.ok(near(P[i], I3[i], 1e-10), `M * invH(M) idx=${i}: ${P[i]}`);
    const g = so21ToPSU(M, flip);
    const M2 = psuToSO21(g);
    const dErr = discDist(toDisc(apply(M, samplePt)), toDisc(apply(M2, samplePt)));
    assert.ok(dErr < 1e-11, `so21ToPSU/psuToSO21 flip=${flip} drift ${dErr}`);
  }
  const Tsp = psuMul(psuRotate(GH.polar(3.0, -0.3), TAU / 3), psuRotate(GH.polar(6.0, 0.2), TAU / 3));
  const ax = psuAxisOfTrans(Tsp);
  const conj = psuMul(ax.invF, psuMul(Tsp, ax.F));
  const want = psuBoostX(ax.len);
  assert.ok(discDist(psuApplyDisc(conj, [0, 0]), psuApplyDisc(want, [0, 0])) < 1e-10, `axis conj disc mismatch`);
  assert.ok(Math.abs(conj[1]) < 1e-9 && Math.abs(conj[3]) < 1e-9, `axis conj imaginary parts: ${conj[1]}, ${conj[3]}`);
});

test('Repro #k=o33&m=2103&l=9.56&tw=0.4295&b=1.3&to=0.4736 sweep, tilesPSU, and recut invariance', () => {
  const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
  const baseSt = {
    k: 'o33', perm: [2, 1, 0, 3], orders: [3, 0, 0, 3],
    L: 9.56, b: 1.3, tau: 0.4736,
    thetas: defaultCommas('o33').map((sp) => (sp ? sp.theta : 0)),
  };
  for (const tw of [-0.5, -0.49, -0.4295, -0.2, 0, 0.2, 0.35, 0.4295, 0.48, 0.5]) {
    const m = buildPatternModel({ ...baseSt, tw });
    assert.deepEqual(signatureOf(m.A), { o: 1, x: 0, cones: [3, 3], stars: [] });
    const rt = Math.max(...m.A.maps2.map((g, i) => {
      const p = psuMul(g, m.A.maps2[m.D.edges[i].to]);
      return 2 * Math.asinh(Math.hypot(p[2], p[3]));
    }));
    assert.ok(rt < 1e-9, `tw=${tw} maps2 roundtrip ${rt}`);

    const c3 = psuMul(m.A.maps2[2], m.A.maps2[8]);
    const c3cube = psuMul(c3, psuMul(c3, c3));
    const cycErr = 2 * Math.asinh(Math.hypot(c3cube[2], c3cube[3]));
    assert.ok(cycErr < 1e-6, `tw=${tw} 3-cone cycle err ${cycErr}`);
    assert.ok(discDist(psuApplyDisc(c3cube, toDisc(m.D.at)), toDisc(m.D.at)) < 1e-6, `tw=${tw} 3-cone cycle point drift`);

    const ts = tilesPSU(m.D, m.A, { focus: [0, 0], radius: 5.6, max: 4200 });
    assert.ok(ts.length >= 500 && ts.length < 4200, `tw=${tw} expected healthy tiling, got ${ts.length}`);
    for (let i = 1; i < Math.min(20, ts.length); i++) {
      assert.ok(discDist(psuApplyDisc(ts[i].g, toDisc(m.D.at)), toDisc(m.D.at)) > 0.1, 'no origin collision');
    }
  }

  // Orbit matcher in PSU local frame for all 6 recut picks from the exact repro
  const st0 = { ...baseSt, tw: 0.4295 };
  const c0 = o33Centered(st0.L, st0.tw, st0.b, st0.tau, { perm: st0.perm, thetas: st0.thetas });
  const atD = toDisc(c0.D.at);
  const nearestInOrbit = (targetPt, refPt, conePt = null, targetCommaD = null, refCommaD = null) => {
    const targetD = toDisc(targetPt), refD = toDisc(refPt);
    const grid = new Map();
    const keyOf = (w, f) => {
      const r2 = Math.hypot(w[0], w[1]), d = 2 * Math.atanh(Math.min(1 - 1e-15, r2)), th = Math.atan2(w[1], w[0]);
      return (f ? 'f' : 'd') + Math.round(d * 8) + ':' + Math.round(th * 12);
    };
    const heap = [{ g: psuI(), d: discDist(refD, targetD) }];
    const push = (x) => { heap.push(x); for (let i = heap.length - 1; i > 0;) { const u = (i - 1) >> 1; if (heap[u].d <= heap[i].d) break; [heap[u], heap[i]] = [heap[i], heap[u]]; i = u; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0;;) { const l = 2 * i + 1, r2 = l + 1; let mn = i; if (l < heap.length && heap[l].d < heap[mn].d) mn = l; if (r2 < heap.length && heap[r2].d < heap[mn].d) mn = r2; if (mn === i) break; [heap[mn], heap[i]] = [heap[i], heap[mn]]; i = mn; } } return top; };
    grid.set(keyOf(atD, false), [atD]);
    let bestD = Infinity, bestG = psuI(), count = 0;
    while (heap.length && count < 15000) {
      const cur = pop(); count++;
      const dc = discDist(psuApplyDisc(cur.g, refD), targetD);
      if (dc < bestD) { bestD = dc; bestG = cur.g; }
      if (dc < 1e-10) break;
      for (let i = 0; i < c0.D.n; i++) {
        const g = psuMul(cur.g, c0.A.maps2[i]), w = psuApplyDisc(g, atD), k = keyOf(w, !!g[4]), list = grid.get(k);
        if (list && list.some((q) => discDist(w, q) < 1e-4)) continue;
        if (list) list.push(w); else grid.set(k, [w]);
        const d = discDist(psuApplyDisc(g, refD), targetD);
        if (d < 20) push({ g, d });
      }
    }
    if (!conePt) return bestD;
    let bestComma = Infinity;
    for (let rot = 0; rot < 3; rot++) {
      const gRot = psuMul(bestG, psuRotate(conePt, (rot * TAU) / 3));
      const err = Math.max(...refCommaD.map((w, idx) => discDist(psuApplyDisc(gRot, w), targetCommaD[idx])));
      if (err < bestComma) bestComma = err;
    }
    return { bestD, bestComma };
  };

  const nearestLineInOrbit = (targetA, targetB, refA, refB) => {
    const toH = (d) => { const r2 = d[0] * d[0] + d[1] * d[1]; return [2 * d[0] / (1 - r2), 2 * d[1] / (1 - r2), (1 + r2) / (1 - r2)]; };
    const refAD = toDisc(refA), refBD = toDisc(refB);
    const refMid = toDisc(GH.norm([(refA[0] + refB[0]) / 2, (refA[1] + refB[1]) / 2, (refA[2] + refB[2]) / 2]));
    const targetMid = toDisc(GH.norm([(targetA[0] + targetB[0]) / 2, (targetA[1] + targetB[1]) / 2, (targetA[2] + targetB[2]) / 2]));
    const grid = new Map();
    const keyOf = (w) => Math.round(w[0] * 24) + ':' + Math.round(w[1] * 24);
    const heap = [{ g: psuI(), d: discDist(refMid, targetMid) }];
    grid.set(keyOf(atD), [atD]);
    let bestErr = Infinity, count = 0;
    while (heap.length && count < 10000) {
      heap.sort((x, y) => x.d - y.d);
      const cur = heap.shift(); count++;
      const mA = toH(psuApplyDisc(cur.g, refAD)), mB = toH(psuApplyDisc(cur.g, refBD));
      const err = GH.lineDist(targetA, mA, mB) + GH.lineDist(targetB, mA, mB);
      if (err < bestErr) bestErr = err;
      if (err < 1e-8) break;
      for (let i = 0; i < c0.D.n; i++) {
        const g = psuMul(cur.g, c0.A.maps2[i]), w = psuApplyDisc(g, atD), k = keyOf(w), list = grid.get(k);
        if (list && list.some((q) => discDist(w, q) < 1e-4)) continue;
        if (list) list.push(w); else grid.set(k, [w]);
        const d = discDist(psuApplyDisc(g, refMid), targetMid);
        if (d < 25) heap.push({ g, d });
      }
    }
    return bestErr;
  };

  const c0HLineA = c0.extraLines[0].a, c0HLineB = c0.extraLines[0].b;
  for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]]) {
    const r = recut(st0, i, j);
    assert.ok(r.tw >= -0.5 - 1e-12 && r.tw <= 0.5 + 1e-12);
    const cm = o33Centered(r.L, r.tw, r.b, r.tau, { perm: r.perm, thetas: r.thetas });
    const hErr = nearestLineInOrbit(GH.norm(apply(r.invQ, cm.extraLines[0].a)), GH.norm(apply(r.invQ, cm.extraLines[0].b)), c0HLineA, c0HLineB);
    assert.ok(hErr < 1e-7, `repro recut (${i},${j}) handle line drift ${hErr}`);

    for (const [ci, si] of [[2, 0], [3, 1]]) {
      const targetCone = GH.norm(apply(r.invQ, cm.home[r.perm.indexOf(ci)]));
      const refCone = c0.home[st0.perm.indexOf(ci)];
      const targetCommaD = cm.shapes[si].pts.map((p) => toDisc(GH.norm(apply(r.invQ, p))));
      const refCommaD = c0.shapes[si].pts.map(toDisc);
      const { bestD, bestComma } = nearestInOrbit(targetCone, refCone, refCone, targetCommaD, refCommaD);
      assert.ok(bestD < 5e-8, `repro recut (${i},${j}) cone ${ci} drift ${bestD}`);
      assert.ok(bestComma < 1e-7, `repro recut (${i},${j}) comma ${si} drift ${bestComma}`);
    }
  }
});

test('All 6 hyperbolic families at extreme L in [0.4, 11.5] and tw in [-0.5, 0.5]: signatures, area, roundtrip, continuity, period-1', () => {
  const expectedSig = {
    '3333': { o: 0, x: 0, cones: [3, 3, 3, 3], stars: [] },
    '2223': { o: 0, x: 0, cones: [3, 2, 2, 2], stars: [] },
    '333*': { o: 0, x: 0, cones: [3, 3, 3], stars: [[]] },
    '333*3': { o: 0, x: 0, cones: [3, 3, 3], stars: [[3]] },
    '333x': { o: 0, x: 1, cones: [3, 3, 3], stars: [] },
    'o33': { o: 1, x: 0, cones: [3, 3], stars: [] },
  };
  const buildFor = (k, perm, L, tw) => {
    const fam = FAMILIES[k];
    if (fam.mode === 'cones') return fourConeCentered(perm.map((c) => fam.baseOrders[c]), L, tw, { perm, k });
    if (fam.mode === 'handle') return o33Centered(L, tw, fam.defaultB, 0.4736, { perm });
    return coneFeatCentered(k, L, tw, fam.defaultB, fam.defaultTau ?? 0, { perm });
  };

  for (const k of ['3333', '2223', '333*', '333*3', '333x', 'o33']) {
    const fam = FAMILIES[k];
    const perms = k === 'o33' ? [[0, 2, 1, 3], [2, 1, 0, 3], [0, 1, 2, 3], [2, 3, 0, 1]] : k === '2223' ? [[3, 0, 1, 2], [0, 1, 2, 3]] : [[0, 1, 2, 3], [2, 3, 0, 1]];
    const expectedArea = { '3333': (TAU * 2) / 3, '2223': TAU / 6, '333*': TAU, '333*3': (TAU * 4) / 3, '333x': TAU, 'o33': (TAU * 4) / 3 }[k];
    for (const L of [0.4, 2.0, 5.5, 9.56, 11.5]) {
      for (const tw of [-0.5, -0.49, -0.25, 0, 0.25, 0.4295, 0.49, 0.5]) {
        for (const perm of perms) {
          const b = buildFor(k, perm, L, tw);
          assert.deepEqual(signatureOf(b.A), expectedSig[k], `${k} L=${L} tw=${tw} perm=${perm}`);
          assert.ok(near(Math.abs(GH.area(b.D.verts)), expectedArea, 1e-5), `${k} L=${L} tw=${tw} area`);
          const rt = Math.max(...b.A.maps2.map((g, i) => {
            const j = b.D.edges[i].mirror ? i : b.D.edges[i].to;
            const p = psuMul(g, b.A.maps2[j]);
            return 2 * Math.asinh(Math.hypot(p[2], p[3]));
          }));
          assert.ok(rt < (L > 10 ? 1e-8 : 1e-9), `${k} L=${L} tw=${tw} perm=${perm} rt=${rt}`);
        }
      }
    }

    // Period-1 invariance tw=-0.5 vs +0.5 at L=9.56
    const pNeg = buildFor(k, perms[0], 9.56, -0.5);
    const pPos = buildFor(k, perms[0], 9.56, 0.5);
    const tsNeg = tilesPSU(pNeg.D, pNeg.A, { focus: [0, 0], radius: 7.5, max: 4200 });
    const cNeg = tsNeg.map((t) => pNeg.shapes[0].pts.map((p) => apply(t.M, p)));
    const minC = Math.min(...cNeg.map((pts) => Math.max(...pts.map((p, idx) => GH.dist(p, pPos.shapes[0].pts[idx])))));
    assert.ok(minC < 1e-8, `${k} L=9.56 period-1 comma drift ${minC}`);

    if (k === 'o33') {
      const sNeg = buildFor(k, [0, 1, 2, 3], 9.56, -0.5);
      const sPos = buildFor(k, [0, 1, 2, 3], 9.56, 0.5);
      const tsS = tilesPSU(sNeg.D, sNeg.A, { focus: [0, 0], radius: 7.5, max: 4200 });
      const minCS = Math.min(...tsS.map((t) => Math.max(...sPos.shapes[0].pts.map((p, idx) => GH.dist(apply(t.M, sNeg.shapes[0].pts[idx]), p)))));
      assert.ok(minCS < 1e-8, `o33 Split L=9.56 period-1 comma drift ${minCS}`);
    }
  }

  // Domain-switch continuity across tw = -1e-9 vs +1e-9 at L=9.56 for 3333, 2223, o33 Split
  for (const [k, perm] of [['3333', [0, 1, 2, 3]], ['2223', [3, 0, 1, 2]], ['o33', [0, 1, 2, 3]]]) {
    const mA = buildFor(k, perm, 9.56, -1e-9);
    const mB = buildFor(k, perm, 9.56, 1e-9);
    const tsA = tilesPSU(mA.D, mA.A, { focus: [0, 0], radius: 5.0, max: 600 });
    const minC = Math.min(...tsA.map((t) => Math.max(...mB.shapes[0].pts.map((p, idx) => GH.dist(apply(t.M, mA.shapes[0].pts[idx]), p)))));
    assert.ok(minC < 1e-7, `${k} continuity across tw=0 drift ${minC}`);
  }
});

test('Drag recentering (locateTilePSU) and far-focus tilesPSU never vanish on o33 b=0.4 or any hyperbolic family', () => {
  const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
  const repro = {
    k: 'o33', perm: [0, 2, 1, 3], orders: [0, 3, 0, 3],
    L: 2.006, tw: -0.0344, b: 0.4, tau: 0.485,
    thetas: defaultCommas('o33').map((s) => (s ? s.theta : 0)),
  };
  const m0 = buildPatternModel(repro);
  for (let ai = 0; ai < 16; ai++) {
    const ang = (ai * TAU) / 16;
    let vPsu = psuI();
    const dragStep = so21ToPSU(GH.translate(GH.origin, GH.polar(1.5, ang)), false);
    for (let step = 0; step < 50; step++) {
      vPsu = psuMul(dragStep, vPsu);
      const focus = psuApplyDisc(psuInv(vPsu), [0, 0]);
      const res = locateTilePSU(m0.D, m0.A, focus);
      assert.ok(res.inside, `repro ang=${ai} step=${step} locateTilePSU failed`);
      vPsu = psuMul(vPsu, res.g);
      const newFocus = psuApplyDisc(psuInv(vPsu), [0, 0]);
      assert.ok(discDist(newFocus, [0, 0]) < 5.0, `repro ang=${ai} step=${step} newFocus too far: ${discDist(newFocus, [0, 0])}`);
      if (step % 5 === 4 || step === 0) {
        const ts = tilesPSU(m0.D, m0.A, { focus: newFocus, radius: 5.6, max: 4200 });
        const drawn = ts.filter((t) => Math.max(0, t.d - 0.5) <= 5.5).length;
        assert.ok(drawn >= 350, `repro ang=${ai} step=${step} drawn=${drawn}`);
      }
    }
  }

  for (let ai = 0; ai < 8; ai++) {
    const ang = (ai * TAU) / 8;
    for (const dist of [0, 5.5, 9.0, 12.0]) {
      const focus = toDisc(GH.polar(dist, ang));
      const ts = tilesPSU(m0.D, m0.A, { focus, radius: 5.6, max: 4200 });
      const drawn = ts.filter((t) => Math.max(0, t.d - 0.5) <= 5.5).length;
      assert.ok(drawn >= 350, `far focus dist=${dist} ang=${ai} drawn=${drawn}`);
    }
  }

  for (const k of ['3333', '2223', '333*', '333*3', '333x', 'o33']) {
    const fam = FAMILIES[k];
    const perms = k === 'o33' ? [[0, 2, 1, 3], [0, 1, 2, 3]] : [[0, 1, 2, 3]];
    const bs = fam.bRange ? [0.25, 0.4, 1.4] : [0];
    for (const perm of perms) {
      for (const L of [0.4, 2.0, 9.56]) {
        for (const tw of [-0.5, 0, 0.43]) {
          for (const b of bs) {
            const mod = buildPatternModel({
              k, perm, orders: perm.map((c) => fam.baseOrders[c]), L, tw, b, tau: 0.485,
              thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
            });
            for (let ai = 0; ai < 8; ai++) {
              const ang = (ai * TAU) / 8;
              let vPsu = psuI();
              const dragStep = so21ToPSU(GH.translate(GH.origin, GH.polar(2.0, ang)), false);
              for (let s = 0; s < 10; s++) {
                vPsu = psuMul(dragStep, vPsu);
                const focus = psuApplyDisc(psuInv(vPsu), [0, 0]);
                const res = locateTilePSU(mod.D, mod.A, focus);
                assert.ok(res.inside, `${k} perm=${perm} L=${L} tw=${tw} b=${b} ang=${ai} step=${s} locateTilePSU failed`);
                vPsu = psuMul(vPsu, res.g);
              }
              const finalFocus = psuApplyDisc(psuInv(vPsu), [0, 0]);
              const ts = tilesPSU(mod.D, mod.A, { focus: finalFocus, radius: 5.6, max: 4200 });
              const drawn = ts.filter((t) => Math.max(0, t.d - 0.5) <= 5.5).length;
              assert.ok(drawn >= 200, `${k} perm=${perm} L=${L} tw=${tw} b=${b} ang=${ai} drawn=${drawn}`);
            }
          }
        }
      }
    }
  }
});

test('Complementary pair tree (farTreeSeg) renders symmetrically and matches swapped-pair treeSeg across all 7 families', () => {
  const cases = [
    ['3333', [0, 1, 2, 3]],
    ['2223', [0, 1, 2, 3]],
    ['2223', [3, 0, 1, 2]],
    ['333*', [0, 1, 2, 3]],
    ['333*3', [0, 1, 2, 3]],
    ['333x', [0, 1, 2, 3]],
    ['o33', [0, 2, 1, 3]],
    ['o33', [0, 1, 2, 3]],
    ['2222', [0, 1, 2, 3]],
  ];

  for (const [k, perm] of cases) {
    const fam = FAMILIES[k];
    const G = fam.kind === 'E' ? GE : GH;
    const L = k === '2222' ? 1.1 : 2.2;
    const b = fam.defaultB ?? 0, tau = fam.defaultTau ?? 0;
    const thetas = defaultCommas(k).map((s) => (s ? s.theta : 0));

    let refLen = null;
    for (const tw of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const st = { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L, tw, b, tau, thetas };
      const m = buildPatternModel(st);
      const nonOnce = m.lines.filter((ln) => !ln.once);
      const cutLn = nonOnce[nonOnce.length - 1];
      const treeLn = nonOnce[nonOnce.length - 2];
      const farLn = nonOnce[nonOnce.length - 3];
      assert.ok(cutLn && cutLn.dash, `${k} missing cutSeg`);
      assert.equal(treeLn.alpha, 0.9, `${k} picked tree alpha`);
      assert.equal(farLn.alpha, 0.5, `${k} farTree alpha`);
      const len = G.dist(farLn.a, farLn.b);
      if (refLen === null) refLen = len;
      assert.ok(near(len, refLen, 1e-7), `${k} tw=${tw} farTree len varied: ${len} vs ${refLen}`);
    }

    const st = { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L, tw: 0.23, b, tau, thetas };
    const m1 = buildPatternModel(st);
    const nonOnce = m1.lines.filter((ln) => !ln.once);
    const cutLn = nonOnce[nonOnce.length - 1];
    const treeLn = nonOnce[nonOnce.length - 2];
    const farLn = nonOnce[nonOnce.length - 3];

    const side = (pt) => {
      if (fam.kind === 'E') return pt[1] - cutLn.a[1];
      const F = GH.frame(cutLn.a, cutLn.b), n = [F[1], F[4], F[7]];
      return pt[0] * n[0] + pt[1] * n[1] - pt[2] * n[2];
    };
    const st0 = side(treeLn.a), st1 = side(treeLn.b), sf0 = side(farLn.a), sf1 = side(farLn.b);
    if (Math.abs(sf0) < 1e-9 && Math.abs(sf1) < 1e-9) {
      assert.ok(Math.abs(st0) > 0.1 && st0 * st1 > 0, `${k} expected cut through (2,2) far pair`);
    } else {
      assert.ok(st0 * st1 >= -1e-9 && sf0 * sf1 >= -1e-9 && (st0 + st1) * (sf0 + sf1) < 0, `${k} farTree not on opposite side of cutSeg`);
    }

    const r = recut(st, perm[2], perm[3]);
    const st2 = { k: r.k, perm: r.perm, orders: r.orders, L: r.L, tw: r.tw, b: r.b ?? st.b, tau: r.tau ?? st.tau, thetas: r.thetas };
    const m2 = buildPatternModel(st2);
    const nonOnce2 = m2.lines.filter((ln) => !ln.once);
    const tree2 = nonOnce2[nonOnce2.length - 2];
    if (fam.kind === 'E') {
      const p0 = apply(r.invQ, tree2.a), p1 = apply(r.invQ, tree2.b);
      assert.ok(near(p0[1], farLn.a[1], 1e-8) && near(p1[1], farLn.a[1], 1e-8), `2222 swapped y mismatch`);
      assert.ok(near(GE.dist(tree2.a, tree2.b), GE.dist(farLn.a, farLn.b), 1e-8), `2222 swapped len mismatch`);
    } else {
      const p0 = GH.norm(apply(r.invQ, tree2.a)), p1 = GH.norm(apply(r.invQ, tree2.b));
      const dMatch = Math.min(
        Math.max(GH.dist(p0, farLn.a), GH.dist(p1, farLn.b)),
        Math.max(GH.dist(p0, farLn.b), GH.dist(p1, farLn.a)),
      );
      assert.ok(dMatch < 1e-8, `${k} perm=${perm} swapped treeSeg vs farTreeSeg mismatch: ${dMatch}`);
    }
  }

  // Verify Follow the tree draws all white halo segments before all amber segments (no white cap notches)
  const st3 = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2.0, tw: -0.45, thetas: defaultCommas('3333').map((s) => (s ? s.theta : 0)) };
  const mf = buildPatternModel(st3, { follow: { active: true, progress: 1, data: followTreeData(st3) } });
  const halos = [], ambers = [];
  mf.lines.forEach((ln, idx) => {
    if (!ln.once) return;
    if (ln.width === 5.0 && ln.color[0] === 1 && ln.color[1] === 1 && ln.color[2] === 1) halos.push(idx);
    if (ln.width === 3.0 && ln.color[0] > 0.8 && ln.color[2] < 0.1) ambers.push(idx);
  });
  assert.ok(halos.length > 0 && ambers.length === halos.length && Math.max(...halos) < Math.min(...ambers), 'follow cut halos precede amber strokes');
});

test('poincareArc matches hyperbolic geodesics to 1e-9 and shift-invariant hCache prevents rim popping', () => {
  const cx = 250, cy = 200, R = 180;
  const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
  const hypLerpH = (a, b, u) => {
    const d = GH.dist(a, b);
    if (d < 1e-3) return GH.norm([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    const e2 = Math.exp(-2 * d), invDen = 1 / (1 - e2);
    const wa = (Math.exp(-u * d) - Math.exp((u - 2) * d)) * invDen;
    const wb = (Math.exp(-(1 - u) * d) - Math.exp(-(1 + u) * d)) * invDen;
    return GH.norm([wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]]);
  };
  const checkGeodesic = (A, B, label) => {
    const [ax, ay] = toDisc(A), [bx, by] = toDisc(B);
    const arc = poincareArc(ax, ay, bx, by, cx, cy, R);
    assert.equal(arc.line, false, `${label} should be curved arc`);
    let da = arc.a2 - arc.a1;
    if (da > Math.PI) da -= TAU;
    else if (da < -Math.PI) da += TAU;
    assert.ok(Math.abs(da) < Math.PI, `${label} arc sweep >= PI: ${da}`);
    assert.equal(arc.ccw, da < 0, `${label} ccw mismatch`);
    for (const u of [0.25, 0.5, 0.75]) {
      const m = hypLerpH(A, B, u);
      const [mx, my] = toDisc(m);
      const sx = cx + R * mx, sy = cy - R * my;
      const err = Math.abs(Math.hypot(sx - arc.scx, sy - arc.scy) - arc.sr) / R;
      assert.ok(err < 1e-9, `${label} u=${u} radial err=${err}`);
      const am = Math.atan2(sy - arc.scy, sx - arc.scx);
      let dm = am - arc.a1;
      if (dm > Math.PI) dm -= TAU;
      else if (dm < -Math.PI) dm += TAU;
      assert.ok(da > 0 ? (dm > 0 && dm < da) : (dm < 0 && dm > da), `${label} u=${u} sweep outside arc: dm=${dm}, da=${da}`);
    }
  };

  // Curved edges & shifted tree/cut lines of #k=3333&m=0123&l=5&tw=-0.5 (including sr > 2000 near-diameter case)
  const st3333 = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 5, tw: -0.5, b: 0, tau: 0, thetas: defaultCommas('3333').map((s) => (s ? s.theta : 0)) };
  const m3333 = buildPatternModel(st3333);
  for (let i = 0; i < m3333.D.n; i++) {
    const A = m3333.D.verts[i], B = m3333.D.verts[(i + 1) % m3333.D.n];
    const [ax, ay] = toDisc(A), [bx, by] = toDisc(B);
    if (Math.abs(ax * by - ay * bx) > 1e-4) checkGeodesic(A, B, `3333 edge ${i}`);
  }
  const Tshift = GH.translate([0, 0, 1], GH.norm([0, Math.sinh(0.08), Math.cosh(0.08)]));
  m3333.lines.forEach((ln, idx) => checkGeodesic(apply(Tshift, ln.a), apply(Tshift, ln.b), `3333 shifted line ${idx}`));

  // Diameter through origin & tiny < 1.5 px chord return { line: true }
  const diam = poincareArc(-0.5, -0.3, 0.5, 0.3, cx, cy, R);
  assert.equal(diam.line, true, 'diameter should be line');
  const tiny = poincareArc(0.2, 0.2, 0.2 + 0.5 / R, 0.2 + 0.5 / R, cx, cy, R);
  assert.equal(tiny.line, true, '< 1.5 px chord should be line');

  // Shift-invariant hCache check across tile crossings up to H_REBUILD_DRIFT (0.65)
  const stO33 = { k: 'o33', perm: [0, 2, 1, 3], orders: [0, 0, 3, 3], L: 5, tw: 0.2, b: 1.3, tau: 0.2, thetas: defaultCommas('o33').map((s) => (s ? s.theta : 0)) };
  for (const [label, st] of [['3333 L=5', st3333], ['o33 L=5', stO33]]) {
    const model = buildPatternModel(st);
    const { D, A } = model;
    const hMids = [];
    for (let i = 0; i < D.n; i++) {
      const a = D.verts[i], b = D.verts[(i + 1) % D.n], len = GH.dist(a, b);
      if (len > 2.0) {
        const k = Math.ceil(len / 2.0);
        for (let s = 1; s < k; s++) hMids.push(hypLerpH(a, b, s / k));
      }
    }
    const cached = tilesPSU(D, A, { focus: [0, 0], radius: 5.9, max: 4200 });
    const cacheSet = cached.map((t) => toDisc(apply(t.M, D.at)));
    const hasTileAt = (w) => cacheSet.some((q) => discDist(w, q) < 1e-4);

    // Drag in small steps across tile edges summing to 0.58 hyperbolic units (< 0.65 H_REBUILD_DRIFT)
    let vPsu = psuI(), shift = psuI();
    const stepT = so21ToPSU(GH.translate([0, 0, 1], GH.norm([Math.sinh(0.115) * 0.8, Math.sinh(0.115) * 0.6, Math.cosh(0.115)])), false);
    for (let s = 0; s < 5; s++) {
      vPsu = psuMul(stepT, vPsu);
      const focus = psuApplyDisc(psuInv(vPsu), [0, 0]);
      const { g } = locateTilePSU(D, A, focus);
      vPsu = psuMul(vPsu, g);
      shift = psuMul(psuInv(g), shift);
    }
    const vEff = psuMul(vPsu, shift);
    const focusInCache = psuApplyDisc(psuInv(vEff), [0, 0]);
    const drift = discDist(focusInCache, [0, 0]);
    assert.ok(drift < 0.65 && drift > 0.5, `${label} drift=${drift}`);

    // Enumerate world tiles around shifted center up to 5.4 and assert every live minZ <= cosh(5.2) tile is already cached
    const worldFresh = tilesPSU(D, A, { focus: focusInCache, radius: 5.4, max: 4200 });
    const cullZ = Math.cosh(5.2);
    for (const wt of worldFresh) {
      const M = psuToSO21(psuMul(vEff, wt.g));
      let minZ = apply(M, D.at)[2];
      for (const v of D.verts) minZ = Math.min(minZ, apply(M, v)[2]);
      for (const s of hMids) minZ = Math.min(minZ, apply(M, s)[2]);
      if (minZ <= cullZ) {
        const wAt = psuApplyDisc(wt.g, toDisc(D.at));
        assert.ok(hasTileAt(wAt), `${label} visible tile minZ=${minZ.toFixed(2)} missing from r=5.9 hCache at drift=${drift.toFixed(3)}`);
      }
    }
  }
});

test('Intrinsic geodesics stay continuous across tw=0 and drag+slider keeps Follow overlay aligned (tileEdges: false)', () => {
  const toD = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];

  // 1. Every family sets tileEdges: false
  for (const k of Object.keys(FAMILIES)) {
    const f = FAMILIES[k];
    const perm = f.defaultM.split('').map(Number);
    const st = {
      k, perm, orders: perm.map((c) => f.baseOrders[c]),
      L: f.defaultL, tw: f.defaultTw, b: f.defaultB ?? 0, tau: f.defaultTau ?? 0,
      thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
    };
    const m = buildPatternModel(st);
    assert.equal(m.tileEdges, false, `${k} expected tileEdges: false`);
  }

  // 2. Intrinsic tiled lines (treeSeg, farTreeSeg, cutSeg, extraLines) are continuous across tw=-0.0002 vs +0.0002 and tw=0 vs +0.0079
  const checks = [
    ['3333', [0, 1, 2, 3], 1.5, -0.0002, 0.0002],
    ['3333', [0, 1, 2, 3], 0.8, 0, 0.0079],
    ['2223', [0, 1, 2, 3], 1.5, -0.0002, 0.0002],
    ['333*', [0, 1, 2, 3], 1.5, -0.0002, 0.0002],
    ['333*3', [0, 1, 2, 3], 1.5, -0.0002, 0.0002],
    ['333x', [0, 1, 2, 3], 1.5, -0.0002, 0.0002],
    ['o33', [0, 2, 1, 3], 1.5, -0.0002, 0.0002],
    ['o33', [0, 1, 2, 3], 1.5, -0.0002, 0.0002],
  ];
  for (const [k, perm, L, twA, twB] of checks) {
    const f = FAMILIES[k];
    const mk = (tw) => buildPatternModel({
      k, perm, orders: perm.map((c) => f.baseOrders[c]), L, tw,
      b: f.defaultB ?? 0, tau: f.defaultTau ?? 0,
      thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
    });
    const collectMids = (m) => {
      const ts = tilesPSU(m.D, m.A, { focus: [0, 0], radius: 3.5, max: 1200 });
      const out = [];
      for (const t of ts) {
        for (const ln of m.lines) {
          if (ln.once) continue;
          const a = apply(t.M, ln.a), b = apply(t.M, ln.b);
          const mid = toD(GH.mix(a, b, 0.5));
          if (Math.hypot(mid[0], mid[1]) < 0.7) out.push(mid);
        }
      }
      return out;
    };
    const aMids = collectMids(mk(twA)), bMids = collectMids(mk(twB));
    assert.equal(aMids.length, bMids.length, `${k} L=${L} line count changed (${aMids.length} vs ${bMids.length})`);
    let worst = 0;
    for (const p of aMids) {
      let best = Infinity;
      for (const q of bMids) {
        const d = discDist(p, q);
        if (d < best) best = d;
      }
      if (best > worst) worst = best;
    }
    assert.ok(worst < 0.015, `${k} L=${L} ${twA}..${twB} intrinsic line jumped: worstMidShift=${worst}`);
  }

  // 3. After dragging across the cut and moving (L, tw), recentering vWorld = psuMul(vPsu, bPsu) keeps Follow overlay aligned to < 1e-9
  const st0 = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 0.8, tw: 0, b: 0, tau: 0, thetas: defaultCommas('3333').map((s) => (s ? s.theta : 0)) };
  const m0 = buildPatternModel(st0);
  const Tdrag = so21ToPSU(GH.translate([0, 0, 1], GH.norm([Math.sinh(3.5) * 0.5, -Math.sinh(3.5) * 0.866, Math.cosh(3.5)])), false);
  const loc0 = locateTilePSU(m0.D, m0.A, psuApplyDisc(psuInv(Tdrag), [0, 0]));
  const vPsu0 = psuMul(Tdrag, loc0.g);
  const bPsu0 = psuInv(loc0.g);
  const vWorld = psuMul(vPsu0, bPsu0);

  const st1 = { ...st0, L: 1.4, tw: 0.25 };
  const m1 = buildPatternModel(st1);
  const loc1 = locateTilePSU(m1.D, m1.A, psuApplyDisc(psuInv(vWorld), [0, 0]));
  const vPsu1 = psuMul(vWorld, loc1.g);
  const bPsu1 = psuInv(loc1.g);
  const overlayA = psuApplyDisc(psuMul(vPsu1, bPsu1), toD(m1.home[0]));
  const tiles1 = tilesPSU(m1.D, m1.A, { focus: psuApplyDisc(psuInv(vPsu1), [0, 0]), radius: 4.5, max: 2000 });
  let minErr = Infinity;
  for (const t of tiles1) {
    const q = psuApplyDisc(psuMul(vPsu1, t.g), toD(m1.home[0]));
    const d = discDist(overlayA, q);
    if (d < minErr) minErr = d;
  }
  assert.ok(minErr < 1e-9, `Follow overlay detached from tiled cone after drag+slider: ${minErr}`);
});

test('followTreeData cutPts reaches ends across all families and keepView clears stale bPsu even when |vWorld| >= 150', () => {
  const toD = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];

  // 1. All 7 families: followTreeData.cutPts aligns with cutSeg and reaches ends (±9 on hyperbolic)
  for (const k of Object.keys(FAMILIES)) {
    const f = FAMILIES[k];
    const perms = [f.defaultM.split('').map(Number)];
    if (k === 'o33' || k === '333*' || k === '333*3' || k === '333x') perms.push([0, 2, 1, 3], [2, 3, 0, 1]);
    for (const perm of perms) {
      for (const [L, tw] of [[f.defaultL, 0.0079], [f.kind === 'E' ? 0.5 : 0.6, -0.25]]) {
        const st = {
          k, perm, orders: perm.map((c) => f.baseOrders[c]),
          L, tw, b: f.defaultB ?? 0, tau: f.defaultTau ?? 0,
          thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
        };
        const fd = followTreeData(st);
        const m = buildPatternModel(st, { follow: { active: true, progress: 1, data: fd } });
        const cutLine = m.lines.find((ln) => ln.dash && !ln.once);
        if (f.kind === 'H') {
          assert.ok(discDist(toD(fd.cutPts[0]), toD(fd.ends[0])) < 1e-12, `${k} cutPts[0] != ends[0]`);
          assert.ok(discDist(toD(fd.cutPts[fd.cutPts.length - 1]), toD(fd.ends[1])) < 1e-12, `${k} cutPts.at(-1) != ends[1]`);
          fd.cutPts.forEach((p, idx) => {
            // Float64 GH.lineDist rounding scales with Lorentz z (~1e-14 * p[2]); stay < 1e-11 near center.
            const tol = Math.max(1e-11, p[2] * 3e-14);
            assert.ok(GH.lineDist(p, cutLine.a, cutLine.b) < tol, `${k} cutPts[${idx}] off cutSeg`);
          });
        } else {
          assert.ok(Math.abs(fd.cutPts[0][1] - cutLine.a[1]) < 1e-12);
          assert.ok(Math.abs(fd.cutPts[1][1] - cutLine.b[1]) < 1e-12);
          assert.ok(fd.cutPts[0][0] <= -12 && fd.cutPts[1][0] >= 12);
        }
      }
    }
  }

  // 2. createPattern keepView tests: stub minimal canvas + Path2D + window in finally block
  const prevWin = globalThis.window;
  const prevPath2D = globalThis.Path2D;
  const noop = () => {};
  const stubCtx = {
    setTransform: noop, clearRect: noop, save: noop, restore: noop,
    beginPath: noop, arc: noop, clip: noop, fillRect: noop, fill: noop,
    stroke: noop, setLineDash: noop, moveTo: noop, lineTo: noop,
  };
  const stubCanvas = {
    width: 500, height: 500,
    getContext: () => stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }),
    addEventListener: noop,
  };
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} arc() {} };
  try {
    const P = createPattern(stubCanvas);
    const st08 = {
      k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3],
      L: 0.8, tw: 0.0079, b: 0, tau: 0,
      thetas: defaultCommas('3333').map((s) => (s ? s.theta : 0)),
    };
    const m08 = buildPatternModel(st08);
    const st06 = { ...st08, L: 0.6 };
    const m06 = buildPatternModel(st06);
    const fd06 = followTreeData(st06);

    const assertAlignedWithTiles = (m, stFd, view, tag) => {
      const M_once = mul(view.V, view.base);
      const vPsu = so21ToPSU(view.V, false);
      const ts = tilesPSU(m.D, m.A, { focus: psuApplyDisc(psuInv(vPsu), [0, 0]), radius: 4.5, max: 2000 });
      const overlayCone = toD(apply(M_once, m.home[0]));
      let bestConeErr = Infinity;
      for (const t of ts) {
        const d = discDist(overlayCone, toD(apply(mul(view.V, t.M), m.home[0])));
        if (d < bestConeErr) bestConeErr = d;
      }
      assert.ok(bestConeErr < 1e-9, `${tag} cone alignment err=${bestConeErr}`);

      const cutLine = m.lines.find((ln) => ln.dash && !ln.once);
      const fMid = apply(M_once, stFd.feet[1]);
      let bestCutDist = Infinity;
      for (const t of ts) {
        const Mt = psuToSO21(psuMul(vPsu, t.g));
        const d = GH.lineDist(fMid, apply(Mt, cutLine.a), apply(Mt, cutLine.b));
        if (d < bestCutDist) bestCutDist = d;
      }
      assert.ok(bestCutDist < 1e-9, `${tag} cutSeg alignment dist=${bestCutDist}`);
    };

    // Case A: single neighbor-tile step (edge 4 at L=0.80) -> L=0.60 keepView
    P.set(m08);
    const gEdge4 = m08.A.maps[4];
    P.setView({ V: mul(GH.translate([0, 0, 1], GH.polar(0.7, 0.2)), gEdge4), base: inv(gEdge4), turned: false }, { sync: true });
    P.set(buildPatternModel(st06, { follow: { active: true, progress: 1, data: fd06 } }), { keepView: true });
    assertAlignedWithTiles(m06, fd06, P.getView(), 'edge4 L=0.8->0.6');

    // Case B: overflow |vWorld| >= 150 (|bPsu| ~ 100, |vPsu| ~ 1.3) -> stale bPsu MUST be cleared
    const farTile = tilesPSU(m08.D, m08.A, { focus: [0, 0], radius: 10.5, max: 6000 })
      .find((t) => Math.hypot(t.g[0], t.g[1]) > 100 && Math.hypot(t.g[0], t.g[1]) < 145);
    assert.ok(farTile, 'expected tile with 100 < |g| < 145');
    let vOverflow = so21ToPSU(GH.translate(GH.polar(1.5, 0), GH.origin), false);
    for (let th = 0; th < TAU; th += 0.3) {
      const cand = so21ToPSU(GH.translate(GH.polar(1.5, th), GH.origin), false);
      const vw = psuMul(cand, farTile.g);
      if (Math.hypot(vw[0], vw[1]) > 180) { vOverflow = cand; break; }
    }
    P.set(m08);
    P.setView({ V: psuToSO21(vOverflow), base: psuToSO21(farTile.g), turned: false }, { sync: true });
    P.set(buildPatternModel(st06, { follow: { active: true, progress: 1, data: fd06 } }), { keepView: true });
    const vAfterOverflow = P.getView();
    assert.ok(vAfterOverflow.base[8] < 100, `stale bPsu survived overflow: base[8]=${vAfterOverflow.base[8]}`);
    assertAlignedWithTiles(m06, fd06, vAfterOverflow, 'overflow |vWorld|>=150');

    // Case C: identity base with shifted V (L=0.80 -> L=2.5) recenters V and stays aligned
    const st25 = { ...st08, L: 2.5 };
    const m25 = buildPatternModel(st25);
    const fd25 = followTreeData(st25);
    P.set(m08);
    P.setView({ V: GH.translate([0, 0, 1], GH.polar(1.4, -0.7)), base: I3.slice(), turned: false }, { sync: true });
    P.set(buildPatternModel(st25, { follow: { active: true, progress: 1, data: fd25 } }), { keepView: true });
    assertAlignedWithTiles(m25, fd25, P.getView(), 'identity-base L=0.8->2.5');
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});

test('Rigid cone markRefs prevent orientation jumps across tw=0, match at tw=+-0.5, stay invariant under recut, and highlight 333x cone', () => {
  const toD = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
  const angDeg = (G, p, u) => {
    const dx = G.kind === 'H' ? u[0] * (1 + p[2]) - p[0] * u[2] : u[0];
    const dy = G.kind === 'H' ? u[1] * (1 + p[2]) - p[1] * u[2] : u[1];
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  const modDiffDeg = (a, b, period) => {
    let d = (((b - a) % period) + period) % period;
    return d > period / 2 ? period - d : d;
  };

  // 1. Every interior cone class across all 7 families has markRefs, and 333x picked cones are included in m.marks
  for (const k of Object.keys(FAMILIES)) {
    const f = FAMILIES[k];
    const perms = [f.defaultM.split('').map(Number)];
    if (k === '2223') perms.push([3, 0, 1, 2], [0, 3, 1, 2]);
    if (k === 'o33' || k === '333*' || k === '333*3' || k === '333x') perms.push([0, 2, 1, 3], [2, 3, 0, 1]);
    for (const perm of perms) {
      for (const tw of [-0.5, -0.0051, 0.01, 0.5]) {
        const st = {
          k, perm, orders: perm.map((c) => f.baseOrders[c]),
          L: f.kind === 'E' ? 1.2 : 1.6, tw,
          b: f.defaultB ?? 0, tau: f.defaultTau ?? 0,
          thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
        };
        const m = buildPatternModel(st);
        const coneClasses = m.A.classes.filter((c) => c.kind === 'cone' && c.n > 1);
        for (const c of coneClasses) {
          assert.ok(m.markRefs && m.markRefs[c.id], `${k} m=${perm.join('')} tw=${tw} missing markRefs[${c.id}]`);
          const v = m.markRefs[c.id].v;
          assert.equal(m.A.cls[v], c.id, `${k} markRefs[${c.id}].v wrong class`);
        }
        for (const slot of [0, 1]) {
          if (f.baseOrders[perm[slot]] > 1) {
            const G = f.kind === 'E' ? GE : GH;
            const cid = coneClasses.find((c) => c.verts.some((vi) => G.dist(m.home[slot], m.D.verts[vi]) < 1e-6))?.id;
            assert.ok(cid !== undefined && m.marks.includes(cid), `${k} m=${perm.join('')} picked cone class ${cid} missing from marks`);
          }
        }
      }
    }
  }

  // 2. Orientation continuity across tw=0 and periodicity across tw=+-0.5
  const sweepCases = [
    ['2223', [3, 0, 1, 2], 1.6],
    ['3333', [0, 1, 2, 3], 1.6],
    ['333*', [0, 1, 2, 3], 1.6],
    ['333*', [2, 3, 0, 1], 1.6],
    ['333*3', [0, 1, 2, 3], 1.6],
    ['333*3', [2, 3, 0, 1], 1.6],
    ['333x', [0, 1, 2, 3], 1.6],
    ['333x', [2, 3, 0, 1], 1.6],
    ['o33', [0, 2, 1, 3], 1.6],
    ['o33', [2, 3, 0, 1], 1.6],
    ['2222', [0, 1, 2, 3], 1.2],
  ];
  for (const [k, perm, L] of sweepCases) {
    const f = FAMILIES[k];
    const G = f.kind === 'E' ? GE : GH;
    const mk = (tw) => buildPatternModel({
      k, perm, orders: perm.map((c) => f.baseOrders[c]),
      L, tw, b: f.defaultB ?? 0, tau: f.defaultTau ?? 0,
      thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
    });

    const collectMarks = (m) => {
      const ts = f.kind === 'H'
        ? tilesPSU(m.D, m.A, { focus: [0, 0], radius: 2.2, max: 500 })
        : [{ M: I3.slice() }];
      const out = [];
      for (const t of ts) {
        for (const c of m.A.classes) {
          const ref = m.markRefs && m.markRefs[c.id];
          if (!ref) continue;
          const p = apply(t.M, m.D.verts[ref.v]);
          const u = apply(t.M, ref.dir);
          if (f.kind === 'H' && Math.hypot(...toD(p)) > 0.72) continue;
          out.push({ n: c.n, pos: p, ang: angDeg(G, p, u) });
        }
      }
      return out;
    };

    // (a) Stationary picked cones stay fixed across tw = -0.0051 vs +0.010 and tw = -0.5 vs +0.5
    const mNeg = mk(-0.0051), mPos = mk(0.01);
    const mHalfNeg = mk(-0.5), mHalfPos = mk(0.5);
    for (const slot of [0, 1]) {
      const feat = perm[slot];
      const ord = f.baseOrders[feat];
      if (ord <= 1) continue;
      const refAngleOf = (m) => {
        const cid = Object.keys(m.markRefs).find((id) => G.dist(m.D.verts[m.markRefs[id].v], m.home[slot]) < 1e-6);
        const ref = m.markRefs[cid];
        return angDeg(G, m.D.verts[ref.v], ref.dir);
      };
      assert.ok(modDiffDeg(refAngleOf(mNeg), refAngleOf(mPos), 360 / ord) < 1e-9, `${k} m=${perm.join('')} slot=${slot} rotated across tw`);
      assert.ok(modDiffDeg(refAngleOf(mHalfNeg), refAngleOf(mHalfPos), 360 / ord) < 1e-9, `${k} m=${perm.join('')} slot=${slot} rotated across tw=+-0.5`);
    }

    // (b) All nearby tiled cone marks vary continuously across tw=0 (< 0.5 deg) and match at tw=+-0.5 (< 1e-6 deg)
    const zeroA = collectMarks(mk(-0.0005)), zeroB = collectMarks(mk(0.0005));
    for (const a of zeroA) {
      const best = zeroB.filter((b) => b.n === a.n).reduce((acc, b) => {
        const d = G.dist(a.pos, b.pos);
        return d < acc.d ? { d, b } : acc;
      }, { d: Infinity, b: null });
      if (best.b && best.d < 0.05) {
        const da = modDiffDeg(a.ang, best.b.ang, 360 / a.n);
        assert.ok(da < 0.5, `${k} m=${perm.join('')} jumped ${da.toFixed(2)} deg across tw=0`);
      }
    }
    const halfA = collectMarks(mHalfNeg), halfB = collectMarks(mHalfPos);
    for (const a of halfA) {
      const best = halfB.filter((b) => b.n === a.n).reduce((acc, b) => {
        const d = G.dist(a.pos, b.pos);
        return d < acc.d ? { d, b } : acc;
      }, { d: Infinity, b: null });
      if (best.b && best.d < 1e-5) {
        const da = modDiffDeg(a.ang, best.b.ang, 360 / a.n);
        assert.ok(da < 1e-6, `${k} m=${perm.join('')} jumped ${da.toFixed(6)} deg between tw=-0.5 and +0.5`);
      }
    }
  }

  // 3. All 6 recut pair picks on all 7 families preserve markRefs cone orientation (< 1e-6 deg)
  for (const k of Object.keys(FAMILIES)) {
    const f = FAMILIES[k];
    const G = f.kind === 'E' ? GE : GH;
    const perm0 = f.defaultM.split('').map(Number);
    const st0 = {
      k, perm: perm0, orders: perm0.map((c) => f.baseOrders[c]),
      L: f.defaultL, tw: f.defaultTw, b: f.defaultB ?? 0, tau: f.defaultTau ?? 0,
      thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
    };
    const m0 = buildPatternModel(st0);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const r = recut(st0, i, j);
        const m1 = buildPatternModel(r);
        const ts1 = f.kind === 'H'
          ? tilesPSU(m1.D, m1.A, { focus: [0, 0], radius: 5.5, max: 3000 })
          : tiles(m1.D, m1.A, { radius: 4, max: 200 });
        for (const cid of Object.keys(m0.markRefs)) {
          const ref0 = m0.markRefs[cid];
          const ord = m0.A.classes[cid].n;
          const qp = apply(r.Q, m0.D.verts[ref0.v]);
          const qu = apply(r.Q, ref0.dir);
          const ang0 = angDeg(G, qp, qu);
          let matched = 0;
          for (const t of ts1) {
            for (const cid1 of Object.keys(m1.markRefs)) {
              if (m1.A.classes[cid1].n !== ord) continue;
              const ref1 = m1.markRefs[cid1];
              const p1 = apply(t.M, m1.D.verts[ref1.v]);
              if (G.dist(qp, p1) < 1e-5) {
                matched++;
                const u1 = apply(t.M, ref1.dir);
                const ang1 = angDeg(G, p1, u1);
                const da = modDiffDeg(ang0, ang1, 360 / ord);
                assert.ok(da < 1e-6, `${k} recut(${i},${j}) cone mark rotated by ${da} deg`);
              }
            }
          }
          assert.ok(matched >= 1, `${k} recut(${i},${j}) could not match cone mark in new tiling`);
        }
      }
    }
  }
});

test('333*3 Corner shift (tauC) keeps centering frame, cones, cuts, and mDist continuous across tc=0', () => {
  const angDeg = (p, u) => Math.atan2(-(u[1] * (1 + p[2]) - p[1] * u[2]), u[0] * (1 + p[2]) - p[0] * u[2]) * (180 / Math.PI);
  const lcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[1] * b[0] - a[0] * b[1]];
  const ldot = (a, b) => a[0] * b[0] + a[1] * b[1] - a[2] * b[2];
  const offH = (u, h, s) => [Math.sinh(u) * Math.cosh(h), s * Math.sinh(h), Math.cosh(u) * Math.cosh(h)];
  const segDistToX = (P, Q) => {
    const dP = Math.abs(Math.asinh(P[1])), dQ = Math.abs(Math.asinh(Q[1]));
    const nR = lcross(P, Q), nn = Math.sqrt(Math.max(1e-30, ldot(nR, nR)));
    const n = [nR[0] / nn, nR[1] / nn, nR[2] / nn];
    if (Math.abs(n[1]) > 1 + 1e-12 && Math.abs(n[0]) < Math.abs(n[2])) {
      const u = Math.atanh(n[0] / n[2]), m = Math.acosh(Math.abs(n[1]));
      const sgn = GH.mix(P, Q, 0.5)[1] >= 0 ? 1 : -1;
      const foot = offH(u, m, sgn);
      if (Math.abs(GH.dist(P, foot) + GH.dist(Q, foot) - GH.dist(P, Q)) < 1e-6) return m;
    }
    return Math.min(dP, dQ);
  };

  const tcs = [-0.5, -0.25, -0.0014, 0, 0.0014, 0.25, 0.5];
  const configs = [
    { L: 0.577, tw: 0.15, b: 1.4, perm: [0, 1, 2, 3] },
    { L: 0.577, tw: 0.15, b: 1.4, perm: [1, 0, 2, 3] },
    { L: 2.0, tw: 0.15, b: 1.4, perm: [0, 1, 2, 3] },
  ];

  for (const { L, tw, b, perm } of configs) {
    const featSlot = perm.indexOf(1);
    const thetas = defaultCommas('333*3').map((s) => (s ? s.theta : 0));
    const byTc = new Map();

    for (const tc of tcs) {
      const c = coneFeatCentered('333*3', L, tw, b, tc, { perm, thetas });
      const pm = pairMetricsFor({ k: '333*3', perm, L, tw, b, tau: tc });
      assert.ok(near(pm.d, c.d, 1e-12), `pairMetricsFor d mismatch at tc=${tc}`);
      assert.ok(near(pm.mDist, c.mDist, 1e-12), `pairMetricsFor mDist mismatch at tc=${tc}`);
      byTc.set(tc, c);
    }

    const ref = byTc.get(0);
    const coneSlots = [0, 1, 2, 3].filter((s) => perm[s] !== 1);
    const coneCids = Object.keys(ref.markRefs).filter((id) => ref.A.classes[id].n === 3);
    assert.equal(coneCids.length, 3);

    for (const tc of tcs) {
      const c = byTc.get(tc);
      for (let i = 0; i < 4; i++) {
        assert.ok(Math.abs(c.P_psu[i] - ref.P_psu[i]) < 1e-12, `L=${L} perm=${perm} tc=${tc} P_psu[${i}] shifted`);
      }
      assert.equal(c.P_psu[4], ref.P_psu[4]);
      for (const slot of coneSlots) {
        assert.ok(GH.dist(c.home[slot], ref.home[slot]) < 1e-12, `L=${L} perm=${perm} tc=${tc} cone slot=${slot} moved`);
      }
      for (let k = 0; k < 2; k++) {
        assert.ok(GH.dist(c.cutSeg[k], ref.cutSeg[k]) < 1e-12, `L=${L} perm=${perm} tc=${tc} cutSeg[${k}] moved`);
      }
      assert.equal(c.shapes.length, ref.shapes.length);
      for (let si = 0; si < ref.shapes.length; si++) {
        assert.equal(c.shapes[si].pts.length, ref.shapes[si].pts.length);
        for (let pi = 0; pi < ref.shapes[si].pts.length; pi++) {
          assert.ok(GH.dist(c.shapes[si].pts[pi], ref.shapes[si].pts[pi]) < 1e-12, `L=${L} tc=${tc} comma moved`);
        }
      }
      for (const cid of coneCids) {
        const ra = ref.markRefs[cid], rb = c.markRefs[cid];
        assert.ok(GH.dist(ref.D.verts[ra.v], c.D.verts[rb.v]) < 1e-12);
        assert.ok(Math.abs(angDeg(ref.D.verts[ra.v], ra.dir) - angDeg(c.D.verts[rb.v], rb.dir)) < 1e-10);
      }
    }

    // Continuity & even symmetry of d and mDist across tc=0
    const negSm = byTc.get(-0.0014), zero = byTc.get(0), posSm = byTc.get(0.0014);
    assert.ok(Math.abs(negSm.d - posSm.d) < 1e-11 && Math.abs(zero.d - posSm.d) < 1e-3);
    assert.ok(Math.abs(negSm.mDist - posSm.mDist) < 1e-11 && Math.abs(zero.mDist - posSm.mDist) < 1e-3);
    for (const tc of [0.0014, 0.25, 0.5]) {
      const a = byTc.get(-tc), bC = byTc.get(tc);
      assert.ok(near(a.d, bC.d, 1e-11), `L=${L} d(-${tc}) vs d(+${tc})`);
      assert.ok(near(a.mDist, bC.mDist, 1e-11), `L=${L} mDist(-${tc}) vs mDist(+${tc})`);
    }

    // mDist matches full cut-orbit minimum distance at tc=-0.25, -0.0014, +0.0014
    for (const tc of [-0.25, -0.0014, 0.0014]) {
      const c = byTc.get(tc);
      const ts = tilesPSU(c.D, c.A, { focus: [0, 0], radius: 6.0, max: 1500 });
      let bestOrb = Infinity;
      for (const t of ts) {
        const ca = apply(t.M, c.cutSeg[0]), cb = apply(t.M, c.cutSeg[1]);
        const qA = apply(invH(GH.frame(ca, cb)), c.home[0]);
        const qB = apply(invH(GH.frame(ca, cb)), c.home[1]);
        bestOrb = qA[1] * qB[1] > 0 ? Math.min(bestOrb, segDistToX(qA, qB)) : 0;
      }
      assert.ok(near(c.mDist, bestOrb, 1e-7), `L=${L} perm=${perm} tc=${tc} mDist=${c.mDist} vs orbit=${bestOrb}`);
    }

    // Frame anchor matches exact footFeat at tc = +-0.5 (home[featSlot] lies on y = 0)
    for (const tc of [-0.5, 0.5]) {
      const y = Math.asinh(byTc.get(tc).home[featSlot][1]);
      assert.ok(Math.abs(y) < 1e-10, `L=${L} perm=${perm} tc=${tc} expected home[${featSlot}] on y=0, got ${y}`);
    }

    // Mirror corner crR (D.verts[1]) glides smoothly across y = 0 at tc = 0
    const yNeg = Math.asinh(negSm.D.verts[1][1]);
    const yZero = Math.asinh(zero.D.verts[1][1]);
    const yPos = Math.asinh(posSm.D.verts[1][1]);
    assert.ok(Math.abs(yZero) < 1e-12, `L=${L} perm=${perm} crR y at tc=0: ${yZero}`);
    assert.ok(yNeg * yPos < 0 && Math.abs(yPos - yNeg) < 0.02, `L=${L} perm=${perm} crR jumped across tc=0: ${yNeg} -> ${yPos}`);
  }
});

test('Default parameters of all 7 families match classification-of-surfaces canonical domains and stay inside slider bounds', () => {
  const builtins = ['3333', '2223', '333*', '333*3', '333x', 'o33', '2222'];
  const collectPts = (D, A, ts, rMax, includeCorners) => {
    const pts = [];
    for (const cid of A.cones) {
      const cls = A.classes[cid], v0 = D.verts[cls.verts[0]];
      for (const t of ts) { const p = apply(t.M, v0); if (GH.dist(GH.origin, p) < rMax) pts.push({ kind: 'cone', n: cls.n, p }); }
    }
    if (includeCorners) {
      for (const st of A.stars) for (const cid of st.corners) {
        const cls = A.classes[cid], v0 = D.verts[cls.verts[0]];
        for (const t of ts) { const p = apply(t.M, v0); if (GH.dist(GH.origin, p) < rMax) pts.push({ kind: 'corner', n: cls.n, p }); }
      }
    }
    const uniq = [];
    for (const item of pts) {
      if (!uniq.some((u) => u.kind === item.kind && u.n === item.n && GH.dist(u.p, item.p) < 1e-4)) uniq.push(item);
    }
    return uniq;
  };

  for (const k of builtins) {
    const f = FAMILIES[k];
    assert.ok(f.defaultL >= f.baseRange[0] - 1e-12 && f.defaultL <= f.baseRange[1] + 1e-12, `${k} defaultL=${f.defaultL} outside baseRange`);
    assert.ok(f.defaultTw >= -0.5 && f.defaultTw <= 0.5, `${k} defaultTw=${f.defaultTw} out of range`);
    if (f.bRange) assert.ok(f.defaultB >= f.bRange[0] - 1e-12 && f.defaultB <= f.bRange[1] + 1e-12, `${k} defaultB=${f.defaultB} outside bRange`);
    if (f.tauLabel) assert.ok(f.defaultTau >= -0.5 && f.defaultTau <= 0.5, `${k} defaultTau=${f.defaultTau} out of range`);

    if (k === '2222') {
      assert.equal(f.defaultL, 1);
      assert.equal(f.defaultTw, 0);
      continue;
    }

    const perm = f.defaultM.split('').map(Number);
    const m = buildPatternModel({
      k, perm, orders: perm.map((c) => f.baseOrders[c]),
      L: f.defaultL, tw: f.defaultTw, b: f.defaultB ?? 0, tau: f.defaultTau ?? 0,
      thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)),
    });
    const D_ref = domainOf(parse(k)), A_ref = analyse(D_ref);
    const tsRef = tilesPSU(D_ref, A_ref, { focus: [0, 0], radius: 7.5, max: 4000 });
    const tsOur = tilesPSU(m.D, m.A, { focus: [0, 0], radius: 6.5, max: 2500 });
    const withCorners = k === '333*3';
    const cRef = collectPts(D_ref, A_ref, tsRef, 7.0, withCorners);
    const cOur = collectPts(m.D, m.A, tsOur, 5.2, withCorners);
    cOur.sort((a, b) => GH.dist(GH.origin, a.p) - GH.dist(GH.origin, b.p));
    const a0 = cOur.find((p) => p.kind === 'cone');
    const a1 = cOur.find((p) => p !== a0 && p.kind === 'cone');
    const d01 = GH.dist(a0.p, a1.p);
    const revs = (k === '333*3' || k === 'o33') ? [false] : [false, true];

    let bestErr = Infinity;
    for (const b0 of cRef) {
      if (b0.kind !== a0.kind || b0.n !== a0.n || GH.dist(GH.origin, b0.p) > 3.2) continue;
      for (const b1 of cRef) {
        if (b1.kind !== a1.kind || b1.n !== a1.n || Math.abs(GH.dist(b0.p, b1.p) - d01) > 1e-3) continue;
        for (const rev of revs) {
          const M = GH.fit(a0.p, a1.p, b0.p, b1.p, rev);
          let worst = 0;
          for (const x of cOur) {
            if (GH.dist(a0.p, x.p) > 4.2) continue;
            const q = apply(M, x.p);
            let mn = Infinity;
            for (const y of cRef) {
              if (y.kind === x.kind && y.n === x.n) {
                const d = GH.dist(q, y.p);
                if (d < mn) mn = d;
              }
            }
            if (mn > worst) worst = mn;
          }
          if (worst < bestErr) bestErr = worst;
        }
      }
    }
    const tol = (k === '3333' || k === '2223') ? 1e-11 : 1e-4;
    assert.ok(bestErr < tol, `${k} defaults did not match classification-of-surfaces (err=${bestErr} >= ${tol})`);
  }
});

test('cone-star3 Follow the tree walks along treeSeg and mirror wall with zero stray corner chord', () => {
  const applyM = (M, v) => apply(M, v);
  const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];

  const cases = [
    { kStr: '234*5', L: 3.221, tw: 0.3276, b: 2.21, tc: 0.0139, perm: [0, 1, 2, 3] },
    { kStr: '234*5', L: 3.221, tw: 0.3276, b: 2.21, tc: 0.0139, perm: [1, 2, 0, 3] },
    { kStr: '234*5', L: 3.221, tw: 0.3276, b: 2.21, tc: 0.0139, perm: [1, 3, 0, 2] },
    { kStr: '957*9', L: 4.1, tw: -0.22, b: 1.7, tc: -0.35, perm: [0, 1, 2, 3] },
    { kStr: '259*4', L: 1.5, tw: 0.41, b: 0.9, tc: 0.42, perm: [1, 2, 0, 3] },
    { kStr: '222*2', L: 2.4, tw: -0.15, b: 1.1, tc: 0.18, perm: [0, 1, 2, 3] },
  ];
  for (const tc of [-0.5, -0.45, -0.01, 0, 0.0139, 0.269, 0.45, 0.5]) {
    cases.push({ kStr: '333*3', L: 3.221, tw: 0.0614, b: 2.512, tc, perm: [0, 1, 2, 3] });
  }

  for (const { kStr, L, tw, b, tc, perm } of cases) {
    const k = normalizeFamilyKey(kStr);
    const fam = FAMILIES[k];
    const orders = perm.map((c) => fam.baseOrders[c]);
    const st = { k, perm, orders, L, tw, b, tau: tc, thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)) };
    const c = coneFeatCentered(k, L, tw, b, tc, { perm });
    const fd = followTreeData(st);
    const toPair = (v) => GH.norm(applyM(c.Pmat, v));
    const { cut } = c;
    const invTF = invH(cut.TF);

    assert.ok(fd.fwdSegs.length >= 6 && fd.backSegs.length >= 6 && fd.legs.length === 4, `${kStr} perm=${perm} tc=${tc}`);
    for (const seg of [...fd.fwdSegs, ...fd.backSegs]) {
      assert.ok(seg[0].every(Number.isFinite) && seg[1].every(Number.isFinite));
      assert.ok(GH.dist(seg[0], seg[1]) > 1e-6, `${kStr} degenerate segment`);
    }

    const AL = toPair(cut.A_L), AR = toPair(cut.A_R);
    const footR = toPair(cut.footFeat);
    const footL = toPair(applyM(invTF, cut.footFeat));
    const corner = toPair(cut.footCorner);

    // First segment in period 0 is exact TF^-1 tile copy of treeSeg [A_L -> footL]
    assert.ok(GH.dist(fd.fwdSegs[0][0], AL) < 1e-9 && GH.dist(fd.fwdSegs[0][1], footL) < 1e-9);
    assert.ok(Math.abs(GH.dist(fd.fwdSegs[0][0], fd.fwdSegs[0][1]) - cut.featDist) < 1e-9);

    // Period-0 walk reaches AR via [footR -> AR], matching treeSeg exactly
    const nPer = fd.fwdSegs.findIndex((s) => GH.dist(s[1], AR) < 1e-9);
    assert.ok(nPer === 2 || nPer === 3, `${kStr} tc=${tc}: unexpected period segments nPer=${nPer}`);
    assert.ok(GH.dist(fd.fwdSegs[nPer][0], footR) < 1e-9 && GH.dist(fd.fwdSegs[nPer][1], AR) < 1e-9);
    assert.ok(Math.abs(GH.dist(fd.fwdSegs[nPer][0], fd.fwdSegs[nPer][1]) - cut.featDist) < 1e-9);
    const treeMin = Math.min(
      GH.dist(fd.fwdSegs[nPer][0], c.treeSeg[0]) + GH.dist(fd.fwdSegs[nPer][1], c.treeSeg[1]),
      GH.dist(fd.fwdSegs[nPer][0], c.treeSeg[1]) + GH.dist(fd.fwdSegs[nPer][1], c.treeSeg[0]),
    );
    assert.ok(treeMin < 1e-9, `${kStr} treeSeg mismatch ${treeMin}`);

    // Mirror wall segment(s) pass through footCorner when split across two mirror copies and avoid polygon corner chord [A_R, crR]
    if (nPer === 3) {
      assert.ok(GH.dist(fd.fwdSegs[1][1], corner) < 1e-9 && GH.dist(fd.fwdSegs[2][0], corner) < 1e-9);
    }

    // Outgoing segment at AR leaves along sharpest-left tile copy R_AR^-1(footFeat) (collinear 180 deg at 2-cone)
    const nextTarget = toPair(applyM(invH(cut.R_AR), cut.footFeat));
    assert.ok(GH.dist(fd.fwdSegs[nPer + 1][0], AR) < 1e-9 && GH.dist(fd.fwdSegs[nPer + 1][1], nextTarget) < 1e-8);
    if (cut.ord.low === 2) {
      const a0 = toDisc(footR), aMid = toDisc(AR), a1 = toDisc(nextTarget);
      assert.ok(GH.dist(footR, AR) + GH.dist(AR, nextTarget) - GH.dist(footR, nextTarget) < 1e-8, `${kStr} 2-cone walk not collinear`);
      assert.ok(Math.hypot(a0[0] - aMid[0], a0[1] - aMid[1]) > 1e-3 && Math.hypot(a1[0] - aMid[0], a1[1] - aMid[1]) > 1e-3);
    }

    // Forward and backward walks converge to the isolating cut rim ends in Poincaré disc coords
    const df = toDisc(fd.fwdSegs[fd.fwdSegs.length - 1][1]), ef = toDisc(fd.ends[1]);
    const db = toDisc(fd.backSegs[fd.backSegs.length - 1][1]), eb = toDisc(fd.ends[0]);
    assert.ok(Math.hypot(df[0] - ef[0], df[1] - ef[1]) < 0.01 && Math.hypot(db[0] - eb[0], db[1] - eb[1]) < 0.01);
  }
});

test('Follow the tree aligns feet at tw=0 on cone-feat families and matches leg sets identically between tw=-0.5 and +0.5', () => {
  const segDist = (G, a, b) => Math.min(
    G.dist(a[0], b[0]) + G.dist(a[1], b[1]),
    G.dist(a[0], b[1]) + G.dist(a[1], b[0]),
  );

  const symCases = [
    { kStr: '3333', perm: [0, 1, 2, 3], L: 2.0, b: 0, tau: 0 },
    { kStr: '2223', perm: [0, 1, 2, 3], L: 1.6, b: 0, tau: 0 },
    { kStr: '333*', perm: [0, 1, 2, 3], L: 3.015, b: 1.534, tau: 0 },
    { kStr: '333*3', perm: [0, 1, 2, 3], L: 3.221, b: 2.512, tau: -0.2814 },
    { kStr: '333*3', perm: [2, 3, 0, 1], L: 3.221, b: 2.512, tau: -0.2814 },
    { kStr: '333x', perm: [0, 1, 2, 3], L: 3.215, b: 1.265, tau: 0 },
    { kStr: '234*5', perm: [0, 1, 2, 3], L: 3.221, b: 2.21, tau: 0.0139 },
    { kStr: 'o33', perm: [0, 2, 1, 3], L: 3.588, b: 2.039, tau: 0 },
    { kStr: '2222', perm: [0, 1, 2, 3], L: 1.3, b: 0, tau: 0 },
  ];

  for (const { kStr, perm, L, b, tau } of symCases) {
    const k = normalizeFamilyKey(kStr);
    const fam = FAMILIES[k];
    const G = fam.kind === 'E' ? GE : GH;
    const orders = perm.map((c) => fam.baseOrders[c]);
    const st = (tw) => ({ k, perm, orders, L, tw, b, tau, thetas: defaultCommas(k).map((s) => (s ? s.theta : 0)) });

    const fd0 = followTreeData(st(0));
    const fdM = followTreeData(st(-0.5));
    const fdP = followTreeData(st(0.5));

    assert.equal(fd0.legs.length, 4);
    assert.ok(fd0.extraLegs.length >= 8, `${kStr} perm=${perm} expected periodic extraLegs`);

    // 1. At tw = 0 black and yellow dots meet (dist = 0); at tw = +-0.5 they sit symmetrically +-L/2 (or +-ell on 2222) apart
    const expectedHalf = k === '2222' ? L : L / 2;
    assert.ok(G.dist(fd0.feet[0], fd0.feet[1]) < 1e-9, `${kStr} perm=${perm}: feet[0]!=feet[1] at tw=0`);
    assert.ok(Math.abs(G.dist(fdM.feet[0], fdM.feet[1]) - expectedHalf) < 1e-9, `${kStr} tw=-0.5 feetDist mismatch`);
    assert.ok(Math.abs(G.dist(fdP.feet[0], fdP.feet[1]) - expectedHalf) < 1e-9, `${kStr} tw=+0.5 feetDist mismatch`);

    // 2. Full drawn leg sets match primary legs identically between tw=-0.5 and tw=+0.5
    const allM = [...fdM.legs, ...fdM.extraLegs];
    const allP = [...fdP.legs, ...fdP.extraLegs];
    for (const lg of fdP.legs) {
      const best = Math.min(...allM.map((cand) => segDist(G, lg, cand)));
      assert.ok(best < 1e-8, `${kStr} perm=${perm}: +0.5 primary leg missing in -0.5 full leg set (err=${best})`);
    }
    for (const lg of fdM.legs) {
      const best = Math.min(...allP.map((cand) => segDist(G, lg, cand)));
      assert.ok(best < 1e-8, `${kStr} perm=${perm}: -0.5 primary leg missing in +0.5 full leg set (err=${best})`);
    }
  }

  // Also check o33 split {o+, o-} full leg set parity between tw=-0.5 and tw=+0.5
  const fdSplitM = followTreeData({ k: 'o33', perm: [0, 1, 2, 3], orders: [0, 0, 3, 3], L: 3.545, tw: -0.5, b: 2.039, tau: 0.153 });
  const fdSplitP = followTreeData({ k: 'o33', perm: [0, 1, 2, 3], orders: [0, 0, 3, 3], L: 3.545, tw: 0.5, b: 2.039, tau: 0.153 });
  for (const lg of fdSplitM.legs) {
    assert.ok(Math.min(...[...fdSplitP.legs, ...fdSplitP.extraLegs].map((c) => segDist(GH, lg, c))) < 1e-8);
  }
  for (const lg of fdSplitP.legs) {
    assert.ok(Math.min(...[...fdSplitM.legs, ...fdSplitM.extraLegs].map((c) => segDist(GH, lg, c))) < 1e-8);
  }
});
