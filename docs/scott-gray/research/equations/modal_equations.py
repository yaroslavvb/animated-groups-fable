"""Bounded Modal CPU fan-out of Ginzburg–Landau relative-equilibrium searches.

No retries, schedules, endpoints or GPUs. Hard limits: 256 jobs per batch, 24 concurrent
containers, two physical cores and 8 GiB per container, 420-second task, 120-second startup.
Dry run is the default; --launch is required to spend anything. Every result is an unaudited
candidate until the repository's saved-byte audit admits it.
"""
import json, math, re, time
from pathlib import Path
import modal
HERE = Path(__file__).resolve().parent
MAX_JOBS = 256; MAX_CONTAINERS = 24; TASK_SECONDS = 420; STARTUP_SECONDS = 120
RATE = 2 * .0000131 + 8 * .00000222   # USD per container-second: 2 physical cores + 8 GiB, modal.com/pricing (checked 2026-09-05)
app = modal.App('rdlab-equation-search')
image = (modal.Image.debian_slim(python_version='3.12').pip_install('numpy==2.2.6', 'scipy==1.15.3')
         .add_local_file(HERE / 'rdlab.py', '/root/rdlab/rdlab.py')
         .add_local_file(HERE.parent.parent / 'wallpaper-groups.json', '/root/rdlab/wallpaper-groups.json'))

def validate(job):
    allowed = {'id', 'groupId', 'N', 'refineN', 'L', 'alpha', 'beta', 'D', 'seed', 'totalTime', 'M', 'amplitude', 'model', 'a', 'b', 'Du', 'Dv', 'seedAmplitude', 'seedBeta'}
    if not isinstance(job, dict) or set(job) - allowed: raise ValueError('Undocumented job arguments')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,90}', job['id']): raise ValueError('Unsafe identifier')
    if not re.fullmatch(r'g[0-9]+', job['groupId']): raise ValueError('Unsafe group identifier')
    for name, low, high in [('N', 12, 48), ('refineN', 12, 64), ('seed', 0, 10 ** 6), ('M', 12, 192)]:
        if name in job and (type(job[name]) != int or not low <= job[name] <= high): raise ValueError('Bounded ' + name)
    if job.get('model', 'ginzburg-landau') not in ('ginzburg-landau', 'brusselator'): raise ValueError('Unknown model')
    for name, low, high in [('L', 8, 200), ('alpha', -3, 3), ('beta', -3, 3), ('D', .1, 10), ('totalTime', 50, 3000), ('amplitude', .01, 2), ('a', .1, 5), ('b', .1, 30), ('Du', .01, 10), ('Dv', .01, 10), ('seedAmplitude', .01, 2), ('seedBeta', -1, 1)]:
        if name in job and (not isinstance(job[name], (int, float)) or not math.isfinite(job[name]) or not low <= job[name] <= high): raise ValueError('Bounded ' + name)
    return job


def run_brusselator(job, g, start):
    import numpy as np
    from rdlab import Character, cgl_relative_equilibrium, cgl_polish, cgl_movie, audit, uniform_equilibrium, seed_from_complex, rpo_polish, flow, resample_complex
    p = dict(a=float(job['a']), b=float(job['b']), Du=float(job.get('Du', 1.0)), Dv=float(job.get('Dv', 1.0))); L = float(job['L']); N = int(job['N']); M = int(job.get('M', 96)); h = L / N
    out = dict(id=job['id'], model='brusselator', groupId=g['id'], family=g['family'], params=p, L=L, N=N, M=M, seed=job.get('seed', 0), stages=[])
    mu = p['b'] - 1 - p['a'] ** 2
    if mu <= 0: raise ValueError('Brusselator uniform state must be Hopf-unstable (b > 1 + a^2)')
    Lc = L * np.sqrt(2 * mu / max(p['Du'], p['Dv'])); pc = dict(alpha=0.0, beta=float(job.get('seedBeta', 0.11)), D=2.0)
    q0 = uniform_equilibrium('brusselator', p, [p['a'], p['b'] / p['a']]); best = None
    for sign in (1, -1):
        r = cgl_relative_equilibrium(g, N, Lc, pc, seed=int(job.get('seed', 0)), sign=sign, lattice=g['lattice'], total_time=600, report_every=50, tol=1e-9)
        pol = cgl_polish(r['B'], r['omega'], r['character'], pc, g['lattice'], Lc / N, sign=sign)
        movie, T = cgl_movie(pol['B'], pol['omega'], 48); a = audit('ginzburg-landau', movie, pc, g, Lc, T, g['lattice'], dynamics=False)
        out['stages'].append(dict(stage='cgl-seed', sign=sign, residual=pol['residual'], omega=pol['omega'], structural=a['structuralPassed'], symmetryMax=a['symmetryMax']))
        if a['structuralPassed'] and pol['residual'] < 1e-8: best = (sign, pol['B']); break
    if best is None: out['outcome'] = 'failed'; return out
    sign, B = best; ch = Character(g, N)
    for amp in [float(job.get('seedAmplitude', .25)), 2 * float(job.get('seedAmplitude', .25))]:
        seed, w = seed_from_complex('brusselator', p, q0, B, amplitude=amp); T0 = 2 * np.pi / w
        pol = rpo_polish('brusselator', seed, T0, p, g['lattice'], h, ch, maxiter=60)
        stage = dict(stage='newton', amplitude=amp, T=pol['T'], residual=pol['residual'], success=pol['success'])
        if pol['residual'] < 1e-8:
            q = pol['q']; movie = []; s = q.copy()
            for j in range(M): movie.append(s.copy()); s = flow('brusselator', s, pol['T'] / M, p, g['lattice'], h)
            movie = np.array(movie); a = audit('brusselator', movie, p, g, L, pol['T'], g['lattice'])
            stage.update(audit={k: v for k, v in a.items() if k != 'visibility'}, visibilityPassed=a['visibility']['passed'], visibilityMin=min([min(o['minimumRelativeRangeByChannel']) for o in a['visibility']['operations']] or [None]) if a['visibility']['operations'] else None)
            out['stages'].append(stage)
            if a['passed']:
                out['coarse'] = dict(T=pol['T'], period=pol['T'], B=movie[0].astype('<f4').tobytes())
                refineN = int(job.get('refineN', 0))
                if refineN and refineN > N and refineN % g['meshMultiple'] == 0:
                    ch2 = Character(g, refineN); h2 = L / refineN
                    q2 = np.stack([resample_complex(q[c].astype(complex), refineN).real for c in range(2)])
                    pol2 = rpo_polish('brusselator', q2, pol['T'], p, g['lattice'], h2, ch2, maxiter=60)
                    movie2 = []; s = pol2['q'].copy()
                    for j in range(M): movie2.append(s.copy()); s = flow('brusselator', s, pol2['T'] / M, p, g['lattice'], h2)
                    movie2 = np.array(movie2); a2 = audit('brusselator', movie2, p, g, L, pol2['T'], g['lattice'], dynamics=pol2['residual'] < 1e-8)
                    out['refined'] = dict(N=refineN, period=pol2['T'], residual=pol2['residual'], success=pol2['success'], audit={k: v for k, v in a2.items() if k != 'visibility'}, visibilityPassed=a2['visibility']['passed'], periodChange=abs(pol2['T'] - pol['T']) / pol['T'], B=movie2[0].astype('<f4').tobytes() if a2['passed'] else None)
                out['outcome'] = 'candidate'; return out
        else: out['stages'].append(stage)
    out['outcome'] = 'failed'; return out

def run(job):
    import sys, numpy as np
    sys.path.insert(0, '/root/rdlab'); sys.path.insert(0, str(HERE))
    from rdlab import load_groups, cgl_search, cgl_polish, cgl_movie, audit, resample_complex, Character
    path = '/root/rdlab/wallpaper-groups.json' if Path('/root/rdlab/wallpaper-groups.json').exists() else str(HERE.parent.parent / 'wallpaper-groups.json')
    data, groups = load_groups(path); g = groups[job['groupId']]; start = time.monotonic()
    if job.get('model') == 'brusselator':
        try: out = run_brusselator(job, g, start)
        except Exception as error: out = dict(id=job['id'], model='brusselator', groupId=g['id'], family=g['family'], outcome='error', error=repr(error), stages=[])
        out['elapsedSeconds'] = time.monotonic() - start; return out
    p = dict(alpha=float(job['alpha']), beta=float(job['beta']), D=float(job.get('D', 2.0))); L = float(job['L']); N = int(job['N']); M = int(job.get('M', 96))
    out = dict(id=job['id'], groupId=g['id'], family=g['family'], params=p, L=L, N=N, M=M, seed=job.get('seed', 0), stages=[])
    try:
        res = cgl_search(g, N, L, p, seed=int(job.get('seed', 0)), lattice=g['lattice'], total_time=float(job.get('totalTime', 800)), M=M, amplitude=float(job.get('amplitude', .5)))
        best = None
        for r in res:
            out['stages'].append({k: v for k, v in r.items() if k != 'B'})
            if r['audit']['passed']: best = r
        if best is not None:
            out['coarse'] = dict(sign=best['sign'], omega=best['omega'], period=best['period'], B=np.stack([best['B'].real, best['B'].imag]).astype('<f4').tobytes())
            refineN = int(job.get('refineN', 0))
            if refineN and refineN > N and refineN % g['meshMultiple'] == 0:
                B2 = resample_complex(best['B'], refineN); ch2 = Character(g, refineN); h2 = L / refineN
                pol = cgl_polish(ch2.project_complex(B2, best['sign']), best['omega'], ch2, p, g['lattice'], h2, sign=best['sign'])
                movie, T = cgl_movie(pol['B'], pol['omega'], M); a = audit('ginzburg-landau', movie, p, g, L, T, g['lattice'], dynamics=pol['residual'] < 1e-6)
                out['refined'] = dict(N=refineN, sign=best['sign'], omega=pol['omega'], period=T, residual=pol['residual'], success=pol['success'], audit={k: v for k, v in a.items() if k != 'visibility'}, visibilityPassed=a['visibility']['passed'], periodChange=abs(T - best['period']) / best['period'], B=np.stack([pol['B'].real, pol['B'].imag]).astype('<f4').tobytes() if a['passed'] else None)
        out['outcome'] = 'candidate' if best is not None else 'failed'
    except Exception as error:
        out['outcome'] = 'error'; out['error'] = repr(error)
    out['elapsedSeconds'] = time.monotonic() - start; return out

@app.function(image=image, cpu=(2, 2), memory=(4096, 8192), max_containers=MAX_CONTAINERS, min_containers=0, buffer_containers=0, scaledown_window=10, retries=0, timeout=TASK_SECONDS, startup_timeout=STARTUP_SECONDS)
def run_job(job):
    return run(validate(job))

def save(destination, job, result):
    folder = destination / job['id']; folder.mkdir(exist_ok=True)
    for key in ('coarse', 'refined'):
        block = result.get(key)
        if block and block.get('B'):
            (folder / f'{key}.f32').write_bytes(block.pop('B')); block['fieldUrl'] = f'{key}.f32'
        elif block: block.pop('B', None)
    (folder / 'result.json').write_text(json.dumps(result, indent=1))

@app.local_entrypoint()
def main(jobs: str, output: str, launch: bool = False, local: bool = False):
    settings = [validate(j) for j in json.loads(Path(jobs).read_text())]; count = len(settings)
    if not 1 <= count <= MAX_JOBS or len({j['id'] for j in settings}) != count: raise ValueError('Job cap or duplicate ids')
    bound = count * (TASK_SECONDS + STARTUP_SECONDS + 10) * RATE + 3
    budget = {'maximumJobs': count, 'maxContainers': MAX_CONTAINERS, 'physicalCoresPerContainer': 2, 'memoryGiBHardLimit': 8, 'executionSeconds': TASK_SECONDS, 'startupSeconds': STARTUP_SECONDS, 'retries': 0, 'gpu': None, 'pricingURL': 'https://modal.com/pricing', 'resourceUSDPerSecond': RATE, 'reservedUSDIncludingThreeDollarBuildReserve': bound}
    print(json.dumps({'launch': launch, 'local': local, 'budget': budget}), flush=True)
    if bound > 12: raise ValueError('Batch resource bound exceeds the $12 per-batch reservation')
    destination = Path(output)
    if local:
        destination.mkdir(parents=True, exist_ok=True)
        for job in settings: result = run(job); save(destination, job, result); print(json.dumps({k: v for k, v in result.items() if k not in ('stages', 'coarse', 'refined')}), flush=True)
        return
    if not launch: return
    destination.mkdir(parents=True, exist_ok=False); summary = {'schema': 'rdlab-cgl-batch-v1', 'budget': budget, 'results': []}
    (destination / 'batch.json').write_text(json.dumps(summary, indent=1))
    for index, result in enumerate(run_job.map(settings, return_exceptions=True, order_outputs=True)):
        job = settings[index]
        if isinstance(result, Exception): result = {'id': job['id'], 'outcome': 'function-error', 'error': str(result)}
        save(destination, job, result); summary['results'].append({k: v for k, v in result.items() if k not in ('stages', 'coarse', 'refined')}); (destination / 'batch.json').write_text(json.dumps(summary, indent=1)); print(json.dumps(summary['results'][-1]), flush=True)
