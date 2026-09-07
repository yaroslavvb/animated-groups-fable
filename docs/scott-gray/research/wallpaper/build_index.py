#!/usr/bin/env python3
"""Rebuild the directory counts from the saved, admitted catalogs."""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def build():
 metadata=json.loads((ROOT/'wallpaper-groups.json').read_text());new=json.loads((ROOT/'data/wallpaper-atlas.json').read_text());records=list(new['orbits'])
 # the 442/632 catalogs are merged into the wallpaper atlas by merge_atlas.py; count them there, not twice
 legacy_in_atlas=any(metadata_group['family'] in ('p4','p6') for metadata_group in metadata['groups'] if any(r['groupId']==metadata_group['id'] for r in records))
 if not legacy_in_atlas:
  for prefix in ['', 'p6/']:records.extend(json.loads((ROOT/prefix/'data/precomputed-atlas.json').read_text())['orbits'])
 def key(r):
  c=r['config'];p=c['params'];return (c.get('model','gray-scott'),json.dumps({k:v for k,v in p.items() if k!='dx'},sort_keys=True),c['L'])
 families=[]
 for f in metadata['families']:
  rows=[r for r in records if r['groupId'] in f['groupIds']];groups=[g for g in metadata['groups'] if g['id'] in f['groupIds']]
  models={}
  for r in rows:models.setdefault(r['config'].get('model','gray-scott'),set()).add(r['fieldSha256'])
  families.append({'id':f['id'],'verifiedPatternCount':len({r['fieldSha256'] for r in rows}),'verifiedExampleCount':len(rows),'verifiedParameterCount':len({key(r) for r in rows}),'timeSymmetryCount':len(groups),'populatedSymmetryCount':len({r['groupId'] for r in rows}),'nonzeroTimeSymmetryCount':sum(g['hasTimeShift'] for g in groups),'verifiedNonzeroTimeSymmetryCount':sum(g['hasTimeShift'] and any(r['groupId']==g['id'] for r in rows) for g in groups),'models':{m:len(v) for m,v in sorted(models.items())}})
 out={'schema':'scott-gray-wallpaper-index-v1','models':{m:len({r['fieldSha256'] for r in records if r['config'].get('model','gray-scott')==m}) for m in ['gray-scott','ginzburg-landau','brusselator']},'wallpaperGroupsSha256':hashlib.sha256((ROOT/'wallpaper-groups.json').read_bytes()).hexdigest(),'uniqueFieldCount':len({r['fieldSha256'] for r in records}),'exampleCount':len(records),'families':families,'counting':'Family pattern counts deduplicate identical field bytes within that family. A field can satisfy several wallpaper subgroups. Examples count separately verified field/group pairs.'}
 (ROOT/'data/wallpaper-atlas-index.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':build()
