import {createWebGLGrayScott} from '../webgl.mjs';

const mod=(a,n)=>((a%n)+n)%n;
function seed(N) {
  const field=new Float32Array(2*N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
    const i=y*N+x;
    field[i]=.6+.19*Math.sin(x*1.31+y*.23);
    field[N*N+i]=.13+.08*Math.cos(x*.71-y*.47);
  }
  return field;
}
// Independent double-precision reference; no shader source is shared.
function rates(field,N,p) {
  const out=new Float64Array(field.length),S=N*N;
  for(let c=0;c<2;c++)for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
    const i=y*N+x,index=c*S+i;
    let axial=0,diagonal=0;
    for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]])axial+=field[c*S+mod(y+b,N)*N+mod(x+a,N)];
    if(p.stencil==='bulatov9')for(const [a,b] of [[1,1],[-1,1],[1,-1],[-1,-1]])diagonal+=field[c*S+mod(y+b,N)*N+mod(x+a,N)];
    const lap=p.stencil==='bulatov9'?.8*axial+.2*diagonal-4*field[index]:axial-4*field[index];
    const U=field[i],V=field[S+i],reaction=U*V*V;
    out[index]=(c?p.Dv:p.Du)*lap/(p.dx*p.dx)+(c?reaction-(p.F+p.k)*V:-reaction+p.F*(1-U));
  }
  return out;
}
function cpuStep(field,N,p,count,dt) {
  let q=Float64Array.from(field);
  for(let i=0;i<count;i++) {
    const first=rates(q,N,p),mid=q.map((v,j)=>v+dt*.5*first[j]),second=rates(mid,N,p);
    q=q.map((v,j)=>v+dt*second[j]);
  }
  return q;
}
function maxError(a,b){if(a.length!==b.length)throw Error('Mismatched array lengths');let error=0;for(let i=0;i<a.length;i++)error=Math.max(error,Math.abs(a[i]-b[i]));return error;}
function cpuProject(field,N,ops) {
  const out=new Float64Array(field.length),kernel=ops.filter(op=>op.tau===0),S=N*N;
  for(const op of kernel)for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
    const nx=mod(Math.round(op.M[0][0]*x+op.M[0][1]*y+op.v[0]*N),N),ny=mod(Math.round(op.M[1][0]*x+op.M[1][1]*y+op.v[1]*N),N);
    for(let c=0;c<2;c++)out[c*S+y*N+x]+=field[c*S+ny*N+nx]/kernel.length;
  }
  return out;
}

export async function runWebGLTests() {
  const {renderField}=await import('../render.mjs');
  const results=[],engines=[];
  function expect(condition,message){if(!condition)throw Error(message);}
  async function test(name,run){try{const details=await run();results.push({name,passed:true,...details});}catch(error){results.push({name,passed:false,error:error.message});}}
  const N=16,initial=seed(N),params={Du:.16,Dv:.08,F:.037,k:.061,dx:1.17,dt:.2,stencil:'five-point'};
  let engine;
  await test('WebGL2 + RGBA32F upload / readback',()=>{
    engine=createWebGLGrayScott({canvas:document.createElement('canvas'),N,initial,params});engines.push(engine);
    const error=maxError(engine.readback(),initial);expect(error===0,`Upload error ${error}`);return {maxError:error};
  });
  if(!engine)return {passed:false,results};
  for(const stencil of ['five-point','bulatov9'])await test(`${stencil}: 80 midpoint steps match independent CPU`,()=>{
    const p={...params,stencil};engine.upload(initial);engine.setParams(p);engine.step(80,.2);
    const error=maxError(engine.readback(),cpuStep(initial,N,p,80,.2));expect(error<3e-6,`CPU/GPU mismatch ${error}`);return {maxError:error};
  });
  await test('Live parameter changes and exact-duration advance',()=>{
    const p={...params,Du:.2097,Dv:.105,F:.062,k:.0609,dx:.9,dt:.13,stencil:'bulatov9'};
    engine.upload(initial);engine.setParams(p);const info=engine.advance(3.09);
    const error=maxError(engine.readback(),cpuStep(initial,N,p,info.steps,info.dt));expect(error<3e-6,`Changed-parameter mismatch ${error}`);
    expect(Math.abs(engine.time-3.09)<1e-12,'Requested duration was not respected');return {maxError:error,steps:info.steps,dt:info.dt};
  });
  await test('Instantaneous spatial kernel matches CPU with translations',()=>{
    const ops=[
      {M:[[1,0],[0,1]],v:[0,0],tau:0},
      {M:[[-1,0],[0,-1]],v:[.5,.5],tau:0},
      {M:[[0,-1],[1,0]],v:[0,0],tau:.25},
    ];
    engine.upload(initial);engine.projectKernel(ops);const error=maxError(engine.readback(),cpuProject(initial,N,ops));
    expect(error<1e-7,`Kernel mismatch ${error}`);return {maxError:error};
  });
  await test('Quarter-turn kernels preserve integer lattice nodes',()=>{
    const ops=[{M:[[1,0],[0,1]],v:[0,0],tau:0},{M:[[0,-1],[1,0]],v:[0,0],tau:0},{M:[[-1,0],[0,-1]],v:[0,0],tau:0},{M:[[0,1],[-1,0]],v:[0,0],tau:0}];
    engine.upload(initial);engine.projectKernel(ops);const error=maxError(engine.readback(),cpuProject(initial,N,ops));
    expect(error<1e-7,`Rotation mismatch ${error}`);return {maxError:error};
  });
  await test('GPU palettes, tiling and screen orientation',()=>{
    engine.upload(initial);const width=64,height=48,tiles=2;
    engine.render({width,height,tiles,palette:'concentration'});const gl=engine.canvas.getContext('webgl2'),pixel=new Uint8Array(4);
    let error=0;
    for(const [x,y] of [[0,0],[63,0],[2,36],[57,47],[19,28]]) {
      gl.readPixels(x,height-1-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      const sx=(x+.5)/width*tiles*N,sy=(y+.5)/height*tiles*N,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
      let v=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)v+=(dx?fx:1-fx)*(dy?fy:1-fy)*initial[N*N+mod(iy+dy,N)*N+mod(ix+dx,N)];
      const t=Math.round(Math.max(0,Math.min(1,v/.4))*1023)/1023,expected=[18+227*t,18+227*t,24+227*t].map(Math.round);
      for(let c=0;c<3;c++)error=Math.max(error,Math.abs(pixel[c]-expected[c]));expect(pixel[3]===255,'Palette alpha is not opaque');
    }
    expect(error<=1,`Rendered pixels differ from CPU by ${error}`);
    engine.render({palette:'ember'});engine.render({palette:'ceramic'});return {maxChannelError:error};
  });
  await test('CPU renderer and GPU agree on node coordinates and periodic seams',()=>{
    engine.upload(initial);const width=128,height=96,tiles=2,palette='concentration';
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    let largestDifference=0;
    for(const operation of [null,{M:[[0,-1],[1,0]],v:[.5,.25],tau:0}]){
      renderField(canvas,initial,N,1,0,{tiles,palette,operation});engine.render({width,height,tiles,palette,operation});
      const cpu=canvas.getContext('2d').getImageData(0,0,width,height).data,gpu=new Uint8Array(cpu.length),gl=engine.canvas.getContext('webgl2');
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,gpu);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let ch=0;ch<3;ch++)largestDifference=Math.max(largestDifference,Math.abs(cpu[4*(y*width+x)+ch]-gpu[4*((height-1-y)*width+x)+ch]));
    }
    // CPU interpolates an 8-bit palette; GPU interpolates float chemistry first.
    // With the linear concentration palette their rounding differs by ≤2 levels.
    expect(largestDifference<=2,`CPU/GPU coordinate or seam mismatch: ${largestDifference}`);return {maxChannelError:largestDifference};
  });
  await test('A fixed concentration range reveals low-U orbits with matching CPU/GPU colors',()=>{
    const low=new Float32Array(2*N*N);low.fill(.17,0,N*N);low.fill(.08,N*N);engine.upload(low);
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const gl=engine.canvas.getContext('webgl2'),gpu=new Uint8Array(4);
    let largestDifference=0;
    for(const [palette,range] of [['ember',[.13,.21]],['ceramic',[.13,.21]],['concentration',[.04,.12]]]){
      renderField(canvas,low,N,1,0,{palette,range});engine.render({width:64,height:64,palette,range});
      const cpu=canvas.getContext('2d').getImageData(32,32,1,1).data;gl.readPixels(32,31,1,1,gl.RGBA,gl.UNSIGNED_BYTE,gpu);
      for(let ch=0;ch<3;ch++)largestDifference=Math.max(largestDifference,Math.abs(cpu[ch]-gpu[ch]));
      expect(cpu[0]+cpu[1]+cpu[2]>150,'A low-concentration orbit remains clamped to the background');
    }
    expect(largestDifference<=1,`Custom concentration range differs by ${largestDifference} color levels`);
    let rejected=0;for(const range of [[1,1],[2,1],[0,NaN]])for(const run of [()=>engine.render({range}),()=>renderField(canvas,low,N,1,0,{range})])try{run();}catch{rejected++;}
    expect(rejected===6,'Invalid fixed color ranges were accepted');return {maxChannelError:largestDifference,invalidRangesRejected:rejected};
  });
  await test('Diffusion timestep cap prevents oversized requests',()=>{
    engine.upload(initial);engine.setParams({Du:.3,Dv:.15,dx:.1,dt:2});const info=engine.step(1,4);
    expect(Math.abs(info.dt-.006)<1e-12,`Bad safe timestep ${info.dt}`);return {effectiveDt:info.dt};
  });
  await test('Invalid parameters and nonlattice symmetries are rejected',()=>{
    let count=0;
    for(const run of [()=>engine.setParams({dx:0}),()=>engine.setParams({F:NaN}),()=>engine.upload(new Float32Array(5)),()=>engine.projectKernel([{M:[[1,0],[0,1]],v:[.1,0],tau:0}])])try{run();}catch{count++;}
    expect(count===4,`Only ${count}/4 invalid inputs were rejected`);return {rejected:count};
  });
  await test('GPU work completes on a 256×256 lattice',()=>{
    const large=createWebGLGrayScott({canvas:document.createElement('canvas'),N:256,initial:seed(256),params});engines.push(large);
    const started=performance.now();large.step(100);large.render({width:768,height:768,tiles:2});large.canvas.getContext('webgl2').finish();
    const elapsedMs=performance.now()-started;expect(large.readback().every(Number.isFinite),'GPU benchmark diverged');return {elapsedMs,steps:100,N:256};
  });
  await test('Context loss is detected and reported',async()=>{
    const canvas=document.createElement('canvas');let reported=false;
    const lostEngine=createWebGLGrayScott({canvas,N,initial,onContextLost:()=>{reported=true;}});engines.push(lostEngine);
    const ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');expect(Boolean(ext),'Context-loss testing extension is unavailable');ext.loseContext();
    await new Promise(resolve=>setTimeout(resolve,100));
    let rejected=false;try{lostEngine.step();}catch{rejected=true;}
    expect(reported&&rejected&&lostEngine.lost,'Context loss was not propagated');return {reported,rejected};
  });
  for(const item of engines)item.dispose();
  return {passed:results.every(test=>test.passed),results};
}
