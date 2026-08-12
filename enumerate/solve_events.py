#!/usr/bin/env python3
"""Event-driven clockwork billiard: balls on closed polylines that bend only
where they meet a time-shifted rotated copy of themselves.

STRATEGY B, and what it ran into
--------------------------------
The brief was: represent each ball's velocity as a piecewise-constant function
of time, find the collisions analytically (a pair of straight segments reaches
the ball diameter at a root of a quadratic), rebuild each path by integrating
through its own events applying the equal-mass elastic exchange, and iterate to
self-consistency.  The first three pieces work exactly as advertised and are
implemented here.  The elastic exchange does not close, for a reason that is
structural rather than numerical, and that is worth stating precisely because
it constrains every solver for this problem:

    START AND DRIFT PINNED => A KINK CANNOT PUSH A BALL OFF ITS PARTNER.

    A ball's deviation d(t) from its straight drift obeys d(0) = 0 (the start
    is pinned) and d(1) = 0 (over one period it must translate by exactly its
    lattice vector L).  A single velocity kink of size D at time u therefore
    produces the tent

        d(t) = D * [ (t - u)_+  -  t (1 - u) ]      <= 0  along D, for all t,

    verified numerically in tent_check().  It is a NEGATIVE tent: the path bows
    the OTHER way from the kink, because a path that leaves early must come
    back to a fixed endpoint.  Consequently, at a contact p with impulse
    magnitude L_p,

        d(gap_p) / d(L_p)  =  Phi_i + Phi_j  <  0,

    i.e. making a bounce more elastic makes exactly that encounter deeper.  A
    frictionless repulsive contact is self-defeating here.  Meanwhile a genuine
    interior distance minimum forces L_p > 0 (the normal relative velocity must
    change sign).  The two requirements are contradictory, so the strict model
    -- pinned start, pinned drift, closed loop, frictionless repulsive elastic
    contacts -- has no solution except one with no contacts at all.

    Two further consequences fall out.  (a) Periodicity of the velocity demands
    sum_p L_p n_p = 0 per ball: the total impulse over a period must vanish.
    With L_p >= 0 that needs the contact normals to positively span the plane;
    in this configuration they do not, so projecting onto the constraint
    annihilates ~85% of every impulse.  (b) Dropping the projection instead
    lets the drift-compensating constant feed back on itself with gain
    (1 - k_p/S) ~ 1, and the iteration blows up.  strategy_b_probe() runs both
    and prints the numbers.

WHAT THIS MODULE ACTUALLY DELIVERS
----------------------------------
Everything about the event-driven picture is kept except strict elasticity,
which is the one piece proved impossible above:

  * kinks occur ONLY at contacts -- each path is a closed polyline whose
    breakpoints are, one for one, the encounters the geometry finds;
  * the two participants of a contact receive equal and opposite impulses
    (opposite after transport by the clone's rotation), so the collision is
    momentum-conserving and consistent in both frames, which is what makes an
    event at time t in one ball's frame the same event at t - tau in the
    other's;
  * the velocity closes exactly around the period (the impulses on each ball
    sum to zero), so there is no phantom kink at the seam;
  * start and drift are pinned by construction -- the solver can only bend.

What is given up is the elastic RULE, and with it the requirement that a
contact impulse point along the contact normal.  Instead the impulses are
chosen so that every encounter clears the ball diameter, and the restitution
each contact ends up with is then MEASURED: about two thirds of contacts do
reflect (eps > 0), with a median eps near +0.5 rather than the +1 of a true
bounce.  Steering the impulses back towards the normal (w_tan > 0) is possible
and costs about a fifth of the clearance -- main() prints that number.  So the
gap between this and a true billiard is quantified, not waved away.

The solve is two phases, because the direct one does not work:

  1. Corridor.  Descend the exact clearance objective -- total squared
     shortfall over every instant and every pair, differentiated through each
     closest approach -- with every sample a free breakpoint.  A group-L1
     pressure on the kinks is what makes this phase produce a POLYLINE rather
     than a curve: bending is gathered into a few breakpoints instead of being
     smeared over all S samples, so there is something for phase 2 to keep.
  2. Sparsify.  Detect the contacts of those paths, build the linear space of
     paths that bend only there (one paired impulse per contact, restricted to
     the closed-velocity null space), and continue the SAME descent projected
     onto it.  Projecting each step, rather than fitting once at the end, is
     the difference between clearing the diameter and losing a third of it.

Two details cost real time to find and are load-bearing:
  * the descent must step in PATH space, not in impulse space.  The tent
    operator has entries of order S/4, so an impulse-space gradient is
    hopelessly scaled and the descent stalls at ~0.7 of the required clearance.
  * without a barrier keeping each path near its own straight drift, the solver
    walks a ball out of the finite clone window it is being tested against and
    reports a clearance that is not real.  The symmetry residual is what
    catches it: it jumps from 1e-16 to O(1) the moment a path escapes.

Run:  python3 solve_events.py           # tiny benchmark + Strategy-B probe
"""

import math
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from particles_gif import Group                       # noqa: E402  (do not modify)


# --------------------------------------------------------------------------
#  trajectories: piecewise-constant velocity, pinned start, pinned drift
# --------------------------------------------------------------------------

class Traj:
    """Closed polyline paths in lattice coordinates.

    The state is a jump field J[i, k] -- the velocity kink applied at the start
    of sample interval k.  The per-sample velocity is

        U[i, k] = c_i + sum_{k' <= k} J[i, k']

    with the integration constant c_i fixed by sum_k U[i, k] = L_i.  Hence the
    start s_i and the drift L_i are pinned no matter what the solver does: it
    can only bend.
    """

    def __init__(self, starts, drifts, S):
        self.s = np.array(starts, dtype=float)
        self.L = np.array(drifts, dtype=float)
        self.n, self.S = len(self.s), S
        self.set_jumps(np.zeros((self.n, S, 2)))

    def set_jumps(self, J):
        self.J = J
        cum = np.cumsum(J, axis=1)
        c = (self.L - cum.sum(axis=1)) / self.S
        self.U = c[:, None, :] + cum
        self.X = np.empty((self.n, self.S + 1, 2))
        self.X[:, 0, :] = self.s
        self.X[:, 1:, :] = self.s[:, None, :] + np.cumsum(self.U, axis=1)

    def at(self, theta):
        """positions of all balls at internal time theta (any real) -> (n, 2)"""
        w = math.floor(theta)
        x = (theta - w) * self.S
        k = int(math.floor(x)) % self.S
        f = x - math.floor(x)
        return self.X[:, k, :] + f * self.U[:, k, :] + w * self.L


def tent_check(S=72, k=20):
    """the negative tent, measured: a kink of +y at k bows the path to -y."""
    tr = Traj([[0.0, 0.0]], [[1, 0]], S)
    J = np.zeros((1, S, 2))
    J[0, k] = [0.0, 1.0]
    tr.set_jumps(J)
    dev = tr.X[0, :, 1]
    return float(dev.max()), float(dev.min()), -k * (1 - k / S)


# --------------------------------------------------------------------------
#  clones
# --------------------------------------------------------------------------

def build_clones(g, S, span):
    """(M, m, a, R, Rinv) for every op x lattice translation.

    a = tau * S is an exact integer because S is divisible by the clock order,
    so a clone's time shift is a whole number of samples and the shift is a
    roll; rolling past the seam costs one lattice vector, that being the
    previous period.  R is the clone's rotation in CARTESIAN coordinates, in
    the row-vector convention u -> u @ R.
    """
    out, self_c = [], None
    for o, (M, v, tau) in enumerate(g.ops):
        a = int(round(tau * S))
        if abs(a - tau * S) > 1e-9:
            raise ValueError("S must be a multiple of the clock order")
        R = g.Binv @ M.T @ g.B
        Ri = np.linalg.inv(R)
        ident = np.allclose(M, np.eye(2)) and a == 0
        for m1 in range(-span, span + 1):
            for m2 in range(-span, span + 1):
                if ident and m1 == 0 and m2 == 0:
                    self_c = len(out)
                out.append(dict(op=o, M=M, m=v + np.array([m1, m2], float),
                                a=a, R=R, Ri=Ri))
    return out, self_c


def clone_stack(g, tr, clones, want_vel=True):
    """cartesian positions (C, n, S+1, 2) and velocities (C, n, S, 2).

    All clones sharing an op share the roll and the rotation -- they differ
    only by a lattice translation, which is one broadcast add -- so the work is
    three rolled arrays, not one per clone.
    """
    S, n = tr.S, tr.n
    X = tr.X[:, :S, :]
    idx = np.arange(S)
    Q = np.empty((len(clones), n, S + 1, 2))
    Qv = np.empty((len(clones), n, S, 2)) if want_vel else None
    byop = {}
    for c, cd in enumerate(clones):
        byop.setdefault(cd['op'], []).append(c)
    for cs in byop.values():
        cd = clones[cs[0]]
        M, a = cd['M'], cd['a']
        sh = (idx - a) % S
        seam = ((idx - a) < 0).astype(float)          # previous period
        Y = X[:, sh, :] - seam[None, :, None] * tr.L[:, None, :]
        base = (Y @ M.T) @ g.B                        # (n, S, 2)
        drift = (tr.L @ M.T) @ g.B                    # (n, 2)
        mc = np.array([clones[c]['m'] for c in cs]) @ g.B
        cs = np.array(cs)
        Q[cs, :, :S, :] = base[None] + mc[:, None, None, :]
        Q[cs, :, S, :] = Q[cs, :, 0, :] + drift[None]
        if want_vel:
            Qv[cs] = ((tr.U[:, sh, :] @ M.T) @ g.B)[None]
    return Q, Qv


def pair_geometry(g, tr, clones, self_c, want_vel=True):
    """exact per-interval closest approach of every base ball to every clone.

    Both members of a pair are straight on a sample interval (the clones' kinks
    sit on the same grid), so the separation is |A + s B| on s in [0, 1] and its
    minimum is a two-line formula -- no sampling error anywhere.
    """
    S, n = tr.S, tr.n
    P = tr.X @ g.B
    Vb = tr.U @ g.B if want_vel else None
    Q, Qv = clone_stack(g, tr, clones, want_vel)
    D = P[:, None, None, :, :] - Q[None, :, :, :, :]          # (i, C, j, S+1, 2)
    A = D[:, :, :, :S, :]
    B = D[:, :, :, 1:, :] - A
    a0, a1 = A[..., 0], A[..., 1]
    b0, b1 = B[..., 0], B[..., 1]
    aa = a0 * a0 + a1 * a1
    ab = a0 * b0 + a1 * b1
    bb = b0 * b0 + b1 * b1
    ss = np.clip(-ab / np.maximum(bb, 1e-300), 0.0, 1.0)
    dm2 = np.maximum(aa + (2 * ab + ss * bb) * ss, 0.0)
    if self_c is not None:
        for i in range(n):
            dm2[i, self_c, i, :] = np.inf                     # the ball itself
    return dict(A=A, B=B, ss=ss, dm2=dm2, P=P, Vb=Vb, Q=Q, Qv=Qv)


def cull_clones(g, tr, clones, self_c, keep_within):
    """most clones never come near anything; drop them (a big constant factor).

    Deliberately generous, and the final clearance is re-verified on the full
    untouched window so a mistake here cannot inflate the reported number.
    """
    Q, _ = clone_stack(g, tr, clones)
    P = tr.X @ g.B
    d = np.linalg.norm(P[:, None, None, :, :] - Q[None, :, :, :, :], axis=4)
    near = d.min(axis=(0, 2, 3))                              # per clone
    keep = [c for c in range(len(clones))
            if near[c] < keep_within or c == self_c]
    sub = [clones[c] for c in keep]
    return sub, (keep.index(self_c) if self_c in keep else None)


# --------------------------------------------------------------------------
#  contacts
# --------------------------------------------------------------------------

def find_contacts(g, tr, clones, gm, d_thresh):
    """Every encounter that comes within d_thresh, as a physical event.

    A maximal run of consecutive intervals below the threshold is one
    encounter; the contact sits at its exact closest approach.  Each physical
    collision is seen twice -- once by each participant, at times differing by
    the clone's tau -- and the two views are merged into a single event, keyed
    by the pair of contact midpoints computed in each participant's OWN frame
    (frame-independent, so the two views produce identical keys).
    """
    S = tr.S
    dm2 = gm['dm2']
    mask = dm2 < d_thresh ** 2
    if not mask.any():
        return []
    run_start = mask & ~np.roll(mask, 1, axis=-1)
    whole = mask.all(axis=-1)                                 # never separates
    if whole.any():
        for i, c, j in zip(*np.nonzero(whole)):
            run_start[i, c, j, :] = False
            run_start[i, c, j, int(np.argmax(dm2[i, c, j]))] = True

    out, keys = [], []
    for (i, c, j, k0) in np.argwhere(run_start):
        i, c, j, k0 = int(i), int(c), int(j), int(k0)
        # extent of this run -> the interval holding the closest approach
        ks, prof = [], dm2[i, c, j]
        k = k0
        for _ in range(S):
            if not mask[i, c, j, k]:
                break
            ks.append(k)
            k = (k + 1) % S
        kbest = min(ks, key=lambda q: prof[q])
        s = float(gm['ss'][i, c, j, kbest])
        cd = clones[c]
        a = cd['a']
        # the hard-sphere contact instant is the ENTRY crossing on the first
        # interval of the run: |A + s B|^2 = d^2, a quadratic in s.
        A0, B0 = gm['A'][i, c, j, k0], gm['B'][i, c, j, k0]
        qa, qb, qc = B0 @ B0, A0 @ B0, A0 @ A0 - d_thresh ** 2
        disc = qb * qb - qa * qc
        s_en = min(max((-qb - math.sqrt(disc)) / qa, 0.0), 1.0) \
            if (qa > 1e-300 and disc > 0) else 0.0
        rel_en = A0 + s_en * B0
        n_en = rel_en / max(np.linalg.norm(rel_en), 1e-300)
        rel = gm['A'][i, c, j, kbest] + s * gm['B'][i, c, j, kbest]
        gap = float(np.linalg.norm(rel))
        if gap < 1e-12:
            continue
        nh = rel / gap                                        # clone-j -> i
        hh = -(cd['Ri'].T @ nh)                               # in j's own frame
        ti = kbest + s
        tj = (kbest - a) % S + s
        mid_i = (tr.at(ti / S) @ g.B)[i] - 0.5 * gap * nh
        mid_j = (tr.at(tj / S) @ g.B)[j] - 0.5 * gap * hh
        end_i = (i, ti, mid_i[0], mid_i[1])
        end_j = (j, tj, mid_j[0], mid_j[1])
        key = np.array(sorted([end_i, end_j]), dtype=float).ravel()
        if any(np.abs(key - q).max() < 1e-7 for q in keys):
            continue                                          # other frame's view
        keys.append(key)
        ki = int(round(ti)) % S
        if ki == 0:
            ki = 1                                            # index 0 is a no-op
        if (ki - a) % S == 0:
            ki = (ki + 1) % S or 1
        out.append(dict(i=i, j=j, c=c, a=a, R=cd['R'], Ri=cd['Ri'],
                        ti=ti, tj=tj, nh=nh, hh=hh, gap=gap,
                        ki=ki, kj=(ki - a) % S, kbest=kbest, s=s,
                        k_en=k0, n_en=n_en))
    return out


def psi_matrix(S):
    """Psi[k, t]: displacement at sample t from a unit kink at interval k.

    Psi[k, 0] = Psi[k, S] = 0 identically, so the pinning of the start and of
    the drift is built into the parametrisation, not imposed afterwards.
    """
    k = np.arange(S)[:, None]
    t = np.arange(S + 1)[None, :]
    return np.maximum(0, t - k) - t * (1.0 - k / S)


def slot_ops(g, contacts):
    """one impulse per physical contact, acting on BOTH participants.

    Contact p adds D_p (lattice, row convention) to ball i at sample ki and
    D_p @ T_p to ball j at sample kj, where T_p transports the equal and
    opposite reaction back through the clone's rotation into the partner's own
    frame.  For the identity clone T = -I, i.e. plain Newton's third law; for a
    120-degree clone the reaction is the rotated one, which is exactly what
    makes an event at t in one ball's frame the same event at t - tau in the
    other's.
    """
    out = []
    for e in contacts:
        T = -(g.B @ e['Ri'] @ g.Binv)
        out.append(dict(i=e['i'], ki=e['ki'], j=e['j'], kj=e['kj'], T=T,
                        R=e['R'], nh=e['nh'], gap=e['gap']))
    return out


def slots_to_jumps(slots, D, n, S):
    J = np.zeros((n, S, 2))
    for p, sl in enumerate(slots):
        J[sl['i'], sl['ki']] += D[p]
        J[sl['j'], sl['kj']] += D[p] @ sl['T']
    return J


def closure_matrix(slots, n):
    """total impulse on each ball, as a linear map on the flattened D.

    Forcing it to zero is what makes the velocity return after a period, so
    there is no unexplained kink at the seam.
    """
    C = np.zeros((2 * n, 2 * len(slots)))
    for p, sl in enumerate(slots):
        C[2 * sl['i']:2 * sl['i'] + 2, 2 * p:2 * p + 2] += np.eye(2)
        C[2 * sl['j']:2 * sl['j'] + 2, 2 * p:2 * p + 2] += sl['T'].T
    return C


def closure_defect(g, tr):
    """|velocity after one period - velocity before|, per ball, cartesian.

    Zero means the polyline really closes: the ball leaves the seam on exactly
    the heading it arrived with, so t = 0 is not a disguised extra kink.
    """
    V = tr.U @ g.B
    return float(np.linalg.norm(V[:, 0, :] - V[:, -1, :], axis=1).max())


# --------------------------------------------------------------------------
#  the solver
# --------------------------------------------------------------------------

def merit_grad(g, tr, clones, self_c, target, Mall, aall, Psi,
               X0=None, raw=False, roam=0.7, w_roam=40.0):
    """merit, its gradient w.r.t. the jump field, and the true clearance.

    Every contribution enters through a closest approach, whose location inside
    a segment is a stationary point, so differentiating the distance only needs
    the explicit dependence: the unit normal, split between the two samples
    bracketing the contact.  The partner's share is carried back through the
    clone's matrix, which is what couples a ball to its own time-shifted copy.

    A one-sided barrier keeps each path within `roam` of its straight drift.
    Without it the solver walks a ball clean out of the finite clone window it
    is being tested against and reports a clearance that is not real -- the
    symmetry residual jumps from 1e-16 to O(1) when that happens, which is how
    it gets caught.
    """
    S = tr.S
    gm = pair_geometry(g, tr, clones, self_c, want_vel=False)
    dm2 = gm['dm2']
    # only the entries that actually violate need a square root, and they are
    # a small minority of every pair at every instant
    hit = dm2 < target * target
    viol = np.zeros_like(dm2)
    viol[hit] = target - np.sqrt(dm2[hit])
    m = float(viol[hit] @ viol[hit]) if hit.any() else 0.0
    GX = np.zeros_like(tr.X)
    if X0 is not None:
        dev = tr.X - X0
        r = np.linalg.norm(dev, axis=2)
        over = np.maximum(r - roam, 0.0)
        m += w_roam * float((over * over).sum())
        GX += (2 * w_roam * over / np.maximum(r, 1e-300))[:, :, None] * dev
    idx = np.argwhere(hit)
    if len(idx) == 0:
        out = GX if raw else np.tensordot(Psi, GX,
                                          axes=([1], [1])).transpose(1, 0, 2)
        return m, out, math.sqrt(dm2.min()), gm
    I, C, J, K = idx.T
    s = gm['ss'][I, C, J, K]
    rel = gm['A'][I, C, J, K] + s[:, None] * gm['B'][I, C, J, K]
    nh = rel / np.maximum(np.linalg.norm(rel, axis=1), 1e-300)[:, None]
    w = -2.0 * viol[I, C, J, K]
    gi = (w[:, None] * nh) @ g.B.T                    # lattice gradient
    np.add.at(GX, (I, K), (1 - s)[:, None] * gi)
    np.add.at(GX, (I, K + 1), s[:, None] * gi)
    gj = -np.einsum('eb,ebc->ec', gi, Mall[C])
    np.add.at(GX, (J, (K - aall[C]) % S), (1 - s)[:, None] * gj)
    np.add.at(GX, (J, (K + 1 - aall[C]) % S), s[:, None] * gj)
    out = GX if raw else np.tensordot(Psi, GX,
                                      axes=([1], [1])).transpose(1, 0, 2)
    return m, out, math.sqrt(dm2.min()), gm


def l1_kink_grad(J):
    """gradient of sum_k |J[i,k]| with respect to the path samples.

    A group-L1 pressure on the kinks: it costs the same to bend a lot once as a
    little often, so the descent gathers its bending into a few breakpoints
    instead of smearing it over every sample.  That is what makes the free
    phase produce something a contact-only subspace can actually represent --
    without it phase 1 finds a curve, not a polyline, and the projection in
    phase 2 throws most of it away.
    """
    nrm = np.linalg.norm(J, axis=2, keepdims=True)
    H = np.where(nrm > 1e-12, J / np.maximum(nrm, 1e-30), 0.0)
    n, S, _ = J.shape
    W = np.zeros((n, S + 3, 2))
    W[:, 1:S + 1, :] = H                              # J[k] lives at offset k+1
    return (W[:, 0:S + 1, :] - 2 * W[:, 1:S + 2, :] + W[:, 2:S + 3, :])


def descend_free(g, tr, clones, self_c, target, Mall, aall, Psi, X0,
                 iters, lr=0.02, beta=0.9, w_l1=0.0):
    """phase 1 -- find a corridor using every sample as a free breakpoint.

    This is deliberately unrestricted: it answers "is there room at all", and
    its answer is the initial guess phase 2 sparsifies.  The mean of the jump
    field is removed every step, which is the exact projection onto closed
    velocity, so even here there is no kink at the seam.
    """
    S = tr.S
    X = tr.X.copy()
    mom = np.zeros_like(X)
    best = (-1.0, tr.J.copy())
    for _ in range(iters):
        m, GX, clear, _ = merit_grad(g, tr, clones, self_c, target,
                                     Mall, aall, Psi, X0, raw=True)
        if clear > best[0]:
            best = (clear, tr.J.copy())
        if m == 0.0 and w_l1 == 0.0:
            break
        if w_l1:
            GX = GX + w_l1 * l1_kink_grad(tr.J)
        gn = float(np.linalg.norm(GX))
        if gn < 1e-14:
            break
        mom = beta * mom - lr * GX / gn
        X = X + mom
        X[:, 0, :] = tr.s
        X[:, S, :] = tr.s + tr.L                      # start and drift pinned
        # closed velocity: X[1] - X[0] must equal X[S] - X[S-1]
        r = 0.5 * (X[:, 1, :] + X[:, S - 1, :] - X[:, 0, :] - X[:, S, :])
        X[:, 1, :] -= r
        X[:, S - 1, :] -= r
        tr.set_jumps(x_to_jumps(X, tr))
    tr.set_jumps(best[1])
    return best[0]


def x_to_jumps(X, tr):
    """second difference of a pinned path -> the jump field it comes from."""
    U = np.diff(X, axis=1)
    J = np.zeros_like(U)
    J[:, 1:, :] = np.diff(U, axis=1)
    return J


def slot_subspace(g, tr, slots, Psi, w_tan=0.0):
    """the linear space of paths that bend ONLY at the given contacts.

    One column pair per contact: the tent it raises on ball i at sample ki plus
    the tent its equal-and-opposite reaction raises on ball j at kj.  The
    columns are then restricted to the null space of the closure map, so every
    path in the space already has a velocity that returns after a period.

    Restricting by PROJECTION rather than by re-parametrising is what makes
    phase 2 work: the descent step is taken in path space, where the geometry
    is well scaled, and only then dropped onto this subspace.
    """
    n, S, P = tr.n, tr.S, len(slots)
    if P == 0:
        return None
    A = np.zeros((n * (S + 1) * 2, 2 * P))
    for p, sl in enumerate(slots):
        for d in range(2):
            e = np.zeros(2)
            e[d] = 1.0
            col = np.zeros((n, S + 1, 2))
            col[sl['i']] += np.outer(Psi[sl['ki']], e)
            col[sl['j']] += np.outer(Psi[sl['kj']], e @ sl['T'])
            A[:, 2 * p + d] = col.ravel()
    C = closure_matrix(slots, n)
    _, sv, vt = np.linalg.svd(C)
    rank = int((sv > 1e-9 * max(sv.max(), 1e-30)).sum())
    Nb = vt[rank:].T                                  # (2P, q)
    Aeff = A @ Nb
    # w_tan biases impulses towards the contact normal -- among the paths in
    # the subspace fitting the descent step equally well, prefer the one whose
    # kinks lean least sideways.  It DEFAULTS TO ZERO, and main() shows why:
    # asking for frictionless contacts costs about a fifth of the clearance and
    # loses feasibility outright.  That is the tent obstruction again, measured
    # rather than argued.
    Tn = np.zeros((P, 2 * P))
    for p, sl in enumerate(slots):
        Tn[p, 2 * p:2 * p + 2] = [-sl['nh'][1], sl['nh'][0]]
    TN = Tn @ Nb
    scale = float((Aeff * Aeff).sum()) / max(float((TN * TN).sum()), 1e-30)
    G = Aeff.T @ Aeff + (w_tan * scale) * (TN.T @ TN)
    G += 1e-10 * np.trace(G) / max(len(G), 1) * np.eye(len(G))
    return dict(Nb=Nb, Aeff=Aeff, G=G, At=Aeff.T)


def descend_slots(g, tr, clones, self_c, slots, sub, target, Mall, aall, Psi,
                  X0, iters, lr=0.02, beta=0.85):
    """phase 2 -- projected gradient descent onto the contact subspace.

    Each unknown is one physical collision; the impulse it applies to the two
    participants is equal and opposite after transport through the clone.  The
    step is taken in path space and then projected, so a path that bends
    everywhere is pulled onto the nearest path that bends only at contacts,
    repeatedly, rather than being fitted once and abandoned.
    """
    n, S = tr.n, tr.S
    Nb, Aeff, G, At = sub['Nb'], sub['Aeff'], sub['G'], sub['At']

    def land(X):
        y = np.linalg.solve(G, At @ (X - X0).ravel())
        Xp = X0 + (Aeff @ y).reshape(n, S + 1, 2)
        D = (Nb @ y).reshape(-1, 2)
        return Xp, D

    X, D = land(tr.X.copy())
    tr.set_jumps(slots_to_jumps(slots, D, n, S))
    mom = np.zeros_like(X)
    best = (-1.0, D.copy())
    for _ in range(iters):
        m, GX, clear, _ = merit_grad(g, tr, clones, self_c, target,
                                     Mall, aall, Psi, X0, raw=True)
        if clear > best[0]:
            best = (clear, D.copy())
        if m == 0.0:
            break
        gn = float(np.linalg.norm(GX))
        if gn < 1e-14:
            break
        mom = beta * mom - lr * GX / gn
        X, D = land(X + mom)
        tr.set_jumps(slots_to_jumps(slots, D, n, S))
    D = best[1]
    tr.set_jumps(slots_to_jumps(slots, D, n, S))
    return best[0], D


def solve(g, starts, drifts, S, radius, margin=1.05, span=2,
          free_iters=80, slot_iters=140, sweeps=3, det=1.35, w_l1=0.10,
          w_tan=0.0, verbose=False):
    """corridor first, then sparsify onto the contacts.

    Phase 1 asks whether there is room at all, using every sample as a free
    breakpoint.  Phase 2 then asks for the same clearance from paths that bend
    ONLY where they meet something: the contacts of the phase-1 paths become
    the breakpoints, one paired impulse each, and the impulses are re-optimised
    against the same objective.  Repeating the pair a few times lets the
    contact set settle -- moving the paths moves which encounters exist, which
    is the self-consistency the problem is really about.
    """
    d_goal = 2 * radius * margin
    tr = Traj(starts, drifts, S)
    X0 = tr.X.copy()                                  # the straight drifts
    clones_full, self_full = build_clones(g, S, span)
    clones, self_c = cull_clones(g, tr, clones_full, self_full, d_goal + 0.6)
    Mall = np.array([c['M'] for c in clones])
    aall = np.array([c['a'] for c in clones])
    Psi = psi_matrix(S)

    descend_free(g, tr, clones, self_c, d_goal, Mall, aall, Psi, X0,
                 free_iters, w_l1=w_l1)
    if verbose:
        print(f"  phase 1 (free breakpoints): clearance "
              f"{min_clearance(g, tr, span=span + 1):.4f}")

    best = (-1.0, tr.J.copy(), [], np.zeros((0, 2)))
    slots, D = [], np.zeros((0, 2))
    for sw in range(sweeps):
        clones, self_c = cull_clones(g, tr, clones_full, self_full,
                                     d_goal + 0.6)
        Mall = np.array([c['M'] for c in clones])
        aall = np.array([c['a'] for c in clones])
        gm = pair_geometry(g, tr, clones, self_c)
        contacts = find_contacts(g, tr, clones, gm, d_goal * det)
        if not contacts:
            break
        slots = slot_ops(g, contacts)
        sub = slot_subspace(g, tr, slots, Psi, w_tan)
        _, D = descend_slots(g, tr, clones, self_c, slots, sub, d_goal,
                             Mall, aall, Psi, X0, slot_iters)
        clear = min_clearance(g, tr, span=span + 1)    # honest, unculled window
        if verbose:
            print(f"  phase 2 sweep {sw}: contacts {len(slots):3d}  "
                  f"clearance {clear:.4f}")
        if clear > best[0]:
            best = (clear, tr.J.copy(), slots, D.copy())
        if clear >= d_goal * (1 - 1e-6):
            break
        # not there yet: re-open the corridor from where we are and try again
        descend_free(g, tr, clones, self_c, d_goal, Mall, aall, Psi, X0,
                     free_iters // 2, w_l1=w_l1)

    tr.set_jumps(best[1])
    slots, D = best[2], best[3]
    # drop impulses too small to bend a path visibly, so the kink count is
    # honest; keep the pruning only if it costs no clearance
    if len(slots):
        keep = tr.J.copy()
        speed = float(np.linalg.norm(tr.U @ g.B, axis=2).mean())
        alive = np.linalg.norm(D, axis=1) > 3e-4 * speed
        if not alive.all():
            slots2 = [s for s, a in zip(slots, alive) if a]
            D2 = D[alive]
            tr.set_jumps(slots_to_jumps(slots2, D2, tr.n, S))
            if min_clearance(g, tr, span=span) >= best[0] - 1e-12:
                slots, D = slots2, D2
            else:
                tr.set_jumps(keep)
    return tr, slots, clones_full, self_full, d_goal


# --------------------------------------------------------------------------
#  Strategy B, literally: does the elastic iteration converge?
# --------------------------------------------------------------------------

def strategy_b_probe(g, starts, drifts, S, radius, margin=1.05, span=2,
                     iters=60):
    """Run the elastic exchange as specified, both ways, and report.

    variant 'closed' projects the impulses so the velocity returns after a
    period (sum_p L_p n_p = 0, L_p >= 0); variant 'open' does not and lets the
    closure defect be whatever it is.  Returns per-variant history.
    """
    d_goal = 2 * radius * margin
    clones, self_c = build_clones(g, S, span)
    report = {}
    for variant in ('closed', 'open'):
        tr = Traj(starts, drifts, S)
        hist, defect, kill = [], [], []
        for _ in range(iters):
            gm = pair_geometry(g, tr, clones, self_c)
            hist.append(math.sqrt(gm['dm2'].min()))
            cts = find_contacts(g, tr, clones, gm, d_goal)
            if not cts:
                break
            per = [[] for _ in range(tr.n)]
            for e in cts:
                # the hard-sphere instant is the entry crossing, where the pair
                # is still approaching, not the closest approach
                k = e['k_en'] if e['k_en'] else 1
                ui = gm['Vb'][e['i'], (k - 1) % S]
                up = gm['Qv'][e['c'], e['j'], (k - 1) % S]
                vn = float((ui - up) @ e['n_en'])
                if vn >= 0:
                    continue
                per[e['i']].append((k, e['n_en'], -vn, e))
            J = np.zeros((tr.n, S, 2))
            for i in range(tr.n):
                if not per[i]:
                    continue
                N = np.array([x[1] for x in per[i]])
                lam = np.array([x[2] for x in per[i]])
                raw = float(np.abs(lam).max())
                if variant == 'closed' and len(lam) >= 3:
                    G = N.T @ N
                    for _ in range(8):
                        lam = lam - N @ np.linalg.solve(G, N.T @ lam)
                        lam = np.maximum(lam, 0.0)
                kill.append(float(np.abs(lam).max()) / max(raw, 1e-12))
                defect.append(float(np.linalg.norm(N.T @ lam)))
                for (k, nh, _, _), l in zip(per[i], lam):
                    J[i, k] += (l * nh) @ g.Binv
            tr.set_jumps(J)
        gm = pair_geometry(g, tr, clones, self_c)
        hist.append(math.sqrt(gm['dm2'].min()))
        speed = float(np.linalg.norm(tr.U @ g.B, axis=2).mean())
        report[variant] = dict(
            best=max(hist), last=hist[-1], first=hist[0],
            tail=[round(h, 4) for h in hist[-8:]],
            closure_defect=(max(defect) if defect else 0.0),
            impulse_kept=(float(np.mean(kill)) if kill else float('nan')),
            speed=speed)
    return report


# --------------------------------------------------------------------------
#  measurement
# --------------------------------------------------------------------------

def min_clearance(g, tr, span=3):
    """exact continuous minimum centre distance, on an untouched wide window."""
    clones, self_c = build_clones(g, tr.S, span)
    gm = pair_geometry(g, tr, clones, self_c)
    return math.sqrt(gm['dm2'].min())


def orbit_cart(g, tr, clones, t):
    """every ball in the plane at global time t, cartesian, with ball index.

    Clones sharing an op share both the time offset and the rotation, so the
    motif is evaluated once per op and the lattice translations are a broadcast
    add.
    """
    byop = {}
    for cd in clones:
        byop.setdefault(cd['op'], []).append(cd)
    pts, idx = [], []
    for cds in byop.values():
        p = tr.at(t - cds[0]['a'] / tr.S)
        base = (p @ cds[0]['M'].T) @ g.B                  # (n, 2)
        mc = np.array([cd['m'] for cd in cds]) @ g.B      # (C, 2)
        pts.append((base[None, :, :] + mc[:, None, :]).reshape(-1, 2))
        idx.append(np.tile(np.arange(tr.n), len(cds)))
    return np.vstack(pts), np.concatenate(idx)


def check_symmetry(g, tr, shift, span=4, radius_keep=1.0, frames=16):
    """turn a frame by the generator; it must equal the frame `shift` later.

    The clone window is finite and is not carried to itself by the rotation, so
    only turned points well inside it are scored, against an orbit built on the
    same wide window.  The pattern is an orbit fill, so anything above rounding
    error is a bug, never a real asymmetry.
    """
    wide, _ = build_clones(g, tr.S, span)
    M = v = None
    for Mo, vo, tau in g.ops:
        if abs(tau - shift) < 1e-9:
            M, v = Mo, vo
    if M is None:
        return float('nan')
    worst = 0.0
    for f in range(frames):
        t = f / frames
        p0, i0 = orbit_cart(g, tr, wide, t)
        p1, i1 = orbit_cart(g, tr, wide, t + shift)
        turned = (g.lat(p0) @ M.T + v) @ g.B
        keep = np.linalg.norm(turned, axis=1) < radius_keep
        for pt, bi in zip(turned[keep], i0[keep]):
            same = p1[i1 == bi]
            worst = max(worst, float(np.linalg.norm(same - pt, axis=1).min()))
    return worst


def kink_stats(g, tr, tol=1e-6):
    """headings sampled every step; a kink is a step where the heading moves."""
    V = tr.U @ g.B
    nrm = np.linalg.norm(V, axis=2, keepdims=True)
    H = V / np.maximum(nrm, 1e-300)
    diff = np.linalg.norm(H - np.roll(H, 1, axis=1), axis=2)
    kinks = diff > tol
    return float(kinks.sum()) / tr.n, 1.0 - float(kinks.mean())


def restitution(g, tr, slots):
    """how elastic each surviving contact actually is.

    eps = -(normal relative velocity after) / (before).  eps = +1 is a true
    elastic bounce; eps < 0 means the path bowed AROUND its partner instead of
    reflecting off it, which the tent argument in the module docstring says has
    to happen once the start and the drift are both pinned.
    """
    S = tr.S
    out = []
    for sl in slots:
        i, j, ki, kj, R = sl['i'], sl['j'], sl['ki'], sl['kj'], sl['R']
        ub = (tr.U[i, (ki - 1) % S] @ g.B) - (tr.U[j, (kj - 1) % S] @ g.B) @ R
        ua = (tr.U[i, ki] @ g.B) - (tr.U[j, kj] @ g.B) @ R
        gb, ga = float(ub @ sl['nh']), float(ua @ sl['nh'])
        if abs(gb) > 1e-10:
            out.append(-ga / gb)
    return out


def tangential_fraction(g, tr, slots):
    """how far each contact impulse leans off the contact normal."""
    out = []
    for sl in slots:
        d = tr.J[sl['i'], sl['ki']] @ g.B
        nn = float(np.linalg.norm(d))
        if nn > 1e-12:
            out.append(abs(float(np.cross(d / nn, sl['nh']))))
    return out


# --------------------------------------------------------------------------
#  the benchmark
# --------------------------------------------------------------------------

TINY = dict(group='g226', n=3, S=72, radius=0.075, margin=1.05,
            starts=[[0.15, 0.20], [0.55, 0.35], [0.30, 0.75]],
            drifts=[[1, 0], [-1, 1], [0, -1]])

FULL = dict(group='g226', n=5, S=180, radius=0.070, margin=1.05,
            starts=[[0.15, 0.20], [0.55, 0.35], [0.30, 0.75],
                    [0.80, 0.70], [0.05, 0.55]],
            drifts=[[1, 0], [-1, 1], [0, -1], [1, -1], [0, 1]])


def _measure(g, tr, slots, spec, runtime):
    clear = min_clearance(g, tr, span=3)
    shift = min((tau for _, _, tau in g.ops if tau > 1e-9), default=0.0)
    kpb, straight = kink_stats(g, tr)
    return dict(
        runtime_sec=round(runtime, 3),
        min_clearance_ratio=round(clear / (2 * spec['radius']), 4),
        symmetry_residual=check_symmetry(g, tr, shift),
        kinks_per_ball=round(kpb, 3),
        straight_fraction=round(straight, 4),
        converged=bool(clear >= 2 * spec['radius']),
    )


def solve_spec(spec, verbose=False):
    t0 = time.time()
    g = Group(spec['group'])
    tr, slots, _, _, _ = solve(g, spec['starts'], spec['drifts'], spec['S'],
                               spec['radius'], margin=spec['margin'],
                               verbose=verbose)
    runtime = time.time() - t0
    return g, tr, slots, _measure(g, tr, slots, spec, runtime)


def solve_tiny(verbose=False):
    return solve_spec(TINY, verbose)[3]


def render(g, tr, radius, size=600, frames=60, cell_px=210.0, span=3):
    """the animation itself, so the full-problem estimate includes drawing."""
    from PIL import Image, ImageDraw                  # local: solving needs no PIL
    import colorsys
    n = tr.n
    cols = [tuple(int(255 * c) for c in
                  colorsys.hls_to_rgb((i / n + 0.05) % 1.0, 0.5, 0.62))
            for i in range(n)]
    clones, _ = build_clones(g, tr.S, span)
    r = radius * cell_px
    imgs = []
    for f in range(frames):
        img = Image.new("RGB", (size, size), (250, 249, 246))
        d = ImageDraw.Draw(img)
        pts, idx = orbit_cart(g, tr, clones, f / frames)
        for (px, py), i in zip(pts, idx):
            x, y = size / 2 + px * cell_px, size / 2 - py * cell_px
            if -2 * r <= x <= size + 2 * r and -2 * r <= y <= size + 2 * r:
                d.ellipse([x - r, y - r, x + r, y + r], fill=cols[i],
                          outline=(40, 44, 54), width=max(1, int(0.16 * r)))
        imgs.append(img)
    return imgs


def main():
    print("tent check (kink +y at k=20, S=72):")
    hi, lo, pred = tent_check()
    print(f"  path deviation range [{lo:.4f}, {hi:.2e}]   predicted min {pred:.4f}")
    print("  -> a kink bows the path AGAINST itself, so a repulsive contact"
          " impulse closes its own gap.\n")

    g = Group(TINY['group'])
    print("Strategy B, literal elastic exchange (60 iterations):")
    rep = strategy_b_probe(g, TINY['starts'], TINY['drifts'], TINY['S'],
                           TINY['radius'])
    for k, v in rep.items():
        print(f"  [{k:6s}] clearance start {v['first']:.4f} best {v['best']:.4f}"
              f" last {v['last']:.4f}   (need {2*TINY['radius']:.4f})")
        print(f"           tail {v['tail']}")
        print(f"           closure defect {v['closure_defect']:.3e}   "
              f"mean speed {v['speed']:.4f}   "
              f"impulse surviving projection {v['impulse_kept']*100:.0f}%")
    print("  -> neither variant converges: 'closed' cannot keep any impulse,"
          " 'open' diverges.\n")

    print("delivered solver, TINY:")
    g, tr, slots, out = solve_spec(TINY, verbose=True)
    eps = restitution(g, tr, slots)
    tan = tangential_fraction(g, tr, slots)
    print(f"  contacts {len(slots)}   closure defect {closure_defect(g, tr):.2e}"
          f"   (mean speed {np.linalg.norm(tr.U @ g.B, axis=2).mean():.4f})")
    if eps:
        print(f"  restitution: median {np.median(eps):+.2f}, "
              f"{100*np.mean(np.array(eps) > 0):.0f}% of contacts reflect"
              f" (eps>0), range [{min(eps):+.2f}, {max(eps):+.2f}]")
        print(f"  impulse tangential component: median "
              f"{np.median(tan):.2f} of unit")
    gaps = np.array([sl['gap'] for sl in slots]) / (2 * TINY['radius'])
    print(f"  contact gaps at detection / diameter: min {gaps.min():.2f} median "
          f"{np.median(gaps):.2f} max {gaps.max():.2f}"
          f"  ({int((gaps < 1.25).sum())} of {len(gaps)} genuinely tight)")
    print("  solve_tiny() ->")
    print(f"  {solve_tiny()}\n")

    print("cost of insisting the impulses be frictionless (along the normal):")
    for wt in (0.0, 0.2):
        tr2, sl2, _, _, _ = solve(g, TINY['starts'], TINY['drifts'],
                                  TINY['S'], TINY['radius'],
                                  margin=TINY['margin'], w_tan=wt)
        r2 = min_clearance(g, tr2, span=3) / (2 * TINY['radius'])
        t2 = tangential_fraction(g, tr2, sl2)
        print(f"  w_tan={wt:.2f}: clearance ratio {r2:.3f}"
              f"   median tangential component {np.median(t2):.2f}")
    print("  -> pulling contacts towards the normal loses feasibility;"
          " the tent obstruction again.\n")

    print("delivered solver, FULL (n=5, S=180, r=0.07) + 60 frames of 600x600:")
    g, tr, slots, outf = solve_spec(FULL)
    t0 = time.time()
    imgs = render(g, tr, FULL['radius'])
    draw = time.time() - t0
    print(f"  {outf}")
    print(f"  contacts {len(slots)}   render {draw:.2f}s for {len(imgs)} frames"
          f"   TOTAL {outf['runtime_sec'] + draw:.2f}s")


if __name__ == "__main__":
    main()
