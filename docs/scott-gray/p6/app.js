import {createPrecomputedCatalog} from '../precomputed-catalog.mjs?v=20260904-p6catalog';
import {mod,latticeToScreen,createPlayer,drawCPU,comparisonErrors} from './playback.mjs?v=20260904-p6';

const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
const number=value=>Number(value.toPrecision(11)).toString();
const fmt=value=>Number.isFinite(value)?value===0?'0':Math.abs(value)<.001?value.toExponential(2):value.toFixed(4):'—';
const palette=()=>$('palette').value,tiles=()=>+$('tiles').value;
const parameterKey=config=>JSON.stringify([config.params.F,config.params.k,config.params.Du,config.params.Dv,config.L??config.N*config.params.dx,config.params.stencil]);
let groups=[],catalog=null,group=null,record=null,player=null,selectedId=null,selectedKey=null,preferredParameters=null,generatorName='α',selectionToken=0,phase=0,playing=false,lastTime=0,lastComparison=-Infinity;
const remembered=new Map();
const entries=()=>catalog?.summaries(group?.id)??[];
const generator=()=>group?.namedGenerators.find(item=>item.name===generatorName);
function parameterSets(){const result=new Map();for(const entry of entries()){const key=parameterKey(entry.config);if(!result.has(key))result.set(key,{key,config:entry.config,patterns:[]});result.get(key).patterns.push(entry);}return [...result.values()].sort((a,b)=>a.config.params.F-b.config.params.F||a.config.params.k-b.config.params.k);}
function setPlaying(value){playing=!!record&&!!value;$('play').textContent=playing?'Ⅱ Pause':'▶ Play';$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');if(!playing&&record)draw(true);}
function controls(){for(const id of ['play','rewind','phase','export'])$(id).disabled=!record;$('parameter-set').disabled=!entries().length;$('solution').disabled=!entries().length;}
function clear(canvas){const context=canvas.getContext('2d');context.fillStyle='#271337';context.fillRect(0,0,canvas.width,canvas.height);}
function setMetrics(diagnostics){
  const operations=diagnostics?.refinedPhase?.operations??diagnostics?.independentPhase?.operations;
  $('pde').textContent=Number.isFinite(diagnostics?.relativePde)?`${(100*diagnostics.relativePde).toFixed(2)}%`:'—';
  $('symmetry').textContent=fmt(operations?.length?Math.max(...operations.map(operation=>operation.shiftedRms)):diagnostics?.symmetryMax);
  $('motion').textContent=fmt(diagnostics?.temporalRms);$('return').textContent=fmt(diagnostics?.refinedClosure?.closureRms??diagnostics?.closure?.closureRms);
}
function empty({loading=false,error=null}={}){
  player?.dispose();player=null;record=null;setPlaying(false);phase=0;
  $('gpu-pattern').hidden=true;$('pattern').hidden=false;$('empty-state').hidden=false;
  $('empty-state').querySelector('h2').textContent=loading?'Loading saved animation…':error?'Animation unavailable':'No verified orbit yet';
  $('empty-description').textContent=loading?'The parameters and numerical checks are already computed. Only this animation is being downloaded.':error?'Choose another pattern or select this one again to retry.':'No precomputed parameter values have a verified orbit for this time symmetry. Existence remains unresolved.';
  $('mode-label').textContent=loading?'Loading saved animation':error?'Download failed':'Existence unresolved';
  $('engine-label').textContent=loading?'Precomputed data':'No orbit loaded';
  $('caption').textContent=loading?'Loading a saved field. No numerical search runs during browsing.':error?error:'Failed or unverified candidates never appear in this viewer.';
  $('phase-label').textContent='—';$('phase').value=0;$('color-scale').textContent='';setMetrics(null);clear($('pattern'));clear($('compare-a'));clear($('compare-b'));
  $('comparison-error').textContent='Select a verified orbit to compare its actual concentration fields.';controls();
}
function selectedOperation(){const g=generator();return g?{M:g.matrix,v:g.translation,tau:g.tau}:null;}
function drawComparison(){
  if(!record)return;
  const operation=selectedOperation(),options={palette:palette(),tiles:tiles()};
  drawCPU($('compare-a'),record,phase,{...options,operation});drawCPU($('compare-b'),record,phase+operation.tau,options);
  const errors=comparisonErrors(record,phase,operation);
  $('comparison-error').textContent=`Both concentrations: rotation + phase RMS ${fmt(errors.shiftedRms)}; rotation alone RMS ${fmt(errors.sameTimeRms)}.`;
  lastComparison=performance.now();
}
function draw(forceComparison=false){
  if(!record)return;
  const options={tiles:tiles(),palette:palette()};
  if(player)player.draw(phase,options);else drawCPU($('pattern'),record,phase,options);
  $('phase').value=phase;$('phase-label').textContent=`${phase.toFixed(3)} T`;
  if(forceComparison||performance.now()-lastComparison>180)drawComparison();
}
function updateScale(){if(!record)return;const key=palette()==='concentration'?'v':'u',range=record.ranges[key];$('color-scale').textContent=`Fixed across the entire orbit: ${key.toUpperCase()} = ${range[0].toFixed(4)} … ${range[1].toFixed(4)}.`;}
function svgElement(tag,attributes){const element=document.createElementNS(svgNS,tag);for(const [name,value] of Object.entries(attributes))element.setAttribute(name,value);return element;}
function overlay(){
  if(!group)return;
  const overlay=$('generator-overlay');overlay.toggleAttribute('hidden',!$('show-generators').checked);overlay.replaceChildren();
  const width=tiles(),extent=Math.ceil(2*width)+1;
  for(const named of group.namedGenerators)for(let j=-extent;j<=extent;j++)for(let i=-extent;i<=extent;i++){
    const [x,y]=latticeToScreen([named.centre[0]+i,named.centre[1]+j],width);if(x<.025||x>.975||y<.045||y>.96)continue;
    const marker=svgElement('g',{transform:`translate(${768*x},${768*y})`,class:'generator-marker'+(named.name===generatorName?' selected':''),role:'button',tabindex:'0','aria-label':`${named.name}: ${named.angleDegrees}° rotation and ${named.timeShift} period phase shift`});
    marker.append(svgElement('circle',{r:23,class:'marker-halo'}),svgElement('path',{d:named.path,class:'marker-glyph',transform:'scale(.8)'}));
    const label=svgElement('text',{x:26,y:5});label.textContent=named.name;marker.append(label);
    const select=()=>{generatorName=named.name;$('operation').value=generatorName;overlay();drawComparison();};marker.onclick=select;marker.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}};overlay.append(marker);
  }
  const g=generator();$('generator-description').textContent=`${g.name} · ${g.angleDegrees}° rotation · +${g.timeShift} T`;$('compare-label').textContent=`q(x, t + ${g.timeShift} T)`;
  const count=6,shift=Math.round(g.tau*count),row=document.createElement('div');row.className='phase-row';
  for(let i=0;i<count;i++){const chip=document.createElement('span');chip.className='phase-chip';for(const [index,label] of [[i,`${i}/6 → `],[mod(i+shift,count),`${mod(i+shift,count)}/6`]]){const color=document.createElement('i');color.style.setProperty('--phase-color',`hsl(${index*60+15} 55% 55%)`);chip.append(color,document.createTextNode(label));}row.append(chip);}
  $('phase-permutation').replaceChildren(row);$('phase-explanation').textContent=g.tau===0?'This generator preserves the phase.':'The cyclic color permutation advances the chemical phase. The spatial rotation alone is a different constraint.';
  $('scale-label').textContent=`Triangular lattice · ${width} cell length${width===1?'':'s'} across`;
}
function patternLabel(entry){return `${entry.patternName??entry.name??'Periodic wave'} · T ${entry.config.period.toFixed(2)} · ${entry.config.N}²`;}
function populatePatterns(set){
  const patterns=set?.patterns??[];$('solution').replaceChildren();$('pattern-thumbnails').replaceChildren();$('pattern-count').textContent=`${patterns.length} verified pattern${patterns.length===1?'':'s'} at these parameters.`;
  for(const entry of patterns){const label=patternLabel(entry),option=document.createElement('option');option.value=entry.id;option.textContent=label;$('solution').append(option);
    const button=document.createElement('button');button.className='pattern-thumb';button.type='button';button.setAttribute('aria-pressed',String(entry.id===selectedId));button.setAttribute('aria-label','Select '+label);
    const image=document.createElement('img');image.src=entry.thumbnails[palette()];image.alt='Verified triangular-lattice field at phase zero';image.width=160;image.height=160;image.decoding='async';
    const text=document.createElement('span');text.textContent=label;button.append(image,text);button.onclick=()=>selectPattern(entry.id);$('pattern-thumbnails').append(button);
  }
  if(!patterns.length){const option=document.createElement('option');option.textContent='No verified patterns';$('solution').append(option);}
  else $('solution').value=selectedId;
}
function populate(){
  const sets=parameterSets();
  for(const button of $('groups').children){const count=catalog?.size(button.dataset.id)??0;button.querySelector('.orbit-count').textContent=`${count} pattern${count===1?'':'s'}`;button.setAttribute('aria-pressed',String(button.dataset.id===group?.id));}
  $('solution-count').textContent=`${sets.length} verified parameter set${sets.length===1?'':'s'} · ${entries().length} pattern${entries().length===1?'':'s'}`;
  $('parameter-set').replaceChildren();for(const set of sets){const option=document.createElement('option');option.value=set.key;option.textContent=`F ${number(set.config.params.F)} · k ${number(set.config.params.k)}`;$('parameter-set').append(option);}
  if(!sets.length){const option=document.createElement('option');option.textContent='No verified parameters';$('parameter-set').append(option);selectedKey=null;}
  else if(!sets.some(set=>set.key===selectedKey))selectedKey=sets[0].key;
  const set=sets.find(set=>set.key===selectedKey);if(set)$('parameter-set').value=set.key;
  $('parameter-values').textContent=set?`F ${number(set.config.params.F)} · k ${number(set.config.params.k)} · Dᵤ ${number(set.config.params.Du)} · Dᵥ ${number(set.config.params.Dv)} · L ${number(set.config.L??set.config.N*set.config.params.dx)} · triangular lattice`:'No precomputed verified parameters for this group.';
  populatePatterns(set);drawMap();controls();
}
async function openPattern(id){
  const summary=catalog?.get(id);if(!summary||summary.groupId!==group.id)return;
  const token=++selectionToken,targetGroup=group.id;selectedId=id;selectedKey=parameterKey(summary.config);remembered.set(targetGroup,id);empty({loading:true});populate();$('status').textContent='Loading the selected precomputed animation…';
  try{
    const loaded=await catalog.load(id);if(token!==selectionToken||group.id!==targetGroup)return;
    if(!catalog.isVerified(loaded,targetGroup))throw Error('The saved orbit does not belong to this verified catalog.');record=loaded;
    try{player=createPlayer($('gpu-pattern'),record,{onContextLost:()=>{player?.dispose();player=null;$('gpu-pattern').hidden=true;$('pattern').hidden=false;$('engine-label').textContent='CPU playback';draw(true);}});}catch{player=null;}
    $('gpu-pattern').hidden=!player;$('pattern').hidden=!!player;$('empty-state').hidden=true;$('mode-label').textContent='Verified periodic time symmetry';
    $('engine-label').textContent=`${player?'WebGL':'CPU'} playback · ${record.config.N}² × ${record.config.M} · T ${record.config.period.toFixed(2)}`;
    $('caption').textContent=(record.description??'')+' Independent numerical verification was completed before this field was published.';
    $('status').textContent='Precomputed animation ready. The downloaded field passed its file-integrity check.';setMetrics(record.diagnostics);updateScale();populate();draw(true);setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  }catch(error){if(token!==selectionToken||group.id!==targetGroup)return;empty({error:error.message});$('status').textContent=`Could not load this animation: ${error.message}`;}
}
function chooseGroup(id){
  selectionToken++;group=groups.find(item=>item.id===id)??groups[0];if(!group)return;history.replaceState(null,'','#'+group.id);
  const preferred=preferredParameters&&entries().find(entry=>entry.config.params.F===preferredParameters.F&&entry.config.params.k===preferredParameters.k);
  generatorName=group.namedGenerators[0].name;selectedId=remembered.get(group.id)??preferred?.id??entries()[0]?.id??null;selectedKey=selectedId?parameterKey(catalog.get(selectedId).config):null;
  $('group-label').textContent=group.id+' · 632';$('selected-id').textContent=group.id+' / CYCLIC COLOR GROUP';$('selected-title').innerHTML=group.shortHTML;
  $('selected-description').textContent=group.namedGenerators.map(g=>`${g.name}: ${g.timeShift} T`).join(' · ')+'. Phase shifts act on both chemical concentrations.';$('reference-link').href='../../correspondence-p6.html#'+group.id;
  $('operation').replaceChildren();for(const named of group.namedGenerators){const option=document.createElement('option');option.value=named.name;option.textContent=`${named.name} · +${named.timeShift} T`;$('operation').append(option);}
  overlay();populate();if(selectedId)openPattern(selectedId);else{empty();$('status').textContent='No precomputed orbit has passed verification for this group yet.';}
}
function mapBounds(){const sets=parameterSets(),bounds={};for(const [axis,minimum] of [['F',.00002],['k',.00002]]){const values=sets.map(set=>set.config.params[axis]);if(!values.length){bounds[axis]=[0,axis==='F'?.02:.08];continue;}const lo=Math.min(...values),hi=Math.max(...values),padding=Math.max(minimum,.2*(hi-lo));bounds[axis]=[Math.max(0,lo-padding),hi+padding];}return bounds;}
function drawMap(){
  const canvas=$('parameter-map'),c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,left=80,top=20,pw=w-100,ph=h-60,bounds=mapBounds(),sets=parameterSets();c.fillStyle='#fff';c.fillRect(0,0,w,h);c.font='15px sans-serif';c.lineWidth=1;
  for(let i=0;i<=4;i++){const x=left+pw*i/4,y=top+ph*(1-i/4);c.strokeStyle='#ece9f0';c.beginPath();c.moveTo(x,top);c.lineTo(x,h-40);c.moveTo(left,y);c.lineTo(w-20,y);c.stroke();c.fillStyle='#807887';c.textAlign=i===4?'right':i===0?'left':'center';c.fillText((bounds.F[0]+(bounds.F[1]-bounds.F[0])*i/4).toFixed(6),x,h-10);c.textAlign='right';c.fillText((bounds.k[0]+(bounds.k[1]-bounds.k[0])*i/4).toFixed(5),left-7,y+5);}
  for(const set of sets){const p=set.config.params,x=left+(p.F-bounds.F[0])/(bounds.F[1]-bounds.F[0])*pw,y=top+(1-(p.k-bounds.k[0])/(bounds.k[1]-bounds.k[0]))*ph;c.fillStyle='#5842ad';c.beginPath();c.arc(x,y,7,0,2*Math.PI);c.fill();if(set.key===selectedKey){c.strokeStyle='#5842ad';c.lineWidth=3;c.beginPath();c.arc(x,y,13,0,2*Math.PI);c.stroke();}}
  if(!sets.length){c.fillStyle='#807887';c.font='21px sans-serif';c.textAlign='center';c.fillText('No verified points for '+(group?.id??'632'),left+pw/2,top+ph/2);}
  canvas.setAttribute('aria-disabled',String(!sets.length));$('map-status').textContent=sets.length?'Select a point to snap to the closest verified parameter set.':'No verified parameter point is available to select.';
}
function selectParameters(key){const set=parameterSets().find(item=>item.key===key);if(set)openPattern(set.patterns[0].id);}
function selectPattern(id){openPattern(id);if(matchMedia('(max-width:720px)').matches)document.querySelector('.viewer').scrollIntoView({behavior:'smooth',block:'start'});}
$('parameter-map').onclick=event=>{if(!catalog||!group)return;const canvas=$('parameter-map'),rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height,bounds=mapBounds(),scales={F:bounds.F[1]-bounds.F[0],k:bounds.k[1]-bounds.k[0]},point={F:bounds.F[0]+Math.max(0,Math.min(1,(x-80)/(canvas.width-100)))*scales.F,k:bounds.k[0]+Math.max(0,Math.min(1,1-(y-20)/(canvas.height-60)))*scales.k},nearest=catalog.nearest(group.id,point,{scales});if(nearest)selectParameters(parameterKey(nearest.config));};
$('parameter-map').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectParameters(selectedKey);}};
$('parameter-set').onchange=()=>selectParameters($('parameter-set').value);$('solution').onchange=()=>selectPattern($('solution').value);
$('play').onclick=()=>setPlaying(!playing);$('rewind').onclick=()=>{phase=0;draw(true);};$('phase').oninput=()=>{phase=mod(+$('phase').value);setPlaying(false);draw(true);};
for(const id of ['pattern','gpu-pattern']){$(id).onclick=()=>setPlaying(!playing);$(id).onkeydown=event=>{if(event.code==='Space'){event.preventDefault();setPlaying(!playing);}};}
$('tiles').onchange=()=>{overlay();draw(true);};$('palette').onchange=()=>{updateScale();populatePatterns(parameterSets().find(set=>set.key===selectedKey));draw(true);};$('show-generators').onchange=overlay;$('operation').onchange=()=>{generatorName=$('operation').value;overlay();drawComparison();};
$('export').onclick=()=>{if(!record)return;const url=URL.createObjectURL(new Blob([JSON.stringify({schema:'scott-gray-verified-orbit-v3',family:'p6',...record,layout:'frame-major; planar U then V; triangular lattice coordinates; x-fast'})],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`scott-gray-632-${group.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function animate(now){if(playing&&record){phase=mod(phase+Math.min(now-lastTime,100)/8000*+$('speed').value);draw();}lastTime=now;requestAnimationFrame(animate);}
try{
  const [groupResponse,manifestResponse]=await Promise.all([fetch('groups.json'),fetch('data/precomputed-atlas.json')]);if(!groupResponse.ok)throw Error('632 group definitions could not load.');groups=await groupResponse.json();
  for(const item of groups){const button=document.createElement('button');button.className='group';button.dataset.id=item.id;button.setAttribute('aria-pressed','false');const symbol=document.createElement('strong');symbol.innerHTML=item.shortHTML;const label=document.createElement('span');label.textContent=item.id;const count=document.createElement('small');count.className='orbit-count';label.append(count);button.append(symbol,label);button.onclick=()=>chooseGroup(item.id);$('groups').append(button);}
  if(!manifestResponse.ok)throw Error('The precomputed 632 catalog could not load.');const manifest=await manifestResponse.json();catalog=createPrecomputedCatalog(manifest,{groups,family:'p6'});preferredParameters=manifest.preferredParameters??null;
  chooseGroup(/^#g24[3-8]$/.test(location.hash)?location.hash.slice(1):manifest.preferredGroup??groups.find(item=>catalog.size(item.id))?.id??'g243');
  window.addEventListener('hashchange',()=>{if(/^#g24[3-8]$/.test(location.hash))chooseGroup(location.hash.slice(1));});requestAnimationFrame(animate);
}catch(error){empty({error:error.message});$('solution-count').textContent='Catalog unavailable';$('status').textContent=error.message;console.error(error);}
