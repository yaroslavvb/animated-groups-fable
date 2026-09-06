#!/usr/bin/env python3
"""Materialize independently admitted wallpaper movies and a browser-only catalog."""
import argparse,hashlib,json,shutil,subprocess,os
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
from PIL import Image
from audit import attach_forward_bounds
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent

def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(obj):return json.dumps(obj,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()

def thumbnail(field,output,lattice,palette):
 n=field.shape[-1];size=160;y,x=np.indices((size,size));xx=(x+.5)/size*2;yy=(y+.5)/size*2
 if lattice=='triangular':yy=yy/(np.sqrt(3)/2);xx=xx+yy*.5
 channel=1 if palette=='concentration' else 0;grid=field[0,channel];lo,hi=float(field[:,channel].min()),float(field[:,channel].max());xf=(xx*n)%n;yf=(yy*n)%n;ix=np.floor(xf).astype(int);iy=np.floor(yf).astype(int);fx=xf-ix;fy=yf-iy
 if lattice=='triangular':
  q00=grid[iy,ix];q10=grid[iy,(ix+1)%n];q01=grid[(iy+1)%n,ix];q11=grid[(iy+1)%n,(ix+1)%n]
  values=np.where(fx>=fy,(1-fx)*q00+(fx-fy)*q10+fy*q11,(1-fy)*q00+(fy-fx)*q01+fx*q11)
 else:values=sum(grid[(iy+dy)%n,(ix+dx)%n]*(fx if dx else 1-fx)*(fy if dy else 1-fy) for dy in [0,1] for dx in [0,1])
 values=np.clip((values-lo)/(hi-lo),0,1)

 stops=np.array({'ember':[[0,18,9,39],[.22,65,12,94],[.43,99,25,116],[.58,171,45,90],[.69,240,111,32],[.78,252,181,42],[.89,253,219,94],[1,252,242,158]],'ceramic':[[0,91,64,57],[.15,171,111,87],[.33,247,159,119],[.48,239,175,130],[.59,77,41,97],[.68,37,47,120],[.77,117,125,180],[.86,208,213,235],[1,252,249,238]],'concentration':[[0,18,18,24],[1,245,245,251]]}[palette])
 rgb=np.stack([np.interp(values,stops[:,0],stops[:,i]) for i in [1,2,3]],axis=2).astype(np.uint8);Image.fromarray(rgb).save(output)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--subgroups',type=Path,required=True);p.add_argument('--batch',action='append',type=Path,default=[]);p.add_argument('--output',type=Path,default=ROOT/'data/wallpaper-atlas.json');a=p.parse_args()
 definitions=json.loads((ROOT/'wallpaper-groups.json').read_text());groups={g['id']:g for g in definitions['groups']};outdir=ROOT/'data/wallpaper-orbits';outdir.mkdir(exist_ok=True)
 verifier_files=['audit.py','search.py','../gray_scott_rk4.cpp','../p6/gray_scott_triangular.cpp','audit_subgroups.py','check_source_certificates.mjs'];verifier=sha(b''.join((HERE/name).read_bytes() for name in verifier_files));records=defaultdict(list);attempts=Counter();outcomes=defaultdict(Counter)
 candidates={}
 for batch in a.batch:
  summary=json.loads((batch/'batch.json').read_text())
  for row in summary['results']:
   folder=batch/row['id'];reportpath=folder/'candidate.json';failed=folder/'failed.json';report=json.loads((reportpath if reportpath.exists() else failed).read_text()) if reportpath.exists() or failed.exists() else {}
   gid=report.get('groupId') or row['id'].split('-')[0];attempts[gid]+=1;outcomes[gid][row['outcome']]+=1
   ap=folder/'audit.json'
   if not reportpath.exists() or not ap.exists():continue
   proof=attach_forward_bounds(json.loads(ap.read_text()))
   if not proof['passed'] or report['config']['N']<24:continue
   # Prefer the spatially refined continuation of the same seed branch.
   key=(gid,row['id'].replace('-refine24','').replace('-refine36',''))
   if key not in candidates or report['config']['N']>candidates[key][0]['config']['N']:candidates[key]=(report,proof,folder)
 for report,proof,folder in candidates.values():
  c=report['config'];g=groups[c['groupId']];payload=(folder/report['fieldUrl']).read_bytes();digest=sha(payload);relative=f'data/wallpaper-orbits/{digest[:20]}.f32';target=ROOT/relative
  if not target.exists():target.write_bytes(payload)
  field=np.frombuffer(payload,dtype='<f4').reshape(c['M'],2,c['N'],c['N']);thumbs={}
  for palette in ['ember','ceramic','concentration']:
   thumb=f'data/wallpaper-orbits/{digest[:20]}-{palette}.png';thumbnail(field,ROOT/thumb,g['lattice'],palette);thumbs[palette]=thumb
  metadata=f"data/wallpaper-orbits/{g['id']}-{digest[:20]}-{sha(encoded(c))[:12]}.json";(ROOT/metadata).write_bytes(encoded({**report,'schema':'scott-gray-orbit-binary-v1','independentlyVerified':True,'wallpaperVerification':proof,'fieldUrl':target.name,'fieldSha256':digest,'fieldByteLength':len(payload),'fieldValueCount':len(payload)//4,'fieldLayout':'frame-major; planar U then V; x-fast; lattice nodes i/N,j/N'}))
  records[g['id']].append({'id':f"wallpaper:{g['id']}:{digest[:16]}",'groupId':g['id'],'config':c,'fieldUrl':relative,'metadataUrl':metadata,'fieldSha256':digest,'fieldByteLength':len(payload),'fieldValueCount':len(payload)//4,'fieldEncoding':'float32-le','ranges':{'u':[float(field[:,0].min()),float(field[:,0].max())],'v':[float(field[:,1].min()),float(field[:,1].max())]},'thumbnails':thumbs,'name':f"Periodic wave ({report['job']['wave'][0]}, {report['job']['wave'][1]})",'patternName':f"Periodic wave ({report['job']['wave'][0]}, {report['job']['wave'][1]})",'wallpaperVerification':proof,'provenance':{'kind':'new-shooting','method':report['method'],'searchJob':report['job'],'shootingRms':report['shootingRms'],'rootConverged':report['rootConverged'],'finiteGridOnly':True}})
 for result in json.loads(a.subgroups.read_text())['results']:
  g=groups[result['groupId']]
  for hit in result['hits']:
   s=hit['source'];c={**s['config'],'groupId':g['id'],'ops':g['ops']};base='' if hit['sourceFamily']=='p4' else hit['sourceFamily'];entry={k:s[k] for k in ['fieldSha256','fieldByteLength','fieldValueCount','fieldEncoding','ranges','name','patternName'] if k in s}
   records[g['id']].append({**entry,'id':f"wallpaper:{g['id']}:{s['fieldSha256'][:16]}",'groupId':g['id'],'config':c,'fieldUrl':hit['sourceFieldUrl'],'metadataUrl':hit['sourceMetadataUrl'],'thumbnails':{key:str(Path(base)/url) for key,url in s['thumbnails'].items()},'wallpaperVerification':hit['wallpaperVerification'],'provenance':{'kind':'audited-subgroup','sourceOrbitId':s['id'],'sourceGroupId':s['groupId'],'sourceMetadataUrl':hit['sourceMetadataUrl'],'method':'Exact original saved field; canonical target operations and all-phase visibility independently rechecked. The field may have additional symmetries.','sourceOfflineVerification':s['offlineVerification'],'finiteGridOnly':True}})
 orbits=[]
 for gid,rows in records.items():
  seen=set()
  for r in rows:
   if r['fieldSha256'] in seen:continue
   r['wallpaperVerification']=attach_forward_bounds(r['wallpaperVerification'])
   if not r['wallpaperVerification']['passed']:raise ValueError('Forward target phase bound rejected '+r['id'])
   seen.add(r['fieldSha256']);g=groups[gid];r['classification']='time-shift-orbit' if g['hasTimeShift'] else 'zero-offset-reference';r['lattice']=g['lattice'];r['family']=g['family'];r['config']={**r['config'],'groupId':gid,'ops':g['ops']};r['offlineVerification']={'gateVersion':'wallpaper-offline-v1','passed':True,'fieldSha256':r['fieldSha256'],'configSha256':sha(encoded(r['config'])),'verificationCodeSha256':verifier};r['diagnostics']={key:r['wallpaperVerification'][key] for key in ['spatialRms','temporalRms','minimum','maximum']};orbits.append(r)
   if len(seen)>=20:break
 # Match the browser's JSON.stringify number serialization exactly.
 js="const crypto=require('crypto');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(c=>crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex')))));"
 config_hashes=json.loads(subprocess.run([os.environ.get('NODE','node'),'-e',js],input=encoded([r['config'] for r in orbits]),capture_output=True,check=True).stdout)
 for r,digest in zip(orbits,config_hashes):r['offlineVerification']['configSha256']=digest
 counts=Counter(r['groupId'] for r in orbits);searchResults=[]
 subgroups={r['groupId']:r for r in json.loads(a.subgroups.read_text())['results']}
 for g in definitions['groups']:
  if g['family'] in ['p4','p6']:continue
  searchResults.append({'groupId':g['id'],'family':g['family'],'attempts':attempts[g['id']],'outcomes':dict(outcomes[g['id']]),'auditedExistingFields':subgroups[g['id']]['tested'],'admitted':counts[g['id']],'newShootingPatterns':sum(r['groupId']==g['id'] and r['provenance']['kind']=='new-shooting' for r in orbits),'status':('zero-offset-reference' if not g['hasTimeShift'] else 'verified') if counts[g['id']] else 'search-unresolved','reason':'No converged candidate was admitted within this bounded search; this is not evidence of impossibility.' if not counts[g['id']] else None})
 catalog={'schema':'scott-gray-wallpaper-atlas-v1','gateVersion':'wallpaper-offline-v1','groupsSha256':sha((ROOT/'wallpaper-groups.json').read_bytes()),'verificationCodeSha256':verifier,'verificationSources':verifier_files,'scope':'Saved finite-grid periodic Gray–Scott orbits. New shooting results and existing-field subgroup witnesses are distinguished in provenance. Zero-offset reference rows are not described as time-shift examples.','orbits':orbits,'searchResults':searchResults}
 referenced_metadata={r['metadataUrl'] for r in orbits}
 for path in outdir.glob('*.json'):
  if str(path.relative_to(ROOT)) not in referenced_metadata:path.unlink()
 a.output.write_bytes(encoded(catalog));print(json.dumps({'orbits':len(orbits),'new':sum(r['provenance']['kind']=='new-shooting' for r in orbits),'groupCounts':dict(counts),'bytes':a.output.stat().st_size},indent=2))

if __name__=='__main__':main()
