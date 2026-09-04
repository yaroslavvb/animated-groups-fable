import {makePreview,mod,DESCRIPTIONS} from './seeds.mjs';
import {createStepper,projectKernel,movieStats,mapIndex} from './dynamics.mjs?v=20260904-gpu';
import {createWebGLGrayScott} from './webgl.mjs';
import {GROUP_DISPLAY,renderGeneratorOverlay,generatorDescription} from './overlay.mjs';
import {PROFILES,makeInitial,nearestProfile,profilesForFilter,assessProfile,classifyRun,DEFAULT_FILTER} from './exploration.mjs';
import {hasRefinedAcceptance} from './acceptance.mjs';
import {renderField,clearCanvas,resampleState,valueAt,fmt} from './render.mjs';
const $=id=>document.getElementById(id),nextFrame=()=>new Promise(requestAnimationFrame);
let groups=[],group,profile=PROFILES[0],evidence={runs:[]},engine=null,record=null,activeConfig=null;
let worker=null,job=0,busy=false,playing=false,phase=0,lastTime=0,lastStamp=0;
let selectedGenerator='α',fallbackReason='',sessionVerified=[],scanPoints=[];
const main=$('pattern'),gpuCanvas=$('gpu-pattern'),map=$('parameter-map');
const filter=()=>$('filter').value;
const settings=['feed','kill','length','du','dv'];
const status=text=>{$('status').textContent=text;};
const currentProfile=()=>({...profile,F:+$('feed').value,k:+$('kill').value,seed:$('seed').value});
function config(N=+$('resolution').value){
  return {N,M:+$('frames').value,period:+$('period').value,L:+$('length').value,seed:$('seed').value,ops:group.render.ops,groupId:group.id,
    params:{Du:+$('du').value,Dv:+$('dv').value,F:+$('feed').value,k:+$('kill').value,dx:+$('length').value/N,stencil:$('stencil').value,dt:.4},minTemporal:.008,minSpatial:.012};
}
function valid(ids=settings){return ids.every(id=>$(id).reportValidity());}
function context(){const c=config();return {groupId:group.id,N:c.N,L:c.L,...c.params,dt:engine?.effectiveDt??.4,seed:engine?activeConfig.seed:c.seed,integrator:'midpoint',boundary:'periodic',precision:engine?.backend.startsWith('WebGL')?'float32':'float64',horizon:2000,observationStart:1800,observationEnd:2000,sampleInterval:50};}
function verifiedForGroup(){return sessionVerified.filter(r=>r.config.groupId===group.id);}
function candidates(){return profilesForFilter(filter(),evidence,group.id);}
function syncRanges(){$('feed-range').value=$('feed').value;$('kill-range').value=$('kill').value;}
function setPlaying(on){playing=!!on&&(!!engine||!!record);$('play').textContent=playing?'Ⅱ Pause':'▶ Play';$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');}
function cancel(message){job++;if(worker){worker.terminate();worker=null;}busy=false;setPlaying(false);$('progress').hidden=true;restrictions();if(message)status(message);}
function disposeEngine(){engine?.dispose();engine=null;gpuCanvas.hidden=true;main.hidden=false;}
function restrictions(){
  const strict=filter()==='periodic',empty=strict&&!verifiedForGroup().length,observed=filter()==='observed';
  document.body.classList.toggle('empty-filter',empty);
  $('parameters').disabled=strict||busy;
  for(const id of ['length','resolution','seed','stencil','du','dv'])$(id).disabled=observed;
  $('preset').disabled=busy||(strict?empty:!candidates().length);
  for(const id of ['run','reset','next-preset','source-seed','solve','preview','scan'])$(id).disabled=strict||busy||(!candidates().length&&filter()!=='all');
  $('source-seed').disabled||=observed;
  $('scan').disabled||=filter()!=='all';
  $('play').disabled=busy||(!engine&&!record);$('rewind').disabled=busy||!record;
  $('phase').disabled=busy||!record;$('stop').disabled=!busy;
  $('export').disabled=busy||(!engine&&!record);
  $('filter').disabled=busy;
  for(const id of ['period','iterations','solver-resolution','frames'])$(id).disabled=busy;
  $('run').textContent=engine?'Resume evolution':'Start evolution';
  $('empty-state').hidden=!empty;
}
function metrics(d){
  $('pde').textContent=d?.relativePde!==undefined?(100*d.relativePde).toFixed(1)+'%':'—';
  const sy=d?.symmetryRms??(d?.symmetry?Math.sqrt(d.symmetry.reduce((s,o)=>s+o.rms**2,0)/d.symmetry.length):undefined);
  $('symmetry').textContent=fmt(sy);$('motion').textContent=fmt(d?.temporalRms);$('return').textContent=d?.closure?.computed?fmt(d.closure.closureRms):'—';
}
function overlay(){
  $('generator-overlay').hidden=!$('show-generators').checked;
  renderGeneratorOverlay($('generator-overlay'),{groupId:group.id,tiles:+$('tiles').value,selected:selectedGenerator,onSelect:g=>{selectedGenerator=g.name;$('operation').value=g.name;overlay();drawComparison();}});
  const g=GROUP_DISPLAY[group.id].namedGenerators.find(g=>g.name===selectedGenerator);
  $('generator-description').textContent=generatorDescription(g);
  $('compare-label').textContent=`q(x, t + ${g.tau}T)`;
  document.querySelector('.scale-label').textContent=`${$('tiles').value} × ${$('tiles').value} spatial cells`;
}
function drawComparison(){
  const a=$('compare-a'),b=$('compare-b');
  if(!record){clearCanvas(a,engine?'Live field':'No recorded field');clearCanvas(b,'Future phase unavailable');$('comparison-error').textContent=engine?'Live evolution has no recorded future phase. The overlay marks the target, not a verified time symmetry.':'Select or solve a recorded candidate to compare time phases.';return;}
  const {field,config:c}=record,g=GROUP_DISPLAY[group.id].namedGenerators.find(g=>g.name===selectedGenerator),op=c.ops[g.operationIndex],palette=$('palette').value;
  renderField(a,field,c.N,c.M,phase,{palette,operation:op});
  const end=(c.M-1)/c.M;
  if(record.kind==='trajectory'&&phase+op.tau>end+1e-12){clearCanvas(b,'Beyond recording');$('comparison-error').textContent='No future frame was recorded at this phase; time is not wrapped.';return;}
  renderField(b,field,c.N,c.M,mod(phase+op.tau),{palette});
  let error=0;
  for(let ch=0;ch<2;ch++)for(let y=0;y<c.N;y++)for(let x=0;x<c.N;x++){
    const i=mapIndex(x,y,c.N,op,true),u=valueAt(field,ch,i%c.N,Math.floor(i/c.N),phase,c.N,c.M),v=valueAt(field,ch,x,y,mod(phase+op.tau),c.N,c.M);error+=(u-v)**2;
  }
  $('comparison-error').textContent=`Both concentrations · RMS difference ${fmt(Math.sqrt(error/(2*c.N*c.N)))}`;
}
function draw(){
  const options={width:768,height:768,tiles:+$('tiles').value,palette:$('palette').value};
  if(engine){engine.render(options);$('phase-label').textContent=`t = ${engine.time.toFixed(0)}`;}
  else if(record){renderField(main,record.field,record.config.N,record.config.M,phase,options);$('phase').value=phase;$('phase-label').textContent=phase.toFixed(3)+' T';drawComparison();}
  else{clearCanvas(main);$('phase-label').textContent='—';drawComparison();}
}
function animate(now){
  if(playing&&!busy){try{
    if(engine){engine.step(+$('speed').value);draw();if(now-lastStamp>1000){lastStamp=now;$('engine-label').textContent=`${engine.backend} · ${engine.N}² · t ${engine.time.toFixed(0)}`;}}
    else if(record){phase+=(now-lastTime)/8000*Math.sqrt(+$('speed').value/32);if(record.kind==='trajectory'&&phase>=(record.config.M-1)/record.config.M){phase=(record.config.M-1)/record.config.M;setPlaying(false);}else phase=mod(phase);draw();}
  }catch(error){setPlaying(false);status(error.message);}}
  lastTime=now;requestAnimationFrame(animate);
}
function cpuEngine(initial,c,canvas){
  let p={...c.params},stepper=createStepper(initial,c.N,p),time=0;
  return {N:c.N,backend:'CPU fallback',get time(){return time;},get maxDt(){return stepper.maxDt;},get effectiveDt(){return stepper.maxDt;},get params(){return {...p};},setParams(next){p={...p,...next};stepper=createStepper(stepper.state,c.N,p);},step(count){this.advance(count*stepper.maxDt);},advance(dt){stepper.advance(dt);time+=dt;},readback(){return stepper.state.slice();},render(options){renderField(canvas,stepper.state,c.N,1,0,options);},dispose(){}};
}
function newEngine(initial,c,canvas=gpuCanvas){
  try{return createWebGLGrayScott({canvas,N:c.N,initial,params:c.params,onContextLost:()=>{if(canvas===gpuCanvas){setPlaying(false);status('WebGL context was lost. Reseed to restart the simulation.');}}});}
  catch(error){fallbackReason=error.message;return cpuEngine(initial,c,canvas===gpuCanvas?main:document.createElement('canvas'));}
}
function startLive({initial=null,play=true,seedKind=null}={}){
  if(filter()==='periodic'||!valid())return;
  cancel();disposeEngine();record=null;metrics(null);const c=config();if(seedKind)c.seed=seedKind;
  const state=initial||makeInitial(currentProfile(),{N:c.N,L:c.L,ops:c.ops});
  engine=newEngine(projectKernel(state,c.N,c.ops),c);activeConfig=c;
  const gpu=engine.backend.startsWith('WebGL');gpuCanvas.hidden=!gpu;main.hidden=gpu;
  $('engine-label').textContent=`${engine.backend} · ${c.N}²`;
  $('mode-label').textContent='Live Gray–Scott · periodicity unverified';
  $('caption').textContent='Unforced chemical evolution. The marked generators are the target time symmetry; only their zero-time spatial kernel is imposed on the initial field.';
  phase=0;restrictions();drawComparison();setPlaying(play);draw();
  status(gpu?'Change F and k to explore live. Record a trial period when a pattern looks promising.':`CPU fallback: ${fallbackReason}`);updateEvidence();
}
function setProfile(p,{start=true}={}){
  profile=p;$('feed').value=p.F;$('kill').value=p.k;$('du').value=p.Du;$('dv').value=p.Dv;$('stencil').value=p.stencil;$('seed').value=p.seed;$('preset').value=p.id;
  if(filter()==='observed'){
    const r=evidence.runs.find(r=>r.profileId===p.id&&r.context.groupId===group.id&&r.classification==='moving-pattern');
    if(r){$('resolution').value=r.context.N;$('length').value=r.context.L;}
  }
  syncRanges();drawMap();updateEvidence();if(start)startLive();
}
function updateEvidence(){
  if(filter()==='periodic'){$('preset-evidence').textContent=verifiedForGroup().length?'Numerically verified in this session; finite-grid tolerances apply.':'No verified nonuniform periodic solutions for this group.';return;}
  const p=currentProfile(),same=Math.abs(p.F-profile.F)<1e-12&&Math.abs(p.k-profile.k)<1e-12;
  if(!same){$('preset').value='custom';$('preset-evidence').textContent='Custom parameter pair · periodicity unverified. No matching preset test applies.';return;}
  const result=assessProfile(profile,context(),evidence);
  $('preset-evidence').textContent=`${profile.name} · ${result.message}`;
}
function fillPresets(){
  $('preset').replaceChildren();
  const add=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;$('preset').append(option);};
  if(filter()==='periodic'){verifiedForGroup().forEach((r,i)=>add('verified-'+i,`Orbit ${i+1} · F ${r.config.params.F} · k ${r.config.params.k}`));if(!verifiedForGroup().length)add('','No verified periodic solutions');}
  else{if(filter()==='all')add('custom','Custom parameters');for(const p of candidates())add(p.id,p.name);if(!candidates().length)add('','No matching observed presets');$('preset').value=profile.id;}
}
function showRecord(r){
  disposeEngine();record=r;phase=0;setPlaying(false);metrics(r.diagnostics);
  if(filter()==='periodic'){const c=r.config;for(const [id,key] of [['feed','F'],['kill','k'],['du','Du'],['dv','Dv']])$(id).value=c.params[key];$('length').value=c.L??c.params.dx*c.N;$('stencil').value=c.params.stencil??'five-point';$('period').value=c.period;syncRanges();}
  $('mode-label').textContent=r.diagnostics?.validated?'Periodic orbit · numerical checks passed':r.kind==='preview'?'Geometric seed · not a PDE solution':r.kind==='trajectory'?'Recorded trajectory · not periodic':'Periodic candidate · not verified';
  $('caption').textContent=r.diagnostics?.validated?'This nonuniform orbit passed the PDE, symmetry, motion, return and refined forward checks on its numerical grid. Spatial and temporal refinement remain necessary for continuum accuracy.':r.kind==='preview'?'Exact time symmetry by geometric construction. This animation does not solve the Gray–Scott equations.':r.kind==='trajectory'?'Unforced forward evolution. Playback stops at the last recorded frame; its ends are not joined.':'The candidate is periodic and symmetric by construction, but has not passed all independent checks. It is not a verified periodic solution.';
  $('engine-label').textContent=`Recorded · ${r.config.N}² × ${r.config.M} frames`;
  restrictions();draw();
}
function applyFilter(){
  cancel();disposeEngine();record=null;phase=0;metrics(null);fillPresets();
  const strict=filter()==='periodic',list=candidates();
  $('filter-count').textContent=strict?`${verifiedForGroup().length} verified orbits`:filter()==='all'?'81 source presets + free exploration':`${list.length} discrete preset points`;
  $('filter-description').textContent={periodic:'Only nonuniform periodic orbits that pass all numerical checks for the selected group. An empty list is intentional.',all:'Explore freely. A failed seed or a decayed run does not establish that solutions are impossible.',source:'F and k snap together to exact Bulatov preset pairs. Source names are suggestions, not periodicity certificates.',observed:'F and k snap to presets with motion in a documented 2000-unit local test. The seed, grid and operator are locked to that test; periodicity remains unverified.'}[filter()];
  if(strict){if(verifiedForGroup().length)showRecord(verifiedForGroup()[0]);else{$('mode-label').textContent='No verified periodic orbit';$('caption').textContent='The overlay marks the requested symmetry. No patterned orbit has passed all numerical checks for this group.';$('engine-label').textContent='Engine idle';status('Periodic-only filter: no verified patterned orbit is available.');draw();}}
  else if(list.length){setProfile(list.find(p=>p.id===profile.id)||list[0]);}
  else{status('No presets satisfy this filter for the selected group.');draw();}
  restrictions();drawMap();updateEvidence();
}
function chooseGroup(id){
  group=groups.find(g=>g.id===id)||groups[0];scanPoints=[];$('scan-results').replaceChildren();history.replaceState(null,'','#'+group.id);
  for(const b of $('groups').children)b.setAttribute('aria-pressed',b.dataset.id===group.id);
  const d=GROUP_DISPLAY[group.id];$('selected-id').textContent=group.id+' / COLOR GROUP';$('selected-title').innerHTML=d.shortHTML;$('group-label').textContent=group.id+' · '+d.shortText;
  $('selected-description').textContent=group.id==='g96'?'The marked α and β quarter-turns advance three quarters of a cycle. A rotating packet must visit all four phases.':group.id==='g97'?'The marked α and β quarter-turns advance one quarter of a cycle: the opposite temporal handedness to g96.':DESCRIPTIONS[group.id][1];$('reference-link').href='../correspondence-p4.html#'+group.id;
  $('operation').replaceChildren();for(const g of d.namedGenerators){const o=document.createElement('option');o.value=g.name;o.textContent=`${g.name} · ${g.tau} T`;$('operation').append(o);}
  selectedGenerator=d.namedGenerators[0].name;$('operation').value=selectedGenerator;overlay();applyFilter();
}
function drawMap(){
  const c=map.getContext('2d'),w=map.width,h=map.height,left=56,right=20,top=20,bottom=40,pw=w-left-right,ph=h-top-bottom;
  c.clearRect(0,0,w,h);c.fillStyle='#fff';c.fillRect(0,0,w,h);c.font='20px sans-serif';c.lineWidth=1;
  for(let i=0;i<=4;i++){const x=left+pw*i/4,y=top+ph*(1-i/4);c.strokeStyle='#ece9f0';c.beginPath();c.moveTo(x,top);c.lineTo(x,h-bottom);c.moveTo(left,y);c.lineTo(w-right,y);c.stroke();c.fillStyle='#807887';c.textAlign='center';c.fillText((.2*i/4).toFixed(2),x,h-10);c.textAlign='right';c.fillText((.08*i/4).toFixed(2),left-7,y+6);}
  const strict=filter()==='periodic',allowed=new Set(candidates().map(p=>p.id));
  const points=strict?verifiedForGroup().map(r=>r.config.params):PROFILES;
  for(const p of points){const rows=evidence.runs.filter(r=>r.profileId===p.id&&r.context.groupId===group.id),moving=rows.some(r=>r.classification==='moving-pattern'),failed=rows.length&&!moving;
    c.globalAlpha=strict||filter()==='all'||allowed.has(p.id)?1:.12;c.fillStyle=strict?'#5842ad':moving?'#3d9178':failed?'#c77e4a':'#a7a2b1';c.beginPath();c.arc(left+p.F/.2*pw,top+(1-p.k/.08)*ph,p.featured?5:3.3,0,2*Math.PI);c.fill();}
  c.globalAlpha=1;if(!strict){const x=left+(+$('feed').value)/.2*pw,y=top+(1-(+$('kill').value)/.08)*ph;c.strokeStyle='#493088';c.lineWidth=3;c.beginPath();c.arc(x,y,10,0,2*Math.PI);c.stroke();}
}
function chemistryChanged(source){
  if(filter()==='periodic'||busy)return;
  if(source.endsWith('-range'))$(source.replace('-range','')).value=$(source).value;
  if(!valid())return;
  if(filter()!=='all'){
    const p=nearestProfile(+$('feed').value,+$('kill').value,candidates());if(!p)return;
    if(p.id!==profile.id){setProfile(p);return;}$('feed').value=p.F;$('kill').value=p.k;
  }
  syncRanges();if(engine){engine.setParams(config().params);activeConfig={...activeConfig,params:{...engine.params}};draw();}else if(record){record=null;startLive({play:false});}
  updateEvidence();drawMap();status('Chemistry updated. Periodicity remains unverified.');
}
async function solve(){
  if(filter()==='periodic'||!valid([...settings,'period','iterations']))return;
  cancel();const token=job,iterationLimit=+$('iterations').value,c=config(+$('solver-resolution').value),M=c.M,stride=2*c.N*c.N;
  let field;
  if(record?.kind==='preview'){
    field=new Float64Array(stride*M);
    for(let t=0;t<M;t++){const old=record.config,frame=new Float64Array(2*old.N*old.N);for(let ch=0;ch<2;ch++)for(let y=0;y<old.N;y++)for(let x=0;x<old.N;x++)frame[ch*old.N*old.N+y*old.N+x]=valueAt(record.field,ch,x,y,t/M,old.N,old.M);field.set(resampleState(frame,old.N,c.N),t*stride);}
  }else{
    const source=engine?engine.readback():record?record.field.slice(0,2*record.config.N**2):makeInitial(currentProfile(),{N:c.N,L:c.L,ops:c.ops});
    const sourceN=engine?.N??record?.config.N??c.N;
    const temporary=newEngine(projectKernel(resampleState(source,sourceN,c.N),c.N,c.ops),c,document.createElement('canvas'));
    busy=true;restrictions();$('progress').hidden=false;$('progress').value=0;field=new Float64Array(stride*M);field.set(temporary.readback());
    try{
      for(let t=1;t<M;t++){
        let left=c.period/M;
        while(left>1e-9){if(token!==job)return;const dt=Math.min(left,32*temporary.maxDt);temporary.advance(dt);left-=dt;await nextFrame();if(token!==job)return;}
        field.set(temporary.readback(),t*stride);$('progress').value=t/M;status(`Recording trial period · ${t+1}/${M} frames · ${temporary.backend}`);
      }
    }finally{temporary.dispose();}
    if(token!==job)return;
  }
  disposeEngine();record={kind:'candidate',config:c,field};busy=true;restrictions();$('progress').hidden=false;$('progress').value=0;
  status('Optimizing the periodic field in the exact selected time symmetry…');
  worker=new Worker(new URL('./worker.js?v=20260904-gpu',import.meta.url),{type:'module'});
  worker.onerror=e=>{if(token!==job)return;cancel();showRecord(record);status('Search failed: '+e.message);};
  worker.onmessage=({data})=>{
    if(token!==job)return;
    if(data.type==='error'){cancel();showRecord(record);status(data.message);return;}
    if(data.type==='validating'){status('Checking independent forward return and full-trajectory agreement…');return;}
    if(data.type==='progress'){
      record={field:data.field,config:{...c,period:data.period},kind:'candidate',diagnostics:data};metrics(data);$('mode-label').textContent='Periodic search · unverified candidate';$('progress').value=data.iteration/iterationLimit;status(`Iteration ${data.iteration} · PDE RMS ${fmt(data.pdeRms)} · T ${data.period.toFixed(1)}`);draw();return;
    }
    if(data.type==='done'){
      worker.terminate();worker=null;busy=false;$('progress').hidden=true;
      const r={field:data.field,config:{...c,period:data.period},kind:'candidate',diagnostics:data.diagnostics};
      // Only the worker's full acceptance pipeline, including refined independent
      // integration, can add a nonuniform orbit to the strict session collection.
      const accepted=hasRefinedAcceptance(data.diagnostics);
      if(data.diagnostics.validated&&!accepted){data.diagnostics.validated=false;data.diagnostics.reasons.push('The complete refined acceptance record did not pass.');}
      if(accepted)sessionVerified.push(r);
      showRecord(r);$('period').value=Math.round(data.period);
      status(`${data.iterations} iterations; ${data.reason}. ${data.diagnostics.validated?'All finite-grid numerical checks passed. This orbit is now in the verified-only filter.':data.diagnostics.reasons.join(' ')}`);
    }
  };
  worker.postMessage({mode:'solve',config:c,field,iterations:iterationLimit});
}
async function scan(){
  if(filter()!=='all'||!valid())return;
  cancel();const token=job,c=config(64),scanCanvas=document.createElement('canvas'),center={F:c.params.F,k:c.params.k},seed=currentProfile();busy=true;restrictions();scanPoints=[];$('scan-results').replaceChildren();$('progress').hidden=false;
  try{
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
      if(token!==job)return;
      const F=Math.max(0,Math.min(.2,center.F+x*.0015)),k=Math.max(0,Math.min(.08,center.k+y*.0005)),params={...c.params,F,k};
      const initial=makeInitial({...seed,F,k},{N:64,L:c.L,ops:c.ops}),test=newEngine(initial,{...c,params},scanCanvas);
      const samples=[];let state;
      try{for(let t=0;t<600;){if(token!==job)return;const dt=Math.min(12.8,600-t);test.advance(dt);t+=dt;if(t>=500)samples.push(test.readback());status(`Screening ${scanPoints.length+1}/9 · F ${F.toFixed(4)}, k ${k.toFixed(4)} · t ${t.toFixed(0)}`);await nextFrame();if(token!==job)return;}state=test.readback();}
      finally{test.dispose();}
      const movie=new Float64Array(samples.length*state.length);samples.forEach((s,i)=>movie.set(s,i*state.length));const stats=movieStats(movie,64,samples.length,[{M:[[1,0],[0,1]],v:[0,0],tau:0}]);
      let minimum=Infinity,maximum=-Infinity,finite=true;for(const v of state){minimum=Math.min(minimum,v);maximum=Math.max(maximum,v);finite&&=Number.isFinite(v);}
      const classification=classifyRun({...stats,minimum,maximum,finite}),point={F,k,classification,stats,context:{...c,params},horizon:600};scanPoints.push(point);
      const b=document.createElement('button');b.className='scan-point '+classification;b.textContent=`F ${F.toFixed(4)} · k ${k.toFixed(4)} · ${classification.replaceAll('-',' ')}`;
      b.onclick=()=>{if(busy)return;for(const [id,key] of [['feed','F'],['kill','k'],['du','Du'],['dv','Dv']])$(id).value=params[key];$('resolution').value='64';$('length').value=c.L;$('stencil').value=params.stencil;$('seed').value=c.seed;syncRanges();startLive();drawMap();};$('scan-results').append(b);$('progress').value=scanPoints.length/9;
    }
    status('Nine local screens complete. Click a result to explore it. None of these screens certify periodicity.');
  }catch(e){status('Neighborhood screen stopped: '+e.message);}
  finally{if(token===job){busy=false;$('progress').hidden=true;restrictions();}}
}
async function loadActualSeed(){
  if(filter()==='periodic')return;
  cancel();const token=job;status('Loading Bulatov’s actual U-skate chemical field…');
  try{
    const r=await fetch('data/bulatov-glider.f32');if(!r.ok)throw Error('Source field unavailable.');const data=new Float32Array(await r.arrayBuffer());if(token!==job)return;if(data.length!==128*128*2)throw Error('Unexpected source field size.');
    const p=PROFILES.find(p=>p.id==='u-skate');setProfile(p,{start:false});$('resolution').value='128';$('length').value='128';
    const planar=new Float64Array(data.length);for(let i=0;i<128*128;i++){planar[i]=data[2*i];planar[128*128+i]=data[2*i+1];}
    startLive({initial:planar,seedKind:'bulatov-field-crop'});$('preset-evidence').textContent='Actual Bulatov field crop, projected to this group’s zero-time kernel. Its time symmetry and periodicity have not been verified.';
  }catch(e){status(e.message);}
}
$('filter').value=DEFAULT_FILTER;
$('filter').onchange=applyFilter;$('explore').onclick=()=>{$('filter').value='all';applyFilter();};
$('preset').onchange=()=>{if(filter()==='periodic'){const r=verifiedForGroup()[Number($('preset').value.split('-')[1])];if(r)showRecord(r);}else{const p=PROFILES.find(p=>p.id===$('preset').value);if(p)setProfile(p);}};
$('next-preset').onclick=()=>{const list=candidates(),i=list.findIndex(p=>p.id===profile.id);setProfile(list[(i+1)%list.length]);};
for(const id of ['feed','kill','feed-range','kill-range','du','dv'])$(id).addEventListener('input',()=>chemistryChanged(id));
for(const id of ['length','resolution','seed','stencil'])$(id).onchange=()=>{if(!busy&&filter()!=='periodic')startLive();};
map.onclick=e=>{if(filter()==='periodic'||busy)return;const box=map.getBoundingClientRect(),x=(e.clientX-box.left)*map.width/box.width,y=(e.clientY-box.top)*map.height/box.height;
  $('feed').value=Math.max(0,Math.min(.2,(x-56)/(map.width-76)*.2)).toFixed(5);$('kill').value=Math.max(0,Math.min(.08,(1-(y-20)/(map.height-60))*.08)).toFixed(5);chemistryChanged('feed');};
$('run').onclick=()=>{if(engine){setPlaying(true);status('Live evolution resumed.');}else startLive();};$('reset').onclick=()=>startLive();
$('play').onclick=()=>setPlaying(!playing);$('rewind').onclick=()=>{phase=0;draw();};$('phase').oninput=()=>{phase=+$('phase').value;if(record?.kind==='trajectory')phase=Math.min(phase,(record.config.M-1)/record.config.M);setPlaying(false);draw();};
for(const canvas of [main,gpuCanvas]){canvas.onclick=()=>{if(!busy)setPlaying(!playing);};canvas.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();if(!busy)setPlaying(!playing);}};}
$('tiles').onchange=()=>{overlay();draw();};$('palette').onchange=draw;$('show-generators').onchange=overlay;
$('operation').onchange=()=>{selectedGenerator=$('operation').value;overlay();drawComparison();};
$('solve').onclick=()=>solve().catch(e=>{cancel();status(e.message);});$('scan').onclick=scan;
$('stop').onclick=()=>{cancel('Experiment cancelled. No new periodic orbit was certified.');if(record)showRecord(record);};
$('source-seed').onclick=loadActualSeed;
$('preview').onclick=()=>{if(filter()==='periodic')return;cancel();const c=config(+$('solver-resolution').value),seed=c.seed==='broken-wave'?'spiral':c.seed==='spots'?'worms':'skate',field=makePreview({...c,seed,F:c.params.F,k:c.params.k});showRecord({field,config:c,kind:'preview',diagnostics:movieStats(field,c.N,c.M,c.ops)});status('Geometric time-symmetry seed ready. Record & solve uses this movie directly.');setPlaying(true);};
$('export').onclick=()=>{
  const c=record?.config??{...activeConfig,M:1,params:{...engine.params}},out={schema:'scott-gray-orbit-v2',kind:record?.kind??'live-state',layout:'frame-major; planar U then V; x-fast; node coordinates i/N,j/N',config:c,diagnostics:record?.diagnostics??{validated:false,time:engine.time},field:Array.from(record?.field??engine.readback()),neighborhoodScreens:scanPoints};
  if(out.diagnostics.field){out.diagnostics={...out.diagnostics};delete out.diagnostics.field;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(out,(_,value)=>ArrayBuffer.isView(value)?Array.from(value):value)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`scott-gray-${group.id}-${out.kind}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try{
  const [gr,er]=await Promise.all([fetch('groups.json'),fetch('data/preset-evidence.json')]);if(!gr.ok)throw Error('Group catalog unavailable.');groups=await gr.json();if(er.ok)evidence=await er.json();
  $('groups').innerHTML=groups.map(g=>`<button class="group" data-id="${g.id}" aria-pressed="false"><strong>${GROUP_DISPLAY[g.id].shortHTML}</strong><span>${g.id}</span></button>`).join('');
  for(const b of $('groups').children)b.onclick=()=>chooseGroup(b.dataset.id);
  $('feasibility-rows').innerHTML=groups.map(g=>{const d=DESCRIPTIONS[g.id];return `<tr><td>${g.id} · ${GROUP_DISPLAY[g.id].shortHTML}</td><td>${d[4]}</td><td>${d[3]}</td><td>Compatible; existence open</td></tr>`;}).join('');
  chooseGroup(/^#g9[4-9]$/.test(location.hash)?location.hash.slice(1):'g94');window.addEventListener('hashchange',()=>{if(/^#g9[4-9]$/.test(location.hash))chooseGroup(location.hash.slice(1));});requestAnimationFrame(animate);
}catch(e){status(e.message);console.error(e);}
fetch('data/search-results.json').then(r=>r.json()).then(data=>{$('search-results').innerHTML=data.results.map(r=>`<tr><td>${r.group}</td><td>${r.finalPdeRms.toExponential(2)}</td><td>${(100*r.relativePde).toFixed(1)}%</td><td>${r.closureRms.toFixed(4)}</td><td>Unverified</td></tr>`).join('');}).catch(()=>{$('search-results').innerHTML='<tr><td colspan="5">Saved search results unavailable.</td></tr>';});
