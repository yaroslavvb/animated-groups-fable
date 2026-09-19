#!/usr/bin/env python3
"""Extra reaction-diffusion / amplitude equations for the three-colour pages, and the
two colour constructions (Gyre and Trefoil) measured directly on a saved field.

This module *extends* ../equations/rdlab.py; it never edits it.  Importing it registers
the new right-hand sides into ``rdlab.MODELS`` so that ``rdlab.flow``, ``rdlab.timestep``,
``rdlab.audit``, ``rdlab.rpo_polish`` and ``../equations/admit.py`` all work unchanged for
them.  Everything here uses the same conventions as the rest of the site:

  * fields are ``(2, N, N)`` arrays ``q[c, y, x]`` on lattice coordinates, ``x`` fastest;
  * movies are ``(M, 2, N, N)``;
  * lattice coordinate 1 is the array column ``x``, lattice coordinate 2 is the row ``y``;
  * the film relation is ``q(Mx + v, t + tau T) = q(x, t)``;
  * the hexagonal ("triangular") lattice has ``a1 = (1, 0)``, ``a2 = (-1/2, -sqrt3/2)``
    and the six-neighbour Laplacian of ``rdlab._laplacian``.

The colour constructions, in lattice coordinates, with ``R`` the 120-degree turn
``(u, v) -> (-v, u - v)`` (matrix ``[[0,-1],[1,-1]]`` acting on the column vector ``(x, y)``):

  GYRE     colour(x, t) = argmax_k U(g^k x, t + k T/3),  g = R about a point p.
           On the node mesh every admissible ``g`` is ``x -> R x + w (mod N)`` for an
           integer vector ``w``; the turn centre is ``p = (I - R)^{-1} w / N``.
           ``I + R + R^2 = 0`` so ``g^3 = id`` for every ``w``: the relation
           ``colour(g x, t + T/3) = colour(x, t) - 1`` is exact for any T-periodic field.

  TREFOIL  colour(x, t) = argmax_k U(x + k b, t),  b = (1/3, 2/3).
           ``R b = b`` (mod L) so translation by ``b`` is a purely spatial 3-cycle of the
           colours.  If the field also satisfies ``U(h x, t + T/2) = U(x, t)`` for an
           involution ``h`` with ``h b = -b`` (mod L) -- the half-turn ``-I``, or one of the
           three ``p31m``/``p6m`` mirrors that reverse ``b`` -- the colouring additionally
           satisfies ``colour(h x, t + T/2) = (1 2) colour(x, t)`` and the colour group is
           ``S3`` with the transpositions entangled.
"""
import hashlib, json, math, os, sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
EQUATIONS = HERE.parent / 'equations'
WALLPAPER = HERE.parent / 'wallpaper'
ROOT = HERE.parent.parent                      # docs/scott-gray
for _p in (str(EQUATIONS), str(WALLPAPER)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import rdlab                                   # noqa: E402
from rdlab import (MODELS, Character, flow, timestep, load_groups, apply_op,      # noqa: E402
                   space_time_project, rpo_polish, estimate_period, hopf_eigen,
                   seed_from_complex, twisted_residual, LIMITS, _laplacian)

GATE = 'colour-offline-v1'
GROUPS_PATH = ROOT / 'wallpaper-groups.json'

# --------------------------------------------------------------------------- new models
#
# Every right-hand side has the signature rhs(q, p, lattice, h) -> (2, N, N) and is
# registered in MODELS with (bounds, diffusion, dtmax) so that rdlab.timestep works.


def rhs_schnakenberg(q, p, lattice, h):
    """Schnakenberg / Gierer-Meinhardt-type activator-substrate glycolysis model.

        u_t = Du lap u + a - u + u^2 v
        v_t = Dv lap v + b     - u^2 v

    Uniform state u* = a + b, v* = b/(a+b)^2; det J = (a+b)^2 > 0 always and
    tr J = -1 + 2b/(a+b) - (a+b)^2, so the Hopf locus is s - s^3 = 2a with s = a + b.
    """
    u, v = q
    L = _laplacian(q, lattice, h)
    r = u * u * v
    return np.stack([p['Du'] * L[0] + p['a'] - u + r,
                     p['Dv'] * L[1] + p['b'] - r])


def rhs_selkov(q, p, lattice, h):
    """Selkov glycolytic oscillator.

        u_t = Du lap u - u + a v + u^2 v
        v_t = Dv lap v + b - a v - u^2 v

    Uniform state u* = b, v* = b/(a + b^2); det J = a + b^2 > 0, and with s = a + b^2
    the trace is -1 + 2b^2/s - s, so the Hopf locus is 2b^2 = s(1 + s).
    """
    u, v = q
    L = _laplacian(q, lattice, h)
    r = u * u * v
    return np.stack([p['Du'] * L[0] - u + p['a'] * v + r,
                     p['Dv'] * L[1] + p['b'] - p['a'] * v - r])


def rhs_gierer_meinhardt(q, p, lattice, h):
    """Gierer-Meinhardt activator-inhibitor with basal production and saturation.

        u_t = Du lap u + sigma + u^2 / (v (1 + kappa u^2)) - mu u
        v_t = Dv lap v + u^2 - nu v

    With kappa = 0 and mu = 1 the uniform state is u* = nu + sigma, v* = u*^2 / nu,
    det J = nu > 0 and tr J = 2 nu/(nu + sigma) - 1 - nu, so the Hopf locus is
    nu^2 - (1 - sigma) nu + sigma = 0 and the interval between its two roots is unstable.
    """
    u, v = q
    L = _laplacian(q, lattice, h)
    den = np.maximum(v, 1e-9) * (1.0 + p.get('kappa', 0.0) * u * u)
    return np.stack([p['Du'] * L[0] + p.get('sigma', 0.0) + u * u / den - p.get('mu', 1.0) * u,
                     p['Dv'] * L[1] + u * u - p['nu'] * v])


def rhs_lengyel_epstein(q, p, lattice, h):
    """Lengyel-Epstein model of the CIMA chlorite-iodide-malonic-acid reaction.

        u_t = Du lap u + a - u - 4 u v / (1 + u^2)
        v_t = Dv lap v + b (u - u v / (1 + u^2))

    Uniform state u* = a/5, v* = 1 + u*^2; tr J = (3 u*^2 - 5 - b u*)/(1 + u*^2) and
    det J = 5 b u*/(1 + u*^2) > 0, so the Hopf locus is b = (3 u*^2 - 5)/u*.
    """
    u, v = q
    L = _laplacian(q, lattice, h)
    s = 1.0 + u * u
    return np.stack([p['Du'] * L[0] + p['a'] - u - 4.0 * u * v / s,
                     p['Dv'] * L[1] + p['b'] * (u - u * v / s)])


def rhs_oregonator(q, p, lattice, h):
    """Two-variable Oregonator (Belousov-Zhabotinsky).

        u_t = Du lap u + (u (1 - u) - f v (u - q0)/(u + q0)) / eps
        v_t = Dv lap v + u - v

    Oscillatory for 1/2 < f < 1 + sqrt(2) at small eps.
    """
    u, v = q
    L = _laplacian(q, lattice, h)
    q0 = p['q0']
    return np.stack([p['Du'] * L[0] + (u * (1 - u) - p['f'] * v * (u - q0) / (u + q0 + 1e-12)) / p['eps'],
                     p['Dv'] * L[1] + u - v])


def rhs_rps(q, p, lattice, h):
    """Cyclic three-species (rock-paper-scissors) replicator-diffusion, written on two
    channels because the equal-diffusion replicator conserves u0 + u1 + u2 = 1 exactly.

        u2   = 1 - u0 - u1
        f_i  = e u_{i+1} - d u_{i+2}
        phi  = sum_i u_i f_i
        u_i' = D lap u_i + u_i (f_i - phi) + mu (1/3 - u_i)

    The mutation term keeps the sum conserved (sum of mu(1/3 - u_i) = 0) and keeps the
    orbit away from the extinction boundary.  The right-hand side is equivariant under the
    cyclic relabelling sigma: (u0, u1, u2) -> (u1, u2, u0), so the equation itself carries
    the three-colour symmetry the pages are about.
    """
    u0, u1 = q
    u2 = 1.0 - u0 - u1
    e, d, mu = p['e'], p['d'], p.get('mu', 0.0)
    f0 = e * u1 - d * u2
    f1 = e * u2 - d * u0
    f2 = e * u0 - d * u1
    phi = u0 * f0 + u1 * f1 + u2 * f2
    L = _laplacian(q, lattice, h)
    D = p['D']
    return np.stack([D * L[0] + u0 * (f0 - phi) + mu * (1.0 / 3.0 - u0),
                     D * L[1] + u1 * (f1 - phi) + mu * (1.0 / 3.0 - u1)])


def rhs_lambda_omega(q, p, lattice, h):
    """lambda-omega reaction-diffusion system with real diffusion.

        A_t = D lap A + (lambda(m) + i omega(m)) A,   m = |A|^2,  A = u + i v
        lambda(m) = l0 - l1 m + l2 m^2
        omega(m)  = w0 + w1 m + w2 m^2

    The global phase rotation A -> e^{i phi} A is an exact symmetry, so relative
    equilibria A = B(x) e^{i Omega t} are exactly time-periodic.  (CGL with alpha = 0 is
    the special case l0 = l1 = 1, l2 = 0, w0 = 0, w1 = -beta; l2 and w2 give the
    genuinely different quintic members of the family.)
    """
    u, v = q
    L = _laplacian(q, lattice, h)
    m = u * u + v * v
    lam = p['l0'] - p['l1'] * m + p.get('l2', 0.0) * m * m
    om = p.get('w0', 0.0) + p.get('w1', 0.0) * m + p.get('w2', 0.0) * m * m
    D = p['D']
    return np.stack([D * L[0] + lam * u - om * v,
                     D * L[1] + lam * v + om * u])


def rhs_cgl_quintic(q, p, lattice, h):
    """Cubic-quintic complex Ginzburg-Landau, in the sign convention of rdlab's CGL.

        A_t = A + (1 + i alpha) D lap A - (1 - i beta) |A|^2 A - (gamma - i delta) |A|^4 A

    Phase symmetric, so relative equilibria are exact periodic orbits.
    """
    u, v = q
    L = _laplacian(q, lattice, h)
    a, b, D = p['alpha'], p['beta'], p['D']
    g, dl = p.get('gamma', 0.0), p.get('delta', 0.0)
    m = u * u + v * v
    lu, lv = D * L[0], D * L[1]
    return np.stack([u + (lu - a * lv) - m * (u + b * v) - m * m * (g * u + dl * v),
                     v + (lv + a * lu) - m * (v - b * u) - m * m * (g * v - dl * u)])


NEW_MODELS = {
    'schnakenberg':      dict(rhs=rhs_schnakenberg,      bounds=(-1.0, 30.0),  diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.02),
    'selkov':            dict(rhs=rhs_selkov,            bounds=(-1.0, 30.0),  diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.02),
    'gierer-meinhardt':  dict(rhs=rhs_gierer_meinhardt,  bounds=(-1.0, 200.0), diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.01),
    'lengyel-epstein':   dict(rhs=rhs_lengyel_epstein,   bounds=(-1.0, 60.0),  diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.01),
    'oregonator':        dict(rhs=rhs_oregonator,        bounds=(-0.2, 2.0),   diffusion=lambda p: max(p['Du'], p['Dv']), dtmax=0.002),
    'rps':               dict(rhs=rhs_rps,               bounds=(-0.2, 1.2),   diffusion=lambda p: p['D'],                dtmax=0.05),
    'lambda-omega':      dict(rhs=rhs_lambda_omega,      bounds=(-4.0, 4.0),   diffusion=lambda p: p['D'],                dtmax=0.05),
    'cgl-quintic':       dict(rhs=rhs_cgl_quintic,       bounds=(-4.0, 4.0),   diffusion=lambda p: p['D'] * math.hypot(1, p['alpha']), dtmax=0.05),
}
MODELS.update(NEW_MODELS)

# The parameter keys admit.py must find finite in every saved record.
MODEL_PARAMS = {
    'ginzburg-landau':  ['alpha', 'beta', 'D'],
    'brusselator':      ['a', 'b', 'Du', 'Dv'],
    'gray-scott':       ['F', 'k', 'Du', 'Dv'],
    'fitzhugh-nagumo':  ['Du', 'Dv', 'eps', 'a', 'b', 'I'],
    'barkley':          ['Du', 'Dv', 'eps', 'a', 'b'],
    'schnakenberg':     ['a', 'b', 'Du', 'Dv'],
    'selkov':           ['a', 'b', 'Du', 'Dv'],
    'gierer-meinhardt': ['nu', 'Du', 'Dv'],
    'lengyel-epstein':  ['a', 'b', 'Du', 'Dv'],
    'oregonator':       ['f', 'q0', 'eps', 'Du', 'Dv'],
    'rps':              ['e', 'd', 'D'],
    'lambda-omega':     ['l0', 'l1', 'D'],
    'cgl-quintic':      ['alpha', 'beta', 'D'],
}

# Models whose right-hand side commutes with the global phase rotation A -> e^{i phi} A,
# so that relative equilibria B(x) e^{i Omega t} are exact periodic orbits.
PHASE_MODELS = ('ginzburg-landau', 'lambda-omega', 'cgl-quintic')

# Uniform-state guesses for the Hopf-seeded models (used by uniform_state below).
UNIFORM_GUESS = {
    'brusselator':      lambda p: np.array([p['a'], p['b'] / p['a']]),
    'schnakenberg':     lambda p: np.array([p['a'] + p['b'], p['b'] / (p['a'] + p['b']) ** 2]),
    'selkov':           lambda p: np.array([p['b'], p['b'] / (p['a'] + p['b'] ** 2)]),
    'gierer-meinhardt': lambda p: np.array([p['nu'] + p.get('sigma', 0.0),
                                            (p['nu'] + p.get('sigma', 0.0)) ** 2 / p['nu']]),
    'lengyel-epstein':  lambda p: np.array([p['a'] / 5.0, 1.0 + (p['a'] / 5.0) ** 2]),
    'oregonator':       lambda p: np.array([0.2, 0.2]),
    'rps':              lambda p: np.array([1.0 / 3.0, 1.0 / 3.0]),
    'fitzhugh-nagumo':  lambda p: np.array([0.0, 0.0]),
    'barkley':          lambda p: np.array([0.1, 0.1]),
    # Gray-Scott's only uniform state is the trivial one; it is a saddle, never a Hopf
    # point, so the Gray-Scott jobs use kernel-projected forward integration instead.
    'gray-scott':       lambda p: np.array([1.0, 0.0]),
}


def uniform_state(model, p):
    """The spatially uniform equilibrium, refined from the analytic guess."""
    guess = UNIFORM_GUESS[model](p)
    return rdlab.uniform_equilibrium(model, p, guess)


def hopf_report(model, p):
    """Uniform-state eigenvalues (no diffusion).  A positive real part with a nonzero
    imaginary part is the oscillatory (Hopf-unstable) regime the searches want."""
    q0 = uniform_state(model, p)
    w, _ = hopf_eigen(model, p, q0, 0.0)
    i = int(np.argmax(w.real))
    j = int(np.argmax(abs(w.imag)))
    return dict(state=q0.tolist(), eigenvalues=[[float(z.real), float(z.imag)] for z in w],
                maxReal=float(w[i].real), imag=float(abs(w[j].imag)),
                hopf=bool(w[j].imag != 0 and w[j].real > 0),
                naturalPeriod=float(2 * np.pi / abs(w[j].imag)) if w[j].imag else None)


# ------------------------------------------------------------- catalogue of parameter sets
#
# Each entry is (model, label, params).  Every one was checked with hopf_report: the
# comment records the uniform-state eigenvalue pair actually produced by that parameter set.

PARAMETER_SETS = [
    # complex Ginzburg-Landau, three parameter pairs beyond the published (1.46,.174),(1.26,.127),(2.21,.40)
    ('ginzburg-landau', 'cgl-a', dict(alpha=0.60, beta=0.80, D=1.0)),
    ('ginzburg-landau', 'cgl-b', dict(alpha=1.80, beta=0.30, D=1.0)),
    ('ginzburg-landau', 'cgl-c', dict(alpha=0.20, beta=1.40, D=1.0)),
    ('ginzburg-landau', 'cgl-d', dict(alpha=-0.75, beta=0.55, D=1.0)),
    # cubic-quintic CGL: the quintic term flattens |B| and fattens the spiral arms
    ('cgl-quintic', 'cq-a', dict(alpha=1.00, beta=0.60, D=1.0, gamma=0.30, delta=0.00)),
    ('cgl-quintic', 'cq-b', dict(alpha=0.40, beta=0.90, D=1.0, gamma=0.15, delta=0.40)),
    ('cgl-quintic', 'cq-c', dict(alpha=1.60, beta=0.20, D=1.0, gamma=0.25, delta=-0.35)),
    # lambda-omega with real diffusion: cubic, and quintic-saturated
    ('lambda-omega', 'lw-a', dict(l0=1.0, l1=1.0, l2=0.0, w0=1.0, w1=-0.60, w2=0.0, D=1.0)),
    ('lambda-omega', 'lw-b', dict(l0=1.0, l1=1.0, l2=0.0, w0=0.0, w1=-1.20, w2=0.0, D=1.0)),
    ('lambda-omega', 'lw-c', dict(l0=1.0, l1=1.30, l2=0.35, w0=0.50, w1=-0.90, w2=0.25, D=1.0)),
    ('lambda-omega', 'lw-d', dict(l0=1.0, l1=0.80, l2=0.15, w0=-0.40, w1=0.70, w2=0.0, D=1.0)),
    # Brusselator at new parameters, including unequal diffusion
    ('brusselator', 'bru-a', dict(a=1.0, b=2.6, Du=1.0, Dv=1.0)),
    ('brusselator', 'bru-b', dict(a=1.5, b=3.6, Du=1.0, Dv=2.0)),
    ('brusselator', 'bru-c', dict(a=1.0, b=2.2, Du=2.0, Dv=1.0)),
    # weakly unstable sets: the published Brusselator records all sit within ~0.08 of the
    # Hopf point, and the strongly unstable ones synchronise the medium (see colour-search.md)
    ('brusselator', 'bru-d', dict(a=1.0, b=2.15, Du=1.0, Dv=1.0)),
    ('brusselator', 'bru-e', dict(a=1.5, b=3.40, Du=1.0, Dv=2.0)),
    # Schnakenberg, s = a + b inside (0.101, 0.9455) for a = 0.05
    ('schnakenberg', 'sch-a', dict(a=0.05, b=0.80, Du=1.0, Dv=1.0)),
    ('schnakenberg', 'sch-b', dict(a=0.05, b=0.60, Du=1.0, Dv=2.0)),
    ('schnakenberg', 'sch-c', dict(a=0.10, b=0.70, Du=1.0, Dv=1.0)),
    # Selkov glycolysis, between the two Hopf roots b = 0.42 and b = 0.79 at a = 0.1
    ('selkov', 'sel-a', dict(a=0.10, b=0.60, Du=1.0, Dv=1.0)),
    ('selkov', 'sel-b', dict(a=0.10, b=0.50, Du=1.0, Dv=2.0)),
    ('selkov', 'sel-c', dict(a=0.08, b=0.65, Du=1.0, Dv=1.0)),
    # Gierer-Meinhardt, nu between the Hopf roots 0.130 and 0.770 at sigma = 0.1
    ('gierer-meinhardt', 'gm-a', dict(nu=0.60, sigma=0.10, mu=1.0, kappa=0.0, Du=1.0, Dv=1.0)),
    ('gierer-meinhardt', 'gm-b', dict(nu=0.40, sigma=0.10, mu=1.0, kappa=0.05, Du=1.0, Dv=2.0)),
    ('gierer-meinhardt', 'gm-c', dict(nu=0.45, sigma=0.12, mu=1.0, kappa=0.0, Du=1.0, Dv=1.0)),
    # Lengyel-Epstein (CIMA); Hopf at b = (3 u*^2 - 5)/u*, u* = a/5
    ('lengyel-epstein', 'le-a', dict(a=12.0, b=4.0, Du=1.0, Dv=1.5)),
    ('lengyel-epstein', 'le-b', dict(a=14.0, b=5.5, Du=1.0, Dv=1.0)),
    ('lengyel-epstein', 'le-c', dict(a=10.0, b=2.2, Du=1.0, Dv=2.0)),
    ('lengyel-epstein', 'le-d', dict(a=12.0, b=4.9, Du=1.0, Dv=1.0)),
    # Two-variable Oregonator
    ('oregonator', 'ore-a', dict(f=0.90, q0=0.010, eps=0.40, Du=1.0, Dv=0.6)),
    ('oregonator', 'ore-b', dict(f=1.10, q0=0.020, eps=0.40, Du=1.0, Dv=1.0)),
    ('oregonator', 'ore-c', dict(f=1.10, q0=0.010, eps=0.40, Du=1.0, Dv=1.5)),
    # FitzHugh-Nagumo in the oscillatory regime (I past the Hopf point)
    ('fitzhugh-nagumo', 'fhn-a', dict(Du=1.0, Dv=0.5, eps=0.20, a=0.70, b=0.80, I=0.50)),
    ('fitzhugh-nagumo', 'fhn-b', dict(Du=1.0, Dv=1.0, eps=0.35, a=0.70, b=0.80, I=0.60)),
    ('fitzhugh-nagumo', 'fhn-c', dict(Du=1.0, Dv=0.25, eps=0.12, a=0.60, b=0.70, I=0.45)),
    ('fitzhugh-nagumo', 'fhn-d', dict(Du=1.0, Dv=0.5, eps=0.25, a=0.70, b=0.80, I=0.42)),
    # Cyclic three-species replicator: the equation's own Z3 colour symmetry
    ('rps', 'rps-a', dict(e=0.60, d=1.20, mu=0.02, D=1.0)),
    ('rps', 'rps-b', dict(e=0.80, d=1.20, mu=0.01, D=1.0)),
    ('rps', 'rps-c', dict(e=0.90, d=1.20, mu=0.02, D=1.0)),
    ('rps', 'rps-d', dict(e=1.00, d=1.05, mu=0.01, D=1.0)),
    ('rps', 'rps-e', dict(e=0.70, d=1.30, mu=0.03, D=1.0)),
    # Gray-Scott at parameters other than the published F .00406 / k .02
    ('gray-scott', 'gs-a', dict(F=0.010, k=0.033, Du=0.16, Dv=0.08)),
    ('gray-scott', 'gs-b', dict(F=0.014, k=0.041, Du=0.16, Dv=0.08)),
    ('gray-scott', 'gs-c', dict(F=0.026, k=0.055, Du=0.20, Dv=0.10)),
]
PARAMETER_SETS_BY_LABEL = {label: (model, params) for model, label, params in PARAMETER_SETS}


# --------------------------------------------------- relative equilibria of phase-symmetric models
def phase_relative_equilibrium(model, group, N, L, p, seed=0, sign=1, lattice='triangular',
                               total_time=600.0, report_every=50.0, tol=1e-10,
                               amplitude=0.5, initial=None, rng=None):
    """rdlab.cgl_relative_equilibrium generalised to any model in PHASE_MODELS.

    Integrates inside the invariant subspace B(g x) = exp(2 pi i sign tau_g) B(x) and
    fits F(B) ~ i Omega B; returns the state, Omega and the residual."""
    if model not in PHASE_MODELS:
        raise ValueError('%s has no global phase symmetry' % model)
    rhs = MODELS[model]['rhs']
    h = L / N
    ch = Character(group, N)
    rng = rng or np.random.default_rng(seed)
    if initial is None:
        B = amplitude * (rng.standard_normal((N, N)) + 1j * rng.standard_normal((N, N)))
    else:
        B = np.array(initial, complex)
    B = ch.project_complex(B, sign)
    q = np.stack([B.real, B.imag])
    dt = timestep(model, p, h)
    t = 0.0
    history = []
    omega = residual = float('nan')
    while t < total_time:
        q = flow(model, q, report_every, p, lattice, h, dt)
        t += report_every
        B = ch.project_complex(q[0] + 1j * q[1], sign)
        q = np.stack([B.real, B.imag])
        if not np.isfinite(q).all():
            return dict(B=B, omega=float('nan'), residual=float('inf'), history=history,
                        character=ch, h=h, diverged=True)
        F = rhs(q, p, lattice, h)
        Ft = F[0] + 1j * F[1]
        nb = float(np.vdot(B, B).real)
        if nb < 1e-12:
            return dict(B=B, omega=0.0, residual=float('inf'), history=history,
                        character=ch, h=h, collapsed=True)
        omega = float(np.imag(np.vdot(B, Ft)) / nb)
        residual = float(np.sqrt(np.mean(abs(Ft - 1j * omega * B) ** 2)))
        history.append((t, omega, residual, float(np.mean(abs(B) ** 2))))
        if residual < tol:
            break
    return dict(B=B, omega=omega, residual=residual, history=history, character=ch, h=h,
                diverged=False, collapsed=False)


def phase_polish(model, B, omega, ch, p, lattice, h, sign=1, maxiter=60, tol=1e-12):
    """Newton-Krylov on F(B) - i Omega B = 0 inside the character subspace."""
    from scipy.optimize import root
    rhs = MODELS[model]['rhs']
    N = B.shape[0]
    ref = ch.project_complex(B, sign)
    scale = float(np.sqrt(np.mean(abs(ref) ** 2))) or 1.0

    def unpack(z):
        Bz = ch.project_complex((z[:N * N] + 1j * z[N * N:2 * N * N]).reshape(N, N), sign)
        return Bz, z[-1]

    def residual(z):
        Bz, w = unpack(z)
        q = np.stack([Bz.real, Bz.imag])
        F = rhs(q, p, lattice, h)
        G = ch.project_complex((F[0] + 1j * F[1]) - 1j * w * Bz, sign)
        phase = np.imag(np.vdot(ref, Bz)) / (scale * scale * N * N)
        return np.r_[G.real.ravel(), G.imag.ravel(), phase]

    z0 = np.r_[ref.real.ravel(), ref.imag.ravel(), omega]
    sol = root(residual, z0, method='krylov',
               options=dict(fatol=tol, maxiter=maxiter,
                            jac_options=dict(inner_maxiter=60, method='lgmres')))
    Bz, w = unpack(sol.x)
    r = residual(sol.x)
    return dict(B=Bz, omega=float(w), residual=float(np.sqrt(np.mean(r[:-1] ** 2))),
                success=bool(sol.success), message=str(sol.message))


def phase_movie(B, omega, M):
    """A(t) = B exp(i omega t), one full period in M frames."""
    T = 2 * np.pi / abs(omega)
    return np.array([np.stack([(B * np.exp(1j * omega * T * j / M)).real,
                               (B * np.exp(1j * omega * T * j / M)).imag]) for j in range(M)]), T


# ---------------------------------------------------------------- Hopf-seeded twisted shooting
def character_seed_field(group, N, L, sign=1, seed=0, lattice='triangular',
                         alpha=0.5, beta=0.5, total_time=300.0):
    """A clean complex spiral lattice B with the entry's character, from a CGL relative
    equilibrium at generic coefficients.  Used to seed the non-phase-symmetric models."""
    r = phase_relative_equilibrium('ginzburg-landau', group, N, L,
                                   dict(alpha=alpha, beta=beta, D=1.0), seed=seed, sign=sign,
                                   lattice=lattice, total_time=total_time, report_every=50.0,
                                   tol=1e-9)
    return r['B'], r['residual']


def rpo_twisted(model, group, N, L, p, q_init, T0, M=96, lattice=None, window=(0.35, 3.2),
                samples=32, maxiter=40, dt=None, project_seed=True):
    """Estimate the twisted period near T0, polish with rdlab.rpo_polish, build the movie
    and audit it.  The movie is one unprojected RK4 period from the converged state."""
    lattice = lattice or group['lattice']
    h = L / N
    ch = Character(group, N)
    q = np.array(q_init, float)
    if project_seed:
        q = ch.project_kernel(q)
    try:
        T, r, _ = estimate_period(model, q, p, lattice, h, ch,
                                  window[0] * T0, window[1] * T0, samples=samples, dt=dt)
    except (OverflowError, FloatingPointError, ValueError) as exc:
        return dict(q=q, T=0.0, movie=np.zeros((1, 2, N, N)), seedTwistedResidual=float('inf'),
                    polish=dict(residual=float('inf'), success=False, message=str(exc)),
                    audit=dict(passed=False, reason='period estimate failed'))
    try:
        pol = rpo_polish(model, q, T, p, lattice, h, ch, maxiter=maxiter, dt=dt)
    except (OverflowError, FloatingPointError, ValueError) as exc:
        return dict(q=q, T=float(T), movie=np.zeros((1, 2, N, N)), seedTwistedResidual=float(r),
                    polish=dict(residual=float('inf'), success=False, message=str(exc)),
                    audit=dict(passed=False, reason='Newton diverged'))
    q, T = pol['q'], pol['T']
    if not (np.isfinite(T) and 0 < T < 1e5) or not np.isfinite(q).all():
        return dict(q=q, T=float(T) if np.isfinite(T) else 0.0, movie=np.zeros((1, 2, N, N)),
                    seedTwistedResidual=float(r),
                    polish={k: v for k, v in pol.items() if k != 'q'},
                    audit=dict(passed=False, reason='nonfinite period or state'))
    frames = []
    s = q.copy()
    for _ in range(M):
        frames.append(s.copy())
        s = flow(model, s, T / M, p, lattice, h, dt)
    movie = np.array(frames)
    ok = np.isfinite(movie).all() and pol['residual'] < 1e-6
    a = rdlab.audit(model, movie, p, group, L, T, lattice, dynamics=ok) if np.isfinite(movie).all() else dict(passed=False, reason='nonfinite')
    return dict(q=q, T=float(T), movie=movie, seedTwistedResidual=float(r),
                polish={k: v for k, v in pol.items() if k != 'q'}, audit=a)


# ----------------------------------------------------------------------- the colour rules
R120 = np.array([[0, -1], [1, -1]], int)        # (u, v) -> (-v, u - v)
TREFOIL_B = (1, 2)                              # b = (1/3, 2/3) in thirds of the lattice vectors

# the twelve point operations of the hexagonal lattice, as 2x2 integer matrices on (x, y)
def hex_point_ops():
    rots = [np.eye(2, dtype=int)]
    for _ in range(5):
        rots.append((-R120 @ rots[-1]) % 1 if False else None)
    # build the sixfold rotation explicitly: R60 = -R120^2
    R = R120
    R2 = R @ R
    R60 = -R2
    ops = []
    cur = np.eye(2, dtype=int)
    for _ in range(6):
        ops.append(cur.copy())
        cur = R60 @ cur
    mirror = np.array([[0, 1], [1, 0]], int)     # (u, v) -> (v, u); reverses b
    ops += [m @ mirror for m in list(ops)]
    return ops


HEX_POINT_OPS = hex_point_ops()


def node_map(matrix, shift, N):
    """Flat permutation index m with (S f)[i] = f.ravel()[m][i] = f(matrix x + shift)."""
    y, x = np.indices((N, N))
    a = np.asarray(matrix, int)
    s = np.asarray(shift, int)
    xs = (a[0, 0] * x + a[0, 1] * y + s[0]) % N
    ys = (a[1, 0] * x + a[1, 1] * y + s[1]) % N
    return (ys * N + xs).ravel()


def gyre_colour(U, w, N=None):
    """colour(x, t) = argmax_k U(g^k x, t + k T/3), g: x -> R x + w (mod N).

    U has shape (M, N, N) indexed [t, y, x] and M must be divisible by 3."""
    U = np.asarray(U, float)
    M, N1, _ = U.shape
    N = N or N1
    if M % 3:
        raise ValueError('Gyre needs a frame count divisible by three')
    w = np.asarray(w, int) % N
    m1 = node_map(R120, w, N)
    m2 = node_map(R120 @ R120, (R120 @ w + w) % N, N)
    flat = U.reshape(M, -1)
    t = np.arange(M)
    v0 = flat
    v1 = flat[(t + M // 3) % M][:, m1]
    v2 = flat[(t + 2 * M // 3) % M][:, m2]
    stack = np.stack([v0, v1, v2])                     # (3, M, N*N)
    colour = np.argmax(stack, axis=0).astype(np.int8)
    top = np.max(stack, axis=0)
    ties = int(np.sum(np.sum(stack == top[None], axis=0) > 1))
    return colour.reshape(M, N, N), ties, stack


def trefoil_colour(U, b=TREFOIL_B, N=None):
    """colour(x, t) = argmax_k U(x + k b, t) with b = (b0/3, b1/3) in lattice coordinates."""
    U = np.asarray(U, float)
    M, N1, _ = U.shape
    N = N or N1
    if N % 3:
        raise ValueError('Trefoil needs a node count divisible by three')
    step = (b[0] * N // 3, b[1] * N // 3)
    flat = U.reshape(M, -1)
    eye = np.eye(2, dtype=int)
    maps = [node_map(eye, (k * step[0], k * step[1]), N) for k in range(3)]
    stack = np.stack([flat[:, m] for m in maps])       # (3, M, N*N)
    colour = np.argmax(stack, axis=0).astype(np.int8)
    top = np.max(stack, axis=0)
    ties = int(np.sum(np.sum(stack == top[None], axis=0) > 1))
    return colour.reshape(M, N, N), ties, stack


HEX_NEIGHBOURS = [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1)]   # (dy, dx) on the six-neighbour stencil


def colour_statistics(colour):
    """Balance, boundary density and speckle rate of a colour movie (M, N, N)."""
    M, N, _ = colour.shape
    counts = np.array([float(np.mean(colour == c)) for c in range(3)])
    diff = np.zeros(colour.shape, bool)
    alldiff = np.ones(colour.shape, bool)
    for dy, dx in HEX_NEIGHBOURS:
        nb = np.roll(np.roll(colour, dy, axis=1), dx, axis=2)
        d = nb != colour
        diff |= d
        alldiff &= d
    return dict(balance=[float(counts.min()), float(counts.max())],
                fractions=counts.tolist(),
                boundaryDensity=float(diff.mean()),
                speckleRate=float(alldiff.mean()),
                nodeFrames=int(M * N * N))


def recolourings(kind='S3'):
    """The colour permutations, as tuples pi with pi[c] the new label of colour c."""
    if kind == 'Z3':
        return {'id': (0, 1, 2), '+1': (1, 2, 0), '+2': (2, 0, 1)}
    return {'id': (0, 1, 2), '+1': (1, 2, 0), '+2': (2, 0, 1),
            '(12)': (0, 2, 1), '(02)': (2, 1, 0), '(01)': (1, 0, 2)}


def colour_symmetry_sweep(colour, ops=None, perms=None, translations=True):
    """For every point operation h, colour permutation pi, time shift j and (optionally)
    every lattice translation, the fraction of node-frames with
    colour(h x + v, t + j) == pi(colour(x, t)).

    Returns, per (h, pi), the best agreement and the (j, v) that attains it.  Uses the
    space-and-time FFT so the whole 12 x M x N^2 x |perms| sweep costs a few seconds.
    """
    colour = np.asarray(colour)
    M, N, _ = colour.shape
    ops = HEX_POINT_OPS if ops is None else ops
    perms = recolourings() if perms is None else perms
    total = float(M * N * N)
    A = np.stack([(colour == c).astype(float) for c in range(3)])            # (3, M, N, N)
    Ahat = np.fft.fft2(A)                                                     # over (y, x)
    Ahat_t = np.fft.fft(Ahat, axis=1)                                         # over t
    out = []
    for oi, h in enumerate(ops):
        m = node_map(h, (0, 0), N)
        E = A.reshape(3, M, -1)[:, :, m].reshape(3, M, N, N)
        Ehat_t = np.fft.fft(np.fft.fft2(E), axis=1)
        # G[c, c'][j, k] = sum_t conj(Ahat[c, t, k]) Ehat[c', t + j, k]
        G = np.conj(Ahat_t)[:, None] * Ehat_t[None, :]                        # (3, 3, M, N, N)
        G = np.fft.ifft(G, axis=2)
        identity_op = bool(np.array_equal(np.asarray(h, int), np.eye(2, dtype=int)))
        for name, pi in perms.items():
            S = sum(G[c, pi[c]] for c in range(3))                            # (M, N, N)
            corr = np.real(np.fft.ifft2(S)) / total
            if not translations:
                corr = corr[:, :1, :1]
            zero = corr[0]
            zj = int(np.argmax(zero))
            zero_best = float(zero.ravel()[zj])
            zero_v = (int(zj % corr.shape[2]), int(zj // corr.shape[2]))
            work = corr.copy()
            if identity_op and name == 'id':
                work[0, 0, 0] = -np.inf            # the trivial (identity, no shift, no translation)
                if zj == 0:
                    flat0 = zero.ravel().copy()
                    flat0[0] = -np.inf
                    z2 = int(np.argmax(flat0))
                    zero_best = float(flat0[z2])
                    zero_v = (int(z2 % corr.shape[2]), int(z2 // corr.shape[2]))
            idx = int(np.argmax(work))
            j, k = divmod(idx, work.shape[1] * work.shape[2])
            best = float(work.reshape(M, -1)[j, k])
            v = (int(k % work.shape[2]), int(k // work.shape[2]))
            out.append(dict(op=oi, matrix=np.asarray(h, int).tolist(), perm=name,
                            agreement=best, frameShift=int(j), translation=list(v),
                            zeroShiftAgreement=zero_best, zeroShiftTranslation=list(zero_v),
                            determinant=int(round(float(np.linalg.det(np.asarray(h, float)))))))
    return out


def gyre_quality(U, w, T=None):
    """Everything the Gyre page needs to know about one field and one turn centre."""
    colour, ties, _ = gyre_colour(U, w)
    M, N, _ = colour.shape
    stats = colour_statistics(colour)
    # the law itself, re-measured rather than assumed
    m1 = node_map(R120, np.asarray(w, int) % N, N)
    shifted = colour.reshape(M, -1)[(np.arange(M) + M // 3) % M][:, m1]
    law = float(np.mean(shifted == ((colour.reshape(M, -1) + 2) % 3)))
    # the Triskele leak: g alone (any time shift) or a time shift alone recolouring
    sweep = colour_symmetry_sweep(colour, perms=recolourings('Z3'))
    # the colour-preserving subgroup must be no more than the lattice translations: the best
    # agreement over every non-trivial (point operation, time shift, translation) with the
    # colours left alone has to stay well below 1.
    # A leak is an *exact* extra colour-preserving symmetry: the identity operation at a
    # small frame shift always agrees to ~97 % simply because the animation is smooth, so
    # the gate is exactness, not a threshold.
    exact = [r for r in sweep if r['perm'] == 'id' and r['agreement'] > 1 - 1e-9]
    preserving = max((r for r in sweep if r['perm'] == 'id' and r['op'] != 0),
                     key=lambda r: r['agreement'], default=None)
    identity_rows = [r for r in sweep if r['op'] == 0]
    best_swapless = max((r['zeroShiftAgreement'] for r in sweep if r['op'] != 0), default=0.0)
    p = np.linalg.solve(np.eye(2) - R120, np.asarray(w, float)) / N
    return dict(rule='gyre', turnShift=list(map(int, np.asarray(w, int) % N)),
                turnCentre=[float(p[0]), float(p[1])],
                ties=ties, tieFraction=ties / float(M * N * N), lawAgreement=law,
                **stats,
                exactColourPreserving=exact, exactColourPreservingCount=len(exact),
                colourPreservingLeak=preserving, bestOther=best_swapless,
                identityOpRows=identity_rows, sweep=sweep)


def trefoil_quality(U, b=TREFOIL_B, half_turn=None):
    """Everything the Trefoil page needs: ties, balance, the two laws and the S3 sweep."""
    colour, ties, _ = trefoil_colour(U, b)
    M, N, _ = colour.shape
    stats = colour_statistics(colour)
    flat = colour.reshape(M, -1)
    step = (b[0] * N // 3, b[1] * N // 3)
    mb = node_map(np.eye(2, dtype=int), step, N)
    cycle = float(np.mean(flat[:, mb] == ((flat + 2) % 3)))
    h = np.array([[-1, 0], [0, -1]], int) if half_turn is None else np.asarray(half_turn, int)
    mh = node_map(h, (0, 0), N)
    swapped = np.array([0, 2, 1])[flat]
    entangled = float(np.mean(flat[(np.arange(M) + M // 2) % M][:, mh] == swapped))
    sweep = colour_symmetry_sweep(colour)
    # Theorem (research/s3-design.md Sec. 1): the transpositions are entangled precisely when
    # no swap can be had with no time shift.  Measure exactly that, over every point
    # operation and every lattice translation at frame shift zero.
    spatial_swap = max((r['zeroShiftAgreement'] for r in sweep
                        if r['perm'] in ('(12)', '(02)', '(01)')), default=0.0)
    halfturn_alone = max((r['zeroShiftAgreement'] for r in sweep if r['op'] != 0), default=0.0)
    mirror_best = max((r['agreement'] for r in sweep if r['determinant'] == -1), default=0.0)
    return dict(rule='trefoil', offset=list(b), halfTurn=h.tolist(),
                ties=ties, tieFraction=ties / float(M * N * N),
                cycleAgreement=cycle, entangledAgreement=entangled,
                bestSpatialTransposition=spatial_swap, bestPurelySpatial=halfturn_alone,
                bestMirror=mirror_best,
                **stats, sweep=sweep)


def hosts_trefoil(group):
    """The group operations (h, T/2) with h b = -b (mod L): exactly what entangles the swap."""
    b = np.array([1.0 / 3.0, 2.0 / 3.0])
    out = []
    for i, op in enumerate(group['ops']):
        if abs(op['tau'] - 0.5) > 1e-9:
            continue
        Mm = np.asarray(op['M'], int)
        v = np.asarray(op.get('v', [0, 0]), float)
        image = (Mm @ b + v) % 1.0
        if np.max(np.abs(((image + b) % 1.0 + 0.5) % 1.0 - 0.5)) < 1e-9:
            kind = ('half-turn' if np.array_equal(Mm, -np.eye(2, dtype=int))
                    else 'rotation' if round(np.linalg.det(Mm)) == 1 else 'mirror/glide')
            out.append(dict(index=i, M=Mm.tolist(), v=v.tolist(), tau=op['tau'], kind=kind))
    return out


def tie_risk(group):
    """Same-time operations (tau = 0) that map some node x onto x + k b: on those fixed
    lines U(x) = U(x + k b) by symmetry, the Trefoil argmax is a coin flip, and no law can
    be bit-exact.  This is the structural reason the square-lattice Plume route failed."""
    b = np.array([1.0, 2.0]) / 3.0
    risky = []
    for i, op in enumerate(group['ops']):
        if abs(op['tau']) > 1e-9:
            continue
        Mm = np.asarray(op['M'], int)
        v = np.asarray(op.get('v', [0, 0]), float)
        for k in (1, 2):
            A = Mm - np.eye(2, dtype=int)
            rhs = (k * b - v)
            # solutions of A x = rhs (mod 1) exist iff rhs is in the image of A over the rationals
            if abs(round(np.linalg.det(A))) >= 1:
                risky.append(dict(index=i, M=Mm.tolist(), k=k, kind='isolated fixed points'))
                continue
            u, s, vt = np.linalg.svd(A.astype(float))
            null_left = u[:, s < 1e-9]
            if null_left.size and np.max(np.abs(null_left.T @ rhs)) < 1e-9:
                risky.append(dict(index=i, M=Mm.tolist(), k=k, kind='fixed line'))
    return risky


def hosts_gyre(group):
    """Gyre is exact for any T-periodic hexagonal field; this records the entry's own
    threefold-with-third-period operations, which are what makes the turn centre matter."""
    out = []
    for i, op in enumerate(group['ops']):
        Mm = np.asarray(op['M'], int)
        if np.array_equal(Mm, R120) or np.array_equal(Mm, R120 @ R120):
            out.append(dict(index=i, M=Mm.tolist(), tau=op['tau']))
    return out


# --------------------------------------------------------------------------- admission
def verifier_fingerprint():
    parts = [(EQUATIONS / 'rdlab.py').read_bytes(), (EQUATIONS / 'admit.py').read_bytes(),
             (HERE / 'rdlab_colour.py').read_bytes()]
    return hashlib.sha256(b''.join(parts)).hexdigest()


def certify(field, config, group):
    """../equations/admit.py's certificate, with the extra models' parameter lists
    registered and the gate renamed to colour-offline-v1."""
    import admit
    saved = dict(admit.MODEL_PARAMS)
    try:
        admit.MODEL_PARAMS.update(MODEL_PARAMS)
        proof = admit.certify(field, config, group)
    finally:
        admit.MODEL_PARAMS.clear()
        admit.MODEL_PARAMS.update(saved)
    proof['gateVersion'] = GATE
    proof['verificationSources'] = ['../equations/rdlab.py', '../equations/admit.py', 'rdlab_colour.py']
    proof['verificationCodeSha256'] = verifier_fingerprint()
    return proof


def export_candidate(outdir, name, model, movie, T, group, L, p, extra=None, certificate=None):
    """Write <name>.f32 + <name>.json in the layout build-colour-catalog.py expects."""
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    movie = np.asarray(movie, float)
    M, _, N, _ = movie.shape
    h = L / N
    stencil = 'triangular-six' if group['lattice'] == 'triangular' else 'five-point'
    config = dict(N=N, M=M, L=L, period=float(T), groupId=group['id'], model=model,
                  params={**p, 'dx': h, 'stencil': stencil}, ops=group['ops'])
    payload = movie.astype('<f4').tobytes()
    (outdir / (name + '.f32')).write_bytes(payload)
    meta = dict(schema='colour-candidate-v1', gateVersion=GATE, model=model,
                groupId=group['id'], family=group['family'], lattice=group['lattice'],
                config=config, fieldUrl=name + '.f32', fieldEncoding='float32-le',
                fieldSha256=hashlib.sha256(payload).hexdigest(), fieldByteLength=len(payload),
                fieldLayout='frame-major; planar channel 0 then channel 1; x-fast; lattice nodes i/N,j/N',
                period=float(T), verificationCodeSha256=verifier_fingerprint(),
                certificate=certificate, **(extra or {}))
    (outdir / (name + '.json')).write_text(json.dumps(meta, indent=1))
    return meta


def load_hex_groups():
    data, groups = load_groups(str(GROUPS_PATH))
    return data, {k: g for k, g in groups.items() if g['lattice'] == 'triangular'}


# ------------------------------------------------------------------------------ smoke test
def smoke(model, params, steps=4000, dt=None, N=8, L=10.0, seed=0):
    """Uniform-state eigenvalues plus a short zero-dimensional integration, to show the
    parameter set really oscillates before any expensive search is launched."""
    rep = hopf_report(model, params)
    q0 = np.array(rep['state'], float)
    rng = np.random.default_rng(seed)
    q = q0[:, None, None] + 0.02 * rng.standard_normal((2, 1, 1))
    h = 1.0
    k = dt or timestep(model, params, h)
    trace = []
    for i in range(steps):
        q = flow(model, q, k, params, 'square', h, k)
        trace.append(float(q[0, 0, 0]))
        if not np.isfinite(q).all():
            return dict(model=model, params=params, hopf=rep, diverged=True, step=i)
    tail = np.array(trace[len(trace) // 2:])
    amp = float(tail.max() - tail.min())
    return dict(model=model, params=params, hopf=rep, diverged=False,
                integrationTime=steps * k, oscillationAmplitude=amp,
                oscillates=bool(amp > 1e-3 * max(1.0, abs(float(np.mean(tail))))),
                mean=float(np.mean(tail)))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--smoke', action='store_true', help='run the uniform-state smoke test on every parameter set')
    ap.add_argument('--hosts', action='store_true', help='report which hexagonal entries host each colour rule')
    a = ap.parse_args()
    if a.hosts:
        _, groups = load_hex_groups()
        for gid, g in sorted(groups.items()):
            t = hosts_trefoil(g)
            y = hosts_gyre(g)
            r = tie_risk(g)
            print('%-5s %-6s %-12s trefoil:%d %-22s tie-risk:%-2d gyre-thirds:%s' % (
                gid, g['family'], g['signature'], len(t),
                ','.join(sorted({x['kind'] for x in t})) or '-', len(r),
                ','.join('%.3g' % x['tau'] for x in y)))
    if a.smoke or not a.hosts:
        for model, label, params in PARAMETER_SETS:
            if model in PHASE_MODELS:
                print('%-18s %-7s phase-symmetric (relative equilibria); params %s' % (model, label, params))
                continue
            r = smoke(model, params)
            print('%-18s %-7s hopf=%s Re=%+.4f Im=%.4f T0=%s amp=%.4g osc=%s%s' % (
                model, label, r['hopf']['hopf'], r['hopf']['maxReal'], r['hopf']['imag'],
                ('%.3f' % r['hopf']['naturalPeriod']) if r['hopf']['naturalPeriod'] else '-',
                r.get('oscillationAmplitude', float('nan')), r.get('oscillates'),
                ' DIVERGED' if r.get('diverged') else ''))
