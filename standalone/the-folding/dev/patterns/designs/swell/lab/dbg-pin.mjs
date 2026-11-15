// lab/dbg-pin.mjs — why are the corner-pinned pairs of a chamber rejected? Counts the reasons over a grid of head pairs.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
const id = process.argv[2] || '*442';
const g = BY_ID[id], u = Math.sqrt(g.domainArea), K = D.KNOBS;
const T = D.seatTile(g);
const pins = D.pinsOf(T, K, u);
console.log('tile', T.map((p) => p.map((v) => (v / u).toFixed(3)).join(',')).join(' | '));
console.log('pins', pins.map((p) => p.map((v) => (v / u).toFixed(3)).join(',')).join(' | '));
// a grid in the tile (as gridIn with pStep, inset 0.08)
const c = T.reduce((s, p) => [s[0] + p[0] / T.length, s[1] + p[1] / T.length], [0, 0]);
const pts = [];
for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) {
  const x = c[0] + i * K.pStep * u, y = c[1] + j * K.pStep * u;
  let ok = true;
  for (let k = 0; k < T.length; k++) { const p = T[k], q = T[(k + 1) % T.length], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); if ((dy / l) * (p[0] - x) + (-dx / l) * (p[1] - y) < 0.08 * u) ok = false; }
  if (ok) pts.push([x, y]);
}
const why = {};
const W = T.map((p, k) => { const q = T[(k + 1) % T.length], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [dy / l, -dx / l, (dy / l) * p[0] + (-dx / l) * p[1]]; });
let n = 0;
for (const a of pts) for (const b of pts) {
  if (a === b || Math.hypot(a[0] - b[0], a[1] - b[1]) < K.dMin * u) continue;
  for (const qa of pins) for (const qb of pins) {
    if (qa === qb) continue;
    for (let sgn = 1; sgn >= -1; sgn -= 2) {
      n++;
      const wa = D.pinOf(a, b, qa, sgn, u, K), wb = wa && D.pinOf(b, a, qb, sgn, u, K);
      if (!wa) { why.sweepA = (why.sweepA || 0) + 1; continue; }
      if (!wb) { why.sweepB = (why.sweepB || 0) + 1; continue; }
      // the spine of A sampled: does it leave the tile?
      for (const m of K.pinMs) {
        let out = 0, minWall = Infinity;
        const steps = 48, D0 = Math.hypot(a[0] - b[0], a[1] - b[1]), a0 = Math.atan2(a[1] - b[1], a[0] - b[0]);
        for (let j = 0; j <= steps; j++) {
          const s = j / steps, rho = wa.rw * u + (D0 - wa.rw * u) * Math.pow(1 - s, m), ang = a0 + sgn * wa.sweep * s;
          const x = b[0] + rho * Math.cos(ang), y = b[1] + rho * Math.sin(ang);
          for (const w of W) { const d = w[2] - w[0] * x - w[1] * y; if (d < minWall) minWall = d; }
        }
        const key = 'm' + m + (minWall < 0.04 * u ? ' leaves' : ' inside');
        why[key] = (why[key] || 0) + 1;
      }
    }
  }
}
console.log('points', pts.length, 'tries', n, why);
