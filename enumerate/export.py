"""Build the catalog: features, names, clockwork-orbifold symbols, JSON.

Input: out/enum2p1.pkl (from enumerate_2p1.py) and the 1+1D run.
Output: ../docs/data/catalog.json
"""

import json
import math
import pickle
from fractions import Fraction

from stcore import (ArithClass, Lattice, cocycle_sigma, find_conjugations,
                    group_closure, op_identity, op_mul, rmat_mul, rmat_vec,
                    rmat_inv)

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
def spatial_projection(ac, vec, forward_only=False):
    """The 2D crystallographic group obtained by forgetting time.

    Returns (Q_ops, lat2, sig2): Q_ops = spatial point ops (dedup over s),
    lat2 = 2D lattice incl. spatial parts of all spacetime translations and
    (unless forward_only) reversal glide vectors, sig2 = dict M -> spatial
    translation part."""
    ops = full_ops(ac, vec)
    if forward_only:
        ops = [o for o in ops if o[1] == 1]
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
    """Primitive integer +1-eigenvector of a det=-1 involution.

    Any nonzero row (r1, r2) of (M - I) annihilates the eigenvector, which is
    therefore proportional to (-r2, r1)."""
    rows = [(M[0][0] - 1, M[0][1]), (M[1][0], M[1][1] - 1)]
    row = next((r for r in rows if r != (0, 0)), None)
    assert row is not None, "identity has no mirror axis"
    cand = (-row[1], row[0])
    from math import gcd
    g = gcd(abs(cand[0]), abs(cand[1])) or 1
    c = (cand[0] // g, cand[1] // g)
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
class WallpaperIdentifier:
    """Certified identification against the 17 canonical wallpaper models,
    using the same conjugation machinery validated in validate_2d.py."""

    def __init__(self):
        from validate_2d import CASES
        from stcore import find_conjugations, reduce_classes
        self.models = []
        for name, gens, cents in CASES:
            lat = Lattice(2, False, cents)
            P = group_closure([(M, 1) for M in gens], 2)
            acc = ArithClass(P, lat)
            D2, reps = acc.h1_with_reps()
            moves = find_conjugations(acc, acc, orientation="any")
            orbits = reduce_classes(acc, reps, moves)
            labeled = {}
            for v in orbits:
                label = self._label(name, acc, v)
                # closure: label every classify-key in the orbit
                seen = {acc.classify_cocycle(v)}
                frontier = [v]
                from stcore import apply_move
                while frontier:
                    w = frontier.pop()
                    for (K, perm) in moves:
                        u = apply_move(acc, K, perm, w)
                        c = acc.classify_cocycle(u)
                        if c not in seen:
                            seen.add(c)
                            frontier.append(u)
                for c in seen:
                    labeled[c] = label
            self.models.append((name, acc, labeled))

    @staticmethod
    def _label(case_name, acc, vec):
        """Names valid in the CANONICAL settings of validate_2d.CASES."""
        triv = acc.classify_cocycle(vec) == acc.classify_cocycle([0] * len(vec))
        sig = cocycle_sigma(acc, vec)
        if case_name == "1-obl":
            return "p1"
        if case_name == "2-obl":
            return "p2"
        if case_name == "m-P":
            return "pm" if triv else "pg"
        if case_name == "m-C":
            return "cm"
        if case_name == "2mm-P":
            if triv:
                return "pmm"
            glided = 0
            for (M, s), v in zip(acc.P, sig):
                if det2(M) == -1:
                    a = mirror_axis(M)
                    off, gl = _decompose_along_axis((frac1(v[0]), frac1(v[1])), a)
                    if frac1(gl) != 0:
                        glided += 1
            return "pgg" if glided >= 2 else "pmg"
        if case_name == "2mm-C":
            return "cmm"
        if case_name == "4-sq":
            return "p4"
        if case_name == "4mm-sq":
            return "p4m" if triv else "p4g"
        if case_name == "3-hex":
            return "p3"
        if case_name == "3m1-hex":
            return "p3m1"
        if case_name == "31m-hex":
            return "p31m"
        if case_name == "6-hex":
            return "p6"
        if case_name == "6mm-hex":
            return "p6m"
        raise ValueError(case_name)

    def identify(self, Q, lat2, sig2):
        from stcore import find_conjugations
        P2 = [(M, 1) for M in Q]
        ac2 = ArithClass(P2, lat2)
        ac2.h1_with_reps()
        for name, acc, labeled in self.models:
            if len(acc.P) != len(ac2.P):
                continue
            conjs = find_conjugations(ac2, acc, orientation="any", max_found=1)
            if not conjs:
                continue
            K, perm = conjs[0]
            # transport sigma rationally: sigma'(perm(g)) = N sigma(g),
            # N = B_c K B_2^{-1}; coords in acc: k = D2_c * B_c^{-1} sigma'
            N = rmat_mul(rmat_mul(acc.lat.B, [list(r) for r in K]), ac2.lat.Binv)
            m = len(ac2.P)
            kvec = [0] * (m * 2)
            for i in range(m):
                sg = [Fraction(sig2[ac2.P[i][0]][0]), Fraction(sig2[ac2.P[i][0]][1])]
                sp = rmat_vec(N, sg)
                coords = rmat_vec(acc.lat.Binv, sp)
                j = perm[i]
                for r in range(2):
                    x = Fraction(coords[r]) * acc.D2
                    assert x.denominator == 1, (name, x)
                    kvec[j * 2 + r] = int(x) % acc.D2
            c = acc.classify_cocycle(kvec)
            if c in labeled:
                return labeled[c]
            # cocycle class not in table: conjugation landed outside known
            # orbits (should not happen) — fall through to next model
        raise ValueError("no wallpaper identification")


_IDENT = None


def wallpaper_name(ac, vec, forward_only=False):
    """Name of the spatial projection among the 17 wallpaper groups."""
    global _IDENT
    if _IDENT is None:
        _IDENT = WallpaperIdentifier()
    Q, lat2, sig2 = spatial_projection(ac, vec, forward_only=forward_only)
    return _IDENT.identify(Q, lat2, sig2)


def _wallpaper_name_naive(ac, vec, forward_only=False):
    """Old heuristic classifier (kept for reference/tests)."""
    Q, lat2, sig2 = spatial_projection(ac, vec, forward_only=forward_only)
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


# --------------------------------------------------- geometry for the symbol
RT3_2 = math.sqrt(3) / 2


def cartesian_basis(ac):
    """Embedding of the lattice-coordinate basis into the plane for display."""
    if any(spatial_order(M) in (3, 6) for (M, s) in ac.P):
        return [[1, 0], [-0.5, RT3_2]]
    return [[1, 0], [0, 1]]


def ccw_phase(M, tau, basis):
    """Phase of the counterclockwise generator of the cyclic group <(M|tau)>.

    M has order n; returns (n, k) with the ccw generator advancing time k/n."""
    n = spatial_order(M)
    if n == 2:
        return (2, int(frac1(tau) * 2) % 2)
    B = basis
    C00 = B[0][0] * M[0][0] + B[1][0] * M[0][1]  # cartesian matrix entries:
    # C = Binv... easier: compute angle via action on basis vector 1
    # cartesian image of e1: M maps e1 -> (M[0][0], M[1][0]) in lattice coords
    ex = M[0][0] * B[0][0] + M[1][0] * B[1][0]
    ey = M[0][0] * B[0][1] + M[1][0] * B[1][1]
    ang = math.atan2(ey - 0, ex - 0) - math.atan2(B[0][1], B[0][0])
    ccw = (ang % (2 * math.pi)) < math.pi
    ph = frac1(tau) if ccw else frac1(-tau)
    k = int(ph * n) % n if (ph * n) % 1 == 0 else None
    assert k is not None, (M, tau, ph)
    return (n, k)


def rotation_orbit_classes(ops_render, lat2, basis):
    """Orbit classes of rotation centres: [(n, k)] sorted, using the full
    spatial action for orbit identification."""
    # collect (center, n, k) for all rotation ops composed with translations
    pts = {}
    for (M, s, v, tau) in ops_render:
        if s != 1 or det2(M) != 1 or M == M_ID:
            continue
        A = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
        det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
        Ainv = ((Fraction(A[1][1], det), Fraction(-A[0][1], det)),
                (Fraction(-A[1][0], det), Fraction(A[0][0], det)))
        for i in range(-1, 2):
            for j in range(-1, 2):
                t = (v[0] + i, v[1] + j)
                p = (frac1(Ainv[0][0] * t[0] + Ainv[0][1] * t[1]),
                     frac1(Ainv[1][0] * t[0] + Ainv[1][1] * t[1]))
                n, k = ccw_phase(M, tau, basis)
                cur = pts.get(p)
                if cur is None or n > cur[0]:
                    pts[p] = (n, k)
    # orbit identification under the spatial action of all ops_render
    classes = []
    seen = set()
    for p in sorted(pts):
        if p in seen:
            continue
        orbit = {p}
        frontier = [p]
        while frontier:
            q = frontier.pop()
            for (M, s, v, tau) in ops_render:
                img = (frac1(M[0][0] * q[0] + M[0][1] * q[1] + v[0]),
                       frac1(M[1][0] * q[0] + M[1][1] * q[1] + v[1]))
                if img in pts and img not in orbit:
                    orbit.add(img)
                    frontier.append(img)
        seen |= orbit
        n, k = pts[p]
        classes.append((n, k))
    classes.sort(key=lambda x: (-x[0], x[1]))
    return classes


def mirror_line_classes(ops_render, lat2):
    """Orbit classes of reflection lines: [(has_spatial_glide, time_half)]."""
    lines = {}
    for (M, s, v, tau) in ops_render:
        if s != 1 or det2(M) != -1:
            continue
        a = mirror_axis(M)
        for i in (0, 1):
            for j in (0, 1):
                w = (v[0] + i, v[1] + j)
                off, gl = _decompose_along_axis(w, a)
                key = (a, frac1(Fraction(off) / 2))  # line sits at off/2
                entry = lines.setdefault(key, set())
                entry.add((frac1(gl), frac1(tau)))
    # merge line families by group action is overkill; classify by direction
    # and by the *best* op on the line: pure mirror beats glide
    out = []
    for key, entry in sorted(lines.items()):
        has_pure_space = any(g == 0 for (g, t) in entry)
        time_vals = {t for (g, t) in entry if g == 0} if has_pure_space else \
                    {t for (g, t) in entry}
        time_half = 0 not in time_vals
        out.append((not has_pure_space, time_half, key[0]))
    # collapse duplicates per direction+type (offset classes often equivalent)
    uniq = {}
    for (glide, thalf, a) in out:
        k = (a, glide, thalf)
        uniq[k] = uniq.get(k, 0) + 1
    return uniq


# ------------------------------------------------------------------ symbol
SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")


def sub(k):
    return str(k).translate(SUB)


def clockwork_symbol(base, cones, has_time_centering, third_centering,
                     reversal_kind, mirror_info, forward_time_glides):
    """Assemble the display symbol. cones: [(n, k)] for the *forward* part."""
    prefix = "r" if third_centering else ("c" if has_time_centering else "")
    body = ""
    if base == "p1":
        body = "o"
    elif base in ("p2", "p3", "p4", "p6"):
        body = "".join(str(n) + (sub(k) if k else "") for (n, k) in cones)
    elif base == "pm":
        marks = forward_time_glides
        body = ("~" if marks >= 1 else "") + "*" + ("~" if marks == 2 else "") + "*"
    elif base == "pg":
        body = "××" if forward_time_glides == 0 else \
               ("×½×½" if forward_time_glides == 2 else "×½×")
    elif base == "cm":
        body = ("~" if forward_time_glides else "") + "*×"
    elif base == "pmm":
        body = "*" + "".join(("~" if i < forward_time_glides else "") + "2"
                             for i in range(4))
    elif base == "pmg":
        body = "".join(str(n) + (sub(k) if k else "") for (n, k) in cones[:2]) + \
               ("~*" if forward_time_glides else "*")
    elif base == "pgg":
        body = "".join(str(n) + (sub(k) if k else "") for (n, k) in cones[:2]) + \
               ("×½" if forward_time_glides else "×")
    elif base == "cmm":
        body = str(cones[0][0]) + (sub(cones[0][1]) if cones[0][1] else "")
        body += "~*" if forward_time_glides else "*"
        body += "".join(str(n) + (sub(k) if k else "") for (n, k) in cones[1:3])
    elif base == "p4m":
        body = "*" + "".join(str(n) + (sub(k) if k else "") for (n, k) in cones)
        if forward_time_glides:
            body = "~" + body
    elif base == "p4g":
        body = str(cones[0][0]) + (sub(cones[0][1]) if cones[0][1] else "")
        body += "~*" if forward_time_glides else "*"
        body += "".join(str(n) + (sub(k) if k else "") for (n, k) in cones[1:2])
    elif base == "p3m1":
        body = "*" + "".join(str(n) + (sub(k) if k else "") for (n, k) in cones)
        if forward_time_glides:
            body = "~" + body
    elif base == "p31m":
        body = str(cones[0][0]) + (sub(cones[0][1]) if cones[0][1] else "")
        body += "~*" if forward_time_glides else "*"
        body += "".join(str(n) + (sub(k) if k else "") for (n, k) in cones[1:2])
    elif base == "p6m":
        body = "*" + "".join(str(n) + (sub(k) if k else "") for (n, k) in cones)
        if forward_time_glides:
            body = "~" + body
    else:
        body = base
    sym = prefix + body
    if reversal_kind:
        sym += "/" + reversal_kind
    return sym


# --------------------------------------------------------------- entry build
def ops_render_list(ac, vec):
    """Coset reps for the renderer: point ops composed with centering reps."""
    ops = full_ops(ac, vec)
    out = []
    for (M, s, v, tau) in ops:
        for r in sorted(ac.lat.residues):
            out.append((M, s, (frac1(v[0] + r[0]), frac1(v[1] + r[1])),
                        frac1(tau + r[2])))
    return out


def reversal_kind_of(ops_render, lat2):
    """Canonical descriptor of the reversing coset, or None."""
    revs = [(M, s, v, tau) for (M, s, v, tau) in ops_render if s == -1]
    if not revs:
        return None
    # prefer identity spatial part
    for (M, s, v, tau) in revs:
        if M == M_ID:
            return "1′" if lat2.contains([v[0], v[1]]) else "g′"
    # else prefer smallest order op; mirrors before rotations at order 2
    def rank(op):
        M = op[0]
        n = spatial_order(M)
        return (n, 0 if det2(M) == -1 else 1)
    revs.sort(key=rank)
    M = revs[0][0]
    n = spatial_order(M)
    if det2(M) == -1:
        return "m′"
    return f"{n}′"


def is_product(ops_render, ac, lat2):
    """G is (plane group) x (time group)?"""
    # any time-mixed lattice residue kills it
    for r in ac.lat.residues:
        if r[2] != 0 and (r[0], r[1]) != (0, 0):
            return False
    # forward ops must have zero time offsets
    for (M, s, v, tau) in ops_render:
        if s == 1 and tau != 0:
            return False
    # a reversal element must project into the forward spatial group
    revs = [(M, s, v, tau) for (M, s, v, tau) in ops_render if s == -1]
    if revs:
        fwd = {(M, v) for (M, s, v, tau) in ops_render if s == 1}
        ok = any((M, v) in fwd for (M, s, v, tau) in revs)
        if not ok:
            return False
    return True


def gen_strings(ac, vec):
    """Human-readable generators."""
    out = ["t(1,0 | 0)   t(0,1 | 0)   t(0,0 | 1)      # lattice"]
    for r in sorted(ac.lat.residues):
        if any(r):
            out.append(f"t({r[0]},{r[1]} | {r[2]})      # centring")
    sig = cocycle_sigma(ac, vec)
    gen_idx = ac._generator_indices()
    names = {(1, 1): "id", (2, 1): "R180", (3, 1): "R120", (4, 1): "R90",
             (6, 1): "R60"}
    for i in gen_idx:
        (M, s) = ac.P[i]
        v = sig[i]
        n = spatial_order(M)
        if det2(M) == 1:
            opname = names.get((n, 1), f"R{n}")
        else:
            opname = "m"
        if s == -1:
            opname += "·mt" if M != M_ID or det2(M) == 1 else "·mt"
            if M == M_ID:
                opname = "mt"
        out.append(f"( {opname} | {frac1(v[0])},{frac1(v[1])} | "
                   f"{frac1(v[2])} )   # M={M}, s={s}")
    return out


def build_entry(cname, ac, vec, idx):
    basis = cartesian_basis(ac)
    ops_r = ops_render_list(ac, vec)
    Q, lat2, sig2 = spatial_projection(ac, vec)
    base = wallpaper_name(ac, vec)
    base_fwd = wallpaper_name(ac, vec, forward_only=True)
    fwd_ops = [(M, s, v, tau) for (M, s, v, tau) in ops_r if s == 1]
    cones = rotation_orbit_classes(fwd_ops, lat2, basis)
    mirrors = mirror_line_classes(fwd_ops, lat2)
    n_tglide_dirs = len({a for (a, glide, thalf), cnt in mirrors.items()
                         if thalf and not glide})
    has_tc = any(r[2] == Fraction(1, 2) and (r[0], r[1]) != (0, 0)
                 for r in ac.lat.residues)
    third = any(Fraction(r[2]).denominator == 3 for r in ac.lat.residues)
    revkind = reversal_kind_of(ops_r, lat2)
    forward = revkind is None
    product = is_product(ops_r, ac, lat2)
    # symmorphic = the cocycle class is trivial
    symmorphic = ac.classify_cocycle(list(vec)) == \
        ac.classify_cocycle([0] * len(vec))

    from enumerate_2p1 import classify_system
    system = classify_system(ac)

    sym = clockwork_symbol(base_fwd, cones, has_tc, third, revkind, mirrors,
                           n_tglide_dirs)
    if revkind and base != base_fwd:
        # the reversal enriches the spatial projection: record it
        sym += f"[{base}]"
    sym_html = (sym.replace("₀", "<sub>0</sub>").replace("₁", "<sub>1</sub>")
                .replace("₂", "<sub>2</sub>").replace("₃", "<sub>3</sub>")
                .replace("₄", "<sub>4</sub>").replace("₅", "<sub>5</sub>")
                .replace("½", "<sub>½</sub>"))

    # Ke-Wu-style op description: highest-order fractional time screw first
    kws = []
    screws = []
    for (M, s, v, tau) in ops_r:
        if s == 1 and tau != 0 and M != M_ID and det2(M) == 1:
            n, k = ccw_phase(M, tau, basis)
            if k:
                screws.append((n, k))
    if screws:
        n, k = max(screws, key=lambda x: (x[0], -x[1]))
        from math import gcd as _g
        g = _g(n, k)
        kws.append(f"(R_{{2π/{n}}}|T_t^{{{k // g}/{n // g}}})")
    for (M, s, v, tau) in ops_r:
        if s == 1 and tau != 0 and det2(M) == -1:
            kws.append("(m|T_t^{1/2}" + ("T_s^{1/2})" if not lat2.contains(
                [v[0], v[1]]) else ")"))
            break
    for (M, s, v, tau) in ops_r:
        if s == -1 and M == M_ID and not lat2.contains([v[0], v[1]]):
            kws.append("(m_t|T_s^{1/2})")
            break

    render_ops = [{"M": [[int(M[0][0]), int(M[0][1])], [int(M[1][0]), int(M[1][1])]],
                   "v": [float(v[0]), float(v[1])], "s": int(s),
                   "tau": float(tau)} for (M, s, v, tau) in ops_r]
    lattice_letter = bravais_letter(ac)

    return {
        "id": f"g{idx}",
        "cls": cname,
        "symbol": sym,
        "symbolHtml": sym_html,
        "hm": " ".join(kws[:2]),
        "system": system,
        "bravais": lattice_letter,
        "base": base,
        "forward": forward,
        "product": product,
        "symmorphic": symmorphic,
        "generators": gen_strings(ac, vec),
        "notes": "",
        "render": {"basis": basis, "ops": render_ops},
    }


def bravais_letter(ac):
    """Honest lattice description from the residues of the chosen setting
    (Bravais type proper is setting-dependent; the catalog shows residues)."""
    res = [r for r in ac.lat.residues if any(r)]
    if not res:
        return "P"
    if any(Fraction(r[2]).denominator == 3 for r in res):
        return "R (1/3-stacked)"
    if len(res) == 3:
        return "F-centred"
    r = res[0]
    if r[2] == 0:
        return "C-centred (spatial)"
    return "centred (space-time)"


# --------------------------------------------------------------- main export
def orbit_closure(ac, vec, moves):
    """All cocycle vectors equivalent to vec under the within-class moves."""
    from stcore import apply_move
    seen = {ac.classify_cocycle(list(vec)): list(vec)}
    frontier = [list(vec)]
    while frontier:
        v = frontier.pop()
        for (K, perm) in moves:
            w = apply_move(ac, K, perm, v)
            c = ac.classify_cocycle(w)
            if c not in seen:
                seen[c] = w
                frontier.append(w)
    return list(seen.values())


def tau_weight(ac, vec):
    """(#ops with nonzero time offset, #ops with nonzero spatial part, lex)."""
    ops = full_ops(ac, vec)
    nt = sum(1 for (M, s, v, tau) in ops if tau != 0)
    nv = sum(1 for (M, s, v, tau) in ops if v != (Fraction(0), Fraction(0)))
    return (nt, nv, tuple(vec))


def main():
    from stcore import find_conjugations
    with open("out/enum2p1.pkl", "rb") as f:
        data = pickle.load(f)
    print(f"loaded {data['total']} groups in {len(data['classes'])} classes")
    entries = []
    idx = 0
    for cname, ac, orbits in data["classes"]:
        moves = find_conjugations(ac, ac, orientation="proper3",
                                  galilean=False) if len(orbits) else []
        for vec in orbits:
            idx += 1
            closure = orbit_closure(ac, vec, moves)
            # canonical representative: the most nearly static form, so that
            # e.g. pg x Z displays as a spatial glide, not its equivalent
            # time-glide form (crystallographic y<->t re-basing identifies them)
            canon = min(closure, key=lambda w: tau_weight(ac, w))
            try:
                e = build_entry(cname, ac, canon, idx)
                # product is a property of the group: test every equivalent form
                if not e["product"]:
                    lat2 = spatial_projection(ac, canon)[1]
                    e["product"] = any(
                        is_product(ops_render_list(ac, w), ac,
                                   spatial_projection(ac, w)[1])
                        for w in closure)
                entries.append(e)
            except Exception as e:
                print(f"ENTRY FAILED {cname} #{idx}: {e!r}")
                raise
    # a few distinct groups share a symbol (reversal-coset fine structure the
    # notation does not resolve); disambiguate with superscript letters
    by_sym = {}
    for e in entries:
        by_sym.setdefault(e["symbol"], []).append(e)
    letters = "abcdefghijklmnopqrstuvwxyz"
    SUPS = "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖ𐞥ʳˢᵗᵘᵛʷˣʸᶻ"
    for sym, es in by_sym.items():
        if len(es) > 1:
            for i, e in enumerate(es):
                e["symbol"] = e["symbol"] + SUPS[i]
                e["symbolHtml"] = e["symbolHtml"] + f"<sup>{letters[i]}</sup>"

    meta = {
        "total": len(entries),
        "forward": sum(1 for e in entries if e["forward"]),
        "nonproduct": sum(1 for e in entries if not e["product"]),
        "nonsymmorphic": sum(1 for e in entries if not e["symmorphic"]),
        "bySystem": {},
    }
    for e in entries:
        meta["bySystem"][e["system"]] = meta["bySystem"].get(e["system"], 0) + 1
    out = {"meta": meta, "groups": entries}
    with open("../docs/data/catalog.json", "w") as f:
        json.dump(out, f, indent=1)
    print("meta:", meta)
    print(f"wrote ../docs/data/catalog.json ({len(entries)} entries)")


if __name__ == "__main__":
    main()
