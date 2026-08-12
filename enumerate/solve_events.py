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
  * the impulse is held close to the contact normal by a penalty, so contacts
    stay frictionless-looking; the residual tangential part is reported;
  * the velocity closes exactly around the period (sum of impulses = 0), so
    there is no phantom kink at the seam;
  * start and drift are pinned by construction -- the solver can only bend.

The impulse magnitudes are then found by damped Gauss-Newton on the exact
analytic gap functions (minimum separation of each encounter, a quadratic
minimisation per segment pair, differentiated with the envelope theorem) rather
than by the elastic rule.  The restitution each contact ends up with is
measured and reported, so the distance from a true billiard is a number, not a
hand-wave.

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


def clone_stack(g, tr, clones):
    """cartesian positions (C, n, S+1, 2) and velocities (C, n, S, 2).

    All clones sharing an op share the roll and the rotation -- they differ
    only by a lattice translation, which is one broadcast add -- so the work is
    three rolled arrays, not one per clone.
    """
    S, n = tr.S, tr.n
    X = tr.X[:, :S, :]
    idx = np.arange(S)
    Q = np.empty((len(clones), n, S + 1, 2))
    Qv = np.empty((len(clones), n, S, 2))
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
        Qv[cs] = ((tr.U[:, sh, :] @ M.T) @ g.B)[None]
    return Q, Qv


def pair_geometry(g, tr, clones, self_c):
    """exact per-interval closest approach of every base ball to every clone.

    Both members of a pair are straight on a sample interval (the clones' kinks
    sit on the same grid), so the separation is |A + s B| on s in [0, 1] and its
    minimum is a two-line formula -- no sampling error anywhere.
    """
    S, n = tr.S, tr.n
    P = tr.X @ g.B
    Vb = tr.U @ g.B
    Q, Qv = clone_stack(g, tr, clones)
    D = P[:, None, None, :, :] - Q[None, :, :, :, :]          # (i, C, j, S+1, 2)
    A = D[:, :, :, :S, :]
    B = D[:, :, :, 1:, :] - A
    aa = np.einsum('...d,...d->...', A, A)
    ab = np.einsum('...d,...d->...', A, B)
    bb = np.einsum('...d,...d->...', B, B)
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


def merit(gm, target):
    """total squared shortfall against `target`, over every instant and pair."""
    d = np.sqrt(np.minimum(gm['dm2'], target ** 2))
    v = target - d
    return float((v * v).sum())


def match_carry(new, old, D_old, S, window=5):
    """inherit impulses when the contact set is re-detected between rounds."""
    D = np.zeros((len(new), 2))
    taken = set()
    for p, e in enumerate(new):
        for q, f in enumerate(old):
            if q in taken or (e['i'], e['j'], e['c']) != (f['i'], f['j'], f['c']):
                continue
            d = abs(e['ki'] - f['ki']) % S
            if min(d, S - d) <= window:
                D[p] = D_old[q]
                taken.add(q)
                break
    return D


# --------------------------------------------------------------------------
#  influence of an impulse on the path (the tent, and its integral)
# --------------------------------------------------------------------------

def phi(kp, k, S):
    """velocity response at interval k to a unit kink at interval kp."""
    return (1.0 if kp <= k else 0.0) - 1.0 + kp / S


def psi(kp, t, S):
    """position response at time t (in samples) to a unit kink at kp.

    Integral of phi, i.e. the tent  max(0, k - kp) - k (1 - kp/S)  extended
    affinely inside the interval.  It is <= 0 everywhere: see the module
    docstring.
    """
    k = int(math.floor(t))
    f = t - k
    return max(0.0, k - kp) - k * (1.0 - kp / S) + f * phi(kp, k, S)


def contributions(contacts, n):
    """which impulses act on which ball, with what 2x2 transport matrix.

    Contact p pushes ball i by +D_p at sample ki and its partner ball j by
    -(D_p transported by the clone's inverse rotation) at sample kj: equal and
    opposite in the plane, hence a genuine momentum exchange even though the
    partner is a rotated, time-shifted copy.
    """
    out = [[] for _ in range(n)]
    I2 = np.eye(2)
    for p, e in enumerate(contacts):
        out[e['i']].append((e['ki'], I2, p))
        out[e['j']].append((e['kj'], -e['Ri'].T, p))
    return out


def path_jac(contrib_i, t, S, P):
    """d P_i(t) / d D  as a (2, 2P) matrix."""
    Jm = np.zeros((2, 2 * P))
    for (kp, A, p) in contrib_i:
        w = psi(kp, t, S)
        if w:
            Jm[:, 2 * p:2 * p + 2] += w * A
    return Jm


def vel_at(contrib_i, k, S, P, D, base):
    """cartesian velocity of ball i on interval k, given impulses D."""
    v = base.copy()
    for (kp, A, p) in contrib_i:
        v = v + phi(kp, k, S) * (A @ D[p])
    return v


# --------------------------------------------------------------------------
#  the solver
# --------------------------------------------------------------------------

def rebuild(g, tr, contacts, D):
    """impulses -> jump field -> trajectory (start and drift still pinned)."""
    J = np.zeros((tr.n, tr.S, 2))
    for p, e in enumerate(contacts):
        J[e['i'], e['ki']] += (D[p]) @ g.Binv
        J[e['j'], e['kj']] += (-(e['Ri'].T @ D[p])) @ g.Binv
    tr.set_jumps(J)
    return J


def newton_step(g, tr, contacts, D, target, mu, w_close, w_tan):
    """one Levenberg-Marquardt step on the exact gap functions.

    Rows: (a) gap_p >= target, linearised -- the contact time is a stationary
    point of the separation, so by the envelope theorem only the explicit
    dependence on the impulses survives; (b) the total impulse on each ball
    vanishes, so the velocity closes around the period exactly; (c) a penalty
    on the tangential part of each impulse, keeping contacts frictionless;
    (d) LM damping.

    Every gap row has entries of size ~S/4 with the same sign (all of psi is
    negative), so the block is nearly rank deficient and the weights have to be
    scaled to it -- an absolute ridge is either a no-op or a straitjacket.
    """
    S, n, P = tr.S, tr.n, len(contacts)
    contrib = contributions(contacts, n)
    rows, rhs = [], []

    for p, e in enumerate(contacts):
        Ji = path_jac(contrib[e['i']], e['ti'], S, P)
        Jj = path_jac(contrib[e['j']], e['tj'], S, P)
        rows.append(e['nh'] @ (Ji - e['R'].T @ Jj))
        rhs.append(max(0.0, target - e['gap']))
    Jg = np.array(rows)
    scale = max(float(np.abs(Jg).max()), 1e-12)

    clo = np.zeros((2 * n, 2 * P))
    for i in range(n):
        for (kp, A, p) in contrib[i]:
            clo[2 * i:2 * i + 2, 2 * p:2 * p + 2] += A
    tan = np.zeros((P, 2 * P))
    for p, e in enumerate(contacts):
        tan[p, 2 * p:2 * p + 2] = [-e['nh'][1], e['nh'][0]]

    flat = D.ravel()
    wc, wt, wr = w_close * scale, w_tan * scale, mu * scale
    A_ = np.vstack([Jg, wc * clo, wt * tan, wr * np.eye(2 * P)])
    b_ = np.concatenate([np.array(rhs), -wc * (clo @ flat),
                         -wt * (tan @ flat), -wr * flat])
    return np.linalg.lstsq(A_, b_, rcond=None)[0].reshape(P, 2)


def solve(g, starts, drifts, S, radius, margin=1.05, span=2, rounds=40,
          det=1.45, w_close=8.0, w_tan=0.25, mu0=0.35, verbose=False):
    """damped Gauss-Newton with a homotopy on the required clearance.

    Jumping straight at the full target makes the contact set churn and the
    linearisation is only good locally, so the required clearance is raised
    gradually and every step is line-searched on the true merit (total squared
    shortfall over every instant and every pair, not just the sampled ones).
    """
    d_goal = 2 * radius * margin
    tr = Traj(starts, drifts, S)
    clones_full, self_full = build_clones(g, S, span)
    clones, self_c = cull_clones(g, tr, clones_full, self_full, d_goal + 0.8)
    contacts, D = [], np.zeros((0, 2))
    gm = pair_geometry(g, tr, clones, self_c)
    clear = math.sqrt(gm['dm2'].min())
    best = (clear, tr.J.copy(), [], D)
    target = min(d_goal, max(2.5 * clear, 0.4 * d_goal))
    mu, stall = mu0, 0

    for it in range(rounds):
        new = find_contacts(g, tr, clones, gm, target * det)
        if not new:
            break
        D = match_carry(new, contacts, D, S)
        contacts = new
        step = newton_step(g, tr, contacts, D, target, mu, w_close, w_tan)

        base = merit(gm, target)
        acc = None
        for a in (1.0, 0.55, 0.3, 0.15, 0.07):
            Dt = D + a * step
            rebuild(g, tr, contacts, Dt)
            gt = pair_geometry(g, tr, clones, self_c)
            m = merit(gt, target)
            if m < base:
                acc, gm, base = Dt, gt, m
                break
        if acc is None:
            mu *= 4.0
            stall += 1
            rebuild(g, tr, contacts, D)
            if stall > 3:
                if target >= d_goal - 1e-12:
                    break
                target = min(d_goal, target * 1.12)           # push on anyway
                mu, stall = mu0, 0
                gm = pair_geometry(g, tr, clones, self_c)
            continue
        D, mu, stall = acc, max(mu * 0.6, 0.04), 0
        clear = math.sqrt(gm['dm2'].min())
        if clear > best[0]:
            best = (clear, tr.J.copy(), contacts, D.copy())
        if verbose:
            print(f"  round {it:3d}  clearance {clear:.4f}  target {target:.4f}"
                  f"  contacts {len(contacts):3d}  merit {base:.3e}  mu {mu:.3f}")
        if clear >= target - 1e-9:
            if target >= d_goal - 1e-12:
                break
            target = min(d_goal, target * 1.35)
            mu = mu0
        if it % 7 == 6:
            clones, self_c = cull_clones(g, tr, clones_full, self_full,
                                         d_goal + 0.8)
            gm = pair_geometry(g, tr, clones, self_c)

    tr.set_jumps(best[1])
    contacts = best[2]
    # drop impulses too small to bend the path visibly, so the kink count is
    # honest; keep the pruning only if it costs no clearance
    keep = tr.J.copy()
    speed = float(np.linalg.norm(tr.U @ g.B, axis=2).mean())
    J = tr.J.copy()
    J[np.linalg.norm(J, axis=2) < 3e-4 * speed] = 0.0
    tr.set_jumps(J)
    if min_clearance(g, tr, span=span) < best[0] - 1e-12:
        tr.set_jumps(keep)
    return tr, contacts, clones_full, self_full, d_goal


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
    """every ball in the plane at global time t (clones share tau, so cache)."""
    pts, idx, cache = [], [], {}
    for cd in clones:
        a = cd['a']
        if a not in cache:
            cache[a] = tr.at(t - a / tr.S)
        pts.append((cache[a] @ cd['M'].T + cd['m']) @ g.B)
        idx.append(np.arange(tr.n))
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


def restitution(g, tr, contacts):
    """how elastic each surviving contact actually is.

    eps = -(normal relative velocity after) / (before).  eps = 1 is a true
    elastic bounce, eps < 0 means the path bent around its partner instead of
    reflecting off it -- which the tent argument says must happen sometimes.
    """
    S, n, P = tr.S, tr.n, len(contacts)
    if P == 0:
        return []
    contrib = contributions(contacts, n)
    D = np.zeros((P, 2))
    for p, e in enumerate(contacts):
        D[p] = (tr.J[e['i'], e['ki']] @ g.B)                  # recovered impulse
    base = (tr.L @ g.B) / S
    out = []
    for p, e in enumerate(contacts):
        i, j, ki, kj, R = e['i'], e['j'], e['ki'], e['kj'], e['R']
        ub = (tr.U[i, (ki - 1) % S] @ g.B) - (tr.U[j, (kj - 1) % S] @ g.B) @ R
        ua = (tr.U[i, ki] @ g.B) - (tr.U[j, kj] @ g.B) @ R
        gb, ga = float(ub @ e['nh']), float(ua @ e['nh'])
        if abs(gb) > 1e-12:
            out.append(-ga / gb)
    return out


# --------------------------------------------------------------------------
#  the benchmark
# --------------------------------------------------------------------------

TINY = dict(group='g226', n=3, S=72, radius=0.075, margin=1.05,
            starts=[[0.15, 0.20], [0.55, 0.35], [0.30, 0.75]],
            drifts=[[1, 0], [-1, 1], [0, -1]])


def solve_tiny(verbose=False):
    t0 = time.time()
    g = Group(TINY['group'])
    tr, contacts, _, _, d_goal = solve(
        g, TINY['starts'], TINY['drifts'], TINY['S'], TINY['radius'],
        margin=TINY['margin'], verbose=verbose)
    runtime = time.time() - t0

    clear = min_clearance(g, tr, span=3)
    shift = min((tau for _, _, tau in g.ops if tau > 1e-9), default=0.0)
    sym = check_symmetry(g, tr, shift)
    kpb, straight = kink_stats(g, tr)
    return dict(
        runtime_sec=round(runtime, 3),
        min_clearance_ratio=round(clear / (2 * TINY['radius']), 4),
        symmetry_residual=sym,
        kinks_per_ball=round(kpb, 3),
        straight_fraction=round(straight, 4),
        converged=bool(clear >= 2 * TINY['radius']),
    )


def main():
    print("tent check (kink +y at k=20, S=72):")
    hi, lo, pred = tent_check()
    print(f"  path deviation range [{lo:.4f}, {hi:.2e}]   predicted min {pred:.4f}")
    print("  -> a kink bows the path AGAINST itself; a repulsive contact"
          " impulse closes its own gap.\n")

    g = Group(TINY['group'])
    print("Strategy B, literal elastic exchange:")
    rep = strategy_b_probe(g, TINY['starts'], TINY['drifts'], TINY['S'],
                           TINY['radius'])
    for k, v in rep.items():
        print(f"  [{k:6s}] start {v['first']:.4f} best {v['best']:.4f} "
              f"last {v['last']:.4f}  (need {2*TINY['radius']:.4f})")
        print(f"           tail {v['tail']}")
        print(f"           closure defect {v['closure_defect']:.3e}  "
              f"mean speed {v['speed']:.4f}  "
              f"impulse surviving projection {v['impulse_kept']*100:.0f}%")
    print("  -> neither variant converges; see module docstring.\n")

    print("delivered solver:")
    out = solve_tiny(verbose=True)
    print()
    print(out)


if __name__ == "__main__":
    main()
