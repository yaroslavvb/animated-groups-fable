import {VISIBILITY_VERSION} from './visible-time-symmetry.mjs?v=20260905-wallpaper';
import {readViewState,writeViewHash} from './view-state.mjs?v=20260905-wallpaper';
import {makePreview,mod,DESCRIPTIONS} from './seeds.mjs';
import {createStepper,projectKernel,mapIndex} from './dynamics.mjs?v=20260905-wallpaper';
import {createWebGLGrayScott} from './webgl.mjs?v=20260905-wallpaper';
import {GROUP_DISPLAY,renderGeneratorOverlay,generatorDescription} from './overlay.mjs?v=20260905-wallpaper';
import {rotationCentres} from './rotation-centres.mjs?v=20260905-wallpaper';
import {overlayTranslations,populateGeneratorChoices,overlayCaption} from './overlay-data.mjs?v=20260905-wallpaper';
import {overlayNearEvidence,withApproximateCentres,approximateCaption} from './overlay-near-data.mjs';
import {updateCellFraming} from './cell-ui.mjs?v=20260905-gallery-fix';
import {PROFILES,makeInitial} from './exploration.mjs';
import {analyticExclusion} from './feasibility.mjs';
import {createPrecomputedCatalog} from './precomputed-catalog.mjs?v=20260905-gallery-fix';
import {renderField,clearCanvas,valueAt,fmt} from './render.mjs?v=20260905-wallpaper';

const $=id=>document.getElementById(id);
const tick=()=>new Promise(requestAnimationFrame);
let groups=[],group,saved,atlas=null,record=null,worker=null,abort=null,job=0,busy=false,displayEngine=null;
let selectionToken=0,selectedPatternId=null;
const recordNames=new Map(),recordDescriptions=new Map();
const rememberedGenerators=new Map();
const rememberedSelections=new Map(),thumbnailCache=new Map(),rangeCache=new Map();
let translationIndex=null,nearTranslationIndex=null,centres=[],strictCentres=[],cellView=null;
const centreCache=new Map();
let settingsRevision=0;
let selectedParameterKey=null;
let playing=false,phase=0,lastTime=0,selectedGenerator='α',attempts=[],displayRanges=null;
// Loading a field temporarily pauses the renderer, not the requested shared view.
let pendingPlayback={phase:0,play:true};
const main=$('pattern'),map=$('parameter-map');
const numeric=['feed','kill','length','period','du','dv','iterations'];
const range=()=>$('palette').value==='concentration'?displayRanges?.v:displayRanges?.u;
const setStatus=text=>{$('status').textContent=text;};

// This gallery only exposes offline-admitted records with saved visibility evidence.
const summaries=id=>saved?.summaries(id)??[];
const summaryById=id=>saved?.get(id)??summaries(group.id).find(r=>r.id===id);
const verifiedRecord=r=>!!r&&saved?.isVerified(r,group.id);
const referenceGroup=()=>group.render.ops.every(op=>mod(op.tau)===0);
function inverseForRendering(op){const [[a,b],[c,d]]=op.M,det=a*d-b*c,M=[[d/det,-b/det],[-c/det,a/det]];return {M,v:M.map(row=>-row[0]*op.v[0]-row[1]*op.v[1]),tau:-op.tau};}
function chooseGenerator(name){if(!group||!GROUP_DISPLAY[group.id].namedGenerators.some(g=>g.name===name)&&!centres.some(g=>g.key===name)&&!strictCentres.some(g=>g.key===name))return;selectedGenerator=name;rememberedGenerators.set(group.id,name);overlay();syncViewUrl();}
function syncViewUrl(){
  if(!group)return;
  const hash=writeViewHash({groupId:group.id,patternId:selectedPatternId,palette:$('palette').value,tiles:+$('tiles').value,framing:$('framing').value,speed:+$('speed').value,generator:selectedGenerator,overlay:$('show-generators').checked,approximate:$('show-approximate').checked,phase:record?phase:pendingPlayback.phase,play:record?playing:pendingPlayback.play});
  if(location.hash!==hash)history.replaceState(null,'',hash);
}
function restoreView(defaultGroup){
  const view=readViewState(location.hash);
  $('palette').value=view.palette;$('tiles').value=view.tiles;$('speed').value=view.speed;$('show-generators').checked=view.overlay;
  $('framing').value=view.framing;$('show-approximate').checked=view.approximate;
  chooseGroup(groups.some(g=>g.id===view.groupId)?view.groupId:defaultGroup,{view});
}
function togglePlayback(){if(!record)return;setPlaying(!playing);if(!playing)draw(true);syncViewUrl();}

function fieldRanges(r){if(r.ranges)return r.ranges;if(rangeCache.has(r.id))return rangeCache.get(r.id);const ranges=[[Infinity,-Infinity],[Infinity,-Infinity]],S=r.config.N*r.config.N;for(let t=0;t<r.config.M;t++)for(let c=0;c<2;c++)for(let i=0;i<S;i++){const v=r.field[t*2*S+c*S+i];ranges[c][0]=Math.min(ranges[c][0],v);ranges[c][1]=Math.max(ranges[c][1],v);}const result={u:ranges[0],v:ranges[1]};rangeCache.set(r.id,result);return result;}
const parameterKey=c=>JSON.stringify([c.groupId,c.params.F,c.params.k,c.params.Du,c.params.Dv,c.L??c.N*c.params.dx,c.params.stencil??'five-point']);
const number=value=>Number(value.toPrecision(11)).toString();
// Presentation order: new mixtures first; this is not a scientific ranking.
function patternOrder(a,b){
  const label=r=>r.patternName??recordNames.get(r.id)??r.name??r.id;
  const priority=r=>!r.id.includes('-diversity-')?2:/woven|mixed|distorted/i.test(label(r)+' '+r.id)?0:1;
  const first=priority(a),second=priority(b);
  const contrast=r=>r.visibleTimeSymmetry?.minimumRelativeColorRange??0;
  return first-second||(first===0?contrast(b)-contrast(a):0)||label(a).localeCompare(label(b))||a.id.localeCompare(b.id);
}
function parameterSets(){if(!group)return[];const sets=new Map();for(const r of summaries(group.id)){const key=parameterKey(r.config);if(!sets.has(key))sets.set(key,{key,config:r.config,patterns:[]});sets.get(key).patterns.push(r);}for(const set of sets.values())set.patterns.sort(patternOrder);return [...sets.values()].sort((a,b)=>b.patterns.length-a.patterns.length||a.config.params.F-b.config.params.F||a.config.params.k-b.config.params.k);}
function physicalLabel(c){const p=c.params;return `F ${number(p.F)} · k ${number(p.k)} · Dᵤ ${number(p.Du)} · Dᵥ ${number(p.Dv)} · L ${number(c.L??c.N*p.dx)} · ${p.stencil==='bulatov9'?'Bulatov 9-point':'5-point'}`;}
function config(){
  const N=+$('resolution').value,L=+$('length').value;
  return {N,M:+$('frames').value,L,period:+$('period').value,groupId:group.id,ops:group.render.ops,seed:$('seed').value,
    params:{F:+$('feed').value,k:+$('kill').value,Du:+$('du').value,Dv:+$('dv').value,dx:L/N,stencil:$('stencil').value,dt:.4},
    minTemporal:.008,minSpatial:.012};
}
function setControls(c){
  for(const [id,key] of [['feed','F'],['kill','k'],['du','Du'],['dv','Dv']])$(id).value=c.params[key];
  $('length').value=c.L??c.params.dx*c.N;$('period').value=c.period;$('stencil').value=c.params.stencil??'five-point';
  for(const [id,value] of [['resolution',c.N],['frames',c.M]]){
    if(![...$(id).options].some(o=>+o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=id==='resolution'?`${value} × ${value}`:`${value}`;$(id).append(o);}
    $(id).value=value;
  }
  $('preset').value='custom';
}
function valid(){return numeric.every(id=>$(id).reportValidity());}
function setPlaying(value){playing=!!record&&value;$('play').textContent=playing?'Ⅱ Pause':'▶ Play';$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');}
function controls(){
  $('search-settings').disabled=true;$('preset').disabled=true;$('search').disabled=true;$('scan').disabled=true;$('stop').disabled=true;
  for(const id of ['play','rewind','phase','export'])$(id).disabled=!record;
  $('solution').disabled=busy||!group||!summaries(group.id).length;$('parameter-set').disabled=busy||!group||!summaries(group.id).length;
  for(const button of $('pattern-thumbnails').children)button.disabled=busy;
  $('continue-seed').disabled=!record;
}
function cancel(message){
  job++;selectionToken++;abort?.abort();abort=null;
  if(worker){worker.terminate();worker=null;}
  busy=false;$('progress').hidden=true;if(group&&saved)populateAtlas();controls();if(message)setStatus(message);
}
function named(){return centres.find(g=>g.key===selectedGenerator)??strictCentres.find(g=>g.key===selectedGenerator)??GROUP_DISPLAY[group.id].namedGenerators.find(g=>g.name===selectedGenerator)??GROUP_DISPLAY[group.id].namedGenerators[0];}
function overlay(){
  if(!group)return;
  document.querySelector('.phase-rule').hidden=!$('show-generators').checked;
  const summary=record?.id===selectedPatternId&&record?.config.groupId===group.id?record:summaryById(selectedPatternId),translations=overlayTranslations(translationIndex,summary),cacheKey=group.id+':'+(summary?.id??'base');
  if(!centreCache.has(cacheKey))centreCache.set(cacheKey,rotationCentres({namedGenerators:GROUP_DISPLAY[group.id].namedGenerators,ops:group.render.ops,family:'p4',translations}));
  const exactCentres=centreCache.get(cacheKey),near=overlayNearEvidence(nearTranslationIndex,summary,translations);
  strictCentres=exactCentres;
  cellView=updateCellFraming({family:'p4',translations,near,count:+$('tiles').value,framing:$('framing').value});
  $('approximate-controls').hidden=!near;
  const inspectApproximate=!!near&&$('show-approximate').checked;
  if(inspectApproximate&&!centreCache.has(cacheKey+':near'))centreCache.set(cacheKey+':near',withApproximateCentres({...group,namedGenerators:GROUP_DISPLAY[group.id].namedGenerators},exactCentres,near));
  centres=inspectApproximate?centreCache.get(cacheKey+':near'):exactCentres;
  $('approximate-explanation').textContent=near?approximateCaption(near,inspectApproximate):'';
  $('approximate-view-label').hidden=!inspectApproximate||!$('show-generators').checked;
  if(!centres.some(g=>g.key===selectedGenerator)&&!exactCentres.some(g=>g.key===selectedGenerator)&&!GROUP_DISPLAY[group.id].namedGenerators.some(g=>g.name===selectedGenerator))selectedGenerator=selectedGenerator?.split('@')[0]??'α';
  populateGeneratorChoices($('operation'),GROUP_DISPLAY[group.id].namedGenerators,[...centres,...exactCentres],selectedGenerator);
  $('generator-overlay').toggleAttribute('hidden',!$('show-generators').checked);
  const tiles=+$('tiles').value,glyphScale=cellView?1.3/tiles:Math.max(.2,Math.min(1,2/tiles*Math.sqrt(4/centres.length)));
  renderGeneratorOverlay($('generator-overlay'),{groupId:group.id,tiles,centres,glyphScale,cellView,selected:selectedGenerator,onSelect:g=>chooseGenerator(g.key)});
  $('overlay-explanation').textContent=overlayCaption(exactCentres,translations,{cellView,approximate:!!near,displayed:centres,inspect:inspectApproximate});
  const g=named();$('generator-description').textContent=(g.approximate?'Approximate · ':'')+generatorDescription(g)+(selectedGenerator.includes('@')?` · centre (${g.centre.map(x=>Number(x.toFixed(4))).join(', ')})`:'')+(g.verifiedLowerOrder?` · verified ${g.verifiedLowerOrder.order}-fold centre here`:'');


}
function colorScale(){const r=range();$('color-scale').textContent=r?`Fixed scale over the entire orbit: ${$('palette').value==='concentration'?'V':'U'} = ${r[0].toFixed(4)} … ${r[1].toFixed(4)}.`:'The concentration scale will be fixed across all phases of a verified orbit.';}
function metrics(d){
  $('pde').textContent=d?`${(100*d.relativePde).toFixed(2)}%`:'—';
  const phaseErrors=d?.refinedPhase?.operations.map(o=>o.shiftedRms);
  $('symmetry').textContent=fmt(phaseErrors?.length?Math.max(...phaseErrors):undefined);
  $('motion').textContent=fmt(d?.temporalRms);$('return').textContent=fmt(d?.refinedClosure?.closureRms);
}

function useCpuPlayback(){
  displayEngine?.dispose();displayEngine=null;$('gpu-pattern').hidden=true;main.hidden=false;$('engine-label').textContent='CPU playback';
}
function draw(forceComparison=true){
  if(record){
    const options={tiles:+$('tiles').value,palette:$('palette').value,range:range(),...cellView?.viewOptions};
    if(displayEngine){
      try{
        const c=record.config,stride=2*c.N*c.N,ft=phase*c.M,t=Math.floor(ft),a=ft-t,current=new Float32Array(stride);
        for(let i=0;i<stride;i++)current[i]=(1-a)*record.field[t*stride+i]+a*record.field[mod(t+1,c.M)*stride+i];
        displayEngine.upload(current);displayEngine.render({width:768,height:768,...options});
      }catch{useCpuPlayback();} // Context loss can precede its browser event.
    }
    if(!displayEngine)renderField(main,record.field,record.config.N,record.config.M,phase,options);
    $('phase').value=phase;$('phase-label').textContent=`${phase.toFixed(3)} T`;
  }
  else{clearCanvas(main);$('phase-label').textContent='—';}
}
function animate(now){
  if(playing&&record){phase=mod(phase+Math.max(0,Math.min(now-lastTime,100))/8000*+$('speed').value);draw(false);}
  lastTime=now;requestAnimationFrame(animate);
}
function updateGroupCounts(){
  for(const b of $('groups').children){const count=summaries(b.dataset.id).length;b.querySelector('.orbit-count').textContent=`${count} pattern${count===1?'':'s'}`;const assessment=$('feasibility-'+b.dataset.id);if(assessment)assessment.textContent=count?'Precomputed verified example':'Compatible; existence unresolved';}
}
function populateAtlas(){
  updateGroupCounts();
  const sets=parameterSets(),total=sets.reduce((sum,set)=>sum+set.patterns.length,0);
  $('solution-count').textContent=`${sets.length} verified parameter set${sets.length===1?'':'s'} · ${total} pattern${total===1?'':'s'}`;
  if(!sets.some(set=>set.key===selectedParameterKey))selectedParameterKey=sets[0]?.key??null;
  $('parameter-set').replaceChildren();
  for(const set of sets){const option=document.createElement('option');option.value=set.key;option.textContent=`${set.patterns.length} pattern${set.patterns.length===1?'':'s'} · F ${number(set.config.params.F)} · k ${number(set.config.params.k)}`;for(const [label,get] of [['Dᵤ',c=>c.params.Du],['Dᵥ',c=>c.params.Dv],['L',c=>c.L],['stencil',c=>c.params.stencil]])if(new Set(sets.map(s=>get(s.config))).size>1)option.textContent+=` · ${label} ${get(set.config)}`;$('parameter-set').append(option);}
  if(!sets.length){const option=document.createElement('option');option.value='';option.textContent='No verified parameters';$('parameter-set').append(option);}
  $('parameter-set').value=selectedParameterKey??'';
  populatePatterns(sets.find(set=>set.key===selectedParameterKey));
  $('map-status').textContent=sets.length?'Select a point to load its physical parameters, then choose a pattern.':'No eligible point to snap to. Existence remains unresolved.';
  map.setAttribute('aria-disabled',String(!sets.length));controls();drawMap();
}
function populatePatterns(set){
  const patterns=set?.patterns??[];$('solution').replaceChildren();$('pattern-thumbnails').replaceChildren();
  $('parameter-values').textContent=set?physicalLabel(set.config):'Choose a precomputed parameter set.';
  $('pattern-count').textContent=patterns.length===1?'1 verified pattern is known at this parameter set.':`${patterns.length} verified patterns at this parameter set.`;
  const palette=$('palette').value;
  for(let i=0;i<patterns.length;i++){
    const summary=patterns[i],label=`${recordNames.get(summary.id)??('Pattern '+(i+1))} · T ${summary.config.period.toFixed(2)} · ${summary.config.N}²`,option=document.createElement('option');
    option.value=summary.id;option.textContent=label;$('solution').append(option);
    const key=summary.id+':'+palette;
    if(summary.thumbnails){thumbnailCache.set(key,summary.thumbnails[palette]);}
    else if(!thumbnailCache.has(key)){
      const r=record?.id===summary.id?record:atlas.get(summary.id),canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
      const ranges=fieldRanges(r);renderField(canvas,r.field,r.config.N,r.config.M,0,{tiles:2,palette,range:palette==='concentration'?ranges.v:ranges.u});thumbnailCache.set(key,canvas.toDataURL());
    }
    const button=document.createElement('button');button.type='button';button.className='pattern-thumb';button.setAttribute('aria-pressed',String(selectedPatternId===summary.id));button.setAttribute('aria-label','Select '+label);
    const image=document.createElement('img');image.src=thumbnailCache.get(key);image.alt='Verified concentration field at phase zero';image.decoding='async';image.loading='lazy';image.width=160;image.height=160;
    const text=document.createElement('span');text.textContent=label;button.append(image,text);button.onclick=()=>selectPattern(summary.id);$('pattern-thumbnails').append(button);
  }
  if(!patterns.length){const option=document.createElement('option');option.textContent='No verified patterns';option.value='';$('solution').append(option);}
  if(patterns.some(r=>r.id===selectedPatternId))$('solution').value=selectedPatternId;
}
function selectParameters(key){
  const set=parameterSets().find(set=>set.key===key);if(!set||busy)return;
  selectedParameterKey=key;openPattern(set.patterns[0].id);
}
function selectPattern(id){
  if(busy)return;const summary=summaries(group.id).find(r=>r.id===id);
  if(summary&&parameterKey(summary.config)===selectedParameterKey){openPattern(id);if(matchMedia('(max-width:720px)').matches)document.querySelector('.viewer').scrollIntoView({behavior:'smooth',block:'start'});}
}
async function openPattern(id,{updateSearch=true,playback={phase:0,play:true}}={}){
  const summary=summaryById(id);if(!summary||summary.config.groupId!==group.id)return;
  const token=++selectionToken,targetGroup=group.id,revision=settingsRevision;
  selectedPatternId=id;selectedParameterKey=parameterKey(summary.config);
  pendingPlayback={...playback};
  rememberedSelections.set(targetGroup,{key:selectedParameterKey,id});
  emptyViewer({loading:true});populateAtlas();syncViewUrl();setStatus('Loading the selected precomputed animation…');
  try{
    overlay();
    const loaded=await saved.load(id);
    if(token!==selectionToken||group.id!==targetGroup)return;
    selectRecord(loaded,{updateSearch:updateSearch&&settingsRevision===revision,playback:pendingPlayback});setStatus(saved.isVerified(loaded)?'Precomputed animation ready. Parameters and orbit verification were calculated offline.':'Verified animation ready.');
  }catch(error){
    if(token!==selectionToken||group.id!==targetGroup)return;
    emptyViewer({error:error.message});setStatus('Could not load this saved animation: '+error.message);
  }
}
function selectRecord(r,{updateSearch=true,playback={phase:0,play:true}}={}){
  if(!verifiedRecord(r))throw Error('The saved orbit does not belong to this verified catalog.');
  selectedPatternId=r.id;
  selectedParameterKey=parameterKey(r.config);rememberedSelections.set(group.id,{key:selectedParameterKey,id:r.id});
  displayEngine?.dispose();displayEngine=null;record=r;displayRanges=fieldRanges(r);phase=playback.phase;lastTime=performance.now();setPlaying(playback.play);
  try{displayEngine=createWebGLGrayScott({canvas:$('gpu-pattern'),N:r.config.N,initial:Float64Array.from(r.field.slice(0,2*r.config.N*r.config.N)),params:r.config.params,onContextLost:()=>{useCpuPlayback();draw();}});}catch{}
  $('gpu-pattern').hidden=!displayEngine;main.hidden=!!displayEngine;if(updateSearch){setControls(r.config);$('seed').value='continue';}
  $('solution').value=r.id;$('empty-state').hidden=true;$('mode-label').textContent=referenceGroup()?'Spatial reference · zero time offset':'Verified visible time symmetry';
  $('engine-label').textContent=`${displayEngine?'WebGL playback':'CPU playback'} · ${r.config.N}² × ${r.config.M} · T ${r.config.period.toFixed(2)}`;
  $('caption').textContent=recordDescriptions.get(r.id)||'This numerical orbit passed independent forward evolution, phase and refinement checks before publication.';

  overlay();metrics(r.diagnostics);colorScale();populateAtlas();controls();draw();
}
function emptyViewer({loading=false,error=null}={}){
  displayEngine?.dispose();displayEngine=null;$('gpu-pattern').hidden=true;main.hidden=false;record=null;displayRanges=null;setPlaying(false);phase=0;if($('seed').value==='continue')$('seed').value='skate';$('empty-state').hidden=false;$('mode-label').textContent=loading?'Loading saved animation':error?'Animation unavailable':'No verified solution';$('engine-label').textContent=loading?'Precomputed data':error?'Download failed':'Existence unresolved';
  $('empty-state').querySelector('h2').textContent=loading?'Loading saved animation…':error?'Animation unavailable':'No verified solution for this group';
  $('empty-description').textContent=loading?'Downloading the saved animation.':error?error:'Existence is unresolved. An unsuccessful search is not a proof of impossibility.';
  $('retry-animation').hidden=!error;
  $('focus-search').hidden=true;
  $('caption').textContent=loading?'Loading the saved concentration field; no numerical search runs during browsing.':'The markers describe the requested rotation and phase shift.';
  metrics(null);colorScale();draw();controls();
}
function chooseGroup(id,{view=null}={}){
  cancel();group=groups.find(g=>g.id===id)||groups[0];
  // A shared link takes precedence over this tab's remembered selections.
  const remembered=view?null:rememberedSelections.get(group.id);
  const requested=summaries(group.id).find(r=>r.id===(view?.patternId??remembered?.id));
  selectedPatternId=requested?.id??null;selectedParameterKey=requested?parameterKey(requested.config):null;
  for(const b of $('groups').children)b.setAttribute('aria-pressed',b.dataset.id===group.id);
  const d=GROUP_DISPLAY[group.id];$('selected-id').textContent=group.id+(referenceGroup()?' / SPATIAL REFERENCE':' / TIME-SHIFT SYMMETRY');$('policy-label').textContent=referenceGroup()?'Spatial reference · all offsets zero':'Visible time-symmetric solutions';$('selected-title').innerHTML=d.shortHTML;$('group-label').textContent=group.id+' · '+d.shortText;
  const phases=d.namedGenerators.map(g=>`${g.name}: ${g.timeShift}T`).join(' · ');
  $('selected-description').textContent=phases+(referenceGroup()?'. Every generator is a spatial symmetry at each time.':'. These phase shifts act on both chemical concentrations.');

  $('operation').replaceChildren();for(const g of d.namedGenerators){const o=document.createElement('option');o.value=g.name;o.textContent=`${g.name} · +${g.timeShift} T`;$('operation').append(o);}
  const requestedGenerator=view?view.generator:rememberedGenerators.get(group.id);
  selectedGenerator=requestedGenerator??d.namedGenerators.find(g=>mod(g.tau)!==0&&g.angleDegrees%360!==0)?.name??d.namedGenerators[0].name;
  rememberedGenerators.set(group.id,selectedGenerator);$('operation').value=selectedGenerator;populateAtlas();
  const first=requested??parameterSets()[0]?.patterns[0];
  renderAttempts();if(first)openPattern(first.id,{playback:view?{phase:view.phase,play:view.play}:{phase:0,play:true}});else{pendingPlayback={phase:0,play:true};emptyViewer();overlay();syncViewUrl();setStatus('No precomputed orbit is available for this group.');}
}
function mapBounds(){
  const records=summaries(group.id),bounds={};
  for(const [axis,limit,minSpan] of [['F',.2,.00002],['k',.08,.00002]]){
    const values=records.map(r=>r.config.params[axis]);
    if(!values.length){bounds[axis]=[0,limit];continue;}
    const low=Math.min(...values),high=Math.max(...values),padding=Math.max(minSpan,(high-low)*.2);
    bounds[axis]=[Math.max(0,low-padding),Math.min(limit,high+padding)];
  }
  return bounds;
}
function drawMap(){
  if(!group||!saved)return;
  const c=map.getContext('2d'),w=map.width,h=map.height,left=80,right=20,top=20,bottom=40,pw=w-left-right,ph=h-top-bottom;
  c.fillStyle='#fff';c.fillRect(0,0,w,h);c.font='20px sans-serif';c.lineWidth=1;
  const bounds=mapBounds(),spanF=bounds.F[1]-bounds.F[0],spanK=bounds.k[1]-bounds.k[0];
  c.font='15px sans-serif';
  for(let i=0;i<=4;i++){const x=left+pw*i/4,y=top+ph*(1-i/4);c.strokeStyle='#ece9f0';c.beginPath();c.moveTo(x,top);c.lineTo(x,h-bottom);c.moveTo(left,y);c.lineTo(w-right,y);c.stroke();c.fillStyle='#807887';c.textAlign=i===4?'right':i===0?'left':'center';c.fillText((bounds.F[0]+spanF*i/4).toFixed(spanF<.001?6:4),x,h-10);c.textAlign='right';c.fillText((bounds.k[0]+spanK*i/4).toFixed(spanK<.001?5:3),left-7,y+6);}
  const sets=parameterSets();
  for(const set of sets){const p=set.config.params,x=left+(p.F-bounds.F[0])/spanF*pw,y=top+(1-(p.k-bounds.k[0])/spanK)*ph;c.fillStyle='#5842ad';c.beginPath();c.arc(x,y,7,0,2*Math.PI);c.fill();if(set.key===selectedParameterKey){c.strokeStyle='#5842ad';c.lineWidth=3;c.beginPath();c.arc(x,y,13,0,2*Math.PI);c.stroke();}}
  if(!sets.length){c.fillStyle='#898091';c.textAlign='center';c.font='23px sans-serif';c.fillText('No verified points for '+group.id,left+pw/2,top+ph/2);}
}
function snap(F,k){
  if(busy)return;
  const bounds=mapBounds(),spanF=bounds.F[1]-bounds.F[0],spanK=bounds.k[1]-bounds.k[0];
  const r=summaries(group.id).reduce((best,next)=>{const distance=p=>((p.F-F)/spanF)**2+((p.k-k)/spanK)**2;return !best||distance(next.config.params)<distance(best.config.params)?next:best;},null);
  if(!r){$('map-status').textContent='No verified time-symmetric solution exists in this atlas for the selected group. There is nothing to snap to.';return;}
  selectParameters(parameterKey(r.config));$('map-status').textContent=`Selected verified parameters: F ${number(r.config.params.F)}, k ${number(r.config.params.k)}. Pattern choices below use these same physical parameters.`;
}
function renderAttempts(){
  $('search-results').replaceChildren();
  for(const a of attempts.filter(a=>a.groupId===group.id).slice(-12).reverse()){
    const row=document.createElement('div');row.className='trial-result'+(a.accepted?' accepted':'');
    const heading=document.createElement('strong');heading.textContent=`F ${a.F.toFixed(6)} · k ${a.k.toFixed(6)} · ${a.accepted?'VERIFIED':a.excluded?'ANALYTICALLY EXCLUDED':'UNRESOLVED'}`;
    const reason=document.createElement('p');reason.textContent=a.accepted?'All acceptance checks passed; added to the atlas.':a.reasons.join(' ');
    row.append(heading,reason);if(a.excluded){const link=document.createElement('a');link.href='ANALYTIC-EXCLUSIONS.md';link.textContent='Proof and assumptions →';row.append(link);}$('search-results').append(row);
  }
}
function setPreset(id){
  settingsRevision++;
  const p=PROFILES.find(p=>p.id===id);if(!p)return;
  for(const [id,key] of [['feed','F'],['kill','k'],['du','Du'],['dv','Dv']])$(id).value=p[key];
  $('stencil').value=p.stencil;setStatus('Starting parameters updated. They do not qualify as a solution until the full time-symmetry search passes.');
}
async function initialMovie(c,token){
  if(c.seed==='continue'){if(!record||record.config.groupId!==c.groupId)throw Error('Select a verified orbit of this group to continue it.');const old=record.config,out=new Float64Array(2*c.N*c.N*c.M);for(let t=0;t<c.M;t++)for(let ch=0;ch<2;ch++)for(let y=0;y<c.N;y++)for(let x=0;x<c.N;x++)out[t*2*c.N*c.N+ch*c.N*c.N+y*c.N+x]=valueAt(record.field,ch,x*old.N/c.N,y*old.N/c.N,t/c.M,old.N,old.M);return out;}
  if(c.seed!=='chemical')return makePreview({...c,F:c.params.F,k:c.params.k});
  const initial=makeInitial({...c.params,seed:'skate'},{N:c.N,L:c.L,ops:c.ops}),canvas=document.createElement('canvas');
  let engine,time=0;
  try{engine=createWebGLGrayScott({canvas,N:c.N,initial:projectKernel(initial,c.N,c.ops),params:c.params});}
  catch{const stepper=createStepper(projectKernel(initial,c.N,c.ops),c.N,c.params);engine={backend:'CPU midpoint',maxDt:stepper.maxDt,advance(t){stepper.advance(t);time+=t;},readback(){return stepper.state.slice();},dispose(){}};}
  const stride=2*c.N*c.N,field=new Float64Array(stride*c.M);
  try{
    field.set(engine.readback());
    for(let t=1;t<c.M;t++){
      let remaining=c.period/c.M;
      while(remaining>1e-9){if(token!==job)throw new DOMException('Cancelled','AbortError');const duration=Math.min(remaining,32*engine.maxDt);engine.advance(duration);remaining-=duration;await tick();}
      if(token!==job)throw new DOMException('Cancelled','AbortError');field.set(engine.readback(),t*stride);
      setStatus(`${engine.backend}: generating an internal chemical initial guess ${t+1}/${c.M}. It is not displayed as a solution.`);
    }
  }finally{engine.dispose();}
  return field;
}
function optimize(c,field,iterations,token,label){
  return new Promise((resolve,reject)=>{
    const w=new Worker(new URL('./worker.js?v=20260905-wallpaper',import.meta.url),{type:'module'});worker=w;
    const onAbort=()=>{w.terminate();reject(new DOMException('Cancelled','AbortError'));};abort.signal.addEventListener('abort',onAbort,{once:true});
    const finish=()=>{abort?.signal.removeEventListener('abort',onAbort);w.terminate();if(worker===w)worker=null;};
    w.onerror=e=>{finish();reject(Error(e.message));};
    w.onmessage=({data})=>{
      if(token!==job){finish();reject(new DOMException('Cancelled','AbortError'));return;}
      if(data.type==='error'){finish();reject(Error(data.message));}
      else if(data.type==='progress'){$('progress').value=data.iteration/iterations;setStatus(`${label} · iteration ${data.iteration}/${iterations} · PDE RMS ${fmt(data.pdeRms)} · relative mismatch ${(100*data.relativePde).toFixed(1)}%. Candidate remains outside the viewer.`);}
      else if(data.type==='validating')setStatus(`${label} · checking independent periodic return…`);
      else if(data.type==='done'){finish();resolve(data);}
    };
    w.postMessage({mode:'solve',config:c,field,iterations});
  });
}
async function search(neighborhood=false){
  // Candidate search remains an offline research task; this page is a saved gallery.
  return;
  if(!group||!saved||busy||!valid())return;
  cancel();const token=job,startAttempt=attempts.length,base=config(),iterations=+$('iterations').value,points=[];
  if(neighborhood){for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)points.push({F:Math.max(0,Math.min(.2,base.params.F+x*.0015)),k:Math.max(0,Math.min(.08,base.params.k+y*.0005))});}
  else points.push({F:base.params.F,k:base.params.k});
  abort=new AbortController();busy=true;controls();$('progress').hidden=false;$('progress').value=0;
  try{
    if(!atlas){const {createSolutionAtlas}=await import('./solution-atlas.mjs?v=20260905-wallpaper');if(token!==job)return;atlas=createSolutionAtlas(groups);}
    for(let i=0;i<points.length;i++){
      if(token!==job)return;
      const c={...base,params:{...base.params,...points[i]}},label=`${base.groupId} trial ${i+1}/${points.length}`;
      const exclusion=analyticExclusion(c.params);
      if(exclusion){attempts.push({groupId:c.groupId,F:c.params.F,k:c.params.k,accepted:false,excluded:true,reasons:[exclusion.conclusion]});renderAttempts();continue;}
      setStatus(`${label} · constructing a full space–time initial guess…`);await tick();
      const field=await initialMovie(c,token);if(token!==job)return;
      const result=await optimize(c,field,iterations,token,label);if(token!==job)return;
      let admission={accepted:false,reasons:result.diagnostics.reasons};
      if(result.diagnostics.validated){
        setStatus(`${label} · recomputing all phase constraints on independent trajectories…`);
        admission=await atlas.admit({field:result.field,config:{...c,period:result.period}},{groupId:c.groupId,signal:abort.signal,onPhase:p=>setStatus(`${label} · ${typeof p==='string'?p:JSON.stringify(p)}`)});
      }
      if(token!==job)return;
      attempts.push({groupId:c.groupId,F:c.params.F,k:c.params.k,period:result.period,accepted:admission.accepted,reasons:admission.reasons??[],diagnostics:result.diagnostics});
      renderAttempts();populateAtlas();
      if(admission.accepted)selectRecord(admission.record??atlas.get(admission.id),{updateSearch:false});
    }
    const passed=attempts.slice(startAttempt).filter(a=>a.groupId===base.groupId&&a.accepted).length,excluded=points.every(p=>analyticExclusion({...base.params,...p}));
    setStatus(excluded?'These parameters are analytically excluded: at F = 0, nonnegative periodic solutions must be stationary. See the proof below.':passed?'Search complete. Accepted orbits are available in the atlas.':'Search complete: no verified solution found. These initial guesses failed; impossibility is not established.');
  }catch(e){if(e.name!=='AbortError'&&token===job)setStatus(`Search failed: ${e.message}. No new solution was admitted.`);}
  finally{if(token===job){busy=false;abort=null;$('progress').hidden=true;populateAtlas();if(!record){const first=summaries(group.id)[0];if(first)openPattern(first.id,{updateSearch:false});}controls();}}
}

$('focus-search').onclick=()=>{$('search-panel').open=true;$('search-panel').scrollIntoView({behavior:'smooth',block:'center'});$('search').focus({preventScroll:true});};
$('parameter-set').onchange=()=>selectParameters($('parameter-set').value);
$('solution').onchange=()=>selectPattern($('solution').value);
map.onclick=e=>{if(!saved||!group)return;const b=map.getBoundingClientRect(),x=(e.clientX-b.left)*map.width/b.width,y=(e.clientY-b.top)*map.height/b.height,bounds=mapBounds();snap(bounds.F[0]+Math.max(0,Math.min(1,(x-80)/(map.width-100)))*(bounds.F[1]-bounds.F[0]),bounds.k[0]+Math.max(0,Math.min(1,1-(y-20)/(map.height-60)))*(bounds.k[1]-bounds.k[0]));};
map.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const set=parameterSets().find(set=>set.key===selectedParameterKey);if(set)snap(set.config.params.F,set.config.params.k);}};
$('preset').onchange=()=>setPreset($('preset').value);
for(const id of numeric)$(id).addEventListener('input',()=>{$('preset').value='custom';settingsRevision++;});
for(const id of ['resolution','frames','stencil','seed'])$(id).addEventListener('change',()=>{settingsRevision++;});
$('search').onclick=()=>search(false);$('scan').onclick=()=>search(true);
$('stop').onclick=()=>{cancel('Search cancelled. No unverified candidate was added to the atlas.');if(!record&&selectedPatternId)openPattern(selectedPatternId,{updateSearch:false});};
$('play').onclick=togglePlayback;$('rewind').onclick=()=>{phase=0;draw();syncViewUrl();};
$('phase').oninput=()=>{phase=mod(+$('phase').value);setPlaying(false);draw();syncViewUrl();};
for(const canvas of [main,$('gpu-pattern')]){canvas.onclick=togglePlayback;canvas.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();togglePlayback();}};}
$('tiles').onchange=()=>{overlay();draw();syncViewUrl();};$('palette').onchange=()=>{colorScale();populatePatterns(parameterSets().find(set=>set.key===selectedParameterKey));controls();draw();syncViewUrl();};$('show-generators').onchange=()=>{overlay();syncViewUrl();};
$('framing').onchange=()=>{overlay();draw();syncViewUrl();};
$('show-approximate').onchange=()=>{if($('show-approximate').checked)$('show-generators').checked=true;overlay();syncViewUrl();};
$('retry-animation').onclick=()=>saved&&selectedPatternId?openPattern(selectedPatternId,{playback:pendingPlayback}):location.reload();
$('speed').onchange=syncViewUrl;
$('operation').onchange=()=>chooseGenerator($('operation').value);
$('export').onclick=()=>{
  if(!record)return;
  const out={schema:'scott-gray-verified-orbit-v3',...record,layout:'frame-major; planar U then V; x-fast; lattice nodes i/N,j/N'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(out,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`scott-gray-${group.id}-verified.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

try{
  const [response,manifestResponse,overlayResponse,nearResponse]=await Promise.all([fetch('groups.json'),fetch('data/precomputed-atlas.json',{cache:'no-store'}),fetch('data/overlay-translations.json?v=20260905-wallpaper').catch(()=>null),fetch('data/overlay-near-translations.json?v=20260905-wallpaper').catch(()=>null)]);
  if(overlayResponse?.ok)translationIndex=await overlayResponse.json();
  if(nearResponse?.ok)nearTranslationIndex=await nearResponse.json();
  if(!response.ok||!manifestResponse.ok)throw Error('Precomputed solution catalog unavailable.');
  const [catalog,manifest]=await Promise.all([response.json(),manifestResponse.json()]);groups=catalog;if(manifest.visibilityPolicyVersion!==VISIBILITY_VERSION)throw Error('The saved catalog needs the current throughout-cycle visibility check.');saved=createPrecomputedCatalog(manifest,{groups});
  for(const entry of manifest.orbits){recordNames.set(entry.id,entry.patternName??entry.name?.split(' · F')[0]??'Periodic wave');recordDescriptions.set(entry.id,entry.description??'');}
  $('groups').innerHTML=groups.map(g=>`<button class="group" data-id="${g.id}" aria-pressed="false"><strong>${GROUP_DISPLAY[g.id].shortHTML}</strong><span>${g.id}<small class="orbit-count"></small></span></button>`).join('');
  for(const b of $('groups').children)b.onclick=()=>chooseGroup(b.dataset.id);
  for(const p of PROFILES){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;$('preset').append(o);}$('preset').value='u-skate';
  const defaultGroup=manifest.preferredGroup??'g95';
  restoreView(defaultGroup);
  window.addEventListener('hashchange',()=>restoreView(defaultGroup));requestAnimationFrame(animate);


}catch(e){emptyViewer({error:e.message});setStatus(e.message);console.error(e);}
