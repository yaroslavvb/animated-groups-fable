import test from 'node:test';
import assert from 'node:assert/strict';
import {createWallpaperCatalog} from '../wallpaper-atlas.mjs';
import {sha256} from '../precomputed-catalog.mjs';
const group={id:'g6',family:'p2',meshMultiple:1,frameMultiple:2,hasTimeShift:true,lattice:'square',ops:[{M:[[1,0],[0,1]],v:[0,0],s:1,tau:0},{M:[[-1,0],[0,-1]],v:[0,0],s:1,tau:.5}]};
async function fixture(){
 const field=new Float32Array(2*4*4*8).fill(.3),bytes=field.buffer,digest=await sha256(bytes);
 const entry={id:'saved:test',groupId:group.id,config:{groupId:group.id,N:4,M:8,L:64,period:333,ops:group.ops,params:{F:.004,k:.02,Du:.16,Dv:.08,dx:16,stencil:'five-point'}},fieldEncoding:'float32-le',fieldUrl:'data/field.f32',fieldSha256:digest,fieldValueCount:field.length,fieldByteLength:bytes.byteLength,ranges:{u:[.1,.5],v:[.1,.5]},thumbnails:{ember:'a.png',ceramic:'b.png',concentration:'c.png'},offlineVerification:{gateVersion:'wallpaper-offline-v1',fieldSha256:digest,passed:true},wallpaperVerification:{passed:true,phaseRelations:{passed:true},visibility:{passed:true},independentDynamics:{passed:true},temporalResolution:{passed:true},forwardTargetPhaseBounds:{passed:true}},translations:[{v:[0,0],max:0,relativeRms:0}],translationVerification:{passed:true,fieldSha256:digest,N:4,maximumAbsoluteError:1e-7,maximumRelativeRms:1e-6}};
 return {bytes,entry,manifest:{schema:'scott-gray-wallpaper-atlas-v1',gateVersion:'wallpaper-offline-v1',orbits:[entry]}};
}
const opts={groups:[group],baseUrl:'https://example.test/scott-gray/'};
test('saved fields are resolved against the atlas root and integrity checked before admission',async()=>{
 const {bytes,manifest}=await fixture();let calls=0;
 const catalog=createWallpaperCatalog(manifest,{...opts,fetcher:async url=>{assert.equal(url,'https://example.test/scott-gray/data/field.f32');calls++;return {ok:true,arrayBuffer:async()=>bytes};}});
 assert.equal(catalog.size('g6'),1);assert.equal(catalog.get('saved:test').thumbnails.ember,'https://example.test/scott-gray/a.png');assert.equal(catalog.isVerified(catalog.get('saved:test')),false);
 const [a,b]=await Promise.all([catalog.load('saved:test'),catalog.load('saved:test')]);assert.equal(a,b);assert.equal(calls,1);assert.equal(catalog.isVerified(a,'g6'),true);assert.equal(catalog.isVerified(a,'g7'),false);assert.ok(a.field instanceof Float32Array);
});
test('canonical time offsets, independent dynamics, visibility, and cell evidence are mandatory',async()=>{
 for(const corrupt of [r=>r.config.ops[1].tau=0,r=>r.wallpaperVerification.independentDynamics.passed=false,r=>r.wallpaperVerification.visibility.passed=false,r=>r.wallpaperVerification.forwardTargetPhaseBounds.passed=false,r=>r.wallpaperVerification.temporalResolution.passed=false,r=>r.translationVerification.fieldSha256='0'.repeat(64),r=>r.translations[0].max=.01]){
  const {manifest}=await fixture();const copy=structuredClone(manifest);corrupt(copy.orbits[0]);assert.throws(()=>createWallpaperCatalog(copy,opts));
 }
});
test('concurrent selections recover an interrupted download once and share the verified result',async()=>{
 const {bytes,manifest}=await fixture();let attempts=0,release;const options=[],hold=new Promise(resolve=>{release=resolve;});
 const bad=bytes.slice(0);new Uint8Array(bad)[0]^=1;
 const catalog=createWallpaperCatalog(manifest,{...opts,fetcher:async(url,init)=>{options.push(init);attempts++;if(attempts===2)await hold;return {ok:true,arrayBuffer:async()=>attempts===1?bad:bytes};}});
 const first=catalog.load('saved:test');assert.equal(first,catalog.load('saved:test'));
 while(attempts<2)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(first,catalog.load('saved:test'));release();
 const loaded=await first;assert.ok(catalog.isVerified(loaded));assert.equal(attempts,2);assert.deepEqual(options,[undefined,{cache:'reload'}]);assert.equal(await catalog.load('saved:test'),loaded);assert.equal(attempts,2);
});
test('permanently damaged downloads never enter the cache and later explicit selections can retry',async()=>{
 const {bytes,manifest}=await fixture();let attempts=0;
 const bad=bytes.slice(0);new Uint8Array(bad)[0]^=1;
 const catalog=createWallpaperCatalog(manifest,{...opts,fetcher:async()=>({ok:true,arrayBuffer:async()=>++attempts<=2?bad:bytes})});
 await assert.rejects(catalog.load('saved:test'),/integrity/);assert.equal(attempts,2);assert.equal(catalog.isVerified(catalog.get('saved:test')),false);
 const loaded=await catalog.load('saved:test');assert.ok(catalog.isVerified(loaded));assert.equal(attempts,3);
});
test('correctly hashed nonfinite wallpaper concentrations fail without another download',async()=>{
 const {bytes,entry,manifest}=await fixture();new DataView(bytes).setFloat32(0,NaN,true);const digest=await sha256(bytes);
 entry.fieldSha256=digest;entry.offlineVerification.fieldSha256=digest;entry.translationVerification.fieldSha256=digest;let calls=0;
 const catalog=createWallpaperCatalog(manifest,{...opts,fetcher:async()=>{calls++;return{ok:true,arrayBuffer:async()=>bytes};}});
 await assert.rejects(catalog.load('saved:test'),/Invalid concentration/);assert.equal(calls,1);assert.equal(catalog.isVerified(catalog.get('saved:test')),false);
});
test('zero-offset references do not require a fictitious visible time shift',async()=>{
 const {manifest}=await fixture(),g={...group,hasTimeShift:false,ops:[group.ops[0]]};const r=manifest.orbits[0];r.config.ops=g.ops;r.wallpaperVerification.visibility={passed:false,applicable:false};assert.equal(createWallpaperCatalog(manifest,{...opts,groups:[g]}).size(),1);
});
