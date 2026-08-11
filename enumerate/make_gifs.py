"""Render the featured gallery groups to looping GIFs (docs/gifs/).

Specs come from docs/data/featured.json (single source of truth shared with
the web renderer) and are verified against the group axioms before rendering.
"""

import json
import math
import os

from gifs import render_gif
from verify_animations import verify_spec_2d

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
        # cell left to gifs._auto_cell: the same repeat count the site shows
        render_gif(spec, path, size=420, frames=40)
        print("wrote", path)
