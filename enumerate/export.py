"""Build the catalog: features, names, clockwork-orbifold symbols, JSON.

Input: out/enum2p1.pkl (from enumerate_2p1.py) and the 1+1D run.
Output: ../docs/data/catalog.json
"""

import json
import math
import pickle
from fractions import Fraction

from stcore import (ArithClass, Lattice, cocycle_sigma, find_conjugations,
                    group_closure, op_identity, op_mul, rmat_vec, rmat_inv)

M_ID = ((1, 0), (0, 1))
M_R2 = ((-1, 0), (0, -1))
H = Fraction(1, 2)


# ------------------------------------------------------------- basic helpers
def frac1(x):
    return Fraction(x) % 1


def spatial_order(M):
    x, k = M, 1
    while x != M_ID:
        x = tuple(tuple(sum(x[i][p] * M[p][j] for p in range(2)) for j in range(2))
                  for i in range(2))
        k += 1
        assert k <= 6
    return k


def det2(M):
    return M[0][0] * M[1][1] - M[0][1] * M[1][0]


def full_ops(ac, vec):
    """List of (M, s, v_spatial(Fraction pair), tau) coset representatives."""
    sig = cocycle_sigma(ac, vec)
    out = []
    for (M, s), v in zip(ac.P, sig):
        out.append((M, s, (frac1(v[0]), frac1(v[1])), frac1(v[2])))
    return out


def lattice_residues(ac):
    """Nonzero residues (spatial pair, tau) of the spacetime lattice mod Z^3."""
    return [tuple(r) for r in sorted(ac.lat.residues) if any(r)]


# ------------------------------------------------- spatial projection (base)
def spatial_projection(ac, vec):
    """The 2D crystallographic group obtained by forgetting time.

    Returns (Q_ops, lat2, sig2): Q_ops = spatial point ops (dedup over s),
    lat2 = 2D lattice incl. spatial parts of all spacetime translations and
    reversal glide vectors, sig2 = dict M -> spatial translation part."""
    ops = full_ops(ac, vec)
    cents2 = set()
    for r in ac.lat.residues:
        if (r[0], r[1]) != (0, 0):
            cents2.add((frac1(r[0]), frac1(r[1])))
    # reversal ops with identity spatial part project to translations
    for (M, s, v, tau) in ops:
        if M == M_ID and s == -1 and v != (Fraction(0), Fraction(0)):
            cents2.add(v)
    lat2 = Lattice(2, False, tuple(cents2))
    sig2 = {}
    for (M, s, v, tau) in ops:
        if M not in sig2 or s == 1:  # prefer s=+1 representative
            sig2[M] = v
    Q = sorted(sig2.keys())
    return Q, lat2, sig2


def mirror_axis(M):
    """Primitive integer +1-eigenvector of a det=-1 involution."""
    # solve (M - I) a = 0
    a11, a12 = M[0][0] - 1, M[0][1]
    a21, a22 = M[1][0], M[1][1] - 1
    if a11 == 0 and a12 == 0:
        cand = (1, 0)
    elif a21 == 0 and a22 == 0:
        cand = (0, 1)
    elif a12 != 0 or a11 != 0:
        cand = (-a12, a11)
    else:
        cand = (-a22, a21)
    from math import gcd
    g = gcd(abs(cand[0]), abs(cand[1])) or 1
    c = (cand[0] // g, cand[1] // g)
    # canonical sign
    if c[0] < 0 or (c[0] == 0 and c[1] < 0):
        c = (-c[0], -c[1])
    assert (M[0][0] * c[0] + M[0][1] * c[1], M[1][0] * c[0] + M[1][1] * c[1]) == c
    return c


def axis_lattice_step(lat2, a):
    """Smallest q>0 with q*a in lat2 (a primitive integer direction)."""
    for q in (1, 2, 3, 4, 6):
        if lat2.contains([Fraction(q * a[0]), Fraction(q * a[1])]):
            return q
    raise ValueError


def glide_time_data(M, v, tau, lat2, time_of_translation):
    """For a reflection (M|v, tau): reduce over composing with lattice
    translations to classify its line family. Returns a set of
    (glide_frac, time_frac) pairs occurring on ONE line family and the number
    of distinct line families, as a dict keyed by line offset class."""
    a = mirror_axis(M)
    families = {}
    # enumerate lattice translations t (small reps incl. centerings)
    reps = [(Fraction(i), Fraction(j)) for i in (0, 1) for j in (0, 1)]
    reps += [(r[0], r[1]) for r in lat2.residues]
    seen = set()
    for (tx, ty) in reps:
        for (ix, iy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            t = (frac1(tx + ix), frac1(ty + iy))
            if t in seen:
                continue
            seen.add(t)
            if not lat2.contains([t[0], t[1]]):
                continue
            w = (frac1(v[0] + t[0]), frac1(v[1] + t[1]))
            tau_w = frac1(tau + time_of_translation(t))
            # line offset: component of w perpendicular to axis, halved
            # line: x = M x + w  =>  offset o = w_perp / 2  (mod lattice/2 proj)
            # glide component: w_parallel reduced mod axis step
            # use dual coords: express w = alpha*a + beta*b for b complement
            o, gl = _decompose_along_axis(w, a)
            key = frac1(o)
            fam = families.setdefault(key, set())
            fam.add((frac1(gl), tau_w))
    return a, families


def _decompose_along_axis(w, a):
    """w = gl * a + perp; return (offset_scalar, gl) with a simple complement."""
    # complement direction: rotate a by 90 in lattice coords approximation:
    b = (-a[1], a[0])
    det = a[0] * b[1] - a[1] * b[0]
    gl = Fraction(w[0] * b[1] - w[1] * b[0], det)
    off = Fraction(-w[0] * a[1] + w[1] * a[0], det)
    return off, gl


# ------------------------------------------------------- wallpaper naming
def wallpaper_name(ac, vec):
    """Name of the spatial projection among the 17 wallpaper groups."""
    Q, lat2, sig2 = spatial_projection(ac, vec)
    n_rot = max(spatial_order(M) for M in Q if det2(M) == 1) if any(
        det2(M) == 1 for M in Q) else 1
    has_refl = any(det2(M) == -1 for M in Q)
    centered = len(lat2.residues) > 1

    def time_zero(t):
        return Fraction(0)

    if n_rot == 6:
        return "p6m" if has_refl else "p6"
    if n_rot == 4:
        if not has_refl:
            return "p4"
        # p4m vs p4g: does some mirror line pass through a 4-fold center
        # with zero glide? equivalent: exists reflection with pure rep
        return "p4m" if _has_pure_mirror_through_origin_class(
            Q, lat2, sig2, 4) else "p4g"
    if n_rot == 3:
        if not has_refl:
            return "p3"
        # p3m1 vs p31m by mirror-axis type relative to the 3-fold matrices
        return _p3m_variant(Q, lat2, sig2)
    if n_rot == 2:
        if not has_refl:
            return "p2"
        if centered:
            return "cmm"
        glides = _mirror_class_glide_count(Q, lat2, sig2)
        return {0: "pmm", 1: "pmg", 2: "pgg"}[glides]
    # n_rot == 1
    if not has_refl:
        return "p1"
    if centered:
        return "cm"
    glides = _mirror_class_glide_count(Q, lat2, sig2)
    return "pg" if glides else "pm"


def _mirror_class_glide_count(Q, lat2, sig2):
    """Number of reflection-axis-direction classes that are glide-only."""
    dirs = {}
    for M in Q:
        if det2(M) != -1:
            continue
        a = mirror_axis(M)
        v = sig2[M]
        _, families = glide_time_data(M, v, Fraction(0), lat2, lambda t: Fraction(0))
        pure_exists = any((Fraction(0), Fraction(0)) in fam or
                          any(g == 0 for (g, _) in fam)
                          for fam in families.values())
        dirs[a] = dirs.get(a, False) or pure_exists
    return sum(1 for ok in dirs.values() if not ok)


def _has_pure_mirror_through_origin_class(Q, lat2, sig2, n):
    for M in Q:
        if det2(M) != -1:
            continue
        v = sig2[M]
        _, families = glide_time_data(M, v, Fraction(0), lat2, lambda t: Fraction(0))
        for fam in families.values():
            if any(g == 0 for (g, _) in fam):
                return True
    return False


def _p3m_variant(Q, lat2, sig2):
    """p3m1 vs p31m: in our hex convention (R3 = [[0,-1],[1,-1]]),
    mirrors of type +-swap distinguish the two settings; decide by whether
    all 3-fold centers lie on mirrors (p3m1) or not (p31m)."""
    # centers of 3-fold rotations; mirrors lines; test incidence
    centers = rotation_centers(Q, lat2, sig2, 3)
    mirrors = [M for M in Q if det2(M) == -1]
    for (p, _) in centers:
        on_any = False
        for M in mirrors:
            v = sig2[M]
            # line of the reflection x -> Mx + v (+ lattice): p on a line iff
            # exists t in lat2 with M p + v + t == p
            w = (frac1(p[0] - (M[0][0] * p[0] + M[0][1] * p[1]) - v[0]),
                 frac1(p[1] - (M[1][0] * p[0] + M[1][1] * p[1]) - v[1]))
            if lat2.contains([w[0], w[1]]):
                on_any = True
                break
        if not on_any:
            return "p31m"
    return "p3m1"


def rotation_centers(Q, lat2, sig2, order_wanted=None):
    """Return [(center(Fraction pair), M)] one per (op, lattice-class)."""
    out = []
    for M in Q:
        if det2(M) != 1 or M == M_ID:
            continue
        n = spatial_order(M)
        if order_wanted and n != order_wanted:
            continue
        v = sig2[M]
        A = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
        det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
        Ainv = ((Fraction(A[1][1], det), Fraction(-A[0][1], det)),
                (Fraction(-A[1][0], det), Fraction(A[0][0], det)))
        # centers: p = Ainv (v + t) over translation residues mod (I-M)L
        seen = set()
        reps = set()
        for r in list(lat2.residues) + [(Fraction(0), Fraction(0))]:
            for i in range(-2, 3):
                for j in range(-2, 3):
                    t = (r[0] + i, r[1] + j)
                    p = (frac1(Ainv[0][0] * (v[0] + t[0]) + Ainv[0][1] * (v[1] + t[1])),
                         frac1(Ainv[1][0] * (v[0] + t[0]) + Ainv[1][1] * (v[1] + t[1])))
                    if p not in seen:
                        seen.add(p)
        out.extend((p, M) for p in sorted(seen))
    return out


# --------------------------------------------------------------- main export
def main():
    with open("out/enum2p1.pkl", "rb") as f:
        data = pickle.load(f)
    print(f"loaded {data['total']} groups in {len(data['classes'])} classes")
    # next stage: build entries (implemented after enumeration validated)


if __name__ == "__main__":
    main()
