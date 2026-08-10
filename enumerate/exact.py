"""Exact integer linear algebra: Smith normal form with transforms,
solving linear congruences, and finite abelian group quotients.

All matrices are lists of lists of Python ints (arbitrary precision).
"""

from fractions import Fraction


def mat_mul(A, B):
    n, k, m = len(A), len(B), len(B[0])
    assert len(A[0]) == k
    return [[sum(A[i][p] * B[p][j] for p in range(k)) for j in range(m)] for i in range(n)]


def mat_identity(n):
    return [[1 if i == j else 0 for j in range(n)] for i in range(n)]


def mat_copy(A):
    return [row[:] for row in A]


def smith_normal_form(A):
    """Return (D, U, V) with U*A*V = D, U,V unimodular, D in Smith normal form.

    D is diagonal (rectangular), diagonal entries d1 | d2 | ... >= 0.
    """
    A = mat_copy(A)
    n = len(A)
    m = len(A[0]) if n else 0
    U = mat_identity(n)
    V = mat_identity(m)

    def swap_rows(M, i, j):
        M[i], M[j] = M[j], M[i]

    def swap_cols(M, i, j):
        for row in M:
            row[i], row[j] = row[j], row[i]

    def add_row(M, i, j, c):  # row_i += c*row_j
        M[i] = [a + c * b for a, b in zip(M[i], M[j])]

    def add_col(M, i, j, c):  # col_i += c*col_j
        for row in M:
            row[i] += c * row[j]

    t = 0
    while t < min(n, m):
        # find pivot: nonzero entry with minimal abs value in A[t:, t:]
        piv = None
        best = None
        for i in range(t, n):
            for j in range(t, m):
                a = A[i][j]
                if a != 0 and (best is None or abs(a) < best):
                    best = abs(a)
                    piv = (i, j)
        if piv is None:
            break
        i, j = piv
        if i != t:
            swap_rows(A, t, i); swap_rows(U, t, i)
        if j != t:
            swap_cols(A, t, j); swap_cols(V, t, j)
        # eliminate
        dirty = False
        for i in range(t + 1, n):
            if A[i][t] != 0:
                q = A[i][t] // A[t][t]
                add_row(A, i, t, -q); add_row(U, i, t, -q)
                if A[i][t] != 0:
                    dirty = True
        for j in range(t + 1, m):
            if A[t][j] != 0:
                q = A[t][j] // A[t][t]
                add_col(A, j, t, -q); add_col(V, j, t, -q)
                if A[t][j] != 0:
                    dirty = True
        if dirty:
            continue  # re-pivot on smaller remainders
        # ensure divisibility d_t | all entries below-right
        ok = True
        for i in range(t + 1, n):
            for j in range(t + 1, m):
                if A[i][j] % A[t][t] != 0:
                    add_row(A, t, i, 1); add_row(U, t, i, 1)
                    ok = False
                    break
            if not ok:
                break
        if not ok:
            continue
        if A[t][t] < 0:
            A[t] = [-a for a in A[t]]
            U[t] = [-a for a in U[t]]
        t += 1
    return A, U, V


def solve_mod(A, b, N):
    """Solve A x = b (mod N) for integer vector x. Return one solution or None.

    A: n x m int matrix; b: length-n ints; N: modulus > 0.
    """
    n = len(A)
    m = len(A[0]) if n else 0
    D, U, V = smith_normal_form(A)
    # transform: U A V = D  =>  A x = b  <=>  D y = U b (mod N), x = V y
    Ub = [sum(U[i][k] * b[k] for k in range(n)) % N for i in range(n)]
    y = [0] * m
    from math import gcd
    for i in range(n):
        d = D[i][i] if i < min(n, m) else 0
        if i < m:
            if d == 0:
                if Ub[i] % N != 0 if i < n else False:
                    return None
            else:
                g = gcd(d, N)
                if Ub[i] % g != 0:
                    return None
                # solve d*y = Ub[i] mod N
                dd, NN = d // g, N // g
                rhs = (Ub[i] // g) % NN
                y[i] = (rhs * pow(dd, -1, NN)) % NN if NN > 1 else 0
        else:
            if Ub[i] % N != 0:
                return None
    x = [sum(V[i][k] * y[k] for k in range(m)) % N for i in range(m)]
    # verify
    for i in range(n):
        if (sum(A[i][k] * x[k] for k in range(m)) - b[i]) % N != 0:
            return None
    return x


def kernel_mod(A, N):
    """Generators of {x in (Z/N)^m : A x = 0 mod N} as list of vectors."""
    n = len(A)
    m = len(A[0]) if n else 0
    if n == 0:
        return [[N and 1 or 0] * 0] and []  # handled below
    D, U, V = smith_normal_form(A)
    from math import gcd
    gens = []
    r = min(n, m)
    for i in range(m):
        d = D[i][i] if i < r else 0
        if d == 0:
            step = 1
        else:
            step = N // gcd(d, N)
        if step % N != 0 or N == 1:
            # generator: V * (step * e_i)
            g = [(V[j][i] * step) % N for j in range(m)]
            if any(g):
                gens.append(g)
    return gens


def subgroup_coset_reps(gens_sub, gens_big, N, dim):
    """Coset representatives of subgroup <gens_sub> inside group <gens_big> <= (Z/N)^dim.

    Both given by generator lists. Returns list of coset rep vectors (as tuples).
    Brute-force BFS suitable for small groups.
    """
    def close(gens):
        seen = {tuple([0] * dim)}
        frontier = [tuple([0] * dim)]
        while frontier:
            new = []
            for v in frontier:
                for g in gens:
                    w = tuple((a + b) % N for a, b in zip(v, g))
                    if w not in seen:
                        seen.add(w)
                        new.append(w)
            frontier = new
        return seen

    sub = close(gens_sub)
    big = close(gens_big)
    reps = []
    covered = set()
    for v in sorted(big):
        if v in covered:
            continue
        reps.append(v)
        for s in sub:
            covered.add(tuple((a + b) % N for a, b in zip(v, s)))
    return reps


def solve_int(A, b):
    """One integer solution of A x = b over Z, or None."""
    n = len(A)
    m = len(A[0]) if n else 0
    D, U, V = smith_normal_form([row[:] for row in A])
    Ub = [sum(U[i][k] * b[k] for k in range(n)) for i in range(n)]
    y = [0] * m
    r = min(n, m)
    for i in range(n):
        d = D[i][i] if i < r else 0
        if d:
            if Ub[i] % d != 0:
                return None
            y[i] = Ub[i] // d
        else:
            if Ub[i] != 0:
                return None
    return [sum(V[i][k] * y[k] for k in range(m)) for i in range(m)]


def kernel_int(A):
    """Integer nullspace basis of A x = 0 (complete lattice of solutions)."""
    n = len(A)
    m = len(A[0]) if n else 0
    D, U, V = smith_normal_form([row[:] for row in A])
    out = []
    r = min(n, m)
    for j in range(m):
        d = D[j][j] if j < r else 0
        if d == 0:
            out.append([V[i][j] for i in range(m)])
    return out


def lll_reduce(basis, delta=Fraction(3, 4)):
    """LLL lattice basis reduction (integer vectors, exact arithmetic)."""
    b = [list(map(int, v)) for v in basis if any(v)]
    if not b:
        return []
    n = len(b)

    def dot(u, v):
        return sum(x * y for x, y in zip(u, v))

    def gso():
        bstar = []
        mu = [[Fraction(0)] * n for _ in range(n)]
        for i in range(n):
            bi = [Fraction(x) for x in b[i]]
            for j in range(i):
                denom = dot(bstar[j], bstar[j])
                mu[i][j] = Fraction(dot([Fraction(x) for x in b[i]], bstar[j]),
                                    1) / denom if denom else Fraction(0)
                bi = [x - mu[i][j] * y for x, y in zip(bi, bstar[j])]
            bstar.append(bi)
        return bstar, mu

    bstar, mu = gso()
    k = 1
    guard = 0
    while k < n and guard < 10000:
        guard += 1
        for j in range(k - 1, -1, -1):
            if abs(mu[k][j]) > Fraction(1, 2):
                q = int(mu[k][j] + Fraction(1, 2)) if mu[k][j] > 0 else \
                    -int(-mu[k][j] + Fraction(1, 2))
                b[k] = [x - q * y for x, y in zip(b[k], b[j])]
                bstar, mu = gso()
        d1 = dot(bstar[k], bstar[k])
        d0 = dot(bstar[k - 1], bstar[k - 1])
        if d0 and Fraction(d1) >= (delta - mu[k][k - 1] ** 2) * d0:
            k += 1
        else:
            b[k], b[k - 1] = b[k - 1], b[k]
            bstar, mu = gso()
            k = max(k - 1, 1)
    return b


def size_reduce_against(x, basis):
    """Reduce vector x modulo the lattice spanned by basis (Babai rounding)."""
    if not basis:
        return x
    x = list(map(int, x))

    def dot(u, v):
        return sum(a * b for a, b in zip(u, v))

    for _ in range(3):
        for bv in basis:
            nb = dot(bv, bv)
            if nb == 0:
                continue
            q = round(Fraction(dot(x, bv), nb))
            if q:
                x = [a - int(q) * c for a, c in zip(x, bv)]
    return x


# ---------------------------------------------------------------- self-tests
if __name__ == "__main__":
    import random
    random.seed(0)
    for trial in range(200):
        n = random.randint(1, 4)
        m = random.randint(1, 4)
        A = [[random.randint(-9, 9) for _ in range(m)] for _ in range(n)]
        D, U, V = smith_normal_form(A)
        assert mat_mul(mat_mul(U, A), V) == D, (A, D)
        # check diagonal & divisibility
        for i in range(n):
            for j in range(m):
                if i != j:
                    assert D[i][j] == 0
        diag = [D[i][i] for i in range(min(n, m))]
        for a, b in zip(diag, diag[1:]):
            if a != 0:
                assert b % a == 0
            else:
                assert b == 0
        assert all(d >= 0 for d in diag)
    # solve_mod round-trip tests
    for trial in range(300):
        n = random.randint(1, 3)
        m = random.randint(1, 4)
        N = random.choice([2, 3, 4, 6, 12, 24])
        A = [[random.randint(-6, 6) for _ in range(m)] for _ in range(n)]
        x0 = [random.randint(0, N - 1) for _ in range(m)]
        b = [sum(A[i][k] * x0[k] for k in range(m)) % N for i in range(n)]
        x = solve_mod(A, b, N)
        assert x is not None
    # kernel_mod: verify all generators are solutions and count matches brute force
    for trial in range(100):
        n = random.randint(1, 2)
        m = random.randint(1, 3)
        N = random.choice([2, 3, 4, 6])
        A = [[random.randint(-4, 4) for _ in range(m)] for _ in range(n)]
        gens = kernel_mod(A, N)
        for g in gens:
            for i in range(n):
                assert sum(A[i][k] * g[k] for k in range(m)) % N == 0
        # brute force count
        import itertools
        cnt = 0
        for x in itertools.product(range(N), repeat=m):
            if all(sum(A[i][k] * x[k] for k in range(m)) % N == 0 for i in range(n)):
                cnt += 1
        # closure of gens must equal kernel set
        seen = {tuple([0] * m)}
        frontier = [tuple([0] * m)]
        while frontier:
            new = []
            for v in frontier:
                for g in gens:
                    w = tuple((a + b) % N for a, b in zip(v, g))
                    if w not in seen:
                        seen.add(w); new.append(w)
            frontier = new
        assert len(seen) == cnt, (A, N, len(seen), cnt)
    print("exact.py: all self-tests passed")
