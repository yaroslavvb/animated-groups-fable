/** Reproduce the preset screen with Node.js and a C++17 compiler.
 * Usage from repository root: node docs/scott-gray/tests/sample-presets.mjs docs/scott-gray
 * Output: <laboratory>/data/preset-evidence.json. No npm or Python dependencies.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const lab=path.resolve(process.argv[2]||path.join(here,'..'));
const {PROFILES,makeInitial,classifyRun,PRESET_SOURCE}=await import(pathToFileURL(path.join(lab,'exploration.mjs')));
const groups=JSON.parse(fs.readFileSync(path.join(lab,'groups.json'),'utf8'));
const selected=PROFILES.filter(p=>p.featured);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gray-scott-screen-'));
const binary=path.join(tmp,'sample-presets');
const source=path.join(here,'sample-presets.cpp');
execFileSync('c++',['-O3','-std=c++17',source,'-o',binary]);
const evidence={schemaVersion:1,source:PRESET_SOURCE,generatedAt:new Date().toISOString(),
 scope:'Finite-horizon CPU screen of deterministic local seeds. Only the zero-time spatial kernel is imposed. Nonzero time-shift constraints and periodic return are not tested by this screen.',
 interpretation:'Failure of a seed or a numerical trial is not a proof of nonexistence. A moving-pattern classification is not a verified periodic solution. The whole configuration, not just F and k, defines a tested point.',
 threshold:{spatialRmsMinimum:.012,temporalRmsMinimum:.0001,minimumConcentration:-.000001,maximumConcentration:2},
 seedVersion:'local-orbit-geometry-v1',sourceAlgorithm:'Bulatov nine-point stencil, integrated here by explicit midpoint with dt=0.4; upstream uses Euler dt=0.8.',
 seedSourceSha256:createHash('sha256').update(fs.readFileSync(path.join(lab,'exploration.mjs'),'utf8').split('const mod = ')[1].split('export function classifyRun(')[0]).digest('hex'),
 referenceSolverSha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
 runs:[]};
function symmetryRms(state,N,ops){let error=0,count=0;for(const op of ops.filter(o=>o.tau===0))for(let y=0;y<N;y++)for(let x=0;x<N;x++){
 const mx=((Math.round(op.M[0][0]*x+op.M[0][1]*y+op.v[0]*N)%N)+N)%N,my=((Math.round(op.M[1][0]*x+op.M[1][1]*y+op.v[1]*N)%N)+N)%N;
 for(let c=0;c<2;c++){error+=(state[c*N*N+y*N+x]-state[c*N*N+my*N+mx])**2;count++;}
 }return Math.sqrt(error/count);}
try{
 for(const group of groups)for(const profile of selected){
  const context={groupId:group.id,N:64,L:128,Du:.2097,Dv:.105,dt:.4,stencil:'bulatov9',integrator:'midpoint',seed:profile.seed,boundary:'periodic',horizon:2000,observationStart:1800,observationEnd:2000,sampleInterval:50,precision:'float32'};
  const initial=makeInitial(profile,{N:context.N,L:context.L,ops:group.render.ops});
  fs.writeFileSync(path.join(tmp,'initial.f32'),Buffer.from(initial.buffer));
  const stats=JSON.parse(execFileSync(binary,[String(context.N),String(context.L),String(profile.F),String(profile.k),String(context.dt),String(context.horizon),path.join(tmp,'initial.f32'),path.join(tmp,'final.f32')],{encoding:'utf8'}));
  if(stats.finite){
   const buf=fs.readFileSync(path.join(tmp,'final.f32'));const final=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4);
   stats.kernelSymmetryRms=symmetryRms(final,context.N,group.render.ops);
  }else stats.kernelSymmetryRms=null;
  const record={profileId:profile.id,sourceName:profile.sourceName,F:profile.F,k:profile.k,context,stats,classification:classifyRun(stats),verifiedPeriodic:false};
  evidence.runs.push(record);
  process.stdout.write(`${group.id} ${profile.id}: ${record.classification} spatial=${stats.spatialRms.toPrecision(3)} motion=${stats.temporalRms.toPrecision(3)}\n`);
 }
 fs.mkdirSync(path.join(lab,'data'),{recursive:true});
 fs.writeFileSync(path.join(lab,'data/preset-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
