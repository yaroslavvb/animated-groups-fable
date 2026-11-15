p = 'design.js'
s = open(p).read()

old = """/** The loops round the blob of root `root` (the copy that holds the root sample), in grid coordinates: [{ pts: [i, j, ...], area }]. */
function traceBlob(fld, L, root, c) {
  const { U, N1, N2 } = fld, { par, dx, dy, find } = L;
  const ri = root % N1, rj = (root - ri) / N1;
"""
new = """/**
 * The loops round one blob, in grid coordinates: [{ pts: [i, j, ...], area }], the largest first. The blob is the one of
 * root `root`; of its lattice translates, the one whose sample `at` sits at the grid place (I0, J0).
 */
function traceBlob(fld, L, root, c, at, I0, J0) {
  const { U, N1, N2 } = fld, { par, dx, dy, find } = L;
  find(at);
  const ri = I0 - dx[at], rj = J0 - dy[at];                 // where this copy's root sits
"""
assert old in s; s = s.replace(old, new)

a = s.index("export function find(group) {")
new = r'''/** Where the stroke is fattest: the home of its blob, in the frame. */
function homeOf(stroke) {
  const S = spine(stroke, 64), i = Math.round((stroke.th || 0) * S.n);
  return [S.x[i], S.y[i]];
}

/**
 * One blob of every orbit of blobs: of all its copies (and their lattice translates) the one whose summit lies nearest
 * the stroke's home, so the choice does not hang on rounding. [{ comp, I, J, d }] by distance from home.
 */
function pickBlobs(S, stroke) {
  const { F, fld, L } = S, { N1, N2, a1x, a1y, a2x, a2y, det } = fld, [hx, hy] = homeOf(stroke);
  const hi = (N1 * (hx * F.E2[1] - hy * F.E2[0])) / det, hj = (N2 * (F.E1[0] * hy - F.E1[1] * hx)) / det;
  const best = new Map();
  for (const k of L.comps) {
    const pi = k.peak % N1, pj = (k.peak - pi) / N1, m0 = Math.round((hi - pi) / N1), n0 = Math.round((hj - pj) / N2);
    for (let m = m0 - 1; m <= m0 + 1; m++) for (let n = n0 - 1; n <= n0 + 1; n++) {
      const I = pi + m * N1, J = pj + n * N2, d = Math.hypot((I - hi) * a1x + (J - hj) * a2x, (I - hi) * a1y + (J - hj) * a2y);
      const b = best.get(k.orbit);
      if (!b || d < b.d - 1e-9) best.set(k.orbit, { comp: k, I, J, d });
    }
  }
  return [...best.values()].sort((p, q) => p.d - q.d);
}

export function find(group) {
  const stroke = STROKES[group.id] || STROKES.default;
  const S = solve(group, stroke), { F, fld, L, c } = S;
  let shapes = [], blobs = 0, sym = 0;
  if (S.ok) {
    const rings = [];
    for (const { comp: k, I, J } of pickBlobs(S, stroke)) {
      if (k.stab > 1) sym++;
      const loops = traceBlob(fld, L, k.root, c, k.peak, I, J);
      if (!loops.length) continue;
      blobs++;
      // the blob's box in the frame, for the exact field
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const flat = loops.map((lp) => {
        const q = new Float64Array(lp.pts.length);
        for (let i = 0; i < lp.pts.length; i += 2) {
          const x = lp.pts[i] * fld.a1x + lp.pts[i + 1] * fld.a2x, y = lp.pts[i] * fld.a1y + lp.pts[i + 1] * fld.a2y;
          q[i] = x; q[i + 1] = y;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        return q;
      });
      const pad = 2 * H_GRID, uAt = exactField(F, S.beads, [x0 - pad, y0 - pad, x1 + pad, y1 + pad]);
      flat.forEach((q, li) => rings.push({ q, uAt, hole: li > 0 }));
    }
    // the outline, re-sampled; coarser if the vertices would be too many
    for (let coarse = 1; coarse < 6; coarse *= 1.5) {
      shapes = [];
      for (const r of rings) {
        const ring = refineLoop(r.q, r.uAt, c, H_GRID, coarse);
        if (ring.length >= 3) shapes.push({ pts: ring.map(([x, y]) => F.toW(x, y)), hole: r.hole });
      }
      if (shapes.reduce((n, sh) => n + sh.pts.length, 0) <= MAX_POINTS) break;
    }
  }
  return { shapes, info: { cover: S.cover, level: c, blobs, symmetric: sym, bounded: S.ok } };
}
'''
s = s[:a] + new

old = """/** Segments of the outline: no longer than SEG_MAX, turning at most TURN_MAX radians each, no shorter than SEG_MIN (tile sizes). */
const SEG_MAX = 0.022, SEG_MIN = 0.004, TURN_MAX = 0.14;

/** A loop (frame coordinates, flat) put ON the level line u = c and re-sampled by its curvature. */
function refineLoop(pts, uAt, c, h) {"""
new = """/** Segments of the outline: no longer than SEG_MAX, turning at most TURN_MAX radians each, no shorter than SEG_MIN (tile sizes). */
const SEG_MAX = 0.022, SEG_MIN = 0.004, TURN_MAX = 0.14;
/** All the vertices of a motif together: at most this many (the kit's limit is 2400). */
const MAX_POINTS = 2000;

/** A loop (frame coordinates, flat) put ON the level line u = c and re-sampled by its curvature (`coarse` > 1: fewer points). */
function refineLoop(pts, uAt, c, h, coarse = 1) {"""
assert old in s; s = s.replace(old, new)
old = """    want[i] = Math.min(SEG_MAX, Math.max(SEG_MIN, TURN_MAX / Math.max(1e-9, k)));"""
new = """    want[i] = coarse * Math.min(SEG_MAX, Math.max(SEG_MIN, TURN_MAX / Math.max(1e-9, k)));"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)

p = 'lab/moved.mjs'
s = open(p).read()
old = """    res.shapes.forEach((sh, i) => {
      const b = base.shapes[i];
      if (sh.pts.length !== b.pts.length) { note += ` [${k}: shape ${i} has ${sh.pts.length} points, not ${b.pts.length}]`; worst = Math.max(worst, 1); return; }
      sh.pts.forEach((p, j) => { const q = M.map(b.pts[j]); worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1]) / (sc * size)); });
    });"""
new = """    res.shapes.forEach((sh, i) => {
      const b = base.shapes[i].pts.map(M.map);
      if (sh.pts.length !== b.length) note += ` [${k}: shape ${i} has ${sh.pts.length} points, not ${b.length}]`;
      // every vertex of the moved motif lies on the outline of the carried one (the distance to its nearest side)
      for (const p of sh.pts) {
        let dmin = Infinity;
        for (let j = 0; j < b.length; j++) {
          const a = b[j], e = b[(j + 1) % b.length], ex = e[0] - a[0], ey = e[1] - a[1];
          const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey)));
          dmin = Math.min(dmin, Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey));
        }
        worst = Math.max(worst, dmin / (sc * size));
      }
    });"""
assert old in s; s = s.replace(old, new)
old = """  if (worst > 1e-6) bad++;"""
new = """  if (worst > 2e-4) bad++;"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
