import test from 'node:test';
import assert from 'node:assert/strict';

import {
  D_BAL,
  ALL_GROUPINGS,
  GROUPING_BY_KEY,
  groupingKeyOfState,
  shortestGroupingPath,
  deltaOf,
  qMul,
  qInv,
  qNorm,
  qAct,
  qHalfTurn,
  qBoost,
  qRot0,
  ptOf,
  distH,
  mdot,
  createBalancedModel,
  buildWorldFrames,
  decomposeFrames,
  applyLocalFlip,
  availableLocalFlips,
  navigateToGrouping,
  getTwistTurn,
  scrubTwist,
  stepAnim,
  enumerateVisibleOrbit,
} from '../src/h22222.js';
import { DEPTH_ORDER, FEATURES, HYPERBOLIC_MOTIFS } from '../src/motifs.js';

function assertOrbitIdentical(orbitA, orbitB, rInterior = 3.2, tol = 1e-5) {
  let checked = 0;
  for (const lbl of DEPTH_ORDER) {
    const listA = orbitA.byLabel[lbl];
    const listB = orbitB.byLabel[lbl];
    for (const ca of listA) {
      if (Math.acosh(Math.max(1, ca.z)) > rInterior) continue;
      checked++;
      let best = null;
      let bestD = Infinity;
      for (const cb of listB) {
        const d = distH(ca.p, cb.p);
        if (d < bestD) {
          bestD = d;
          best = cb;
        }
      }
      assert.ok(best && bestD < tol, `Center ${lbl} jumped by ${bestD}`);
      // Verify 180-deg orientation agreement (|<uA, uB>| == 1)
      const uA = qAct(ca.F, [1, 0, 0]);
      const uB = qAct(best.F, [1, 0, 0]);
      const angErr = Math.acos(Math.min(1, Math.abs(mdot(uA, uB))));
      assert.ok(angErr < tol, `Orientation of ${lbl} spun by ${angErr}`);
    }
  }
  assert.ok(checked >= 25, `Expected at least 25 interior copies checked, got ${checked}`);
}

test('balanced 5-fold 22222 satisfies group relation and golden lengths', () => {
  const st = createBalancedModel();
  assert.equal(groupingKeyOfState(st), 'AB|E|CD');
  assert.ok(Math.abs(st.d1 - D_BAL) < 1e-10);
  assert.ok(Math.abs(st.d2 - D_BAL) < 1e-10);
  assert.ok(Math.abs(deltaOf(st.d1, st.d2) - D_BAL) < 1e-10);

  const { frames } = buildWorldFrames(st);
  const prod = frames.map((F) => qHalfTurn(ptOf(F))).reduce(qMul);
  const err = Math.hypot(Math.abs(prod.c) - 1, prod.w[0], prod.w[1], prod.w[2]);
  assert.ok(err < 1e-12, `R_0..R_4 product error = ${err}`);

  // All 5 balanced centers lie equidistant from the origin
  const radii = frames.map((F) => Math.acosh(Math.max(1, ptOf(F)[2])));
  for (const r of radii) {
    assert.ok(Math.abs(r - radii[0]) < 1e-10);
  }
});

test('all 15 groupings form a 4-regular graph of diameter 3 (line graph of Petersen)', () => {
  assert.equal(ALL_GROUPINGS.length, 15);
  let maxDist = 0;
  for (const g of ALL_GROUPINGS) {
    assert.equal(g.neighbors.length, 4, `${g.key} must have 4 local-flip neighbors`);
    for (const h of ALL_GROUPINGS) {
      const path = shortestGroupingPath(g.key, h.key);
      assert.equal(path[0], g.key);
      assert.equal(path[path.length - 1], h.key);
      for (let i = 1; i < path.length; i++) {
        assert.ok(GROUPING_BY_KEY[path[i - 1]].neighbors.includes(path[i]));
      }
      maxDist = Math.max(maxDist, path.length - 1);
    }
  }
  assert.equal(maxDist, 3);
});

test('all 4 direct local flips preserve Gamma, every center position, and 180-deg orientation', () => {
  let st = createBalancedModel({ autoBalance: false });
  scrubTwist(st, 0.31);
  st.activeRail = 1;
  scrubTwist(st, 0.19);

  const orbitBefore = enumerateVisibleOrbit(st, undefined, { rVis: 4.1 });
  const flips = availableLocalFlips(st);
  assert.equal(flips.length, 4);

  for (const fl of flips) {
    const next = applyLocalFlip(st, fl.railIdx, fl.keepIdx);
    assert.equal(groupingKeyOfState(next), fl.targetKey);
    const orbitAfter = enumerateVisibleOrbit(next, undefined, { rVis: 4.1 });
    assertOrbitIdentical(orbitBefore, orbitAfter, 3.0, 2e-5);
  }
});

test('navigateToGrouping reaches all 15 groupings via local flips with zero orbit jump', () => {
  let st = createBalancedModel({ autoBalance: false });
  scrubTwist(st, 0.27);
  const baseOrbit = enumerateVisibleOrbit(st, undefined, { rVis: 4.0 });

  for (const g of ALL_GROUPINGS) {
    const { state: dst, path } = navigateToGrouping(st, g.key);
    assert.equal(groupingKeyOfState(dst), g.key);
    assert.ok(path.length >= 1 && path.length <= 4);
    const dstOrbit = enumerateVisibleOrbit(dst, undefined, { rVis: 4.0 });
    assertOrbitIdentical(baseOrbit, dstOrbit, 2.8, 5e-5);
  }
});

test('twist is exactly periodic at u = 1.0 and swaps the twisting pair at u = 0.5', () => {
  const st0 = createBalancedModel({ activeRail: 0, autoBalance: false });
  const o0 = enumerateVisibleOrbit(st0, undefined, { rVis: 4.0 });

  const stHalf = createBalancedModel({ activeRail: 0, autoBalance: false });
  scrubTwist(stHalf, 0.5);
  const W0 = buildWorldFrames(st0).frames;
  const WH = buildWorldFrames(stHalf).frames;
  // Pair 2 (C, D) and Pivot (E) stay completely stationary during Rail 1 twist!
  for (const idx of [2, 3, 4]) {
    assert.ok(distH(ptOf(W0[idx]), ptOf(WH[idx])) < 1e-10, `Center ${idx} moved during Rail 1 twist`);
  }
  // At half-period u=0.5, the pair centers swap positions (A->B or B->A depending on rail dir)!
  const swapDist = Math.min(distH(ptOf(WH[0]), ptOf(W0[1])), distH(ptOf(WH[1]), ptOf(W0[0])));
  assert.ok(swapDist < 1e-10, `Pair centers should swap at u=0.5, got min dist ${swapDist}`);

  // At full period u -> 1 (i.e. t1 + 2*d1), entire orbit + orientations return identically!
  const stFull = createBalancedModel({ activeRail: 0, autoBalance: false });
  stFull.t1 += 2 * stFull.d1;
  const oFull = enumerateVisibleOrbit(stFull, undefined, { rVis: 4.0 });
  assertOrbitIdentical(o0, oFull, 3.0, 2e-5);
});

test('auto-balance gently relaxes skewed post-flip lengths back to golden D_BAL', () => {
  let st = createBalancedModel({ playing: true, autoBalance: true });
  // Flip onto a diagonal pair (d1 = arccosh(phi^2) ~ 1.617)
  const diagFlip = availableLocalFlips(st).find((f) => {
    const nxt = applyLocalFlip(st, f.railIdx, f.keepIdx);
    return Math.abs(nxt.d1 - D_BAL) > 0.2;
  });
  assert.ok(diagFlip, 'Expected a diagonal flip with length != D_BAL');
  st = applyLocalFlip(st, diagFlip.railIdx, diagFlip.keepIdx);
  const dInitial = st.d1;
  assert.ok(dInitial > 1.5);

  for (let i = 0; i < 120; i++) stepAnim(st, 0.05);
  assert.ok(Math.abs(st.d1 - D_BAL) < 0.01, `Expected d1 to relax near D_BAL, got ${st.d1}`);
  assert.ok(Math.abs(st.d2 - D_BAL) < 0.01);
  assert.ok(getTwistTurn(st) >= 0 && getTwistTurn(st) < 1);
});

test('orbit enumeration remains complete under hyperbolic camera panning', () => {
  const st = createBalancedModel();
  const panQ = qNorm(qMul(qBoost([1.8, -1.1, Math.sqrt(1 + 1.8 * 1.8 + 1.1 * 1.1)]), qRot0(0.7)));
  const orbit = enumerateVisibleOrbit(st, panQ, { rVis: 4.4 });
  let total = 0;
  for (const lbl of DEPTH_ORDER) {
    assert.ok(orbit.byLabel[lbl].length >= 25, `Too few ${lbl} copies after pan: ${orbit.byLabel[lbl].length}`);
    total += orbit.byLabel[lbl].length;
  }
  assert.ok(total >= 150);
});

test('all five hyperbolic motifs are strictly 180-deg symmetric and sized to overlap at balance', () => {
  assert.equal(DEPTH_ORDER.length, 5);
  for (const lbl of DEPTH_ORDER) {
    assert.ok(FEATURES[lbl], `Missing feature ${lbl}`);
    const m = HYPERBOLIC_MOTIFS[lbl];
    assert.ok(m.loops.length >= 1);
    for (const flat of m.loops) {
      const n = flat.length / 3;
      assert.equal(n % 2, 0, `${lbl} loop vertex count must be even for exact 180-deg pairing`);
      const half = n / 2;
      for (let i = 0; i < half; i++) {
        const j = i + half;
        // 180-deg rotation around (0,0,1) sends (x, y, z) -> (-x, -y, z)
        assert.ok(Math.abs(flat[3 * i] + flat[3 * j]) < 1e-10, `${lbl} x symmetry`);
        assert.ok(Math.abs(flat[3 * i + 1] + flat[3 * j + 1]) < 1e-10, `${lbl} y symmetry`);
        assert.ok(Math.abs(flat[3 * i + 2] - flat[3 * j + 2]) < 1e-10, `${lbl} z symmetry`);
      }
    }
  }
  // Check adjacent motifs overlap at balanced spacing (sum of max radii > D_BAL)
  assert.ok(HYPERBOLIC_MOTIFS.A.radius + HYPERBOLIC_MOTIFS.B.radius > D_BAL);
  assert.ok(HYPERBOLIC_MOTIFS.C.radius + HYPERBOLIC_MOTIFS.E.radius > D_BAL);
});
