#!/usr/bin/env python3
"""Merge the 442/632 legacy witnesses and the additional-equation records into data/wallpaper-atlas.json.

The Gray–Scott wallpaper records keep their certificates untouched. Legacy p4/p6 fields enter as
audited-subgroup witnesses of their own canonical actions (research/wallpaper/legacy_subgroups.py);
equation records enter with their own gate (research/equations/admit.py). Rebuilds the directory
index afterwards.
"""
import argparse, hashlib, json, os, subprocess, sys
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from build_catalog import encoded, sha
from audit import attach_forward_bounds
from build_cells import attach_cells
CAP = 24

def legacy_entries(subgroups, groups):
    entries = []
    for result in subgroups['results']:
        g = groups[result['groupId']]
        for hit in result['hits']:
            s = hit['source']; c = {**s['config'], 'groupId': g['id'], 'ops': g['ops']}; base = '' if hit['sourceFamily'] == 'p4' else hit['sourceFamily']
            entry = {k: s[k] for k in ['fieldSha256', 'fieldByteLength', 'fieldValueCount', 'fieldEncoding', 'ranges', 'name', 'patternName'] if k in s}
            entries.append({**entry, 'id': f"wallpaper:{g['id']}:{s['fieldSha256'][:16]}", 'groupId': g['id'], 'config': c, 'fieldUrl': hit['sourceFieldUrl'], 'metadataUrl': hit['sourceMetadataUrl'], 'thumbnails': {key: str(Path(base) / url) for key, url in s['thumbnails'].items()}, 'wallpaperVerification': hit['wallpaperVerification'], 'provenance': {'kind': 'audited-subgroup', 'sourceOrbitId': s['id'], 'sourceGroupId': s['groupId'], 'sourceMetadataUrl': hit['sourceMetadataUrl'], 'method': 'Exact original saved field of the 442/632 catalog; canonical operations and all-phase visibility independently rechecked in the wallpaper certificate format.', 'sourceOfflineVerification': s['offlineVerification'], 'finiteGridOnly': True}})
    return entries

def main():
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument('--legacy', type=Path, required=True); ap.add_argument('--equations', type=Path, action='append', default=[]); a = ap.parse_args()
    definitions = json.loads((ROOT / 'wallpaper-groups.json').read_text()); groups = {g['id']: g for g in definitions['groups']}
    catalog = json.loads((ROOT / 'data/wallpaper-atlas.json').read_text()); verifier = catalog['verificationCodeSha256']
    if hashlib.sha256(b''.join((HERE / name).read_bytes() for name in catalog['verificationSources'])).hexdigest() != verifier: raise ValueError('Gray–Scott verifier fingerprint changed; rebuild the wallpaper catalog first')
    kept = [r for r in catalog['orbits'] if r['provenance']['kind'] in ('new-shooting', 'audited-subgroup') and groups[r['groupId']]['family'] not in ('p4', 'p6')]
    legacy = legacy_entries(json.loads(a.legacy.read_text()), groups); added = []; seen = Counter()
    for r in legacy:
        if seen[(r['groupId'], r['fieldSha256'])] or sum(1 for x in added if x['groupId'] == r['groupId']) >= CAP: continue
        seen[(r['groupId'], r['fieldSha256'])] += 1; g = groups[r['groupId']]
        r['wallpaperVerification'] = attach_forward_bounds(r['wallpaperVerification'])
        if not r['wallpaperVerification']['passed']: raise ValueError('Forward target phase bound rejected ' + r['id'])
        r['classification'] = 'time-shift-orbit' if g['hasTimeShift'] else 'zero-offset-reference'; r['lattice'] = g['lattice']; r['family'] = g['family']
        r['offlineVerification'] = {'gateVersion': 'wallpaper-offline-v1', 'passed': True, 'fieldSha256': r['fieldSha256'], 'configSha256': None, 'verificationCodeSha256': verifier}
        r['diagnostics'] = {key: r['wallpaperVerification'][key] for key in ['spatialRms', 'temporalRms', 'minimum', 'maximum']}; added.append(r)
    js = "const crypto=require('crypto');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(c=>crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex')))));"
    hashes = json.loads(subprocess.run([os.environ.get('NODE', 'node'), '-e', js], input=encoded([r['config'] for r in added]), capture_output=True, check=True).stdout)
    for r, digest in zip(added, hashes): r['offlineVerification']['configSha256'] = digest
    attach_cells({'orbits': added})
    equations = []; gates = {}
    for path in a.equations:
        atlas = json.loads(path.read_text()); gates[atlas['gateVersion']] = {'verificationCodeSha256': atlas['verificationCodeSha256'], 'verificationSources': ['research/equations/' + s for s in atlas['verificationSources']]}
        for r in atlas['orbits']:
            if r['offlineVerification']['gateVersion'] != atlas['gateVersion'] or r['offlineVerification']['verificationCodeSha256'] != atlas['verificationCodeSha256']: raise ValueError('Equation record certificate mismatch ' + r['id'])
            equations.append(r)
    orbits = kept + added + equations; ids = [r['id'] for r in orbits]
    if len(set(ids)) != len(ids): raise ValueError('Duplicate record ids after merge')
    counts = Counter(r['groupId'] for r in orbits); results = [row for row in catalog['searchResults'] if groups[row['groupId']]['family'] not in ('p4', 'p6')]
    legacy_by_group = {res['groupId']: res for res in json.loads(a.legacy.read_text())['results']}
    for g in definitions['groups']:
        if g['family'] in ('p4', 'p6'):
            results.append({'groupId': g['id'], 'family': g['family'], 'attempts': 0, 'outcomes': {}, 'auditedExistingFields': legacy_by_group[g['id']]['tested'], 'admitted': sum(1 for r in added if r['groupId'] == g['id']), 'newShootingPatterns': 0, 'status': 'zero-offset-reference' if not g['hasTimeShift'] else 'verified', 'reason': None, 'source': 'The 442 and 632 catalogs, re-audited against the canonical wallpaper actions.'})
    results.sort(key=lambda row: int(row['groupId'][1:]))
    equation_counts = Counter((r['config'].get('model', 'gray-scott'), r['groupId']) for r in orbits)
    catalog.update(orbits=orbits, searchResults=results, equationGates=gates, models={'gray-scott': 'Gray–Scott', 'ginzburg-landau': 'complex Ginzburg–Landau', 'brusselator': 'Brusselator'}, scope='Saved finite-grid periodic orbits with prescribed affine time-shift actions. Gray–Scott records carry the wallpaper certificate (new shooting results, audited subgroup witnesses and the re-audited 442/632 catalogs); Ginzburg–Landau and Brusselator records carry the equation certificate. Zero-offset reference rows are not described as time-shift examples.')
    (ROOT / 'data/wallpaper-atlas.json').write_bytes(encoded(catalog))
    print(json.dumps({'gray-scott-kept': len(kept), 'legacy-added': len(added), 'equations': len(equations), 'total': len(orbits), 'byModel': {m: sum(v for (mm, _), v in equation_counts.items() if mm == m) for m in ['gray-scott', 'ginzburg-landau', 'brusselator']}, 'groupsPopulated': len(counts)}))
    subprocess.run([sys.executable, str(HERE / 'build_index.py')], check=True, stdout=subprocess.DEVNULL)

if __name__ == '__main__': main()
