#!/usr/bin/env python3
"""Clockwork billiards by CONSTRUCTION: schedule the encounters, then place the kinks.

Strategy D.  Nothing here is a relaxation with a learning rate.  The whole method
rests on one observation:

    if every path is a POLYLINE whose vertices sit on a time grid of K steps, and
    K is divisible by 3, then every clone track is also a polyline on the SAME
    grid (the time offsets tau = 0, 1/3, 2/3 are whole numbers of grid steps).
    So the relative motion of any pair (ball, clone) is EXACTLY linear on each of
    the K intervals, and the closest approach of the pair over the whole period
    has a closed form.  Collision detection is exact, not sampled, and costs
    O(C n^2 K) flops -- microseconds.

With an exact detector the encounters are data, not something to be discovered by
simulation.  One pass therefore reads off the finite list of encounters, and for
each one writes down the displacement that opens it:

    encounter E:  ball i at time t1  meets  clone (M_a, m) of ball j  at time t1,
                  i.e. ball j at t2 = t1 - tau_a, penetrating by delta along the
                  cartesian unit normal n.

    the fix is a rigid pair of demands, delta/2 to each side.  The demand on the
    far side is NOT applied here: the same encounter is listed a second time,
    seen from the other partner through the inverse clone (M_a^-1, -M_a^-1 m),
    and that listing carries exactly the opposite demand.  Applying half a
    penetration to the LEFT index of every listing is therefore automatically the
    consistent, Novikov-style, both-ends-at-once fix -- the partner's kink at
    t - tau is placed in the same breath as the kink at t.  The clone window is
    chosen hexagonally (|m B| <= R) so it is closed under the inverse map and no
    listing is ever orphaned.

A demand at time t* is carried by the nearest vertex, divided by that vertex's hat
value at t* (in [1/2, 1]), so the displacement realised at t* is exactly the one
asked for.  t = 0 is pinned (the starts are given), so a demand landing there is
redirected to its neighbour.

Two or three such passes suffice -- a pass changes the geometry, which moves the
encounters a little, but never re-creates them.  Then a RETRACTION sweep pulls
every vertex back toward the straight line as far as the exact detector allows,
which deletes every kink that was not needed and leaves only genuine bounces.

Requirements honoured
    * starts and integer drifts are PINNED; only the interior vertices move, so
      no path is ever slid out of the way as a whole;
    * p_i(t+1) = p_i(t) + L_i exactly, so the animation loops;
    * paths are polylines -- straight between breakpoints, no Fourier anything;
    * rolling a track past the seam costs one lattice vector (the previous
      period), which is where the drift enters the clone construction.

Run:  python3 solve_schedule.py
"""

import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from particles_gif import Group                       # noqa: E402  (no edits made)


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


# --------------------------------------------------------------------------- #
#  polyline paths
# --------------------------------------------------------------------------- #
class Paths:
    """n closed polylines in lattice coordinates.

    V : (n, K, 2) vertices at times k/K.  V[:, 0] is pinned to the starts.
    L : (n, 2)    integer drifts;  p(t + 1) = p(t) + L.
    """

    def __init__(self, V, L):
        self.V = np.asarray(V, dtype=float)
        self.L = np.asarray(L, dtype=float)
        self.n, self.K = self.V.shape[0], self.V.shape[1]

    # vertices with the closing point appended: (n, K+1, 2)
    def ring(self):
        return np.concatenate([self.V, self.V[:, :1] + self.L[:, None, :]], axis=1)

    def at(self, t):
        """positions at arbitrary real times t (scalar or (T,)) -> (n, T, 2)."""
        tt = np.atleast_1d(np.asarray(t, dtype=float))
        period = np.floor(tt)
        x = (tt - period) * self.K
        k0 = np.clip(np.floor(x).astype(int), 0, self.K - 1)
        u = (x - k0)[None, :, None]
        R = self.ring()
        p = R[:, k0, :] * (1.0 - u) + R[:, k0 + 1, :] * u
        return p + self.L[:, None, :] * period[None, :, None]


def straight(starts, drifts, K):
    ks = np.arange(K)[None, :, None] / K
    return Paths(starts[:, None, :] + ks * drifts[:, None, :], drifts)


# --------------------------------------------------------------------------- #
#  the group as an exact, grid-aligned clone machine
# --------------------------------------------------------------------------- #
class Clones:
    """Every clone track, on the vertex grid, in cartesian coordinates.

    ops are sorted by tau so op a has tau = a/3 and a shift of a*K/3 vertices.
    """

    def __init__(self, g, K, R_window):
        assert K % 3 == 0, "K must be divisible by 3 so tau is a whole grid step"
        self.g, self.K = g, K
        self.ops = sorted(g.ops, key=lambda o: o[2])
        self.Minv = [np.linalg.inv(M) for M, _, _ in self.ops]

        # hexagonally symmetric translation window: closed under every M_a, so
        # the list of (ball, clone) listings is closed under the inverse map.
        span = int(np.ceil(R_window / min(np.linalg.norm(g.B, axis=1)))) + 1
        ms = []
        for m1 in range(-span, span + 1):
            for m2 in range(-span, span + 1):
                m = np.array([m1, m2], dtype=float)
                if np.linalg.norm(m @ g.B) <= R_window + 1e-9:
                    ms.append(m)
        self.tags = [(a, m) for a in range(len(self.ops)) for m in ms]
        self.keep = np.ones(len(self.tags), dtype=bool)

    def tracks(self, P):
        """(C, n, K+1, 2) cartesian clone tracks for the kept clones."""
        K, g = self.K, self.g
        per_op = []
        for a, (M, v, _) in enumerate(self.ops):
            sh = a * K // 3
            idx = (np.arange(K) - sh) % K
            wrap = ((np.arange(K) - sh) < 0).astype(float)      # crossed the seam
            Vs = P.V[:, idx, :] - P.L[:, None, :] * wrap[None, :, None]
            Y = Vs @ M.T + v
            Y = np.concatenate([Y, Y[:, :1] + (P.L @ M.T)[:, None, :]], axis=1)
            per_op.append(Y)
        out = [(per_op[a] + m) @ g.B
               for (a, m), k in zip(self.tags, self.keep) if k]
        return np.stack(out)

    def kept_tags(self):
        return [t for t, k in zip(self.tags, self.keep) if k]

    def self_pairs(self):
        """indices c of the identity clone at m = 0 (a ball vs itself)."""
        return [c for c, (a, m) in enumerate(self.kept_tags())
                if a == 0 and abs(m[0]) < 1e-9 and abs(m[1]) < 1e-9]


def closest_approach(P, cl):
    """Exact closest approach of every (ball, clone) pair on every interval.

    Returns D (C, n, n, K)   distance,
            U (C, n, n, K)   parameter in [0, 1] inside the interval,
            N (C, n, n, K, 2) separation vector, base ball minus clone.
    """
    X = P.ring() @ cl.g.B                                # (n, K+1, 2)
    Y = cl.tracks(P)                                     # (C, n, K+1, 2)
    R = X[None, :, None, :, :] - Y[:, None, :, :, :]     # (C, n, n, K+1, 2)
    A = R[..., :-1, :]
    Bv = R[..., 1:, :] - A
    bb = (Bv * Bv).sum(-1)
    ab = (A * Bv).sum(-1)
    safe = np.where(bb > 1e-18, bb, 1.0)
    u = np.clip(np.where(bb > 1e-18, -ab / safe, 0.0), 0.0, 1.0)
    N = A + u[..., None] * Bv
    D = np.sqrt((N * N).sum(-1))
    for c in cl.self_pairs():                            # a ball is not its own clone
        for i in range(P.n):
            D[c, i, i, :] = np.inf
    return D, u, N


# --------------------------------------------------------------------------- #
#  encounters -> vertex demands
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
    """collapse the violating intervals into one event per contiguous run."""
    hits = np.argwhere(D < target)
    by_pair = {}
    for c, i, j, k in hits:
        by_pair.setdefault((int(c), int(i), int(j)), []).append(int(k))
    K = D.shape[3]
    ev = []
    for (c, i, j), ks in by_pair.items():
        for run in _cyclic_runs(ks, K):
            k = min(run, key=lambda a: D[c, i, j, a])
            ev.append((c, i, j, k))
    return ev


def place_kinks(P, cl, D, U, N, target, eps, cap):
    """One constructive pass: read the encounters, write down the kinks.

    Each listing contributes half of its penetration to the LEFT ball only; the
    mirror listing (the same encounter through the inverse clone) supplies the
    other half to the other ball.  Both halves are written in the same pass, so
    the fix is simultaneous in the ball's own past and future.
    """
    K, Binv = P.K, cl.g.Binv
    dem = np.zeros_like(P.V)
    ev = encounters(D, target)
    for c, i, j, k in ev:
        d = D[c, i, j, k]
        nhat = N[c, i, j, k] / max(d, 1e-12)             # clone -> ball i, cartesian
        push = 0.5 * (target + eps - d) * nhat
        u = U[c, i, j, k]
        # nearest vertex carries it, divided by its hat value at the event time
        near, w = (k, 1.0 - u) if u < 0.5 else ((k + 1) % K, u)
        if near == 0:                                    # t = 0 is pinned
            near, w = ((k + 1) % K, u) if u < 0.5 else (k, 1.0 - u)
            if near == 0:
                continue
        dem[i, near] += (push / max(w, 0.25)) @ Binv
    P.V[:, 1:] += dem[:, 1:]
    # keep the construction local: never wander more than `cap` from the line
    base = straight(P.V[:, 0], P.L, K).V
    off = P.V - base
    mag = np.linalg.norm(off @ cl.g.B, axis=2, keepdims=True)
    P.V[:] = base + off * np.minimum(1.0, cap / np.maximum(mag, 1e-12))
    return len(ev)


def retract(P, cl, target, sweeps=2,
            ladder=(1.0, 0.85, 0.7, 0.55, 0.4, 0.25, 0.12)):
    """Pull every vertex back toward the straight line as far as it will go.

    A vertex that reaches beta = 1 sits exactly on the line again and stops being
    a kink, so this is what turns "displaced everywhere" into "a few bounces".
    """
    base = straight(P.V[:, 0], P.L, P.K).V
    for _ in range(sweeps):
        for i in range(P.n):
            for k in range(1, P.K):
                cur = P.V[i, k].copy()
                if np.allclose(cur, base[i, k], atol=1e-12):
                    continue
                for beta in ladder:
                    P.V[i, k] = cur + beta * (base[i, k] - cur)
                    D, _, _ = closest_approach(P, cl)
                    if D.min() >= target:
                        break
                    P.V[i, k] = cur
    return P


# --------------------------------------------------------------------------- #
#  measurement -- deliberately independent of the machinery above
# --------------------------------------------------------------------------- #
def orbit(g, P, t, span):
    """every ball in the plane at global time t: cartesian points + ball index."""
    pts, idx = [], []
    for M, v, tau in g.ops:
        p = P.at(t - tau)[:, 0, :]                       # true path, drift included
        q = p @ M.T + v
        for m1 in range(-span, span + 1):
            for m2 in range(-span, span + 1):
                pts.append((q + np.array([m1, m2], dtype=float)) @ g.B)
                idx.append(np.arange(P.n))
    return np.vstack(pts), np.concatenate(idx)


def symmetry_residual(g, P, span=5, keep_r=1.2, samples=16):
    """Turn the orbit at t by the tau = 1/3 generator; it must be the orbit at
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


def true_clearance(g, P, R_window=None):
    """Exact minimum centre distance over the whole loop, wide clone window."""
    reach = np.linalg.norm(P.ring() @ g.B, axis=2).max()
    R = R_window if R_window is not None else 2.0 * reach + 0.5
    cl = Clones(g, P.K, R)
    D, _, _ = closest_approach(P, cl)
    return float(D.min())


def heading_stats(g, P, S, tol=1e-6):
    """fraction of sample steps whose heading equals the previous step's."""
    t = np.arange(S + 1) / S
    p = P.at(t) @ g.B                                    # (n, S+1, 2)
    step = p[:, 1:, :] - p[:, :-1, :]                    # (n, S, 2)
    h = step / np.maximum(np.linalg.norm(step, axis=2, keepdims=True), 1e-15)
    same = np.linalg.norm(h - np.roll(h, 1, axis=1), axis=2) < tol
    return float(same.mean()), float((~same).sum()) / P.n


# --------------------------------------------------------------------------- #
#  the solver
# --------------------------------------------------------------------------- #
def solve(gid, starts, drifts, K, radius, margin,
          passes=8, cap=0.32, eps_frac=0.10, do_retract=True):
    g = Group(gid)
    starts = np.asarray(starts, dtype=float)
    drifts = np.asarray(drifts, dtype=float)
    target = 2.0 * radius * margin
    eps = eps_frac * target

    P = straight(starts, drifts, K)

    # clone window: wide enough that nothing outside can ever be reached, given
    # that the construction never moves a vertex further than `cap` from the line
    reach = np.linalg.norm(P.ring() @ g.B, axis=2).max() + cap
    cl = Clones(g, K, 2.0 * reach + target)

    # cull: a clone that stays further than target + 2*cap from every straight
    # track can never be reached once displacements are capped at `cap`.
    D, U, N = closest_approach(P, cl)
    floor = D.min(axis=(1, 2, 3))
    cl.keep[cl.keep] = floor <= target + 2.0 * cap + 1e-9
    D, U, N = closest_approach(P, cl)

    n_events, converged = 0, D.min() >= target
    for _ in range(passes):
        if converged:
            break
        n_events = place_kinks(P, cl, D, U, N, target, eps, cap)
        D, U, N = closest_approach(P, cl)
        converged = D.min() >= target

    if converged and do_retract:
        retract(P, cl, target)

    return g, P, cl, converged, n_events


def solve_tiny(K=12, verbose=False):
    t0 = time.time()
    g, P, cl, converged, n_ev = solve(
        TINY["gid"], TINY["starts"], TINY["drifts"], K,
        TINY["radius"], TINY["margin"])
    runtime = time.time() - t0

    clear = true_clearance(g, P)
    frac, kinks = heading_stats(g, P, TINY["S"])
    res = symmetry_residual(g, P)
    out = dict(
        runtime_sec=round(runtime, 4),
        min_clearance_ratio=round(clear / (2.0 * TINY["radius"]), 6),
        symmetry_residual=res,
        kinks_per_ball=round(kinks, 4),
        straight_fraction=round(frac, 6),
        converged=bool(converged and clear >= 2.0 * TINY["radius"]),
    )
    if verbose:
        print(f"  encounters closed in the last pass : {n_ev}")
        print(f"  clones kept                        : {int(cl.keep.sum())}"
              f" of {len(cl.tags)}")
        print(f"  min centre distance                : {clear:.5f}"
              f"  (diameter {2 * TINY['radius']:.5f},"
              f" target {2 * TINY['radius'] * TINY['margin']:.5f})")
    return out


if __name__ == "__main__":
    print(solve_tiny(verbose=True))
