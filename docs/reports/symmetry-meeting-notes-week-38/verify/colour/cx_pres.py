"""SoT ch.10 presentations of the 17 wallpaper groups + Smith normal form.

Generators and relators are exactly those of
  the upstream generator repository's scripts/colour_generator_actions.py
  (GENERATOR_GEOMETRY / GROUP_PRESENTATIONS), which in turn follow
  The Symmetries of Things, ch. 10 / Tables 11.1-13.1.

A relator is a word: a tuple of (generator, exponent) pairs.
"""
from fractions import Fraction as F

GENS = {
    "p1": ("X", "Y"),
    "p2": ("α", "β", "γ", "δ"),
    "pm": ("α", "P", "Q"),
    "pg": ("Y", "Z"),
    "cm": ("P", "Z"),
    "pmm": ("P", "Q", "R", "S"),
    "pmg": ("α", "β", "P"),
    "pgg": ("α", "β", "Z"),
    "cmm": ("α", "P", "Q"),
    "p4": ("α", "β", "γ"),
    "p4m": ("P", "Q", "R"),
    "p4g": ("α", "P"),
    "p3": ("α", "β", "γ"),
    "p3m1": ("P", "Q", "R"),
    "p31m": ("α", "P"),
    "p6": ("α", "β", "γ"),
    "p6m": ("P", "Q", "R"),
}

ORB = {"p1": "o", "p2": "2222", "pm": "**", "pg": "xx", "cm": "*x",
       "pmm": "*2222", "pmg": "22*", "pgg": "22x", "cmm": "2*22",
       "p4": "442", "p4m": "*442", "p4g": "4*2", "p3": "333",
       "p3m1": "*333", "p31m": "3*3", "p6": "632", "p6m": "*632"}

# International-Tables order used by the site
IT_ORDER = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
            "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"]


def pw(word, e):
    return tuple(word) * e


def comm(a, b):
    return ((a, 1), (b, 1), (a, -1), (b, -1))


RELATORS = {
    "p1": (comm("X", "Y"),),
    "p2": ((("α", 2),), (("β", 2),), (("γ", 2),), (("δ", 2),),
           (("α", 1), ("β", 1), ("γ", 1), ("δ", 1))),
    "pm": ((("P", 2),), (("Q", 2),), comm("α", "P"), comm("α", "Q")),
    "pg": ((("Y", 2), ("Z", 2)),),
    "cm": ((("P", 2),), (("P", 1), ("Z", 2), ("P", 1), ("Z", -2))),
    "pmm": ((("P", 2),), (("Q", 2),), (("R", 2),), (("S", 2),),
            pw((("P", 1), ("Q", 1)), 2), pw((("Q", 1), ("R", 1)), 2),
            pw((("R", 1), ("S", 1)), 2), pw((("S", 1), ("P", 1)), 2)),
    "pmg": ((("α", 2),), (("β", 2),), (("P", 2),),
            (("α", 1), ("β", 1), ("P", 1), ("β", -1), ("α", -1), ("P", -1))),
    "pgg": ((("α", 2),), (("β", 2),), (("α", 1), ("β", 1), ("Z", 2))),
    "cmm": ((("α", 2),), (("P", 2),), (("Q", 2),),
            pw((("P", 1), ("Q", 1)), 2),
            pw((("Q", 1), ("α", 1), ("P", 1), ("α", -1)), 2)),
    "p4": ((("α", 4),), (("β", 4),), (("γ", 2),),
           (("α", 1), ("β", 1), ("γ", 1))),
    "p4m": ((("P", 2),), (("Q", 2),), (("R", 2),),
            pw((("P", 1), ("Q", 1)), 4), pw((("Q", 1), ("R", 1)), 4),
            pw((("R", 1), ("P", 1)), 2)),
    "p4g": ((("α", 4),), (("P", 2),),
            pw((("P", 1), ("α", 1), ("P", 1), ("α", -1)), 2)),
    "p3": ((("α", 3),), (("β", 3),), (("γ", 3),),
           (("α", 1), ("β", 1), ("γ", 1))),
    "p3m1": ((("P", 2),), (("Q", 2),), (("R", 2),),
             pw((("P", 1), ("Q", 1)), 3), pw((("Q", 1), ("R", 1)), 3),
             pw((("R", 1), ("P", 1)), 3)),
    "p31m": ((("α", 3),), (("P", 2),),
             pw((("P", 1), ("α", 1), ("P", 1), ("α", -1)), 3)),
    "p6": ((("α", 6),), (("β", 3),), (("γ", 2),),
           (("α", 1), ("β", 1), ("γ", 1))),
    "p6m": ((("P", 2),), (("Q", 2),), (("R", 2),),
            pw((("P", 1), ("Q", 1)), 6), pw((("Q", 1), ("R", 1)), 3),
            pw((("R", 1), ("P", 1)), 2)),
}

RELATION_TEXT = {
    "p1": "XY = YX",
    "p2": "α² = β² = γ² = δ² = αβγδ = 1",
    "pm": "P² = Q² = 1; αP = Pα; αQ = Qα",
    "pg": "Y²Z² = 1",
    "cm": "P² = PZ²PZ⁻² = 1",
    "pmm": "P² = Q² = R² = S² = (PQ)² = (QR)² = (RS)² = (SP)² = 1",
    "pmg": "α² = β² = P² = 1; αβP = Pαβ",
    "pgg": "α² = β² = αβZ² = 1",
    "cmm": "α² = P² = Q² = (PQ)² = (QαPα⁻¹)² = 1",
    "p4": "α⁴ = β⁴ = γ² = αβγ = 1",
    "p4m": "P² = Q² = R² = (PQ)⁴ = (QR)⁴ = (RP)² = 1",
    "p4g": "α⁴ = P² = (PαPα⁻¹)² = 1",
    "p3": "α³ = β³ = γ³ = αβγ = 1",
    "p3m1": "P² = Q² = R² = (PQ)³ = (QR)³ = (RP)³ = 1",
    "p31m": "α³ = P² = (PαPα⁻¹)³ = 1",
    "p6": "α⁶ = β³ = γ² = αβγ = 1",
    "p6m": "P² = Q² = R² = (PQ)⁶ = (QR)³ = (RP)² = 1",
}


def expmat(fam):
    """Exponent-sum matrix: rows = relators, cols = generators."""
    gens = GENS[fam]
    idx = {g: i for i, g in enumerate(gens)}
    rows = []
    for r in RELATORS[fam]:
        row = [0] * len(gens)
        for g, e in r:
            row[idx[g]] += e
        rows.append(row)
    return rows


# ---------------------------------------------------------------- Smith form
def smith(Ain):
    """Smith normal form diagonal entries of an integer matrix (list of lists)."""
    A = [row[:] for row in Ain]
    m = len(A)
    n = len(A[0]) if m else 0
    res = []
    r = c = 0
    while r < m and c < n:
        # find pivot: smallest nonzero |entry| in the remaining submatrix
        piv = None
        for i in range(r, m):
            for j in range(c, n):
                if A[i][j] and (piv is None or abs(A[i][j]) < abs(A[piv[0]][piv[1]])):
                    piv = (i, j)
        if piv is None:
            break
        i0, j0 = piv
        A[r], A[i0] = A[i0], A[r]
        for row in A:
            row[c], row[j0] = row[j0], row[c]
        done = False
        while not done:
            done = True
            for i in range(r + 1, m):
                if A[i][c]:
                    q = A[i][c] // A[r][c]
                    for j in range(c, n):
                        A[i][j] -= q * A[r][j]
                    if A[i][c]:
                        A[r], A[i] = A[i], A[r]
                        done = False
            for j in range(c + 1, n):
                if A[r][j]:
                    q = A[r][j] // A[r][c]
                    for i in range(r, m):
                        A[i][j] -= q * A[i][c]
                    if A[r][j]:
                        for i in range(r, m):
                            A[i][c], A[i][j] = A[i][j], A[i][c]
                        done = False
        res.append(abs(A[r][c]))
        r += 1
        c += 1
    # divisibility chain
    changed = True
    while changed:
        changed = False
        for i in range(len(res) - 1):
            a, b = res[i], res[i + 1]
            if b % a:
                g = gcd(a, b)
                res[i], res[i + 1] = g, a * b // g
                changed = True
    return res


def gcd(a, b):
    while b:
        a, b = b, a % b
    return abs(a)


def abelianisation(fam):
    """Return (free_rank, [torsion invariant factors]) of Gamma^ab."""
    E = expmat(fam)
    d = smith(E)
    ngen = len(GENS[fam])
    rank = ngen - len([x for x in d if x])
    tors = [x for x in d if x > 1]
    return rank, tors


def n_homs(fam, n):
    """|Hom(Gamma, Z_n)| from the abelianisation."""
    rank, tors = abelianisation(fam)
    total = n ** rank
    for d in tors:
        total *= gcd(d, n)
    return total


def homs_to_Zn(fam, n):
    """Brute-force list of all homs Gamma -> Z_n as tuples over GENS[fam]."""
    import itertools
    E = expmat(fam)
    out = []
    for c in itertools.product(range(n), repeat=len(GENS[fam])):
        if all(sum(e * ci for e, ci in zip(row, c)) % n == 0 for row in E):
            out.append(c)
    return out


def surjective(c, n):
    g = n
    for x in c:
        g = gcd(g, x)
    return g == 1


if __name__ == "__main__":
    print("%-6s %-7s %-10s %-34s" % ("fam", "orb", "Gamma^ab", "relations"))
    for fam in IT_ORDER:
        rank, tors = abelianisation(fam)
        s = ("Z^%d" % rank if rank else "") + ("" if not tors else
             ("+" if rank else "") + "+".join("Z_%d" % d for d in tors))
        print("%-6s %-7s %-10s %-34s" % (fam, ORB[fam], s or "0", RELATION_TEXT[fam]))
    print()
    NS = [2, 3, 4, 5, 6, 7, 8, 12]
    print("%-6s" % "fam" + "".join("%9s" % ("n=%d" % n) for n in NS))
    for fam in IT_ORDER:
        row = []
        for n in NS:
            h = homs_to_Zn(fam, n)
            assert len(h) == n_homs(fam, n), (fam, n, len(h), n_homs(fam, n))
            s = [c for c in h if surjective(c, n)]
            row.append("%d/%d" % (len(s), len(h)))
        print("%-6s" % fam + "".join("%9s" % x for x in row))
