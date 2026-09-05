"""Persist every bounded worker outcome even when a neighboring job fails."""
import json
from pathlib import Path


def collect_results(jobs, output, emit=print):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    reports = []
    for name, call in jobs:
        folder = output / name
        folder.mkdir(parents=True, exist_ok=True)
        try:
            result = call.get()
            (folder / 'initial.f64').write_bytes(result['initial'])
            report = result['report']
        except Exception as error:
            report = {'name': name, 'converged': False, 'executionFailed': True,
                      'failureType': type(error).__name__, 'seconds': None,
                      'caveat': 'The bounded worker did not return a numerical result.'}
        (folder / 'report.json').write_text(json.dumps(report, indent=2))
        reports.append(report)
        (output / 'results.json').write_text(json.dumps(reports, indent=2))
        emit(json.dumps(report))
    return reports
