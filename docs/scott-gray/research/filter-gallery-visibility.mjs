/** Remove visually ambiguous examples from selection while retaining research data.
 * Recomputes the policy on exact hash-checked bytes; never changes a field.
 * Run after admissions and before both catalog builders. No browser computation.
 */
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {basename} from 'node:path';
import {decodeField} from './build-catalog.mjs';
import {auditVisibleTimeSymmetry,VISIBILITY_VERSION} from '../visible-time-symmetry.mjs';
const ROOT=new URL('../',import.meta.url);
for(const [family,path,manifestName] of [['p4','./','verified-orbits.json'],['p6','p6/','candidate-orbits.json']]){
 const site=new URL(path,ROOT),url=new URL(`data/${manifestName}`,site),manifest=JSON.parse(await readFile(url));
 const catalog=JSON.parse(await readFile(new URL('data/precomputed-atlas.json',site))),kept=[],excluded=manifest.excludedFromGallery??[];
 for(const source of manifest.orbits){
  const metaUrl=new URL(source.url,site),meta=JSON.parse(await readFile(metaUrl)),bytes=await readFile(new URL(meta.fieldUrl,metaUrl)),field=decodeField(meta,bytes);
  const previous=catalog.orbits.find(e=>e.fieldSha256===meta.fieldSha256&&e.groupId===source.groupId);
  const noiseRms=meta.diversityAdmission?.phaseUncertaintyRms??previous?.diagnostics.phaseUncertaintyRms??0;
  meta.visibleTimeSymmetry=auditVisibleTimeSymmetry({field,...meta.config,noiseRms});
  await writeFile(metaUrl,JSON.stringify(meta,null,2)+'\n');
  if(meta.visibleTimeSymmetry.passed)kept.push(source);
  else{
   const entry={...source,visibilityPolicyVersion:VISIBILITY_VERSION,reason:meta.visibleTimeSymmetry.reasons.join(' ')};
   const index=excluded.findIndex(e=>e.url===entry.url);if(index<0)excluded.push(entry);else excluded[index]=entry;
   // Only thumbnails belonging to this excluded record are removed.
   for(const palette of ['ember','ceramic','concentration']){
    try{await unlink(new URL(`data/thumbnails/${basename(metaUrl.pathname,'.json')}-${palette}.png`,site));}catch(error){if(error.code!=='ENOENT')throw error;}
   }
   console.log(`${family}: excluded ${source.url}: ${entry.reason}`);
  }
 }
 manifest.orbits=kept;manifest.excludedFromGallery=excluded;manifest.visibilityPolicyVersion=VISIBILITY_VERSION;
 await writeFile(url,JSON.stringify(manifest,null,2)+'\n');console.log(`${family}: ${kept.length} selectable records; ${excluded.length} archived exclusions.`);
}
