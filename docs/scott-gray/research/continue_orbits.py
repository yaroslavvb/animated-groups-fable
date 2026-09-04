#!/usr/bin/env python3
"""Continue a Gray–Scott standing/rotating periodic branch at nearby feed values.

Python 3, NumPy, SciPy and a C++17 compiler are required. Start from a saved
canonical g95 (standing) or g96 (rotating) field, not a rendered image. The
script writes candidates; audit-continuation.mjs must independently accept
the exact exported Float32 bytes before they enter a verified atlas.
"""
import argparse
import ctypes
import json
import platform
import subprocess
import time
from pathlib import Path

import numpy as np
from scipy.optimize import root
from scipy.signal import resample

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--family', choices=['standing', 'rotating'], required=True)
parser.add_argument('--initial', type=Path, required=True, help='Initial canonical orbit metadata JSON; binary URL resolves beside it.')
parser.add_argument('--initial-fine', type=Path, help='Optional separate fine-grid initial orbit metadata.')
parser.add_argument('--feeds', nargs='+', type=float, required=True)
parser.add_argument('--coarse-grid', type=int, default=24)
parser.add_argument('--fine-grid', type=int, default=48)
parser.add_argument('--frames', type=int, default=128)
parser.add_argument('--kill', type=float, help='Defaults to the initial orbit value; then held fixed.')
parser.add_argument('--du', type=float, help='Defaults to the initial orbit value; then held fixed.')
parser.add_argument('--dv', type=float, help='Defaults to the initial orbit value; then held fixed.')
parser.add_argument('--length', type=float, help='Physical side; defaults to initial N*dx and stays fixed during refinement.')
parser.add_argument('--output', type=Path, default=Path('continued-orbits'))
args = parser.parse_args()
rotating = args.family == 'rotating'
group_id, phase_fraction = ('g96', .25) if rotating else ('g95', .5)
M, coarse_N, fine_N = args.frames, args.coarse_grid, args.fine_grid
if any(n < 8 or n % 4 for n in [M, coarse_N, fine_N]) or fine_N <= coarse_N:
    parser.error('Frame/grid counts must be multiples of four, at least eight; fine grid must be larger.')
if any(not np.isfinite(F) or F <= 0 for F in args.feeds):
    parser.error('This continuation requires positive finite feed values.')
args.output.mkdir(parents=True, exist_ok=True)


def load_initial(path):
    meta = json.loads(path.read_text())
    config = meta['config']
    if config.get('groupId', group_id) != group_id:
        raise ValueError('Use a canonical '+group_id+' initial field for this branch family.')
    n = config['N']
    if 'field' in meta:
        values = np.asarray(meta['field'], dtype=np.float64)
    else:
        binary = path.parent / meta['fieldUrl'] if 'fieldUrl' in meta else path.with_suffix('.f64')
        encoding = meta.get('fieldEncoding', 'float64-le')
        if encoding not in ['float32-le', 'float64-le']:
            raise ValueError('Unsupported input field encoding: '+encoding)
        values = np.fromfile(binary, dtype='<f4' if encoding == 'float32-le' else '<f8').astype(np.float64)
    if len(values) < 2*n*n or not np.isfinite(values).all():
        raise ValueError('The initial field is incomplete or nonfinite.')
    return {'config': config, 'period': config.get('period', meta.get('period')),
            'state': values[:2*n*n], 'N': n, 'source': str(path.resolve())}


base = load_initial(args.initial)
base_fine = load_initial(args.initial_fine) if args.initial_fine else base
initial_p = base['config']['params']
kill = initial_p['k'] if args.kill is None else args.kill
Du = initial_p['Du'] if args.du is None else args.du
Dv = initial_p['Dv'] if args.dv is None else args.dv
L = base['N']*initial_p['dx'] if args.length is None else args.length
if not all(np.isfinite(v) for v in [kill, Du, Dv, L]) or kill < 0 or min(Du, Dv, L) <= 0:
    parser.error('Kill must be nonnegative; diffusion coefficients and physical length must be positive.')
if initial_p.get('stencil', 'five-point') != 'five-point':
    parser.error('This native continuation implementation uses the five-point stencil.')
source = Path(__file__).with_name('gray_scott_rk4.cpp')
build = args.output.resolve() / '.build'
build.mkdir(exist_ok=True)
library = build / ('gray_scott_rk4.dylib' if platform.system() == 'Darwin' else 'gray_scott_rk4.so')
flags = ['-dynamiclib'] if platform.system() == 'Darwin' else ['-shared', '-fPIC']
subprocess.run(['c++', '-O3', '-std=c++17', *flags, str(source), '-o', str(library)], check=True)
lib = ctypes.CDLL(str(library))
native = lib.flow
pointer = ctypes.POINTER(ctypes.c_double)
native.argtypes = [pointer, pointer, ctypes.c_int] + [ctypes.c_double]*6 + [ctypes.c_int]
native.restype = None
ops = [
    {'M': [[-1, 0], [0, -1]], 'v': [0, 0], 's': 1, 'tau': .5 if rotating else 0},
    {'M': [[0, -1], [1, 0]], 'v': [0, 0], 's': 1, 'tau': phase_fraction},
    {'M': [[0, 1], [-1, 0]], 'v': [0, 0], 's': 1, 'tau': .75 if rotating else .5},
    {'M': [[1, 0], [0, 1]], 'v': [0, 0], 's': 1, 'tau': 0}
]


def regrid(state, old, new):
    if old == new:
        return state.copy()
    return resample(resample(state.reshape(2, old, old), new, axis=1), new, axis=2).reshape(-1)


history = {}
for N, initial in [(coarse_N, base), (fine_N, base_fine)]:
    history[N] = [{'F': initial['config']['params']['F'], 'period': initial['period'],
                   'state': regrid(initial['state'], initial['N'], N), 'source': initial['source']}]
manifest = {'schema': 'scott-gray-continuation-candidates-v1', 'family': args.family,
            'initial': base['source'], 'fixedParameters': {'k': kill, 'Du': Du, 'Dv': Dv, 'L': L, 'stencil': 'five-point'},
            'candidates': [], 'failures': [],
            'caveat': 'Search outputs require independent admission of their exported Float32 field; they are not existence proofs.'}


def save_manifest():
    (args.output / 'candidates.json').write_text(json.dumps(manifest, indent=2))


def solve(F, N, initial, Tguess, seed_description):
    started = time.time()
    S, dx = N*N, L/N
    y, x = np.indices((N, N))
    offset = N//2 if rotating else 0
    cx, cy = np.minimum(x, (offset-x) % N), np.minimum(y, (offset-y) % N)
    _, spatial = np.unique((cy*N+cx).reshape(-1), return_inverse=True)
    count = spatial.max()+1
    expand = np.r_[spatial, spatial+count]
    _, representatives = np.unique(expand, return_index=True)
    inverse_rotation = (((-x) % N)*N+y).reshape(-1)
    inverse_rotation = np.r_[inverse_rotation, inverse_rotation+S]

    def flow(state, duration, dt=.4):
        state = np.ascontiguousarray(state, dtype=np.float64)
        out = np.empty_like(state)
        safe_dt = min(dt, .15*dx*dx/max(Du, Dv))
        native(state.ctypes.data_as(pointer), out.ctypes.data_as(pointer), N,
               Du, Dv, F, kill, dx, duration, int(np.ceil(duration/safe_dt)))
        return out

    initial = initial[representatives][expand]
    reference = initial.copy()
    tangent = (flow(initial, .01)-initial)/.01
    tangent /= np.linalg.norm(tangent)
    calls = 0

    def residual(z):
        nonlocal calls
        calls += 1
        state, T = z[:-1][expand], np.exp(z[-1])
        difference = flow(state, T*phase_fraction)-state[inverse_rotation]
        result = np.r_[difference[representatives], np.dot(state-reference, tangent)]
        if not np.isfinite(result).all():
            raise FloatingPointError('Trial shooting integration became nonfinite.')
        if calls % 800 == 0:
            print(json.dumps({'stage': 'newton', 'F': F, 'N': N, 'calls': calls,
                              'rms': float(np.sqrt(np.mean(result**2))), 'period': float(T)}), flush=True)
        return result

    z = np.r_[initial[representatives], np.log(Tguess)]
    name = (f'{group_id}-F{F}-k{kill}').replace('.', 'p')+f'-N{N}-M{M}'
    initial_rms = float(np.sqrt(np.mean(residual(z)**2)))
    print(json.dumps({'stage': 'start', 'F': F, 'N': N, 'initialRms': initial_rms, 'seed': seed_description}), flush=True)
    fit = root(residual, z, method='hybr', options={'xtol': 1e-9, 'maxfev': 7500, 'factor': .1})
    state, T = fit.x[:-1][expand], float(np.exp(fit.x[-1]))
    shooting_rms = float(np.sqrt(np.mean(residual(fit.x)**2)))
    report = {'period': T, 'rootConverged': bool(fit.success), 'rootMessage': str(fit.message),
              'shootingResidualRms': shooting_rms, 'initialShootingResidualRms': initial_rms,
              'calls': calls, 'elapsedSeconds': time.time()-started, 'seed': seed_description,
              'method': 'Symmetry-twisted unprojected RK4 Newton shooting with phase condition',
              'family': args.family, 'phaseFraction': phase_fraction,
              'extraSymmetry': 'This branch also has instantaneous mirror symmetries used to reduce shooting unknowns.'}
    if not fit.success or shooting_rms > 1e-9:
        manifest['failures'].append({'F': F, 'N': N, **report})
        (args.output / (name+'-failed.json')).write_text(json.dumps(report, indent=2))
        save_manifest()
        return None
    frames, current = [], state.copy()
    for frame in range(M):
        frames.append(current.copy())
        current = flow(current, T/M, dt=.1)
    field = np.asarray(frames)
    temporal_rms = float(np.sqrt(np.mean((field-field.mean(axis=0))**2)))
    shaped = field.reshape(M, 2, S)
    spatial_rms = float(np.sqrt(np.mean((shaped-shaped.mean(axis=2, keepdims=True))**2)))
    config = {'N': N, 'M': M, 'period': T, 'groupId': group_id, 'L': L, 'ops': ops,
              'params': {'F': F, 'k': kill, 'Du': Du, 'Dv': Dv, 'dx': dx, 'stencil': 'five-point'},
              'minTemporal': .008, 'minSpatial': .012}
    report.update(config=config, fullReturnRms=float(np.sqrt(np.mean((current-state)**2))),
                  temporalRms=temporal_rms, spatialRms=spatial_rms,
                  minimum=float(field.min()), maximum=float(field.max()),
                  fieldUrl=name+'.f64', fieldEncoding='float64-le',
                  fieldLayout='frame-major; planar U then V; x-fast; lattice nodes i/N,j/N')
    field.astype('<f8').tofile(args.output / (name+'.f64'))
    (args.output / (name+'.json')).write_text(json.dumps(report, indent=2))
    print(json.dumps({'stage': 'solved', 'F': F, 'N': N, 'period': T, 'shootingRms': shooting_rms,
                      'returnRms': report['fullReturnRms'], 'spatialRms': spatial_rms}), flush=True)
    if temporal_rms < .008 or spatial_rms < .012:
        manifest['failures'].append({'F': F, 'N': N, 'reason': 'Nontriviality floor not reached.'})
        save_manifest()
        return None
    return {'F': F, 'period': T, 'state': state, 'field': field,
            'source': name+'.json', 'report': report}


for F in args.feeds:
    h = history[coarse_N]
    previous_coarse = h[-1]
    if len(h) > 1 and h[-1]['F'] != h[-2]['F']:
        ratio = (F-h[-1]['F'])/(h[-1]['F']-h[-2]['F'])
        initial = h[-1]['state']+ratio*(h[-1]['state']-h[-2]['state'])
        Tguess = h[-1]['period']+ratio*(h[-1]['period']-h[-2]['period'])
        seed = f'Secant predictor from feed {h[-2]["F"]} and {h[-1]["F"]} on the coarse grid.'
    else:
        initial, Tguess = previous_coarse['state'], previous_coarse['period']
        seed = 'Previous orbit resampled as a coarse-grid predictor; then corrected by shooting.'
    try:
        coarse = solve(F, coarse_N, initial, Tguess, seed)
        if coarse is None:
            continue
        h.append(coarse)
        previous_fine = history[fine_N][-1]
        if previous_fine['F'] == previous_coarse['F']:
            initial = previous_fine['state']+regrid(coarse['state']-previous_coarse['state'], coarse_N, fine_N)
            Tguess = previous_fine['period']+coarse['period']-previous_coarse['period']
            seed = 'Measured coarse-grid parameter correction lifted onto the previous fine-grid orbit.'
        else:
            initial, Tguess = regrid(coarse['state'], coarse_N, fine_N), coarse['period']
            seed = 'Fourier resampling of the new coarse-grid orbit with physical length held fixed.'
        fine = solve(F, fine_N, initial, Tguess, seed)
        if fine is None:
            continue
        history[fine_N].append(fine)
        # Compare full movies on the coarse nodes using Fourier interpolation
        # when the two grids do not have coincident nodes.
        fine_coarse = np.asarray([regrid(frame, fine_N, coarse_N) for frame in fine['field']])
        difference = fine_coarse-coarse['field']
        refinement = {'coarseGrid': coarse_N, 'fineGrid': fine_N, 'physicalSide': L,
                      'coarsePeriod': coarse['period'], 'finePeriod': fine['period'],
                      'relativePeriodDifference': abs(fine['period']-coarse['period'])/coarse['period'],
                      'fieldRmsDifference': float(np.sqrt(np.mean(difference**2))),
                      'fieldMaxDifference': float(np.max(np.abs(difference))),
                      'relativeToCoarseTemporalRms': float(np.sqrt(np.mean(difference**2)))/coarse['report']['temporalRms'],
                      'comparison': 'Full normalized-phase movies; Fourier resampling to the coarse grid; all physical parameters fixed.'}
        fine['report']['spatialRefinement'] = refinement
        (args.output / fine['source']).write_text(json.dumps(fine['report'], indent=2))
        manifest['candidates'].append({'family': args.family, 'groupId': group_id, 'url': fine['source'], 'F': F, 'k': kill})
        save_manifest()
    except (FloatingPointError, ValueError) as error:
        manifest['failures'].append({'F': F, 'reason': str(error)})
        save_manifest()
        print(json.dumps({'stage': 'failed', 'F': F, 'reason': str(error)}), flush=True)
print('Candidates written to', args.output / 'candidates.json')
print('Next: node audit-continuation.mjs', args.output / 'candidates.json', '--output', args.output / 'bundles')
