// lab/dbg-corner2.mjs — the field and the rule along each corner's bisector of a chamber.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
const id = process.argv[2] || '*442';
const g = BY_ID[id], u = Math.sqrt(g.domainArea), b = D.build(g), T = b.tile, W = b.swelled, F = W.field, R = W.rule;
const c = T.reduce((q, p) => [q[0] + p[0] / T.length, q[1] + p[1] / T.length], [0, 0]);
console.log('rule', JSON.stringify({ lam: R.lam, w: R.w / u, ramp: R.ramp / u, rampMin: R.rampMin, plainOnly: R.plainOnly }));
for (const V of T) {
  const dx = c[0] - V[0], dy = c[1] - V[1], l = Math.hypot(dx, dy);
  for (const t of [0.1, 0.2, 0.3, 0.5]) {
    const x = V[0] + (dx / l) * t * u, y = V[1] + (dy / l) * t * u, { ox, oy, ux, uy, vx, vy } = F.fr;
    const i = Math.round(((x - ox) * ux + (y - oy) * uy) / F.h), j = Math.round(((x - ox) * vx + (y - oy) * vy) / F.h), q = j * F.nx + i;
    const f = (v) => (v / u).toFixed(3);
    console.log('corner', f(V[0]), f(V[1]), 't', t, 'eA', f(F.eown[0][q]), 'eB', f(F.eown[1][q]), 'eOther', f(F.eoth[q]), 'dv', F.dv ? f(F.dv[q]) : '-', 'rule', f(D.ruleAt(F, q, R)), 'in grid', i >= 0 && j >= 0 && i < F.nx && j < F.ny);
  }
}
