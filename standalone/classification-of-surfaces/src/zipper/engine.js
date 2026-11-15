// engine.js — the bookkeeping of the Tidying Lemma (Lemma 8.1, pp. 96-100): zip one zip-pair of a tidy surface
// and it is tidy again. Pure data, no drawing; test/engine.test.js checks it against an independent count.
//
// A STATE is { comps: [comp, ...] }. A comp is a tidy surface: a sphere with
//     o handles, x crosscaps, X cross-handles, and one hole per entry of rims.
// A rim is the cyclic word of edges round one hole, listed with the surface on the right as seen from outside
// (counter-clockwise round the hole). An edge is { id, s }:
//     s = +1 / -1   a zip whose arrow runs with / against the listing; its mate has the same id (each id twice)
//     s = 0         a free edge: it stays a piece of boundary for good
//
// zip(state, id) returns { state, info } and never changes its argument. The cases, with rim A = z U and rim B = z' W
// read cyclically from just after the zip (same rim: z U z' W):
//   different components           the two join; one hole U W                                   Figures 8.2 / 8.5
//   one component, two rims        opposite senses: a handle, hole U W                          Figures 8.3 / 8.9
//                                  same sense: a cross-handle, hole U W^-1                      Figures 8.3 / 8.8
//   one rim                        opposite senses: a cap; holes U and W                        Figures 8.4 / 8.6
//                                  same sense: a crosscap; hole U W^-1                          Figures 8.4 / 8.7
// An empty word is no hole at all: that is the "snug" case, the others are "gaping".
// (Joining two components whose zips run the same way turns one of them over first; a tidy surface turned over is
// the same tidy surface.)

export const edge = (id, s) => ({ id, s });
const inv = (word) => word.slice().reverse().map((e) => ({ id: e.id, s: -e.s || 0 }));
const copyComp = (c) => ({ o: c.o, x: c.x, X: c.X, rims: c.rims.map((r) => r.map((e) => ({ id: e.id, s: e.s }))), tag: c.tag });
export const copyState = (st) => ({ comps: st.comps.map(copyComp) });

/**
 * Polygons to a state. Each polygon is a string of edges separated by spaces: "a b a- b-" (a trailing "-" reverses
 * the arrow, a trailing "!" marks a free edge: "a b! a c!"). Every polygon is a disc: a sphere with one hole.
 */
export function fromWords(words) {
  const comps = words.map((w) => ({
    o: 0, x: 0, X: 0,
    rims: [w.trim().split(/\s+/).map((tok) => (tok.endsWith('!') ? edge(tok.slice(0, -1), 0) : tok.endsWith('-') ? edge(tok.slice(0, -1), -1) : edge(tok, 1)))],
  }));
  const st = { comps };
  const seen = new Map();
  for (const c of comps) for (const r of c.rims) for (const e of r) seen.set(e.id, (seen.get(e.id) || 0) + (e.s ? 1 : 10));
  for (const [id, k] of seen) if (k !== 2 && k !== 10) throw new Error(`fromWords: edge ${id} must appear twice as a zip or once as a free edge`);
  return st;
}

/** Where each zip sits: Map id -> [{ c, r, p, s }, { c, r, p, s }]. */
export function zips(state) {
  const m = new Map();
  state.comps.forEach((comp, c) => comp.rims.forEach((rim, r) => rim.forEach((e, p) => {
    if (!e.s) return;
    if (!m.has(e.id)) m.set(e.id, []);
    m.get(e.id).push({ c, r, p, s: e.s });
  })));
  return m;
}
export const zipIds = (state) => [...zips(state).keys()];
export const isDone = (state) => zips(state).size === 0;

const after = (rim, p) => rim.slice(p + 1).concat(rim.slice(0, p));     // the rim read from just after position p, without it

export function zip(state, id) {
  const st = copyState(state);
  const where = zips(st).get(id);
  if (!where || where.length !== 2) throw new Error('zip: no such zip ' + id);
  let [A, B] = where;
  const info = { id, kind: '', fig: '', gaping: false, flipped: false, from: [A.c, B.c], rimsFrom: [A.r, B.r] };

  if (A.c !== B.c) {
    const ca = st.comps[A.c], cb = st.comps[B.c];
    if (A.s === B.s) {                      // turn component B over: every rim reversed, every arrow with it
      cb.rims = cb.rims.map(inv);
      B = { c: B.c, r: B.r, p: cb.rims[B.r].length - 1 - B.p, s: -B.s };
      info.flipped = true;
    }
    const U = after(ca.rims[A.r], A.p), W = after(cb.rims[B.r], B.p), merged = U.concat(W);
    const comp = { o: ca.o + cb.o, x: ca.x + cb.x, X: ca.X + cb.X, rims: [], tag: ca.tag };
    ca.rims.forEach((r, i) => { if (i !== A.r) comp.rims.push(r); });
    cb.rims.forEach((r, i) => { if (i !== B.r) comp.rims.push(r); });
    info.kept = { a: ca.rims.length - 1, b: cb.rims.length - 1 };   // how many untouched rims came from each
    if (merged.length) comp.rims.push(merged);
    info.kind = 'join'; info.gaping = merged.length > 0; info.fig = merged.length ? '8.5' : '8.2';
    info.gaps = [U.length, W.length]; info.newRims = merged.length ? [comp.rims.length - 1] : [];
    const lo = Math.min(A.c, B.c), hi = Math.max(A.c, B.c);
    st.comps.splice(hi, 1); st.comps.splice(lo, 1, comp);
    info.to = lo;
    return { state: st, info };
  }

  const comp = st.comps[A.c];
  info.to = A.c;
  if (A.r !== B.r) {
    const U = after(comp.rims[A.r], A.p), W = after(comp.rims[B.r], B.p);
    const opposite = A.s !== B.s, merged = U.concat(opposite ? W : inv(W));
    comp.rims = comp.rims.filter((r, i) => i !== A.r && i !== B.r);
    if (merged.length) comp.rims.push(merged);
    if (opposite) { comp.o++; info.kind = 'handle'; info.fig = merged.length ? '8.9' : '8.3'; } else { comp.X++; info.kind = 'crosshandle'; info.fig = merged.length ? '8.8' : '8.3'; }
    info.gaping = merged.length > 0; info.gaps = [U.length, W.length]; info.newRims = merged.length ? [comp.rims.length - 1] : [];
    return { state: st, info };
  }

  // the same rim: z U z' W
  if (A.p > B.p) [A, B] = [B, A];
  const rim = comp.rims[A.r];
  const U = rim.slice(A.p + 1, B.p), W = rim.slice(B.p + 1).concat(rim.slice(0, A.p));
  comp.rims = comp.rims.filter((r, i) => i !== A.r);
  info.gaps = [U.length, W.length]; info.newRims = [];
  if (A.s !== B.s) {
    if (U.length) { comp.rims.push(U); info.newRims.push(comp.rims.length - 1); }
    if (W.length) { comp.rims.push(W); info.newRims.push(comp.rims.length - 1); }
    info.kind = 'cap'; info.gaping = U.length + W.length > 0; info.fig = info.gaping ? '8.6' : '8.4';
  } else {
    const merged = U.concat(inv(W));
    if (merged.length) { comp.rims.push(merged); info.newRims.push(comp.rims.length - 1); }
    comp.x++;
    info.kind = 'crosscap'; info.gaping = merged.length > 0; info.fig = info.gaping ? '8.7' : '8.4';
  }
  return { state: st, info };
}

/** What a component is: { o, star, x, X } (star = its holes). */
export const countsOf = (comp) => ({ o: comp.o, star: comp.rims.length, x: comp.x, X: comp.X });
export const chiOf = (c) => 2 - 2 * c.o - c.star - c.x - 2 * c.X;
/** The two trades of pp. 101-102: a cross-handle is two crosscaps; beside a crosscap a handle is two more. */
export function normalForm(c) {
  const out = { o: c.o, star: c.star, x: c.x + 2 * c.X, X: 0 };
  if (out.x > 0) { out.x += 2 * out.o; out.o = 0; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// An independent count, for the tests and for "what will this be?": glue ALL the zips of a set of polygons at once
// and read off, per connected piece, the Euler characteristic, the number of boundaries and the sidedness.
export function census(words) {
  const st = fromWords(words);
  const polys = st.comps.map((c) => c.rims[0]);
  // corners: corner (p, i) is the start of edge i of polygon p, listed with the surface on the right
  const key = (p, i) => p + ':' + i, parent = new Map();
  const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const union = (a, b) => { parent.set(find(a), find(b)); };
  polys.forEach((poly, p) => poly.forEach((e, i) => parent.set(key(p, i), key(p, i))));
  const pos = new Map();
  polys.forEach((poly, p) => poly.forEach((e, i) => { if (e.s) { if (!pos.has(e.id)) pos.set(e.id, []); pos.get(e.id).push({ p, i, s: e.s }); } }));
  const pf = polys.map((_, p) => p), pfind = (a) => { while (pf[a] !== a) a = pf[a] = pf[pf[a]]; return a; };
  for (const [, [a, b]] of pos) {
    const na = polys[a.p].length, nb = polys[b.p].length;
    const a0 = key(a.p, a.i), a1 = key(a.p, (a.i + 1) % na), b0 = key(b.p, b.i), b1 = key(b.p, (b.i + 1) % nb);
    // tail = start of the edge if s = +1, its end if s = -1; tails are glued together, heads together
    const [ta, ha] = a.s > 0 ? [a0, a1] : [a1, a0], [tb, hb] = b.s > 0 ? [b0, b1] : [b1, b0];
    union(ta, tb); union(ha, hb);
    pf[pfind(a.p)] = pfind(b.p);
  }
  const pieces = new Map();
  polys.forEach((poly, p) => { const r = pfind(p); if (!pieces.has(r)) pieces.set(r, { polys: [] }); pieces.get(r).polys.push(p); });
  const out = [];
  for (const piece of pieces.values()) {
    const V = new Set(), inPiece = new Set(piece.polys);
    let E = 0, free = 0;
    for (const p of piece.polys) polys[p].forEach((e, i) => { V.add(find(key(p, i))); if (e.s) E += 0.5; else { E += 1; free++; } });
    // boundaries: chains of free edges; follow each free edge to the next free edge round its end vertex
    const freeEdges = [];
    for (const p of piece.polys) polys[p].forEach((e, i) => { if (!e.s) freeEdges.push({ p, i }); });
    // at a vertex of the glued surface, the boundary passes through a pair of free-edge ends: count boundary
    // components as (free edges) - (free vertices) + (components of the boundary graph): the boundary is a union of
    // circles, so it has as many components as its graph, counted with union-find over free edges sharing a vertex
    const bf = freeEdges.map((_, k) => k), bfind = (a) => { while (bf[a] !== a) a = bf[a] = bf[bf[a]]; return a; };
    const ends = new Map();
    freeEdges.forEach((fe, k) => {
      const n = polys[fe.p].length;
      for (const v of [find(key(fe.p, fe.i)), find(key(fe.p, (fe.i + 1) % n))]) { if (ends.has(v)) bf[bfind(k)] = bfind(ends.get(v)); else ends.set(v, k); }
    });
    const boundaries = new Set(freeEdges.map((_, k) => bfind(k))).size;
    // sides: can the polygons be turned so that every zip joins opposite senses?
    const flip = new Map();
    let twoSided = true;
    const stack = [piece.polys[0]];
    flip.set(piece.polys[0], 1);
    while (stack.length) {
      const p = stack.pop();
      for (const [, [a, b]] of pos) {
        for (const [me, other] of [[a, b], [b, a]]) {
          if (me.p !== p || !inPiece.has(other.p)) continue;
          const want = me.s * flip.get(p) === other.s ? -1 : 1;   // other's flip so that the senses end opposite
          if (!flip.has(other.p)) { flip.set(other.p, want); stack.push(other.p); } else if (flip.get(other.p) !== want) twoSided = false;
        }
      }
    }
    out.push({ chi: V.size - E + piece.polys.length, boundaries, twoSided, free });
  }
  return out;
}
/** The tidy normal form that goes with a census entry (Theorem 8.2). */
export function nameOf({ chi, boundaries, twoSided }) {
  return twoSided ? { o: (2 - boundaries - chi) / 2, star: boundaries, x: 0, X: 0 } : { o: 0, star: boundaries, x: 2 - boundaries - chi, X: 0 };
}
