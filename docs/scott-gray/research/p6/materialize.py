#!/usr/bin/env python3
"""Independently materialize corrected GPU initial states as native RK4 movies.

The public Float32 catalog gate remains a separate mandatory step. This helper
does not admit candidates and never changes numerical tolerances.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--frames', type=int, default=96)
    parser.add_argument('--workers', type=int, choices=[1, 2], default=2)
    args = parser.parse_args()
    if args.frames < 12 or args.frames % 6:
        parser.error('Saved frame count must be a multiple of six.')
    args.output.mkdir(parents=True, exist_ok=True)
    reports = sorted(args.input_root.glob('*/report.json'))

    def materialize(path):
        report = json.loads(path.read_text())
        if report.get('converged') is not True:
            return {'name': path.parent.name, 'status': 'not-converged'}
        cfg = report['config']
        source = path.parent / report['fieldUrl']
        digest = hashlib.sha256(path.read_bytes() + source.read_bytes()).hexdigest()
        output = args.output / path.parent.name
        output.mkdir(exist_ok=True)
        provenance = output / 'materialized-from.json'
        candidate = output / 'candidate.json'
        if candidate.exists() and provenance.exists():
            old = json.loads(provenance.read_text())
            if old.get('sourceSha256') == digest and old.get('frames') == args.frames:
                return {'name': path.parent.name, 'status': 'already-materialized', 'path': str(candidate.resolve())}
        if candidate.exists():
            raise ValueError(f'{output} already contains a different or incomplete export; choose a fresh output directory.')
        wave = report['spatialWavevector']
        command = [sys.executable, str(Path(__file__).with_name('search.py')),
                   '--charge', str(report['charge']), '--grid', str(cfg['N']),
                   '--frames', str(args.frames), '--length', str(cfg['L']),
                   '--wavevector', *map(str, wave), '--reflected-mix', str(report.get('reflectedMix', 0)),
                   '--mix-phase', str(report.get('mixPhase', 0)),
                   '--initial', str(path.resolve()), '--feed', str(cfg['params']['F']),
                   '--kill', str(cfg['params']['k']), '--export-initial', '--output', str(output.resolve())]
        axis = report.get('instantaneousMirrorAxis')
        if axis is not None:
            command += ['--mirror-axis', str(axis)]
        with (output / 'native-export.log').open('w') as log:
            subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=150)
        if not candidate.exists():
            return {'name': path.parent.name, 'status': 'native-shooting-rejected'}
        provenance.write_text(json.dumps({'source': str(path.resolve()), 'sourceSha256': digest,
                                         'frames': args.frames, 'method': 'Independent native RK4 shooting check and unprojected full movie.'}, indent=2))
        state = json.loads(candidate.read_text())
        return {'name': path.parent.name, 'status': 'materialized', 'path': str(candidate.resolve()),
                'spatialRms': state['spatialRms'], 'temporalRms': state['temporalRms'],
                'shootingRms': state['shootingRms']}

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(materialize, reports))
    (args.output / 'materialization.json').write_text(json.dumps(results, indent=2))
    for result in results:
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
