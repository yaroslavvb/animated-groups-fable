"""Delayed-glue simulation of a clockwork orbit on the wallpaper orbifold.

Idea under test
---------------
The catalog's convention is ``q(M x + v, t + tau_g T) = q(x, t)``.  Read node-wise, with
``y = g x``,

    q(y, t) = q(g^{-1} y, t - tau_g T),

i.e. the value across a glued edge of the fundamental domain is the value of the
representative node *in the past*.  So a clockwork symmetry can be imposed step by step, as
long as the glue reads a history buffer: a delay-differential equation on the fundamental
domain.  The period ``T`` enters only as the delay; it is tuned by an outer loop that
measures the realised period of the settled state.

Implementation: the state lives on the whole ``N x N`` torus, but only the
``n_rep`` orbit representatives are integrated.  Every other node is overwritten at every
RK4 stage — instantaneously for the ``tau = 0`` operations (ordinary spatial gluing) and
from the history buffer for the ``tau = 1/3, 2/3`` ones.  The right-hand side is the
repository's own (``lab.brusselator_rhs`` -> ``rdlab.rhs_brusselator``), so the cost
counters in ``lab`` see every evaluation.
"""
from __future__ import annotations

import bisect
import math
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lab  # noqa: E402
import rdlab  # noqa: E402


# --------------------------------------------------------------------- glue


class Glue:
    """Orbit representatives and the delayed/instantaneous copy maps for one entry."""

    def __init__(self, entry: lab.Entry, N: int):
        ch = lab.character(entry, N)
        maps = np.array([np.asarray(m, np.int64) for m in ch.maps])   # (nops, N*N)
        taus = np.asarray(ch.taus, float)
        self.entry, self.N = entry, int(N)
        self.m = int(entry.m)
        n = N * N
        # orbit label = smallest flat index in the orbit (orbits are group-closed)
        labels = maps.min(axis=0)
        reps = np.unique(labels)
        self.labels = labels
        self.reps = reps                        # flat indices of the representatives
        self.n_rep = int(reps.size)
        pos = np.full(n, -1, np.int64)
        pos[reps] = np.arange(self.n_rep)
        self.rep_pos = pos                      # flat index -> position in the rep vector

        # for every non-representative node pick one operation that reaches it from its
        # representative, preferring the smallest time offset (tau = 0 first).
        assigned = np.zeros(n, bool)
        assigned[reps] = True                   # representatives are integrated, never copied
        src = np.full(n, -1, np.int64)
        kidx = np.full(n, -1, np.int64)         # delay index k, delay = k*T/m
        order = np.argsort(np.round(taus * self.m).astype(int), kind='stable')
        for g in order:
            k = int(round(taus[g] * self.m)) % self.m
            tgt = maps[g][reps]                 # image of every representative under g
            fresh = ~assigned[tgt]
            src[tgt[fresh]] = reps[fresh]
            kidx[tgt[fresh]] = k
            assigned[tgt[fresh]] = True
        if not assigned.all():
            raise RuntimeError('some nodes are not reachable from a representative')
        self.copy_src, self.copy_k = src, kidx

        self.inst_tgt = np.flatnonzero(kidx == 0)
        self.inst_src = src[self.inst_tgt]
        self.delayed = []                       # [(k, tgt, src_position_in_rep_vector)]
        for k in range(1, self.m):
            tgt = np.flatnonzero(kidx == k)
            self.delayed.append((k, tgt, pos[src[tgt]]))

        # redundant relations: (g, x) pairs not used by the glue.  They are consequences of
        # the ones that are imposed only on a genuine solution, so their residual is a
        # convergence diagnostic (and at the cone points they are the statement that the
        # field there has period T/m).
        self.relations = [(int(g), int(round(taus[g] * self.m)) % self.m, maps[g])
                          for g in range(len(ch.maps))]
        self.n_relations = sum(int((maps[g] != np.arange(n)).sum() > 0) for g in range(len(ch.maps)))

    # ---- glue application -------------------------------------------------
    def fill(self, flat: np.ndarray, t: float, hist: 'History', T: float) -> np.ndarray:
        """``flat`` is (C, N*N); overwrite every non-representative node.  In place."""
        flat[:, self.inst_tgt] = flat[:, self.inst_src]
        for k, tgt, srcpos in self.delayed:
            past = hist.sample(t - k * T / self.m)
            flat[:, tgt] = past[:, srcpos]
        return flat

    def take(self, flat: np.ndarray) -> np.ndarray:
        """Representative values, (C, n_rep)."""
        return flat[:, self.reps].copy()

    def summary(self) -> dict:
        return dict(nodes=self.N * self.N, representatives=self.n_rep,
                    reductionFactor=self.N * self.N / self.n_rep,
                    instantaneousCopies=int(self.inst_tgt.size),
                    delayedCopies=[int(t.size) for _, t, _ in self.delayed],
                    delays=[f'{k}T/{self.m}' for k, _, _ in self.delayed])


# ------------------------------------------------------------------ history


class History:
    """Absolute-time buffer of representative values with 4-point Lagrange sampling."""

    def __init__(self, span: float, n_channel: int, n_rep: int):
        self.span = float(span)
        self.times: list[float] = []
        self.vals: list[np.ndarray] = []
        self.shape = (n_channel, n_rep)
        self.samples = 0

    def push(self, t: float, v: np.ndarray):
        t = float(t)
        if self.times and t <= self.times[-1] + 1e-12 * max(1.0, abs(t)):
            self.times[-1] = t                      # duplicate / non-advancing time: replace
            self.vals[-1] = np.asarray(v, float)
            return
        self.times.append(t)
        self.vals.append(np.asarray(v, float))
        if len(self.times) > 64 and self.times[0] < t - self.span:
            cut = bisect.bisect_left(self.times, t - self.span) - 4
            if cut > 0:
                del self.times[:cut]
                del self.vals[:cut]

    def prefill(self, func, t0: float, dt: float, span: float | None = None):
        """Fill ``[t0 - span, t0]`` (inclusive) at spacing ``dt`` from ``func(t) -> (C,n_rep)``."""
        span = self.span if span is None else span
        steps = int(math.ceil(span / dt)) + 4
        for i in range(steps, -1, -1):
            t = t0 - i * dt
            self.push(t, func(t))

    def sample(self, t: float) -> np.ndarray:
        self.samples += 1
        times, vals = self.times, self.vals
        if t <= times[0]:
            return vals[0]
        if t >= times[-1]:
            return vals[-1]
        j = bisect.bisect_left(times, t)
        if times[j] == t:
            return vals[j]
        i0 = min(max(j - 2, 0), len(times) - 4)
        ts = times[i0:i0 + 4]
        w = np.empty(4)
        for a in range(4):
            num = 1.0
            den = 1.0
            for b in range(4):
                if a != b:
                    num *= (t - ts[b])
                    den *= (ts[a] - ts[b])
            w[a] = num / den
        out = w[0] * vals[i0]
        for a in range(1, 4):
            out = out + w[a] * vals[i0 + a]
        return out


# ----------------------------------------------------------------- the run


def _rhs(flat, params, lattice, h, N):
    return rdlab.rhs_brusselator(flat.reshape(-1, N, N), params, lattice, h).reshape(flat.shape)


def run_dde(entry, params, T0, initial, history_func=None, *, N=36, L=40.0,
            steps_per_third=112, time_units=200.0, adapt_every=1.0, relax=1.0,
            adapt_after=1.0, snapshot_every=None, diag_every=0.25, glue=None,
            Tfixed=False, reference=None, progress=None):
    """Integrate the delayed-glue DDE, adapting the delay ``T``.

    ``initial``      (C,N,N) state at ``t = 0``.
    ``history_func`` ``t -> (C,N,N)`` for ``t <= 0``; defaults to the frozen initial state.
    ``adapt_every``  how often (in units of the current ``T``) to re-measure the period.
    ``relax``        ``T <- T + relax * (T' - T)``.
    ``reference``    optional ``dict(frames=..., period=...)`` to track the distance to.

    Returns a dict with the trajectory diagnostics, the final state and the delay history.
    """
    lattice, h = entry.lattice, L / N
    glue = glue or Glue(entry, N)
    C = initial.shape[0]
    T = float(T0)
    dt = T / (entry.m * steps_per_third)
    span = 1.30 * T                      # covers the 2T/3 delay and the one-period lookback
    hist = History(span, C, glue.n_rep)

    flat = np.asarray(initial, float).reshape(C, -1).copy()
    if history_func is None:
        base = glue.take(flat)
        hist.prefill(lambda t: base, 0.0, dt)
    else:
        hist.prefill(lambda t: glue.take(np.asarray(history_func(t), float).reshape(C, -1)),
                     0.0, dt)
    flat = glue.fill(flat, 0.0, hist, T)
    hist.push(0.0, glue.take(flat))

    t = 0.0
    t0 = time.perf_counter()
    diag = []
    delays = [dict(t=0.0, T=T, source='initial')]
    snaps = []
    snap_t = []
    snap_T = []
    next_snap = 0.0
    next_diag = 0.0
    next_adapt = adapt_after * T
    amp_ref = None

    while t < time_units - 1e-12:
        # ---- one RK4 step of the delay-differential equation
        q1 = flat
        k1 = _rhs(q1, params, lattice, h, N)
        q2 = glue.fill(q1 + 0.5 * dt * k1, t + 0.5 * dt, hist, T)
        k2 = _rhs(q2, params, lattice, h, N)
        q3 = glue.fill(q1 + 0.5 * dt * k2, t + 0.5 * dt, hist, T)
        k3 = _rhs(q3, params, lattice, h, N)
        q4 = glue.fill(q1 + dt * k3, t + dt, hist, T)
        k4 = _rhs(q4, params, lattice, h, N)
        nxt = q1 + (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4)
        t += dt
        flat = glue.fill(nxt, t, hist, T)
        hist.push(t, glue.take(flat))
        if not np.isfinite(flat).all():
            diag.append(dict(t=t, blown=True))
            break

        # ---- diagnostics
        if t >= next_diag - 1e-12:
            next_diag += diag_every * T
            rep = glue.take(flat)
            dq = glue.take(_rhs(flat, params, lattice, h, N))
            row = dict(t=t, T=T, uMin=float(flat[0].min()), uMax=float(flat[0].max()),
                       spatialRms=float(np.sqrt(np.mean((flat[0] - flat[0].mean()) ** 2))),
                       speed=float(np.linalg.norm(dq)))
            if t > T + 2 * dt:
                prev = hist.sample(t - T)
                delta = prev - rep                      # ~ (T' - T) * dq
                nn = float(np.dot(dq.ravel(), dq.ravel()))
                shift = float(np.dot(delta.ravel(), dq.ravel()) / nn) if nn > 0 else 0.0
                resid = delta - shift * dq
                row.update(periodEstimate=T + shift,
                           driftRms=float(np.sqrt(np.mean(delta ** 2))),
                           shapeRms=float(np.sqrt(np.mean(resid ** 2))),
                           phaseShift=shift)
            if reference is not None:
                row['referenceRms'] = _reference_distance(flat.reshape(C, N, N), t, reference,
                                                          entry)
            diag.append(row)
            if progress:
                progress(row)

        # ---- outer delay update
        if (not Tfixed) and t >= next_adapt - 1e-12:
            next_adapt += adapt_every * T
            rep = glue.take(flat)
            dq = glue.take(_rhs(flat, params, lattice, h, N))
            prev = hist.sample(t - T)
            nn = float(np.dot(dq.ravel(), dq.ravel()))
            shift = float(np.dot((prev - rep).ravel(), dq.ravel()) / nn) if nn > 0 else 0.0
            Tnew = T + relax * shift
            Tnew = float(min(max(Tnew, 0.5 * T0), 2.0 * T0))
            delays.append(dict(t=t, T=Tnew, previous=T, measured=T + shift,
                               driftRms=float(np.sqrt(np.mean((prev - rep) ** 2)))))
            T = Tnew
            dt = T / (entry.m * steps_per_third)
            hist.span = 1.30 * T

        # ---- snapshots for the movie
        if snapshot_every and t >= next_snap - 1e-12:
            next_snap += snapshot_every
            snaps.append(flat.reshape(C, N, N).copy())
            snap_t.append(t)
            snap_T.append(T)

    wall = time.perf_counter() - t0
    return dict(q=flat.reshape(C, N, N).copy(), T=T, t=t, diagnostics=diag, delays=delays,
                snapshots=(np.array(snaps) if snaps else None), snapshotTimes=snap_t,
                snapshotDelays=snap_T,
                wallSeconds=wall, glue=glue.summary(), historySamples=hist.samples,
                dt=dt, stepsPerThird=steps_per_third, history=hist)


def _reference_distance(q, t, reference, entry):
    """min over the reference orbit's frames of the rms difference (crude phase alignment)."""
    frames, period = reference['frames'], reference['period']
    M = frames.shape[0]
    idx = int(round((t % period) / period * M)) % M
    best = float('inf')
    for d in range(-1, 2):
        diff = q - frames[(idx + d) % M]
        best = min(best, float(np.sqrt(np.mean(diff ** 2))))
    return best


# ------------------------------------------------- periodic reference helpers


def trajectory_history(q0, T, entry, params, N=36, L=40.0, steps_per_third=112):
    """Integrate one period of a known orbit at the DDE step and return a history function.

    Returns ``func(t) -> (C,N,N)``, exact (to RK4) and T-periodic, for use as ``history_func``.
    """
    steps = entry.m * steps_per_third
    dt = T / steps
    states = [np.asarray(q0, float)]
    q = np.asarray(q0, float)
    for _ in range(steps):
        q = lab.flow(q, dt, params, entry, L=L, N=N, steps=1)
        states.append(q)
    states = np.array(states)                       # (steps+1, C, N, N), t = 0 .. T

    def func(t):
        s = (t % T) / dt
        i = int(math.floor(s))
        f = s - i
        a, b = states[i % steps], states[(i + 1) % steps]
        return (1 - f) * a + f * b

    return func, states, dt


def analytic_seed_history(entry, N, L, amplitude, shell=1, sign=1, params=None):
    """Near-Hopf three-wave family ``q0 + A Re(e^{2 pi i t / T0} psi e_Hopf)``.

    Returns ``(func, seed, info)`` with ``func(t)`` the analytic state and ``seed = func(0)``.
    The sign of the time factor matters: with ``e^{+2 pi i t/T}`` the first harmonic is
    ``psi/2``, which carries the character ``psi(gx) = e^{-2 pi i tau} psi(x)`` the law
    demands; with the conjugate it would carry the wrong one.
    """
    base = lab.character_star_seed(entry, N=N, L=L, shell=shell, sign=sign,
                                   amplitude=amplitude, params=params)
    T0 = base['T0']
    psi, e_hopf, q0 = base['psi'], base['e_hopf'], base['q0']
    direction = np.real(psi[None, :, :] * e_hopf[:, None, None])
    norm = float(np.sqrt(np.mean(direction ** 2)))

    def func(t):
        field = np.real(psi[None, :, :] * np.exp(2j * np.pi * t / T0) * e_hopf[:, None, None])
        return q0[:, None, None] + amplitude * field / norm

    return func, func(0.0), base
