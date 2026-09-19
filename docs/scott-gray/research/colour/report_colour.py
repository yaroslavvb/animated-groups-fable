#!/usr/bin/env python3
"""Summarise the colour searches: outcomes per equation and per entry, per-job cost, and
the admitted records with their Gyre / Trefoil measurements.

  python report_colour.py                 # every batch under out/
  python report_colour.py --batch first   # one batch
  python report_colour.py --records       # one line per admitted record
"""
import argparse, collections, json, statistics, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'


def load(batches=None):
    rows = []
    for folder in sorted(OUT.iterdir()):
        if not folder.is_dir() or (batches and folder.name not in batches):
            continue
        for path in sorted(folder.glob('*/result.json')):
            try:
                rows.append(json.loads(path.read_text()))
            except Exception:                                    # noqa: BLE001
                pass
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--batch', action='append')
    ap.add_argument('--records', action='store_true')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    rows = load(a.batch)
    if not rows:
        print('no results yet')
        return
    admitted = [r for r in rows if r['outcome'] == 'admitted']
    by_outcome = collections.Counter(r['outcome'] for r in rows)
    by_model = collections.defaultdict(collections.Counter)
    for r in rows:
        by_model[r['job']['model']][r['outcome']] += 1
    cost = collections.defaultdict(list)
    for r in rows:
        cost[r['job']['model']].append(r.get('seconds', 0.0))

    summary = dict(jobs=len(rows), admitted=len(admitted),
                   usableGyre=sum(1 for r in admitted if (r.get('usableGyre') or 0) > 0),
                   usableTrefoil=sum(1 for r in admitted if (r.get('usableTrefoil') or 0) > 0),
                   workerSeconds=round(sum(r.get('seconds', 0.0) for r in rows), 1),
                   outcomes=dict(by_outcome))
    if a.json:
        print(json.dumps(summary, indent=1))
        return
    print('jobs %d  admitted %d  usable-gyre %d  usable-trefoil %d  worker-seconds %.0f'
          % (summary['jobs'], summary['admitted'], summary['usableGyre'],
             summary['usableTrefoil'], summary['workerSeconds']))
    print('\noutcomes')
    for k, v in by_outcome.most_common():
        print('  %-30s %5d' % (k, v))
    print('\nper equation                jobs  admitted  median s   max s   outcomes')
    for model in sorted(by_model):
        c = by_model[model]
        n = sum(c.values())
        print('  %-24s %5d  %8d  %8.1f %7.1f   %s'
              % (model, n, c['admitted'], statistics.median(cost[model]), max(cost[model]),
                 ', '.join('%s=%d' % (k, v) for k, v in c.most_common(4))))
    print('\nper entry        jobs  admitted  usable-gyre  usable-trefoil')
    per = collections.defaultdict(lambda: [0, 0, 0, 0])
    for r in rows:
        e = per[r['job']['groupId']]
        e[0] += 1
        if r['outcome'] == 'admitted':
            e[1] += 1
            e[2] += 1 if (r.get('usableGyre') or 0) > 0 else 0
            e[3] += 1 if (r.get('usableTrefoil') or 0) > 0 else 0
    for gid in sorted(per):
        n, adm, ug, ut = per[gid]
        print('  %-8s %8d  %8d  %11d  %14d' % (gid, n, adm, ug, ut))

    if a.records:
        print('\nadmitted records')
        for r in sorted(admitted, key=lambda x: (-(x.get('usableGyre') or 0) - (x.get('usableTrefoil') or 0), x['id'])):
            import search_colour as sc
            ok_g = [q for q in r['gyre']['finalists'] if sc.usable_gyre(q)] or r['gyre']['finalists']
            best_g = min(ok_g, key=lambda q: q['boundaryDensity'], default=None)
            ok_t = [q for q in (r.get('trefoil') or []) if sc.usable_trefoil(q)] or (r.get('trefoil') or [])
            best_t = min(ok_t, key=lambda q: q['boundaryDensity'], default=None)
            print('  %-62s T=%8.3f  gyre=%d trefoil=%d  sha=%s'
                  % (r['id'], r.get('period') or 0, r.get('usableGyre') or 0,
                     r.get('usableTrefoil') or 0, (r.get('fieldSha256') or '')[:16]))
            if best_g:
                print('        gyre w=%-10s ties=%-5d balance=[%.3f %.3f] boundary=%.4f speckle=%.5f leak=%.4f'
                      % (best_g['turnShift'], best_g['ties'], best_g['balance'][0],
                         best_g['balance'][1], best_g['boundaryDensity'], best_g['speckleRate'],
                         (best_g['colourPreservingLeak'] or {}).get('agreement', 0.0)))
            if best_t:
                print('        tref ties=%-5d balance=[%.3f %.3f] boundary=%.4f speckle=%.5f cycle=%.4f entangled=%.4f swap=%.4f'
                      % (best_t['ties'], best_t['balance'][0], best_t['balance'][1],
                         best_t['boundaryDensity'], best_t['speckleRate'],
                         best_t['cycleAgreement'], best_t['entangledAgreement'],
                         best_t['bestSpatialTransposition']))


if __name__ == '__main__':
    main()
