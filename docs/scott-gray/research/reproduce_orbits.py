#!/usr/bin/env python3
"""Reproduce a Gray–Scott standing or rotating branch from an analytic Hopf seed.

Requires Python 3, NumPy, SciPy and a C++17 compiler. No prerecorded field is
needed. This computes a finite-grid orbit; it is not a continuum existence proof.
"""
import argparse
import ctypes
import json
import platform
import subprocess
from pathlib import Path

import numpy as np
from scipy.optimize import root

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--family', choices=['rotating', 'standing'], default='rotating')
parser.add_argument('--grid', type=int, default=24)
parser.add_argument('--frames', type=int, default=128)
parser.add_argument('--output', type=Path, default=Path('rotating-orbit'))
args = parser.parse_args()
N, M = args.grid, args.frames
rotating = args.family == 'rotating'
group_id = 'g96' if rotating else 'g95'
phase_fraction = .25 if rotating else .5
if N < 8 or N % 4 or M < 8 or M % 4:
    raise ValueError('Grid and frame counts must be multiples of four, at least eight.')
args.output.mkdir(parents=True, exist_ok=True)
source = Path(__file__).with_name('gray_scott_rk4.cpp')
library = args.output.resolve() / ('gray_scott_rk4.dylib' if platform.system() == 'Darwin' else 'gray_scott_rk4.so')
flags = ['-dynamiclib'] if platform.system() == 'Darwin' else ['-shared', '-fPIC']
subprocess.run(['c++', '-O3', '-std=c++17', *flags, str(source), '-o', str(library)], check=True)
lib = ctypes.CDLL(str(library))
flow_native = lib.flow
pointer = ctypes.POINTER(ctypes.c_double)
flow_native.argtypes = [pointer, pointer, ctypes.c_int] + [ctypes.c_double] * 6 + [ctypes.c_int]
flow_native.restype = None
F, kill, Du, Dv, L = .004089987272497608, .02, .16, .08, 256.
dx, S = L / N, N * N


def flow(state, duration, dt=.4):
    state = np.ascontiguousarray(state, dtype=np.float64)
    out = np.empty_like(state)
    flow_native(state.ctypes.data_as(pointer), out.ctypes.data_as(pointer), N,
                Du, Dv, F, kill, dx, duration, int(np.ceil(duration / dt)))
    return out


# The first torus eigenspace contains rotating (character -i) and standing (-1) modes.
u = (1 - np.sqrt(1 - 4 * (F + kill) ** 2 / F)) / 2
v = F * (1 - u) / (F + kill)
lap_eigenvalue = (2 * np.cos(2 * np.pi / N) - 2) / dx ** 2
jac = np.array([[-v*v-F+Du*lap_eigenvalue, -2*u*v],
                [v*v, 2*u*v-F-kill+Dv*lap_eigenvalue]])
eigenvalues, eigenvectors = np.linalg.eig(jac)
column = np.argmax(eigenvalues.imag)
vector = eigenvectors[:, column] / eigenvectors[0, column]
y, x = np.indices((N, N))
psi = np.sin(2*np.pi*x/N) - 1j*np.sin(2*np.pi*y/N) if rotating else np.cos(2*np.pi*x/N)-np.cos(2*np.pi*y/N)
initial = (np.array([u, v])[:, None, None] + (.036 if rotating else .025) * np.real(vector[:, None, None] * psi)).reshape(-1)

# This particular branch has extra instantaneous mirrors. Reducing by them is
# an optimization of the shooting solve, not a projection during evolution.
mirror_offset = N//2 if rotating else 0
cx = np.minimum(x, (mirror_offset-x) % N)
cy = np.minimum(y, (mirror_offset-y) % N)
_, spatial = np.unique((cy*N+cx).reshape(-1), return_inverse=True)
count = spatial.max() + 1
expand = np.r_[spatial, spatial+count]
_, representatives = np.unique(expand, return_index=True)
inverse_rotation = (((-x) % N)*N+y).reshape(-1)
inverse_rotation = np.r_[inverse_rotation, inverse_rotation+S]
reference = initial.copy()
tangent = (flow(initial, .01)-initial)/.01
tangent /= np.linalg.norm(tangent)


def residual(z):
    state, T = z[:-1][expand], np.exp(z[-1])
    # q(R90*x,t+tau*T)=q(x,t), equivalently Phi(tau*T)q=q(R90^-1*x).
    difference = flow(state, T*phase_fraction)-state[inverse_rotation]
    phase = np.dot(state-reference, tangent)
    return np.r_[difference[representatives], phase]


fit = root(residual, np.r_[initial[representatives], np.log(325.96 if rotating else 325.576)],
           method='hybr', options={'xtol': 1e-9, 'maxfev': 15000, 'factor': .1})
state, T = fit.x[:-1][expand], float(np.exp(fit.x[-1]))
shooting_rms = float(np.sqrt(np.mean(residual(fit.x)**2)))
frames, current = [], state.copy()
for frame in range(M):
    frames.append(current.copy())
    current = flow(current, T/M, dt=.1)
field = np.array(frames).reshape(M, 2, N, N)
# Exact discrete C4 space-time averaging only removes shooting roundoff. It is
# reported, and independent integration below starts from the resulting field.
projected = sum(field[(np.arange(M)+a*M//(4 if rotating else 2)) % M][:, :,
                      (x if a == 1 else (-y) % N if a == 2 else (-x) % N if a == 3 else y),
                      ((-y) % N if a == 1 else (-x) % N if a == 2 else y if a == 3 else x)]
                for a in range(4))/4
projection_rms = float(np.sqrt(np.mean((field-projected)**2)))
field = projected
state = field[0].reshape(-1)
checks = []
for dt in [.2, .1, .05]:
    final = flow(state, T, dt=dt)
    checks.append({'dtLimit': dt, 'closureRms': float(np.sqrt(np.mean((final-state)**2)))})
spatial_rms = float(np.sqrt(np.mean((field-field.mean(axis=(2, 3), keepdims=True))**2)))
temporal_rms = float(np.sqrt(np.mean((field-field.mean(axis=0, keepdims=True))**2)))
config = {'N': N, 'M': M, 'groupId': group_id, 'period': T, 'L': L,
          'params': {'F': F, 'k': kill, 'Du': Du, 'Dv': Dv, 'dx': dx, 'stencil': 'five-point'},
          'minTemporal': .008, 'minSpatial': .012, 'periodBounds': [100, 600],
          'ops': [{'M': [[-1, 0], [0, -1]], 'v': [0, 0], 's': 1, 'tau': .5 if rotating else 0},
                  {'M': [[0, -1], [1, 0]], 'v': [0, 0], 's': 1, 'tau': .25 if rotating else .5},
                  {'M': [[0, 1], [-1, 0]], 'v': [0, 0], 's': 1, 'tau': .75 if rotating else .5},
                  {'M': [[1, 0], [0, 1]], 'v': [0, 0], 's': 1, 'tau': 0}]}
report = {'config': config, 'period': T, 'method': ('Quarter' if rotating else 'Half')+'-period RK4 shooting with phase condition',
          'rootConverged': bool(fit.success), 'rootMessage': str(fit.message),
          'shootingRms': shooting_rms, 'projectionRms': projection_rms,
          'temporalRms': temporal_rms, 'spatialRms': spatial_rms, 'independentStepChecks': checks,
          'extraSymmetry': ('Instantaneous mirrors x->1/2-x, y->1/2-y.' if rotating else 'Instantaneous mirrors x->-x, y->-y.')+' Also diagonal half-cell/time centering.',
          'caveat': 'Finite-grid numerical evidence. Run the site atlas audit before admission.'}
field.astype('<f8').tofile(args.output / (group_id+'.f64'))
field.astype('<f4').tofile(args.output / (group_id+'.f32'))
(args.output / (group_id+'.json')).write_text(json.dumps(report, indent=2))
print(json.dumps({key: value for key, value in report.items() if key != 'config'}, indent=2))
if not fit.success or shooting_rms > 1e-9 or temporal_rms < .008 or spatial_rms < .012:
    raise SystemExit('The requested branch did not pass the reproduction checks.')
