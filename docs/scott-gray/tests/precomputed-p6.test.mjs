import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createPrecomputedCatalog} from '../precomputed-catalog.mjs';

const groups=JSON.parse(readFileSync(new URL('../p6/groups.json',import.meta.url)));
const squareGroups=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));

// This is a trusted-artifact loader fixture, not a candidate for PDE admission.
function fixture(){
  const N=6,M=12,bytes=new ArrayBuffer(2*N*N*M*4),view=new DataView(bytes);
  for(let i=0;i<bytes.byteLength/4;i++)view.setFloat32(4*i,.1+i/10000,true);
  const fieldSha256=createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),gateVersion='recomputed-triangular-field-v1';
  const entry={id:'saved:hexagon',groupId:'g248',config:{N,M,period:330,L:256,groupId:'g248',ops:structuredClone(groups.find(g=>g.id==='g248').render.ops),params:{F:.00408,k:.02,Du:.16,Dv:.08,dx:256/N,stencil:'triangular-six'}},
    fieldUrl:'data/orbits/hexagon.f32',fieldSha256,fieldEncoding:'float32-le',fieldByteLength:bytes.byteLength,fieldValueCount:2*N*N*M,
    ranges:{u:[.1,.2],v:[.02,.08]},diagnostics:{validated:true},offlineVerification:{gateVersion,passed:true,fieldSha256},
    thumbnails:{ember:'ember.png',ceramic:'ceramic.png',concentration:'concentration.png'}};
  return {bytes,manifest:{schema:'scott-gray-precomputed-atlas-v1',family:'p6',gateVersion,orbits:[entry]}};
}

test('632 precomputed choices load only selected bytes with their sixfold time character',async()=>{
  const {bytes,manifest}=fixture(),requests=[];
  const saved=createPrecomputedCatalog(manifest,{groups,family:'p6',fetcher:async url=>{requests.push(url);return {ok:true,arrayBuffer:async()=>bytes};}});
  assert.equal(saved.size('g248'),1);assert.equal(saved.size('g95'),0);assert.equal(requests.length,0);
  const summary=saved.nearest('g248',{F:.004,k:.02});assert.equal(summary.config.params.stencil,'triangular-six');
  const record=await saved.load(summary.id);assert.equal(record.field.length,864);assert.equal(saved.isVerified(record,'g248'),true);
  assert.equal(saved.isVerified(record,'g247'),false);assert.equal(await saved.load(summary.id),record);
  assert.deepEqual(requests,['data/orbits/hexagon.f32']);
});

test('a 632 artifact cannot be treated as a 442 orbit or lose its triangular discretization',()=>{
  const {manifest}=fixture();
  assert.throws(()=>createPrecomputedCatalog(manifest,{groups:squareGroups}),/supported precomputed atlas/);
  assert.throws(()=>createPrecomputedCatalog(manifest,{groups:squareGroups,family:'p6'}),/All six canonical 632/);
  for(const change of [
    m=>{m.orbits[0].config.params.stencil='five-point';},
    m=>{m.orbits[0].config.ops[1].tau=0;},
    m=>{m.orbits[0].config.M=16;},
    m=>{m.orbits[0].offlineVerification.gateVersion='recomputed-from-field-v1';},
  ]){const changed=structuredClone(manifest);change(changed);assert.throws(()=>createPrecomputedCatalog(changed,{groups,family:'p6'}));}
});
