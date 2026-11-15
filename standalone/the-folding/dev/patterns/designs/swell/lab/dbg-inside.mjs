// lab/dbg-inside.mjs — does the motif of a chamber stay inside its chamber? Prints how far its points go outside T.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
for (const id of (process.argv[2] || '*442,*632,*333,*2222').split(',')) {
  const g = BY_ID[id], u = Math.sqrt(g.domainArea);
  const b = D.build(g), T = b.tile;
  let worst = 0, n = 0;
  for (const s of b.shapes) for (const p of s.pts) {
    let out = 0;
    for (let k = 0; k < T.length; k++) { const a = T[k], q = T[(k + 1) % T.length], dx = q[0] - a[0], dy = q[1] - a[1], l = Math.hypot(dx, dy); const d = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l; if (d > out) out = d; }
    if (out > worst) worst = out;
    n++;
  }
  // and the sites (the commas before they swell)
  let sw = 0;
  for (let i = 0; i < b.site.n; i++) {
    const p = [b.site.x[i], b.site.y[i]], r = b.site.r[i];
    for (let k = 0; k < T.length; k++) { const a = T[k], q = T[(k + 1) % T.length], dx = q[0] - a[0], dy = q[1] - a[1], l = Math.hypot(dx, dy); const d = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l + r; if (d > sw) sw = d; }
  }
  console.log(id, 'tile orientation', Math.sign(T.reduce((s, p, k) => s + p[0] * T[(k + 1) % T.length][1] - T[(k + 1) % T.length][0] * p[1], 0)), 'outline points', n, 'farthest outside', (worst / u).toFixed(3), 'site discs outside', (sw / u).toFixed(3), 'loops', b.shapes.length, b.shapes.map((s) => s.hole));
}
