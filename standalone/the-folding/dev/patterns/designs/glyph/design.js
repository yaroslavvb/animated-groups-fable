// dev/patterns/designs/glyph/design.js — "Letter F": one bold F per tile, drawn INTO the tile, with a full stop.
//
// The crystallographer's own asymmetric motif. An F has a direction (top -> foot) and a hand (its arms are on one
// side), so translated copies are parallel, rotated copies turn about the centres, and mirrored or glided copies read
// backwards: a mirrored letter is seen as wrong at once. Here the F is not stamped into the tile, it is built from the
// tile: its stem runs along one side, its top arm along the next, the middle arm between them, and what the far sides
// of the tile cut off is cut off (a slanted terminal). So a rectangle carries an upright F, a parallelogram an italic
// one, a right triangle an F whose hull is the triangle. Bold: about 0.22 tile sizes of stroke, half the tile dark.
//
// The rule (NOTES.md has the reasons and the numbers; the knobs are K below):
//   1. The tile D: the Dirichlet tile of the page's default seed when group.presets exists (so the default tile holds
//      the whole F, and its F is no mirror image), else of a seed found from the symmetry elements (ruleSeed: for 12
//      groups the very same pattern, for the other 5 one that differs by a symmetry of the tile).
//   2. A parallelogram tile more than `split` times longer than wide is cut across into equal parts, one F each
//      (*x: three; 22*, 2*22: two, which are the two faces of the folded shape).
//   3. D is inset by `margin`: copies of the F stay 2 x margin apart, a white channel that draws the tiling. At a corner
//      where two MIRRORS cross the margin grows with the angle (`cornerWide`): wide at a right angle, where four F's
//      would close their corners into a square ring, narrow at 45 and 30 degrees, where eight or twelve tips must meet
//      or leave a bare star. The channel along a mirror runs from the one to the other, so an F and its reflection
//      part in a V and stay two letters (the critic's change, 13 Nov 2026: the kaleidoscopes had read as a fret).
//   4. Frames. Every corner of the inset tile is tried as the F's top-left corner: stem along the next side and top arm
//      along the previous one (the F leans as the corner does); at an obtuse corner also an F that leans `italic` only;
//      in a hexagon also a stem along the chord to the next corner but one; in a triangle also an upright F standing
//      on the foot of a height. Always a normal F, never its mirror image (without presets, in a group with mirrors,
//      either: the mirrored F is the normal F of the neighbouring chamber).
//   5. Weight. The arm is `weight` thick, less where the F's own channels or `target` (the share of dark) ask for less.
//   6. Bare patches, measured on the whole pattern (every copy, so that bays that meet across a mirror or round a
//      centre count as one): while a bare disc larger than `dotBare` stays, a full stop is set on the F's baseline (at
//      the far corner of its box, half way, or right after the stem as a period is set: whichever leaves the smallest
//      bare disc); else in the patch itself, when one of a proper size fits there; else the middle arm is tried lower,
//      longer, the F bolder. A row of F's (rule 2) always ends with its full stop, at the far corner.
//   7. An F that leans more than `leanFree` with a top arm as long as its stem reads as a chevron: its arm stops at
//      `leanArm` of the stem, and the rest of it stays beyond a channel as a chip in the far corner (*333, 3*3).
//   8. The frame with the best score wins: dark share, bare disc, lean, arm over stem, and (only to break ties) the
//      F standing upright on the page.
//   9. Corners are rounded by `round`, tips sharper than 70 degrees by `tip`.
import { elementsNear, symmetryElements } from '../../../../src/groups.js';

export const meta = { key: 'glyph', label: 'Letter F', hint: 'a bold F in every tile: it turns about the centres and reads backwards across a mirror or a glide' };

// ---- knobs (lengths in tile sizes = sqrt(domainArea), unless said otherwise) -----------------------------------------
export const K = {
  margin: 0.034,        // the F keeps this distance from the sides of its tile (channel between copies = 2 x margin)
  cornerWide: 0.08,     // at a corner between two mirrors the margin is margin + cornerWide x (angle - 30 deg) / 60 deg:
                        // 0.114 at a right angle, 0.054 at 45 degrees, 0.034 at 30 (critique 1)
  weight: 0.225,        // thickness of an arm: one weight for the whole family, where the tile allows it
  target: 0.53,         // ... but the F covers at most this share of its tile (a full stop comes on top; critique 3)
  stemOverArm: 1.14,    // stem thickness / arm thickness
  stemMax: 0.46,        // the stem takes at most this share of the top arm's length
  midAt: 0.48,          // centre line of the middle arm, as a share of the stem's length
  midLen: 0.68,         // free length of the middle arm / free length of the top arm
  gapMin: 0.07,         // smallest channel between the two arms
  gapOverArm: 0.5,      // ... and at least this share of the arm's thickness
  italic: 0.245,        // how far an F leans at an obtuse corner that would ask for more (radians: 14 degrees)
  leanFree: 0.26,       // |cos| of the angle between stem and arms up to which a lean costs nothing (15 degrees)
  leanArm: 0.72,        // an F that leans more keeps its top arm shorter than this share of its stem (else: a chevron)
  chipGap: 0.09,        // the channel between such an arm and the chip of it that stays in the far corner
  round: 0.034,         // corner radius
  tip: 0.02,            // ... of a tip sharper than about 70 degrees (a stem's foot in a thin corner of the tile)
  seg: 0.013,           // length of a segment of a rounded corner
  dotBare: 0.40,        // a full stop is set at the F's foot while the pattern's largest bare disc is larger than this
  dotSize: 1.12,        // side of the full stop / arm thickness
  dotGap: 0.06,         // the channel a full stop at the foot leaves to the stem and to the middle arm, at least
  patchBare: 0.37,      // ... or in a bare patch that the F's box does not reach, while the disc is larger than this
  patchMin: 0.85,       // there it is at least this many arm thicknesses wide, or it is not set
  dotClear: 0.075,      // and keeps this distance from the F
  patchCost: 0.05,      // ... and costs this much of the score: a dot floating free of its letter is speckle (critique 6)
  lowBare: 0.42,        // while a bare disc larger than this stays, the middle arm is tried lower: its centre at midLow
  midLow: 0.55,
  longBare: 0.45,       // ... while one larger than this stays, lower and longer: midLong of the top arm
  midLong: 0.86,
  boldBare: 0.43,       // ... and the F bolder: up to targetBold of the tile (never beyond `weight`)
  targetBold: 0.6,
  split: 2.45,          // a tile longer than this many of its widths is cut across into parts
  part: 1.65,           // ... each about this many widths long
  // which lattice direction is "to the right" on the page, as integers (i, j) of i e1 + j e2 ([1, 0] elsewhere).
  // It only chooses between frames that are equally good, so that the F of the home tile stands upright or lies on its back
  right: { '*x': [1, 1], '2*22': [1, -1] },
  // for experiments only (dev/patterns/designs/glyph/explain.mjs): debug = true adds info.tried; pick = { id: { kind, i } }
  // restricts a group's frames
  debug: false, pick: null,
};

const hyp = Math.hypot;

// ---- small polygon helpers (polygons are [[x, y], ...], counter-clockwise unless said otherwise) ---------------------
function clipHP(pts, nx, ny, c, eps = 0) {                    // keep n.x <= c
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c;
    const pin = sp <= eps, qin = sq <= eps;
    if (pin) out.push(p);
    if (pin !== qin) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return out;
}
function area(pts) { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; }
function clean(pts, tol) {                                     // drop repeated and collinear points
  let out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || hyp(p[0] - q[0], p[1] - q[1]) > tol) out.push(p); }
  while (out.length > 1 && hyp(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= tol) out.pop();
  for (let pass = 0; pass < 3; pass++) {
    const res = [], n = out.length;
    for (let i = 0; i < n; i++) {
      const a = out[(i + n - 1) % n], b = out[i], c = out[(i + 1) % n];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const dt = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
      if (Math.abs(cr) > tol * (hyp(b[0] - a[0], b[1] - a[1]) + hyp(c[0] - b[0], c[1] - b[1])) || dt < 0) res.push(b);
    }
    if (res.length === out.length) break;
    out = res;
  }
  return out;
}
function halfPlanes(P) {                                       // outward unit normals of a counter-clockwise polygon
  const H = [];
  for (let i = 0, n = P.length; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n], l = hyp(q[0] - p[0], q[1] - p[1]);
    if (l < 1e-14) continue;
    const nx = (q[1] - p[1]) / l, ny = -(q[0] - p[0]) / l;
    H.push([nx, ny, nx * p[0] + ny * p[1]]);
  }
  return H;
}
// m: one margin, or one per side of P (side i: P[i] -> P[i+1]); a side's margin is a number, or [at P[i], at P[i+1]]
// for a side whose channel narrows toward one end (a sharp mirror corner, where many copies meet)
function inset(P, m, tol) {
  let Q = P;
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const mi = Array.isArray(m) ? m[i] : m, [m0, m1] = Array.isArray(mi) ? mi : [mi, mi];
    const p = P[i], q = P[(i + 1) % n], l = hyp(q[0] - p[0], q[1] - p[1]);
    if (l < 1e-14) continue;
    const ox = (q[1] - p[1]) / l, oy = -(q[0] - p[0]) / l;                        // outward unit normal
    const u = [p[0] - m0 * ox, p[1] - m0 * oy], v = [q[0] - m1 * ox, q[1] - m1 * oy], lv = hyp(v[0] - u[0], v[1] - u[1]);
    const nx = (v[1] - u[1]) / lv, ny = -(v[0] - u[0]) / lv;
    Q = clipHP(Q, nx, ny, nx * u[0] + ny * u[1]);
    if (Q.length < 3) return [];
  }
  return clean(Q, tol);
}
/** For each side of the convex polygon D (D[i] -> D[i+1]): does it lie on a mirror of the group? */
function mirrorSides(group, D, size) {
  let sx = 0, sy = 0; for (const p of D) { sx += p[0]; sy += p[1]; }
  const cx = sx / D.length, cy = sy / D.length;
  let r = 0; for (const p of D) r = Math.max(r, hyp(p[0] - cx, p[1] - cy));
  const M = symmetryElements(group, cx, cy, r + size).mirrors, tol = 1e-6 * size;
  const on = (m, p) => Math.abs((p[0] - m.px) * -m.uy + (p[1] - m.py) * m.ux) < tol;
  return D.map((p, i) => { const q = D[(i + 1) % D.length]; return M.some((m) => on(m, p) && on(m, q)); });
}
function rayExit(H, ox, oy, dx, dy) {                          // how far the ray stays inside the half-planes H
  let t = Infinity;
  for (const [nx, ny, c] of H) { const nd = nx * dx + ny * dy; if (nd > 1e-12) t = Math.min(t, (c - nx * ox - ny * oy) / nd); }
  return t;
}
function depth(H, x, y) { let d = Infinity; for (const [nx, ny, c] of H) d = Math.min(d, c - nx * x - ny * y); return d; }
function distSeg(x, y, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((x - a[0]) * vx + (y - a[1]) * vy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return hyp(x - a[0] - t * vx, y - a[1] - t * vy);
}
function insidePoly(pts, x, y) {
  let inn = false;
  for (let i = 0, n = pts.length, j = n - 1; i < n; j = i++) {
    const yi = pts[i][1], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < pts[i][0] + ((y - yi) * (pts[j][0] - pts[i][0])) / (yj - yi)) inn = !inn;
  }
  return inn;
}
function selfCrossing(pts) {
  const n = pts.length;
  const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = pts[i], b = pts[(i + 1) % n], c = pts[j], d = pts[(j + 1) % n];
    if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
  }
  return false;
}
function boxOf(pts) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pts) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }
  return b;
}

/** Every corner replaced by an arc of radius r (less where a side is short); arcs in segments of about `seg`. */
function roundCorners(pts, r, seg, rTip = r) {
  const n = pts.length, out = [], orient = area(pts) > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    let ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = hyp(ux, uy), lv = hyp(vx, vy);
    ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    const turn = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);       // signed exterior angle
    const tt = Math.tan(Math.abs(turn) / 2);
    if (Math.abs(turn) < 0.05 || tt > 50) { out.push(b); continue; }
    const d = Math.min((turn * orient > 1.9 ? rTip : r) * tt, 0.46 * lu, 0.46 * lv), rr = d / tt;      // a sharp tip: the small radius
    if (d < 1e-12 * (lu + lv)) { out.push(b); continue; }
    const sgn = turn > 0 ? 1 : -1;
    const sx = b[0] - d * ux, sy = b[1] - d * uy;                        // where the arc starts
    const cx = sx - sgn * rr * uy, cy = sy + sgn * rr * ux;              // its centre: to the left of the travel for a left turn
    const k = Math.max(2, Math.ceil((Math.abs(turn) * rr) / seg));
    const a0 = Math.atan2(sy - cy, sx - cx);
    for (let j = 0; j <= k; j++) { const f = a0 + (turn * j) / k; out.push([cx + rr * Math.cos(f), cy + rr * Math.sin(f)]); }
  }
  return out;
}

// ---- the tile ---------------------------------------------------------------------------------------------------------
/** The Dirichlet tile of a seed (quadratic form Q = [q11, q12, q22]), counter-clockwise. */
function dirichlet(group, seed, Q = [1, 0, 1]) {
  const { e1, e2 } = group, [px, py] = seed, [q11, q12, q22] = Q;
  const diam = Math.max(hyp(e1[0] + e2[0], e1[1] + e2[1]), hyp(e1[0] - e2[0], e1[1] - e2[1]), hyp(e1[0], e1[1]), hyp(e2[0], e2[1]));
  const R = 2.5 * diam, pQp = px * (q11 * px + q12 * py) + py * (q12 * px + q22 * py);
  const nb = [];
  for (const g of elementsNear(group, px, py, R, px, py)) {
    const qx = g.a * px + g.b * py + g.tx, qy = g.c * px + g.d * py + g.ty, dx = qx - px, dy = qy - py;
    if (dx * dx + dy * dy < 1e-16 * diam * diam) continue;
    let nx = q11 * dx + q12 * dy, ny = q12 * dx + q22 * dy;
    let c = (qx * (q11 * qx + q12 * qy) + qy * (q12 * qx + q22 * qy) - pQp) / 2;
    const l = hyp(nx, ny); nx /= l; ny /= l; c /= l;
    nb.push([nx, ny, c, c - nx * px - ny * py]);
  }
  nb.sort((u, v) => u[3] - v[3]);
  const B = 4 * R;
  let P = [[px - B, py - B], [px + B, py - B], [px + B, py + B], [px - B, py + B]];
  for (const [nx, ny, c] of nb) { P = clipHP(P, nx, ny, c); if (P.length < 3) break; }
  return clean(P, 1e-9 * diam);
}
function basisMetric(u, v) {                                   // the form in which u and v are orthonormal
  const d = u[0] * v[1] - u[1] * v[0];
  const r0 = [v[1] / d, -v[0] / d], r1 = [-u[1] / d, u[0] / d];
  return [r0[0] * r0[0] + r1[0] * r1[0], r0[0] * r0[1] + r1[0] * r1[1], r0[1] * r0[1] + r1[1] * r1[1]];
}

/**
 * A seed found from the symmetry elements alone (no presets). It gives the tiles of the page's default presets, up to
 * an element of the group (dev/patterns/designs/glyph/check.mjs compares them):
 *   no point group            the lattice cell around the window's centre
 *   mirrors, a centre inside  half way from that centre to its nearest mirror   (22*, 2*22, 3*3, 4*2)
 *   mirrors, a closed chamber the chamber                                       (the kaleidoscopes)
 *   mirrors, a strip          the middle line of the strip                      (**, *x)
 *   glides only               on the glide axis nearest the centre              (xx)
 *   half-turns and glides     half way between the two nearest centres          (22x)
 *   half-turns / quarter-turns the point farthest from every centre             (2222, 442)
 *   third-turns               half way between two neighbouring centres         (333)
 *   sixth-turns               half way from a 2-fold centre to a 3-fold one     (632)
 */
function ruleSeed(group) {
  const { e1, e2 } = group, [cx, cy] = group.center;
  const L = hyp(e1[0], e1[1]) + hyp(e2[0], e2[1]), size = Math.sqrt(group.domainArea);
  if (group.reps.length === 1) return { seed: [cx, cy], metric: basisMetric(e1, e2) };
  const S = symmetryElements(group, cx, cy, 0.9 * L);
  // a generic point near the centre of the window, off every mirror: a little toward the lattice origin of the cell
  const p = [cx - 0.0137 * e1[0] - 0.0071 * e2[0], cy - 0.0137 * e1[1] - 0.0071 * e2[1]];
  const dp = (q) => hyp(q[0] - p[0], q[1] - p[1]);
  const sideOf = (m, x, y) => (x - m.px) * -m.uy + (y - m.py) * m.ux;
  const nearest = (list) => { let b = null; for (const q of list) if (!b || dp(q) < dp(b) - 1e-9 * size) b = q; return b; };
  if (S.mirrors.length) {
    const inChamber = (x, y) => S.mirrors.every((m) => sideOf(m, x, y) * sideOf(m, p[0], p[1]) > 1e-9 * size);
    const inner = S.centers.filter((c) => !c.onMirror && inChamber(c.x, c.y)).map((c) => [c.x, c.y]);
    if (inner.length) {
      const c = nearest(inner);
      let best = null;
      for (const m of S.mirrors) {
        const d = sideOf(m, c[0], c[1]), f = [c[0] + d * m.uy, c[1] - d * m.ux];
        const key = Math.abs(d) + 1e-4 * dp(f);
        if (!best || key < best.key - 1e-12) best = { key, f };
      }
      return { seed: [(c[0] + best.f[0]) / 2, (c[1] + best.f[1]) / 2] };
    }
    const B = 6 * L;
    let P = [[p[0] - B, p[1] - B], [p[0] + B, p[1] - B], [p[0] + B, p[1] + B], [p[0] - B, p[1] + B]];
    for (const m of S.mirrors) {
      const s = sideOf(m, p[0], p[1]) > 0 ? -1 : 1, nx = -m.uy * s, ny = m.ux * s;
      P = clipHP(P, nx, ny, nx * m.px + ny * m.py);
    }
    if (!P.some((q) => Math.abs(q[0] - p[0]) > 0.9 * B || Math.abs(q[1] - p[1]) > 0.9 * B)) {
      let sx = 0, sy = 0; for (const q of P) { sx += q[0]; sy += q[1]; }
      return { seed: [sx / P.length, sy / P.length] };
    }
    // a strip: the point of its middle line beside the window's centre (the strip is the one that holds p)
    let lo = null, hi = null;
    for (const m of S.mirrors) { const d = sideOf(m, p[0], p[1]); if (d > 0 && (!lo || d < lo.d)) lo = { d, m }; if (d < 0 && (!hi || -d < hi.d)) hi = { d: -d, m }; }
    const m = lo.m, move = (lo.d + hi.d) / 2 - sideOf(m, cx, cy);        // from the centre to the middle line, along the normal
    return { seed: [cx + move * -m.uy, cy + move * m.ux] };
  }
  if (!S.centers.length) {
    let best = null;
    for (const m of S.glides) { const d = sideOf(m, cx, cy); if (!best || Math.abs(d) < Math.abs(best.d) - 1e-9 * size) best = { d, m }; }
    return { seed: [cx + best.d * best.m.uy, cy - best.d * best.m.ux] };
  }
  const cs = S.centers, order = Math.max(...cs.map((c) => c.order));
  const mids = (A, Bq, share = 0.5) => {
    let dmin = Infinity; const out = [];
    for (const a of A) for (const b of Bq) { const d = hyp(a.x - b.x, a.y - b.y); if (d > 1e-9 * size && d < dmin) dmin = d; }
    for (const a of A) for (const b of Bq) { const d = hyp(a.x - b.x, a.y - b.y); if (d > 1e-9 * size && d < dmin * (1 + 1e-6)) out.push([a.x + share * (b.x - a.x), a.y + share * (b.y - a.y), Math.abs((b.x - a.x) * e1[0] + (b.y - a.y) * e1[1]) / d]); }
    // of several directions of pairs, the one most across e1 (333: the rhombus that lies along e1)
    const across = Math.min(...out.map((q) => q[2]));
    return out.filter((q) => q[2] < across + 1e-6).map((q) => [q[0], q[1]]);
  };
  if (order === 6) return { seed: nearest(mids(cs.filter((c) => c.order === 2), cs.filter((c) => c.order === 3))) };
  if (order === 3 || (order === 2 && S.glides.length)) return { seed: nearest(mids(cs, cs)) };
  // the deep holes: circumcentres of three centres with no centre nearer
  const near = cs.slice().sort((a, b) => dp([a.x, a.y]) - dp([b.x, b.y])).slice(0, 14), holes = [];
  for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) for (let k = j + 1; k < near.length; k++) {
    const a = near[i], b = near[j], c = near[k];
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-9 * size * size) continue;
    const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
    const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
    const r = hyp(a.x - ux, a.y - uy);
    if (cs.every((q) => hyp(q.x - ux, q.y - uy) > r * (1 - 1e-7))) holes.push([ux, uy, r]);
  }
  const rmax = Math.max(...holes.map((h) => h[2]));
  return { seed: nearest(holes.filter((h) => h[2] > rmax * (1 - 1e-6))).slice(0, 2) };
}

// ---- the F ------------------------------------------------------------------------------------------------------------
/**
 * The F in the inset tile (half-planes H), its top-left corner at O, the stem along the unit vector s, the arms along
 * the unit vector a (any angle to s). t = the arm's thickness. Returns { pts, area, h, l, ... } or null when the F
 * cannot be drawn (too thick for its gaps, too sharp a corner).
 */
function drawF(H, fr, t, size, midLen = K.midLen, midAt = K.midAt) {
  const { O, s, a } = fr, [sx, sy] = s, [ax, ay] = a;
  const sin = Math.abs(sx * ay - sy * ax), cos = sx * ax + sy * ay;
  if (sin < 0.45) return null;
  const ws = (K.stemOverArm * t) / sin, wa = t / sin;          // skew widths: along the arm, along the stem
  const W = (x, y) => [O[0] + x * ax + y * sx, O[1] + x * ay + y * sy];
  const e = 1e-7 * size;
  const h = rayExit(H, O[0] + 0.5 * ws * ax + e * sx, O[1] + 0.5 * ws * ay + e * sy, sx, sy);
  let l = rayExit(H, O[0] + 0.5 * wa * sx + e * ax, O[1] + 0.5 * wa * sy + e * ay, ax, ay);
  if (!(h > 0) || !(l > 0) || !isFinite(h) || !isFinite(l)) return null;
  // a leaning F with a top arm as long as its stem reads as a chevron: there the arm stops short
  const cut = Math.abs(cos) > K.leanFree && l > K.leanArm * h;
  if (cut) l = K.leanArm * h;
  if (ws > K.stemMax * l) return null;
  const y1 = midAt * h - wa / 2;                               // top of the middle arm
  if ((y1 - wa) * sin < Math.max(K.gapMin * size, K.gapOverArm * t)) return null;
  if (y1 + wa > 0.86 * h) return null;
  const L2 = ws + midLen * (l - ws), BIG = cut ? l : 8 * (l + h);
  let F = [W(0, 0), W(BIG, 0), W(BIG, wa), W(ws, wa), W(ws, y1), W(L2, y1), W(L2, y1 + wa), W(ws, y1 + wa), W(ws, 8 * (l + h)), W(0, 8 * (l + h))];
  for (const [nx, ny, c] of H) F = clipHP(F, nx, ny, c, 1e-10 * size);
  F = clean(F, 1e-7 * size);
  if (F.length < 6) return null;
  // ... and what is left of the arm beyond a channel stays as a chip in the far corner, so that no corner is bare
  let chip = null;
  if (cut) {
    const g = (K.chipGap * size) / sin, far = 8 * (l + h);
    chip = [W(l + g, 0), W(far, 0), W(far, wa), W(l + g, wa)];
    for (const [nx, ny, c] of H) chip = clipHP(chip, nx, ny, c, 1e-10 * size);
    chip = clean(chip, 1e-7 * size);
    if (chip.length < 3 || Math.abs(area(chip)) < 0.35 * wa * wa * sin) chip = null;
  }
  return { pts: F, chip, area: Math.abs(area(F)) + (chip ? Math.abs(area(chip)) : 0), h, l, sin, cos, t, ws, wa, y1, W };
}
/** A full stop: a parallelogram on the F's own axes, side d (as thick strokes are), its centre at (x, y) of the frame. */
function drawDot(H, f, x, y, d, size) {
  const k = d / f.sin / 2;
  let D = [f.W(x - k, y - k), f.W(x + k, y - k), f.W(x + k, y + k), f.W(x - k, y + k)];
  for (const [nx, ny, c] of H) D = clipHP(D, nx, ny, c, 1e-10 * size);
  D = clean(D, 1e-7 * size);
  return D.length >= 3 && Math.abs(area(D)) > 0.8 * d * d / f.sin ? D : null;
}

/**
 * The largest bare disc of the PATTERN (every copy of the shapes) with its centre in the polygon D, and (with HP, the
 * half-planes of the inset tile) the best place for a full stop: the point of the inset tile farthest from all ink,
 * less the clearance, and from the tile's own inset sides. Sampled on a grid: good to about 1 / 28 of D's extent.
 */
function bareOf(group, D, HD, HP, shapes, size) {
  const b = boxOf(D), mb = boxOf(shapes.flat());
  const mx = (mb[0] + mb[2]) / 2, my = (mb[1] + mb[3]) / 2, rm = hyp(mb[2] - mb[0], mb[3] - mb[1]) / 2;
  const dx = (b[0] + b[2]) / 2, dy = (b[1] + b[3]) / 2, rd = hyp(b[2] - b[0], b[3] - b[1]) / 2;
  const copies = [];
  for (const g of elementsNear(group, dx, dy, rd + rm + 0.75 * size, mx, my)) for (const s of shapes) {
    const pts = s.map((p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty]);
    copies.push({ pts, box: boxOf(pts) });
  }
  const clear = K.dotClear * size;
  const ink = (x, y, floor) => {                               // the distance to the nearest ink (0 inside it); may stop early below `floor`
    let d = Infinity;
    for (const c of copies) {
      const bx = Math.max(c.box[0] - x, 0, x - c.box[2]), by = Math.max(c.box[1] - y, 0, y - c.box[3]);
      if (bx > 0 || by > 0) { if (hyp(bx, by) >= d) continue; }
      else if (insidePoly(c.pts, x, y)) return 0;
      for (let i = 0, n = c.pts.length; i < n; i++) d = Math.min(d, distSeg(x, y, c.pts[i], c.pts[(i + 1) % n]));
      if (d <= floor) return d;
    }
    return d;
  };
  let bare = 0, at = null, spot = null, room = 0;
  // a coarse grid, the corners and the middles of the sides (where the copies of a tile meet: a grid can miss a thin
  // corner), then twice finer around the four best places that lie apart
  const seen = [];
  const look = (x, y, keep) => {
    if (depth(HD, x, y) < -1e-9 * size) return;
    const d = ink(x, y, keep ? 0 : bare);
    if (keep && d > 0) seen.push([d, x, y]);
    if (d > bare) { bare = d; at = [x, y]; }
  };
  const step = Math.max(b[2] - b[0], b[3] - b[1]) / 26;
  for (let y = b[1] + step / 2; y < b[3]; y += step) for (let x = b[0] + step / 2; x < b[2]; x += step) look(x, y, true);
  for (let i = 0, n = D.length; i < n; i++) { const p = D[i], q = D[(i + 1) % n]; look(p[0], p[1], true); look((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, true); }
  seen.sort((u, v) => v[0] - u[0]);
  const tops = [];
  for (const s of seen) { if (tops.length >= 4 || s[0] < 0.6 * bare) break; if (tops.every((t) => hyp(t[1] - s[1], t[2] - s[2]) > 2.5 * step)) tops.push(s); }
  for (const [, cx, cy] of tops) for (let pass = 1, st = step / 3; pass <= 2; pass++, st /= 3) {
    let best = [cx, cy, 0];
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = (pass === 1 ? cx : best[0]) + i * st, y = (pass === 1 ? cy : best[1]) + j * st; if (depth(HD, x, y) < -1e-9 * size) continue; const d = ink(x, y, 0); if (d > best[2]) best = [x, y, d]; if (d > bare) { bare = d; at = [x, y]; } }
    if (pass === 1 && best[2] === 0) break;
  }
  // the place for a full stop: inside the largest bare disc (so that it breaks it), as far from ink and sides as can be
  if (HP && at) for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
    const x = at[0] + (i * bare) / 8, y = at[1] + (j * bare) / 8;
    if (i * i + j * j > 64) continue;
    const dP = depth(HP, x, y);
    if (dP <= room) continue;
    const r = Math.min(ink(x, y, room + clear) - clear, dP);
    if (r > room) { room = r; spot = [x, y]; }
  }
  return { bare: (2 * bare) / size, spot, room };
}

/** The frames an F can take in the inset tile P: { O, s, a, hand, kind }. hand 1: a normal F; -1: its mirror image. */
function frames(P, hands, size) {
  const n = P.length, out = [];
  const unit = (p, q) => { const l = hyp(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
  const perp = (v, toward) => { const w = [-v[1], v[0]]; return w[0] * toward[0] + w[1] * toward[1] > 0 ? w : [v[1], -v[0]]; };
  for (let i = 0; i < n; i++) for (const hand of hands) {
    const O = P[i], nx = P[(i + hand + n) % n], pv = P[(i - hand + n) % n];
    const s = unit(O, nx), a = unit(O, pv), cos = s[0] * a[0] + s[1] * a[1];
    out.push({ O, s, a, hand, kind: 'side', i });
    if (n > 4) out.push({ O, s: unit(O, P[(i + 2 * hand + 2 * n) % n]), a, hand, kind: 'chord', i });
    const lean = Math.acos(Math.max(-1, Math.min(1, cos))) - Math.PI / 2;
    if (lean > K.italic + 0.02) {                              // an obtuse corner: an F along either side, leaning K.italic only
      const cs = Math.cos(K.italic), sn = Math.sin(K.italic), pa = perp(s, a), ps = perp(a, s);
      out.push({ O, s, a: [cs * pa[0] - sn * s[0], cs * pa[1] - sn * s[1]], hand, kind: 'italic', i });
      out.push({ O, s: [cs * ps[0] - sn * a[0], cs * ps[1] - sn * a[1]], a, hand, kind: 'italic', i });
    }
  }
  // a triangle: the foot of each height cuts it into two right triangles; the F stands in one of them
  if (n === 3) for (let i = 0; i < 3; i++) {
    const V = P[i], A = P[(i + 1) % 3], B = P[(i + 2) % 3], u = unit(A, B);
    const f = (V[0] - A[0]) * u[0] + (V[1] - A[1]) * u[1], len = hyp(B[0] - A[0], B[1] - A[1]);
    if (f < 0.15 * len || f > 0.85 * len) continue;
    const M = [A[0] + f * u[0], A[1] + f * u[1]], up = unit(M, V);
    for (const along of [u, [-u[0], -u[1]]]) for (const [s, a] of [[up, along], [along, up]]) {
      const hand = a[0] * s[1] - a[1] * s[0] < 0 ? 1 : -1;      // a normal F: cross(a, s) < 0
      if (hands.includes(hand)) out.push({ O: M, s, a, hand, kind: 'height', i });
    }
  }
  return out;
}

/**
 * The best F for the convex tile D of the group (not yet inset).
 * hands: [1] a normal F only, [1, -1] its mirror image too (a group with mirrors: the mirrored F is the normal F of the
 * neighbouring chamber). right: the page's "to the right". split: { n, step, whole } when D is one of n equal parts of
 * the tile `whole`: the F is repeated in every part, the full stop only at the end of the row.
 */
function fitTile(group, D, size, tileArea, hands, right, split, margins = K.margin * size) {
  const P = inset(D, margins, 1e-9 * size);
  let best = { score: -Infinity, shapes: [] };
  if (P.length < 3) return best;
  const H = halfPlanes(P), up = [-right[1], right[0]];
  const whole = split ? split.whole : D, HW = halfPlanes(whole);
  const shift = (s, k) => s.map((p) => [p[0] + k * split.step[0], p[1] + k * split.step[1]]);
  // every part gets the F; the full stops go to the last part along the stem (or along the arms, when the stems stand across)
  const assemble = (fr, Fs, dots) => {
    if (!split) return [...Fs, ...dots];
    const out = [];
    for (let k = 0; k < split.n; k++) for (const F of Fs) out.push(shift(F, k));
    const along = fr.s[0] * split.step[0] + fr.s[1] * split.step[1], across = fr.a[0] * split.step[0] + fr.a[1] * split.step[1];
    const last = (Math.abs(along) > Math.abs(across) ? along : across) > 0 ? split.n - 1 : 0;
    for (const d of dots) out.push(shift(d, last));
    return out;
  };
  // the arm's thickness for a frame: K.weight, or what the F's own gaps allow, or what covers `target` of the tile
  const weigh = (fr, target, midLen = K.midLen, midAt = K.midAt) => {
    const can = (t) => drawF(H, fr, t, size, midLen, midAt);
    let lo = 0.06 * size, hi = K.weight * size;
    if (!can(lo)) return null;
    if (can(hi)) lo = hi;
    else for (let k = 0; k < 13; k++) { const m = (lo + hi) / 2; if (can(m)) lo = m; else hi = m; }
    let f = can(lo);
    if (f.area > target * tileArea) {
      let a = 0.06 * size, b = lo;
      for (let k = 0; k < 13; k++) { const m = (a + b) / 2; if (can(m).area > target * tileArea) b = m; else a = m; }
      f = can((a + b) / 2);
    }
    return f;
  };
  const cands = [];
  for (const fr of frames(P, hands, size)) {
    const f = weigh(fr, K.target);
    if (!f || selfCrossing(f.pts)) continue;
    const pref = -(fr.s[0] * up[0] + fr.s[1] * up[1]) + 0.6 * (fr.a[0] * right[0] + fr.a[1] * right[1]) + 0.3 * (fr.a[0] * up[0] + fr.a[1] * up[1]);
    const asp = Math.log((f.l * f.sin) / f.h);                  // arm over stem: an F is taller than wide
    const shape = -0.6 * Math.max(0, Math.abs(f.cos) - K.leanFree) - 0.45 * Math.max(0, asp - 0.05) - 0.15 * Math.max(0, -1.0 - asp)
      + 0.04 * pref - (fr.hand < 0 ? 0.03 : 0) - (fr.kind === 'side' ? 0 : 0.02);
    cands.push({ fr, f, shape, cheap: Math.min(f.area / tileArea, 0.54) + shape });
  }
  cands.sort((u, v) => v.cheap - u.cheap);
  const tried = [], pick = K.pick && K.pick[group.id];
  for (const c of pick ? cands.filter((q) => q.fr.kind === pick.kind && (pick.i === undefined || q.fr.i === pick.i)) : cands.slice(0, 6)) for (const long of [0, 1, 2, 3, 4]) {
    // where a bare patch stays, the middle arm is tried lower (1), then lower and longer (2), then the F bolder (3),
    // then bolder with the lower, longer middle arm (4)
    if (long && !(c.bare > [0, K.lowBare, K.longBare, K.boldBare, K.boldBare][long])) continue;
    const fr = c.fr, dots = [], how = [];
    const f = long === 4 ? weigh(fr, K.targetBold, K.midLong, K.midLow) : long === 3 ? weigh(fr, K.targetBold) : long ? drawF(H, fr, c.f.t, size, long === 2 ? K.midLong : K.midLen, K.midLow) : c.f;
    if (!f || (long && selfCrossing(f.pts)) || (long >= 3 && f.t < 1.01 * c.f.t)) continue;
    // the F as it will be drawn where it matters here (the sharp tips), with its chip
    const body = f.chip ? [f.pts, f.chip] : [f.pts], Ft = [roundCorners(f.pts, 0, 0.03 * size, K.tip * size), ...body.slice(1)];
    if (f.chip) how.push('chip');
    let m = bareOf(group, whole, HW, split ? null : H, assemble(fr, Ft, dots), size);
    // a full stop at the foot: the far corner of the F's box. In a row of F's it also tells the row's end.
    const bay = Math.min((f.l - f.ws) * f.sin, (f.h - f.y1 - f.wa) * f.sin);                     // the bay under the middle arm
    const d0 = Math.min(K.dotSize * f.t, bay - K.dotGap * size), k0 = d0 / f.sin / 2;
    if (d0 >= 0.8 * f.t && (split || m.bare > K.dotBare)) {
      // on the baseline: at the far corner, or (outside a row, where the far corner tells the row's end) half way, or
      // right after the stem as a period is set, where it breaks the bay that meets its reflection across a mirror
      const x0 = f.ws + (K.dotGap * size) / f.sin + k0, xs = split ? [f.l - k0] : [f.l - k0, (x0 + f.l - k0) / 2, x0];
      let at = null;
      for (const x of xs) {
        const foot = x >= x0 - 1e-9 * size ? drawDot(H, f, x, f.h - k0, d0, size) : null;
        if (!foot) continue;
        const m2 = bareOf(group, whole, HW, split ? null : H, assemble(fr, Ft, [foot]), size);
        if (!at || m2.bare < at.m.bare - 0.01) at = { foot, m: m2 };
      }
      if (at && (split || at.m.bare < m.bare - 0.02)) { dots.push(at.foot); how.push('foot'); m = at.m; }
    }
    // ... or in the bare patch itself (a tile that the F's box does not fill). The variants go on while the F without
    // such a dot leaves a bare patch: a dot that floats free of its letter is speckle, the last resort
    const plain = m.bare;
    if (!split && !dots.length && m.bare > K.patchBare && m.spot) {
      const d = Math.min(1.35 * K.dotSize * f.t, 1.414 * m.room);
      const det = fr.a[0] * fr.s[1] - fr.a[1] * fr.s[0], qx = m.spot[0] - fr.O[0], qy = m.spot[1] - fr.O[1];
      const dot = d >= K.patchMin * f.t ? drawDot(H, f, (qx * fr.s[1] - qy * fr.s[0]) / det, (fr.a[0] * qy - fr.a[1] * qx) / det, d, size) : null;
      if (dot) {
        const m2 = bareOf(group, whole, HW, H, assemble(fr, Ft, [dot]), size);
        if (m2.bare < m.bare - 0.03) { dots.push(dot); how.push('patch'); m = m2; }
      }
    }
    const cov = (f.area + dots.reduce((sum, s) => sum + Math.abs(area(s)), 0) / (split ? split.n : 1)) / tileArea;
    const score = Math.min(cov, 0.56) + c.shape - 1.1 * Math.max(0, m.bare - 0.38) - 2 * Math.max(0, m.bare - 0.45) - [0, 0.01, 0.02, 0.01, 0.02][long] - (how.includes('patch') ? K.patchCost : 0);
    c.bare = long ? Math.min(c.bare, plain) : plain;
    if (long) how.push(['', 'low', 'long', 'bold', 'bold+long'][long]);
    tried.push({ kind: fr.kind, i: fr.i, hand: fr.hand, down: Math.round((Math.atan2(fr.s[1], fr.s[0]) * 180) / Math.PI), stem: +(f.h / size).toFixed(2), arm: +((f.l * f.sin) / size).toFixed(2), t: +(f.t / size).toFixed(3), slant: Math.round((Math.acos(f.cos) * 180) / Math.PI) - 90, cov: +cov.toFixed(3), bare: +m.bare.toFixed(3), dots: how.join('+'), shape: +c.shape.toFixed(3), score: +score.toFixed(3) });
    if (score > best.score + 1e-9) best = { score, shapes: assemble(fr, body, dots), cov, bare: m.bare, f, fr, dots: how };
  }
  best.tried = tried;
  return best;
}

/** A long parallelogram tile cut across into n equal parts: { part (the first), n, step (the vector to the next) }. */
function splitLong(D, size) {
  if (D.length !== 4) return null;
  let best = null;
  for (let i = 0; i < 4; i++) {
    const p = D[i], q = D[(i + 1) % 4], r = D[(i + 2) % 4];
    const len = hyp(q[0] - p[0], q[1] - p[1]), u = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const wid = Math.abs((r[0] - q[0]) * -u[1] + (r[1] - q[1]) * u[0]);
    if (!best || len / wid > best.asp + 1e-9) best = { asp: len / wid, i, len, u };
  }
  const opp = [D[(best.i + 3) % 4][0] - D[(best.i + 2) % 4][0], D[(best.i + 3) % 4][1] - D[(best.i + 2) % 4][1]];
  if (Math.abs(hyp(opp[0], opp[1]) - best.len) > 1e-6 * size) return null;         // not a parallelogram
  if (best.asp <= K.split) return null;
  const n = Math.max(2, Math.round(best.asp / K.part)), { u, len } = best, p = D[best.i], q = D[(best.i + 1) % 4], r = D[(best.i + 2) % 4], w = D[(best.i + 3) % 4];
  const f = 1 / n;
  const part = [p, [p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])], [w[0] + f * (r[0] - w[0]), w[1] + f * (r[1] - w[1])], w];
  return { part, n, step: [u[0] * len * f, u[1] * len * f], whole: D, i: best.i };
}

const cache = new WeakMap();
export function find(group) {
  const hit = cache.get(group);
  if (hit) return hit;
  const size = Math.sqrt(group.domainArea);
  let seed, metric, from = 'rule';
  if (group.presets && group.presets[0] && group.presets[0].seed) { seed = group.presets[0].seed; metric = group.presets[0].metric; from = 'preset'; }
  else {
    try { ({ seed, metric } = ruleSeed(group)); } catch (e) { seed = null; }
    // never without a tile: a generic point beside the window's centre (ruleSeed's own starting point)
    if (!seed || !seed.every(Number.isFinite)) seed = [group.center[0] - 0.0137 * group.e1[0] - 0.0071 * group.e2[0], group.center[1] - 0.0137 * group.e1[1] - 0.0071 * group.e2[1]];
  }
  if (!metric && group.reps.length === 1) metric = basisMetric(group.e1, group.e2);
  const D = dirichlet(group, seed, metric || [1, 0, 1]);
  const mirrors = group.reps.some((r) => r.a * r.d - r.b * r.c < 0);
  const ij = K.right[group.id] || [1, 0];
  let right = [ij[0] * group.e1[0] + ij[1] * group.e2[0], ij[0] * group.e1[1] + ij[1] * group.e2[1]];
  const rl = hyp(right[0], right[1]); right = [right[0] / rl, right[1] / rl];
  const hands = from === 'preset' || !mirrors ? [1] : [1, -1];
  const sp = splitLong(D, size);
  // the margins: wider along a mirror. A part of a long tile keeps the margins of the tile's long sides, and on both
  // short sides the larger of the tile's two ends (the F is the same in every part)
  const flags = mirrorSides(group, D, size), mir = flags.map(() => K.margin * size);
  let margins = mir.map((v) => [v, v]);
  // ... and at a corner where two mirrors cross, a margin that grows with the corner's angle: wide where four copies
  // meet at a right angle (their four corners would close into a square ring), narrow where eight or twelve meet at a
  // sharp corner (there the tips must stay close, or they leave a bare star). A side's channel runs from the one to the
  // other: the letter and its reflection part in a V
  for (let j = 0, n = D.length; j < n; j++) {
    if (!flags[(j + n - 1) % n] || !flags[j]) continue;
    const a = D[(j + n - 1) % n], b = D[j], c = D[(j + 1) % n];
    const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
    const ang = Math.acos((u[0] * v[0] + u[1] * v[1]) / hyp(u[0], u[1]) / hyp(v[0], v[1]));
    const m = (K.margin + K.cornerWide * Math.max(0, Math.min(1, (ang - Math.PI / 6) / (Math.PI / 3)))) * size;
    margins[(j + n - 1) % n][1] = m; margins[j][0] = m;
  }
  if (sp) { const k = (j) => mir[(sp.i + j) % 4], ends = Math.max(k(1), k(3)); margins = [k(0), ends, k(2), ends]; }
  const fit = sp ? fitTile(group, sp.part, size, group.domainArea / sp.n, hands, right, sp, margins) : fitTile(group, D, size, group.domainArea, hands, right, null, margins);
  const r = K.round * size, seg = K.seg * size;
  if (!fit.shapes.length) {                                    // no F could be drawn (no tile of the 17 groups): the tile itself, smaller
    let sx = 0, sy = 0; for (const p of D) { sx += p[0]; sy += p[1]; }
    fit.shapes = [D.map((p) => [sx / D.length + 0.62 * (p[0] - sx / D.length), sy / D.length + 0.62 * (p[1] - sy / D.length)])];
  }
  const shapes = fit.shapes.map((pts) => ({ pts: roundCorners(pts, r, seg, K.tip * size), hole: false }));
  const f = fit.f, fr = fit.fr;
  const res = {
    shapes,
    info: {
      seed: [+seed[0].toFixed(4), +seed[1].toFixed(4)], from, sides: D.length, parts: sp ? sp.n : 1,
      kind: fr && fr.kind, corner: fr && fr.i, hand: fr && fr.hand, dots: fit.dots,
      weight: f && +(f.t / size).toFixed(3), stem: f && +(f.h / size).toFixed(3), arm: f && +((f.l * f.sin) / size).toFixed(3),
      slant: f && Math.round((Math.acos(f.cos) * 180) / Math.PI) - 90, cov: fit.cov && +fit.cov.toFixed(3), bare: fit.bare && +fit.bare.toFixed(3),
    },
  };
  if (K.debug) res.info.tried = fit.tried;
  cache.set(group, res);
  return res;
}
