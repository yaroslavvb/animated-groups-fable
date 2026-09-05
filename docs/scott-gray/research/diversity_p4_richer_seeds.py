"""Prepare reciprocal-star seeds for the bounded common-F=.0038 search.

The N16 roots only seed N48 correction. Neither interpolation nor a Hopf
amplitude prediction is admitted as a verified solution.
"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from scipy.optimize import brentq
from scipy.signal import resample

HERE=Path(__file__).resolve().parent
OUT=Path('/tmp/p4-diversity-rich-seeds')
WAVES=[(3,2),(4,0),(4,1),(3,3),(4,2)]
cases=[]
for charge in (2,1):
 for wave in WAVES:
  for mix in ([0,1] if wave in [(3,2),(4,1),(4,2)] else [0]):
   name=f'{"standing" if charge==2 else "rotating"}-{wave[0]}{wave[1]}-{"woven" if mix else "single"}-F0038'
   cases.append((name,charge,wave,mix))

def eq(feed):
 u=(1-np.sqrt(1-4*(feed+.02)**2/feed))/2
 return np.array([u,feed*(1-u)/(feed+.02)])
def hopf(N,wave):
 lam=-4*sum(np.sin(np.pi*k/N)**2 for k in wave)/(256/N)**2
 return brentq(lambda F:.02-eq(F)[1]**2+.24*lam,.0025,.0043)
def run(case):
 name,charge,wave,mix=case;folder=OUT/name;coarse=folder/'seed16';coarse.mkdir(parents=True,exist_ok=True)
 args=[sys.executable,str(HERE/'diversity_p4_search.py'),'--charge',str(charge),'--wave',*map(str,wave),'--mix',str(mix),'--grid','16','--amplitude','.018','--method','hybr','--output',str(coarse)]
 unrestricted=charge==2 and wave!=(4,0)
 if unrestricted:args.append('--unrestricted')
 if not (coarse/'candidate.json').exists():
  try:
   with open(coarse/'run.log','w') as log:subprocess.run(args,stdout=log,stderr=subprocess.STDOUT,timeout=160,check=True)
  except (subprocess.TimeoutExpired,subprocess.CalledProcessError) as e:
   print(name,str(e),flush=True);return None
 if not (coarse/'candidate.json').exists():print(name,'coarse root failed',flush=True);return None
 report=json.loads((coarse/'candidate.json').read_text());cfg=report['config'];F=cfg['params']['F'];newF=hopf(48,wave)-(hopf(16,wave)-F)
 q=np.fromfile(coarse/report['fieldUrl'],dtype='<f8',count=512).reshape(2,16,16)
 q=resample(resample(q,48,axis=1),48,axis=2).real+eq(newF)[:,None,None]-eq(F)[:,None,None]
 if not .0038<=newF<=.00403 or q.min()<=0 or report['shootingRms']>1e-9:print(name,'invalid lifted seed',newF,q.min(),flush=True);return None
 cfg={**cfg,'N':48,'params':{**cfg['params'],'F':newF,'dx':256/48}}
 q.astype('<f8').tofile(folder/'seed48.f64')
 lifted={**report,'config':cfg,'fieldUrl':'seed48.f64','fieldEncoding':'float64-le','seedOnly':True,'sourceSeed':str(coarse/'candidate.json'),'note':'Fourier-interpolated guess with equilibrium shift; requires independent correction and verification.'}
 (folder/'seed48.json').write_text(json.dumps(lifted,indent=2))
 entry={'name':name,'path':str(folder/'seed48.json'),'targets':[.0038],'axialMirrors':charge==2 and not unrestricted,'maxNewton':12}
 print(name,'ready',newF,report['shootingRms'],flush=True);return entry
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=2) as pool:ready=[x for x in pool.map(run,cases) if x]
 Path('/tmp/p4-diversity-gpu-inputs10.json').write_text(json.dumps(ready,indent=2))
 print('READY',len(ready),flush=True)
