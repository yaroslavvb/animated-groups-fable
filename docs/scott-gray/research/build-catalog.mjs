#!/usr/bin/env node
/** Build the saved-orbit browser catalog once, away from the browser.
 * Default/--verify: independently integrate and admit every shipped Float32 movie.
 * --check: check source hashes, compact evidence and deterministic thumbnails;
 *          does not repeat integration. Any verifier/source change requires a build.
 */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {basename,relative,resolve,sep} from 'node:path';
import {createSolutionAtlas} from '../solution-atlas.mjs';
import {auditVisibleTimeSymmetry,VISIBILITY_VERSION} from '../visible-time-symmetry.mjs';

export const SCHEMA='scott-gray-precomputed-atlas-v1';
export const GATE_VERSION='recomputed-from-field-v1';
const SITE=new URL('../',import.meta.url),OUTPUT=new URL('data/precomputed-atlas.json',SITE);
const VERIFIER_FILES=['solution-atlas.mjs','core.mjs','phase-audit.mjs','acceptance.mjs','feasibility.mjs'];
const PALETTES={ember:[[0,18,9,39],[.22,65,12,94],[.43,99,25,116],[.58,171,45,90],[.69,240,111,32],[.78,252,181,42],[.89,253,219,94],[1,252,242,158]],ceramic:[[0,91,64,57],[.15,171,111,87],[.33,247,159,119],[.48,239,175,130],[.59,77,41,97],[.68,37,47,120],[.77,117,125,180],[.86,208,213,235],[1,252,249,238]],concentration:[[0,18,18,24],[1,245,245,251]]};
const mod=(a,n)=>((a%n)+n)%n;
export const sha256=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value);
function assert(condition,message){if(!condition)throw Error(message);}
function sitePath(url){const path=relative(fileURLToPath(SITE),fileURLToPath(url)).split(sep).join('/');assert(!path.startsWith('../'),'Catalog paths must stay inside scott-gray.');return path;}
export function decodeField(metadata,binary){
  const values=2*metadata.config.N**2*metadata.config.M;
  assert(metadata.schema==='scott-gray-orbit-binary-v1','Expected a saved binary orbit.');
  assert(metadata.fieldEncoding==='float32-le','Expected little-endian Float32 samples.');
  assert(metadata.fieldValueCount===values&&metadata.fieldByteLength===4*values&&binary.length===4*values,'Orbit dimensions do not match its exact binary size.');
  assert(sha256(binary)===metadata.fieldSha256,'Orbit SHA-256 does not match its saved metadata.');
  const field=new Float32Array(values);
  for(let i=0;i<values;i++){field[i]=binary.readFloatLE(4*i);assert(Number.isFinite(field[i]),'Orbit contains non-finite samples.');}
  return field;
}
export function concentrationRanges(field,N,M){
  const ranges={u:[Infinity,-Infinity],v:[Infinity,-Infinity]},S=N*N;
  for(let t=0;t<M;t++)for(let c=0;c<2;c++){const r=ranges[c?'v':'u'];for(let i=0;i<S;i++){const value=field[t*2*S+c*S+i];r[0]=Math.min(r[0],value);r[1]=Math.max(r[1],value);}}
  assert(Object.values(ranges).every(([lo,hi])=>Number.isFinite(lo)&&Number.isFinite(hi)&&hi>lo),'Thumbnails require nonconstant finite ranges.');return ranges;
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const body=Buffer.concat([Buffer.from(type),data]),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc32(body));return Buffer.concat([head,body,tail]);}
export function encodePng(width,height,rgba){
  assert(rgba.length===4*width*height,'Wrong thumbnail pixel count.');
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const scan=Buffer.alloc(height*(4*width+1));for(let y=0;y<height;y++)scan.set(rgba.subarray(y*4*width,(y+1)*4*width),y*(4*width+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
/** Same 1024-entry palette and periodic lattice-node alignment as render.mjs.
 * Bilinear filtering interpolates colors at phase zero, with two repeated cells.
 */
export function thumbnail(field,N,ranges,palette,{size=160,tiles=2}={}){
  const stops=PALETTES[palette];assert(stops,'Unknown thumbnail palette.');
  const colours=Array.from({length:1024},(_,i)=>{const value=i/1023;let j=1;while(j<stops.length-1&&stops[j][0]<value)j++;const a=stops[j-1],b=stops[j],f=(value-a[0])/(b[0]-a[0]);return [1,2,3].map(c=>Math.round(a[c]+(b[c]-a[c])*f));});
  const S=N*N,channel=palette==='concentration'?1:0,[lo,hi]=ranges[channel?'v':'u'];
  const node=Array.from({length:S},(_,i)=>colours[Math.max(0,Math.min(1023,Math.round((field[channel*S+i]-lo)/(hi-lo)*1023)))]);
  const rgba=Buffer.alloc(4*size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sx=(x+.5)*tiles*N/size,sy=(y+.5)*tiles*N/size,x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0,index=4*(y*size+x);
    for(let c=0;c<3;c++){let value=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)value+=(dx?fx:1-fx)*(dy?fy:1-fy)*node[mod(y0+dy,N)*N+mod(x0+dx,N)][c];rgba[index+c]=Math.round(value);}rgba[index+3]=255;
  }
  return encodePng(size,size,rgba);
}
function pick(object,names){return Object.fromEntries(names.filter(name=>object[name]!==undefined).map(name=>[name,object[name]]));}
export function compactDiagnostics(d){
  const out=pick(d,['N','M','period','pdeRms','relativePde','symmetryMax','symmetry','temporalRms','spatialRms','minimum','maximum','nontrivial','faithfulTimeShifts','thresholds','refinementRms','phaseUncertaintyRms','atlasVerification','validated','reasons','status']);
  for(const name of ['closure','refinedClosure'])out[name]=Object.fromEntries(Object.entries(d[name]).filter(([key])=>key!=='finalState'));
  for(const name of ['candidatePhase','independentPhase','refinedPhase']){
    out[name]=pick(d[name],['passed','reasons','N','M','independentForwardFrames','primitiveAtResolvedDivisors']);
    out[name].operations=d[name].operations.map(operation=>pick(operation,['operation','tau','shiftedRms','sameTimeRms','phaseRms','contrastFloor','passed']));
  }
  assert(out.validated===true&&out.reasons.length===0,'Cannot precompute an unverified orbit.');
  assert(['candidatePhase','independentPhase','refinedPhase'].every(name=>out[name].passed),'Every canonical phase audit must pass.');
  assert(out.refinedPhase.independentForwardFrames===true&&out.refinedPhase.primitiveAtResolvedDivisors===true,'Independent forward and primitive-period evidence is required.');
  return out;
}
export function normalizedConfig(raw,ops){
  const params={Du:.16,Dv:.08,F:.026,k:.055,dx:1,stencil:'five-point',...raw.params},L=raw.N*params.dx;
  assert(raw.L===undefined||(Number.isFinite(raw.L)&&Math.abs(raw.L-L)<=1e-10*Math.max(1,L)),'Physical cell length does not agree with N × dx.');
  return{N:raw.N,M:raw.M,period:raw.period,L,groupId:raw.groupId,seed:typeof raw.seed==='string'?raw.seed:'submitted-field',params,ops,minTemporal:.008,minSpatial:.012};
}
async function inputFingerprint(){
  const sources=await Promise.all(VERIFIER_FILES.map(async name=>({name,sha256:sha256(await readFile(new URL(name,SITE)))})));
  return sha256(json(sources));
}
function makeEntry(source,metadata,metadataUrl,config,diagnostics,field,verificationCodeSha256){
  const stem=basename(metadataUrl.pathname,'.json'),ranges=concentrationRanges(field,config.N,config.M);
  const thumbnails=Object.fromEntries(Object.keys(PALETTES).map(palette=>[palette,`data/thumbnails/${stem}-${palette}.png`]));
  return{id:`saved:${stem}`,groupId:source.groupId,config,name:source.name??'Periodic wave',patternName:source.patternName??source.name?.split(' · F')[0]??'Periodic wave',description:source.description??source.name??'',metadataUrl:sitePath(metadataUrl),fieldUrl:sitePath(new URL(metadata.fieldUrl,metadataUrl)),fieldSha256:metadata.fieldSha256,fieldByteLength:metadata.fieldByteLength,fieldValueCount:metadata.fieldValueCount,fieldEncoding:'float32-le',ranges,diagnostics,offlineVerification:{gateVersion:GATE_VERSION,passed:true,fieldSha256:metadata.fieldSha256,configSha256:sha256(json(config)),verificationCodeSha256},thumbnails};
}
export async function buildCatalog({check=false,incremental=false,log=console.log}={}){
  const [manifestBytes,groupBytes]=await Promise.all([readFile(new URL('data/verified-orbits.json',SITE)),readFile(new URL('groups.json',SITE))]);
  const manifest=JSON.parse(manifestBytes),groups=JSON.parse(groupBytes),verificationCodeSha256=await inputFingerprint();
  const existing=check||incremental?JSON.parse(await readFile(OUTPUT)):null;
  const catalog={schema:SCHEMA,gateVersion:GATE_VERSION,preferredGroup:manifest.preferredGroup,preferredParameters:manifest.preferredParameters,description:'Precomputed parameter sets and periodic fields. Each saved Float32 movie passed the complete independent numerical acceptance gate during this offline build. Browser playback checks payload integrity without re-integrating the equations.',sourceManifestSha256:sha256(manifestBytes),groupsSha256:sha256(groupBytes),verificationCodeSha256,orbits:[]};
  catalog.visibilityPolicyVersion=VISIBILITY_VERSION;catalog.visibilityCodeSha256=sha256(await readFile(new URL('visible-time-symmetry.mjs',SITE)));
  if(check)for(const key of ['visibilityPolicyVersion','visibilityCodeSha256'])assert(existing[key]===catalog[key],`Gallery visibility policy is stale: ${key}.`);
  if(check){for(const key of ['schema','gateVersion','sourceManifestSha256','groupsSha256','verificationCodeSha256'])assert(existing[key]===catalog[key],`Precomputed catalog is stale: ${key}. Run node research/build-catalog.mjs --verify.`);assert(existing.orbits.length===manifest.orbits.length,'Precomputed orbit count is stale.');}
  else await mkdir(new URL('data/thumbnails/',SITE),{recursive:true});
  const seen=new Set();
  for(let index=0;index<manifest.orbits.length;index++){
    const source=manifest.orbits[index],metadataUrl=new URL(source.url,SITE),metadata=JSON.parse(await readFile(metadataUrl)),binary=await readFile(new URL(metadata.fieldUrl,metadataUrl));
    assert(metadata.config.groupId===source.groupId,'Manifest and metadata groups disagree.');
    const canonical=groups.find(group=>group.id===source.groupId);assert(canonical&&json(metadata.config.ops)===json(canonical.render.ops),'Orbit operations must match the canonical color group.');
    const field=decodeField(metadata,binary);let config,diagnostics;
    if(check){config=normalizedConfig(metadata.config,canonical.render.ops);diagnostics=compactDiagnostics(existing.orbits[index].diagnostics);}
    else if(incremental&&existing.verificationCodeSha256===verificationCodeSha256&&existing.orbits.some(e=>e.id===`saved:${basename(metadataUrl.pathname,'.json')}`&&e.fieldSha256===metadata.fieldSha256&&json(e.config)===json(normalizedConfig(metadata.config,canonical.render.ops)))){
      const previous=existing.orbits.find(e=>e.id===`saved:${basename(metadataUrl.pathname,'.json')}`);
      config=normalizedConfig(metadata.config,canonical.render.ops);diagnostics=compactDiagnostics(previous.diagnostics);
      assert(previous.offlineVerification?.passed===true&&previous.offlineVerification.gateVersion===GATE_VERSION&&previous.offlineVerification.verificationCodeSha256===verificationCodeSha256&&previous.offlineVerification.fieldSha256===metadata.fieldSha256&&previous.offlineVerification.configSha256===sha256(json(config)),'Cached evidence must match the exact field, configuration, gate and verifier code.');
    }else{
      const result=await createSolutionAtlas(groups).admit({field,config:metadata.config},{groupId:source.groupId});
      assert(result.accepted,`${source.url}: ${result.reasons.join(' ')}`);config=result.record.config;diagnostics=compactDiagnostics(result.record.diagnostics);
    }
    const entry=makeEntry(source,metadata,metadataUrl,config,diagnostics,field,verificationCodeSha256);
    entry.visibleTimeSymmetry=auditVisibleTimeSymmetry({field,...config,noiseRms:diagnostics.phaseUncertaintyRms??0});
    assert(entry.visibleTimeSymmetry.passed,`${source.url}: remove from gallery; ${entry.visibleTimeSymmetry.reasons.join(' ')}`);
    assert(!seen.has(entry.id),'Duplicate saved orbit identifier.');seen.add(entry.id);
    for(const [palette,path] of Object.entries(entry.thumbnails)){
      const png=thumbnail(field,config.N,entry.ranges,palette),target=new URL(path,SITE);
      if(check)assert((await readFile(target)).equals(png),`Precomputed thumbnail is stale: ${path}`);else await writeFile(target,png);
    }
    catalog.orbits.push(entry);if(!check)log(`[${index+1}/${manifest.orbits.length}] ${entry.id}: verified; return RMS ${diagnostics.refinedClosure.closureRms.toExponential(3)}`);
  }
  const serialized=json(catalog)+'\n';
  if(check){assert((await readFile(OUTPUT,'utf8'))===serialized,'Precomputed catalog metadata/evidence differs from deterministic build.');
    const expected=new Set(catalog.orbits.flatMap(entry=>Object.values(entry.thumbnails).map(path=>basename(path))));
    const found=await readdir(new URL('data/thumbnails/',SITE));assert(found.filter(name=>name.endsWith('.png')).every(name=>expected.has(name)),'Unexpected stale thumbnail: remove it before delivery.');
  }else await writeFile(OUTPUT,serialized);
  log(`${check?'Checked':'Built'} ${catalog.orbits.length} offline-verified records; ${Buffer.byteLength(serialized)} catalog bytes; ${catalog.orbits.length*3} thumbnails.`);return catalog;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2);assert(args.length<=1&&args.every(arg=>['--check','--verify','--incremental'].includes(arg)),'Usage: node research/build-catalog.mjs [--verify | --check | --incremental]');
  await buildCatalog({check:args.includes('--check'),incremental:args.includes('--incremental')});
}
