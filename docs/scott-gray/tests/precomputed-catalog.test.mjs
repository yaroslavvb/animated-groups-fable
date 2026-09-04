import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createPrecomputedCatalog,sha256,sha256Portable} from '../precomputed-catalog.mjs';

const groups=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
const clone=value=>structuredClone(value),digest=bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const gateVersion='recomputed-from-field-v1';

// Tiny synthetic payloads exercise the artifact loader, not physical acceptance.
// The separate offline builder/atlas tests are responsible for PDE verification.
function fixture(id='saved:one',groupId='g96',params={F:.004,k:.02}){
  const N=4,M=4,bytes=new ArrayBuffer(2*N*N*M*4),view=new DataView(bytes);
  for(let i=0;i<bytes.byteLength/4;i++)view.setFloat32(4*i,.125+i/1024,true);
  const fieldSha256=digest(bytes),config={N,M,period:300,L:256,groupId,ops:clone(groups.find(group=>group.id===groupId).render.ops),params:{Du:.16,Dv:.08,dx:64,stencil:'five-point',...params}};
  return {bytes,entry:{id,groupId,name:id,patternName:'Test fixture',description:'Synthetic loader test',config,
    fieldUrl:`data/orbits/${id.slice(6)}.f32`,fieldEncoding:'float32-le',fieldValueCount:2*N*N*M,fieldByteLength:bytes.byteLength,fieldSha256,
    ranges:{u:[.1,.5],v:[.02,.08]},diagnostics:{validated:true,refinedClosure:{closureRms:1e-9}},
    thumbnails:{ember:'data/thumbnails/one-ember.png',ceramic:'data/thumbnails/one-ceramic.png',concentration:'data/thumbnails/one-concentration.png'},
    offlineVerification:{gateVersion,passed:true,fieldSha256,configSha256:'0'.repeat(64),verificationCodeSha256:'1'.repeat(64)}}};
}
const manifest=(...fixtures)=>({schema:'scott-gray-precomputed-atlas-v1',gateVersion,orbits:fixtures.map(fixture=>fixture.entry)});
const response=bytes=>({ok:true,arrayBuffer:async()=>bytes.slice(0)});

test('portable SHA-256 matches published vectors, block boundaries, and binary byte views',async()=>{
  const vectors=[
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq','248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['a'.repeat(1000000),'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
  ];
  for(const [input,expected] of vectors){const bytes=new TextEncoder().encode(input);assert.equal(sha256Portable(bytes),expected);assert.equal(await sha256(bytes),expected);}
  const buffer=Uint8Array.from({length:1040},(_,i)=>(i*137)%256);
  for(const length of [0,1,55,56,63,64,65,127,128,129,1024]){
    const bytes=buffer.subarray(7,7+length);assert.equal(sha256Portable(bytes),digest(bytes));
  }
});

test('every group, parameter choice, diagnostic and thumbnail is available before any download',()=>{
  const a=fixture(),b=fixture('saved:two','g96',{F:.0041,k:.021}),c=fixture('saved:three','g95');let fetches=0;
  const source=manifest(a,b,c),catalog=createPrecomputedCatalog(source,{groups,fetcher:()=>{fetches++;throw Error('Unwanted fetch');}});
  assert.equal(catalog.size(),3);assert.equal(catalog.size('g96'),2);assert.equal(catalog.size('g95'),1);assert.equal(catalog.size('g99'),0);
  const summaries=catalog.summaries('g96');assert.deepEqual(summaries.map(entry=>entry.id),[a.entry.id,b.entry.id]);
  assert.equal(summaries[0].thumbnails.ember,'data/thumbnails/one-ember.png');assert.deepEqual(summaries[0].ranges.u,[.1,.5]);
  assert.equal(summaries[0].diagnostics.refinedClosure.closureRms,1e-9);assert.equal(Object.hasOwn(summaries[0],'field'),false);
  assert.equal(catalog.get(a.entry.id),summaries[0]);assert.equal(catalog.get('unknown'),null);assert.equal(catalog.isVerified(summaries[0]),false);
  assert.equal(catalog.summaries().length,3);assert.deepEqual(catalog.summaries('unknown'),[]);assert.equal(fetches,0);
  source.orbits[0].config.params.F=1;source.orbits[0].thumbnails.ember='other.png';assert.equal(summaries[0].config.params.F,.004);
  assert.throws(()=>{summaries.push({});},TypeError);assert.throws(()=>{summaries[0].config.ops[0].tau=0;},TypeError);
});

test('loading one selection downloads only its field and deduplicates, caches, and brands immutable records',async()=>{
  const a=fixture(),b=fixture('saved:two','g95'),requested=[];let release;
  const hold=new Promise(resolve=>{release=resolve;});
  const catalog=createPrecomputedCatalog(manifest(a,b),{groups,fetcher:async url=>{requested.push(url);await hold;return response(a.bytes);}});
  const first=catalog.load(a.entry.id),concurrent=catalog.load(a.entry.id);assert.equal(first,concurrent);release();
  const record=await first;assert.deepEqual(requested,[a.entry.fieldUrl]);assert.equal(await catalog.load(a.entry.id),record);assert.equal(requested.length,1);
  assert.equal(record.kind,'verified-periodic');assert.equal(record.atlasId,a.entry.id);assert.equal(record.field.length,128);
  assert.equal(record.field[0],.125);assert.equal(record.field[1],.125+1/1024);assert.equal(Array.isArray(record.field),true);
  assert.equal(catalog.isVerified(record,'g96'),true);assert.equal(catalog.isVerified(record,'g95'),false);assert.equal(catalog.isVerified(clone(record)),false);
  assert.equal(catalog.isVerified(catalog.get(a.entry.id)),false);assert.equal(catalog.isVerified(null),false);
  for(const change of [()=>{record.field[0]=99;},()=>{record.config.params.F=99;},()=>{record.ranges.u[0]=99;},()=>{record.diagnostics.validated=false;}])assert.throws(change,TypeError);
  assert.equal(Object.hasOwn(catalog.get(a.entry.id),'field'),false);
});

test('ordinary HTTP previews verify SHA-256 without WebCrypto and explicitly decode little-endian floats',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'crypto'),a=fixture();
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
  try{
    const catalog=createPrecomputedCatalog(manifest(a),{groups,fetcher:async()=>response(a.bytes)}),record=await catalog.load(a.entry.id);
    assert.equal(record.field[127],new DataView(a.bytes).getFloat32(127*4,true));assert.equal(catalog.isVerified(record),true);
  }finally{if(original)Object.defineProperty(globalThis,'crypto',original);else delete globalThis.crypto;}
});

test('byte corruption and transient network errors fail closed and allow retry',async()=>{
  const a=fixture(),corrupt=a.bytes.slice(0);new Uint8Array(corrupt)[100]^=1;let fetches=0;
  const catalog=createPrecomputedCatalog(manifest(a),{groups,fetcher:async()=>response(++fetches===1?corrupt:a.bytes)});
  await assert.rejects(catalog.load(a.entry.id),/SHA-256 integrity/);assert.equal(catalog.isVerified(catalog.get(a.entry.id)),false);
  const record=await catalog.load(a.entry.id);assert.equal(fetches,2);assert.equal(catalog.isVerified(record),true);
  let attempts=0;const retry=createPrecomputedCatalog(manifest(a),{groups,fetcher:async()=>{
    if(++attempts===1)throw Error('Temporary network interruption');return response(a.bytes);
  }});
  await assert.rejects(retry.load(a.entry.id),/Temporary network/);assert.equal(retry.isVerified(await retry.load(a.entry.id)),true);assert.equal(attempts,2);
  await assert.rejects(retry.load('unknown'),/Unknown precomputed orbit/);assert.equal(attempts,2);
});

test('truncated files, unsuccessful HTTP responses, and correctly hashed non-finite payloads are rejected',async()=>{
  const a=fixture();
  const truncated=createPrecomputedCatalog(manifest(a),{groups,fetcher:async()=>response(a.bytes.slice(0,4))});await assert.rejects(truncated.load(a.entry.id),/wrong byte count/);
  const unavailable=createPrecomputedCatalog(manifest(a),{groups,fetcher:async()=>({ok:false,status:404})});await assert.rejects(unavailable.load(a.entry.id),/HTTP 404/);
  const invalid=fixture();new DataView(invalid.bytes).setFloat32(4,NaN,true);invalid.entry.fieldSha256=digest(invalid.bytes);invalid.entry.offlineVerification.fieldSha256=invalid.entry.fieldSha256;
  const nonfinite=createPrecomputedCatalog(manifest(invalid),{groups,fetcher:async()=>response(invalid.bytes)});await assert.rejects(nonfinite.load(invalid.entry.id),/non-finite concentration/);
});

test('trusted build summaries must retain canonical groups, binary metadata, and offline verification certificates',()=>{
  const a=fixture(),make=source=>createPrecomputedCatalog(source,{groups,fetcher:async()=>response(a.bytes)});
  for(const change of [
    data=>{data.schema='other';},data=>{data.gateVersion='old-gate';},data=>{data.orbits.push(clone(data.orbits[0]));},
    data=>{data.orbits[0].config.ops[0].tau=0;},data=>{data.orbits[0].groupId='g95';},data=>{data.orbits[0].fieldEncoding='float32-be';},
    data=>{data.orbits[0].fieldByteLength++;},data=>{data.orbits[0].fieldSha256='not-a-hash';},data=>{data.orbits[0].offlineVerification.passed=false;},
    data=>{data.orbits[0].diagnostics.validated=false;},data=>{data.orbits[0].ranges.u=[1,1];},data=>{delete data.orbits[0].thumbnails.ember;},
    data=>{data.orbits[0].field=[];},
  ]){const source=manifest(clone(a));change(source);assert.throws(()=>make(source));}
  assert.throws(()=>createPrecomputedCatalog(manifest(a),{groups:groups.slice(1),fetcher:async()=>response(a.bytes)}),/All six/);
  const code=readFileSync(new URL('../precomputed-catalog.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(code,/\bimport\s*(?:\(|[{*]|[^/\n]*from)/,'Page startup must not import any numerical solver or phase auditor.');
});

test('nearest parameter selection uses only precomputed points for the chosen group and honors chart scales',()=>{
  const a=fixture('saved:first','g96',{F:.004,k:.02}),b=fixture('saved:second','g96',{F:.005,k:.021}),other=fixture('saved:other','g95',{F:.0049,k:.0203});let fetches=0;
  const catalog=createPrecomputedCatalog(manifest(a,b,other),{groups,fetcher:()=>{fetches++;throw Error('Unwanted fetch');}}),point={F:.0049,k:.0203};
  assert.equal(catalog.nearest('g96',point).id,a.entry.id);assert.equal(catalog.nearest('g96',point,{scales:{F:1,k:1}}).id,b.entry.id);
  assert.equal(catalog.nearest('g95',point).id,other.entry.id);assert.equal(catalog.nearest('g99',point),null);assert.equal(catalog.nearest('unknown',point),null);
  assert.equal(catalog.nearest('g96',{F:NaN,k:.02}),null);
  for(const scales of [{F:0,k:.08},{F:.2,k:-1},{F:Infinity,k:.08},{F:.2,k:NaN},null])assert.equal(catalog.nearest('g96',point,{scales}),null);
  assert.equal(fetches,0);
});
