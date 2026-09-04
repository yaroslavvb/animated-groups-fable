import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProblem,fitOrbit} from '../core.mjs';
const catalog=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
const groups=Object.fromEntries(catalog.map(g=>[g.id,g.render.ops]));
let rngState=91731;
function random(){rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296;}
function randomArray(n,offset=0,scale=1){return Float64Array.from({length:n},()=>offset+scale*(random()-.5));}
function maxAbs(a,b){let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));return max;}
function dot(a,b){let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;}

test('all six catalog groups have exact, idempotent, self-adjoint space-time projections',()=>{
  for(const [id,ops] of Object.entries(groups)){
    const p=createProblem({N:8,M:8,ops}),a=randomArray(p.length),b=randomArray(p.length),pa=p.project(a),pb=p.project(b);
    assert.ok(maxAbs(pa,p.project(pa))<1e-14,id+' idempotence');
    assert.ok(Math.abs(dot(a,pb)-dot(pa,b))<1e-11,id+' self-adjointness');
    assert.ok(p.symmetryDiagnostics(pa).every(s=>s.max===0),id+' operation invariance');
    assert.ok(p.orbitCount<p.N*p.N*p.M,id+' reduced degrees of freedom');
    const rates=new Float64Array(p.length);
    for(let k=0;k<p.M;k++)p.rhsFrame(pa,k*2*p.S,rates,k*2*p.S);
    assert.ok(p.symmetryDiagnostics(rates).every(s=>s.max<1e-14),id+' PDE equivariance');
  }
});

test('Crank–Nicolson analytic gradients agree with centered differences, including period and constraints',()=>{
  for(const penalized of [false,true]){
    const p=createProblem({N:4,M:8,ops:groups.g99,minTemporal:penalized?.12:0,minSpatial:penalized?.2:0,weights:{phase:.3}});
    const q=p.project(randomArray(p.length,.4,.2)),direction=p.project(randomArray(p.length));
    p.setPhaseReference(p.project(randomArray(p.length,.5,.2)));
    const period=270,e=p.evaluate(q,period,{gradient:true}),epsilon=1e-6;
    const plus=Float64Array.from(q,(x,i)=>x+epsilon*direction[i]),minus=Float64Array.from(q,(x,i)=>x-epsilon*direction[i]);
    const numeric=(p.evaluate(plus,period).objective-p.evaluate(minus,period).objective)/(2*epsilon),analytic=dot(e.gradient,direction);
    assert.ok(Math.abs(numeric-analytic)<2e-7*Math.max(1,Math.abs(numeric)),`${penalized}: field ${numeric} != ${analytic}`);
    const numericT=(p.evaluate(q,period*Math.exp(epsilon)).objective-p.evaluate(q,period*Math.exp(-epsilon)).objective)/(2*epsilon);
    assert.ok(Math.abs(numericT-e.logPeriodGradient)<2e-7,`${penalized}: period ${numericT} != ${e.logPeriodGradient}`);
  }
});

test('unprojected gradient and each species derivative agree with finite differences',()=>{
  const p=createProblem({N:4,M:4,ops:groups.g96,minTemporal:0,minSpatial:0}),q=randomArray(p.length,.4,.2),e=p.evaluate(q,123,{gradient:true,projectGradient:false});
  for(const index of [0,15,16,31,63,94,127]){
    const epsilon=1e-6,plus=Float64Array.from(q),minus=Float64Array.from(q);plus[index]+=epsilon;minus[index]-=epsilon;
    const numeric=(p.evaluate(plus,123).objective-p.evaluate(minus,123).objective)/(2*epsilon);
    assert.ok(Math.abs(numeric-e.gradient[index])<1e-8,`${index}: ${numeric} != ${e.gradient[index]}`);
  }
});

test('Bulatov nine-point collocation adjoint matches finite differences in both species and projected directions',()=>{
  for(const id of ['g94','g99']){
    const p=createProblem({N:8,M:8,ops:groups[id],params:{stencil:'bulatov9',Du:.2097,Dv:.105,dx:.9},minTemporal:0,minSpatial:0});
    const q=p.project(randomArray(p.length,.4,.3)),direction=p.project(randomArray(p.length)),period=93,epsilon=1e-6;
    const e=p.evaluate(q,period,{gradient:true}),plus=Float64Array.from(q,(x,i)=>x+epsilon*direction[i]),minus=Float64Array.from(q,(x,i)=>x-epsilon*direction[i]);
    const numerical=(p.evaluate(plus,period).objective-p.evaluate(minus,period).objective)/(2*epsilon);
    assert.ok(Math.abs(numerical-dot(e.gradient,direction))<1e-8,id+' projected derivative');
    const unprojected=p.evaluate(q,period,{gradient:true,projectGradient:false});
    for(const index of [0,63,64,127,513,1023]){
      const a=q.slice(),b=q.slice();a[index]+=epsilon;b[index]-=epsilon;
      const numeric=(p.evaluate(a,period).objective-p.evaluate(b,period).objective)/(2*epsilon);
      assert.ok(Math.abs(numeric-unprojected.gradient[index])<1e-8,`${id} species/site ${index}`);
    }
    const rates=new Float64Array(p.length);for(let frame=0;frame<p.M;frame++)p.rhsFrame(q,frame*2*p.S,rates,frame*2*p.S);
    assert.ok(p.symmetryDiagnostics(rates).every(result=>result.max<1e-14),id+' nine-point equivariance');
  }
});

test('steady homogeneous solution is rejected despite zero PDE, symmetry, and shooting residuals',()=>{
  const p=createProblem({N:4,M:4,ops:groups.g94}),q=new Float64Array(p.length);
  for(let k=0;k<p.M;k++)q.fill(1,k*2*p.S,k*2*p.S+p.S);
  const d=p.diagnostics(q,40);
  assert.equal(d.pdeRms,0);assert.equal(d.symmetryMax,0);assert.equal(d.closure.closureRms,0);
  assert.equal(d.nontrivial,false);assert.equal(d.validated,false);
});

test('an exactly cyclic symmetric animation is not automatically a PDE orbit',()=>{
  const p=createProblem({N:8,M:8,ops:groups.g96}),q=p.project(randomArray(p.length,.4,.4)),d=p.diagnostics(q,80,{shooting:false});
  assert.equal(d.periodicConstruction,true);assert.equal(d.symmetryMax,0);assert.ok(d.pdeRms>.001);
  assert.equal(d.validated,false);assert.ok(d.reasons.length>0);
});

test('L-BFGS improves the residual while preserving every exact symmetry',async()=>{
  const p=createProblem({N:8,M:8,ops:groups.g99,minTemporal:.02,minSpatial:.04});
  const q=p.project(randomArray(p.length,.35,.2)),initial=p.evaluate(q,100).objective;
  let reports=0;
  const result=await fitOrbit({problem:p,field:q,period:100,iterations:20,validate:false,onProgress:()=>reports++});
  assert.ok(result.objective<initial*.8,`${result.objective} !< ${initial}`);
  assert.ok(result.diagnostics.symmetryMax<1e-14);assert.ok(result.accepted>0);assert.ok(reports>1);
  assert.equal(result.diagnostics.validated,false);
});

test('unsupported grids and time reversal fail explicitly',()=>{
  assert.throws(()=>createProblem({N:6,M:8}),/multiples of four/);
  assert.throws(()=>createProblem({N:8,M:8,ops:[{M:[[1,0],[0,1]],v:[0,0],s:-1,tau:0}]}),/forward-time/);
});

test('physical grid spacing and independent RK4 match an exactly soluble diffusion/feed mode',()=>{
  const N=8,M=4,dx=1.3,Du=.16,F=.026,T=16;
  const p=createProblem({N,M,params:{dx,Du,F},minTemporal:0,minSpatial:0}),q=new Float64Array(p.length);
  const lambda=F+8*Du*Math.sin(Math.PI/N)**2/(dx*dx);
  for(let frame=0;frame<M;frame++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)q[frame*2*p.S+y*N+x]=1+.2*Math.cos(2*Math.PI*x/N)*Math.cos(2*Math.PI*y/N);
  const rate=p.rhsFrame(q),result=p.shoot(q,T,{shootingDt:.125});
  assert.equal(result.computed,true);
  for(let i=0;i<p.S;i++){
    assert.ok(Math.abs(rate[i]+lambda*(q[i]-1))<1e-15);
    const expected=1+(q[i]-1)*Math.exp(-lambda*T);
    assert.ok(Math.abs(result.finalState[i]-expected)<1e-10);
    assert.equal(result.finalState[p.S+i],0);
  }
  assert.ok(result.closureRms>.01);assert.ok(result.trajectoryRms>.01);
});

test('Bulatov nine-point independent shooting matches an exactly soluble two-direction Fourier mode',()=>{
  const N=8,M=4,dx=1.3,Du=.2097,F=.026,T=16,p=createProblem({N,M,params:{stencil:'bulatov9',dx,Du,F},minTemporal:0,minSpatial:0}),q=new Float64Array(p.length);
  const cx=Math.cos(2*Math.PI/N),cy=Math.cos(4*Math.PI/N),lambda=F+Du*(4-1.6*(cx+cy)-.8*cx*cy)/(dx*dx);
  for(let frame=0;frame<M;frame++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)q[frame*2*p.S+y*N+x]=1+.2*Math.cos(2*Math.PI*x/N)*Math.cos(4*Math.PI*y/N);
  const rate=p.rhsFrame(q),result=p.shoot(q,T,{shootingDt:.05});assert.equal(result.computed,true);
  for(let i=0;i<p.S;i++){
    assert.ok(Math.abs(rate[i]+lambda*(q[i]-1))<1e-15,'analytic Laplacian eigenvalue');
    assert.ok(Math.abs(result.finalState[i]-(1+(q[i]-1)*Math.exp(-lambda*T)))<1e-10,'independent RK4 trajectory');
  }
  assert.equal(p.diagnostics(q,T,{shooting:false}).stencil,'bulatov9');
  assert.throws(()=>createProblem({params:{stencil:'invalid'}}),/stencil/);
});

test('a real Gray–Scott periodic oscillator passes independent validation, but is neither a glider nor a shifted 442 orbit',()=>{
  // Independent high-accuracy shooting fixture. Its spatial homogeneity is
  // intentional: this is a positive control, not a patterned solution.
  const fixture=JSON.parse(readFileSync(new URL('./oscillator.json',import.meta.url)));
  const p=createProblem({N:4,M:256,ops:groups.g94,minSpatial:0,params:{F:fixture.feed,k:fixture.kill}}),q=new Float64Array(p.length);
  for(let k=0;k<p.M;k++){
    q.fill(fixture.frames[k][0],k*2*p.S,k*2*p.S+p.S);
    q.fill(fixture.frames[k][1],k*2*p.S+p.S,(k+1)*2*p.S);
  }
  const d=p.diagnostics(q,fixture.period);
  assert.equal(d.validated,true);assert.ok(d.temporalRms>.03);assert.ok(d.relativePde<.0002);
  assert.ok(d.closure.closureRms<1e-10);assert.ok(d.closure.trajectoryRms<1e-10);
  for(const id of ['g95','g96','g97','g98','g99']){
    const shifted=createProblem({N:4,M:256,ops:groups[id],minSpatial:0,params:{F:fixture.feed,k:fixture.kill}});
    assert.ok(shifted.symmetryDiagnostics(q).some(s=>s.max>.05),id+' must not accept the homogeneous oscillator as a faithful shifted orbit');
  }
  const patterned=createProblem({N:4,M:256,ops:groups.g94,params:{F:fixture.feed,k:fixture.kill}});
  assert.equal(patterned.diagnostics(q,fixture.period,{shooting:false}).nontrivial,false);
  // Doubling the listed period makes a half-period screw act trivially.
  const doubled=createProblem({N:4,M:512,ops:groups.g95,minSpatial:0,params:{F:fixture.feed,k:fixture.kill}}),twice=new Float64Array(doubled.length);
  twice.set(q);twice.set(q,q.length);
  const doubledDiagnostics=doubled.diagnostics(twice,2*fixture.period,{shooting:false,requireFaithfulTimeShifts:true});
  assert.equal(doubledDiagnostics.symmetryMax,0);
  assert.equal(doubledDiagnostics.faithfulTimeShifts,false);
  assert.equal(doubledDiagnostics.primitiveAtTestedShifts,false);
  assert.ok(doubledDiagnostics.reasons.some(reason=>reason.includes('acts trivially')));
});
