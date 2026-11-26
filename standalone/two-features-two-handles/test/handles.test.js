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
  defaultCommas, buildPatternModel,
} from '../src/handles.js';
import { locateTilePSU, tilesPSU } from '../src/pattern-ext.js';
import { mul, apply, inv, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { signatureOf, tiles } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { buildSurface } from '../../2026-11-15-classification-of-surfaces/src/sym/surface.js';

const TAU = 2 * Math.PI;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const cDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

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
      const { loopSites } = sitesForBall(built, pair);
      assert.ok(built.layout.sites[loopSites[0]].toward.has(loopSites[1]), `loopSites ${loopSites} must be neighbours`);
      const loop = stadium(built.layout.sites[loopSites[0]].site.n, built.layout.sites[loopSites[1]].site.n, 1.014);
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
      const { loopSites } = sitesForBall(built, pair, k);
      assert.ok(built.layout.sites[loopSites[0]].toward.has(loopSites[1]), `${k} ${pair} must have adjacent loopSites`);
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
