"""Record stopped search apps and a conservative task-wide resource estimate.

Input is `modal app list --json`, plus the checked-in P4 run ledger. This reads
only an already obtained snapshot; it never starts cloud work or queries bills.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NAMES = {
    'scott-gray-p4-diversity': 'p4-gpu',
    'scott-gray-p6-diversity-refinement': 'p6-gpu',
    'scott-gray-p6-diversity-cpu': 'p6-cpu',
}
CPU_CONTAINERS = {
    'ap-OFUMmrwVQ0ffSS2Tn0mhTW': 8,
    'ap-OjRMqH8CxJPd1C4yxUjpjU': 8,
    'ap-9k5RFQ7LK226QqNjNpwFsM': 32,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    p4 = json.loads((ROOT/'diversity_p4_ledger.json').read_text())
    p4_runs = {r['appId']: r for r in p4['runs']}
    p6_runs = {r['appId'] for r in json.loads((ROOT/'p6/search-grid-gpu.json').read_text())['runs']}
    previous = json.loads((ROOT/'compute-ledger.json').read_text())
    previous_cost = sum(float(r.get('providerReportedCostUSD', 0)) for r in previous['runs'])
    rows = []
    for app in snapshot:
        family = NAMES.get(app.get('description'))
        if not family:
            continue
        if app['state'] != 'stopped' or int(app['tasks']) != 0 or not app.get('stopped_at'):
            raise ValueError('Finish and stop every task search app before recording the final ledger.')
        if family == 'p4-gpu':
            containers = p4_runs[app['app_id']]['maxContainers']
        elif family == 'p6-gpu':
            containers = 2
        else:
            containers = CPU_CONTAINERS[app['app_id']]
        # GPU estimate deliberately uses the higher A100-80GB price, two cores
        # and sixteen GiB for the entire app lifetime at maximum concurrency.
        rate = .00075572 if family.endswith('gpu') else 2*.0000131+8*.00000222
        duration = (datetime.fromisoformat(app['stopped_at'])-datetime.fromisoformat(app['created_at'])).total_seconds()
        if duration < 0:
            raise ValueError('Invalid app lifetime.')
        rows.append({
            'appId': app['app_id'], 'family': family, 'state': app['state'], 'activeTasks': 0,
            'createdAt': app['created_at'], 'stoppedAt': app['stopped_at'],
            'maximumConcurrentContainers': containers, 'elapsedAppSeconds': duration,
            'conservativeUSDPerContainerSecond': rate,
            'lifetimeResourceEstimateUSD': duration*containers*rate,
        })
    if not set(p4_runs).issubset({r['appId'] for r in rows}):
        raise ValueError('Snapshot omits a recorded P4 app; obtain a complete snapshot.')
    if not set(CPU_CONTAINERS).issubset({r['appId'] for r in rows}):
        raise ValueError('Snapshot omits a recorded CPU app.')
    if not p6_runs.issubset({r['appId'] for r in rows}):
        raise ValueError('Snapshot omits a recorded P6 GPU app.')
    rows.sort(key=lambda r: r['createdAt'])
    estimate = sum(r['lifetimeResourceEstimateUSD'] for r in rows)
    reserve = 10
    total = previous_cost+estimate+reserve
    if total >= 100:
        raise ValueError('Conservative task accounting exceeds the authorized budget.')
    result = {
        'schema': 'scott-gray-diversity-compute-ledger-v1',
        'checkedAtUTC': datetime.now(timezone.utc).isoformat(),
        'authorizedTaskBudgetUSD': 100,
        'searchAllocationsUSD': {'p4Gpu': 20, 'p6Gpu': 15, 'cpu': 15},
        'previousTaskProviderReportedUSD': previous_cost,
        'previousTaskLedger': 'compute-ledger.json',
        'newSearchProviderReportedUSD': None,
        'newSearchLifetimeResourceEstimateUSD': estimate,
        'additionalBuildAndAccountingReserveUSD': reserve,
        'combinedConservativeEstimateIncludingReserveUSD': total,
        'allTaskSearchAppsStopped': True,
        'pricingSource': 'https://modal.com/pricing',
        'method': 'Maximum configured concurrency times complete app lifetime times conservative resource rate. This includes idle and transfer time. An additional $10 is reserved for image builds and accounting uncertainty. It is not provider-reported billing or a Modal service spending cap.',
        'executionLimits': 'Every submitted job had bounded startup and execution time, no retries, and no persistent deployment. Unrelated user apps were left unchanged.',
        'runs': rows,
    }
    (ROOT/'diversity-compute-ledger.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({k: result[k] for k in ['newSearchLifetimeResourceEstimateUSD', 'combinedConservativeEstimateIncludingReserveUSD', 'allTaskSearchAppsStopped']}))


if __name__ == '__main__':
    main()
