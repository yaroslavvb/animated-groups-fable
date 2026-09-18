"""Geometric model of the 68 forward film groups and of the 17 wallpaper groups.

Data source: docs/scott-gray/wallpaper-groups.json (schema
scott-gray-wallpaper-groups-v1).  Convention, quoted from that file:

    q(Mx + v, t + tau T) = q(x,t); x is measured in the listed lattice basis;
    full lattice translations have zero phase.

So each group is  G = < Lambda = Z^2 (tau = 0),  t = (I, 0, 1),  ops >, where
`ops` is a set of coset representatives of G / (Lambda + Z t).

An element is stored as (M, v, tau) with M integral 2x2, v in Q^2, tau in Q.
"""
from fractions import Fraction as F
import itertools, json

import os
JSON = os.environ.get('WALLPAPER_GROUPS_JSON') or os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', '..', '..', '..', 'scott-gray', 'wallpaper-groups.json')

I2 = ((1, 0), (0, 1))

# Three of the 68 entries carry named generators that satisfy the SoT relators
# but generate a proper (index-2) subgroup, because one generator's axis
# coincides, modulo the lattice, with another's.  These replacements keep the
# linear part and the time shift and move the generator by a lattice vector.
GEN_FIX = {
    'g11':  {'Z': ('1/4', '-3/4')},   # pg:   site has (3/4, -5/4)
    'g131': {'R': ('1', '0')},        # p4m:  site has (-1, 1)
}


def frac(x, maxden=120):
    return F(x).limit_denominator(maxden)


def mm(A, B):
    return ((A[0][0]*B[0][0]+A[0][1]*B[1][0], A[0][0]*B[0][1]+A[0][1]*B[1][1]),
            (A[1][0]*B[0][0]+A[1][1]*B[1][0], A[1][0]*B[0][1]+A[1][1]*B[1][1]))


def mv(A, v):
    return (A[0][0]*v[0]+A[0][1]*v[1], A[1][0]*v[0]+A[1][1]*v[1])


def minv(A):
    d = A[0][0]*A[1][1]-A[0][1]*A[1][0]
    assert d in (1, -1), d
    return ((A[1][1]//d, -A[0][1]//d), (-A[1][0]//d, A[0][0]//d))


def mT(A):
    return ((A[0][0], A[1][0]), (A[0][1], A[1][1]))


def gcd(a, b):
    while b:
        a, b = b, a % b
    return abs(a)


class Group:
    """Film group (with_time=True) or wallpaper group (with_time=False)."""

    def __init__(self, entry, with_time=True, use_fix=True):
        self.id = entry['id']
        self.family = entry['family']
        self.with_time = with_time
        ops = []
        for o in entry['ops']:
            assert o.get('s', 1) == 1, 'forward groups only'
            M = tuple(tuple(int(round(x)) for x in row) for row in o['M'])
            v = (frac(o['v'][0]) % 1, frac(o['v'][1]) % 1)
            tau = (frac(o.get('tau', 0)) % 1) if with_time else F(0)
            ops.append((M, v, tau))
        ops = sorted(set(ops))
        self.ops = ops
        self.index = {o: i for i, o in enumerate(ops)}
        assert len(self.index) == len(ops)
        self.mats = sorted({M for M, _, _ in ops})
        self.id_i = self.index[(I2, (F(0), F(0)), F(0))]
        self.gens = {}
        fix = GEN_FIX.get(self.id, {}) if use_fix else {}
        for g in entry['namedGenerators']:
            M = tuple(tuple(int(round(x)) for x in row) for row in g['M'])
            v = (frac(g['v'][0]), frac(g['v'][1]))
            tau = frac(g.get('tau', 0)) if with_time else F(0)
            if g['name'] in fix:
                v = (F(fix[g['name']][0]), F(fix[g['name']][1]))
            self.gens[g['name']] = (M, v, tau)
        self.gen_order = [g['name'] for g in entry['namedGenerators']]
        self._table()

    # ---- arithmetic ------------------------------------------------------
    def reduce(self, e):
        """(M,v,tau) -> (coset index, lattice carry, time carry)."""
        M, v, tau = e
        key = (M, (v[0] % 1, v[1] % 1), tau % 1 if self.with_time else F(0))
        i = self.index[key]
        Mq, vq, tq = self.ops[i]
        lam = (v[0]-vq[0], v[1]-vq[1])
        kt = (tau - tq) if self.with_time else F(0)
        assert lam[0].denominator == 1 and lam[1].denominator == 1
        assert kt.denominator == 1
        return i, (int(lam[0]), int(lam[1])), int(kt)

    def mul(self, a, b):
        Ma, va, ta = a
        Mb, vb, tb = b
        w = mv(Ma, vb)
        return (mm(Ma, Mb), (w[0]+va[0], w[1]+va[1]), ta+tb)

    def inv(self, a):
        M, v, t = a
        Mi = minv(M)
        w = mv(Mi, v)
        return (Mi, (-w[0], -w[1]), -t)

    def word(self, pairs):
        """Evaluate a word [(name, exp), ...] in the named generators."""
        e = (I2, (F(0), F(0)), F(0))
        for name, ex in pairs:
            g = self.gens[name]
            h = g if ex > 0 else self.inv(g)
            for _ in range(abs(ex)):
                e = self.mul(e, h)
        return e

    def _table(self):
        n = len(self.ops)
        self.tab = [[None]*n for _ in range(n)]
        for a in range(n):
            for b in range(n):
                self.tab[a][b] = self.reduce(self.mul(self.ops[a], self.ops[b]))

    # ---- Hom(G, Z_n) -----------------------------------------------------
    def homs(self, n):
        """All phi: G -> Z_n as (u0, u1, ct, c-tuple-over-ops)."""
        us = [u for u in itertools.product(range(n), repeat=2)
              if all(tuple(x % n for x in mv(mT(M), u)) == u for M in self.mats)]
        cts = range(n) if self.with_time else [0]
        out = []
        N = len(self.ops)
        for u in us:
            for ct in cts:
                for c in itertools.product(range(n), repeat=N):
                    if c[self.id_i]:
                        continue
                    ok = True
                    for a in range(N):
                        for b in range(N):
                            k, lam, kt = self.tab[a][b]
                            if (c[a]+c[b]-u[0]*lam[0]-u[1]*lam[1]-ct*kt-c[k]) % n:
                                ok = False
                                break
                        if not ok:
                            break
                    if ok:
                        out.append((u[0], u[1], ct, c))
        return out

    def ev(self, phi, e):
        u0, u1, ct, c = phi
        i, lam, kt = self.reduce(e)
        return c[i] + u0*lam[0] + u1*lam[1] + ct*kt

    def onto(self, phi, n):
        u0, u1, ct, c = phi
        g = n
        for x in (u0, u1, ct) + tuple(c):
            g = gcd(g, x)
        return g == 1

    def colour_column(self, phi, n):
        """phi read on the named generators (+ on t)."""
        col = {name: self.ev(phi, g) % n for name, g in self.gens.items()}
        if self.with_time:
            col['t'] = phi[2] % n
        return col


# ------------------------------------------------------------------ normaliser
def gl2z(b):
    return [((a, bb), (c, d))
            for a, bb, c, d in itertools.product(range(-b, b+1), repeat=4)
            if a*d - bb*c in (1, -1)]


def conj(G, A, e):
    """A g A^{-1} for A = (K, w, ell, sgn):
       A(x,t) = (Kx + w, sgn*t + ell.x).
       Conjugate: M' = K M K^-1, v' = K v + (I - M') w, tau' = sgn*(tau) + ell.v
       (valid only when M^T ell = ell for all M in the point group)."""
    K, w, ell, sgn = A
    M, v, tau = e
    Ki = minv(K)
    Mn = mm(mm(K, M), Ki)
    Kv = mv(K, v)
    dw = (w[0]-mv(Mn, w)[0], w[1]-mv(Mn, w)[1])
    vn = (Kv[0]+dw[0], Kv[1]+dw[1])
    taun = sgn*tau + ell[0]*v[0] + ell[1]*v[1]
    return (Mn, vn, taun)


def normaliser(G, D=12, box=2, allow_mirror=True, allow_time_flip=False,
               proper3=False, ellbox=2):
    """Affine maps A with A G A^{-1} = G.  Returns a list of A tuples."""
    opset = set(G.ops)
    mats = G.mats
    ells = [(0, 0)]
    if G.with_time:
        ells = [l for l in itertools.product(range(-ellbox, ellbox+1), repeat=2)
                if all(tuple(mv(mT(M), l)) == tuple(l) for M in mats)]
    sgns = [1, -1] if (allow_time_flip or proper3) and G.with_time else [1]
    out = []
    for K in gl2z(box):
        dK = K[0][0]*K[1][1]-K[0][1]*K[1][0]
        Ki = minv(K)
        if sorted({mm(mm(K, M), Ki) for M in mats}) != sorted(mats):
            continue
        for sgn in sgns:
            if proper3 and dK*sgn != 1:
                continue
            if not proper3:
                if not allow_mirror and dK != 1:
                    continue
                if not allow_time_flip and sgn != 1:
                    continue
            for wi, wj in itertools.product(range(D), repeat=2):
                w = (F(wi, D), F(wj, D))
                for ell in ells:
                    A = (K, w, ell, sgn)
                    good = True
                    for e in G.ops:
                        Mn, vn, taun = conj(G, A, e)
                        key = (Mn, (vn[0] % 1, vn[1] % 1),
                               (taun % 1) if G.with_time else F(0))
                        if key not in opset:
                            good = False
                            break
                    if good:
                        out.append(A)
    return out


def act(G, A, phi, n):
    """(phi . A)(g) = phi(A g A^{-1})."""
    u = []
    for lam in ((F(1), F(0)), (F(0), F(1))):
        u.append(G.ev(phi, conj(G, A, (I2, lam, F(0)))) % n)
    ct = (G.ev(phi, conj(G, A, (I2, (F(0), F(0)), F(1)))) % n) if G.with_time else 0
    c = tuple(G.ev(phi, conj(G, A, e)) % n for e in G.ops)
    return (u[0], u[1], ct, c)


def precompute(G, A):
    """Integer data of the action of A on Hom(G, Z_n), independent of n.

    Returns (lat, tsgn, ops) where
      lat[j]  = (lam, kt)  for the image of the j-th lattice generator
      tsgn    = the time carry of the image of t
      ops[i]  = (coset, lam, kt)  for the image of op_i.
    """
    K, w, ell, sgn = A
    lat = []
    for lam in ((F(1), F(0)), (F(0), F(1))):
        i, l2, kt = G.reduce(conj(G, A, (I2, lam, F(0))))
        assert i == G.id_i
        lat.append((l2, kt))
    tsgn = sgn if G.with_time else 0
    ops = [G.reduce(conj(G, A, e)) for e in G.ops]
    return (tuple(lat), tsgn, tuple(ops))


def act_pre(pre, phi, n):
    lat, tsgn, ops = pre
    u0, u1, ct, c = phi
    nu = []
    for (lam, kt) in lat:
        nu.append((u0*lam[0] + u1*lam[1] + ct*kt) % n)
    nct = (ct*tsgn) % n
    nc = tuple((c[i] + u0*lam[0] + u1*lam[1] + ct*kt) % n
               for (i, lam, kt) in ops)
    return (nu[0], nu[1], nct, nc)


def unit_act(phi, k, n):
    u0, u1, ct, c = phi
    return ((u0*k) % n, (u1*k) % n, (ct*k) % n, tuple((x*k) % n for x in c))


def action_set(G, As):
    """Deduplicated precomputed actions of a list of normaliser elements."""
    return sorted({precompute(G, A) for A in As})


def orbits(G, phis, n, As, units=True, pres=None):
    """Union-find orbits of `phis` under the maps `As` and unit relabellings."""
    if pres is None:
        pres = action_set(G, As)
    lst = sorted(set(phis))
    pos = {p: i for i, p in enumerate(lst)}
    par = list(range(len(lst)))

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    def uni(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            par[ra] = rb

    ks = [k for k in range(1, n) if gcd(k, n) == 1] if units else []
    for p in lst:
        for pre in pres:
            q = act_pre(pre, p, n)
            if q in pos:
                uni(pos[p], pos[q])
        for k in ks:
            q = unit_act(p, k, n)
            if q in pos:
                uni(pos[p], pos[q])
    reps = {}
    for p in lst:
        reps.setdefault(find(pos[p]), []).append(p)
    return [sorted(v) for v in reps.values()]


# ------------------------------------------------------------------- loading
_DATA = None


def load():
    global _DATA
    if _DATA is None:
        _DATA = json.load(open(JSON))
    return _DATA


def entries():
    return {g['id']: g for g in load()['groups']}


REF = {'p1': 'g1', 'p2': 'g5', 'pm': 'g10', 'pg': 'g11', 'cm': 'g8',
       'pmm': 'g54', 'pmg': 'g56', 'pgg': 'g58', 'cmm': 'g68', 'p4': 'g94',
       'p4m': 'g128', 'p4g': 'g132', 'p3': 'g224', 'p3m1': 'g230',
       'p31m': 'g232', 'p6': 'g243', 'p6m': 'g268'}
