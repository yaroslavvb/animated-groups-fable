#!/usr/bin/env python3
"""Baseline solver: hat-projected relaxation of closed polylines.

Kept as the reference the other strategies are measured against. The idea is
the simplest thing that can work: shove the paths apart wherever a ball is too
close to a clone, but apply the shove to the BREAKPOINTS as a proper weighted
mean over each breakpoint's hat function, not as a sum over the segment. The
sum was the bug in the first attempt -- displacement then scaled with segment
length, so the solver made wild excursions and never settled.

Start positions and drifts are pinned: the solver may only bend a path. Left
free to slide, it "solves" every encounter by moving balls out of each other's
way, and no collision ever happens.
"""

import time

import numpy as np

from particles_gif import Group
import render_balls as R


def hat_matrix(edges, S):
    """(S, m) weights and the wrap ramp: X(s) = Phi[s] @ V + wL[s] * L.

    The last segment runs to V_0 + L, so its far endpoint contributes to column
    0 AND carries one lattice vector -- that is the wrap ramp."""
    m = len(edges) - 1
    Phi = np.zeros((S, m))
    wL = np.zeros(S)
    for k in range(m):
        lo, hi = edges[k], edges[k + 1]
        s = np.arange(lo, hi)
        w = (s - lo) / max(hi - lo, 1)
        Phi[s, k] += 1 - w
        Phi[s, (k + 1) % m] += w
        if k == m - 1:
            wL[s] = w
    return Phi, wL


class Paths:
    """closed polylines, with the hat operators cached (they change only when
    a breakpoint is added, not on every relaxation step)"""

    def __init__(self, starts, drifts, S):
        self.S = S
        self.L = np.array(drifts, dtype=float)
        self.B = [[0] for _ in starts]
        self.V = [np.array([s], dtype=float) for s in starts]
        self.refresh()

    def refresh(self):
        self.ops = [hat_matrix(b + [self.S], self.S) for b in self.B]

    def X(self):
        n = len(self.B)
        out = np.empty((n, self.S, 2))
        for i, (Phi, wL) in enumerate(self.ops):
            out[i] = Phi @ self.V[i] + wL[:, None] * self.L[i]
        return out

    def add_kink(self, i, s, X, min_sep):
        if s <= 0 or min(abs(s - b) for b in self.B[i] + [self.S]) < min_sep:
            return False
        k = int(np.searchsorted(self.B[i], s))
        self.B[i].insert(k, s)
        self.V[i] = np.insert(self.V[i], k, X[i, s, :], axis=0)
        self.refresh()
        return True


def clone_groups(g, clones):
    """clones batched by time shift: there are only as many shifts as beats"""
    by_k = {}
    for M, v, k in clones:
        by_k.setdefault(k, []).append((np.asarray(M, dtype=float),
                                       np.asarray(v, dtype=float)))
    return [(k, np.array([m for m, _ in lst]), np.array([w for _, w in lst]))
            for k, lst in by_k.items()]


def stack(g, X, L, groups):
    """(C, n, S, 2) cartesian clone positions, three einsums instead of C"""
    parts = []
    for k, Ms, vs in groups:
        Y = R.shifted(X, L, k)
        P = np.einsum("mab,nsb->mnsa", Ms, Y) + vs[:, None, None, :]
        parts.append(P @ g.B)
    return np.concatenate(parts, axis=0)


def solve(g, starts, drifts, radius, S=72, margin=1.05, span=3,
          phases=8, rounds=40, gain=1.0, min_sep=6, cull=0.45):
    paths = Paths(starts, drifts, S)
    L = paths.L
    d_min = 2 * radius * margin
    groups = clone_groups(g, R.integer_clones(g, span, S))

    def probe():
        X = paths.X()
        allp = stack(g, X, L, groups)
        base = X @ g.B
        diff = base[None, :, None, :, :] - allp[:, None, :, :, :]
        dist = np.linalg.norm(diff, axis=4)
        dist[dist < 1e-9] = np.inf
        return X, dist, diff

    # drop clones that can never reach: a large constant factor
    X, dist, _ = probe()
    live = []
    off = 0
    for k, Ms, vs in groups:
        keepM, keepv = [], []
        for j in range(len(Ms)):
            if dist[off + j].min() < d_min + cull:
                keepM.append(Ms[j]); keepv.append(vs[j])
        off += len(Ms)
        if keepM:
            live.append((k, np.array(keepM), np.array(keepv)))
    groups = live

    for phase in range(phases):
        for _ in range(rounds):
            X, dist, diff = probe()
            if dist.min() >= d_min:
                break
            over = np.maximum(d_min - dist, 0.0)
            unit = diff / np.maximum(dist, 1e-9)[..., None]
            f = (unit * over[..., None]).sum(axis=(0, 2))      # (n, S, 2) cart
            for i in range(len(paths.B)):
                Phi, _ = paths.ops[i]
                num = Phi.T @ (f[i] @ g.Binv)
                den = Phi.sum(axis=0)[:, None]
                step = num / np.maximum(den, 1e-9) * gain
                paths.V[i][1:] += step[1:]                     # 0 stays pinned
        X, dist, _ = probe()
        if dist.min() >= d_min:
            return paths.B, [list(v) for v in paths.V], L, phase, True
        near = dist.min(axis=(0, 2))
        for i in range(len(paths.B)):
            paths.add_kink(i, int(np.argmin(near[i])), X, min_sep)
    X, dist, _ = probe()
    return (paths.B, [list(v) for v in paths.V], L, phases,
            bool(dist.min() >= 2 * radius))


def seed_starts(g, n, d_min, rng, span=2, tries=40000):
    """start positions that are already collision-free at t = 0.

    Necessary once the balls are large: the starts are pinned, so a violation
    at t = 0 is one no amount of bending can ever repair."""
    clones = [(np.asarray(M, float), np.asarray(v, float))
              for M, v, _ in g.clones(span)]
    seeds = []
    for _ in range(tries):
        if len(seeds) == n:
            break
        cand = np.array([rng.random(), rng.random()])
        trial = np.array(seeds + [cand])
        cc = cand @ g.B
        ok = True
        for M, v in clones:
            q = (trial @ M.T + v) @ g.B
            d = np.linalg.norm(q - cc, axis=1)
            d[d < 1e-9] = np.inf
            if d.min() < d_min:
                ok = False
                break
        if ok:
            seeds.append(cand)
    if len(seeds) < n:
        raise RuntimeError(f"could only place {len(seeds)}/{n} balls at {d_min:.3f}")
    return [list(s) for s in seeds]


TINY = dict(starts=[[0.15, 0.20], [0.55, 0.35], [0.30, 0.75]],
            drifts=[[1, 0], [-1, 1], [0, -1]], radius=0.075, S=72, margin=1.05)


def solve_tiny():
    g = Group("g226")
    t0 = time.time()
    B, V, L, phase, ok = solve(g, TINY["starts"], TINY["drifts"], TINY["radius"],
                               S=TINY["S"], margin=TINY["margin"])
    dt = time.time() - t0
    rep = R.report(g, B, V, L, TINY["S"], TINY["radius"])
    rep.update(runtime_sec=dt, converged=bool(ok), phases_used=phase)
    return rep


if __name__ == "__main__":
    r = solve_tiny()
    for k, v in r.items():
        print(f"  {k:22s} {v:.6g}" if isinstance(v, float) else f"  {k:22s} {v}")
