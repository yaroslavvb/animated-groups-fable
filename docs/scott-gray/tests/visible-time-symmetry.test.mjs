import test from 'node:test';
import assert from 'node:assert/strict';
import {auditVisibleTimeSymmetry} from '../visible-time-symmetry.mjs';
const N=16,M=16,S=N*N;
const rotation={M:[[0,-1],[1,0]],v:[0,0],s:1,tau:.25};
function movie(fn){const a=new Float64Array(M*2*S);for(let t=0;t<M;t++)for(let c=0;c<2;c++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)a[t*2*S+c*S+y*N+x]=fn(x*2*Math.PI/N,y*2*Math.PI/N,t,c);return a;}
const rotating=()=>movie((x,y,t,c)=>.3+.05*(Math.sin(x)*Math.cos(2*Math.PI*(t/M+c/7))-Math.sin(y)*Math.sin(2*Math.PI*(t/M+c/7))));
test('rotating quadrature shapes visibly break the unshifted rotation throughout both channels',()=>{
 const result=auditVisibleTimeSymmetry({field:rotating(),N,M,ops:[rotation]});assert.equal(result.passed,true);assert.equal(result.referenceOnly,false);assert(result.minimumRelativeColorRange>.1);
});
test('a symmetric interpolation midpoint is rejected even when every saved frame differs',()=>{
 const field=movie((x,y,t)=>.3+.05*(t%2?1:-1)*(Math.cos(x)-Math.cos(y)));
 const r=auditVisibleTimeSymmetry({field,N,M,ops:[{...rotation,tau:.5}]});assert.equal(r.passed,false);assert(r.operations[0].channels.every(c=>c.minimumRms<1e-8));assert(Math.abs((r.operations[0].channels[0].phase*M)%1-.5)<1e-10);
});
test('one invariant displayed channel cannot be concealed by the other species',()=>{
 const field=rotating();for(let t=0;t<M;t++)for(let p=0;p<S;p++)field[t*2*S+S+p]=.3+.02*Math.cos(2*Math.PI*t/M);
 const r=auditVisibleTimeSymmetry({field,N,M,ops:[rotation]});assert.equal(r.passed,false);assert.equal(r.operations[0].channels[0].passed,true);assert.equal(r.operations[0].channels[1].passed,false);
});
test('zero-offset kernel rotations and pure translations are allowed',()=>{
 const r=auditVisibleTimeSymmetry({field:rotating(),N,M,ops:[{...rotation,tau:0},{M:[[1,0],[0,1]],v:[.5,.5],tau:.5}]});assert.equal(r.passed,true);assert.equal(r.referenceOnly,true);assert.equal(r.operations.length,0);
});
test('numerical uncertainty raises the required absolute visibility floor',()=>{
 const r=auditVisibleTimeSymmetry({field:rotating(),N,M,ops:[rotation],noiseRms:.002});assert.equal(r.passed,false);assert.equal(r.thresholds.effectiveAbsoluteFloor,.2);
});
test('invalid arrays, grid actions and numerical uncertainty are rejected',()=>{
 const field=rotating();assert.throws(()=>auditVisibleTimeSymmetry({field:field.subarray(1),N,M,ops:[rotation]}));assert.throws(()=>auditVisibleTimeSymmetry({field,N,M,ops:[{...rotation,v:[.01,0]}]}));assert.throws(()=>auditVisibleTimeSymmetry({field,N,M,ops:[rotation],noiseRms:NaN}));
 assert.throws(()=>auditVisibleTimeSymmetry({field,N,M,ops:[{...rotation,tau:NaN}]}));assert.throws(()=>auditVisibleTimeSymmetry({field,N,M,ops:[{...rotation,tau:0,v:[NaN,0]}]}));
});
