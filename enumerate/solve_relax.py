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
    short ones none; the mean is the Jacobi-preconditioned gradient, and one
    step of it very nearly resolves the encounter that caused it.  This alone
    is the difference between diverging and converging.)
  * the working set is culled to the (clone, ball, ball) TRIPLES that come
    anywhere near each other, not merely to the nearby clones: at n = 5 that
    is ~150 clones x 25 ball pairs = 3675 candidate encounters cut to ~150.
    It is rebuilt whenever a breakpoint is added.
  * the closest approach is computed in CONTINUOUS time -- exactly, per pair of
    segments, since both endpoints move linearly between samples -- so a fast
    pair cannot slip through between two samples.  The push is applied at the
    instant of closest approach and split over the two flanking samples.
  * the step is scaled by an adaptive gain with monotone-energy backtracking,
    so no round has to be tuned by hand.
  * the push aims a few percent WIDER than the clearance required and stops as
    soon as the requirement itself is met.  The penalty's fixed point is exact
    contact approached from below, so demanding it exactly costs an unbounded
    number of rounds; this was most of the old runtime.
  * kinks are earned: a new breakpoint is added only at a local minimum of the
    clearance that is still violated, and at the end every breakpoint whose
    removal does NOT re-open a collision is deleted again.

Public entry point: solve_tiny().  run() takes any (group, starts, drifts, S,
radius) and is what the full-size problem should call.
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

    Two bits of bookkeeping earn their keep in the inner loop:
      * the triples are ordered by their base ball, so the per-ball clearance
        profile is a reduction over contiguous blocks rather than a scatter;
      * only the distinct (clone, ball) SLOTS that some triple refers to are
        ever transformed, grouped by time shift so each group is one batched
        2x2 matmul.
    """

    def __init__(self, g, paths, clones, ci, ii, ji):
        n = paths.n
        ci = np.asarray(ci, dtype=np.intp)
        ii = np.asarray(ii, dtype=np.intp)
        ji = np.asarray(ji, dtype=np.intp)
        order = np.argsort(ii, kind="stable")
        self.ci, self.ii, self.ji = ci[order], ii[order], ji[order]
        self.T = self.ci.size
        self.clones = clones
        self.block = np.searchsorted(self.ii, np.arange(n + 1))   # per-ball runs

        key = self.ci * n + self.ji                      # the distinct slots
        uniq, inv = np.unique(key, return_inverse=True)
        shifts = np.array([clones[c][2] for c in (uniq // n)])
        srt = np.argsort(shifts, kind="stable")          # slots grouped by shift
        rank = np.empty_like(srt)
        rank[srt] = np.arange(srt.size)
        self.slot = rank[inv]
        uc, uj = (uniq // n)[srt], (uniq % n)[srt]
        self.nslot = uniq.size
        # how much a clone can stretch a cartesian displacement: exactly 1 for
        # a point-group rotation, but measured rather than assumed, because the
        # collision filter's validity rests on it.
        self.stretch = max(np.linalg.svd(g.Binv @ c[0].T @ g.B, compute_uv=False)[0]
                           for c in clones) if clones else 1.0
        self.groups = []
        a = 0
        for k in sorted(set(shifts.tolist())):
            b = a + int((shifts[srt] == k).sum())
            self.groups.append((k, slice(a, b), uj[a:b].copy(),
                                np.array([clones[c][0].T @ g.B for c in uc[a:b]]),
                                np.array([clones[c][1] @ g.B for c in uc[a:b]])))
            a = b

    def __len__(self):
        return self.T

    def slots(self, paths, cache):
        """(nslot, S+1, 2) cartesian: ball j inside clone c, at every sample."""
        S, X, L = paths.S, paths.X, paths.L
        out = np.empty((self.nslot, S + 1, 2))
        for k, sl, js, A, t in self.groups:
            im, sh = _shift_index(S, k, cache)
            Y = X[:, im, :] + sh[None, :, None] * L[:, None, :]   # (n,S+1,2)
            out[sl] = np.matmul(Y[js], A) + t[:, None, :]
        return out


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
    return Pairs(g, paths, [clones[c] for c in used],
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
    return Pairs(g, paths, clones, ci, ii, ji)


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
    diff = base[ps.ii] - ps.slots(paths, cache)[ps.slot]        # (T, S+1, 2)
    d2 = (diff * diff).sum(axis=2)                      # (T, S+1) at samples

    # A segment [s, s+1] can only dip below d_min if one of its ends is already
    # within d_min + |D|/2 of it, where D is the change in separation across
    # the interval, and |D| is at most the largest step the ball takes plus the
    # largest step its clone takes -- the latter bounded by the clone's stretch
    # factor, so the filter stays valid even for a group whose matrices are not
    # cartesian isometries.  Everything colder is far away and is dropped.
    d = base[:, 1:, :] - base[:, :-1, :]
    step = math.sqrt(float((d * d).sum(axis=2).max()))
    lim = (d_min + 0.5 * (1.0 + ps.stretch) * step) ** 2
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
    near = np.empty((n, S))                             # per ball, per segment
    for i in range(n):
        a, b = ps.block[i], ps.block[i + 1]
        near[i] = seg[a:b].min(axis=0) if b > a else np.inf

    over = np.maximum(d_min - dist, 0.0)
    energy = 0.5 * float((over * over).sum())
    push = None
    if want_push:
        f = (over / np.maximum(dist, TINY))[:, None] * w
        # scatter the two endpoint shares of every push in one pass; bincount
        # is an order of magnitude faster than the unbuffered ufunc.at
        base_i = ps.ii[ti] * (S + 1) + si
        idx = np.concatenate([base_i, base_i + 1])
        wgt = np.concatenate([1.0 - u, u])[:, None] * np.concatenate([f, f])
        size = n * (S + 1)
        pf = np.stack([np.bincount(idx, wgt[:, 0], size),
                       np.bincount(idx, wgt[:, 1], size)], axis=1)
        pf = pf.reshape(n, S + 1, 2)
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


def solve(g, paths, clones_all, need, aim=1.03, phases=16, rounds=90,
          gain0=1.0, min_sep=None, add_per_phase=2, slack=0.55, verbose=False):
    """relax, alternating pushes with earning a new breakpoint.

    The push vanishes exactly at contact, so the fixed point of the descent is
    dist = target approached from BELOW, and insisting on reaching it exactly
    costs an unbounded number of rounds.  Instead the push aims a few percent
    wider than the clearance that is actually required and the relaxation stops
    the moment the requirement itself is met -- which happens after a couple of
    rounds of the linear convergence rather than dozens.
    """
    S = paths.S
    target = need * aim
    if min_sep is None:
        min_sep = max(3, S // 20)
    cache = {}
    cap = 0.40 * target
    ps = select(g, paths, clones_all, target + slack, cache)
    f = encounters(g, paths, ps, target, cache)
    gain = gain0
    for phase in range(phases):
        stall = 0
        for _ in range(rounds):
            if f.worst >= need:
                break
            V = paths.V
            paths.set_V(paths.trial(f.push, gain, cap))
            f2 = encounters(g, paths, ps, target, cache)
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
        if f.worst >= need:
            if verbose:
                print(f"  phase {phase}: cleared, worst {f.worst:.5f}, "
                      f"{sum(paths.m)} breakpoints")
            return f, True, phase
        prof = sample_clearance(f.near)
        added = 0
        for i in range(paths.n):
            for s in worst_spots(prof[i], target, paths.B[i], S, min_sep,
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
        ps = select(g, paths, clones_all, target + slack, cache)
        gain = gain0
        f = encounters(g, paths, ps, target, cache)
    f = encounters(g, paths, all_pairs(g, paths, clones_all), need, cache,
                   want_push=False, full=True)
    return f, f.worst >= need, phases


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


def frozen_clearance(g, starts, clones):
    """the part of the problem the solver cannot touch.

    At t = 0 every ball sits on its pinned start, and so does every clone whose
    time shift is zero.  Those separations are fixed by the caller's choice of
    starts: if one of them is below d_min the instance is infeasible however
    the paths are bent, and no solver should be blamed for it."""
    s = np.array(starts, dtype=float)
    worst = np.inf
    for M, v, k in clones:
        if k:
            continue
        q = (s @ M.T + v) @ g.B
        d = np.linalg.norm((s @ g.B)[:, None, :] - q[None, :, :], axis=2)
        d[d < 1e-9] = np.inf
        worst = min(worst, float(d.min()))
    return worst


# --------------------------------------------------------------------------
# the benchmark
# --------------------------------------------------------------------------
TINY_STARTS = [[0.15, 0.20], [0.55, 0.35], [0.30, 0.75]]
TINY_DRIFTS = [[1, 0], [-1, 1], [0, -1]]


def run(gid="g226", starts=TINY_STARTS, drifts=TINY_DRIFTS, S=72, radius=0.075,
        margin=1.05, span=3, verbose=False, **kw):
    """solve one instance and measure it.

    min_clearance_ratio is the smallest centre-to-centre distance anywhere in
    the plane at any instant, in ball diameters, measured in continuous time
    against every clone in the window -- so >= 1 means the balls never touch.
    """
    t0 = time.time()
    g = Group(gid)
    clones = clone_list(g, S, span)
    paths = Paths(starts, drifts, S)
    d_min = 2 * radius * margin
    frozen = frozen_clearance(g, starts, clones)
    if frozen < d_min and verbose:
        print(f"  WARNING: the pinned starts are only {frozen:.4f} apart at "
              f"t = 0, below d_min = {d_min:.4f}; no bending can fix that")
    # The relaxation and the pruning both work against a culled working set, so
    # their verdict is only as good as the culling.  The verification is against
    # every clone and every pair; if it ever disagrees, the working set missed
    # something and the solver is restarted from the current paths with a fresh
    # one.  (In practice this never fires -- the selection slack is wide -- but
    # it is what makes the reported clearance an honest number.)
    phase = 0
    for attempt in range(3):
        _, ok, phase = solve(g, paths, clones, d_min, verbose=verbose, **kw)
        prune(g, paths, clones, d_min)
        worst, ratio = verify(g, paths, clones, radius)
        if worst >= d_min or not ok:
            break
        if verbose:
            print(f"  culling artifact ({worst:.5f} < {d_min:.5f}), restarting")
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
        out["_frozen"] = frozen
    return out


def solve_tiny(verbose=False):
    """the tiny benchmark: g226, 3 balls, S = 72, radius 0.075, margin 1.05."""
    return run(verbose=verbose)


def solve_full(seed=0, n=5, S=180, radius=0.07, margin=1.05, verbose=False):
    """the full-size problem, on random pinned starts and drifts.

    The starts are only DRAWN here; the solver never moves them.  They are
    rejection-sampled so that the frozen t = 0 configuration is feasible --
    otherwise the instance is impossible however the paths are bent.
    """
    import random
    g = Group("g226")
    rng = random.Random(seed)
    gap = 2 * radius * margin * 1.15
    starts = []
    for _ in range(20000):
        if len(starts) == n:
            break
        c = np.array([rng.random(), rng.random()])
        m = np.array([[a, b] for a in (-1, 0, 1) for b in (-1, 0, 1)], float)
        if all(np.linalg.norm((c - np.array(s) - m) @ g.B, axis=1).min() >= gap
               for s in starts):
            starts.append(list(c))
    pick = [(1, 0), (0, 1), (1, 1), (-1, 1), (1, -1), (-1, 0), (0, -1)]
    drifts = [list(rng.choice(pick)) for _ in range(n)]
    return run(starts=starts, drifts=drifts, S=S, radius=radius,
               margin=margin, verbose=verbose)


if __name__ == "__main__":
    print(solve_tiny())
