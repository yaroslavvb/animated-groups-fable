/** Admit newly prepared branches independently before appending to the atlas. */
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {basename,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeField,compactDiagnostics} from './build-catalog.mjs';
import {createSolutionAtlas} from '../solution-atlas.mjs';
import {verifyCandidate} from '../p6/verify.mjs';
import {auditVisibleTimeSymmetry} from '../visible-time-symmetry.mjs';
import {planRefinementReplacement,replaceManifestEntry} from './refinement-replacements.mjs';

const input=process.argv[2];if(!input)throw Error('Usage: node admit-diversity.mjs /tmp/proposals.json');
const root=fileURLToPath(new URL('../',import.meta.url));
const groups=JSON.parse(await readFile(resolve(root,'groups.json')));
const proposals=JSON.parse(await readFile(input)).proposals,report=[];
for(const source of proposals){
  const metadata=JSON.parse(await readFile(source.path)),binary=await readFile(resolve(dirname(source.path),metadata.fieldUrl)),field=decodeField(metadata,binary);
  if(!['p4','p6'].includes(source.family)||metadata.config.groupId!==source.groupId)throw Error('Proposal family or group does not match its metadata.');
  if(metadata.fieldUrl!==basename(metadata.fieldUrl))throw Error('Prepared payload must use a filename within its orbit directory.');
  const result=source.family==='p6'?await verifyCandidate({config:metadata.config,field}):await createSolutionAtlas(groups).admit({config:metadata.config,field},{groupId:source.groupId});
  const reasons=[...(result.reasons??[])];
  const visibleTimeSymmetry=result.accepted?auditVisibleTimeSymmetry({field,...result.record.config,noiseRms:(result.record.diagnostics??result.diagnostics).phaseUncertaintyRms??0}):null;
  if(visibleTimeSymmetry&&!visibleTimeSymmetry.passed)reasons.push(...visibleTimeSymmetry.reasons);
  const accepted=result.accepted&&visibleTimeSymmetry.passed;
  const outcome={source:source.path,family:source.family,groupId:source.groupId,accepted,reasons};
  if(accepted){
    const site=resolve(root,source.family==='p6'?'p6':'.'),manifestPath=resolve(site,'data',source.family==='p6'?'candidate-orbits.json':'verified-orbits.json');
    let manifest=JSON.parse(await readFile(manifestPath));const name=basename(source.path),outdir=resolve(site,'data/orbits');await mkdir(outdir,{recursive:true});
    const previousByUrl=new Map();
    for(const old of manifest.orbits)if(old.groupId===source.groupId||old.url==='data/orbits/'+name)
      previousByUrl.set(old.url,JSON.parse(await readFile(resolve(site,old.url))));
    const superseded=planRefinementReplacement({manifest,metadata,groupId:source.groupId,destinationUrl:'data/orbits/'+name,previousByUrl});
    metadata.config={...result.record.config,L:metadata.config.L??result.record.config.L};
    metadata.diversityAdmission=compactDiagnostics(result.record.diagnostics??result.diagnostics);
    metadata.visibleTimeSymmetry=visibleTimeSymmetry;
    // Publish the exact bytes decoded and verified above, even if a source file changes while verification runs.
    await writeFile(resolve(outdir,metadata.fieldUrl),binary);await writeFile(resolve(outdir,name),JSON.stringify(metadata,null,2)+'\n');
    const entry={groupId:source.groupId,url:'data/orbits/'+name,name:source.name,patternName:source.name,description:source.description};
    for(const old of superseded){
      // Preserve the coarse field for research, but retire its gallery images.
      for(const palette of ['ember','ceramic','concentration'])try{await unlink(resolve(site,'data/thumbnails',basename(old.url,'.json')+'-'+palette+'.png'));}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    if(superseded.length)outcome.superseded=superseded.map(e=>e.url);
    manifest=replaceManifestEntry(manifest,entry,superseded);
    await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    outcome.refinedReturnRms=metadata.diversityAdmission.refinedClosure.closureRms;
  }
  report.push(outcome);console.log(JSON.stringify(outcome));
  await writeFile(resolve(dirname(input),'admission.json'),JSON.stringify(report,null,2)+'\n');
}
