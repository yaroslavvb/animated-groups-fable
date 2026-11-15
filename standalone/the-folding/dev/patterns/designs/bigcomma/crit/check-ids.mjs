// dev/patterns/designs/bigcomma/check.mjs — the hard rules, on the 17 groups as the page has them AND as the tests hand
// them over (only id, e1, e2, reps, cellArea, domainArea, center), there and at two turned, scaled and shifted places.
//   node dev/patterns/designs/bigcomma/check.mjs [--measure 1] [--per 40]
// Prints one line per group and case; exits 1 when a hard rule is broken.
import { GROUPS, elementsNear } from '../../../../../src/groups.js';
import { compose, inverse, iso } from '../../../../../src/geom.js';
import { normalize, measure, GAP_MIN, MAX_VERTS } from '../../../kit.js';
import { find, KNOBS } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];

function moved(g, ang, k, tx, ty) {                                  // the group carried by T = shift o scale o turn
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (v) => [k * (c * v[0] - s * v[1]), k * (s * v[0] + c * v[1])], T = (p) => { const q = P(p); return [q[0] + tx, q[1] + ty]; };
  const R = iso(c, -s, s, c, 0, 0), Ri = inverse(R);
  const reps = g.reps.map((r) => { const L = compose(R, compose(iso(r.a, r.b, r.c, r.d, 0, 0), Ri)); const t = T([r.tx, r.ty]); const o = T([0, 0]);
    // T r T^-1 (x) = L x + (T(r(0)) - L T(0))
    const r0 = T([r.tx, r.ty]); return { a: L.a, b: L.b, c: L.c, d: L.d, tx: r0[0] - (L.a * o[0] + L.b * o[1]), ty: r0[1] - (L.c * o[0] + L.d * o[1]) }; });
  return { group: { id: g.id, e1: P(g.e1), e2: P(g.e2), reps, cellArea: g.cellArea * k * k, domainArea: g.domainArea * k * k, center: T(g.center) }, T };
}
function segDist(x, y, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - ax - t * dx, y - ay - t * dy); }
function minGap(group, N) {
  const size = Math.sqrt(group.domainArea), pts = [];
  for (const P of N.polys) for (let i = 0; i < P.pts.length; i += 2) pts.push([P.pts[i], P.pts[i + 1]]);
  let best = Infinity;
  for (const g of elementsNear(group, N.cx, N.cy, 2 * N.R + 0.5 * size, N.cx, N.cy)) {
    if (Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.hypot(g.tx, g.ty) < 1e-9 * size) continue;
    for (const P of N.polys) {
      const m = P.pts.length / 2, Q = new Float64Array(2 * m);
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let i = 0; i < m; i++) { const x = P.pts[2 * i], y = P.pts[2 * i + 1]; Q[2 * i] = g.a * x + g.b * y + g.tx; Q[2 * i + 1] = g.c * x + g.d * y + g.ty; bx0 = Math.min(bx0, Q[2 * i]); by0 = Math.min(by0, Q[2 * i + 1]); bx1 = Math.max(bx1, Q[2 * i]); by1 = Math.max(by1, Q[2 * i + 1]); }
      for (const p of pts) {
        if (p[0] < bx0 - best || p[0] > bx1 + best || p[1] < by0 - best || p[1] > by1 + best) continue;
        for (let i = 0; i < m; i++) { const j = (i + 1) % m, d = segDist(p[0], p[1], Q[2 * i], Q[2 * i + 1], Q[2 * j], Q[2 * j + 1]); if (d < best) best = d; }
      }
    }
  }
  return best / size;
}
function inside(p, x, y) { let inn = false; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) { const yi = p[2 * i + 1], yj = p[2 * j + 1]; if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn; } return inn; }
function shapeFaults(group, N) {                                    // self-crossing, a hole outside its outer polygon, long segments
  const out = [], size = Math.sqrt(group.domainArea);
  for (const P of N.polys) {
    const p = P.pts, n = p.length / 2;
    let longest = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; longest = Math.max(longest, Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1])); }
    if (longest > 0.021 * size) out.push('segment ' + (longest / size).toFixed(3));
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * ((i + 1) % n)], by = p[2 * ((i + 1) % n) + 1], cx = p[2 * j], cy = p[2 * j + 1], dx = p[2 * ((j + 1) % n)], dy = p[2 * ((j + 1) % n) + 1];
      const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      if ((d1 > 0) === (d2 > 0)) continue;
      const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      if ((d3 > 0) !== (d4 > 0)) { out.push('self-crossing'); i = n; break; }
    }
    if (P.hole && !N.polys.some((Q) => !Q.hole && inside(Q.pts, p[0], p[1]) && inside(Q.pts, p[2 * Math.floor(n / 2)], p[2 * Math.floor(n / 2) + 1]))) out.push('hole outside');
  }
  return out;
}

let bad = 0;
const places = [null, [37 * Math.PI / 180, 1.7, 3.1, -2.2], [-112 * Math.PI / 180, 0.4, -50, 80]];
const IDS = opt.ids ? opt.ids.split(',') : null;
if (opt.knobs) for (const kv of opt.knobs.split(',')) { const [k, v] = kv.split('='); KNOBS[k] = +v; }
for (const g of GROUPS.filter((x) => !IDS || IDS.includes(x.id))) {
  const bare = { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center };
  let ref = null;
  for (const [name, given, T] of [['page', g, null], ['bare', bare, null], ...places.slice(1).map((pl, i) => { const m = moved(g, ...pl); return ['moved' + (i + 1), m.group, m.T]; })]) {
    const row = [g.id.padEnd(6), name.padEnd(7)];
    try {
      find(given);
      const t0 = performance.now(), res = find(given), ms = performance.now() - t0, N = normalize(res.shapes);
      const gap = minGap(given, N), faults = shapeFaults(given, N);
      if (gap < GAP_MIN) faults.push('gap ' + gap.toFixed(4));
      if (N.verts > MAX_VERTS) faults.push(N.verts + ' vertices');
      row.push('ms', ms.toFixed(0).padStart(4), 'pts', String(N.verts).padStart(4), 'gap', gap.toFixed(3), 'dark', res.info.dark.toFixed(3), 'bare', res.info.bare.toFixed(3), 'dots', res.info.dots.length);
      if (opt.measure === '1') { const m = measure(given, N, { per: +opt.per || 40 }); row.push('| kit dark', m.coverage.toFixed(3), 'bare', m.emptyDisc.toFixed(3), 'solid', m.darkDisc.toFixed(3), 'over', m.overlap.toFixed(3)); if (m.overlap > 0.004) faults.push('overlap'); }
      // a moved group must get the moved pattern: compare with the pattern of the bare group, carried by T
      if (name === 'bare') ref = res.shapes;
      if (T && ref) {
        // how far the outlines lie apart (each point of one to the other polygon), in tile sizes
        let dev = res.shapes.length === ref.length ? 0 : Infinity;
        if (dev === 0) res.shapes.forEach((sh, i) => {
          const A = sh.pts, B = ref[i].pts.map(T);
          for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) { let d = Infinity; for (let j = 0; j < Q.length; j++) { const a = Q[j], b = Q[(j + 1) % Q.length]; d = Math.min(d, segDist(p[0], p[1], a[0], a[1], b[0], b[1])); } dev = Math.max(dev, d / Math.sqrt(given.domainArea)); }
        });
        row.push('| moved pattern off by', dev === Infinity ? 'ANOTHER PATTERN' : dev.toExponential(1));
        if (dev > 5e-3) faults.push('not the moved pattern');
      }
      if (faults.length) { bad++; row.push('!!', faults.join(', ')); }
    } catch (e) { bad++; row.push('ERROR', String(e && e.stack || e).split('\n').slice(0, 2).join(' | ')); }
    console.log(row.join(' '));
  }
}
console.log(bad ? `${bad} FAULT(S)` : 'all hard rules hold');
process.exit(bad ? 1 : 0);
