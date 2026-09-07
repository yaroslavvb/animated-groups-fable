import test from 'node:test';
import assert from 'node:assert/strict';
import {field,transformed,auditModel} from './model.mjs';

test('442 triples: exactly eight of the 32 rotation/phase/color choices preserve the analytic field',()=>{
  let matches=0;
  for(let r=0;r<4;r++)for(let k=0;k<4;k++)for(const swap of [false,true]){
    const expected=((k-r-(swap?2:0))%4+4)%4===0;
    const audit=auditModel(r,k/4,swap);
    assert.equal(audit.max<1e-12,expected,`rotation=${r}, quarter phase=${k}, swap=${swap}`);
    if(expected){matches++;assert.equal(audit.mismatch,0);}else assert.ok(audit.rms>.5);
  }
  assert.equal(matches,8);
});

test('a stationary spatial component preserves the rotating wave but breaks the color companion',()=>{
  assert.ok(auditModel(1,.25,false,.35).max<1e-12);
  assert.ok(auditModel(0,.5,true,.35).rms>.5);
  assert.ok(auditModel(1,.75,true,.35).mismatch>.1);
});

test('concrete quarter-turn and half-time relations agree with the stated counterclockwise convention',()=>{
  const x=.13,y=.31,t=.087;
  const f=field(x,y,t);
  assert.ok(Math.abs(field(-y,x,t+.25)-f)<1e-14);
  assert.ok(Math.abs(field(x,y,t+.5)+f)<1e-14);
  assert.ok(Math.abs(transformed(x,y,t,1,.75,true)-f)<1e-14);
});

test('half-period odd projection restores its exact sign/color relation after symmetry-breaking bias',()=>{
  const odd=(x,y,t)=>(field(x,y,t,.4)-field(x,y,t+.5,.4))/2;
  for(const t of [.019,.127,.351,.682]){
    assert.ok(Math.abs(odd(.13,.37,t)+odd(.13,.37,t+.5))<1e-14);
    assert.ok(Math.abs(odd(-.37,.13,t+.75)+odd(.13,.37,t))<1e-14);
  }
});
