/** Only use spatial-period evidence for the exact, already admitted field. */
export function overlayTranslations(index, record) {
  if(index?.schema!=='overlay-translations-v1'||!record)return [];
  const evidence=index.orbits?.[record.id];
  if(!evidence||evidence.fieldSha256!==record.fieldSha256||evidence.N!==record.config.N)return [];
  return evidence.translations.filter(t=>Array.isArray(t.v)&&t.v.length===2&&t.v.every(Number.isFinite)
    &&Number.isFinite(t.max)&&t.max<=1e-7&&Number.isFinite(t.relativeRms)&&t.relativeRms<=1e-6);
}

export function populateGeneratorChoices(select, named, centres, selected) {
  select.replaceChildren();
  for(const g of named){const option=document.createElement('option');option.value=g.name;option.textContent=`${g.name} · +${g.timeShift} T`;select.append(option);}
  const g=centres.find(g=>g.key===selected);
  if(g){const option=document.createElement('option');option.value=g.key;option.textContent=(g.approximate?'Approximate · ':'')+`${g.name} · (${g.centre.map(x=>Number(x.toFixed(4))).join(', ')}) · +${g.timeShift} T`;select.append(option);}
  select.value=g?g.key:selected;
}

export function overlayCaption(centres, translations, {cellView=null, approximate=false, displayed=centres, inspect=false}={}) {
  if(cellView){
    const count=(approximate?displayed:centres).length/cellView.cell.index;
    if(approximate&&!inspect)return 'The outlined cell follows the approximate repeat. Only verified centres are shown; enable approximate centres to see the smaller cell’s full marker pattern.';
    return `${count} ${approximate?'rotation-centre positions per approximate':'verified rotation centres per'} pattern cell. Boundary centres are shared with neighbouring cells. ${approximate?'Dashed markers are approximate; solid markers remain verified. ':''}Select a marker to compare its rotation with its time shift.`;
  }
  return `${centres.length} rotation centres per simulation cell. ${translations.length>1?'Includes additional centres from this pattern’s checked spatial repeats. ':''}Select a marker to compare its rotation with its time shift.`;
}
