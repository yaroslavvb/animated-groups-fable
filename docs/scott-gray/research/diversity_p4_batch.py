#!/usr/bin/env python3
"""Bounded CPU branch search. Save only candidates; independent admission required."""
import argparse,json,subprocess,sys,time
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--cases',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--workers',type=int,choices=[1,2],default=2);args=p.parse_args()
args.output.mkdir(parents=True,exist_ok=True);cases=json.loads(args.cases.read_text());script=Path(__file__).with_name('diversity_p4_search.py')

def one(case):
 name=case['name'];folder=args.output/name;folder.mkdir(parents=True,exist_ok=True);initial=Path(case['initial']) if case.get('initial') else None;report={'case':case,'stages':[]}
 common=['--charge',str(case['charge']),'--wave',*map(str,case['wave']),'--amplitude',str(case.get('amplitude',.015))]
 if case.get('unrestricted'):common+=['--unrestricted']
 for key in ['mix','mix-phase']:
  if key in case:common+=['--'+key,str(case[key])]
 stages=[('seed',16,None,'hybr'),('coarse',24,case['feed'],'hybr'),('fine',48,case['feed'],'krylov')]
 if initial:stages=stages[1:]
 for stage,N,F,method in stages:
  out=folder/stage;cmd=[sys.executable,str(script),*common,'--grid',str(N),'--output',str(out),'--method',method,'--maxiter','60']
  if F is not None:cmd+=['--feed',str(F)]
  if initial:cmd+=['--initial',str(initial)]
  started=time.time()
  try:
   with open(folder/(stage+'.log'),'w') as log:run=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=180)
   meta=out/'candidate.json'
   if run.returncode or not meta.exists():report['failure']=stage;break
   m=json.loads(meta.read_text());report['stages'].append({'stage':stage,'metadata':str(meta),'seconds':time.time()-started,'rms':m['shootingRms'],'spatial':m['spatialRms'],'temporal':m['temporalRms']})
   initial=meta
   if m['spatialRms']<.008 or m['temporalRms']<.008:report['failure']='Trivial orbit';break
  except subprocess.TimeoutExpired:report['failure']=stage+' timeout';break
 if 'failure' not in report:report['candidate']=str(initial)
 (folder/'result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);return report
results=[]
with ThreadPoolExecutor(max_workers=args.workers) as executor:
 for job in as_completed([executor.submit(one,c) for c in cases]):
  results.append(job.result());(args.output/'results.json').write_text(json.dumps(results,indent=2))
