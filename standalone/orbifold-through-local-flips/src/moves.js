// moves.js — the click-to-flip moves: each replaces a cut (or two) of a decomposition by another and reads the new
// numbers off the pattern AS IT STANDS. The group of the pattern is not touched: a move is a change of coordinates.
//
//   A      an edge flip. A cuff between two pairs of pants has four neighbours A, B | C, D; the flip pairs them the
//          next way round: (A B | C D) -> (A C | B D) -> (A D | B C). Of the curves that pair them so and cross the
//          old cuff twice (they differ by twists about it) the SHORTEST is taken.
//   F      the same for an arc between two mirror polygons: the new arc is the common perpendicular of the other two
//          mirrors (there is only one).
//   S      a handle swap. A cuff both of whose sides lie on one pair of pants is the meridian of a one-holed torus;
//          it is replaced by the shortest loop that crosses it once.
//   pop    a cuff with a mirror behind it (the cuff IS the mirror, or it bounds a crown or a half-pants) and a pair
//          of pants (cuff, a, b) in front: the cuff is opened into arcs from the mirror round a and round b.
//   merge  the way back: two such arcs close into the cuff round a and b.
//   slide  an arc that runs from a mirror round a cone point (or a cuff) and back, next to a mirror polygon: the
//          arc moves to the polygon's third mirror.
//
// How a move is computed. The pieces it touches are laid down in ONE frame, the frame of the cut (its reference
// foot at the origin, the cut along the x axis), their ends as things of that frame: a cone point with its turn, a
// cuff with its slide, a mirror as a line. The new cut is a product of those motions (taken as pairs (c, w), h2.js);
// its length is read off c, its line off w, and its seams are common perpendiculars. A cuff that stays keeps its
// line: only the foot of the seam on it moves, and its twist changes by that step. Nothing is solved for.
//
// Every move returns { D, params, charts, olds, info }:
//   charts[newPieceId]   the motion carrying the new piece's chart into the frame of the move
//   olds[oldPieceId]     the same for the pieces that went
// so that the page can leave the pattern, and everything printed on it, exactly where it was.

import { H, mul, apply, I3, tx, ROT_PI, invH, posOf, leftOf, mulAll, perp, meet, frameToward, coordOn, slideBetween, shiftBetween, matDiff, wrapHalf, lineGap, mdot, isPt, lineThrough,
  qMul, qInv, qSlide, qTurn, qMulAll, qConj, qPow, qAct, qMat, qLen, qAxis, qOff, qOfMat } from './h2.js';
import { buildPiece, degenerate } from './pieces.js';
import { refs, specOf, isCap, hasTwist, checkDecomp } from './decomp.js';

const TAU = 2 * Math.PI, EY = [0, 1, 0], EX = [1, 0, 0];
const clone = (x) => JSON.parse(JSON.stringify(x));
const onAxis = (x) => posOf(tx('H', x));
const need = (ok, msg) => { if (!ok) throw new Error('move: ' + msg); };
/**
 * How long a move may make a cut. A cuff of length l is a side l / 2 of its pants' hexagons and an arc of length l a
 * side l of its polygon; a piece with a side much beyond 5 is a sliver whose corners are known to few digits (their
 * coordinates grow like e^side), and on the screen it is a hair. A move that would make one is turned down, with the
 * length it would have had: err.refused is set, and the page says so.
 */
export const LIMIT = { cuff: 9.5, arc: 6 };
function fits(len, type) {
  if (len <= LIMIT[type] && Number.isFinite(len)) return;
  const err = new Error(`the new ${type} would be ${Number.isFinite(len) ? len.toFixed(1) : 'endlessly'} long`);
  err.refused = true; err.len = len; err.cut = type; err.limit = LIMIT[type];
  throw err;
}
const FIT = 1e-4;        // a fit is one of two or three ways round; the wrong ones are off by the size of the piece
const sameLine = (a, b) => Math.min(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(a[0] + b[0], a[1] + b[1], a[2] + b[2])) < 1e-6 * (1 + Math.abs(a[2]) + Math.abs(b[2]));

/** End k of a piece (its model laid down by T) as a thing of the frame. */
function endObj(model, T, k, desc) {
  const e = model.ends[k];
  if (e.t === 'cone' || e.t === 'corner') { const pt = apply(T, e.pt); return { kind: e.t, pt, n: e.n, q: qTurn(pt, TAU / e.n), desc }; }
  const frame = mul(T, e.frame);
  if (e.t === 'arc') return { kind: 'arc', frame, len: e.len, desc };
  return { kind: 'cuff', frame, len: e.len, q: qSlide(leftOf(frame), -e.len), desc };
}
const coneObj = (pt, n, desc) => ({ kind: 'cone', pt, n, q: qTurn(pt, TAU / n), desc });
/** The thing carried by the motion K (given both ways: K3 a matrix, Kq a pair). */
const carry = (o, K3, Kq) => (o.kind === 'cone' ? { ...o, pt: apply(K3, o.pt), q: qConj(o.q, Kq) } : { ...o, frame: mul(K3, o.frame), q: qConj(o.q, Kq) });
const cuffObj = (q, desc) => ({ kind: 'cuff', q, len: qLen(q), axis: qAxis(q), desc });
const vecOf = (o) => (o.kind === 'cone' || o.kind === 'corner' ? o.pt : o.axis || leftOf(o.frame));
const descOf = (o) => clone(o.desc);
/** An end's descriptor with the length its cut has now: a fit builds its piece with that very number, as the page will. */
const sized = (desc, params) => (desc.t === 'arc' || desc.t === 'cuff' ? { ...clone(desc), len: params[desc.cut].len } : clone(desc));
const specEnd = (o) => (o.kind === 'cone' ? { t: 'cone', n: o.n } : { t: 'cuff', len: o.len });

/**
 * A pair of pants from its three ends as things of the frame, in the order they go round it (their motions multiply
 * to 1). Returns { cap: true } for two half-turn points and a cuff, else { model, Q, frames }: Q carries the model's
 * chart onto the things, frames[k] is where end k's reference frame now lies. Throws if the things are no pants.
 */
function fitPants(objs) {
  const spec = { kind: 'P', ends: objs.map(specEnd) };
  if (degenerate(spec)) return { cap: true, spec };
  const u = objs.map(vecOf), w = [0, 1, 2].map((k) => perp(u[k], u[(k + 1) % 3]));
  const frames = objs.map((o, k) => (o.kind === 'cone' ? null : frameToward('H', meet(u[k], w[(k + 2) % 3]), meet(u[k], w[k]))));
  const model = buildPiece(spec), k0 = frames.findIndex((f) => f);
  const Q = mul(frames[k0], invH(model.ends[k0].frame));
  objs.forEach((o, k) => {
    if (o.kind === 'cone') need(H.dist(apply(Q, model.ends[k].pt), o.pt) < FIT, 'a cone point of the new pants is not where the pattern has it');
    else need(matDiff(mul(Q, model.ends[k].frame), frames[k]) < FIT, 'a cuff of the new pants is not where the pattern has it');
  });
  return { spec, model, Q, frames };
}

/**
 * A mirror polygon from its three mirrors as lines of the frame, in the order they go round it; ends[k] = the end
 * between line k and line k + 1 (a descriptor: a corner with its order, or an arc). Returns null if the lines do not
 * go round that way, { cap: true, lens } for a cap, else { model, Q, frames, lens } (lens[k]: the length of arc k).
 */
function fitMirrorOnce(lines, ends) {
  const hexEnds = [], lens = [], frames = [], pts = [];
  for (let k = 0; k < 3; k++) {                 // the piece's end k lies between line k - 1 and line k
    const a = lines[(k + 2) % 3], b = lines[k], d = ends[(k + 2) % 3], v = perp(a, b);
    if (d.t === 'corner') { if (!isPt(v)) return null; hexEnds.push({ t: 'corner', n: d.n }); pts[k] = v; lens[k] = null; frames[k] = null; continue; }
    if (isPt(v)) return null;
    const vin = meet(v, a), vout = meet(v, b);
    lens[k] = d.len != null ? d.len : lineGap(a, b); hexEnds.push({ t: 'arc', len: lens[k] }); frames[k] = frameToward('H', vin, vout);
  }
  const strip = (e) => { const c = { ...e }; delete c.len; return c; };
  const spec = { kind: 'M', ends: hexEnds }, descs = [ends[2], ends[0], ends[1]].map(strip);
  if (degenerate(spec)) return { cap: true, spec, lens, descs };
  let model;
  try { model = buildPiece(spec); } catch (err) { return null; }
  const k0 = frames.findIndex((f) => f), Q = mul(frames[k0], invH(model.ends[k0].frame));
  for (let k = 0; k < 3; k++) {
    if (frames[k]) { if (matDiff(mul(Q, model.ends[k].frame), frames[k]) > FIT) return null; }
    else if (H.dist(apply(Q, model.ends[k].pt), pts[k]) > FIT) return null;
  }
  return { spec, model, Q, frames, lens, descs };
}
/** The same, whichever way round the three lines go. */
function fitMirror(lines, ends) {
  const got = fitMirrorOnce(lines, ends) || fitMirrorOnce([lines[0], lines[2], lines[1]], [ends[2], ends[1], ends[0]]);
  need(got, 'three mirrors do not bound a polygon');
  return got;
}

/**
 * A half-pants from its main end X (a cuff or a cone point, a thing of the frame), the two mirror lines its arc runs
 * between (or that cross at its corner) and the descriptor of that arc or corner. Returns { cap: true, len } or
 * { model, Q, frames: [cuff frame | null, arc frame | null], len }.
 */
function fitHalfOnce(X, mu, nu, other) {
  const v = perp(mu, nu), isArc = other.t === 'arc';
  if (isArc === isPt(v)) return null;
  const len = isArc ? (other.len != null ? other.len : lineGap(mu, nu)) : null;
  const spec = { kind: 'S', ends: [specEnd(X), isArc ? { t: 'arc', len } : { t: 'corner', n: other.n }] };
  if (degenerate(spec)) return { cap: true, spec, len };
  const xv = vecOf(X), isCuff = X.kind === 'cuff';
  const w0 = perp(xv, mu), mid = meet(w0, mu), w2 = perp(v, xv);
  const cuffFrame = isCuff ? frameToward('H', meet(xv, w2), meet(xv, w0)) : null;
  const N = isArc ? meet(v, mu) : v, arcFrame = isArc ? frameToward('H', N, meet(v, w2)) : null;
  let model;
  try { model = buildPiece(spec); } catch (err) { return null; }
  const Q = isCuff ? mul(cuffFrame, invH(model.ends[0].frame)) : isArc ? mul(arcFrame, invH(model.ends[1].frame)) : mul(frameToward('H', X.pt, mid), invH(frameToward('H', model.ends[0].pt, model.mid)));
  if (isCuff && matDiff(mul(Q, model.ends[0].frame), cuffFrame) > FIT) return null;
  if (!isCuff && H.dist(apply(Q, model.ends[0].pt), X.pt) > FIT) return null;
  if (isArc && matDiff(mul(Q, model.ends[1].frame), arcFrame) > FIT) return null;
  if (!isArc && H.dist(apply(Q, model.ends[1].pt), v) > FIT) return null;
  if (H.dist(apply(Q, model.mid), mid) > FIT) return null;
  return { spec, model, Q, frames: [cuffFrame, arcFrame], len };
}
function fitHalf(X, m1, m2, other) {
  const got = fitHalfOnce(X, m1, m2, other) || fitHalfOnce(X, m2, m1, other);
  need(got, 'a mirror and an end do not bound a half-pants');
  return got;
}

/** A cuff that stays: its twist changes by the step its reference foot took (from the frame o.frame to `now`). */
function retwist(D, params, o, now) {
  if (o.kind !== 'cuff' || !now || !hasTwist(D, o.desc.cut)) return;
  const d = shiftBetween('H', o.frame, now);
  need(d !== null, 'a cuff that stays has left its line');
  params[o.desc.cut].tw = wrapHalf(params[o.desc.cut].tw - d / o.len);
}
const keyOf = (o, seen) => { const base = o.kind === 'cone' ? 'f:' + o.desc.f : 'c:' + o.desc.cut; const n = (seen.get(base) || 0) + 1; seen.set(base, n); return base + '#' + n; };
const replacePieces = (D, gone, fresh) => {
  const at = Math.min(...gone.map((p) => D.pieces.findIndex((q) => q.id === p.id)));
  D.pieces = D.pieces.filter((q) => !gone.some((p) => p.id === q.id));
  D.pieces.splice(Math.min(at, D.pieces.length), 0, ...fresh);
};
const fresh = (D, kind, ends, extra = {}) => ({ id: 'p' + D.seq++, kind, ends, ...extra });
/** The shortest of a family f(n), n a whole number, that has one minimum: walk down from 0. */
function shortest(f, span = 12) {
  let n = 0, best = f(0);
  for (const dir of [1, -1]) for (let m = dir; Math.abs(m) <= span; m += dir) { const l = f(m); if (l < best - 1e-9) { best = l; n = m; } else break; }
  return n;
}

// ---------------------------------------------------------------------------------------------------------------
// which moves a cut offers

/** The plan of a merge of the arc `cutId`, or null: { S1, M, i, S2, d2 } (two arcs of a polygon) or { S1, S2 } (one arc between two half-pants). */
function mergePlan(D, cutId) {
  const r = refs(D, cutId);
  if (r.length !== 2 || D.cuts[cutId].type !== 'arc') return null;
  const half = (x) => x.piece.kind === 'S' && x.end === 1;
  if (half(r[0]) && half(r[1]) && r[0].piece !== r[1].piece && !(isCap(r[0].piece) && isCap(r[1].piece))) return isCap(r[0].piece) ? { S1: r[1].piece, S2: r[0].piece } : { S1: r[0].piece, S2: r[1].piece };
  const s = r.find(half), m = r.find((x) => x.piece.kind === 'M' && !isCap(x.piece));
  if (!s || !m) return null;
  const e2 = m.piece.ends[(m.end + 1) % 3];
  if (e2.t !== 'arc' || e2.cut === cutId) return null;
  const s2 = refs(D, e2.cut).find((x) => x.piece !== m.piece);
  if (!s2 || !half(s2) || s2.piece === s.piece) return null;
  return { S1: s.piece, M: m.piece, i: m.end, S2: s2.piece, d2: e2.cut };
}

/** Which moves a cut offers, the first being what a click does: [{ kind, label }]. */
export function movesOf(D, cutId) {
  const cut = D.cuts[cutId], out = [];
  if (!cut) return out;
  const r = refs(D, cutId);
  if (cut.type === 'cuff') {
    if (r.length === 2 && r[0].piece === r[1].piece) { if (r[0].piece.kind === 'P') out.push({ kind: 'S', label: 'swap the handle loop' }); return out; }
    if (r.length === 2 && r.every((x) => x.piece.kind === 'P')) out.push({ kind: 'A', label: 're-pair its four neighbours' });
    const pants = r.find((x) => x.piece.kind === 'P' && !isCap(x.piece)), behind = r.find((x) => x.piece.kind === 'S');
    if (pants && r.length === 1 && cut.cap === '*') out.push({ kind: 'pop', label: 'open into an arc' });
    if (pants && behind && behind.end === 0) out.push({ kind: 'pop', label: 'open into arcs' });
    return out;
  }
  if (r.length !== 2) return out;
  if (mergePlan(D, cutId)) out.push({ kind: 'merge', label: 'close into a cuff' });
  const kinds = r.map((x) => x.piece.kind), caps = r.map((x) => isCap(x.piece));
  if (kinds[0] === 'M' && kinds[1] === 'M' && r[0].piece !== r[1].piece && !(caps[0] && caps[1])) out.push({ kind: 'F', label: 'flip to the other diagonal' });
  if (kinds.includes('S') && kinds.includes('M') && !(caps[0] && caps[1]) && r.find((x) => x.piece.kind === 'S').end === 1) out.push({ kind: 'slide', label: 'move to the other mirror' });
  return out;
}

export function applyMove(D, params, cutId, kind, opts = {}) {
  const list = movesOf(D, cutId), k = kind || (list[0] && list[0].kind);
  need(list.some((m) => m.kind === k), `cut ${cutId} offers no such move`);
  const res = k === 'A' ? aMove(D, params, cutId, opts) : k === 'S' ? sMove(D, params, cutId, opts) : k === 'pop' ? popMove(D, params, cutId, opts)
    : k === 'merge' ? mergeMove(D, params, cutId, opts) : k === 'F' ? arcFlip(D, params, cutId, opts) : slideMove(D, params, cutId, opts);
  checkDecomp(res.D);
  for (const id of Object.keys(res.D.cuts)) need(res.params[id] && res.params[id].len > 0 && Number.isFinite(res.params[id].len), 'a cut was left without a length');
  for (const id of Object.keys(res.params)) if (!res.D.cuts[id]) delete res.params[id];
  return res;
}

// ---------------------------------------------------------------------------------------------------------------
// A: the edge flip of a cuff between two pairs of pants

function aMove(D0, params0, cutId, opts) {
  const D = clone(D0), params = clone(params0), r = refs(D, cutId);
  const [rb, ro] = isCap(r[0].piece) ? [r[1], r[0]] : [r[0], r[1]];
  const Pi = rb.piece, a = rb.end, Pj = ro.piece, b = ro.end;
  const mi = buildPiece(specOf(Pi, params)), Ti = invH(mi.ends[a].frame), L = params[cutId].len, tw = params[cutId].tw || 0;
  const A = endObj(mi, Ti, (a + 1) % 3, Pi.ends[(a + 1) % 3]), B = endObj(mi, Ti, (a + 2) % 3, Pi.ends[(a + 2) % 3]);
  let C, Dd, Tj = null;
  if (!isCap(Pj)) {
    const mj = buildPiece(specOf(Pj, params));
    Tj = mulAll(tx('H', tw * L), ROT_PI, invH(mj.ends[b].frame));
    C = endObj(mj, Tj, (b + 1) % 3, Pj.ends[(b + 1) % 3]); Dd = endObj(mj, Tj, (b + 2) % 3, Pj.ends[(b + 2) % 3]);
  } else {
    C = coneObj(onAxis(tw * L), 2, Pj.ends[(b + 1) % 3]); Dd = coneObj(onAxis(tw * L + L / 2), 2, Pj.ends[(b + 2) % 3]);
  }
  const gc = qSlide(EY, -L);
  need(qOff(qMulAll(A.q, B.q, C.q, Dd.q)) < 1e-6, 'the four neighbours do not close up');
  // which pairing next: with the four named in a fixed order, the partner of the first goes round its three choices
  const seen = new Map(), keys = [A, B, C, Dd].map((o) => keyOf(o, seen)), sorted = keys.slice().sort();
  const idx = (partnerOfA) => { const pairs = { [keys[0]]: partnerOfA, [partnerOfA]: keys[0] }, rest = keys.filter((x) => x !== keys[0] && x !== partnerOfA); pairs[rest[0]] = rest[1]; pairs[rest[1]] = rest[0]; return sorted.indexOf(pairs[sorted[0]]) - 1; };
  const cur = idx(keys[1]);
  const asked = opts.pairing === 'X' || opts.pairing === 'Y';
  const next = asked ? opts.pairing : idx(keys[3]) === (cur + 1) % 3 ? 'X' : 'Y';   // X pairs B with C (and D with A), Y pairs A with C
  // of the curves that pair them so, the shortest: they differ by whole twists about the old cuff
  const best = (t) => {
    const mv = t === 'X' ? B : A, f = (m) => qLen(qMul(qConj(mv.q, qPow(gc, m)), C.q)), m = Number.isInteger(opts.n) ? opts.n : shortest(f);
    return { type: t, n: m, len: f(m) };
  };
  // the next pairing round; if its curve is too long to draw and the one after is not, the one after (a click then
  // goes between the two pairings that fit, and never stops at a refusal while there is somewhere to go)
  let pick = best(next), skipped = null;
  if (!asked && !Number.isInteger(opts.n) && pick.len > LIMIT.cuff) { const other = best(next === 'X' ? 'Y' : 'X'); if (other.len <= LIMIT.cuff) { skipped = pick.len; pick = other; } }
  const type = pick.type, n = pick.n;
  const K3 = tx('H', -n * L), Kq = qPow(gc, n), An = carry(A, K3, Kq), Bn = carry(B, K3, Kq);
  let x, first, second;
  if (type === 'X') { x = qMul(Bn.q, C.q); first = [cuffObj(qInv(x)), Bn, C]; second = [cuffObj(x), Dd, An]; }
  else { x = qMul(An.q, C.q); first = [cuffObj(qInv(x)), An, C]; second = [cuffObj(x), Dd, carry(Bn, qMat(An.q), An.q)]; }
  fits(first[0].len, 'cuff');
  const f1 = fitPants(first), f2 = fitPants(second), Lx = first[0].len;
  need(!(f1.cap && f2.cap), 'both sides of the new cuff would be caps');
  let twx;
  if (!f1.cap && !f2.cap) { const d = slideBetween('H', f1.frames[0], f2.frames[0]); need(d !== null, 'the two sides of the new cuff do not meet along it'); twx = d / Lx; }
  else { const live = f1.cap ? f2 : f1, cap = f1.cap ? first : second; twx = coordOn('H', live.frames[0], cap[1].pt) / Lx; }
  params[cutId] = { len: Lx, tw: wrapHalf(twx) };
  for (const [objs, fit] of [[first, f1], [second, f2]]) if (!fit.cap) objs.forEach((o, k) => { if (k > 0) retwist(D, params, o, fit.frames[k]); });
  const mk = (objs) => fresh(D, 'P', [{ t: 'cuff', cut: cutId }, descOf(objs[1]), descOf(objs[2])]);
  const p1 = mk(first), p2 = mk(second), ia = D.pieces.findIndex((p) => p.id === Pi.id), ib = D.pieces.findIndex((p) => p.id === Pj.id);
  D.pieces[ia] = p1; D.pieces[ib] = p2;
  const charts = {}, olds = { [Pi.id]: Ti };
  if (Tj) olds[Pj.id] = Tj;
  if (!f1.cap) charts[p1.id] = f1.Q;
  if (!f2.cap) charts[p2.id] = f2.Q;
  return { D, params, charts, olds, info: { kind: 'A', pairing: type, n, len: Lx, cuts: [cutId], skipped } };
}

// ---------------------------------------------------------------------------------------------------------------
// S: the handle swap

function sMove(D0, params0, cutId, opts) {
  const D = clone(D0), params = clone(params0), r = refs(D, cutId), P = r[0].piece;
  let a = r[0].end, b = r[1].end;
  if ((a + 1) % 3 !== b) [a, b] = [b, a];
  const e = 3 - a - b, m = buildPiece(specOf(P, params)), L = params[cutId].len, tw = params[cutId].tw || 0;
  const Ti = invH(m.ends[a].frame), Fb = mul(Ti, m.ends[b].frame), E = endObj(m, Ti, e, P.ends[e]);
  const Tn = mulAll(tx('H', tw * L), ROT_PI, invH(Fb));                  // the pants' copy across side a
  const g1 = qSlide(EY, -L), g2 = qSlide(leftOf(Fb), -L);
  let h = qOfMat(invH(Tn));
  need(qOff(qMul(g2, qInv(qConj(qInv(g1), h)))) < 1e-6, 'the handle does not close up');
  need(qOff(qMulAll(g1, g2, E.q)) < 1e-6, 'the pants do not close up');
  // the loops that cross the cuff once differ by whole twists about it: the shortest
  const n = Number.isInteger(opts.n) ? opts.n : shortest((q) => qLen(qMul(h, qPow(g1, q))));
  h = qMul(h, qPow(g1, n));
  const t = qMul(h, g1), k1 = qInv(h), k2 = qConj(h, t), objs = [cuffObj(k1), cuffObj(k2), E];
  objs[1].len = objs[0].len;                      // the two sides of one cut: one number, to the last digit
  fits(objs[0].len, 'cuff');
  const fit = fitPants(objs), Lx = objs[0].len;
  need(!fit.cap, 'a handle cannot be a cap');
  const d = slideBetween('H', fit.frames[0], mul(qMat(qInv(t)), fit.frames[1]));
  need(d !== null, 'the two sides of the new loop do not meet along it');
  params[cutId] = { len: Lx, tw: wrapHalf(d / Lx) };
  retwist(D, params, E, fit.frames[2]);
  const p = fresh(D, 'P', [{ t: 'cuff', cut: cutId }, { t: 'cuff', cut: cutId }, descOf(E)]);
  D.pieces[D.pieces.findIndex((q) => q.id === P.id)] = p;
  return { D, params, charts: { [p.id]: fit.Q }, olds: { [P.id]: Ti }, info: { kind: 'S', n, len: Lx, cuts: [cutId] } };
}

// ---------------------------------------------------------------------------------------------------------------
// pop: a cuff with a mirror behind it opens into arcs

function popMove(D0, params0, cutId) {
  const D = clone(D0), params = clone(params0), r = refs(D, cutId), cut = D.cuts[cutId];
  const rp = r.find((x) => x.piece.kind === 'P' && !isCap(x.piece)), rs = r.find((x) => x.piece.kind === 'S');
  const P = rp.piece, a = rp.end, L = params[cutId].len, tw = params[cutId].tw || 0;
  const mp = buildPiece(specOf(P, params)), Tp = invH(mp.ends[a].frame);
  const A = endObj(mp, Tp, (a + 1) % 3, P.ends[(a + 1) % 3]), B = endObj(mp, Tp, (a + 2) % 3, P.ends[(a + 2) % 3]);
  const gc = qSlide(EY, -L), gone = [P], made = [], charts = {}, olds = { [P.id]: Tp };
  // the mirror's lines beyond the cuff, one after the other along it: e(k)
  let e0 = EY, Ts = null, S = null, f = null;
  if (rs) {
    S = rs.piece; f = S.ends[1];
    const ms = buildPiece(specOf(S, params));
    Ts = mulAll(tx('H', tw * L), ROT_PI, invH(ms.ends[0].frame));
    e0 = lineThrough(apply(Ts, ms.mid), apply(Ts, ms.N));
    gone.push(S); olds[S.id] = Ts;
  } else need(cut.cap === '*', 'nothing to open');
  const eAt = (k) => (rs ? qAct(qPow(gc, k), e0) : EY), back = qInv(A.q);
  const gaps = (k) => { const ma = eAt(k), mb = qAct(back, ma), mc = eAt(k + 1); return [Math.abs(mdot(ma, mb)), Math.abs(mdot(mb, mc))]; };
  const k = rs ? shortest((q) => { const g = gaps(q); return g[0] > 1 && g[1] > 1 ? Math.acosh(g[0]) + Math.acosh(g[1]) : 1e9; }) : 0;
  const ma = eAt(k), mb = qAct(back, ma), mc = eAt(k + 1);
  need(Math.abs(mdot(ma, mb)) > 1 + 1e-12 && Math.abs(mdot(mb, mc)) > 1 + 1e-12, 'the mirrors round the two ends cross');
  fits(lineGap(ma, mb), 'arc'); fits(lineGap(mb, mc), 'arc');
  const d1 = cutId, d2 = rs ? 'c' + D.seq++ : cutId;
  // the two half-pants
  const ha = fitHalf(A, ma, mb, { t: 'arc' }), hb = fitHalf(B, mb, mc, { t: 'arc' });
  need(!(ha.cap && hb.cap), 'both ends are half-turn points');
  const pa = fresh(D, 'S', [descOf(A), { t: 'arc', cut: d1 }]), pb = fresh(D, 'S', [descOf(B), { t: 'arc', cut: d2 }]);
  if (S && S.star != null) { pa.star = S.star; pb.star = S.star; }
  made.push(pa, pb);
  if (!ha.cap) { charts[pa.id] = ha.Q; retwist(D, params, A, ha.frames[0]); }
  if (!hb.cap) { charts[pb.id] = hb.Q; retwist(D, params, B, hb.frames[0]); }
  cut.type = 'arc'; delete cut.cap; delete cut.f; delete cut.handle;
  params[d1] = { len: ha.len };
  if (rs) {
    D.cuts[d2] = { id: d2, type: 'arc' };
    params[d2] = { len: hb.len };
    const fm = fitMirror([ma, mb, mc], [{ t: 'arc', cut: d1, len: ha.len }, { t: 'arc', cut: d2, len: hb.len }, sized(f, params0)]);
    need(!fm.cap, 'the polygon between the arcs is a cap');
    const pm = fresh(D, 'M', fm.descs.map(clone), S.star != null ? { star: S.star } : {});
    made.push(pm); charts[pm.id] = fm.Q;
  }
  replacePieces(D, gone, made);
  return { D, params, charts, olds, info: { kind: 'pop', k, cuts: rs ? [d1, d2] : [d1] } };
}

// ---------------------------------------------------------------------------------------------------------------
// merge: two arcs round two ends close into the cuff round both

function mergeMove(D0, params0, cutId) {
  const D = clone(D0), params = clone(params0), plan0 = mergePlan(D, cutId);
  const plan = plan0, S1 = plan.S1, S2 = plan.S2, M = plan.M || null, L1 = params[cutId].len;
  const olds = {}, charts = {}, gone = [S1, S2], made = [];
  // the frame: arc 1 along the x axis from 0 to L1, the polygon (or the second half-pants) below it, S1 above
  const m1 = isCap(S1) ? null : buildPiece(specOf(S1, params));
  let a, b, ma, mb, mc, f = null;
  // the things of the frame: lay S1 with its arc frame at the origin
  if (M) {
    const mm = buildPiece(specOf(M, params)), i = plan.i, Tm = invH(mm.ends[i].frame), L2 = params[plan.d2].len;
    olds[M.id] = Tm; gone.push(M);
    const side = (k) => { const sm = mm.hx.seams[((k % 3) + 3) % 3]; return lineThrough(apply(Tm, sm.a), apply(Tm, sm.b)); };
    ma = side(i + 2); mb = side(i); mc = side(i + 1); f = M.ends[(i + 2) % 3];
    const T1 = m1 ? mulAll(tx('H', L1), ROT_PI, invH(m1.ends[1].frame)) : null;
    a = m1 ? endObj(m1, T1, 0, S1.ends[0]) : coneObj(onAxis(L1 / 2), 2, S1.ends[0]);
    if (m1) olds[S1.id] = T1;
    const E2 = mul(Tm, mm.ends[(i + 1) % 3].frame);
    if (isCap(S2)) b = coneObj(apply(E2, onAxis(L2 / 2)), 2, S2.ends[0]);
    else { const m2 = buildPiece(specOf(S2, params)), T2 = mulAll(E2, tx('H', L2), ROT_PI, invH(m2.ends[1].frame)); b = endObj(m2, T2, 0, S2.ends[0]); olds[S2.id] = T2; }
  } else {
    // one arc between two half-pants: S1 lies as its arc frame has it, S2 across
    const T1 = invH(m1.ends[1].frame);
    olds[S1.id] = T1;
    a = endObj(m1, T1, 0, S1.ends[0]);
    if (isCap(S2)) b = coneObj(onAxis(L1 / 2), 2, S2.ends[0]);
    else { const m2 = buildPiece(specOf(S2, params)), T2 = mulAll(tx('H', L1), ROT_PI, invH(m2.ends[1].frame)); b = endObj(m2, T2, 0, S2.ends[0]); olds[S2.id] = T2; }
    const l0 = EX, l1 = qAct(qSlide(EY, L1), EX);            // the mirrors at the arc's two ends
    // the mirror the cuff will be is the one a's motion brings the other onto
    if (sameLine(qAct(a.q, l1), l0) || sameLine(qAct(qInv(a.q), l1), l0)) { ma = l0; mb = l1; mc = l0; } else { ma = l1; mb = l0; mc = l1; }
  }
  // a's motion carries mb onto ma, b's carries mc onto mb: with their signs, the order they go round the new pants
  const sa = sameLine(qAct(a.q, mb), ma) ? 1 : sameLine(qAct(qInv(a.q), mb), ma) ? -1 : 0;
  const sb = sameLine(qAct(b.q, mc), mb) ? 1 : sameLine(qAct(qInv(b.q), mc), mb) ? -1 : 0;
  need(sa !== 0 && sb !== 0 && (sa === sb || a.n === 2 || b.n === 2), 'the two ends do not turn the mirrors the same way');
  const s = a.kind === 'cone' && a.n === 2 ? sb : sa;
  const objs = s > 0 ? [cuffObj(qInv(qMul(a.q, b.q))), a, b] : [cuffObj(qInv(qMul(b.q, a.q))), b, a];
  fits(objs[0].len, 'cuff');
  const fit = fitPants(objs), Lg = objs[0].len;
  const P = fresh(D, 'P', [{ t: 'cuff', cut: cutId }, descOf(objs[1]), descOf(objs[2])]);
  made.push(P);
  if (!fit.cap) { charts[P.id] = fit.Q; retwist(D, params, objs[1], fit.frames[1]); retwist(D, params, objs[2], fit.frames[2]); }
  const cut = D.cuts[cutId];
  cut.type = 'cuff';
  if (M) {
    const hs = fitHalf(objs[0], ma, mc, sized(f, params0));
    need(!hs.cap, 'the mirror side is a cap');
    const Sn = fresh(D, 'S', [{ t: 'cuff', cut: cutId }, clone(f)], M.star != null ? { star: M.star } : {});
    made.push(Sn); charts[Sn.id] = hs.Q;
    let tw;
    if (!fit.cap) { const d = slideBetween('H', fit.frames[0], hs.frames[0]); need(d !== null, 'the two sides of the new cuff do not meet along it'); tw = d / Lg; }
    else tw = coordOn('H', hs.frames[0], objs[1].pt) / Lg;
    params[cutId] = { len: Lg, tw: wrapHalf(tw) };
    delete D.cuts[plan.d2]; delete params[plan.d2];
  } else {
    need(!fit.cap, 'a mirror with two half-turn points is flat');
    need(sameLine(objs[0].axis, ma), 'the new cuff is not the mirror');
    cut.cap = '*';
    params[cutId] = { len: Lg };
  }
  replacePieces(D, gone, made);
  return { D, params, charts, olds, info: { kind: 'merge', len: Lg, cuts: [cutId] } };
}

// ---------------------------------------------------------------------------------------------------------------
// F: an arc between two mirror polygons flips to the other diagonal

function arcFlip(D0, params0, cutId) {
  const D = clone(D0), params = clone(params0), r = refs(D, cutId);
  const [r1, r2] = isCap(r[0].piece) ? [r[1], r[0]] : [r[0], r[1]];
  const M1 = r1.piece, i = r1.end, M2 = r2.piece, j = r2.end, L = params[cutId].len;
  const m1 = buildPiece(specOf(M1, params)), T1 = invH(m1.ends[i].frame), olds = { [M1.id]: T1 }, charts = {};
  const side = (mm, T, k) => { const sm = mm.hx.seams[((k % 3) + 3) % 3]; return lineThrough(apply(T, sm.a), apply(T, sm.b)); };
  const mu = side(m1, T1, i + 2), mv = side(m1, T1, i), l1 = side(m1, T1, i + 1);
  let l2;
  if (isCap(M2)) l2 = EY;
  else { const m2 = buildPiece(specOf(M2, params)), T2 = mulAll(tx('H', L), ROT_PI, invH(m2.ends[j].frame)); olds[M2.id] = T2; l2 = side(m2, T2, j + 1); }
  need(Math.abs(mdot(l1, l2)) > 1 + 1e-12, 'the other two mirrors cross');
  fits(lineGap(l1, l2), 'arc');
  const e = (P, k) => sized(P.ends[((k % 3) + 3) % 3], params0), arc = { t: 'arc', cut: cutId, len: lineGap(l1, l2) };
  // round the octagon: mv, l1, mu, l2 with the ends e(M1, i + 1), e(M1, i + 2), e(M2, j + 1), e(M2, j + 2) between them
  const fa = fitMirror([l1, mu, l2], [e(M1, i + 2), e(M2, j + 1), arc]), fb = fitMirror([l2, mv, l1], [e(M2, j + 2), e(M1, i + 1), arc]);
  need(!(fa.cap && fb.cap), 'both new polygons are caps');
  const star = M1.star != null ? { star: M1.star } : {};
  const pa = fresh(D, 'M', fa.descs.map(clone), star), pb = fresh(D, 'M', fb.descs.map(clone), star);
  if (!fa.cap) charts[pa.id] = fa.Q;
  if (!fb.cap) charts[pb.id] = fb.Q;
  params[cutId] = { len: arc.len };
  const ia = D.pieces.findIndex((p) => p.id === M1.id), ib = D.pieces.findIndex((p) => p.id === M2.id);
  D.pieces[ia] = pa; D.pieces[ib] = pb;
  return { D, params, charts, olds, info: { kind: 'F', len: params[cutId].len, cuts: [cutId] } };
}

// ---------------------------------------------------------------------------------------------------------------
// slide: an arc round one end moves to the third mirror of the polygon next to it

function slideMove(D0, params0, cutId) {
  const D = clone(D0), params = clone(params0), r = refs(D, cutId), rs = r.find((x) => x.piece.kind === 'S'), rm = r.find((x) => x.piece.kind === 'M');
  const S = rs.piece, M = rm.piece, i = rm.end, L = params[cutId].len, olds = {}, charts = {};
  // the frame: the arc along the x axis from 0 to L, the polygon above it and the half-pants below
  let X, m0, m1, mx, e2, e3;              // the mirrors at the arc's two ends, the polygon's third; its ends by m1 and by m0
  const e = (k) => sized(M.ends[((k % 3) + 3) % 3], params0);
  if (!isCap(M)) {
    const mm = buildPiece(specOf(M, params)), Tm = invH(mm.ends[i].frame);
    olds[M.id] = Tm;
    const side = (k) => { const sm = mm.hx.seams[((k % 3) + 3) % 3]; return lineThrough(apply(Tm, sm.a), apply(Tm, sm.b)); };
    m0 = side(i + 2); m1 = side(i); mx = side(i + 1);
    if (isCap(S)) X = coneObj(onAxis(L / 2), 2, S.ends[0]);
    else { const ms = buildPiece(specOf(S, params)), Ts = mulAll(tx('H', L), ROT_PI, invH(ms.ends[1].frame)); olds[S.id] = Ts; X = endObj(ms, Ts, 0, S.ends[0]); }
  } else {
    // the polygon is a cap: the arc lies on a mirror, with a corner of order 2 at each end. Lay the half-pants down
    // turned over end for end, so that it is below the axis as before
    const ms = buildPiece(specOf(S, params)), Ts = mulAll(tx('H', L), ROT_PI, invH(ms.ends[1].frame));
    olds[S.id] = Ts; X = endObj(ms, Ts, 0, S.ends[0]);
    m0 = EX; m1 = qAct(qSlide(EY, L), EX); mx = EY;
  }
  e2 = e(i + 1); e3 = e(i + 2);
  // the motion of X that carries m0 onto m1
  const g = sameLine(qAct(X.q, m0), m1) ? X.q : qInv(X.q);
  need(sameLine(qAct(g, m0), m1), 'the end does not carry one mirror of the arc onto the other');
  const gx = qAct(g, mx);
  need(Math.abs(mdot(mx, gx)) > 1 + 1e-12, 'the third mirror crosses its own copy');
  fits(lineGap(mx, gx), 'arc');
  const hs = fitHalf(X, mx, gx, { t: 'arc', cut: cutId });
  const arc = { t: 'arc', cut: cutId }, fm = fitMirror([m1, gx, mx], [e3, { ...arc, len: hs.len }, e2]);
  need(!(hs.cap && fm.cap), 'both sides of the new arc are caps');
  const star = S.star != null ? { star: S.star } : M.star != null ? { star: M.star } : {};
  const ps = fresh(D, 'S', [clone(S.ends[0]), arc], star), pm = fresh(D, 'M', fm.descs.map(clone), star);
  if (!hs.cap) { charts[ps.id] = hs.Q; retwist(D, params, X, hs.frames[0]); }
  if (!fm.cap) charts[pm.id] = fm.Q;
  params[cutId] = { len: hs.len };
  const ia = D.pieces.findIndex((p) => p.id === S.id), ib = D.pieces.findIndex((p) => p.id === M.id);
  D.pieces[ia] = ps; D.pieces[ib] = pm;
  return { D, params, charts, olds, info: { kind: 'slide', len: hs.len, cuts: [cutId] } };
}
