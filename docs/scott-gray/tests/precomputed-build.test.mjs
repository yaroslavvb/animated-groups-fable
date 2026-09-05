import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {buildCatalog,decodeField,concentrationRanges,thumbnail,sha256,compactDiagnostics,normalizedConfig} from '../research/build-catalog.mjs';
const site=new URL('../',import.meta.url);
const metadata=JSON.parse(await readFile(new URL('data/orbits/g95-standing-N48-M128.json',site)));
const binary=await readFile(new URL('data/orbits/'+metadata.fieldUrl,site));

test('cached admission cannot silently relabel a field with a different physical cell',()=>{
  const config=metadata.config,expected=config.N*config.params.dx;
  assert.equal(normalizedConfig(config,config.ops).L,expected);
  assert.throws(()=>normalizedConfig({...config,L:2*expected},config.ops),/Physical cell length/);
  assert.throws(()=>normalizedConfig({...config,L:NaN},config.ops),/Physical cell length/);
});

test('precomputed build checks each exact Float32 payload before using saved evidence',()=>{
  const field=decodeField(metadata,binary);assert.equal(field.length,metadata.fieldValueCount);
  const changed=Buffer.from(binary);changed[101]^=1;
  assert.throws(()=>decodeField(metadata,changed),/SHA-256/);
  assert.throws(()=>decodeField({...metadata,fieldValueCount:2},binary),/dimensions/);
  const nan=Buffer.from(binary);nan.writeFloatLE(NaN,0);
  assert.throws(()=>decodeField({...metadata,fieldSha256:sha256(nan)},nan),/non-finite/);
});

test('thumbnails use a fixed full-orbit range and encode deterministic, decodable PNGs',()=>{
  const field=decodeField(metadata,binary),ranges=concentrationRanges(field,metadata.config.N,metadata.config.M);
  for(const [channel,key] of [[0,'u'],[1,'v']]){
    assert.ok(ranges[key][1]>ranges[key][0]);const S=metadata.config.N**2;
    for(let t=0;t<metadata.config.M;t++)for(let i=0;i<S;i++){const value=field[t*2*S+channel*S+i];assert.ok(value>=ranges[key][0]&&value<=ranges[key][1]);}
  }
  const images=[];
  for(const palette of ['ember','ceramic','concentration']){
    const png=thumbnail(field,metadata.config.N,ranges,palette);assert.ok(png.equals(thumbnail(field,metadata.config.N,ranges,palette)));
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(png.readUInt32BE(16),160);assert.equal(png.readUInt32BE(20),160);
    const parts=[];for(let cursor=8;cursor<png.length;){const length=png.readUInt32BE(cursor),type=png.subarray(cursor+4,cursor+8).toString();if(type==='IDAT')parts.push(png.subarray(cursor+8,cursor+8+length));cursor+=length+12;}
    const pixels=inflateSync(Buffer.concat(parts));assert.equal(pixels.length,160*(160*4+1));
    for(let y=0;y<160;y++){assert.equal(pixels[y*641],0);for(let x=0;x<160;x++)assert.equal(pixels[y*641+4+4*x],255);}
    images.push(sha256(png));
  }
  assert.equal(new Set(images).size,3,'Each palette has its own saved image.');
});

test('compact evidence cannot hide a failed audit and never retains integrator state',()=>{
  const phase={passed:true,independentForwardFrames:true,primitiveAtResolvedDivisors:true,operations:[],periodChecks:Array(64).fill({}),spectrum:[1,2]};
  const full={validated:true,reasons:[],closure:{computed:true,finalState:[1,2]},refinedClosure:{computed:true,finalState:[1,2]},candidatePhase:phase,independentPhase:phase,refinedPhase:phase};
  const compact=compactDiagnostics(full);assert.equal(compact.closure.finalState,undefined);assert.equal(compact.refinedPhase.periodChecks,undefined);assert.equal(compact.refinedPhase.spectrum,undefined);
  assert.throws(()=>compactDiagnostics({...full,validated:false}),/unverified/);
  assert.throws(()=>compactDiagnostics({...full,refinedPhase:{...phase,passed:false}}),/phase audit/);
});

test('checked-in parameter catalog and thumbnails match every source without rerunning integration',async()=>{
  const catalog=await buildCatalog({check:true,log:()=>{}});
  const manifest=JSON.parse(await readFile(new URL('data/verified-orbits.json',site)));
  assert.equal(catalog.orbits.length,manifest.orbits.length);assert.ok(catalog.orbits.length>=77,'Preserve the original saved atlas while adding branches.');
  assert.deepEqual([...new Set(catalog.orbits.map(entry=>entry.groupId))].sort(),['g94','g95','g96','g97','g98','g99']);
  assert.ok(JSON.stringify(catalog).length<2000000,'Initial parameter manifest should remain small even with the larger gallery.');
  for(const entry of catalog.orbits){assert.equal(entry.offlineVerification.passed,true);assert.ok(entry.id.startsWith('saved:'));assert.equal(entry.fieldSha256,entry.offlineVerification.fieldSha256);assert.deepEqual(Object.keys(entry.thumbnails),['ember','ceramic','concentration']);}
});
