"""Homomorphisms G -> Z_n, enumerated from the presentation and transported
to the geometric model so that the affine normaliser can act on them.

For a film group G with parent Gamma = <g_1..g_m | r_1..r_k>:
    G = < ghat_1..ghat_m, t | t central, r_j(ghat) = t^{k_j} >
so Hom(G, Z_n) = { (c_1..c_m, c_t) in Z_n^{m+1} : sum_i e_{j,i} c_i = k_j c_t }.
Setting the time aside (c_t and all k_j dropped) gives Hom(Gamma, Z_n).
"""
from fractions import Fraction as F
import itertools
import cx_geom as X
import cx_pres as P

I2 = X.I2


def bfs_words(G, targets, lim=4, maxlen=14):
    """Words in the named generators for each element of `targets`."""
    want = set(targets)
    found = {}
    start = (I2, (F(0), F(0)), F(0))
    seen = {start: ()}
    frontier = [start]
    if start in want:
        found[start] = ()
    steps = [(name, +1) for name in G.gen_order] + \
            [(name, -1) for name in G.gen_order]
    for _ in range(maxlen):
        if len(found) == len(want):
            break
        nxt = []
        for e in frontier:
            for name, s in steps:
                g = G.gens[name] if s > 0 else G.inv(G.gens[name])
                h = G.mul(e, g)
                M, v, tau = h
                if not (-lim <= v[0] <= lim and -lim <= v[1] <= lim
                        and -lim <= tau <= lim):
                    continue
                if h in seen:
                    continue
                seen[h] = seen[e] + ((name, s),)
                nxt.append(h)
                if h in want:
                    found[h] = seen[h]
        frontier = nxt
    missing = want - set(found)
    if missing:
        raise RuntimeError('no word for %r in %s' % (sorted(missing)[:2], G.id))
    return found


class HomSpace:
    def __init__(self, entry, with_time=True):
        self.G = X.Group(entry, with_time=with_time)
        G = self.G
        self.fam = entry['family']
        self.gens = list(P.GENS[self.fam])
        assert set(self.gens) == set(G.gens)
        self.E = P.expmat(self.fam)
        f = {g: F(0) for g in self.gens}
        for ng in entry['namedGenerators']:
            f[ng['name']] = F(ng['timeShift']) if with_time else F(0)
        self.f = f
        self.k = [sum(self.E[j][i]*f[g] for i, g in enumerate(self.gens))
                  for j in range(len(self.E))]
        assert all(x.denominator == 1 for x in self.k)
        self.k = [int(x) for x in self.k]
        # words for the coset reps and for the two lattice generators
        tx = (I2, (F(1), F(0)), F(0))
        ty = (I2, (F(0), F(1)), F(0))
        tgts = list(G.ops) + [tx, ty]
        self.w = bfs_words(G, tgts)
        self.tx, self.ty = tx, ty

    def val(self, col, word):
        """Sum of colour values along a word; `col` maps generator -> Z."""
        return sum(col[name]*s for name, s in word)

    def phi(self, cvec, ct, n):
        """Geometric (u0,u1,ct,c[ops]) from generator values."""
        col = {g: cvec[i] for i, g in enumerate(self.gens)}
        u0 = self.val(col, self.w[self.tx]) % n
        u1 = self.val(col, self.w[self.ty]) % n
        c = tuple(self.val(col, self.w[o]) % n for o in self.G.ops)
        return (u0, u1, ct % n, c)

    def solutions(self, n, ct_choices=None):
        """All (cvec, ct) with sum_i e_{j,i} c_i = k_j ct  (mod n)."""
        m = len(self.gens)
        cts = range(n) if self.G.with_time else [0]
        if ct_choices is not None:
            cts = [x for x in cts if x in ct_choices]
        out = []
        for ct in cts:
            for cvec in itertools.product(range(n), repeat=m):
                ok = True
                for j, row in enumerate(self.E):
                    if (sum(e*ci for e, ci in zip(row, cvec)) - self.k[j]*ct) % n:
                        ok = False
                        break
                if ok:
                    out.append((cvec, ct))
        return out

    def onto(self, cvec, ct, n):
        g = n
        for x in tuple(cvec) + (ct,):
            g = X.gcd(g, x)
        return g == 1
