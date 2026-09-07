import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {wallpaperGeneratorPlacements,wallpaperGlyphTransform,wallpaperScreenRotation,wallpaperOperationLabel} from '../wallpaper-overlay.mjs';
import {makeWallpaperCellView} from '../wallpaper-cell.mjs';

const catalog=JSON.parse(await readFile(new URL('../wallpaper-groups.json',import.meta.url)));
const reference=JSON.parse(await readFile(new URL('../../data/clockwork-coloring-correspondence.json',import.meta.url)));
const originals=new Map(reference.groups.map(g=>[g.id,g]));
const I=[[1,0],[0,1]],S=[[1,0],[0,-1]];
const mul=(A,p)=>A.map(row=>row[0]*p[0]+row[1]*p[1]);
const product=(A,B)=>A.map(row=>[row[0]*B[0][0]+row[1]*B[1][0],row[0]*B[0][1]+row[1]*B[1][1]]);
const determinant=A=>A[0][0]*A[1][1]-A[0][1]*A[1][0];
const inverse=A=>{const d=determinant(A);return [[A[1][1]/d,-A[0][1]/d],[-A[1][0]/d,A[0][0]/d]];};
const difference=(A,B)=>Math.max(...A.flat().map((x,i)=>Math.abs(x-B.flat()[i])));
const basis=g=>[[g.render.basis[0][0],g.render.basis[1][0]],[g.render.basis[0][1],g.render.basis[1][1]]];
const mod=(x,n)=>((x%n)+n)%n;
const rotation=degrees=>{const a=degrees*Math.PI/180;return [[Math.cos(a),-Math.sin(a)],[Math.sin(a),Math.cos(a)]];};
const nearby=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1e-8);
const cameraCases=group=>['cells','simulation'].flatMap(framing=>[false,true].map(tilted=>makeWallpaperCellView({
 lattice:group.lattice,count:2,framing,
 translations:!tilted?[[0,0]]:group.lattice==='triangular'?[[0,0],[2/3,1/3],[1/3,2/3]]:[[0,0],[.5,.5]],
})));
const sourceGenerator=(group,item)=>group.namedGenerators.find(g=>g.name===item.name);
const sourceScreenAction=(group,item)=>{
 const original=originals.get(group.id),B=basis(original),source=sourceGenerator(group,item);
 return product(product(product(product(S,B),source.M),inverse(B)),S);
};

/** Compare actual points, not the renderer's matrix-construction formula:
 * applying the saved affine action to an artwork ray through the field camera
 * must equal applying the reference-plate rotation to that same artwork ray. */
function checkArtworkAction(group,item,view){
 const T=wallpaperGlyphTransform(item,group,view),R=sourceScreenAction(group,item);
 const centre=item.point??item.marker.centre,screen=view.originalToScreen(centre);
 assert.ok(Math.abs(Math.abs(determinant(T))-1)<1e-7,'glyph has unit area');
 assert.ok(difference(product(T,inverse(T)),I)<1e-7);
 for(const ray of [[1,0],[0,1],[.3,-.7]]){
  const before=screen.map((x,i)=>x+.01*mul(T,ray)[i]);
  const original=view.screenToOriginal(before),after=view.originalToScreen(mul(item.M,original).map((x,i)=>x+item.v[i]));
  const expected=screen.map((x,i)=>x+.01*mul(T,mul(R,ray))[i]);
  assert.ok(nearby(after,expected),`${group.id} ${item.name}: artwork and saved field turn differently`);
 }
 return T;
}

test('original symbol steps incorporate the named spatial turn, not merely tau times the order',()=>{
 for(const group of catalog.groups){
  const B=basis(originals.get(group.id));assert.ok(determinant(B)>0);
  for(const item of group.namedGenerators.filter(g=>g.kind==='rotation')){
   const [n,m]=item.glyph.symbol.match(/^rotation-(\d+)-(\d+)$/).slice(1).map(Number);
   const A=product(product(B,item.M),inverse(B));
   const orientation=n===2?1:Math.sign(A[1][0]);
   assert.equal(m,mod(Math.round(orientation*item.tau*n),n),`${group.id} ${item.name}`);
  }
 }
 const g96=catalog.groups.find(g=>g.id==='g96').namedGenerators[0];
 const g139=catalog.groups.find(g=>g.id==='g139').namedGenerators[0];
 assert.equal(g96.tau,.75);assert.equal(g139.tau,.25);
 assert.equal(g96.glyph.symbol,'rotation-4-1');assert.equal(g139.glyph.symbol,'rotation-4-1');
});

test('all 68 group actions transport canonical and conjugate artwork through both actual cameras',()=>{
 const visited=new Set();let rotations=0;
 for(const group of catalog.groups)for(const view of cameraCases(group)){
  visited.add(group.id);
  const canonical=group.namedGenerators.filter(g=>g.kind==='rotation');
  const conjugates=wallpaperGeneratorPlacements(group,{cellView:view}).filter(g=>g.kind==='rotation');
  for(const item of [...canonical,...conjugates]){
   checkArtworkAction(group,item,view);rotations++;
  }
 }
 assert.equal(visited.size,68);assert.ok(rotations>1000);
});

test('rendered chirality encodes the correct forward CCW phase at every displayed rotation',()=>{
 for(const group of catalog.groups)for(const view of cameraCases(group)){
  for(const item of wallpaperGeneratorPlacements(group,{cellView:view}).filter(g=>g.kind==='rotation')){
   const T=wallpaperGlyphTransform(item,group,view),[n,m]=item.glyph.symbol.match(/^rotation-(\d+)-(\d+)$/).slice(1).map(Number);
   const phaseStep=mod(Math.round((determinant(T)<0?-1:1)*m),n);
   const {angleDegrees,direction}=wallpaperScreenRotation(item,view);
   const movieStep=mod(Math.round((direction==='clockwise'?-1:1)*item.tau*n),n);
   assert.equal(phaseStep,movieStep,`${group.id} ${item.key}: wrong rendered screw handedness`);
   const [right,turned]=[[item.point[0]+.1,item.point[1]],mul(item.M,[item.point[0]+.1,item.point[1]]).map((x,i)=>x+item.v[i])].map(p=>view.originalToScreen(p));
   const c=view.originalToScreen(item.point),u=right.map((x,i)=>x-c[i]),v=turned.map((x,i)=>x-c[i]);
   const measured=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1])*180/Math.PI;
   assert.ok(Math.abs(mod(angleDegrees-measured+180,360)-180)<1e-6,'description follows actual screen turn');
  }
 }
});

test('exact g139 Brusselator centres use opposite screen directions with the same quarter-period offset',async()=>{
 const atlas=JSON.parse(await readFile(new URL('../data/equation-atlas.json',import.meta.url)));
 const record=atlas.orbits.find(r=>r.id==='equation:brusselator:g139:4edab43428d74fa2');assert.ok(record);
 const group=catalog.groups.find(g=>g.id===record.groupId);
 assert.deepEqual(record.config.ops,group.ops);
 for(const framing of ['cells','simulation']){
  const view=makeWallpaperCellView({lattice:group.lattice,count:2,framing,translations:record.translations});
  const items=wallpaperGeneratorPlacements(group,{cellView:view,translations:record.translations});
  const clockwise=items.find(p=>p.kind==='rotation'&&nearby(p.point,[.25,0]));
  const ccw=items.find(p=>p.kind==='rotation'&&nearby(p.point,[.75,0]));
  assert.ok(clockwise&&ccw);
  for(const item of [clockwise,ccw]){assert.equal(item.tau,.25);assert.equal(item.glyph.symbol,'rotation-4-1');checkArtworkAction(group,item,view);}
  assert.deepEqual(wallpaperScreenRotation(clockwise,view),{angleDegrees:90,direction:'clockwise'});
  assert.deepEqual(wallpaperScreenRotation(ccw,view),{angleDegrees:-90,direction:'counterclockwise'});
  assert.ok(determinant(wallpaperGlyphTransform(clockwise,group,view))<0);
  assert.ok(determinant(wallpaperGlyphTransform(ccw,group,view))>0);
  assert.equal(wallpaperOperationLabel(clockwise,view),'α: 90° clockwise · +1/4 T');
  assert.equal(wallpaperOperationLabel(ccw,view),'α: 90° counterclockwise · +1/4 T');
 }
});

test('the old square transform fails on the reported generator, while triangular artwork is unchanged',()=>{
 const group=catalog.groups.find(g=>g.id==='g139'),view=makeWallpaperCellView({lattice:'square',count:1});
 const item=group.namedGenerators.find(g=>g.kind==='rotation'),old=rotation(view.glyphAngleOffset),source=sourceScreenAction(group,item);
 const actual=rotation(90),wrong=product(product(old,source),inverse(old));
 assert.ok(difference(wrong,actual)>1.9,'regression must fail under the previous square formula');
 const corrected=wallpaperGlyphTransform(item,group,view);
 assert.ok(difference(product(product(corrected,source),inverse(corrected)),actual)<1e-7);
 for(const g of catalog.groups.filter(g=>g.lattice==='triangular'))for(const camera of cameraCases(g)){
  for(const marker of wallpaperGeneratorPlacements(g,{cellView:camera}).filter(p=>p.kind==='rotation')){
   const previous=product(rotation(camera.glyphAngleOffset),marker.glyphMatrix??I);
   assert.ok(difference(previous,wallpaperGlyphTransform(marker,g,camera))<1e-7,`${g.id}: triangular glyph changed`);
  }
 }
});
