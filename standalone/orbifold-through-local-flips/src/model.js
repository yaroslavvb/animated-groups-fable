// model.js — one orbifold as the page holds it: its signature, how it is cut, its numbers of shape, the atlas they
// give and the print on it. No DOM here: the tests drive this file as the page does.
//
//   openOrbifold(text, saved)   -> state | { mode: 'none', ... }
//   withParam(state, cut, key, value)    the same decomposition with one number changed
//   withMove(state, cut, kind)  -> { state, carry, gone, made, info }   a flip: another decomposition, the same pattern
//   cutsOf(state)               what the page lists: every cut with its numbers and the moves it offers
//   linkOf(state) / openOrbifold(text, readLink(hash))
//
// A state is immutable: every change makes a new one, so the page can keep the one before for Undo.

import { classify, parse, textOf, canon, spelled, defaultDecomp, defaultParams, resolve, cutList, hasTwist, encode, decode, refs, isCap, countParams } from './decomp.js';
import { movesOf, applyMove, LIMIT } from './moves.js';
import { flatDecomp, flatDefaults, flatParts, flatMoves, flatMove, flatTwist, FAMILIES } from './flat.js';
import { rigidAtlas } from './rigid.js';
import { buildAtlas } from './atlas.js';
import { design, place, retie } from './print.js';
import { mul, I3, invOf, wrapHalf } from './h2.js';
import { whyNot } from '../../classification-of-surfaces/src/sym/catalog.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
export const GEOMETRY = { S: 'sphere', E: 'plane', H: 'hyperbolic plane' };
/** How far a slider goes. A hyperbolic length: from a short cuff to the longest a move may make. */
export const RANGE = { len: [0.35, 7.5], tw: [-0.5, 0.5] };

function atlasOf(mode, D, params, sig) {
  if (mode === 'rigid') return rigidAtlas(sig);
  if (mode === 'flat') return buildAtlas('E', flatParts(D, params));
  return buildAtlas('H', resolve(D, params));
}
/**
 * The atlas and the print of a state. The print: design() of the atlas, laid afresh whenever a number changes; or,
 * right after a flip (state.tied), the commas of the decomposition before it, left exactly where they were.
 */
function finish(state) {
  state.atlas = atlasOf(state.mode, state.D, state.params, state.sig);
  if (state.mode !== 'rigid') {
    if (!state.tied) state.motifs = design(state.atlas);
    state.shapes = place(state.atlas, state.motifs);
  } else state.shapes = null;
  return state;
}

/** What a typed text is, without building anything: { text (the one spelling), mode } or null for no signature. */
export function spell(text) {
  const sig = parse(text);
  return sig ? { text: spelled(sig), mode: classify(sig).mode } : null;
}

/**
 * The orbifold with this signature (as typed), cut the canonical way, or as `saved` says: { d, p, v } from a link.
 * Returns { mode: 'none', text, why } for text that is no signature or a signature no pattern has.
 */
export function openOrbifold(text, saved = null) {
  const sig = parse(text);
  if (!sig) return { mode: 'none', text: String(text || ''), why: { kind: 'text' } };
  const cls = classify(sig), shown = spelled(sig);
  if (cls.mode === 'none') return { mode: 'none', text: shown, sig, why: whyNot(sig) || { kind: 'none' } };
  const state = { mode: cls.mode, text: shown, sig, cls, D: null, params: {}, motifs: null, tied: false };
  if (cls.mode === 'flat') {
    state.D = flatDecomp(cls.text, saved && saved.v);
    state.params = flatDefaults(state.D);
    if (saved && saved.p && saved.p.length === 1 && saved.v === state.D.view) {
      const [len, tw] = saved.p[0], r = flatRange(state.D);
      if (len >= r[0] * 0.5 && len <= r[1] * 2) state.params.c0.len = len;
      if (state.params.c0.tw !== undefined && Number.isFinite(tw)) state.params.c0.tw = wrapHalf(tw);
    }
  } else if (cls.mode === 'pieces') {
    let D = saved && saved.d ? decode(saved.d) : null;
    if (D && !(countParams(D) === cls.dim && sameFeatures(D, sig))) D = null;        // a link for another orbifold
    state.D = D || defaultDecomp(sig);
    state.params = defaultParams(state.D);
    const ids = cutList(state.D);
    if (D && saved.p && saved.p.length === ids.length) {
      ids.forEach((id, i) => {
        const [len, tw] = saved.p[i];
        if (len > 0.05 && len < LIMIT[state.D.cuts[id].type] * 1.2) state.params[id].len = len;
        if (state.params[id].tw !== undefined && Number.isFinite(tw)) state.params[id].tw = wrapHalf(tw);
      });
    }
  }
  try { return finish(state); } catch (err) {
    // numbers from a link that the pieces cannot be built from: the canonical ones
    if (cls.mode === 'pieces') { state.D = defaultDecomp(sig); state.params = defaultParams(state.D); return finish(state); }
    throw err;
  }
}
/** Does a decomposition have the signature's cone points, crosscaps, mirrors and corners? */
function sameFeatures(D, sig) {
  const cones = [], corners = [];
  let x = 0, smooth = 0;
  for (const p of D.pieces) for (const e of p.ends) { if (e.t === 'cone') cones.push(e.n); if (e.t === 'corner') corners.push(e.n); }
  for (const id of cutList(D)) { if (D.cuts[id].cap === 'x') x++; if (D.cuts[id].cap === '*') smooth++; }
  const srt = (a) => a.slice().sort((p, q) => p - q).join(',');
  return srt(cones) === srt(sig.cones) && srt(corners) === srt(sig.stars.flat()) && x === sig.x && smooth <= sig.stars.length;
}
const flatRange = (D) => { const F = FAMILIES[D.family], both = F.views.length === 2 ? [F.len, flatDefaults({ ...D, view: F.views[1] }).c0.len] : [F.len]; return [0.3 * Math.min(...both), 3.2 * Math.max(...both)]; };

/** The slider's range for a number of a cut. */
export function rangeOf(state, cutId, key) {
  if (key === 'tw') return RANGE.tw;
  if (state.mode === 'flat') return flatRange(state.D);
  return [RANGE.len[0], Math.max(RANGE.len[1], state.params[cutId].len)];
}

/**
 * The same decomposition with one number changed (clamped to what can be drawn). After a flip the first such change
 * inks the print afresh for the new pieces: the result then says `reinked`, for the page to cross-fade the two.
 */
export function withParam(state, cutId, key, value) {
  const next = { ...state, params: clone(state.params), reinked: !!state.tied, tied: false };
  const p = next.params[cutId];
  if (!p) return state;
  if (key === 'len') { const r = rangeOf(state, cutId, 'len'); p.len = Math.max(r[0], Math.min(r[1], value)); }
  else if (key === 'tw' && p.tw !== undefined) p.tw = Math.max(-0.5, Math.min(0.5, value));
  return finish(next);
}
/** The canonical decomposition and numbers again. */
export const reopened = (state) => openOrbifold(state.text);

/** What the page lists: every cut, in order, with its numbers and what it is. */
export function cutsOf(state) {
  if (state.mode === 'rigid' || state.mode === 'none') return [];
  if (state.mode === 'flat') {
    const D = state.D, cut = D.cuts.c0, p = state.params.c0;
    return [{ id: 'c0', type: cut.type, len: p.len, tw: p.tw, twist: p.tw !== undefined, moves: flatMoves(D), what: flatWhat(D), half: false }];
  }
  const D = state.D;
  return cutList(D).map((id) => {
    const cut = D.cuts[id], p = state.params[id], r = refs(D, id);
    let what = cut.type === 'arc' ? 'arc from mirror to mirror' : 'cuff';
    if (cut.cap === 'x') what = 'crosscap';
    else if (cut.cap === '*') what = 'mirror';
    else if (r.length === 2 && r[0].piece === r[1].piece) what = 'handle loop';
    else if (r.some((x) => isCap(x.piece))) { const c = r.find((x) => isCap(x.piece)).piece; what = c.kind === 'P' ? 'cuff folded onto 2 2' : c.kind === 'M' ? 'arc along the mirror between two corners 2' : 'arc folded about a 2'; }
    return { id, type: cut.type, cap: cut.cap || null, len: p.len, tw: p.tw, twist: hasTwist(D, id), moves: movesOf(D, id), what, half: cut.cap === 'x' };
  });
}
function flatWhat(D) {
  if (D.view === 'arc') return D.family === '*2222' ? 'arc between two opposite mirrors' : 'arc from mirror to mirror';
  return { 2222: 'cuff between two pairs of 2s', o: 'handle loop', '**': 'cuff along the mirrors', '*x': 'cuff along the mirror', '22*': 'cuff along the mirror', '22x': 'cuff round the crosscap', xx: 'cuff between the crosscaps' }[D.family] || 'cuff';
}

/**
 * A flip. Returns { state, carry, gone, made, info }: carry(oldAtomId) -> { atom, M } says where an atom of the old
 * atlas lies in the new one (the old atom's chart is carried into the new atom's by M), which is all the pane and the
 * print need to leave everything where it was. Throws (err.refused) when the move would make a cut too long to draw.
 */
export function withMove(state, cutId, kind) {
  const old = state.atlas, inv = invOf(old.kind);
  let next, carry, info;
  if (state.mode === 'flat') {
    const res = flatMove(state.D, state.params, kind), r = flatRange(res.D), len = res.params.c0.len;
    if (!(len >= r[0] && len <= r[1])) { const err = new Error(`the new ${res.D.view} would be ${len.toFixed(1)} long`); err.refused = true; err.len = len; err.cut = res.D.view; err.limit = len > r[1] ? r[1] : r[0]; err.short = len < r[0]; throw err; }
    next = { ...state, D: res.D, params: res.params };
    const atlas = atlasOf('flat', res.D, res.params), Qi = inv(res.chart);
    carry = (a) => ({ atom: 0, M: mul(mul(atlas.atoms[0].C, Qi), old.atoms[a].Ci) });
    next.atlas0 = atlas; info = res.info;
  } else if (state.mode === 'pieces') {
    const res = applyMove(state.D, state.params, cutId, kind);
    next = { ...state, D: res.D, params: res.params };
    const atlas = atlasOf('pieces', res.D, res.params), nid = Object.keys(res.charts)[0];
    if (!nid) throw new Error('move: nothing was made');
    const pn = atlas.parts.find((p) => p.id === nid), Qi = invOf('H')(res.charts[nid]);
    carry = (a) => {
      const atom = old.atoms[a], part = old.parts[atom.part], T = res.olds[part.id];
      if (T) { const b = atlas.atoms[pn.atoms[0]]; return { atom: b.id, M: mul(mul(mul(b.C, Qi), T), atom.Ci) }; }
      const same = atlas.parts.find((p) => p.id === part.id);
      return same ? { atom: same.atoms[atom.local], M: I3.slice() } : null;
    };
    next.atlas0 = atlas; info = res.info;
  } else throw new Error('move: this orbifold has no cuts');
  // the print, tied afresh, not moved
  const atlas = next.atlas0;
  delete next.atlas0;
  next.motifs = retie(old, state.motifs, atlas, carry);
  next.tied = true; next.reinked = false;
  next.atlas = atlas; next.shapes = place(atlas, next.motifs);
  const before = new Set(Object.keys(state.params)), after = new Set(Object.keys(next.params)), made = info.cuts || [];
  const gone = [...new Set([...made.filter((id) => before.has(id)), ...[...before].filter((id) => !after.has(id))])];
  return { state: next, carry, back: carryBack(old, atlas, carry), gone, made, info };
}
/**
 * The way back from a flip (for Undo): where an atom of the NEW atlas lies in the old one, { atom, M } as carry says
 * it the other way. One old atom's place in the new atlas is known from carry; any new atom is reached from there
 * through its neighbours, and every tile of one kind is as good as another.
 */
function carryBack(old, atlas, carry) {
  let a0 = -1, c0 = null;
  for (let a = 0; a < old.atoms.length && !c0; a++) { const c = carry(a); if (c) { a0 = a; c0 = c; } }
  const inv = invOf(atlas.kind);
  return (h) => {
    if (!c0 || !atlas.atoms[h]) return null;
    const seen = new Map([[h, I3.slice()]]), queue = [h];
    while (queue.length && !seen.has(c0.atom)) {
      const x = queue.shift(), Tx = seen.get(x);
      for (const side of atlas.atoms[x].sides) for (const nb of side.nbrs || []) if (!seen.has(nb.atom)) { seen.set(nb.atom, mul(Tx, nb.T)); queue.push(nb.atom); }
    }
    const T = seen.get(c0.atom);
    return T ? { atom: a0, M: inv(mul(T, c0.M)) } : null;
  };
}

// ---- links
/** A twist as an address writes it: four places, and the half turn one way only (-0.5 and 0.5 are one twist). */
const twOf = (tw) => { const t = +tw.toFixed(4); return t === -0.5 ? 0.5 : t === 0 ? 0 : t; };
/** The state as the part of an address after #. */
export function linkOf(state) {
  const parts = ['k=' + encodeURIComponent(state.text).replace(/%2A/g, '*')];
  if (state.mode === 'pieces') {
    parts.push('d=' + encode(state.D));
    parts.push('p=' + cutList(state.D).map((id) => { const p = state.params[id]; return +p.len.toFixed(4) + (p.tw !== undefined ? '_' + twOf(p.tw) : ''); }).join(','));
  } else if (state.mode === 'flat') {
    const p = state.params.c0;
    parts.push('v=' + state.D.view, 'p=' + +p.len.toFixed(4) + (p.tw !== undefined ? '_' + twOf(p.tw) : ''));
  }
  return parts.join('&');
}
/** { k, saved: { d, p, v } } from an address's #..., or null. */
export function readLink(hash) {
  const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  if (!q.has('k')) return null;
  const p = q.get('p') ? q.get('p').split(',').map((s) => { const [a, b] = s.split('_'); return [Number(a), b === undefined ? NaN : Number(b)]; }) : null;
  return { k: q.get('k'), saved: { d: q.get('d'), p: p && p.every((x) => Number.isFinite(x[0])) ? p : null, v: q.get('v') } };
}
export { flatTwist, LIMIT, textOf, canon };
