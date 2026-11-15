// group-facts.mjs — facts about the 17 groups that the shape-print code relies on (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/group-facts.mjs
// (a) every rep's linear part maps the lattice of e1, e2 onto itself (compile() relies on it: L_r^-1 w runs over the lattice)
// (b) the reps are distinct cosets; which are pure translations (a centred cell)
// (c) the identity is reps[0]? the reduced basis, its angle, the texel pitch of bakeShapes in tile sizes
import { GROUPS } from '../../../src/groups.js';

const f = (v, d = 4) => (Math.round(v * 10 ** d) / 10 ** d).toString();
for (const g of GROUPS) {
  const { e1, e2 } = g, D = e1[0] * e2[1] - e1[1] * e2[0];
  const coords = (x, y) => [(x * e2[1] - y * e2[0]) / D, (e1[0] * y - e1[1] * x) / D];
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  let badLattice = 0, pureT = 0, idAt = -1, dup = 0;
  g.reps.forEach((r, k) => {
    for (const w of [e1, e2]) {
      const im = [r.a * w[0] + r.b * w[1], r.c * w[0] + r.d * w[1]], c = coords(im[0], im[1]);
      if (!isInt(c[0]) || !isInt(c[1])) badLattice++;
    }
    const lin = Math.abs(r.a - 1) + Math.abs(r.b) + Math.abs(r.c) + Math.abs(r.d - 1) < 1e-12;
    if (lin) { const c = coords(r.tx, r.ty); if (isInt(c[0]) && isInt(c[1])) { if (idAt < 0) idAt = k; } else pureT++; }
    g.reps.forEach((q, j) => {
      if (j <= k) return;
      if (Math.abs(r.a - q.a) + Math.abs(r.b - q.b) + Math.abs(r.c - q.c) + Math.abs(r.d - q.d) > 1e-9) return;
      const c = coords(r.tx - q.tx, r.ty - q.ty);
      if (isInt(c[0]) && isInt(c[1])) dup++;
    });
  });
  // reduced basis
  let ux = e1[0], uy = e1[1], vx = e2[0], vy = e2[1];
  for (let it = 0; it < 200; it++) {
    if (ux * ux + uy * uy > vx * vx + vy * vy) { let t = ux; ux = vx; vx = t; t = uy; uy = vy; vy = t; }
    const m = Math.round((ux * vx + uy * vy) / (ux * ux + uy * uy));
    if (!m) break;
    vx -= m * ux; vy -= m * uy;
  }
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy), ang = (Math.acos((ux * vx + uy * vy) / (lu * lv)) * 180) / Math.PI;
  const size = Math.sqrt(g.domainArea), pitch = Math.max(lu, lv) / 1024;
  const ang0 = (Math.acos((e1[0] * e2[0] + e1[1] * e2[1]) / (Math.hypot(...e1) * Math.hypot(...e2))) * 180) / Math.PI;
  console.log(`${g.id.padEnd(6)} reps ${String(g.reps.length).padStart(2)}  det ${D > 0 ? '+' : '-'}  e1,e2 ${f(Math.hypot(...e1), 3)},${f(Math.hypot(...e2), 3)} at ${f(ang0, 1)}°  reduced ${f(lu, 3)},${f(lv, 3)} at ${f(ang, 1)}°  size ${f(size, 3)}  texel ${f(pitch / size, 5)} tile  centre ${g.center.map((v) => f(v, 3))}  identity rep ${idAt}  pure translations ${pureT}  lattice not kept ${badLattice}  duplicate cosets ${dup}  viewHalf ${g.viewHalf}`);
}
