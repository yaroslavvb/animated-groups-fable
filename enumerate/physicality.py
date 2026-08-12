#!/usr/bin/env python3
"""How closely does a solved trajectory set behave like actual billiard balls?

A relaxation solver is free to bend a path wherever it likes, which is exactly
what makes the motion look wrong: a ball that changes direction in empty space,
or speeds up for no reason, reads as a glitch rather than as a ball. These are
the measures that catch it. Each is 0 for perfect billiards.

    free_kink_frac   fraction of direction changes that happen with NOTHING in
                     contact -- the single most visible defect, a ball veering
                     in open space
    impulse_misalign at a genuine contact the velocity change must lie along
                     the line of centres; this is the mean |sin| of the angle
                     between them
    speed_cv         coefficient of variation of a ball's speed across its own
                     segments. Equal-mass elastic collisions do change a ball's
                     speed, so this is not required to vanish -- but a large
                     value means the path is being stretched and squashed in
                     time rather than travelled
    energy_drift     the orbit's kinetic energy, summed over the copies in one
                     cell so every collision is counted in both its frames,
                     divided by its mean. Constant for elastic collisions
    turn_p95         95th percentile turn angle in degrees; near-reversals look
                     like a ball hitting a wall that is not there
"""

import numpy as np

import render_balls as R


def segments(B, V, L, S):
    """(times, velocities) per ball, in lattice coordinates per unit time"""
    out = []
    for i in range(len(B)):
        edges = list(B[i]) + [S]
        pts = [np.asarray(p, dtype=float) for p in V[i]] + \
              [np.asarray(V[i][0], dtype=float) + np.asarray(L[i], dtype=float)]
        vel, dur = [], []
        for k in range(len(edges) - 1):
            dt = (edges[k + 1] - edges[k]) / S
            vel.append((pts[k + 1] - pts[k]) / dt)
            dur.append(dt)
        out.append((np.array(edges[:-1]), np.array(vel), np.array(dur)))
    return out


def metrics(g, B, V, L, S, radius, span=3, contact_tol=0.06):
    X = R.rasterize(B, V, L, S)
    clones = R.integer_clones(g, span, S)
    allp = R.clone_stack(g, X, L, clones)          # (C, n, S, 2) cartesian
    base = X @ g.B
    d = np.linalg.norm(base[None, :, None, :, :] - allp[:, None, :, :, :], axis=4)
    d[d < 1e-9] = np.inf
    diameter = 2 * radius

    segs = segments(B, V, L, S)
    free, aligned, turns, cvs = [], [], [], []
    for i, (edges, vel, dur) in enumerate(segs):
        speed = np.linalg.norm(vel @ g.B, axis=1)
        cvs.append(float(np.std(speed) / max(np.mean(speed), 1e-12)))
        for k in range(len(edges)):
            s = int(edges[k])
            dv = (vel[k] - vel[k - 1]) @ g.B        # k-1 wraps to the last leg
            if np.linalg.norm(dv) < 1e-9:
                continue
            # what, if anything, is this ball touching at that instant?
            flat = d[:, i, :, s].ravel()
            j = int(np.argmin(flat))
            gap = (flat[j] - diameter) / diameter
            in_contact = gap <= contact_tol
            free.append(0.0 if in_contact else 1.0)
            vin = vel[k - 1] @ g.B
            vout = vel[k] @ g.B
            cosang = float(np.dot(vin, vout) /
                           max(np.linalg.norm(vin) * np.linalg.norm(vout), 1e-12))
            turns.append(math_degrees(cosang))
            if in_contact:
                c, jj = divmod(j, base.shape[0])
                n = base[i, s, :] - allp[c, jj, s, :]
                n = n / max(np.linalg.norm(n), 1e-12)
                u = dv / np.linalg.norm(dv)
                aligned.append(abs(float(u[0] * n[1] - u[1] * n[0])))   # |sin|

    # kinetic energy of one cell's worth of copies: every collision then
    # appears in both of its frames, so a physical solution keeps this flat
    speeds = np.zeros((len(B), S))
    for i, (edges, vel, dur) in enumerate(segs):
        v_of_s = np.zeros((S, 2))
        e = list(edges) + [S]
        for k in range(len(edges)):
            v_of_s[e[k]:e[k + 1]] = vel[k]
        speeds[i] = np.linalg.norm(v_of_s @ g.B, axis=1)
    ks = sorted({k for _, _, k in clones})
    E = np.zeros(S)
    for k in ks:
        E += (np.roll(speeds, k, axis=1) ** 2).sum(axis=0)
    return {
        "free_kink_frac": float(np.mean(free)) if free else 0.0,
        "impulse_misalign": float(np.mean(aligned)) if aligned else 0.0,
        "speed_cv": float(np.mean(cvs)),
        "energy_drift": float(np.std(E) / max(np.mean(E), 1e-12)),
        "turn_p95": float(np.percentile(turns, 95)) if turns else 0.0,
        "kinks": int(sum(len(b) for b in B)),
    }


def math_degrees(cosang):
    return float(np.degrees(np.arccos(np.clip(cosang, -1.0, 1.0))))


def score(m):
    """one number, lower is better; free kinks dominate because they are what
    reads as a glitch"""
    return (4.0 * m["free_kink_frac"] + 1.5 * m["impulse_misalign"] +
            1.0 * m["speed_cv"] + 1.0 * m["energy_drift"] +
            0.004 * m["turn_p95"])
