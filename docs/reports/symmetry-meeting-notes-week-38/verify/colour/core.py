"""Cyclic colourings of wallpaper groups and of the 68 forward film groups.

Model
-----
A film group G < E(2) x R (no time reversal) is stored in a lattice basis as
  * the spatial lattice  Lambda = Z^2, with zero time phase (site convention),
  * the pure time translation  t = (I, 0, 1),
  * a finite set Q of coset representatives  q = (M, v, tau),  one per class of
    G / (Lambda + Z t).   |Q| = len(ops) in the site's JSON.

A homomorphism  phi : G -> Z_n  is determined by
  u   in (Z_n)^2   :  phi(I, lambda, 0) = <u, lambda>
  c_t in  Z_n      :  phi(t)
  c   : Q -> Z_n   :  phi(q)
subject to
  M^T u = u for every M occurring in Q          (phi is constant on conjugacy)
  c_q + c_q' = c_{qq'} + <u, xi_s> + c_t xi_t   (xi = the Lambda x Z carry)
and then  phi(M, v, tau) = c_q + <u, v - v_q> + c_t (tau - tau_q).

Setting all tau = 0 and dropping t gives the plane wallpaper group Gamma.
"""
from fractions import Fraction as F
import itertools, json, collections

import os
JSON = os.environ.get('WALLPAPER_GROUPS_JSON') or os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', '..', '..', '..', 'scott-gray', 'wallpaper-groups.json')


def frac(x, maxden=60):
    return F(x).limit_denominator(maxden)


def matmul(A, B):
    return ((A[0][0]*B[0][0]+A[0][1]*B[1][0], A[0][0]*B[0][1]+A[0][1]*B[1][1]),
            (A[1][0]*B[0][0]+A[1][1]*B[1][0], A[1][0]*B[0][1]+A[1][1]*B[1][1]))


def matvec(A, v):
    return (A[0][0]*v[0]+A[0][1]*v[1], A[1][0]*v[0]+A[1][1]*v[1])


def matinv(A):
    d = A[0][0]*A[1][1]-A[0][1]*A[1][0]
    assert d in (1, -1), d
    return ((A[1][1]//d if isinstance(A[1][1], int) and d in (1, -1) else A[1][1]/d, -A[0][1]/d),
            (-A[1][0]/d, A[0][0]/d))


def matinv_int(A):
    d = A[0][0]*A[1][1]-A[0][1]*A[1][0]
    assert d in (1, -1)
    return ((A[1][1]//d, -A[0][1]//d), (-A[1][0]//d, A[0][0]//d))


def transpose(A):
    return ((A[0][0], A[1][0]), (A[0][1], A[1][1]))


class Film:
    """A film group (or, with time dropped, a wallpaper group)."""

    def __init__(self, ops, gens=None, with_time=True, name=''):
        self.name = name
        self.with_time = with_time
        self.ops = []
        for o in ops:
            M = tuple(tuple(int(round(x)) for x in row) for row in o['M'])
            v = (frac(o['v'][0]), frac(o['v'][1]))
            tau = frac(o.get('tau', 0)) if with_time else F(0)
            self.ops.append((M, (v[0] % 1, v[1] % 1), tau % 1))
        self.index = {(M, v, tau): i for i, (M, v, tau) in enumerate(self.ops)}
        assert len(self.index) == len(self.ops), name
        self.mats = sorted({M for M, _, _ in self.ops})
        self.gens = gens or []
        self.identity = self.index[(((1, 0), (0, 1)), (F(0), F(0)), F(0))]
        self._mul_table()

    # ---- group arithmetic on representatives -------------------------------
    def reduce(self, M, v, tau):
        key = (M, (v[0] % 1, v[1] % 1), tau % 1)
        i = self.index[key]
        Mq, vq, tq = self.ops[i]
        return i, (v[0]-vq[0], v[1]-vq[1]), tau - tq   # carry in Lambda x Z

    def compose(self, a, b):
        Ma, va, ta = self.ops[a]
        Mb, vb, tb = self.ops[b]
        M = matmul(Ma, Mb)
        w = matvec(Ma, vb)
        v = (w[0]+va[0], w[1]+va[1])
        tau = ta+tb
        return self.reduce(M, v, tau)

    def _mul_table(self):
        n = len(self.ops)
        self.mul = [[None]*n for _ in range(n)]
        for a in range(n):
            for b in range(n):
                k, lam, kt = self.compose(a, b)
                assert lam[0].denominator == 1 and lam[1].denominator == 1, (self.name, lam)
                assert kt.denominator == 1, (self.name, kt)
                self.mul[a][b] = (k, (int(lam[0]), int(lam[1])), int(kt))

    # ---- homomorphisms to Z_n ----------------------------------------------
    def homs(self, n, ct_allowed=None):
        """All phi : G -> Z_n, as tuples (u0,u1,ct,c[...])."""
        # u must be invariant: M^T u = u  for every M
        us = []
        for u in itertools.product(range(n), repeat=2):
            if all(tuple(x % n for x in matvec(transpose(M), u)) == u for M in self.mats):
                us.append(u)
        out = []
        N = len(self.ops)
        cts = range(n) if self.with_time else [0]
        if ct_allowed is not None:
            cts = [x for x in cts if x in ct_allowed]
        # generators of Q under multiplication: use full brute force via BFS on
        # a generating subset found greedily.
        gensQ = self._gen_subset()
        for u in us:
            for ct in cts:
                for vals in itertools.product(range(n), repeat=len(gensQ)):
                    c = [None]*N
                    c[self.identity] = 0
                    ok = True
                    for g, val in zip(gensQ, vals):
                        if c[g] is not None and c[g] != val % n:
                            ok = False
                            break
                        c[g] = val % n
                    if not ok:
                        continue
                    # BFS closure
                    changed = True
                    while changed and ok:
                        changed = False
                        for a in range(N):
                            if c[a] is None:
                                continue
                            for g in gensQ:
                                k, lam, kt = self.mul[a][g]
                                val = (c[a] + c[g] - (u[0]*lam[0]+u[1]*lam[1]) - ct*kt) % n
                                if c[k] is None:
                                    c[k] = val
                                    changed = True
                                elif c[k] != val:
                                    ok = False
                                    break
                            if not ok:
                                break
                    if not ok or any(x is None for x in c):
                        continue
                    # full consistency check
                    good = True
                    for a in range(N):
                        for b in range(N):
                            k, lam, kt = self.mul[a][b]
                            if (c[a]+c[b]-(u[0]*lam[0]+u[1]*lam[1])-ct*kt - c[k]) % n:
                                good = False
                                break
                        if not good:
                            break
                    if good:
                        out.append((u[0], u[1], ct, tuple(c)))
        return sorted(set(out))

    def _gen_subset(self):
        N = len(self.ops)
        have = {self.identity}
        gens = []
        for a in range(N):
            if a in have:
                continue
            gens.append(a)
            frontier = set(have) | {a}
            while True:
                new = set()
                for x in frontier:
                    for g in gens:
                        new.add(self.mul[x][g][0])
                        new.add(self.mul[g][x][0])
                if new <= frontier:
                    break
                frontier |= new
            have = frontier
            if len(have) == N:
                break
        return gens

    def eval(self, phi, M, v, tau=F(0)):
        u0, u1, ct, c = phi
        i, lam, kt = self.reduce(M, v, tau)
        return (c[i] + u0*lam[0] + u1*lam[1] + ct*kt)

    def image_order(self, phi, n):
        vals = {self.eval(phi, ((1, 0), (0, 1)), (F(1), F(0))) % n,
                self.eval(phi, ((1, 0), (0, 1)), (F(0), F(1))) % n}
        for i in range(len(self.ops)):
            M, v, t = self.ops[i]
            vals.add(self.eval(phi, M, v, t) % n)
        if self.with_time:
            vals.add(phi[2] % n)
        g = n
        for x in vals:
            g = gcd(g, x)
        return n//g


def gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def load():
    data = json.load(open(JSON))
    by_id = {g['id']: g for g in data['groups']}
    return data, by_id
