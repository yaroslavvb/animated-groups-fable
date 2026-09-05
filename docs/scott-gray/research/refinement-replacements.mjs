/** Pure bookkeeping for already-admitted fields; this module does no admission.
 * One branch at fixed physical parameters contributes one current grid version.
 */
const assert=(condition,message)=>{if(!condition)throw Error(message);};
export const physicalKey=c=>JSON.stringify([c.groupId,c.params.F,c.params.k,c.params.Du,c.params.Dv,c.L??c.N*c.params.dx,c.params.stencil??'five-point']);

export function planRefinementReplacement({manifest,metadata,groupId,destinationUrl,previousByUrl}){
  assert(metadata.config.groupId===groupId,'Proposal and metadata groups disagree.');
  const urls=new Set(),superseded=[];
  for(const old of manifest.orbits){
    assert(!urls.has(old.url),'A source manifest must not contain duplicate URLs.');urls.add(old.url);
    if(old.groupId!==groupId&&old.url!==destinationUrl)continue;
    const previous=previousByUrl.get(old.url);
    assert(previous,'Previous metadata is required for replacement bookkeeping.');
    assert(previous.config.groupId===old.groupId,'Previous manifest and metadata groups disagree.');
    const sameBranch=previous.provenance?.branchId===metadata.provenance?.branchId;
    const samePhysical=physicalKey(previous.config)===physicalKey(metadata.config);
    if(old.url===destinationUrl){
      // A re-audited export can update in place, but cannot silently repurpose
      // another pattern's URL or overwrite a fine-grid field with a coarse one.
      assert(old.groupId===groupId&&sameBranch&&samePhysical&&previous.config.N===metadata.config.N,
        'An existing orbit URL belongs to another branch, physical setting or spatial grid; use a distinct export name.');
      continue;
    }
    if(!metadata.provenance?.branchId||!sameBranch||!samePhysical)continue;
    assert(previous.config.N<metadata.config.N,
      `Branch ${metadata.provenance.branchId} already has an equal or finer spatial grid; do not count its alternate export twice.`);
    superseded.push(old);
  }
  return superseded;
}

export function replaceManifestEntry(manifest,entry,superseded){
  const next=structuredClone(manifest),removed=new Set(superseded.map(old=>old.url));
  assert(!removed.has(entry.url),'A refinement cannot archive its own destination URL.');
  next.orbits=next.orbits.filter(old=>!removed.has(old.url));
  for(const old of superseded){
    (next.refinementReplacements??=[]).push({...old,replacedBy:entry.url,
      reason:'Finer spatial correction of the same branch at identical physical parameters; one gallery choice only.'});
  }
  const index=next.orbits.findIndex(old=>old.url===entry.url);
  if(index<0)next.orbits.push(entry);else next.orbits[index]=entry;
  // If an archived URL has now passed fresh admission, it is current once.
  if(next.excludedFromGallery)next.excludedFromGallery=next.excludedFromGallery.filter(old=>old.url!==entry.url);
  return next;
}
