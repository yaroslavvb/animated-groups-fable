// lab/fuzz.mjs — every group carried to a few turned, scaled and shifted places (no presets handed over): the hard
// rules from outside (smallest distance between copies, nesting), and find()'s own numbers. One run each.
//   node dev/patterns/designs/paisley/lab/fuzz.mjs [n=3]
import { GROUPS, elementsNear } from '../../../../../src/groups.js';
import { find } from '../design.js';
const n = +process.argv[2] || 3;
let seed = 12345;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function moved(group, ang, k, sx, sy) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const V = (x, y) => [k * (ca * x - sa * y), k * (sa * x + ca * y)];
  const reps = group.reps.map((g) => {
    const a = ca * g.a - sa * g.c, b = ca * g.b - sa * g.d, c = sa * g.a + ca * g.c, d = sa * g.b + ca * g.d;
    const L = { a: a * ca - b * sa, b: a * sa + b * ca, c: c * ca - d * sa, d: c * sa + d * ca }, t = V(g.tx, g.ty);
    return { a: L.a, b: L.b, c: L.c, d: L.d, tx: t[0] + sx - (L.a * sx + L.b * sy), ty: t[1] + sy - (L.c * sx + L.d * sy) };
  });
  const c0 = V(group.center[0], group.center[1]);
  return { id: group.id, e1: V(group.e1[0], group.e1[1]), e2: V(group.e2[0], group.e2[1]), reps, cellArea: group.cellArea * k * k, domainArea: group.domainArea * k * k, center: [c0[0] + sx, c0[1] + sy] };
}
const segD2 = (x, y, ax, ay, bx, by) => { const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey; let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const dx = ax + t * ex - x, dy = ay + t * ey - y; return dx * dx + dy * dy; };
const inside = (P, x, y) => { let inn = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < P[i][0] + ((y - P[i][1]) * (P[j][0] - P[i][0])) / (P[j][1] - P[i][1])) inn = !inn; return inn; };
let worstGap = Infinity, worstBare = 0, cmin = 1, cmax = 0, msMax = 0, bad = 0, runs = 0, sameCount = 0;
for (const G0 of GROUPS) {
  let line = G0.id.padEnd(6), first = null;
  for (let r = 0; r < n; r++) {
    const G = moved(G0, rnd() * 6.283, 0.3 + 3 * rnd(), 20 * (rnd() - 0.5), 20 * (rnd() - 0.5));
    const t0 = performance.now(); let res;
    try { res = find(G); } catch (e) { console.log(G0.id, 'THROWS', e.message); bad++; continue; }
    const ms = performance.now() - t0, u = Math.sqrt(G.domainArea), shapes = res.shapes.map((s) => s.pts), I = res.info;
    runs++; msMax = Math.max(msMax, ms);
    // the same family in the group's own frame? (sizes of the marks)
    const sig = JSON.stringify([I.long, I.e]);
    if (first === null) first = sig; else if (first === sig) sameCount++;
    let cx = 0, cy = 0, np = 0, R = 0;
    for (const P of shapes) for (const p of P) { cx += p[0]; cy += p[1]; np++; }
    cx /= np; cy /= np;
    for (const P of shapes) for (const p of P) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cy));
    const els = elementsNear(G, cx, cy, 2 * R + 0.3 * u, cx, cy);
    const bound = (P) => { let x = 0, y = 0, rr = 0; for (const p of P) { x += p[0]; y += p[1]; } x /= P.length; y /= P.length; for (const p of P) rr = Math.max(rr, Math.hypot(p[0] - x, p[1] - y)); return [x, y, rr]; };
    const base = shapes.map((P) => ({ P, b: bound(P) }));
    let gap = Infinity, nested = 0;
    for (const g of els) {
      const ident = Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.tx) < 1e-9 * u && Math.abs(g.ty) < 1e-9 * u;
      shapes.forEach((P, j) => {
        const Q = P.map(([x, y]) => [g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty]), qb = bound(Q);
        base.forEach((B, i) => {
          if (ident && j <= i) return;
          if (Math.hypot(qb[0] - B.b[0], qb[1] - B.b[1]) > qb[2] + B.b[2] + 0.1 * u) return;
          let b2 = Infinity;
          for (const [U, W] of [[B.P, Q], [Q, B.P]]) for (const p of U) for (let k = 0, l = W.length - 1; k < W.length; l = k++) { const d = segD2(p[0], p[1], W[l][0], W[l][1], W[k][0], W[k][1]); if (d < b2) b2 = d; }
          gap = Math.min(gap, Math.sqrt(b2) / u);
          if (inside(B.P, Q[0][0], Q[0][1]) || inside(Q, B.P[0][0], B.P[0][1])) nested++;
        });
      });
    }
    worstGap = Math.min(worstGap, gap); worstBare = Math.max(worstBare, I.bare); cmin = Math.min(cmin, I.cover); cmax = Math.max(cmax, I.cover);
    if (gap < 0.02 || nested) bad++;
    line += ` | gap ${gap.toFixed(3)} c ${I.cover.toFixed(2)} b ${I.bare.toFixed(2)} n ${I.marks} ${ms.toFixed(0)}ms${nested ? ' NESTED' : ''}`;
  }
  console.log(line);
}
console.log(`runs ${runs} bad ${bad} worst gap ${worstGap.toFixed(4)} bare max ${worstBare} cover ${cmin}..${cmax} ms max ${msMax.toFixed(0)}; same family as the first place: ${sameCount} of ${runs - GROUPS.length}`);
