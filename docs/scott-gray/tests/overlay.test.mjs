import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GROUP_DISPLAY,generatorPlacements,generatorMarkup} from '../overlay.mjs';

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
