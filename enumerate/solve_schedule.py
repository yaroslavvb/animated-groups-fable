#!/usr/bin/env python3
"""Clockwork billiards by CONSTRUCTION: schedule the encounters, then place the kinks.

Strategy D.  The whole method rests on one observation:

    if every path is a POLYLINE whose vertices sit on a time grid of K steps, and
    3 | K, then every clone track is a polyline on the SAME grid -- the offsets
    tau = 0, 1/3, 2/3 are whole numbers of grid steps.  So the relative motion of
    any (ball, clone) pair is EXACTLY linear on each of the K intervals and its
    closest approach over the whole period has a closed form.  Collision testing
    is exact rather than sampled, and costs O(C n^2 K) flops -- a few hundred
    microseconds, with no dependence on the render sample rate S at all.

With an exact detector the encounters are DATA, not something to be discovered by
simulation.  The solver reads the finite list of encounters off the detector and,
for each one, writes down the kink that opens it:

    encounter E:  ball i at time t1  meets  clone (M_a, m) of ball j there,
                  i.e. ball j at t2 = t1 - tau_a, penetrating by delta along the
                  cartesian unit normal n.

    the fix is a rigid pair of demands, half a penetration to each side.  The far
    side is NOT applied here: the same encounter is listed a second time, seen
    from the other partner through the inverse clone (M_a^-1, -M_a^-1 m), and
    that listing carries exactly the opposite demand at time t2.  Applying half a
    penetration to the LEFT index of every listing is therefore automatically the
    both-ends-at-once, Novikov-consistent fix -- the partner's kink in the ball's
    own past is written in the same breath as the kink in its future.  The clone
    window is hexagonal (|m B| <= R), hence closed under the inverse map, so no
    listing is ever orphaned; the cull below is closed under it too, because
    mirror listings carry equal distances.

A demand at time t* is carried by the nearest vertex, divided by that vertex's
hat value there (in [1/2, 1]), so the displacement realised AT t* is exactly the
one asked for -- never the length-weighted sum that makes a push field explode.
Vertices serving several encounters take the weighted least-squares mean of their
demands, not the sum, for the same reason.

Honest caveat.  A single constructive pass does not finish the job: writing a
kink moves the path over the two intervals flanking its vertex, which nudges the
neighbouring encounters.  So the pass is repeated -- with a backtracking scale on
the total squared penetration, which makes it monotone and stops the cycling that
a raw one-shot pass shows.  It is a handful of passes, not a relaxation: the
tiny benchmark converges in ~20 line-searched passes, ~15 ms.

Finally a RETRACTION sweep pulls every vertex back toward its straight line as
far as the exact detector permits.  Vertices that make it all the way back are
exactly collinear again and stop being kinks, so what survives is only the bends
that are actually load-bearing -- genuine bounces.

Requirements honoured
    * starts and integer drifts are PINNED; only interior vertices move, so no
      path is ever slid out of the way as a whole;
    * p_i(t+1) = p_i(t) + L_i exactly, so the animation loops;
    * paths are polylines -- straight between breakpoints, nothing Fourier;
    * rolling a track past the seam costs one lattice vector (that is the
      previous period), which is where the drift enters the clone construction.

Run:  python3 solve_schedule.py            (add --full for the n=5 estimate)
"""

import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from particles_gif import Group                       # noqa: E402  (not modified)


# --------------------------------------------------------------------------- #
#  the tiny benchmark, fixed by the brief
# --------------------------------------------------------------------------- #
TINY = dict(
    gid="g226",
    starts=np.array([[0.15, 0.20], [0.55, 0.35], [0.30, 0.75]]),
    drifts=np.array([[1, 0], [-1, 1], [0, -1]], dtype=float),
    S=72,
    radius=0.075,
    margin=1.05,
)

# a plausible full-size instance: n = 5, S = 180
FULL = dict(
    gid="g226",
    starts=np.array([[0.15, 0.20], [0.55, 0.35], [0.30, 0.75],
                     [0.80, 0.72], [0.05, 0.55]]),
    drifts=np.array([[1, 0], [-1, 1], [0, -1], [1, 1], [-1, 0]], dtype=float),
    S=180,
    radius=0.070,
    margin=1.05,
)


# --------------------------------------------------------------------------- #
#  polyline paths
# --------------------------------------------------------------------------- #
class Paths:
    """n closed polylines in lattice coordinates.

    V : (n, K, 2) vertices at times k/K.  V[:, 0] is pinned to the starts.
    L : (n, 2)    integer drifts;  p(t + 1) = p(t) + L.
    """

    def __init__(self, V, L):
        self.V = np.array(V, dtype=float)
        self.L = np.array(L, dtype=float)
        self.n, self.K = self.V.shape[0], self.V.shape[1]

    def ring(self):
        """vertices with the closing point appended: (n, K+1, 2)."""
        return np.concatenate([self.V, self.V[:, :1] + self.L[:, None, :]], axis=1)

    def at(self, t):
        """positions at arbitrary real times (scalar or (T,)) -> (n, T, 2)."""
        tt = np.atleast_1d(np.asarray(t, dtype=float))
        period = np.floor(tt)
        x = (tt - period) * self.K
        k0 = np.clip(np.floor(x).astype(int), 0, self.K - 1)
        u = (x - k0)[None, :, None]
        R = self.ring()
        return (R[:, k0, :] * (1.0 - u) + R[:, k0 + 1, :] * u
                + self.L[:, None, :] * period[None, :, None])

    def copy(self):
        return Paths(self.V, self.L)


def straight(starts, drifts, K):
    """the un-bent reference: p_i(t) = s_i + t L_i."""
    ks = np.arange(K)[None, :, None] / K
    return Paths(np.asarray(starts, float)[:, None, :]
                 + ks * np.asarray(drifts, float)[:, None, :], drifts)


# --------------------------------------------------------------------------- #
#  the group as an exact, grid-aligned clone machine
# --------------------------------------------------------------------------- #
class Clones:
    """Every clone track, on the vertex grid, in cartesian coordinates."""

    def __init__(self, g, K, R_window):
        if K % 3:
            raise ValueError("K must be divisible by 3 so tau is a whole step")
        self.g, self.K = g, K
        self.ops = sorted(g.ops, key=lambda o: o[2])      # tau = 0, 1/3, 2/3
        # precompute the seam-aware re-index for each op once
        self.gather, self.wrap = [], []
        for a in range(len(self.ops)):
            sh = a * K // 3
            self.gather.append((np.arange(K) - sh) % K)
            self.wrap.append(((np.arange(K) - sh) < 0).astype(float))

        # hexagonal translation window: closed under every M_a, so the listing
        # set is closed under the inverse map and no encounter is orphaned.
        span = int(np.ceil(R_window / np.linalg.norm(g.B, axis=1).min())) + 1
        ms = [np.array([m1, m2], float)
              for m1 in range(-span, span + 1) for m2 in range(-span, span + 1)]
        ms = [m for m in ms if np.linalg.norm(m @ g.B) <= R_window + 1e-9]
        self.op_of = np.array([a for a in range(len(self.ops)) for _ in ms])
        self.m_of = np.array([m for _ in range(len(self.ops)) for m in ms])
        self.total = len(self.op_of)
        self.keep = np.ones(self.total, dtype=bool)
        self._refresh()

    def _refresh(self):
        self.a_k = self.op_of[self.keep]
        self.m_k = self.m_of[self.keep]
        self.C = len(self.a_k)
        self.is_self = (self.a_k == 0) & (np.abs(self.m_k).sum(1) < 1e-9)

    def cull(self, mask):
        self.keep[self.keep] = mask
        self._refresh()

    def tags(self):
        return list(zip(self.a_k.tolist(), self.m_k))

    def tracks(self, P):
        """(C, n, K+1, 2) cartesian clone tracks -- one vectorised shot."""
        per_op = np.empty((len(self.ops), P.n, self.K + 1, 2))
        for a, (M, v, _) in enumerate(self.ops):
            Vs = P.V[:, self.gather[a], :] \
                - P.L[:, None, :] * self.wrap[a][None, :, None]
            Y = Vs @ M.T + v
            per_op[a, :, :self.K] = Y
            per_op[a, :, self.K] = Y[:, 0] + P.L @ M.T
        return (per_op[self.a_k] + self.m_k[:, None, None, :]) @ self.g.B


def closest_approach(P, cl):
    """Exact closest approach of every (ball, clone) pair on every interval.

    D (C, n, n, K) distance, U the parameter in [0, 1] inside the interval,
    N (C, n, n, K, 2) the separation vector (base ball minus clone).
    Exact because both tracks are linear on every interval of the shared grid.
    """
    X = P.ring() @ cl.g.B                                # (n, K+1, 2)
    Y = cl.tracks(P)                                     # (C, n, K+1, 2)
    R = X[None, :, None, :, :] - Y[:, None, :, :, :]     # (C, n, n, K+1, 2)
    A = R[..., :-1, :]
    Bv = R[..., 1:, :] - A
    bb = (Bv * Bv).sum(-1)
    ab = (A * Bv).sum(-1)
    ok = bb > 1e-18
    u = np.clip(np.where(ok, -ab / np.where(ok, bb, 1.0), 0.0), 0.0, 1.0)
    N = A + u[..., None] * Bv
    D = np.sqrt((N * N).sum(-1))
    if cl.is_self.any():                                 # a ball is not its own clone
        eye = np.eye(P.n, dtype=bool)
        D = np.where((cl.is_self[:, None, None] & eye)[..., None], np.inf, D)
    return D, u, N


def penetration(D, target):
    """total squared overlap -- zero exactly when the configuration is legal."""
    over = np.clip(target - D, 0.0, None)
    return float((over * over).sum())


# --------------------------------------------------------------------------- #
#  encounters -> kinks
# --------------------------------------------------------------------------- #
def _cyclic_runs(ks, K):
    ks = sorted(set(int(k) for k in ks))
    groups, cur = [], [ks[0]]
    for a in ks[1:]:
        if a == cur[-1] + 1:
            cur.append(a)
        else:
            groups.append(cur)
            cur = [a]
    groups.append(cur)
    if len(groups) > 1 and groups[0][0] == 0 and groups[-1][-1] == K - 1:
        groups[0] = groups[-1] + groups[0]
        groups.pop()
    return groups


def encounters(D, target):
    """collapse the violating intervals into ONE event per contiguous run."""
    by_pair = {}
    for c, i, j, k in np.argwhere(D < target):
        by_pair.setdefault((int(c), int(i), int(j)), []).append(int(k))
    K = D.shape[3]
    out = []
    for (c, i, j), ks in by_pair.items():
        for run in _cyclic_runs(ks, K):
            out.append((c, i, j, min(run, key=lambda a: D[c, i, j, a])))
    return out


def demand(P, cl, D, U, N, target, eps, share=0.5):
    """Turn the encounter list into one vertex displacement field.

    Each listing asks its LEFT ball to move `share` of the penetration along the
    line of centres AT the encounter time; the mirror listing asks the partner
    for the matching move at t - tau.  A vertex serving several encounters takes
    the weighted least-squares mean of their demands (never the sum), so the
    field cannot blow up where events crowd together.
    """
    K = P.K
    num = np.zeros((P.n, K, 2))
    den = np.zeros((P.n, K))
    ev = encounters(D, target)
    for c, i, j, k in ev:
        d = D[c, i, j, k]
        want = share * (target + eps - d) * (N[c, i, j, k] / max(d, 1e-12))
        u = U[c, i, j, k]
        near, w = (k, 1.0 - u) if u < 0.5 else ((k + 1) % K, u)
        if near == 0:                                    # t = 0 is pinned
            near, w = ((k + 1) % K, u) if u < 0.5 else (k, 1.0 - u)
            if near == 0 or w < 1e-6:
                continue
        num[i, near] += w * want                         # w * (want / w) * w
        den[i, near] += w * w
    good = den > 1e-12
    step = np.zeros_like(num)
    step[good] = num[good] / den[good, None]
    step[:, 0] = 0.0                                     # the starts are pinned
    return step @ cl.g.Binv, len(ev)


def _clamped(P, base, step, scale, cap, B):
    """apply a scaled step and keep the construction local (cap from the line)."""
    Q = P.copy()
    Q.V = base + np.clip(P.V + scale * step - base, -np.inf, np.inf)
    off = Q.V - base
    mag = np.linalg.norm(off @ B, axis=2, keepdims=True)
    Q.V = base + off * np.minimum(1.0, cap / np.maximum(mag, 1e-12))
    return Q


def schedule(P, cl, target, eps, cap, share=0.5, passes=60,
             ladder=(1.6, 1.0, 0.65, 0.4, 0.25, 0.15, 0.08)):
    """Write the kinks, monotonically.  Returns (converged, passes used)."""
    base = straight(P.V[:, 0], P.L, P.K).V
    B = cl.g.B
    D, U, N = closest_approach(P, cl)
    phi = penetration(D, target)
    for p in range(passes):
        if phi <= 0.0:
            return True, p
        step, _ = demand(P, cl, D, U, N, target, eps, share)
        best = None
        for scale in ladder:
            Q = _clamped(P, base, step, scale, cap, B)
            Dq, Uq, Nq = closest_approach(Q, cl)
            pq = penetration(Dq, target)
            if best is None or pq < best[0]:
                best = (pq, Q, Dq, Uq, Nq)
            if pq < phi:
                break
        if best[0] >= phi:                              # no scale helps: stuck
            return False, p
        phi, P.V[:], D, U, N = best[0], best[1].V, best[2], best[3], best[4]
    return phi <= 0.0, passes


def _offsets(P, base, B):
    off = np.linalg.norm((P.V - base) @ B, axis=2)
    off[:, 0] = 0.0                                      # the starts are pinned
    return off


def retract(P, cl, target, rounds=4, ladder=(0.7, 0.45, 0.25)):
    """Straighten the construction back down to the bends that earn their keep.

    Two different jobs, and the order matters.  DELETING a kink needs a vertex to
    return exactly to its line, so those attempts go CHEAPEST FIRST -- a greedy
    sweep that starts with the largest excursions spends the whole clearance
    budget shrinking one big swerve and then cannot zero any of the small ones,
    which leaves a kink at nearly every vertex.  Only once no further vertex can
    be zeroed is the leftover slack spent shrinking what remains, which is
    cosmetic: those vertices are kinks either way.
    """
    base = straight(P.V[:, 0], P.L, P.K).V
    B = cl.g.B
    for _ in range(rounds):                              # zero whatever will zero
        off = _offsets(P, base, B)
        order = np.argsort(off, axis=None)
        order = order[off.ravel()[order] > 1e-12]
        killed = False
        for flat in order:
            i, k = int(flat) // P.K, int(flat) % P.K
            keep = P.V[i, k].copy()
            P.V[i, k] = base[i, k]
            if closest_approach(P, cl)[0].min() >= target:
                killed = True
            else:
                P.V[i, k] = keep
        if not killed:
            break
    for beta in ladder:                                  # then shrink the rest
        Q = P.copy()
        Q.V = P.V + beta * (base - P.V)
        if closest_approach(Q, cl)[0].min() >= target:
            P.V[:] = Q.V
            break
    return P


# --------------------------------------------------------------------------- #
#  measurement -- deliberately independent of the machinery above
# --------------------------------------------------------------------------- #
def orbit(g, P, t, span):
    """every ball in the plane at global time t: cartesian points + ball index."""
    pts, idx = [], []
    for M, v, tau in g.ops:
        p = P.at(t - tau)[:, 0, :]              # the TRUE path: drift included
        q = p @ M.T + v
        for m1 in range(-span, span + 1):
            for m2 in range(-span, span + 1):
                pts.append((q + np.array([m1, m2], float)) @ g.B)
                idx.append(np.arange(P.n))
    return np.vstack(pts), np.concatenate(idx)


def symmetry_residual(g, P, span=5, keep_r=1.2, samples=16):
    """Turn the orbit at t by the tau = 1/3 generator; it must BE the orbit at
    t + 1/3, ball index by ball index.  Scored only well inside the window."""
    Mg = vg = None
    for M, v, tau in g.ops:
        if abs(tau - 1.0 / 3.0) < 1e-9:
            Mg, vg = M, v
    if Mg is None:
        return float("nan")
    worst = 0.0
    for s in range(samples):
        t = s / samples
        p0, i0 = orbit(g, P, t, span)
        p1, i1 = orbit(g, P, t + 1.0 / 3.0, span)
        turned = ((p0 @ g.Binv) @ Mg.T + vg) @ g.B
        inside = np.linalg.norm(turned, axis=1) < keep_r
        for b in range(P.n):
            sel = inside & (i0 == b)
            if not sel.any():
                continue
            tgt = p1[i1 == b]
            d = np.linalg.norm(turned[sel][:, None, :] - tgt[None, :, :], axis=2)
            worst = max(worst, float(d.min(axis=1).max()))
    return worst


def true_clearance(g, P):
    """Exact minimum centre distance over the whole loop, wide clone window."""
    reach = np.linalg.norm(P.ring() @ g.B, axis=2).max()
    cl = Clones(g, P.K, 2.0 * reach + 1.0)
    return float(closest_approach(P, cl)[0].min())


def heading_stats(g, P, S, tol=1e-6):
    """fraction of sample steps whose heading equals the previous step's."""
    p = P.at(np.arange(S + 1) / S) @ g.B                 # (n, S+1, 2)
    step = p[:, 1:, :] - p[:, :-1, :]
    h = step / np.maximum(np.linalg.norm(step, axis=2, keepdims=True), 1e-15)
    same = np.linalg.norm(h - np.roll(h, 1, axis=1), axis=2) < tol
    return float(same.mean()), float((~same).sum()) / P.n


# --------------------------------------------------------------------------- #
#  the solver
# --------------------------------------------------------------------------- #
def solve(gid, starts, drifts, K, radius, margin, cap=0.45, eps_frac=0.18,
          share=0.5, passes=60, headroom=1.12, do_retract=True):
    """Construct the schedule, then straighten it back.

    `headroom` overshoots the required clearance during construction so that the
    retraction sweep has slack to spend: without it the solution sits exactly on
    the constraint boundary and no vertex can return to its line, which leaves a
    kink at every vertex instead of only at the genuine bounces.
    """
    g = Group(gid)
    starts, drifts = np.asarray(starts, float), np.asarray(drifts, float)
    target = 2.0 * radius * margin
    P = straight(starts, drifts, K)

    # window wide enough that nothing outside can ever be reached, given that
    # the construction never moves a vertex further than `cap` from its line
    reach = np.linalg.norm(P.ring() @ g.B, axis=2).max() + cap
    cl = Clones(g, K, 2.0 * reach + target)

    # cull: a clone further than target + 2*cap from every straight track can
    # never be reached once displacements are capped.  Rigorous, not heuristic.
    D, _, _ = closest_approach(P, cl)
    cl.cull(D.min(axis=(1, 2, 3)) <= target * headroom + 2.0 * cap + 1e-9)

    build = target * headroom
    converged, used = schedule(P, cl, build, eps_frac * build, cap, share, passes)
    if not converged:                      # fall back to the bare requirement
        converged, extra = schedule(P, cl, target, eps_frac * target, cap,
                                    share, passes)
        used += extra
    if converged and do_retract:
        retract(P, cl, target)
    return g, P, cl, converged, used


def _report(spec, K, verbose, **kw):
    t0 = time.time()
    g, P, cl, converged, used = solve(spec["gid"], spec["starts"], spec["drifts"],
                                      K, spec["radius"], spec["margin"], **kw)
    runtime = time.time() - t0
    clear = true_clearance(g, P)
    frac, kinks = heading_stats(g, P, spec["S"])
    out = dict(
        runtime_sec=round(runtime, 4),
        min_clearance_ratio=round(clear / (2.0 * spec["radius"]), 6),
        symmetry_residual=symmetry_residual(g, P),
        kinks_per_ball=round(kinks, 4),
        straight_fraction=round(frac, 6),
        converged=bool(converged and clear >= 2.0 * spec["radius"]),
    )
    if verbose:
        print(f"  K = {K} vertices, {int(cl.keep.sum())} of {cl.total} clones kept,"
              f" {used} construction passes")
        print(f"  min centre distance {clear:.5f}"
              f"   (diameter {2 * spec['radius']:.5f},"
              f" target {2 * spec['radius'] * spec['margin']:.5f})")
    return out, (g, P)


def solve_tiny(K=12, verbose=False, **kw):
    return _report(TINY, K, verbose, **kw)[0]


def solve_full(K=18, verbose=False, **kw):
    return _report(FULL, K, verbose, **kw)[0]


if __name__ == "__main__":
    print(solve_tiny(verbose=True))
    if "--full" in sys.argv:
        print(solve_full(verbose=True))
