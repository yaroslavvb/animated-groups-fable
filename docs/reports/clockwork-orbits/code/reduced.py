"""The same delayed-glue DDE, but the right-hand side is evaluated ONLY on the 146
orbit representatives -- SymSim's fundamental domain with glued (and time-delayed) edges.

This is the version that actually saves work: one RK4 stage touches 146 nodes per channel
instead of 1296, and the only extra information it needs is two reads from the history
buffer (the values across the ``tau = T/3`` and ``tau = 2T/3`` edges).

The stencil is the repository's own triangular six-neighbour Laplacian
(``rdlab._laplacian``: neighbours ``(x+-1,y), (x,y+-1), (x+1,y+1), (x-1,y-1)`` with factor
``2/(3 h^2)``) and the reaction terms are ``rdlab.rhs_brusselator``'s, written out node-wise.
``test_matches_full()`` checks the two implementations agree.
"""
from __future__ import annotations

import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lab       # noqa: E402
import dde       # noqa: E402

OFFSETS = [(-1, 0), (1, 0), (0, -1), (0, 1), (1, 1), (-1, -1)]

COUNT = dict(rhs_calls=0, node_evals=0)


class ReducedRHS:
    """Brusselator right-hand side on the representatives only."""

    def __init__(self, glue: dde.Glue, params: dict, L: float):
        self.glue, self.params = glue, params
        N = glue.N
        self.N, self.h = N, L / N
        n = N * N
        src_rep = np.where(glue.rep_pos >= 0, np.arange(n), glue.copy_src)
        kk = np.where(glue.rep_pos >= 0, 0, glue.copy_k)
        srcpos_node = glue.rep_pos[src_rep]                    # node -> rep position of source
        reps = glue.reps
        i = reps % N
        j = reps // N
        self.gather = []                                       # [(k, targets, sources)]
        for dx, dy in OFFSETS:
            nb = ((j + dy) % N) * N + (i + dx) % N
            for k in range(glue.m):
                sel = np.flatnonzero(kk[nb] == k)
                if sel.size:
                    self.gather.append((k, sel, srcpos_node[nb[sel]]))
        self.n_rep = glue.n_rep

    def __call__(self, x, t, hist, T):
        COUNT['rhs_calls'] += 1
        COUNT['node_evals'] += self.n_rep
        past = {k: hist.sample(t - k * T / self.glue.m) for k in range(1, self.glue.m)}
        s = np.zeros_like(x)
        for k, tgt, src in self.gather:
            s[:, tgt] += (x if k == 0 else past[k])[:, src]
        lap = (s - 6.0 * x) * (2.0 / (3.0 * self.h * self.h))
        p = self.params
        u, v = x[0], x[1]
        r = u * u * v
        return np.stack([p['Du'] * lap[0] + p['a'] - (p['b'] + 1) * u + r,
                         p['Dv'] * lap[1] + p['b'] * u - r])

    def expand(self, x, t, hist, T):
        """Rebuild the full (C, N, N) torus field from the representative vector."""
        g = self.glue
        flat = np.empty((x.shape[0], self.N * self.N))
        flat[:, g.reps] = x
        flat[:, g.inst_tgt] = x[:, g.rep_pos[g.inst_src]]
        for k, tgt, srcpos in g.delayed:
            flat[:, tgt] = hist.sample(t - k * T / g.m)[:, srcpos]
        return flat.reshape(x.shape[0], self.N, self.N)


def run_reduced(entry, params, T0, initial, history_func=None, *, N=36, L=40.0,
                steps_per_third=112, time_units=100.0, adapt_every=1.0, relax=1.0,
                adapt_after=1.0, glue=None, Tfixed=False, diag_every=0.25):
    glue = glue or dde.Glue(entry, N)
    f = ReducedRHS(glue, params, L)
    T = float(T0)
    dt = T / (entry.m * steps_per_third)
    hist = dde.History(1.30 * T, initial.shape[0], glue.n_rep)
    x = glue.take(np.asarray(initial, float).reshape(initial.shape[0], -1))
    if history_func is None:
        hist.prefill(lambda tt: x, 0.0, dt)
    else:
        hist.prefill(lambda tt: glue.take(np.asarray(history_func(tt), float)
                                          .reshape(initial.shape[0], -1)), 0.0, dt)
    hist.push(0.0, x)
    t = 0.0
    t0 = time.perf_counter()
    diag, delays = [], [dict(t=0.0, T=T)]
    next_diag, next_adapt = 0.0, adapt_after * T
    while t < time_units - 1e-12:
        k1 = f(x, t, hist, T)
        k2 = f(x + 0.5 * dt * k1, t + 0.5 * dt, hist, T)
        k3 = f(x + 0.5 * dt * k2, t + 0.5 * dt, hist, T)
        k4 = f(x + dt * k3, t + dt, hist, T)
        x = x + (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4)
        t += dt
        hist.push(t, x)
        if t >= next_diag - 1e-12:
            next_diag += diag_every * T
            row = dict(t=t, T=T, uMax=float(x[0].max()),
                       spatialRms=float(np.sqrt(np.mean((x[0] - x[0].mean()) ** 2))))
            if t > T + 2 * dt:
                dq = f(x, t, hist, T)
                nn = float(np.dot(dq.ravel(), dq.ravel()))
                delta = hist.sample(t - T) - x
                shift = float(np.dot(delta.ravel(), dq.ravel()) / nn) if nn else 0.0
                row.update(periodEstimate=T + shift,
                           driftRms=float(np.sqrt(np.mean(delta ** 2))))
            diag.append(row)
        if (not Tfixed) and t >= next_adapt - 1e-12:
            next_adapt += adapt_every * T
            dq = f(x, t, hist, T)
            nn = float(np.dot(dq.ravel(), dq.ravel()))
            delta = hist.sample(t - T) - x
            shift = float(np.dot(delta.ravel(), dq.ravel()) / nn) if nn else 0.0
            T = float(min(max(T + relax * shift, 0.5 * T0), 2.0 * T0))
            dt = T / (entry.m * steps_per_third)
            hist.span = 1.30 * T
            delays.append(dict(t=t, T=T))
    return dict(x=x, q=f.expand(x, t, hist, T), T=T, t=t, diagnostics=diag, delays=delays,
                wallSeconds=time.perf_counter() - t0, rhs=f, history=hist)


def test_matches_full(periods=3.0):
    """Reduced and full-torus DDE must produce the same trajectory."""
    entry = lab.load_entry('g227')
    params = lab.brusselator_params(a=1.0, b=2.3)
    rec = lab.load_published()
    Tp = rec['period']
    glue = dde.Glue(entry, 36)
    hfunc, _, _ = dde.trajectory_history(rec['frames'][0], Tp, entry, params)
    COUNT.update(rhs_calls=0, node_evals=0)
    before = lab.counters()
    red = run_reduced(entry, params, Tp, rec['frames'][0], history_func=hfunc,
                      time_units=periods * Tp, Tfixed=True, glue=glue)
    red_cost = dict(COUNT)
    full = dde.run_dde(entry, params, Tp, rec['frames'][0], history_func=hfunc,
                       time_units=periods * Tp, Tfixed=True, glue=glue)
    full_cost = {k: lab.counters()[k] - before[k] for k in ('rhs_calls', 'rhs_node_evals')}
    diff = np.abs(red['q'] - full['q'])
    return dict(maxDifference=float(diff.max()),
                rmsDifference=float(np.sqrt(np.mean((red['q'] - full['q']) ** 2))),
                reducedWallSeconds=red['wallSeconds'], fullWallSeconds=full['wallSeconds'],
                reducedRhsCalls=red_cost['rhs_calls'], reducedNodeEvals=red_cost['node_evals'],
                fullRhsCalls=full_cost['rhs_calls'], fullNodeEvals=full_cost['rhs_node_evals'],
                nodeEvalRatio=full_cost['rhs_node_evals'] / max(red_cost['node_evals'], 1),
                periods=periods, representatives=glue.n_rep, nodes=36 * 36)


if __name__ == '__main__':
    import json
    out = test_matches_full()
    print(json.dumps(out, indent=1))
