#!/usr/bin/env python3
"""Independently audit every returned full movie in a local search batch."""
import concurrent.futures,json,sys
from pathlib import Path
import numpy as np
from audit import audit
ROOT=Path(__file__).resolve().parent.parent.parent

def worker(path):
 meta=json.loads(path.read_text());c=meta['config'];g=next(g for g in json.loads((ROOT/'wallpaper-groups.json').read_text())['groups'] if g['id']==c['groupId']);field=np.fromfile(path.parent/meta['fieldUrl'],dtype='<f4').reshape(c['M'],2,c['N'],c['N']);report=audit(field,c,g);(path.parent/'audit.json').write_text(json.dumps(report,indent=2));return {'metadata':str(path),'groupId':c['groupId'],'passed':report['passed'],'spatialRms':report['spatialRms'],'temporalRms':report['temporalRms'],'phasePassed':report['phaseRelations']['passed'],'visibilityPassed':report['visibility']['passed']}

if __name__=='__main__':
 paths=[p for folder in sys.argv[1:-1] for p in Path(folder).glob('*/candidate.json')];out=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=3) as pool:
  for result in pool.map(worker,paths):out.append(result);print(result['groupId'],result['passed'],flush=True);Path(sys.argv[-1]).write_text(json.dumps(out,indent=2))
