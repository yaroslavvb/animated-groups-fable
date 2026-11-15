// designs/ripple/lab/check.mjs — the hard rules of the brief, checked in node for all 17 groups (a few seconds, one core):
// vertices, no self-crossing polygon, a hole inside an outer polygon, the gap between two copies of the motif, the
// gap between two polygons of one motif, the turn at a vertex of a curve, the time of find(), and that find() gives
// the same motif twice.
//   node dev/patterns/designs/ripple/lab/check.mjs [--ids o,2222] [--bare 1] [--turn 0.7]
import { GROUPS, BY_ID, elementsNear } from '../../../../../src/groups.js';
import { normalize, GAP_MIN, MAX_VERTS } from '../../../kit.js';
import { find } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);

function carried(group, ang, scale, shift) {
  const c = Math.cos(ang) * scale, s = Math.sin(ang) * scale, S = (x, y) => [c * x - s * y + shift[0], s * x + c * y + shift[1]];
  const lin = (v) => [c * v[0] - s * v[1], s * v[0] + c * v[1]], ca = Math.cos(ang), sa = Math.sin(ang);
  const reps = group.reps.map((r) => {
    const a = ca * (r.a * ca + r.b * -sa) - sa * (r.c * ca + r.d * -sa), b = ca * (r.a * sa + r.b * ca) - sa * (r.c * sa + r.d * ca);
    const cc = sa * (r.a * ca + r.b * -sa) + ca * (r.c * ca + r.d * -sa), d = sa * (r.a * sa + r.b * ca) + ca * (r.c * sa + r.d * ca);
    const ox = (ca * -shift[0] + sa * -shift[1]) / scale, oy = (-sa * -shift[0] + ca * -shift[1]) / scale;
    const t = S(r.a * ox + r.b * oy + r.tx, r.c * ox + r.d * oy + r.ty);
    return { a, b, c: cc, d, tx: t[0], ty: t[1] };
  });
  const e1 = lin(group.e1), e2 = lin(group.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: group.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: S(group.center[0], group.center[1]) };
}

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
/** do the segments ab and cd cross properly? (two pieces of one straight channel edge lie on one line: no crossing) */
const cross = (ax, ay, bx, by, cx, cy, dx, dy) => {
  const tol = 1e-9 * (Math.hypot(bx - ax, by - ay) * Math.hypot(dx - cx, dy - cy));
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  if (Math.abs(d1) <= tol || Math.abs(d2) <= tol || (d1 > 0) === (d2 > 0)) return false;
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return Math.abs(d3) > tol && Math.abs(d4) > tol && (d3 > 0) !== (d4 > 0);
};
const inside = (p, x, y) => { let c = false; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) { const yi = p[2 * i + 1], yj = p[2 * j + 1]; if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) c = !c; } return c; };
/** least distance between two closed polylines (vertex to segment, both ways) */
function polyGap(p, q, stop = 0) {
  let best = Infinity;
  const n = p.length / 2, m = q.length / 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const k = (j + 1) % m, d = segDist(p[2 * i], p[2 * i + 1], q[2 * j], q[2 * j + 1], q[2 * k], q[2 * k + 1]); if (d < best) best = d; }
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const k = (i + 1) % n, d = segDist(q[2 * j], q[2 * j + 1], p[2 * i], p[2 * i + 1], p[2 * k], p[2 * k + 1]); if (d < best) best = d; }
  return best;
}

let bad = 0;
const table = [];
for (const id of ids) {
  let group = BY_ID[id];
  if (opt.turn !== undefined) group = carried(group, +opt.turn, 1.37, [0.31, -0.23]);
  else if (opt.bare) group = { id: group.id, e1: group.e1, e2: group.e2, reps: group.reps, cellArea: group.cellArea, domainArea: group.domainArea, center: group.center };
  const size = Math.sqrt(group.domainArea), notes = [];
  find(group);
  const times = [];
  let res;
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); res = find(group); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const again = find(group);
  if (JSON.stringify(again.shapes) !== JSON.stringify(res.shapes)) notes.push('NOT DETERMINISTIC');
  const N = normalize(res.shapes);
  if (N.verts > MAX_VERTS) notes.push('vertices ' + N.verts);
  // self-crossing
  for (const [pi, P] of N.polys.entries()) {
    const p = P.pts, n = p.length / 2;
    let x = 0;
    for (let i = 0; i < n && !x; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = (i + 1) % n, b = (j + 1) % n;
      if (cross(p[2 * i], p[2 * i + 1], p[2 * a], p[2 * a + 1], p[2 * j], p[2 * j + 1], p[2 * b], p[2 * b + 1])) { x = 1; break; }
    }
    if (x) notes.push(`polygon ${pi} crosses itself`);
    if (P.hole && !N.polys.some((Q) => !Q.hole && inside(Q.pts, p[0], p[1]))) notes.push(`hole ${pi} lies in no outer polygon`);
  }
  // the gap between copies
  let gap = Infinity;
  const els = elementsNear(group, N.cx, N.cy, 2 * N.R + 0.3 * size, N.cx, N.cy);
  for (const g of els) {
    if (Math.abs(g.a - 1) + Math.abs(g.b) + Math.abs(g.tx) + Math.abs(g.ty) < 1e-9 && g.a * g.d - g.b * g.c > 0) continue;
    for (const P of N.polys) {
      const q = new Float64Array(P.pts.length);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < q.length; i += 2) { q[i] = g.a * P.pts[i] + g.b * P.pts[i + 1] + g.tx; q[i + 1] = g.c * P.pts[i] + g.d * P.pts[i + 1] + g.ty; x0 = Math.min(x0, q[i]); x1 = Math.max(x1, q[i]); y0 = Math.min(y0, q[i + 1]); y1 = Math.max(y1, q[i + 1]); }
      for (const Q of N.polys) {
        const m = Math.max(gap, 0.2 * size);
        if (x0 > Q.box[2] + m || x1 < Q.box[0] - m || y0 > Q.box[3] + m || y1 < Q.box[1] - m) continue;
        const d = polyGap(q, Q.pts);
        if (d < gap) gap = d;
      }
    }
  }
  if (gap < GAP_MIN * size) notes.push('copies ' + (gap / size).toFixed(4) + ' apart');
  // the gap between two polygons of the motif (a moat, a light band)
  let own = Infinity;
  for (let i = 0; i < N.polys.length; i++) for (let j = i + 1; j < N.polys.length; j++) {
    const P = N.polys[i], Q = N.polys[j], m = 0.2 * size;
    if (P.box[0] > Q.box[2] + m || P.box[2] < Q.box[0] - m || P.box[1] > Q.box[3] + m || P.box[3] < Q.box[1] - m) continue;
    const d = polyGap(P.pts, Q.pts);
    if (d < own) own = d;
  }
  // turns at the vertices of curves: the share of vertices that turn between 9 and 35 degrees (a visible corner on a curve)
  let kinks = 0, longest = 0;
  for (const P of N.polys) {
    const p = P.pts, n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const a = (i + n - 1) % n, b = (i + 1) % n, ux = p[2 * i] - p[2 * a], uy = p[2 * i + 1] - p[2 * a + 1], vx = p[2 * b] - p[2 * i], vy = p[2 * b + 1] - p[2 * i + 1];
      const t = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)) * 180 / Math.PI;
      if (t > 9 && t < 35) kinks++;
      const l = Math.hypot(vx, vy) / size;
      if (t > 2 && l > longest) longest = l;
    }
  }
  const row = { id, ms: +times[1].toFixed(1), verts: N.verts, polys: N.polys.length, gap: +(gap / size).toFixed(4), own: +(own / size).toFixed(4), kinks, seat: res.info.seat, r: res.info.r, sigma: res.info.sigma, stretch: res.info.stretch, notes: notes.join('; ') };
  table.push(row);
  if (notes.length) bad++;
  console.log(`${id.padEnd(6)} ${String(row.ms).padStart(6)} ms  pts ${String(row.verts).padStart(4)} in ${row.polys}  gap ${row.gap}  own ${row.own}  kinks ${String(kinks).padStart(2)}  seat ${String(row.seat).padEnd(8)} r ${row.r} sigma ${row.sigma} A ${row.stretch}  ${row.notes}`);
}
console.log(bad ? `${bad} group(s) break a rule` : 'all rules kept');
