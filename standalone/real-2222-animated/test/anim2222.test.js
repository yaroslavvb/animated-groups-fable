import test from 'node:test';
import assert from 'node:assert/strict';
import { det2, add3, sub3, mul3, cross3, dot3, norm3, pairVectors } from '../../real-2222/src/real2222.js';
import { placedInPane, samePrint } from '../../real-2222/src/paisley.js';
import {
  FIXED_ELL,
  ANIM_PERIOD,
  PAIR_SPLITS,
  SYMBOL_POLYS,
  rayPolyPoint,
  worldCornersFromState,
  buildSymbolPillowMesh,
  createAnimModel,
  switchAnimPair,
  stepAnim,
  scrubAnimTwist,
} from '../src/symbols.js';

const PAISLEY_FNS = { placedInPane, samePrint };

test('all four corner symbols are strictly 180-degree rotationally symmetric', () => {
  for (const [name, poly] of Object.entries(SYMBOL_POLYS)) {
    for (let i = 0; i < 36; i++) {
      const th = (i * Math.PI) / 18;
      const p1 = rayPolyPoint(poly, th);
      const p2 = rayPolyPoint(poly, th + Math.PI);
      const err = Math.hypot(p1[0] + p2[0], p1[1] + p2[1]);
      assert.ok(err < 1e-10, `symbol ${name} failed 180-deg symmetry at th=${th}: err=${err}`);
    }
  }
});

const polyArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - p[1] * q[0];
  }
  return 0.5 * a;
};
const SUM_MOTIF_AREA =
  0.5 *
  (polyArea(SYMBOL_POLYS.A) +
    polyArea(SYMBOL_POLYS.B) +
    polyArea(SYMBOL_POLYS.C) +
    polyArea(SYMBOL_POLYS.D));

test('buildSymbolPillowMesh preserves area=2, outward normals, fixed depth order [0,4,5,6,7], and genuine motif overlap', () => {
  for (let activeIdx = 0; activeIdx < 3; activeIdx++) {
    const model = createAnimModel({ activeIdx, t: 0.25, ell: FIXED_ELL });
    let minOverlapArea = Infinity;
    let maxOverlapArea = 0;
    for (let s = 0; s <= 24; s++) {
      const tw = (s / 24) * ANIM_PERIOD;
      scrubAnimTwist(model, tw);
      const meshExact = buildSymbolPillowMesh(model.e, model.activeFrame, {
        minConorm: 0,
        activeIdx,
        pinFrame: model.pinFrame,
      });
      let area = 0;
      let bgArea = 0;
      const seenTints = new Set();
      for (let i = 0; i < meshExact.tint.length; i++) seenTints.add(meshExact.tint[i]);
      assert.deepEqual([...seenTints].sort((a, b) => a - b), [0, 4, 5, 6, 7], `pair ${activeIdx} t=${tw}`);

      for (let t = 0; t < meshExact.indices.length; t += 3) {
        const i0 = meshExact.indices[t] * 3;
        const i1 = meshExact.indices[t + 1] * 3;
        const i2 = meshExact.indices[t + 2] * 3;
        const p0 = [meshExact.positions[i0], meshExact.positions[i0 + 1], meshExact.positions[i0 + 2]];
        const p1 = [meshExact.positions[i1], meshExact.positions[i1 + 1], meshExact.positions[i1 + 2]];
        const p2 = [meshExact.positions[i2], meshExact.positions[i2 + 1], meshExact.positions[i2 + 2]];
        const ta = 0.5 * norm3(cross3(sub3(p1, p0), sub3(p2, p0)));
        area += ta;
        if (meshExact.tint[meshExact.indices[t]] === 0) bgArea += ta;
      }
      assert.ok(Math.abs(area - 2) < 1e-5, `pair ${activeIdx} t=${tw}: area=${area}`);
      const overlap = SUM_MOTIF_AREA - (2 - bgArea);
      minOverlapArea = Math.min(minOverlapArea, overlap);
      maxOverlapArea = Math.max(maxOverlapArea, overlap);

      const meshViz = buildSymbolPillowMesh(model.e, model.activeFrame, {
        minConorm: 4e-4,
        activeIdx,
        pinFrame: model.pinFrame,
      });
      const cen = mul3(0.25, add3(add3(meshViz.corners.A, meshViz.corners.B), add3(meshViz.corners.C, meshViz.corners.D)));
      for (let t = 0; t < meshViz.indices.length; t += 3) {
        const i0 = meshViz.indices[t] * 3;
        const i1 = meshViz.indices[t + 1] * 3;
        const i2 = meshViz.indices[t + 2] * 3;
        const p0 = [meshViz.positions[i0], meshViz.positions[i0 + 1], meshViz.positions[i0 + 2]];
        const p1 = [meshViz.positions[i1], meshViz.positions[i1 + 1], meshViz.positions[i1 + 2]];
        const p2 = [meshViz.positions[i2], meshViz.positions[i2 + 1], meshViz.positions[i2 + 2]];
        const n = cross3(sub3(p1, p0), sub3(p2, p0));
        const mid = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3];
        assert.ok(dot3(n, sub3(mid, cen)) > 0, `pair ${activeIdx} t=${tw}: inverted triangle normal`);
      }
    }
    assert.ok(minOverlapArea > 0.001, `pair ${activeIdx} expected > 0.001 overlap area, got ${minOverlapArea}`);
    assert.ok(maxOverlapArea > 0.02, `pair ${activeIdx} expected > 0.02 max overlap area, got ${maxOverlapArea}`);
  }
});

test('each pairing holds its first pair fixed in 3D, rotates the other pair, and wraps seamlessly at period 1.0', () => {
  for (let activeIdx = 0; activeIdx < 3; activeIdx++) {
    const model = createAnimModel({ activeIdx, t: 0.37, ell: FIXED_ELL });
    const start = worldCornersFromState(model.e, activeIdx, model.pinFrame).V;
    const [[f0, f1], [r0, r1]] = PAIR_SPLITS[activeIdx];
    let maxPinMove = 0;
    let maxOtherMove = 0;
    for (let k = 1; k <= 20; k++) {
      scrubAnimTwist(model, 0.37 + (k / 20) * ANIM_PERIOD);
      const cur = worldCornersFromState(model.e, activeIdx, model.pinFrame).V;
      maxPinMove = Math.max(maxPinMove, norm3(sub3(cur[f0], start[f0])), norm3(sub3(cur[f1], start[f1])));
      maxOtherMove = Math.max(maxOtherMove, norm3(sub3(cur[r0], start[r0])), norm3(sub3(cur[r1], start[r1])));
    }
    assert.ok(maxPinMove < 1e-12, `pair ${activeIdx} pinned corners moved ${maxPinMove}`);
    assert.ok(maxOtherMove > 0.9, `pair ${activeIdx} rotating corners moved only ${maxOtherMove}`);

    scrubAnimTwist(model, 0.37 + ANIM_PERIOD);
    const wrapped = worldCornersFromState(model.e, activeIdx, model.pinFrame).V;
    for (const c of ['A', 'B', 'C', 'D']) {
      assert.ok(norm3(sub3(start[c], wrapped[c])) < 1e-11, `corner ${c} failed period-1 wrap for pair ${activeIdx}`);
    }
  }
});

test('switchAnimPair preserves exact world pose and instantaneous ell (no length reset), wraps cleanly, and holds new first pair fixed', () => {
  for (const startT of [0.0, 0.12, 0.25, 0.5, 0.65]) {
    const model = createAnimModel({ activeIdx: 0, t: startT, ell: FIXED_ELL, playing: true, speed: 1 });
    for (const nextIdx of [1, 2, 0]) {
      const before = worldCornersFromState(model.e, model.activeIdx, model.pinFrame).V;
      const eBefore = [model.e[0].slice(), model.e[1].slice()];
      const expectedEll = pairVectors(model.e, [
        [1, 0],
        [0, 1],
      ]);
      void expectedEll;
      switchAnimPair(model, nextIdx, PAISLEY_FNS);
      const pv = pairVectors(model.e, model.activeFrame);
      assert.ok(Math.abs(model.animEll - pv.ell) < 1e-13, `animEll=${model.animEll} != pv.ell=${pv.ell}`);
      assert.ok(Math.hypot(model.e[0][0] - eBefore[0][0], model.e[0][1] - eBefore[0][1]) < 1e-13);
      assert.ok(Math.hypot(model.e[1][0] - eBefore[1][0], model.e[1][1] - eBefore[1][1]) < 1e-13);

      const afterSwitch = worldCornersFromState(model.e, model.activeIdx, model.pinFrame).V;
      for (const c of ['A', 'B', 'C', 'D']) {
        assert.ok(
          norm3(sub3(before[c], afterSwitch[c])) < 1e-11,
          `corner ${c} jumped at startT=${startT} -> pair ${nextIdx}`
        );
      }

      const angBefore = pv.ang;
      const ellBefore = model.animEll;
      for (let i = 0; i < 30; i++) stepAnim(model, 0.02);
      assert.ok(Math.abs(model.animEll - ellBefore) < 1e-13, 'animEll drifted during stepAnim');
      scrubAnimTwist(model, model.animT + 0.15);
      assert.ok(Math.abs(model.animEll - ellBefore) < 1e-13, 'animEll reset during scrubAnimTwist');
      assert.ok(Math.abs(pairVectors(model.e, model.activeFrame).ang - angBefore) < 1e-10, 'angle drifted');
      assert.ok(Math.abs(det2(model.e[0], model.e[1]) - 1) < 1e-10);

      // Verify period-1 wrap even when non-regular length is active
      const snap = worldCornersFromState(model.e, model.activeIdx, model.pinFrame).V;
      const tSnap = model.animT;
      scrubAnimTwist(model, tSnap + ANIM_PERIOD);
      const wrapped = worldCornersFromState(model.e, model.activeIdx, model.pinFrame).V;
      for (const c of ['A', 'B', 'C', 'D']) {
        assert.ok(norm3(sub3(snap[c], wrapped[c])) < 1e-11, `period-1 wrap failed at ell=${ellBefore}`);
      }

      if (model.animEll <= 1.35) {
        const [[f0, f1], [r0, r1]] = PAIR_SPLITS[model.activeIdx];
        for (let i = 0; i < 40; i++) stepAnim(model, 0.025);
        const later = worldCornersFromState(model.e, model.activeIdx, model.pinFrame).V;
        const pinDrift = Math.max(norm3(sub3(later[f0], snap[f0])), norm3(sub3(later[f1], snap[f1])));
        const otherMove = Math.max(norm3(sub3(later[r0], snap[r0])), norm3(sub3(later[r1], snap[r1])));
        assert.ok(pinDrift < 1e-11, `pair ${model.activeIdx} drifted at ell=${model.animEll}: ${pinDrift}`);
        assert.ok(otherMove > 0.25, `pair ${model.activeIdx} other pair barely moved: ${otherMove}`);
      }
    }
  }
});

test('buildSymbolPillowMesh preserves area=2, outward normals, and depth-ordered overlap across extreme ell 0.2..4.0', () => {
  for (const ell of [0.2, 0.35, 1.4215, 2.5, 4.0]) {
    const model = createAnimModel({ activeIdx: 0, t: 0.18, ell });
    const mesh = buildSymbolPillowMesh(model.e, model.activeFrame, {
      minConorm: 0,
      activeIdx: 0,
      pinFrame: model.pinFrame,
    });
    const seenTints = new Set();
    for (let i = 0; i < mesh.tint.length; i++) seenTints.add(mesh.tint[i]);
    for (const tv of seenTints) {
      assert.ok([0, 4, 5, 6, 7].includes(tv), `unexpected tint ${tv} at ell=${ell}`);
    }

    let area = 0;
    let bgArea = 0;
    const cen = mul3(0.25, add3(add3(mesh.corners.A, mesh.corners.B), add3(mesh.corners.C, mesh.corners.D)));
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const i0 = mesh.indices[t] * 3;
      const i1 = mesh.indices[t + 1] * 3;
      const i2 = mesh.indices[t + 2] * 3;
      const p0 = [mesh.positions[i0], mesh.positions[i0 + 1], mesh.positions[i0 + 2]];
      const p1 = [mesh.positions[i1], mesh.positions[i1 + 1], mesh.positions[i1 + 2]];
      const p2 = [mesh.positions[i2], mesh.positions[i2 + 1], mesh.positions[i2 + 2]];
      const n = cross3(sub3(p1, p0), sub3(p2, p0));
      const ta = 0.5 * norm3(n);
      area += ta;
      if (mesh.tint[mesh.indices[t]] === 0) bgArea += ta;
      const mid = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3];
      assert.ok(dot3(n, sub3(mid, cen)) > -1e-9, `inverted triangle normal at ell=${ell}`);
    }
    const overlapArea = SUM_MOTIF_AREA - (2 - bgArea);
    assert.ok(overlapArea > 0.02, `expected > 0.02 overlap area at ell=${ell}, got ${overlapArea}`);
    assert.ok(Math.abs(area - 2) < 1e-4, `extreme ell=${ell}: area=${area}`);
  }
});
