import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PROFILES,DEFAULT_FILTER,makeInitial,classifyRun,profilesForFilter,nearestProfile,matchingEvidence,assessProfile} from '../exploration.mjs';
const groups=JSON.parse(fs.readFileSync(new URL('../groups.json',import.meta.url)));
const evidence=JSON.parse(fs.readFileSync(new URL('../data/preset-evidence.json',import.meta.url)));
const profile=PROFILES.find(p=>p.id==='u-skate');
const run=evidence.runs.find(r=>r.profileId===profile.id&&r.context.groupId==='g94');
const context={...run.context,F:profile.F,k:profile.k};
test('strict filter starts empty and source values are preserved',()=>{
 assert.equal(DEFAULT_FILTER,'periodic');assert.equal(PROFILES.length,81);
 assert.equal(profile.F,.062);assert.equal(profile.k,.0609);
 assert.equal(PROFILES.find(p=>p.id==='spiral-waves').F,.007457);
 assert.equal(PROFILES.find(p=>p.id==='spiral-waves').k,.033896);
 for(const g of groups)assert.deepEqual(profilesForFilter('periodic',evidence,g.id),[]);
});
test('observed filter checks measurements, source parameters and context rather than labels',()=>{
 const observed={runs:[run]};
 assert.deepEqual(profilesForFilter('observed',observed,'g94'),[profile]);
 assert.deepEqual(profilesForFilter('observed',observed,'g95'),[]);
 for(const broken of [{...run,F:.06},{...run,stats:{...run.stats,temporalRms:0}},{...run,context:{...run.context,horizon:3000}},{profileId:profile.id,classification:'moving-pattern',context:{groupId:'g94'}}]){
  assert.deepEqual(profilesForFilter('observed',{runs:[broken]},'g94'),[]);
 }
 assert.deepEqual(profilesForFilter('observed',observed),[]);
 assert.deepEqual(profilesForFilter('typo',observed,'g94'),[]);
 assert.deepEqual(profilesForFilter('observed',{runs:'malformed'},'g94'),[]);
 assert.equal(nearestProfile(.06,.061,[profile]),profile);assert.equal(nearestProfile(.06,.061,[]),null);
 assert.equal(nearestProfile(.06,.061,[{F:NaN,k:1}]),null);
});
test('seed is deterministic, finite, nonnegative and preserves the instantaneous spatial kernel',()=>{
 const N=32;
 for(const group of groups){
  const a=makeInitial(profile,{N,L:128,ops:group.render.ops});assert.equal(a.length,2*N*N);
  assert.deepEqual(a,makeInitial(profile,{N,L:128,ops:group.render.ops}));
  assert.ok(a.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  for(const op of group.render.ops.filter(o=>o.tau===0))for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   const mx=((Math.round(op.M[0][0]*x+op.M[0][1]*y+op.v[0]*N)%N)+N)%N,my=((Math.round(op.M[1][0]*x+op.M[1][1]*y+op.v[1]*N)%N)+N)%N;
   for(let c=0;c<2;c++)assert.ok(Math.abs(a[c*N*N+y*N+x]-a[c*N*N+my*N+mx])<1e-7,group.id);
  }
 }
});
test('screening distinguishes motion, stationary patterns, decay and incomplete or invalid statistics',()=>{
 const valid={finite:true,minimum:0,maximum:1,spatialRms:.1,temporalRms:.01};
 assert.equal(classifyRun(valid),'moving-pattern');
 assert.equal(classifyRun({...valid,temporalRms:0}),'stationary-pattern');
 assert.equal(classifyRun({...valid,spatialRms:0}),'uniform-or-decayed');
 assert.equal(classifyRun({...valid,finite:false}),'numerical-failure');
 assert.equal(classifyRun({...valid,minimum:-.1}),'out-of-range');
 for(const invalid of [null,{}, {...valid,finite:undefined},{...valid,maximum:undefined},{...valid,minimum:NaN},{...valid,spatialRms:-1}])assert.equal(classifyRun(invalid),'numerical-failure');
});
test('feed, kill, seed, grid and observation horizon all invalidate mismatched evidence',()=>{
 assert.equal(matchingEvidence(profile,context,evidence),run);
 for(const changed of [{N:128},{seed:'spots'},{F:.06001},{k:.06091},{horizon:3000},{observationStart:1700},{sampleInterval:100},{boundary:'fixed'},{precision:'float64'}]){
  assert.equal(matchingEvidence(profile,{...context,...changed},evidence),null,JSON.stringify(changed));
 }
 assert.equal(matchingEvidence({...profile,F:.06},context,evidence),null);
 assert.equal(matchingEvidence(profile,{...context,F:undefined},evidence),null);
 assert.match(assessProfile(profile,context,evidence).message,/1800–2000/);
});

// Synthetic acceptance-schema fixture only; not a recorded chemical orbit.
function periodicFixture(){
 const closure={computed:true,steps:1000,dt:.4,closureRms:.001,relativeClosure:.01,trajectoryRms:.001,relativeTrajectory:.01};
 return {profileId:profile.id,F:profile.F,k:profile.k,context:{...context},verifiedPeriodic:true,
  orbit:{url:'test-fixture-only.f32',sha256:'0'.repeat(64),layout:'planar-uv'},
  diagnostics:{validated:true,nontrivial:true,N:64,M:32,physicalSide:128,stencil:'bulatov9',period:400,
   pdeRms:1e-5,relativePde:.001,symmetryMax:0,temporalRms:.02,spatialRms:.03,minimum:.1,maximum:.9,
   symmetry:Array.from({length:4},(_,operation)=>({operation,rms:0,max:0})),faithfulTimeShifts:true,primitiveAtTestedShifts:true,
   temporalRepeats:[.25,.5,.75].map(shiftFraction=>({shiftFraction,relativeToTemporalVariation:1})),
   closure,refinedClosure:{...closure,steps:2000,dt:.2},reasons:[]}};
}
test('periodic acceptance requires complete independent return, refinement and nontrivial time-symmetry evidence',()=>{
 const valid=periodicFixture();
 assert.deepEqual(profilesForFilter('periodic',{runs:[valid]},'g94'),[profile]);
 assert.deepEqual(profilesForFilter('periodic',{runs:[{...run,verifiedPeriodic:true}]},'g94'),[]);
 for(const field of ['closure','refinedClosure','symmetry','temporalRepeats']){
  const broken=periodicFixture();delete broken.diagnostics[field];assert.deepEqual(profilesForFilter('periodic',{runs:[broken]},'g94'),[],field);
 }
 for(const changed of [{relativePde:1},{temporalRms:0},{spatialRms:0},{faithfulTimeShifts:false},{primitiveAtTestedShifts:false},{minimum:NaN}]){
  const broken=periodicFixture();Object.assign(broken.diagnostics,changed);assert.deepEqual(profilesForFilter('periodic',{runs:[broken]},'g94'),[]);
 }
 const identicalDt=periodicFixture();identicalDt.diagnostics.refinedClosure.dt=.4;
 assert.deepEqual(profilesForFilter('periodic',{runs:[identicalDt]},'g94'),[]);
 const wrongHorizon=periodicFixture();wrongHorizon.diagnostics.refinedClosure.steps=100;
 assert.deepEqual(profilesForFilter('periodic',{runs:[wrongHorizon]},'g94'),[]);
 assert.deepEqual(profilesForFilter('periodic',{runs:[valid]},'g95'),[]);
 assert.deepEqual(profilesForFilter('periodic',{runs:[{...valid,F:.06}]},'g94'),[]);
 assert.deepEqual(profilesForFilter('periodic',{runs:[{...valid,orbit:null}]},'g94'),[]);
});
