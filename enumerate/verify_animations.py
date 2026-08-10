"""Verify EVERY animation spec against the group axioms, and check that the
rendered animation is invariant under each listed operation.

Two layers:
 1. Algebraic: the ops of each spec must be coset representatives of a group
    modulo (Z^2 x Z) — identity, inverses, closure (exact rational check).
 2. Pixel: for sampled specs, render frame F(t0) and F(s t0 + tau) with the
    PIL renderer, transform the second by the op's spatial part, and compare.

Checked: all 275 catalog render specs, all featured.json specs, all 13 strips.
Exits nonzero on any failure — run before every deploy.
"""

import json
import math
import sys
from fractions import Fraction

FR = lambda x: Fraction(x).limit_denominator(1000)


def frac1(x):
    return x % 1


def key_of(M, v, s, tau):
    return (tuple(tuple(r) for r in M), (frac1(v[0]), frac1(v[1])), s,
            frac1(tau))


def compose(g1, g2):
    M1, v1, s1, t1 = g1
    M2, v2, s2, t2 = g2
    M = tuple(tuple(M1[i][0] * M2[0][j] + M1[i][1] * M2[1][j] for j in (0, 1))
              for i in (0, 1))
    v = (M1[0][0] * v2[0] + M1[0][1] * v2[1] + v1[0],
         M1[1][0] * v2[0] + M1[1][1] * v2[1] + v1[1])
    return (M, v, s1 * s2, s1 * t2 + t1)


def inverse(g):
    M, v, s, t = g
    det = M[0][0] * M[1][1] - M[0][1] * M[1][0]
    Mi = ((Fraction(M[1][1], det), Fraction(-M[0][1], det)),
          (Fraction(-M[1][0], det), Fraction(M[0][0], det)))
    vi = (-(Mi[0][0] * v[0] + Mi[0][1] * v[1]),
          -(Mi[1][0] * v[0] + Mi[1][1] * v[1]))
    return (Mi, vi, s, -s * t)


def verify_spec_2d(spec, name):
    errs = []
    ops = [(tuple(tuple(int(x) for x in row) for row in o["M"]),
            (FR(o["v"][0]), FR(o["v"][1])), int(o["s"]), FR(o["tau"]))
           for o in spec["ops"]]
    keys = {key_of(*g) for g in ops}
    if len(keys) != len(ops):
        errs.append("duplicate ops")
    if key_of(((1, 0), (0, 1)), (Fraction(0), Fraction(0)), 1, Fraction(0)) \
            not in keys:
        errs.append("identity missing")
    for g in ops:
        gi = inverse(g)
        Mi = tuple(tuple(int(x) for x in row) for row in gi[0])
        if key_of(Mi, gi[1], gi[2], gi[3]) not in keys:
            errs.append(f"inverse missing for {key_of(*g)}")
        for h in ops:
            gh = compose(g, h)
            if key_of(*gh) not in keys:
                errs.append(f"closure fails: {key_of(*g)} * {key_of(*h)}")
    return [f"{name}: {e}" for e in errs]


def verify_strip(spec, name):
    errs = []
    reps = []
    for o in spec["ops"]:
        reps.append((o["m"], o["s"], FR(o["v"]), FR(o["tau"])))
        if spec.get("cent"):
            reps.append((o["m"], o["s"], FR(o["v"]) + FR(spec["cent"][0]),
                         FR(o["tau"]) + FR(spec["cent"][1])))
    keyf = lambda g: (g[0], g[1], frac1(g[2]), frac1(g[3]))
    keys = {keyf(g) for g in reps}
    if keyf((1, 1, Fraction(0), Fraction(0))) not in keys:
        errs.append("identity missing")
    for (m, s, v, t) in reps:
        if keyf((m, s, -m * v, -s * t)) not in keys:
            errs.append(f"inverse missing for {(m, s, v, t)}")
        for (m2, s2, v2, t2) in reps:
            gh = (m * m2, s * s2, m * v2 + v, s * t2 + t)
            if keyf(gh) not in keys:
                errs.append(f"closure fails: {(m,s,v,t)} * {(m2,s2,v2,t2)}")
    return [f"strip {name}: {e}" for e in errs]


def _bilinear_sample(arr, A, t):
    """Sample arr (H x W x 3, index coords) at A @ (x, y) + t per output pixel,
    with explicit bilinear interpolation — no library transform conventions."""
    import numpy as np
    H, W, _ = arr.shape
    ys, xs = np.mgrid[0:H, 0:W]
    sx = A[0][0] * xs + A[0][1] * ys + t[0]
    sy = A[1][0] * xs + A[1][1] * ys + t[1]
    x0 = np.floor(sx).astype(int)
    y0 = np.floor(sy).astype(int)
    fx = (sx - x0)[..., None]
    fy = (sy - y0)[..., None]
    x0 = np.clip(x0, 0, W - 2)
    y0 = np.clip(y0, 0, H - 2)
    return (arr[y0, x0] * (1 - fx) * (1 - fy) + arr[y0, x0 + 1] * fx * (1 - fy)
            + arr[y0 + 1, x0] * (1 - fx) * fy + arr[y0 + 1, x0 + 1] * fx * fy)


def pixel_invariance(spec, name, t0=0.137, size=260, cell=64, tol=8.0):
    """Render F(t0) and op-transformed F(s t0 + tau); compare central region.

    The comparison map is the op's INVERSE pixel transform about the pattern
    origin, which the renderer places at continuous coordinate size/2, i.e.
    index size/2 - 0.5 after the supersampled downscale."""
    from gifs import render_frame
    import numpy as np
    errs = []
    f0 = render_frame(spec, t0, size, cell)
    B = spec["basis"]
    b1 = (B[0][0] * cell, -B[0][1] * cell)
    b2 = (B[1][0] * cell, -B[1][1] * cell)
    A0 = np.asarray(f0, dtype=float)
    for o in spec["ops"]:
        t1 = (o["s"] * t0 + o["tau"]) % 1.0
        f1 = render_frame(spec, t1, size, cell)
        M = o["M"]
        det = b1[0] * b2[1] - b2[0] * b1[1]
        Binv = ((b2[1] / det, -b2[0] / det), (-b1[1] / det, b1[0] / det))
        MB = ((b1[0] * M[0][0] + b2[0] * M[1][0], b1[0] * M[0][1] + b2[0] * M[1][1]),
              (b1[1] * M[0][0] + b2[1] * M[1][0], b1[1] * M[0][1] + b2[1] * M[1][1]))
        T = ((MB[0][0] * Binv[0][0] + MB[0][1] * Binv[1][0],
              MB[0][0] * Binv[0][1] + MB[0][1] * Binv[1][1]),
             (MB[1][0] * Binv[0][0] + MB[1][1] * Binv[1][0],
              MB[1][0] * Binv[0][1] + MB[1][1] * Binv[1][1]))
        vx = b1[0] * o["v"][0] + b2[0] * o["v"][1]
        vy = b1[1] * o["v"][0] + b2[1] * o["v"][1]
        c0 = size / 2 - 0.5   # pattern origin in index coordinates
        # Invariance is F(t0)(x) = F(t1)(op(x)): sample the SECOND frame at
        # the FORWARD image op(q) = T (q - c0) + c0 + v. (Sampling at the
        # inverse instead only agrees for involutions — a direction bug this
        # comment commemorates.)
        tx = -T[0][0] * c0 - T[0][1] * c0 + c0 + vx
        ty = -T[1][0] * c0 - T[1][1] * c0 + c0 + vy
        A1 = np.asarray(f1, dtype=float)
        Bt = _bilinear_sample(A1, T, (tx, ty))
        R = int(size * 0.30)
        lo, hi = size // 2 - R, size // 2 + R
        mean = float(abs(A0[lo:hi, lo:hi] - Bt[lo:hi, lo:hi]).mean())
        if mean > tol:
            errs.append(f"{name}: pixel invariance fails for op "
                        f"M={o['M']} v={o['v']} s={o['s']} tau={o['tau']} "
                        f"(mean diff {mean:.1f})")
    return errs


def main():
    errs = []
    cat = json.load(open("../docs/data/catalog.json"))
    for g in cat["groups"]:
        errs += verify_spec_2d(g["render"], f'catalog {g["id"]} {g["symbol"]}')
    print(f"algebraic check: 275 catalog specs -> {len(errs)} errors")

    feat = json.load(open("../docs/data/featured.json"))
    for name, spec in feat["specs"].items():
        errs += verify_spec_2d(spec, f"featured {name}")
    for strip in feat["strips"]:
        errs += verify_strip(strip, strip["name"])
    print(f"+ featured/strips -> total {len(errs)} errors")

    # pixel checks: all featured specs + a sample of catalog entries
    pix_targets = [(n, s) for n, s in feat["specs"].items()]
    import random
    random.seed(7)
    for g in random.sample(cat["groups"], 12):
        pix_targets.append((f'catalog {g["id"]} {g["symbol"]}', g["render"]))
    pix_errs = []
    for name, spec in pix_targets:
        pix_errs += pixel_invariance(spec, name)
    print(f"pixel invariance: {len(pix_targets)} specs -> {len(pix_errs)} errors")
    errs += pix_errs

    if errs:
        print("\nFAILURES:")
        for e in errs[:40]:
            print(" ", e)
        sys.exit(1)
    print("ALL ANIMATION SPECS VERIFIED ✓")


if __name__ == "__main__":
    main()
