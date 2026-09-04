import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSolutionAtlas} from '../solution-atlas.mjs';

const groups=JSON.parse(readFileSync(new URL('../groups.json',import.meta.url)));
const siteBase=new URL('../',import.meta.url);
function bundles(){
  const manifest=JSON.parse(readFileSync(new URL('../data/verified-orbits.json',import.meta.url)));
  assert.ok(Array.isArray(manifest.orbits));
  return manifest.orbits.map(entry=>{
    const metadataUrl=new URL(entry.url,siteBase),metadata=JSON.parse(readFileSync(metadataUrl));
    assert.equal(metadata.schema,'scott-gray-orbit-binary-v1');assert.equal(metadata.config.groupId,entry.groupId);
    assert.ok(metadataUrl.pathname.includes('/data/orbits/'),'The test reads the actual shipped orbit directory.');
    assert.equal(metadata.fieldEncoding,'float32-le');
    const binary=readFileSync(new URL(metadata.fieldUrl,metadataUrl)),values=2*metadata.config.N**2*metadata.config.M;
    assert.equal(metadata.fieldValueCount,values);assert.equal(metadata.fieldByteLength,4*values);assert.equal(binary.length,4*values);
    assert.equal(createHash('sha256').update(binary).digest('hex'),metadata.fieldSha256,'The admitted bytes must match the shipped checksum.');
    const field=new Float32Array(values);for(let i=0;i<values;i++)field[i]=binary.readFloatLE(4*i);
    return {entry,metadata,field};
  });
}

test('every shipped Float32 orbit passes fresh canonical, full-forward and refined-forward admission',async()=>{
  const files=bundles(),atlas=createSolutionAtlas(groups),seen=new Set();
  for(const {entry,metadata,field} of files){
    const canonical=groups.find(group=>group.id===entry.groupId);assert.ok(canonical);
    assert.deepEqual(metadata.config.ops,canonical.render.ops);assert.ok(metadata.config.params.Du>0&&metadata.config.params.Dv>0);
    const result=await atlas.admit({field,config:metadata.config,diagnostics:{validated:false}},{groupId:entry.groupId});
    assert.equal(result.accepted,true,`${entry.url}: ${result.reasons.join(' ')}`);
    const record=result.record,d=record.diagnostics;assert.equal(atlas.isVerified(record,entry.groupId),true);
    assert.equal(d.candidatePhase.passed,true);assert.equal(d.independentPhase.passed,true);assert.equal(d.refinedPhase.passed,true);
    assert.equal(d.independentPhase.independentForwardFrames,true);assert.equal(d.refinedPhase.independentForwardFrames,true);
    assert.equal(d.refinedPhase.primitiveAtResolvedDivisors,true);assert.equal(d.symmetryMax,0);
    assert.ok(d.refinedClosure.dt<=d.closure.dt/2);assert.ok(d.refinedClosure.steps>=2*d.closure.steps);
    for(const operation of d.refinedPhase.operations)if(operation.tau!==0){assert.ok(operation.sameTimeRms>operation.contrastFloor);assert.ok(operation.phaseRms>operation.contrastFloor);}
    const reported=metadata.validationSummary.refinedReturnRms;
    assert.ok(Math.abs(d.refinedClosure.closureRms-reported)<Math.max(1e-12,reported*1e-4),'Recomputed error agrees with the actual Float32 payload report.');
    seen.add(entry.groupId);
  }
  assert.deepEqual([...seen].sort(),groups.map(group=>group.id).sort(),'All six canonical time characters must have a shipped, independently checked orbit.');
  for(const group of groups){const nearest=atlas.nearest(group.id,{F:.062,k:.0609});assert.ok(nearest);assert.equal(nearest.config.groupId,group.id);assert.equal(atlas.isVerified(nearest,group.id),true);}
});

test('the shipped half-phase g95 movie cannot be passed off as the quarter-phase g96 movie',async()=>{
  const source=bundles().find(file=>file.entry.groupId==='g95');assert.ok(source,'A g95 standing-wave payload must be bundled.');
  const config={...source.metadata.config,groupId:'g96',ops:groups.find(group=>group.id==='g96').render.ops};
  const atlas=createSolutionAtlas(groups),result=await atlas.admit({field:source.field,config,diagnostics:{validated:true}},{groupId:'g96'});
  assert.equal(result.accepted,false);assert.ok(result.reasons.some(reason=>/phase|symmetry|time-shift/i.test(reason)),result.reasons.join(' '));assert.equal(atlas.size(),0);
  // Repeating one actual spatial frame has no genuine temporal action either.
  const stride=2*config.N**2,spatialOnly=new Float32Array(source.field.length);
  for(let t=0;t<config.M;t++)spatialOnly.set(source.field.subarray(0,stride),t*stride);
  const still=await atlas.admit({field:spatialOnly,config,diagnostics:{validated:true}},{groupId:'g96'});
  assert.equal(still.accepted,false);assert.ok(still.reasons.some(reason=>/variation|phase|repeat/i.test(reason)));assert.equal(atlas.size(),0);
});
