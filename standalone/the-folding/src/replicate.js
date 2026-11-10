// replicate.js — how the tiling is made (the owner's ask, 10 Nov 2026: "add another step where it actually shows how
// the tiling and replication is done"). Pure: no DOM; plane.js draws what it computes.
//
// The tile D is a Dirichlet domain; edge i is glued to edge j by domain.edges[i].g (g maps edge j onto edge i, and
// D ∩ g(D) is edge i). By Poincaré's polygon theorem these side pairings generate the group, and the tiling is grown
// out of D across its own edges: the copy across edge i of a copy h(D) is h g_i (D). Breadth first, layer k = the
// copies whose shortest word in the side pairings has k letters. Every copy is h(D) for a real element h; at the end
// the copies are exactly the tiles of the window (each one once: the tiling, no gap, no overlap).
//
// Each new copy comes out of its parent h(D) by the motion of its side pairing g_i, carried by h: the path
// A(s) = h ∘ m_i(s), s in [0, 1], A(0) = h (the copy lies on its parent), A(1) = h g_i. m_i(s) is the plane's view
// (from above, +z toward the viewer) of a rigid motion of space from the identity to g_i:
//   translation   slides:            m(s) = translation by s v
//   rotation      turns about its centre by s θ (a half-turn by +π, counter-clockwise)
//   reflection    turns over its mirror: a half-turn of space about the mirror line, seen from above (the copy narrows
//                 to the line and opens on the other side, mirrored)
//   glide         both at once: a half screw about the axis (turns over the axis while sliding s·dist along it)
// So h ∘ m_i(s) h⁻¹ is the same kind of motion about h's image of the centre / mirror / axis: the half-turn about a
// 2-fold centre of the parent copy, the reflection in its mirror edge, and so on.
//
//   sidePairingMotion(group, g)                    -> { kind, key, order, angle, at(s) -> affine, pivot, axis, ... }
//   replicationPlan(group, domain, opts)           -> Plan (see the function)
//   copyState(plan, copy, tau)                     -> { phase: 'hidden'|'moving'|'settling'|'landed', A, x, s, sigma }
//   cardState(plan, copy, state, keep)             -> how its card is drawn: { A, k, back, lift, quiet } or null
//   planCaption(plan, tau, short)                  -> the words for what acts at tau ('' when nothing does)
//   edgeKey(edges, i)                              -> the order of the side pairings that a drag does not change
// Affine maps are { a, b, c, d, tx, ty } as geom.js's isometries (compose works for them; inverse does not).
//
// The final fix (10 Nov 2026, the verifiers' findings 5, 8, 10, 14):
//   - the side pairings are taken in an order that a drag does not change (edgeKey: mirrors by their outward normal,
//     seams by their colour, plane.js assignEdgeColors) — by edge index, which domain.js renumbers as the seed moves,
//     the first layer's turns swapped places mid-drag and the copies jumped to another centre;
//   - opts.total keeps the length of a replication while the person changes the cut (plane.js: a drag or a wave keeps
//     the timing of the cut that was chosen): the later layers share what the first leaves, so u keeps its moment;
//   - from layer split + 1 on the cards are quiet (cardState.quiet): plain paper with a faint outline and the mirror
//     edges in ink, no seam colours — the first layer explains, the rest only grows (the 10-20 coloured cards in flight
//     were "too much stuff");
//   - the words end when the last copy has landed, not after its settle.

import { compose, classify, det, rot, trans } from './geom.js';
import { symmetryElements } from './groups.js';

const TAU = 2 * Math.PI;

/**
 * Timing (seconds). The first `split` layers are split by side pairing: the copies made by one pair of glued edges
 * (or one mirror edge) move alone, `first` s each, and the words name that element; from the next layer on, a layer
 * moves at once, `next` s, then shorter by `decay` per layer down to `min`, and all of them together take at most
 * `later` s. A copy settles (its highlight fades into the plain tiling) during `settle` after it lands, while the next
 * phase moves; a copy fades in over `lift` s as it leaves its parent (at most half its motion), so a short late
 * phase does not flash its copies in.
 * `by`: 'class' (each pair of glued edges alone) or 'kind' (all the side pairings of one kind together).
 * `order`: 'stable' (edgeKey: what a drag does not change) or 'edge' (by edge index: before the final fix; for controls).
 */
export const REP_TIMING = Object.freeze({ split: 1, by: 'class', order: 'stable', first: 0.85, next: 0.9, decay: 0.8, min: 0.34, later: 4.2, settle: 0.55, lift: 0.16 });
/**
 * opts.total (a length to keep): the later layers are stretched or squeezed by at most this range to fill it; outside it
 * (or with no later layer and more than LOCK_IDLE s to fill) the plan takes its own length.
 */
export const LOCK_RANGE = Object.freeze([0.45, 2.2]), LOCK_IDLE = 1.5;

const TAU_ = 2 * Math.PI;
/** Normals are measured from a generic direction, so that no lattice or mirror direction sits on the cut of the angle. */
const ANGLE0 = 0.1234;
/**
 * The order of the side pairings that a drag does not change: [0 mirror | 1 seam, colour, angle of the outward normal].
 * A mirror edge lies on a mirror line of the pattern (fixed); a seam keeps its colour while it exists (plane.js
 * assignEdgeColors gives edge.color; edge.cls where there is none, as in a bare domain); the two edges of a seam (and
 * mirrors among themselves) follow the directions of their outward normals.
 */
export function edgeKey(edges, i) {
  const e = edges[i];
  const mirror = e.kind === 'mirror' || e.cls < 0;
  let a = Math.atan2(e.ny, e.nx) - ANGLE0;
  a -= TAU_ * Math.floor(a / TAU_);
  return [mirror ? 0 : 1, mirror ? -1 : (Number.isInteger(e.color) ? e.color : e.cls), a];
}
const cmpKeys = (p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2];

/** The share of a copy's motion over which it fades in: `lift` seconds, at most half of it. */
export function liftShare(plan, c) { return Math.min(0.5, plan.lift / Math.max(1e-6, c.t1 - c.t0)); }

/** smoothstep */
export const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** The motion's own easing: at rest at both ends, no step in speed anywhere (smootherstep). */
export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/** The order of the rotation centre at (x, y): the largest order of a rotation of the group about it (1: none). */
function centreOrder(group, x, y) {
  const sym = symmetryElements(group, x, y, 1e-3);
  let n = 1;
  for (const c of sym.centers) if (Math.hypot(c.x - x, c.y - y) < 1e-5 && c.order > n) n = c.order;
  return n;
}

/** p / q in lowest terms, for an angle |θ| = 2π p / q (q <= 12). */
function fraction(theta) {
  const f = Math.abs(theta) / TAU;
  for (let q = 1; q <= 12; q++) {
    const p = Math.round(f * q);
    if (p > 0 && Math.abs(f * q - p) < 1e-6) {
      let a = p, b = q;
      while (b) { const t = a % b; a = b; b = t; }
      return [p / a, q / a];
    }
  }
  return null;
}

/** The angle in words: π, π/2, 2π/3, π/3, ... (|θ| only). */
export function angleText(theta) {
  const fr = fraction(theta);
  if (!fr) return `${Math.round((Math.abs(theta) * 180) / Math.PI)}°`;
  // |θ| = 2π p / q = (2p / q) π
  let num = 2 * fr[0], den = fr[1];
  let a = num, b = den;
  while (b) { const t = a % b; a = b; b = t; }
  num /= a; den /= a;
  const top = num === 1 ? 'π' : `${num}π`;
  return den === 1 ? top : `${top}/${den}`;
}

/**
 * The motion of a side pairing g: { kind: 'translation'|'rotation'|'reflection'|'glide', key, order (rotations: the
 * order of the centre), angle (rotations, in (-π, π], a half-turn is +π), pivot [x, y] (rotations), axis
 * { p, u, dist } (reflections: dist 0, and glides), vec (translations), at(s) -> the affine map m(s) }.
 * at(0) is the identity, at(1) is g itself (exactly: the object g is returned).
 */
export function sidePairingMotion(group, g) {
  const c = classify(g);
  const m = { kind: c.type, key: c.type, g };
  if (c.type === 'translation') {
    m.vec = c.vec.slice();
    m.at = (s) => (s >= 1 ? g : trans(s * c.vec[0], s * c.vec[1]));
  } else if (c.type === 'rotation') {
    let th = c.angle;
    if (th > Math.PI - 1e-6 || th < -Math.PI + 1e-6) th = Math.PI;          // a half-turn: counter-clockwise
    m.angle = th; m.pivot = c.center.slice();
    m.order = centreOrder(group, c.center[0], c.center[1]);
    m.half = near(Math.abs(th), Math.PI);
    m.key = 'rotation:' + m.order + ':' + angleText(th);
    m.at = (s) => (s >= 1 ? g : rot(s * th, c.center[0], c.center[1]));
  } else if (c.type === 'reflection' || c.type === 'glide') {
    const [px, py] = c.point, [ux, uy] = c.dir, nx = -uy, ny = ux;
    const dist = c.type === 'glide' ? c.dist : 0;
    m.axis = { p: [px, py], u: [ux, uy], dist };
    m.at = (s) => {
      if (s >= 1) return g;
      const k = Math.cos(Math.PI * s);
      // x -> p + ((x - p).u) u + k ((x - p).n) n + s dist u
      const a = ux * ux + k * nx * nx, b = ux * uy + k * nx * ny, cc = uy * ux + k * ny * nx, d = uy * uy + k * ny * ny;
      return { a, b, c: cc, d, tx: px - a * px - b * py + s * dist * ux, ty: py - cc * px - d * py + s * dist * uy };
    };
  } else {
    m.at = () => g;                                                          // the identity (never a side pairing)
  }
  return m;
}

/** Kinds in the order a layer that is split by kind shows them: reflections, rotations (higher order first), glides, translations. */
function kindRank(m) {
  if (m.kind === 'reflection') return 0;
  if (m.kind === 'rotation') return 1 + (12 - m.order) / 100 + Math.abs(m.angle) / 1000;
  if (m.kind === 'glide') return 2;
  return 3;
}

/**
 * The words for one kind acting on `count` copies about `places` distinct centres / lines (`signs`: the senses of the
 * rotations as seen in the plane): "half-turn about a 2-fold centre", "rotations by ±2π/3 about a 3-fold centre",
 * "reflections in mirrors", "glide reflection", "translations".
 */
export function kindText(m, count, signs, places = count) {
  const many = count > 1, spots = places > 1;
  if (m.kind === 'translation') return many ? 'translations' : 'translation';
  if (m.kind === 'glide') return many ? 'glide reflections' : 'glide reflection';
  if (m.kind === 'reflection') return spots ? 'reflections in mirrors' : many ? 'reflections in a mirror' : 'reflection in a mirror';
  if (m.kind === 'rotation') {
    const where = spots ? `about ${m.order}-fold centres` : `about a ${m.order}-fold centre`;
    if (m.half) return (many ? 'half-turns ' : 'half-turn ') + where;
    const pm = signs && signs.has(1) && signs.has(-1) ? '±' : signs && signs.has(-1) ? '−' : '';
    return `${many ? 'rotations' : 'rotation'} by ${pm}${angleText(m.angle)} ${where}`;
  }
  return '';
}

const isoKey = (g) => {
  const r = (v) => Math.round(v * 1e6) || 0;
  return r(g.a) + ',' + r(g.b) + ',' + r(g.c) + ',' + r(g.d) + ',' + r(g.tx) + ',' + r(g.ty);
};

/**
 * The plan of the replication for the tile `domain`:
 *   opts.seedA, opts.reach   the warped seed and the largest distance from it to the tile (plane.js prepareTile)
 *   opts.region              { cx, cy, hw, hh }: copies whose seed image lies in this box (grown by reach) are planned
 *   opts.window              { cx, cy, hw, hh }: the window the timing is made for (its copies set the number of layers)
 *   opts.centres             [{ x, y }] rotation centres to report coverage for (plane.js's glyphs), optional
 *   opts.timing              REP_TIMING overrides
 *   opts.total               a length (s) to keep, the last plan's while the person drags or waves the cut: the first
 *                            layer keeps its own timing and the later layers fill the rest (LOCK_RANGE); plan.locked
 *                            says whether it was kept
 * -> {
 *   copies: [{ index, g, depth, parent, gen, motion, phase, t0, t1, det, key, poly }]   index 0 = the tile (identity)
 *   gens:   [{ i, g, motion }] the side pairings (edge order)
 *   phases: [{ index, wave, kinds: [key], t0, t1, count, text }]
 *   waves:  number of layers in the window,  T: total seconds (the last settle included),  settle, lift
 *   landed: when the last copy lands (the words end there),  locked: opts.total was kept
 *   stops:  [{ t, label }] in u = tau / T: the end of every layer, and 1
 *   cover:  for opts.centres[k], the indices of the copies whose closed tile contains it
 * }
 */
export function replicationPlan(group, domain, opts = {}) {
  const T = { ...REP_TIMING, ...(opts.timing || {}) };
  const seedA = opts.seedA || domain.seedActual || domain.seed;
  const reach = opts.reach || Math.sqrt(group.domainArea);
  const region = opts.region, win = opts.window || region;
  const gens = domain.edges.map((e, i) => ({ i, g: e.g, motion: sidePairingMotion(group, e.g) }));
  const inBox = (g, B, grow) => {
    const x = g.a * seedA[0] + g.b * seedA[1] + g.tx, y = g.c * seedA[0] + g.d * seedA[1] + g.ty;
    return Math.abs(x - B.cx) <= B.hw + grow && Math.abs(y - B.cy) <= B.hh + grow;
  };

  // breadth first over the side pairings, inside the region; the side pairings in an order that a drag does not
  // change (edgeKey), so that a copy keeps its parent, its motion and its place in the queue while the cut moves
  const E = domain.edges;
  const keys = E.map((e, i) => edgeKey(E, i));
  const order = T.order === 'edge' ? gens.slice() : gens.slice().sort((p, q) => cmpKeys(keys[p.i], keys[q.i]) || p.i - q.i);
  const id = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const copies = [{ index: 0, g: id, depth: 0, parent: -1, gen: -1, motion: null, key: isoKey(id) }];
  const seen = new Map([[copies[0].key, 0]]);
  for (let q = 0; q < copies.length && copies.length < 4000; q++) {
    const h = copies[q];
    for (const G of order) {
      const g = compose(h.g, G.g), key = isoKey(g);
      if (seen.has(key)) continue;
      if (!inBox(g, region, reach)) continue;
      seen.set(key, copies.length);
      copies.push({ index: copies.length, g, depth: h.depth + 1, parent: q, gen: G.i, motion: G.motion, key });
    }
  }
  for (const c of copies) c.det = det(c.g);
  for (const c of copies) c.detParent = c.parent >= 0 ? copies[c.parent].det : 1;

  // the layers the window needs
  let waves = 0;
  for (const c of copies) if (c.depth > waves && inBox(c.g, win, reach)) waves = c.depth;

  // phases: the first layer(s) split by side pairing (or by kind), later layers whole
  const classOf = (c) => {
    const e = E[c.gen];
    if (T.by === 'kind') return c.motion.key;
    return e.kind === 'mirror' || e.cls < 0 ? 'm' + c.gen : 'c' + e.cls;     // a pair of glued edges, or one mirror
  };
  const later = [];
  for (let k = T.split + 1; k <= waves; k++) later.push(Math.max(T.min, T.next * Math.pow(T.decay, k - 1 - T.split)));
  const laterSum = later.reduce((a, b) => a + b, 0);
  const squeeze = laterSum > T.later ? T.later / laterSum : 1;               // the later layers take at most T.later s
  // each layer's phases (lists of copies) and the length of each of its phases
  const layers = [];
  for (let k = 1; k <= waves; k++) {
    const layer = copies.filter((c) => c.depth === k);
    const dur = k <= T.split ? T.first : Math.max(0.8 * T.min, later[k - 1 - T.split] * squeeze);
    const groups = [];
    if (k <= T.split) {
      // one phase per side pairing, by kind, then in the order a drag does not change (the edges' keys)
      const byKey = new Map();
      for (const c of layer) {
        const key = classOf(c), j = E[c.gen].partner, kk = cmpKeys(keys[c.gen], keys[j]) <= 0 ? keys[c.gen] : keys[j];
        if (!byKey.has(key)) byKey.set(key, { motion: c.motion, gen: Math.min(c.gen, j), key: kk, list: [] });
        byKey.get(key).list.push(c);
      }
      const tie = T.order === 'edge' ? (a, b) => a.gen - b.gen : (a, b) => cmpKeys(a.key, b.key) || a.gen - b.gen;
      groups.push(...[...byKey.values()].sort((a, b) => kindRank(a.motion) - kindRank(b.motion) || tie(a, b)).map((v) => v.list));
    } else groups.push(layer);
    layers.push({ k, dur, groups: groups.filter((l) => l.length) });
  }
  // the length: its own, or opts.total kept (the first layer as it is, the later ones stretched or squeezed to fill)
  let splitSpan = 0, laterSpan = 0;
  for (const L of layers) { if (L.k <= T.split) splitSpan += L.dur * L.groups.length; else laterSpan += L.dur * L.groups.length; }
  let stretch = 1, total = splitSpan + laterSpan + T.settle, locked = false;
  const want = Number(opts.total);
  if (Number.isFinite(want) && want > 0) {
    const avail = want - T.settle - splitSpan;
    if (Math.abs(want - total) <= 1e-9) locked = true;
    else if (laterSpan > 0 && avail >= LOCK_RANGE[0] * laterSpan && avail <= LOCK_RANGE[1] * laterSpan) { stretch = avail / laterSpan; total = want; locked = true; }
    else if (!(laterSpan > 0) && avail >= 0 && avail <= LOCK_IDLE) { total = want; locked = true; }
  }
  const phases = [];
  let cursor = 0;
  for (const { k, dur: dur0, groups } of layers) {
    const dur = k <= T.split ? dur0 : dur0 * stretch;
    for (const list of groups) {
      const ph = { index: phases.length, wave: k, t0: cursor, t1: cursor + dur, count: list.length };
      for (const c of list) { c.phase = ph.index; c.t0 = ph.t0; c.t1 = ph.t1; }
      const words = phaseText(list, k, T.split, copies);
      ph.text = words.text;
      ph.short = k <= T.split ? words.short : `${words.short} of ${waves}`;
      phases.push(ph);
      cursor += dur;
    }
  }
  // (exactly the end of the last settle, as summed; a kept length that is longer leaves the rest after it)
  total = Math.max(cursor + T.settle, locked ? want : 0);
  // copies deeper than the window needs (off screen): they land with the last settle
  for (const c of copies) if (c.depth > waves) { c.phase = -1; c.t0 = c.t1 = cursor; }
  copies[0].t0 = copies[0].t1 = 0; copies[0].phase = -1;

  const stops = [];
  for (let k = 1; k <= waves; k++) {
    const last = phases.filter((p) => p.wave === k).pop();
    if (last) stops.push({ t: last.t1 / total, label: `layer ${k}` });
  }
  stops.push({ t: 1, label: 'tiled' });

  // which copies hold each centre (for the glyphs: a centre shows once a copy that holds it has landed)
  let cover = null;
  if (opts.centres) {
    const size = Math.sqrt(group.domainArea), eps = 1e-6 * size, E = domain.edges;
    cover = opts.centres.map((ctr) => {
      const out = [];
      for (const c of copies) {
        // ctr in c.g(D)  <=>  c.g^-1 (ctr) in D (straight coordinates; centres are fixed by the warp)
        const g = c.g, dx = ctr.x - g.tx, dy = ctr.y - g.ty;
        const x = g.a * dx + g.c * dy, y = g.b * dx + g.d * dy;
        let ok = true;
        for (let i = 0; i < E.length && ok; i++) if (E[i].nx * x + E[i].ny * y - E[i].c > eps) ok = false;
        if (ok) out.push(c.index);
      }
      return out;
    });
  }

  return { copies, gens, phases, waves, T: total, settle: T.settle, lift: T.lift, stops, cover, timing: T, locked, landed: cursor };
}

/** Where a copy's motion acts, in the plane: its centre (rotations) or its line (reflections, glides), as a key. */
function placeKey(c, copies) {
  const m = c.motion, h = copies[c.parent].g, r = (v) => Math.round(v * 1e5);
  if (m.kind === 'rotation') return r(h.a * m.pivot[0] + h.b * m.pivot[1] + h.tx) + ',' + r(h.c * m.pivot[0] + h.d * m.pivot[1] + h.ty);
  if (m.kind === 'reflection' || m.kind === 'glide') {
    const px = h.a * m.axis.p[0] + h.b * m.axis.p[1] + h.tx, py = h.c * m.axis.p[0] + h.d * m.axis.p[1] + h.ty;
    let ux = h.a * m.axis.u[0] + h.b * m.axis.u[1], uy = h.c * m.axis.u[0] + h.d * m.axis.u[1];
    if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
    return r(Math.atan2(uy, ux)) + '|' + r(px * -uy + py * ux);               // direction and offset of the line
  }
  return 'v';
}

/**
 * The words of a phase: { text, short }. A phase of the first layer(s) is one side pairing: its full name
 * ("rotations by ±π/2 about a 4-fold centre"), short form the kind alone ("rotations by ±π/2"). A later layer:
 * "layer k · " and the kinds acting in it, short ("reflections, rotations by ±π/2"); its short form "layer k of K"
 * (K filled in by replicationPlan).
 */
function phaseText(list, wave, split, copies) {
  const byKey = new Map();
  for (const c of list) {
    let e = byKey.get(c.motion.key);
    if (!e) { e = { motion: c.motion, count: 0, signs: new Set(), places: new Set() }; byKey.set(c.motion.key, e); }
    e.count++;
    e.places.add(placeKey(c, copies));
    // the sense seen in the plane: the side pairing's, reversed by a parent of the other hand
    if (c.motion.kind === 'rotation') e.signs.add(Math.sign(c.motion.angle * (c.detParent || 1)));
  }
  const kinds = [...byKey.values()].sort((a, b) => kindRank(a.motion) - kindRank(b.motion));
  const shortOf = (e) => kindShort(e.motion, e.count, e.signs);
  if (wave <= split) return { text: kinds.map((e) => kindText(e.motion, e.count, e.signs, e.places.size)).join(', '), short: kinds.map(shortOf).join(', ') };
  // the first later layer says once what a layer is (finding 14): the copies whose shortest word in the side pairings
  // has that many letters
  const gloss = wave === split + 1 ? ` (words of length ${wave} in the side pairings)` : '';
  return { text: `layer ${wave}${gloss} · ` + kinds.map(shortOf).join(', '), short: `layer ${wave}` };
}

/** The kind alone, for the short words: "half-turns", "rotations by ±2π/3", "reflection", "glide reflections", "translations". */
export function kindShort(m, count, signs) {
  const many = count > 1;
  if (m.kind === 'translation') return many ? 'translations' : 'translation';
  if (m.kind === 'glide') return many ? 'glide reflections' : 'glide reflection';
  if (m.kind === 'reflection') return many ? 'reflections' : 'reflection';
  if (m.kind === 'rotation') {
    if (m.half) return many ? 'half-turns' : 'half-turn';
    const pm = signs && signs.has(1) && signs.has(-1) ? '±' : signs && signs.has(-1) ? '−' : '';
    return `${many ? 'rotations' : 'rotation'} by ${pm}${angleText(m.angle)}`;
  }
  return '';
}

/**
 * Where a copy is at time tau (seconds): 'hidden' before its phase; 'moving' during it (x in [0, 1] the phase's
 * progress, s = ease(x), A = parent ∘ m(s)); 'settling' for `settle` after it lands (sigma in [0, 1]); then 'landed'.
 * The tile itself is always 'landed'.
 */
export function copyState(plan, c, tau) {
  if (c.index === 0) return { phase: 'landed', A: c.g, sigma: 1 };
  if (tau < c.t0 || (c.t1 === c.t0 && tau < c.t1)) return { phase: 'hidden' };
  if (tau < c.t1) {
    const x = (tau - c.t0) / (c.t1 - c.t0), s = ease(x);
    const parent = plan.copies[c.parent];
    return { phase: 'moving', x, s, A: compose(parent.g, c.motion.at(s)) };
  }
  if (tau < c.t1 + plan.settle) return { phase: 'settling', A: c.g, sigma: smooth((tau - c.t1) / plan.settle) };
  return { phase: 'landed', A: c.g, sigma: 1 };
}

/**
 * How the card of a copy is drawn in the state st = copyState(plan, c, tau), `keep` the replay's fade (1 = none; it
 * scales every opacity): null when no card shows (the tile itself, a copy that is hidden or has landed), else
 *   { A, k, back, lift }   A: the map that carries the tile onto the card;
 *                          k: its opacity — it fades in over liftShare of its motion as it leaves its parent, is 1 while
 *                             it moves on, and fades out (1 − sigma) while it settles into the plain tiling under it;
 *                          back: how much of the paper's back is up (0 front, 1 back): the parent's face, turned over by
 *                             a flip (reflection, glide) as it passes edge-on;
 *                          lift: how high a flip stands out of the plane (sin π s): plane.js draws a soft shadow;
 *                          quiet: 1 for a copy of a later layer (deeper than the split), 0 in the first: a quiet card is
 *                             plain paper (no seam colours) — fixed for the card's whole life, so it never switches.
 * Every value is continuous in tau, also from phase to phase (test/replicate.test.js).
 */
export function cardState(plan, c, st, keep = 1) {
  if (!st || c.index === 0) return null;
  const quiet = c.depth > (plan.timing ? plan.timing.split : REP_TIMING.split) ? 1 : 0;
  if (st.phase === 'moving') {
    const k = smooth(st.x / liftShare(plan, c)) * keep;
    const flip = c.motion.kind === 'reflection' || c.motion.kind === 'glide';
    const par = plan.copies[c.parent];
    const turned = flip ? (1 - Math.cos(Math.PI * st.s)) / 2 : 0;
    return { A: st.A, k, back: par.det < 0 ? 1 - turned : turned, lift: flip ? Math.sin(Math.PI * st.s) : 0, quiet };
  }
  if (st.phase === 'settling') return { A: c.g, k: (1 - st.sigma) * keep, back: c.det < 0 ? 1 : 0, lift: 0, quiet };
  return null;
}

/**
 * The caption at tau: the phase that moves now; '' once the last copy has landed (plan.landed: its settle is only the
 * card fading into the tiling) and at the end. `short`: the short words.
 */
export function planCaption(plan, tau, short = false) {
  let cur = null;
  for (const p of plan.phases) { if (tau >= p.t0) cur = p; else break; }
  if (!cur) cur = plan.phases[0] || null;
  const end = Number.isFinite(plan.landed) ? Math.min(plan.landed, plan.T) : plan.T;
  if (!cur || tau >= end - 1e-9) return '';
  return short ? cur.short : cur.text;
}
