// node dev/tileinfo.mjs [ids]  — the default tile of each group in the design's frame (origin the centroid, x along e1,
// unit the tile size): its vertices (angle from the centroid, corner angle, rotation order of the point), and each edge:
// a mirror of the group, or glued (to which edge, by what kind of element).
import { GROUPS, BY_ID, elementsNear, classify } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';

const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
for (const id of ids) {
  const g = BY_ID[id], s = Math.sqrt(g.domainArea);
  let P = tileOf(g).poly.map((p) => [p[0], p[1]]);
  let A = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; A += p[0] * q[1] - p[1] * q[0]; }
  if (A < 0) P.reverse();
  // merge near-duplicate / collinear vertices
  const Q = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6 * s) continue;
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-9 * s * s) continue;
    Q.push(b);
  }
  P = Q;
  let cx = 0, cy = 0, w = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], k = p[0] * q[1] - p[1] * q[0]; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k; w += k; }
  cx /= 3 * w; cy /= 3 * w;
  const L = Math.hypot(g.e1[0], g.e1[1]), u = [g.e1[0] / L, g.e1[1] / L], v = [-u[1], u[0]];
  const loc = (p) => { const dx = p[0] - cx, dy = p[1] - cy; return [(dx * u[0] + dy * u[1]) / s, (dx * v[0] + dy * v[1]) / s]; };
  const els = elementsNear(g, cx, cy, 6 * s, cx, cy);
  console.log(`== ${id}  (${P.length} vertices, tile size ${s.toFixed(4)})`);
  P.forEach((p, i) => {
    const a = P[(i + P.length - 1) % P.length], c = P[(i + 1) % P.length];
    const t1 = Math.atan2(a[1] - p[1], a[0] - p[0]), t2 = Math.atan2(c[1] - p[1], c[0] - p[0]);
    let ang = ((t1 - t2) * 180) / Math.PI; ang = ((ang % 360) + 360) % 360;
    let order = 1, mir = 0;
    for (const e of els) {
      const qx = e.a * p[0] + e.b * p[1] + e.tx, qy = e.c * p[0] + e.d * p[1] + e.ty;
      if (Math.hypot(qx - p[0], qy - p[1]) > 1e-6 * s) continue;
      const det = e.a * e.d - e.b * e.c;
      if (det > 0) { const th = Math.atan2(e.c, e.a); if (Math.abs(th) > 1e-6) order = Math.max(order, Math.round((2 * Math.PI) / Math.abs(th))); }
      else mir++;
    }
    const [x, y] = loc(p);
    console.log(`  v${i} (${x.toFixed(3)}, ${y.toFixed(3)})  dir ${((Math.atan2(y, x) * 180 / Math.PI + 360) % 360).toFixed(1)}  corner ${ang.toFixed(1)}  stab: rot order ${order}, mirrors ${mir}`);
  });
  P.forEach((p, i) => {
    const q = P[(i + 1) % P.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    // what maps the tile across this edge: an element g with g(edge) = edge (as a set) and g(tile) the neighbour
    let what = '?';
    for (const e of els) {
      const ap = [e.a * p[0] + e.b * p[1] + e.tx, e.c * p[0] + e.d * p[1] + e.ty], aq = [e.a * q[0] + e.b * q[1] + e.tx, e.c * q[0] + e.d * q[1] + e.ty];
      const same = Math.hypot(ap[0] - p[0], ap[1] - p[1]) < 1e-6 * s && Math.hypot(aq[0] - q[0], aq[1] - q[1]) < 1e-6 * s;
      const swap = Math.hypot(ap[0] - q[0], ap[1] - q[1]) < 1e-6 * s && Math.hypot(aq[0] - p[0], aq[1] - p[1]) < 1e-6 * s;
      const det = e.a * e.d - e.b * e.c;
      if (same && det < 0) { what = 'MIRROR'; break; }
      if (swap && det > 0) { what = 'half-turn about its midpoint'; break; }
    }
    if (what === '?') {
      // glued to another edge j: an element maps edge j onto this edge (reversed orientation for a proper gluing)
      for (let j = 0; j < P.length && what === '?'; j++) {
        if (j === i) continue;
        const a = P[j], b = P[(j + 1) % P.length];
        for (const e of els) {
          const ea = [e.a * a[0] + e.b * a[1] + e.tx, e.c * a[0] + e.d * a[1] + e.ty], eb = [e.a * b[0] + e.b * b[1] + e.tx, e.c * b[0] + e.d * b[1] + e.ty];
          if (Math.hypot(ea[0] - q[0], ea[1] - q[1]) < 1e-6 * s && Math.hypot(eb[0] - p[0], eb[1] - p[1]) < 1e-6 * s) { const c = classify(e); what = `glued to edge ${j} by a ${c.type}${c.order ? ' ' + c.order : ''}`; break; }
          if (Math.hypot(ea[0] - p[0], ea[1] - p[1]) < 1e-6 * s && Math.hypot(eb[0] - q[0], eb[1] - q[1]) < 1e-6 * s) { const c = classify(e); what = `glued to edge ${j} (same direction) by a ${c.type}${c.order ? ' ' + c.order : ''}`; break; }
        }
      }
    }
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) / s, [mx, my] = loc(m);
    console.log(`  e${i} v${i}->v${(i + 1) % P.length} len ${len.toFixed(3)} mid dir ${((Math.atan2(my, mx) * 180 / Math.PI + 360) % 360).toFixed(1)}: ${what}`);
  });
}
