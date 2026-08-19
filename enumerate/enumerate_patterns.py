"""Two-colour pattern types of the plane: exact enumeration.

Grünbaum & Shephard (Tilings and Patterns, §8.3, statement 8.3.1) count 88
periodic two-colour pattern types over the 46 two-colour groups.  This module
recomputes them from scratch, in exact rational arithmetic, on top of the
colour-group enumeration of enumerate_colored.py (whose ids c2-<hm>-<n> are
those of catalogue D), and emits docs/data/two-color-patterns.json.

The mathematics
---------------
A perfectly two-coloured discrete periodic pattern is determined, up to
Grünbaum–Shephard equivalence, by three nested groups

        S  <=  H  <=  Gamma,

Gamma the wallpaper group of the uncoloured pattern, H the colour-preserving
subgroup (index 2; the colour group is the pair Gamma > H of catalogue D),
S the stabiliser of one copy of the motif.  For a compact connected motif S
is the full stabiliser of a point of the plane — the site symmetry of the
motif's seat — so S is trivial (general position), d1 (seat on a mirror),
c_n (seat at a gyration point) or d_n (seat at a kaleidoscopic corner).
Perfect colouring of a copy with stabiliser S forces S <= H: every symmetry
fixing the copy fixes its colour.

Two coloured patterns have the same type iff the triples are conjugate under
an affine map (Bieberbach: every isomorphism of wallpaper groups is affine),
i.e. iff the pairs (S, H) lie in one orbit of the affine normaliser N(Gamma)
acting by simultaneous conjugation.  With S read as the *stratum* of the
Gamma-orbifold in which the seat lies (interior; a mirror edge, i.e. a
mirror segment between consecutive corners; a corner; a cone point) rather
than as an abstract subgroup, one obtains exactly the 88 types of G&S:
the only place where the two counts differ is p6m, whose class-b mirror
lines carry two kinds of edge (6–3 and 3–2) with the same reflection group —
G&S's PP48A and PP48B (p3m1's edges P, Q, R also share a mirror line, but
the normaliser identifies them).  Read as (S, H) up to conjugacy the count
is 87.  Both counts are computed and asserted here.  The 88 is G&S's number
because Chapter 5 keeps the two varieties A/B of the underlying pattern
PP48; the algebraic invariant of a two-colour pattern type is the chain.

Every stratum is a symbol of Conway–Burgiel–Goodman-Strauss's *annotated
signature* (∗P6Q3R2, α2β2∗P, ...): a mirror letter, a corner digit between
two mirror letters, or a gyration letter — so a pattern type is a Chaim
colour signature (∗²6¹3¹2 ...) with one symbol *marked* as the seat of the
motif; the mark must sit on colour-preserving symmetries (superscript 1, or
a corner whose two mirrors are both 1).  That is what the site prints.

Run:  python3 enumerate_patterns.py     (about 20 s, pure Python)
"""

from fractions import Fraction
import itertools
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enumerate_colored as EC  # noqa: E402
from enumerate_colored import (  # noqa: E402
    F, I2, ZERO, GROUPS, ORDER17, gmul, ginv, mmul, mvec, mdet, minv_uni,
    vadd, vsub, is_int, vmod1, subgroups_index_k, normaliser_moves, orbits,
    apply_move, classify_concrete, as_concrete_group, lat_index, coset_reps,
    perm_of, perm_group, action_label, kernel_sub, TABLE_8_2_1,
)

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "..", "docs")

R2 = ((-1, 0), (0, -1))
MX = ((1, 0), (0, -1))     # (x, y) -> (x, -y): fixes the lattice x-axis
MY = ((-1, 0), (0, 1))
SW = ((0, 1), (1, 0))
NSW = ((0, -1), (-1, 0))
R4 = ((0, -1), (1, 0))
R3 = ((0, -1), (1, -1))
R6 = ((1, -1), (1, 0))
H2 = F(1, 2)


def fr(x):
    return F(x)


def pt(x, y):
    return (F(x), F(y))


# ------------------------------------------------------------- group basics

def close_group(gens, limit=200):
    """Closure of a set of exact affine elements (must be finite)."""
    S = {(I2, ZERO)}
    frontier = [(I2, ZERO)]
    while frontier:
        nxt = []
        for a in frontier:
            for g in gens:
                b = gmul(g, a)
                if b not in S:
                    S.add(b)
                    nxt.append(b)
                    assert len(S) <= limit, "not finite"
        frontier = nxt
    return S


def in_group(G, el):
    M, v = el
    if M not in G.ops:
        return False
    d = vsub(v, G.ops[M])
    return is_int(d[0]) and is_int(d[1])


def stabiliser(G, p):
    """Point stabiliser {(M | p - Mp)} ∩ Gamma of the exact point p."""
    S = set()
    for M, v in G.ops.items():
        w = vsub(p, mvec(M, p))
        d = vsub(w, v)
        if is_int(d[0]) and is_int(d[1]):
            S.add((M, w))
    return frozenset(S)


def stab_type(S):
    """'c1', 'd1', 'c2', 'd3', ... from a finite set of exact elements."""
    rots = sum(1 for M, v in S if mdet(M) == 1)
    refl = sum(1 for M, v in S if mdet(M) == -1)
    return ("d%d" if refl else "c%d") % rots


def canon_point(G, p):
    """Canonical representative of the Gamma-orbit of the point p."""
    best = None
    for M, v in G.ops.items():
        q = vmod1(vadd(mvec(M, p), v))
        if best is None or q < best:
            best = q
    return ("pt", best)


def is_reflection(el):
    M, v = el
    if mdet(M) != -1:
        return False
    # (M|v) fixes a point iff v is in the image of (I - M) (rank 1)
    IM = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
    a = (IM[0][0], IM[1][0])
    b = (IM[0][1], IM[1][1])
    u = a if a != (0, 0) else b
    # v parallel to u ?
    return v[0] * u[1] - v[1] * u[0] == 0


def line_of(el):
    """Mirror line of a reflection element as (point, direction) — direction
    is a primitive integer vector (the +1 eigenvector), point a foot."""
    M, v = el
    # direction: kernel of (I - M)
    IM = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
    if IM[0] != (0, 0):
        d = (-IM[0][1], IM[0][0])
    else:
        d = (-IM[1][1], IM[1][0])
    g = math.gcd(abs(d[0]), abs(d[1]))
    d = (d[0] // g, d[1] // g)
    if d[0] < 0 or (d[0] == 0 and d[1] < 0):
        d = (-d[0], -d[1])
    # a fixed point: p = v/2 + t d works iff (I-M) v/2 = v; general: solve
    # (I - M) p = v: p = v/2 is a solution when M is a reflection matrix
    # (since (I-M)(v/2) = v/2 - Mv/2 and Mv = -v for v in Im(I-M)).
    p = (v[0] / 2, v[1] / 2)
    assert vsub(vadd(mvec(M, p), v), p) == ZERO, ("not a fixed point", el)
    return (p, d)


def canon_line(G, el):
    """Canonical key of the Gamma-conjugacy class of a reflection element,
    i.e. of its mirror line."""
    M, v = el
    best = None
    for N, u in G.ops.items():
        Ni = minv_uni(N)
        Mp = mmul(mmul(N, M), Ni)
        # (N|u)(M|v)(N|u)^-1 = (Mp | u + N v - Mp u)
        wp = vsub(vadd(u, mvec(N, v)), mvec(Mp, u))
        # reduce wp modulo (I - Mp) Z^2, a rank-1 lattice
        IM = ((1 - Mp[0][0], -Mp[0][1]), (-Mp[1][0], 1 - Mp[1][1]))
        g1 = (IM[0][0], IM[1][0])
        g2 = (IM[0][1], IM[1][1])
        u0 = g1 if g1 != (0, 0) else g2
        gg = math.gcd(abs(u0[0]), abs(u0[1]))
        u0 = (u0[0] // gg, u0[1] // gg)
        a1 = (g1[0] // u0[0]) if u0[0] else (g1[1] // u0[1])
        a2 = (g2[0] // u0[0]) if u0[0] else (g2[1] // u0[1])
        step = math.gcd(abs(a1), abs(a2))
        # wp = lam * u0
        lam = (F(wp[0]) / u0[0]) if u0[0] else (F(wp[1]) / u0[1])
        assert vsub(wp, (lam * u0[0], lam * u0[1])) == ZERO, "not a reflection"
        lam = lam % step
        key = (Mp, lam)
        if best is None or key < best:
            best = key
    return ("ln",) + best


def rotation_centre(el):
    M, v = el
    IM = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
    d = IM[0][0] * IM[1][1] - IM[0][1] * IM[1][0]
    assert d != 0
    inv = ((F(IM[1][1], d), F(-IM[0][1], d)), (F(-IM[1][0], d), F(IM[0][0], d)))
    return (inv[0][0] * v[0] + inv[0][1] * v[1], inv[1][0] * v[0] + inv[1][1] * v[1])


def rotation_order(M):
    n, P = 1, M
    while P != I2:
        P = mmul(M, P)
        n += 1
        assert n <= 6
    return n


# --------------------------------------------- Chaim generators per group

def refl_through(G, p, q):
    """The reflection of Gamma whose mirror passes through the two exact
    points p and q."""
    hits = []
    for M, v in G.ops.items():
        if mdet(M) != -1:
            continue
        for k in itertools.product(range(-2, 3), repeat=2):
            el = (M, vadd(v, (F(k[0]), F(k[1]))))
            if not is_reflection(el):
                continue
            if vadd(mvec(M, p), el[1]) == p and vadd(mvec(M, q), el[1]) == q:
                hits.append(el)
    assert len(hits) == 1, ("reflection through", p, q, hits)
    return hits[0]


def rot_about(G, c, order, sense=1):
    """The rotation of Gamma about c by 2π/order (counter-clockwise in
    lattice orientation), or its inverse if sense=-1."""
    hits = []
    for M, v in G.ops.items():
        if mdet(M) != 1 or M == I2 or rotation_order(M) != order:
            continue
        # counter-clockwise: for order n the ccw generator has trace
        # 2cos(2π/n); orientation sign from M e1 x e1
        w = vsub(c, mvec(M, c))
        d = vsub(w, v)
        if not (is_int(d[0]) and is_int(d[1])):
            continue
        # sense: sign of (e1 x M e1) in a positively oriented basis
        s = M[1][0]  # (1,0) -> (M00, M10); cross with (1,0) is M10
        if order == 2 or (s > 0) == (sense > 0):
            hits.append((M, w))
    assert len(hits) == 1, ("rotation about", c, order, hits)
    return hits[0]


def transl(x, y):
    return (I2, pt(x, y))


CHAIM = {}


def _def(hm, annotated, template, gens, relations, geometry):
    CHAIM[hm] = {"annotated": annotated, "template": template,
                 "gens": gens, "relations": relations, "geometry": geometry}


def build_chaim():
    G = GROUPS
    _def("p1", "◦^{X,Y}", "◦{X,Y}", [("X", transl(1, 0)), ("Y", transl(0, 1))],
         "XY = YX", {"X": "translation", "Y": "translation"})
    g = G["p2"]
    a = rot_about(g, pt(0, 0), 2)
    b = rot_about(g, pt(0, H2), 2)
    c = rot_about(g, pt(H2, H2), 2)
    d = rot_about(g, pt(H2, 0), 2)
    _def("p2", "α2β2γ2δ2", "{α}2{β}2{γ}2{δ}2",
         [("α", a), ("β", b), ("γ", c), ("δ", d)],
         "α² = β² = γ² = δ² = αβγδ = 1",
         {k: "half-turn" for k in "αβγδ"})
    g = G["pm"]
    _def("pm", "α∗P∗Q", "{α}*{P}*{Q}",
         [("α", transl(1, 0)), ("P", refl_through(g, pt(0, 0), pt(1, 0))),
          ("Q", refl_through(g, pt(0, H2), pt(1, H2)))],
         "P² = Q² = 1; αP = Pα; αQ = Qα",
         {"α": "translation", "P": "mirror reflection",
          "Q": "parallel mirror reflection"})
    _def("pg", "×Y×Z", "×{Y}×{Z}",
         [("Y", (MX, pt(H2, 0))), ("Z", (MX, pt(-H2, 1)))],
         "Y²Z² = 1", {"Y": "glide reflection", "Z": "glide reflection"})
    g = G["cm"]
    _def("cm", "∗P×Z", "*{P}×{Z}",
         [("P", refl_through(g, pt(0, 0), pt(1, 1))), ("Z", (SW, pt(0, 1)))],
         "P² = PZ²PZ⁻² = 1", {"P": "mirror reflection", "Z": "glide reflection"})
    g = G["pmm"]
    _def("pmm", "∗P2Q2R2S2", "*{P}2{Q}2{R}2{S}2",
         [("P", refl_through(g, pt(0, 0), pt(0, 1))),
          ("Q", refl_through(g, pt(0, 0), pt(1, 0))),
          ("R", refl_through(g, pt(H2, 0), pt(H2, 1))),
          ("S", refl_through(g, pt(0, H2), pt(1, H2)))],
         "P² = Q² = R² = S² = (PQ)² = (QR)² = (RS)² = (SP)² = 1",
         {k: "mirror reflection" for k in "PQRS"})
    g = G["pmg"]
    _def("pmg", "α2β2∗P", "{α}2{β}2*{P}",
         [("α", rot_about(g, pt(0, 0), 2)), ("β", rot_about(g, pt(0, H2), 2)),
          ("P", refl_through(g, pt(F(1, 4), 0), pt(F(1, 4), 1)))],
         "α² = β² = P² = 1; αβP = Pαβ",
         {"α": "half-turn", "β": "half-turn", "P": "mirror reflection"})
    g = G["pgg"]
    _def("pgg", "α2β2×Z", "{α}2{β}2×{Z}",
         [("α", rot_about(g, pt(0, 0), 2)), ("β", rot_about(g, pt(H2, 0), 2)),
          ("Z", (MX, pt(H2, H2)))],
         "α² = β² = αβZ² = 1",
         {"α": "half-turn", "β": "half-turn", "Z": "glide reflection"})
    g = G["cmm"]
    _def("cmm", "α2∗P2Q2", "{α}2*{P}2{Q}2",
         [("α", rot_about(g, pt(H2, 0), 2)),
          ("P", refl_through(g, pt(0, 0), pt(1, 1))),
          ("Q", refl_through(g, pt(0, 0), pt(1, -1)))],
         "α² = P² = Q² = (PQ)² = (QαPα⁻¹)² = 1",
         {"α": "half-turn", "P": "mirror reflection", "Q": "mirror reflection"})
    g = G["p4"]
    a = rot_about(g, pt(0, 0), 4)
    b = rot_about(g, pt(H2, H2), 4)
    c = ginv(gmul(a, b))
    _def("p4", "α4β4γ2", "{α}4{β}4{γ}2", [("α", a), ("β", b), ("γ", c)],
         "α⁴ = β⁴ = γ² = αβγ = 1",
         {"α": "quarter-turn", "β": "quarter-turn", "γ": "half-turn"})
    g = G["p4m"]
    _def("p4m", "∗P4Q4R2", "*{P}4{Q}4{R}2",
         [("P", refl_through(g, pt(0, 0), pt(1, 0))),
          ("Q", refl_through(g, pt(0, 0), pt(1, 1))),
          ("R", refl_through(g, pt(H2, 0), pt(H2, 1)))],
         "P² = Q² = R² = (PQ)⁴ = (QR)⁴ = (RP)² = 1",
         {k: "mirror reflection" for k in "PQR"})
    g = G["p4g"]
    _def("p4g", "α4∗P2", "{α}4*{P}2",
         [("α", rot_about(g, pt(0, 0), 4)),
          ("P", refl_through(g, pt(0, H2), pt(H2, 1)))],
         "α⁴ = P² = (PαPα⁻¹)² = 1",
         {"α": "quarter-turn", "P": "mirror reflection"})
    g = G["p3"]
    a = rot_about(g, pt(0, 0), 3)
    b = rot_about(g, pt(F(2, 3), F(1, 3)), 3)
    c = ginv(gmul(a, b))
    _def("p3", "α3β3γ3", "{α}3{β}3{γ}3", [("α", a), ("β", b), ("γ", c)],
         "α³ = β³ = γ³ = αβγ = 1", {k: "one-third turn" for k in "αβγ"})
    g = G["p3m1"]
    A, B, C = pt(0, 0), pt(F(2, 3), F(1, 3)), pt(F(1, 3), F(2, 3))
    _def("p3m1", "∗P3Q3R3", "*{P}3{Q}3{R}3",
         [("P", refl_through(g, A, B)), ("Q", refl_through(g, B, C)),
          ("R", refl_through(g, C, A))],
         "P² = Q² = R² = (PQ)³ = (QR)³ = (RP)³ = 1",
         {k: "mirror reflection" for k in "PQR"})
    g = G["p31m"]
    _def("p31m", "α3∗P3", "{α}3*{P}3",
         [("α", rot_about(g, pt(F(2, 3), F(1, 3)), 3)),
          ("P", refl_through(g, pt(0, 0), pt(1, 1)))],
         "α³ = P² = (PαPα⁻¹)³ = 1",
         {"α": "one-third turn", "P": "mirror reflection"})
    g = G["p6"]
    a = rot_about(g, pt(0, 0), 6)
    b = rot_about(g, pt(F(2, 3), F(1, 3)), 3)
    c = ginv(gmul(a, b))
    _def("p6", "α6β3γ2", "{α}6{β}3{γ}2", [("α", a), ("β", b), ("γ", c)],
         "α⁶ = β³ = γ² = αβγ = 1",
         {"α": "one-sixth turn", "β": "one-third turn", "γ": "half-turn"})
    g = G["p6m"]
    six, three, two = pt(0, 0), pt(F(2, 3), F(1, 3)), pt(H2, 0)
    _def("p6m", "∗P6Q3R2", "*{P}6{Q}3{R}2",
         [("P", refl_through(g, six, two)), ("Q", refl_through(g, six, three)),
          ("R", refl_through(g, three, two))],
         "P² = Q² = R² = (PQ)⁶ = (QR)³ = (RP)² = 1",
         {k: "mirror reflection" for k in "PQR"})


def word_value(gens, word):
    """Evaluate a word like 'PQ', 'αβγδ', 'PαPα⁻¹' in the exact generators."""
    val = (I2, ZERO)
    i = 0
    while i < len(word):
        ch = word[i]
        i += 1
        el = gens[ch]
        if i < len(word) and word[i] == "⁻":
            assert word[i + 1] == "¹"
            el = ginv(el)
            i += 2
        val = gmul(val, el)
    return val


def check_relations(hm):
    """Verify the displayed presentation holds exactly (order relations and
    identities) — a self-check that the generators have Chaim's roles."""
    spec = CHAIM[hm]
    gens = dict(spec["gens"])
    ident = (I2, ZERO)
    text = spec["relations"].replace(" ", "")
    for clause in text.split(";"):
        parts = clause.split("=")
        # every part is a word (possibly with a power) or '1'
        vals = []
        for part in parts:
            if part == "1":
                vals.append(ident)
                continue
            # a power like (PQ)² or α⁴ or αβγδ or PZ²PZ⁻²
            vals.append(_eval_power_word(gens, part))
        for v in vals[1:]:
            assert v == vals[0], (hm, clause, vals)


SUP = {"²": 2, "³": 3, "⁴": 4, "⁶": 6}


def _eval_power_word(gens, s):
    val = (I2, ZERO)
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "(":
            j = s.index(")", i)
            inner = _eval_power_word(gens, s[i + 1:j])
            i = j + 1
            n = 1
            if i < len(s) and s[i] in SUP:
                n = SUP[s[i]]
                i += 1
            for _ in range(n):
                val = gmul(val, inner)
            continue
        el = gens[ch]
        i += 1
        inv = False
        n = 1
        if i < len(s) and s[i] == "⁻":
            inv = True
            i += 1
            if i < len(s) and s[i] == "¹":
                i += 1
            elif i < len(s) and s[i] in SUP:
                n = SUP[s[i]]
                i += 1
        elif i < len(s) and s[i] in SUP:
            n = SUP[s[i]]
            i += 1
        if inv:
            el = ginv(el)
        for _ in range(n):
            val = gmul(val, el)
    return val


# ------------------------------------------------------------------ strata

def special_points_on_line(G, el):
    """Points on the mirror line of `el` with stabiliser bigger than <el>,
    within one period along the line, as parameters s (line = p0 + s d)."""
    p0, d = line_of(el)
    specials = {}
    # candidates: rotation centres of Gamma (mod Z^2) translated by small
    # integers, and intersections with other mirror lines — all are fixed
    # points of some element other than el and identity; enumerate elements
    # (M | v + k) with |k| <= 2 and check whether they fix a point of the line.
    for M, v in G.ops.items():
        if M == I2:
            continue
        for k in itertools.product(range(-3, 4), repeat=2):
            e2 = (M, vadd(v, (F(k[0]), F(k[1]))))
            if e2 == el:
                continue
            if mdet(M) == 1:
                c = rotation_centre(e2)
                # is c on the line?
                s = _param_on_line(p0, d, c)
                if s is not None:
                    specials.setdefault(s % 1, set()).add(e2)
            else:
                if not is_reflection(e2):
                    continue
                q0, d2 = line_of(e2)
                if d2 == d:
                    continue  # parallel (or the same) line
                # intersection point
                c = _intersect(p0, d, q0, d2)
                s = _param_on_line(p0, d, c)
                specials.setdefault(s % 1, set()).add(e2)
    return p0, d, sorted(specials)


def _param_on_line(p0, d, c):
    """s with c = p0 + s d, or None."""
    w = vsub(c, p0)
    if w[0] * d[1] - w[1] * d[0] != 0:
        return None
    return (w[0] / d[0]) if d[0] else (w[1] / d[1])


def _intersect(p0, d, q0, e):
    # p0 + s d = q0 + t e
    det = d[0] * (-e[1]) - (-e[0]) * d[1]
    rhs = vsub(q0, p0)
    s = (rhs[0] * (-e[1]) - (-e[0]) * rhs[1]) / det
    return vadd(p0, (s * d[0], s * d[1]))


def corner_point(gens_dict, a, b):
    """Fixed point of the rotation (a)(b) for two mirror generators/words."""
    el = gmul(word_value(gens_dict, a), word_value(gens_dict, b))
    assert mdet(el[0]) == 1 and el[0] != I2, (a, b)
    return rotation_centre(el)


def strata_of(hm):
    """Symbolic strata of the annotated signature with exact representative
    points/lines and their stabilisers.  Returns a list of dicts."""
    G = GROUPS[hm]
    spec = CHAIM[hm]
    gens = dict(spec["gens"])
    ann = spec["annotated"]
    out = [{"kind": "interior", "label": "general position",
            "letters": [], "S": frozenset({(I2, ZERO)}), "key": ("int",),
            "point": None, "line": None, "stype": "c1"}]
    # parse annotated signature into features
    # mirror strings: '∗' followed by (letter digit)* letter? — Chaim's forms
    # ∗P6Q3R2 : letters P,Q,R with corner digits 6,3,2 between/after
    # α∗P∗Q  : two ∗ strings each with one letter and no corner
    # ∗P×Z, ×Y×Z, α2β2×Z, α4∗P2, α3∗P3, α2∗P2Q2, α2β2∗P
    i = 0
    gyr = []
    strings = []
    while i < len(ann):
        ch = ann[i]
        if ch in "αβγδ":
            if i + 1 < len(ann) and ann[i + 1].isdigit():
                n = int(ann[i + 1])
                gyr.append((ch, n))
                i += 2
            else:
                i += 1      # a translation generator (pm's α)
        elif ch == "∗":
            i += 1
            letters = []
            digits = []
            while i < len(ann) and ann[i] not in "∗×◦αβγδ":
                if ann[i].isalpha():
                    letters.append(ann[i])
                    i += 1
                elif ann[i].isdigit():
                    digits.append(int(ann[i]))
                    i += 1
                else:
                    break
            strings.append((letters, digits))
        elif ch == "×":
            i += 2  # ×Y
        elif ch == "◦":
            break
        else:
            i += 1
    for (ch, n) in gyr:
        el = gens[ch]
        c = rotation_centre(el)
        S = stabiliser(G, c)
        assert stab_type(S) == "c%d" % n, (hm, ch, stab_type(S))
        out.append({"kind": "gyration", "label": "at the %d-fold centre of %s" % (n, ch),
                    "letters": [ch], "S": S, "key": canon_point(G, c),
                    "point": c, "line": None, "stype": "c%d" % n, "order": n})
    for letters, digits in strings:
        k = len(letters)
        # corners: between letters[j] and letters[j+1] (cyclic); for the
        # wrap-around of a string with a boundary translation the second
        # mirror is the conjugate of letters[0] by the "next" gyration —
        # Chaim's relation (PαPα⁻¹)^n = 1 or (QαPα⁻¹)^2 = 1: use the last
        # relation involving the wrap.
        corners = []
        for j, n in enumerate(digits):
            a = letters[j]
            if j + 1 < k:
                b = letters[j + 1]
                bword = b
            else:
                # wrap-around: the partner of the last letter is the first
                # letter conjugated by the gyration generator(s) preceding
                # the ∗ string in the signature (α), if any; else the first
                # letter itself (closed polygon).
                if gyr:
                    gch = gyr[-1][0]
                    bword = gch + letters[0] + gch + "⁻¹"
                    b = "%s%s%s⁻¹" % (gch, letters[0], gch)
                else:
                    b = letters[0]
                    bword = letters[0]
            c = corner_point(gens, a, bword)
            S = stabiliser(G, c)
            assert stab_type(S) == "d%d" % n, (hm, a, b, stab_type(S), n)
            corners.append((a, b, n, c))
            out.append({"kind": "corner", "label": "at the corner %d between %s and %s" % (n, a, b),
                        "letters": [a, b], "S": S, "key": canon_point(G, c),
                        "point": c, "line": None, "stype": "d%d" % n, "order": n})
        # edges: each letter; endpoints = corner preceding and following it
        for j, L in enumerate(letters):
            el = gens[L]
            p0, d, specials = special_points_on_line(G, el)
            S = frozenset({(I2, ZERO), el})
            if not specials:
                key = canon_line(G, el)
                out.append({"kind": "edge", "label": "on the mirror %s" % L,
                            "letters": [L], "S": S, "key": key, "point": None,
                            "line": (p0, d), "stype": "d1", "segment": None})
                continue
            # find the corner points that bound this letter's edge
            ends = []
            for (a, b, n, c) in corners:
                if a == L or b == L or (len(letters) == 1):
                    ends.append(c)
            # parameters of ends on the line
            svals = []
            for c in ends:
                s = _param_on_line(p0, d, c)
                if s is not None:
                    svals.append(s)
            # choose the gap between two consecutive specials that is
            # bounded by end-points of this letter's corners (mod period 1)
            spec_sorted = sorted(specials)
            gaps = []
            for a_i in range(len(spec_sorted)):
                s1 = spec_sorted[a_i]
                s2 = spec_sorted[(a_i + 1) % len(spec_sorted)]
                if a_i + 1 == len(spec_sorted):
                    s2 = s2 + 1
                gaps.append((s1, s2))
            chosen = None
            for s1, s2 in gaps:
                hits = 0
                for s in svals:
                    if (s - s1) % 1 == 0 or (s - s2) % 1 == 0:
                        hits += 1
                if hits >= (2 if len(letters) > 1 else 1):
                    chosen = (s1, s2)
                    break
            if chosen is None:
                chosen = gaps[0]
            mid = (chosen[0] + chosen[1]) / 2
            m = vadd(p0, (mid * d[0], mid * d[1]))
            Sm = stabiliser(G, m)
            assert Sm == S, (hm, L, "edge midpoint not d1", stab_type(Sm))
            out.append({"kind": "edge", "label": "on the mirror %s" % L,
                        "letters": [L], "S": S, "key": canon_point(G, m),
                        "point": m, "line": (p0, d), "stype": "d1",
                        "segment": (vadd(p0, (chosen[0] * d[0], chosen[0] * d[1])),
                                    vadd(p0, (chosen[1] * d[0], chosen[1] * d[1])))})
    # sanity: keys distinct?  (two symbolic strata may coincide, e.g. none)
    return out


def canonical_key_of_point(G, p):
    return canon_point(G, p)


def stratum_key_after_move(G, st, move):
    """Key of the image stratum under the normaliser move (A|t)."""
    A, t = move
    if st["kind"] == "interior":
        return ("int",)
    if st["point"] is not None:
        q = vadd(mvec(A, st["point"]), t)
        return canon_point(G, q)
    # edge given by a line: transport the reflection element
    el = [e for e in st["S"] if e[0] != I2][0]
    Ai = minv_uni(A)
    M, v = el
    Mp = mmul(mmul(A, M), Ai)
    wp = vsub(vadd(t, mvec(A, v)), mvec(Mp, t))
    return canon_line(G, (Mp, wp))


# ------------------------------------------------------------- main run

def sub_contains_set(sub, S):
    return all(sub.contains(el) for el in S)


def two_colour_groups():
    """The 46 classes with the ids of catalogue D (same sort as
    enumerate_colored.main)."""
    results = EC.enumerate_all(kmax=2, verbose=False)
    for r in results:
        r["subType"] = classify_concrete(as_concrete_group(r["sub"]))
    results.sort(key=lambda r: (r["k"], ORDER17.index(r["hm"]),
                                ORDER17.index(r["subType"]),
                                lat_index(r["sub"].L), str(r["sub"].key)))
    counters = {}
    for r in results:
        c = counters.setdefault((r["k"], r["hm"]), [0])
        c[0] += 1
        r["id"] = "c%d-%s-%d" % (r["k"], r["hm"], c[0])
    return results


def superscript(n):
    return {1: "¹", 2: "²", 3: "³", 4: "⁴", 6: "⁶"}[n]


def signature_string(hm, perms):
    """Chaim short colour signature from generator -> order (1 or 2)."""
    t = CHAIM[hm]["template"]
    if hm == "p1":
        return "◦" + superscript(perms["X"]) + "," + superscript(perms["Y"])
    out = ""
    i = 0
    while i < len(t):
        if t[i] == "{":
            j = t.index("}", i)
            out += superscript(perms[t[i + 1:j]])
            i = j + 1
        else:
            out += t[i]
            i += 1
    return out


def main():
    build_chaim()
    for hm in ORDER17:
        for name, el in CHAIM[hm]["gens"]:
            assert in_group(GROUPS[hm], el), (hm, name, el)
        check_relations(hm)
    print("Chaim generators: 17 groups, presentations verified exactly")

    ref = None
    ref_path = os.path.join(HERE, "..", "..", "animated-groups", "data",
                            "color-pattern-catalog.json")
    gs_map_path = os.path.join(DOCS, "data", "colored-gs.json")
    with open(gs_map_path, encoding="utf-8") as f:
        gsmap = json.load(f)["groups"]

    groups = two_colour_groups()
    assert len(groups) == 46
    by_hm = {}
    for r in groups:
        by_hm.setdefault(r["hm"], []).append(r)

    # ---- strata per group; uncoloured pattern types (Wyckoff sets)
    strata = {}
    n_uncol = 0
    n_uncol_S = 0
    for hm in ORDER17:
        G = GROUPS[hm]
        st = strata_of(hm)
        strata[hm] = st
        moves = normaliser_moves(G)
        # orbits of strata keys under moves
        keys = {}
        for s in st:
            keys.setdefault(s["key"], []).append(s)
        # BFS
        seen = set()
        classes = []
        for k0 in keys:
            if k0 in seen:
                continue
            orb = {k0}
            frontier = [k0]
            while frontier:
                nxt = []
                for k in frontier:
                    s = keys[k][0]
                    for mv in moves:
                        k2 = stratum_key_after_move(G, s, mv)
                        assert k2 in keys, (hm, s["label"], "move left strata", k2)
                        if k2 not in orb:
                            orb.add(k2)
                            nxt.append(k2)
                frontier = nxt
            seen |= orb
            classes.append(orb)
        n_uncol += len(classes)
        # (Gamma, S) classes: merge classes whose S are conjugate — for
        # edges compare canonical lines
        skeys = set()
        for orb in classes:
            s = keys[sorted(orb)[0]][0]
            if s["kind"] == "edge":
                el = [e for e in s["S"] if e[0] != I2][0]
                # canonical line under N(Gamma): BFS over moves
                lk = canon_line(G, el)
                lorb = {lk}
                fr_ = [el]
                while fr_:
                    nxt = []
                    for e in fr_:
                        for A, t in moves:
                            Ai = minv_uni(A)
                            Mp = mmul(mmul(A, e[0]), Ai)
                            wp = vsub(vadd(t, mvec(A, e[1])), mvec(Mp, t))
                            kk = canon_line(G, (Mp, wp))
                            if kk not in lorb:
                                lorb.add(kk)
                                nxt.append((Mp, wp))
                    fr_ = nxt
                skeys.add(("edge", min(lorb)))
            else:
                skeys.add(("cls", min(orb)))
        n_uncol_S += len(skeys)
        for c in classes:
            pass
        strata[hm + "_classes"] = classes
    print("uncoloured pattern types (strata up to N(Gamma)): %d  [(Gamma,S) classes: %d]"
          % (n_uncol, n_uncol_S))

    # ---- two-colour pattern types
    types = []
    total_pairs = 0
    n_types_S = 0
    for hm in ORDER17:
        G = GROUPS[hm]
        st = strata[hm]
        keys = {}
        for s in st:
            keys.setdefault(s["key"], []).append(s)
        moves = normaliser_moves(G)
        subs = subgroups_index_k(G, 2)
        index = {s.key: s for s in subs}
        classes = by_hm.get(hm, [])
        # map every subgroup key to its class id
        key_to_id = {}
        for r in classes:
            for kk in r["orbit"]:
                key_to_id[kk] = r["id"]
        # pairs (stratum key, sub key) with S <= H
        pairs = [(sk, hk) for sk in keys for hk in index
                 if sub_contains_set(index[hk], keys[sk][0]["S"])]
        total_pairs += len(pairs)
        pairset = set(pairs)
        seen = set()
        pair_classes = []
        for p0 in pairs:
            if p0 in seen:
                continue
            orb = {p0}
            frontier = [p0]
            while frontier:
                nxt = []
                for (sk, hk) in frontier:
                    s = keys[sk][0]
                    for mv in moves:
                        sk2 = stratum_key_after_move(G, s, mv)
                        h2 = apply_move(index[hk], mv)
                        p2 = (sk2, h2.key)
                        assert p2 in pairset, (hm, "pair moved outside")
                        if p2 not in orb:
                            orb.add(p2)
                            nxt.append(p2)
                frontier = nxt
            seen |= orb
            pair_classes.append(orb)
        # coarser (S,H) count: merge classes with same H-class and conjugate S
        coarse = set()
        for orb in pair_classes:
            sk, hk = sorted(orb)[0]
            s = keys[sk][0]
            hid = key_to_id[hk]
            if s["kind"] == "edge":
                el = [e for e in s["S"] if e[0] != I2][0]
                # (line, H) up to moves: BFS on (canon_line, hk)
                start = (canon_line(G, el), hk)
                lorb = {start}
                fr_ = [(el, hk)]
                while fr_:
                    nxt = []
                    for e, hkk in fr_:
                        for A, t in moves:
                            Ai = minv_uni(A)
                            Mp = mmul(mmul(A, e[0]), Ai)
                            wp = vsub(vadd(t, mvec(A, e[1])), mvec(Mp, t))
                            h2 = apply_move(index[hkk], (A, t))
                            kk = (canon_line(G, (Mp, wp)), h2.key)
                            if kk not in lorb:
                                lorb.add(kk)
                                nxt.append(((Mp, wp), h2.key))
                    fr_ = nxt
                coarse.add(("edge", min(lorb)))
            else:
                coarse.add(("cls", min(orb)))
        n_types_S += len(coarse)
        for orb in pair_classes:
            # representative: prefer the canonical H of the class (the one
            # whose id we display), then the first stratum in signature order
            hids = {key_to_id[hk] for sk, hk in orb}
            assert len(hids) == 1, (hm, hids)
            hid = hids.pop()
            types.append({"hm": hm, "colour_group": hid, "orbit": orb})
    print("two-colour pattern types (marked strata): %d   [(S,H) classes: %d]"
          % (len(types), n_types_S))
    assert len(types) == 88, len(types)
    assert n_types_S == 87, n_types_S
    assert n_uncol == 52 and n_uncol_S == 51, (n_uncol, n_uncol_S)

    # ---- choose display representative per colour group: the H whose
    # generator permutations reproduce the reference/Table 11.1 signature
    ref_sigs = {}
    try:
        with open(ref_path, encoding="utf-8") as f:
            refd = json.load(f)
        for g in refd["colour_groups"]:
            if g["number_of_colours"] == 2:
                ref_sigs[g["gs_symbol"]] = g["chaim_short_signature"]
    except FileNotFoundError:
        pass

    def gs_symbol_of(cid):
        return gsmap[cid]["gs"]

    def gs_symbol_pretty(sym):
        # 'pmm[2]4' -> 'pmm[2]₄'
        sub = {"1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅"}
        if sym.endswith("]"):
            return sym
        return sym[:-1] + sub[sym[-1]]

    disp_H = {}   # colour id -> Sub
    disp_perms = {}
    for hm in ORDER17:
        G = GROUPS[hm]
        subs = subgroups_index_k(G, 2)
        index = {s.key: s for s in subs}
        gens = CHAIM[hm]["gens"]
        for r in by_hm.get(hm, []):
            sym = gs_symbol_of(r["id"])
            want = ref_sigs.get(sym.replace("]", "]_") if not sym.endswith("]") else sym)
            # ref keys look like 'pmm[2]_4' / 'p1[2]'
            best = None
            for kk in sorted(r["orbit"]):
                sub = index[kk]
                perms = {name: (1 if sub.contains(el) else 2) for name, el in gens}
                sig = signature_string(hm, perms)
                if best is None:
                    best = (sub, perms, sig)
                if want is not None and sig == want:
                    best = (sub, perms, sig)
                    break
            disp_H[r["id"]] = best[0]
            disp_perms[r["id"]] = (best[1], best[2])
            if want is not None and best[2] != want:
                print("  NOTE %s %s: computed signature %s, reference %s"
                      % (r["id"], sym, best[2], want))

    # ---- assemble per-type records
    ORDER_KIND = {"interior": 0, "edge": 1, "corner": 2, "gyration": 3}
    records = []
    for t in types:
        hm = t["hm"]
        G = GROUPS[hm]
        st = strata[hm]
        keys = {}
        for s in st:
            keys.setdefault(s["key"], []).append(s)
        subs = subgroups_index_k(G, 2)
        index = {s.key: s for s in subs}
        Hd = disp_H[t["colour_group"]]
        # strata in the orbit paired with the display H
        marks = sorted({sk for sk, hk in t["orbit"] if hk == Hd.key})
        assert marks, (hm, t["colour_group"], "display H not in orbit")
        stlist = []
        for sk in marks:
            for s in keys[sk]:
                stlist.append(s)
        stlist.sort(key=lambda s: (ORDER_KIND[s["kind"]], s["letters"]))
        rep = stlist[0]
        records.append({"hm": hm, "colour_group": t["colour_group"],
                        "rep": rep, "equivalent": stlist, "H": Hd})

    # G&S labels: per colour group, the PP anchors from colored-gs.json give
    # the labels; assign by stabiliser type / position (see docstring).
    PP_OF = {  # underlying pattern number: (hm, stype, position rule)
    }
    out_types = []
    for rec in records:
        hm = rec["hm"]
        cid = rec["colour_group"]
        rep = rec["rep"]
        stype = rep["stype"]
        label = gs_label(hm, cid, rep, rec["equivalent"], gsmap, disp_perms)
        out_types.append((rec, label))

    # verify: labels are exactly the anchors listed in colored-gs.json
    want_labels = set()
    for cid, g in gsmap.items():
        if cid.startswith("c2-"):
            for a in g["ppAnchors"]:
                want_labels.add(a["anchor"])
    got_labels = [lab["anchor"] for rec, lab in out_types]
    assert len(got_labels) == len(set(got_labels)), "duplicate labels"
    missing = want_labels - set(got_labels)
    extra = set(got_labels) - want_labels
    assert not missing and not extra, (sorted(missing), sorted(extra))
    print("G&S labels matched: 88/88 against catalogue E anchors")

    write_json(out_types, disp_perms, gsmap, groups)


# ------------------------------------------------------ G&S label matching

# Underlying pattern PPn per (group, stratum type, letter rule).  Read off
# the plates of Figures 8.2.2 and 8.3.5 (see the page for the crops).
PP_TABLE = {
    "p1": {"c1": 1}, "pg": {"c1": 2}, "pm": {"c1": 3, "d1": 4},
    "cm": {"c1": 5, "d1": 6}, "p2": {"c1": 7, "c2": 8},
    "pgg": {"c1": 9, "c2": 10}, "pmg": {"c1": 11, "c2": 12, "d1": 13},
    "pmm": {"c1": 14, "d1": 15, "d2": 16},
    "cmm": {"c1": 17, "c2": 18, "d1": 19, "d2": 20},
    "p3": {"c1": 21, "c3": 22},
    "p31m": {"c1": 23, "c3": 24, "d1": 25, "d3": 26},
    "p3m1": {"c1": 27, "d1": 28, "d3": 29},
    "p4": {"c1": 30, "c2": 31, "c4": 32},
    "p4g": {"c1": 33, "c4": 34, "d1": 35, "d2": 36},
    "p4m": {"c1": 37, "d1": None, "d2": 40, "d4": 41},   # d1: P/R -> 38, Q -> 39
    "p6": {"c1": 42, "c2": 43, "c3": 44, "c6": 45},
    "p6m": {"c1": 46, "d1": None, "d2": 49, "d3": 50, "d6": 51},  # P->47, Q->48A, R->48B
}


def gs_label(hm, cid, rep, equivalent, gsmap, disp_perms):
    stype = rep["stype"]
    letters = set()
    for s in equivalent:
        letters.update(s["letters"])
    n = PP_TABLE[hm][stype]
    suffix = ""
    if hm == "p4m" and stype == "d1":
        n = 39 if "Q" in letters else 38
    if hm == "p6m" and stype == "d1":
        if "P" in letters:
            n = 47
        elif "Q" in letters:
            n, suffix = 48, "A"
        else:
            n, suffix = 48, "B"
    gs = gsmap[cid]["gs"]           # e.g. 'pmm[2]4' or 'p6m[2]2' or 'p1[2]'
    sub = gs[gs.index("]") + 1:]    # '4' or ''
    star = ""
    if hm == "pmm" and stype == "d1" and gs == "pmm[2]1":
        # PP15[2]_1: seat mirror perpendicular to the colour-swapping
        # mirrors (adjacent letters); PP15[2]_1*: parallel (opposite).
        perms = disp_perms[cid][0]
        swap = [k for k, v in perms.items() if v == 2]
        cyc = "PQRS"
        L = rep["letters"][0]
        adjacent = any(abs(cyc.index(L) - cyc.index(T)) in (1, 3) for T in swap)
        star = "" if adjacent else "*"
    label = "PP%d%s[2]%s%s" % (n, suffix, ("₍%s₎" % sub if False else ""), "")
    pretty = "PP%d%s[2]" % (n, suffix)
    if sub:
        pretty += {"1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅"}[sub]
    pretty += star
    anchor = "pp%d%s-2" % (n, suffix.lower())
    if sub:
        anchor += "-" + sub
    if star:
        anchor += "s"
    return {"pp": n, "variety": suffix, "sub": sub, "star": bool(star),
            "pretty": pretty, "anchor": anchor}


# ------------------------------------------------------------- JSON export

def cart(B, v):
    return (B[0][0] * float(v[0]) + B[1][0] * float(v[1]),
            B[0][1] * float(v[0]) + B[1][1] * float(v[1]))


def cart_matrix(B, M):
    """B M B^-1 as a 2x2 float matrix (columns of B are the basis)."""
    Bm = ((B[0][0], B[1][0]), (B[0][1], B[1][1]))
    det = Bm[0][0] * Bm[1][1] - Bm[0][1] * Bm[1][0]
    Bi = ((Bm[1][1] / det, -Bm[0][1] / det), (-Bm[1][0] / det, Bm[0][0] / det))
    Mf = ((float(M[0][0]), float(M[0][1])), (float(M[1][0]), float(M[1][1])))

    def mul(A, C):
        return ((A[0][0] * C[0][0] + A[0][1] * C[1][0], A[0][0] * C[0][1] + A[0][1] * C[1][1]),
                (A[1][0] * C[0][0] + A[1][1] * C[1][0], A[1][0] * C[0][1] + A[1][1] * C[1][1]))
    return mul(mul(Bm, Mf), Bi)


def write_json(out_types, disp_perms, gsmap, groups):
    grp_by_id = {r["id"]: r for r in groups}
    ORDER_KIND = {"interior": 0, "edge": 1, "corner": 2, "gyration": 3}
    wall = {}
    for hm in ORDER17:
        G = GROUPS[hm]
        B = view_basis(hm, G.basis)
        gens = []
        for name, el in CHAIM[hm]["gens"]:
            M, v = el
            entry = {"name": name, "geometry": CHAIM[hm]["geometry"][name],
                     "matrix": [list(cart_matrix(B, M)[0]), list(cart_matrix(B, M)[1])],
                     "translation": list(cart(B, v))}
            if M == I2:
                entry["kind"] = "translation"
                entry["vector"] = list(cart(B, v))
            elif mdet(M) == 1:
                c = rotation_centre(el)
                entry["kind"] = "rotation"
                entry["centre"] = list(cart(B, c))
                entry["order"] = rotation_order(M)
                # sense: angle of the cartesian matrix
                A = cart_matrix(B, M)
                entry["angle_degrees"] = round(math.degrees(math.atan2(A[1][0], A[0][0])), 6)
            else:
                if is_reflection(el):
                    p0, d = line_of(el)
                    entry["kind"] = "mirror"
                    entry["axis_point"] = list(cart(B, p0))
                    dc = cart(B, d)
                    nrm = math.hypot(*dc)
                    entry["axis_direction"] = [dc[0] / nrm, dc[1] / nrm]
                    entry["glide"] = 0.0
                else:
                    # glide: axis through the midpoint of x and its image
                    # (for x = v/2: axis point = v/2 projected); glide vector
                    # = component of v along the axis direction
                    IM = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
                    if IM[0] != (0, 0):
                        d = (-IM[0][1], IM[0][0])
                    else:
                        d = (-IM[1][1], IM[1][0])
                    dc = cart(B, d)
                    nrm = math.hypot(*dc)
                    dc = (dc[0] / nrm, dc[1] / nrm)
                    vc = cart(B, v)
                    along = vc[0] * dc[0] + vc[1] * dc[1]
                    perp = (vc[0] - along * dc[0], vc[1] - along * dc[1])
                    entry["kind"] = "glide"
                    entry["axis_point"] = [perp[0] / 2, perp[1] / 2]
                    entry["axis_direction"] = list(dc)
                    entry["glide"] = along
            gens.append(entry)
        wall[hm] = {"hm": hm, "orbifold": G.orb, "basis": [[B[0][0], B[0][1]], [B[1][0], B[1][1]]],
                    "annotated": CHAIM[hm]["annotated"],
                    "template": CHAIM[hm]["template"],
                    "relations": CHAIM[hm]["relations"],
                    "generators": gens}

    entries = []
    for rec, lab in out_types:
        hm = rec["hm"]
        G = GROUPS[hm]
        B = view_basis(hm, G.basis)
        cid = rec["colour_group"]
        rep = rec["rep"]
        H = rec["H"]
        perms, sig = disp_perms[cid]
        r = grp_by_id[cid]
        # ops of Gamma modulo Z^2 with colour (0 keep, 1 swap) w.r.t. H
        ops = []
        for M, v in G.ops.items():
            A = cart_matrix(B, M)
            ops.append({"m": [round(A[0][0], 6), round(A[0][1], 6), round(A[1][0], 6), round(A[1][1], 6)],
                        "t": [round(x, 6) for x in cart(B, v)],
                        "c": 0 if H.contains((M, v)) else 1})
        # the colour lattice: H ∩ Z^2 = L; colour of the translation (i, j)
        # is (a i + b j) mod 2
        Lcols = EC.lat_cols(H.L)
        lat_colour = [0 if H.contains((I2, (F(1), F(0)))) else 1,
                      0 if H.contains((I2, (F(0), F(1)))) else 1]
        # seed
        seed = seat_point(G, rep)
        seedc = cart(B, seed)
        # motif orientation: direction of a mirror through the seat (cartesian
        # angle) for d_n; 0 for c_n
        angle = 0.0
        if rep["stype"].startswith("d"):
            refl = [e for e in rep["S"] if mdet(e[0]) == -1]
            # prefer the letter's own mirror
            if rep["kind"] == "edge":
                el = refl[0]
            else:
                letter = rep["letters"][0]
                el = dict(CHAIM[hm]["gens"]).get(letter)
                if el is None or el not in rep["S"]:
                    el = refl[0]
            p0, d = line_of(el)
            dc = cart(B, d)
            angle = math.degrees(math.atan2(dc[1], dc[0]))
        # marks: symbolic
        equiv = []
        for s in rec["equivalent"]:
            equiv.append({"kind": s["kind"], "letters": s["letters"], "label": s["label"]})
        # stabiliser words
        if rep["kind"] == "interior":
            swords = []
        elif rep["kind"] == "edge":
            swords = [rep["letters"][0]]
        elif rep["kind"] == "corner":
            swords = rep["letters"]
        else:
            swords = [rep["letters"][0]]
        # min distance between distinct orbit points (cartesian), for sizing
        mind = min_orbit_distance(G, seed)
        entries.append({
            "id": lab["anchor"],
            "gs": lab["pretty"],
            "pp": lab["pp"], "variety": lab["variety"], "star": lab["star"],
            "hm": hm, "orbifold": G.orb,
            "colour_group": cid,
            "gs_group": gsmap[cid]["gs"],
            "shubnikov": gsmap[cid].get("shubnikov"),
            "H": {"hm": r["subType"], "orb": GROUPS[r["subType"]].orb},
            "chaim_type": "%s/%s" % (G.orb, GROUPS[r["subType"]].orb) + (
                # The Symmetries of Things distinguishes the two **/** types
                {"²*¹*¹": " (1)", "¹*¹*²": " (2)"}.get(sig, "") if hm == "pm" and r["subType"] == "pm" else ""),
            "signature": sig,
            "perms": perms,
            "seat": {"kind": rep["kind"], "letters": rep["letters"], "label": rep["label"],
                     "stype": rep["stype"], "order": rep.get("order"),
                     "point": [round(x, 6) for x in seedc], "angle": round(angle, 6),
                     "stab_words": swords, "equivalent": equiv},
            "primitive": rep["kind"] == "interior",
            "render": {"ops": ops, "seed": [round(x, 6) for x in seedc],
                       "min_dist": round(mind, 6),
                       "lattice_colour": lat_colour},
        })
    # order: by wallpaper, then colour group id, then kind
    entries.sort(key=lambda e: (ORDER17.index(e["hm"]), int(e["colour_group"].split("-")[-1]),
                                ORDER_KIND[e["seat"]["kind"]], e["pp"], e["variety"], e["star"]))
    meta = {
        "title": "Two-Color Patterns",
        "count": len(entries),
        "primitive": sum(1 for e in entries if e["primitive"]),
        "nonprimitive": sum(1 for e in entries if not e["primitive"]),
        "note": "88 periodic two-colour pattern types (Grünbaum & Shephard 8.3.1) "
                "as marked coloured orbifolds: colour group (catalogue D id) + seat "
                "stratum of the motif; 87 classes as (S,H) pairs (PP48A/B merge).",
    }
    path = os.path.join(DOCS, "data", "two-color-patterns.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "wallpaper": wall, "types": entries}, f,
                  ensure_ascii=False, indent=1)
    print("wrote %s (%d types)" % (path, len(entries)))


# drawing frames: rotate the cartesian view of a group so that its mirrors
# lie along the axes where the books draw them (p4g: mirrors are the
# diagonals of the enumerate_colored model).
VIEW_ROT_DEG = {"p4g": 45.0}


def view_basis(hm, B):
    th = math.radians(VIEW_ROT_DEG.get(hm, 0.0))
    if th == 0.0:
        return B
    c, s_ = math.cos(th), math.sin(th)
    rot = lambda v: (c * v[0] - s_ * v[1], s_ * v[0] + c * v[1])
    return (rot(B[0]), rot(B[1]))


def seat_point(G, rep):
    """A rational point in the stratum, chosen for spacing: for lines the
    position along the line (within the edge) that maximises the minimum
    distance between distinct orbit points; for interior a grid search."""
    if rep["kind"] in ("corner", "gyration"):
        return rep["point"]
    if rep["kind"] == "edge":
        p0, d = rep["line"]
        if rep.get("segment"):
            # the midpoint of the edge: canonical, and it shows the clusters
            # at both ends of the edge (PP48A: 6-cluster and 3-cluster)
            a, b = rep["segment"]
            mid = vadd(a, ((b[0] - a[0]) / 2, (b[1] - a[1]) / 2))
            assert stabiliser(G, mid) == rep["S"]
            return mid
        else:
            cands = [vadd(p0, (d[0] * F(i, 24), d[1] * F(i, 24))) for i in range(0, 24)]
        best = None
        for c in cands:
            if stabiliser(G, c) != rep["S"]:
                continue
            md = min_orbit_distance(G, c)
            if best is None or md > best[0]:
                best = (md, c)
        return best[1]
    # interior: grid
    best = None
    for i in range(1, 12):
        for j in range(1, 12):
            c = (F(i, 12) + F(1, 37), F(j, 12) + F(1, 53))
            if stab_type(stabiliser(G, c)) != "c1":
                continue
            md = min_orbit_distance(G, c)
            if best is None or md > best[0]:
                best = (md, c)
    return best[1]


def min_orbit_distance(G, p):
    B = G.basis
    pts = set()
    for M, v in G.ops.items():
        q = vmod1(vadd(mvec(M, p), v))
        pts.add(q)
    pts = list(pts)
    best = None
    for i, a in enumerate(pts):
        for j, b in enumerate(pts):
            for s1 in (-1, 0, 1):
                for s2 in (-1, 0, 1):
                    if i == j and s1 == 0 and s2 == 0:
                        continue
                    dv = (a[0] - b[0] + s1, a[1] - b[1] + s2)
                    if dv == ZERO:
                        continue
                    dc = cart(B, dv)
                    dd = math.hypot(*dc)
                    if best is None or dd < best:
                        best = dd
    return best


if __name__ == "__main__":
    main()
