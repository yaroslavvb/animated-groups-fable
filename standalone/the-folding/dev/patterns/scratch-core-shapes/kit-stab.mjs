// scratch: does kit.stabilizerOrder see a motif that sits on a rotation centre or a mirror and has that symmetry?
import { GROUPS, BY_ID, symmetryElements } from '../../../src/groups.js';
import { normalize, measure, stabilizerOrder, windingAt } from '../kit.js';

function rosette(c, order, r, phase, lobes = 1) {
  // a pinwheel with exactly `order`-fold rotational symmetry about c (no mirror symmetry): radius r (1 + 0.3 sawtooth)
  const pts = [], n = 20 * order;
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n, u = ((i % 20) / 20);
    const rr = r * (0.65 + 0.35 * u);
    pts.push([c[0] + rr * Math.cos(th + phase), c[1] + rr * Math.sin(th + phase)]);
  }
  return pts;
}
for (const id of ['2222', '333', '442', '632', '*333', '3*3', '*632', '*442']) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea);
  const sym = symmetryElements(g, g.center[0], g.center[1], 1.5);
  const orders = [...new Set(sym.centers.map((c) => c.order))].sort();
  for (const order of orders) {
    const c = sym.centers.filter((q) => q.order === order).sort((p, q) => Math.hypot(p.x - g.center[0], p.y - g.center[1]) - Math.hypot(q.x - g.center[0], q.y - g.center[1]))[0];
    if (c.onMirror) { /* a pinwheel on a mirror is not symmetric under the mirror: skip (copies would overlap for real) */ continue; }
    const N = normalize([{ pts: rosette([c.x, c.y], order, 0.12 * size, 0.2) }]);
    const stab = stabilizerOrder(g, N);
    const W = windingAt(g, N, c.x, c.y);
    const M = measure(g, N, { per: 24 });
    console.log(id.padEnd(6), 'centre of order', order, 'at', c.x.toFixed(3), c.y.toFixed(3), '| bbox centre', N.cx.toFixed(4), N.cy.toFixed(4), '| kit stabiliser', stab, '| W at the centre', W, '| kit overlap', M.overlap, 'coverage', M.coverage);
  }
}
// a mirror-symmetric motif on a mirror at 60 degrees (*333)
{
  const g = BY_ID['*333'], size = Math.sqrt(g.domainArea);
  const sym = symmetryElements(g, g.center[0], g.center[1], 1.5);
  for (const m of sym.mirrors.slice(0, 6)) {
    // a kite symmetric about the mirror, centred at a point of the mirror away from the rotation centres
    const t = 0.11, px = m.px + t * m.ux, py = m.py + t * m.uy, nx = -m.uy, ny = m.ux, a = 0.05 * size, b = 0.02 * size;
    const pts = [[px + 1.6 * a * m.ux, py + 1.6 * a * m.uy], [px + b * nx, py + b * ny], [px - a * m.ux, py - a * m.uy], [px - b * nx, py - b * ny]];
    const N = normalize([{ pts }]);
    const M = measure(g, N, { per: 24 });
    console.log('*333 mirror dir', (Math.atan2(m.uy, m.ux) * 180 / Math.PI).toFixed(0).padStart(4), '| kit stabiliser', stabilizerOrder(g, N), '| W at the centre', windingAt(g, N, px, py), '| kit overlap', M.overlap, 'coverage', M.coverage);
  }
}
