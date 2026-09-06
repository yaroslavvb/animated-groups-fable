import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../wallpaper-groups.json',import.meta.url)));
const source=JSON.parse(await readFile(new URL('../../data/clockwork-coloring-correspondence.json',import.meta.url)));
const mm=(A,B)=>A.map(r=>[r[0]*B[0][0]+r[1]*B[1][0],r[0]*B[0][1]+r[1]*B[1][1]]);
const mv=(A,p)=>A.map(r=>r[0]*p[0]+r[1]*p[1]);
const mod=x=>((x%1)+1)%1;
const number=x=>Math.round(mod(x)*1e8)%1e8;
const key=o=>`${o.M.flat()}|${o.v.map(number)}|${number(o.tau)}`;
const compose=(a,b)=>({M:mm(a.M,b.M),v:mv(a.M,b.v).map((x,i)=>x+a.v[i]),tau:mod(a.tau+b.tau)});

test('all 17 correspondence families and all 68 actions are included exactly once',()=>{
 assert.equal(catalog.families.length,17);assert.equal(catalog.groups.length,68);
 assert.deepEqual(new Set(catalog.groups.map(g=>g.id)),new Set(source.groups.map(g=>g.id)));
 assert.equal(catalog.groups.filter(g=>g.hasTimeShift).length,51);
 for(const f of catalog.families) assert.deepEqual(new Set(f.groupIds),new Set(catalog.groups.filter(g=>g.family===f.id).map(g=>g.id)));
});
test('every finite affine action closes and its phase is a homomorphism',()=>{
 for(const g of catalog.groups){
  const allowed=new Set(g.ops.map(key));
  assert.equal(allowed.size,g.ops.length,g.id);
  for(const a of g.ops)for(const b of g.ops)assert.ok(allowed.has(key(compose(a,b))),`${g.id}: closure`);
  for(const a of g.ops){
   assert.equal(a.s,1);assert.ok(Math.abs(a.tau*g.phaseOrder-Math.round(a.tau*g.phaseOrder))<1e-8);
   for(const x of a.v)assert.ok(Math.abs(x*g.meshMultiple-Math.round(x*g.meshMultiple))<1e-8);
  }
 }
});
test('named generators generate the entire declared finite action',()=>{
 for(const g of catalog.groups){
  const first={M:[[1,0],[0,1]],v:[0,0],tau:0}, found=[first], seen=new Set([key(first)]);
  for(let i=0;i<found.length;i++)for(const a of g.namedGenerators){
   const next=compose(a,found[i]),k=key(next);
   if(!seen.has(k)){seen.add(k);found.push(next);assert.ok(found.length<=64,g.id);}
  }
  assert.deepEqual(seen,new Set(g.ops.map(key)),g.id);
 }
});
test('all operators are physical isometries for the declared numerical metric',()=>{
 for(const g of catalog.groups){
  const B=[[g.basis[0][0],g.basis[1][0]],[g.basis[0][1],g.basis[1][1]]];
  const transpose=A=>[[A[0][0],A[1][0]],[A[0][1],A[1][1]]];
  const metric=mm(transpose(B),B);
  for(const o of g.ops){const pulled=mm(mm(transpose(o.M),metric),o.M);assert.ok(pulled.flat().every((v,i)=>Math.abs(v-metric.flat()[i])<1e-9),g.id);}
 }
});
test('rotation centres and mirror/glide axes recover their original affine operation',()=>{
 for(const g of catalog.groups)for(const o of g.namedGenerators){
  const m=o.marker;
  if(m.kind==='rotation')assert.ok(mv(o.M,m.centre).every((v,i)=>Math.abs(v+o.v[i]-m.centre[i])<1e-9),`${g.id} ${o.name}`);
  if(m.kind==='mirror'||m.kind==='glide')for(const t of [-2,0,1.5]){
   const point=m.axisPoint.map((v,i)=>v+t*m.axisDirection[i]);
   assert.ok(mv(o.M,point).every((v,i)=>Math.abs(v+o.v[i]-point[i]-m.glideVector[i])<1e-8),`${g.id} ${o.name}`);
  }
 }
});
