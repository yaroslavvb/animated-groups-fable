"""Screen nonzero-time rotations across every linearly interpolated frame interval.

This independent source-Float64 screen complements the exported-Float32 atlas
gate. A passing contrast is not evidence of PDE correctness by itself.
"""
import argparse,json
from pathlib import Path
import numpy as np
from morphology import read_movie

def contrast(path):
 meta,field=read_movie(path);cfg=meta['config'];N=cfg['N'];M=cfg['M'];y,x=np.indices((N,N));coords=np.array([x.ravel(),y.ravel()]);results=[]
 scale=np.sqrt(np.mean((field-field.mean(axis=(2,3),keepdims=True))**2,axis=(0,2,3)))
 for op in cfg['ops']:
  if abs(float(op['tau'])%1)<1e-10 or np.array_equal(op['M'],np.eye(2,dtype=int)):continue
  mapped=np.asarray(op['M'])@coords+np.asarray(op.get('v',[0,0]))[:,None]*N
  if np.max(abs(mapped-np.round(mapped)))>1e-9:raise ValueError('This source screen requires exact lattice transforms.')
  mapped=np.round(mapped).astype(int)%N
  d=field.reshape(M,2,N*N)[:,:,mapped[1]*N+mapped[0]]-field.reshape(M,2,N*N)
  delta=np.roll(d,-1,axis=0)-d
  species=[]
  for s in range(2):
   aa=np.mean(delta[:,s]**2,axis=1);bb=np.mean(d[:,s]*delta[:,s],axis=1);alpha=np.clip(-bb/np.maximum(aa,1e-30),0,1)
   values=np.sqrt(np.mean((d[:,s]+alpha[:,None]*delta[:,s])**2,axis=1));at=int(np.argmin(values));absolute=float(values[at]);relative=absolute/float(scale[s])
   species.append({'species':'U' if s==0 else 'V','minimumRms':absolute,'relativeToWholeOrbitSpatialRms':relative,'phase':float((at+alpha[at])/M),'passes':absolute>=.002 and relative>=.20})
  results.append({'operator':op,'species':species})
 return {'metadata':str(path),'passes':bool(results) and all(s['passes'] for op in results for s in op['species']),'criteria':{'minAbsoluteRms':.002,'minRelativeRms':.20,'interpolation':'Exact minimum of each frame interval quadratic norm'},'rotations':results}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('paths',nargs='+',type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
 results=[contrast(path) for path in a.paths]
 if a.output:a.output.write_text(json.dumps(results,indent=2))
 for r in results:print(r['metadata'],r['passes'],min(s['relativeToWholeOrbitSpatialRms'] for op in r['rotations'] for s in op['species']))
