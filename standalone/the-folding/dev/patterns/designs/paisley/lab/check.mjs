// lab/check.mjs — the hard rules, checked from outside the design (no browser): for each group the smallest distance
// between two different copies of marks (exact, outline to outline), whether any copy lies inside another, self-crossings
// of each polygon, vertex count, the longest segment and the largest turn between segments, and the time of find().
//   node dev/patterns/designs/paisley/lab/check.mjs [--ids o,2222] [--bare 1] [--moved 1]
// --bare 1: find() gets the group without presets; --moved 1: the group turned, scaled and shifted first (no presets).
import { GROUPS, BY_ID, elementsNear } from '../../../../../src/groups.js';
import { find } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);

export function moved(group, ang = 0.7, k = 2.3, sx = 5.1, sy = -3.3) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const M = (x, y) => [k * (ca * x - sa * y) + sx, k * (sa * x + ca * y) + sy], V = (x, y) => [k * (ca * x - sa * y), k * (sa * x + ca * y)];
  const reps = group.reps.map((g) => {
    // g' = M g M^-1 with M x = k R x + s:  L' = R L R^T,  t' = k R t + s - L' s
    const a = ca * g.a - sa * g.c, b = ca * g.b - sa * g.d, c = sa * g.a + ca * g.c, d = sa * g.b + ca * g.d;       // R L
    const L = { a: a * ca - b * sa, b: a * sa + b * ca, c: c * ca - d * sa, d: c * sa + d * ca };                    // (R L) R^T
    const t = V(g.tx, g.ty);
    return { a: L.a, b: L.b, c: L.c, d: L.d, tx: t[0] + sx - (L.a * sx + L.b * sy), ty: t[1] + sy - (L.c * sx + L.d * sy) };
  });
  const e1 = V(group.e1[0], group.e1[1]), e2 = V(group.e2[0], group.e2[1]);
  return { id: group.id, e1, e2, reps, cellArea: group.cellArea * k * k, domainArea: group.domainArea * k * k, center: M(group.center[0], group.center[1]) };
}

function segDist2(x, y, ax, ay, bx, by) { const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey; let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const dx = ax + t * ex - x, dy = ay + t * ey - y; return dx * dx + dy * dy; }
function polyDist(P, Q) { let b = Infinity; for (const [U, V] of [[P, Q], [Q, P]]) for (const p of U) for (let k = 0, l = V.length - 1; k < V.length; l = k++) b = Math.min(b, segDist2(p[0], p[1], V[l][0], V[l][1], V[k][0], V[k][1])); return Math.sqrt(b); }
function inside(P, x, y) { let inn = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > y) !== (P[j][1] > y) && x < P[i][0] + ((y - P[i][1]) * (P[j][0] - P[i][0])) / (P[j][1] - P[i][1])) inn = !inn; } return inn; }
function crossings(pts) { let n = 0; const N = pts.length; const cr = (a, b, c, d) => { const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]); if ((d1 > 0) === (d2 > 0)) return false; const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]); return (d3 > 0) !== (d4 > 0); }; for (let i = 0; i < N; i++) for (let j = i + 2; j < N; j++) { if (i === 0 && j === N - 1) continue; if (cr(pts[i], pts[(i + 1) % N], pts[j], pts[(j + 1) % N])) n++; } return n; }

let worst = { gap: Infinity, ms: 0, verts: 0 };
for (const id of ids) {
  const G0 = BY_ID[id];
  const G = opt.moved ? moved(G0) : opt.bare ? { id: G0.id, e1: G0.e1, e2: G0.e2, reps: G0.reps, cellArea: G0.cellArea, domainArea: G0.domainArea, center: G0.center } : G0;
  let res, ms = Infinity;
  for (let r = 0; r < 3; r++) { const t0 = performance.now(); res = find(G); ms = Math.min(ms, performance.now() - t0); }
  const u = Math.sqrt(G.domainArea), shapes = res.shapes.map((s) => s.pts);
  // every copy near the motif
  let cx = 0, cy = 0, n = 0, R = 0;
  for (const P of shapes) for (const p of P) { cx += p[0]; cy += p[1]; n++; }
  cx /= n; cy /= n;
  for (const P of shapes) for (const p of P) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cy));
  const els = elementsNear(G, cx, cy, 2 * R + 0.5 * u, cx, cy);
  const bound = (P) => { let x = 0, y = 0, r = 0; for (const p of P) { x += p[0]; y += p[1]; } x /= P.length; y /= P.length; for (const p of P) r = Math.max(r, Math.hypot(p[0] - x, p[1] - y)); return [x, y, r]; };
  const base = shapes.map((P) => ({ P, b: bound(P) }));
  let gap = Infinity, where = '', nested = 0;
  for (const g of els) {
    const ident = Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.tx) < 1e-9 * u && Math.abs(g.ty) < 1e-9 * u;
    shapes.forEach((P, j) => {
      const Q = P.map(([x, y]) => [g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty]), qb = bound(Q);
      base.forEach((B, i) => {
        if (ident && j <= i) return;
        if (Math.hypot(qb[0] - B.b[0], qb[1] - B.b[1]) > qb[2] + B.b[2] + 0.2 * u) return;
        const d = polyDist(B.P, Q) / u;
        if (d < gap) { gap = d; where = `mark ${i} ~ ${ident ? '' : 'g.'}mark ${j}`; }
        if (inside(B.P, Q[0][0], Q[0][1]) || inside(Q, B.P[0][0], B.P[0][1])) nested++;
      });
    });
  }
  let verts = 0, seg = 0, turn = 0, cross = 0;
  for (const P of shapes) {
    verts += P.length; cross += crossings(P);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], c2 = P[(i + 2) % P.length];
      seg = Math.max(seg, Math.hypot(b[0] - a[0], b[1] - a[1]) / u);
      let dt = Math.abs(Math.atan2(c2[1] - b[1], c2[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])); if (dt > Math.PI) dt = 2 * Math.PI - dt;
      turn = Math.max(turn, (dt * 180) / Math.PI);
    }
  }
  worst.gap = Math.min(worst.gap, gap); worst.ms = Math.max(worst.ms, ms); worst.verts = Math.max(worst.verts, verts);
  const bad = gap < 0.02 || nested || cross || verts > 2400;
  console.log(`${id.padEnd(6)} gap ${gap.toFixed(4)} (${where})${nested ? ' NESTED ' + nested : ''} cross ${cross} verts ${verts} seg ${seg.toFixed(4)} turn ${turn.toFixed(1)} ms ${ms.toFixed(1)} ${bad ? '  <<< BAD' : ''}  ${JSON.stringify(res.info)}`);
}
console.log('WORST', JSON.stringify(worst));
