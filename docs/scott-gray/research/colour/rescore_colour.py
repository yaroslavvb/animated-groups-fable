#!/usr/bin/env python3
"""Re-measure the Gyre and Trefoil rules on every exported candidate, at full turn-shift
resolution, and write the result back into the candidate's JSON.

Search workers score a candidate on a coarse turn-shift grid so that a job stays inside its
time box.  This pass sweeps every one of the N^2 admissible turn shifts, keeps the best few
by ties / balance / chunkiness / speckle, and runs the full colour-symmetry sweep on them,
so the catalog builder can present the precomputed combinations without recomputing anything.

  python rescore_colour.py                    # every candidate under out/
  python rescore_colour.py --batch first2 --workers 14
"""
import argparse, concurrent.futures, json, os, sys, time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rdlab_colour as rc                                                     # noqa: E402
import search_colour as sc                                                    # noqa: E402

OUT = HERE / 'out'


def rescore(path, step=1, shortlist=20, finalists=4):
    path = Path(path)
    meta = json.loads(path.with_suffix('.json').read_text())
    cfg = meta['config']
    N, M = cfg['N'], cfg['M']
    field = np.fromfile(path, dtype='<f4').reshape(M, 2, N, N)
    U = np.array(field[:, 0], dtype=float)
    _, groups = rc.load_hex_groups()
    group = groups[cfg['groupId']]
    gy = sc.score_gyre(U, step=step, shortlist=shortlist, finalists=finalists)
    tr = sc.score_trefoil(U, group)
    usable_g = [q for q in gy['finalists'] if sc.usable_gyre(q)]
    usable_t = [q for q in tr if sc.usable_trefoil(q)]
    meta['gyre'] = dict(finalists=gy['finalists'], usable=len(usable_g),
                        shortlistTop=gy['shortlist'][:6], turnShiftStep=step)
    meta['trefoil'] = tr
    meta['usableGyre'] = len(usable_g)
    meta['usableTrefoil'] = len(usable_t)
    meta['rescoredAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    path.with_suffix('.json').write_text(json.dumps(meta, indent=1, default=float))
    result = path.parent / 'result.json'
    if result.exists():
        r = json.loads(result.read_text())
        r['gyre'] = meta['gyre']
        r['trefoil'] = tr
        r['usableGyre'] = meta['usableGyre']
        r['usableTrefoil'] = meta['usableTrefoil']
        result.write_text(json.dumps(r, indent=1, default=float))
    return dict(path=str(path), groupId=cfg['groupId'], model=cfg['model'],
                usableGyre=meta['usableGyre'], usableTrefoil=meta['usableTrefoil'])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--batch', action='append')
    ap.add_argument('--workers', type=int, default=14)
    ap.add_argument('--step', type=int, default=1)
    a = ap.parse_args()
    paths = []
    for folder in sorted(OUT.iterdir()):
        if not folder.is_dir() or (a.batch and folder.name not in a.batch):
            continue
        paths += sorted(folder.glob('*/candidate.f32'))
    print('%d candidates' % len(paths), flush=True)
    if not paths:
        return
    with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers) as pool:
        for r in pool.map(rescore, [str(p) for p in paths], [a.step] * len(paths)):
            print('%-70s gyre=%d trefoil=%d' % (Path(r['path']).parent.name, r['usableGyre'],
                                                r['usableTrefoil']), flush=True)


if __name__ == '__main__':
    main()
