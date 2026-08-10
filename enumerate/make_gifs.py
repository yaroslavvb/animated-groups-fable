"""Render the featured gallery groups to looping GIFs (docs/gifs/).

Specs come from docs/data/featured.json (single source of truth shared with
the web renderer) and are verified against the group axioms before rendering.
"""

import json
import math
import os

from gifs import render_gif
from verify_animations import verify_spec_2d

RT3_2 = math.sqrt(3) / 2
SQ = [[1, 0], [0, 1]]
HEX = [[1, 0], [-0.5, RT3_2]]
ID = [[1, 0], [0, 1]]
R4 = [[0, -1], [1, 0]]
R2 = [[-1, 0], [0, -1]]
R6 = [[1, -1], [1, 0]]
R3 = [[0, -1], [1, -1]]
MY = [[-1, 0], [0, 1]]


def powmat(M, k):
    A = [[1, 0], [0, 1]]
    for _ in range(k):
        A = [[M[0][0] * A[0][0] + M[0][1] * A[1][0],
              M[0][0] * A[0][1] + M[0][1] * A[1][1]],
             [M[1][0] * A[0][0] + M[1][1] * A[1][0],
              M[1][0] * A[0][1] + M[1][1] * A[1][1]]]
    return A


FEATURED_IDS = ["p4-timescrew", "p6-timescrew", "p3-timescrew",
                "pm-timeglide", "p2-timecentred", "glide-time-reversal",
                "palindromic-windmill"]

_here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_here, "..", "docs", "data", "featured.json")) as f:
    _FEAT = json.load(f)
FEATURED = {k: _FEAT["specs"][k] for k in FEATURED_IDS}

if __name__ == "__main__":
    outdir = os.path.join("..", "docs", "gifs")
    os.makedirs(outdir, exist_ok=True)
    for name, spec in FEATURED.items():
        errs = verify_spec_2d(spec, name)
        if errs:
            raise SystemExit("spec fails group verification: " + "; ".join(errs))
        path = os.path.join(outdir, f"{name}.gif")
        render_gif(spec, path, size=420, frames=40, cell=100)
        print("wrote", path)
