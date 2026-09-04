import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticExclusion} from '../feasibility.mjs';

const standard={F:.062,k:.0609,Du:.2097,Dv:.105};

test('exactly zero feed has the nonnegative periodic-box analytic exclusion',()=>{
  for(const k of [0,.02,.06]){
    const result=analyticExclusion({...standard,F:0,k});
    assert.equal(result.status,'analytically excluded');
    assert.equal(result.id,'zero-feed-no-nonstationary-periodic-orbit');
    assert.ok(result.assumptions.includes('nonnegative concentrations'));
  }
});

test('positive feed and zero kill are not declared impossible',()=>{
  for(const F of [Number.MIN_VALUE,1e-12,.004,.062])
    for(const k of [0,.02,.06])assert.equal(analyticExclusion({...standard,F,k}),null);
});

test('unsupported or invalid assumptions do not produce a certificate',()=>{
  for(const override of [{k:-1},{F:NaN},{Du:0},{Dv:0},{Du:-1},{Dv:Infinity}])
    assert.equal(analyticExclusion({...standard,F:0,...override}),null);
  assert.equal(analyticExclusion({...standard,F:0},{boundary:'forced'}),null);
  assert.equal(analyticExclusion(null),null);
});
