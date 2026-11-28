// flips.mjs — the flip layer for four cone points P, Q, R, S (hyperbolic), and for the flat 2222.
// Pure: no DOM. It stands on the engine of Two features, two handles (handles.js), which it only reads.
//
// WORDS
//   state     the engine's: { k, perm, orders, L, tw, thetas, b, tau, print }. perm[slot] is the feature in slot
//             A, B, C, D (0..3); orders[slot] its order. A, B are the picked pair, C, D the far pair; the cut
//             parts them. L is the engine's Length (hyperbolic: the length of the cut; 2222: |AB|, half of it),
//             tw its Twist in turns of the cut, kept in [-1/2, 1/2].
//   chains    in the frame where the cut is level: the picked pair's images X_j below it (X_0 = A, X_1 = B, one
//             step apart; a step is L/2, on the plane |AB|), the far pair's images Y_j above it (Y_0 = C, Y_1 = D),
//             Y_j standing 2 tw + j steps to the right of X_0.
//   loop j    the curve round A and Y_j (equally round B and Y_{j+1}): the product R(A) R(Y_j). These are exactly
//             the curves that meet the cut twice. j even pairs A with C, j odd A with D.
//   triangle  the cut with loops k and k + 1: three curves, any two of which meet twice, one for each pairing. Its
//             FACE is the triangle of cone points F = (A, B, Y_{k+1}): each side of F is an arc whose thickened
//             edge is one of the three curves. A triangle is carried as `state.tri = { k, lo, hi }`: k its index
//             in this state; lo, hi the index it has in the state a flip to loop k ("lo") or to loop k + 1 ("hi")
//             leads to (null until first needed). Without `tri` the triangle is the NATURAL one: k = -1 for
//             tw >= 0, k = 0 for tw < 0, so that the apex stands over the base; then in each of the two other
//             pairings its loop is the shortest of the curves that meet the cut twice.
//   flip      take another side of F as the base. The face does not move, so the pattern does not, and the three
//             states round a face are fixed: any closed chain of flips returns the same numbers.
//   swap      one loop gives way to its twin, the other curve meeting the remaining two twice: the next triangle.
//
// EXPORTS
//   decomposition(state)        the cut: pairing, Length, Twist, its line on the pattern, its two ends
//   triangle(state)             the three loops, each with the Length and Twist it has as the cut, and its line
//   flip(state, which)          -> { state, Q, invQ }: the state with that loop as the cut, and the change of pose
//   anchor(state)               the same state on its natural triangle (a carried triangle also lapses by itself
//                               once L or tw change: it is stamped with the numbers it was made at)
//   swap(state, which)          -> { state, Q, invQ }: one loop of the triangle gives way to its twin
//   layout(state)               the cone points' chains X(j), Y(j) and the motion once round the cut
//   naturalIndex(state), neighbour(state, j), relation(kind, orders, loops), pairingKey(pairing), triText(tri),
//   triFrom(text), isFlat(state)
//
// In the page the two imports below become relative ('../../two-features-two-handles/src/handles.js', …).

import {
  GH, GE, hgt, invH, boostX, psuMul, psuInv, psuToSO21, psuBoostX,
} from '../../two-features-two-handles/src/handles.js';
import { mul, apply, inv, I3 } from '../../classification-of-surfaces/src/sym/geom.js';

const PI = Math.PI, TAU = 2 * PI;
const TIE = 1e-9;                       // two numbers nearer than this are a tie, settled by rule and not by rounding
const even = (j) => (((j % 2) + 2) % 2) === 0;
const cosPi = (n) => Math.cos(PI / n);
const offH = (x, h, sgn) => [Math.sinh(x) * Math.cosh(h), sgn * Math.sinh(h), Math.cosh(x) * Math.cosh(h)];
const midH = (a, b) => GH.norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
const turns = (a) => Math.ceil(a / TAU - 0.5);                  // whole turns in an angle: a - TAU turns(a) lies in (-pi, pi]
const principal = (a) => a - TAU * turns(a);
const toDisc = (v) => [v[0] / v[2], v[1] / v[2]];               // a null vector -> its point on the unit circle
// A point of the hyperboloid from a vector that should be one: x and y are kept, z is made from them. (Scaling the
// vector instead, as GH.norm does, moves a point by half of what x^2 + y^2 - z^2 is off -1, and after a motion that
// brought the point in from a distance rho that is about 1e-16 e^(2 rho): 3e-11 at 6.7, 1e-6 at 12.)
const onH = (v) => [v[0], v[1], Math.sqrt(1 + v[0] * v[0] + v[1] * v[1])];
// The engine's own frame at p looking toward q (handles.js psuFrame, which it does not export), by the same
// arithmetic. (Where the middle of the picked pair stands far from the cut, at a short Length, that frame's
// direction is known only to about 1e-13; made the same way here, the two frames agree and the error cancels.)
const boostTo0 = (p) => { const [x, y, z] = p, k = 1 / (z + 1); return [1 + x * x * k, x * y * k, -x, x * y * k, 1 + y * y * k, -y, -x, -y, z]; };
const psuFrame = (p, q) => {
  const s = Math.sqrt(2 * (p[2] + 1)), qr = apply(boostTo0(p), q), th = Math.atan2(qr[1], qr[0]);
  return psuMul([s / 2, 0, p[0] / s, p[1] / s, 0], [Math.cos(th / 2), Math.sin(th / 2), 0, 0, 0]);
};

/** Counter-clockwise angle at P from the direction to U to the direction to V, in (-pi, pi]. */
function ang(G, P, U, V) {
  const F = G.frame(P, U), v = G.toward(P, V);
  return Math.atan2(G.form(v, [F[1], F[4], F[7]]), G.form(v, [F[0], F[3], F[6]]));
}

export const isFlat = (state) => state.orders.every((n) => n === 2);

/** The triangle a state stands in when it carries none: the apex over the base (the offsets of loops k, k + 1 straddle 0). */
export function naturalIndex(state) {
  return state.tw >= -1e-12 ? -1 : 0;
}

// ---- A state's own frame: its two chains, its cut ---------------------------------------------------------------
// The NUMBERS of a flip (the new Length, the new Twist) come from closed forms in the old numbers, with no frames
// and no matrices, so they keep full precision however far out the cone points stand. Frames only say where things
// are drawn, and how the pose changes.
function kernel(orders, L, tw) {
  const o = orders;
  if (!o || o.length !== 4 || o.some((n) => !(n >= 2))) throw new Error('flips: a state of four cone points is wanted');
  const slotY = (j) => (even(j) ? 2 : 3);

  if (o.every((n) => n === 2)) {
    // the plane, as pillowCentered lays it: A, B on the x-axis about the origin, the far row at height w = 1/L
    const ell = L, w = 1 / ell, s = 2 * ell * tw;
    const X = (j) => [-ell / 2 + j * ell, 0, 1], Y = (j) => [-ell / 2 + s + j * ell, w, 1];
    /** The new base U0 -> U1 and the apex, as chain points [row, j] (row 0: the picked pair's chain, 1: the far one). */
    const solve = (u0, u1, ap) => {
      const pt = ([row, j]) => (row ? Y(j) : X(j)), U0 = pt(u0), U1 = pt(u1), A = pt(ap);
      const ex = U1[0] - U0[0], ey = U1[1] - U0[1], l1 = Math.hypot(ex, ey);
      const mx = (U0[0] + U1[0]) / 2, my = (U0[1] + U1[1]) / 2;
      const x = ((A[0] - mx) * ex + (A[1] - my) * ey) / l1, h = (-(A[0] - mx) * ey + (A[1] - my) * ex) / l1;
      return { L: l1, step: l1, x, err: Math.abs(h * l1 - 1) };          // the far row stands 1 / L' off: the area is kept
    };
    return {
      kind: 'E', G: GE, o, L, tw, step: ell, slotY, solve, X, Y,
      halfTrace: (len) => len,                                  // on the plane a loop is measured by its Length itself
      fit: (U0, U1) => GE.fix(GE.fit(U0, U1, X(0), X(1), false), 1),
      back: (Q) => GE.fix(inv(Q), 1),
      own: () => ({
        seg: [[-ell / 2 + s / 2, w / 2, 1], [1.5 * ell + s / 2, w / 2, 1]],          // one period of the line half-way between the rows
        ends: null, dir: [1, 0], onTree: null, T: [1, 0, -2 * ell, 0, 1, 0, 0, 0, 1],
      }),
    };
  }

  // the hyperbolic plane. The cut frame has the cut on the x-axis, A's foot at -L/4, B's at +L/4, the far pair above.
  const [p, q, r, s] = o, c = L / 2, t = tw * L;
  const hA = hgt(p, q, L), hB = hgt(q, p, L), hC = hgt(r, s, L), hD = hgt(s, r, L);
  const shift = t >= 0 ? -c / 2 + t / 2 : c / 2 + t / 2;        // as fourConeCentered: its tile is laid out about the middle
  const S2P = psuInv(psuFrame(midH(offH(-c / 2 - shift, hA, -1), offH(c / 2 - shift, hB, -1)), offH(c / 2 - shift, hB, -1)));
  const M = psuToSO21(S2P), P = psuToSO21(psuMul(S2P, psuBoostX(-shift)));          // P: cut frame -> the engine's pair-centred frame
  const put = (x, h, sgn) => onH(apply(M, offH(x - shift, h, sgn)));
  const X = (j) => put(-c / 2 + j * c, even(j) ? hA : hB, -1), Y = (j) => put(t - c / 2 + j * c, even(j) ? hC : hD, 1);
  // closed forms: a chain point [row, j] has its foot at foot(row, j) along the cut and stands hOf(row, j) from it
  const foot = (row, j) => (row ? t - c / 2 : -c / 2) + j * c;
  const hOf = (row, j) => (row ? (even(j) ? hC : hD) : (even(j) ? hA : hB));
  const coshDist = ([r1, j1], [r2, j2]) => {
    if (r1 === 0 && r2 === 0 && Math.abs(j1 - j2) === 1) return (Math.cosh(c) + cosPi(p) * cosPi(q)) / (Math.sin(PI / p) * Math.sin(PI / q));          // F3
    const h1 = hOf(r1, j1), h2 = hOf(r2, j2), dx = foot(r2, j2) - foot(r1, j1);
    return Math.cosh(h1) * Math.cosh(h2) * Math.cosh(dx) + (r1 === r2 ? -1 : 1) * Math.sinh(h1) * Math.sinh(h2);
  };
  /**
   * The cut round U0, U1 (orders n0, n1), with the apex (order n2; n3 the fourth's) on its far side.
   *   cosh(L'/2) = sin(pi/n0) sin(pi/n1) cosh d(U0, U1) - cos(pi/n0) cos(pi/n1)                                  (F1)
   *   The apex stands x along the new cut from the middle of the feet of U0, U1 (which are L'/2 apart):
   *   cosh(x +- L'/4) = ( cosh d(U0 | U1, apex) - sinh h sinh h_apex ) / ( cosh h cosh h_apex ) =: C0 | C1,  h the height
   *   of U0 | U1 over the new cut (F4), so  sinh x = (C0 - C1) / (2 sinh(L'/4)),  and (C0 + C1) / (2 cosh(L'/4))
   *   = cosh x is the check (it holds only if the apex stands at ITS height over the new cut).
   */
  const solve = (u0, u1, ap, n) => {
    const X1 = Math.sin(PI / n[0]) * Math.sin(PI / n[1]) * coshDist(u0, u1) - cosPi(n[0]) * cosPi(n[1]);
    const L1 = 2 * Math.acosh(Math.max(1, X1)), c1 = L1 / 2;
    const a = hgt(n[0], n[1], L1), b = hgt(n[1], n[0], L1), hp = hgt(n[2], n[3], L1);
    const C0 = (coshDist(u0, ap) - Math.sinh(a) * Math.sinh(hp)) / (Math.cosh(a) * Math.cosh(hp));
    const C1 = (coshDist(u1, ap) - Math.sinh(b) * Math.sinh(hp)) / (Math.cosh(b) * Math.cosh(hp));
    const sx = (C0 - C1) / (2 * Math.sinh(c1 / 2)), cx = (C0 + C1) / (2 * Math.cosh(c1 / 2));
    return { L: L1, step: c1, x: Math.asinh(sx), err: Math.abs(cx - Math.sqrt(1 + sx * sx)) / cx };
  };
  return {
    kind: 'H', G: GH, o, L, tw, step: c, slotY, solve, X, Y,
    halfTrace: (len) => Math.cosh(len / 2),
    fit: (U0, U1) => GH.fit(U0, U1, X(0), X(1), false),          // the motion that lays U0, U1 on this state's A, B
    back: (Q) => invH(Q),
    own: () => {
      const onTree = p === 2 && q === 2 ? 'picked' : r === 2 && s === 2 ? 'far' : null;
      const at = (x) => onH(apply(P, offH(x, 0, 1)));
      const seg = onTree === 'picked' ? [X(0), X(1)] : onTree === 'far' ? [Y(0), Y(1)] : [at(-c), at(c)];
      return { seg, ends: [apply(P, [-1, 0, 1]), apply(P, [1, 0, 1])], dir: null, onTree, T: mul(P, mul(boostX(-L), invH(P))) };
    },
  };
}
const kernelOf = (state) => kernel(state.orders, state.L, state.tw);

/**
 * The triangle a state carries, with what is missing filled by rule (k natural; lo, hi left null).
 * A carried triangle belongs to the numbers it was made at: flip and swap stamp it with the state's L and tw, and
 * once those have changed (a slider moved, the engine re-cut) the stamp no longer fits and the triangle is the
 * natural one again. A triangle without a stamp (read from the address) is taken as it is.
 */
function triOf(state) {
  let t = state.tri || null;
  const int = (v) => (Number.isInteger(v) ? v : null);
  if (t && typeof t.L === 'number' && (Math.abs(t.L - state.L) > 1e-12 * Math.max(1, state.L) || Math.abs(t.tw - state.tw) > 1e-12)) t = null;
  const k = t && int(t.k) !== null ? t.k : naturalIndex(state);
  return { k, lo: t ? int(t.lo) : null, hi: t ? int(t.hi) : null };
}

/**
 * Take another side of the face as the base. K the state's kernel, k its triangle's index, target 'lo' (loop k) or
 * 'hi' (loop k + 1), want the index the new state is to have (an integer; null: by rule).
 *
 * The face is F = (A, B, Y_{k+1}), counter-clockwise. 'lo': the new base is B -> Y_{k+1}, the new apex A.
 * 'hi': the new base is Y_{k+1} -> A, the new apex B. The new cut lies to the left of its base, as the engine wants.
 * In the new cut frame the apex stands x along the cut from the middle of the base's feet, and it is the far
 * chain's point number k' + 1: with xi = x / step' - 1/2, the new Twist is tw' = (xi - k') / 2. Odd k': the apex is
 * named C; even: D. The rule when no index is wanted: the integer nearest to xi, so that |tw'| <= 1/4 (the far
 * point that stands nearer to the new A is named C); a tie goes to the odd one.
 */
function rebase(K, k, target, want) {
  const lo = target === 'lo', o = K.o;
  const sY = K.slotY(k + 1), sW = 5 - sY;
  const u0 = lo ? [0, 1] : [1, k + 1], u1 = lo ? [1, k + 1] : [0, 0], ap = lo ? [0, 0] : [0, 1];          // chain points [row, j]
  const s0 = lo ? 1 : sY, s1 = lo ? sY : 0, s2 = lo ? 0 : 1;
  const num = K.solve(u0, u1, ap, [o[s0], o[s1], o[s2], o[sW]]);
  const xi = num.x / num.step - 0.5;
  let k1;
  if (Number.isInteger(want) && Math.abs((xi - want) / 2) <= 0.5 + TIE) k1 = want;
  else if (Number.isInteger(want)) { const rho = even(want) ? 0 : 1; k1 = 2 * Math.round((xi - rho) / 2) + rho; }
  else { const f = Math.floor(xi); k1 = Math.abs(xi - f - 0.5) < TIE ? (even(f) ? f + 1 : f) : Math.round(xi); }
  const tw1 = Math.max(-0.5, Math.min(0.5, (xi - k1) / 2));
  const slots = even(k1) ? [s0, s1, sW, s2] : [s0, s1, s2, sW];          // [A', B', C', D'] as slots of the old state
  const orders = slots.map((sl) => o[sl]), pt = ([row, j]) => (row ? K.Y(j) : K.X(j)), base = [pt(u0), pt(u1)];
  let pose = null;
  return {
    target, loop: lo ? k : k + 1, k: k1, L: num.L, tw: tw1, slots, orders, base, err: num.err,
    /** The new state's own frame, and the motion Q from this state's frame to it (made when asked for). */
    get pose() {
      if (!pose) { const K1 = kernel(orders, num.L, tw1), Q = K1.fit(base[0], base[1]); pose = { K1, Q, invQ: K1.back(Q) }; }
      return pose;
    },
  };
}

/** A pairing as text, the same however it is listed: "01|23". */
export const pairingKey = (pairing) => pairing.map((pr) => pr.slice().sort((a, b) => a - b).join('')).sort().join('|');

/** One loop of the triangle, as the page draws and labels it. `nb` a rebase (null for the cut itself). */
function loopOf(state, K, nb) {
  const f = (sl) => state.perm[sl], kind = K.kind, G = K.G;
  if (!nb) {
    const own = K.own();
    return {
      id: 'cut', index: null, key: pairingKey([[f(0), f(1)], [f(2), f(3)]]), pairing: [[f(0), f(1)], [f(2), f(3)]], slots: [[0, 1], [2, 3]],
      L: state.L, tw: state.tw, perm: state.perm.slice(), orders: state.orders.slice(),
      length: kind === 'E' ? 2 * state.L : state.L, X: K.halfTrace(state.L),
      seg: own.seg, ends: own.ends ? own.ends.map(toDisc) : null, dir: own.dir, onTree: own.onTree, T: own.T,
      seals: [[K.X(0), K.X(1)], [K.Y(0), K.Y(1)]],
    };
  }
  // an alternative: its line is where the engine will draw the cut once it is the cut, carried back to this frame
  const { K1, Q, invQ } = nb.pose, own = K1.own(), bring = (v) => (kind === 'H' ? onH(apply(invQ, v)) : G.norm(apply(invQ, v))), sl = nb.slots, j = nb.loop;
  // the two arcs it runs round: the side of the face, and the arc across from it
  const seals = nb.target === 'lo' ? [[K.X(1), K.Y(j + 1)], [K.X(0), K.Y(j)]] : [[K.Y(j), K.X(0)], [K.X(1), K.Y(j + 1)]];
  let dir = null;
  if (own.dir) { const v = apply(invQ, [own.dir[0], own.dir[1], 0]); dir = [v[0], v[1]]; }
  return {
    id: nb.target, index: j, key: pairingKey([[f(sl[0]), f(sl[1])], [f(sl[2]), f(sl[3])]]), pairing: [[f(sl[0]), f(sl[1])], [f(sl[2]), f(sl[3])]], slots: [[sl[0], sl[1]], [sl[2], sl[3]]],
    L: nb.L, tw: nb.tw, perm: sl.map(f), orders: nb.orders.slice(),
    length: kind === 'E' ? 2 * nb.L : nb.L, X: K.halfTrace(nb.L),
    seg: own.seg.map(bring), ends: own.ends ? own.ends.map((v) => toDisc(apply(invQ, v))) : null, dir, onTree: own.onTree,
    T: mul(invQ, mul(own.T, Q)), seals, triIndex: nb.k,
  };
}

/**
 * The trace relation among the three loops of a triangle.
 *   hyperbolic: X = cosh(length / 2) of each loop; kappa of a loop that parts {i, j} from {k, l} is
 *     cos(pi/n_i) cos(pi/n_j) + cos(pi/n_k) cos(pi/n_l); with c_i = cos(pi/n_i):
 *     X^2 + Y^2 + Z^2 - 2 X Y Z + 2 (kX X + kY Y + kZ Z) + c_1^2 + c_2^2 + c_3^2 + c_4^2 + 4 c_1 c_2 c_3 c_4 - 1 = 0
 *     (Fricke's cubic for the sphere with four cone points, the four rotations lifted with trace 2 cos(pi/n), so
 *     that every loop's trace is -2 cosh(length / 2)).
 *   flat: the three Lengths a, b, c are the sides of the face, of area 1/2 (the engine's pillow has area 2):
 *     2 (a^2 b^2 + b^2 c^2 + c^2 a^2) - (a^4 + b^4 + c^4) = 4       (Heron).
 * Returns { residual (relative), kappa, partner: [X', Y', Z'] }: partner[i] is the other root for loop i with the
 * other two held: the X (flat: the Length) of loop i's twin, the curve that replaces it in the next triangle.
 */
export function relation(kind, orders, loops) {
  const [x, y, z] = loops.map((lp) => lp.X);
  if (kind === 'E') {
    const a2 = x * x, b2 = y * y, c2 = z * z, sq = (v) => Math.sqrt(Math.max(0, v));
    const res = 2 * (a2 * b2 + b2 * c2 + c2 * a2) - (a2 * a2 + b2 * b2 + c2 * c2) - 4;
    return { residual: res / Math.max(4, a2 * a2 + b2 * b2 + c2 * c2), kappa: [0, 0, 0], partner: [sq(2 * b2 + 2 * c2 - a2), sq(2 * a2 + 2 * c2 - b2), sq(2 * a2 + 2 * b2 - c2)] };
  }
  const cs = orders.map(cosPi);
  const kappa = loops.map((lp) => cs[lp.slots[0][0]] * cs[lp.slots[0][1]] + cs[lp.slots[1][0]] * cs[lp.slots[1][1]]);
  const c0 = cs[0] * cs[0] + cs[1] * cs[1] + cs[2] * cs[2] + cs[3] * cs[3] + 4 * cs[0] * cs[1] * cs[2] * cs[3] - 1;
  const res = x * x + y * y + z * z - 2 * x * y * z + 2 * (kappa[0] * x + kappa[1] * y + kappa[2] * z) + c0;
  return {
    residual: res / Math.max(1, 2 * x * y * z),
    kappa,
    partner: [2 * y * z - 2 * kappa[0] - x, 2 * x * z - 2 * kappa[1] - y, 2 * x * y - 2 * kappa[2] - z],
  };
}

// ---- What the page calls ------------------------------------------------------------------------------------------
/**
 * The cut of a state: who it parts (pairing, and key: the pairing as text), its Length and Twist, the length of the
 * closed curve, and in the frame the engine draws the state in: seg (one period of its line), ends (its two points
 * on the unit circle; flat: null, and dir its direction), onTree (a pair of 2s: the loop is that pair's segment run
 * twice), T (once round it), seals (the two arcs it runs round: A-B and C-D), home (the four cone points A, B, C, D).
 */
export function decomposition(state) {
  const K = kernelOf(state), lp = loopOf(state, K, null);
  return {
    kind: K.kind, key: lp.key, pairing: lp.pairing, L: lp.L, tw: lp.tw, length: lp.length, X: lp.X,
    seg: lp.seg, ends: lp.ends, dir: lp.dir, onTree: lp.onTree, T: lp.T, seals: lp.seals,
    home: [K.X(0), K.X(1), K.Y(0), K.Y(1)],
  };
}

/**
 * The triangle of a state: loops[0] the cut, loops[1] 'lo' (loop k), loops[2] 'hi' (loop k + 1). Each loop:
 *   id      'cut' | 'lo' | 'hi'
 *   key     its pairing as text, "01|23": the name to tie a loop to the schematic by ('lo' and 'hi' change places
 *           when the triangle does; a pairing does not)
 *   pairing [[f, f], [f, f]] in features; the first pair is the one it picks
 *   L, tw   the engine's Length and Twist of the state in which it is the cut; perm, orders: of that state
 *   length  of the closed curve (flat: 2 L);  X: cosh of half of it (flat: L)
 *   seg     one period of its line, two points of the engine's kind: drawn in every tile it is the whole curve
 *   ends    hyperbolic: its two points on the unit circle, [behind A', beyond B'] for the pair A', B' it picks
 *   dir     flat: its direction A' -> B' (there `ends` is null; the line is any parallel, `seg` the middle one)
 *   onTree  'picked' | 'far' | null: a pair of 2s on that side, the loop is that pair's segment run twice
 *   seals   the two arcs between cone points it runs round (for 'lo', 'hi' the first is a side of the face)
 *   T       once round it, as a motion of this frame (the product of the turns about A' and B')
 *   partner the X (flat: the Length) of its twin;  minimal: it is no longer than its twin
 * Also: k, tri (the triangle with its three indices fixed), natural (it is the natural one), face (three points:
 * A, B and the apex), faceFeatures, shortest (an id), ties (pairs of ids equally long), residual (of the trace
 * relation), reduced (no loop is longer than its twin), err (of the closed forms: the apex's two distances).
 */
export function triangle(state) {
  const K = kernelOf(state), tri = triOf(state);
  const lo = rebase(K, tri.k, 'lo', tri.lo), hi = rebase(K, tri.k, 'hi', tri.hi);
  const loops = [loopOf(state, K, null), loopOf(state, K, lo), loopOf(state, K, hi)];
  const rel = relation(K.kind, K.o, loops);
  loops.forEach((lp, i) => { lp.partner = rel.partner[i]; lp.minimal = lp.X <= rel.partner[i] * (1 + 1e-12) + 1e-12; });
  const order = [0, 1, 2].sort((i, j) => loops[i].length - loops[j].length);
  const ties = [];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(loops[i].length - loops[j].length) < TIE * Math.max(1, loops[i].length)) ties.push([loops[i].id, loops[j].id]);
  return {
    kind: K.kind, k: tri.k, tri: { k: tri.k, lo: lo.k, hi: hi.k }, natural: tri.k === naturalIndex(state),
    face: [K.X(0), K.X(1), K.Y(tri.k + 1)], faceFeatures: [state.perm[0], state.perm[1], state.perm[K.slotY(tri.k + 1)]],
    loops, shortest: loops[order[0]].id, ties,
    residual: rel.residual, reduced: loops.every((lp) => lp.minimal), err: Math.max(lo.err, hi.err),
  };
}

/**
 * Flip: the state in which another loop of the triangle is the cut, and the change of pose.
 *   which   'lo' | 'hi'; 1 | 2 (the index in triangle(state).loops); two features [i, j] that the loop keeps on one
 *           side (either side); or a loop's key, "02|13". The cut itself (or its own pairing) returns the state
 *           unchanged.
 * Returns { state, Q, invQ, loop, err }: `state` is of the engine's shape (k, b, tau, print passed through; perm,
 * orders, L, tw, thetas new; tri carried, stamped), Q the motion from this state's frame to the new state's (the
 * engine's convention: the new state's pattern, carried by invQ, lies where this state's lay; the page sets
 * view <- view . invQ, as page.js pickPair does), `loop` the id that was taken, `err` the closed forms' own check.
 * The print: the page re-ties it as it does after a pick (retiePrint(after, before)).
 */
export function flip(state, which) {
  const K = kernelOf(state), tri = triOf(state), o = K.o, G = K.G;
  if (typeof which === 'string' && which.includes('|')) which = which.split('|')[0].split('').map(Number);          // a key, "02|13"
  let target = which === 1 ? 'lo' : which === 2 ? 'hi' : which === 0 ? 'cut' : which;
  const lo = rebase(K, tri.k, 'lo', tri.lo), hi = rebase(K, tri.k, 'hi', tri.hi);
  if (Array.isArray(which)) {
    const [fa, fb] = which, side = (perm, ft) => perm.indexOf(ft) < 2;
    const together = (nb) => { const pm = nb.slots.map((sl) => state.perm[sl]); return side(pm, fa) === side(pm, fb); };
    target = side(state.perm, fa) === side(state.perm, fb) ? 'cut' : together(lo) ? 'lo' : 'hi';
  }
  if (target === 'cut') return { state: { ...state, tri: { k: tri.k, lo: lo.k, hi: hi.k, L: state.L, tw: state.tw } }, Q: I3.slice(), invQ: I3.slice(), loop: 'cut' };
  if (target !== 'lo' && target !== 'hi') throw new Error('flips: flip(state, which): which loop?');
  const nb = target === 'lo' ? lo : hi, other = target === 'lo' ? hi : lo, k = tri.k;

  // The commas stay. A comma's angle is measured at its cone point from the direction to the partner, and the
  // partners change: theta' = theta + (angle at the cone point from the new partner to the old one).
  //   The three corners of the face keep their place; so does a comma at one of them, and only the direction it is
  //   measured from changes. The far pair of any state round the face is the apex and the fourth cone point, which
  //   stands across one of the two sides of the face that are not the base: across the side after the base
  //   (W_lo = Y_{k+2}) when the apex is named C, across the side before it (W_hi = Y_k) when it is named D. The
  //   third such point, across the base, is W_b = R(B)(Y_{k+2}) = R(A)^-1 (Y_k).
  //   The fourth's comma is carried from one of these three points to another by the turn about the corner their
  //   two sides share. The three turns in a row (W_hi -> W_lo -> W_b -> W_hi) make the fourth point's own turn
  //   backwards, not the identity, so one of the three steps has to take up a turn of 2 pi / n: the step between the
  //   two points that are not across the REFERENCE side, the side opposite the corner of least feature number.
  //   That choice depends on the face alone, so every closed chain of flips round a face returns every angle.
  const A0 = K.X(0), B0 = K.X(1), Y = (j) => K.Y(j);
  const partnerOfApex = Y(even(k) ? k : k + 2);                 // the fourth's place in this state
  const delta = [0, 0, 0, 0];                                   // by old slot
  const apexNamedD = even(nb.k);                                // in the new state
  const sP = K.slotY(k + 1), sW = 5 - sP;                       // the apex's slot, the fourth's
  if (target === 'lo') {
    delta[1] = ang(G, B0, Y(k + 1), A0);
    delta[sP] = ang(G, Y(k + 1), B0, partnerOfApex);
    delta[0] = ang(G, A0, Y(k), B0) + (apexNamedD ? TAU / o[0] : 0);
    delta[sW] = ang(G, Y(k), A0, !even(k) && apexNamedD ? Y(k - 1) : Y(k + 1));
  } else {
    delta[0] = ang(G, A0, Y(k + 1), B0);
    delta[sP] = ang(G, Y(k + 1), A0, partnerOfApex);
    delta[1] = ang(G, B0, Y(k + 2), A0) - (apexNamedD ? 0 : TAU / o[1]);
    delta[sW] = ang(G, Y(k + 2), B0, even(k) && !apexNamedD ? Y(k + 3) : Y(k + 1));
  }
  const least = Math.min(state.perm[0], state.perm[1], state.perm[sP]);
  const ref = least === state.perm[sP] ? 'b' : least === state.perm[0] ? 'lo' : 'hi';
  const from = even(k) ? 'hi' : 'lo', to = target === 'lo' ? (apexNamedD ? 'b' : 'hi') : (apexNamedD ? 'lo' : 'b');
  if (from !== to && from !== ref && to !== ref) delta[sW] += ((from === 'hi' && to === 'lo') || (from === 'lo' && to === 'b') || (from === 'b' && to === 'hi') ? 1 : -1) * (TAU / o[sW]);
  // each angle keeps its own count of whole turns; the rest is the principal value, so a closed chain returns it
  const thetas = (state.thetas || [0, 0, 0, 0]).slice();
  for (let sl = 0; sl < 4; sl++) { const ft = state.perm[sl], th = thetas[ft] || 0; thetas[ft] = principal(th + delta[sl]) + TAU * turns(th); }

  const next = {
    ...state,
    perm: nb.slots.map((sl) => state.perm[sl]),
    orders: nb.orders.slice(),
    L: nb.L,
    tw: nb.tw,
    thetas,
    // the same face, its sides renamed: after 'lo' the old 'hi' is the new 'lo' and the old cut the new 'hi';
    // after 'hi' the old cut is the new 'lo' and the old 'lo' the new 'hi'
    tri: target === 'lo' ? { k: nb.k, lo: other.k, hi: k, L: nb.L, tw: nb.tw } : { k: nb.k, lo: k, hi: other.k, L: nb.L, tw: nb.tw },
  };
  return { state: next, Q: nb.pose.Q, invQ: nb.pose.invQ, loop: target, err: nb.err };
}

/**
 * Where a state's cone points lie, in the frame the engine draws it in: X(j) the picked pair's chain (X(0) = A,
 * X(1) = B), Y(j) the far pair's (Y(0) = C, Y(1) = D), T the motion once round the cut (T = R(A) R(B): it takes
 * X(j) to X(j - 2) and Y(j) to Y(j - 2)). The points are made by closed forms and one motion, with z from x and y.
 */
export function layout(state) {
  const K = kernelOf(state);
  return { kind: K.kind, X: K.X, Y: K.Y, T: K.own().T };
}

/** The same state on its natural triangle (a carried one lapses by itself when L or tw change; this drops it at once). */
export function anchor(state) {
  const { tri, ...rest } = state;
  return rest;
}

/**
 * Swap one loop of the triangle for its twin: the other curve that meets the remaining two twice each (of the same
 * pairing as the one it replaces). This is the move to the next triangle across that loop.
 *   'lo'   loop k gives way to loop k + 2: the cut and its numbers stay, the triangle's index becomes k + 1
 *   'hi'   loop k + 1 gives way to loop k - 1: the index becomes k - 1
 *   'cut'  the cut itself gives way to its twin, the other two loops stay: a new state, and a change of pose.
 *          (Done as flip 'lo', swap the old cut there, flip to its twin.)
 * Returns { state, Q, invQ } as flip does (Q the identity for 'lo' and 'hi'). The new face is another face, so what
 * the old face's sides remembered is dropped and the rule names the far pair afresh.
 */
export function swap(state, which) {
  const tri = triOf(state);
  if (which === 'lo' || which === 'hi') {
    return { state: { ...state, tri: { k: tri.k + (which === 'lo' ? 1 : -1), lo: null, hi: null, L: state.L, tw: state.tw } }, Q: I3.slice(), invQ: I3.slice() };
  }
  if (which !== 'cut') throw new Error('flips: swap(state, which): which loop?');
  const a = flip(state, 'lo');                                  // there the old cut is 'hi'
  const b = swap(a.state, 'hi').state;                          // its twin is now 'lo'
  const c = flip(b, 'lo');
  const Q = mul(c.Q, a.Q);
  return { state: c.state, Q, invQ: isFlat(state) ? GE.fix(inv(Q), 1) : invH(Q) };
}

/**
 * Loop j of a state by closed form (no frames): { index, slots, L, X, offset }.
 *   hyperbolic: X_j = M cosh(offset_j) + N_(j mod 2), offset_j = (tw + j / 2) L, with ch = cosh(L/2), sh = sinh(L/2),
 *     W(n, m)^2 = ch^2 + 2 cos(pi/n) cos(pi/m) ch + cos^2(pi/n) + cos^2(pi/m) - 1,   M = W(p, q) W(r, s) / sh^2,
 *     N_even = (c_q + c_p ch)(c_s + c_r ch) / sh^2 - c_p c_r,   N_odd = (c_q + c_p ch)(c_r + c_s ch) / sh^2 - c_p c_s.
 *   flat: L_j = | j e1 + e2 | = hypot((2 tw + j) L, 1 / L).
 */
export function neighbour(state, j) {
  const o = state.orders, L = state.L, tw = state.tw, ev = even(j);
  const slots = ev ? [[0, 2], [1, 3]] : [[0, 3], [1, 2]];
  if (isFlat(state)) {
    const len = Math.hypot((2 * tw + j) * L, 1 / L);
    return { index: j, slots, L: len, X: len, offset: (2 * tw + j) * L };
  }
  const [p, q, r, s] = o.map(cosPi), ch = Math.cosh(L / 2), sh = Math.sinh(L / 2);
  const W = (a, b) => Math.sqrt(Math.max(0, ch * ch + 2 * a * b * ch + a * a + b * b - 1));
  const M = (W(p, q) * W(r, s)) / (sh * sh);
  const N = ev ? ((q + p * ch) * (s + r * ch)) / (sh * sh) - p * r : ((q + p * ch) * (r + s * ch)) / (sh * sh) - p * s;
  const off = (tw + j / 2) * L, X = M * Math.cosh(off) + N;
  return { index: j, slots, L: 2 * Math.acosh(Math.max(1, X)), X, offset: off };
}

/** `tri` for the address: "k.lo.hi", an underscore for a number not yet fixed; and back (without a stamp: it is taken as it is). */
export const triText = (tri) => (tri ? [tri.k, tri.lo, tri.hi].map((v) => (Number.isInteger(v) ? String(v) : '_')).join('.') : '');
export function triFrom(text) {
  if (!text) return null;
  const v = String(text).split('.').map((s) => (/^-?\d+$/.test(s) ? parseInt(s, 10) : null));
  return v.length === 3 && v[0] !== null ? { k: v[0], lo: v[1], hi: v[2] } : null;
}
