#!/usr/bin/env python3
"""Audit the p4 (442) and p6 (632) precomputed fields against their own canonical actions,
in the wallpaper-atlas certificate format, so all 17 families can share one catalog.
Same admission logic as research/wallpaper/audit_subgroups.py (inherited dynamics, full
structural recheck), with a per-group cap of 24 hits. Does not modify audit.py."""
import json, hashlib, sys, os, subprocess, concurrent.futures
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE))
from audit import symmetry, audit
ROOT = HERE.parent.parent
CAP = 24

def worker(arg):
    group, sources = arg; hits = []; tested = 0
    for source, base in sources:
        c = source['config']; N, M = c['N'], c['M']
        if N % group['meshMultiple'] or M % group['frameMultiple']: continue
        path = ROOT / base / source['fieldUrl']; payload = path.read_bytes()
        if hashlib.sha256(payload).hexdigest() != source['fieldSha256'] or source['offlineVerification']['fieldSha256'] != source['fieldSha256']: raise ValueError('Source hash/certificate mismatch')
        field = np.frombuffer(payload, dtype='<f4').reshape(M, 2, N, N).astype(float); tested += 1
        if not symmetry(field, group['ops'], quick=True)['passed']: continue
        inherited = {'passed': source['offlineVerification']['passed'], 'method': 'Previously independently integrated exact saved Float32 bytes; source certificate retained without change.', 'sourceOfflineVerification': source['offlineVerification'], 'sourceDiagnostics': source['diagnostics']}
        result = audit(field, c, group, dynamics=inherited)
        if result['passed']:
            hits.append({'sourceId': source['id'], 'sourceFamily': base or 'p4', 'sourceFieldUrl': str(Path(base) / source['fieldUrl']), 'sourceMetadataUrl': str(Path(base) / source['metadataUrl']), 'source': source, 'wallpaperVerification': result})
            if len(hits) >= CAP: break
    return {'groupId': group['id'], 'family': group['family'], 'tested': tested, 'hits': hits}

if __name__ == '__main__':
    subprocess.run([os.environ.get('NODE', 'node'), str(HERE / 'check_source_certificates.mjs')], check=True)
    groups = json.loads((ROOT / 'wallpaper-groups.json').read_text())['groups']; jobs = []
    for family, base in [('p4', ''), ('p6', 'p6')]:
        rows = json.loads((ROOT / base / 'data/precomputed-atlas.json').read_text())['orbits']
        # keep the legacy page's ordering: the atlas order is the order visitors saw
        for g in groups:
            if g['family'] == family: jobs.append((g, [(r, base) for r in rows if r['groupId'] == g['id']] + [(r, base) for r in rows if r['groupId'] != g['id']]))
    out = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=6) as pool:
        for result in pool.map(worker, jobs):
            out.append(result); print(result['groupId'], result['tested'], len(result['hits']), flush=True)
            Path(sys.argv[1]).write_text(json.dumps({'schema': 'wallpaper-subgroup-audit-v1', 'results': out}, separators=(',', ':')))
