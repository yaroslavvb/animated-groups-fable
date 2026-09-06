import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {wallpaperGeneratorPlacements,wallpaperOperationGeometry,timeShiftLabel,renderWallpaperOverlay} from '../wallpaper-overlay.mjs';
import {primitiveCell} from '../cell-geometry.mjs';
import {makeCellView} from '../cell-view.mjs';
const catalog=JSON.parse(await readFile(new URL('../wallpaper-groups.json',import.meta.url)));
const byId=id=>catalog.groups.find(g=>g.id===id);
const mv=(A,p)=>A.map(r=>r[0]*p[0]+r[1]*p[1]);
const mod=x=>((x%1)+1)%1;
const eqmod=(a,b)=>Math.min(mod(a-b),mod(b-a))<1e-7;
const camera=(g,count=1)=>makeCellView(primitiveCell({family:g.lattice==='triangular'?'p6':'p4',translations:[[0,0]]}),count);
const countUnique=items=>new Set(items.map(i=>i.point?.map(x=>Math.round(mod(x)*1e8)%1e8).join(','))).size;

test('complete conjugate centre orbits for 2222, 333 and 632',()=>{
 for(const [id,count] of [['g5',4],['g7',8],['g224',3],['g227',9],['g248',6]]){
  const g=byId(id),placements=wallpaperGeneratorPlacements(g,{cellView:camera(g)}).filter(p=>p.kind==='rotation');
  assert.equal(countUnique(placements),count,id);
 }
});
test('all 68 overlays contain only canonical affine symmetries and match the playback camera',()=>{
 for(const g of catalog.groups){
  const view=camera(g),placements=wallpaperGeneratorPlacements(g,{cellView:view});
  assert.ok(placements.length,`${g.id}: empty overlay`);
  for(const p of placements){
   assert.ok(g.ops.some(o=>o.M.flat().every((x,i)=>Math.abs(x-p.M.flat()[i])<1e-7)&&o.v.every((x,i)=>eqmod(x,p.v[i]))&&eqmod(o.tau,p.tau)),`${g.id} ${p.name}: undeclared operation`);
   if(p.kind==='rotation'){
    assert.ok(view.contains(p.point));assert.deepEqual(p.screenPoint,view.originalToScreen(p.point));
    assert.ok(mv(p.M,p.point).every((x,i)=>Math.abs(x+p.v[i]-p.point[i])<1e-7));
   }else{
    for(const point of p.segment)assert.ok(view.contains(point),`${g.id}: unclipped axis`);
    assert.deepEqual(p.screenSegment,p.segment.map(view.originalToScreen));
    if(p.kind==='mirror'||p.kind==='glide')for(const point of p.segment)assert.ok(mv(p.M,point).every((x,i)=>Math.abs(x+p.v[i]-point[i]-p.marker.glideVector[i])<1e-7));
   }
  }
 }
});
test('reflection lines retain their actual time offsets, including spatial mirrors with half-period offsets',()=>{
 const g=byId('g231'),placements=wallpaperGeneratorPlacements(g,{cellView:camera(g)});
 assert.ok(placements.every(p=>p.kind==='mirror'&&p.tau===.5&&p.phaseLabel==='+1/2 T'));
 const glideGroup=byId('g75'),glides=wallpaperGeneratorPlacements(glideGroup,{cellView:camera(glideGroup)}).filter(p=>p.kind==='glide');
 assert.ok(glides.length);assert.ok(glides.every(p=>p.tau===.25&&p.phaseLabel==='+1/4 T'));
});
test('two and three cell views repeat the same canonical operation geometry',()=>{
 const g=byId('g248');
 const one=wallpaperGeneratorPlacements(g,{cellView:camera(g,1)});
 for(const n of [2,3]){
  const view=camera(g,n),many=wallpaperGeneratorPlacements(g,{cellView:view});
  assert.ok(many.length>one.length);assert.equal(countUnique(many),6);
  for(const p of many)assert.deepEqual(p.screenPoint,view.originalToScreen(p.point));
 }
});
test('time reversal is rejected; forward phases are rendered as fractions of T',()=>{
 assert.throws(()=>wallpaperOperationGeometry({M:[[1,0],[0,1]],v:[0,0],s:-1},byId('g1')),/constant time offsets/);
 assert.equal(timeShiftLabel(5/6),'+5/6 T');assert.equal(timeShiftLabel(0),'0 T');
});

test('extra certified periods generate new centres, not just translated old centres',()=>{
 const g=byId('g5'),view=camera(g);
 const original=wallpaperGeneratorPlacements(g,{cellView:view});
 const extended=wallpaperGeneratorPlacements(g,{cellView:view,translations:[[0,0],[.5,0]]});
 assert.equal(countUnique(original),4);assert.equal(countUnique(extended),8);
 assert.ok(extended.some(p=>Math.abs(p.point[0]-.25)<1e-8));
 for(const p of extended)assert.ok(mv(p.M,p.point).every((x,i)=>Math.abs(x+p.v[i]-p.point[i])<1e-7));
});

test('canonical translations retain their full vectors and clipped arrows never invent shorter endpoints',async()=>{
 const {makeWallpaperCellView}=await import('../wallpaper-cell.mjs');
 const group=byId('g1'),translations=[[0,0],[.5,0]],view=makeWallpaperCellView({lattice:'square',translations,count:1});
 const placements=wallpaperGeneratorPlacements(group,{cellView:view,translations});
 assert.equal(placements.length,2,'certified periods do not manufacture additional X/Y arrows');
 const x=placements.find(p=>p.name==='X'),y=placements.find(p=>p.name==='Y');
 assert.deepEqual(x.v,[1,0]);assert.deepEqual(y.v,[0,1]);assert.ok(x.clippedStart&&x.clippedEnd);assert.ok(!y.clippedStart&&!y.clippedEnd);
 const svg={style:{},setAttribute(){},toggleAttribute(){},querySelectorAll(){return []}};
 renderWallpaperOverlay(svg,group,{cellView:view,translations});
 const xMarkup=svg.innerHTML.match(/<g[^>]+aria-label="X:[\s\S]+?<\/g>/)?.[0];
 assert.ok(xMarkup.includes('continues beyond cell'));assert.equal((xMarkup.match(/<path/g)||[]).length,2,'clipped X has a line and its shadow, no false arrowhead');
});
