// decomp.js — a DECOMPOSITION of an orbifold as plain data, the canonical one every signature starts from, and the
// numbers of shape that go with it.
//
// A decomposition D is { pieces, cuts, seq }:
//   pieces  [{ id, kind: 'P' | 'M' | 'S', ends: [...] }]     (pieces.js; a P or an M has three ends, an S two)
//             end: { t: 'cuff', cut } | { t: 'arc', cut } | { t: 'cone', n, f } | { t: 'corner', n, f }
//   cuts    { id: { id, type: 'cuff' | 'arc', cap } }
//             a cut is named by two ends, or by one end and a cap: '*' the cuff IS a smooth mirror, 'x' the cuff is
//             closed up by a crosscap. The other three caps are pieces that have no area (pieces.js degenerate):
//             P(cuff, 2, 2) two half-turn points the cuff folds onto; M(arc, 2, 2) the arc lies on the mirror
//             between two corners of order 2; S(2 | arc) the arc folds about one half-turn point.
//
// Its numbers: params = { cutId: { len, tw } }; tw (in turns, -1/2 .. 1/2) only for a cuff that has no cap.
//
// classify(sig) says which of the page's three ways a signature is shown:
//   'pieces'  hyperbolic with numbers of shape: this file and moves.js
//   'flat'    one of the nine Euclidean types with a number of shape: flat.js
//   'rigid'   no number of shape (every spherical type, eight Euclidean ones, the hyperbolic pqr, *pqr, p*q): the
//             Classification page's own tile, shown as it is
//
// defaultDecomp(sig) is the canonical decomposition:
//   each smooth mirror and each crosscap closes a cuff; a mirror with corners sits behind a cuff, as a crown (one
//   corner) or as a half-pants and a fan of mirror polygons (more); each handle is a one-holed torus behind a cuff;
//   those cuffs and the cone points are then strung on a caterpillar of pants. Two things alone are joined directly,
//   and a mirror alone is a fan of mirror polygons.

import { parse, textOf, costOf, canon, domainOf, whyNot, spelled } from '../../classification-of-surfaces/src/sym/catalog.js';
import { fval } from '../../classification-of-surfaces/src/sym/orbifold.js';
import { degenerate } from './pieces.js';

export const L_CUFF = 2 * Math.acosh(2);      // the cuff of the regular right-angled hexagon
export const L_ARC = Math.acosh(2);

export const FLAT = ['2222', '*2222', '22*', '22x', '2*22', '**', '*x', 'xx', 'o'];

/** How a signature is shown, and what it is: { sig, text, geometry, chi, dim, mode, why }. */
export function classify(sig) {
  const text = textOf(canon(sig)), cost = fval(costOf(sig)), chi = 2 - cost;
  const geometry = Math.abs(chi) < 1e-9 ? 'E' : chi > 0 ? 'S' : 'H';
  if (!domainOf(sig)) return { sig, text, geometry, chi, dim: 0, mode: 'none', why: whyNot(sig) };
  const k = sig.cones.length, l = sig.stars.reduce((s, c) => s + c.length, 0), chiU = 2 - 2 * sig.o - sig.x - sig.stars.length;
  let dim = 0, mode = 'rigid';
  if (geometry === 'H') { dim = -3 * chiU + 2 * k + l; if (dim > 0) mode = 'pieces'; }
  if (geometry === 'E' && FLAT.includes(text)) { mode = 'flat'; dim = text === '2222' || text === 'o' ? 2 : 1; }
  return { sig, text, geometry, chi, dim, mode, why: null };
}
export { parse, textOf, canon, spelled };

// ---------------------------------------------------------------------------------------------------------------
// reading a decomposition

export const pieceOf = (D, id) => D.pieces.find((p) => p.id === id);
/** The ends that name a cut: [{ piece, end }] (one or two). */
export function refs(D, cutId) {
  const out = [];
  for (const p of D.pieces) p.ends.forEach((e, k) => { if ((e.t === 'cuff' || e.t === 'arc') && e.cut === cutId) out.push({ piece: p, end: k }); });
  return out;
}
/** The spec pieces.js builds a piece from, with its cuts' lengths. */
export const specOf = (piece, params) => ({ kind: piece.kind, ends: piece.ends.map((e) => (e.t === 'cuff' || e.t === 'arc' ? { t: e.t, len: params[e.cut].len } : { t: e.t, n: e.n })) });
export const isCap = (piece) => degenerate({ kind: piece.kind, ends: piece.ends });
/** Does this cut carry a twist? A cuff with no cap ('*' or 'x'): two pieces meet along it, or a piece and a fold. */
export const hasTwist = (D, cutId) => D.cuts[cutId].type === 'cuff' && !D.cuts[cutId].cap;
/** The cuts in the order the page lists them. */
export const cutList = (D) => Object.keys(D.cuts);
export const countParams = (D) => cutList(D).reduce((s, id) => s + 1 + (hasTwist(D, id) ? 1 : 0), 0);

/** Fresh numbers for a decomposition: every cuff the regular hexagon's, every arc half of it, no twist. */
export function defaultParams(D) {
  const P = {};
  for (const id of cutList(D)) P[id] = D.cuts[id].type === 'cuff' ? (hasTwist(D, id) ? { len: L_CUFF, tw: 0 } : { len: L_CUFF }) : { len: L_ARC };
  return P;
}

/** What buildAtlas takes: the pieces that have area, each end with what lies across it. */
export function resolve(D, params) {
  const live = D.pieces.filter((p) => !isCap(p)), index = new Map(live.map((p, i) => [p.id, i]));
  return live.map((p) => ({
    id: p.id, spec: specOf(p, params),
    cut: p.ends.map((e) => (e.t === 'cuff' || e.t === 'arc' ? e.cut : null)),
    glue: p.ends.map((e, k) => {
      if (e.t !== 'cuff' && e.t !== 'arc') return null;
      const cut = D.cuts[e.cut], tw = params[e.cut].tw || 0;
      if (cut.cap) return { type: 'cap', cap: cut.cap };
      const other = refs(D, e.cut).find((r) => !(r.piece === p && r.end === k));
      if (!other) throw new Error(`resolve: cut ${e.cut} has one end and no cap`);
      if (isCap(other.piece)) return other.piece.kind === 'P' ? { type: 'fold', twist: tw } : other.piece.kind === 'M' ? { type: 'mirror' } : { type: 'half' };
      return { type: 'pair', part: index.get(other.piece.id), end: other.end, twist: tw };
    }),
  }));
}

/** Throws unless D is what a decomposition must be; returns its count of numbers. */
export function checkDecomp(D) {
  for (const id of cutList(D)) {
    const r = refs(D, id), cut = D.cuts[id];
    if (cut.cap ? r.length !== 1 : r.length !== 2) throw new Error(`cut ${id} is named ${r.length} times${cut.cap ? ' and has a cap' : ''}`);
    if (r.some((x) => x.piece.ends[x.end].t !== cut.type)) throw new Error(`cut ${id} is a ${cut.type} and an end calls it otherwise`);
    if (cut.cap && cut.type !== 'cuff') throw new Error(`cut ${id}: only a cuff takes a cap`);
    if (r.length === 2 && isCap(r[0].piece) && isCap(r[1].piece)) throw new Error(`cut ${id} lies between two caps`);
  }
  for (const p of D.pieces) {
    const t = p.ends.map((e) => e.t);
    if (p.kind === 'P' && !(p.ends.length === 3 && t.every((x) => x === 'cuff' || x === 'cone'))) throw new Error(`piece ${p.id}: not a pair of pants`);
    if (p.kind === 'M' && !(p.ends.length === 3 && t.every((x) => x === 'arc' || x === 'corner'))) throw new Error(`piece ${p.id}: not a mirror polygon`);
    if (p.kind === 'S' && !(p.ends.length === 2 && (t[0] === 'cuff' || t[0] === 'cone') && (t[1] === 'arc' || t[1] === 'corner'))) throw new Error(`piece ${p.id}: not a half-pants`);
    if (isCap(p) && p.ends.filter((e) => e.t === 'cuff' || e.t === 'arc').length !== 1) throw new Error(`piece ${p.id}: a cap with no cut`);
  }
  return countParams(D);
}

// ---------------------------------------------------------------------------------------------------------------
// the canonical decomposition

export function defaultDecomp(sig) {
  const D = { pieces: [], cuts: {}, seq: 0 };
  const newCut = (type) => { const id = 'c' + D.seq++; D.cuts[id] = { id, type }; return id; };
  const piece = (kind, ends, extra = {}) => { const p = { id: 'p' + D.seq++, kind, ends, ...extra }; D.pieces.push(p); return p; };
  const cuff = (cut) => ({ t: 'cuff', cut }), arc = (cut) => ({ t: 'arc', cut });

  /** A polygon of mirrors, given by the ends between its consecutive sides, cut into mirror polygons by a fan of arcs. */
  const polygon = (ends, star) => {
    const n = ends.length;
    if (n < 3) throw new Error('defaultDecomp: a mirror polygon needs three sides');
    const diag = [];                                     // diag[i]: the arc between side 0 and side i + 1 (i = 1 .. n - 3)
    for (let i = 1; i <= n - 3; i++) diag[i] = newCut('arc');
    for (let i = 1; i <= n - 2; i++) {
      const a = i === 1 ? ends[0] : arc(diag[i - 1]), b = ends[i], c = i === n - 2 ? ends[n - 1] : arc(diag[i]);
      piece('M', [c, a, b], { star });                    // sides (0, i, i + 1): the ends between (i + 1, 0), (0, i), (i, i + 1)
    }
  };
  /** A mirror with corners, behind the end `main` (a cuff, or a cone point; null: the mirror is the whole orbifold). */
  const crown = (main, port) => {
    const corners = port.corners.map((n, i) => ({ t: 'corner', n, f: `k${port.s}.${i}` }));
    if (!main) return polygon(corners, port.s);
    if (corners.length === 1) return piece('S', [main, corners[0]], { star: port.s });
    const d0 = newCut('arc');
    piece('S', [main, arc(d0)], { star: port.s });
    polygon([...corners, arc(d0)], port.s);
  };
  /** Put what a port is behind the cuff `cut`. */
  const hang = (port, cut) => {
    if (port.type === 'x') { D.cuts[cut].cap = 'x'; D.cuts[cut].f = 'x' + port.i; }
    else if (port.type === 'star' && !port.corners.length) { D.cuts[cut].cap = '*'; D.cuts[cut].f = 's' + port.s; }
    else if (port.type === 'star') crown(cuff(cut), port);
    else if (port.type === 'torus') { const h = newCut('cuff'); D.cuts[h].handle = true; piece('P', [cuff(h), cuff(h), cuff(cut)]); }
  };
  const endOf = (port) => { if (port.type === 'cone') return { t: 'cone', n: port.n, f: port.f }; const c = newCut('cuff'); hang(port, c); return cuff(c); };

  const ports = [];
  sig.stars.forEach((corners, s) => ports.push({ type: 'star', s, corners }));
  for (let i = 0; i < sig.x; i++) ports.push({ type: 'x', i });
  for (let i = 0; i < sig.o; i++) ports.push({ type: 'torus', i });
  sig.cones.map((n, i) => ({ type: 'cone', n, f: 'n' + i })).sort((a, b) => b.n - a.n).forEach((p) => ports.push(p));

  const N = ports.length;
  if (N >= 3) {
    const e = ports.map(endOf);
    if (N === 3) piece('P', [e[0], e[1], e[2]]);
    else {
      const spine = [];
      for (let i = 0; i < N - 3; i++) spine.push(newCut('cuff'));
      piece('P', [e[0], e[1], cuff(spine[0])]);
      for (let i = 1; i < N - 3; i++) piece('P', [cuff(spine[i - 1]), e[i + 1], cuff(spine[i])]);
      piece('P', [cuff(spine[N - 4]), e[N - 2], e[N - 1]]);
    }
  } else if (N === 2) {
    const [u, v] = ports;
    if (u.type !== 'cone' && v.type !== 'cone') { const c = newCut('cuff'); hang(u, c); hang(v, c); }
    else {
      const cone = u.type === 'cone' ? u : v, other = u.type === 'cone' ? v : u, ce = { t: 'cone', n: cone.n, f: cone.f };
      if (other.type === 'star') crown(ce, other);
      else if (other.type === 'torus') { const h = newCut('cuff'); D.cuts[h].handle = true; piece('P', [cuff(h), cuff(h), ce]); }
      else throw new Error('defaultDecomp: nothing to cut');
    }
  } else if (N === 1 && ports[0].type === 'star') crown(null, ports[0]);
  else throw new Error('defaultDecomp: nothing to cut');
  checkDecomp(D);
  return D;
}

/** A decomposition as text for a link, and back. */
export function encode(D) {
  const cuts = cutList(D), ci = new Map(cuts.map((id, i) => [id, i]));
  const end = (e) => (e.t === 'cuff' ? 'u' + ci.get(e.cut) : e.t === 'arc' ? 'a' + ci.get(e.cut) : (e.t === 'cone' ? 'n' : 'k') + e.n);
  const caps = cuts.map((id) => (D.cuts[id].cap === '*' ? 's' : D.cuts[id].cap === 'x' ? 'x' : D.cuts[id].type === 'arc' ? 'a' : 'u')).join('');
  return caps + '-' + D.pieces.map((p) => p.kind + p.ends.map(end).join('.')).join('_');
}
export function decode(text) {
  const m = /^([suax]*)-(.*)$/.exec(String(text || ''));
  if (!m) return null;
  try {
    const D = { pieces: [], cuts: {}, seq: 0 };
    const ids = [...m[1]].map((ch) => { const id = 'c' + D.seq++; D.cuts[id] = { id, type: ch === 'a' ? 'arc' : 'cuff' }; if (ch === 's') D.cuts[id].cap = '*'; if (ch === 'x') D.cuts[id].cap = 'x'; return id; });
    let f = 0;
    for (const tok of m[2].split('_')) {
      const kind = tok[0];
      if (!'PMS'.includes(kind)) return null;
      const ends = tok.slice(1).split('.').map((s) => {
        const t = s[0], v = Number(s.slice(1));
        if (!Number.isInteger(v) || v < 0) throw new Error('bad end');
        if (t === 'u' || t === 'a') { if (!ids[v]) throw new Error('bad cut'); return { t: t === 'u' ? 'cuff' : 'arc', cut: ids[v] }; }
        if (t === 'n' || t === 'k') { if (v < 2 || v > 9) throw new Error('bad order'); return { t: t === 'n' ? 'cone' : 'corner', n: v, f: 'f' + f++ }; }
        throw new Error('bad end');
      });
      D.pieces.push({ id: 'p' + D.seq++, kind, ends });
    }
    checkDecomp(D);
    return D;
  } catch (err) { return null; }
}

/** The signature a decomposition folds up to, read off its pieces: { o, x, cones, stars } (stars: each mirror's corners, unordered here). */
export function signatureOfDecomp(D) {
  const cones = [], cuts = cutList(D);
  let x = 0, smooth = 0, corners = 0, cuffs = 0, arcs = 0;
  for (const id of cuts) { const c = D.cuts[id]; if (c.cap === 'x') x++; if (c.cap === '*') smooth++; if (c.type === 'cuff') cuffs++; else arcs++; }
  for (const p of D.pieces) for (const e of p.ends) { if (e.t === 'cone') cones.push(e.n); if (e.t === 'corner') corners++; }
  return { cones: cones.sort((a, b) => b - a), x, smooth, corners, cuffs, arcs };
}
