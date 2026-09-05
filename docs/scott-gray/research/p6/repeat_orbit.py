#!/usr/bin/env python3
"""Repeat a native P6 periodic cell, then verify the full enlarged native movie.

This supplies a repeated known branch at a larger physical domain. It is not a
new morphology family and never substitutes a visual transform for PDE checks.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--repetitions', type=int, default=2)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    metadata = json.loads(args.source.read_text())
    config = metadata['config']
    factor = args.repetitions
    old_grid = config['N']
    grid = factor * old_grid
    if not 2 <= factor <= 4 or grid > 126:
        parser.error('Use two to four repetitions and a resulting grid no larger than 126.')
    if metadata.get('fieldEncoding') != 'float64-le' or metadata.get('charge') not in [0, 1, 2, 3]:
        parser.error('A full native Float64 shooting candidate is required.')
    if config['params'].get('stencil') != 'triangular-six' or config['params']['Du'] != .16 or config['params']['Dv'] != .08:
        parser.error("The source must use this solver's triangular stencil and diffusion coefficients.")
    field = np.fromfile(args.source.parent / metadata['fieldUrl'], dtype='<f8').reshape(config['M'], 2, old_grid, old_grid)
    args.output.mkdir(parents=True, exist_ok=True)
    initial = np.tile(field[0], (1, factor, factor))
    initial.astype('<f8').tofile(args.output / 'initial.f64')
    seed = json.loads(json.dumps(metadata))
    seed['schema'] = 'scott-gray-p6-domain-cover-initial-state-v1'
    seed['config']['N'] = grid
    seed['config']['L'] *= factor
    assert seed['config']['params']['dx'] == seed['config']['L'] / grid
    seed['fieldUrl'] = 'initial.f64'
    seed_path = args.output / 'initial.json'
    seed_path.write_text(json.dumps(seed, indent=2))
    wave = [factor * n for n in metadata['spatialWavevector']]
    command = [sys.executable, str(Path(__file__).with_name('search.py')),
               '--charge', str(metadata['charge']), '--grid', str(grid),
               '--frames', str(config['M']), '--length', str(seed['config']['L']),
               '--wavevector', *map(str, wave), '--initial', str(seed_path.resolve()),
               '--feed', str(config['params']['F']), '--kill', str(config['params']['k']),
               '--export-initial', '--output', str(args.output.resolve())]
    if metadata.get('instantaneousMirrorAxis') is not None:
        command += ['--mirror-axis', str(metadata['instantaneousMirrorAxis'])]
    with (args.output / 'native-export.log').open('w') as log:
        subprocess.run(command, check=True, stdout=log, stderr=subprocess.STDOUT, timeout=150)
    path = args.output / 'candidate.json'
    result = json.loads(path.read_text())
    saved = np.fromfile(args.output / 'candidate.f32', dtype='<f4').reshape(config['M'], 2, grid, grid)
    expected = np.tile(field.astype('<f4'), (1, 1, factor, factor))
    if not np.array_equal(saved, expected):
        path.rename(args.output / 'repeat-rejected.json')
        raise ValueError('The independently evolved Float32 movie differs from the exact repeated source.')
    result['domainCover'] = {'repetitions': [factor, factor], 'originalPhysicalSide': config['L'],
                             'physicalSide': seed['config']['L'], 'originalGrid': old_grid, 'grid': grid,
                             'spacingUnchanged': True, 'nativeMovieExactlyMatchesFloat32Cover': True,
                             'sourceFloat32Sha256': hashlib.sha256(field.astype('<f4').tobytes()).hexdigest(),
                             'note': 'Exact repeated periodic cell, independently evolved on the larger domain; a repeated known branch, not a new morphology family.'}
    path.write_text(json.dumps(result, indent=2))
    print(json.dumps({'path': str(path), 'grid': grid, 'float32ExactlyRepeated': True}))


if __name__ == '__main__':
    main()
