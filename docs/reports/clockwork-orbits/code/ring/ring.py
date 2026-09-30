#!/usr/bin/env python3
"""Three Brusselator cells on a ring: the clockwork method in miniature.

The published example of the tutorial is a Brusselator on a 36 x 36 triangular
mesh whose clockwork group g227 asks that a 120-degree turn about a 3-sub-1
centre be the same film a third of a period later.  The unknown there is 2 592
numbers and one period.

This module is the same problem with six numbers and one period.  Three
identical Brusselator cells sit on a ring, coupled diffusively, and the
clockwork symmetry is "move one cell round the ring = wait a third of a
period".  Every step of the real recipe has an exact counterpart here:

    read the character off the group   ->  only one ring Fourier mode is allowed
    test the reciprocal shells         ->  m = -1 survives, m = 0 and m = +1 do not
    symmetrise into a star             ->  phases 1, exp(2i pi/3), exp(4i pi/3)
    lift through the Hopf eigenvector  ->  the same 2 x 2 eigenvector, unchanged
    Newton on one state + one number   ->  seven unknowns instead of 869
    delayed glue on the domain         ->  one cell whose neighbours are its own past

Units and conventions
---------------------
State ``q`` is an array of shape (2, 3): ``q[0]`` is u, ``q[1]`` is v, and the
second axis indexes the cells j = 0, 1, 2 round the ring.

The ring shift is ``S``, defined by ``(S q)_j = q_{j-1}``, i.e. every cell hands
its state to the next cell round the ring.  The clockwork constraint of the
tutorial, ``q(g x, t + tau_g T) = q(x, t)`` with tau = 1/3 for one step round
the ring, reads

    q_{j+1}(t + T/3) = q_j(t)          equivalently     q(t + T/3) = S q(t) .

Cubing it gives q(t + T) = q(t), so T is the period.  The twisted shooting
residual is therefore

    F(q0, T) = S^{-1} Phi_{T/3}(q0) - q0

with Phi the time-s flow of the six-dimensional vector field.  Only the
identity acts on a single instant here -- the "tau = 0 kernel" of the ring is
trivial -- so nothing at all is imposed on the state and the whole symmetry is
an output, exactly as on the real problem.

No repository access, no network, no files read.  NumPy only (SciPy is used for
one eigenvalue call and one root find that both have hand-written fallbacks).
"""
from __future__ import annotations

import numpy as np

# ---------------------------------------------------------------- parameters --
A = 1.0      # Brusselator a, as in the published g227 record
B = 2.3      # Brusselator b, as in the published g227 record
D = 0.02     # ring coupling strength; see README for why this value

NCELL = 3
TAU = 1.0 / 3.0


# --------------------------------------------------------------- the equation --
def rhs(q, *, a=A, b=B, d=D):
    """Right-hand side of the three-cell ring.  q has shape (2, 3)."""
    u, v = q[0], q[1]
    lu = np.roll(u, -1) + np.roll(u, 1) - 2.0 * u
    lv = np.roll(v, -1) + np.roll(v, 1) - 2.0 * v
    uuv = u * u * v
    return np.stack((a - (b + 1.0) * u + uuv + d * lu,
                     b * u - uuv + d * lv))


def rhs_free(q, neigh_sum, *, a=A, b=B, d=D):
    """Right-hand side of a *single* cell whose two neighbours are supplied.

    ``q`` has shape (2,); ``neigh_sum`` is the sum of the two neighbour states,
    also shape (2,).  This is the delayed-glue right-hand side: on the real
    problem the neighbour across a glued edge is the domain's own past, and here
    the two neighbours are q(t - T/3) and q(t - 2T/3).
    """
    u, v = q[0], q[1]
    uuv = u * u * v
    return np.array([a - (b + 1.0) * u + uuv + d * (neigh_sum[0] - 2.0 * u),
                     b * u - uuv + d * (neigh_sum[1] - 2.0 * v)])


def equilibrium(*, a=A, b=B):
    """The uniform equilibrium, exactly (a, b/a) in every cell."""
    return np.stack((np.full(NCELL, a), np.full(NCELL, b / a)))


def reaction_jacobian(*, a=A, b=B):
    """The 2 x 2 reaction Jacobian at the uniform equilibrium."""
    return np.array([[b - 1.0, a * a],
                     [-b, -a * a]])


def hopf_data(*, a=A, b=B):
    """Hopf eigenvalue, eigenvector and period estimate of the 2 x 2 problem.

    Returns (lam, evec, omega, T0).  This is the *only* place a nonlinear
    problem is solved before Newton, and it is two-dimensional: no ring, no
    coupling, no group.
    """
    j = reaction_jacobian(a=a, b=b)
    w, vecs = np.linalg.eig(j)
    k = int(np.argmax(w.imag))          # the eigenvalue with positive imaginary part
    lam = w[k]
    e = vecs[:, k]
    e = e / np.abs(e[0]) * np.exp(-1j * np.angle(e[0]))   # normalise: e[0] real > 0
    omega = float(lam.imag)
    return lam, e, omega, 2.0 * np.pi / omega


def ring_laplacian_eigenvalue(m):
    """Eigenvalue of the ring Laplacian on Fourier mode m: 2 cos(2 pi m/3) - 2."""
    return 2.0 * np.cos(2.0 * np.pi * m / NCELL) - 2.0


def mode_growth(m, *, a=A, b=B, d=D):
    """Growth rate and frequency of ring Fourier mode m at the equilibrium.

    Because Du = Dv = d the coupling term is a multiple of the identity, so it
    shifts only the real part: the frequency is the same for every mode.
    """
    lam, _, _, _ = hopf_data(a=a, b=b)
    shift = d * ring_laplacian_eigenvalue(m)      # negative for m = +-1
    return float(lam.real + shift), float(lam.imag)


def mode_onset_b(m, *, a=A, d=D):
    """The value of b at which ring Fourier mode m goes Hopf."""
    return 1.0 + a * a - 2.0 * d * ring_laplacian_eigenvalue(m)


# ------------------------------------------------------------- ring symmetry --
def shift(q, power=1):
    """The ring shift S, (S q)_j = q_{j-1}, applied ``power`` times."""
    return np.roll(q, power, axis=1)


def character(m=-1):
    """The allowed ring Fourier mode as three complex phases.

    The clockwork constraint q(t + T/3) = S q(t) applied to the linear ansatz
    q_j = q* + A Re(z_j exp(i omega t) e) forces z_{j-1} = z_j exp(2i pi/3),
    i.e. z_j = exp(-2i pi j/3).  That is mode m = -1 and no other: m = 0 (all
    cells in phase) and m = +1 (the opposite handedness) both fail.
    """
    j = np.arange(NCELL)
    return np.exp(2j * np.pi * m * j / NCELL)


def character_projection(m, *, tau=TAU):
    """|(P z)_j| for ring mode m, where (P f)_j = (1/3) sum_n e^{2 pi i n tau} f_{j+n}.

    P is the ring's copy of the tutorial's character projector
    (P f)(x) = (1/9) sum_g e^{2 pi i tau_g} f(g x).  This is the exact miniature
    of projecting a plane wave onto the clockwork character in the real problem:
    three of the six shortest reciprocal vectors survive with projection norm
    0.5774 and three read exactly 0.  Here one of the three ring modes survives
    with norm 1 and two read exactly 0.
    """
    z = character(m)
    acc = np.zeros(NCELL, dtype=complex)
    for n in range(NCELL):
        acc += np.exp(2j * np.pi * n * tau) * np.roll(z, -n)
    acc /= NCELL
    return float(np.max(np.abs(acc)))


def seed(amplitude, *, m=-1, a=A, b=B):
    """The pencil seed: the Hopf eigenvector times the allowed ring mode."""
    _, e, _, _ = hopf_data(a=a, b=b)
    z = character(m)
    q = equilibrium(a=a, b=b) + amplitude * np.real(np.outer(e, z))
    return q


def uniform_cycle(*, a=A, b=B, nstep=20000, tol=1e-13):
    """The spatially uniform Brusselator limit cycle, and its rms amplitude.

    A two-variable ordinary differential equation with no ring and no group in
    it.  Returns (period, rms amplitude, samples).  The rms amplitude is the
    a-priori seed amplitude rule of the real recipe.
    """
    def f2(y):
        u, v = y
        uuv = u * u * v
        return np.array([a - (b + 1.0) * u + uuv, b * u - uuv])

    from scipy.integrate import solve_ivp

    # relax onto the cycle, then read the period off the section u = a, du/dt > 0
    s = solve_ivp(lambda t, y: f2(y), [0, 400], [a * 1.05, b / a * 0.95],
                  rtol=1e-11, atol=1e-13, dense_output=True)
    y1 = s.y[:, -1]
    s2 = solve_ivp(lambda t, y: f2(y), [0, 40], y1,
                   rtol=1e-12, atol=1e-14, dense_output=True)
    ts = np.linspace(0, 40, 400001)
    ys = s2.sol(ts)
    cross = [t for k, t in enumerate(ts[:-1])
             if (ys[0, k] - a) < 0 <= (ys[0, k + 1] - a)]
    period = float(cross[1] - cross[0])
    tt = np.linspace(cross[0], cross[0] + period, 20001)
    yy = s2.sol(tt)
    dev = np.stack([yy[0] - a, yy[1] - b / a])
    rms = float(np.sqrt(np.mean(dev ** 2)))
    return period, rms, dev


# --------------------------------------------------------------- integration --
def rk4(q, h, *, a=A, b=B, d=D):
    k1 = rhs(q, a=a, b=b, d=d)
    k2 = rhs(q + 0.5 * h * k1, a=a, b=b, d=d)
    k3 = rhs(q + 0.5 * h * k2, a=a, b=b, d=d)
    k4 = rhs(q + h * k3, a=a, b=b, d=d)
    return q + (h / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)


class Counter:
    """Right-hand-side evaluations, the one currency that survives everything."""

    def __init__(self):
        self.n = 0

    def add(self, k=1):
        self.n += k


def flow(q, s, nstep, *, a=A, b=B, d=D, counter=None, trace=False):
    """Integrate for time ``s`` in ``nstep`` fixed RK4 steps."""
    h = s / nstep
    out = [q.copy()] if trace else None
    for _ in range(nstep):
        q = rk4(q, h, a=a, b=b, d=d)
        if trace:
            out.append(q.copy())
    if counter is not None:
        counter.add(4 * nstep)
    return (q, np.asarray(out)) if trace else q


# ------------------------------------------------------- twisted shooting ----
def twisted_residual(q0, T, nstep, *, a=A, b=B, d=D, counter=None):
    """F(q0, T) = S^{-1} Phi_{T/3}(q0) - q0, shape (2, 3)."""
    qT = flow(q0, T / NCELL, nstep, a=a, b=b, d=d, counter=counter)
    return shift(qT, -1) - q0


def rms(x):
    return float(np.sqrt(np.mean(np.asarray(x) ** 2)))


def newton(q_seed, T_seed, *, nstep=3600, maxit=30, tol=1e-12,
           a=A, b=B, d=D, fd=1e-7, verbose=False):
    """Newton on one state and one number.

    Seven unknowns: the six state values and log T.  Seven equations: the six
    twisted-shooting components and one phase condition that pins the time
    origin, exactly as the real solver's does.  The Jacobian is formed outright
    by finite differences because it is 7 x 7; on the real problem the same
    Jacobian is 869 x 869 and is reached only through directional derivatives,
    which is the only difference between this and ``rpo_polish``.
    """
    counter = Counter()
    q = q_seed.copy()
    lT = np.log(T_seed)
    # the phase condition: stay orthogonal to the seed's own velocity
    vel = rhs(q_seed, a=a, b=b, d=d)
    vel = vel / np.linalg.norm(vel)

    def resid(x):
        qq = x[:6].reshape(2, NCELL)
        TT = float(np.exp(x[6]))
        f = twisted_residual(qq, TT, nstep, a=a, b=b, d=d, counter=counter)
        phase = float(np.sum((qq - q_seed) * vel))
        return np.concatenate((f.ravel(), [phase]))

    x = np.concatenate((q.ravel(), [lT]))
    with np.errstate(over='ignore', invalid='ignore'):
        r = resid(x)
    history = [{'iter': 0, 'residualRms': rms(r[:6]), 'T': float(np.exp(x[6])),
                'rhsEvals': counter.n}]
    if verbose:
        print(f"seed   rms {rms(r[:6]):.3e}   T {np.exp(x[6]):.12f}")
    for it in range(1, maxit + 1):
        with np.errstate(over='ignore', invalid='ignore'):
            # dense finite-difference Jacobian, 7 columns
            J = np.zeros((7, 7))
            for k in range(7):
                xp = x.copy()
                hk = fd * max(1.0, abs(x[k]))
                xp[k] += hk
                J[:, k] = (resid(xp) - r) / hk
            if not np.all(np.isfinite(J)):
                break                      # the iterate blew up: report the failure
            try:
                dx = np.linalg.solve(J, -r)
            except np.linalg.LinAlgError:
                dx = -np.linalg.lstsq(J, r, rcond=None)[0]
            x = x + dx
            r = resid(x)
        history.append({'iter': it, 'residualRms': rms(r[:6]),
                        'T': float(np.exp(x[6])), 'rhsEvals': counter.n})
        if verbose:
            print(f"step {it}  rms {rms(r[:6]):.3e}   T {np.exp(x[6]):.12f}")
        if not np.all(np.isfinite(r)):
            break
        if rms(r[:6]) < tol:
            break
    q0 = x[:6].reshape(2, NCELL)
    T = float(np.exp(x[6]))
    final = rms(r[:6]) if np.all(np.isfinite(r)) else float('inf')
    return {'q0': q0, 'T': T, 'residualRms': final, 'history': history,
            'rhsEvals': counter.n, 'iterations': len(history) - 1,
            'converged': final < tol}


# -------------------------------------------------------------- diagnostics --
def monodromy(q0, T, nstep_per_third, *, a=A, b=B, d=D, fd=1e-7):
    """The 6 x 6 monodromy of a T-periodic orbit, by finite differences."""
    n = 3 * nstep_per_third
    base = flow(q0, T, n, a=a, b=b, d=d)
    M = np.zeros((6, 6))
    for k in range(6):
        qp = q0.ravel().copy()
        hk = fd * max(1.0, abs(qp[k]))
        qp[k] += hk
        pert = flow(qp.reshape(2, NCELL), T, n, a=a, b=b, d=d)
        M[:, k] = (pert - base).ravel() / hk
    return M


def floquet(q0, T, nstep_per_third, **kw):
    """Floquet multipliers, sorted by decreasing modulus, plus the leading
    non-trivial one (a T-periodic orbit always carries a multiplier 1)."""
    M = monodromy(q0, T, nstep_per_third, **kw)
    mu = np.linalg.eigvals(M)
    order = np.argsort(-np.abs(mu))
    mu = mu[order]
    # drop the multiplier closest to 1: that is the tangent direction
    k = int(np.argmin(np.abs(np.abs(mu) - 1.0)))
    rest = np.delete(mu, k)
    return mu, float(np.max(np.abs(rest))), float(np.abs(mu[k]))


def splay_amplitude(q):
    """|sum_j (q_j - mean) exp(-2 pi i j/3)| / 3, per channel, root-mean-square.

    Zero exactly on an in-phase (synchronised) state; order the pattern
    amplitude on a splay state.  This is the ring's version of "is there a
    pattern on the screen at all".
    """
    z = np.exp(-2j * np.pi * np.arange(NCELL) / NCELL)
    proj = (q @ z) / NCELL
    return float(np.sqrt(np.mean(np.abs(proj) ** 2)))


def sync_amplitude(q, *, a=A, b=B):
    """rms deviation of the cell-mean from the uniform equilibrium."""
    mean = q.mean(axis=1)
    return float(np.sqrt(np.mean((mean - np.array([a, b / a])) ** 2)))


def align_to(q0_ref, T, q_glue, nstep_per_third, *, a=A, b=B, d=D, nscan=2000):
    """Best rms difference between a state and a reference orbit, over one
    period of time shift and the three ring shifts.

    Needed because a self-assembling simulation has no reason to land on the
    same point of the same orbit, only on the orbit.
    """
    n = 3 * nstep_per_third
    _, traj = flow(q0_ref, T, n, a=a, b=b, d=d, trace=True)
    idx = np.linspace(0, n, nscan, endpoint=False).astype(int)
    best = None
    for p in range(NCELL):
        cand = shift(q_glue, p)
        diff = traj[idx] - cand[None, :, :]
        r = np.sqrt(np.mean(diff ** 2, axis=(1, 2)))
        k = int(np.argmin(r))
        if best is None or r[k] < best[0]:
            best = (float(r[k]), p, float(idx[k]) / n * T)

    # The coarse scan only locates the time origin to within T/nscan, which is
    # itself worth about |dq/dt| * T/nscan of apparent field error.  Refine the
    # shift so the number reported is the field difference and not the sampling.
    from scipy.optimize import minimize_scalar
    _, p, t0 = best
    cand = shift(q_glue, p)
    step = T / nscan

    def err(s):
        s = float(np.clip(s, 0.0, T))
        m = max(1, int(round(s / T * n)))
        return rms(flow(q0_ref, s, m, a=a, b=b, d=d) - cand)

    res = minimize_scalar(err, bracket=None, bounds=(max(0.0, t0 - 2 * step),
                                                     min(T, t0 + 2 * step)),
                          method='bounded', options={'xatol': 1e-10})
    if res.fun < best[0]:
        best = (float(res.fun), p, float(res.x))
    return best


# ----------------------------------------------------------- delayed glue ----
class History:
    """A ring buffer of past states with four-point Lagrange interpolation.

    The same object the real delayed-glue simulation needs, at one cell instead
    of 146 representatives.
    """

    def __init__(self, span, h, q_init_fn):
        self.h = h
        self.n = int(np.ceil(span / h)) + 8
        self.buf = np.zeros((self.n, 2))
        self.t0 = -(self.n - 1) * h
        for i in range(self.n):
            self.buf[i] = q_init_fn(self.t0 + i * h)
        self.head = self.n - 1          # index of the newest sample
        self.t_head = 0.0

    def push(self, t, q):
        self.head = (self.head + 1) % self.n
        self.buf[self.head] = q
        self.t_head = t

    def at(self, t):
        """Four-point (cubic) Lagrange interpolation at time t <= t_head."""
        s = (self.t_head - t) / self.h          # samples back from the head
        i0 = int(np.floor(s))
        frac = s - i0
        # nodes at offsets i0-1, i0, i0+1, i0+2 back from the head
        offs = (i0 - 1, i0, i0 + 1, i0 + 2)
        xs = np.array([-1.0, 0.0, 1.0, 2.0])
        ys = np.array([self.buf[(self.head - o) % self.n] for o in offs])
        w = np.ones(4)
        for i in range(4):
            for j in range(4):
                if i != j:
                    w[i] *= (frac - xs[j]) / (xs[i] - xs[j])
        return w @ ys


def delayed_glue(*, T0=None, dt=None, nperiod=60, seed_rng=1, a=A, b=B, d=D,
                 amplitude=0.05, tol=1e-9, update_per_period=1, verbose=False,
                 seed_kind='noise'):
    """Simulate ONE cell whose two neighbours are its own past copies.

    The neighbours of cell 0 are q(t - T/3) and q(t - 2T/3); the delay starts at
    the Hopf period, the only number available before anything is computed, and
    is corrected once per period by one Newton step on a phase condition,

        dT = <q(t - T) - q(t), q'(t)> / <q'(t), q'(t)> ,   T <- T + dT .

    ``seed_kind`` is 'noise' (white noise about the equilibrium over the whole
    history window) or 'analytic' (the pencil seed's own cell-0 trace).
    """
    _, e, omega, T_hopf = hopf_data(a=a, b=b)
    T = float(T_hopf if T0 is None else T0)
    q_eq = np.array([a, b / a])
    rng = np.random.default_rng(seed_rng)
    if dt is None:
        dt = T_hopf / 3.0 / 1200.0

    span = T * 1.3          # the buffer must cover t - T even after the delay grows
    if seed_kind == 'noise':
        nsamp = int(np.ceil(span / dt)) + 8
        noise = q_eq[None, :] + amplitude * rng.standard_normal((nsamp, 2))
        def init(t):
            i = int(round((t - (-(nsamp - 1) * dt)) / dt))
            return noise[min(max(i, 0), nsamp - 1)]
    else:
        def init(t):
            return q_eq + amplitude * np.real(e * np.exp(1j * omega * t))

    hist = History(span, dt, init)
    q = hist.buf[hist.head].copy()
    t = 0.0
    record = []
    counter = Counter()

    def field(tq, qq):
        n1 = hist.at(tq - T / 3.0)
        n2 = hist.at(tq - 2.0 * T / 3.0)
        counter.add(1)
        return rhs_free(qq, n1 + n2, a=a, b=b, d=d)

    next_update = T
    prev_T = T
    while True:
        # one RK4 step; the delayed neighbours are read at the stage times
        k1 = field(t, q)
        k2 = field(t + 0.5 * dt, q + 0.5 * dt * k1)
        k3 = field(t + 0.5 * dt, q + 0.5 * dt * k2)
        k4 = field(t + dt, q + dt * k3)
        q = q + (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4)
        t += dt
        hist.push(t, q)

        if t >= next_update:
            qdot = field(t, q)
            qlag = hist.at(t - T)
            mism = qlag - q
            denom = float(qdot @ qdot)
            dT = float(mism @ qdot) / denom if denom > 0 else 0.0
            shape = float(np.sqrt(np.mean((mism - (float(mism @ qdot) / denom) * qdot) ** 2)))
            record.append({'t': t, 'T': T, 'dT': dT,
                           'shapeError': shape,
                           'mismatch': float(np.sqrt(np.mean(mism ** 2))),
                           'amplitude': float(np.sqrt(np.mean((q - q_eq) ** 2))),
                           'rhsEvals': counter.n})
            T = T + dT
            next_update = t + T / update_per_period
            if verbose:
                print(f"t {t:8.3f}  T {T:.12f}  dT {dT:+.3e}  shape {shape:.3e}")
            if abs(dT) < tol and shape < tol and len(record) > 5:
                break
            if len(record) >= nperiod:
                break
            prev_T = T

    return {'T': T, 'q': q, 'record': record, 'dt': dt,
            'rhsEvals': counter.n, 'periods': len(record),
            'history': hist, 't': t}


def glue_to_ring(glue, *, nstep_per_third=1200):
    """Rebuild the three-cell state from the single delayed cell.

    Cell 1 is cell 0 delayed by T/3 and cell 2 by 2T/3, which is the whole
    content of the glue: q_1(t) = q_0(t - T/3), q_2(t) = q_0(t - 2T/3).
    """
    hist, T, t = glue['history'], glue['T'], glue['t']
    cols = [hist.at(t - k * T / 3.0) for k in range(NCELL)]
    return np.stack(cols, axis=1)
