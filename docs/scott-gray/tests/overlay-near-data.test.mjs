import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {overlayNearEvidence,withApproximateCentres} from '../overlay-near-data.mjs';
import {overlayTranslations} from '../overlay-data.mjs';
import {GROUP_DISPLAY} from '../overlay.mjs';
import {rotationCentres,centreKey} from '../rotation-centres.mjs';

const read = path => JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const index = read('../data/overlay-near-translations.json'),strict = read('../data/overlay-translations.json');
const records = [...read('../data/precomputed-atlas.json').orbits,...read('../p6/data/precomputed-atlas.json').orbits],groups = [...read('../groups.json').map(g=>({...g,...GROUP_DISPLAY[g.id],family:'p4'})),...read('../p6/groups.json')];
const q31 = records.find(r=>r.groupId==='g247'&&r.id.includes('-Q31-'));
const q12 = records.find(r=>r.groupId==='g247'&&r.id.includes('-Q12-'));

test('reported Q31 near-period is identified separately from the strict evidence',()=>{
  const translations = overlayTranslations(strict,q31),e = overlayNearEvidence(index,q31,translations);
  assert.equal(translations.length,1);
  assert.equal(e.approximateTranslationCount,31);
  const group = groups.find(g=>g.id==='g247');
  const exact = rotationCentres({namedGenerators:group.namedGenerators,ops:group.render.ops,family:'p6',translations});
  const all = withApproximateCentres(group,exact,e);
  assert.equal(exact.length,6);assert.equal(all.length,186);
  assert.equal(all.filter(g=>!g.approximate).length,6);
  for(const g of exact)assert.ok(all.includes(g),'exact markers keep their operations and classification');
  assert.ok(Math.max(...e.translations.flatMap(t=>t.channelRelativeMax))>.01,'these are visibly measurable near-symmetries, not roundoff');
});

test('reported Q12 keeps its full exact overlay without an approximate substitute',()=>{
  const translations = overlayTranslations(strict,q12);
  assert.equal(translations.length,12);
  assert.equal(overlayNearEvidence(index,q12,translations),null);
});

test('every approximate record matches the admitted field and only proposes a fully checked closed group',()=>{
  for(const id of Object.keys(index.orbits)){
    const record=records.find(r=>r.id===id),translations=overlayTranslations(strict,record);
    const evidence=overlayNearEvidence(index,record,translations);
    assert.ok(evidence,id);
    const group=groups.find(g=>g.id===record.groupId);
    const exact=rotationCentres({namedGenerators:group.namedGenerators,ops:group.render.ops,family:evidence.family,translations});
    const all=withApproximateCentres(group,exact,evidence);
    assert.equal(all.length,(evidence.family==='p6'?6:['g98','g99'].includes(record.groupId)?8:4)*evidence.approximateTranslationCount);
    for(const g of all){
      const d=g.translation.map((x,i)=>x-group.render.ops.find(op=>JSON.stringify(op.M)===JSON.stringify(g.matrix)&&Math.abs(op.tau-g.tau)<1e-8).v[i]);
      assert.ok(evidence.translations.some(t=>centreKey(t.v)===centreKey(d)),'each displayed affine rotation uses one actually measured translation');
      if(g.verifiedLowerOrder)assert.ok(g.approximate&&g.order>g.verifiedLowerOrder.order);
    }
  }
});

test('mismatched hashes, nonfinite evidence, failed channels, and incomplete groups fail closed',()=>{
  const copy=()=>JSON.parse(JSON.stringify(index)),translations=overlayTranslations(strict,q31);
  assert.equal(overlayNearEvidence(index,{...q31,fieldSha256:'bad'},translations),null);
  for(const mutate of [
    e=>{e.translations[1].channelRelativeMax[1]=.051;},
    e=>{e.translations[1].channelRelativeSampleRms[0]=.021;},
    e=>{e.translations[1].v[0]=NaN;},
    e=>{e.translations[1].v=[0,0];},
    e=>{e.translations.pop();e.approximateTranslationCount--;},
  ]){
    const broken=copy();mutate(broken.orbits[q31.id]);
    assert.equal(overlayNearEvidence(broken,q31,translations),null);
  }
});
