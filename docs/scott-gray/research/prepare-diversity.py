"""Prepare exact Float32 branch exports; the independent Node gate admits them.

Input JSON: {cases:[{family:'p4'|'p6',coarse:path,fine:path,id:string,name:string}]}.
The temporary output contains only proposed fields, never a verification claim.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.signal import resample
from morphology import read_movie, spectrum


def match_square_origin(values, group, frames):
    """Try exact torus translations; retain one canonical representative only.

    Changing the rotation center can change its phase character. It does not
    change the PDE, wavelength, or orbit, and must not create extra gallery
    entries within a group. The complete movie is checked before quantization.
    """
    N=values.shape[-1]
    assert N%8==0
    y,x=np.indices((N,N));actions=[]
    for op in group['render']['ops']:
        mat=np.asarray(op['M']);v=op['v']
        xx=(mat[0,0]*x+mat[0,1]*y+round(v[0]*N))%N
        yy=(mat[1,0]*x+mat[1,1]*y+round(v[1]*N))%N
        actions.append((yy,xx,round(op['tau']*frames)))
    best=None
    for sy,sx in [(0,0)]+[(y,x) for y in range(8) for x in range(8) if (y,x)!=(0,0)]:
        # A cheap phase-zero check rejects incompatible centers. It can only
        # reject: every retained center is checked on the complete movie below.
        origin=values[0]
        probe=np.zeros_like(origin)
        for yy,xx,dt in actions:
            probe+=values[dt%frames,:][:,(yy+sy*N//8)%N,(xx+sx*N//8)%N]
        original=origin[:,(y+sy*N//8)%N,(x+sx*N//8)%N]
        probe/=len(actions)
        rough={'max':float(abs(probe-original).max()),'maximumAllowed':1e-8,
               'originTranslation':[sx/8,sy/8]}
        if rough['max']>1e-8:
            if best is None or rough['max']<best['max']:best=rough
            continue
        shifted=np.roll(values,(-sy*N//8,-sx*N//8),axis=(2,3))
        projected=np.zeros_like(shifted)
        for yy,xx,dt in actions:
            projected+=np.roll(shifted[:,:,yy,xx],-dt,axis=0)
        projected/=len(actions)
        rounding={'rms':float(np.sqrt(np.mean((projected-shifted)**2))),
                  'max':float(abs(projected-shifted).max()),'maximumAllowed':1e-8,
                  'originTranslation':[sx/8,sy/8]}
        if best is None or rounding['max']<best['max']:best=rounding
        if rounding['max']<=1e-8:return projected,rounding
    return None,best


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cases',type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    root=Path(__file__).resolve().parent.parent
    proposals=[];rejections=[]
    for case in json.loads(args.cases.read_text())['cases']:
        coarse,cf=read_movie(case['coarse']);fine,ff=read_movie(case['fine'])
        c,f=coarse['config'],fine['config'];n,N=c['N'],f['N']
        keys=['F','k','Du','Dv','stencil']
        assert N>n and c['M']==f['M'] and c['L']==f['L'] and all(c['params'][k]==f['params'][k] for k in keys),'Refinement must fix physical parameters.'
        down=resample(resample(ff,n,axis=2),n,axis=3).real
        delta=float(np.sqrt(np.mean((down-cf)**2)))
        temporal=float(np.sqrt(np.mean((cf-cf.mean(axis=0,keepdims=True))**2)))
        refinement={'coarseGrid':n,'fineGrid':N,'physicalSide':f['L'],'coarsePeriod':c['period'],'finePeriod':f['period'],
                    'relativePeriodDifference':abs(c['period']-f['period'])/c['period'],'fieldRmsDifference':delta,
                    'relativeToCoarseTemporalRms':delta/temporal,'comparison':'Whole normalized-phase movies, Fourier-resampled to coarse lattice; physical parameters held fixed.'}
        family=case['family'];site=root/('p6' if family=='p6' else '')
        groups={g['id']:g for g in json.loads((site/'groups.json').read_text())}
        if family=='p6':
            charge=fine['charge']
            variants={0:[('g243','identity')],1:[('g248','identity'),('g247','swap')],2:[('g244','identity'),('g245','swap')],3:[('g246','identity')]}[charge]
        else:
            charge=fine['charge']
            variants={0:[('g94','identity')],1:[('g96','identity'),('g97','reflect'),('g99','affine')],2:[('g95','identity'),('g98','half-y'),('g94','half-y')]}[charge]
        for gid,action in variants:
            if action=='identity':values=ff
            elif action=='swap':values=ff.transpose(0,1,3,2)
            elif action=='half-y':values=np.roll(ff,-N//2,axis=2)
            else:
                y,x=np.indices((N,N));xx=(-x-(N//4 if action=='affine' else 0))%N;yy=(y+(N//2 if action=='affine' else 0))%N
                values=ff[:,:,yy,xx]
            rounding=None
            if family=='p4':
                # The legacy square gate requires exact sampled symmetry. Only
                # remove solver roundoff, never repair a wrong phase character.
                projected,rounding=match_square_origin(values,groups[gid],f['M'])
                if projected is None:
                    rejections.append({'id':case['id'],'groupId':gid,'reason':'Canonical phase action is incompatible; roundoff-only correction limit exceeded.','correction':rounding})
                    continue
                values=projected
            stem=f'{gid}-diversity-{case["id"]}-F{f["params"]["F"]:.8f}-k{f["params"]["k"]:.8f}-L{f["L"]:g}-N{N}-M{f["M"]}'.replace('.','p')
            binary=values.astype('<f4').tobytes();filename=stem+'.f32'
            (args.output/filename).write_bytes(binary)
            meta={'schema':'scott-gray-orbit-binary-v1','config':{**f,'groupId':gid,'ops':groups[gid]['render']['ops']},
                  'fieldUrl':filename,'fieldEncoding':'float32-le','fieldLayout':'frame-major; planar U then V; x-fast',
                  'fieldValueCount':len(binary)//4,'fieldByteLength':len(binary),'fieldSha256':hashlib.sha256(binary).hexdigest(),
                  'provenance':{'method':('Exact periodic-cell replication of a corrected shooting orbit; independent offline admission required.' if case.get('construction',{}).get('type')=='exact-periodic-cell-replication' else 'Unprojected RK4 twisted shooting; independent offline admission required.'),
                    'branchId':case['id'],'shapeLabel':case['name'],'coordinateTransform':action,
                    'spatialRefinement':refinement,'spectrum':spectrum(values.copy(),family),'sampledSymmetryRoundoffCorrection':rounding,
                    'seedSettings':fine.get('searchSettings',{'wave':fine.get('wave'),'charge':charge}),
                    'unquantizedShootingResidualRms':fine.get('shootingRms'),'unquantizedReturnRms':fine.get('fullReturnRms'),
                    'note':'A numerical periodic field, not a phase snapshot. Coordinate variants in different groups remain related branches. Finite-grid evidence; no continuum proof or glider claim.'}}
            if case.get('construction'):meta['provenance']['construction']=case['construction']
            (args.output/(stem+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
            proposals.append({'family':family,'groupId':gid,'path':str((args.output/(stem+'.json')).resolve()),'name':case['name'],
                              'description':case.get('description','A separately solved spatial pattern at fixed physical parameters; every prescribed phase offset is checked offline.')})
    (args.output/'proposals.json').write_text(json.dumps({'proposals':proposals},indent=2)+'\n')
    (args.output/'preparation-rejections.json').write_text(json.dumps(rejections,indent=2)+'\n')
    print(f'{len(proposals)} proposed coordinate variants; none admitted yet.')


if __name__=='__main__':main()
