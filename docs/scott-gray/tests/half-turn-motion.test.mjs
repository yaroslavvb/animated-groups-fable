import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {wallpaperGeneratorPlacements,renderWallpaperOverlay,wallpaperOperationLabel} from '../wallpaper-overlay.mjs';
import {makeWallpaperCellView} from '../wallpaper-cell.mjs';
const metadata=JSON.parse(await readFile(new URL('../wallpaper-groups.json',import.meta.url)));
const group=metadata.groups.find(g=>g.id==='g6');
const view=makeWallpaperCellView({lattice:'square',framing:'simulation',count:2});
const svg=()=>({style:{},setAttribute(){},toggleAttribute(){},querySelectorAll(){return []},getBoundingClientRect(){return {width:768}}});

test('opposite continuous rotations obey the identical half-turn/half-period symmetry',()=>{
 for(const sign of [-1,1])for(const theta of [.17,1.3,2.8])for(const time of [0,.17,.61]){
  const wave=(angle,t)=>Math.cos(angle-sign*2*Math.PI*t);
  assert.ok(Math.abs(wave(theta+Math.PI,time+.5)-wave(theta,time))<1e-14);
  assert.ok(Math.abs(wave(theta+Math.PI/2,time+.25)-wave(theta,time))<1e-14=== (sign===1));
 }
 for(const op of group.namedGenerators){
  assert.deepEqual(op.M,[[-1,0],[0,-1]]);assert.equal(op.tau,.5);
  assert.equal(wallpaperOperationLabel(op,view),`${op.name}: 180° turn · +1/2 T`);
 }
});

test('half-turn symbols remain original while separate arrows show measured alternating motion',()=>{
 const placements=wallpaperGeneratorPlacements(group,{cellView:view});
 for(const item of placements)item.localMotion={direction:['α','β'].includes(item.name)?'clockwise':'counterclockwise'};
 const output=svg();renderWallpaperOverlay(output,group,{cellView:view,placements});
 assert.equal((output.innerHTML.match(/class="local-motion-arrow"/g)||[]).length,placements.length);
 assert.ok(output.innerHTML.includes('data-motion-direction="clockwise"'));
 assert.ok(output.innerHTML.includes('data-motion-direction="counterclockwise"'));
 assert.equal((output.innerHTML.match(/<title>[^<]*Half-turn symbols do not specify a motion direction/g)||[]).length,placements.length);
 for(const item of placements)assert.ok(output.innerHTML.includes(`d="${item.glyph.path}"`));
 assert.ok(placements.every(p=>p.glyph.symbol==='rotation-2-1'));
 assert.equal((output.innerHTML.match(/data-screen-angle="180"/g)||[]).length,placements.length);
 // SVG y points down: clockwise uses sweep=1, counterclockwise sweep=0.
 assert.match(output.innerHTML,/data-motion-direction="clockwise"[^]*? A[^ ]+ [^ ]+ 0 1 1 /);
 assert.match(output.innerHTML,/data-motion-direction="counterclockwise"[^]*? A[^ ]+ [^ ]+ 0 1 0 /);
});

test('unmeasured and ambiguous motion never acquire an arrow from a phase-tail symbol',()=>{
 for(const localMotion of [undefined,{status:'mixed-motion',direction:null},{status:'under-resolved',direction:null}]){
  const output=svg(),placements=wallpaperGeneratorPlacements(group,{cellView:view}).map(item=>({...item,localMotion}));
  renderWallpaperOverlay(output,group,{cellView:view,placements});
  assert.ok(!output.innerHTML.includes('class="local-motion-arrow"'));
  assert.ok(output.innerHTML.includes('Local motion: no reliable direction measured.'));
  assert.ok(output.innerHTML.includes(group.namedGenerators[0].glyph.path));
 }
});
