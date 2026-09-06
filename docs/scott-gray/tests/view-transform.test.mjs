import test from 'node:test';
import assert from 'node:assert/strict';
import {viewTransform,screenPointToLattice,latticePointToScreen,glViewMatrix} from '../view-transform.mjs';
const near=(actual,expected)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-12,`${actual} differs from ${expected}`));
test('legacy square coordinates remain top-left anchored and downward',()=>{
  const view=viewTransform({family:'p4',tiles:3});
  near(screenPointToLattice([0,0],view),[0,0]);near(screenPointToLattice([1,1],view),[3,3]);
});
test('legacy triangular coordinates preserve physical Euclidean width',()=>{
  const view=viewTransform({family:'p6',tiles:2});
  near(screenPointToLattice([.5,.5],view),[0,0]);near(screenPointToLattice([1,.5],view),[1,0]);near(screenPointToLattice([.5,0],view),[1/Math.sqrt(3),2/Math.sqrt(3)]);
});
test('an oblique cell viewport maps both edge vectors and its origin without changing the field',()=>{
  const view=viewTransform({viewMatrix:[[2/31,-3/31],[5/31,1/31]],viewOrigin:[.2,-.7]});
  near(screenPointToLattice([.5,.5],view),[.2,-.7]);
  const left=screenPointToLattice([0,.5],view),right=screenPointToLattice([1,.5],view),top=screenPointToLattice([.5,0],view),bottom=screenPointToLattice([.5,1],view);
  near(right.map((v,i)=>v-left[i]),[2/31,5/31]);near(top.map((v,i)=>v-bottom[i]),[-3/31,1/31]);
  for(const p of [[.1,.2],[0,1],[.5,.5],[1.3,-.7]])near(latticePointToScreen(screenPointToLattice(p,view),view),p);
  assert.deepEqual(glViewMatrix(view.matrix),[2/31,5/31,-3/31,1/31]);
});
test('singular or nonfinite transforms are rejected instead of drawing misleading cells',()=>{
  for(const options of [{viewMatrix:[[1,2],[2,4]]},{viewMatrix:[[NaN,0],[0,1]]},{viewOrigin:[0,Infinity]},{tiles:0}])assert.throws(()=>viewTransform(options));
});
