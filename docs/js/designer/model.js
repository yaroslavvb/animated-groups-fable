/* The design, and the orbit that fills the plane with it.
 *
 * A clockwork group acts on 2+1D spacetime by
 *     (x, t) -> (M x + v + m, t + tau)
 * with M an integer 2x2 matrix in LATTICE coordinates, v a fractional
 * translation, m any integer lattice vector, and tau a whole multiple of 1/N
 * for the group's clock order N (the number of colours).
 *
 * What the user designs is a BILLIARD: a ball whose centre runs round a closed
 * piecewise-linear loop p(t), p(0) = p(1). No drift — it comes back exactly
 * where it started, which is what makes the animation loop and what makes the time
 * shift below a clean wrap rather than a seam.
 *
 * The orbit fill puts a clone of that loop everywhere the group says:
 *     clone (M, v, tau, m):  q(t) = M p(t - tau) + v + m      [lattice coords]
 * so a clone shows the motif tau of a period behind. A clone wears its seed's
 * colour: the palette here distinguishes one billiard from another and carries
 * no group-theoretic meaning, so the phase residue that WOULD be the
 * Conway/Burgiel/Goodman-Strauss colour is not computed at all.
 *
 * The orbit is infinite and every caller wants a different finite piece of it,
 * so there are three ways to ask, and only the first is a block of cells:
 *   clones({span})  a block — the box's picture of the pattern around the cell
 *   scanClones()    what LEGALITY needs: everything that can come near a SEED
 *   viewClones()    what a VIEW shows: everything that can come near a window
 * A block chosen in advance answers neither of the other two. A design that has
 * wandered out of its cell has neighbours out there with it, and a fixed window
 * is how a design tool comes to call an illegal design legal.
 *
 * This module owns the design and knows the group theory; it never touches the
 * DOM or a canvas. It is deliberately free of imports — the collision scan and
 * the renderer sit downstream of it, not beside it.
 */
"use strict";

/* The six colour-blind-safe hues of designer-groups.json meta.palette, in that
 * order; a seed's colour index refers into this. Duplicated as a constant so
 * the module is usable before the fetch resolves — loadGroups checks it. */
export const PALETTE = [
  "#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00", "#56B4E9",
];

/* Breakpoint times are exact fractions of a period, so anything this close
 * together is the same instant arrived at by two arithmetic routes. */
const EPS = 1e-9;

const frac = (x) => { const f = x % 1; return f < 0 ? f + 1 : f; };

/* Column convention: M acts on a lattice coordinate column. */
const applyM = (M, u) => [M[0][0] * u[0] + M[0][1] * u[1],
                          M[1][0] * u[0] + M[1][1] * u[1]];

/* Lattice -> cartesian. B's ROWS are the two lattice vectors. This is the last
 * step of every clone: M, v and m all act in lattice coordinates, and doing
 * any of them after B is wrong for every non-orthogonal lattice, which is most
 * of these groups. */
export const cart = (B, u) => [u[0] * B[0][0] + u[1] * B[1][0],
                               u[0] * B[0][1] + u[1] * B[1][1]];

/* Cartesian back to lattice: p = u B, so u = p B^-1. Every drag ends here — the
 * mouse is in the plane and a breakpoint is in lattice coordinates — and so
 * does every question of the form "which cells is this near?". */
export function latticeOf(B, p) {
  const det = B[0][0] * B[1][1] - B[0][1] * B[1][0];
  return [(p[0] * B[1][1] - p[1] * B[1][0]) / det,
          (p[1] * B[0][0] - p[0] * B[0][1]) / det];
}

/* How far a cartesian radius reaches in each lattice coordinate: the row norms
 * of B^-1. A disk of radius R about a point at lattice coordinate c contains no
 * lattice vector outside c +- (R*k1, R*k2), which is what turns "within reach"
 * into a box of integers to loop over. */
function latticeReach(B) {
  const det = Math.abs(B[0][0] * B[1][1] - B[0][1] * B[1][0]);
  return [Math.hypot(B[1][1], B[1][0]) / det, Math.hypot(B[0][0], B[0][1]) / det];
}

/* A shifted breakpoint that lands a rounding error away from the period end
 * belongs at the start of the loop, not at 0.9999999999999999. */
const snapT = (t) => (t < EPS || t > 1 - EPS ? 0 : t);

/* Locate t within a closed breakpoint list: the segment index and how far
 * along it we are. The last segment wraps from the last breakpoint back to the
 * first at t = 1 — that wrap is the loop closing. */
function locate(pts, t) {
  const u = frac(t);
  const n = pts.length;
  if (n === 1) return { a: pts[0], b: pts[0], f: 0 };
  let j = n - 1;
  for (let k = 1; k < n; k++) {
    if (pts[k].t > u) { j = k - 1; break; }
  }
  const b = pts[(j + 1) % n];
  const t1 = j === n - 1 ? b.t + 1 : b.t;
  const dt = t1 - pts[j].t;
  return { a: pts[j], b, f: dt > EPS ? (u - pts[j].t) / dt : 0 };
}

/* Lattice position on a seed's breakpoint list at time t (taken mod 1). */
function loopAt(pts, t) {
  const { a, b, f } = locate(pts, t);
  return [a.u[0] + f * (b.u[0] - a.u[0]), a.u[1] + f * (b.u[1] - a.u[1])];
}

/* Cartesian position on a clone or seed path at time t. Exported because the
 * collision scan and the renderer both need to sample what clones() returns. */
export function pathAt(path, t) {
  const { a, b, f } = locate(path.pts, t);
  return [a.x + f * (b.x - a.x), a.y + f * (b.y - a.y)];
}

/* An orbit fill is mostly pairs that are nowhere near each other, and noticing
 * that is thirty times cheaper than the exact test. A path's bounding disk is
 * one pass over its breakpoints; two paths whose disks are farther apart than a
 * diameter cannot touch at any time, let alone at the same one, so the exact
 * test never needs to see them. Handed to collide.scan as its `skip` callback,
 * which keeps the decision to reject a pair in one place and leaves every pair
 * that survives to the exact arithmetic. */
export function nearSkip(seeds, clones, diameter) {
  const disks = new Map();
  const put = (x) => {
    if (!disks.has(x.key)) disks.set(x.key, x.disk || boundingDisk(x.path));
  };
  for (const s of seeds) put(s);
  for (const c of clones) put(c);
  return (ka, kb) => {
    const a = disks.get(ka), b = disks.get(kb);
    if (!a || !b) return false;
    return Math.hypot(a[0] - b[0], a[1] - b[1]) > a[2] + b[2] + diameter;
  };
}

function boundingDisk(path) {
  const pts = path.pts;
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  x /= pts.length;
  y /= pts.length;
  let r = 0;
  for (const p of pts) r = Math.max(r, Math.hypot(p.x - x, p.y - y));
  return [x, y, r];
}

/* Two breakpoint lists that describe the same tube. This is how a clone is
 * recognised as being the seed itself — which is the identity op, and is also
 * any op that happens to FIX this particular loop, a triangle on a 3-fold
 * centre being the standard case. Testing the loop rather than the op is both
 * the more general question and the honest one: it is the tube that has to be
 * distinct from the other tubes, not the group element. */
function samePath(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].t - b[i].t) > EPS) return false;
    if (Math.abs(a[i].x - b[i].x) > 1e-9 || Math.abs(a[i].y - b[i].y) > 1e-9) return false;
  }
  return true;
}

export async function loadGroups(url = "data/designer-groups.json") {
  /* no-cache, as every other data fetch on the site does: the file is
   * REGENERATED — it gained the canonical generators without changing its
   * name — and a reader holding yesterday's copy would be shown yesterday's
   * group list by a page whose code had moved on. Revalidating costs a 304. */
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`designer groups: HTTP ${res.status} for ${url}`);
  const data = await res.json();
  const groups = data.groups;
  const byId = new Map(groups.map((g) => [g.id, g]));
  // Which clock orders exist is the data's business. Hard-coding [3, 4, 6]
  // here was one of the two places that hid the clock-order-2 groups.
  const orders = [...new Set(groups.map((g) => g.n))].sort((a, b) => a - b);
  const byColors = new Map(orders.map((n) => [n, groups.filter((g) => g.n === n)]));

  // The palette is baked in above; if the data file ever moves, say so loudly
  // rather than drawing a design in colours nobody chose.
  const meta = data.meta.palette;
  if (meta.length !== PALETTE.length || meta.some((c, i) => c !== PALETTE[i])) {
    throw new Error("designer groups: meta.palette no longer matches PALETTE");
  }
  return { groups, byId, byColors, orders, meta: data.meta };
}

export class Design {
  constructor(group, opts = {}) {
    this.radius = opts.radius ?? 0.1;
    this.span = opts.span ?? 1;
    this.seeds = [];
    this.setGroup(group);
  }

  /* ------------------------------------------------------------- the group */

  setGroup(g) {
    this.group = g;
    this._invalidate();
  }

  setRadius(r) {
    this.radius = r;
    this._invalidate();
  }

  setSpan(n) {
    this.span = n;
    this._invalidate();
  }

  /* The orbit fill runs every frame, so it is cached; every mutator drops the
   * cache rather than trying to patch it. Blocks are cached by span because the
   * animation and the box ask for different ones and neither should evict the other
   * every frame. */
  _invalidate() {
    this._clones = new Map();
    this._bases = null;
    this._scan = null;
    this._view = null;
    this._seedPaths = null;
  }

  /* -------------------------------------------------------------- the seeds */

  /* A new seed is a straight vertical tube: one breakpoint, so the ball sits
   * still at u for the whole period. */
  addSeed(u, c) {
    const i = this.seeds.length;
    this.seeds.push({
      c: c ?? i % PALETTE.length,
      pts: [{ t: 0, u: [u[0], u[1]] }],
    });
    this._invalidate();
    return i;
  }

  removeSeed(i) {
    this.seeds.splice(i, 1);
    this._invalidate();
  }

  /* Adding a breakpoint must never move the ball: it goes in at the position
   * the path already has at that time, so the shape is untouched and only the
   * number of handles changes. */
  addBreak(i, t) {
    const pts = this.seeds[i].pts;
    const u = frac(t);
    if (u < EPS || u > 1 - EPS) return 0;         // t = 0 is the anchor
    for (let k = 0; k < pts.length; k++) {
      if (Math.abs(pts[k].t - u) < EPS) return k;
    }
    const p = loopAt(pts, u);
    let k = pts.findIndex((q) => q.t > u);
    if (k < 0) k = pts.length;
    pts.splice(k, 0, { t: u, u: p });
    this._invalidate();
    return k;
  }

  /* k = 0 anchors the loop at t = 0 and stays. */
  removeBreak(i, k) {
    if (k <= 0) return;
    this.seeds[i].pts.splice(k, 1);
    this._invalidate();
  }

  /* Dragging a handle moves it in the plane only; its time is fixed by where
   * it sits in the loop. */
  movePoint(i, k, u) {
    const p = this.seeds[i].pts[k];
    p.u = [u[0], u[1]];
    this._invalidate();
  }

  setSeedColor(i, c) {
    this.seeds[i].c = c;
    this._invalidate();
  }

  posAt(i, t) {
    return loopAt(this.seeds[i].pts, t);
  }

  /* ---------------------------------------------------------- the orbit fill */

  /* The clone's breakpoint list, in lattice coordinates and without the
   * integer translation. Two things happen at once here:
   *   - shape: every breakpoint becomes M u + v;
   *   - time: the clone shows internal time t - tau, so a breakpoint at t_k
   *     is reached at t_k + tau, mod 1.
   * The shifted times need re-sorting, and the list must be re-anchored at
   * t = 0 to keep the pts[0].t === 0 contract — the point to insert there is
   * the seed at time -tau, which is exact because the loop has no drift.
   * Getting this wrong mis-shapes every clone in a way that still looks
   * plausible, so it is worth the care.
   *
   * Two points may come out sharing t = 0, when the seed itself turns a corner
   * within EPS of the period end. That is the honest reading and not a fold to
   * repair: the later one starts the first leg, the earlier one closes the
   * loop, and locate() below takes them in exactly that order. */
  _cloneLoop(seed, op) {
    const place = (u) => {
      const w = applyM(op.M, u);
      return [w[0] + op.v[0], w[1] + op.v[1]];
    };
    if (seed.pts.length === 1) return [{ t: 0, u: place(seed.pts[0].u) }];
    const pts = seed.pts.map((p) => ({
      t: snapT(frac(p.t + op.tau)),
      u: place(p.u),
    }));
    pts.sort((a, b) => a.t - b.t);
    if (pts[0].t > EPS) pts.unshift({ t: 0, u: place(loopAt(seed.pts, -op.tau)) });
    return pts;
  }

  /* One clone SHAPE — M p(t - tau) + v in cartesian coordinates — before any
   * lattice translation, with the bounding disk that decides which translates
   * of it are worth looking at. There are ops x seeds of these and thousands of
   * translates of them, so this is the work worth doing once.
   *
   * `fixed` records that the op maps the seed loop to itself: on a group with a
   * 3-fold centre a triangle placed on that centre is its own clone, three
   * times over, and a scan that did not know it would report the ball as
   * overlapping itself at distance exactly zero. */
  _baseShapes() {
    if (this._bases) return this._bases;
    const g = this.group, B = g.basis;
    const out = [];
    for (let si = 0; si < this.seeds.length; si++) {
      const seed = this.seeds[si];
      const own = seed.pts.map((p) => {
        const q = cart(B, p.u);
        return { t: p.t, x: q[0], y: q[1] };
      });
      const mine = [];
      for (let oi = 0; oi < g.ops.length; oi++) {
        const op = g.ops[oi];
        const pts = this._cloneLoop(seed, op).map((p) => {
          const q = cart(B, p.u);
          return { t: p.t, x: q[0], y: q[1] };
        });
        /* The orbit of a loop is a SET of tubes. When the loop has a nontrivial
         * stabiliser — a triangle sitting on a 3-fold centre — several ops send
         * it to the same tube, and enumerating it once per op would draw one
         * ball three times and then report the three of them as overlapping
         * each other at distance zero. */
        if (mine.some((b) => samePath(b.pts, pts))) continue;
        const base = {
          si, oi, op, pts,
          disk: boundingDisk({ pts }),
          fixed: samePath(pts, own),
          // A clone always wears its seed's colour. The paint is how the
          // designer tells one billiard from another and means nothing
          // group-theoretic; colouring by phase here would assert that it does.
          color: PALETTE[seed.c % PALETTE.length],
        };
        mine.push(base);
        out.push(base);
      }
    }
    this._bases = out;
    return out;
  }

  /* m is a lattice translation, so it is a constant cartesian offset. */
  _place(base, m1, m2) {
    const d = cart(this.group.basis, [m1, m2]);
    const pts = base.pts.map((p) => ({ t: p.t, x: p.x + d[0], y: p.y + d[1] }));
    return {
      seedIndex: base.si,
      m: [m1, m2],
      tau: base.op.tau,
      // collide.scan reads these three: they are how it recognises the pairings
      // that are not collisions, a seed against an untransformed copy of itself
      key: `s${base.si}/${base.oi}@${m1},${m2}`,
      seed: `s${base.si}`,
      identity: base.fixed && m1 === 0 && m2 === 0,
      path: { pts },
      disk: [base.disk[0] + d[0], base.disk[1] + d[1], base.disk[2]],
      color: base.color,
    };
  }

  /* Every clone tube in a block of cells, cartesian and already time-shifted:
   * the box's picture of the orbit, one ring of neighbours or two. A block is a
   * PICTURE — the question of what is LEGAL is scanClones(), and the question of
   * what a view SHOWS is viewClones(); neither is a block. */
  clones(opts = {}) {
    const span = opts.span ?? this.span;
    const had = this._clones.get(span);
    if (had) return had;
    const out = [];
    for (const base of this._baseShapes()) {
      for (let m1 = -span; m1 <= span; m1++) {
        for (let m2 = -span; m2 <= span; m2++) out.push(this._place(base, m1, m2));
      }
    }
    // both spans stay live: flipping the display span back and forth is one
    // click, and it must not rebuild the orbit each way
    if (this._clones.size >= 3) this._clones.clear();
    this._clones.set(span, out);
    return out;
  }

  /* Every clone whose loop comes within `slack` of one of `targets` — disks
   * [x, y, r] in cartesian coordinates — however far out in the lattice it has
   * to be looked for.
   *
   * A block of cells chosen in advance is the wrong instrument for both of the
   * questions that ask this. A loop that wanders three cells out has neighbours
   * the group puts three cells out, so a fixed window either misses them or
   * pays for a thousand cells nobody is anywhere near. Here the window is per
   * pair instead: one target and one clone shape can meet only if their disks
   * come within slack, which is a disk of admissible translations, which
   * through B^-1 is a small box of integer m. The union over pairs is complete
   * however far the design sprawls, and on a design that stays in its cell it
   * is a fraction of the block it replaces. */
  _near(targets, slack) {
    const B = this.group.basis;
    const [k1, k2] = latticeReach(B);
    const out = [], seen = new Set();
    for (const target of targets) {
      for (const base of this._baseShapes()) {
        const R = target[2] + base.disk[2] + slack;
        const c = latticeOf(B, [target[0] - base.disk[0], target[1] - base.disk[1]]);
        const hi1 = Math.floor(c[0] + R * k1), hi2 = Math.floor(c[1] + R * k2);
        for (let m1 = Math.ceil(c[0] - R * k1); m1 <= hi1; m1++) {
          for (let m2 = Math.ceil(c[1] - R * k2); m2 <= hi2; m2++) {
            const key = `s${base.si}/${base.oi}@${m1},${m2}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(this._place(base, m1, m2));
          }
        }
      }
    }
    return out;
  }

  /* The clones legality depends on: everything that can come near a SEED.
   * Equivariance does the rest — if every seed clears these, every clone clears
   * every clone — but only because "these" is the whole orbit near the seeds
   * and not a block of it. */
  scanClones(opts = {}) {
    const diameter = opts.diameter ?? 2 * this.radius;
    /* Far enough out that the scan can also report how much ROOM a clear design
     * has: collide.scan is called with reach = diameter, so a pair whose gap is
     * up to two diameters still has something to say. */
    const slack = opts.slack ?? 2 * diameter;
    if (this._scan && this._scan.slack === slack) return this._scan.out;
    const out = this._near(this.seedPaths().map((s) => s.disk), slack);
    this._scan = { slack, out };
    return out;
  }

  /* The clones a round view of the plane can see. Cached on the view, because
   * the animation asks for the same one sixty times a second. */
  viewClones(radius, centre = [0, 0]) {
    const key = `${radius}|${centre[0]}|${centre[1]}`;
    if (this._view && this._view.key === key) return this._view.out;
    const out = this._near([[centre[0], centre[1], radius]], 0);
    this._view = { key, out };
    return out;
  }

  /* The seeds themselves. Every clone clears every clone as soon as every seed
   * clears every clone, so this is the left-hand side of the collision scan. */
  seedPaths() {
    if (this._seedPaths) return this._seedPaths;
    const B = this.group.basis;
    this._seedPaths = this.seeds.map((seed, i) => {
      const path = {
        pts: seed.pts.map((p) => {
          const q = cart(B, p.u);
          return { t: p.t, x: q[0], y: q[1] };
        }),
      };
      return { key: `s${i}`, seedIndex: i, path, disk: boundingDisk(path) };
    });
    return this._seedPaths;
  }

  cellCorners() {
    const B = this.group.basis;
    return [[0, 0], [1, 0], [1, 1], [0, 1]].map((u) => cart(B, u));
  }

  /* ------------------------------------------------------- state and undo */

  /* The shape urlstate.encode() reads. The camera lives in state.view, which
   * belongs to the page rather than to the design, so the caller merges it in;
   * everything here survives a URL round trip up to that module's quantisation. */
  toState() {
    return {
      g: this.group.id,
      r: this.radius,
      span: this.span,
      seeds: this.seeds.map((s) => ({
        c: s.c,
        pts: s.pts.map((p) => ({ t: p.t, u: [p.u[0], p.u[1]] })),
      })),
    };
  }

  /* Tolerant of long keys and of points written as [t, u1, u2], so a state
   * hand-written or produced by an older encoder still loads. */
  static fromState(state, groupsIndex) {
    const id = state.g ?? state.group;
    const byId = groupsIndex instanceof Map ? groupsIndex : groupsIndex.byId;
    const group = byId.get(id);
    if (!group) throw new Error(`designer: unknown group ${id}`);
    const d = new Design(group, {
      radius: state.r ?? state.radius,
      span: state.span,
    });
    for (const s of state.seeds || []) {
      const pts = (s.pts || []).map((p) => (
        Array.isArray(p) ? { t: p[0], u: [p[1], p[2]] }
                         : { t: p.t, u: [p.u[0], p.u[1]] }
      ));
      pts.sort((a, b) => a.t - b.t);
      if (!pts.length) continue;
      pts[0].t = 0;
      d.seeds.push({ c: s.c ?? 0, pts });
    }
    d._invalidate();
    return d;
  }

  snapshot() {
    return {
      group: this.group.id,
      radius: this.radius,
      span: this.span,
      seeds: this.seeds.map((s) => ({
        c: s.c,
        pts: s.pts.map((p) => ({ t: p.t, u: [p.u[0], p.u[1]] })),
      })),
    };
  }

  /* Undo restores the design in place: the group is restored only if the
   * caller can supply it, since the snapshot carries an id, not the object. */
  restore(snap, groupsIndex) {
    if (groupsIndex && snap.group !== this.group.id) {
      const byId = groupsIndex instanceof Map ? groupsIndex : groupsIndex.byId;
      const g = byId.get(snap.group);
      if (g) this.setGroup(g);
    }
    this.radius = snap.radius;
    this.span = snap.span;
    this.seeds = snap.seeds.map((s) => ({
      c: s.c,
      pts: s.pts.map((p) => ({ t: p.t, u: [p.u[0], p.u[1]] })),
    }));
    this._invalidate();
    return this;
  }
}
