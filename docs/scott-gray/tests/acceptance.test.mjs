import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblem} from '../core.mjs';
import {hasRefinedAcceptance,refinedShootingOptions} from '../acceptance.mjs';
// A synthetic complete evidence schema, not a recorded Gray–Scott orbit.
function fixture(){
 const closure={computed:true,steps:80,dt:.1,closureRms:.001,closureURms:.001,closureVRms:.001,closureMax:.003,relativeClosure:.01,trajectoryRms:.001,trajectoryMax:.003,relativeTrajectory:.01,finalState:new Float64Array(32).fill(.5)};
 return {validated:true,nontrivial:true,faithfulTimeShifts:true,reasons:[],N:4,M:4,period:8,temporalRms:.03,spatialRms:.04,minimum:.1,maximum:.9,pdeRms:1e-5,relativePde:.001,symmetryMax:0,symmetry:[{operation:0,rms:0,max:0}],
  thresholds:{pdeRms:2e-4,relativePde:.05,symmetryMax:1e-10,closureRms:.01,relativeClosure:.1,trajectoryRms:.01,relativeTrajectory:.1},
  closure,refinedClosure:{...closure,steps:160,dt:.05,finalState:closure.finalState.slice()}};
}
test('acceptance requires complete finite metrics in both independent integrations',()=>{
 assert.equal(hasRefinedAcceptance(fixture()),true);
 for(const pass of ['closure','refinedClosure'])for(const key of ['dt','closureRms','closureURms','closureVRms','closureMax','relativeClosure','trajectoryRms','trajectoryMax','relativeTrajectory']){
  for(const value of [NaN,Infinity,undefined]){const d=fixture();d[pass][key]=value;assert.equal(hasRefinedAcceptance(d),false,`${pass}.${key}=${value}`);}
 }
 const d=fixture();d.refinedClosure.finalState[0]=NaN;assert.equal(hasRefinedAcceptance(d),false);
});
test('unchanged, insufficiently refined or partial-period integrations never pass',()=>{
 for(const changed of [{dt:.1,steps:80},{dt:8/120,steps:120},{dt:.05,steps:80},{computed:false}]){
  const d=fixture();Object.assign(d.refinedClosure,changed);assert.equal(hasRefinedAcceptance(d),false);
 }
 const d=fixture();delete d.refinedClosure;assert.equal(hasRefinedAcceptance(d),false);
});
test('positive acceptance gates reject stale validation flags and unphysical or trivial candidates',()=>{
 for(const changed of [{pdeRms:NaN},{relativePde:.3},{symmetryMax:1},{temporalRms:0},{spatialRms:0},{minimum:-1},{maximum:NaN},{faithfulTimeShifts:false},{nontrivial:false},{reasons:['failed']}]){
  const d=Object.assign(fixture(),changed);assert.equal(hasRefinedAcceptance(d),false);
 }
 const lax=fixture();lax.thresholds.closureRms=10;lax.refinedClosure.closureRms=.2;assert.equal(hasRefinedAcceptance(lax),false);
 const failed=fixture();failed.refinedClosure.relativeTrajectory=.11;assert.equal(hasRefinedAcceptance(failed),false);
});
test('refinement halves the actual diffusion-limited shooting step',()=>{
 const N=4,M=4,problem=createProblem({N,M,params:{Du:.16,Dv:.08,F:.062,k:.0609,dx:.1}}),field=new Float64Array(2*N*N*M);
 for(let t=0;t<M;t++)field.fill(1,t*2*N*N,t*2*N*N+N*N);
 const coarse=problem.shoot(field,1,{shootingDt:.4}),nominalFine=problem.shoot(field,1,{shootingDt:.2});
 assert.equal(coarse.computed,true);assert.equal(coarse.dt,nominalFine.dt,'fixed requested .4/.2 steps collapse to the same diffusion cap');
 const options=refinedShootingOptions(coarse),fine=problem.shoot(field,1,options);
 assert.equal(options.shootingDt,coarse.dt/2);assert.equal(options.shootingSteps,2*coarse.steps);
 assert.equal(fine.computed,true);assert.ok(fine.dt<=coarse.dt/2);assert.ok(fine.steps>=2*coarse.steps);
 assert.throws(()=>refinedShootingOptions({computed:false}),/completed coarse/);
});
