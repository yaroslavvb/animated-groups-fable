"""Affine normaliser action on colourings."""
from fractions import Fraction as F
import itertools
from core import matmul, matvec, matinv_int, transpose, gcd


def aff_mul(a, b):
    """(M1,v1) o (M2,v2) : x -> M1(M2 x + v2) + v1."""
    M1, v1 = a
    M2, v2 = b
    w = matvec(M1, v2)
    return (matmul(M1, M2), (w[0]+v1[0], w[1]+v1[1]))


def aff_inv(a):
    M, v = a
    Mi = matinv_int(M) if all(isinstance(x, int) for row in M for x in row) else None
    w = matvec(Mi, v)
    return (Mi, (-w[0], -w[1]))


def gl2z(bound=3):
    out = []
    for a, b, c, d in itertools.product(range(-bound, bound+1), repeat=4):
        if a*d-b*c in (1, -1):
            out.append(((a, b), (c, d)))
    return out


def normaliser(film, denom=12, bound=3, proper_only=False, with_shear=False,
               shear_bound=1):
    """Affine maps A=(K,w[,ell]) with A G A^-1 = G.  Returns list of callables
    represented as tuples used by `act`."""
    opset = {(M, v, t) for (M, v, t) in film.ops}
    mats = film.mats
    cands = []
    for K in gl2z(bound):
        if proper_only and (K[0][0]*K[1][1]-K[0][1]*K[1][0]) != 1:
            continue
        Ki = matinv_int(K)
        # point group must be preserved
        if sorted({matmul(matmul(K, M), Ki) for M in mats}) != sorted(mats):
            continue
        cands.append((K, Ki))
    shears = [(0, 0)]
    if with_shear:
        shears = [l for l in itertools.product(range(-shear_bound, shear_bound+1), repeat=2)]
    out = []
    for (K, Ki) in cands:
        for wi, wj in itertools.product(range(denom), repeat=2):
            w = (F(wi, denom), F(wj, denom))
            for ell in shears:
                # ell must be point-group invariant:  M^T ell = ell
                if any(tuple(matvec(transpose(M), ell)) != tuple(ell) for M in mats):
                    continue
                A = ((K, w), ell)
                if _normalises(film, A, opset):
                    out.append(A)
    return out


def _conj(film, A, g):
    """A^{-1} g A  where g=(M,v,tau) and A=((K,w),ell)."""
    (K, w), ell = A
    M, v, tau = g
    Ki = matinv_int(K)
    a = (K, w)
    ai = aff_inv(a)
    Mn, vn = aff_mul(aff_mul(ai, (M, v)), a)
    # time part:  A^{-1} shifts t by +ell.x ; g adds tau ; A shifts back.
    # (A^{-1} g A)(x,t) = (Mn x + vn, t + tau + ell.(M K x + M w + v) - ell.(K x + w))
    #                   = (..., t + tau + ell.((M-I)(Kx+w) + v))
    # ell is point-group invariant so ell.((M-I)y)=0 for all y.
    taun = tau + ell[0]*v[0] + ell[1]*v[1]
    return Mn, vn, taun


def _normalises(film, A, opset):
    for g in film.ops:
        Mn, vn, taun = _conj(film, A, g)
        key = (Mn, (vn[0] % 1, vn[1] % 1), taun % 1)
        if key not in opset:
            return False
    return True


def act(film, A, phi, n):
    """phi^A (g) = phi(A^{-1} g A)."""
    (K, w), ell = A
    I = ((1, 0), (0, 1))
    new = []
    for lam in ((F(1), F(0)), (F(0), F(1))):
        Mn, vn, taun = _conj(film, A, (I, lam, F(0)))
        new.append(film.eval(phi, Mn, vn, taun) % n)
    u = (new[0], new[1])
    if film.with_time:
        Mn, vn, taun = _conj(film, A, (I, (F(0), F(0)), F(1)))
        ct = film.eval(phi, Mn, vn, taun) % n
    else:
        ct = 0
    c = []
    for g in film.ops:
        Mn, vn, taun = _conj(film, A, g)
        c.append(film.eval(phi, Mn, vn, taun) % n)
    return (u[0], u[1], ct, tuple(c))


def unit_act(film, phi, k, n):
    u0, u1, ct, c = phi
    return ((u0*k) % n, (u1*k) % n, (ct*k) % n, tuple((x*k) % n for x in c))


def orbits(film, phis, n, As, units=True):
    phis = set(phis)
    us = [k for k in range(1, n) if gcd(k, n) == 1] if units else []
    seen = set()
    reps = []
    for p in sorted(phis):
        if p in seen:
            continue
        orb = {p}
        frontier = [p]
        while frontier:
            q = frontier.pop()
            nxt = [act(film, A, q, n) for A in As] + [unit_act(film, q, k, n) for k in us]
            for r in nxt:
                if r not in orb:
                    orb.add(r)
                    frontier.append(r)
        seen |= orb
        reps.append((p, len(orb & phis)))
    return reps
