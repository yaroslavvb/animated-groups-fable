// atlas.js — the pieces glued up: an ATLAS of convex polygons ("atoms"), each in the chart of its piece, with the
// motion that carries every neighbour across every edge into the atom's own chart. Unrolling the atlas from one atom
// (walk) gives the pattern's tiles; no group is ever written down, and a handle or a crosscap needs no special care.
//
// buildAtlas(kind, parts): kind 'H' | 'E'; parts[i] = { id, spec, glue: [per end], cut: [cut id per end] }, where
// glue[k] says what lies across end k of the piece (a cuff or an arc), in the end's own frame (origin at its
// reference foot, the piece on the left):
//   { type: 'pair', part, end, twist }   another end, met after sliding it by twist * len   (flip: glued turned over)
//   { type: 'cap', cap: '*' }            the cuff IS a mirror
//   { type: 'cap', cap: 'x' }            the cuff is glued to itself by the slide of half its length that swaps its sides
//   { type: 'fold', twist }              the cuff folds onto the segment joining two half-turn points, at twist * len
//                                        and half a length further on
//   { type: 'mirror' }                   the arc lies on a mirror (between two corners of order 2)
//   { type: 'half' }                     the arc folds about a half-turn point at its middle
//
// The atlas: { kind, G, atoms, parts }, atom = { id, part, local, verts, sides, at, clear, twin, marks, seams },
// side i (from verts[i] to verts[i + 1]) = { role, cut, primary, mirror, nbrs: [{ atom, T, flip }] }.

import { H, E, mul, apply, I3, tx, ROT_PI, REFL_X, invOf, posOf, mulAll } from './h2.js';
import { buildPiece, incentre } from './pieces.js';

export { incentre };

const det = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);

export function buildAtlas(kind, parts) {
  const G = kind === 'H' ? H : E, inv = invOf(kind);
  const models = parts.map((p) => p.model || buildPiece(p.spec));
  const atlas = { kind, G, atoms: [], parts: parts.map((p, i) => ({ id: p.id, model: models[i], atoms: [], spec: p.spec, glue: p.glue, cut: p.cut })) };
  // ---- every atom in a chart of its own, its middle at the origin. A tile and its neighbour are then never more
  // than their own two sizes apart, and the motion between them is built from the edge they share: a frame on that
  // edge in each chart. (Linked through the charts of their PIECES, two atoms that touch at the far end of a piece
  // seven units long were joined by a product of motions with entries of 10^5 that nearly cancel; unrolled a few
  // steps, the tiles eight units out no longer knew where they were.)
  models.forEach((m, i) => m.atoms.forEach((a, local) => {
    const id = atlas.atoms.length, heart = G.norm(a.verts.reduce((t, v) => [t[0] + v[0], t[1] + v[1], t[2] + v[2]], [0, 0, 0])), d = G.dist(heart, G.origin);
    let C = I3.slice();
    if (d > 1e-12) { const F = G.frame(heart, G.origin); C = mul(mul(F, tx(kind, d)), inv(F)); }
    const verts = a.verts.map((v) => G.norm(apply(C, v))), c = incentre(kind, verts), nv = verts.length;
    atlas.parts[i].atoms.push(id);
    atlas.atoms.push({ id, part: i, local, verts, twin: !!a.twin, at: c.at, clear: c.clear, C, Ci: inv(C), sides: a.roles.map(() => null), marks: [], seams: [], roles: a.roles,
      frames: verts.map((v, e) => G.frame(v, verts[(e + 1) % nv])), lens: verts.map((v, e) => G.dist(v, verts[(e + 1) % nv])) });
  }));
  const gid = (i, local) => atlas.parts[i].atoms[local];
  const onAxis = (x) => posOf(tx(kind, x));
  // ---- inside each piece: seams, mirrors, the piece's own marks
  models.forEach((m, i) => {
    m.atoms.forEach((a, local) => {
      const atom = atlas.atoms[gid(i, local)], nv = a.verts.length;
      a.roles.forEach((role, e) => {
        if (role.r === 'seam') {
          // the neighbour's edge runs the other way along this one: its start is this edge's end
          const nb = atlas.atoms[gid(i, role.nbr.atom)];
          atom.sides[e] = { role: 'seam', nbrs: [{ atom: nb.id, T: mulAll(atom.frames[e], tx(kind, atom.lens[e]), ROT_PI, inv(nb.frames[role.nbr.edge])) }] };
          if (local <= role.nbr.atom) atom.seams.push([atom.verts[e], atom.verts[(e + 1) % nv]]);
        } else if (role.r === 'mirror') atom.sides[e] = { role: 'mirror', mirror: true, nbrs: [{ atom: atom.id, T: mulAll(atom.frames[e], REFL_X, inv(atom.frames[e])) }] };
      });
    });
    for (const mk of m.marks) { const atom = atlas.atoms[gid(i, mk.atom)]; atom.marks.push({ pt: G.norm(apply(atom.C, mk.pt)), dir: G.norm(apply(atom.C, mk.dir)), kind: mk.kind, n: mk.n, part: i, end: mk.end }); }
  });
  // ---- across each cut. Along an end's axis every atom's edge is a stretch [sa, sb] (roles, from pieces.js); what
  // lies across is the other side's stretches, carried by x -> c - x (the two sides face each other: a half turn)
  // or by x -> c + x (a mirror image).
  const across = (i, k) => {
    const end = models[i].ends[k], g = parts[i].glue[k], L = end.len, out = [];
    if (!g) throw new Error(`buildAtlas: end ${k} of part ${parts[i].id} is glued to nothing`);
    const loop = end.t === 'cuff', ns = loop ? [-4, -3, -2, -1, 0, 1, 2, 3, 4] : [0];
    const from = g.type === 'pair' ? { i: g.part, k: g.end } : { i, k }, other = models[from.i].ends[from.k];
    if (!other || !other.axis) throw new Error(`buildAtlas: part ${parts[i].id} end ${k} meets an end that is no cut`);
    for (const n of ns) {
      let turn, c;
      if (g.type === 'pair') { turn = !g.flip; c = loop ? (g.twist || 0) * L + n * L : g.flip ? 0 : L; }
      else if (g.type === 'cap' && g.cap === '*') { turn = false; c = n * L; }
      else if (g.type === 'cap' && g.cap === 'x') { turn = false; c = L / 2 + n * L; }
      else if (g.type === 'fold') { turn = true; c = 2 * (g.twist || 0) * L + n * L; }
      else if (g.type === 'mirror') { turn = false; c = 0; }
      else if (g.type === 'half') { turn = true; c = L; }
      else throw new Error('buildAtlas: no such gluing ' + g.type);
      for (const x of other.axis) out.push({ atom: gid(from.i, x.atom), edge: x.edge, ta: x.sa, turn, c, u0: turn ? c - x.s1 : c + x.s0, u1: turn ? c - x.s0 : c + x.s1 });
    }
    return out;
  };
  const firstUse = new Map();
  parts.forEach((p, i) => models[i].ends.forEach((end, k) => { if (end.axis && p.cut && p.cut[k] != null && !firstUse.has(p.cut[k])) firstUse.set(p.cut[k], i + ':' + k); }));
  models.forEach((m, i) => m.ends.forEach((end, k) => {
    if (!end.axis) return;
    const img = across(i, k), g = parts[i].glue[k], L = end.len, eps = 1e-9 * Math.max(1, L);
    const cut = parts[i].cut ? parts[i].cut[k] : null, primary = firstUse.get(cut) === i + ':' + k;
    const isMirror = (g.type === 'cap' && g.cap === '*') || g.type === 'mirror';
    for (const x of end.axis) {
      const atom = atlas.atoms[gid(i, x.atom)], Fe = atom.frames[x.edge], nbrs = [];
      let covered = 0;
      for (const im of img) {
        const o = Math.min(x.s1, im.u1) - Math.max(x.s0, im.u0);
        if (o <= eps) continue;
        covered += o;
        const nb = atlas.atoms[im.atom];
        nbrs.push({ atom: im.atom, T: mulAll(Fe, tx(kind, im.turn ? im.c - x.sa - im.ta : im.c - x.sa + im.ta), im.turn ? ROT_PI : REFL_X, inv(nb.frames[im.edge])) });
      }
      if (Math.abs(covered - (x.s1 - x.s0)) > 1e-6 * Math.max(1, L)) throw new Error(`buildAtlas: an edge on cut ${cut} is covered ${covered} of ${x.s1 - x.s0}`);
      // axis: the frame at the end's reference foot on the copy of the cut this edge lies on, in the atom's own chart
      atom.sides[x.edge] = { role: 'end', end: k, cut, primary, mirror: isMirror, nbrs, s0: x.s0, s1: x.s1, axis: mul(Fe, tx(kind, -x.sa)) };
      // the points that sit ON the cut: the two half-turn points of a fold, the one of a folded arc, a mirror arc's corners
      const here = (s) => apply(Fe, onAxis(s - x.sa));
      const mark = (s, kind2, which) => atom.marks.push({ pt: here(s), dir: here(s + 0.3), kind: kind2, n: 2, part: i, end: k, which });
      if (g.type === 'fold') for (let m2 = -8; m2 <= 8; m2++) { const s = (g.twist || 0) * L + (m2 * L) / 2; if (s >= x.s0 - 1e-12 && s < x.s1 - 1e-12) mark(s, 'cone', ((m2 % 2) + 2) % 2); }
      if (g.type === 'half' && L / 2 >= x.s0 - 1e-12 && L / 2 < x.s1 - 1e-12) mark(L / 2, 'cone', 0);
      if (g.type === 'mirror') { if (Math.abs(x.s0) < 1e-9) mark(0, 'corner', 0); if (Math.abs(x.s1 - L) < 1e-9) mark(L, 'corner', 1); }
    }
  }));
  for (const a of atlas.atoms) {
    a.sides.forEach((s, e) => { if (!s) throw new Error('buildAtlas: an edge was left unglued'); for (const nb of s.nbrs) nb.flip = det(nb.T) < 0; s.len = a.lens[e]; });
    a.reach = Math.max(...a.verts.map((v) => G.dist(v, a.at)));
  }
  atlas.reach = Math.max(...atlas.atoms.map((a) => a.reach));
  atlas.clear = Math.min(...atlas.atoms.map((a) => a.clear));
  atlas.area = atlas.atoms.reduce((s, a) => s + Math.abs(G.area(a.verts)), 0);
  return atlas;
}
/** An atom's chart laid in a frame, given how its PIECE's chart lies there (M: piece chart -> frame). */
export const atomIn = (atlas, atomId, M) => mul(M, atlas.atoms[atomId].Ci);

/**
 * The tiles of the pattern, unrolled from the atom `home` (which lies as its chart has it): [{ atom, M, flip, d }], the
 * nearest first: every copy M(atom) whose middle is within `radius` of the home atom's middle, at most `max` of them.
 * As the Classification page's orbifold.js tiles(), whose way of telling "have we met this tile?" this follows (two
 * middles are one tile when they are within a thousandth of the room a tile has; far out on the hyperbolic plane a
 * point is filed by its distance and direction, which stay put under rounding where its coordinates do not).
 */
export function walk(atlas, home = 0, { radius = Infinity, max = 6000, ms = 1500 } = {}) {
  const G = atlas.G, hyper = atlas.kind === 'H', sphere = atlas.kind === 'S';
  const tau = 1e-3 * Math.min(1, atlas.clear || 1), origin = atlas.atoms[home].at;
  const grid = new Map();
  const cells = (p, tag, wide) => {
    const out = [];
    if (hyper) {
      const d = Math.acosh(Math.max(1, p[2])), th = Math.atan2(p[1], p[0]), e = wide ? 3 * tau + 1e-6 : 0;
      for (let id = Math.floor((d - e) * 16); id <= Math.floor((d + e) * 16); id++) {
        if (id < 0) continue;
        const N = Math.max(1, Math.min(1 << 20, Math.round(16 * Math.sinh((id + 0.5) / 16)))), k = N / (2 * Math.PI), et = e / Math.max(0.05, Math.sinh(d));
        const lo = Math.floor((th - et) * k), hi = Math.min(lo + N - 1, Math.floor((th + et) * k));
        for (let it = lo; it <= hi; it++) out.push(tag + ':' + id + ':' + (((it % N) + N) % N));
      }
      return out;
    }
    const Q = sphere ? 64 : 16 / Math.max(1e-6, atlas.clear), e = wide ? 3 * tau : 0, c = [0, 1, 2].map((k) => [Math.floor((p[k] - e) * Q), Math.floor((p[k] + e) * Q)]);
    for (let x = c[0][0]; x <= c[0][1]; x++) for (let y = c[1][0]; y <= c[1][1]; y++) for (let z = c[2][0]; z <= c[2][1]; z++) out.push(tag + ':' + x + ',' + y + ',' + z);
    return out;
  };
  const known = (p, tag) => { const list = grid.get(cells(p, tag, false)[0]); if (list) for (const q of list) if (G.dist(p, q) < tau) return true; return false; };
  const put = (p, tag) => { for (const key of cells(p, tag, true)) { const l = grid.get(key); if (l) l.push(p); else grid.set(key, [p]); } };
  const heap = [];
  const push = (t) => { heap.push(t); for (let i = heap.length - 1; i > 0;) { const up = (i - 1) >> 1; if (heap[up].d <= heap[i].d) break; [heap[up], heap[i]] = [heap[i], heap[up]]; i = up; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].d < heap[m].d) m = l; if (r < heap.length && heap[r].d < heap[m].d) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top;
  };
  const out = [], t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  // the frame the walk is filed in has the home atom's middle at the origin, so that "far out" means far from it
  const C = G.translate(origin, G.origin);
  put(apply(C, origin), home + 'd'); push({ atom: home, M: I3.slice(), flip: false, d: 0 });
  while (heap.length && out.length < max) {
    const t = pop();
    out.push(t);
    if ((out.length & 63) === 0 && typeof performance !== 'undefined' && performance.now() - t0 > ms) break;
    const A = atlas.atoms[t.atom];
    for (const side of A.sides) for (const nb of side.nbrs) {
      const M = mul(t.M, nb.T), B = atlas.atoms[nb.atom], p = apply(C, apply(M, B.at)), flip = t.flip !== nb.flip, d = G.dist(p, G.origin);
      if (!(d <= radius)) continue;
      if (hyper && !(Math.abs(p[0] * p[0] + p[1] * p[1] - p[2] * p[2] + 1) <= 1e-6 * (1 + p[2] * p[2]))) continue;
      const tag = nb.atom + (flip ? 'f' : 'd');
      if (known(p, tag)) continue;
      put(p, tag); push({ atom: nb.atom, M, flip, d });
    }
  }
  return out.sort((x, y) => x.d - y.d);
}

/** Is the point q (in the chart of `atom`) inside it? The most it is outside any side, as a distance (<= 0: inside). */
export function outside(atlas, atom, q) {
  const G = atlas.G, A = atlas.atoms[atom], n = A.verts.length;
  let worst = -Infinity, at = -1;
  for (let i = 0; i < n; i++) {
    const F = G.frame(A.verts[i], A.verts[(i + 1) % n]), nrm = [F[1], F[4], F[7]];
    const s = atlas.kind === 'E' ? (q[0] - A.verts[i][0]) * nrm[0] + (q[1] - A.verts[i][1]) * nrm[1] : atlas.kind === 'H' ? Math.asinh(G.form(q, nrm)) : Math.asin(Math.max(-1, Math.min(1, G.form(q, nrm))));
    if (-s > worst) { worst = -s; at = i; }      // s > 0: on the inner (left) side
  }
  return { d: worst, side: at };
}

/**
 * The tile that holds the point p: starting from the tile (atom, M), step across the side p is furthest outside of
 * until it is inside. Returns { atom, M, flip } with M^{-1} p in the atom, or null if it does not get there.
 */
export function locate(atlas, start, p, { steps = 400 } = {}) {
  const inv = invOf(atlas.kind), G = atlas.G;
  let cur = { atom: start.atom, M: start.M || I3.slice(), flip: !!start.flip };
  for (let it = 0; it < steps; it++) {
    const A = atlas.atoms[cur.atom], q = apply(inv(cur.M), p), o = outside(atlas, cur.atom, q);
    if (o.d <= 1e-9) return cur;
    // across that side: the neighbour whose middle is nearest the point
    let best = null, bd = Infinity;
    for (const nb of A.sides[o.side].nbrs) { const d = G.dist(apply(nb.T, atlas.atoms[nb.atom].at), q); if (d < bd) { bd = d; best = nb; } }
    if (!best) return null;
    cur = { atom: best.atom, M: mul(cur.M, best.T), flip: cur.flip !== best.flip };
  }
  return null;
}

/**
 * Checks an atlas against what an atlas must be (for the tests): every edge's neighbours agree with the neighbours'
 * own edges, and returns its area. Throws on the first fault.
 */
export function checkAtlas(atlas, tol0 = 1e-7) {
  const G = atlas.G, inv = invOf(atlas.kind);
  for (const A of atlas.atoms) {
    const n = A.verts.length;
    if (G.area(A.verts) <= 0) throw new Error(`atom ${A.id} is not counter-clockwise`);
    A.sides.forEach((side, e) => {
      const a = A.verts[e], b = A.verts[(e + 1) % n];
      for (const nb of side.nbrs) {
        const B = atlas.atoms[nb.atom], m = B.verts.length, Ti = inv(nb.T), big = Math.max(...nb.T.map(Math.abs)), tol = Math.max(tol0, 1e-11 * big * big);
        // B, placed by T, must have an edge along this one, run the other way, and must name A back with the inverse motion
        let ok = false;
        for (let j = 0; j < m && !ok; j++) {
          const c = apply(nb.T, B.verts[j]), d = apply(nb.T, B.verts[(j + 1) % m]);
          const onLine = G.lineDist(c, a, b) < tol && G.lineDist(d, a, b) < tol;
          if (!onLine) continue;
          const back = B.sides[j].nbrs.some((x) => x.atom === A.id && matNear(x.T, Ti, 1e-4));      // the two are made from different frames: on a piece ten units long they agree to five digits
          if (back) ok = true;
        }
        if (!ok) throw new Error(`atom ${A.id} edge ${e}: its neighbour ${nb.atom} does not answer`);
        // and its middle must lie on the far side of the edge
        const F = G.frame(a, b), nrm = [F[1], F[4], F[7]], mid = apply(nb.T, B.at);
        const s = atlas.kind === 'E' ? (mid[0] - a[0]) * nrm[0] + (mid[1] - a[1]) * nrm[1] : G.form(mid, nrm);
        if (!(s < 0)) throw new Error(`atom ${A.id} edge ${e}: its neighbour ${nb.atom} lies on the wrong side`);
      }
    });
  }
  return atlas.area;
}
function matNear(A, B, tol) { let d = 0, s = 1; for (let i = 0; i < 9; i++) { d = Math.max(d, Math.abs(A[i] - B[i])); s = Math.max(s, Math.abs(A[i])); } return d / s < tol; }

/** How many of the given tiles hold the point p (given in the home atom's chart)? A pattern covers every point once. */
export function coverCount(atlas, tiles, p, margin = 1e-7) {
  const inv = invOf(atlas.kind);
  let inside = 0, edge = 0;
  for (const t of tiles) {
    const o = outside(atlas, t.atom, apply(inv(t.M), p));
    if (o.d < -margin) inside++; else if (o.d <= margin) edge++;
  }
  return { inside, edge };
}
