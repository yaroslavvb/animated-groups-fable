import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { psuApplyDisc } from '../src/handles.js';
import { markLocalFrame } from '../src/pattern-gl.js';

describe('markLocalFrame conformal marker frame', () => {
  it('maps pg -> 0, preserves PSU(1,1) normalization, and aligns ug -> (+1, 0) with exact conformal factor', () => {
    const radii = [0, 0.5, 0.85, 0.95];
    const angles = [0, 0.43, Math.PI / 2, 2.31, Math.PI, -1.7, -0.3];
    const dirAngles = [0, 0.7, Math.PI / 2, 2.8, Math.PI, -2.1, -0.5];
    const eps = 1e-6;

    for (const r of radii) {
      for (const theta of angles) {
        if (r === 0 && theta !== 0) continue;
        const pg = [r * Math.cos(theta), r * Math.sin(theta)];
        const oneMinusR2 = 1 - r * r;
        for (const phi of dirAngles) {
          const ug = [Math.cos(phi), Math.sin(phi)];
          const F = markLocalFrame(pg, ug);

          // 1. PSU(1,1) determinant |a|^2 - |b|^2 === 1
          const det = F[0] * F[0] + F[1] * F[1] - (F[2] * F[2] + F[3] * F[3]);
          assert.ok(Math.abs(det - 1) < 1e-11, `det mismatch at r=${r}, det=${det}`);
          assert.equal(F[4], false);

          // 2. Origin mapping F(pg) === (0, 0)
          const o = psuApplyDisc(F, pg);
          assert.ok(Math.hypot(o[0], o[1]) < 1e-12, `origin drift at r=${r}: ${o}`);

          // 3. Push-forward F(pg + eps * ug) points along (+1, 0) with magnitude eps / (1 - |pg|^2)
          const tip = psuApplyDisc(F, [pg[0] + eps * ug[0], pg[1] + eps * ug[1]]);
          const expectedMag = eps / oneMinusR2;
          assert.ok(tip[0] > 0, `expected tip.x > 0, got ${tip[0]}`);
          assert.ok(
            Math.abs(tip[0] - expectedMag) / expectedMag < 1e-4,
            `magnitude mismatch at r=${r}: got ${tip[0]}, expected ${expectedMag}`
          );
          assert.ok(
            Math.abs(tip[1]) / expectedMag < 1e-4,
            `direction y-component non-zero at r=${r}, phi=${phi}: ${tip[1]}`
          );
        }
      }
    }
  });
});
