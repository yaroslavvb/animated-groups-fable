#!/usr/bin/env python3
"""Attach mesh-exact primitive translation evidence to the admitted wallpaper atlas.

FFT autocorrelation is a screen only. Each translation is checked directly on
both saved concentration movies, at every phase. Identity always remains; the
recorded group must close under addition for the cell to be used by the viewer.
"""
import importlib.util,json,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'research/build-overlay-translations.py'
spec=importlib.util.spec_from_file_location('overlay_translations',SOURCE)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def attach_cells(manifest):
 cache={}
 for row in manifest['orbits']:
  digest=row['fieldSha256'];N=row['config']['N'];M=row['config']['M']
  if digest not in cache:
   payload=(ROOT/row['fieldUrl']).read_bytes()
   if hashlib.sha256(payload).hexdigest()!=digest:raise ValueError('Field hash mismatch')
   result=module.analyze(np.frombuffer(payload,dtype='<f4').reshape(M,2,N,N));translations=result['translations']
   members={tuple(t['gridShift']) for t in translations}
   for a in members:
    for b in members:
     if ((a[0]+b[0])%N,(a[1]+b[1])%N) not in members:raise ValueError('Numerical translation set is not closed')
   cache[digest]=result
  result=cache[digest]
  row['translations']=result['translations']
  row['translationVerification']={'schema':'wallpaper-spatial-translations-v1','fieldSha256':digest,'N':N,'passed':True,'maximumAbsoluteError':module.MAX_ABSOLUTE_ERROR,'maximumRelativeRms':module.MAX_RELATIVE_RMS,'variationRmsByChannel':result['variationRmsByChannel'],'scope':'Every sample of U and V at every saved phase; these mesh translations preserve the piecewise spatial and temporal playback interpolant.'}
 return manifest

if __name__=='__main__':
 path=ROOT/'data/wallpaper-atlas.json';m=attach_cells(json.loads(path.read_text()));path.write_text(json.dumps(m,separators=(',',':'),ensure_ascii=False)+'\n');print(json.dumps({'orbits':len(m['orbits']),'primitiveCells':{str(n):sum(len(r['translations'])==n for r in m['orbits']) for n in sorted({len(r['translations']) for r in m['orbits']})}}))
