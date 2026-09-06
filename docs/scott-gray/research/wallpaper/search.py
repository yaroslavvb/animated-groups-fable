#!/usr/bin/env python3
"""Unprojected, finite-grid Gray–Scott twisted shooting for any catalog character.

The full affine operation set defines the instantaneous kernel. Only the initial
state is reduced by that kernel; each shooting evaluation integrates the original
Gray–Scott equations. Exported candidates require the separate saved-byte audit.
"""
import argparse,ctypes,json,math,platform,subprocess,time
from pathlib import Path
import numpy as np
from scipy.optimize import root,brentq
from scipy.signal import resample
HERE=Path(__file__).resolve().parent


def mapping(op,N):
 y,x=np.indices((N,N));a=np.asarray(op['M'],int);v=np.asarray(op.get('v',[0,0]))*N
 if np.max(abs(v-np.rint(v)))>1e-7:raise ValueError('Operation does not preserve this mesh')
 v=np.rint(v).astype(int);return (((a[1,0]*x+a[1,1]*y+v[1])%N)*N+(a[0,0]*x+a[0,1]*y+v[0])%N).ravel()


def native_flow(lattice,output):
 source=HERE.parent/('p6/gray_scott_triangular.cpp' if lattice=='triangular' else 'gray_scott_rk4.cpp')
 if not source.exists():source=HERE/('triangular.cpp' if lattice=='triangular' else 'square.cpp')
 library=output/('flow.dylib' if platform.system()=='Darwin' else 'flow.so')
 subprocess.run(['c++','-O3','-std=c++17',*(['-dynamiclib'] if platform.system()=='Darwin' else ['-shared','-fPIC']),str(source),'-o',str(library)],check=True)
 lib=ctypes.CDLL(str(library.resolve()));native=lib.flow;ptr=ctypes.POINTER(ctypes.c_double)
 native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int];native.restype=None
 def flow(q,T,N,F,k,L,dt=.3):
  if not np.isfinite(T) or not 0<T<2000:raise ValueError('Trial period outside finite search bound')
  q=np.ascontiguousarray(q,dtype=np.float64);out=np.empty_like(q);h=L/N
  native(q.ctypes.data_as(ptr),out.ctypes.data_as(ptr),N,.16,.08,F,k,h,T,int(np.ceil(T/min(dt,.15*h*h/.16))))
  return out
 return flow


def search(job,output,groups_path=None):
 output=Path(output);output.mkdir(parents=True,exist_ok=True)
 groups=json.loads(Path(groups_path or HERE.parent.parent/'wallpaper-groups.json').read_text())['groups'];group=next(g for g in groups if g['id']==job['groupId'])
 N=int(job.get('N',12));M=int(job.get('M',96));L=float(job.get('L',256));k=float(job.get('k',.02));amp=float(job.get('amplitude',.035));wave=job.get('wave',[1,0]);S=N*N;h=L/N
 if N%group['meshMultiple'] or M%group['frameMultiple']:raise ValueError('Mesh/frame incompatible with canonical operations')
 if not group['hasTimeShift']:raise ValueError('No nonzero character in this row')
 order=group['phaseOrder'];ops=group['ops'];maps=[mapping(op,N) for op in ops]
 kernel=[mp for op,mp in zip(ops,maps) if abs(op['tau'])<1e-8]
 labels=np.min(kernel,axis=0);_,spatial=np.unique(labels,return_inverse=True);count=spatial.max()+1;expand=np.r_[spatial,spatial+count];_,reps=np.unique(expand,return_index=True)
 generator=next(i for i,op in enumerate(ops) if abs(op['tau']-1/order)<1e-8);inv0=np.argsort(maps[generator]);inverse=np.r_[inv0,inv0+S]
 flow0=native_flow(group['lattice'],output)
 def flow(q,T,F,dt=.3):return flow0(q,T,N,F,k,L,dt)
 def equilibrium(F):
  disc=1-4*(F+k)**2/F
  if disc<=0:raise ValueError('Uniform equilibrium branch is absent')
  u=(1-np.sqrt(disc))/2;return np.array([u,F*(1-u)/(F+k)])
 a,b=wave;y,x=np.indices((N,N));lam=(-4*(np.sin(np.pi*a/N)**2+np.sin(np.pi*b/N)**2)/h**2 if group['lattice']=='square' else 2/(3*h*h)*(2*np.cos(2*np.pi*a/N)+2*np.cos(2*np.pi*b/N)+2*np.cos(2*np.pi*(a+b)/N)-6))
 hopf=brentq(lambda F:k-equilibrium(F)[1]**2+.24*lam,.0025,.0043);F=float(job.get('F',hopf));u,v=equilibrium(F)
 eig,vecs=np.linalg.eig(np.array([[-v*v-F+.16*lam,-2*u*v],[v*v,2*u*v-F-k+.08*lam]]));idx=np.argmax(eig.imag)
 if eig[idx].imag<=0:raise ValueError('No oscillatory seed eigenmode')
 vec=vecs[:,idx]/vecs[0,idx];base=np.exp(2j*np.pi*(a*x+b*y)/N).ravel()
 psi=sum(np.exp(2j*np.pi*op['tau'])*base[mp] for op,mp in zip(ops,maps)).reshape(N,N)
 # Complex plane waves retain both sine and cosine seed components even for C2.
 direction=np.real(np.exp(2j*np.pi*job.get('seedPhase',.137))*vec[:,None,None]*psi).ravel();norm=np.sqrt(np.mean(direction**2))
 if norm<1e-12:raise ValueError('This reciprocal mode cancels under the target character')
 direction/=norm;initial=np.repeat(equilibrium(F),S)+amp*direction;T=float(2*np.pi/eig[idx].imag)
 if job.get('seed'):
  seed=job['seed'];old=seed['N'];data=np.asarray(seed['state'],float)
  initial=resample(resample(data.reshape(2,old,old),N,axis=1),N,axis=2).real.ravel();T=seed['period'];F=float(job.get('F',seed['F']))
 if job.get('initial'):
  meta=json.loads(Path(job['initial']).read_text());cfg=meta['config'];old=cfg['N'];dtype='<f4' if meta.get('fieldEncoding')=='float32-le' else '<f8';data=np.fromfile(Path(job['initial']).parent/meta['fieldUrl'],dtype=dtype)[:2*old*old]
  initial=resample(resample(data.reshape(2,old,old),N,axis=1),N,axis=2).real.ravel();T=cfg['period'];F=float(job.get('F',cfg['params']['F']))
 initial=initial[reps][expand];reference=initial.copy();tangent=(flow(initial,.01,F)-initial)/.01;tangent/=np.linalg.norm(tangent);fixamp='F' not in job
 started=time.monotonic();calls=0
 def residual(z):
  nonlocal calls
  calls+=1;q=z[:len(reps)][expand];period=np.exp(z[len(reps)]);feed=.004*z[-1] if fixamp else F
  diff=flow(q,period/order,feed)-q[inverse];out=np.r_[diff[reps],np.dot(q-reference,tangent)]
  if fixamp:out=np.r_[out,np.mean(q*direction)-amp]
  if not np.isfinite(out).all():raise ValueError('Nonfinite Newton iterate')
  return out
 z=np.r_[initial[reps],np.log(T),F/.004] if fixamp else np.r_[initial[reps],np.log(T)]
 method=job.get('method','hybr');options={'xtol':1e-9,'maxfev':int(job.get('maxfev',7000)),'factor':.1} if method=='hybr' else {'fatol':1e-10,'maxiter':int(job.get('maxiter',80)),'jac_options':{'inner_maxiter':35}}
 report={'schema':'wallpaper-shooting-candidate-v1','job':{k:v for k,v in job.items() if k!='seed'},'groupId':group['id'],'family':group['family'],'lattice':group['lattice'],'method':'Unprojected affine twisted RK4 shooting with a time phase condition','instantaneousKernelOrder':len(kernel),'unknowns':len(z),'hopfFeed':hopf,'independentlyVerified':False}
 try:
  fit=root(residual,z,method=method,options=options);z=fit.x;res=residual(z);rms=float(np.sqrt(np.mean(res**2)));q=z[:len(reps)][expand];T=float(np.exp(z[len(reps)]));F=float(.004*z[-1] if fixamp else F)
  report.update(shootingRms=rms,rootConverged=bool(fit.success),rootMessage=str(fit.message),calls=calls,elapsedSeconds=time.monotonic()-started)
  if rms>1e-9:raise ValueError('Shooting did not converge to tolerance')
  frames=[];start=q.copy()
  for j in range(M):frames.append(q.copy());q=flow(q,T/M,F,.1)
  field=np.array(frames).reshape(M,2,N,N)
  report.update(config={'N':N,'M':M,'L':L,'period':T,'groupId':group['id'],'params':{'F':F,'k':k,'Du':.16,'Dv':.08,'dx':h,'stencil':'triangular-six' if group['lattice']=='triangular' else 'five-point'},'ops':ops},period=T,spatialRms=float(np.sqrt(np.mean((field-field.mean(axis=(2,3),keepdims=True))**2))),temporalRms=float(np.sqrt(np.mean((field-field.mean(axis=0,keepdims=True))**2))),returnRms=float(np.sqrt(np.mean((q-start)**2))),fieldUrl='candidate.f32',fieldEncoding='float32-le')
  field.astype('<f4').tofile(output/'candidate.f32');(output/'candidate.json').write_text(json.dumps(report,indent=2));return report
 except (ValueError,OverflowError,FloatingPointError) as error:
  report.update(failed=str(error),calls=calls,elapsedSeconds=time.monotonic()-started);(output/'failed.json').write_text(json.dumps(report,indent=2));return report

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--job',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--groups',type=Path);a=p.parse_args();print(json.dumps(search(json.loads(a.job.read_text()),a.output,a.groups),indent=2))
