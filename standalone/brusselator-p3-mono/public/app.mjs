import {createPlayer,drawCPU} from './playback.mjs';
const $=id=>document.getElementById(id);
const mod=x=>((x%1)+1)%1;
const meta=await (await fetch('record.json')).json();
const bytes=await (await fetch('field.f32')).arrayBuffer();
const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
if(bytes.byteLength!==meta.bytes||hash!==meta.sha256){$('msg').textContent='Field data failed its integrity check.';throw Error('bad field');}
const record={config:meta.config,ranges:meta.ranges,field:new Float32Array(bytes)};
const p=meta.config.params;
$('params').textContent=`a ${p.a} · b ${p.b} · Dᵤ ${p.Du} · Dᵥ ${p.Dv} · L ${meta.config.L} · period T ${meta.config.period.toFixed(2)} · ${meta.config.N}² nodes × ${meta.config.M} frames`;
const gpu=$('gpu'),cpu=$('cpu');
let engine=null;
const fallback=()=>{engine?.dispose?.();engine=null;gpu.hidden=true;cpu.hidden=false;};
try{engine=createPlayer(gpu,record,{onContextLost:fallback});}catch{fallback();}
const opts={palette:'mono',tiles:2};
const draw=()=>{if(engine){try{engine.draw(phase,opts);return;}catch{fallback();}}drawCPU(cpu,record,phase,opts);};
let phase=0,playing=true,last=0;
const q=new URLSearchParams(location.search);
if(q.has('phase'))phase=mod(+q.get('phase')||0);
if(q.get('play')==='0')playing=false;
const setPlaying=v=>{playing=v;$('play').textContent=v?'Ⅱ Pause':'▶ Play';};
$('play').onclick=()=>setPlaying(!playing);
$('phase').oninput=()=>{phase=Math.min(+$('phase').value,1-1e-6);setPlaying(false);draw();};
$('play').disabled=$('phase').disabled=false;setPlaying(playing);$('msg').textContent='';
const tick=now=>{if(playing){phase=mod(phase+Math.min(now-last,100)/8000*+$('speed').value);$('phase').value=phase;}last=now;draw();requestAnimationFrame(tick);};
requestAnimationFrame(t=>{last=t;tick(t);});
