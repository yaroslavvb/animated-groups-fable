#!/usr/bin/env python3
"""Clockwork-group looping animation by constrained least squares (Strategy C).

The motif is n balls on CLOSED POLYLINES in the lattice cell of a clockwork group
(here g226 = 3_1 3_1 3_1, projection p3).  Ball i starts at a pinned s_i and drifts
by an integer lattice vector L_i per period, so p_i(t + 1) = p_i(t) + L_i and the
whole orbit fill is exactly periodic.  A clone (M, v, tau) shows the motif at
internal time t - tau, so a bounce between a ball and its own rotated copy has to
be consistent with itself a third of a period earlier: the trajectory cannot be
integrated forward, it has to be solved all at once.

Unknowns
    X[i, m], m = 1 .. K-1 : the interior breakpoints of ball i's polyline.
    X[i, 0] = s_i is pinned and X[i, K] = s_i + L_i is forced, so the solver can
    only BEND a path -- it can never slide one out of the way.

Objective
    E(X) = bend * sum_m |X[m+1] - 2 X[m] + X[m-1]|^2         (discrete bending;
                                                              exactly zero on the
                                                              ballistic straight
                                                              line)
         + w    * sum hinge(d_target - d(pair))^2            (soft separation)

    minimised by L-BFGS with an analytic gradient under a continuation schedule
    w = 1e2 ... 3e5.  Since the bending term vanishes on the straight path, every
    kink in the answer is one the geometry paid for.

Exactness in time
    Breakpoints sit on sample indices and every tau is a whole number of samples
    (S divisible by 3), so between two consecutive samples BOTH a ball and every
    clone move linearly.  The separation of a pair over one sample interval is
    therefore  min_{u in [0,1]} |a + u b|,  available in closed form.  Its clipped
    minimiser leaves the distance C^1 in the unknowns, so the reported clearance is
    the true continuous-time minimum -- not a sampled proxy that can be sneaked
    under -- and the gradient is exact by the envelope theorem.

Cost
    Only the (clone, i, j) triples that can ever come close are kept: an
    axis-aligned bounding-box reject on the whole trajectories, then an exact
    distance filter.  For the tiny benchmark that is ~30 triples out of 675.  The
    final clearance is always re-measured on a WIDE, uncoiled window so the cull
    can never flatter the answer.

Sparsifying the kinks
    A plain bending minimiser spreads a little curvature over every breakpoint.
    Two extra stages fix that: iteratively reweighted bending (w_m ~ 1/|kink_m|^2)
    drives the unneeded kinks toward zero, then a linear projection snaps them to
    EXACTLY zero (three collinear, evenly spaced knots), which is what makes the
    long straight runs read as straight to machine precision.

Run:  python3 solve_project.py            # tiny benchmark
      python3 solve_project.py --full --render     # n=5, S=180, + 60 frames
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from particles_gif import Group  # noqa: E402  (read-only import; that file is untouched)

try:
    from scipy.optimize import minimize as _scipy_minimize
    HAVE_SCIPY = True
except Exception:                                    # pragma: no cover
    HAVE_SCIPY = False


# --------------------------------------------------------------------------- #
class PolylineSolver:
    """Closed polyline trajectories for a clockwork group, by penalty least squares."""

    def __init__(self, gid, starts, drifts, S=72, K=6, radius=0.075, margin=1.05,
                 span_solve=3, span_check=4, bend=1.0, anchor=0.0,
                 cull_slack=0.40, jitter=2e-3, seed=0):
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
        self.d_req = 2.0 * radius                 # hard requirement: no overlap
        self.d_tgt = 2.0 * radius * margin        # what the penalty aims for
        self.bend, self.anchor = bend, anchor
        self.span_solve, self.span_check = span_solve, span_check
        self.cull_slack = cull_slack
        self.n_triples = 0

        self._build_interp()
        self._build_bending()
        self._build_ops()

        # ballistic start + a whisker of jitter, so a dead head-on approach is not
        # a symmetric saddle of the penalty
        rng = np.random.default_rng(seed)
        self.Xf0 = self._ballistic()
        self.Xf = self.Xf0.copy()
        self.Xf[:, 1:self.K, :] += jitter * rng.standard_normal((self.n, self.K - 1, 2))
        self.cull()

    # ------------------------------------------------------------- structure
    def _ballistic(self):
        """the straight constant-velocity path X[m] = s + (m/K) L."""
        frac = np.arange(self.K + 1)[None, :, None] / self.K
        return self.starts[:, None, :] + frac * self.L[:, None, :]

    def _build_interp(self):
        """A: (S+1, K+1), breakpoints -> sample positions at s = 0 .. S."""
        S, K = self.S, self.K
        step = S // K
        A = np.zeros((S + 1, K + 1))
        for s in range(S + 1):
            m, r = divmod(s, step)
            if m == K:                        # the closing sample is the last knot
                m, r = K - 1, step
            A[s, m] = 1.0 - r / step
            A[s, m + 1] = r / step
        self.A = A

    def _build_bending(self):
        """C2: (K, K+1) with kink_m = C2 @ Xf + const, const = -L on row 0.

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
        const[:, 0, :] = -self.L                      # from X[-1] = X[K-1] - L
        self.bend_const = const

    def _build_ops(self):
        """Per group op: its whole-sample time shift and the index map it induces."""
        S = self.S
        self.O = len(self.g.ops)
        self.opM = np.array([M for M, _, _ in self.g.ops])
        self.opv = np.array([v for _, v, _ in self.g.ops])
        self.opsh = np.array([int(round(tau * S)) % S for _, _, tau in self.g.ops])
        if max(abs(tau * S - round(tau * S)) for _, _, tau in self.g.ops) > 1e-9:
            raise ValueError("S does not make every tau a whole number of samples")
        m = np.arange(S + 1)[None, :] - self.opsh[:, None]
        self.opidx = m % S                            # (O, S+1) which base sample
        self.opk = (m - self.opidx) // S              # (O, S+1) which period (drift)
        self.id_op = int(np.argmin([abs(t) for _, _, t in self.g.ops]))
        # fold "rotate then go cartesian" into one 2x2 (forward: MB, adjoint: RB)
        self.MB = np.array([M.T @ self.B for M in self.opM])
        self.vB = self.opv @ self.B
        self.RB = np.array([self.B.T @ M for M in self.opM])

    # --------------------------------------------------------------- forward
    # The hot loop is component-major (separate x and y arrays): reducing over a
    # trailing length-2 axis is a strided ufunc reduce and costs more than the
    # arithmetic it performs.  MB / RB fold the op matrix and the basis into one
    # 2x2 each, so a clone position is two multiply-adds.
    def _pos_xy(self, Xf):
        """(Px, Py, Pcx, Pcy), each (n, S+1): lattice and cartesian sample positions."""
        Px = Xf[:, :, 0] @ self.A.T
        Py = Xf[:, :, 1] @ self.A.T
        B = self.B
        return Px, Py, Px * B[0, 0] + Py * B[1, 0], Px * B[0, 1] + Py * B[1, 1]

    def _perop_xy(self, Px, Py):
        """cartesian motif carried by each op, before translation: 2 x (O*n, S+1)."""
        n, S1 = self.n, self.S + 1
        qx = np.empty((self.O * n, S1))
        qy = np.empty((self.O * n, S1))
        for o in range(self.O):
            k = self.opk[o]
            sx = Px[:, self.opidx[o]] + k[None, :] * self.L[:, 0:1]
            sy = Py[:, self.opidx[o]] + k[None, :] * self.L[:, 1:2]
            MB, vb = self.MB[o], self.vB[o]
            qx[o * n:(o + 1) * n] = sx * MB[0, 0] + sy * MB[1, 0] + vb[0]
            qy[o * n:(o + 1) * n] = sx * MB[0, 1] + sy * MB[1, 1] + vb[1]
        return qx, qy

    def positions(self, Xf):
        """sample positions at s = 0 .. S (index S closes the loop): lattice, cartesian."""
        Px, Py, Pcx, Pcy = self._pos_xy(Xf)
        return np.stack([Px, Py], -1), np.stack([Pcx, Pcy], -1)

    def per_op_cart(self, P_ext):
        """the motif carried by each op, before translation: (O, n, S+1, 2) cartesian."""
        qx, qy = self._perop_xy(P_ext[..., 0], P_ext[..., 1])
        return np.stack([qx, qy], -1).reshape(self.O, self.n, self.S + 1, 2)

    @staticmethod
    def _seg_min_xy(Dx, Dy, S):
        """exact min over each sample interval of |a + u b|, u in [0,1] (componentwise)."""
        ax, ay = Dx[..., :S], Dy[..., :S]
        bx = Dx[..., 1:] - ax
        by = Dy[..., 1:] - ay
        b2 = bx * bx + by * by
        ab = ax * bx + ay * by
        u = -ab / (b2 + 1e-18)
        np.clip(u, 0.0, 1.0, out=u)
        mx = ax + u * bx
        my = ay + u * by
        return np.sqrt(mx * mx + my * my), mx, my, u

    @classmethod
    def _seg_min(cls, D, S):
        """(n..., S) minimum distance per sample interval, for the cold paths."""
        d, mx, my, u = cls._seg_min_xy(D[..., 0], D[..., 1], S)
        return d, np.stack([mx, my], -1), u

    # ------------------------------------------------------------- the cull
    def _all_triples(self, span):
        """(clone, i, j) triples over ops x translations x ball pairs, minus self."""
        oi, aa, bb, ii, jj = [], [], [], [], []
        for o in range(self.O):
            for a in range(-span, span + 1):
                for b in range(-span, span + 1):
                    self_clone = (o == self.id_op and a == 0 and b == 0
                                  and not self.opv[o].any())
                    for i in range(self.n):
                        for j in range(self.n):
                            if self_clone and i == j:
                                continue
                            oi.append(o); aa.append(a); bb.append(b)
                            ii.append(i); jj.append(j)
        return (np.array(oi), np.array(aa, float), np.array(bb, float),
                np.array(ii), np.array(jj))

    def cull(self, slack=None, span=None, thresh=None):
        """Keep only the triples that could ever come within d_tgt + slack.

        Two stages: an axis-aligned bounding-box reject on whole trajectories
        (cheap, no time axis), then the exact continuous-time distance.  Most of
        the 3 (2 span + 1)^2 n^2 triples are far away for the whole period.
        """
        slack = self.cull_slack if slack is None else slack
        span = self.span_solve if span is None else span
        thresh = (self.d_tgt + slack) if thresh is None else thresh
        o, a, b, ii, jj = self._all_triples(span)
        wc = np.stack([a, b], 1) @ self.B

        P_ext, Pcart = self.positions(self.Xf)
        per_op = self.per_op_cart(P_ext)
        lo_i, hi_i = Pcart.min(1), Pcart.max(1)                    # (n, 2)
        lo_q, hi_q = per_op.min(2), per_op.max(2)                  # (O, n, 2)

        gap = np.maximum(lo_i[ii] - (hi_q[o, jj] + wc),
                         (lo_q[o, jj] + wc) - hi_i[ii])            # (T, 2)
        keep = np.maximum(gap, 0.0)
        keep = np.linalg.norm(keep, axis=1) < thresh
        o, wc, ii, jj = o[keep], wc[keep], ii[keep], jj[keep]

        if o.size:                                                  # exact filter
            Q = per_op[o, jj] + wc[:, None, :]
            d, _, _ = self._seg_min(Pcart[ii] - Q, self.S)
            keep2 = d.min(1) < thresh
            o, wc, ii, jj = o[keep2], wc[keep2], ii[keep2], jj[keep2]

        self.t_op, self.t_wc, self.t_i, self.t_j = o, wc, ii, jj
        T = o.size
        self.n_triples = T
        self.t_gather = o * self.n + jj                  # row of the (O*n, S+1) block
        # one-hot scatter matrices: the adjoints of the two gathers above.  T stays
        # small, so these are trivial BLAS calls rather than np.add.at loops.
        self.Wi = np.zeros((self.n, T)); self.Wi[ii, np.arange(T)] = 1.0
        self.Woj = np.zeros((self.O * self.n, T))
        self.Woj[self.t_gather, np.arange(T)] = 1.0
        return T

    # --------------------------------------------------------------- energy
    def energy(self, y, w_pen, bend_w):
        """E and dE/dy for the free interior breakpoints y = X[:, 1:K, :]."""
        n, S, K, T = self.n, self.S, self.K, self.n_triples
        Xf = self.Xf0.copy()
        Xf[:, 0, :] = self.starts
        Xf[:, K, :] = self.starts + self.L
        Xf[:, 1:K, :] = y.reshape(n, K - 1, 2)

        E = 0.0
        gXf = np.zeros_like(Xf)
        Px, Py, Pcx, Pcy = self._pos_xy(Xf)

        if T:
            qx, qy = self._perop_xy(Px, Py)
            g = self.t_gather
            Dx = Pcx[self.t_i] - (qx[g] + self.t_wc[:, 0:1])            # (T, S+1)
            Dy = Pcy[self.t_i] - (qy[g] + self.t_wc[:, 1:2])
            d, mx, my, u = self._seg_min_xy(Dx, Dy, S)                  # (T, S)

            viol = self.d_tgt - d
            np.maximum(viol, 0.0, out=viol)        # hinge
            E += 0.5 * w_pen * float((viol * viol).sum())

            # envelope theorem: the clipped minimiser u* is held fixed
            coef = (-w_pen) * viol / np.maximum(d, 1e-12)
            gmx = coef * mx
            gmy = coef * my
            gDx = np.zeros((T, S + 1))
            gDy = np.zeros((T, S + 1))
            um = 1.0 - u
            gDx[:, :S] = um * gmx
            gDy[:, :S] = um * gmy
            gDx[:, 1:] += u * gmx
            gDy[:, 1:] += u * gmy

            gPcx = self.Wi @ gDx                       # (n, S+1) cartesian
            gPcy = self.Wi @ gDy
            gqx = self.Woj @ gDx                       # (O*n, S+1), sign flipped below
            gqy = self.Woj @ gDy

            gP = np.zeros((n, S))
            gPy = np.zeros((n, S))
            for o in range(self.O):
                sl = slice(o * n, (o + 1) * n)
                R = self.RB[o]                          # = B.T @ M_o
                # minus sign: D = Pcart - Qcart, so dE/dQcart = -dE/dD
                gsx = -(gqx[sl] * R[0, 0] + gqy[sl] * R[1, 0])
                gsy = -(gqx[sl] * R[0, 1] + gqy[sl] * R[1, 1])
                sh = self.opsh[o]
                gP += np.roll(gsx[:, :S], -sh, axis=1)
                gPy += np.roll(gsy[:, :S], -sh, axis=1)
                gP[:, (S - sh) % S] += gsx[:, S]
                gPy[:, (S - sh) % S] += gsy[:, S]

            B = self.B
            gx = gPcx * B[0, 0] + gPcy * B[0, 1]        # d/dP from the base copy
            gy_ = gPcx * B[1, 0] + gPcy * B[1, 1]
            gx[:, :S] += gP
            gy_[:, :S] += gPy
            gXf[:, :, 0] += gx @ self.A
            gXf[:, :, 1] += gy_ @ self.A

        # bending, measured in cartesian so it is isotropic on the hex lattice
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
                                               ftol=1e-15, gtol=1e-12))
            y = res.x
        else:                                                    # pragma: no cover
            y = _lbfgs(lambda z: self.energy(z, w_pen, bend_w), y0, maxiter)
        self.Xf[:, 1:self.K, :] = y.reshape(self.n, self.K - 1, 2)
        return self.Xf

    def solve(self, weights=(1e2, 4e2, 2e3, 1e4, 6e4, 3e5), maxiter=110,
              irls_rounds=3, irls_eps=6e-3, snap_tol=1.5e-3, repairs=2):
        # stage 1: penalty continuation with uniform bending
        for w in weights:
            self.cull()
            self._run(w, self.bend, maxiter)
        w_last = weights[-1]

        # stage 2: reweighted bending -> concentrate the curvature in a few kinks
        for _ in range(irls_rounds):
            k = self._kinks(self.Xf)
            bw = self.bend * (irls_eps ** 2) / (k ** 2 + irls_eps ** 2)
            self.cull()
            self._run(w_last, bw, maxiter)

        # stage 3: snap the residual hair to exactly straight
        self._snap(snap_tol)

        # stage 4: if the wide window disagrees with the culled one, widen and redo
        for _ in range(repairs):
            if self.clearance() >= self.d_req:
                break
            self.cull(slack=self.cull_slack + 0.5, span=self.span_check)
            self._run(w_last, self.bend, 2 * maxiter)
            self._snap(snap_tol)
        return self.Xf

    def _kinks(self, Xf):
        """cartesian magnitude of the heading change at each breakpoint: (n, K)."""
        kink = np.einsum('mk,ikd->imd', self.C2, Xf) + self.bend_const
        return np.linalg.norm(kink @ self.B, axis=-1)

    def _snap(self, tol):
        """Force the negligible kinks to exactly zero, by the nearest linear projection.

        kink_m = 0 means X[m+1] - X[m] = X[m] - X[m-1]: three knots collinear AND
        evenly spaced, so the heading is bit-for-bit constant across m.  Reverted
        wholesale if it would cost clearance.
        """
        K = self.K
        before = self.clearance(self.Xf)
        Xkeep = self.Xf.copy()
        k = self._kinks(self.Xf)
        for i in range(self.n):
            rows = np.where(k[i] < tol)[0]
            if rows.size == 0:
                continue
            Xf = self.Xf[i]
            G = self.C2[np.ix_(rows, np.arange(1, K))]                # (r, K-1)
            resid = (self.C2[rows][:, [0, K]] @ Xf[[0, K]]
                     + self.bend_const[i][rows] + G @ Xf[1:K])        # (r, 2)
            corr, *_ = np.linalg.lstsq(G, resid, rcond=None)
            self.Xf[i, 1:K] = Xf[1:K] - corr
        if self.clearance(self.Xf) < min(before, self.d_req) - 1e-12:
            self.Xf = Xkeep                                            # not worth it

    # -------------------------------------------------------------- measure
    def clearance(self, Xf=None, span=None, thresh=1.0):
        """True continuous-time minimum centre distance, on a WIDE clone window.

        Independent of the cull used while solving: the triples are rebuilt here
        over span_check with a threshold of `thresh` cartesian units, so the value
        is exact whenever the true minimum is below that (it always is, in
        practice, since the balls are packed at ~0.15).
        """
        Xf = self.Xf if Xf is None else Xf
        span = self.span_check if span is None else span
        o, a, b, ii, jj = self._all_triples(span)
        wc = np.stack([a, b], 1) @ self.B
        P_ext, Pcart = self.positions(Xf)
        per_op = self.per_op_cart(P_ext)
        lo_i, hi_i = Pcart.min(1), Pcart.max(1)
        lo_q, hi_q = per_op.min(2), per_op.max(2)
        gap = np.maximum(lo_i[ii] - (hi_q[o, jj] + wc), (lo_q[o, jj] + wc) - hi_i[ii])
        keep = np.linalg.norm(np.maximum(gap, 0.0), axis=1) < thresh
        o, wc, ii, jj = o[keep], wc[keep], ii[keep], jj[keep]
        if o.size == 0:
            return float(thresh)
        best = np.inf
        for lo in range(0, o.size, 4096):                     # chunk, keep memory flat
            sl = slice(lo, lo + 4096)
            Q = per_op[o[sl], jj[sl]] + wc[sl][:, None, :]
            d, _, _ = self._seg_min(Pcart[ii[sl]] - Q, self.S)
            best = min(best, float(d.min()))
        return best

    def straightness(self, Xf=None):
        """fraction of sample steps whose heading equals the previous step's."""
        Xf = self.Xf if Xf is None else Xf
        _, Pcart = self.positions(Xf)
        v = Pcart[:, 1:, :] - Pcart[:, :-1, :]                    # (n, S, 2)
        h = v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-300)
        changed = np.linalg.norm(h - np.roll(h, 1, axis=1), axis=-1) > 1e-6
        return float(1.0 - changed.mean()), float(changed.sum() / self.n)

    # ---------------------------------------------- orbit and symmetry check
    def orbit(self, sidx, span, Xf=None):
        """every ball in the plane at integer global sample sidx: (lattice pts, index)."""
        Xf = self.Xf if Xf is None else Xf
        P_ext, _ = self.positions(Xf)
        P = P_ext[:, :self.S, :]
        pts, idx = [], []
        for o, (M, v, tau) in enumerate(self.g.ops):
            m = sidx - self.opsh[o]
            r = m % self.S
            q = (P[:, r, :] + ((m - r) // self.S) * self.L) @ M.T + v
            for a in range(-span, span + 1):
                for b in range(-span, span + 1):
                    pts.append(q + np.array([a, b], dtype=float))
                    idx.append(np.arange(self.n))
        return np.vstack(pts), np.concatenate(idx)

    def symmetry_residual(self, span=5, radius_keep=1.6, times=12):
        """Turn the orbit by the tau = 1/3 generator: it must equal the orbit at t + 1/3.

        The rendered symmetry is automatic (the picture IS an orbit fill), so
        anything above rounding here is a bug in the clone bookkeeping, never a
        real asymmetry.  The finite window is not carried to itself by the
        rotation, hence radius_keep against a wider target window.
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
            tc = (p0 @ M.T + v) @ self.B
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
def _lbfgs(fg, x0, maxiter, m=12):                                  # pragma: no cover
    """Plain L-BFGS with backtracking, used only if scipy is unavailable."""
    x = x0.copy()
    f, g = fg(x)
    S_, Y_, R_ = [], [], []
    for _ in range(maxiter):
        q = g.copy()
        al = []
        for s, y, r in zip(reversed(S_), reversed(Y_), reversed(R_)):
            a = r * s.dot(q); al.append(a); q -= a * y
        if Y_:
            q *= S_[-1].dot(Y_[-1]) / max(Y_[-1].dot(Y_[-1]), 1e-300)
        for (s, y, r), a in zip(zip(S_, Y_, R_), reversed(al)):
            q += s * (a - r * y.dot(q))
        d = -q
        if d.dot(g) >= 0:
            d = -g
        step, f0, ok = 1.0, f, False
        for _ in range(30):
            xn = x + step * d
            fn, gn = fg(xn)
            if fn <= f0 + 1e-4 * step * g.dot(d):
                ok = True
                break
            step *= 0.5
        if not ok:
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


def solve_tiny(K=6, return_solver=False):
    """The pinned 3-ball benchmark.  Returns the required metrics dict."""
    t0 = time.perf_counter()
    sol = PolylineSolver(TINY['gid'], TINY['starts'], TINY['drifts'],
                         S=TINY['S'], K=K, radius=TINY['radius'],
                         margin=TINY['margin'])
    sol.solve()
    rt = time.perf_counter() - t0
    out = sol.report(rt)
    return (out, sol) if return_solver else out


def make_full_problem(n=5, radius=0.07, seed=3):
    """Poisson-disk starts and short-lattice-vector drifts, then both are PINNED."""
    g = Group('g226')
    rng = np.random.default_rng(seed)
    ws = np.array([[a, b] for a in range(-2, 3) for b in range(-2, 3)], dtype=float)
    starts, guard = [], 0
    while len(starts) < n and guard < 20000:
        guard += 1
        c = rng.random(2)
        trial = np.array(starts + [c])
        ok = True
        for M, v, _ in g.ops:
            q = (trial @ M.T + v)[:, None, :] + ws[None, :, :]
            dd = np.linalg.norm(q.reshape(-1, 2) @ g.B - c @ g.B, axis=1)
            dd[dd < 1e-9] = np.inf
            if dd.min() < 2.4 * 2 * radius:
                ok = False
                break
        if ok:
            starts.append(c)
    short = np.array([[1, 0], [-1, 1], [0, -1], [-1, 0], [1, -1], [0, 1]], dtype=float)
    return np.array(starts), short[rng.integers(0, len(short), size=len(starts))]


def solve_full(n=5, S=180, K=6, radius=0.07, margin=1.05, seed=3, render=False,
               out_path=None):
    """The target problem: n balls, S samples, optionally 60 rendered frames."""
    starts, drifts = make_full_problem(n, radius, seed)
    t0 = time.perf_counter()
    sol = PolylineSolver('g226', starts, drifts, S=S, K=K, radius=radius,
                         margin=margin)
    sol.solve()
    rt_solve = time.perf_counter() - t0
    rep = sol.report(rt_solve)
    rep['runtime_solve_sec'] = round(rt_solve, 4)
    rep['n_triples'] = sol.n_triples
    if render:
        t1 = time.perf_counter()
        path = out_path or '/tmp/g226_polyline.gif'
        render_gif(sol, path, frames=60, size=600)
        rep['runtime_render_sec'] = round(time.perf_counter() - t1, 4)
        rep['runtime_total_sec'] = round(time.perf_counter() - t0, 4)
        rep['gif'] = path
    return rep


def render_gif(sol, path, frames=60, size=600, cell_px=200.0, span=4):
    """60 frames of the orbit fill; used to time the whole pipeline honestly."""
    import colorsys
    from PIL import Image, ImageDraw
    n = sol.n
    cols = [tuple(int(255 * c) for c in
                  colorsys.hls_to_rgb((i / n + 0.02) % 1.0, 0.52, 0.62))
            for i in range(n)]
    ss = 2
    W = size * ss
    rad = sol.radius * cell_px * ss
    imgs = []
    for f in range(frames):
        s = int(round(f * sol.S / frames))
        pts, idx = sol.orbit(s, span)
        pc = pts @ sol.B
        img = Image.new('RGB', (W, W), (250, 249, 246))
        d = ImageDraw.Draw(img)
        x = W / 2 + pc[:, 0] * cell_px * ss
        y = W / 2 - pc[:, 1] * cell_px * ss
        vis = (x > -2 * rad) & (x < W + 2 * rad) & (y > -2 * rad) & (y < W + 2 * rad)
        for xi, yi, i in zip(x[vis], y[vis], idx[vis]):
            d.ellipse([xi - rad, yi - rad, xi + rad, yi + rad], fill=cols[i],
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
