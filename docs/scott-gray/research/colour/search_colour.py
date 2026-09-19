#!/usr/bin/env python3
"""Bounded local search for hexagonal periodic orbits that host the Gyre and Trefoil
three-colour rules, over the equations of rdlab_colour.py.

Each job is (model, parameter set, film group, cell side L, mesh N, seed, strategy).  A
worker runs one job under a wall-clock budget, and on success writes the movie as
``<job>/candidate.f32`` + ``<job>/candidate.json`` plus a ``result.json`` with the
admission certificate (``../equations/admit.py``, gate ``colour-offline-v1``) and the
colour measurements for both rules.  The parent appends one line per job to
``out/ledger.jsonl``.

Strategies
  phase       relative equilibria B(x) e^{i Omega t} of the phase-symmetric models
              (Ginzburg-Landau, cubic-quintic CGL, lambda-omega).  Both signs are tried.
  hopf-seed   a Ginzburg-Landau spiral lattice with the entry's character is lifted
              through the Hopf eigenvector of the target model and Newton-Krylov twisted
              shooting Phi_{T/m}(q) = q . g^{-1} is solved on the unprojected flow.
  projected   kernel-projected forward integration from noise, then the same twisted
              shooting.  The only route for the order-two entries (g246, g269, g271,
              g270, g233), whose characters carry no Ginzburg-Landau relative
              equilibrium, and for Gray-Scott, which has no Hopf point at all.

Usage
  python search_colour.py --plan first        # print the job list and exit
  python search_colour.py --plan first --run --workers 14 --budget 600
  python search_colour.py --plan long --run --workers 14 --budget 600 --deadline 14400
"""
import argparse, json, math, os, signal, sys, time, traceback
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rdlab_colour as rc                                                   # noqa: E402
import rdlab                                                               # noqa: E402
from rdlab_colour import (MODELS, PHASE_MODELS, PARAMETER_SETS, Character, flow,  # noqa: E402
                          timestep, space_time_project, seed_from_complex,
                          phase_relative_equilibrium, phase_polish, phase_movie,
                          character_seed_field, rpo_twisted, uniform_state, hopf_report,
                          gyre_colour, trefoil_colour, colour_statistics, gyre_quality,
                          trefoil_quality, hosts_trefoil, hosts_gyre, certify,
                          export_candidate, load_hex_groups, GATE)

OUT = HERE / 'out'
FRAMES = 96                 # divisible by 1, 2, 3 and 6: every hexagonal entry's frameMultiple


class Budget(Exception):
    pass


def _alarm(signum, frame):
    raise Budget('wall-clock budget exhausted')


# ------------------------------------------------------------------------------- scoring
def rank_turn_shifts(U, step=2, keep=24):
    """Cheap pass over the turn centres of the Gyre rule: ties and colour balance only."""
    M, N, _ = U.shape
    rows = []
    for wy in range(0, N, step):
        for wx in range(0, N, step):
            colour, ties, _ = gyre_colour(U, (wx, wy))
            f = np.array([float(np.mean(colour == c)) for c in range(3)])
            rows.append(dict(w=[wx, wy], ties=ties, spread=float(f.max() - f.min()),
                             fractions=f.tolist()))
    rows.sort(key=lambda r: (r['ties'], r['spread']))
    return rows[:keep]


def score_gyre(U, step=2, shortlist=16, finalists=3):
    """Rank turn centres, then run the full colour-symmetry sweep on the best few."""
    rows = rank_turn_shifts(U, step=step, keep=shortlist)
    mid = []
    for r in rows:
        colour, ties, _ = gyre_colour(U, r['w'])
        stats = colour_statistics(colour)
        mid.append({**r, **stats})
    # chunky (low boundary density), balanced, no speckle, no ties
    mid.sort(key=lambda r: (r['ties'] > 0, r['spread'] + 2.0 * r['boundaryDensity'] + 20.0 * r['speckleRate']))
    out = []
    for r in mid[:finalists]:
        q = gyre_quality(U, r['w'])
        q.pop('sweep', None)
        q['identityOpRows'] = [x for x in q['identityOpRows'] if x['perm'] != 'id' or x['frameShift'] != 0]
        out.append(q)
    return dict(shortlist=mid, finalists=out)


def score_trefoil(U, group):
    """Measure the Trefoil rule for each b-reversing half-period operation of the entry."""
    hosts = hosts_trefoil(group)
    out = []
    for hst in hosts:
        q = trefoil_quality(U, half_turn=hst['M'])
        q.pop('sweep', None)
        q['host'] = hst
        out.append(q)
    return out


def usable_gyre(q):
    """The Gyre page's quality gates, from research/entangled-design.md.  The published
    field measures 0 ties, law 1.0, balance exactly 1/3, boundary 0.30035, speckle 1.3e-4
    and no exact colour-preserving symmetry beyond the lattice."""
    return bool(q['ties'] == 0 and q['lawAgreement'] > 1 - 1e-12
                and q['balance'][0] >= 0.24 and q['balance'][1] <= 0.42
                and q['speckleRate'] <= 0.0025 and q['boundaryDensity'] <= 0.34
                and q['exactColourPreservingCount'] == 0)


def usable_trefoil(q):
    """The Trefoil page's quality gates, from research/s3-design.md.  The published field
    measures 0 ties, both laws 1.0, balance exactly 1/3, boundary 0.29025, speckle 9e-5,
    best purely spatial transposition 0.540375 and best mirror 0.477531."""
    return bool(q['ties'] == 0 and q['cycleAgreement'] > 1 - 1e-12
                and q['entangledAgreement'] > 1 - 1e-12
                and q['balance'][0] >= 0.24 and q['balance'][1] <= 0.42
                and q['speckleRate'] <= 0.0025 and q['boundaryDensity'] <= 0.34
                and q['bestSpatialTransposition'] < 1 - 1e-9)


# -------------------------------------------------------------------------------- strategies
def run_phase(job, group):
    model, p, N, L = job['model'], job['params'], job['N'], job['L']
    lattice = group['lattice']
    h = L / N
    best = None
    stages = []
    for sign in (job.get('sign'), ) if job.get('sign') else (1, -1):
        r = phase_relative_equilibrium(model, group, N, L, p, seed=job['seed'], sign=sign,
                                       lattice=lattice, total_time=job.get('totalTime', 600.0),
                                       report_every=50.0, tol=1e-10,
                                       amplitude=job.get('amplitude', 0.5))
        rec = dict(sign=sign, omega=r['omega'], residual=r['residual'],
                   meanSquare=float(np.mean(abs(r['B']) ** 2)))
        if not np.isfinite(r['residual']) or r['residual'] > 1e-2 or rec['meanSquare'] < 1e-4:
            rec['outcome'] = 'collapsed' if rec['meanSquare'] < 1e-4 else 'not converged'
            stages.append(rec)
            continue
        pol = phase_polish(model, r['B'], r['omega'], r['character'], p, lattice, h, sign=sign)
        if pol['residual'] < r['residual']:
            B, omega, rec['polishResidual'] = pol['B'], pol['omega'], pol['residual']
        else:
            B, omega, rec['polishResidual'] = r['B'], r['omega'], r['residual']
        rec['omega'] = float(omega)
        rec['residual'] = float(min(rec['polishResidual'], r['residual']))
        movie, T = phase_movie(B, omega, FRAMES)
        # The site's relation q(gx, t + tau T) = q(x, t) means B(gx) = B(x) exp(-i sign(Omega) 2 pi tau),
        # so only the sign opposite to the converged Omega realises the entry.  Measure it on the
        # unprojected movie rather than trusting the arithmetic, because space_time_project would
        # silently annihilate a state that sits in the wrong subspace.
        rec['unprojectedSymmetryMax'] = float(r['character'].symmetry_error(movie))
        if rec['unprojectedSymmetryMax'] > 1e-9:
            rec['outcome'] = 'wrong phase sign for this entry'
            stages.append(rec)
            continue
        movie = space_time_project(movie, r['character'])
        rec['period'] = float(T)
        rec['outcome'] = 'candidate'
        stages.append(rec)
        if best is None or rec['residual'] < best[0]['residual']:
            best = (rec, movie, T)
    if best is None:
        return dict(outcome='no-relative-equilibrium', stages=stages)
    rec, movie, T = best
    return dict(outcome='candidate', stages=stages, movie=movie, T=float(T),
                method='relative equilibrium', detail=rec)


def seed_state(job, group, model, p, N, L):
    """The initial condition for the twisted-shooting strategies."""
    rng = np.random.default_rng(job['seed'] * 7919 + 13)
    ch = Character(group, N)
    if job['strategy'] == 'hopf-seed':
        B, res = character_seed_field(group, N, L, sign=job.get('sign', 1), seed=job['seed'],
                                      lattice=group['lattice'],
                                      alpha=job.get('seedAlpha', 0.5), beta=job.get('seedBeta', 0.5),
                                      total_time=job.get('seedTime', 300.0))
        # Only a seed, so a loose tolerance: the order-two entries (g246, g269, g271, g233,
        # g270) carry no true Ginzburg-Landau relative equilibrium -- the cell's phase
        # windings cannot sum to zero -- but the projected flow still settles into a state
        # with the right character, and that is all Newton needs to start from.
        if not np.isfinite(res) or res > 0.3 or float(np.mean(abs(B) ** 2)) < 1e-4:
            return None, dict(reason='no character seed', seedResidual=float(res))
        q0 = uniform_state(model, p)
        q, omega = seed_from_complex(model, p, q0, B, job.get('amplitude', 0.25))
        return ch.project_kernel(q), dict(seedResidual=float(res), hopfOmega=float(omega))
    if model == 'gray-scott':
        q = np.stack([np.ones((N, N)), np.zeros((N, N))])
        blobs = rng.random((N, N)) < 0.08
        q[0][blobs] = 0.5
        q[1][blobs] = 0.25
        return ch.project_kernel(q), dict()
    q0 = uniform_state(model, p)
    q = q0[:, None, None] + job.get('amplitude', 0.25) * rng.standard_normal((2, N, N)) * np.maximum(abs(q0), 0.2)[:, None, None]
    return ch.project_kernel(q), dict()


def run_twisted(job, group):
    """Both senses of the seed spiral are tried: the sign of the Ginzburg-Landau character
    fixes which way the spiral turns, and only one of the two can satisfy an entry's
    directed phases, so a search that fixes it a priori silently loses half the entries."""
    if job['strategy'] == 'hopf-seed' and job.get('sign') is None:
        attempts = []
        for sign in (1, -1):
            r = run_twisted({**job, 'sign': sign}, group)
            attempts.append(dict(sign=sign, outcome=r['outcome']))
            if r['outcome'] == 'candidate':
                r['detail'] = dict(r.get('detail') or {}, sign=sign, attempts=attempts)
                return r
            last = r
        last['detail'] = dict(last.get('detail') or {}, attempts=attempts)
        return last
    model, p, N, L = job['model'], job['params'], job['N'], job['L']
    lattice = group['lattice']
    h = L / N
    q, info = seed_state(job, group, model, p, N, L)
    if q is None:
        return dict(outcome='no-seed', detail=info)
    ch = Character(group, N)
    if ch.generator is None:
        return dict(outcome='no-phase-generator')
    rep = hopf_report(model, p) if model != 'gray-scott' else dict(naturalPeriod=None)
    T0 = job.get('T0') or rep.get('naturalPeriod') or 40.0
    # A long unprojected transient is exactly what destroys the structure: these uniform
    # limit cycles are stable, so anything without a topological defect relaxes onto them.
    # The Hopf-seeded route therefore shoots straight from the lifted spiral lattice.
    transient = job.get('transient', 0.0 if job['strategy'] == 'hopf-seed' else 200.0)
    if transient > 0:
        q = ch.project_kernel(flow(model, q, transient, p, lattice, h))
    if not np.isfinite(q).all():
        return dict(outcome='diverged', detail=info)
    spatial0 = float(np.sqrt(np.mean((q - q.mean(axis=(1, 2), keepdims=True)) ** 2)))
    if spatial0 < 1e-4:
        return dict(outcome='synchronised-to-uniform', detail=dict(**info, seedSpatialRms=spatial0))
    r = rpo_twisted(model, group, N, L, p, q, T0, M=FRAMES, lattice=lattice,
                    window=job.get('window', (0.45, 2.6)), samples=job.get('samples', 30),
                    maxiter=job.get('maxiter', 40))
    detail = dict(**info, T0=T0, seedSpatialRms=spatial0,
                  seedTwistedResidual=r['seedTwistedResidual'], polish=r['polish'])
    if not np.isfinite(r['movie']).all():
        return dict(outcome='diverged-after-polish', detail=detail)
    if r['polish']['residual'] > 1e-6:
        return dict(outcome='newton-not-converged', detail=detail)
    movie = space_time_project(r['movie'], ch)
    spatial = float(np.sqrt(np.mean((movie - movie.mean(axis=(2, 3), keepdims=True)) ** 2)))
    detail['spatialRms'] = spatial
    temporal = float(np.sqrt(np.mean((movie - movie.mean(axis=0, keepdims=True)) ** 2)))
    detail['temporalRms'] = temporal
    if spatial < rc.LIMITS['minimumSpatialRms']:
        # Newton found a genuine orbit, but it is the spatially uniform limit cycle
        # (with T = order x the uniform period): no picture, no colours.
        return dict(outcome='synchronised-to-uniform', detail=detail)
    if temporal < rc.LIMITS['minimumTemporalRms']:
        # The twisted equation S_g Phi_{T/m}(q) = q holds at *every* T for a g-symmetric
        # steady state, so Newton is free to fall into one.  Those are patterns, not films.
        return dict(outcome='converged-to-steady-state', detail=detail)
    return dict(outcome='candidate', movie=movie, T=float(r['T']),
                method='twisted shooting (%s)' % job['strategy'], detail=detail)


# ------------------------------------------------------------------------------------ worker
def run_job(job):
    started = time.time()
    folder = OUT / job['batch'] / job['id']
    out = dict(id=job['id'], batch=job['batch'], job={k: v for k, v in job.items() if k != 'batch'})
    signal.signal(signal.SIGALRM, _alarm)
    signal.setitimer(signal.ITIMER_REAL, float(job.get('budget', 600)))
    try:
        _, groups = load_hex_groups()
        group = groups[job['groupId']]
        r = run_phase(job, group) if job['strategy'] == 'phase' else run_twisted(job, group)
        out.update({k: v for k, v in r.items() if k != 'movie'})
        if r['outcome'] != 'candidate':
            return _finish(out, started, folder, write=True)
        movie, T = r['movie'], r['T']
        a = rdlab.audit(job['model'], movie, job['params'], group, job['L'], T, group['lattice'],
                        dynamics=True)
        out['audit'] = {k: v for k, v in a.items() if k != 'visibility'}
        out['visibilityPassed'] = a['visibility']['passed']
        if not a.get('passed'):
            out['outcome'] = 'audit-failed'
            return _finish(out, started, folder, write=True)
        # export, then re-admit from the exported Float32 bytes
        h = job['L'] / job['N']
        config = dict(N=job['N'], M=movie.shape[0], L=job['L'], period=float(T),
                      groupId=group['id'], model=job['model'],
                      params={**job['params'], 'dx': h, 'stencil': 'triangular-six'},
                      ops=group['ops'])
        payload = movie.astype('<f4')
        field = np.frombuffer(payload.tobytes(), dtype='<f4').reshape(movie.shape)
        proof = certify(field, config, group)
        out['certificatePassed'] = bool(proof['passed'])
        if not proof['passed']:
            out['outcome'] = 'not-admitted'
            out['certificate'] = {k: proof.get(k) for k in
                                  ('phaseRelations', 'temporalResolution', 'spatialRms',
                                   'temporalRms', 'minimum', 'maximum', 'independentDynamics')}
            return _finish(out, started, folder, write=True)
        # colour measurements on exactly the bytes the browser would load
        U = np.array(field[:, 0], dtype=np.float64)
        # Step 1, not 3: the turn shifts w with both components divisible by three put the
        # turn centre on a threefold centre of the field, where the rule degenerates and
        # every sample ties.  A step-3 scan sees only those and reports a dead field.
        gy = score_gyre(U, step=job.get('turnStep', 1), shortlist=job.get('shortlist', 16),
                        finalists=job.get('finalists', 3))
        tr = score_trefoil(U, group)
        best_gyre = max((q for q in gy['finalists']), key=lambda q: -q['boundaryDensity'], default=None)
        usable_g = [q for q in gy['finalists'] if usable_gyre(q)]
        usable_t = [q for q in tr if usable_trefoil(q)]
        out.update(outcome='admitted', period=float(T),
                   gyre=dict(finalists=gy['finalists'], usable=len(usable_g),
                             shortlistTop=gy['shortlist'][:4]),
                   trefoil=tr, usableGyre=len(usable_g), usableTrefoil=len(usable_t),
                   hostsTrefoil=len(hosts_trefoil(group)), hostsGyreThirds=hosts_gyre(group))
        meta = export_candidate(folder, 'candidate', job['model'], movie, T, group, job['L'],
                                job['params'],
                                extra=dict(job={k: v for k, v in job.items() if k != 'batch'},
                                           method=r['method'], detail=r.get('detail'),
                                           gyre=out['gyre'], trefoil=tr,
                                           usableGyre=len(usable_g), usableTrefoil=len(usable_t)),
                                certificate=proof)
        out['fieldSha256'] = meta['fieldSha256']
        out['fieldBytes'] = meta['fieldByteLength']
        return _finish(out, started, folder, write=True)
    except Budget:
        out['outcome'] = 'budget'
        return _finish(out, started, folder, write=True)
    except Exception as exc:                                     # noqa: BLE001
        out['outcome'] = 'error'
        out['error'] = '%s: %s' % (type(exc).__name__, exc)
        out['traceback'] = traceback.format_exc()[-2000:]
        return _finish(out, started, folder, write=True)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)


def _finish(out, started, folder, write=False):
    out['seconds'] = round(time.time() - started, 2)
    if write:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / 'result.json').write_text(json.dumps(out, indent=1, default=float))
    return out


# ------------------------------------------------------------------------------------- plans
GYRE_GROUPS = ['g225', 'g226', 'g247', 'g248', 'g244', 'g245', 'g227', 'g234', 'g235']
TREFOIL_GROUPS = ['g247', 'g248', 'g246', 'g269', 'g271', 'g233', 'g270']
PHASE_LABELS = [l for m, l, _ in PARAMETER_SETS if m in PHASE_MODELS]
HOPF_LABELS = [l for m, l, _ in PARAMETER_SETS if m not in PHASE_MODELS and m != 'gray-scott']
GS_LABELS = [l for m, l, _ in PARAMETER_SETS if m == 'gray-scott']
# the order-two entries carry no Ginzburg-Landau relative equilibrium (the cell's phase
# windings cannot sum to zero), so they only ever get the projected strategy
ORDER_TWO = ['g246', 'g269', 'g271', 'g270', 'g233', 'g231']


def make_jobs(plan, batch, budget, N=36, frames=FRAMES):
    """Build the job list.  Jobs are emitted in priority tiers, because both plans are
    dispatched in list order and stopped by a deadline or a STOP file."""
    sets = {l: (m, p) for m, l, p in PARAMETER_SETS}
    tiers = [[], [], []]

    def add(tier, model, label, gid, L, seed, strategy, **kw):
        params = sets[label][1]
        tag = '-'.join('%s%g' % (k[0], v) for k, v in sorted(kw.items())
                       if isinstance(v, (int, float)))
        jid = '%s-%s-%s-L%d-N%d-s%d-%s%s' % (gid, model.replace('-', ''), label, L, N,
                                             seed, strategy, ('-' + tag) if tag else '')
        tiers[tier].append(dict(id=jid, batch=batch, model=model, label=label,
                                params=dict(params), groupId=gid, N=N, L=L, M=frames,
                                seed=seed, strategy=strategy, budget=budget, **kw))

    # near-Hopf first: the strongly unstable sets synchronise the medium
    near_hopf = ['bru-d', 'bru-e', 'sch-c', 'sch-a', 'sel-a', 'sel-b', 'gm-a', 'gm-c',
                 'le-d', 'rps-e', 'rps-a', 'rps-c', 'fhn-d', 'fhn-a', 'ore-b']
    rest_hopf = [l for m, l, _ in PARAMETER_SETS
                 if m not in PHASE_MODELS and m != 'gray-scott' and l not in near_hopf]
    phase_labels = [l for m, l, _ in PARAMETER_SETS if m in PHASE_MODELS]
    gs_labels = [l for m, l, _ in PARAMETER_SETS if m == 'gray-scott']

    if plan == 'first':
        for label in near_hopf:
            m = sets[label][0]
            for gid in ['g225', 'g247', 'g246', 'g248', 'g226']:
                for amp in (0.5, 1.5):
                    for tr in (0.0, 20.0):
                        add(0, m, label, gid, 40, 0, 'hopf-seed', amplitude=amp, transient=tr)
        for label in phase_labels:
            m = sets[label][0]
            for gid in ['g225', 'g226', 'g247', 'g248', 'g244', 'g245', 'g227']:
                for L in (40, 56):
                    add(1, m, label, gid, L, 0, 'phase')
        for label in rest_hopf:
            m = sets[label][0]
            for gid in ['g225', 'g247', 'g246']:
                add(2, m, label, gid, 40, 0, 'hopf-seed', amplitude=1.0, transient=0.0)
        for label in gs_labels:
            m = sets[label][0]
            for gid in ['g225', 'g247', 'g246']:
                add(2, m, label, gid, 64, 0, 'projected', transient=400.0,
                    window=(0.2, 4.0), samples=40)
        return tiers[0] + tiers[1] + tiers[2]

    if plan == 'long':
        # Tier 0: the phase-symmetric relative equilibria.  Five to ten seconds each and
        # they almost always converge, so they are the cheapest way to fill every Gyre
        # entry with distinct fields before the expensive shooting starts.
        for label in phase_labels:
            m = sets[label][0]
            for gid in GYRE_GROUPS:
                for L in (32, 40, 48, 56, 64, 80):
                    for s in (0, 1, 2):
                        add(0, m, label, gid, L, s, 'phase')
        # Tier 1: Hopf-seeded twisted shooting, near-Hopf parameter sets, the entries that
        # host Gyre and/or Trefoil with no same-time tie line.
        for label in near_hopf:
            m = sets[label][0]
            for gid in ['g247', 'g248', 'g225', 'g226', 'g246', 'g244', 'g245', 'g227']:
                for L in (32, 40, 52, 64):
                    for amp in (0.5, 1.2):
                        for tr in (0.0, 20.0):
                            add(1, m, label, gid, L, 0, 'hopf-seed', amplitude=amp, transient=tr)
        # Tier 2: the remaining order-two entries (mirrors and glides) and the p31m screws.
        for label in near_hopf + rest_hopf:
            m = sets[label][0]
            for gid in ORDER_TWO + ['g234', 'g235']:
                for L in (32, 40, 52):
                    for amp in (0.5, 1.2):
                        for tr in (0.0, 20.0):
                            add(2, m, label, gid, L, 0, 'hopf-seed', amplitude=amp, transient=tr)
        # Tier 2 continued: the strongly unstable sets, more seeds, and Gray-Scott.
        for label in rest_hopf:
            m = sets[label][0]
            for gid in ['g247', 'g248', 'g225', 'g226', 'g246']:
                for L in (32, 40, 52, 64):
                    for amp in (0.5, 1.2):
                        for tr in (0.0, 20.0):
                            add(2, m, label, gid, L, 0, 'hopf-seed', amplitude=amp, transient=tr)
        for label in near_hopf:
            m = sets[label][0]
            for gid in ['g247', 'g248', 'g225', 'g226', 'g246']:
                for L in (32, 40, 52, 64):
                    for s in (1, 2):
                        add(2, m, label, gid, L, s, 'hopf-seed', amplitude=0.8, transient=10.0)
        for label in gs_labels:
            m = sets[label][0]
            for gid in ['g225', 'g226', 'g247', 'g248', 'g246']:
                for L in (40, 64, 96, 128):
                    for s in (0, 1):
                        add(2, m, label, gid, L, s, 'projected', transient=400.0,
                            window=(0.2, 4.0), samples=40)
        return tiers[0] + tiers[1] + tiers[2]
    raise SystemExit('unknown plan ' + plan)


# -------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--plan', default='first', choices=['first', 'long'])
    ap.add_argument('--batch', default=None)
    ap.add_argument('--run', action='store_true')
    ap.add_argument('--workers', type=int, default=14)
    ap.add_argument('--budget', type=float, default=600.0, help='per-job wall-clock seconds')
    ap.add_argument('--deadline', type=float, default=None, help='stop dispatching after this many seconds')
    ap.add_argument('--N', type=int, default=36)
    ap.add_argument('--limit', type=int, default=None)
    a = ap.parse_args()

    batch = a.batch or a.plan
    jobs = make_jobs(a.plan, batch, a.budget, N=a.N)
    if a.limit:
        jobs = jobs[:a.limit]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / batch).mkdir(parents=True, exist_ok=True)
    (OUT / batch / 'jobs.json').write_text(json.dumps(jobs, indent=1))
    print(json.dumps(dict(plan=a.plan, batch=batch, jobs=len(jobs), workers=a.workers,
                          budget=a.budget, deadline=a.deadline)), flush=True)
    if not a.run:
        return

    import multiprocessing as mp
    os.environ.setdefault('OMP_NUM_THREADS', '1')
    os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
    os.environ.setdefault('MKL_NUM_THREADS', '1')
    stop = OUT / 'STOP'
    ledger = OUT / 'ledger.jsonl'
    t0 = time.time()
    done = admitted = 0
    ctx = mp.get_context('fork')
    with ctx.Pool(processes=a.workers, maxtasksperchild=4) as pool:
        it = pool.imap_unordered(run_job, jobs, chunksize=1)
        for r in it:
            done += 1
            row = {k: r.get(k) for k in ('id', 'batch', 'outcome', 'seconds', 'period',
                                         'usableGyre', 'usableTrefoil', 'fieldSha256')}
            row['model'] = r['job']['model']
            row['label'] = r['job']['label']
            row['groupId'] = r['job']['groupId']
            row['L'] = r['job']['L']
            row['strategy'] = r['job']['strategy']
            with ledger.open('a') as fh:
                fh.write(json.dumps(row, default=float) + '\n')
            if r['outcome'] == 'admitted':
                admitted += 1
            print('%5d/%d %-58s %-24s %6.1fs gyre=%s trefoil=%s' % (
                done, len(jobs), r['id'], r['outcome'], r.get('seconds', 0),
                r.get('usableGyre'), r.get('usableTrefoil')), flush=True)
            if stop.exists():
                print('STOP file present; terminating', flush=True)
                pool.terminate()
                break
            if a.deadline and time.time() - t0 > a.deadline:
                print('deadline reached; terminating', flush=True)
                pool.terminate()
                break
    summary = dict(batch=batch, jobs=len(jobs), completed=done, admitted=admitted,
                   seconds=round(time.time() - t0, 1))
    (OUT / batch / 'batch.json').write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
