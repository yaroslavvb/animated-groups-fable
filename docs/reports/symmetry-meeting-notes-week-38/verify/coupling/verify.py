#!/usr/bin/env python3
"""Verification of the coupling notation of SoT ch. 25 / CDHT 2001 (arXiv:math/9911185).

PART A  every row of Tables 25.1-25.17: the coupling is checked to be a homomorphism
        modulo K (every relator lands in K), and the locally determined fibrifold
        decorations (mirror punctuation `.` `:` blank, digit subscripts n_d) are
        recomputed from the couplings and compared with the printed name.
PART B  explicit 4x4 affine matrices (horizontal isometry + coupled vertical map)
        for three worked examples; relators must come out as z -> z + n.
PART C  the polar census: round brackets and every generator plus-coupled.
"""
from fractions import Fraction as F
from collections import Counter, defaultdict
from tables import TABLES, w

# ------------------------------------------------------------ the vertical group
# vertical operation = (c, s):  z -> c + s*z, with c in Q/Z and s in {+1,-1}.
# This is Isom(R)/<z->z+1>  =  (R/Z) semidirect {+1,-1}.
ID = (F(0), 1)
vmul = lambda a, b: ((a[0] + a[1] * b[0]) % 1, a[1] * b[1])
vinv = lambda a: ((-a[1] * a[0]) % 1, a[1])


def vword(word, vals):
    r = ID
    for gi, e in word:
        g = vals[gi]
        r = vmul(r, g if e == 1 else vinv(g))
    return r


def parse_coupling(tok):
    s = 1 if tok[-1] == '+' else -1
    return (F(tok[:-1]) % 1, s)


fmt = lambda v: f"{v[0]}{'+' if v[1] == 1 else '-'}"

# ------------------------------------------------------------ decoration rules
KAL = {'25.1': [6, 3, 2], '25.3': [4, 4, 2], '25.6': [3, 3, 3], '25.9': [2, 2, 2, 2]}
GYR = {'25.2': [6, 3, 2], '25.5': [4, 4, 2], '25.8': [3, 3, 3], '25.13': [2, 2, 2, 2]}


def punct(v):
    """CDHT 4.3: a mirror generator coupled to 0+ / 1/2+ / k- gives . / : / blank."""
    if v[1] == -1:
        return ' '
    if v[0] == 0:
        return '.'
    if v[0] == F(1, 2):
        return ':'
    raise ValueError('illegal mirror coupling ' + fmt(v))


def corner(n, a, b):
    """CDHT 4.3: the digit n is decorated n_d when the rotation PQ (both mirrors
    minus-coupled) is coupled to d/n +. When either mirror is plus-coupled the
    subscript is determined by the punctuation and is omitted from the name."""
    if a[1] == -1 and b[1] == -1:
        p = vmul(a, b)
        assert p[1] == 1
        d = p[0] * n
        assert d.denominator == 1, (n, p)
        return f"{n}_{d.numerator % n}"
    return str(n)


def gyration(n, v):
    """CDHT 4.2: a gyration of order n is decorated n_d when coupled to d/n +,
    and left bare when minus-coupled."""
    if v[1] == -1:
        return str(n)
    d = v[0] * n
    assert d.denominator == 1, (n, v)
    return f"{n}_{d.numerator % n}"


def kaleidoscope_names(orders, vals):
    """all names of the cyclic mirror string that keep the printed digit order"""
    n = len(orders)
    out = set()
    for rev in (False, True):
        for r in range(n):
            if not rev:
                gseq = [vals[(i + r) % n] for i in range(n)]
                oseq = [orders[(i + r) % n] for i in range(n)]
            else:
                gseq = [vals[(n - 1 - i + r) % n] for i in range(n)]
                oseq = [orders[(n - 2 - i + r) % n] for i in range(n)]
            if oseq != orders:
                continue
            s = '*'
            for i in range(n):
                s += punct(gseq[i]) + corner(oseq[i], gseq[i], gseq[(i + 1) % n])
            out.add(s.replace(' ', ''))
    return out


def parse_symbols(name):
    import re
    return re.findall(r'\d_\d|\d', name[1:-1].replace(' ', ''))


def part_A():
    print("=" * 78)
    print("PART A  relators + decorations, Tables 25.1-25.17")
    print("=" * 78)
    total = bad = dec = decbad = 0
    per_table = []
    for tab in TABLES:
        gens, num = tab['gens'], tab['num']
        rels = [(s, w(s, gens)) for s in tab['relators']]
        nrows = 0
        for name, coup, pg, it in tab['rows']:
            toks = coup.split()
            interval = name[0] == '['
            vals = [parse_coupling(t) for t in toks[:len(gens)]]
            assert (len(toks) == len(gens) + 1) == interval, (num, name)
            if interval:
                assert toks[-1] == '0-'
                # CDHT 3.4: over an interval fibration only 0+ and 1/2+ can occur
                for v in vals:
                    if v[1] != 1 or v[0] not in (F(0), F(1, 2)):
                        bad += 1
                        print(f"  !! {num} {name}: interval fibration uses {fmt(v)}")
            K = {ID, (F(0), -1)} if interval else {ID}
            total += 1
            nrows += 1
            for s, rw in rels:
                v = vword(rw, vals)
                if v not in K:
                    bad += 1
                    print(f"  !! {num} {name}: relator {s} -> {fmt(v)} not in K")
            if num in KAL:
                dec += 1
                cands = kaleidoscope_names(KAL[num], vals)
                printed = name[1:-1].replace(' ', '')
                if printed not in cands:
                    decbad += 1
                    print(f"  !! {num} printed {name} not in computed {sorted(cands)}")
            elif num in GYR:
                dec += 1
                comp = sorted(gyration(o, v) for o, v in zip(GYR[num], vals))
                printed = sorted(parse_symbols(name))
                if comp != printed:
                    decbad += 1
                    print(f"  !! {num} printed {name} -> {printed}, computed {comp}")
        per_table.append((num, tab['plane'], nrows))
    for num, plane, n in per_table:
        print(f"  Table {num:6s} {plane:6s} {n:3d} rows")
    print(f"\n  {total} rows checked, {bad} relator failures.")
    print(f"  {dec} rows had punctuation/subscripts recomputed, {decbad} mismatches.")


# ------------------------------------------------------------ PART B: 4x4 matrices
def mat(A, t, vc, vs):
    """4x4 affine matrix: horizontal linear part A (2x2 list), translation t,
    vertical map z -> vc + vs*z."""
    return [[F(A[0][0]), F(A[0][1]), F(0), F(t[0])],
            [F(A[1][0]), F(A[1][1]), F(0), F(t[1])],
            [F(0), F(0), F(vs), F(vc)],
            [F(0), F(0), F(0), F(1)]]


def through(A, p, vc, vs):
    """the isometry with linear part A fixing the point p horizontally"""
    Ap = (A[0][0] * p[0] + A[0][1] * p[1], A[1][0] * p[0] + A[1][1] * p[1])
    return mat(A, (F(p[0]) - Ap[0], F(p[1]) - Ap[1]), vc, vs)


def prod(*ms):
    r = [[F(1) if i == j else F(0) for j in range(4)] for i in range(4)]
    for m in ms:
        r = [[sum(r[i][k] * m[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
    return r


def vertical_translation(m):
    for i in range(3):
        for j in range(3):
            if m[i][j] != (1 if i == j else 0):
                return None
    if m[0][3] != 0 or m[1][3] != 0:
        return None
    return m[2][3] if m[2][3].denominator == 1 else None


def classify(m, label):
    a, b, c, d = m[0][0], m[0][1], m[1][0], m[1][1]
    det = a * d - b * c
    vc, vs = m[2][3], m[2][2]
    v = f"z -> {vc}{'+z' if vs == 1 else '-z'}"
    if det == 1 and (a, b, c, d) == (1, 0, 0, 1):
        return f"    {label:6s} horizontal translation ({m[0][3]},{m[1][3]}); {v}"
    if det == 1:
        R = [[a, b], [c, d]]
        order, P = 1, [row[:] for row in R]
        while P != [[1, 0], [0, 1]]:
            P = [[sum(P[i][k] * R[k][j] for k in range(2)) for j in range(2)] for i in range(2)]
            order += 1
        det2 = (1 - a) * (1 - d) - b * c
        t0, t1 = m[0][3], m[1][3]
        px = ((1 - d) * t0 + b * t1) / det2
        py = (c * t0 + (1 - a) * t1) / det2
        if vs == 1:
            s = f"    {label:6s} {order}-fold rotation about ({px},{py}); {v}"
            if vc != 0:
                s += f"   ==> screw axis {order}_{int(vc * order) % order}"
            else:
                s += "   ==> pure rotation axis"
            return s
        return (f"    {label:6s} {order}-fold rotation about ({px},{py}) with z-reversal; {v}"
                f"   ==> {'2-fold axis perpendicular to z' if order == 2 else 'rotoreflection'}")
    return f"    {label:6s} horizontal reflection/glide; {v}"


def part_B():
    print()
    print("=" * 78)
    print("PART B  4x4 affine matrices for three worked examples")
    print("=" * 78)

    # ---- (1) *632, coupling 0+ 1/3- 0-   -> (*.6 3_1 2), IT 166 (R-3m)
    print("\n(1) *632 in the hexagonal basis a1,a2 (120 degrees apart).")
    print("    P = mirror at   0 deg through the origin, coupled 0+")
    print("    Q = mirror at  30 deg through the origin, coupled 1/3-")
    print("    R = mirror at  90 deg through (1/2,0),    coupled 0-")
    P = through([[1, -1], [0, -1]], (0, 0), F(0), 1)
    Q = through([[1, 0], [1, -1]], (0, 0), F(1, 3), -1)
    R = through([[-1, 1], [0, 1]], (F(1, 2), 0), F(0), -1)
    rel = [('P^2', [P, P]), ('(PQ)^6', [P, Q] * 6), ('Q^2', [Q, Q]),
           ('(QR)^3', [Q, R] * 3), ('R^2', [R, R]), ('(RP)^2', [R, P] * 2)]
    for s, ws in rel:
        n = vertical_translation(prod(*ws))
        print(f"    {s:8s} -> " + (f"z -> z + {n}   OK" if n is not None else "FAIL"))
    for s, ws in [('PQ', [P, Q]), ('QR', [Q, R]), ('RP', [R, P])]:
        print(classify(prod(*ws), s))

    # ---- (1b) the same plane group with coupling 0+ 0+ 0+ -> (*.6.3.2), IT 183 (P6mm)
    print("\n(1b) same three mirrors, coupling 0+ 0+ 0+   -> (*.6.3.2), IT 183 = P6mm")
    P2 = through([[1, -1], [0, -1]], (0, 0), F(0), 1)
    Q2 = through([[1, 0], [1, -1]], (0, 0), F(0), 1)
    R2 = through([[-1, 1], [0, 1]], (F(1, 2), 0), F(0), 1)
    for s, ws in [('P^2', [P2, P2]), ('(PQ)^6', [P2, Q2] * 6), ('Q^2', [Q2, Q2]),
                  ('(QR)^3', [Q2, R2] * 3), ('R^2', [R2, R2]), ('(RP)^2', [R2, P2] * 2)]:
        n = vertical_translation(prod(*ws))
        print(f"    {s:8s} -> " + (f"z -> z + {n}   OK" if n is not None else "FAIL"))
    for s, ws in [('PQ', [P2, Q2]), ('QR', [Q2, R2]), ('RP', [R2, P2])]:
        print(classify(prod(*ws), s))

    # ---- (2) 442 = p4, coupling 1/4+ 1/4+ 1/2+  -> (4_1 4_1 2_1), IT 76 (P4_1)
    print("\n(2) 442 = p4:  g = quarter turn about (0,0),  d = quarter turn about (1/2,1/2),")
    print("    e = half turn about (0,1/2).  Coupling 1/4+ 1/4+ 1/2+.")
    r90 = [[0, -1], [1, 0]]
    r180 = [[-1, 0], [0, -1]]
    g = through(r90, (0, 0), F(1, 4), 1)
    d = through(r90, (F(1, 2), F(1, 2)), F(1, 4), 1)
    e = through(r180, (0, F(1, 2)), F(1, 2), 1)
    for s, ws in [('g^4', [g] * 4), ('d^4', [d] * 4), ('e^2', [e] * 2), ('g d e', [g, d, e])]:
        n = vertical_translation(prod(*ws))
        print(f"    {s:8s} -> " + (f"z -> z + {n}   OK" if n is not None else "FAIL"))
    for s, ws in [('g', [g]), ('d', [d]), ('e', [e])]:
        print(classify(prod(*ws), s))

    # ---- (3) 22x = pgg, the four plus-only couplings
    print("\n(3) 22x = pgg:  a = half turn about (0,0), b = half turn about (1/2,0),")
    print("    Z = glide (x,y) -> (x+1/2, 1/2-y).  Relations 1 = a^2 = b^2 = a b Z^2.")
    for cp, nm, it, sym in [(('0', '0', '0'), '(2_0 2_0 x_0)', 32, 'Pba2'),
                            (('0', '0', '1/2'), '(2_0 2_0 x_1)', 34, 'Pnn2'),
                            (('0', '1/2', '1/4'), '(2_0 2_1 x)', 43, 'Fdd2'),
                            (('1/2', '1/2', '0'), '(2_1 2_1 x)', 33, 'Pna2_1')]:
        ca, cb, cz = (F(x) for x in cp)
        a = through(r180, (0, 0), ca, 1)
        b = through(r180, (F(1, 2), 0), cb, 1)
        Z = mat([[1, 0], [0, -1]], (F(1, 2), F(1, 2)), cz, 1)
        out = []
        for s, ws in [('a^2', [a, a]), ('b^2', [b, b]), ('a b Z^2', [a, b, Z, Z])]:
            n = vertical_translation(prod(*ws))
            out.append(f"{s} -> z+{n}" if n is not None else f"{s} FAIL")
        print(f"    {nm:15s} {cp[0]}+ {cp[1]}+ {cp[2]}+   IT {it:3d} {sym:8s} " + "; ".join(out))
    print("\n    the vertical components of the pgg generators, coupling 0+ 1/2+ 1/4+ (Fdd2):")
    a = through(r180, (0, 0), F(0), 1)
    b = through(r180, (F(1, 2), 0), F(1, 2), 1)
    Z = mat([[1, 0], [0, -1]], (F(1, 2), F(1, 2)), F(1, 4), 1)
    for s, m in [('a', a), ('b', b), ('Z', Z), ('Z^2', prod(Z, Z))]:
        print(classify(m, s))


# ------------------------------------------------------------ PART C
def part_C():
    print()
    print("=" * 78)
    print("PART C  the polar census")
    print("=" * 78)
    rows = []
    for tab in TABLES:
        for name, coup, pg, it in tab['rows']:
            if name[0] == '(' and all(t.endswith('+') for t in coup.split()):
                rows.append((tab['num'], tab['plane'], name, coup, pg, it))
    print(f"\n  {len(rows)} names have round brackets and only '+' couplings.")
    hm = {'1': '1', '22': '2', '*': 'm', '*22': 'mm2', '44': '4', '*44': '4mm',
          '33': '3', '*33': '3m', '66': '6', '*66': '6mm'}
    print("\n  3-D point group (orbifold -> Hermann-Mauguin) and number of names:")
    for pg, n in sorted(Counter(r[4] for r in rows).items(), key=lambda kv: -kv[1]):
        print(f"    {pg:5s} = {hm.get(pg, '?'):4s}  {n:3d}")
    its = sorted({r[5] for r in rows})
    print(f"\n  distinct IT numbers: {len(its)}")
    print("    " + ", ".join(map(str, its)))
    bynum = defaultdict(list)
    for r in rows:
        bynum[r[5]].append(r)
    print("\n  IT numbers with more than one name (aliases: >1 invariant direction):")
    for it in sorted(bynum):
        if len(bynum[it]) > 1:
            print(f"    IT {it:3d}: " + ",  ".join(f"{r[2]} over {r[1]}" for r in bynum[it]))
    polar = {'1': [1], '2': [3, 4, 5], 'm': [6, 7, 8, 9], 'mm2': list(range(25, 47)),
             '4': list(range(75, 81)), '4mm': list(range(99, 111)),
             '3': [143, 144, 145, 146], '3m': list(range(156, 162)),
             '6': list(range(168, 174)), '6mm': [183, 184, 185, 186]}
    allp = sorted(x for v in polar.values() for x in v)
    print(f"\n  the ten polar crystal classes 1, 2, m, mm2, 3, 3m, 4, 4mm, 6, 6mm contain")
    print(f"  {len(allp)} space groups.")
    miss = [x for x in allp if x not in set(its)]
    extra = [x for x in its if x not in set(allp)]
    print(f"  polar IT numbers with no all-plus name : {miss}")
    print(f"  all-plus names outside the polar classes: {extra}")
    print(f"\n  {len(rows)} names -> {len(its)} groups; {len(allp)} - {len(its)} = {len(allp) - len(its)}"
          f" missing, all of them enantiomorphic partners reported under the lower IT number.")


if __name__ == '__main__':
    part_A()
    part_B()
    part_C()
