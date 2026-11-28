// h22222.js — closed-form hyperbolic two-pair coordinates for the 22222 orbifold,
// geometry-preserving local flips across all 15 (2 | 1 | 2) groupings, and fast visible-orbit enumeration.
//
// Hyperboloid model R^{2,1}:
//   point p: <p, p> = p0^2 + p1^2 - p2^2 = -1, p2 > 0
//   line  n: <n, n> = +1 (left normal of oriented geodesic)
// SL(2, R) motions as Lorentz quaternions q = { c, w } with c^2 - <w, w> = 1:
//   half-turn about p:   { c: 0, w: p }
//   slide along n by d:  { c: cosh(d/2), w: sinh(d/2) * n }
//   turn about p by a:   { c: cos(a/2), w: sin(a/2) * p }

export const LABELS = ['A', 'B', 'C', 'D', 'E'];
export const PHI = (1 + Math.sqrt(5)) / 2;
export const D_BAL = Math.acosh(PHI); // 1.0612750619... (golden regular right-angled pentagon edge!)
export const R_MID = Math.acosh(Math.cos(Math.PI / 5) / Math.sin(Math.PI / 5)); // 0.842481776...
export const D_MIN = 0.28;
export const D_MAX = 4.2;
export const BASE_TURNS_PER_SEC = 0.16;

// ---- Lorentz / Minkowski vector helpers ----

export const mdot = (u, v) => u[0] * v[0] + u[1] * v[1] - u[2] * v[2];

export const mcross = (u, v) => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  -(u[0] * v[1] - u[1] * v[0]),
];

export const sc3 = (u, k) => [u[0] * k, u[1] * k, u[2] * k];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function unit(u) {
  const q = mdot(u, u);
  if (q < 0) {
    const k = (u[2] < 0 ? -1 : 1) / Math.sqrt(-q);
    return [u[0] * k, u[1] * k, u[2] * k];
  }
  const k = 1 / Math.sqrt(q || 1e-300);
  return [u[0] * k, u[1] * k, u[2] * k];
}

export function distH(p, q) {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const dz = p[2] - q[2];
  const q2 = dx * dx + dy * dy - dz * dz;
  return q2 > 0 ? 2 * Math.asinh(0.5 * Math.sqrt(q2)) : 0;
}

export function toDisk(p) {
  const inv = 1 / (1 + p[2]);
  return [p[0] * inv, p[1] * inv];
}

export function fromDisk(x, y) {
  const r2 = x * x + y * y;
  const d = Math.max(1e-9, 1 - r2);
  return [(2 * x) / d, (2 * y) / d, (1 + r2) / d];
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const mod = (x, m) => ((x % m) + m) % m;

// ---- SL(2, R) quaternion pairs ----

export const qOne = () => ({ c: 1, w: [0, 0, 0] });

export function qMul(a, b) {
  const aw = a.w, bw = b.w;
  return {
    c: a.c * b.c + aw[0] * bw[0] + aw[1] * bw[1] - aw[2] * bw[2],
    w: [
      a.c * bw[0] + b.c * aw[0] + aw[1] * bw[2] - aw[2] * bw[1],
      a.c * bw[1] + b.c * aw[1] + aw[2] * bw[0] - aw[0] * bw[2],
      a.c * bw[2] + b.c * aw[2] - (aw[0] * bw[1] - aw[1] * bw[0]),
    ],
  };
}

export const qInv = (a) => ({ c: a.c, w: [-a.w[0], -a.w[1], -a.w[2]] });

export function qNorm(q) {
  const w = q.w;
  const n2 = Math.abs(q.c * q.c - (w[0] * w[0] + w[1] * w[1] - w[2] * w[2]));
  const inv = 1 / Math.sqrt(n2 || 1);
  return { c: q.c * inv, w: [w[0] * inv, w[1] * inv, w[2] * inv] };
}

export function qAct(q, v) {
  // q * (0, v) * q^-1, expanded without intermediate allocations
  const c = q.c, wx = q.w[0], wy = q.w[1], wz = q.w[2];
  const vx = v[0], vy = v[1], vz = v[2];
  // t = q * (0, v)
  const tc = wx * vx + wy * vy - wz * vz;
  const tx = c * vx + wy * vz - wz * vy;
  const ty = c * vy + wz * vx - wx * vz;
  const tz = c * vz - (wx * vy - wy * vx);
  // t * (c, -w)
  return [
    tc * (-wx) + c * tx + ty * (-wz) - tz * (-wy),
    tc * (-wy) + c * ty + tz * (-wx) - tx * (-wz),
    tc * (-wz) + c * tz - (tx * (-wy) - ty * (-wx)),
  ];
}

export function qMat(q0) {
  const q = qNorm(q0);
  const a = qAct(q, [1, 0, 0]);
  const b = qAct(q, [0, 1, 0]);
  const c = qAct(q, [0, 0, 1]);
  return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
}

export const qHalfTurn = (p) => ({ c: 0, w: unit(p) });
export const qSlide = (n, d) => {
  const u = unit(n);
  const s = Math.sinh(d / 2);
  return { c: Math.cosh(d / 2), w: [u[0] * s, u[1] * s, u[2] * s] };
};
export const qSlideX = (d) => ({ c: Math.cosh(d / 2), w: [0, Math.sinh(d / 2), 0] });
export const qSlideY = (d) => ({ c: Math.cosh(d / 2), w: [-Math.sinh(d / 2), 0, 0] });
export const qRot0 = (a) => ({ c: Math.cos(a / 2), w: [0, 0, Math.sin(a / 2)] });

/** Pure hyperbolic boost from origin [0, 0, 1] straight to point p (globally smooth on H^2). */
export function qBoost(p) {
  const s = Math.sqrt(Math.max(1e-12, 2 * (p[2] + 1)));
  return { c: s * 0.5, w: [-p[1] / s, p[0] / s, 0] };
}

export const ptOf = (F) => unit(qAct(F, [0, 0, 1]));

// ---- All 15 (2 | 1 | 2) groupings and Petersen line-graph structure ----

export function canonicalGroupingKey(pair1, pivot, pair2) {
  const a = pair1.slice().sort().join('');
  const b = pair2.slice().sort().join('');
  const [p1, p2] = a < b ? [a, b] : [b, a];
  return `${p1}|${pivot}|${p2}`;
}

export function groupingKeyOfState(state) {
  return canonicalGroupingKey(
    [state.labels[0], state.labels[1]],
    state.labels[4],
    [state.labels[2], state.labels[3]]
  );
}

function buildAllGroupings() {
  const list = [];
  const byKey = {};
  for (const pivot of LABELS) {
    const rest = LABELS.filter((l) => l !== pivot);
    const splits = [
      [[rest[0], rest[1]], [rest[2], rest[3]]],
      [[rest[0], rest[2]], [rest[1], rest[3]]],
      [[rest[0], rest[3]], [rest[1], rest[2]]],
    ];
    for (const [p1, p2] of splits) {
      const key = canonicalGroupingKey(p1, pivot, p2);
      const [s1, s2] = key.split('|').filter((_, i) => i !== 1);
      const entry = {
        key,
        pivot,
        pair1: [s1[0], s1[1]],
        pair2: [s2[0], s2[1]],
        neighbors: [], // populated below: 4 direct local-flip neighbors
      };
      list.push(entry);
      byKey[key] = entry;
    }
  }
  // Two groupings are 1 local flip apart iff they share one pair!
  for (const g of list) {
    const k1 = g.pair1.join('');
    const k2 = g.pair2.join('');
    for (const h of list) {
      if (h.key === g.key) continue;
      const h1 = h.pair1.join('');
      const h2 = h.pair2.join('');
      if (k1 === h1 || k1 === h2 || k2 === h1 || k2 === h2) {
        g.neighbors.push(h.key);
      }
    }
  }
  return { list, byKey };
}

const GROUPINGS_DATA = buildAllGroupings();
export const ALL_GROUPINGS = GROUPINGS_DATA.list;
export const GROUPING_BY_KEY = GROUPINGS_DATA.byKey;

/** Shortest sequence of grouping keys from startKey to targetKey via single local flips (length 1..4). */
export function shortestGroupingPath(startKey, targetKey) {
  if (startKey === targetKey) return [startKey];
  const queue = [[startKey]];
  const seen = new Set([startKey]);
  while (queue.length) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    for (const nxt of GROUPING_BY_KEY[cur].neighbors) {
      if (seen.has(nxt)) continue;
      const nextPath = [...path, nxt];
      if (nxt === targetKey) return nextPath;
      seen.add(nxt);
      queue.push(nextPath);
    }
  }
  return [startKey];
}

// ---- Exact closed-form two-pair H^2 coordinates ----

/** Common perpendicular distance delta > 0 between the two pair rails: cosh(delta) = coth(d1) * coth(d2). */
export function deltaOf(d1, d2) {
  const c1 = Math.cosh(d1) / Math.sinh(d1);
  const c2 = Math.cosh(d2) / Math.sinh(d2);
  return Math.acosh(Math.max(1 + 1e-12, c1 * c2));
}

/**
 * Closed-form canonical frames in the rail frame (common perp M along x-axis,
 * Rail 1 at x = -delta/2, Rail 2 at x = +delta/2).
 * Always satisfies R_0 * R_1 * R_2 * R_3 * R_4 = +-I to machine precision.
 */
export function canonicalFrames(d1, d2, t1, t2, dir = 1) {
  const delta = deltaOf(d1, d2);
  const sx1 = qSlideX(-delta * 0.5);
  const sx2 = qSlideX(delta * 0.5);
  const Fa = qNorm(qMul(sx1, qSlideY(t1)));
  const Fb = qNorm(qMul(sx1, qSlideY(t1 + dir * d1)));
  const Fc = qNorm(qMul(sx2, qSlideY(t2)));
  const Fd = qNorm(qMul(sx2, qSlideY(t2 - dir * d2)));
  const T1 = qNorm(qMul(qHalfTurn(ptOf(Fa)), qHalfTurn(ptOf(Fb))));
  const T2 = qNorm(qMul(qHalfTurn(ptOf(Fc)), qHalfTurn(ptOf(Fd))));
  const pe = unit(qMul(T1, T2).w);
  const Fe = qBoost(pe);
  return { delta, frames: [Fa, Fb, Fc, Fd, Fe], pe };
}

/** Build the 5 current world frames W_0..W_4 (matching state.labels[0..4]). */
export function buildWorldFrames(state) {
  const cf = canonicalFrames(state.d1, state.d2, state.t1, state.t2, state.dir);
  const frames = new Array(5);
  for (let i = 0; i < 5; i++) {
    frames[i] = qNorm(qMul(state.worldQ, qMul(cf.frames[i], qRot0(state.angs[i]))));
  }
  return { delta: cf.delta, frames };
}

/** Extract exact intrinsic two-pair parameters from 5 world frames satisfying R_0 R_1 R_2 R_3 R_4 = +-I. */
export function decomposeFrames(labels, W) {
  const pa = ptOf(W[0]);
  const pb = ptOf(W[1]);
  const pc = ptOf(W[2]);
  const pd = ptOf(W[3]);
  const d1 = distH(pa, pb);
  const d2 = distH(pc, pd);
  const n1 = unit(mcross(pa, pb));
  const n2 = unit(mcross(pd, pc));
  let mNorm = unit(mcross(n2, n1));
  const foot1 = unit(mcross(n1, mNorm));
  const foot2 = unit(mcross(n2, mNorm));
  const mid = unit(add3(foot1, foot2));
  let headX = unit(mcross(mNorm, mid));
  if (mdot(foot2, headX) < 0) {
    mNorm = sc3(mNorm, -1);
    headX = sc3(headX, -1);
  }
  const B = qBoost(mid);
  const bx = qAct(B, [1, 0, 0]);
  const by = qAct(B, [0, 1, 0]);
  const alpha = Math.atan2(mdot(headX, by), mdot(headX, bx));
  const worldQ = qNorm(qMul(B, qRot0(alpha)));
  const wInv = qInv(worldQ);
  const delta = deltaOf(d1, d2);
  const paLoc = qAct(qMul(qSlideX(delta * 0.5), wInv), pa);
  const pbLoc = qAct(qMul(qSlideX(delta * 0.5), wInv), pb);
  const pcLoc = qAct(qMul(qSlideX(-delta * 0.5), wInv), pc);
  const dir = pbLoc[1] >= paLoc[1] ? 1 : -1;
  // Normalize t1 mod (2*d1) and t2 mod (2*d2) around 0? Wait: keep exact t1, t2 so W[i] matches exact points!
  const t1 = Math.asinh(paLoc[1]);
  const t2 = Math.asinh(pcLoc[1]);
  const cf = canonicalFrames(d1, d2, t1, t2, dir);
  const angs = new Array(5);
  for (let i = 0; i < 5; i++) {
    const base = qNorm(qMul(worldQ, cf.frames[i]));
    const rel = qNorm(qMul(qInv(base), W[i]));
    angs[i] = 2 * Math.atan2(rel.w[2], rel.c);
  }
  return {
    labels: labels.slice(),
    d1,
    d2,
    t1,
    t2,
    dir,
    angs,
    worldQ,
  };
}

/**
 * Exact 5-fold symmetric (golden balanced) 22222 centered at the Poincaré disk origin:
 * A, B, C, D, E evenly spaced at angles -90, -18, 54, 126, 198 deg, d1 = d2 = delta = arccosh(phi).
 */
export function createBalancedModel({
  activeRail = 0, // 0 = Rail 1, 1 = Rail 2, 2 = Both
  playing = true,
  speed = 1,
  autoBalance = true,
} = {}) {
  const frames = [];
  for (let k = 0; k < 5; k++) {
    const th = (2 * Math.PI * k) / 5 - Math.PI / 2;
    const F = qNorm(qMul(qRot0(th), qSlideX(R_MID)));
    frames.push(F);
  }
  // Verify: R_A R_B R_C R_D R_E = +-I -> labels ['A', 'B', 'C', 'D', 'E'] gives {A,B} | E | {C,D}
  const core = decomposeFrames(['A', 'B', 'C', 'D', 'E'], frames);
  return {
    ...core,
    activeRail,
    playing: !!playing,
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    autoBalance: !!autoBalance,
    // Keep reference base offsets t1Zero, t2Zero so UI twist u in [0, 1) starts cleanly at 0.000
    t1Zero: core.t1,
    t2Zero: core.t2,
    lastPath: [groupingKeyOfState(core)],
    flipCount: 0,
  };
}

/** Swap Rail 1 and Rail 2 cleanly while keeping the exact same group Gamma and frames. */
export function swapRails(state) {
  const { frames: W } = buildWorldFrames(state);
  const L = state.labels;
  const core = decomposeFrames(
    [L[3], L[2], L[1], L[0], L[4]],
    [W[3], W[2], W[1], W[0], W[4]]
  );
  return {
    ...state,
    ...core,
    t1Zero: state.t2Zero,
    t2Zero: state.t1Zero,
  };
}

/**
 * Exact geometry-preserving local flip on Rail 1 (keeps Pair 2 untouched):
 *   keepIdx = 0 -> pairs labels[0] with pivot labels[4]; labels[1] becomes new pivot
 *   keepIdx = 1 -> pairs labels[1] with pivot labels[4]; labels[0] becomes new pivot
 * Always selects the closest copy along Rail 1 to the pivot, yielding the shortest new geodesic!
 */
function flipRail1Core(state, keepIdx) {
  const { frames: W } = buildWorldFrames(state);
  const [Fa, Fb, Fc, Fd, Fe] = W;
  const [la, lb, lc, ld, le] = state.labels;
  const pa = ptOf(Fa);
  const pb = ptOf(Fb);
  const pe = ptOf(Fe);
  const T1 = qNorm(qMul(qHalfTurn(pa), qHalfTurn(pb)));
  const n1 = unit(T1.w);
  const d1 = distH(pa, pb);
  const footE = unit(add3(pe, sc3(n1, -mdot(pe, n1))));
  const base = keepIdx === 0 ? pa : pb;
  const tan = unit(mcross(n1, base));
  const stepSign = mdot(unit(qAct(T1, base)), tan) >= 0 ? 1 : -1;
  const k0 = Math.round((Math.asinh(mdot(footE, tan)) * stepSign) / (2 * d1));
  const T1inv = qInv(T1);
  let Q0 = qOne();
  const stepQ = k0 >= 0 ? T1 : T1inv;
  const steps = Math.min(200, Math.abs(k0));
  for (let i = 0; i < steps; i++) Q0 = qNorm(qMul(stepQ, Q0));
  let best = null;
  let bestD = Infinity;
  for (const dk of [-1, 0, 1]) {
    let Q = Q0;
    if (dk === 1) Q = qNorm(qMul(T1, Q));
    if (dk === -1) Q = qNorm(qMul(T1inv, Q));
    const aF = qNorm(qMul(Q, Fa));
    const bF = qNorm(qMul(Q, Fb));
    const d = distH(ptOf(keepIdx === 0 ? aF : bF), pe);
    if (d < bestD) {
      bestD = d;
      best = [aF, bF];
    }
  }
  const [FaS, FbS] = best;
  let nL, nW;
  if (keepIdx === 0) {
    nL = [la, le, ld, lc, lb];
    nW = [FaS, Fe, Fd, Fc, FbS];
  } else {
    const FaNext = qNorm(qMul(qHalfTurn(ptOf(FbS)), FaS));
    nL = [lb, le, ld, lc, la];
    nW = [FbS, Fe, Fd, Fc, FaNext];
  }
  return decomposeFrames(nL, nW);
}

/**
 * Perform one of the 4 direct local flips from `state` without moving a single pixel of Gamma:
 *   railIdx = 0 (Rail 1): keepIdx 0 pairs labels[0] with pivot, keepIdx 1 pairs labels[1] with pivot
 *   railIdx = 1 (Rail 2): keepIdx 0 pairs labels[2] with pivot, keepIdx 1 pairs labels[3] with pivot
 */
export function applyLocalFlip(state, railIdx, keepIdx, { focusFlippedRail = true } = {}) {
  const prevKey = groupingKeyOfState(state);
  let core;
  if (railIdx === 0) {
    core = flipRail1Core(state, keepIdx);
  } else {
    const swapped = swapRails(state);
    // In swapped state [d, c, b, a, e]: index 0 is old d (labels[3]), index 1 is old c (labels[2])
    const flipped = flipRail1Core(swapped, keepIdx === 0 ? 1 : 0);
    // Swap back so old Pair 1 stays in Rail 1 and new flipped pair sits in Rail 2!
    const { frames: W } = buildWorldFrames(flipped);
    const L = flipped.labels;
    core = decomposeFrames(
      [L[3], L[2], L[1], L[0], L[4]],
      [W[3], W[2], W[1], W[0], W[4]]
    );
  }
  const next = {
    ...state,
    ...core,
    t1Zero: core.t1,
    t2Zero: core.t2,
    activeRail: focusFlippedRail && state.activeRail !== 2 ? railIdx : state.activeRail,
    flipCount: (state.flipCount || 0) + 1,
    lastPath: [prevKey, groupingKeyOfState(core)],
  };
  return next;
}

/** Enumerate the 4 direct local flips available from `state`. */
export function availableLocalFlips(state) {
  const [a, b, c, d, e] = state.labels;
  return [
    {
      railIdx: 0,
      keepIdx: 0,
      keepLabel: a,
      swapOut: b,
      pivot: e,
      fixedPair: [c, d],
      newPair: [a, e],
      targetKey: canonicalGroupingKey([a, e], b, [c, d]),
    },
    {
      railIdx: 0,
      keepIdx: 1,
      keepLabel: b,
      swapOut: a,
      pivot: e,
      fixedPair: [c, d],
      newPair: [b, e],
      targetKey: canonicalGroupingKey([b, e], a, [c, d]),
    },
    {
      railIdx: 1,
      keepIdx: 0,
      keepLabel: c,
      swapOut: d,
      pivot: e,
      fixedPair: [a, b],
      newPair: [c, e],
      targetKey: canonicalGroupingKey([a, b], d, [c, e]),
    },
    {
      railIdx: 1,
      keepIdx: 1,
      keepLabel: d,
      swapOut: c,
      pivot: e,
      fixedPair: [a, b],
      newPair: [d, e],
      targetKey: canonicalGroupingKey([a, b], c, [d, e]),
    },
  ];
}

/**
 * Navigate from `state` to ANY of the 15 groupings via the shortest sequence of 1..3 exact local flips.
 * Preserves Gamma identically (zero jump in the Poincaré disk!).
 */
export function navigateToGrouping(state, targetKey) {
  const startKey = groupingKeyOfState(state);
  if (startKey === targetKey) return { state, path: [startKey] };
  const path = shortestGroupingPath(startKey, targetKey);
  let cur = state;
  let lastRail = state.activeRail;
  for (let step = 1; step < path.length; step++) {
    const want = path[step];
    const flip = availableLocalFlips(cur).find((f) => f.targetKey === want);
    if (!flip) break;
    cur = applyLocalFlip(cur, flip.railIdx, flip.keepIdx, { focusFlippedRail: true });
    lastRail = flip.railIdx;
  }
  cur = {
    ...cur,
    activeRail: state.activeRail === 2 ? 2 : lastRail,
    lastPath: path,
  };
  return { state: cur, path };
}

// ---- Twist phase, continuous animation, and smooth auto-balancing ----

/** Current normalized twist phase u in [0, 1) for rail 0 or rail 1 (1.0 = full period 2*d). */
export function getTwistTurn(state, railIdx = state.activeRail === 1 ? 1 : 0) {
  if (railIdx === 1) {
    return mod((state.t2 - state.t2Zero) / (2 * state.d2), 1);
  }
  return mod((state.t1 - state.t1Zero) / (2 * state.d1), 1);
}

/** Set twist phase u in [0, 1) directly on the active rail(s) without altering lengths. */
export function scrubTwist(state, u) {
  const safeU = mod(Number.isFinite(u) ? u : 0, 1);
  if (state.activeRail === 0) {
    state.t1 = state.t1Zero + safeU * (2 * state.d1);
  } else if (state.activeRail === 1) {
    state.t2 = state.t2Zero + safeU * (2 * state.d2);
  } else {
    state.t1 = state.t1Zero + safeU * (2 * state.d1);
    state.t2 = state.t2Zero + safeU * (2 * state.d2);
  }
  return state;
}

/**
 * Advance the twist animation by `dtSec`.
 * - Animates the chosen rail's twist smoothly at constant turn rate.
 * - When `state.autoBalance` is enabled and lengths differ from `D_BAL` (after a flip),
 *   smoothly relaxes `(d1, d2)` back toward `D_BAL = arccosh(phi)` with zero discontinuity!
 */
export function stepAnim(state, dtSec) {
  const dt = clamp(Number.isFinite(dtSec) ? dtSec : 0, 0, 0.08);
  if (!state.playing || dt === 0) return state;

  const dTurn = dt * BASE_TURNS_PER_SEC * state.speed;
  const u1 = getTwistTurn(state, 0);
  const u2 = getTwistTurn(state, 1);

  const nextU1 = state.activeRail === 0 || state.activeRail === 2 ? mod(u1 + dTurn, 1) : u1;
  const nextU2 = state.activeRail === 1 || state.activeRail === 2 ? mod(u2 + dTurn, 1) : u2;

  if (state.autoBalance) {
    const k = 1 - Math.exp(-dt * 1.45);
    const oldD1 = state.d1;
    const oldD2 = state.d2;
    if (Math.abs(oldD1 - D_BAL) > 1e-4) {
      state.d1 = clamp(oldD1 + (D_BAL - oldD1) * k, D_MIN, D_MAX);
      // Scale t1Zero proportionally so relaxation stays completely smooth
      state.t1Zero *= state.d1 / oldD1;
    } else {
      state.d1 = D_BAL;
    }
    if (Math.abs(oldD2 - D_BAL) > 1e-4) {
      state.d2 = clamp(oldD2 + (D_BAL - oldD2) * k, D_MIN, D_MAX);
      state.t2Zero *= state.d2 / oldD2;
    } else {
      state.d2 = D_BAL;
    }
  }

  state.t1 = state.t1Zero + nextU1 * (2 * state.d1);
  state.t2 = state.t2Zero + nextU2 * (2 * state.d2);
  return state;
}

/** Immediately reset lengths to balanced D_BAL (keeping current grouping and phase). */
export function rebalanceNow(state) {
  const u1 = getTwistTurn(state, 0);
  const u2 = getTwistTurn(state, 1);
  state.t1Zero *= D_BAL / state.d1;
  state.t2Zero *= D_BAL / state.d2;
  state.d1 = D_BAL;
  state.d2 = D_BAL;
  state.t1 = state.t1Zero + u1 * (2 * D_BAL);
  state.t2 = state.t2Zero + u2 * (2 * D_BAL);
  return state;
}

// ---- Fast screen-space orbit & rail enumeration ----

/**
 * Enumerate all visible center copies in screen coordinates (after applying camera `viewQ`).
 * Uses canonical generator wrapping + greedy descent to the screen origin + right-BFS on Gamma,
 * guaranteeing complete coverage of the Poincaré disk even after arbitrary pans or skewed flips.
 */
export function enumerateVisibleOrbit(
  state,
  viewQ = qOne(),
  { rVis = 4.85, maxElems = 2400 } = {}
) {
  // Normalize t1 mod (2*d1) and t2 mod (2*d2) ONLY for generator seeding so the 5 base centers sit near M!
  const t1Wrap = state.t1 - Math.round(state.t1 / (2 * state.d1)) * (2 * state.d1);
  const t2Wrap = state.t2 - Math.round(state.t2 / (2 * state.d2)) * (2 * state.d2);
  const cf = canonicalFrames(state.d1, state.d2, t1Wrap, t2Wrap, state.dir);
  const screenWorld = qNorm(qMul(viewQ, state.worldQ));
  let baseFrames = new Array(5);
  for (let i = 0; i < 5; i++) {
    baseFrames[i] = qNorm(qMul(screenWorld, qMul(cf.frames[i], qRot0(state.angs[i]))));
  }

  // Greedy descent in Gamma so the base patch sits right at the center of the Poincaré disk!
  // Note: replacing baseFrames[i] by g * baseFrames[i] with g in Gamma_screen preserves the exact group & orbits.
  let basePts = baseFrames.map(ptOf);
  let gens = basePts.map(qHalfTurn);
  const sumZ = (pts) => pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2] + pts[4][2];
  let bestSum = sumZ(basePts);
  for (let iter = 0; iter < 30; iter++) {
    let improved = false;
    let bestG = null;
    for (let k = 0; k < 5; k++) {
      const g = gens[k];
      const candPts = basePts.map((p) => unit(qAct(g, p)));
      const s = sumZ(candPts);
      if (s < bestSum - 1e-6) {
        bestSum = s;
        bestG = g;
        improved = true;
      }
    }
    if (!improved) break;
    baseFrames = baseFrames.map((F) => qNorm(qMul(bestG, F)));
    basePts = baseFrames.map(ptOf);
    gens = basePts.map(qHalfTurn);
  }

  // Right-BFS generators: the 5 half-turns (plus T1, T1^-1, T2, T2^-1 for quick traversal along stretched rails)
  const T1 = qNorm(qMul(gens[0], gens[1]));
  const T2 = qNorm(qMul(gens[2], gens[3]));
  const allGens = [gens[0], gens[1], gens[2], gens[3], gens[4], T1, qInv(T1), T2, qInv(T2)];
  const coshVis = Math.cosh(rVis);
  const coshExpand = Math.cosh(rVis + 1.35);

  const byLabel = { A: [], B: [], C: [], D: [], E: [] };
  const seenG = new Set();
  const seenC = new Set();

  const keyG = (q) => {
    const p = qAct(q, [0, 0, 1]);
    const h = qAct(q, [1, 0, 0]);
    const inv = 1 / (1 + p[2]);
    const dx = p[0] * inv;
    const dy = p[1] * inv;
    const denom = (1 + p[2]) * (1 + p[2]);
    const ux = (h[0] * (1 + p[2]) - p[0] * h[2]) / denom;
    const uy = (h[1] * (1 + p[2]) - p[1] * h[2]) / denom;
    const ang = Math.atan2(uy, ux);
    // Compact numeric-string key in [-1, 1] x [-1, 1] x [-pi, pi]
    return `${Math.round(dx * 5000)}|${Math.round(dy * 5000)}|${Math.round(ang * 300)}`;
  };

  const addCopies = (q) => {
    for (let i = 0; i < 5; i++) {
      const F = qNorm(qMul(q, baseFrames[i]));
      const p = qAct(F, [0, 0, 1]);
      if (p[2] > coshVis) continue;
      const inv = 1 / (1 + p[2]);
      const dx = p[0] * inv;
      const dy = p[1] * inv;
      const lbl = state.labels[i];
      const ck = `${lbl}|${Math.round(dx * 2500)}|${Math.round(dy * 2500)}`;
      if (seenC.has(ck)) continue;
      seenC.add(ck);
      byLabel[lbl].push({
        label: lbl,
        F,
        mat: qMat(F),
        p,
        dx,
        dy,
        z: p[2],
      });
    }
  };

  const id = qOne();
  const queue = [id];
  seenG.add(keyG(id));
  addCopies(id);

  let head = 0;
  while (head < queue.length && seenG.size < maxElems) {
    const cur = queue[head++];
    for (let g = 0; g < allGens.length; g++) {
      const nxt = qNorm(qMul(cur, allGens[g]));
      // Keep nxt if ANY of its 5 base centers lies within the expand radius (connected even when skewed!)
      let minZ = Infinity;
      for (let i = 0; i < 5; i++) {
        const z = qAct(nxt, basePts[i])[2];
        if (z < minZ) minZ = z;
      }
      if (minZ > coshExpand) continue;
      const k = keyG(nxt);
      if (seenG.has(k)) continue;
      seenG.add(k);
      addCopies(nxt);
      queue.push(nxt);
    }
  }

  return {
    byLabel,
    basePts,
    baseFrames,
    labels: state.labels,
    groupElems: seenG.size,
  };
}

/** Screen-space geodesic sample points along a hyperbolic line through two points p, q (extended to disk rim). */
export function sampleGeodesicDisk(p, q, steps = 48) {
  const n = unit(mcross(p, q)); // left normal of geodesic
  // Closest point on geodesic to screen origin [0, 0, 1]:
  const o = [0, 0, 1];
  const k = mdot(o, n);
  const foot = unit([o[0] - k * n[0], o[1] - k * n[1], o[2] - k * n[2]]);
  const tan = unit(mcross(n, foot));
  const pts = [];
  const sMax = 5.4;
  for (let i = 0; i <= steps; i++) {
    const s = -sMax + (2 * sMax * i) / steps;
    const cs = Math.cosh(s);
    const sn = Math.sinh(s);
    const x = cs * foot[0] + sn * tan[0];
    const y = cs * foot[1] + sn * tan[1];
    const z = cs * foot[2] + sn * tan[2];
    const inv = 1 / (1 + z);
    pts.push([x * inv, y * inv]);
  }
  return pts;
}

/** Screen-space geodesic segment between two points p and q. */
export function sampleSegmentDisk(p, q, steps = 24) {
  const d = distH(p, q);
  if (d < 1e-6) return [toDisk(p)];
  const n = unit(mcross(p, q));
  const tan = unit(mcross(n, p));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const s = (d * i) / steps;
    const cs = Math.cosh(s);
    const sn = Math.sinh(s);
    const x = cs * p[0] + sn * tan[0];
    const y = cs * p[1] + sn * tan[1];
    const z = cs * p[2] + sn * tan[2];
    const inv = 1 / (1 + z);
    pts.push([x * inv, y * inv]);
  }
  return pts;
}
