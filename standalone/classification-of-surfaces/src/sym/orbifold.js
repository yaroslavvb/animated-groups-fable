// orbifold.js — read a tile's ORBIFOLD off its glued edges, and make the pattern's tiles.
//
// analyse(domain) folds the tile up on paper (no drawing) and returns what the signature lists:
//   classes   the tile's corners in groups that land on ONE point of the orbifold, each with its total angle:
//               a closed ring of corners, total 2 pi / n   -> kind 'cone',   order n  (n = 1: an ordinary point)
//               a chain ending on mirrors, total pi / n    -> kind 'corner', order n  (n = 1: an ordinary rim point)
//   stars     the boundaries: each a ring of mirror edges, with its corner classes of order > 1 in order round it
//   surface   { o, star, x }: what the tile zips up to (tab 3's bookkeeping does this part: engine.js census)
//   cost, chi the signature's price as a fraction, and 2 - cost
//   maps      maps[i]: the symmetry that takes the tile to its neighbour across edge i
//   glides    the gluings that turn the tile over, each with a piece of its axis
// Nothing here is typed in by hand: test/sym.test.js checks every example's symbol against this reading, and the
// tile's area against the price (Gauss-Bonnet).

import { mul, apply, I3 } from './geom.js';
import { census, nameOf } from '../zipper/engine.js';

const TAU = 2 * Math.PI;
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const frac = (n, d = 1) => { const g = gcd(n, d) || 1, s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
export const fadd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fsub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fval = (a) => a.n / a.d;
/** What each thing in a signature costs (Table 3.1 of the book, p. 29). */
export const PRICE = { o: () => frac(2), star: () => frac(1), x: () => frac(1), cone: (n) => frac(n - 1, n), corner: (n) => frac(n - 1, 2 * n) };

export function analyse(D) {
  const { G, verts, edges, n } = D;
  // no edges: the whole sphere, nothing glued, nothing on it
  if (!n) return { angles: [], maps: [], classes: [], cls: [], stars: [], surface: { o: 0, star: 0, x: 0, X: 0 }, cones: [], cost: frac(0), chi: frac(2), word: '', pairs: [], glides: [], letter: [] };
  const next = (i) => (i + 1) % n, prev = (i) => (i + n - 1) % n;
  const angles = verts.map((v, i) => G.angle(v, verts[prev(i)], verts[next(i)]));
  const maps = edges.map((e, i) => {
    const a = verts[i], b = verts[next(i)];
    if (e.mirror) return G.reflect(a, b);
    const c = verts[e.to], d = verts[next(e.to)];
    return e.rev ? G.fit(c, d, a, b, true) : G.fit(c, d, b, a, false);
  });

  // ---- corners that meet at one point. A state is (corner v, the edge about to be crossed: v's own edge or the one before).
  const step = (v, e) => {
    const ed = edges[e];
    if (ed.mirror) return null;
    const isStart = e === v, j = ed.to, atStart = ed.rev ? isStart : !isStart;
    return atStart ? [j, prev(j)] : [next(j), next(j)];
  };
  const cls = new Array(n).fill(-1), classes = [];
  for (let v0 = 0; v0 < n; v0++) {
    if (cls[v0] >= 0) continue;
    const members = [v0];
    let closed = false, ends = null, st = [v0, v0], guard = 0;
    for (;;) {
      const nx = step(st[0], st[1]);
      if (!nx) { ends = [null, { e: st[1], side: st[1] === st[0] ? 'start' : 'end' }]; break; }
      if (nx[0] === v0 && nx[1] === v0) { closed = true; break; }
      members.push(nx[0]); st = nx;
      if (++guard > 4 * n) throw new Error('analyse: the corners do not close up');
    }
    if (!closed) {
      st = [v0, prev(v0)];
      for (;;) {
        const nx = step(st[0], st[1]);
        if (!nx) { ends[0] = { e: st[1], side: st[1] === st[0] ? 'start' : 'end' }; break; }
        members.unshift(nx[0]); st = nx;
        if (++guard > 8 * n) throw new Error('analyse: the corners do not close up');
      }
    }
    const total = members.reduce((s, v) => s + angles[v], 0), q = (closed ? TAU : Math.PI) / total, order = Math.round(q);
    if (Math.abs(q - order) > 1e-6 || order < 1) throw new Error(`analyse: corners ${members} meet with angle ${total}, not ${closed ? '2' : ''}pi / n`);
    const id = classes.length;
    for (const v of members) { if (cls[v] >= 0) throw new Error('analyse: a corner lies in two classes'); cls[v] = id; }
    classes.push({ id, kind: closed ? 'cone' : 'corner', n: order, verts: members, total, ends });
  }

  // ---- boundaries: rings of mirror edges, joined through the corner chains
  const endAt = new Map();
  for (const c of classes) if (c.ends) c.ends.forEach((en, k) => endAt.set(en.e + ':' + en.side, { c, k }));
  const stars = [], seen = new Set();
  for (let e0 = 0; e0 < n; e0++) {
    if (!edges[e0].mirror || seen.has(e0)) continue;
    const star = { edges: [], corners: [] };
    let e = e0, side = 'end', guard = 0;
    do {
      seen.add(e); star.edges.push(e);
      const hit = endAt.get(e + ':' + side);
      if (!hit) throw new Error('analyse: a mirror edge ends nowhere');
      if (hit.c.n > 1) star.corners.push(hit.c.id);
      const other = hit.c.ends[1 - hit.k];
      e = other.e; side = other.side === 'start' ? 'end' : 'start';
      if (++guard > 2 * n) throw new Error('analyse: a boundary does not close');
    } while (!(e === e0 && side === 'end'));
    stars.push(star);
  }

  // ---- the surface the tile zips up to
  const ids = 'abcdefghijklmnopqrstuvwxyz';
  let k = 0;
  const letter = new Array(n).fill(null);
  const toks = edges.map((ed, i) => {
    if (ed.mirror) return 'm' + i + '!';
    if (ed.to > i) { letter[i] = letter[ed.to] = ids[k++]; return letter[i]; }
    return letter[i] + (ed.rev ? '' : '-');
  });
  const word = toks.join(' ');
  const cen = census([word])[0], surface = nameOf(cen);
  if (surface.star !== stars.length) throw new Error('analyse: the two counts of boundaries disagree');

  const cones = classes.filter((c) => c.kind === 'cone' && c.n > 1).sort((a, b) => b.n - a.n).map((c) => c.id);
  let cost = frac(2 * surface.o + surface.x + stars.length);
  for (const id of cones) cost = fadd(cost, PRICE.cone(classes[id].n));
  for (const s of stars) for (const id of s.corners) cost = fadd(cost, PRICE.corner(classes[id].n));
  const chi = fsub(frac(2), cost);

  // ---- the gluings: pairs of edges, each once; a glide's axis runs through the middles of what it pairs
  const pairs = [], glides = [];
  edges.forEach((ed, i) => {
    if (ed.mirror || ed.to < i) return;
    const pr = { i, j: ed.to, rev: !!ed.rev, letter: letter[i] };
    pairs.push(pr);
    if (!ed.rev) return;
    const M = maps[i], mid = (a, b) => G.mix(a, b, 0.5);
    const far = (a, b) => (G.kind === 'S' ? G.dist(a, b) < Math.PI - 1e-6 : true);
    const cand = [];
    for (const p of [verts[ed.to], verts[next(ed.to)], D.at, mid(verts[ed.to], verts[next(ed.to)])]) { const q = apply(M, p); if (far(p, q)) cand.push(mid(p, q)); }
    let best = null;
    for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) { const d = G.dist(cand[a], cand[b]); if (!best || d > best.d) best = { d, a: cand[a], b: cand[b] }; }
    // the gluing of opposite points of a sphere has no axis of its own: every great circle will do. Take the edge itself.
    if (!best || best.d < 1e-6) { glides.push({ ...pr, seg: [verts[ed.to], verts[next(ed.to)]] }); return; }
    const mj = mid(verts[ed.to], verts[next(ed.to)]), mi = mid(verts[i], verts[next(i)]);
    glides.push({ ...pr, seg: [G.foot(mj, best.a, best.b), G.foot(mi, best.a, best.b)] });
  });

  return { angles, maps, classes, cls, stars, surface, cones, cost, chi, word, pairs, glides, letter };
}

/** The signature as plain data: { o, x, cones: [n...], stars: [[n...], ...] }. */
export function signatureOf(A) {
  return { o: A.surface.o, x: A.surface.x, cones: A.cones.map((id) => A.classes[id].n), stars: A.stars.map((s) => s.corners.map((id) => A.classes[id].n)) };
}

/**
 * The tiles of the pattern: the symmetries g (as matrices) with g(at) within `radius` of `at`, the NEAREST ones first,
 * at most `max` of them. Found by walking from tile to neighbouring tile, always going on from the nearest tile
 * not yet looked at (a plain walk by number of steps would run out of its `max` long before it had gone round a
 * corner where twelve tiles meet). { M, flip, d }: flip = g turns the plane over (a mirror image of the tile).
 *
 * "Have we met this tile?" is asked of the tile's point g(at), and has to survive rounding. Round a corner where
 * sixteen tiles meet (four handles) eight steps of big matrices that nearly undo one another leave a point about
 * 1e-9 of its coordinates off; a test tighter than that took the tile for a new one, the copy bred copies, their
 * matrices fell off the group altogether, and the page froze (his report, Sun 15 Nov 2026: "If I type 4 handles in
 * a row, the whole thing freezes"). So now:
 *   - two points are one tile when they are within `tau` of each other in the geometry's own distance; tau is a
 *     thousandth of the room a tile's point has, and two tiles' points are at least twice that room apart;
 *   - on the hyperbolic plane a point is filed by how far out it is and in which direction, which both stay put
 *     when the point moves a little however far out it is (its coordinates do not: they grow like e^distance);
 *   - a tile whose point has left the geometry (rounding gone wild: not a number, or off the hyperboloid by more
 *     than a millionth of its size) is dropped; and the walk gives up after `ms` milliseconds with what it has,
 *     so nothing here can hang the page again.
 * (The matrices are NOT put back onto the group with geom.js fix as they are made: far out that step subtracts
 * numbers of the size e^distance and costs a thousand times the accuracy it is meant to save. Tried, measured,
 * taken out.)
 */
export function tiles(D, A, { radius = Infinity, max = 6000, ms = 1500 } = {}) {
  const G = D.G, n = D.n, hyper = G.kind === 'H';
  const tau = 1e-3 * Math.min(1, D.clear || 1);
  const grid = new Map();
  /** The cells a point is filed in (or looked up in, with margin 0): keys. */
  const cells = (p, flip, wide) => {
    const out = [], tag = flip ? 'f' : 'd';
    if (hyper) {
      // rings 1/16 wide, each cut into sectors about 0.4 long: a cell holds a tile or two at most
      const d = Math.acosh(Math.max(1, p[2])), th = Math.atan2(p[1], p[0]), e = wide ? 3 * tau + 1e-6 : 0;
      for (let id = Math.floor((d - e) * 16); id <= Math.floor((d + e) * 16); id++) {
        if (id < 0) continue;
        const N = Math.max(1, Math.min(1 << 20, Math.round(16 * Math.sinh((id + 0.5) / 16)))), k = N / (2 * Math.PI), et = e / Math.max(0.05, Math.sinh(d));
        const lo = Math.floor((th - et) * k), hi = Math.min(lo + N - 1, Math.floor((th + et) * k));
        for (let it = lo; it <= hi; it++) out.push(tag + id + ':' + (((it % N) + N) % N));
      }
      return out;
    }
    const Q = 64, e = wide ? 3 * tau : 0, c = [0, 1, 2].map((k) => [Math.floor((p[k] - e) * Q), Math.floor((p[k] + e) * Q)]);
    for (let x = c[0][0]; x <= c[0][1]; x++) for (let y = c[1][0]; y <= c[1][1]; y++) for (let z = c[2][0]; z <= c[2][1]; z++) out.push(tag + x + ',' + y + ',' + z);
    return out;
  };
  const known = (p, flip) => {
    const list = grid.get(cells(p, flip, false)[0]);
    if (list) for (const q of list) if (G.dist(p, q) < tau) return true;
    return false;
  };
  const put = (p, flip) => { for (const key of cells(p, flip, true)) { const l = grid.get(key); if (l) l.push(p); else grid.set(key, [p]); } };
  // the tiles found and not yet gone on from, the nearest on top (a binary heap)
  const heap = [];
  const push = (t) => {
    heap.push(t);
    for (let i = heap.length - 1; i > 0;) { const up = (i - 1) >> 1; if (heap[up].d <= heap[i].d) break; [heap[up], heap[i]] = [heap[i], heap[up]]; i = up; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].d < heap[m].d) m = l; if (r < heap.length && heap[r].d < heap[m].d) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
    }
    return top;
  };
  const turns = D.edges.map((e) => !!(e.mirror || e.rev)), out = [];
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  put(D.at, false); push({ M: I3.slice(), flip: false, d: 0 });
  while (heap.length && out.length < max) {
    const t = pop();
    out.push(t);
    if ((out.length & 63) === 0 && typeof performance !== 'undefined' && performance.now() - t0 > ms) break;
    for (let i = 0; i < n; i++) {
      const M = mul(t.M, A.maps[i]), p = apply(M, D.at), flip = t.flip !== turns[i], d = G.dist(p, D.at);
      if (!(d <= radius)) continue;                                                                    // too far, or not a number
      if (hyper && !(Math.abs(p[0] * p[0] + p[1] * p[1] - p[2] * p[2] + 1) <= 1e-6 * (1 + p[2] * p[2]))) continue;   // rounding has carried it off the plane
      if (known(p, flip)) continue;
      put(p, flip); push({ M, flip, d });
    }
  }
  return out.sort((x, y) => x.d - y.d);
}
