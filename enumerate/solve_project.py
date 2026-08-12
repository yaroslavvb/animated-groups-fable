#!/usr/bin/env python3
"""Clockwork-group looping animation by constrained least squares (Strategy C).

The motif is n balls on CLOSED POLYLINES in the lattice cell of a clockwork group
(here g226 = 3_1 3_1 3_1, projection p3).  Ball i starts at a pinned s_i and drifts
by an integer lattice vector L_i per period, so p_i(t + 1) = p_i(t) + L_i and the
whole orbit fill is exactly periodic.  A clone (M, v, tau) shows the motif at
internal time t - tau, so a bounce between a ball and its own rotated copy is an
event that has to be consistent with itself a third of a period earlier -- the
trajectory cannot be integrated forward, it has to be solved as a whole.

Unknowns
    X[i, m], m = 1 .. K-1 : the interior breakpoints of ball i's polyline.
    X[i, 0] = s_i is pinned and X[i, K] = s_i + L_i is forced, so the solver can
    only BEND a path, never slide it out of the way.

Objective
    E(X) = bend * sum |X[m+1] - 2 X[m] + X[m-1]|^2                (discrete bending,
                                                                   zero on the
                                                                   ballistic line)
         + w    * sum hinge(d_target - d(pair))^2                 (soft separation)

    minimised by L-BFGS with an analytic gradient, under a continuation schedule
    w = 1e2 ... 1e6.  Because the bending term vanishes exactly on the straight
    ballistic path, every kink in the answer is one the geometry paid for.

Exactness in time
    Breakpoints sit on sample indices and every tau is an exact whole number of
    samples (S divisible by 3), so between two consecutive samples BOTH a ball and
    every clone move linearly.  The separation of a pair on one sample interval is
    therefore min_{u in [0,1]} |a + u b|, available in closed form; its clipped
    minimiser makes the distance C^1 in the unknowns, so the reported clearance is
    the true continuous-time minimum, not a sampled proxy, and the gradient is
    exact by the envelope theorem.

Sparsifying the kinks
    A plain bending minimiser spreads a little curvature over every breakpoint.
    Two extra stages fix that: iteratively reweighted bending (w_m ~ 1/|kink_m|^2)
    drives unneeded kinks toward zero, then a linear projection snaps them to
    EXACTLY zero (three collinear, evenly spaced breakpoints), which is what makes
    long straight runs show up as straight to machine precision.

Run:  python3 solve_project.py            # tiny benchmark
      python3 solve_project.py --full     # n=5, S=180, + 60 rendered frames
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from particles_gif import Group  # noqa: E402  (read-only import, file untouched)

try:
    from scipy.optimize import minimize as _scipy_minimize
    HAVE_SCIPY = True
except Exception:                                    # pragma: no cover
    HAVE_SCIPY = False


# --------------------------------------------------------------------------- #
#  the solver
# --------------------------------------------------------------------------- #
class PolylineSolver:
    """Closed polyline trajectories for a clockwork group, by penalty least squares."""

    def __init__(self, gid, starts, drifts, S=72, K=6, radius=0.075, margin=1.05,
                 span_solve=3, span_check=4, bend=1.0, anchor=0.0,
                 cull_slack=0.45, jitter=2e-3, seed=0):
        self.g = Group(gid)
        self.B = self.g.B
        self.starts = np.asarray(starts, dtype=float)
        self.L = np.asarray(drifts, dtype=float)
        self.n = self.starts.shape[0]
        if S % 3:
            raise ValueError("S must be divisible by 3 so every tau is a whole sample")
        if S % K:
            raise ValueError("K must divide S so breakpoints land on sample indices")
        self.S, self.K = S, K
        self.radius, self.margin = radius, margin
        self.d_req = 2.0 * radius                 # hard: no overlap
        self.d_tgt = 2.0 * radius * margin        # what the penalty aims for
        self.bend, self.anchor = bend, anchor
        self.span_solve, self.span_check = span_solve, span_check
        self.cull_slack = cull_slack

        self._build_interp()
        self._build_bending()
        self._build_ops()
        self.set_clones(self.span_solve)

        # ballistic start, with a whisker of jitter so a head-on approach is not a
        # symmetric saddle of the penalty
        rng = np.random.default_rng(seed)
        self.Xf0 = self._ballistic()
        Xf = self.Xf0.copy()
        Xf[:, 1:self.K, :] += jitter * rng.standard_normal((self.n, self.K - 1, 2))
        self.Xf = Xf

    # ---------------------------------------------------------------- geometry
    def _ballistic(self):
        """straight constant-velocity path: X[m] = s + (m/K) L."""
        frac = np.arange(self.K + 1)[None, :, None] / self.K
        return self.starts[:, None, :] + frac * self.L[:, None, :]

    def _build_interp(self):
        """A: (S+1, K+1) mapping breakpoints -> sample positions at s = 0 .. S."""
        S, K = self.S, self.K
        step = S // K
        A = np.zeros((S + 1, K + 1))
        for s in range(S + 1):
            m, r = divmod(s, step)
            if m == K:                       # the closing sample is the last knot
                m, r = K - 1, step
            A[s, m] = 1.0 - r / step
            A[s, m + 1] = r / step
        self.A = A

    def _build_bending(self):
        """C2: (K, K+1) with  kink_m = C2 @ Xf + const,  const = -L on row 0.

        Row 0 needs the previous period's last knot, X[-1] = X[K-1] - L; row K-1
        uses the closing knot X[K] = X[0] + L.  The ballistic path kills every row.
        """
        K = self.K
        C2 = np.zeros((K, K + 1))
        for m in range(K):
            C2[m, m] += -2.0
            C2[m, m + 1] += 1.0
            C2[m, m - 1 if m > 0 else K - 1] += 1.0
        self.C2 = C2
        const = np.zeros((self.n, K, 2))
        const[:, 0, :] = -self.L                       # from X[-1] = X[K-1] - L
        self.bend_const = const

    def _build_ops(self):
        """Per group op: the sample shift and the index/period maps it induces."""
        S = self.S
        self.opM = np.array([M for M, _, _ in self.g.ops])          # (O, 2, 2)
        self.opv = np.array([v for _, v, _ in self.g.ops])          # (O, 2)
        self.opsh = np.array([int(round(tau * S)) % S for _, _, tau in self.g.ops])
        sidx = np.arange(S + 1)
        m = sidx[None, :] - self.opsh[:, None]
        self.opidx = m % S                                          # (O, S+1)
        self.opk = (m - self.opidx) // S                            # (O, S+1)
        # which op is the identity (M = I, v = 0, tau = 0)?
        self.id_op = int(np.argmin([abs(t) for _, _, t in self.g.ops]))

    def set_clones(self, span, keep=None):
        """clone list = ops x lattice translations in [-span, span]^2 (g.clones)."""
        rows = []
        for oi in range(len(self.g.ops)):
            for a in range(-span, span + 1):
                for b in range(-span, span + 1):
                    rows.append((oi, a, b))
        rows = [r for r in rows if keep is None or r in keep]
        self.c_op = np.array([r[0] for r in rows])
        self.c_w = np.array([[r[1], r[2]] for r in rows], dtype=float)
        self.c_rows = rows
        self.c_wcart = self.c_w @ self.B
        # self-pair mask: only the identity op with zero translation is "myself"
        ok = np.ones((len(rows), self.n, self.n), dtype=bool)
        for c, (oi, a, b) in enumerate(rows):
            if oi == self.id_op and a == 0 and b == 0 and not self.opv[oi].any():
                ok[c][np.diag_indices(self.n)] = False
        self.pair_ok = ok
        self.op_sel = [np.where(self.c_op == o)[0] for o in range(len(self.g.ops))]

    # ---------------------------------------------------------------- forward
    def positions(self, Xf):
        """sample positions, lattice and cartesian, at s = 0 .. S (S closes the loop)."""
        P_ext = np.einsum('sm,imd->isd', self.A, Xf)          # (n, S+1, 2)
        return P_ext, P_ext @ self.B

    def clone_cart(self, P_ext):
        """cartesian position of every clone-ball at every sample: (C, n, S+1, 2)."""
        P = P_ext[:, :self.S, :]
        per_op = np.empty((len(self.g.ops), self.n, self.S + 1, 2))
        for o in range(len(self.g.ops)):
            Ps = P[:, self.opidx[o], :] + self.opk[o][None, :, None] * self.L[:, None, :]
            per_op[o] = (Ps @ self.opM[o].T + self.opv[o]) @ self.B
        return per_op[self.c_op] + self.c_wcart[:, None, None, :]

    def _pair_dist(self, Xf):
        """exact continuous-time separation on every sample interval.

        Returns (d, Dm, u, Pcart, Qc) with d of shape (C, n_i, n_j, S) -- the true
        minimum over each interval, since both endpoints move linearly on it.
        """
        S = self.S
        P_ext, Pcart = self.positions(Xf)
        Qc = self.clone_cart(P_ext)
        D = Pcart[None, :, None, :, :] - Qc[:, None, :, :, :]     # (C,n,n,S+1,2)
        a = D[..., :S, :]
        b = D[..., 1:, :] - a
        b2 = (b * b).sum(-1)
        ab = (a * b).sum(-1)
        u = np.clip(np.where(b2 > 1e-18, -ab / np.where(b2 > 1e-18, b2, 1.0), 0.0), 0.0, 1.0)
        Dm = a + u[..., None] * b
        d = np.sqrt((Dm * Dm).sum(-1))
        return d, Dm, u, P_ext, Pcart, Qc

    # ---------------------------------------------------------------- energy
    def energy(self, y, w_pen, bend_w):
        """E and dE/dy for the free interior breakpoints y = X[:, 1:K, :]."""
        n, S, K = self.n, self.S, self.K
        Xf = self.Xf0.copy()
        Xf[:, 0, :] = self.starts
        Xf[:, K, :] = self.starts + self.L
        Xf[:, 1:K, :] = y.reshape(n, K - 1, 2)

        d, Dm, u, P_ext, Pcart, Qc = self._pair_dist(Xf)
        ok = self.pair_ok[..., None]                     # (C,n,n,1) -> broadcast on S
        viol = np.where(ok, self.d_tgt - d, -1.0)
        act = viol > 0.0
        E = 0.5 * w_pen * float((viol[act] ** 2).sum())

        # dE/dDm  (envelope theorem: u* held fixed)
        coef = np.where(act, -w_pen * viol, 0.0) / np.maximum(d, 1e-12)
        gDm = coef[..., None] * Dm
        gD = np.zeros_like(Dm, shape=Dm.shape[:-2] + (S + 1, 2))
        gD[..., :S, :] += (1.0 - u)[..., None] * gDm
        gD[..., 1:, :] += u[..., None] * gDm

        gPcart = gD.sum(axis=(0, 2))                      # (n, S+1, 2)
        gQc = -gD.sum(axis=1)                             # (C, n, S+1, 2)

        gP = np.zeros((n, S, 2))
        for o in range(len(self.g.ops)):
            sel = self.op_sel[o]
            if sel.size == 0:
                continue
            gQ = gQc[sel].sum(axis=0)                     # (n, S+1, 2) cartesian
            gPs = (gQ @ self.B.T) @ self.opM[o]           # -> d/d Pshift
            gP += np.roll(gPs[:, :S, :], -self.opsh[o], axis=1)
            gP[:, (S - self.opsh[o]) % S, :] += gPs[:, S, :]

        gP_ext = gPcart @ self.B.T
        gP_ext[:, :S, :] += gP
        gXf = np.einsum('sm,isd->imd', self.A, gP_ext)

        # bending (in cartesian, so it is isotropic on the hexagonal lattice)
        kink = np.einsum('mk,ikd->imd', self.C2, Xf) + self.bend_const
        kc = kink @ self.B
        bw = bend_w if np.ndim(bend_w) else np.full((n, K), float(bend_w))
        E += 0.5 * float((bw[..., None] * kc ** 2).sum())
        gXf += np.einsum('mk,imd->ikd', self.C2, (bw[..., None] * kc) @ self.B.T)

        if self.anchor:
            dev = (Xf - self.Xf0) @ self.B
            E += 0.5 * self.anchor * float((dev ** 2).sum())
            gXf += self.anchor * (dev @ self.B.T)

        return E, gXf[:, 1:K, :].ravel()

    # ---------------------------------------------------------------- solve
    def _run(self, w_pen, bend_w, maxiter):
        y0 = self.Xf[:, 1:self.K, :].ravel().copy()
        if HAVE_SCIPY:
            res = _scipy_minimize(self.energy, y0, args=(w_pen, bend_w), jac=True,
                                  method='L-BFGS-B',
                                  options=dict(maxiter=maxiter, maxfun=3 * maxiter,
                                               ftol=1e-14, gtol=1e-12))
            y = res.x
        else:
            y = _lbfgs(lambda z: self.energy(z, w_pen, bend_w), y0, maxiter)
        self.Xf[:, 1:self.K, :] = y.reshape(self.n, self.K - 1, 2)
        return self.Xf

    def cull(self, slack=None):
        """Keep only the clones that could ever come within d_tgt + slack.

        Most of the 3 x (2 span + 1)^2 clones are far away forever; dropping them is
        a big constant factor.  The final clearance is always re-measured on the
        FULL wide window, so a mistake here cannot flatter the answer.
        """
        slack = self.cull_slack if slack is None else slack
        self.set_clones(self.span_solve)
        d, *_ = self._pair_dist(self.Xf)
        dmin = np.where(self.pair_ok[..., None], d, np.inf).min(axis=(1, 2, 3))
        keep = [r for r, m in zip(self.c_rows, dmin) if m < self.d_tgt + slack]
        self.set_clones(self.span_solve, keep=set(keep))
        return len(keep)

    def solve(self, weights=(1e2, 4e2, 2e3, 1e4, 6e4, 3e5), maxiter=90,
              irls_rounds=3, irls_eps=6e-3, snap_tol=1.5e-3):
        # --- stage 1: penalty continuation on uniform bending -----------------
        for w in weights:
            self.cull()
            self._run(w, self.bend, maxiter)
        w_last = weights[-1]

        # --- stage 2: reweighted bending -> concentrate curvature in few kinks --
        for _ in range(irls_rounds):
            k = self._kinks(self.Xf)
            bw = self.bend * (irls_eps ** 2) / (k ** 2 + irls_eps ** 2)
            self.cull()
            self._run(w_last, bw, maxiter)

        # --- stage 3: snap the residual hair to exactly straight ---------------
        self._snap(snap_tol)
        return self.Xf

    def _kinks(self, Xf):
        """cartesian magnitude of the heading change at each breakpoint: (n, K)."""
        kink = np.einsum('mk,ikd->imd', self.C2, Xf) + self.bend_const
        return np.linalg.norm(kink @ self.B, axis=-1)

    def _snap(self, tol):
        """Force the tiny kinks to exactly zero by the nearest linear projection.

        kink_m = 0 means X[m+1] - X[m] = X[m] - X[m-1]: three knots collinear AND
        evenly spaced, i.e. the heading is bit-for-bit constant across m.  Reverted
        per ball if it would cost clearance.
        """
        K, n = self.K, self.n
        before = self.clearance(self.Xf, span=self.span_solve)
        k = self._kinks(self.Xf)
        Xkeep = self.Xf.copy()
        for i in range(n):
            rows = np.where(k[i] < tol)[0]
            if rows.size == 0:
                continue
            Xf = self.Xf[i]
            G = self.C2[np.ix_(rows, np.arange(1, K))]                 # (r, K-1)
            fixed = (self.C2[rows][:, [0, K]] @ Xf[[0, K]] + self.bend_const[i][rows])
            y0 = Xf[1:K]
            resid = G @ y0 + fixed                                     # (r, 2)
            corr, *_ = np.linalg.lstsq(G, resid, rcond=None)
            self.Xf[i, 1:K] = y0 - corr
        after = self.clearance(self.Xf, span=self.span_solve)
        if after < min(before, self.d_req) - 1e-12:
            self.Xf = Xkeep                                            # not worth it

    # ---------------------------------------------------------------- measure
    def clearance(self, Xf=None, span=None):
        """true continuous-time minimum centre distance over the whole loop.

        Measured on a WIDE, uncounted clone window -- never the culled one.
        """
        Xf = self.Xf if Xf is None else Xf
        old = self.c_rows
        self.set_clones(self.span_check if span is None else span)
        d, *_ = self._pair_dist(Xf)
        val = float(np.where(self.pair_ok[..., None], d, np.inf).min())
        self.set_clones(self.span_solve, keep=set(old))
        return val

    def straightness(self, Xf=None):
        """fraction of sample steps whose heading equals the previous step's."""
        Xf = self.Xf if Xf is None else Xf
        _, Pcart = self.positions(Xf)
        v = Pcart[:, 1:, :] - Pcart[:, :-1, :]                 # (n, S, 2)
        h = v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-300)
        changed = np.linalg.norm(h - np.roll(h, 1, axis=1), axis=-1) > 1e-6
        return float(1.0 - changed.mean()), float(changed.sum() / self.n)

    # -------------------------------------------------- orbit + symmetry check
    def orbit(self, sidx, span, Xf=None):
        """every ball in the plane at integer global sample sidx: (pts_lat, ball_idx)."""
        Xf = self.Xf if Xf is None else Xf
        P_ext, _ = self.positions(Xf)
        P = P_ext[:, :self.S, :]
        pts, idx = [], []
        for oi, (M, v, tau) in enumerate(self.g.ops):
            m = sidx - self.opsh[oi]
            r = m % self.S
            p = P[:, r, :] + ((m - r) // self.S) * self.L
            q = p @ M.T + v
            for a in range(-span, span + 1):
                for b in range(-span, span + 1):
                    pts.append(q + np.array([a, b], dtype=float))
                    idx.append(np.arange(self.n))
        return np.vstack(pts), np.concatenate(idx)

    def symmetry_residual(self, span=5, radius_keep=1.6, times=12):
        """turn the orbit by the tau = 1/3 generator; it must equal the orbit at t+1/3.

        The rendered symmetry is automatic (it IS an orbit fill), so anything above
        rounding here would be a bug in the clone bookkeeping, not a real asymmetry.
        """
        gen = None
        for M, v, tau in self.g.ops:
            if abs(tau - 1.0 / 3.0) < 1e-9:
                gen = (M, v)
        if gen is None:
            return float('nan')
        M, v = gen
        sh = self.S // 3
        worst = 0.0
        for a in range(times):
            s = (a * self.S) // times
            p0, i0 = self.orbit(s, span)
            p1, i1 = self.orbit(s + sh, span)
            turned = p0 @ M.T + v
            tc = turned @ self.B
            keep = np.linalg.norm(tc, axis=1) < radius_keep
            p1c = p1 @ self.B
            for bi in range(self.n):
                src = tc[keep & (i0 == bi)]
                dst = p1c[i1 == bi]
                if src.size == 0:
                    continue
                dd = np.linalg.norm(src[:, None, :] - dst[None, :, :], axis=2).min(axis=1)
                worst = max(worst, float(dd.max()))
        return worst

    def report(self, runtime):
        clr = self.clearance()
        sf, kpb = self.straightness()
        return dict(runtime_sec=round(runtime, 4),
                    min_clearance_ratio=round(clr / self.d_req, 6),
                    symmetry_residual=self.symmetry_residual(),
                    kinks_per_ball=round(kpb, 4),
                    straight_fraction=round(sf, 6),
                    converged=bool(clr >= self.d_req))


# --------------------------------------------------------------------------- #
#  fallback optimiser (only used if scipy is missing)
# --------------------------------------------------------------------------- #
def _lbfgs(fg, x0, maxiter, m=12):                                  # pragma: no cover
    x = x0.copy()
    f, g = fg(x)
    S_, Y_, R_ = [], [], []
    for _ in range(maxiter):
        q = g.copy()
        al = []
        for s, y, r in zip(reversed(S_), reversed(Y_), reversed(R_)):
            a = r * s.dot(q)
            al.append(a)
            q -= a * y
        if Y_:
            q *= S_[-1].dot(Y_[-1]) / max(Y_[-1].dot(Y_[-1]), 1e-300)
        for (s, y, r), a in zip(zip(S_, Y_, R_), reversed(al)):
            q += s * (a - r * y.dot(q))
        d = -q
        if d.dot(g) >= 0:
            d = -g
        step, f0 = 1.0, f
        for _ in range(30):
            xn = x + step * d
            fn, gn = fg(xn)
            if fn <= f0 + 1e-4 * step * g.dot(d):
                break
            step *= 0.5
        else:
            break
        s, y = xn - x, gn - g
        sy = s.dot(y)
        if sy > 1e-14:
            S_.append(s); Y_.append(y); R_.append(1.0 / sy)
            if len(S_) > m:
                S_.pop(0); Y_.pop(0); R_.pop(0)
        x, f, g = xn, fn, gn
        if np.max(np.abs(g)) < 1e-11:
            break
    return x


# --------------------------------------------------------------------------- #
#  benchmarks
# --------------------------------------------------------------------------- #
TINY = dict(gid='g226',
            starts=[[0.15, 0.20], [0.55, 0.35], [0.30, 0.75]],
            drifts=[[1, 0], [-1, 1], [0, -1]],
            S=72, radius=0.075, margin=1.05)


def solve_tiny(K=6, verbose=False):
    """The pinned 3-ball benchmark.  Returns the required metrics dict."""
    t0 = time.perf_counter()
    sol = PolylineSolver(TINY['gid'], TINY['starts'], TINY['drifts'],
                         S=TINY['S'], K=K, radius=TINY['radius'],
                         margin=TINY['margin'])
    sol.solve()
    rt = time.perf_counter() - t0
    out = sol.report(rt)
    if verbose:
        out['_solver'] = sol
    return out


def solve_full(n=5, S=180, K=6, radius=0.07, margin=1.05, seed=3, render=False,
               out_path=None):
    """n balls, S samples: the target problem.  Starts are Poisson-disk seeded and
    drifts are drawn from the short lattice vectors, then both are PINNED."""
    g = Group('g226')
    rng = np.random.default_rng(seed)
    d_req = 2 * radius
    starts = []
    ws = np.array([[a, b] for a in range(-2, 3) for b in range(-2, 3)], dtype=float)
    while len(starts) < n:
        c = rng.random(2)
        trial = np.array(starts + [c])
        ok = True
        for M, v, _ in g.ops:
            q = (trial[:, None, :] @ M.T + v + ws[None, :, :]).reshape(-1, 2) @ g.B
            dd = np.linalg.norm(q - c @ g.B, axis=1)
            dd[dd < 1e-9] = np.inf
            if dd.min() < 2.2 * d_req:
                ok = False
                break
        if ok:
            starts.append(c)
    short = np.array([[1, 0], [-1, 1], [0, -1], [-1, 0], [1, -1], [0, 1]], dtype=float)
    drifts = short[rng.integers(0, len(short), size=n)]

    t0 = time.perf_counter()
    sol = PolylineSolver('g226', np.array(starts), drifts, S=S, K=K,
                         radius=radius, margin=margin)
    sol.solve()
    rt_solve = time.perf_counter() - t0
    rep = sol.report(rt_solve)
    rep['runtime_solve_sec'] = round(rt_solve, 4)

    if render:
        t1 = time.perf_counter()
        path = out_path or '/tmp/g226_polyline.gif'
        render_gif(sol, path, frames=60, size=600)
        rep['runtime_render_sec'] = round(time.perf_counter() - t1, 4)
        rep['runtime_total_sec'] = round(time.perf_counter() - t0, 4)
        rep['gif'] = path
    return rep


def render_gif(sol, path, frames=60, size=600, cell_px=210.0, span=4):
    """60 frames of the orbit fill, for a timing that includes drawing."""
    import colorsys
    from PIL import Image, ImageDraw
    n = sol.n
    cols = []
    for i in range(n):
        r, gg, b = colorsys.hls_to_rgb((i / n + 0.02) % 1.0, 0.52, 0.62)
        cols.append((int(255 * r), int(255 * gg), int(255 * b)))
    SSx = 2
    W = size * SSx
    rad = sol.radius * cell_px * SSx
    imgs = []
    for f in range(frames):
        s = int(round(f * sol.S / frames))
        pts, idx = sol.orbit(s, span)
        pc = pts @ sol.B
        img = Image.new('RGB', (W, W), (250, 249, 246))
        d = ImageDraw.Draw(img)
        for (px, py), i in zip(pc, idx):
            x = W / 2 + px * cell_px * SSx
            y = W / 2 - py * cell_px * SSx
            if not (-2 * rad <= x <= W + 2 * rad and -2 * rad <= y <= W + 2 * rad):
                continue
            d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=cols[i],
                      outline=(38, 42, 52), width=max(1, int(0.17 * rad)))
        imgs.append(img.resize((size, size), Image.LANCZOS))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=60,
                 loop=0, optimize=True)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--full', action='store_true')
    ap.add_argument('--render', action='store_true')
    ap.add_argument('--balls', type=int, default=5)
    ap.add_argument('--samples', type=int, default=180)
    ap.add_argument('--knots', type=int, default=6)
    ap.add_argument('--radius', type=float, default=0.07)
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    if a.full:
        print(solve_full(n=a.balls, S=a.samples, K=a.knots, radius=a.radius,
                         render=a.render, out_path=a.out))
    else:
        print(solve_tiny(K=a.knots))


if __name__ == '__main__':
    main()
