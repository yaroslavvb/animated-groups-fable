#!/usr/bin/env python3
"""Reproduce a standing Gray–Scott pattern with several spatial cells per side.

A mode-m solution is shot on side L/m, then extended by exact spatial
repetition onto side L. This preserves the local equation and physical grid
spacing. Outputs remain candidates until the independent Float32 atlas audit.
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
parser.add_argument('--mode', type=int, default=2)
parser.add_argument('--feed', type=float, default=.00403)
parser.add_argument('--kill', type=float, default=.02)
parser.add_argument('--du', type=float, default=.16)
parser.add_argument('--dv', type=float, default=.08)
parser.add_argument('--length', type=float, default=256.)
parser.add_argument('--coarse-grid', type=int, default=24)
parser.add_argument('--fine-grid', type=int, default=48)
parser.add_argument('--frames', type=int, default=128)
parser.add_argument('--amplitudes', nargs='+', type=float, default=[.035, .05, .025])
parser.add_argument('--period-guess', type=float, default=335.)
parser.add_argument('--output', type=Path, default=Path('standing-mode2'))
args = parser.parse_args()
mode, F, kill, Du, Dv, M = args.mode, args.feed, args.kill, args.du, args.dv, args.frames
if mode < 1 or M < 8 or M % 4 or args.fine_grid <= args.coarse_grid:
    parser.error('Use a positive mode, M divisible by four, and a larger fine grid.')
for N in [args.coarse_grid, args.fine_grid]:
    if N % mode or N//mode < 8 or (N//mode) % 4:
        parser.error('Each full grid divided by the mode must be a multiple of four, at least eight.')
if min(F, Du, Dv, args.length, args.period_guess) <= 0 or kill < 0:
    parser.error('Feed, diffusion, length, and period guess must be positive; kill must be nonnegative.')
if 1-4*(F+kill)**2/F <= 0:
    parser.error('The requested parameters lack the reactive equilibrium used by this Hopf seed.')
args.output.mkdir(parents=True, exist_ok=True)
source = Path(__file__).with_name('gray_scott_rk4.cpp')
library = args.output.resolve() / ('gray_scott_rk4.dylib' if platform.system() == 'Darwin' else 'gray_scott_rk4.so')
flags = ['-dynamiclib'] if platform.system() == 'Darwin' else ['-shared', '-fPIC']
subprocess.run(['c++', '-O3', '-std=c++17', *flags, str(source), '-o', str(library)], check=True)
lib = ctypes.CDLL(str(library))
native = lib.flow
pointer = ctypes.POINTER(ctypes.c_double)
native.argtypes = [pointer, pointer, ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int]
native.restype = None
ops = [
    {'M': [[-1, 0], [0, -1]], 'v': [0, 0], 's': 1, 'tau': 0},
    {'M': [[0, -1], [1, 0]], 'v': [0, 0], 's': 1, 'tau': .5},
    {'M': [[0, 1], [-1, 0]], 'v': [0, 0], 's': 1, 'tau': .5},
    {'M': [[1, 0], [0, 1]], 'v': [0, 0], 's': 1, 'tau': 0}
]


def solve(full_N, initial=None, period=None, amplitude=.035):
    N, cell_length = full_N//mode, args.length/mode
    S, dx, started = N*N, cell_length/N, time.time()
    y, x = np.indices((N, N))
    roots = (np.minimum(y, (-y) % N)*N+np.minimum(x, (-x) % N)).reshape(-1)
    _, spatial = np.unique(roots, return_inverse=True)
    count = spatial.max()+1
    expand = np.r_[spatial, spatial+count]
    _, representatives = np.unique(expand, return_index=True)
    inverse_rotation = (((-x) % N)*N+y).reshape(-1)
    inverse_rotation = np.r_[inverse_rotation, inverse_rotation+S]

    def flow(state, duration, dt=.4):
        state = np.ascontiguousarray(state, dtype=np.float64)
        out = np.empty_like(state)
        dt = min(dt, .15*dx*dx/max(Du, Dv))
        native(state.ctypes.data_as(pointer), out.ctypes.data_as(pointer), N,
               Du, Dv, F, kill, dx, duration, int(np.ceil(duration/dt)))
        return out

    if initial is None:
        u = (1-np.sqrt(1-4*(F+kill)**2/F))/2
        v = F*(1-u)/(F+kill)
        lam = (2*np.cos(2*np.pi/N)-2)/dx**2
        jac = np.array([[-v*v-F+Du*lam, -2*u*v], [v*v, 2*u*v-F-kill+Dv*lam]])
        ev, vectors = np.linalg.eig(jac)
        column = np.argmax(ev.imag)
        vector = vectors[:, column]/vectors[0, column]
        psi = np.cos(2*np.pi*x/N)-np.cos(2*np.pi*y/N)
        initial = (np.array([u, v])[:, None, None]+amplitude*np.real(vector[:, None, None]*psi)).reshape(-1)
    initial = initial[representatives][expand]
    reference = initial.copy()
    tangent = (flow(initial, .01)-initial)/.01
    tangent /= np.linalg.norm(tangent)
    calls = 0

    def residual(z):
        nonlocal calls
        calls += 1
        state, T = z[:-1][expand], np.exp(z[-1])
        return np.r_[(flow(state, T/2)-state[inverse_rotation])[representatives],
                     np.dot(state-reference, tangent)]

    fit = root(residual, np.r_[initial[representatives], np.log(period or args.period_guess)],
               method='hybr', options={'xtol': 1e-10, 'maxfev': 8000, 'factor': .1})
    state, T = fit.x[:-1][expand], float(np.exp(fit.x[-1]))
    residual_rms = float(np.sqrt(np.mean(residual(fit.x)**2)))
    frames, current = [], state.copy()
    for frame in range(M):
        frames.append(current.copy())
        current = flow(current, T/M, dt=.1)
    small = np.asarray(frames).reshape(M, 2, N, N)
    field = np.tile(small, (1, 1, mode, mode))
    temporal_rms = float(np.sqrt(np.mean((field-field.mean(axis=0))**2)))
    spatial_rms = float(np.sqrt(np.mean((field-field.mean(axis=(2, 3), keepdims=True))**2)))
    config = {'N': full_N, 'M': M, 'period': T, 'L': args.length, 'groupId': 'g95', 'ops': ops,
              'params': {'F': F, 'k': kill, 'Du': Du, 'Dv': Dv, 'dx': dx, 'stencil': 'five-point'},
              'minTemporal': .008, 'minSpatial': .012}
    name = (f'g95-mode{mode}-F{F}-k{kill}').replace('.', 'p')+f'-N{full_N}-M{M}'
    report = {'config': config, 'period': T, 'family': 'standing', 'spatialMode': mode,
              'rootConverged': bool(fit.success), 'rootMessage': str(fit.message),
              'shootingResidualRms': residual_rms, 'fullReturnRms': float(np.sqrt(np.mean((current-state)**2))),
              'temporalRms': temporal_rms, 'spatialRms': spatial_rms,
              'method': 'Half-period unprojected RK4 Newton shooting on a smaller periodic cell; exact spatial extension',
              'seed': f'Fourier standing Hopf mode, amplitude {amplitude}' if full_N == args.coarse_grid else 'Spatial refinement with physical parameters and full cell length fixed',
              'tiledFrom': {'N': N, 'physicalSide': cell_length, 'tileFactor': mode},
              'extraSymmetry': 'Instantaneous smaller-cell spatial translations and x/y mirrors.',
              'elapsedSeconds': time.time()-started, 'calls': calls,
              'fieldUrl': name+'.f64', 'fieldEncoding': 'float64-le'}
    field.astype('<f8').tofile(args.output/(name+'.f64'))
    (args.output/(name+'.json')).write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != 'config'}), flush=True)
    if not fit.success or not np.isfinite(field).all() or residual_rms > 1e-9 or temporal_rms < .008 or spatial_rms < .012:
        return None
    return {'state': state, 'period': T, 'field': field, 'report': report, 'url': name+'.json'}


coarse = None
for amplitude in args.amplitudes:
    coarse = solve(args.coarse_grid, amplitude=amplitude)
    if coarse:
        break
if coarse is None:
    raise SystemExit('No nontrivial coarse-grid candidate found; this does not establish impossibility.')
a, b = args.coarse_grid//mode, args.fine_grid//mode
initial = resample(resample(coarse['state'].reshape(2, a, a), b, axis=1), b, axis=2).reshape(-1)
fine = solve(args.fine_grid, initial, coarse['period'])
if fine is None:
    raise SystemExit('Fine-grid shooting failed; no verified field was produced.')
if args.fine_grid % args.coarse_grid == 0:
    ratio = args.fine_grid//args.coarse_grid
    sampled = fine['field'][:, :, ::ratio, ::ratio]
    comparison = 'Full normalized-phase movies on coincident spatial nodes; all physical parameters held fixed.'
else:
    sampled = resample(resample(fine['field'], args.coarse_grid, axis=2), args.coarse_grid, axis=3)
    comparison = 'Full normalized-phase movies, Fourier-resampled to the coarse grid; all physical parameters held fixed.'
difference = sampled-coarse['field']
fine['report']['spatialRefinement'] = {
    'coarseGrid': args.coarse_grid, 'fineGrid': args.fine_grid, 'physicalSide': args.length,
    'coarsePeriod': coarse['period'], 'finePeriod': fine['period'],
    'relativePeriodDifference': abs(fine['period']-coarse['period'])/coarse['period'],
    'fieldRmsDifference': float(np.sqrt(np.mean(difference**2))),
    'fieldMaxDifference': float(np.max(np.abs(difference))),
    'relativeToCoarseTemporalRms': float(np.sqrt(np.mean(difference**2)))/coarse['report']['temporalRms'],
    'comparison': comparison}
(args.output/fine['url']).write_text(json.dumps(fine['report'], indent=2))
(args.output/'candidates.json').write_text(json.dumps({
    'schema': 'scott-gray-continuation-candidates-v1',
    'candidates': [{'family': 'standing', 'groupId': 'g95', 'url': fine['url']}]}, indent=2))
print('Next: node audit-continuation.mjs', args.output/'candidates.json', '--primary-only --output', args.output/'bundles')
