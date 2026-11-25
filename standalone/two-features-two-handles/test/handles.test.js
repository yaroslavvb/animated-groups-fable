import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GH, GE, FAMILIES, normalizeFamilyKey,
  hgt, d0, pairDistance, pairLength, treeToCut,
  fourConeUHP, uhpToDisc, uhpToHyp, discToHyp, pairFrameUHP,
  fourConeCentered, coneFeatCentered, o33Centered, recut, recutH, pillowCentered, recut2222,
  followTreeData, interpolateView, stadium, handleBeltLoop, beadOnLoop, sitesForBall,
  surfacePartsFor, featureAnchorsForBall,
  defaultCommas, buildPatternModel,
} from '../src/handles.js';
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
