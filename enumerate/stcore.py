"""Core machinery for classifying crystallographic groups of Galilean spacetime
(d spatial dimensions + optionally 1 time dimension), in the Zassenhaus cocycle
formulation.

A candidate group is specified by:
  - P: a finite "point group": list of ops (M, s) with M a d x d integer matrix
       (in lattice coordinates) and s = +-1 the time sign (s absent/+1 if no time).
  - L: a lattice in Q^n (n = d [+1 if time]), containing Z^d x {0} and (0,..,0,1),
       given by a rational basis matrix B (columns) — constructed from centerings.
  - sigma: a cocycle P -> Q^n / L  (the system of fractional translations),
       satisfying sigma(gh) = sigma(g) + g.sigma(h) mod L.
The group is { x -> rho(g) x + sigma(g) + l : g in P, l in L } where
rho(g) = diag-block(M, s) acts on spacetime (spatial part, time part).

Equivalence: conjugation by invertible affine maps N respecting the Galilean
structure: N linear part must be block-triangular [[A, v], [0, c]] (space maps
to space plus a boost v times time; time maps to time only), together with
arbitrary spacetime origin shifts (= coboundaries, quotiented in H^1).
Optionally restricted: c > 0 (no time flip), det A > 0 (no space flip).

Classes for fixed (P, L) = H^1(P, R^n / L) modulo the stabilizer moves;
(P, L) pairs ("arithmetic classes") are themselves deduped by the same
conjugation search.
"""

from fractions import Fraction
from itertools import product as iproduct
from math import gcd

from exact import smith_normal_form, kernel_mod


# ---------------------------------------------------------------- rational mat
def rmat_mul(A, B):
    n, k, m = len(A), len(B), len(B[0])
    return [[sum(A[i][p] * B[p][j] for p in range(k)) for j in range(m)] for i in range(n)]


def rmat_vec(A, v):
    return [sum(A[i][j] * v[j] for j in range(len(v))) for i in range(len(A))]


def rmat_inv(A):
    """Exact inverse of a square rational matrix (Gauss-Jordan)."""
    n = len(A)
    M = [[Fraction(A[i][j]) for j in range(n)] + [Fraction(1 if i == j else 0) for j in range(n)]
         for i in range(n)]
    for col in range(n):
        piv = next((r for r in range(col, n) if M[r][col] != 0), None)
        if piv is None:
            raise ValueError("singular")
        M[col], M[piv] = M[piv], M[col]
        pv = M[col][col]
        M[col] = [x / pv for x in M[col]]
        for r in range(n):
            if r != col and M[r][col] != 0:
                f = M[r][col]
                M[r] = [a - f * b for a, b in zip(M[r], M[col])]
    return [row[n:] for row in M]


def rmat_eq(A, B):
    return all(Fraction(A[i][j]) == Fraction(B[i][j]) for i in range(len(A)) for j in range(len(A[0])))


def is_integer_mat(A):
    return all(Fraction(x).denominator == 1 for row in A for x in row)


def int_mat(A):
    return tuple(tuple(int(Fraction(x)) for x in row) for row in A)


def det3(A):
    A = [[Fraction(x) for x in row] for row in A]
    n = len(A)
    if n == 1:
        return A[0][0]
    if n == 2:
        return A[0][0] * A[1][1] - A[0][1] * A[1][0]
    if n == 3:
        return (A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
                - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
                + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]))
    raise ValueError


# ---------------------------------------------------------------- point ops
def op_mul(a, b):
    """(M,s) composition; M's are tuples of tuples of ints."""
    Ma, sa = a
    Mb, sb = b
    M = tuple(tuple(sum(Ma[i][k] * Mb[k][j] for k in range(len(Mb))) for j in range(len(Mb[0])))
              for i in range(len(Ma)))
    return (M, sa * sb)


def op_identity(d):
    return (tuple(tuple(1 if i == j else 0 for j in range(d)) for i in range(d)), 1)


def group_closure(gens, d):
    """Close a set of (M,s) ops under multiplication. Returns sorted list."""
    seen = {op_identity(d)}
    frontier = list(seen)
    while frontier:
        new = []
        for a in frontier:
            for g in gens:
                c = op_mul(a, g)
                if c not in seen:
                    seen.add(c)
                    new.append(c)
        frontier = new
        if len(seen) > 100:
            raise ValueError("point group too large — not crystallographic?")
    return sorted(seen)


def rho(op, has_time):
    """Full n x n rational matrix of a point op."""
    M, s = op
    d = len(M)
    n = d + (1 if has_time else 0)
    R = [[Fraction(0)] * n for _ in range(n)]
    for i in range(d):
        for j in range(d):
            R[i][j] = Fraction(M[i][j])
    if has_time:
        R[d][d] = Fraction(s)
    return R


# ---------------------------------------------------------------- lattices
class Lattice:
    """Lattice = Z^d (+ Z e_t if time) + integer spans of centering vectors."""

    def __init__(self, d, has_time, centerings=()):
        self.d = d
        self.has_time = has_time
        self.n = d + (1 if has_time else 0)
        self.centerings = tuple(tuple(Fraction(x) for x in c) for c in centerings)
        self.B = self._basis()
        self.Binv = rmat_inv(self.B)
        # finite set of centering residues mod Z^n
        self.residues = self._residues()

    def _basis(self):
        """Rational basis matrix (columns) via HNF of generators scaled to ints."""
        n = self.n
        gens = [[Fraction(1 if i == j else 0) for i in range(n)] for j in range(n)]
        gens += [list(c) for c in self.centerings]
        den = 1
        for g in gens:
            for x in g:
                den = den * Fraction(x).denominator // gcd(den, Fraction(x).denominator)
        A = [[int(Fraction(x) * den) for x in g] for g in gens]  # rows = generators
        # column-style HNF via SNF-ish: we only need SOME basis: use HNF over rows.
        B = self._row_hnf(A)
        assert len(B) == n, "centering generators do not span rank n"
        # HNF rows are basis vectors; return matrix with basis vectors as COLUMNS
        return [[Fraction(B[j][i], den) for j in range(n)] for i in range(n)]

    @staticmethod
    def _row_hnf(A):
        """Row Hermite normal form (returns list of nonzero rows) over Z."""
        A = [row[:] for row in A]
        rows = len(A)
        cols = len(A[0])
        r = 0
        for c in range(cols):
            piv = None
            for i in range(r, rows):
                if A[i][c] != 0:
                    piv = i
                    break
            if piv is None:
                continue
            A[r], A[piv] = A[piv], A[r]
            # reduce all other rows below
            changed = True
            while changed:
                changed = False
                for i in range(r + 1, rows):
                    if A[i][c] != 0:
                        q = A[i][c] // A[r][c]
                        A[i] = [a - q * b for a, b in zip(A[i], A[r])]
                        if A[i][c] != 0:
                            A[r], A[i] = A[i], A[r]
                            changed = True
            if A[r][c] < 0:
                A[r] = [-x for x in A[r]]
            r += 1
        return [row for row in A[:r]]

    def _residues(self):
        seen = {tuple(Fraction(0) for _ in range(self.n))}
        frontier = list(seen)
        while frontier:
            new = []
            for v in frontier:
                for c in self.centerings:
                    w = tuple((a + b) % 1 for a, b in zip(v, c))
                    if w not in seen:
                        seen.add(w)
                        new.append(w)
            frontier = new
        return seen

    def time_den(self):
        """q such that the time-projection of L is (1/q) Z."""
        assert self.has_time
        q = 1
        for r in self.residues:
            d = Fraction(r[self.n - 1]).denominator
            q = q * d // gcd(q, d)
        return q

    def contains(self, v):
        y = rmat_vec(self.Binv, [Fraction(x) for x in v])
        return all(Fraction(x).denominator == 1 for x in y)

    def key(self):
        return (self.d, self.has_time, tuple(sorted(self.residues)))


def preserves_lattice(op, lat):
    R = rho(op, lat.has_time)
    for c in lat.residues:
        if not lat.contains(rmat_vec(R, list(c))):
            return False
    return True


# ---------------------------------------------------------------- cocycles/H^1
class ArithClass:
    """A (P, L) pair with precomputed multiplication structure."""

    def __init__(self, P, lat):
        self.P = list(P)  # list of (M, s)
        self.lat = lat
        self.n = lat.n
        self.index = {g: i for i, g in enumerate(self.P)}
        self.mult = [[self.index[op_mul(a, b)] for b in self.P] for a in self.P]
        # integer matrices of ops in lattice basis
        self.A = []
        for g in self.P:
            Ag = rmat_mul(rmat_mul(lat.Binv, rho(g, lat.has_time)), lat.B)
            assert is_integer_mat(Ag), "point group does not preserve lattice"
            self.A.append(int_mat(Ag))
        self.A_index = {A: i for i, A in enumerate(self.A)}

    def _generator_indices(self):
        """Greedy generating set of P (indices)."""
        d = self.lat.d
        chosen = []
        gen_ops = []
        closure = group_closure(gen_ops, d) if gen_ops else [op_identity(d)]
        for i, g in enumerate(self.P):
            if g in closure:
                continue
            chosen.append(i)
            gen_ops.append(g)
            closure = group_closure(gen_ops, d)
            if len(closure) == len(self.P):
                break
        return chosen

    def h1_with_reps(self):
        """Compute H^1(P, R^n/L). Returns (D2, class_reps) where class_reps is a
        list of cocycles, each a list over P-index of coordinate vectors in
        (Z_{D2})^n  (coords k = D2 * B^{-1} sigma)."""
        P, n = self.P, self.n
        m = len(P)
        D1 = m
        for x in (2, 3, 4, 12):
            D1 = D1 * x // gcd(D1, x)
        # elementary divisor factor for coboundary comparison
        stacked = []
        for i, g in enumerate(P):
            Ai = self.A[i]
            for r in range(n):
                stacked.append([(1 if r == c else 0) - Ai[r][c] for c in range(n)])
        Dm, _, _ = smith_normal_form([row[:] for row in stacked])
        ell = 1
        for i in range(min(len(stacked), n)):
            di = Dm[i][i]
            if di:
                ell = ell * di // gcd(ell, di)
        D2 = D1 * ell

        # --- cocycle solution group mod D1, unknowns: k_g for each g (n coords each)
        # constraints over (g, h) with g restricted to a generating set suffice:
        # sigma(g1 g2 h) expands correctly by induction once it holds for gens.
        gen_idx = self._generator_indices()
        N_unk = m * n
        rows = []
        # sigma(identity) = 0 (from the (1,1) cocycle condition)
        id_idx = self.index[op_identity(self.lat.d)]
        for r in range(n):
            row = [0] * N_unk
            row[id_idx * n + r] = 1
            rows.append(row)
        for a in gen_idx:
            Aa = self.A[a]
            for b in range(m):
                ab = self.mult[a][b]
                for r in range(n):
                    row = [0] * N_unk
                    row[ab * n + r] += 1
                    row[a * n + r] -= 1
                    for c in range(n):
                        row[b * n + c] -= Aa[r][c]
                    rows.append(row)
        sol_gens_D1 = kernel_mod(rows, D1) if rows else []
        scale = D2 // D1
        sol_gens = [[x * scale for x in g] for g in sol_gens_D1]

        # --- coboundary generators mod D2: delta_b(g) = b - A_g b, b in (1/D2)L
        cb_gens = []
        for j in range(n):
            g_vec = [0] * N_unk
            for a in range(m):
                Aa = self.A[a]
                for r in range(n):
                    g_vec[a * n + r] = ((1 if r == j else 0) - Aa[r][j]) % D2
            cb_gens.append(g_vec)

        # --- classifier for Z^{N}/span(cb_gens + D2 I)
        Y_cols = [g[:] for g in cb_gens]
        for i in range(N_unk):
            e = [0] * N_unk
            e[i] = D2
            Y_cols.append(e)
        Y = [[Y_cols[c][r] for c in range(len(Y_cols))] for r in range(N_unk)]
        DY, UY, _ = smith_normal_form([row[:] for row in Y])
        diag = [DY[i][i] for i in range(N_unk)]

        def classify(vec):
            out = []
            for i in range(N_unk):
                s = sum(UY[i][k] * vec[k] for k in range(N_unk))
                out.append(s % diag[i] if diag[i] else s)
            return tuple(out)

        # --- enumerate image of solution group in the quotient (small closure)
        zero = tuple([0] * N_unk)
        rep_of = {classify([0] * N_unk): [0] * N_unk}
        frontier = [[0] * N_unk]
        while frontier:
            new = []
            for v in frontier:
                for g in sol_gens:
                    w = [(a + b) % D2 for a, b in zip(v, g)]
                    c = classify(w)
                    if c not in rep_of:
                        rep_of[c] = w
                        new.append(w)
            frontier = new
            if len(rep_of) > 20000:
                raise RuntimeError("H^1 unexpectedly large")
        self._classify = classify
        self.D2 = D2
        return D2, list(rep_of.values())

    def classify_cocycle(self, vec):
        return self._classify(vec)


# ---------------------------------------------------------------- moves
def galilean_form(N, d, has_time):
    """Check N (n x n rational) is [[A, v], [0, c]]; return (A, v, c) or None."""
    n = d + (1 if has_time else 0)
    if not has_time:
        return (N, None, None)
    for j in range(d):
        if Fraction(N[d][j]) != 0:
            return None
    c = Fraction(N[d][d])
    if c == 0:
        return None
    A = [[Fraction(N[i][j]) for j in range(d)] for i in range(d)]
    v = [Fraction(N[i][d]) for i in range(d)]
    return (A, v, c)


def gl_candidates(n, bound=1):
    """All n x n integer matrices with entries in [-bound, bound], det = +-1."""
    rng = range(-bound, bound + 1)
    out = []
    for entries in iproduct(rng, repeat=n * n):
        K = [list(entries[i * n:(i + 1) * n]) for i in range(n)]
        dt = det3(K)
        if dt in (1, -1):
            out.append(K)
    return out


_GL_CACHE = {}


def gl_cached(n, bound=1):
    key = (n, bound)
    if key not in _GL_CACHE:
        _GL_CACHE[key] = gl_candidates(n, bound)
    return _GL_CACHE[key]


def conj_op_by(Nmat, Nmat_inv, op, d, has_time):
    """Conjugate point op by rational matrix N: returns (M', s') or None if the
    result is not an integer point op of the same shape."""
    R = rho(op, has_time)
    Rp = rmat_mul(rmat_mul(Nmat, R), Nmat_inv)
    n = d + (1 if has_time else 0)
    # must be block form with integer spatial part and s' = s
    M2 = [[Rp[i][j] for j in range(d)] for i in range(d)]
    if not is_integer_mat(M2):
        return None
    if has_time:
        for j in range(d):
            if Fraction(Rp[d][j]) != 0 or Fraction(Rp[j][d]) != 0:
                return None
        s2 = Fraction(Rp[d][d])
        if s2 not in (1, -1):
            return None
        return (int_mat(M2), int(s2))
    return (int_mat(M2), 1)


def int_inverse_unimodular(K):
    """Inverse of an integer matrix with det = +-1 (n <= 3), integer output."""
    n = len(K)
    dt = int(det3(K))
    assert dt in (1, -1)
    if n == 1:
        return ((K[0][0],),)  # +-1 is its own inverse
    if n == 2:
        a, b = K[0]
        c, d = K[1]
        return tuple(tuple(x * dt for x in row) for row in ((d, -b), (-c, a)))
    # n == 3: adjugate
    def cof(i, j):
        r = [K[x] for x in range(3) if x != i]
        m = [[r[0][y] for y in range(3) if y != j], [r[1][y] for y in range(3) if y != j]]
        s = m[0][0] * m[1][1] - m[0][1] * m[1][0]
        return s if (i + j) % 2 == 0 else -s
    adj = [[cof(j, i) for j in range(3)] for i in range(3)]
    return tuple(tuple(x * dt for x in row) for row in adj)


def imat_mul(A, B):
    n = len(A)
    return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(n)) for j in range(n))
                 for i in range(n))


def _orientation_ok(mode, detK, c_sign, has_time):
    """mode: 'any' | 'proper3' (3D orientation preserved: det3(N)=+1) |
    'no_time_flip' (c>0) | 'no_flips' (c>0 and detA>0).
    sign(det3 N) = sign(detK) since our HNF bases have positive determinant;
    sign(det A) = sign(detK) * c_sign (A = spatial block)."""
    if not has_time:
        if mode == "any":
            return True
        return detK > 0  # 'proper3'/'no_flips' degenerate to properness
    if mode == "any":
        return True
    if mode == "proper3":
        return detK > 0
    if mode == "no_time_flip":
        return c_sign > 0
    if mode == "no_flips":
        return c_sign > 0 and detK * c_sign > 0
    raise ValueError(mode)


def find_conjugations(ac_src, ac_dst, bound=2, orientation="any", max_found=None):
    """Find conjugations mapping (P_src, L_src) -> (P_dst, L_dst) respecting the
    Galilean block structure, as integer unimodular matrices K in lattice
    coordinates (the standard-coordinates map is N = B_dst K B_src^{-1}).
    Returns list of (K, perm), perm[i] = index in dst of the conjugated op i.

    The Galilean condition (bottom row of N = [0..0, c]) holds iff
    (t-row of B_dst) . K = c * (t-row of B_src), enforced column-wise; |c| is
    forced by the ratio of time denominators. All op checks are integer
    arithmetic in lattice coordinates: K A_g K^{-1} must be some A_h of dst.
    """
    src, dst = ac_src, ac_dst
    has_time = src.lat.has_time
    n = src.n
    out = []

    def try_K(K, c_sign):
        detK = int(det3(K))
        if detK not in (1, -1):
            return None
        if not _orientation_ok(orientation, detK, c_sign, has_time):
            return None
        Kinv = int_inverse_unimodular(K)
        perm = []
        for Ag in src.A:
            C = imat_mul(imat_mul(K, Ag), Kinv)
            j = dst.A_index.get(C)
            if j is None:
                return None
            perm.append(j)
        if len(set(perm)) != len(perm):
            return None
        return (tuple(tuple(row) for row in K), perm)

    rng = range(-bound, bound + 1)

    if not has_time:
        for K in gl_cached(n, bound):
            r = try_K(K, 1)
            if r and r not in out:
                out.append(r)
                if max_found and len(out) >= max_found:
                    return out
        return out

    # --- time case: prune by column time-components
    q_src, q_dst = src.lat.time_den(), dst.lat.time_den()
    cabs = Fraction(q_src, q_dst)
    all_cols = [tuple(col) for col in iproduct(rng, repeat=n)]
    trow_d = [Fraction(dst.lat.B[n - 1][j]) for j in range(n)]
    trow_s = [Fraction(src.lat.B[n - 1][j]) for j in range(n)]
    for c in (cabs, -cabs):
        c_sign = 1 if c > 0 else -1
        col_options = []
        feasible = True
        for i in range(n):
            target = c * trow_s[i]
            opts = [col for col in all_cols
                    if sum(t * k for t, k in zip(trow_d, col)) == target]
            if not opts:
                feasible = False
                break
            col_options.append(opts)
        if not feasible:
            continue
        for cols in iproduct(*col_options):
            K = tuple(tuple(cols[j][i] for j in range(n)) for i in range(n))
            r = try_K(K, c_sign)
            if r:
                out.append(r)
                if max_found and len(out) >= max_found:
                    return out
    return out


def apply_move(ac, K, perm, cocycle_vec):
    """Apply within-class move to a cocycle coordinate vector: sigma'(g') = N sigma(g),
    which in lattice coordinates is multiplication by the integer matrix K."""
    n = ac.n
    D2 = ac.D2
    out = [0] * len(cocycle_vec)
    m = len(ac.P)
    for i in range(m):
        k = cocycle_vec[i * n:(i + 1) * n]
        kp = [sum(K[r][c] * k[c] for c in range(n)) % D2 for r in range(n)]
        j = perm[i]
        out[j * n:(j + 1) * n] = kp
    return out


def reduce_classes(ac, class_reps, moves):
    """Orbit-reduce cocycle class reps under a list of (N, perm) moves.
    Returns list of orbit representative vectors."""
    canon = {}
    for vec in class_reps:
        canon[ac.classify_cocycle(vec)] = vec
    orbits = []
    seen = set()
    for cls, vec in sorted(canon.items()):
        if cls in seen:
            continue
        # BFS orbit
        orbit = {cls}
        frontier = [vec]
        while frontier:
            new = []
            for v in frontier:
                for (K, perm) in moves:
                    w = apply_move(ac, K, perm, v)
                    cw = ac.classify_cocycle(w)
                    if cw not in orbit:
                        orbit.add(cw)
                        new.append(w)
            frontier = new
        seen |= orbit
        orbits.append(vec)
    return orbits


def cocycle_sigma(ac, vec):
    """Convert coordinate vector back to sigma: list over P of rational vectors."""
    n, D2 = ac.n, ac.D2
    out = []
    for i in range(len(ac.P)):
        k = vec[i * n:(i + 1) * n]
        y = [Fraction(x, D2) for x in k]
        out.append(rmat_vec(ac.lat.B, y))
    return out
