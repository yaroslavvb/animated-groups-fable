"""Choose each spec's lattice ASPECT RATIO — a free modulus of the cell, not
part of the group's classification — so that the orbit of the motif is as
isotropic as possible on screen.

Why this exists. The renderer scales both lattice vectors by one number, so
the picture's spacing is whatever the stored basis says. For a rectangular
group like pm the four sites of a cell (a point, its mirror image, and the
two glide images) all share one y coordinate: with a square cell they land in
a tight row, and the rows sit a whole cell apart. The result is a diagram of
a few crowded rows separated by bands of empty background — the failure this
script removes. Squashing the cell to a quarter of its height puts the same
points on a square grid, and the film is the same film: the aspect ratio of
a rectangular (or oblique) cell is a continuous parameter that no symmetry
fixes.

What may be changed, and what may not. Scaling the picture by
S = R(theta) diag(1,q) R(-theta) is admissible only if every operation stays
an isometry afterwards — S A S^-1 orthogonal for each op's cartesian matrix A.
That test is what distinguishes the free systems (oblique, rectangular,
centred rectangular) from the rigid ones (square, hexagonal, trigonal), and it
is applied here rather than assumed from the group's name. The axis theta has
to be searched too, not read off the first lattice vector: the enumeration
stores several cells rotated into their canonical view, and for those the
direction that may be stretched is not the one the basis happens to start
with.

Objective: maximise the minimum orbit distance per unit cell area,
minD / sqrt(area), which is scale-free and is exactly what the renderer's
motif size is limited by. The base point is re-optimised for each candidate
aspect (the two choices interact), reusing optimize_bases.

Post-processes docs/data/catalog.json and docs/data/featured.json in place;
run optimize_bases.py first, this one second.
"""

import json
import math

from optimize_bases import _sites, min_orbit_dist, best_base

Q_LO, Q_HI = 1.0 / 6, 6.0     # keep cells within a factor of six of square
MIN_GAIN = 1.05               # leave a spec alone unless it clearly improves


def _cart(B):
    """render convention: b1, b2 in cartesian pixels with y flipped"""
    return (B[0][0], -B[0][1]), (B[1][0], -B[1][1])


def axis_candidates(B):
    """directions worth trying as the stretch axis: the lattice vectors, their
    sum and difference (the diagonals of the cell), and the cartesian axes"""
    dirs = [B[0], B[1],
            [B[0][0] + B[1][0], B[0][1] + B[1][1]],
            [B[0][0] - B[1][0], B[0][1] - B[1][1]],
            [1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [1.0, -1.0]]
    out = []
    for d in dirs:
        th = math.atan2(d[1], d[0]) % math.pi
        if all(abs(th - t) > 1e-6 for t in out):
            out.append(th)
    return out


def scaled_basis(B, q, th):
    """B with the cartesian picture scaled by q along the direction PERPENDICULAR
    to `th`, i.e. R(th) diag(1,q) R(-th)."""
    c, s = math.cos(th), math.sin(th)
    # S = R(th) diag(1,q) R(-th)
    S = ((c * c + q * s * s, c * s - q * c * s),
         (c * s - q * c * s, s * s + q * c * c))
    return [[S[0][0] * r[0] + S[0][1] * r[1],
             S[1][0] * r[0] + S[1][1] * r[1]] for r in B]


def ops_stay_isometries(spec, B, tol=1e-6):
    """every op's cartesian matrix B M B^-1 must remain orthogonal"""
    b1, b2 = (B[0][0], B[0][1]), (B[1][0], B[1][1])
    Bm = ((b1[0], b2[0]), (b1[1], b2[1]))          # columns are the vectors
    det = Bm[0][0] * Bm[1][1] - Bm[0][1] * Bm[1][0]
    if abs(det) < 1e-12:
        return False
    Bi = ((Bm[1][1] / det, -Bm[0][1] / det), (-Bm[1][0] / det, Bm[0][0] / det))
    for op in spec["ops"]:
        M = op["M"]
        T = [[sum(Bm[i][k] * M[k][j] for k in (0, 1)) for j in (0, 1)]
             for i in (0, 1)]
        A = [[sum(T[i][k] * Bi[k][j] for k in (0, 1)) for j in (0, 1)]
             for i in (0, 1)]
        for i in (0, 1):
            for j in (0, 1):
                want = 1.0 if i == j else 0.0
                if abs(sum(A[k][i] * A[k][j] for k in (0, 1)) - want) > tol:
                    return False
    return True


def _score(spec, B, base):
    b1, b2 = _cart(B)
    area = abs(B[0][0] * B[1][1] - B[0][1] * B[1][0])
    if area < 1e-12:
        return 0.0
    return min_orbit_dist(spec, base, b1, b2, _sites(spec)) / math.sqrt(area)


def _best_at(spec, q, th, grid):
    """best (score, base, basis) for aspect q about axis th, or None if that
    stretch would stop some operation being an isometry"""
    B = scaled_basis(spec["basis"], q, th)
    if not ops_stay_isometries(spec, B):
        return None
    probe = dict(spec)
    probe["basis"] = B
    base, _ = best_base(probe, grid=grid)
    return _score(spec, B, base), base, B


def best_aspect(spec):
    """(basis, base, gain) — the stored ones unchanged when nothing is free"""
    B0 = spec["basis"]
    base0 = spec.get("base", [0.31, 0.17])
    s0 = _score(spec, B0, base0)
    # which axes may be stretched at all: probe each with one off-square q,
    # so the expensive scan below runs only for the free directions
    axes = [th for th in axis_candidates(B0)
            if ops_stay_isometries(spec, scaled_basis(B0, 1.3, th))]
    if not axes:
        return B0, base0, 1.0
    coarse = [Q_LO * (Q_HI / Q_LO) ** (k / 16) for k in range(17)]
    best = (s0, base0, B0, 1.0, 0.0)
    for th in axes:
        for q in coarse:
            r = _best_at(spec, q, th, grid=6)
            if r and r[0] > best[0]:
                best = (r[0], r[1], r[2], q, th)
    if best[3] == 1.0:
        return B0, base0, 1.0
    # refine around the winning aspect with a finer base search
    for q in [best[3] * f for f in (0.82, 0.9, 0.96, 1.0, 1.04, 1.11, 1.22)]:
        if not (Q_LO <= q <= Q_HI):
            continue
        r = _best_at(spec, q, best[4], grid=14)
        if r and r[0] > best[0]:
            best = (r[0], r[1], r[2], q, best[4])
    gain = best[0] / s0 if s0 > 0 else float("inf")
    if gain < MIN_GAIN:
        return B0, base0, 1.0
    B = [[round(x, 6) for x in row] for row in best[2]]
    return B, best[1], gain


def process(specs, label):
    changed = []
    for name, spec in specs:
        B, base, gain = best_aspect(spec)
        if gain > 1.0:
            spec["basis"] = B
            spec["base"] = base
            changed.append((gain, name))
    changed.sort(reverse=True)
    print(f"{label}: {len(changed)}/{len(specs)} specs re-proportioned")
    for gain, name in changed[:10]:
        print(f"    x{gain:.2f}  {name}")
    return changed


def main():
    cat = json.load(open("../docs/data/catalog.json"))
    process([(f'{g["id"]} {g["symbol"]}', g["render"]) for g in cat["groups"]],
            "catalog")
    json.dump(cat, open("../docs/data/catalog.json", "w"), indent=1)

    feat = json.load(open("../docs/data/featured.json"))
    process(list(feat["specs"].items()), "featured")
    json.dump(feat, open("../docs/data/featured.json", "w"), indent=1)


if __name__ == "__main__":
    main()
