#!/usr/bin/env python3
"""Balls drifting through a clockwork group, deflecting off their own past.

Each ball is a BALL: a ringed disk whose phase is shown by a radial fill that
grows from the centre over the first half of the period and is then eaten away
from the centre over the second half. Empty at t = 0, brim-full at t = 1/2,
empty again at t = 1 -- continuous through the seam, and injective in phase
(a half-filled disk at t = 1/4 is not the same picture as the ring at t = 3/4).

The balls drift ballistically: over one period ball i translates by a LATTICE
vector L_i, so the pattern as a whole is exactly periodic even though every
individual ball keeps moving. Their clones under the group carry the group's
time offsets, so a ball meets copies of itself running 1/3 and 2/3 of a period
behind.

Collisions with those copies cannot be resolved by simulating forward: the
event that deflects you at time t must deflect your partner at t - tau, which
already happened. So this solves for the whole periodic trajectory at once --
a self-consistent solution in the Novikov sense. Each trajectory is

    p_i(t) = s_i + L_i t + u_i(t),      u_i periodic,

and the periodic corrections u_i are relaxed until no ball overlaps any clone
of any ball at any instant. Periodicity and consistency therefore hold by
construction; what the relaxation buys is the deflection.

Usage:  python3 balls_gif.py [--group g226] [--balls 5] [--seed 3]
"""

import argparse
import colorsys
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


class Drift:
    """p_i(t) = s_i + L_i t + u_i(t) in lattice coordinates, u_i periodic."""

    def __init__(self, seeds, drifts, S):
        self.s = np.array(seeds, dtype=float)        # (n, 2)
        self.L = np.array(drifts, dtype=float)       # (n, 2) lattice vectors
        self.u = np.zeros((len(seeds), S, 2))        # periodic corrections
        self.S = S

    def at(self, theta):
        """positions of all balls at internal time theta (any real) -> (n,2).

        Outside [0,1) the drift carries the ball a whole lattice vector, which
        is what makes the pattern periodic while the balls keep travelling."""
        w = math.floor(theta)
        f = theta - w
        # LINEAR interpolation, not nearest sample: with a nearest-sample
        # lookup the trajectory is a step function of theta and the symmetry
        # check picks up the quantisation as a spurious residual
        x = f * self.S
        i0 = int(math.floor(x)) % self.S
        i1 = (i0 + 1) % self.S
        a = x - math.floor(x)
        u = self.u[:, i0, :] * (1 - a) + self.u[:, i1, :] * a
        return self.s + self.L * f + u + self.L * w

    def smooth(self, harmonics):
        """keep the corrections gentle and exactly periodic"""
        F = np.fft.rfft(self.u, axis=1)
        F[:, harmonics + 1:, :] = 0
        self.u = np.fft.irfft(F, n=self.S, axis=1)


def clone_positions(g, traj, clones, t):
    """every ball in the plane at global time t: cartesian (m,2) + ball index"""
    pts, idx = [], []
    n = traj.s.shape[0]
    for M, v, tau in clones:
        p = traj.at(t - tau) @ M.T + v
        pts.append(p @ g.B)
        idx.append(np.arange(n))
    return np.vstack(pts), np.concatenate(idx)


def relax(g, traj, clones, d_min, rounds=400, harmonics=14, push=0.6):
    """Deflect the trajectories until nothing overlaps anything, anywhere."""
    S = traj.S
    for r in range(rounds):
        worst, hits = np.inf, 0
        du = np.zeros_like(traj.u)
        for si in range(S):
            t = si / S
            base = traj.at(t) @ g.B                       # (n,2) cartesian
            allp, _ = clone_positions(g, traj, clones, t)
            diff = base[:, None, :] - allp[None, :, :]
            dist = np.linalg.norm(diff, axis=2)
            dist[dist < 1e-9] = np.inf                    # the ball itself
            worst = min(worst, float(dist.min()))
            bad = dist < d_min
            if bad.any():
                hits += int(bad.sum())
                over = np.where(bad, d_min - dist, 0.0)
                unit = np.where(dist[:, :, None] > 1e-9,
                                diff / np.maximum(dist[:, :, None], 1e-9), 0.0)
                shove = (unit * over[:, :, None]).sum(axis=1) * push
                du[:, si, :] += shove @ g.Binv             # cartesian -> lattice
        if hits == 0:
            return worst, r
        traj.u += du
        traj.smooth(harmonics)
    return worst, rounds


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
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=BG,
              outline=(70, 76, 88), width=max(1, int(0.10 * R)))
    if ph < 0.5:                                    # filling outward
        rr = R * (2 * ph)
        if rr > 0.5:
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=colour)
    else:                                           # emptying from the middle
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=colour)
        rr = R * (2 * ph - 1)
        if rr > 0.5:
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=BG)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=None,
              outline=(70, 76, 88), width=max(1, int(0.10 * R)))


def draw_cells(d, g, W, cell_px, span):
    """the fundamental cells, in light grey"""
    def scr(u):
        p = np.asarray(u) @ g.B
        return (W / 2 + p[0] * cell_px * SS, W / 2 - p[1] * cell_px * SS)
    lw = max(1, int(0.004 * W))
    for m in range(-span, span + 2):
        for a, b in (((m, -span), (m, span + 1)), ((-span, m), (span + 1, m))):
            d.line([scr(a), scr(b)], fill=GRID, width=lw)


def render(g, traj, clones, radius, size, frames, cell_px, span):
    cols = palette(traj.s.shape[0])
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
            for i in range(traj.s.shape[0]):
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
    ap.add_argument("--size", type=int, default=560)
    ap.add_argument("--frames", type=int, default=60)
    ap.add_argument("--cell-px", type=float, default=230.0)
    ap.add_argument("--margin", type=float, default=1.10)
    ap.add_argument("--steps", type=int, default=180)
    ap.add_argument("--seed", type=int, default=3)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    rng = random.Random(a.seed)
    g = Group(a.group)
    clones = g.clones(1)

    # random start points, and a random lattice-vector drift each: over one
    # period every ball travels a whole cell, so the pattern still loops
    seeds = [[rng.random(), rng.random()] for _ in range(a.balls)]
    choices = [(1, 0), (0, 1), (1, 1), (-1, 1), (1, -1), (-1, 0), (0, -1)]
    drifts = [list(rng.choice(choices)) for _ in range(a.balls)]
    traj = Drift(seeds, drifts, a.steps)

    d_min = 2 * a.radius * a.margin
    clear, rounds = relax(g, traj, clones, d_min)
    shift = min((tau for _, _, tau in g.ops if tau > 1e-9), default=0.0)
    err = check_symmetry(g, traj, shift)

    print(f"{a.group}  {g.symbol}")
    print(f"  {a.balls} balls x {len(g.ops)} copies per cell; drifts "
          f"{[tuple(int(x) for x in L) for L in traj.L]} cells per period")
    print(f"  deflection relaxation: {'settled' if rounds < 400 else 'hit cap'} "
          f"after {rounds} rounds")
    print(f"  min centre distance over the loop : {clear:.4f}  "
          f"(diameter {2 * a.radius:.4f})  -> "
          f"{'NO OVERLAP' if clear >= 2 * a.radius else 'OVERLAP'}")
    print(f"  symmetry residual (turn 120°, wait {shift:.3f}) : {err:.2e}")

    out = a.out or str(ROOT / "docs" / "gifs" / f"{a.group}-balls.gif")
    imgs = render(g, traj, g.clones(2), a.radius, a.size, a.frames, a.cell_px, 2)
    dur = round(3600 / a.frames / 10) * 10
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=dur,
                 loop=0, optimize=True)
    print(f"  wrote {out}  ({a.frames} frames, {dur} ms each)")


if __name__ == "__main__":
    main()
