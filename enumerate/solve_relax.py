#!/usr/bin/env python3
"""Self-consistent polyline solver for clockwork groups (strategy A: relaxation).

Balls travel in STRAIGHT LINES and bounce.  Each ball i owns a closed polyline

    p_i(t + 1) = p_i(t) + L_i          L_i an integer lattice vector,

pinned at t = 0 to its given start.  The bounces are collisions with the
time-shifted rotated copies of the whole cloud, so they cannot be simulated
forwards -- deflecting ball i at time t must deflect its partner at t - tau,
which is already in the past.  The entire periodic trajectory is therefore
relaxed at once, as descent on the penalty energy

    E = 1/2 sum over (clone c, balls i j, segment s) of (d_min - dist)_+^2

with the polyline breakpoints as the only degrees of freedom.  Breakpoint 0 of
every ball is frozen: the solver may BEND a path but never slide it aside.

Differences from the earlier relaxation, which took a minute and did not
converge:

  * the push accumulated on a breakpoint is a weighted MEAN over its hat
    function, not a sum.  (Summing is the true gradient, but its scale grows
    with the length of the segment, so long segments took enormous steps and
    short ones none; the mean is the Jacobi-preconditioned gradient and one
    step of it very nearly resolves the encounter that caused it.)
  * clones are culled to those that ever come near a base path, recomputed
    whenever a breakpoint is added.  ~150 clones drop to ~20.
  * the closest approach is computed in CONTINUOUS time -- exactly, per pair of
    segments, since both endpoints move linearly between samples -- so a fast
    pair cannot slip through between two samples.  The push is applied at the
    instant of closest approach and split over the two flanking samples.
  * the step is scaled by an adaptive gain with monotone-energy backtracking,
    so a round never has to be tuned by hand.
  * kinks are earned: a new breakpoint is added only at a local minimum of the
    clearance that is still violated, and at the end every breakpoint whose
    removal does NOT re-open a collision is deleted again.

Public entry point: solve_tiny().
"""

import math
import time

import numpy as np

from particles_gif import Group

TINY = 1e-15


# --------------------------------------------------------------------------
# the trajectory representation
# --------------------------------------------------------------------------
class Paths:
    """n closed polylines in lattice coordinates, sampled on S grid points.

    Ball i is at V[i][k] at sample B[i][k] and travels straight to the next
    breakpoint; after B[i][-1] it runs to V[i][0] + L[i] at sample S.  The
    sampling is linear in the breakpoints,

        X[i] = Phi[i] @ V[i] + const[i],

    which makes both the rasterisation and the projection of a per-sample push
    field onto the breakpoints a single matrix product.
    """

    def __init__(self, starts, drifts, S):
        self.S = int(S)
        self.n = len(starts)
        self.L = np.array(drifts, dtype=float)
        self.start = np.array(starts, dtype=float)
        self.B = [[0] for _ in range(self.n)]
        self.V = [self.start[i:i + 1].copy() for i in range(self.n)]
        self._operators()
        self.rasterize()

    # -- linear algebra of the polyline -----------------------------------
    def _operators(self):
        S = self.S
        self.Phi, self.const, self.mass = [], [], []
        for i in range(self.n):
            b = self.B[i]
            m = len(b)
            Phi = np.zeros((S, m))
            const = np.zeros((S, 2))
            edges = list(b) + [S]
            for k in range(m):
                lo, hi = edges[k], edges[k + 1]
                s = np.arange(lo, hi)
                a = (s - lo) / float(hi - lo)
                Phi[s, k] += 1.0 - a
                Phi[s, (k + 1) % m] += a
                if k == m - 1:                    # the closing segment drifts
                    const[s] += a[:, None] * self.L[i]
            self.Phi.append(Phi)
            self.const.append(const)
            self.mass.append(Phi.sum(axis=0))
        self.m = [len(b) for b in self.B]

    def rasterize(self):
        X = np.empty((self.n, self.S, 2))
        for i in range(self.n):
            X[i] = self.Phi[i] @ self.V[i] + self.const[i]
        self.X = X

    def trial(self, push_lat, gain, cap):
        """breakpoints moved by the hat-weighted MEAN of the push field."""
        out = []
        for i in range(self.n):
            d = (self.Phi[i].T @ push_lat[i]) / self.mass[i][:, None] * gain
            d[0] = 0.0                            # the start is pinned
            nrm = np.linalg.norm(d, axis=1, keepdims=True)
            out.append(self.V[i] + d * np.minimum(1.0, cap / np.maximum(nrm, TINY)))
        return out

    def set_V(self, V):
        self.V = [v.copy() for v in V]
        self.rasterize()

    # -- editing the breakpoint set ---------------------------------------
    def insert(self, i, s, min_sep):
        b = self.B[i]
        if s <= 0 or s >= self.S:
            return False
        if min(abs(s - x) for x in list(b) + [self.S]) < min_sep:
            return False
        k = int(np.searchsorted(b, s))
        self.B[i] = b[:k] + [int(s)] + b[k:]
        self.V[i] = np.insert(self.V[i], k, self.X[i, s, :], axis=0)
        self._operators()
        self.rasterize()
        return True

    def drop(self, i, k):
        self.B[i] = self.B[i][:k] + self.B[i][k + 1:]
        self.V[i] = np.delete(self.V[i], k, axis=0)
        self._operators()
        self.rasterize()

    # -- readout -----------------------------------------------------------
    def extended(self):
        """samples 0..S inclusive; sample S is sample 0 of the next period."""
        return np.concatenate([self.X, self.X[:, :1, :] + self.L[:, None, :]],
                              axis=1)

    def at(self, theta):
        """positions at any real internal time (exact: the path is linear)."""
        w = math.floor(theta)
        x = (theta - w) * self.S
        i0 = int(math.floor(x)) % self.S
        i1 = (i0 + 1) % self.S
        a = x - math.floor(x)
        p0 = self.X[:, i0, :]
        p1 = self.X[:, i1, :] + (self.L if i1 == 0 else 0.0)
        return p0 * (1 - a) + p1 * a + self.L * w

    def headings(self):
        Xe = self.extended()
        h = Xe[:, 1:, :] - Xe[:, :-1, :]
        return h / np.maximum(np.linalg.norm(h, axis=2, keepdims=True), TINY)


# --------------------------------------------------------------------------
# clones and the encounter field
# --------------------------------------------------------------------------
def clone_list(g, S, span):
    """(M, v, k) with k = tau * S an exact integer number of samples."""
    out = []
    for M, v, tau in g.clones(span):
        k = int(round(tau * S)) % S
        if abs(tau * S - round(tau * S)) > 1e-9:
            raise ValueError("S must be a multiple of the clock order")
        out.append((M, v, k))
    return out


def identity_index(clones):
    for c, (M, v, k) in enumerate(clones):
        if k == 0 and not v.any() and np.allclose(M, np.eye(2)):
            return c
    return None


def _shift_index(S, k, cache):
    """sample s of a clone shows the motif at sample s-k of the base path;
    crossing the seam costs one drift, because that is the previous period."""
    if k not in cache:
        idx = np.arange(S + 1) - k
        sh = np.where(idx < 0, -1.0, np.where(idx >= S, 1.0, 0.0))
        cache[k] = (idx % S, sh)
    return cache[k]


def group_by_shift(g, clones):
    """clones sorted into the (only three) distinct time shifts.

    A clone maps a lattice row y to (y M^T + v) B = y (M^T B) + v B, so all the
    clones sharing a time shift are one einsum over a stack of 2x2 maps."""
    order, groups = [], []
    for k in sorted({c[2] for c in clones}):
        idx = [c for c, cl in enumerate(clones) if cl[2] == k]
        A = np.array([clones[c][0].T @ g.B for c in idx])       # (m,2,2)
        t = np.array([clones[c][1] @ g.B for c in idx])         # (m,2)
        order.extend(idx)
        groups.append((k, A, t))
    return groups, np.argsort(np.array(order))


def clone_stack(g, paths, groups, unsort, cache):
    """(C, n, S+1, 2) cartesian positions of every clone at every sample."""
    S, X, L = paths.S, paths.X, paths.L
    out = []
    for k, A, t in groups:
        im, sh = _shift_index(S, k, cache)
        Y = X[:, im, :] + sh[None, :, None] * L[:, None, :]     # (n,S+1,2)
        q = np.matmul(Y.reshape(1, -1, 2), A) + t[:, None, :]   # (m, n*(S+1), 2)
        out.append(q.reshape(len(A), paths.n, S + 1, 2))
    return np.concatenate(out, axis=0)[unsort]


class Pairs:
    """the (clone, ball, ball) triples the solver still has to watch.

    Culling at the level of whole clones (fact 5) is not tight enough: most of
    the surviving clones are near only ONE of the balls.  The working set is
    therefore a list of triples (c, i, j) -- ball i against ball j inside clone
    c -- which turns the inner loop from (C, n, n, S) into (T, S) with T an
    order of magnitude smaller.  The set is closed under inversion, because
    dist(i, c(j)) = dist(c^-1(i), j), which keeps the push field equal and
    opposite on the two partners of every encounter.
    """

    def __init__(self, g, clones, ci, ii, ji):
        self.clones = clones
        self.groups, self.unsort = group_by_shift(g, clones)
        self.ci = np.asarray(ci, dtype=np.intp)
        self.ii = np.asarray(ii, dtype=np.intp)
        self.ji = np.asarray(ji, dtype=np.intp)
        self.T = self.ci.size

    def __len__(self):
        return self.T


def triple_minima(g, paths, clones, cache, chunk=48):
    """(C, n, n) smallest sampled separation of ball i from ball j of clone c."""
    n, S = paths.n, paths.S
    base = paths.extended() @ g.B
    out = np.empty((len(clones), n, n))
    for c0 in range(0, len(clones), chunk):
        sub = clones[c0:c0 + chunk]
        groups, unsort = group_by_shift(g, sub)
        allp = clone_stack(g, paths, groups, unsort, cache)
        d = base[None, :, None, :, :] - allp[:, None, :, :, :]
        out[c0:c0 + chunk] = np.sqrt((d * d).sum(axis=4)).min(axis=3)
    c = identity_index(clones)
    if c is not None:
        ii = np.arange(n)
        out[c, ii, ii] = np.inf                         # a ball is not its own clone
    return out


def select(g, paths, clones, thresh, cache):
    """the working set: every triple that comes within `thresh` right now."""
    tm = triple_minima(g, paths, clones, cache)
    ci, ii, ji = np.nonzero(tm < thresh)
    used = sorted(set(ci.tolist()))
    remap = {c: k for k, c in enumerate(used)}
    return Pairs(g, [clones[c] for c in used],
                 [remap[c] for c in ci.tolist()], ii, ji)


def all_pairs(g, paths, clones):
    """every triple, for the final unculled verification."""
    n = paths.n
    self_c = identity_index(clones)
    ci, ii, ji = [], [], []
    for c in range(len(clones)):
        for i in range(n):
            for j in range(n):
                if c == self_c and i == j:
                    continue
                ci.append(c)
                ii.append(i)
                ji.append(j)
    return Pairs(g, clones, ci, ii, ji)


class Field:
    """Everything the relaxation needs about the current configuration."""

    __slots__ = ("worst", "energy", "push", "near")

    def __init__(self, worst, energy, push, near):
        self.worst, self.energy, self.push, self.near = worst, energy, push, near


def encounters(g, paths, ps, d_min, cache, want_push=True, full=False):
    """exact continuous-time closest approach of the base paths to the orbit.

    Between two samples both the ball and the clone move linearly, so the
    separation is affine in the sub-interval and its minimum is closed form.
    The restoring push is applied at that instant and split over the two
    flanking samples -- by the envelope theorem this is the exact gradient of
    the penalty, because the instant of closest approach is itself a minimum.
    """
    n, S = paths.n, paths.S
    base = paths.extended() @ g.B                       # (n, S+1, 2)
    if ps.T == 0:
        return Field(np.inf, 0.0, np.zeros((n, S, 2)), np.full((n, S), np.inf))
    allp = clone_stack(g, paths, ps.groups, ps.unsort, cache)   # (C,n,S+1,2)
    diff = base[ps.ii] - allp[ps.ci, ps.ji]             # (T, S+1, 2)
    d2 = (diff * diff).sum(axis=2)                      # (T, S+1) at samples

    # A segment can only dip below d_min if one of its ends is already within
    # d_min + |D|, and |D| is at most twice the largest step taken in a sample
    # interval.  Everything else is far away and is never looked at again.
    step = np.linalg.norm(base[:, 1:, :] - base[:, :-1, :], axis=2).max()
    lim = (d_min + 2.0 * step) ** 2
    ends = np.minimum(d2[:, :S], d2[:, 1:])
    hot = np.ones_like(ends, dtype=bool) if full else (ends < lim)
    ti, si = np.nonzero(hot)

    A = diff[ti, si, :]
    D = diff[ti, si + 1, :] - A
    dd = (D * D).sum(axis=1)
    u = np.clip(-(A * D).sum(axis=1) / np.maximum(dd, TINY), 0.0, 1.0)
    w = A + u[:, None] * D
    dist = np.sqrt((w * w).sum(axis=1))

    seg = np.sqrt(ends)                                 # endpoint lower bound
    seg[hot] = dist                                     # exact where it matters
    worst = float(seg.min())
    near = np.full((n, S), np.inf)
    np.minimum.at(near, ps.ii, seg)                     # (n, S) per segment

    over = np.maximum(d_min - dist, 0.0)
    energy = 0.5 * float((over * over).sum())
    push = None
    if want_push:
        f = (over / np.maximum(dist, TINY))[:, None] * w
        pf = np.zeros((n, S + 1, 2))
        bi = ps.ii[ti]
        np.add.at(pf, (bi, si), (1.0 - u)[:, None] * f)
        np.add.at(pf, (bi, si + 1), u[:, None] * f)
        pc = pf[:, :S, :]
        pc[:, 0, :] += pf[:, S, :]                      # sample S is sample 0
        push = pc @ g.Binv
    return Field(worst, energy, push, near)


# --------------------------------------------------------------------------
# the solver
# --------------------------------------------------------------------------
def sample_clearance(near):
    """clearance at a sample = the smaller of its two flanking segments."""
    return np.minimum(near, np.roll(near, 1, axis=1))


def worst_spots(prof, d_min, existing, S, min_sep, limit):
    """local minima of the clearance profile that are still violated."""
    lo = np.roll(prof, 1)
    hi = np.roll(prof, -1)
    cand = np.where((prof < d_min) & (prof <= lo) & (prof <= hi))[0]
    if cand.size == 0:
        cand = np.array([int(np.argmin(prof))]) if prof.min() < d_min else cand
    cand = cand[np.argsort(prof[cand])]
    out, taken = [], list(existing) + [S]
    for s in cand:
        s = int(s)
        if s <= 0 or s >= S:
            continue
        if min(abs(s - x) for x in taken) < min_sep:
            continue
        out.append(s)
        taken.append(s)
        if len(out) >= limit:
            break
    return out


def solve(g, paths, clones_all, d_min, phases=14, rounds=90, gain0=1.0,
          min_sep=None, add_per_phase=2, slack=0.55, verbose=False):
    """relax to d_min, alternating pushes with earning a new breakpoint.

    The push vanishes exactly at contact, so the fixed point of the descent is
    dist = d_min approached from below; the caller therefore hands in a target
    a hair wider than the clearance it actually wants.
    """
    S = paths.S
    if min_sep is None:
        min_sep = max(3, S // 20)
    cache = {}
    cap = 0.40 * d_min
    tol = 1e-6 * d_min                            # contact is only approached
    ps = select(g, paths, clones_all, d_min + slack, cache)
    f = encounters(g, paths, ps, d_min, cache)
    gain = gain0
    for phase in range(phases):
        stall = 0
        for _ in range(rounds):
            if f.worst >= d_min - tol:
                break
            V = paths.V
            paths.set_V(paths.trial(f.push, gain, cap))
            f2 = encounters(g, paths, ps, d_min, cache)
            if f2.energy <= f.energy:
                gained = (f.energy - f2.energy) / max(f.energy, TINY)
                f = f2
                gain = min(gain * 1.15, 6.0)
                stall = stall + 1 if gained < 2e-3 else 0
            else:
                paths.set_V(V)
                gain *= 0.5
                stall += 1
            if stall >= 10 or gain < 1e-3:
                break
        if f.worst >= d_min - tol:
            if verbose:
                print(f"  phase {phase}: cleared, worst {f.worst:.5f}, "
                      f"{sum(paths.m)} breakpoints")
            return f, True, phase
        prof = sample_clearance(f.near)
        added = 0
        for i in range(paths.n):
            for s in worst_spots(prof[i], d_min, paths.B[i], S, min_sep,
                                 add_per_phase):
                added += paths.insert(i, s, min_sep)
        if verbose:
            print(f"  phase {phase}: worst {f.worst:.5f} E {f.energy:.3e} "
                  f"+{added} kinks -> {sum(paths.m)} total")
        if added == 0:                            # no room left for new kinks
            if min_sep > 2:
                min_sep -= 1
                continue
            break
        ps = select(g, paths, clones_all, d_min + slack, cache)
        gain = gain0
        f = encounters(g, paths, ps, d_min, cache)
    f = encounters(g, paths, all_pairs(g, paths, clones_all), d_min, cache,
                   want_push=False, full=True)
    return f, f.worst >= d_min - tol, phases


def prune(g, paths, clones_all, d_min, tol=0.0, cache=None):
    """delete every kink that is not load bearing.

    A breakpoint survives only if straightening the path through it re-opens a
    collision, so the kinks that are left are exactly the bounces.  Tested
    against a generously selected working set; the caller verifies the result
    against every clone afterwards.
    """
    cache = {} if cache is None else cache
    ps = select(g, paths, clones_all, d_min + 0.9, cache)
    removed = 0
    for i in range(paths.n):
        k = 1
        while k < len(paths.B[i]):
            keepB, keepV = list(paths.B[i]), paths.V[i].copy()
            paths.drop(i, k)
            f = encounters(g, paths, ps, d_min, cache, want_push=False)
            if f.worst >= d_min - tol:
                removed += 1
                continue                          # k now indexes the next one
            paths.B[i], paths.V[i] = keepB, keepV
            paths._operators()
            paths.rasterize()
            k += 1
    return removed


# --------------------------------------------------------------------------
# measurements
# --------------------------------------------------------------------------
def check_symmetry(g, paths, shift, span=4, radius_keep=1.0, frames=16):
    """turning a frame by the generator must reproduce the frame `shift` later.

    The orbit is built on a wide window and only turned points well inside it
    are scored, because a finite window is not carried to itself by a rotation.
    """
    M = v = None
    for Mo, vo, tau in g.ops:
        if abs(tau - shift) < 1e-9:
            M, v = Mo, vo
    if M is None:
        return float("nan")
    wide = g.clones(span)
    lump = []
    for tau in sorted({tau for _, _, tau in wide}):
        sel = [c for c in wide if c[2] == tau]
        lump.append((tau, np.array([c[0].T @ g.B for c in sel]),
                     np.array([c[1] @ g.B for c in sel])))

    def orbit(t):
        """(C, n, 2) cartesian: ball j of clone c, indexed by ball on axis 1"""
        out = [np.matmul(paths.at(t - tau)[None], A) + tv[:, None, :]
               for tau, A, tv in lump]
        return np.concatenate(out, axis=0)

    worst = 0.0
    for s in range(frames):
        t = s / frames
        p0, p1 = orbit(t), orbit(t + shift)
        turned = (g.lat(p0) @ M.T + v) @ g.B                 # (C, n, 2)
        keep = np.linalg.norm(turned, axis=2) < radius_keep
        for bi in range(paths.n):
            sel = turned[:, bi, :][keep[:, bi]]
            if not sel.size:
                continue
            d = np.linalg.norm(p1[None, :, bi, :] - sel[:, None, :], axis=2)
            worst = max(worst, float(d.min(axis=1).max()))
    return worst


def straightness(paths, tol=1e-6):
    """fraction of sample steps whose heading equals the previous one."""
    h = paths.headings()                              # (n, S, 2)
    d = np.linalg.norm(h - np.roll(h, 1, axis=1), axis=2)
    same = d < tol
    kinks = (~same).sum(axis=1)
    return float(same.mean()), float(kinks.mean())


def verify(g, paths, clones_all, radius):
    """exact continuous-time closest approach against EVERY clone, unculled."""
    f = encounters(g, paths, all_pairs(g, paths, clones_all), 0.0, {},
                   want_push=False, full=True)
    return f.worst, f.worst / (2 * radius)


# --------------------------------------------------------------------------
# the benchmark
# --------------------------------------------------------------------------
TINY_STARTS = [[0.15, 0.20], [0.55, 0.35], [0.30, 0.75]]
TINY_DRIFTS = [[1, 0], [-1, 1], [0, -1]]


def run(gid="g226", starts=TINY_STARTS, drifts=TINY_DRIFTS, S=72, radius=0.075,
        margin=1.05, span=3, verbose=False, **kw):
    t0 = time.time()
    g = Group(gid)
    clones = clone_list(g, S, span)
    paths = Paths(starts, drifts, S)
    d_min = 2 * radius * margin
    d_solve = d_min * (1 + 1e-3)
    f, ok, phase = solve(g, paths, clones, d_solve, verbose=verbose, **kw)
    prune(g, paths, clones, d_solve, tol=1e-6 * d_solve)
    worst, ratio = verify(g, paths, clones, radius)
    ok = worst >= d_min
    runtime = time.time() - t0

    shift = min((tau for _, _, tau in g.ops if tau > 1e-9), default=0.0)
    frac, kinks = straightness(paths)
    res = check_symmetry(g, paths, shift)
    out = dict(runtime_sec=round(runtime, 3),
               min_clearance_ratio=round(ratio, 6),
               symmetry_residual=res,
               kinks_per_ball=round(kinks, 3),
               straight_fraction=round(frac, 6),
               converged=bool(ok))
    if verbose:
        out["_paths"] = paths
        out["_group"] = g
        out["_d_min"] = d_min
        out["_worst"] = worst
        out["_phase"] = phase
    return out


def solve_tiny(verbose=False):
    """the tiny benchmark: g226, 3 balls, S = 72, radius 0.075, margin 1.05."""
    return run(verbose=verbose)


if __name__ == "__main__":
    print(solve_tiny())
