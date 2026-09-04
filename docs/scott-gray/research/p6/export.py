#!/usr/bin/env python3
"""Export triangular shooting candidates; admission is a separate JS audit.

Each --case supplies matching coarse and fine candidate metadata. No field is
projected or averaged. Chirality partners use the exact reflection (x,y)->(y,x).
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.signal import resample


def read(path):
    meta=json.loads(path.read_text());c=meta['config']
    field=np.fromfile(path.parent/meta['fieldUrl'],dtype='<f4' if meta['fieldEncoding']=='float32-le' else '<f8').reshape(c['M'],2,c['N'],c['N'])
    return meta,field


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case',nargs=2,type=Path,action='append',required=True,metavar=('COARSE','FINE'))
    parser.add_argument('--site',type=Path,default=Path(__file__).resolve().parents[2]/'p6')
    parser.add_argument('--append',action='store_true')
    args=parser.parse_args();site=args.site;out=site/'data/orbits';out.mkdir(parents=True,exist_ok=True)
    groups={g['id']:g for g in json.loads((site/'groups.json').read_text())}
    manifest_path=site/'data/candidate-orbits.json'
    manifest=json.loads(manifest_path.read_text()) if args.append and manifest_path.exists() else {'schema':'scott-gray-candidate-atlas-v1','preferredGroup':'g248','description':'Offline triangular Gray–Scott shooting candidates. Only fields accepted by the independent catalog build may be displayed.','orbits':[]}
    manifest.setdefault('preferredParameters',{'F':.00404,'k':.02})
    for coarse_path,fine_path in args.case:
        coarse,cf=read(coarse_path);fine,ff=read(fine_path);c,f=coarse['config'],fine['config'];n,N=c['N'],f['N']
        if N<=n or c['M']!=f['M'] or any(c['params'][k]!=f['params'][k] for k in ['F','k','Du','Dv','stencil']) or c['L']!=f['L']:
            raise ValueError('Refinement cases must share physical parameters and frame count, with increasing grid.')
        if max(coarse['shootingRms'],fine['shootingRms'])>1e-9 or min(fine['temporalRms']-.008,fine['spatialRms']-.012)<0:
            raise ValueError('Candidate fails shooting or nontriviality precheck; independent audit still required.')
        resampled=resample(resample(ff,n,axis=2),n,axis=3).real
        diff=resampled-cf
        refinement={'coarseGrid':n,'fineGrid':N,'physicalSide':f['L'],'coarsePeriod':c['period'],'finePeriod':f['period'],'relativePeriodDifference':abs(c['period']-f['period'])/c['period'],'fieldRmsDifference':float(np.sqrt(np.mean(diff*diff))),'fieldMaxDifference':float(np.max(abs(diff))),'relativeToCoarseTemporalRms':float(np.sqrt(np.mean(diff*diff)))/coarse['temporalRms'],'comparison':'Full normalized-phase movies, Fourier-resampled to the coarse lattice; all physical parameters fixed.'}
        charge=fine['charge'];mode=fine.get('spatialMode',1);shell=fine.get('spatialShell',1)
        cases={0:[('g243',False)],1:[('g248',False),('g247',True)],2:[('g244',False),('g245',True)],3:[('g246',False)]}[charge]
        for gid,reflect in cases:
            config={**f,'groupId':gid,'ops':groups[gid]['render']['ops']}
            values=np.transpose(ff,(0,1,3,2)) if reflect else ff
            encoded=values.astype('<f4').tobytes();sha=hashlib.sha256(encoded).hexdigest()
            shell_label=f'-shell{shell}' if shell!=1 else ''
            stem=f'{gid}-F{f["params"]["F"]:.8f}-k{f["params"]["k"]:.8f}-mode{mode}{shell_label}-N{N}-M{f["M"]}'.replace('.','p')
            family='Sixfold breathing wave' if charge==0 else 'Alternating hexagonal wave' if charge==3 else 'Rotating hexagonal wave'
            pattern=family+(f' · spatial mode {mode}' if mode>1 else '')+(f' · spatial shell {shell}' if shell!=1 else '')
            provenance={'method':fine['method'],'nonlinearSolver':fine.get('nonlinearSolver'),'family':family,'spatialMode':mode,'spatialShell':shell,'sourceCharge':charge,'coordinateTransform':'q(y,x,t)' if reflect else 'identity','unquantizedShootingResidualRms':fine['shootingRms'],'unquantizedReturnRms':fine['fullReturnRms'],'spatialRefinement':refinement,'projection':'None: the exported movie is direct RK4 evolution, followed only by an optional exact lattice reflection and Float32 quantization.','note':'Finite-grid numerical evidence; no continuum existence theorem or glider morphology is asserted.'}
            meta={'schema':'scott-gray-orbit-binary-v1','config':config,'fieldUrl':stem+'.f32','fieldEncoding':'float32-le','fieldLayout':'frame-major; planar U then V; x-fast; rhombic lattice nodes i/N,j/N','fieldByteLength':len(encoded),'fieldValueCount':len(encoded)//4,'fieldSha256':sha,'provenance':provenance}
            (out/(stem+'.f32')).write_bytes(encoded);(out/(stem+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
            item={'groupId':gid,'url':'data/orbits/'+stem+'.json','name':pattern+f' · F {f["params"]["F"]}','patternName':pattern,'description':'Periodic concentration waves computed on the physical triangular lattice; prescribed generator phase shifts are checked independently before catalog admission.'}
            manifest['orbits']=[old for old in manifest['orbits'] if old['url']!=item['url']];manifest['orbits'].append(item)
        print(json.dumps({'charge':charge,'F':f['params']['F'],'mode':mode,'refinement':refinement}))
    manifest['orbits'].sort(key=lambda e:(e['groupId'],float(e['name'].split(' · F ')[-1]),e['patternName']))
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    print('Candidates:',len(manifest['orbits']),manifest_path)


if __name__=='__main__':main()
