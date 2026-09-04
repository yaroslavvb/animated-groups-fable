import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyCandidate,normalizeConfig,createTriangularRhs,captureForward,GATE_VERSION} from '../verify.mjs';
import {auditPhases} from '../phase-audit.mjs';

const groups=JSON.parse(await readFile(new URL('../groups.json',import.meta.url)));
const R=[[1,-1],[1,0]],Rt=[[1,1],[-1,0]];
const mul=(A,p)=>A.map(row=>row.reduce((s,a,i)=>s+a*p[i],0));
const group=id=>groups.find(g=>g.id===id);
function config(id='g248'){return{N:12,M:24,period:320,L:256,groupId:id,ops:group(id).render.ops,params:{Du:.16,Dv:.08,F:.00408,k:.02,dx:256/12,stencil:'triangular-six'}};}
function wave(id='g248',repeat=1){
  const c=config(id),q=new Float32Array(2*c.N*c.N*c.M),tau=group(id).namedGenerators[0].tau;
  for(let t=0;t<c.M;t++)for(let y=0;y<c.N;y++)for(let x=0;x<c.N;x++)for(let s=0;s<2;s++){
    let k=[1,0],v=0;for(let j=0;j<6;j++){v+=Math.cos(2*Math.PI*(k[0]*x/c.N+k[1]*y/c.N+repeat*t/c.M+j*tau));k=mul(Rt,k);}
    q[t*2*c.N*c.N+s*c.N*c.N+y*c.N+x]=.2+.01*v;
  }
  return{config:c,field:q};
}

test('a square stencil and mismatched canonical operations are rejected before admission',async()=>{
  let candidate=wave();candidate.config.params.stencil='five-point';
  assert.match((await verifyCandidate(candidate)).reasons.join(' '),/triangular-six/);
  candidate=wave();candidate.config.ops=group('g247').render.ops;
  assert.match((await verifyCandidate(candidate)).reasons.join(' '),/canonical 632 character/);
});

test('forged passing diagnostics cannot admit a stationary or spatially uniform movie',async()=>{
  const c=config(),field=new Float32Array(2*c.N*c.N*c.M).fill(.2);
  const out=await verifyCandidate({config:c,field,diagnostics:{validated:true,closureRms:0,pdeRms:0},verified:true});
  assert.equal(out.accepted,false);assert.match(out.reasons.join(' '),/variation|nonzero colour phase/);
});

test('phase checks distinguish the complementary one-sixth and five-sixths characters',()=>{
  const {config:c,field}=wave();
  const settings={field,N:c.N,M:c.M,absoluteTolerance:2e-7,relativeTolerance:2e-5};
  assert.equal(auditPhases({...settings,ops:group('g248').render.ops}).passed,true);
  const wrong=auditPhases({...settings,ops:group('g247').render.ops});
  assert.equal(wrong.passed,false);assert.ok(wrong.operations.some(o=>o.shiftedRms>.01));
});

test('ordinary sixfold spatial symmetry cannot substitute for a time-offset character',()=>{
  const {config:c,field}=wave('g243');
  const settings={field,N:c.N,M:c.M,absoluteTolerance:2e-7,relativeTolerance:2e-5};
  assert.equal(auditPhases({...settings,ops:group('g243').render.ops}).passed,true);
  const shifted=auditPhases({...settings,ops:group('g248').render.ops});
  assert.equal(shifted.passed,false);
  assert.ok(shifted.operations.some(o=>o.tau!==0&&o.sameTimeRms===0&&!o.nontrivialPhase));
});

test('wrong time-period and one-channel symmetry defects cannot hide in whole-field checks',()=>{
  const c=config(),candidate=wave('g248',2);
  const repeated=auditPhases({field:candidate.field,N:c.N,M:c.M,ops:c.ops,absoluteTolerance:2e-7,relativeTolerance:2e-5});
  assert.equal(repeated.primitiveAtResolvedDivisors,false);
  const proper=wave();proper.field[c.N*c.N+5]+=.1;
  assert.equal(auditPhases({field:proper.field,N:c.N,M:c.M,ops:c.ops,absoluteTolerance:2e-7,relativeTolerance:2e-5}).passed,false);
});

test('a compatible animated shape still fails the actual Gray–Scott equations',async()=>{
  const out=await verifyCandidate(wave());assert.equal(out.accepted,false);assert.match(out.reasons.join(' '),/pdeRms|relativePde/);
});

test('the independent RHS commutes with the canonical rotation',()=>{
  const c=config(),N=c.N,S=N*N,q=Float64Array.from({length:2*S},(_,i)=>.2+.1*Math.sin(i*.171));
  const transform=f=>Float64Array.from(f,(_,i)=>{const s=Math.floor(i/S),p=i%S,[x,y]=mul(R,[p%N,Math.floor(p/N)]);return f[s*S+((y%N+N)%N)*N+(x%N+N)%N];});
  const rhs=createTriangularRhs(c),a=rhs(transform(q)),b=transform(rhs(q));
  assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-14));
});

test('triangular Fourier diffusion matches its exact eigenvalue and exponential decay',async()=>{
  const raw=config('g243');raw.period=20;raw.L=12;raw.params={...raw.params,dx:1,F:0,k:0};
  const c=normalizeConfig(raw),S=c.N*c.N,field=new Float64Array(2*S*c.M);
  const lambda=8/3*(Math.cos(2*Math.PI/c.N)-1);
  for(let t=0;t<c.M;t++)for(let y=0;y<c.N;y++)for(let x=0;x<c.N;x++)field[t*2*S+y*c.N+x]=.5+.05*Math.cos(2*Math.PI*x/c.N);
  const rhs=createTriangularRhs(c)(field);
  for(let p=0;p<S;p++)assert.ok(Math.abs(rhs[p]-c.params.Du*lambda*(field[p]-.5))<1e-15);
  const forward=await captureForward(field,c,c.M*8),end=forward.frames.subarray(c.M*2*S,(c.M+1)*2*S);
  for(let p=0;p<S;p++)assert.ok(Math.abs(end[p]-(.5+(field[p]-.5)*Math.exp(c.params.Du*lambda*c.period)))<2e-12);
  assert.ok(end.subarray(S).every(v=>v===0));
  const inadmissible=await verifyCandidate({config:c,field});assert.equal(inadmissible.accepted,false);assert.match(inadmissible.reasons.join(' '),/F = 0/);
});

test('forward verification records real future frames and uses no periodic wrap',async()=>{
  const c=normalizeConfig({...config(),period:1}),S=c.N*c.N,field=new Float64Array(2*S*c.M);
  for(let t=0;t<c.M;t++)for(let p=0;p<S;p++){field[t*2*S+p]=.7;field[t*2*S+S+p]=.1;}
  const out=await captureForward(field,c,c.M*4),start=out.frames[0],period=out.frames[c.M*2*S],future=out.frames[(c.M+4)*2*S];
  assert.ok(Math.abs(period-start)>1e-5);assert.notEqual(future,period);assert.ok(out.diagnostics.recordedFrames>c.M+1);
});

let catalog;
try{catalog=JSON.parse(await readFile(new URL('../data/precomputed-atlas.json',import.meta.url)));}catch(error){if(error.code!=='ENOENT')throw error;}
test('a shipped exact Float32 orbit independently passes the triangular gate',{skip:!catalog?.orbits?.length},async()=>{
  const source=catalog.orbits.find(o=>o.groupId==='g248')??catalog.orbits[0],bytes=await readFile(new URL('../'+source.fieldUrl,import.meta.url));
  const field=new Float32Array(bytes.length/4);for(let i=0;i<field.length;i++)field[i]=bytes.readFloatLE(4*i);
  const out=await verifyCandidate({config:source.config,field});
  assert.equal(out.accepted,true,out.reasons.join(' '));assert.equal(out.diagnostics.atlasVerification,GATE_VERSION);
  assert.equal(out.diagnostics.refinedClosure.steps,2*out.diagnostics.closure.steps);
  assert.equal(out.diagnostics.refinedPhase.independentForwardFrames,true);
  assert.equal(out.diagnostics.refinedPhase.primitiveAtResolvedDivisors,true);
});
