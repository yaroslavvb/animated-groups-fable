"""Bounded CPU-only Modal fan-out for the existing 632 shooting program.

Dry run (no cloud execution):
  python modal_diversity.py --jobs /tmp/jobs.json --output-dir /tmp/results
Execute only after reviewing that dry run:
  modal run modal_diversity.py --jobs /tmp/jobs.json --output-dir /tmp/results --launch

Each JSON job has a safe id and search.py argument names using underscores.
At most 64 jobs, 32 containers, 2 physical CPU cores, 8 GiB memory hard limit,
180-second subprocess limit, 240-second function/startup limits, no retries.
No GPU is allocated. Returned F64 payloads contain ONE initial state; they are
explicitly labelled seeds and must be corrected, regenerated and independently
verified before publication. This module never changes the published atlas.

With initial, feed and continuation_step, run at most 24 adaptive corrections
within one 180-second budget (60 seconds per correction). Accepted intermediate
seeds are retained. A partial continuation never gets the candidate-seed label.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import modal

HERE=Path(__file__).resolve().parent
MAX_JOBS=64
ALLOCATION_USD=15.0
TASK_SECONDS=240
STARTUP_SECONDS=240
SUBPROCESS_SECONDS=180
MAX_CONTAINERS=32
CPU_CORES=2
MEMORY_GIB_LIMIT=8
ID=re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$')
SOURCE_FILES=('search.py','gray_scott_triangular.cpp')
DEFAULTS={'grid':24,'frames':192,'mode':1,'shell':1,'amplitude':.018,'kill':.02,'length':768.,'maxfev':8000,'method':'krylov','reflected_mix':1.,'mix_phase':0.}
ALLOWED=set(DEFAULTS)|{'id','charge','wavevector','feed','predictor','initial','continuation_step'}

def source_fingerprint(root=HERE):
    return {name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in SOURCE_FILES}

def validate_job(raw,index=0):
    if not isinstance(raw,dict) or set(raw)-ALLOWED:raise ValueError('Jobs contain only documented search.py arguments.')
    job={**DEFAULTS,**raw};job['id']=str(job.get('id',f'job-{index:03d}'))
    if not ID.fullmatch(job['id']) or '..' in job['id']:raise ValueError('Use a short safe job id.')
    if type(job.get('charge')) is not int or job['charge'] not in (0,1,2,3):raise ValueError('charge must be 0, 1, 2 or 3.')
    for name,lo,hi,multiple in [('grid',6,96,6),('frames',12,384,6),('mode',1,16,1),('maxfev',100,20000,1)]:
        value=job[name]
        if type(value) is not int or not lo<=value<=hi or value%multiple:raise ValueError(f'Invalid bounded {name}.')
    if job['grid']%job['mode'] or job['grid']//job['mode']<6:raise ValueError('mode must divide grid, leaving six nodes per cell.')
    if job['shell'] not in (1,3):raise ValueError('shell must be 1 or 3.')
    if job['shell']==3 and 'wavevector' not in job and (job['grid']//job['mode'])%3:raise ValueError('Shell three requires a cell divisible by three.')
    if job['method'] not in ('hybr','krylov'):raise ValueError('Unsupported nonlinear solver.')
    for name,lo,hi in [('amplitude',1e-4,.15),('kill',1e-5,.1),('length',16.,1024.),('reflected_mix',-4.,4.),('mix_phase',-1.,1.),('feed',1e-6,.2),('continuation_step',1e-7,1e-4)]:
        if name not in job:continue
        value=job[name]
        if not isinstance(value,(int,float)) or isinstance(value,bool) or not math.isfinite(value) or not lo<=value<=hi:raise ValueError(f'Invalid bounded {name}.')
    if 'wavevector' in job:
        vector=job['wavevector'];bound=job['grid']//3
        if not isinstance(vector,(list,tuple)) or len(vector)!=2 or any(type(x) is not int or abs(x)>bound for x in vector) or not any(vector):raise ValueError('wavevector must be a nonzero resolved integer pair.')
    if 'predictor' in job and type(job['predictor']) is not bool:raise ValueError('predictor is boolean.')
    if 'initial' in job and not isinstance(job['initial'],str):raise ValueError('initial is a local metadata path.')
    if 'continuation_step' in job and (not job.get('initial') or 'feed' not in job):raise ValueError('Adaptive continuation requires an initial seed and target feed.')
    return job

def make_argv(job,output,initial=None,python='python'):
    argv=[python,'/root/p6/search.py','--output',str(output)]
    for name,value in job.items():
        if name in ('id','initial','continuation_step'):continue
        if name=='predictor':
            if value:argv.append('--predictor')
        else:
            argv.append('--'+name.replace('_','-'));argv.extend(str(x) for x in value) if isinstance(value,(list,tuple)) else argv.append(str(value))
    if initial is not None:argv.extend(['--initial',str(initial)])
    return argv

def resource_bound(job_count):
    # Official published rates checked 2026-09-04. Count max memory, startup and
    # scale-down conservatively for EVERY job, although containers can be reused.
    rate=CPU_CORES*.0000131+MEMORY_GIB_LIMIT*.00000222
    return {'jobs':job_count,'maxContainers':MAX_CONTAINERS,'cpuPhysicalCoresPerContainer':CPU_CORES,'memoryGiBHardLimit':MEMORY_GIB_LIMIT,'gpu':None,
      'subprocessTimeoutSeconds':SUBPROCESS_SECONDS,'functionTimeoutSeconds':TASK_SECONDS,'startupTimeoutSeconds':STARTUP_SECONDS,'retries':0,
      'conservativeFunctionResourceUSD':job_count*(TASK_SECONDS+STARTUP_SECONDS+10)*rate,
      'reservedAllocationUSD':ALLOCATION_USD,'pricingSource':'https://modal.com/pricing',
      'caveat':'Resource arithmetic is not a provider charge. The $15 allocation also reserves image-build overhead. Existing task ledger remains authoritative.'}

app=modal.App('scott-gray-p6-diversity-cpu')
image=(modal.Image.debian_slim(python_version='3.12').apt_install('g++')
    .pip_install('numpy==2.4.2','scipy==1.17.1')
    .add_local_dir(HERE,'/root/p6',ignore=['__pycache__','*.pyc','*.so','*.dylib','*.f32','*.f64']))

def execute_job(job,expected_sources,initial_payload=None,source_root=None):
    import os
    import subprocess
    import sys
    import tempfile
    import time
    import numpy as np
    import scipy
    source_root=Path(source_root or '/root/p6')
    started=time.monotonic();job=validate_job(job);actual_sources=source_fingerprint(source_root)
    result={'id':job['id'],'settings':job,'sourceSha256':actual_sources,'independentlyVerified':False,'numpyVersion':np.__version__,'scipyVersion':scipy.__version__}
    if actual_sources!=expected_sources:return {**result,'outcome':'source-snapshot-mismatch','elapsedSeconds':time.monotonic()-started}
    with tempfile.TemporaryDirectory(prefix='p6-diversity-') as directory:
        root=Path(directory);seed=None
        if initial_payload is not None:
            metadata=initial_payload['metadata'];N=metadata['config']['N'];data=initial_payload['bytes']
            if type(N) is not int or not 6<=N<=126 or N%6 or len(data)!=2*N*N*8:raise ValueError('Invalid compact initial state.')
            if not np.isfinite(np.frombuffer(data,dtype='<f8')).all():raise ValueError('Nonfinite compact initial state.')
            (root/'initial.f64').write_bytes(data);seed=root/'initial.json';seed.write_text(json.dumps({**metadata,'fieldUrl':'initial.f64','fieldEncoding':'float64-le'}))
        env={**os.environ,'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','MKL_NUM_THREADS':'2'}
        def compact(report,data):
            N=report['config']['N']
            if len(data)!=2*N*N*8 or not np.isfinite(np.frombuffer(data,dtype='<f8')).all():raise ValueError('Invalid accepted initial state.')
            return {**report,'schema':'scott-gray-compact-shooting-seed-v1','fieldUrl':'candidate-seed.f64','fieldEncoding':'float64-le','payloadFrames':1,'payloadValueCount':2*N*N,'payloadByteLength':len(data),'payloadSha256':hashlib.sha256(data).hexdigest(),'independentlyVerified':False,'caveat':'Only the initial state is included. This is an unaudited shooting seed, not a complete movie or a verified orbit.'}
        def attempt(settings,folder,initial,timeout):
            argv=make_argv(settings,folder,initial,sys.executable);argv[1]=str(source_root/'search.py')
            try:
                process=subprocess.run(argv,capture_output=True,text=True,timeout=timeout,env=env,check=False)
                record={'returncode':process.returncode,'stdoutTail':process.stdout[-8000:],'stderrTail':process.stderr[-3000:]}
            except subprocess.TimeoutExpired as error:
                text=error.stdout or b'';text=text.decode(errors='replace') if isinstance(text,bytes) else text
                return {'outcome':'timeout','stdoutTail':text[-8000:]},None,None
            path=folder/'candidate.json'
            if process.returncode!=0 or not path.exists():
                failed=folder/'failed.json';report=json.loads(failed.read_text()) if failed.exists() else None
                return {**record,'outcome':'search-failed','report':report},None,None
            report=json.loads(path.read_text());N=report['config']['N']
            with (folder/report['fieldUrl']).open('rb') as stream:data=stream.read(2*N*N*8)
            if not report.get('rootConverged') or not math.isfinite(report.get('shootingRms',math.inf)) or report['shootingRms']>1e-8:
                return {**record,'outcome':'invalid-candidate','report':report},None,None
            actual_feed=report['config']['params']['F']
            if not math.isfinite(actual_feed) or (settings.get('feed') is not None and abs(actual_feed-settings['feed'])>1e-14):
                return {**record,'outcome':'wrong-feed-candidate','report':report},None,None
            return {**record,'outcome':'converged'},compact(report,data),data
        if 'continuation_step' not in job:
            record,report,data=attempt(job,root/'output',seed,max(.1,SUBPROCESS_SECONDS-(time.monotonic()-started)))
            result.update(record)
            if report is None:return {**result,'elapsedSeconds':time.monotonic()-started}
            reached=True
        else:
            if initial_payload is None:raise ValueError('Missing initial continuation payload.')
            target=job['feed'];current=float(metadata['config']['params']['F'])
            if not math.isfinite(current) or not metadata.get('rootConverged'):raise ValueError('Continuation requires a finite converged starting seed.')
            report=compact(metadata,initial_payload['bytes']);data=initial_payload['bytes']
            step=job['continuation_step'];minimum_step=min(2e-7,step);history=[];checkpoints=[];reason='attempt-limit'
            for index in range(24):
                if abs(current-target)<=1e-14:reason='target-reached';break
                remaining=SUBPROCESS_SECONDS-(time.monotonic()-started)
                if remaining<1:reason='time-budget';break
                trial=current+math.copysign(min(step,abs(target-current)),target-current)
                settings={**job,'feed':trial};folder=root/f'step-{index:02d}'
                record,accepted,accepted_data=attempt(settings,folder,seed,min(60.,remaining))
                result.update({key:value for key,value in record.items() if key in ('returncode','stdoutTail','stderrTail')})
                entry={'attempt':index,'requestedFeed':trial,'fromFeed':current,'step':abs(trial-current),'outcome':record['outcome'],'elapsedSeconds':time.monotonic()-started}
                diagnostic=accepted or record.get('report') or {}
                entry.update({key:diagnostic[key] for key in ('rootMessage','shootingRms','calls','period','spatialRms','temporalRms') if key in diagnostic})
                history.append(entry)
                if accepted is not None:
                    current=float(accepted['config']['params']['F']);report=accepted;data=accepted_data;seed=folder/'candidate.json'
                    checkpoints.append({'attempt':index,'actualFeed':current,'report':report,'initialF64':data})
                    # Increase only back towards the user-supplied maximum step.
                    step=min(job['continuation_step'],step*1.25)
                else:
                    if step<=minimum_step*(1+1e-12):reason='minimum-step';break
                    step=max(minimum_step,step/2)
            reached=abs(current-target)<=1e-14
            result.update(continuationHistory=history,checkpoints=checkpoints,requestedFeed=target,actualFeed=current,continuationReachedTarget=reached,continuationStopReason='target-reached' if reached else reason)
        nontrivial=report.get('temporalRms',0)>=.008 and report.get('spatialRms',0)>=.012
        outcome=('candidate-seed' if nontrivial else 'trivial-candidate-seed') if reached else 'stopped-continuation-seed'
        return {**result,'outcome':outcome,'report':report,'initialF64':data,'elapsedSeconds':time.monotonic()-started}

@app.function(image=image,cpu=(CPU_CORES,CPU_CORES),memory=(4096,8192),
    max_containers=MAX_CONTAINERS,min_containers=0,buffer_containers=0,
    scaledown_window=10,retries=0,timeout=TASK_SECONDS,startup_timeout=STARTUP_SECONDS)
def run_job(job,expected_sources,initial_payload=None):
    return execute_job(job,expected_sources,initial_payload)

def load_initial(path):
    import struct
    metadata=json.loads(path.read_text());N=metadata['config']['N']
    if type(N) is not int or not 6<=N<=126 or N%6:raise ValueError('Invalid input seed grid.')
    encoding=metadata.get('fieldEncoding');size=4 if encoding=='float32-le' else 8 if encoding=='float64-le' else 0
    if not size:raise ValueError('Initial state must use explicit little-endian float encoding.')
    with (path.parent/metadata['fieldUrl']).open('rb') as stream:data=stream.read(2*N*N*size)
    if len(data)!=2*N*N*size:raise ValueError('Truncated input seed.')
    values=struct.unpack('<'+('f' if size==4 else 'd')*(2*N*N),data)
    if not all(math.isfinite(value) for value in values):raise ValueError('Input seed is nonfinite.')
    return {'metadata':metadata,'bytes':struct.pack('<'+'d'*len(values),*values)}

def run_batch(jobs:str,output_dir:str,launch:bool=False):
    path=Path(jobs).resolve();raw=json.loads(path.read_text());raw=raw.get('jobs') if isinstance(raw,dict) else raw
    if not isinstance(raw,list) or not 1<=len(raw)<=MAX_JOBS:raise ValueError('Supply between 1 and 64 jobs.')
    settings=[validate_job(job,i) for i,job in enumerate(raw)]
    if len({job['id'] for job in settings})!=len(settings):raise ValueError('Job ids must be unique.')
    sources=source_fingerprint();bound=resource_bound(len(settings))
    if bound['conservativeFunctionResourceUSD']>ALLOCATION_USD-2:raise ValueError('Batch exceeds the allocation including the image-build reserve.')
    print(json.dumps({'launch':launch,'sourceSha256':sources,'budget':bound,'jobs':settings},indent=2),flush=True)
    if not launch:return
    destination=Path(output_dir).resolve();destination.mkdir(parents=True,exist_ok=True)
    if (destination/'batch.json').exists():raise ValueError('Choose a new output directory; an existing batch will not be repeated or overwritten.')
    payloads=[load_initial((path.parent/job['initial']).resolve()) if job.get('initial') else None for job in settings]
    summary={'schema':'scott-gray-p6-diversity-batch-v1','sourceSha256':sources,'budget':bound,'results':[],'independentlyVerified':False}
    (destination/'batch.json').write_text(json.dumps(summary,indent=2))
    for job,result in zip(settings,run_job.starmap(((job,sources,payload) for job,payload in zip(settings,payloads)),return_exceptions=True)):
        folder=destination/job['id'];folder.mkdir(exist_ok=False)
        if isinstance(result,Exception):result={'id':job['id'],'outcome':'function-error','error':str(result),'independentlyVerified':False}
        checkpoints=result.pop('checkpoints',[])
        result['checkpointPaths']=[]
        for checkpoint in checkpoints:
            relative=Path('checkpoints')/f"step-{checkpoint['attempt']:02d}"
            checkpoint_folder=folder/relative;checkpoint_folder.mkdir(parents=True)
            (checkpoint_folder/'candidate-seed.f64').write_bytes(checkpoint['initialF64'])
            (checkpoint_folder/'candidate-seed.json').write_text(json.dumps(checkpoint['report'],indent=2))
            result['checkpointPaths'].append({'attempt':checkpoint['attempt'],'actualFeed':checkpoint['actualFeed'],'metadata':str(relative/'candidate-seed.json')})
        initial=result.pop('initialF64',None)
        if initial is not None:(folder/'candidate-seed.f64').write_bytes(initial)
        if result.get('report') is not None:(folder/'candidate-seed.json').write_text(json.dumps(result['report'],indent=2))
        (folder/'result.json').write_text(json.dumps(result,indent=2));summary['results'].append({key:value for key,value in result.items() if key not in ('stdoutTail','stderrTail','report')});(destination/'batch.json').write_text(json.dumps(summary,indent=2))
        print(json.dumps({'id':job['id'],'outcome':result['outcome'],'seconds':result.get('elapsedSeconds')}),flush=True)

@app.local_entrypoint()
def main(jobs:str,output_dir:str,launch:bool=False):
    run_batch(jobs,output_dir,launch)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Validate and price a batch locally; use modal run with --launch only after review.')
    parser.add_argument('--jobs',required=True);parser.add_argument('--output-dir',required=True)
    args=parser.parse_args();run_batch(args.jobs,args.output_dir,False)
