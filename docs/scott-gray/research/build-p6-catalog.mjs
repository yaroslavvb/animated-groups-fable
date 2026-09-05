#!/usr/bin/env node
/** Offline 632 admission and deterministic browser assets. Never used on load.
 * --verify independently audits all exact saved Float32 fields.
 * --check checks hashes, saved evidence, metadata and rendered thumbnails only.
 */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {basename,relative,resolve,sep} from 'node:path';
import {sha256,decodeField,encodePng,concentrationRanges,compactDiagnostics} from './build-catalog.mjs';
import {verifyCandidate,normalizeConfig,GATE_VERSION} from '../p6/verify.mjs';
import {renderPixels} from '../p6/playback.mjs';
import {auditVisibleTimeSymmetry,VISIBILITY_VERSION} from '../visible-time-symmetry.mjs';

const ROOT=new URL('../p6/',import.meta.url),OUTPUT=new URL('data/precomputed-atlas.json',ROOT);
const SCHEMA='scott-gray-precomputed-atlas-v1',PALETTES=['ember','ceramic','concentration'];
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const json=value=>JSON.stringify(value);
function inside(url){const path=relative(fileURLToPath(ROOT),fileURLToPath(url)).split(sep).join('/');assert(!path.startsWith('../'),'632 assets must stay inside p6.');return path;}
async function fingerprints(){
  const files=['verify.mjs','phase-audit.mjs','../feasibility.mjs'];
  const verifier=await Promise.all(files.map(async name=>({name,sha256:sha256(await readFile(new URL(name,ROOT)))})));
  return{verificationCodeSha256:sha256(json(verifier)),thumbnailCodeSha256:sha256(await readFile(new URL('playback.mjs',ROOT)))};
}
function compact(d){return{...compactDiagnostics(d),relativeRefinement:d.relativeRefinement,caveat:d.caveat};}

export async function buildP6Catalog({check=false,incremental=false,log=console.log}={}){
  const [manifestBytes,groupsBytes,code]=await Promise.all([readFile(new URL('data/candidate-orbits.json',ROOT)),readFile(new URL('groups.json',ROOT)),fingerprints()]);
  const manifest=JSON.parse(manifestBytes),groups=JSON.parse(groupsBytes),old=check||incremental?JSON.parse(await readFile(OUTPUT)):null;
  assert(Array.isArray(manifest.orbits),'Candidate manifest must list its orbits.');
  const catalog={schema:SCHEMA,family:'p6',gateVersion:GATE_VERSION,preferredGroup:manifest.preferredGroup??'g248',preferredParameters:manifest.preferredParameters,
    description:'Precomputed periodic Gray–Scott fields on the triangular lattice. Every exact saved Float32 field passed an independent JavaScript PDE, space–time character, primitive-period, extended forward-trajectory and half-timestep audit offline. Browsing only checks selected payload integrity.',
    sourceManifestSha256:sha256(manifestBytes),groupsSha256:sha256(groupsBytes),...code,orbits:[]};
  catalog.visibilityPolicyVersion=VISIBILITY_VERSION;catalog.visibilityCodeSha256=sha256(await readFile(new URL('../visible-time-symmetry.mjs',ROOT)));
  if(check)for(const key of ['visibilityPolicyVersion','visibilityCodeSha256'])assert(old[key]===catalog[key],`632 gallery visibility policy is stale: ${key}.`);
  if(check){
    for(const key of ['schema','family','gateVersion','sourceManifestSha256','groupsSha256','verificationCodeSha256','thumbnailCodeSha256'])assert(old[key]===catalog[key],`Precomputed 632 catalog is stale: ${key}. Run node research/build-p6-catalog.mjs --verify.`);
    assert(old.orbits.length===manifest.orbits.length,'632 orbit count is stale.');
  }else await mkdir(new URL('data/thumbnails/',ROOT),{recursive:true});
  const seen=new Set();
  for(const [index,source] of manifest.orbits.entries()){
    const metadataUrl=new URL(source.url,ROOT),metadata=JSON.parse(await readFile(metadataUrl)),fieldUrl=new URL(metadata.fieldUrl,metadataUrl),binary=await readFile(fieldUrl);
    assert(metadata.config.groupId===source.groupId,'Candidate manifest and metadata group disagree.');
    const group=groups.find(g=>g.id===source.groupId);assert(group,'Unknown 632 character.');
    assert(json(metadata.config.ops)===json(group.render.ops),'Candidate must use the exact canonical 632 operations.');
    const field=decodeField(metadata,binary);let config,diagnostics;
    if(check){config=normalizeConfig(metadata.config);diagnostics=compact(old.orbits[index].diagnostics);}
    else if(incremental&&old.verificationCodeSha256===code.verificationCodeSha256&&old.orbits.some(e=>e.id===`saved:${basename(metadataUrl.pathname,'.json')}`&&e.fieldSha256===metadata.fieldSha256&&json(e.config)===json(normalizeConfig(metadata.config)))){
      const previous=old.orbits.find(e=>e.id===`saved:${basename(metadataUrl.pathname,'.json')}`);
      config=normalizeConfig(metadata.config);diagnostics=compact(previous.diagnostics);
      assert(previous.offlineVerification?.passed===true&&previous.offlineVerification.gateVersion===GATE_VERSION&&previous.offlineVerification.verificationCodeSha256===code.verificationCodeSha256&&previous.offlineVerification.fieldSha256===metadata.fieldSha256&&previous.offlineVerification.configSha256===sha256(json(config)),'Cached evidence must match the exact field, configuration, gate and verifier code.');
    }else{
      const result=await verifyCandidate({config:metadata.config,field});
      assert(result.accepted,`${source.url}: ${result.reasons.join(' ')}`);config=result.record.config;diagnostics=compact(result.diagnostics);
    }
    const stem=basename(metadataUrl.pathname,'.json'),ranges=concentrationRanges(field,config.N,config.M);
    const thumbnails=Object.fromEntries(PALETTES.map(p=>[p,`data/thumbnails/${stem}-${p}.png`]));
    const entry={id:`saved:${stem}`,groupId:source.groupId,config,name:source.name??'Periodic triangular wave',patternName:source.patternName??source.name??'Periodic triangular wave',description:source.description??metadata.description??'',
      metadataUrl:inside(metadataUrl),fieldUrl:inside(fieldUrl),fieldEncoding:'float32-le',fieldSha256:metadata.fieldSha256,fieldByteLength:metadata.fieldByteLength,fieldValueCount:metadata.fieldValueCount,
      ranges,diagnostics,offlineVerification:{gateVersion:GATE_VERSION,passed:true,fieldSha256:metadata.fieldSha256,configSha256:sha256(json(config)),verificationCodeSha256:code.verificationCodeSha256},
      thumbnails,...(metadata.provenance?{provenance:metadata.provenance}:{})};
    entry.visibleTimeSymmetry=auditVisibleTimeSymmetry({field,...config,noiseRms:diagnostics.phaseUncertaintyRms??0});
    assert(entry.visibleTimeSymmetry.passed,`${source.url}: remove from gallery; ${entry.visibleTimeSymmetry.reasons.join(' ')}`);
    assert(!seen.has(entry.id),'Duplicate 632 orbit identifier.');seen.add(entry.id);
    for(const [palette,path] of Object.entries(thumbnails)){
      const pixels=renderPixels({config,field,ranges},0,{width:160,tiles:2,palette}),png=encodePng(160,160,pixels),target=new URL(path,ROOT);
      if(check)assert((await readFile(target)).equals(png),`632 thumbnail is stale: ${path}`);else await writeFile(target,png);
    }
    catalog.orbits.push(entry);
    if(!check)log(`[${index+1}/${manifest.orbits.length}] ${entry.id}: independently verified; return RMS ${diagnostics.refinedClosure.closureRms.toExponential(3)}`);
  }
  const text=json(catalog)+'\n';
  if(check){
    assert((await readFile(OUTPUT,'utf8'))===text,'632 catalog differs from deterministic metadata/evidence build.');
    const expected=new Set(catalog.orbits.flatMap(e=>Object.values(e.thumbnails).map(p=>basename(p))));
    for(const file of await readdir(new URL('data/thumbnails/',ROOT)))assert(!file.endsWith('.png')||expected.has(file),`Stale 632 thumbnail: ${file}`);
  }else await writeFile(OUTPUT,text);
  log(`${check?'Checked':'Built'} ${catalog.orbits.length} offline-verified 632 records; ${Buffer.byteLength(text)} catalog bytes.`);
  return catalog;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2);assert(args.length<=1&&args.every(a=>['--check','--verify','--incremental'].includes(a)),'Usage: node research/build-p6-catalog.mjs [--verify | --check | --incremental]');
  await buildP6Catalog({check:args.includes('--check'),incremental:args.includes('--incremental')});
}
