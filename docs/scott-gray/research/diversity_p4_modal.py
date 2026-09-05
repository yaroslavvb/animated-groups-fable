"""Bounded GPU correction of arbitrary P4 reciprocal-star seeds; no projection in flow."""
from pathlib import Path
import json
import modal
from modal_continuation import image
HERE=Path(__file__).resolve().parent
app=modal.App('scott-gray-p4-diversity')
worker_image=image.add_local_file(HERE/'modal_continuation.py','/root/modal_continuation.py')
@app.function(image=worker_image,gpu='A100-40GB',cpu=(2,2),memory=(8192,16384),max_containers=4,min_containers=0,retries=0,timeout=300,startup_timeout=300,scaledown_window=2)
def refine(seed):
 import time
 import numpy as np
 import cupy as cp
 start=time.perf_counter()
 kernel=cp.RawKernel(Path('/root/rk4_batch.cu').read_text(),'rk4_stage',options=('--std=c++17','--fmad=false'));kernel.compile()
 class Graph:
  def __init__(self,N,B,steps):
   self.N,self.B,self.steps=N,B,steps;shape=(B,2*N*N)
   self.qa=cp.empty(shape,dtype=cp.float64);self.qb=cp.empty_like(self.qa);self.ta=cp.empty_like(self.qa);self.tb=cp.empty_like(self.qa);self.acc=cp.empty_like(self.qa);self.params=cp.empty((B,6),dtype=cp.float64);self.stream=cp.cuda.Stream(non_blocking=True)
   grid=((B*N*N+255)//256,);end=(self.params,np.int32(N),np.int32(B))
   def step(a,b):
    kernel(grid,(256,),(a,a,self.acc,self.ta,*end,np.int32(1)))
    kernel(grid,(256,),(a,self.ta,self.acc,self.tb,*end,np.int32(2)))
    kernel(grid,(256,),(a,self.tb,self.acc,self.ta,*end,np.int32(3)))
    kernel(grid,(256,),(a,self.ta,self.acc,b,*end,np.int32(4)))
   # Force argument setup before capture; initialized values avoid invalid ops.
   self.qa.fill(.15);self.params[:]=cp.asarray([.16,.08,.004,.02,256/N,.01]);cp.cuda.runtime.deviceSynchronize()
   with self.stream:step(self.qa,self.qb)
   self.stream.synchronize()
   with self.stream:
    self.stream.begin_capture();a,b=self.qa,self.qb
    for _ in range(steps):step(a,b);a,b=b,a
    self.graph=self.stream.end_capture()
   self.out=a
  def flow(self,states,periods,params,fraction,feeds=None):
   par=np.tile([params['Du'],params['Dv'],params['F'],params['k'],params['dx'],0.],(self.B,1));par[:,-1]=np.asarray(periods)*fraction/self.steps
   if feeds is not None:par[:,2]=np.asarray(feeds)
   # Updates and graph use one stream so state/parameter copies cannot race.
   with self.stream:
    self.qa.set(np.ascontiguousarray(states),stream=self.stream);self.params.set(par,stream=self.stream);self.graph.launch(self.stream)
   self.stream.synchronize();return cp.asnumpy(self.out)
 N=seed['config']['N'];S=N*N;p=seed['config']['params'];charge=seed['charge'];fraction=.25 if charge==1 else .5
 initial=np.frombuffer(seed['initial'],dtype='<f8').copy();T=seed['config']['period'];y,x=np.indices((N,N))
 if charge==2 and seed.get('axialMirrors'):
  labels=(np.minimum(y,(-y)%N)*N+np.minimum(x,(-x)%N)).ravel()
 elif charge==2:labels=np.minimum(np.arange(S),(((-y)%N)*N+(-x)%N).ravel())
 else:labels=np.arange(S)
 # Detect exact extra translation symmetry in the seed; preserve it only when
 # it already holds to roundoff. Translation commutes with ordinary PDE flow.
 shape=initial.reshape(2,N,N);translations=[];labels2=labels.reshape(N,N).copy()
 offsets={0}
 if seed.get('useTranslations',True):
  offsets.update(range(0,N,N//4))
  repetition=int(np.gcd(*seed['wave']))
  if repetition>1 and N%repetition==0:offsets.update(range(0,N,N//int(np.lcm(4,repetition))))
 for dy in sorted(offsets):
  for dx in sorted(offsets):
   if np.max(abs(np.roll(np.roll(shape,dy,axis=1),dx,axis=2)-shape))<1e-10:
    translations.append([dx,dy]);labels2=np.minimum(labels2,np.roll(np.roll(labels.reshape(N,N),dy,axis=0),dx,axis=1))
 labels=labels2.ravel()
 _,small=np.unique(labels,return_inverse=True);count=small.max()+1;expand=np.r_[small,small+count];_,reps=np.unique(expand,return_index=True);d=len(reps)+1
 if d>10000:raise ValueError('This bounded dense solver allows at most10,000 unknowns; use extra exact symmetries or a smaller grid.')
 perm=(((-x)%N)*N+y).ravel();perm=np.r_[perm,perm+S];target=expand[perm[reps]]
 def rhs(q):
  z=q.reshape(2,N,N);u,v=z;lap=sum(np.roll(z,s,axis=a) for a in (1,2) for s in (-1,1))-4*z;r=u*v*v
  f=lap*np.array([p['Du'],p['Dv']])[:,None,None]/p['dx']**2;f[0]+=-r+p['F']*(1-u);f[1]+=r-(p['F']+p['k'])*v;return f.ravel()
 tan=rhs(initial);tan/=np.linalg.norm(tan);pg=np.bincount(expand,weights=tan,minlength=d-1)
 z=np.r_[initial[reps],np.log(T)];refz=z[:-1].copy();history=[];big=Graph(N,d+1,1024);smallgraph=Graph(N,1,1024)
 def evaluate(z,jac=False):
  if jac:
   zs=np.tile(z,(d+1,1));eps=1e-6;zs[np.arange(1,d+1),np.arange(d)]+=eps;used=big
  else:zs=z[None,:];used=smallgraph
  states=zs[:,:-1][:,expand];periods=np.exp(zs[:,-1]);forward=used.flow(states,periods,p,fraction)
  r=forward[:,reps]-zs[:,target];phase=(zs[:,:-1]-refz)@pg;r=np.column_stack([r,phase])
  return (r[0],(r[1:]-r[0]).T/eps) if jac else r[0]
 seed_correction=[];corrected_seed=None
 if seed.get('correctSeedWithFreeFeed',False):
  # Correct the grid interpolation at prescribed nonzero amplitude, allowing
  # feed to move along the branch before fixing it for ordinary continuation.
  # The amplitude equation removes the competing homogeneous zero-amplitude root.
  augmented=Graph(N,d+2,1024);w=np.r_[z,p['F']/.004]
  direction=initial.reshape(2,N,N).copy();direction-=direction.mean(axis=(1,2),keepdims=True);direction=direction.ravel();direction/=np.sqrt(np.mean(direction*direction));amplitude=float(np.mean(initial*direction))
  def seed_evaluate(w,jac=False):
   if jac:
    ws=np.tile(w,(d+2,1));eps=1e-6;ws[np.arange(1,d+2),np.arange(d+1)]+=eps;used=augmented
   else:ws=w[None,:];used=smallgraph
   states=ws[:,:-2][:,expand];forward=used.flow(states,np.exp(ws[:,-2]),p,fraction,feeds=.004*ws[:,-1]);res=forward[:,reps]-ws[:,target]
   res=np.column_stack([res,(ws[:,:-2]-refz)@pg,np.mean(states*direction,axis=1)-amplitude])
   return (res[0],(res[1:]-res[0]).T/eps) if jac else res[0]
  for iteration in range(24):
   if time.perf_counter()-start>220:break
   r,J=seed_evaluate(w,True);norm=float(np.sqrt(np.mean(r*r)));seed_correction.append({'iteration':iteration,'feed':float(.004*w[-1]),'rms':norm,'period':float(np.exp(w[-2])),'fixedAmplitude':amplitude})
   if norm<1e-11 and np.max(abs(r))<1e-9:break
   try:delta=cp.asnumpy(cp.linalg.solve(cp.asarray(J),cp.asarray(-r)))
   except Exception as e:seed_correction[-1]['error']=str(e);break
   if not np.isfinite(delta).all():break
   factor=min(1.,.06/max(np.max(abs(delta[:-2])),1e-12),.15/max(abs(delta[-2]),1e-12),.01/max(abs(delta[-1]),1e-12));accepted=False
   for _ in range(14):
    trial=w+factor*delta
    if trial[:-2].min()>0 and trial[:-2].max()<1.2 and 100<np.exp(trial[-2])<800 and .0025<.004*trial[-1]<.0045:
     new=seed_evaluate(trial)
     if np.linalg.norm(new)<np.linalg.norm(r):w=trial;accepted=True;break
    factor*=.5
   if not accepted:seed_correction[-1]['reason']='line search stalled';break
  corrected_r=seed_evaluate(w);corrected_rms=float(np.sqrt(np.mean(corrected_r*corrected_r)))
  z=w[:-1].copy();p['F']=float(.004*w[-1])
  if corrected_rms<1e-11 and np.max(abs(corrected_r))<1e-9:
   corrected_seed={'initial':z[:-1][expand].astype('<f8').tobytes(),'report':{'config':{**seed['config'],'params':dict(p),'period':float(np.exp(z[-1]))},'charge':charge,'wave':seed['wave'],'mix':seed.get('mix'),'mixPhase':seed.get('mixPhase',0),'fieldUrl':'corrected-seed.f64','fieldEncoding':'float64-le','seedOnly':True,'shootingRms':corrected_rms,'source':seed['source'],'axialMirrors':seed.get('axialMirrors',False)}}
  refz=z[:-1].copy();tan=rhs(z[:-1][expand]);tan/=np.linalg.norm(tan);pg=np.bincount(expand,weights=tan,minlength=d-1)
  del augmented
 targets=seed.get('targets',[])
 schedule=[float(p['F'])]
 for goal in targets:
  count_steps=max(1,int(np.ceil(abs(goal-schedule[-1])/1.0e-5)))
  schedule.extend(np.linspace(schedule[-1],goal,count_steps+1)[1:].tolist())
 if len(schedule)>24:raise ValueError('At most24 bounded continuation steps.')
 stage_results=[]
 def equilibrium(feed):
  u=(1-np.sqrt(1-4*(feed+p['k'])**2/feed))/2
  return np.array([u,feed*(1-u)/(feed+p['k'])])
 wm,wn=seed['wave'];lam=-4*(np.sin(np.pi*wm/N)**2+np.sin(np.pi*wn/N)**2)/p['dx']**2
 lo,hi=.0025,.0043
 for _ in range(60):
  middle=(lo+hi)/2;trace=p['k']-equilibrium(middle)[1]**2+(p['Du']+p['Dv'])*lam
  if trace>0:lo=middle
  else:hi=middle
 hopf=(lo+hi)/2;previous_feed=float(p['F'])
 if seed.get('correctSeedWithFreeFeed',False) or seed.get('adaptiveHopfSteps',False):
  # A fixed 1e-5 feed jump can more than double a small Hopf amplitude.
  # Grow distance from Hopf gradually during the first continuation stages.
  schedule=[float(p['F'])]
  for goal in targets:
   while abs(goal-schedule[-1])>1e-12:
    step=min(abs(goal-schedule[-1]),1e-5,max(2e-7,.5*abs(hopf-schedule[-1])))
    schedule.append(float(schedule[-1]+np.sign(goal-schedule[-1])*step))
  if len(schedule)>32:raise ValueError('Adaptive Hopf continuation exceeds32 stages.')
 for feed in schedule:
  if time.perf_counter()-start>220:break
  p['F']=feed
  if feed!=previous_feed:
   # Near Hopf, amplitude scales with sqrt(Hopf feed minus feed). Without
   # this predictor a Newton step can fall toward the homogeneous root.
   gain=float(np.clip(np.sqrt(max(1e-12,hopf-feed)/max(1e-12,hopf-previous_feed)),.5,2.))
   predicted=equilibrium(feed)[:,None,None]+gain*(z[:-1][expand].reshape(2,N,N)-equilibrium(previous_feed)[:,None,None])
   if predicted.min()>0 and predicted.max()<1.2:z[:-1]=predicted.ravel()[reps]
   refz=z[:-1].copy();tan=rhs(z[:-1][expand]);tan/=np.linalg.norm(tan);pg=np.bincount(expand,weights=tan,minlength=d-1)
  previous_feed=feed
  for iteration in range(seed.get('maxNewton',12)):
   if time.perf_counter()-start>220:break
   r,J=evaluate(z,True);norm=float(np.sqrt(np.mean(r*r)));history.append({'iteration':iteration,'feed':feed,'rms':norm,'period':float(np.exp(z[-1]))})
   if norm<1e-11 and np.max(abs(r))<1e-9:break
   try:delta=cp.asnumpy(cp.linalg.solve(cp.asarray(J),cp.asarray(-r)))
   except Exception as e:history[-1]['error']=str(e);break
   if not np.isfinite(delta).all():break
   factor=min(1.,.06/max(np.max(abs(delta[:-1])),1e-12),.15/max(abs(delta[-1]),1e-12));accepted=False
   for _ in range(14):
    trial=z+factor*delta
    if trial[:-1].min()>0 and trial[:-1].max()<1.2 and 100<np.exp(trial[-1])<800:
     new=evaluate(trial)
     if np.linalg.norm(new)<np.linalg.norm(r):z=trial;accepted=True;break
    factor*=.5
   if not accepted:history[-1]['reason']='line search stalled';break
  stage_r=evaluate(z);stage_rms=float(np.sqrt(np.mean(stage_r*stage_r)))
  stage_results.append({'feed':feed,'rms':stage_rms,'period':float(np.exp(z[-1]))})
  if stage_rms>1e-11 or np.max(abs(stage_r))>1e-9:break
 r=evaluate(z);rms=float(np.sqrt(np.mean(r*r)));T=float(np.exp(z[-1]));state=z[:-1][expand]
 report={'name':seed['name'],'config':{**seed['config'],'period':T},'charge':charge,'wave':seed.get('wave'),'mix':seed.get('mix'),'mixPhase':seed.get('mixPhase',0),'family':'rotating' if charge==1 else 'standing','method':'Full-state batched FP64 CUDA RK4 Newton correction; ordinary unprojected PDE evolution','shootingRms':rms,'shootingResidualRms':rms,'history':history,'seedCorrection':seed_correction,'seconds':time.perf_counter()-start,'gpu':cp.cuda.runtime.getDeviceProperties(0)['name'].decode(),'converged':bool(rms<1e-11 and np.max(abs(r))<1e-9),'source':seed['source'],'components':seed.get('components'),'continuation':stage_results,'requestedTargets':targets,'targetReached':bool(not targets or abs(p['F']-targets[-1])<1e-12),'translations':translations,'axialMirrors':seed.get('axialMirrors',False),'caveat':'Only a numerical search candidate. Independent Float32 full-PDE and prescribed time-character verification remains mandatory.'}
 return {'report':report,'initial':state.astype('<f8').tobytes(),'correctedSeed':corrected_seed}

@app.local_entrypoint()
def main(inputs: str, output: str):
 import array,sys,math,time
 from concurrent.futures import ThreadPoolExecutor,as_completed
 cases=json.loads(Path(inputs).read_text())
 if not 1<=len(cases)<=16:raise ValueError('Requires one to sixteen prevalidated seeds.')
 out=Path(output);out.mkdir(parents=True,exist_ok=True);prepared=[]
 for case in cases:
  path=Path(case['path']);report=json.loads(path.read_text());cfg=report['config'];N=cfg['N'];charge=case.get('charge',report.get('charge'))
  if N not in [48,64,96] or cfg['M']!=128 or charge not in [1,2]:raise ValueError('Only N48/N64/N96,M128 quarter/half-period seeds are supported.')
  if not 100<cfg['period']<800 or not .0025<cfg['params']['F']<.0045 or cfg['params']['k']!=.02:raise ValueError('Seed outside this run budgeted parameter bounds.')
  if len(case.get('targets',[]))>4 or any(not .0038<=f<=.0042 for f in case.get('targets',[])):raise ValueError('Unsupported continuation target schedule.')
  if case.get('maxNewton',12) not in [12,24,48]:raise ValueError('Unsupported Newton iteration cap.')
  previous=cfg['params']['F'];steps=1
  for goal in case.get('targets',[]):steps+=max(1,int(math.ceil(abs(goal-previous)/1.0e-5)));previous=goal
  if steps>24:raise ValueError('At most24 bounded continuation steps.')
  if cfg['params'].get('stencil')!='five-point' or cfg['params']['Du']!=.16 or cfg['params']['Dv']!=.08 or abs(cfg['params']['dx']-256/N)>1e-12:raise ValueError('Requires the reviewed square-grid physical parameters.')
  data=Path(path.parent/report['fieldUrl']).read_bytes()[:16*N*N]
  values=array.array('d');values.frombytes(data)
  if sys.byteorder!='little':values.byteswap()
  if len(values)!=2*N*N or not all(math.isfinite(v) and 0<v<1.2 for v in values):raise ValueError('Invalid initial concentration state.')
  prepared.append({'name':case['name'],'config':cfg,'charge':charge,'initial':data,'wave':report.get('wave'),'mix':report.get('mix'),'mixPhase':report.get('mixPhase',0),'source':str(path),'targets':case.get('targets',[]),'maxNewton':case.get('maxNewton',12),'correctSeedWithFreeFeed':case.get('correctSeedWithFreeFeed',False),'adaptiveHopfSteps':case.get('adaptiveHopfSteps',False),'useTranslations':case.get('useTranslations',True),'components':report.get('components'),'axialMirrors':case.get('axialMirrors',charge==2 and not report.get('unrestricted',False))})
 started=time.time();jobs=[(seed['name'],refine.spawn(seed)) for seed in prepared];results=[]
 with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
  pending={pool.submit(call.get):name for name,call in jobs}
  for future in as_completed(pending):
   name=pending[future];result=future.result();folder=out/name;folder.mkdir(parents=True,exist_ok=True);(folder/'initial.f64').write_bytes(result.pop('initial'))
   corrected=result.pop('correctedSeed',None)
   if corrected:
    (folder/'corrected-seed.f64').write_bytes(corrected['initial']);(folder/'corrected-seed.json').write_text(json.dumps(corrected['report'],indent=2))
   (folder/'report.json').write_text(json.dumps(result['report'],indent=2));results.append(result['report']);(out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(result['report']),flush=True)
 (out/'run.json').write_text(json.dumps({'startedUnix':started,'endedUnix':time.time(),'workers':4,'gpu':'A100-40GB','timeout':300,'maxJobs':16,'actualJobs':len(jobs),'allocationDollars':20,'budgetIncludesAllRunsByThisAgent':True},indent=2))
