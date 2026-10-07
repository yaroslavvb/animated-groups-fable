#!/usr/bin/env python3
"""The method that found the published g227 animation, one stage at a time.

This is the repository's own search job ``g227-bruss-a1b23-L40-s1``
(``run_brusselator`` in docs/scott-gray/research/equations/modal_equations.py),
re-run on this machine with the same functions from ``rdlab.py`` and the same
settings, split into the stages the tutorial describes and instrumented so each
stage reports what it did:

  1. the uniform state and its Hopf oscillation (a 2 x 2 matrix)
  2. the seed: the Brusselator's slow envelope (its complex Ginzburg-Landau
     form), simulated forward from noise inside the symmetry's character
     subspace, then polished; plus a control, the same noise never averaged
  3. the lift: that complex field turned into a Brusselator state
  4. Newton-Krylov on the twisted shooting equation, for one frame and T
  5. the movie, the audit, and a re-solve on a finer mesh
  6. the export, exactly as build_equation_atlas.py wrote the published bytes

Writes ``results.json`` (every number the tutorial quotes) and ``snapshots.npz``
(the fields its figures draw) into the output folder.

    python3 original.py [--out DIR]

Needs NumPy and SciPy and a checkout of animated-groups-fable, found through the
AGF_REPO environment variable or by walking up from this file.  About a minute
on an ordinary processor; no GPU, no network, no cost.
"""
import argparse
import hashlib
import json
import math
import os
import sys
import time
from pathlib import Path

import numpy as np


# ------------------------------------------------------------- the repository --
def find_repo() -> Path:
    env = os.environ.get('AGF_REPO')
    if env:
        return Path(env).expanduser().resolve()
    here = Path(__file__).resolve().parent
    for d in [here, *here.parents]:
        if (d / 'docs/scott-gray/research/equations/rdlab.py').exists():
            return d
    sys.exit('Set AGF_REPO to a checkout of animated-groups-fable.')


REPO = find_repo()
sys.path.insert(0, str(REPO / 'docs/scott-gray/research/equations'))
import rdlab  # noqa: E402  the repository's numerics: Laplacian, RK4, Newton-Krylov, audit
import scipy.optimize  # noqa: E402

# Count right-hand-side evaluations, the cost unit that survives a change of machine.
COUNT = {'brusselator': 0, 'ginzburg-landau': 0}
for _name in COUNT:
    _f = rdlab.MODELS[_name]['rhs']

    def _counted(q, p, lattice, h, _f=_f, _name=_name):
        COUNT[_name] += 1
        return _f(q, p, lattice, h)
    rdlab.MODELS[_name]['rhs'] = _counted
rdlab.rhs_ginzburg_landau = rdlab.MODELS['ginzburg-landau']['rhs']
rdlab.rhs_brusselator = rdlab.MODELS['brusselator']['rhs']
SHOOTS = [0]                                     # integrations over a third of a period
_twisted = rdlab.twisted_residual


def _twisted_counted(*a, **k):
    SHOOTS[0] += 1
    return _twisted(*a, **k)


rdlab.twisted_residual = _twisted_counted

# Log every Newton iteration.  rdlab calls scipy.optimize.root(method='krylov');
# adding a callback records the iterates without changing the arithmetic.
NEWTON_LOG = []
_root = scipy.optimize.root


def _root_logged(fun, x0, *args, **kw):
    log = []
    NEWTON_LOG.append(log)
    kw['callback'] = lambda x, f: log.append(dict(x=np.array(x), f=np.array(f),
                                                  rhs=dict(COUNT)))
    return _root(fun, x0, *args, **kw)


scipy.optimize.root = _root_logged


def rms(x):
    return float(np.sqrt(np.mean(np.square(x))))


# ------------------------------------------------------------------ the job --
JOB = json.loads((REPO / 'docs/scott-gray/research/equations/batches/bruss1/jobs.json').read_text())
JOB = next(j for j in JOB if j['id'] == 'g227-bruss-a1b23-L40-s1')
_, GROUPS = rdlab.load_groups(REPO / 'docs/scott-gray/wallpaper-groups.json')
G = GROUPS[JOB['groupId']]
P = dict(a=JOB['a'], b=JOB['b'], Du=JOB['Du'], Dv=JOB['Dv'])
L, N, M, LAT = float(JOB['L']), int(JOB['N']), int(JOB['M']), G['lattice']
H = L / N
CH = rdlab.Character(G, N)
EARLY = [0.0, 2.0, 5.0, 8.0, 12.0, 20.0, 50.0]   # snapshot times inside the first report interval


def main(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    R = dict(job=JOB, group=dict(id=G['id'], family=G['family'], lattice=LAT,
                                 operations=len(CH.ops), taus=[float(t) for t in CH.taus],
                                 kernel=len(CH.kernel), order=CH.order))
    snaps = {}
    t_start = time.perf_counter()

    # 1. the uniform state and its Hopf oscillation ------------------------------
    q0 = rdlab.uniform_equilibrium('brusselator', P, [P['a'], P['b'] / P['a']])
    lam, vec = rdlab.hopf_eigen('brusselator', P, q0, 0.0)
    i = int(np.argmax(lam.imag))
    e = vec[:, i] / vec[0, i]
    R['hopf'] = dict(equilibrium=q0.tolist(), eigenvalue=[float(lam[i].real), float(lam[i].imag)],
                     eigenvector=[[float(z.real), float(z.imag)] for z in e],
                     T0=2 * math.pi / float(lam[i].imag), onsetB=1 + P['a'] ** 2)

    # 2. the seed: Ginzburg-Landau inside the character subspace -----------------
    mu = P['b'] - 1 - P['a'] ** 2                     # distance above the Hopf point
    Lc = L * math.sqrt(2 * mu / max(P['Du'], P['Dv']))  # the box in Ginzburg-Landau units
    pc = dict(alpha=0.0, beta=float(JOB.get('seedBeta', 0.11)), D=2.0)
    hc = Lc / N
    R['gl'] = dict(mu=mu, Lc=Lc, params=pc, attempts=[])
    chosen = None
    for sign in (1, -1):
        c0 = dict(COUNT); t0 = time.perf_counter()
        # rdlab.cgl_relative_equilibrium, written out so the snapshots can be kept
        rng = np.random.default_rng(int(JOB.get('seed', 0)))
        B = 0.5 * (rng.standard_normal((N, N)) + 1j * rng.standard_normal((N, N)))
        noise = B.copy()
        B = CH.project_complex(B, sign)
        q = np.stack([B.real, B.imag]); dt = rdlab.timestep('ginzburg-landau', pc, hc)
        t, history, frames, early = 0.0, [], [B.copy()], {0.0: B.copy()}
        while t < 600:
            if t == 0:   # the first 50 time units in pieces, to keep pictures of them;
                for t1, t2 in zip(EARLY, EARLY[1:]):   # same steps, same arithmetic
                    q = rdlab.flow('ginzburg-landau', q, t2 - t1, pc, LAT, hc, dt)
                    early[t2] = q[0] + 1j * q[1]
            else:
                q = rdlab.flow('ginzburg-landau', q, 50.0, pc, LAT, hc, dt)
            t += 50.0
            B = CH.project_complex(q[0] + 1j * q[1], sign); q = np.stack([B.real, B.imag])
            F = rdlab.rhs_ginzburg_landau(q, pc, LAT, hc); Ft = F[0] + 1j * F[1]
            omega = float(np.imag(np.vdot(B, Ft)) / np.vdot(B, B).real)
            res = float(np.sqrt(np.mean(abs(Ft - 1j * omega * B) ** 2)))
            history.append(dict(t=t, omega=omega, residual=res, meanSquare=float(np.mean(abs(B) ** 2))))
            frames.append(B.copy())
            if res < 1e-9:
                break
        rhs_sim = COUNT['ginzburg-landau'] - c0['ginzburg-landau']
        # the same call the job made, to show the loop above is that function
        ref = rdlab.cgl_relative_equilibrium(G, N, Lc, pc, seed=int(JOB.get('seed', 0)), sign=sign,
                                             lattice=LAT, total_time=600, report_every=50, tol=1e-9)
        same = float(np.max(abs(ref['B'] - B)))
        c1 = dict(COUNT)
        pol = rdlab.cgl_polish(B, omega, CH, pc, LAT, hc, sign=sign)
        rhs_polish = COUNT['ginzburg-landau'] - c1['ginzburg-landau']
        movie, T_gl = rdlab.cgl_movie(pol['B'], pol['omega'], 48)
        a = rdlab.audit('ginzburg-landau', movie, pc, G, Lc, T_gl, LAT, dynamics=False)
        ok = bool(a['structuralPassed'] and pol['residual'] < 1e-8)
        R['gl']['attempts'].append(dict(
            sign=sign, history=history, matchesLibrary=same, simulatedTime=t,
            polish=dict(residual=pol['residual'], omega=pol['omega'], success=pol['success'],
                        newtonIterations=len(NEWTON_LOG[-1])),
            symmetryMax=a['symmetryMax'], structuralPassed=bool(a['structuralPassed']),
            accepted=ok, rhs=dict(simulation=rhs_sim, polish=rhs_polish)))
        snaps[f'gl_noise_s{sign:+d}'] = noise
        snaps[f'gl_frames_s{sign:+d}'] = np.array(frames)
        snaps[f'gl_early_s{sign:+d}'] = np.array([early[k] for k in EARLY])
        snaps['gl_early_times'] = np.array(EARLY)
        snaps[f'gl_polished_s{sign:+d}'] = pol['B']
        if ok:
            chosen = (sign, pol['B'])
            break
    if chosen is None:
        sys.exit('the Ginzburg-Landau stage failed')
    sign, Bgl = chosen

    # control: the same noise and the same equation, never averaged.  Does the
    # pattern form on its own?  share = the part of the field that has the
    # clockwork symmetry; spread = how unequally the points oscillate (0: all alike).
    def share_spread(Bc):
        Pc = CH.project_complex(Bc, sign)
        return (float(np.sum(abs(Pc) ** 2) / np.sum(abs(Bc) ** 2)),
                float(abs(Bc).std() / abs(Bc).mean()))
    rng = np.random.default_rng(int(JOB.get('seed', 0)))
    Bc = 0.5 * (rng.standard_normal((N, N)) + 1j * rng.standard_normal((N, N)))
    qc, tc, rows = np.stack([Bc.real, Bc.imag]), 0.0, []
    while True:
        share, spread = share_spread(Bc)
        rows.append(dict(t=tc, symmetricShare=share, spread=spread))
        if tc >= 600:
            break
        qc = rdlab.flow('ginzburg-landau', qc, 50.0, pc, LAT, hc, rdlab.timestep('ginzburg-landau', pc, hc))
        tc += 50.0
        Bc = qc[0] + 1j * qc[1]
    R['control'] = dict(description='step 2 from the same noise with no averaging', history=rows)

    # 3 and 4. lift, then Newton-Krylov on the twisted shooting equation ---------
    R['newton'] = []
    final = None
    for amp in (float(JOB.get('seedAmplitude', 0.25)), 2 * float(JOB.get('seedAmplitude', 0.25))):
        t0 = time.perf_counter()
        seed, w = rdlab.seed_from_complex('brusselator', P, q0, Bgl, amplitude=amp)
        T0 = 2 * math.pi / w
        r0 = CH.project_kernel(rdlab.twisted_residual('brusselator', CH.project_kernel(seed), T0,
                                                      P, LAT, H, CH))
        c1 = dict(COUNT); s1 = SHOOTS[0]
        pol = rdlab.rpo_polish('brusselator', seed, T0, P, LAT, H, CH, maxiter=60)
        log = NEWTON_LOG[-1]
        n = seed.size
        steps = [dict(iteration=k + 1, residual=rms(s['f'][:-1]), T=float(np.exp(s['x'][n])),
                      rhs=s['rhs']['brusselator'] - c1['brusselator']) for k, s in enumerate(log)]
        rec = dict(amplitude=amp, T0=T0, seedResidual=rms(r0), steps=steps, T=pol['T'],
                   residual=pol['residual'], success=pol['success'],
                   rhs=COUNT['brusselator'] - c1['brusselator'], shoots=SHOOTS[0] - s1,
                   seconds=time.perf_counter() - t0)
        R['newton'].append(rec)
        snaps[f'seed_a{amp}'] = seed
        snaps[f'iterates_a{amp}'] = np.array([CH.project_kernel(s['x'][:n].reshape(seed.shape)) for s in log])
        if pol['residual'] < 1e-8:
            final = (amp, pol['q'], pol['T'])
            break
    if final is None:
        sys.exit('Newton did not converge')
    amp, q, T = final

    # 5. the movie, the audit, a finer mesh --------------------------------------
    c0 = dict(COUNT); t0 = time.perf_counter()
    movie, s = [], q.copy()
    for j in range(M):
        movie.append(s.copy()); s = rdlab.flow('brusselator', s, T / M, P, LAT, H)
    movie = np.array(movie)
    a = rdlab.audit('brusselator', movie, P, G, L, T, LAT)
    R['audit'] = dict(passed=bool(a['passed']), symmetryMax=a['symmetryMax'],
                      visibilityPassed=bool(a['visibility']['passed']),
                      checks=a.get('independentDynamics', {}).get('checks'),
                      rhs=COUNT['brusselator'] - c0['brusselator'], seconds=time.perf_counter() - t0)
    c0 = dict(COUNT); t0 = time.perf_counter()
    N2 = int(JOB['refineN']); ch2 = rdlab.Character(G, N2); h2 = L / N2
    q2 = np.stack([rdlab.resample_complex(q[c].astype(complex), N2).real for c in range(2)])
    NEWTON_LOG.clear()
    pol2 = rdlab.rpo_polish('brusselator', q2, T, P, LAT, h2, ch2, maxiter=60)
    R['refine'] = dict(N=N2, T=pol2['T'], residual=pol2['residual'], iterations=len(NEWTON_LOG[-1]),
                       relativePeriodChange=abs(pol2['T'] - T) / T,
                       rhs=COUNT['brusselator'] - c0['brusselator'], seconds=time.perf_counter() - t0)
    R['seconds'] = time.perf_counter() - t_start   # includes the duplicate library check

    # 6. the export, as build_equation_atlas.py made the published bytes ---------
    coarse = movie[0].astype('<f4').astype(float)
    NEWTON_LOG.clear()
    pol3 = rdlab.rpo_polish('brusselator', coarse, T, P, LAT, H, CH, maxiter=40)
    frames, s = [], pol3['q'].copy()
    for j in range(48):
        frames.append(s.copy()); s = rdlab.flow('brusselator', s, pol3['T'] / 48, P, LAT, H)
    frames = rdlab.space_time_project(np.array(frames), CH)
    payload = frames.astype('<f4').tobytes()
    record = REPO / 'docs/scott-gray/data/equation-orbits/g227-brusselator-e47c12f9099fb9d2b6d4.json'
    pub = json.loads(record.read_text())
    stored = np.frombuffer((record.parent / pub['fieldUrl']).read_bytes(), dtype='<f4').reshape(frames.shape)
    R['export'] = dict(T=pol3['T'], publishedT=pub['period'], frames=48,
                       sha256=hashlib.sha256(payload).hexdigest(), publishedSha256=pub['fieldSha256'],
                       maxDifferenceFromPublished=float(np.max(abs(frames.astype('<f4') - stored))))
    snaps['movie'] = frames
    snaps['published'] = stored

    (out / 'results.json').write_text(json.dumps(R, indent=1))
    np.savez_compressed(out / 'snapshots.npz', **snaps)
    print(json.dumps(dict(sign=sign, amplitude=amp, T=T, newton=[(n['amplitude'], len(n['steps']), n['residual']) for n in R['newton']],
                          audit=R['audit']['passed'], refine=R['refine']['relativePeriodChange'],
                          export=R['export'], seconds=R['seconds']), indent=1))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=str(Path(__file__).resolve().parent / 'original-run'))
    main(Path(ap.parse_args().out))
