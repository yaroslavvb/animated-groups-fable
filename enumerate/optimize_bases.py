"""Choose each spec's motif base point to MAXIMIZE the minimum distance
between orbit points (the deepest hole of the orbit). The renderer sizes
motifs by that minimum distance (stamps must not overlap, or paint order
would break exact invariance), so a badly placed base point — e.g. near a
mirror line, where a point and its image nearly coincide — crushes the whole
pattern. The max-min objective also automatically avoids symmetry loci,
keeping the base point generic.

Post-processes docs/data/catalog.json and docs/data/featured.json in place.
"""

import json
import math


def _sites(spec):
    """Dedupe ops by spatial action (M, v mod 1): a reversal partner of a
    forward op occupies the SAME site by construction — that is fine (the
    renderer superimposes both clocks) and must not count as distance zero."""
    seen = {}
    for op in spec["ops"]:
        key = (tuple(tuple(r) for r in op["M"]),
               round(op["v"][0] % 1, 9), round(op["v"][1] % 1, 9))
        seen.setdefault(key, op)
    return list(seen.values())


def min_orbit_dist(spec, base, b1, b2, sites=None):
    pts = []
    for op in (sites if sites is not None else _sites(spec)):
        M, v = op["M"], op["v"]
        bx = M[0][0] * base[0] + M[0][1] * base[1] + v[0]
        by = M[1][0] * base[0] + M[1][1] * base[1] + v[1]
        for m1 in (0, 1):
            for m2 in (0, 1):
                pts.append((bx + m1, by + m2))
    md = float("inf")
    n = len(pts)
    for i in range(n):
        xi, yi = pts[i]
        for j in range(i + 1, n):
            dxl = xi - pts[j][0]
            dyl = yi - pts[j][1]
            dx = dxl * b1[0] + dyl * b2[0]
            dy = dxl * b1[1] + dyl * b2[1]
            d = dx * dx + dy * dy
            if d < 1e-12:
                return 0.0        # base on a symmetry locus: reject
            if d < md:
                md = d
    return math.sqrt(md)


def best_base(spec, grid=14):
    B = spec["basis"]
    b1 = (B[0][0], -B[0][1])
    b2 = (B[1][0], -B[1][1])
    sites = _sites(spec)
    best, bestd = None, -1.0
    for gx in range(1, grid):
        for gy in range(1, grid):
            base = (gx / grid + 0.0137, gy / grid + 0.0071)
            d = min_orbit_dist(spec, base, b1, b2, sites)
            if d > bestd:
                bestd, best = d, base
    # refine around the winner
    step = 1.0 / (3 * grid)
    for dx in (-2, -1, 0, 1, 2):
        for dy in (-2, -1, 0, 1, 2):
            base = (best[0] + dx * step, best[1] + dy * step)
            d = min_orbit_dist(spec, base, b1, b2, sites)
            if d > bestd:
                bestd, best = d, base
    return [round(best[0] % 1, 4), round(best[1] % 1, 4)], bestd


def main():
    cat = json.load(open("../docs/data/catalog.json"))
    worst_before = worst_after = float("inf")
    for g in cat["groups"]:
        spec = g["render"]
        B = spec["basis"]
        b1 = (B[0][0], -B[0][1])
        b2 = (B[1][0], -B[1][1])
        d0 = min_orbit_dist(spec, spec.get("base", [0.31, 0.17]), b1, b2)
        base, d1 = best_base(spec)
        spec["base"] = base
        worst_before = min(worst_before, d0)
        worst_after = min(worst_after, d1)
    json.dump(cat, open("../docs/data/catalog.json", "w"), indent=1)
    print(f"catalog: worst min-orbit-distance {worst_before:.3f} -> "
          f"{worst_after:.3f}")

    feat = json.load(open("../docs/data/featured.json"))
    for name, spec in feat["specs"].items():
        base, d1 = best_base(spec)
        spec["base"] = base
        print(f"  featured {name}: base {base} (min dist {d1:.3f})")
    json.dump(feat, open("../docs/data/featured.json", "w"), indent=1)
    print("featured.json updated")


if __name__ == "__main__":
    main()
