// scratch: the hard rules, checked exactly (no grid), for every group as it is and carried to other places without
// presets:  vertices, simple polygons, the gap between two copies, the gap between the marks of one copy, the time.
//   node dev/patterns/designs/feet/scratch/verify.mjs [--ids ..]
import { GROUPS, elementsNear } from '../../../../../src/groups.js';
import { normalize, GAP_MIN, MAX_VERTS } from '../../../kit.js';
import { find } from '../design.js';
import { moved } from './moved.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);

const segDist = (ax, ay, bx, by, cx, cy, dx, dy) => {              // distance between the segments ab and cd
  const pt = (px, py, qx, qy, rx, ry) => { const ex = rx - qx, ey = ry - qy, l2 = ex * ex + ey * ey; let t = l2 ? ((px - qx) * ex + (py - qy) * ey) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - qx - t * ex, py - qy - t * ey); };
  // a proper crossing: each segment's ends strictly on either side of the other (two edges on one line do not cross:
  // their ends decide, below)
  const o = (px, py, qx, qy, rx, ry) => { const v = (qx - px) * (ry - py) - (qy - py) * (rx - px), tol = 1e-12 * (Math.abs(qx - px) + Math.abs(qy - py)) * (Math.abs(rx - px) + Math.abs(ry - py)); return v > tol ? 1 : v < -tol ? -1 : 0; };
  if (o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0) return 0;
  return Math.min(pt(ax, ay, cx, cy, dx, dy), pt(bx, by, cx, cy, dx, dy), pt(cx, cy, ax, ay, bx, by), pt(dx, dy, ax, ay, bx, by));
};
function selfCrossing(p) {
  const n = p.length / 2;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = i, b = (i + 1) % n, c = j, d = (j + 1) % n;
    if (segDist(p[2 * a], p[2 * a + 1], p[2 * b], p[2 * b + 1], p[2 * c], p[2 * c + 1], p[2 * d], p[2 * d + 1]) === 0) return true;
  }
  return false;
}
function polyDist(p, q, T) {                                          // distance between polygon p and T(q); 0 when they cross
  let best = Infinity;
  const n = p.length / 2, m = q.length / 2, tq = new Float64Array(q.length);
  for (let j = 0; j < m; j++) { tq[2 * j] = T.a * q[2 * j] + T.b * q[2 * j + 1] + T.tx; tq[2 * j + 1] = T.c * q[2 * j] + T.d * q[2 * j + 1] + T.ty; }
  for (let i = 0; i < n; i++) { const i2 = (i + 1) % n; for (let j = 0; j < m; j++) { const j2 = (j + 1) % m; const d = segDist(p[2 * i], p[2 * i + 1], p[2 * i2], p[2 * i2 + 1], tq[2 * j], tq[2 * j + 1], tq[2 * j2], tq[2 * j2 + 1]); if (d < best) best = d; } }
  return best;
}
const I = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const f = (v) => v.toFixed(3);
let bad = 0, slowest = 0;
let places = [null, [0.7, 1.7, [3.1, -2.2]], [2.9, 0.31, [-40, 17]], [-1.234, 12, [1000, -2000]]];
if (opt.place) places = [places[+opt.place]];
for (const g0 of GROUPS) {
  if (!ids.includes(g0.id)) continue;
  const rows = [];
  for (const pl of places) {
    const g = pl ? moved(g0, ...pl) : g0, ts = Math.sqrt(g.domainArea);
    const t0 = performance.now();
    let res = find(g);
    const first = performance.now() - t0;
    const t1 = performance.now();
    for (let k = 0; k < 4; k++) res = find(g);
    const ms = (performance.now() - t1) / 4;
    slowest = Math.max(slowest, ms);
    const N = normalize(res.shapes);
    const problems = [];
    if (N.verts > MAX_VERTS) problems.push(N.verts + ' vertices');
    if (ms > 120) problems.push(ms.toFixed(0) + ' ms');
    for (const P of N.polys) if (selfCrossing(P.pts)) problems.push('a polygon crosses itself');
    if (res.info.feet.length !== res.info.frames.length) problems.push('a foot is missing');
    // the copies near the motif
    let copyGap = Infinity;
    for (const e of elementsNear(g, N.cx, N.cy, 2 * N.R + 0.5 * ts, N.cx, N.cy)) {
      if (Math.abs(e.a - 1) < 1e-9 && Math.abs(e.d - 1) < 1e-9 && Math.abs(e.tx) < 1e-9 * ts && Math.abs(e.ty) < 1e-9 * ts) continue;
      for (const P of N.polys) for (const Q of N.polys) { const d = polyDist(P.pts, Q.pts, e); if (d < copyGap) { copyGap = d; if (opt.why && d < 0.02 * ts) console.log('   near:', JSON.stringify(e), 'd', d / ts); } }
    }
    let ownGap = Infinity;
    for (let i = 0; i < N.polys.length; i++) for (let j = i + 1; j < N.polys.length; j++) ownGap = Math.min(ownGap, polyDist(N.polys[i].pts, N.polys[j].pts, I));
    if (copyGap / ts < GAP_MIN) problems.push('copies ' + f(copyGap / ts) + ' apart');
    // the step of the curves: the longest edge that turns
    let step = 0, sharp = 0;
    for (const P of N.polys) {
      const p = P.pts, n = p.length / 2;
      for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n, b = (i + 1) % n;
        const ux = p[2 * i] - p[2 * a], uy = p[2 * i + 1] - p[2 * a + 1], vx = p[2 * b] - p[2 * i], vy = p[2 * b + 1] - p[2 * i + 1];
        const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
        if (turn > 0.02) step = Math.max(step, Math.min(Math.hypot(ux, uy), Math.hypot(vx, vy)) / ts);
        sharp = Math.max(sharp, turn);
      }
    }
    rows.push({ cover: res.info.coverage, verts: N.verts, ms, first, copyGap: copyGap / ts, ownGap: ownGap / ts, step, sharp: (sharp * 180) / Math.PI, problems });
    if (problems.length) bad++;
  }
  const r = rows[0];
  const same = rows.every((q) => Math.abs(q.cover - r.cover) < 1e-4 && Math.abs(q.verts - r.verts) <= 2);
  console.log(`${g0.id.padEnd(6)} cover ${f(r.cover)}  ${String(r.verts).padStart(4)} pts  ${r.ms.toFixed(1).padStart(5)} ms (first ${r.first.toFixed(0)})  copies ${f(Math.min(...rows.map((q) => q.copyGap)))} apart  marks ${f(Math.min(...rows.map((q) => q.ownGap)))} apart  curve step ${f(Math.max(...rows.map((q) => q.step)))}  sharpest turn ${Math.max(...rows.map((q) => q.sharp)).toFixed(0)} deg  ${same ? 'same in ' + rows.length + ' places (cover within ' + Math.max(...rows.map((q) => Math.abs(q.cover - r.cover))).toExponential(1) + ')' : 'DIFFERS: ' + rows.map((q) => q.cover.toFixed(5) + '/' + q.verts).join(' ')}  ${rows.flatMap((q) => q.problems).join('; ')}`);
  if (!same) bad++;
}
console.log(bad ? `${bad} PROBLEMS` : 'all hard rules hold', ' slowest find', slowest.toFixed(1), 'ms');
