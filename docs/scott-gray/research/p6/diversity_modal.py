"""Bounded GPU correction of arbitrary P6 mixed reciprocal-star seeds; no projection in flow."""
from pathlib import Path
import json
import modal
HERE=Path(__file__).resolve().parent
app=modal.App('scott-gray-p6-diversity-refinement')
worker_image=(modal.Image.debian_slim(python_version='3.12').apt_install('g++').pip_install('numpy==2.4.2','cupy-cuda12x[ctk]==14.2.0').add_local_file(HERE/'rk4_batch_triangular.cu','/root/rk4_batch.cu').add_local_file(HERE/'gray_scott_triangular.cpp','/root/cpu.cpp'))
@app.function(image=worker_image,gpu='A100-40GB',cpu=(2,2),memory=(8192,8192),max_containers=2,min_containers=0,retries=0,timeout=180,startup_timeout=180,scaledown_window=2)
def refine(seed):
 import time
 import numpy as np
 import cupy as cp
 import ctypes,subprocess
 start=time.perf_counter()
 subprocess.run(['g++','-O3','-std=c++17','-shared','-fPIC','/root/cpu.cpp','-o','/tmp/cpu.so'],check=True)
 native=ctypes.CDLL('/tmp/cpu.so').flow;ptr=ctypes.POINTER(ctypes.c_double);native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int];native.restype=None
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
  def flow(self,states,periods,params,fraction):
   par=np.tile([params['Du'],params['Dv'],params['F'],params['k'],params['dx'],0.],(self.B,1));par[:,-1]=np.asarray(periods)*fraction/self.steps
   # Updates and graph use one stream so state/parameter copies cannot race.
   with self.stream:
    self.qa.set(np.ascontiguousarray(states),stream=self.stream);self.params.set(par,stream=self.stream);self.graph.launch(self.stream)
   self.stream.synchronize();return cp.asnumpy(self.out)
 N=seed['config']['N'];S=N*N;p=seed['config']['params'];charge=seed['charge']
 import math
 fraction=1./(6//math.gcd(charge,6)) if charge else 1.
 initial=np.frombuffer(seed['initial'],dtype='<f8').copy();T=seed['config']['period'];y,x=np.indices((N,N));coords=np.stack([x.ravel(),y.ravel()]);R=np.array([[1,-1],[1,0]])
 # Preserve only already present translation symmetries. This keeps repeated
 # wave branches inexpensive without altering their physical lattice size.
 initial_grid=initial.reshape(2,N,N);repeat=1
 for candidate in reversed([j for j in range(2,N//6+1) if N%j==0]):
  shift=N//candidate
  if max(np.max(abs(initial_grid-np.roll(initial_grid,shift,axis=1))),np.max(abs(initial_grid-np.roll(initial_grid,shift,axis=2))))<1e-10:
   repeat=candidate;break
 cell=N//repeat;translations=[(0,0)];third=False
 if cell%3==0:
  shift=cell//3
  if np.max(abs(initial_grid-np.roll(np.roll(initial_grid,shift,axis=1),-shift,axis=2)))<1e-10:
   translations += [(shift,-shift),(2*shift,-2*shift)];third=True
 order=6//math.gcd(charge,6);all_labels=[]
 for a in range(0,6,order):
  transforms=[np.linalg.matrix_power(R,a)]
  if seed.get('instantaneousMirrorAxis') is not None:
   transforms.append(np.linalg.matrix_power(R,a+seed['instantaneousMirrorAxis'])@np.array([[0,1],[1,0]]))
  for transform in transforms:
   for tx,ty in translations:
    c=(transform@coords+np.array([[tx],[ty]]))%cell;all_labels.append(c[1]*cell+c[0])
 labels=np.min(np.stack(all_labels),axis=0)
 _,small=np.unique(labels,return_inverse=True);count=small.max()+1;expand=np.r_[small,small+count];_,reps=np.unique(expand,return_index=True);d=len(reps)+1
 if d>10000:raise ValueError('This bounded batch supports at most10000 Newton unknowns.')
 perm=(((y-x)%N)*N+y).ravel() if charge else np.arange(S);perm=np.r_[perm,perm+S];target=expand[perm[reps]]
 initial=initial[reps][expand]
 def rhs(q):
  z=q.reshape(2,N,N);u,v=z;lap=sum(np.roll(z,s,axis=a) for a in (1,2) for s in (-1,1))+sum(np.roll(np.roll(z,s,axis=1),s,axis=2) for s in (-1,1))-6*z;r=u*v*v
  f=lap*np.array([p['Du'],p['Dv']])[:,None,None]*2/(3*p['dx']**2);f[0]+=-r+p['F']*(1-u);f[1]+=r-(p['F']+p['k'])*v;return f.ravel()
 tan=rhs(initial);tan/=np.linalg.norm(tan);pg=np.bincount(expand,weights=tan,minlength=d-1)
 z=np.r_[initial[reps],np.log(T)];refz=z[:-1].copy();history=[];big=Graph(N,d+1,1024);smallgraph=Graph(N,1,1024)
 def cpu_flow(state,duration,steps):
  state=np.ascontiguousarray(state);out=np.empty_like(state)
  native(state.ctypes.data_as(ptr),out.ctypes.data_as(ptr),N,p['Du'],p['Dv'],p['F'],p['k'],p['dx'],duration,steps)
  return out
 gpu_test=smallgraph.flow(initial[None,:],[T],p,fraction)[0]
 cpu_test=cpu_flow(initial,T*fraction,1024)
 parity=float(np.max(abs(gpu_test-cpu_test)))
 if parity>1e-10:raise ValueError(f'CUDA triangular flow disagrees with independent native flow: {parity}')
 def evaluate(z,jac=False):
  if jac:
   zs=np.tile(z,(d+1,1));eps=1e-6;zs[np.arange(1,d+1),np.arange(d)]+=eps;used=big
  else:zs=z[None,:];used=smallgraph
  states=zs[:,:-1][:,expand];periods=np.exp(zs[:,-1]);forward=used.flow(states,periods,p,fraction)
  r=forward[:,reps]-zs[:,target];phase=(zs[:,:-1]-refz)@pg;r=np.column_stack([r,phase])
  return (r[0],(r[1:]-r[0]).T/eps) if jac else r[0]
 for iteration in range(32):
  if time.perf_counter()-start>140:break
  r,J=evaluate(z,True);norm=float(np.sqrt(np.mean(r*r)));history.append({'iteration':iteration,'rms':norm,'period':float(np.exp(z[-1]))})
  if norm<1e-11 and np.max(abs(r))<1e-9:break
  def line_search(delta):
   if not np.isfinite(delta).all():return None
   factor=min(1.,.06/max(np.max(abs(delta[:-1])),1e-12),.15/max(abs(delta[-1]),1e-12))
   for _ in range(14):
    trial=z+factor*delta
    if trial[:-1].min()>0 and trial[:-1].max()<1.2 and 100<np.exp(trial[-1])<800:
     new=evaluate(trial)
     if np.linalg.norm(new)<np.linalg.norm(r):return trial
    factor*=.5
   return None
  Jgpu=cp.asarray(J);rgpu=cp.asarray(r)
  try:trial=line_search(cp.asnumpy(cp.linalg.solve(Jgpu,-rgpu)))
  except Exception as e:history[-1]['newtonSolveError']=str(e);trial=None
  # Nearly neutral mixed-star directions can make the Newton step singular.
  # Damped least squares changes the search step, never the shooting residual.
  if trial is None:
   normal=Jgpu.T@Jgpu;gradient=Jgpu.T@rgpu
   for damping in [1e-8,1e-6,1e-4]:
    trial=line_search(cp.asnumpy(cp.linalg.solve(normal+damping*cp.eye(d),-gradient)))
    if trial is not None:history[-1]['dampedLeastSquares']=damping;break
  accepted=trial is not None
  if accepted:z=trial
  if not accepted:history[-1]['reason']='line search stalled';break
 r=evaluate(z);rms=float(np.sqrt(np.mean(r*r)));T=float(np.exp(z[-1]));state=z[:-1][expand]
 cpu_return=cpu_flow(state,T*fraction,int(np.ceil(T*fraction/.1)))
 cpu_rms=float(np.sqrt(np.mean((cpu_return-state[perm])**2)))
 report={'name':seed['name'],'config':{**seed['config'],'period':T},'charge':charge,'wave':seed.get('wave'),'mix':seed.get('mix'),'family':'p6','method':'Full-state batched FP64 CUDA RK4 Newton correction; ordinary unprojected PDE evolution','shootingRms':rms,'shootingResidualRms':rms,'history':history,'seconds':time.perf_counter()-start,'gpu':cp.cuda.runtime.getDeviceProperties(0)['name'].decode(),'converged':bool(rms<1e-11 and np.max(abs(r))<1e-9),'source':seed['source'],'instantaneousMirrorAxis':seed.get('instantaneousMirrorAxis'), 'spatialWavevector':seed.get('wave'), 'reflectedMix':seed.get('mix'), 'mixPhase':seed.get('mixPhase',0.), 'fieldUrl':'initial.f64', 'fieldEncoding':'float64-le','caveat':'Only a numerical search candidate. Independent Float32 full-PDE and prescribed time-character verification remains mandatory.'}
 report.update(gpuCpuFlowMaxDifference=parity,independentCpuTwistedRms=cpu_rms)
 report.update(spatialKernelRepeats=int(repeat),spatialKernelThirdTranslation=bool(third))
 report['converged']=bool(report['converged'] and cpu_rms<1e-8)
 return {'report':report,'initial':state.astype('<f8').tobytes()}

@app.local_entrypoint()
def main(inputs: str, output: str):
 import array,sys,math,time
 cases=json.loads(Path(inputs).read_text())
 if not 1<=len(cases)<=8:raise ValueError('Requires one to eight prevalidated seeds.')
 out=Path(output);out.mkdir(parents=True,exist_ok=True);prepared=[]
 for case in cases:
  path=Path(case['path']);report=json.loads(path.read_text());cfg=report['config'];N=cfg['N'];charge=case.get('charge',report.get('charge'))
  if not (12<=N<=96 and N%6==0) or cfg['M'] not in [96,192] or charge not in [0,1,2,3]:raise ValueError('P6 grids must be multiples of six between12and96; frames96or192.')
  if cfg['params'].get('stencil')!='triangular-six':raise ValueError('Triangular six-neighbor stencil required.')
  if not 100<cfg['period']<800 or not .0025<cfg['params']['F']<.0045 or cfg['params']['k']!=.02:raise ValueError('Seed outside this run budgeted parameter bounds.')
  data=Path(path.parent/report['fieldUrl']).read_bytes()[:16*N*N]
  values=array.array('d');values.frombytes(data)
  if sys.byteorder!='little':values.byteswap()
  if len(values)!=2*N*N or not all(math.isfinite(v) and 0<v<1.2 for v in values):raise ValueError('Invalid initial concentration state.')
  prepared.append({'name':case['name'],'config':cfg,'charge':charge,'initial':data,'wave':report.get('spatialWavevector'),'mix':report.get('reflectedMix'),'mixPhase':report.get('mixPhase',0.),'source':str(path),'instantaneousMirrorAxis':report.get('instantaneousMirrorAxis')})
 started=time.time();jobs=[(seed['name'],refine.spawn(seed)) for seed in prepared];results=[]
 (out/'calls.json').write_text(json.dumps([{'name':name,'functionCallId':call.object_id} for name,call in jobs],indent=2))
 import runpy
 collect_results=runpy.run_path(str(HERE/'result_collection.py'))['collect_results']
 results=collect_results(jobs,out)
 (out/'run.json').write_text(json.dumps({'startedUnix':started,'endedUnix':time.time(),'workers':2,'gpu':'A100-40GB','timeout':180,'startupTimeout':180,'maxJobs':8,'actualJobs':len(jobs),'allocationDollars':15,'budgetIncludesAllRunsByThisAgent':True},indent=2))
