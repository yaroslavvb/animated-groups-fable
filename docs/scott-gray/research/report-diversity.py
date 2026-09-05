"""Generate the diversity report from current source manifests and saved evidence.

No numerical integration, candidate admission, or atlas mutation. Each referenced
Float32 payload is rehashed. Optional comparison evidence is used only for pairs
whose current metadata/configuration and payload hashes still match.
"""
import argparse
import hashlib
import json
import math
from collections import defaultdict,Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
FAMILIES=[('p4','442',ROOT,'verified-orbits.json'),('p6','632',ROOT/'p6','candidate-orbits.json')]

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(4*1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def physical(c):
    p=c['params']
    return {'F':p['F'],'k':p['k'],'Du':p['Du'],'Dv':p['Dv'],'L':c.get('L',c['N']*p['dx']),'stencil':p.get('stencil','five-point')}

def key(p):return tuple(p[name] for name in ['F','k','Du','Dv','L','stencil'])
def number(v):return format(v,'.10g') if isinstance(v,(float,int)) else str(v)
def percent(v):return '—' if v is None else f'{100*v:.3g}%'
def scientific(v):return '—' if v is None else f'{v:.3g}'
def escape(s):return str(s).replace('|','\\|').replace('\n',' ')

def compact_gate(d):
    if not d:return None
    phases=[d.get(name,{}) for name in ['candidatePhase','independentPhase','refinedPhase']]
    passed=d.get('validated') is True and not d.get('reasons') and all(p.get('passed') is True for p in phases)
    passed=passed and phases[-1].get('independentForwardFrames') is True and phases[-1].get('primitiveAtResolvedDivisors') is True
    return {'passed':passed,'source':'recorded independent Float32 admission','relativePde':d.get('relativePde'),'pdeRms':d.get('pdeRms'),
            'refinedReturnRms':d.get('refinedClosure',{}).get('closureRms'),'refinedTrajectoryRms':d.get('refinedClosure',{}).get('trajectoryRms'),
            'coarseDt':d.get('closure',{}).get('dt'),'refinedDt':d.get('refinedClosure',{}).get('dt'),
            'timestepRefinementRms':d.get('refinementRms'),
            'maxRefinedPhaseRms':max((op.get('shiftedRms',0) for op in phases[-1].get('operations',[])),default=None),
            'primitiveAtResolvedDivisors':phases[-1].get('primitiveAtResolvedDivisors',False)}

def collect():
    records=[];sources=[]
    for family,label,site,manifest_name in FAMILIES:
        path=site/'data'/manifest_name;manifest=json.loads(path.read_text());sources.append({'path':str(path.relative_to(ROOT)),'sha256':digest(path)})
        catalog_path=site/'data/precomputed-atlas.json'
        catalog=json.loads(catalog_path.read_text()) if catalog_path.exists() else {'orbits':[]}
        cached={e['metadataUrl']:e for e in catalog['orbits']}
        active_urls=[entry['url'] for entry in manifest['orbits']]
        excluded_urls=[entry['url'] for entry in manifest.get('excludedFromGallery',[])]
        assert len(active_urls)==len(set(active_urls)) and len(excluded_urls)==len(set(excluded_urls)), 'Duplicate record URL in source inventory.'
        assert not set(active_urls).intersection(excluded_urls), 'A record cannot be both current and excluded.'
        archived=set(excluded_urls)
        for entry in manifest['orbits']+manifest.get('excludedFromGallery',[]):
            metadata_path=site/entry['url'];metadata=json.loads(metadata_path.read_text());c=metadata['config'];p=physical(c)
            assert c['groupId']==entry['groupId'],'Source group mismatch.'
            assert metadata['fieldEncoding']=='float32-le' and metadata['fieldValueCount']==2*c['N']**2*c['M']
            field=metadata_path.parent/metadata['fieldUrl']
            assert field.stat().st_size==metadata['fieldByteLength']==4*metadata['fieldValueCount'],'Wrong field size.'
            assert digest(field)==metadata['fieldSha256'],'Float32 payload hash mismatch.'
            old=cached.get(entry['url']);d=metadata.get('diversityAdmission')
            if d is None and old and old['fieldSha256']==metadata['fieldSha256'] and physical(old['config'])==p and all(old['config'][k]==c[k] for k in ['N','M','period','groupId']):d=old['diagnostics']
            gate=compact_gate(d)
            assert gate and gate['passed'],f'Missing matching independent gate evidence: {metadata_path}'
            reference=all(float(op['tau'])%1==0 for op in c['ops'])
            visibility=metadata.get('visibleTimeSymmetry')
            # Do not substitute the old global phase RMS for the new per-frame rule.
            if visibility is None and old and old['fieldSha256']==metadata['fieldSha256'] and physical(old['config'])==p and all(old['config'][k]==c[k] for k in ['N','M','period','groupId']):visibility=old.get('visibleTimeSymmetry')
            state='excluded' if entry['url'] in archived else 'reference' if reference else 'pending' if visibility is None else 'visible' if visibility.get('passed') is True else 'excluded'
            provenance=metadata.get('provenance',{})
            records.append({'family':family,'familyLabel':label,'groupId':entry['groupId'],'name':entry.get('patternName',entry.get('name','Periodic pattern')),
                            'description':entry.get('description',''),'metadataPath':str(metadata_path.relative_to(ROOT)),'fieldSha256':metadata['fieldSha256'],
                            'parameters':p,'N':c['N'],'M':c['M'],'period':c['period'],'gate':gate,'visibilityState':state,'visibleTimeSymmetry':visibility,
                            'addedBranchId':provenance.get('branchId'),'shapeLabel':provenance.get('shapeLabel'),'coordinateTransform':provenance.get('coordinateTransform'),
                            'spatialRefinement':provenance.get('spatialRefinement'),'seedSettings':provenance.get('seedSettings'),'construction':provenance.get('construction'),
                            'spectrum':provenance.get('spectrum'),'roundoffCorrection':provenance.get('sampledSymmetryRoundoffCorrection')})
    groups=[]
    for family,label,site,_ in FAMILIES:
        for g in json.loads((site/'groups.json').read_text()):
            rows=[r for r in records if r['family']==family and r['groupId']==g['id']];sets=defaultdict(list)
            for r in rows:
                if r['visibilityState'] in ['visible','reference']:sets[key(r['parameters'])].append(r)
            choices=[{'parameters':r[0]['parameters'],'count':len(r),'records':[e['metadataPath'] for e in r]} for r in sets.values()]
            choices.sort(key=lambda s:(-s['count'],key(s['parameters'])));maximum=choices[0]['count'] if choices else 0
            groups.append({'family':family,'familyLabel':label,'groupId':g['id'],'storedRecords':len(rows),'visibilityCounts':dict(Counter(r['visibilityState'] for r in rows)),
                           'maximumChoicesAtFixedParameters':maximum,'maximumParameterSets':[s for s in choices if s['count']==maximum],'parameterSets':choices})
    return records,groups,sources

def matching_comparisons(paths,records):
    current={r['metadataPath']:r for r in records};pairs=[];seen=set()
    for path in paths:
        audit=json.loads(path.read_text());old={r['path']:r for r in audit['records']}
        for pair in audit['pairs']:
            names=[pair['first'],pair['second']]
            if any(name not in current or name not in old for name in names):continue
            if any(current[name]['fieldSha256']!=old[name]['fieldSha256'] or current[name]['parameters']!=physical(old[name]['config']) or current[name]['period']!=old[name]['config']['period'] for name in names):continue
            identity=tuple(sorted(names))
            if identity in seen:continue
            seen.add(identity);pairs.append(pair)
    return pairs

def search_scope():
    specifications=[('632 CPU','research/search-grid.json','batches','plannedJobs'),
                    ('442 GPU','research/search-grid-p4.json','runs','numberOfJobs'),
                    ('632 GPU','research/p6/search-grid-gpu.json','runs','jobCount')]
    inventories=[];totals=Counter()
    for label,relative,list_key,count_key in specifications:
        path=ROOT/relative
        if not path.exists():
            inventories.append({'label':label,'path':relative,'available':False})
            continue
        data=json.loads(path.read_text());counts=Counter();runs=[]
        for run in data[list_key]:
            count=run[count_key]
            assert isinstance(count,int) and not isinstance(count,bool) and count>=0,'Invalid search job count.'
            items=run.get('cases',run.get('jobs'))
            if items is not None:assert len(items)==count,'Search inventory job count disagrees with listed cases.'
            declared=run.get('status',run.get('state',run.get('observedState','unknown')))
            if declared=='executed':status='completed' if run.get('recordedResults')==count else 'launched'
            elif declared=='completed':status='completed'
            elif declared=='stopped':status='completed' if items is not None and all(isinstance(item.get('result'),dict) for item in items) else 'failed'
            elif declared in ['launched','running','ephemeral']:status='launched'
            elif declared=='planned':status='planned'
            elif declared in ['failed','incomplete']:status='failed'
            else:status='other'
            counts[status]+=count
            runs.append({'batch':run.get('id',run.get('batch')),'jobs':count,'declaredStatus':declared,'reportCategory':status})
        totals.update(counts)
        inventories.append({'label':label,'path':relative,'sha256':digest(path),'available':True,
                            'jobs':sum(counts.values()),'statusCounts':dict(counts),'runs':runs})
    return {'inventories':inventories,'jobCount':sum(totals.values()),'statusCounts':dict(totals),
            'scope':'Solver seed, continuation and spatial-refinement jobs, not independent solutions. Launched/running means completion has not been marked in that inventory. A continuation job can contain multiple correction steps.',
            'deflatedNewtonImplemented':False}

def make_summary(comparisons):
    records,groups,sources=collect();pairs=matching_comparisons(comparisons,records)
    counts=Counter(r['visibilityState'] for r in records)
    return {'schema':'scott-gray-diversity-summary-v1','sourceManifests':sources,'storedRecordCount':len(records),'familyRecordCounts':dict(Counter(r['family'] for r in records)),
            'visibilityCounts':dict(counts),'visibilityAuditComplete':not counts.get('pending'),'groups':groups,'records':records,'matchingShapeComparisons':pairs,'searchScope':search_scope(),
            'scope':'Counts are saved choices at identical physical parameters, not an exhaustive number of mathematical branches. Related coordinate variants across groups are counted as separate selectable records, not independent discoveries.',
            'evidenceScope':'Actual Float32 payload hashes checked; numerical metrics copied from matching prior independent admission. This report performs no numerical integration.',
            'limitations':['Finite-grid numerical evidence, not a continuum-existence, stability, or uniqueness proof.','Failed searches and exclusions by a visibility preference do not establish impossibility.','Different wavelengths and different arrangements at the same wavelength are distinct kinds of exploration.','Zero-offset groups are spatial references. Nonzero-offset records require the separate per-channel, throughout-playback visibility audit.']}

def render(summary):
    rows=summary['records'];counts=summary['visibilityCounts'];selectable=[r for r in rows if r['visibilityState'] in ['visible','reference']];active=Counter(r['family'] for r in selectable);lines=['# Periodic-pattern diversity','',
      f"The gallery contains **{len(selectable)} selectable records**: {active.get('p4',0)} in 442 and {active.get('p6',0)} in 632. These include related coordinate versions in different groups; they are not independent branch counts.",'',
      f"The throughout-playback visibility check currently marks **{counts.get('visible',0)} time-offset records**, **{counts.get('reference',0)} spatial references**, **{counts.get('excluded',0)} excluded**, and **{counts.get('pending',0)} awaiting that check**. Spatial references have no required nonzero time shift.",'',
      '## Most choices at one parameter set','',
      'Each row fixes F, k, both diffusion coefficients, physical side L, and the spatial stencil. N and M are numerical resolutions, not extra physical parameters. Counts below include only passing time-offset records or explicitly labelled spatial references. All ties and every parameter set are listed in [the machine-readable summary](data/diversity-summary.json).','',
      '| Family / group | Kind | Most choices | One parameter set attaining this count |','| --- | --- | ---: | --- |']
    for g in summary['groups']:
        reference=g['visibilityCounts'].get('reference',0)>0;kind='spatial reference' if reference else 'time offset'
        if g['maximumParameterSets']:
            p=g['maximumParameterSets'][0]['parameters'];location=', '.join(f'{name}={number(p[name])}' for name in ['F','k','Du','Dv','L'])+'; '+p['stencil']
            if len(g['maximumParameterSets'])>1:location+=f" (+{len(g['maximumParameterSets'])-1} tied sets)"
        else:location='No passing parameter set recorded yet'
        page='p6/' if g['family']=='p6' else './'
        lines.append(f"| [{g['familyLabel']} / {g['groupId']}]({page}#{g['groupId']}) | {kind} | {g['maximumChoicesAtFixedParameters']} | {location} |")
    lines += ['', '## What changed in the patterns','',
      'The added searches use oblique reciprocal waves and mixtures of reflected waves. A mixture can change the arrangement while keeping the seed wavelength fixed. Other seeds change the wavelength and the number of cells. The searches correct these seeds against the nonlinear equations.','',
      'For square lattices the seed length is set by a²+b²; for triangular lattices it is a²+ab+b². “Same wavelength” refers to this seed length: nonlinear solutions also contain additional harmonics. The gallery contains concentration waves; these results do not establish Bulatov-style localized gliders.','']
    repeated={(r['family'],r['addedBranchId']) for r in rows if (r.get('construction') or {}).get('type')=='exact-periodic-cell-replication'}
    if repeated:
        lines += ['The gallery also contains an explicitly labelled exact periodic-cell repetition with unchanged physical grid spacing. It is independently checked again in the larger cell and adds a choice at those parameters; it is not a newly discovered morphology. The construction and source parameters are preserved in its metadata.','']
    branch_groups=defaultdict(list)
    for r in rows:
        if r['addedBranchId']:branch_groups[(r['family'],r['addedBranchId'],key(r['parameters']))].append(r)
    lines += ['| Added branch | Groups | F; L | Spatial refinement | Period change | Movie difference / oscillation RMS |','| --- | --- | --- | --- | ---: | ---: |']
    for _,entries in sorted(branch_groups.items()):
        r=entries[0];p=r['parameters'];ref=r['spatialRefinement'] or {};label=r['shapeLabel'] or r['name']
        gids=', '.join(f"{e['groupId']} ({e['visibilityState']})" for e in sorted(entries,key=lambda e:e['groupId']))
        grid=f"{ref.get('coarseGrid','?')}→{ref.get('fineGrid','?')}" if ref else 'not recorded'
        lines.append(f"| [{escape(label)}]({r['metadataPath']}) | {gids} | {number(p['F'])}; {number(p['L'])} | {grid} | {percent(ref.get('relativePeriodDifference'))} | {percent(ref.get('relativeToCoarseTemporalRms'))} |")
    lines += ['', 'The refinement columns compare whole normalized-period movies at fixed physical parameters, Fourier-resampled to the coarse grid. These measured differences are reported rather than hidden; timestep refinement and spatial refinement are different checks. Coordinate copies across groups remain related branches.','',
      '## Checks on the saved fields','',
      'Each referenced Float32 payload was rehashed for this report. Its numerical evidence comes from the independent admission gate: PDE residual, motion, spatial structure, prescribed phase relations, unprojected forward evolution beyond one period, half-timestep integration, and primitive-period checks at resolved divisors. Claimed solver success alone does not qualify.','',
      '| Family | Largest refined return RMS | Largest refined phase RMS | Largest relative PDE residual |','| --- | ---: | ---: | ---: |']
    for family,label,_,_ in FAMILIES:
        evidence=[r['gate'] for r in rows if r['family']==family]
        maximum=lambda k:max((d[k] for d in evidence if d.get(k) is not None),default=None)
        lines.append(f"| {label} | {scientific(maximum('refinedReturnRms'))} | {scientific(maximum('maxRefinedPhaseRms'))} | {percent(maximum('relativePde'))} |")
    lines += ['', 'The visibility check tests only rotations assigned a nonzero phase shift. It compares each displayed concentration separately against the same-time rotated image, using the full-movie color range. Its minimum covers every linear interpolation segment, including the loop seam. Every tested rotation must exceed 5% of each channel’s full color range and an absolute RMS floor of 0.002 (or 100 times the recorded numerical noise, when larger). The thresholds and operation-by-operation results are preserved in the summary. Passing this display criterion is separate from solving the PDE.','',
      'Exact simultaneous rotational invariance of U and V at one instant would persist under the autonomous equivariant flow, by forward uniqueness. Combined with a required nonzero offset, it would imply a shorter period. The existing joint-field phase and primitive-period checks address that exact obstruction. The new visibility criterion also rejects a single displayed channel that becomes nearly symmetric, even though the joint state remains asymmetric.','',
      'Shape comparisons remove continuous time/position shifts, lattice rotations/reflections, spatial means, and overall amplitude scaling. They compare entire movies. Their finite comparison grid and multistart numerical optimization do not prove exhaustive uniqueness.']
    if summary['matchingShapeComparisons']:
        pairs=summary['matchingShapeComparisons'];smallest=min(pairs,key=lambda p:p['amplitudeNormalizedShapeRms'])
        lines += ['',f"For **{len(pairs)} currently matching compared pairs**, the smallest amplitude-normalized shape distance is **{smallest['amplitudeNormalizedShapeRms']:.4f}**. This is partial comparison evidence, not a claim that every saved record is an independent morphology. The pair paths and metrics are preserved in the summary."]
    scope=summary['searchScope'];statuses=scope['statusCounts']
    lines += ['', '## Scope of the recorded search','',
      f"The linked inventories contain **{scope['jobCount']} jobs**: **{statuses.get('completed',0)} in completed batches**, **{statuses.get('launched',0)} in launched/running batches without completion marked**, **{statuses.get('failed',0)} in failed/incomplete batches**, **{statuses.get('planned',0)} planned**, and **{statuses.get('other',0)} with another status**. These are CPU/GPU seed, continuation and spatial-refinement jobs, not counts of independent solutions. A continuation job can contain several nonlinear corrections.",'',
      '| Jobs by batch status | Completed | Launched / running | Failed / incomplete | Planned | Other |','| --- | ---: | ---: | ---: | ---: | ---: |']
    for inventory in scope['inventories']:
        if not inventory['available']:continue
        counts=inventory['statusCounts']
        lines.append(f"| [{inventory['label']}]({inventory['path']}) | {counts.get('completed',0)} | {counts.get('launched',0)} | {counts.get('failed',0)} | {counts.get('planned',0)} | {counts.get('other',0)} |")
    lines += ['', 'Counts reflect batch statuses in those inventories; a historical “launched” label does not mean the app is still running. A failed batch can return some usable job reports, so batch status does not determine individual convergence. Repeated roots, failed attempts and parameter/grid continuations remain search work. See [the compute ledger](research/diversity-compute-ledger.json) for the separate budget accounting.']
    lines += ['', '## Finding more visible time-offset patterns','',
      'Prioritize two independent spatial modes in temporal quadrature, including degenerate reflected stars at the same wavelength. A leading-order single standing mode can pass through a nearly symmetric displayed channel; nonlinear harmonics can prevent this, and the actual saved field must decide acceptance. Multi-shell seeds near a common oscillation frequency provide another route. Keep only the spatial isotropy required by the selected time character, then vary amplitudes and relative phases.','',
      'Deflated Newton has not been implemented in the recorded searches; it is a proposed next step. Continue successful roots in small parameter steps and refine their spatial grids. Deflate already found or weak-contrast roots so repeated searches do not return the same branch. Apply the visibility floor to candidates and verify the original unprojected equations; do not manufacture the contrast with a spatial warp or projection. Parallel GPU batches can test independent seeds, but only admitted, sufficiently distinct fields should enter the gallery.','',
      'These are finite-grid numerical results, not proofs of continuum existence, stability, or uniqueness. A failed search does not prove that the requested symmetry is impossible.','',
      '## Reproduce and inspect','',
      '- [Generate this report](research/report-diversity.py): `python3 research/report-diversity.py` from `scott-gray`; add `--comparison /path/to/audit.json` for matching saved-field comparisons.',
      '- [Whole-atlas diversity audit](research/audit-diversity.py) and [continuous morphology comparison](research/morphology.py).',
      '- [Executed CPU search grid](research/search-grid.json), [442 search plans](research/search-grid-p4.json), [632 GPU search grid](research/p6/search-grid-gpu.json), and [fast candidate visibility screen](research/visible_time_symmetry.py).',
      '- [Prepare coordinate variants with bounded roundoff correction](research/prepare-diversity.py) and [independently admit each saved Float32 field](research/admit-diversity.mjs).',
      '- [442 search notes](research/diversity_p4_notes.md), [632 search documentation](research/p6/README.md), and [diversity search strategy](research/diversity_strategy.md).',
      '- [442 offline catalog builder](research/build-catalog.mjs) and [632 offline catalog builder](research/build-p6-catalog.mjs).','']
    return '\n'.join(lines)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--comparison',type=Path,action='append',default=[]);parser.add_argument('--check',action='store_true')
    args=parser.parse_args();summary=make_summary(args.comparison);text=render(summary);data=json.dumps(summary,indent=2,allow_nan=False)+'\n'
    outputs=[(ROOT/'DIVERSITY.md',text),(ROOT/'data/diversity-summary.json',data)]
    for path,content in outputs:
        if args.check:assert path.read_text()==content,f'Stale diversity report: {path}'
        else:path.write_text(content)
    print(json.dumps({'storedRecords':summary['storedRecordCount'],'visibility':summary['visibilityCounts'],'groups':{g['groupId']:g['maximumChoicesAtFixedParameters'] for g in summary['groups']},'markdownLines':len(text.splitlines())}))

if __name__=='__main__':main()
