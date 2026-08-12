#!/usr/bin/env python3
"""Animate a clockwork group by orbit-filling a small cloud of moving balls.

This is the ordinary "draw one motif, clone it across the plane" fill with ONE
addition: every clone carries a time offset as well as an isometry, and shows
the motif at internal time t - tau. For 3_1 3_1 3_1 that means each 120 degree
copy runs a third of a period behind its neighbour.

The motif is N balls on random LOOPING trajectories (random Fourier series, so
p(theta + 1) = p(theta) exactly and the gif closes seamlessly).

The constraint: no ball may touch any other ball anywhere in the plane at any
instant -- not merely inside the fundamental cell, but against every clone of
every other ball, including its own rotated copies at their shifted phases.
Enforced in three stages:

  1. seeds are laid down by Poisson-disk rejection against the whole orbit;
  2. the seeds are relaxed by mutual repulsion, which maximises the room the
     balls have to move in (greedy seeding alone leaves pairs at the minimum
     spacing, and one tight pair throttles the whole animation);
  3. each ball's motion is then grown to the largest amplitude that keeps the
     minimum clearance over the entire loop above the ball diameter.

Because no two balls ever overlap, painting order cannot matter: the drawn
frame is exactly symmetric, not merely the underlying point set.

Usage:  python3 particles_gif.py [--group g226] [--balls 10] [--seed 7]
"""

import argparse
import colorsys
import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SS = 3                      # supersampling for antialiased balls
BG = (250, 249, 246)
IDENT = [[1, 0], [0, 1]]


class Group:
    """A clockwork group as an orbit fill needs it: a lattice basis and a list
    of (matrix, translation, time offset) clones, in lattice coordinates."""

    def __init__(self, gid):
        cat = json.loads((ROOT / "docs" / "data" / "catalog.json").read_text())
        g = next(x for x in cat["groups"] if x["id"] == gid)
        self.id, self.symbol = gid, g["symbol"]
        self.B = np.array(g["render"]["basis"], dtype=float)   # rows b1, b2
        self.Binv = np.linalg.inv(self.B)
        self.ops = [(np.array(o["M"], dtype=float), np.array(o["v"], dtype=float),
                     float(o["tau"])) for o in g["render"]["ops"]]

    def cart(self, u):                       # lattice -> cartesian
        return np.asarray(u) @ self.B

    def lat(self, p):                        # cartesian -> lattice
        return np.asarray(p) @ self.Binv

    def clones(self, span):
        out = []
        for M, v, tau in self.ops:
            for m1 in range(-span, span + 1):
                for m2 in range(-span, span + 1):
                    out.append((M, v + np.array([m1, m2], dtype=float), tau))
        return out


class Cloud:
    """N balls on random closed trajectories, in lattice coordinates."""

    def __init__(self, seeds, harm, amps):
        self.seeds = np.array(seeds, dtype=float)      # (n, 2)
        self.harm = harm                               # (n, K, 4): ax ay bx by
        self.amps = np.array(amps, dtype=float)        # (n,)

    def at(self, theta):
        """positions of all n balls at internal time theta -> (n, 2)"""
        p = self.seeds.copy()
        for k in range(self.harm.shape[1]):
            c = math.cos(2 * math.pi * (k + 1) * theta)
            s = math.sin(2 * math.pi * (k + 1) * theta)
            p[:, 0] += self.amps * (self.harm[:, k, 0] * c + self.harm[:, k, 2] * s)
            p[:, 1] += self.amps * (self.harm[:, k, 1] * c + self.harm[:, k, 3] * s)
        return p


def orbit_cart(g, cloud, clones, t):
    """every ball in the plane at global time t: (m, 2) cartesian + ball index"""
    pts, idx = [], []
    n = cloud.seeds.shape[0]
    cache = {}
    for M, v, tau in clones:
        theta = (t - tau) % 1.0
        key = round(theta, 12)
        if key not in cache:
            cache[key] = cloud.at(theta)
        p = cache[key] @ M.T + v
        pts.append(p @ g.B)
        idx.append(np.arange(n))
    return np.vstack(pts), np.concatenate(idx)


def clearance(g, cloud, clones, samples):
    """smallest centre-to-centre distance between distinct balls over the loop.

    By equivariance it suffices to test the base copy against everything: any
    collision anywhere can be carried into the base copy by a group element."""
    worst = np.inf
    for s in range(samples):
        t = s / samples
        allp, _ = orbit_cart(g, cloud, clones, t)
        base = cloud.at(t) @ g.B
        d = np.linalg.norm(base[:, None, :] - allp[None, :, :], axis=2)
        d[d < 1e-9] = np.inf                      # the ball itself
        worst = min(worst, float(d.min()))
    return worst


def seed_cloud(g, clones, n, min_dist, rng, tries=60000):
    seeds = []
    for _ in range(tries):
        if len(seeds) == n:
            break
        cand = np.array([rng.random(), rng.random()])
        trial = np.array(seeds + [cand])
        cc = cand @ g.B
        ok = True
        for M, v, _ in clones:
            q = (trial @ M.T + v) @ g.B
            d = np.linalg.norm(q - cc, axis=1)
            d[d < 1e-9] = np.inf
            if d.min() < min_dist:
                ok = False
                break
        if ok:
            seeds.append(cand)
    if len(seeds) < n:
        raise RuntimeError(f"placed only {len(seeds)}/{n} at min_dist={min_dist}")
    return np.array(seeds)


def relax(g, seeds, clones, rounds=400, step=0.004):
    """push the seeds apart within the orbit: maximise the room to move."""
    s = seeds.copy()
    for r in range(rounds):
        cart = s @ g.B
        force = np.zeros_like(cart)
        for M, v, _ in clones:
            q = (s @ M.T + v) @ g.B
            diff = cart[:, None, :] - q[None, :, :]
            dist = np.linalg.norm(diff, axis=2)
            mask = dist > 1e-9
            w = np.where(mask, 1.0 / np.maximum(dist, 1e-6) ** 3, 0.0)
            force += (diff * w[:, :, None]).sum(axis=1)
        norm = np.linalg.norm(force, axis=1, keepdims=True)
        force = np.where(norm > 1e-12, force / norm, 0.0)
        s = s + (force * step * (1 - r / rounds)) @ g.Binv
    return s


def build(g, n, radius, rng, margin=1.30, harmonics=3, samples=120, span=1):
    clones = g.clones(span)
    gap = 2 * radius * margin                    # a visible gap, not a graze
    seeds = seed_cloud(g, clones, n, gap * 1.15, rng)
    seeds = relax(g, seeds, clones)

    harm = np.zeros((n, harmonics, 4))
    for i in range(n):
        for k in range(harmonics):
            harm[i, k] = [rng.gauss(0, 1) / (k + 1) for _ in range(4)]
    cloud = Cloud(seeds, harm, np.zeros(n))

    static = clearance(g, cloud, clones, 1)
    # one global amplitude first...
    lo, hi = 0.0, 0.5 * static
    for _ in range(12):
        mid = (lo + hi) / 2
        cloud.amps[:] = mid
        if clearance(g, cloud, clones, samples) >= gap:
            lo = mid
        else:
            hi = mid
    cloud.amps[:] = lo
    # ...then let individual balls take up whatever slack is left near them
    for _ in range(3):
        for i in range(n):
            keep = cloud.amps[i]
            for factor in (1.6, 1.3, 1.15):
                cloud.amps[i] = keep * factor
                if clearance(g, cloud, clones, samples) >= gap:
                    keep = cloud.amps[i]
                    break
            cloud.amps[i] = keep
    return cloud, clones, clearance(g, cloud, clones, 4 * samples), static


def check_symmetry(g, cloud, shift, span=4, radius_keep=1.0):
    """The pattern at time t, turned by the group's 120 degree generator, must
    equal the pattern at t + shift. Compared as labelled point sets; since no
    two balls overlap, equal point sets mean identical pixels.

    The clone window is finite and is NOT carried to itself by the rotation, so
    the comparison is restricted to turned points well inside it (radius_keep)
    while the target orbit is built on a wider window (span)."""
    M, v = None, None
    for Mo, vo, tau in g.ops:
        if abs(tau - shift) < 1e-9:
            M, v = Mo, vo
    if M is None:
        return float("nan")
    wide = g.clones(span)
    worst = 0.0
    for s in range(16):
        t = s / 16
        p0, i0 = orbit_cart(g, cloud, wide, t)
        p1, i1 = orbit_cart(g, cloud, wide, t + shift)
        turned = (g.lat(p0) @ M.T + v) @ g.B          # apply the generator
        keep = np.linalg.norm(turned, axis=1) < radius_keep
        for pt, bi in zip(turned[keep], i0[keep]):
            same = p1[i1 == bi]
            worst = max(worst, float(np.linalg.norm(same - pt, axis=1).min()))
    return worst


def palette(n):
    out = []
    for i in range(n):
        r, gg, b = colorsys.hls_to_rgb((i / n + 0.02) % 1.0, 0.52, 0.62)
        out.append((int(255 * r), int(255 * gg), int(255 * b)))
    return out


def render(g, cloud, clones, radius, size, frames, cell_px):
    cols = palette(cloud.seeds.shape[0])
    W = size * SS
    r = radius * cell_px * SS
    imgs = []
    for f in range(frames):
        img = Image.new("RGB", (W, W), BG)
        d = ImageDraw.Draw(img)
        pts, idx = orbit_cart(g, cloud, clones, f / frames)
        for (px, py), i in zip(pts, idx):
            x = W / 2 + px * cell_px * SS
            y = W / 2 - py * cell_px * SS            # screen y is flipped
            if not (-2 * r <= x <= W + 2 * r and -2 * r <= y <= W + 2 * r):
                continue
            d.ellipse([x - r, y - r, x + r, y + r], fill=cols[i],
                      outline=(38, 42, 52), width=max(1, int(0.17 * r)))
        imgs.append(img.resize((size, size), Image.LANCZOS))
    return imgs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", default="g226")
    ap.add_argument("--balls", type=int, default=10)
    ap.add_argument("--radius", type=float, default=0.030)
    ap.add_argument("--size", type=int, default=560)
    ap.add_argument("--frames", type=int, default=60)
    ap.add_argument("--cell-px", type=float, default=250.0)
    ap.add_argument("--margin", type=float, default=1.30,
                    help="required clearance, in ball diameters")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    rng = random.Random(a.seed)
    g = Group(a.group)
    cloud, clones, clear, static = build(g, a.balls, a.radius, rng,
                                        margin=a.margin)
    shift = min((tau for _, _, tau in g.ops if tau > 1e-9), default=0.0)
    err = check_symmetry(g, cloud, shift)

    print(f"{a.group}  {g.symbol}")
    print(f"  {a.balls} balls x {len(g.ops)} copies = {a.balls * len(g.ops)} per cell")
    print(f"  seed spacing after relaxation : {static:.4f}")
    print(f"  motion amplitude              : {cloud.amps.min():.4f} – "
          f"{cloud.amps.max():.4f} lattice units "
          f"({cloud.amps.mean() / a.radius:.2f} ball radii, mean)")
    print(f"  min centre distance over loop : {clear:.4f}  "
          f"(diameter {2 * a.radius:.4f})  -> "
          f"{'NO CONTACT' if clear > 2 * a.radius else 'COLLISION'}"
          f"  [gap {clear - 2 * a.radius:.4f} = "
          f"{(clear - 2 * a.radius) * a.cell_px:.1f} px]")
    print(f"  symmetry residual (turn 120°, wait {shift:.3f}) : {err:.2e}")

    out = a.out or str(ROOT / "docs" / "gifs" / f"{a.group}-particles.gif")
    imgs = render(g, cloud, clones + g.clones(3), a.radius, a.size, a.frames,
                  a.cell_px)
    dur = round(3600 / a.frames / 10) * 10
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=dur,
                 loop=0, optimize=True)
    print(f"  wrote {out}  ({a.frames} frames, {dur} ms each)")


if __name__ == "__main__":
    main()
