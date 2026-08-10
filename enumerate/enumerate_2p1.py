"""2+1D space-time ("film") groups.

Anchors (Ke & Wu, arXiv:2604.05619, Table 1):
  31 magnetic point groups, 14 Bravais lattices, 72 symmorphic classes,
  275 space-time groups total, by crystal system:
  Triclinic 2, T-Monoclinic 13, R-Monoclinic 13, Orthorhombic 127,
  Tetragonal 68, Trigonal 25, Hexagonal 27.
"""

import pickle
import sys
import time
from fractions import Fraction
from itertools import combinations
from multiprocessing import Pool

from stcore import (ArithClass, Lattice, find_conjugations, group_closure,
                    op_mul, op_identity, reduce_classes)
from driver import cheap_invariant, dedupe_pairs, enumerate_groups

ORIENT = "proper3"
GALILEAN = False  # crystallographic (Ke-Wu) convention; True = strict frame-preserving


def _dedupe_bucket(args):
    bucket, bound = args
    reps, merged = dedupe_pairs(bucket, bound=bound, orientation=ORIENT,
                                galilean=GALILEAN)
    return reps, merged


def _enum_class(args):
    name, ac, bound_moves = args
    D2, reps = ac.h1_with_reps()
    if len(reps) <= 1:
        return (name, ac, reps, len(reps), 0)
    moves = find_conjugations(ac, ac, bound=bound_moves, orientation=ORIENT,
                              galilean=GALILEAN)
    orbits = reduce_classes(ac, reps, moves)
    return (name, ac, orbits, len(reps), len(moves))

H = Fraction(1, 2)
T3 = Fraction(1, 3)

M_ID = ((1, 0), (0, 1))
M_R2 = ((-1, 0), (0, -1))
M_MX = ((1, 0), (0, -1))
M_R4 = ((0, -1), (1, 0))
M_R3 = ((0, -1), (1, -1))
M_R6 = ((1, -1), (1, 0))
M_SWAP = ((0, 1), (1, 0))


def ambient(setting):
    if setting == "sq":
        Q = group_closure([(M_R4, 1), (M_MX, 1)], 2)
    else:
        Q = group_closure([(M_R6, 1), (M_SWAP, 1)], 2)
    return [(M, s) for (M, _) in Q for s in (1, -1)]


def all_subgroups(ops, d):
    """All subgroups of the finite (M,s) group `ops`."""
    subs = {tuple(sorted(group_closure([], d)))}
    frontier = list(subs)
    while frontier:
        new = []
        for sub in frontier:
            for g in ops:
                if g in sub:
                    continue
                bigger = tuple(sorted(group_closure(list(sub) + [g], d)))
                if bigger not in subs:
                    subs.add(bigger)
                    new.append(bigger)
        frontier = new
    return sorted(subs, key=len)


def centering_pool(setting):
    """Candidate centering generator sets."""
    halves = []
    nz = [v for v in
          [(a * H, b * H, c * H) for a in (0, 1) for b in (0, 1) for c in (0, 1)]
          if any(v)]
    # all subgroups of (Z_2)^3 via generator subsets, deduped by residue set
    seen = {}
    for r in range(0, 4):
        for combo in combinations(nz, r):
            lat = Lattice(2, True, combo)
            key = tuple(sorted(lat.residues))
            if key not in seen:
                seen[key] = combo
    pools = list(seen.values())
    if setting == "hex":
        thirds = [(2 * T3, T3, T3), (T3, 2 * T3, T3)]
        extra = [(t,) for t in thirds]
        for t in thirds:
            for h in nz:
                extra.append((t, h))
        pools = pools + extra
    return pools


def classify_system(ac):
    """Ke-Wu crystal system from the point group (3D geometry with t-axis)."""
    P = ac.P
    orders = set()
    for (M, s) in P:
        # spatial order of M
        x, k = M, 1
        while x != M_ID:
            x = tuple(tuple(sum(x[i][p] * M[p][j] for p in range(2)) for j in range(2))
                      for i in range(2))
            k += 1
        orders.add((k, s, M[0][0] * M[1][1] - M[0][1] * M[1][0]))
    spatial_orders = {k for (k, s, dt) in orders}
    if (6, 1, 1) in orders or (3, -1, 1) in orders:
        return "Hexagonal"
    if 6 in spatial_orders or 3 in spatial_orders:
        return "Trigonal"
    if 4 in spatial_orders:
        return "Tetragonal"
    # only orders 1, 2 remain: count 2-fold "directions" (as actual axes)
    def eigdir(M, val):
        # primitive direction with M v = val*v
        a11, a12 = M[0][0] - val, M[0][1]
        a21, a22 = M[1][0], M[1][1] - val
        if a11 == 0 and a12 == 0:
            v = (1, 0)
        elif a21 == 0 and a22 == 0:
            v = (0, 1)
        elif (a11, a12) != (0, 0):
            v = (-a12, a11)
        else:
            v = (-a22, a21)
        from math import gcd
        g = gcd(abs(v[0]), abs(v[1])) or 1
        v = (v[0] // g, v[1] // g)
        if v[0] < 0 or (v[0] == 0 and v[1] < 0):
            v = (-v[0], -v[1])
        return v

    dirs = set()
    for (M, s) in P:
        det = M[0][0] * M[1][1] - M[0][1] * M[1][0]
        if M == M_ID and s == 1:
            continue
        if M == M_R2 and s == 1:
            dirs.add("t")                    # 2-fold along t
        elif M == M_ID and s == -1:
            dirs.add("t")                    # sigma_h, normal t
        elif M == M_R2 and s == -1:
            pass                             # inversion: no direction
        elif det == -1:
            # s=+1 vertical mirror: direction = its normal (-1 eigenvector);
            # s=-1 in-plane 2-fold: direction = its axis (+1 eigenvector)
            dirs.add(eigdir(M, 1) if s == -1 else eigdir(M, -1))
    total_dirs = len(dirs)
    if total_dirs == 0:
        return "Triclinic"
    if total_dirs == 1:
        if "t" in dirs:
            return "T-Monoclinic"
        return "R-Monoclinic"
    return "Orthorhombic"


def main():
    import time
    verbose = "-v" in sys.argv
    t0 = time.time()
    named = []
    seen_pairs = set()
    for setting in ("sq", "hex"):
        amb = ambient(setting)
        subs = all_subgroups(amb, 2)
        pools = centering_pool(setting)
        print(f"[{time.time()-t0:6.1f}s] {setting}: {len(subs)} subgroups x "
              f"{len(pools)} centerings", flush=True)
        boost_free = {(M_ID, 1), (M_R2, -1)}
        for i, P in enumerate(subs):
            # For P inside {1, 2'} every boost is allowed (Mv = sv holds for
            # all v), so every spacetime lattice is Galilean-equivalent to the
            # primitive one: keep only primitive (avoids expensive dedupe of
            # sixth-lattices; matches the Triclinic row of Ke-Wu Table 1).
            all_boosts = set(P) <= boost_free
            for j, cents in enumerate(pools):
                if all_boosts and cents:
                    continue
                try:
                    lat = Lattice(2, True, cents)
                    ac = ArithClass(list(P), lat)
                except AssertionError:
                    continue
                key = (tuple(P), tuple(sorted(lat.residues)))
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                named.append((f"{setting}:P{i}:L{j}", ac))
    print(f"[{time.time()-t0:6.1f}s] candidate (P, L) pairs: {len(named)}",
          flush=True)

    # --- dedupe by invariant bucket (sequential: pool proved flaky)
    buckets = {}
    for name, ac in named:
        buckets.setdefault(cheap_invariant(ac), []).append((name, ac))
    print(f"[{time.time()-t0:6.1f}s] {len(buckets)} invariant buckets, "
          f"largest {max(len(b) for b in buckets.values())}", flush=True)
    classes = []
    merged = {}
    for bi, b in enumerate(buckets.values()):
        reps, mg = _dedupe_bucket((b, 2))
        classes.extend(reps)
        merged.update(mg)
        print(f"[{time.time()-t0:6.1f}s]   bucket {bi+1}/{len(buckets)} "
              f"({len(b)} cands -> {len(reps)} classes)", flush=True)
    print(f"[{time.time()-t0:6.1f}s] arithmetic classes after dedupe: "
          f"{len(classes)}  (expected 72)", flush=True)

    enum = [_enum_class((n, a, 2)) for (n, a) in classes]
    total = 0
    by_system = {}
    out_classes = []
    for cname, ac, orbits, nh1, nmoves in enum:
        if verbose:
            print(f"  {cname:14s} |P|={len(ac.P):2d} H1={nh1:3d} "
                  f"moves={nmoves:3d} -> {len(orbits)} groups", flush=True)
        total += len(orbits)
        sysname = classify_system(ac)
        by_system[sysname] = by_system.get(sysname, 0) + len(orbits)
        out_classes.append((cname, ac, orbits))
    print(f"[{time.time()-t0:6.1f}s] TOTAL 2+1D space-time groups: {total}  "
          f"(expected 275)", flush=True)
    expected = {"Triclinic": 2, "T-Monoclinic": 13, "R-Monoclinic": 13,
                "Orthorhombic": 127, "Tetragonal": 68, "Trigonal": 25,
                "Hexagonal": 27}
    for k in expected:
        got = by_system.get(k, 0)
        mark = "OK" if got == expected[k] else f"EXPECTED {expected[k]}"
        print(f"  {k:14s} {got:4d}  {mark}")

    # per-(system, lattice-signature) rows for localization
    rows = {}
    for cname, ac, orbits in out_classes:
        sysname = classify_system(ac)
        sig = tuple(sorted(tuple(str(x) for x in r)
                           for r in ac.lat.residues if any(r)))
        key = (sysname, sig)
        rows.setdefault(key, [0, []])
        rows[key][0] += len(orbits)
        rows[key][1].append(f"{cname}({len(orbits)})")
    for (sysname, sig), (cnt, names) in sorted(rows.items()):
        print(f"    {sysname:14s} {cnt:3d}  res={sig}  {' '.join(names)}")

    with open("out/enum2p1.pkl", "wb") as f:
        pickle.dump({"classes": out_classes, "merged": merged,
                     "by_system": by_system, "total": total}, f)
    print("saved out/enum2p1.pkl", flush=True)


if __name__ == "__main__":
    main()
