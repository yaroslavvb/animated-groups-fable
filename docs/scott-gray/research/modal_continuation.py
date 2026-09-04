"""Bounded single-GPU continuation with batched FP64 shooting Jacobians.
No schedule or persistent deployment. Independent C++ RK4 verifies every output.
"""
from pathlib import Path
import json
import modal

HERE=Path(__file__).resolve().parent
app=modal.App('scott-gray-gpu-continuation')
image=(modal.Image.debian_slim(python_version='3.12').apt_install('g++')
 .pip_install('numpy==2.4.2','cupy-cuda12x[ctk]==14.2.0')
 .add_local_file(HERE/'rk4_batch.cu','/root/rk4_batch.cu')
 .add_local_file(HERE/'gray_scott_rk4.cpp','/root/gray_scott_rk4.cpp'))

@app.function(image=image,gpu='A100-40GB',cpu=(2,2),memory=(8192,16384),
 max_containers=1,min_containers=0,retries=0,timeout=900,startup_timeout=600,scaledown_window=2)
def continue_branches(seeds,targets):
 """Continue g95 standing/g96 rotating N48,L256 seeds through {F,k} targets.
 Each seed has family, config (including canonical ops), and initial little-endian
 Float64 bytes in [species,y,x] order. Returns compact states plus audit reports.
 The solver restricts to the branch's instantaneous mirrors; it is not a general
 search over all possible space-time isotropy types. See SEARCH.md.
 """
 import time,ctypes,subprocess
 import numpy as np
 import cupy as cp
 start=time.perf_counter(); kernel=cp.RawKernel(Path('/root/rk4_batch.cu').read_text(),'rk4_stage',options=('--std=c++17','--fmad=false'));kernel.compile()
 subprocess.run(['g++','-O3','-std=c++17','-shared','-fPIC','/root/gray_scott_rk4.cpp','-o','/tmp/cpu.so'],check=True)
 lib=ctypes.CDLL('/tmp/cpu.so');ptr=ctypes.POINTER(ctypes.c_double);native=lib.flow;native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int];native.restype=None
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
  def flow(self,states,periods,params,fraction):
   par=np.tile([params['Du'],params['Dv'],params['F'],params['k'],params['dx'],0.],(self.B,1));par[:,-1]=np.asarray(periods)*fraction/self.steps
   # Updates and graph use one stream so state/parameter copies cannot race.
   with self.stream:
    self.qa.set(np.ascontiguousarray(states),stream=self.stream);self.params.set(par,stream=self.stream);self.graph.launch(self.stream)
   self.stream.synchronize();return cp.asnumpy(self.out)
 graphs={}
 def graph(N,B):
  key=(N,B)
  if key not in graphs:graphs[key]=Graph(N,B,1024)
  return graphs[key]
 def rhs(state,N,p):
  q=state.reshape(2,N,N);u,v=q;lap=sum(np.roll(q,s,axis=a) for a in (1,2) for s in (-1,1))-4*q;r=u*v*v
  f=lap*np.array([p['Du'],p['Dv']])[:,None,None]/p['dx']**2;f[0]+=-r+p['F']*(1-u);f[1]+=r-(p['F']+p['k'])*v;return f.reshape(-1)
 def solve(initial,T,N,p,family):
  started=time.perf_counter();S=N*N;y,x=np.indices((N,N));offset=N//2 if family=='rotating' else 0;fraction=.25 if family=='rotating' else .5
  _,small=np.unique((np.minimum(y,(offset-y)%N)*N+np.minimum(x,(offset-x)%N)).reshape(-1),return_inverse=True);count=small.max()+1;expand=np.r_[small,small+count];_,reps=np.unique(expand,return_index=True);d=len(reps)+1
  perm=(((-x)%N)*N+y).reshape(-1);perm=np.r_[perm,perm+S];target=expand[perm[reps]];ref=initial.copy();tan=rhs(initial,N,p);tan/=np.linalg.norm(tan);pg=np.bincount(expand,weights=tan,minlength=d-1);z=np.r_[initial[reps],np.log(T)];refz=z[:-1].copy();history=[]
  big=graph(N,d+1);smallgraph=graph(N,1)
  def evaluate(z,jac=False):
   if jac:
    zs=np.tile(z,(d+1,1));eps=1e-6;zs[np.arange(1,d+1),np.arange(d)]+=eps;used=big
   else:zs=z[None,:];used=smallgraph
   states=zs[:,:-1][:,expand];periods=np.exp(zs[:,-1]);forward=used.flow(states,periods,p,fraction);r=forward[:,reps]-zs[:,target];phase=(zs[:,:-1]-refz)@pg;r=np.column_stack([r,phase])
   return (r[0],(r[1:]-r[0]).T/eps) if jac else r[0]
  success=False
  for iteration in range(24):
   if time.perf_counter()-start>760:break
   r,J=evaluate(z,True);norm=float(np.sqrt(np.mean(r*r)));history.append({'iteration':iteration,'rms':norm,'period':float(np.exp(z[-1]))})
   if norm<1e-11 and np.max(abs(r))<1e-9:success=True;break
   try:delta=cp.asnumpy(cp.linalg.solve(cp.asarray(J),cp.asarray(-r)))
   except Exception as exc:history[-1]['linearError']=str(exc);break
   if not np.isfinite(delta).all():break
   factor=min(1.,.06/max(np.max(abs(delta[:-1])),1e-12),.15/max(abs(delta[-1]),1e-12));accepted=False
   for _ in range(14):
    trial=z+factor*delta
    if np.min(trial[:-1])>0 and np.max(trial[:-1])<1.2 and 100<np.exp(trial[-1])<800:
     newr=evaluate(trial)
     if np.linalg.norm(newr)<np.linalg.norm(r):z=trial;accepted=True;break
    factor*=.5
   if not accepted:history[-1]['reason']='line search stalled';break
  r=evaluate(z);norm=float(np.sqrt(np.mean(r*r)));success=success or(norm<1e-11 and np.max(abs(r))<1e-9)
  return {'state':z[:-1][expand],'period':float(np.exp(z[-1])),'success':success,'residualRms':norm,'history':history,'seconds':time.perf_counter()-started}
 def interpolate(coarse):
  _,N,_=coarse.shape;out=np.empty((2,N*2,N*2));out[:,::2,::2]=coarse;out[:,::2,1::2]=.5*(coarse+np.roll(coarse,-1,axis=2));out[:,1::2,::2]=.5*(coarse+np.roll(coarse,-1,axis=1));out[:,1::2,1::2]=.25*(coarse+np.roll(coarse,-1,axis=1)+np.roll(coarse,-1,axis=2)+np.roll(np.roll(coarse,-1,axis=1),-1,axis=2));return out
 def cpu_flow(state,N,p,duration,dt):
  state=np.ascontiguousarray(state);out=np.empty_like(state);native(state.ctypes.data_as(ptr),out.ctypes.data_as(ptr),N,p['Du'],p['Dv'],p['F'],p['k'],p['dx'],duration,int(np.ceil(duration/dt)));return out
 def capture_and_check(state,T,N,p,ops,M=128):
  results=[];stored=None
  for dt in [.2,.1]:
   q=state.copy();future=[q.copy()]
   for frame in range(2*M):q=cpu_flow(q,N,p,T/M,dt);future.append(q.copy())
   future=np.array(future);movie=future[:M];per=[];y,x=np.indices((N,N))
   for op in ops:
    A=np.array(op['M']);v=np.rint(N*np.array(op['v'])).astype(int);xx=(A[0,0]*x+A[0,1]*y+v[0])%N;yy=(A[1,0]*x+A[1,1]*y+v[1])%N;mapping=(yy*N+xx).reshape(-1);mapping=np.r_[mapping,mapping+N*N];shift=round(op['tau']*M);err=future[np.arange(M)+shift][:,mapping]-movie;per.append({'rms':float(np.sqrt(np.mean(err*err))),'max':float(np.max(abs(err)))})
   checks={'dtLimit':dt,'returnRms':float(np.sqrt(np.mean((future[M]-state)**2))),'twoPeriodReturnRms':float(np.sqrt(np.mean((future[2*M]-state)**2))),'phase':per};results.append(checks);stored=movie
  f=stored.reshape(M,2,N,N);motion=float(np.sqrt(np.mean((f-f.mean(axis=0,keepdims=True))**2)));space=float(np.sqrt(np.mean((f-f.mean(axis=(2,3),keepdims=True))**2)))
  return f,{'checks':results,'temporalRms':motion,'spatialRms':space,'preliminaryPassed':motion>=.008 and space>=.012 and max(a['returnRms'] for a in results)<1e-7 and max(q['max'] for a in results for q in a['phase'])<1e-6}
 records=[];attempts=[]
 for seed in seeds:
  family=seed['family'];baseconfig=seed['config'];N=48;p0=baseconfig['params'];last=np.frombuffer(seed['initial'],dtype='<f8').copy();lastT=baseconfig['period'];group=baseconfig['groupId'];ops=baseconfig['ops']
  for target in targets:
   if time.perf_counter()-start>760:break
   p={**p0,**target,'dx':256/24};initial=last.reshape(2,48,48)[:,::2,::2].copy().reshape(-1);coarse=solve(initial,lastT,24,p,family);attempt={'family':family,'target':target,'coarse':{k:v for k,v in coarse.items() if k!='state'}}
   if not coarse['success']:attempts.append(attempt);print('FAILED',json.dumps(attempt),flush=True);continue
   p['dx']=256/48;finit=interpolate(coarse['state'].reshape(2,24,24)).reshape(-1);fine=solve(finit,coarse['period'],48,p,family);attempt['fine']={k:v for k,v in fine.items() if k!='state'}
   if not fine['success']:attempts.append(attempt);print('FAILED',json.dumps(attempt),flush=True);continue
   movie,audit=capture_and_check(fine['state'],fine['period'],48,p,ops);attempt['independent']=audit;attempts.append(attempt)
   if audit['preliminaryPassed']:
    last,lastT=fine['state'],fine['period'];config={**baseconfig,'N':48,'M':128,'L':256,'period':lastT,'params':p};refine=fine['state'].reshape(2,48,48)[:,::2,::2]-coarse['state'].reshape(2,24,24)
    report={'config':config,'period':lastT,'family':family,'method':'GPU Newton shooting with batched finite-difference Jacobian and GPU dense solve','gpuResidualRms':fine['residualRms'],'independent':audit,'refinement':{'coarseN':24,'fineN':48,'coarsePeriod':coarse['period'],'finePeriod':lastT,'relativePeriodDifference':abs(lastT/coarse['period']-1),'initialFieldRmsDifference':float(np.sqrt(np.mean(refine*refine)))},'caveat':'Numerical finite-grid branch; canonical Float32 atlas admission still required.'}
    records.append({'report':report,'initial':fine['state'].astype('<f8').tobytes()});print('SOLVED',json.dumps({'group':group,'target':target,'T':lastT,'rms':fine['residualRms'],'return':audit['checks'][-1]['returnRms']}),flush=True)
   else:print('REJECTED',json.dumps({'family':family,'target':target,'audit':audit}),flush=True)
 return {'records':records,'attempts':attempts,'functionSeconds':time.perf_counter()-start,'gpu':cp.cuda.runtime.getDeviceProperties(0)['name'].decode()}

@app.local_entrypoint()
def main(output_dir: str='modal-results', seed_dir: str=str(HERE.parent/'data'/'orbits'), targets_json: str='', families: str='standing,rotating'):
 from modal_io import load_saved_seed,write_results,validate_targets,parse_families
 selected=parse_families(families)
 targets=json.loads(Path(targets_json).read_text()) if targets_json else [{'F':f,'k':.02} for f in [.00402,.00401,.00400,.00398,.00395]]+[{'F':.00400,'k':k} for k in [.01995,.02005]]
 validate_targets(targets)
 seeds=[load_saved_seed(seed_dir,'g95' if family=='standing' else 'g96',family) for family in selected]
 result=continue_branches.remote(seeds,targets)
 print('Saved',write_results(result,output_dir),'independently reconstructed movies to',output_dir)
