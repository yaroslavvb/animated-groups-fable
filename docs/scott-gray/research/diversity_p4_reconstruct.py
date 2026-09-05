#!/usr/bin/env python3
"""Reconstruct GPU candidate movies using independent CPU RK4; no phase projection."""
import argparse,ctypes,json,platform,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy.signal import resample
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('--frames',type=int,choices=[128,256]);args=p.parse_args()
library=Path(tempfile.gettempdir())/('p4-diversity-flow.dylib' if platform.system()=='Darwin' else 'p4-diversity-flow.so')
if not library.exists():subprocess.run(['c++','-O3','-std=c++17',*(['-dynamiclib'] if platform.system()=='Darwin' else ['-shared','-fPIC']),str(Path(__file__).with_name('gray_scott_rk4.cpp')),'-o',str(library)],check=True)
lib=ctypes.CDLL(str(library));native=lib.flow;ptr=ctypes.POINTER(ctypes.c_double);native.argtypes=[ptr,ptr,ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int];native.restype=None
for path in sorted(args.directory.glob('*/report.json')):
 report=json.loads(path.read_text())
 if not report['converged'] or not report.get('targetReached',True):continue
 name=('g96' if report['charge']==1 else 'g95')+'-'+report['name']
 if not args.frames and (path.parent/(name+'.json')).exists():continue
 cfg=report['config'];N=cfg['N'];M=args.frames or cfg['M'];cfg['M']=M;T=cfg['period'];p=cfg['params'];state=np.fromfile(path.parent/'initial.f64',dtype='<f8')
 def flow(q,t,dt=.1):
  q=np.ascontiguousarray(q);out=np.empty_like(q);native(q.ctypes.data_as(ptr),out.ctypes.data_as(ptr),N,p['Du'],p['Dv'],p['F'],p['k'],p['dx'],t,int(np.ceil(t/dt)));return out
 q=state.copy();frames=[]
 for j in range(M):frames.append(q.copy());q=flow(q,T/M)
 field=np.array(frames).reshape(M,2,N,N);space=float(np.sqrt(np.mean((field-field.mean(axis=(2,3),keepdims=True))**2)));motion=float(np.sqrt(np.mean((field-field.mean(axis=0,keepdims=True))**2)))
 checks=[{'dtLimit':dt,'returnRms':float(np.sqrt(np.mean((flow(state,T,dt)-state)**2)))} for dt in [.2,.1,.05]]
 report.update(fieldUrl=name+'.f64',fieldEncoding='float64-le',temporalRms=motion,spatialRms=space,fullReturnRms=float(np.sqrt(np.mean((q-state)**2))),independentStepChecks=checks,minimum=float(field.min()),maximum=float(field.max()),seed='Reciprocal-star branch corrected using batched full-state GPU shooting. See source and wave/mix metadata.')
 source=json.loads(Path(report['source']).read_text());coarse_path=source.get('sourceCoarse')
 if coarse_path:
  coarse=json.loads(Path(coarse_path).read_text());cc=coarse['config']
  if all(cc['params'][key]==cfg['params'][key] for key in ['F','k','Du','Dv']):
   cn=cc['N'];cf=np.fromfile(Path(coarse_path).parent/coarse['fieldUrl'],dtype='<f8').reshape(cc['M'],2,cn,cn)
   reduced=resample(resample(field,cn,axis=2),cn,axis=3).real
   if cc['M']!=M:reduced=resample(reduced,cc['M'],axis=0).real
   diff=reduced-cf
   report['spatialRefinement']={'coarseGrid':cn,'fineGrid':N,'physicalSide':N*p['dx'],'coarsePeriod':cc['period'],'finePeriod':T,'relativePeriodDifference':abs(T/cc['period']-1),'fieldRmsDifference':float(np.sqrt(np.mean(diff*diff))),'relativeToCoarseTemporalRms':float(np.sqrt(np.mean(diff*diff)))/coarse['temporalRms'],'comparison':'Unprojected whole normalized-phase movies, Fourier reduced to coarse grid.'}
 field.astype('<f8').tofile(path.parent/(name+'.f64'));(path.parent/(name+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps({'metadata':str(path.parent/(name+'.json')),'F':p['F'],'T':T,'spatialRms':space,'temporalRms':motion,'returnRms':report['fullReturnRms']}),flush=True)
