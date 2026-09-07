#!/usr/bin/env python3
"""Audit forward/inverse time-offset conventions in every shipped movie.

Reads actual Float32 bytes, not stored pass flags. Checks both concentrations at
all saved phases and grid points against canonical affine operations. No solver,
cloud resources, or user interface modifications are involved.
"""
import argparse,concurrent.futures,hashlib,json,math
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent.parent
SOURCES=[('data/precomputed-atlas.json',''),('p6/data/precomputed-atlas.json','p6'),('data/wallpaper-atlas.json',''),('data/equation-atlas.json','')]
TARGET='equation:brusselator:g139:4edab43428d74fa2'
TOLERANCE=2e-7

def operation_key(op):
 return tuple(int(v) for row in op['M'] for v in row)+tuple(round(float(v)%1,10)%1 for v in op.get('v',[0,0]))+(int(op.get('s',1)),round(float(op.get('tau',0))%1,10)%1)

def operation_map(op,N):
 matrix=np.asarray(op['M'],dtype=float);translation=np.asarray(op.get('v',[0,0]),dtype=float)*N
 if matrix.shape!=(2,2) or np.max(abs(matrix-np.rint(matrix)))>1e-10 or np.max(abs(translation-np.rint(translation)))>1e-7:raise ValueError('Affine operation is not exact on the saved mesh')
 y,x=np.indices((N,N));a,b,c,d=matrix.astype(int).ravel();tx,ty=np.rint(translation).astype(int)
 mapped=(((c*x+d*y+ty)%N)*N+(a*x+b*y+tx)%N).ravel()
 if len(np.unique(mapped))!=N*N:raise ValueError('Affine operation is not a mesh permutation')
 return mapped

def errors(a,b):
 diff=np.asarray(a,dtype=np.float64)-np.asarray(b,dtype=np.float64)
 return {'maximum':float(np.max(abs(diff))),'rms':float(np.sqrt(np.mean(diff**2))),'maximumByChannel':np.max(abs(diff),axis=(0,2)).tolist(),'rmsByChannel':np.sqrt(np.mean(diff**2,axis=(0,2))).tolist()}

def audit_operation(field,op):
 M,_,N,_=field.shape;flat=field.reshape(M,2,N*N);tau=float(op.get('tau',0))%1;steps=tau*M
 if op.get('s',1)!=1 or abs(steps-round(steps))>1e-7:raise ValueError('Operation must advance time by an exact frame shift')
 offset=round(steps)%M;mapped=operation_map(op,N);at=np.arange(M)
 forward=errors(flat[(at+offset)%M][:,:,mapped],flat)
 backward=errors(flat[(at-offset)%M][:,:,mapped],flat)
 same=errors(flat[:,:,mapped],flat)
 # Applying the inverse spatial operation with +tau is equivalent in norm to
 # applying the original spatial operation with -tau, by permutation invariance.
 alias=offset==(-offset)%M
 return {'tau':tau,'forward':forward,'oppositeTimeSign':backward,'sameTime':same,'forwardPassed':forward['maximum']<=TOLERANCE,'oppositeTimeSignPassed':backward['maximum']<=TOLERANCE,'timeDirectionIdentifiable':not alias,'ambiguity':'zero-offset' if offset==0 else 'half-period: +T/2 and -T/2 are the same periodic time' if alias else None}

def audit_payload(job):
 path,expected_hash,rows=job;payload=Path(path).read_bytes();digest=hashlib.sha256(payload).hexdigest()
 if digest!=expected_hash:raise ValueError('Payload SHA mismatch: '+path)
 first=rows[0];N,M=first['N'],first['M']
 if len(payload)!=8*N*N*M:raise ValueError('Wrong payload length')
 field=np.frombuffer(payload,dtype='<f4').reshape(M,2,N,N)
 if not np.isfinite(field).all():raise ValueError('Nonfinite concentrations')
 cache={};results=[]
 for row in rows:
  if row['N']!=N or row['M']!=M:raise ValueError('Identical payload has inconsistent dimensions')
  operations=[]
  for index,op in enumerate(row['ops']):
   key=operation_key(op)
   if key not in cache:cache[key]=audit_operation(field,op)
   operations.append({'operation':index,**cache[key]})
  results.append({key:row[key] for key in ['id','groupId','model','family','N','M','sourceCatalogs','configOperationsMatchCanonical']}|{'fieldSha256':digest,'operations':operations,'passed':row['configOperationsMatchCanonical'] and all(r['forwardPassed'] for r in operations)})
 return {'fieldSha256':digest,'payloadBytes':len(payload),'uniqueOperationsComputed':len(cache),'records':results}

def collect():
 groups={g['id']:g for g in json.loads((ROOT/'wallpaper-groups.json').read_text())['groups']};seen={}
 for relative,base in SOURCES:
  for raw in json.loads((ROOT/relative).read_text())['orbits']:
   key=raw['id'];c=raw['config'];g=groups[raw['groupId']];path=(ROOT/base/raw['fieldUrl']).resolve()
   row={'id':key,'groupId':raw['groupId'],'model':raw.get('model',c.get('model','gray-scott')),'family':g['family'],'N':c['N'],'M':c['M'],'fieldPath':str(path),'fieldSha256':raw['fieldSha256'],'ops':g['ops'],'sourceCatalogs':[relative],'configOperationsMatchCanonical':set(map(operation_key,c['ops']))==set(map(operation_key,g['ops']))}
   if key in seen:
    old=seen[key]
    if (old['fieldSha256'],old['groupId'],old['N'],old['M'])!=(row['fieldSha256'],row['groupId'],row['N'],row['M']):raise ValueError('Same record id disagrees between catalogs')
    old['sourceCatalogs'].append(relative);old['configOperationsMatchCanonical']=old['configOperationsMatchCanonical'] and row['configOperationsMatchCanonical']
   else:seen[key]=row
 jobs=defaultdict(list)
 for row in seen.values():jobs[(row['fieldPath'],row['fieldSha256'])].append(row)
 return [(path,digest,rows) for (path,digest),rows in jobs.items()],groups

def circle_samples(field,centre,radius,angles=720):
 N=field.shape[-1];theta=np.arange(angles)*2*np.pi/angles;x=(centre[0]+radius*np.cos(theta))*N;y=(centre[1]+radius*np.sin(theta))*N
 ix=np.floor(x).astype(int)%N;iy=np.floor(y).astype(int)%N;fx=x-np.floor(x);fy=y-np.floor(y)
 return sum(field[:,:,(iy+dy)%N,(ix+dx)%N]*(fx if dx else 1-fx)*(fy if dy else 1-fy) for dy in [0,1] for dx in [0,1])

def examine_target(groups):
 raw=next(r for r in json.loads((ROOT/'data/wallpaper-atlas.json').read_text())['orbits'] if r['id']==TARGET);c=raw['config'];N,M=c['N'],c['M'];field=np.fromfile(ROOT/raw['fieldUrl'],dtype='<f4').reshape(M,2,N,N).astype(float);g=groups['g139'];details=[]
 for centre,op in [([.25,0],{'M':[[0,-1],[1,0]],'v':[.25,-.25],'s':1,'tau':.25}),([.25,.5],{'M':[[0,1],[-1,0]],'v':[-.25,.75],'s':1,'tau':.25})]:
  rings=[]
  for radius in [.025,.05,.1,.15,.2]:
   samples=circle_samples(field,centre,radius);harmonic=np.fft.fft(samples,axis=0)[1]/M;closed=np.concatenate([harmonic,harmonic[:,:1]],axis=1);phases=np.unwrap(np.angle(closed),axis=1);winding=(phases[:,-1]-phases[:,0])/(2*np.pi)
   # Positive fitted shift means a feature advances in the positive lattice-angle
   # direction. This is local rigid-rotation fitting, not a material trajectory.
   shifts=np.arange(-90,91);fit=[]
   for channel in [0,1]:
    scores=np.array([np.mean((np.roll(np.roll(samples[:,channel],-1,axis=0),-int(shift),axis=1)-samples[:,channel])**2) for shift in shifts]);best=int(shifts[np.argmin(scores)]);fit.append({'degreesPerFrame':best*.5,'rms':float(np.sqrt(scores.min()))})
   rings.append({'radiusInLatticeUnits':radius,'firstTemporalHarmonicWindingByChannel':winding.tolist(),'minimumHarmonicAmplitudeByChannel':np.min(abs(harmonic),axis=1).tolist(),'adjacentFrameAngularFit':fit})
  details.append({'centre':centre,'quarterPeriodGenerator':op,'dataRelation':audit_operation(field,op),'rings':rings})
 return {'id':TARGET,'N':N,'M':M,'period':c['period'],'fieldSha256':raw['fieldSha256'],'namedGenerators':[{key:op[key] for key in ['name','kind','M','v','s','tau','marker']} for op in g['namedGenerators']],'centres':details,'interpretation':['The named fourfold centre and its reflected partner carry inverse rotation matrices with the same positive quarter-period offset. Spatial reflection reverses rotational handedness; it does not reverse time.','The equation q(gx,t+tau*T)=q(x,t) means a feature at x is reproduced at gx after tau*T. Equivalently the later image is the pullback q(g^-1*x,t).','Clockwise/counterclockwise on screen additionally depends on the renderer camera orientation. Finite phase symmetry alone specifies an endpoint relation, not a unique continuous angular velocity; local winding/fitting below are supplementary measurements.']}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=Path(__file__).with_name('time-direction-catalog-audit.json'));p.add_argument('--workers',type=int,default=3);a=p.parse_args();jobs,groups=collect();records=[];payloads=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers) as pool:
  for index,result in enumerate(pool.map(audit_payload,jobs)):
   records.extend(result.pop('records'));payloads.append(result)
   if (index+1)%50==0:print(json.dumps({'payloadsDone':index+1,'totalPayloads':len(jobs),'recordsDone':len(records)}),flush=True)
 records.sort(key=lambda r:(r['family'],r['groupId'],r['model'],r['id']));operations=[op for r in records for op in r['operations']];directional=[op for op in operations if op['timeDirectionIdentifiable']]
 summary={'records':len(records),'uniquePayloadPaths':len(payloads),'uniquePayloadHashes':len({p['fieldSha256'] for p in payloads}),'operationsChecked':len(operations),'families':len({r['family'] for r in records}),'models':dict(Counter(r['model'] for r in records)),'failedRecords':[r['id'] for r in records if not r['passed']],'maximumForwardError':max(op['forward']['maximum'] for op in operations),'directionIdentifiableOperations':len(directional),'unexpectedOppositeSignPasses':sum(op['oppositeTimeSignPassed'] for op in directional),'minimumOppositeSignMaximumForDirectionalOperations':min(op['oppositeTimeSign']['maximum'] for op in directional),'zeroOrHalfPeriodAmbiguousOperations':len(operations)-len(directional)}
 report={'schema':'time-direction-catalog-audit-v1','sources':SOURCES,'sourceCatalogSha256':{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path,_ in SOURCES},'canonicalActions':{gid:{'family':g['family'],'ops':g['ops'],'namedGenerators':[{key:op[key] for key in ['name','kind','M','v','s','tau']} for op in g['namedGenerators']]} for gid,g in groups.items()},'auditCodeSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'forwardConvention':'q(M*x+v,t+tau*T)=q(x,t)','oppositeSignCheck':'q(M*x+v,t-tau*T)=q(x,t); equivalently in norm q(g^-1*x,t+tau*T)=q(x,t)','tolerance':TOLERANCE,'scope':'Actual saved Float32 bytes, both concentrations, all saved time frames and lattice nodes; no new numerical integration. Temporal interpolation preserves the maximum-error bound between aligned frame shifts.','summary':summary,'targetExample':examine_target(groups),'records':records}
 a.output.write_text(json.dumps(report,separators=(',',':'),ensure_ascii=False,allow_nan=False)+'\n');print(json.dumps(summary,indent=2));return 1 if summary['failedRecords'] or summary['unexpectedOppositeSignPasses'] else 0

if __name__=='__main__':raise SystemExit(main())
