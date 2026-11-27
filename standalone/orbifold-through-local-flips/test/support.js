// support.js — what the tests share: "is this the same pattern?" asked of two atlases, "is the plane covered once?",
// "are the commas where they were?", and a random-number generator that gives the same numbers every run.
//
// A pattern is its group. An atlas hands its group over as generators: lay one atom down, reach every other atom
// along a tree of neighbours, and for every edge of every atom the motion that carries the tree's copy of the
// neighbour onto the copy across that edge is a symmetry; together they generate the group. Two atlases laid in one
// frame draw the same pattern exactly when each one's generators are symmetries of the other, and a motion g is a
// symmetry of an atlas exactly when a point x and its image g(x) sit at the same place of the same atom.

import { locate, walk, coverCount } from '../src/atlas.js';
import { mul, apply, I3, invOf } from '../src/h2.js';

/** A generator of numbers in (0, 1) that depends on the seed alone. */
export const rng = (seed = 5) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** The atoms of an atlas laid in a frame, the atom `root` by the motion M0: place[atomId] = M (or undefined if not reached). */
export function layDown(atlas, root, M0) {
  const place = new Array(atlas.atoms.length), queue = [root];
  place[root] = M0;
  while (queue.length) {
    const a = queue.shift();
    for (const side of atlas.atoms[a].sides) for (const nb of side.nbrs) if (!place[nb.atom] && !nb.flip) { place[nb.atom] = mul(place[a], nb.T); queue.push(nb.atom); }
  }
  // atoms reached only across a mirror or a crosscap
  let grew = true;
  while (grew) {
    grew = false;
    atlas.atoms.forEach((A, a) => { if (!place[a]) return; for (const side of A.sides) for (const nb of side.nbrs) if (!place[nb.atom]) { place[nb.atom] = mul(place[a], nb.T); grew = true; } });
  }
  return place;
}
/**
 * Do two atlases, each laid in the same frame (atom rootA by MA, atom rootB by MB), draw the same pattern?
 * Returns { ok, worst, tried, skipped, why }.
 *
 * Each generator g of one atlas carries a copy of an atom onto the copy across one of its neighbour's edges. It is
 * tried on the other atlas where it acts: the tile of the other atlas that holds the first copy's middle is found,
 * and g must carry THAT tile's middle (a point as far from every edge as can be, so which atom its image lies in is
 * never in doubt) onto the middle of a tile of the same atom. A generator whose two copies lie more than `far` from
 * the frame's origin is left out: out there a point is no longer known to the accuracy asked (its coordinates grow
 * like e^distance); the pattern is held by the others, every cut being crossed near the root.
 */
export function samePattern(A, rootA, MA, B, rootB, MB, { tol = 1e-4, far = 7 } = {}) {
  const G = A.G, placeA = layDown(A, rootA, MA), placeB = layDown(B, rootB, MB);
  let worst = 0, tried = 0, skipped = 0;
  const check = (X, placeX, Y, rootY, MY, label) => {
    const inv = invOf(X.kind);
    let did = 0;
    for (let a = 0; a < X.atoms.length; a++) for (const side of X.atoms[a].sides) for (const nb of side.nbrs) {
      const g = mul(mul(placeX[a], nb.T), inv(placeX[nb.atom]));
      let trivial = true;
      for (let i = 0; i < 9; i++) if (Math.abs(g[i] - I3[i]) > 1e-9) trivial = false;
      if (trivial) continue;
      const p = apply(placeX[nb.atom], X.atoms[nb.atom].at);
      if (!(G.dist(p, G.origin) < far)) { skipped++; continue; }
      const t0 = locate(Y, { atom: rootY, M: MY }, p, { steps: 6000 });
      if (!t0) return `${label}: a tile's middle was not found in the other atlas`;
      const x = apply(t0.M, Y.atoms[t0.atom].at), y = apply(g, x);
      if (!(G.dist(y, G.origin) < far)) { skipped++; continue; }
      const loc = locate(Y, t0, y, { steps: 6000 });
      tried++; did++;
      if (!loc) return `${label}: the image of a tile's middle was not found`;
      if (loc.atom !== t0.atom) return `${label}: the middle of a tile of atom ${t0.atom} is carried into atom ${loc.atom}`;
      const d = G.dist(apply(invOf(Y.kind)(loc.M), y), Y.atoms[t0.atom].at);
      if (!(d < tol)) return `${label}: the image is ${d} off`;
      worst = Math.max(worst, d);
    }
    return did ? null : `${label}: no generator near enough to try`;
  };
  const why = check(A, placeA, B, rootB, MB, 'a symmetry of the first is none of the second') || check(B, placeB, A, rootA, MA, 'a symmetry of the second is none of the first');
  return { ok: !why, worst, tried, skipped, why };
}

/**
 * How many of `n` points thrown near the first atom are NOT in exactly one tile (a point on an edge must be on the
 * edges of two or more). 0 says the tiles cover the plane once there.
 */
export function coverFaults(atlas, { n = 100, radius, spread, seed = 7 } = {}) {
  const G = atlas.G, hyp = atlas.kind === 'H', rnd = rng(seed);
  const tiles = walk(atlas, 0, { radius: radius || (hyp ? 4.4 : 14), max: 20000 });
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const p = apply(G.translate(G.origin, atlas.atoms[0].at), G.polar((spread || (hyp ? 1.9 : 5)) * Math.sqrt(rnd()), 6.283 * rnd()));
    const c = coverCount(atlas, tiles, p);
    if (!(c.inside === 1 && c.edge === 0) && !(c.inside === 0 && c.edge >= 2)) bad++;
  }
  return bad;
}

/**
 * After a flip: is every comma of state `a` a comma of state `b`, point for point? carry(atomId) -> { atom, M } is
 * the flip's own account of where an old atom lies in the new atlas. Returns { n, missing, worst }.
 */
export function printKept(a, b, carry) {
  const G = b.atlas.G, inv = invOf(b.atlas.kind);
  let worst = 0, missing = 0, n = 0;
  a.shapes.forEach((list, atomId) => {
    const c = carry(atomId);
    for (const sh of list) {
      n++;
      const p = apply(c.M, sh.c), loc = locate(b.atlas, { atom: c.atom, M: I3 }, p);
      if (!loc) { missing++; continue; }
      const back = mul(inv(loc.M), c.M), pts = sh.pts.map((q) => apply(back, q));
      let best = Infinity;
      for (const t of b.shapes[loc.atom]) { if (t.pts.length !== pts.length) continue; let d = 0; for (let i = 0; i < pts.length; i += 5) d = Math.max(d, G.dist(pts[i], t.pts[i])); best = Math.min(best, d); }
      if (best > 1e-5) missing++; else worst = Math.max(worst, best);
    }
  });
  return { n, missing, worst };
}
export { I3 };
