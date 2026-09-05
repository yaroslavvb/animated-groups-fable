#!/usr/bin/env python3
"""Search genuine reciprocal-shell branches; outputs require independent atlas audit."""
import argparse,ctypes,json,platform,subprocess,time
from pathlib import Path
import numpy as np
from scipy.optimize import root,brentq
from scipy.signal import resample
from scipy.linalg import expm
from scipy.sparse.linalg import LinearOperator

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--charge',type=int,choices=[0,1,2],default=2)
 p.add_argument('--wave',type=int,nargs=2,default=[1,0]);p.add_argument('--grid',type=int,default=16)
 p.add_argument('--feed',type=float);p.add_argument('--kill',type=float,default=.02)
 p.add_argument('--amplitude',type=float,default=.035);p.add_argument('--length',type=float,default=256)
 p.add_argument('--mix',type=float,default=0,help='Amplitude of the reflected reciprocal star.');p.add_argument('--mix-phase',type=float,default=0,help='Reflected-star temporal phase in radians.');p.add_argument('--unrestricted',action='store_true',help='Remove the additional axial mirror restriction.')
 p.add_argument('--initial',type=Path);p.add_argument('--output',type=Path,required=True)
 p.add_argument('--method',choices=['hybr','krylov'],default='krylov');p.add_argument('--maxiter',type=int,default=60)
 a=p.parse_args()
 if a.grid<8 or a.grid%4 or min(a.wave)<0 or max(a.wave)>=a.grid//2 or max(a.wave)==0:p.error('Require a multiple-of-four grid and a nonzero resolved integer wavevector.')
 if not np.isfinite(a.length) or a.length<=0 or not 0<a.amplitude<=.1:p.error('Positive length and an amplitude in(0,.1] are required.')
 if a.charge==2 and not a.unrestricted and a.wave[0]==a.wave[1]:p.error('A diagonal standing wave requires --unrestricted.')
 a.output.mkdir(parents=True,exist_ok=True)
 N=a.grid;S=N*N;M=128;L=a.length;h=L/N;k=a.kill;Du,Dv=.16,.08;charge=a.charge;order=4//np.gcd(charge,4);fraction=1/order if charge else 1
 R=np.array([[0,-1],[1,0]],int);y,x=np.indices((N,N));coords=np.array([x.ravel(),y.ravel()])
 def mapping(j):
  c=np.linalg.matrix_power(R,j%4)@coords%N;return c[1]*N+c[0]
 inv0=mapping(-1 if charge else 0);inv=np.r_[inv0,inv0+S]
 if charge==2 and not a.unrestricted:
  # Instantaneous axial mirrors; the antisymmetric cosine-product seed lies here.
  cx,cy=np.minimum(x,(-x)%N),np.minimum(y,(-y)%N);labels=(cy*N+cx).ravel()
 elif charge==2: labels=np.minimum(np.arange(S),mapping(2))
 elif charge==0: labels=np.min(np.array([mapping(j) for j in range(4)]),axis=0)
 else: labels=np.arange(S)
 _,spatial=np.unique(labels,return_inverse=True);count=spatial.max()+1;expand=np.r_[spatial,spatial+count];_,reps=np.unique(expand,return_index=True)
 source=Path(__file__).with_name('gray_scott_rk4.cpp');library=Path('/tmp/p4-diversity-flow.dylib' if platform.system()=='Darwin' else '/tmp/p4-diversity-flow.so')
 if not library.exists():subprocess.run(['c++','-O3','-std=c++17',*(['-dynamiclib'] if platform.system()=='Darwin' else ['-shared','-fPIC']),str(source),'-o',str(library)],check=True)
 lib=ctypes.CDLL(str(library));native=lib.flow;ptr=ctypes.POINTER(ctypes.c_double);native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int];native.restype=None
 def flow(q,T,F,dt=.4):
  if not np.isfinite(T) or not 0<T<1600:raise ValueError('Trial period outside bound')
  q=np.ascontiguousarray(q,dtype=np.float64);out=np.empty_like(q)
  native(q.ctypes.data_as(ptr),out.ctypes.data_as(ptr),N,Du,Dv,F,k,h,T,int(np.ceil(T/min(dt,.15*h*h/Du))))
  return out
 def eq(F):
  u=(1-np.sqrt(1-4*(F+k)**2/F))/2;return np.array([u,F*(1-u)/(F+k)])
 m,n=a.wave;lam=-4*(np.sin(np.pi*m/N)**2+np.sin(np.pi*n/N)**2)/h**2
 hopf=brentq(lambda F:k-eq(F)[1]**2+(Du+Dv)*lam,.0025,.0043);F=a.feed if a.feed else hopf;u,v=eq(F)
 jac=np.array([[-v*v-F+Du*lam,-2*u*v],[v*v,2*u*v-F-k+Dv*lam]])
 eigen,vecs=np.linalg.eig(jac);idx=np.argmax(eigen.imag);vec=vecs[:,idx]/vecs[0,idx]
 if charge==2 and not a.unrestricted:
  psi=np.cos(2*np.pi*m*x/N)*np.cos(2*np.pi*n*y/N)-np.cos(2*np.pi*n*x/N)*np.cos(2*np.pi*m*y/N)
 else:
  base=(np.sin if charge%2 else np.cos)(2*np.pi*(m*x+n*y)/N).ravel()
  other=(np.sin if charge%2 else np.cos)(2*np.pi*(n*x+m*y)/N).ravel()
  psi=sum(np.exp(2j*np.pi*charge*j/4)*(base[mapping(j)]+a.mix*np.exp(1j*a.mix_phase)*other[mapping(j)]) for j in range(4)).reshape(N,N)
 direction=np.real(vec[:,None,None]*psi).ravel()
 if not np.isfinite(direction).all() or np.linalg.norm(direction)<1e-12:raise ValueError('This reciprocal-star combination vanishes for the requested character.')
 direction/=np.sqrt(np.mean(direction**2))
 initial=np.repeat(eq(F),S)+a.amplitude*direction;T=2*np.pi/eigen[idx].imag
 if a.initial:
  meta=json.loads(a.initial.read_text());cfg=meta['config'];old=cfg['N'];q=np.fromfile(a.initial.parent/meta['fieldUrl'],dtype='<f8')[:2*old*old]
  initial=resample(resample(q.reshape(2,old,old),N,axis=1),N,axis=2).real.ravel();T=cfg['period']
  if a.feed is None:F=cfg['params']['F']
 initial=initial[reps][expand];reference=initial.copy();tangent=(flow(initial,.01,F)-initial)/.01;tangent/=np.linalg.norm(tangent)
 fixamp=a.feed is None;calls=0;started=time.time()
 def residual(z):
  nonlocal calls
  calls+=1;q=z[:len(reps)][expand];period=np.exp(z[len(reps)]);feed=.004*z[-1] if fixamp else a.feed
  diff=flow(q,period*fraction,feed)-q[inv];out=np.r_[diff[reps],np.dot(q-reference,tangent)]
  if fixamp:out=np.r_[out,np.mean(q*direction)-a.amplitude]
  if not np.isfinite(out).all():raise ValueError('Nonfinite iterate')
  return out
 z=np.r_[initial[reps],np.log(T),F/.004] if fixamp else np.r_[initial[reps],np.log(T)]
 options={'xtol':1e-9,'maxfev':8000,'factor':.1} if a.method=='hybr' else {'fatol':1e-10,'maxiter':a.maxiter,'jac_options':{'inner_maxiter':35}}
 if a.method=='krylov' and not fixamp:
  freq=R.T@coords%N if charge else coords;permutation=freq[1]*N+freq[0];seen=set();blocks=[];eu,ev=eq(F);duration=T*fraction
  for first in range(S):
   if first in seen:continue
   orbit=[];at=first
   while at not in seen:seen.add(at);orbit.append(at);at=int(permutation[at])
   ky,kx=divmod(first,N);el=-4*(np.sin(np.pi*kx/N)**2+np.sin(np.pi*ky/N)**2)/h**2
   E=expm(np.array([[-ev*ev-F+Du*el,-2*eu*ev],[ev*ev,2*eu*ev-F-k+Dv*el]])*duration);ell=len(orbit)
   inverses=np.asarray([np.linalg.inv(E-np.exp(2j*np.pi*j/ell)*np.eye(2)) for j in range(ell)])
   blocks.append((np.asarray(orbit),inverses))
  def approx(reduced):
   hat=np.fft.fft2(reduced[expand].reshape(2,N,N)).reshape(2,S);out=np.empty_like(hat)
   for orbit,iv in blocks:
    coeff=np.fft.fft(hat[:,orbit],axis=1);out[:,orbit]=np.fft.ifft(np.einsum('jab,bj->aj',iv,coeff),axis=1)
   return np.fft.ifft2(out.reshape(2,N,N)).real.ravel()[reps]
  flowed=flow(initial,duration,F);col=(flow(flowed,.001,F)-flowed)/.001*duration;ab=approx(col[reps]);schur=np.dot(ab[expand],tangent)
  def precondition(rhs):
   ar=approx(rhs[:-1]);t=(np.dot(ar[expand],tangent)-rhs[-1])/schur;return np.r_[ar-ab*t,t]
  options['jac_options']['inner_M']=LinearOperator((len(z),len(z)),matvec=precondition,dtype=float)
 print(json.dumps({'stage':'start','wave':a.wave,'charge':charge,'N':N,'F':F,'T':T,'rms':float(np.sqrt(np.mean(residual(z)**2)))}),flush=True)
 try:
  fit=root(residual,z,method=a.method,options=options);z=fit.x;message=str(fit.message)
 except (ValueError,OverflowError,FloatingPointError) as e:
  (a.output/'failed.json').write_text(json.dumps({'reason':str(e),'calls':calls,'wave':a.wave,'charge':charge}));print(str(e),flush=True);return
 q=z[:len(reps)][expand];T=float(np.exp(z[len(reps)]));F=float(.004*z[-1] if fixamp else a.feed);rms=float(np.sqrt(np.mean(residual(z)**2)))
 report={'family':('standing' if charge==2 else 'rotating' if charge==1 else 'instantaneous'),'method':'Unprojected square-lattice RK4 twisted shooting with phase condition','seed':f'Reciprocal wavevector ({m},{n}); reflected-star ratio {a.mix}, relative phase {a.mix_phase}; axial mirrors {not a.unrestricted and charge==2}','wave':a.wave,'mix':a.mix,'mixPhase':a.mix_phase,'unrestricted':a.unrestricted,'charge':charge,'shootingRms':rms,'shootingResidualRms':rms,'calls':calls,'elapsedSeconds':time.time()-started,'message':message,'hopfFeed':hopf}
 if rms>1e-9:
  (a.output/'failed.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return
 frames=[];state=q.copy()
 for j in range(M):frames.append(q.copy());q=flow(q,T/M,F,dt=.1)
 field=np.array(frames).reshape(M,2,N,N);spatial=float(np.sqrt(np.mean((field-field.mean(axis=(2,3),keepdims=True))**2)));temporal=float(np.sqrt(np.mean((field-field.mean(axis=0,keepdims=True))**2)))
 phase=[]
 for j in range(1,4):
  moved=field.reshape(M,2,S)[:,:,mapping(j)];offset=(M*charge*j//4)%M;phase.append({'rotation':90*j,'rms':float(np.sqrt(np.mean((np.roll(moved,-offset,axis=0)-field.reshape(M,2,S))**2)))})
 ops=[{'M':np.linalg.matrix_power(R,j).tolist(),'v':[0,0],'s':1,'tau':(charge*j%4)/4} for j in range(4)]
 cfg={'N':N,'M':M,'period':T,'L':L,'groupId':{0:'g94',1:'g96',2:'g95'}[charge],'ops':ops,'params':{'F':F,'k':k,'Du':Du,'Dv':Dv,'dx':h,'stencil':'five-point'},'minTemporal':.008,'minSpatial':.012}
 spectrum=np.mean(abs(np.fft.fft2(field[:,1]))**2,axis=0);spectrum[0,0]=0;peaks=np.argsort(spectrum.ravel())[-8:][::-1]
 report.update(config=cfg,fieldUrl='candidate.f64',fieldEncoding='float64-le',period=T,spatialRms=spatial,temporalRms=temporal,returnRms=float(np.sqrt(np.mean((q-state)**2))),fullReturnRms=float(np.sqrt(np.mean((q-state)**2))),generatorMetrics=phase,spectralPeaks=[{'k':[int(i%N if i%N<=N//2 else i%N-N),int(i//N if i//N<=N//2 else i//N-N)],'power':float(spectrum.ravel()[i])} for i in peaks],minimum=float(field.min()),maximum=float(field.max()))
 field.astype('<f8').tofile(a.output/'candidate.f64');(a.output/'candidate.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['config','spectralPeaks']}),flush=True)
if __name__=='__main__':main()
