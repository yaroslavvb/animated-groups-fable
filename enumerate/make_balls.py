#!/usr/bin/env python3
"""End-to-end: solve a self-consistent time-loop billiard and write the gif.

Budget: the whole thing under ten seconds. Roughly half goes to the solver,
the rest to drawing and encoding.
"""

import argparse
import random
import time

from particles_gif import Group
import render_balls as R
import solve_baseline as SB


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", default="g226")
    ap.add_argument("--balls", type=int, default=5)
    ap.add_argument("--radius", type=float, default=0.085)
    ap.add_argument("--steps", type=int, default=90)
    ap.add_argument("--frames", type=int, default=60)
    ap.add_argument("--size", type=int, default=600)
    ap.add_argument("--cell-px", type=float, default=250.0)
    ap.add_argument("--margin", type=float, default=1.02)
    ap.add_argument("--gain", type=float, default=2.2)
    ap.add_argument("--rounds", type=int, default=18)
    ap.add_argument("--phases", type=int, default=26)
    ap.add_argument("--min-sep", type=int, default=3)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--tries", type=int, default=3,
                    help="seeds to try before giving up on a layout")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    t0 = time.time()
    g = Group(a.group)
    choices = [(1, 0), (0, 1), (1, 1), (-1, 1), (1, -1), (-1, 0), (0, -1)]
    d_min = 2 * a.radius * a.margin

    # Not every random layout admits a collision-free loop at this size, so try
    # a few. The starts are seeded collision-free at t = 0 first: they are
    # pinned, and a violation at t = 0 is one no amount of bending can repair.
    B = V = L = None
    for attempt in range(a.tries):
        rng = random.Random(a.seed + attempt)
        try:
            starts = SB.seed_starts(g, a.balls, d_min * 1.05, rng)
        except RuntimeError:
            continue
        drifts = [list(rng.choice(choices)) for _ in range(a.balls)]
        B, V, L, phases, ok = SB.solve(g, starts, drifts, a.radius, S=a.steps,
                                       margin=a.margin, phases=a.phases,
                                       rounds=a.rounds, gain=a.gain,
                                       min_sep=a.min_sep)
        rep = R.report(g, B, V, L, a.steps, a.radius)
        if rep["min_clearance_ratio"] >= 1.0:
            if attempt:
                print(f"  (layout {a.seed + attempt} after {attempt} that did not close)")
            break
    t_solve = time.time() - t0

    t1 = time.time()
    imgs = R.render(g, B, V, L, a.steps, a.radius, size=a.size,
                    frames=a.frames, cell_px=a.cell_px)
    t_render = time.time() - t1
    t2 = time.time()
    out = a.out or str(R.ROOT / "docs" / "gifs" / f"{a.group}-balls.gif")
    R.save_gif(imgs, out)
    t_save = time.time() - t2

    print(f"{a.group}  {g.symbol}")
    print(f"  {a.balls} balls x {len(g.ops)} copies per cell; drifts "
          f"{[tuple(int(x) for x in l) for l in L]} cells per period")
    print(f"  kinks/ball {rep['kinks_per_ball']:.1f}   straight between them "
          f"{100 * rep['straight_fraction']:.1f}% of steps")
    print(f"  min centre distance {rep['min_clearance']:.4f} vs diameter "
          f"{2 * a.radius:.4f}  -> "
          f"{'NO OVERLAP' if rep['min_clearance_ratio'] >= 1 else 'OVERLAP'}")
    print(f"  symmetry residual {rep['symmetry_residual']:.1e}")
    print(f"  solve {t_solve:.2f}s  render {t_render:.2f}s  save {t_save:.2f}s"
          f"  TOTAL {time.time() - t0:.2f}s")
    print(f"  wrote {out}")


if __name__ == "__main__":
    main()
