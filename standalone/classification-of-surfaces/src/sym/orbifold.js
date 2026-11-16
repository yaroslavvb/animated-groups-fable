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
 * corner where twelve tiles meet). { M, flip }: flip = g turns the plane over (a mirror image of the tile).
 */
export function tiles(D, A, { radius = Infinity, max = 6000 } = {}) {
  const G = D.G, n = D.n;
  // have we met this tile? Points are filed in a grid; one near a cell wall is filed in the cells beyond it too.
  const grid = new Map(), Q = 64, EPS = 1e-9;        // two computations of one tile agree to about 1e-12 of its coordinates; two tiles never come this close
  const near = (p, q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < EPS * (1 + Math.abs(p[2]));
  const known = (p, flip) => {
    const list = grid.get((flip ? 'f' : 'd') + Math.floor(p[0] * Q) + ',' + Math.floor(p[1] * Q) + ',' + Math.floor(p[2] * Q));
    if (list) for (const q of list) if (near(p, q)) return true;
    return false;
  };
  const put = (p, flip) => {
    const e = 2 * EPS * (1 + Math.abs(p[2])), c = [0, 1, 2].map((k) => { const lo = Math.floor((p[k] - e) * Q), hi = Math.floor((p[k] + e) * Q), r = []; for (let q = lo; q <= hi; q++) r.push(q); return r; });
    for (const x of c[0]) for (const y of c[1]) for (const z of c[2]) { const key = (flip ? 'f' : 'd') + x + ',' + y + ',' + z; const l = grid.get(key); if (l) l.push(p); else grid.set(key, [p]); }
  };
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
  put(D.at, false); push({ M: I3.slice(), flip: false, d: 0 });
  while (heap.length && out.length < max) {
    const t = pop();
    out.push(t);
    for (let i = 0; i < n; i++) {
      const M = mul(t.M, A.maps[i]), p = apply(M, D.at), flip = t.flip !== turns[i], d = G.dist(p, D.at);
      if (d > radius || known(p, flip)) continue;
      put(p, flip); push({ M, flip, d });
    }
  }
  return out.sort((x, y) => x.d - y.d);
}
