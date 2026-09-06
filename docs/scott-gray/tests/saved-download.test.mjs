import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadOrbitBytes,sha256} from '../precomputed-catalog.mjs';

const bytes=Float32Array.of(.125,.25,.5,.75).buffer;
const fieldSha256=await sha256(bytes),metadata={byteLength:bytes.byteLength,fieldSha256};
const response=()=>({ok:true,arrayBuffer:async()=>bytes.slice(0)});

test('successful downloads require one fetch and retain simple response-fixture compatibility',async()=>{
 const calls=[];
 const loaded=await downloadOrbitBytes('movie.f32',{...metadata,fetcher:async(...args)=>{calls.push(args);return{arrayBuffer:async()=>bytes};}});
 assert.deepEqual(loaded,bytes);assert.deepEqual(calls,[['movie.f32']]);
});

test('network, body-stream, retryable HTTP, truncation and checksum failures recover at most once',async()=>{
 const bad=bytes.slice(0);new Uint8Array(bad)[0]^=1;
 const cases=[
  ()=>{throw new TypeError('Failed to fetch');},
  ()=>({ok:true,arrayBuffer:async()=>{throw new TypeError('Stream interrupted');}}),
  ...[408,429,500,502,503,504,599].map(status=>()=>({ok:false,status})),
  ()=>({ok:true,arrayBuffer:async()=>bytes.slice(0,4)}),
  ()=>({ok:true,arrayBuffer:async()=>bad}),
 ];
 for(const failedResponse of cases){
  const calls=[];
  const loaded=await downloadOrbitBytes('movie.f32',{...metadata,fetcher:async(...args)=>{calls.push(args);return calls.length===1?failedResponse():response();}});
  assert.deepEqual(loaded,bytes);assert.deepEqual(calls,[['movie.f32'],['movie.f32',{cache:'reload'}]]);
 }
});

test('two failed attempts reject instead of accepting damaged data or retrying endlessly',async()=>{
 const bad=bytes.slice(0);new Uint8Array(bad)[0]^=1;
 for(const failedResponse of [()=>{throw Error('Offline');},()=>({ok:false,status:503}),()=>({ok:true,arrayBuffer:async()=>bytes.slice(0,4)}),()=>({ok:true,arrayBuffer:async()=>bad})]){
  let calls=0;
  await assert.rejects(downloadOrbitBytes('movie.f32',{...metadata,fetcher:async()=>{calls++;return failedResponse();}}));
  assert.equal(calls,2);
 }
});

test('permanent HTTP errors, malformed responses and cancellations are not retried',async()=>{
 for(const failure of [...[400,401,403,404,410].map(status=>()=>({ok:false,status})),()=>null,()=>({ok:true}),()=>{throw Object.assign(Error('Cancelled'),{name:'AbortError'});},()=>({ok:true,arrayBuffer:async()=>{throw Object.assign(Error('Cancelled body'),{name:'AbortError'});}})]){
  let calls=0;await assert.rejects(downloadOrbitBytes('movie.f32',{...metadata,fetcher:async()=>{calls++;return failure();}}));assert.equal(calls,1);
 }
});

test('invalid expected hashes and sizes are rejected before network access',async()=>{
 for(const invalid of [{fieldSha256:'bad'},{byteLength:0},{byteLength:NaN},{byteLength:1.5}]){
  let calls=0;await assert.rejects(downloadOrbitBytes('movie.f32',{...metadata,...invalid,fetcher:async()=>{calls++;return response();}}),/metadata/);assert.equal(calls,0);
 }
});
