"""Append complete independently reconstructed refinement pairs to local manifests."""
import argparse,json,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('--ready',type=Path,default=Path('/tmp/p4-diversity-ready.json'));p.add_argument('--quality',type=Path,default=Path('/tmp/p4-diversity-quality-ready.json'));a=p.parse_args()
ready=json.loads(a.ready.read_text()) if a.ready.exists() else {'cases':[]};quality=json.loads(a.quality.read_text()) if a.quality.exists() else {'cases':[]}
for path in sorted(a.directory.glob('*/g9*-*.json')):
 r=json.loads(path.read_text());source=json.loads(Path(r['source']).read_text());coarse=source.get('sourceCoarse')
 if not coarse or not r['converged'] or not r.get('targetReached',True):continue
 c=json.loads(Path(coarse).read_text());cfg=r['config'];cc=c['config']
 assert cfg['N']>cc['N'] and cfg['M']==cc['M'] and all(cfg['params'][key]==cc['params'][key] for key in ['F','k','Du','Dv'])
 base=re.sub(r'-N\d+$','',r['name']);identifier='p4-'+base+'-f'+str(cfg['params']['F']).replace('.','p')
 label=base.replace('-F0038','').replace('-',' ').capitalize()
 entry={'family':'p4','coarse':coarse,'fine':str(path),'id':identifier,'name':label}
 if identifier in {x['id'] for x in ready['cases']}:
  previous=next(x for x in ready['cases'] if x['id']==identifier)
  if previous['fine']==str(path):continue
  entry['replacesSameBranchAtN48']=True;target=quality
 else:target=ready
 if not any(e['id']==identifier and e['fine']==str(path) for e in target['cases']):target['cases'].append(entry);print(json.dumps(entry),flush=True)
for target,destination in [(ready,a.ready),(quality,a.quality)]:
 temporary=destination.with_suffix('.tmp');temporary.write_text(json.dumps(target,indent=2));temporary.replace(destination)
