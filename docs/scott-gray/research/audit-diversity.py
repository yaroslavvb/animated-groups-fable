"""Compare newly admitted fields at fixed physical parameters, excluding phase/position copies.
Usage: python audit-diversity.py output.json [--reuse previous-output.json]
"""
import sys,json,itertools,concurrent.futures,hashlib,argparse
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
from morphology import read_movie,orbit_distance
ROOT=Path(__file__).resolve().parent.parent
LAYOUTS={'frame-major; planar U then V; x-fast',
         'frame-major; planar U then V; x-fast; lattice nodes i/N,j/N',
         'frame-major; planar U then V; x-fast; rhombic lattice nodes i/N,j/N'}


def pair(job):
 family,a,b=job
 ma,fa=read_movie(ROOT/a['path']);mb,fb=read_movie(ROOT/b['path'])
 r=orbit_distance(fa,fb,family)
 return {'family':family,'groupId':a['groupId'],'first':a['path'],'second':b['path'],**r}


def collect_records():
 """Re-read every exact Float32 payload before permitting reuse of old comparisons."""
 records=[];jobs=[]
 for family,site,manifest in [('p4',ROOT,'verified-orbits.json'),('p6',ROOT/'p6','candidate-orbits.json')]:
  groups={}
  for e in json.loads((site/'data'/manifest).read_text())['orbits']:
   path=site/e['url'];m=json.loads(path.read_text());c=m['config'];p=c['params']
   if c['groupId']!=e['groupId']:raise ValueError('Manifest and metadata group disagree: '+str(path))
   if m.get('schema')!='scott-gray-orbit-binary-v1' or m.get('fieldEncoding')!='float32-le' or m.get('fieldLayout') not in LAYOUTS:
    raise ValueError('Expected the saved Float32 movie layout: '+str(path))
   if any(not isinstance(c[k],int) or isinstance(c[k],bool) or c[k]<2 for k in ['N','M']):
    raise ValueError('Invalid movie grid dimensions: '+str(path))
   payload=(path.parent/m['fieldUrl']).read_bytes();count=2*c['N']**2*c['M']
   if m.get('fieldValueCount')!=count or m.get('fieldByteLength')!=4*count or len(payload)!=4*count:
    raise ValueError('Saved movie size disagrees with metadata: '+str(path))
   if hashlib.sha256(payload).hexdigest()!=m['fieldSha256']:
    raise ValueError('Actual saved field hash differs from metadata: '+str(path))
   if not np.isfinite(np.frombuffer(payload,dtype='<f4')).all():
    raise ValueError('Saved movie has nonfinite samples: '+str(path))
   r={'family':family,'groupId':e['groupId'],'path':str(path.relative_to(ROOT)),'name':e.get('patternName') or e.get('name') or path.stem,'config':c,'fieldSha256':m['fieldSha256'],'branchId':m.get('provenance',{}).get('branchId'),'new':bool(m.get('diversityAdmission'))}
   key=(e['groupId'],p['F'],p['k'],p['Du'],p['Dv'],c.get('L',c['N']*p['dx']),p.get('stencil','five-point'))
   groups.setdefault(key,[]).append(r);records.append(r)
  for rows in groups.values():
   jobs += [(family,a,b) for a,b in itertools.combinations(rows,2) if a['new'] or b['new']]
 return records,jobs


def reusable_pairs(old,records,code_hash):
 """A cache hit requires both current byte hashes and every configuration field."""
 if old.get('comparisonCodeSha256')!=code_hash:return {}
 cached={};current={r['path']:r for r in records};previous={r['path']:r for r in old['records']}
 for result in old['pairs']:
  paths=[result['first'],result['second']]
  if all(p in current and p in previous and current[p]['fieldSha256']==previous[p]['fieldSha256'] and current[p]['config']==previous[p]['config'] for p in paths):
   cached[(result['family'],result['groupId'],*paths)]=result
 return cached


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('output',type=Path);parser.add_argument('--reuse',type=Path)
 args=parser.parse_args();code_hash=hashlib.sha256((Path(__file__).parent/'morphology.py').read_bytes()).hexdigest()
 records,jobs=collect_records()
 cached=reusable_pairs(json.loads(args.reuse.read_text()),records,code_hash) if args.reuse else {}
 results=[];pending=[]
 for job in jobs:
  family,a,b=job;key=(family,a['groupId'],a['path'],b['path'])
  if key in cached:results.append(cached[key])
  else:pending.append(job)
 reused=len(results);print(len(records),'records',len(jobs),'pairs;',reused,'unchanged pairs reused',flush=True)
 with concurrent.futures.ProcessPoolExecutor(max_workers=3) as pool:
  for result in pool.map(pair,pending):
   results.append(result)
   if result['amplitudeNormalizedShapeRms']<.15:print('CLOSE',result['amplitudeNormalizedShapeRms'],result['first'],result['second'],flush=True)
 results.sort(key=lambda r:(r['family'],r['groupId'],r['first'],r['second']))
 output={'schema':'scott-gray-diversity-comparison-v1','comparisonCodeSha256':code_hash,'scope':'Actual rehashed saved fields at identical group and physical parameters; whole-period continuous phase/position alignment and lattice point-group isometries. Spatial means and overall amplitude scaling removed for shape diagnostic. Finite-resolution numerical distinction, not exhaustive uniqueness proof.','reusedPairs':reused,'reusePolicy':'Matching comparison source hash, actual field hashes and complete configurations required.','records':records,'pairs':results}
 args.output.write_text(json.dumps(output,indent=2)+'\n');print('done',len(results),flush=True)
if __name__=='__main__':main()
