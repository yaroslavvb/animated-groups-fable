"""Validation: the engine must reproduce the 17 wallpaper groups.

2D, no time: arithmetic classes = (point group, lattice) pairs; classes of
fractional-translation cocycles modulo H^1 and normalizer moves must give:
  (1,obl)1 (2,obl)1 (m,P)2 (m,C)1 (2mm,P)3 (2mm,C)1 (4)1 (4mm)2
  (3)1 (3m1)1 (31m)1 (6)1 (6mm)1        -> total 17.
"""

from fractions import Fraction

from stcore import (ArithClass, Lattice, find_conjugations, group_closure,
                    reduce_classes)

M_R2 = ((-1, 0), (0, -1))
M_MX = ((1, 0), (0, -1))
M_MY = ((-1, 0), (0, 1))
M_R4 = ((0, -1), (1, 0))
M_R3 = ((0, -1), (1, -1))
M_R6 = ((1, -1), (1, 0))
M_SWAP = ((0, 1), (1, 0))
M_NSWAP = ((0, -1), (-1, 0))

H = Fraction(1, 2)

CASES = [
    ("1-obl", [], []),
    ("2-obl", [M_R2], []),
    ("m-P", [M_MX], []),
    ("m-C", [M_MX], [(H, H)]),
    ("2mm-P", [M_R2, M_MX], []),
    ("2mm-C", [M_R2, M_MX], [(H, H)]),
    ("4-sq", [M_R4], []),
    ("4mm-sq", [M_R4, M_MX], []),
    ("3-hex", [M_R3], []),
    ("3m1-hex", [M_R3, M_NSWAP], []),
    ("31m-hex", [M_R3, M_SWAP], []),
    ("6-hex", [M_R6], []),
    ("6mm-hex", [M_R6, M_SWAP], []),
]

EXPECTED = {
    "1-obl": 1, "2-obl": 1, "m-P": 2, "m-C": 1, "2mm-P": 3, "2mm-C": 1,
    "4-sq": 1, "4mm-sq": 2, "3-hex": 1, "3m1-hex": 1, "31m-hex": 1,
    "6-hex": 1, "6mm-hex": 1,
}


def build(name, gens, cents):
    lat = Lattice(2, False, cents)
    P = group_closure([(M, 1) for M in gens], 2)
    return name, ArithClass(P, lat)


def main():
    classes = [build(*c) for c in CASES]

    # --- all 13 must be pairwise inequivalent
    for i in range(len(classes)):
        for j in range(i + 1, len(classes)):
            ni, ci = classes[i]
            nj, cj = classes[j]
            if len(ci.P) != len(cj.P):
                continue
            conj = find_conjugations(ci, cj, bound=2, max_found=1)
            assert not conj, f"unexpected equivalence {ni} ~ {nj}"
    print("13 arithmetic classes pairwise inequivalent: OK")

    # --- redundant settings must dedupe
    _, alt = build("m-C-alt", [M_MY], [(H, H)])
    _, mc = build("m-C", [M_MX], [(H, H)])
    assert find_conjugations(alt, mc, bound=2, max_found=1), "m-C-alt should ~ m-C"
    print("redundant setting dedupes: OK")

    # --- group counts per class
    total = 0
    for name, ac in classes:
        D2, reps = ac.h1_with_reps()
        moves = find_conjugations(ac, ac, bound=1)
        orbits = reduce_classes(ac, reps, moves)
        n = len(orbits)
        total += n
        status = "OK" if n == EXPECTED[name] else f"EXPECTED {EXPECTED[name]}"
        print(f"  {name:10s} |P|={len(ac.P):2d} H1-reps={len(reps):3d} groups={n}  {status}")
        assert n == EXPECTED[name], (name, n)
    assert total == 17, total
    print(f"TOTAL wallpaper groups: {total}  (expected 17)  ✓")


if __name__ == "__main__":
    main()
