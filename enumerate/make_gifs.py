"""Render the featured gallery groups to looping GIFs (docs/gifs/)."""

import math
import os

from gifs import render_gif

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


FEATURED = {
    "p4-timescrew": {
        "basis": SQ, "base": [0.33, 0.15],
        "ops": [{"M": powmat(R4, k), "v": [0, 0], "s": 1, "tau": k / 4}
                for k in range(4)]},
    "p6-timescrew": {
        "basis": HEX, "base": [0.36, 0.13],
        "ops": [{"M": powmat(R6, k), "v": [0, 0], "s": 1, "tau": k / 6}
                for k in range(6)]},
    "p3-timescrew": {
        "basis": HEX, "base": [0.36, 0.13],
        "ops": [{"M": powmat(R3, k), "v": [0, 0], "s": 1, "tau": k / 3}
                for k in range(3)]},
    "pm-timeglide": {
        "basis": SQ, "base": [0.27, 0.2],
        "ops": [{"M": ID, "v": [0, 0], "s": 1, "tau": 0},
                {"M": MY, "v": [0, 0], "s": 1, "tau": 0.5}]},
    "p2-timecentred": {
        "basis": SQ, "base": [0.3, 0.17],
        "ops": [{"M": ID, "v": [0, 0], "s": 1, "tau": 0},
                {"M": R2, "v": [0, 0], "s": 1, "tau": 0},
                {"M": ID, "v": [0.5, 0.5], "s": 1, "tau": 0.5},
                {"M": R2, "v": [0.5, 0.5], "s": 1, "tau": 0.5}]},
    "glide-time-reversal": {
        "basis": SQ, "base": [0.27, 0.2],
        "ops": [{"M": ID, "v": [0, 0], "s": 1, "tau": 0},
                {"M": ID, "v": [0.5, 0], "s": -1, "tau": 0}]},
    "palindromic-windmill": {
        "basis": SQ, "base": [0.33, 0.15],
        "ops": [{"M": powmat(R4, k), "v": [0, 0], "s": s,
                 "tau": 0.5 if k % 2 else 0}
                for k in range(4) for s in (1, -1)]},
}

if __name__ == "__main__":
    outdir = os.path.join("..", "docs", "gifs")
    os.makedirs(outdir, exist_ok=True)
    for name, spec in FEATURED.items():
        path = os.path.join(outdir, f"{name}.gif")
        render_gif(spec, path, size=420, frames=40, cell=100)
        print("wrote", path)
