#!/usr/bin/env python3
"""Precompute conservative local-motion signs, separately from symmetry actions.

This analyses saved playback fields only. A half-turn/+half-period symmetry does
not determine local chirality; arrows are emitted only when direct angular fits,
both concentrations, several radii, and temporal harmonic winding agree.
"""
import argparse,concurrent.futures,hashlib,json,math,time
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np

VERSION='physical-ring-motion-v1'
LIMITS={'angles':256,'radiusFractions':[.22,.30,.38],'minimumRadiusGridSteps':2.,'minimumResolvedRadii':2,'minimumFirstHarmonicFraction':.5,'minimumHarmonicAmplitudeRatio':.15,'minimumRelativeRingVariation':.015,'minimumFitImprovement':.70,'minimumPhaseSignAgreement':.95,'maximumLagRateDisagreement':.20,'minimumDegreesPerCycle':30.,'maximumAbsoluteWinding':6}
DEFAULT_TARGET='wallpaper:g6:731aa45654d4d690'

def centre_key(point):
 return ','.join(f'{(float(x)%1):.9f}' if round(float(x)%1,9)<1 else '0.000000000' for x in point)

def ring_samples(field,centre,radius,lattice,angles=256):
 """Euclidean physical circles, with exactly the viewer's spatial interpolant."""
 N=field.shape[-1];theta=np.arange(angles)*2*np.pi/angles;dx=radius*np.cos(theta);dy=radius*np.sin(theta)
 if lattice=='triangular':du=dx+dy/math.sqrt(3);dv=2*dy/math.sqrt(3)
 else:du,dv=dx,dy
 x=(centre[0]+du)*N;y=(centre[1]+dv)*N;xf=np.floor(x);yf=np.floor(y);ix=xf.astype(int)%N;iy=yf.astype(int)%N;fx=x-xf;fy=y-yf
 q00=field[:,:,iy,ix];q10=field[:,:,iy,(ix+1)%N];q01=field[:,:,(iy+1)%N,ix];q11=field[:,:,(iy+1)%N,(ix+1)%N]
 if lattice=='triangular':return np.where(fx>=fy,(1-fx)*q00+(fx-fy)*q10+fy*q11,(1-fy)*q00+(fy-fx)*q01+fx*q11)
 return (1-fx)*(1-fy)*q00+fx*(1-fy)*q10+(1-fx)*fy*q01+fx*fy*q11

def harmonic_evidence(samples):
 M=len(samples);spectrum=np.fft.fft(samples,axis=0)/M;a=spectrum[1];energy=float(np.mean(np.var(samples,axis=0)));power=float(np.mean(abs(a)**2));phase_steps=np.angle(np.roll(a,-1)*np.conj(a));w=float(np.sum(phase_steps)/(2*np.pi));nearest=round(w);ratio=float(np.min(abs(a))/math.sqrt(power)) if power>1e-30 else 0.
 return {'winding':nearest if abs(w-nearest)<1e-5 else None,'firstHarmonicFraction':float(2*power/energy) if energy>1e-30 else 0.,'minimumHarmonicAmplitudeRatio':ratio}

def angular_fit(samples,lag=1):
 """Fit q(t+lag,theta+delta) to q(t,theta) over all phases; delta moves features."""
 M,A=samples.shape;future=np.roll(samples,-lag,axis=0);ft=np.fft.fft(samples,axis=1);cross=np.fft.ifft(np.conj(ft)*np.roll(ft,-lag,axis=0),axis=1).real
 # Explicit squared norms retain changes of the angular mean in the residual;
 # uniform breathing must not masquerade as successful rigid rotation.
 energy=np.sum(samples*samples+future*future,axis=1);maxshift=A//8*lag;shifts=np.arange(-maxshift,maxshift+1);squared=np.maximum(0,(energy[:,None]-2*cross[:,shifts%A])/A);zero=np.mean((future-samples)**2,axis=1);scores=np.mean(squared,axis=0);index=int(np.argmin(scores));best=int(shifts[index]);boundary=index==0 or index==len(shifts)-1
 def minimum(row,at):
  if at==0 or at==len(row)-1:return float(shifts[at]),float(row[at])
  left,middle,right=map(float,row[at-1:at+2]);curvature=left-2*middle+right;offset=.5*(left-right)/curvature if curvature>1e-30 else 0.;offset=float(np.clip(offset,-.5,.5));value=max(0.,middle+.5*(right-left)*offset+.5*curvature*offset*offset)
  return float(shifts[at]+offset),value
 shift,value=minimum(scores,index);degrees=shift*360/A/lag;sign=1 if degrees>0 else -1 if degrees<0 else 0;perphase=np.array([minimum(row,int(np.argmin(row)))[0]*360/A/lag for row in squared]);active=zero>max(1e-24,float(np.mean(zero))*1e-4);deadzone=LIMITS['minimumDegreesPerCycle']/M*.2
 agreement=float(np.mean((perphase[active]*sign)>deadzone)) if active.any() and sign else 0.;baseline=float(np.mean(zero));improvement=1-value/baseline if baseline>1e-24 else 0.;opposite=scores[shifts*sign<=0] if sign else scores;opposite_value=float(np.min(opposite));opposite_improvement=1-opposite_value/baseline if baseline>1e-24 else 0.
 return {'sign':sign,'degreesPerFrame':float(degrees),'degreesPerCycle':float(degrees*M),'fitImprovement':float(np.clip(improvement,-1,1)),'phaseSignAgreement':agreement,'oppositeDirectionImprovement':float(np.clip(opposite_improvement,-1,1)),'boundaryMinimum':boundary,'fitRms':math.sqrt(value),'unshiftedRms':math.sqrt(baseline),'activePhaseFraction':float(np.mean(active))}

def analyse_centre(field,centre,spacing,lattice,details=False):
 N=field.shape[-1];radii=[float(f*spacing) for f in LIMITS['radiusFractions'] if f*spacing*N>=LIMITS['minimumRadiusGridSteps']];base={'centre':[(float(x)%1) for x in centre],'centreKey':centre_key(centre),'sign':None,'status':'under-resolved','confidence':'unknown'}
 if len(radii)<LIMITS['minimumResolvedRadii']:return {**base,'reason':'Fewer than two circles resolve at least two spatial grid steps.','evidence':{'resolvedRadii':len(radii)}}
 spans=np.ptp(field,axis=(0,2,3));rings=[];reasons=set();signs=[];windings=[];improvements=[];agreements=[];rate_disagreements=[];harmonic_fractions=[];amplitude_ratios=[]
 for radius in radii:
  samples=ring_samples(field,centre,radius,lattice,LIMITS['angles']);channels=[]
  for channel in [0,1]:
   q=samples[:,channel];harmonic=harmonic_evidence(q);fits=[angular_fit(q,lag) for lag in [1,2]];w=harmonic['winding'];variation=float(np.std(q)/max(spans[channel],1e-30));rate1,rate2=[f['degreesPerFrame'] for f in fits];disagreement=abs(rate1-rate2)/max(abs(rate1),abs(rate2),1e-12)
   if variation<LIMITS['minimumRelativeRingVariation']:reasons.add('weak-angular-signal')
   if harmonic['firstHarmonicFraction']<LIMITS['minimumFirstHarmonicFraction'] or harmonic['minimumHarmonicAmplitudeRatio']<LIMITS['minimumHarmonicAmplitudeRatio']:reasons.add('weak-or-nodal-temporal-harmonic')
   if w is None or w==0:reasons.add('no-local-phase-winding')
   elif abs(w)>LIMITS['maximumAbsoluteWinding']:reasons.add('angular-alias-risk')
   for fit in fits:
    if fit['boundaryMinimum']:reasons.add('angular-alias-risk')
    if fit['fitImprovement']<LIMITS['minimumFitImprovement']:reasons.add('poor-rotation-fit')
    if fit['phaseSignAgreement']<LIMITS['minimumPhaseSignAgreement']:reasons.add('time-varying-direction')
    if abs(fit['degreesPerCycle'])<LIMITS['minimumDegreesPerCycle']:reasons.add('weak-motion')
    if w and fit['sign']!=-int(math.copysign(1,w)):reasons.add('fit-and-winding-disagree')
    signs.append(fit['sign']);improvements.append(fit['fitImprovement']);agreements.append(fit['phaseSignAgreement'])
   if disagreement>LIMITS['maximumLagRateDisagreement']:reasons.add('lag-inconsistency')
   rate_disagreements.append(disagreement);windings.append(w);harmonic_fractions.append(harmonic['firstHarmonicFraction']);amplitude_ratios.append(harmonic['minimumHarmonicAmplitudeRatio']);channels.append({'channel':'U' if channel==0 else 'V','harmonic':harmonic,'relativeRingVariation':variation,'lagRateDisagreement':disagreement,'fits':fits})
  rings.append({'radius':radius,'radiusGridSteps':radius*N,'channels':channels})
 if len(set(signs))!=1 or 0 in signs:reasons.add('channel-or-radius-direction-disagreement')
 if len(set(windings))!=1:reasons.add('channel-or-radius-winding-disagreement')
 if not reasons:status='rotation';sign=signs[0];confidence='high'
 elif reasons & {'angular-alias-risk'}:status='ambiguous';sign=None;confidence='unknown'
 elif reasons & {'time-varying-direction','channel-or-radius-direction-disagreement','channel-or-radius-winding-disagreement','fit-and-winding-disagree','lag-inconsistency'}:status='mixed-motion';sign=None;confidence='unknown'
 else:status='no-clear-rotation';sign=None;confidence='unknown'
 result={**base,'status':status,'sign':sign,'confidence':confidence,'reasons':sorted(reasons),'evidence':{'resolvedRadii':len(radii),'radii':radii,'minimumFitImprovement':min(improvements),'minimumPhaseSignAgreement':min(agreements),'maximumLagRateDisagreement':max(rate_disagreements),'minimumFirstHarmonicFraction':min(harmonic_fractions),'minimumHarmonicAmplitudeRatio':min(amplitude_ratios),'windings':sorted(set(windings),key=lambda v:-999 if v is None else v)}}
 if details:result['rings']=rings
 return result

def inspect_payload(job):
 path,digest,N,M,lattice,requests=job;start=time.monotonic();payload=Path(path).read_bytes()
 if hashlib.sha256(payload).hexdigest()!=digest or len(payload)!=8*N*N*M:raise ValueError('Payload integrity mismatch')
 field=np.frombuffer(payload,dtype='<f4').reshape(M,2,N,N)
 if not np.isfinite(field).all():raise ValueError('Nonfinite movie')
 results={}
 for key,point,spacing,details in requests:results[key]=analyse_centre(field,point,spacing,lattice,details)
 return {'identity':(digest,N,M,lattice),'centres':results,'seconds':time.monotonic()-start}

def compact_result(result):
 """The browser needs a sign and a small evidence summary, not fitting arrays."""
 evidence=result['evidence']
 summary={key:evidence[key] for key in ['resolvedRadii','minimumFitImprovement','minimumPhaseSignAgreement','windings'] if key in evidence}
 summary={key:round(value,6) if isinstance(value,float) else value for key,value in summary.items()}
 return {key:result[key] for key in ['centre','sign','status','confidence']}|{'evidence':summary}

def geometry_digest(records):
 """Hash the geometry and byte bindings, independently of checkout location."""
 portable=[{key:value for key,value in r.items() if key!='fieldPath'} for r in records]
 return hashlib.sha256(json.dumps(portable,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()

def build(input_path,output_path,target=None,workers=3):
 source=json.loads(Path(input_path).read_text());records=source['records']
 if target:records=[r for r in records if r['id']==target]
 if len({r['id'] for r in records})!=len(records):raise ValueError('Duplicate record ID')
 if target and not records:raise ValueError('Unknown target record')
 jobs={};bindings={}
 for r in records:
  identity=(r['fieldSha256'],r['N'],r['M'],r['lattice']);job=jobs.setdefault(identity,{'path':r['fieldPath'],'requests':{}});requests=job['requests']
  for centre in r['centres']:
   point=centre['point'];spacing=float(centre['nearestDistance']);key=f'{centre_key(point)}@{spacing:.10f}';requests[key]=(point,spacing,target is not None)
  bindings[r['id']]=[(f"{centre_key(c['point'])}@{float(c['nearestDistance']):.10f}") for c in r['centres']]
 tasks=[(job['path'],*identity,[(key,*value) for key,value in job['requests'].items()]) for identity,job in jobs.items() if job['requests']];computed={};elapsed=[];start=time.monotonic()
 with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as pool:
  for index,result in enumerate(pool.map(inspect_payload,tasks)):
   computed[result['identity']]=result['centres'];elapsed.append(result['seconds'])
   if (index+1)%25==0:print(json.dumps({'payloadsDone':index+1,'payloadsTotal':len(tasks),'elapsedSeconds':time.monotonic()-start}),flush=True)
 output_records=[]
 for r in records:
  identity=(r['fieldSha256'],r['N'],r['M'],r['lattice'])
  centres=[computed[identity][key] for key in bindings[r['id']]] if r['centres'] else []
  if not target:centres=[compact_result(c) for c in centres]
  output_records.append({key:r[key] for key in ['id','fieldSha256','N','M','lattice']}|{'centres':centres})
 counts=Counter(c['status'] for r in output_records for c in r['centres']);manifest={'schema':'scott-gray-local-motion-v1','methodVersion':VERSION,'methodCodeSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'inputGeometrySha256':geometry_digest(records),'limits':LIMITS,'scope':'Measured local angular motion of saved playback fields, not part of the canonical symmetry action and not a material-particle trajectory. Signs use positive Euclidean physical angle; the UI must convert through the view orientation. Unknown states must not draw a directional arrow.','records':output_records,'summary':{'records':len(output_records),'centres':sum(counts.values()),'states':dict(counts),'uniquePayloadTasks':len(tasks),'uniqueCentreTasks':sum(len(t[-1]) for t in tasks),'elapsedSeconds':time.monotonic()-start,'summedWorkerSeconds':sum(elapsed)}}
 Path(output_path).write_text(json.dumps(manifest,separators=(',',':'),ensure_ascii=False,allow_nan=False)+'\n');print(json.dumps(manifest['summary'],indent=2));return manifest

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--target');p.add_argument('--workers',type=int,default=3);a=p.parse_args();build(a.input,a.output,a.target,a.workers)
