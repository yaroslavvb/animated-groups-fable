#!/usr/bin/env python3
"""Rigorous plane colour-group names for the clock-invisible film classes.

A class of the Shubnikov census (docs/shubnikov/data/census.json) is a
colouring sigma: G -> Z_n of a forward film group G, onto, where G acts on
(x, t) by (M | v | tau).  The class is CLOCK-INVISIBLE when c_t = sigma(t) = 0
for the film period t: then sigma kills the whole time-translation subgroup
<t> = ker(G -> Gamma), so it factors through the parent wallpaper group

    Gamma = G / <t>   (the spatial parts (M | v), with the lattice Z^2 and
                       any centring translations, time shifts forgotten)

as a plane colouring sigmabar: Gamma -> Z_n.  The pair (Gamma, H) with
H = ker sigmabar is a k-coloured plane crystal with k = n, and
docs/data/colored.json is the complete catalogue of those pairs for k <= 6
(269 of them; Grunbaum-Shephard Table 8.2.1 = Jarratt-Schwarzenberger Table 5
= Wieting).  This script decides, for each of the 324 clock-invisible
classes, WHICH catalogue entry it is, and emits docs/shubnikov/data/names.json
with the catalogue id plus the Grunbaum-Shephard and Shubnikov/Belov symbols
from docs/data/colored-gs.json.

Two independent identifications are computed and required to agree:

  METHOD A (explicit conjugacy / normaliser orbits).  Every catalogue entry's
  subgroup H is reconstructed from its own concrete realisation
  (entry.render: the colour of every coset of Gamma modulo the colour-period
  lattice), placed in the standard model of Gamma with T = Z^2, and closed
  under the affine normaliser of Gamma (generators from
  enumerate/enumerate_colored.py: every A in GL(2,Z) with |entries| <= 2 that
  normalises the point group, with a compatible translation, plus the
  discrete translation normaliser on a 1/12 grid, plus Z^2).  Each orbit is
  the set of subgroups affinely equivalent to that entry.  We CHECK that,
  for every (Gamma, k), these orbits are pairwise disjoint and their union is
  the complete list of index-k subgroups of Gamma produced independently by
  enumerate_colored.subgroups_index_k -- so the orbits partition the
  subgroups and a lookup is a proof, not a guess.  Each class's H is then
  carried into the standard model of Gamma by an explicit affine map
  (A | t) and looked up in that partition.

  METHOD B (a complete invariant, verified complete).  Each coloured pair is
  fingerprinted by data that no affine conjugation and no recolouring can
  change: (k, type of H, type of the colour-fixing kernel, lattice index,
  point index); the multiset over the cosets of Gamma modulo the
  colour-period lattice L* of (det M, tr M, order of M, "does this coset
  contain a finite-order element, i.e. a rotation/reflection rather than a
  glide", colour permutation); and, for every point-group element M whose
  I - M has rank 1 (reflections and glides), the colour permutations of the
  primitive lattice translations along ker(I - M) and along im(I - M), each
  taken up to inversion (the primitive generator is only defined up to sign).
  The whole fingerprint is canonicalised by minimising over all k!
  recolourings.  The script PROVES the fingerprint is complete for our
  purpose by comparing all pairs of catalogue entries sharing a (Gamma, k):
  the only collisions left are three pairs of NON-cyclic entries
  (c6-p4-1/2, c6-p6m-2/3, c6-p6m-5/6), and the fingerprint itself records the
  colour permutation group, so a cyclic colouring can never collide with a
  non-cyclic one.  Every class here is cyclic (its colour group is the
  regular Z_n), so its fingerprint picks out exactly one entry.

Neither method uses the coarse invariants stored in colored.json (kernel type,
lattice index, point index), because those do not separate the catalogue.
Among the cyclic entries with k in {2, 3, 4, 6} exactly three groups of two
share all of them -- pm[2]5 = p'b1m (c2-pm-2) with pm[2]3 = p'bm (c2-pm-3),
c4-pg-2 with c4-pg-3, and c6-pm-6 with c6-pm-7.  (The pair pm[2]4 = pm'
(c2-pm-1) and pm[2]5 = p'b1m (c2-pm-2), sometimes quoted as the awkward one,
is in fact told apart by those invariants: pm' has kernel p1, lattice index 1,
point index 2, while p'b1m has kernel pm, lattice index 2, point index 1.)
coarse_audit() lists those collisions, asserts the fingerprint separates each,
and records them in names.json, so the delicate cases are auditable rather
than implicit.

Run with no arguments to regenerate docs/shubnikov/data/names.json; run with
--check to verify the file on disk byte-for-byte against a fresh computation.
"""

import argparse
import itertools
import json
import math
import os
import sys
from collections import defaultdict
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DOCS = os.path.join(ROOT, "docs")
sys.path.insert(0, os.path.join(ROOT, "enumerate"))

import enumerate_colored as EC   # noqa: E402  (the plane colour-group engine)

I2 = EC.I2
CENSUS = os.path.join(DOCS, "shubnikov", "data", "census.json")
COLORED = os.path.join(DOCS, "data", "colored.json")
COLORED_GS = os.path.join(DOCS, "data", "colored-gs.json")
OUT = os.path.join(DOCS, "shubnikov", "data", "names.json")

SCHEMA = "shubnikov-names-v1"
METHOD = (
    "For every clock-invisible class (c_t = sigma(t) = 0) the colouring "
    "sigma: G -> Z_n kills the time translation, so it descends to the parent "
    "wallpaper group Gamma = G/<t>: the spatial parts (M | v) of the film's "
    "ops, with the translation lattice enlarged by the film's centring "
    "vectors, and sigmabar read off class.c (on the ops) and class.u (on the "
    "two lattice vectors). The pair (Gamma, ker sigmabar) is a k-coloured "
    "plane crystal with k = n, so it is one of the 269 entries of "
    "docs/data/colored.json. Gamma is carried onto the standard model of its "
    "type by an explicit affine map (A | t) (enumerate_colored."
    "classify_with_map), and the entry is then determined twice over. Method "
    "A: every catalogue entry's subgroup is rebuilt from its own concrete "
    "realisation (entry.render) and closed under the affine normaliser of "
    "Gamma; the resulting orbits are checked to partition the complete list "
    "of index-k subgroups of Gamma, so looking the class's kernel up in the "
    "partition is an explicit affine conjugacy, not an inference. Method B: "
    "an affine- and recolouring-invariant fingerprint (types of H and of the "
    "colour kernel, lattice and point index; per coset of Gamma modulo the "
    "colour-period lattice the tuple (det M, tr M, order of M, does the coset "
    "contain a finite-order element, colour permutation); and for every M "
    "with rank(I - M) = 1 the colour permutations of the primitive "
    "translations along ker(I - M) and im(I - M), up to inversion), "
    "canonicalised over all k! recolourings; it is verified by exhaustive "
    "pairwise comparison to separate every pair of catalogue entries with the "
    "same (Gamma, k) except three pairs of non-cyclic entries, which no "
    "cyclic colouring can match. The two methods are required to agree on all "
    "324 classes. Neither uses the coarse invariants kernel type / lattice "
    "index / point index, which do not separate the catalogue: three pairs of "
    "cyclic entries share all of them (p'b1m with p'bm, c4-pg-2 with c4-pg-3, "
    "c6-pm-6 with c6-pm-7) and are listed under "
    "summary.coarseInvariantCollisions together with what separates them."
)


# ------------------------------------------------------------------ helpers

def frac(x):
    return F(x) if isinstance(x, str) else F(x)


def cat_frac(x):
    """Exact rational from a colored.json float (everything is on a 1/24 grid)."""
    f = F(x).limit_denominator(24)
    assert abs(float(f) - x) < 1e-9, x
    return f


def mat_order(M):
    P, o = M, 1
    while P != I2:
        P = EC.mmul(M, P)
        o += 1
        assert o <= 12, M
    return o


def rat_gcd(vals):
    g = F(0)
    for x in vals:
        x = abs(F(x))
        if x == 0:
            continue
        if g == 0:
            g = x
        else:
            g = F(math.gcd(g.numerator * x.denominator,
                           x.numerator * g.denominator),
                  g.denominator * x.denominator)
    return g


def primitive(v):
    """Primitive integer generator of Z^2 ∩ span(v), sign-normalised."""
    a, b = F(v[0]), F(v[1])
    assert (a, b) != (0, 0)
    den = math.lcm(a.denominator, b.denominator)
    a, b = int(a * den), int(b * den)
    g = math.gcd(abs(a), abs(b))
    a, b = a // g, b // g
    if a < 0 or (a == 0 and b < 0):
        a, b = -a, -b
    return (a, b)


def rank1_axes(P):
    """[(M, primitive of im(I-M), primitive of ker(I-M))] for M with
    rank(I - M) = 1 — the reflections and glides of the point group."""
    out = []
    for M in sorted(P):
        IM = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
        if M == I2 or EC.mdet(IM) != 0:
            continue
        c0, c1 = (IM[0][0], IM[1][0]), (IM[0][1], IM[1][1])
        im = c0 if c0 != (0, 0) else c1
        k0, k1 = (-IM[0][1], IM[0][0]), (-IM[1][1], IM[1][0])
        ker = k0 if k0 != (0, 0) else k1
        out.append((M, primitive(im), primitive(ker)))
    return out


def perm_inv(p):
    q = [0] * len(p)
    for i, x in enumerate(p):
        q[x] = i
    return tuple(q)


def perm_conj(p, pi, inv):
    return tuple(pi[p[inv[i]]] for i in range(len(p)))


def fingerprint(P, Lcols, k, perm_of, elems, extra):
    """Method B's affine + recolouring invariant of a coloured pair.

    P      point matrices of Gamma; Lcols the two columns of the colour-period
           lattice L* (the largest sublattice acting trivially on colours);
    elems  one representative of every coset of Gamma modulo L*;
    perm_of(M, v) the colour permutation of that element;
    extra  scalar invariants prepended verbatim.
    """
    Lh = EC.hnf_of([Lcols[0], Lcols[1]])
    lab = []
    for M, v in elems:
        IM = ((1 - M[0][0], -M[0][1]), (-M[1][0], 1 - M[1][1]))
        if M == I2:
            # the coset contains the identity iff -v is a period
            fin = EC.in_lat((-v[0], -v[1]), Lh)
        elif EC.mdet(IM) != 0:
            fin = True                       # a rotation: always has a centre
        else:
            c0, c1 = (IM[0][0], IM[1][0]), (IM[0][1], IM[1][1])
            d = c0 if c0 != (0, 0) else c1
            f = lambda x: d[0] * F(x[1]) - d[1] * F(x[0])   # noqa: E731
            g = rat_gcd([f(Lcols[0]), f(Lcols[1])])
            # finite order <=> v in im(I - M); somewhere in the coset <=>
            # v in im(I - M) + L*
            fin = (f(v) == 0) if g == 0 else (f(v) / g).denominator == 1
        lab.append(((EC.mdet(M), M[0][0] + M[1][1], mat_order(M), fin),
                    perm_of(M, v)))
    ax = []
    for M, im, ker in rank1_axes(P):
        ax.append((EC.mdet(M), M[0][0] + M[1][1], mat_order(M),
                   perm_of(I2, (F(im[0]), F(im[1]))),
                   perm_of(I2, (F(ker[0]), F(ker[1])))))
    best = None
    for pi in itertools.permutations(range(k)):
        inv = perm_inv(pi)
        a = tuple(sorted((h, perm_conj(p, pi, inv)) for h, p in lab))
        b = tuple(sorted(
            (h1, h2, h3,
             min(perm_conj(p1, pi, inv), perm_conj(perm_inv(p1), pi, inv)),
             min(perm_conj(p2, pi, inv), perm_conj(perm_inv(p2), pi, inv)))
            for h1, h2, h3, p1, p2 in ax))
        cur = (a, b)
        if best is None or cur < best:
            best = cur
    return (extra, best)


# --------------------------------------------------------- catalogue side

class CatEntry:
    """A colored.json entry rebuilt from its own concrete realisation."""

    def __init__(self, e):
        self.id = e["id"]
        self.k = e["k"]
        self.hm = e["base"]["hm"]
        self.cyclic = e["cyclic"]
        self.normal = e["normal"]
        G = EC.GROUPS[self.hm]
        cell = e["render"]["cell"]
        self.Lcols = (tuple(cell[0]), tuple(cell[1]))
        Lstar = EC.hnf_of([self.Lcols[0], self.Lcols[1]])
        ops = [((tuple(op["M"][0]), tuple(op["M"][1])),
                (cat_frac(op["v"][0]), cat_frac(op["v"][1])), op["color"])
               for op in e["render"]["ops"]]
        table = defaultdict(list)
        for M, v, c in ops:
            table[M].append((v, c))

        def colour(M, v):
            for w, c in table[M]:
                if EC.in_lat((v[0] - w[0], v[1] - w[1]), Lstar):
                    return c
            raise AssertionError("colour lookup failed for %s" % self.id)

        reps = {}
        for M, v, c in ops:
            reps.setdefault(c, (M, v))
        assert len(reps) == self.k, self.id

        def perm_of(M, v):
            p = tuple(colour(*EC.gmul((M, v), reps[j])) for j in range(self.k))
            assert sorted(p) == list(range(self.k)), (self.id, M, v)
            return p

        # H = the stabiliser of colour 0
        tr0 = [(int(v[0]), int(v[1])) for M, v, c in ops if M == I2 and c == 0]
        Lh = EC.hnf_of(tr0 + [self.Lcols[0], self.Lcols[1]])
        w = {}
        for M, v, c in ops:
            if c == 0 and M not in w:
                w[M] = v
        self.sub = EC.Sub(Lh, w.keys(), w)
        assert EC.lat_index(self.sub.L) == e["latticeIndex"], self.id
        assert len(G.ops) // len(self.sub.w) == e["pointIndex"], self.id
        sub_t = EC.classify_concrete(EC.as_concrete_group(self.sub))
        assert sub_t == e["sub"]["hm"], (self.id, sub_t, e["sub"]["hm"])
        self.sub_t = sub_t
        self.lat_index = EC.lat_index(self.sub.L)
        self.point_index = e["pointIndex"]
        # K = the colour-fixing kernel
        idp = tuple(range(self.k))
        kw = {}
        for M, v, c in ops:
            if M not in kw and perm_of(M, v) == idp:
                kw[M] = v
        kern = EC.Sub(Lstar, kw.keys(), kw)
        kern_t = EC.classify_concrete(EC.as_concrete_group(kern))
        assert kern_t == e["kernel"]["hm"], (self.id, kern_t, e["kernel"]["hm"])
        self.extra = (self.k, sub_t, kern_t, EC.lat_index(self.sub.L),
                      e["pointIndex"])
        elems = [(M, v) for M, v, _ in ops]
        self.fp = fingerprint(list(G.ops.keys()), self.Lcols, self.k,
                              perm_of, elems, self.extra)


def moved_signature(fp):
    """The recolouring-invariant multiset of coset labels whose colour
    permutation is NOT the identity — i.e. "which kinds of element move the
    colours".  Read straight off the canonical fingerprint, so it is itself an
    affine + recolouring invariant, weaker than the full fingerprint."""
    lab = fp[1][0]
    idp = None
    for _h, p in lab:
        idp = tuple(range(len(p)))
        break
    return tuple(sorted(h for h, p in lab if p != idp))


def coarse_audit(entries, ks, log):
    """Record, and separate, the pairs of catalogue entries that the COARSE
    invariants of colored.json (kernel type, lattice index, point index) fail
    to tell apart.  Those are the cases where a name could plausibly be
    guessed wrong, so each one is shown to be separated by the fingerprint.
    """
    groups = defaultdict(list)
    for e in entries:
        if e.k in ks and e.cyclic:
            key = (e.hm, e.k, e.sub_t, e.lat_index, e.point_index)
            groups[key].append(e)
    out = []
    for key, es in sorted(groups.items(), key=lambda kv: (kv[0][1], kv[0][0], kv[0][2])):
        if len(es) < 2:
            continue
        hm, k, kern, li, pi = key
        fps = [e.fp for e in es]
        assert len(set(fps)) == len(fps), ("fingerprint fails to separate a "
                                           "coarse-invariant collision",
                                           [e.id for e in es])
        sigs = [moved_signature(e.fp) for e in es]
        out.append({
            "base": hm, "k": k, "kernel": kern,
            "latticeIndex": li, "pointIndex": pi,
            "ids": [e.id for e in es],
            "separatedBy": ("colour-moving element types"
                            if len(set(sigs)) == len(sigs)
                            else "full fingerprint (axis/coset detail)"),
        })
        log("  coarse collision %s k=%d (kernel %s, lattice %d, point %d): %s "
            "-- separated by %s" % (hm, k, kern, li, pi,
                                    ", ".join(e.id for e in es),
                                    out[-1]["separatedBy"]))
    return out


def normaliser_orbit(sub, moves):
    seen = {sub.key}
    frontier = [sub]
    while frontier:
        nxt = []
        for s in frontier:
            for mv in moves:
                s2 = EC.apply_move(s, mv)
                if s2.key not in seen:
                    seen.add(s2.key)
                    nxt.append(s2)
        frontier = nxt
    return seen


# ------------------------------------------------------------- census side

def project(film, n, cvals, u):
    """The parent wallpaper group of a clock-invisible class, with sigmabar.

    Returns (ops, sigma, (s1, s2)) where ops maps each point matrix of Gamma
    to its translation part mod 1, IN THE PRIMITIVE COORDINATES OF Gamma's
    OWN translation lattice T_proj = Z^2 + centrings, sigma maps each point
    matrix to sigmabar of that representative (as a fraction mod 1), and
    s1, s2 are sigmabar on the two basis translations.  Multiply by n for the
    colour.
    """
    ops = []
    for (M, v, _tau), cv in zip(film["ops"], cvals):
        M = (tuple(M[0]), tuple(M[1]))
        ops.append((M, (frac(v[0]), frac(v[1])), F(cv, n) % 1))
    cents = [(v, s) for M, v, s in ops if M == I2]
    den = 1
    for v, _ in cents:
        for x in v:
            den = den * x.denominator // math.gcd(den, x.denominator)
    sup = EC.hnf_of([(int(v[0] * den), int(v[1] * den)) for v, _ in cents]
                    + [(den, 0), (0, den)])
    b1 = (F(sup[0][0], den), F(0))
    b2 = (F(sup[0][1], den), F(sup[1][1], den))
    B = ((b1[0], b2[0]), (b1[1], b2[1]))
    d = B[0][0] * B[1][1] - B[0][1] * B[1][0]
    Bi = ((B[1][1] / d, -B[0][1] / d), (-B[1][0] / d, B[0][0] / d))
    su = (F(u[0], n) % 1, F(u[1], n) % 1)

    def phase(b):
        for v, s in cents:
            dd = (b[0] - v[0], b[1] - v[1])
            if dd[0].denominator == 1 and dd[1].denominator == 1:
                return (s + dd[0] * su[0] + dd[1] * su[1]) % 1
        raise AssertionError("translation outside T_proj: %s" % (b,))

    s1, s2 = phase(b1), phase(b2)
    proj, sig = {}, {}
    for M, v, s in ops:
        Mp = EC.mmul_frac(Bi, EC.mmul_frac(M, B))
        for row in Mp:
            for x in row:
                assert EC.is_int(x), ("point matrix not integral", M)
        Mp = ((int(Mp[0][0]), int(Mp[0][1])), (int(Mp[1][0]), int(Mp[1][1])))
        vp = EC.mvec(Bi, v)
        vr = EC.vmod1(vp)
        nn = (vp[0] - vr[0], vp[1] - vr[1])
        sr = (s - nn[0] * s1 - nn[1] * s2) % 1
        if Mp in proj:
            # two ops in the same coset of Gamma: they must agree, both in
            # translation part and in colour (sigma is a homomorphism)
            assert proj[Mp] == vr, ("coset clash", M)
            assert sig[Mp] == sr, ("sigma not well defined on Gamma", M)
            continue
        proj[Mp], sig[Mp] = vr, sr
    return proj, sig, (s1, s2)


def to_standard(proj, sig, s12):
    """Carry (Gamma, sigmabar) onto the standard model of Gamma's type by an
    explicit affine map (A | t).  Returns (hm, ops, sigma, (s1, s2))."""
    hm, A, t = EC.classify_with_map(proj)
    Ai = EC.minv_uni(A)
    s1, s2 = s12
    # sigma of a lattice vector w (standard coords) is s . (A^{-1} w)
    c1 = EC.mvec(Ai, (F(1), F(0)))
    c2 = EC.mvec(Ai, (F(0), F(1)))
    t1 = (c1[0] * s1 + c1[1] * s2) % 1
    t2 = (c2[0] * s1 + c2[1] * s2) % 1
    ops2, sig2 = {}, {}
    for M, v in proj.items():
        Mp = EC.mmul(EC.mmul(A, M), Ai)
        IM = ((1 - Mp[0][0], -Mp[0][1]), (-Mp[1][0], 1 - Mp[1][1]))
        u = EC.vadd(EC.mvec(A, v), EC.mvec(IM, t))
        ur = EC.vmod1(u)
        nn = (u[0] - ur[0], u[1] - ur[1])
        assert Mp not in ops2
        ops2[Mp] = ur
        sig2[Mp] = (sig[M] - nn[0] * t1 - nn[1] * t2) % 1
    assert set(ops2) == set(EC.GROUPS[hm].ops), hm
    for M in ops2:
        d = EC.vsub(ops2[M], EC.GROUPS[hm].ops[M])
        assert EC.is_int(d[0]) and EC.is_int(d[1]), (hm, M)
    return hm, ops2, sig2, (t1, t2)


class ClassColouring:
    """(Gamma, sigmabar) for one clock-invisible class, in standard coords."""

    def __init__(self, film, cl):
        self.n = n = cl["n"]
        proj, sig, s12 = project(film, n, cl["c"], cl["u"])
        self.hm, ops, sig, (s1, s2) = to_standard(proj, sig, s12)
        assert self.hm == film["family"], (cl["id"], self.hm, film["family"])
        self.ops, self.sig, self.s1, self.s2 = ops, sig, s1, s2
        # sigmabar is onto Z_n
        dens = [F(x).denominator for x in list(sig.values()) + [s1, s2]]
        lcm = 1
        for d in dens:
            lcm = lcm * d // math.gcd(lcm, d)
        assert lcm == n, (cl["id"], "sigma is not onto Z_%d" % n)
        # the colour-period lattice L* = ker sigmabar ∩ T
        vecs = [(n, 0), (0, n)]
        for m1 in range(n):
            for m2 in range(n):
                if (m1, m2) != (0, 0) and (m1 * s1 + m2 * s2) % 1 == 0:
                    vecs.append((m1, m2))
        self.Lstar = EC.hnf_of(vecs)
        self.Lcols = EC.lat_cols(self.Lstar)
        self.box = EC.lat_box(self.Lstar)
        # H = ker sigmabar
        w = {}
        for M in ops:
            for o in self.box:
                v = EC.vadd(ops[M], o)
                if self.colour(M, v) == 0:
                    w[M] = v
                    break
        lat0 = [(int(o[0]), int(o[1])) for o in self.box
                if self.colour(I2, (F(o[0]), F(o[1]))) == 0]
        Lh = EC.hnf_of(lat0 + [self.Lcols[0], self.Lcols[1]])
        self.sub = EC.Sub(Lh, w.keys(), w)
        self.point_index = len(ops) // len(w)
        assert EC.lat_index(Lh) * self.point_index == n, cl["id"]
        sub_t = EC.classify_concrete(EC.as_concrete_group(self.sub))
        self.extra = (n, sub_t, sub_t, EC.lat_index(Lh), self.point_index)
        elems = [(M, EC.vadd(ops[M], o)) for M in sorted(ops) for o in self.box]
        self.fp = fingerprint(list(ops.keys()), self.Lcols, n,
                              self.perm_of, elems, self.extra)

    def colour(self, M, v):
        z = (F(v[0]) - self.ops[M][0], F(v[1]) - self.ops[M][1])
        assert z[0].denominator == 1 and z[1].denominator == 1
        val = (self.sig[M] + z[0] * self.s1 + z[1] * self.s2) % 1 * self.n
        assert val.denominator == 1
        return int(val)

    def perm_of(self, M, v):
        c = self.colour(M, v)
        return tuple((j + c) % self.n for j in range(self.n))


# ----------------------------------------------------------------- driver

def compute(verbose=True):
    with open(CENSUS, encoding="utf-8") as f:
        census = json.load(f)
    with open(COLORED, encoding="utf-8") as f:
        cat = json.load(f)
    with open(COLORED_GS, encoding="utf-8") as f:
        gs = json.load(f)["groups"]

    log = print if verbose else (lambda *a, **k: None)

    entries = [CatEntry(e) for e in cat["groups"]]
    by_id = {e.id: e for e in entries}
    raw_by_id = {e["id"]: e for e in cat["groups"]}
    log("catalogue: %d entries rebuilt from their own realisations" % len(entries))

    # --- method B completeness: pairwise separation within each (Gamma, k)
    buckets = defaultdict(dict)
    collisions = []
    for e in entries:
        d = buckets[(e.hm, e.k)]
        if e.fp in d:
            collisions.append(sorted([d[e.fp], e.id]))
        d[e.fp] = e.id
    cyclic_collisions = [c for c in collisions
                         if by_id[c[0]].cyclic or by_id[c[1]].cyclic]
    log("fingerprint separation: %d colliding pairs within a (Gamma, k): %s"
        % (len(collisions), collisions))
    assert not cyclic_collisions, ("fingerprint fails on cyclic entries",
                                   cyclic_collisions)

    ks = sorted({cl["n"] for cl in census["classes"] if cl["key"] == "ct0"})

    # --- the cases a coarse invariant would get wrong, separated explicitly
    log("coarse-invariant collisions among the cyclic entries with k in %s:" % ks)
    coarse = coarse_audit(entries, ks, log)

    # --- method A: normaliser orbits, checked to partition the subgroups
    moves = {hm: EC.normaliser_moves(EC.GROUPS[hm]) for hm in EC.ORDER17}
    orbit_of = {}
    for e in entries:
        if e.k in ks:
            orbit_of[e.id] = normaliser_orbit(e.sub, moves[e.hm])
    lookup = {}
    for eid, orb in orbit_of.items():
        e = by_id[eid]
        for key in orb:
            tag = (e.hm, e.k, key)
            assert tag not in lookup, ("orbits overlap", eid, lookup[tag])
            lookup[tag] = eid
    for hm in EC.ORDER17:
        for k in ks:
            ids = [e.id for e in entries if e.hm == hm and e.k == k]
            allsubs = {s.key for s in EC.subgroups_index_k(EC.GROUPS[hm], k)}
            union = set()
            for i in ids:
                union |= orbit_of[i]
            assert union == allsubs, (hm, k, len(union), len(allsubs))
    log("normaliser orbits partition every index-k subgroup set, k in %s" % ks)

    # --- identify every clock-invisible class
    names = {}
    by_n = defaultdict(int)
    agreed = 0
    for cl in census["classes"]:
        if cl["key"] != "ct0":
            continue
        assert cl["ct"] == 0, cl["id"]
        film = census["films"][cl["gid"]]
        cc = ClassColouring(film, cl)
        a = lookup.get((cc.hm, cc.n, cc.sub.key))
        assert a is not None, (cl["id"], "no normaliser orbit contains it")
        b = buckets[(cc.hm, cc.n)].get(cc.fp)
        assert b is not None, (cl["id"], "no catalogue fingerprint matches")
        assert a == b, ("methods disagree", cl["id"], a, b)
        agreed += 1
        e = raw_by_id[a]
        assert e["k"] == cc.n, (cl["id"], e["id"])
        assert e["cyclic"] and e["normal"], (cl["id"], e["id"])
        assert e["base"]["hm"] == cc.hm == film["family"], cl["id"]
        rec = {"colored": a}
        g = gs.get(a)
        if g and g.get("gs"):
            rec["gs"] = g["gs"]
        if cc.n == 2:
            assert g and g.get("shubnikov"), (cl["id"], a)
            rec["shubnikov"] = g["shubnikov"]
        names[cl["id"]] = rec
        by_n[cc.n] += 1
    log("identified %d classes; both methods agreed on all %d"
        % (len(names), agreed))

    used = {v["colored"] for v in names.values()}
    two = sorted(i for i in used if raw_by_id[i]["k"] == 2)
    all_two = sorted(e["id"] for e in cat["groups"] if e["k"] == 2)
    missing = [i for i in all_two if i not in used]
    missing_out = []
    for i in missing:
        g = gs.get(i, {})
        missing_out.append({"colored": i, "gs": g.get("gs"),
                            "shubnikov": g.get("shubnikov")})
    # every cyclic catalogue entry of order 2, 3, 4 or 6 should be hit
    cyclic_targets = {e["id"] for e in cat["groups"]
                      if e["cyclic"] and e["k"] in ks}
    log("catalogue entries realised: %d (of %d cyclic entries with k in %s); "
        "unrealised: %s" % (len(used), len(cyclic_targets), ks,
                            sorted(cyclic_targets - used) or "none"))
    assert used <= cyclic_targets

    summary = {
        "classes": len(names),
        "named": len(names),
        "byN": {str(n): by_n[n] for n in sorted(by_n)},
        "distinctColourGroups": len(used),
        "distinctByN": {str(n): len({v["colored"] for v in names.values()
                                     if raw_by_id[v["colored"]]["k"] == n})
                        for n in sorted(by_n)},
        "cyclicColourGroupsAvailable": len(cyclic_targets),
        "cyclicColourGroupsUnrealised": sorted(cyclic_targets - used),
        "twoColourTypesRealised": len(two),
        "twoColourTypesTotal": len(all_two),
        "twoColourTypesMissing": missing_out,
        "fingerprintCollisionsAllNonCyclic": collisions,
        "coarseInvariantCollisions": coarse,
        "symbolCoverage": {
            "gs": "docs/data/colored-gs.json carries Grunbaum-Shephard and "
                  "Shubnikov symbols for k = 2 (all 46) and k = 3 (all 23) "
                  "only, so names for n = 4 and n = 6 give the colored.json id "
                  "alone",
            "namesWithGs": sum(1 for v in names.values() if "gs" in v),
            "namesWithShubnikov": sum(1 for v in names.values()
                                      if "shubnikov" in v),
        },
    }
    doc = {
        "schema": SCHEMA,
        "method": METHOD,
        "sources": {
            "census": "docs/shubnikov/data/census.json",
            "catalogue": "docs/data/colored.json",
            "symbols": "docs/data/colored-gs.json",
            "engine": "enumerate/enumerate_colored.py",
        },
        "summary": summary,
        "names": {k: names[k] for k in sorted(
            names, key=lambda s: (int(s.split("-")[0][1:]),
                                  int(s.split("-")[1][1:]),
                                  int(s.split("-")[2])))},
    }
    return doc


def dumps(doc):
    return json.dumps(doc, indent=1, ensure_ascii=False, sort_keys=False) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="verify the committed names.json instead of writing it")
    ap.add_argument("-q", "--quiet", action="store_true")
    args = ap.parse_args()
    doc = compute(verbose=not args.quiet)
    text = dumps(doc)
    if args.check:
        if not os.path.exists(OUT):
            print("MISSING %s" % OUT)
            return 1
        with open(OUT, encoding="utf-8") as f:
            have = f.read()
        if have != text:
            print("MISMATCH: %s differs from a fresh computation" % OUT)
            return 1
        print("OK: %s matches a fresh computation (%d names)"
              % (OUT, len(doc["names"])))
        return 0
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote %s (%d names, %d distinct colour groups)"
          % (OUT, len(doc["names"]), doc["summary"]["distinctColourGroups"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
