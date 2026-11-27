import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  GH, GE, FAMILIES, normalizeFamilyKey, multiState,
  buildPatternModel, defaultCommas, psuInv, psuApplyDisc, so21ToPSU,
} from '../src/handles.js';
import { createPattern, tilesPSU, wheelPanTransform } from '../src/pattern-ext.js';
import { geometry, mul, apply, I3 } from '../../classification-of-surfaces/src/sym/geom.js';

const GS = geometry('S');

describe('Debug scroll stability & center-anchored wheel pan', () => {
  it('center-anchored vertical wheel pan (dx=0) yields exact identity across H, E, and S after up/down cycles', () => {
    const R = 300;
    for (const [label, G] of [['H', GH], ['E', GE], ['S', GS]]) {
      let M = I3.slice();
      for (let cycle = 0; cycle < 10; cycle++) {
        for (const dy of [-90, -45, 45, 90]) {
          M = G.fix(mul(wheelPanTransform(G, R, 0, dy), M), 1);
        }
      }
      const rotSin = Math.abs(M[3]);
      const drift = Math.max(...M.map((x, i) => Math.abs(x - I3[i])));
      assert.ok(rotSin < 1e-12, `${label}: vertical wheel cycles rotated by sin=${rotSin}`);
      assert.ok(drift < 1e-11, `${label}: vertical wheel cycles drifted by ${drift}`);
    }

    // Contrast: off-center translation in H produces non-zero holonomy if anchored at cursor instead of origin
    const offA = [0.7, 0.25, Math.sqrt(1 + 0.7 * 0.7 + 0.25 * 0.25)];
    const offB = GH.norm([0.7, 0.55, Math.sqrt(1 + 0.7 * 0.7 + 0.55 * 0.55)]);
    const T_off_up = GH.translate(offA, offB);
    const T_off_dn = GH.translate(offB, offA);
    const M_off = mul(T_off_dn, mul(GH.translate(GH.origin, GH.polar(0.5, 0)), T_off_up));
    assert.ok(Math.abs(M_off[3]) > 0.1, 'Sanity check: uncentered hyperbolic holonomy produces large tilt');
  });

  it('stepAuto keeps the isolating cut strictly horizontal (< 1e-9 rad) over 3000 frames', () => {
    const prevWin = globalThis.window;
    const prevPath2D = globalThis.Path2D;
    const noop = () => {};
    const stubCtx = {
      setTransform: noop, clearRect: noop, save: noop, restore: noop,
      beginPath: noop, arc: noop, clip: noop, fillRect: noop, fill: noop,
      stroke: noop, setLineDash: noop, moveTo: noop, lineTo: noop,
      bezierCurveTo: noop, closePath: noop,
    };
    const stubCanvas = {
      width: 500, height: 500,
      getContext: () => stubCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }),
      addEventListener: noop,
    };
    globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
    globalThis.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {} arc() {} };

    try {
      const scenarios = [
        ['3333 default (Reset)', () => buildPatternModel({
          k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3],
          L: FAMILIES['3333'].defaultL, tw: 0, b: 0, tau: 0,
          thetas: defaultCommas('3333').map((s) => (s ? s.theta : 0)),
        }), false],
        ['2223 twisted (pair-centered)', () => buildPatternModel({
          k: '2223', perm: [0, 1, 2, 3], orders: [2, 2, 2, 3],
          L: 2.1, tw: 0.15, b: 0, tau: 0,
          thetas: defaultCommas('2223').map((s) => (s ? s.theta : 0)),
        }), true],
        ['222222 twisted (multi p=3)', () => buildPatternModel(multiState(
          normalizeFamilyKey('222222'),
          { active: 2, shown: 3, Ls: [2.634, 2.634, 2.634], tws: [0.0002, -0.03, 0.021] }
        )), true],
      ];

      for (const [label, makeModel, usePose] of scenarios) {
        const P = createPattern(stubCanvas);
        const m = makeModel();
        assert.ok(m.activeCut && m.cutPeriod > 0, `${label}: missing activeCut/cutPeriod`);
        P.set(m);
        if (usePose && m.pose) {
          P.setView({ V: m.pose, base: I3.slice(), turned: false }, { sync: true });
        }

        const assertHorizontalCut = (frame) => {
          const V = P.getView().V;
          const vPsu = so21ToPSU(V, false);
          const focus = psuApplyDisc(psuInv(vPsu), [0, 0]);
          const ts = tilesPSU(m.D, m.A, { focus, radius: 2.5, max: 120 });
          let best = null, bd = Infinity;
          for (const t of ts) {
            const a = apply(V, apply(t.M, m.activeCut[0]));
            const b = apply(V, apply(t.M, m.activeCut[1]));
            const d = GH.lineDist(GH.origin, a, b);
            if (d < bd) { bd = d; best = { a, b }; }
          }
          const tol = frame === 0 ? 1e-4 : 1e-9;
          assert.ok(best && bd < tol, `${label} frame ${frame}: cut drifted off origin (${bd})`);
          const foot = GH.foot(GH.origin, best.a, best.b);
          const toward = GH.dist(foot, best.b) > 1e-6 ? best.b : best.a;
          const F = GH.frame(foot, toward);
          assert.ok(Math.abs(F[3]) < tol, `${label} frame ${frame}: cut tilted by sin=${F[3]}`);
        };

        assertHorizontalCut(0);
        for (let frame = 1; frame <= 3000; frame++) {
          assert.equal(P.stepAuto(16.6667, { speed: 0.75, angle: 0, useScale: false }), true);
          if (frame === 500 || frame === 1500 || frame === 3000) {
            assertHorizontalCut(frame);
          }
        }
      }
    } finally {
      globalThis.window = prevWin;
      globalThis.Path2D = prevPath2D;
    }
  });
});
