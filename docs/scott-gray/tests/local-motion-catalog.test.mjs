import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLocalMotionCatalog,localMotionCentreKey} from '../local-motion.mjs';
import {makeWallpaperCellView} from '../wallpaper-cell.mjs';
import {wallpaperGeneratorPlacements} from '../wallpaper-overlay.mjs';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
const metadata=await read('../data/local-motion.json'),catalog=createLocalMotionCatalog(metadata);
const groups=new Map((await read('../wallpaper-groups.json')).groups.map(g=>[g.id,g]));
const records=new Map();
for(const path of ['../data/precomputed-atlas.json','../p6/data/precomputed-atlas.json','../data/wallpaper-atlas.json','../data/equation-atlas.json'])for(const r of (await read(path)).orbits)records.set(r.id,r);

test('full precomputation covers every shipped record and emits only measured directions',()=>{
 assert.equal(metadata.records.length,records.size);let centres=0,arrows=0;
 for(const measured of metadata.records){
  const record=records.get(measured.id);assert.ok(record,measured.id);
  const group=groups.get(record.groupId),view=makeWallpaperCellView({lattice:group.lattice,framing:'simulation'});
  const lookup=catalog.forRecord(record,group,view);assert.equal(lookup.size,measured.centres.length,record.id);
  for(const centre of measured.centres){
   const item=lookup.get(localMotionCentreKey(centre.centre));assert.ok(item);centres++;
   if(centre.status==='rotation'){
    assert.equal(centre.confidence,'high');assert.ok(item.direction);arrows++;
   }else assert.equal(item.direction,null,`${record.id}: no invented motion from ${centre.status}`);
  }
 }
 assert.ok(centres>8000);assert.ok(arrows>1000&&arrows<centres);
});

test('reported movie gives opposite motion arrows with identical half-turn generators at every visible repeat',()=>{
 const record=records.get('wallpaper:g6:731aa45654d4d690'),group=groups.get('g6');
 for(const framing of ['cells','simulation'])for(const count of [1,2,3]){
  const view=makeWallpaperCellView({lattice:group.lattice,framing,count,translations:record.translations});
  const lookup=catalog.forRecord(record,group,view);
  for(const p of wallpaperGeneratorPlacements(group,{cellView:view,translations:record.translations})){
   const motion=lookup.get(localMotionCentreKey(p.point));assert.ok(motion,p.key);
   assert.equal(motion.direction,['α','β'].includes(p.name)?'clockwise':'counterclockwise',p.key);
   assert.deepEqual(p.M,[[-1,0],[0,-1]]);assert.equal(p.tau,.5);assert.equal(p.glyph.symbol,'rotation-2-1');
  }
 }
});
