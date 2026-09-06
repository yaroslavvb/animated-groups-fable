import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperPrimitiveCell,makeWallpaperCellView} from '../wallpaper-cell.mjs';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const det=(a,b)=>a[0]*b[1]-a[1]*b[0];
const mv=(A,p)=>A.map(r=>dot(r,p));
const metric=(p,lattice)=>lattice==='triangular'?[p[0]-p[1]/2,Math.sqrt(3)*p[1]/2]:p;
const mod=(x,n)=>((x%n)+n)%n;
const add=(a,b)=>a.map((x,i)=>x+b[i]);
function subgroup(n,generators){
 const points=[[0,0]],seen=new Set(['0,0']);
 for(let i=0;i<points.length;i++)for(const g of generators){const p=add(points[i],g).map(x=>mod(x,n)),key=p.join(',');if(!seen.has(key)){seen.add(key);points.push(p);}}
 return points.map(p=>p.map(x=>x/n));
}
function checkCell(lattice,translations){
 const cell=wallpaperPrimitiveCell({lattice,translations});
 assert.equal(cell.index,translations.length);assert.ok(Math.abs(det(...cell.basis)-1/translations.length)<1e-8);
 // A full-rank sublattice of the correct area that contains every certified
 // translation and both simulation periods is exactly the requested lattice.
 for(const p of [[1,0],[0,1],...translations])for(const x of mv(cell.inverse,p))assert.ok(Math.abs(x-Math.round(x))<1e-6,`${lattice}: missing translation ${p}`);
 for(const p of cell.basis){
  const wrapped=p.map(x=>mod(x,1));assert.ok(translations.some(q=>q.every((x,i)=>Math.abs(mod(x-wrapped[i]+.5,1)-.5)<1e-7)));
 }
 return cell;
}
test('arbitrary cyclic primitive lattices are exact in square and triangular metrics',()=>{
 for(const lattice of ['square','triangular'])for(let n=1;n<=12;n++)for(let a=0;a<n;a++)for(let b=0;b<n;b++)checkCell(lattice,subgroup(n,[[a,b]]));
});
test('rectangular, oblique and noncyclic cells preserve the certified translation lattice',()=>{
 for(const lattice of ['square','triangular'])for(const [n,generators] of [[12,[[3,0],[0,4]]],[12,[[2,3],[4,0]]],[18,[[2,3],[6,0]]],[31,[[1,6]]],[48,[[4,6],[0,12]]]])checkCell(lattice,subgroup(n,generators));
});
test('cell camera is Euclidean and reversible for oblique/rectangular cells at every selector count',()=>{
 for(const lattice of ['square','triangular'])for(const translations of [subgroup(6,[[2,0]]),subgroup(31,[[1,6]]),subgroup(12,[[2,3],[4,0]])])for(const count of [1,2,3]){
  const view=makeWallpaperCellView({lattice,translations,count}),centre=view.viewOptions.viewOrigin;
  const p0=view.originalToScreen(centre),scale=[];
  for(const d of [[.13,.2],[.31,-.2],[-.7,.45]]){
   const point=add(centre,d),screen=view.originalToScreen(point),back=view.screenToOriginal(screen);
   assert.ok(back.every((x,i)=>Math.abs(x-point[i])<1e-8));
   scale.push(Math.hypot(screen[0]-p0[0],screen[1]-p0[1])/Math.hypot(...metric(d,lattice)));
  }
  assert.ok(scale.every(x=>Math.abs(x-scale[0])<1e-8),'camera stretches physical geometry');
  assert.ok(view.originalCorners.every(view.contains));
  for(const corner of view.corners)assert.ok(corner.every(x=>x>=.055-1e-8&&x<=.945+1e-8));
  assert.ok(!view.contains(view.cell.basis[0].map(x=>x*(count+.1))));
  assert.equal(view.guideMarkup.includes(`data-cell-divisions="${2*(count-1)}"`),count>1);
 }
});
test('simulation camera uses physical width and supplies its exact crop corners',()=>{
 for(const lattice of ['square','triangular'])for(const count of [1,2,3]){
  const view=makeWallpaperCellView({lattice,count,framing:'simulation',translations:subgroup(4,[[1,0]])});
  const expected=[[0,0],[1,0],[1,1],[0,1]];
  for(let i=0;i<4;i++)assert.ok(view.corners[i].every((x,j)=>Math.abs(x-expected[i][j])<1e-9));
  const left=view.screenToOriginal([0,.5]),right=view.screenToOriginal([1,.5]);
  assert.ok(Math.abs(Math.hypot(...metric(right.map((x,i)=>x-left[i]),lattice))-count)<1e-9);
  assert.equal(view.clipPath,'');assert.equal(view.guideMarkup,'');
 }
});
test('phase-tail orientation follows the camera, including unrotated simulation framing',()=>{
 const translations=subgroup(31,[[1,6]]);
 for(const lattice of ['square','triangular']){
  const cells=makeWallpaperCellView({lattice,translations,framing:'cells'});
  const simulation=makeWallpaperCellView({lattice,translations,framing:'simulation'});
  assert.ok(cells.cell.angleDegrees!==0,'exercise an oblique repeat lattice');
  assert.equal(cells.glyphAngleOffset,cells.cell.angleDegrees);
  assert.equal(simulation.glyphAngleOffset,0,'simulation camera does not rotate the field');
 }
});
test('incomplete and inconsistent translation data is rejected',()=>{
 assert.throws(()=>wallpaperPrimitiveCell({translations:[[0,0],[1/3,0]]}),/complete finite subgroup/);
 assert.throws(()=>wallpaperPrimitiveCell({translations:[[0,0],[.5,0],[0,.5]]}),/complete finite subgroup/);
 assert.throws(()=>wallpaperPrimitiveCell({translations:[[0,0],[NaN,0]]}),/Invalid cell translation/);
});
