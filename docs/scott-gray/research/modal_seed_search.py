"""Bounded independent spatial-mode searches, at most two A100s concurrently."""
from pathlib import Path
import math,array
import modal
from modal_continuation import image
HERE=Path(__file__).resolve().parent
app=modal.App('scott-gray-higher-mode-search')
worker_image=image.add_local_file(HERE/'modal_continuation.py','/root/modal_continuation.py')

@app.function(image=worker_image,gpu='A100-40GB',cpu=(2,2),memory=(8192,16384),max_containers=2,min_containers=0,retries=0,timeout=600,startup_timeout=600,scaledown_window=2)
def search(seed,target):
    from modal_continuation import continue_branches
    return continue_branches.local([seed],[target])

def analytic_seed(mode,F,k,family,amplitude,template):
    """Analytic homogeneous-Hopf perturbation; output is a seed, not a solution."""
    if mode not in (1,2,3,4,5) or not 0 < amplitude <= .08:
        raise ValueError('Use spatial mode 1–5 and 0 < amplitude ≤ 0.08.')
    if family=='rotating' and mode%2==0:
        raise ValueError('Even rotating modes need a different mirror kernel.')
    N=48;L=256;du=.16;dv=.08
    disc=1-4*(F+k)**2/F
    if disc <= 0:raise ValueError('No nontrivial homogeneous seed at these parameters.')
    u=(1-math.sqrt(disc))/2;v=F*(1-u)/(F+k)
    lap=(2*math.cos(2*math.pi*mode/N)-2)/(L/N)**2
    a=-v*v-F+du*lap;b=-2*u*v;c=v*v;d=2*u*v-F-k+dv*lap
    growth=(a+d)/2;omega2=a*d-b*c-growth*growth
    if omega2 <= 0:raise ValueError('This spatial mode has no oscillatory eigenvector.')
    omega=math.sqrt(omega2);ratio=complex(growth-a,omega)/b;T=2*math.pi/omega*1.03
    psi=[complex(math.sin(2*math.pi*mode*x/N),-math.sin(2*math.pi*mode*y/N))
         if family=='rotating' else complex(math.cos(2*math.pi*mode*x/N)-math.cos(2*math.pi*mode*y/N))
         for y in range(N) for x in range(N)]
    values=array.array('d',[u+amplitude*z.real for z in psi]+[v+amplitude*(ratio*z).real for z in psi])
    import sys
    if sys.byteorder!='little':values.byteswap()
    config={**template,'groupId':'g96' if family=='rotating' else 'g95','N':N,'M':128,'period':T,
            'params':{**template['params'],'Du':du,'Dv':dv,'F':F,'k':k,'dx':L/N}}
    return {'family':family,'config':config,'initial':values.tobytes()}

@app.local_entrypoint()
def main(output_dir: str='higher-mode-results', seed_dir: str=str(HERE.parent/'data'/'orbits'),
         family: str='standing', modes: str='2,3', feeds: str='.004,.00395', amplitudes: str='.055,.045', kill: float=.02):
    from modal_io import load_saved_seed,write_results,validate_targets,parse_families
    if len(parse_families(family))!=1:raise ValueError('Choose one family per seed-search run.')
    parsed_modes=[int(x) for x in modes.split(',')];parsed_feeds=[float(x) for x in feeds.split(',')]
    parsed_amplitudes=[float(x) for x in amplitudes.split(',')]
    if not 1 <= len(parsed_modes) <= 2 or not len(parsed_modes)==len(parsed_feeds)==len(parsed_amplitudes):
        raise ValueError('Supply one or two matching modes, feeds and amplitudes.')
    validate_targets([{'F':F,'k':kill} for F in parsed_feeds])
    template=load_saved_seed(seed_dir,'g95' if family=='standing' else 'g96',family)['config']
    # Build and validate every seed before the first paid invocation.
    seeds=[analytic_seed(mode,F,kill,family,amp,template)
           for mode,F,amp in zip(parsed_modes,parsed_feeds,parsed_amplitudes)]
    jobs=[(mode,search.spawn(seed,{'F':F,'k':kill})) for mode,F,seed in zip(parsed_modes,parsed_feeds,seeds)]
    out=Path(output_dir);out.mkdir(parents=True,exist_ok=True)
    for mode,call in jobs:
        result=call.get();folder=out/f'mode-{mode}';folder.mkdir(exist_ok=True)
        for record in result['records']:record['report']['spatialMode']=mode
        print('Saved mode',mode,write_results(result,folder),'movies to',folder)
