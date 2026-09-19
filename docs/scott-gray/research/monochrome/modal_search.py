#!/usr/bin/env python3
"""Bounded Modal CPU fan-out of the colour/monochrome periodic-orbit search, on ANY
wallpaper lattice.

This is ``../equations/modal_equations.py``'s bounded pattern applied to
``../colour/search_colour.py``'s strategies (``phase`` relative equilibria, ``hopf-seed``
and ``projected`` Newton-Krylov twisted shooting).  The local search only ever ran on the
hexagonal entries; this one runs the same code on the 48 square-lattice film groups as
well, and measures the *monochrome* antisymmetric rules on every admitted orbit.

Hard limits, unchanged from ``modal_equations.py`` except where noted:

  * 24 concurrent containers per app, two physical cores and 8 GiB per container;
  * ``retries=0``, no schedules, no endpoints, no GPUs, no persistent deployments;
  * 300-second task timeout (``modal_equations`` used 420; the worker's own SIGALRM stops
    at 260 s so that a slow job returns a ``budget`` record instead of being killed);
  * 120-second startup timeout, 10-second scale-down window;
  * 1024 jobs per batch -- a documented higher cap than ``modal_equations``'s 256, with
    exactly the same worst-case arithmetic.  The per-batch reservation cap rises with it,
    from $12 to $26, and a session cap of $70 is enforced across batches through
    ``out/reservations.json``.
  * dry run is the default; ``--launch`` is required to spend anything.

Worst case for every job: full task timeout + full startup timeout + the scale-down
allowance, at the CPU/memory rate, plus a $3 image-build/accounting reserve per app.  That
is a reservation, not an invoice: the local run's median job is 12 s (phase) / 32 s
(hopf-seed).

Every result is an unaudited candidate until the certificate is re-derived locally from
the saved Float32 bytes (``--audit``), exactly as ``search_colour.py`` does.

    python modal_search.py --plan sq-phase                    # dry run: counts and cost
    modal run modal_search.py --jobs out/sq-phase/jobs.json --output out/modal/sq-phase --launch
    python modal_search.py --audit out/modal/sq-phase         # local re-admission
    python modal_search.py --report                           # admitted orbits per equation
    python modal_search.py --ledger                           # write compute-ledger.json

The Modal client speaks gRPC and cannot use this machine's HTTP proxy, so every modal
command has to be run with the proxy variables unset:

    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY MODAL_PROFILE=yaroslavvb \\
        python -m modal run modal_search.py --jobs ... --output ... --launch
"""
import argparse, hashlib, json, math, os, re, signal, sys, time, traceback
from pathlib import Path

import modal

HERE = Path(__file__).resolve().parent                    # docs/scott-gray/research/monochrome
RESEARCH = HERE.parent                                    # docs/scott-gray/research
ROOT = RESEARCH.parent                                    # docs/scott-gray
OUT = HERE / 'out'

# ------------------------------------------------------------------ bounded resources
MAX_JOBS = 1024                  # documented higher cap (modal_equations.py used 256)
MAX_CONTAINERS = 24
TASK_SECONDS = 300
JOB_BUDGET_SECONDS = 260         # the worker's own alarm, inside the task timeout
STARTUP_SECONDS = 120
SCALEDOWN_SECONDS = 10
# USD per container-second: 2 physical cores + 8 GiB, https://modal.com/pricing
# (re-checked 2026-09-19: $0.0000131 / core / s, $0.00000222 / GiB / s -- unchanged)
RATE = 2 * .0000131 + 8 * .00000222
BUILD_RESERVE_USD = 3.0
BATCH_CAP_USD = 26.0
SESSION_CAP_USD = 70.0
AUTHORISED_USD = 100.0

FRAMES = 96                      # divisible by 1, 2, 3, 4 and 6: every entry's frameMultiple
MESH = 36                        # divisible by 1, 2, 3 and 4: every entry's meshMultiple

# ------------------------------------------------------------------ the image
# The directory layout is mirrored exactly so that rdlab_colour.verifier_fingerprint()
# hashes the same three files at the same relative paths as it does locally.
IMAGE_ROOT = '/root/sg'
image = (modal.Image.debian_slim(python_version='3.12')
         .pip_install('numpy==2.2.6', 'scipy==1.15.3')
         .add_local_file(ROOT / 'wallpaper-groups.json', f'{IMAGE_ROOT}/wallpaper-groups.json', copy=True)
         .add_local_file(RESEARCH / 'equations' / 'rdlab.py', f'{IMAGE_ROOT}/research/equations/rdlab.py', copy=True)
         .add_local_file(RESEARCH / 'equations' / 'admit.py', f'{IMAGE_ROOT}/research/equations/admit.py', copy=True)
         .add_local_file(RESEARCH / 'wallpaper' / 'audit.py', f'{IMAGE_ROOT}/research/wallpaper/audit.py', copy=True)
         .add_local_file(RESEARCH / 'wallpaper' / 'search.py', f'{IMAGE_ROOT}/research/wallpaper/search.py', copy=True)
         .add_local_file(RESEARCH / 'colour' / 'rdlab_colour.py', f'{IMAGE_ROOT}/research/colour/rdlab_colour.py', copy=True)
         .add_local_file(RESEARCH / 'colour' / 'search_colour.py', f'{IMAGE_ROOT}/research/colour/search_colour.py', copy=True))

app = modal.App('rdlab-monochrome-search')


# ------------------------------------------------------------------ job validation
STRATEGIES = ('phase', 'hopf-seed', 'projected')
MODELS_ALLOWED = ('ginzburg-landau', 'cgl-quintic', 'lambda-omega', 'brusselator',
                  'schnakenberg', 'selkov', 'lengyel-epstein', 'oregonator',
                  'fitzhugh-nagumo', 'rps', 'gray-scott')
# Every parameter any of those right-hand sides reads, with the interval the search is
# allowed to explore.  A job carrying anything else, or anything outside the interval, is
# refused before a container is started.
PARAM_BOUNDS = {
    'alpha': (-3, 3), 'beta': (-3, 3), 'D': (.05, 10), 'gamma': (-2, 2), 'delta': (-2, 2),
    'a': (-5, 30), 'b': (-5, 30), 'Du': (.01, 10), 'Dv': (.01, 10),
    'l0': (-3, 3), 'l1': (-3, 3), 'l2': (-3, 3), 'w0': (-3, 3), 'w1': (-3, 3), 'w2': (-3, 3),
    'nu': (.01, 5), 'sigma': (0, 2), 'mu': (0, 5), 'kappa': (0, 2),
    'f': (.1, 3), 'q0': (1e-4, .5), 'eps': (.01, 2), 'I': (-2, 2),
    'e': (.1, 3), 'd': (.1, 3), 'F': (1e-4, .1), 'k': (1e-4, .2),
}
NUMERIC_BOUNDS = {
    'N': (12, 48, int), 'M': (12, 192, int), 'seed': (0, 10 ** 6, int),
    'samples': (8, 64, int), 'maxiter': (5, 80, int), 'shortlist': (1, 32, int),
    'finalists': (1, 8, int), 'turnStep': (1, 6, int),
    'L': (8, 300, float), 'budget': (10, JOB_BUDGET_SECONDS, float),
    'amplitude': (.01, 3, float), 'transient': (0, 2000, float),
    'totalTime': (10, 3000, float), 'seedAlpha': (-3, 3, float), 'seedBeta': (-3, 3, float),
    'seedTime': (10, 2000, float), 'T0': (.01, 2000, float),
}
ALLOWED_KEYS = ({'id', 'batch', 'groupId', 'model', 'label', 'params', 'strategy', 'sign', 'window'}
                | set(NUMERIC_BOUNDS))


def validate(job):
    if not isinstance(job, dict) or set(job) - ALLOWED_KEYS:
        raise ValueError('Undocumented job arguments: %s' % sorted(set(job) - ALLOWED_KEYS))
    if not re.fullmatch(r'[a-zA-Z0-9_.-]{1,120}', str(job.get('id', ''))):
        raise ValueError('Unsafe identifier')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,40}', str(job.get('batch', 'b'))):
        raise ValueError('Unsafe batch name')
    if not re.fullmatch(r'g[0-9]+', str(job.get('groupId', ''))):
        raise ValueError('Unsafe group identifier')
    if job.get('model') not in MODELS_ALLOWED:
        raise ValueError('Unknown model')
    if job.get('strategy') not in STRATEGIES:
        raise ValueError('Unknown strategy')
    if job.get('sign') not in (None, 1, -1):
        raise ValueError('sign must be +-1')
    if 'window' in job:
        w = job['window']
        if (not isinstance(w, (list, tuple)) or len(w) != 2
                or not all(isinstance(x, (int, float)) and 0.05 <= x <= 8 for x in w) or w[0] >= w[1]):
            raise ValueError('Bounded period window')
    params = job.get('params')
    if not isinstance(params, dict) or not params:
        raise ValueError('Missing parameters')
    for key, value in params.items():
        if key not in PARAM_BOUNDS:
            raise ValueError('Undocumented parameter ' + str(key))
        low, high = PARAM_BOUNDS[key]
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError('Bounded parameter ' + key)
    for key, (low, high, kind) in NUMERIC_BOUNDS.items():
        if key not in job:
            continue
        value = job[key]
        if kind is int and type(value) is not int:
            raise ValueError('Integer ' + key)
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError('Bounded ' + key)
    return job


# ------------------------------------------------------------------ monochrome rules
def _neighbours(lattice):
    if lattice == 'triangular':
        return [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1)]
    return [(0, 1), (0, -1), (1, 0), (-1, 0)]


def _sign_statistics(w, span, lattice):
    """Balance, tie (zero-set) fraction, contrast, boundary density and speckle of the
    two-colour field sign(w)."""
    import numpy as np
    black = w > 0
    zero = np.abs(w) <= 1e-6 * max(span, 1e-30)
    diff = np.zeros(w.shape, bool)
    alldiff = np.ones(w.shape, bool)
    for dy, dx in _neighbours(lattice):
        nb = np.roll(np.roll(black, dy, axis=1), dx, axis=2)
        d = nb != black
        diff |= d
        alldiff &= d
    fraction = float(black.mean())
    return dict(blackFraction=fraction,
                balance=float(min(fraction, 1 - fraction)),
                zeroFraction=float(zero.mean()),
                contrast=float(np.sqrt(np.mean(w ** 2)) / max(span, 1e-30)),
                boundaryDensity=float(diff.mean()),
                speckleRate=float(alldiff.mean()))


def involution_hosts(group):
    """Operations (s, T/2) with s an involution modulo the lattice that is NOT itself a
    same-time symmetry.  For each one, w = U(x, t) - U(s x, t) is an antisymmetric
    monochrome rule: s alone swaps black and white as an algebraic identity, the T/2 shift
    alone swaps it because (s, T/2) is a symmetry of U, and the two together preserve it."""
    import numpy as np
    identity = np.eye(2, dtype=int)
    same_time = {(tuple(map(tuple, o['M'])), tuple(round(x, 9) for x in o.get('v', [0, 0])))
                 for o in group['ops'] if abs(o['tau']) < 1e-9}
    hosts = []
    for index, op in enumerate(group['ops']):
        if abs(op['tau'] - 0.5) > 1e-9:
            continue
        matrix = np.asarray(op['M'], int)
        shift = np.asarray(op.get('v', [0, 0]), float)
        if not np.array_equal(matrix @ matrix, identity):
            continue
        square = matrix @ shift + shift
        if np.max(np.abs(square - np.rint(square))) > 1e-9:
            continue                                     # s^2 is not a lattice translation
        if (tuple(map(tuple, op['M'])), tuple(round(x, 9) for x in shift)) in same_time:
            continue                                     # (s, 0) is a symmetry: w vanishes
        determinant = int(round(np.linalg.det(matrix)))
        if np.array_equal(matrix, -identity):
            kind = 'half-turn'
        elif np.array_equal(matrix, identity):
            kind = 'half-translation'
        elif determinant == -1:
            kind = 'mirror/glide'
        else:
            kind = 'rotation'
        hosts.append(dict(index=index, kind=kind, M=matrix.tolist(),
                          v=[float(x) for x in shift], tau=float(op['tau'])))
    return hosts


def _node_permutation(matrix, shift, N):
    """Flat index p with (S f).ravel() = f.ravel()[p], i.e. (S f)(x) = f(matrix x + shift),
    for an integer matrix and an integer shift in node units."""
    import numpy as np
    y, x = np.indices((N, N))
    a = np.asarray(matrix, int)
    s = np.asarray(shift, int)
    return (((a[1, 0] * x + a[1, 1] * y + s[1]) % N) * N
            + (a[0, 0] * x + a[0, 1] * y + s[0]) % N).ravel()


def _involutive_point_ops(lattice):
    """The order-two point operations of the lattice, as integer matrices on (x, y)."""
    import numpy as np
    half_turn = [(-np.eye(2, dtype=int), 'half-turn')]
    if lattice == 'triangular':
        rotation = np.array([[0, -1], [1, -1]], int)             # 120 degrees
        sixth = -(rotation @ rotation)
        mirror = np.array([[0, 1], [1, 0]], int)
        turns = [np.linalg.matrix_power(sixth, k) for k in range(6)]
        return half_turn + [(t @ mirror, 'mirror') for t in turns]
    mirrors = [np.array([[1, 0], [0, -1]], int), np.array([[-1, 0], [0, 1]], int),
               np.array([[0, 1], [1, 0]], int), np.array([[0, -1], [-1, 0]], int)]
    return half_turn + [(m, 'mirror') for m in mirrors]


def free_involution_rules(U, lattice, span, step=3, keep=6, floor=1e-4):
    """The monochrome rules that are NOT forced by the film group: for every involution s
    of the mesh -- a half-turn about any centre, a lattice mirror at any offset, a
    half-lattice translation -- the difference w = U(x, t) - U(s x, t) obeys
    w(s x, t) = -w(x, t) identically, so s alone swaps black and white.  Ranked by a thin
    zero set, strong contrast and chunky regions, with the ones where w vanishes (s is
    already a same-time symmetry of the field) dropped."""
    import numpy as np
    M, N, _ = U.shape
    flat = U.reshape(M, -1)
    half = (np.arange(M) + M // 2) % M
    candidates = []
    for matrix, kind in _involutive_point_ops(lattice):
        grid = step if kind == 'half-turn' else 2 * step
        for sy in range(0, N, grid):
            for sx in range(0, N, grid):
                candidates.append((matrix, (sx, sy), kind))
    if N % 2 == 0:
        identity = np.eye(2, dtype=int)
        for shift in ((N // 2, 0), (0, N // 2), (N // 2, N // 2)):
            candidates.append((identity, shift, 'half-translation'))
    rows = []
    for matrix, shift, kind in candidates:
        nodes = _node_permutation(matrix, shift, N)
        if not np.array_equal(nodes[nodes], np.arange(N * N)):
            continue                                            # not an involution of the mesh
        w = (flat - flat[:, nodes]).reshape(M, N, N)
        contrast = float(np.sqrt(np.mean(w ** 2)) / max(span, 1e-30))
        if contrast < floor:
            continue                                            # s is already a symmetry: w = 0
        wf = w.reshape(M, -1)
        rows.append(dict(rule='free-involution', kind=kind, M=np.asarray(matrix, int).tolist(),
                         shift=[int(shift[0]), int(shift[1])], nodeShift=[int(shift[0]), int(shift[1])],
                         spatialSwapMax=float(np.max(np.abs(wf[:, nodes] + wf))),
                         timeSwapMax=float(np.max(np.abs(w[half] + w))),
                         preserveMax=float(np.max(np.abs(wf[half][:, nodes] - wf))),
                         **_sign_statistics(w, span, lattice)))
    rows.sort(key=lambda r: (r['zeroFraction'] + 2.0 * r['boundaryDensity']
                             + 20.0 * r['speckleRate'] + abs(0.5 - r['blackFraction'])))
    # Involutions in the same coset of the field's symmetry group give the same picture at
    # a different centre; keep one representative of each measured signature.
    seen, distinct = set(), []
    for row in rows:
        key = (row['kind'], round(row['blackFraction'], 9), round(row['contrast'], 9),
               round(row['boundaryDensity'], 9), round(row['speckleRate'], 9),
               round(row['zeroFraction'], 9))
        if key in seen:
            continue
        seen.add(key)
        distinct.append(row)
        if len(distinct) >= keep:
            break
    return distinct


def monochrome_report(field, group, keep=6, step=3):
    """Every antisymmetric monochrome rule the saved field carries, measured on the bytes.

    The canonical one is the half-period rule w = U(x, t) - U(x, t + T/2): the T/2 shift
    swaps black and white for any T-periodic field, and every same-time symmetry of U
    preserves the colouring.  Each (s, T/2) operation of the film group is an extra,
    *spatial* swap of that same w -- the film relation U(s x, t + T/2) = U(x, t) makes
    U(s x, t) and U(x, t + T/2) the same samples -- which is why the published
    plume-monochrome wave swaps under the half turn alone and under T/2 alone and is
    preserved by the two together.  ``free-involution`` rules are the ones the group does
    NOT force, and are where a monochrome explorer finds pictures the film cannot give."""
    import numpy as np
    field = np.asarray(field, float)
    M, _, N, _ = field.shape
    U = field[:, 0]
    span = float(U.max() - U.min())
    lattice = group['lattice']
    rules = []
    hosts = involution_hosts(group)
    if M % 2 == 0:
        half = (np.arange(M) + M // 2) % M
        w = U - U[half]
        flat = w.reshape(M, -1)
        swaps, preserves = [], []
        for host in hosts:
            nodes = _node_permutation(host['M'], [int(round(x * N)) for x in host['v']], N)
            swaps.append(dict(operation=host['index'], kind=host['kind'], M=host['M'],
                              v=host['v'],
                              spatialSwapMax=float(np.max(np.abs(flat[:, nodes] + flat)))))
        for index, op in enumerate(group['ops']):
            if abs(op['tau']) > 1e-9:
                continue
            nodes = _node_permutation(op['M'], [int(round(x * N)) for x in op.get('v', [0, 0])], N)
            preserves.append(dict(operation=index,
                                  preserveMax=float(np.max(np.abs(flat[:, nodes] - flat)))))
        rules.append(dict(rule='half-period', kind='time',
                          timeSwapMax=float(np.max(np.abs(w[half] + w))),
                          spatialSwaps=swaps,
                          worstSpatialSwapMax=max([s['spatialSwapMax'] for s in swaps], default=None),
                          worstPreserveMax=max([p['preserveMax'] for p in preserves], default=None),
                          **_sign_statistics(w, span, lattice)))
    rules += free_involution_rules(U, lattice, span, step=step, keep=keep)
    return dict(span=span, hosts=len(hosts), hostKinds=sorted({h['kind'] for h in hosts}),
                rules=rules)


def usable_monochrome(rule, span):
    """A monochrome rule worth putting on a page: the swap is exact (or at one float32 ulp
    of the field's range), the two colours are within 40/60, the zero set is thin and the
    picture is not speckle."""
    tolerance = 3e-7 * max(span, 1.0)
    if rule['rule'] == 'half-period':
        # the T/2 swap is an algebraic identity; the group's spatial swaps and the
        # same-time preservations are the part that has to be measured
        laws = [rule['timeSwapMax'], rule.get('worstSpatialSwapMax'), rule.get('worstPreserveMax')]
    else:
        # the spatial swap is the algebraic identity here; the T/2 relation is a bonus
        laws = [rule['spatialSwapMax']]
    return bool(all(x is None or x <= tolerance for x in laws)
                and rule['balance'] >= 0.40
                and rule['zeroFraction'] <= 0.08
                and rule['contrast'] >= 0.05
                and rule['boundaryDensity'] <= 0.34
                and rule['speckleRate'] <= 0.0025)


# ------------------------------------------------------------------ the worker
def _alarm(signum, frame):
    raise TimeoutError('per-job wall-clock budget exhausted')


def run(job, groups_path=None, colour_dir=None):
    """One search job.  Mirrors ``search_colour.run_job`` but for any lattice, and returns
    the Float32 movie bytes rather than writing them, so the parent re-admits them."""
    import numpy as np
    started = time.time()
    base = Path(groups_path).parent if groups_path else ROOT
    colour = Path(colour_dir) if colour_dir else (RESEARCH / 'colour')
    for path in (str(colour), str(base / 'research' / 'equations'), str(base / 'research' / 'wallpaper')):
        if path not in sys.path:
            sys.path.insert(0, path)
    out = dict(id=job['id'], batch=job.get('batch'), job={k: v for k, v in job.items() if k != 'batch'})
    try:
        signal.signal(signal.SIGALRM, _alarm)
        signal.setitimer(signal.ITIMER_REAL, float(job.get('budget', JOB_BUDGET_SECONDS)))
    except (ValueError, AttributeError):                             # not the main thread
        pass
    try:
        import rdlab
        import rdlab_colour as rc
        import search_colour as sc
        _, groups = rdlab.load_groups(str(groups_path or (ROOT / 'wallpaper-groups.json')))
        group = groups[job['groupId']]
        out['family'] = group['family']
        out['lattice'] = group['lattice']
        if job['N'] % group['meshMultiple'] or job.get('M', FRAMES) % group['frameMultiple']:
            out['outcome'] = 'mesh-incompatible'
            return _finish(out, started)
        sc.FRAMES = int(job.get('M', FRAMES))
        result = sc.run_phase(job, group) if job['strategy'] == 'phase' else sc.run_twisted(job, group)
        out.update({k: v for k, v in result.items() if k != 'movie'})
        if result['outcome'] != 'candidate':
            return _finish(out, started)
        movie, period = result['movie'], result['T']
        checked = rdlab.audit(job['model'], movie, job['params'], group, job['L'], period,
                              group['lattice'], dynamics=True)
        out['audit'] = {k: v for k, v in checked.items() if k != 'visibility'}
        out['visibilityPassed'] = checked['visibility']['passed']
        if not checked.get('passed'):
            out['outcome'] = 'audit-failed'
            return _finish(out, started)
        step = job['L'] / job['N']
        config = dict(N=job['N'], M=movie.shape[0], L=job['L'], period=float(period),
                      groupId=group['id'], model=job['model'],
                      params={**job['params'], 'dx': step,
                              'stencil': 'triangular-six' if group['lattice'] == 'triangular' else 'five-point'},
                      ops=group['ops'])
        payload = movie.astype('<f4').tobytes()
        field = np.frombuffer(payload, dtype='<f4').reshape(movie.shape)
        proof = rc.certify(field, config, group)
        out['certificatePassed'] = bool(proof['passed'])
        if not proof['passed']:
            out['outcome'] = 'not-admitted'
            out['certificate'] = {k: proof.get(k) for k in
                                  ('phaseRelations', 'temporalResolution', 'spatialRms',
                                   'temporalRms', 'minimum', 'maximum', 'independentDynamics')}
            return _finish(out, started)
        mono = monochrome_report(field, group)
        mono['usable'] = sum(1 for r in mono['rules'] if usable_monochrome(r, mono['span']))
        out['monochrome'] = mono
        out['usableMonochrome'] = mono['usable']
        if group['lattice'] == 'triangular':
            U = np.array(field[:, 0], dtype=np.float64)
            gyre = sc.score_gyre(U, step=job.get('turnStep', 1), shortlist=job.get('shortlist', 12),
                                 finalists=job.get('finalists', 2))
            trefoil = sc.score_trefoil(U, group)
            out['gyre'] = dict(finalists=gyre['finalists'], shortlistTop=gyre['shortlist'][:3])
            out['trefoil'] = trefoil
            out['usableGyre'] = sum(1 for q in gyre['finalists'] if sc.usable_gyre(q))
            out['usableTrefoil'] = sum(1 for q in trefoil if sc.usable_trefoil(q))
        out['outcome'] = 'admitted'
        out['period'] = float(period)
        out['config'] = config
        out['certificate'] = proof
        out['fieldSha256'] = hashlib.sha256(payload).hexdigest()
        out['fieldByteLength'] = len(payload)
        out['field'] = payload
        out['method'] = result.get('method')
        return _finish(out, started)
    except TimeoutError:
        out['outcome'] = 'budget'
        return _finish(out, started)
    except Exception as error:                                        # noqa: BLE001
        out['outcome'] = 'error'
        out['error'] = '%s: %s' % (type(error).__name__, error)
        out['traceback'] = traceback.format_exc()[-1500:]
        return _finish(out, started)
    finally:
        try:
            signal.setitimer(signal.ITIMER_REAL, 0)
        except (ValueError, AttributeError):
            pass


def _finish(out, started):
    out['seconds'] = round(time.time() - started, 2)
    return out


@app.function(image=image, cpu=(2, 2), memory=(4096, 8192), max_containers=MAX_CONTAINERS,
              min_containers=0, buffer_containers=0, scaledown_window=SCALEDOWN_SECONDS,
              retries=0, timeout=TASK_SECONDS, startup_timeout=STARTUP_SECONDS)
def run_job(job):
    for name in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS'):
        os.environ.setdefault(name, '2')
    return run(validate(job), groups_path=f'{IMAGE_ROOT}/wallpaper-groups.json',
               colour_dir=f'{IMAGE_ROOT}/research/colour')


# ------------------------------------------------------------------ saving
def save(destination, job, result):
    folder = destination / job['id']
    folder.mkdir(parents=True, exist_ok=True)
    payload = result.pop('field', None)
    if payload:
        (folder / 'candidate.f32').write_bytes(payload)
        result['fieldUrl'] = 'candidate.f32'
    (folder / 'result.json').write_text(json.dumps(result, indent=1, default=float))
    return result


def budget_for(count):
    return count * (TASK_SECONDS + STARTUP_SECONDS + SCALEDOWN_SECONDS) * RATE + BUILD_RESERVE_USD


def reserve(batch, count, launch):
    """Session-wide reservation ledger.  Refuses to launch past the $70 session cap."""
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / 'reservations.json'
    state = json.loads(path.read_text()) if path.exists() else {
        'schema': 'monochrome-reservations-v1', 'authorizedUSD': AUTHORISED_USD,
        'sessionCapUSD': SESSION_CAP_USD, 'perBatchCapUSD': BATCH_CAP_USD,
        'perContainerSecondUSD': RATE, 'batches': []}
    bound = budget_for(count)
    already = sum(b['reservedUSD'] for b in state['batches'] if b['batch'] != batch)
    if bound > BATCH_CAP_USD:
        raise ValueError('Batch reservation $%.2f exceeds the $%.2f per-batch cap' % (bound, BATCH_CAP_USD))
    if already + bound > SESSION_CAP_USD:
        raise ValueError('Session reservation $%.2f exceeds the $%.2f cap' % (already + bound, SESSION_CAP_USD))
    if launch:
        state['batches'] = [b for b in state['batches'] if b['batch'] != batch]
        state['batches'].append(dict(batch=batch, jobs=count, reservedUSD=bound,
                                     launched=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())))
        state['totalReservedUSD'] = sum(b['reservedUSD'] for b in state['batches'])
        path.write_text(json.dumps(state, indent=1))
    return dict(batch=batch, jobs=count, reservedUSDIncludingThreeDollarBuildReserve=bound,
                sessionReservedAfterThisBatchUSD=already + bound,
                sessionCapUSD=SESSION_CAP_USD, authorizedUSD=AUTHORISED_USD)


@app.local_entrypoint()
def main(jobs: str, output: str, launch: bool = False, local: bool = False, limit: int = 0):
    settings = [validate(j) for j in json.loads(Path(jobs).read_text())]
    if limit:
        settings = settings[:limit]
    count = len(settings)
    if not 1 <= count <= MAX_JOBS or len({j['id'] for j in settings}) != count:
        raise ValueError('Job cap or duplicate ids')
    batch = settings[0].get('batch') or Path(output).name
    budget = dict(maximumJobs=count, maxContainers=MAX_CONTAINERS, physicalCoresPerContainer=2,
                  memoryGiBHardLimit=8, executionSeconds=TASK_SECONDS,
                  jobWallClockSeconds=JOB_BUDGET_SECONDS, startupSeconds=STARTUP_SECONDS,
                  scaleDownSeconds=SCALEDOWN_SECONDS, retries=0, gpu=None,
                  pricingURL='https://modal.com/pricing', resourceUSDPerSecond=RATE,
                  **reserve(batch, count, launch and not local))
    print(json.dumps({'launch': launch, 'local': local, 'budget': budget}), flush=True)
    destination = Path(output)
    if local:
        destination.mkdir(parents=True, exist_ok=True)
        for job in settings:
            result = save(destination, job, run(job))
            print(json.dumps({k: v for k, v in result.items()
                              if k in ('id', 'outcome', 'seconds', 'period', 'usableMonochrome')}), flush=True)
        return
    if not launch:
        return
    destination.mkdir(parents=True, exist_ok=True)
    summary = {'schema': 'monochrome-modal-batch-v1', 'budget': budget, 'results': []}
    (destination / 'batch.json').write_text(json.dumps(summary, indent=1))
    started = time.time()
    for index, result in enumerate(run_job.map(settings, return_exceptions=True, order_outputs=False)):
        if isinstance(result, Exception):
            result = {'id': 'unknown-%d' % index, 'outcome': 'function-error', 'error': str(result)}
        job = {'id': result['id']}
        result = save(destination, job, result)
        summary['results'].append({k: v for k, v in result.items()
                                   if k in ('id', 'outcome', 'seconds', 'period', 'family',
                                            'lattice', 'usableMonochrome', 'usableGyre',
                                            'usableTrefoil', 'fieldSha256', 'error')})
        (destination / 'batch.json').write_text(json.dumps(summary, indent=1))
        print('%4d/%d %6.0fs %s' % (index + 1, count, time.time() - started,
                                    json.dumps(summary['results'][-1])), flush=True)


# ------------------------------------------------------------------ the job plans
def _sets():
    """The parameter sets: rdlab_colour's catalogue plus the extra ones this batch adds."""
    sys.path.insert(0, str(RESEARCH / 'colour'))
    import rdlab_colour as rc
    sets = {label: (model, dict(params)) for model, label, params in rc.PARAMETER_SETS}
    sets.update(EXTRA_SETS)
    return sets


# Extra parameter sets, beyond rdlab_colour.PARAMETER_SETS.  The three phase-symmetric
# families oscillate at every coefficient in these ranges by construction (the uniform
# state |A| = 1 is a Hopf circle for any alpha, beta), so no separate Hopf check is needed;
# the two Brusselator sets sit just past b = 1 + a^2, like the published ones.
EXTRA_SETS = {
    'cgl-e': ('ginzburg-landau', dict(alpha=1.00, beta=-0.50, D=1.0)),
    'cgl-f': ('ginzburg-landau', dict(alpha=-1.20, beta=1.00, D=1.0)),
    'cgl-g': ('ginzburg-landau', dict(alpha=0.35, beta=0.35, D=1.0)),
    'lw-e': ('lambda-omega', dict(l0=1.0, l1=1.0, l2=0.0, w0=0.80, w1=-0.30, w2=0.0, D=1.0)),
    'cq-d': ('cgl-quintic', dict(alpha=0.80, beta=-0.40, D=1.0, gamma=0.20, delta=0.20)),
    'bru-f': ('brusselator', dict(a=1.2, b=2.55, Du=1.0, Dv=1.0)),
    'bru-g': ('brusselator', dict(a=0.8, b=1.80, Du=1.0, Dv=1.6)),
}

# The families with a global phase symmetry A -> e^{i phi} A: only these have exact
# relative equilibria, and only these are refused by the twisted strategies' seeding.
PHASE_ONLY = ('ginzburg-landau', 'cgl-quintic', 'lambda-omega')
PHASE_LABELS = ['cgl-a', 'cgl-b', 'cgl-c', 'cgl-d', 'cgl-e', 'cgl-f', 'cgl-g',
                'lw-a', 'lw-b', 'lw-c', 'lw-d', 'lw-e',
                'cq-a', 'cq-b', 'cq-c', 'cq-d']
# The Hopf-seeded families, ordered by the local run's admission rate: Brusselator 14%,
# Lengyel-Epstein 14%, Schnakenberg 12%, Selkov 12%.  Gierer-Meinhardt admitted 0 of 256
# locally and is dropped.  FitzHugh-Nagumo, the Oregonator and rock-paper-scissors never
# ran on the local machine at all; they get a probe tier each.
HOPF_LABELS = ['bru-d', 'bru-e', 'bru-f', 'bru-g', 'bru-a', 'bru-b', 'bru-c',
               'le-d', 'le-a', 'le-b', 'le-c', 'sch-c', 'sch-a', 'sch-b',
               'sel-a', 'sel-b', 'sel-c']
PROBE_LABELS = ['fhn-d', 'fhn-a', 'fhn-b', 'fhn-c', 'ore-b', 'ore-a', 'ore-c',
                'rps-e', 'rps-a', 'rps-c']
GS_LABELS = ['gs-a', 'gs-b', 'gs-c']


def group_table():
    """Every film group with the two facts the plan orders by: which equations the
    published atlas already has for it, and whether it hosts a T/2 involution."""
    data = json.loads((ROOT / 'wallpaper-groups.json').read_text())
    atlas = json.loads((ROOT / 'data' / 'wallpaper-atlas.json').read_text())
    have = {}
    for orbit in atlas['orbits']:
        have.setdefault(orbit['groupId'], set()).add(orbit['config'].get('model') or 'gray-scott')
    rows = []
    for group in data['groups']:
        models = have.get(group['id'], set())
        rows.append(dict(id=group['id'], family=group['family'], lattice=group['lattice'],
                         order=group['phaseOrder'], meshMultiple=group['meshMultiple'],
                         frameMultiple=group['frameMultiple'],
                         models=sorted(models), onlyGrayScott=(models == {'gray-scott'}),
                         hosts=len(involution_hosts(group))))
    return rows


def make_jobs(plan, batch, budget=JOB_BUDGET_SECONDS, mesh=MESH, frames=FRAMES):
    sets = _sets()
    rows = {r['id']: r for r in group_table()}
    tiers = [[] for _ in range(6)]

    def add(tier, label, gid, L, seed, strategy, **extra):
        model, params = sets[label]
        row = rows[gid]
        if mesh % row['meshMultiple'] or frames % row['frameMultiple']:
            return
        if strategy != 'phase' and row['order'] < 2:
            return                                   # no phase generator: nothing to twist
        if strategy != 'phase' and model in PHASE_ONLY:
            # the twisted strategies seed from rdlab_colour.uniform_state, which has no
            # UNIFORM_GUESS entry for the phase-symmetric families (their uniform state is
            # a circle, not a point).  24 jobs of the first `probe` batch were lost to this.
            return
        if strategy == 'phase' and model not in PHASE_ONLY:
            return                                   # no global phase symmetry to exploit
        tag = '-'.join('%s%g' % (k[0], v) for k, v in sorted(extra.items())
                       if isinstance(v, (int, float)))
        jid = '%s-%s-L%d-N%d-s%d-%s%s' % (gid, label, L, mesh, seed, strategy,
                                          ('-' + tag) if tag else '')
        tiers[tier].append(dict(id=jid, batch=batch, model=model, label=label,
                                params=dict(params), groupId=gid, N=mesh, L=L, M=frames,
                                seed=seed, strategy=strategy, budget=float(budget), **extra))

    square = [r for r in rows.values() if r['lattice'] == 'square']
    hexes = [r for r in rows.values() if r['lattice'] == 'triangular']

    def order(rs):
        """Only-Gray-Scott entries first, and within each, the T/2 involution hosts."""
        return [r['id'] for r in sorted(rs, key=lambda r: (not r['onlyGrayScott'], -r['hosts'],
                                                           len(r['models']), int(r['id'][1:])))]

    if plan == 'sq-phase':
        # Relative equilibria of the phase-symmetric families on the square lattice: the
        # site has none of lambda-omega or cubic-quintic CGL anywhere, and 28 of the 68
        # entries have no orbit at all outside Gray-Scott.  Ten seconds a job locally.
        ids = order(square)
        first, rest = ids[:18], ids[18:]
        for gid in first:
            for label in PHASE_LABELS:
                add(0, label, gid, 40, 0, 'phase')
        for gid in rest:
            for label in PHASE_LABELS:
                add(1, label, gid, 40, 0, 'phase')
        # the hexagonal entries the published atlas has only Gray-Scott for; the five
        # order-one ones among them have no phase generator, so this is their only route
        for gid in order([r for r in hexes if r['onlyGrayScott']]):
            for label in PHASE_LABELS:
                add(2, label, gid, 40, 0, 'phase')
        for gid in first:
            for label in PHASE_LABELS:
                add(3, label, gid, 56, 0, 'phase')
        for gid in rest:
            for label in PHASE_LABELS:
                add(4, label, gid, 56, 0, 'phase')
        for gid in first:
            for label in PHASE_LABELS:
                add(5, label, gid, 64, 1, 'phase')
    elif plan == 'sq-hopf':
        # Hopf-seeded twisted shooting on the square entries that host a T/2 involution:
        # these are the ones an antisymmetric monochrome rule can live on.
        hosts = order([r for r in square if r['hosts'] > 0 and r['order'] >= 2])
        first, rest = hosts[:12], hosts[12:]
        for gid in first:
            for label in HOPF_LABELS[:8]:
                add(0, label, gid, 40, 0, 'hopf-seed', amplitude=0.8, transient=0.0)
        for gid in rest:
            for label in HOPF_LABELS[:8]:
                add(1, label, gid, 40, 0, 'hopf-seed', amplitude=0.8, transient=0.0)
        for gid in first:
            for label in HOPF_LABELS[8:]:
                add(2, label, gid, 40, 0, 'hopf-seed', amplitude=0.8, transient=0.0)
        for gid in first:
            for label in HOPF_LABELS[:8]:
                add(3, label, gid, 56, 0, 'hopf-seed', amplitude=1.2, transient=20.0)
        for gid in rest:
            for label in HOPF_LABELS[8:]:
                add(4, label, gid, 40, 0, 'hopf-seed', amplitude=0.8, transient=0.0)
    elif plan == 'probe':
        # The three families the local run never reached, on both lattices, plus the
        # projected route for the order-two entries that carry no relative equilibrium.
        hexfirst = order([r for r in hexes if r['order'] >= 2])
        sqfirst = order([r for r in square if r['hosts'] > 0 and r['order'] >= 2])[:10]
        for gid in hexfirst[:10]:
            for label in PROBE_LABELS[:7]:
                add(0, label, gid, 40, 0, 'hopf-seed', amplitude=0.8, transient=0.0)
        for gid in sqfirst:
            for label in PROBE_LABELS[:7]:
                add(1, label, gid, 40, 0, 'hopf-seed', amplitude=0.8, transient=0.0)
        for gid in [r['id'] for r in hexes if r['order'] == 2]:
            for label in ['bru-d', 'bru-e', 'sch-c', 'sel-a', 'le-d', 'cgl-a', 'lw-a']:
                for L in (40, 52):
                    add(2, label, gid, L, 0, 'projected', transient=300.0,
                        window=[0.25, 3.5], samples=36, amplitude=0.4)
        for gid in hexfirst[:10]:
            for label in PROBE_LABELS[7:]:
                add(3, label, gid, 40, 0, 'hopf-seed', amplitude=0.8, transient=0.0)
        for gid in [r['id'] for r in hexes if r['onlyGrayScott'] and r['order'] >= 2]:
            for label in GS_LABELS:
                for L in (64, 96):
                    add(4, label, gid, L, 0, 'projected', transient=400.0,
                        window=[0.2, 4.0], samples=40)
    else:
        raise SystemExit('unknown plan ' + plan)
    return [job for tier in tiers for job in tier]


# ------------------------------------------------------------------ local re-admission
def audit_folder(folder, workers=8):
    """Re-derive the certificate locally from the saved Float32 bytes of every admitted
    record, exactly as search_colour.py does, and write candidate.json beside them."""
    import multiprocessing as mp
    folder = Path(folder)
    paths = sorted(p for p in folder.glob('*/result.json'))
    todo = []
    for path in paths:
        record = json.loads(path.read_text())
        if record.get('outcome') == 'admitted' and (path.parent / 'candidate.f32').exists():
            todo.append(str(path))
    context = mp.get_context('fork')
    with context.Pool(processes=workers) as pool:
        rows = pool.map(_audit_one, todo, chunksize=1)
    return rows


def picture_signatures(field, rules):
    """A translation-invariant fingerprint of each rule's black-and-white picture: the
    magnitude of the spatial Fourier transform of sign(w) on the first frame, which is
    exactly equal for two rules whose pictures differ only by a lattice translation.  Two
    half turns about different centres very often differ by exactly that, so this is what
    tells a genuinely new picture from the same one moved."""
    import numpy as np
    field = np.asarray(field, float)
    M, _, N, _ = field.shape
    U = field[:, 0]
    out = []
    for rule in rules:
        if rule['rule'] == 'half-period':
            w = U[0] - U[(M // 2) % M]
        else:
            nodes = _node_permutation(rule['M'], rule['shift'], N)
            w = (U[0].ravel() - U[0].ravel()[nodes]).reshape(N, N)
        spectrum = np.round(np.abs(np.fft.fft2(np.sign(w))) / (N * N), 6)
        out.append(hashlib.sha256(spectrum.tobytes()).hexdigest()[:16])
    return out


def _audit_one(path):
    import numpy as np
    sys.path.insert(0, str(RESEARCH / 'colour'))
    import rdlab_colour as rc
    path = Path(path)
    record = json.loads(path.read_text())
    config = record['config']
    group = {g['id']: g for g in json.loads((ROOT / 'wallpaper-groups.json').read_text())['groups']}[config['groupId']]
    payload = (path.parent / 'candidate.f32').read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    field = np.frombuffer(payload, dtype='<f4').reshape(config['M'], 2, config['N'], config['N'])
    proof = rc.certify(field, config, group)
    mono = monochrome_report(field, group)
    mono['usable'] = sum(1 for r in mono['rules'] if usable_monochrome(r, mono['span']))
    for rule, signature in zip(mono['rules'], picture_signatures(field, mono['rules'])):
        rule['pictureSignature'] = signature
    job = record['job']
    parameters = {k: v for k, v in config['params'].items() if k not in ('dx', 'stencil')}
    rc.export_candidate(path.parent, 'candidate', config['model'],
                        np.asarray(field, float), config['period'], group, config['L'],
                        parameters,
                        extra=dict(job=job, method=record.get('method'), monochrome=mono,
                                   gyre=record.get('gyre'), trefoil=record.get('trefoil'),
                                   usableMonochrome=mono['usable'],
                                   usableGyre=record.get('usableGyre'),
                                   usableTrefoil=record.get('usableTrefoil'),
                                   source='modal', modalBatch=record.get('batch')),
                        certificate=proof)
    return dict(id=record['id'], groupId=config['groupId'], model=config['model'],
                label=job.get('label'), lattice=record.get('lattice'),
                family=record.get('family'), L=config['L'], period=config['period'],
                localCertificatePassed=bool(proof['passed']),
                remoteCertificatePassed=bool(record.get('certificatePassed')),
                shaMatchesRemote=(digest == record.get('fieldSha256')),
                fieldSha256=digest, usableMonochrome=mono['usable'],
                distinctPictures=len({r['pictureSignature'] for r in mono['rules']}),
                distinctUsablePictures=len({r['pictureSignature'] for r in mono['rules']
                                            if usable_monochrome(r, mono['span'])}),
                usableGyre=record.get('usableGyre'), usableTrefoil=record.get('usableTrefoil'),
                monochromeRules=[dict(rule=r['rule'], kind=r['kind'], M=r.get('M'),
                                      nodeShift=r.get('shift'), operation=r.get('operation'),
                                      pictureSignature=r['pictureSignature'],
                                      balance=r['balance'], blackFraction=r['blackFraction'],
                                      zeroFraction=r['zeroFraction'], contrast=r['contrast'],
                                      boundaryDensity=r['boundaryDensity'],
                                      speckleRate=r['speckleRate'],
                                      spatialSwapMax=r.get('spatialSwapMax'),
                                      timeSwapMax=r['timeSwapMax'],
                                      groupSwapOperations=[s['operation'] for s in r.get('spatialSwaps', [])],
                                      usable=usable_monochrome(r, mono['span']))
                                 for r in mono['rules']],
                path=str(path.parent))


def app_states_from(path):
    """Map app id -> state from a saved `modal app list --json`, so the ledger records the
    state Modal actually reports rather than an assumption that the apps stopped."""
    rows = json.loads(Path(path).read_text())
    return {row['app_id']: row['state'] for row in rows}


def build_ledger(app_states=None):
    """Assemble compute-ledger.json with the same worst-case reservation method the
    equations ledger uses: for every job, the full task timeout plus the full startup
    timeout plus the scale-down allowance at the container rate, plus a $3 image-build and
    accounting reserve per app.  A reservation, not a provider invoice."""
    reservations = json.loads((OUT / 'reservations.json').read_text())
    runs = []
    for entry in reservations['batches']:
        folder = OUT / 'modal' / entry['batch']
        outcomes, returned, submitted, app_id, worker = {}, 0, entry['jobs'], None, 0.0
        if (folder / 'batch.json').exists():
            batch = json.loads((folder / 'batch.json').read_text())
            returned = len(batch['results'])
            submitted = batch['budget']['maximumJobs']
            for row in batch['results']:
                outcomes[row['outcome']] = outcomes.get(row['outcome'], 0) + 1
                worker += float(row.get('seconds') or 0.0)
        log = OUT / ('%s.log' % entry['batch'])
        if log.exists():
            found = re.findall(r'(ap-[A-Za-z0-9]+)', log.read_text())
            app_id = found[-1] if found else None
        runs.append(dict(batch=entry['batch'], appId=app_id, submittedJobs=submitted,
                         returnedJobs=returned, outcomes=outcomes,
                         state=(app_states or {}).get(app_id, 'unknown'),
                         admittedRecords=outcomes.get('admitted', 0),
                         reservedUSDIncludingThreeDollarBuildReserve=entry['reservedUSD'],
                         measuredWorkerSeconds=round(worker, 1),
                         measuredWorkerSecondsUSD=round(worker * RATE, 4),
                         maximumConcurrentContainers=MAX_CONTAINERS, launched=entry['launched']))
    total = sum(r['reservedUSDIncludingThreeDollarBuildReserve'] for r in runs)
    measured = sum(r['measuredWorkerSeconds'] for r in runs)
    ledger = {
        'schema': 'monochrome-compute-ledger-v1',
        'session': time.strftime('%Y-%m-%d', time.gmtime()),
        'authorizedOverallUSD': AUTHORISED_USD,
        'sessionReservationCapUSD': SESSION_CAP_USD,
        'thisSessionConservativeBoundUSD': total,
        'measuredWorkerSeconds': round(measured, 1),
        'measuredWorkerSecondsUSD': round(measured * RATE, 4),
        'measuredScope': ('Sum of the workers own elapsed seconds at the container rate. It is a '
                          'floor, not the invoice: it excludes image build, container startup, the '
                          'idle time a warm container spends between inputs and the scale-down '
                          'window. It is recorded next to the reservation to show how conservative '
                          'the reservation is.'),
        'providerReportedChargesUSD': None,
        'pricingChecked': '2026-09-19',
        'pricingSource': 'https://modal.com/pricing',
        'pricingQuoted': {'cpuUSDPerPhysicalCoreSecond': .0000131,
                          'memoryUSDPerGiBSecond': .00000222},
        'resources': {'cpuPhysicalCoresHardLimit': 2, 'memoryGiBHardLimit': 8, 'gpu': None,
                      'maxContainersPerApp': MAX_CONTAINERS, 'retries': 0,
                      'functionSeconds': TASK_SECONDS, 'workerWallClockSeconds': JOB_BUDGET_SECONDS,
                      'startupSeconds': STARTUP_SECONDS, 'scaleDownSeconds': SCALEDOWN_SECONDS,
                      'perContainerSecondUSD': RATE},
        'method': ('Worst case for every job: full function timeout plus full startup timeout and '
                   'the scale-down allowance at the CPU/memory rate, plus a $3 image-build and '
                   'accounting reserve per app. A conservative reservation, not a provider invoice: '
                   'the returned jobs averaged far less than the timeout. No persistent deployments, '
                   'schedules, retries, endpoints or GPUs were created. Modal re-schedules an input '
                   'whose container is preempted, which is not counted separately; one preemption '
                   'was observed in the smoke batch.'),
        'totalSubmittedJobs': sum(r['submittedJobs'] for r in runs),
        'totalReturnedJobs': sum(r['returnedJobs'] for r in runs),
        'totalAdmittedRecords': sum(r['admittedRecords'] for r in runs),
        'runs': runs,
    }
    (HERE / 'compute-ledger.json').write_text(json.dumps(ledger, indent=1))
    return ledger


def report():
    """Admitted orbits per (equation, group, lattice), and the groups that gained their
    first non-Gray-Scott orbit."""
    rows = {r['id']: r for r in group_table()}
    admitted = []
    for path in sorted((OUT / 'modal').glob('*/*/result.json')):
        record = json.loads(path.read_text())
        if record.get('outcome') == 'admitted':
            admitted.append(record)
    by_key, by_group = {}, {}
    for record in admitted:
        key = '%s|%s|%s' % (record['config']['model'], record['config']['groupId'], record['lattice'])
        by_key[key] = by_key.get(key, 0) + 1
        by_group.setdefault(record['config']['groupId'], set()).add(record['config']['model'])
    firsts = sorted((gid for gid, models in by_group.items() if rows[gid]['onlyGrayScott']),
                    key=lambda g: int(g[1:]))
    return dict(admitted=len(admitted),
                usableMonochrome=sum(1 for r in admitted if r.get('usableMonochrome')),
                usableGyre=sum(1 for r in admitted if r.get('usableGyre')),
                usableTrefoil=sum(1 for r in admitted if r.get('usableTrefoil')),
                groupsCovered=len(by_group),
                firstNonGrayScott=[dict(groupId=g, family=rows[g]['family'],
                                        lattice=rows[g]['lattice'],
                                        models=sorted(by_group[g])) for g in firsts],
                perEquationGroupLattice=dict(sorted(by_key.items())),
                perModel={m: sum(v for k, v in by_key.items() if k.split('|')[0] == m)
                          for m in sorted({k.split('|')[0] for k in by_key})})


def index():
    """One compact row per locally re-admitted record, grouped by wallpaper family: what a
    monochrome explorer needs to list, filter and draw an orbit without reading the fields.
    Written to out/monochrome-index.json."""
    rows = {r['id']: r for r in group_table()}
    records = []
    for path in sorted((OUT / 'modal').glob('*/audit.json')):
        batch = path.parent.name
        for row in json.loads(path.read_text()):
            if not (row['localCertificatePassed'] and row['shaMatchesRemote']):
                continue
            usable = [r for r in row['monochromeRules'] if r['usable']]
            entry = rows[row['groupId']]
            records.append(dict(id=row['id'], batch=batch, groupId=row['groupId'],
                                family=row['family'], lattice=row['lattice'],
                                orbifold=None, phaseOrder=entry['order'],
                                model=row['model'], label=row['label'], L=row['L'],
                                period=row['period'], fieldSha256=row['fieldSha256'],
                                path=os.path.relpath(row['path'], str(HERE)),
                                groupHosts=entry['hosts'],
                                firstNonGrayScott=entry['onlyGrayScott'],
                                usableMonochrome=len(usable),
                                distinctUsablePictures=row['distinctUsablePictures'],
                                rules=usable))
    records.sort(key=lambda r: (r['family'], int(r['groupId'][1:]), r['model'], r['L'], r['id']))
    families = {}
    for record in records:
        families.setdefault(record['family'], []).append(record['id'])
    payload = dict(schema='monochrome-index-v1', gate='colour-offline-v1',
                   generated=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                   records=len(records),
                   byFamily={k: len(v) for k, v in sorted(families.items())},
                   byLattice={k: sum(1 for r in records if r['lattice'] == k)
                              for k in ('square', 'triangular')},
                   byModel={m: sum(1 for r in records if r['model'] == m)
                            for m in sorted({r['model'] for r in records})},
                   entries=records)
    (OUT / 'monochrome-index.json').write_text(json.dumps(payload, indent=1, default=float))
    return {k: v for k, v in payload.items() if k != 'entries'}


def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', action='store_true',
                        help='write out/monochrome-index.json from the audited batches')
    parser.add_argument('--ledger', action='store_true', help='write compute-ledger.json')
    parser.add_argument('--app-states', default=None, metavar='FILE',
                        help='a saved `modal app list --json`, for the ledger app states')
    parser.add_argument('--report', action='store_true', help='admitted orbits per equation/group')
    parser.add_argument('--plan', choices=['sq-phase', 'sq-hopf', 'probe'])
    parser.add_argument('--batch', default=None)
    parser.add_argument('--limit', type=int, default=MAX_JOBS)
    parser.add_argument('--offset', type=int, default=0)
    parser.add_argument('--groups', action='store_true', help='print the group table and exit')
    parser.add_argument('--audit', default=None, help='re-admit a downloaded batch folder')
    parser.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    if args.groups:
        print(json.dumps(group_table(), indent=1))
        return
    if args.index:
        print(json.dumps(index(), indent=1))
        return
    if args.ledger:
        states = app_states_from(args.app_states) if args.app_states else None
        print(json.dumps(build_ledger(states), indent=1))
        return
    if args.report:
        print(json.dumps(report(), indent=1))
        return
    if args.audit:
        rows = audit_folder(args.audit, workers=args.workers)
        Path(args.audit, 'audit.json').write_text(json.dumps(rows, indent=1, default=float))
        passed = sum(1 for r in rows if r['localCertificatePassed'] and r['shaMatchesRemote'])
        print(json.dumps(dict(records=len(rows), locallyAdmitted=passed,
                              usableMonochrome=sum(1 for r in rows if r['usableMonochrome']),
                              distinctUsablePictures=sum(r['distinctUsablePictures'] for r in rows),
                              usableGyre=sum(1 for r in rows if r.get('usableGyre')),
                              usableTrefoil=sum(1 for r in rows if r.get('usableTrefoil'))), indent=1))
        return
    if not args.plan:
        parser.error('one of --plan, --groups, --audit, --ledger or --report')
    batch = args.batch or args.plan
    jobs = make_jobs(args.plan, batch)
    total = len(jobs)
    jobs = jobs[args.offset:args.offset + args.limit]
    folder = OUT / batch
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'jobs.json').write_text(json.dumps(jobs, indent=1))
    for job in jobs:
        validate(job)
    bound = budget_for(len(jobs))
    print(json.dumps(dict(plan=args.plan, batch=batch, planned=total, dispatching=len(jobs),
                          jobsFile=str(folder / 'jobs.json'),
                          worstCaseUSD=round(bound, 4), perBatchCapUSD=BATCH_CAP_USD,
                          sessionCapUSD=SESSION_CAP_USD,
                          expectedWallClockMinutes=round(len(jobs) * (11 if args.plan == 'sq-phase' else 110)
                                                         / MAX_CONTAINERS / 60, 1),
                          groups=len({j['groupId'] for j in jobs}),
                          labels=len({j['label'] for j in jobs})), indent=1))


if __name__ == '__main__':
    cli()
