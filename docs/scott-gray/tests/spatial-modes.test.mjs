import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditPhases} from '../phase-audit.mjs';

function asset(name){
  const url=new URL('../data/orbits/'+name+'.json',import.meta.url),metadata=JSON.parse(readFileSync(url));
  const bytes=readFileSync(new URL(metadata.fieldUrl,url)),field=Float64Array.from({length:bytes.length/4},(_,i)=>bytes.readFloatLE(4*i));
  return {config:metadata.config,field};
}
function physical(c){return {groupId:c.groupId,F:c.params.F,k:c.params.k,Du:c.params.Du,Dv:c.params.Dv,L:c.L,stencil:c.params.stencil};}
function translationRms({config:c,field},dx,dy){
  const S=c.N*c.N;let sum=0;
  for(let t=0;t<c.M;t++)for(let ch=0;ch<2;ch++)for(let y=0;y<c.N;y++)for(let x=0;x<c.N;x++){
    const base=(2*t+ch)*S,difference=field[base+y*c.N+x]-field[base+((y+dy)%c.N)*c.N+(x+dx)%c.N];sum+=difference*difference;
  }
  return Math.sqrt(sum/field.length);
}

test('two delivered g95 patterns coexist at identical physical parameters with different spatial periods',()=>{
  const original=asset('g95-F0p00403000-k0p02000-N48-M128'),doubled=asset('g95-mode2-F0p00403-N48-M128');
  assert.deepEqual(physical(original.config),physical(doubled.config));
  assert.ok(Math.abs(original.config.period-doubled.config.period)>5);
  assert.ok(translationRms(original,original.config.N/2,0)>.05);
  assert.equal(translationRms(doubled,doubled.config.N/2,0),0);
  assert.equal(translationRms(doubled,0,doubled.config.N/2),0);
});

test('the doubled spatial pattern cannot substitute for a nontrivial g98 centered phase shift',()=>{
  const doubled=asset('g95-mode2-F0p00400000-k0p02000000-N48-M128');
  assert.equal(translationRms(doubled,doubled.config.N/2,doubled.config.N/2),0);
  const groups=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
  const audit=auditPhases({...doubled.config,field:doubled.field,ops:groups.find(g=>g.id==='g98').render.ops,absoluteTolerance:1e-10,relativeTolerance:1e-8});
  assert.equal(audit.passed,false);assert.ok(audit.reasons.some(reason=>reason.includes('nonzero colour phase')));
});

test('the delivered tripled spatial mode repeats at L/3 but retains nontrivial contrast at L/2',()=>{
  const tripled=asset('g95-mode3-F0p00395000-k0p02000000-N48-M128');
  assert.ok(translationRms(tripled,tripled.config.N/3,0)<1e-8);
  assert.ok(translationRms(tripled,0,tripled.config.N/3)<1e-8);
  assert.ok(translationRms(tripled,tripled.config.N/2,0)>.04);
});
