#!/usr/bin/env python3
"""Materialize admitted periodic orbits of the additional equations into the site's data layout.

Reads the bounded Modal batch outputs (result.json per job), selects the distinct admitted
candidates per group and model, regenerates each movie from the saved coarse state (analytic
phase rotation for Ginzburg–Landau relative equilibria; unprojected RK4 integration over one
period for the Brusselator), exports the Float32 movie, then independently re-admits the
exported bytes with admit.py, renders thumbnails and attaches checked repeat cells.
Writes data/equation-orbits/* and data/equation-atlas.json (merged into the wallpaper atlas by
../wallpaper/merge_atlas.py).
"""
import argparse, concurrent.futures, hashlib, json, math, os, subprocess, sys
from collections import defaultdict
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent / 'wallpaper'))
from rdlab import load_groups, flow, timestep, resample_complex, Character, cgl_polish, rpo_polish, space_time_project
from admit import certify, verifier_fingerprint, GATE
from build_catalog import thumbnail, encoded, sha
MODEL_NAMES = {'ginzburg-landau': 'Ginzburg–Landau', 'brusselator': 'Brusselator'}
PATTERN_NAMES = {'ginzburg-landau': 'Phase-rotating spiral lattice', 'brusselator': 'Oscillatory spiral lattice'}
STORE_M = 48
STORE_M_SHORT = 32   # orders 1, 2 and 4: fewer saved frames keep the published site under GitHub Pages' size limit
SPARE = 2   # extra candidates prepared per entry and equation, used when a preferred one fails re-admission
MAX_PERIOD = 2500.0   # keeps the independent re-integration affordable; longer phase-rotation periods are only slower versions of the same spirals

def frames_for(group):
    return STORE_M_SHORT if STORE_M_SHORT % group['frameMultiple'] == 0 else STORE_M

def candidates(batches):
    rows = []
    for batch in batches:
        summary = json.loads((batch / 'batch.json').read_text())
        for row in summary['results']:
            folder = batch / row['id']; path = folder / 'result.json'
            if not path.exists(): continue
            r = json.loads(path.read_text()); ref = r.get('refined') or {}
            if r.get('outcome') != 'candidate' or not ref.get('audit', {}).get('passed') or not (folder / 'coarse.f32').exists(): continue
            passing = [s for s in r['stages'] if s.get('audit', {}).get('passed')]
            rows.append(dict(result=r, folder=folder, batch=batch.name, model=r.get('model', 'ginzburg-landau'), groupId=r['groupId'], visibility=passing[-1].get('visibilityMin') if passing else None, omega=r['coarse'].get('omega'), period=r['coarse'].get('period') or r['coarse'].get('T'), refined=ref))
    return rows

def select(rows, cap):
    chosen = defaultdict(list)
    for row in sorted(rows, key=lambda x: -(x['visibility'] or 0)):
        if not row['period'] or row['period'] > MAX_PERIOD: continue
        key = (row['groupId'], row['model']); seen = chosen[key]
        if len(seen) >= cap.get(row['model'], 2) + SPARE: continue
        params = json.dumps(row['result']['params'], sort_keys=True) + str(row['result']['L'])
        if any(abs(math.log(row['period'] / s['period'])) < 2e-3 and json.dumps(s['result']['params'], sort_keys=True) + str(s['result']['L']) == params for s in seen): continue
        if any(abs(math.log(row['period'] / s['period'])) < 2e-4 for s in seen): continue
        seen.append(row)
    return [row for rows_ in chosen.values() for row in rows_]

def movie_for(row, group):
    r = row['result']; model = row['model']; N = r['N']; L = r['L']; p = dict(r['params']); h = L / N; lattice = group['lattice']
    coarse = np.frombuffer((row['folder'] / 'coarse.f32').read_bytes(), dtype='<f4').reshape(2, N, N).astype(float)
    if model == 'ginzburg-landau':
        B = coarse[0] + 1j * coarse[1]; ch = Character(group, N); omega = r['coarse']['omega']
        pol = cgl_polish(B, omega, ch, p, lattice, h, sign=r['coarse']['sign']); B, omega = pol['B'], pol['omega']
        T = 2 * np.pi / abs(omega); M = frames_for(group); frames = [np.stack([(B * np.exp(1j * omega * T * j / M)).real, (B * np.exp(1j * omega * T * j / M)).imag]) for j in range(M)]
        return space_time_project(np.array(frames), ch), float(T), dict(omega=float(omega), sign=r['coarse']['sign'], polishResidual=pol['residual'])
    ch = Character(group, N); T = r['coarse']['period']
    pol = rpo_polish(model, coarse, T, p, lattice, h, ch, maxiter=40); q, T = pol['q'], pol['T']; frames = []; s = q.copy(); M = frames_for(group)
    for j in range(M): frames.append(s.copy()); s = flow(model, s, T / M, p, lattice, h)
    return space_time_project(np.array(frames), ch), float(T), dict(polishResidual=pol['residual'])

def prepare(arg):
    """Regenerate one movie, export it and re-admit the exported bytes (runs in a worker)."""
    row, g = arg; r = row['result']; N = r['N']; L = r['L']; h = L / N
    movie, T, extra = movie_for(row, g)
    M = movie.shape[0]; config = dict(N=N, M=M, L=L, period=T, groupId=g['id'], model=row['model'], params={**r['params'], 'dx': h, 'stencil': 'triangular-six' if g['lattice'] == 'triangular' else 'five-point'}, ops=g['ops'])
    payload = movie.astype('<f4').tobytes(); field = np.frombuffer(payload, dtype='<f4').reshape(M, 2, N, N)
    return movie, T, extra, certify(field, config, g), config, payload

def main():
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument('--batch', action='append', type=Path, required=True); ap.add_argument('--cap-cgl', type=int, default=2); ap.add_argument('--cap-brusselator', type=int, default=2); ap.add_argument('--output', type=Path, default=ROOT / 'data/equation-atlas.json'); a = ap.parse_args()
    data, groups = load_groups(ROOT / 'wallpaper-groups.json'); outdir = ROOT / 'data/equation-orbits'; outdir.mkdir(exist_ok=True)
    rows = candidates(a.batch); chosen = select(rows, {'ginzburg-landau': a.cap_cgl, 'brusselator': a.cap_brusselator}); verifier = verifier_fingerprint(); orbits = []; rejected = []
    print(json.dumps({'candidates': len(rows), 'selected': len(chosen)}), flush=True)
    ordered = sorted(chosen, key=lambda x: (x['model'], int(x['groupId'][1:])))
    with concurrent.futures.ProcessPoolExecutor(max_workers=int(os.environ.get('WORKERS', '6'))) as pool:
        prepared = list(pool.map(prepare, [(row, groups[row['groupId']]) for row in ordered]))
    admitted_per_key = Counter = __import__('collections').Counter()
    for row, (movie, T, extra, proof, config, payload) in zip(ordered, prepared):
        g = groups[row['groupId']]; r = row['result']; N = r['N']; L = r['L']; h = L / N; key = (row['groupId'], row['model'])
        if admitted_per_key[key] >= {'ginzburg-landau': a.cap_cgl, 'brusselator': a.cap_brusselator}.get(row['model'], 2): continue
        field = np.frombuffer(payload, dtype='<f4').reshape(config['M'], 2, N, N)
        if not proof['passed']:
            rejected.append(dict(id=r['id'], model=row['model'], phaseRelations={k: v for k, v in proof.get('phaseRelations', {}).items() if k != 'operations'}, visibilityPassed=proof.get('visibility', {}).get('passed'), temporalResolution=proof.get('temporalResolution', {}).get('passed'), spatialRms=proof.get('spatialRms'), temporalRms=proof.get('temporalRms'), minimum=proof.get('minimum'), maximum=proof.get('maximum'), dynamics=proof.get('independentDynamics'))); print('rejected', r['id'], flush=True); continue
        digest = sha(payload); relative = f'data/equation-orbits/{digest[:20]}.f32'; (ROOT / relative).write_bytes(payload)
        thumbs = {}
        for palette in ['ember', 'ceramic', 'concentration']:
            thumb = f'data/equation-orbits/{digest[:20]}-{palette}.png'; thumbnail(field.astype(float), ROOT / thumb, g['lattice'], palette); thumbs[palette] = thumb
        provenance = dict(kind='equation-search', model=row['model'], method={'ginzburg-landau': 'Symmetry-projected forward integration inside the invariant character subspace, then Newton–Krylov on the relative-equilibrium equation; the movie is the exact phase rotation of the converged state.', 'brusselator': 'Newton–Krylov twisted shooting on the unprojected Brusselator flow, seeded from a matched Ginzburg–Landau spiral lattice; the movie is one independent RK4 period.'}[row['model']], searchJob={k: v for k, v in r.items() if k in ('id', 'params', 'L', 'N', 'M', 'seed')}, batch=row['batch'], refinement=dict(refinedN=row['refined']['N'], relativePeriodChange=row['refined']['periodChange'], refinedResidual=row['refined'].get('residual')), **extra, finiteGridOnly=True)
        metadata = f"data/equation-orbits/{g['id']}-{row['model']}-{digest[:20]}.json"
        (ROOT / metadata).write_bytes(encoded(dict(schema='equation-orbit-binary-v1', model=row['model'], groupId=g['id'], family=g['family'], lattice=g['lattice'], config=config, fieldUrl=f'{digest[:20]}.f32', fieldEncoding='float32-le', fieldSha256=digest, fieldByteLength=len(payload), fieldValueCount=len(payload) // 4, fieldLayout='frame-major; planar channel 0 then channel 1; x-fast; lattice nodes i/N,j/N', period=T, independentlyVerified=True, wallpaperVerification=proof, provenance=provenance)))
        orbits.append(dict(id=f"equation:{row['model']}:{g['id']}:{digest[:16]}", groupId=g['id'], config=config, fieldUrl=relative, metadataUrl=metadata, fieldSha256=digest, fieldByteLength=len(payload), fieldValueCount=len(payload) // 4, fieldEncoding='float32-le', ranges={'u': [float(field[:, 0].min()), float(field[:, 0].max())], 'v': [float(field[:, 1].min()), float(field[:, 1].max())]}, thumbnails=thumbs, name=PATTERN_NAMES[row['model']], patternName=PATTERN_NAMES[row['model']], wallpaperVerification=proof, provenance=provenance, classification='time-shift-orbit' if g['hasTimeShift'] else 'zero-offset-reference', lattice=g['lattice'], family=g['family'], offlineVerification=dict(gateVersion=GATE, passed=True, fieldSha256=digest, configSha256=None, verificationCodeSha256=verifier), diagnostics={k: proof[k] for k in ['spatialRms', 'temporalRms', 'minimum', 'maximum']}))
        admitted_per_key[key] += 1; print('admitted', r['id'], 'T %.3f' % T, 'N', N, flush=True)
    js = "const crypto=require('crypto');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(c=>crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex')))));"
    hashes = json.loads(subprocess.run([os.environ.get('NODE', 'node'), '-e', js], input=encoded([o['config'] for o in orbits]), capture_output=True, check=True).stdout)
    for o, digest in zip(orbits, hashes): o['offlineVerification']['configSha256'] = digest
    sys.path.insert(0, str(HERE.parent / 'wallpaper')); from build_cells import attach_cells
    manifest = attach_cells({'orbits': orbits})
    referenced = {o['metadataUrl'] for o in orbits} | {o['fieldUrl'] for o in orbits} | {t for o in orbits for t in o['thumbnails'].values()}
    for path in outdir.iterdir():
        if str(path.relative_to(ROOT)) not in referenced: path.unlink()
    a.output.write_bytes(encoded({'schema': 'scott-gray-equation-atlas-v1', 'gateVersion': GATE, 'verificationCodeSha256': verifier, 'verificationSources': ['rdlab.py', 'admit.py'], 'scope': 'Saved finite-grid periodic orbits of the complex Ginzburg–Landau and Brusselator equations with the same affine time-shift actions as the Gray–Scott catalog; every record was re-admitted from its exported bytes.', 'orbits': manifest['orbits'], 'rejected': rejected}))
    print(json.dumps({'orbits': len(orbits), 'rejected': len(rejected), 'bytes': sum(o['fieldByteLength'] for o in orbits)}))

if __name__ == '__main__': main()
