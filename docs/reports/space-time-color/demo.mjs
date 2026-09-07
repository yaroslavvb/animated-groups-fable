import {TAU,rotate,auditModel} from './model.mjs';

const root=document.querySelector('#symmetry-demo');
const phase=root.querySelector('#phase'),rotation=root.querySelector('#rotation');
const shift=root.querySelector('#shift'),swap=root.querySelector('#swap'),bias=root.querySelector('#bias');
const play=root.querySelector('#play'),status=root.querySelector('#demo-status');
const n=192,canvases=[...root.querySelectorAll('canvas')];
const contexts=canvases.map(c=>c.getContext('2d',{alpha:false}));
const frames=contexts.map(c=>c.createImageData(n,n));
const basis=Array.from({length:4},(_,r)=>{
  const values=new Float64Array(n*n*3);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    // y increases upward, so R(x,y)=(-y,x) is counterclockwise on screen.
    const [x,y]=rotate((i+.5)/n-.5,.5-(j+.5)/n,r),p=(j*n+i)*3;
    values[p]=Math.sin(TAU*x);values[p+1]=Math.sin(TAU*y);
    values[p+2]=Math.cos(TAU*x)+Math.cos(TAU*y);
  }
  return values;
});
let running=false,lastTime=0;
function paint(canvasIndex,r,t,invert){
  const source=basis[r],bytes=frames[canvasIndex].data,c=Math.cos(TAU*t),s=Math.sin(TAU*t),b=Number(bias.value);
  for(let i=0;i<n*n;i++){
    const v=(source[i*3]*c+source[i*3+1]*s+b*source[i*3+2])*(invert?-1:1);
    const color=Math.abs(v)<1e-10?[250,249,246]:v>0?[44,85,135]:[221,116,82];
    bytes[i*4]=color[0];bytes[i*4+1]=color[1];bytes[i*4+2]=color[2];bytes[i*4+3]=255;
  }
  contexts[canvasIndex].putImageData(frames[canvasIndex],0,0);
}
function draw(){
  const t=Number(phase.value),r=Number(rotation.value),d=Number(shift.value);
  paint(0,0,t,false);paint(1,r,t+d,false);paint(2,r,t+d,swap.checked);
  root.querySelector('#phase-value').value=t.toFixed(3);
  root.querySelector('#bias-value').value=Number(bias.value).toFixed(2);
  root.querySelector('#transformed-caption').textContent=`${r*90}° rotation + ${['0','¼','½','¾'][Math.round(d*4)]} period`;
  root.querySelector('#result-caption').textContent=swap.checked?'Then exchange the two colors':'Keep the two colors';
}
function check(){
  const result=auditModel(Number(rotation.value),Number(shift.value),swap.checked,Number(bias.value));
  const exact=result.max<1e-12;
  status.dataset.matches=String(exact);
  status.textContent=exact?'Matches throughout the loop. Sampled scalar error < 10⁻¹²; no color mismatches.':`Does not match: ${(result.mismatch*100).toFixed(1)}% of sampled colored points disagree over the loop (scalar RMS ${result.rms.toFixed(3)}).`;
}
function stop(){running=false;play.textContent='Play';play.setAttribute('aria-pressed','false');}
function tick(now){
  if(!running)return;
  if(lastTime)phase.value=String((Number(phase.value)+(now-lastTime)/10000)%1);
  lastTime=now;draw();requestAnimationFrame(tick);
}
play.addEventListener('click',()=>{
  if(running){stop();return;}
  running=true;lastTime=0;play.textContent='Pause';play.setAttribute('aria-pressed','true');requestAnimationFrame(tick);
});
phase.addEventListener('input',()=>{stop();draw();});
for(const input of [rotation,shift,swap,bias])input.addEventListener('input',()=>{draw();check();});
root.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  const presets={triple:[1,.75,true],half:[0,.5,true],spaceTime:[1,.25,false]};
  const [r,d,c]=presets[button.dataset.preset];rotation.value=String(r);shift.value=String(d);swap.checked=c;bias.value='0';draw();check();
}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
draw();check();
