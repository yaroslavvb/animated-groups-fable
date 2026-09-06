import {createWallpaperCatalog} from './wallpaper-atlas.mjs';
import {createWallpaperPlayer} from './wallpaper-playback.mjs';
import {makeWallpaperCellView} from './wallpaper-cell.mjs';
import {renderWallpaperOverlay} from './wallpaper-overlay.mjs';
import {readViewState,writeViewHash} from './view-state.mjs';

const root = new URL('./', import.meta.url);
const $ = id => document.getElementById(id);
const familyId = $('family-nav').dataset.family;
const mod = value => ((value % 1) + 1) % 1;
const plural = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
const parameterKey = config => JSON.stringify([config.params.F,config.params.k,config.params.Du,config.params.Dv,config.L ?? config.N*config.params.dx,config.params.stencil]);
const patternLabel = record => `${record.patternName ?? record.name ?? 'Periodic wave'} · T ${record.config.period.toFixed(2)} · ${record.config.N}²`;
const scientific = value => Number.isFinite(value) ? value.toExponential(2) : '—';
const fixed = value => Number.isFinite(value) ? Number(value.toPrecision(6)).toString() : '—';
let family, groups, manifest, catalog, group, record, player, cellView;
let selectedId = null, selectedKey = null, generatorName = null;
let phase = 0, playing = false, lastTime = 0, selectionToken = 0, mapGeometry;
let requestedPlayback = {phase:0,play:true};
const remembered = new Map();
const entries = () => catalog?.summaries(group?.id) ?? [];
const selectedGenerator = () => group?.namedGenerators.find(item => item.name === generatorName) ?? group?.namedGenerators[0];

function syncUrl() {
  if (!group) return;
  history.replaceState(null,'',writeViewHash({groupId:group.id,patternId:selectedId,
    palette:$('palette').value,tiles:+$('tiles').value,framing:$('framing').value,
    speed:+$('speed').value,generator:generatorName,overlay:$('show-generators').checked,
    approximate:false,...(record ? {phase,play:playing} : requestedPlayback)}));
}

function parameterSets() {
  const sets = new Map();
  for (const summary of entries()) {
    const key = parameterKey(summary.config);
    if (!sets.has(key)) sets.set(key,{key,config:summary.config,patterns:[]});
    sets.get(key).patterns.push(summary);
  }
  return [...sets.values()].sort((a,b) => b.patterns.length-a.patterns.length || a.config.params.F-b.config.params.F || a.config.L-b.config.L);
}

function setPlaying(value) {
  playing = !!record && !!value;
  $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  $('play').setAttribute('aria-label',playing ? 'Pause animation' : 'Play animation');
}

function controls() {
  for (const id of ['play','rewind','phase','export']) $(id).disabled = !record;
  $('parameter-set').disabled = !entries().length;
  $('solution').disabled = !entries().length;
  $('show-generators').disabled = !record;
  $('operation').disabled = !record;
}

function empty({loading=false,error=null}={}) {
  player?.dispose();player=null;record=null;cellView=null;setPlaying(false);
  $('gpu-pattern').hidden=true;$('pattern').hidden=false;$('empty-state').hidden=false;
  $('generator-overlay').toggleAttribute('hidden',true);$('generator-overlay').replaceChildren();
  $('cell-guide').toggleAttribute('hidden',true);$('cell-guide').replaceChildren();
  $('pattern').style.clipPath='';$('gpu-pattern').style.clipPath='';
  document.querySelector('.canvas-wrap').classList.remove('cell-framing');
  const zeroOffset = group && !group.hasTimeShift;
  $('empty-state').querySelector('h2').textContent = loading ? 'Loading saved animation…' : error ? 'Animation unavailable' : zeroOffset ? 'Zero-offset symmetry' : 'No verified pattern yet';
  $('empty-description').textContent = loading ? 'Downloading the saved concentration field.' : error ? 'Select the pattern again to retry.' : zeroOffset ? 'This symmetry type has no nonzero time shift.' : 'No candidate has passed verification for this time symmetry. Existence remains unresolved.';
  $('mode-label').textContent = loading ? 'Loading saved animation' : error ? 'Download failed' : zeroOffset ? 'No time offset' : 'Existence unresolved';
  $('engine-label').textContent='No orbit loaded';$('phase-label').textContent='—';$('phase').value=0;
  $('display-range').textContent='';$('scale-label').textContent='';
  $('caption').textContent=error ?? (zeroOffset ? 'No nonzero time-shift example is assigned to this entry.' : 'Only accepted numerical solutions are displayed.');
  for (const id of ['pde','symmetry','motion','return']) $(id).textContent='—';
  const context=$('pattern').getContext('2d');context.fillStyle='#271337';context.fillRect(0,0,$('pattern').width,$('pattern').height);
  controls();
}

function renderGroups() {
  $('groups').style.setProperty('--group-count',groups.length);
  $('groups').replaceChildren(...groups.map(item=>{
    const button=document.createElement('button');button.className='group';button.type='button';
    button.dataset.groupId=item.id;button.setAttribute('aria-pressed',String(item.id===group?.id));
    const name=document.createElement('strong');name.textContent=item.signature;
    const count=document.createElement('span');count.textContent=plural(catalog.size(item.id),'pattern');
    button.append(name,count);button.title=`${item.id} · ${item.phaseOrder === 1 ? 'no time offset' : `${item.phaseOrder} phases`}`;
    button.onclick=()=>chooseGroup(item.id,{user:true});return button;
  }));
}

function populateSelectors() {
  const sets=parameterSets(),selectedSet=sets.find(set=>set.key===selectedKey),patterns=selectedSet?.patterns ?? [];
  $('parameter-set').replaceChildren(...(sets.length?sets.map(set=>{
    const option=document.createElement('option');option.value=set.key;
    option.textContent=`F ${fixed(set.config.params.F)} · k ${fixed(set.config.params.k)} · L ${fixed(set.config.L)} · ${plural(set.patterns.length,'pattern')}`;
    option.selected=set.key===selectedKey;return option;
  }):[new Option('No verified parameters','')]));
  const p=selectedSet?.config.params;
  $('parameter-values').textContent=p ? `F = ${fixed(p.F)}    k = ${fixed(p.k)}\nDᵤ = ${fixed(p.Du)}    Dᵥ = ${fixed(p.Dv)}    L = ${fixed(selectedSet.config.L)}` : 'No verified parameter sets';
  $('parameter-values').style.whiteSpace='pre-wrap';
  $('solution').replaceChildren(...(patterns.length?patterns.map(item=>{
    const option=new Option(patternLabel(item),item.id);option.selected=item.id===selectedId;return option;
  }):[new Option('No verified patterns','')]));
  $('pattern-thumbnails').replaceChildren(...patterns.map((item,index)=>{
    const button=document.createElement('button');button.type='button';button.className='pattern-thumb';button.dataset.patternId=item.id;
    button.setAttribute('aria-pressed',String(item.id===selectedId));button.setAttribute('aria-label',`Pattern ${index+1}: ${patternLabel(item)}`);
    const image=document.createElement('img');image.src=new URL(item.thumbnails[$('palette').value],root);image.alt='';image.width=160;image.height=160;image.loading='lazy';
    const caption=document.createElement('span');caption.textContent=`${index+1}. ${item.patternName ?? item.name ?? 'Periodic wave'}`;
    button.append(image,caption);button.onclick=()=>selectPattern(item.id,{user:true});return button;
  }));
  $('pattern-count').textContent=plural(patterns.length,'verified pattern');
  $('solution-count').textContent=`${plural(sets.length,'parameter set')} · ${plural(entries().length,'pattern')}`;
  renderParameterMap(sets);controls();
}

function renderParameterMap(sets) {
  const canvas=$('parameter-map'),context=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
  canvas.parentElement.hidden=sets.length<2;mapGeometry=null;if(sets.length<2)return;
  const vertical=sets.every(set=>set.config.params.k===sets[0].config.params.k)?'L':'k';
  const points=sets.map(set=>({set,x:set.config.params.F,y:vertical==='L'?set.config.L:set.config.params.k}));
  const extent=axis=>{const lo=Math.min(...points.map(p=>p[axis])),hi=Math.max(...points.map(p=>p[axis]));const pad=Math.max((hi-lo)*.15,Math.abs(lo)*.04,1e-5);return [lo-pad,hi+pad];};
  const [xmin,xmax]=extent('x'),[ymin,ymax]=extent('y'),margin={left:72,right:26,top:24,bottom:52};
  const project=p=>[margin.left+(p.x-xmin)/(xmax-xmin)*(width-margin.left-margin.right),height-margin.bottom-(p.y-ymin)/(ymax-ymin)*(height-margin.top-margin.bottom)];
  context.clearRect(0,0,width,height);context.fillStyle='white';context.fillRect(0,0,width,height);
  context.strokeStyle='#dfdbe8';context.lineWidth=1;context.beginPath();context.moveTo(margin.left,margin.top);context.lineTo(margin.left,height-margin.bottom);context.lineTo(width-margin.right,height-margin.bottom);context.stroke();
  context.fillStyle='#6c6b79';context.font='18px system-ui';context.textAlign='center';context.fillText('F',width/2,height-10);context.fillText(vertical,27,margin.top+15);
  context.font='15px system-ui';for(const x of [xmin,xmax])context.fillText(fixed(x),project({x,y:ymin})[0],height-margin.bottom+24);
  context.textAlign='right';for(const y of [ymin,ymax])context.fillText(fixed(y),margin.left-8,project({x:xmin,y})[1]+5);
  for(const point of points){const [x,y]=project(point),selected=point.set.key===selectedKey;context.beginPath();context.arc(x,y,selected?9:6,0,2*Math.PI);context.fillStyle=selected?'#5842ad':'#a798ca';context.fill();if(selected){context.lineWidth=3;context.strokeStyle='#d9cff2';context.stroke();}}
  mapGeometry=points.map(p=>({set:p.set,point:project(p)}));
  canvas.setAttribute('aria-label',`Saved parameter sets, F versus ${vertical}. Click to select the closest verified point, or use arrow keys.`);
}

function renderOverlay() {
  const operation=selectedGenerator();
  $('operation').replaceChildren(...(group?.namedGenerators??[]).map(item=>new Option(`${item.name} · +${item.timeShift} T`,item.name)));
  $('operation').value=generatorName??'';
  $('generator-description').textContent=operation ? `${operation.name}: ${operation.kind} · +${operation.timeShift} T` : '';
  document.querySelector('.phase-rule').hidden=!$('show-generators').checked || !record;
  if(!record||!cellView){$('generator-overlay').toggleAttribute('hidden',true);return;}
  renderWallpaperOverlay($('generator-overlay'),group,{cellView,visible:$('show-generators').checked,selected:generatorName,translations:record.translations??[],onSelect:item=>{generatorName=item.name;renderOverlay();syncUrl();}});
}

function updateFraming() {
  if(!record)return;
  const count=+$('tiles').value,framing=$('framing').value;
  cellView=makeWallpaperCellView({lattice:group.lattice,translations:record.translations??[],count,framing});
  const clip=cellView?.clipPath??'';$('pattern').style.clipPath=clip;$('gpu-pattern').style.clipPath=clip;
  document.querySelector('.canvas-wrap').classList.toggle('cell-framing',framing==='cells');
  $('cell-guide').innerHTML=cellView?.guideMarkup??'';$('cell-guide').toggleAttribute('hidden',!$('cell-guide').innerHTML);
  $('tile-label').textContent=framing==='cells'?'Cells':'Width';
  $('tiles').setAttribute('aria-label',framing==='cells'?'Number of pattern cells':'Simulation width');
  for(const option of $('tiles').options)option.textContent=framing==='cells'?(option.value==='1'?'1 cell':`${option.value} × ${option.value} cells`):(option.value==='1'?'L':`${option.value} L`);
  $('scale-label').textContent=framing==='cells'?(cellView?.countLabel??`${count} × ${count} cells`):`Physical width ${count===1?'':count+' '}L`;
  $('view-scale-explanation').textContent=framing==='cells'?'Each outlined region is one numerically checked spatial repeat cell. The pattern and generators share the same coordinates.':'The displayed width is measured in simulation lattice lengths L.';
  renderOverlay();draw();
}

function draw() {
  if(!record||!player)return;
  player.draw(phase,{palette:$('palette').value,tiles:+$('tiles').value,...(cellView?.viewOptions??{})});
  $('phase').value=phase;$('phase-label').textContent=`${phase.toFixed(3)} T`;
}

function updateDisplayRange() {
  if(!record){$('display-range').textContent='';return;}
  const channel=$('palette').value==='concentration'?'v':'u',range=record.ranges[channel];
  $('display-range').textContent=`${channel.toUpperCase()} ${fixed(range[0])} – ${fixed(range[1])}`;
}

async function selectPattern(id,{user=false,view=null}={}) {
  const summary=catalog.get(id);if(!summary||summary.groupId!==group.id)return;
  const token=++selectionToken,targetGroup=group.id;
  selectedId=id;selectedKey=parameterKey(summary.config);remembered.set(targetGroup,id);
  requestedPlayback=view?{phase:view.phase,play:view.play}:{phase:0,play:true};
  empty({loading:true});populateSelectors();$('status').textContent='Loading saved animation…';
  if(user)syncUrl();
  try{
    const loaded=await catalog.load(id);if(token!==selectionToken||group.id!==targetGroup)return;
    if(!catalog.isVerified(loaded,targetGroup))throw Error('The field is not part of the verified catalog.');
    record=loaded;phase=requestedPlayback.phase;player=createWallpaperPlayer($('gpu-pattern'),$('pattern'),record);
    $('empty-state').hidden=true;$('mode-label').textContent=group.hasTimeShift?'Numerically verified time symmetry':'Numerically verified · zero time offset';
    $('engine-label').textContent=`${player.backend} · ${record.config.N}² × ${record.config.M} · T ${record.config.period.toFixed(2)}`;
    const d=record.wallpaperVerification??{},checks=d.independentDynamics?.checks??[],last=checks[checks.length-1];
    $('pde').textContent=scientific(last?.trajectoryRms);
    $('symmetry').textContent=scientific(d.phaseRelations?.operations?.length?Math.max(...d.phaseRelations.operations.map(item=>item.maximum)):undefined);
    $('motion').textContent=scientific(d.temporalRms);
    $('return').textContent=scientific(last?.closureRms);
    $('caption').textContent=`${record.id} · ${record.offlineVerification?.gateVersion??'offline verification'}`;
    updateDisplayRange();
    $('status').textContent='Saved animation ready.';
    updateFraming();populateSelectors();lastTime=performance.now();setPlaying(requestedPlayback.play);controls();
    syncUrl();
  }catch(error){if(token!==selectionToken)return;empty({error:error.message});$('status').textContent=error.message;}
}

function chooseGroup(id,{user=false,view=null}={}) {
  const next=groups.find(item=>item.id===id)??groups.find(item=>catalog.size(item.id)>0)??groups[0];
  group=next;++selectionToken;
  generatorName=group.namedGenerators.some(item=>item.name===view?.generator)?view.generator:group.namedGenerators.find(item=>item.tau!==0)?.name??group.namedGenerators[0]?.name;
  $('group-label').textContent=`${group.id} · ${family.orbifold}`;$('selected-id').textContent=group.id;$('selected-title').textContent=group.signature;
  $('selected-description').textContent=group.hasTimeShift?`${plural(group.phaseOrder,'phase')} per period`:'Zero time offset';
  const requested=catalog.get(view?.patternId),rememberedId=remembered.get(group.id);
  selectedId=requested?.groupId===group.id?requested.id:rememberedId??parameterSets()[0]?.patterns[0]?.id??null;
  selectedKey=selectedId?parameterKey(catalog.get(selectedId).config):null;
  renderGroups();populateSelectors();renderOverlay();
  if(selectedId)selectPattern(selectedId,{user,view});else{requestedPlayback=view?{phase:view.phase,play:view.play}:{phase:0,play:true};empty();renderOverlay();$('status').textContent=group.hasTimeShift?'No verified pattern in the saved search results.':'This entry has no nonzero time shift.';if(user)syncUrl();}
}

function restoreUrl() {
  const view=readViewState(location.hash);
  $('palette').value=view.palette;$('tiles').value=view.tiles;$('framing').value=view.framing;
  $('speed').value=view.speed;$('show-generators').checked=view.overlay;
  chooseGroup(view.groupId,{view});
}

function togglePlayback(){if(!record)return;setPlaying(!playing);draw();syncUrl();}
$('play').onclick=togglePlayback;
for(const id of ['pattern','gpu-pattern']){$(id).onclick=togglePlayback;$(id).onkeydown=event=>{if(event.code==='Space'){event.preventDefault();togglePlayback();}};}
$('rewind').onclick=()=>{phase=0;draw();syncUrl();};
$('phase').oninput=()=>{phase=mod(+$('phase').value);setPlaying(false);draw();syncUrl();};
$('speed').onchange=syncUrl;
$('framing').onchange=$('tiles').onchange=()=>{updateFraming();syncUrl();};
$('palette').onchange=()=>{populateSelectors();updateDisplayRange();draw();syncUrl();};
$('show-generators').onchange=()=>{renderOverlay();syncUrl();};
$('operation').onchange=()=>{generatorName=$('operation').value;renderOverlay();syncUrl();};
$('parameter-set').onchange=()=>{const set=parameterSets().find(item=>item.key===$('parameter-set').value);if(set)selectPattern(set.patterns[0].id,{user:true});};
$('solution').onchange=()=>selectPattern($('solution').value,{user:true});
$('parameter-map').onclick=event=>{
  if(!mapGeometry?.length)return;const rect=$('parameter-map').getBoundingClientRect(),point=[(event.clientX-rect.left)/rect.width*$('parameter-map').width,(event.clientY-rect.top)/rect.height*$('parameter-map').height];
  const nearest=mapGeometry.reduce((best,item)=>{const distance=(point[0]-item.point[0])**2+(point[1]-item.point[1])**2;return !best||distance<best.distance?{...item,distance}:best;},null);
  selectPattern(nearest.set.patterns[0].id,{user:true});
};
$('parameter-map').onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const sets=parameterSets(),i=sets.findIndex(set=>set.key===selectedKey),step=['ArrowLeft','ArrowDown'].includes(event.key)?-1:1;if(sets.length)selectPattern(sets[(i+step+sets.length)%sets.length].patterns[0].id,{user:true});};
$('export').onclick=()=>{if(!record)return;const blob=new Blob([JSON.stringify({schema:'scott-gray-verified-orbit-export-v1',group,record:{...record,field:Array.from(record.field)}})],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${record.id.replace(/[^a-z0-9._-]/gi,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

function animate(now){if(playing&&record){phase=mod(phase+Math.max(0,Math.min(now-lastTime,100))/8000*+$('speed').value);draw();}lastTime=now;requestAnimationFrame(animate);}

try{
  const responses=await Promise.all([fetch(new URL('wallpaper-groups.json',root)),fetch(new URL('data/wallpaper-atlas.json',root))]);
  if(responses.some(response=>!response.ok))throw Error('The saved wallpaper catalog could not be loaded.');
  const [metadata,data]=await Promise.all(responses.map(response=>response.json()));manifest=data;
  family=metadata.families.find(item=>item.id===familyId);if(!family)throw Error('Unknown wallpaper family.');
  groups=family.groupIds.map(id=>metadata.groups.find(item=>item.id===id));
  catalog=createWallpaperCatalog(manifest,{groups:metadata.groups,baseUrl:root});
  restoreUrl();window.addEventListener('hashchange',restoreUrl);requestAnimationFrame(animate);
}catch(error){empty({error:error.message});$('status').textContent=error.message;}
