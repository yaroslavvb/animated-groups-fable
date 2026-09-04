import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makePreview} from '../seeds.mjs';
import {movieStats,projectKernel,createStepper,rhs} from '../dynamics.mjs';
import {createProblem} from '../core.mjs';
const groups=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
test('glider previews satisfy every catalog operation, including g99 affine offsets',()=>{
  for(const group of groups){const options={N:16,M:16,ops:group.render.ops};const field=makePreview(options),s=movieStats(field,16,16,options.ops);assert.ok(s.symmetryRms<1e-14,group.id);assert.ok(s.temporalRms>.01,group.id);assert.ok(s.spatialRms>.01,group.id);}
});
test('forward evolution and collocation use the same equations and preserve the instantaneous kernel',()=>{
  const N=12,M=8,params={Du:.16,Dv:.08,F:.062,k:.0609,dx:1.5};
  for(const g of groups){const field=makePreview({N,M,ops:g.render.ops}),state=projectKernel(field.slice(0,2*N*N),N,g.render.ops),p=createProblem({N,M,ops:g.render.ops,params});const a=rhs(state,N,params),b=p.rhsFrame(state);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-14));const stepper=createStepper(state,N,params);stepper.advance(10);const projected=projectKernel(stepper.state,N,g.render.ops);assert.ok(projected.every((v,i)=>Math.abs(v-stepper.state[i])<1e-14),g.id);}
});
test('bundled spiral trajectory is finite, fourfold, moving, and replays the actual PDE',()=>{
  const bytes=readFileSync(new URL('../data/spiral-trajectory.f32',import.meta.url));
  const field=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
  const meta=JSON.parse(readFileSync(new URL('../data/spiral-trajectory.json',import.meta.url)));
  const N=meta.n,S=2*N*N,params=meta.params;
  assert.equal(field.length,S*meta.frames);
  assert.ok(field.every(x=>Number.isFinite(x)&&x>=0&&x<=1));
  const initial=Float64Array.from(field.slice(0,S));let state=initial.slice();
  for(let k=0;k<25;k++){const rates=rhs(state,N,params);for(let i=0;i<S;i++)state[i]+=params.dt*rates[i];}
  let replay=0,motion=0;for(let i=0;i<S;i++){replay+=(state[i]-field[S+i])**2;motion+=(initial[i]-field[S+i])**2;}
  assert.ok(Math.sqrt(replay/S)<1e-6,'independent equation replay matches recorded frame');
  assert.ok(Math.sqrt(motion/S)>.01,'visible chemical evolution');
  const projected=projectKernel(initial,N,groups[0].render.ops);
  assert.ok(projected.every((x,i)=>Math.abs(x-initial[i])<1e-6));
  assert.ok(meta.checks.returnRmsAt640>.01,'nonperiodic trajectory is explicitly documented');
});
