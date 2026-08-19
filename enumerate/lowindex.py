#!/usr/bin/env python3
"""
Low-index subgroups (Sims' coset-table backtracking with first-in-class test)
for finitely presented groups, pure Python (3.7 compatible).

Conventions: right action, coset table T[i][c] = i^c, words act left to right
(AB = A then B), cosets are right cosets Hg, coset 0 = H.
"""
import sys, time, json

sys.setrecursionlimit(10000)


class FPGroup(object):
    def __init__(self, gens, involutory, relators):
        """gens: list of generator names; involutory: set of names that are involutions
        (their column is self-inverse; the relator g^2 is then implicit);
        relators: list of words, each a list of (name, exponent+-1)."""
        self.gens = gens
        self.cols = []      # column index -> (name, sign)
        self.colof = {}     # (name, sign) -> column
        for g in gens:
            if g in involutory:
                self.colof[(g, 1)] = self.colof[(g, -1)] = len(self.cols)
                self.cols.append((g, 1))
            else:
                self.colof[(g, 1)] = len(self.cols)
                self.cols.append((g, 1))
                self.colof[(g, -1)] = len(self.cols)
                self.cols.append((g, -1))
        self.ncols = len(self.cols)
        self.inv = [self.colof[(nm, -s)] for (nm, s) in self.cols]
        # relators as column words; include cyclic conjugates of R and R^-1
        rel_by_col = [[] for _ in range(self.ncols)]
        seen = [set() for _ in range(self.ncols)]
        for R in relators:
            w = [self.colof[(nm, s)] for (nm, s) in R]
            winv = [self.inv[c] for c in reversed(w)]
            for word in (w, winv):
                L = len(word)
                for k in range(L):
                    conj = tuple(word[k:] + word[:k])
                    if conj not in seen[conj[0]]:
                        seen[conj[0]].add(conj)
                        rel_by_col[conj[0]].append(conj)
        self.rel_by_col = rel_by_col


def define_and_close(table, alpha, c, beta, inv, rel_by_col):
    """Set table[alpha][c] = beta (and inverse), then process all deductions.
    Return False on a coincidence/contradiction."""
    table[alpha][c] = beta
    table[beta][inv[c]] = alpha
    stack = [(alpha, c)]
    while stack:
        a, cc = stack.pop()
        for w in rel_by_col[cc]:
            L = len(w)
            f = a
            i = 0
            while i < L:
                nxt = table[f][w[i]]
                if nxt < 0:
                    break
                f = nxt
                i += 1
            if i == L:
                if f != a:
                    return False
                continue
            b = a
            j = L
            while j > i:
                nxt = table[b][inv[w[j - 1]]]
                if nxt < 0:
                    break
                b = nxt
                j -= 1
            if j == i:
                # forward reached f, backward reached b, both at the same slot -> f must equal b
                if f != b:
                    return False
            elif j == i + 1:
                x = w[i]
                # table[f][x] undefined and table[b][inv x] undefined: deduce
                table[f][x] = b
                table[b][inv[x]] = f
                stack.append((f, x))
    return True


def first_in_class(table, ncols):
    """Sims' first-in-class test on a (partial) standardised coset table."""
    n = len(table)
    for beta in range(1, n):
        mu = [-1] * n
        mu[beta] = 0
        nu = [beta]
        cnt = 1
        gamma = 0
        decided = False
        while gamma < len(nu):
            row_old = table[nu[gamma]]
            row_cur = table[gamma]
            for c in range(ncols):
                d = row_old[c]
                if d < 0:
                    decided = True
                    break
                cur = row_cur[c]
                if cur < 0:
                    decided = True
                    break
                nd = mu[d]
                if nd < 0:
                    nd = cnt
                    mu[d] = cnt
                    nu.append(d)
                    cnt += 1
                if nd < cur:
                    return False
                if nd > cur:
                    decided = True
                    break
            if decided:
                break
            gamma += 1
    return True


def standard_table_from(table, beta, ncols):
    """Standardised table of the conjugate subgroup with base point beta (complete table)."""
    n = len(table)
    mu = [-1] * n
    mu[beta] = 0
    nu = [beta]
    out = []
    gamma = 0
    while gamma < len(nu):
        row_old = table[nu[gamma]]
        newrow = []
        for c in range(ncols):
            d = row_old[c]
            if mu[d] < 0:
                mu[d] = len(nu)
                nu.append(d)
            newrow.append(mu[d])
        out.append(tuple(newrow))
        gamma += 1
    return tuple(out)


def canonical_form(table, ncols):
    """Minimal standardised table over all base points (complete table)."""
    return min(standard_table_from(table, b, ncols) for b in range(len(table)))


def low_index_subgroups(G, N, callback, progress=None):
    """Enumerate one standardised coset table per conjugacy class of subgroups of index <= N."""
    ncols = G.ncols
    inv = G.inv
    rbc = G.rel_by_col
    counter = [0]

    def rec(table):
        counter[0] += 1
        if progress and counter[0] % progress == 0:
            sys.stderr.write("  nodes %d, current index %d\n" % (counter[0], len(table)))
        n = len(table)
        found = None
        for a in range(n):
            row = table[a]
            for c in range(ncols):
                if row[c] < 0:
                    found = (a, c)
                    break
            if found:
                break
        if found is None:
            callback(table)
            return
        a, c = found
        ic = inv[c]
        for b in range(n + 1):
            if b < n:
                if table[b][ic] >= 0:
                    continue
                t2 = [r[:] for r in table]
            else:
                if n >= N:
                    break
                t2 = [r[:] for r in table]
                t2.append([-1] * ncols)
            if define_and_close(t2, a, c, b, inv, rbc) and first_in_class(t2, ncols):
                rec(t2)

    rec([[-1] * ncols])
    return counter[0]


# ---------------------------------------------------------------- permutation groups
def perm_mul(p, q):
    """p then q."""
    return tuple(q[i] for i in p)


def perm_inv(p):
    r = [0] * len(p)
    for i, pi in enumerate(p):
        r[pi] = i
    return tuple(r)


def perm_group_order(gens):
    """Deterministic Schreier-Sims. gens: list of tuples (perms of range(n))."""
    if not gens:
        return 1
    n = len(gens[0])
    idp = tuple(range(n))
    gens = [g for g in gens if g != idp]
    if not gens:
        return 1
    base = []
    S = []
    trans = []

    def orbit_trans(i):
        b = base[i]
        T = {b: idp}
        q = [b]
        while q:
            p = q.pop()
            up = T[p]
            for s in S[i]:
                r = s[p]
                if r not in T:
                    T[r] = perm_mul(up, s)
                    q.append(r)
        trans[i] = T

    def add_gen(g, level_from):
        j = level_from
        while j < len(base) and g[base[j]] == base[j]:
            j += 1
        if j == len(base):
            for pt in range(n):
                if g[pt] != pt:
                    base.append(pt)
                    break
            S.append([])
            trans.append({})
        for i in range(level_from, j + 1):
            S[i].append(g)
        for i in range(level_from, j + 1):
            orbit_trans(i)
        return j

    def sift(g, i0):
        i = i0
        while i < len(base):
            p = g[base[i]]
            T = trans[i]
            if p not in T:
                return g, i
            g = perm_mul(g, perm_inv(T[p]))
            i += 1
        return g, i

    for g in gens:
        add_gen(g, 0)
    i = len(base) - 1
    while i >= 0:
        restart = False
        Ti = trans[i]
        for p in list(Ti.keys()):
            up = Ti[p]
            for s in S[i]:
                sg = perm_mul(perm_mul(up, s), perm_inv(Ti[s[p]]))
                if sg == idp:
                    continue
                h, j = sift(sg, i + 1)
                if h != idp:
                    add_gen(h, i + 1)
                    i = j
                    restart = True
                    break
            if restart:
                break
        if restart:
            continue
        i -= 1
    order = 1
    for T in trans:
        order *= len(T)
    return order


def cycles(p):
    n = len(p)
    seen = [False] * n
    out = []
    for i in range(n):
        if not seen[i]:
            L = 0
            j = i
            while not seen[j]:
                seen[j] = True
                j = p[j]
                L += 1
            out.append(L)
    return sorted(out)


# ---------------------------------------------------------------- orbifold of a subgroup of *pqr
def orbifold_of_reflection_table(A, B, C, orders=(2, 3, 7)):
    """A,B,C: permutations (tuples) of the k cosets given by the reflection generators a,b,c
    of *pqr with (ab)^p, (bc)^q, (ca)^r, orders=(p,q,r).  Returns a dict describing the
    quotient orbifold H\\H^2 (H the stabiliser of coset 0), incl. Conway symbol."""
    k = len(A)
    P = [A, B, C]
    nxt = [1, 2, 0]
    prv = [2, 0, 1]
    # 1. mirror edges
    mirror = set()
    for s in range(3):
        for i in range(k):
            if P[s][i] == i:
                mirror.add((i, s))
    # 2. colouring / orientability of underlying surface via glued edges
    col = [-1] * k
    col[0] = 0
    orientable = True
    stack = [0]
    while stack:
        i = stack.pop()
        for s in range(3):
            j = P[s][i]
            if j == i:
                continue
            if col[j] < 0:
                col[j] = 1 - col[i]
                stack.append(j)
            elif col[j] == col[i]:
                orientable = False
    # 3. vertices: orbits of <s, next(s)>
    V = 0
    cones = []
    corner_at = {}   # (s, orbit id) not needed; we recompute corners along the boundary walk
    for s in range(3):
        t = nxt[s]
        p = orders[s]
        seen = [False] * k
        for i in range(k):
            if seen[i]:
                continue
            orb = []
            st = [i]
            seen[i] = True
            while st:
                j = st.pop()
                orb.append(j)
                for g in (P[s], P[t]):
                    l = g[j]
                    if not seen[l]:
                        seen[l] = True
                        st.append(l)
            V += 1
            f = len(orb)
            has_mirror = any((j, s) in mirror or (j, t) in mirror for j in orb)
            if not has_mirror:
                m = (2 * p) // f
                assert (2 * p) % f == 0
                if m > 1:
                    cones.append(m)
            else:
                assert p % f == 0
    # 4. boundary walk
    visited = set()
    boundaries = []
    for (i0, s0) in sorted(mirror):
        if (i0, s0) in visited:
            continue
        # direction: head to vertex {s, next(s)} for colour 0, {s, prev(s)} for colour 1
        i, s = i0, s0
        t = nxt[s] if col[i] == 0 else prv[s]
        corners = []
        while True:
            visited.add((i, s))
            # fan around vertex {s,t} starting in triangle i (entered through mirror side s)
            p = orders[s] if nxt[s] == t else orders[t]
            j = i
            cross = t
            f = 1
            while P[cross][j] != j:
                j = P[cross][j]
                f += 1
                cross = s if cross == t else t
                assert f <= 2 * p
            m = p // f
            assert p % f == 0
            corners.append(m)
            # next boundary edge (j, cross); other endpoint {cross, u}
            r = cross
            u = 3 - s - t
            i, s, t = j, r, u
            if (i, s) == (i0, s0):
                break
            assert (i, s) not in visited
        boundaries.append(corners)
    b = len(boundaries)
    E = (3 * k + len(mirror)) // 2
    assert (3 * k + len(mirror)) % 2 == 0
    chi_surf = V - E + k
    if orientable:
        assert (2 - b - chi_surf) % 2 == 0
        genus = (2 - b - chi_surf) // 2
        crosscaps = 0
    else:
        genus = 0
        crosscaps = 2 - b - chi_surf
        assert crosscaps >= 1
    from fractions import Fraction
    chi_orb = Fraction(chi_surf)
    for m in cones:
        chi_orb -= Fraction(m - 1, m)
    for bd in boundaries:
        for m in bd:
            chi_orb -= Fraction(m - 1, 2 * m)
    cones.sort()
    sym = "o" * genus + "".join(str(m) for m in cones)
    for bd in boundaries:
        sym += "*" + "".join(str(m) for m in bd if m > 1)
    sym += "x" * crosscaps
    if sym == "":
        sym = "1"  # sphere (cannot happen here)
    return {
        "conway": sym,
        "orientable_surface": orientable,
        "genus": genus,
        "crosscaps": crosscaps,
        "cones": cones,
        "boundaries": [[m for m in bd if m > 1] for bd in boundaries],
        "n_boundaries": b,
        "chi_orb": str(chi_orb),
        "chi_orb_float": float(chi_orb),
        "n_mirror_edges": len(mirror),
    }


def orientation_preserving_reflection_table(A, B, C):
    """H <= 237 iff Schreier graph w.r.t. a,b,c is bipartite (all generators odd)."""
    k = len(A)
    col = [-1] * k
    col[0] = 0
    st = [0]
    while st:
        i = st.pop()
        for g in (A, B, C):
            j = g[i]
            if col[j] < 0:
                col[j] = 1 - col[i]
                st.append(j)
            elif col[j] == col[i]:
                return False
    return True


def lift_237_table_to_star237(X, Y):
    """Given perms x,y on k cosets of H<=237, return perms a,b,c on 2k cosets of H in *237.
    x = ab, y = bc, xy = ac.  Points (i,0)=H g_i, (i,1) = H g_i a."""
    k = len(X)
    Xi = perm_inv(X)
    XY = perm_mul(X, Y)
    XYi = perm_inv(XY)
    A = [0] * (2 * k)
    B = [0] * (2 * k)
    C = [0] * (2 * k)
    for i in range(k):
        A[2 * i] = 2 * i + 1
        A[2 * i + 1] = 2 * i
        B[2 * i] = 2 * Xi[i] + 1
        B[2 * i + 1] = 2 * X[i]
        C[2 * i] = 2 * XYi[i] + 1
        C[2 * i + 1] = 2 * XY[i]
    return tuple(A), tuple(B), tuple(C)


# ---------------------------------------------------------------- giant recognition
def is_primitive(gens, n):
    """Transitive group generated by gens on range(n): primitive?"""
    if n <= 2:
        return True
    for beta in range(1, n):
        parent = list(range(n))

        def find(u):
            while parent[u] != u:
                parent[u] = parent[parent[u]]
                u = parent[u]
            return u
        parent[beta] = 0
        queue = [(0, beta)]
        while queue:
            u, v = queue.pop()
            for g in gens:
                a, b = find(g[u]), find(g[v])
                if a != b:
                    parent[max(a, b)] = min(a, b)
                    queue.append((g[u], g[v]))
        roots = set(find(u) for u in range(n))
        if len(roots) > 1:
            return False
    return True


def _primes_upto(n):
    return [p for p in range(2, n + 1) if all(p % q for q in range(2, int(p ** 0.5) + 1))]


def perm_order_and_cycles(p):
    n = len(p)
    seen = [False] * n
    lens = []
    for i in range(n):
        if not seen[i]:
            L = 0
            j = i
            while not seen[j]:
                seen[j] = True
                j = p[j]
                L += 1
            lens.append(L)
    return lens


def is_alternating_or_symmetric(gens, n, tries=400, seed=1):
    """Jordan: primitive + contains a p-cycle for a prime p <= n-3  =>  A_n or S_n.
    Returns True if proven giant, False if not proven (may still be giant if unlucky, but for
    n>=8 the search essentially always succeeds)."""
    import random
    if n < 8:
        return False
    if not is_primitive(gens, n):
        return False
    rnd = random.Random(seed)
    primes = [p for p in _primes_upto(n - 3) if p > 1]
    g = tuple(range(n))
    for _ in range(tries):
        # random word (product replacement lite)
        for _ in range(rnd.randint(1, 3)):
            g = perm_mul(g, rnd.choice(gens))
        lens = perm_order_and_cycles(g)
        for p in primes:
            if lens.count(p) == 1 and all(L == p or L % p != 0 for L in lens):
                return True
    return False


def all_even(gens):
    for g in gens:
        lens = perm_order_and_cycles(g)
        if sum(L - 1 for L in lens) % 2:
            return False
    return True


def image_order(gens, n):
    """Order of <gens> <= S_n, using giant recognition when applicable."""
    from math import factorial
    if is_alternating_or_symmetric(gens, n):
        return factorial(n) // 2 if all_even(gens) else factorial(n)
    return perm_group_order(gens)


def name_group(order, n, is_giant_even, is_giant_full):
    from math import factorial
    if order == factorial(n) // 2:
        return "A%d" % n
    if order == factorial(n):
        return "S%d" % n
    names = {1: "1", 2: "C2", 168: "PSL(2,7)", 336: "PGL(2,7)", 504: "PSL(2,8)", 1008: "PGL(2,8)=PSL(2,8):3",
             1092: "PSL(2,13)", 2184: "PGL(2,13)", 1344: "2^3:PSL(2,7)=AGL(3,2)", 2688: "2^3:PGL(2,7)?",
             9828: "PSL(2,27)", 12180: "PSL(2,29)", 34440: "PSL(2,41)", 39732: "PSL(2,43)"}
    return names.get(order, "order %d" % order)


def factorint(n):
    out = []
    d = 2
    while d * d <= n:
        while n % d == 0:
            out.append(d)
            n //= d
        d += 1
    if n > 1:
        out.append(n)
    from collections import Counter
    c = Counter(out)
    return "*".join(("%d^%d" % (p, e) if e > 1 else "%d" % p) for p, e in sorted(c.items()))
