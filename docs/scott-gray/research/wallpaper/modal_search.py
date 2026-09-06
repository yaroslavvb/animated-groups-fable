"""Bounded Modal CPU fan-out of generic affine Gray–Scott shooting jobs.

No retries, schedules, endpoints or GPUs. Hard limits: 256 total jobs, 24
concurrent containers, two physical cores and 8 GiB memory, 150-second task,
120-second subprocess, 120-second startup. Dry run is the default. Every result
is an unaudited candidate; the separate saved-byte audit controls admission.
"""
import hashlib,json,math,re
from pathlib import Path
import modal
HERE=Path(__file__).resolve().parent
MAX_JOBS=256;MAX_CONTAINERS=24;TASK_SECONDS=150;STARTUP_SECONDS=120;SUBPROCESS_SECONDS=120
RATE=2*.0000131+8*.00000222
app=modal.App('scott-gray-wallpaper-search')
image=(modal.Image.debian_slim(python_version='3.12').apt_install('g++').pip_install('numpy==2.4.2','scipy==1.17.1')
 .add_local_file(HERE/'search.py','/root/wallpaper/search.py')
 .add_local_file(HERE.parent/'gray_scott_rk4.cpp','/root/wallpaper/square.cpp')
 .add_local_file(HERE.parent/'p6/gray_scott_triangular.cpp','/root/wallpaper/triangular.cpp')
 .add_local_file(HERE.parent.parent/'wallpaper-groups.json','/root/wallpaper/groups.json'))

def validate(job):
 allowed={'id','groupId','N','M','L','k','F','wave','amplitude','seedPhase','maxfev','maxiter','method','seed'}
 if not isinstance(job,dict) or set(job)-allowed:raise ValueError('Undocumented job arguments')
 if not re.fullmatch(r'[a-zA-Z0-9_-]{1,90}',job['id']):raise ValueError('Unsafe identifier')
 if not re.fullmatch(r'g[0-9]+',job['groupId']):raise ValueError('Unsafe group identifier')
 for name,low,high in [('N',6,36),('M',12,192),('maxfev',100,12000),('maxiter',1,100)]:
  if name in job and (type(job[name])!=int or not low<=job[name]<=high):raise ValueError('Bounded '+name)
 for name,low,high in [('L',64,1024),('k',.001,.06),('F',.001,.01),('amplitude',.005,.09),('seedPhase',0,1)]:
  if name in job and (not isinstance(job[name],(int,float)) or not math.isfinite(job[name]) or not low<=job[name]<=high):raise ValueError('Bounded '+name)
 if len(job['wave'])!=2 or not any(job['wave']) or any(type(v)!=int or abs(v)>6 for v in job['wave']):raise ValueError('Bounded wavevector')
 if 'seed' in job:
  seed=job['seed'];n=seed['N']
  if type(n)!=int or not 6<=n<=36 or len(seed['state'])!=2*n*n or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in seed['state']):raise ValueError('Invalid finite compact seed')
  if not 1<seed['period']<2000 or not .001<seed['F']<.01:raise ValueError('Invalid seed period/feed')
 return job

@app.function(image=image,cpu=(2,2),memory=(4096,8192),max_containers=MAX_CONTAINERS,min_containers=0,buffer_containers=0,scaledown_window=10,retries=0,timeout=TASK_SECONDS,startup_timeout=STARTUP_SECONDS)
def run_job(job):
 import os,subprocess,sys,tempfile,time
 job=validate(job);start=time.monotonic()
 with tempfile.TemporaryDirectory() as d:
  directory=Path(d);(directory/'job.json').write_text(json.dumps(job));out=directory/'result'
  try:
   process=subprocess.run([sys.executable,'/root/wallpaper/search.py','--job',str(directory/'job.json'),'--groups','/root/wallpaper/groups.json','--output',str(out)],capture_output=True,text=True,timeout=SUBPROCESS_SECONDS,env={**os.environ,'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2','MKL_NUM_THREADS':'2'})
   path=out/'candidate.json';failed=out/'failed.json';report=json.loads(path.read_text()) if path.exists() else json.loads(failed.read_text()) if failed.exists() else None
   return {'id':job['id'],'outcome':'candidate' if path.exists() else 'failed','report':report,'field':(out/'candidate.f32').read_bytes() if path.exists() else None,'stderr':process.stderr[-2000:],'elapsedSeconds':time.monotonic()-start}
  except subprocess.TimeoutExpired:return {'id':job['id'],'outcome':'timeout','elapsedSeconds':time.monotonic()-start}

@app.local_entrypoint()
def main(jobs:str,output:str,launch:bool=False):
 settings=[validate(j) for j in json.loads(Path(jobs).read_text())];count=len(settings)
 if not 1<=count<=MAX_JOBS or len({j['id'] for j in settings})!=count:raise ValueError('Job cap or duplicate ids')
 bound=count*(TASK_SECONDS+STARTUP_SECONDS+10)*RATE+3
 if bound>10:raise ValueError('Batch resource bound exceeds $10 reservation')
 budget={'maximumJobs':count,'maxContainers':MAX_CONTAINERS,'physicalCoresPerContainer':2,'memoryGiBHardLimit':8,'executionSeconds':TASK_SECONDS,'startupSeconds':STARTUP_SECONDS,'subprocessSeconds':SUBPROCESS_SECONDS,'retries':0,'gpu':None,'pricingURL':'https://modal.com/pricing','pricingChecked':'2026-09-05','resourceUSDPerSecond':RATE,'reservedUSDIncludingThreeDollarBuildReserve':bound}
 print(json.dumps({'launch':launch,'budget':budget}),flush=True)
 if not launch:return
 destination=Path(output);destination.mkdir(parents=True,exist_ok=False);summary={'schema':'wallpaper-modal-batch-v1','budget':budget,'results':[]};(destination/'batch.json').write_text(json.dumps(summary,indent=2))
 for index,result in enumerate(run_job.map(settings,return_exceptions=True)):
  job=settings[index]
  if isinstance(result,Exception):result={'id':job['id'],'outcome':'function-error','error':str(result)}
  folder=destination/job['id'];folder.mkdir();binary=result.pop('field',None)
  if binary is not None:(folder/'candidate.f32').write_bytes(binary)
  if result.get('report'):(folder/('candidate.json' if binary else 'failed.json')).write_text(json.dumps(result['report'],indent=2))
  (folder/'result.json').write_text(json.dumps({k:v for k,v in result.items() if k!='report'},indent=2));summary['results'].append({k:v for k,v in result.items() if k not in ['report','stderr']});(destination/'batch.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary['results'][-1]),flush=True)
