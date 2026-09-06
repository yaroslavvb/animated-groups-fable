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
test('damaged downloads cannot be branded as verified and failures can be retried',async()=>{
 const {bytes,manifest}=await fixture();let attempts=0;
 const bad=bytes.slice(0);new Uint8Array(bad)[0]^=1;
 const catalog=createWallpaperCatalog(manifest,{...opts,fetcher:async()=>({ok:true,arrayBuffer:async()=>++attempts===1?bad:bytes})});
 await assert.rejects(catalog.load('saved:test'),/integrity/);const loaded=await catalog.load('saved:test');assert.ok(catalog.isVerified(loaded));assert.equal(attempts,2);
});
test('zero-offset references do not require a fictitious visible time shift',async()=>{
 const {manifest}=await fixture(),g={...group,hasTimeShift:false,ops:[group.ops[0]]};const r=manifest.orbits[0];r.config.ops=g.ops;r.wallpaperVerification.visibility={passed:false,applicable:false};assert.equal(createWallpaperCatalog(manifest,{...opts,groups:[g]}).size(),1);
});
