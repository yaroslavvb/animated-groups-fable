import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSolutionAtlas} from '../solution-atlas.mjs';
import {makePreview} from '../seeds.mjs';
import {mapIndex} from '../dynamics.mjs';

const groups=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
const fixture=JSON.parse(readFileSync(new URL('./oscillator.json',import.meta.url)));
const copy=value=>structuredClone(value),mod=(a,n)=>((a%n)+n)%n;
function config(groupId='g96',N=8,M=16){return {groupId,N,M,period:200,L:32,ops:copy(groups.find(g=>g.id===groupId).render.ops),params:{Du:.16,Dv:.08,F:.062,k:.0609,dx:32/N,stencil:'five-point'}};}
function nearlyUncoupledOrbit(groupId='g96'){
  // A numerical positive control, not a glider or a suggested preset:
  // phase-staggered copies of the independently shot chemical oscillator.
  // Tiny positive diffusion perturbs the independent oscillators by <1e-6.
  const N=4,M=fixture.frames.length-1,S=N*N,c=config(groupId,N,M),field=new Float64Array(2*S*M),visited=new Set();
  c.period=fixture.period;c.L=N;c.params={Du:1e-10,Dv:5e-11,F:fixture.feed,k:fixture.kill,dx:1,stencil:'five-point'};
  for(let index=0;index<S;index++){
    if(visited.has(index))continue;
    const orbit=c.ops.map(op=>({index:mapIndex(index%N,Math.floor(index/N),N,op),shift:Math.round(op.tau*M)}));
    for(const point of orbit)visited.add(point.index);
    const full=new Set(orbit.map(point=>point.index)).size===c.ops.length;
    for(const {index:target,shift} of orbit)for(let t=0;t<M;t++){
      const [u,v]=full?fixture.frames[mod(t-shift,M)]:[1,0];field[t*2*S+target]=u;field[t*2*S+S+target]=v;
    }
  }
  return {field,config:c,diagnostics:{validated:false}};
}

test('empty atlas never snaps to an unverified source preset',()=>{
  const atlas=createSolutionAtlas(groups);
  assert.equal(atlas.size(),0);assert.deepEqual(atlas.list('g96'),[]);assert.deepEqual(atlas.summaries('g96'),[]);assert.equal(atlas.nearest('g96',{F:.062,k:.0609}),null);
  assert.equal(atlas.get('forged'),null);assert.equal(atlas.isVerified({id:'forged',config:{groupId:'g96'},diagnostics:{validated:true}}),false);
});

test('stationary or spatial-only fields and forged diagnostics cannot enter the atlas',async()=>{
  const atlas=createSolutionAtlas(groups),c=config('g94'),S=c.N*c.N;
  const homogeneous=new Float64Array(2*S*c.M);for(let t=0;t<c.M;t++)homogeneous.fill(1,t*2*S,t*2*S+S);
  const preview=makePreview({...c,seed:'skate'}),stationary=new Float64Array(preview.length);
  for(let t=0;t<c.M;t++)stationary.set(preview.slice(0,2*S),t*2*S);
  for(const field of [homogeneous,stationary,preview]){
    const result=await atlas.admit({field,config:c,diagnostics:{validated:true,nontrivial:true,closure:{computed:true,closureRms:0},refinedClosure:{computed:true,closureRms:0}}},{groupId:'g94'});
    assert.equal(result.accepted,false);assert.ok(result.reasons.length);
  }
  assert.equal(atlas.size(),0);
});

test('admission uses the selected canonical time character, not the submitted badge or altered operations',async()=>{
  const atlas=createSolutionAtlas(groups),candidate=nearlyUncoupledOrbit('g96');candidate.diagnostics={validated:true};
  const wrongSelection=await atlas.admit(candidate,{groupId:'g95'});assert.equal(wrongSelection.accepted,false);assert.match(wrongSelection.reasons.join(' '),/different selected group/);
  const wrongOps=copy(candidate);wrongOps.config.groupId='g95';assert.equal((await atlas.admit(wrongOps,{groupId:'g95'})).accepted,false);
  const relabelled=copy(candidate);relabelled.config.groupId='g95';relabelled.config.ops=copy(groups.find(g=>g.id==='g95').render.ops);
  const result=await atlas.admit(relabelled,{groupId:'g95'});assert.equal(result.accepted,false);assert.ok(result.reasons.some(reason=>/symmetry|phase/i.test(reason)));
  assert.equal(atlas.size(),0);
});

test('admission checks actual field length, concentrations, lattice length and cancellation',async()=>{
  const atlas=createSolutionAtlas(groups),candidate=nearlyUncoupledOrbit();
  const inconsistent=copy(candidate);inconsistent.config.L*=2;assert.equal((await atlas.admit(inconsistent,{groupId:'g96'})).accepted,false);
  const nonfinite=copy(candidate);nonfinite.field[0]=NaN;assert.equal((await atlas.admit(nonfinite,{groupId:'g96'})).accepted,false);
  for(const species of ['Du','Dv']){const decoupled=copy(candidate);decoupled.config.params[species]=0;assert.equal((await atlas.admit(decoupled,{groupId:'g96'})).accepted,false);}
  assert.equal((await atlas.admit({...candidate,field:[1,0]},{groupId:'g96'})).accepted,false);
  const controller=new AbortController();controller.abort();const cancelled=await atlas.admit(candidate,{groupId:'g96',signal:controller.signal});assert.equal(cancelled.cancelled,true);assert.equal(atlas.size(),0);
});

test('analytic zero-feed exclusion cannot be bypassed by importing a claimed orbit',async()=>{
  const atlas=createSolutionAtlas(groups),candidate=nearlyUncoupledOrbit();candidate.config.params.F=0;
  candidate.diagnostics={validated:true};let phases=0;
  const result=await atlas.admit(candidate,{groupId:'g96',onPhase:()=>phases++});
  assert.equal(result.accepted,false);assert.match(result.reasons.join(' '),/No nonstationary nonnegative periodic Gray–Scott solution exists at F = 0/);
  assert.equal(phases,0);assert.equal(atlas.size(),0);
});

test('repeating a quarter-shift orbit three times cannot relabel its directed time character',async()=>{
  const atlas=createSolutionAtlas(groups),candidate=nearlyUncoupledOrbit('g96'),three=new Float64Array(3*candidate.field.length);
  for(let repeat=0;repeat<3;repeat++)three.set(candidate.field,repeat*candidate.field.length);
  candidate.field=three;candidate.config.M*=3;candidate.config.period*=3;candidate.config.groupId='g97';candidate.config.ops=copy(groups.find(g=>g.id==='g97').render.ops);
  const result=await atlas.admit(candidate,{groupId:'g97'});
  assert.equal(result.accepted,false);assert.ok(result.reasons.some(reason=>/repeat|primitive|shorter|divisor/i.test(reason)),result.reasons.join(' '));assert.equal(atlas.size(),0);
});

test('atlas recomputes full and refined future phases and returns immutable, group-compatible solutions',async()=>{
  const atlas=createSolutionAtlas(groups),candidate=nearlyUncoupledOrbit();let phases=0;
  const result=await atlas.admit(candidate,{groupId:'g96',onPhase:()=>phases++});
  assert.equal(result.accepted,true,result.reasons.join(' '));assert.ok(phases>1);assert.equal(atlas.size('g96'),1);assert.equal(atlas.size('g95'),0);
  const r=result.record,d=r.diagnostics;assert.equal(d.atlasVerification,'recomputed-from-field-v1');assert.equal(d.validated,true);assert.equal(d.independentPhase.passed,true);assert.equal(d.refinedPhase.passed,true);
  assert.ok(d.closure.recordedFrames>r.config.M);assert.equal(d.refinedClosure.steps,2*d.closure.steps);assert.equal(d.refinedClosure.dt,d.closure.dt/2);
  assert.equal(atlas.isVerified(r,'g96'),true);assert.equal(atlas.isVerified(r,'g95'),false);assert.equal(atlas.isVerified(copy(r),'g96'),false);
  assert.throws(()=>{r.field[0]=123;},TypeError);assert.throws(()=>{r.config.params.k=1;},TypeError);assert.throws(()=>{r.config.ops[1].tau=0;},TypeError);
  candidate.field.fill(99);candidate.config.params.F=99;
  const snapped=atlas.nearest('g96',{F:.062,k:.0609});assert.equal(snapped.id,r.id);assert.equal(snapped.config.params.F,fixture.feed);assert.ok(snapped.field.every(value=>value<2));
  assert.equal(atlas.nearest('g95',{F:fixture.feed,k:fixture.kill}),null);assert.equal(atlas.nearest('g96',{F:NaN,k:0}),null);
  const list=atlas.list('g96');list.length=0;assert.equal(atlas.size('g96'),1);
  const second=nearlyUncoupledOrbit(),delta=1e-7;second.config.params.F+=delta;second.config.params.k+=delta;
  const secondResult=await atlas.admit(second,{groupId:'g96'});assert.equal(secondResult.accepted,true,secondResult.reasons.join(' '));
  // On the displayed F∈[0,.2],k∈[0,.08] chart, the first orbit is closer.
  // An unnormalized Euclidean distance would incorrectly choose the second.
  const weighted=atlas.nearest('g96',{F:fixture.feed+.9*delta,k:fixture.kill+.3*delta});assert.equal(weighted.id,r.id);
  // Changing the chart scale must change the nearest displayed point. An
  // isotropic chart and a chart zoomed along F both select the second orbit.
  const point={F:fixture.feed+.9*delta,k:fixture.kill+.3*delta};
  assert.equal(atlas.nearest('g96',point,{scales:{F:1,k:1}}).id,secondResult.id);
  assert.equal(atlas.nearest('g96',point,{scales:{F:.02,k:.08}}).id,secondResult.id);
  for(const scales of [{F:0,k:.08},{F:.2,k:-1},{F:Infinity,k:.08},{F:.2,k:NaN},null])assert.equal(atlas.nearest('g96',point,{scales}),null);
  assert.equal(atlas.nearest('g96',second.config.params).id,secondResult.id);
  const summaries=atlas.summaries('g96');assert.equal(summaries.length,2);assert.deepEqual(Object.keys(summaries[0]).sort(),['config','id']);
  assert.equal(summaries[0].id,r.id);assert.equal(atlas.isVerified(summaries[0]),false);assert.deepEqual(atlas.summaries('g95'),[]);
  assert.throws(()=>{summaries[0].config.params.F=123;},TypeError);assert.throws(()=>{summaries[0].config.ops[1].tau=0;},TypeError);assert.throws(()=>{summaries.push({});},TypeError);
  assert.equal(atlas.get(r.id).config.params.F,fixture.feed);
});

test('cancellation after an asynchronous verification phase leaves no admitted record',async()=>{
  const atlas=createSolutionAtlas(groups),controller=new AbortController();let phases=0;
  const result=await atlas.admit(nearlyUncoupledOrbit(),{groupId:'g96',signal:controller.signal,onPhase:()=>{if(++phases===2)controller.abort();}});
  assert.equal(result.accepted,false);assert.equal(result.cancelled,true);assert.equal(atlas.size(),0);
});
