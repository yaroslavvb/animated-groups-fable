/* A design the group can live with, found rather than designed.
 *
 * Placing billiards by hand teaches what the group does; pressing Generate is
 * how you find out what it will TOLERATE. The search is three stages, and the
 * order is the whole trick:
 *
 *   1. ANCHORS by rejection. The anchor is the breakpoint at t = 0 and every
 *      other point of the loop hangs off it, so a pair of anchors that already
 *      overlap starts the search in a hole — reject and redraw instead.
 *   2. INTERIOR BREAKPOINTS at random offsets from the anchor.
 *   3. RELAX, and if that deadlocks, go back to 2 with a tamer excursion.
 *
 * Stage 2 is the only one that invents shape. Stage 3 is where the arithmetic
 * is: compute the contact events, push the offending breakpoints apart
 * along the line of centres, repeat. A breakpoint's share of a push is its
 * INFLUENCE at the event time — the interpolation weight it already has in the
 * loop — and the pushes are combined as a WEIGHTED MEAN, never a sum. A sum
 * makes a long segment, which is close to many events, take a displacement
 * proportional to its length, and the loop flies apart in three iterations.
 *
 * The design is left in the BEST state seen, not the last one tried: relaxation
 * is not monotone (fixing one contact can open another) and the caller wants
 * the good frame, not the final one.
 */
"use strict";
import { scan, minGap } from "./collide.js?v=44";
import { PALETTE, nearSkip, latticeOf } from "./model.js?v=44";

/* Two rings, and not one, for the ANCHOR search. A ball cannot reach a
 * TRANSLATE of itself two cells away, which is what tempts one to use a single
 * ring — but a clone is M u + v + m, and a rotation can carry a point right
 * across the cell before the translation is applied, so the copy that lands
 * next to it can easily be one with |m| = 2. (Whole loops are a harder
 * question than points, and stages 2 and 3 hand it to Design.scanClones, which
 * answers it from the design rather than from a constant.) */
const SPAN = 2;
const REACH = 0.4;                  // lattice units a breakpoint may stray

const DEFAULTS = {
  count: 3, breaks: 2, radius: 0.06,
  tries: 140,                       // anchor draws per billiard
  attempts: 4,                      // shapes tried, each tamer than the last
  iterations: 80,                   // relaxation passes per attempt
  spread: 0.28,                     // lattice units of random excursion
  shrink: 0.55,                     // how much tamer each retry is
  relax: 0.55,                      // fraction of the correction taken per pass
  margin: 0.03,                     // aim this far past touching, so the answer
                                    // is clear rather than exactly critical
  budget: 1700,                     // ms of searching, checked between passes
};

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const frac = (x) => ((x % 1) + 1) % 1;
const now = () => (typeof performance === "object" ? performance.now() : Date.now());

/* Which breakpoints does time t belong to, and how much? Exactly the two the
 * loop interpolates between, with the interpolation weights — so a push at t
 * lands on the segment that was actually there. */
function influence(pts, t) {
  const n = pts.length;
  if (n === 1) return [[0, 1]];
  let j = n - 1;
  for (let k = 1; k < n; k++) {
    if (pts[k].t > t) { j = k - 1; break; }
  }
  const b = (j + 1) % n;
  const t1 = j === n - 1 ? pts[b].t + 1 : pts[b].t;
  const dt = t1 - pts[j].t;
  const f = dt > 1e-12 ? (t - pts[j].t) / dt : 0;
  return [[j, 1 - f], [b, f]];
}

/* The closest approach anywhere in the design, in diameters. Exact — it walks
 * every seed against every clone that can come near one rather than reading the
 * event list, so a design that only just clears still gets a real number and it
 * is the same number the page's status line shows. A design where nothing comes
 * within two diameters returns Infinity: past that the answer stops being about
 * this design and starts being about the lattice. */
function worstRatio(design) {
  const diameter = 2 * design.radius;
  const seeds = design.seedPaths();
  const clones = design.scanClones({ diameter });
  let worst = Infinity;
  for (const s of seeds) {
    for (const c of clones) {
      if (c.identity && c.seed === s.key) continue;
      const g = minGap(s.path, c.path);
      if (g.d < worst) worst = g.d;
    }
  }
  return worst === Infinity ? Infinity : worst / diameter;
}

/* Every image of a ball standing still at u, in cartesian coordinates, as a
 * flat [x0, y0, x1, y1, ...]. The identity image comes first.
 *
 * This is Design.clones() for the one case where the whole loop is a point, and
 * the reason to have it is the anchor search: hundreds of candidates are drawn
 * and thrown away, and going through the model would rebuild the ENTIRE orbit —
 * every clone of every billiard already placed — for each one. The formula is
 * the same and in the same order: M u + v in lattice coordinates, then the
 * lattice translation, and only then the basis. */
function orbitOf(group, u, span, idOp) {
  const B = group.basis, ops = group.ops;
  const out = [];
  const put = (a, b) => out.push(a * B[0][0] + b * B[1][0],
                                 a * B[0][1] + b * B[1][1]);
  put(u[0], u[1]);                                  // the identity image, first
  for (let o = 0; o < ops.length; o++) {
    const M = ops[o].M, v = ops[o].v;
    const w0 = M[0][0] * u[0] + M[0][1] * u[1] + v[0];
    const w1 = M[1][0] * u[0] + M[1][1] * u[1] + v[1];
    for (let m1 = -span; m1 <= span; m1++) {
      for (let m2 = -span; m2 <= span; m2++) {
        if (o === idOp && !m1 && !m2) continue;      // already there, as [0]
        put(w0 + m1, w1 + m2);
      }
    }
  }
  return out;
}

/* Closest approach of the point at (x, y) to a flat list of points, skipping
 * the first `from` coordinates. */
function nearest(pts, x, y, from) {
  let worst = Infinity;
  for (let i = from; i < pts.length; i += 2) {
    const d = Math.hypot(pts[i] - x, pts[i + 1] - y);
    if (d < worst) worst = d;
  }
  return worst;
}

export function generate(design, opts = {}) {
  const o = Object.assign({}, DEFAULTS, opts);
  const rng = o.rng || Math.random;
  const t0 = now();
  const diameter = 2 * o.radius;

  design.setRadius(o.radius);
  while (design.seeds.length) design.removeSeed(design.seeds.length - 1);

  /* 1. anchors ---------------------------------------------------------- */
  /* Rejection sampling, with one concession: on a dense group — eighteen copies
   * of every ball in one cell — a draw that clears the whole orbit can take
   * more attempts than a button press is allowed, and quietly seating fewer
   * billiards than were asked for is a worse answer than seating a crowded one
   * and saying so in the gap figure. So the search accepts the first clear draw
   * and otherwise falls back to the roomiest it saw. */
  let tries = 0;
  const idOp = design.group.ops.findIndex((op) =>
    op.M[0][0] === 1 && !op.M[0][1] && !op.M[1][0] && op.M[1][1] === 1 &&
    !frac(op.v[0]) && !frac(op.v[1]) && !frac(op.tau));
  const placed = [];                  // the orbit of every anchor seated so far
  for (let i = 0; i < o.count; i++) {
    let bestU = null, bestRoom = -Infinity, bestOrbit = null;
    for (let a = 0; a < o.tries; a++) {
      tries++;
      const u = [rng(), rng()];
      const orbit = orbitOf(design.group, u, SPAN, idOp);
      // its own images (skipping the identity, which is the seed itself), and
      // then everything already standing
      const room = Math.min(nearest(orbit, orbit[0], orbit[1], 2),
                            nearest(placed, orbit[0], orbit[1], 0));
      if (room > bestRoom) { bestRoom = room; bestU = u; bestOrbit = orbit; }
      if (room >= diameter) break;
    }
    design.addSeed(bestU, i % PALETTE.length);
    for (let k = 0; k < bestOrbit.length; k++) placed.push(bestOrbit[k]);
  }

  const anchors = design.seeds.map((s) => [s.pts[0].u[0], s.pts[0].u[1]]);
  const target = diameter * (1 + o.margin);
  const run = { best: design.snapshot(), bestGap: -1, iterations: 0 };
  let attempt = 0;

  /* 2 and 3, together and repeatedly. Relaxation can deadlock, and on the
   * groups with mirrors it does: a breakpoint pinched between two mirror lines
   * gets equal and opposite pushes, and their mean is nothing at all. There is
   * no cleverness to add — a loop that does not fit between the mirrors does
   * not fit — so a stuck attempt is abandoned and the shape redrawn TAMER, the
   * anchors kept. In the limit of a small enough excursion the answer is the
   * anchors themselves, which stage 1 already knows are clear. */
  const deadline = t0 + o.budget;
  for (; attempt < o.attempts && run.bestGap < 1; attempt++) {
    if (attempt && now() > deadline) break;
    const spread = o.spread * Math.pow(o.shrink, attempt);
    design.restore({ group: design.group.id, radius: o.radius, span: design.span,
                     seeds: anchors.map((u, i) => ({ c: i % PALETTE.length,
                                                     pts: [{ t: 0, u }] })) });
    for (let i = 0; i < design.seeds.length; i++) {
      for (let b = 1; b <= o.breaks; b++) {
        const k = design.addBreak(i, b / (o.breaks + 1));
        design.movePoint(i, k, [
          clamp(anchors[i][0] + (rng() * 2 - 1) * spread, -REACH, 1 + REACH),
          clamp(anchors[i][1] + (rng() * 2 - 1) * spread, -REACH, 1 + REACH),
        ]);
      }
    }
    relax(design, o, rng, diameter, target, run, deadline);
  }
  design.restore(run.best);

  const minGapRatio = worstRatio(design);
  return {
    // a design relaxed to exactly touching lands a rounding error either side
    ok: minGapRatio >= 1 - 1e-9,
    count: design.seeds.length,
    minGapRatio,
    /* What to change when the answer is "crowded" — the only actionable thing
     * the report can say, and the answer is almost never the search: on the
     * 18-op groups eighteen copies of every ball share one cell and the default
     * radius simply does not fit. The gap ratio is how short this shape fell,
     * so radius x ratio is the ball that would have fitted THIS shape; the
     * margin below is for the shapes the search redraws on the way there, and
     * is enough that a rerun at this radius seats all of them. */
    fits: minGapRatio < 1 ? o.radius * minGapRatio * 0.93 : o.radius,
    attempts: attempt,
    iterations: run.iterations,
    tries,
    ms: now() - t0,
  };
}

/* Push whatever is touching apart, until nothing is or the budget runs out.
 * `run` carries the best state seen across every attempt, because a later,
 * tamer shape is not automatically a better one. */
function relax(design, o, rng, diameter, target, run, deadline) {
  const B = design.group.basis;
  for (let it = 0; it < o.iterations; it++) {
    // a button press is allowed to think, not to hang
    if ((it & 7) === 7 && now() > deadline) return;
    run.iterations++;
    const seeds = design.seedPaths();
    const clones = design.scanClones({ diameter, slack: target });
    /* A reach of one margin asks only for what is already touching or worse,
     * which is both cheaper and exactly the set that needs pushing — and it
     * makes the scan its own stopping condition: no events at all means clear.
     * nearSkip throws away the nine pairs in ten that are a cell apart. */
    const res = scan(seeds, clones, diameter,
                     { reach: o.margin * diameter,
                       skip: nearSkip(seeds, clones, target) });
    // the state that was measured is the state that gets remembered
    const gap = res.events.length ? res.worst.d / diameter : Infinity;
    if (gap > run.bestGap) { run.bestGap = gap; run.best = design.snapshot(); }
    if (!res.events.length) return;

    // [dx, dy, weight] per breakpoint: the numerator and denominator of the
    // mean, accumulated over every event this breakpoint has a share in
    const acc = design.seeds.map((s) => s.pts.map(() => [0, 0, 0]));
    for (const e of res.events) {
      if (e.d >= target) continue;
      const i = +e.a.slice(1);
      const seed = design.seeds[i];
      const A = design.posAt(i, e.t);            // lattice, so go via cartesian
      const p = [A[0] * B[0][0] + A[1] * B[1][0], A[0] * B[0][1] + A[1] * B[1][1]];
      // the event's x,y is the midpoint of the two centres, so this is half the
      // line of centres and points away from whatever is crowding the seed
      let dx = p[0] - e.x, dy = p[1] - e.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) {                          // dead centre: any way out
        const a = rng() * Math.PI * 2;
        dx = Math.cos(a); dy = Math.sin(a);
      } else { dx /= len; dy /= len; }
      const push = o.relax * (target - e.d) / 2;
      for (const [k, w] of influence(seed.pts, e.t)) {
        if (w <= 1e-6) continue;
        acc[i][k][0] += w * dx * push;
        acc[i][k][1] += w * dy * push;
        acc[i][k][2] += w;
      }
    }

    let moved = false;
    for (let i = 0; i < design.seeds.length; i++) {
      const pts = design.seeds[i].pts;
      for (let k = 0; k < pts.length; k++) {
        const a = acc[i][k];
        if (a[2] <= 1e-9) continue;
        const du = latticeOf(B, [a[0] / a[2], a[1] / a[2]]);
        design.movePoint(i, k, [clamp(pts[k].u[0] + du[0], -REACH, 1 + REACH),
                                clamp(pts[k].u[1] + du[1], -REACH, 1 + REACH)]);
        moved = true;
      }
    }
    if (!moved) return;
  }
}
