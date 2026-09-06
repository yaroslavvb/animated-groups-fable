#!/usr/bin/env python3
"""Independent saved-byte audit for general forward time-shift wallpaper actions."""
import hashlib,json,math,tempfile
from pathlib import Path
import numpy as np
from search import mapping,native_flow
LIMITS={'symmetryMax':2e-7,'minimumAbsoluteContrast':.002,'minimumRelativeRangeContrast':.05,'minimumSpatialRms':.012,'minimumTemporalRms':.008,'trajectoryRms':1e-5,'closureRms':1e-5,'minimumRelativeSubperiodRms':.03,'maximumTemporalTailEnergyFraction':.01,'forwardPhaseMax':1e-6,'forwardPhaseRms':1e-6}

def ranges(field):return {'u':[float(field[:,0].min()),float(field[:,0].max())],'v':[float(field[:,1].min()),float(field[:,1].max())]}

def symmetry(field,ops,quick=False):
 M,_,N,_=field.shape;flat=field.reshape(M,2,-1);rows=[]
 for i,op in enumerate(ops):
  shift=op['tau']*M
  if abs(shift-round(shift))>1e-7:return {'passed':False,'reason':'Incompatible temporal grid'}
  mp=mapping(op,N);times=np.arange(0,M,max(1,M//6)) if quick else np.arange(M)
  diff=flat[(times+round(shift))%M][:,:,mp]-flat[times];maximum=float(np.max(abs(diff)))
  if maximum>LIMITS['symmetryMax']:return {'passed':False,'operation':i,'max':maximum}
  rows.append({'operation':i,'tau':op['tau'],'maximum':maximum,'rms':float(np.sqrt(np.mean(diff**2)))})
 return {'passed':True,'operations':rows}

def visibility(field,ops):
 M,_,N,_=field.shape;flat=field.reshape(M,2,-1);spans=np.ptp(flat,axis=(0,2));rows=[]
 for i,op in enumerate(ops):
  if abs(op['tau'])<1e-9:continue
  diff=flat[:,:,mapping(op,N)]-flat;delta=np.roll(diff,-1,axis=0)-diff
  aa=np.sum(delta**2,axis=2);bb=np.sum(diff*delta,axis=2);cc=np.sum(diff**2,axis=2);alpha=np.divide(-bb,aa,out=np.zeros_like(bb),where=aa!=0);alpha=np.clip(alpha,0,1)
  minimum=np.sqrt(np.maximum(0,(cc+2*bb*alpha+aa*alpha**2)/(N*N))).min(axis=0);relative=minimum/spans
  passed=bool(np.all(minimum>=LIMITS['minimumAbsoluteContrast']) and np.all(relative>=LIMITS['minimumRelativeRangeContrast']))
  rows.append({'operation':i,'tau':op['tau'],'minimumRmsByChannel':minimum.tolist(),'minimumRelativeRangeByChannel':relative.tolist(),'passed':passed})
 return {'passed':all(r['passed'] for r in rows),'referenceOnly':not rows,'scope':'Both concentrations; every nonzero-offset affine operation; exact minimum over each linear playback segment including the seam.','operations':rows}

def independent_dynamics(field,config,lattice,flow=None):
 M,_,N,_=field.shape;p=config['params'];T=config['period'];L=config['L'];results=[]
 if flow is None:
  path=Path(tempfile.mkdtemp(prefix='wallpaper-audit-'));flow=native_flow(lattice,path)
 for dt in [.2,.1]:
  q=field[0].ravel().astype(float);trajectory=[]
  for j in range(M):trajectory.append(q.copy());q=flow(q,T/M,N,p['F'],p['k'],L,dt)
  evolved=np.asarray(trajectory).reshape(field.shape);difference=evolved-field
  results.append({'dtLimit':dt,'trajectoryRms':float(np.sqrt(np.mean(difference**2))),'trajectoryMax':float(np.max(abs(difference))),'closureRms':float(np.sqrt(np.mean((q-field[0].ravel())**2)))})
 return {'passed':all(r['trajectoryRms']<=LIMITS['trajectoryRms'] and r['closureRms']<=LIMITS['closureRms'] for r in results),'method':'Independent native RK4 full-cycle forward integration at two timestep limits, starting from exported Float32 bytes; no symmetry projection.','checks':results}

def attach_forward_bounds(proof):
 """Bound target symmetry on the periodically extended independent cycle.

 Spatial lattice maps and resolved frame shifts are permutations. Triangle
 inequalities give e_phase <= e_saved + 2 e_trajectory. The pointwise trajectory
 maximum also bounds every concentration and every linear playback segment.
 """
 dynamics=proof.get('independentDynamics') or {};checks=dynamics.get('checks')
 if checks is None and dynamics.get('sourceDiagnostics'):
  checks=[dynamics['sourceDiagnostics'][name] for name in ['closure','refinedClosure']]
 checks=checks or [];bounds=[];valid=bool(checks) and dynamics.get('passed') is True
 for check_index,check in enumerate(checks):
  rms=check.get('trajectoryRms');maximum=check.get('trajectoryMax')
  if not isinstance(rms,(int,float)) or not isinstance(maximum,(int,float)) or not math.isfinite(rms+maximum) or min(rms,maximum)<0:valid=False;continue
  operations=[]
  for op in proof.get('phaseRelations',{}).get('operations',[]):
   rb=op['rms']+2*rms;mb=op['maximum']+2*maximum;passed=rb<=LIMITS['forwardPhaseRms'] and mb<=LIMITS['forwardPhaseMax'];valid=valid and passed
   operations.append({'operation':op['operation'],'tau':op['tau'],'rmsUpperBound':rb,'maximumUpperBound':mb,'passed':passed})
  contrast=[]
  for op in proof.get('visibility',{}).get('operations',[]):
   lower=[max(0,m-2*maximum) for m in op['minimumRmsByChannel']]
   spans=[m/r for m,r in zip(op['minimumRmsByChannel'],op['minimumRelativeRangeByChannel'])]
   relative=[m/(span+2*maximum) for m,span in zip(lower,spans)];passed=all(x>=LIMITS['minimumAbsoluteContrast'] for x in lower) and all(x>=LIMITS['minimumRelativeRangeContrast'] for x in relative);valid=valid and passed
   contrast.append({'operation':op['operation'],'minimumRmsLowerBoundByChannel':lower,'minimumRelativeRangeLowerBoundByChannel':relative,'passed':passed})
  bounds.append({'integrationCheck':check_index,'trajectoryRms':rms,'trajectoryMax':maximum,'operations':operations,'visibilityLowerBounds':contrast})
 result={'passed':bool(valid),'rmsLimit':LIMITS['forwardPhaseRms'],'maximumLimit':LIMITS['forwardPhaseMax'],'checks':bounds,'method':'Permutation-isometry triangle bounds: target phase RMS <= saved phase RMS + 2 trajectory RMS; target phase maximum <= saved phase maximum + 2 trajectory maximum. Per-channel same-time contrast >= saved minimum minus 2 trajectory maximum.','scope':'Periodically extended samples of each independently integrated full cycle and their linear playback interpolation. This is a bound on the wrapped numerical orbit; independently measured closure errors are retained separately. It does not assert exact continuum or unwrapped-time equality.'}
 return {**proof,'forwardTargetPhaseBounds':result,'passed':bool(proof.get('passed') and valid)}


def audit(field,config,group,dynamics=None):
 field=np.asarray(field,dtype=float)
 if field.ndim!=4 or field.shape[1]!=2 or field.shape[2]!=field.shape[3]:raise ValueError('Expected complete square-indexed U/V movie')
 M,_,N,_=field.shape;p=config['params']
 if config['N']!=N or config['M']!=M or N%group['meshMultiple'] or M%group['frameMultiple']:raise ValueError('Config and canonical mesh/frame dimensions disagree')
 if not all(math.isfinite(p[k]) and p[k]>=0 for k in ['F','k','Du','Dv','dx']):raise ValueError('Invalid PDE parameters')
 if p['Du']!=.16 or p['Dv']!=.08:raise ValueError('This native verifier requires Du=.16 and Dv=.08')
 if not math.isfinite(config['L']) or config['L']<=0 or abs(p['dx']*N-config['L'])>1e-9:raise ValueError('Physical lattice length mismatch')
 if p['stencil']!=('triangular-six' if group['lattice']=='triangular' else 'five-point'):raise ValueError('Native verifier stencil mismatch')
 if not math.isfinite(config['period']) or not 0<config['period']<2000:raise ValueError('Invalid period')
 if not np.isfinite(field).all():return {'passed':False,'reason':'Nonfinite concentrations'}
 stats={'spatialRms':float(np.sqrt(np.mean((field-field.mean(axis=(2,3),keepdims=True))**2))),'temporalRms':float(np.sqrt(np.mean((field-field.mean(axis=0,keepdims=True))**2))),'minimum':float(field.min()),'maximum':float(field.max())}
 relation=symmetry(field,group['ops']);vis=visibility(field,group['ops']) if relation['passed'] else {'passed':False,'reason':'Phase relation failed'}
 energies=np.mean(abs(np.fft.fft(field,axis=0)/M)**2,axis=(1,2,3));freq=np.arange(M);freq=np.minimum(freq,M-freq)
 temporal_energy=float(energies[1:].sum());tail_fraction=float(energies[freq>M/4].sum())/max(temporal_energy,1e-30)
 resolution={'passed':tail_fraction<=LIMITS['maximumTemporalTailEnergyFraction'],'tailEnergyFraction':tail_fraction,'cutoffFrequency':M/4,'scope':'Fraction of nonconstant temporal Fourier energy above one quarter of the saved frame count.'}
 periods=[{'divisor':d,'relativeProjectionRms':float(np.sqrt(energies[freq%d!=0].sum()))/max(stats['temporalRms'],1e-12)} for d in range(2,M//2+1)]
 structural=relation['passed'] and vis['passed'] and resolution['passed'] and stats['spatialRms']>=LIMITS['minimumSpatialRms'] and stats['temporalRms']>=LIMITS['minimumTemporalRms'] and stats['minimum']>=-1e-8 and stats['maximum']<=1.2 and all(p['relativeProjectionRms']>=LIMITS['minimumRelativeSubperiodRms'] for p in periods)
 if dynamics is None and structural:dynamics=independent_dynamics(field,config,group['lattice'])
 return attach_forward_bounds({'schema':'wallpaper-orbit-certificate-v1','passed':bool(structural and dynamics and dynamics['passed']),'limits':LIMITS,**stats,'phaseRelations':relation,'visibility':vis,'resolvedSubperiods':periods,'temporalResolution':resolution,'independentDynamics':dynamics,'scope':'Finite-grid numerical verification, not a continuum existence proof or a maximal-symmetry classification.'})

if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('metadata',type=Path);p.add_argument('--group');p.add_argument('--output',type=Path);a=p.parse_args();meta=json.loads(a.metadata.read_text());c=meta['config'];groups=json.loads((Path(__file__).resolve().parent.parent.parent/'wallpaper-groups.json').read_text())['groups'];g=next(g for g in groups if g['id']==(a.group or c['groupId']));payload=(a.metadata.parent/meta['fieldUrl']).read_bytes();field=np.frombuffer(payload,dtype='<f4').reshape(c['M'],2,c['N'],c['N']);out=audit(field,c,g);out['fieldSha256']=hashlib.sha256(payload).hexdigest();text=json.dumps(out,indent=2)
 if a.output:a.output.write_text(text)
 else:print(text)
