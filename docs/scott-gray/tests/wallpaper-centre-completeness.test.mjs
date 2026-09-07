import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {wallpaperGeneratorPlacements} from '../wallpaper-overlay.mjs';
import {makeWallpaperCellView} from '../wallpaper-cell.mjs';

const metadata=JSON.parse(await readFile(new URL('../wallpaper-groups.json',import.meta.url)));
const atlas=JSON.parse(await readFile(new URL('../data/wallpaper-atlas.json',import.meta.url)));
const groups=new Map(metadata.groups.map(g=>[g.id,g]));
const affected=atlas.orbits.find(r=>r.id==='wallpaper:g245:c74b45b07d722c40');
const mul=(A,p)=>A.map(r=>r[0]*p[0]+r[1]*p[1]);
const product=(A,B)=>A.map(r=>[r[0]*B[0][0]+r[1]*B[1][0],r[0]*B[0][1]+r[1]*B[1][1]]);
const key=p=>p.map(x=>Math.round(x*1e7)).join(',');
const mod=(x,n)=>((x%n)+n)%n;
const operationKey=op=>JSON.stringify([op.M.flat(),op.v.map(x=>mod(Math.round(x*1e7),1e7)),mod(Math.round(op.tau*1e7),1e7)]);
const prepare=(record,count=1)=>{
 const group=groups.get(record.groupId),view=makeWallpaperCellView({lattice:group.lattice,translations:record.translations,count});
 return {group,view,placements:wallpaperGeneratorPlacements(group,{cellView:view,translations:record.translations}).filter(p=>p.kind==='rotation')};
};

test('g245 fills every 632 centre in one, two and three certified repeat cells',()=>{
 assert.equal(affected.translations.length,3);
 for(const count of [1,2,3]){
  const {view,placements}=prepare(affected,count);
  assert.equal(placements.length,6*count*count+4*count+1);
  const weighted={2:0,3:0,6:0};
  for(const p of placements){
   const cell=mul(view.cell.inverse,p.point);
   const weight=cell.reduce((w,x)=>w*(Math.abs(x)<1e-7||Math.abs(x-count)<1e-7?.5:1),1);
   weighted[p.marker.order]+=weight;
   assert.deepEqual(p.screenPoint,view.originalToScreen(p.point));
   const transformed=mul(p.M,p.point).map((x,i)=>x+p.v[i]);
   assert.ok(transformed.every((x,i)=>Math.abs(x-p.point[i])<1e-7));
  }
  assert.deepEqual(weighted,{2:3*count*count,3:2*count*count,6:count*count});
 }
});

test('the three restored g245 centres obey the stored movie, including their time offsets',async()=>{
 const {placements}=prepare(affected);
 const restored=[[1/3,1/3],[1/3,1/6],[1/6,1/3]].map(point=>{
  const item=placements.find(p=>key(p.point)===key(point));assert.ok(item,`Missing centre ${point}`);return item;
 });
 assert.deepEqual(restored.map(p=>[p.name,p.glyph.symbol]),[['β','rotation-3-1'],['γ','rotation-2-0'],['γ','rotation-2-0']]);
 const bytes=await readFile(new URL(`../${affected.fieldUrl}`,import.meta.url));
 const field=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
 const {N,M}=affected.config,frameSize=2*N*N;
 for(const op of restored){
  const shift=Math.round(op.tau*M),dx=Math.round(op.v[0]*N),dy=Math.round(op.v[1]*N);
  let maximum=0;
  for(let t=0;t<M;t++)for(let channel=0;channel<2;channel++){
   const source=t*frameSize+channel*N*N,target=mod(t+shift,M)*frameSize+channel*N*N;
   for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const xx=mod(op.M[0][0]*x+op.M[0][1]*y+dx,N),yy=mod(op.M[1][0]*x+op.M[1][1]*y+dy,N);
    maximum=Math.max(maximum,Math.abs(field[source+y*N+x]-field[target+yy*N+xx]));
   }
  }
  assert.ok(maximum<=1e-7,`${op.name}: concentration mismatch ${maximum}`);
 }
});

test('every saved named-rotation geometry agrees with the canonical group and all lattice translations',()=>{
 const cases=new Map();
 for(const record of atlas.orbits){
  const group=groups.get(record.groupId);
  if(!group.namedGenerators.some(g=>g.kind==='rotation'))continue;
  const id=JSON.stringify([record.groupId,record.translations.map(t=>t.v)]);
  if(!cases.has(id))cases.set(id,record);
 }
 assert.ok(cases.size>=100);
 for(const record of cases.values()){
  const {group,view,placements}=prepare(record),classes=new Set();
  // Mirror intersections may supply other rotations that are not separate
  // named generators on the reference plate. Match the named conjugacy
  // classes, keeping those inferred intersection rotations out of this test.
  for(const source of group.namedGenerators.filter(g=>g.kind==='rotation'))for(const by of group.ops){
   const d=by.M[0][0]*by.M[1][1]-by.M[0][1]*by.M[1][0],inv=[[by.M[1][1]/d,-by.M[0][1]/d],[-by.M[1][0]/d,by.M[0][0]/d]];
   const M=product(product(by.M,source.M),inv),v=mul(by.M,source.v).map((x,i)=>x+by.v[i]-mul(M,by.v)[i]);
   classes.add(operationKey({M,v,tau:source.tau}));
  }
  const expected=new Map();
  // Independent closure over the finite group operations, rather than the
  // named-generator/conjugate templates used by the overlay implementation.
  for(const op of group.ops){
   if(!classes.has(operationKey(op)))continue;
   if(op.M[0][0]*op.M[1][1]-op.M[0][1]*op.M[1][0]<0)continue;
   const A=[[1-op.M[0][0],-op.M[0][1]],[-op.M[1][0],1-op.M[1][1]]],det=A[0][0]*A[1][1]-A[0][1]*A[1][0];
   if(!det)continue;
   const trace=op.M[0][0]+op.M[1][1],order=trace===-2?2:trace===-1?3:trace===0?4:6;
   for(const period of record.translations){
    const v=op.v.map((x,i)=>x+period.v[i]);
    const corners=view.originalCorners.map(p=>mul(A,p).map((x,i)=>x-v[i]));
    const ranges=[0,1].map(k=>[Math.ceil(Math.min(...corners.map(p=>p[k]))-1e-7),Math.floor(Math.max(...corners.map(p=>p[k]))+1e-7)]);
    for(let i=ranges[0][0];i<=ranges[0][1];i++)for(let j=ranges[1][0];j<=ranges[1][1];j++){
     const w=[v[0]+i,v[1]+j],point=[(A[1][1]*w[0]-A[0][1]*w[1])/det,(-A[1][0]*w[0]+A[0][0]*w[1])/det];
     if(view.contains(point))expected.set(key(point),Math.max(expected.get(key(point))??0,order));
    }
   }
  }
  const actual=new Map(placements.map(p=>[key(p.point),p.marker.order]));
  assert.deepEqual([...actual].sort(),[...expected].sort(),`${record.groupId}, ${record.translations.length} certified periods`);
 }
});
