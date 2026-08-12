#!/usr/bin/env python3
"""Balls travelling in straight lines, bouncing off their own past selves.

Each ball is a ringed disk whose phase is shown by a radial fill: it grows from
the centre over the first half of the period and is eaten away from the centre
over the second half. Empty at t = 0, brim-full at t = 1/2, empty again at
t = 1 -- continuous through the seam and injective in phase, so the half-filled
disk at t = 1/4 is not the ring at t = 3/4.

The balls travel BALLISTICALLY: straight lines, with a kink only where they
meet something. Over one period each ball translates by a whole LATTICE vector,
so the pattern repeats exactly even though no ball ends where it began. Their
clones under the group carry the group's time offsets, so a ball meets copies
of itself running 1/3 and 2/3 of a period behind.

Those meetings cannot be resolved by simulating forward: the event that
deflects you at time t must deflect your partner at t - tau, which has already
happened. So the whole periodic trajectory is solved at once. Each ball's path
is a closed POLYLINE -- straight between breakpoints, with

    p_i(t + 1) = p_i(t) + L_i

built into the representation -- and the solver alternately (a) shoves the
breakpoints apart wherever any ball is too close to any clone of any ball at
any instant, and (b) adds a new breakpoint at the worst remaining encounter, so
kinks appear only where they are earned. Periodicity and self-consistency hold
by construction; the bounces are what the relaxation finds.

Usage:  python3 balls_gif.py [--group g226] [--balls 5] [--seed 3]
"""

import argparse
import colorsys
import time
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from particles_gif import Group

ROOT = Path(__file__).resolve().parents[1]
SS = 3
BG = (250, 249, 246)
GRID = (222, 218, 208)          # the light grey cell outlines


class Polyline:
    """Closed piecewise-linear paths, straight between breakpoints.

    Ball i is at V[i][k] at sample index B[i][k], travels straight to the next
    breakpoint, and after a full period arrives back at its start displaced by
    the lattice vector L[i]."""

    def __init__(self, seeds, drifts, S):
        self.n = len(seeds)
        self.S = S
        self.L = np.array(drifts, dtype=float)
        self.B = [[0] for _ in range(self.n)]                 # breakpoint indices
        self.V = [[np.array(s, dtype=float)] for s in seeds]  # their positions
        self.X = np.zeros((self.n, S, 2))
        self.rasterize()

    def rasterize(self):
        """sample the polylines; exact, because breakpoints sit on the grid"""
        for i in range(self.n):
            ts = np.array(self.B[i] + [self.S], dtype=float)
            vs = np.array(self.V[i] + [self.V[i][0] + self.L[i]])
            grid = np.arange(self.S, dtype=float)
            self.X[i, :, 0] = np.interp(grid, ts, vs[:, 0])
            self.X[i, :, 1] = np.interp(grid, ts, vs[:, 1])

    def at(self, theta):
        """positions of all balls at internal time theta (any real) -> (n,2)"""
        w = math.floor(theta)
        x = (theta - w) * self.S
        i0 = int(math.floor(x)) % self.S
        i1 = (i0 + 1) % self.S
        a = x - math.floor(x)
        p0 = self.X[:, i0, :]
        # crossing the seam, the next sample belongs to the following period
        p1 = self.X[:, i1, :] + (self.L if i1 == 0 else 0.0)
        return p0 * (1 - a) + p1 * a + self.L * w

    def shove_field(self, field):
        """apply a per-sample push (n, S, 2) by moving the breakpoints.

        Breakpoint 0 is PINNED: the balls were placed and aimed at random, and
        the solver is only allowed to bend their paths, never to slide a whole
        path aside -- otherwise it clears every encounter by moving the balls
        out of each other's way and nothing ever collides."""
        for i in range(self.n):
            bs = self.B[i]
            m = len(bs)
            acc = [np.zeros(2) for _ in range(m)]
            edges = bs + [self.S]
            for k in range(m):
                lo, hi = edges[k], edges[k + 1]
                if hi <= lo:
                    continue
                seg = field[i, lo:hi, :]
                w = (np.arange(lo, hi) - lo) / (hi - lo)
                acc[k] += (seg * (1 - w)[:, None]).sum(axis=0)
                acc[(k + 1) % m] += (seg * w[:, None]).sum(axis=0)
            for k in range(1, m):                 # index 0 stays pinned
                self.V[i][k] += acc[k]

    def add_breakpoint(self, i, s, min_sep):
        bs = self.B[i]
        if s <= 0 or s >= self.S:
            return False
        if min(abs(s - b) for b in bs + [self.S]) < min_sep:
            return False
        pos = self.X[i, s, :].copy()
        k = int(np.searchsorted(bs, s))
        self.B[i].insert(k, s)
        self.V[i].insert(k, pos)
        return True

    def recenter(self):
        """slide each path by a lattice vector so its start lies in the cell.

        Physically a no-op -- the pattern is lattice-periodic -- but it stops
        the solver escaping the finite clone window, which would otherwise let
        it 'clear' every encounter by walking a ball out of the neighbourhood
        it is being tested against."""
        for i in range(self.n):
            k = np.floor(self.V[i][0])
            if np.any(k):
                for j in range(len(self.V[i])):
                    self.V[i][j] = self.V[i][j] - k

    def kinks(self):
        return sum(len(b) for b in self.B)


def clone_stack(g, traj, clones):
    """positions of every clone at every sample time, in one array.

    (C, n, S, 2) cartesian. Each clone's time offset is an exact whole number
    of samples (S is a multiple of the clock order), so the shift is a roll;
    rolling past the seam costs one lattice vector, because that is a previous
    period."""
    X = traj.X                                        # (n, S, 2) lattice
    S = traj.S
    out = np.empty((len(clones), traj.n, S, 2))
    for c, (M, v, k) in enumerate(clones):
        Y = np.roll(X, k, axis=1)
        if k:
            Y[:, :k, :] = Y[:, :k, :] - traj.L[:, None, :]
        out[c] = (Y @ M.T + v) @ g.B
    return out


def clone_positions(g, traj, clones, t):
    """every ball in the plane at global time t (used by the symmetry check)"""
    pts, idx = [], []
    for M, v, tau in clones:
        p = traj.at(t - tau) @ M.T + v
        pts.append(p @ g.B)
        idx.append(np.arange(traj.n))
    return np.vstack(pts), np.concatenate(idx)


def encounters(g, traj, clones, d_min):
    """clearance, per-ball push field, and where each ball is worst off"""
    base = traj.X @ g.B                               # (n, S, 2)
    allp = clone_stack(g, traj, clones)               # (C, n, S, 2)
    diff = base[None, :, None, :, :] - allp[:, None, :, :, :]   # (C,i,j,S,2)
    dist = np.linalg.norm(diff, axis=4)
    dist[dist < 1e-9] = np.inf
    over = np.maximum(d_min - dist, 0.0)
    unit = diff / np.maximum(dist, 1e-9)[..., None]
    push = (unit * over[..., None]).sum(axis=(0, 2))  # (n, S, 2) cartesian
    near = dist.min(axis=(0, 2))                      # (n, S)
    return float(dist.min()), push, near


def solve(g, traj, clones, d_min, phases=10, rounds=120, push=0.45, min_sep=12):
    """shove the breakpoints, then earn a new one where it is still tight"""
    for phase in range(phases):
        for _ in range(rounds):
            worst, force, near = encounters(g, traj, clones, d_min)
            if worst >= d_min:
                break
            traj.shove_field(force @ g.Binv * push)
            traj.recenter()
            traj.rasterize()
        worst, _, near = encounters(g, traj, clones, d_min)
        if worst >= d_min:
            return worst, phase, True
        for i in range(traj.n):
            traj.add_breakpoint(i, int(np.argmin(near[i])), min_sep)
        traj.recenter()
        traj.rasterize()
    worst, _, _ = encounters(g, traj, clones, d_min)
    return worst, phases, worst >= d_min


def check_symmetry(g, traj, shift, span=4, radius_keep=1.0):
    """turning a frame by the generator must reproduce the frame `shift` later"""
    M = v = None
    for Mo, vo, tau in g.ops:
        if abs(tau - shift) < 1e-9:
            M, v = Mo, vo
    if M is None:
        return float("nan")
    wide = g.clones(span)
    worst = 0.0
    for s in range(16):
        t = s / 16
        p0, i0 = clone_positions(g, traj, wide, t)
        p1, i1 = clone_positions(g, traj, wide, t + shift)
        turned = (g.lat(p0) @ M.T + v) @ g.B
        keep = np.linalg.norm(turned, axis=1) < radius_keep
        for pt, bi in zip(turned[keep], i0[keep]):
            same = p1[i1 == bi]
            worst = max(worst, float(np.linalg.norm(same - pt, axis=1).min()))
    return worst


def palette(n):
    out = []
    for i in range(n):
        r, g, b = colorsys.hls_to_rgb((i / n + 0.05) % 1.0, 0.48, 0.60)
        out.append((int(255 * r), int(255 * g), int(255 * b)))
    return out


def draw_ball(d, cx, cy, R, phase, colour):
    """ringed disk; the fill grows from the centre, then is eaten from it"""
    ph = phase % 1.0
    box = [cx - R, cy - R, cx + R, cy + R]
    d.ellipse(box, fill=BG, outline=(70, 76, 88), width=max(1, int(0.10 * R)))
    if ph < 0.5:                                    # filling outward
        rr = R * (2 * ph)
        if rr > 0.5:
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=colour)
    else:                                           # emptying from the middle
        d.ellipse(box, fill=colour)
        rr = R * (2 * ph - 1)
        if rr > 0.5:
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=BG)
    d.ellipse(box, fill=None, outline=(70, 76, 88), width=max(1, int(0.10 * R)))


def draw_cells(d, g, W, cell_px, span):
    def scr(u):
        p = np.asarray(u, dtype=float) @ g.B
        return (W / 2 + p[0] * cell_px * SS, W / 2 - p[1] * cell_px * SS)
    lw = max(1, int(0.004 * W))
    for m in range(-span, span + 2):
        for a, b in (((m, -span), (m, span + 1)), ((-span, m), (span + 1, m))):
            d.line([scr(a), scr(b)], fill=GRID, width=lw)


def render(g, traj, clones, radius, size, frames, cell_px, span):
    cols = palette(traj.n)
    W = size * SS
    R = radius * cell_px * SS
    imgs = []
    for f in range(frames):
        t = f / frames
        img = Image.new("RGB", (W, W), BG)
        d = ImageDraw.Draw(img)
        draw_cells(d, g, W, cell_px, span + 1)
        for M, v, tau in clones:
            phase = (t - tau) % 1.0
            p = (traj.at(t - tau) @ M.T + v) @ g.B
            for i in range(traj.n):
                x = W / 2 + p[i, 0] * cell_px * SS
                y = W / 2 - p[i, 1] * cell_px * SS
                if not (-2 * R <= x <= W + 2 * R and -2 * R <= y <= W + 2 * R):
                    continue
                draw_ball(d, x, y, R, phase, cols[i])
        imgs.append(img.resize((size, size), Image.LANCZOS))
    return imgs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", default="g226")
    ap.add_argument("--balls", type=int, default=5)
    ap.add_argument("--radius", type=float, default=0.055)
    ap.add_argument("--size", type=int, default=600)
    ap.add_argument("--frames", type=int, default=60)
    ap.add_argument("--cell-px", type=float, default=250.0)
    ap.add_argument("--margin", type=float, default=1.06)
    ap.add_argument("--steps", type=int, default=180)
    ap.add_argument("--seed", type=int, default=3)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    t_start = time.time()
    rng = random.Random(a.seed)
    g = Group(a.group)
    span = 3
    clones = [(M, v, int(round(tau * a.steps)) % a.steps)
              for M, v, tau in g.clones(span)]

    seeds = [[rng.random(), rng.random()] for _ in range(a.balls)]
    choices = [(1, 0), (0, 1), (1, 1), (-1, 1), (1, -1), (-1, 0), (0, -1)]
    drifts = [list(rng.choice(choices)) for _ in range(a.balls)]
    traj = Polyline(seeds, drifts, a.steps)

    d_min = 2 * a.radius * a.margin
    clear, phase, ok = solve(g, traj, clones, d_min)
    shift = min((tau for _, _, tau in g.ops if tau > 1e-9), default=0.0)
    err = check_symmetry(g, traj, shift)

    print(f"{a.group}  {g.symbol}")
    print(f"  {a.balls} balls x {len(g.ops)} copies per cell; drifts "
          f"{[tuple(int(x) for x in L) for L in traj.L]} cells per period")
    print(f"  straight segments: {traj.kinks()} kinks in all "
          f"({traj.kinks() / a.balls:.1f} per ball per period), "
          f"{'all encounters cleared' if ok else 'residual contact'} "
          f"after {phase + 1} rounds of earning kinks")
    print(f"  min centre distance over the loop : {clear:.4f}  "
          f"(diameter {2 * a.radius:.4f})  -> "
          f"{'NO OVERLAP' if clear >= 2 * a.radius else 'OVERLAP'}")
    print(f"  symmetry residual (turn 120°, wait {shift:.3f}) : {err:.2e}")

    out = a.out or str(ROOT / "docs" / "gifs" / f"{a.group}-balls.gif")
    imgs = render(g, traj, g.clones(2), a.radius, a.size, a.frames, a.cell_px, 2)
    dur = round(3600 / a.frames / 10) * 10
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=dur,
                 loop=0, optimize=True)
    print(f"  total time: {time.time() - t_start:.1f} s")
    print(f"  wrote {out}  ({a.frames} frames, {dur} ms each)")


if __name__ == "__main__":
    main()
