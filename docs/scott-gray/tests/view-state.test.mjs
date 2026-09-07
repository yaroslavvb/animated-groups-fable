import test from 'node:test';
import assert from 'node:assert/strict';
import {readViewState,writeViewHash} from '../view-state.mjs';
const defaults={groupId:null,patternId:null,palette:'ember',tiles:2,framing:'simulation',speed:1,generator:null,overlay:false,approximate:true,phase:0,play:true};

test('bare anchors default to simulation width, autoplay and hidden generators',()=>{
 for(const groupId of ['g95','g248'])assert.deepEqual(readViewState('#'+groupId),{...defaults,groupId});
 for(const input of ['',null,undefined,'#invalid'])assert.deepEqual(readViewState(input),defaults);
});
test('unspecified framing uses simulation width while explicit shared framing is retained',()=>{
 for(const query of ['v=2','v=2&tiles=1','v=1','v=1&tiles=99','v=1&tiles=','v=2&framing=invalid']){
  assert.equal(readViewState('#g95?'+query).framing,'simulation',query);
 }
 for(const version of ['1','2'])for(const framing of ['cells','simulation']){
  const requested=readViewState(`#g95?v=${version}&tiles=3&framing=${framing}`);
  assert.equal(requested.framing,framing);assert.equal(requested.tiles,3);
  assert.deepEqual(readViewState(writeViewHash(requested)),requested);
 }
 const written=writeViewHash({groupId:'g95'});
 assert.match(written,/&framing=simulation&/);
 assert.equal(readViewState(written).framing,'simulation');
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
test('exact generator operation placements round-trip without collapsing to the named generator',()=>{
 const placements=[
  'P@op:1,0,0,-1:0,0.5:0',
  'Q@op:1,0,0,-1:-0.5,1.25:0.5',
  'R@op:1,0,0,1:1,0:0.333333333',
  'α@op:0,-1,1,0:0.25,-0.75:0.25',
  'α@op:0,1,-1,0:-0.25,0.75:0.25',
  'β@op:1,-1e-9,1e-7,-1:0.000000001,-1e-8:0.166666667',
 ];
 for(const generator of placements){
  const view={...defaults,groupId:'g95',generator,overlay:true,play:false,phase:0.1371234567890123};
  const hash=writeViewHash(view);
  assert.deepEqual(readViewState(hash),view,generator);
  assert.equal(writeViewHash(readViewState(hash)),hash);
  assert.match(hash,/%40op%3A/);
 }
 assert.notEqual(writeViewHash({groupId:'g95',generator:placements[3]}),writeViewHash({groupId:'g95',generator:placements[4]}));
});
test('malformed or nonfinite generator operations are rejected independently of other URL controls',()=>{
 const invalid=[
  'A@op:1,0,0,-1:0,0:0', 'P@other:1,0,0,-1:0,0:0',
  'P@op:1,0,-1:0,0:0', 'P@op:1,0,0,0,-1:0,0:0',
  'P@op:1,0,0,-1:0:0', 'P@op:1,0,0,-1:0,0,0:0',
  'P@op:1,0,0,-1:0,0:0,0', 'P@op:1,0,0,-1:0,0:0:extra',
  'P@op:1,,0,-1:0,0:0', 'P@op:1,0,0,-1:0,0:',
  'P@op:1,0,0,-1:0,0:NaN', 'P@op:Infinity,0,0,-1:0,0:0',
  'P@op:1,0,0,-1:0,0:1e999', 'P@op:1,0,0,-1:0,0:-1e999',
  'P@op:01,0,0,-1:0,0:0', 'P@op:+1,0,0,-1:0,0:0',
  'P@op:0x1,0,0,-1:0,0:0', 'P@op:1,0,0,-1:0,0:.5',
  'P@op:1,0,0,-1:0,0:0.1234567891', 'P@op:1,0,0,-1:0,0:0 ',
  'P@op:1,0,0,-1:0,0:0\n', 'P@op:1,0,0,-1:0,0:0\r\n',
  'P@op:1,0,0,-1:0,0:0<script>', `P@op:${'1'.repeat(256)},0,0,-1:0,0:0`,
 ];
 for(const generator of invalid){
  const hash='#g95?v=2&palette=ceramic&play=0&generator='+encodeURIComponent(generator);
  const view=readViewState(hash);
  assert.equal(view.generator,null,generator);
  assert.equal(view.palette,'ceramic');assert.equal(view.play,false);
  assert.equal(readViewState(writeViewHash({groupId:'g95',generator})).generator,null,generator);
 }
});
