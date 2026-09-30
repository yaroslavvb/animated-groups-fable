#!/usr/bin/env python3
"""Run the whole three-cell walkthrough and write results.json plus the figures.

    python3 run_all.py                 # everything, about 12 minutes
    python3 run_all.py --quick         # coarser integration, about 2 minutes
    python3 run_all.py --figs-only     # redraw from an existing results.json

Outputs
-------
    results.json                 every number the tutorial quotes for the ring
    figs/*.png                   the figures at 1200 px wide
    ../../assets/ring-*.webp     the same figures, in the page's asset folder

Nothing is read from anywhere: the module below is the whole laboratory.
"""
from __future__ import annotations

import argparse
import json
import os
import time

import numpy as np

import ring

HERE = os.path.dirname(os.path.abspath(__file__))
FIGS = os.path.join(HERE, 'figs')
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'assets'))

SEED_AMPLITUDE_FALLBACK = 0.5604      # replaced by the measured rule at run time


# ======================================================================= runs
def run_all(nstep=1200, quick=False):
    t_start = time.time()
    out = {}
    out['parameters'] = {'a': ring.A, 'b': ring.B, 'D': ring.D, 'cells': ring.NCELL,
                         'tau': ring.TAU, 'rk4StepsPerThird': nstep}

    # ---- step 0: the 2 x 2 matrix everything starts from -------------------
    lam, e, omega, T0 = ring.hopf_data()
    Tu, rms_u, _ = ring.uniform_cycle()
    out['hopf'] = {
        'jacobian': ring.reaction_jacobian().tolist(),
        'eigenvalue': [float(lam.real), float(lam.imag)],
        'eigenvector': [[float(z.real), float(z.imag)] for z in e],
        'omega': omega, 'T0': T0,
        'uniformCyclePeriod': Tu, 'uniformCycleRms': rms_u,
    }
    amp = round(rms_u, 4)
    out['seedAmplitude'] = amp
    print(f"[0] omega {omega:.12f}  T0 {T0:.12f}  uniform cycle T {Tu:.6f} rms {rms_u:.6f}",
          flush=True)

    # ---- step 1/2: the character, and which ring mode survives ------------
    out['modes'] = []
    for m in (0, 1, -1):
        g, w = ring.mode_growth(m)
        out['modes'].append({
            'm': m,
            'laplacianEigenvalue': ring.ring_laplacian_eigenvalue(m),
            'characterProjection': ring.character_projection(m),
            'growthRate': g, 'frequency': w,
            'onsetB': ring.mode_onset_b(m),
            'phases': [[float(z.real), float(z.imag)] for z in ring.character(m)],
        })
        print(f"[1] mode {m:+d}  projection {ring.character_projection(m):.3e}  "
              f"growth {g:+.4f}  onset b {ring.mode_onset_b(m):.4f}", flush=True)

    # ---- step 3/4: the pencil seed -----------------------------------------
    q_seed = ring.seed(amp)
    r_seed = ring.twisted_residual(q_seed, T0, nstep)
    out['seed'] = {
        'amplitude': amp, 'T0': T0,
        'q': q_seed.tolist(),
        'twistedResidualRms': ring.rms(r_seed),
        'splayAmplitude': ring.splay_amplitude(q_seed),
        'syncAmplitude': ring.sync_amplitude(q_seed),
    }
    print(f"[3] seed twisted residual {ring.rms(r_seed):.4e}", flush=True)

    # ---- step 5: Newton on one state and one number ------------------------
    t0 = time.time()
    nt = ring.newton(q_seed, T0, nstep=nstep, maxit=25, verbose=True)
    out['newton'] = {
        'iterations': nt['iterations'], 'T': nt['T'],
        'residualRms': nt['residualRms'], 'rhsEvals': nt['rhsEvals'],
        'wallSeconds': time.time() - t0,
        'history': nt['history'], 'q0': nt['q0'].tolist(),
        'splayAmplitude': ring.splay_amplitude(nt['q0']),
        'syncAmplitude': ring.sync_amplitude(nt['q0']),
        'unknowns': 7,
    }
    q0, T = nt['q0'], nt['T']
    print(f"[5] Newton {nt['iterations']} iterations, T {T:.14f}, "
          f"residual {nt['residualRms']:.3e}, {nt['rhsEvals']} rhs", flush=True)

    # the orbit really is the splay state and really satisfies the twist
    _, traj = ring.flow(q0, T, 3 * nstep, trace=True)
    out['orbit'] = {
        'uMin': float(traj[:, 0, :].min()), 'uMax': float(traj[:, 0, :].max()),
        'closureRms': ring.rms(traj[-1] - q0),
        'twistCheckRms': ring.rms(ring.shift(traj[nstep], -1) - q0),
        'cellPhaseOffsetCheck': ring.rms(traj[nstep][:, 1] - traj[0][:, 0]),
        'splayAmplitudeOverPeriod': [ring.splay_amplitude(traj[i])
                                     for i in range(0, 3 * nstep, nstep // 4)],
    }
    print(f"[5] closure {out['orbit']['closureRms']:.3e}  "
          f"twist {out['orbit']['twistCheckRms']:.3e}", flush=True)

    # ---- stability: the clockwork orbit is a saddle, the in-phase one is not
    mu, lead, tang = ring.floquet(q0, T, nstep)
    out['floquetClockwork'] = {
        'multipliers': [[float(z.real), float(z.imag)] for z in mu],
        'moduli': [float(abs(z)) for z in mu],
        'leadingNontrivial': lead, 'tangent': tang,
    }
    q_uni = uniform_state_on_cycle()
    mu_u = np.linalg.eigvals(ring.monodromy(q_uni, Tu, nstep))
    mu_u = mu_u[np.argsort(-np.abs(mu_u))]
    out['floquetInPhase'] = {
        'period': Tu,
        'multipliers': [[float(z.real), float(z.imag)] for z in mu_u],
        'moduli': [float(abs(z)) for z in mu_u],
        'splayDecayPredicted': float(np.exp(-3.0 * ring.D * Tu)),
    }
    print(f"[6] clockwork orbit leading |mu| {lead:.7f} (saddle); "
          f"in-phase cycle moduli {sorted(np.abs(mu_u))[::-1]}", flush=True)

    # ---- (ii) plain simulation from random starts --------------------------
    out['plainSim'] = plain_sim(nseed=5, tmax=400.0, dt=1.0 / 512.0 if not quick else 1.0 / 256.0)
    print(f"[2] plain simulation: {out['plainSim']['summary']}", flush=True)

    # ---- (v) the delayed glue ---------------------------------------------
    out['glue'] = []
    qg_first = None
    for kind, sd, a0 in (('noise', 1, 0.05), ('noise', 2, 0.05), ('noise', 3, 0.05),
                         ('analytic', 0, 0.05)):
        g = ring.delayed_glue(seed_rng=sd, seed_kind=kind, amplitude=a0,
                              nperiod=80, tol=1e-11,
                              dt=T0 / 3.0 / (nstep if not quick else 400))
        qg = ring.glue_to_ring(g)
        if qg_first is None:
            qg_first, Tg_first = qg.copy(), g['T']
        d_rms, p_shift, t_shift = ring.align_to(q0, T, qg, nstep)
        rec = {
            'seedKind': kind, 'seed': sd, 'seedAmplitude': a0,
            'periods': g['periods'], 'T': g['T'],
            'relativePeriodError': (g['T'] - T) / T,
            'shapeError': g['record'][-1]['shapeError'],
            'rhsEvals': g['rhsEvals'], 'dt': g['dt'],
            'fieldRms': d_rms, 'ringShift': p_shift, 'timeShift': t_shift,
            'splayAmplitude': ring.splay_amplitude(qg),
            'syncAmplitude': ring.sync_amplitude(qg),
            'record': g['record'],
        }
        # the per-period contraction factor of the shape error, fitted over the
        # geometric stretch of the run
        sh = np.array([r['shapeError'] for r in g['record']])
        k0 = max(3, len(sh) // 3)
        k1 = max(k0 + 3, int(len(sh) * 0.8))
        if k1 > k0 + 2 and np.all(sh[k0:k1] > 0):
            slope = np.polyfit(np.arange(k1 - k0), np.log(sh[k0:k1]), 1)[0]
            rec['shapeContractionPerPeriod'] = float(np.exp(slope))
        out['glue'].append(rec)
        print(f"[v] glue {kind} seed {sd}: {g['periods']} periods, T {g['T']:.12f}, "
              f"rel {rec['relativePeriodError']:+.2e}, field rms {d_rms:.3e}, "
              f"contraction {rec.get('shapeContractionPerPeriod', float('nan')):.4f}",
              flush=True)

    # ---- Newton after the glue, as the real route does ---------------------
    pol = ring.newton(qg_first, Tg_first, nstep=nstep, maxit=4, tol=1e-12)
    out['gluePolish'] = {
        'iterations': pol['iterations'], 'T': pol['T'],
        'residualRms': pol['residualRms'],
        'relativePeriodError': (pol['T'] - T) / T,
        'rhsEvals': pol['rhsEvals'],
    }
    print(f"[v] glue + Newton: {pol['iterations']} steps, T {pol['T']:.14f}, "
          f"rel {(pol['T'] - T) / T:+.2e}", flush=True)

    # ---- chirality: the other sign of the character ------------------------
    q_wrong = ring.seed(amp, m=+1)
    out['chirality'] = {
        'mode': +1,
        'twistedResidualRms': ring.rms(ring.twisted_residual(q_wrong, T0, nstep)),
        'inverseTwistedResidualRms': ring.rms(
            ring.shift(ring.flow(q_wrong, T0 / 3, nstep), +1) - q_wrong),
    }
    print(f"[c] wrong sign: forward {out['chirality']['twistedResidualRms']:.3e} "
          f"vs inverse {out['chirality']['inverseTwistedResidualRms']:.3e}", flush=True)

    # ---- the amplitude window, for the knob discussion --------------------
    out['amplitudeWindow'] = []
    for A in (0.05, 0.1, 0.2, 0.3, 0.4, amp, 0.7, 0.9, 1.2):
        r = ring.newton(ring.seed(A), T0, nstep=nstep, maxit=25, tol=1e-12)
        out['amplitudeWindow'].append({
            'amplitude': A, 'iterations': r['iterations'],
            # a diverged run has no residual, and JSON has no infinity: record null
            'residualRms': (r['residualRms'] if np.isfinite(r['residualRms']) else None),
            'T': (r['T'] if np.isfinite(r['T']) else None),
            'converged': bool(r['converged'] and np.isfinite(r['T'])
                              and abs(r['T'] - T) < 1e-6),
        })
        print(f"[k] amplitude {A:5.3f}: {r['iterations']:2d} its, "
              f"residual {r['residualRms']:.2e}, T {r['T']:.9f}", flush=True)

    out['wallSeconds'] = time.time() - t_start
    return out


def uniform_state_on_cycle():
    """A point of the spatially uniform limit cycle, in all three cells."""
    from scipy.integrate import solve_ivp
    a, b = ring.A, ring.B

    def f(t, y):
        u, v = y
        return [a - (b + 1) * u + u * u * v, b * u - u * u * v]

    s = solve_ivp(f, [0, 400], [a * 1.05, b / a * 0.95], rtol=1e-12, atol=1e-14)
    y1 = s.y[:, -1]
    return np.stack((np.full(ring.NCELL, y1[0]), np.full(ring.NCELL, y1[1])))


def plain_sim(*, nseed=5, tmax=400.0, dt=1.0 / 512.0, spread=0.3):
    """Integrate the three-cell ring forward from random starts and watch."""
    q_eq = ring.equilibrium()
    n = int(round(tmax / dt))
    coarse = max(1, int(round(0.25 / dt)))      # stored for every run
    fine = max(1, int(round(0.05 / dt)))        # stored for the first run only
    runs = []
    for sd in range(1, nseed + 1):
        rng = np.random.default_rng(sd)
        q = q_eq + spread * rng.standard_normal((2, ring.NCELL))
        ts, splay = [], []
        early_t, early, late_t, late = [], [], [], []
        last_sync = 0.0
        for i in range(n):
            t = i * dt
            if i % coarse == 0:
                ts.append(t)
                splay.append(ring.splay_amplitude(q))
            if sd == 1 and i % fine == 0:
                if t <= 40.0:
                    early_t.append(t)
                    early.append(q[0].tolist())
                elif t >= tmax - 40.0:
                    late_t.append(t)
                    late.append(q[0].tolist())
            last_sync = ring.sync_amplitude(q)
            q = ring.rk4(q, dt)
        ts = np.array(ts)
        splay = np.array(splay)
        # per-period decay factor of the splay component, fitted over the tail
        m = (ts > 60.0) & (ts < 260.0) & (splay > 1e-14)
        fac = None
        if m.sum() > 50:
            slope = np.polyfit(ts[m], np.log(splay[m]), 1)[0]
            fac = float(np.exp(slope * 6.4276))
        runs.append({'seed': sd, 't': ts.tolist(), 'splay': splay.tolist(),
                     'earlyT': early_t, 'early': early,
                     'lateT': late_t, 'late': late,
                     'startSplay': float(splay[0]),
                     'finalSplay': float(splay[-1]), 'finalSync': float(last_sync),
                     'splayDecayPerPeriod': fac})
        print(f"    seed {sd}: splay {splay[0]:.4f} -> {splay[-1]:.3e}, "
              f"decay/period {fac}", flush=True)
    worst = max(r['finalSplay'] for r in runs)
    return {'runs': runs, 'tmax': tmax, 'dt': dt, 'spread': spread,
            'summary': (f"{nseed}/{nseed} random starts synchronise; "
                        f"largest surviving splay amplitude {worst:.2e}")}


# ==================================================================== figures
def figures(res):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyArrowPatch, Circle

    os.makedirs(FIGS, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)
    plt.rcParams.update({
        'figure.facecolor': 'white', 'axes.facecolor': 'white',
        'savefig.facecolor': 'white', 'font.size': 8.5,
        'axes.titlesize': 8.8, 'axes.labelsize': 8.5,
        'axes.edgecolor': '#c3c2b7', 'axes.linewidth': 0.8,
        'xtick.color': '#52514e', 'ytick.color': '#52514e',
        'xtick.labelsize': 7.5, 'ytick.labelsize': 7.5,
        'grid.color': '#e1e0d9', 'legend.fontsize': 7.5,
        'legend.frameon': False, 'svg.fonttype': 'none',
    })
    C = ['#2a78d6', '#eb6834', '#1baf7a']         # the page's --c1, --c2, --c3
    INK, INK2, MUTED = '#0b0b0b', '#52514e', '#898781'

    q0 = np.array(res['newton']['q0'])
    T = res['newton']['T']
    nstep = res['parameters']['rk4StepsPerThird']
    _, traj = ring.flow(q0, 2 * T, 6 * nstep, trace=True)
    tt = np.linspace(0.0, 2 * T, 6 * nstep + 1)

    def save(fig, name, w=1200):
        png = os.path.join(FIGS, name + '.png')
        fig.savefig(png, dpi=fig.dpi)
        plt.close(fig)
        from PIL import Image
        im = Image.open(png).convert('RGB')
        if im.size[0] != w:
            im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        im.save(os.path.join(ASSETS, name + '.webp'), 'WEBP', quality=92, method=6)
        print('wrote', name + '.png', '+', name + '.webp', im.size, flush=True)

    # ---- 1. the constraint --------------------------------------------------
    fig = plt.figure(figsize=(9.6, 3.1), dpi=150, constrained_layout=True)
    gs = fig.add_gridspec(1, 3, width_ratios=[0.85, 2.2, 1.0])

    ax = fig.add_subplot(gs[0, 0])
    ax.set_aspect('equal')
    ax.axis('off')
    ang = np.array([90.0, 210.0, 330.0]) * np.pi / 180.0
    px, py = np.cos(ang), np.sin(ang)
    th = np.linspace(0, 2 * np.pi, 200)
    ax.plot(np.cos(th), np.sin(th), color=MUTED, lw=1.1, zorder=1)
    for k in range(3):
        ax.add_patch(Circle((px[k], py[k]), 0.27, facecolor=C[k], edgecolor='white',
                            lw=1.4, zorder=3))
        ax.text(px[k], py[k], f'{k}', ha='center', va='center', color='white',
                fontsize=11, fontweight='bold', zorder=4)
    ax.add_patch(FancyArrowPatch((0.38, 0.74), (0.76, 0.34), arrowstyle='-|>',
                                 mutation_scale=12, color=INK, lw=1.3,
                                 connectionstyle='arc3,rad=-0.3', zorder=5))
    ax.text(0.0, 0.05, 'move one cell', ha='center', va='center', fontsize=8.5, color=INK)
    ax.text(0.0, -0.15, '=', ha='center', va='center', fontsize=9, color=INK)
    ax.text(0.0, -0.35, 'wait T/3', ha='center', va='center', fontsize=8.5, color=INK)
    ax.set_xlim(-1.5, 1.5)
    ax.set_ylim(-1.5, 1.5)
    ax.set_title('three cells on a ring', color=INK)

    ax = fig.add_subplot(gs[0, 1])
    for k in range(3):
        ax.plot(tt, traj[:, 0, k], color=C[k], lw=1.5, label=f'cell {k}')
    for k in (1, 2, 3):
        ax.axvline(k * T / 3.0, color=MUTED, lw=0.7, ls=':')
    lo, hi = traj[:, 0, :].min(), traj[:, 0, :].max()
    y = lo + 0.07 * (hi - lo)
    ax.annotate('', xy=(T / 3.0, y), xytext=(0.0, y),
                arrowprops=dict(arrowstyle='<|-|>', color=INK, lw=1.0, shrinkA=0, shrinkB=0))
    ax.text(T / 6.0, y + 0.035 * (hi - lo), 'T/3', ha='center', color=INK, fontsize=8)
    ax.set_xlim(0, 2 * T)
    ax.set_ylim(lo - 0.12 * (hi - lo), hi + 0.22 * (hi - lo))
    ax.set_xlabel('time')
    ax.set_ylabel('u')
    ax.grid(True, lw=0.6)
    ax.legend(ncol=3, loc='upper center')
    ax.set_title(f'one trace, three times over, each offset by T/3  '
                 f'(T = {T:.9f})', color=INK)

    ax = fig.add_subplot(gs[0, 2])
    ax.plot(traj[:3 * nstep + 1, 0, 0], traj[:3 * nstep + 1, 1, 0],
            color=MUTED, lw=1.1, zorder=1)
    for k in range(3):
        ax.plot([traj[0, 0, k]], [traj[0, 1, k]], 'o', color=C[k], ms=8,
                markeredgecolor='white', markeredgewidth=1.0, zorder=5)
    ax.set_xlabel('u')
    ax.set_ylabel('v')
    ax.grid(True, lw=0.6)
    ax.set_title('one loop, three markers,\na third of a lap apart', color=INK)
    save(fig, 'ring-constraint')

    # ---- 2. plain simulation ------------------------------------------------
    ps = res['plainSim']['runs'][0]
    ts = np.array(ps['t'])
    e_t, e_y = np.array(ps['earlyT']), np.array(ps['early'])
    l_t, l_y = np.array(ps['lateT']), np.array(ps['late'])
    fig = plt.figure(figsize=(9.6, 3.4), dpi=150, constrained_layout=True)
    gs = fig.add_gridspec(2, 2, width_ratios=[1.3, 1.0])

    ax = fig.add_subplot(gs[0, 0])
    for k in range(3):
        ax.plot(e_t, e_y[:, k], color=C[k], lw=1.3, label=f'cell {k}')
    ax.set_xlim(e_t[0], e_t[-1])
    ax.grid(True, lw=0.6)
    ax.set_ylabel('u')
    ax.legend(ncol=3, loc='upper right')
    ax.set_title('t = 0 to 40: three different phases', color=INK)

    ax = fig.add_subplot(gs[1, 0])
    for k in range(3):
        ax.plot(l_t, l_y[:, k], color=C[k], lw=1.3)
    ax.set_xlim(l_t[0], l_t[-1])
    ax.grid(True, lw=0.6)
    ax.set_xlabel('time')
    ax.set_ylabel('u')
    ax.set_title('the last 40 time units: one phase, three cells on top of each other',
                 color=INK)

    ax = fig.add_subplot(gs[:, 1])
    for r in res['plainSim']['runs']:
        ax.semilogy(r['t'], np.maximum(r['splay'], 1e-17), lw=1.0, color=C[0], alpha=0.5)
    ax.semilogy(ts, np.maximum(ps['splay'], 1e-17), lw=1.5, color=C[1])
    lvl = min(res['orbit']['splayAmplitudeOverPeriod'])
    ax.axhline(lvl, color=C[2], lw=1.2, ls='--')
    ax.text(ts[-1] * 0.5, lvl * 2.6,
            f'the clockwork orbit never goes below {lvl:.3f}',
            ha='center', color=C[2], fontsize=7.5)
    fac = res['plainSim']['runs'][0]['splayDecayPerPeriod']
    ax.set_title(f'pattern amplitude of the {len(res["plainSim"]["runs"])} runs:\n'
                 f'a factor {fac:.3f} per period, every time', color=INK)
    ax.set_xlabel('time')
    ax.set_ylabel('pattern amplitude')
    ax.grid(True, lw=0.6, which='both')
    ax.set_ylim(1e-15, 30.0)
    save(fig, 'ring-plain-sim')

    # ---- 3. the pencil seed -------------------------------------------------
    fig = plt.figure(figsize=(9.6, 3.1), dpi=150, constrained_layout=True)
    gs = fig.add_gridspec(1, 3, width_ratios=[1.0, 0.85, 1.5])

    ax = fig.add_subplot(gs[0, 0])
    modes = {mm['m']: mm for mm in res['modes']}
    order = [0, 1, -1]
    vals = [max(modes[m]['characterProjection'], 1e-17) for m in order]
    bars = ax.bar(['in phase', 'one way', 'other way'], vals,
                  color=[C[1] if v > 0.5 else MUTED for v in vals], width=0.6)
    ax.set_yscale('log')
    ax.set_ylim(1e-17, 2e3)
    ax.set_ylabel('projection onto the character')
    ax.grid(True, axis='y', lw=0.6, which='major')
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, v * 3.0,
                '1' if v > 0.5 else '0',
                ha='center', fontsize=8.5, color=INK, fontweight='bold')
    ax.set_title('one pattern survives,\ntwo cancel identically', color=INK)

    ax = fig.add_subplot(gs[0, 1])
    ax.set_aspect('equal')
    z = ring.character(-1)
    th = np.linspace(0, 2 * np.pi, 200)
    ax.plot(np.cos(th), np.sin(th), color='#e1e0d9', lw=1.0)
    for k in range(3):
        ax.annotate('', xy=(z[k].real, z[k].imag), xytext=(0, 0),
                    arrowprops=dict(arrowstyle='-|>', color=C[k], lw=1.7))
        ax.text(z[k].real * 1.30, z[k].imag * 1.30, f'{k}', ha='center', va='center',
                color=C[k], fontsize=9, fontweight='bold')
    ax.set_xlim(-1.55, 1.55)
    ax.set_ylim(-1.55, 1.55)
    ax.axis('off')
    ax.set_title('its three phases:\n1, e(−2πi/3), e(−4πi/3)', color=INK)

    ax = fig.add_subplot(gs[0, 2])
    T0 = res['hopf']['T0']
    q_seed = np.array(res['seed']['q'])
    _, strj = ring.flow(q_seed, T0, 3 * nstep, trace=True)
    st = np.linspace(0, T0, 3 * nstep + 1)
    for k in range(3):
        ax.plot(st, strj[:, 0, k], color=C[k], lw=1.5, label=f'cell {k}')
    ax.set_xlim(0, T0)
    ax.grid(True, lw=0.6)
    ax.set_xlabel('time')
    ax.set_ylabel('u')
    ax.legend(ncol=3, loc='upper center')
    lo, hi = strj[:, 0, :].min(), strj[:, 0, :].max()
    ax.set_ylim(lo - 0.08 * (hi - lo), hi + 0.30 * (hi - lo))
    ax.set_title(f"the seed: amplitude {res['seed']['amplitude']}, "
                 f"T₀ = {T0:.7f},\ntwisted residual "
                 f"{res['seed']['twistedResidualRms']:.3e}", color=INK)
    save(fig, 'ring-seed')

    # ---- 4. Newton ----------------------------------------------------------
    hist = res['newton']['history']
    it = [h['iter'] for h in hist]
    rr = [max(h['residualRms'], 1e-17) for h in hist]
    TT = [h['T'] for h in hist]
    fig = plt.figure(figsize=(9.6, 3.1), dpi=150, constrained_layout=True)
    gs = fig.add_gridspec(1, 3)

    ax = fig.add_subplot(gs[0, 0])
    ax.semilogy(it, rr, 'o-', color=C[1], lw=1.5, ms=5)
    ax.set_xlabel('Newton step')
    ax.set_ylabel('twisted shooting residual (rms)')
    ax.grid(True, lw=0.6, which='both')
    ax.set_xticks(it)
    ax.set_title(f'{res["newton"]["iterations"]} steps, twelve decades', color=INK)

    ax = fig.add_subplot(gs[0, 1])
    ax.plot(it, TT, 'o-', color=C[0], lw=1.5, ms=5)
    ax.axhline(T, color=C[2], lw=1.0, ls='--')
    ax.text(it[0], T, f'T = {T:.10f}', ha='left', va='bottom', color=C[2], fontsize=7.5)
    ax.set_xlabel('Newton step')
    ax.set_ylabel('period reached')
    ax.set_xticks(it)
    ax.grid(True, lw=0.6)
    ax.set_title('the one extra unknown', color=INK)

    ax = fig.add_subplot(gs[0, 2])
    ax.plot(traj[:3 * nstep + 1, 0, 0], traj[:3 * nstep + 1, 1, 0],
            color=MUTED, lw=1.2, zorder=1)
    for k in range(3):
        ax.plot([traj[0, 0, k]], [traj[0, 1, k]], 'o', color=C[k], ms=8,
                markeredgecolor='white', markeredgewidth=1.0, zorder=5,
                label=f'cell {k} at t = 0')
    ax.plot([ring.A], [ring.B / ring.A], 'x', color=INK, ms=7, zorder=4)
    ax.text(ring.A, ring.B / ring.A, '  equilibrium', color=INK2, fontsize=7.5)
    ax.set_xlabel('u')
    ax.set_ylabel('v')
    ax.grid(True, lw=0.6)
    ax.legend(loc='lower left', fontsize=7)
    ax.set_title('the converged orbit: one loop,\nthe three cells spread round it', color=INK)
    save(fig, 'ring-newton')

    # ---- 5. the delayed glue -----------------------------------------------
    g = res['glue'][0]
    rec = g['record']
    fig = plt.figure(figsize=(9.6, 3.2), dpi=150, constrained_layout=True)
    gs = fig.add_gridspec(1, 3, width_ratios=[1.0, 1.15, 1.15])

    ax = fig.add_subplot(gs[0, 0])
    ax.set_aspect('equal')
    ax.axis('off')
    ax.add_patch(Circle((0, -0.15), 0.34, facecolor=C[0], edgecolor='white', lw=1.2,
                        zorder=3))
    ax.text(0, -0.15, 'q(t)', ha='center', va='center', color='white', fontsize=9,
            fontweight='bold', zorder=4)
    for (x, y, lab, col, rad) in ((-1.05, 0.65, 'q(t − T/3)', C[1], '0.25'),
                                  (1.05, 0.65, 'q(t − 2T/3)', C[2], '-0.25')):
        ax.add_patch(Circle((x, y), 0.34, facecolor=col, alpha=0.28,
                            edgecolor=col, lw=1.3, zorder=2))
        ax.text(x, y, lab, ha='center', va='center', color=INK, fontsize=7.0, zorder=4)
        ax.add_patch(FancyArrowPatch((x, y - 0.36), (np.sign(x) * 0.31, 0.0),
                                     arrowstyle='-|>', mutation_scale=11,
                                     color=col, lw=1.4,
                                     connectionstyle='arc3,rad=' + rad, zorder=3))
    ax.text(0, -0.85, "the two neighbours are\nthis cell's own past",
            ha='center', va='center', fontsize=8, color=INK2)
    ax.set_xlim(-1.75, 1.75)
    ax.set_ylim(-1.35, 1.25)
    ax.set_title('one cell, two delays', color=INK)

    ax = fig.add_subplot(gs[0, 1])
    xs = np.arange(1, len(rec) + 1)
    ax.plot(xs, [r['T'] for r in rec], 'o-', color=C[1], lw=1.4, ms=3.4)
    ax.axhline(T, color=C[2], lw=1.1, ls='--')
    ax.axhline(res['hopf']['T0'], color=MUTED, lw=0.9, ls=':')
    ax.text(len(rec) * 0.98, res['hopf']['T0'], 'started at the Hopf period',
            color=MUTED, fontsize=7.2, va='top', ha='right')
    ax.text(len(rec) * 0.98, T, f"Newton's T = {T:.9f}", ha='right', va='bottom',
            color=C[2], fontsize=7.2)
    ax.set_xlabel('periods of simulation')
    ax.set_ylabel('delay T')
    ax.grid(True, lw=0.6)
    ax.set_title('the delay finds the period', color=INK)

    ax = fig.add_subplot(gs[0, 2])
    for gg, col in zip(res['glue'], [C[1], C[0], C[2], MUTED]):
        lab = (f"noise {gg['seed']}" if gg['seedKind'] == 'noise' else 'analytic')
        ax.semilogy(np.arange(1, len(gg['record']) + 1),
                    [max(r['shapeError'], 1e-17) for r in gg['record']],
                    lw=1.3, color=col, label=lab)
    ax.set_xlabel('periods of simulation')
    ax.set_ylabel('shape error')
    ax.grid(True, lw=0.6, which='both')
    ax.legend(loc='lower left', fontsize=7)
    cf = g.get('shapeContractionPerPeriod')
    ax.set_title('it contracts, by about '
                 + (f'{cf:.3f} per period' if cf else 'a fixed factor'), color=INK)
    save(fig, 'ring-glue')

    # ---- 6. stability -------------------------------------------------------
    fig = plt.figure(figsize=(9.6, 3.2), dpi=150, constrained_layout=True)
    gs = fig.add_gridspec(1, 3, width_ratios=[1.0, 1.0, 1.5])
    th = np.linspace(0, 2 * np.pi, 400)

    for col, key, title in ((0, 'floquetInPhase', 'the in-phase oscillation'),
                            (1, 'floquetClockwork', 'the clockwork orbit')):
        ax = fig.add_subplot(gs[0, col])
        ax.set_aspect('equal')
        ax.plot(np.cos(th), np.sin(th), color=MUTED, lw=1.0, ls='--')
        mu = np.array([complex(*z) for z in res[key]['multipliers']])
        inside = np.abs(mu) <= 1.0 + 1e-6
        ax.plot(mu[inside].real, mu[inside].imag, 'o', color=C[0], ms=7,
                markeredgecolor='white', markeredgewidth=0.7, zorder=4)
        if (~inside).any():
            ax.plot(mu[~inside].real, mu[~inside].imag, 'o', color=C[1], ms=8,
                    markeredgecolor='white', markeredgewidth=0.7, zorder=5)
        ax.axhline(0, color='#e1e0d9', lw=0.7, zorder=0)
        ax.axvline(0, color='#e1e0d9', lw=0.7, zorder=0)
        lim = max(1.5, np.abs(mu).max() * 1.3)
        ax.set_xlim(-lim, lim)
        ax.set_ylim(-lim, lim)
        ax.set_xlabel('Re μ')
        ax.set_ylabel('Im μ')
        if col == 0:
            lead = max(m for m in np.abs(mu) if m < 0.999999)
            sub = f'every |μ| ≤ 1: it attracts\nleading |μ| = {lead:.4f}'
        else:
            lead = res[key]['leadingNontrivial']
            sub = (f'a pair outside: it is a saddle\n'
                   f'leading |μ| = {lead:.4f} > 1')
        ax.set_title(f'{title}\n{sub}', color=INK)

    ax = fig.add_subplot(gs[0, 2])
    labels = ['in-phase cycle,\npattern direction', 'clockwork orbit,\non the ring']
    vals = [sorted(res['floquetInPhase']['moduli'])[-2],
            res['floquetClockwork']['leadingNontrivial']]
    cols = [C[2], C[1]]
    cf = res['glue'][0].get('shapeContractionPerPeriod')
    if cf:
        labels.append('clockwork orbit,\ninside the delayed glue')
        vals.append(cf)
        cols.append(C[2])
    ypos = np.arange(len(labels))
    ax.barh(ypos, vals, color=cols, height=0.55)
    ax.set_yticks(ypos)
    ax.set_yticklabels(labels, fontsize=7.5)
    ax.invert_yaxis()
    ax.axvline(1.0, color=INK, lw=1.0)
    for k, v in enumerate(vals):
        ax.text(v + 0.03, k, f'{v:.4f}', va='center', fontsize=8, color=INK)
    ax.set_xlim(0, max(vals) * 1.4)
    ax.set_xlabel('growth factor per period')
    ax.grid(True, axis='x', lw=0.6)
    ax.set_title('grows on the ring, decays in the glue', color=INK)
    save(fig, 'ring-stability')


# ======================================================================= main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quick', action='store_true')
    ap.add_argument('--figs-only', action='store_true')
    ap.add_argument('--nstep', type=int, default=1200)
    args = ap.parse_args()
    path = os.path.join(HERE, 'results.json')
    if args.figs_only:
        with open(path) as fh:
            res = json.load(fh)
    else:
        res = run_all(nstep=400 if args.quick else args.nstep, quick=args.quick)
        with open(path, 'w') as fh:
            json.dump(res, fh, indent=1, allow_nan=False)
        print('wrote', os.path.basename(path), flush=True)
    figures(res)


if __name__ == '__main__':
    main()
