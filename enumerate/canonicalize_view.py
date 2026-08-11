"""Canonicalize the VIEW ORIENTATION of every render spec: rotate the
cartesian basis so the principal mirror axis renders vertical (the
ToS / MathWorld convention — pm is two families of vertical mirrors), or,
for groups without reflections, so b1 is horizontal.

A pure rotation of the basis never touches the ops, the lattice, or the
orientation class (det sign preserved, so 4_1 stays 4_1): only the rendered
picture turns. Pixel-invariance verification re-derives everything from the
basis, so the full suite re-certifies the transformed specs.

Principal-mirror choice, in priority order: forward (s=+1) before reversal;
true mirror before glide (glide content of g^2 tested mod 2); tau = 0 before
tau = 1/2; smallest integer eigenvector (prefers lattice-parallel axes);
finally the smallest rotation. Deterministic, so re-running is idempotent.
"""

import json
import math
import sys

EPS = 1e-9


def frac(x):
    return ((x % 1.0) + 1.0) % 1.0


def _lattice_horizontal_after(B, rot):
    """Does some SHORTEST lattice vector end up horizontal after rotating by
    rot? Only shortest vectors count: on a square lattice the diagonals must
    not qualify, or the p4g family would keep its diamond orientation."""
    co, si = math.cos(rot), math.sin(rot)
    vecs = []
    for e in ((1, 0), (0, 1), (1, 1), (1, -1)):
        vx = e[0] * B[0][0] + e[1] * B[1][0]
        vy = e[0] * B[0][1] + e[1] * B[1][1]
        vecs.append((math.hypot(vx, vy), vx, vy))
    shortest = min(v[0] for v in vecs)
    for L, vx, vy in vecs:
        if L > shortest * 1.01:
            continue
        if abs(si * vx + co * vy) < 1e-9 * L:
            return True
    return False


def principal_rotation(spec):
    """Rotation angle (radians, cartesian CCW) canonicalizing the view.

    Canon (ToS / MathWorld / ITA): principal mirror vertical, and, when the
    mirror system allows it, a lattice vector horizontal (p4m, p6m, the
    rectangular families). Square lattices whose mirrors are all diagonal
    (the p4g family) stay lattice-aligned — canon draws 4*2 with an upright
    square and diagonal mirrors — as do groups without reflections."""
    B = spec["basis"]
    has4 = any(op["M"][0][0] + op["M"][1][1] == 0 and
               op["M"][0][0] * op["M"][1][1] - op["M"][0][1] * op["M"][1][0] == 1
               for op in spec["ops"])
    cands = []
    for op in spec["ops"]:
        M = op["M"]
        if M[0][0] * M[1][1] - M[0][1] * M[1][0] != -1:
            continue
        a, b = M[0][0] - 1, M[0][1]
        c, d = M[1][0], M[1][1] - 1
        e = (b, -a) if (abs(a) + abs(b)) else (d, -c)
        gg = math.gcd(int(abs(e[0])), int(abs(e[1]))) or 1
        e = (e[0] // gg, e[1] // gg)
        # cartesian direction of the mirror axis
        v = (e[0] * B[0][0] + e[1] * B[1][0], e[0] * B[0][1] + e[1] * B[1][1])
        ang = math.atan2(v[1], v[0])
        rot = (math.pi / 2 - ang + math.pi / 2) % math.pi - math.pi / 2
        # glide content of g^2 mod 2: even components = true mirror
        gx = (M[0][0] * op["v"][0] + M[0][1] * op["v"][1] + op["v"][0]) % 2
        gy = (M[1][0] * op["v"][0] + M[1][1] * op["v"][1] + op["v"][1]) % 2
        even = lambda x: min(abs(x), abs(x - 2)) < 1e-6
        is_mirror = even(gx) and even(gy)
        tau0 = frac(op["tau"]) < 1e-6 or frac(op["tau"]) > 1 - 1e-6
        cands.append((
            0 if op["s"] == 1 else 1,
            0 if is_mirror else 1,
            0 if tau0 else 1,
            0 if _lattice_horizontal_after(B, rot) else 1,
            max(abs(e[0]), abs(e[1])),
            round(abs(rot), 9),
            rot,
        ))
    if cands:
        cands.sort()
        best = cands[0]
        # square lattice with only-diagonal mirrors (4*2 family): canon keeps
        # the square upright and lets the mirrors run diagonally
        if has4 and best[3] == 1:
            return -math.atan2(B[0][1], B[0][0])
        return best[6]
    # no reflections: put b1 along +x
    return -math.atan2(B[0][1], B[0][0])


def rotate_basis(spec, th):
    if abs(th) < EPS:
        return False
    co, si = math.cos(th), math.sin(th)
    B = spec["basis"]
    spec["basis"] = [
        [round(co * bx - si * by, 12), round(si * bx + co * by, 12)]
        for bx, by in B
    ]
    return True


def main():
    ncat = nfeat = 0
    with open("../docs/data/catalog.json") as f:
        cat = json.load(f)
    for g in cat["groups"]:
        if rotate_basis(g["render"], principal_rotation(g["render"])):
            ncat += 1
    with open("../docs/data/catalog.json", "w") as f:
        json.dump(cat, f, ensure_ascii=False, indent=1)

    with open("../docs/data/featured.json") as f:
        feat = json.load(f)
    for name, spec in feat["specs"].items():
        if rotate_basis(spec, principal_rotation(spec)):
            nfeat += 1
    with open("../docs/data/featured.json", "w") as f:
        json.dump(feat, f, ensure_ascii=False, indent=1)
    print(f"rotated {ncat}/275 catalog specs, {nfeat} featured specs")

    # post-condition: principal mirror vertical / b1 horizontal, everywhere
    bad = 0
    for g in cat["groups"]:
        th = principal_rotation(g["render"])
        if abs(th) > 1e-6:
            print("NOT CANONICAL:", g["id"], g["symbol"], th)
            bad += 1
    print("post-check:", "all canonical" if not bad else f"{bad} FAILURES")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
