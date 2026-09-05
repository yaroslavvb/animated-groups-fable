#!/usr/bin/env python3
"""Bounded, local-only diversity study; does not publish or verify new orbits.

Default: count unstable oscillatory reciprocal stars and construct mixed-star
seeds that have no accidental smaller translation cell. --probe adds two
unprojected native twisted-shooting trials (45 s maximum each) on a 12² grid.
NumPy/SciPy and C++ are required only for this research prototype. No Modal API.
"""
import argparse
import ctypes
import itertools
import json
import math
import platform
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np

HERE=Path(__file__).resolve().parent
ROTATIONS={'p4':np.array([[0,-1],[1,0]],dtype=int),'p6':np.array([[1,-1],[1,0]],dtype=int)}

def equilibrium(F,k=.02):
    u=(1-np.sqrt(1-4*(F+k)**2/F))/2
    return np.array([u,F*(1-u)/(F+k)])

def reciprocal_star(k,family):
    R=ROTATIONS[family].T;current=np.asarray(k);out=[]
    while tuple(current) not in out:
        out.append(tuple(int(x) for x in current));current=R@current
    return tuple(sorted(out))

def translation_index(vectors):
    """Index of the reciprocal span in Z²; >1 means a smaller translation cell."""
    return math.gcd(*[abs(a[0]*b[1]-a[1]*b[0]) for a,b in itertools.combinations(vectors,2)])

def dispersion(k,family,N,L,F,kill=.02):
    a,b=2*np.pi*np.asarray(k)/N;dx=L/N
    lap=(2*np.cos(a)+2*np.cos(b)-4)/dx**2 if family=='p4' else 2/(3*dx**2)*(2*np.cos(a)+2*np.cos(b)+2*np.cos(a+b)-6)
    u,v=equilibrium(F,kill)
    A=np.array([[-v*v-F+.16*lap,-2*u*v],[v*v,2*u*v-F-kill+.08*lap]])
    vals,vecs=np.linalg.eig(A);index=int(np.argmax(vals.imag));return lap,vals[index],vecs[:,index]/vecs[0,index]

def band(family,F,L,N):
    stars={}
    for a in range(-N//3,N//3+1):
        for b in range(-N//3,N//3+1):
            if not (a or b):continue
            star=reciprocal_star((a,b),family)
            if star in stars:continue
            lap,eigen,_=dispersion((a,b),family,N,L,F)
            if eigen.real<=0 or abs(eigen.imag)<1e-10:continue
            positive=[(x,y) for x,y in star if x>=y>=0]
            representative=min(positive) if positive else (a,b)
            stars[star]={'wavevector':representative,'Q':a*a+b*b+(a*b if family=='p6' else 0),'growthRate':float(eigen.real),'period':float(2*np.pi/eigen.imag),'translationIndex':translation_index(star)}
    geometric={};pairs=[]
    for star,entry in stars.items():
        reflected=reciprocal_star(star[0][::-1],family);key=min(star,reflected);geometric.setdefault(key,entry)
        if reflected in stars and star<reflected:
            pairs.append({'Q':entry['Q'],'stars':[stars[star]['wavevector'],stars[reflected]['wavevector']],'combinedTranslationIndex':translation_index(list(star)+list(reflected))})
    return {'family':family,'F':F,'k':.02,'L':L,'N':N,'Du':.16,'Dv':.08,'CyclicStars':len(stars),'geometricStarTypes':len(geometric),
        'types':sorted(geometric.values(),key=lambda x:(x['Q'],x['wavevector'])),'degenerateMixedStarPairs':sorted(pairs,key=lambda x:x['Q'])}

def character_mode(N,family,charge,k):
    R=ROTATIONS[family];order=4 if family=='p4' else 6;y,x=np.indices((N,N));coords=np.array([x.reshape(-1),y.reshape(-1)])/N
    return sum(np.exp(2j*np.pi*charge*j/order)*np.exp(2j*np.pi*(np.asarray(k)@np.linalg.matrix_power(R,j)@coords)) for j in range(order)).reshape(N,N)/order

def mixed_seed(N=12,L=256,F=.00395,ratio=1.,relative_phase=0.):
    _,eigen,vector=dispersion((2,1),'p6',N,L,F)
    psi=character_mode(N,'p6',1,(2,1))+ratio*np.exp(1j*relative_phase)*character_mode(N,'p6',1,(1,2))
    direction=np.real(vector[:,None,None]*psi);direction/=np.sqrt(np.mean(direction**2))
    state=equilibrium(F)[:,None,None]+.045*direction
    return state.reshape(-1),float(2*np.pi/eigen.imag)

def seed_checks():
    N=24;y,x=np.indices((N,N));coords=np.array([x.reshape(-1),y.reshape(-1)]);R=ROTATIONS['p6'];xy=R@coords%N;mapidx=xy[1]*N+xy[0]
    results=[]
    for ratio in [.5,1,2]:
        for relative_phase in [0,np.pi/2]:
            psi=character_mode(N,'p6',1,(2,1))+ratio*np.exp(1j*relative_phase)*character_mode(N,'p6',1,(1,2))
            error=float(np.max(np.abs(psi.reshape(-1)[mapidx]*np.exp(2j*np.pi/6)-psi.reshape(-1))))
            assert error<1e-12
            # Every integer-lattice translation is checked, independent of seed labels.
            translations=[(a,b) for a in range(N) for b in range(N) if np.max(np.abs(np.roll(psi,(a,b),(0,1))-psi))<1e-10]
            assert len(translations)==1
            results.append({'ratio':ratio,'relativePhase':relative_phase,'characterError':error,'instantaneousGridTranslations':translations})
    return results

def shooting_probes():
    from scipy.optimize import root
    N=12;S=N*N;L=256.;F=.00395;k=.02;results=[]
    with tempfile.TemporaryDirectory(prefix='diversity_strategy_') as directory:
        library=Path(directory)/('flow.dylib' if platform.system()=='Darwin' else 'flow.so');flags=['-dynamiclib'] if platform.system()=='Darwin' else ['-shared','-fPIC']
        subprocess.run(['c++','-O3','-std=c++17',*flags,str(HERE/'p6/gray_scott_triangular.cpp'),'-o',str(library)],check=True)
        native=ctypes.CDLL(str(library)).flow;ptr=ctypes.POINTER(ctypes.c_double);native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int]
        def flow(state,duration):
            if not 0<duration<1000:raise ValueError('Trial duration escaped the bounded search window.')
            state=np.ascontiguousarray(state);out=np.empty_like(state);native(state.ctypes.data_as(ptr),out.ctypes.data_as(ptr),N,.16,.08,F,k,L/N,duration,int(np.ceil(duration/.4)))
            if not np.isfinite(out).all():raise ValueError('Nonfinite flow.')
            return out
        y,x=np.indices((N,N));coords=np.array([x.reshape(-1),y.reshape(-1)]);R=ROTATIONS['p6'];p=np.linalg.matrix_power(R,5)@coords%N;inv=p[1]*N+p[0];inv=np.r_[inv,inv+S]
        for phi in [0,np.pi/2]:
            initial,T=mixed_seed(N=N,L=L,F=F,relative_phase=phi);reference=initial.copy();tangent=(flow(initial,.01)-initial)/.01;tangent/=np.linalg.norm(tangent);started=time.monotonic();calls=0
            def residual(z):
                nonlocal calls
                calls+=1
                if calls>1800 or time.monotonic()-started>45:raise TimeoutError('Bounded prototype trial exhausted its evaluation/time budget.')
                state=z[:-1];duration=np.exp(z[-1])/6
                return np.r_[flow(state,duration)-state[inv],np.dot(state-reference,tangent)]
            try:
                fit=root(residual,np.r_[initial,np.log(T)],method='hybr',options={'xtol':1e-9,'maxfev':1600,'factor':.1});state=fit.x[:-1];period=float(np.exp(fit.x[-1]));error=float(np.sqrt(np.mean(residual(fit.x)**2)))
                spatial=float(np.std(state.reshape(2,N,N),axis=(1,2)).mean());same=float(np.sqrt(np.mean((state-state[inv])**2)))
                results.append({'relativePhase':phi,'F':F,'k':k,'L':L,'N':N,'period':period,'shootingRms':error,'spatialRms':spatial,'sameTimeRotationRms':same,'calls':calls,'seconds':time.monotonic()-started,'solverSuccess':bool(fit.success),'message':str(fit.message),'independentlyVerified':False})
            except Exception as error:
                results.append({'relativePhase':phi,'calls':calls,'seconds':time.monotonic()-started,'error':str(error),'independentlyVerified':False})
    return results

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--probe',action='store_true');parser.add_argument('--output',type=Path);args=parser.parse_args()
    result={'scope':'Linear dispersion and bounded unaudited seed prototypes. Star counts are not nonlinear orbit counts.',
        'bandwidth':[band(family,F,L,N) for family in ['p4','p6'] for F,L,N in [(.004,256,48),(.00395,256,48),(.0038,256,48),(.004,512,96),(.00395,512,96),(.004,768,126)]],
        'mixedSeedChecks':seed_checks()}
    if args.probe:result['shootingProbes']=shooting_probes()
    text=json.dumps(result,indent=2)+'\n'
    if args.output:args.output.write_text(text)
    print(text)

if __name__=='__main__':main()
