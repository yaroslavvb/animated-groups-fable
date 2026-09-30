"""DIRECT DETERMINISTIC RECIPE for the g227 Brusselator clockwork orbit.

Start from the clockwork symbol alone (the g227 ops), build the lowest twisted plane-wave
star (character_star_seed), lift it through the Hopf eigenvector and solve the twisted
shooting equation S_g Phi_{T/3}(q0) = q0 by Newton-Krylov.  No Ginzburg-Landau stage, no
random seed, no noise: the whole seed is fixed by the group and the reciprocal lattice.

Usage:  python direct.py <case-name> [--b 2.3] [--shell 1] [--sign 1] [--amp 0.25]
        python direct.py --list
Each case writes cases/<name>.json (+ .npz with the iterate snapshots and final movie).
"""
import argparse
import json
import math
import os
import platform
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import lab

HERE = os.path.dirname(os.path.abspath(__file__))
CASES_DIR = os.path.join(HERE, 'cases')
os.makedirs(CASES_DIR, exist_ok=True)

N = 36
L = 40.0
M_FRAMES = 48


def run_case(name, b=2.3, shell=1, sign=1, amplitude=0.25, maxiter=60, tol=1e-11,
             compare=True, audit=True, inner=40, relax=0.0):
    entry = lab.load_entry('g227')
    params = lab.brusselator_params(a=1.0, b=float(b))
    rec = dict(name=name, b=float(b), shell=int(shell), sign=int(sign),
               amplitude=float(amplitude), N=N, L=L, M=M_FRAMES, maxiter=maxiter, tol=tol,
               inner=int(inner), relax=float(relax),
               model='brusselator', groupId='g227')

    # ------------------------------------------------------------------ seed (group only)
    lab.reset_counters()
    t_seed = time.perf_counter()
    shells = lab.wave_shells(entry, N, L, radius=3, harmonic=sign)
    rec['shellSurvey'] = [dict(lam=s['lam'], k2=s['k2'], waves=s['waves'],
                               surviving=s['surviving'],
                               projectionNorm=s['projectionNorm']) for s in shells[:4]]
    try:
        s = lab.character_star_seed(entry, N=N, L=L, shell=shell, sign=sign,
                                    amplitude=amplitude, params=params)
    except ValueError as exc:
        rec['seedError'] = str(exc)
        rec['outcome'] = 'seed-failed'
        _save(name, rec, {})
        return rec
    rec['seedWallSeconds'] = time.perf_counter() - t_seed
    rec['seedCost'] = lab.counters()
    rec['wave'] = [int(x) for x in s['wave']]
    rec['seedSurviving'] = [[int(a), int(bb)] for a, bb in s['surviving']]
    rec['k2'] = s['k2']
    rec['lam'] = s['lam']
    rec['hopfOmega'] = s['omega']
    rec['hopfGrowth'] = s['growth']
    rec['T0'] = s['T0']
    rec['fourierComponents'] = int(np.sum(np.abs(np.fft.fft2(s['psi'])) / (N * N) > 1e-9))
    rec['seedCharacterError'] = lab.harmonic_character_error(
        s['psi'][None, ...], entry, harmonic=1)

    seed = s['seed']
    r0 = lab.twisted_residual(seed, s['T0'], entry, params, L=L, N=N)
    rec['seedResidualRms'] = float(np.sqrt(np.mean(r0 ** 2)))
    star_seed = seed.copy()

    # optional nonlinear relaxation of the SAME seed under the Brusselator itself
    # (no Ginzburg-Landau, no noise: just forward RK4 for `relax` time units)
    if relax:
        lab.reset_counters()
        t_r = time.perf_counter()
        seed = lab.flow(seed, float(relax), params, entry, L=L, N=N)
        T0r = lab.estimate_period(seed, entry, params, 0.8 * s['T0'], 1.3 * s['T0'],
                                  L=L, N=N, samples=41)
        rec['relaxWallSeconds'] = time.perf_counter() - t_r
        rec['relaxCost'] = lab.counters()
        rec['relaxPeriodScan'] = dict(T=T0r['T'], residualNorm=T0r['residualNorm'])
        rec['T0used'] = float(T0r['T'])
        rr = lab.twisted_residual(seed, rec['T0used'], entry, params, L=L, N=N)
        rec['relaxedResidualRms'] = float(np.sqrt(np.mean(rr ** 2)))
    else:
        rec['T0used'] = float(s['T0'])

    # ------------------------------------------------------- twisted shooting by Newton-Krylov
    lab.reset_counters()
    t0 = time.perf_counter()
    c0 = time.process_time()
    log = []

    def cb(info):
        line = (f"  iter {info['iteration']:3d}  rms {info['residualRms']:.6e}  "
                f"T {info['T']:.12f}  phase {info['phaseCondition']:+.2e}")
        print(line, flush=True)
        log.append(line)

    try:
        out = lab.newton_krylov_rpo(seed, rec['T0used'], entry, params, L=L, N=N,
                                    maxiter=maxiter, tol=tol, callback=cb, snapshots=True,
                                    inner_maxiter=int(inner))
    except Exception as exc:                      # divergence to inf/nan, inner solver failure
        rec['newtonException'] = f'{type(exc).__name__}: {exc}'
        rec['newtonWallSeconds'] = time.perf_counter() - t0
        rec['newtonCpuSeconds'] = time.process_time() - c0
        rec['converged'] = False
        rec['outcome'] = 'newton-diverged'
        rec['log'] = log
        rec['loadAverage'] = list(os.getloadavg())
        rec['totalWallSeconds'] = rec.get('seedWallSeconds', 0) + rec['newtonWallSeconds']
        rec['newton'] = dict(success=False, message=rec['newtonException'], iterations=0,
                             T=None, residual=None, wallSeconds=rec['newtonWallSeconds'],
                             cost=lab.counters())
        rec['history'] = []
        _save(name, rec, dict(seed=star_seed, seedUsed=seed, psi=s['psi']))
        return rec
    rec['newton'] = dict(success=out['success'], message=out['message'],
                         iterations=out['iterations'], T=out['T'],
                         residual=out['residual'], wallSeconds=out['wallSeconds'],
                         cost=out['cost'])
    rec['newtonWallSeconds'] = time.perf_counter() - t0
    rec['newtonCpuSeconds'] = time.process_time() - c0
    rec['history'] = [dict(iteration=h['iteration'], residualRms=h['residualRms'],
                           residualNorm=h['residualNorm'],
                           phaseCondition=h['phaseCondition'], T=h['T'])
                      for h in out['history']]
    arrays = dict(seed=star_seed, seedUsed=seed, psi=s['psi'],
                  iterates=np.array([h['q'] for h in out['history']]),
                  iterateT=np.array([h['T'] for h in out['history']]),
                  qFinal=out['q'])

    # honest criterion: the equation itself is solved.  (scipy reports success=False when the
    # last allowed iteration is the one that reaches tolerance -- see b=2.5 amplitude 0.50.)
    converged = bool(np.isfinite(out['residual']) and out['residual'] < 1e-8)
    rec['scipySuccess'] = bool(out['success'])
    rec['converged'] = converged

    # ------------------------------------------------------------------ what did we land on?
    if converged:
        lab.reset_counters()
        t1 = time.perf_counter()
        movie = lab.movie_from_state(out['q'], out['T'], entry, params, M=M_FRAMES, L=L, N=N)
        rec['movieCost'] = lab.counters()
        rec['movieWallSeconds'] = time.perf_counter() - t1
        arrays['movie'] = movie.astype(np.float32)
        rec['symmetryError'] = float(lab.symmetry_error(movie, entry))
        rec['uRange'] = [float(movie[:, 0].min()), float(movie[:, 0].max())]
        rec['amplitudeSpan'] = float(movie[:, 0].max() - movie[:, 0].min())

        Ahat = lab.first_harmonic(movie)
        rec['harmonicCharacter'] = lab.harmonic_character_error(Ahat, entry, harmonic=1)
        rec['harmonicMax'] = float(np.abs(Ahat[0]).max())
        vs = lab.find_vortices(Ahat, entry, channel=0)
        rec['vortices'] = [dict(charge=v['charge'], lattice=v['lattice'],
                                cartesian=v['cartesian']) for v in vs]
        rec['vortexCount'] = len(vs)
        rec['vortexChargeSum'] = int(sum(v['charge'] for v in vs))
        rows = lab.charges_at_centres(Ahat, entry, channel=0)
        rec['centres'] = [dict(k=r['k'], order=r['order'], predictedWinding=r['predictedWinding'],
                               measuredCharge=r['measuredCharge'], agrees=r['agrees'],
                               relativeAmplitudeAtCentre=r['relativeAmplitudeAtCentre'],
                               lattice=r['lattice']) for r in rows]
        rec['centresAgree'] = bool(all(r['agrees'] for r in rows))

        if audit:
            lab.reset_counters()
            t2 = time.perf_counter()
            a = lab.audit(movie, out['T'], entry, params, L=L, full=True)
            rec['auditPassed'] = bool(a['passed'])
            rec['auditSummary'] = a['summary']
            rec['auditWallSeconds'] = time.perf_counter() - t2
            rec['auditCost'] = lab.counters()

        if compare:
            pub = lab.load_published()
            cmp = lab.compare_orbits(pub, dict(frames=movie, period=out['T']), entry)
            rec['compare'] = cmp
            rec['sameOrbit'] = bool(cmp['sameOrbit'])
            rec['publishedPeriod'] = lab.G227_PERIOD
            rec['relativePeriodDifference'] = cmp['relativePeriodDifference']
        rec['outcome'] = 'converged'
    else:
        rec['outcome'] = 'newton-failed'

    rec['totalWallSeconds'] = rec.get('seedWallSeconds', 0) + rec['newtonWallSeconds'] \
        + rec.get('movieWallSeconds', 0) + rec.get('auditWallSeconds', 0)
    rec['loadAverage'] = list(os.getloadavg())
    rec['log'] = log
    _save(name, rec, arrays)
    return rec


def _save(name, rec, arrays):
    with open(os.path.join(CASES_DIR, name + '.json'), 'w') as fh:
        json.dump(lab.json_safe(rec), fh, indent=2)
    if arrays:
        np.savez_compressed(os.path.join(CASES_DIR, name + '.npz'), **arrays)


CASES = {
    #  name                 b     shell sign
    'b2.3-shell1-plus':  dict(b=2.3, shell=1, sign=+1),
    'b2.3-shell1-minus': dict(b=2.3, shell=1, sign=-1),
    'b2.3-shell2-plus':  dict(b=2.3, shell=2, sign=+1),
    'b2.3-shell2-minus': dict(b=2.3, shell=2, sign=-1),
    'b2.1-shell1-plus':  dict(b=2.1, shell=1, sign=+1, compare=False),
    'b2.5-shell1-plus':  dict(b=2.5, shell=1, sign=+1, compare=False),
    'b3.0-shell1-plus':  dict(b=3.0, shell=1, sign=+1, compare=False),
}

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('name', nargs='?')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--b', type=float)
    ap.add_argument('--shell', type=int)
    ap.add_argument('--sign', type=int)
    ap.add_argument('--amp', type=float)
    ap.add_argument('--maxiter', type=int)
    ap.add_argument('--inner', type=int)
    ap.add_argument('--relax', type=float)
    ap.add_argument('--no-compare', action='store_true')
    args = ap.parse_args()
    if args.list:
        print('\n'.join(CASES))
        sys.exit(0)
    kw = dict(CASES.get(args.name, {}))
    if args.b is not None:
        kw['b'] = args.b
    if args.shell is not None:
        kw['shell'] = args.shell
    if args.sign is not None:
        kw['sign'] = args.sign
    if args.amp is not None:
        kw['amplitude'] = args.amp
    if args.maxiter is not None:
        kw['maxiter'] = args.maxiter
    if args.inner is not None:
        kw['inner'] = args.inner
    if args.relax is not None:
        kw['relax'] = args.relax
    if args.no_compare:
        kw['compare'] = False
    print(f'== {args.name}  {kw}', flush=True)
    r = run_case(args.name, **kw)
    print(json.dumps({k: r[k] for k in ('outcome', 'converged', 'newtonWallSeconds')
                      if k in r}, indent=2))
