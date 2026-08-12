/* Exact contact detection between two looping balls.
 *
 * Two balls of radius r overlap when their centres come within one diameter
 * AT THE SAME INSTANT:  |q_a(t) - q_b(t)| >= 2r  for every t. This is a
 * horizontal, equal-time condition. In the 3D box two world-tubes may pass
 * within a hair of each other and never touch, because the near miss is
 * vertical — a difference in time, not in space — so nothing here ever
 * measures a 3D distance.
 *
 * Both centres are piecewise linear in t and 1-periodic, so on any interval
 * where both are linear their difference is affine and the squared distance
 * is a QUADRATIC in t. Its minimum there is the clamped vertex of that
 * parabola: closed form, no sampling and no tolerance. Merging the two
 * breakpoint sets gives the partition on which that holds, and the loop's
 * closing piece — last breakpoint back to the start point at t = 1 — is one
 * of its intervals, so the seam at t = 1 is not a special case and a closest
 * approach that straddles it is found like any other.
 *
 * The gap |D(t)| is the norm of an affine function, hence CONVEX on each
 * interval: it falls to the vertex and rises after. So the critical times —
 * the partition nodes, plus each interval's vertex when that vertex is
 * interior — cut the loop into pieces on which the gap is monotone, and a
 * local minimum of the gap is exactly a critical time no higher than its two
 * neighbours around the cycle. That is the whole of contacts().
 *
 * A path is {pts: [{t, x, y}, ...]} in CARTESIAN coordinates, sorted by t,
 * with pts[0].t === 0, closed: the last segment runs back to pts[0] at t = 1.
 */
"use strict";

/* Breakpoints closer than this in time are one breakpoint. Times come from
 * small rationals, so this only ever merges what arithmetic split. */
const EPS_T = 1e-12;

/* Two gaps count as equal here when they agree to this relative slack. Used
 * only to recognise a PLATEAU — a stretch where the gap does not change, as
 * for two balls moving in parallel — so that it is reported as one contact
 * rather than as one per critical time. */
const eqGap = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/* The loop as linear pieces covering [0,1], the closing piece included.
 *
 * Pieces of zero duration are dropped: a caller may repeat a time (two
 * breakpoints at the same instant) or append the closing point explicitly,
 * and neither should become a division by zero. A single breakpoint yields
 * one constant piece — a stationary ball. */
function segments(path) {
  const pts = path.pts;
  const n = pts.length;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = i + 1 < n ? pts[i + 1] : pts[0];
    const t1 = i + 1 < n ? b.t : 1;
    if (t1 - a.t <= EPS_T) continue;
    segs.push({ t0: a.t, t1: t1, x0: a.x, y0: a.y, x1: b.x, y1: b.y });
  }
  if (!segs.length) {
    const p = pts[0];
    segs.push({ t0: 0, t1: 1, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }
  return segs;
}

function atSeg(s, t) {
  let f = (t - s.t0) / (s.t1 - s.t0);
  if (f < 0) f = 0; else if (f > 1) f = 1;
  return [s.x0 + f * (s.x1 - s.x0), s.y0 + f * (s.y1 - s.y0)];
}

function posOn(segs, t) {
  const u = ((t % 1) + 1) % 1;
  let j = 0;
  while (j + 1 < segs.length && segs[j + 1].t0 <= u) j++;
  return atSeg(segs[j], u);
}

/* Sorted breakpoint times of both loops, from 0 to 1 inclusive. */
function mergeTimes(segsA, segsB) {
  const raw = [0];
  for (let i = 0; i < segsA.length; i++) raw.push(segsA[i].t0);
  for (let i = 0; i < segsB.length; i++) raw.push(segsB[i].t0);
  raw.push(1);
  raw.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] < 0 || raw[i] > 1) continue;
    if (!out.length || raw[i] - out[out.length - 1] > EPS_T) out.push(raw[i]);
  }
  if (out[out.length - 1] < 1) out.push(1);
  return out;
}

/* The gap on one interval where both loops are linear: its two endpoint
 * values and the closed-form minimum between them. */
function pieceGap(sa, sb, ta, tb) {
  const A0 = atSeg(sa, ta), A1 = atSeg(sa, tb);
  const B0 = atSeg(sb, ta), B1 = atSeg(sb, tb);
  const wx = A0[0] - B0[0], wy = A0[1] - B0[1];
  const dx = (A1[0] - B1[0]) - wx, dy = (A1[1] - B1[1]) - wy;
  const q = dx * dx + dy * dy;
  /* q = 0 is a constant difference: the two balls hold station relative to
   * each other over this interval, and every point of it is the minimum. */
  let s = q > 0 ? -(wx * dx + wy * dy) / q : 0;
  if (s < 0) s = 0; else if (s > 1) s = 1;
  const mx = wx + s * dx, my = wy + s * dy;
  return {
    s: s,
    t: ta + s * (tb - ta),
    d: Math.sqrt(mx * mx + my * my),
    d0: Math.hypot(wx, wy),
    d1: Math.hypot(wx + dx, wy + dy)
  };
}

/* Visit every interval of the common partition with the linear piece of each
 * loop that covers it. */
function walk(segsA, segsB, visit) {
  const ts = mergeTimes(segsA, segsB);
  let ia = 0, ib = 0;
  for (let k = 0; k + 1 < ts.length; k++) {
    const ta = ts[k], tb = ts[k + 1];
    while (ia + 1 < segsA.length && segsA[ia].t1 <= ta + EPS_T) ia++;
    while (ib + 1 < segsB.length && segsB[ib].t1 <= ta + EPS_T) ib++;
    visit(segsA[ia], segsB[ib], ta, tb);
  }
}

/* Position on the loop at time t, taken mod 1. Exported for the tests: a claim
 * about a gap at an instant is only checkable against the positions this module
 * believes the two balls to be at, read through its own segment builder. */
export function posAt(path, t) {
  return posOn(segments(path), t);
}

/* The merged breakpoint times of two loops: the partition on which both are
 * linear, from 0 to 1. Exported for the same reason as posAt. */
export function partition(pathA, pathB) {
  return mergeTimes(segments(pathA), segments(pathB));
}

/* Exact minimum of the equal-time gap over the whole loop, and where it
 * happens. Ties go to the earliest time. */
export function minGap(pathA, pathB) {
  return minGapOn(segments(pathA), segments(pathB));
}

function minGapOn(segsA, segsB) {
  let best = Infinity, at = 0;
  walk(segsA, segsB, (sa, sb, ta, tb) => {
    const g = pieceGap(sa, sb, ta, tb);
    if (g.d < best) { best = g.d; at = g.t; }
  });
  return { d: best, t: at === 1 ? 0 : at };
}

/* Every local minimum of the gap that comes within reach — the contact
 * events the UI marks — sorted by increasing gap. */
export function contacts(pathA, pathB, diameter, opts) {
  return contactsOn(segments(pathA), segments(pathB), diameter, opts);
}

function contactsOn(segsA, segsB, diameter, opts) {
  const o = opts || {};
  const tol = o.tol === undefined ? 0.02 * diameter : o.tol;
  const reach = o.reach === undefined ? 0.25 * diameter : o.reach;

  /* The critical times, in order round the loop. Interval endpoints are
   * shared, so coincident times are folded together; where a caller has
   * handed us a discontinuous loop (a jump in position) the two sides
   * disagree and we keep the SMALLER gap, which is the conservative answer
   * for a tool whose job is to warn about contact. */
  const crit = [];
  const push = (t, d) => {
    const last = crit.length ? crit[crit.length - 1] : null;
    if (last && t - last.t <= EPS_T) { if (d < last.d) last.d = d; return; }
    crit.push({ t: t, d: d });
  };
  walk(segsA, segsB, (sa, sb, ta, tb) => {
    const g = pieceGap(sa, sb, ta, tb);
    push(ta, g.d0);
    if (g.s > 0 && g.s < 1) push(g.t, g.d);
    push(tb, g.d1);
  });
  /* t = 1 is t = 0: close the cycle rather than leaving a duplicate node. */
  if (crit.length > 1 && crit[crit.length - 1].t >= 1 - EPS_T) {
    const end = crit.pop();
    if (end.d < crit[0].d) crit[0].d = end.d;
  }

  const n = crit.length;
  const out = [];
  const emit = (c) => {
    if (c.d > diameter + reach) return;
    const sep = c.d - diameter;
    const kind = sep < -tol ? "overlap" : (Math.abs(sep) <= tol ? "touch" : "clear");
    const A = posOn(segsA, c.t), B = posOn(segsB, c.t);
    out.push({
      t: c.t === 1 ? 0 : c.t,
      d: c.d,
      sep: sep,
      kind: kind,
      depth: diameter > 0 ? Math.max(0, -sep) / diameter : 0,
      x: (A[0] + B[0]) / 2,
      y: (A[1] + B[1]) / 2
    });
  };

  /* A run of equal gaps is one contact, not several — so start the sweep at a
   * point where the gap differs from its predecessor, which makes every run
   * around the cycle bounded on both sides by a different value. If no such
   * point exists the gap is constant all the way round (parallel motion, or
   * two stationary balls) and the whole loop is a single event. */
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (!eqGap(crit[i].d, crit[(i - 1 + n) % n].d)) { start = i; break; }
  }
  if (start < 0) {
    emit(crit[0]);
  } else {
    let i = 0;
    while (i < n) {
      const head = crit[(start + i) % n];
      let j = i + 1;
      while (j < n && eqGap(crit[(start + j) % n].d, head.d)) j++;
      const before = crit[(start + i - 1 + n) % n].d;
      const after = crit[(start + j) % n].d;
      if (before > head.d && after > head.d) emit(head);
      i = j;
    }
  }
  out.sort((p, q) => p.d - q.d);
  return out;
}

/* The one pairing that is not a collision: a seed against the untransformed
 * copy of itself. A caller may say so any of three ways — the clone reuses
 * the seed's path object, it carries the seed's own key, or it declares
 * {seed, identity: true}. opts.skip(seedKey, cloneKey) rejects further pairs
 * ON TOP of those three; it is an extra veto and not an override, so returning
 * false from it does not force a pair to be checked. Every other seed/clone
 * pair is checked, including a seed against another seed's identity clone,
 * which is how seed-versus-seed contact gets caught. */
function isSelf(seed, clone, skip) {
  if (skip && skip(seed.key, clone.key)) return true;
  if (clone.path === seed.path) return true;
  if (clone.key !== undefined && clone.key === seed.key) return true;
  return clone.identity === true && clone.seed === seed.key;
}

/* The whole design at once. By equivariance it is enough to check the seeds
 * against the clones: if every seed tube clears every clone tube then every
 * clone clears every clone, because the group carries one such pair onto the
 * other. `worst` is the closest of the reported events (null when nothing
 * came within reach). */
export function scan(seeds, clones, diameter, opts) {
  const o = opts || {};
  const segsBy = new Map();
  const segsOf = (path) => {
    let s = segsBy.get(path);
    if (!s) { s = segments(path); segsBy.set(path, s); }
    return s;
  };

  const events = [];
  let anyOverlap = false, anyTouch = false;
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const sa = segsOf(seed.path);
    for (let j = 0; j < clones.length; j++) {
      const clone = clones[j];
      if (isSelf(seed, clone, o.skip)) continue;
      const hits = contactsOn(sa, segsOf(clone.path), diameter, o);
      for (let k = 0; k < hits.length; k++) {
        const e = hits[k];
        e.a = seed.key;
        e.b = clone.key;
        if (e.kind === "overlap") anyOverlap = true;
        else if (e.kind === "touch") anyTouch = true;
        events.push(e);
      }
    }
  }
  events.sort((p, q) => p.d - q.d);
  return {
    events: events,
    worst: events.length ? events[0] : null,
    anyOverlap: anyOverlap,
    anyTouch: anyTouch
  };
}
