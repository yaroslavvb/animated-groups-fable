#!/usr/bin/env python3
"""Rendering and verification for ball trajectories in a clockwork group.

Solver-independent: hand it closed polylines and it draws the animation and checks it.
A trajectory set is (B, V, L, S):
    B[i]  sorted sample indices of ball i's breakpoints, starting with 0
    V[i]  the positions at those breakpoints, lattice coordinates
    L[i]  the lattice vector ball i drifts by over one period
    S     samples per period
so ball i runs straight from V[i][k] to V[i][k+1], and from the last breakpoint
to V[i][0] + L[i] at the end of the period.

Speed matters here: the whole pipeline has a ten second budget, so frames are
assembled by pasting pre-rendered sprites (one per colour per phase) rather
than by drawing thousands of antialiased ellipses.
"""

import math
from pathlib import Path

import colorsys
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SS = 3
BG = (250, 249, 246)
GRID = (222, 218, 208)
EDGE = (70, 76, 88)


# ------------------------------------------------------------------ paths --
def rasterize(B, V, L, S):
    """(n, S, 2) lattice positions at every sample index"""
    n = len(B)
    X = np.zeros((n, S, 2))
    grid = np.arange(S, dtype=float)
    for i in range(n):
        ts = np.array(list(B[i]) + [S], dtype=float)
        vs = np.array(list(V[i]) + [np.asarray(V[i][0]) + np.asarray(L[i])])
        X[i, :, 0] = np.interp(grid, ts, vs[:, 0])
        X[i, :, 1] = np.interp(grid, ts, vs[:, 1])
    return X


def shifted(X, L, k):
    """X as seen `k` samples ago: rolling past the seam costs a lattice vector"""
    Y = np.roll(X, k, axis=1)
    if k:
        Y[:, :k, :] = Y[:, :k, :] - np.asarray(L)[:, None, :]
    return Y


def clone_stack(g, X, L, clones_k):
    """(C, n, S, 2) cartesian positions of every clone at every sample"""
    out = np.empty((len(clones_k), X.shape[0], X.shape[1], 2))
    for c, (M, v, k) in enumerate(clones_k):
        out[c] = (shifted(X, L, k) @ np.asarray(M).T + np.asarray(v)) @ g.B
    return out


def integer_clones(g, span, S):
    """clones with their time offsets as exact sample counts (S % order == 0)"""
    out = []
    for M, v, tau in g.clones(span):
        k = int(round(tau * S))
        if abs(tau * S - k) > 1e-9:
            raise ValueError(f"S={S} does not divide the clock: tau={tau}")
        out.append((M, v, k % S))
    return out


# ------------------------------------------------------------------ checks --
def clearance(g, X, L, clones_k):
    """smallest centre-to-centre distance between distinct balls, over the loop"""
    base = X @ g.B
    allp = clone_stack(g, X, L, clones_k)
    d = np.linalg.norm(base[None, :, None, :, :] - allp[:, None, :, :, :], axis=4)
    d[d < 1e-9] = np.inf
    return float(d.min())


def straight_fraction(X):
    """fraction of steps whose heading equals the previous step's"""
    v = np.diff(np.concatenate([X, X[:, :1, :]], axis=1), axis=1)
    nrm = np.linalg.norm(v, axis=2, keepdims=True)
    u = v / np.maximum(nrm, 1e-12)
    turn = np.linalg.norm(u - np.roll(u, 1, axis=1), axis=2)
    return float((turn < 1e-6).mean())


def symmetry_residual(g, X, L, S, span=6, keep=0.9):
    """turning the pattern by the generator must reproduce it 1/3 period later.

    Automatic for an orbit fill, so a nonzero value means a bug (or a window
    too small, which `keep` guards against)."""
    shift = min((tau for _, _, tau in g.ops if tau > 1e-9), default=0.0)
    M = v = None
    for Mo, vo, tau in g.ops:
        if abs(tau - shift) < 1e-9:
            M, v = np.asarray(Mo), np.asarray(vo)
    if M is None:
        return float("nan")
    clones_k = integer_clones(g, span, S)
    ks = int(round(shift * S))
    worst = 0.0
    for s in range(0, S, max(1, S // 12)):
        now = clone_stack(g, X, L, clones_k)[:, :, s, :].reshape(-1, 2)
        idx = np.tile(np.arange(X.shape[0]), len(clones_k))
        later = clone_stack(g, X, L, clones_k)[:, :, (s + ks) % S, :].reshape(-1, 2)
        turned = (now @ g.Binv @ M.T + v) @ g.B
        inside = np.linalg.norm(turned, axis=1) < keep
        for pt, bi in zip(turned[inside], idx[inside]):
            same = later[idx == bi]
            worst = max(worst, float(np.linalg.norm(same - pt, axis=1).min()))
    return worst


def report(g, B, V, L, S, radius, span=3):
    X = rasterize(B, V, L, S)
    ck = integer_clones(g, span, S)
    clear = clearance(g, X, L, ck)
    return {
        "min_clearance": clear,
        "min_clearance_ratio": clear / (2 * radius),
        "symmetry_residual": symmetry_residual(g, X, L, S),
        "straight_fraction": straight_fraction(X),
        "kinks_per_ball": sum(len(b) for b in B) / len(B),
    }


# ----------------------------------------------------------------- drawing --
def palette(n):
    return [tuple(int(255 * c) for c in colorsys.hls_to_rgb((i / n + 0.05) % 1.0, .48, .60))
            for i in range(n)]


SUB = 3          # sub-pixel sprite variants per axis


def ball_sprite(R, phase, colour, sub=(0.0, 0.0)):
    """RGBA sprite at FINAL resolution, antialiased by drawing large and
    shrinking. `sub` offsets the centre by a fraction of a final pixel, so a
    ball can be placed to a third of a pixel without rescaling whole frames."""
    D = int(2 * R) + 6
    big = Image.new("RGBA", (D * SS, D * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    c = (D / 2 + sub[0]) * SS, (D / 2 + sub[1]) * SS
    r = R * SS
    box = [c[0] - r, c[1] - r, c[0] + r, c[1] + r]
    w = max(1, int(0.10 * r))
    d.ellipse(box, fill=BG + (255,), outline=EDGE + (255,), width=w)
    ph = phase % 1.0
    if ph < 0.5:
        rr = r * 2 * ph
        if rr > 0.5:
            d.ellipse([c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr], fill=colour + (255,))
    else:
        d.ellipse(box, fill=colour + (255,))
        rr = r * (2 * ph - 1)
        if rr > 0.5:
            d.ellipse([c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr], fill=BG + (255,))
    d.ellipse(box, fill=None, outline=EDGE + (255,), width=w)
    return big.resize((D, D), Image.LANCZOS)


def draw_cells(g, size, cell_px, span):
    """the light grey cell grid, drawn once, antialiased once"""
    W = size * SS
    img = Image.new("RGB", (W, W), BG)
    d = ImageDraw.Draw(img)

    def scr(u):
        p = np.asarray(u, dtype=float) @ g.B
        return (W / 2 + p[0] * cell_px * SS, W / 2 - p[1] * cell_px * SS)
    lw = max(1, int(0.0035 * W))
    for m in range(-span, span + 2):
        d.line([scr((m, -span)), scr((m, span + 1))], fill=GRID, width=lw)
        d.line([scr((-span, m)), scr((-span + (span * 2 + 1), m))], fill=GRID, width=lw)
        d.line([scr((-span, m)), scr((span + 1, m))], fill=GRID, width=lw)
    return img.resize((size, size), Image.LANCZOS)


def render(g, B, V, L, S, radius, size=600, frames=60, cell_px=250.0, span=2):
    """frames of the animation, assembled by pasting pre-shrunk sprites"""
    n = len(B)
    cols = palette(n)
    R = radius * cell_px
    if frames % 3:
        raise ValueError("frames must be divisible by the clock order")
    ck = integer_clones(g, span, frames)

    grid = np.arange(frames, dtype=float) * (S / frames)
    Xf = np.zeros((n, frames, 2))
    for i in range(n):
        ts = np.array(list(B[i]) + [S], dtype=float)
        vs = np.array(list(V[i]) + [np.asarray(V[i][0]) + np.asarray(L[i])])
        Xf[i, :, 0] = np.interp(grid, ts, vs[:, 0])
        Xf[i, :, 1] = np.interp(grid, ts, vs[:, 1])

    sprites = [[[ball_sprite(R, f / frames, cols[i], (dx / SUB, dy / SUB))
                 for dy in range(SUB) for dx in range(SUB)]
                for f in range(frames)] for i in range(n)]
    base = draw_cells(g, size, cell_px, span + 1)

    pos = np.empty((len(ck), n, frames, 2))
    for c, (M, v, k) in enumerate(ck):
        pos[c] = (shifted(Xf, L, k) @ np.asarray(M).T + np.asarray(v)) @ g.B

    imgs = []
    for f in range(frames):
        img = base.copy()
        for c, (M, v, k) in enumerate(ck):
            ph = (f - k) % frames
            for i in range(n):
                x = size / 2 + pos[c, i, f, 0] * cell_px
                y = size / 2 - pos[c, i, f, 1] * cell_px
                if not (-2 * R <= x <= size + 2 * R and -2 * R <= y <= size + 2 * R):
                    continue
                fx, fy = math.floor(x), math.floor(y)
                sx = min(SUB - 1, int((x - fx) * SUB))
                sy = min(SUB - 1, int((y - fy) * SUB))
                sp = sprites[i][ph][sy * SUB + sx]
                img.paste(sp, (fx - sp.width // 2, fy - sp.height // 2), sp)
        imgs.append(img)
    return imgs


def save_gif(imgs, out, seconds=3.6):
    """one shared palette for every frame: adaptive per-frame quantisation and
    optimize=True together cost more than the whole render"""
    dur = round(seconds * 1000 / len(imgs) / 10) * 10
    pal = imgs[0].quantize(colors=64, method=Image.MEDIANCUT)
    qs = [im.quantize(palette=pal, dither=Image.NONE) for im in imgs]
    qs[0].save(out, save_all=True, append_images=qs[1:], duration=dur, loop=0)
    return out
