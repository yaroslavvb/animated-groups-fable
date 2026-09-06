/** Check the original JavaScript-serialized source certificates before reuse. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
let checked=0;
for(const path of ['data/precomputed-atlas.json','p6/data/precomputed-atlas.json']){
 const {orbits}=JSON.parse(await readFile(new URL(path,root),'utf8'));
 for(const record of orbits){
  const c=record.offlineVerification,d=record.diagnostics;
  const hash=createHash('sha256').update(JSON.stringify(record.config)).digest('hex');
  if(c?.passed!==true||c.fieldSha256!==record.fieldSha256||c.configSha256!==hash||d?.validated!==true||d.atlasVerification!==c.gateVersion||d.refinedClosure?.computed!==true||!['candidatePhase','independentPhase','refinedPhase'].every(key=>d[key]?.passed===true))throw new Error(`Source certificate mismatch: ${record.id}`);
  checked++;
 }
}
console.log(JSON.stringify({checked,passed:true}));
