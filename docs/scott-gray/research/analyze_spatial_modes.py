#!/usr/bin/env python3
"""Measure spatial wavelengths from delivered Float32 orbit bytes.

Usage: python3 research/analyze_spatial_modes.py --output research/spatial-mode-evidence.json
Defaults to every shipped g95 standing-wave field. NumPy is required.
The result measures extra spatial periods; it does not re-prove the PDE.
"""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--site-root', type=Path, default=Path(__file__).resolve().parent.parent)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
rows = []
for path in sorted((args.site_root / 'data/orbits').glob('g95-*.json')):
    meta = json.loads(path.read_text())
    if meta.get('schema') != 'scott-gray-orbit-binary-v1':
        continue
    config = meta['config']
    n, m = config['N'], config['M']
    raw = (path.parent / meta['fieldUrl']).read_bytes()
    assert meta['fieldEncoding'] == 'float32-le'
    assert hashlib.sha256(raw).hexdigest() == meta['fieldSha256']
    q = np.frombuffer(raw, dtype='<f4').astype(np.float64).reshape(m, 2, n, n)
    centered = q - q.mean(axis=(-2, -1), keepdims=True)
    fft = np.fft.fft2(centered, axes=(-2, -1))
    energy = np.mean(np.abs(fft)**2, axis=(0, 1)) / n**4
    total = float(energy.sum())
    peaks = []
    for index in np.argsort(energy.ravel())[::-1][:12]:
        y, x = np.unravel_index(index, energy.shape)
        peaks.append({'kx': int(x if x <= n//2 else x-n),
                      'ky': int(y if y <= n//2 else y-n),
                      'fractionOfSpatialEnergy': float(energy[y, x] / total)})
    repeats = []
    for divisor in (2, 3, 4, 6):
        if n % divisor:
            continue
        for axis, dimension in (('x', -1), ('y', -2)):
            difference = np.roll(q, -n//divisor, axis=dimension)-q
            repeats.append({'axis': axis, 'divisor': divisor,
                            'translationFraction': 1/divisor,
                            'rms': float(np.sqrt(np.mean(difference**2))),
                            'max': float(np.max(np.abs(difference)))})
    frequencies = np.minimum(np.arange(n), n-np.arange(n))
    principal = {}
    for order in (1, 2, 3):
        mask = ((frequencies[:, None] == order) & (frequencies[None, :] == 0)) | ((frequencies[:, None] == 0) & (frequencies[None, :] == order))
        principal[str(order)] = float(energy[mask].sum()/total)
    rows.append({'metadata': str(path.relative_to(args.site_root)),
                 'fieldSha256': meta['fieldSha256'], 'groupId': config['groupId'],
                 'params': config['params'], 'L': config.get('L', n*config['params']['dx']),
                 'N': n, 'M': m, 'period': config['period'],
                 'spatialRms': float(np.sqrt(total)),
                 'principalAxialEnergyFractions': principal,
                 'dominantFourierModes': peaks, 'spatialTranslationChecks': repeats})
output = {'schema': 'scott-gray-spatial-mode-evidence-v1',
          'method': 'Float32 bytes decoded to Float64; spatial mean removed per frame and species; 2D DFT energy averaged over all phases and both species. Translation checks use every concentration sample.',
          'caveat': 'Different wavelengths on the same physical square are distinct patterns. Extra smaller spatial periods mean the displayed cell need not be spatially primitive. These measurements do not establish continuum existence, stability or full isotropy.',
          'orbits': rows}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output, indent=2)+'\n')
print(f'Measured {len(rows)} delivered Float32 standing-wave fields: {args.output}')
