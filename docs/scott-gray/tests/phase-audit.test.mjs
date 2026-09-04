import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProblem} from '../core.mjs';
import {auditPhases} from '../phase-audit.mjs';

const catalog=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
const groups=Object.fromEntries(catalog.map(g=>[g.id,g.render.ops]));
const tight={absoluteTolerance:1e-10,relativeTolerance:1e-8};

test('complete temporal spectrum preserves mixed species harmonics and Nyquist energy',()=>{
  // Closed-form energies exercise both the radix-two FFT and the other-grid DFT.
  for(const M of [32,48,128]){
    const N=4,S=N*N,field=new Float64Array(2*S*M);
    for(let t=0;t<M;t++)for(let p=0;p<S;p++){
      const phase=2*Math.PI*t/M;
      field[t*2*S+p]=.6+.1*Math.cos(phase)+.02*Math.cos(Math.PI*t);
      field[t*2*S+S+p]=.2+.08*Math.sin(3*phase);
    }
    const d=auditPhases({N,M,field,ops:[{M:[[1,0],[0,1]],v:[0,0],s:1,tau:0}]});
    const expected=new Map([[1,.1**2/4],[3,.08**2/4],[M/2,.02**2/2]]);
    d.temporalEnergies.forEach((energy,k)=>assert.ok(Math.abs(energy-(expected.get(k)??0))<1e-14,`M=${M}, harmonic ${k}`));
    assert.ok(Math.abs(d.temporalEnergies.reduce((a,b)=>a+b,0)-d.temporalRms**2)<1e-14);
  }
});
function smoothSeed(id,{N=8,M=32,harmonic=1}={}){
  const S=N*N,q=new Float64Array(2*S*M),problem=createProblem({N,M,ops:groups[id]});
  for(let t=0;t<M;t++)for(let ch=0;ch<2;ch++)for(let p=0;p<S;p++){
    const a=Math.sin((p+1)*1.717+ch),b=Math.cos((p+1)*.913+ch*2);
    q[t*2*S+ch*S+p]=(ch?.2:.6)+.14*(a*Math.cos(2*Math.PI*harmonic*t/M)+b*Math.sin(2*Math.PI*harmonic*t/M));
  }
  return {N,M,ops:groups[id],field:problem.project(q)};
}
function circulating({N=8,M=32,harmonic=1,hand=1}={}){
  const S=N*N,field=new Float64Array(2*S*M);
  for(let t=0;t<M;t++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const theta=2*Math.PI*harmonic*t/M;
    const f=Math.sin(2*Math.PI*x/N)*Math.cos(theta)+hand*Math.sin(2*Math.PI*y/N)*Math.sin(theta);
    field[t*2*S+y*N+x]=.6+.1*f;field[t*2*S+S+y*N+x]=.2-.05*f;
  }
  return {N,M,field};
}

test('all six canonical colour actions pass whole-field phase checks on smooth constructed movies',()=>{
  // These are analytic symmetry fixtures, not Gray–Scott solutions.
  for(const id of Object.keys(groups)){
    const input=smoothSeed(id),d=auditPhases({...input,...tight});
    assert.equal(d.passed,true,`${id}: ${d.reasons.join(' ')}`);
    assert.equal(d.operations.length,groups[id].length);
    for(const op of d.operations){
      assert.ok(op.shiftedMax<1e-12,id);
      if(op.tau){assert.ok(op.sameTimeRms>op.contrastFloor,id);assert.ok(op.phaseRms>op.contrastFloor,id);}
    }
  }
});

test('ordinary spatial symmetry cannot substitute for g95 or g96 phase symmetry',()=>{
  const input=smoothSeed('g94');
  for(const id of ['g95','g96','g97']){
    const d=auditPhases({...input,ops:groups[id],...tight});
    assert.equal(d.passed,false,id);
    assert.ok(d.operations.some(row=>row.tau&&row.sameTimeRms<1e-12),id);
    assert.ok(d.operations.some(row=>row.tau&&!row.symmetryPassed),id);
  }
  const half=smoothSeed('g95');
  assert.equal(auditPhases({...half,...tight}).passed,true);
  assert.equal(auditPhases({...half,ops:groups.g96,...tight}).passed,false);
});

test('directed quarter phases distinguish g96 from g97, with opposite handedness',()=>{
  for(const [hand,matching,opposite] of [[1,'g96','g97'],[-1,'g97','g96']]){
    const input=circulating({hand});
    assert.equal(auditPhases({...input,ops:groups[matching],...tight}).passed,true);
    const wrong=auditPhases({...input,ops:groups[opposite],...tight});
    assert.equal(wrong.passed,false);
    assert.ok(wrong.operations.some(op=>op.shiftedRms>.05));
  }
});

test('odd multiple of the minimal period cannot relabel the opposite handed colour group',()=>{
  // Three loops of g97 obey the g96 relation if T is mistakenly tripled.
  // M=32 deliberately makes T/3 fall between sampled frames.
  const input=circulating({harmonic:3,hand:-1}),problem=createProblem({...input,ops:groups.g96});
  assert.ok(problem.symmetryDiagnostics(input.field).every(row=>row.max<1e-12));
  const d=auditPhases({...input,ops:groups.g96,...tight});
  assert.ok(d.operations.every(op=>op.passed));
  assert.equal(d.spectrumResolved,true);
  assert.equal(d.primitiveAtResolvedDivisors,false);
  assert.equal(d.passed,false);
  assert.ok(d.periodChecks.find(row=>row.divisor===3).possibleRepeat);
  assert.ok(d.periodChecks.find(row=>row.divisor===3).relativeProjection<1e-12);
});

test('small phase lags of a smooth primitive orbit do not become false shorter periods',()=>{
  const input=circulating({M:256}),d=auditPhases({...input,ops:groups.g96,...tight});
  assert.equal(d.passed,true,d.reasons.join(' '));
  const smallLag=d.periodChecks.find(row=>row.divisor===128);
  assert.ok(smallLag.shiftRms/d.temporalRms<.05);
  assert.ok(smallLag.relativeProjection>.999);
  assert.equal(smallLag.possibleRepeat,false);
});

test('unresolved temporal spectrum and phase signals buried in numerical error are rejected',()=>{
  const high=smoothSeed('g94',{M:16,harmonic:7}),d=auditPhases({...high,...tight});
  assert.equal(d.spectrumResolved,false);assert.equal(d.passed,false);
  const input=circulating(),noisy=auditPhases({...input,ops:groups.g96,noiseRms:.03,...tight});
  assert.equal(noisy.passed,false);
  assert.ok(noisy.operations.some(op=>op.tau&&!op.nontrivialPhase));
});

test('both concentrations and all sites contribute, not only displayed V or generator centres',()=>{
  const input=circulating(),field=input.field.slice();
  // Corrupt one U site while V and every rotation centre remain unchanged.
  field[3*2*input.N**2+input.N+2]+=.1;
  const d=auditPhases({...input,field,ops:groups.g96,...tight});
  assert.equal(d.passed,false);
  assert.ok(d.operations.some(op=>op.shiftedMax>.09));
});

test('independent phase checking reads actual future frames and never loops a recording',()=>{
  const input=circulating(),stride=2*input.N**2,maxShift=3*input.M/4;
  const trajectoryFrames=new Float64Array((input.M+maxShift)*stride);
  for(let t=0;t<input.M+maxShift;t++)trajectoryFrames.set(input.field.subarray((t%input.M)*stride,(t%input.M+1)*stride),t*stride);
  const good=auditPhases({...input,ops:groups.g96,trajectoryFrames,...tight});
  assert.equal(good.passed,true);assert.equal(good.independentForwardFrames,true);
  for(let t=input.M;t<input.M+maxShift;t++)for(let p=0;p<stride;p++)trajectoryFrames[t*stride+p]+=.04;
  const failed=auditPhases({...input,ops:groups.g96,trajectoryFrames,...tight});
  assert.equal(failed.passed,false);
  assert.ok(failed.operations.some(op=>op.tau&&!op.symmetryPassed));
  assert.throws(()=>auditPhases({...input,ops:groups.g96,trajectoryFrames:input.field}),/actual future frames/);
  const mismatched=trajectoryFrames.slice();mismatched[0]+=.01;
  assert.throws(()=>auditPhases({...input,ops:groups.g96,trajectoryFrames:mismatched}),/first M frames/);
});

test('invalid and incomplete evidence fails explicitly',()=>{
  const input=circulating(),field=input.field.slice();field[0]=NaN;
  assert.throws(()=>auditPhases({...input,field,ops:groups.g96}),/nonfinite/);
  assert.throws(()=>auditPhases({...input,field:input.field.slice(1),ops:groups.g96}),/complete/);
  assert.throws(()=>auditPhases({...input,ops:groups.g96,noiseRms:NaN}),/tolerance/);
  assert.throws(()=>auditPhases({...input,ops:[{M:[[1,0],[0,1]],v:[0,0],s:-1,tau:0}]}),/forward/);
});
