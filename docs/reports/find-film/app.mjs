import { lessons } from './lessons.mjs';
import { N, SIZE, LENGTH, noise, rest, rate, simulate, slide, turn, project, sweep } from './engine.mjs';

const $ = s => document.querySelector(s), ink = '#252b3b', muted = '#656d7e', blue = '#364bc4', orange = '#ae5229';
const initial = noise(1), symmetric = project(initial), first = sweep(symmetric, 6.355);
let published = null, current = 0, allMode = false, selectedSweep = first, history = [], busy = false, finished = false, labNoise=symmetric;
const widgets = new Set(), esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let comparison=null;
function phaseComparison(){
  if(comparison||!published)return comparison;
  const T=6.390159918584649, target=published[0], start=published[7];
  const coarse=Array.from({length:24},(_,j)=>simulate(start,T*j/24));
  const maximum=q=>q.reduce((m,v,i)=>Math.max(m,Math.abs(v-target[i])),0);
  let p=coarse.reduce((best,q)=>maximum(q)<maximum(best)?q:best),refined=[p];
  for(let j=0;j<4;j++){
    const speed=rate(p),step=p.reduce((v,x,i)=>v+(target[i]-x)*speed[i],0)/speed.reduce((v,x)=>v+x*x,0);
    p=simulate(p,((step%T)+T)%T+1e-12);refined.push(p);
  }
  return comparison={T,coarse,refined};
}
const rms = q => Math.sqrt(q.reduce((s,v)=>s+v*v,0)/q.length), sci = v => Number.isFinite(v) ? v.toExponential(2) : '—';
const blend = (a,b,t) => Float64Array.from(a,(v,i)=>v*(1-t)+b[i]*t);
function text(c,t,x,y,size=14,color=ink,align='left'){const scale=c.canvas.width===760?1.4:c.canvas.width===820?1.2:1;c.font=`${size*scale}px -apple-system, BlinkMacSystemFont, sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(t,x,y);}
function line(c,x,y,X,Y,color=blue,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();}
function arrow(c,x,y,X,Y,color=blue){line(c,x,y,X,Y,color,3);const a=Math.atan2(Y-y,X-x);c.fillStyle=color;c.beginPath();c.moveTo(X,Y);c.lineTo(X-10*Math.cos(a-.45),Y-10*Math.sin(a-.45));c.lineTo(X-10*Math.cos(a+.45),Y-10*Math.sin(a+.45));c.closePath();c.fill();}
function color(t){t=Math.max(0,Math.min(1,t));const stops=[[30,40,105],[61,81,173],[154,176,224],[238,237,219],[221,147,68],[143,58,35]],p=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(p)),f=p-i;return stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*f));}
const tile=document.createElement('canvas');tile.width=tile.height=120;const tc=tile.getContext('2d');
function field(c,q,x,y,w,h,{channel=0,lo=.5,hi=2.7,label='',difference=false}={}){
  const image=tc.createImageData(120,120);
  for(let Y=0;Y<120;Y++)for(let X=0;X<120;X++){
    // Cartesian view of a repeated triangular mesh: x_cart=x-y/2, y_cart=√3 y/2.
    const fy=(1-Y/120)*1.35/(Math.sqrt(3)/2),fx=X/120*1.35+fy/2;
    const ix=((Math.floor(fx*N)%N)+N)%N,iy=((Math.floor(fy*N)%N)+N)%N,v=q[channel*SIZE+iy*N+ix];
    const rgb=difference?color(.5+v/(2*Math.max(hi,1e-14))):color((v-lo)/(hi-lo)),p=4*(Y*120+X);
    image.data[p]=rgb[0];image.data[p+1]=rgb[1];image.data[p+2]=rgb[2];image.data[p+3]=255;
  }tc.putImageData(image,0,0);c.imageSmoothingEnabled=true;c.drawImage(tile,x,y,w,h);
  if(label)text(c,label,x+w/2,y+h+22,13,muted,'center');
}
function panels(c,arrays,labels,opts={}){
  const gap=20,w=(760-gap*(arrays.length-1))/arrays.length,h=arrays.length>2?145:175,y=12;
  let lo=Infinity,hi=-Infinity;for(const q of arrays)for(let i=0;i<SIZE;i++){lo=Math.min(lo,q[i]);hi=Math.max(hi,q[i]);}
  if(hi-lo<.02){lo-=.01;hi+=.01;}
  arrays.forEach((q,i)=>field(c,q,i*(w+gap),y,w,h,{lo,hi,...opts,label:labels[i]}));
}
function base(canvas){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);return c;}
function axes(c,x=50,y=205,w=650,h=170){line(c,x,y,x+w,y,'#dce0e8',1);line(c,x,y,x,y-h,'#dce0e8',1);}
function graph(c,fn,{label='value',point=.5,color=blue}={}){axes(c);c.strokeStyle=color;c.lineWidth=3;c.beginPath();for(let i=0;i<=200;i++){const t=i/200,v=fn(t),X=50+t*650,Y=120-v*65;i?c.lineTo(X,Y):c.moveTo(X,Y);}c.stroke();const X=50+point*650,Y=120-fn(point)*65;c.fillStyle=color;c.beginPath();c.arc(X,Y,6,0,7);c.fill();text(c,label,55,25,13,muted);text(c,'0',50,226,12,muted);text(c,'1',700,226,12,muted,'right');}
function lattice(c,s,stencil=false,axis='column',cell=Math.round(s*35)){
  if(!stencil){
    const step=4.4,originX=82,originY=28,physicalX=493,physicalY=32;
    text(c,'Array addresses',160,235,15,muted,'center');text(c,'Triangular physical lattice',540,235,15,muted,'center');
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const selected=axis==='row'?y===cell:x===cell;
      c.fillStyle=selected?orange:'#c8cddb';c.fillRect(originX+x*step,originY+y*step,selected?3.5:2,selected?3.5:2);
      const X=physicalX+step*(x-y/2),Y=physicalY+step*Math.sqrt(3)/2*y;
      c.beginPath();c.arc(X,Y,selected?2.3:1.1,0,7);c.fill();
    }
    arrow(c,278,109,365,109,muted);text(c,`${axis} ${cell}`,380,257,14,orange,'center');return;
  }
  const cx=380,cy=120,d=58,chosen=Math.min(5,Math.floor(s*6)),dirs=[[1,0],[-1,0],[-.5,-Math.sqrt(3)/2],[.5,Math.sqrt(3)/2],[.5,-Math.sqrt(3)/2],[-.5,Math.sqrt(3)/2]];
  for(let y=-2;y<=2;y++)for(let x=-4;x<=4;x++){const X=cx+d*(x-y/2),Y=cy+d*Math.sqrt(3)/2*y;if(X<40||X>720||Y<15||Y>215)continue;line(c,X,Y,X+d,Y,'#e3e6ee',1);line(c,X,Y,X-d/2,Y+d*Math.sqrt(3)/2,'#e3e6ee',1);line(c,X,Y,X+d/2,Y+d*Math.sqrt(3)/2,'#e3e6ee',1);c.fillStyle='#abb2c3';c.beginPath();c.arc(X,Y,3,0,7);c.fill();}
  dirs.forEach(([dx,dy],i)=>{const X=cx+d*dx,Y=cy+d*dy;line(c,cx,cy,X,Y,i===chosen?orange:blue,3);c.fillStyle=i===chosen?orange:blue;c.beginPath();c.arc(X,Y,8,0,7);c.fill();text(c,'+1',X,Y-14,12,muted,'center');});c.fillStyle=blue;c.beginPath();c.arc(cx,cy,12,0,7);c.fill();text(c,'−6',cx,cy+4,12,'white','center');text(c,'Each edge has length h = L/N',380,244,14,muted,'center');
}
function drawWidget(w){if(!w.canvas.isConnected)return;const c=base(w.canvas),l=w.lesson,v=+w.input.value,min=+w.input.min,max=+w.input.max,s=(v-min)/(max-min||1),d=$('#use-inspected').checked?selectedSweep:first;let read='',display=Number.isInteger(v)?String(v):v.toFixed(3);const q=d.q0,kind=l.kind;
  if(kind==='grid'){const axis=l.id==='indices'?'row':'column',cell=Math.round(v);lattice(c,s,false,axis,cell);display=`${axis} ${cell}`;read=`Highlighted ${axis} ${cell}: ${axis==='row'?`y=${cell}, x=0…35`:`x=${cell}, y=0…35`}. The same 36 addresses appear in square storage and on an oblique triangular lattice. N=36 and L=40 remain fixed.`;}
  else if(kind==='laplacian'){lattice(c,s,true);read='Six equal-distance neighbors minus six copies of the center; multiply by 2/(3h²).';}
  else if(kind==='imports'){
    if(l.id==='import-numpy'){const channel=Math.round(v),name=channel?'v':'u';panels(c,[rest(),initial],[`${name}: uniform layer`,`${name}: noisy layer`],{channel,lo:channel?1.4:.5,hi:channel?3.3:2.7});text(c,'q.shape = (2, 36, 36)',380,250,17,muted,'center');display=`q[${channel}] = ${name}`;read=`Selected species ${name}: q[${channel}] is a 36 × 36 array containing 1,296 concentrations. NumPy performs arithmetic on both layers together.`;}
    else {const labels=['Noise','Find film','Compare'],positions=[125,380,635],active=s<.28?0:s<.75?1:2;positions.forEach((X,j)=>{c.fillStyle=j===active?'#edf0ff':'#f4f5f8';c.fillRect(X-95,70,190,75);text(c,labels[j],X,115,19,j===active?blue:muted,'center');if(j<2)arrow(c,X+100,108,X+150,108,muted);});line(c,75,201,685,201,'#dce0e8',3);c.fillStyle=orange;c.beginPath();c.arc(75+610*s,201,9,0,7);c.fill();display=`${Math.round(s*100)}% through workflow`;read=`Workflow position ${Math.round(s*100)}%: ${labels[active]}. urllib.request is used only in the optional comparison after find_film returns; the search itself uses NumPy and random noise.`;}
  }
  else if(kind==='rest'){const r=rest(),mixed=1+1.3*s,shown=new Float64Array(LENGTH).fill(mixed);field(c,r,20,55,145,125,{channel:0,label:'u = 1'});field(c,shown,250,25,260,175,{label:`Blend = ${mixed.toFixed(3)}`});field(c,r,595,55,145,125,{channel:1,label:'v = 2.3'});arrow(c,180,117,232,117,muted);arrow(c,580,117,528,117,muted);display=`${Math.round((1-s)*100)}% u + ${Math.round(s*100)}% v`;read=`Displayed layer blend: (1−${s.toFixed(2)}) × 1 + ${s.toFixed(2)} × 2.3 = ${mixed.toFixed(3)}. Both actual equilibrium layers remain constant, and rate(rest)=0. This display blend adds no noise.`;}
  else if(kind==='seed'){const seed=l.id==='seed'?Math.round(v):1,amplitude=l.id==='run-search'?v:.1,r=rest(),sample=noise(seed),raw=Float64Array.from(r,(x,i)=>x+(sample[i]-x)*(amplitude/.1));panels(c,[raw,project(raw)],[`Seed ${seed}: noisy u`,'After the turn average']);display=l.id==='seed'?`seed ${seed}`:`noise σ = ${amplitude.toFixed(3)}`;read=`Seed ${seed}; Gaussian noise amplitude σ=${amplitude.toFixed(3)}. ${amplitude===0?'This is exactly the stationary equilibrium.':'Independent perturbations are added to both species, then the turn symmetry is imposed.'} The browser generator differs from NumPy; this slider changes the illustration, not the solver below.`;}
  else if(kind==='reaction'){const changingV=l.id==='unpack',u=changingV?1:v,vv=changingV?v:2.3,ru=1-3.3*u+u*u*vv,rv=2.3*u-u*u*vv;text(c,'Local reaction only; diffusion omitted',60,30,15,muted);line(c,380,65,380,205,'#dce0e8',2);arrow(c,380,95,380+ru*55,95,blue);arrow(c,380,165,380+rv*55,165,orange);text(c,'du/dt',60,100,17,blue);text(c,'dv/dt',60,170,17,orange);text(c,ru.toFixed(3),705,100,16,blue,'right');text(c,rv.toFixed(3),705,170,16,orange,'right');text(c,`u = ${u.toFixed(2)}, v = ${vv.toFixed(2)}`,380,245,17,muted,'center');read=`At u=${u.toFixed(2)}, v=${vv.toFixed(2)}: du/dt=${ru.toFixed(3)}, dv/dt=${rv.toFixed(3)}. The u²v transfer is ${(u*u*vv).toFixed(3)}. ${changingV?'Only local v changes.':'Only local u changes.'}`;display=`${changingV?'v':'u'} = ${v.toFixed(2)}`;}
  else if(kind==='timestep'){const counting=l.id==='rk4-loop',t=counting?.13:v,n=Math.ceil(t/.02),h=t/n,completed=counting?Math.round(v):n;for(let j=0;j<n;j++){const X=50+j*660/n;c.fillStyle=j<completed?'#dce2ff':'#f2f3f7';c.fillRect(X,93,660/n,54);line(c,X,83,X,158,blue,1);}line(c,710,83,710,158,blue,2);line(c,50,120,710,120,blue,2);text(c,`${n} equal steps; h = ${h.toFixed(6)}`,380,45,19,ink,'center');text(c,'0',50,190,16,muted);text(c,`t = ${t.toFixed(3)}`,710,190,16,muted,'right');if(counting){c.fillStyle=orange;c.beginPath();c.arc(50+660*completed/n,120,8,0,7);c.fill();text(c,`Elapsed: ${(completed*h).toFixed(6)}`,380,245,17,orange,'center');}else text(c,'Each h ≤ dt = 0.02',380,245,17,muted,'center');read=counting?`${completed} of ${n} RK4 steps completed: elapsed time ${completed} × ${h.toFixed(6)} = ${(completed*h).toFixed(6)} of ${t.toFixed(3)}. Each step evaluates four slopes.`:`Requested t=${t.toFixed(3)}: n=ceil(t/0.02)=${n}, h=t/n=${h.toFixed(6)}. Exactly ${n} steps cover t without exceeding the maximum dt.`;display=counting?`${completed} / ${n} steps`:l.id==='actual-step'?`h = ${h.toFixed(6)}`:`t = ${t.toFixed(3)}; n = ${n}`;}
  else if(kind==='rk4'){const h=.02,ks=[rate(q)];ks.push(rate(Float64Array.from(q,(x,i)=>x+h/2*ks[0][i])));ks.push(rate(Float64Array.from(q,(x,i)=>x+h/2*ks[1][i])));ks.push(rate(Float64Array.from(q,(x,i)=>x+h*ks[2][i])));const stage=['rk4-k1','rk4-k2','rk4-k3','rk4-k4'].indexOf(l.id),weighted=stage<0,direction=weighted?Float64Array.from(q,(_,i)=>(ks[0][i]+2*ks[1][i]+2*ks[2][i]+ks[3][i])/6):ks[Math.max(0,stage-1)],probe=Float64Array.from(q,(x,i)=>x+h*v*direction[i]),delta=Float64Array.from(q,(_,i)=>h*v*direction[i]),range=Math.max(1e-12,...direction.map(Math.abs))*h;panels(c,[q,probe,delta],['q',weighted?'Weighted update':'Trial state','Δq (rescaled)']);field(c,delta,520,12,240,145,{difference:true,hi:range,label:'Δq (rescaled)'});text(c,`Illustrative h = 0.02; fraction = ${v.toFixed(2)}`,380,250,16,muted,'center');if(weighted)read=`Fraction ${v.toFixed(2)} of h × (k1+2k2+2k3+k4)/6; RMS change ${sci(rms(delta))}. At fraction 1 this is the full RK4 update.`;else if(stage===0)read=`k1 is always evaluated at the original q. The slider follows ${v.toFixed(2)}h along its tangent to illustrate the first Euler estimate; RMS displacement ${sci(rms(delta))}. It does not change the sampling point of k1.`;else {const exact=stage===3?1:.5;read=`The lesson remains k${stage+1}. Its probe is q + ${v.toFixed(2)}h × k${stage}; the exact code uses fraction ${exact}. Current probe RMS displacement ${sci(rms(delta))}; velocity RMS ${sci(rms(rate(probe)))}. Other fractions illustrate nearby probes.`;}display=weighted?`${Math.round(v*100)}% of weighted update`:stage===0?`${v.toFixed(2)}h along k1`:`k${stage+1} probe at ${v.toFixed(2)}h`;}
  else if(kind==='slide'){const f=published?.[0]||q,k=Math.min(3,Math.floor(s*3.999));let moved=f;for(let i=0;i<k;i++)moved=slide(moved);panels(c,[f,moved],['Original',`${k} slide${k===1?'':'s'} (wrapped)`]);read=`S${k===0?'⁰':k===1?'':k===2?'²':'³'} reads source indices (y+${(12*k)%36}, x+${(24*k)%36}) modulo 36. Three slides restore the array.`;display=`${k} slides`;}
  else if(kind==='turn'){const k=Math.min(3,Math.floor(s*3.999));let moved=initial;for(let i=0;i<k;i++)moved=turn(moved);panels(c,[initial,moved],['Noisy original',`${k} turns`]);read='This is an exact index permutation, not image interpolation. Three turns restore every concentration.';display=`${k} turns`;}
  else if(kind==='project'){const out=blend(initial,symmetric,s);panels(c,[initial,out],['Original noise','Blend toward (q + Rq + R²q)/3']);read=`${Math.round(s*100)}% of the spatial projection applied. At 100% the array is exactly 120° invariant, up to roundoff.`;display=`${Math.round(s*100)}%`;}
  else if(['free','third','twoThirds'].includes(kind)){const t=kind==='free'?d.T*s:kind==='third'?d.T/3*s:d.T/3*(1+s),start=kind==='free'?d.input:q;let f;if(w.lastTime!==t||w.lastData!==d){f=simulate(start,t);w.cached=f;w.lastTime=t;w.lastData=d;}else f=w.cached;panels(c,[start,f],[kind==='free'?'Input to sweep':'q after free period',`Simulated t = ${t.toFixed(3)}`]);read=kind==='free'?'The free period lets dynamically decaying components shrink. No symmetry average is used during integration.':`Physical evolution only. At the endpoint this is ${kind==='third'?'third':'two_thirds'}, before applying any slide.`;display=`t = ${t.toFixed(3)}`;}
  else if(kind==='lag'){
    const elapsed=d.T/3+v;
    if(w.lastTime!==elapsed||w.lastData!==d){w.cached=slide(simulate(q,elapsed));w.lastTime=elapsed;w.lastData=d;}
    const aligned=w.cached,lag=Float64Array.from(q,(value,i)=>aligned[i]-value);
    panels(c,[q,aligned,lag],['q','Slid later frame','Difference'],{lo:Math.min(...q.subarray(0,SIZE),...aligned.subarray(0,SIZE)),hi:Math.max(...q.subarray(0,SIZE),...aligned.subarray(0,SIZE))});
    field(c,lag,520,12,240,145,{difference:true,hi:Math.max(...lag.map(Math.abs)),label:'Difference (rescaled)'});
    read=`Extra sampling time ${v.toFixed(3)}: RMS difference ${sci(rms(lag))}. Zero extra time reproduces slide(third) − q for this sweep.`;
    display=`extra t = ${v.toFixed(3)}`;
  }
  else if(kind==='tolerance'){
    const tolerance=10**v,ok=d.residual<tolerance,scale=e=>50+Math.max(0,Math.min(1,(e+12)/10))*650;
    line(c,50,130,700,130,'#dce0e8',3);
    for(let exponent=-12;exponent<=-2;exponent+=2){const X=scale(exponent);line(c,X,125,X,138,'#abb1c0',1);text(c,`10^${exponent}`,X,170,12,muted,'center');}
    const tx=scale(v),rx=scale(Math.log10(d.residual));
    line(c,tx,80,tx,140,blue,3);text(c,'tolerance',Math.max(75,Math.min(665,tx)),63,13,blue,'center');
    c.fillStyle=orange;c.beginPath();c.arc(rx,130,8,0,7);c.fill();text(c,'RMS',Math.max(75,Math.min(665,rx)),205,14,orange,'center');
    text(c,ok?'PASS: RMS < tolerance':'KEEP SWEEPING',380,252,18,ok?blue:orange,'center');
    read=`Actual RMS=${sci(d.residual)}; tolerance=${sci(tolerance)}. ${ok?'The test passes.':'The test does not pass.'} RMS includes all 2,592 entries.`;
    display=sci(tolerance);
  }
  else if(kind==='speed'){
    const frame=published?.[Math.min(47,Math.floor(s*48))]||q,velocity=rate(frame);
    panels(c,[frame,velocity],['Concentration u','Instantaneous du/dt'],{lo:Math.min(...frame.subarray(0,SIZE)),hi:Math.max(...frame.subarray(0,SIZE))});
    field(c,velocity,390,12,370,175,{difference:true,hi:Math.max(...velocity.subarray(0,SIZE).map(Math.abs)),label:'du/dt (rescaled)'});
    read=`Saved-film phase ${s.toFixed(3)} T. Actual RMS speed of both species: ${sci(rms(velocity))}. The rate is a tangent to the orbit, not a finite time step.`;
    display=`phase ${s.toFixed(3)} T`;
  }
  else if(kind==='correction'){
    const delta=v,clipped=Math.max(-.1,Math.min(.1,delta));
    axes(c,70,195,620,150);line(c,380,45,380,205,'#dce0e8',1);
    arrow(c,380,155,550,95,blue);arrow(c,380,155,380+delta*650,155-delta*225,orange);
    text(c,'speed = rate(q)',550,65,15,blue,'center');
    text(c,'lag projected onto speed',380,235,14,orange,'center');
    read=`Schematic estimated δT=${delta.toFixed(3)}; T_new = T − (${clipped.toFixed(3)}). Actual sweep estimate: ${d.rawCorrection.toFixed(6)}. Factor 3 converts a third-period error to a full-period error.`;
    display=`δT = ${delta.toFixed(3)}`;
  }
  else if(kind==='average'){const avg=blend(q,d.qnext,s);panels(c,[q,d.aligned1,d.aligned2,avg],['q','S third','S² two_thirds',s===1?'Their average':'Blend to average']);read=`Blend ${(s*100).toFixed(0)}% toward (q + S third + S² two_thirds)/3. These frames use the old T; the new T is used next sweep.`;display=`${Math.round(s*100)}%`;}
  else if(kind==='return'){
    const frame=published?.[Math.min(47,Math.floor(s*48))]||q;
    panels(c,[frame,frame],['One possible returned frame','The same orbit, same period']);
    field(c,frame,390,12,370,175,{channel:1,lo:1.4,hi:3.3,label:'Returned frame · v'});
    read=`Saved-film example: phase ${s.toFixed(3)} T, period 6.3901599186. The frame changes with the choice of time zero; the period does not. Run below to obtain an independent answer.`;
    display=`phase ${s.toFixed(3)} T`;
  }
  else if(kind==='loop'){
    if(history.length&&l.id!=='no-convergence'){
      const i=Math.min(history.length-1,Math.floor(s*history.length)),h=history[i];
      panels(c,[h.input,h.q0,h.qnext],['Start of sweep','After free period',h.done?'Returned q':'Next starting q']);
      read=`Measured sweep ${h.sweep}: T=${h.T.toFixed(10)}, RMS=${sci(h.residual)}. ${h.done?'The residual test passed.':'Continue unless the budget is exhausted.'}`;
      display=`sweep ${i+1} of ${history.length}`;
    }else{
      const budget=Math.round(v),active=Math.min(3,Math.floor(s*4)),labels=['Free T','Two thirds','Check / adjust','Average'];
      labels.forEach((label,j)=>{const X=20+j*190;c.fillStyle=j===active?blue:'#f0f2f7';c.fillRect(X,65,160,85);text(c,label,X+80,115,13,j===active?'white':muted,'center');if(j<3)arrow(c,X+163,107,X+185,107,'#abb1c0');});
      text(c,`Sweep budget: ${budget} of 399`,380,205,19,ink,'center');
      read=l.id==='no-convergence'?`Budget ${budget}: the exception reports a failed search, not that no film exists. ${history.length?`The current live run has completed ${history.length} sweeps.`:'Run below to measure actual convergence.'}`:`Sweep ${budget}: repeated operations shown schematically. Run below to replace this schematic with measured sweep states.`;
      display=`sweep ${budget}`;
    }
  }
  else if(kind==='download'){const count=Math.floor(s*10368);for(let j=0;j<48;j++){const x=18+(j%24)*30,y=60+Math.floor(j/24)*70;c.fillStyle=j/48<s?blue:'#e6e9f1';c.fillRect(x,y,23,45);}text(c,'First-frame prefix: 10,368 bytes',380,35,18,ink,'center');text(c,`${count.toLocaleString()} bytes → ${Math.floor(count/4).toLocaleString()} complete float32 values`,380,245,16,muted,'center');read=`Illustrated prefix progress ${Math.round(s*100)}%: ${count.toLocaleString()} of 10,368 bytes, enough for ${Math.floor(count/4).toLocaleString()} complete values. ${l.id==='published-url'?'Assigning url performs no download; this control previews the later read.':'The downloaded file also contains later frames; this schematic follows only the first-frame prefix.'} The solver never reads reference data.`;display=`${count.toLocaleString()} / 10,368 bytes`;}
  else if(kind==='decode'){const channel=Math.round(v),name=channel?'v':'u',start=channel*SIZE,end=start+SIZE-1,reference=published?.[0]||rest();field(c,reference,190,12,380,175,{channel,lo:channel?1.4:.5,hi:channel?3.3:2.7,label:published?`Reference layer ${name}`:`Equilibrium placeholder: ${name}`});text(c,`q[${channel}, y, x] ← values ${start.toLocaleString()}…${end.toLocaleString()}`,380,250,16,muted,'center');read=`Layer ${channel} is ${name}: float32 values ${start}…${end}, at byte offsets ${start*4}…${(end+1)*4-1} in the first frame. Decode little-endian, promote to float64, then reshape (2,36,36). ${published?'The displayed values come from the loaded reference.':'Reference is loading; the labelled placeholder is uniform.'}`;display=`species ${name}; layer ${channel}`;}
  else if(['phase','refine','compare'].includes(kind)){
    const example=phaseComparison();
    if(!example){text(c,'Loading the saved comparison example…',380,120,18,muted,'center');read='The phase example becomes available when the published binary has loaded.';}
    else {
      let frame,phaseLabel;
      if(kind==='phase'){
        const j=Math.round(v);frame=example.coarse[j];phaseLabel=`candidate j = ${j}`;display=`j = ${j}, t = ${(j/24).toFixed(3)} T`;
      }else if(l.id==='refine-loop'){
        const pass=Math.round(v);frame=example.refined[pass];phaseLabel=`refinement pass ${pass}`;display=`${pass} of 4 passes`;
      }else if(l.id==='refine-step'){
        const error=v,forward=((error%example.T)+example.T)%example.T;
        frame=simulate(example.refined[4],forward);phaseLabel=`offset ${error.toFixed(3)} time units`;display=`forward offset ${forward.toFixed(4)}`;
      }else{frame=simulate(example.refined[4],s*example.T);phaseLabel=`phase ${s.toFixed(3)} T`;display=`phase ${s.toFixed(3)} T`;}
      let maximum=0;for(let i=0;i<LENGTH;i++)maximum=Math.max(maximum,Math.abs(frame[i]-published[0][i]));
      panels(c,[published[0],frame],['Published first frame',phaseLabel]);
      read=`Max difference ${sci(maximum)}. Numerical phase-alignment example starts at saved frame 7 and uses actual RK4, 24 candidates and four tangent corrections. It illustrates the comparison only, independently of the noise solver.`;
    }
  }
  else {panels(c,[q,d.qnext],['q','After this sweep']);read='The two species are stored as separate planes of one array.';}
  w.output.textContent=display;w.readout.textContent=read;w.canvas.dataset.drawn='true';
}

let lineNo=1;lessons.forEach(l=>{l.startLine=lineNo;l.lineCount=l.code.split('\n').length;lineNo+=l.lineCount+1;});
$('#line-count').textContent=`${lessons.length} statements`;
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){const w=[...widgets].find(w=>w.canvas===e.target);if(w)drawWidget(w);}}),{rootMargin:'180px'});
function makeLesson(l,index){const el=document.createElement('article');el.className='lesson';el.id=`lesson-${l.id}`;el.innerHTML=`<div class="lesson-top"><p class="lesson-meta">${esc(l.chapter)} · LINE${l.lineCount>1?'S':''} ${l.startLine}${l.lineCount>1?'–'+(l.startLine+l.lineCount-1):''}</p><h3>${esc(l.title)}</h3><pre><code>${esc(l.code)}</code></pre></div><div class="lesson-visual"><p class="diagram-label">${['imports','grid','laplacian','reaction','correction','timestep','download'].includes(l.kind)?'Interactive schematic + measured readout':l.kind==='phase'||l.kind==='refine'||l.kind==='compare'?'Interactive saved-film phase illustration':'Interactive array diagram'}</p><canvas width="760" height="265" role="img" aria-label="${esc(l.title)}: use the labelled slider to explore this statement."></canvas><div class="mini-controls"><label for="control-${index}-${allMode?'all':'guided'}">${esc(l.control||'Explore this line')}</label><output></output><input id="control-${index}-${allMode?'all':'guided'}" type="range" min="${l.min??0}" max="${l.max??1}" step="${l.step??.01}" value="${l.value??.5}"></div><p class="mini-readout" aria-live="polite"></p></div><div class="lesson-prose">${l.explanation}<div class="try"><b>TRY THIS</b>${l.tryThis}</div></div>`;
  const w={lesson:l,canvas:el.querySelector('canvas'),input:el.querySelector('input'),output:el.querySelector('output'),readout:el.querySelector('.mini-readout')};widgets.add(w);w.input.addEventListener('input',()=>drawWidget(w));observer.observe(w.canvas);return el;}
lessons.forEach((l,i)=>{l.code.split('\n').forEach((line,j)=>{const btn=document.createElement('button');btn.className='source-line';btn.dataset.lesson=i;btn.innerHTML=`<span class="ln">${l.startLine+j}</span>${esc(line)||' '}`;btn.title=`Line ${l.startLine+j}: ${line}`;btn.addEventListener('click',()=>select(i));$('#source').append(btn);});const gap=document.createElement('div');gap.style.height='9px';$('#source').append(gap);});
const chapters=[...new Set(lessons.map(l=>l.chapter))];chapters.forEach(ch=>{const b=document.createElement('button');b.textContent=ch;b.addEventListener('click',()=>{const i=lessons.findIndex(l=>l.chapter===ch);if(allMode){$(`#lesson-${lessons[i].id}`).scrollIntoView({block:'start'});}else select(i);});$('#chapters').append(b);});
function select(i,updateHash=true){current=Math.max(0,Math.min(lessons.length-1,i));for(const w of [...widgets])if(w.canvas.closest('#active-lesson')){observer.unobserve(w.canvas);widgets.delete(w);}$('#active-lesson').replaceChildren(makeLesson(lessons[current],current));$('#position').textContent=`${current+1} of ${lessons.length}`;$('#previous').disabled=!current;$('#next').disabled=current===lessons.length-1;document.querySelectorAll('.source-line').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.lesson===current)));const b=document.querySelector(`.source-line[data-lesson="${current}"]`),source=$('#source');if(b)source.scrollTop=b.offsetTop-source.offsetTop-55;document.querySelectorAll('#chapters button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===lessons[current].chapter)));if($('#chapter-picker'))$('#chapter-picker').value=lessons[current].chapter;if(updateHash)window.history.replaceState(null,'',`#line-${lessons[current].id}`);drawWidget([...widgets].find(w=>w.canvas.closest('#active-lesson')));}
$('#previous').onclick=()=>select(current-1);$('#next').onclick=()=>select(current+1);
const pickerLabel=document.createElement('label');pickerLabel.className='chapter-picker';pickerLabel.textContent='Jump to a chapter';
const picker=document.createElement('select');picker.id='chapter-picker';picker.setAttribute('aria-label','Code chapter');
chapters.forEach(ch=>{const option=document.createElement('option');option.value=ch;option.textContent=ch;picker.append(option);});
picker.onchange=()=>{const i=lessons.findIndex(l=>l.chapter===picker.value);if(allMode)$(`#lesson-${lessons[i].id}`).scrollIntoView({block:'start'});else select(i);};
pickerLabel.append(picker);$('#chapters').after(pickerLabel);

function mode(all){allMode=all;$('#walkthrough').classList.toggle('all-mode',all);$('#notebook').setAttribute('aria-pressed',String(all));$('#guided').setAttribute('aria-pressed',String(!all));$('#all-lessons').hidden=!all;if(all&&!$('#all-lessons').children.length)lessons.forEach((l,i)=>$('#all-lessons').append(makeLesson(l,i)));if(!all)select(current);}
$('#notebook').onclick=()=>mode(true);$('#guided').onclick=()=>mode(false);
const requested=location.hash.replace('#line-',''),idx=lessons.findIndex(l=>l.id===requested);select(idx<0?0:idx,false);if(idx>=0)requestAnimationFrame(()=>$('#walkthrough').scrollIntoView({block:'start'}));

let heroPhase=0,heroPlaying=false,lastHero=0;function drawHero(){const cv=$('#hero'),c=base(cv);if(!published){text(c,'Loading the published film…',410,180,19,muted,'center');return;}const aligned=$('#hero-align').checked,labels=['0','T/3','2T/3'];for(let j=0;j<3;j++){let f=published[(Math.floor(heroPhase*48)+j*16)%48];if(aligned)for(let k=0;k<j;k++)f=slide(f);field(c,f,10+j*270,40,255,255,{label:(aligned?['q','S third','S² two_thirds'][j]:`t = ${labels[j]}`)});}text(c,aligned?'Three copies of the same frame':'One film, three moments',410,360,18,ink,'center');}
$('#hero-align').onchange=()=>{drawHero();$('#hero-caption').textContent=$('#hero-align').checked?'Each later frame is pulled back by its matching slide. The three saved frames coincide up to Float32 precision.':'The published film at 0, T/3, and 2T/3. Slide the later frames back: the three pictures match.';};
function heroTick(now){if(!heroPlaying)return;if(lastHero)heroPhase=(heroPhase+(now-lastHero)/6400)%1;lastHero=now;drawHero();requestAnimationFrame(heroTick);}$('#hero-play').onclick=()=>{heroPlaying=!heroPlaying;lastHero=0;$('#hero-play').textContent=heroPlaying?'Pause film':'Play film';$('#hero-play').setAttribute('aria-pressed',String(heroPlaying));if(heroPlaying)requestAnimationFrame(heroTick);};drawHero();
fetch('../../scott-gray/data/equation-orbits/e47c12f9099fb9d2b6d4.f32').then(r=>{if(!r.ok)throw Error(`Film HTTP ${r.status}`);return r.arrayBuffer();}).then(b=>{const dv=new DataView(b);published=Array.from({length:48},(_,j)=>Float64Array.from({length:LENGTH},(_,i)=>dv.getFloat32(4*(j*LENGTH+i),true)));drawHero();widgets.forEach(drawWidget);document.body.dataset.ready='true';}).catch(e=>{$('#hero-caption').textContent=`Saved film could not load: ${e.message}. The independent solver can still run.`;document.body.dataset.ready='error';});

function drawConvergence(){const c=base($('#convergence')),W=600,H=360,x=58,y=305,w=515,h=255;c.fillStyle='#fff';c.fillRect(0,0,W,H);for(let exponent=-2;exponent>=-10;exponent-=2){const Y=y-(exponent+1)/-10*h;line(c,x,Y,x+w,Y,'#e5e8ef',1);text(c,`10^${exponent}`,x-10,Y+4,11,muted,'right');}const tolY=y-9/10*h;c.setLineDash([5,5]);line(c,x,tolY,x+w,tolY,orange,1);c.setLineDash([]);text(c,'tol = 10⁻¹⁰',x+w,tolY-8,11,orange,'right');if(history.length){c.beginPath();history.forEach((r,i)=>{const X=x+i/Math.max(25,history.length-1)*w,Y=y-Math.max(0,Math.min(10,-Math.log10(r.residual)-1))/10*h;i?c.lineTo(X,Y):c.moveTo(X,Y);});c.strokeStyle=blue;c.lineWidth=3;c.stroke();history.forEach((r,i)=>{const X=x+i/Math.max(25,history.length-1)*w,Y=y-Math.max(0,Math.min(10,-Math.log10(r.residual)-1))/10*h;c.beginPath();c.arc(X,Y,3,0,7);c.fillStyle=blue;c.fill();});}text(c,'RMS mismatch · log scale',x,28,14,ink);text(c,'sweep',x+w,y+30,12,muted,'right');text(c,'1',x,y+25,11,muted);text(c,String(Math.max(26,history.length)),x+w-40,y+25,11,muted,'right');}
function drawLab(d){const c=base($('#lab-field'));if(d?.q0){panels(c,[d.q0,d.aligned1,d.aligned2],['q after free T','S third','S² two_thirds']);text(c,`sweep ${d.sweep||1} · u field · common concentration scale`,380,252,15,muted,'center');$('#lab-caption').textContent=`Sweep ${d.sweep}: T=${d.T.toFixed(10)}, RMS=${sci(d.residual)}. These are the three inputs to the average.`;}else {panels(c,[labNoise,labNoise],['Projected noise · u','Projected noise · v']);field(c,labNoise,390,12,370,175,{channel:1,lo:1.4,hi:3.3,label:'Projected noise · v'});}}
function controls(){for(const id of ['step','restart','seed'])$('#'+id).disabled=busy||finished&&id==='step';$('#run').disabled=busy||finished;$('#pause').disabled=!busy;}
let worker;try{worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});worker.onerror=e=>{busy=false;$('#lab-status').textContent=`Worker error: ${e.message}`;controls();};worker.onmessage=({data:d})=>{if(d.type==='ready'){labNoise=d.q;history=[];finished=false;selectedSweep=first;$('#sweep-value').textContent='0';$('#period-value').textContent=d.T.toFixed(10);$('#residual-value').textContent='—';$('#correction-value').textContent='—';$('#inspect').disabled=true;$('#inspect-value').textContent='No sweeps yet';$('#lab-status').textContent=`Seed ${d.seed}: ready. Noise generated independently of the published film.`;drawLab();$('#lab-caption').textContent=`Seed ${d.seed}: rotation-symmetric starting noise, before any sweep.`;drawConvergence();controls();}else if(d.type==='sweep'){history.push(d);$('#sweep-value').textContent=d.sweep;$('#period-value').textContent=d.T.toFixed(10);$('#residual-value').textContent=sci(d.residual);$('#correction-value').textContent=d.done?'—':(-d.correction).toFixed(6);$('#inspect').disabled=false;$('#inspect').max=history.length;$('#inspect').value=history.length;selectedSweep=d;$('#inspect-value').textContent=`Sweep ${d.sweep} · T used ${d.T.toFixed(8)}`;drawLab(d);drawConvergence();if(d.done||d.exhausted){busy=false;finished=true;$('#lab-status').textContent=d.done?`Film found in ${d.sweep} sweeps. T = ${d.T.toFixed(10)}; RMS mismatch = ${sci(d.residual)}.`:'Stopped after 399 sweeps without reaching the tolerance.';}else $('#lab-status').textContent=`${busy?'Running':'Completed'} sweep ${d.sweep}. The next sweep will use T=${d.Tnext.toFixed(10)}.`;if($('#use-inspected').checked)widgets.forEach(drawWidget);controls();}else if(d.type==='paused'){busy=false;$('#lab-status').textContent=`Paused after ${d.sweep} sweeps.`;controls();}else if(d.type==='error'){busy=false;finished=true;$('#lab-status').textContent=d.message;controls();}};worker.postMessage({type:'start',seed:1});}catch(e){$('#lab-status').textContent=`Worker unavailable: ${e.message}`;}
$('#restart').onclick=()=>{busy=false;finished=false;worker?.postMessage({type:'start',seed:+$('#seed').value||1});};$('#step').onclick=()=>worker?.postMessage({type:'step'});$('#run').onclick=()=>{busy=true;controls();worker?.postMessage({type:'run'});};$('#pause').onclick=()=>worker?.postMessage({type:'pause'});
$('#inspect').oninput=()=>{selectedSweep=history[+$('#inspect').value-1];if(!selectedSweep)return;drawLab(selectedSweep);$('#inspect-value').textContent=`Sweep ${selectedSweep.sweep} · T used ${selectedSweep.T.toFixed(8)}`;if($('#use-inspected').checked)widgets.forEach(drawWidget);};$('#use-inspected').onchange=()=>widgets.forEach(drawWidget);drawLab();drawConvergence();
window.addEventListener('hashchange',()=>{const i=lessons.findIndex(l=>`#line-${l.id}`===location.hash);if(i>=0){mode(false);select(i,false);}});
window.__findFilm={get history(){return history;},get lessons(){return lessons;},select,mode,get selectedSweep(){return selectedSweep;}};
