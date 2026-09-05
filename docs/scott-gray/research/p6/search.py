#!/usr/bin/env python3
"""Offline P6 Gray–Scott twisted shooting; every output is an unaudited candidate.

Use --charge 1, 2, or 3 for sixth-, third-, or half-period R60 characters.
Charge zero searches an instantaneous P6-invariant periodic orbit. Initial
Hopf searches fix a nonzero spatial projection and solve for feed F; supplying
--feed instead fixes F and continues an input candidate. The triangular torus
has basis (1,0),(-1/2,sqrt(3)/2), and the physical lattice side is held fixed.
"""
import argparse
import ctypes
import json
import math
import platform
import subprocess
import time
from types import SimpleNamespace
from pathlib import Path

import numpy as np
from scipy.optimize import root, brentq
from scipy.signal import resample
from scipy.linalg import expm
from scipy.sparse.linalg import LinearOperator


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--charge', type=int, choices=[0, 1, 2, 3], required=True)
    p.add_argument('--grid', type=int, default=12)
    p.add_argument('--frames', type=int, default=192)
    p.add_argument('--mode', type=int, default=1, help='Spatial repetitions along each lattice direction.')
    p.add_argument('--shell', type=int, choices=[1,3], default=1, help='Squared length of the seed reciprocal wavevector: (1,0) or (1,1).')
    p.add_argument('--wavevector', type=int, nargs=2, metavar=('A','B'), help='General reciprocal seed (A,B); overrides mode and shell and imposes no extra translations.')
    p.add_argument('--seed-translations', action='store_true', help='Optionally retain the exact translations shared by the seed reciprocal stars; generic stars otherwise use the full torus.')
    p.add_argument('--reflected-mix', type=float, default=0., help='Add the reflected reciprocal star with this relative amplitude.')
    p.add_argument('--mix-phase', type=float, default=0., help='Temporal phase of the reflected star, in turns.')
    p.add_argument('--mirror-axis', type=int, choices=range(6), help='Optional instantaneous mirror R^axis S (only charges zero and three).')
    p.add_argument('--amplitude', type=float, default=.015)
    p.add_argument('--feed', type=float)
    p.add_argument('--kill', type=float, default=.02)
    p.add_argument('--length', type=float, default=256.)
    p.add_argument('--initial', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--maxfev', type=int, default=8000)
    p.add_argument('--predictor', action='store_true', help='Scale the previous Hopf amplitude before changing feed.')
    p.add_argument('--method', choices=['hybr','krylov'], default='hybr')
    p.add_argument('--precondition-state-mean', action='store_true', help='Use spatial mean reaction derivatives of the initial state in the Fourier preconditioner.')
    p.add_argument('--export-initial', action='store_true', help='Export an already corrected input only if it independently satisfies the native shooting tolerance; skip a new Newton solve.')
    args = p.parse_args()
    if args.export_initial and (args.initial is None or args.feed is None):p.error('--export-initial requires --initial and fixed --feed.')
    args.output.mkdir(parents=True, exist_ok=True)
    N,M,m,L,k=args.grid,args.frames,args.charge,args.length,args.kill
    if args.mirror_axis is not None and m not in [0,3]:p.error('An instantaneous mirror is compatible only with charges zero and three.')
    if N<6 or N%6 or M<12 or M%6: p.error('Grid and frames must be multiples of six.')
    if args.mode<1 or N%args.mode or N//args.mode<6: p.error('Spatial mode must divide grid and leave at least six nodes per cell.')
    if args.shell==3 and (N//args.mode)%3: p.error('Shell three requires a cell divisible by three.')
    S=N*N;h=L/N;Du,Dv=.16,.08
    order=6//math.gcd(m,6);fraction=(1/order if m else 1.)
    R=np.array([[1,-1],[1,0]],dtype=int)
    y,x=np.indices((N,N)); coords=np.array([x.reshape(-1),y.reshape(-1)])
    def mapping(a):
        c=np.linalg.matrix_power(R,a%6)@coords%N
        return c[1]*N+c[0]
    inv=mapping(-1 if m else 0);inv=np.r_[inv,inv+S]
    a,b=args.wavevector if args.wavevector else (args.mode,args.mode if args.shell==3 else 0)
    repeat=math.gcd(a,b) if args.wavevector and args.seed_translations else (1 if args.wavevector else args.mode)
    repeat=max(1,repeat)
    if N%repeat:p.error('Seed translation repetitions must divide the grid.')
    cell=N//repeat
    third=(args.wavevector and args.seed_translations and (a//repeat-b//repeat)%3==0) or (args.shell==3 and not args.wavevector)
    if third and cell%3:p.error('Seed one-third translation requires a cell divisible by three.')
    cells=[]
    for rotation_power in range(0,6,order):
        transforms=[np.linalg.matrix_power(R,rotation_power)]
        if args.mirror_axis is not None:transforms.append(np.linalg.matrix_power(R,rotation_power+args.mirror_axis)@np.array([[0,1],[1,0]]))
        for transform in transforms:
            for shift in range(3 if third else 1):
                c=(transform@coords+np.array([[shift*cell//3],[-shift*cell//3]]))%cell
                cells.append(c[1]*cell+c[0])
    labels=np.min(np.stack(cells),axis=0)
    _,spatial=np.unique(labels,return_inverse=True);count=spatial.max()+1
    expand=np.r_[spatial,spatial+count]
    _,reps=np.unique(expand,return_index=True)
    source=Path(__file__).with_name('gray_scott_triangular.cpp')
    library=args.output.resolve()/('flow.dylib' if platform.system()=='Darwin' else 'flow.so')
    flags=['-dynamiclib'] if platform.system()=='Darwin' else ['-shared','-fPIC']
    subprocess.run(['c++','-O3','-std=c++17',*flags,str(source),'-o',str(library)],check=True)
    lib=ctypes.CDLL(str(library));native=lib.flow;ptr=ctypes.POINTER(ctypes.c_double)
    native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int]
    def flow(state,T,F,dt=.4):
        state=np.ascontiguousarray(state,dtype=np.float64);out=np.empty_like(state)
        if not np.isfinite(T) or T<=0 or T>2000: raise ValueError('Invalid trial period')
        native(state.ctypes.data_as(ptr),out.ctypes.data_as(ptr),N,Du,Dv,F,k,h,T,int(np.ceil(T/min(dt,.15*h*h/Du))))
        return out
    def equilibrium(F):
        u=(1-np.sqrt(1-4*(F+k)**2/F))/2
        return np.array([u,F*(1-u)/(F+k)])
    a,b=args.wavevector if args.wavevector else (args.mode,args.mode if args.shell==3 else 0)
    if a==0 and b==0:p.error('Seed wavevector must be nonzero.')
    if max(abs(a),abs(b),abs(a+b))>=N/2:p.error('Every rotated seed wavevector must lie below the grid Nyquist frequency.')
    lam=2/(3*h*h)*(2*np.cos(2*np.pi*a/N)+2*np.cos(2*np.pi*b/N)+2*np.cos(2*np.pi*(a+b)/N)-6)
    hopf=brentq(lambda F:k-equilibrium(F)[1]**2+(Du+Dv)*lam,.002,.0043)
    F=args.feed if args.feed else hopf
    eq=equilibrium(F);u,v=eq
    jac=np.array([[-v*v-F+Du*lam,-2*u*v],[v*v,2*u*v-F-k+Dv*lam]])
    eigenvalues,vectors=np.linalg.eig(jac);idx=np.argmax(eigenvalues.imag)
    vec=vectors[:,idx]/vectors[0,idx]
    coordinate=a*x+b*y
    base=np.sin(2*np.pi*coordinate/N) if m%2 else np.cos(2*np.pi*coordinate/N)
    psi=sum(np.exp(2j*np.pi*m*r/6)*base.reshape(-1)[mapping(r)] for r in range(6)).reshape(N,N)
    if args.reflected_mix:
        reflected=b*x+a*y
        base2=np.sin(2*np.pi*reflected/N) if m%2 else np.cos(2*np.pi*reflected/N)
        psi2=sum(np.exp(2j*np.pi*m*r/6)*base2.reshape(-1)[mapping(r)] for r in range(6)).reshape(N,N)
        psi+=args.reflected_mix*np.exp(2j*np.pi*args.mix_phase)*psi2
    direction=np.real(vec[:,None,None]*psi).reshape(-1)
    direction_norm=np.sqrt(np.mean(direction**2))
    if direction_norm<1e-14:p.error('The selected character and star mixture cancel identically.')
    direction/=direction_norm
    initial=np.repeat(eq,S)+args.amplitude*direction
    T=2*np.pi/eigenvalues[idx].imag
    initial_source=f'Analytic reciprocal ({a},{b}) Hopf character, reflected-star mixture {args.reflected_mix}, with a prescribed nonzero spatial projection.'
    if args.initial:
        meta=json.loads(args.initial.read_text()); cfg=meta['config'];old=cfg['N']
        binary=args.initial.parent/meta['fieldUrl']
        z=np.fromfile(binary,dtype='<f4' if meta.get('fieldEncoding')=='float32-le' else '<f8')[:2*old*old]
        initial=resample(resample(z.reshape(2,old,old),N,axis=1),N,axis=2).real.reshape(-1)
        T=cfg['period'];F=args.feed if args.feed else cfg['params']['F']
        if args.predictor and F!=cfg['params']['F']:
            old_feed=cfg['params']['F']; ratio=np.sqrt(max(.1,(hopf-F)/(hopf-old_feed)))
            ratio=np.clip(ratio,.3,3.)
            initial=np.repeat(equilibrium(F),S)+ratio*(initial-np.repeat(equilibrium(old_feed),S))
        initial_source=str(args.initial.resolve())
    initial=initial[reps][expand]
    reference=initial.copy();tangent=(flow(initial,.01,F)-initial)/.01;tangent/=np.linalg.norm(tangent)
    fix_amplitude=args.feed is None
    calls=0;started=time.time()
    def residual(z):
        nonlocal calls
        calls+=1;state=z[:len(reps)][expand];period=np.exp(z[len(reps)]);feed=.004*z[-1] if fix_amplitude else args.feed
        diff=flow(state,period*fraction,feed)-state[inv]
        out=np.r_[diff[reps],np.dot(state-reference,tangent)]
        if fix_amplitude:out=np.r_[out,np.mean(state*direction)-args.amplitude]
        if not np.isfinite(out).all(): raise ValueError('Nonfinite shooting iterate')
        if calls%1000==0:print(json.dumps({'stage':'newton','charge':m,'N':N,'calls':calls,'rms':float(np.sqrt(np.mean(out*out))),'F':feed,'T':period}),flush=True)
        return out
    z=np.r_[initial[reps],np.log(T),F/.004] if fix_amplitude else np.r_[initial[reps],np.log(T)]
    print(json.dumps({'stage':'start','charge':m,'N':N,'unknowns':len(z),'F':F,'T':T,'rms':float(np.sqrt(np.mean(residual(z)**2)))}),flush=True)
    options={'xtol':1e-9,'maxfev':args.maxfev,'factor':.1} if args.method=='hybr' else {'fatol':1e-11,'maxiter':100,'jac_options':{'inner_maxiter':40}}
    if args.method=='krylov' and not args.export_initial:
        # Block Fourier preconditioner for D Phi_tau at the uniform equilibrium.
        # Rotation permutes equal-Laplacian Fourier modes; diagonalizing each
        # finite rotation cycle leaves only 2x2 concentration matrices to invert.
        freq=(R.T@coords)%N if m else coords.copy()
        permutation=freq[1]*N+freq[0];seen=set();blocks=[]
        # At an amplitude-constrained Hopf seed, the exact homogeneous block
        # is singular. A small feed offset regularizes this preconditioner;
        # the shooting equation itself always uses the requested feed.
        precondition_feed=F-1e-5 if fix_amplitude else F
        eu,ev=equilibrium(precondition_feed);duration=T*fraction
        vv=ev*ev;uv=eu*ev
        if args.precondition_state_mean:
            components=initial.reshape(2,S);vv=float(np.mean(components[1]**2));uv=float(np.mean(components[0]*components[1]))
        for first in range(S):
            if first in seen:continue
            orbit=[];at=first
            while at not in seen:seen.add(at);orbit.append(at);at=int(permutation[at])
            ky,kx=divmod(first,N)
            eigenlap=2/(3*h*h)*(2*np.cos(2*np.pi*kx/N)+2*np.cos(2*np.pi*ky/N)+2*np.cos(2*np.pi*(kx+ky)/N)-6)
            A=np.array([[-vv-precondition_feed+Du*eigenlap,-2*uv],[vv,2*uv-precondition_feed-k+Dv*eigenlap]])
            E=expm(A*duration);ell=len(orbit)
            inverse=np.asarray([np.linalg.inv(E-np.exp(2j*np.pi*j/ell)*np.eye(2)) for j in range(ell)])
            blocks.append((np.asarray(orbit),inverse))
        def approximate_inverse(reduced):
            full=reduced[expand].reshape(2,N,N)
            hat=np.fft.fft2(full).reshape(2,S);out=np.empty_like(hat)
            for orbit,inverse in blocks:
                coeff=np.fft.fft(hat[:,orbit],axis=1)
                result=np.einsum('jab,bj->aj',inverse,coeff)
                out[:,orbit]=np.fft.ifft(result,axis=1)
            return np.fft.ifft2(out.reshape(2,N,N)).real.reshape(-1)[reps]
        flowed=flow(initial,duration,F)
        period_column=(flow(flowed,.001,F)-flowed)/.001*duration
        columns=[period_column[reps]]
        if fix_amplitude:
            columns.append(((flow(initial,duration,F+1e-7)-flow(initial,duration,F-1e-7))/(2e-7)*.004)[reps])
        ab=np.stack([approximate_inverse(col) for col in columns],axis=1)
        def constraints(reduced):
            full=reduced[expand]
            return np.r_[np.dot(full,tangent),np.mean(full*direction)] if fix_amplitude else np.array([np.dot(full,tangent)])
        schur=np.stack([constraints(ab[:,j]) for j in range(ab.shape[1])],axis=1)
        def precondition(rhs):
            size=ab.shape[1];ar=approximate_inverse(rhs[:-size]);t=np.linalg.solve(schur,constraints(ar)-rhs[-size:])
            return np.r_[ar-ab@t,t]
        options['jac_options']['inner_M']=LinearOperator((len(z),len(z)),matvec=precondition,dtype=float)
    if args.export_initial:
        accepted=float(np.sqrt(np.mean(residual(z)**2)))<=1e-9
        fit=SimpleNamespace(x=z,success=accepted,message='Independent native shooting accepted the supplied state.' if accepted else 'The supplied state failed independent native shooting; no export produced.')
    else:fit=root(residual,z,method=args.method,options=options)
    state=fit.x[:len(reps)][expand];T=float(np.exp(fit.x[len(reps)]));F=float(.004*fit.x[-1] if fix_amplitude else args.feed)
    rms=float(np.sqrt(np.mean(residual(fit.x)**2)))
    report={'schema':'scott-gray-p6-search-candidate-v1','charge':m,'spatialMode':args.mode,'spatialShell':args.shell,'rootConverged':bool(fit.success),'rootMessage':fit.message,'shootingRms':rms,'calls':calls,'elapsedSeconds':time.time()-started,'initialSource':initial_source,'method':'Unprojected triangular-lattice RK4 twisted shooting with time phase condition','nonlinearSolver':'Fourier-block preconditioned Newton–Krylov' if args.method=='krylov' else 'Dense finite-difference Newton (MINPACK hybr)','hopfFeed':hopf,'prescribedAmplitude':args.amplitude if fix_amplitude else None,'caveat':'Unaudited finite-grid numerical candidate; requires independent verification of exported bytes.'}
    report['spatialWavevector']=[a,b]
    report['spatialShell']=a*a+a*b+b*b if args.wavevector else args.shell
    report['seedSquaredWaveNumber']=a*a+a*b+b*b
    report['reflectedMix']=args.reflected_mix
    report['mixPhase']=args.mix_phase
    report['instantaneousMirrorAxis']=args.mirror_axis
    report['preconditionStateMean']=args.precondition_state_mean
    report['exportInitial']=args.export_initial
    if args.export_initial:report['nonlinearSolver']='No new nonlinear solve; independent native shooting verification of the supplied corrected state.'
    report['searchSettings']={'N':N,'M':M,'feed':args.feed,'kill':k,'L':L,'charge':m,'mode':args.mode,'shell':args.shell,'wavevector':[a,b],'reflectedMix':args.reflected_mix,'mixPhase':args.mix_phase,'instantaneousMirrorAxis':args.mirror_axis,'predictor':args.predictor,'method':args.method,'preconditionStateMean':args.precondition_state_mean,'seedTranslations':args.seed_translations,'translationRepeats':repeat,'thirdTranslation':bool(third)}
    if rms>1e-9:
        (args.output/'failed.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));return
    frames=[];q=state.copy()
    for j in range(M):frames.append(q);q=flow(q,T/M,F,dt=.1)
    field=np.asarray(frames).reshape(M,2,N,N)
    spatial=float(np.sqrt(np.mean((field-field.mean(axis=(2,3),keepdims=True))**2)))
    temporal=float(np.sqrt(np.mean((field-field.mean(axis=0,keepdims=True))**2)))
    checks=[]
    for dt in [.2,.1,.05]:checks.append({'dtLimit':dt,'closureRms':float(np.sqrt(np.mean((flow(state,T,F,dt)-state)**2)))})
    ops=[{'M':np.linalg.matrix_power(R,a).tolist(),'v':[0,0],'s':1,'tau':(m*a%6)/6} for a in range(6)]
    phase_metrics=[]
    for a in range(1,6):
        moved=field.reshape(M,2,S)[:,:,mapping(a)]
        offset=(M*m*a//6)%M
        phase_metrics.append({'rotationDegrees':60*a,'tau':(m*a%6)/6,'spaceTimeRms':float(np.sqrt(np.mean((np.roll(moved,-offset,axis=0)-field.reshape(M,2,S))**2))),'sameTimeRms':float(np.sqrt(np.mean((moved-field.reshape(M,2,S))**2)))})
    gid={0:'g243',1:'g248',2:'g244',3:'g246'}[m]
    config={'N':N,'M':M,'period':T,'L':L,'groupId':gid,'ops':ops,'params':{'F':F,'k':k,'Du':Du,'Dv':Dv,'dx':h,'stencil':'triangular-six'},'minTemporal':.008,'minSpatial':.012}
    report.update(config=config,period=T,temporalRms=temporal,spatialRms=spatial,fullReturnRms=float(np.sqrt(np.mean((q-state)**2))),independentStepChecks=checks,generatorMetrics=phase_metrics,minimum=float(field.min()),maximum=float(field.max()),fieldUrl='candidate.f64',fieldEncoding='float64-le')
    field.astype('<f8').tofile(args.output/'candidate.f64');field.astype('<f4').tofile(args.output/'candidate.f32')
    (args.output/'candidate.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))


if __name__=='__main__':main()
