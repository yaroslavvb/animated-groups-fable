#!/usr/bin/env python3
"""Audit existing periodic fields as transparent subgroup witnesses; never relabel a failing field."""
import json,hashlib,sys,concurrent.futures,subprocess,os
from pathlib import Path
import numpy as np
from audit import symmetry,audit
ROOT=Path(__file__).resolve().parent.parent.parent

def worker(arg):
 group,sources=arg;hits=[];tested=0
 for source,base in sources:
  c=source['config'];N,M=c['N'],c['M']
  if N%group['meshMultiple'] or M%group['frameMultiple']:continue
  path=ROOT/base/source['fieldUrl'];payload=path.read_bytes()
  if hashlib.sha256(payload).hexdigest()!=source['fieldSha256'] or source['offlineVerification']['fieldSha256']!=source['fieldSha256']:raise ValueError('Source hash/certificate mismatch')
  field=np.frombuffer(payload,dtype='<f4').reshape(M,2,N,N).astype(float);tested+=1
  if not symmetry(field,group['ops'],quick=True)['passed']:continue
  inherited={'passed':source['offlineVerification']['passed'],'method':'Previously independently integrated exact saved Float32 bytes; source certificate retained without change.','sourceOfflineVerification':source['offlineVerification'],'sourceDiagnostics':source['diagnostics']}
  result=audit(field,c,group,dynamics=inherited)
  if result['passed']:
   hits.append({'sourceId':source['id'],'sourceFamily':base or 'p4','sourceFieldUrl':str(Path(base)/source['fieldUrl']),'sourceMetadataUrl':str(Path(base)/source['metadataUrl']),'source':source,'wallpaperVerification':result})
   if len(hits)>=12:break
 return {'groupId':group['id'],'family':group['family'],'tested':tested,'hits':hits}

if __name__=='__main__':
 subprocess.run([os.environ.get('NODE','node'),str(Path(__file__).with_name('check_source_certificates.mjs'))],check=True)
 groups=json.loads((ROOT/'wallpaper-groups.json').read_text())['groups'];sources=[]
 for family,base in [('square',''),('triangular','p6')]:
  rows=json.loads((ROOT/base/'data/precomputed-atlas.json').read_text())['orbits']
  # Different seed waves first; then additional parameters. Retain original field identity.
  rows.sort(key=lambda r:(r['config']['N'],r['id']))
  sources.append((family,[(r,base) for r in rows]))
 jobs=[(g,next(s for f,s in sources if f==g['lattice'])) for g in groups if g['family'] not in ['p4','p6']]
 out=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=3) as pool:
  for result in pool.map(worker,jobs):out.append(result);print(result['groupId'],result['tested'],len(result['hits']),flush=True);Path(sys.argv[1]).write_text(json.dumps({'schema':'wallpaper-subgroup-audit-v1','results':out},separators=(',',':')))
