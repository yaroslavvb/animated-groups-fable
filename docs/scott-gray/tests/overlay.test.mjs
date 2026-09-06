import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GROUP_DISPLAY,generatorPlacements,generatorMarkup,renderGeneratorOverlay} from '../overlay.mjs';
import {primitiveCell,latticeToCell} from '../cell-geometry.mjs';
import {makeCellView} from '../cell-view.mjs';
import {rotationCentres} from '../rotation-centres.mjs';

const source = JSON.parse(fs.readFileSync(new URL('../../data/clockwork-coloring-correspondence.json',import.meta.url),'utf8')).groups;
const page = fs.readFileSync(new URL('../../correspondence-p4.html',import.meta.url),'utf8');

test('all six short signatures, named operations and glyph outlines match correspondence source',()=>{
  for(const [id,g] of Object.entries(GROUP_DISPLAY)){
    const record=source.find(r=>r.id===id);
    assert.equal(g.shortText,record.book_color_signature);
    const sourceSvg=page.match(new RegExp(`<svg class="plate-generator-overlay" data-generator-overlay="${id}".*?</svg>`))[0];
    assert.equal(g.namedGenerators.length,3);
    for(const gen of g.namedGenerators){
      const src=record.chaim_presentation.generators.find(s=>s.generator===gen.name);
      assert.deepEqual(gen.centre,src.plate_visualization.centre);
      assert.equal(gen.operationIndex,src.plate_source_index);
      assert.equal(gen.timeShift,src.time_shift);
      assert.ok(sourceSvg.includes(`d="${gen.path}"`));
      const [x,y]=gen.centre, A=gen.matrix,v=gen.translation;
      assert.equal(A[0][0]*x+A[0][1]*y+v[0],x,'generator fixes marked x');
      assert.equal(A[1][0]*x+A[1][1]*y+v[1],y,'generator fixes marked y');
      assert.equal(gen.tau,record.render.ops[gen.operationIndex].tau);
    }
  }
});

test('named centres use the displayed field coordinate convention, including asymmetric g98 and g99',()=>{
  const g98=generatorPlacements('g98',{tiles:1,width:400});
  assert.ok(g98.some(g=>g.name==='γ'&&g.x===300&&g.y===100));
  const g99=generatorPlacements('g99',{tiles:1,width:400});
  assert.ok(g99.some(g=>g.name==='α'&&g.x===300&&g.y===0));
  assert.ok(g99.some(g=>g.name==='β'&&g.x===100&&g.y===0));
  assert.ok(g99.some(g=>g.name==='γ'&&g.x===0&&g.y===300));
});

test('same short form retains g96/g97 opposite directed phase shifts',()=>{
  assert.equal(GROUP_DISPLAY.g96.shortText,GROUP_DISPLAY.g97.shortText);
  assert.equal(GROUP_DISPLAY.g96.namedGenerators[0].timeShift,'3/4');
  assert.equal(GROUP_DISPLAY.g97.namedGenerators[0].timeShift,'1/4');
  assert.match(generatorMarkup('g96',{tiles:2,selected:'α'}),/data-time-shift="3\/4"/);
  assert.match(generatorMarkup('g96',{tiles:2,selected:'α'}),/aria-pressed="true"/);
});

test('primitive oblique cell overlays include negative lattice copies and match the field camera',()=>{
  const translations=[[0,0],[.5,.5]],cell=primitiveCell({family:'p4',translations}),centres=rotationCentres({namedGenerators:GROUP_DISPLAY.g96.namedGenerators,family:'p4',translations}),width=768;
  assert.equal(cell.angleDegrees,45);
  for(const count of [1,2,3]){
    const cellView=makeCellView(cell,count),placements=generatorPlacements('g96',{tiles:count,width,centres,cellView});
    assert.ok(placements.some(g=>g.tileX<0),'oblique cell crosses an original lattice boundary');
    let weightedCentres=0;
    for(const g of placements){
      const back=cellView.screenToOriginal([g.x/width,g.y/width]);back.forEach((v,i)=>assert.ok(Math.abs(v-g.centre[i])<1e-12));
      assert.ok(cellView.contains(g.centre));
      const p=latticeToCell(g.centre,cell);let weight=1;
      for(const value of p)if(Math.abs(value)<1e-8||Math.abs(value-count)<1e-8)weight/=2;
      weightedCentres+=weight;
      const fixed=g.matrix.map((row,i)=>row[0]*g.centre[0]+row[1]*g.centre[1]+g.translation[i]);fixed.forEach((v,i)=>assert.ok(Math.abs(v-g.centre[i])<1e-12));
    }
    assert.equal(weightedCentres,4*count*count,'exactly four weighted centres per primitive square cell');
    const first=placements[0],markup=generatorMarkup('g96',{tiles:count,width,centres,cellView,glyphScale:.9/count});
    assert.ok(markup.includes(`rotate(${(first.glyphAngle??0)-45}) scale(${.9/count})`),'glyph rotates with the cell camera');
  }
});

test('approximate markers retain a visible verified lower-order ring and original operation selection',()=>{
  const original=rotationCentres({namedGenerators:GROUP_DISPLAY.g96.namedGenerators,family:'p4'})[0],lower={...original,key:'γ@0,0',order:2};
  const candidate={...original,approximate:true,verifiedLowerOrder:lower},centres=[candidate],cellView=makeCellView(primitiveCell({family:'p4'}),1);
  const markup=generatorMarkup('g96',{centres,cellView,selected:lower.key});
  assert.match(markup,/approximate-centre is-selected/);assert.match(markup,/class="sg-generator-approximation"/);assert.match(markup,/class="sg-generator-verified"/);assert.match(markup,/verified 2-fold centre/);
  let selected;
  const svg={setAttribute(){},classList:{add(){}},contains(){return true;}};
  renderGeneratorOverlay(svg,{groupId:'g96',centres,cellView,onSelect:g=>{selected=g;}});
  svg.onclick({target:{closest:()=>({dataset:{centreKey:candidate.key}})}});
  assert.equal(selected,candidate,'selection returns the canonical original operation, never a camera-rescaled operation');
});
