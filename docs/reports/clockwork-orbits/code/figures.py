#!/usr/bin/env python3
"""Draw the tutorial's two picture strips from what original.py recorded.

    python3 figures.py [--run DIR] [--out DIR]

Reads DIR/results.json and DIR/snapshots.npz (default: ./original-run) and writes
WebP panels into ../assets/ (or --out):

  gl-t<time>.webp      the Ginzburg-Landau field |B| settling out of noise (step 2)
  newton-<k>.webp      the u chemical of Newton iterate k, 0 being the lifted seed (step 4)

The colours are the site's ember palette; the view is two lattice cells across,
drawn on the triangular lattice the way the site draws it.  NumPy and Pillow only.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

EMBER = np.array([[0.00, 18, 9, 39], [0.22, 65, 12, 94], [0.43, 99, 25, 116], [0.58, 171, 45, 90],
                  [0.69, 240, 111, 32], [0.78, 252, 181, 42], [0.89, 253, 219, 94],
                  [1.00, 252, 242, 158]], float)
GL_TIMES = [0, 2, 5, 8, 12, 50]
NEWTON_STEPS = [0, 35, 36, 37, 39, 43]


def sample(grid, size, cells=2.0):
    """Values on a size x size view, `cells` lattice lengths across, y up.

    Lattice basis a1 = (1, 0), a2 = (-1/2, sqrt3/2); node (i, j) of grid[j, i] sits at
    (i/N, j/N).  Linear on the triangle each pixel falls in, the rhombus being cut along
    its short diagonal, as the site's renderer does."""
    n = grid.shape[-1]
    y, x = np.indices((size, size))
    X = (x + .5) / size * cells
    Y = (size - y - .5) / size * cells
    v = Y / (np.sqrt(3) / 2)
    u = X + v / 2
    xf, yf = (u * n) % n, (v * n) % n
    ix, iy = np.floor(xf).astype(int), np.floor(yf).astype(int)
    fx, fy = xf - ix, yf - iy
    q00, q10 = grid[iy, ix], grid[iy, (ix + 1) % n]
    q01, q11 = grid[(iy + 1) % n, ix], grid[(iy + 1) % n, (ix + 1) % n]
    return np.where(fx >= fy, (1 - fx) * q00 + (fx - fy) * q10 + fy * q11,
                    (1 - fy) * q00 + (fy - fx) * q01 + fx * q11)


def picture(grid, path, size=300):
    """Each panel on its own range: these pictures are about shape, not level."""
    s = sample(np.asarray(grid, float), 2 * size)
    t = (s - s.min()) / (s.max() - s.min())
    rgb = np.stack([np.interp(t, EMBER[:, 0], EMBER[:, i]) for i in (1, 2, 3)], axis=2)
    img = Image.fromarray(rgb.round().astype(np.uint8)).resize((size, size), Image.LANCZOS)
    img.save(path, 'WEBP', quality=86, method=6)


def main(run: Path, out: Path):
    R = json.loads((run / 'results.json').read_text())
    S = np.load(run / 'snapshots.npz')
    out.mkdir(parents=True, exist_ok=True)
    sign = next(a['sign'] for a in R['gl']['attempts'] if a['accepted'])
    times = list(S['gl_early_times'])
    early = S[f'gl_early_s{sign:+d}']
    for t in GL_TIMES:
        picture(abs(early[times.index(t)]), out / f'gl-t{t}.webp')
    amp = R['newton'][-1]['amplitude']
    iterates = [S[f'seed_a{amp}']] + list(S[f'iterates_a{amp}'])
    for k in NEWTON_STEPS:
        picture(iterates[k][0], out / f'newton-{k}.webp')
    print('wrote', len(GL_TIMES) + len(NEWTON_STEPS), 'panels to', out)


if __name__ == '__main__':
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--run', default=str(here / 'original-run'))
    ap.add_argument('--out', default=str(here.parent / 'assets'))
    a = ap.parse_args()
    main(Path(a.run), Path(a.out))
