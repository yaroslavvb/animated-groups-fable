import test from 'node:test';
import assert from 'node:assert/strict';
import {readViewState,writeViewHash} from '../view-state.mjs';
const defaults={groupId:null,patternId:null,palette:'ember',tiles:2,framing:'cells',speed:1,generator:null,overlay:false,approximate:true,phase:0,play:true};

test('bare anchors default to cell framing, autoplay and hidden generators',()=>{
 for(const groupId of ['g95','g248'])assert.deepEqual(readViewState('#'+groupId),{...defaults,groupId});
 for(const input of ['',null,undefined,'#invalid'])assert.deepEqual(readViewState(input),defaults);
});
test('the reported old Q31 link migrates its requested count to real cells',()=>{
 const old='#g247?v=1&pattern=saved%3AQ31&palette=ember&tiles=1&speed=1&generator=%CE%B1&overlay=1&phase=0.34798750000000434&play=0';
 const migrated=readViewState(old);
 assert.equal(migrated.framing,'cells');assert.equal(migrated.tiles,1);assert.equal(migrated.phase,.34798750000000434);
 assert.equal(migrated.approximate,true);assert.equal(migrated.overlay,true);
 assert.match(writeViewHash(migrated),/^#g247\?v=2&/);
 assert.deepEqual(readViewState(writeViewHash(migrated)),migrated);
});
test('new shared links preserve all controls and exact phase for both framing modes',()=>{
 for(const framing of ['cells','simulation'])for(const approximate of [true,false]){
  const view={...defaults,groupId:'g248',patternId:'saved:g248 test / α?x&%',tiles:3,framing,palette:'ceramic',speed:.5,generator:'α@0.032258065,0.193548387',overlay:true,approximate,phase:.1371234567890123,play:false};
  const hash=writeViewHash(view);assert.deepEqual(readViewState(hash),view);assert.equal(writeViewHash(readViewState(hash)),hash);
  assert.match(hash,new RegExp('&framing='+framing+'&'));assert.match(hash,new RegExp('&approx='+(approximate?'1':'0')+'&'));
 }
});
test('v1 explicitly disabled approximate inspection remains disabled',()=>{
 assert.equal(readViewState('#g247?v=1&approx=0').approximate,false);
});
test('unknown versions and invalid values use safe independent defaults',()=>{
 for(const query of ['v=3&play=0','v=garbage','play=0'])assert.deepEqual(readViewState('#g96?'+query),{...defaults,groupId:'g96'});
 assert.deepEqual(readViewState('#g97?v=2&pattern=&palette=unknown&tiles=99&framing=garbage&speed=0&generator=x&overlay=true&approx=no&phase=Infinity&play=false'),{...defaults,groupId:'g97'});
 assert.equal(writeViewHash(null),'');assert.equal(writeViewHash({groupId:'g95?x'}),'');
});
test('phase validation and generator keys remain bounded',()=>{
 for(const phase of ['-1','1.1','NaN','Infinity','wat','1'])assert.equal(readViewState('#g95?v=2&phase='+phase).phase,0);
 assert.equal(readViewState('#g95?v=2&phase=1e-12').phase,1e-12);
 for(const generator of ['γ@0.5,0','β@0.111111111,0.222222222','α@0,0'])assert.equal(readViewState(writeViewHash({groupId:'g248',generator})).generator,generator);
 for(const generator of ['α@1,0','α@-0.5,0','α@0.1,NaN','α@0.1,0.2<script>'])assert.equal(readViewState(writeViewHash({groupId:'g248',generator})).generator,null);
 assert.equal(readViewState('#g95?v=2&pattern='+'x'.repeat(513)).patternId,null);
 assert.equal(readViewState('#g95?v=2&pattern='+'x'.repeat(512)).patternId.length,512);
 assert.equal(readViewState('#g95?v=2&generator=%E0%A4%A&palette=ceramic').palette,'ceramic');
});
