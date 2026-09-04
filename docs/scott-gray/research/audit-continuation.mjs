#!/usr/bin/env node
/** Independently verify and export the actual Float32 continuation payloads.
 * This file belongs in scott-gray/research beside continue_orbits.py. Its
 * default site root is the parent directory; --site-root supports test copies.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const argv=process.argv.slice(2),input=argv.shift();
if(!input)throw Error('Usage: node audit-continuation.mjs candidates.json --output bundles [--site-root ../scott-gray]');
let primaryOnly=false,output='continued-bundles',urlPrefix='data/orbits/',siteRoot=fileURLToPath(new URL('..',import.meta.url));
for(let i=0;i<argv.length;i++){
 if(argv[i]==='--output')output=argv[++i];
 else if(argv[i]==='--site-root')siteRoot=argv[++i];
 else if(argv[i]==='--url-prefix')urlPrefix=argv[++i];
 else if(argv[i]==='--primary-only')primaryOnly=true;
 else throw Error('Unknown argument: '+argv[i]);
}
const directory=dirname(resolve(input)),outdir=resolve(output);mkdirSync(outdir,{recursive:true});
const {createSolutionAtlas}=await import(pathToFileURL(resolve(siteRoot,'solution-atlas.mjs')));
const {createProblem}=await import(pathToFileURL(resolve(siteRoot,'core.mjs')));
const groups=JSON.parse(readFileSync(resolve(siteRoot,'groups.json'))),inputManifest=JSON.parse(readFileSync(resolve(input)));
if(inputManifest.schema!=='scott-gray-continuation-candidates-v1'||!Array.isArray(inputManifest.candidates))throw Error('Expected a continuation candidate manifest.');
const manifest={schema:'scott-gray-verified-atlas-v1',description:'Each listed Float32 field passed independent canonical phase and PDE checks. Coordinate variants remain members of the same underlying branch.',orbits:[]},failures=[];
const thresholds={maximumProjectionMax:1e-8,maximumForwardErrorRms:1e-6,maximumRefinedReturnRms:1e-6,maximumRefinedTrajectoryRms:1e-6,maximumRefinedPhaseRms:1e-6};
function rmsDifference(a,b){let sum=0,max=0;for(let i=0;i<a.length;i++){const d=a[i]-b[i];sum+=d*d;max=Math.max(max,Math.abs(d));}return {rms:Math.sqrt(sum/a.length),max};}
function readField(source,path){
 if(Array.isArray(source.field))return Float64Array.from(source.field);
 const encoding=source.fieldEncoding??'float64-le',bytes=readFileSync(resolve(dirname(path),source.fieldUrl??basename(path).replace(/\.json$/,'.f64')));
 if(!['float64-le','float32-le'].includes(encoding))throw Error('Unsupported field encoding.');
 const size=encoding==='float32-le'?4:8;if(bytes.length%size)throw Error('Truncated binary field.');
 return Float64Array.from({length:bytes.length/size},(_,i)=>size===4?bytes.readFloatLE(i*size):bytes.readDoubleLE(i*size));
}
for(const item of inputManifest.candidates){
 const sourcePath=resolve(directory,item.url),source=JSON.parse(readFileSync(sourcePath)),raw=readField(source,sourcePath),family=item.family??source.family;
 const standing=family==='standing',baseGroup=standing?'g95':'g96';
 if(!['standing','rotating'].includes(family)||source.config.groupId!==baseGroup)throw Error('Expected a canonical g95/g96 branch field.');
 const {N,M}=source.config,S=N*N;if(raw.length!==2*S*M)throw Error('Incorrect full-field length.');
 for(const groupId of (primaryOnly?[baseGroup]:standing?['g95','g98','g94']:['g96','g97','g99'])){
  try{
   const transformed=new Float64Array(raw.length);
   for(let t=0;t<M;t++)for(let ch=0;ch<2;ch++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    let xx=x,yy=y;
    if(standing&&groupId!=='g95')yy=(y+N/2)%N;
    if(groupId==='g97')xx=(N-x)%N;
    if(groupId==='g99'){xx=(2*N-x-N/4)%N;yy=(y+N/2)%N;}
    transformed[t*2*S+ch*S+y*N+x]=raw[t*2*S+ch*S+yy*N+xx];
   }
   const config={...source.config,groupId,ops:groups.find(group=>group.id===groupId).render.ops};
   const projected=createProblem(config).project(transformed),projection=rmsDifference(projected,transformed);
   if(projection.max>thresholds.maximumProjectionMax)throw Error('Canonical projection materially changes the independently shot orbit.');
   const field=Float32Array.from(projected),quantization=rmsDifference(field,projected),bytes=Buffer.alloc(field.length*4);
   for(let i=0;i<field.length;i++)bytes.writeFloatLE(field[i],i*4);
   // Admit the decoded export bytes, not a higher-precision pre-export field.
   const decoded=Float64Array.from({length:field.length},(_,i)=>bytes.readFloatLE(i*4));
   const atlas=createSolutionAtlas(groups),start=performance.now(),result=await atlas.admit({field:decoded,config},{groupId,onPhase:message=>console.log(config.params.F,groupId,message)});
   if(!result.accepted)throw Error(result.reasons.join(' '));
   const d=result.record.diagnostics,maxPhase=Math.max(...d.refinedPhase.operations.map(op=>op.shiftedRms));
   const forwardErrors=[d.closure.closureRms,d.closure.trajectoryRms,d.refinedClosure.closureRms,d.refinedClosure.trajectoryRms,...d.independentPhase.operations.map(op=>op.shiftedRms),...d.refinedPhase.operations.map(op=>op.shiftedRms)];
   if(forwardErrors.some(value=>!Number.isFinite(value)||value>thresholds.maximumForwardErrorRms))throw Error('Actual forward return, trajectory or phase error exceeds the stricter export limit.');
   if(d.refinedClosure.closureRms>thresholds.maximumRefinedReturnRms||d.refinedClosure.trajectoryRms>thresholds.maximumRefinedTrajectoryRms||maxPhase>thresholds.maximumRefinedPhaseRms)throw Error('The candidate passes the common gate but exceeds the stricter export error limits.');
   const name=basename(sourcePath).replace(/\.json$/,'').replace(baseGroup+'-',groupId+'-'),binaryName=name+'.f32';
   const validationSummary={period:config.period,spatialGrid:N,timeFrames:M,relativePde:d.relativePde,pdeRms:d.pdeRms,candidateSymmetryMax:d.symmetryMax,temporalRms:d.temporalRms,spatialRms:d.spatialRms,coarseReturnRms:d.closure.closureRms,refinedReturnRms:d.refinedClosure.closureRms,refinedTrajectoryRms:d.refinedClosure.trajectoryRms,maxRefinedPhaseRms:maxPhase,coarseDt:d.closure.dt,refinedDt:d.refinedClosure.dt,primitiveAtResolvedDivisors:d.refinedPhase.primitiveAtResolvedDivisors,projectionRms:projection.rms,projectionMax:projection.max,quantizationMax:quantization.max,admissionElapsedMs:performance.now()-start};
   const metadata={schema:'scott-gray-orbit-binary-v1',config,fieldUrl:binaryName,fieldEncoding:'float32-le',fieldLayout:'frame-major; planar U then V; x-fast; lattice nodes i/N,j/N',fieldValueCount:field.length,fieldByteLength:bytes.length,fieldSha256:createHash('sha256').update(bytes).digest('hex'),validationSummary,provenance:{method:source.method,seed:source.seed,family,spatialMode:source.spatialMode??1,tiledFrom:source.tiledFrom??null,sourceGroup:baseGroup,coordinateTransform:standing?(groupId==='g95'?'identity':'q(x,y+1/2,t)'):(groupId==='g96'?'identity':groupId==='g97'?'q(-x,y,t)':'q(-x-1/4,y-1/2,t)'),unquantizedShootingResidualRms:source.shootingResidualRms??source.gpuResidualRms,unquantizedReturnRms:source.fullReturnRms,extraSymmetry:source.extraSymmetry,note:'Coordinate variants of one continued branch; actual exported Float32 bytes independently revalidated. No glider morphology or continuum existence theorem is asserted.',spatialRefinement:source.spatialRefinement??source.refinement??null,exportThresholds:thresholds}};
   writeFileSync(resolve(outdir,binaryName),bytes);writeFileSync(resolve(outdir,name+'.json'),JSON.stringify(metadata,null,2));
   writeFileSync(resolve(outdir,name+'-audit.json'),JSON.stringify({accepted:true,config,diagnostics:d}));
   manifest.orbits.push({groupId,url:urlPrefix+name+'.json',name:`${standing?'Standing':'Rotating'} ${source.spatialMode>1?'mode '+source.spatialMode:'wave'} · F ${config.params.F} · k ${config.params.k}`});
   console.log(JSON.stringify({accepted:true,groupId,F:config.params.F,refinedReturnRms:d.refinedClosure.closureRms,maxRefinedPhaseRms:maxPhase}));
  }catch(error){failures.push({groupId,F:source.config.params.F,reason:error.message});console.log(JSON.stringify(failures.at(-1)));}
 }
}
writeFileSync(resolve(outdir,'verified-orbits.json'),JSON.stringify(manifest,null,2));
writeFileSync(resolve(outdir,'failures.json'),JSON.stringify(failures,null,2));
console.log(`${manifest.orbits.length} accepted exports; ${failures.length} rejected. Only accepted entries appear in verified-orbits.json.`);
if(!manifest.orbits.length)process.exitCode=1;
