#!/usr/bin/env python3
"""Continuous space/time phase comparison of base branches at fixed parameters."""
import argparse,json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from morphology import read_movie,spectrum,orbit_distance
p=argparse.ArgumentParser();p.add_argument('ready',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--workers',type=int,choices=[1,2],default=1);a=p.parse_args()
cases=json.loads(a.ready.read_text())['cases'];rows=[];movies=[]
for c in cases:
 m,f=read_movie(c['fine']);cfg=m['config'];params=cfg['params'];shells=spectrum(f.copy(),'p4');key=(params['F'],params['k'],params['Du'],params['Dv'],cfg['N']*params['dx'])
 rows.append({'id':c['id'],'name':c['name'],'metadata':c['fine'],'group':cfg['groupId'],'parameterKey':key,'period':cfg['period'],'leadingShell':shells[0]['squaredWaveNumber'],'spectrum':shells});movies.append(f)
pairs=[(i,j) for i in range(len(rows)) for j in range(i) if rows[i]['parameterKey']==rows[j]['parameterKey']]
pairs.sort(key=lambda ij:(rows[ij[0]]['leadingShell']!=rows[ij[1]]['leadingShell'],rows[ij[0]]['group']!=rows[ij[1]]['group']))
report={'scope':'Distinct saved base branches at identical physical parameters; full-period two-species shapes, per-frame means removed, D4 and continuously refined spatial/time shifts, no time reversal. This is finite-resolution evidence, not an exhaustive mathematical classification.','records':rows,'pairs':[],'complete':False}
if a.output.exists():
 old=json.loads(a.output.read_text());old_paths={r['id']:r['metadata'] for r in old['records']};paths={r['id']:r['metadata'] for r in rows};valid={key for key in paths if paths[key]==old_paths.get(key)}
 report['pairs']=[d for d in old['pairs'] if d['first'] in valid and d['second'] in valid];cached={frozenset([d['first'],d['second']]) for d in report['pairs']}
 pairs=[(i,j) for i,j in pairs if frozenset([rows[i]['id'],rows[j]['id']]) not in cached]
def save():
 tmp=a.output.with_suffix('.tmp');tmp.write_text(json.dumps(report,indent=2));tmp.replace(a.output)
def compare(pair):
 i,j=pair;d=orbit_distance(movies[i],movies[j],'p4');return {'first':rows[i]['id'],'second':rows[j]['id'],'sameLeadingShell':rows[i]['leadingShell']==rows[j]['leadingShell'],'sameCharacter':rows[i]['group']==rows[j]['group'],**d}
with ThreadPoolExecutor(max_workers=a.workers) as pool:
 for task in as_completed([pool.submit(compare,pair) for pair in pairs]):
  d=task.result();report['pairs'].append(d);save()
  if d['sameLeadingShell'] and d['sameCharacter']:print(json.dumps({k:d[k] for k in ['first','second','amplitudeNormalizedShapeRms','relativeShapeRms']}),flush=True)
report['complete']=True;report['minimumAmplitudeNormalizedShapeRms']=min((d['amplitudeNormalizedShapeRms'] for d in report['pairs']),default=None);save();print(json.dumps({'records':len(rows),'pairs':len(report['pairs']),'minimumShapeDistance':report['minimumAmplitudeNormalizedShapeRms']}),flush=True)
