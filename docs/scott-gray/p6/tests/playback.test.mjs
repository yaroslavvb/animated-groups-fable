import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {latticeToCartesian,cartesianToLattice,latticeToScreen,screenToLattice,inverseOperation,valueAt,comparisonErrors,renderPixels,mod} from '../playback.mjs';
const groups=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
const near=(a,b,tolerance=1e-12)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
function projectedFixture(group){
  const N=12,M=12,S=N*N,field=new Float32Array(2*S*M),source=new Float32Array(field.length);
  for(let i=0;i<source.length;i++)source[i]=.45+.2*Math.sin(i*1.61803398875)+.15*Math.cos(i*.69314718056);
  for(let t=0;t<M;t++)for(let c=0;c<2;c++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    let value=0;for(const op of group.render.ops){const xx=mod(op.M[0][0]*x+op.M[0][1]*y+Math.round(N*op.v[0]),N),yy=mod(op.M[1][0]*x+op.M[1][1]*y+Math.round(N*op.v[1]),N),tt=mod(t+Math.round(M*op.tau),M);value+=source[2*S*tt+c*S+yy*N+xx];}field[2*S*t+c*S+y*N+x]=value/group.render.ops.length;
  }
  return {config:{N,M},field,ranges:{u:[0,1],v:[0,1]}};
}
test('triangular lattice renders equal length basis vectors at 120 degrees and real 60 degree rotations',()=>{
  const a=latticeToCartesian([1,0]),b=latticeToCartesian([0,1]);near(Math.hypot(...a),1);near(Math.hypot(...b),1);near(a[0]*b[0]+a[1]*b[1],-.5);
  const rotation=groups[0].namedGenerators[0].matrix;
  for(const point of [[1,0],[0,1],[.42,-.7]]){const original=latticeToCartesian(point),rotated=latticeToCartesian(rotation.map(row=>row[0]*point[0]+row[1]*point[1]));near(rotated[0],.5*original[0]-Math.sqrt(3)/2*original[1]);near(rotated[1],Math.sqrt(3)/2*original[0]+.5*original[1]);assert.deepEqual(cartesianToLattice(original).map(x=>+x.toFixed(8)),point);}
});
test('screen geometry aligns the reference generators and inverts without a shear or reflection',()=>{
  const [alpha,beta,gamma]=groups[0].namedGenerators,aa=latticeToScreen(alpha.centre),bb=latticeToScreen(beta.centre),cc=latticeToScreen(gamma.centre);
  assert.deepEqual(aa,[.5,.5]);near(bb[0],.5);assert.ok(bb[1]>.5);assert.ok(cc[0]<.5&&cc[1]>.5);
  for(const p of [[.1,.2],[.5,.5],[.98,.87]]){const q=latticeToScreen(screenToLattice(p,3),3);near(p[0],q[0]);near(p[1],q[1]);}
});
test('named affine generators use matrix inverse rather than transpose in lattice coordinates',()=>{
  for(const group of groups)for(const op of group.namedGenerators)for(const p of [[.23,.71],[0,0],[-.8,.03]]){
    const transformed=op.matrix.map((row,i)=>row[0]*p[0]+row[1]*p[1]+op.translation[i]),back=inverseOperation(transformed,op);near(back[0],p[0]);near(back[1],p[1]);
    const fixed=op.matrix.map((row,i)=>row[0]*op.centre[0]+row[1]*op.centre[1]+op.translation[i]);near(fixed[0],op.centre[0]);near(fixed[1],op.centre[1]);
  }
});
test('actual-field comparisons enforce each group phase instead of ordinary spatial symmetry',()=>{
  for(const group of groups){const record=projectedFixture(group);for(const op of group.namedGenerators){const error=comparisonErrors(record,0,op);assert.ok(error.shiftedRms<1e-7,`${group.id} ${op.name}: ${error.shiftedRms}`);if(op.tau)assert.ok(error.sameTimeRms>.001,`${group.id} ${op.name}: shift should matter`);}}
});
test('equilateral triangular interpolation preserves every phase symmetry away from lattice nodes',()=>{
  for(const group of groups){const record=projectedFixture(group);for(const op of group.namedGenerators)for(let i=0;i<23;i++){
    const u=mod(i*.61803398875),v=mod(i*.41421356+.031),phase=mod(i*.17+.023),before=inverseOperation([u,v],op);
    for(const channel of [0,1])near(valueAt(record,channel,...before,phase),valueAt(record,channel,u,v,phase+op.tau),1e-7);
  }}
});
test('saved-field sampling wraps lattice translations and phase and uses fixed full-orbit palettes',()=>{
  const record=projectedFixture(groups[3]);for(const c of [0,1])near(valueAt(record,c,.32,.17,.22),valueAt(record,c,2.32,-.83,1.22),1e-6);
  const a=renderPixels(record,.1,{width:16,palette:'ember'}),b=renderPixels(record,1.1,{width:16,palette:'ember'}),v=renderPixels(record,.1,{width:16,palette:'concentration'});
  assert.deepEqual(a,b);assert.notDeepEqual(a,v);assert.equal(a.length,1024);for(let i=3;i<a.length;i+=4)assert.equal(a[i],255);
});
