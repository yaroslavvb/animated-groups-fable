import test from 'node:test';
import assert from 'node:assert/strict';
import {planRefinementReplacement,replaceManifestEntry,physicalKey} from '../research/refinement-replacements.mjs';
const metadata=(N=48,changes={})=>({config:{groupId:'g244',N,M:96,L:512,period:333,params:{F:.00406,k:.02,Du:.16,Dv:.08,dx:512/N,stencil:'triangular-six'}},provenance:{branchId:'woven-Q7'},...changes});
const entry=(url='coarse.json',groupId='g244')=>({url,groupId,name:'Woven field'});
function setup(old=[entry()],metas=[metadata()]){return {manifest:{orbits:old,preferredGroup:'g244',researchNote:'Preserve unrelated state.'},previousByUrl:new Map(old.map((e,i)=>[e.url,metas[i]]))};}
const plan=(data,candidate=metadata(96),destinationUrl='fine.json')=>planRefinementReplacement({...data,metadata:candidate,groupId:candidate.config.groupId,destinationUrl});

test('a fine correction archives its coarse choice and contributes exactly one current choice',()=>{
 const state=setup(),before=structuredClone(state.manifest),nextEntry=entry('fine.json');
 const superseded=plan(state),next=replaceManifestEntry(state.manifest,nextEntry,superseded);
 assert.deepEqual(next.orbits,[nextEntry]);assert.equal(next.refinementReplacements.length,1);
 assert.equal(next.refinementReplacements[0].url,'coarse.json');assert.equal(next.refinementReplacements[0].replacedBy,'fine.json');
 assert.equal(next.preferredGroup,'g244');assert.equal(next.researchNote,before.researchNote);assert.deepEqual(state.manifest,before);
});

test('multiple historical coarse exports collapse to one fine choice',()=>{
 const state=setup([entry('coarse24.json'),entry('coarse48.json')],[metadata(24),metadata(48)]);
 const next=replaceManifestEntry(state.manifest,entry('fine96.json'),plan(state,metadata(96),'fine96.json'));
 assert.equal(next.orbits.length,1);assert.equal(next.refinementReplacements.length,2);
});

test('different physical parameters, branches and groups remain separate choices',()=>{
 for(const change of [m=>{m.config.params.F=.00407;},m=>{m.config.params.Dv=.09;},m=>{m.config.L=768;m.config.params.dx=16;},m=>{m.config.params.stencil='five-point';},m=>{m.provenance.branchId='other';},m=>{m.config.groupId='g245';}]){
  const old=metadata(96);change(old);const state=setup([entry('other.json',old.config.groupId)],[old]);
  assert.deepEqual(plan(state,metadata(48)),[]);assert.equal(replaceManifestEntry(state.manifest,entry('fine.json'),[]).orbits.length,2);
 }
});

test('alternate exports at equal or coarser spatial resolution cannot count twice',()=>{
 const state=setup([entry('fine.json')],[metadata(96)]);
 for(const N of [24,48,96])assert.throws(()=>plan(state,metadata(N),'alternate.json'),/equal or finer/);
});

test('same-name re-audits are idempotent and cannot silently replace another grid or branch',()=>{
 const state=setup([entry('fine.json')],[metadata(96)]),newEntry={...entry('fine.json'),name:'Updated description'};
 const next=replaceManifestEntry(state.manifest,newEntry,plan(state,metadata(96),'fine.json'));
 assert.equal(next.orbits.length,1);assert.equal(next.orbits[0].name,newEntry.name);assert.equal(next.refinementReplacements,undefined);
 assert.throws(()=>plan(state,metadata(48),'fine.json'),/distinct export name/);
 const another=metadata(96);another.provenance.branchId='other';assert.throws(()=>plan(state,another,'fine.json'),/distinct export name/);
});

test('a re-admitted archived URL is counted once as current',()=>{
 const current=entry('accepted-again.json'),manifest={orbits:[],excludedFromGallery:[current,entry('still-excluded.json')]};
 const next=replaceManifestEntry(manifest,current,[]);
 assert.deepEqual(next.orbits,[current]);assert.deepEqual(next.excludedFromGallery,[entry('still-excluded.json')]);
 assert.equal(manifest.excludedFromGallery.length,2);
});

test('successive refinements retain an audit trail without re-counting retired exports',()=>{
 const first=setup(),middle=replaceManifestEntry(first.manifest,entry('mid66.json'),plan(first,metadata(66),'mid66.json'));
 const last=replaceManifestEntry(middle,entry('fine96.json'),plan({manifest:middle,previousByUrl:new Map([['mid66.json',metadata(66)]])},metadata(96),'fine96.json'));
 assert.deepEqual(last.orbits.map(e=>e.url),['fine96.json']);assert.deepEqual(last.refinementReplacements.map(e=>[e.url,e.replacedBy]),[['coarse.json','mid66.json'],['mid66.json','fine96.json']]);
});

test('corrupt bookkeeping cannot mislabel a replacement',()=>{
 const state=setup();assert.throws(()=>plan({...state,manifest:{orbits:[entry(),entry()]}}),/duplicate URLs/);
 const wrong=metadata();wrong.config.groupId='g245';assert.throws(()=>plan({...state,previousByUrl:new Map([['coarse.json',wrong]])}),/groups disagree/);
 assert.throws(()=>planRefinementReplacement({...state,metadata:metadata(),groupId:'g245',destinationUrl:'fine.json'}),/groups disagree/);
});

test('physical identity excludes numerical resolution and can derive an omitted lattice side',()=>{
 const a=metadata(48).config,b=metadata(96).config;delete b.L;assert.equal(physicalKey(a),physicalKey(b));
 b.M=192;b.period=334;assert.equal(physicalKey(a),physicalKey(b));
});
